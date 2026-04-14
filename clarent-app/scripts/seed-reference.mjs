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
// waste_codes — expanded curated list covering all D codes, full F-list,
// top P/U codes for SQG scenarios
// ---------------------------------------------------------------------------
//
// For a fully-authoritative list, the canonical sources are:
//   - 40 CFR 261.21–261.33 (EPA waste code definitions)
//   - EPA RCRAInfo code lookup
// A future bulk-loader script (scripts/seed-reference-epa-csv.mjs — TODO)
// should ingest EPA's published CSVs.
const WASTE_CODES = [
  // D-list: ignitability/corrosivity/reactivity/TCLP toxicity (D001–D043)
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
  { code: 'D012', series: 'D', description: 'Endrin (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D013', series: 'D', description: 'Lindane (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D014', series: 'D', description: 'Methoxychlor (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D015', series: 'D', description: 'Toxaphene (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D016', series: 'D', description: '2,4-D (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D017', series: 'D', description: '2,4,5-TP Silvex (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D018', series: 'D', description: 'Benzene (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D019', series: 'D', description: 'Carbon tetrachloride (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D020', series: 'D', description: 'Chlordane (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D021', series: 'D', description: 'Chlorobenzene (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D022', series: 'D', description: 'Chloroform (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D023', series: 'D', description: 'o-Cresol (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D024', series: 'D', description: 'm-Cresol (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D025', series: 'D', description: 'p-Cresol (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D026', series: 'D', description: 'Cresol (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D027', series: 'D', description: '1,4-Dichlorobenzene (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D028', series: 'D', description: '1,2-Dichloroethane (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D029', series: 'D', description: '1,1-Dichloroethylene (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D030', series: 'D', description: '2,4-Dinitrotoluene (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D031', series: 'D', description: 'Heptachlor (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D032', series: 'D', description: 'Hexachlorobenzene (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D033', series: 'D', description: 'Hexachlorobutadiene (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D034', series: 'D', description: 'Hexachloroethane (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D035', series: 'D', description: 'Methyl ethyl ketone (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D036', series: 'D', description: 'Nitrobenzene (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D037', series: 'D', description: 'Pentachlorophenol (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D038', series: 'D', description: 'Pyridine (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D039', series: 'D', description: 'Tetrachloroethylene (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D040', series: 'D', description: 'Trichloroethylene (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D041', series: 'D', description: '2,4,5-Trichlorophenol (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D042', series: 'D', description: '2,4,6-Trichlorophenol (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },
  { code: 'D043', series: 'D', description: 'Vinyl chloride (TCLP toxicity)', listingBasis: 'toxicity', hazardCodes: ['T'], citation: '40 CFR 261.24' },

  // F-list: spent solvents (F001–F005) and common electroplating/manufacturing wastes
  { code: 'F001', series: 'F', description: 'Halogenated degreasing solvents (TCE, PCE, methylene chloride, 1,1,1-TCA, carbon tet, CFCs)', listingBasis: 'spent_solvent', hazardCodes: ['T'], citation: '40 CFR 261.31' },
  { code: 'F002', series: 'F', description: 'Spent halogenated solvents (PCE, methylene chloride, TCE, 1,1,1-TCA, chlorobenzene, CFC-113, ODCB, CFC-11, 1,1,2-TCA)', listingBasis: 'spent_solvent', hazardCodes: ['T'], citation: '40 CFR 261.31' },
  { code: 'F003', series: 'F', description: 'Spent non-halogenated solvents (xylene, acetone, ethyl acetate, ethylbenzene, ethyl ether, MIBK, n-butanol, cyclohexanone, methanol)', listingBasis: 'spent_solvent', hazardCodes: ['I'], citation: '40 CFR 261.31' },
  { code: 'F004', series: 'F', description: 'Spent non-halogenated solvents (cresols, cresylic acid, nitrobenzene)', listingBasis: 'spent_solvent', hazardCodes: ['T'], citation: '40 CFR 261.31' },
  { code: 'F005', series: 'F', description: 'Spent non-halogenated solvents (toluene, MEK, carbon disulfide, isobutanol, pyridine, benzene, 2-ethoxyethanol, 2-nitropropane)', listingBasis: 'spent_solvent', hazardCodes: ['I', 'T'], citation: '40 CFR 261.31' },
  { code: 'F006', series: 'F', description: 'Wastewater treatment sludges from electroplating operations', listingBasis: 'electroplating_sludge', hazardCodes: ['T'], citation: '40 CFR 261.31' },
  { code: 'F007', series: 'F', description: 'Spent cyanide plating bath solutions from electroplating operations', listingBasis: 'electroplating', hazardCodes: ['R', 'T'], citation: '40 CFR 261.31' },
  { code: 'F008', series: 'F', description: 'Plating bath residues from electroplating operations where cyanides are used', listingBasis: 'electroplating', hazardCodes: ['R', 'T'], citation: '40 CFR 261.31' },
  { code: 'F009', series: 'F', description: 'Spent stripping and cleaning bath solutions from electroplating (with cyanides)', listingBasis: 'electroplating', hazardCodes: ['R', 'T'], citation: '40 CFR 261.31' },
  { code: 'F010', series: 'F', description: 'Quenching bath residues from oil baths from metal heat treating (with cyanides)', listingBasis: 'heat_treating', hazardCodes: ['R', 'T'], citation: '40 CFR 261.31' },
  { code: 'F019', series: 'F', description: 'Wastewater treatment sludges from chemical conversion coating of aluminum', listingBasis: 'metal_coating_sludge', hazardCodes: ['T'], citation: '40 CFR 261.31' },
  { code: 'F032', series: 'F', description: 'Wastewaters, process residuals from wood preserving with chlorophenolic formulations', listingBasis: 'wood_preserving', hazardCodes: ['T'], citation: '40 CFR 261.31' },
  { code: 'F034', series: 'F', description: 'Wastewaters, process residuals from wood preserving with creosote formulations', listingBasis: 'wood_preserving', hazardCodes: ['T'], citation: '40 CFR 261.31' },
  { code: 'F035', series: 'F', description: 'Wastewaters, process residuals from wood preserving with inorganic arsenical or chromium formulations', listingBasis: 'wood_preserving', hazardCodes: ['T'], citation: '40 CFR 261.31' },
  { code: 'F039', series: 'F', description: 'Leachate from multiple source hazardous waste', listingBasis: 'leachate', hazardCodes: ['T'], citation: '40 CFR 261.31' },

  // P-list: acute hazardous commercial chemical products (common cyanides, acrolein, organic toxins)
  { code: 'P003', series: 'P', description: 'Acrolein', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P012', series: 'P', description: 'Arsenic trioxide', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P015', series: 'P', description: 'Beryllium powder', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P022', series: 'P', description: 'Carbon disulfide', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P029', series: 'P', description: 'Copper cyanide', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P030', series: 'P', description: 'Cyanides (soluble cyanide salts), not elsewhere specified', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P042', series: 'P', description: 'Epinephrine', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P056', series: 'P', description: 'Fluorine', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P063', series: 'P', description: 'Hydrogen cyanide', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P065', series: 'P', description: 'Mercury fulminate', listingBasis: 'acute_commercial', hazardCodes: ['H', 'R'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P068', series: 'P', description: 'Methyl hydrazine', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P081', series: 'P', description: 'Nitroglycerine', listingBasis: 'acute_commercial', hazardCodes: ['H', 'R'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P098', series: 'P', description: 'Potassium cyanide', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P104', series: 'P', description: 'Silver cyanide', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P106', series: 'P', description: 'Sodium cyanide', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },
  { code: 'P120', series: 'P', description: 'Vanadium pentoxide', listingBasis: 'acute_commercial', hazardCodes: ['H'], citation: '40 CFR 261.33(e)', isAcuteHazardous: true },

  // U-list: non-acute hazardous commercial chemical products (common SQG chemicals)
  { code: 'U002', series: 'U', description: 'Acetone', listingBasis: 'commercial_chemical', hazardCodes: ['I'], citation: '40 CFR 261.33(f)' },
  { code: 'U003', series: 'U', description: 'Acetonitrile', listingBasis: 'commercial_chemical', hazardCodes: ['I', 'T'], citation: '40 CFR 261.33(f)' },
  { code: 'U019', series: 'U', description: 'Benzene', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U028', series: 'U', description: 'bis(2-Ethylhexyl) phthalate (DEHP)', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U031', series: 'U', description: 'n-Butyl alcohol', listingBasis: 'commercial_chemical', hazardCodes: ['I'], citation: '40 CFR 261.33(f)' },
  { code: 'U037', series: 'U', description: 'Chlorobenzene', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U044', series: 'U', description: 'Chloroform', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U052', series: 'U', description: 'Cresols', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U056', series: 'U', description: 'Cyclohexane', listingBasis: 'commercial_chemical', hazardCodes: ['I'], citation: '40 CFR 261.33(f)' },
  { code: 'U057', series: 'U', description: 'Cyclohexanone', listingBasis: 'commercial_chemical', hazardCodes: ['I'], citation: '40 CFR 261.33(f)' },
  { code: 'U069', series: 'U', description: 'Dibutyl phthalate', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U080', series: 'U', description: 'Methylene chloride', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U108', series: 'U', description: '1,4-Dioxane', listingBasis: 'commercial_chemical', hazardCodes: ['I', 'T'], citation: '40 CFR 261.33(f)' },
  { code: 'U112', series: 'U', description: 'Ethyl acetate', listingBasis: 'commercial_chemical', hazardCodes: ['I'], citation: '40 CFR 261.33(f)' },
  { code: 'U117', series: 'U', description: 'Ethyl ether', listingBasis: 'commercial_chemical', hazardCodes: ['I'], citation: '40 CFR 261.33(f)' },
  { code: 'U122', series: 'U', description: 'Formaldehyde', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U123', series: 'U', description: 'Formic acid', listingBasis: 'commercial_chemical', hazardCodes: ['C', 'T'], citation: '40 CFR 261.33(f)' },
  { code: 'U134', series: 'U', description: 'Hydrogen fluoride', listingBasis: 'commercial_chemical', hazardCodes: ['C', 'T'], citation: '40 CFR 261.33(f)' },
  { code: 'U140', series: 'U', description: 'Isobutyl alcohol', listingBasis: 'commercial_chemical', hazardCodes: ['I'], citation: '40 CFR 261.33(f)' },
  { code: 'U151', series: 'U', description: 'Mercury', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U154', series: 'U', description: 'Methanol', listingBasis: 'commercial_chemical', hazardCodes: ['I'], citation: '40 CFR 261.33(f)' },
  { code: 'U159', series: 'U', description: 'Methyl ethyl ketone', listingBasis: 'commercial_chemical', hazardCodes: ['I', 'T'], citation: '40 CFR 261.33(f)' },
  { code: 'U161', series: 'U', description: 'Methyl isobutyl ketone', listingBasis: 'commercial_chemical', hazardCodes: ['I'], citation: '40 CFR 261.33(f)' },
  { code: 'U188', series: 'U', description: 'Phenol', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U190', series: 'U', description: 'Phthalic anhydride', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U210', series: 'U', description: 'Tetrachloroethylene', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U211', series: 'U', description: 'Carbon tetrachloride', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U213', series: 'U', description: 'Tetrahydrofuran', listingBasis: 'commercial_chemical', hazardCodes: ['I'], citation: '40 CFR 261.33(f)' },
  { code: 'U220', series: 'U', description: 'Toluene', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U226', series: 'U', description: '1,1,1-Trichloroethane', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U228', series: 'U', description: 'Trichloroethylene', listingBasis: 'commercial_chemical', hazardCodes: ['T'], citation: '40 CFR 261.33(f)' },
  { code: 'U239', series: 'U', description: 'Xylene', listingBasis: 'commercial_chemical', hazardCodes: ['I'], citation: '40 CFR 261.33(f)' },

  // K-list: source-specific wastes (top 5 most relevant to SQG-adjacent industries)
  { code: 'K001', series: 'K', description: 'Bottom sediment sludge from treatment of wastewaters from wood preserving processes using creosote and/or pentachlorophenol', listingBasis: 'source_specific', hazardCodes: ['T'], citation: '40 CFR 261.32' },
  { code: 'K048', series: 'K', description: 'Dissolved air flotation (DAF) float from the petroleum refining industry', listingBasis: 'source_specific', hazardCodes: ['T'], citation: '40 CFR 261.32' },
  { code: 'K049', series: 'K', description: 'Slop oil emulsion solids from the petroleum refining industry', listingBasis: 'source_specific', hazardCodes: ['T'], citation: '40 CFR 261.32' },
  { code: 'K050', series: 'K', description: 'Heat exchanger bundle cleaning sludge from the petroleum refining industry', listingBasis: 'source_specific', hazardCodes: ['T'], citation: '40 CFR 261.32' },
  { code: 'K062', series: 'K', description: 'Spent pickle liquor generated by steel finishing operations', listingBasis: 'source_specific', hazardCodes: ['C', 'T'], citation: '40 CFR 261.32' },
];

// ---------------------------------------------------------------------------
// dot_hazmat_table — curated set of common UN entries for SQG waste streams
// (Subset of 49 CFR 172.101. Full table has ~3000 entries; a future
// bulk loader should ingest PHMSA's published data.)
// ---------------------------------------------------------------------------
const DOT_HAZMAT = [
  { name: 'Paint or Paint related material', un: 'UN1263', class: '3', pg: 'II', labels: ['FLAMMABLE LIQUID'] },
  { name: 'Paint or Paint related material', un: 'UN1263', class: '3', pg: 'III', labels: ['FLAMMABLE LIQUID'] },
  { name: 'Waste flammable liquid, n.o.s.', un: 'UN1993', class: '3', pg: 'I', labels: ['FLAMMABLE LIQUID'] },
  { name: 'Waste flammable liquid, n.o.s.', un: 'UN1993', class: '3', pg: 'II', labels: ['FLAMMABLE LIQUID'] },
  { name: 'Waste flammable liquid, n.o.s.', un: 'UN1993', class: '3', pg: 'III', labels: ['FLAMMABLE LIQUID'] },
  { name: 'Waste acetone', un: 'UN1090', class: '3', pg: 'II', labels: ['FLAMMABLE LIQUID'] },
  { name: 'Waste methanol', un: 'UN1230', class: '3', pg: 'II', labels: ['FLAMMABLE LIQUID', 'POISON'] },
  { name: 'Waste methyl ethyl ketone', un: 'UN1193', class: '3', pg: 'II', labels: ['FLAMMABLE LIQUID'] },
  { name: 'Waste toluene', un: 'UN1294', class: '3', pg: 'II', labels: ['FLAMMABLE LIQUID'] },
  { name: 'Waste xylenes', un: 'UN1307', class: '3', pg: 'III', labels: ['FLAMMABLE LIQUID'] },
  { name: 'Waste benzene', un: 'UN1114', class: '3', pg: 'II', labels: ['FLAMMABLE LIQUID', 'POISON'] },
  { name: 'Waste tetrachloroethylene', un: 'UN1897', class: '6.1', pg: 'III', labels: ['POISON'] },
  { name: 'Waste trichloroethylene', un: 'UN1710', class: '6.1', pg: 'III', labels: ['POISON'] },
  { name: 'Waste methylene chloride', un: 'UN1593', class: '6.1', pg: 'III', labels: ['POISON'] },
  { name: 'Waste 1,1,1-trichloroethane', un: 'UN2831', class: '6.1', pg: 'III', labels: ['POISON'] },
  { name: 'Waste chloroform', un: 'UN1888', class: '6.1', pg: 'III', labels: ['POISON'] },
  { name: 'Waste corrosive liquid, acidic, inorganic, n.o.s.', un: 'UN3264', class: '8', pg: 'II', labels: ['CORROSIVE'] },
  { name: 'Waste corrosive liquid, acidic, inorganic, n.o.s.', un: 'UN3264', class: '8', pg: 'III', labels: ['CORROSIVE'] },
  { name: 'Waste corrosive liquid, basic, inorganic, n.o.s.', un: 'UN3266', class: '8', pg: 'II', labels: ['CORROSIVE'] },
  { name: 'Waste sulfuric acid', un: 'UN1830', class: '8', pg: 'II', labels: ['CORROSIVE'] },
  { name: 'Waste hydrochloric acid', un: 'UN1789', class: '8', pg: 'II', labels: ['CORROSIVE'] },
  { name: 'Waste sodium hydroxide solution', un: 'UN1824', class: '8', pg: 'II', labels: ['CORROSIVE'] },
  { name: 'Waste aerosols, flammable', un: 'UN1950', class: '2.1', pg: null, labels: ['FLAMMABLE GAS'] },
  { name: 'Waste batteries, wet, filled with acid', un: 'UN2794', class: '8', pg: null, labels: ['CORROSIVE'] },
  { name: 'Waste lithium ion batteries', un: 'UN3480', class: '9', pg: null, labels: ['CLASS 9'] },
  { name: 'Waste lithium metal batteries', un: 'UN3090', class: '9', pg: null, labels: ['CLASS 9'] },
  { name: 'Waste mercury', un: 'UN2809', class: '8', pg: 'III', labels: ['CORROSIVE'] },
  { name: 'Waste environmentally hazardous substance, liquid, n.o.s.', un: 'UN3082', class: '9', pg: 'III', labels: ['CLASS 9'] },
  { name: 'Waste environmentally hazardous substance, solid, n.o.s.', un: 'UN3077', class: '9', pg: 'III', labels: ['CLASS 9'] },
  { name: 'Waste combustible liquid, n.o.s. (used oil)', un: 'NA1993', class: 'COMBUSTIBLE', pg: 'III', labels: [] },
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

  // dot_hazmat_table — no natural key, so truncate + reinsert for idempotency
  await sql`DELETE FROM dot_hazmat_table`;
  for (const d of DOT_HAZMAT) {
    await sql`
      INSERT INTO dot_hazmat_table (
        proper_shipping_name, un_number, hazard_class, packing_group, labels
      )
      VALUES (${d.name}, ${d.un}, ${d.class}, ${d.pg}, ${d.labels})
    `;
  }
  console.log(`  dot_hazmat_table: ${DOT_HAZMAT.length} loaded`);

  console.log('Done.');
  await sql.end();
}

main().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await sql.end({ timeout: 1 }).catch(() => {});
  process.exit(1);
});
