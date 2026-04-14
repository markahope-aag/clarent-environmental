'use server';

import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/client';
import { auditLog, jobs, vendors } from '@/lib/db/schema';
import type { JobState } from '@/lib/workflow/state-machine';
import { canTransition } from '@/lib/workflow/state-machine';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function writeAuditLog(params: {
  entityId: string;
  action: 'update' | 'state_transition';
  reason?: string;
  diff?: Record<string, unknown>;
}) {
  const { userId } = await auth();
  await db.insert(auditLog).values({
    entityType: 'jobs',
    entityId: params.entityId,
    action: params.action,
    actorType: 'user_ops',
    actorId: userId ?? null,
    reason: params.reason ?? null,
    diff: params.diff ?? null,
  });
}

/**
 * Transition a job from its current state to a new one. Validates against
 * the state machine and writes an audit_log row.
 */
export async function transitionJobStateAction(
  jobId: string,
  targetState: JobState,
  reason?: string,
): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const [current] = await db
    .select({ state: jobs.state })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!current) return { ok: false, error: 'Job not found' };

  if (!canTransition(current.state as JobState, targetState)) {
    return {
      ok: false,
      error: `Illegal transition: ${current.state} → ${targetState}`,
    };
  }

  await db.update(jobs).set({ state: targetState }).where(eq(jobs.id, jobId));

  await writeAuditLog({
    entityId: jobId,
    action: 'state_transition',
    reason,
    diff: { before: { state: current.state }, after: { state: targetState } },
  });

  revalidatePath(`/ops/jobs/${jobId}`);
  revalidatePath('/ops/jobs');
  return { ok: true };
}

/**
 * Assign a vendor to a job. Validates the vendor exists and is active,
 * sets selected_vendor_id, optionally transitions state to vendor_selected
 * when the job is in a compatible pre-award state.
 */
export async function assignVendorAction(jobId: string, vendorId: string): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const [job] = await db
    .select({ id: jobs.id, state: jobs.state, selectedVendorId: jobs.selectedVendorId })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);
  if (!job) return { ok: false, error: 'Job not found' };

  const [vendor] = await db
    .select({ id: vendors.id, status: vendors.status })
    .from(vendors)
    .where(and(eq(vendors.id, vendorId), eq(vendors.status, 'active')))
    .limit(1);
  if (!vendor) return { ok: false, error: 'Vendor not found or not active' };

  await db.update(jobs).set({ selectedVendorId: vendor.id }).where(eq(jobs.id, jobId));

  await writeAuditLog({
    entityId: jobId,
    action: 'update',
    reason: 'vendor assigned',
    diff: {
      before: { selected_vendor_id: job.selectedVendorId },
      after: { selected_vendor_id: vendor.id },
    },
  });

  // If the job is in classified_complex, also advance state to vendor_selected
  if (job.state === 'classified_complex') {
    const transitionResult = await transitionJobStateAction(
      jobId,
      'vendor_selected',
      'Auto-advance on vendor assignment',
    );
    if (!transitionResult.ok) return transitionResult;
  }

  revalidatePath(`/ops/jobs/${jobId}`);
  revalidatePath('/ops/jobs');
  return { ok: true };
}

/**
 * Set the estimated total on a job and write an audit entry. Used by the
 * ops pricing form before transitioning to `priced`.
 */
export async function setEstimatedPriceAction(
  jobId: string,
  estimatedTotal: number,
): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not signed in' };

  if (!Number.isFinite(estimatedTotal) || estimatedTotal < 0) {
    return { ok: false, error: 'Price must be a positive number' };
  }

  const [job] = await db
    .select({ id: jobs.id, estimatedTotal: jobs.estimatedTotal, state: jobs.state })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);
  if (!job) return { ok: false, error: 'Job not found' };

  const formatted = estimatedTotal.toFixed(2);
  const depositAmount = (estimatedTotal * 0.6).toFixed(2);
  const balanceAmount = (estimatedTotal * 0.4).toFixed(2);

  await db
    .update(jobs)
    .set({
      estimatedTotal: formatted,
      depositAmount,
      balanceAmount,
    })
    .where(eq(jobs.id, jobId));

  await writeAuditLog({
    entityId: jobId,
    action: 'update',
    reason: 'estimated price set',
    diff: {
      before: { estimated_total: job.estimatedTotal },
      after: {
        estimated_total: formatted,
        deposit_amount: depositAmount,
        balance_amount: balanceAmount,
      },
    },
  });

  // Auto-advance to priced when coming from classification
  if (job.state === 'classified_standard' || job.state === 'vendor_selected') {
    const transitionResult = await transitionJobStateAction(
      jobId,
      'priced',
      'Auto-advance on price set',
    );
    if (!transitionResult.ok) return transitionResult;
  }

  revalidatePath(`/ops/jobs/${jobId}`);
  revalidatePath('/ops/jobs');
  return { ok: true };
}
