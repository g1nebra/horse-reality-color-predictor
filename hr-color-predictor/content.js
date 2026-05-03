
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

const BADGE_ID   = 'hr-genetics-pick-badge';
const HR_BTN_ID  = 'hr-genetics-toggle-btn';
const HR_TOOLBAR_ID = 'hr-genetics-toolbar';

const DISABLED_TOOLTIP =
  'Disabled. Make sure the horse is color tested, and try opening the Colour tab or reloading the page (data is read from there). Other browser extensions or scripts may interfere with the data extraction. If it still does not work, please report it with as much info as possible.';

function injectBadge(role) {
  if (document.getElementById(BADGE_ID)) return true;

  const wrapper = document.getElementById(HR_TOOLBAR_ID);
  if (!wrapper) return false;

  const badge = document.createElement('div');
  badge.id = BADGE_ID;
  badge.innerHTML = `
    ${role !== 'sire' ? `<button id="hr-pick-dam"  disabled data-tooltip="${DISABLED_TOOLTIP}">♀ Add as Dam</button>`  : ''}
    ${role !== 'dam'  ? `<button id="hr-pick-sire" disabled data-tooltip="${DISABLED_TOOLTIP}">♂ Add as Sire</button>` : ''}
  `;
  wrapper.appendChild(badge);

  badge.querySelector('#hr-pick-dam') ?.addEventListener('click', () => pickHorse('dam'));
  badge.querySelector('#hr-pick-sire')?.addEventListener('click', () => pickHorse('sire'));
  return true;
}

function enableBadgeButtons(rows) {
  const badge = document.getElementById(BADGE_ID);
  if (!badge) return;
  const untested = isFullyUntested(rows);
  const dam  = badge.querySelector('#hr-pick-dam');
  const sire = badge.querySelector('#hr-pick-sire');
  if (dam) {
    dam.disabled = untested;
    if (untested) { dam.dataset.tooltip = DISABLED_TOOLTIP; dam.removeAttribute('title'); }
    else          { delete dam.dataset.tooltip; dam.title = 'Add this mare as Dam'; }
  }
  if (sire) {
    sire.disabled = untested;
    if (untested) { sire.dataset.tooltip = DISABLED_TOOLTIP; sire.removeAttribute('title'); }
    else          { delete sire.dataset.tooltip; sire.title = 'Add this stallion as Sire'; }
  }
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

// Init. Runs on horse profile pages (/horses/<numeric-id>).
//
// The role (dam/sire/both) is decided BEFORE the badge is injected, so the
// user only ever sees the relevant button. The role comes from the API; if
// the API is slow or fails, a safety timeout falls back to 'both' so the
// extension stays usable on flaky networks.
const ROLE_FETCH_TIMEOUT_MS = 8000;

(function init() {
  const horseId = getHorseId();
  if (!horseId) return;

  let currentRole   = null;
  let badgeInjected = false;
  let geneticsReady = false;
  let observer      = null;

  function check() {
    if (!badgeInjected && currentRole !== null && document.getElementById(HR_BTN_ID)) {
      badgeInjected = injectBadge(currentRole);
      if (badgeInjected && geneticsReady) enableBadgeButtons(readGeneticsRows());
    }
    if (!geneticsReady) {
      const rows = readGeneticsRows();
      if (rows.length > 0) {
        geneticsReady = true;
        if (badgeInjected) enableBadgeButtons(rows);
      }
    }
    if (badgeInjected && geneticsReady) observer?.disconnect();
  }

  observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer?.disconnect(), 60_000);
  check();

  let resolved = false;
  const finalize = (role) => {
    if (resolved) return;
    resolved = true;
    currentRole = role;
    check();
  };

  fetchHorse(horseId).then(horse => {
    if (horse) {
      const horseLayers = (horse.imageLayers ?? [])
        .filter(l => l.url && l.height != null)
        .map(l => ({ ...l, height: parseFloat(l.height), left: parseFloat(l.left), up: parseFloat(l.up) }));

      // When a foal under 6 months shares the page with its dam, both horses'
      // layers come back in `imageLayers`. Each horse occupies one distinct
      // height/left/up triple, and foals render smaller (lower `height`). Pick
      // the size matching this horse's age, then keep all layers at that exact
      // position (old-system horses stack multiple layers per position).
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
      finalize(sexToRole(horse.sex));
    } else {
      finalize('both');
    }
  });

  setTimeout(() => finalize('both'), ROLE_FETCH_TIMEOUT_MS);
})();
