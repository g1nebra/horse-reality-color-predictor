// Pure data module, no DOM, no rendering.
// All pairing CRUD + chrome.storage.sync persistence.
// Pairing shape:
//   { id: string, name: string, dam: Horse|null, sire: Horse|null }
// Horse shape:
//   { name, breed, url, photoUrl, rows, genotype, tested,
//     partiallyTested, hiddenGeneToggles }

const STORAGE_KEY = 'pairings';

// Storage

/**
 * @returns {Promise<Array>}
 */
export function loadPairings() {
  return new Promise(resolve => {
    chrome.storage.local.get(STORAGE_KEY, result => {
      resolve(result[STORAGE_KEY] ?? []);
    });
  });
}

/**
 * Strip large photo layer arrays before persisting, keeps only photoUrl
 * (single URL) to stay well within chrome.storage.local limits.
 *
 * @param {Object|null} horse
 * @returns {Object|null}
 */
function sanitizeHorse(horse) {
  if (!horse) return null;
  const { photoLayers, ...rest } = horse;
  return rest;
}

/**
 * @param {Array} pairings
 * @returns {Promise<void>}
 */
export function savePairings(pairings) {
  const sanitized = pairings.map(p => ({
    ...p,
    dam:  sanitizeHorse(p.dam),
    sire: sanitizeHorse(p.sire),
  }));
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: sanitized }, () => {
      if (chrome.runtime.lastError) {
        console.error('[HR Genetics] savePairings failed:', chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// Pairing construction

/**
 * Create a brand new pairing with one slot filled.
 *
 * @param {Object} horse
 * @param {'dam'|'sire'} role
 * @param {number} [index]  Used to derive default name
 * @returns {Object}
 */
export function createPairing(horse, role, index = 1) {
  return {
    id:   `pairing-${Date.now()}`,
    name: `Pairing ${index}`,
    dam:  role === 'dam'  ? horse : null,
    sire: role === 'sire' ? horse : null,
  };
}

/**
 * Fill an empty slot in an existing pairing.
 * Returns a new pairing object (immutable update).
 *
 * @param {Object} pairing
 * @param {Object} horse
 * @param {'dam'|'sire'} role
 * @returns {Object}
 */
export function addToPairing(pairing, horse, role) {
  return { ...pairing, [role]: horse };
}

/**
 * Replace a slot (Update flow, horse re-read from page).
 * Same shape as addToPairing but semantically distinct.
 *
 * @param {Object} pairing
 * @param {'dam'|'sire'} role
 * @param {Object} horse
 * @returns {Object}
 */
export function updateHorseInPairing(pairing, role, horse) {
  return { ...pairing, [role]: horse };
}

/**
 * Clear one slot without touching the other.
 *
 * @param {Object} pairing
 * @param {'dam'|'sire'} role
 * @returns {Object}
 */
export function clearSlot(pairing, role) {
  return { ...pairing, [role]: null };
}

/**
 * Deep-clone a pairing with a fresh id and an incremented copy suffix.
 * Existing copies of the same base are counted so the new copy gets a
 * unique suffix: "(copy)", "(copy 2)", "(copy 3)", …
 *
 * @param {Object}   pairing
 * @param {Object[]} [existingPairings=[]]  Full pairing list, used to count copies.
 * @returns {Object}
 */
export function duplicatePairing(pairing, existingPairings = []) {
  // Strip any existing copy suffix to get the base name
  const baseName  = pairing.name.replace(/ \(copy(?: \d+)?\)$/, '');
  const copyRegex = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(copy(?: \\d+)?\\)$`);
  const copyCount = existingPairings.filter(p => p.id !== pairing.id && copyRegex.test(p.name)).length;
  const suffix    = copyCount === 0 ? '(copy)' : `(copy ${copyCount + 1})`;
  return {
    ...JSON.parse(JSON.stringify(pairing)),
    id:   `pairing-${Date.now()}`,
    name: `${baseName} ${suffix}`,
  };
}

/**
 * Rename a pairing.
 *
 * @param {Object} pairing
 * @param {string} newName
 * @returns {Object}
 */
export function renamePairing(pairing, newName) {
  const trimmed = newName.trim();
  return { ...pairing, name: trimmed || pairing.name };
}

// Queries

/**
 * Find a pairing that already contains a horse with the given URL.
 * Used to detect the Update flow when the user revisits a horse's page.
 *
 * @param {Array}  pairings
 * @param {string} url
 * @returns {{ pairing: Object, role: 'dam'|'sire' } | null}
 */
export function findExistingPairing(pairings, url) {
  for (const pairing of pairings) {
    if (pairing.dam?.url  === url) return { pairing, role: 'dam' };
    if (pairing.sire?.url === url) return { pairing, role: 'sire' };
  }
  return null;
}

/**
 * Return pairings that have an empty slot matching `role` AND whose
 * filled slot is the same breed as `breed`.
 * Used to populate the "Add to existing pairing" list in the pick prompt.
 *
 * @param {Array}         pairings
 * @param {string}        breed
 * @param {'dam'|'sire'}  role
 * @returns {Array}
 */
export function getOpenSlotPairings(pairings, breed, role) {
  const opposite = role === 'dam' ? 'sire' : 'dam';
  return pairings.filter(p => {
    // Slot we want to fill must be empty
    if (p[role] !== null) return false;
    // The other slot must either be empty OR be the same breed
    const other = p[opposite];
    return other === null || other.breed === breed;
  });
}

/**
 * Merge updated hiddenGeneToggles back onto a horse object inside a pairing.
 *
 * @param {Object}        pairing
 * @param {'dam'|'sire'}  role
 * @param {Object}        toggles
 * @returns {Object}  New pairing object
 */
export function updateToggles(pairing, role, toggles) {
  const horse = pairing[role];
  if (!horse) return pairing;
  return { ...pairing, [role]: { ...horse, hiddenGeneToggles: toggles } };
}

/**
 * Replace a pairing in the list by id.
 *
 * @param {Array}  pairings
 * @param {Object} updated
 * @returns {Array}
 */
export function replacePairing(pairings, updated) {
  return pairings.map(p => p.id === updated.id ? updated : p);
}

/**
 * Remove a pairing from the list by id.
 *
 * @param {Array}  pairings
 * @param {string} id
 * @returns {Array}
 */
export function removePairing(pairings, id) {
  return pairings.filter(p => p.id !== id);
}

/**
 * Returns true when both slots are filled (pairing is complete).
 *
 * @param {Object} pairing
 * @returns {boolean}
 */
export function isComplete(pairing) {
  return pairing.dam !== null && pairing.sire !== null;
}