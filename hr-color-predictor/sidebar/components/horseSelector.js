
 // DOM rendering module for horse/pairing UI.
 // Exports:
 //   renderPairingCard(pairing, callbacks) → <div class="pairing-card">
 //   populatePickPrompt(horse, role, openPairings, infoEl, actionsEl, callbacks)

import { isComplete } from './pairingManager.js';

// Pairing card

/**
 * Render a full pairing card (name header + two horse slots).
 *
 * @param {Object} pairing
 * @param {{
 *   onSlotsClick: (pairingId: string) => void,
 *   onClearSlot:  (pairingId: string, role: 'dam'|'sire') => void,
 *   onDelete:     (pairingId: string) => void,
 *   onDuplicate:  (pairingId: string) => void,
 *   onRename:     (pairingId: string, newName: string) => void,
 *   onReuseHorse: (horse: Object, role: 'dam'|'sire') => void,
 * }} callbacks
 * @returns {HTMLElement}
 */
export function renderPairingCard(pairing, callbacks) {
  const card = document.createElement('div');
  card.className = `pairing-card${isComplete(pairing) ? ' complete' : ''}`;
  card.dataset.pairingId = pairing.id;

  // Header
  const header = document.createElement('div');
  header.className = 'pairing-card-header';

  // Editable name
  const nameEl = document.createElement('span');
  nameEl.className   = 'pairing-card-name';
  nameEl.textContent = pairing.name;
  nameEl.title       = 'Click to rename';
  nameEl.addEventListener('click', (e) => {
    e.stopPropagation();
    startRename(nameEl, pairing, callbacks.onRename);
  });

  const actionsEl = document.createElement('div');
  actionsEl.className = 'pairing-card-actions';

  // Duplicate button with inline confirm
  const btnDuplicate = makeIconBtn('⊕', 'Duplicate pairing');
  addInlineConfirm(btnDuplicate, 'Copy?', 'Copy', () => callbacks.onDuplicate(pairing.id));

  // Delete button with inline confirm
  const btnDelete = makeIconBtn('×', 'Delete pairing');
  btnDelete.classList.add('btn-delete');
  addInlineConfirm(btnDelete, 'Delete?', '×', () => callbacks.onDelete(pairing.id));

  actionsEl.append(btnDuplicate, btnDelete);
  header.append(nameEl, actionsEl);

  // Slots
  const slotsEl = document.createElement('div');
  slotsEl.className = 'pairing-slots';

  slotsEl.appendChild(renderHorseSlot(pairing, 'dam',  callbacks));
  slotsEl.appendChild(renderHorseSlot(pairing, 'sire', callbacks));

  // Clicking the slots area opens results (complete pairings only)
  if (isComplete(pairing)) {
    slotsEl.addEventListener('click', () => callbacks.onSlotsClick(pairing.id));
  }

  card.append(header, slotsEl);
  return card;
}

// Inline confirm helper

/**
 * Add a two-step confirm interaction to a button.
 * First click shows confirmLabel; second click within 3 s triggers action.
 * Clicking anywhere else resets.
 *
 * @param {HTMLButtonElement} btn
 * @param {string}  confirmLabel  Text shown in pending state (e.g. "Delete?")
 * @param {string}  idleLabel     Text shown in idle state (e.g. "×")
 * @param {Function} action       Called on confirm
 */
function addInlineConfirm(btn, confirmLabel, idleLabel, action) {
  let pending = false;
  let timer   = null;

  function reset() {
    pending          = false;
    btn.textContent  = idleLabel;
    btn.dataset.confirm = '';
    clearTimeout(timer);
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pending) {
      action();
      reset();
    } else {
      pending             = true;
      btn.textContent     = confirmLabel;
      btn.dataset.confirm = 'pending';
      timer = setTimeout(reset, 3000);
    }
  });
}

// Inline rename helper

function startRename(nameEl, pairing, onRename) {
  const input = document.createElement('input');
  input.type      = 'text';
  input.value     = pairing.name;
  input.className = 'pairing-name-input';
  input.maxLength = 60;

  nameEl.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    const newName = input.value.trim() || pairing.name;
    input.replaceWith(nameEl);
    nameEl.textContent = newName;
    onRename(pairing.id, newName);
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { input.replaceWith(nameEl); }
  });
  input.addEventListener('blur', commit);
}

// Horse slot

/**
 * Render one horse slot (dam or sire side).
 *
 * @param {Object}         pairing
 * @param {'dam'|'sire'}   role
 * @param {Object}         callbacks
 * @returns {HTMLElement}
 */
function renderHorseSlot(pairing, role, callbacks) {
  const horse = pairing[role];

  const slot = document.createElement('div');
  slot.className = `horse-slot slot-${role}`;

  const label = document.createElement('div');
  label.className   = 'horse-slot-label';
  label.textContent = role === 'dam' ? 'DAM' : 'SIRE';
  slot.appendChild(label);

  if (!horse) {
    const empty = document.createElement('div');
    empty.className   = 'horse-slot-empty';
    empty.textContent = 'empty';
    slot.appendChild(empty);
    return slot;
  }

  // Clear slot button
  const btnClear = document.createElement('button');
  btnClear.className   = 'btn-clear-slot';
  btnClear.title       = `Remove ${role}`;
  btnClear.textContent = '×';
  btnClear.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onClearSlot(pairing.id, role);
  });
  slot.appendChild(btnClear);

  // Content row: photo + info
  const content = document.createElement('div');
  content.className = 'horse-slot-content';

  content.appendChild(renderHorsePhoto(horse));

  // Info
  const info = document.createElement('div');
  info.className = 'horse-info';

  const nameEl = document.createElement('div');
  nameEl.className   = 'horse-name';
  nameEl.textContent = horse.name || '(unnamed)';
  nameEl.title       = horse.name || '';

  const breedEl = document.createElement('div');
  breedEl.className   = 'horse-breed';
  breedEl.textContent = horse.breed;

  info.append(nameEl, breedEl);

  if (horse.partiallyTested) {
    const badge = document.createElement('div');
    badge.className   = 'badge-partial';
    badge.textContent = 'Partial';
    info.appendChild(badge);
  }

  // Reuse button
  const btnReuse = document.createElement('button');
  btnReuse.className   = 'btn-icon btn-reuse';
  btnReuse.title       = `Add ${horse.name} to another pairing`;
  btnReuse.textContent = '↗';
  btnReuse.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onReuseHorse(horse, role);
  });
  info.appendChild(btnReuse);

  content.appendChild(info);
  slot.appendChild(content);
  return slot;
}

// Photo renderer, stacks multiple PNG layers for a correct composite
function renderHorsePhoto(horse) {
  const layers = horse.photoLayers?.length ? horse.photoLayers
               : horse.photoUrl            ? [horse.photoUrl]
               : [];

  if (!layers.length) {
    const ph = document.createElement('div');
    ph.className   = 'horse-photo-placeholder';
    ph.textContent = '🐴';
    return ph;
  }

  const stack = document.createElement('div');
  stack.className = 'horse-photo-stack';

  for (const url of layers) {
    const img = document.createElement('img');
    img.src             = url;
    img.alt             = '';
    img.loading         = 'lazy';
    img.onerror         = () => { img.style.display = 'none'; };
    stack.appendChild(img);
  }

  // Fallback placeholder shown if ALL images fail
  const ph = document.createElement('div');
  ph.className        = 'horse-photo-placeholder horse-photo-fallback';
  ph.textContent      = '🐴';
  stack.appendChild(ph);

  return stack;
}

// Pick prompt modal content

/**
 * Populate the pick prompt modal with horse info and action buttons.
 *
 * @param {Object}         horse
 * @param {'dam'|'sire'}   role
 * @param {Object[]}       openPairings   Pairings with an open slot for this role+breed
 * @param {HTMLElement}    infoEl         #modal-horse-info container
 * @param {HTMLElement}    actionsEl      #modal-actions container
 * @param {{
 *   onCreateNew: () => void,
 *   onAddTo:     (pairingId: string) => void,
 * }} callbacks
 */
export function populatePickPrompt(horse, role, openPairings, infoEl, actionsEl, callbacks) {
  infoEl.innerHTML   = '';
  actionsEl.innerHTML = '';

  // Horse info
  const nameEl = document.createElement('div');
  nameEl.className   = 'modal-horse-name';
  nameEl.textContent = horse.name || '(unnamed)';

  const breedEl = document.createElement('div');
  breedEl.className   = 'modal-horse-breed';
  breedEl.textContent = horse.breed;

  const roleBadge = document.createElement('div');
  roleBadge.className   = `modal-role-badge role-${role}`;
  roleBadge.textContent = role === 'dam' ? 'Dam' : 'Sire';

  infoEl.append(nameEl, breedEl, roleBadge);

  // Create new pairing button
  const btnNew = document.createElement('button');
  btnNew.className   = 'btn-pick-action btn-create-new';
  btnNew.textContent = '+ Create new pairing';
  btnNew.addEventListener('click', callbacks.onCreateNew);
  actionsEl.appendChild(btnNew);

  // Add to existing pairing buttons
  for (const pairing of openPairings) {
    const btn = document.createElement('button');
    btn.className   = 'btn-pick-action';
    btn.textContent = `Add to: ${pairing.name}`;
    btn.addEventListener('click', () => callbacks.onAddTo(pairing.id));
    actionsEl.appendChild(btn);
  }
}

// Helpers
function makeIconBtn(symbol, title) {
  const btn = document.createElement('button');
  btn.type        = 'button';
  btn.className   = 'btn-icon';
  btn.title       = title;
  btn.textContent = symbol;
  return btn;
}
