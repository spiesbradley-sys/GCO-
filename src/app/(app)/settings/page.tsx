import { requireTenantContext } from '@/lib/context';
import { PageHeader } from '@/components/shell/PageHeader';
import { Card, CardTitle } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Badge';
import { ROLE_LABELS } from '@/lib/rbac';

// Placeholder settings surface — enough to anchor the account menu. Extend with
// profile, notification, and (owner-only) member management screens.
export default async function SettingsPage() {
  const ctx = await requireTenantContext();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Account" title="Settings" description="Your profile and workspace." />
      <Card className="max-w-xl">
        <CardTitle className="mb-4">Profile</CardTitle>
        <dl className="grid grid-cols-[120px_1fr] gap-y-3 text-[15px]">
          <dt className="text-ink-tertiary">Name</dt>
          <dd className="text-ink">{ctx.user.name ?? '—'}</dd>
          <dt className="text-ink-tertiary">Email</dt>
          <dd className="text-ink">{ctx.user.email}</dd>
          <dt className="text-ink-tertiary">Role</dt>
          <dd>
            <Pill>{ROLE_LABELS[ctx.effectiveRole]}</Pill>
          </dd>
          <dt className="text-ink-tertiary">Workspace</dt>
          <dd className="text-ink">{ctx.activeOrg.orgName}</dd>
        </dl>
      </Card>
    </div>
  );
}
