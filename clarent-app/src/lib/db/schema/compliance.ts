// Compliance — obligations, calendar, non-compliant events, manifests
//
// Part of the Clarent Drizzle schema. See schema/index.ts for the
// full export surface. SQL migrations live in supabase/migrations/
// and are applied via the Supabase CLI.

import { sql } from 'drizzle-orm';
import {
  boolean,
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

import { generators, generatorLocations, vendors, wasteFrameworkEnum } from './core';
import { jobs } from './operational';

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
