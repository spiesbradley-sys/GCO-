'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, Money, type Column } from '@/components/table/DataTable';
import { Popover } from '@/components/table/Popover';
import { FilterPills, type ActiveFilter } from '@/components/table/FilterPills';
import { Button } from '@/components/ui/Button';
import { StatusBadge, INVOICE_STATUS } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { IconFilter, IconDocument, IconChevronDown } from '@/components/ui/icons';
import { formatCurrency, formatDate } from '@/lib/utils';
import { exportCsv } from '@/lib/export';
import { useTableFilters } from '@/lib/useTableFilters';
import { createCheckoutSession } from '@/actions/payments';

export type InvoiceRow = {
  id: string;
  number: string;
  practice: string | null;
  amountCents: number;
  currency: string;
  status: keyof typeof INVOICE_STATUS;
  issueDate: string;
  dueDate: string | null;
};

const STATUS_OPTIONS: InvoiceRow['status'][] = ['draft', 'sent', 'paid', 'overdue', 'void'];

const EXPORT_COLUMNS = [
  { key: 'number', header: 'Invoice' },
  { key: 'practice', header: 'Practice' },
  { key: 'amount', header: 'Amount' },
  { key: 'status', header: 'Status' },
  { key: 'issueDate', header: 'Issued' },
  { key: 'dueDate', header: 'Due' },
];

export function InvoicesView({
  rows,
  contextKey,
  canPay,
}: {
  rows: InvoiceRow[];
  contextKey: string;
  canPay: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pendingPay, startPay] = useTransition();
  const [payingId, setPayingId] = useState<string | null>(null);

  const [filters, setFilters, clearFilters] = useTableFilters<{
    status: InvoiceRow['status'][];
  }>('invoices', contextKey, { status: [] });

  const filtered = useMemo(() => {
    if (filters.status.length === 0) return rows;
    return rows.filter((r) => filters.status.includes(r.status));
  }, [rows, filters]);

  const pills: ActiveFilter[] = filters.status.map((s) => ({
    key: `status:${s}`,
    label: `Status: ${INVOICE_STATUS[s].label}`,
  }));

  function pay(id: string) {
    setPayingId(id);
    startPay(async () => {
      const res = await createCheckoutSession(id);
      setPayingId(null);
      if ('url' in res) window.location.href = res.url;
      else toast.error(res.error);
    });
  }

  const columns: Column<InvoiceRow>[] = [
    { key: 'number', header: 'Invoice', sticky: true, render: (r) => <span className="font-semibold">{r.number}</span> },
    { key: 'practice', header: 'Practice', render: (r) => r.practice ?? '—' },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (r) => <Money cents={r.amountCents} format={(c) => formatCurrency(c, r.currency)} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <StatusBadge tone={INVOICE_STATUS[r.status].tone}>{INVOICE_STATUS[r.status].label}</StatusBadge>
      ),
    },
    { key: 'issueDate', header: 'Issued', render: (r) => formatDate(r.issueDate) },
    { key: 'dueDate', header: 'Due', render: (r) => formatDate(r.dueDate) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) =>
        canPay && (r.status === 'sent' || r.status === 'overdue') ? (
          <Button
            size="sm"
            variant="secondary"
            loading={pendingPay && payingId === r.id}
            onClick={(e) => {
              e.stopPropagation();
              pay(r.id);
            }}
          >
            Pay invoice
          </Button>
        ) : null,
    },
  ];

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Popover
        trigger={({ open, toggle }) => (
          <Button variant="secondary" size="sm" onClick={toggle} aria-expanded={open}>
            <IconFilter width={14} height={14} /> Status <IconChevronDown width={12} height={12} />
          </Button>
        )}
      >
        <fieldset className="flex flex-col gap-1 p-1">
          <legend className="px-2 pb-1 text-[13px] font-semibold text-ink-tertiary">Status</legend>
          {STATUS_OPTIONS.map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-2 rounded-input px-2 py-1.5 text-[14px] hover:bg-surface-sunken"
            >
              <input
                type="checkbox"
                checked={filters.status.includes(s)}
                onChange={(e) =>
                  setFilters({
                    status: e.target.checked
                      ? [...filters.status, s]
                      : filters.status.filter((x) => x !== s),
                  })
                }
                className="accent-accent-primary"
              />
              {INVOICE_STATUS[s].label}
            </label>
          ))}
        </fieldset>
      </Popover>

      <div className="ml-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            exportCsv(
              'invoices',
              EXPORT_COLUMNS,
              filtered.map((r) => ({
                number: r.number,
                practice: r.practice ?? '',
                amount: formatCurrency(r.amountCents, r.currency),
                status: INVOICE_STATUS[r.status].label,
                issueDate: formatDate(r.issueDate),
                dueDate: formatDate(r.dueDate),
              })),
            )
          }
        >
          Export CSV
        </Button>
      </div>
    </div>
  );

  return (
    <DataTable
      caption="Invoices"
      columns={columns}
      rows={filtered}
      isFiltered={pills.length > 0}
      onRowClick={(r) => router.push(`/invoices/${r.id}`)}
      toolbar={toolbar}
      pills={
        <FilterPills
          filters={pills}
          onRemove={(key) => setFilters({ status: filters.status.filter((s) => `status:${s}` !== key) })}
          onClear={clearFilters}
        />
      }
      empty={
        <EmptyState
          icon={<IconDocument width={22} height={22} />}
          title="No invoices yet"
          body="When your GCO team issues an invoice, it shows up here to review and pay."
        />
      }
      filteredEmpty={
        <EmptyState
          icon={<IconFilter width={22} height={22} />}
          title="No invoices match these filters"
          body="Try widening the status filter to see more."
          action={
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      }
    />
  );
}
