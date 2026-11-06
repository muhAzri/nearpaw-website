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
| `identity` | Akun email + password lewat Supabase Auth (daftar, verifikasi email, lupa password), login admin (akun Supabase yang sama + `users.role = 'admin'`, lockout 5x/15 menit), profil, block, hapus akun (profil dianonimkan dan akun Supabase Auth dihapus), moderasi user |
| `regions` | Region **opsional** (override expiry/support), feature flag, safety limits, ad placement global atau per region (placement terkunci tidak bisa diaktifkan) |
| `reports` | Laporan (live langsung, expire otomatis, rate limit, kontak dilarang di teks), update komunitas, flag + auto-hide, review/keep/duplicate/hide/remove, dashboard stats |
| `impact` | Periode + alokasi: draft → verified → published; total per mata uang, tidak pernah dijumlah lintas mata uang |
| `alerts` | Pengaturan area/radius/hewan, feed, device token, fan-out saat laporan terbit |
| `support` | Pesan support + privacy request publik (rate limit, honeypot), inbox admin (email dimasking) |
| `media` | URL upload foto presigned (Cloudflare R2 / S3): app mengompres foto ke WebP di HP, lalu meng-upload langsung ke bucket |
| `audit` | Log append-only + export CSV |
| `admin` | Agregat dashboard |

Endpoint publik/app: `/api/v1/{auth/{register,sign-in,forgot-password,resend-verification},config,regions,media/uploads,reports,reports/[ref],reports/[ref]/updates,reports/[ref]/block-reporter,public/reports/[ref],flags,me/**,impact/**,support,privacy-requests}`.
Endpoint admin (`Bearer` token admin): `/api/v1/admin/**` (login, dashboard, reports, updates, flags, users, impact, regions, config, ad-placements, audit, support, privacy-requests).

Auth: `Authorization: Bearer <access token>`. Sign-in app memakai email + password lewat Supabase Auth (butuh `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; email konfirmasi dan reset dikirim Supabase). Keduanya wajib; tanpa itu API menolak berjalan. Token sesi adalah JWT Supabase Auth (backend tidak menerbitkan token sendiri). Env: lihat `.env.example`.

### Belum ada (sengaja)

- **Persistensi**: Supabase adalah satu-satunya sumber data. Semua modul (users, blocks, alerts, reports, updates, flags, regions, config, ad placement, impact, support, audit, rate limit, login lockout) disimpan di Postgres lewat adapter `supabase-*.ts` di balik port `domain/repositories.ts`. `SUPABASE_SECRET_KEY` wajib; tanpa itu API gagal dengan error jelas, tidak ada fallback in-memory. Jalankan semua migrasi di `supabase/migrations` dulu. Test double in-memory hanya ada di `src/backend/__tests__/support/`.
- **Email**: `Mailer` masih placeholder yang melaporkan "tidak terkirim".
- **Captcha** form web (`support`, `privacy-requests`): hanya honeypot + rate limit.

### Sesi: JWT Supabase Auth

Sign-in mengembalikan **access token** (JWT Supabase, 1 jam) dan **refresh token** milik Supabase. Backend tidak menyimpan state sesi apa pun, jadi restart atau pindah instance tidak pernah mengakhiri sesi.

- **Verifikasi**: setiap request memverifikasi JWT (tanda tangan, issuer, audience, expiry) dengan `jose` terhadap JWKS project (`/auth/v1/.well-known/jwks.json`). Project yang masih memakai JWT secret lama: isi `SUPABASE_JWT_SECRET`.
- **Refresh**: `POST /api/v1/auth/refresh` `{ refreshToken }` diteruskan ke Supabase. Rotasi, deteksi pemakaian ulang, dan kedaluwarsa dikelola Supabase; yang ditolak menjadi 401.
- **Sign-out**: `POST /api/v1/auth/sign-out` dengan bearer access token mengakhiri sesi di Supabase (selalu 204).
- **Profil**: dibuat otomatis saat pertama kali akun terlihat (dari klaim `sub` dan `email`), jadi baris profil yang hilang (misalnya tabel dikosongkan) tidak membuat token valid ditolak.
- Akun banned/deleted ditolak seketika dan tidak bisa refresh. Akun `restricted` tetap bisa refresh karena masih boleh browsing. Refresh dibatasi 30 kali/jam per token.

### Upload foto (presigned URL, Cloudflare R2 / S3)

Byte gambar **tidak pernah lewat server ini**. Alurnya:

1. App mengecilkan foto (maks 1600 px, orientasi EXIF diterapkan, metadata/GPS dibuang) dan mengompresnya ke **WebP di HP** (libwebp), jadi server tidak perlu memproses gambar.
2. `POST /api/v1/media/uploads` `{ purpose: "report" | "update", files: [{ contentType: "image/webp", sizeBytes }] }` (user login, rate limit 20 request/jam) → `{ uploads: [{ key, uploadUrl, method: "PUT", headers, expiresAt }] }`. URL berlaku 5 menit dan **menandatangani** `Content-Type`, `Content-Length` (ukuran persis) dan `Cache-Control`, sehingga bucket menolak file dengan tipe/ukuran lain. Maks 4 file/request, 2 MB/file.
3. App `PUT` file ke `uploadUrl` dengan header persis seperti yang dikembalikan (tanpa `Authorization`).
4. App mengirim `key` ke `POST /reports` (`photos`). Key berbentuk `public/<purpose>/<userId>/<id>.webp`; server menolak key milik user lain.

Konfigurasi R2 (lihat `.env.example`): `S3_BUCKET`, `S3_REGION=auto`, `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com` (tanpa nama bucket), `S3_FORCE_PATH_STYLE=true`, `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` (token R2 "Object Read & Write" khusus bucket ini). Agar foto bisa dibaca publik, aktifkan subdomain `r2.dev` (dev) atau custom domain (produksi) di bucket, lalu isi `S3_PUBLIC_BASE_URL`; nilainya dikirim ke app lewat `GET /api/v1/config` (`mediaBaseUrl`). Tanpa `S3_BUCKET`, endpoint upload menjawab 503 `SERVICE_UNAVAILABLE`. Catatan: presigned URL hanya berfungsi di domain `r2.cloudflarestorage.com`, bukan di custom domain. Foto laporan yang sudah expired/closed/removed dihapus oleh job harian (lihat "Housekeeping terjadwal"). Foto yatim (di-upload tetapi tidak pernah dipakai laporan) belum disapu oleh job; pasang lifecycle rule bucket (mis. hapus objek `public/` yang lebih tua dari 90 hari; aman karena expiry laporan maksimal 60 hari) sebagai pengaman.

### Housekeeping terjadwal (Vercel Cron)

`vercel.json` menjadwalkan `GET /api/v1/cron/housekeeping` tiap hari 03:00 UTC (Hobby plan hanya mengizinkan sekali sehari). Endpoint menolak (503) tanpa `CRON_SECRET`, dan 401 bila header `Authorization: Bearer <CRON_SECRET>` salah. Vercel mengirim header itu otomatis setelah `CRON_SECRET` diisi di Environment Variables project (buat dengan `openssl rand -hex 32`). Tiap task jalan terpisah; satu yang gagal tidak menghentikan lainnya, dan responsnya 500 supaya terlihat gagal di log Cron.

| Task | Isi |
| --- | --- |
| `photos` | Hapus file foto (+ thumbnail `_t.webp`) laporan dan update-nya bila laporan expired lebih dari 3 hari, closed lebih dari 3 hari, atau removed; lalu kosongkan `photos` di database. File dihapus dulu: bila gagal, tidak ada yang dikosongkan dan run berikutnya mengulang. Maks 1000 laporan per run. |
| `rate-limits` | Hapus baris `rate_limit_hits` yang lebih tua dari 1 hari (termasuk IP di key form support). |

Uji manual: `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/v1/cron/housekeeping`.

### Push notification (Firebase Cloud Messaging)

App iOS mendaftarkan **FCM token** lewat `POST /me/devices`; saat laporan terbit, backend mengirim ke tiap perangkat lewat FCM HTTP v1 (FCM meneruskan ke APNs). Teks netral: "A new report was posted near <area>." dengan `data.ref` agar ketukan membuka laporan. Token yang dinyatakan mati oleh FCM (`UNREGISTERED`) otomatis dihapus; gangguan sementara tidak menghapus apa pun, dan kegagalan push tidak pernah menggagalkan pembuatan laporan.

Konfigurasi: `FIREBASE_SERVICE_ACCOUNT_JSON` (Firebase console > Project settings > Service accounts > Generate new private key; raw atau base64) dan opsional `FIREBASE_PROJECT_ID`. Tanpa itu, alert tetap muncul di feed dalam app tetapi tidak ada push. Sisi Apple dikerjakan di luar kode: tambahkan capability Push Notifications di Xcode dan unggah APNs auth key (.p8) di Firebase console > Project settings > Cloud Messaging.

### Database (Supabase)

Skema dipecah per modul di `supabase/migrations/*.sql` (urut timestamp, jangan diedit setelah dijalankan; perubahan = file baru; jalankan lewat `supabase db push` atau SQL editor). RLS aktif tanpa policy: hanya server (secret key) yang boleh akses. Tiap `domain/repositories.ts` punya adapter Supabase di `infrastructure/`. `src/backend/__tests__/db.integration.test.ts` menjalankan semuanya ke database sungguhan; jalankan dengan `NEARPAW_DB_TEST_URL` dan `NEARPAW_DB_TEST_KEY` (service key) milik project dev/staging, karena test menulis baris uji.

### Cakupan global

Pelaporan bisa dilakukan di mana saja; tidak perlu mendaftarkan region/negara. Region hanya override opsional (mis. masa expiry). Untuk membatasi hanya region aktif, nyalakan feature flag `restrictToRegions` (default mati). Expiry default: `safetyLimits.reportExpiryDays` (7).
