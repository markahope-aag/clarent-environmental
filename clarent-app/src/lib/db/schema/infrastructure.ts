// Infrastructure — audit log, communication log, documents, incidents
//
// Part of the Clarent Drizzle schema. See schema/index.ts for the
// full export surface. SQL migrations live in supabase/migrations/
// and are applied via the Supabase CLI.

import {
  date,
  index,
  integer,
  jsonb,
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

export const communicationDirectionEnum = pgEnum('communication_direction', [
  'outbound',
  'inbound',
]);

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
