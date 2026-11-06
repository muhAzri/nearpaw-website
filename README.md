# NearPaw

NearPaw puts community reports of animals in need on a map. This repository holds everything that is not the iOS app:

- the **public website** (landing page, impact statements, help and legal pages, shared-report pages),
- the **admin console** (moderation, impact, regions, support), and
- the **backend API** (`/api/v1/*`), which the iOS app uses as well.

It is a single Next.js 16 (App Router) project. The three parts are separated by folder structure rather than by separate projects, following the layout of [Texium](https://github.com/muhAzri/Texium):

- **Frontend:** feature-driven architecture.
- **Backend:** domain-driven design with clean/hexagonal layering.
- **Data:** Supabase (Postgres and Auth) is the single source of truth. Photos live in Cloudflare R2 (any S3-compatible store works).

| URL | Content |
| --- | --- |
| `/` | Public website (feature `landing`) |
| `/impact`, `/impact/how-we-allocate`, `/impact/allocations/[id]` | Impact allocations (features `impact`, `content`) |
| `/help`, `/about`, `/privacy`, `/terms`, `/guidelines`, `/disclaimer` | Static and legal pages (feature `content`) |
| `/support`, `/privacy-requests` | Public forms (feature `support`) |
| `/r/[ref]` | Shared-report page (feature `shared-report`) |
| `/admin/login`, `/admin/*` | Admin console (feature `admin`) |
| `/api/v1/*` | Backend API, also used by the NearPaw iOS app |
| `/api/v1/docs`, `/api/v1/openapi.json` | Swagger UI and the OpenAPI document |

## Quick start

```bash
cp .env.example .env     # then fill in the values (see "Configuration")
npm install
npm run dev              # http://localhost:3000
```

| Script | Purpose |
| --- | --- |
| `dev` / `build` / `start` | Next.js |
| `lint` | ESLint, including the **architecture boundary rules** |
| `typecheck` | `next typegen && tsc --noEmit` |
| `test` / `test:watch` | Vitest (domain, application and API tests) |

The API refuses to start without Supabase configured; there is no in-memory fallback. Run every migration in `supabase/migrations` against your project first (see [Database](#database-supabase)).

## Project structure

```
src/
├── app/                       ROUTING ONLY (thin). No logic.
│   ├── (site)/                -> public website
│   ├── admin/**               -> admin console (layout + pages)
│   └── api/v1/**/route.ts     -> adapters to the backend controllers
│
├── contracts/                 Zod schemas, types and route paths.
│                              The only code shared between frontend and backend.
│
├── frontend/
│   ├── features/<feature>/    api/, components/, hooks/, lib/, index.ts (PUBLIC API)
│   │   ├── landing/           public home page
│   │   ├── impact/            public impact pages
│   │   ├── content/           help, about, legal pages, 404
│   │   ├── support/           support form and privacy-request form
│   │   ├── shared-report/     shared-report page
│   │   └── admin/             login, shell and every console screen
│   └── shared/                ui/, lib/ (api-client, site) used across features
│
└── backend/
    ├── modules/<module>/
    │   ├── domain/            Entities, value objects, repository PORTS, domain errors. Pure TypeScript
    │   ├── application/       Use cases and DTO mappers
    │   ├── infrastructure/    Adapters (Supabase, S3/R2, FCM, ...)
    │   ├── presentation/      HTTP controllers (Web Request/Response, not Next.js)
    │   ├── <module>.module.ts Composition root for the module (manual DI)
    │   └── index.ts           PUBLIC API of the module
    ├── composition.ts         The only place where modules meet (through ports)
    └── shared/                Domain errors, HTTP helpers, env, shared kernel
```

### Dependency rules

```
app/ ──> frontend/features ──> frontend/shared ──> contracts
  │
  └────> backend/modules/*/index ──> presentation ──> application ──> domain
                                     infrastructure ──────────────────┘ (implements ports)
```

`npm run lint` enforces these rules:

| Layer | Must not import |
| --- | --- |
| `contracts` | frontend, backend, `next`, `react` |
| `frontend/**` | `@/backend/**`; the internals of other features |
| `backend/**` | frontend, `app`, `next`, `react`; the internals of other modules |
| `backend/**/domain` | application, infrastructure, presentation, `zod`, contracts |
| `backend/**/application` | infrastructure, presentation |

The frontend talks to the backend only over HTTP (`/api/v1/*`, through `frontend/shared/lib/api-client`), so the backend can move to another service without touching the frontend.

### Adding a feature (example: `pets`)

1. Create the `pets` table with a new migration in `supabase/migrations`.
2. Add `src/contracts/pets.contract.ts` (schemas and routes) and export it from `contracts/index.ts`.
3. Add `src/backend/modules/pets/`: `domain` → `application` → `infrastructure` → `presentation` → `pets.module.ts` → `index.ts`.
4. Wire the module in `src/backend/composition.ts`.
5. Add `src/app/api/v1/pets/route.ts`, calling the controller. The `route()` helper in `api/v1/_lib` opts into request-time rendering (`connection()`) and maps errors to the JSON envelope.
6. Add `src/frontend/features/pets/` (`api/`, `components/`, `index.ts`).
7. Add `src/app/admin/pets/page.tsx` (or a public page) that renders from `@/frontend/features/pets`.

## Conventions

- **Response envelope:** `{ "data": ... }` on success, `{ "error": { "code", "message", "details" } }` on failure.
- **Public data fetching:** public pages call `/api/v1/*` inside `<Suspense>` (Cache Components). Static pages do not call the backend at build time.
- **Design tokens** (colours, fonts, radii) live in `src/app/globals.css`; base components in `src/frontend/shared/ui`.
- **Legal copy** lives in `src/frontend/features/content/lib/legal-copy.ts`, apart from the layout. Update the matching section and bump `LEGAL_META` whenever the app collects, stores or shares something new.
- **Admin sign-in:** `/admin/login` takes the email and password of a Supabase account whose `users.role` is `admin` (no MFA). The bearer token is kept in `sessionStorage` and expires after 8 hours; `/admin/*` redirects to the login page when there is no session or the API answers 401. There is no cookie or BFF layer yet.

## Configuration

Copy `.env.example` to `.env` for local work, and set the same variables in your hosting provider (Vercel) for deployments. The variables that matter:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Auth (sign-in). Required |
| `SUPABASE_SECRET_KEY` | Server-only. Bypasses RLS; how the API reads and writes every table. Required |
| `SUPABASE_JWT_SECRET` | Only for projects still on the legacy shared JWT secret |
| `ADMIN_EMAIL` | Optional bootstrap: this account gets the admin role when its profile is first created |
| `S3_*` | Photo storage (Cloudflare R2). See [Photo uploads](#photo-uploads-presigned-urls-cloudflare-r2--s3) |
| `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PROJECT_ID` | Push notifications. See [Push notifications](#push-notifications-firebase-cloud-messaging) |
| `CRON_SECRET` | Authorises the scheduled housekeeping job. See [Scheduled housekeeping](#scheduled-housekeeping-vercel-cron) |
| `NEXT_PUBLIC_SITE_URL`, `API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL` | Public origin and the base URLs the frontend uses to reach the API |
| `NEXT_PUBLIC_APP_STORE_URL` | Optional override of the App Store link (defaults to the app's listing) |

Never put the secret key in a `NEXT_PUBLIC_*` variable, commit it, or ship it to the app.

## Files served from `public/`

| File | Purpose |
| --- | --- |
| `.well-known/apple-app-site-association` | Universal links: opens the iOS app for `https://<site>/r/*`. Served as `application/json` through `headers()` in `next.config.ts`. Must answer 200 without redirects |
| `app-ads.txt` | Authorises Google AdMob to sell the app's ad inventory. Must be served from the root of the developer website domain listed in the App Store listing |

## Backend API (v1)

Modules live in `src/backend/modules` and are assembled in `src/backend/composition.ts`, the only place where modules meet, always through ports.

| Module | Responsibility |
| --- | --- |
| `identity` | Email and password accounts through Supabase Auth (sign-up, email verification, password reset), admin login (same Supabase account plus `users.role = 'admin'`, locked for 15 minutes after 5 failures), profile, blocks, account deletion (profile anonymised and the Supabase Auth account deleted), user moderation |
| `regions` | **Optional** regions (expiry and support overrides), feature flags, safety limits, ad placements globally or per region (locked placements cannot be enabled) |
| `reports` | Reports (live immediately, expire automatically, rate limited, contact details not allowed in text), community updates, flags with auto-hide, review/keep/duplicate/hide/remove, dashboard stats, photo retention |
| `impact` | Periods and allocations: draft → verified → published. Totals are per currency and never summed across currencies |
| `alerts` | Area, radius and animal settings, alert feed, device tokens, fan-out when a report is published |
| `support` | Public support messages and privacy requests (rate limit, honeypot) and the admin inbox (emails masked) |
| `media` | Presigned photo upload URLs (Cloudflare R2 / S3) and deletion of stored photos |
| `audit` | Append-only log with CSV export |
| `admin` | Dashboard aggregates |
| `housekeeping` | Scheduled cleanup endpoint (see below) |

**App endpoints:** `/api/v1/{auth/{register,sign-in,refresh,sign-out,forgot-password,resend-verification},config,regions,media/uploads,reports,reports/[ref],reports/[ref]/updates,reports/[ref]/block-reporter,public/reports/[ref],flags,me/**,impact/**,support,privacy-requests}`.

**Admin endpoints** (admin bearer token): `/api/v1/admin/**` (login, dashboard, reports, updates, flags, users, impact, regions, config, ad-placements, audit, support, privacy-requests).

**Auth:** `Authorization: Bearer <access token>`. The app signs in with email and password through Supabase Auth, which also sends the confirmation and password-reset emails. Session tokens are Supabase Auth JWTs; the backend does not issue tokens of its own.

### Sessions: Supabase Auth JWTs

Sign-in returns a Supabase **access token** (JWT, 1 hour) and Supabase's **refresh token**. The backend keeps no session state, so a restart or a move to another instance never ends a session.

- **Verification:** every request verifies the JWT (signature, issuer, audience, expiry) with `jose` against the project's JWKS (`/auth/v1/.well-known/jwks.json`). For a project still on the legacy JWT secret, set `SUPABASE_JWT_SECRET`.
- **Refresh:** `POST /api/v1/auth/refresh` with `{ refreshToken }` is forwarded to Supabase. Rotation, reuse detection and expiry are handled by Supabase; a rejected token becomes a 401. Refresh is limited to 30 calls per hour per token.
- **Sign-out:** `POST /api/v1/auth/sign-out` with the bearer access token ends the session in Supabase (always 204).
- **Profile:** created automatically the first time an account is seen (from the `sub` and `email` claims), so a missing profile row (for example after a table was emptied) never causes a valid token to be rejected.
- **Account status:** banned and deleted accounts are rejected immediately and cannot refresh. `restricted` accounts can still refresh because they may keep browsing.
- **Account deletion:** `DELETE /api/v1/me` anonymises the profile (email and name removed), deletes alert settings, device tokens and blocks, keeps or removes the user's live reports as chosen, and then deletes the account in Supabase Auth, so the same email can register again. If that last step fails, the deletion still succeeds for the user and the failure is recorded in the audit log as `account.auth_removal_failed` for manual follow-up.

### Photo uploads (presigned URLs, Cloudflare R2 / S3)

Image bytes **never pass through this server**.

1. The app downsizes the photo (max 1600 px, EXIF orientation applied, metadata and GPS removed) and compresses it to **WebP on the phone** (libwebp), so the server never processes images. It can also upload a small list thumbnail (`<id>_t.webp`) next to each photo.
2. `POST /api/v1/media/uploads` with `{ purpose: "report" | "update", files: [{ contentType: "image/webp", sizeBytes, thumbnailSizeBytes? }] }` (signed-in users, 20 requests per hour) returns `{ uploads: [{ key, uploadUrl, method: "PUT", headers, expiresAt, thumbnail? }] }`. Each URL is valid for 5 minutes and **signs** `Content-Type`, `Content-Length` (exact size) and `Cache-Control`, so the bucket rejects any other type or size. Up to 4 files per request, 2 MB per photo.
3. The app `PUT`s each file to its `uploadUrl` with exactly the headers returned (no `Authorization` header).
4. The app sends the `key` to `POST /reports` (`photos`). Keys look like `public/<purpose>/<userId>/<id>.webp`; the server rejects keys that belong to another user.

**R2 setup** (see `.env.example`):

- `S3_BUCKET`, `S3_REGION=auto`, `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com` (without the bucket name), `S3_FORCE_PATH_STYLE=true`.
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`: an R2 "Object Read & Write" token scoped to this bucket.
- To make photos publicly readable, enable the `r2.dev` subdomain (development) or connect a custom domain (production) on the bucket, then set `S3_PUBLIC_BASE_URL`. The value is sent to the app by `GET /api/v1/config` as `mediaBaseUrl`.
- Without `S3_BUCKET`, the upload endpoint answers 503 `SERVICE_UNAVAILABLE`.
- Presigned URLs only work on the `r2.cloudflarestorage.com` endpoint, not on a custom domain.

Photos of reports that are expired, closed or removed are deleted by the daily housekeeping job. Photos that were uploaded but never attached to a report are not swept by the job; as a safety net, add a bucket lifecycle rule that deletes objects under `public/` older than 90 days (safe, because a report lives at most 60 days).

### Scheduled housekeeping (Vercel Cron)

`vercel.json` schedules `GET /api/v1/cron/housekeeping` every day at 03:00 UTC (the Hobby plan allows one run per day). The endpoint answers 503 when `CRON_SECRET` is not set and 401 when the `Authorization: Bearer <CRON_SECRET>` header is wrong. Vercel sends that header automatically once `CRON_SECRET` is defined in the project's environment variables (generate one with `openssl rand -hex 32`).

Tasks run one after another. A failing task does not stop the others, and the response is 500 so the run shows as failed in the Cron logs.

| Task | What it does |
| --- | --- |
| `photos` | Deletes the photo files (and `_t.webp` thumbnails) of a report and its community updates when the report expired more than 3 days ago, was closed more than 3 days ago, or was removed, then clears the `photos` columns. Files are deleted first: if that fails, nothing is cleared and the next run retries. At most 1000 reports per run |
| `rate-limits` | Deletes `rate_limit_hits` rows older than one day (this also drops the IP addresses stored in support-form keys) |

Manual check:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/v1/cron/housekeeping
```

### Push notifications (Firebase Cloud Messaging)

The iOS app registers its **FCM token** with `POST /me/devices`. When a report is published, the backend sends a notification to each matching device through FCM HTTP v1, and FCM relays it to APNs. The text is neutral ("A new report was posted near <area>.") and `data.ref` lets a tap open the report. Tokens that FCM declares dead (`UNREGISTERED`) are deleted automatically. Temporary failures delete nothing, and a push failure never makes report creation fail.

Configuration:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: Firebase console > Project settings > Service accounts > Generate new private key (raw JSON or base64).
- `FIREBASE_PROJECT_ID`: optional.
- Without them, alerts still appear in the in-app feed, but no push is sent.

The Apple side is configured outside this code: enable the Push Notifications capability for the app's App ID and in Xcode, and upload an APNs auth key (`.p8`) in Firebase console > Project settings > Cloud Messaging.

### Database (Supabase)

The schema is split per module in `supabase/migrations/*.sql`. Files are ordered by timestamp and must not be edited after they have run; a change is a new file. Apply them with `supabase db push` or in the SQL editor. Row Level Security is enabled with no policies, so only the server (using the secret key) can access the tables. Each module's `domain/repositories.ts` has a Supabase adapter in `infrastructure/`.

`src/backend/__tests__/db.integration.test.ts` runs the repositories against a real database. Run it with `NEARPAW_DB_TEST_URL` and `NEARPAW_DB_TEST_KEY` (a service key) from a dev or staging project, because the tests write rows. In-memory test doubles exist only in `src/backend/__tests__/support/`; the API itself never keeps data in memory.

### Global coverage

Reports can be made anywhere; no region or country needs to be registered. A region is only an optional override (for example the expiry period). To limit reporting to active regions, turn on the `restrictToRegions` feature flag (off by default). The default expiry is `safetyLimits.reportExpiryDays` (7).

## Known gaps

- **Email:** the support module's `Mailer` is still `UnconfiguredMailer`, which reports every reply as "not delivered". Replies to support messages and privacy requests are stored but not emailed until an adapter (SMTP, Resend, Postmark, ...) implements the `Mailer` port. Authentication emails are sent by Supabase and are not affected.
- **CAPTCHA** on the public forms (`support`, `privacy-requests`): only a honeypot and rate limiting.
- **Orphaned uploads:** see the lifecycle-rule note under [Photo uploads](#photo-uploads-presigned-urls-cloudflare-r2--s3).
