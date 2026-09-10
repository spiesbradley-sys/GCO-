import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/context';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/shell/PageHeader';
import { Card } from '@/components/ui/Card';
import { Banner } from '@/components/ui/Banner';
import { StatusBadge, INVOICE_STATUS, PAYMENT_STATUS } from '@/components/ui/Badge';
import { PayButton } from '@/components/features/invoices/PayButton';
import { formatCurrency, formatDate } from '@/lib/utils';

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { paid?: string };
}) {
  const ctx = await requirePermission('invoices.view');

  // Tenant-guarded: findFirst filters by orgId, so a cross-tenant id 404s.
  const invoice = await ctx.db.invoice.findFirst({
    where: { id: params.id },
    include: { practice: { select: { name: true } }, payments: { orderBy: { createdAt: 'desc' } } },
  });
  if (!invoice) notFound();

  const status = INVOICE_STATUS[invoice.status];
  const payable = invoice.status === 'sent' || invoice.status === 'overdue';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Invoices"
        title={`Invoice ${invoice.number}`}
        description={invoice.practice?.name ?? undefined}
        action={
          can(ctx.effectiveRole, 'invoices.pay') && payable ? (
            <PayButton invoiceId={invoice.id} />
          ) : undefined
        }
      />

      {searchParams.paid === '1' && (
        <Banner tone="favorable">
          Payment received. We&apos;ll update this invoice once Stripe confirms — usually within a
          moment.
        </Banner>
      )}

      <Card className="max-w-2xl">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Amount">
            <span className="font-numeric text-[20px] font-bold tnum">
              {formatCurrency(invoice.amountCents, invoice.currency)}
            </span>
          </Field>
          <Field label="Status">
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </Field>
          <Field label="Issued">{formatDate(invoice.issueDate)}</Field>
          <Field label="Due">{formatDate(invoice.dueDate)}</Field>
        </dl>
      </Card>

      <Card className="max-w-2xl">
        <h3 className="mb-4 font-heading text-card-title">Payment history</h3>
        {invoice.payments.length === 0 ? (
          <p className="text-[15px] text-ink-secondary">No payment attempts yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {invoice.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <span className="text-[14px] text-ink-secondary">{formatDate(p.createdAt)}</span>
                <span className="font-numeric tnum text-[14px]">
                  {formatCurrency(p.amountCents, p.currency)}
                </span>
                <StatusBadge tone={PAYMENT_STATUS[p.status].tone}>
                  {PAYMENT_STATUS[p.status].label}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[13px] font-semibold text-ink-tertiary">{label}</dt>
      <dd className="text-[15px] text-ink">{children}</dd>
    </div>
  );
}
