// Drizzle schema — Clarent Environmental
//
// Source of truth for runtime types and the query builder. SQL migrations
// live in `supabase/migrations/` and are applied via the Supabase CLI
// (see memory: feedback_clarent_migrations.md).
//
// Schema is built up in groups, one migration per group. Current groups:
//   1. Core entities — generators, vendors, and their related master data
//
// TODO (future phases):
//   2. Reference data (waste codes, DOT hazmat, chemicals, regulations)
//   3. Operational (jobs, state machine, certifications, rfqs, quotes)
//   4. Financial (invoices, payments, payouts)
//   5. Compliance (obligations, calendar, manifests)
//   6. Pricing (zones, vendor pricing, markup, lane1 cache)
//   7. Infrastructure (audit log, communication log, documents, incidents)

import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
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
