import { requirePermission } from '@/lib/context';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/shell/PageHeader';
import { DocumentsView, type DocRow } from '@/components/features/documents/DocumentsView';

export default async function DocumentsPage() {
  const ctx = await requirePermission('documents.view');

  const docs = await ctx.db.document.findMany({
    orderBy: { createdAt: 'desc' },
    include: { uploadedBy: { select: { name: true, email: true } } },
  });

  const rows: DocRow[] = docs.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    period: d.period,
    uploadedBy: d.uploadedBy.name ?? d.uploadedBy.email ?? 'Unknown',
    createdAt: d.createdAt.toISOString(),
    status: d.status as DocRow['status'],
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Workspace"
        title="Documents"
        description="Upload statements and share files with your GCO team."
      />
      <DocumentsView rows={rows} canUpload={can(ctx.effectiveRole, 'documents.upload')} />
    </div>
  );
}
