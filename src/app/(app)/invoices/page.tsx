import { requirePermission } from '@/lib/context';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/shell/PageHeader';
import { InvoicesView, type InvoiceRow } from '@/components/features/invoices/InvoicesView';

export default async function InvoicesPage() {
  const ctx = await requirePermission('invoices.view');

  // Tenant-guarded read — only this org's invoices, ever.
  const invoices = await ctx.db.invoice.findMany({
    orderBy: { issueDate: 'desc' },
    include: { practice: { select: { name: true } } },
  });

  const rows: InvoiceRow[] = invoices.map((i) => ({
    id: i.id,
    number: i.number,
    practice: i.practice?.name ?? null,
    amountCents: i.amountCents,
    currency: i.currency,
    status: i.status as InvoiceRow['status'],
    issueDate: i.issueDate.toISOString(),
    dueDate: i.dueDate?.toISOString() ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Close"
        title="Invoices"
        description="Review and pay invoices for this engagement."
      />
      <InvoicesView rows={rows} contextKey={ctx.orgId} canPay={can(ctx.effectiveRole, 'invoices.pay')} />
    </div>
  );
}
