// RLS isolation tests.
//
// Each test inserts fixture rows in a transaction (as the default postgres
// role, which bypasses RLS), then switches to `authenticated` with a mocked
// Clerk JWT via set_config('request.jwt.claims', ...), runs reads, asserts
// the expected visibility, then rolls the transaction back so nothing is
// committed.
//
// The RLS policies under test are in supabase/migrations/20260414163651_rls_policies.sql.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

type Sql = ReturnType<typeof postgres>;

let sql: Sql;

beforeAll(() => {
  sql = postgres(env.DATABASE_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
    connect_timeout: 10,
  });
});

afterAll(async () => {
  await sql?.end();
});

/**
 * Run a test body inside a transaction that will always roll back, so
 * nothing the test writes is committed. Throws a sentinel error at the
 * end and catches it at the call site to trigger postgres.js rollback.
 */
async function inRollback<T>(fn: (tx: Sql) => Promise<T>): Promise<T> {
  const sentinel = '__rls_test_rollback__';
  let captured: T | undefined;
  try {
    await sql.begin(async (tx) => {
      captured = await fn(tx as unknown as Sql);
      throw new Error(sentinel);
    });
  } catch (err) {
    if (!(err instanceof Error) || err.message !== sentinel) {
      throw err;
    }
  }
  return captured as T;
}

/**
 * Switch the current transaction into the `authenticated` role with a
 * mocked Clerk JWT. Subsequent queries run under RLS.
 */
async function impersonate(tx: Sql, claims: Record<string, unknown>): Promise<void> {
  const json = JSON.stringify(claims);
  await tx.unsafe(`SELECT set_config('request.jwt.claims', '${json.replace(/'/g, "''")}', true)`);
  await tx.unsafe('SET LOCAL ROLE authenticated');
}

describe('RLS: helper functions', () => {
  it('current_clerk_user_id() reads sub from JWT claims', async () => {
    await inRollback(async (tx) => {
      await impersonate(tx, { sub: 'user_test_abc' });
      const [row] = await tx`SELECT public.current_clerk_user_id() AS id`;
      expect(row.id).toBe('user_test_abc');
    });
  });

  it('current_clerk_org_id() reads org_id from JWT claims', async () => {
    await inRollback(async (tx) => {
      await impersonate(tx, { sub: 'user_test_abc', org_id: 'org_test_xyz' });
      const [row] = await tx`SELECT public.current_clerk_org_id() AS id`;
      expect(row.id).toBe('org_test_xyz');
    });
  });
});

describe('RLS: generator isolation', () => {
  it('generator A cannot see generator B jobs', async () => {
    await inRollback(async (tx) => {
      // Set up two generators with distinct Clerk org IDs
      const [genA] = await tx`
        INSERT INTO generators (name, account_notes)
        VALUES ('Test Gen A', '__rls_test__')
        RETURNING id
      `;
      const [genB] = await tx`
        INSERT INTO generators (name, account_notes)
        VALUES ('Test Gen B', '__rls_test__')
        RETURNING id
      `;
      const [locA] = await tx`
        INSERT INTO generator_locations (generator_id, name, state, is_primary)
        VALUES (${genA.id}, 'Site A', 'WI', true)
        RETURNING id
      `;
      const [locB] = await tx`
        INSERT INTO generator_locations (generator_id, name, state, is_primary)
        VALUES (${genB.id}, 'Site B', 'IL', true)
        RETURNING id
      `;

      await tx`
        INSERT INTO app_organizations (clerk_organization_id, organization_type, generator_id, name)
        VALUES ('org_rls_a', 'generator', ${genA.id}, 'Test Gen A')
      `;
      await tx`
        INSERT INTO app_organizations (clerk_organization_id, organization_type, generator_id, name)
        VALUES ('org_rls_b', 'generator', ${genB.id}, 'Test Gen B')
      `;

      const refA = `CLR-RLS-${Math.random().toString(36).slice(2, 8)}-A`;
      const refB = `CLR-RLS-${Math.random().toString(36).slice(2, 8)}-B`;
      await tx`
        INSERT INTO jobs (reference_number, generator_id, generator_location_id, state, lane, waste_framework)
        VALUES (${refA}, ${genA.id}, ${locA.id}, 'draft', 'lane_1', 'rcra_hazardous')
      `;
      await tx`
        INSERT INTO jobs (reference_number, generator_id, generator_location_id, state, lane, waste_framework)
        VALUES (${refB}, ${genB.id}, ${locB.id}, 'draft', 'lane_1', 'rcra_hazardous')
      `;

      // Impersonate generator A's context
      await impersonate(tx, { sub: 'user_a', org_id: 'org_rls_a' });

      const visible = await tx`
        SELECT reference_number FROM jobs
        WHERE reference_number IN (${refA}, ${refB})
        ORDER BY reference_number
      `;

      await tx.unsafe('RESET ROLE');

      expect(visible).toHaveLength(1);
      expect(visible[0].reference_number).toBe(refA);
    });
  });

  it('generator cannot see another generator record', async () => {
    await inRollback(async (tx) => {
      const [genA] = await tx`
        INSERT INTO generators (name, account_notes)
        VALUES ('RLS Gen A', '__rls_test__')
        RETURNING id
      `;
      const [genB] = await tx`
        INSERT INTO generators (name, account_notes)
        VALUES ('RLS Gen B', '__rls_test__')
        RETURNING id
      `;
      await tx`
        INSERT INTO app_organizations (clerk_organization_id, organization_type, generator_id, name)
        VALUES ('org_rls_aa', 'generator', ${genA.id}, 'RLS Gen A')
      `;
      await tx`
        INSERT INTO app_organizations (clerk_organization_id, organization_type, generator_id, name)
        VALUES ('org_rls_bb', 'generator', ${genB.id}, 'RLS Gen B')
      `;

      await impersonate(tx, { sub: 'user_aa', org_id: 'org_rls_aa' });
      const visible = await tx`
        SELECT id FROM generators WHERE id IN (${genA.id}, ${genB.id})
      `;
      await tx.unsafe('RESET ROLE');

      expect(visible).toHaveLength(1);
      expect(visible[0].id).toBe(genA.id);
    });
  });
});

describe('RLS: vendor post-award visibility', () => {
  it('vendor sees jobs only after vendor_notified state', async () => {
    await inRollback(async (tx) => {
      const [gen] = await tx`
        INSERT INTO generators (name, account_notes)
        VALUES ('RLS Gen V', '__rls_test__')
        RETURNING id
      `;
      const [loc] = await tx`
        INSERT INTO generator_locations (generator_id, name, state, is_primary)
        VALUES (${gen.id}, 'Site', 'WI', true)
        RETURNING id
      `;
      const [vendor] = await tx`
        INSERT INTO vendors (name, vendor_type, notes)
        VALUES ('RLS Vendor', 'transporter', '__rls_test__')
        RETURNING id
      `;
      await tx`
        INSERT INTO app_organizations (clerk_organization_id, organization_type, vendor_id, name)
        VALUES ('org_rls_v', 'vendor', ${vendor.id}, 'RLS Vendor')
      `;

      // Job in pre-award state (selected_vendor_id set, state = vendor_selected)
      const refPre = `CLR-RLS-${Math.random().toString(36).slice(2, 8)}-PRE`;
      await tx`
        INSERT INTO jobs (reference_number, generator_id, generator_location_id, state, lane, waste_framework, selected_vendor_id)
        VALUES (${refPre}, ${gen.id}, ${loc.id}, 'vendor_selected', 'lane_1', 'rcra_hazardous', ${vendor.id})
      `;
      // Job in post-award state
      const refPost = `CLR-RLS-${Math.random().toString(36).slice(2, 8)}-POST`;
      await tx`
        INSERT INTO jobs (reference_number, generator_id, generator_location_id, state, lane, waste_framework, selected_vendor_id)
        VALUES (${refPost}, ${gen.id}, ${loc.id}, 'pickup_scheduled', 'lane_1', 'rcra_hazardous', ${vendor.id})
      `;

      await impersonate(tx, { sub: 'user_v', org_id: 'org_rls_v' });
      const visible = await tx`
        SELECT reference_number FROM jobs
        WHERE reference_number IN (${refPre}, ${refPost})
      `;
      await tx.unsafe('RESET ROLE');

      expect(visible).toHaveLength(1);
      expect(visible[0].reference_number).toBe(refPost);
    });
  });
});

describe('RLS: reference data broad read', () => {
  it('authenticated user with no org can read waste_streams', async () => {
    await inRollback(async (tx) => {
      await impersonate(tx, { sub: 'user_anon_authed' });
      const rows = await tx`
        SELECT key FROM waste_streams WHERE active = true LIMIT 5
      `;
      await tx.unsafe('RESET ROLE');
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  it('authenticated user cannot read generators table without a matching org', async () => {
    await inRollback(async (tx) => {
      await tx`
        INSERT INTO generators (name, account_notes)
        VALUES ('Hidden Gen', '__rls_test__')
      `;
      // No app_organizations row for this user's org_id → current_generator_id() returns null
      await impersonate(tx, { sub: 'user_noorg', org_id: 'org_nonexistent' });
      const rows = await tx`SELECT id FROM generators WHERE account_notes = '__rls_test__'`;
      await tx.unsafe('RESET ROLE');
      expect(rows).toHaveLength(0);
    });
  });
});
