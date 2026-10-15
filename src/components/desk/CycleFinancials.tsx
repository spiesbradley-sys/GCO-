'use client';

import { useEffect, useRef, useState } from 'react';
import { cn, formatCurrencyWhole, formatDate } from '@/lib/utils';
import { IconAlert, IconUpload } from '@/components/ui/icons';
import { useToast } from '@/components/ui/Toast';
import type { FinancialsSummary } from '@/app/api/desk/cycles/[id]/financials/route';

// "Client dashboard" section of a cycle's drawer: upload the GCO monthly
// financials workbook for this cycle and see what was read from it. The client
// sees the figures in their portal once the cycle is Delivered.

const VISIBLE_STAGES = ['Delivered', 'Meeting Held', 'Closed'];

export function CycleFinancials({ cycleId, stage, canWrite }: { cycleId: string; stage: string | null; canWrite: boolean }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [latest, setLatest] = useState<FinancialsSummary | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/desk/cycles/${cycleId}/financials`)
      .then((r) => (r.ok ? r.json() : { latest: null }))
      .then((j) => live && setLatest(j.latest ?? null))
      .catch(() => live && setLatest(null));
    return () => {
      live = false;
    };
  }, [cycleId]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append('file', file);
    try {
      const res = await fetch(`/api/desk/cycles/${cycleId}/financials`, { method: 'POST', body });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setError(j.error ?? 'Upload failed. Try again.');
      else {
        setLatest(j.latest);
        toast.success('Financials uploaded.');
      }
    } catch {
      setError('Upload failed. Check your connection and try again.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  const live = stage ? VISIBLE_STAGES.includes(stage) : false;

  return (
    <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-header text-ink-tertiary">Client dashboard</p>

      {latest === undefined ? (
        <div className="h-12 rounded-input bg-surface-sunken" aria-hidden />
      ) : latest ? (
        <div className="flex flex-col gap-1 rounded-input border border-border-subtle px-3 py-2 text-[13px]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold text-ink">{latest.periodLabel ?? 'Period not found'}</span>
            <span className={cn('text-[12px] font-semibold', live ? 'text-favorable' : 'text-watch')}>
              {live ? 'Visible to client' : 'Hidden until Delivered'}
            </span>
          </div>
          <span className="text-ink-secondary">
            Net revenue {latest.netRevenue != null ? formatCurrencyWhole(latest.netRevenue) : '—'} · Net income{' '}
            {latest.netIncome != null ? formatCurrencyWhole(latest.netIncome) : '—'}
          </span>
          <span className="text-[12px] text-ink-tertiary">
            {latest.fileName} · uploaded {formatDate(latest.uploadedAt)}
          </span>
          {latest.warnings.map((w, i) => (
            <span key={i} className="flex items-start gap-1.5 text-[12px] text-watch">
              <IconAlert width={12} height={12} className="mt-0.5 shrink-0" />
              {w}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-ink-tertiary">No financials yet. Upload this period’s financials workbook to build the client’s dashboard.</p>
      )}

      {canWrite && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-1 rounded-card border-2 border-dashed px-4 py-4 text-center text-[13px] transition-colors duration-fast',
            over ? 'border-accent-secondary bg-favorable-tint' : 'border-border-default bg-surface-report',
            busy && 'pointer-events-none opacity-60',
          )}
        >
          <IconUpload width={16} height={16} className="text-ink-tertiary" />
          <span className="font-semibold text-ink">{busy ? 'Reading workbook…' : latest ? 'Replace financials workbook' : 'Upload financials workbook'}</span>
          <span className="text-[12px] text-ink-tertiary">.xlsx, up to 10 MB. Drop it here or choose a file.</span>
          <input
            ref={input}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-[12.5px] text-unfavorable">
          <IconAlert width={13} height={13} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
