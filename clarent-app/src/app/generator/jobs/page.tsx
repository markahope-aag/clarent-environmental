import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createClerkSupabaseClient } from '@/lib/supabase/clerk';

const STATE_LABELS: Record<string, string> = {
  draft: 'Draft',
  classified_standard: 'Under review · instant pricing',
  classified_complex: 'Under review · specialist quote',
  priced: 'Priced',
  quote_sent: 'Quote sent',
  quote_accepted: 'Quote accepted',
  advance_paid: 'Deposit received',
  vendor_selected: 'Vendor being notified',
  vendor_notified: 'Pickup being scheduled',
  pickup_scheduled: 'Pickup confirmed',
  balance_due: 'Balance due',
  balance_paid: 'Balance paid',
  pickup_completed: 'Pickup complete',
  documents_processing: 'Documents processing',
  completed: 'Complete',
  non_compliant_flagged: 'Non-compliant flagged',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const OPEN_STATES = new Set([
  'draft',
  'classified_standard',
  'classified_complex',
  'priced',
  'quote_sent',
  'quote_accepted',
  'advance_paid',
  'vendor_selected',
  'vendor_notified',
  'pickup_scheduled',
  'balance_due',
  'balance_paid',
  'documents_processing',
]);

type JobRow = {
  id: string;
  reference_number: string;
  state: string;
  lane: string | null;
  waste_framework: string | null;
  created_at: string;
  job_waste_streams: Array<{ waste_stream_key: string; container_count: number }>;
};

export default async function GeneratorJobsListPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    // Kick back to the intake form which handles sign-in
    redirect('/generator');
  }
  if (!orgId) {
    redirect('/generator');
  }

  const supabase = await createClerkSupabaseClient();
  const { data, error } = await supabase
    .from('jobs')
    .select(
      `
        id,
        reference_number,
        state,
        lane,
        waste_framework,
        created_at,
        job_waste_streams ( waste_stream_key, container_count )
      `,
    )
    .order('created_at', { ascending: false })
    .returns<JobRow[]>();

  if (error) {
    console.error('failed to load jobs list:', error);
  }

  const jobs = data ?? [];
  const open = jobs.filter((j) => OPEN_STATES.has(j.state));
  const archived = jobs.filter((j) => !OPEN_STATES.has(j.state));

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="mb-1 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
        Generator portal · Your requests
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Pickup requests</h1>
        <Link
          href="/"
          className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
        >
          New request
        </Link>
      </div>

      {jobs.length === 0 && (
        <div className="mt-10 rounded-lg border border-dashed border-black/15 px-6 py-12 text-center text-sm text-zinc-600">
          No requests yet.{' '}
          <Link href="/" className="font-medium text-zinc-900 underline-offset-4 hover:underline">
            Submit your first pickup
          </Link>
          .
        </div>
      )}

      {open.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
            Active ({open.length})
          </h2>
          <JobList rows={open} />
        </section>
      )}

      {archived.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
            Completed &amp; archived ({archived.length})
          </h2>
          <JobList rows={archived} />
        </section>
      )}
    </div>
  );
}

function JobList({ rows }: { rows: JobRow[] }) {
  return (
    <ul className="divide-y divide-black/5 rounded-lg border border-black/10 bg-white">
      {rows.map((job) => {
        const waste = job.job_waste_streams[0];
        const date = new Date(job.created_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        return (
          <li key={job.id}>
            <Link
              href={`/jobs/${job.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-black/[0.02]"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{job.reference_number}</div>
                <div className="mt-0.5 truncate text-xs text-zinc-500">
                  {waste
                    ? `${waste.container_count} × ${waste.waste_stream_key.replace(/_/g, ' ')}`
                    : 'No waste details'}
                  {' · '}
                  {date}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-xs font-medium text-zinc-700">
                  {STATE_LABELS[job.state] ?? job.state}
                </div>
                {job.lane && (
                  <div className="text-[10px] tracking-wide text-zinc-400 uppercase">
                    {job.lane === 'lane_1' ? 'Lane 1' : 'Lane 2'}
                  </div>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
