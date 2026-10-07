# Build prompt: GCO Service Desk (internal section of the GCO platform)

Paste everything below this line into Claude Code at the root of the GCO platform repo. Put the two companion files (`gco-desk-reference.html` and `gco-desk-seed.json`) in the repo first, for example under `docs/service-desk/`.

---

## Your task

Add a new, internal-only section to the GCO platform called **GCO Service Desk**. It is the operating system for GCO Partners' managed accounting and QofE Lite service lines, used by GCO employees (accountants, controllers, management). It replaces a Notion workspace.

A working reference implementation exists as a single HTML file at `docs/service-desk/gco-desk-reference.html`. Treat it as the functional spec for boards, fields, views, computed values, rules and the dashboard. Do **not** copy its styling: the section must be built in this repo's stack and carry GCO branding (see "Branding and UI"). The current live data is in `docs/service-desk/gco-desk-seed.json`.

### Before you write any code

1. **Invoke the UX/UI skill installed in this project** with the Skill tool, and follow it for every screen, component and style decision in this task. If you are unsure of its exact name, list the available skills and use the UX/UI one. Load it again if your context is compacted.
2. Read the repo: framework, routing, ORM / database, existing auth (if any), component library, design tokens, logo assets, test setup, deployment. Reuse what exists. Do not introduce a second framework, ORM or styling system.
3. Read `gco-desk-reference.html` end to end (the `BOARDS` schema object, `attention()`, `renderHome()`, `liveBits()` and the change handlers hold the business rules).
4. Write a short plan (data model, routes, auth flow, migrations, what you will reuse) and show it to me before building.

---

## 1. Access: invite-only, email + password

This section is for GCO employees only and must be completely separate from any client-facing parts of the platform.

- **Route group:** everything lives under `/desk` (or the repo's equivalent route group), with its own layout and navigation. No desk page, API route or data is reachable without a desk session.
- **Owner:** one owner account, set from an environment variable `DESK_OWNER_EMAIL` (I will set it to my work email). The owner account is created by a seed / CLI command, and on first login the owner must set a password like everyone else.
- **Only the owner can invite.** The owner has a "Team" admin screen to:
  - invite a person by email, choosing a role (`accountant`, `controller`, `management`),
  - see pending invites (resend, revoke) and active users (change role, deactivate).
  - No other role can see this screen or call its endpoints. Enforce this on the server, not just by hiding UI.
- **Invite flow:** an invite sends an email with a single-use, signed token link that expires after 72 hours. Opening it lands on "Set your password". The account is only created when the person sets a password. Expired, revoked or used tokens show a clear message and nothing else.
- **Login:** email + password only. No public sign-up page anywhere.
- **Passwords:** minimum 12 characters, checked against a common/breached password list, hashed with argon2id (or bcrypt cost 12+ if argon2 is not available in the stack). Never log or return a password or token.
- **Password reset:** "Forgot password" sends a single-use link (1 hour expiry) only if the email belongs to an active user; the response is identical either way.
- **Sessions:** httpOnly, Secure, SameSite=Lax cookies; rotate the session on login and password change; 12-hour idle timeout; logout everywhere when a user is deactivated or changes their password.
- **Protection:** rate-limit login, reset and invite-accept endpoints; CSRF protection on all mutating requests if the stack does not already provide it.
- **Audit log:** record logins, failed logins, invites (sent, accepted, revoked), role changes, deactivations, and every create / update / delete on desk records (who, when, which record, which fields changed). The owner can view it.
- **Roles and permissions:**
  - `owner`: everything, including Team and Audit log.
  - `management`: read and write everything on the desk, including P&L.
  - `controller`: read and write all boards; read-only on P&L.
  - `accountant`: read and write Onboarding, Clients, Engagements, Monthly Cycles, Queries & Blockers, Deliverables and the QofE pipeline; no access to P&L, and the dashboard's Commercial section is hidden.
  - Enforce every rule on the server.

If the platform already has an auth system, extend it for this rather than building a parallel one, but keep desk users and permissions isolated from client users.

---

## 2. Data model

Build these as real tables with foreign keys (not a generic JSON store). Field names, option lists and colours are in the `BOARDS` object in the reference file; reproduce every field and every select option exactly, in the same order.

| Board | Purpose | Key relations |
|---|---|---|
| Client Onboarding (intake) | The client's own answers about how their business works | linked from Clients |
| Clients | The relationship / entity of record | has many Engagements; optional link to one intake |
| Engagements | The contract: scope, SLAs, fees, exclusions | belongs to Client; has many Monthly Cycles |
| Monthly Cycles | One record per engagement per month, 8 stages | belongs to Engagement; has many Queries and Deliverables |
| Queries & Blockers | Exceptions and SLA clock pauses | belongs to Cycle |
| Deliverables | Output archive with QC sign-off | belongs to Cycle |
| QofE Lite Deals | Per-engagement QoE pipeline | standalone |
| Dental P&L | Revenue, cost and margin per engagement per period | standalone for now |

Notes:
- "Person" fields (Financial Controller, Bookkeeper, Owner, Reviewer, QC Sign-off) become foreign keys to desk users.
- File fields (signed LOE, deliverable file) store an uploaded file using the platform's existing file storage. Keep a URL field as a fallback.
- Every record has `created_at`, `created_by`, `updated_at`, `updated_by`.
- Write a seed / import script that loads `gco-desk-seed.json`. Map person names in the seed ("Hillary Kembo", "Brad Spies") to users by email when they exist, otherwise leave the field empty and report which ones need assigning.

### Computed values (calculate server-side, never store)

- **Cycle: Open Blockers** = count of its queries with status not "Resolved".
- **P&L: Gross Margin** = Revenue minus Delivery Cost, Commission and Other Costs. **Margin %** = Gross Margin / Revenue.
- **Query: Age** = business days from Raised On to today while unresolved.
- **Deal: Rack rate and draft clock** by location count: 1 = $1,000 / 3 BD; 2 to 4 = $1,500 / 5 BD; 5 to 7 = $2,000 / 7 BD; 8 to 10 = $2,500 / 10 BD; over 10 = $2,500 + $150 per extra location / 10 BD + 1 per extra location.
- **Deal: Draft clock used** = business days from "Data received at" to "LqE finalized at" (or today if not finalized).
- Business days exclude Saturdays and Sundays. Put this in one shared, unit-tested helper.

### Automatic rules (from the reference file)

- Setting a query's status to Resolved fills Resolved On with today if empty.
- Setting a deal's stage to "Data received" fills Data received at; "LqE finalized" fills LqE finalized at (only if empty).
- Warnings shown on the record (not blocking, but visible):
  - Cycle whose client's Systems Access is not "Full access live".
  - Cycle set to Closed with no deliverable filed.
  - Cycle at Delivered or later without all three review checkboxes ticked.
  - Cycle with an SLA due date: show business days remaining or overdue.
  - Managed Bookkeeping engagement with no SLA terms (standard is 5 / 5 / 1).
  - Deliverable with no QC sign-off.
  - Deal with Data posture = PHI: BAA and de-identification reminder.
  - Deal billed below rack rate for its location count.

---

## 3. Screens

Navigation (left rail on desktop, collapsible on mobile), in the order work flows:

- **Desk:** Overview (dashboard), How the desk runs
- **Managed Accounting:** 1 Onboarding, 2 Clients, 3 Engagements, 4 Monthly Cycles, 5 Queries & Blockers, 6 Deliverables
- **QofE Lite:** Deal Pipeline
- **Commercials:** Dental P&L (hidden for accountants)
- **Owner only:** Team, Audit log

Every board page has: title and one-line purpose, saved view tabs, search, a "New" button, and either a table or a kanban board. Kanban cards drag between columns to change the grouped field (with keyboard / menu alternative). Clicking any row or card opens a record side panel with every field editable inline, relations as searchable pickers with "open" links, linked child records listed with an "Add" button, the warnings above, and delete with an in-page confirmation step.

Views to build (match the reference file):
- Onboarding: Submissions (table). Also a **public onboarding form** that a prospect can fill in from a link the desk generates per prospect (single-use or per-client token). Submissions land in the intake table. This is the only desk-related page reachable without login, and it must not expose any other data.
- Clients: All clients (table), By status (board).
- Engagements: All (table), By service (board).
- Monthly Cycles: Production Board (board by Stage, with red / amber stripe for breached or at-risk), SLA Watch (table, SLA status not Met, sorted by due date), All cycles.
- Queries & Blockers: Open Items (not resolved, oldest first), By status (board), All.
- Deliverables: Archive (table), By type (board).
- QofE Lite Deals: Pipeline (board by Stage, empty stages hidden), All deals, Payments (board by Payment Status).
- Dental P&L: All rows (table with totals row for money columns and overall Margin %), By service (board).

"How the desk runs" is a static reference page: the two service lines and pricing, the monthly rhythm, the clock rule, the cycle stages, the QofE fee and turnaround table, "Add it / Leave it / Normalize it", the PHI rule, and links to the Notion library pages (copy the URLs from the reference file).

---

## 4. The Overview dashboard

This is the most important screen. It serves both the delivery team and management. Build it exactly as specified in `renderHome()` and `attention()` in the reference file, with an audience switch at the top: **Everything / Delivery / Commercial** (remember the user's choice; accountants only get Delivery).

**KPI strip**
- Commercial: Recurring revenue live per month (+ annual run-rate, + contracted but not yet started); Booked this month; Gross margin % on costed rows only (and how many rows lack a delivery cost); QoE fees awaiting payment (+ deals in flight and their value).
- Delivery: Cycles in production (+ live managed engagements with no open cycle); SLA due in the next 10 business days (+ overdue); Open queries & blockers (+ how many pause an SLA clock); Delivered on SLA date % (cycles with both dates).
- Tiles needing attention get a warning border.

**Needs attention** (both audiences): one ranked list, most severe first, each item clickable to its record. Rules: cycles breached / at risk / past due; unresolved queries (red when past the 1 business day response); clients with a signed letter but systems access not live; active managed engagements with no SLA terms; active managed engagements with no cycle opened; finalized deals not yet paid; deals whose draft clock has passed its target.

**Delivery section**
- Production line: count of cycles in each of the 8 stages, each stage clickable.
- SLA clock: open cycles due within 10 business days, with a badge (late / due today / N BD).
- Query ageing: buckets Today, 1 to 2 BD, 3 to 5 BD, over 5 BD, plus open queries by type.
- Workload by person: open QoE builds, QoE reviews, active cycles (via engagement bookkeeper / controller) and open queries per user.
- Client readiness table: status, letter signed, systems access, bank feed, onboarding, monthly fee, open blockers, with green / amber / red status dots plus text labels.

**Commercial section**
- Revenue booked by month: stacked columns, Recurring vs One-off, continuous months (show empty months as $0), with tooltips and a legend.
- Margin by engagement: horizontal bars sorted lowest first, under 40% highlighted, uncosted rows labelled "no cost".
- Revenue mix by service.
- QofE Lite pipeline: deals and fees by phase (Intro & LoE, Data & analysis, Review & feedback, Finalized), plus turnaround vs target for deals with both dates.
- Concentration: share of QoE fees by referral source, and share of monthly client fees by client.

Chart rules: one axis per chart, never colour alone (always a label or legend), status colours (good / warning / critical) kept separate from series colours, tooltips on every mark, readable in light and dark themes, and a table fallback for screen readers.

---

## 5. Branding and UI

- GCO branded throughout: use the platform's existing logo, brand colours, typography and design tokens. If the repo has no tokens yet, create them in one place and ask me to confirm the brand palette before styling screens.
- Header shows the GCO logo and "Service Desk", the signed-in user's name and role, and sign out.
- Login, set-password, reset and invite emails all carry GCO branding and plain, friendly copy.
- Follow the UX/UI skill for layout, spacing, states (loading, empty, error), accessibility (keyboard, focus states, contrast, reduced motion) and responsive behaviour down to phone width.
- Copy rules: plain language, active voice, buttons say exactly what they do, errors say what went wrong and how to fix it. No em dashes in any UI copy.

---

## 6. Quality bar

- Tests: business-day helper, rack rate, margin, every attention rule, every auto-fill rule, and permission checks for each role on every API route (including "accountant cannot read P&L" and "only owner can invite").
- An end-to-end test of: owner invites user, user sets password, user logs in, user creates a client, engagement and cycle, logs a blocker, and the dashboard reflects it.
- Migrations are reversible. Seed script is idempotent.
- No secrets in code. Document every new environment variable (`DESK_OWNER_EMAIL`, email provider keys, token secrets) in the README.
- When done, give me: what was built, how to run the seed and create the owner account, the env vars to set, anything you could not do, and decisions you made that I should confirm.
