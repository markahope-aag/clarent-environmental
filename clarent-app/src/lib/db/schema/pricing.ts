// Pricing — zones, vendor pricing, markup, lane1 cache, commodity
//
// Part of the Clarent Drizzle schema. See schema/index.ts for the
// full export surface. SQL migrations live in supabase/migrations/
// and are applied via the Supabase CLI.

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

import { vendors, wasteFrameworkEnum } from './core';

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
