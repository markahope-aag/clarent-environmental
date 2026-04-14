import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClerkSupabaseClient } from '@/lib/supabase/clerk';

type PageProps = {
  params: Promise<{ id: string }>;
};

// Plain-language labels for the internal state machine values. Keeps the
// vocabulary consistent with what Phase 3 will expand into the full tracker.
const STATE_LABELS: Record<string, { label: string; tone: 'neutral' | 'info' | 'success' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  classified_standard: { label: 'Under review · instant pricing', tone: 'info' },
  classified_complex: { label: 'Under review · specialist quote', tone: 'info' },
  priced: { label: 'Priced — ready for acceptance', tone: 'info' },
  quote_sent: { label: 'Quote sent', tone: 'info' },
  quote_accepted: { label: 'Quote accepted', tone: 'info' },
  advance_paid: { label: 'Deposit received · vendor being selected', tone: 'info' },
  vendor_selected: { label: 'Vendor being notified', tone: 'info' },
  vendor_notified: { label: 'Pickup being scheduled', tone: 'info' },
  pickup_scheduled: { label: 'Pickup confirmed', tone: 'info' },
  balance_due: { label: 'Balance payment due', tone: 'info' },
  balance_paid: { label: 'Balance paid · awaiting pickup', tone: 'info' },
  pickup_completed: { label: 'Pickup complete', tone: 'success' },
  documents_processing: { label: 'Documents processing', tone: 'info' },
  completed: { label: 'Complete', tone: 'success' },
  non_compliant_flagged: { label: 'Non-compliant waste flagged', tone: 'neutral' },
  disputed: { label: 'Disputed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  refunded: { label: 'Refunded', tone: 'neutral' },
};

const CONTAINER_LABELS: Record<string, string> = {
  '55gal_drum': '55-gallon drum',
  '30gal_drum': '30-gallon drum',
  '5gal_pail': '5-gallon pail',
  '275gal_tote': '275-gallon tote',
  lamp_box: 'Lamp box',
  other: 'Other',
};

type JobRow = {
  id: string;
  reference_number: string;
  state: string;
  lane: string | null;
  waste_framework: string | null;
  classification_confidence: string | null;
  created_at: string;
  notes: string | null;
  job_waste_streams: Array<{
    waste_stream_key: string;
    container_type: string;
    container_count: number;
  }>;
};

export default async function GeneratorJobDetailPage({ params }: PageProps) {
  const { id } = await params;

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
        classification_confidence,
        created_at,
        notes,
        job_waste_streams (
          waste_stream_key,
          container_type,
          container_count
        )
      `,
    )
    .eq('id', id)
    .maybeSingle<JobRow>();

  if (error) {
    console.error('failed to load job detail:', error);
    notFound();
  }

  if (!data) {
    notFound();
  }

  const job = data;
  const stateMeta = STATE_LABELS[job.state] ?? { label: job.state, tone: 'neutral' as const };
  const primaryWaste = job.job_waste_streams[0];
  const createdAt = new Date(job.created_at);

  const toneClass =
    stateMeta.tone === 'success'
      ? 'bg-green-50 text-green-900 border-green-200'
      : stateMeta.tone === 'info'
        ? 'bg-blue-50 text-blue-900 border-blue-200'
        : 'bg-zinc-50 text-zinc-900 border-zinc-200';

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="mb-1 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
        Generator portal · Pickup request
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{job.reference_number}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Submitted{' '}
        {createdAt.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </p>

      <div className={`mt-6 rounded-lg border px-4 py-3 text-sm ${toneClass}`}>
        <div className="font-medium">{stateMeta.label}</div>
        {job.lane && (
          <div className="mt-0.5 text-xs opacity-75">
            {job.lane === 'lane_1' ? 'Instant-pricing lane' : 'Specialist review lane'}
            {job.classification_confidence &&
              ` · ${Math.round(Number(job.classification_confidence))}% confidence`}
          </div>
        )}
      </div>

      {primaryWaste && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
            Waste
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4 border-b border-black/5 py-2">
              <dt className="text-zinc-500">Stream</dt>
              <dd className="text-right font-medium">{primaryWaste.waste_stream_key}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-black/5 py-2">
              <dt className="text-zinc-500">Framework</dt>
              <dd className="text-right font-medium">
                {job.waste_framework ?? <span className="text-zinc-400">—</span>}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-black/5 py-2">
              <dt className="text-zinc-500">Containers</dt>
              <dd className="text-right font-medium">
                {primaryWaste.container_count} ×{' '}
                {CONTAINER_LABELS[primaryWaste.container_type] ?? primaryWaste.container_type}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {job.notes && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
            Notes
          </h2>
          <p className="rounded-md border border-black/10 bg-zinc-50 px-3 py-2 text-sm whitespace-pre-wrap">
            {job.notes}
          </p>
        </section>
      )}

      <div className="mt-10 flex items-center justify-between text-sm">
        <Link href="/generator" className="text-zinc-600 underline-offset-4 hover:underline">
          ← New request
        </Link>
        <div className="text-zinc-400">Full tracker and documents arrive in Phase 3</div>
      </div>
    </div>
  );
}
