# Clarent Environmental

Hazardous waste broker/platform for Small Quantity Generators (SQGs).

## Repo layout

```
clarent-environmental/
├── clarent-web/    Marketing website — clarentenvironmental.com (Next.js + Sanity CMS)
└── clarent-app/    Application — generator, vendor, ops portals (Next.js + Supabase)
```

`clarent-app` uses subdomain routing via `middleware.ts`:

- `app.clarentenvironmental.com` — generator portal
- `vendors.clarentenvironmental.com` — vendor portal
- `ops.clarentenvironmental.com` — ops console

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind · Supabase (Postgres) · Drizzle · Clerk · Stripe Connect · Upstash Redis · Resend · Anthropic API · n8n (Hetzner/Coolify) · Vercel · Cloudflare

## Plan

Full 10-phase build plan lives in the workspace notes: `workspace/notes/clarent-environmental-plan.md`.

Target: first real job end-to-end by end of Phase 5 (week 18).
