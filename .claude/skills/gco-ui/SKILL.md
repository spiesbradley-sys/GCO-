---
name: gco-ui
description: GCO Partners' brand and product UI/UX house style for the front-end platform (client portal for accounting firms and practice owners; broker-facing deal & diligence tracker). Load whenever building, editing, or reviewing any user-facing React component, screen, or Tailwind styling — new features, layout, navigation, forms, tables, charts, modals, toasts, uploads, auth flows, permissions UI. Also load for design review ("does this match our brand?"), copywriting in the UI, and accessibility checks. Read the whole file before writing UI.
---

# GCO Partners — brand + product UI/UX

Gold City Offshoring Incorporated, trading as **GCO Partners**. Outsourced accounting service desk for accounting firms and dental/medical practices: bookkeeping, month-end close, management reporting, QofE Lite diligence, plus RCM and patient billing add-ons. Tagline on the mark: *Collaboration that powers growth.*

Stack: React + Tailwind. Light theme only. Balanced density.

Every value in this file is the brand's actual token, taken from the GCO Partners design system (`tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`), which was reverse-engineered from the QofE Lite deck, the Service Desk one-pager, the Onboarding deck, the Logic Dental CFO dashboard and the Panther Creek QoE report. Use the token, not a hex you liked better.

**Section 1–4 is the brand guideline itself and is not negotiable. Sections 5–17 apply it to product surfaces; deviate there when a screen needs it and say why.**

---

## 1. Brand foundations

### 1.1 What the brand feels like

Warm, non-corporate, slightly clinical. A professional-services firm talking to other professionals — brokers, practice owners, firm partners. Credible, never playful, never hyped. Nothing in the source material is glossy: no gradients, no glass, no photography as decoration, no motion.

### 1.2 Logo

The real mark — interlocking circles in olive/gold with a small rust centre circle, Open-Sans-like wordmark, tagline "Collaboration that powers growth" — lives in the design system at `assets/logo/gco-partners-logo.png` (and `-alt`). Use it as supplied.

- Never recolor, re-letter, outline, add effects to, or rebuild the mark.
- Clear space all round = the height of the mark's centre circle.
- App shell uses the horizontal lockup; favicon and collapsed sidebar use the mark alone.
- Minimum 24px mark height on screen.

### 1.3 Color — three brand ramps, every neutral warm

Full ramps, exactly as tokenised. Use the CSS variable names.

**Gold / olive — the core brand ramp** (from the logo mark; eyebrows, primary actions, highlight):
`--gco-gold-900 #6f5a22` · `-800 #8c6f2e` · `-700 #9c7d33` · `-600 #9c7804` (core) · `-500 #c0a24a` · `-400 #c9a769` · `-300 #e9d391` · `-100 #f3ecd9`

**Teal — analysis, favorable, secondary accent:**
`--gco-teal-900 #0f6b6e` · `-700 #12898d` · `-600 #008b8b` · `-400 #52b0b3` · `-100 #e1efee`

**Rust / brick — risk, unfavorable, urgency:**
`--gco-rust-800 #a34518` · `-700 #c0531d` · `-600 #c14904` · `-500 #c1502e` · `-400 #f25c05` · `-100 #f7e6db`

**Warm neutrals — every surface, border and text tone:**
`--gco-ink-900 #251c1a` · `--gco-ink-950 #2e2b27` · `--gco-ink-800 #3b3833` · `--gco-maroon-800 #583e3e` · `--gco-warm-600 #6f6a62` · `--gco-warm-400 #b7aea1` · `--gco-stone-400 #b6b3b2` · `--gco-warm-300 #c9c1b2` · `--gco-sand-200 #e0ddd9` · `--gco-sand-250 #e4dfcf` · `--gco-sand-300 #e6e0d4` · `--gco-paper-100 #efebe2` · `--gco-paper-150 #f0ebdf` · `--gco-cream-50 #f9f4e7` · `--gco-paper-50 #faf7f1` · `--gco-fog-100 #f2f2f2` · `--gco-fog-50 #fafaf9` · `--gco-sand-100 #edecea` · `--gco-white #ffffff`

**Semantic aliases — build the UI against these, not the raw ramps:**

| Token | Resolves to | Use |
|---|---|---|
| `--surface-page` | fog `#f2f2f2` | app background |
| `--surface-card` | white | cards, panels, tables |
| `--surface-cream` | `#f9f4e7` | highlight blocks, active nav, row hover |
| `--surface-sunken` | `#edecea` | table headers, wells, ghost hover |
| `--surface-report` / `-panel` / `-tint` | `#faf7f1` / `#f0ebdf` / `#efebe2` | report + dashboard surfaces |
| `--surface-inverse` | ink `#251c1a` | inverse panels, highlighted tier column |
| `--text-primary` | `#251c1a` | body and headings |
| `--text-secondary` | `#5c5250` | supporting copy |
| `--text-tertiary` | `#6f6a62` | captions, eyebrows, axis labels |
| `--text-muted` | `#b6b3b2` | placeholder, disabled |
| `--accent-primary` / `-hover` | `#9c7804` / `#6f5a22` | primary action (darkens on hover) |
| `--accent-secondary` | `#12898d` | secondary accent, focus ring |
| `--accent-alert` / `-hover` | `#c14904` / `#a34518` | destructive |
| `--border-subtle` / `-default` / `--border-report` | `#e0ddd9` / `#b6b3b2` / `#e6e0d4` | hairlines / stronger / report |
| `--link-color` / `-hover` | teal `#12898d` / gold `#6f5a22` | links |

**Data & variance semantics — fixed meanings, never re-mapped per screen:**

| Meaning | Text token | Tint |
|---|---|---|
| Favorable / on-track / healthy | `--data-favorable` teal `#12898d` | `--data-favorable-bg #e1efee` |
| Unfavorable / risk / overdue | `--data-unfavorable` rust `#c0531d` | `--data-unfavorable-bg #f7e6db` |
| Watch / pending / needs review | `--data-highlight` gold `#9c7d33` | `--data-highlight-bg #f3ecd9` |
| Neutral / no data | `--data-neutral` warm `#6f6a62` | — |

Status aliases: `--status-strong` (teal), `--status-watch` (gold), `--status-risk` (rust).

Gold is both the brand color and the "watch" status. Where the two would sit side by side, keep chrome in ink or teal so the reading stays unambiguous.

Hard rules: no pure black text, no cool or blue-tinted grays, no stark white page background (page is fog, cards are white), no color outside these ramps.

### 1.4 Type

| Token | Family | Use |
|---|---|---|
| `--font-display` | **Montserrat** 500–900 | headings, eyebrows, buttons, badges, table headers, KPI figures |
| `--font-body` | **Open Sans** 400/600/700 | all body copy, labels, help text, cell text |
| `--font-data` | **Poppins** 400–600 | dense numeric/tabular surfaces — dashboards, financial tables |

No serif anywhere. Pick one of Montserrat or Poppins for figures within a given screen; don't mix them in one table.

Brand scale (collateral): `--text-display-xl` clamp(2.75rem,4vw,4rem) · `-lg` clamp(2.25rem,3vw,3rem) · `-md` 2rem · `-sm` 1.5rem · `--text-heading` 1.25rem · `--text-body-lg` 1.125rem · `--text-body` 1rem · `--text-body-sm` 0.9375rem · `--text-caption` / `--text-eyebrow` 0.8125rem.
Leading: `--leading-tight` 1.1 · `-snug` 1.3 · `-normal` 1.5 · `-relaxed` 1.65. Tracking: `--tracking-eyebrow` 0.14em · `--tracking-wide` 0.04em.

Product screens use the smaller end of that scale — see §5.

Casing: sentence case everywhere, including headings and buttons. UPPERCASE only for eyebrows, badges and table column headers. Collateral headlines end in a period; product headings do not.

### 1.5 Spacing, radius, shadow, motion

Spacing (4px base, matches Tailwind): 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96.

Radius: `--radius-sm 8px` inputs and small controls · `--radius-md 12px` cards · `--radius-lg 20px` large feature panels · `--radius-pill 999px` buttons, badges, chips · `--radius-circle 50%` avatars, icon tiles, step markers.

Shadow — warm-tinted only, `rgba(37,28,26,·)`: `--shadow-sm 0 1px 2px /.06` resting cards · `--shadow-md 0 8px 24px /.08` popovers, drawers, tooltips · `--shadow-lg 0 16px 48px /.12` modals. Never a cool gray shadow, never a glow, never a shadow on a chart element.

Motion: `--ease-standard cubic-bezier(.4,0,.2,1)`, `--duration-fast 120ms` hover/press, `--duration-normal 200ms` panels and disclosure. The source decks have no motion at all — transitions are functional only. No entrance animations, no scale-on-press, no parallax, no skeleton shimmer.

### 1.6 Iconography

- Flat, single-color glyph on a solid brand-colored shape: white glyph on an olive circle, rust glyph on a fog-gray rounded triangle for warnings. Real assets: `assets/icons/icon-search.png`, `icon-warning.png`.
- Where a new icon is needed, take it from **Phosphor "fill"** or **Heroicons "solid"** and recolor it to a brand token. Never ship an outline-only icon, a multi-color icon, an emoji, or a Unicode symbol used as an icon.
- Large outline glyphs rendered in the page's own background tint may be used as near-invisible corner texture. Texture only — never information.

### 1.7 Imagery

Warm-toned, natural-light office/desk photography (`assets/photos/photo-office-01.jpeg`, `-02`), used only on relationship moments: onboarding, kickoff, empty first-run, marketing shell. Never as decoration behind data, never as a full-bleed hero on an app screen. Treat stock as placeholder for real client/team photography.

### 1.8 Voice

Direct, plain-spoken, consultative. Name the pain, then the fix. Second person for the user ("your practice", "your close"), first-person-plural for GCO ("We design your chart of accounts"). Financial terms — EBITDA, add-back, AR aging, RCM, QofE — used precisely and sparingly; unglossed on analyst and broker surfaces, tooltip-glossed on practice-owner surfaces.

Structural rhythm, repeated on nearly every section of every deck and carried into the product: **eyebrow label → short bold headline → one supporting sentence.** Lists are 3–4 short noun phrases, never paragraphs.

No emoji. No exclamation points. No growth-hacker language.

### 1.9 Never, in any GCO interface

Gradients · frosted glass / backdrop blur · colored left-border accent strips on cards · drop shadows on chart elements · dark mode · zebra striping · emoji · outline-only icons · pure black or cool gray · decorative animation · stock-photo backgrounds behind data.

---

## 2. Tailwind setup

Load the token CSS first, then map it. Everything downstream references semantic names, never hex.

```js
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        gold:  { 900:'#6f5a22',800:'#8c6f2e',700:'#9c7d33',600:'#9c7804',500:'#c0a24a',400:'#c9a769',300:'#e9d391',100:'#f3ecd9' },
        teal:  { 900:'#0f6b6e',700:'#12898d',600:'#008b8b',400:'#52b0b3',100:'#e1efee' },
        rust:  { 800:'#a34518',700:'#c0531d',600:'#c14904',500:'#c1502e',400:'#f25c05',100:'#f7e6db' },
        ink:   { DEFAULT:'#251c1a', 800:'#3b3833', 950:'#2e2b27' },
        warm:  { 600:'#6f6a62',400:'#b7aea1',300:'#c9c1b2' },
        stone: { 400:'#b6b3b2' },
        sand:  { 100:'#edecea',200:'#e0ddd9',250:'#e4dfcf',300:'#e6e0d4' },
        paper: { 50:'#faf7f1',100:'#efebe2',150:'#f0ebdf' },
        cream: '#f9f4e7',
        fog:   { 50:'#fafaf9',100:'#f2f2f2' },
        surface: { page:'var(--surface-page)', card:'var(--surface-card)', cream:'var(--surface-cream)',
                   sunken:'var(--surface-sunken)', report:'var(--surface-report)', inverse:'var(--surface-inverse)' },
        content: { primary:'var(--text-primary)', secondary:'var(--text-secondary)', tertiary:'var(--text-tertiary)', muted:'var(--text-muted)' },
        accent:  { DEFAULT:'var(--accent-primary)', hover:'var(--accent-primary-hover)',
                   secondary:'var(--accent-secondary)', alert:'var(--accent-alert)' },
        data:    { favorable:'var(--data-favorable)', unfavorable:'var(--data-unfavorable)',
                   highlight:'var(--data-highlight)', neutral:'var(--data-neutral)' },
        line:    { subtle:'var(--border-subtle)', DEFAULT:'var(--border-default)' },
      },
      fontFamily: { display:['Montserrat','sans-serif'], body:['"Open Sans"','sans-serif'], data:['Poppins','sans-serif'] },
      borderRadius: { sm:'8px', md:'12px', lg:'20px', pill:'999px' },
      boxShadow: {
        sm:'0 1px 2px rgba(37,28,26,0.06)', md:'0 8px 24px rgba(37,28,26,0.08)', lg:'0 16px 48px rgba(37,28,26,0.12)',
      },
      transitionTimingFunction: { standard:'cubic-bezier(.4,0,.2,1)' },
      transitionDuration: { fast:'120ms', normal:'200ms' },
    },
  },
};
```

Base layer: `body { background: var(--surface-page); color: var(--text-primary); font-family: var(--font-body); }`, and `:focus-visible { outline: 2px solid var(--accent-secondary); outline-offset: 2px; }`.

Reviewers should be able to grep the diff for `#` and find nothing but the config above.

---

## 3. Brand components already defined

The design system ships these React primitives. Their APIs are the brand's vocabulary — match them when building product equivalents, and reuse them directly on marketing, onboarding and report surfaces.

| Component | Props | Product use |
|---|---|---|
| `Button` | `variant: primary\|secondary\|ghost`, `size: sm\|md\|lg`, `disabled` | all actions. Primary = gold fill, white text, pill, 2px transparent border, Montserrat 700, hover darkens to `--accent-primary-hover`. Secondary = transparent with a 2px gold border and gold text, hover fills cream. Ghost = ink text, hover `--surface-sunken`. Disabled = 0.5 opacity. |
| `Badge` | `tone: olive\|rust\|teal\|cream\|outline` | status pills, tier tags. Uppercase, `--tracking-eyebrow`, pill, 6/14 padding. |
| `IconTile` | `icon`, `tone: olive\|rust\|teal\|ink\|sand`, `shape: circle\|squircle\|rounded`, `size` | icon and number tiles; the brand's step markers. |
| `SectionEyebrow` | `children` | the 13px uppercase tracked label that opens a section. |
| `FeatureCard` | `eyebrow`, `title`, `description`, `tone: card\|cream\|inverse` | service/feature tiles. Card tone = white, 12px radius, 1px `--border-subtle`, `--shadow-sm`, 24px padding. |
| `NumberedStep` | `number`, `title`, `description`, `tone`, `onInverse` | 44px numbered circle + title + description. The onboarding/process pattern. |
| `StatCallout` | `value`, `label`, `tone: olive\|rust\|teal\|ink` | big Montserrat 900 figure over an Open Sans caption — the KPI pattern. |
| `ComparisonTable` | `tierA`, `tierB` (`{eyebrow,title,description,items,highlight}`) | two-column tier/plan comparison; the highlighted column goes ink-on-white with gold-500 accents. |

Product-only pieces (table, chart, form field, modal, drawer, toast, nav) are not in the system yet. Build them from the tokens using §5–§14, and add them back to the system when they stabilise.

---

## 4. Copy patterns

Straight from the collateral — match the cadence, don't imitate the sales pitch.

- Buttons are verbs in sentence case: "Upload statements", "Request review", "Approve close", "Export workbook". Not "Submit", not "Click here", not "OK".
- Page headers keep the rhythm: eyebrow `MONTH-END CLOSE` → title "March close" → one sentence: "Three accounts still need reconciliation before we can publish."
- Empty state: what goes here + one action. "No documents yet. Upload the month's bank statements to start the close."
- Error: what happened + the fix. "That file is over 25 MB. Split it or send it through the secure drop."
- Confirmation, flat and factual: "Statements uploaded. We'll review within one business day." Never "You're all set!"
- Destructive confirm names the consequence: "Removing Dana ends her access to Northside Dental immediately."

---

## 5. Product type scale

Smaller than the collateral scale; same families and casing.

| Use | Spec |
|---|---|
| Page title | 28px Montserrat 700, leading-tight |
| Section heading | 20px Montserrat 700 |
| Card title | 16px Montserrat 600 |
| Eyebrow | 13px Montserrat 600, uppercase, 0.14em, `--text-tertiary` |
| Body | 15–16px Open Sans 400, leading 1.5 |
| Label / table header | 13px Open Sans 600 (headers uppercase, 0.04em) |
| Caption / help | 13px Open Sans 400, `--text-tertiary` |
| KPI figure | 32–40px Montserrat 700 (or Poppins 600 on dashboards), tabular numerals |

All numeric columns and KPIs: `font-variant-numeric: tabular-nums`, right-aligned.

---

## 6. App shell & navigation

- Left sidebar 240px, `--surface-card` on the fog page, 1px `--border-subtle` right edge. Collapses to a 64px icon rail, becomes an off-canvas sheet under 768px.
- Horizontal logo lockup top-left with its clear space.
- Nav item: 15px Open Sans, 40px tall, 8px radius. Active = `--surface-cream` fill, ink text, 2px gold indicator inside the item's left edge (the one place a color strip is allowed). Hover = `--surface-sunken`.
- Group nav under 13px uppercase eyebrow labels: "Close", "Diligence", "Documents", "Reports".
- Topbar 64px: page title, context switcher, search, notifications, avatar menu.
- **Context switcher is first-class.** Portal users belong to multiple practices, brokers to multiple deals. It sits in the topbar, always shows the current entity by name, and scopes every data view. Switching re-renders with a visible loading state — a numeric page must never change underneath the user silently.
- Page header block: eyebrow → title → one-line description on the left, primary action on the right.
- Content max-width 1440px; gutters 32px desktop, 16px mobile. Cards: 24px padding, 16–24px gaps.

---

## 7. Buttons & controls

Follow the `Button` spec in §3. In product chrome, use 40px height (32 small, 48 large) and 15px Montserrat 700 with `--tracking-wide`.

- One primary per view. Destructive = rust fill, white text, hover `#a34518`, always behind a confirmation for client data.
- Disabled 0.5 opacity, no hover. Loading: spinner replaces the label, width held, button disabled.
- Focus ring 2px teal at 2px offset on everything focusable, including custom controls. Never removed.
- Icon-only buttons need an `aria-label` and a tooltip. 44px minimum touch target on mobile.

---

## 8. Data tables & grids

The platform's most important surface. 44px rows, 12px vertical / 16px horizontal cell padding.

- Header row `--surface-sunken`, 13px Open Sans 600 uppercase 0.04em, `--text-tertiary`, sticky.
- Row separators 1px `--border-subtle`. No zebra striping. Hover tints the row `--surface-cream`.
- Text left; numbers right with tabular numerals; dates in one fixed format (`12 Mar 2026`).
- Negatives in rust with a leading minus — not parentheses, not a rust-filled cell. Variance columns use the fixed semantics as **text color plus an arrow or sign**, never color alone.
- More than ~8 columns: freeze the first, scroll the rest. Never shrink type below 13px to fit.
- Row actions in a trailing overflow menu. Selection via a checkbox column, selected rows `--surface-cream`, bulk actions in a bar docked to the bottom of the table.
- Toolbar above the table for sort, filter, column visibility; active filters as removable pills.
- Pagination bottom-right, 25/50/100. Infinite scroll only for activity feeds, never financial data.
- Three designed states, always: skeleton rows (no spinner), empty, error-with-retry.
- Every financial table has an export (CSV/XLSX) whose column labels match the screen.

---

## 9. Charts & variance viz

- Series order: teal `#12898d`, gold `#9c7804`, rust `#c1502e`, olive `#6f5a22`, teal-400 `#52b0b3`, gold-400 `#c9a769`. Past six series, aggregate rather than add colors.
- Actual vs budget: actual solid, budget dashed `--border-default` or a ghosted bar. Favorable teal, unfavorable rust — always.
- Horizontal grid lines only, 1px `--border-subtle`. No vertical grid, no chart border, no 3D, no shadows, no rounded bar caps.
- Axis labels 12px Open Sans `--text-tertiary`. Prefer direct value labels (13px Montserrat 600 ink) over a legend; when a legend is needed, put it above the plot, left-aligned, 10px dots.
- Currency abbreviated on axes (`$1.2M`, `$840K`), full precision in tooltips.
- **Bridge / waterfall is a core GCO pattern** (add-backs → adjusted EBITDA): start and end bars ink, positive steps teal, negative steps rust, 1px `--border-default` connectors, each step labelled.
- Tooltip: white card, `--shadow-md`, 8px radius, 12px padding, series + value per row.
- Every chart carries a text alternative — a "View data" table toggle or a summarising caption.

---

## 10. Forms & validation

- One column. Two only for genuinely paired short fields.
- Label above, 13px Open Sans 600 ink; help text below, 13px `--text-tertiary`. Placeholders are examples, never labels.
- Input 40px, 8px radius, white, 1px `--border-default`, 12px horizontal padding, 15px Open Sans. Focus = teal border + teal ring. Disabled = `--surface-sunken`, muted text.
- Required marked with a rust asterisk; "(optional)" when most fields are required.
- Validate on blur and on submit, not on keystroke. Error = rust border, 13px rust message with a filled warning glyph, focus moves to the first error. Form-level errors in a `#f7e6db` panel, 12px radius, above the actions.
- Actions bottom-right, primary rightmost; sticky action bar on long forms.
- Money inputs: currency prefix inside the field, tabular numerals, separators on blur. Date fields accept typing as well as the picker.
- Autosave where safe, with a quiet "Saved 12:04" caption — never a toast per save.

---

## 11. Modals, drawers, popovers

- **Modal** for one focused decision or a short form: centered, max 560px (720px for forms), white, 12px radius, `--shadow-lg`, 24px padding, warm scrim `rgba(37,28,26,0.4)` — no blur.
- **Drawer** for detail in context (a transaction, document, deal record): right side, 480–640px, same chrome.
- Header = 18px Montserrat 700 title + close X. Footer actions right-aligned, with a top `--border-subtle` when the body scrolls.
- Escape and scrim close; unsaved changes prompt first. Focus trapped inside, returned to the trigger on close. Never stack modals.
- Popovers for filters and menus: `--shadow-md`, 8px radius, 8px padding, close on outside click.

---

## 12. Feedback: toasts, empty, loading, errors

- **Toast** bottom-right, max 420px, white, `--shadow-md`, 12px radius, 4px status bar on the left inner edge — teal success, rust error, gold warning, ink info. Success auto-dismisses at 4s; errors persist. One at a time, queue the rest. Never use a toast for validation errors or for anything requiring action.
- **Inline banner** for page-level conditions (period locked, awaiting client data): matching semantic tint, 12px radius, filled glyph, one optional action link. No left-border strip.
- **Empty state**: centered, one flat glyph in a `--surface-cream` circle, 16px Montserrat 600 line, one sentence, one action. No illustrations, no mascots.
- **Loading**: static skeletons in `--surface-sunken` shaped like the incoming content — no shimmer. Spinners only inside buttons and sub-second inline waits. Never a full-page spinner on navigation.
- **Errors**: what failed, what it means, one retry, a support reference for server errors. No raw status codes for portal users.

---

## 13. Documents & upload

- Drop zone: 2px dashed `--border-default`, 12px radius, `--surface-report` fill, 32px padding. Drag-over switches the border to teal and the fill to `#e1efee`.
- State the accepted types and size cap in the zone. Always offer a picker alongside drag-and-drop.
- Per-file rows while uploading: name, size, teal progress bar, cancel. Failures stay in the list in rust with retry.
- Document lists are tables, not card grids: name, type, period, uploaded by, date, status badge, download.
- Status badges use the fixed semantics: teal Received/Reconciled, gold Pending review, rust Missing/Rejected.
- Client financial and patient data is sensitive (the engagement letter covers HIPAA handling): no unauthenticated preview URLs, and no document name or client identifier in a page title, toast, URL, or analytics event that leaves the app.

---

## 14. Auth & onboarding

- Auth page: fog background, centered 400px white card, `--shadow-md`, logo above the card. No marketing content, no split-screen hero.
- Login errors stay generic ("Email or password is incorrect"). One field per step for MFA.
- Onboarding follows the brand's kickoff structure: `NumberedStep` markers, one question or task per step, persistent progress, and an explicit "What happens next" summary at the end. Resumable and skippable — never trap a new user in a wizard.
- First-run screens use eyebrow → headline → one sentence, then a single action. This is the one product surface where the office photography is appropriate.

---

## 15. Roles & permissions

Practice owners, office managers, firm partners, brokers and GCO staff share one shell with different data and actions.

- Hide what a role can't do. Disable-with-tooltip only when the user could plausibly gain the permission ("Only account owners can invite users").
- Resolve permissions before route render — never render then error.
- Role shown as a neutral pill (`--surface-sunken`, ink). Don't color-code roles with the data ramps; those mean data health.
- GCO staff viewing a client account get a persistent gold banner: "Viewing Northside Dental as GCO staff." Impersonation is always visible.
- Removing a user or revoking access requires typed confirmation of the name.

---

## 16. Responsive & accessibility

Breakpoints 640 / 768 / 1024 / 1280 / 1536.

- Under 768px: sidebar becomes an off-canvas sheet, topbar keeps the context switcher, page padding 16px, cards full-bleed with 12px radius, modals become bottom-anchored full-screen sheets.
- Tables under 768px: either horizontal scroll with a frozen first column, or a stacked card per row with 3–4 key fields and a link to detail. One approach per table; never hide columns silently.
- Charts under 768px: single column, headline series only, keep direct labels.
- Touch targets 44px with 8px between neighbours.

WCAG 2.1 AA:

- Body text 4.5:1, large headings 3:1. **Gold `#9c7804` on white does not pass at body size** — use ink, `--gco-gold-900 #6f5a22`, or teal for small text. White on gold and white on rust both pass.
- Never encode meaning in color alone: variance gets an arrow or sign, status gets a word, series get direct labels.
- Semantic HTML first — real `<table>`, `<button>`, `<label for>`. ARIA only where no element exists.
- Full keyboard operation, visible focus, focus trapped and returned for overlays, Escape closes.
- Announce async results in a polite live region.
- `prefers-reduced-motion` drops transitions to 0ms.

---

## 17. Review checklist

1. No hex in the diff — tokens only.
2. Page fog, cards white, ink text, warm borders. No pure black, no cool gray.
3. Montserrat headings/buttons/KPIs, Open Sans body, Poppins only for dense numerics.
4. Teal/rust/gold carry only their fixed data meanings, and never as the only signal.
5. Eyebrow → headline → one sentence on every page header and section.
6. One primary button per view; buttons are verbs in sentence case.
7. Tables: loading, empty, error states + tabular numerals + export.
8. Visible focus on every interactive element; keyboard path works end to end.
9. None of §1.9 present.
10. Copy states the situation and the next action, no exclamation points, no emoji.
11. Works at 375, 768 and 1440px.
12. Nothing sensitive in titles, URLs, toasts or analytics events.
