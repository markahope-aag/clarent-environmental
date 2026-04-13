# clarent-app

Application for Clarent Environmental — generator, vendor, and ops portals.

Turborepo monorepo. Next.js 14 App Router with subdomain routing via `middleware.ts`:

- `app.clarentenvironmental.com` — generator portal
- `vendors.clarentenvironmental.com` — vendor portal
- `ops.clarentenvironmental.com` — ops console

Stack: Supabase (Postgres) + Drizzle, Clerk auth, Stripe Connect, Upstash Redis, Resend, Anthropic API, n8n workflow orchestration.

See the full project plan at `../../workspace/notes/clarent-environmental-plan.md` (Phases 1, 3–10 cover this repo).
