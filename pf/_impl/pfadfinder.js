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


/* ======================================================================
   [BLOCK 3e] URL HASH CONTROL (Jumpmarks ohne #entry-id…)
   ====================================================================== */

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

/* ============================ END BLOCK 3e ============================ */

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
  // scrollActiveLeafIntoView(activeLeafItem);

  /* Alles außerhalb des Scopes ausblenden */
  qsa('.nav-item').forEach(li => {
    if (li !== parentItem && !parentItem.contains(li)) {
      li.classList.add('is-hidden');
    }
  });

  showFixedParent(parentItem);

  setNavState(NAV_STATE.SCOPE, 'enterScopeMode');
  applyNavState();

  // ✅ Nach dem State-Apply scrollen, damit der Leaf auch dann sichtbar ist,
  // wenn er vorher (Parent zu) im Root-Mode noch nicht gerendert/angezeigt war.
  requestAnimationFrame(() => {
    const btn = activeLeafItem?.querySelector?.('button[role="treeitem"]');
    scrollActiveLeafIntoView(btn || activeLeafItem);
  });
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

    // URL: keine Jumpmark-Fragmente beibehalten
    clearUrlHash();

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
  // Desktop: scroll container is usually `.nav-scroll`.
  // Mobile: `.nav-scroll` may be non-scrollable and `.nav-pane` becomes scrollable.
  // We therefore pick the container that is ACTUALLY scrollable.

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

  // Prefer the actual treeitem button for stable geometry.
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

  // 3) Hard fallback for browsers that ignore smooth inside overflow containers
  if (behavior === 'smooth') {
    requestAnimationFrame(() => {
      const r = target.getBoundingClientRect();
      if (r.top < comfortTop || r.bottom > comfortBottom) {
        scrollContainer.scrollTop = targetScrollTop;
      }
    });
  }
}

/* ============================ END BLOCK 10 ============================ */

/* ======================================================================
   [BLOCK 10b] DEV TOOLS – HARD HIDE WHEN DISABLED
   ====================================================================== */
// #region
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
// #endregion
/* ========================= END BLOCK 10b ============================== */

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
   [BLOCK 11b] DEV BUILD INFO
   ====================================================================== */
// #region
/*
   Ziel:
   - deterministisch sichtbar machen, welches JS geladen wurde
   - nur im DEV-Mode anzeigen
   - ISO-8601 Timestamp (lokale Zeit)
   - Ausgabe innerhalb der DEV-Tools-Box
*/

// 🔧 MANUELLER BUILD-TIMESTAMP (ISO-8601, lokale Zeit)
const BUILD_TIMESTAMP = '2026-01-02T12:46+01:00';

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

  info.textContent = `Build: ${BUILD_TIMESTAMP}`;
}

// DOM-sicher initialisieren
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderDevBuildInfo);
} else {
  renderDevBuildInfo();
}
// #endregion
/* ========================= END BLOCK 11b ============================== */

/* ======================================================================
   [BLOCK 12] DEV TOOLS
   ====================================================================== */
// #region
const PF_DEV = (function () {

  function enabled() {
    return isDevMode();
  }

  function ensureDevToolsStyles() {
    // DEV-only: keep the UI unobtrusive and out of the navigation header.
    if (!enabled()) return;

    // Avoid duplicate injections
    if (document.getElementById('pf-devtools-style')) return;

    const css = `
      .dev-tools {
        position: fixed !important;
        top: auto !important;
        left: auto !important;
        right: 12px !important;
        bottom: 12px !important;
        z-index: 9999 !important;

        width: 380px;
        max-width: calc(100vw - 24px);
        box-sizing: border-box;

        /* wide + not very tall */
        max-height: 180px;
        overflow: auto;

        padding: 12px;
        border-radius: 12px;

        background: rgba(0, 0, 0, 0.78);
        color: #ffffff;

        font-size: 12px;
        line-height: 1.35;

        box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      }

      .dev-tools,
      .dev-tools * {
        box-sizing: border-box;
      }

      /* Keep the toggle readable inside the box */
      .dev-tools .dev-dark-toggle {
        display: inline-block;
        margin: 0;
        padding: 6px 10px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.22);
        background: rgba(255,255,255,0.10);
        color: #ffffff;
        font-size: 12px;
        line-height: 1.2;
      }

      .dev-tools .dev-dark-toggle:focus-visible {
        outline: 2px solid rgba(255,255,255,0.55);
        outline-offset: 2px;
      }

      /* Diagnostics: make it copy-friendly (textarea) + scrollbar */
      .dev-tools .dev-diagnostics {
        margin-top: 10px;
        margin-bottom: 8px;
        padding: 8px 10px;
        border-radius: 10px;

        background: rgba(255,255,255,0.10);
        border: 1px solid rgba(255,255,255,0.14);

        color: #ffffff;
        display: block;
        width: 100%;

        /* Copy UX */
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 12px;
        line-height: 1.35;

        /* Scrollbar inside the diagnostics field */
        height: 96px;
        max-height: 96px;
        overflow: auto;

        /* Make selection reliable */
        box-sizing: border-box;
        resize: vertical;

        /* Remove native textarea chrome */
        outline: none;
      }

      .dev-tools .dev-build-info {
        margin-top: 0;
        opacity: 0.9;
        color: #ffffff;
        font-size: 12px;
      }

      /* On very small viewports: slightly narrower */
      @media (max-width: 420px) {
        .dev-tools {
          width: calc(100vw - 24px);
          max-height: 160px;
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

  function ensureDiagnosticsEl() {
    const devTools = document.querySelector('.dev-tools');
    if (!devTools) return null;

    // Wenn es bereits ein Diagnostics-Element irgendwo gibt, aber NICHT in der Box:
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
      el.setAttribute('spellcheck', 'false');
      el.setAttribute('wrap', 'off');

      // Diagnostics zwischen Toggle und Build-Info einfügen (falls Build schon existiert)
      const build = devTools.querySelector('.dev-build-info');
      if (build) {
        devTools.insertBefore(el, build);
      } else {
        devTools.appendChild(el);
      }
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

    const lines = [];

    // Meta
    lines.push(reason ? `Diagnostics (${reason})` : 'Diagnostics');

    // Navigation state (read-only)
    lines.push(`navState=${currentNavState}`);

    // Root-current / active / selected
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

    // Current content
    lines.push(`activeContent=${currentActiveId || '∅'}`);

    const text = lines.join('\n');
    // textarea supports selecting/copying all content incl. off-screen
    if ('value' in el) {
      el.value = text;
    } else {
      el.textContent = text;
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

    updateDiagnostics(reason || 'state-change');
  }

  // DEV: nach relevanten Interaktionen Diagnostics aktualisieren
  function initDiagnosticsHooks() {
    if (!enabled()) return;

    // DEV-only styling: bottom-right, compact, readable
    ensureDevToolsStyles();

    // initial
    updateDiagnostics('init');

    // nach Clicks/Touches (nur lesen, keine Side-Effects)
    document.addEventListener('click', () => {
      requestAnimationFrame(() => updateDiagnostics('click'));
    }, true);

    document.addEventListener('touchend', () => {
      requestAnimationFrame(() => updateDiagnostics('touchend'));
    }, { passive: true, capture: true });

    document.addEventListener('touchcancel', () => {
      requestAnimationFrame(() => updateDiagnostics('touchcancel'));
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

  /* ---------------------------------------------------------
     Helper
  --------------------------------------------------------- */

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

  /* ---------------------------------------------------------
     Jumpmark → Mini-Backlink aktivieren
  --------------------------------------------------------- */
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
  });

  /* ---------------------------------------------------------
     Keyboard: Space wie Klick behandeln
  --------------------------------------------------------- */
  document.addEventListener('keydown', function (event) {
    if (event.key !== ' ') return;

    const link = event.target.closest(
      '.jumpmarks a, .entry-mini-backlink'
    );
    if (!link) return;

    event.preventDefault();
    link.click();
  });

  /* ---------------------------------------------------------
     Mini-Backlink → Scroll + Fokus (VARIANTE A)
  --------------------------------------------------------- */
  document.addEventListener('click', function (event) {
    const backlink = event.target.closest('.entry-mini-backlink');
    if (!backlink || !backlink.classList.contains('is-active')) return;

    event.preventDefault();

    const main = getMain();

    // 🔑 VARIANTE A:
    // Wenn main scrollbar ist → main scrollen
    // sonst → Dokument scrollen (Mobile)
    const canScrollMain =
      main &&
      main.scrollHeight > main.clientHeight;

    if (canScrollMain) {
      main.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

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