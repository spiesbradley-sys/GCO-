// Persistent, always-visible banner while GCO staff view a client account.
// Impersonation is never hidden. Uses the brand gold (not a data-semantic tint)
// because it's a chrome-level state, not a data-health signal.
export function ImpersonationBanner({ orgName }: { orgName: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-accent-primary px-4 py-2 text-center text-[13px] font-semibold text-white"
    >
      Viewing {orgName} as GCO staff
    </div>
  );
}
