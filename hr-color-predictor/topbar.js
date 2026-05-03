// Injects the HR Genetics toggle button and manages the in-page sidebar iframe
// The panel is a fixed-position iframe loaded from the extension's sidebar.html,
// overlaid on the right side of the page.


const BTN_ID     = 'hr-genetics-toggle-btn';
const TOOLBAR_ID = 'hr-genetics-toolbar';
const PANEL_ID   = 'hr-genetics-panel';
const PANEL_URL  = chrome.runtime.getURL('sidebar/sidebar.html');
const POSITION_STORAGE_KEY = 'hr-toolbar-position';
const DEFAULT_POSITION = { top: 10, right: 10 };
const DRAG_THRESHOLD_PX = 5;

async function injectTopbarButton() {
  if (document.getElementById(TOOLBAR_ID)) return;

  const wrapper = document.createElement('div');
  wrapper.id = TOOLBAR_ID;

  const btn = document.createElement('button');
  btn.id          = BTN_ID;
  btn.title       = 'HR Genetics. Drag to move, right-click to reset position';
  btn.textContent = 'HR Genetics';
  btn.className   = 'hr-genetics-topbar-btn';

  wrapper.appendChild(btn);
  document.body.appendChild(wrapper);

  // Initial position priority: user-saved > Config Highlighter anchor > default top-right.
  const saved = await loadSavedPosition();
  applyPosition(wrapper, saved ?? configHighlighterAnchor() ?? DEFAULT_POSITION);

  btn.addEventListener('click', togglePanel);
  attachDragHandlers(btn, wrapper);
  attachResetHandler(btn, wrapper);
}

const PANEL_WIDTH = 340;

function togglePanel() {
  if (document.getElementById(PANEL_ID)) {
    removePanel();
    return;
  }
  openPanel();
}

function openPanel() {
  const iframe = document.createElement('iframe');
  iframe.id  = PANEL_ID;
  iframe.src = PANEL_URL;
  iframe.style.cssText = [
    'position:fixed',
    'top:0',
    'right:0',
    `width:${PANEL_WIDTH}px`,
    'height:100vh',
    'border:none',
    'z-index:100000',
    'box-shadow:-4px 0 20px rgba(0,0,0,0.5)',
  ].join(';');
  document.body.appendChild(iframe);

  // close on outside click
  document.addEventListener('click', onOutsideClick, true);
}

function removePanel() {
  document.getElementById(PANEL_ID)?.remove();
  document.removeEventListener('click', onOutsideClick, true);
}

function onOutsideClick(e) {
  // The panel occupies the rightmost PANEL_WIDTH px of the viewport.
  // Any click to the left of that boundary closes the panel.
  if (e.clientX < window.innerWidth - PANEL_WIDTH) {
    removePanel();
  }
}

// Close when the sidebar's × button posts a message
window.addEventListener('message', (e) => {
  if (e.data?.type === 'HR_CLOSE_PANEL') {
    removePanel();
  }
});

// Forward pick events from content.js to the sidebar iframe
// content.js dispatches 'hr-genetics-pick' on document, we open the panel
// and relay via iframe.contentWindow.postMessage (avoids chrome.runtime issues
// when the sidebar isn't already open)
document.addEventListener('hr-genetics-pick', (e) => {
  const msg = { type: 'HR_PICK_HORSE', ...e.detail };

  const existing = document.getElementById(PANEL_ID);
  if (existing) {
    existing.contentWindow.postMessage(msg, '*');
  } else {
    openPanel();
    const iframe = document.getElementById(PANEL_ID);
    iframe.addEventListener('load', () => {
      iframe.contentWindow.postMessage(msg, '*');
    }, { once: true });
  }
});

function loadSavedPosition() {
  return new Promise((resolve) => {
    chrome.storage.local.get(POSITION_STORAGE_KEY, (data) => {
      resolve(data[POSITION_STORAGE_KEY] ?? null);
    });
  });
}

function savePosition(pos) {
  chrome.storage.local.set({ [POSITION_STORAGE_KEY]: pos });
}

function clearSavedPosition() {
  chrome.storage.local.remove(POSITION_STORAGE_KEY);
}

// Anchor below the "Config Highlighter" button (my other extension) when present.
// Identified by visible text rather than any fixed-position button so unrelated
// extensions/userscripts no longer get matched.
function configHighlighterAnchor() {
  const cfg = [...document.querySelectorAll('button')]
    .find(b => b.innerText.trim() === 'Config Highlighter');
  if (!cfg) return null;
  const r = cfg.getBoundingClientRect();
  return { top: r.bottom + 4, right: window.innerWidth - r.right };
}

function applyPosition(target, { top, right }) {
  target.style.top   = top + 'px';
  target.style.right = right + 'px';
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function attachDragHandlers(btn, wrapper) {
  let dragging      = false;
  let suppressClick = false;
  let startX = 0, startY = 0;
  let originRight = 0, originTop = 0;

  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    btn.setPointerCapture(e.pointerId);
    dragging      = false;
    suppressClick = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = wrapper.getBoundingClientRect();
    originRight = window.innerWidth - rect.right;
    originTop   = rect.top;
  });

  btn.addEventListener('pointermove', (e) => {
    if (!btn.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragging && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
      dragging      = true;
      suppressClick = true;
      btn.classList.add('dragging');
    }
    if (dragging) {
      const newTop   = clamp(originTop   + dy, 0, window.innerHeight - wrapper.offsetHeight);
      const newRight = clamp(originRight - dx, 0, window.innerWidth  - wrapper.offsetWidth);
      applyPosition(wrapper, { top: newTop, right: newRight });
    }
  });

  btn.addEventListener('pointerup', (e) => {
    if (!btn.hasPointerCapture(e.pointerId)) return;
    btn.releasePointerCapture(e.pointerId);
    btn.classList.remove('dragging');
    if (dragging) {
      const rect = wrapper.getBoundingClientRect();
      savePosition({ top: rect.top, right: window.innerWidth - rect.right });
    }
  });

  btn.addEventListener('click', (e) => {
    if (suppressClick) {
      e.preventDefault();
      e.stopImmediatePropagation();
      suppressClick = false;
    }
  }, true);
}

function attachResetHandler(btn, wrapper) {
  btn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    clearSavedPosition();
    applyPosition(wrapper, configHighlighterAnchor() ?? DEFAULT_POSITION);
  });
}

// Init
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  injectTopbarButton();
} else {
  document.addEventListener('DOMContentLoaded', injectTopbarButton);
}