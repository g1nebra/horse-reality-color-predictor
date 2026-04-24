
 // Renders per-horse hidden gene toggle dropdowns.
 // In v1, this handles Agouti ambiguity only:
 //   Test result "A" is ambiguous, it could be A (Bay), A+ (Wild Bay), or At (Seal Brown).
 //   The user can disambiguate each ambiguous allele slot via a dropdown.
 //
 // Export:
 //   renderHiddenGenePanel(horse, onUpdate) → <div> | null
 //
 //   onUpdate(newToggles), called when the user changes a dropdown.
 //   newToggles shape: { A: ['A+', 'a'] }  (locusKey → resolved pair)

import genesMapping from '../../data/genesMapping.js';

// All possible ambiguous alleles per locus, filtered per breed before rendering.
// Each key is a raw DOM allele; value is the full set of what it could mean.
const AMBIGUOUS_ALLELES = {
  A: ['A', 'A+', 'At'],  // Agouti: raw "A" could be Bay, Wild Bay, or Seal Brown
};

// Return only the choices that are valid for the breed.
// Always keeps the base allele; adds hidden-gene variants only if in breed.hidden.
function choicesForBreed(rawAllele, breed) {
  const all = AMBIGUOUS_ALLELES[rawAllele];
  if (!all) return [rawAllele];
  const breedData = genesMapping[breed];
  if (!breedData) return all; // unknown breed, show all options
  const breedHidden = new Set(breedData.hidden ?? []);
  return all.filter(choice => choice === rawAllele || breedHidden.has(choice));
}

// Main export

/**
 * @param {Object}   horse      Horse object with .genotype and .hiddenGeneToggles
 * @param {Function} onUpdate   Called with updated hiddenGeneToggles when user changes a toggle
 * @returns {HTMLElement | null}  null if no ambiguous slots found
 */
export function renderHiddenGenePanel(horse, onUpdate) {
  const ambiguousRows = findAmbiguousSlots(horse);
  if (ambiguousRows.length === 0) return null;

  const container = document.createElement('div');
  container.className = 'hidden-gene-panel';

  for (const { locusKey, slots } of ambiguousRows) {
    const row = document.createElement('div');
    row.className = 'hidden-gene-row';

    const nameEl = document.createElement('div');
    nameEl.className   = 'hidden-gene-name';
    nameEl.textContent = locusKeyLabel(locusKey);
    row.appendChild(nameEl);

    // Current resolved pair (from toggles or raw genotype)
    const currentPair = horse.hiddenGeneToggles[locusKey] ?? horse.genotype[locusKey] ?? ['?', '?'];
    const resolvedPair = [...currentPair];

    for (const slotIndex of slots) {
      const rawAllele   = horse.genotype[locusKey]?.[slotIndex] ?? '?';
      const choices     = choicesForBreed(rawAllele, horse.breed);
      const currentVal  = resolvedPair[slotIndex];

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
        const newToggles = {
          ...horse.hiddenGeneToggles,
          [locusKey]: [...resolvedPair],
        };
        onUpdate(newToggles);
      });

      slotWrapper.append(lbl, sel);
      row.appendChild(slotWrapper);
    }

    container.appendChild(row);
  }

  return container;
}

// Find ambiguous slots in a horse's genotype

/**
 * Scans horse.genotype for alleles that are in AMBIGUOUS_ALLELES.
 *
 * @param {Object} horse
 * @returns {Array<{ locusKey: string, slots: number[] }>}
 *   e.g. [{ locusKey: 'A', slots: [0] }]   slot 0 tested as 'A'
 *        [{ locusKey: 'A', slots: [0, 1] }] both slots are 'A'
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