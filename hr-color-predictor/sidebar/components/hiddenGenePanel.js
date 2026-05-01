
 // Renders per-horse hidden gene toggles.
 // Two kinds of controls:
 //   1. Agouti ambiguity (per slot). A raw "A" result could be A (Bay), A+ (Wild
 //      Bay), or At (Seal Brown). Each ambiguous slot gets its own dropdown
 //      constrained by the breed's hidden list.
 //   2. Hidden modifier loci (whole pair). Flaxen, Sooty, Pangaré never appear
 //      in test results. Each gene in the breed's hidden list that's defined in
 //      hiddenModifiers gets a single tri-state dropdown (n/n, X/n, X/X).
 //
 // Export:
 //   renderHiddenGenePanel(horse, onUpdate) → <div> | null
 //
 //   onUpdate(newToggles), called when the user changes any dropdown.
 //   newToggles shape: { A: ['A+', 'a'], f: ['F', 'f'], STY: ['n', 'n'], ... }

import genesMapping    from '../../data/genesMapping.js';
import hiddenModifiers from '../../data/hiddenModifiers.js';

// Per-slot ambiguous alleles. The raw DOM token is the key, the full set of
// resolutions is the value. Only alleles present in the breed's hidden list
// are offered, always including the raw token itself.
const AMBIGUOUS_ALLELES = {
  A: ['A', 'A+', 'At'],
};

// Return the A/A+/At choices valid for the breed for a given ambiguous slot.
function choicesForBreed(rawAllele, breed) {
  const all = AMBIGUOUS_ALLELES[rawAllele];
  if (!all) return [rawAllele];
  const breedData = genesMapping[breed];
  if (!breedData) return all; // unknown breed, show all options
  const breedHidden = new Set(breedData.hidden ?? []);
  return all.filter(choice => choice === rawAllele || breedHidden.has(choice));
}

// Return toggleable modifier loci for this breed, filtering out any fixed at breed level.
// Some hidden modifiers are classified under the breed's `whites` list (reference HTML
// keeps HR-custom hidden whites in that column); we accept either source.
function modifierLociForBreed(breed) {
  const breedData = genesMapping[breed];
  if (!breedData) return [];
  const breedHidden = new Set(breedData.hidden ?? []);
  const breedWhites = new Set(breedData.whites ?? []);
  const fixedLoci   = new Set(Object.keys(breedData.fixed ?? {}));
  return Object.entries(hiddenModifiers)
    .filter(([key]) => (breedHidden.has(key) || breedWhites.has(key)) && !fixedLoci.has(key))
    .map(([key, config]) => ({ key, ...config }));
}

// Return modifier loci that are fixed for this breed (shown as read-only disclaimer rows).
function fixedModifierLociForBreed(breed) {
  const breedData = genesMapping[breed];
  if (!breedData?.fixed) return [];
  return Object.entries(breedData.fixed)
    .filter(([key]) => key in hiddenModifiers)
    .map(([key, alleles]) => ({ key, alleles, ...hiddenModifiers[key] }));
}

// Main export

/**
 * @param {Object}   horse      Horse object with .breed, .genotype, .hiddenGeneToggles
 * @param {Function} onUpdate   Called with updated hiddenGeneToggles when any toggle changes
 * @returns {HTMLElement | null}  null if no Agouti ambiguity AND no modifier loci for this breed
 */
export function renderHiddenGenePanel(horse, onUpdate) {
  const ambiguousRows = findAmbiguousSlots(horse);
  const modifierLoci  = modifierLociForBreed(horse.breed);
  const fixedLoci     = fixedModifierLociForBreed(horse.breed);

  if (ambiguousRows.length === 0 && modifierLoci.length === 0 && fixedLoci.length === 0) return null;

  const container = document.createElement('div');
  container.className = 'hidden-gene-panel';

  for (const { locusKey, slots } of ambiguousRows) {
    container.appendChild(renderAgoutiRow(horse, locusKey, slots, onUpdate));
  }

  for (const modifier of modifierLoci) {
    container.appendChild(renderModifierRow(horse, modifier, onUpdate));
  }

  for (const fixed of fixedLoci) {
    container.appendChild(renderFixedRow(fixed));
  }

  return container;
}

function renderFixedRow({ label, alleles }) {
  const row = document.createElement('div');
  row.className = 'hidden-gene-row hidden-gene-row-fixed';

  const nameEl = document.createElement('div');
  nameEl.className   = 'hidden-gene-name';
  nameEl.textContent = label;
  row.appendChild(nameEl);

  const note = document.createElement('div');
  note.className   = 'hidden-gene-fixed-note';
  note.textContent = `${alleles[0]}/${alleles[1]} · fixed for this breed`;
  row.appendChild(note);

  return row;
}

// Agouti per-slot row

function renderAgoutiRow(horse, locusKey, slots, onUpdate) {
  const row = document.createElement('div');
  row.className = 'hidden-gene-row';

  const nameEl = document.createElement('div');
  nameEl.className   = 'hidden-gene-name';
  nameEl.textContent = locusKeyLabel(locusKey);
  row.appendChild(nameEl);

  const currentPair  = horse.hiddenGeneToggles[locusKey] ?? horse.genotype[locusKey] ?? ['?', '?'];
  const resolvedPair = [...currentPair];

  for (const slotIndex of slots) {
    const rawAllele  = horse.genotype[locusKey]?.[slotIndex] ?? '?';
    const choices    = choicesForBreed(rawAllele, horse.breed);
    const currentVal = resolvedPair[slotIndex];

    const slotWrapper = document.createElement('div');
    slotWrapper.className = 'hidden-gene-slot';

    const lbl = document.createElement('label');
    lbl.className   = 'hidden-gene-slot';
    lbl.textContent = slotIndex === 0 ? '①' : '②';

    const sel = document.createElement('select');
    sel.title = `Allele ${slotIndex + 1} of ${locusKeyLabel(locusKey)}`;

    for (const choice of choices) {
      const opt = document.createElement('option');
      opt.value       = choice;
      opt.textContent = choice;
      if (choice === currentVal) opt.selected = true;
      sel.appendChild(opt);
    }

    sel.addEventListener('change', () => {
      resolvedPair[slotIndex] = sel.value;
      onUpdate({
        ...horse.hiddenGeneToggles,
        [locusKey]: [...resolvedPair],
      });
    });

    slotWrapper.append(lbl, sel);
    row.appendChild(slotWrapper);
  }

  return row;
}

// Hidden modifier whole-pair row

function renderModifierRow(horse, modifier, onUpdate) {
  const { key, label, options, default: defaultPair } = modifier;

  const row = document.createElement('div');
  row.className = 'hidden-gene-row';

  const nameEl = document.createElement('div');
  nameEl.className   = 'hidden-gene-name';
  nameEl.textContent = label;
  row.appendChild(nameEl);

  const slotWrapper = document.createElement('div');
  slotWrapper.className = 'hidden-gene-slot';

  const sel = document.createElement('select');
  sel.title = label;

  const currentPair = horse.hiddenGeneToggles[key] ?? horse.genotype[key] ?? defaultPair;
  const currentKey  = pairKey(currentPair);

  for (const pair of options) {
    const opt = document.createElement('option');
    opt.value       = pairKey(pair);
    opt.textContent = `${pair[0]}/${pair[1]}`;
    if (pairKey(pair) === currentKey) opt.selected = true;
    sel.appendChild(opt);
  }

  sel.addEventListener('change', () => {
    const chosen = options.find(p => pairKey(p) === sel.value) ?? defaultPair;
    onUpdate({
      ...horse.hiddenGeneToggles,
      [key]: [...chosen],
    });
  });

  slotWrapper.appendChild(sel);
  row.appendChild(slotWrapper);

  return row;
}

function pairKey(pair) {
  return `${pair[0]}/${pair[1]}`;
}

// Find ambiguous slots in a horse's genotype

/**
 * Scans horse.genotype for alleles that are in AMBIGUOUS_ALLELES.
 *
 * @param {Object} horse
 * @returns {Array<{ locusKey: string, slots: number[] }>}
 */
function findAmbiguousSlots(horse) {
  const result = [];

  for (const [locusKey, alleles] of Object.entries(horse.genotype ?? {})) {
    const ambiguousSlots = alleles
      .map((allele, idx) => (allele in AMBIGUOUS_ALLELES ? idx : -1))
      .filter(idx => idx !== -1);

    if (ambiguousSlots.length > 0) {
      result.push({ locusKey, slots: ambiguousSlots });
    }
  }

  return result;
}

// Label helper

const LOCUS_LABELS = {
  A: 'Agouti',
};

function locusKeyLabel(key) {
  return LOCUS_LABELS[key] ?? key;
}
