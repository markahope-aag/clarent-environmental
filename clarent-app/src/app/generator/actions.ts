'use server';

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { setPendingIntakeCookie, type PendingIntake } from '@/lib/intake-cookie';
import { db } from '@/lib/db/client';
import { appOrganizations, generatorLocations, generators } from '@/lib/db/schema';

export type IntakeFormState = {
  ok: boolean;
  error?: string;
  message?: string;
};

const parseIntakeForm = (formData: FormData): PendingIntake => ({
  businessName: (formData.get('businessName') as string | null)?.trim() ?? '',
  industry: (formData.get('industry') as string | null)?.trim() ?? '',
  addressLine1: (formData.get('addressLine1') as string | null)?.trim() ?? '',
  city: (formData.get('city') as string | null)?.trim() ?? '',
  state: ((formData.get('state') as string | null)?.trim() ?? '').toUpperCase(),
  postalCode: (formData.get('postalCode') as string | null)?.trim() ?? '',
  contactPhone: (formData.get('contactPhone') as string | null)?.trim() ?? '',
  wasteStreamKey: (formData.get('wasteStreamKey') as string | null) ?? '',
  containerType: (formData.get('containerType') as string | null) ?? '',
  containerCount: parseInt((formData.get('containerCount') as string | null) ?? '0', 10) || 0,
  notes: (formData.get('notes') as string | null)?.trim() ?? '',
  createdAt: Date.now(),
});

const validateBusiness = (input: PendingIntake): string | null => {
  if (!input.businessName) return 'Business name is required';
  if (!input.state || input.state.length !== 2) return 'State must be a 2-letter code';
  return null;
};

const validateWaste = (input: PendingIntake): string | null => {
  if (!input.wasteStreamKey) return 'Please select a waste type';
  if (!input.containerType) return 'Please select a container type';
  if (input.containerCount < 1) return 'Container count must be at least 1';
  return null;
};

/**
 * Intake form server action.
 *
 * Anonymous path: validate the form, save it to the pending-intake cookie,
 * and redirect into Clerk's hosted sign-up with a redirect back to
 * `/generator/finalize`. That finalize route reads the cookie and provisions
 * the full Clarent account hierarchy once the Clerk user is created.
 *
 * Signed-in path: the user already has an active generator organization.
 * For now this returns a "request received" state without creating job
 * records — full job creation, Lane 1/2 routing, certification, and pricing
 * are Phase 3 work.
 */
export async function submitIntakeAction(
  _prev: IntakeFormState,
  formData: FormData,
): Promise<IntakeFormState> {
  // Intent is set by the submitter button's `name=intent value=...` attribute.
  // - 'pickup_request' (default): user wants to schedule a pickup, validate everything
  // - 'account_only': user just wants to set up a Clarent account, skip waste validation
  const intent = (formData.get('intent') as string | null) ?? 'pickup_request';
  const input = parseIntakeForm(formData);

  const businessError = validateBusiness(input);
  if (businessError) return { ok: false, error: businessError };

  if (intent === 'pickup_request') {
    const wasteError = validateWaste(input);
    if (wasteError) return { ok: false, error: wasteError };
  } else {
    // Account-only signups: clear any partially-filled waste fields so the
    // cookie doesn't carry a half-request into finalize.
    input.wasteStreamKey = '';
    input.containerType = '';
    input.containerCount = 0;
  }

  const { userId, orgId } = await auth();

  // Signed-in with active org → would create a job here (Phase 3 scope)
  if (userId && orgId) {
    const [link] = await db
      .select({ generatorId: appOrganizations.generatorId })
      .from(appOrganizations)
      .where(eq(appOrganizations.clerkOrganizationId, orgId))
      .limit(1);

    if (!link?.generatorId) {
      return {
        ok: false,
        error: 'Your account is not linked to a generator. Contact support.',
      };
    }

    // Optionally update the generator's primary location with any changed
    // address details the user edited on this intake.
    if (input.addressLine1 || input.city || input.state || input.postalCode) {
      await db
        .update(generatorLocations)
        .set({
          addressLine1: input.addressLine1 || null,
          city: input.city || null,
          state: input.state || null,
          postalCode: input.postalCode || null,
        })
        .where(eq(generatorLocations.generatorId, link.generatorId));
    }

    if (input.industry) {
      await db
        .update(generators)
        .set({ industry: input.industry })
        .where(eq(generators.id, link.generatorId));
    }

    return {
      ok: true,
      message:
        intent === 'account_only'
          ? 'Profile updated.'
          : 'Request received. Full job creation, Lane 1 pricing, and the certification step arrive in Phase 3.',
    };
  }

  // Anonymous → stash intake and redirect into Clerk sign-up
  await setPendingIntakeCookie(input);
  redirect('/sign-up?redirect_url=/generator/finalize');
}
