'use server';

import { auth } from '@clerk/nextjs/server';
import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { classify } from '@/lib/classification';
import { db } from '@/lib/db/client';
import {
  appOrganizations,
  generatorLocations,
  generators,
  jobWasteStreams,
  jobs,
  wasteStreams,
} from '@/lib/db/schema';
import { setPendingIntakeCookie, type PendingIntake } from '@/lib/intake-cookie';

export type IntakeFormState = {
  ok: boolean;
  error?: string;
  message?: string;
  /** Populated when a real job was created. UI can redirect there. */
  jobId?: string;
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

const generateReferenceNumber = (): string => {
  const year = new Date().getFullYear();
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  return `CLR-${year}-${suffix}`;
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
 * This path inserts a real `jobs` row plus a `job_waste_streams` row,
 * runs the rule-based classifier to decide Lane 1 vs Lane 2, and
 * redirects the caller to the job detail view.
 */
export async function submitIntakeAction(
  _prev: IntakeFormState,
  formData: FormData,
): Promise<IntakeFormState> {
  const intent = (formData.get('intent') as string | null) ?? 'pickup_request';
  const input = parseIntakeForm(formData);

  const businessError = validateBusiness(input);
  if (businessError) return { ok: false, error: businessError };

  if (intent === 'pickup_request') {
    const wasteError = validateWaste(input);
    if (wasteError) return { ok: false, error: wasteError };
  } else {
    input.wasteStreamKey = '';
    input.containerType = '';
    input.containerCount = 0;
  }

  const { userId, orgId } = await auth();

  // ---------------------------------------------------------------------------
  // Signed-in path
  // ---------------------------------------------------------------------------
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
    const generatorId: string = link.generatorId;

    // Update the generator's primary location + industry with any edits
    if (input.addressLine1 || input.city || input.state || input.postalCode) {
      await db
        .update(generatorLocations)
        .set({
          addressLine1: input.addressLine1 || null,
          city: input.city || null,
          state: input.state || null,
          postalCode: input.postalCode || null,
        })
        .where(
          and(
            eq(generatorLocations.generatorId, generatorId),
            eq(generatorLocations.isPrimary, true),
          ),
        );
    }

    if (input.industry) {
      await db
        .update(generators)
        .set({ industry: input.industry })
        .where(eq(generators.id, generatorId));
    }

    // account_only: no job creation, just profile updates
    if (intent === 'account_only') {
      return { ok: true, message: 'Profile updated.' };
    }

    // Resolve the waste stream metadata for classification
    const [stream] = await db
      .select({
        key: wasteStreams.key,
        laneEligibility: wasteStreams.laneEligibility,
        wasteFramework: wasteStreams.wasteFramework,
      })
      .from(wasteStreams)
      .where(eq(wasteStreams.key, input.wasteStreamKey))
      .limit(1);

    if (!stream) {
      return { ok: false, error: 'Unknown waste type. Please choose from the list.' };
    }

    // Find primary location
    const [location] = await db
      .select({ id: generatorLocations.id })
      .from(generatorLocations)
      .where(
        and(
          eq(generatorLocations.generatorId, generatorId),
          eq(generatorLocations.isPrimary, true),
        ),
      )
      .limit(1);

    if (!location?.id) {
      return {
        ok: false,
        error: 'No primary pickup location on file. Please complete your profile.',
      };
    }
    const locationId: string = location.id;

    // Run the classifier
    const classification = classify({
      stream: { key: stream.key, laneEligibility: stream.laneEligibility },
      containerType: input.containerType,
      containerCount: input.containerCount,
      // Intake form doesn't yet capture condition — assume intact for first pass.
      // Phase 3 intake wizard will collect this explicitly.
      containerCondition: 'intact',
      unContainerCertified: true,
      generatorCertifiedNoMixing: true,
    });

    // Insert job + waste stream in one transaction
    let createdJobId: string | undefined;
    const referenceNumber = generateReferenceNumber();
    try {
      await db.transaction(async (tx) => {
        const [job] = await tx
          .insert(jobs)
          .values({
            referenceNumber,
            generatorId,
            generatorLocationId: locationId,
            state: classification.lane === 'lane_1' ? 'classified_standard' : 'classified_complex',
            lane: classification.lane,
            wasteFramework: stream.wasteFramework,
            classificationConfidence: classification.confidence.toFixed(2),
            notes: input.notes || null,
          })
          .returning({ id: jobs.id });

        createdJobId = job.id;

        await tx.insert(jobWasteStreams).values({
          jobId: job.id,
          wasteStreamKey: input.wasteStreamKey,
          containerType: input.containerType,
          containerCount: input.containerCount,
          unContainerCertified: true,
        });
      });
    } catch (err) {
      console.error('job creation failed:', err);
      return {
        ok: false,
        error: 'Could not submit your request. Please try again.',
      };
    }

    if (createdJobId) {
      redirect(`/generator/jobs/${createdJobId}`);
    }

    return { ok: false, error: 'Job creation succeeded but no job id returned.' };
  }

  // ---------------------------------------------------------------------------
  // Anonymous path
  // ---------------------------------------------------------------------------
  await setPendingIntakeCookie(input);
  redirect('/sign-up?redirect_url=/generator/finalize');
}
