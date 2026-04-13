import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import OnboardingForm from './onboarding-form';

export default async function GeneratorOnboardingPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect('/generator');
  }

  // Already has an active org → send back to the dashboard
  if (orgId) {
    redirect('/generator');
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
          Generator portal · Setup
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Tell us about your business.</h1>
        <p className="mt-2 text-sm text-zinc-600">
          This creates your Clarent account. You can add additional locations and team members
          later from your profile.
        </p>
        <div className="mt-8">
          <OnboardingForm />
        </div>
      </div>
    </div>
  );
}
