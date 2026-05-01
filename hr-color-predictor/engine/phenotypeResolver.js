// Phenotype resolver, see planning-and-research/phenotype_resolver_plan.md
// Translates a parsed genotype into a readable coat colour name plus a list of
// white-pattern overlays. Phase A covers base + dilutions + modifiers + grey;
// Phase B layers in white patterns, Appaloosa composition, and lethal detection.

// Breed names that follow the incomplete-dominant Sooty rule on chestnut.
// Plan 8: Lusitano, Trakehner, Oldenburg, Haflinger treat STY/n distinctly from
// STY/STY on chestnut bases. v1 still flattens both into a single "Sooty" prefix
// (refine later if users ask). What this set actually controls is whether
// STY/n is enough to fire Sooty on a chestnut, instead of needing STY/STY.
const SOOTY_INCOMPLETE_DOMINANT_BREEDS = new Set([
  'Lusitano',
  'Trakehner',
  'Oldenburg',
  'Haflinger Horse',
]);

// Breed-specific identifier used by individual rules.
const KATHIAWARI = 'Kathiawari Horse';

// Allele helpers

function pair(g, locus) {
  const p = g?.[locus];
  return Array.isArray(p) ? p : null;
}

function has(g, locus, allele) {
  const p = pair(g, locus);
  return !!p && (p[0] === allele || p[1] === allele);
}

function bothEqual(g, locus, allele) {
  const p = pair(g, locus);
  return !!p && p[0] === allele && p[1] === allele;
}

function countAllele(g, locus, allele) {
  const p = pair(g, locus);
  if (!p) return 0;
  return (p[0] === allele ? 1 : 0) + (p[1] === allele ? 1 : 0);
}

// Underlying base classification. Used by every rule that needs to know what
// pigment the horse actually has, regardless of how the working name has been
// transformed by earlier dilutions.
//   chestnut → e/e, no black pigment
//   wild-bay → E_, A+ priority
//   bay      → E_, A priority
//   seal     → E_, At priority
//   black    → E_, a/a
//   unknown  → E missing, or E_ with A missing
function baseType(g) {
  if (!pair(g, 'E')) return 'unknown';
  if (bothEqual(g, 'E', 'e')) return 'chestnut';
  // E is non-e/e, Agouti must be present to determine base
  if (!pair(g, 'A')) return 'unknown';
  if (has(g, 'A', 'A+')) return 'wild-bay';
  if (has(g, 'A', 'A'))  return 'bay';
  if (has(g, 'A', 'At')) return 'seal';
  return 'black';
}

// True when the cream/pearl shared locus produces a double-dilute look:
// CR/CR, CR/prl, or prl/prl. Used by Champagne and Silver masking.
function isDoubleDilute(g) {
  const cr  = countAllele(g, 'CR', 'CR');
  const prl = countAllele(g, 'CR', 'prl');
  return cr === 2 || (cr === 1 && prl === 1) || prl === 2;
}

// Is the horse a "no-red-pigment" coat overall? Used by Mushroom and Flaxen,
// both of which only act on red pigment. Black-based coats never have red.
function noRedPigment(t) {
  return t === 'black' || t === 'seal';
}

// Rule 1: base colour from E + A

function resolveBase(g) {
  const t = baseType(g);
  if (t === 'unknown') return null;
  return ({
    'chestnut': 'Chestnut',
    'wild-bay': 'Wild Bay',
    'bay':      'Bay',
    'seal':     'Seal Brown',
    'black':    'Black',
  })[t];
}

// Rule 2: Cream and Pearl

const SINGLE_CREAM = {
  'Chestnut':   'Palomino',
  'Bay':        'Buckskin',
  'Wild Bay':   'Wild Bay Buckskin',
  'Seal Brown': 'Seal Buckskin',
  'Black':      'Smoky Black',
};

const DOUBLE_CREAM = {
  'Chestnut':   'Cremello',
  'Bay':        'Perlino',
  'Wild Bay':   'Wild Bay Perlino',
  'Seal Brown': 'Seal Perlino',
  'Black':      'Smoky Cream',
};

const DOUBLE_PEARL = {
  'Chestnut':   'Pearl Chestnut',
  'Bay':        'Pearl Bay',
  'Wild Bay':   'Pearl Wild Bay',
  'Seal Brown': 'Pearl Seal Brown',
  'Black':      'Pearl Black',
};

function applyCreamPearl(name, g) {
  const cr  = countAllele(g, 'CR', 'CR');
  const prl = countAllele(g, 'CR', 'prl');
  if (cr === 2 || (cr === 1 && prl === 1)) return DOUBLE_CREAM[name] ?? name;
  if (cr === 1)                            return SINGLE_CREAM[name] ?? name;
  if (prl === 2)                           return DOUBLE_PEARL[name] ?? name;
  return name;
}

// Rule 3: Champagne. Masked on every double dilute (including prl/prl).

const CHAMPAGNE = {
  'Chestnut':           'Gold Champagne',
  'Bay':                'Amber Champagne',
  'Wild Bay':           'Wild Bay Amber Champagne',
  'Seal Brown':         'Sable Champagne',
  'Black':              'Classic Champagne',
  'Palomino':           'Gold Cream Champagne',
  'Buckskin':           'Amber Cream Champagne',
  'Wild Bay Buckskin':  'Wild Bay Amber Cream Champagne',
  'Seal Buckskin':      'Sable Cream Champagne',
  'Smoky Black':        'Classic Cream Champagne',
};

function applyChampagne(name, g) {
  if (!has(g, 'CH', 'CH')) return name;
  if (isDoubleDilute(g))   return name;
  return CHAMPAGNE[name] ?? name;
}

// Rule 4: Silver. Black pigment only. Skipped on chestnut bases and on every
// double dilute (pigment is too pale to show silver).

function applySilver(name, g) {
  if (!has(g, 'Z', 'Z'))    return name;
  if (baseType(g) === 'chestnut') return name;
  if (isDoubleDilute(g))    return name;
  return `Silver ${name}`;
}

// Rule 5: Mushroom. Recessive (mu/mu), affects red pigment. Plan §5 explicitly
// excludes black AND seal-based coats. Masked on double dilutes too.
// Special case: plain Chestnut → "Mushroom" (replacement, not prefix).

function applyMushroom(name, g) {
  if (!bothEqual(g, 'mu', 'mu')) return name;
  const t = baseType(g);
  if (t !== 'chestnut' && t !== 'bay' && t !== 'wild-bay') return name;
  if (isDoubleDilute(g)) return name;
  if (name === 'Chestnut') return 'Mushroom';
  return `Mushroom ${name}`;
}

// Rule 6: Dun. D dominates. nd1 alone produces primitive markings without body
// dilution, captured in notes for the UI tooltip.

function applyDun(name, g, notes) {
  if (has(g, 'D', 'D')) return `${name} Dun`;
  if (has(g, 'D', 'nd1')) {
    notes.push('Primitive markings (nd1) without dun dilution.');
    return name;
  }
  return name;
}

// Rule 7: Flaxen. Recessive (f/f), only visible on red-mane coats. After Mushroom
// has run, the working name on a chestnut horse may be "Mushroom", which loses
// the visible red mane, Flaxen does not apply.

function applyFlaxen(name, g) {
  if (!bothEqual(g, 'f', 'f')) return name;
  if (baseType(g) !== 'chestnut') return name;
  if (isDoubleDilute(g)) return name;
  if (name === 'Mushroom' || name.startsWith('Mushroom ')) return name;
  return `Flaxen ${name}`;
}

// Rule 8: Sooty. Breed-aware, dose-aware, masked by Grey, Dun (except Kathiawari),
// and any double dilute including mu/mu.
// Naming exception: plain Chestnut and Flaxen Chestnut take the "Liver" prefix
// instead of "Sooty".

function applySooty(name, g, breed) {
  const styCount = countAllele(g, 'STY', 'STY');
  if (styCount === 0) return name;

  const t = baseType(g);
  if (t === 'black') return name;

  if (has(g, 'D', 'D') && breed !== KATHIAWARI) return name;
  if (isDoubleDilute(g)) return name;
  if (bothEqual(g, 'mu', 'mu')) return name;

  // Bay-based and seal: single copy is enough.
  if (t === 'bay' || t === 'wild-bay' || t === 'seal') {
    return prefixSooty(name);
  }

  // Chestnut: most breeds need STY/STY, four breeds fire on STY/n too.
  if (t === 'chestnut') {
    const requiresHomo = !SOOTY_INCOMPLETE_DOMINANT_BREEDS.has(breed);
    if (requiresHomo && styCount < 2) return name;
    return prefixSooty(name);
  }

  return name;
}

function prefixSooty(name) {
  if (name === 'Chestnut' || name === 'Flaxen Chestnut') return `Liver ${name}`;
  return `Sooty ${name}`;
}

// Rule 9: Pangaré. Dominant. Shows on every base except black.

function applyPangare(name, g) {
  if (!has(g, 'PA', 'PA')) return name;
  if (baseType(g) === 'black') return name;
  return `Pangaré ${name}`;
}

// Rule 10: Grey. Single copy is enough. Wipes the colour name; modifier notes
// are dropped because the visible coat is grey. White-pattern overlays survive.

function isGrey(g) {
  return has(g, 'G', 'G');
}

// Rule 11: White-pattern overlays.
// Patterns layer on top of the base colour, never replace it. Each rule
// contributes at most one entry to the returned list. The KIT row in the DOM
// bundles several patterns into a single allele pair, so KIT-family checks all
// look inside `genotype.KIT`.

// Every Wx allele the engine knows about. Used both for pattern listing and
// for lethal detection. Keep these in sync with anything that surfaces in the
// DOM via the KIT row.
const W_ALLELES = [
  'W2',  'W3',  'W5',  'W6',  'W7',  'W8',  'W10', 'W14',
  'W15', 'W16', 'W17', 'W19', 'W20', 'W21', 'W22', 'W23',
  'W25', 'W26', 'W27', 'W31', 'W34',
];

// W20/W20 is the only homozygous W combination that survives. Every other Wx/Wx
// is embryonic-lethal (failed cover).
const W_VIABLE_HOMOZYGOUS = new Set(['W20']);

// Resolve the visible Appaloosa pattern from LP / PATN1 / PATN2 dosage.
// Returns null when no LP is present.
function resolveAppaloosa(g) {
  const lpCount    = countAllele(g, 'LP', 'LP');
  if (lpCount === 0) return null;

  const patn1Count = countAllele(g, 'PATN1', 'PATN1');
  const hasPatn1   = patn1Count > 0;
  const hasPatn2   = has(g, 'PATN2', 'PATN2');

  // PATN1 takes precedence over PATN2 when both are present.
  if (hasPatn1) {
    if (lpCount === 1) return patn1Count === 2 ? 'Leopard' : 'Blanket';
    return patn1Count === 2 ? 'Few-Spot Leopard' : 'Snowcap';
  }
  if (hasPatn2) {
    return lpCount === 1 ? 'Blanket' : 'Snowcap';
  }
  // LP without any PATN modifier
  return 'Varnish';
}

function resolvePatterns(g, notes) {
  const patterns = [];

  // KIT-family (single bundled DOM row)
  if (has(g, 'KIT', 'TO'))  patterns.push('Tobiano');
  if (has(g, 'KIT', 'RN')) {
    patterns.push('Roan');
    notes.push('Roan only shows in-game from age 3.');
  }
  if (has(g, 'KIT', 'SB1')) patterns.push('Sabino 1');
  for (const w of W_ALLELES) {
    if (has(g, 'KIT', w)) patterns.push(`KIT-${w}`);
  }

  // Frame Overo (own row, lethal when homozygous)
  if (has(g, 'OLW', 'OLW')) patterns.push('Frame Overo');

  // Splashed White at MITF (SW1 + SW3 share the locus, both labelled together)
  if (has(g, 'MITF', 'SW1') || has(g, 'MITF', 'SW3')) patterns.push('Splashed White');

  // Splashed White 2 (own locus)
  if (has(g, 'SW2', 'SW2')) patterns.push('Splashed White 2');

  // HR-custom hidden whites (user-asserted via the hidden gene panel)
  if (bothEqual(g, 'Y',  'Y'))  patterns.push('Hidden Sabino');
  if (bothEqual(g, 'rb', 'rb')) patterns.push('Rabicano');
  if (has(g, 'WM', 'WM'))       patterns.push('White Markings');

  // Appaloosa composition (LP + PATN1 + PATN2)
  const appaloosa = resolveAppaloosa(g);
  if (appaloosa) patterns.push(appaloosa);

  return patterns;
}

// Lethal genotypes: OLW/OLW or any homozygous Wx that isn't on the viable list.
function isLethal(g) {
  if (bothEqual(g, 'OLW', 'OLW')) return true;
  for (const w of W_ALLELES) {
    if (W_VIABLE_HOMOZYGOUS.has(w)) continue;
    const p = pair(g, 'KIT');
    if (p && p[0] === w && p[1] === w) return true;
  }
  return false;
}

// Main export

/**
 * @param {Object} genotype  Parsed genotype, e.g. { E: ['E','e'], A: ['A','a'], ... }
 * @param {string} breed     Exact breed name as stored in genesMapping
 * @returns {{ base: string, patterns: string[], lethal: boolean, notes: string[] }}
 */
export function resolvePhenotype(genotype, breed) {
  const notes = [];
  const lethal = isLethal(genotype);

  let name = resolveBase(genotype);
  if (name === null) {
    // Base couldn't be determined. Patterns and lethal flag don't depend on
    // base colour, surface those anyway so the user still sees Tobiano /
    // Lethal White / etc. on partial-test outcomes.
    const patternNotes = [];
    const patterns     = resolvePatterns(genotype, patternNotes);

    const missing = [];
    const eP = pair(genotype, 'E');
    const aP = pair(genotype, 'A');
    if (!eP) missing.push('Extension');
    if (eP && !(eP[0] === 'e' && eP[1] === 'e') && !aP) missing.push('Agouti');

    const reasonNote = missing.length > 0
      ? `Base colour incomplete, ${missing.join(' and ')} not tested in both parents.`
      : 'Base colour cannot be determined.';

    return {
      base:     'Unknown',
      patterns,
      lethal,
      notes:    [reasonNote, ...patternNotes],
    };
  }

  name = applyCreamPearl(name, genotype);
  name = applyChampagne(name, genotype);
  name = applySilver(name, genotype);
  name = applyMushroom(name, genotype);
  name = applyDun(name, genotype, notes);
  name = applyFlaxen(name, genotype);

  name = applySooty(name, genotype, breed);
  name = applyPangare(name, genotype);

  // White patterns are computed against the genotype, independent of any base
  // transform we did above. Pattern-specific notes (e.g. Roan age-gate) collect
  // separately so they can be dropped by the Grey override below.
  const patternNotes = [];
  const patterns     = resolvePatterns(genotype, patternNotes);

  if (isGrey(genotype)) {
    // Grey wipes the colour name and every modifier note. Pattern overlays
    // survive (still visible during the foal phase and on early-grey adults).
    return {
      base:     'Grey',
      patterns,
      lethal,
      notes:    ['Grey overrides all colour at adulthood, foal shows base colour.'],
    };
  }

  if (lethal) {
    // Lethal foals are flagged with the community-standard "Lethal White" name.
    // Existing notes and patterns are kept for context.
    return {
      base:     'Lethal White',
      patterns,
      lethal:   true,
      notes:    [...notes, ...patternNotes],
    };
  }

  return { base: name, patterns, lethal, notes: [...notes, ...patternNotes] };
}
