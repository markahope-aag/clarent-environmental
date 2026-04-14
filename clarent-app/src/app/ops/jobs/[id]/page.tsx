import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db/client';
import {
  generatorContacts,
  generatorLocations,
  generators,
  jobWasteStreams,
  jobs,
  vendors,
} from '@/lib/db/schema';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OpsJobDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [job] = await db
    .select({
      id: jobs.id,
      referenceNumber: jobs.referenceNumber,
      state: jobs.state,
      lane: jobs.lane,
      wasteFramework: jobs.wasteFramework,
      confidence: jobs.classificationConfidence,
      requestedPickupWindow: jobs.requestedPickupWindow,
      scheduledPickupDate: jobs.scheduledPickupDate,
      estimatedTotal: jobs.estimatedTotal,
      finalTotal: jobs.finalTotal,
      depositAmount: jobs.depositAmount,
      balanceAmount: jobs.balanceAmount,
      notes: jobs.notes,
      createdAt: jobs.createdAt,
      stateChangedAt: jobs.stateChangedAt,
      generatorName: generators.name,
      generatorClass: generators.generatorClass,
      generatorIndustry: generators.industry,
      locationCity: generatorLocations.city,
      locationState: generatorLocations.state,
      locationAddress: generatorLocations.addressLine1,
      locationZip: generatorLocations.postalCode,
      vendorName: vendors.name,
      vendorType: vendors.vendorType,
    })
    .from(jobs)
    .leftJoin(generators, eq(jobs.generatorId, generators.id))
    .leftJoin(generatorLocations, eq(jobs.generatorLocationId, generatorLocations.id))
    .leftJoin(vendors, eq(jobs.selectedVendorId, vendors.id))
    .where(eq(jobs.id, id))
    .limit(1);

  if (!job) {
    notFound();
  }

  const wasteStreams = await db
    .select({
      wasteStreamKey: jobWasteStreams.wasteStreamKey,
      containerType: jobWasteStreams.containerType,
      containerCount: jobWasteStreams.containerCount,
      estimatedWeightLbs: jobWasteStreams.estimatedWeightLbs,
    })
    .from(jobWasteStreams)
    .where(eq(jobWasteStreams.jobId, id));

  const contacts = await db
    .select({
      firstName: generatorContacts.firstName,
      lastName: generatorContacts.lastName,
      email: generatorContacts.email,
      phone: generatorContacts.phone,
      role: generatorContacts.role,
    })
    .from(generatorContacts)
    .innerJoin(jobs, eq(generatorContacts.generatorId, jobs.generatorId))
    .where(eq(jobs.id, id));

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-4">
        <Link
          href="/jobs"
          className="text-xs font-medium tracking-wide text-zinc-500 uppercase hover:text-zinc-900"
        >
          ← Back to pipeline
        </Link>
      </div>

      <div className="mb-1 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
        Ops console · Job detail
      </div>
      <h1 className="font-mono text-2xl font-semibold tracking-tight">{job.referenceNumber}</h1>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-black/10 bg-zinc-50 px-3 py-1 font-medium">
          {job.state}
        </span>
        {job.lane && (
          <span className="rounded-full border border-black/10 bg-zinc-50 px-3 py-1">
            {job.lane === 'lane_1' ? 'Lane 1' : 'Lane 2'}
            {job.confidence && ` · ${Math.round(Number(job.confidence))}% confidence`}
          </span>
        )}
        {job.wasteFramework && (
          <span className="rounded-full border border-black/10 bg-zinc-50 px-3 py-1">
            {job.wasteFramework.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        {/* Generator panel */}
        <section>
          <h2 className="mb-3 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
            Generator
          </h2>
          <dl className="space-y-2 rounded-lg border border-black/10 bg-white px-4 py-3 text-sm">
            <DlRow label="Name" value={job.generatorName} />
            <DlRow label="Class" value={job.generatorClass} />
            <DlRow label="Industry" value={job.generatorIndustry} />
            <DlRow
              label="Location"
              value={
                [job.locationAddress, job.locationCity, job.locationState, job.locationZip]
                  .filter(Boolean)
                  .join(', ') || null
              }
            />
          </dl>
        </section>

        {/* Vendor panel */}
        <section>
          <h2 className="mb-3 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
            Vendor
          </h2>
          <dl className="space-y-2 rounded-lg border border-black/10 bg-white px-4 py-3 text-sm">
            <DlRow label="Assigned" value={job.vendorName ?? 'None yet'} />
            {job.vendorType && <DlRow label="Type" value={job.vendorType.replace(/_/g, ' ')} />}
          </dl>
        </section>

        {/* Waste panel */}
        <section className="md:col-span-2">
          <h2 className="mb-3 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
            Waste streams
          </h2>
          <ul className="divide-y divide-black/5 rounded-lg border border-black/10 bg-white">
            {wasteStreams.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-zinc-500">
                No waste streams on this job
              </li>
            )}
            {wasteStreams.map((w, i) => (
              <li key={i} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <div className="text-sm font-medium">{w.wasteStreamKey.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-zinc-500">
                    {w.containerCount} × {w.containerType.replace(/_/g, ' ')}
                    {w.estimatedWeightLbs && ` · ~${w.estimatedWeightLbs} lbs`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Contacts */}
        {contacts.length > 0 && (
          <section className="md:col-span-2">
            <h2 className="mb-3 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
              Contacts
            </h2>
            <ul className="divide-y divide-black/5 rounded-lg border border-black/10 bg-white">
              {contacts.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">
                      {[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {c.role} · {c.email ?? '—'} · {c.phone ?? '—'}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Financial */}
        {(job.estimatedTotal || job.finalTotal || job.depositAmount || job.balanceAmount) && (
          <section className="md:col-span-2">
            <h2 className="mb-3 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
              Financial
            </h2>
            <dl className="grid grid-cols-2 gap-4 rounded-lg border border-black/10 bg-white px-4 py-3 text-sm sm:grid-cols-4">
              <DlRow label="Estimated" value={formatCurrency(job.estimatedTotal)} />
              <DlRow label="Final" value={formatCurrency(job.finalTotal)} />
              <DlRow label="Deposit" value={formatCurrency(job.depositAmount)} />
              <DlRow label="Balance" value={formatCurrency(job.balanceAmount)} />
            </dl>
          </section>
        )}

        {/* Notes */}
        {job.notes && (
          <section className="md:col-span-2">
            <h2 className="mb-3 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
              Notes
            </h2>
            <p className="rounded-md border border-black/10 bg-zinc-50 px-4 py-3 text-sm whitespace-pre-wrap">
              {job.notes}
            </p>
          </section>
        )}
      </div>

      <div className="mt-10 text-xs text-zinc-400">
        Created {new Date(job.createdAt).toLocaleString()} · Last state change{' '}
        {new Date(job.stateChangedAt).toLocaleString()}
      </div>
    </div>
  );
}

function DlRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5 md:flex-row md:items-center md:justify-between md:gap-4">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-sm font-medium">{value || <span className="text-zinc-300">—</span>}</dd>
    </div>
  );
}

function formatCurrency(value: string | null): string | null {
  if (!value) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return num.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}
