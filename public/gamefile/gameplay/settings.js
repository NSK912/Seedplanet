// === SEEDPLANET MODULE: JS/SETTINGS.JS ===

// ============================================
// Global Settings & Keybindings
// ============================================

let sfxVolume = 0.5;
let playerFootstepVolume = 0.0;
let playerSwimVolume = 0.09;
let collectSfxVolume = 0.2;
let npcSfxVolume = 0.5;
let sfxMuted = false;

let isCurrentFullscreen = false;
const isAndroidProfile = /Android/i.test(navigator.userAgent);
let showScreenModeUI = !isAndroidProfile;
let renderScale = isAndroidProfile ? 0.25 : 1.0;
let mouseSensitivity = 1.0;
let uiMargin = 10;
let showFps = true;
let targetFps = isAndroidProfile ? 30 : 120;
let frameTime = 1000 / targetFps;

let shadowMapQuality = isAndroidProfile ? 1 : 2;
let shadowMapEnabled = shadowMapQuality > 0;
let antialiasEnabled = false;
let taauEnabled = false;

// Pre-load from localStorage immediately so they are available for WebGL initialization
try {
  const savedOptions = localStorage.getItem("seedplanet_options_config");
  if (savedOptions) {
    const parsedOptions = JSON.parse(savedOptions);
    if (parsedOptions) {
      if (typeof parsedOptions.shadowMapEnabled === "boolean") {
        shadowMapEnabled = parsedOptions.shadowMapEnabled; if(typeof parsedOptions.shadowMapQuality === "number") { shadowMapQuality = Math.max(1, parsedOptions.shadowMapQuality); }
        shadowMapEnabled = true;
      }
      if (typeof parsedOptions.antialiasEnabled === "boolean") {
        antialiasEnabled = parsedOptions.antialiasEnabled;
      }
      if (typeof parsedOptions.taauEnabled === "boolean") {
        taauEnabled = parsedOptions.taauEnabled;
      }
    }
  } else {
    const savedSettings = localStorage.getItem("seedplanet_settings");
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      if (parsedSettings) {
        if (typeof parsedSettings.shadowMapEnabled === "boolean") {
          shadowMapEnabled = parsedSettings.shadowMapEnabled;
        }
        if (typeof parsedSettings.antialiasEnabled === "boolean") {
          antialiasEnabled = parsedSettings.antialiasEnabled;
        }
        if (typeof parsedSettings.taauEnabled === "boolean") {
          taauEnabled = parsedSettings.taauEnabled;
        }
      }
    }
  }
} catch (e) {
  console.error("Failed to pre-load settings in settings.js:", e);
}

let cameraMode = "tps";
var zoomLimitEnabled = true;
let cameraCollisionEnabled = true;
let ragdollEnabled = false;

let currentKeyBindings = {
  forward: "KeyW",
  backward: "KeyS",
  left: "KeyA",
  right: "KeyD",
  interact: "KeyE",
  inventory: "Tab",
  diveDown: "KeyZ",
  diveUp: "ShiftLeft",
  toggleMouse: "AltLeft",
  action1: "Digit1",
  action2: "Digit2",
  action3: "Digit3",
  action4: "Digit4",
  rotate: "KeyQ",
  demolish: "CapsLock",
};

let isWaitingForKey = false;
let bindingKeyToSet = null;

function renderKeyBindingsUI() {
  const container = document.getElementById("keyBindingsContainer");
  if (!container) return;

  const getLabel = (key) => {
    if (typeof t === "function") {
      const translated = t("key_" + key);
      if (translated && translated !== "key_" + key) return translated;
    }
    const defaultLabels = {
      forward: "เดินหน้า (Forward)",
      backward: "ถอยหลัง (Backward)",
      left: "เดินซ้าย (Left)",
      right: "เดินขวา (Right)",
      interact: "สำรวจ (Interact)",
      inventory: "กระเป๋า (Inventory)",
      diveDown: "ดำน้ำ (Dive Down)",
      diveUp: "ว่ายขึ้น (Swim Up)",
      toggleMouse: "ซ่อน/แสดง เมาส์จำลอง (Toggle Virtual Cursor)",
      action1: "ช่องแอคชั่น 1 (Action Slot 1)",
      action2: "ช่องแอคชั่น 2 (Action Slot 2)",
      action3: "ช่องแอคชั่น 3 (Action Slot 3)",
      action4: "ช่องแอคชั่น 4 (Action Slot 4)",
      rotate: "หมุนโครงสร้างตอนวาง (Rotate Structure)",
      demolish: "รื้อถอนสิ่งก่อสร้าง (Demolish)",
    };
    return defaultLabels[key] || key;
  };

  let html = "";
  for (const [key, value] of Object.entries(currentKeyBindings)) {
    const label = getLabel(key);
    const isLocked = key === "toggleMouse";
    html += `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 4px 8px; border: 1px solid rgba(255,255,255,0.05); border-radius: 4px;">
            <span style="font-size: 11px; font-family: 'Google Sans', 'Kanit', sans-serif;">${label}</span>
            <button class="key-bind-btn game-ui" data-key="${key}" ${isLocked ? "disabled" : ""} style="background: rgba(223,183,108,0.15); border: 1px solid #dfb76c; color: #dfb76c; padding: 4px 12px; font-size: 11px; font-family: 'Google Sans', 'Kanit', sans-serif; ${isLocked ? "opacity: 0.5; cursor: not-allowed;" : "cursor: pointer;"} min-width: 60px; text-align: center; transition: all 0.2s;">
                ${value.replace("Key", "").replace("Arrow", "").replace("Left", "").replace("Right", "")}
            </button>
        </div>
    `;
  }
  container.innerHTML = html;

  const btns = container.querySelectorAll(".key-bind-btn");
  btns.forEach((btn) => {
    btn?.addEventListener("click", (e) => {
      if (isWaitingForKey) return;
      isWaitingForKey = true;
      bindingKeyToSet = e.target.dataset.key;
      e.target.style.background = "rgba(239, 68, 68, 0.2)";
      e.target.style.borderColor = "#ef4444";
      e.target.style.color = "#ef4444";
      e.target.textContent = typeof t === "function" ? t("key_press_key") : "กดปุ่ม...";

      const keyHandler = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        currentKeyBindings[bindingKeyToSet] = ev.code;
        isWaitingForKey = false;
        bindingKeyToSet = null;
        window.removeEventListener("keydown", keyHandler, true);
        renderKeyBindingsUI();
        if (typeof saveSettingsToLocalStorage === "function") {
          saveSettingsToLocalStorage();
        }
      };
      window.addEventListener("keydown", keyHandler, true);
    });
  });
}

function syncInventorySettingsUI() {
  const sfxSlider = document.getElementById("sfxVolumeSlider");
  const sfxVal = document.getElementById("sfxVolumeVal");
  if (sfxSlider && sfxVal) {
    sfxSlider.value = Math.round(sfxVolume * 100);
    sfxVal.textContent = Math.round(sfxVolume * 100) + "%";
  }

  const pfSlider = document.getElementById("playerFootstepVolumeSlider");
  const pfVal = document.getElementById("playerFootstepVolumeVal");
  if (pfSlider && pfVal) {
    pfSlider.value = Math.round(playerFootstepVolume * 100);
    pfVal.textContent = Math.round(playerFootstepVolume * 100) + "%";
  }

  const psSlider = document.getElementById("playerSwimVolumeSlider");
  const psVal = document.getElementById("playerSwimVolumeVal");
  if (psSlider && psVal) {
    psSlider.value = Math.round(playerSwimVolume * 100);
    psVal.textContent = Math.round(playerSwimVolume * 100) + "%";
  }

  const cSlider = document.getElementById("collectSfxVolumeSlider");
  const cVal = document.getElementById("collectSfxVolumeVal");
  if (cSlider && cVal) {
    cSlider.value = Math.round(collectSfxVolume * 100);
    cVal.textContent = Math.round(collectSfxVolume * 100) + "%";
  }

  const nSlider = document.getElementById("npcSfxVolumeSlider");
  const nVal = document.getElementById("npcSfxVolumeVal");
  if (nSlider && nVal) {
    nSlider.value = Math.round(npcSfxVolume * 100);
    nVal.textContent = Math.round(npcSfxVolume * 100) + "%";
  }

  if (typeof setSFXMuted === 'function') {
    setSFXMuted(sfxMuted);
  }

  const scaleSlider = document.getElementById("renderScaleSlider");
  const scaleVal = document.getElementById("renderScaleVal");
  if (scaleSlider && scaleVal) {
    scaleSlider.value = Math.round(renderScale * 100);
    scaleVal.textContent = Math.round(renderScale * 100) + "%";
  }

  const sensSlider = document.getElementById("mouseSensitivitySlider");
  const sensVal = document.getElementById("mouseSensitivityVal");
  if (sensSlider && sensVal) {
    sensSlider.value = Math.round(mouseSensitivity * 100);
    sensVal.textContent = mouseSensitivity.toFixed(2) + "x";
  }

  function updateTaauUI() {
    const btnOn = document.getElementById("taauToggleOn");
    const btnOff = document.getElementById("taauToggleOff");
    if (!btnOn || !btnOff) return;
    if (taauEnabled) {
      btnOn.style.background = "rgba(223, 183, 108, 0.15)";
      btnOn.style.borderColor = "#dfb76c";
      btnOn.style.color = "#dfb76c";
      btnOn.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";

      btnOff.style.background = "rgba(255, 255, 255, 0.05)";
      btnOff.style.borderColor = "rgba(255, 255, 255, 0.2)";
      btnOff.style.color = "rgba(255, 255, 255, 0.6)";
      btnOff.style.textShadow = "none";
    } else {
      btnOff.style.background = "rgba(223, 183, 108, 0.15)";
      btnOff.style.borderColor = "#dfb76c";
      btnOff.style.color = "#dfb76c";
      btnOff.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";

      btnOn.style.background = "rgba(255, 255, 255, 0.05)";
      btnOn.style.borderColor = "rgba(255, 255, 255, 0.2)";
      btnOn.style.color = "rgba(255, 255, 255, 0.6)";
      btnOn.style.textShadow = "none";
    }
  }
  window.updateTaauUI = updateTaauUI;

  if (typeof syncScreenModeUI === 'function') syncScreenModeUI();
  if (typeof updateFpsToggleUI === 'function') updateFpsToggleUI();
  if (typeof updateFpsLimitUI === 'function') updateFpsLimitUI();
  if (typeof updateShadowMapUI === 'function') updateShadowMapUI();
  if (typeof updateAntialiasUI === 'function') updateAntialiasUI();
  updateTaauUI();

  renderKeyBindingsUI();
}

document.addEventListener("DOMContentLoaded", () => {
  const taauOn = document.getElementById("taauToggleOn");
  if (taauOn) {
    taauOn.addEventListener("click", () => {
      taauEnabled = true;
      if (typeof updateTaauUI === "function") updateTaauUI();
      if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
    });
  }
  const taauOff = document.getElementById("taauToggleOff");
  if (taauOff) {
    taauOff.addEventListener("click", () => {
      taauEnabled = false;
      if (typeof updateTaauUI === "function") updateTaauUI();
      if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
    });
  }

  const sfxSlider = document.getElementById("sfxVolumeSlider");
  if (sfxSlider) {
    sfxSlider?.addEventListener("input", (e) => {
      sfxVolume = parseInt(e.target.value) / 100;
      document.getElementById("sfxVolumeVal").textContent = e.target.value + "%";
    });
    sfxSlider?.addEventListener("change", () => {
      if (typeof playCollectSound === 'function') playCollectSound();
    });
  }

  const muteBtn = document.getElementById("sfxMuteToggle");
  if (muteBtn) {
    muteBtn?.addEventListener("click", () => {
      sfxMuted = !sfxMuted;
      if (typeof setSFXMuted === 'function') setSFXMuted(sfxMuted);
      if (typeof playCollectSound === 'function') playCollectSound();
    });
  }

  const renderSlider = document.getElementById("renderScaleSlider");
  if (renderSlider) {
    renderSlider?.addEventListener("input", (e) => {
      let val = Math.round(parseInt(e.target.value) / 10) * 10;
      val = Math.max(10, Math.min(100, val));
      e.target.value = val;
      renderScale = val / 100;
      document.getElementById("renderScaleVal").textContent = val + "%";
      if (typeof resizeCanvas === 'function') {
        resizeCanvas();
      }
    });
  }

  const sensSlider = document.getElementById("mouseSensitivitySlider");
  if (sensSlider) {
    sensSlider?.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      mouseSensitivity = val / 100;
      document.getElementById("mouseSensitivityVal").textContent = mouseSensitivity.toFixed(2) + "x";
    });
  }

  const pfSlider = document.getElementById("playerFootstepVolumeSlider");
  if (pfSlider) {
    pfSlider?.addEventListener("input", (e) => {
      playerFootstepVolume = parseInt(e.target.value) / 100;
      document.getElementById("playerFootstepVolumeVal").textContent = e.target.value + "%";
    });
  }

  const psSlider = document.getElementById("playerSwimVolumeSlider");
  if (psSlider) {
    psSlider?.addEventListener("input", (e) => {
      playerSwimVolume = parseInt(e.target.value) / 100;
      document.getElementById("playerSwimVolumeVal").textContent = e.target.value + "%";
    });
  }

  const cSlider = document.getElementById("collectSfxVolumeSlider");
  if (cSlider) {
    cSlider?.addEventListener("input", (e) => {
      collectSfxVolume = parseInt(e.target.value) / 100;
      document.getElementById("collectSfxVolumeVal").textContent = e.target.value + "%";
    });
  }

  const nSlider = document.getElementById("npcSfxVolumeSlider");
  if (nSlider) {
    nSlider?.addEventListener("input", (e) => {
      npcSfxVolume = parseInt(e.target.value) / 100;
      document.getElementById("npcSfxVolumeVal").textContent = e.target.value + "%";
    });
  }
});
