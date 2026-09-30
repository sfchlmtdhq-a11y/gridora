# Gridora

Gridora is a real-data creative connections platform for designers and clients with persistent Clerk authentication, profiles, connections, private messaging, projects, and protected admin totals.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/gridora` — React/Vite product UI, Clerk sign-in/sign-up routes, responsive app shell, empty states, and all user-facing flows.
- `artifacts/api-server/src/routes/gridora.ts` — authenticated API handlers for profiles, connections, messages, feed, projects, notifications, and admin summary.
- `artifacts/api-server/src/middlewares/auth.ts` — Clerk session checks and first-use local profile bridge.
- `lib/db/src/schema/gridora.ts` — PostgreSQL schema for all Gridora entities.
- `lib/api-spec/openapi.yaml` — source-of-truth API contract; generated hooks live in `lib/api-client-react`.
- `artifacts/gridora/src/index.css` — Gridora visual tokens and responsive fixed-navigation shell styles.

## Architecture decisions

- Clerk owns browser authentication and Google SSO; the API trusts Clerk session cookies and never accepts client-supplied user IDs for ownership.
- A local Gridora user row is created on the first authenticated API request from the actual Clerk profile; no seed/demo rows are inserted.
- Messages are only readable or writable between accepted connection pairs; sender ownership is checked server-side for edit/delete.
- Admin access is role-based in PostgreSQL. Server-only `ADMIN_CLERK_USER_IDS` or verified-primary-email `ADMIN_CLERK_EMAILS` values can bootstrap admins; never authorize from frontend data.
- Gridora stores the user’s display email separately from a canonical identity key that treats Gmail/Googlemail dot and plus aliases as the same identity. Phone contacts are stored only when Clerk verifies them, normalized to E.164, and unique; phone sign-in is not enabled by managed Clerk.
- All user activity and admin totals come from PostgreSQL. Landing-page feature copy must not resemble live users, posts, counts, or activity.
- Replit-managed Clerk enforces CAPTCHA and bot protection outside the application; do not try to disable or bypass it in frontend code.
- The mobile shell keeps the header and bottom navigation fixed while adding body padding so content remains reachable.

## Product

Gridora opens publicly with a branded landing page. Signed-in users get a real feed, people discovery, connection requests, accepted-connection-only conversations, profile editing, project requests, notifications, and a server-authorized admin metrics view. Every list renders a meaningful empty state when no rows exist.

## User preferences

- Keep the initial experience completely empty and never add fake users, activity, or statistics.
- Preserve the dark, violet-accented, mobile-first visual direction from the provided Gridora references.

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after every OpenAPI change before typechecking client or server consumers.
- Use Clerk browser cookies for web API calls; do not add bearer-token handling to the React app.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
