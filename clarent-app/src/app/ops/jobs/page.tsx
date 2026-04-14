import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { generators, generatorLocations, jobs, vendors } from '@/lib/db/schema';

const STATE_GROUPS = {
  review: new Set(['draft', 'classified_standard', 'classified_complex']),
  priced: new Set(['priced', 'quote_sent', 'quote_accepted']),
  payment: new Set(['advance_paid']),
  routing: new Set(['vendor_selected', 'vendor_notified']),
  pickup: new Set(['pickup_scheduled', 'balance_due', 'balance_paid', 'pickup_completed']),
  done: new Set(['documents_processing', 'completed']),
  exception: new Set(['non_compliant_flagged', 'disputed', 'cancelled', 'refunded']),
};

const GROUP_LABELS: Record<keyof typeof STATE_GROUPS, string> = {
  review: 'Classification review',
  priced: 'Priced / quoting',
  payment: 'Deposit received',
  routing: 'Vendor routing',
  pickup: 'Pickup',
  done: 'Completed',
  exception: 'Exceptions',
};

const GROUP_TONES: Record<keyof typeof STATE_GROUPS, string> = {
  review: 'bg-amber-50 text-amber-900 border-amber-200',
  priced: 'bg-blue-50 text-blue-900 border-blue-200',
  payment: 'bg-indigo-50 text-indigo-900 border-indigo-200',
  routing: 'bg-purple-50 text-purple-900 border-purple-200',
  pickup: 'bg-teal-50 text-teal-900 border-teal-200',
  done: 'bg-green-50 text-green-900 border-green-200',
  exception: 'bg-red-50 text-red-900 border-red-200',
};

function stateGroup(state: string): keyof typeof STATE_GROUPS | 'other' {
  for (const [group, set] of Object.entries(STATE_GROUPS) as [
    keyof typeof STATE_GROUPS,
    Set<string>,
  ][]) {
    if (set.has(state)) return group;
  }
  return 'other';
}

export default async function OpsJobsPage() {
  const rows = await db
    .select({
      id: jobs.id,
      referenceNumber: jobs.referenceNumber,
      state: jobs.state,
      lane: jobs.lane,
      wasteFramework: jobs.wasteFramework,
      confidence: jobs.classificationConfidence,
      stateChangedAt: jobs.stateChangedAt,
      createdAt: jobs.createdAt,
      generatorName: generators.name,
      generatorClass: generators.generatorClass,
      locationCity: generatorLocations.city,
      locationState: generatorLocations.state,
      vendorName: vendors.name,
    })
    .from(jobs)
    .leftJoin(generators, eq(jobs.generatorId, generators.id))
    .leftJoin(generatorLocations, eq(jobs.generatorLocationId, generatorLocations.id))
    .leftJoin(vendors, eq(jobs.selectedVendorId, vendors.id))
    .orderBy(desc(jobs.stateChangedAt))
    .limit(200);

  // Quick stat: count by group
  const groupCounts = new Map<string, number>();
  for (const row of rows) {
    const g = stateGroup(row.state);
    groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-1 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
        Ops console · Job pipeline
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Jobs <span className="text-zinc-400">({rows.length})</span>
        </h1>
      </div>

      {/* Pipeline summary */}
      <div className="mt-6 flex flex-wrap gap-2">
        {(Object.keys(STATE_GROUPS) as Array<keyof typeof STATE_GROUPS>).map((group) => (
          <div
            key={group}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${GROUP_TONES[group]}`}
          >
            {GROUP_LABELS[group]}: {groupCounts.get(group) ?? 0}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="mt-8 overflow-x-auto rounded-lg border border-black/10 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-black/10 bg-zinc-50/80 text-xs font-medium tracking-wide text-zinc-500 uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Reference</th>
              <th className="px-4 py-2 text-left">Generator</th>
              <th className="px-4 py-2 text-left">Location</th>
              <th className="px-4 py-2 text-left">Lane</th>
              <th className="px-4 py-2 text-left">State</th>
              <th className="px-4 py-2 text-left">Vendor</th>
              <th className="px-4 py-2 text-right">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-500">
                  No jobs yet.
                </td>
              </tr>
            )}
            {rows.map((job) => {
              const group = stateGroup(job.state);
              const toneClass =
                group === 'other'
                  ? 'bg-zinc-50 text-zinc-900 border-zinc-200'
                  : GROUP_TONES[group as keyof typeof STATE_GROUPS];
              return (
                <tr key={job.id} className="transition-colors hover:bg-black/[0.02]">
                  <td className="px-4 py-2">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="font-mono text-xs font-medium text-zinc-900 hover:underline"
                    >
                      {job.referenceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <div className="max-w-[16ch] truncate">{job.generatorName ?? '—'}</div>
                    <div className="text-[10px] tracking-wide text-zinc-400 uppercase">
                      {job.generatorClass ?? ''}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-zinc-600">
                    {[job.locationCity, job.locationState].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
                      {job.lane === 'lane_1' ? 'Lane 1' : job.lane === 'lane_2' ? 'Lane 2' : '—'}
                    </span>
                    {job.confidence && (
                      <span className="ml-1 text-[10px] text-zinc-400">
                        {Math.round(Number(job.confidence))}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${toneClass}`}
                    >
                      {job.state}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-zinc-600">
                    {job.vendorName ?? <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-zinc-500">
                    {new Date(job.stateChangedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
