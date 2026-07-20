// Main controller for the HR Genetics sidebar panel.
// Owns all application state, handles chrome.runtime messages,
// and wires together all component renderers.
// 
// State:
//   pairings       – Pairing[]  (in-memory mirror of chrome.storage.sync)
//   currentView    – 'list' | 'results'
//   activePairingId – string | null
//   pendingPick    – { horse, role } | null  (waiting for modal decision)
 
import { parseGenotype }   from '../engine/genotypeParser.js';
import { resolvePhenotype } from '../engine/phenotypeResolver.js';
import {
  loadPairings,
  savePairings,
  addToPairing,
  clearSlot,
  duplicatePairing,
  renamePairing,
  updateToggles,
  updateVariationMarkers,
  getOpenSlotPairings,
  replacePairing,
  removePairing,
  isComplete,
} from './components/pairingManager.js';
import { renderPairingCard, populatePickPrompt } from './components/horseSelector.js';
import { renderResults }       from './components/resultsPanel.js';
import { renderHiddenGenePanel } from './components/hiddenGenePanel.js';

// State

let pairings        = [];
let currentView     = 'list';
let activePairingId = null;
let pendingPick     = null; // { horse, role }
let initComplete    = false;
let bufferedPickMsg = null; // holds HR_PICK_HORSE that arrived before init finished

// DOM refs

const viewList           = document.getElementById('view-list');
const viewResults        = document.getElementById('view-results');
const modalOverlay       = document.getElementById('modal-overlay');
const pairingListEl      = document.getElementById('pairing-list');
const emptyStateEl       = document.getElementById('empty-state');
const resultsContentEl   = document.getElementById('results-content');
const hiddenGenesDamEl   = document.getElementById('hidden-genes-dam');
const hiddenGenesSireEl  = document.getElementById('hidden-genes-sire');
const hiddenGeneSectionEl= document.getElementById('hidden-gene-section');
const resultsPairingName = document.getElementById('results-pairing-name');
const modalHorseInfo     = document.getElementById('modal-horse-info');
const modalActions       = document.getElementById('modal-actions');

// Init, module scripts run after DOM is parsed, no need for DOMContentLoaded

(async function init() {
  pairings = await loadPairings();
  renderListView();
  bindStaticEvents();
  initComplete = true;
  if (bufferedPickMsg) {
    handlePickHorse(bufferedPickMsg);
    bufferedPickMsg = null;
  }
})();

function bindStaticEvents() {
  document.getElementById('btn-new-pairing').addEventListener('click', createEmptyPairing);
  document.getElementById('btn-back').addEventListener('click', showListView);
  document.getElementById('btn-cancel-pick').addEventListener('click', onCancelPick);
  document.getElementById('btn-close-panel').addEventListener('click', () => {
    window.parent.postMessage({ type: 'HR_CLOSE_PANEL' }, '*');
  });
}

// Message listener, receives HR_PICK_HORSE relayed by topbar.js via postMessage
// Buffer the message if it arrives before init() finishes loading pairings.

window.addEventListener('message', (e) => {
  if (e.data?.type === 'HR_PICK_HORSE') {
    if (!initComplete) {
      bufferedPickMsg = e.data;
    } else {
      handlePickHorse(e.data);
    }
  }
});

// Pick flow

function handlePickHorse(msg) {
  const { role, meta, rows, partiallyTested } = msg;

  const parsed = parseGenotype(rows, meta.breed);

  const horse = {
    name:              meta.name   || 'Unknown',
    breed:             meta.breed  || '',
    gender:            meta.gender || '',
    url:               meta.url    || '',
    photoUrl:          meta.photoUrl  ?? null,
    photoLayers:       meta.photoLayers ?? [],
    rows,
    genotype:          parsed.genotype,
    tested:            parsed.tested,
    partiallyTested:   parsed.partiallyTested || !!partiallyTested,
    hiddenGeneToggles: {},
    variationMarkers:  {},
  };

  // Always show the pick modal so the user can choose to create a new
  // pairing OR add to an existing one, even if the horse is already somewhere.
  pendingPick = { horse, role };
  const openPairings = getOpenSlotPairings(pairings, horse.breed, role);
  showPickModal(horse, role, openPairings);
}

function handleReuseHorse(horse, role) {
  pendingPick = { horse, role };
  const openPairings = getOpenSlotPairings(pairings, horse.breed, role);
  showPickModal(horse, role, openPairings);
}

// Pick modal

function showPickModal(horse, role, openPairings) {
  populatePickPrompt(horse, role, openPairings, modalHorseInfo, modalActions, {
    onCreateNew:   onPickCreateNew,
    onAddTo:       onPickAddTo,
  });
  modalOverlay.classList.remove('hidden');
}

function hidePickModal() {
  modalOverlay.classList.add('hidden');
  modalHorseInfo.innerHTML = '';
  modalActions.innerHTML   = '';
}

async function onPickCreateNew() {
  if (!pendingPick) return;
  const { horse, role } = pendingPick;

  const pairing = {
    id:   `pairing-${Date.now()}`,
    name: `Pairing ${pairings.length + 1}`,
    dam:  role === 'dam'  ? horse : null,
    sire: role === 'sire' ? horse : null,
  };

  pairings = [...pairings, pairing];
  await savePairings(pairings);

  pendingPick = null;
  hidePickModal();
  renderListView();
}

async function onPickAddTo(pairingId) {
  if (!pendingPick) return;
  const { horse, role } = pendingPick;

  const target = pairings.find(p => p.id === pairingId);
  if (!target) return;

  const updated = addToPairing(target, horse, role);
  pairings = replacePairing(pairings, updated);
  await savePairings(pairings);

  pendingPick = null;
  hidePickModal();
  renderListView();
}

function onCancelPick() {
  pendingPick = null;
  hidePickModal();
}

// Pairing card callbacks

function onPairingCardClick(pairingId) {
  const pairing = pairings.find(p => p.id === pairingId);
  if (!pairing || !isComplete(pairing)) return;
  renderResultsView(pairing);
}

async function onClearSlot(pairingId, role) {
  const pairing = pairings.find(p => p.id === pairingId);
  if (!pairing) return;

  const updated = clearSlot(pairing, role);
  pairings = replacePairing(pairings, updated);
  await savePairings(pairings);

  if (activePairingId === pairingId) {
    activePairingId = null;
  }
  renderListView();
}

async function onDeletePairing(pairingId) {
  pairings = removePairing(pairings, pairingId);
  await savePairings(pairings);

  if (activePairingId === pairingId) {
    activePairingId = null;
  }
  renderListView();
}

async function onDuplicatePairing(pairingId) {
  const pairing = pairings.find(p => p.id === pairingId);
  if (!pairing) return;

  const copy = duplicatePairing(pairing, pairings);
  pairings = [...pairings, copy];
  await savePairings(pairings);
  renderListView();
}

async function onRenamePairing(pairingId, newName) {
  const pairing = pairings.find(p => p.id === pairingId);
  if (!pairing) return;

  const updated = renamePairing(pairing, newName);
  pairings = replacePairing(pairings, updated);
  await savePairings(pairings);
  // No full re-render needed, the card already shows the new name inline
}

// Hidden gene toggle callback

async function onToggleUpdate(pairingId, role, toggles) {
  const pairing = pairings.find(p => p.id === pairingId);
  if (!pairing) return;

  const currentToggles = pairing[role]?.hiddenGeneToggles ?? {};
  let updated = updateToggles(pairing, role, { ...currentToggles, ...toggles });

  // A toggle change can change the horse's coat, which may invalidate an
  // "expresses" marker (e.g. it is no longer a Leopard). Downgrade those to line.
  const demotions = staleExpressMarkers(updated[role]);
  if (demotions) updated = updateVariationMarkers(updated, role, demotions);

  pairings = replacePairing(pairings, updated);
  await savePairings(pairings);

  // Re-render the panel too: which marker options are offered depends on the coat.
  renderHiddenGenePanels(updated);
  renderResultsContent(updated);
}

// Return { [key]: 'line' } for any variation a horse is marked as expressing but
// can no longer show with its current coat, or null if there is nothing to fix.
function staleExpressMarkers(horse) {
  const markers = horse?.variationMarkers;
  if (!markers || !horse.rows) return null;

  const expressed = Object.keys(markers).filter(k => markers[k] === 'expresses');
  if (expressed.length === 0) return null;

  const { genotype } = parseGenotype(horse.rows, horse.breed, horse.hiddenGeneToggles ?? {});
  const eligible = new Set(resolvePhenotype(genotype, horse.breed).variations);

  const fixes = {};
  for (const k of expressed) if (!eligible.has(k)) fixes[k] = 'line';
  return Object.keys(fixes).length ? fixes : null;
}

// Coat-variation marker callback ("expresses it" / "in their line").
// For inherited variations this changes the chance level shown on foal outcomes,
// so re-render the results content. Random variations are unaffected but the
// re-render is harmless.

async function onMarkerUpdate(pairingId, role, markers) {
  const pairing = pairings.find(p => p.id === pairingId);
  if (!pairing) return;

  const updated = updateVariationMarkers(pairing, role, markers);
  pairings = replacePairing(pairings, updated);
  await savePairings(pairings);

  // Re-render the panels too: setting one variation to "expresses" can drop
  // another from "expresses" to "in their line", which the selects must reflect.
  renderHiddenGenePanels(updated);
  renderResultsContent(updated);
}

// New Pairing button (creates empty pairing)

async function createEmptyPairing() {
  const pairing = {
    id:   `pairing-${Date.now()}`,
    name: `Pairing ${pairings.length + 1}`,
    dam:  null,
    sire: null,
  };
  pairings = [...pairings, pairing];
  await savePairings(pairings);
  renderListView();
}

// View rendering

function renderListView() {
  currentView = 'list';
  viewList.classList.remove('hidden');
  viewResults.classList.add('hidden');

  pairingListEl.innerHTML = '';

  if (pairings.length === 0) {
    emptyStateEl.classList.remove('hidden');
  } else {
    emptyStateEl.classList.add('hidden');
    for (const pairing of pairings) {
      const card = renderPairingCard(pairing, {
        onSlotsClick: onPairingCardClick,
        onClearSlot,
        onDelete:      onDeletePairing,
        onDuplicate:   onDuplicatePairing,
        onRename:      onRenamePairing,
        onReuseHorse:  handleReuseHorse,
      });
      pairingListEl.appendChild(card);
    }
  }
}

function showListView() {
  activePairingId = null;
  renderListView();
}

function renderResultsView(pairing) {
  currentView     = 'results';
  activePairingId = pairing.id;

  viewList.classList.add('hidden');
  viewResults.classList.remove('hidden');

  resultsPairingName.textContent = pairing.name;

  renderHiddenGenePanels(pairing);
  renderResultsContent(pairing);
}

function renderHiddenGenePanels(pairing) {
  hiddenGenesDamEl.innerHTML  = '';
  hiddenGenesSireEl.innerHTML = '';

  let hasAnyPanel = false;

  if (pairing.dam) {
    const panel = renderHiddenGenePanel(
      pairing.dam,
      (toggles) => onToggleUpdate(pairing.id, 'dam', toggles),
      (markers) => onMarkerUpdate(pairing.id, 'dam', markers),
    );
    if (panel) {
      hasAnyPanel = true;
      const label = document.createElement('div');
      label.className   = 'hidden-gene-group-label';
      label.textContent = `Dam | ${pairing.dam.name}`;
      hiddenGenesDamEl.appendChild(label);
      hiddenGenesDamEl.appendChild(panel);
    }
  }

  if (pairing.sire) {
    const panel = renderHiddenGenePanel(
      pairing.sire,
      (toggles) => onToggleUpdate(pairing.id, 'sire', toggles),
      (markers) => onMarkerUpdate(pairing.id, 'sire', markers),
    );
    if (panel) {
      hasAnyPanel = true;
      const label = document.createElement('div');
      label.className   = 'hidden-gene-group-label';
      label.textContent = `Sire | ${pairing.sire.name}`;
      hiddenGenesSireEl.appendChild(label);
      hiddenGenesSireEl.appendChild(panel);
    }
  }

  hiddenGeneSectionEl.classList.toggle('hidden', !hasAnyPanel);
}

function renderResultsContent(pairing) {
  resultsContentEl.innerHTML = '';
  resultsContentEl.appendChild(renderResults(pairing));
}