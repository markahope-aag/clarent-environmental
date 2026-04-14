import { auth } from '@clerk/nextjs/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  appOrganizations,
  generatorContacts,
  generatorLocations,
  generators,
  wasteStreams,
} from '@/lib/db/schema';
import IntakeForm from './intake-form';

type SearchParams = Promise<{ created?: string }>;

export default async function GeneratorHomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const justCreated = params.created === '1';

  const { userId, orgId } = await auth();

  // Waste stream options for the dropdown
  const streams = await db
    .select({
      key: wasteStreams.key,
      name: wasteStreams.name,
      framework: wasteStreams.wasteFramework,
      lane: wasteStreams.laneEligibility,
    })
    .from(wasteStreams)
    .where(eq(wasteStreams.active, true))
    .orderBy(asc(wasteStreams.name));

  // Pre-fill business fields for signed-in users with an active org
  let prefill = null;
  if (userId && orgId) {
    const rows = await db
      .select({
        generatorId: generators.id,
        generatorName: generators.name,
        industry: generators.industry,
        addressLine1: generatorLocations.addressLine1,
        city: generatorLocations.city,
        state: generatorLocations.state,
        postalCode: generatorLocations.postalCode,
        phone: generatorContacts.phone,
      })
      .from(appOrganizations)
      .leftJoin(generators, eq(appOrganizations.generatorId, generators.id))
      .leftJoin(generatorLocations, eq(generatorLocations.generatorId, generators.id))
      .leftJoin(generatorContacts, eq(generatorContacts.generatorId, generators.id))
      .where(eq(appOrganizations.clerkOrganizationId, orgId))
      .limit(1);

    const row = rows[0];
    if (row?.generatorId) {
      prefill = {
        businessName: row.generatorName ?? '',
        industry: row.industry,
        addressLine1: row.addressLine1,
        city: row.city,
        state: row.state,
        postalCode: row.postalCode,
        phone: row.phone,
      };
    }
  }

  return (
    <>
      {justCreated && (
        <div className="border-b border-green-200 bg-green-50 px-6 py-3 text-sm text-green-900">
          <div className="mx-auto max-w-2xl">
            <span className="font-semibold">Account created.</span> Your pickup request is
            on file — we&rsquo;ll be in touch shortly.
          </div>
        </div>
      )}
      <IntakeForm streams={streams} prefill={prefill} isSignedIn={!!userId} />
    </>
  );
}
