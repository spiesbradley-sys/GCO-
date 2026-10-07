import { requireDeskUser } from '@/lib/desk/auth';
import { BOARDS } from '@/desk/boards';
import { OptionChip } from '@/components/desk/ui';

// Static operating-notes reference. Links open the Notion library in a new tab.
const N = 'https://app.notion.com/p/';
const LIBRARY = [
  [N + '3d0985949f4781308354edc86214559c', 'Document Repository', 'HIPAA compliance pack, QoE workbook, LoE, onboarding deck'],
  [N + '3d0985949f478176bb38dd2358c1136d', 'QofE Lite Delivery Playbook', 'Data request, validation, build, review, delivery'],
  [N + '3d0985949f4781e0997fc87ad87db090', 'Managed Accounting Playbook', 'Running the monthly cycle end to end'],
  [N + '3d0985949f4781b88534ffa0707ebfc8', 'New Joiner Onboarding', 'First two weeks, systems, people, rules'],
  [N + '3d0985949f4781cd978cfff71f215222', 'Onboarding Knowledge Check', 'Marked before touching a live client'],
  [N + '398985949f47819fa508fc64e5cce771', 'Original Notion hub', 'GCO Accounting Service Desk'],
];
const FEES = [
  ['1 location', '$1,000', '3 BD'],
  ['2–4 locations', '$1,500', '5 BD'],
  ['5–7 locations', '$2,000', '7 BD'],
  ['8–10 locations', '$2,500', '10 BD'],
  ['Over 10', '$2,500 + $150 each', '10 BD + 1 each'],
];

export default async function GuidePage() {
  await requireDeskUser();
  const stage = BOARDS.cycles.fields.find((f) => f.k === 'stage')!;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="eyebrow">Reference</span>
        <h1 className="font-heading text-page-title text-ink">How the desk runs</h1>
        <p className="max-w-2xl text-[15px] text-ink-secondary">
          Operating notes for both dental service lines. Same delivery standard, same compliance posture, same P&amp;L, built differently.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Managed Accounting">
          Recurring monthly accounting. We own the close; the client reviews and signs off. <b>$600</b> base for one location, plus <b>$300</b> per additional location. The unit of work is the monthly cycle.
        </Card>
        <Card title="QofE Lite">
          Fixed-scope, fixed-fee Quality-of-Earnings for dental practice M&amp;A. Defensible TTM Adjusted EBITDA with the full workbook behind it. Not an audit, a valuation, or a deal opinion.
        </Card>
      </div>

      <section className="max-w-3xl text-[15px] leading-relaxed text-ink">
        <h2 className="mb-2 font-heading text-section-title">The working rhythm</h2>
        <p className="text-ink-secondary">
          Standard SLA: pack within 5 business days of month-end close, review meeting within 5 business days of delivery, client queries answered within 1 business day. White label: close complete by the 8th business day of the following month.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-border-subtle bg-border-subtle sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Month-end', 'Cycles move to Capture. Claude runs first-pass capture; the bookkeeper reviews exceptions.'],
          ['Days 1–3', 'Bank, merchant, control account and AP aging reconciliations. Log blockers immediately.'],
          ['Days 4–5', 'Controller review, dashboard prep, delivery.'],
          ['+5 BD', 'Review meeting held, notes filed to Deliverables.'],
        ].map(([t, d]) => (
          <div key={t} className="bg-surface-card p-3.5">
            <p className="mb-1 font-numeric text-[12px] font-semibold text-accent-primary">{t}</p>
            <p className="text-[13px] text-ink-secondary">{d}</p>
          </div>
        ))}
      </div>

      <div className="max-w-3xl rounded-card bg-watch-tint px-4 py-3 text-[14px] text-ink">
        <b>The clock rule.</b> A logged blocker is what pauses an SLA clock. A gap logged on day 1 protects the close; the same gap found on day 4 is a missed SLA.
      </div>

      <section className="max-w-3xl">
        <h3 className="mb-2 font-heading text-[15px] font-semibold text-ink">Cycle stages</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {stage.o!.map((o, i) => (
            <span key={o.name} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-ink-tertiary">→</span>}
              <OptionChip field={stage} value={o.name} />
            </span>
          ))}
        </div>
      </section>

      <section className="max-w-2xl">
        <h2 className="mb-2 font-heading text-section-title">QofE Lite fees and turnaround</h2>
        <p className="mb-3 text-[14px] text-ink-secondary">The clock runs from receipt of a clean, complete data package to draft 1. Payment is due 7 days from invoice.</p>
        <div className="overflow-hidden rounded-card border border-border-subtle bg-surface-card">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="bg-surface-sunken text-left text-[12px] uppercase tracking-header text-ink-tertiary">
                <th className="px-4 py-2.5">Practice size</th><th className="px-4 py-2.5 text-right">Rack rate</th><th className="px-4 py-2.5 text-right">To draft 1</th>
              </tr>
            </thead>
            <tbody>
              {FEES.map((r) => (
                <tr key={r[0]} className="border-t border-border-subtle">
                  <td className="px-4 py-2.5">{r[0]}</td><td className="px-4 py-2.5 text-right tnum">{r[1]}</td><td className="px-4 py-2.5 text-right tnum">{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="max-w-3xl text-[15px] text-ink">
        <h3 className="mb-2 font-heading text-[15px] font-semibold">Add it, leave it, or normalize it</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-ink-secondary">
          <li><b className="text-ink">Add it back:</b> a cost a new owner would not inherit (owner personal expenses, one-off legal).</li>
          <li><b className="text-ink">Leave it:</b> a genuine recurring operating cost (wages, lab fees, supplies).</li>
          <li><b className="text-ink">Normalize it:</b> a real cost at the wrong level (owner clinical wage, related-party rent).</li>
        </ul>
        <div className="mt-3 rounded-card bg-unfavorable-tint px-4 py-3 text-[14px] text-ink">
          <b>PHI deals.</b> Signed BAA before any data moves. Raw PMS and GL exports go through the De-Identification Toolkit (VALIDATION = PASS) before analysis.
        </div>
      </section>

      <section className="max-w-3xl">
        <h2 className="mb-2 font-heading text-section-title">Library</h2>
        <p className="mb-3 text-[14px] text-ink-secondary">Templates, the HIPAA pack and the playbooks stay in Notion. These open in a new tab.</p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {LIBRARY.map(([href, title, sub]) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="rounded-card border border-border-subtle bg-surface-card px-4 py-3 hover:border-accent-secondary">
              <p className="font-semibold text-ink">{title}</p>
              <p className="text-[12.5px] text-ink-tertiary">{sub}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card bg-surface-card p-5 shadow-sm">
      <h2 className="mb-2 font-heading text-[16px] font-bold text-ink">{title}</h2>
      <p className="text-[14px] text-ink-secondary">{children}</p>
    </div>
  );
}
