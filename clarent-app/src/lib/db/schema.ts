// Drizzle schema — Clarent Environmental
//
// Source of truth for runtime types and the query builder. SQL migrations
// live in `supabase/migrations/` and are applied via the Supabase CLI
// (see memory: feedback_clarent_migrations.md).
//
// Schema is built up in groups, one migration per group. Current groups:
//   1. Core entities — generators, vendors, and their related master data
//   3. Operational — jobs, state machine, certifications, rfqs, quotes
//   4. Financial — invoices, invoice line items, payments, payouts
//   5. Compliance — obligations, calendar entries, non-compliant events, manifests
//
// TODO (future phases):
//   2. Reference data (waste codes, DOT hazmat, chemicals, regulations)
//   6. Pricing (zones, vendor pricing, markup, lane1 cache)
//   7. Infrastructure (audit log, communication log, documents, incidents)

import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
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

// ============================================================================
// Enums
// ============================================================================

export const generatorClassEnum = pgEnum('generator_class', ['VSQG', 'SQG', 'LQG']);

export const generatorStatusEnum = pgEnum('generator_status', [
  'prospect',
  'active',
  'inactive',
  'suspended',
  'do_not_contact',
]);

export const marketingStageEnum = pgEnum('marketing_stage', [
  'prospect',
  'contacted',
  'engaged',
  'customer',
]);

export const contactRoleEnum = pgEnum('contact_role', [
  'primary',
  'billing',
  'compliance',
  'on_site',
  'emergency_coordinator',
  'other',
]);

export const vendorTypeEnum = pgEnum('vendor_type', [
  'transporter',
  'tsdf',
  'transporter_tsdf',
  'consolidation',
  'broker',
]);

export const vendorStatusEnum = pgEnum('vendor_status', [
  'prospect',
  'onboarding',
  'active',
  'paused',
  'suspended',
  'removed',
]);

export const wasteFrameworkEnum = pgEnum('waste_framework', [
  'rcra_hazardous',
  'universal_waste',
  'used_oil',
  'non_rcra_state',
  'medical',
  'asbestos',
  'radioactive',
]);

export const serviceAreaTypeEnum = pgEnum('service_area_type', [
  'state',
  'zip_prefix',
  'radius_miles',
  'polygon',
]);

// ============================================================================
// Generators — business entities that produce hazardous waste
// ============================================================================

export const generators = pgTable(
  'generators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    dba: text('dba'),
    generatorClass: generatorClassEnum('generator_class'),
    naicsCode: text('naics_code'),
    industry: text('industry'),
    website: text('website'),
    status: generatorStatusEnum('status').notNull().default('prospect'),
    marketingStage: marketingStageEnum('marketing_stage').notNull().default('prospect'),
    accountNotes: text('account_notes'),
    enrichmentSource: text('enrichment_source'),
    lastEnrichedAt: timestamp('last_enriched_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('generators_name_idx').on(t.name),
    index('generators_status_idx').on(t.status),
    index('generators_marketing_stage_idx').on(t.marketingStage),
    index('generators_generator_class_idx').on(t.generatorClass),
  ],
);

// ============================================================================
// Generator locations — physical sites where waste is generated
// ============================================================================

export const generatorLocations = pgTable(
  'generator_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    generatorId: uuid('generator_id')
      .notNull()
      .references(() => generators.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    epaId: text('epa_id'),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    state: text('state'),
    postalCode: text('postal_code'),
    country: text('country').notNull().default('US'),
    phone: text('phone'),
    email: text('email'),
    isPrimary: boolean('is_primary').notNull().default(false),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('generator_locations_generator_id_idx').on(t.generatorId),
    index('generator_locations_state_idx').on(t.state),
    uniqueIndex('generator_locations_epa_id_key')
      .on(t.epaId)
      .where(sql`${t.epaId} IS NOT NULL`),
  ],
);

// ============================================================================
// Generator contacts — people associated with a generator
// ============================================================================

export const generatorContacts = pgTable(
  'generator_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    generatorId: uuid('generator_id')
      .notNull()
      .references(() => generators.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id').references(() => generatorLocations.id, {
      onDelete: 'set null',
    }),
    firstName: text('first_name'),
    lastName: text('last_name'),
    title: text('title'),
    email: text('email'),
    phone: text('phone'),
    mobile: text('mobile'),
    role: contactRoleEnum('role').notNull().default('primary'),
    isAuthorizedSigner: boolean('is_authorized_signer').notNull().default(false),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('generator_contacts_generator_id_idx').on(t.generatorId),
    index('generator_contacts_email_idx').on(t.email),
  ],
);

// ============================================================================
// Vendors — service providers (transporters, TSDFs, brokers)
// ============================================================================

export const vendors = pgTable(
  'vendors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    dba: text('dba'),
    vendorType: vendorTypeEnum('vendor_type').notNull(),
    epaId: text('epa_id'),
    dotRegistration: text('dot_registration'),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    state: text('state'),
    postalCode: text('postal_code'),
    country: text('country').notNull().default('US'),
    phone: text('phone'),
    email: text('email'),
    website: text('website'),
    status: vendorStatusEnum('status').notNull().default('prospect'),
    insuranceExpiresAt: date('insurance_expires_at'),
    performanceScore: numeric('performance_score', { precision: 5, scale: 2 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('vendors_status_idx').on(t.status),
    index('vendors_vendor_type_idx').on(t.vendorType),
    index('vendors_name_idx').on(t.name),
  ],
);

// ============================================================================
// Vendor capabilities — waste frameworks and code families each vendor handles
// ============================================================================

export const vendorCapabilities = pgTable(
  'vendor_capabilities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    wasteFramework: wasteFrameworkEnum('waste_framework').notNull(),
    wasteCodePrefix: text('waste_code_prefix'),
    containerTypes: text('container_types').array(),
    maxQuantityPerPickup: integer('max_quantity_per_pickup'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('vendor_capabilities_vendor_id_idx').on(t.vendorId),
    index('vendor_capabilities_framework_idx').on(t.wasteFramework),
  ],
);

// ============================================================================
// Vendor service areas — geographic coverage
// ============================================================================

export const vendorServiceAreas = pgTable(
  'vendor_service_areas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    areaType: serviceAreaTypeEnum('area_type').notNull(),
    value: text('value').notNull(),
    priority: integer('priority').notNull().default(100),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('vendor_service_areas_vendor_id_idx').on(t.vendorId),
    index('vendor_service_areas_area_idx').on(t.areaType, t.value),
  ],
);

// ============================================================================
// Group 3 — Operational: jobs, state machine, certifications, RFQs, quotes
// ============================================================================

// ----------------------------------------------------------------------------
// Operational enums
// ----------------------------------------------------------------------------

// One job state machine governs every workflow (see plan guiding principles).
// Never bypass. Transitions happen in lib/workflow/.
export const jobStateEnum = pgEnum('job_state', [
  'draft', // intake in progress
  'classified_standard', // Lane 1 — confident, instant-price eligible
  'classified_complex', // Lane 2 — needs ops review + RFQ
  'priced', // price set, awaiting customer acceptance
  'quote_sent', // quote delivered to generator
  'quote_accepted', // generator accepted terms
  'advance_paid', // deposit received (Stripe webhook)
  'vendor_selected', // ops or auto-router has chosen a vendor
  'vendor_notified', // work order sent to vendor
  'pickup_scheduled', // vendor confirmed date
  'balance_due', // balance invoice issued
  'balance_paid', // generator paid balance
  'pickup_completed', // vendor confirmed waste removed
  'documents_processing', // manifests / CoD pending
  'completed', // all docs filed, payouts scheduled
  'non_compliant_flagged', // vendor reported non-compliant waste
  'disputed', // disagreement between parties
  'cancelled', // cancelled before pickup
  'refunded', // cancelled after payment
]);

export const jobLaneEnum = pgEnum('job_lane', ['lane_1', 'lane_2']);

export const rfqStateEnum = pgEnum('rfq_state', ['open', 'closed', 'awarded', 'cancelled']);

export const rfqRecipientStateEnum = pgEnum('rfq_recipient_state', [
  'pending',
  'opened',
  'responded',
  'declined',
  'expired',
]);

export const quoteStateEnum = pgEnum('quote_state', [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'superseded',
]);

// ----------------------------------------------------------------------------
// Jobs — central operational record
// ----------------------------------------------------------------------------

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Human-friendly reference like "CLR-2026-0001". Generated by app layer.
    referenceNumber: text('reference_number').notNull(),
    generatorId: uuid('generator_id')
      .notNull()
      .references(() => generators.id, { onDelete: 'restrict' }),
    generatorLocationId: uuid('generator_location_id')
      .notNull()
      .references(() => generatorLocations.id, { onDelete: 'restrict' }),
    generatorContactId: uuid('generator_contact_id').references(() => generatorContacts.id, {
      onDelete: 'set null',
    }),
    state: jobStateEnum('state').notNull().default('draft'),
    lane: jobLaneEnum('lane'),
    wasteFramework: wasteFrameworkEnum('waste_framework'),
    classificationConfidence: numeric('classification_confidence', { precision: 5, scale: 2 }),
    // Requested by generator during intake
    requestedPickupWindow: text('requested_pickup_window'),
    // Confirmed by vendor
    scheduledPickupDate: timestamp('scheduled_pickup_date', { withTimezone: true }),
    actualPickupDate: timestamp('actual_pickup_date', { withTimezone: true }),
    // Financial snapshot (sourced from quotes/invoices; cached for querying)
    estimatedTotal: numeric('estimated_total', { precision: 12, scale: 2 }),
    finalTotal: numeric('final_total', { precision: 12, scale: 2 }),
    depositAmount: numeric('deposit_amount', { precision: 12, scale: 2 }),
    balanceAmount: numeric('balance_amount', { precision: 12, scale: 2 }),
    selectedVendorId: uuid('selected_vendor_id').references(() => vendors.id, {
      onDelete: 'set null',
    }),
    // Flags surface exception queue items (non_compliant, disputed, stale, etc)
    flags: text('flags').array(),
    notes: text('notes'),
    // When the state machine most recently changed (for stale-job detection)
    stateChangedAt: timestamp('state_changed_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('jobs_reference_number_key').on(t.referenceNumber),
    index('jobs_generator_id_idx').on(t.generatorId),
    index('jobs_generator_location_id_idx').on(t.generatorLocationId),
    index('jobs_selected_vendor_id_idx').on(t.selectedVendorId),
    index('jobs_state_idx').on(t.state),
    index('jobs_lane_idx').on(t.lane),
    index('jobs_state_changed_at_idx').on(t.stateChangedAt),
    index('jobs_created_at_idx').on(t.createdAt),
  ],
);

// ----------------------------------------------------------------------------
// Job waste streams — a job can have multiple streams (future-proof;
// Phase 3 MVP creates one per job, but the schema supports bundles)
// ----------------------------------------------------------------------------

export const jobWasteStreams = pgTable(
  'job_waste_streams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    // FK to waste_streams reference table will come in Group 2; for now text key
    wasteStreamKey: text('waste_stream_key').notNull(),
    wasteCodePrefixes: text('waste_code_prefixes').array(),
    containerType: text('container_type').notNull(),
    containerCount: integer('container_count').notNull(),
    estimatedWeightLbs: numeric('estimated_weight_lbs', { precision: 10, scale: 2 }),
    // Generator-reported condition; triggers Lane 2 if not 'intact'
    containerCondition: text('container_condition'),
    unContainerCertified: boolean('un_container_certified').notNull().default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('job_waste_streams_job_id_idx').on(t.jobId),
    index('job_waste_streams_waste_stream_key_idx').on(t.wasteStreamKey),
  ],
);

// ----------------------------------------------------------------------------
// Certifications — timestamped generator affirmations per intake
// ----------------------------------------------------------------------------

export const certifications = pgTable(
  'certifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'restrict' }),
    generatorId: uuid('generator_id')
      .notNull()
      .references(() => generators.id, { onDelete: 'restrict' }),
    generatorContactId: uuid('generator_contact_id').references(() => generatorContacts.id, {
      onDelete: 'set null',
    }),
    // Template version so we can evolve certification language without
    // breaking historical records
    templateVersion: integer('template_version').notNull(),
    // Full payload: affirmations (array of {key, value}), signer info, rendered text
    payload: jsonb('payload').notNull(),
    signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('certifications_job_id_idx').on(t.jobId),
    index('certifications_generator_id_idx').on(t.generatorId),
    index('certifications_signed_at_idx').on(t.signedAt),
  ],
);

// ----------------------------------------------------------------------------
// RFQs — anonymized solicitations sent to vendors
// ----------------------------------------------------------------------------

export const rfqs = pgTable(
  'rfqs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    referenceNumber: text('reference_number').notNull(),
    // Everything a vendor sees pre-award (sanitized: no generator identity,
    // only a geographic zone). Captured as jsonb for auditability and replay.
    anonymizedPayload: jsonb('anonymized_payload').notNull(),
    state: rfqStateEnum('state').notNull().default('open'),
    responseDeadlineAt: timestamp('response_deadline_at', { withTimezone: true }).notNull(),
    awardedVendorQuoteId: uuid('awarded_vendor_quote_id'),
    awardedAt: timestamp('awarded_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('rfqs_reference_number_key').on(t.referenceNumber),
    index('rfqs_job_id_idx').on(t.jobId),
    index('rfqs_state_idx').on(t.state),
    index('rfqs_response_deadline_at_idx').on(t.responseDeadlineAt),
  ],
);

// ----------------------------------------------------------------------------
// RFQ recipients — which vendors received each RFQ and their response state
// ----------------------------------------------------------------------------

export const rfqRecipients = pgTable(
  'rfq_recipients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rfqId: uuid('rfq_id')
      .notNull()
      .references(() => rfqs.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'restrict' }),
    state: rfqRecipientStateEnum('state').notNull().default('pending'),
    notifiedAt: timestamp('notified_at', { withTimezone: true }).notNull().defaultNow(),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    declineReason: text('decline_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('rfq_recipients_rfq_vendor_key').on(t.rfqId, t.vendorId),
    index('rfq_recipients_vendor_id_idx').on(t.vendorId),
    index('rfq_recipients_state_idx').on(t.state),
  ],
);

// ----------------------------------------------------------------------------
// Vendor quotes — vendor pricing responses to an RFQ
// ----------------------------------------------------------------------------

export const vendorQuotes = pgTable(
  'vendor_quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rfqId: uuid('rfq_id')
      .notNull()
      .references(() => rfqs.id, { onDelete: 'cascade' }),
    rfqRecipientId: uuid('rfq_recipient_id')
      .notNull()
      .references(() => rfqRecipients.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'restrict' }),
    perUnitPrice: numeric('per_unit_price', { precision: 12, scale: 2 }),
    minimumJobCharge: numeric('minimum_job_charge', { precision: 12, scale: 2 }),
    stopFee: numeric('stop_fee', { precision: 12, scale: 2 }),
    fuelSurcharge: numeric('fuel_surcharge', { precision: 12, scale: 2 }),
    otherFees: numeric('other_fees', { precision: 12, scale: 2 }),
    totalEstimate: numeric('total_estimate', { precision: 12, scale: 2 }).notNull(),
    earliestPickupDate: date('earliest_pickup_date'),
    conditions: text('conditions'),
    // Structured line items for richer display/audit
    lineItems: jsonb('line_items'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('vendor_quotes_recipient_key').on(t.rfqRecipientId),
    index('vendor_quotes_rfq_id_idx').on(t.rfqId),
    index('vendor_quotes_vendor_id_idx').on(t.vendorId),
  ],
);

// ----------------------------------------------------------------------------
// Quotes — customer-facing quote issued to the generator
// ----------------------------------------------------------------------------

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

export const quotes = pgTable(
  'quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    // Lane 2 quotes derive from a chosen vendor quote; Lane 1 quotes do not
    vendorQuoteId: uuid('vendor_quote_id').references(() => vendorQuotes.id, {
      onDelete: 'set null',
    }),
    state: quoteStateEnum('state').notNull().default('draft'),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
    fees: numeric('fees', { precision: 12, scale: 2 }).notNull().default('0'),
    total: numeric('total', { precision: 12, scale: 2 }).notNull(),
    depositPercent: numeric('deposit_percent', { precision: 5, scale: 2 }).notNull().default('60'),
    lineItems: jsonb('line_items').notNull(),
    termsVersion: integer('terms_version').notNull(),
    validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('quotes_job_id_idx').on(t.jobId),
    index('quotes_state_idx').on(t.state),
    index('quotes_valid_until_idx').on(t.validUntil),
  ],
);

// ============================================================================
// Group 5 — Compliance: obligations, calendar, non-compliant events, manifests
// ============================================================================

export const obligationTypeEnum = pgEnum('obligation_type', [
  'accumulation_limit',
  'biennial_report',
  'annual_training',
  'generator_fee',
  'contingency_plan_review',
  'emergency_coordinator_review',
  'inspection_readiness',
  'ldr_notification',
  'epa_id_registration',
  'state_specific',
]);

export const deadlineTypeEnum = pgEnum('deadline_type', [
  'fixed_date',
  'rolling_from_accumulation_start',
  'annual',
  'biennial',
  'on_change',
  'on_generation',
]);

export const calendarEntryStatusEnum = pgEnum('calendar_entry_status', [
  'upcoming',
  'due_soon',
  'overdue',
  'completed',
  'dismissed',
  'waived',
]);

export const nonCompliantPathwayEnum = pgEnum('non_compliant_pathway', [
  'reclassify',
  'return_to_generator',
  'emergency_pickup',
  'on_site_stabilization',
  'pending_decision',
]);

export const nonCompliantStateEnum = pgEnum('non_compliant_state', [
  'reported',
  'investigating',
  'awaiting_generator_approval',
  'remedial_in_progress',
  'resolved',
  'disputed',
  'closed',
]);

export const manifestStateEnum = pgEnum('manifest_state', [
  'draft',
  'submitted',
  'transporter_signed',
  'tsdf_signed',
  'completed',
  'rejected',
  'amended',
  'cancelled',
]);

export const unitOfMeasureEnum = pgEnum('unit_of_measure', [
  'pounds',
  'kilograms',
  'gallons',
  'liters',
  'cubic_yards',
  'tons',
]);

// ----------------------------------------------------------------------------
// Compliance obligations — derived from the rules engine per generator
// ----------------------------------------------------------------------------

export const complianceObligations = pgTable(
  'compliance_obligations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    generatorId: uuid('generator_id')
      .notNull()
      .references(() => generators.id, { onDelete: 'cascade' }),
    generatorLocationId: uuid('generator_location_id').references(() => generatorLocations.id, {
      onDelete: 'cascade',
    }),
    obligationType: obligationTypeEnum('obligation_type').notNull(),
    wasteFramework: wasteFrameworkEnum('waste_framework'),
    wasteStreamKey: text('waste_stream_key'),
    title: text('title').notNull(),
    description: text('description'),
    citation: text('citation'),
    deadlineType: deadlineTypeEnum('deadline_type').notNull(),
    deadlineDays: integer('deadline_days'),
    state: text('state'), // state code when state-specific
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('compliance_obligations_generator_id_idx').on(t.generatorId),
    index('compliance_obligations_location_id_idx').on(t.generatorLocationId),
    index('compliance_obligations_type_idx').on(t.obligationType),
    index('compliance_obligations_active_idx').on(t.active),
  ],
);

// ----------------------------------------------------------------------------
// Compliance calendar entries — individual deadline events
// ----------------------------------------------------------------------------

export const complianceCalendarEntries = pgTable(
  'compliance_calendar_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    generatorId: uuid('generator_id')
      .notNull()
      .references(() => generators.id, { onDelete: 'cascade' }),
    generatorLocationId: uuid('generator_location_id').references(() => generatorLocations.id, {
      onDelete: 'cascade',
    }),
    obligationId: uuid('obligation_id').references(() => complianceObligations.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    description: text('description'),
    citation: text('citation'),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    status: calendarEntryStatusEnum('status').notNull().default('upcoming'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: text('completed_by'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('compliance_calendar_generator_id_idx').on(t.generatorId),
    index('compliance_calendar_due_at_idx').on(t.dueAt),
    index('compliance_calendar_status_idx').on(t.status),
    index('compliance_calendar_obligation_id_idx').on(t.obligationId),
  ],
);

// ----------------------------------------------------------------------------
// Non-compliant waste events — flagged during pickup/assessment
// ----------------------------------------------------------------------------

export const nonCompliantWasteEvents = pgTable(
  'non_compliant_waste_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'restrict' }),
    generatorId: uuid('generator_id')
      .notNull()
      .references(() => generators.id, { onDelete: 'restrict' }),
    reportingVendorId: uuid('reporting_vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'restrict' }),
    reportedByContact: text('reported_by_contact'),
    declared: text('declared').notNull(),
    found: text('found').notNull(),
    assessment: text('assessment'),
    recommendedPathway: nonCompliantPathwayEnum('recommended_pathway')
      .notNull()
      .default('pending_decision'),
    chosenPathway: nonCompliantPathwayEnum('chosen_pathway'),
    state: nonCompliantStateEnum('state').notNull().default('reported'),
    quotedRemedialCost: numeric('quoted_remedial_cost', { precision: 12, scale: 2 }),
    remedialVendorId: uuid('remedial_vendor_id').references(() => vendors.id, {
      onDelete: 'set null',
    }),
    remedialJobId: uuid('remedial_job_id').references(() => jobs.id, { onDelete: 'set null' }),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNotes: text('resolution_notes'),
    photos: text('photos').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('non_compliant_job_id_idx').on(t.jobId),
    index('non_compliant_generator_id_idx').on(t.generatorId),
    index('non_compliant_state_idx').on(t.state),
    index('non_compliant_reported_at_idx').on(t.reportedAt),
  ],
);

// ----------------------------------------------------------------------------
// Manifests — e-Manifest records (CDX integration in Phase 9)
// ----------------------------------------------------------------------------

export const manifests = pgTable(
  'manifests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'restrict' }),
    manifestTrackingNumber: text('manifest_tracking_number'),
    state: manifestStateEnum('state').notNull().default('draft'),
    generatorEpaId: text('generator_epa_id').notNull(),
    transporterEpaId: text('transporter_epa_id'),
    tsdfEpaId: text('tsdf_epa_id'),
    wasteCodes: text('waste_codes').array(),
    containerCount: integer('container_count'),
    totalQuantity: numeric('total_quantity', { precision: 12, scale: 3 }),
    unitOfMeasure: unitOfMeasureEnum('unit_of_measure'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    generatorSignedAt: timestamp('generator_signed_at', { withTimezone: true }),
    transporterSignedAt: timestamp('transporter_signed_at', { withTimezone: true }),
    tsdfSignedAt: timestamp('tsdf_signed_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    cdxSubmissionId: text('cdx_submission_id'),
    pdfUrl: text('pdf_url'),
    // Full manifest payload as-submitted, for audit replay
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('manifests_tracking_number_key')
      .on(t.manifestTrackingNumber)
      .where(sql`${t.manifestTrackingNumber} IS NOT NULL`),
    index('manifests_job_id_idx').on(t.jobId),
    index('manifests_state_idx').on(t.state),
    index('manifests_generator_epa_id_idx').on(t.generatorEpaId),
  ],
);
