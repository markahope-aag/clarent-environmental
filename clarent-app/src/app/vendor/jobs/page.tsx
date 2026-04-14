import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createClerkSupabaseClient } from '@/lib/supabase/clerk';

const STATE_LABELS: Record<string, string> = {
  vendor_notified: 'Pickup needs scheduling',
  pickup_scheduled: 'Pickup scheduled',
  balance_due: 'Balance due',
  balance_paid: 'Balance paid — ready for pickup',
  pickup_completed: 'Pickup complete — awaiting docs',
  documents_processing: 'Documents processing',
  completed: 'Complete',
  non_compliant_flagged: 'Non-compliant flagged',
  disputed: 'Disputed',
};

type JobRow = {
  id: string;
  reference_number: string;
  state: string;
  lane: string | null;
  waste_framework: string | null;
  scheduled_pickup_date: string | null;
  state_changed_at: string;
  job_waste_streams: Array<{
    waste_stream_key: string;
    container_type: string;
    container_count: number;
  }>;
};

export default async function VendorJobsListPage() {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/vendor');
  }

  const supabase = await createClerkSupabaseClient();
  // RLS jobs_vendor_read_post_award automatically filters to jobs where
  // selected_vendor_id = current_vendor_id() AND state >= vendor_notified.
  const { data, error } = await supabase
    .from('jobs')
    .select(
      `
        id,
        reference_number,
        state,
        lane,
        waste_framework,
        scheduled_pickup_date,
        state_changed_at,
        job_waste_streams ( waste_stream_key, container_type, container_count )
      `,
    )
    .order('state_changed_at', { ascending: false })
    .returns<JobRow[]>();

  if (error) {
    console.error('failed to load vendor jobs:', error);
  }

  const jobs = data ?? [];
  const active = jobs.filter(
    (j) => !['completed', 'disputed', 'refunded', 'cancelled'].includes(j.state),
  );
  const archived = jobs.filter((j) =>
    ['completed', 'disputed', 'refunded', 'cancelled'].includes(j.state),
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="mb-1 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
        Vendor portal · Assigned jobs
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Your pickup queue</h1>

      {jobs.length === 0 && (
        <div className="mt-10 rounded-lg border border-dashed border-black/15 px-6 py-12 text-center text-sm text-zinc-600">
          No assigned jobs yet. When Clarent ops awards you a pickup, it will appear here after the
          state advances to <code>vendor_notified</code>.
        </div>
      )}

      {active.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
            Active ({active.length})
          </h2>
          <JobList rows={active} />
        </section>
      )}

      {archived.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
            Archive ({archived.length})
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
        const updated = new Date(job.state_changed_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const scheduled = job.scheduled_pickup_date
          ? new Date(job.scheduled_pickup_date).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })
          : null;
        return (
          <li key={job.id}>
            <Link
              href={`/jobs/${job.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-black/[0.02]"
            >
              <div className="min-w-0">
                <div className="truncate font-mono text-xs font-medium">{job.reference_number}</div>
                <div className="mt-0.5 truncate text-xs text-zinc-500">
                  {waste
                    ? `${waste.container_count} × ${waste.waste_stream_key.replace(/_/g, ' ')}`
                    : 'No waste details'}
                  {scheduled && ` · Pickup ${scheduled}`}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-xs font-medium text-zinc-700">
                  {STATE_LABELS[job.state] ?? job.state}
                </div>
                <div className="text-[10px] text-zinc-400">Updated {updated}</div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
