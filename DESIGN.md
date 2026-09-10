# GCO Partners — design system

The house style, summarised so future work stays consistent. The full spec lives
in the `gco-ui` skill (`.claude/skills/gco-ui/SKILL.md`) — read it before building
any UI. Tokens are the single source of truth: `src/styles/tokens.css` →
`tailwind.config.js` → semantic classes. **Never hardcode hex in components.**

## Principles

- A working tool for people who look at numbers all day — balanced density, not a
  sales page. Light theme only. WCAG 2.1 AA.
- Warm neutrals throughout. Never pure black text, never cool/blue grays, never a
  stark white page (the page is fog `#f2f2f2`, cards are white).
- Brand rhythm carried into product: **eyebrow → title → one-line description**,
  one primary action to the right.

## Color

| Role | Token / class | Value |
|---|---|---|
| Primary / brand | `accent-primary` | `#9c7804` (hover `#6f5a22`) |
| Secondary / links | `accent-secondary` | `#12898d` |
| Alert / destructive | `accent-alert` | `#c14904` |
| Page | `surface-page` | `#f2f2f2` |
| Card | `surface-card` | `#ffffff` |
| Cream (active nav, row hover) | `surface-cream` | `#f9f4e7` |
| Sunken (table headers) | `surface-sunken` | `#edecea` |
| Report / upload | `surface-report` | `#faf7f1` |
| Body text | `ink` | `#251c1a` |
| Secondary / tertiary | `ink-secondary` / `ink-tertiary` | `#5c5250` / `#6f6a62` |
| Borders | `border-subtle` / `border-default` | `#e0ddd9` / `#b6b3b2` |

### Fixed data semantics — never re-mapped per screen

| Meaning | Token | Rule |
|---|---|---|
| Favorable / on-track / healthy | `favorable` (teal) | + tint `favorable-tint` |
| Unfavorable / risk / overdue / failed | `unfavorable` (rust) | + tint `unfavorable-tint` |
| Watch / pending / needs review | `watch` (gold) | + tint `watch-tint` |
| Neutral / no data | `neutral` (warm gray) | + tint `neutral-tint` |

**Never color alone.** Every status carries a glyph + label (`StatusBadge`),
every variance carries a sign/arrow, every chart series is directly labelled.
Status→(tone,label) maps live in `src/components/ui/Badge.tsx` so semantics can't
drift. Roles and workflow stages use the **neutral** `Pill` — never the data
ramps.

## Type

- **Montserrat** (`font-heading`) — headings, buttons, KPIs, table column headers.
- **Open Sans** (`font-sans`) — body, labels, help, cells.
- **Poppins** (`font-numeric`) — dense numeric surfaces.
- Sentence case everywhere; UPPERCASE only for eyebrows / badges / column headers.
- All numbers: `tnum` (tabular numerals), right-aligned. Negatives in rust with a
  leading minus — never parentheses.
- Scale: page title 28/700, section 20/700, card 16/600, eyebrow 13/600 upper
  `0.14em`, body 15–16/400, KPI 32–40/700.

## Shape, shadow, motion

- Radius: `rounded-input` 8px, `rounded-card` 12px, `rounded-panel` 20px,
  `rounded-pill` for buttons/badges, circle for avatars.
- Shadows are warm-tinted only: `shadow-sm` cards, `shadow-md` popovers/drawers,
  `shadow-lg` modals. Warm scrim, never blur.
- Motion `cubic-bezier(.4,0,.2,1)`, 120ms hover/press, 200ms panels. Respect
  `prefers-reduced-motion`.
- **Not in this brand:** gradients, blur/frosted glass, emoji, outline icons,
  colored left-border strips, dark mode, drop shadows on charts.

## Components (`src/components`)

- **Button** — primary (one per view) / secondary / ghost / destructive; pill,
  Montserrat 600, verbs in sentence case; loading holds width.
- **Input** — label above, help below, validate-on-blur, rust error + glyph.
- **StatusBadge / Pill** — fixed semantics vs neutral labels.
- **Card, KpiCard, Banner, EmptyState, Skeleton** — surfaces & states.
- **Modal / Drawer / Toast / Popover** — overlays; toasts confirm only (never
  validation errors), 4px status bar on the left inner edge.
- **DataTable** — 44px rows, sunken sticky header, no zebra, cream hover, tabular
  right-aligned numbers, and the three required states: loading (skeleton), empty,
  error (retry). Distinguishes true-empty from filtered-empty.
- **Toolbar + FilterPills** — filter/sort/column controls above the table; active
  filters as removable pills; last-used filters persisted per table per context.

## App shell (`src/components/shell`)

- 240px sidebar (collapses to a 64px rail; off-canvas sheet under 768px), grouped
  by uppercase eyebrow labels, active item = cream fill + inner 2px gold indicator.
- 64px topbar: menu, page title, **first-class context switcher**, search,
  notifications, avatar menu. Switching tenants re-renders with a loading state —
  never silently.
- Content max-width 1440px, 32px desktop gutters.
- Impersonation: a persistent gold banner while GCO staff view a client org.

## Accessibility

- Body text ≥ 4.5:1; gold `#9c7804` is for large/bold text and UI edges only — use
  `ink` or `#6f5a22` for small text on light surfaces.
- Semantic HTML first; visible focus ring (2px teal, 2px offset) on everything
  focusable; full keyboard path; async results announced in polite live regions.
