
//  Injected into every Horse Reality horse profile page (/horses/*).
//    - Fetches horse metadata (name, sex, breed, photo) from the HR API
//    - Reads the genetics table from the DOM
//    - Injects "Add as Dam / Add as Sire" buttons
//    - Relays horse data to the sidebar when a button is clicked

// HR API helpers
// Extract numeric horse ID from the current URL, or null on non-profile pages
function getHorseId() {
  const m = window.location.pathname.match(/\/horses\/(\d+)/);
  return m ? m[1] : null;
}


// Read the CSRF token from the HR auth cookie (JWT payload field `hr_csrf`)
// The cookie `hr_auth_production_access_payload` contains a JWT whose
// middle segment (base64url) decodes to JSON with `hr_csrf`
function getCsrf() {
  const m = document.cookie.match(/hr_auth_production_access_payload=([^;]+)/);
  if (!m) return null;
  try {
    const b64 = m[1].split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64)).hr_csrf ?? null;
  } catch { return null; }
}


// Fetch horse data from the HR API
// Returns the `horse` object from the response, or null on failure
async function fetchHorse(horseId) {
  const csrf = getCsrf();
  if (!csrf) return null;
  try {
    const res = await fetch(`https://v2.horsereality.com/api/player/horse/${horseId}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-csrf-token': csrf,
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.horse ?? null;
  } catch { return null; }
}

// DOM selectors (Genetics table only, everything else comes from the API)
const SEL = {
  geneticsContainer: 'div.grid_6.genetics',
  geneticRow:        'div.genetic_table_row',
  geneticName:       'div.genetic_name',
  geneticResult:     'div.genetic_result',
  testBlock:         'div.genetic_tests',
  testIcon:          'img.icon16',
  hrToggleBtn:       '#hr-genetics-toggle-btn',
};

// Read genetics table from DOM
function readGeneticsRows() {
  const containers = document.querySelectorAll(SEL.geneticsContainer);
  const container  = [...containers].find(c => c.querySelector(SEL.geneticResult));
  if (!container) return [];

  const result = [];
  for (const row of container.querySelectorAll(SEL.geneticRow)) {
    const nameEl   = row.querySelector(SEL.geneticName);
    const resultEl = row.querySelector(SEL.geneticResult);
    if (!nameEl || !resultEl) continue;

    const testBlocks = row.querySelectorAll(SEL.testBlock);
    const tested = [...testBlocks].map(b => b.querySelector(SEL.testIcon)?.alt === 'Tested');

    result.push({ name: nameEl.textContent.trim(), result: resultEl.textContent.trim(), tested });
  }
  return result;
}

function isFullyUntested(rows) {
  return rows.length === 0 || rows.every(r => r.result === '? / ?');
}

// Role determination from API sex field
// Returns 'dam' | 'sire' | 'both' given API sex string
function sexToRole(sex) {
  if (!sex) return 'both';
  const s = sex.toLowerCase();
  if (s === 'stallion' || s === 'colt') return 'sire';
  if (s === 'mare'     || s === 'filly') return 'dam';
  return 'both'; // gelding, unknown
}

// Fixed-position badge
const BADGE_ID  = 'hr-genetics-pick-badge';
const HR_BTN_ID = 'hr-genetics-toggle-btn';

function injectBadge(role) {
  if (document.getElementById(BADGE_ID)) return;

  const hrBtn = document.getElementById(HR_BTN_ID);
  if (!hrBtn) return;

  const badge = document.createElement('div');
  badge.id = BADGE_ID;
  badge.innerHTML = `
    ${role !== 'sire' ? '<button id="hr-pick-dam"  disabled title="Loading…">♀ Add as Dam</button>'  : ''}
    ${role !== 'dam'  ? '<button id="hr-pick-sire" disabled title="Loading…">♂ Add as Sire</button>' : ''}
  `;
  document.body.appendChild(badge);

  positionBadge(badge, hrBtn);

  badge.querySelector('#hr-pick-dam') ?.addEventListener('click', () => pickHorse('dam'));
  badge.querySelector('#hr-pick-sire')?.addEventListener('click', () => pickHorse('sire'));
}

function positionBadge(badge, hrBtn) {
  const r = hrBtn.getBoundingClientRect();
  badge.style.top   = (r.bottom + 4) + 'px';
  badge.style.right = (window.innerWidth - r.right) + 'px';
}

function enableBadgeButtons(rows) {
  const badge = document.getElementById(BADGE_ID);
  if (!badge) return;
  const untested = isFullyUntested(rows);
  const dam  = badge.querySelector('#hr-pick-dam');
  const sire = badge.querySelector('#hr-pick-sire');
  if (dam)  { dam.disabled  = untested; dam.title  = untested ? 'No test results' : 'Add this mare as Dam'; }
  if (sire) { sire.disabled = untested; sire.title = untested ? 'No test results' : 'Add this stallion as Sire'; }
}

// Pick handler. Fires when the user clicks a badge button

// Cached horse metadata populated by init()
let cachedMeta = null;

function pickHorse(role) {
  const rows = readGeneticsRows();
  const meta = cachedMeta ?? { name: '', breed: '', gender: '', url: window.location.href, photoLayers: [], photoUrl: null };
  document.dispatchEvent(new CustomEvent('hr-genetics-pick', {
    detail: { role, meta, rows, partiallyTested: rows.some(r => r.result === '? / ?') },
  }));
}

// Init
// Only run on actual horse profile pages (/horses/<id>)
// Fetch horse data from the API immediately (no DOM dependency)
(async function init() {

  const horseId = getHorseId();
  if (!horseId) return;

  const horse = await fetchHorse(horseId);

  if (horse) {
    // Background layers have no `height` field; all horse layers do.
    // height/left/up come as strings from the API, parse them explicitly.
    const horseLayers = (horse.imageLayers ?? [])
      .filter(l => l.url && l.height != null)
      .map(l => ({ ...l, height: parseFloat(l.height), left: parseFloat(l.left), up: parseFloat(l.up) }));

    // When a foal under 6 months shares the page with its dam, both horses'
    // layers come back in `imageLayers`. Each horse occupies one distinct
    // height/left/up triple, and foals always render smaller (lower `height`).
    // Pick the size matching this horse's age, then keep all layers at that
    // exact position (old-system horses stack multiple layers per position).
    let photoLayers = horseLayers.map(l => l.url);
    if (horseLayers.length > 1) {
      const isFoal = (horse.ageInMonths ?? 99) < 6;
      const sorted = [...horseLayers].sort((a, b) => a.height - b.height);
      const ref = isFoal ? sorted[0] : sorted[sorted.length - 1];
      const mainLayers = horseLayers.filter(l =>
        Math.abs(l.height - ref.height) < 0.01 &&
        Math.abs(l.left   - ref.left)   < 0.01 &&
        Math.abs(l.up     - ref.up)     < 0.01
      );
      if (mainLayers.length > 0) photoLayers = mainLayers.map(l => l.url);
    }

    cachedMeta = {
      name:        horse.name   ?? '',
      breed:       horse.breed?.name ?? '',
      gender:      horse.sex    ?? '',
      url:         window.location.href,
      photoLayers,
      photoUrl:    photoLayers[0] ?? null,
    };
  }

  const role = sexToRole(horse?.sex);

  // Watch for the topbar button and genetics rows, both injected dynamically
  let badgeInjected  = false;
  let geneticsReady  = false;
  let observer       = null;

  function check() {
    if (!badgeInjected && document.getElementById(HR_BTN_ID)) {
      injectBadge(role);
      badgeInjected = true;
    }
    if (!geneticsReady) {
      const rows = readGeneticsRows();
      if (rows.length > 0) {
        geneticsReady = true;
        enableBadgeButtons(rows);
      }
    }
    if (badgeInjected && geneticsReady) {
      observer?.disconnect();
    }
  }

  check();
  if (!badgeInjected || !geneticsReady) {
    observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer?.disconnect(), 60_000);
  }
})();
