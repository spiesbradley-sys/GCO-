'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { deskDashboard } from '@/desk/insights';
import type { DeskData } from '@/desk/insights';
import { fmtDate } from '@/desk/format';

type Dash = ReturnType<typeof deskDashboard>;
const m = (c: number) => '$' + Math.round(c / 100).toLocaleString('en-US');

export function Overview({ dash, canViewCommercial }: { dash: Dash; canViewCommercial: boolean }) {
  const [mode, setMode] = useState<'all' | 'desk' | 'mgmt'>(canViewCommercial ? 'all' : 'desk');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('desk:dash') as 'all' | 'desk' | 'mgmt' | null;
      if (saved && canViewCommercial) setMode(saved);
    } catch {
      /* ignore */
    }
  }, [canViewCommercial]);

  function choose(x: 'all' | 'desk' | 'mgmt') {
    setMode(x);
    try {
      localStorage.setItem('desk:dash', x);
    } catch {
      /* ignore */
    }
  }

  const showD = mode !== 'mgmt';
  const showM = canViewCommercial && mode !== 'desk';
  const kpis = [...(showM ? dash.commercialKpis : []), ...(showD ? dash.deliveryKpis : [])];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Service desk</span>
          <h1 className="font-heading text-page-title text-ink">Desk overview</h1>
          <p className="max-w-2xl text-[15px] text-ink-secondary">
            The unit of work is the monthly cycle, not the client. Delivery shows what the team must move today; Commercial shows what the desk earns.
          </p>
        </div>
        {canViewCommercial && (
          <div className="flex gap-1 rounded-input bg-surface-sunken p-1">
            {([['all', 'Everything'], ['desk', 'Delivery'], ['mgmt', 'Commercial']] as const).map(([k, l]) => (
              <button key={k} onClick={() => choose(k)} className={cn('rounded-[6px] px-3 py-1 text-[13px] font-semibold', mode === k ? 'bg-surface-card text-ink shadow-sm' : 'text-ink-tertiary hover:text-ink')}>
                {l}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className={cn('flex flex-col gap-1 rounded-card bg-surface-card p-4 shadow-sm', k.flag && 'ring-1 ring-watch')}>
            <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-ink-tertiary">{k.label}</span>
            <span className="font-numeric text-[24px] font-bold leading-tight tnum text-ink">{k.value}</span>
            <span className="text-[12.5px] text-ink-tertiary">{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Needs attention */}
      <Panel title="Needs attention" sub={`${dash.attention.length} item${dash.attention.length === 1 ? '' : 's'}, most urgent first`}>
        {dash.attention.length === 0 ? (
          <p className="rounded-input bg-favorable-tint px-3 py-2 text-[13px] text-favorable">Nothing flagged. Every cycle is on track and no query is waiting.</p>
        ) : (
          <div className="flex flex-col">
            {dash.attention.map((a) => (
              <Link key={`${a.b}:${a.id}`} href={`/desk/boards/${a.b}?open=${a.id}`} className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-0.5 border-t border-border-subtle py-2.5 first:border-t-0 hover:[&_.at]:text-accent-secondary">
                <span className={cn('mt-1.5 h-2 w-2 rounded-full', a.sev === 'bad' ? 'bg-unfavorable' : a.sev === 'warn' ? 'bg-watch' : 'bg-accent-secondary')} style={{ gridRow: 'span 2' }} />
                <span className="at font-semibold text-ink">{a.t}</span>
                <span className="text-[12.5px] text-ink-secondary">{a.d}</span>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      {/* DELIVERY */}
      {showD && (
        <>
          <SectionHead title="Delivery" sub="For the accountants and controllers running the close." />
          <Panel title="Production line" sub="cycles by stage">
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
              {dash.delivery.stageCounts.map((s) => (
                <Link key={s.name} href="/desk/boards/cycles" className="flex flex-col gap-1.5 rounded-input bg-surface-sunken p-2 hover:outline hover:outline-1 hover:outline-accent-secondary">
                  <span className={cn('font-numeric text-[20px] font-semibold leading-none', s.n ? 'text-ink' : 'text-ink-tertiary')}>{s.n}</span>
                  <span className="text-[11px] leading-tight text-ink-secondary">{s.name}</span>
                </Link>
              ))}
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="SLA clock" sub="open cycles due in 10 business days">
              {dash.delivery.dueList.length === 0 ? (
                <p className="text-[12.5px] text-ink-tertiary">No open cycle has an SLA date in the next 10 business days.</p>
              ) : (
                <div className="flex flex-col">
                  {dash.delivery.dueList.map((d) => (
                    <Link key={d.id} href={`/desk/boards/cycles?open=${d.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-2 border-t border-border-subtle py-2 first:border-t-0">
                      <span className="font-semibold text-ink">{d.name}</span>
                      <span className={cn('rounded-[4px] px-2 py-0.5 font-numeric text-[12px] font-semibold', d.n < 0 ? 'bg-unfavorable-tint text-unfavorable' : d.n <= 2 ? 'bg-watch-tint text-watch' : 'bg-favorable-tint text-favorable')}>
                        {d.n < 0 ? `${-d.n} BD late` : d.n === 0 ? 'Due today' : `${d.n} BD`}
                      </span>
                      <span className="col-span-2 text-[12px] text-ink-tertiary">{d.stage} · due {fmtDate(d.slaDue)}{d.blockers ? ` · ${d.blockers} open blocker(s)` : ''}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Query ageing" sub="against the 1 BD response">
              <div className="grid grid-cols-4 gap-1.5">
                {dash.delivery.ageBuckets.map((b, i) => (
                  <div key={b.l} className="flex flex-col gap-0.5 rounded-input bg-surface-sunken p-2">
                    <span className={cn('font-numeric text-[18px] font-semibold', i >= 1 && b.n ? 'text-unfavorable' : 'text-ink')}>{b.n}</span>
                    <span className="text-[11px] text-ink-tertiary">{b.l}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <HBars items={dash.delivery.queryTypes.map((x) => ({ label: x.name, value: x.n, max: Math.max(1, ...dash.delivery.queryTypes.map((y) => y.n)), text: String(x.n), tone: x.name.includes('Access') || x.name.includes('Bank') ? 'bad' : undefined }))} empty="No open queries by type." />
              </div>
            </Panel>

            <Panel title="Workload by person" sub="open items each person owns">
              {dash.delivery.workload.length === 0 ? (
                <p className="text-[12.5px] text-ink-tertiary">Nobody has open work assigned.</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase tracking-header text-ink-tertiary">
                      <th className="py-1">Person</th><th className="py-1 text-right">QoE</th><th className="py-1 text-right">Rev</th><th className="py-1 text-right">Cyc</th><th className="py-1 text-right">Qry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dash.delivery.workload.map((w) => (
                      <tr key={w.name} className="border-t border-border-subtle">
                        <td className="py-1.5">{w.name}</td>
                        <td className="py-1.5 text-right tnum">{w.deals}</td>
                        <td className="py-1.5 text-right tnum">{w.reviews}</td>
                        <td className="py-1.5 text-right tnum">{w.cycles}</td>
                        <td className="py-1.5 text-right tnum">{w.queries}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

          <Panel title="Client readiness" sub="a cycle should never start against access that isn't live">
            {dash.delivery.clientReadiness.length === 0 ? (
              <p className="text-[12.5px] text-ink-tertiary">No clients yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase tracking-header text-ink-tertiary">
                      <th className="py-1.5 pr-3">Client</th><th className="py-1.5 pr-3">Letter</th><th className="py-1.5 pr-3">Systems access</th><th className="py-1.5 pr-3">Bank feed</th><th className="py-1.5 pr-3">Onboarding</th><th className="py-1.5 pr-3 text-right">Fee/mo</th><th className="py-1.5 text-right">Blockers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dash.delivery.clientReadiness.map((c) => (
                      <tr key={c.id} className="border-t border-border-subtle">
                        <td className="py-1.5 pr-3 font-semibold">
                          <Link href={`/desk/boards/clients?open=${c.id}`} className="hover:text-accent-secondary">{c.name}</Link>
                        </td>
                        <td className="py-1.5 pr-3"><Dot ok={c.letter ? 'g' : 'r'} />{c.letter ? 'Signed' : 'Not signed'}</td>
                        <td className="py-1.5 pr-3"><Dot ok={c.access === 'Full access live' ? 'g' : c.access === 'Partial' ? 'a' : c.access ? 'r' : 'n'} />{c.access || 'Not recorded'}</td>
                        <td className="py-1.5 pr-3"><Dot ok={c.bank === 'Connected' ? 'g' : c.bank === 'Not set up' ? 'a' : c.bank ? 'r' : 'n'} />{c.bank || 'Not recorded'}</td>
                        <td className="py-1.5 pr-3"><Dot ok={c.onboarding === 'Done' ? 'g' : c.onboarding ? 'a' : 'n'} />{c.onboarding || 'Not recorded'}</td>
                        <td className="py-1.5 pr-3 text-right tnum">{c.feeCents ? m(c.feeCents) : ''}</td>
                        <td className="py-1.5 text-right tnum">{c.blockers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {/* COMMERCIAL */}
      {showM && (
        <>
          <SectionHead title="Commercial" sub="For management: revenue, margin, pipeline and concentration." />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Revenue booked by month" sub="recurring vs one-off">
              <StackedColumns rows={dash.commercial.revenueByMonth} />
            </Panel>
            <Panel title="Margin by engagement" sub="lowest first, uncosted flagged">
              <HBars
                items={dash.commercial.marginByEngagement.map((x) =>
                  x.costed
                    ? { label: x.name, value: Math.round(x.pct), max: 100, text: `${Math.round(x.pct)}%`, tone: x.pct < 40 ? 'warn' : undefined }
                    : { label: x.name, value: 0, max: 100, text: 'no cost', tone: 'none' as const },
                )}
              />
            </Panel>
            <Panel title="Revenue mix by service" sub="all P&L rows">
              <HBars items={dash.commercial.revenueMix.map((x) => ({ label: x.name, value: x.v, max: Math.max(1, ...dash.commercial.revenueMix.map((y) => y.v)), text: m(x.v) }))} />
            </Panel>
            <Panel title="QofE Lite pipeline" sub="fees by phase">
              <HBars items={dash.commercial.pipelinePhases.map((x) => ({ label: x.l, value: x.v, max: Math.max(1, ...dash.commercial.pipelinePhases.map((y) => y.v)), text: `${x.n} · ${m(x.v)}`, tone: x.l === 'Finalized' ? undefined : ('s2' as const) }))} />
              {dash.commercial.turnaround.length > 0 && (
                <p className="mt-2 text-[12px] text-ink-tertiary">Turnaround: {dash.commercial.turnaround.map((t) => `${t.name} ${t.used} BD vs ${t.target}`).join('; ')}.</p>
              )}
            </Panel>
            <Panel title="Concentration · QoE by source" sub="where revenue depends on one source">
              <HBars items={dash.commercial.concentration.map((x) => ({ label: x.name, value: x.v, max: Math.max(1, ...dash.commercial.concentration.map((y) => y.v)), text: m(x.v), tone: 's2' as const }))} />
            </Panel>
            <Panel title="Concentration · monthly client fees" sub="share of recurring client fees">
              <HBars items={dash.commercial.clientFees.map((x) => ({ label: x.name, value: x.v, max: Math.max(1, ...dash.commercial.clientFees.map((y) => y.v)), text: m(x.v) }))} empty="No recurring client fees yet." />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card bg-surface-card p-4 shadow-sm md:p-5">
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="font-heading text-[15px] font-bold text-ink">{title}</h3>
        {sub && <span className="text-[12px] text-ink-tertiary">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mt-2 flex items-baseline gap-2">
      <h2 className="font-heading text-section-title text-ink">{title}</h2>
      <p className="text-[13px] text-ink-tertiary">{sub}</p>
    </div>
  );
}

function Dot({ ok }: { ok: 'g' | 'a' | 'r' | 'n' }) {
  const c = ok === 'g' ? 'bg-favorable' : ok === 'a' ? 'bg-watch' : ok === 'r' ? 'bg-unfavorable' : 'bg-border-default';
  return <span className={cn('mr-1.5 inline-block h-2 w-2 rounded-full align-middle', c)} />;
}

type Bar = { label: string; value: number; max: number; text: string; tone?: 'bad' | 'warn' | 's2' | 'none' };
function HBars({ items, empty }: { items: Bar[]; empty?: string }) {
  if (items.length === 0) return <p className="text-[12.5px] text-ink-tertiary">{empty ?? 'No data.'}</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((b, i) => {
        const w = b.max ? Math.max(2, Math.round((Math.abs(b.value) / b.max) * 100)) : 0;
        const fill = b.tone === 'bad' ? 'bg-unfavorable' : b.tone === 'warn' ? 'bg-watch' : b.tone === 's2' ? 'bg-chart-2' : b.tone === 'none' ? 'bg-border-default' : 'bg-chart-1';
        return (
          <div key={b.label + i} className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-0.5">
            <span className="truncate text-[13px] text-ink">{b.label}</span>
            <span className="font-numeric text-[12.5px] tnum text-ink-secondary">{b.text}</span>
            <div className="col-span-2 h-2 overflow-hidden rounded-pill bg-surface-sunken">
              <div className={cn('h-full rounded-pill', fill)} style={{ width: `${b.tone === 'none' ? 0 : w}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StackedColumns({ rows }: { rows: { label: string; recurring: number; oneoff: number }[] }) {
  if (rows.length === 0) return <p className="text-[12.5px] text-ink-tertiary">No P&L rows with a month yet.</p>;
  const top = Math.max(1, ...rows.map((r) => r.recurring + r.oneoff));
  return (
    <div>
      <div className="mb-2 flex gap-4 text-[12px] text-ink-tertiary">
        <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[2px] bg-chart-1 align-middle" />Recurring</span>
        <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[2px] bg-chart-2 align-middle" />One-off</span>
      </div>
      <div className="flex h-[170px] items-end gap-2 border-b border-border-subtle">
        {rows.map((r) => {
          const total = r.recurring + r.oneoff;
          return (
            <div key={r.label} className="flex flex-1 flex-col items-center justify-end" title={`${r.label}: ${m(total)}`}>
              <span className="mb-1 font-numeric text-[10px] text-ink-tertiary">{total ? m(total) : ''}</span>
              <div className="flex w-full max-w-[28px] flex-col">
                {r.oneoff > 0 && <div className="w-full rounded-t-[3px] bg-chart-2" style={{ height: `${(r.oneoff / top) * 150}px` }} />}
                {r.recurring > 0 && <div className="w-full bg-chart-1" style={{ height: `${(r.recurring / top) * 150}px` }} />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {rows.map((r) => (
          <span key={r.label} className="flex-1 text-center text-[11px] text-ink-tertiary">{r.label}</span>
        ))}
      </div>
    </div>
  );
}
