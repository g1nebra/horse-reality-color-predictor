
// Renders the offspring probability table for a complete pairing.
// Export:
//   renderResults(pairing) → <div class="results-panel">

import { parseGenotype }      from '../../engine/genotypeParser.js';
import { calculateOffspring } from '../../engine/punnettEngine.js';
import { resolvePhenotype }   from '../../engine/phenotypeResolver.js';
import coatVariations         from '../../data/coatVariations.js';

// Canonical locus display order. Base colour → dilutes → modifiers → grey.
const LOCUS_ORDER = ['E', 'A', 'CR', 'D', 'CH', 'Z', 'mu', 'f', 'STY', 'PA', 'G'];

// Inherited variations ride on a hidden numeric value that is bred up by breeding
// horses that show the variation, or that have it in their family line. We can't
// read that number, so we surface a relative level from how the parents are marked.
const MARKER_WEIGHT = { expresses: 2, line: 1, none: 0 };

const CHANCE_LABELS = {
  random:    'random',
  low:       'low chance',
  increased: 'increased chance',
  high:      'high chance',
};

function chanceLevelFor(key, dam, sire) {
  if (coatVariations[key]?.inheritance === 'random') return 'random';
  const score = (MARKER_WEIGHT[dam?.variationMarkers?.[key]]  ?? 0)
              + (MARKER_WEIGHT[sire?.variationMarkers?.[key]] ?? 0);
  if (score >= 3) return 'high';
  if (score >= 1) return 'increased';
  return 'low';
}

// "a", "a and b", "a, b and c"
function listJoin(items) {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// Which phenotype groups are collapsed, remembered across re-renders of the same
// pairing (a hidden-gene or marker change re-renders the results). Reset when a
// different pairing is opened.
let collapsedGroups = new Set();
let collapseScopeId = null;

// Collapse/expand a group's <tbody> with a small fade animation. `collapsedGroups`
// is the source of truth (updated by the caller); this only drives the visuals.
const GROUP_ANIM_MS = 150;
function setGroupCollapsed(tbody, collapse) {
  clearTimeout(tbody.__animTimer);
  const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (collapse) {
    if (instant) { tbody.classList.add('collapsed'); return; }
    tbody.classList.add('anim-collapse');
    tbody.__animTimer = setTimeout(() => {
      tbody.classList.remove('anim-collapse');
      tbody.classList.add('collapsed');
    }, GROUP_ANIM_MS);
  } else {
    tbody.classList.remove('collapsed');
    if (instant) return;
    tbody.classList.add('anim-expand');
    tbody.__animTimer = setTimeout(() => tbody.classList.remove('anim-expand'), GROUP_ANIM_MS);
  }
}

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

  // Reset remembered collapse state when switching to a different pairing.
  if (pairing.id !== collapseScopeId) {
    collapsedGroups = new Set();
    collapseScopeId = pairing.id;
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

  const orderedLoci = [
    ...LOCUS_ORDER.filter(l => sharedLoci.includes(l)),
    ...sharedLoci.filter(l => !LOCUS_ORDER.includes(l)),
  ];

  // Summary line with clickable loci. Each locus expands a breakdown panel
  // showing homozygous/heterozygous probability and per-genotype probabilities
  // for that locus alone.
  const summary = document.createElement('div');
  summary.className = 'results-summary';

  const summaryText = document.createElement('span');
  summaryText.textContent = `${outcomes.length} possible genotype${outcomes.length === 1 ? '' : 's'} · loci: `;
  summary.appendChild(summaryText);

  const breakdownContainer = document.createElement('div');
  breakdownContainer.className = 'locus-breakdowns';

  orderedLoci.forEach((locus, i) => {
    const btn = document.createElement('button');
    btn.type        = 'button';
    btn.className   = 'locus-button';
    btn.textContent = locus;
    btn.title       = `Click to see ${locus} probability breakdown`;
    btn.addEventListener('click', () => toggleLocusBreakdown(locus, btn, breakdownContainer, outcomes));
    summary.appendChild(btn);
    if (i < orderedLoci.length - 1) summary.appendChild(document.createTextNode(', '));
  });

  panel.appendChild(summary);
  panel.appendChild(breakdownContainer);

  // Partial test disclaimer
  if (damResult.partiallyTested || sireResult.partiallyTested) {
    const damUntested  = untestedRowNames(pairing.dam.rows);
    const sireUntested = untestedRowNames(pairing.sire.rows);
    const bothUntested = damUntested.filter(n => sireUntested.includes(n));
    const damOnlyUntested  = damUntested.filter(n => !sireUntested.includes(n));
    const sireOnlyUntested = sireUntested.filter(n => !damUntested.includes(n));

    const excluded = [
      ...damOnlyUntested.map(n  => `${n} (dam untested)`),
      ...sireOnlyUntested.map(n => `${n} (sire untested)`),
      ...bothUntested.map(n     => `${n} (both untested)`),
    ];
    if (excluded.length > 0) {
      const note = document.createElement('div');
      note.className   = 'results-partial-note';
      note.textContent = `⚠ Partial results. Excluded loci: ${excluded.join(', ')}`;
      panel.appendChild(note);
    }
  }

  // Resolve the phenotype once per outcome and reuse for the lethal warning,
  // the row tagging, and the Phenotype column.
  const breed = pairing.dam.breed; // pairings are same-breed, either works
  const phenotypeByGenotype = new Map();
  for (const o of outcomes) {
    phenotypeByGenotype.set(o.genotype, resolvePhenotype(o.genotype, breed));
  }

  // Lethal warning, sums every lethal outcome (OLW/OLW + non-W20 Wx homozygous).
  const lethalOutcomes = outcomes.filter(o => phenotypeByGenotype.get(o.genotype).lethal);
  const lethalSet = new Set(lethalOutcomes.map(o => o.genotype));
  if (lethalOutcomes.length > 0) {
    const lethalProb = lethalOutcomes.reduce((sum, o) => sum + o.probability, 0);
    const warning = document.createElement('div');
    warning.className   = 'results-lethal-warning';
    warning.textContent = `⚠ ${formatProbability(lethalProb)} chance of a lethal combination. Affected genotypes are marked below.`;
    panel.appendChild(warning);
  }

  // Special coat variations any outcome is eligible for, plus the relative chance
  // level implied by how the two parents are marked.
  const shownVariations = new Set();
  for (const ph of phenotypeByGenotype.values()) {
    for (const key of ph?.variations ?? []) shownVariations.add(key);
  }

  const chanceLevels = {};
  for (const key of shownVariations) {
    chanceLevels[key] = chanceLevelFor(key, pairing.dam, pairing.sire);
  }

  if (shownVariations.size > 0) {
    panel.appendChild(buildVariationNote([...shownVariations]));
  }

  // Table
  const table = buildTable(outcomes, sharedLoci, lethalSet, phenotypeByGenotype, chanceLevels);

  // Compact / expand-all control (only when there is more than one outcome row).
  if (outcomes.length > 1) {
    const bar = document.createElement('div');
    bar.className = 'results-compact-bar';

    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'results-compact-toggle';

    const bodies = () => [...table.querySelectorAll('tbody.group')];
    const syncLabel = () => {
      const bs = bodies();
      const allCollapsed = bs.length > 0 && bs.every(tb => collapsedGroups.has(tb.dataset.groupKey));
      btn.textContent = allCollapsed ? '▸ Expand all' : '▾ Compact all';
    };

    btn.addEventListener('click', () => {
      const allCollapsed = bodies().every(tb => collapsedGroups.has(tb.dataset.groupKey));
      for (const tb of bodies()) {
        const key = tb.dataset.groupKey;
        if (allCollapsed) collapsedGroups.delete(key);
        else              collapsedGroups.add(key);
        setGroupCollapsed(tb, !allCollapsed);
      }
      syncLabel();
    });

    // Keep the label in sync when a single group is toggled from its header.
    table.addEventListener('hr-group-toggle', syncLabel);
    syncLabel();

    bar.appendChild(btn);
    panel.appendChild(bar);
  }

  panel.appendChild(table);

  return panel;
}

// Disclaimer explaining the two kinds of special coat variation currently in play.
function buildVariationNote(keys) {
  const note = document.createElement('div');
  note.className = 'results-variation-note';

  const badge = document.createElement('span');
  badge.className   = 'results-variation-badge';
  badge.textContent = 'info';

  const text = document.createElement('span');
  text.className = 'results-variation-text';

  const randomLabels    = keys.filter(k => coatVariations[k]?.inheritance === 'random')
                              .map(k => coatVariations[k].label);
  const inheritedLabels = keys.filter(k => coatVariations[k]?.inheritance === 'inherited')
                              .map(k => coatVariations[k].label);

  const parts = [];
  if (randomLabels.length > 0) {
    parts.push(
      `${listJoin(randomLabels)} ${randomLabels.length === 1 ? 'is' : 'are'} COMPLETELY RANDOM: `
      + 'the parents’ coats do not affect it and it cannot be inherited or bred for.',
    );
  }
  if (inheritedLabels.length > 0) {
    parts.push(
      `${listJoin(inheritedLabels)} ${inheritedLabels.length === 1 ? 'is' : 'are'} inheritable `
      + 'through hidden numeric genetics. Mark each parent as expressing it, or having it in '
      + 'their family line, to raise the chance shown. Horses that do not show it still carry '
      + 'the alleles and can pass them on.',
    );
  }
  parts.push(
    'The real odds are hidden, so this tool shows eligibility and a relative chance level, '
    + 'not a computed probability.',
  );

  text.textContent = parts.join(' ') + ' ';

  const source = document.createElement('a');
  source.className   = 'results-variation-source';
  source.href        = 'https://horsereality.wiki/en/Horses/Breeding/Inheritance-101';
  source.target      = '_blank';
  source.rel         = 'noopener noreferrer';
  source.textContent = 'Source';
  text.appendChild(source);

  note.append(badge, text);
  return note;
}

// Table builder

/**
 * @param {Array<{ genotype: Object, probability: number }>} outcomes
 * @param {string[]} sharedLoci
 * @returns {HTMLTableElement}
 */
function buildTable(outcomes, sharedLoci, lethalSet = new Set(), phenotypeByGenotype = new Map(), chanceLevels = {}) {
  // Sort loci in canonical display order, unknown loci appended at end
  const orderedLoci = [
    ...LOCUS_ORDER.filter(l => sharedLoci.includes(l)),
    ...sharedLoci.filter(l => !LOCUS_ORDER.includes(l)),
  ];

  // Group outcomes by visible phenotype (base + sorted patterns + lethal flag).
  // Notes are not part of the key so groups merge across genotype variants that
  // happen to surface different notes (e.g., nd1 markings).
  const groups = new Map();
  for (const o of outcomes) {
    const ph = phenotypeByGenotype.get(o.genotype);
    const patterns = [...(ph?.patterns ?? [])].sort();
    const key = `${ph?.base ?? '?'}|${patterns.join('·')}|${ph?.lethal ? 'L' : ''}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, phenotype: ph, outcomes: [], totalProb: 0, lethal: !!ph?.lethal };
      groups.set(key, g);
    }
    g.outcomes.push(o);
    g.totalProb += o.probability;
  }
  const sortedGroups = [...groups.values()].sort((a, b) => b.totalProb - a.totalProb);
  for (const g of sortedGroups) {
    g.outcomes.sort((a, b) => b.probability - a.probability);
  }

  const table = document.createElement('table');
  table.className = 'results-table';

  // Two-column header: outcome name + total probability
  const thead = table.createTHead();
  const headRow = thead.insertRow();
  const thOutcome = document.createElement('th');
  thOutcome.textContent = 'Outcome';
  const thProb = document.createElement('th');
  thProb.className   = 'col-prob';
  thProb.textContent = '%';
  headRow.append(thOutcome, thProb);

  // One <tbody> per phenotype group: header row with phenotype + total %,
  // followed by detail rows for each contributing genotype + its individual %.
  for (const group of sortedGroups) {
    const tbody = document.createElement('tbody');
    tbody.className = 'group';
    if (group.lethal) tbody.classList.add('lethal-group');
    tbody.dataset.groupKey = group.key;
    if (collapsedGroups.has(group.key)) tbody.classList.add('collapsed');

    const headerRow = document.createElement('tr');
    headerRow.className = 'group-header clickable';
    if (group.lethal) headerRow.classList.add('lethal-row');
    headerRow.title = 'Click to collapse / expand genotypes';
    headerRow.addEventListener('click', () => {
      const willCollapse = !collapsedGroups.has(group.key);
      if (willCollapse) collapsedGroups.add(group.key);
      else              collapsedGroups.delete(group.key);
      setGroupCollapsed(tbody, willCollapse);
      table.dispatchEvent(new CustomEvent('hr-group-toggle'));
    });

    const headerCell = document.createElement('td');
    headerCell.className = 'phenotype-cell group-phenotype';
    const caret = document.createElement('span');
    caret.className   = 'group-caret';
    caret.textContent = '▾';
    headerCell.appendChild(caret);
    headerCell.appendChild(buildPhenotypeCell(group.phenotype, chanceLevels));
    if (group.lethal) {
      const tag = document.createElement('span');
      tag.className   = 'lethal-tag';
      tag.textContent = 'lethal';
      headerCell.appendChild(tag);
    }

    const headerProb = document.createElement('td');
    headerProb.className   = 'col-prob group-total-prob';
    headerProb.textContent = formatProbability(group.totalProb);

    headerRow.append(headerCell, headerProb);
    tbody.appendChild(headerRow);

    for (const { genotype, probability } of group.outcomes) {
      const detailRow = document.createElement('tr');
      detailRow.className = 'group-detail';

      const detailCell = document.createElement('td');
      detailCell.className = 'genotype-cell group-genotype';
      detailCell.appendChild(buildGenotypeCell(genotype, orderedLoci));

      const detailProb = document.createElement('td');
      detailProb.className   = 'col-prob group-detail-prob';
      detailProb.textContent = formatProbability(probability);

      detailRow.append(detailCell, detailProb);
      tbody.appendChild(detailRow);
    }

    table.appendChild(tbody);
  }

  return table;
}

// Phenotype cell builder

/**
 * Renders the resolved coat name, white-pattern overlays, and an optional `*`
 * marker linking to notes via a tooltip.
 *
 * @param {{ base: string, patterns: string[], lethal: boolean, notes: string[], variations: string[] }} phenotype
 * @param {Object} chanceLevels  { [variationKey]: 'random'|'low'|'increased'|'high' }
 * @returns {DocumentFragment}
 */
function buildPhenotypeCell(phenotype, chanceLevels = {}) {
  const frag = document.createDocumentFragment();
  const { base, patterns = [], notes = [], variations = [] } = phenotype ?? {};

  const baseSpan = document.createElement('span');
  baseSpan.className   = base === 'Unknown' ? 'phenotype-base phenotype-base-unknown' : 'phenotype-base';
  baseSpan.textContent = base ?? '?';
  frag.appendChild(baseSpan);

  if (patterns.length > 0) {
    const sep = document.createElement('span');
    sep.className   = 'phenotype-sep';
    sep.textContent = ' · ';
    frag.appendChild(sep);

    const patternsSpan = document.createElement('span');
    patternsSpan.className   = 'phenotype-patterns';
    patternsSpan.textContent = patterns.join(' · ');
    frag.appendChild(patternsSpan);
  }

  if (notes.length > 0) {
    const noteEl = document.createElement('div');
    noteEl.className   = 'phenotype-note';
    noteEl.textContent = notes.join(' · ');
    frag.appendChild(noteEl);
  }

  // Special coat variations this outcome is eligible for. Eligibility means the
  // foal has the required underlying pattern, not that it will express it.
  if (variations.length > 0) {
    const specEl = document.createElement('div');
    specEl.className = 'phenotype-speculative';

    const label = document.createElement('span');
    label.className   = 'phenotype-speculative-label';
    label.textContent = 'chance of ';
    specEl.appendChild(label);

    for (const key of variations) {
      const config = coatVariations[key];
      if (!config) continue;

      const badge = document.createElement('span');
      badge.className   = 'variation-badge';
      badge.textContent = `${config.short}?`;
      badge.title       = `${config.label}. ${config.note}`;
      specEl.appendChild(badge);

      const level = chanceLevels[key] ?? (config.inheritance === 'random' ? 'random' : 'low');
      const chip  = document.createElement('span');
      chip.className   = `variation-chance variation-chance-${level}`;
      chip.textContent = CHANCE_LABELS[level];
      chip.title = config.inheritance === 'random'
        ? config.note
        : 'Relative level based on how you marked the parents. The real odds are hidden.';
      specEl.appendChild(chip);
    }

    frag.appendChild(specEl);
  }

  return frag;
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

// Per-locus breakdown
//
// Click handler for a locus button in the summary line. Toggles a panel that
// shows the homozygous/heterozygous split and per-genotype probabilities for
// that locus alone.
function toggleLocusBreakdown(locus, btn, container, outcomes) {
  const id = `locus-breakdown-${locus}`;
  const existing = container.querySelector(`[data-locus="${locus}"]`);
  if (existing) {
    existing.remove();
    btn.classList.remove('locus-button-active');
    return;
  }

  const breakdown = computeLocusBreakdown(outcomes, locus);
  const panel = renderLocusBreakdown(locus, breakdown);
  panel.dataset.locus = locus;
  panel.id = id;
  container.appendChild(panel);
  btn.classList.add('locus-button-active');
}

function computeLocusBreakdown(outcomes, locus) {
  let homozygousProb   = 0;
  let heterozygousProb = 0;
  const groups = new Map();

  for (const o of outcomes) {
    const alleles = o.genotype[locus];
    if (!alleles) continue;

    if (alleles[0] === alleles[1]) homozygousProb   += o.probability;
    else                            heterozygousProb += o.probability;

    const sorted = sortAllelesCanonical([alleles[0], alleles[1]]);
    const key = `${sorted[0]}/${sorted[1]}`;
    groups.set(key, (groups.get(key) ?? 0) + o.probability);
  }

  return {
    homozygous:   homozygousProb,
    heterozygous: heterozygousProb,
    perGenotype:  [...groups.entries()].sort((a, b) => b[1] - a[1]),
  };
}

// Sort alleles so dominant (uppercase-starting) come first, then alphabetical
// within case. Gives "D/nd1" rather than "nd1/D", "A/a" rather than "a/A".
function sortAllelesCanonical(alleles) {
  return [...alleles].sort((a, b) => {
    const aIsUpper = a[0] === a[0].toUpperCase();
    const bIsUpper = b[0] === b[0].toUpperCase();
    if (aIsUpper !== bIsUpper) return aIsUpper ? -1 : 1;
    return a.localeCompare(b);
  });
}

function renderLocusBreakdown(locus, breakdown) {
  const panel = document.createElement('div');
  panel.className = 'locus-breakdown';

  const heading = document.createElement('div');
  heading.className   = 'locus-breakdown-heading';
  heading.textContent = locus;
  panel.appendChild(heading);

  const summary = document.createElement('div');
  summary.className = 'locus-breakdown-summary';
  const homo = document.createElement('span');
  homo.innerHTML = `Homozygous: <strong>${formatProbability(breakdown.homozygous)}</strong>`;
  const het = document.createElement('span');
  het.innerHTML = `Heterozygous: <strong>${formatProbability(breakdown.heterozygous)}</strong>`;
  summary.append(homo, document.createTextNode(' · '), het);
  panel.appendChild(summary);

  const list = document.createElement('ul');
  list.className = 'locus-breakdown-list';
  for (const [key, prob] of breakdown.perGenotype) {
    const li = document.createElement('li');
    const geno = document.createElement('span');
    geno.className   = 'locus-breakdown-genotype';
    geno.textContent = key;
    const probEl = document.createElement('span');
    probEl.className   = 'locus-breakdown-prob';
    probEl.textContent = formatProbability(prob);
    li.append(geno, probEl);
    list.appendChild(li);
  }
  panel.appendChild(list);

  return panel;
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

// Returns display names of rows where the result was "? / ?".
// Uses the DOM display name (e.g., "KIT", "Champagne") so the disclaimer matches
// what the user saw in-game rather than internal locus keys.
function untestedRowNames(rows) {
  if (!rows) return [];
  return rows
    .filter(r => {
      const parts = r.result.trim().split(' / ');
      return parts[0] === '?' && parts[1] === '?';
    })
    .map(r => r.name.trim());
}