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
  loadFolders,
  saveFolders,
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
  createFolder,
  renameFolder,
  deleteFolder,
  assignPairingsToFolder,
} from './components/pairingManager.js';
import { renderPairingCard, populatePickPrompt } from './components/horseSelector.js';
import { renderResults }       from './components/resultsPanel.js';
import { renderHiddenGenePanel } from './components/hiddenGenePanel.js';

// State

let pairings        = [];
let folders         = [];
let currentView     = 'list';
let activePairingId = null;
let pendingPick     = null; // { horse, role }
let initComplete    = false;
let bufferedPickMsg = null; // holds HR_PICK_HORSE that arrived before init finished

// Folder navigation + organize mode
let activeTab       = '__all__';   // '__all__' | '__unassigned__' | folderId
let organizing      = false;       // multi-select pairings to move into folders
let selectedIds     = new Set();
let newFolderMode   = false;

// DOM refs

const viewList           = document.getElementById('view-list');
const viewResults        = document.getElementById('view-results');
const modalOverlay       = document.getElementById('modal-overlay');
const pairingListEl      = document.getElementById('pairing-list');
const listToolbarEl      = document.getElementById('list-toolbar');
const listFooterEl       = document.getElementById('list-footer');
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
  [pairings, folders] = await Promise.all([loadPairings(), loadFolders()]);
  renderListView();
  bindStaticEvents();
  initComplete = true;
  if (bufferedPickMsg) {
    handlePickHorse(bufferedPickMsg);
    bufferedPickMsg = null;
  }
})();

function bindStaticEvents() {
  // "+ New Pairing" is rendered dynamically in the footer by renderListFooter.
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

  validateActiveTab();
  pairingListEl.innerHTML = '';

  // Completely empty: no tab bar, just the empty hint + New Pairing.
  if (pairings.length === 0 && folders.length === 0) {
    listToolbarEl.innerHTML = '';
    renderListFooter();
    emptyStateEl.classList.remove('hidden');
    return;
  }
  emptyStateEl.classList.add('hidden');

  renderFolderTabs();
  renderListFooter();

  const cardCallbacks = {
    onSlotsClick:  onPairingCardClick,
    onClearSlot,
    onDelete:      onDeletePairing,
    onDuplicate:   onDuplicatePairing,
    onRename:      onRenamePairing,
    onReuseHorse:  handleReuseHorse,
    organizing,
    onToggleSelect: toggleSelect,
  };

  const shown = pairingsForTab(activeTab);
  if (shown.length === 0) {
    const empty = document.createElement('div');
    empty.className   = 'folder-empty';
    empty.textContent = activeTab === '__all__'
      ? 'No pairings yet.'
      : 'This folder is empty. Use Organize to move pairings here.';
    pairingListEl.appendChild(empty);
    return;
  }
  for (const pairing of shown) {
    pairingListEl.appendChild(
      renderPairingCard(pairing, { ...cardCallbacks, isSelected: selectedIds.has(pairing.id) }),
    );
  }
}

// Pairings shown for a tab. Tab id: '__all__', '__unassigned__', or a folderId.
function pairingsForTab(tab) {
  if (tab === '__all__') return pairings;
  if (tab === '__unassigned__') {
    const known = new Set(folders.map(f => f.id));
    return pairings.filter(p => !p.folderId || !known.has(p.folderId));
  }
  return pairings.filter(p => p.folderId === tab);
}

// Fall back to ALL when the active tab no longer exists / is empty.
function validateActiveTab() {
  if (activeTab === '__all__') return;
  if (activeTab === '__unassigned__') {
    if (pairingsForTab('__unassigned__').length === 0) activeTab = '__all__';
    return;
  }
  if (!folders.some(f => f.id === activeTab)) activeTab = '__all__';
}

function setActiveTab(tab) {
  activeTab = tab;
  renderListView();
}

// Folder tab bar

function renderFolderTabs() {
  listToolbarEl.innerHTML = '';

  const left = document.createElement('button');
  left.type = 'button';
  left.className = 'folder-tab-arrow';
  left.textContent = '‹';

  const strip = document.createElement('div');
  strip.className = 'folder-tab-strip';

  const unassignedCount = pairingsForTab('__unassigned__').length;
  const tabs = [{ id: '__all__', kind: 'all', label: 'ALL', count: pairings.length }];
  for (const f of folders) {
    tabs.push({ id: f.id, kind: 'folder', label: f.name, count: pairingsForTab(f.id).length });
  }
  if (folders.length > 0 && unassignedCount > 0) {
    tabs.push({ id: '__unassigned__', kind: 'unassigned', label: 'Unassigned', count: unassignedCount });
  }
  for (const t of tabs) strip.appendChild(renderFolderTab(t));
  strip.appendChild(newFolderMode ? renderNewFolderTab() : renderNewFolderPlus());

  const right = document.createElement('button');
  right.type = 'button';
  right.className = 'folder-tab-arrow';
  right.textContent = '›';

  const updateArrows = () => {
    const max = strip.scrollWidth - strip.clientWidth;
    const overflow = max > 1;
    left.classList.toggle('hidden', !overflow);
    right.classList.toggle('hidden', !overflow);
    left.disabled  = strip.scrollLeft <= 1;
    right.disabled = strip.scrollLeft >= max - 1;
  };
  left.addEventListener('click',  () => strip.scrollBy({ left: -120, behavior: 'smooth' }));
  right.addEventListener('click', () => strip.scrollBy({ left:  120, behavior: 'smooth' }));
  strip.addEventListener('scroll', updateArrows);
  setTimeout(updateArrows, 0);

  listToolbarEl.append(left, strip, right);
}

function renderFolderTab(t) {
  const tab = document.createElement('div');
  tab.className = 'folder-tab' + (activeTab === t.id ? ' active' : '');

  const label = document.createElement('button');
  label.type = 'button';
  label.className = 'folder-tab-label';
  label.textContent = t.kind === 'all' ? 'ALL' : `${t.label}: ${t.count}`;
  label.addEventListener('click', () => setActiveTab(t.id));
  tab.appendChild(label);

  // Active real folder gets inline rename + delete (not during organize).
  if (t.kind === 'folder' && activeTab === t.id && !organizing) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'folder-tab-icon';
    edit.title = 'Rename folder';
    edit.textContent = '✎';
    edit.addEventListener('click', (e) => { e.stopPropagation(); startTabRename(tab, t); });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'folder-tab-icon';
    del.title = 'Delete folder (pairings move to Unassigned)';
    del.textContent = '🗑';
    addTabConfirm(del, () => onDeleteFolder(t.id));

    tab.append(edit, del);
  }
  return tab;
}

function renderNewFolderPlus() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'folder-tab-plus';
  btn.title = 'New folder';
  btn.textContent = '+';
  btn.addEventListener('click', () => { newFolderMode = true; renderListView(); });
  return btn;
}

function renderNewFolderTab() {
  const wrap = document.createElement('div');
  wrap.className = 'folder-tab folder-tab-new';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'folder-tab-input';
  input.placeholder = 'Folder name';
  input.maxLength = 30;

  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    const name = input.value.trim();
    newFolderMode = false;
    if (name) onCreateFolder(name);
    else renderListView();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  commit();
    if (e.key === 'Escape') { done = true; newFolderMode = false; renderListView(); }
  });
  input.addEventListener('blur', commit);

  wrap.appendChild(input);
  setTimeout(() => input.focus(), 0);
  return wrap;
}

// Two-click confirm on the tab delete icon.
function addTabConfirm(btn, action) {
  const idleTitle = btn.title;
  const idleText  = btn.textContent;
  let pending = false, timer = null;

  const reset = () => {
    clearTimeout(timer);
    pending = false;
    btn.classList.remove('confirming');
    btn.textContent = idleText;
    btn.title = idleTitle;
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pending) { reset(); action(); return; }
    pending = true;
    btn.classList.add('confirming');
    btn.textContent = 'Delete?';
    btn.title = 'Click again to confirm';
    timer = setTimeout(reset, 4000);
  });
}

function startTabRename(tab, t) {
  tab.innerHTML = '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'folder-tab-input';
  input.value = t.label;
  input.maxLength = 30;

  let done = false;
  const commit = () => { if (done) return; done = true; onRenameFolder(t.id, input.value); };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  commit();
    if (e.key === 'Escape') { done = true; renderListView(); }
  });
  input.addEventListener('blur', commit);

  tab.appendChild(input);
  input.focus();
  input.select();
}

// Footer: New Pairing / Organize, or the organize action bar.

function renderListFooter() {
  listFooterEl.innerHTML = '';

  if (organizing) {
    // Select all / Deselect all, scoped to the pairings shown in the current tab.
    const shown       = pairingsForTab(activeTab);
    const allSelected = shown.length > 0 && shown.every(p => selectedIds.has(p.id));

    const selectAll = document.createElement('button');
    selectAll.type      = 'button';
    selectAll.className  = 'btn-toolbar';
    selectAll.textContent = allSelected ? 'Deselect all' : 'Select all';
    selectAll.disabled   = shown.length === 0;
    selectAll.addEventListener('click', () => {
      if (allSelected) shown.forEach(p => selectedIds.delete(p.id));
      else             shown.forEach(p => selectedIds.add(p.id));
      renderListView();
    });
    listFooterEl.appendChild(selectAll);

    const info = document.createElement('span');
    info.className   = 'organize-info';
    info.textContent = selectedIds.size ? `${selectedIds.size} selected` : 'Select pairings';
    listFooterEl.appendChild(info);

    const select = document.createElement('select');
    select.className = 'organize-move-select';
    select.disabled  = selectedIds.size === 0;
    const ph = new Option('Move to…', '', true, true);
    ph.disabled = true;
    select.appendChild(ph);
    select.appendChild(new Option('Unassigned', '__unassigned__'));
    for (const f of folders) select.appendChild(new Option(f.name, f.id));
    select.addEventListener('change', () => {
      if (!select.value) return;
      onMoveSelected(select.value === '__unassigned__' ? null : select.value);
    });
    listFooterEl.appendChild(select);

    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'btn-toolbar btn-toolbar-ghost';
    done.textContent = 'Done';
    done.addEventListener('click', exitOrganize);
    listFooterEl.appendChild(done);
    return;
  }

  const newPairing = document.createElement('button');
  newPairing.type = 'button';
  newPairing.id = 'btn-new-pairing';
  newPairing.textContent = '+ New Pairing';
  newPairing.addEventListener('click', createEmptyPairing);
  listFooterEl.appendChild(newPairing);

  // Organize only makes sense once there is a folder to move into.
  if (folders.length > 0 && pairings.length > 0) {
    const organizeBtn = document.createElement('button');
    organizeBtn.type = 'button';
    organizeBtn.className = 'btn-toolbar';
    organizeBtn.textContent = 'Organize';
    organizeBtn.addEventListener('click', () => { organizing = true; selectedIds.clear(); renderListView(); });
    listFooterEl.appendChild(organizeBtn);
  }
}

function exitOrganize() {
  organizing = false;
  selectedIds.clear();
  renderListView();
}

function toggleSelect(pairingId) {
  if (selectedIds.has(pairingId)) selectedIds.delete(pairingId);
  else                            selectedIds.add(pairingId);
  renderListView();
}

// Folder handlers

async function onCreateFolder(name) {
  folders = createFolder(folders, name);
  await saveFolders(folders);
  activeTab = folders[folders.length - 1].id; // jump to the new folder's tab
  renderListView();
}

async function onRenameFolder(folderId, newName) {
  folders = renameFolder(folders, folderId, newName);
  await saveFolders(folders);
  renderListView();
}

async function onDeleteFolder(folderId) {
  // Reassign this folder's pairings to Unassigned, then drop the folder.
  const ids = pairings.filter(p => p.folderId === folderId).map(p => p.id);
  if (ids.length) {
    pairings = assignPairingsToFolder(pairings, ids, null);
    await savePairings(pairings);
  }
  folders = deleteFolder(folders, folderId);
  await saveFolders(folders);
  if (activeTab === folderId) activeTab = '__all__';
  renderListView();
}

async function onMoveSelected(folderId) {
  const ids = [...selectedIds];
  if (ids.length === 0) return;
  pairings = assignPairingsToFolder(pairings, ids, folderId);
  await savePairings(pairings);
  selectedIds.clear();            // keep organize mode open for further moves
  renderListView();
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