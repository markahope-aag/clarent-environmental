// Seed reference data — idempotent (safe to run multiple times)
//
// Loads the minimum reference tables the platform needs for Lane 1 classification
// and compliance calendar generation. Data sources are the EPA waste code
// definitions (D-series characteristics + a starter set of F/P/U), common SQG
// waste streams, and the 50-state + DC jurisdiction matrix.
//
// Run: node scripts/seed-reference.mjs

import postgres from 'postgres';
import { readFileSync } from 'node:fs';

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

// ---------------------------------------------------------------------------
// waste_frameworks — one row per enum value
// ---------------------------------------------------------------------------
const WASTE_FRAMEWORKS = [
  {
    key: 'rcra_hazardous',
    name: 'RCRA Hazardous Waste',
    description:
      'Listed or characteristic hazardous waste subject to full Subtitle C regulation under RCRA.',
    citation: '40 CFR Part 261',
  },
  {
    key: 'universal_waste',
    name: 'Universal Waste',
    description:
      'Streamlined hazardous waste management for batteries, pesticides, mercury-containing equipment, lamps, and aerosol cans.',
    citation: '40 CFR Part 273',
  },
  {
    key: 'used_oil',
    name: 'Used Oil',
    description:
      'Used oil managed under the Used Oil Management Standards, separate from RCRA hazardous waste rules when recycled.',
    citation: '40 CFR Part 279',
  },
  {
    key: 'non_rcra_state',
    name: 'Non-RCRA State Hazardous Waste',
    description:
      'Waste regulated as hazardous under state law but not listed or characteristic under federal RCRA.',
    citation: 'State-specific',
  },
  {
    key: 'medical',
    name: 'Regulated Medical Waste',
    description:
      'Biohazardous and medical waste regulated under state DEP/DOH rules and DOT for transport.',
    citation: 'State + 49 CFR Part 173',
  },
  {
    key: 'asbestos',
    name: 'Asbestos-Containing Material',
    description: 'NESHAP-regulated asbestos waste (friable or Category II) requiring specialized handling.',
    citation: '40 CFR Part 61 Subpart M',
  },
  {
    key: 'radioactive',
    name: 'Radioactive / Mixed Waste',
    description:
      'NORM, low-level radioactive waste, or mixed waste regulated under NRC / state agreement rules.',
    citation: '10 CFR + State',
  },
];

// ---------------------------------------------------------------------------
// waste_codes — D-series characteristic codes + common F/P/U listed codes
// ---------------------------------------------------------------------------
const WASTE_CODES = [
  // D-series: characteristic waste
  { code: 'D001', series: 'D', description: 'Ignitable waste', listingBasis: 'ignitability', hazardCodes: ['I'], citation: '40 CFR 261.21' },
  { code: 'D002', series: 'D', description: 'Corrosive waste', listingBasis: 'corrosivity', hazardCodes: ['C'], citation: '40 CFR 261.22' },
  { code: 'D003', series: 'D', description: 'Reactive waste', listingBasis: 'reactivity', hazardCodes: ['R'], citation: '40 CFR 261.23' },
  { code: 'D004', series: 'D', description: 'Arsenic (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D005', series: 'D', description: 'Barium (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D006', series: 'D', description: 'Cadmium (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D007', series: 'D', description: 'Chromium (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D008', series: 'D', description: 'Lead (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D009', series: 'D', description: 'Mercury (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D010', series: 'D', description: 'Selenium (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D011', series: 'D', description: 'Silver (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D018', series: 'D', description: 'Benzene (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D035', series: 'D', description: 'Methyl ethyl ketone (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D039', series: 'D', description: 'Tetrachloroethylene (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D040', series: 'D', description: 'Trichloroethylene (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },

  // F-series: spent solvents and common manufacturing waste
  { code: 'F001', series: 'F', description: 'Halogenated solvents used in degreasing (tetrachloroethylene, trichloroethylene, methylene chloride, 1,1,1-trichloroethane, carbon tetrachloride, chlorinated fluorocarbons)', listingBasis: 'spent_solvent', hazardCodes: ['T'], citation: '40 CFR 261.31' },
  { code: 'F002', series: 'F', description: 'Spent halogenated solvents (tetrachloroethylene, methylene chloride, trichloroethylene, 1,1,1-trichloroethane, chlorobenzene, 1,1,2-trichloro-1,2,2-trifluoroethane, ortho-dichlorobenzene, trichlorofluoromethane, 1,1,2-trichloroethane)', listingBasis: 'spent_solvent', hazardCodes: ['T'], citation: '40 CFR 261.31' },
  { code: 'F003', series: 'F', description: 'Spent non-halogenated solvents (xylene, acetone, ethyl acetate, ethyl benzene, ethyl ether, methyl isobutyl ketone, n-butyl alcohol, cyclohexanone, methanol)', listingBasis: 'spent_solvent', hazardCodes: ['I'], citation: '40 CFR 261.31' },
  { code: 'F005', series: 'F', description: 'Spent non-halogenated solvents (toluene, methyl ethyl ketone, carbon disulfide, isobutanol, pyridine, benzene, 2-ethoxyethanol, 2-nitropropane)', listingBasis: 'spent_solvent', hazardCodes: ['I', 'T'], citation: '40 CFR 261.31' },

  // P-series: acute hazardous commercial chemical products (subset — most common)
  { code: 'P029', series: 'P', description: 'Copper cyanide', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P030', series: 'P', description: 'Cyanides (soluble cyanide salts), not elsewhere specified', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P098', series: 'P', description: 'Potassium cyanide', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P106', series: 'P', description: 'Sodium cyanide', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },

  // U-series: non-acute hazardous commercial chemical products (subset)
  { code: 'U002', series: 'U', description: 'Acetone', listingBasis: 'commercial_chemical', hazardCodes: ['I'], citation: '40 CFR 261.33(f)' },
  { code: 'U019', series: 'U', description: 'Benzene', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U044', series: 'U', description: 'Chloroform', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U080', series: 'U', description: 'Methylene chloride', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U154', series: 'U', description: 'Methanol', listingBasis: 'commercial_chemical', hazardCodes: ['I'], citation: '40 CFR 261.33(f)' },
  { code: 'U159', series: 'U', description: 'Methyl ethyl ketone', listingBasis: 'commercial_chemical', hazardCodes: ['I', 'T'], citation: '40 CFR 261.33(f)' },
  { code: 'U161', series: 'U', description: 'Methyl isobutyl ketone', listingBasis: 'commercial_chemical', hazardCodes: ['I'], citation: '40 CFR 261.33(f)' },
  { code: 'U220', series: 'U', description: 'Toluene', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U228', series: 'U', description: 'Trichloroethylene', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U239', series: 'U', description: 'Xylene', listingBasis: 'commercial_chemical', hazardCodes: ['I'], citation: '40 CFR 261.33(f)' },
];

// ---------------------------------------------------------------------------
// waste_streams — normalized commercial streams for SQG classification
// ---------------------------------------------------------------------------
const WASTE_STREAMS = [
  { key: 'waste_paint', name: 'Waste paint and paint-related materials', description: 'Oil-based paint, stain, varnish, and solvent-based coatings', wasteFramework: 'rcra_hazardous', typicalWasteCodes: ['D001'], laneEligibility: 'lane_1', industryHints: ['auto_body', 'manufacturing', 'contractors'], typicalContainerTypes: ['55gal_drum', '5gal_pail'] },
  { key: 'waste_paint_latex', name: 'Waste latex paint', description: 'Water-based latex paint (often non-hazardous when dried)', wasteFramework: 'non_rcra_state', typicalWasteCodes: [], laneEligibility: 'lane_1', industryHints: ['contractors', 'property_management'], typicalContainerTypes: ['5gal_pail', '55gal_drum'] },
  { key: 'spent_solvent_halogenated', name: 'Spent halogenated solvents', description: 'Used degreasing solvents like trichloroethylene, methylene chloride, perchloroethylene', wasteFramework: 'rcra_hazardous', typicalWasteCodes: ['F001', 'F002'], laneEligibility: 'lane_2', industryHints: ['auto_repair', 'manufacturing', 'dry_cleaning'], typicalContainerTypes: ['55gal_drum'] },
  { key: 'spent_solvent_nonhalogenated', name: 'Spent non-halogenated solvents', description: 'Used acetone, MEK, toluene, xylene, mineral spirits', wasteFramework: 'rcra_hazardous', typicalWasteCodes: ['F003', 'F005'], laneEligibility: 'lane_1', industryHints: ['auto_body', 'printing', 'manufacturing'], typicalContainerTypes: ['55gal_drum', '5gal_pail'] },
  { key: 'used_oil', name: 'Used oil', description: 'Motor oil, hydraulic oil, cutting oil managed under 40 CFR 279', wasteFramework: 'used_oil', typicalWasteCodes: [], laneEligibility: 'lane_1', industryHints: ['auto_repair', 'fleet_services', 'machine_shops'], typicalContainerTypes: ['55gal_drum', '275gal_tote'] },
  { key: 'used_oil_filters', name: 'Used oil filters', description: 'Drained used oil filters', wasteFramework: 'used_oil', typicalWasteCodes: [], laneEligibility: 'lane_1', industryHints: ['auto_repair', 'fleet_services'], typicalContainerTypes: ['55gal_drum'] },
  { key: 'lead_acid_batteries', name: 'Lead-acid batteries', description: 'Automotive and industrial lead-acid batteries', wasteFramework: 'universal_waste', typicalWasteCodes: [], laneEligibility: 'lane_1', industryHints: ['auto_repair', 'fleet_services'], typicalContainerTypes: ['pallet', 'individual'] },
  { key: 'lithium_ion_batteries', name: 'Lithium-ion batteries', description: 'Consumer and industrial lithium-ion batteries (damaged/defective require specialty handling)', wasteFramework: 'universal_waste', typicalWasteCodes: [], laneEligibility: 'lane_2', industryHints: ['electronics_repair', 'manufacturing'], typicalContainerTypes: ['drum', 'individual'] },
  { key: 'alkaline_batteries', name: 'Alkaline batteries', description: 'Consumer alkaline dry-cell batteries', wasteFramework: 'universal_waste', typicalWasteCodes: [], laneEligibility: 'lane_1', industryHints: ['offices', 'retail'], typicalContainerTypes: ['5gal_pail', 'bag'] },
  { key: 'fluorescent_lamps', name: 'Fluorescent lamps and CFLs', description: 'Mercury-containing fluorescent lamps', wasteFramework: 'universal_waste', typicalWasteCodes: [], laneEligibility: 'lane_1', industryHints: ['offices', 'retail', 'industrial'], typicalContainerTypes: ['lamp_box'] },
  { key: 'mercury_devices', name: 'Mercury-containing devices', description: 'Thermometers, switches, thermostats containing mercury', wasteFramework: 'universal_waste', typicalWasteCodes: [], laneEligibility: 'lane_1', industryHints: ['schools', 'dental', 'hvac'], typicalContainerTypes: ['drum', 'pail'] },
  { key: 'aerosol_cans', name: 'Aerosol cans', description: 'Non-empty aerosol containers (universal waste as of 2019)', wasteFramework: 'universal_waste', typicalWasteCodes: ['D001'], laneEligibility: 'lane_1', industryHints: ['auto_repair', 'maintenance'], typicalContainerTypes: ['55gal_drum'] },
  { key: 'antifreeze', name: 'Used antifreeze (glycol-based)', description: 'Used ethylene or propylene glycol coolant', wasteFramework: 'non_rcra_state', typicalWasteCodes: [], laneEligibility: 'lane_1', industryHints: ['auto_repair', 'fleet_services'], typicalContainerTypes: ['55gal_drum'] },
  { key: 'lab_pack', name: 'Lab pack (mixed small-quantity lab chemicals)', description: 'Overpacked lab chemicals, often mixed waste codes', wasteFramework: 'rcra_hazardous', typicalWasteCodes: ['D001', 'F003', 'U080'], laneEligibility: 'lane_2', industryHints: ['labs', 'schools', 'universities'], typicalContainerTypes: ['55gal_overpack'] },
  { key: 'dental_amalgam', name: 'Dental amalgam waste', description: 'Mercury-containing dental amalgam (scrap, capsules, traps)', wasteFramework: 'rcra_hazardous', typicalWasteCodes: ['D009'], laneEligibility: 'lane_1', industryHints: ['dental'], typicalContainerTypes: ['amalgam_bucket'] },
  { key: 'dental_xray_fixer', name: 'Dental X-ray fixer solution', description: 'Silver-bearing fixer solution from X-ray processing', wasteFramework: 'rcra_hazardous', typicalWasteCodes: ['D011'], laneEligibility: 'lane_1', industryHints: ['dental', 'medical'], typicalContainerTypes: ['5gal_pail', '55gal_drum'] },
  { key: 'corrosive_liquid_acid', name: 'Corrosive acidic liquid', description: 'Spent acids: sulfuric, hydrochloric, nitric, phosphoric', wasteFramework: 'rcra_hazardous', typicalWasteCodes: ['D002'], laneEligibility: 'lane_2', industryHints: ['metal_finishing', 'manufacturing'], typicalContainerTypes: ['55gal_drum', '275gal_tote'] },
  { key: 'corrosive_liquid_base', name: 'Corrosive alkaline liquid', description: 'Spent caustics: sodium hydroxide, potassium hydroxide', wasteFramework: 'rcra_hazardous', typicalWasteCodes: ['D002'], laneEligibility: 'lane_2', industryHints: ['metal_finishing', 'cleaning_services'], typicalContainerTypes: ['55gal_drum', '275gal_tote'] },
  { key: 'contaminated_absorbent', name: 'Contaminated absorbent (oil/solvent)', description: 'Sorbent pads and granular absorbents contaminated with petroleum or solvent', wasteFramework: 'rcra_hazardous', typicalWasteCodes: ['D001'], laneEligibility: 'lane_1', industryHints: ['auto_repair', 'manufacturing'], typicalContainerTypes: ['55gal_drum'] },
  { key: 'pesticides', name: 'Waste pesticides', description: 'Unused or partial pesticide containers from commercial applicators', wasteFramework: 'universal_waste', typicalWasteCodes: [], laneEligibility: 'lane_2', industryHints: ['agriculture', 'pest_control'], typicalContainerTypes: ['original_container', '55gal_overpack'] },
];

// ---------------------------------------------------------------------------
// jurisdiction_matrix — 50 states + DC + territories baseline
// ---------------------------------------------------------------------------
const STATES = [
  ['AL', 'Alabama', true, 'Region 4'], ['AK', 'Alaska', false, 'Region 10'], ['AZ', 'Arizona', true, 'Region 9'], ['AR', 'Arkansas', true, 'Region 6'],
  ['CA', 'California', true, 'Region 9'], ['CO', 'Colorado', true, 'Region 8'], ['CT', 'Connecticut', true, 'Region 1'], ['DE', 'Delaware', true, 'Region 3'],
  ['DC', 'District of Columbia', false, 'Region 3'], ['FL', 'Florida', true, 'Region 4'], ['GA', 'Georgia', true, 'Region 4'], ['HI', 'Hawaii', false, 'Region 9'],
  ['ID', 'Idaho', true, 'Region 10'], ['IL', 'Illinois', true, 'Region 5'], ['IN', 'Indiana', true, 'Region 5'], ['IA', 'Iowa', false, 'Region 7'],
  ['KS', 'Kansas', true, 'Region 7'], ['KY', 'Kentucky', true, 'Region 4'], ['LA', 'Louisiana', true, 'Region 6'], ['ME', 'Maine', true, 'Region 1'],
  ['MD', 'Maryland', true, 'Region 3'], ['MA', 'Massachusetts', true, 'Region 1'], ['MI', 'Michigan', true, 'Region 5'], ['MN', 'Minnesota', true, 'Region 5'],
  ['MS', 'Mississippi', true, 'Region 4'], ['MO', 'Missouri', true, 'Region 7'], ['MT', 'Montana', true, 'Region 8'], ['NE', 'Nebraska', true, 'Region 7'],
  ['NV', 'Nevada', true, 'Region 9'], ['NH', 'New Hampshire', true, 'Region 1'], ['NJ', 'New Jersey', true, 'Region 2'], ['NM', 'New Mexico', true, 'Region 6'],
  ['NY', 'New York', true, 'Region 2'], ['NC', 'North Carolina', true, 'Region 4'], ['ND', 'North Dakota', true, 'Region 8'], ['OH', 'Ohio', true, 'Region 5'],
  ['OK', 'Oklahoma', true, 'Region 6'], ['OR', 'Oregon', true, 'Region 10'], ['PA', 'Pennsylvania', false, 'Region 3'], ['RI', 'Rhode Island', true, 'Region 1'],
  ['SC', 'South Carolina', true, 'Region 4'], ['SD', 'South Dakota', true, 'Region 8'], ['TN', 'Tennessee', true, 'Region 4'], ['TX', 'Texas', true, 'Region 6'],
  ['UT', 'Utah', true, 'Region 8'], ['VT', 'Vermont', true, 'Region 1'], ['VA', 'Virginia', true, 'Region 3'], ['WA', 'Washington', true, 'Region 10'],
  ['WV', 'West Virginia', true, 'Region 3'], ['WI', 'Wisconsin', true, 'Region 5'], ['WY', 'Wyoming', true, 'Region 8'],
];

async function main() {
  console.log('Seeding reference data...');

  // waste_frameworks (upsert by key)
  for (const wf of WASTE_FRAMEWORKS) {
    await sql`
      INSERT INTO waste_frameworks (key, name, description, citation)
      VALUES (${wf.key}, ${wf.name}, ${wf.description}, ${wf.citation})
      ON CONFLICT (key) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        citation = EXCLUDED.citation
    `;
  }
  console.log(`  waste_frameworks: ${WASTE_FRAMEWORKS.length} upserted`);

  // waste_codes (upsert by code)
  for (const wc of WASTE_CODES) {
    await sql`
      INSERT INTO waste_codes (code, series, description, listing_basis, hazard_codes, citation, is_acute_hazardous)
      VALUES (${wc.code}, ${wc.series}, ${wc.description}, ${wc.listingBasis}, ${wc.hazardCodes}, ${wc.citation}, ${wc.isAcuteHazardous ?? false})
      ON CONFLICT (code) DO UPDATE SET
        description = EXCLUDED.description,
        listing_basis = EXCLUDED.listing_basis,
        hazard_codes = EXCLUDED.hazard_codes,
        citation = EXCLUDED.citation,
        is_acute_hazardous = EXCLUDED.is_acute_hazardous
    `;
  }
  console.log(`  waste_codes: ${WASTE_CODES.length} upserted`);

  // waste_streams (upsert by key)
  for (const ws of WASTE_STREAMS) {
    await sql`
      INSERT INTO waste_streams (key, name, description, waste_framework, typical_waste_codes, lane_eligibility, industry_hints, typical_container_types)
      VALUES (${ws.key}, ${ws.name}, ${ws.description}, ${ws.wasteFramework}::waste_framework, ${ws.typicalWasteCodes}, ${ws.laneEligibility}::lane_eligibility, ${ws.industryHints}, ${ws.typicalContainerTypes})
      ON CONFLICT (key) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        waste_framework = EXCLUDED.waste_framework,
        typical_waste_codes = EXCLUDED.typical_waste_codes,
        lane_eligibility = EXCLUDED.lane_eligibility,
        industry_hints = EXCLUDED.industry_hints,
        typical_container_types = EXCLUDED.typical_container_types
    `;
  }
  console.log(`  waste_streams: ${WASTE_STREAMS.length} upserted`);

  // jurisdiction_matrix (upsert by state)
  for (const [code, name, rcraAuth, region] of STATES) {
    await sql`
      INSERT INTO jurisdiction_matrix (state, state_name, rcra_authorized, epa_region)
      VALUES (${code}, ${name}, ${rcraAuth}, ${region})
      ON CONFLICT (state) DO UPDATE SET
        state_name = EXCLUDED.state_name,
        rcra_authorized = EXCLUDED.rcra_authorized,
        epa_region = EXCLUDED.epa_region
    `;
  }
  console.log(`  jurisdiction_matrix: ${STATES.length} upserted`);

  console.log('Done.');
  await sql.end();
}

main().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await sql.end({ timeout: 1 }).catch(() => {});
  process.exit(1);
});
