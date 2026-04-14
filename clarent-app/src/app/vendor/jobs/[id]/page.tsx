import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { createClerkSupabaseClient } from '@/lib/supabase/clerk';

type PageProps = {
  params: Promise<{ id: string }>;
};

type JobDetail = {
  id: string;
  reference_number: string;
  state: string;
  lane: string | null;
  waste_framework: string | null;
  scheduled_pickup_date: string | null;
  notes: string | null;
  created_at: string;
  state_changed_at: string;
  estimated_total: string | null;
  job_waste_streams: Array<{
    waste_stream_key: string;
    container_type: string;
    container_count: number;
    estimated_weight_lbs: string | null;
  }>;
};

export default async function VendorJobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/vendor');
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
        scheduled_pickup_date,
        notes,
        created_at,
        state_changed_at,
        estimated_total,
        job_waste_streams (
          waste_stream_key,
          container_type,
          container_count,
          estimated_weight_lbs
        )
      `,
    )
    .eq('id', id)
    .maybeSingle<JobDetail>();

  if (error) {
    console.error('failed to load vendor job detail:', error);
    notFound();
  }

  if (!data) {
    // RLS returned no rows → either job doesn't exist or not assigned to us.
    notFound();
  }

  const job = data;
  const scheduled = job.scheduled_pickup_date
    ? new Date(job.scheduled_pickup_date).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="mb-4">
        <Link
          href="/jobs"
          className="text-xs font-medium tracking-wide text-zinc-500 uppercase hover:text-zinc-900"
        >
          ← Back to queue
        </Link>
      </div>

      <div className="mb-1 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
        Vendor portal · Work order
      </div>
      <h1 className="font-mono text-2xl font-semibold tracking-tight">{job.reference_number}</h1>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-black/10 bg-zinc-50 px-3 py-1 font-medium">
          {job.state}
        </span>
        {job.waste_framework && (
          <span className="rounded-full border border-black/10 bg-zinc-50 px-3 py-1">
            {job.waste_framework.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {scheduled && (
        <section className="mt-8 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm">
          <div className="text-xs font-semibold tracking-wide text-teal-900 uppercase">
            Pickup scheduled
          </div>
          <div className="mt-1 text-teal-900">{scheduled}</div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
          Waste streams
        </h2>
        <ul className="divide-y divide-black/5 rounded-lg border border-black/10 bg-white">
          {job.job_waste_streams.map((w, i) => (
            <li key={i} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <div className="text-sm font-medium">{w.waste_stream_key.replace(/_/g, ' ')}</div>
                <div className="text-xs text-zinc-500">
                  {w.container_count} × {w.container_type.replace(/_/g, ' ')}
                  {w.estimated_weight_lbs && ` · ~${w.estimated_weight_lbs} lbs`}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {job.notes && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
            Notes
          </h2>
          <p className="rounded-md border border-black/10 bg-zinc-50 px-4 py-3 text-sm whitespace-pre-wrap">
            {job.notes}
          </p>
        </section>
      )}

      <section className="mt-10 rounded-lg border border-dashed border-black/15 bg-zinc-50 px-4 py-4">
        <h2 className="text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
          Upcoming
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Pickup confirmation, manifest upload, and proof-of-service submission will be wired in a
          later phase. For now this page shows the work order details — contact ops if anything
          looks off.
        </p>
      </section>

      <div className="mt-8 text-xs text-zinc-400">
        Last state change {new Date(job.state_changed_at).toLocaleString()}
      </div>
    </div>
  );
}
