# NearPaw

Satu project Next.js 16 (App Router) untuk **website publik**, **admin website**, dan **backend API** NearPaw. Dipisah lewat struktur folder (bukan project terpisah), mengikuti [Texium](https://github.com/muhAzri/Texium):

- **Frontend**: Feature-Driven Architecture
- **Backend**: Domain-Driven Design + Clean/Hexagonal layering
- **Database**: belum ada (akan memakai Supabase). Akses data nanti ditaruh di `infrastructure/` tiap module, di balik Repository port di `domain/`

| URL | Isi |
| --- | --- |
| `/` | Website publik (feature `landing`) |
| `/admin` | Admin website (feature `admin`) |
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
│   │   ├── landing/           website publik
│   │   ├── admin/             shell + dashboard admin
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
- Auth belum dibuat; contoh implementasi ada di Texium (`backend/modules/auth`). `/admin` belum diproteksi.
