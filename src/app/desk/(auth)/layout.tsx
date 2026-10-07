// Public desk auth shell: fog page, centered card, GCO wordmark above. No
// marketing, no client-portal chrome.
export default function DeskAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-page px-4 py-12">
      <div className="mb-1 font-heading text-[22px] font-extrabold tracking-tight text-accent-primary">GCO Partners</div>
      <div className="mb-6 text-[13px] text-ink-tertiary">Service Desk</div>
      <div className="w-full max-w-auth-card rounded-card bg-surface-card p-8 shadow-md">{children}</div>
      <p className="mt-6 text-[13px] text-ink-tertiary">Employees only</p>
    </div>
  );
}
