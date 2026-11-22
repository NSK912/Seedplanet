// Global references declared early to avoid load-time reference errors in other modules
var canvas = null;
var gl = null;
var isWebGL2 = true;
var supportUint32 = true;
var RADIUS = 64.0;
var HEIGHT_SCALE = 0.6 * Math.pow(64.0 / 8.0, 0.70);
var globalSeed = 0;

var currentGridSize = 800;

var PLANET_CORE_POS = [0, 0, 0];
function getPlanetCorePosition() {
  return window.PLANET_CORE_POS || PLANET_CORE_POS;
}
function setPlanetCorePosition(x, y, z) {
  if (Array.isArray(x)) {
    window.PLANET_CORE_POS = [x[0], x[1], x[2]];
  } else {
    window.PLANET_CORE_POS = [x, y, z];
  }
  PLANET_CORE_POS = window.PLANET_CORE_POS;
  return window.PLANET_CORE_POS;
}

function updatePlanetRadiusAndHeightScale(newRadius) {
  const r = Math.max(64.0, parseFloat(newRadius) || 64.0);
  RADIUS = r;
  // Dynamic height scaling (8.0 is 0.6 baseline, larger radius has proportionate mountains)
  HEIGHT_SCALE = 0.6 * Math.pow(r / 8.0, 0.70);
  currentGridSize = Math.max(100, Math.min(1600, Math.round(r * 12.5)));
  if (typeof window !== 'undefined') {
    window.RADIUS = r;
    window.HEIGHT_SCALE = HEIGHT_SCALE;
    window.currentGridSize = currentGridSize;
    if (typeof window.clearCache === 'function') {
      window.clearCache();
    }
    if (typeof window.clearTunnelMeshCache === 'function') {
      window.clearTunnelMeshCache();
    }
  }
  return { radius: RADIUS, heightScale: HEIGHT_SCALE, gridSize: currentGridSize };
}

if (typeof window !== 'undefined') {
  window.RADIUS = 64.0;
  window.HEIGHT_SCALE = 0.6 * Math.pow(64.0 / 8.0, 0.70);
  window.currentGridSize = 800;
  window.globalSeed = 0;
  window.PLANET_CORE_POS = PLANET_CORE_POS;
  window.getPlanetCorePosition = getPlanetCorePosition;
  window.setPlanetCorePosition = setPlanetCorePosition;
  window.updatePlanetRadiusAndHeightScale = updatePlanetRadiusAndHeightScale;
}

// === SEEDPLANET MODULE: JS/UTILS.JS ===

// ============================================
// Global Custom Simulated Pointer Lock & Cursor System
// ============================================
var simulatedPointerLock = false;
var customCursorEl = null;
var virtualCursorX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
var virtualCursorY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
var hasVirtualCursorInitialized = false;
var isSyntheticEvent = false;
var lastHoveredEl = null;

// Helper to check if any UI overlay is open
function isUIOpen() {
  const inv = document.getElementById("inventoryOverlay");
  if (inv && inv.classList.contains("open")) return true;

  const warp = document.getElementById("warpOverlay");
  if (warp && warp.classList.contains("open")) return true;
  
  const isStarted = (typeof gameStarted !== "undefined" && gameStarted) || (typeof window.gameStarted !== "undefined" && window.gameStarted);
  if (!isStarted) {
    const start = document.getElementById("gameStartOverlay");
    if (start && start.style.display !== "none" && !start.classList.contains("fade-out")) return true;
  }
  
  const saveSelect = document.getElementById("saveSelectOverlay");
  if (saveSelect && saveSelect.classList.contains("open")) return true;

  const trash = document.getElementById("trashConfirmOverlay");
  if (trash && trash.style.display !== "none" && trash.style.display !== "") return true;

  const antialias = document.getElementById("antialiasConfirmOverlay");
  if (antialias && antialias.style.display !== "none" && antialias.style.display !== "") return true;

  const mainControls = document.getElementById("mainControls");
  if (mainControls && mainControls.style.display !== "none" && mainControls.offsetParent !== null) return true;

  const devControls = document.querySelector(".controls");
  if (devControls && devControls.style.display !== "none" && devControls.offsetParent !== null) return true;

  return false;
}

// Helper to check if element is interactive (button, slot, clickable UI control, slider, tab)
function getInteractiveTarget(el) {
  if (!el || el === document.body || el === document.documentElement || el === canvas) return null;
  return el.closest("button, a, input, select, textarea, [onclick], .inventory-slot, .action-slot, .close-btn, .inventory-btn, .touch-btn, .tab-btn, .clickable, [role='button'], .item-card, .save-slot-card, .save-card, .btn, [draggable='true'], .slider, .range-slider, .setting-slider, .tab, [id^='tab'], .recipe-item, .craft-tab, .quick-slot, [data-action], [data-clickable]");
}

// Ensure custom circular cursor exists with high-precision center dot and gold hover feedback
function ensureCustomCursor() {
  if (customCursorEl && document.body && document.body.contains(customCursorEl)) return customCursorEl;
  let cursor = document.getElementById("customGameCursor");
  if (!cursor) {
    cursor = document.createElement("div");
    cursor.id = "customGameCursor";
    cursor.innerHTML = '<div class="custom-cursor-dot"></div>';
    if (document.body) document.body.appendChild(cursor);

    if (!document.getElementById("customCursorStyles")) {
      const style = document.createElement("style");
      style.id = "customCursorStyles";
      style.textContent = `
        #customGameCursor {
          position: fixed;
          top: 0; left: 0;
          width: 1.125rem;
          height: 1.125rem;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.95);
          background-color: rgba(10, 10, 15, 0.7);
          box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.85), 0 0.125rem 0.5rem rgba(0, 0, 0, 0.6);
          pointer-events: none !important;
          z-index: 2147483647;
          transform: translate3d(-50%, -50%, 0);
          will-change: transform;
          display: block;
          box-sizing: border-box;
          transition: border-color 0.1s ease, box-shadow 0.1s ease, opacity 0.15s ease;
        }
        #customGameCursor.hovering {
          border-color: #dfb76c !important;
          box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.9), 0 0 0.75rem rgba(223, 183, 108, 0.75) !important;
        }
        #customGameCursor.clicking {
          box-shadow: 0 0 0 2px #dfb76c, 0 0 0.875rem rgba(223, 183, 108, 0.9) !important;
        }
        #customGameCursor * {
          pointer-events: none !important;
        }
        #customGameCursor .custom-cursor-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0.25rem;
          height: 0.25rem;
          background-color: #ffffff;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none !important;
          transition: background-color 0.1s ease;
        }
        #customGameCursor.hovering .custom-cursor-dot {
          background-color: #dfb76c !important;
        }
        #customGameCursor.clicking .custom-cursor-dot {
          background-color: #ffffff !important;
        }
        body.custom-cursor-active,
        body.custom-cursor-active canvas,
        body.custom-cursor-active * {
          cursor: none !important;
        }
        .virtual-hover {
          filter: brightness(1.25) !important;
          outline: 2px solid rgba(223, 183, 108, 0.85) !important;
          outline-offset: -1px;
        }
        .cut-frame.virtual-hover,
        .crafting-recipe-card.virtual-hover,
        .inventory-header h2.virtual-hover,
        .inventory-header .close-btn.virtual-hover,
        .craft-tile.virtual-hover,
        .inventory-slot.virtual-hover,
        .action-slot.virtual-hover,
        .touch-btn.virtual-hover,
        .mech-stand-slot.virtual-hover,
        .custom-scrollbar-track.virtual-hover,
        .custom-scrollbar-thumb.virtual-hover,
        .seedian-footer-btn.virtual-hover,
        .seedian-card.virtual-hover,
        #inventoryBottomButtons > button.virtual-hover,
        .start-btn.virtual-hover,
        .inventory-btn.virtual-hover,
        #gameplayFullscreenBtn.virtual-hover,
        #inventorySettings button.game-ui.virtual-hover,
        .key-bind-btn.virtual-hover,
        .gp-bind-btn.virtual-hover,
        #chestTakeAllBtn.virtual-hover,
        #trashCancelBtn.virtual-hover,
        #trashConfirmBtn.virtual-hover,
        #antialiasCancelBtn.virtual-hover,
        #antialiasConfirmBtn.virtual-hover,
        .save-slot-card.virtual-hover,
        .save-slot-delete-btn.virtual-hover,
        #btnSaveSelectBack.virtual-hover,
        .custom-select-display.virtual-hover {
          outline: none !important;
        }
      `;
      if (document.head) document.head.appendChild(style);
    }
  }
  customCursorEl = cursor;
  if (document.body) document.body.classList.add("custom-cursor-active");
  return cursor;
}

// Intercept document.pointerLockElement
(function setupSimulatedPointerLock() {
  const originalPointerLockElementDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'pointerLockElement');

  try {
    Object.defineProperty(document, 'pointerLockElement', {
      get() {
        const nativeEl = originalPointerLockElementDesc ? originalPointerLockElementDesc.get.call(document) : null;
        if (nativeEl) return nativeEl;
        if (simulatedPointerLock) return canvas || document.body;
        return null;
      },
      configurable: true
    });
  } catch (e) {
    console.warn("Could not override pointerLockElement getter:", e);
  }

  const originalExitPointerLock = Document.prototype.exitPointerLock;
  document.exitPointerLock = function(force) {
    const mainControls = document.getElementById("mainControls") || document.querySelector(".controls");
    const isDevOpen = window.controlsVisible || (mainControls && (mainControls.style.display === "flex" || (window.getComputedStyle && window.getComputedStyle(mainControls).display !== "none")) && mainControls.offsetParent !== null);
    const isGameUIOpen = typeof isUIOpen === "function" && isUIOpen();

    // Only ignore exit pointer lock during active gameplay without any UI open
    if (!force && !window.isSwitchingApp && !isDevOpen && !isGameUIOpen) {
      return;
    }
    simulatedPointerLock = false;
    window.simulatedPointerLock = false;
    const nativeEl = originalPointerLockElementDesc ? originalPointerLockElementDesc.get.call(document) : null;
    if (nativeEl && originalExitPointerLock) {
      try { originalExitPointerLock.call(document); } catch(err){}
    }
    if (document.body) document.body.classList.remove("custom-cursor-active");
    document.dispatchEvent(new Event('pointerlockchange'));
  };
})();

function requestPointerLockSafe() {
  const mainControls = document.getElementById("mainControls") || document.querySelector(".controls");
  const isDevOpen = window.controlsVisible || (mainControls && (mainControls.style.display === "flex" || (window.getComputedStyle && window.getComputedStyle(mainControls).display !== "none")) && mainControls.offsetParent !== null);
  if (isDevOpen || (typeof isUIOpen === "function" && isUIOpen())) {
    return;
  }

  ensureCustomCursor();
  simulatedPointerLock = true;

  if (typeof canvas !== 'undefined' && canvas && typeof canvas.requestPointerLock === 'function') {
    try {
      const promise = canvas.requestPointerLock();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {});
      }
    } catch (e) {}
  }

  if (document.body) document.body.classList.add("custom-cursor-active");
  document.dispatchEvent(new Event('pointerlockchange'));
}

function requestPointerLockSafeLegacy() {
  requestPointerLockSafe();
}

// Lock on first click from start screen or page (only during active gameplay, never when UI or DevGame is open)
window.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "mouse") return;
  const mainControls = document.getElementById("mainControls") || document.querySelector(".controls");
  const isDevOpen = mainControls && (mainControls.style.display === "flex" || (window.getComputedStyle && window.getComputedStyle(mainControls).display !== "none")) && mainControls.offsetParent !== null;
  if (isDevOpen || (typeof isUIOpen === "function" && isUIOpen())) return;
  if (e.target && e.target.closest && e.target.closest("#mainControls, .controls, .control-group, [id^='dev'], #toggleControlsBtn, .game-ui")) return;
  requestPointerLockSafe();
}, { capture: true });

// App Switching Unlock Behavior (unlock real mouse ONLY when switching to another app/tab)
window.isSwitchingApp = false;
window.addEventListener("blur", () => {
  window.isSwitchingApp = true;
  simulatedPointerLock = false;
  if (document.body) document.body.classList.remove("custom-cursor-active");
  if (typeof document.exitPointerLock === "function") {
    try { document.exitPointerLock(); } catch(e){}
  }
  window.isSwitchingApp = false;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    window.isSwitchingApp = true;
    simulatedPointerLock = false;
    if (document.body) document.body.classList.remove("custom-cursor-active");
    if (typeof document.exitPointerLock === "function") {
      try { document.exitPointerLock(); } catch(e){}
    }
    window.isSwitchingApp = false;
  }
});

// Synthetic DataTransfer for Virtual Drag and Drop
class SyntheticDataTransfer {
  constructor() {
    this.data = {};
    this.effectAllowed = "all";
    this.dropEffect = "move";
    this.types = [];
  }
  setData(format, val) {
    this.data[format] = String(val);
    if (!this.types.includes(format)) this.types.push(format);
  }
  getData(format) {
    return this.data[format] || "";
  }
  clearData(format) {
    if (format) {
      delete this.data[format];
      this.types = this.types.filter(t => t !== format);
    } else {
      this.data = {};
      this.types = [];
    }
  }
  setDragImage(img, x, y) {}
}

var isVirtualMouseDown = false;
var virtualMouseDownX = 0;
var virtualMouseDownY = 0;
var activeVirtualDragTarget = null;
var activeVirtualDragInput = null;
var activeVirtualCustomScrollbar = null;
var isVirtualDraggingSlot = false;
var didVirtualDrag = false;
var virtualDragSource = null;
var virtualDataTransfer = null;
var virtualDragGhost = null;
var virtualDragLastOver = null;

function createVirtualDragGhost(sourceEl) {
  if (virtualDragGhost && virtualDragGhost.parentNode) {
    virtualDragGhost.parentNode.removeChild(virtualDragGhost);
  }
  if (!sourceEl) return null;

  const rect = sourceEl.getBoundingClientRect();
  const width = rect.width > 0 ? rect.width : 56;
  const height = rect.height > 0 ? rect.height : 56;

  // Deep clone the source slot element so its exact borders, cut corners (--slot-cut), badge, icon & text are preserved
  const ghost = sourceEl.cloneNode(true);
  ghost.id = "virtualDragGhost";

  // Strip state classes from clone so it renders in its full pristine appearance
  ghost.classList.remove("dragging", "dragging-active", "dragover", "selected", "hover");

  // Style the cloned ghost element for fixed positioning under the virtual cursor
  ghost.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: ${width}px !important;
    height: ${height}px !important;
    pointer-events: none !important;
    z-index: 2147483647 !important;
    transform: translate3d(-50%, -50%, 0) !important;
    will-change: transform !important;
    opacity: 0.95 !important;
    filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.75)) !important;
    margin: 0 !important;
    box-sizing: border-box !important;
    transition: none !important;
    animation: none !important;
  `;

  // Preserve clipPath if defined via inline style or computed CSS
  const computed = window.getComputedStyle(sourceEl);
  if (computed.clipPath && computed.clipPath !== "none") {
    ghost.style.clipPath = computed.clipPath;
  }

  if (document.body) document.body.appendChild(ghost);
  return ghost;
}

// Calculate and update range input value from virtual cursor X position
function updateRangeInputFromVirtualCursor(inputEl, clientX) {
  if (!inputEl) return;
  const input = (inputEl.tagName === "INPUT" && inputEl.type === "range") ? inputEl : inputEl.closest("input[type='range']");
  if (!input) return;

  const rect = input.getBoundingClientRect();
  if (rect.width <= 0) return;

  const min = parseFloat(input.min) || 0;
  const max = parseFloat(input.max) || 100;
  const step = parseFloat(input.step) || 1;

  let ratio = (clientX - rect.left) / rect.width;
  ratio = Math.max(0, Math.min(1, ratio));

  let rawValue = min + ratio * (max - min);
  let snappedValue = rawValue;
  if (step > 0) {
    snappedValue = Math.round((rawValue - min) / step) * step + min;
  }
  snappedValue = Math.max(min, Math.min(max, snappedValue));

  const stepDecimals = (String(step).split(".")[1] || "").length;
  const formattedValue = snappedValue.toFixed(stepDecimals);

  if (String(input.value) !== formattedValue) {
    input.value = formattedValue;
    input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  }
}

// Virtual cursor visibility manager (toggled manually via Alt)
window.isVirtualCursorManualHidden = false;

function updateVirtualCursorVisibility() {
  const cursor = ensureCustomCursor();
  if (!cursor) return;

  const uiOpen = typeof isUIOpen === "function" ? isUIOpen() : false;
  
  const isDev = (typeof isDevMode !== "undefined" && isDevMode) || (typeof window.isDevMode !== "undefined" && window.isDevMode);
  const isTouch = window.devInputMode === "touch" || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || 
                  (window.devInputMode === "auto" && typeof isAndroidProfile !== "undefined" && isAndroidProfile);

  let targetDisplay = "block";
  let targetOpacity = "1";

  if (isTouch && !isDev) {
    targetDisplay = "none";
    targetOpacity = "0";
  } else if (uiOpen) {
    if (window.isGamepadUINavActive) {
      targetDisplay = "none";
      targetOpacity = "0";
    } else {
      targetDisplay = "block";
      targetOpacity = "1";
    }
  } else if (window.isVirtualCursorManualHidden) {
    targetDisplay = "block";
    targetOpacity = "0";
  } else {
    targetDisplay = "block";
    targetOpacity = "1";
  }

  if (cursor.style.display !== targetDisplay) cursor.style.display = targetDisplay;
  if (cursor.style.opacity !== targetOpacity) cursor.style.opacity = targetOpacity;
}
window.updateVirtualCursorVisibility = updateVirtualCursorVisibility;

// Observe UI overlay changes to update cursor visibility dynamically
if (typeof window !== "undefined") {
  const initUIObserver = () => {
    if (document.body && typeof MutationObserver !== "undefined") {
      let lastUIOpen = typeof isUIOpen === "function" ? isUIOpen() : false;
      const observer = new MutationObserver(() => {
        const uiOpen = typeof isUIOpen === "function" ? isUIOpen() : false;
        
        if (uiOpen !== lastUIOpen) {
          lastUIOpen = uiOpen;
          if (uiOpen) {
            if (typeof window.resetVirtualCursorToCenter === "function") window.resetVirtualCursorToCenter();
          } else {
            if (window.isVirtualCursorManualHidden) {
              if (typeof requestPointerLockSafe === "function") requestPointerLockSafe();
            }
          }
          updateVirtualCursorVisibility();
        }
      });

      // Target only the specific overlay containers instead of the whole page subtree to prevent mutation thrashing
      const overlayIds = ["inventoryOverlay", "warpOverlay", "saveSelectOverlay"];
      overlayIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          observer.observe(el, { attributes: true, attributeFilter: ["class", "style"] });
        }
      });
      // Fallback observation on body for class changes only (no subtree style churn)
      observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUIObserver);
  } else {
    initUIObserver();
  }
}

window.resetVirtualCursorToCenter = function() {
  virtualCursorX = window.innerWidth / 2;
  virtualCursorY = window.innerHeight / 2;
  const cursor = typeof ensureCustomCursor === "function" ? ensureCustomCursor() : document.getElementById("customGameCursor");
  if (cursor) {
    const newT = `translate3d(${virtualCursorX}px, ${virtualCursorY}px, 0) translate(-50%, -50%)`;
    if (cursor._lastT !== newT) { cursor.style.transform = newT; cursor._lastT = newT; }
  }
};

function toggleVirtualCursorVisibility() {
  window.isVirtualCursorManualHidden = !window.isVirtualCursorManualHidden;
  if (!window.isVirtualCursorManualHidden) {
    if (typeof window.resetVirtualCursorToCenter === "function") window.resetVirtualCursorToCenter();
  } else {
    // When hiding the virtual cursor, we MUST request native pointer lock so the user can look around!
    if (typeof requestPointerLockSafe === "function") requestPointerLockSafe();
  }
  updateVirtualCursorVisibility();
}
window.toggleVirtualCursorVisibility = toggleVirtualCursorVisibility;

// RequestAnimationFrame throttling for virtual hover and dragover detection to eliminate CPU stutter
let lastPointerMoveTime = 0;
let hoverRafId = null;
let pendingHoverX = 0;
let pendingHoverY = 0;

function scheduleHoverUpdate(x, y) {
  pendingHoverX = x;
  pendingHoverY = y;
  if (hoverRafId !== null) return;
  hoverRafId = requestAnimationFrame(runHoverUpdate);
}

function runHoverUpdate() {
  hoverRafId = null;
  const cursor = ensureCustomCursor();
  if (!cursor) return;

  const hx = pendingHoverX;
  const hy = pendingHoverY;

  // Virtual hover state dispatch - ONLY for interactive elements
  const rawHoverEl = document.elementFromPoint(hx, hy);
  const interactiveTarget = getInteractiveTarget(rawHoverEl);

  if (interactiveTarget !== lastHoveredEl) {
    if (lastHoveredEl) {
      try { lastHoveredEl.classList.remove("virtual-hover"); } catch(err){}
      try {
        lastHoveredEl.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false, cancelable: false, clientX: hx, clientY: hy }));
        lastHoveredEl.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, cancelable: true, clientX: hx, clientY: hy }));
      } catch(err){}
    }
    if (interactiveTarget) {
      try { interactiveTarget.classList.add("virtual-hover"); } catch(err){}
      try {
        interactiveTarget.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false, cancelable: false, clientX: hx, clientY: hy }));
        interactiveTarget.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, clientX: hx, clientY: hy }));
      } catch(err){}
      cursor.classList.add("hovering");
    } else {
      cursor.classList.remove("hovering");
    }
    lastHoveredEl = interactiveTarget;
  }

  // Handle slot dragover / dragenter / dragleave during dragging
  if (isVirtualDraggingSlot && virtualDragSource) {
    const currOver = document.elementFromPoint(hx, hy);
    if (currOver !== virtualDragLastOver) {
      if (virtualDragLastOver) {
        const leaveEvt = new Event("dragleave", { bubbles: true, cancelable: true });
        leaveEvt.dataTransfer = virtualDataTransfer;
        virtualDragLastOver.dispatchEvent(leaveEvt);
        if (typeof virtualDragLastOver.ondragleave === "function") {
          try { virtualDragLastOver.ondragleave(leaveEvt); } catch(err){}
        }
      }
      if (currOver) {
        const enterEvt = new Event("dragenter", { bubbles: true, cancelable: true });
        enterEvt.dataTransfer = virtualDataTransfer;
        currOver.dispatchEvent(enterEvt);
        if (typeof currOver.ondragenter === "function") {
          try { currOver.ondragenter(enterEvt); } catch(err){}
        }
      }
      virtualDragLastOver = currOver;
    }

    if (currOver) {
      const overEvt = new Event("dragover", { bubbles: true, cancelable: true });
      overEvt.dataTransfer = virtualDataTransfer;
      overEvt.clientX = hx;
      overEvt.clientY = hy;
      currOver.dispatchEvent(overEvt);
      if (typeof currOver.ondragover === "function") {
        try { currOver.ondragover(overEvt); } catch(err){}
      }
    }
  }

  // Dispatch mousemove only on active drag target if dragging or mouse is down
  if (isVirtualMouseDown && activeVirtualDragTarget) {
    isSyntheticEvent = true;
    try {
      activeVirtualDragTarget.dispatchEvent(new MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: hx,
        clientY: hy,
        screenX: hx,
        screenY: hy,
        buttons: 1,
        button: 0
      }));
    } catch(err){}
    isSyntheticEvent = false;
  }
}

// Update mouse coordinates, virtual cursor, hover, movement, and drag
function handleVirtualMouseMove(e) {
  if (isSyntheticEvent) return;

  const isDev = (typeof isDevMode !== "undefined" && isDevMode) || (typeof window.isDevMode !== "undefined" && window.isDevMode);
  const isTouch = window.devInputMode === "touch" || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || 
                  (window.devInputMode === "auto" && typeof isAndroidProfile !== "undefined" && isAndroidProfile);
  if (isTouch && !isDev) return;

  // De-duplicate: If pointermove was just handled, ignore duplicate mousemove event fired by the browser
  const now = performance.now();
  if (e.type === "pointermove") {
    lastPointerMoveTime = now;
  } else if (e.type === "mousemove" && (now - lastPointerMoveTime < 16)) {
    return;
  }

  const cursor = ensureCustomCursor();
  if (!cursor) return;

  if (!hasVirtualCursorInitialized) {
    virtualCursorX = (typeof e.clientX === "number" && !isNaN(e.clientX)) ? e.clientX : window.innerWidth / 2;
    virtualCursorY = (typeof e.clientY === "number" && !isNaN(e.clientY)) ? e.clientY : window.innerHeight / 2;
    hasVirtualCursorInitialized = true;
  }

  const isNativeLocked = !!(Object.getOwnPropertyDescriptor(Document.prototype, 'pointerLockElement')?.get?.call(document));
  const uiOpen = typeof isUIOpen === "function" ? isUIOpen() : false;

  if (window.isGamepadUINavActive && uiOpen && (Math.abs(e.movementX || 0) > 2 || Math.abs(e.movementY || 0) > 2)) {
    window.isGamepadUINavActive = false;
    document.querySelectorAll(".gamepad-focused").forEach(el => el.classList.remove("gamepad-focused"));
  }

  if (window.isVirtualCursorManualHidden && !uiOpen) {
    virtualCursorX = window.innerWidth / 2;
    virtualCursorY = window.innerHeight / 2;
  } else {
    if (isNativeLocked) {
      if (e.movementX !== undefined && e.movementY !== undefined) {
        const sens = (typeof mouseSensitivity === "number" && mouseSensitivity > 0) ? mouseSensitivity : 1.0;
        virtualCursorX += e.movementX * sens;
        virtualCursorY += e.movementY * sens;
      }
    } else if (typeof e.clientX === "number" && !isNaN(e.clientX)) {
      virtualCursorX = e.clientX;
      virtualCursorY = e.clientY;
    }
    virtualCursorX = Math.max(0, Math.min(window.innerWidth, virtualCursorX));
    virtualCursorY = Math.max(0, Math.min(window.innerHeight, virtualCursorY));
  }

  // Instant visual update on GPU hardware-accelerated layer with pixel-perfect center alignment
  const newT = `translate3d(${virtualCursorX}px, ${virtualCursorY}px, 0) translate(-50%, -50%)`;
  if (cursor._lastT !== newT) {
    cursor.style.transform = newT;
    cursor._lastT = newT;
  }

  updateVirtualCursorVisibility();

  // Instant drag updates
  if (isVirtualMouseDown) {
    // 1. Dragging range sliders
    if (activeVirtualDragInput) {
      didVirtualDrag = true;
      updateRangeInputFromVirtualCursor(activeVirtualDragInput, virtualCursorX);
    }

    // 2. Dragging custom scrollbars
    if (activeVirtualCustomScrollbar) {
      didVirtualDrag = true;
      if (typeof window.updateCustomScrollbarFromPosition === "function") {
        window.updateCustomScrollbarFromPosition(virtualCursorY);
      }
    }

    // 3. Dragging inventory/action slots
    if (activeVirtualDragTarget) {
      const dist = Math.hypot(virtualCursorX - virtualMouseDownX, virtualCursorY - virtualMouseDownY);
      if (!isVirtualDraggingSlot && dist > 5) {
        const slotEl = activeVirtualDragTarget.closest("[draggable='true'], .inventory-slot, .action-slot, .chest-slot, .item-card");
        if (slotEl) {
          isVirtualDraggingSlot = true;
          didVirtualDrag = true;
          virtualDragSource = slotEl;
          virtualDataTransfer = new SyntheticDataTransfer();
          virtualDragGhost = createVirtualDragGhost(slotEl);

          isSyntheticEvent = true;
          const startEvt = new Event("dragstart", { bubbles: true, cancelable: true });
          startEvt.dataTransfer = virtualDataTransfer;
          startEvt.clientX = virtualCursorX;
          startEvt.clientY = virtualCursorY;
          slotEl.dispatchEvent(startEvt);
          if (typeof slotEl.ondragstart === "function") {
            try { slotEl.ondragstart(startEvt); } catch(err){}
          }
          isSyntheticEvent = false;
        }
      }

      if (isVirtualDraggingSlot && virtualDragSource && virtualDragGhost) {
        const ghostT = `translate3d(${virtualCursorX}px, ${virtualCursorY}px, 0) translate(-50%, -50%)`;
        if (virtualDragGhost._lastT !== ghostT) {
          virtualDragGhost.style.setProperty('transform', ghostT, 'important');
          virtualDragGhost._lastT = ghostT;
        }
      }
    }
  }

  // Schedule lightweight hover detection on next animation frame
  scheduleHoverUpdate(virtualCursorX, virtualCursorY);
}

window.addEventListener("mousemove", handleVirtualMouseMove, { capture: true, passive: true });
window.addEventListener("pointermove", handleVirtualMouseMove, { capture: true, passive: true });

let lastVirtualMouseUpTime = 0;

// Setup click listener for toggleControlsBtn if present
window.toggleDevControls = function(forceState) {
  const mainControls = document.getElementById("mainControls") || document.querySelector(".controls");
  const toggleBtn = document.getElementById("toggleControlsBtn");
  if (!mainControls) return;
  const isHidden = mainControls.style.display === "none" || (window.getComputedStyle && window.getComputedStyle(mainControls).display === "none");
  const show = typeof forceState === "boolean" ? forceState : isHidden;

  if (show) {
    mainControls.style.display = "flex";
    if (toggleBtn) toggleBtn.textContent = "⚙️ ซ่อนเมนู";
    window.controlsVisible = true;
    if (document.exitPointerLock) {
      try { document.exitPointerLock(true); } catch(err){}
    }
    if (typeof simulatedPointerLock !== "undefined") {
      simulatedPointerLock = false;
    }
    if (typeof window.simulatedPointerLock !== "undefined") {
      window.simulatedPointerLock = false;
    }
    if (document.body) document.body.classList.remove("custom-cursor-active");
    if (typeof window.updateDevCharacterModelUI === "function") {
      try { window.updateDevCharacterModelUI(); } catch(err){}
    }
  } else {
    mainControls.style.display = "none";
    if (toggleBtn) toggleBtn.textContent = "⚙️ แสดงเมนู";
    window.controlsVisible = false;
  }
};

function setupToggleControlsBtnListener() {
  const toggleBtn = document.getElementById("toggleControlsBtn");
  if (toggleBtn && !toggleBtn.dataset.hasToggleListener) {
    toggleBtn.dataset.hasToggleListener = "true";
    toggleBtn.style.zIndex = "20";
    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.toggleDevControls();
    });
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupToggleControlsBtnListener);
} else {
  setupToggleControlsBtnListener();
}

// Redirect mouse clicks/events to virtual cursor target when UI is open or locked
function redirectMouseEventToVirtualCursor(e) {
  if (isSyntheticEvent) return;

  const isDev = (typeof isDevMode !== "undefined" && isDevMode) || (typeof window.isDevMode !== "undefined" && window.isDevMode);
  const isTouch = window.devInputMode === "touch" || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || 
                  (window.devInputMode === "auto" && typeof isAndroidProfile !== "undefined" && isAndroidProfile);
  if (isTouch && !isDev) return;

  // Ensure toggleControlsBtn listener is active
  setupToggleControlsBtnListener();

  // Keep window focused for keyboard events
  if (window.focus) {
    try { window.focus(); } catch(err){}
  }

  // Allow simulated and synthetic events (from gamepad, touch buttons, or programmatic dispatch) to pass through untouched
  if (e.simulated || isSyntheticEvent || window.isGamepadTriggeringClick || (e.isTrusted === false && !e.fromVirtualCursor)) return;
  if (window.isGamepadUINavActive) return;

  const uiOpen = typeof isUIOpen === "function" ? isUIOpen() : false;
  if (window.isVirtualCursorManualHidden && !uiOpen) {
    if (e.target !== canvas) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    }
    return;
  }
  const isLocked = !!document.pointerLockElement || simulatedPointerLock;
  if (!isLocked && !isUIOpen()) return;

  // Flush any pending hover update to ensure fresh state at moment of click
  if (hoverRafId !== null) {
    cancelAnimationFrame(hoverRafId);
    hoverRafId = null;
  }

  const targetEl = document.elementFromPoint(virtualCursorX, virtualCursorY);
  if (!targetEl) return;

  const cursor = ensureCustomCursor();

  // Record virtual mouse down / up for dragging and slider manipulation
  if (e.type === "mousedown" || e.type === "pointerdown") {
    isVirtualMouseDown = true;
    virtualMouseDownX = virtualCursorX;
    virtualMouseDownY = virtualCursorY;
    activeVirtualDragTarget = targetEl;
    didVirtualDrag = false;

    if (cursor) cursor.classList.add("clicking");

    const rangeInput = (targetEl.tagName === "INPUT" && targetEl.type === "range") ? targetEl : targetEl.closest("input[type='range']");
    if (rangeInput) {
      activeVirtualDragInput = rangeInput;
      updateRangeInputFromVirtualCursor(rangeInput, virtualCursorX);
    } else {
      activeVirtualDragInput = null;
    }

    const scrollbarThumb = targetEl.closest(".custom-scrollbar-thumb, #panelCustomScrollbarThumb");
    const scrollbarTrack = targetEl.closest(".custom-scrollbar-track, #panelCustomScrollbar");
    if (scrollbarThumb || scrollbarTrack) {
      activeVirtualCustomScrollbar = scrollbarThumb || scrollbarTrack;
      if (typeof window.updateCustomScrollbarFromPosition === "function") {
        window.updateCustomScrollbarFromPosition(virtualCursorY);
      }
    } else {
      activeVirtualCustomScrollbar = null;
    }
  }

  const clickable = getInteractiveTarget(targetEl);
  const isTargetUI = targetEl !== canvas && targetEl !== document.body && targetEl !== document.documentElement;

  if (uiOpen || isTargetUI || clickable || activeVirtualDragInput) {
    // Only preventDefault on elements that are not text inputs
    const isTextInput = (targetEl.tagName === "INPUT" && (targetEl.type === "text" || targetEl.type === "number" || targetEl.type === "search" || targetEl.type === "password")) || targetEl.tagName === "TEXTAREA";
    if (targetEl.tagName !== "SELECT" && targetEl.tagName !== "OPTION" && !isTextInput) {
      e.preventDefault();
    }
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") {
      e.stopImmediatePropagation();
    }

    if (didVirtualDrag && (e.type === "click" || e.type === "mouseup" || e.type === "pointerup")) {
      isVirtualMouseDown = false;
      activeVirtualDragTarget = null;
      didVirtualDrag = false;
      if (cursor) cursor.classList.remove("clicking");
      return;
    }

    isSyntheticEvent = true;
    try {
      const eventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: e.detail || 1,
        clientX: virtualCursorX,
        clientY: virtualCursorY,
        screenX: virtualCursorX,
        screenY: virtualCursorY,
        button: e.button !== undefined ? e.button : 0,
        buttons: (e.type === "mouseup" || e.type === "pointerup") ? 0 : (e.buttons || 1),
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey
      };

      let syntheticEvent;
      if (e.type.startsWith("pointer") && typeof PointerEvent === "function") {
        syntheticEvent = new PointerEvent(e.type, {
          ...eventInit,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true
        });
      } else {
        syntheticEvent = new MouseEvent(e.type, eventInit);
      }

      targetEl.dispatchEvent(syntheticEvent);

      if (e.type === "mouseup" || e.type === "pointerup") {
        if (cursor) cursor.classList.remove("clicking");
        lastVirtualMouseUpTime = Date.now();
        if (activeVirtualDragInput) {
          updateRangeInputFromVirtualCursor(activeVirtualDragInput, virtualCursorX);
          activeVirtualDragInput.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
          activeVirtualDragInput = null;
        }
        if (activeVirtualCustomScrollbar) {
          activeVirtualCustomScrollbar = null;
        }

        if (isVirtualDraggingSlot) {
          const dropTarget = document.elementFromPoint(virtualCursorX, virtualCursorY);
          if (dropTarget) {
            const dropEvt = new Event("drop", { bubbles: true, cancelable: true });
            dropEvt.dataTransfer = virtualDataTransfer;
            dropEvt.clientX = virtualCursorX;
            dropEvt.clientY = virtualCursorY;
            dropTarget.dispatchEvent(dropEvt);
            if (typeof dropTarget.ondrop === "function") {
              try { dropTarget.ondrop(dropEvt); } catch(err){}
            }
          }
          if (virtualDragSource) {
            const endEvt = new Event("dragend", { bubbles: true, cancelable: true });
            endEvt.dataTransfer = virtualDataTransfer;
            virtualDragSource.dispatchEvent(endEvt);
            if (typeof virtualDragSource.ondragend === "function") {
              try { virtualDragSource.ondragend(endEvt); } catch(err){}
            }
          }
          if (virtualDragGhost && virtualDragGhost.parentNode) {
            virtualDragGhost.parentNode.removeChild(virtualDragGhost);
          }
          virtualDragGhost = null;
          isVirtualDraggingSlot = false;
          virtualDragSource = null;
          virtualDataTransfer = null;
          virtualDragLastOver = null;
        }

        isVirtualMouseDown = false;
        activeVirtualDragTarget = null;
        didVirtualDrag = false;
      }

      if (e.type === "click") {
        didVirtualDrag = false;
        if (isTextInput) {
          try { targetEl.focus(); } catch(err){}
        } else {
          try { targetEl.blur(); } catch(err){}
        }

        // Toggle checkbox/radio if synthetic click didn't toggle native state
        if (targetEl.tagName === "INPUT" && (targetEl.type === "checkbox" || targetEl.type === "radio")) {
          if (!syntheticEvent.defaultPrevented) {
            if (targetEl.type === "checkbox") targetEl.checked = !targetEl.checked;
            else targetEl.checked = true;
            targetEl.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      }
    } catch (err) {
      console.warn("Error dispatching virtual mouse event:", err);
    } finally {
      isSyntheticEvent = false;
    }
  } else {
    if (e.type === "mouseup" || e.type === "pointerup") {
      if (cursor) cursor.classList.remove("clicking");
      if (activeVirtualDragInput) {
        updateRangeInputFromVirtualCursor(activeVirtualDragInput, virtualCursorX);
        activeVirtualDragInput.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
        activeVirtualDragInput = null;
      }
      isVirtualMouseDown = false;
      activeVirtualDragTarget = null;
      if (isVirtualDraggingSlot) {
        if (virtualDragGhost && virtualDragGhost.parentNode) {
          virtualDragGhost.parentNode.removeChild(virtualDragGhost);
        }
        virtualDragGhost = null;
        isVirtualDraggingSlot = false;
        virtualDragSource = null;
        virtualDataTransfer = null;
        virtualDragLastOver = null;
      }
      didVirtualDrag = false;
    }

    // Gameplay click on canvas: blur active element so keyboard inputs work
    if (document.activeElement && document.activeElement !== document.body && document.activeElement !== canvas) {
      if (document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        try { document.activeElement.blur(); } catch(err){}
      }
    }
  }
}

// Automatically blur focused buttons on keydown in gameplay so controls don't get trapped
window.addEventListener("keydown", (e) => {
  if (window.isWaitingForKey) return;
  if (!isUIOpen()) {
    if (document.activeElement && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      if (document.activeElement !== document.body) {
        try { document.activeElement.blur(); } catch(err){}
      }
    }
  }
}, true);

["mousedown", "mouseup", "click", "contextmenu", "pointerdown", "pointerup", "dblclick"].forEach(eventType => {
  window.addEventListener(eventType, redirectMouseEventToVirtualCursor, { capture: true });
});

window.addEventListener("mouseup", () => {
  isVirtualMouseDown = false;
  window.isCameraDragging = false;
  const cursor = document.getElementById("customGameCursor");
  if (cursor) cursor.classList.remove("clicking");
  updateVirtualCursorVisibility();
}, { capture: true, passive: true });

window.addEventListener("pointerup", () => {
  isVirtualMouseDown = false;
  window.isCameraDragging = false;
  const cursor = document.getElementById("customGameCursor");
  if (cursor) cursor.classList.remove("clicking");
  updateVirtualCursorVisibility();
}, { capture: true, passive: true });

// Scroll wheel handler: Cleanly decouples raw mouse input from simulated custom scrollbars
window.addEventListener("wheel", (e) => {
  if (isSyntheticEvent) return;

  // 1. Resolve coordinates & element under mouse or virtual cursor
  let ptX = e.clientX;
  let ptY = e.clientY;
  const isPointerLocked = !!(document.pointerLockElement || (typeof simulatedPointerLock !== "undefined" && simulatedPointerLock));
  if (isPointerLocked && typeof virtualCursorX === "number" && typeof virtualCursorY === "number") {
    ptX = virtualCursorX;
    ptY = virtualCursorY;
  } else if ((ptX === undefined || ptY === undefined || (ptX === 0 && ptY === 0)) && typeof virtualCursorX === "number" && typeof virtualCursorY === "number") {
    ptX = virtualCursorX;
    ptY = virtualCursorY;
  }

  let targetEl = null;
  if (typeof ptX === "number" && !isNaN(ptX) && typeof ptY === "number" && !isNaN(ptY)) {
    try { targetEl = document.elementFromPoint(ptX, ptY); } catch(err){}
  }
  if (!targetEl) targetEl = e.target;

  // 2. DevGame & Dev UI (RAW INPUT):
  // Directly handle native scrolling for #mainControls, .control-group, and dev panels without simulated scrollbar interference
  const mainControls = document.getElementById("mainControls") || document.querySelector(".controls");
  const isDevOpen = !!(window.controlsVisible || (mainControls && (mainControls.style.display === "flex" || (window.getComputedStyle && window.getComputedStyle(mainControls).display !== "none")) && mainControls.offsetParent !== null));

  let isDevTarget = false;
  if (isDevOpen && mainControls) {
    const rect = mainControls.getBoundingClientRect();
    if (typeof ptX === "number" && ptX >= rect.left && ptX <= rect.right && ptY >= rect.top && ptY <= rect.bottom) {
      isDevTarget = true;
    }
  }
  if (!isDevTarget) {
    isDevTarget = !!((targetEl && targetEl.closest && targetEl.closest("#mainControls, .controls, .control-group, [id^='dev'], [class*='dev']")) ||
                     (e.target && e.target.closest && e.target.closest("#mainControls, .controls, .control-group, [id^='dev'], [class*='dev']")));
  }

  if (isDevTarget) {
    e.preventDefault();
    e.stopPropagation();

    // Find the innermost scrollable container in DevGame that can scroll in the requested deltaY direction
    let scrollEl = null;
    let curr = targetEl || e.target;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      if (curr === mainControls) break; // Check inner containers first before the outer main window
      if (curr.scrollHeight > curr.clientHeight + 1) {
        const overflowY = window.getComputedStyle(curr).overflowY;
        if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
          const canScrollDown = e.deltaY > 0 && (curr.scrollTop + curr.clientHeight < curr.scrollHeight - 1);
          const canScrollUp = e.deltaY < 0 && (curr.scrollTop > 1);
          if (canScrollDown || canScrollUp) {
            scrollEl = curr;
            break;
          }
        }
      }
      curr = curr.parentElement;
    }

    // Fallback: If no inner container can scroll in this direction (or inner reached edge), bubble scroll to #mainControls
    if (!scrollEl && mainControls && (mainControls.scrollHeight > mainControls.clientHeight + 1)) {
      scrollEl = mainControls;
    }

    if (scrollEl) {
      scrollEl.scrollTop += e.deltaY;
    }
    // Raw input: NEVER invoke simulated inventory scrollbars and NEVER switch hotbar action slots or zoom camera
    return;
  }

  // 3. Simulated Custom Scrollbar Handling (Inventory & Save Select Overlays)
  function findScrollContainer(el) {
    let curr = el;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      if (curr.scrollHeight > curr.clientHeight + 2) {
        const overflowY = window.getComputedStyle(curr).overflowY;
        if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
          return curr;
        }
      }
      curr = curr.parentElement;
    }
    // Fallback: If mouse is over an open overlay/panel, return the active scrollable container inside it
    if (typeof window.getActiveScrollableContainer === "function") {
      const active = window.getActiveScrollableContainer();
      if (active && active.scrollHeight > active.clientHeight + 2) return active;
    }
    const saveList = document.getElementById("saveSlotsList");
    if (saveList && saveList.offsetParent !== null && saveList.scrollHeight > saveList.clientHeight + 2) {
      return saveList;
    }
    return null;
  }

  let scrollContainer = findScrollContainer(targetEl) || findScrollContainer(e.target);

  if (scrollContainer) {
    e.preventDefault();
    e.stopPropagation();
    scrollContainer.scrollTop += e.deltaY;
    // Decoupling: Only update the simulated custom scrollbar if the container is part of inventory or save select
    const isSimulatedScrollUI = scrollContainer.closest && scrollContainer.closest("#inventoryOverlay, #saveSelectOverlay");
    if (isSimulatedScrollUI) {
      if (typeof updateCustomScrollbar === "function") {
        try { updateCustomScrollbar(); } catch(err){}
      } else if (typeof window.updateCustomScrollbar === "function") {
        try { window.updateCustomScrollbar(); } catch(err){}
      }
    }
  } else if (typeof isUIOpen === "function" && isUIOpen()) {
    // Over open UI panel/overlay background or padding -> scroll active list if available, prevent camera zoom
    e.preventDefault();
    e.stopPropagation();
    const active = (typeof window.getActiveScrollableContainer === "function" ? window.getActiveScrollableContainer() : null) || document.getElementById("saveSlotsList");
    if (active && active.scrollHeight > active.clientHeight + 2) {
      active.scrollTop += e.deltaY;
      if (typeof updateCustomScrollbar === "function") {
        try { updateCustomScrollbar(); } catch(err){}
      } else if (typeof window.updateCustomScrollbar === "function") {
        try { window.updateCustomScrollbar(); } catch(err){}
      }
    }
  } else if (!isUIOpen()) {
    // If no scrollable UI is open and we are in active gameplay on canvas, switch hotbar action slot
    const isTargetCanvas = (e.target === canvas) || (targetEl === canvas) || (!targetEl && !e.target);
    if (isTargetCanvas && typeof selectedActionSlotIndex !== "undefined" && typeof renderActionSlots === "function") {
      const delta = e.deltaY > 0 ? 1 : -1;
      let nextIdx = selectedActionSlotIndex + delta;
      if (nextIdx > 8) nextIdx = 0;
      if (nextIdx < 0) nextIdx = 8;
      selectedActionSlotIndex = nextIdx;
      renderActionSlots();
    }
  }
}, { capture: true, passive: false });

      // Disable context menu for game
      document.addEventListener("contextmenu", (e) => e.preventDefault());
      document.addEventListener("selectstart", (e) => e.preventDefault());

      // Prevent accidental browser hotkeys (like Ctrl+W, Ctrl+R, F5) and DevTools (F12, Ctrl+Shift+I) from interrupting the game
      window.addEventListener("keydown", (e) => {
        // Block F12
        if (e.key === "F12" || e.keyCode === 123) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Ctrl+Shift+I or Cmd+Option+I (Inspect element / DevTools)
        if ((e.ctrlKey || e.metaKey) && (e.shiftKey || e.altKey) && (e.key === "i" || e.key === "I" || e.keyCode === 73)) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Ctrl+Shift+J or Cmd+Option+J (DevTools Console)
        if ((e.ctrlKey || e.metaKey) && (e.shiftKey || e.altKey) && (e.key === "j" || e.key === "J" || e.keyCode === 74)) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Ctrl+Shift+C or Cmd+Option+C (Inspect element selection tool)
        if ((e.ctrlKey || e.metaKey) && (e.shiftKey || e.altKey) && (e.key === "c" || e.key === "C" || e.keyCode === 67)) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Ctrl+U or Cmd+U (View Source)
        if ((e.ctrlKey || e.metaKey) && (e.key === "u" || e.key === "U" || e.keyCode === 85)) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Ctrl+W or Cmd+W (close window)
        if ((e.ctrlKey || e.metaKey) && (e.key === "w" || e.key === "W")) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Ctrl+R or Cmd+R (reload page)
        if ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R")) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Ctrl+Shift+R or Cmd+Shift+R (hard reload)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "r" || e.key === "R")) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block F5 (reload page)
        if (e.key === "F5" || e.keyCode === 116) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Ctrl+F5
        if ((e.ctrlKey || e.metaKey) && (e.key === "F5" || e.keyCode === 116)) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Alt+Left Arrow / Alt+Right Arrow (browser history navigation)
        if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true); // Use capturing phase (true) to intercept before default actions or other handlers run


      // ============================================
      // Hash & Noise functions (Optimized 3D bitwise integer hash)
      // ============================================
      function hash3D(x, y, z, seed) {
        const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
        let h = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (Math.floor(seed) * 1597334677);
        h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
        return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2.0 - 1.0;
      }

      function smoothNoise(x, y, z, seed) {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const iz = Math.floor(z);
        const fx = x - ix;
        const fy = y - iy;
        const fz = z - iz;

        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const sz = fz * fz * (3 - 2 * fz);

        const om_sx = 1 - sx;
        const om_sy = 1 - sy;
        const om_sz = 1 - sz;

        const s = (Math.floor(seed) * 1597334677) | 0;

        // Fast inlined 3D integer hash (zero trig, zero modulo)
        const getHash = (x0, y0, z0) => {
          let h = (x0 * 73856093) ^ (y0 * 19349663) ^ (z0 * 83492791) ^ s;
          h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
          h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
          return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2.0 - 1.0;
        };

        const h000 = getHash(ix, iy, iz);
        const h001 = getHash(ix, iy, iz + 1);
        const h010 = getHash(ix, iy + 1, iz);
        const h011 = getHash(ix, iy + 1, iz + 1);
        const h100 = getHash(ix + 1, iy, iz);
        const h101 = getHash(ix + 1, iy, iz + 1);
        const h110 = getHash(ix + 1, iy + 1, iz);
        const h111 = getHash(ix + 1, iy + 1, iz + 1);

        return h000 * (om_sx * om_sy * om_sz) +
               h001 * (om_sx * om_sy * sz) +
               h010 * (om_sx * sy * om_sz) +
               h011 * (om_sx * sy * sz) +
               h100 * (sx * om_sy * om_sz) +
               h101 * (sx * om_sy * sz) +
               h110 * (sx * sy * om_sz) +
               h111 * (sx * sy * sz);
      }

      function fbmNoise(x, y, z, seed, octaves = 5) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxVal = 0;
        for (let i = 0; i < octaves; i++) {
          value +=
            amplitude *
            smoothNoise(
              x * frequency,
              y * frequency,
              z * frequency,
              seed + i * 1000,
            );
          maxVal += amplitude;
          amplitude *= 0.5;
          frequency *= 2.1 + i * 0.1;
        }
        return value / maxVal;
      }

      let prngState = 12345;
      function mulberry32(a) {
        return function () {
          var t = (a += 0x6d2b79f5);
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }

      let customRandom = Math.random;


      // ============================================
      // เมทริกซ์
      // ============================================
      function createIdentity() {
        return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      }

      function createTranslation(x, y, z) {
        return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
      }

      function createScale(sx, sy, sz) {
        return [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
      }
      if (typeof window !== "undefined") {
        window.createIdentity = createIdentity;
        window.createTranslation = createTranslation;
        window.createScale = createScale;
      }

      function multiplyMatrices(a, b) {
        const result = new Array(16);
        for (let col = 0; col < 4; col++) {
          for (let row = 0; row < 4; row++) {
            result[col * 4 + row] =
              a[0 * 4 + row] * b[col * 4 + 0] +
              a[1 * 4 + row] * b[col * 4 + 1] +
              a[2 * 4 + row] * b[col * 4 + 2] +
              a[3 * 4 + row] * b[col * 4 + 3];
          }
        }
        return result;
      }

      function createPerspective(fov, aspect, near, far) {
        const f = 1.0 / Math.tan(fov / 2);
        const nf = 1.0 / (near - far);
        return [
          f / aspect,
          0,
          0,
          0,
          0,
          f,
          0,
          0,
          0,
          0,
          (far + near) * nf,
          -1,
          0,
          0,
          2 * far * near * nf,
          0,
        ];
      }

      function createOrtho(left, right, bottom, top, near, far) {
        const lr = 1.0 / (left - right);
        const bt = 1.0 / (bottom - top);
        const nf = 1.0 / (near - far);
        return [
          -2.0 * lr,
          0,
          0,
          0,
          0,
          -2.0 * bt,
          0,
          0,
          0,
          0,
          2.0 * nf,
          0,
          (left + right) * lr,
          (top + bottom) * bt,
          (far + near) * nf,
          1,
        ];
      }

      function createLookAt(eye, target, up) {
        const [ex, ey, ez] = eye;
        const [tx, ty, tz] = target;
        const [ux, uy, uz] = up;

        const zx = ex - tx,
          zy = ey - ty,
          zz = ez - tz;
        const lenZ = Math.sqrt(zx * zx + zy * zy + zz * zz);
        const fzx = zx / lenZ,
          fzy = zy / lenZ,
          fzz = zz / lenZ;

        const xx = uy * fzz - uz * fzy;
        const xy = uz * fzx - ux * fzz;
        const xz = ux * fzy - uy * fzx;
        const lenX = Math.sqrt(xx * xx + xy * xy + xz * xz);
        const fxx = xx / lenX,
          fxy = xy / lenX,
          fxz = xz / lenX;

        const yx = fzy * fxz - fzz * fxy;
        const yy = fzz * fxx - fzx * fxz;
        const yz = fzx * fxy - fzy * fxx;

        return [
          fxx,
          yx,
          fzx,
          0,
          fxy,
          yy,
          fzy,
          0,
          fxz,
          yz,
          fzz,
          0,
          -(fxx * ex + fxy * ey + fxz * ez),
          -(yx * ex + yy * ey + yz * ez),
          -(fzx * ex + fzy * ey + fzz * ez),
          1,
        ];
      }

      // ============================================
      // ควบคุม
      // ============================================
      let isDragging = false;
      let prevX = 0,
        prevY = 0;
      let isDemolishModeEnabled = false;
      let isTerrainModModeEnabled = false;
      var rotationX = 0.5;
      var rotationY = 0.8;
      let smashInterval = null;

// Missing global declarations
var activeInteractNPC = null;
var activeTargetNPC = null;
var bowComboActive = false;
var cameraSpringArm = null;
var currentCampfires = [];
var keepLoadedTunnels = false;
var lastBowDrawPower = 0;
var lastBowShootTime = 0;
var playerControlsLocked = false;
var terrainMods = [];
var terrainRawVertices = [];
var tunnels3D = [];
var wasUsingBowBeforeSwimming = false;
var globalSeed = 0;

// === VIRTUAL CURSOR SELECT FIX ===
// Native <select> elements cannot be opened by synthetic clicks from the virtual cursor.
// We convert them into custom HTML dropdowns that work perfectly with virtual clicks.
function convertAllSelectsToCustomDropdowns() {
  document.querySelectorAll('select').forEach(selectElement => {
    if (selectElement.dataset.customized) return;
    selectElement.dataset.customized = "true";

    selectElement.style.display = 'none';

    const container = document.createElement('div');
    container.className = "custom-select-container game-ui";
    container.style.position = "relative";
    container.style.width = selectElement.style.width || "100%";
    container.style.marginTop = selectElement.style.marginTop || "0";
    container.style.marginBottom = selectElement.style.marginBottom || "0";
    
    const display = document.createElement('div');
    display.className = "custom-select-display clickable game-ui";
    display.style.cssText = selectElement.style.cssText;
    display.style.display = "flex";
    display.style.alignItems = "center";
    display.style.justifyContent = "space-between";
    display.style.cursor = "pointer";
    display.style.boxSizing = "border-box";
    display.style.userSelect = "none";
    
    const displayText = document.createElement('span');
    displayText.style.overflow = "hidden";
    displayText.style.textOverflow = "ellipsis";
    displayText.style.whiteSpace = "nowrap";

    const arrow = document.createElement('span');
    arrow.innerHTML = "▼";
    arrow.style.fontSize = "0.625rem";
    arrow.style.marginLeft = "0.5rem";
    
    display.appendChild(displayText);
    display.appendChild(arrow);
    
    const list = document.createElement('div');
    list.className = "custom-select-list game-ui";
    list.style.position = "absolute";
    list.style.top = "100%";
    list.style.left = "0";
    list.style.width = "100%";
    list.style.maxHeight = "12.5rem";
    list.style.overflowY = "auto";
    list.style.background = "#1a1a1a";
    list.style.border = "1px solid #dfb76c";
    list.style.zIndex = "10050";
    list.style.display = "none";
    list.style.boxSizing = "border-box";
    list.style.boxShadow = "0 0.25rem 0.75rem rgba(0,0,0,0.8)";
    
    const updateDisplay = () => {
      const selectedOption = selectElement.options[selectElement.selectedIndex];
      if (selectedOption) {
        displayText.textContent = selectedOption.textContent;
      } else {
        displayText.textContent = "Select...";
      }
    };
    
    const populateList = () => {
      list.innerHTML = "";
      Array.from(selectElement.options).forEach((opt, index) => {
        const item = document.createElement('div');
        item.className = "custom-select-item clickable game-ui";
        item.textContent = opt.textContent;
        item.style.padding = "0.5rem";
        item.style.cursor = "pointer";
        item.style.color = "#fff";
        item.style.borderBottom = "1px solid #333";
        item.style.fontSize = "0.75rem";
        item.style.fontFamily = "'Google Sans', sans-serif";
        
        item.addEventListener("mouseenter", () => item.style.background = "rgba(223, 183, 108, 0.2)");
        item.addEventListener("mouseleave", () => item.style.background = "transparent");
        
        item.addEventListener("click", (e) => {
          selectElement.selectedIndex = index;
          selectElement.dispatchEvent(new Event("change", { bubbles: true }));
          updateDisplay();
          list.style.display = "none";
          e.stopPropagation();
        });
        
        list.appendChild(item);
      });
    };
    
    selectElement.addEventListener("change", updateDisplay);
    
    display.addEventListener("click", (e) => {
      populateList();
      const isOpen = list.style.display === "block";
      document.querySelectorAll(".custom-select-list").forEach(el => el.style.display = "none");
      if (!isOpen) {
        list.style.display = "block";
        list.scrollTop = 0;
      }
      e.stopPropagation();
    });
    
    document.addEventListener("click", (e) => {
      if (!container.contains(e.target)) {
        list.style.display = "none";
      }
    });

    const observer = new MutationObserver(() => {
      updateDisplay();
    });
    observer.observe(selectElement, { childList: true });

    container.appendChild(display);
    container.appendChild(list);
    
    selectElement.parentNode.insertBefore(container, selectElement.nextSibling);
    updateDisplay();
  });
}

document.addEventListener("DOMContentLoaded", convertAllSelectsToCustomDropdowns);
if (document.readyState === "complete" || document.readyState === "interactive") {
  convertAllSelectsToCustomDropdowns();
}

// === SEEDPLANET ENGINE: SPATIAL HASH GRID SYSTEM ===
// ระบบ Spatial Partitioning แบบ 3D Hash Grid
// ช่วยลดเวลาค้นหาวัตถุ / สิ่งปลูกสร้าง / ไอเทม จาก O(N) เป็น O(1)
// ทำให้รองรับไอเทมและบ้านได้นับหมื่นชิ้นโดยไม่ทำให้ CPU กระตุก

(function(global) {
  'use strict';

  const CELL_SIZE = 4.0; // 4.0 เมตร เหมาะสมที่สุดสำหรับขนาดตัวละครและระยะปฏิสัมพันธ์ (1.0 - 3.5m)
  const INV_CELL_SIZE = 1.0 / CELL_SIZE;

  class SpatialGridSystem {
    constructor() {
      this.cellSize = CELL_SIZE;
      this.invCellSize = INV_CELL_SIZE;
      // Key: "cx,cy,cz" -> Array of items
      this.cells = new Map();
      this.dynamicItems = [];
      this.lastSourceArray = null;
      this.lastLength = -1;
      this.version = 0;
    }

    _getCellCoord(val) {
      return Math.floor(val * this.invCellSize);
    }

    _getCellKey(cx, cy, cz) {
      return `${cx},${cy},${cz}`;
    }

    clear() {
      this.cells.clear();
      this.dynamicItems.length = 0;
      this.lastSourceArray = null;
      this.lastLength = -1;
      this.version++;
    }

    // สร้างตาราง Spatial Grid ใหม่จากรายการของในโลก
    rebuild(sourceArray) {
      this.cells.clear();
      this.dynamicItems.length = 0;

      if (!sourceArray) {
        sourceArray = global.collectibles;
      }
      if (!sourceArray || !Array.isArray(sourceArray)) {
        this.lastSourceArray = null;
        this.lastLength = 0;
        return;
      }

      this.lastSourceArray = sourceArray;
      this.lastLength = sourceArray.length;
      this.version++;

      for (let i = 0; i < sourceArray.length; i++) {
        const item = sourceArray[i];
        if (!item || !item.active || !item.position) continue;

        if (item.isDynamic) {
          this.dynamicItems.push(item);
        }

        const cx = this._getCellCoord(item.position[0]);
        const cy = this._getCellCoord(item.position[1]);
        const cz = this._getCellCoord(item.position[2]);
        const key = this._getCellKey(cx, cy, cz);

        let cell = this.cells.get(key);
        if (!cell) {
          cell = [];
          this.cells.set(key, cell);
        }
        cell.push(item);
      }
    }

    // ตรวจสอบและซิงค์อัตโนมัติหากจำนวนวัตถุมีการเปลี่ยนแปลง
    ensureSynced(sourceArray) {
      if (!sourceArray) {
        sourceArray = global.collectibles;
      }
      if (!sourceArray || !Array.isArray(sourceArray)) return;

      if (sourceArray !== this.lastSourceArray || sourceArray.length !== this.lastLength) {
        this.rebuild(sourceArray);
      }
    }

    // แทรกไอเทมชิ้นใหม่เข้ากริดทันที (เช่น เมื่อวางสิ่งปลูกสร้าง)
    insert(item) {
      if (!item || !item.active || !item.position) return;
      if (item.isDynamic && !this.dynamicItems.includes(item)) {
        this.dynamicItems.push(item);
      }
      const cx = this._getCellCoord(item.position[0]);
      const cy = this._getCellCoord(item.position[1]);
      const cz = this._getCellCoord(item.position[2]);
      const key = this._getCellKey(cx, cy, cz);
      let cell = this.cells.get(key);
      if (!cell) {
        cell = [];
        this.cells.set(key, cell);
      }
      if (!cell.includes(item)) {
        cell.push(item);
      }
      if (this.lastSourceArray && Array.isArray(this.lastSourceArray)) {
        this.lastLength = this.lastSourceArray.length;
      }
      this.version++;
    }

    // ค้นหาวัตถุในรัศมี (x, y, z, radius)
    // สามารถใส่ filterFn(item) เพื่อคัดกรองประเภทที่ต้องการได้ทันที
    queryRadius(x, y, z, radius, filterFn) {
      this.ensureSynced();

      const r = radius > 0 ? radius : 1.0;
      const rSq = r * r;
      const minX = this._getCellCoord(x - r);
      const maxX = this._getCellCoord(x + r);
      const minY = this._getCellCoord(y - r);
      const maxY = this._getCellCoord(y + r);
      const minZ = this._getCellCoord(z - r);
      const maxZ = this._getCellCoord(z + r);

      const results = [];
      const seen = new Set();

      for (let cx = minX; cx <= maxX; cx++) {
        for (let cy = minY; cy <= maxY; cy++) {
          for (let cz = minZ; cz <= maxZ; cz++) {
            const key = this._getCellKey(cx, cy, cz);
            const cell = this.cells.get(key);
            if (!cell) continue;

            for (let i = 0; i < cell.length; i++) {
              const item = cell[i];
              if (!item.active || seen.has(item) || !item.position) continue;

              const dx = item.position[0] - x;
              const dy = item.position[1] - y;
              const dz = item.position[2] - z;
              if (dx * dx + dy * dy + dz * dz <= rSq) {
                seen.add(item);
                if (!filterFn || filterFn(item)) {
                  results.push(item);
                }
              }
            }
          }
        }
      }

      // ตรวจสอบวัตถุเคลื่อนที่ (Dynamic Objects)
      for (let i = 0; i < this.dynamicItems.length; i++) {
        const item = this.dynamicItems[i];
        if (!item.active || seen.has(item) || !item.position) continue;
        const dx = item.position[0] - x;
        const dy = item.position[1] - y;
        const dz = item.position[2] - z;
        if (dx * dx + dy * dy + dz * dz <= rSq) {
          seen.add(item);
          if (!filterFn || filterFn(item)) {
            results.push(item);
          }
        }
      }

      return results;
    }

    // ค้นหาวัตถุใกล้เส้นสายตา / ลำเส้นกล้อง (Segment between p0 and p1)
    querySegment(p0, p1, radius, filterFn) {
      this.ensureSynced();

      const minX = Math.min(p0[0], p1[0]) - radius;
      const maxX = Math.max(p0[0], p1[0]) + radius;
      const minY = Math.min(p0[1], p1[1]) - radius;
      const maxY = Math.max(p0[1], p1[1]) + radius;
      const minZ = Math.min(p0[2], p1[2]) - radius;
      const maxZ = Math.max(p0[2], p1[2]) + radius;

      const minCX = this._getCellCoord(minX);
      const maxCX = this._getCellCoord(maxX);
      const minCY = this._getCellCoord(minY);
      const maxCY = this._getCellCoord(maxY);
      const minCZ = this._getCellCoord(minZ);
      const maxCZ = this._getCellCoord(maxZ);

      const results = [];
      const seen = new Set();
      const rSq = radius * radius;

      const vx = p1[0] - p0[0];
      const vy = p1[1] - p0[1];
      const vz = p1[2] - p0[2];
      const vLenSq = vx * vx + vy * vy + vz * vz;

      for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cy = minCY; cy <= maxCY; cy++) {
          for (let cz = minCZ; cz <= maxCZ; cz++) {
            const key = this._getCellKey(cx, cy, cz);
            const cell = this.cells.get(key);
            if (!cell) continue;

            for (let i = 0; i < cell.length; i++) {
              const item = cell[i];
              if (!item.active || seen.has(item) || !item.position) continue;

              let distSq;
              if (vLenSq < 1e-6) {
                const dx = item.position[0] - p0[0];
                const dy = item.position[1] - p0[1];
                const dz = item.position[2] - p0[2];
                distSq = dx * dx + dy * dy + dz * dz;
              } else {
                const wx = item.position[0] - p0[0];
                const wy = item.position[1] - p0[1];
                const wz = item.position[2] - p0[2];
                const t = Math.max(0, Math.min(1, (wx * vx + wy * vy + wz * vz) / vLenSq));
                const px = p0[0] + t * vx;
                const py = p0[1] + t * vy;
                const pz = p0[2] + t * vz;
                const dx = item.position[0] - px;
                const dy = item.position[1] - py;
                const dz = item.position[2] - pz;
                distSq = dx * dx + dy * dy + dz * dz;
              }

              if (distSq <= rSq) {
                seen.add(item);
                if (!filterFn || filterFn(item)) {
                  results.push(item);
                }
              }
            }
          }
        }
      }

      // วัตถุ Dynamic
      for (let i = 0; i < this.dynamicItems.length; i++) {
        const item = this.dynamicItems[i];
        if (!item.active || seen.has(item) || !item.position) continue;

        let distSq;
        if (vLenSq < 1e-6) {
          const dx = item.position[0] - p0[0];
          const dy = item.position[1] - p0[1];
          const dz = item.position[2] - p0[2];
          distSq = dx * dx + dy * dy + dz * dz;
        } else {
          const wx = item.position[0] - p0[0];
          const wy = item.position[1] - p0[1];
          const wz = item.position[2] - p0[2];
          const t = Math.max(0, Math.min(1, (wx * vx + wy * vy + wz * vz) / vLenSq));
          const px = p0[0] + t * vx;
          const py = p0[1] + t * vy;
          const pz = p0[2] + t * vz;
          const dx = item.position[0] - px;
          const dy = item.position[1] - py;
          const dz = item.position[2] - pz;
          distSq = dx * dx + dy * dy + dz * dz;
        }

        if (distSq <= rSq) {
          seen.add(item);
          if (!filterFn || filterFn(item)) {
            results.push(item);
          }
        }
      }

      return results;
    }
  }

  const SpatialGrid = new SpatialGridSystem();
  global.SpatialGrid = SpatialGrid;

})(typeof window !== 'undefined' ? window : this);

// === SEEDPLANET MODULE: JS/ENGINE/GAMEPAD.JS ===
// Gamepad support for Xbox and PlayStation controllers
//
// Mappings:
// - RB (R1): Left Click (Mouse 0) - Attack / Shoot / Place / Smash
// - RT (R2): Right Click (Mouse 2) - Dig / Secondary action
// - LB (L1): Key E - Interact / Gather / Ride / Dive
// - LT (L2): Key Q - Rotate item / Swim Up / Fly
// - Menu / Options / Start (Button 9): Key Tab - Inventory / Close Chest
// - D-Pad:
//     Up    -> 1 (Action Slot 1)
//     Right -> 2 (Action Slot 2)
//     Down  -> 3 (Action Slot 3)
//     Left  -> 4 (Action Slot 4)
// - LS (Left Stick): Walk / Move (or Virtual Cursor in UI)
// - RS (Right Stick): Rotate Camera (Look Yaw & Pitch)
// - A (✕): Jump (Spacebar) / Confirm
// - B (◯): Back / Cancel / Close UI
// - X (◻): Toggle Demolish Mode (CapsLock)
// - Y (△): Quick Shortcut to bottom action buttons in inventory
// - LS Click (L3): Sprint (Shift)
// - RS Click (R3): Center Camera View

(function() {
  const GamepadController = {
    connected: false,
    gamepadIndex: -1,
    controllerName: "Gamepad",
    brand: "xbox", // "xbox", "playstation", "switch"
    isPlayStation: false,
    isXbox: false,
    isSwitch: false,

    // Dedicated button state trackers for clean edge detection
    prevLBDown: false,
    prevLTDown: false,
    prevRBDown: false,
    prevRTDown: false,
    prevMenuDown: false,
    prevADown: false,
    prevBDown: false,
    prevXDown: false,
    prevYDown: false,
    prevL3Down: false,
    prevR3Down: false,
    prevDUp: false,
    prevDDown: false,
    prevDLeft: false,
    prevDRight: false,

    // UI Slot / Element Navigation State
    uiNav: {
      area: "grid",   // "grid", "action", "bottom", "tabs", "cards", "settings", "startMenu", "startSocial", "saveSelect"
      index: 0,
      settingsRow: 0,
      settingsCol: 0,
      saveRow: 0,
      saveCol: 0,
      repeatTimer: 0,
      lastDir: null,
      wasUIOpen: false
    },

    // Deadzone and sensitivity configuration
    deadzoneStick: 0.14,
    deadzoneTrigger: 0.18,
    lookSensitivity: 2.5, // radians per second
    cursorSpeed: 750,     // pixels per second in UI

    // Track active states
    activeLBCode: null,
    activeLTCode: null,
    isRBDown: false,
    isRTDown: false,
    jumpTriggered: false,
    lastUpdateTimestamp: 0,

    setInputDeviceMode: function(useGamepad) {
      const isGp = !!useGamepad;
      if (window.isUsingGamepad === isGp) return;
      window.isUsingGamepad = isGp;

      if (typeof window.syncInputDeviceSettingsUI === "function") {
        try { window.syncInputDeviceSettingsUI(); } catch (err) {}
      }

      // Invalidate 3D UI sign textures so boat / mech billboards redraw immediately
      if (typeof World3DUI !== "undefined" && World3DUI.signs) {
        for (const sign of World3DUI.signs.values()) {
          sign.needsTextureUpdate = true;
        }
      }

      // Invalidate touch buttons state to force an immediate re-render on next frame
      window._lastIsGpState = null;
    },

    init: function() {
      window.addEventListener("gamepadconnected", (e) => {
        this.onConnect(e.gamepad);
      });

      window.addEventListener("gamepaddisconnected", (e) => {
        this.onDisconnect(e.gamepad);
      });

      // Check immediately if any gamepad is already connected
      if (typeof navigator !== "undefined" && navigator.getGamepads) {
        try {
          const gps = navigator.getGamepads();
          if (gps) {
            for (let i = 0; i < gps.length; i++) {
              if (gps[i] && gps[i].connected) {
                this.onConnect(gps[i]);
                break;
              }
            }
          }
        } catch (e) {}
      }

      // Listen for actual keyboard and mouse inputs to seamlessly switch back from Gamepad to Keyboard UI hints
      const onUserKeyboardMouseInput = (e) => {
        if (!window.isUsingGamepad) return;
        if (e && e.isTrusted === false) return;
        if (e && e.simulated) return;
        this.setInputDeviceMode(false);
      };

      window.addEventListener("keydown", onUserKeyboardMouseInput, { passive: true, capture: true });
      window.addEventListener("mousedown", onUserKeyboardMouseInput, { passive: true, capture: true });
      window.addEventListener("wheel", onUserKeyboardMouseInput, { passive: true, capture: true });
      window.addEventListener("touchstart", onUserKeyboardMouseInput, { passive: true, capture: true });

      let lastMouseX = null;
      let lastMouseY = null;
      window.addEventListener("mousemove", (e) => {
        if (!window.isUsingGamepad) return;
        if (e && (e.isTrusted === false || e.simulated)) return;
        const dx = Math.abs(e.movementX || 0);
        const dy = Math.abs(e.movementY || 0);
        if (dx > 2 || dy > 2) {
          this.setInputDeviceMode(false);
        } else if (lastMouseX !== null) {
          if (Math.abs(e.clientX - lastMouseX) > 6 || Math.abs(e.clientY - lastMouseY) > 6) {
            this.setInputDeviceMode(false);
          }
        }
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }, { passive: true, capture: true });

      // Continuous RAF loop so gamepad input works seamlessly everywhere (Start screen, Save selector, Menus, etc.)
      let lastTime = performance.now();
      const loop = (time) => {
        const dt = Math.max(0.001, Math.min(0.05, (time - lastTime) / 1000));
        lastTime = time;
        const isGameStarted = (typeof gameStarted !== "undefined" && gameStarted) || (typeof window.gameStarted !== "undefined" && window.gameStarted);
        if (!isGameStarted) {
          try {
            this.update(dt);
          } catch (err) {
            console.error("Gamepad title screen update error:", err);
          }
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      console.log("🎮 Gamepad controller subsystem initialized with continuous title/gameplay loop");
    },

    detectGamepadBrand: function(gp) {
      if (!gp) return this.brand || "xbox";
      const idLower = (gp.id || "").toLowerCase();
      if (
        idLower.includes("dualshock") ||
        idLower.includes("dualsense") ||
        idLower.includes("playstation") ||
        idLower.includes("sony") ||
        idLower.includes("054c") ||
        idLower.includes("ps3") ||
        idLower.includes("ps4") ||
        idLower.includes("ps5") ||
        idLower.includes("wireless controller")
      ) {
        return "playstation";
      }
      if (
        idLower.includes("switch") ||
        idLower.includes("joy-con") ||
        idLower.includes("pro controller") ||
        idLower.includes("057e") ||
        idLower.includes("nintendo")
      ) {
        return "switch";
      }
      if (
        idLower.includes("xbox") ||
        idLower.includes("x-box") ||
        idLower.includes("045e") ||
        idLower.includes("microsoft")
      ) {
        return "xbox";
      }
      return "xbox";
    },

    getBrand: function() {
      if (this.isPlayStation) return "playstation";
      if (this.isSwitch) return "switch";
      return "xbox";
    },

    getButtonLabel: function(action) {
      const isGp = (typeof window.isCurrentlyGamepadMode === "function")
        ? window.isCurrentlyGamepadMode()
        : !!(this.connected && window.isUsingGamepad);
      if (!isGp) {
        switch (action) {
          case "interact": return "E";
          case "rotate": return "Q";
          case "swimUp": return "Shift";
          case "swimDown": return "Z";
          case "attack": return "L-Click";
          case "dig": return "R-Click";
          case "throttle": return "W";
          case "jump": return "Space";
          case "cancel": return "Esc";
          case "demolish": return "CapsLock";
          case "menu": return "Tab";
          case "flightThrottle": return "W";
          case "flightClimb": return "Shift";
          case "flightDive": return "Z";
          case "flightSteer": return "A/D";
          default: return "E";
        }
      }

      const brand = this.getBrand();
      if (brand === "playstation") {
        switch (action) {
          case "interact": return "L1";
          case "rotate": return "L2";
          case "swimUp": return "L2";
          case "swimDown": return "L-Stick ⬇️";
          case "attack": return "R1";
          case "dig": return "R2";
          case "throttle": return "R2";
          case "jump": return "✕";
          case "cancel": return "◯";
          case "demolish": return "■";
          case "shortcut": return "▲";
          case "menu": return "Options";
          case "flightThrottle": return "R2";
          case "flightClimb": return "L-Stick ⬆️";
          case "flightDive": return "L-Stick ⬇️";
          case "flightSteer": return "L-Stick ⬅️➡️";
          case "lstick": return "L-Stick";
          case "rstick": return "R-Stick";
          case "l3": return "L3";
          case "r3": return "R3";
          default: return "L1";
        }
      } else if (brand === "switch") {
        switch (action) {
          case "interact": return "L";
          case "rotate": return "ZL";
          case "swimUp": return "ZL";
          case "swimDown": return "L-Stick ⬇️";
          case "attack": return "R";
          case "dig": return "ZR";
          case "throttle": return "ZR";
          case "jump": return "B";
          case "cancel": return "A";
          case "demolish": return "Y";
          case "shortcut": return "X";
          case "menu": return "+";
          case "flightThrottle": return "ZR";
          case "flightClimb": return "L-Stick ⬆️";
          case "flightDive": return "L-Stick ⬇️";
          case "flightSteer": return "L-Stick ⬅️➡️";
          case "lstick": return "L-Stick";
          case "rstick": return "R-Stick";
          case "l3": return "L-Stick (กด)";
          case "r3": return "R-Stick (กด)";
          default: return "L";
        }
      } else {
        // Xbox / Generic
        switch (action) {
          case "interact": return "LB";
          case "rotate": return "LT";
          case "swimUp": return "LT";
          case "swimDown": return "LS ⬇️";
          case "attack": return "RB";
          case "dig": return "RT";
          case "throttle": return "RT";
          case "jump": return "A";
          case "cancel": return "B";
          case "demolish": return "X";
          case "shortcut": return "Y";
          case "menu": return "Menu";
          case "flightThrottle": return "RT";
          case "flightClimb": return "LS ⬆️";
          case "flightDive": return "LS ⬇️";
          case "flightSteer": return "LS ⬅️➡️";
          case "lstick": return "LS";
          case "rstick": return "RS";
          case "l3": return "LS (กด)";
          case "r3": return "RS (กด)";
          default: return "LB";
        }
      }
    },

    formatPromptText: function(text) {
      if (!text || typeof text !== "string") return text;
      const isGp = (typeof window.isCurrentlyGamepadMode === "function")
        ? window.isCurrentlyGamepadMode()
        : !!(this.connected && window.isUsingGamepad);
      if (!isGp) return text;

      const interact = this.getButtonLabel("interact");
      const rotate = this.getButtonLabel("rotate");
      const attack = this.getButtonLabel("attack");
      const dig = this.getButtonLabel("dig");
      const throttle = this.getButtonLabel("flightThrottle");
      const climb = this.getButtonLabel("flightClimb");
      const dive = this.getButtonLabel("flightDive");

      let out = text;

      // Flight specific replacements
      if (out.includes("เปิดโหมดบิน") || out.includes("บินไปข้างหน้า") || out.includes("ดิ่งลง")) {
        out = out.replace(/กด\s*Shift\s*เพื่อเปิดโหมดบิน/gi, `เร่งเครื่อง [${throttle}] หรือดัน [${climb}] เพื่อบิน`);
        out = out.replace(/กด\s*W\s*บินไปข้างหน้า/gi, `เร่งเครื่อง [${throttle}]`);
        out = out.replace(/กด\s*Z\s*ดิ่งลง/gi, `ดัน [${dive}] เพื่อดิ่งลง`);
        out = out.replace(/วิ่งเร่งความเร็ว\s*\[W\]/gi, `เร่งเครื่อง [${throttle}]`);
        out = out.replace(/กด\s*\[Shift\]\s*เพื่อเปิดโหมดบิน/gi, `ดัน [${climb}] เพื่อบินขึ้น`);
        out = out.replace(/\[Z\]\s*ดิ่งลง/gi, `ดัน [${dive}] เพื่อดิ่งลง`);
      }

      // Bracketed keys
      out = out.replace(/\[E\]/g, `[${interact}]`);
      out = out.replace(/\(HOLD\s*\[?E\]?\s*TO\s*OPEN\s*CHEST\)/gi, `(HOLD [${interact}] TO OPEN CHEST)`);
      out = out.replace(/\(HOLD\s*\[?E\]?\s*TO\s*COOK\)/gi, `(HOLD [${interact}] TO COOK)`);
      out = out.replace(/\(Hold\s*E\)/gi, `(Hold ${interact})`);
      out = out.replace(/\[Q\]/g, `[${rotate}]`);
      out = out.replace(/\[RT\]/g, `[${dig}]`);
      out = out.replace(/\[RB\]/g, `[${attack}]`);
      out = out.replace(/\[LT\]/g, `[${rotate}]`);
      out = out.replace(/\[LB\]/g, `[${interact}]`);
      out = out.replace(/\[Stick Up\]/g, `[${climb}]`);
      out = out.replace(/\[Stick Down\]/g, `[${dive}]`);

      // Mouse click phrases
      out = out.replace(/กดคลิกซ้ายค้าง/g, `กด [${attack}] ค้าง`);
      out = out.replace(/คลิกซ้าย/g, `กด [${attack}]`);
      out = out.replace(/Hold Left-click/gi, `Hold [${attack}]`);
      out = out.replace(/Left-click/gi, `[${attack}]`);

      out = out.replace(/กดคลิกขวาค้าง/g, `กด [${dig}] ค้าง`);
      out = out.replace(/คลิกขวา/g, `กด [${dig}]`);
      out = out.replace(/Hold Right-click/gi, `Hold [${dig}]`);
      out = out.replace(/Right-click/gi, `[${dig}]`);

      // Docking forward prompt
      out = out.replace(/กด\s*\[W\]\s*ค้าง\s*\(เดินหน้าอย่างเดียว\)/gi, `เร่งเครื่อง [${throttle}] หรือเดินหน้า`);

      return out;
    },

    onConnect: function(gp) {
      if (!gp) return;
      this.connected = true;
      this.gamepadIndex = gp.index;

      const detected = this.detectGamepadBrand(gp);
      this.brand = detected;
      if (detected === "playstation") {
        this.isPlayStation = true;
        this.isXbox = false;
        this.isSwitch = false;
        this.controllerName = "PlayStation Controller (PS4/PS5)";
      } else if (detected === "switch") {
        this.isSwitch = true;
        this.isPlayStation = false;
        this.isXbox = false;
        this.controllerName = "Nintendo Switch Controller";
      } else {
        this.isXbox = true;
        this.isPlayStation = false;
        this.isSwitch = false;
        this.controllerName = gp.id ? gp.id.substring(0, 24) : "Xbox Controller";
      }

      if (typeof showNotice === "function") {
        showNotice(`🎮 เชื่อมต่อจอยแล้ว: ${this.controllerName}`);
      }

      this.setInputDeviceMode(true);

      if (this.checkIsUIOpen()) {
        this.uiNav.wasUIOpen = true;
        window.isGamepadUINavActive = true;
        const isGameStarted = (typeof gameStarted !== "undefined" && gameStarted) || (typeof window.gameStarted !== "undefined" && window.gameStarted);
        const saveSelect = document.getElementById("saveSelectOverlay");
        if (saveSelect && saveSelect.classList.contains("open")) {
          this.uiNav.area = "saveSelect";
          this.uiNav.saveRow = 0;
          this.uiNav.saveCol = 0;
          this.uiNav.index = 0;
        } else if (!isGameStarted) {
          const inv = document.getElementById("inventoryOverlay");
          if (inv && inv.classList.contains("open")) {
            this.uiNav.area = "settings";
            this.uiNav.settingsRow = 0;
            this.uiNav.settingsCol = 0;
          } else {
            this.uiNav.area = "startMenu";
            this.uiNav.index = 0;
          }
        }
        setTimeout(() => {
          this.applyUIFocus();
        }, 80);
      }
    },

    onDisconnect: function(gp) {
      if (this.gamepadIndex === gp.index) {
        this.connected = false;
        this.gamepadIndex = -1;
        this.releaseAllButtons();
        if (typeof showNotice === "function") {
          showNotice(`🎮 ตัดการเชื่อมต่อจอย: ${this.controllerName}`);
        }
        this.setInputDeviceMode(false);
      }
    },

    getGamepad: function() {
      if (!navigator.getGamepads) return null;
      const gamepads = navigator.getGamepads();
      if (!gamepads) return null;

      // Prefer connected index
      if (this.gamepadIndex >= 0 && gamepads[this.gamepadIndex]) {
        return gamepads[this.gamepadIndex];
      }

      // Fallback: pick first available active gamepad
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) {
          if (!this.connected) {
            this.onConnect(gamepads[i]);
          }
          return gamepads[i];
        }
      }
      return null;
    },

    // Radial deadzone filter for analog sticks
    applyRadialDeadzone: function(x, y, deadzone) {
      const mag = Math.hypot(x, y);
      if (mag <= deadzone) {
        return { x: 0, y: 0, mag: 0, active: false };
      }
      const factor = Math.min(1.0, (mag - deadzone) / (1.0 - deadzone));
      return {
        x: (x / mag) * factor,
        y: (y / mag) * factor,
        mag: factor,
        active: true
      };
    },

    // Safe button value reader
    getButtonValue: function(gp, btnIdx) {
      if (!gp || !gp.buttons || !gp.buttons[btnIdx]) return 0;
      const b = gp.buttons[btnIdx];
      if (typeof b === "number") return Math.max(0, Math.min(1, b));
      if (typeof b === "object" && b !== null) {
        if (typeof b.value === "number") return Math.max(0, Math.min(1, b.value));
        if (b.pressed) return 1.0;
      }
      return 0;
    },

    // Comprehensive Trigger reader (Standard Gamepad: Button 6 = LT, Button 7 = RT)
    getTriggerValue: function(gp, btnIdx) {
      if (!gp) return 0;
      // 1. Direct standard button reading
      let val = this.getButtonValue(gp, btnIdx);
      if (val > 0.05) return val;

      if (gp.buttons && gp.buttons[btnIdx] && gp.buttons[btnIdx].pressed) {
        return 1.0;
      }

      // 2. Fallback ONLY for legacy non-standard mappings where mapping is NOT 'standard'
      // Note: NEVER read axes 0, 1, 2, 3 because they are thumbsticks (L-Stick and R-Stick)
      // which rest at 0.0 and would falsely trigger!
      if (gp.mapping !== "standard" && gp.axes && gp.axes.length > 4) {
        const axisIdx = (btnIdx === 6) ? 4 : 5;
        if (typeof gp.axes[axisIdx] === "number") {
          const raw = gp.axes[axisIdx];
          if (raw > 0.25) return raw;
        }
      }
      return 0;
    },

    // Frame update called from render loop
    update: function(dt) {
      const gp = this.getGamepad();
      if (!gp) {
        if (this.isRBDown || this.isRTDown) this.releaseAllButtons();
        return;
      }

      // Check active gamepad input
      let hasGpInput = false;
      if (gp.buttons) {
        for (let i = 0; i < gp.buttons.length; i++) {
          if (this.getButtonValue(gp, i) > 0.25) { hasGpInput = true; break; }
        }
      }
      if (!hasGpInput && gp.axes) {
        for (let i = 0; i < Math.min(4, gp.axes.length); i++) {
          if (Math.abs(gp.axes[i] || 0) > 0.28) { hasGpInput = true; break; }
        }
      }
      if (hasGpInput && !window.isUsingGamepad) {
        this.setInputDeviceMode(true);
      }

      // 0. Completely suppress ALL gamepad processing while user is rebinding keys/buttons
      if (window.isWaitingForKey) {
        if (gp.buttons) {
          if (!this.rebindPrevButtons) {
            // Capture currently held buttons (e.g. A pressed to click 'Rebind') to prevent false immediate trigger
            this.rebindPrevButtons = gp.buttons.map((b, idx) => this.getButtonValue(gp, idx) > 0.35);
          }
          for (let i = 0; i < gp.buttons.length; i++) {
            const val = this.getButtonValue(gp, i);
            const isDown = val > 0.35 || (gp.buttons[i] && gp.buttons[i].pressed);
            const wasDown = !!this.rebindPrevButtons[i];
            if (isDown && !wasDown) {
              if (typeof window.setKeyFromGamepadButton === "function") {
                const handled = window.setKeyFromGamepadButton(i, `Button ${i}`);
                if (handled !== false) {
                  this.rebindPrevButtons = gp.buttons.map((b, idx) => this.getButtonValue(gp, idx) > 0.35);
                  this.lastRebindFinishTime = Date.now();
                  this.rebindDebounceUntil = Date.now() + 350;
                  this.prevADown = true;
                  this.prevBDown = true;
                  this.prevXDown = true;
                  this.prevYDown = true;
                  this.prevRBDown = true;
                  this.prevLBDown = true;
                  this.prevRTDown = true;
                  this.prevLTDown = true;
                  window.lastRebindFinishTime = Date.now();
                  return;
                }
              }
            }
          }
          this.rebindPrevButtons = gp.buttons.map((b, idx) => this.getButtonValue(gp, idx) > 0.35);
        }
        return; // Suppress ALL further game/UI actions while awaiting input
      } else {
        this.rebindPrevButtons = null;
      }

      // Debounce window right after rebinding: prevent newly released rebind buttons from leaking into gameplay
      const timeSinceRebind = Date.now() - (this.lastRebindFinishTime || window.lastRebindFinishTime || 0);
      if (timeSinceRebind < 350) {
        if (gp.buttons) {
          this.prevADown = this.getButtonValue(gp, 0) > 0.25;
          this.prevBDown = this.getButtonValue(gp, 1) > 0.25;
          this.prevXDown = this.getButtonValue(gp, 2) > 0.25;
          this.prevYDown = this.getButtonValue(gp, 3) > 0.25;
          const rbBtn = (window.currentGamepadBindings && window.currentGamepadBindings.attack !== undefined) ? window.currentGamepadBindings.attack : 5;
          this.prevRBDown = this.getButtonValue(gp, rbBtn) > 0.25;
          const lbBtn = (window.currentGamepadBindings && window.currentGamepadBindings.interact !== undefined) ? window.currentGamepadBindings.interact : 4;
          this.prevLBDown = this.getButtonValue(gp, lbBtn) > 0.25;
          const rtBtn = (window.currentGamepadBindings && window.currentGamepadBindings.terrainMod !== undefined) ? window.currentGamepadBindings.terrainMod : 7;
          this.prevRTDown = this.getTriggerValue(gp, rtBtn) > this.deadzoneTrigger;
          const ltBtn = (window.currentGamepadBindings && window.currentGamepadBindings.block !== undefined) ? window.currentGamepadBindings.block : 6;
          this.prevLTDown = this.getTriggerValue(gp, ltBtn) > this.deadzoneTrigger;
        }
        return;
      }

      dt = Math.max(0.001, Math.min(0.05, dt || 0.016));

      const isUIOpen = this.checkIsUIOpen();

      // Manage UI transition state
      if (isUIOpen && !this.uiNav.wasUIOpen) {
        this.uiNav.wasUIOpen = true;
        window.isGamepadUINavActive = true;
        const saveSelect = document.getElementById("saveSelectOverlay");
        const isGameStarted = (typeof gameStarted !== "undefined" && gameStarted) || (typeof window.gameStarted !== "undefined" && window.gameStarted);
        const startOverlay = document.getElementById("gameStartOverlay");
        const isStartScreenVisible = startOverlay && startOverlay.style.display !== "none" && !startOverlay.classList.contains("fade-out") && !isGameStarted;

        if (saveSelect && saveSelect.classList.contains("open")) {
          this.uiNav.area = "saveSelect";
          this.uiNav.saveRow = 0;
          this.uiNav.saveCol = 0;
          this.uiNav.index = 0;
        } else if (isStartScreenVisible) {
          const invOverlay = document.getElementById("inventoryOverlay");
          if (invOverlay && invOverlay.classList.contains("open")) {
            this.uiNav.area = "settings";
            this.uiNav.settingsRow = 0;
            this.uiNav.settingsCol = 0;
          } else {
            this.uiNav.area = "startMenu";
            this.uiNav.index = 0;
          }
        } else {
          this.uiNav.area = "grid";
          this.uiNav.index = 0;
        }
        if (typeof updateVirtualCursorVisibility === "function") {
          updateVirtualCursorVisibility();
        }
        setTimeout(() => {
          this.applyUIFocus();
        }, 50);
      } else if (!isUIOpen && this.uiNav.wasUIOpen) {
        this.uiNav.wasUIOpen = false;
        window.isGamepadUINavActive = false;
        document.querySelectorAll(".gamepad-focused").forEach(el => el.classList.remove("gamepad-focused"));
        if (typeof updateVirtualCursorVisibility === "function") {
          updateVirtualCursorVisibility();
        }
      } else if (isUIOpen) {
        // Continuous sync to keep active UI area matching current visible overlay
        const saveSelect = document.getElementById("saveSelectOverlay");
        const isGameStarted = (typeof gameStarted !== "undefined" && gameStarted) || (typeof window.gameStarted !== "undefined" && window.gameStarted);
        const startOverlay = document.getElementById("gameStartOverlay");
        const isStartScreenVisible = startOverlay && startOverlay.style.display !== "none" && !startOverlay.classList.contains("fade-out") && !isGameStarted;
        const invOverlay = document.getElementById("inventoryOverlay");
        const isInvOpen = invOverlay && invOverlay.classList.contains("open");

        if (saveSelect && saveSelect.classList.contains("open")) {
          if (this.uiNav.area !== "saveSelect") {
            this.uiNav.area = "saveSelect";
            this.uiNav.saveRow = 0;
            this.uiNav.saveCol = 0;
            this.uiNav.index = 0;
            this.applyUIFocus();
          }
        } else if (isStartScreenVisible && !isInvOpen) {
          if (this.uiNav.area !== "startMenu" && this.uiNav.area !== "startSocial") {
            this.uiNav.area = "startMenu";
            this.uiNav.index = 0;
            this.applyUIFocus();
          }
        }

        // If no element currently has gamepad focus, ensure focus is applied
        if (!document.querySelector(".gamepad-focused")) {
          this.applyUIFocus();
        }
      }

      // Right Stick UI Scroll Bar control when UI is open
      if (isUIOpen && gp.axes && gp.axes.length >= 4) {
        const rx = gp.axes[2] || 0;
        const ry = gp.axes[3] || 0;
        const filtR = this.applyRadialDeadzone(rx, ry, this.deadzoneStick);
        if (filtR.active && Math.abs(filtR.y) > 0.1) {
          const scrollSpeed = 1350; // px/sec
          const scrollDelta = filtR.y * scrollSpeed * dt;

          let container = null;
          const saveSelect = document.getElementById("saveSelectOverlay");
          if (saveSelect && saveSelect.classList.contains("open")) {
            container = document.getElementById("saveSlotsList");
          } else if (typeof window.getActiveScrollableContainer === "function") {
            try { container = window.getActiveScrollableContainer(); } catch(e){}
          }
          if (!container) {
            const activeTab = typeof window.getActiveTab === "function" ? window.getActiveTab() : "inventory";
            if (activeTab === "settings") container = document.getElementById("inventorySettings");
            else if (activeTab === "crafting") container = document.getElementById("craftingList");
            else if (activeTab === "cooking") container = document.getElementById("cookingList");
            else if (activeTab === "itemsList") container = document.getElementById("inventoryGrid") || document.getElementById("inventoryMainLayout");
            else container = document.getElementById("inventoryMainLayout") || document.getElementById("inventoryGrid") || document.getElementById("inventorySettings");
          }

          if (container) {
            container.scrollTop += scrollDelta;
            if (typeof updateCustomScrollbar === "function") {
              try { updateCustomScrollbar(); } catch(e){}
            } else if (typeof window.updateCustomScrollbar === "function") {
              try { window.updateCustomScrollbar(); } catch(e){}
            }
          }
        }
      }


      // ----------------------------------------------------
      // 1. RB (Button 5) -> Attack / Primary Action
      // ----------------------------------------------------
      const rbBtn = (window.currentGamepadBindings && window.currentGamepadBindings.attack !== undefined) ? window.currentGamepadBindings.attack : 5;
      const rbVal = this.getButtonValue(gp, rbBtn);
      const isRBDown = rbVal > 0.25 || (gp.buttons && gp.buttons[rbBtn] && gp.buttons[rbBtn].pressed);
      if (isRBDown && !this.prevRBDown) {
        if (isUIOpen) {
          this.cycleTabs(1); // Next Tab in UI
        } else {
          this.triggerLeftClickDown(isUIOpen);
        }
      } else if (!isRBDown && this.prevRBDown) {
        if (!isUIOpen) this.triggerLeftClickUp();
      }
      this.prevRBDown = isRBDown;

      // ----------------------------------------------------
      // 2. RT (Button 7 / Trigger) -> Right Click / Vehicle Throttle
      // ----------------------------------------------------
      const rtBtn = (window.currentGamepadBindings && window.currentGamepadBindings.terrainMod !== undefined) ? window.currentGamepadBindings.terrainMod : 7;
      const rtVal = this.getTriggerValue(gp, rtBtn);
      const isRTDown = rtVal > this.deadzoneTrigger || (gp.buttons && gp.buttons[rtBtn] && gp.buttons[rtBtn].pressed);
      const isRidingBoat = !!(typeof activeRidingBoat !== 'undefined' && activeRidingBoat);
      if (!isRidingBoat) {
        if (isRTDown && !this.prevRTDown) {
          if (!isUIOpen) this.triggerRightClickDown();
        } else if (!isRTDown && this.prevRTDown) {
          if (!isUIOpen) this.triggerRightClickUp();
        }
      }
      this.prevRTDown = isRTDown;

      // ----------------------------------------------------
      // 3. LB (Button 4) -> Interact
      // ----------------------------------------------------
      const lbBtn = (window.currentGamepadBindings && window.currentGamepadBindings.interact !== undefined) ? window.currentGamepadBindings.interact : 4;
      const lbVal = this.getButtonValue(gp, lbBtn);
      const isLBDown = lbVal > 0.25 || (gp.buttons && gp.buttons[lbBtn] && gp.buttons[lbBtn].pressed);
      if (isLBDown && !this.prevLBDown) {
        if (isUIOpen) {
          this.cycleTabs(-1); // Previous Tab in UI
        } else {
          this.triggerLBDown();
        }
      } else if (!isLBDown && this.prevLBDown) {
        if (!isUIOpen) this.triggerLBUp();
      }
      this.prevLBDown = isLBDown;

      // ----------------------------------------------------
      // 4. LT (Button 6 / Trigger) -> Q Key / Rotate
      // ----------------------------------------------------
      const ltBtn = (window.currentGamepadBindings && window.currentGamepadBindings.rotate !== undefined) ? window.currentGamepadBindings.rotate : 6;
      const ltVal = this.getTriggerValue(gp, ltBtn);
      const isLTDown = ltVal > this.deadzoneTrigger || (gp.buttons && gp.buttons[ltBtn] && gp.buttons[ltBtn].pressed);
      if (isLTDown && !this.prevLTDown) {
        if (!isUIOpen) this.triggerLTDown();
      } else if (!isLTDown && this.prevLTDown) {
        if (!isUIOpen) this.triggerLTUp();
      }
      this.prevLTDown = isLTDown;

      // ----------------------------------------------------
      // 5. Menu / Options / Start (Button 9 or 8) -> Tab Key
      // ----------------------------------------------------
      const menuBtn = (window.currentGamepadBindings && window.currentGamepadBindings.inventory !== undefined) ? window.currentGamepadBindings.inventory : 9;
      const menuVal = Math.max(this.getButtonValue(gp, menuBtn), this.getButtonValue(gp, 8));
      const isMenuDown = menuVal > 0.25;
      if (isMenuDown && !this.prevMenuDown) {
        this.triggerMenuTab();
      }
      this.prevMenuDown = isMenuDown;

      // ----------------------------------------------------
      // 6. D-Pad & Left Stick for Slot Navigation in UI, or Hotbar in Game
      // ----------------------------------------------------
      // Standard D-Pad buttons (Button 12=Up, 13=Down, 14=Left, 15=Right)
      let dUp = this.getButtonValue(gp, 12) > 0.4;
      let dDown = this.getButtonValue(gp, 13) > 0.4;
      let dLeft = this.getButtonValue(gp, 14) > 0.4;
      let dRight = this.getButtonValue(gp, 15) > 0.4;

      // Safe POV axes fallback ONLY when mapping is non-standard and axes length is large (strictly axes 6 & 7)
      // NEVER check axes 4 and 5 because they are analog triggers resting at -1.0!
      if (gp.mapping !== "standard" && gp.axes && gp.axes.length >= 8) {
        const povX = gp.axes[6];
        const povY = gp.axes[7];
        if (typeof povX === "number" && typeof povY === "number") {
          if (povY < -0.6) dUp = true;
          if (povY > 0.6) dDown = true;
          if (povX < -0.6) dLeft = true;
          if (povX > 0.6) dRight = true;
        }
      }

      const lx = gp.axes && typeof gp.axes[0] === "number" ? gp.axes[0] : 0;
      const ly = gp.axes && typeof gp.axes[1] === "number" ? gp.axes[1] : 0;
      const stickThreshold = 0.35; // Responsive threshold for UI analog stick navigation
      const stickLeft = lx < -stickThreshold;
      const stickRight = lx > stickThreshold;
      const stickUp = ly < -stickThreshold;
      const stickDown = ly > stickThreshold;

      if (isUIOpen) {
        // Direct Slot Navigation with D-Pad & Analog Stick
        let dirX = 0;
        let dirY = 0;
        if (dLeft || stickLeft) dirX = -1;
        else if (dRight || stickRight) dirX = 1;

        if (dUp || stickUp) dirY = -1;
        else if (dDown || stickDown) dirY = 1;

        if (dirX !== 0 || dirY !== 0) {
          window.isGamepadUINavActive = true;
          const dirKey = `${dirX},${dirY}`;
          if (this.uiNav.lastDir !== dirKey) {
            this.uiNav.lastDir = dirKey;
            this.uiNav.repeatTimer = 0.28;
            this.navigateUI(dirX, dirY);
          } else {
            this.uiNav.repeatTimer -= dt;
            if (this.uiNav.repeatTimer <= 0) {
              this.uiNav.repeatTimer = 0.16;
              this.navigateUI(dirX, dirY);
            }
          }
        } else {
          this.uiNav.lastDir = null;
          this.uiNav.repeatTimer = 0;
        }
      } else {
        // Hotbar selection in normal gameplay
        if (dUp && !this.prevDUp) this.selectActionSlot(0, 1);
        if (dRight && !this.prevDRight) this.selectActionSlot(1, 2);
        if (dDown && !this.prevDDown) this.selectActionSlot(2, 3);
        if (dLeft && !this.prevDLeft) this.selectActionSlot(3, 4);
      }

      this.prevDUp = dUp;
      this.prevDRight = dRight;
      this.prevDDown = dDown;
      this.prevDLeft = dLeft;

      // ----------------------------------------------------
      // 7. A (Button 0) -> Confirm / Click Focused Slot / Hold to Delete
      // ----------------------------------------------------
      const aVal = isUIOpen
        ? Math.max(this.getButtonValue(gp, 0), this.getButtonValue(gp, (window.currentGamepadBindings && window.currentGamepadBindings.jump !== undefined) ? window.currentGamepadBindings.jump : 0))
        : this.getButtonValue(gp, (window.currentGamepadBindings && window.currentGamepadBindings.jump !== undefined) ? window.currentGamepadBindings.jump : 0);
      const isADown = aVal > 0.25;
      if (isADown && !this.prevADown) {
        const trashOverlay = document.getElementById("trashConfirmOverlay");
        if (trashOverlay && trashOverlay.style.display !== "none" && trashOverlay.offsetParent !== null) {
          if (this.uiNav.index === 0) {
            if (typeof window.closeTrashConfirm === "function") window.closeTrashConfirm();
          } else {
            if (typeof window.startTrashHold === "function") window.startTrashHold();
          }
        } else if (window.isWaitingForKey) {
          if (typeof window.setKeyFromGamepadButton === "function") {
            window.setKeyFromGamepadButton(0, "A");
          }
        } else if (isUIOpen) {
          const timeSinceRebind = Date.now() - (this.lastRebindFinishTime || window.lastRebindFinishTime || 0);
          if (timeSinceRebind > 350) {
            this.triggerUIFocusClick();
          }
        } else {
          this.jumpTriggered = true;
          window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true }));
        }
      } else if (!isADown && this.prevADown) {
        const trashOverlay = document.getElementById("trashConfirmOverlay");
        if (trashOverlay && trashOverlay.style.display !== "none" && trashOverlay.offsetParent !== null) {
          if (this.uiNav.index === 1) {
            if (typeof window.cancelTrashHold === "function") window.cancelTrashHold();
          }
        } else if (!isUIOpen) {
          this.jumpTriggered = false;
          window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", key: " ", bubbles: true }));
        }
      }
      this.prevADown = isADown;

      // ----------------------------------------------------
      // 8. B (Button 1) -> Cancel / Deselect / Close Menu
      // ----------------------------------------------------
      const bBtn = (window.currentGamepadBindings && window.currentGamepadBindings.cancel !== undefined) ? window.currentGamepadBindings.cancel : 1;
      const bVal = this.getButtonValue(gp, bBtn);
      const isBDown = bVal > 0.25;
      if (isBDown && !this.prevBDown) {
        const trashOverlay = document.getElementById("trashConfirmOverlay");
        const saveSelect = document.getElementById("saveSelectOverlay");
        const invOverlay = document.getElementById("inventoryOverlay");
        const isGameStarted = (typeof gameStarted !== "undefined" && gameStarted) || (typeof window.gameStarted !== "undefined" && window.gameStarted);

        if (trashOverlay && trashOverlay.style.display !== "none" && trashOverlay.offsetParent !== null) {
          if (typeof window.closeTrashConfirm === "function") window.closeTrashConfirm();
          if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(e){}
        } else if (saveSelect && saveSelect.classList.contains("open")) {
          if (typeof window.closeSaveSelector === "function") window.closeSaveSelector();
          else if (typeof closeSaveSelector === "function") closeSaveSelector();
          else saveSelect.classList.remove("open");

          this.uiNav.area = "startMenu";
          this.uiNav.index = 0;
          if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(e){}
          this.applyUIFocus();
        } else if (!isGameStarted && invOverlay && invOverlay.classList.contains("open")) {
          invOverlay.classList.remove("open");
          this.uiNav.area = "startMenu";
          this.uiNav.index = 1; // Back to Settings button on start screen
          if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(e){}
          this.applyUIFocus();
        } else if (typeof isPlacingFloor !== "undefined" && isPlacingFloor && typeof cancelFloorPlacement === "function") {
          cancelFloorPlacement();
        } else if (isUIOpen) {
          if (window.selectedInventorySlot) {
            window.selectedInventorySlot = null;
            if (typeof updateSelectedSlotVisuals === "function") updateSelectedSlotVisuals();
            if (typeof updateBottomButtonsState === "function") updateBottomButtonsState();
          } else {
            this.triggerMenuTab();
          }
        }
      }
      this.prevBDown = isBDown;

      // ----------------------------------------------------
      // 9. X (Button 2) -> Quick Action in UI / Demolish Mode in Game
      // ----------------------------------------------------
      const xBtn = (window.currentGamepadBindings && window.currentGamepadBindings.demolish !== undefined) ? window.currentGamepadBindings.demolish : 2;
      const xVal = this.getButtonValue(gp, xBtn);
      const isXDown = xVal > 0.25;
      if (isXDown && !this.prevXDown) {
        if (isUIOpen) {
          this.triggerUIQuickAction();
        } else {
          window.dispatchEvent(new KeyboardEvent("keydown", { code: "CapsLock", key: "CapsLock", bubbles: true }));
        }
      }
      this.prevXDown = isXDown;

      // ----------------------------------------------------
      // 10. Y (Button 3) -> Shortcut to 3 Bottom Action Buttons in UI
      // ----------------------------------------------------
      const yBtn = (window.currentGamepadBindings && window.currentGamepadBindings.bottomShortcut !== undefined) ? window.currentGamepadBindings.bottomShortcut : 3;
      const yVal = this.getButtonValue(gp, yBtn);
      const isYDown = yVal > 0.25;
      if (isYDown && !this.prevYDown) {
        if (isUIOpen) {
          this.triggerUIBottomButtonsShortcut();
        }
      }
      this.prevYDown = isYDown;

      // ----------------------------------------------------
      // 11. L3 (Button 10) -> Sprint / Boost (Shift)
      // ----------------------------------------------------
      const l3Btn = (window.currentGamepadBindings && window.currentGamepadBindings.sprint !== undefined) ? window.currentGamepadBindings.sprint : 10;
      const l3Val = this.getButtonValue(gp, l3Btn);
      const isL3Down = l3Val > 0.25;
      if (isL3Down && !this.prevL3Down) {
        if (!isUIOpen) window.dispatchEvent(new KeyboardEvent("keydown", { code: "ShiftLeft", key: "Shift", bubbles: true }));
      } else if (!isL3Down && this.prevL3Down) {
        if (!isUIOpen) window.dispatchEvent(new KeyboardEvent("keyup", { code: "ShiftLeft", key: "Shift", bubbles: true }));
      }
      this.prevL3Down = isL3Down;

      // ----------------------------------------------------
      // 12. R3 (Button 11) -> Center Camera View
      // ----------------------------------------------------
      const r3Btn = (window.currentGamepadBindings && window.currentGamepadBindings.resetCam !== undefined) ? window.currentGamepadBindings.resetCam : 11;
      const r3Val = this.getButtonValue(gp, r3Btn);
      const isR3Down = r3Val > 0.25;
      if (isR3Down && !this.prevR3Down) {
        if (typeof window.rotationX !== "undefined") {
          window.rotationX = 0.2;
        }
      }
      this.prevR3Down = isR3Down;
    },

    // Left Stick Movement: Returns { x, y, active }
    getMovement: function() {
      const gp = this.getGamepad();
      if (!gp || !gp.axes) return { x: 0, y: 0, active: false };

      const ax = gp.axes[0] || 0;
      const ay = gp.axes[1] || 0;
      const filt = this.applyRadialDeadzone(ax, -ay, this.deadzoneStick); // Invert Y so up is +1
      return {
        x: filt.x,
        y: filt.y,
        active: filt.active
      };
    },

    // Flight & Vehicle Controls for Wing Boat: Returns { throttle, pitch, steer, isFlyingBoat }
    getFlightControls: function() {
      const gp = this.getGamepad();
      if (!gp) return { throttle: 0, pitch: 0, steer: 0, isFlyingBoat: false };

      const isRidingBoat = !!(typeof activeRidingBoat !== 'undefined' && activeRidingBoat);
      const isFlyingBoat = !!(isRidingBoat && (activeRidingBoat.isFlying || activeRidingBoat.hasWing || activeRidingBoat.hasWings));

      // RT Trigger (Button 7) for Throttle (0.0 to 1.0)
      const rtVal = this.getTriggerValue(gp, 7);

      // Left Stick axes
      const ax = gp.axes && typeof gp.axes[0] === 'number' ? gp.axes[0] : 0;
      const ay = gp.axes && typeof gp.axes[1] === 'number' ? gp.axes[1] : 0;
      const filt = this.applyRadialDeadzone(ax, -ay, this.deadzoneStick); // filt.y is +1 when pushed UP, -1 when pushed DOWN

      return {
        throttle: rtVal,      // 0.0 to 1.0 (RT trigger for vehicle acceleration)
        pitch: filt.y,        // +1.0 (Push UP = Climb), -1.0 (Push DOWN = Dive)
        steer: filt.x,        // -1.0 (Left), +1.0 (Right)
        isFlyingBoat: isFlyingBoat
      };
    },

    // Right Stick Camera Look: Returns { x, y, active }
    getLook: function(dt) {
      if (this.checkIsUIOpen()) return { x: 0, y: 0, active: false };

      const gp = this.getGamepad();
      if (!gp || !gp.axes) return { x: 0, y: 0, active: false };

      const rx = gp.axes[2] || 0;
      const ry = gp.axes[3] || 0;
      const filt = this.applyRadialDeadzone(rx, ry, this.deadzoneStick);
      if (!filt.active) return { x: 0, y: 0, active: false };

      const sensMult = (typeof mouseSensitivity !== "undefined" && mouseSensitivity) ? (mouseSensitivity / 1.0) : 1.0;
      const lookDist = this.lookSensitivity * sensMult * dt;

      return {
        x: filt.x * lookDist, // Yaw delta
        y: filt.y * lookDist, // Pitch delta
        active: true
      };
    },

    isJumpJustPressed: function() {
      const val = this.jumpTriggered;
      this.jumpTriggered = false;
      return val;
    },

    checkIsUIOpen: function() {
      if (typeof isUIOpen === "function") {
        try {
          if (isUIOpen()) return true;
        } catch(e){}
      }
      const inv = document.getElementById("inventoryOverlay");
      const wrp = document.getElementById("warpOverlay");
      const trash = document.getElementById("trashConfirmOverlay");
      const saveSelect = document.getElementById("saveSelectOverlay");
      const startOverlay = document.getElementById("gameStartOverlay");
      const isGameStarted = (typeof gameStarted !== "undefined" && gameStarted) || (typeof window.gameStarted !== "undefined" && window.gameStarted);

      const isInvOpen = inv && inv.classList.contains("open");
      const isWrpOpen = wrp && wrp.classList.contains("open");
      const isTrashOpen = trash && trash.style.display !== "none" && trash.offsetParent !== null;
      const isSaveSelectOpen = saveSelect && saveSelect.classList.contains("open");
      const isStartOpen = startOverlay && startOverlay.style.display !== "none" && !startOverlay.classList.contains("fade-out") && !isGameStarted;
      const isFreeCam = (typeof cameraMode !== "undefined" && cameraMode === "freecam") || (typeof window.cameraMode !== "undefined" && window.cameraMode === "freecam");

      return !!(isInvOpen || isWrpOpen || isTrashOpen || isSaveSelectOpen || isStartOpen || isFreeCam);
    },

    getCanvas: function() {
      return (typeof window !== "undefined" && window.canvas) || document.getElementById("mapCanvas") || document.querySelector("canvas");
    },

    // RB -> Left click action
    triggerLeftClickDown: function(isUIOpen) {
      this.isRBDown = true;
      const btnTouchLeft = document.getElementById("btnTouchLeftClick");
      if (btnTouchLeft) btnTouchLeft.classList.add("active");

      if (isUIOpen) {
        this.triggerVirtualCursorClick();
        return;
      }
      window.simulatedPointerLock = true;
      if (typeof simulatedPointerLock !== "undefined") simulatedPointerLock = true;
      window.isActionDown = true;
      if (typeof isActionDown !== "undefined") isActionDown = true;

      const canvas = this.getCanvas();
      if (canvas) {
        const evt = new MouseEvent("mousedown", { button: 0, bubbles: true, cancelable: true });
        evt.simulated = true;
        canvas.dispatchEvent(evt);
      }
    },

    triggerLeftClickUp: function() {
      this.isRBDown = false;
      const btnTouchLeft = document.getElementById("btnTouchLeftClick");
      if (btnTouchLeft) btnTouchLeft.classList.remove("active");

      window.isActionDown = false;
      if (typeof isActionDown !== "undefined") isActionDown = false;

      const canvas = this.getCanvas();
      const evt = new MouseEvent("mouseup", { button: 0, bubbles: true, cancelable: true });
      evt.simulated = true;
      if (canvas) canvas.dispatchEvent(evt);
      window.dispatchEvent(evt);
      window.simulatedPointerLock = false;
      if (typeof simulatedPointerLock !== "undefined") simulatedPointerLock = false;
    },

    // RT -> Right click action
    triggerRightClickDown: function() {
      this.isRTDown = true;
      const btnTouchRight = document.getElementById("btnTouchRightClick");
      if (btnTouchRight) btnTouchRight.classList.add("active");

      window.simulatedPointerLock = true;
      if (typeof simulatedPointerLock !== "undefined") simulatedPointerLock = true;

      const canvas = this.getCanvas();
      if (canvas) {
        const evt = new MouseEvent("mousedown", { button: 2, bubbles: true, cancelable: true });
        evt.simulated = true;
        canvas.dispatchEvent(evt);
      }
    },

    triggerRightClickUp: function() {
      this.isRTDown = false;
      const btnTouchRight = document.getElementById("btnTouchRightClick");
      if (btnTouchRight) btnTouchRight.classList.remove("active");

      const canvas = this.getCanvas();
      const evt = new MouseEvent("mouseup", { button: 2, bubbles: true, cancelable: true });
      evt.simulated = true;
      if (canvas) canvas.dispatchEvent(evt);
      window.dispatchEvent(evt);
      window.simulatedPointerLock = false;
      if (typeof simulatedPointerLock !== "undefined") simulatedPointerLock = false;
    },

    // LB -> E Key action (Interact / Open / Mount)
    triggerLBDown: function() {
      const btnTouchE = document.getElementById("btnTouchE");
      if (btnTouchE) btnTouchE.classList.add("active");

      this.activeLBCode = "KeyE";
      if (window.keysPressed) {
        window.keysPressed["KeyE"] = true;
        window.keysPressed["e"] = true;
      }
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE", key: "e", bubbles: true }));
    },

    triggerLBUp: function() {
      const btnTouchE = document.getElementById("btnTouchE");
      if (btnTouchE) btnTouchE.classList.remove("active");

      if (window.keysPressed) {
        window.keysPressed["KeyE"] = false;
        window.keysPressed["e"] = false;
      }
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyE", key: "e", bubbles: true }));
      this.activeLBCode = null;
    },

    // LT -> Q Key action (Rotate / Swim Up)
    triggerLTDown: function() {
      const btnTouchQ = document.getElementById("btnTouchQ");
      if (btnTouchQ) btnTouchQ.classList.add("active");

      const inWater = (typeof currentSwimFactor !== 'undefined' && currentSwimFactor > 0.0);
      this.activeLTCode = inWater ? "ShiftLeft" : "KeyQ";

      if (window.keysPressed) {
        window.keysPressed[this.activeLTCode] = true;
        window.keysPressed["KeyQ"] = true;
        window.keysPressed["q"] = true;
        if (inWater) {
          window.keysPressed["ShiftLeft"] = true;
        }
      }
      window.dispatchEvent(new KeyboardEvent("keydown", { code: this.activeLTCode, key: (this.activeLTCode === "ShiftLeft" ? "Shift" : "q"), bubbles: true }));
      if (this.activeLTCode !== "KeyQ") {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyQ", key: "q", bubbles: true }));
      }

      // Immediate rotation response if in building/placement mode
      if (typeof isPlacingFloor !== "undefined" && isPlacingFloor) {
        if (typeof placementRotationAngle !== "undefined") {
          placementRotationAngle = (placementRotationAngle + Math.PI / 2) % (Math.PI * 2);
          if (typeof window !== "undefined") window.placementRotationAngle = placementRotationAngle;
          if (typeof floorPreviewCollectible !== "undefined" && floorPreviewCollectible) {
            floorPreviewCollectible.angle = placementRotationAngle;
          }
          if (typeof playPlaceSound === "function") playPlaceSound();
          if (typeof showNotice === "function") showNotice("🔄 หมุนสิ่งก่อสร้างแล้ว (Rotated) [LT / Q]");
          if (typeof refreshCollectiblesVBO === "function") refreshCollectiblesVBO('preview');
        }
      } else if (!inWater) {
        // If walking on land and not placing items, display informative status notice
        if (typeof showNotice === "function") {
          showNotice("🔄 ปุ่ม Q (LT): หมุนสิ่งก่อสร้างขณะวางของ / ว่ายน้ำขึ้น");
        }
      }
    },

    triggerLTUp: function() {
      const btnTouchQ = document.getElementById("btnTouchQ");
      if (btnTouchQ) btnTouchQ.classList.remove("active");

      const code = this.activeLTCode || "KeyQ";
      if (window.keysPressed) {
        window.keysPressed[code] = false;
        window.keysPressed["KeyQ"] = false;
        window.keysPressed["q"] = false;
        window.keysPressed["ShiftLeft"] = false;
      }
      window.dispatchEvent(new KeyboardEvent("keyup", { code: code, key: (code === "ShiftLeft" ? "Shift" : "q"), bubbles: true }));
      if (code !== "KeyQ") {
        window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyQ", key: "q", bubbles: true }));
      }
      this.activeLTCode = null;
    },

    // Menu / Options / Start -> Tab Key action
    triggerMenuTab: function() {
      if (typeof currentOpenChest !== "undefined" && currentOpenChest && typeof closeChest === "function") {
        closeChest();
      } else if (typeof toggleInventory === "function") {
        toggleInventory();
      } else {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Tab", key: "Tab", bubbles: true }));
      }
    },

    // D-Pad -> 1, 2, 3, 4 selection
    selectActionSlot: function(slotIndex, num) {
      if (typeof selectedActionSlotIndex !== "undefined") {
        if (selectedActionSlotIndex === slotIndex) {
          selectedActionSlotIndex = -1; // toggle off
        } else {
          selectedActionSlotIndex = slotIndex;
        }
        if (typeof renderActionSlots === "function") {
          renderActionSlots();
        }
      }
      const codeMap = { 1: "Digit1", 2: "Digit2", 3: "Digit3", 4: "Digit4" };
      window.dispatchEvent(new KeyboardEvent("keydown", { code: codeMap[num], key: String(num), bubbles: true }));
    },

    // ----------------------------------------------------
    // Direct Slot / UI Element Navigation with D-Pad & Analog Stick
    // ----------------------------------------------------
    getVisibleTabs: function() {
      const tabElements = [
        document.getElementById("tabCrafting"),
        document.getElementById("tabInventory"),
        document.getElementById("tabCooking"),
        document.getElementById("tabItemsList"),
        document.getElementById("tabSettings")
      ];
      return tabElements.filter(el => {
        if (!el || el.offsetParent === null) return false;
        try {
          const style = window.getComputedStyle(el);
          return style.display !== "none" && style.visibility !== "hidden";
        } catch(e) {
          return el.style.display !== "none";
        }
      });
    },

    getCurrentActiveTabName: function() {
      const invOverlayEl = document.getElementById("inventoryOverlay");
      if (invOverlayEl && invOverlayEl.classList.contains("mode-chest")) return "chest";
      const activeTabEl = document.querySelector(".inventory-tabs h2.active, #inventoryOverlay .inventory-tabs .active");
      if (activeTabEl) {
        if (activeTabEl.id === "tabSettings") return "settings";
        if (activeTabEl.id === "tabItemsList") return "itemsList";
        if (activeTabEl.id === "tabCrafting") return "crafting";
        if (activeTabEl.id === "tabCooking") return "cooking";
        if (activeTabEl.id === "tabInventory") return "inventory";
      }
      const invSettings = document.getElementById("inventorySettings");
      if (invSettings && invSettings.style.display !== "none" && invSettings.style.display !== "") return "settings";
      const craftingList = document.getElementById("craftingList");
      if (craftingList && craftingList.style.display !== "none" && craftingList.style.display !== "") return "crafting";
      const cookingList = document.getElementById("cookingList");
      if (cookingList && cookingList.style.display !== "none" && cookingList.style.display !== "") return "cooking";

      if (typeof window.getActiveTab === "function") {
        return window.getActiveTab();
      }
      return "inventory";
    },

    getStartMenuButtons: function() {
      const container = document.getElementById("startMenuButtonsContainer");
      if (!container) return [];
      return Array.from(container.querySelectorAll("button")).filter(b => {
        if (!b || b.offsetParent === null) return false;
        try {
          const style = window.getComputedStyle(b);
          return style.display !== "none" && style.visibility !== "hidden";
        } catch(e) {
          return b.style.display !== "none";
        }
      });
    },

    getStartSocialLinks: function() {
      const container = document.getElementById("startScreenSocialBar");
      if (!container) return [];
      return Array.from(container.querySelectorAll("a")).filter(a => {
        if (!a || a.offsetParent === null) return false;
        try {
          const style = window.getComputedStyle(a);
          return style.display !== "none" && style.visibility !== "hidden";
        } catch(e) {
          return a.style.display !== "none";
        }
      });
    },

    getSaveSelectRows: function() {
      const saveSelect = document.getElementById("saveSelectOverlay");
      if (!saveSelect || !saveSelect.classList.contains("open")) return [];
      const rows = [];
      const slotRows = Array.from(document.querySelectorAll("#saveSlotsList .save-slot-row"));
      for (const rowEl of slotRows) {
        const card = rowEl.querySelector(".save-slot-card");
        const delBtn = rowEl.querySelector(".save-slot-delete-btn");
        const rowItems = [];
        if (card && card.offsetParent !== null) {
          rowItems.push(card);
        }
        if (delBtn && delBtn.offsetParent !== null) {
          rowItems.push(delBtn);
        }
        if (rowItems.length > 0) {
          rows.push(rowItems);
        }
      }
      const backBtn = document.getElementById("btnSaveSelectBack");
      if (backBtn && backBtn.offsetParent !== null) {
        rows.push([backBtn]);
      }
      return rows;
    },

    getSettingsRows: function() {
      const container = document.getElementById("inventorySettings");
      if (!container) return [];

      const elements = Array.from(container.querySelectorAll("button, input[type='range']")).filter(el => {
        if (!el || el.offsetParent === null || el.disabled || el.hasAttribute("disabled")) return false;
        try {
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") return false;
        } catch(e) {
          if (el.style.display === "none") return false;
        }
        return true;
      });

      if (elements.length === 0) return [];

      const rows = [];
      let currentRow = [elements[0]];
      let currentY = elements[0].getBoundingClientRect().top;

      for (let i = 1; i < elements.length; i++) {
        const el = elements[i];
        const y = el.getBoundingClientRect().top;

        // Elements on the same visual horizontal row have almost identical top position (< 14px difference)
        if (Math.abs(y - currentY) < 14) {
          currentRow.push(el);
        } else {
          rows.push(currentRow);
          currentRow = [el];
          currentY = y;
        }
      }
      if (currentRow.length > 0) {
        rows.push(currentRow);
      }
      return rows;
    },

    getUIFocusedElement: function() {
      const trashOverlay = document.getElementById("trashConfirmOverlay");
      if (trashOverlay && trashOverlay.style.display !== "none" && trashOverlay.offsetParent !== null) {
        const btns = [
          document.getElementById("trashCancelBtn"),
          document.getElementById("trashConfirmBtn")
        ].filter(b => b && b.offsetParent !== null);
        return btns[this.uiNav.index] || btns[0];
      }

      const saveSelect = document.getElementById("saveSelectOverlay");
      if (saveSelect && saveSelect.classList.contains("open")) {
        const rows = this.getSaveSelectRows();
        if (rows.length > 0) {
          const r = Math.max(0, Math.min(rows.length - 1, this.uiNav.saveRow || 0));
          const row = rows[r];
          const c = Math.max(0, Math.min(row.length - 1, this.uiNav.saveCol || 0));
          return row[c] || row[0];
        }
      }

      const inv = document.getElementById("inventoryOverlay");
      const isInvOpen = inv && inv.classList.contains("open");
      const isGameStarted = (typeof gameStarted !== "undefined" && gameStarted) || (typeof window.gameStarted !== "undefined" && window.gameStarted);
      const startOverlay = document.getElementById("gameStartOverlay");
      const isStartScreenVisible = startOverlay && startOverlay.style.display !== "none" && !startOverlay.classList.contains("fade-out") && !isGameStarted;

      if (isStartScreenVisible && !isInvOpen) {
        if (this.uiNav.area === "startSocial") {
          const socials = this.getStartSocialLinks();
          if (socials.length > 0) {
            const idx = Math.max(0, Math.min(socials.length - 1, this.uiNav.index || 0));
            return socials[idx] || socials[0];
          }
        }
        // Default to startMenu buttons (Start Game, Settings, Dev Mode)
        const btns = this.getStartMenuButtons();
        if (btns.length > 0) {
          const idx = Math.max(0, Math.min(btns.length - 1, this.uiNav.index || 0));
          return btns[idx] || btns[0];
        }
      }

      const isWarpOpen = document.getElementById("warpOverlay")?.classList.contains("open");
      if (isWarpOpen) {
        const slots = document.querySelectorAll("#warpGrid .inventory-slot");
        return slots[this.uiNav.index] || slots[0];
      }

      const invOvForChest = document.getElementById("inventoryOverlay");
      const isChestOpen = !!(invOvForChest && invOvForChest.classList.contains("open") && invOvForChest.classList.contains("mode-chest"));

      if (isChestOpen) {
        if (this.uiNav.area === "chest") {
          const slots = document.querySelectorAll("#chestGrid .inventory-slot");
          return slots[this.uiNav.index] || slots[0];
        } else {
          const slots = document.querySelectorAll("#inventoryGrid .inventory-slot");
          return slots[this.uiNav.index] || slots[0];
        }
      }

      if (this.uiNav.area === "tabs") {
        const tabs = this.getVisibleTabs();
        return tabs[this.uiNav.index] || tabs[0];
      }

      const activeTabName = this.getCurrentActiveTabName();

      if (this.uiNav.area === "settings" || activeTabName === "settings") {
        const rows = this.getSettingsRows();
        if (rows.length === 0) return null;
        const r = Math.max(0, Math.min(rows.length - 1, this.uiNav.settingsRow || 0));
        const row = rows[r];
        const c = Math.max(0, Math.min(row.length - 1, this.uiNav.settingsCol || 0));
        return row[c] || row[0];
      }

      if (activeTabName === "inventory") {
        if (this.uiNav.area === "grid") {
          const slots = document.querySelectorAll("#inventoryGrid .inventory-slot");
          return slots[this.uiNav.index] || slots[0];
        } else if (this.uiNav.area === "action") {
          const slots = document.querySelectorAll("#inventoryActionSlots .action-slot");
          return slots[this.uiNav.index] || slots[0];
        } else if (this.uiNav.area === "bottom") {
          const btns = [
            document.getElementById("btnInventoryActionUI"),
            document.getElementById("btnInventorySplit"),
            document.getElementById("btnInventoryDrop"),
            document.getElementById("btnInventoryDestroy")
          ].filter(el => el && el.offsetParent !== null);
          return btns[this.uiNav.index] || btns[0];
        }
      } else if (activeTabName === "crafting" || activeTabName === "cooking") {
        const containerId = activeTabName === "crafting" ? "craftingList" : "cookingList";
        const cards = Array.from(document.querySelectorAll(`#${containerId} > div`));
        return cards[this.uiNav.index] || cards[0];
      } else if (activeTabName === "itemsList") {
        const slots = document.querySelectorAll("#inventoryGrid .inventory-slot");
        return slots[this.uiNav.index] || slots[0];
      }

      return null;
    },

    navigateUI: function(dx, dy) {
      const trashOverlay = document.getElementById("trashConfirmOverlay");
      if (trashOverlay && trashOverlay.style.display !== "none" && trashOverlay.offsetParent !== null) {
        if (dx > 0) {
          this.uiNav.index = 1; // trashConfirmBtn
        } else if (dx < 0) {
          this.uiNav.index = 0; // trashCancelBtn
        }
        this.applyUIFocus();
        return;
      }

      // Save Select Overlay Navigation (2D Grid: Up/Down for rows, Left/Right for Save Card vs Delete Button)
      const saveSelect = document.getElementById("saveSelectOverlay");
      if (saveSelect && saveSelect.classList.contains("open")) {
        const rows = this.getSaveSelectRows();
        if (rows.length === 0) return;
        this.uiNav.area = "saveSelect";

        let r = Math.max(0, Math.min(rows.length - 1, this.uiNav.saveRow || 0));
        let row = rows[r];
        let c = Math.max(0, Math.min(row.length - 1, this.uiNav.saveCol || 0));

        if (dx > 0) {
          // Right: If currently on save card, move to delete button if present in this row
          if (c < row.length - 1) {
            this.uiNav.saveCol = c + 1;
            if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(e){}
          }
        } else if (dx < 0) {
          // Left: If currently on delete button, move to save card
          if (c > 0) {
            this.uiNav.saveCol = 0;
            if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(e){}
          }
        }

        if (dy > 0) {
          // Down: Move to next row
          if (r < rows.length - 1) {
            this.uiNav.saveRow = r + 1;
            const nextRow = rows[this.uiNav.saveRow];
            this.uiNav.saveCol = Math.min(nextRow.length - 1, c);
            if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(e){}
          }
        } else if (dy < 0) {
          // Up: Move to previous row
          if (r > 0) {
            this.uiNav.saveRow = r - 1;
            const prevRow = rows[this.uiNav.saveRow];
            this.uiNav.saveCol = Math.min(prevRow.length - 1, c);
            if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(e){}
          }
        }

        this.applyUIFocus();
        return;
      }

      // Start Screen Menu & Social Links Navigation
      const isGameStarted = (typeof gameStarted !== "undefined" && gameStarted) || (typeof window.gameStarted !== "undefined" && window.gameStarted);
      const startOverlay = document.getElementById("gameStartOverlay");
      const invOverlay = document.getElementById("inventoryOverlay");
      const isInvOpen = invOverlay && invOverlay.classList.contains("open");
      const isStartScreenVisible = startOverlay && startOverlay.style.display !== "none" && !startOverlay.classList.contains("fade-out") && !isGameStarted;

      if (isStartScreenVisible && !isInvOpen) {
        const btns = this.getStartMenuButtons();
        const socials = this.getStartSocialLinks();

        if (this.uiNav.area === "startSocial") {
          if (dx > 0) {
            this.uiNav.index = Math.min(socials.length - 1, this.uiNav.index + 1);
            if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(e){}
          } else if (dx < 0) {
            this.uiNav.index = Math.max(0, this.uiNav.index - 1);
            if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(e){}
          }

          if (dy < 0) {
            // Up: return to main start buttons
            this.uiNav.area = "startMenu";
            this.uiNav.index = Math.min(btns.length - 1, Math.max(0, this.uiNav.lastMenuIndex || 0));
            if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(e){}
          }
        } else {
          // startMenu
          this.uiNav.area = "startMenu";

          // Support both directional axes: Left/Right or Up/Down can traverse the start buttons
          if (dx > 0 || dy > 0) {
            if (btns.length > 0) {
              if (this.uiNav.index < btns.length - 1) {
                this.uiNav.index++;
                this.uiNav.lastMenuIndex = this.uiNav.index;
                if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(e){}
              } else if (dy > 0 && socials.length > 0) {
                // Moving Down on the last button transitions down to the social links bar
                this.uiNav.area = "startSocial";
                this.uiNav.index = 0;
                if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(e){}
              }
            }
          } else if (dx < 0 || dy < 0) {
            if (btns.length > 0) {
              if (this.uiNav.index > 0) {
                this.uiNav.index--;
                this.uiNav.lastMenuIndex = this.uiNav.index;
                if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(e){}
              }
            }
          }
        }
        this.applyUIFocus();
        return;
      }

      const activeTabName = this.getCurrentActiveTabName();
      const invOvNav = document.getElementById("inventoryOverlay");
      const isChestOpen = !!(invOvNav && invOvNav.classList.contains("open") && invOvNav.classList.contains("mode-chest"));

      if (isChestOpen) {
        const isChest = this.uiNav.area === "chest";
        const gridSelector = isChest ? "#chestGrid .inventory-slot" : "#inventoryGrid .inventory-slot";
        const slots = Array.from(document.querySelectorAll(gridSelector));
        const total = slots.length || 20;
        const cols = 5;
        const r = Math.floor(this.uiNav.index / cols);
        const c = this.uiNav.index % cols;

        if (dx > 0) {
          if (c < cols - 1) this.uiNav.index = Math.min(total - 1, this.uiNav.index + 1);
          else if (isChest) { this.uiNav.area = "chestPlayer"; this.uiNav.index = r * cols; }
        } else if (dx < 0) {
          if (c > 0) this.uiNav.index = Math.max(0, this.uiNav.index - 1);
          else if (!isChest) { this.uiNav.area = "chest"; this.uiNav.index = r * cols + (cols - 1); }
        }

        if (dy > 0) {
          if (this.uiNav.index + cols < total) this.uiNav.index += cols;
        } else if (dy < 0) {
          if (this.uiNav.index - cols >= 0) this.uiNav.index -= cols;
        }

        this.applyUIFocus();
        return;
      }

      const tabs = this.getVisibleTabs();
      const tabNameMap = {
        "tabCrafting": "crafting",
        "tabInventory": "inventory",
        "tabSettings": "settings",
        "tabItemsList": "itemsList",
        "tabCooking": "cooking"
      };

      if (this.uiNav.area === "tabs") {
        if (dx > 0) {
          this.uiNav.index = Math.min(tabs.length - 1, this.uiNav.index + 1);
          const t = tabs[this.uiNav.index];
          if (t) {
            const name = tabNameMap[t.id] || "inventory";
            if (typeof window.switchInventoryTab === "function") window.switchInventoryTab(name);
            else t.click();
          }
        } else if (dx < 0) {
          this.uiNav.index = Math.max(0, this.uiNav.index - 1);
          const t = tabs[this.uiNav.index];
          if (t) {
            const name = tabNameMap[t.id] || "inventory";
            if (typeof window.switchInventoryTab === "function") window.switchInventoryTab(name);
            else t.click();
          }
        } else if (dy > 0) {
          const currentTab = this.getCurrentActiveTabName();
          if (currentTab === "inventory" || currentTab === "itemsList") {
            this.uiNav.area = "grid";
            this.uiNav.index = 0;
          } else if (currentTab === "crafting" || currentTab === "cooking") {
            this.uiNav.area = "cards";
            this.uiNav.index = 0;
          } else if (currentTab === "settings") {
            this.uiNav.area = "settings";
            this.uiNav.settingsRow = 0;
            this.uiNav.settingsCol = 0;
          }
        }
        this.applyUIFocus();
        return;
      }

      if (activeTabName === "inventory") {
        const gridSlots = Array.from(document.querySelectorAll("#inventoryGrid .inventory-slot"));
        const actionSlots = Array.from(document.querySelectorAll("#inventoryActionSlots .action-slot"));
        const bottomBtns = [
          document.getElementById("btnInventoryActionUI"),
          document.getElementById("btnInventorySplit"),
          document.getElementById("btnInventoryDrop"),
          document.getElementById("btnInventoryDestroy")
        ].filter(el => el && el.offsetParent !== null);

        if (this.uiNav.area === "grid") {
          const total = gridSlots.length || 20;
          const cols = 5;
          const r = Math.floor(this.uiNav.index / cols);
          const c = this.uiNav.index % cols;

          if (dx > 0) {
            if (c < cols - 1 && this.uiNav.index + 1 < total) {
              this.uiNav.index++;
            } else if (actionSlots.length > 0) {
              this.uiNav.area = "action";
              this.uiNav.index = Math.min(actionSlots.length - 1, r * 2);
            }
          } else if (dx < 0) {
            if (c > 0) this.uiNav.index--;
          }

          if (dy > 0) {
            if (this.uiNav.index + cols < total) {
              this.uiNav.index += cols;
            } else if (bottomBtns.length > 0) {
              this.uiNav.area = "bottom";
              this.uiNav.index = Math.min(bottomBtns.length - 1, Math.floor(c / 2));
            }
          } else if (dy < 0) {
            if (this.uiNav.index - cols >= 0) {
              this.uiNav.index -= cols;
            } else {
              this.uiNav.area = "tabs";
              this.uiNav.index = Math.max(0, tabs.findIndex(t => t.id === "tabInventory"));
            }
          }
        } else if (this.uiNav.area === "action") {
          if (dy > 0) {
            if (this.uiNav.index < actionSlots.length - 1) {
              this.uiNav.index++;
            } else if (bottomBtns.length > 0) {
              this.uiNav.area = "bottom";
              this.uiNav.index = bottomBtns.length - 1;
            }
          } else if (dy < 0) {
            if (this.uiNav.index > 0) {
              this.uiNav.index--;
            } else {
              this.uiNav.area = "tabs";
              this.uiNav.index = tabs.length - 1;
            }
          } else if (dx < 0) {
            this.uiNav.area = "grid";
            const targetRow = Math.floor(this.uiNav.index / 2);
            this.uiNav.index = Math.min(gridSlots.length - 1, targetRow * 5 + 4);
          }
        } else if (this.uiNav.area === "bottom") {
          if (dx > 0) {
            this.uiNav.index = Math.min(bottomBtns.length - 1, this.uiNav.index + 1);
          } else if (dx < 0) {
            this.uiNav.index = Math.max(0, this.uiNav.index - 1);
          } else if (dy < 0) {
            this.uiNav.area = "grid";
            this.uiNav.index = Math.min(gridSlots.length - 1, 15 + this.uiNav.index * 2);
          }
        }
      } else if (activeTabName === "crafting" || activeTabName === "cooking") {
        const containerId = activeTabName === "crafting" ? "craftingList" : "cookingList";
        const cards = Array.from(document.querySelectorAll(`#${containerId} > div`));

        if (dy > 0) {
          if (cards.length > 0) this.uiNav.index = Math.min(cards.length - 1, this.uiNav.index + 1);
        } else if (dy < 0) {
          if (this.uiNav.index > 0) {
            this.uiNav.index--;
          } else {
            this.uiNav.area = "tabs";
            this.uiNav.index = Math.max(0, tabs.findIndex(t => t.id === (activeTabName === "crafting" ? "tabCrafting" : "tabCooking")));
          }
        }
      } else if (activeTabName === "settings") {
        const rows = this.getSettingsRows();
        if (rows.length === 0) return;

        let r = Math.max(0, Math.min(rows.length - 1, this.uiNav.settingsRow || 0));
        let row = rows[r];
        let c = Math.max(0, Math.min(row.length - 1, this.uiNav.settingsCol || 0));
        const currentItem = row[c];

        // Horizontal navigation (dx !== 0)
        if (dx !== 0) {
          if (currentItem && currentItem.tagName === "INPUT" && currentItem.type === "range") {
            // Adjust slider with Left / Right!
            const step = Number(currentItem.step) || (Number(currentItem.max) - Number(currentItem.min) <= 10 ? 1 : 5);
            const min = Number(currentItem.min || 0);
            const max = Number(currentItem.max || 100);
            let val = Number(currentItem.value);
            if (dx > 0) val = Math.min(max, val + step);
            else if (dx < 0) val = Math.max(min, val - step);
            currentItem.value = val;
            currentItem.dispatchEvent(new Event("input", { bubbles: true }));
            currentItem.dispatchEvent(new Event("change", { bubbles: true }));
            if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(e){}
          } else if (row.length > 1) {
            // Move between horizontal buttons in this row!
            if (dx > 0) {
              this.uiNav.settingsCol = Math.min(row.length - 1, c + 1);
            } else if (dx < 0) {
              this.uiNav.settingsCol = Math.max(0, c - 1);
            }
            if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(e){}
          }
        }

        // Vertical navigation (dy !== 0)
        if (dy > 0) {
          // Down: move to next row
          if (r < rows.length - 1) {
            this.uiNav.settingsRow = r + 1;
            const nextRow = rows[this.uiNav.settingsRow];
            this.uiNav.settingsCol = Math.min(nextRow.length - 1, c);
          }
        } else if (dy < 0) {
          // Up: move to previous row or return to tabs header
          if (r > 0) {
            this.uiNav.settingsRow = r - 1;
            const prevRow = rows[this.uiNav.settingsRow];
            this.uiNav.settingsCol = Math.min(prevRow.length - 1, c);
          } else {
            this.uiNav.area = "tabs";
            this.uiNav.index = Math.max(0, tabs.findIndex(t => t.id === "tabSettings"));
          }
        }
      } else if (activeTabName === "itemsList") {
        const gridSlots = Array.from(document.querySelectorAll("#inventoryGrid .inventory-slot"));
        const total = gridSlots.length || 20;
        const cols = 5;
        const r = Math.floor(this.uiNav.index / cols);
        const c = this.uiNav.index % cols;

        if (dx > 0) {
          if (c < cols - 1 && this.uiNav.index + 1 < total) {
            this.uiNav.index++;
          }
        } else if (dx < 0) {
          if (c > 0) {
            this.uiNav.index--;
          }
        }

        if (dy > 0) {
          if (this.uiNav.index + cols < total) {
            this.uiNav.index += cols;
          }
        } else if (dy < 0) {
          if (this.uiNav.index - cols >= 0) {
            this.uiNav.index -= cols;
          } else {
            this.uiNav.area = "tabs";
            this.uiNav.index = Math.max(0, tabs.findIndex(t => t.id === "tabItemsList"));
          }
        }
      }

      this.applyUIFocus();
    },

    applyUIFocus: function() {
      if (!this.checkIsUIOpen()) {
        document.querySelectorAll(".gamepad-focused").forEach(el => el.classList.remove("gamepad-focused"));
        return;
      }

      const target = this.getUIFocusedElement();
      document.querySelectorAll(".gamepad-focused").forEach(el => {
        if (el !== target) el.classList.remove("gamepad-focused");
      });

      if (target) {
        target.classList.add("gamepad-focused");
        try {
          target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
        } catch(e){}

        if (typeof updateCustomScrollbar === "function") {
          try { updateCustomScrollbar(); } catch(e){}
        }

        if (target.classList.contains("inventory-slot") || target.classList.contains("action-slot")) {
          const source = target.dataset.source;
          const index = parseInt(target.dataset.index, 10);
          if (source && !isNaN(index) && typeof getSlotItem === "function") {
            const item = getSlotItem(source, index);
            window.lastHoveredSlot = { slotEl: target, source, index, item };
          }
        }
        if (target.classList.contains("crafting-recipe-card")) {
          window._selectedCraftingCard = target;
          window._selectedCraftingRecipeId = target.dataset.recipeId || null;
          window._activeTouchCraftingCard = target;
          window._activeTouchRecipeId = target.dataset.recipeId || null;
          document.querySelectorAll("#craftingList .crafting-recipe-card, #cookingList .crafting-recipe-card").forEach(c => {
            if (c !== target) {
              c.classList.remove("crafting-card-selected");
              c.classList.remove("touch-preview-active");
            }
          });
        }
        const curRecipeTab = this.getCurrentActiveTabName();
        if (target.classList.contains("crafting-recipe-card") || curRecipeTab === "crafting" || curRecipeTab === "cooking") {
          if (typeof window.startCraftingPreviewLoop === "function") {
            window.startCraftingPreviewLoop();
          }
        }
      }
    },

    triggerUIFocusClick: function() {
      const el = this.getUIFocusedElement();
      if (!el) return;

      window.isGamepadTriggeringClick = true;
      try {
        if (this.uiNav.area === "tabs") {
          const tabs = this.getVisibleTabs();
          const tabIdx = tabs.indexOf(el);
          if (tabIdx !== -1) {
            this.uiNav.index = tabIdx;
          }
          const tabNameMap = {
            "tabCrafting": "crafting",
            "tabInventory": "inventory",
            "tabSettings": "settings",
            "tabItemsList": "itemsList",
            "tabCooking": "cooking"
          };
          const tabName = tabNameMap[el.id] || "inventory";
          if (typeof window.switchInventoryTab === "function") {
            window.switchInventoryTab(tabName);
          } else {
            el.click();
          }
          if (typeof playPlaceSound === "function") {
            try { playPlaceSound(); } catch(e){}
          }

          // Pressing A on a tab header ENTERS that tab's content directly!
          if (tabName === "inventory" || tabName === "itemsList") {
            this.uiNav.area = "grid";
            this.uiNav.index = 0;
          } else if (tabName === "crafting" || tabName === "cooking") {
            this.uiNav.area = "cards";
            this.uiNav.index = 0;
          } else if (tabName === "settings") {
            this.uiNav.area = "settings";
            this.uiNav.settingsRow = 0;
            this.uiNav.settingsCol = 0;
          }

          setTimeout(() => {
            this.applyUIFocus();
          }, 30);
          return;
        }

        // If slider, pressing A cycles/steps value for immediate test
        if (el.tagName === "INPUT" && el.type === "range") {
          const min = Number(el.min || 0);
          const max = Number(el.max || 100);
          const cur = Number(el.value);
          let nextVal = cur;

          if (el.id === "sfxVolumeSlider") {
            if (cur >= 80) nextVal = 50;
            else if (cur >= 30) nextVal = 0;
            else nextVal = 100;
          } else if (el.id === "renderScaleSlider") {
            if (cur >= 95) nextVal = 50;
            else if (cur <= 60) nextVal = 75;
            else nextVal = 100;
          } else if (el.id === "uiScaleSlider") {
            if (cur < 75) nextVal = 75;
            else if (cur < 100) nextVal = 100;
            else if (cur < 125) nextVal = 125;
            else if (cur < 150) nextVal = 150;
            else nextVal = 50;
          } else if (el.id === "shadowMapQualitySlider") {
            nextVal = cur >= max ? min : cur + 1;
          } else if (el.id === "mouseSensitivitySlider") {
            if (cur < 100) nextVal = 100;
            else if (cur < 150) nextVal = 150;
            else if (cur < 200) nextVal = 200;
            else nextVal = 50;
          } else {
            const step = Number(el.step) || 10;
            nextVal = cur + step > max ? min : cur + step;
          }

          el.value = nextVal;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(e){}
          setTimeout(() => {
            this.applyUIFocus();
          }, 30);
          return;
        }

        // Target element to click (button, slot, card, toggle, link, etc.)
        const targetToClick = el;

        // Special handling for Seedian language button if clicked
        if (targetToClick.id === "langSdBtn" && typeof window.setGameLanguage === "function") {
          window.setGameLanguage("seedian", true);
        } else if (targetToClick.id === "langThBtn" && typeof window.setGameLanguage === "function") {
          window.setGameLanguage("th", true);
        } else if (targetToClick.id === "langEnBtn" && typeof window.setGameLanguage === "function") {
          window.setGameLanguage("en", true);
        } else if (targetToClick.id === "langJaBtn" && typeof window.setGameLanguage === "function") {
          window.setGameLanguage("ja", true);
        }

        // Special UI Area transitions for start screen actions
        if (targetToClick.id === "gameStartBtn") {
          this.uiNav.area = "saveSelect";
          this.uiNav.saveRow = 0;
          this.uiNav.saveCol = 0;
          this.uiNav.index = 0;
        } else if (targetToClick.id === "gameSettingsBtn") {
          this.uiNav.area = "settings";
          this.uiNav.settingsRow = 0;
          this.uiNav.settingsCol = 0;
        } else if (targetToClick.id === "btnSaveSelectBack") {
          this.uiNav.area = "startMenu";
          this.uiNav.index = 0;
        }

        // Native .click() invokes all click listeners and inline .onclick cleanly without duplicate firing
        if (typeof targetToClick.click === "function") {
          targetToClick.click();
        } else {
          const clickEvt = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window
          });
          targetToClick.dispatchEvent(clickEvt);
        }

        if (typeof playPlaceSound === "function") {
          try { playPlaceSound(); } catch(e){}
        }

        setTimeout(() => {
          this.applyUIFocus();
        }, 50);
      } finally {
        setTimeout(() => {
          window.isGamepadTriggeringClick = false;
        }, 60);
      }
    },

    triggerUIQuickAction: function() {
      const el = this.getUIFocusedElement();
      if (el && (el.classList.contains("inventory-slot") || el.classList.contains("action-slot"))) {
        if (window.selectedInventorySlot) {
          const btnSplit = document.getElementById("btnInventorySplit");
          if (btnSplit && btnSplit.offsetParent !== null) {
            btnSplit.click();
            return;
          }
        }
      }

      const bottomBtns = [
        document.getElementById("btnInventoryActionUI"),
        document.getElementById("btnInventorySplit"),
        document.getElementById("btnInventoryDrop"),
        document.getElementById("btnInventoryDestroy")
      ].filter(b => b && b.offsetParent !== null);

      if (bottomBtns.length > 0) {
        this.uiNav.area = "bottom";
        this.uiNav.index = 0;
        this.applyUIFocus();
      }
    },

    // Y (Button 3) Shortcut -> Jump directly to/from 4 bottom action buttons in UI
    triggerUIBottomButtonsShortcut: function() {
      if (!this.checkIsUIOpen()) return;

      const bottomBtns = [
        document.getElementById("btnInventoryActionUI"),
        document.getElementById("btnInventorySplit"),
        document.getElementById("btnInventoryDrop"),
        document.getElementById("btnInventoryDestroy")
      ].filter(b => b && b.offsetParent !== null);

      if (bottomBtns.length === 0) return;

      if (this.uiNav.area === "bottom") {
        // Toggle back up to grid / selected item!
        this.uiNav.area = "grid";
        if (window.selectedInventorySlot && typeof window.selectedInventorySlot.index === "number") {
          this.uiNav.index = window.selectedInventorySlot.index;
        }
      } else {
        // Jump directly down to the 3 bottom buttons!
        this.uiNav.area = "bottom";

        // If an item with count > 1 is selected, default to Split button (index 1) or Action UI (index 0)
        const selected = window.selectedInventorySlot;
        const item = selected ? selected.item : null;
        if (item && item.count > 1 && bottomBtns.length > 1) {
          const splitIdx = bottomBtns.findIndex(b => b.id === "btnInventorySplit");
          this.uiNav.index = splitIdx !== -1 ? splitIdx : 0;
        } else {
          this.uiNav.index = 0;
        }
      }

      this.applyUIFocus();
      if (typeof playPlaceSound === "function") {
        try { playPlaceSound(); } catch(e){}
      }
    },

    cycleTabs: function(dir) {
      if (!this.checkIsUIOpen()) return;
      const inv = document.getElementById("inventoryOverlay");
      if (!inv || !inv.classList.contains("open")) return;

      const tabs = this.getVisibleTabs();
      if (!tabs || tabs.length === 0) return;

      let activeIdx = tabs.findIndex(t => t.classList.contains("active"));
      if (activeIdx === -1) {
        const curTabName = typeof window.getActiveTab === "function" ? window.getActiveTab() : "inventory";
        if (curTabName === "crafting") activeIdx = tabs.findIndex(t => t.id === "tabCrafting");
        else if (curTabName === "cooking") activeIdx = tabs.findIndex(t => t.id === "tabCooking");
        else if (curTabName === "settings") activeIdx = tabs.findIndex(t => t.id === "tabSettings");
        else if (curTabName === "itemsList") activeIdx = tabs.findIndex(t => t.id === "tabItemsList");
        else activeIdx = tabs.findIndex(t => t.id === "tabInventory");
      }
      if (activeIdx === -1) activeIdx = 0;

      const nextIdx = (activeIdx + dir + tabs.length) % tabs.length;
      const targetTab = tabs[nextIdx];
      if (!targetTab) return;

      const tabNameMap = {
        "tabCrafting": "crafting",
        "tabInventory": "inventory",
        "tabSettings": "settings",
        "tabItemsList": "itemsList",
        "tabCooking": "cooking"
      };
      const tabName = tabNameMap[targetTab.id] || "inventory";
      if (typeof window.switchInventoryTab === "function") {
        window.switchInventoryTab(tabName);
      } else {
        targetTab.click();
      }

      if (typeof playPlaceSound === "function") {
        try { playPlaceSound(); } catch(e){}
      }

      if (this.uiNav.area === "tabs") {
        this.uiNav.index = nextIdx;
      } else {
        const newTabName = typeof window.getActiveTab === "function" ? window.getActiveTab() : "inventory";
        if (newTabName === "inventory" || newTabName === "itemsList") {
          this.uiNav.area = "grid";
          this.uiNav.index = 0;
        } else if (newTabName === "crafting" || newTabName === "cooking") {
          this.uiNav.area = "cards";
          this.uiNav.index = 0;
        } else if (newTabName === "settings") {
          this.uiNav.area = "settings";
          this.uiNav.settingsRow = 0;
          this.uiNav.settingsCol = 0;
        }
      }

      setTimeout(() => {
        this.applyUIFocus();
      }, 40);
    },

    // Virtual cursor click for UI navigation
    triggerVirtualCursorClick: function() {
      if (typeof virtualCursorX === "undefined" || typeof virtualCursorY === "undefined") return;
      const targetEl = document.elementFromPoint(virtualCursorX, virtualCursorY);
      if (!targetEl) return;

      const clickEvt = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: virtualCursorX,
        clientY: virtualCursorY
      });
      targetEl.dispatchEvent(clickEvt);
    },

    releaseAllButtons: function() {
      if (this.isRBDown) {
        this.triggerLeftClickUp();
      }
      if (this.isRTDown) {
        this.triggerRightClickUp();
      }
      if (this.prevLBDown) {
        this.triggerLBUp();
        this.prevLBDown = false;
      }
      if (this.prevLTDown) {
        this.triggerLTUp();
        this.prevLTDown = false;
      }
      this.prevRBDown = false;
      this.prevRTDown = false;
      this.prevMenuDown = false;
      this.prevADown = false;
      this.prevBDown = false;
      this.prevXDown = false;
      this.prevYDown = false;
      this.prevL3Down = false;
      this.prevR3Down = false;
      this.prevDUp = false;
      this.prevDDown = false;
      this.prevDLeft = false;
      this.prevDRight = false;
    }
  };

  window.GamepadController = GamepadController;
  GamepadController.init();
})();
