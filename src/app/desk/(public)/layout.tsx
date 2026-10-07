// Public onboarding shell — GCO branded, no desk navigation, no desk data. The
// only desk-related page reachable without a login.
export default function PublicDeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-page">
      <header className="border-b border-border-subtle bg-surface-card">
        <div className="mx-auto flex max-w-2xl items-center px-5 py-4">
          <span className="font-heading text-[18px] font-extrabold tracking-tight text-accent-primary">GCO Partners</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-10">{children}</main>
    </div>
  );
}
