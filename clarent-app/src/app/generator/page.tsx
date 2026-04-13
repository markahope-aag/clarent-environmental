import { auth } from '@clerk/nextjs/server';
import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db/client';
import { appOrganizations, generators } from '@/lib/db/schema';

export default async function GeneratorHomePage() {
  const { userId, orgId } = await auth();

  // Anonymous — show the welcome + sign up call to action
  if (!userId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <div className="max-w-xl text-center">
          <div className="mb-3 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
            Generator portal
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Hazardous waste disposal made simple.
          </h1>
          <p className="mt-4 text-zinc-600">
            Book compliant pickups, track jobs in real time, and manage your compliance calendar —
            all in one place.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <SignUpButton>
              <button className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800">
                Create account
              </button>
            </SignUpButton>
            <SignInButton>
              <button className="rounded-full border border-black/10 px-5 py-2 text-sm font-medium transition-colors hover:bg-black/5">
                Sign in
              </button>
            </SignInButton>
          </div>
        </div>
      </div>
    );
  }

  // Signed in but no active organization → onboarding
  if (!orgId) {
    redirect('/generator/onboarding');
  }

  // Signed in with an active organization → look up the linked generator
  const [link] = await db
    .select({
      generatorId: appOrganizations.generatorId,
      name: generators.name,
    })
    .from(appOrganizations)
    .leftJoin(generators, eq(appOrganizations.generatorId, generators.id))
    .where(eq(appOrganizations.clerkOrganizationId, orgId))
    .limit(1);

  // Org exists in Clerk but not yet linked to a generator (webhook race or
  // manual org creation outside the onboarding flow). Send to onboarding to
  // complete the profile.
  if (!link?.generatorId) {
    redirect('/generator/onboarding');
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="max-w-xl text-center">
        <div className="mb-3 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
          Generator portal
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back.</h1>
        <p className="mt-4 text-zinc-600">
          You&rsquo;re signed in as{' '}
          <span className="font-medium text-zinc-900">{link.name}</span>.
        </p>
        <p className="mt-6 text-sm text-zinc-500">
          Intake wizard, instant quotes, and job tracker arrive in Phase 3.
        </p>
      </div>
    </div>
  );
}
