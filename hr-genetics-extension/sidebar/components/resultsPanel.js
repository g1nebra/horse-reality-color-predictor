
// Renders the offspring probability table for a complete pairing.
// Export:
//   renderResults(pairing) → <div class="results-panel">

import { parseGenotype }      from '../../engine/genotypeParser.js';
import { calculateOffspring } from '../../engine/punnettEngine.js';

// Canonical locus display order. Base colour → dilutes → modifiers → grey.
const LOCUS_ORDER = ['E', 'A', 'CR', 'D', 'CH', 'Z', 'mu', 'f', 'STY', 'PA', 'G'];

// Main export
/**
 * @param {Object} pairing  { dam, sire }
 * @returns {HTMLElement}
 */
export function renderResults(pairing) {
  const panel = document.createElement('div');
  panel.className = 'results-panel';

  if (!pairing.dam || !pairing.sire) {
    panel.appendChild(emptyMsg('Both dam and sire are required to calculate offspring.'));
    return panel;
  }

  const damResult  = parseGenotype(pairing.dam.rows,  pairing.dam.breed,  pairing.dam.hiddenGeneToggles);
  const sireResult = parseGenotype(pairing.sire.rows, pairing.sire.breed, pairing.sire.hiddenGeneToggles);

  const damGeno  = damResult.genotype;
  const sireGeno = sireResult.genotype;

  const sharedLoci = Object.keys(damGeno).filter(l => l in sireGeno);

  if (sharedLoci.length === 0) {
    panel.appendChild(emptyMsg('No shared tested loci between dam and sire.'));
    return panel;
  }

  const outcomes = calculateOffspring(damGeno, sireGeno);

  if (outcomes.length === 0) {
    panel.appendChild(emptyMsg('No offspring outcomes could be calculated.'));
    return panel;
  }

  // Summary line
  const summary = document.createElement('div');
  summary.className   = 'results-summary';
  summary.textContent = `${outcomes.length} possible genotype${outcomes.length === 1 ? '' : 's'} · loci: ${sharedLoci.join(', ')}`;
  panel.appendChild(summary);

  // Partial test disclaimer
  if (damResult.partiallyTested || sireResult.partiallyTested) {
    const damOnly  = Object.keys(damGeno).filter(l => !(l in sireGeno));
    const sireOnly = Object.keys(sireGeno).filter(l => !(l in damGeno));
    const excluded = [
      ...damOnly.map(l  => `${l} (sire untested)`),
      ...sireOnly.map(l => `${l} (dam untested)`),
    ];
    if (excluded.length > 0) {
      const note = document.createElement('div');
      note.className   = 'results-partial-note';
      note.textContent = `⚠ Partial results. Excluded loci: ${excluded.join(', ')}`;
      panel.appendChild(note);
    }
  }

  // OLW lethal combo warning
  const lethalSet = new Set(
    outcomes
      .filter(o => o.genotype.OLW?.[0] === 'OLW' && o.genotype.OLW?.[1] === 'OLW')
      .map(o => o.genotype)
  );
  if (lethalSet.size > 0) {
    const lethalProb = outcomes
      .filter(o => o.genotype.OLW?.[0] === 'OLW' && o.genotype.OLW?.[1] === 'OLW')
      .reduce((sum, o) => sum + o.probability, 0);
    const warning = document.createElement('div');
    warning.className   = 'results-lethal-warning';
    warning.textContent = `⚠ ${formatProbability(lethalProb)} chance of OLW/OLW. This is a lethal combination (OLWS). Affected genotypes are marked below.`;
    panel.appendChild(warning);
  }

  // Table
  const table = buildTable(outcomes, sharedLoci, lethalSet);
  panel.appendChild(table);

  return panel;
}

// Table builder

/**
 * @param {Array<{ genotype: Object, probability: number }>} outcomes
 * @param {string[]} sharedLoci
 * @returns {HTMLTableElement}
 */
function buildTable(outcomes, sharedLoci, lethalSet = new Set()) {
  // Sort loci in canonical display order, unknown loci appended at end
  const orderedLoci = [
    ...LOCUS_ORDER.filter(l => sharedLoci.includes(l)),
    ...sharedLoci.filter(l => !LOCUS_ORDER.includes(l)),
  ];

  const table = document.createElement('table');
  table.className = 'results-table';

  // Head
  const thead = table.createTHead();
  const headRow = thead.insertRow();
  const thGeno = document.createElement('th');
  thGeno.textContent = 'Genotype';
  const thProb = document.createElement('th');
  thProb.className   = 'col-prob';
  thProb.textContent = '%';
  headRow.append(thGeno, thProb);

  // Body
  const tbody = table.createTBody();
  for (const { genotype, probability } of outcomes) {
    const row = tbody.insertRow();
    const isLethal = lethalSet.has(genotype);
    if (isLethal) row.className = 'lethal-row';

    const tdGeno = row.insertCell();
    tdGeno.className = 'genotype-cell';
    tdGeno.appendChild(buildGenotypeCell(genotype, orderedLoci));
    if (isLethal) {
      const tag = document.createElement('span');
      tag.className   = 'lethal-tag';
      tag.textContent = 'lethal';
      tdGeno.appendChild(tag);
    }

    const tdProb = row.insertCell();
    tdProb.className   = 'col-prob';
    tdProb.textContent = formatProbability(probability);
  }

  return table;
}

// Genotype cell builder

/**
 * Renders `E: E/e · A: A/a · CR: n/n` etc.
 *
 * @param {Object}   genotype
 * @param {string[]} orderedLoci
 * @returns {DocumentFragment}
 */
function buildGenotypeCell(genotype, orderedLoci) {
  const frag = document.createDocumentFragment();

  orderedLoci.forEach((locus, i) => {
    if (!(locus in genotype)) return;

    if (i > 0) {
      const sep = document.createElement('span');
      sep.className   = 'genotype-sep';
      sep.textContent = ' · ';
      sep.style.color = '#444';
      frag.appendChild(sep);
    }

    const pair = document.createElement('span');
    pair.className = 'genotype-pair';

    const locusSpan = document.createElement('span');
    locusSpan.className   = 'genotype-locus';
    locusSpan.textContent = `${locus}: `;

    const alleles = genotype[locus];
    const allelesSpan = document.createElement('span');
    allelesSpan.textContent = `${alleles[0]}/${alleles[1]}`;

    pair.append(locusSpan, allelesSpan);
    frag.appendChild(pair);
  });

  return frag;
}

// Probability formatter

/**
 * 0.25  → "25%"
 * 0.0625 → "6.25%"
 * 0.004  → "<1%"
 *
 * @param {number} p  0–1
 * @returns {string}
 */
function formatProbability(p) {
  const pct = p * 100;
  if (pct < 0.5) return '<1%';
  if (Number.isInteger(pct)) return `${pct}%`;
  // Round to at most 2 decimal places, strip trailing zeros
  return `${parseFloat(pct.toFixed(2))}%`;
}

// Helper
function emptyMsg(text) {
  const el = document.createElement('div');
  el.className   = 'results-empty';
  el.textContent = text;
  return el;
}