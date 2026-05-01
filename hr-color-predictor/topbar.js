// Injects the HR Genetics toggle button and manages the in-page sidebar iframe
// The panel is a fixed-position iframe loaded from the extension's sidebar.html,
// overlaid on the right side of the page.


const BTN_ID    = 'hr-genetics-toggle-btn';
const PANEL_ID  = 'hr-genetics-panel';
const PANEL_URL = chrome.runtime.getURL('sidebar/sidebar.html');

function injectTopbarButton() {
  if (document.getElementById(BTN_ID)) return;

  const btn = document.createElement('button');
  btn.id          = BTN_ID;
  btn.title       = 'HR Genetics';
  btn.textContent = 'HR Genetics';
  btn.className   = 'hr-genetics-topbar-btn';
  btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;';

  document.body.appendChild(btn);

  btn.addEventListener('click', togglePanel);

  positionBelowConfigHighlighter(btn);
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

// Positioning below Config Highlighter (my other extension :s)
function positionBelowConfigHighlighter(myBtn) {
  if (nudge(myBtn)) return;

  const observer = new MutationObserver(() => {
    if (nudge(myBtn)) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 5000);
}

function nudge(myBtn) {
  const cfgBtn = [...document.querySelectorAll('button')].find(b =>
    b !== myBtn && (b.getAttribute('style') || '').includes('position: fixed')
  );
  if (!cfgBtn) return false;

  const rect = cfgBtn.getBoundingClientRect();
  myBtn.style.top   = (rect.bottom + 4) + 'px';
  myBtn.style.right = (window.innerWidth - rect.right) + 'px';
  return true;
}

// Init
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  injectTopbarButton();
} else {
  document.addEventListener('DOMContentLoaded', injectTopbarButton);
}