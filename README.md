# NearPaw

Satu project Next.js 16 (App Router) untuk **website publik**, **admin website**, dan **backend API** NearPaw. Dipisah lewat struktur folder (bukan project terpisah), mengikuti [Texium](https://github.com/muhAzri/Texium):

- **Frontend**: Feature-Driven Architecture
- **Backend**: Domain-Driven Design + Clean/Hexagonal layering
- **Database**: belum ada (akan memakai Supabase). Akses data nanti ditaruh di `infrastructure/` tiap module, di balik Repository port di `domain/`

| URL | Isi |
| --- | --- |
| `/` | Website publik (feature `landing`) |
| `/impact`, `/impact/how-we-allocate`, `/impact/allocations/[id]` | Alokasi dampak (feature `impact`, `content`) |
| `/help`, `/about`, `/privacy`, `/terms`, `/guidelines`, `/disclaimer` | Halaman statis dan legal (feature `content`) |
| `/support`, `/privacy-requests` | Formulir publik (feature `support`) |
| `/r/[ref]` | Halaman share laporan (feature `shared-report`) |
| `/admin/login`, `/admin/*` | Admin website (feature `admin`) |
| `/api/v1/*` | Backend API, dipakai juga oleh app iOS NearPaw |

## Quick start

```bash
cp .env.example .env     # sudah dibuat saat scaffold
npm install
npm run dev              # http://localhost:3000
```

| Script | Fungsi |
| --- | --- |
| `dev` / `build` / `start` | Next.js |
| `lint` | ESLint, termasuk **aturan boundary arsitektur** |
| `typecheck` | `next typegen && tsc --noEmit` |
| `test` / `test:watch` | Vitest (domain & application) |

## Struktur

```
src/
├── app/                       ROUTING SAJA (tipis). Tidak ada logic.
│   ├── page.tsx               -> website publik
│   ├── admin/**               -> admin website (layout + page)
│   └── api/v1/**/route.ts     -> adapter ke backend controller
│
├── contracts/                 Zod schema + types + route paths.
│                              Satu-satunya kode yang di-share FE <-> BE.
│
├── frontend/
│   ├── features/<feature>/    api/ , components/ , hooks/ , lib/ , index.ts (PUBLIC API)
│   │   ├── landing/           beranda publik
│   │   ├── impact/            halaman impact publik
│   │   ├── content/           help, about, legal, 404
│   │   ├── support/           form support + privacy request
│   │   ├── shared-report/     halaman share laporan
│   │   ├── admin/             login, shell, dan semua layar console
│   └── shared/                ui/, lib/ (api-client, site) lintas feature
│
└── backend/
    ├── modules/<module>/
    │   ├── domain/            Entity, Value Object, Repository PORT, domain errors. Murni TS
    │   ├── application/       Use cases + mapper ke DTO
    │   ├── infrastructure/    Adapter data (Supabase, nanti)
    │   ├── presentation/      HTTP controller (Web Request/Response, bukan Next)
    │   ├── <module>.module.ts Composition root (DI manual)
    │   └── index.ts           PUBLIC API module
    └── shared/                domain errors, http helpers, env
```

### Arah dependency

```
app/ ──> frontend/features ──> frontend/shared ──> contracts
  │
  └────> backend/modules/*/index ──> presentation ──> application ──> domain
                                     infrastructure ──────────────────┘ (implements ports)
```

Dipaksa `npm run lint`:

| Layer | Tidak boleh import |
| --- | --- |
| `contracts` | frontend, backend, next, react |
| `frontend/**` | `@/backend/**`; internal feature lain |
| `backend/**` | frontend, `app`, `next`, `react`; internal module lain |
| `backend/**/domain` | application/infrastructure/presentation, `zod`, contracts |
| `backend/**/application` | infrastructure/presentation |

Frontend hanya bicara ke backend lewat HTTP `/api/v1/*` (`frontend/shared/lib/api-client`), jadi backend bisa dipindah ke service lain tanpa mengubah frontend.

## Menambah fitur (contoh: `pets`)

1. Buat tabel `pets` di Supabase.
2. `src/contracts/pets.contract.ts` → schema + routes; export di `contracts/index.ts`.
3. `src/backend/modules/pets/` → `domain` → `application` → `infrastructure` → `presentation` → `pets.module.ts` → `index.ts`.
4. `src/app/api/v1/pets/route.ts` → panggil controller (`await connection()` untuk GET dinamis).
5. `src/frontend/features/pets/` → `api/`, `components/`, `index.ts`.
6. `src/app/admin/pets/page.tsx` (atau halaman publik) → render dari `@/frontend/features/pets`.

## Catatan

- Response envelope: `{ "data": ... }` atau `{ "error": { code, message, details } }`.
- Admin: login lewat `/admin/login` (email + password akun Supabase dengan role admin, tanpa MFA). Token Bearer disimpan di `sessionStorage` (kedaluwarsa 8 jam); layar `/admin/*` mengarahkan ke login bila sesi tidak ada atau 401. Belum ada cookie/BFF.
- Frontend publik mengambil data dari `/api/v1/*` di dalam `<Suspense>` (Cache Components); halaman statis tidak memanggil backend saat build.
- Token desain (warna, font, radius) ada di `src/app/globals.css`; komponen dasar di `src/frontend/shared/ui`.
- Teks legal bertanda `[...]` di `features/content/lib/legal-copy.ts` masih placeholder.

## Backend API (v1)

Modul di `src/backend/modules` (dirakit di `src/backend/composition.ts`, satu-satunya tempat modul bertemu lewat port):

| Modul | Isi |
| --- | --- |
| `identity` | Akun email + password lewat Supabase Auth (daftar, verifikasi email, lupa password), login admin (akun Supabase yang sama + `users.role = 'admin'`, lockout 5x/15 menit), profil, block, hapus akun, moderasi user |
| `regions` | Region **opsional** (override expiry/support), feature flag, safety limits, ad placement global atau per region (placement terkunci tidak bisa diaktifkan) |
| `reports` | Laporan (live langsung, expire otomatis, rate limit, kontak dilarang di teks), update komunitas, flag + auto-hide, review/keep/duplicate/hide/remove, dashboard stats |
| `impact` | Periode + alokasi: draft → verified → published; total per mata uang, tidak pernah dijumlah lintas mata uang |
| `alerts` | Pengaturan area/radius/hewan, feed, device token, fan-out saat laporan terbit |
| `support` | Pesan support + privacy request publik (rate limit, honeypot), inbox admin (email dimasking) |
| `audit` | Log append-only + export CSV |
| `admin` | Agregat dashboard |

Endpoint publik/app: `/api/v1/{auth/{register,sign-in,forgot-password,resend-verification},config,regions,reports,reports/[ref],reports/[ref]/updates,reports/[ref]/block-reporter,public/reports/[ref],flags,me/**,impact/**,support,privacy-requests}`.
Endpoint admin (`Bearer` token admin): `/api/v1/admin/**` (login, dashboard, reports, updates, flags, users, impact, regions, config, ad-placements, audit, support, privacy-requests).

Auth: `Authorization: Bearer <token>`. Sign-in app memakai email + password lewat Supabase Auth (butuh `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; email konfirmasi dan reset dikirim Supabase). Tanpa keduanya di development, akun disimpan in-memory dan langsung terkonfirmasi. Token app tetap diterbitkan backend ini. Env: lihat `.env.example`.

### Belum ada (sengaja)

- **Persistensi**: semua repository masih in-memory di `infrastructure/` (hilang saat restart). Ganti dengan adapter Supabase di balik port `domain/repositories.ts` tanpa mengubah use case.
- **Upload foto**: API menerima storage key `public/...` (EXIF sudah dibuang oleh pipeline media); pipeline + signed upload belum dibuat.
- **Push (APNs) dan email**: `PushNotifier` / `Mailer` masih placeholder yang melaporkan "tidak terkirim".
- **Captcha** form web (`support`, `privacy-requests`): hanya honeypot + rate limit.

### Database (Supabase)

Skema dipecah per modul di `supabase/migrations/*.sql` (urut timestamp, jangan diedit setelah dijalankan; perubahan = file baru; jalankan lewat `supabase db push` atau SQL editor). RLS aktif tanpa policy: hanya server (secret key) yang boleh akses. Adapter Supabase untuk tiap `domain/repositories.ts` **belum ditulis**; saat ini app masih memakai repository in-memory.

### Cakupan global

Pelaporan bisa dilakukan di mana saja; tidak perlu mendaftarkan region/negara. Region hanya override opsional (mis. masa expiry). Untuk membatasi hanya region aktif, nyalakan feature flag `restrictToRegions` (default mati). Expiry default: `safetyLimits.reportExpiryDays` (7).
