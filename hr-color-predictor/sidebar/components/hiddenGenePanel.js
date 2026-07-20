
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
 //   renderHiddenGenePanel(horse, onUpdate, onMarkerUpdate) → <div> | null
 //
 //   onUpdate(newToggles), called when the user changes any dropdown.
 //   newToggles shape: { A: ['A+', 'a'], f: ['F', 'f'], STY: ['n', 'n'], ... }
 //
 //   onMarkerUpdate(markers), called when the user changes a special coat variation
 //   marker. markers shape: { peacock: 'expresses' | 'line' | 'none' }.
 //   Never feeds into the genotype; for inherited variations it raises/lowers the
 //   chance level shown on foal outcomes, for random ones it is tracking only.

import genesMapping    from '../../data/genesMapping.js';
import hiddenModifiers from '../../data/hiddenModifiers.js';
import coatVariations  from '../../data/coatVariations.js';
import { parseGenotype }   from '../../engine/genotypeParser.js';
import { resolvePhenotype } from '../../engine/phenotypeResolver.js';

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

// Inherited coat variations this breed can carry, as [key, config] pairs. Random
// variations (e.g. snowflake) get no marker: the parents cannot affect them.
function variationsForBreed(breed) {
  return Object.entries(coatVariations)
    .filter(([, v]) => v.inheritance === 'inherited' && v.breeds.includes(breed));
}

// Marker options for an inherited variation. Both 'expresses' and 'line' raise the
// displayed chance (the hidden numeric value is bred up by breeding horses that
// show the variation, or that have it in their family line).
const INHERITED_MARKER_OPTIONS = [
  { value: 'none',      label: 'No' },
  { value: 'line',      label: 'In their line' },
  { value: 'expresses', label: 'Yes, expresses it' },
];

// Main export

/**
 * @param {Object}   horse           Horse object with .breed, .genotype, .hiddenGeneToggles
 * @param {Function} onUpdate        Called with updated hiddenGeneToggles when any toggle changes
 * @param {Function} [onMarkerUpdate]  Called with { [variationKey]: state } when a marker changes
 * @returns {HTMLElement | null}  null if there is nothing to show for this breed
 */
export function renderHiddenGenePanel(horse, onUpdate, onMarkerUpdate) {
  hideTooltip(); // clear any stray tooltip left over from a previous render
  const ambiguousRows = findAmbiguousSlots(horse);
  const modifierLoci  = modifierLociForBreed(horse.breed);
  const fixedLoci     = fixedModifierLociForBreed(horse.breed);
  const variations    = typeof onMarkerUpdate === 'function'
    ? variationsForBreed(horse.breed)
    : [];

  if (ambiguousRows.length === 0 && modifierLoci.length === 0
      && fixedLoci.length === 0 && variations.length === 0) return null;

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

  if (variations.length > 0) {
    const expressible = expressibleVariations(horse);
    container.appendChild(renderVariationHeading());
    for (const [key, config] of variations) {
      container.appendChild(
        renderVariationMarkerRow(horse, key, config, onMarkerUpdate, expressible.has(key)),
      );
    }
  }

  return container;
}

// Variations the horse's own coat lets it EXPRESS: peacock needs a Leopard,
// varnished out spotted blanket needs a PATN2 blanket, etc. Uses the effective
// genotype (test result + the user's hidden toggles), same as the results panel.
function expressibleVariations(horse) {
  if (!horse.rows) return new Set();
  const { genotype } = parseGenotype(horse.rows, horse.breed, horse.hiddenGeneToggles ?? {});
  return new Set(resolvePhenotype(genotype, horse.breed).variations);
}

function renderVariationHeading() {
  const heading = document.createElement('div');
  heading.className = 'variation-marker-heading';

  const label = document.createElement('span');
  label.textContent = 'Special coat variations';
  heading.appendChild(label);

  const info = document.createElement('span');
  info.className   = 'variation-marker-info';
  info.textContent = 'ⓘ';
  attachTooltip(info,
    'Coat-aware: "Yes, expresses it" only appears when this horse\'s own coat can '
    + 'show the variation (a Leopard for peacock, a PATN2 blanket for varnished out '
    + 'spotted blanket). You can always mark it as being in the family line.');
  heading.appendChild(info);

  return heading;
}

// Lightweight tooltip rendered in a fixed layer on <body>, so it is never clipped
// by the panel's overflow or the sidebar edge (native `title` tooltips get hidden
// inside the sidebar iframe).
function hideTooltip() {
  document.querySelectorAll('.hr-tooltip').forEach(t => t.remove());
}

function attachTooltip(el, message) {
  const show = () => {
    hideTooltip();
    const tip = document.createElement('div');
    tip.className   = 'hr-tooltip';
    tip.textContent = message;
    document.body.appendChild(tip);

    const r = el.getBoundingClientRect();
    const m = 6;
    let left = Math.min(r.left, window.innerWidth - tip.offsetWidth - m);
    left = Math.max(m, left);
    let top = r.bottom + m;
    if (top + tip.offsetHeight + m > window.innerHeight) {
      top = Math.max(m, r.top - tip.offsetHeight - m);
    }
    tip.style.left = `${left}px`;
    tip.style.top  = `${top}px`;
  };

  el.addEventListener('mouseenter', show);
  el.addEventListener('mouseleave', hideTooltip);
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (document.querySelector('.hr-tooltip')) hideTooltip();
    else show();
  });
}

// User-declared marker for an inherited coat variation. 3-state select: marking a
// parent as expressing the variation, or having it in their family line, raises
// the chance shown for foals. "Expresses it" is only offered when the horse's own
// coat can show it (canExpress); otherwise only "No" / "In their line" are given.
function renderVariationMarkerRow(horse, key, config, onMarkerUpdate, canExpress) {
  const stored  = horse.variationMarkers?.[key] ?? 'none';
  const current = (stored === 'expresses' && !canExpress) ? 'line' : stored;

  const row = document.createElement('div');
  row.className = 'hidden-gene-row hidden-gene-row-variation';

  const nameEl = document.createElement('div');
  nameEl.className   = 'hidden-gene-name variation-marker-name';
  nameEl.textContent = config.label;
  nameEl.title       = config.note;
  row.appendChild(nameEl);

  const slotWrapper = document.createElement('div');
  slotWrapper.className = 'hidden-gene-slot';

  const sel = document.createElement('select');
  sel.title = canExpress
    ? `Does this horse show ${config.label}, or have it in their family line?`
    : `This horse's coat cannot show ${config.label}. You can still mark it as being in the family line.`;

  const options = canExpress
    ? INHERITED_MARKER_OPTIONS
    : INHERITED_MARKER_OPTIONS.filter(opt => opt.value !== 'expresses');

  for (const opt of options) {
    const o = document.createElement('option');
    o.value       = opt.value;
    o.textContent = opt.label;
    if (opt.value === current) o.selected = true;
    sel.appendChild(o);
  }

  sel.addEventListener('change', () => onMarkerUpdate({ [key]: sel.value }));
  slotWrapper.appendChild(sel);

  row.appendChild(slotWrapper);
  return row;
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
      onUpdate({ [locusKey]: [...resolvedPair] });
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
    onUpdate({ [key]: [...chosen] });
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
