// Drizzle schema — Clarent Environmental
//
// Source of truth for runtime types and the query builder. SQL migrations
// live in `supabase/migrations/` and are applied via the Supabase CLI
// (see memory: feedback_clarent_migrations.md).
//
// Schema is built up in groups, one migration per group. Current groups:
//   1. Core entities — generators, vendors, and their related master data
//   2. Reference data — waste codes, streams, hazmat, chemicals, regulations
//   3. Operational — jobs, state machine, certifications, rfqs, quotes
//   4. Financial — invoices, invoice line items, payments, payouts
//   5. Compliance — obligations, calendar entries, non-compliant events, manifests
//   6. Pricing — pricing zones, vendor pricing, markup policies, lane1 cache, commodity values
//   7. Infrastructure — audit log, communication log, documents, incidents
//
// Note: this file is large (~2000 lines). A follow-up refactor will split
// it into src/lib/db/schema/<group>.ts files.

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
    // Populated when the generator signs up via Clerk (each generator = one Clerk org)
    clerkOrganizationId: text('clerk_organization_id'),
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
    uniqueIndex('generators_clerk_organization_id_key')
      .on(t.clerkOrganizationId)
      .where(sql`${t.clerkOrganizationId} IS NOT NULL`),
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
    // Populated when vendor signs up via Clerk (each vendor = one Clerk org)
    clerkOrganizationId: text('clerk_organization_id'),
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
    uniqueIndex('vendors_clerk_organization_id_key')
      .on(t.clerkOrganizationId)
      .where(sql`${t.clerkOrganizationId} IS NOT NULL`),
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

// ============================================================================
// Group 6 — Pricing: zones, vendor pricing, markup policies, lane1 cache,
// commodity values
// ============================================================================

export const complexityTierEnum = pgEnum('complexity_tier', [
  'lane_1_standard',
  'lane_2_simple',
  'lane_2_complex',
]);

// ----------------------------------------------------------------------------
// Pricing zones — geographic buckets for pricing
// ----------------------------------------------------------------------------

export const pricingZones = pgTable(
  'pricing_zones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    state: text('state'),
    zipPrefixes: text('zip_prefixes').array(),
    centerLat: numeric('center_lat', { precision: 9, scale: 6 }),
    centerLng: numeric('center_lng', { precision: 9, scale: 6 }),
    radiusMiles: integer('radius_miles'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('pricing_zones_name_key').on(t.name),
    index('pricing_zones_state_idx').on(t.state),
    index('pricing_zones_active_idx').on(t.active),
  ],
);

// ----------------------------------------------------------------------------
// Vendor pricing — rate table per vendor/zone/stream
// ----------------------------------------------------------------------------

export const vendorPricing = pgTable(
  'vendor_pricing',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    pricingZoneId: uuid('pricing_zone_id').references(() => pricingZones.id, {
      onDelete: 'set null',
    }),
    wasteFramework: wasteFrameworkEnum('waste_framework').notNull(),
    wasteStreamKey: text('waste_stream_key'),
    containerType: text('container_type'),
    perUnitPrice: numeric('per_unit_price', { precision: 12, scale: 2 }).notNull(),
    minimumJobCharge: numeric('minimum_job_charge', { precision: 12, scale: 2 }),
    stopFee: numeric('stop_fee', { precision: 12, scale: 2 }),
    fuelSurchargePct: numeric('fuel_surcharge_pct', { precision: 5, scale: 2 }),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('vendor_pricing_vendor_id_idx').on(t.vendorId),
    index('vendor_pricing_zone_id_idx').on(t.pricingZoneId),
    index('vendor_pricing_framework_idx').on(t.wasteFramework),
    index('vendor_pricing_stream_idx').on(t.wasteStreamKey),
    index('vendor_pricing_effective_from_idx').on(t.effectiveFrom),
  ],
);

// ----------------------------------------------------------------------------
// Markup policies — margin rules applied during pricing
// ----------------------------------------------------------------------------

export const markupPolicies = pgTable(
  'markup_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    wasteFramework: wasteFrameworkEnum('waste_framework'),
    complexityTier: complexityTierEnum('complexity_tier').notNull(),
    markupPct: numeric('markup_pct', { precision: 6, scale: 2 }).notNull(),
    markupFloorAmount: numeric('markup_floor_amount', { precision: 12, scale: 2 }),
    markupCeilingAmount: numeric('markup_ceiling_amount', { precision: 12, scale: 2 }),
    marginFloorPct: numeric('margin_floor_pct', { precision: 5, scale: 2 }).notNull(),
    marginCeilingPct: numeric('margin_ceiling_pct', { precision: 5, scale: 2 }),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    active: boolean('active').notNull().default(true),
    // Higher priority wins when multiple policies overlap
    priority: integer('priority').notNull().default(100),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('markup_policies_framework_idx').on(t.wasteFramework),
    index('markup_policies_tier_idx').on(t.complexityTier),
    index('markup_policies_active_idx').on(t.active),
  ],
);

// ----------------------------------------------------------------------------
// Lane 1 price cache — pre-calculated instant quote matrix
// ----------------------------------------------------------------------------

export const lane1PriceCache = pgTable(
  'lane1_price_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pricingZoneId: uuid('pricing_zone_id')
      .notNull()
      .references(() => pricingZones.id, { onDelete: 'cascade' }),
    wasteStreamKey: text('waste_stream_key').notNull(),
    containerType: text('container_type').notNull(),
    minContainers: integer('min_containers').notNull().default(1),
    maxContainers: integer('max_containers'),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    stopFee: numeric('stop_fee', { precision: 12, scale: 2 }).notNull().default('0'),
    minimumCharge: numeric('minimum_charge', { precision: 12, scale: 2 }).notNull().default('0'),
    estimatedTotal: numeric('estimated_total', { precision: 12, scale: 2 }).notNull(),
    confidence: numeric('confidence', { precision: 5, scale: 2 }),
    sourceVendorIds: uuid('source_vendor_ids').array(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('lane1_cache_zone_stream_container_key')
      .on(t.pricingZoneId, t.wasteStreamKey, t.containerType)
      .where(sql`${t.active} IS TRUE`),
    index('lane1_cache_stream_idx').on(t.wasteStreamKey),
    index('lane1_cache_expires_at_idx').on(t.expiresAt),
  ],
);

// ----------------------------------------------------------------------------
// Commodity values — market rates for recoverable streams
// ----------------------------------------------------------------------------

export const commodityValues = pgTable(
  'commodity_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    wasteStreamKey: text('waste_stream_key').notNull(),
    valuePerUnit: numeric('value_per_unit', { precision: 12, scale: 4 }).notNull(),
    unit: text('unit').notNull(),
    source: text('source').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('commodity_values_stream_idx').on(t.wasteStreamKey),
    index('commodity_values_effective_from_idx').on(t.effectiveFrom),
  ],
);

// ============================================================================
// Group 7 — Infrastructure: audit log, communication log, documents, incidents
// ============================================================================

export const auditActionEnum = pgEnum('audit_action', [
  'insert',
  'update',
  'delete',
  'state_transition',
  'login',
  'export',
  'manual_override',
]);

export const actorTypeEnum = pgEnum('actor_type', [
  'system',
  'user_generator',
  'user_vendor',
  'user_ops',
  'service_role',
  'workflow',
  'webhook',
]);

export const communicationChannelEnum = pgEnum('communication_channel', [
  'email',
  'sms',
  'portal_notification',
  'phone',
  'slack',
  'webhook',
  'letter',
]);

export const communicationDirectionEnum = pgEnum('communication_direction', ['outbound', 'inbound']);

export const communicationStateEnum = pgEnum('communication_state', [
  'queued',
  'sending',
  'sent',
  'delivered',
  'failed',
  'bounced',
  'opened',
  'clicked',
  'replied',
]);

export const documentRelatedTypeEnum = pgEnum('document_related_type', [
  'job',
  'generator',
  'generator_location',
  'vendor',
  'invoice',
  'manifest',
  'certification',
  'rfq',
  'vendor_quote',
  'non_compliant_event',
]);

export const documentTypeEnum = pgEnum('document_type', [
  'intake_photo',
  'sds',
  'vendor_license',
  'vendor_insurance_certificate',
  'vendor_permit',
  'invoice_pdf',
  'manifest_pdf',
  'certificate_of_disposal',
  'ldr_notification',
  'land_ban_certification',
  'work_order',
  'quote_pdf',
  'generator_certification',
  'pickup_confirmation',
  'non_compliant_report',
  'misc',
]);

export const documentAccessPolicyEnum = pgEnum('document_access_policy', [
  'generator_visible',
  'vendor_visible',
  'ops_only',
  'public',
]);

export const incidentCategoryEnum = pgEnum('incident_category', [
  'workflow_failure',
  'payment_failure',
  'vendor_no_response',
  'non_compliant_waste',
  'system_error',
  'manual_override',
  'dispute',
  'data_quality',
  'security',
  'cdx_submission_error',
]);

export const incidentSeverityEnum = pgEnum('incident_severity', [
  'low',
  'medium',
  'high',
  'critical',
]);

export const incidentStateEnum = pgEnum('incident_state', [
  'open',
  'acknowledged',
  'investigating',
  'resolved',
  'wont_fix',
]);

// ----------------------------------------------------------------------------
// Audit log — append-only record of every state change
// ----------------------------------------------------------------------------

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    action: auditActionEnum('action').notNull(),
    actorType: actorTypeEnum('actor_type').notNull(),
    actorId: text('actor_id'),
    actorLabel: text('actor_label'),
    // Diff snapshot: { before: {...}, after: {...}, changed_fields: [...] }
    diff: jsonb('diff'),
    metadata: jsonb('metadata'),
    reason: text('reason'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
    index('audit_log_actor_idx').on(t.actorType, t.actorId),
    index('audit_log_action_idx').on(t.action),
    index('audit_log_created_at_idx').on(t.createdAt),
  ],
);

// ----------------------------------------------------------------------------
// Communication log — all outbound/inbound messages
// ----------------------------------------------------------------------------

export const communicationLog = pgTable(
  'communication_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channel: communicationChannelEnum('channel').notNull(),
    direction: communicationDirectionEnum('direction').notNull().default('outbound'),
    relatedJobId: uuid('related_job_id').references(() => jobs.id, { onDelete: 'set null' }),
    relatedGeneratorId: uuid('related_generator_id').references(() => generators.id, {
      onDelete: 'set null',
    }),
    relatedVendorId: uuid('related_vendor_id').references(() => vendors.id, {
      onDelete: 'set null',
    }),
    templateKey: text('template_key'),
    subject: text('subject'),
    body: text('body'),
    recipient: text('recipient').notNull(),
    sender: text('sender'),
    state: communicationStateEnum('state').notNull().default('queued'),
    provider: text('provider'),
    providerMessageId: text('provider_message_id'),
    errorMessage: text('error_message'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    clickedAt: timestamp('clicked_at', { withTimezone: true }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('comm_log_job_id_idx').on(t.relatedJobId),
    index('comm_log_generator_id_idx').on(t.relatedGeneratorId),
    index('comm_log_vendor_id_idx').on(t.relatedVendorId),
    index('comm_log_channel_idx').on(t.channel),
    index('comm_log_state_idx').on(t.state),
    index('comm_log_template_key_idx').on(t.templateKey),
    index('comm_log_provider_message_id_idx').on(t.providerMessageId),
  ],
);

// ----------------------------------------------------------------------------
// Documents — files linked to any entity
// ----------------------------------------------------------------------------

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    relatedType: documentRelatedTypeEnum('related_type').notNull(),
    relatedId: uuid('related_id').notNull(),
    documentType: documentTypeEnum('document_type').notNull(),
    name: text('name').notNull(),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes'),
    storageBucket: text('storage_bucket').notNull(),
    storagePath: text('storage_path').notNull(),
    accessPolicy: documentAccessPolicyEnum('access_policy').notNull().default('ops_only'),
    uploadedByActorType: actorTypeEnum('uploaded_by_actor_type'),
    uploadedByActorId: text('uploaded_by_actor_id'),
    version: integer('version').notNull().default(1),
    supersededByDocumentId: uuid('superseded_by_document_id'),
    // RCRA 3-year retention — set on creation
    retentionUntil: date('retention_until'),
    sha256: text('sha256'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('documents_related_idx').on(t.relatedType, t.relatedId),
    index('documents_document_type_idx').on(t.documentType),
    index('documents_access_policy_idx').on(t.accessPolicy),
    uniqueIndex('documents_storage_path_key').on(t.storageBucket, t.storagePath),
  ],
);

// ----------------------------------------------------------------------------
// Incidents — operational exception log
// ----------------------------------------------------------------------------

export const incidents = pgTable(
  'incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    category: incidentCategoryEnum('category').notNull(),
    severity: incidentSeverityEnum('severity').notNull().default('medium'),
    title: text('title').notNull(),
    description: text('description'),
    relatedEntityType: text('related_entity_type'),
    relatedEntityId: uuid('related_entity_id'),
    state: incidentStateEnum('state').notNull().default('open'),
    assignedTo: text('assigned_to'),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolution: text('resolution'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('incidents_category_idx').on(t.category),
    index('incidents_severity_idx').on(t.severity),
    index('incidents_state_idx').on(t.state),
    index('incidents_related_entity_idx').on(t.relatedEntityType, t.relatedEntityId),
    index('incidents_detected_at_idx').on(t.detectedAt),
  ],
);

// ============================================================================
// Group 2 — Reference data: waste codes, streams, hazmat, chemicals, regulations
// ============================================================================

export const wasteCodeSeriesEnum = pgEnum('waste_code_series', ['D', 'F', 'K', 'P', 'U']);

export const laneEligibilityEnum = pgEnum('lane_eligibility', ['lane_1', 'lane_2', 'both']);

export const characteristicTypeEnum = pgEnum('characteristic_type', [
  'ignitability',
  'corrosivity',
  'reactivity',
  'toxicity',
  'physical_state',
  'compatibility',
]);

export const regulationSourceEnum = pgEnum('regulation_source', [
  'federal_cfr',
  'state_statute',
  'state_regulation',
  'epa_guidance',
  'dot',
  'osha',
  'tribal',
]);

export const transportModeEnum = pgEnum('transport_mode', ['road', 'rail', 'air', 'water']);

export const stateOverlayTypeEnum = pgEnum('state_overlay_type', [
  'state_waste_code',
  'stricter_rule',
  'additional_requirement',
  'exemption',
]);

export const conflictResolutionEnum = pgEnum('conflict_resolution_method', [
  'federal_wins',
  'state_wins',
  'more_stringent_wins',
  'dual_requirement',
]);

// ----------------------------------------------------------------------------
// waste_frameworks — metadata for the waste_framework enum values
// ----------------------------------------------------------------------------

export const wasteFrameworks = pgTable(
  'waste_frameworks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: wasteFrameworkEnum('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    citation: text('citation'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('waste_frameworks_key_key').on(t.key)],
);

// ----------------------------------------------------------------------------
// waste_codes — EPA waste codes (D-list characteristics, F/K-list source,
// P/U-list commercial chemicals)
// ----------------------------------------------------------------------------

export const wasteCodes = pgTable(
  'waste_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    series: wasteCodeSeriesEnum('series').notNull(),
    description: text('description').notNull(),
    listingBasis: text('listing_basis'),
    hazardCodes: text('hazard_codes').array(),
    citation: text('citation'),
    isAcuteHazardous: boolean('is_acute_hazardous').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('waste_codes_code_key').on(t.code),
    index('waste_codes_series_idx').on(t.series),
    index('waste_codes_is_acute_hazardous_idx').on(t.isAcuteHazardous),
  ],
);

// ----------------------------------------------------------------------------
// waste_streams — normalized commercial waste streams (classification targets)
// ----------------------------------------------------------------------------

export const wasteStreams = pgTable(
  'waste_streams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    wasteFramework: wasteFrameworkEnum('waste_framework').notNull(),
    typicalWasteCodes: text('typical_waste_codes').array(),
    laneEligibility: laneEligibilityEnum('lane_eligibility').notNull().default('lane_2'),
    industryHints: text('industry_hints').array(),
    typicalContainerTypes: text('typical_container_types').array(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('waste_streams_key_key').on(t.key),
    index('waste_streams_framework_idx').on(t.wasteFramework),
    index('waste_streams_lane_idx').on(t.laneEligibility),
    index('waste_streams_active_idx').on(t.active),
  ],
);

// ----------------------------------------------------------------------------
// waste_stream_characteristics — ignitability, corrosivity, etc. per stream
// ----------------------------------------------------------------------------

export const wasteStreamCharacteristics = pgTable(
  'waste_stream_characteristics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    wasteStreamId: uuid('waste_stream_id')
      .notNull()
      .references(() => wasteStreams.id, { onDelete: 'cascade' }),
    characteristic: characteristicTypeEnum('characteristic').notNull(),
    value: text('value').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('waste_stream_characteristics_stream_id_idx').on(t.wasteStreamId)],
);

// ----------------------------------------------------------------------------
// dot_hazmat_table — 49 CFR 172.101 Hazardous Materials Table
// ----------------------------------------------------------------------------

export const dotHazmatTable = pgTable(
  'dot_hazmat_table',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    properShippingName: text('proper_shipping_name').notNull(),
    unNumber: text('un_number'),
    hazardClass: text('hazard_class').notNull(),
    subsidiaryHazards: text('subsidiary_hazards').array(),
    packingGroup: text('packing_group'),
    labels: text('labels').array(),
    specialProvisions: text('special_provisions').array(),
    exceptedQuantities: text('excepted_quantities'),
    packagingExceptions: text('packaging_exceptions'),
    packagingNonBulk: text('packaging_non_bulk'),
    packagingBulk: text('packaging_bulk'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('dot_hazmat_un_number_idx').on(t.unNumber),
    index('dot_hazmat_hazard_class_idx').on(t.hazardClass),
    index('dot_hazmat_proper_shipping_name_idx').on(t.properShippingName),
  ],
);

// ----------------------------------------------------------------------------
// placard_requirements — DOT placarding thresholds by hazard class
// ----------------------------------------------------------------------------

export const placardRequirements = pgTable(
  'placard_requirements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hazardClass: text('hazard_class').notNull(),
    thresholdPounds: numeric('threshold_pounds', { precision: 12, scale: 2 }),
    placardType: text('placard_type').notNull(),
    requiresPlacard: boolean('requires_placard').notNull().default(true),
    citation: text('citation'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('placard_requirements_hazard_class_idx').on(t.hazardClass)],
);

// ----------------------------------------------------------------------------
// label_requirements — required container labels by waste code
// ----------------------------------------------------------------------------

export const labelRequirements = pgTable(
  'label_requirements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    wasteCode: text('waste_code').notNull(),
    requiredLabels: text('required_labels').array().notNull(),
    transportMode: transportModeEnum('transport_mode').notNull().default('road'),
    citation: text('citation'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('label_requirements_waste_code_idx').on(t.wasteCode)],
);

// ----------------------------------------------------------------------------
// land_disposal_restrictions — LDR treatment standards by waste code
// ----------------------------------------------------------------------------

export const landDisposalRestrictions = pgTable(
  'land_disposal_restrictions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    wasteCode: text('waste_code').notNull(),
    treatmentStandard: text('treatment_standard').notNull(),
    regulatedConstituents: text('regulated_constituents').array(),
    citation: text('citation'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ldr_waste_code_idx').on(t.wasteCode)],
);

// ----------------------------------------------------------------------------
// chemicals — CAS Registry subset relevant to SQG streams
// ----------------------------------------------------------------------------

export const chemicals = pgTable(
  'chemicals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    casNumber: text('cas_number').notNull(),
    name: text('name').notNull(),
    synonyms: text('synonyms').array(),
    molecularFormula: text('molecular_formula'),
    flashPointC: numeric('flash_point_c', { precision: 8, scale: 2 }),
    boilingPointC: numeric('boiling_point_c', { precision: 8, scale: 2 }),
    likelyWasteCodes: text('likely_waste_codes').array(),
    hazardData: jsonb('hazard_data'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('chemicals_cas_number_key').on(t.casNumber),
    index('chemicals_name_idx').on(t.name),
  ],
);

// ----------------------------------------------------------------------------
// regulations — federal and state regulatory sources
// ----------------------------------------------------------------------------

export const regulations = pgTable(
  'regulations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: regulationSourceEnum('source').notNull(),
    jurisdiction: text('jurisdiction').notNull(),
    citation: text('citation').notNull(),
    title: text('title').notNull(),
    url: text('url'),
    effectiveDate: date('effective_date'),
    amendedDate: date('amended_date'),
    supersededBy: uuid('superseded_by'),
    summary: text('summary'),
    fullText: text('full_text'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('regulations_source_idx').on(t.source),
    index('regulations_jurisdiction_idx').on(t.jurisdiction),
    index('regulations_citation_idx').on(t.citation),
  ],
);

// ----------------------------------------------------------------------------
// regulatory_requirements — individual obligations extracted from regulations
// ----------------------------------------------------------------------------

export const regulatoryRequirements = pgTable(
  'regulatory_requirements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    regulationId: uuid('regulation_id')
      .notNull()
      .references(() => regulations.id, { onDelete: 'cascade' }),
    requirementType: obligationTypeEnum('requirement_type').notNull(),
    description: text('description').notNull(),
    appliesToGeneratorClasses: text('applies_to_generator_classes').array(),
    appliesToWasteFrameworks: text('applies_to_waste_frameworks').array(),
    jurisdiction: text('jurisdiction').notNull(),
    deadlineDays: integer('deadline_days'),
    citation: text('citation'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('regulatory_requirements_regulation_id_idx').on(t.regulationId),
    index('regulatory_requirements_jurisdiction_idx').on(t.jurisdiction),
    index('regulatory_requirements_type_idx').on(t.requirementType),
  ],
);

// ----------------------------------------------------------------------------
// jurisdiction_matrix — state authorization status + key rules
// ----------------------------------------------------------------------------

export const jurisdictionMatrix = pgTable(
  'jurisdiction_matrix',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    state: text('state').notNull(),
    stateName: text('state_name').notNull(),
    rcraAuthorized: boolean('rcra_authorized').notNull().default(false),
    epaRegion: text('epa_region'),
    stateAgency: text('state_agency'),
    agencyUrl: text('agency_url'),
    biennialReportRequired: boolean('biennial_report_required').notNull().default(false),
    biennialReportDeadline: text('biennial_report_deadline'),
    feeScheduleNotes: text('fee_schedule_notes'),
    manifestNotes: text('manifest_notes'),
    lastReviewed: date('last_reviewed'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('jurisdiction_matrix_state_key').on(t.state)],
);

// ----------------------------------------------------------------------------
// state_overlays — state-specific waste codes / stricter rules
// ----------------------------------------------------------------------------

export const stateOverlays = pgTable(
  'state_overlays',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    state: text('state').notNull(),
    overlayType: stateOverlayTypeEnum('overlay_type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    citation: text('citation'),
    appliesToWasteFramework: wasteFrameworkEnum('applies_to_waste_framework'),
    effectiveFrom: date('effective_from'),
    effectiveTo: date('effective_to'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('state_overlays_state_idx').on(t.state),
    index('state_overlays_type_idx').on(t.overlayType),
  ],
);

// ----------------------------------------------------------------------------
// conflict_resolutions — how federal/state conflicts resolve
// ----------------------------------------------------------------------------

export const conflictResolutions = pgTable(
  'conflict_resolutions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    federalRequirementId: uuid('federal_requirement_id').references(
      () => regulatoryRequirements.id,
      { onDelete: 'cascade' },
    ),
    state: text('state').notNull(),
    stateRuleDescription: text('state_rule_description').notNull(),
    resolution: conflictResolutionEnum('resolution').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('conflict_resolutions_federal_requirement_id_idx').on(t.federalRequirementId),
    index('conflict_resolutions_state_idx').on(t.state),
  ],
);

// ============================================================================
// Group 8 — Clerk identity bridge
// ============================================================================
//
// Clerk is the source of truth for user identity and organization membership.
// These tables are a thin local cache kept in sync via Clerk webhooks so that
// Postgres-side joins / RLS policies can resolve Clerk IDs → Clarent entities
// (generators, vendors) without hitting the Clerk API on every query.

export const organizationTypeEnum = pgEnum('organization_type', ['generator', 'vendor', 'ops']);

// ----------------------------------------------------------------------------
// app_users — identity cache keyed by Clerk user ID
// ----------------------------------------------------------------------------

export const appUsers = pgTable(
  'app_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clerkUserId: text('clerk_user_id').notNull(),
    email: text('email'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    imageUrl: text('image_url'),
    clerkCreatedAt: timestamp('clerk_created_at', { withTimezone: true }),
    clerkUpdatedAt: timestamp('clerk_updated_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('app_users_clerk_user_id_key').on(t.clerkUserId),
    index('app_users_email_idx').on(t.email),
  ],
);

// ----------------------------------------------------------------------------
// app_organizations — Clerk org → generator/vendor/ops mapping
// ----------------------------------------------------------------------------

export const appOrganizations = pgTable(
  'app_organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clerkOrganizationId: text('clerk_organization_id').notNull(),
    organizationType: organizationTypeEnum('organization_type').notNull(),
    // Exactly one of these is set depending on type
    generatorId: uuid('generator_id').references(() => generators.id, { onDelete: 'set null' }),
    vendorId: uuid('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    slug: text('slug'),
    imageUrl: text('image_url'),
    clerkCreatedAt: timestamp('clerk_created_at', { withTimezone: true }),
    clerkUpdatedAt: timestamp('clerk_updated_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('app_organizations_clerk_organization_id_key').on(t.clerkOrganizationId),
    index('app_organizations_type_idx').on(t.organizationType),
    index('app_organizations_generator_id_idx').on(t.generatorId),
    index('app_organizations_vendor_id_idx').on(t.vendorId),
  ],
);

// ----------------------------------------------------------------------------
// app_memberships — user ↔ organization membership cache
// ----------------------------------------------------------------------------

export const appMemberships = pgTable(
  'app_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clerkUserId: text('clerk_user_id').notNull(),
    clerkOrganizationId: text('clerk_organization_id').notNull(),
    // Clerk membership role (e.g. 'org:admin', 'org:member')
    role: text('role').notNull(),
    // Additional Clarent-side permissions layered on top
    permissions: text('permissions').array(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('app_memberships_user_org_key').on(t.clerkUserId, t.clerkOrganizationId),
    index('app_memberships_user_idx').on(t.clerkUserId),
    index('app_memberships_org_idx').on(t.clerkOrganizationId),
  ],
);
