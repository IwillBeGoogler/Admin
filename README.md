# Blog Admin (React)

Admin panel for the iBlog Medium-style blog. Talks to the Go monolith ([iblog-monolith-go](https://github.com/iBlog/iblog-monolith-go), `:8080`) through `/api`.

## Stack

TypeScript (strict) · React 19 + React Compiler · Vite 8 · TanStack Router (file-based) / Query v5 / Table v9 ·
Tailwind CSS v4 + shadcn-style components on Radix · lucide-react · sonner · React Hook Form + Zod v4 · Recharts ·
Vitest + Testing Library + MSW 3 · Playwright · Biome. Package manager: **bun**.

## Run

```sh
bun install
bun run dev            # http://localhost:5174, /api proxied to http://localhost:8080
```

Backend (in `iblog-monolith-go`): `docker compose up -d` — API on `:8080`, this panel on `:8082`.

Admin credentials come from the backend's seed env: `ADMIN_USERNAME` / `ADMIN_PASSWORD`
(defaults in `iblog-monolith-go/docker-compose.yml`: `admin` / `admin12345`; local runs read `iblog-monolith-go/.env`).

## Scripts

| command | what |
|---|---|
| `bun run test` | Vitest unit + integration (MSW) |
| `bun run coverage` | same, with v8 coverage of `domain/` and `shared/` |
| `bun run typecheck` | regenerate route tree, `tsc --noEmit` |
| `bun run lint` / `bun run format` | Biome check / fix |
| `bun run build` | routes → typecheck → production bundle in `dist/` |
| `bun run e2e` | Playwright against the real API (starts `bun run dev`) |
| `E2E_BASE_URL=http://localhost:8082 bun run e2e` | Playwright against the nginx image |
| `bun run gen:api` | regenerate `src/shared/api/openapi.d.ts` from an OpenAPI file: `bun run gen:api path/to/openapi.json` (or `OPENAPI_SPEC`) |

E2E notes: global setup logs in once via the API, then tests reuse that session. The backend allows 10 logins and
10 post creations per minute; to rerun the suite back to back start the API with `RATE_LIMIT_MULTIPLIER=20`
(dev only, production refuses it): `RATE_LIMIT_MULTIPLIER=20 docker compose up -d`.

## Architecture (DDD by bounded context)

```
src/
  app/                 router (routes/ = file routes), providers, layout, permission-based nav
  shared/              kernel: http client (Bearer, Accept-Language, RFC 9457, refresh-on-401), envelopes/Page<T>,
                       token store, i18n (uz/ru/en), UI kit, formatting
  contexts/
    identity/          login + 2FA, session, current admin, permissions (resource.action from Guard roles)
    analytics/         /admin/stats dashboard
    content/           posts (+ every author's drafts/scheduled), editor, revisions/restore, categories, labels, tags
    moderation/        reports (status filter, resolve/dismiss, remove_content, 409), comments
    community/         users (q search, cursor paging), ban/suspend, bans list, unban
    access/            Guard roles/permissions, sessions, audit log
```

Each context: `domain/` (Zod schemas + pure rules, no React/fetch) → `infrastructure/` (repositories; only place that
calls the API; responses parsed with Zod) → `application/` (query keys, query/mutation hooks, invalidation) → `ui/`.
Contexts import each other only through `index.ts`.

Auth: the bearer token lives in memory, mirrored to `sessionStorage` (tab-scoped). A `401` triggers one shared
`POST /api/auth/refresh` (the token rotates) and a single retry; if that fails the session is cleared and the user is
sent to `/login?expired=true`.

## Docker

`Dockerfile` builds with bun and serves `dist/` with nginx. `API_URL` (default `http://api:8080`) is the upstream for
`/api/`. nginx adds CSP (`script-src 'self'`), `nosniff`, `X-Frame-Options: DENY`, long-lived caching for hashed
`/assets/`, `no-cache` for the HTML shell, SPA fallback and `/healthz`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under [MIT](LICENSE).
