// === SEEDPLANET MODULE: JS/START.JS ===

// ============================================
// ระบบหน้าเริ่มเกมและโหลดเอนจิ้นดวงดาว (Title Screen & Engine Loader) - Don't use LocalStorage devmode
// ============================================

// สร้าง Loading Screen สำหรับเครื่องยนต์ดาวแบบไดนามิก (Dynamic Progressive Loading Screen)
(function initAaaLoadingOverlay() {
  if (document.getElementById("aaaLoadingOverlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "aaaLoadingOverlay";
  overlay.className = "aaa-loading-overlay";
  overlay.innerHTML = `
    <div class="aaa-loading-container">
      <h2 class="aaa-loading-title">INITIALIZING PLANETARY ENGINE</h2>
      <div class="aaa-loading-status" id="aaaLoadingStatus">Allocating seed threads...</div>
      <div class="aaa-loading-bar-bg">
        <div class="aaa-loading-bar-fill" id="aaaLoadingBarFill"></div>
      </div>
      <div class="aaa-loading-percentage" id="aaaLoadingPercentage">0%</div>
      <div class="aaa-loading-tech-logs" id="aaaLoadingTechLogs">
        [SYS_OK] VBO Buffers Allocated<br>
        [SYS_OK] Seed Planet Core Loaded
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
})();

function startGameWithSlot(loadedData, devMode = false) {
  if (loadedData) {
    if (loadedData.RADIUS === 2.5 || loadedData.RADIUS === 3.6 || loadedData.RADIUS === 32.0) {
      loadedData.RADIUS = 8.0;
    }
    if (loadedData.currentGridSize === 180 || loadedData.currentGridSize === 1600 || loadedData.currentGridSize === 500) {
      loadedData.currentGridSize = 400;
    }
  }
  if (gameStarted) return;
  gameStarted = true;
  isDevMode = devMode;
  
  if (isDevMode || loadedData) {
    if (typeof window.isVirtualCursorManualHidden !== "undefined") {
      window.isVirtualCursorManualHidden = true;
      if (typeof window.updateVirtualCursorVisibility === "function") window.updateVirtualCursorVisibility();
    }
  }

  // Apply fullscreen gesture fallback on startup click
  const startupSettings = loadedData ? loadedData : DEFAULT_SETTINGS;
  if (startupSettings && typeof startupSettings.fullscreen === "boolean") {
    isCurrentFullscreen = startupSettings.fullscreen;
  }
  if (isCurrentFullscreen) {
    setTimeout(enterFullscreen, 100);
  }

  // เล่นเสียงดนตรี / เริ่มต้นระบบเสียง
  initAudio();

  // ซ่อนปุ่มต่างๆ บนหน้าจอเข้าเกมและโลโก้อย่างสมูท เพื่อแสดงผลการโหลดแบบ Real-Time บน Starfield background
  const buttonsContainer = document.getElementById("startMenuButtonsContainer");
  if (buttonsContainer) {
    buttonsContainer.style.opacity = "0";
    buttonsContainer.style.pointerEvents = "none";
  }
  const logoContainer = document.querySelector(".logo-container");
  if (logoContainer) {
    logoContainer.style.opacity = "0";
    logoContainer.style.pointerEvents = "none";
  }

  // ซ่อนหน้าจอเลือกเซฟ (ถ้าเปิดอยู่)
  const saveOverlay = document.getElementById("saveSelectOverlay");
  if (saveOverlay) {
    saveOverlay.classList.remove("open");
  }

  // 1. ตั้งค่าพื้นฐานและสุ่มค่าหากเป็นเซฟใหม่ก่อนนำไปใช้งาน
  if (!loadedData) {
    // หากเป็นเซฟใหม่ ให้สุ่มค่า Seed และขนาดเริ่มต้น
    globalSeed = Math.floor(Math.random() * 100000);
    currentGridSize = 400;
    // รีเซ็ตตำแหน่งตัวละคร
    charTheta = Math.PI / 2;
    charPhi = 0;
    // รีเซ็ตกระเป๋า
    inventory = [];
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      inventory.push(null);
    }
    actionSlotsItems = new Array(8).fill(null);
    collectedCount = { rock: 0, branch: 0, big_rock: 0 };
    choppedTrees = [];
    destroyedRocks = [];
    playerHP = 5;
    playerMaxHP = 5;
    updatePlayerHPUI();
  }

  // 2. ประยุกต์ใช้การตั้งค่า โดยส่งพารามิเตอร์ตัวที่ 3 (rebuildPlanet = false) เพื่อไม่ให้สร้างซ้ำซ้อน
  const settingsToApply = loadedData ? loadedData : { ...DEFAULT_SETTINGS, globalSeed: globalSeed, currentGridSize: currentGridSize };
  applySettings(settingsToApply, false, false);

  // บันทึกการเลือกเซฟและค่าเริ่มต้นลงระบบ Local ทันที (จะถูกข้ามโดยอัตโนมัติหากอยู่ในโหมดผู้พัฒนา)
  if (!isDevMode) {
    saveSettingsToLocalStorage();
  } else {
    console.log("⚠️ โหมดผู้พัฒนาเปิดอยู่: ข้ามการบันทึกข้อมูลเริ่มต้น (Dev mode is active: skipping initial save)");
  }
  // 3. สร้างดวงดาวแบบ Asynchronous พร้อมแสดงผล Loading Progress (สไตล์ AAA)
  // เพิ่มคลาสเพื่อให้พื้นหลังโหลดโปร่งใส และเห็นพื้นหลังอวกาศของหน้าแรกในขณะโหลด Real-Time
  const loadingOverlay = document.getElementById("aaaLoadingOverlay");
  if (loadingOverlay) {
    loadingOverlay.classList.add("loading-on-start");
  }
  showAaaLoading(true);

  // Defer planetary building slightly to let opacity transitions complete with buttery smooth FPS
  setTimeout(() => {
    buildPlanetAsync(currentGridSize, globalSeed, function(percent, statusText, logLine) {
      updateAaaLoading(percent, statusText, logLine);
    }).then(() => {
      if (waterEnabled) buildWaterSphere(currentGridSize);
      buildAtmosphereSphere(currentGridSize);

      // 4. นำสิ่งปลูกสร้าง (placedStructures) และของตกตามพื้นแบบไดนามิกกลับคืนมาหลังสร้างดาวเสร็จ
      const dynamicCollectibles = settingsToApply.dynamicCollectibles || [];
      const placedStructures = settingsToApply.placedStructures || [];

      if (placedStructures.length > 0) {
        placedStructures.forEach(p => {
          p.isPreview = false;
          if (p.type === "wood_boat") {
              p.isDynamic = true;
              if (!p.vel) p.vel = [0,0,0];
          } else {
              p.isDynamic = false;
          }
          const type = p.type;
          if (type === "stone_floor" || type === "wood_floor" || type === "thin_wood_floor" || type === "wood_wall" || type === "wood_window" || type === "wood_door" || type === "campfire") {
              const rad = getSuppressRadius(type, p.size);
              suppressGrassUnder(p.position, rad);
          }
        });
        collectibles = collectibles.concat(placedStructures);
      }
      
      if (dynamicCollectibles.length > 0) {
        collectibles = collectibles.concat(dynamicCollectibles);
      }

      window.collectibles = collectibles;
      
      refreshCollectiblesVBO();

      console.log(
        "🌍 สร้างดาวขนาด " +
          currentGridSize +
          "x" +
          currentGridSize +
          " | seed:",
        globalSeed + " จากเซฟ: localStorage",
      );

      renderInventory();
      renderActionSlots();
      updateBadge();
      updatePlayerHPUI();

      // เริ่ม Render Loop สำหรับ WebGL ทันที เพื่อให้ฉากหลังเคลื่อนไหวรออยู่ใต้อีเวนต์การเฟดเอาต์อย่างสมบูรณ์แบบ (60+ FPS)
      requestAnimationFrame(render);

      // เฟดปิดทั้งหน้าจอเข้าเกมและหน้าโหลดดวงดาวอย่างสมูทพร้อมกัน สลับเข้าสู่ดวงดาวทันทีแบบไร้รอยต่อ
      setTimeout(() => {
        const startOverlay = document.getElementById("gameStartOverlay");
        if (startOverlay) {
          startOverlay.classList.add("fade-out");
        }
        if (loadingOverlay) {
          loadingOverlay.classList.add("fade-out");
        }

        setTimeout(() => {
          if (startOverlay) {
            startOverlay.style.display = "none";
          }
          showAaaLoading(false);
          if (loadingOverlay) {
            loadingOverlay.classList.remove("loading-on-start");
            loadingOverlay.classList.remove("fade-out");
          }

          // แสดงส่วนติดต่อผู้ใช้ (UI) ทั้งหมดเมื่อเข้าสู่ดวงดาวแล้ว
          const gameUiElements = document.querySelectorAll(".game-ui");
          gameUiElements.forEach((el) => {
            el.classList.add("visible");
          });
          
          const actionSlotsEl = document.getElementById("actionSlots");
          if (actionSlotsEl) {
            actionSlotsEl.style.display = "grid";
          }

          const toggleBtn = document.getElementById("toggleControlsBtn");
          const mainCtrls = document.getElementById("mainControls");
          const fullBtn = document.getElementById("fullscreenBtn");
          const devLink = document.getElementById("devByNskLink");
          if (!isDevMode) {
            if (toggleBtn) toggleBtn.style.display = "none";
            if (mainCtrls) mainCtrls.style.display = "none";
            if (fullBtn) fullBtn.style.display = "none";
            if (devLink) devLink.style.display = "none";
          } else {
            if (toggleBtn) toggleBtn.style.display = "block";
            if (mainCtrls) mainCtrls.style.display = "flex";
            if (fullBtn) fullBtn.style.display = "inline-block";
            if (devLink) devLink.style.display = "inline";
          }
        }, 800);
      }, 500);
    });
  }, 400);
}

const startBtn = document.getElementById("gameStartBtn");
if (startBtn) {
  startBtn?.addEventListener("click", () => {
    openSaveSelector();
  });
}

const settingsMenuBtn = document.getElementById("gameSettingsBtn");
if (settingsMenuBtn) {
  settingsMenuBtn?.addEventListener("click", () => {
    const overlay = document.getElementById("inventoryOverlay");
    overlay.classList.add("open");

    activeTab = "settings";
    document.getElementById("tabSettings").classList.add("active");
    document.getElementById("tabInventory").classList.remove("active");
    document.getElementById("tabCrafting").classList.remove("active");
    document.getElementById("tabItemsList").classList.remove("active");
    
    document.getElementById("inventoryGrid").style.display = "none";
    document.getElementById("craftingList").style.display = "none";
    
    const mainLayout = document.getElementById("inventoryMainLayout");
    if (mainLayout) mainLayout.style.display = "none";
    const divider = document.getElementById("inventoryVerticalDivider");
    if (divider) divider.style.display = "none";
    
    document.getElementById("tabCooking").classList.remove("active");
    document.getElementById("tabCooking").style.display = "none";
    document.getElementById("cookingList").style.display = "none";

    document.getElementById("inventorySettings").style.display = "flex";

    // ซ่อนแท็บอื่นๆ และปุ่มออกไปหน้าหลัก
    document.getElementById("tabInventory").style.display = "none";
    document.getElementById("tabCrafting").style.display = "none";
    document.getElementById("tabItemsList").style.display = "none";
    document.getElementById("btnExitToMenu").style.display = "none";

    syncInventorySettingsUI();
  });
}

const devBtn = document.getElementById("gameDevBtn");
if (devBtn) {
  devBtn?.addEventListener("click", () => {
    startGameWithSlot(null, true);
  });
}

// ระบบปลดล็อคโหมดผู้พัฒนาโดยการพิมพ์ "dev mode" หรือ "devmode" ในหน้าจอหลัก
let startScreenTyped = "";
window.addEventListener("keydown", (e) => {
  if (gameStarted) return;
  if (e.key && e.key.length === 1) {
    startScreenTyped += e.key.toLowerCase();
    if (startScreenTyped.length > 20) {
      startScreenTyped = startScreenTyped.slice(-20);
    }
    if (startScreenTyped.includes("dev mode") || startScreenTyped.includes("devmode")) {
      const devBtnEl = document.getElementById("gameDevBtn");
      if (devBtnEl) {
        devBtnEl.style.display = "inline-block";
        startScreenTyped = "";
        console.log("🔓 ปลดล็อคโหมดผู้พัฒนาแล้ว!");
      }
    }
  }
});

// ฟังก์ชันเปิด URL ด้วยบราวเซอร์ระบบภายนอก รองรับ Tauri v1 และ v2 ทุกเวอร์ชัน
function openExternalUrl(url) {
  if (!window.__TAURI__) {
    window.open(url, "_blank");
    return;
  }
  
  // 1. ลองใช้ฟังก์ชันจากปลั๊กอิน opener ของ Tauri v2
  if (window.__TAURI__.opener && typeof window.__TAURI__.opener.openUrl === "function") {
    window.__TAURI__.opener.openUrl(url).catch(err => {
      console.error("Tauri opener.openUrl failed", err);
      fallbackTauriShell(url);
    });
    return;
  }

  // 2. ลองใช้ฟังก์ชันจากปลั๊กอิน shell ของ Tauri v1/v2
  if (window.__TAURI__.shell && typeof window.__TAURI__.shell.open === "function") {
    window.__TAURI__.shell.open(url).catch(err => {
      console.error("Tauri shell.open failed", err);
      fallbackTauriShell(url);
    });
    return;
  }

  fallbackTauriShell(url);
}

function fallbackTauriShell(url) {
  if (!window.__TAURI__ || !window.__TAURI__.core || typeof window.__TAURI__.core.invoke !== "function") {
    window.open(url, "_blank");
    return;
  }
  
  // 3. ลองเรียกคำสั่ง invoke ของ opener โดยตรง
  window.__TAURI__.core.invoke("plugin:opener|open_url", { url: url })
    .catch((err1) => {
      console.warn("Tauri plugin:opener|open_url failed", err1);
      // 4. ลองเรียกคำสั่ง invoke ของ shell ดั้งเดิม
      window.__TAURI__.core.invoke("plugin:shell|open", { value: url })
        .catch((err2) => {
          console.warn("Tauri plugin:shell|open failed with value", err2);
          // 5. ลองส่งพารามิเตอร์แบบอื่น
          window.__TAURI__.core.invoke("plugin:shell|open", { value: url, request: url })
            .catch((err3) => {
              console.error("All Tauri shell opening attempts failed", err3);
              window.open(url, "_blank");
      });
    });
    });
}

// แนบการทำงานเข้ากับลิงก์ Dev by NSK
const nskLink = document.getElementById("devByNskLink");
if (nskLink) {
  nskLink?.addEventListener("click", (e) => {
    if (window.__TAURI__) {
      e.preventDefault();
      openExternalUrl(nskLink.href);
    }
  });
}

const btnSaveSelectBack = document.getElementById("btnSaveSelectBack");
if (btnSaveSelectBack) {
  btnSaveSelectBack?.addEventListener("click", () => {
    closeSaveSelector();
  });
}

// เริ่มต้นระบบบันทึกค่าการตั้งค่าอัตโนมัติเมื่อผู้ใช้เปลี่ยนค่าในเมนูต่างๆ
initSettingsAutoSaveHooks();
initRestoreDefaultsHandler();
renderKeyBindingsUI();

// โหลดการตั้งค่าตอนเริ่มเกม
tryLoadSettingsOnStartup();
