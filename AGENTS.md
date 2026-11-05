<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project architecture

Read `README.md` (Struktur / Arah dependency) before adding code. Rules enforced by `npm run lint`:
- `src/app` is routing only: `/` public website, `/admin/*` admin website, `/api/v1/*` backend. Pages render `@/frontend/features/<name>`; API routes delegate to `@/backend/modules/<name>`.
- Frontend never imports backend; it calls `/api/v1/*` via `frontend/shared/lib/api-client` using `@/contracts` schemas.
- Backend is framework-agnostic (no `next`/`react` imports); domain has no deps, application depends on ports only.
- No database layer yet (Supabase planned). Data access belongs in a module's `infrastructure/`, behind a `domain` repository port.
