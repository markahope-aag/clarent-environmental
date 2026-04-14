/**
 * Job state machine.
 *
 * Single source of truth for which state transitions are legal. Used by
 * ops actions (and later by n8n workflows) to validate every write. This
 * is the only place new transitions should be introduced.
 *
 * The plan says "one job state machine governs everything" — never
 * bypass. If a transition isn't in TRANSITIONS, callers must fail.
 */

import type { jobStateEnum } from '@/lib/db/schema';

export type JobState = (typeof jobStateEnum.enumValues)[number];

/**
 * Directed graph of allowed transitions. Keys are the current state;
 * values are the set of states that state may transition to.
 */
export const TRANSITIONS: Record<JobState, readonly JobState[]> = {
  draft: ['classified_standard', 'classified_complex', 'cancelled'],

  // Lane 1 (standard) path
  classified_standard: ['priced', 'classified_complex', 'cancelled'],
  priced: ['quote_sent', 'classified_complex', 'cancelled'],

  // Lane 2 (complex) path — needs vendor + manual quote before quote_sent
  classified_complex: ['vendor_selected', 'priced', 'cancelled'],
  vendor_selected: ['priced', 'quote_sent', 'cancelled'],

  // Customer-facing quote lifecycle
  quote_sent: ['quote_accepted', 'cancelled', 'refunded'],
  quote_accepted: ['advance_paid', 'cancelled'],
  advance_paid: ['vendor_notified', 'vendor_selected', 'cancelled', 'refunded'],

  // Vendor side — routing and pickup
  vendor_notified: ['pickup_scheduled', 'non_compliant_flagged', 'cancelled'],
  pickup_scheduled: ['balance_due', 'pickup_completed', 'non_compliant_flagged', 'cancelled'],
  balance_due: ['balance_paid', 'cancelled', 'disputed'],
  balance_paid: ['pickup_completed', 'cancelled'],

  // Post-pickup
  pickup_completed: ['documents_processing', 'non_compliant_flagged'],
  documents_processing: ['completed', 'disputed'],
  completed: [], // terminal

  // Exception paths
  non_compliant_flagged: [
    'vendor_selected',
    'pickup_scheduled',
    'cancelled',
    'disputed',
    'completed',
  ],
  disputed: ['completed', 'refunded', 'cancelled'],

  // Terminal paths
  cancelled: ['refunded'],
  refunded: [],
};

export function canTransition(from: JobState, to: JobState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Next states that are valid forward moves from the given state. */
export function nextStates(from: JobState): readonly JobState[] {
  return TRANSITIONS[from] ?? [];
}

/**
 * Plain-language labels for the primary "advance" action button on the
 * ops console. Keys are the TARGET state; values are the verb the ops
 * user clicks to move into that state.
 */
export const ADVANCE_LABELS: Partial<Record<JobState, string>> = {
  classified_standard: 'Mark Lane 1',
  classified_complex: 'Mark Lane 2',
  priced: 'Set price',
  quote_sent: 'Send quote',
  quote_accepted: 'Mark quote accepted',
  advance_paid: 'Mark deposit paid',
  vendor_selected: 'Select vendor',
  vendor_notified: 'Notify vendor',
  pickup_scheduled: 'Confirm pickup scheduled',
  balance_due: 'Issue balance invoice',
  balance_paid: 'Mark balance paid',
  pickup_completed: 'Mark pickup complete',
  documents_processing: 'Start documents',
  completed: 'Mark complete',
  non_compliant_flagged: 'Flag non-compliant',
  disputed: 'Mark disputed',
  cancelled: 'Cancel',
  refunded: 'Mark refunded',
};
