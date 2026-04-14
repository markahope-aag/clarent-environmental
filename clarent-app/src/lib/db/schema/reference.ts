// Reference data — waste codes, streams, hazmat, chemicals, regulations
//
// Part of the Clarent Drizzle schema. See schema/index.ts for the
// full export surface. SQL migrations live in supabase/migrations/
// and are applied via the Supabase CLI.

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

import { wasteFrameworkEnum } from './core';
import { obligationTypeEnum } from './compliance';

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
