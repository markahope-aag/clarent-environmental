import { auth, clerkClient } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db/client';
import {
  appOrganizations,
  generatorContacts,
  generatorLocations,
  generators,
} from '@/lib/db/schema';
import { clearPendingIntakeCookie, readPendingIntakeCookie } from '@/lib/intake-cookie';

/**
 * Post-sign-up finalization route.
 *
 * Clerk's hosted sign-up redirects here after the user creates an account.
 * We pick up the pending intake from the cookie set earlier by the intake
 * form, create the Clerk organization (with organization_type metadata),
 * provision the Clarent account hierarchy in a transaction, and redirect
 * to /generator with a welcome banner.
 *
 * If the user arrives here without a pending intake cookie (e.g. they
 * signed up directly without filling out the form), we send them back to
 * /generator so they can start an intake with an already-created account.
 */
export default async function GeneratorFinalizePage() {
  const { userId } = await auth();

  if (!userId) {
    // Clerk bounced them here somehow without a session — send to sign-up
    redirect('/sign-up?redirect_url=/generator/finalize');
  }

  const intake = await readPendingIntakeCookie();
  if (!intake) {
    redirect('/generator');
  }

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);

  // Create the Clerk organization. If the user already has this org from a
  // prior attempt, we'll get an error — catch and continue so re-runs are
  // safe.
  let org: Awaited<ReturnType<typeof clerk.organizations.createOrganization>>;
  try {
    org = await clerk.organizations.createOrganization({
      name: intake.businessName,
      createdBy: userId,
      publicMetadata: { organization_type: 'generator' },
    });
  } catch (err) {
    console.error('failed to create Clerk organization during finalize:', err);
    await clearPendingIntakeCookie();
    redirect('/generator');
  }

  try {
    await db.transaction(async (tx) => {
      // Insert generator
      const [newGenerator] = await tx
        .insert(generators)
        .values({
          clerkOrganizationId: org.id,
          name: intake.businessName,
          industry: intake.industry || null,
          status: 'active',
          marketingStage: 'customer',
        })
        .returning({ id: generators.id });

      // Insert primary location
      const [newLocation] = await tx
        .insert(generatorLocations)
        .values({
          generatorId: newGenerator.id,
          name: intake.businessName,
          addressLine1: intake.addressLine1 || null,
          city: intake.city || null,
          state: intake.state || null,
          postalCode: intake.postalCode || null,
          phone: intake.contactPhone || null,
          isPrimary: true,
          active: true,
        })
        .returning({ id: generatorLocations.id });

      // Link Clerk org → generator via app_organizations. Upsert in case
      // the Clerk webhook already landed a row for this organization.
      await tx
        .insert(appOrganizations)
        .values({
          clerkOrganizationId: org.id,
          organizationType: 'generator',
          generatorId: newGenerator.id,
          name: org.name,
          slug: org.slug ?? null,
          imageUrl: org.imageUrl ?? null,
        })
        .onConflictDoUpdate({
          target: appOrganizations.clerkOrganizationId,
          set: {
            organizationType: 'generator',
            generatorId: newGenerator.id,
            name: org.name,
            slug: org.slug ?? null,
            imageUrl: org.imageUrl ?? null,
          },
        });

      // Primary contact row for the signup user
      await tx.insert(generatorContacts).values({
        generatorId: newGenerator.id,
        locationId: newLocation.id,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        email: user.primaryEmailAddress?.emailAddress ?? null,
        phone: intake.contactPhone || null,
        role: 'primary',
        isAuthorizedSigner: true,
        active: true,
      });
    });
  } catch (err) {
    console.error('finalize transaction failed — rolling back Clerk org:', err);
    await clerk.organizations.deleteOrganization(org.id).catch((e) =>
      console.error('rollback delete failed:', e),
    );
    await clearPendingIntakeCookie();
    redirect('/generator');
  }

  await clearPendingIntakeCookie();
  redirect('/generator?created=1');
}
