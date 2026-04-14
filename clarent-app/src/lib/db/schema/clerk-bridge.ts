// Clerk identity bridge — app_users, app_organizations, app_memberships
//
// Part of the Clarent Drizzle schema. See schema/index.ts for the
// full export surface. SQL migrations live in supabase/migrations/
// and are applied via the Supabase CLI.

import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { generators, vendors } from './core';

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
