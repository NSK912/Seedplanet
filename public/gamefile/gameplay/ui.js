window.isConfirmOverlayOpen = false;

window.addEventListener("keydown", (e) => {
  if (window.isConfirmOverlayOpen) {
    e.stopImmediatePropagation();
  }
}, true);

window.addEventListener("keyup", (e) => {
  if (window.isConfirmOverlayOpen) {
    e.stopImmediatePropagation();
  }
}, true);

// === SEEDPLANET MODULE: JS/UI.JS ===

      // ============================================
      // FPS Counter & Lock at 120
      // ============================================
      let frameCount = 0;
      let lastFpsUpdate = 0;
      let currentFps = 0;
      
      
      let lastFrameTime = 0;
      let fpsDisplay = document.getElementById("fpsDisplay");

      // ============================================
      // Virtual Joystick Controller
      // ============================================
      let joystickX = 0;
      let joystickY = 0;
      let joystickActive = false;

      const joystickBase = document.getElementById("joystickBase");
      const joystickThumb = document.getElementById("joystickThumb");

      function getJoystickPosition(clientX, clientY) {
        const rect = joystickBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const radius = rect.width / 2;

        let dx = clientX - centerX;
        let dy = clientY - centerY;

        const deadZone = 8;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < deadZone) {
          return { x: 0, y: 0, dx: 0, dy: 0 };
        }

        const maxDist = radius - 25;
        let clampedDx = dx;
        let clampedDy = dy;
        if (distance > maxDist) {
          clampedDx = (dx / distance) * maxDist;
          clampedDy = (dy / distance) * maxDist;
        }

        const normX = clampedDx / maxDist;
        const normY = -clampedDy / maxDist;

        return { x: normX, y: normY, dx: clampedDx, dy: clampedDy };
      }

      function updateJoystick(clientX, clientY) {
        const pos = getJoystickPosition(clientX, clientY);
        joystickX = pos.x;
        joystickY = pos.y;

        if (joystickThumb) {
          const rect = joystickBase.getBoundingClientRect();
          const radius = rect.width / 2;
          const maxDist = radius - 25;
          const thumbX = pos.dx;
          const thumbY = pos.dy;
          joystickThumb.style.transform = `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`;
          joystickThumb.classList.toggle("active", pos.x !== 0 || pos.y !== 0);
        }
      }

      function resetJoystick() {
        joystickX = 0;
        joystickY = 0;
        joystickActive = false;
        if (joystickThumb) {
          joystickThumb.style.transform = "translate(-50%, -50%)";
          joystickThumb.classList.remove("active");
        }
      }

      // Touch events
      if (joystickBase) {
        joystickBase?.addEventListener(
          "touchstart",
          (e) => {
            if (window.isConfirmOverlayOpen) return;
            initAudio();
            e.preventDefault();
            const touch = e.touches[0];
            if (touch) {
              joystickActive = true;
              updateJoystick(touch.clientX, touch.clientY);
            }
          },
          { passive: false },
        );
      }

      document.addEventListener(
        "touchmove",
        (e) => {
          if (window.isConfirmOverlayOpen) { resetJoystick(); return; }
          if (!joystickActive) return;
          e.preventDefault();
          const touch = e.touches[0];
          if (touch) {
            updateJoystick(touch.clientX, touch.clientY);
          }
        },
        { passive: false },
      );

      document.addEventListener(
        "touchend",
        (e) => {
          if (joystickActive) {
            resetJoystick();
          }
        },
        { passive: false },
      );

      document.addEventListener(
        "touchcancel",
        (e) => {
          if (joystickActive) {
            resetJoystick();
          }
        },
        { passive: false },
      );

      // Mouse events
      let mouseDown = false;
      joystickBase?.addEventListener("mousedown", (e) => {
        if (window.isConfirmOverlayOpen) return;
        e.preventDefault();
        mouseDown = true;
        joystickActive = true;
        updateJoystick(e.clientX, e.clientY);
      });

      document.addEventListener("mousemove", (e) => {
        if (window.isConfirmOverlayOpen) { mouseDown = false; resetJoystick(); return; }
        if (!mouseDown) return;
        updateJoystick(e.clientX, e.clientY);
      });

      document.addEventListener("mouseup", () => {
        if (mouseDown) {
          mouseDown = false;
          resetJoystick();
        }
      });

      // Auto show/hide joystick based on input type (Touch vs Mouse/Keyboard)
      let lastTouchTime = 0;
      const joystickContainer = document.getElementById("joystickContainer");
      let devInputMode = "auto"; // "auto", "touch", "keyboard"
      window.devInputMode = devInputMode;

      function showDpad() {
        if (devInputMode === "keyboard") return;
        if (joystickContainer && joystickContainer.style.display === "none") {
          joystickContainer.style.display = "block";
        }
        const actionSlotsEl = document.getElementById("actionSlots");
        if (actionSlotsEl) actionSlotsEl.classList.remove("keyboard-mode");
        const invActionSlotsEl = document.getElementById("inventoryActionSlots");
        if (invActionSlotsEl) invActionSlotsEl.classList.remove("keyboard-mode");
      }

      function hideDpad() {
        if (devInputMode === "touch") return;
        if (joystickContainer && joystickContainer.style.display !== "none") {
          joystickContainer.style.display = "none";
        }
        const actionSlotsEl = document.getElementById("actionSlots");
        if (actionSlotsEl) actionSlotsEl.classList.add("keyboard-mode");
        const invActionSlotsEl = document.getElementById("inventoryActionSlots");
        if (invActionSlotsEl) invActionSlotsEl.classList.add("keyboard-mode");
      }

      // Touch events anywhere on window should restore the dpad
      window.addEventListener(
        "touchstart",
        () => {
          lastTouchTime = Date.now();
          showDpad();
        },
        { passive: true },
      );

      window.addEventListener(
        "touchmove",
        () => {
          lastTouchTime = Date.now();
          showDpad();
        },
        { passive: true },
      );

      window.addEventListener(
        "touchend",
        () => {
          lastTouchTime = Date.now();
          showDpad();
        },
        { passive: true },
      );

      // Keyboard events anywhere on window should hide the dpad
      window.addEventListener(
        "keydown",
        () => {
          hideDpad();
        },
        { passive: true },
      );

      // Mouse events anywhere on window should hide the dpad (if not a synthetic touch event)
      window.addEventListener(
        "mousemove",
        () => {
          if (Date.now() - lastTouchTime > 1000) {
            hideDpad();
          }
        },
        { passive: true },
      );

      window.addEventListener(
        "mousedown",
        () => {
          if (Date.now() - lastTouchTime > 1000) {
            hideDpad();
          }
        },
        { passive: true },
      );


      // ============================================
      // ระบบเปิดกระเป๋าด้วยปุ่ม Tab (ป้องกันการกดค้าง)
      // ============================================
      let inventoryKeyPressed = false;

      // ป้องกันปุ่ม Tab นำทางโฟกัสเบราว์เซอร์ในหน้าเริ่มเกม และเปิด/ปิดหรือปิดเมื่อเปิดตั้งค่าอยู่
      window.addEventListener("keydown", (e) => {
        if (e.key === "Tab" || e.code === "Tab") {
          const overlay = document.getElementById("inventoryOverlay");
          const isCurrentlyOpen = overlay && overlay.classList.contains("open");
          if (isCurrentlyOpen) {
            e.preventDefault();
            e.stopPropagation();
            toggleInventory();
          } else if (!gameStarted) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }, true);

      document.addEventListener("keydown", (e) => {
        if (e.code === currentKeyBindings.inventory) {
          e.preventDefault();
          if (!gameStarted) return;
          if (!inventoryKeyPressed) {
            inventoryKeyPressed = true;
            if (currentOpenChest) {
              closeChest();
            } else {
              toggleInventory();
            }
          }
        }
      });

      document.addEventListener("keyup", (e) => {
        if (e.code === currentKeyBindings.inventory) {
          inventoryKeyPressed = false;
        }
      });

      document.addEventListener("keydown", (e) => {
        if (!gameStarted) return;
        
        let newSelection = -1;
        if (e.code === currentKeyBindings.action1) {
          newSelection = 0;
        } else if (e.code === currentKeyBindings.action2) {
          newSelection = 1;
        } else if (e.code === currentKeyBindings.action3) {
          newSelection = 2;
        } else if (e.code === currentKeyBindings.action4) {
          newSelection = 3;
        }
        
        if (newSelection !== -1) {
          if (selectedActionSlotIndex === newSelection) {
            selectedActionSlotIndex = -1; // Toggle off
          } else {
            selectedActionSlotIndex = newSelection;
          }
          if (typeof renderActionSlots === "function") renderActionSlots();
        }
      });

      // Event Listeners สำหรับกระเป๋า
      const invToggleEl = document.getElementById("inventoryToggle");
      if (invToggleEl) {
        let pressTimer = null;
        let isLongPress = false;
        let isPressed = false;
        let demolishWasActiveOnDown = false;
        let lastTouchTime = 0;

        const handleDown = (isTouchMode) => {
          if (typeof initAudio === "function") initAudio();
          isPressed = true;
          isLongPress = false;
          demolishWasActiveOnDown = (typeof isDemolishModeEnabled !== 'undefined' && isDemolishModeEnabled);

          if (isTouchMode) {
            if (demolishWasActiveOnDown) {
              // หากเปิดโหมดรื้อถอนอยู่ การแตะจะปิดโหมดรื้อถอนทันที (ส่ง CapsLock keydown)
              window.dispatchEvent(new KeyboardEvent("keydown", {
                key: "CapsLock",
                code: "CapsLock",
                keyCode: 20,
                which: 20,
                bubbles: true,
                cancelable: true
              }));
              return;
            }

            pressTimer = setTimeout(() => {
              isLongPress = true;
              // ส่งสัญญาณปุ่ม CapsLock เพื่อเปิดโหมดรื้อถอนเมื่อกดค้างครบ 300ms
              window.dispatchEvent(new KeyboardEvent("keydown", {
                key: "CapsLock",
                code: "CapsLock",
                keyCode: 20,
                which: 20,
                bubbles: true,
                cancelable: true
              }));
            }, 300); // 300ms threshold for long press
          }
        };

        const handleUp = (isTouchMode) => {
          if (!isPressed) return;
          isPressed = false;

          if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }

          if (isTouchMode) {
            if (!isLongPress) {
              // หากเป็นการแตะสั้น และไม่ได้เปิดโหมดรื้อถอนมาก่อน ให้เปิด/ปิดกระเป๋าปกติ
              if (!demolishWasActiveOnDown) {
                if (typeof toggleInventory === "function") {
                  toggleInventory();
                }
              }
            }
          } else {
            // Normal desktop click immediate toggle
            if (typeof toggleInventory === "function") {
              toggleInventory();
            }
          }
          isLongPress = false;
        };

        invToggleEl?.addEventListener("touchstart", (e) => {
          e.preventDefault();
          lastTouchTime = Date.now();
          handleDown(true);
        }, { passive: false });

        invToggleEl?.addEventListener("touchend", (e) => {
          e.preventDefault();
          lastTouchTime = Date.now();
          handleUp(true);
        }, { passive: false });

        invToggleEl?.addEventListener("touchcancel", (e) => {
          e.preventDefault();
          lastTouchTime = Date.now();
          handleUp(true);
        }, { passive: false });

        invToggleEl?.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          // ป้องกันการทำงานซ้ำหากเพิ่งเกิด Touch Event ไปไม่นาน
          if (Date.now() - lastTouchTime < 1000) return;

          const isSimulatedTouchMode = (typeof devInputMode !== "undefined" && devInputMode === "touch");
          if (isSimulatedTouchMode) {
            handleDown(true);
          }
        });

        // ตรวจจับ mouseup บนหน้าต่างเบราว์เซอร์ เพื่อความปลอดภัยกรณีปล่อยเมาส์นอกปุ่ม
        const mouseUpWindow = (e) => {
          if (isPressed) {
            if (Date.now() - lastTouchTime < 1000) return;
            const isSimulatedTouchMode = (typeof devInputMode !== "undefined" && devInputMode === "touch");
            handleUp(isSimulatedTouchMode);
          }
        };
        window.addEventListener("mouseup", mouseUpWindow);

        // ดักจับเหตุการณ์คลิกแบบปกติ (สำหรับโหมดเมาส์/คีย์บอร์ดดั้งเดิม)
        invToggleEl?.addEventListener("click", (e) => {
          // หากมาจาก Touch Event หรืออยู่ในโหมดจำลองจอสัมผัส จะข้ามการทำงานส่วนนี้
          if (Date.now() - lastTouchTime < 1000) return;
          const isSimulatedTouchMode = (typeof devInputMode !== "undefined" && devInputMode === "touch");
          if (isSimulatedTouchMode) return;

          if (typeof toggleInventory === "function") {
            toggleInventory();
          }
        });

        // Dynamic monitoring of demolish mode state to update inventory button UI
        let lastDemolishState = false;
        function updateInventoryButtonState() {
          const active = (typeof isDemolishModeEnabled !== 'undefined' && isDemolishModeEnabled);
          if (active !== lastDemolishState) {
            lastDemolishState = active;
            const normalContent = document.getElementById("inventoryToggleNormalContent");
            const demolishContent = document.getElementById("inventoryToggleDemolishContent");
            
            if (active) {
              invToggleEl.classList.add("demolish-active");
              invToggleEl.title = "ปิดโหมดรื้อถอน (Demolish Mode Active - Click to Close)";
              if (normalContent) normalContent.style.display = "none";
              if (demolishContent) demolishContent.style.display = "flex";
            } else {
              invToggleEl.classList.remove("demolish-active");
              invToggleEl.title = "เปิดกระเป๋า (Inventory)";
              if (normalContent) normalContent.style.display = "flex";
              if (demolishContent) demolishContent.style.display = "none";
            }
          }
        }
        
        function runDemolishMonitor() {
          updateInventoryButtonState();
          requestAnimationFrame(runDemolishMonitor);
        }
        requestAnimationFrame(runDemolishMonitor);
      }
      const invCloseEl = document.getElementById("inventoryClose");
      if (invCloseEl) {
        invCloseEl?.addEventListener("click", toggleInventory);
      }

      let distanceDisplayEnabled = false;
      const distanceToggle = document.getElementById("distanceToggle");
      if (distanceToggle) {
        distanceToggle?.addEventListener("click", () => {
          distanceDisplayEnabled = !distanceDisplayEnabled;
          distanceToggle.textContent = `ระยะทาง: ${distanceDisplayEnabled ? "เปิด" : "ปิด"}`;
          distanceToggle.classList.toggle("active", distanceDisplayEnabled);
          const distanceInfo = document.getElementById("distanceInfo");
          if (distanceInfo) {
            distanceInfo.style.display = distanceDisplayEnabled ? "block" : "none";
          }
        });
      }

      let quitHoldTimer = null;
      let quitHoldProgress = 0;
      let quitHoldInterval = null;
      const quitGameBtn = document.getElementById("quitGameBtn");
      if (typeof isAndroidProfile !== "undefined" && isAndroidProfile && quitGameBtn) {
        quitGameBtn.style.display = "none";
      }
      const quitGameProgress = document.getElementById("quitGameProgress");

      function startQuitHold(e) {
        if (e) e.preventDefault();
        quitHoldProgress = 0;
        quitGameProgress.style.transition = "none";
        quitGameProgress.style.width = "0%";

        clearInterval(quitHoldInterval);
        quitHoldInterval = setInterval(() => {
          quitHoldProgress += 5;
          quitGameProgress.style.width = quitHoldProgress + "%";
          if (quitHoldProgress >= 100) {
            clearInterval(quitHoldInterval);
            if (window.__TAURI__) {
              let closed = false;
              // 1. Try webviewWindow.getCurrentWebviewWindow().close() (Tauri v2 standard)
              try {
                if (window.__TAURI__.webviewWindow && window.__TAURI__.webviewWindow.getCurrentWebviewWindow) {
                  window.__TAURI__.webviewWindow.getCurrentWebviewWindow().close();
                  closed = true;
                }
              } catch (err) {
                console.error("Failed to close via getCurrentWebviewWindow", err);
              }

              // 2. Try window.getCurrentWindow().close() (Tauri v1 / v2 alternative)
              if (!closed) {
                try {
                  if (window.__TAURI__.window && window.__TAURI__.window.getCurrentWindow) {
                    window.__TAURI__.window.getCurrentWindow().close();
                    closed = true;
                  }
                } catch (err) {
                  console.error("Failed to close via getCurrentWindow", err);
                }
              }

              // 3. Try direct IPC invoke of close command
              if (!closed) {
                try {
                  if (window.__TAURI__.core && window.__TAURI__.core.invoke) {
                    window.__TAURI__.core.invoke("plugin:window|close");
                    closed = true;
                  }
                } catch (err) {
                  console.error("Failed to invoke plugin:window|close", err);
                }
              }

              // 4. Try direct IPC invoke of process exit command
              if (!closed) {
                try {
                  if (window.__TAURI__.core && window.__TAURI__.core.invoke) {
                    window.__TAURI__.core.invoke("plugin:process|exit", { code: 0 });
                    closed = true;
                  }
                } catch (err) {
                  console.error("Failed to invoke plugin:process|exit", err);
                }
              }

              // Fallback if inside a normal browser window
              if (!closed) {
                window.close();
            }
          } else {
              window.close();
            }
          }
        }, 30);
      }

      function cancelQuitHold(e) {
        clearInterval(quitHoldInterval);
        quitHoldProgress = 0;
        quitGameProgress.style.transition = "width 0.2s";
        quitGameProgress.style.width = "0%";
      }

      if (quitGameBtn) {
        quitGameBtn?.addEventListener("mousedown", startQuitHold);
        quitGameBtn?.addEventListener("touchstart", startQuitHold, {
          passive: false,
        });
        quitGameBtn?.addEventListener("contextmenu", (e) => e.preventDefault());
        quitGameBtn?.addEventListener("mouseup", cancelQuitHold);
        quitGameBtn?.addEventListener("mouseleave", cancelQuitHold);
        quitGameBtn?.addEventListener("touchend", cancelQuitHold);
        quitGameBtn?.addEventListener("touchcancel", cancelQuitHold);
      }
      document
        .getElementById("inventoryOverlay")
        .addEventListener("click", (e) => {
          if (e.target === e.currentTarget) {
            toggleInventory();
          }
        });

      
      document.getElementById("tabCooking")?.addEventListener("click", () => {
        activeTab = "cooking";
        document.getElementById("tabInventory").classList.remove("active");
        document.getElementById("tabItemsList").classList.remove("active");
        document.getElementById("tabSettings").classList.remove("active");
        document.getElementById("tabCrafting").classList.remove("active");
        document.getElementById("tabCooking").classList.add("active");
        document.getElementById("inventoryGrid").style.display = "none";
        document.getElementById("inventorySettings").style.display = "none";
        document.getElementById("craftingList").style.display = "none";
        document.getElementById("cookingList").style.display = "flex";
        
        const mainLayout = document.getElementById("inventoryMainLayout");
        if (mainLayout) mainLayout.style.display = "none";
        const divider = document.getElementById("inventoryVerticalDivider");
        if (divider) divider.style.display = "none";
        const actionSlotsWrapper = document.getElementById("inventoryActionSlotsWrapper");
        if (actionSlotsWrapper) actionSlotsWrapper.style.display = "none";
        renderCooking();
      });

      document.getElementById("tabInventory")?.addEventListener("click", () => {

        activeTab = "inventory";
        document.getElementById("tabInventory").classList.add("active");
        document.getElementById("tabCrafting").classList.remove("active");
        document.getElementById("tabItemsList").classList.remove("active");
        document.getElementById("tabSettings").classList.remove("active");
        
        document.getElementById("tabCooking").classList.remove("active");
          document.getElementById("tabCooking").style.display = "none";
        document.getElementById("cookingList").style.display = "none";

        document.getElementById("inventoryGrid").style.display = "grid";
        document.getElementById("inventorySettings").style.display = "none";
        document.getElementById("craftingList").style.display = "none";
        
        const mainLayout = document.getElementById("inventoryMainLayout");
        if (mainLayout) {
          mainLayout.style.display = "flex";
          mainLayout.style.maxWidth = "520px";
        }
        const divider = document.getElementById("inventoryVerticalDivider");
        if (divider) divider.style.display = "block";
        const actionSlotsWrapper = document.getElementById("inventoryActionSlotsWrapper");
        if (actionSlotsWrapper) actionSlotsWrapper.style.display = "flex";
        renderInventory();
        setTimeout(updateActionSlotsPosition, 0);
      });

      document.getElementById("tabCrafting")?.addEventListener("click", () => {
        activeTab = "crafting";
        document.getElementById("tabCrafting").classList.add("active");
        document.getElementById("tabInventory").classList.remove("active");
        document.getElementById("tabItemsList").classList.remove("active");
        document.getElementById("tabSettings").classList.remove("active");
        document.getElementById("inventoryGrid").style.display = "none";
        document.getElementById("inventorySettings").style.display = "none";
        
        document.getElementById("tabCooking").classList.remove("active");
          document.getElementById("tabCooking").style.display = "none";
        document.getElementById("cookingList").style.display = "none";

        document.getElementById("craftingList").style.display = "flex";
        
        const mainLayout = document.getElementById("inventoryMainLayout");
        if (mainLayout) mainLayout.style.display = "none";
        const divider = document.getElementById("inventoryVerticalDivider");
        if (divider) divider.style.display = "none";
        const actionSlotsWrapper = document.getElementById("inventoryActionSlotsWrapper");
        if (actionSlotsWrapper) actionSlotsWrapper.style.display = "none";
        renderCrafting();
        setTimeout(updateActionSlotsPosition, 0);
      });

      document.getElementById("tabItemsList")?.addEventListener("click", () => {
        activeTab = "itemsList";
        document.getElementById("tabItemsList").classList.add("active");
        document.getElementById("tabInventory").classList.remove("active");
        document.getElementById("tabCrafting").classList.remove("active");
        document.getElementById("tabSettings").classList.remove("active");
        
        document.getElementById("tabCooking").classList.remove("active");
          document.getElementById("tabCooking").style.display = "none";
        document.getElementById("cookingList").style.display = "none";

        document.getElementById("inventoryGrid").style.display = "grid";
        document.getElementById("inventorySettings").style.display = "none";
        document.getElementById("craftingList").style.display = "none";
        
        const mainLayout = document.getElementById("inventoryMainLayout");
        if (mainLayout) {
          mainLayout.style.display = "flex";
          mainLayout.style.maxWidth = "450px"; // Perfectly proportional to the 5-column item grid when no actions are shown
        }
        const divider = document.getElementById("inventoryVerticalDivider");
        if (divider) divider.style.display = "none";
        const actionSlotsWrapper = document.getElementById("inventoryActionSlotsWrapper");
        if (actionSlotsWrapper) actionSlotsWrapper.style.display = "none";
        renderInventory();
        setTimeout(updateActionSlotsPosition, 0);
      });

      document.getElementById("tabSettings")?.addEventListener("click", () => {
        activeTab = "settings";
        document.getElementById("tabSettings").classList.add("active");
        document.getElementById("tabInventory").classList.remove("active");
        document.getElementById("tabCrafting").classList.remove("active");
        document.getElementById("tabItemsList").classList.remove("active");
        document.getElementById("inventoryGrid").style.display = "none";
        
        document.getElementById("tabCooking").classList.remove("active");
          document.getElementById("tabCooking").style.display = "none";
        document.getElementById("cookingList").style.display = "none";

        document.getElementById("inventorySettings").style.display = "flex";
        document.getElementById("craftingList").style.display = "none";
        
        const mainLayout = document.getElementById("inventoryMainLayout");
        if (mainLayout) mainLayout.style.display = "none";
        const divider = document.getElementById("inventoryVerticalDivider");
        if (divider) divider.style.display = "none";
        const actionSlotsWrapper = document.getElementById("inventoryActionSlotsWrapper");
        if (actionSlotsWrapper) actionSlotsWrapper.style.display = "none";
        syncInventorySettingsUI();
        renderInventory();
        setTimeout(updateActionSlotsPosition, 0);
      });

      // Tauri Window Helper supporting both Tauri v1 and v2
      function getTauriWindow() {
        if (!window.__TAURI__) return null;
        if (window.__TAURI__.webviewWindow && window.__TAURI__.webviewWindow.getCurrentWebviewWindow) {
          return window.__TAURI__.webviewWindow.getCurrentWebviewWindow();
        }
        if (window.__TAURI__.window && window.__TAURI__.window.getCurrentWindow) {
          return window.__TAURI__.window.getCurrentWindow();
        }
        return null;
      }

      // Screen Mode selection
      function enterFullscreen() {
        const tWindow = getTauriWindow();
        if (tWindow && typeof tWindow.setFullscreen === "function") {
          tWindow.setFullscreen(true).then(() => {
            setTimeout(syncScreenModeUI, 100);
          }).catch((err) => console.error("Tauri setFullscreen true failed", err));
          return;
        }
        const docEl = document.documentElement;
        const requestFullScreen =
          docEl.requestFullscreen ||
          docEl.mozRequestFullScreen ||
          docEl.webkitRequestFullScreen ||
          docEl.msRequestFullscreen;
        if (requestFullScreen) {
          try {
            const res = requestFullScreen.call(docEl);
            if (res && typeof res.then === "function") {
              res.then(() => {
                if (navigator.keyboard && navigator.keyboard.lock) {
                  navigator.keyboard
                    .lock(["Escape"])
                    .catch((e) => console.log("Keyboard lock failed", e));
                }
              })
              .catch((err) => {
                console.warn("Fullscreen request failed safely:", err);
              });
            }
          } catch (err) {
            console.warn("enterFullscreen failed safely:", err);
          }
        }
      }

      function exitFullscreen() {
        const tWindow = getTauriWindow();
        if (tWindow && typeof tWindow.setFullscreen === "function") {
          tWindow.setFullscreen(false).then(() => {
            setTimeout(syncScreenModeUI, 100);
          }).catch((err) => console.error("Tauri setFullscreen false failed", err));
          return;
        }
        const doc = document;
        const cancelFullScreen =
          doc.exitFullscreen ||
          doc.mozCancelFullScreen ||
          doc.webkitExitFullscreen ||
          doc.msExitFullscreen;
        if (cancelFullScreen) {
          const isFull = !!(
            doc.fullscreenElement ||
            doc.mozFullScreenElement ||
            doc.webkitFullscreenElement ||
            doc.msFullscreenElement
          );
          if (isFull) {
            try {
              const res = cancelFullScreen.call(doc);
              if (res && typeof res.catch === "function") {
                res.catch((err) => {
                  console.warn("exitFullscreen promise rejected safely:", err);
                });
              }
            } catch (err) {
              console.warn("exitFullscreen failed safely:", err);
            }
          }
        }
      }

      document
        .getElementById("setModeFullscreen")
        .addEventListener("click", () => {
          initAudio();
          enterFullscreen();
        });

      document
        .getElementById("setModeWindowed")
        .addEventListener("click", () => {
          initAudio();
          exitFullscreen();
        });

      window.syncScreenModeUI = async function() {
        const screenModeContainer = document.getElementById("screenModeSettingContainer");
        if (screenModeContainer) {
            if (typeof showScreenModeUI !== 'undefined') {
                screenModeContainer.style.display = showScreenModeUI ? "flex" : "none";
            } else {
                screenModeContainer.style.display = "flex";
            }
        }

        let isFullscreen = !!(
          document.fullscreenElement ||
          document.mozFullScreenElement ||
          document.webkitFullscreenElement ||
          document.msFullscreenElement
        );

        const tWindow = getTauriWindow();
        if (tWindow && typeof tWindow.isFullscreen === "function") {
          try {
            isFullscreen = await tWindow.isFullscreen();
          } catch (e) {
            console.warn("Tauri isFullscreen check failed", e);
          }
        }

        const btnWindowed = document.getElementById("setModeWindowed");
        const btnFullscreen = document.getElementById("setModeFullscreen");

        if (isFullscreen) {
          if (btnFullscreen) {
            btnFullscreen.style.background = "rgba(223,183,108,0.15)";
            btnFullscreen.style.borderColor = "#dfb76c";
            btnFullscreen.style.color = "#dfb76c";
            btnFullscreen.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";
          }
          if (btnWindowed) {
            btnWindowed.style.background = "rgba(255,255,255,0.05)";
            btnWindowed.style.borderColor = "rgba(255,255,255,0.2)";
            btnWindowed.style.color = "rgba(255,255,255,0.6)";
            btnWindowed.style.textShadow = "none";
            }
          } else {
          if (btnWindowed) {
            btnWindowed.style.background = "rgba(223,183,108,0.15)";
            btnWindowed.style.borderColor = "#dfb76c";
            btnWindowed.style.color = "#dfb76c";
            btnWindowed.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";
          }
          if (btnFullscreen) {
            btnFullscreen.style.background = "rgba(255,255,255,0.05)";
            btnFullscreen.style.borderColor = "rgba(255,255,255,0.2)";
            btnFullscreen.style.color = "rgba(255,255,255,0.6)";
            btnFullscreen.style.textShadow = "none";
          }
        }
        isCurrentFullscreen = isFullscreen;
        if (typeof saveSettingsToLocalStorage === "function") {
          saveSettingsToLocalStorage();
        }
      }

      document.addEventListener("fullscreenchange", syncScreenModeUI);
      document.addEventListener("webkitfullscreenchange", syncScreenModeUI);
      document.addEventListener("mozfullscreenchange", syncScreenModeUI);
      document.addEventListener("MSFullscreenChange", syncScreenModeUI);

      window.updateFpsLimitUI = function() {
        const btn30 = document.getElementById("fps30Btn");
        const btn60 = document.getElementById("fps60Btn");
        const btn120 = document.getElementById("fps120Btn");

        const setActive = (btn) => {
          if (!btn) return;
          btn.style.background = "rgba(223, 183, 108, 0.15)";
          btn.style.borderColor = "#dfb76c";
          btn.style.color = "#dfb76c";
          btn.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";
        };

        const setInactive = (btn) => {
          if (!btn) return;
          btn.style.background = "rgba(255, 255, 255, 0.05)";
          btn.style.borderColor = "rgba(255, 255, 255, 0.2)";
          btn.style.color = "rgba(255, 255, 255, 0.6)";
          btn.style.textShadow = "none";
        };

        if (targetFps === 30) {
          setActive(btn30);
          setInactive(btn60);
          setInactive(btn120);
        } else if (targetFps === 60) {
          setInactive(btn30);
          setActive(btn60);
          setInactive(btn120);
        } else {
          setInactive(btn30);
          setInactive(btn60);
          setActive(btn120);
        }
      }

      if (document.getElementById("fps30Btn")) {
          document.getElementById("fps30Btn")?.addEventListener("click", () => {
            targetFps = 30;
            frameTime = 1000 / targetFps;
            updateFpsLimitUI();
            if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
          });
      }

      if (document.getElementById("fps60Btn")) {
          document.getElementById("fps60Btn")?.addEventListener("click", () => {
            targetFps = 60;
            frameTime = 1000 / targetFps;
            updateFpsLimitUI();
            if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
          });
      }

      if (document.getElementById("fps120Btn")) {
          document.getElementById("fps120Btn")?.addEventListener("click", () => {
            targetFps = 120;
            frameTime = 1000 / targetFps;
            updateFpsLimitUI();
            if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
          });
      }
      // FPS Display Toggle
      window.updateFpsToggleUI = function() {
        const btnOn = document.getElementById("fpsToggleOn");
        const btnOff = document.getElementById("fpsToggleOff");
        const fpsCounter = document.getElementById("fpsCounter");

        if (showFps) {
          if (fpsCounter) fpsCounter.style.display = "flex";
          if (btnOn) {
            btnOn.style.background = "rgba(223,183,108,0.15)";
            btnOn.style.borderColor = "#dfb76c";
            btnOn.style.color = "#dfb76c";
            btnOn.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";
          }
          if (btnOff) {
            btnOff.style.background = "rgba(255,255,255,0.05)";
            btnOff.style.borderColor = "rgba(255,255,255,0.2)";
            btnOff.style.color = "rgba(255,255,255,0.6)";
            btnOff.style.textShadow = "none";
            }
          } else {
          if (fpsCounter) fpsCounter.style.display = "none";
          if (btnOff) {
            btnOff.style.background = "rgba(223,183,108,0.15)";
            btnOff.style.borderColor = "#dfb76c";
            btnOff.style.color = "#dfb76c";
            btnOff.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";
          }
          if (btnOn) {
            btnOn.style.background = "rgba(255,255,255,0.05)";
            btnOn.style.borderColor = "rgba(255,255,255,0.2)";
            btnOn.style.color = "rgba(255,255,255,0.6)";
            btnOn.style.textShadow = "none";
          }
        }
      }

      document.getElementById("fpsToggleOn")?.addEventListener("click", () => {
        showFps = true;
        updateFpsToggleUI();
        if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
      });

      document.getElementById("fpsToggleOff")?.addEventListener("click", () => {
        showFps = false;
        updateFpsToggleUI();
        if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
      });

      // Shadow Map Toggle UI
      window.updateShadowMapUI = function() {
        const slider = document.getElementById("shadowMapQualitySlider");
        const valLabel = document.getElementById("shadowMapQualityVal");
        if (slider && valLabel) {
          slider.value = shadowMapQuality;
          const labels = ["Off", "Low", "Medium", "High", "Ultra"];
          valLabel.textContent = labels[shadowMapQuality] || "Medium";
        }
      }

      // Anti-Aliasing Toggle UI
      window.updateAntialiasUI = function() {
        const btnOn = document.getElementById("antialiasToggleOn");
        const btnOff = document.getElementById("antialiasToggleOff");

        if (antialiasEnabled) {
          if (btnOn) {
            btnOn.style.background = "rgba(223,183,108,0.15)";
            btnOn.style.borderColor = "#dfb76c";
            btnOn.style.color = "#dfb76c";
            btnOn.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";
          }
          if (btnOff) {
            btnOff.style.background = "rgba(255,255,255,0.05)";
            btnOff.style.borderColor = "rgba(255,255,255,0.2)";
            btnOff.style.color = "rgba(255,255,255,0.6)";
            btnOff.style.textShadow = "none";
          }
        } else {
          if (btnOff) {
            btnOff.style.background = "rgba(223,183,108,0.15)";
            btnOff.style.borderColor = "#dfb76c";
            btnOff.style.color = "#dfb76c";
            btnOff.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";
          }
          if (btnOn) {
            btnOn.style.background = "rgba(255,255,255,0.05)";
            btnOn.style.borderColor = "rgba(255,255,255,0.2)";
            btnOn.style.color = "rgba(255,255,255,0.6)";
            btnOn.style.textShadow = "none";
          }
        }
      }

      if (document.getElementById("shadowMapQualitySlider")) {
        document.getElementById("shadowMapQualitySlider")?.addEventListener("input", (e) => {
          const val = parseInt(e.target.value);
          shadowMapQuality = val;
          shadowMapEnabled = true;
          updateShadowMapUI();
          if (typeof window.resizeShadowMap === 'function') window.resizeShadowMap();
          if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
        });
      }

      function showNoticeLocal(msg) {
        if (typeof showNotice === 'function') {
          showNotice(msg);
        } else {
          const toast = document.createElement("div");
          toast.style.position = "fixed";
          toast.style.bottom = "120px";
          toast.style.left = "50%";
          toast.style.transform = "translateX(-50%)";
          toast.style.background = "rgba(15, 15, 20, 0.95)";
          toast.style.color = "#dfb76c";
          toast.style.border = "1px solid #dfb76c";
          toast.style.padding = "12px 24px";
          toast.style.borderRadius = "8px";
          toast.style.fontFamily = "'JetBrains Mono', monospace";
          toast.style.fontSize = "13px";
          toast.style.zIndex = "999999";
          toast.style.pointerEvents = "none";
          toast.style.boxShadow = "0 8px 32px rgba(0,0,0,0.8)";
          toast.style.transition = "opacity 0.3s";
          toast.textContent = msg;
          document.body.appendChild(toast);
          setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 300);
          }, 2500);
        }
      }

      let pendingAntialiasValue = null;
      let antialiasHoldInterval = null;
      let antialiasHoldProgress = 0;

      function openAntialiasConfirm(targetValue) {
        window.isConfirmOverlayOpen = true; if (window.clearKeysPressed) window.clearKeysPressed();
        pendingAntialiasValue = targetValue;
        const overlay = document.getElementById("antialiasConfirmOverlay");
        if (overlay) {
          const invPanel = document.querySelector("#inventoryOverlay .inventory-panel");
          if (invPanel) {
            invPanel.style.overflow = "hidden";
          }
          overlay.style.setProperty("display", "flex", "important");
        }
        clearInterval(antialiasHoldInterval);
        antialiasHoldProgress = 0;
        const progressEl = document.getElementById("antialiasConfirmProgress");
        if (progressEl) {
          progressEl.style.transition = "none";
          progressEl.style.width = "0%";
        }
      }

      function closeAntialiasConfirm() {
        window.isConfirmOverlayOpen = false;
        pendingAntialiasValue = null;
        const overlay = document.getElementById("antialiasConfirmOverlay");
        if (overlay) overlay.style.setProperty("display", "none", "important");
        const invPanel = document.querySelector("#inventoryOverlay .inventory-panel");
        if (invPanel) {
          invPanel.style.overflow = "";
        }
        clearInterval(antialiasHoldInterval);
        antialiasHoldProgress = 0;
        const progressEl = document.getElementById("antialiasConfirmProgress");
        if (progressEl) {
          progressEl.style.transition = "none";
          progressEl.style.width = "0%";
        }
      }

      if (document.getElementById("antialiasCancelBtn")) {
        document.getElementById("antialiasCancelBtn")?.addEventListener("click", closeAntialiasConfirm);
      }

      const antialiasConfirmBtn = document.getElementById("antialiasConfirmBtn");
      if (antialiasConfirmBtn) {
        function executeAntialiasChange() {
          if (pendingAntialiasValue !== null) {
            antialiasEnabled = pendingAntialiasValue;
            updateAntialiasUI();
            if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
            
            const msg = antialiasEnabled 
              ? "เปิดระบบลดรอยหยักแล้ว! กำลังรีโหลดหน้าจอ..." 
              : "ปิดระบบลดรอยหยักแล้ว! กำลังรีโหลดหน้าจอ...";
            
            showNoticeLocal(msg);
            closeAntialiasConfirm();
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        }

        antialiasConfirmBtn?.addEventListener("click", executeAntialiasChange);
      }

      if (document.getElementById("antialiasToggleOn")) {
        document.getElementById("antialiasToggleOn")?.addEventListener("click", () => {
          if (antialiasEnabled === true) return; // ทำงานเฉพาะเวลาต้องการเปลี่ยนค่า
          openAntialiasConfirm(true);
        });
      }

      if (document.getElementById("antialiasToggleOff")) {
        document.getElementById("antialiasToggleOff")?.addEventListener("click", () => {
          if (antialiasEnabled === false) return; // ทำงานเฉพาะเวลาต้องการเปลี่ยนค่า
          openAntialiasConfirm(false);
        });
      }


      // ฟังก์ชันระบบเต็มจอแบบครอบคลุมรอบด้าน
      function toggleFullscreen() {
        const tWindow = getTauriWindow();
        if (tWindow && typeof tWindow.isFullscreen === "function" && typeof tWindow.setFullscreen === "function") {
          tWindow.isFullscreen()
            .then((isFull) => {
              tWindow.setFullscreen(!isFull).then(() => {
                setTimeout(syncScreenModeUI, 100);
              });
            })
            .catch((err) => {
              console.warn("Tauri Fullscreen error:", err);
            });
          return;
        }

        const doc = window.document;
        const docEl = doc.documentElement;

        const requestFullScreen =
          docEl.requestFullscreen ||
          docEl.mozRequestFullScreen ||
          docEl.webkitRequestFullScreen ||
          docEl.msRequestFullscreen;
        const cancelFullScreen =
          doc.exitFullscreen ||
          doc.mozCancelFullScreen ||
          doc.webkitExitFullscreen ||
          doc.msExitFullscreen;

        if (
          !doc.fullscreenElement &&
          !doc.mozFullScreenElement &&
          !doc.webkitFullscreenElement &&
          !doc.msFullscreenElement
        ) {
          if (requestFullScreen) {
            try {
              const res = requestFullScreen.call(docEl);
              if (res && typeof res.then === "function") {
                res.then(() => {
                  if (navigator.keyboard && navigator.keyboard.lock) {
                    navigator.keyboard
                      .lock(["Escape"])
                      .catch((e) => console.log("Keyboard lock failed", e));
                  }
                })
                .catch((err) => {
                  console.warn("Fullscreen request failed safely:", err);
                });
              }
            } catch (err) {
              console.warn("Fullscreen request error caught:", err);
            }
          }
          } else {
          if (cancelFullScreen) {
            cancelFullScreen.call(doc);
          }
        }
      }

      const fullscreenBtn = document.getElementById("fullscreenBtn");
      if (fullscreenBtn) {
        fullscreenBtn?.addEventListener("click", () => {
          initAudio();
          toggleFullscreen();
        });
      }


      function updateDemolishBanner() {
        let banner = document.getElementById("demolishModeBanner");
        if (banner) {
          banner.style.display = "none";
          banner.remove();
        }
      }

      function updateTerrainModBanner() {
        let prompt = document.getElementById("interactPrompt");
        if (prompt && !isTerrainModModeEnabled) {
          prompt.style.display = "none";
        }
      }

      canvas?.addEventListener("mousedown", (e) => {
        initAudio();
        const isPointerLocked = document.pointerLockElement === canvas;
        if (!isPointerLocked && gameStarted && e.button === 0) {
          requestPointerLockSafe();
        }
        if ((e.button === 0 || e.button === 2) && isPointerLocked) {
          const isAltAction = (e.button === 2);
          if (e.button === 0) {
              isActionDown = true;
          }
          const holdingShovelOrPickaxe = (selectedActionSlotIndex !== -1 && actionSlotsItems[selectedActionSlotIndex] && (actionSlotsItems[selectedActionSlotIndex].name === "SHOVEL" || actionSlotsItems[selectedActionSlotIndex].name === "PICKAXE"));
          
          if (holdingShovelOrPickaxe) {
            if (!isUsingItem || (activeItem && activeItem.name === "BOW" && arrowShotInCurrentAnim && useAnimTimer <= (bowHoldArmTimer - bowSpamClickDelay))) {
              const item = actionSlotsItems[selectedActionSlotIndex];
              useItem(item, selectedActionSlotIndex, "action", isAltAction);
            }
          } else if (isTerrainModModeEnabled) {
            if (!isAltAction) {
              modTerrainAtPlayer(-0.35, true);
            } else {
              modTerrainAtPlayer(0.35, true);
            }
          } else if (isDemolishModeEnabled) {
            if (!isAltAction) {
                // Trigger demolition logic on click!
                const demolishableTypes = ["wood_floor", "thin_wood_floor", "stone_floor", "wood_stairs", "campfire", "wood_boat", "wood_wall", "wood_window", "wood_door", "wood_chest", "meganeura_item"];
                let closestDemolishItem = null;
                let bestT = Infinity;
                for (let item of collectibles) {
                  if (!item.active || item.isPreview || !item.position) continue;
                  if (item.type === "planet_core") continue;
                  if (demolishableTypes.includes(item.type)) {
                    const reachInfo = isTargetWithinReach(item.position, Math.max(actionReachDistance, 0.15 * (playerScale / 0.1)));
                    if (reachInfo.valid) {
                      if (reachInfo.t < bestT) {
                        bestT = reachInfo.t;
                        closestDemolishItem = item;
                      }
                    }
                  }
                }
                if (closestDemolishItem) {
                  if (closestDemolishItem.type !== "stone_floor") {
                    tryDemolishItem(closestDemolishItem);
                  }
                }
            }
          } else if (isPlacingFloor) {
            if (!isAltAction) placeFloor();
          } else if (!isUsingItem || (activeItem && activeItem.name === "BOW" && arrowShotInCurrentAnim && useAnimTimer <= (bowHoldArmTimer - bowSpamClickDelay))) {
             if (selectedActionSlotIndex !== -1 && actionSlotsItems[selectedActionSlotIndex]) {
               const item = actionSlotsItems[selectedActionSlotIndex];
               if (isAltAction && item.name !== "SHOVEL" && item.name !== "PICKAXE") {
                   // Do nothing for other items on right click for now
               } else {
                   useItem(item, selectedActionSlotIndex, "action", isAltAction);
               }
             } else if (isAltAction) {
               // Empty hand right click: do nothing (terrain modification disabled)
             } else if (!isAltAction) {
               performSmashAction();
               smashInterval = setInterval(performSmashAction, 600);
             }
          }
        }
        isDragging = true;
        if (typeof getInteractiveTarget === "function" && getInteractiveTarget(e.target)) {
          window.isCameraDragging = false;
        } else {
          window.isCameraDragging = true;
        }
        if (typeof window.updateVirtualCursorVisibility === "function") {
          window.updateVirtualCursorVisibility();
        }
        prevX = e.clientX;
        prevY = e.clientY;
      });

      window.addEventListener("mousemove", (e) => {
        const isPointerLocked = document.pointerLockElement === canvas;
        const isCursorHidden = !!window.isVirtualCursorManualHidden;

        let dx = 0;
        let dy = 0;

        if (isPointerLocked) {
          dx = e.movementX || 0;
          dy = e.movementY || 0;
        } else {
          dx = (typeof prevX !== "undefined") ? (e.clientX - prevX) : 0;
          dy = (typeof prevY !== "undefined") ? (e.clientY - prevY) : 0;
          prevX = e.clientX;
          prevY = e.clientY;
        }

        // Only rotate camera when mouse cursor is hidden (Alt toggle)
        if (!isCursorHidden) return;

        if (typeof isUIOpen === "function" && isUIOpen()) return;

        if (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") {
          const isAimingLockedBow = isUsingItem && activeItem && activeItem.name === "BOW" && activeTargetNPC;
          if (!isAimingLockedBow) {
            rotationY -= dx * 0.007 * mouseSensitivity;
            rotationX += dy * 0.007 * mouseSensitivity;
            rotationX = Math.max(-0.55, Math.min(1.2, rotationX));
          }
        } else {
          rotationY += dx * 0.01 * mouseSensitivity;
          rotationX += dy * 0.01 * mouseSensitivity;
          rotationX = Math.max(
            -Math.PI / 2.2,
            Math.min(Math.PI / 2.2, rotationX),
          );
        }
      });

      window.addEventListener("mouseup", (e) => {
        if (e.button === 0) {
          isActionDown = false;
          if (smashInterval) {
            clearInterval(smashInterval);
            smashInterval = null;
            // Ensure state resets
            isUsingItem = false;
            isSmashing = false;
            activeItem = originalItem;
          }
        }
        isDragging = false;
        window.isCameraDragging = false;
        if (typeof window.updateVirtualCursorVisibility === "function") {
          window.updateVirtualCursorVisibility();
        }
      });


      // ============================================
      // Slots Touch Virtual Buttons Simulation (Q, E, R-Click, L-Click)
      // ============================================

      function setupTouchButton(btnId, downFn, upFn) {
        const btn = document.getElementById(btnId);
        if (!btn) return;

        let isPressed = false;

        const handleDown = (e) => {
          if (window.isConfirmOverlayOpen) return;
          initAudio();
          e.preventDefault();
          if (isPressed) return;
          isPressed = true;
          btn.classList.add("active");
          downFn();
        };

        const handleUp = (e) => {
          if (window.isConfirmOverlayOpen) return;
          e.preventDefault();
          if (!isPressed) return;
          isPressed = false;
          btn.classList.remove("active");
          upFn();
        };

        btn?.addEventListener("touchstart", handleDown, { passive: false });
        btn?.addEventListener("touchend", handleUp, { passive: false });
        btn?.addEventListener("touchcancel", handleUp, { passive: false });

        btn?.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          handleDown(e);
        });
        
        const mouseUpWindow = (e) => {
          if (isPressed) {
            handleUp(e);
          }
        };
        window.addEventListener("mouseup", mouseUpWindow);
        btn?.addEventListener("mouseleave", handleUp);
      }

      // 1. Q Button (Rotate / Swim Up in water)
      let activeCodeQ = null;
      setupTouchButton(
        "btnTouchQ",
        () => {
          const inWater = (typeof currentSwimFactor !== 'undefined' && currentSwimFactor > 0.0);
          activeCodeQ = inWater ? "ShiftLeft" : "KeyQ";
          window.dispatchEvent(new KeyboardEvent("keydown", { code: activeCodeQ, bubbles: true }));
        },
        () => {
          const codeToRelease = activeCodeQ || "KeyQ";
          window.dispatchEvent(new KeyboardEvent("keyup", { code: codeToRelease, bubbles: true }));
          activeCodeQ = null;
        }
      );

      // 2. E Button (Interact / Dive Down in water)
      let activeCodeE = null;
      setupTouchButton(
        "btnTouchE",
        () => {
          const prompt = document.getElementById("interactPrompt");
          const npcPrompt = document.getElementById("npcKillPrompt");
          const isTerrainMod = (typeof isTerrainModModeEnabled !== 'undefined' && isTerrainModModeEnabled);
          const isDemolish = (typeof isDemolishModeEnabled !== 'undefined' && isDemolishModeEnabled);
          const hasActionReach = !!(
            (prompt && prompt.style.display === "block" && !isTerrainMod && !isDemolish) || 
            (npcPrompt && npcPrompt.style.display === "block")
          );

          const inWater = (typeof currentSwimFactor !== 'undefined' && currentSwimFactor > 0.0);
          activeCodeE = (inWater && !hasActionReach) ? "KeyZ" : "KeyE";
          window.dispatchEvent(new KeyboardEvent("keydown", { code: activeCodeE, bubbles: true }));
        },
        () => {
          const codeToRelease = activeCodeE || "KeyE";
          window.dispatchEvent(new KeyboardEvent("keyup", { code: codeToRelease, bubbles: true }));
          activeCodeE = null;
        }
      );

      // 3. Right Click Button (Alt Action / Dig / Fill)
      setupTouchButton(
        "btnTouchRightClick",
        () => {
          simulatedPointerLock = true;
          const e = new MouseEvent("mousedown", { button: 2, bubbles: true });
          e.simulated = true;
          canvas.dispatchEvent(e);
        },
        () => {
          const e = new MouseEvent("mouseup", { button: 2, bubbles: true });
          e.simulated = true;
          window.dispatchEvent(e);
          simulatedPointerLock = false;
        }
      );

      // 4. Left Click Button (Main Action / Smash)
      setupTouchButton(
        "btnTouchLeftClick",
        () => {
          simulatedPointerLock = true;
          const e = new MouseEvent("mousedown", { button: 0, bubbles: true });
          e.simulated = true;
          canvas.dispatchEvent(e);
        },
        () => {
          const e = new MouseEvent("mouseup", { button: 0, bubbles: true });
          e.simulated = true;
          window.dispatchEvent(e);
          simulatedPointerLock = false;
        }
      );

      // ============================================
      // Dynamic Swim State Monitoring for Touch Buttons (Q -> Shift, E -> Z)
      // ============================================
      let lastInWaterState = false;
      let lastHasActionReach = false;
      function updateTouchButtonsForWaterState() {
        const inWater = (typeof currentSwimFactor !== 'undefined' && currentSwimFactor > 0.0);
        const prompt = document.getElementById("interactPrompt");
        const npcPrompt = document.getElementById("npcKillPrompt");
        const isTerrainMod = (typeof isTerrainModModeEnabled !== 'undefined' && isTerrainModModeEnabled);
        const isDemolish = (typeof isDemolishModeEnabled !== 'undefined' && isDemolishModeEnabled);
        const hasActionReach = !!(
          (prompt && prompt.style.display === "block" && !isTerrainMod && !isDemolish) || 
          (npcPrompt && npcPrompt.style.display === "block")
        );

        if (inWater !== lastInWaterState || hasActionReach !== lastHasActionReach) {
          lastInWaterState = inWater;
          lastHasActionReach = hasActionReach;
          const btnQKey = document.querySelector("#btnTouchQ .touch-btn-key");
          const btnQLabel = document.querySelector("#btnTouchQ .touch-btn-label");
          const btnEKey = document.querySelector("#btnTouchE .touch-btn-key");
          const btnELabel = document.querySelector("#btnTouchE .touch-btn-label");
          const btnQIcon = document.getElementById("btnTouchQIcon");
          const btnEIcon = document.getElementById("btnTouchEIcon");

          if (inWater) {
            if (btnQKey) btnQKey.textContent = "Shift";
            if (btnQLabel) btnQLabel.textContent = "ว่ายขึ้น/Up";
            if (btnQIcon) {
              btnQIcon.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"></line>
                  <polyline points="5 12 12 5 19 12"></polyline>
                </svg>
              `;
            }
          } else {
            if (btnQKey) btnQKey.textContent = "Q";
            if (btnQLabel) btnQLabel.textContent = "หมุน/Rotate";
            if (btnQIcon) {
              btnQIcon.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
              `;
            }
          }

          if (inWater && !hasActionReach) {
            if (btnEKey) btnEKey.textContent = "Z";
            if (btnELabel) btnELabel.textContent = "ดำน้ำ/Down";
            if (btnEIcon) {
              btnEIcon.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <polyline points="19 12 12 19 5 12"></polyline>
                </svg>
              `;
            }
          } else {
            if (btnEKey) btnEKey.textContent = "E";
            if (btnELabel) btnELabel.textContent = "เก็บ/คุย";
            if (btnEIcon) {
              btnEIcon.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 11V3a2 2 0 1 1 4 0v8h1a2 2 0 0 1 2 2v2a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-2a2 2 0 0 1 2-2h1V7a2 2 0 1 1 4 0v4h2z"/>
                </svg>
              `;
            }
          }
        }
      }
      
      function runWaterStateMonitor() {
        updateTouchButtonsForWaterState();
        requestAnimationFrame(runWaterStateMonitor);
      }
      requestAnimationFrame(runWaterStateMonitor);


      // ============================================
      // UI Controls
      // ============================================
      const sizeInput = document.getElementById("sizeInput");
      const sizeDisplay = document.getElementById("sizeDisplay");
      const radiusInput = document.getElementById("radiusInput");
      const radiusDisplay = document.getElementById("radiusDisplay");
      const randomBtn = document.getElementById("randomBtn");
      const randomCubesBtn = document.getElementById("randomCubesBtn");
      const randomNatureBtn = document.getElementById("randomNatureBtn");
      const devInputModeToggle = document.getElementById("devInputModeToggle");
      const hitboxToggle = document.getElementById("hitboxToggle");
      const frustumCullingToggle = document.getElementById("frustumCullingToggle");
      const caveWaterToggle = document.getElementById("caveWaterToggle");
      const colliderDistSlider = document.getElementById("colliderDist");
      const uiMarginDistSlider = document.getElementById("uiMarginDist");
      const uiMarginLabel = document.getElementById("uiMarginLabel");
      const colliderDistLabel = document.getElementById("colliderDistLabel");
      const actionReachDistSlider = document.getElementById("actionReachDist");
      const actionReachLabel = document.getElementById("actionReachLabel");
      const actionReachToggle = document.getElementById("actionReachToggle");
      const actionReachModeSelect = document.getElementById("actionReachModeSelect");
      const bowHoldArmSlider = document.getElementById("bowHoldArmSlider");
      const bowHoldArmLabel = document.getElementById("bowHoldArmLabel");
      const bowSpamClickDelaySlider = document.getElementById("bowSpamClickDelaySlider");
      const bowSpamClickDelayLabel = document.getElementById("bowSpamClickDelayLabel");
      const bowLockDistanceSlider = document.getElementById("bowLockDistanceSlider");
      const bowLockDistanceLabel = document.getElementById("bowLockDistanceLabel");
      const woodFloorHeightSlider = document.getElementById("woodFloorHeightSlider");
      const woodFloorHeightLabel = document.getElementById("woodFloorHeightLabel");
      const campfireSizeSlider = document.getElementById("campfireSizeSlider");
      const campfireSizeLabel = document.getElementById("campfireSizeLabel");
      const voxelHoleRadiusSlider = document.getElementById("voxelHoleRadiusSlider");
      const voxelHoleRadiusLabel = document.getElementById("voxelHoleRadiusLabel");
      const waterToggle = document.getElementById("waterToggle");
      const waterLevelSlider = document.getElementById("waterLevel");
      const waterLevelLabel = document.getElementById("waterLevelLabel");
      const waterOpacitySlider = document.getElementById("waterOpacity");
      const waterOpacityLabel = document.getElementById("waterOpacityLabel");
      const waveStrengthSlider = document.getElementById("waveStrength");
      const waveStrengthLabel = document.getElementById("waveStrengthLabel");
      const waterColorPicker = document.getElementById("waterColor");

      const atmosphereToggle = document.getElementById("atmosphereToggle");
      const atmosphereAlphaSlider = document.getElementById("atmosphereAlpha");
      const atmosphereAlphaLabel = document.getElementById(
        "atmosphereAlphaLabel",
      );
      const atmosphereScaleSlider = document.getElementById("atmosphereScale");
      const atmosphereScaleLabel = document.getElementById(
        "atmosphereScaleLabel",
      );
      const atmosphereColorPicker = document.getElementById("atmosphereColor");

      const godRaysToggle = document.getElementById("godRaysToggle");
      const godRaysAlphaSlider = document.getElementById("godRaysAlpha");
      const godRaysAlphaLabel = document.getElementById("godRaysAlphaLabel");
      const godRaysCountSlider = document.getElementById("godRaysCount");
      const godRaysCountLabel = document.getElementById("godRaysCountLabel");
      const godRaysColorPicker = document.getElementById("godRaysColor");

      const skyToggle = document.getElementById("skyToggle");
      const skyGasIntensitySlider = document.getElementById("skyGasIntensity");
      const skyGasIntensityLabel = document.getElementById(
        "skyGasIntensityLabel",
      );

      const cloudsToggle = document.getElementById("cloudsToggle");
      const cloudsAlphaSlider = document.getElementById("cloudsAlpha");
      const cloudsAlphaLabel = document.getElementById("cloudsAlphaLabel");
      const cloudsHeightSlider = document.getElementById("cloudsHeight");
      const cloudsHeightLabel = document.getElementById("cloudsHeightLabel");
      const cloudsThicknessSlider = document.getElementById("cloudsThickness");
      const cloudsThicknessLabel = document.getElementById(
        "cloudsThicknessLabel",
      );
      const cloudsSpeedSlider = document.getElementById("cloudsSpeed");
      const cloudsSpeedLabel = document.getElementById("cloudsSpeedLabel");
      const cloudsShapeSlider = document.getElementById("cloudsShape");
      const cloudsShapeLabel = document.getElementById("cloudsShapeLabel");
      const cloudsColorPicker = document.getElementById("cloudsColor");

      const charSpeedSlider = document.getElementById("charSpeed");
      const charSpeedLabel = document.getElementById("charSpeedLabel");
      const charScaleSlider = document.getElementById("charScale");
      const charScaleLabel = document.getElementById("charScaleLabel");

      const leafSwaySlider = document.getElementById("leafSway");
      const leafSwayLabel = document.getElementById("leafSwayLabel");
      const waterSwaySlider = document.getElementById("waterSway");
      const waterSwayLabel = document.getElementById("waterSwayLabel");

      const renderDistToggle = document.getElementById("renderDistToggle");
      const renderDistSlider = document.getElementById("renderDist");
      const renderDistLabel = document.getElementById("renderDistLabel");

      const charFpsSlider = document.getElementById("charFps");
      const charFpsLabel = document.getElementById("charFpsLabel");
      const waterFpsSlider = document.getElementById("waterFps");
      const waterFpsLabel = document.getElementById("waterFpsLabel");
      const leafFpsSlider = document.getElementById("leafFps");
      const leafFpsLabel = document.getElementById("leafFpsLabel");
      const cloudFpsSlider = document.getElementById("cloudFps");
      const cloudFpsLabel = document.getElementById("cloudFpsLabel");

      const playerFootstepVolumeSlider = document.getElementById(
        "playerFootstepVolumeSlider",
      );
      const playerFootstepVolumeVal = document.getElementById(
        "playerFootstepVolumeVal",
      );
      const playerSwimVolumeSlider = document.getElementById(
        "playerSwimVolumeSlider",
      );
      const playerSwimVolumeVal = document.getElementById(
        "playerSwimVolumeVal",
      );
      const collectSfxVolumeSlider = document.getElementById(
        "collectSfxVolumeSlider",
      );
      const collectSfxVolumeVal = document.getElementById(
        "collectSfxVolumeVal",
      );
      const npcSfxVolumeSlider = document.getElementById("npcSfxVolumeSlider");
      const npcSfxVolumeVal = document.getElementById("npcSfxVolumeVal");

      function updatePlanet() {
        let val = parseInt(sizeInput.value);
        if (isNaN(val) || val < 25) val = 25;
        if (val > 3200) val = 3200;

        const warningEl = document.querySelector(".warning");
        if (val > 1000) {
          warningEl.textContent =
            "⚠️ ขนาดใหญ่มาก (" + val + "x" + val + ") อาจทำให้เครื่องช้าลง";
          warningEl.style.color = "#ff6600";
        } else if (val > 500) {
          warningEl.textContent =
            "⚠️ ขนาดใหญ่ (" + val + "x" + val + ") อาจทำให้เครื่องช้าลง";
          warningEl.style.color = "#ffaa00";
        } else {
          warningEl.textContent = "✅ ขนาดเหมาะสม";
          warningEl.style.color = "#66ff66";
        }

        sizeInput.value = val;
        sizeDisplay.textContent = val + " x " + val;
        currentGridSize = val;
        
        RADIUS = val / 50.0;
        if (radiusInput) radiusInput.value = RADIUS.toFixed(2);
        if (radiusDisplay) radiusDisplay.textContent = RADIUS.toFixed(2);

        buildPlanet(currentGridSize, globalSeed);
        console.log(
          "📐 ขนาด:",
          currentGridSize,
          "x",
          currentGridSize,
          "| RADIUS:",
          RADIUS.toFixed(2),
          "| seed:",
          globalSeed,
        );
      }

      sizeInput?.addEventListener("change", updatePlanet);

      sizeInput?.addEventListener("input", () => {
        let val = parseInt(sizeInput.value) || 25;
        if (val < 25) val = 25;
        if (val > 3200) val = 3200;
        sizeDisplay.textContent = val + " x " + val;
        
        let tempRadius = val / 50.0;
        if (radiusInput) radiusInput.value = tempRadius.toFixed(2);
        if (radiusDisplay) radiusDisplay.textContent = tempRadius.toFixed(2);

        const warningEl = document.querySelector(".warning");
        if (val > 500) {
          warningEl.textContent =
            "⚠️ ขนาดใหญ่มาก (" + val + "x" + val + ") อาจทำให้เครื่องช้าลง";
          warningEl.style.color = "#ff6600";
        } else if (val > 300) {
          warningEl.textContent =
            "⚠️ ขนาดใหญ่ (" + val + "x" + val + ") อาจทำให้เครื่องช้าลง";
          warningEl.style.color = "#ffaa00";
        } else {
          warningEl.textContent = "✅ ขนาดเหมาะสม";
          warningEl.style.color = "#66ff66";
        }
      });

      radiusInput?.addEventListener("input", () => {
        let val = parseFloat(radiusInput.value) || 1.0;
        radiusDisplay.textContent = val.toFixed(2);
        
        let gSize = Math.round(val * 50.0);
        gSize = Math.max(25, Math.min(3200, gSize));
        
        if (sizeInput) sizeInput.value = gSize;
        if (sizeDisplay) sizeDisplay.textContent = gSize + " x " + gSize;
      });

      radiusInput?.addEventListener("change", () => {
        let val = parseFloat(radiusInput.value) || 1.0;
        RADIUS = val;

        let gSize = Math.round(val * 50.0);
        currentGridSize = Math.max(25, Math.min(3200, gSize));
        
        if (sizeInput) sizeInput.value = currentGridSize;
        if (sizeDisplay) sizeDisplay.textContent = currentGridSize + " x " + currentGridSize;

        buildPlanet(currentGridSize, globalSeed);
        console.log("🌍 เปลี่ยนรัศมีดาวเป็น:", RADIUS, "| ขนาด Grid:", currentGridSize);
      });

      randomBtn?.addEventListener("click", () => {
        const val = parseInt(sizeInput.value) || 400;
        currentGridSize = Math.min(3200, Math.max(25, val));
        
        RADIUS = currentGridSize / 50.0;
        if (radiusInput) radiusInput.value = RADIUS.toFixed(2);
        if (radiusDisplay) radiusDisplay.textContent = RADIUS.toFixed(2);

        globalSeed = Math.floor(Math.random() * 100000);
        buildPlanet(currentGridSize, globalSeed);
        sizeDisplay.textContent = currentGridSize + " x " + currentGridSize;
        console.log(
          "🎲 สุ่มใหม่! seed:",
          globalSeed,
          "| ขนาด:",
          currentGridSize,
          "| RADIUS:",
          RADIUS.toFixed(2)
        );
        saveSettingsToLocalStorage();
      });

      randomCubesBtn?.addEventListener("click", () => {
        const count = 30 + Math.floor(Math.random() * 40);
        buildCubes(count, globalSeed);
        console.log("📦 สร้างวัตถุ", count, "ชิ้น");
      });

      randomNatureBtn?.addEventListener("click", async () => {
        const count = 50 + Math.floor(Math.random() * 51);
        await buildNature(count, globalSeed);
        console.log("🌲 สร้างวัตถุธรรมชาติ", count, "ชิ้น");
      });

      if (devInputModeToggle) {
        devInputModeToggle?.addEventListener("click", () => {
          if (devInputMode === "auto") {
            devInputMode = "touch";
            devInputModeToggle.classList.add("active");
            devInputModeToggle.textContent = "📱 โหมดอินพุต: จอสัมผัส (Touch)";
            showDpad();
          } else if (devInputMode === "touch") {
            devInputMode = "keyboard";
            devInputModeToggle.classList.add("active");
            devInputModeToggle.textContent = "⌨️ โหมดอินพุต: คีย์บอร์ด/เมาส์ (Keyboard/Mouse)";
            hideDpad();
          } else {
            devInputMode = "auto";
            devInputModeToggle.classList.remove("active");
            devInputModeToggle.textContent = "🎮 โหมดอินพุต: อัตโนมัติ (Auto)";
          }
          window.devInputMode = devInputMode;
          if (typeof window.updateVirtualCursorVisibility === "function") {
            window.updateVirtualCursorVisibility();
          }
        });
      }

      const screenModeVisibilityToggle = document.getElementById("screenModeVisibilityToggle");
      if (screenModeVisibilityToggle) {
        screenModeVisibilityToggle?.addEventListener("click", () => {
          if (typeof showScreenModeUI !== 'undefined') {
            showScreenModeUI = !showScreenModeUI;
            screenModeVisibilityToggle.textContent = showScreenModeUI ? "🖥️ โหมดแสดงผล (Screen Mode): แสดง" : "🖥️ โหมดแสดงผล (Screen Mode): ซ่อน";
            if (typeof window.syncScreenModeUI === 'function') {
              window.syncScreenModeUI();
            }
          }
        });
      }
      hitboxToggle?.addEventListener("click", () => {
        showHitboxes = !showHitboxes;
        hitboxToggle.textContent = showHitboxes ? "🟥 แสดงโครงสร้างการชน (Show Hitboxes) เปิด" : "🟥 แสดงโครงสร้างการชน (Show Hitboxes) ปิด";
        if (typeof buildHitboxes === "function") {
           buildHitboxes();
        }
      });

      frustumCullingToggle?.addEventListener("click", () => {
        frustumCullingEnabled = !frustumCullingEnabled;
        if (frustumCullingEnabled) {
          frustumCullingToggle.classList.add("active");
          frustumCullingToggle.textContent = "👁️ Frustum Culling (คัดออกวัตถุนอกจอ) เปิด";
        } else {
          frustumCullingToggle.classList.remove("active");
          frustumCullingToggle.textContent = "👁️ Frustum Culling (คัดออกวัตถุนอกจอ) ปิด";
        }
      });

      caveWaterToggle?.addEventListener("click", () => {
        caveWaterEnabled = !caveWaterEnabled;
        if (caveWaterEnabled) {
          caveWaterToggle.classList.add("active");
          caveWaterToggle.textContent = "💧 น้ำในถ้ำ (Cave Water) เปิด";
        } else {
          caveWaterToggle.classList.remove("active");
          caveWaterToggle.textContent = "💧 น้ำในถ้ำ (Cave Water) ปิด";
        }
        if (typeof saveSettingsToLocalStorage === "function") {
          saveSettingsToLocalStorage();
        }
      });

      if (uiMarginDistSlider) {
        uiMarginDistSlider.value = uiMargin;
        const updateUIMargins = () => {
          uiMargin = parseInt(uiMarginDistSlider.value);
          const margin = uiMargin;
          if (uiMarginLabel) uiMarginLabel.textContent = margin;
          const topLeftMenu = document.querySelector(".top-left-menu");
          const mainControls = document.querySelector(".controls");
          const joystickContainer = document.querySelector(".joystick-container");
          const actionSlots = document.querySelector(".action-slots");
          const toggleControlsBtn = document.getElementById("toggleControlsBtn");
          const devByNskLink = document.getElementById("devByNskLink");
          const compassContainer = document.getElementById("compassContainer");

          if (topLeftMenu) { topLeftMenu.style.top = margin + "px"; topLeftMenu.style.left = margin + "px"; }
          if (mainControls) { mainControls.style.top = (margin > 0 ? margin + 35 : 45) + "px"; mainControls.style.right = margin + "px"; }
          if (toggleControlsBtn) { toggleControlsBtn.style.top = margin + "px"; toggleControlsBtn.style.right = margin + "px"; }
          if (joystickContainer) { joystickContainer.style.bottom = margin + "px"; joystickContainer.style.left = margin + "px"; }
          if (actionSlots) { actionSlots.style.bottom = margin + "px"; actionSlots.style.right = margin + "px"; }
          if (devByNskLink) { devByNskLink.style.bottom = margin + "px"; devByNskLink.style.right = margin + "px"; }
          if (compassContainer) { compassContainer.style.top = (margin + 10) + "px"; }
        };

        uiMarginDistSlider?.addEventListener("input", () => {
          updateUIMargins();
        });
        updateUIMargins();
      }
      if (colliderDistSlider) {
        colliderDistSlider?.addEventListener("input", () => {
          maxColliderDistance = parseFloat(colliderDistSlider.value);
          if (colliderDistLabel) colliderDistLabel.textContent = maxColliderDistance.toFixed(2);
        });
      }

      if (actionReachDistSlider) {
        actionReachDistSlider?.addEventListener("input", () => {
          actionReachDistance = parseFloat(actionReachDistSlider.value);
          if (actionReachLabel) actionReachLabel.textContent = actionReachDistance.toFixed(2);
        });
      }

      if (actionReachToggle) {
        actionReachToggle?.addEventListener("click", () => {
          showActionReach = !showActionReach;
          actionReachToggle.textContent = showActionReach ? "⚪ แสดงวงระยะทำการ (Show Action Reach) เปิด" : "⚪ แสดงวงระยะทำการ (Show Action Reach) ปิด";
          actionReachToggle.classList.toggle("active", showActionReach);
        });
      }

      if (actionReachModeSelect) {
        actionReachModeSelect?.addEventListener("change", () => {
          actionReachMode = parseInt(actionReachModeSelect.value) || 3;
          console.log("📏 รูปแบบระยะทำการเปลี่ยนเป็น:", actionReachMode);
        });
      }

      if (bowHoldArmSlider) {
        bowHoldArmSlider?.addEventListener("input", () => {
          bowHoldArmTimer = parseFloat(bowHoldArmSlider.value);
          if (bowHoldArmLabel) bowHoldArmLabel.textContent = bowHoldArmTimer.toFixed(1);
        });
      }

      if (bowSpamClickDelaySlider) {
        bowSpamClickDelaySlider?.addEventListener("input", () => {
          bowSpamClickDelay = parseFloat(bowSpamClickDelaySlider.value);
          if (bowSpamClickDelayLabel) bowSpamClickDelayLabel.textContent = bowSpamClickDelay.toFixed(1);
        });
      }

      if (bowLockDistanceSlider) {
        bowLockDistanceSlider?.addEventListener("input", () => {
          bowLockDistance = parseFloat(bowLockDistanceSlider.value);
          if (bowLockDistanceLabel) bowLockDistanceLabel.textContent = bowLockDistance.toFixed(1);
        });
      }

      if (woodFloorHeightSlider) {
        woodFloorHeightSlider?.addEventListener("input", () => {
          woodFloorHeight = parseFloat(woodFloorHeightSlider.value);
          if (woodFloorHeightLabel) woodFloorHeightLabel.textContent = woodFloorHeight.toFixed(2);
          if (typeof refreshCollectiblesVBO === "function") {
            refreshCollectiblesVBO();
          }
        });
      }

      if (campfireSizeSlider) {
        campfireSizeSlider?.addEventListener("input", () => {
          campfireSize = parseFloat(campfireSizeSlider.value);
          if (campfireSizeLabel) campfireSizeLabel.textContent = campfireSize.toFixed(2);
          if (floorPreviewCollectible && floorPreviewCollectible.type === "campfire") {
            floorPreviewCollectible.size = campfireSize;
          }
          for (let item of collectibles) {
            if (item.active && item.type === "campfire" && !item.isPreview) {
              item.size = campfireSize;
            }
          }
          if (typeof refreshCollectiblesVBO === "function") {
            refreshCollectiblesVBO();
          }
        });
      }

      if (voxelHoleRadiusSlider) {
        voxelHoleRadiusSlider?.addEventListener("input", () => {
          voxelHoleRadiusMultiplier = parseFloat(voxelHoleRadiusSlider.value);
          voxelHoleRadiusLabel.textContent = voxelHoleRadiusMultiplier.toFixed(1);
        });
      }

      const devCameraZoomSlider = document.getElementById("devCameraZoomSlider");
      const devCameraZoomLabel = document.getElementById("devCameraZoomLabel");
      if (devCameraZoomSlider && devCameraZoomLabel) {
        devCameraZoomSlider?.addEventListener("input", () => {
          if (typeof zoom !== "undefined") {
            zoom = parseFloat(devCameraZoomSlider.value);
          }
          devCameraZoomLabel.textContent = parseFloat(devCameraZoomSlider.value).toFixed(1);
        });

        function syncZoomSlider() {
          if (typeof zoom !== "undefined") {
            if (document.activeElement !== devCameraZoomSlider) {
              devCameraZoomSlider.value = zoom;
              devCameraZoomLabel.textContent = zoom.toFixed(1);
            }
          }
          requestAnimationFrame(syncZoomSlider);
        }
        requestAnimationFrame(syncZoomSlider);
      }

      // === Drag to Scroll in Inventory Panel (for Touch Mode) ===
      function setupDragToScroll() {
        const panels = document.querySelectorAll(".inventory-panel");
        panels.forEach((panel) => {
          let isDown = false;
          let startY;
          let scrollTop;
          let velocityY = 0;
          let lastY = 0;
          let lastTime = 0;

          panel?.addEventListener("mousedown", (e) => {
            // Only allow drag scroll when not in strict keyboard mode (allow in touch or auto mode)
            if (typeof devInputMode !== "undefined" && devInputMode === "keyboard") return;

            // Stop any ongoing inertia scrolling
            velocityY = 0;

            // Check if the click target or its parent is an interactive element we want to ignore
            let target = e.target;
            let preventScroll = false;
            while (target && target !== panel) {
              if (
                target.tagName === "BUTTON" ||
                target.tagName === "INPUT" ||
                target.tagName === "SELECT" ||
                target.tagName === "TEXTAREA" ||
                target.getAttribute("draggable") === "true" ||
                target.classList.contains("inventory-slot") ||
                target.classList.contains("action-slot") ||
                target.classList.contains("key-bind-btn") ||
                target.closest(".inventory-slot") ||
                target.closest(".action-slot")
              ) {
                preventScroll = true;
                break;
              }
              target = target.parentElement;
            }

            if (preventScroll) return;

            isDown = true;
            panel.style.cursor = "grabbing";
            startY = e.pageY - panel.offsetTop;
            scrollTop = panel.scrollTop;
            lastY = e.pageY;
            lastTime = Date.now();
          });

          panel?.addEventListener("mouseleave", () => {
            if (isDown) {
              isDown = false;
              panel.style.cursor = "default";
              applyInertia();
            }
          });

          panel?.addEventListener("mouseup", () => {
            if (isDown) {
              isDown = false;
              panel.style.cursor = "default";
              applyInertia();
            }
          });

          panel?.addEventListener("mousemove", (e) => {
            if (!isDown) return;
            e.preventDefault();
            const y = e.pageY - panel.offsetTop;
            const walk = (y - startY) * 1.5; // speed factor
            panel.scrollTop = scrollTop - walk;

            // Calculate velocity for inertia
            const now = Date.now();
            const dt = now - lastTime;
            if (dt > 0) {
              velocityY = (e.pageY - lastY) / dt;
            }
            lastY = e.pageY;
            lastTime = now;
          });

          function applyInertia() {
            if (Math.abs(velocityY) < 0.1) return;
            function step() {
              if (isDown) return; // Stop inertia if clicked again
              panel.scrollTop -= velocityY * 16; // 16ms frame approx
              velocityY *= 0.95; // friction
              if (Math.abs(velocityY) > 0.1) {
                requestAnimationFrame(step);
              }
            }
            requestAnimationFrame(step);
          }
        });
      }
      setupDragToScroll();

      waterToggle?.addEventListener("click", () => {
        waterEnabled = !waterEnabled;
        waterToggle.textContent = waterEnabled ? "🌊 น้ำ เปิด" : "🌊 น้ำ ปิด";
        waterToggle.classList.toggle("active", waterEnabled);
        if (waterEnabled) {
          buildWaterSphere(currentGridSize);
        }
      });

      waterLevelSlider?.addEventListener("input", () => {
        waterLevel = parseInt(waterLevelSlider.value) / 10;
        waterLevelLabel.textContent = waterLevel.toFixed(2);
        if (waterEnabled) {
          buildWaterSphere(currentGridSize);
        }
      });

      waterOpacitySlider?.addEventListener("input", () => {
        waterOpacity = parseInt(waterOpacitySlider.value) / 100;
        waterOpacityLabel.textContent = waterOpacity.toFixed(2);
      });

      waveStrengthSlider?.addEventListener("input", () => {
        waveStrength = parseInt(waveStrengthSlider.value) / 200;
        waveStrengthLabel.textContent = waveStrength.toFixed(3);
      });

      waterColorPicker?.addEventListener("input", () => {
        const hex = waterColorPicker.value;
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        waterColor = [r, g, b];
      });

      charSpeedSlider?.addEventListener("input", () => {
        setPlayerSpeed(parseInt(charSpeedSlider.value) / 1000);
      });

      charScaleSlider?.addEventListener("input", () => {
        playerScale = parseInt(charScaleSlider.value) / 100;
        charScaleLabel.textContent = playerScale.toFixed(2);
        
        // Auto-adjust Action Reach distance based on playerScale (ratio is 1.5x)
        actionReachDistance = playerScale * 1.5;
        if (actionReachDistSlider) {
          actionReachDistSlider.value = actionReachDistance;
        }
        if (actionReachLabel) {
          actionReachLabel.textContent = actionReachDistance.toFixed(2);
        }
      });

      leafSwaySlider?.addEventListener("input", () => {
        natureSway = parseInt(leafSwaySlider.value) / 100;
        leafSwayLabel.textContent = natureSway.toFixed(2);
      });

      waterSwaySlider?.addEventListener("input", () => {
        waterPlantSway = parseInt(waterSwaySlider.value) / 100;
        waterSwayLabel.textContent = waterPlantSway.toFixed(2);
      });

      renderDistToggle?.addEventListener("click", () => {
        renderDistEnabled = !renderDistEnabled;
        renderDistToggle.textContent = renderDistEnabled
          ? "🛡️ จำกัดระยะเรนเดอร์: เปิด"
          : "🛡️ จำกัดระยะเรนเดอร์: ปิด";
        renderDistToggle.classList.toggle("active", renderDistEnabled);
      });

      renderDistSlider?.addEventListener("input", () => {
        renderDistValue = parseInt(renderDistSlider.value) / 10;
        renderDistLabel.textContent = renderDistValue.toFixed(2);
      });

      charFpsSlider?.addEventListener("input", () => {
        charAnimFps = parseInt(charFpsSlider.value);
        charFpsLabel.textContent = charAnimFps + " FPS";
      });

      waterFpsSlider?.addEventListener("input", () => {
        waterAnimFps = parseInt(waterFpsSlider.value);
        waterFpsLabel.textContent = waterAnimFps + " FPS";
      });

      leafFpsSlider?.addEventListener("input", () => {
        leafAnimFps = parseInt(leafFpsSlider.value);
        leafFpsLabel.textContent = leafAnimFps + " FPS";
      });

      cloudFpsSlider?.addEventListener("input", () => {
        cloudAnimFps = parseInt(cloudFpsSlider.value);
        cloudFpsLabel.textContent = cloudAnimFps + " FPS";
      });


      atmosphereToggle?.addEventListener("click", () => {
        atmosphereEnabled = !atmosphereEnabled;
        atmosphereToggle.textContent = atmosphereEnabled
          ? "✨ บรรยากาศ เปิด"
          : "✨ บรรยากาศ ปิด";
        atmosphereToggle.classList.toggle("active", atmosphereEnabled);
      });

      atmosphereAlphaSlider?.addEventListener("input", () => {
        atmosphereAlpha = parseInt(atmosphereAlphaSlider.value) / 100;
        atmosphereAlphaLabel.textContent = atmosphereAlpha.toFixed(2);
      });

      atmosphereScaleSlider?.addEventListener("input", () => {
        atmosphereScale = parseInt(atmosphereScaleSlider.value) / 100;
        atmosphereScaleLabel.textContent = atmosphereScale.toFixed(2);
        buildAtmosphereSphere(currentGridSize);
      });

      atmosphereColorPicker?.addEventListener("input", () => {
        const hex = atmosphereColorPicker.value;
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        atmosphereColor = [r, g, b];
      });

      godRaysToggle?.addEventListener("click", () => {
        godRaysEnabled = !godRaysEnabled;
        godRaysToggle.textContent = godRaysEnabled
          ? "☀️ ลำแสงเทวทูต (God Rays) เปิด"
          : "☀️ ลำแสงเทวทูต (God Rays) ปิด";
        godRaysToggle.classList.toggle("active", godRaysEnabled);
      });

      godRaysAlphaSlider?.addEventListener("input", () => {
        godRaysAlpha = parseInt(godRaysAlphaSlider.value) / 100;
        godRaysAlphaLabel.textContent = godRaysAlpha.toFixed(2);
      });

      godRaysCountSlider?.addEventListener("input", () => {
        godRaysCount = parseInt(godRaysCountSlider.value);
        godRaysCountLabel.textContent = godRaysCount;
      });

      godRaysColorPicker?.addEventListener("input", () => {
        const hex = godRaysColorPicker.value;
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        godRaysColor = [r, g, b];
      });

      skyToggle?.addEventListener("click", () => {
        skyEnabled = !skyEnabled;
        skyToggle.textContent = skyEnabled
          ? "🌌 ท้องฟ้าอวกาศ เปิด"
          : "🌌 ท้องฟ้าอวกาศ ปิด";
        skyToggle.classList.toggle("active", skyEnabled);
      });

      skyGasIntensitySlider?.addEventListener("input", () => {
        skyGasIntensity = parseInt(skyGasIntensitySlider.value) / 100;
        skyGasIntensityLabel.textContent = skyGasIntensity.toFixed(2);
      });

      cloudsToggle?.addEventListener("click", () => {
        cloudsEnabled = !cloudsEnabled;
        cloudsToggle.textContent = cloudsEnabled
          ? "☁️ เมฆกลุ่มก๊าซ เปิด"
          : "☁️ เมฆกลุ่มก๊าซ ปิด";
        cloudsToggle.classList.toggle("active", cloudsEnabled);
      });

      cloudsAlphaSlider?.addEventListener("input", () => {
        cloudsAlpha = parseInt(cloudsAlphaSlider.value) / 100;
        cloudsAlphaLabel.textContent = cloudsAlpha.toFixed(2);
      });

      cloudsHeightSlider?.addEventListener("input", () => {
        cloudsHeight = parseInt(cloudsHeightSlider.value) / 100;
        cloudsHeightLabel.textContent = cloudsHeight.toFixed(2);
        
        const devSlider = document.getElementById("devCloud3DDistanceSlider");
        const devLabel = document.getElementById("devCloud3DDistanceLabel");
        if (devSlider) devSlider.value = cloudsHeightSlider.value;
        if (devLabel) devLabel.textContent = cloudsHeight.toFixed(2);
        
        if (typeof window.rebuildClouds3D === "function") {
          window.rebuildClouds3D(cloudsHeight);
        }
      });

      cloudsThicknessSlider?.addEventListener("input", () => {
        cloudsThickness = parseInt(cloudsThicknessSlider.value) / 100;
        cloudsThicknessLabel.textContent = cloudsThickness.toFixed(2);
      });

      cloudsSpeedSlider?.addEventListener("input", () => {
        cloudsSpeed = parseInt(cloudsSpeedSlider.value) / 100;
        cloudsSpeedLabel.textContent = cloudsSpeed.toFixed(2);
      });

      cloudsShapeSlider?.addEventListener("input", () => {
        cloudsShape = parseInt(cloudsShapeSlider.value) / 100;
        cloudsShapeLabel.textContent = cloudsShape.toFixed(2);
      });

      cloudsColorPicker?.addEventListener("input", () => {
        const hex = cloudsColorPicker.value;
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        cloudsColor = [r, g, b];
      });


      // ============================================
      // Sync Helpers for Game and Inventory Settings
      // ============================================

      function setRagdoll(enabled) {
        ragdollEnabled = enabled;
        if (ragdollEnabled) {
          activeRidingBoat = null;
          activeRidingMech = null;
        }
        const toggle = document.getElementById("ragdollToggle");
        if (toggle) {
          if (ragdollEnabled) {
            toggle.textContent = "🦴 โหมด Ragdoll: เปิด";
            toggle.classList.add("active");
          } else {
            toggle.textContent = "🦴 โหมด Ragdoll: ปิด";
            toggle.classList.remove("active");
          }
        }
        const invToggle = document.getElementById("invRagdollToggle");
        if (invToggle) {
          invToggle.textContent = ragdollEnabled ? "เปิด" : "ปิด";
        }
      }

      function setPlayerSpeed(val) {
        playerSpeed = val;
        const speedInput = document.getElementById("charSpeed");
        const speedLabel = document.getElementById("charSpeedLabel");
        if (speedInput) speedInput.value = Math.round(playerSpeed * 1000);
        if (speedLabel) speedLabel.textContent = playerSpeed.toFixed(3);

        const invSpeedVal = document.getElementById("invCharSpeedVal");
        const invSpeedInput = document.getElementById("invCharSpeedSlider");
        if (invSpeedVal) invSpeedVal.textContent = playerSpeed.toFixed(3);
        if (invSpeedInput) invSpeedInput.value = Math.round(playerSpeed * 1000);
      }

      function setSFXMuted(muted) {
        sfxMuted = muted;
        const sfxBtn = document.getElementById("sfxMuteToggle");
        if (sfxBtn) {
          if (sfxMuted) {
            sfxBtn.innerHTML = `
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <line x1="23" y1="9" x2="17" y2="15"></line>
                            <line x1="17" y1="9" x2="23" y2="15"></line>
                        </svg>
                    `;
            sfxBtn.title = "เปิดเสียง (Unmute)";
          } else {
            sfxBtn.innerHTML = `
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dfb76c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    `;
            sfxBtn.title = "ปิดเสียง (Mute)";
          }
        }
      }

      // ============================================
      // ระบบควบคุมการว่ายน้ำและดำน้ำ
      // ============================================
      function updatePlayerSwimmingAndDiving(
        currentFeetRadius,
        wRadiusLocal,
        waterRadius,
        terrainRadius,
        charScale,
        rotationX,
        moveForwardInput
      ) {
        if (activeRidingBoat || activeRidingMech) {
          currentSwimFactor = 0.0;
        } else if (waterEnabled && currentFeetRadius < wRadiusLocal) {
          const depth = wRadiusLocal - currentFeetRadius;
          // Use hysteresis: if we were already swimming (lastSwimFactor > 0.01), we use a much lower threshold
          // (0.2 * charScale instead of 0.48 * charScale) to prevent oscillation when moving or bobbing.
          const swimThreshold = (lastSwimFactor > 0.01) ? 0.2 * charScale : 0.48 * charScale;
          if (depth > swimThreshold) {
            currentSwimFactor = Math.min(
              1.0,
              (depth - swimThreshold) / (0.15 * charScale),
            );
          } else {
            currentSwimFactor = 0.0;
          }
        } else {
          currentSwimFactor = 0.0;
        }

        // Initialize playerDiveDepth if transitioning to swimming to prevent sudden yanking/springing
        if (currentSwimFactor > 0.0 && lastSwimFactor === 0.0 && playerCenterRadius !== null) {
          const targetSwimRadius = waterRadius + (-0.22 + swimMovementFactor * 0.27) * charScale;
          const bottomRadius = terrainRadius + 0.46 * charScale;
          const maxDiveDepth = Math.max(0, targetSwimRadius - bottomRadius);
          playerDiveDepth = Math.max(0.0, Math.min(maxDiveDepth, targetSwimRadius - playerCenterRadius));
          isDivingMode = playerDiveDepth > 0.015 * charScale;
        }
        lastSwimFactor = currentSwimFactor;

        // Cancel BOW immediately if the player is swimming (with no auto-resume)
        if (currentSwimFactor > 0.0) {
          if (typeof activeItem !== "undefined" && activeItem && activeItem.name === "BOW") {
            useAnimTimer = 0;
            isUsingItem = false;
            activeItem = null;
          }
        }

        // Calculate diving depth
        let maxDiveDepth = 0;
        if (currentSwimFactor > 0.0) {
          const targetSwimRadius =
            waterRadius + (-0.22 + swimMovementFactor * 0.27) * charScale;
          const bottomRadius = terrainRadius + 0.46 * charScale;
          maxDiveDepth = Math.max(0, targetSwimRadius - bottomRadius);
        }

        // Update diving depth based on inputs (Camera pitch direction when moving, or manual Ctrl/Shift keys)
        if (currentSwimFactor > 0.0) {
          let targetDiveDepthChange = 0.0;
          const diveSpeed = 0.012 * charScale;

          // Dive or rise based on camera pitch (rotationX) and forward/backward movement
          // We separate surface swimming clearly from underwater diving.
          // Camera controls are ONLY active when already diving (isDivingMode is true).
          // On the surface, camera pitch is ignored, and diving can only be initiated manually.
          if (isDivingMode && moveForwardInput !== 0) {
            // Already diving / underwater: allow fully free, responsive camera-directed diving and rising.
            // Apply a tiny deadzone of 0.05 to avoid drifting when looking straight forward.
            if (Math.abs(rotationX) > 0.05) {
              targetDiveDepthChange += moveForwardInput * rotationX * diveSpeed * 1.5;
            }
          }

          // Keep manual keys as alternative/additional control
          if (keysPressed[currentKeyBindings.diveDown]) {
            targetDiveDepthChange += diveSpeed;
          } else if (
            keysPressed["Space"] ||
            keysPressed["ShiftRight"] ||
            keysPressed[currentKeyBindings.diveUp]
          ) {
            targetDiveDepthChange -= diveSpeed;
          }

          playerDiveDepth = Math.max(
            0.0,
            Math.min(maxDiveDepth, playerDiveDepth + targetDiveDepthChange),
          );
          
          // Separate states clearly
          if (playerDiveDepth > 0.015 * charScale) {
            isDivingMode = true;
          } else if (playerDiveDepth <= 0.005 * charScale) {
            playerDiveDepth = 0.0;
            isDivingMode = false;
          }
        } else {
          playerDiveDepth = 0.0;
          isDivingMode = false;
        }
      }

