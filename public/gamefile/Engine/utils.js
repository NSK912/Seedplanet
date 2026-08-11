// Global references declared early to avoid load-time reference errors in other modules
var canvas = null;
var gl = null;
var isWebGL2 = false;
var supportUint32 = false;
var RADIUS = 8.0;
var HEIGHT_SCALE = 0.6;
var globalSeed = 0;
if (typeof window !== 'undefined') {
  window.RADIUS = 8.0;
  window.HEIGHT_SCALE = 0.6;
  window.globalSeed = 0;
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
  
  const chest = document.getElementById("chestOverlay");
  if (chest && chest.classList.contains("open")) return true;
  
  if (typeof gameStarted !== "undefined" && !gameStarted) {
    const start = document.getElementById("gameStartOverlay");
    if (start && start.style.display !== "none" && !start.classList.contains("fade-out")) return true;
  }
  
  const saveSelect = document.getElementById("saveSelectOverlay");
  if (saveSelect && saveSelect.classList.contains("open")) return true;

  const trash = document.getElementById("trashConfirmOverlay");
  if (trash && trash.style.display !== "none" && trash.style.display !== "") return true;

  const antialias = document.getElementById("antialiasConfirmOverlay");
  if (antialias && antialias.style.display !== "none" && antialias.style.display !== "") return true;

  return false;
}

// Helper to check if element is interactive (button, slot, clickable UI control, slider, tab)
function getInteractiveTarget(el) {
  if (!el || el === document.body || el === document.documentElement || el === canvas) return null;
  return el.closest("button, a, input, select, textarea, [onclick], .inventory-slot, .action-slot, .close-btn, .inventory-btn, .touch-btn, .tab-btn, .clickable, [role='button'], .item-card, .save-slot-card, .btn, [draggable='true'], .slider, .range-slider, .setting-slider, .tab, [id^='tab']");
}

// Ensure custom black & white circular cursor exists
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
          top: -100px;
          left: -100px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid #ffffff;
          background-color: #000000;
          box-shadow: 0 0 0 1.5px #000000, 0 2px 10px rgba(0, 0, 0, 0.7);
          pointer-events: none !important;
          z-index: 2147483647;
          transform: translate(-50%, -50%);
          display: block;
          box-sizing: border-box;
          transition: opacity 0.15s ease;
        }
        #customGameCursor * {
          pointer-events: none !important;
        }
        #customGameCursor .custom-cursor-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 4px;
          height: 4px;
          background-color: #ffffff;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none !important;
        }
        body.custom-cursor-active,
        body.custom-cursor-active canvas,
        body.custom-cursor-active * {
          cursor: none !important;
        }
        .virtual-hover {
          filter: brightness(1.3) !important;
          outline: 2px solid rgba(255, 255, 255, 0.8) !important;
          outline-offset: -1px;
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
  document.exitPointerLock = function() {
    // Only allow exit pointer lock if requested during window blur / switching app
    if (!window.isSwitchingApp) {
      return; // Ignore internal exit calls from game menus so pointer lock stays locked!
    }
    simulatedPointerLock = false;
    const nativeEl = originalPointerLockElementDesc ? originalPointerLockElementDesc.get.call(document) : null;
    if (nativeEl && originalExitPointerLock) {
      try { originalExitPointerLock.call(document); } catch(err){}
    }
    document.dispatchEvent(new Event('pointerlockchange'));
  };
})();

function requestPointerLockSafe() {
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

// Lock on first click from start screen or page
window.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "mouse") return;
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
    top: -1000px !important;
    left: -1000px !important;
    width: ${width}px !important;
    height: ${height}px !important;
    pointer-events: none !important;
    z-index: 2147483647 !important;
    transform: translate(-50%, -50%) !important;
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
  
  const isTouch = window.devInputMode === "touch" || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || 
                  (window.devInputMode === "auto" && typeof isAndroidProfile !== "undefined" && isAndroidProfile);

  if (isTouch) {
    cursor.style.opacity = "0";
    cursor.style.display = "none";
    return;
  }
  
  cursor.style.display = "block";

  if (uiOpen) {
    cursor.style.opacity = "1";
  } else if (window.isVirtualCursorManualHidden) {
    cursor.style.opacity = "0";
  } else {
    cursor.style.opacity = "1";
  }
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
          if (uiOpen) {
            if (typeof window.resetVirtualCursorToCenter === "function") window.resetVirtualCursorToCenter();
          } else {
            if (window.isVirtualCursorManualHidden) {
              if (typeof requestPointerLockSafe === "function") requestPointerLockSafe();
            }
          }
          lastUIOpen = uiOpen;
        }
        
        updateVirtualCursorVisibility();
      });
      observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ["class", "style"]
      });
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
  const cursor = typeof ensureCustomCursor === "function" ? ensureCustomCursor() : document.getElementById("customVirtualCursor");
  if (cursor) {
    cursor.style.left = virtualCursorX + "px";
    cursor.style.top = virtualCursorY + "px";
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

// Update mouse coordinates, virtual cursor, hover, movement, and drag
function handleVirtualMouseMove(e) {
  if (isSyntheticEvent) return;

  const isTouch = window.devInputMode === "touch" || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || 
                  (window.devInputMode === "auto" && typeof isAndroidProfile !== "undefined" && isAndroidProfile);
  if (isTouch) return;

  const cursor = ensureCustomCursor();
  if (!cursor) return;

  if (!hasVirtualCursorInitialized) {
    virtualCursorX = (e.clientX !== undefined && e.clientX !== 0) ? e.clientX : window.innerWidth / 2;
    virtualCursorY = (e.clientY !== undefined && e.clientY !== 0) ? e.clientY : window.innerHeight / 2;
    hasVirtualCursorInitialized = true;
  }

  const isNativeLocked = !!(Object.getOwnPropertyDescriptor(Document.prototype, 'pointerLockElement')?.get?.call(document));
  const uiOpen = typeof isUIOpen === "function" ? isUIOpen() : false;
  if (window.isVirtualCursorManualHidden && !uiOpen) {
    virtualCursorX = window.innerWidth / 2;
    virtualCursorY = window.innerHeight / 2;
  } else {
    if (isNativeLocked) {
      if (e.movementX !== undefined) {
        virtualCursorX += e.movementX;
        virtualCursorY += e.movementY;
      }
    } else if (e.clientX !== undefined && e.clientX !== 0) {
      virtualCursorX = e.clientX;
      virtualCursorY = e.clientY;
    }
    virtualCursorX = Math.max(0, Math.min(window.innerWidth, virtualCursorX));
    virtualCursorY = Math.max(0, Math.min(window.innerHeight, virtualCursorY));
  }

  cursor.style.left = virtualCursorX + "px";
  cursor.style.top = virtualCursorY + "px";

  updateVirtualCursorVisibility();

  // Check if dragging range sliders or draggable slots while mouse button is held
  if (isVirtualMouseDown) {
    // 1. Dragging range sliders
    if (activeVirtualDragInput) {
      didVirtualDrag = true;
      updateRangeInputFromVirtualCursor(activeVirtualDragInput, virtualCursorX);
    }

    // 2. Dragging inventory/action slots
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

      if (isVirtualDraggingSlot && virtualDragSource) {
        if (virtualDragGhost) {
          virtualDragGhost.style.left = virtualCursorX + "px";
          virtualDragGhost.style.top = virtualCursorY + "px";
        }

        isSyntheticEvent = true;
        const dragEvt = new Event("drag", { bubbles: true, cancelable: true });
        dragEvt.dataTransfer = virtualDataTransfer;
        dragEvt.clientX = virtualCursorX;
        dragEvt.clientY = virtualCursorY;
        virtualDragSource.dispatchEvent(dragEvt);
        if (typeof virtualDragSource.ondrag === "function") {
          try { virtualDragSource.ondrag(dragEvt); } catch(err){}
        }

        const currOver = document.elementFromPoint(virtualCursorX, virtualCursorY);
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
          overEvt.clientX = virtualCursorX;
          overEvt.clientY = virtualCursorY;
          currOver.dispatchEvent(overEvt);
          if (typeof currOver.ondragover === "function") {
            try { currOver.ondragover(overEvt); } catch(err){}
          }
        }
        isSyntheticEvent = false;
      }
    }
  }

  // Virtual hover state dispatch - ONLY for interactive buttons / slots
  cursor.style.pointerEvents = "none";
  const rawHoverEl = document.elementFromPoint(virtualCursorX, virtualCursorY);
  const interactiveTarget = getInteractiveTarget(rawHoverEl);

  if (interactiveTarget !== lastHoveredEl) {
    if (lastHoveredEl) {
      try { lastHoveredEl.classList.remove("virtual-hover"); } catch(err){}
      try {
        lastHoveredEl.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false, cancelable: false, clientX: virtualCursorX, clientY: virtualCursorY }));
        lastHoveredEl.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, cancelable: true, clientX: virtualCursorX, clientY: virtualCursorY }));
      } catch(err){}
    }
    if (interactiveTarget) {
      try { interactiveTarget.classList.add("virtual-hover"); } catch(err){}
      try {
        interactiveTarget.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false, cancelable: false, clientX: virtualCursorX, clientY: virtualCursorY }));
        interactiveTarget.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, clientX: virtualCursorX, clientY: virtualCursorY }));
      } catch(err){}
    }
    lastHoveredEl = interactiveTarget;
  }

  const dragTarget = activeVirtualDragTarget || rawHoverEl;
  if (dragTarget && dragTarget !== canvas && dragTarget !== document.body && dragTarget !== document.documentElement) {
    isSyntheticEvent = true;
    try {
      dragTarget.dispatchEvent(new MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: virtualCursorX,
        clientY: virtualCursorY,
        screenX: virtualCursorX,
        screenY: virtualCursorY,
        buttons: isVirtualMouseDown ? 1 : 0,
        button: 0
      }));

      dragTarget.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: virtualCursorX,
        clientY: virtualCursorY,
        screenX: virtualCursorX,
        screenY: virtualCursorY,
        buttons: isVirtualMouseDown ? 1 : 0,
        button: 0,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true
      }));
    } catch(err){}
    isSyntheticEvent = false;
  }
}

window.addEventListener("mousemove", handleVirtualMouseMove, { capture: true, passive: true });
window.addEventListener("pointermove", handleVirtualMouseMove, { capture: true, passive: true });

let lastVirtualMouseUpTime = 0;

// Redirect mouse clicks/events to virtual cursor target when UI is open or locked
function redirectMouseEventToVirtualCursor(e) {
  if (isSyntheticEvent) return;

  const isTouch = window.devInputMode === "touch" || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || 
                  (window.devInputMode === "auto" && typeof isAndroidProfile !== "undefined" && isAndroidProfile);
  if (isTouch) return;

  // Keep window focused for keyboard events
  if (window.focus) {
    try { window.focus(); } catch(err){}
  }

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

  const targetEl = document.elementFromPoint(virtualCursorX, virtualCursorY);
  if (!targetEl) return;

  // Record virtual mouse down / up for dragging and slider manipulation
  if (e.type === "mousedown" || e.type === "pointerdown") {
    isVirtualMouseDown = true;
    virtualMouseDownX = virtualCursorX;
    virtualMouseDownY = virtualCursorY;
    activeVirtualDragTarget = targetEl;
    didVirtualDrag = false;

    const rangeInput = (targetEl.tagName === "INPUT" && targetEl.type === "range") ? targetEl : targetEl.closest("input[type='range']");
    if (rangeInput) {
      activeVirtualDragInput = rangeInput;
      updateRangeInputFromVirtualCursor(rangeInput, virtualCursorX);
    } else {
      activeVirtualDragInput = null;
    }
  }
  const clickable = getInteractiveTarget(targetEl);
  const isTargetUI = targetEl !== canvas && targetEl !== document.body && targetEl !== document.documentElement;

  if (uiOpen || isTargetUI || clickable || activeVirtualDragInput) {
    if (targetEl.tagName !== "SELECT" && targetEl.tagName !== "OPTION") {
      e.preventDefault();
    }
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") {
      e.stopImmediatePropagation();
    }

    isSyntheticEvent = true;
    try {
      const syntheticEvent = new MouseEvent(e.type, {
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
      });

      targetEl.dispatchEvent(syntheticEvent);

      if (e.type === "mouseup" || e.type === "pointerup") {
        lastVirtualMouseUpTime = Date.now();
        if (activeVirtualDragInput) {
          updateRangeInputFromVirtualCursor(activeVirtualDragInput, virtualCursorX);
          activeVirtualDragInput.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
          activeVirtualDragInput = null;
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

        if (!didVirtualDrag && clickable && typeof clickable.click === "function") {
          clickable.click();
          if (clickable.tagName !== "INPUT" && clickable.tagName !== "TEXTAREA") {
            try { clickable.blur(); } catch(err){}
          }
        }
        didVirtualDrag = false;
      }

      if (e.type === "click") {
        if (!didVirtualDrag && clickable && typeof clickable.click === "function") {
          // Handled on mouseup or direct click
        }
        didVirtualDrag = false;
      }
    } catch (err) {
      console.warn("Error dispatching virtual mouse event:", err);
    } finally {
      isSyntheticEvent = false;
    }
  } else {
    if (e.type === "mouseup" || e.type === "pointerup") {
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
  updateVirtualCursorVisibility();
}, { capture: true, passive: true });

window.addEventListener("pointerup", () => {
  isVirtualMouseDown = false;
  window.isCameraDragging = false;
  updateVirtualCursorVisibility();
}, { capture: true, passive: true });

// Scroll wheel handler for virtual cursor
window.addEventListener("wheel", (e) => {
  if (isSyntheticEvent) return;

  let targetEl = null;
  if (typeof virtualCursorX !== "undefined" && typeof virtualCursorY !== "undefined") {
    targetEl = document.elementFromPoint(virtualCursorX, virtualCursorY);
  }
  if (!targetEl) {
    targetEl = e.target;
  }

  function findScrollContainer(el) {
    let curr = el;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      const style = window.getComputedStyle(curr);
      const overflowY = style.overflowY;
      const isScrollableStyle = (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay");
      
      if (isScrollableStyle && (curr.scrollHeight > curr.clientHeight || curr.classList.contains("inventory-panel") || curr.classList.contains("settings-panel"))) {
        return curr;
      }
      curr = curr.parentElement;
    }
    return null;
  }

  let scrollContainer = findScrollContainer(targetEl) || findScrollContainer(e.target);

  if (scrollContainer) {
    e.preventDefault();
    e.stopPropagation();
    scrollContainer.scrollTop += e.deltaY;
  } else if (!isUIOpen()) {
    // If no scrollable UI and in gameplay, switch hotbar action slot with mouse wheel
    if (typeof selectedActionSlotIndex !== "undefined" && typeof renderActionSlots === "function") {
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

      function multiplyMatrices(a, b) {
        const result = new Array(16);
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            let sum = 0;
            for (let k = 0; k < 4; k++) {
              sum += a[i * 4 + k] * b[k * 4 + j];
            }
            result[i * 4 + j] = sum;
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
    arrow.style.fontSize = "10px";
    arrow.style.marginLeft = "8px";
    
    display.appendChild(displayText);
    display.appendChild(arrow);
    
    const list = document.createElement('div');
    list.className = "custom-select-list game-ui";
    list.style.position = "absolute";
    list.style.top = "100%";
    list.style.left = "0";
    list.style.width = "100%";
    list.style.maxHeight = "200px";
    list.style.overflowY = "auto";
    list.style.background = "#1a1a1a";
    list.style.border = "1px solid #dfb76c";
    list.style.zIndex = "2147483647";
    list.style.display = "none";
    list.style.boxSizing = "border-box";
    list.style.boxShadow = "0 4px 12px rgba(0,0,0,0.8)";
    
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
        item.style.padding = "8px";
        item.style.cursor = "pointer";
        item.style.color = "#fff";
        item.style.borderBottom = "1px solid #333";
        item.style.fontSize = "12px";
        item.style.fontFamily = "'JetBrains Mono', monospace";
        
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
