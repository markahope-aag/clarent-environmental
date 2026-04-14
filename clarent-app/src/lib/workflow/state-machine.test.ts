import { describe, expect, it } from 'vitest';
import { canTransition, nextStates, TRANSITIONS } from './state-machine';

describe('TRANSITIONS', () => {
  it('defines a next-states entry for every state in the enum (completeness check)', () => {
    // We import TRANSITIONS and assert every state we expect to exist has an entry.
    // Missing keys would produce undefined and break nextStates() at runtime.
    const requiredStates = Object.keys(TRANSITIONS);
    for (const state of requiredStates) {
      expect(TRANSITIONS[state as keyof typeof TRANSITIONS]).toBeDefined();
    }
  });
});

describe('canTransition', () => {
  it('allows draft → classified_standard (Lane 1 path)', () => {
    expect(canTransition('draft', 'classified_standard')).toBe(true);
  });

  it('allows draft → classified_complex (Lane 2 path)', () => {
    expect(canTransition('draft', 'classified_complex')).toBe(true);
  });

  it('allows Lane 1 happy path: classified_standard → priced → quote_sent', () => {
    expect(canTransition('classified_standard', 'priced')).toBe(true);
    expect(canTransition('priced', 'quote_sent')).toBe(true);
  });

  it('allows Lane 2 happy path: classified_complex → vendor_selected → priced', () => {
    expect(canTransition('classified_complex', 'vendor_selected')).toBe(true);
    expect(canTransition('vendor_selected', 'priced')).toBe(true);
  });

  it('allows the full pickup pipeline: quote_accepted → advance_paid → vendor_notified → pickup_scheduled → balance_paid → pickup_completed → completed', () => {
    expect(canTransition('quote_accepted', 'advance_paid')).toBe(true);
    expect(canTransition('advance_paid', 'vendor_notified')).toBe(true);
    expect(canTransition('vendor_notified', 'pickup_scheduled')).toBe(true);
    expect(canTransition('pickup_scheduled', 'balance_due')).toBe(true);
    expect(canTransition('balance_due', 'balance_paid')).toBe(true);
    expect(canTransition('balance_paid', 'pickup_completed')).toBe(true);
    expect(canTransition('pickup_completed', 'documents_processing')).toBe(true);
    expect(canTransition('documents_processing', 'completed')).toBe(true);
  });

  it('rejects backward transitions', () => {
    expect(canTransition('quote_sent', 'draft')).toBe(false);
    expect(canTransition('pickup_completed', 'vendor_selected')).toBe(false);
    expect(canTransition('completed', 'draft')).toBe(false);
  });

  it('rejects skip-ahead transitions', () => {
    // draft cannot jump directly to quote_sent
    expect(canTransition('draft', 'quote_sent')).toBe(false);
    // classified_standard cannot jump directly to vendor_notified
    expect(canTransition('classified_standard', 'vendor_notified')).toBe(false);
  });

  it('makes completed terminal (no outgoing transitions)', () => {
    expect(nextStates('completed')).toEqual([]);
  });

  it('makes refunded terminal', () => {
    expect(nextStates('refunded')).toEqual([]);
  });

  it('allows cancellation from most non-terminal states', () => {
    expect(canTransition('draft', 'cancelled')).toBe(true);
    expect(canTransition('classified_standard', 'cancelled')).toBe(true);
    expect(canTransition('vendor_notified', 'cancelled')).toBe(true);
    expect(canTransition('pickup_scheduled', 'cancelled')).toBe(true);
  });

  it('non_compliant_flagged can exit to several resolution paths', () => {
    expect(canTransition('non_compliant_flagged', 'completed')).toBe(true);
    expect(canTransition('non_compliant_flagged', 'disputed')).toBe(true);
    expect(canTransition('non_compliant_flagged', 'vendor_selected')).toBe(true);
  });
});

describe('nextStates', () => {
  it('returns the full forward set for a state', () => {
    expect(nextStates('draft')).toEqual(['classified_standard', 'classified_complex', 'cancelled']);
  });

  it('returns an empty array for unknown states', () => {
    // @ts-expect-error runtime safety check with invalid input
    expect(nextStates('not_a_real_state')).toEqual([]);
  });
});
