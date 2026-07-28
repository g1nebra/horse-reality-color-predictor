// Pure data module, no DOM, no rendering.
// All pairing CRUD + chrome.storage.local persistence.
// Pairing shape:
//   { id: string, name: string, dam: Horse|null, sire: Horse|null, folderId?: string|null }
//   folderId: id of the folder the pairing belongs to; null/absent = Unassigned.
// Folder shape:
//   { id: string, name: string }
// Horse shape:
//   { name, breed, url, photoUrl, rows, genotype, tested,
//     partiallyTested, hiddenGeneToggles, variationMarkers }
//   variationMarkers: { [coatVariationKey]: 'expresses' | 'line' | 'none' }
//   User-declared. For inherited variations these raise/lower the displayed
//   chance; for random ones they are tracking only. Never affects the genotype.

const STORAGE_KEY = 'pairings';
const FOLDERS_KEY = 'folders';
const MAX_FOLDER_NAME = 30;

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
 * @param {Array} pairings
 * @returns {Promise<void>}
 */
export function savePairings(pairings) {
  const sanitized = pairings;
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: sanitized }, () => {
      if (chrome.runtime.lastError) {
        console.error('[HR Color Predictor] savePairings failed:', chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * @returns {Promise<Array>} folders, or [] when none stored.
 */
export function loadFolders() {
  return new Promise(resolve => {
    chrome.storage.local.get(FOLDERS_KEY, result => {
      resolve(result[FOLDERS_KEY] ?? []);
    });
  });
}

/**
 * @param {Array} folders
 * @returns {Promise<void>}
 */
export function saveFolders(folders) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [FOLDERS_KEY]: folders }, () => {
      if (chrome.runtime.lastError) {
        console.error('[HR Color Predictor] saveFolders failed:', chrome.runtime.lastError.message);
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
 * Merge user-declared coat-variation markers onto a horse inside a pairing.
 * Independent of genetics. Drives the "chance of" level for inherited variations
 * (peacock, varnished out spotted blanket, necklace) and tracking for random ones.
 *
 * A horse only shows one underlying pattern, so it can EXPRESS at most one
 * variation. If this update sets one to 'expresses', any other variation already
 * 'expresses' is dropped to 'line' (it can still be in the family line).
 *
 * @param {Object}        pairing
 * @param {'dam'|'sire'}  role
 * @param {Object}        markers  { [variationKey]: 'expresses'|'line'|'none' }
 * @returns {Object}  New pairing object
 */
export function updateVariationMarkers(pairing, role, markers) {
  const horse = pairing[role];
  if (!horse) return pairing;

  const merged = { ...(horse.variationMarkers ?? {}), ...markers };

  const nowExpressing = Object.keys(markers).find(k => markers[k] === 'expresses');
  if (nowExpressing) {
    for (const key of Object.keys(merged)) {
      if (key !== nowExpressing && merged[key] === 'expresses') merged[key] = 'line';
    }
  }

  return { ...pairing, [role]: { ...horse, variationMarkers: merged } };
}

// Folders

/**
 * Add a new folder. Returns a new folders array.
 *
 * @param {Array}  folders
 * @param {string} name
 * @returns {Array}
 */
export function createFolder(folders, name) {
  const trimmed = ((name ?? '').trim() || `Folder ${folders.length + 1}`).slice(0, MAX_FOLDER_NAME);
  const id = `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return [...folders, { id, name: trimmed }];
}

/**
 * Rename a folder. Empty names are ignored (keeps the old name).
 *
 * @param {Array}  folders
 * @param {string} id
 * @param {string} name
 * @returns {Array}
 */
export function renameFolder(folders, id, name) {
  const trimmed = (name ?? '').trim().slice(0, MAX_FOLDER_NAME);
  return folders.map(f => (f.id === id ? { ...f, name: trimmed || f.name } : f));
}

/**
 * Remove a folder from the list. Does NOT touch pairings; the caller should
 * reassign that folder's pairings to Unassigned first (assignPairingsToFolder).
 *
 * @param {Array}  folders
 * @param {string} id
 * @returns {Array}
 */
export function deleteFolder(folders, id) {
  return folders.filter(f => f.id !== id);
}

/**
 * Set folderId on the given pairings (by id). folderId null = Unassigned.
 *
 * @param {Array}        pairings
 * @param {string[]}     ids
 * @param {string|null}  folderId
 * @returns {Array}  New pairings array.
 */
export function assignPairingsToFolder(pairings, ids, folderId) {
  const idSet = new Set(ids);
  return pairings.map(p => (idSet.has(p.id) ? { ...p, folderId: folderId ?? null } : p));
}

/**
 * Group pairings by folder for rendering. A pairing whose folderId is null,
 * missing, or points to a folder that no longer exists counts as Unassigned.
 *
 * @param {Array} pairings
 * @param {Array} folders
 * @returns {{ folderId: string|null, name: string, pairings: Array }[]}
 *   Folder sections in `folders` order, followed by an Unassigned section.
 */
export function groupPairingsByFolder(pairings, folders) {
  const known = new Set(folders.map(f => f.id));
  const sections = folders.map(f => ({
    folderId: f.id,
    name: f.name,
    pairings: pairings.filter(p => p.folderId === f.id),
  }));
  const unassigned = pairings.filter(p => !p.folderId || !known.has(p.folderId));
  sections.push({ folderId: null, name: 'Unassigned', pairings: unassigned });
  return sections;
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