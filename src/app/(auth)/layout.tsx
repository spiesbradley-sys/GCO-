// Auth shell: fog page, centered card, logo above. No marketing hero, no
// split-screen photo.
import { BrandLogo } from '@/components/shell/BrandLogo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-page px-4 py-12">
      <div className="mb-6 w-full max-w-[216px]">
        <BrandLogo />
      </div>
      <div className="w-full max-w-auth-card rounded-card bg-surface-card p-8 shadow-md">
        {children}
      </div>
      <p className="mt-6 text-[13px] text-ink-tertiary">
        Client portal &amp; diligence workspace
      </p>
    </div>
  );
}
