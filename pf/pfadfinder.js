/* =========================================================
   A BOOTSTRAP & GLOBALS                                    
   ========================================================= */
//#region

/* ---------------------------------------------------------
   A0 Datei-Header
   --------------------------------------------------------- */

/*
   PFADFINDER – NAVIGATION ARCHITEKTUR
   ROOT-CURRENT & ROOT-LEAF STATE
*/

// A1 DEV-Gate (Helper)

function isDevMode() {
  return document.body?.dataset?.dev === 'true';
}

/* ---------------------------------------------------------
   A2 Navigation-State Konstanten + Vars
   --------------------------------------------------------- */

const NAV_STATE = {
  ROOT: 'root',
  SCOPE: 'scope'
};

let currentNavState = NAV_STATE.ROOT;
let currentActiveId = null;
let currentScopeParent = null;

/* ---------------------------------------------------------
   A3 DOM-Helper qs/qsa
   --------------------------------------------------------- */

const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

//#endregion
/* ======================== END A ========================== */

/* =========================================================
   B ENTRYPOINTS (START/HOME)                               
   ========================================================= */
//#region 

/* ---------------------------------------------------------
   B1 Start-Param (?start=...) -> Klickpfad routen
   --------------------------------------------------------- */

/*
   Unterstützt:
   ?start=SGBIII
   ?start=SGB III

   REGEL (wichtig):
   - KEINE direkte State- oder DOM-Manipulation
   - Startparameter simuliert einen echten User-Klick
   - Klick erfolgt NACH vollständiger Initialisierung
*/

(function handleStartParam() {

  const params = new URLSearchParams(window.location.search);
  if (!params.has('start')) return;

  const rawStart = params.get('start');
  if (!rawStart) return;

  const normalize = s =>
    s.replace(/\s+/g, '').toLowerCase();

  const wanted = normalize(rawStart);

  // Verzögert ausführen, damit alle Click-Handler existieren
  setTimeout(() => {

    const leafButtons = qsa('button[data-col]');

    for (const btn of leafButtons) {
      const label = btn.textContent || '';
      if (normalize(label) === wanted) {
        btn.click();   // echter Klick → normaler Codepfad
        return;
      }
    }

  }, 0);

})();

/* ---------------------------------------------------------
   B2 Home-Start-Buttons -> Klickpfad routen
   --------------------------------------------------------- */

/*
   Ziel:
   - Klick auf Startseiten-Button aktiviert denselben Pfad wie Nav-Leaf-Klick
   - keine URL-Änderung, keine eigene State-Logik
   - robust gegen "SGB III" vs "SGBIII" (Whitespace-ignorant)
*/

(function setupHomeStartButtons() {

  const normalize = s =>
    String(s || '').replace(/\s+/g, '').toLowerCase();

  document.addEventListener('click', e => {
    const homeBtn = e.target.closest('.home-start-button');
    if (!homeBtn) return;

    e.preventDefault();

    const raw = homeBtn.dataset.startLabel || homeBtn.textContent || '';
    const wanted = normalize(raw);
    if (!wanted) return;

    // Exakt wie Start-Param: Leaf-Button suchen und "echt" klicken
    const leafButtons = qsa('button[data-col]');
    for (const btn of leafButtons) {
      const label = btn.textContent || '';
      if (normalize(label) === wanted) {
        btn.focus({ preventScroll: true });
        btn.click(); // → normaler Codepfad in [BLOCK 8]

        // Fokus defensiv in der Navigation halten
        // (Safari/Browser können sonst „zurückspringen“)
        requestAnimationFrame(() => {
          const navTarget =
            qs('.nav-pane button[role="treeitem"][aria-selected="true"]') ||
            qs('.nav-pane button[role="treeitem"][aria-current="page"]') ||
            btn;

          if (navTarget && typeof navTarget.focus === 'function') {
            navTarget.focus({ preventScroll: true });
          }
        });

        return;
      }
    }

    if (isDevMode()) {
      console.warn('Startseite: Kein passendes Leaf gefunden für:', raw);
    }
  });

})();

/* ---------------------------------------------------------
   B3 Home-Visibility (Tab-Fokus stabil halten)
   --------------------------------------------------------- */

function syncHomeVisibility() {
  const home = qs('.home');
  if (!home) return;

  // Sobald irgendeine Collection aktiv ist, muss die Startseite AUS dem Tab-Flow.
  // (Verhindert: Tab fokussiert kurz einen Home-Button, der dann per CSS/:has() verschwindet.)
  const hasActiveContent = !!qs('.collection-section.active');
  home.hidden = hasActiveContent;
}

(function initHomeVisibility() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncHomeVisibility);
  } else {
    syncHomeVisibility();
  }
})();

//#endregion
/* ========================= END B ========================= */

/* =========================================================
   C A11Y & URL/SCROLL HELPERS                               
   ========================================================= */
//#region 

/* ---------------------------------------------------------
   C1 ARIA: aria-expanded Sync (Parents)
   --------------------------------------------------------- */

function syncExpandedStates() {
  // Hart erzwingen: aria-expanded NUR bei Parent-TreeItems (data-nav)
  // 1) Falls irgendwo versehentlich gesetzt: von Nicht-Parents entfernen (Leaf-TreeItems etc.)
  qsa('.nav-pane button[role="treeitem"]:not([data-nav])[aria-expanded]')
    .forEach(btn => btn.removeAttribute('aria-expanded'));

  // 2) Parents synchronisieren (Quelle der Wahrheit: li.nav-item.open)
  qsa('.nav-pane button[role="treeitem"][data-nav]').forEach(btn => {
    const li = btn.closest('.nav-item');
    const expanded = !!(li && li.classList.contains('open'));
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  });
}

/* ---------------------------------------------------------
   C2 ARIA: aria-current="page" (genau eins)
   --------------------------------------------------------- */

/*
   Ziel:
   - Im Tree gibt es genau EIN aria-current="page"
   - Quelle der Wahrheit bleibt deine Klasse: .nav-item.is-root-current
*/

function clearAriaCurrent() {
  // nur TreeItems, keine Root/Dev Buttons
  qsa('.nav-pane button[role="treeitem"][aria-current]')
    .forEach(b => b.removeAttribute('aria-current'));
}

function syncAriaCurrent() {
  clearAriaCurrent();

  const li = qs('.nav-item.is-root-current');
  const btn = li ? qs('button[role="treeitem"]', li) : null;

  if (btn) {
    btn.setAttribute('aria-current', 'page');
  }
}

/* ---------------------------------------------------------
   C3 URL Hash Control + Jump-Scroll Helper
   --------------------------------------------------------- */

/*
   Ziel:
   - Jumpmarks (im Content) sollen scrollen, aber KEIN Fragment (#...) in die URL schreiben
   - vorhandene Fragmente sollen beim Leaf-Wechsel entfernt werden
*/

function clearUrlHash() {
  if (!window.location.hash) return;
  history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search
  );
}

function scrollToJumpTarget(targetEl) {
  if (!targetEl || typeof targetEl.scrollIntoView !== 'function') return;

  const prefersReduced =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  targetEl.scrollIntoView({
    behavior: prefersReduced ? 'auto' : 'smooth',
    block: 'start'
  });
}

function scrollContentToTop(behavior = 'auto') {
  // Layout: NICHT das Dokument soll scrollen, sondern ein Container.
  // Deshalb: echten Scroll-Container ermitteln (Element mit overflow-y:auto/scroll + eigener Scrollhöhe).

  function isScrollable(el) {
    if (!el) return false;
    const cs = window.getComputedStyle(el);
    const oy = cs.overflowY;
    const canScroll = (oy === 'auto' || oy === 'scroll' || oy === 'overlay');
    return canScroll && (el.scrollHeight > el.clientHeight + 1);
  }

  function findScrollParent(startEl) {
    let el = startEl;
    while (el && el !== document.body && el !== document.documentElement) {
      if (isScrollable(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  // 1) Prefer: Scroll-Parent der aktiven Section (am zuverlässigsten nach Layout-Änderungen)
  const activeSection = document.querySelector('.collection-section.active');
  const main = document.querySelector('main');

  const scrollContainer =
    findScrollParent(activeSection) ||
    findScrollParent(main) ||
    (isScrollable(main) ? main : null) ||
    null;

  if (scrollContainer) {
    try {
      scrollContainer.scrollTo({ top: 0, behavior });
    } catch (_) {
      scrollContainer.scrollTop = 0;
    }
    return;
  }

  // 2) Fallback: dokumentweiter Scroll (falls doch Body/HTML scrollt)
  const se = document.scrollingElement;
  if (se && se !== document.documentElement && se.scrollHeight > se.clientHeight + 1) {
    try {
      se.scrollTo({ top: 0, behavior });
    } catch (_) {
      se.scrollTop = 0;
    }
    return;
  }

  // 3) Letzter Fallback
  try {
    window.scrollTo({ top: 0, behavior });
  } catch (_) {
    window.scrollTo(0, 0);
  }
}

/* ---------------------------------------------------------
   C4 ARIA: aria-selected Sync (Leafs)
   --------------------------------------------------------- */

/* Ziel:
   - genau ein Leaf ist aria-selected="true"
   - alle anderen Leafs aria-selected="false"
   - Root-Mode clears Selection
*/

function clearLeafAriaSelected() {
  // aria-selected NUR für Leafs (TreeItems mit data-col)
  // 1) Falls irgendwo versehentlich gesetzt: von Nicht-Leaf-TreeItems entfernen
  qsa('.nav-pane button[role="treeitem"]:not([data-col])[aria-selected]')
    .forEach(btn => btn.removeAttribute('aria-selected'));

  // 2) Leafs immer auf "false" setzen (einheitlicher Ausgangszustand)
  qsa('.nav-pane button[role="treeitem"][data-col]')
    .forEach(btn => btn.setAttribute('aria-selected', 'false'));
}

function setLeafAriaSelected(activeBtn) {
  // nur Leafs dürfen selected sein
  if (!activeBtn) return;
  if (!activeBtn.matches('.nav-pane button[role="treeitem"][data-col]')) return;

  clearLeafAriaSelected();
  activeBtn.setAttribute('aria-selected', 'true');
}

/* ---------------------------------------------------------
   C5 THEME (Light/Dark Toggle + Persistenz)
   --------------------------------------------------------- */

/*
   Ziel:
   - User-Toggle (Footer) für Light/Dark
   - Persistenz via localStorage
   - Default: System (keine force-* Klasse)
   - arbeitet mit HTML Klassen: force-light / force-dark

   Erwartete Markups (unterstützt beide):
   A) Radios:
      <div class="theme-toggle"> <input type="radio" name="theme" value="light|dark|system|auto"> ...
   B) Buttons (A11y als Radiogroup):
      <span class="theme-toggle" role="radiogroup">
        <button type="button" data-theme="light|dark|system|auto" role="radio" aria-checked="false|true">…</button>
      </span>

   Hinweis:
   - "auto" wird als Alias für "system" akzeptiert.
   - Für Styling wird zusätzlich `aria-pressed="true|false"` gespiegelt.
*/

const PF_THEME = {
  STORAGE_KEY: 'pf.theme',
  MODES: { LIGHT: 'light', DARK: 'dark', SYSTEM: 'system' }
};

function pfGetStoredTheme() {
  try {
    const v = String(localStorage.getItem(PF_THEME.STORAGE_KEY) || '').trim().toLowerCase();

    // Alias/legacy: "auto" == system
    if (v === 'auto') return PF_THEME.MODES.SYSTEM;

    return (v === PF_THEME.MODES.LIGHT || v === PF_THEME.MODES.DARK || v === PF_THEME.MODES.SYSTEM)
      ? v
      : null;
  } catch (_) {
    return null;
  }
}

function pfStoreTheme(mode) {
  try {
    localStorage.setItem(PF_THEME.STORAGE_KEY, mode);
  } catch (_) {
    // ignore (private mode / storage blocked)
  }
}

function pfSystemPrefersDark() {
  return !!(
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function pfApplyThemeClass(mode) {
  const html = document.documentElement;
  if (!html) return;

  // Reset
  html.classList.remove('force-light', 'force-dark');

  if (mode === PF_THEME.MODES.LIGHT) {
    html.classList.add('force-light');
  } else if (mode === PF_THEME.MODES.DARK) {
    html.classList.add('force-dark');
  } else {
    // SYSTEM: keine force-* Klasse
  }
}

function pfNormalizeThemeMode(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === PF_THEME.MODES.LIGHT) return PF_THEME.MODES.LIGHT;
  if (v === PF_THEME.MODES.DARK) return PF_THEME.MODES.DARK;

  // Accept both "system" and "auto" as the OS-driven mode
  if (v === PF_THEME.MODES.SYSTEM || v === 'auto') return PF_THEME.MODES.SYSTEM;

  return null;
}

function pfSyncThemeControls(mode) {
  const toggles = document.querySelectorAll('.theme-toggle');
  if (!toggles.length) return;

  toggles.forEach(toggle => {

    // A) Radio-Variante
    const radios = Array.from(toggle.querySelectorAll('input[type="radio"][name="theme"]'));
    if (radios.length) {
      // Wenn es sowohl "system" als auch "auto" gibt, soll nur EINS aktiv sein.
      // Prefer: "system" (semantisch), sonst "auto".
      const hasSystem = radios.some(r => String(r.value || '').trim().toLowerCase() === 'system');
      const hasAuto = radios.some(r => String(r.value || '').trim().toLowerCase() === 'auto');
      const preferredSystem = hasSystem ? 'system' : (hasAuto ? 'auto' : 'system');

      const targetValue =
        (mode === PF_THEME.MODES.SYSTEM)
          ? preferredSystem
          : mode;

      radios.forEach(r => {
        const raw = String(r.value || '').trim().toLowerCase();
        r.checked = (raw === targetValue);
      });
      return;
    }

    // B) Button-Variante (role=radio + aria-checked)
    const btns = Array.from(toggle.querySelectorAll('button[data-theme], button[data-mode]'));
    if (!btns.length) return;

    // Wenn es sowohl "system" als auch "auto" Buttons gibt: nur EINER darf aktiv sein.
    const hasSystemBtn = btns.some(b => String(b.dataset.theme || b.dataset.mode || '').trim().toLowerCase() === 'system');
    const hasAutoBtn = btns.some(b => String(b.dataset.theme || b.dataset.mode || '').trim().toLowerCase() === 'auto');
    const preferredSystemRaw = hasSystemBtn ? 'system' : (hasAutoBtn ? 'auto' : 'system');

    // 1) Reset: alles AUS
    btns.forEach(b => {
      // A11y Radiogroup
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');

      // Styling-Spiegel (für CSS)
      b.setAttribute('aria-pressed', 'false');

      // Roving tabindex: genau EIN Tab-Stop (der aktive)
      b.setAttribute('tabindex', '-1');

      b.classList.remove('is-theme-current');
    });

    // 2) Ziel-Button bestimmen (genau EINER)
    const wantedRaw = (mode === PF_THEME.MODES.SYSTEM) ? preferredSystemRaw : mode;

    let activeBtn = null;

    if (mode === PF_THEME.MODES.SYSTEM) {
      // Prefer: Button mit dem bevorzugten Raw-Label (system ODER auto)
      activeBtn = btns.find(b => {
        const raw = String(b.dataset.theme || b.dataset.mode || '').trim().toLowerCase();
        return raw === wantedRaw;
      }) || null;

      // Fallback: irgendein Button, der auf SYSTEM normalisiert
      if (!activeBtn) {
        activeBtn = btns.find(b => {
          const raw = String(b.dataset.theme || b.dataset.mode || '').trim().toLowerCase();
          return pfNormalizeThemeMode(raw) === PF_THEME.MODES.SYSTEM;
        }) || null;
      }
    } else {
      // LIGHT/DARK: exakt der Button, der auf den Modus normalisiert
      activeBtn = btns.find(b => {
        const raw = String(b.dataset.theme || b.dataset.mode || '').trim().toLowerCase();
        return pfNormalizeThemeMode(raw) === mode;
      }) || null;
    }

    // Letzter Fallback: irgendein Button (verhindert "kein Tab-Stop")
    if (!activeBtn) activeBtn = btns[0];

    // 3) Aktiv markieren
    activeBtn.setAttribute('aria-checked', 'true');
    activeBtn.setAttribute('aria-pressed', 'true');
    activeBtn.setAttribute('tabindex', '0');
    activeBtn.classList.add('is-theme-current');
  });
}

function pfSetTheme(mode, opts = {}) {
  const normalized = pfNormalizeThemeMode(mode) || PF_THEME.MODES.SYSTEM;
  const persist = (opts.persist !== false);

  pfApplyThemeClass(normalized);
  pfSyncThemeControls(normalized);

  if (persist) {
    pfStoreTheme(normalized);
  }

  return normalized;
}

(function initThemeToggle() {

  function init() {
    const stored = pfGetStoredTheme();
    const initial = stored || PF_THEME.MODES.SYSTEM;

    // Initial anwenden (ohne erneut zu persistieren)
    pfSetTheme(initial, { persist: false });

    // Events (Radio)
    document.addEventListener('change', (e) => {
      const input = e.target && e.target.closest ? e.target.closest('.theme-toggle input[type="radio"][name="theme"]') : null;
      if (!input) return;

      const m = pfNormalizeThemeMode(input.value);
      if (!m) return;

      pfSetTheme(m);
    }, true);

    // Events (Button)
    document.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('.theme-toggle button[data-theme], .theme-toggle button[data-mode]') : null;
      if (!btn) return;

      const m = pfNormalizeThemeMode(btn.dataset.theme || btn.dataset.mode);
      if (!m) return;

      pfSetTheme(m);
    }, true);

    // Keyboard (Buttons als Radiogroup): Pfeile/Home/End wechseln den Mode
    document.addEventListener('keydown', (e) => {
      const btn = e.target && e.target.closest
        ? e.target.closest('.theme-toggle button[role="radio"], .theme-toggle button[data-theme], .theme-toggle button[data-mode]')
        : null;
      if (!btn) return;

      if (e.altKey || e.ctrlKey || e.metaKey) return;

      const group = btn.closest('.theme-toggle');
      if (!group) return;

      const buttons = Array.from(group.querySelectorAll('button[role="radio"], button[data-theme], button[data-mode]'))
        .filter(b => !b.disabled);

      if (!buttons.length) return;

      const i = buttons.indexOf(btn);
      if (i === -1) return;

      const key = e.key;
      let next = null;

      if (key === 'ArrowRight' || key === 'ArrowDown') {
        next = buttons[(i + 1) % buttons.length];
      } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
        next = buttons[(i - 1 + buttons.length) % buttons.length];
      } else if (key === 'Home') {
        next = buttons[0];
      } else if (key === 'End') {
        next = buttons[buttons.length - 1];
      } else {
        return;
      }

      e.preventDefault();

      try {
        next.focus({ preventScroll: true });
      } catch (_) {
        next.focus();
      }

      next.click();
    }, true);

    // Wenn System-Modus aktiv ist: auf OS-Änderungen reagieren
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        const current = pfGetStoredTheme() || PF_THEME.MODES.SYSTEM;
        if (current === PF_THEME.MODES.SYSTEM) {
          // Nur resync (keine force-* Klasse) – CSS reagiert via prefers-color-scheme
          pfSetTheme(PF_THEME.MODES.SYSTEM, { persist: false });
        }
      };

      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

//#endregion
/* ======================== END C ========================== */

/* =========================================================
   D NAV UI PIECES (SCOPE UI)                               
   ========================================================= */
//#region 

/* ---------------------------------------------------------
   D1 Fixed-Parent UI (Scope Mirror)
   --------------------------------------------------------- */

const fixedParentEl = () => qs('.nav-fixed-parent');
const fixedParentBtn = () => qs('.nav-fixed-parent-button');

function showFixedParent(parentItem) {
  const wrap = fixedParentEl();
  const btn = fixedParentBtn();
  if (!wrap || !btn || !parentItem) return;

  // Label robust ermitteln
  const label =
    (parentItem.querySelector(':scope > button .nav-label')?.textContent ||
     parentItem.querySelector(':scope > button')?.textContent ||
     parentItem.dataset?.label ||
     '').trim();

  if (!label) return;

  // ✅ NICHT button.textContent = ...
  const labelSpan = btn.querySelector('#nav-fixed-parent-label');
  if (labelSpan) {
    labelSpan.textContent = label;
  } else {
    btn.textContent = label; // Fallback
  }

  // sichtbar machen
  wrap.hidden = false;
  wrap.removeAttribute('hidden'); // defensiv
}

function hideFixedParent() {
  const wrap = fixedParentEl();
  const btn = fixedParentBtn();

  if (btn) {
    const labelSpan = btn.querySelector('#nav-fixed-parent-label');
    if (labelSpan) labelSpan.textContent = '';
  }

  if (wrap) {
    wrap.hidden = true;
    wrap.setAttribute('hidden', '');
  }
}

/* Klick auf Fixed Parent → ROOT */
document.addEventListener('click', e => {
  if (e.target.closest('.nav-fixed-parent-button')) {
    enterRootMode();
  }
});

//#endregion
/* ======================== END D ========================== */

/* =========================================================
   E STATE MACHINE (ROOT/SCOPE)                             
   ========================================================= */
//#region 

/* ---------------------------------------------------------
   E1 State-Setter + Apply (Body-Klassen, Fixed-Parent)
   --------------------------------------------------------- */

function setNavState(next, reason = '') {
  if (currentNavState === next) return;

  const prev = currentNavState;
  currentNavState = next;

  PF_DEV.onStateChange(prev, next, reason, {
    activeId: currentActiveId,
    scopeParent: currentScopeParent?.id || null
  });
}

function applyNavState() {
  document.body.classList.toggle(
    'nav-focus-mode',
    currentNavState === NAV_STATE.SCOPE
  );

  if (currentNavState === NAV_STATE.ROOT) {
    hideFixedParent();
  }
}

/* ---------------------------------------------------------
   E2 Root-Mode Eintritt (Reset, ScrollTop, ARIA sync)
   --------------------------------------------------------- */

function enterRootMode() {

  // Nur beim Wechsel SCOPE → ROOT nach oben scrollen (sonst springt die Nav bei Parent-Toggles)
  const shouldScrollToTop = (currentNavState === NAV_STATE.SCOPE);

  // aria-expanded nur SYNCHRONISIEREN (nicht einklappen)
  syncExpandedStates();

  syncAriaCurrent();

  // Scope-spezifische Markierungen entfernen
  qsa('.nav-item.is-root-active')
    .forEach(li => li.classList.remove('is-root-active'));

  qsa('.nav-item.is-scope-parent, .nav-item.is-scope-leaf, .nav-item.active')
    .forEach(li => li.classList.remove(
      'is-scope-parent',
      'is-scope-leaf',
      'active'
    ));

  currentActiveId = null;
  currentScopeParent = null;

  // ARIA – keine Auswahl im Tree
  clearLeafAriaSelected();

  setNavState(NAV_STATE.ROOT, 'enterRootMode');
  applyNavState();

  const navScroll = qs('.nav-scroll');
  if (shouldScrollToTop && navScroll) navScroll.scrollTop = 0;
}

/* ---------------------------------------------------------
   E3 Scope-Mode Eintritt (Markieren, Hiding, Scroll)
   --------------------------------------------------------- */

function enterScopeMode(activeLeafItem, activeId) {
  if (!activeLeafItem || !activeId) return;

  const parentItem =
    activeLeafItem.closest('.nav-children')?.closest('.nav-item');
  if (!parentItem) return;

  // Root-Current (persistent, genau einer)
  qsa('.nav-item.is-root-current')
    .forEach(li => li.classList.remove('is-root-current'));
  parentItem.classList.add('is-root-current');
  syncAriaCurrent();

  // Root-Active (Scope-spezifisch)
  parentItem.classList.add('is-root-active');

  currentActiveId = activeId;
  currentScopeParent = parentItem;

  // temporäre Zustände zurücksetzen
  qsa('.nav-item').forEach(li => {
    li.classList.remove(
      'is-hidden',
      'is-scope-parent',
      'is-scope-leaf',
      'active'
    );
  });

  // Parent markieren
  parentItem.classList.add('is-scope-parent');

  // Alle direkten Leafs markieren
  qsa(':scope > .nav-children > .nav-item', parentItem)
    .forEach(li => li.classList.add('is-scope-leaf'));

  // Aktives Leaf
  activeLeafItem.classList.add('active');

  // Aktives Leaf sanft ins Blickfeld bringen
  // scrollActiveLeafIntoView(activeLeafItem);

  // Alles außerhalb des Scopes ausblenden
  qsa('.nav-item').forEach(li => {
    if (li !== parentItem && !parentItem.contains(li)) {
      li.classList.add('is-hidden');
    }
  });

  showFixedParent(parentItem);

  setNavState(NAV_STATE.SCOPE, 'enterScopeMode');
  applyNavState();

  // Nach dem State-Apply scrollen, damit der Leaf auch dann sichtbar ist,
  // wenn er vorher (Parent zu) im Root-Mode noch nicht gerendert/angezeigt war.
  requestAnimationFrame(() => {
    const btn = activeLeafItem?.querySelector?.('button[role="treeitem"]');
    scrollActiveLeafIntoView(btn || activeLeafItem);
  });
}

//#endregion
/* ======================== END E ========================== */

/* =========================================================
   F INTERACTION: CLICK/KEYS                                 
   ========================================================= */
//#region 

/* --------------------------------------------------------- 
   F1 Click-Delegation (RootExit, Toggle, Leaf)
   --------------------------------------------------------- */

document.addEventListener('click', e => {

  // === ROOT-EXIT ===
  if (e.target.closest('.nav-root-button')) {
    enterRootMode();
    return;
  }

  // === ROOT-PARENT (Toggle) === 
  const navBtn = e.target.closest('button[data-nav]');
  if (navBtn) {
    const li = navBtn.closest('.nav-item');

    // Root-Current neu setzen
    qsa('.nav-item.is-root-current')
      .forEach(el => el.classList.remove('is-root-current', 'is-root-leaf'));

    li.classList.add('is-root-current');
    syncAriaCurrent();
    li.classList.remove('is-root-leaf'); // Parent ≠ Leaf

    // andere Parents schließen
    qsa('.nav-item.open').forEach(el => {
      if (el !== li) {
        el.classList.remove('open');
        const b = qs('button[data-nav]', el);
        if (b) b.setAttribute('aria-expanded', 'false');
      }
    });

    const expanded = li.classList.toggle('open');

    // aria-expanded als String setzen 
    navBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');

    enterRootMode(); // macht auch syncExpandedStates() 
    return;
  }

  // === LEAF (ROOT oder SCOPE) ===
  const colBtn = e.target.closest('button[data-col]');
  if (colBtn) {
    const activeId = colBtn.getAttribute('data-col');
    const li = colBtn.closest('.nav-item');

    // Wenn wir während eines langen Scrolls ein anderes Leaf aktivieren,
    // soll der Content wieder an den Anfang springen.
    // Nur wenn wirklich ein anderer Content aktiviert wird.
    const currentSection = document.querySelector('.collection-section.active');
    const isSameContent = !!(currentSection && currentSection.id === activeId);

    // URL: keine Jumpmark-Fragmente beibehalten
    clearUrlHash();

    // Root-Current immer eindeutig setzen
    qsa('.nav-item.is-root-current')
      .forEach(el => el.classList.remove('is-root-current', 'is-root-leaf'));

    li.classList.add('is-root-current');
    syncAriaCurrent();

    // ROOT-LEAF explizit markieren
    const hasParent = li.closest('.nav-children');
    if (!hasParent) {
      li.classList.add('is-root-leaf');
    }

    // aktives Ziel
    qsa('.nav-item.active')
      .forEach(el => el.classList.remove('active'));
    li.classList.add('active');

    // ARIA – aktives Leaf als selected markieren
    setLeafAriaSelected(colBtn);

    scrollActiveLeafIntoView(li);

    // Content wechseln
    qsa('.collection-section.active')
      .forEach(el => el.classList.remove('active'));

    const target = document.getElementById(activeId);
    if (target) target.classList.add('active');

    if (!isSameContent) {
      // erst nach DOM-Update (active-Klasse), damit die Scroll-Höhe stimmt
      requestAnimationFrame(() => scrollContentToTop('auto'));
    }

    // Startseite sofort aus dem Tab-Flow nehmen, sobald Content aktiv ist
    syncHomeVisibility();

    // Scope nur bei echten Child-Leafs
    if (hasParent) {
      enterScopeMode(li, activeId);
    } else {
      setNavState(NAV_STATE.ROOT, 'root-leaf-click');
      applyNavState();
    }
  }
});

/* ---------------------------------------------------------
   F2 Keyboard TreeView (Roving Tabindex, Arrows)
   --------------------------------------------------------- */

/*
   Ziel:
   - Tab: nur EIN Tab-Stop im Tree (roving tabindex)
   - Pfeile ↑/↓: nächster/vorheriger sichtbarer TreeItem-Button
   - Home/End: erster/letzter sichtbarer TreeItem-Button
   - →: Parent öffnen (falls zu) / in erstes Kind springen (falls offen)
   - ←: Parent schließen (falls offen) / zum Parent springen (wenn Child)
   - Enter/Space: wie Klick (Space ohne Scrollen)

   WICHTIG:
   - Gilt NUR für TreeItems (button[role="treeitem"])
   - Root-Exit / Fixed-Parent / DEV-Buttons bleiben davon unberührt
*/

(function setupNavKeyboardRoving() {

  const NAV_PANE_SEL = '.nav-pane';

  // NUR TreeItems (gemäß ARIA TreeView Markup aus index.xsl)
  const TREEITEM_BTN_SEL = `${NAV_PANE_SEL} button[role="treeitem"]`;

  function isVisible(el) {
    if (!el) return false;
    if (el.hidden) return false;
    return !!(el.offsetParent || el.getClientRects().length);
  }

  function getTreeItemButtons() {
    return Array
      .from(document.querySelectorAll(TREEITEM_BTN_SEL))
      .filter(isVisible);
  }

  function setRovingActive(activeBtn) {
    const buttons = getTreeItemButtons();
    if (!buttons.length) return;

    buttons.forEach(b => b.setAttribute('tabindex', '-1'));

    const next = activeBtn && buttons.includes(activeBtn)
      ? activeBtn
      : buttons[0];

    next.setAttribute('tabindex', '0');
  }

  function focusBtn(btn) {
    if (!btn) return;
    setRovingActive(btn);
    btn.focus({ preventScroll: true });

    const navScroll = document.querySelector('.nav-scroll');
    if (navScroll && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function getParentToggleButton(childBtn) {
    const childLi = childBtn.closest('.nav-item');
    const parentLi = childLi?.closest('.nav-children')?.closest('.nav-item');
    // Parent-Toggle ist ebenfalls TreeItem
    return parentLi ? parentLi.querySelector('button[data-nav][role="treeitem"]') : null;
  }

  function getFirstChildButton(parentToggleBtn) {
    const parentLi = parentToggleBtn?.closest('.nav-item');
    if (!parentLi) return null;

    const firstChildLi =
      parentLi.querySelector(':scope > .nav-children > .nav-item');

    // Erstes Kind-TreeItem
    return firstChildLi ? firstChildLi.querySelector('button[role="treeitem"]') : null;
  }

  // Initial: genau 1 Tab-Stop im Tree
  function init() {
    setRovingActive(null);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Wenn Fokus auf ein TreeItem geht -> roving aktualisieren
  document.addEventListener('focusin', (e) => {
    const btn = e.target.closest(TREEITEM_BTN_SEL);
    if (!btn) return;
    setRovingActive(btn);
  });

  // Arrow Keys etc. (nur für TreeItems)
  document.addEventListener('keydown', (e) => {

    const btn = e.target.closest(TREEITEM_BTN_SEL);
    if (!btn) return;

    if (e.altKey || e.ctrlKey || e.metaKey) return;

    const buttons = getTreeItemButtons();
    if (!buttons.length) return;

    const i = buttons.indexOf(btn);
    if (i === -1) return;

    const key = e.key;

    // Enter/Space: wie Klick (Space darf nicht scrollen)
    if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      btn.click();
      return;
    }

    if (key === 'ArrowDown') {
      e.preventDefault();
      focusBtn(buttons[Math.min(i + 1, buttons.length - 1)]);
      return;
    }

    if (key === 'ArrowUp') {
      e.preventDefault();
      focusBtn(buttons[Math.max(i - 1, 0)]);
      return;
    }

    if (key === 'Home') {
      e.preventDefault();
      focusBtn(buttons[0]);
      return;
    }

    if (key === 'End') {
      e.preventDefault();
      focusBtn(buttons[buttons.length - 1]);
      return;
    }

    if (key === 'ArrowRight') {
      // Parent öffnen / ins erste Kind
      const isParentToggle = btn.hasAttribute('data-nav');
      if (!isParentToggle) return;

      e.preventDefault();

      const expanded = btn.getAttribute('aria-expanded') === 'true';
      if (!expanded) {
        btn.click(); // öffnet
        const child = getFirstChildButton(btn);
        if (child) focusBtn(child);
      } else {
        const child = getFirstChildButton(btn);
        if (child) focusBtn(child);
      }
      return;
    }

    if (key === 'ArrowLeft') {
      // Parent schließen / zum Parent springen
      const isParentToggle = btn.hasAttribute('data-nav');
      if (isParentToggle) {
        e.preventDefault();
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        if (expanded) {
          btn.click(); // schließt
        }
        return;
      }

      // Child -> Parent fokussieren
      const parentBtn = getParentToggleButton(btn);
      if (parentBtn) {
        e.preventDefault();
        focusBtn(parentBtn);
      }
    }
  });

  // Nach Clicks Tab-Stop im Tree stabil halten (roving tabindex)
  // Problem: Klick kann Items verstecken → tabindex=0 landet auf unsichtbarem Element → Tab "springt weg"
  document.addEventListener('click', (e) => {
    const clicked = e.target.closest(TREEITEM_BTN_SEL);
    if (!clicked) return;

    // sofort: geklicktes Element ist der Tab-Stop
    setRovingActive(clicked);

    // nach allen Click-Handlern + DOM-Updates: Tab-Stop auf sichtbares Element korrigieren
    requestAnimationFrame(() => {
      const focused = document.activeElement?.closest?.(TREEITEM_BTN_SEL);
      if (focused && isVisible(focused)) {
        setRovingActive(focused);
        return;
      }

      const selected = document.querySelector(`${TREEITEM_BTN_SEL}[aria-selected="true"]`);
      if (selected && isVisible(selected)) {
        setRovingActive(selected);
        return;
      }

      const current = document.querySelector(`${TREEITEM_BTN_SEL}[aria-current="page"]`);
      if (current && isVisible(current)) {
        setRovingActive(current);
        return;
      }

      // Fallback: erster sichtbarer TreeItem-Button
      setRovingActive(null);
    });
  }, true);

})();

/* ---------------------------------------------------------
   F3 ESC -> Root (nur wenn Scope aktiv)
   --------------------------------------------------------- */

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && currentNavState === NAV_STATE.SCOPE) {
    enterRootMode();
  }
});
//#endregion
/* ======================== END F ========================== */

/* =========================================================
   G NAV SCROLL BEHAVIOR                                     
   ========================================================= */
//#region

/* ---------------------------------------------------------
   G1 Active-Leaf Comfort-Scrolling (center zone)
   --------------------------------------------------------- */

/*
   Ziel:
   - Aktives Leaf soll ruhig sichtbar bleiben
   - kein hartes scrollIntoView
   - nur scrollen, wenn Element außerhalb einer Komfortzone liegt
*/

function scrollActiveLeafIntoView(activeItem) {
  // Desktop: scroll container normalerweise `.nav-scroll`.
  // Mobile: `.nav-scroll` kann nicht scrollbar sein und
  // `.nav-pane` wird scrollbar.
  // Daher: pick container: TATSÄCHLICH scrollbar

  const navScroll = document.querySelector('.nav-scroll');
  const navPane = document.querySelector('.nav-pane');

  function isScrollable(el) {
    if (!el) return false;
    const cs = window.getComputedStyle(el);
    const oy = cs.overflowY;
    const canScroll = (oy === 'auto' || oy === 'scroll');
    return canScroll && (el.scrollHeight > el.clientHeight + 1);
  }

  const scrollContainer =
    (isScrollable(navScroll) ? navScroll : null) ||
    (isScrollable(navPane) ? navPane : null) ||
    navScroll ||
    navPane;

  if (!scrollContainer || !activeItem) return;

  // vorrangig tatsächliche Schaltfläche für eine stabile Geometrie
  const target =
    (activeItem.matches && activeItem.matches('button'))
      ? activeItem
      : (activeItem.querySelector && activeItem.querySelector('button[role="treeitem"]'))
        ? activeItem.querySelector('button[role="treeitem"]')
        : activeItem;

  const containerRect = scrollContainer.getBoundingClientRect();
  const itemRect = target.getBoundingClientRect();

  const containerHeight = containerRect.height;

  // Comfort zone: middle 50%
  const comfortTop = containerRect.top + containerHeight * 0.25;
  const comfortBottom = containerRect.top + containerHeight * 0.75;

  if (itemRect.top >= comfortTop && itemRect.bottom <= comfortBottom) return;

  // Convert to scrollTop coordinates
  const currentTop = scrollContainer.scrollTop;
  const itemTopInContainer = (itemRect.top - containerRect.top) + currentTop;
  const itemCenterInContainer = itemTopInContainer + itemRect.height / 2;

  const targetScrollTop = Math.max(0, itemCenterInContainer - containerHeight / 2);

  const prefersReduced =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const behavior = prefersReduced ? 'auto' : 'smooth';

  // 1) Try scrollTo with behavior
  try {
    scrollContainer.scrollTo({ top: targetScrollTop, behavior });
  } catch {
    // 2) Fallback: direct assignment
    scrollContainer.scrollTop = targetScrollTop;
  }

  // 3) Hard Fallback für Browser,
  //    die Smooth Inside Overflow Container ignorieren
  if (behavior === 'smooth') {
    requestAnimationFrame(() => {
      const r = target.getBoundingClientRect();
      if (r.top < comfortTop || r.bottom > comfortBottom) {
        scrollContainer.scrollTop = targetScrollTop;
      }
    });
  }
}
//#endregion
/* ======================== END G ========================== */

/* =========================================================
   H DEV MODE: HARDENING & UI                                
   ========================================================= */
//#region 

/* ---------------------------------------------------------
   H1 DEV-Tools hart ausblenden, wenn DEV aus
   --------------------------------------------------------- */

// ✅ Wenn data-dev="false": DEV-Tools komplett ausblenden (keine "Restanzeige")
// Patch-Typ B: nur DEV-UI, keine Nebenwirkungen für Navigation/State.
(function ensureDevToolsHiddenWhenDisabled() {

  function hide() {
    if (isDevMode()) return;

    // 1) DEV-Tools-Container (aus XSL) sicher verstecken
    const devTools = document.querySelector('.dev-tools');
    if (devTools) {
      devTools.hidden = true;
      devTools.style.display = 'none';
      devTools.setAttribute('aria-hidden', 'true');
    }

    // 2) Falls Styles aus einer vorherigen Session/Hot-Reload existieren: entfernen
    const style = document.getElementById('pf-devtools-style');
    if (style) style.remove();

    // 3) Falls stray Diagnostics/Build-Info außerhalb der Box existieren: entfernen
    document
      .querySelectorAll('.dev-build-info, .dev-diagnostics')
      .forEach(el => {
        if (!el.closest('.dev-tools')) el.remove();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hide);
  } else {
    hide();
  }

})();

/* ---------------------------------------------------------
   H2 DEV Dark/Light Toggle
   --------------------------------------------------------- */

(function setupDevDarkModeToggle() {

  if (!isDevMode()) return;

  document.addEventListener('click', e => {
    const btn = e.target.closest('.dev-dark-toggle');
    if (!btn) return;

    const html = document.documentElement;
    const isForcedDark = html.classList.contains('force-dark');
    const nextIsDark = !isForcedDark;

    // zentraler Pfad (inkl. Persistenz + Sync der Footer-Controls)
    pfSetTheme(nextIsDark ? PF_THEME.MODES.DARK : PF_THEME.MODES.LIGHT);

    // A11y: Toggle-Status explizit machen
    btn.setAttribute('aria-pressed', nextIsDark ? 'true' : 'false');

    // Label bleibt als "Aktion" (was passiert beim nächsten Klick)
    btn.textContent = nextIsDark
      ? 'DEV Light Mode'
      : 'DEV Dark Mode';

    console.log(
      `%cDEV Dark Mode ${nextIsDark ? 'ON' : 'OFF'}`,
      'color:#7aa2f7;font-weight:600'
    );
  });

})();

/* ---------------------------------------------------------
   H3 DEV Build-Info (Timestamp Anzeige)
   --------------------------------------------------------- */

/*
   Ziel:
   - deterministisch sichtbar machen, welches JS geladen wurde
   - nur im DEV-Mode anzeigen
   - ISO-8601 Timestamp (lokale Zeit)
   - Ausgabe innerhalb der DEV-Tools-Box
*/

// MANUELLER BUILD-TIMESTAMP (ISO-8601, lokale Zeit)
const BUILD_TIMESTAMP = '2026-01-04T22:08+01:00';

function renderDevBuildInfo() {
  if (!isDevMode()) return;

  const devTools = document.querySelector('.dev-tools');
  if (!devTools) return;

  // Falls ein Build-Element außerhalb existiert: in die Box holen
  const stray = document.querySelector('.dev-build-info');
  if (stray && stray !== devTools && !devTools.contains(stray)) {
    devTools.appendChild(stray);
  }

  // Build-Element erzeugen/aktualisieren
  let info = devTools.querySelector('.dev-build-info');
  if (!info) {
    info = document.createElement('div');
    info.className = 'dev-build-info';
    devTools.appendChild(info);
  }

  info.textContent = `JS-Build: ${BUILD_TIMESTAMP}`;
}

// DOM-sicher initialisieren
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderDevBuildInfo);
} else {
  renderDevBuildInfo();
}
/* ---------------------------------------------------------
   H4 DEV Diagnostics Modul (PF_DEV)
   --------------------------------------------------------- */

const PF_DEV = (function () {

  function enabled() {
    return isDevMode();
  }

  function isInDevTools(target) {
    if (!target || !target.closest) return false;

    // Nichts innerhalb der DEV-Tools-Benutzeroberfläche darf
    // Diagnose-Updates auslösen.
    // Behandle auch die DEV-Steuerungsschaltflächen als DEV-UI,
    // selbst wenn sich ihre DOM-Platzierung ändert.
    return !!(
      target.closest('.dev-tools') ||
      target.closest('.dev-selectall') ||
      target.closest('.dev-copy') ||
      target.closest('.dev-dark-toggle')
    );
  }

  // DEV: Ereignisprotokoll (schreibgeschützt) – 
  // hilft bei der Diagnose von doppelten Aktivierungen unter iOS
  const TRACE_MAX = 12;
  const trace = [];

  function fmtBtn(btn) {
    if (!btn) return '∅';
    const li = btn.closest('.nav-item');
    const id = li?.id ? `#${li.id}` : '∅';
    const label = (btn.textContent || li?.dataset?.label || '').trim();
    const col = btn.getAttribute('data-col');
    const nav = btn.getAttribute('data-nav');
    const kind = col ? `col=${col}` : (nav ? 'parent' : 'btn');
    return `${id} “${label}” (${kind})`;
  }

  function pushTrace(e, note = '') {
    // Interaktionen innerhalb der DEV-Tools-Box werden ignoriert
    if (isInDevTools(e?.target)) return;

    const t = Math.round((e?.timeStamp || performance.now()));
    const type = e?.type || 'event';
    const ptr = e?.pointerType ? ` ptr=${e.pointerType}` : '';
    const det = (typeof e?.detail === 'number') ? ` detail=${e.detail}` : '';

    const btn = e?.target?.closest?.('.nav-pane button[role="treeitem"]') || null;
    const line = `${t}ms ${type}${ptr}${det}${note ? ' ' + note : ''} → ${fmtBtn(btn)}`;

    trace.push(line);
    while (trace.length > TRACE_MAX) trace.shift();
  }

  function ensureDevToolsStyles() {
    if (!enabled()) return;
    if (document.getElementById('pf-devtools-style')) return;

    const css = `
      .dev-tools {
        position: fixed !important;
        top: auto !important;
        left: auto !important;
        right: 12px !important;
        bottom: 12px !important;
        z-index: 9999 !important;

        width: 420px;
        max-width: calc(100vw - 24px);
        box-sizing: border-box;

        /* wide + not very tall */
        max-height: 190px;
        overflow: hidden;

        padding: 12px;
        border-radius: 12px;

        background: rgba(0, 0, 0, 0.78);
        color: #ffffff;

        font-size: 12px;
        line-height: 1.35;
        text-align: left;

        box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      }

      .dev-tools,
      .dev-tools * {
        box-sizing: border-box;
      }

      .dev-tools .dev-toolbar {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        margin: 0 0 10px 0;
      }

      .dev-tools .dev-toolbar button {
        display: inline-block;
        margin: 0;
        padding: 6px 10px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.22);
        background: rgba(255,255,255,0.10);
        color: #ffffff;
        font-size: 12px;
        line-height: 1.2;
        -webkit-tap-highlight-color: transparent;
      }

      .dev-tools .dev-toolbar button:focus-visible {
        outline: 2px solid rgba(255,255,255,0.55);
        outline-offset: 2px;
      }

      /* Diagnostics: copy-friendly (textarea) + scrollbar */
      .dev-tools .dev-diagnostics {
        margin: 0 0 8px 0;
        padding: 8px 10px;
        border-radius: 10px;

        background: rgba(255,255,255,0.10);
        border: 1px solid rgba(255,255,255,0.14);

        color: #ffffff;
        display: block;
        width: 100%;

        text-align: left;
        direction: ltr;

        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 12px;
        line-height: 1.35;

        height: 96px;
        max-height: 96px;
        overflow: auto;

        resize: vertical;
        outline: none;
      }

      .dev-tools .dev-build-info {
        margin-top: 0;
        opacity: 0.9;
        color: #ffffff;
        font-size: 12px;
        text-align: left;
      }

      @media (max-width: 420px) {
        .dev-tools {
          width: calc(100vw - 24px);
          max-height: 175px;
        }
        .dev-tools .dev-diagnostics {
          height: 84px;
          max-height: 84px;
        }
      }
    `;

    const style = document.createElement('style');
    style.id = 'pf-devtools-style';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureToolbar(devTools) {
    if (!devTools) return null;

    let bar = devTools.querySelector('.dev-toolbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'dev-toolbar';
      devTools.insertBefore(bar, devTools.firstChild);
    }

    // Dark toggle in die Symbolleiste verschieben (falls vorhanden)
    const darkBtn = devTools.querySelector('.dev-dark-toggle');
    if (darkBtn && darkBtn.parentElement !== bar) {
      bar.appendChild(darkBtn);
    }

    // Select all button
    let selBtn = devTools.querySelector('.dev-selectall');
    if (!selBtn) {
      selBtn = document.createElement('button');
      selBtn.type = 'button';
      selBtn.className = 'dev-selectall';
      selBtn.textContent = 'Select all';
      selBtn.setAttribute('aria-label', 'Select all diagnostics');
      bar.appendChild(selBtn);
    }

    // Copy button
    let copyBtn = devTools.querySelector('.dev-copy');
    if (!copyBtn) {
      copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'dev-copy';
      copyBtn.textContent = 'Copy';
      copyBtn.setAttribute('aria-label', 'Copy diagnostics');
      bar.appendChild(copyBtn);
    }

    return { bar, selBtn, copyBtn };
  }

  function ensureDiagnosticsEl() {
    const devTools = document.querySelector('.dev-tools');
    if (!devTools) return null;

    // Sicherstellen, dass die Symbolleiste vorhanden ist
    // (und die Schaltflächen vorhanden sind)
    ensureToolbar(devTools);

    // Falls sich ein Diagnoseelement außerhalb befindet:
    // in die Box verschieben
    const stray = document.querySelector('.dev-diagnostics');
    if (stray && stray !== devTools && !devTools.contains(stray)) {
      devTools.appendChild(stray);
    }

    let el = devTools.querySelector('.dev-diagnostics');
    if (!el) {
      el = document.createElement('textarea');
      el.className = 'dev-diagnostics';
      el.setAttribute('aria-label', 'Diagnostics');
      el.setAttribute('readonly', '');
      el.readOnly = true;
      el.setAttribute('spellcheck', 'false');
      el.setAttribute('wrap', 'off');

      // Einfügen vor build info (falls vorhanden)
      const build = devTools.querySelector('.dev-build-info');
      if (build) {
        devTools.insertBefore(el, build);
      } else {
        devTools.appendChild(el);
      }
    } else {
      // sicherstellen, dass es schreibgeschützt bleibt.
      el.setAttribute('readonly', '');
      el.readOnly = true;
    }

    // Verhindern, dass Navigationshandler Interaktionen
    // innerhalb der Diagnose sehen. (iOS-Auswahl/Kopieren
    // löst Touch-/Zeiger-/Klick-Sequenzen aus)
    const stop = (ev) => { ev.stopPropagation(); };

    if (!el.dataset.devStopprop) {
      ['click', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'touchcancel']
        .forEach(type => el.addEventListener(type, stop, true));
      el.dataset.devStopprop = '1';
    }

    return el;
  }

  function labelOf(li) {
    if (!li) return '';
    const btn = li.querySelector('button[role="treeitem"]');
    const txt = (btn?.textContent || li.dataset?.label || '').trim();
    return txt;
  }

  function summarize(selector, kind) {
    const items = Array.from(document.querySelectorAll(selector));
    if (!items.length) return `${kind}(0)`;

    const first = items[0];
    const id = first.id ? `#${first.id}` : '';
    const label = labelOf(first);

    return `${kind}(${items.length})=[${id} “${label}”]`;
  }

  function updateDiagnostics(reason = '') {
    if (!enabled()) return;

    const el = ensureDiagnosticsEl();
    if (!el) return;

    // Scrollposition beibehalten,
    // wenn der Benutzer gerade mit dem Textbereich interagiert.
    const keepScroll = (document.activeElement === el);
    const prevScrollTop = el.scrollTop;

    const lines = [];

    lines.push(reason ? `Diagnostics (${reason})` : 'Diagnostics');
    lines.push(`navState=${currentNavState}`);
    lines.push(summarize('.nav-item.active', 'active'));
    lines.push(summarize('.nav-item.is-root-current', 'rootCurrent'));

    const selectedBtns = Array.from(
      document.querySelectorAll('.nav-pane button[role="treeitem"][data-col][aria-selected="true"]')
    );

    if (!selectedBtns.length) {
      lines.push('selected(0)');
    } else {
      const btn = selectedBtns[0];
      const li = btn.closest('.nav-item');
      const id = li?.id ? `#${li.id}` : '';
      const label = (btn.textContent || li?.dataset?.label || '').trim();
      lines.push(`selected(${selectedBtns.length})=[${id} “${label}”]`);
    }

    lines.push(`activeContent=${currentActiveId || '∅'}`);

    if (trace.length) {
      lines.push('');
      lines.push('events(last):');
      trace.slice(-TRACE_MAX).forEach(l => lines.push('  ' + l));
    }

    el.value = lines.join('\n');

    if (keepScroll) {
      el.scrollTop = prevScrollTop;
    }
  }

  function wireCopyButtons() {
    const devTools = document.querySelector('.dev-tools');
    if (!devTools) return;

    const el = ensureDiagnosticsEl();
    if (!el) return;

    const selBtn = devTools.querySelector('.dev-selectall');
    const copyBtn = devTools.querySelector('.dev-copy');

    function selectAll() {
      try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
      el.select();
      // iOS: expliziter Bereich verbessert die Zuverlässigkeit
      try { el.setSelectionRange(0, el.value.length); } catch (_) { }
      // Explizit signalisieren:
      // ausschließlich für Entwickler bestimmte UI-Aktion.
      return false;
    }

    if (selBtn && !selBtn.dataset.bound) {
      selBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        selectAll();
      }, true);
      selBtn.dataset.bound = '1';
    }

    if (copyBtn && !copyBtn.dataset.bound) {
      copyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const text = el.value || '';
        if (!text) return;

        // Modern clipboard API
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          try {
            await navigator.clipboard.writeText(text);
            return;
          } catch (_) {
            // fall through
          }
        }

        // Fallback: select + execCommand
        selectAll();
        try { document.execCommand('copy'); } catch (_) { }
      }, true);
      copyBtn.dataset.bound = '1';
    }
  }

  function onStateChange(from, to, reason, data) {
    if (!enabled()) return;

    console.groupCollapsed(
      `%cNAV STATE: ${from} → ${to}`,
      'color:#7aa2f7;font-weight:600'
    );
    console.log('reason:', reason);
    console.log(data);
    console.groupEnd();

    pushTrace(
      { type: 'state', timeStamp: performance.now(), target: document.querySelector('.nav-pane') },
      ` ${from}→${to}`
    );
    updateDiagnostics(reason || 'state-change');
  }

  // DEV: nach relevanten Interaktionen Diagnostics aktualisieren
  function initDiagnosticsHooks() {
    if (!enabled()) return;

    ensureDevToolsStyles();
    ensureDiagnosticsEl();
    wireCopyButtons();

    updateDiagnostics('init');

    // Clicks/Touches (read-only) — IMPORTANT: ignore events inside dev-tools
    document.addEventListener('click', (e) => {
      if (isInDevTools(e.target)) return;
      if (e.target.closest && e.target.closest('.dev-selectall, .dev-copy')) return;
      pushTrace(e);
      requestAnimationFrame(() => updateDiagnostics('click'));
    }, true);

    document.addEventListener('touchstart', (e) => {
      if (isInDevTools(e.target)) return;
      if (e.target.closest && e.target.closest('.dev-selectall, .dev-copy')) return;
      pushTrace(e);
    }, { passive: true, capture: true });

    document.addEventListener('touchend', (e) => {
      if (isInDevTools(e.target)) return;
      if (e.target.closest && e.target.closest('.dev-selectall, .dev-copy')) return;
      pushTrace(e);
      requestAnimationFrame(() => updateDiagnostics('touchend'));
    }, { passive: true, capture: true });

    document.addEventListener('touchcancel', (e) => {
      if (isInDevTools(e.target)) return;
      if (e.target.closest && e.target.closest('.dev-selectall, .dev-copy')) return;
      pushTrace(e);
      requestAnimationFrame(() => updateDiagnostics('touchcancel'));
    }, { passive: true, capture: true });

    document.addEventListener('pointerdown', (e) => {
      if (isInDevTools(e.target)) return;
      if (e.target.closest && e.target.closest('.dev-selectall, .dev-copy')) return;
      pushTrace(e);
    }, { passive: true, capture: true });

    document.addEventListener('pointerup', (e) => {
      if (isInDevTools(e.target)) return;
      if (e.target.closest && e.target.closest('.dev-selectall, .dev-copy')) return;
      pushTrace(e);
    }, { passive: true, capture: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDiagnosticsHooks);
  } else {
    initDiagnosticsHooks();
  }

  return { onStateChange };
})();
// #endregion
/* ======================== END H ========================== */

/* =========================================================
   J CONTENT FEATURES                                       
   ========================================================= */
//#region 

/* ---------------------------------------------------------
   J1 Entry-Trail: lokal SHORT -> FULL (einmalig)
   --------------------------------------------------------- */

/*
   Ziel:
   - Klick auf […] schaltet EINEN Entry von SHORT auf FULL
   - kein Toggle, kein Rückweg
   - Steuerung ausschließlich über Klassen
   - keine DOM-Strukturänderung
   - keine Abhängigkeit von Navigation oder Startparametern
*/

(function () {

  function initEntryTrailExpand() {
    const expandButtons =
      document.querySelectorAll('.entry-trail-toggle');

    expandButtons.forEach(button => {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();

        const entry =
          button.closest('.entry');

        if (!entry) return;

        // Entry dauerhaft auf FULL setzen
        entry.classList.add('is-full');
      });
    });
  }

  // Initialisierung nach DOM-Aufbau
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initEntryTrailExpand
    );
  } else {
    initEntryTrailExpand();
  }

})();

/* ---------------------------------------------------------
   J2 Global Trail Mode (SHORT|FULL + sessionStorage)
   --------------------------------------------------------- */

/*
   Ziel:
   - globaler Modus für alle Entry-Trails
   - SHORT | FULL per Segment-Control
   - Sitzungs-Persistenz via sessionStorage
   - globaler Modus ist die alleinige Wahrheit
   - beim Moduswechsel werden lokale Entry-States verworfen

   A11y / UX:
   - Tab soll auf die „Aktion“ gehen (die NICHT aktuelle Option).
     -> current (aria-pressed="true") ist visuell grau und NICHT im Tab-Flow
     -> action (aria-pressed="false") ist link-styled und EINZIGER Tab-Stop
   - Nach Toggle bleibt Fokus auf der neuen Aktion (also wieder aria-pressed="false").
*/

(function () {

  const STORAGE_KEY = 'pf.trailMode';
  const MODES = {
    SHORT: 'short',
    FULL: 'full'
  };

  const normalize = v => String(v || '').trim().toLowerCase();

  // === Helpers ===

  function clearEntryOverrides() {
    document
      .querySelectorAll('.entry.is-full')
      .forEach(entry => entry.classList.remove('is-full'));
  }

  function updateControls(activeMode) {

    const wanted = normalize(activeMode);

    document
      .querySelectorAll('.trail-mode-segment')
      .forEach(seg => {

        const buttons = Array.from(seg.querySelectorAll('button[data-mode]'));
        if (!buttons.length) return;

        // 1) pressed-Status setzen
        buttons.forEach(btn => {
          const mode = normalize(btn.dataset.mode);
          const isCurrent = (mode && mode === wanted);

          btn.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');

          // Optional: SR-Hinweis (kein visuelles Styling nötig)
          // Current ist „ausgewählt“, Action ist „wählbar“
          btn.setAttribute('aria-disabled', isCurrent ? 'true' : 'false');
        });

        // 2) Tab-Stop auf die Aktion (aria-pressed="false")
        const currentBtn = seg.querySelector('button[aria-pressed="true"]');
        const actionBtn = seg.querySelector('button[aria-pressed="false"]');

        if (currentBtn) currentBtn.setAttribute('tabindex', '-1');
        if (actionBtn) actionBtn.setAttribute('tabindex', '0');

        // Fallback (sollte nicht passieren): mindestens EIN Button tabbable
        if (!actionBtn) {
          buttons.forEach((b, i) => b.setAttribute('tabindex', i === 0 ? '0' : '-1'));
        }
      });
  }

  function setGlobalMode(mode, focusContextEl = null) {

    const next = normalize(mode) || MODES.SHORT;

    clearEntryOverrides();

    document.body.classList.toggle('trail-mode-full', next === MODES.FULL);
    document.body.classList.toggle('trail-mode-short', next === MODES.SHORT);

    sessionStorage.setItem(STORAGE_KEY, next);
    updateControls(next);

    // Fokus IM Segment sauber auf die neue Aktion legen (nur wenn wir aus dem Segment kamen)
    const seg = focusContextEl ? focusContextEl.closest('.trail-mode-segment') : null;
    if (seg) {
      const actionBtn = seg.querySelector('button[aria-pressed="false"]');
      if (actionBtn) {
        requestAnimationFrame(() => actionBtn.focus({ preventScroll: true }));
      }
    }
  }

  function getInitialMode() {
    return normalize(sessionStorage.getItem(STORAGE_KEY)) || MODES.SHORT;
  }

  // === Init === 

  function initGlobalTrailMode() {

    const buttons = Array.from(document.querySelectorAll('.trail-mode-segment button[data-mode]'));
    if (!buttons.length) return;

    setGlobalMode(getInitialMode());

    buttons.forEach(btn => {

      // Click: nur die Aktion soll etwas tun (current ist sowieso „grau“)
      btn.addEventListener('click', e => {
        e.preventDefault();

        const isCurrent = (btn.getAttribute('aria-pressed') === 'true');
        if (isCurrent) return;

        const mode = btn.dataset.mode;
        if (!mode) return;

        setGlobalMode(mode, btn);
      });

      // Keyboard: Pfeile togglen (im Segment bleiben)
      btn.addEventListener('keydown', (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;

        const key = e.key;
        if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;

        e.preventDefault();

        // Bei 2 Optionen ist ArrowLeft/Right = Toggle:
        // -> einfach die Aktion auslösen (falls wir gerade auf current landen sollten)
        const seg = btn.closest('.trail-mode-segment');
        if (!seg) return;

        const actionBtn = seg.querySelector('button[aria-pressed="false"]');
        if (actionBtn) actionBtn.click();
      });

    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobalTrailMode);
  } else {
    initGlobalTrailMode();
  }

})();

/* ---------------------------------------------------------
   J3 "Fehlerhinweis senden" (mailto, Kontext aus DOM)
   --------------------------------------------------------- */

/* 
   - erzeugt eine vorbefüllte Plain-Text-Mail
   - nutzt ausschließlich sichtbaren DOM-Kontext
   - KEINE UI-, Struktur- oder CSS-Abhängigkeiten
   - Mail ist vor dem Absenden editierbar
*/

document.addEventListener('click', function (event) {
  const link = event.target.closest('.trail-meta a');
  if (!link) return;

  // Nur explizit für "Fehlerhinweis senden"
  if (!link.textContent.includes('Fehlerhinweis')) return;

  event.preventDefault();

  // === Kontext sammeln (rein lesend) ===

  // Aktive Collection
  const activeCollection = document.querySelector('.collection-section.active');

  // H2 – Collection-Titel
  const h2 = activeCollection
    ? activeCollection.querySelector('.collection-header h2')
    : null;
  const h2Text = h2 ? h2.textContent.trim() : '(keine Sammlung)';

  // Entry-Kontext
  const entry = link.closest('.entry');

  // H3 – optionaler Entry-Titel
  const h3 = entry ? entry.querySelector('.entry-title') : null;
  const h3Text = h3
    ? h3.textContent.trim()
    : '(kein Abschnittstitel)';

  // FULL-Trail (nur Text, ohne HTML)
  const fullTrail = entry
    ? entry.querySelector('.entry-trail-full')
    : null;
  const trailText = fullTrail
    ? fullTrail.textContent.replace(/\s+/g, ' ').trim()
    : '(kein Pfad verfügbar)';

  // === Mail zusammenbauen ===

  const mailTo = 'olaf.nensel@arbeitsagentur.de';
  const subject = 'Pfadfinder – Fehlerhinweis';

  const body = [
    'Hallo Pfadfinder-Entwickler,',
    '',
    'der folgende Link führt nicht zu der erwarteten Seite:',
    '',
    'Bereich:',
    h2Text,
    '',
    'Eintrag:',
    h3Text,
    '',
    'Pfad:',
    trailText,
    '',
    'Vielen Dank!'
  ].join('\n');

  const mailtoUrl =
    'mailto:' + encodeURIComponent(mailTo) +
    '?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(body);

  // === Mail-Client öffnen ===

  window.location.href = mailtoUrl;
});

/* ---------------------------------------------------------
   J4 Mini-Backlink nach Jumpmark + Fokus-Return
   --------------------------------------------------------- */

/*
   Ziel:
   - nach Jumpmark-Navigation kontextuellen Rücksprung anbieten
   - Rücksprung:
       Desktop → Scroll-Container (main)
       Mobile  → Dokument (window)
   - KEIN Zurück-Scroll zur Jumpmark
   - Fokus kehrt zur zuletzt genutzten Jumpmark zurück (A11y)
   - Event-Delegation, keine Inline-Styles

   Fixes:
   - Jumpmarks können auf innere Elemente zeigen
   - Mini-Backlink kann via aria-hidden / hidden versteckt sein
     → aktiver Zustand gewinnt immer
*/

(function () {

  // Merkt die zuletzt ausgelöste Jumpmark (DOM-Referenz)
  let lastJumpmarkEl = null;

  // === Helper ===

  function getMain() {
    return document.querySelector('main');
  }

  function getActiveSection() {
    const main = getMain();
    if (!main) return null;
    return main.querySelector('.collection-section.active') || main;
  }

  function getPageTopTarget() {
    const scope = getActiveSection();
    if (!scope) return null;

    return scope.querySelector(
      '.jumpmarks a[href], .jumpmarks a, a[href], button:not([disabled])'
    );
  }

  function resetMiniBacklinks() {
    document
      .querySelectorAll('.entry-mini-backlink.is-active')
      .forEach(link => {
        link.classList.remove('is-active');
        link.setAttribute('aria-hidden', 'true');
        link.setAttribute('hidden', '');
      });
  }

  function activateMiniBacklink(entry) {
    if (!entry) return;

    const backlink = entry.querySelector('.entry-mini-backlink');
    if (!backlink) return;

    resetMiniBacklinks();

    backlink.classList.add('is-active');
    backlink.removeAttribute('aria-hidden');
    backlink.removeAttribute('hidden');
    backlink.hidden = false;
  }

  // === Fokus nach Jumpmark (A11y) ===
  // Problem (aktueller Bug): Jumpmark scrollt zwar, aber der Tastaturfokus
  // bleibt auf dem Link → Tab springt dann zum nächsten Jumpmark.
  // Lösung: Nach dem Scroll den Fokus auf das Ziel (Entry/Heading) setzen.

  function isNaturallyFocusable(el) {
    if (!el || el.nodeType !== 1) return false;
    const name = el.tagName.toLowerCase();
    if (name === 'a') return el.hasAttribute('href');
    if (['button', 'input', 'select', 'textarea', 'summary'].includes(name)) return !el.disabled;
    if (el.hasAttribute('contenteditable')) return true;
    const tabindex = el.getAttribute('tabindex');
    if (tabindex !== null) return tabindex !== '-1' || el.matches('[tabindex="-1"]');
    return false;
  }

  function focusJumpTarget(targetEl, entry) {
    const focusCandidate =
      (isNaturallyFocusable(targetEl) ? targetEl : null) ||
      (entry && entry.querySelector && entry.querySelector('.entry-title, h1, h2, h3, h4')) ||
      entry ||
      targetEl;

    if (!focusCandidate || typeof focusCandidate.focus !== 'function') return;

    // Wenn das Element nicht fokussierbar ist: tabindex=-1 setzen (nicht im Tab-Flow)
    if (!isNaturallyFocusable(focusCandidate) && !focusCandidate.hasAttribute('tabindex')) {
      focusCandidate.setAttribute('tabindex', '-1');
    }

    try {
      focusCandidate.focus({ preventScroll: true });
    } catch (_) {
      // Safari/ältere Browser
      focusCandidate.focus();
    }
  }

  // === Jumpmark → Mini-Backlink aktivieren ===
  document.addEventListener('click', function (event) {
    const jumpmark = event.target.closest('.jumpmarks a');
    if (!jumpmark) return;

    const href = jumpmark.getAttribute('href');
    if (!href || !href.startsWith('#')) return;

    // Browser-Default verhindern (würde #... in die URL schreiben)
    event.preventDefault();

    // URL soll NICHT verändert werden (kein #entry-id...)
    clearUrlHash();

    lastJumpmarkEl = jumpmark;

    const targetId = href.slice(1);
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;

    // Scrollen ohne URL-Fragment
    scrollToJumpTarget(targetEl);

    const entry =
      targetEl.classList.contains('entry')
        ? targetEl
        : targetEl.closest('.entry');

    if (!entry) return;

    activateMiniBacklink(entry);
    focusJumpTarget(targetEl, entry);
  });

  // === Keyboard: Space wie Klick behandeln ===
  document.addEventListener('keydown', function (event) {
    if (event.key !== ' ') return;

    const link = event.target.closest(
      '.jumpmarks a, .entry-mini-backlink'
    );
    if (!link) return;

    event.preventDefault();
    link.click();
  });

  // === Mini-Backlink → Scroll + Fokus (VARIANTE A) ===
  document.addEventListener('click', function (event) {
    const backlink = event.target.closest('.entry-mini-backlink');
    if (!backlink || !backlink.classList.contains('is-active')) return;

    event.preventDefault();

    // Desktop: Content scrollt in `.page-scroll` (nicht im window).
    // Mobile: häufig window/document.
    // Deshalb: den echten Scroll-Container über den zentralen Helper ermitteln.
    const prefersReduced =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    scrollContentToTop(prefersReduced ? 'auto' : 'smooth');

    // Fokus zurück zur zuletzt genutzten Jumpmark
    const activeScope = getActiveSection();
    const canUseLast =
      lastJumpmarkEl &&
      document.contains(lastJumpmarkEl) &&
      lastJumpmarkEl.matches('.jumpmarks a') &&
      (!activeScope || activeScope.contains(lastJumpmarkEl));

    const focusTarget =
      canUseLast ? lastJumpmarkEl : getPageTopTarget();

    if (focusTarget) {
      requestAnimationFrame(() => {
        focusTarget.focus({ preventScroll: true });
      });
    }

    resetMiniBacklinks();
  });

  // === Navigation / Root / ESC → Reset ===
  document.addEventListener('click', function (event) {
    if (
      event.target.closest('button[data-col]') ||
      event.target.closest('.nav-root-button')
    ) {
      resetMiniBacklinks();
      lastJumpmarkEl = null;
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      resetMiniBacklinks();
      lastJumpmarkEl = null;
    }
  });

})();
// #endregion
/* ======================== END J ========================== */