# GCO Partners Platform

Client portal and diligence workspace for GCO Partners — a Next.js app for
accounting/finance clients (practice owners, office managers, firm partners),
with a broker-facing deal & diligence surface as a secondary role.

## Stack

- **Next.js (App Router) + TypeScript**
- **Tailwind CSS** — semantic token map wired to CSS variables (see `DESIGN.md`)
- **PostgreSQL via Prisma** — local Postgres for dev
- **Auth.js (NextAuth v5)** — email/password + OAuth, JWT session, roles
- **Stripe** — provider-hosted Checkout only (the app never touches card data)

## Security model (read before extending)

- **Tenant isolation.** Every tenant-scoped table carries `orgId`. Data access
  goes through `getTenantDb(orgId)` (`src/lib/tenant.ts`), a Prisma client
  extension that forces the tenant filter onto every read and write. Pages get
  their client from `requireTenantContext()` / `requirePermission()` — never
  import the raw `prisma` client for tenant data.
- **Permissions resolve before render.** Route guards in `src/lib/context.ts`
  redirect unauthorized users before a protected page renders — never
  render-then-error.
- **Append-only audit.** `recordAudit()` (`src/lib/audit.ts`) logs sensitive
  actions to `audit_log`. It only inserts; back it with a DB trigger/role that
  denies UPDATE/DELETE in production.
- **No sensitive capture.** Card entry happens in Stripe's hosted UI; system
  links use provider OAuth. We store only Stripe references and provider token
  references — never card/bank numbers or third-party credentials.

## Portable local environment (no admin required)

This machine has no admin rights, so Node and PostgreSQL run **portably from your
user folder** — no installer, no Windows service. They live in
`C:\Users\BradleySpies\devtools` (`node\`, `pgsql\`, and the `pgdata\` cluster).
Postgres listens on **port 5433**; `.env` already points at it.

**Every new terminal**, first put the portable tools on PATH:

```powershell
cd C:\Users\BradleySpies\.ms-ad
. .\scripts\dev-env.ps1     # node, npm, npx, psql, pg_ctl now work in this shell
```

**Start / stop the database:**

```powershell
.\scripts\db-start.ps1      # start Postgres (already initialized + seeded)
.\scripts\db-stop.ps1       # stop it
.\scripts\db-init.ps1       # one-time init + createdb (safe to re-run)
```

**Run the app:**

```powershell
npm run dev                 # http://localhost:3000
```

After a reboot: `. .\scripts\dev-env.ps1` → `.\scripts\db-start.ps1` → `npm run dev`.

The standard (admin/global-install) instructions below apply on any other machine.

## Prerequisites

- Node.js 18.18+ (20+ recommended)
- A local PostgreSQL 14+ server

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   → set DATABASE_URL, AUTH_SECRET (openssl rand -base64 32), and any provider
#     keys you want to exercise. Everything else can stay as a TODO placeholder
#     for now.

# 3. Create the schema and generate the client
npm run db:push
npm run db:generate

# 4. Seed fake local data
npm run db:seed

# 5. Run the app
npm run dev
# → http://localhost:3000
```

## Running local PostgreSQL

Any local Postgres works. Two quick options:

**Docker**

```bash
docker run --name gco-postgres -e POSTGRES_USER=gco -e POSTGRES_PASSWORD=gco \
  -e POSTGRES_DB=gco_platform -p 5432:5432 -d postgres:16
```

**Native (macOS via Homebrew)**

```bash
brew install postgresql@16
brew services start postgresql@16
createdb gco_platform
```

Then set in `.env`:

```
DATABASE_URL="postgresql://gco:gco@localhost:5432/gco_platform?schema=public"
```

## Demo accounts (after seeding)

All use password **`password123`**:

| Email | Role | Notes |
|---|---|---|
| `owner@northsidedental.com` | client | Northside Dental |
| `manager@lakeview.com` | client | Lakeview |
| `accountant@firm.com` | accountant | serves both practices (context switcher) |
| `broker@meridian.com` | broker | Meridian deals |
| `staff@gcopartners.com` | GCO staff | all orgs; shows the impersonation banner |

## Required secrets

Set real values in `.env` before exercising these paths (all are TODO
placeholders in `.env.example`):

- `DATABASE_URL`, `AUTH_SECRET` — required to boot.
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google sign-in.
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` — payments.
  - Local webhooks: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- `QBO_*`, `XERO_*`, `PLAID_*` — accounting/bank links (OAuth start + callback are stubbed).
- `STORAGE_*` — document object store (presigned upload/download is a TODO).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Push the Prisma schema to the DB |
| `npm run db:migrate` | Create a migration |
| `npm run db:seed` | Seed fake dev data |
| `npm run db:studio` | Open Prisma Studio |

## Project structure

```
prisma/            schema.prisma, seed.ts
src/
  app/
    (auth)/        login, reset  (fog page, centered card)
    (app)/         protected shell + dashboard, invoices, connections,
                   messages, documents, deals, settings
    onboarding/    invite wizard (no membership required)
    api/           auth, stripe/webhook, connections/[provider]/[action]
  actions/         server actions (context, payments, messages, documents)
  components/
    ui/            Button, Input, Badge, Card, Modal, Drawer, Toast, …
    shell/         Sidebar, Topbar, ContextSwitcher, PageHeader, AppShell
    table/         DataTable, Popover, FilterPills
    features/      per-module client views
  lib/             prisma, auth, tenant, context, rbac, audit, stripe, utils
  styles/          tokens.css (design tokens)
```

## Known TODOs

- Wire real OAuth start/callback for QuickBooks, Xero, Plaid.
- Presigned document upload/download against object storage.
- XLSX export (CSV works today).
- Email provider for magic-link + password reset.
- Optional: Auth.js middleware for edge route protection (guards currently run in
  server layouts).

## Attribution

🤖 Generated with [Claude Code](https://claude.com/claude-code)
