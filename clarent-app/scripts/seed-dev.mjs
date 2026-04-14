// Synthetic dev seed — 20 generators, 5 vendors, sample jobs.
//
// Idempotent: identifies previously-seeded rows via a marker string in
// notes/account_notes fields ('__dev_seed__') and replaces them on each
// run. Safe to re-run as the schema evolves.
//
// Dev-only guard: refuses to run unless DEV_SEED=1 is explicitly set.
//
// Run: DEV_SEED=1 node scripts/seed-dev.mjs

import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

if (process.env.DEV_SEED !== '1') {
  console.error('Refusing to run without DEV_SEED=1. This script is dev-only.');
  console.error('Use: DEV_SEED=1 node scripts/seed-dev.mjs');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

const MARKER = '__dev_seed__';

// ---------------------------------------------------------------------------
// Synthetic data definitions
// ---------------------------------------------------------------------------

const GENERATORS = [
  // Wisconsin
  { name: 'Madison Auto & Body', class: 'SQG', industry: 'auto_body', city: 'Madison', state: 'WI', zip: '53703' },
  { name: 'Badger Machine Works', class: 'LQG', industry: 'manufacturing', city: 'Milwaukee', state: 'WI', zip: '53202' },
  { name: 'Dane County Dental Group', class: 'VSQG', industry: 'dental', city: 'Madison', state: 'WI', zip: '53719' },
  { name: 'UW-Madison Chemistry Lab', class: 'SQG', industry: 'university_lab', city: 'Madison', state: 'WI', zip: '53706' },
  { name: 'Sheboygan Metal Finishing', class: 'SQG', industry: 'metal_finishing', city: 'Sheboygan', state: 'WI', zip: '53081' },
  { name: 'Green Bay Printers', class: 'VSQG', industry: 'printing', city: 'Green Bay', state: 'WI', zip: '54301' },
  { name: 'Appleton Fleet Services', class: 'SQG', industry: 'fleet_services', city: 'Appleton', state: 'WI', zip: '54911' },
  // Illinois
  { name: 'North Shore Dental Partners', class: 'VSQG', industry: 'dental', city: 'Evanston', state: 'IL', zip: '60201' },
  { name: 'Chicago Industrial Coatings', class: 'SQG', industry: 'coatings', city: 'Chicago', state: 'IL', zip: '60607' },
  { name: 'Aurora Auto Repair', class: 'SQG', industry: 'auto_repair', city: 'Aurora', state: 'IL', zip: '60505' },
  { name: 'Rockford Plastics Co', class: 'LQG', industry: 'plastics', city: 'Rockford', state: 'IL', zip: '61101' },
  { name: 'Champaign Research Labs', class: 'SQG', industry: 'research_lab', city: 'Champaign', state: 'IL', zip: '61820' },
  { name: 'Oak Park Veterinary Clinic', class: 'VSQG', industry: 'veterinary', city: 'Oak Park', state: 'IL', zip: '60302' },
  // Minnesota
  { name: 'Twin Cities Auto Body', class: 'SQG', industry: 'auto_body', city: 'Minneapolis', state: 'MN', zip: '55401' },
  { name: 'St. Paul Medical Center', class: 'SQG', industry: 'medical', city: 'Saint Paul', state: 'MN', zip: '55101' },
  { name: 'Rochester Diagnostics Lab', class: 'SQG', industry: 'clinical_lab', city: 'Rochester', state: 'MN', zip: '55901' },
  { name: 'Duluth Boat Works', class: 'VSQG', industry: 'marine', city: 'Duluth', state: 'MN', zip: '55802' },
  { name: 'Bloomington Tool & Die', class: 'SQG', industry: 'manufacturing', city: 'Bloomington', state: 'MN', zip: '55431' },
  { name: 'Eagan Electronics Recycling', class: 'SQG', industry: 'e_waste', city: 'Eagan', state: 'MN', zip: '55121' },
  { name: 'Mankato Dental Associates', class: 'VSQG', industry: 'dental', city: 'Mankato', state: 'MN', zip: '56001' },
];

const VENDORS = [
  {
    name: 'Midwest Environmental Services',
    type: 'transporter_tsdf',
    city: 'Madison',
    state: 'WI',
    zip: '53713',
    score: '92.50',
    capabilities: [
      { framework: 'rcra_hazardous', containerTypes: ['55gal_drum', '30gal_drum', '5gal_pail'] },
      { framework: 'used_oil', containerTypes: ['55gal_drum', '275gal_tote'] },
      { framework: 'universal_waste', containerTypes: ['lamp_box', '5gal_pail'] },
    ],
    areas: [
      { type: 'state', value: 'WI', priority: 10 },
      { type: 'state', value: 'IL', priority: 20 },
      { type: 'state', value: 'MN', priority: 30 },
    ],
  },
  {
    name: 'ChemTrack Disposal Co',
    type: 'transporter',
    city: 'Chicago',
    state: 'IL',
    zip: '60608',
    score: '88.00',
    capabilities: [
      { framework: 'rcra_hazardous', containerTypes: ['55gal_drum', '5gal_pail'] },
      { framework: 'universal_waste', containerTypes: ['lamp_box'] },
    ],
    areas: [
      { type: 'state', value: 'IL', priority: 10 },
      { type: 'state', value: 'WI', priority: 20 },
    ],
  },
  {
    name: 'North Star Lab Packs',
    type: 'broker',
    city: 'Minneapolis',
    state: 'MN',
    zip: '55414',
    score: '79.50',
    capabilities: [
      { framework: 'rcra_hazardous', containerTypes: ['55gal_overpack'] },
      { framework: 'medical', containerTypes: ['55gal_drum'] },
    ],
    areas: [{ type: 'state', value: 'MN', priority: 10 }],
  },
  {
    name: 'Lakeshore Used Oil Recycling',
    type: 'transporter_tsdf',
    city: 'Milwaukee',
    state: 'WI',
    zip: '53215',
    score: '95.00',
    capabilities: [
      { framework: 'used_oil', containerTypes: ['55gal_drum', '275gal_tote'] },
    ],
    areas: [
      { type: 'state', value: 'WI', priority: 10 },
      { type: 'state', value: 'IL', priority: 15 },
    ],
  },
  {
    name: 'Prairie Universal Waste',
    type: 'consolidation',
    city: 'Rockford',
    state: 'IL',
    zip: '61103',
    score: '82.00',
    capabilities: [
      { framework: 'universal_waste', containerTypes: ['lamp_box', '5gal_pail', 'pallet'] },
    ],
    areas: [
      { type: 'state', value: 'IL', priority: 10 },
      { type: 'state', value: 'WI', priority: 15 },
      { type: 'state', value: 'MN', priority: 20 },
    ],
  },
];

// Job state fan-out — how many jobs in each state
const JOB_STATES = [
  { state: 'draft', lane: 'lane_1', count: 3 },
  { state: 'classified_standard', lane: 'lane_1', count: 2 },
  { state: 'classified_complex', lane: 'lane_2', count: 2 },
  { state: 'quote_sent', lane: 'lane_1', count: 2 },
  { state: 'advance_paid', lane: 'lane_1', count: 3 },
  { state: 'vendor_selected', lane: 'lane_1', count: 2, withVendor: true },
  { state: 'pickup_scheduled', lane: 'lane_1', count: 2, withVendor: true },
  { state: 'pickup_completed', lane: 'lane_1', count: 1, withVendor: true },
  { state: 'completed', lane: 'lane_1', count: 1, withVendor: true },
  { state: 'non_compliant_flagged', lane: 'lane_1', count: 1, withVendor: true },
];

// Waste stream keys (must match seed-reference.mjs)
const WASTE_STREAM_ROTATION = [
  { key: 'waste_paint', framework: 'rcra_hazardous' },
  { key: 'spent_solvent_nonhalogenated', framework: 'rcra_hazardous' },
  { key: 'used_oil', framework: 'used_oil' },
  { key: 'lead_acid_batteries', framework: 'universal_waste' },
  { key: 'fluorescent_lamps', framework: 'universal_waste' },
  { key: 'aerosol_cans', framework: 'universal_waste' },
];

const CONTAINER_ROTATION = [
  '55gal_drum',
  '30gal_drum',
  '5gal_pail',
  '275gal_tote',
  'lamp_box',
];

// ---------------------------------------------------------------------------
// Clean previous synthetic rows
// ---------------------------------------------------------------------------

async function cleanExisting() {
  const existingGens = await sql`SELECT id FROM generators WHERE account_notes = ${MARKER}`;
  const genIds = existingGens.map((r) => r.id);

  if (genIds.length > 0) {
    // certifications, jobs have onDelete=restrict to generators, so explicit delete first
    await sql`DELETE FROM certifications WHERE generator_id = ANY(${genIds})`;
    await sql`DELETE FROM jobs WHERE generator_id = ANY(${genIds})`;
    // contacts and locations cascade from generator delete
    await sql`DELETE FROM generators WHERE id = ANY(${genIds})`;
  }

  const existingVendors = await sql`SELECT id FROM vendors WHERE notes = ${MARKER}`;
  const vendorIds = existingVendors.map((r) => r.id);

  if (vendorIds.length > 0) {
    // payouts have restrict on vendors; clean any dev payouts first
    await sql`DELETE FROM payouts WHERE vendor_id = ANY(${vendorIds})`;
    // capabilities + service_areas cascade from vendor delete
    await sql`DELETE FROM vendors WHERE id = ANY(${vendorIds})`;
  }

  console.log(
    `  cleaned: ${genIds.length} generators, ${vendorIds.length} vendors (cascade to children)`,
  );
}

// ---------------------------------------------------------------------------
// Insert generators + locations + contacts
// ---------------------------------------------------------------------------

async function seedGenerators() {
  const out = [];
  for (const g of GENERATORS) {
    const [gen] = await sql`
      INSERT INTO generators (name, generator_class, industry, status, marketing_stage, account_notes)
      VALUES (
        ${g.name},
        ${g.class}::generator_class,
        ${g.industry},
        'active'::generator_status,
        'customer'::marketing_stage,
        ${MARKER}
      )
      RETURNING id
    `;
    const [loc] = await sql`
      INSERT INTO generator_locations (
        generator_id, name, address_line1, city, state, postal_code, is_primary, active
      ) VALUES (
        ${gen.id}, ${g.name}, '123 Main St', ${g.city}, ${g.state}, ${g.zip}, true, true
      )
      RETURNING id
    `;
    await sql`
      INSERT INTO generator_contacts (
        generator_id, location_id, first_name, last_name, email, phone, role, is_authorized_signer, active
      ) VALUES (
        ${gen.id}, ${loc.id}, 'Seed', 'Contact',
        ${'seed+' + g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '@example.com'},
        '(555) 555-0100', 'primary'::contact_role, true, true
      )
    `;
    out.push({ id: gen.id, locationId: loc.id, state: g.state });
  }
  console.log(`  generators: ${out.length} inserted (with locations + primary contacts)`);
  return out;
}

// ---------------------------------------------------------------------------
// Insert vendors + capabilities + service areas
// ---------------------------------------------------------------------------

async function seedVendors() {
  const out = [];
  for (const v of VENDORS) {
    const [vendor] = await sql`
      INSERT INTO vendors (
        name, vendor_type, address_line1, city, state, postal_code,
        status, performance_score, notes
      ) VALUES (
        ${v.name},
        ${v.type}::vendor_type,
        '500 Industrial Way',
        ${v.city},
        ${v.state},
        ${v.zip},
        'active'::vendor_status,
        ${v.score},
        ${MARKER}
      )
      RETURNING id
    `;
    for (const cap of v.capabilities) {
      await sql`
        INSERT INTO vendor_capabilities (vendor_id, waste_framework, container_types)
        VALUES (${vendor.id}, ${cap.framework}::waste_framework, ${cap.containerTypes})
      `;
    }
    for (const area of v.areas) {
      await sql`
        INSERT INTO vendor_service_areas (vendor_id, area_type, value, priority)
        VALUES (${vendor.id}, ${area.type}::service_area_type, ${area.value}, ${area.priority})
      `;
    }
    out.push({ id: vendor.id, state: v.state });
  }
  console.log(`  vendors: ${out.length} inserted (with capabilities + service areas)`);
  return out;
}

// ---------------------------------------------------------------------------
// Insert sample jobs across the state machine
// ---------------------------------------------------------------------------

async function seedJobs(generatorsList, vendorsList) {
  let streamIdx = 0;
  let containerIdx = 0;
  let genIdx = 0;
  let vendorIdx = 0;
  let refCounter = 1;
  let count = 0;

  for (const spec of JOB_STATES) {
    for (let i = 0; i < spec.count; i++) {
      const gen = generatorsList[genIdx % generatorsList.length];
      genIdx++;
      const stream = WASTE_STREAM_ROTATION[streamIdx % WASTE_STREAM_ROTATION.length];
      streamIdx++;
      const container = CONTAINER_ROTATION[containerIdx % CONTAINER_ROTATION.length];
      containerIdx++;

      const vendorId = spec.withVendor
        ? vendorsList[vendorIdx++ % vendorsList.length].id
        : null;

      const refNumber = `CLR-SEED-${String(refCounter++).padStart(4, '0')}`;

      const [job] = await sql`
        INSERT INTO jobs (
          reference_number, generator_id, generator_location_id,
          state, lane, waste_framework,
          selected_vendor_id, notes
        ) VALUES (
          ${refNumber},
          ${gen.id},
          ${gen.locationId},
          ${spec.state}::job_state,
          ${spec.lane}::job_lane,
          ${stream.framework}::waste_framework,
          ${vendorId},
          ${'Dev seed job — ' + spec.state}
        )
        RETURNING id
      `;

      await sql`
        INSERT INTO job_waste_streams (
          job_id, waste_stream_key, container_type, container_count,
          un_container_certified
        ) VALUES (
          ${job.id}, ${stream.key}, ${container}, ${1 + (i % 3)}, true
        )
      `;

      count++;
    }
  }

  console.log(`  jobs: ${count} inserted across ${JOB_STATES.length} state machine states`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Dev seed starting (marker='${MARKER}')…`);

  try {
    await cleanExisting();
    const generatorsList = await seedGenerators();
    const vendorsList = await seedVendors();
    await seedJobs(generatorsList, vendorsList);

    console.log('Done.');
    await sql.end();
  } catch (err) {
    console.error('Seed failed:', err);
    await sql.end({ timeout: 1 }).catch(() => {});
    process.exit(1);
  }
}

main();
