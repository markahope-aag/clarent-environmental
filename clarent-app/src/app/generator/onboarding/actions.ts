'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db/client';
import {
  appOrganizations,
  generatorContacts,
  generatorLocations,
  generators,
} from '@/lib/db/schema';

export type OnboardingFormState = {
  ok: boolean;
  error?: string;
};

type OnboardingInput = {
  businessName: string;
  generatorClass: 'VSQG' | 'SQG' | 'LQG' | null;
  industry: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
};

/**
 * Server action called from the onboarding form. Provisions the full Clarent
 * account hierarchy for a freshly signed-up user:
 *
 *   1. Creates a Clerk organization (user becomes first admin)
 *   2. Inserts a `generators` row
 *   3. Inserts the primary `generator_locations` row
 *   4. Inserts an `app_organizations` row linking Clerk org ↔ generator
 *   5. Inserts a `generator_contacts` row for the signup user
 *
 * Also sets Clerk organization public metadata so the webhook handler knows
 * the org type on subsequent updates. All Supabase writes run in a single
 * transaction so a partial failure rolls back cleanly.
 */
export async function createGeneratorOrganizationAction(
  _prev: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: 'Not signed in' };
  }

  const input: OnboardingInput = {
    businessName: (formData.get('businessName') as string | null)?.trim() ?? '',
    generatorClass:
      (formData.get('generatorClass') as 'VSQG' | 'SQG' | 'LQG' | null) || null,
    industry: (formData.get('industry') as string | null)?.trim() ?? '',
    addressLine1: (formData.get('addressLine1') as string | null)?.trim() ?? '',
    city: (formData.get('city') as string | null)?.trim() ?? '',
    state: (formData.get('state') as string | null)?.trim().toUpperCase() ?? '',
    postalCode: (formData.get('postalCode') as string | null)?.trim() ?? '',
  };

  if (!input.businessName) return { ok: false, error: 'Business name is required' };
  if (!input.state || input.state.length !== 2) {
    return { ok: false, error: 'State must be a 2-letter code' };
  }

  // 1. Create the Clerk organization
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);

  const org = await clerk.organizations.createOrganization({
    name: input.businessName,
    createdBy: userId,
    publicMetadata: {
      organization_type: 'generator',
    },
  });

  // 2-5. Insert Clarent entities in one transaction
  try {
    await db.transaction(async (tx) => {
      const [newGenerator] = await tx
        .insert(generators)
        .values({
          clerkOrganizationId: org.id,
          name: input.businessName,
          generatorClass: input.generatorClass,
          industry: input.industry || null,
          status: 'active',
          marketingStage: 'customer',
        })
        .returning({ id: generators.id });

      const [newLocation] = await tx
        .insert(generatorLocations)
        .values({
          generatorId: newGenerator.id,
          name: input.businessName,
          addressLine1: input.addressLine1 || null,
          city: input.city || null,
          state: input.state,
          postalCode: input.postalCode || null,
          isPrimary: true,
          active: true,
        })
        .returning({ id: generatorLocations.id });

      await tx.insert(appOrganizations).values({
        clerkOrganizationId: org.id,
        organizationType: 'generator',
        generatorId: newGenerator.id,
        name: org.name,
        slug: org.slug ?? null,
        imageUrl: org.imageUrl ?? null,
      });

      await tx.insert(generatorContacts).values({
        generatorId: newGenerator.id,
        locationId: newLocation.id,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        email: user.primaryEmailAddress?.emailAddress ?? null,
        role: 'primary',
        isAuthorizedSigner: true,
        active: true,
      });
    });
  } catch (err) {
    // Supabase insert failed — roll back the Clerk org so state stays consistent.
    console.error('onboarding transaction failed, rolling back Clerk org:', err);
    await clerk.organizations.deleteOrganization(org.id).catch((cleanupErr) => {
      console.error('failed to delete clerk org during rollback:', cleanupErr);
    });
    return {
      ok: false,
      error: 'Could not create your account. Please try again.',
    };
  }

  // Next request should carry the new organization context automatically
  // since the user has only one organization.
  redirect('/generator');
}
