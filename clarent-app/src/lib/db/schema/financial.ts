// Financial — invoices, invoice line items, payments, payouts
//
// Part of the Clarent Drizzle schema. See schema/index.ts for the
// full export surface. SQL migrations live in supabase/migrations/
// and are applied via the Supabase CLI.

import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { generators, vendors } from './core';
import { jobs } from './operational';

// ============================================================================
// Group 4 — Financial: invoices, payments, payouts
// ============================================================================

export const invoiceTypeEnum = pgEnum('invoice_type', [
  'ar_deposit', // generator deposit (typically 60%)
  'ar_balance', // generator balance (40%)
  'ar_non_compliant', // additional charge for non-compliant waste
  'ap_vendor', // vendor's invoice to Clarent (accounts payable)
]);

export const invoiceStateEnum = pgEnum('invoice_state', [
  'draft',
  'issued',
  'partial',
  'paid',
  'overdue',
  'disputed',
  'void',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'card',
  'ach',
  'wire',
  'check',
  'credit_applied',
  'refund',
]);

export const paymentStateEnum = pgEnum('payment_state', [
  'pending',
  'succeeded',
  'failed',
  'refunded',
  'partially_refunded',
  'disputed',
]);

export const payoutStateEnum = pgEnum('payout_state', [
  'pending', // clock hasn't started (pickup not yet completed)
  'scheduled', // due date set, awaiting release
  'in_transit',
  'paid',
  'failed',
  'held', // held for dispute / non-compliant investigation
  'cancelled',
]);

// ----------------------------------------------------------------------------
// Invoices — unified AR (to generator) + AP (from vendor) record
// ----------------------------------------------------------------------------

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceNumber: text('invoice_number').notNull(),
    invoiceType: invoiceTypeEnum('invoice_type').notNull(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'restrict' }),
    // Exactly one of these is set depending on type (AR → generator, AP → vendor)
    generatorId: uuid('generator_id').references(() => generators.id, { onDelete: 'restrict' }),
    vendorId: uuid('vendor_id').references(() => vendors.id, { onDelete: 'restrict' }),
    state: invoiceStateEnum('state').notNull().default('draft'),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
    fees: numeric('fees', { precision: 12, scale: 2 }).notNull().default('0'),
    tax: numeric('tax', { precision: 12, scale: 2 }).notNull().default('0'),
    total: numeric('total', { precision: 12, scale: 2 }).notNull(),
    amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).notNull().default('0'),
    balanceDue: numeric('balance_due', { precision: 12, scale: 2 }).notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    // Stripe linkage (AR invoices only)
    stripeInvoiceId: text('stripe_invoice_id'),
    stripePaymentLinkUrl: text('stripe_payment_link_url'),
    // Vendor-supplied PDF for AP invoices
    externalDocumentUrl: text('external_document_url'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('invoices_invoice_number_key').on(t.invoiceNumber),
    index('invoices_job_id_idx').on(t.jobId),
    index('invoices_generator_id_idx').on(t.generatorId),
    index('invoices_vendor_id_idx').on(t.vendorId),
    index('invoices_state_idx').on(t.state),
    index('invoices_invoice_type_idx').on(t.invoiceType),
    index('invoices_due_at_idx').on(t.dueAt),
  ],
);

// ----------------------------------------------------------------------------
// Invoice line items
// ----------------------------------------------------------------------------

export const invoiceLineItems = pgTable(
  'invoice_line_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull().default('1'),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    total: numeric('total', { precision: 12, scale: 2 }).notNull(),
    metadata: jsonb('metadata'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('invoice_line_items_invoice_id_idx').on(t.invoiceId)],
);

// ----------------------------------------------------------------------------
// Payments — AR payment events from generators (Stripe)
// ----------------------------------------------------------------------------

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'restrict' }),
    // Denormalized for reporting / compliance queries
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'restrict' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    method: paymentMethodEnum('method').notNull(),
    state: paymentStateEnum('state').notNull().default('pending'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    stripeChargeId: text('stripe_charge_id'),
    failureReason: text('failure_reason'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    refundAmount: numeric('refund_amount', { precision: 12, scale: 2 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('payments_invoice_id_idx').on(t.invoiceId),
    index('payments_job_id_idx').on(t.jobId),
    index('payments_state_idx').on(t.state),
    index('payments_stripe_payment_intent_id_idx').on(t.stripePaymentIntentId),
  ],
);

// ----------------------------------------------------------------------------
// Payouts — AP vendor payout schedule (Stripe Connect transfers)
// ----------------------------------------------------------------------------

export const payouts = pgTable(
  'payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'restrict' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'restrict' }),
    // AP invoice this payout satisfies (nullable until vendor submits invoice)
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    state: payoutStateEnum('state').notNull().default('pending'),
    // Becomes due on pickup_confirmed + Net 30 (or override)
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    stripeTransferId: text('stripe_transfer_id'),
    holdReason: text('hold_reason'),
    failureReason: text('failure_reason'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('payouts_vendor_id_idx').on(t.vendorId),
    index('payouts_job_id_idx').on(t.jobId),
    index('payouts_invoice_id_idx').on(t.invoiceId),
    index('payouts_state_idx').on(t.state),
    index('payouts_scheduled_at_idx').on(t.scheduledAt),
  ],
);
