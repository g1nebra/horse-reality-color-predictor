
// Converts the raw genetics table data (serialised by content.js from the DOM)
// into a structured genotype object the engine can work with

//  Input  – rows[]: array of { name, result, tested } objects from content.js
//         – breed: exact breed name string read from the page
//         – hiddenGeneToggles: { [locusKey]: [allele1, allele2] } from sidebar UI

//  Output – { genotype, tested, breed, fullyUntested, partiallyTested }
//         genotype: { [locusKey]: [allele1, allele2] }
//         tested: { [locusKey]: [boolean, boolean] }


import genesMapping    from '../data/genesMapping.js';
import hiddenModifiers from '../data/hiddenModifiers.js';

// Display name → locus key
// genetic_name values confirmed from the DOM + planning doc
// All display names confirmed from live DOM (Noriker + Quarter Horse tables).
// genetic_name value → internal locus key used throughout the engine.
const DISPLAY_NAME_MAP = {
  // Colours & Modifiers
  'Extension':   'E',
  'Agouti':      'A',
  'Grey':        'G',
  // Dilutions
  'Creampearl':  'CR',    // two test badges (Cream + Pearl), one result, alleles: CR / prl / n
  'Dun':         'D',     // alleles: D / nd1 / nd2 (nd2 shown explicitly in DOM)
  'Champagne':   'CH',    // alleles: CH / ch
  'Silver':      'Z',     // alleles: Z / z
  'Mushroom':    'mu',    // alleles: mu / n
  // White Patterns
  'Frame':       'OLW',   // own row, NOT part of KIT, alleles: OLW / n
  'Appaloosa':   'LP',    // badge label is "Leopard", alleles: LP / lp
  'PATN1':       'PATN1', // alleles: PATN1 / patn1
  'MITF':        'MITF',  // two badges (SW1 + SW3), one result, alleles: SW1|SW3 / n
  'SW2':         'SW2',   // alleles: SW2 / sw2
  'KIT':         'KIT',   // multiple badges (Tobiano, Sabino1, Roan, W3, W10…), one result
  'Pangare':     'PA',    // visible in Fjord Horse and others
};

// Fixed-base stubs
// For breeds whose fixed loci never appear in the DOM, the engine needs them
// pre-filled. Sourced from the "fixed" key in genesMapping.json
function getFixedStubs(breed) {
  const breedData = genesMapping[breed];
  if (!breedData || !breedData.fixed) return {};

  const stubs = {};
  for (const [locusKey, alleles] of Object.entries(breedData.fixed)) {
    stubs[locusKey] = alleles;
  }
  return stubs;
}

// Row parser
// Parse a single genetics table row
/**
 * @param {{ name: string, result: string, tested: boolean[] }} row
 * @returns {{ locusKey: string, alleles: [string, string], tested: [boolean, boolean] } | null}
 */
function parseRow(row) {
  const locusKey = DISPLAY_NAME_MAP[row.name.trim()];
  if (!locusKey) return null; // unknown display name, skip silently

  const parts = row.result.trim().split(' / ');
  if (parts.length !== 2) return null;

  const [a1, a2] = parts;
  const isUntested = a1 === '?' && a2 === '?';

  return {
    locusKey,
    alleles: [a1, a2],
    tested: [row.tested[0] ?? false, row.tested[1] ?? row.tested[0] ?? false],
    isUntested,
  };
}

// Main export
/**
 * @param {Array<{ name: string, result: string, tested: boolean[] }>} rows
 *   Serialised genetics rows from content.js.
 *   Each `tested` array has one entry per test_block badge on that row
 *   (most loci: 1 badge; KIT: 2+ badges).
 *
 * @param {string} breed
 *   Exact breed name as it appears on the horse's profile page.
 *
 * @param {Object} [hiddenGeneToggles={}]
 *   User-selected resolutions for ambiguous alleles, e.g.
 *   { A: ['A+', 'a'] } when a slot that tested as 'A' was toggled to A+.
 *   Provided by the hidden gene panel in the sidebar.
 *
 * @returns {{
 *   genotype: Object,
 *   tested: Object,
 *   breed: string,
 *   fullyUntested: boolean,
 *   partiallyTested: boolean
 * }}
 */
export function parseGenotype(rows, breed, hiddenGeneToggles = {}) {
  const genotype = {};
  const tested   = {};

  // 1. Parse visible rows from the DOM, filtering to loci the breed actually has
  const breedData    = genesMapping[breed];           // undefined when breed is unknown/empty
  const breedVisible = new Set(breedData?.visible ?? []);
  const breedWhites  = new Set(breedData?.whites  ?? []);

  // The DOM exposes a single "KIT" row that bundles all KIT-family white patterns
  // (Tobiano, Roan, Sabino, etc.). genesMapping stores them as individual keys.
  // Allow KIT through if the breed has any KIT-family gene in its mapping.
  const KIT_FAMILY = new Set(['TO', 'RN', 'SB1', 'WM', 'Y', 'rb', 'W3', 'W8', 'W10', 'W16', 'W19', 'W20', 'W21']);
  const breedAllowsKit = breedData
    ? [...breedVisible, ...breedWhites].some(l => KIT_FAMILY.has(l))
    : true;

  for (const row of rows) {
    const parsed = parseRow(row);
    if (!parsed || parsed.isUntested) continue;

    // Skip loci not in this breed's genetics, but only when we actually know the breed.
    // If breed is unrecognised/empty we pass everything through rather than returning nothing.
    const allowed = !breedData
      || breedVisible.has(parsed.locusKey)
      || breedWhites.has(parsed.locusKey)
      || (parsed.locusKey === 'KIT' && breedAllowsKit);
    if (!allowed) continue;

    genotype[parsed.locusKey] = parsed.alleles;
    tested[parsed.locusKey]   = parsed.tested;
  }

  // 2. Stub fixed-base loci that never appear in the DOM
  const fixedStubs = getFixedStubs(breed);
  for (const [locusKey, alleles] of Object.entries(fixedStubs)) {
    if (!(locusKey in genotype)) {
      genotype[locusKey] = alleles;
      tested[locusKey]   = [true, true]; // fixed = always known
    }
  }

  // 3. Apply defaults for hidden modifier loci (f, STY, PA) the breed has
  //    listed under `hidden`. The user can override via the hidden gene panel;
  //    loci already in genotype (e.g. fixed stubs or breed-visible) are left alone.
  const breedHidden = new Set(breedData?.hidden ?? []);
  for (const [locusKey, config] of Object.entries(hiddenModifiers)) {
    if (!breedHidden.has(locusKey)) continue;
    if (locusKey in genotype) continue;
    genotype[locusKey] = [...config.default];
    tested[locusKey]   = [true, true];
  }

  // 4. Merge hidden gene toggles from the panel.
  //    Toggles either resolve ambiguous alleles on an existing locus
  //    (Agouti slot → A/A+/At) or override a hidden modifier locus the breed
  //    has defaulted above. Fixed loci are not toggleable by the panel, so
  //    they will never appear in hiddenGeneToggles.
  for (const [locusKey, alleles] of Object.entries(hiddenGeneToggles)) {
    genotype[locusKey] = alleles;
    if (!(locusKey in tested)) tested[locusKey] = [true, true];
  }

  // 4. Compute test coverage flags
  const allRows = rows.filter(r => r.result.trim() !== '');
  const untestedRows = rows.filter(r => {
    const parts = r.result.trim().split(' / ');
    return parts[0] === '?' && parts[1] === '?';
  });

  const fullyUntested   = allRows.length > 0 && untestedRows.length === allRows.length;
  const partiallyTested = !fullyUntested && untestedRows.length > 0;

  return { genotype, tested, breed, fullyUntested, partiallyTested };
}
