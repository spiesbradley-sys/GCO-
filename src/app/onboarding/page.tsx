import { requireUser } from '@/lib/context';
import { OnboardingWizard } from '@/components/features/onboarding/OnboardingWizard';

// Onboarding requires a signed-in user but NOT a membership — this is where a
// user with no org lands. Do not call requireTenantContext here (it redirects
// back to /onboarding when there's no membership).
export default async function OnboardingPage() {
  await requireUser();
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-12">
      <OnboardingWizard />
    </div>
  );
}
