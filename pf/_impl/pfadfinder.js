/* ======================================================================
   PFADFINDER – NAVIGATION ARCHITEKTUR
   PATCH 12 – ROOT-CURRENT & ROOT-LEAF STATE
   ====================================================================== */

/* ======================================================================
   [BLOCK 1] DEV-GATE (HELPER)
   ====================================================================== */

function isDevMode() {
  return document.body?.dataset?.dev === 'true';
}

/* ============================ END BLOCK 1 ============================ */


/* ======================================================================
   [BLOCK 2] NAVIGATION STATES (HELPER)
   ====================================================================== */

const NAV_STATE = {
  ROOT: 'root',
  SCOPE: 'scope'
};

let currentNavState = NAV_STATE.ROOT;
let currentActiveId = null;
let currentScopeParent = null;

/* ============================ END BLOCK 2 ============================ */


/* ======================================================================
   [BLOCK 3] DOM HELPERS (HELPER)
   ====================================================================== */

const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ============================ END BLOCK 3 ============================ */

/* ======================================================================
   [BLOCK 3a] START PARAM HANDLING (start=...)
   ====================================================================== */

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

  /* 🔑 Verzögert ausführen, damit alle Click-Handler existieren */
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

/* ============================ END BLOCK 3a ============================ */

/* ======================================================================
   [BLOCK 3b] HOME START BUTTONS (Startseite → gleicher Selektionspfad)
   ====================================================================== */

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

        // ✅ Fokus defensiv in der Navigation halten (Safari/Browser können sonst „zurückspringen“)
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


/* ======================================================================
   [BLOCK 3bb] HOME VISIBILITY (avoid focus-loss on Tab)
   ====================================================================== */

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

/* ============================ END BLOCK 3bb ============================ */

/* ======================================================================
   [BLOCK 3c] ARIA HELPERS – aria-expanded sync (Parents)
   ====================================================================== */

function syncExpandedStates() {
  // ✅ Hart erzwingen: aria-expanded NUR bei Parent-TreeItems (data-nav)
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

/* ============================ END BLOCK 3c ============================ */

/* ======================================================================
   [BLOCK 3d] ARIA HELPERS – aria-current sync (exactly one)
   ====================================================================== */

/*
   Ziel:
   - Im Tree gibt es genau EIN aria-current="page"
   - Quelle der Wahrheit bleibt deine Klasse: .nav-item.is-root-current
*/

function clearAriaCurrent() {
  // ✅ nur TreeItems, keine Root/Dev Buttons
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

/* ============================ END BLOCK 3d ============================ */

/* ======================================================================
   [BLOCK 4] FIXED PARENT (SCOPE MIRROR)
   ====================================================================== */

/* ======================================================================
   [BLOCK 4] FIXED PARENT (SCOPE MIRROR)
   ====================================================================== */

const fixedParentEl = () => qs('.nav-fixed-parent');
const fixedParentBtn = () => qs('.nav-fixed-parent-button');

function showFixedParent(parentItem) {
  const wrap = fixedParentEl();
  const btn = fixedParentBtn();
  if (!wrap || !btn || !parentItem) return;

  const labelBtn = parentItem.querySelector('button');
  const label = (labelBtn?.textContent || '').trim();
  if (!label) return;

  // Sichtbar: nur der Parent-Name
  btn.textContent = label;

  // Screenreader: Aktion + Ziel (Fixed-Parent ist NICHT Teil des Trees)
  btn.setAttribute('aria-label', `Zurück zu „${label}“`);

  wrap.hidden = false;
}

function hideFixedParent() {
  const wrap = fixedParentEl();
  const btn = fixedParentBtn();

  if (btn) {
    btn.textContent = '';
    btn.removeAttribute('aria-label');
  }

  if (wrap) wrap.hidden = true;
}

/* Klick auf Fixed Parent → ROOT */
document.addEventListener('click', e => {
  if (e.target.closest('.nav-fixed-parent-button')) {
    enterRootMode();
  }
});

/* ============================ END BLOCK 4 ============================ */


/* ======================================================================
   [BLOCK 5] STATE HANDLING
   ====================================================================== */

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

/* ============================ END BLOCK 5 ============================ */

/* ======================================================================
   [BLOCK 6]
   ====================================================================== */
function enterRootMode() {

  // Nur beim Wechsel SCOPE → ROOT nach oben scrollen (sonst springt die Nav bei Parent-Toggles)
  const shouldScrollToTop = (currentNavState === NAV_STATE.SCOPE);

  /* aria-expanded nur SYNCHRONISIEREN (nicht einklappen) */
  syncExpandedStates();

  syncAriaCurrent();

  /* Scope-spezifische Markierungen entfernen */
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

  /* ARIA – keine Auswahl im Tree */
  clearLeafAriaSelected();

  setNavState(NAV_STATE.ROOT, 'enterRootMode');
  applyNavState();

  const navScroll = qs('.nav-scroll');
  if (shouldScrollToTop && navScroll) navScroll.scrollTop = 0;
}

/* ============================ END BLOCK 6 ========================== */

/* ======================================================================
   [BLOCK 7] SCOPE MODE (NO DOM RE-PARENTING)
   ====================================================================== */

function enterScopeMode(activeLeafItem, activeId) {
  if (!activeLeafItem || !activeId) return;

  const parentItem =
    activeLeafItem.closest('.nav-children')?.closest('.nav-item');
  if (!parentItem) return;

  /* Root-Current (persistent, genau einer) */
  qsa('.nav-item.is-root-current')
    .forEach(li => li.classList.remove('is-root-current'));
  parentItem.classList.add('is-root-current');
  syncAriaCurrent();

  /* Root-Active (Scope-spezifisch) */
  parentItem.classList.add('is-root-active');

  currentActiveId = activeId;
  currentScopeParent = parentItem;

  /* temporäre Zustände zurücksetzen */
  qsa('.nav-item').forEach(li => {
    li.classList.remove(
      'is-hidden',
      'is-scope-parent',
      'is-scope-leaf',
      'active'
    );
  });

  /* Parent markieren */
  parentItem.classList.add('is-scope-parent');

  /* Alle direkten Leafs markieren */
  qsa(':scope > .nav-children > .nav-item', parentItem)
    .forEach(li => li.classList.add('is-scope-leaf'));

  /* Aktives Leaf */
  activeLeafItem.classList.add('active');

  /* Aktives Leaf sanft ins Blickfeld bringen */
  scrollActiveLeafIntoView(activeLeafItem);

  /* Alles außerhalb des Scopes ausblenden */
  qsa('.nav-item').forEach(li => {
    if (li !== parentItem && !parentItem.contains(li)) {
      li.classList.add('is-hidden');
    }
  });

  showFixedParent(parentItem);

  setNavState(NAV_STATE.SCOPE, 'enterScopeMode');
  applyNavState();
}

/* ============================ END BLOCK 7 ============================ */

/* ======================================================================
   [BLOCK 8.0] TreeView – Selection Sync (Leafs)
   ====================================================================== */

/* Ziel:
   - genau ein Leaf ist aria-selected="true"
   - alle anderen Leafs aria-selected="false"
   - Root-Mode cleart Selection
*/
function clearLeafAriaSelected() {
  // ✅ aria-selected NUR für Leafs (TreeItems mit data-col)
  // 1) Falls irgendwo versehentlich gesetzt: von Nicht-Leaf-TreeItems entfernen
  qsa('.nav-pane button[role="treeitem"]:not([data-col])[aria-selected]')
    .forEach(btn => btn.removeAttribute('aria-selected'));

  // 2) Leafs immer auf "false" setzen (einheitlicher Ausgangszustand)
  qsa('.nav-pane button[role="treeitem"][data-col]')
    .forEach(btn => btn.setAttribute('aria-selected', 'false'));
}

function setLeafAriaSelected(activeBtn) {
  // ✅ nur Leafs dürfen selected sein
  if (!activeBtn) return;
  if (!activeBtn.matches('.nav-pane button[role="treeitem"][data-col]')) return;

  clearLeafAriaSelected();
  activeBtn.setAttribute('aria-selected', 'true');
}
/* ========================= END BLOCK 8.0 ============================== */

/* ======================================================================
   [BLOCK 8] CLICK HANDLER (ROOT + SCOPE LOGIC)
   ====================================================================== */

document.addEventListener('click', e => {

  /* --------------------------------------------------------------
     ROOT-EXIT
     -------------------------------------------------------------- */
  if (e.target.closest('.nav-root-button')) {
    enterRootMode();
    return;
  }

  /* --------------------------------------------------------------
     ROOT-PARENT (Toggle)
     -------------------------------------------------------------- */
  const navBtn = e.target.closest('button[data-nav]');
  if (navBtn) {
    const li = navBtn.closest('.nav-item');

    /* Root-Current neu setzen */
    qsa('.nav-item.is-root-current')
      .forEach(el => el.classList.remove('is-root-current', 'is-root-leaf'));

    li.classList.add('is-root-current');
    syncAriaCurrent();
    li.classList.remove('is-root-leaf'); // Parent ≠ Leaf

    /* andere Parents schließen */
    qsa('.nav-item.open').forEach(el => {
      if (el !== li) {
        el.classList.remove('open');
        const b = qs('button[data-nav]', el);
        if (b) b.setAttribute('aria-expanded', 'false');
      }
    });

    const expanded = li.classList.toggle('open');

    /* aria-expanded als String setzen */
    navBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');

    enterRootMode(); /* macht auch syncExpandedStates() */
    return;
  }

  /* --------------------------------------------------------------
     LEAF (ROOT oder SCOPE)
     -------------------------------------------------------------- */
  const colBtn = e.target.closest('button[data-col]');
  if (colBtn) {
    const activeId = colBtn.getAttribute('data-col');
    const li = colBtn.closest('.nav-item');

    /* Root-Current immer eindeutig setzen */
    qsa('.nav-item.is-root-current')
      .forEach(el => el.classList.remove('is-root-current', 'is-root-leaf'));

    li.classList.add('is-root-current');
    syncAriaCurrent();

    /* ROOT-LEAF explizit markieren */
    const hasParent = li.closest('.nav-children');
    if (!hasParent) {
      li.classList.add('is-root-leaf');
    }

    /* aktives Ziel */
    qsa('.nav-item.active')
      .forEach(el => el.classList.remove('active'));
    li.classList.add('active');

    /* ARIA – aktives Leaf als selected markieren */
    setLeafAriaSelected(colBtn);

    scrollActiveLeafIntoView(li);

    /* Content wechseln */
    qsa('.collection-section.active')
      .forEach(el => el.classList.remove('active'));

    const target = document.getElementById(activeId);
    if (target) target.classList.add('active');

    // Startseite sofort aus dem Tab-Flow nehmen, sobald Content aktiv ist
    syncHomeVisibility();

    /* Scope nur bei echten Child-Leafs */
    if (hasParent) {
      enterScopeMode(li, activeId);
    } else {
      setNavState(NAV_STATE.ROOT, 'root-leaf-click');
      applyNavState();
    }
  }
});

/* ============================ END BLOCK 8 ============================ */

/* ======================================================================
   [BLOCK 8a] NAV KEYBOARD (Arrow Keys + Roving Tabindex)
   ====================================================================== */
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

  // ✅ NUR TreeItems (gemäß ARIA TreeView Markup aus index.xsl)
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

  // ✅ Nach Clicks Tab-Stop im Tree stabil halten (roving tabindex)
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

/* ============================ END BLOCK 8a ============================ */

/* ======================================================================
   [BLOCK 9] ESC → ROOT
   ====================================================================== */

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && currentNavState === NAV_STATE.SCOPE) {
    enterRootMode();
  }
});
/* ============================ END BLOCK 9 ============================ */

/* ======================================================================
   [BLOCK 10] NAV SCROLL – ACTIVE LEAF CENTERING
   ====================================================================== */

/*
   Ziel:
   - Aktives Leaf soll ruhig sichtbar bleiben
   - kein hartes scrollIntoView
   - nur scrollen, wenn Element außerhalb einer Komfortzone liegt
   - Apple-like Verhalten
*/

function scrollActiveLeafIntoView(activeItem) {
  const scrollContainer = document.querySelector('.nav-scroll');
  if (!scrollContainer || !activeItem) return;

  const containerRect = scrollContainer.getBoundingClientRect();
  const itemRect = activeItem.getBoundingClientRect();

  const containerHeight = containerRect.height;

  /* Komfortzone: mittlere 50 % */
  const comfortTop = containerRect.top + containerHeight * 0.25;
  const comfortBottom = containerRect.top + containerHeight * 0.75;

  /* Item liegt vollständig innerhalb der Komfortzone → nichts tun */
  if (itemRect.top >= comfortTop && itemRect.bottom <= comfortBottom) {
    return;
  }

  /* Zielposition: Item sanft Richtung Mitte bewegen */
  const itemCenter =
    itemRect.top + itemRect.height / 2;

  const containerCenter =
    containerRect.top + containerHeight / 2;

  const delta =
    itemCenter - containerCenter;

  scrollContainer.scrollBy({
    top: delta,
    behavior: 'smooth'
  });
}

/* ============================ END BLOCK 10 ============================ */

/* ======================================================================
   ======================================================================
   DEV-SECTION
   ======================================================================
   ====================================================================== */

/* ======================================================================
   [BLOCK 11] DEV DARK MODE TOGGLE
   ====================================================================== */

(function setupDevDarkModeToggle() {

  if (!isDevMode()) return;

  document.addEventListener('click', e => {
    const btn = e.target.closest('.dev-dark-toggle');
    if (!btn) return;

    const html = document.documentElement;
    const isDark = html.classList.contains('force-dark');
    const nextIsDark = !isDark;

    html.classList.toggle('force-dark', nextIsDark);
    html.classList.toggle('force-light', !nextIsDark);

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

/* ============================ END BLOCK 11 ============================ */


/* ======================================================================
   [BLOCK 12] DEV TOOLS
   ====================================================================== */

const PF_DEV = (function () {

  function enabled() {
    return isDevMode();
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
  }

  return { onStateChange };
})();

/* ============================ END BLOCK 12 ============================ */

/* ========================================================= */
/* [BLOCK 13] ENTRY TRAIL MODE (SHORT → FULL)                           */
/* ========================================================= */
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
/* END BLOCK 13 ============================================ */

/* ========================================================= */
/* [BLOCK 14] GLOBAL TRAIL MODE (SHORT | FULL)               */
/* ========================================================= */
// #region
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

  /* ----------------------------------------------------- */
  /* Helpers                                               */
  /* ----------------------------------------------------- */

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

  /* ----------------------------------------------------- */
  /* Init                                                  */
  /* ----------------------------------------------------- */

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

// #endregion
/* END BLOCK 14 ============================================ */

/* ========================================================= */
/* [BLOCK 15] FEHLERHINWEIS SENDEN (MAILTO).                 */
/* ========================================================= */

/* =========================================================
   - erzeugt eine vorbefüllte Plain-Text-Mail
   - nutzt ausschließlich sichtbaren DOM-Kontext
   - KEINE UI-, Struktur- oder CSS-Abhängigkeiten
   - Mail ist vor dem Absenden editierbar
========================================================= */

document.addEventListener('click', function (event) {
  const link = event.target.closest('.trail-meta a');
  if (!link) return;

  // Nur explizit für "Fehlerhinweis senden"
  if (!link.textContent.includes('Fehlerhinweis')) return;

  event.preventDefault();

  /* -------------------------------------------------------
     Kontext sammeln (rein lesend)
  ------------------------------------------------------- */


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

  /* -------------------------------------------------------
     Mail zusammenbauen
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     Mail-Client öffnen
  ------------------------------------------------------- */

  window.location.href = mailtoUrl;
});
/* END BLOCK 15 ============================================ */



/* ========================================================= */
/* [BLOCK 16] MINI-BACKLINK (JUMPMARK → SEITENANFANG)        */
/* ========================================================= */
// #region
/*
   Ziel:
   - nach Jumpmark-Navigation kontextuellen Rücksprung anbieten
   - Rücksprung IMMER zum Seitenanfang (main)
   - kein Zurück zur Jumpmark (Scroll), ABER:
     Fokus soll zurück zur zuletzt genutzten Jumpmark (A11y / mentale Kontinuität)
   - Event-Delegation, keine Inline-Styles

   Fixes:
   - Jumpmarks können auf ein INNERES Element zeigen (nicht auf .entry).
     -> wir aktivieren den Backlink für das nächstgelegene .entry.
   - Backlink kann durch aria-hidden oder hidden versteckt sein.
     -> aktiver Zustand entfernt beides defensiv.
*/

(function () {

  // ✅ Merkt die zuletzt ausgelöste Jumpmark (DOM-Referenz, keine IDs nötig)
  let lastJumpmarkEl = null;

  /* ---------------------------------------------------------
     Helper
  --------------------------------------------------------- */

  function getActiveSection() {
    const main = document.querySelector('main');
    if (!main) return null;
    return main.querySelector('.collection-section.active') || main;
  }

  function getPageTopTarget() {
    const scope = getActiveSection();
    if (!scope) return null;

    const candidate = scope.querySelector(
      '.jumpmarks a[href], .jumpmarks a, a[href], button:not([disabled])'
    );

    return candidate || null;
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

    // Defensive: aktiv muss sichtbar sein, auch wenn vorher versteckt
    backlink.removeAttribute('aria-hidden');
    backlink.removeAttribute('hidden');
    backlink.hidden = false;
  }

  /* ---------------------------------------------------------
     Jumpmark → Mini-Backlink aktivieren
     (Ziel-Entry über href-Fragment bestimmen)
  --------------------------------------------------------- */
  document.addEventListener('click', function (event) {
    const jumpmark = event.target.closest('.jumpmarks a');
    if (!jumpmark) return;

    const href = jumpmark.getAttribute('href');
    if (!href || !href.startsWith('#')) return;

    // ✅ merken, welche Jumpmark benutzt wurde (für Fokus-Rückkehr)
    lastJumpmarkEl = jumpmark;

    const targetId = href.slice(1);
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;

    const entry = targetEl.classList.contains('entry')
      ? targetEl
      : targetEl.closest('.entry');

    if (!entry) return;

    activateMiniBacklink(entry);
  });

  /* ---------------------------------------------------------
     Keyboard: Space auf Links wie Klick behandeln
  --------------------------------------------------------- */
  document.addEventListener('keydown', function (event) {
    if (event.key !== ' ') return;

    const link = event.target.closest('.jumpmarks a, .entry-mini-backlink');
    if (!link) return;

    event.preventDefault();
    link.click();
  });

  /* ---------------------------------------------------------
     Mini-Backlink → Scroll + Fokus
  --------------------------------------------------------- */
  document.addEventListener('click', function (event) {
    const backlink = event.target.closest('.entry-mini-backlink');
    if (!backlink || !backlink.classList.contains('is-active')) return;

    event.preventDefault();

    const scrollContainer = document.querySelector('main');
    if (!scrollContainer) return;

    scrollContainer.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    // ✅ Fokus zurück zur zuletzt genutzten Jumpmark (wenn noch im DOM & im aktiven Bereich)
    const activeScope = getActiveSection();
    const canUseLast =
      lastJumpmarkEl &&
      document.contains(lastJumpmarkEl) &&
      lastJumpmarkEl.matches('.jumpmarks a') &&
      (!activeScope || activeScope.contains(lastJumpmarkEl));

    const focusTarget = canUseLast ? lastJumpmarkEl : getPageTopTarget();

    if (focusTarget) {
      requestAnimationFrame(() => {
        focusTarget.focus({ preventScroll: true });
      });
    }

    resetMiniBacklinks();
  });

  /* ---------------------------------------------------------
     Navigation / Root / ESC → Reset
  --------------------------------------------------------- */
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
/* END BLOCK 16 ============================================ */