'use client';

import { useState, useTransition } from 'react';
import {
  assignVendorAction,
  setEstimatedPriceAction,
  transitionJobStateAction,
  type ActionResult,
} from './actions';
import type { JobState } from '@/lib/workflow/state-machine';
import { ADVANCE_LABELS } from '@/lib/workflow/state-machine';

type EligibleVendor = {
  id: string;
  name: string;
  vendorType: string;
  state: string | null;
  performanceScore: string | null;
};

type Props = {
  jobId: string;
  currentState: JobState;
  lane: 'lane_1' | 'lane_2' | null;
  currentEstimatedTotal: string | null;
  assignedVendorId: string | null;
  allowedTransitions: readonly JobState[];
  eligibleVendors: EligibleVendor[];
};

export default function OpsActionsPanel({
  jobId,
  currentState,
  lane,
  currentEstimatedTotal,
  assignedVendorId,
  allowedTransitions,
  eligibleVendors,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<ActionResult | null>(null);
  const [priceInput, setPriceInput] = useState<string>(currentEstimatedTotal ?? '');
  const [vendorInput, setVendorInput] = useState<string>(assignedVendorId ?? '');

  const run = (fn: () => Promise<ActionResult>) => {
    startTransition(async () => {
      const result = await fn();
      setLastResult(result);
    });
  };

  return (
    <section className="md:col-span-2">
      <h2 className="mb-3 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">
        Ops actions
      </h2>
      <div className="space-y-4 rounded-lg border border-black/10 bg-white px-4 py-4">
        {/* Current state */}
        <div className="text-xs text-zinc-500">
          Current state: <span className="font-mono font-medium text-zinc-900">{currentState}</span>
        </div>

        {/* Set estimated price (Lane 1 → priced, Lane 2 → priced post vendor) */}
        {(currentState === 'classified_standard' ||
          currentState === 'classified_complex' ||
          currentState === 'vendor_selected' ||
          currentState === 'priced') && (
          <div className="border-t border-black/5 pt-4">
            <div className="mb-2 text-xs font-medium text-zinc-700">
              {currentState === 'priced' ? 'Update' : 'Set'} estimated total
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-zinc-400">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="1200.00"
                  className="w-full rounded-md border border-black/10 bg-white py-1.5 pr-3 pl-7 text-sm shadow-sm transition-colors outline-none focus:border-black/30 focus:ring-2 focus:ring-black/5"
                />
              </div>
              <button
                type="button"
                disabled={pending || !priceInput}
                onClick={() => run(() => setEstimatedPriceAction(jobId, parseFloat(priceInput)))}
                className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {pending ? 'Saving…' : 'Save price'}
              </button>
            </div>
            <div className="mt-1 text-[10px] text-zinc-400">
              Auto-splits into 60% deposit + 40% balance when saved.
            </div>
          </div>
        )}

        {/* Vendor selection (Lane 2 only, pre-award) */}
        {lane === 'lane_2' &&
          (currentState === 'classified_complex' ||
            currentState === 'vendor_selected' ||
            currentState === 'priced') && (
            <div className="border-t border-black/5 pt-4">
              <div className="mb-2 text-xs font-medium text-zinc-700">
                {assignedVendorId ? 'Reassign vendor' : 'Assign vendor'}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={vendorInput}
                  onChange={(e) => setVendorInput(e.target.value)}
                  className="flex-1 rounded-md border border-black/10 bg-white px-3 py-1.5 text-sm shadow-sm transition-colors outline-none focus:border-black/30 focus:ring-2 focus:ring-black/5"
                >
                  <option value="">— pick a vendor —</option>
                  {eligibleVendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                      {v.state && ` (${v.state})`}
                      {v.performanceScore && ` · ${v.performanceScore}`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={pending || !vendorInput || vendorInput === assignedVendorId}
                  onClick={() => run(() => assignVendorAction(jobId, vendorInput))}
                  className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  {pending ? 'Assigning…' : 'Assign'}
                </button>
              </div>
              {eligibleVendors.length === 0 && (
                <div className="mt-1 text-[10px] text-zinc-400">
                  No active vendors match this job&apos;s waste framework and state.
                </div>
              )}
            </div>
          )}

        {/* Generic forward-transition buttons */}
        {allowedTransitions.length > 0 && (
          <div className="border-t border-black/5 pt-4">
            <div className="mb-2 text-xs font-medium text-zinc-700">Advance state</div>
            <div className="flex flex-wrap gap-2">
              {allowedTransitions.map((next) => (
                <button
                  key={next}
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => transitionJobStateAction(jobId, next))}
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:text-zinc-300"
                >
                  {ADVANCE_LABELS[next] ?? next}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Result banner */}
        {lastResult && (
          <div
            className={`rounded-md border px-3 py-2 text-xs ${
              lastResult.ok
                ? 'border-green-200 bg-green-50 text-green-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            {lastResult.ok ? 'Action applied.' : lastResult.error}
          </div>
        )}
      </div>
    </section>
  );
}
