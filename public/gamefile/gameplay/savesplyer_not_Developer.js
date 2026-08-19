// === SEEDPLANET MODULE: JS/SAVE.JS ===

      // ============================================
      // ระบบบันทึกและโหลดการตั้งค่า (Settings Save & Load System)
      // ============================================

      function rgbToHex(r, g, b) {
        const toHex = (c) => {
          const hex = Math.max(0, Math.min(255, Math.round(c * 255))).toString(
            16,
          );
          return hex.length === 1 ? "0" + hex : hex;
        };
        return "#" + toHex(r) + toHex(g) + toHex(b);
      }


      function saveSettingsToLocalStorage() {
        // ห้ามเซฟลง LocalStorage โดยเด็ดขาด หากอยู่ในโหมดผู้พัฒนา (isDevMode = true)
        // Dev mode will NEVER save any settings or state to avoid overwriting normal player progress!
        if (typeof isDevMode !== 'undefined' && isDevMode) {
          if (!window.hasShownDevSaveWarning) {
            console.log("⚠️ โหมดผู้พัฒนาเปิดอยู่: ปิดระบบการบันทึกข้อมูลทั้งหมด (Dev mode is active: all saving is disabled)");
            window.hasShownDevSaveWarning = true;
          }
          return;
        }

        try {
          const optionsConfig = {
            sfxVolume,
            playerFootstepVolume,
            playerSwimVolume,
            collectSfxVolume,
            npcSfxVolume,
            sfxMuted,
            keyBindings: currentKeyBindings,
            renderScale,
            mouseSensitivity,
            showFps,
            targetFps,
            shadowMapEnabled,
            shadowMapQuality,
            antialiasEnabled,
            taauEnabled,
            grassEnabled: window.globalGrassEnabled !== false,
            grassDensity: typeof window.globalGrassDensity === "number" ? window.globalGrassDensity : 1.0,
            cameraMode,
            cameraCollisionEnabled,
            zoomLimitEnabled,
            ragdollEnabled,
            fullscreen: isCurrentFullscreen
          };
          localStorage.setItem("seedplanet_options_config", JSON.stringify(optionsConfig));
        } catch (e) {
          console.error("Failed to save options to localStorage:", e);
        }

        try {
          const settings = {
            sfxVolume,
            playerFootstepVolume,
            playerSwimVolume,
            collectSfxVolume,
            npcSfxVolume,
            sfxMuted,
            keyBindings: currentKeyBindings,
            renderScale,
            mouseSensitivity,
            showFps,
            targetFps,
            shadowMapEnabled,
            shadowMapQuality,
            antialiasEnabled,
            taauEnabled,
            grassEnabled: window.globalGrassEnabled !== false,
            grassDensity: typeof window.globalGrassDensity === "number" ? window.globalGrassDensity : 1.0,
            cameraMode,
            cameraCollisionEnabled,
            zoomLimitEnabled,
            ragdollEnabled,
            fullscreen: isCurrentFullscreen,

            // Planet parameters
            currentGridSize,
            RADIUS,
            globalSeed,

            waterEnabled,
            caveWaterEnabled,
            waterLevel,
            waterOpacity,
            waveStrength,
            waterColor,

            atmosphereEnabled,
            atmosphereAlpha,
            atmosphereScale,
            atmosphereColor,

            godRaysEnabled,
            godRaysAlpha,
            godRaysCount,
            godRaysColor,

            skyEnabled,
            skyGasIntensity,

            cloudsEnabled,
            cloudsAlpha,
            cloudsHeight,
            cloudsThickness,
            cloudsSpeed,
            cloudsShape,
            cloudsColor,

            playerSpeed,
            playerScale,
            natureSway,
            waterPlantSway,
            renderDistEnabled,
            renderDistValue,
            terrainRenderDistValue: typeof terrainRenderDistValue !== "undefined" ? terrainRenderDistValue : renderDistValue,
            objectRenderDistValue: typeof objectRenderDistValue !== "undefined" ? objectRenderDistValue : renderDistValue,

            charAnimFps,
            waterAnimFps,
            leafAnimFps,
            cloudAnimFps,

            // Player State
            inventory,
            actionSlotsItems,
            charTheta,
            charPhi,
            collectedCount,
            choppedTrees,
            destroyedRocks,
            playerHP,
            playerMaxHP,
            collectiblesState: collectibles.filter(c => !c.isDynamic).map((c) => c.active),
            placedStructures: collectibles.filter(c => c.active && !c.isPreview && !c.isDynamic && (c.type === "wood_floor" || c.type === "thin_wood_floor" || c.type === "stone_floor" || c.type === "wood_stairs" || c.type === "campfire" || c.type === "wood_wall" || c.type === "wood_window" || c.type === "wood_door" || c.type === "wood_chest" || c.type === "meganeura_item" || c.type === "isopod_item" || c.type === "wood_boat" || c.type === "wood_wheel")),
            dynamicCollectibles: collectibles.filter(c => c.isDynamic),
            amphibiansState: amphibians.map((a) => ({
              theta: a.theta,
              phi: a.phi,
              heading: a.heading,
              animPhase: a.animPhase,
              ragdollEnabled: a.ragdollEnabled,
              ragdollInitialized: a.ragdollInitialized,
              ragdollAxis: a.ragdollAxis,
              ragdollAngle: a.ragdollAngle,
              ragdollAngularSpeed: a.ragdollAngularSpeed,
              isSwimming: a.isSwimming,
              seed: a.seed,
              hp: a.hp,
              maxHp: a.maxHp,
            })),
            tunnels3D: tunnels3D,
            voxelHoleRadiusMultiplier,
          };

          if (activeSaveSlotId && typeof gameStarted !== "undefined" && gameStarted) {
            localStorage.setItem(activeSaveSlotId, JSON.stringify(settings));
          }
          localStorage.setItem("seedplanet_settings", JSON.stringify(settings));
        } catch (e) {
          console.error("Failed to save settings to localStorage:", e);
        }
      }

      function applySettings(settings, applySystemSettings = true, rebuildPlanet = false) {
        if (!settings) return;

        if (applySystemSettings) {
          // System & Audio
          if (typeof settings.sfxVolume === "number")
            sfxVolume = settings.sfxVolume;
          if (typeof settings.playerFootstepVolume === "number")
            playerFootstepVolume = settings.playerFootstepVolume;
          if (typeof settings.playerSwimVolume === "number")
            playerSwimVolume = settings.playerSwimVolume;
          if (typeof settings.collectSfxVolume === "number")
            collectSfxVolume = settings.collectSfxVolume;
          if (typeof settings.npcSfxVolume === "number")
            npcSfxVolume = settings.npcSfxVolume;
          if (typeof settings.sfxMuted === "boolean")
            sfxMuted = settings.sfxMuted;
          if (settings.keyBindings) {
            currentKeyBindings = {
              ...currentKeyBindings,
              ...settings.keyBindings,
            };
            renderKeyBindingsUI();
            if (typeof renderActionSlots === "function") renderActionSlots();
          }
          if (typeof settings.renderScale === "number") {
            renderScale = settings.renderScale;
            if (typeof resizeCanvas === 'function') {
              resizeCanvas();
            }
          }
          if (typeof settings.mouseSensitivity === "number") {
            mouseSensitivity = settings.mouseSensitivity;
            const sensSlider = document.getElementById("mouseSensitivitySlider");
            const sensVal = document.getElementById("mouseSensitivityVal");
            if (sensSlider && sensVal) {
              sensSlider.value = Math.round(mouseSensitivity * 100);
              sensVal.textContent = mouseSensitivity.toFixed(2) + "x";
            }
          }
          if (typeof settings.showFps === "boolean") {
            showFps = settings.showFps;
            if (typeof updateFpsToggleUI === 'function') updateFpsToggleUI();
          }
          if (typeof settings.targetFps === "number") {
            targetFps = settings.targetFps;
            frameTime = 1000 / targetFps;
            if (typeof updateFpsLimitUI === 'function') updateFpsLimitUI();
          }
          if (typeof settings.shadowMapEnabled === "boolean") {
            shadowMapEnabled = settings.shadowMapEnabled;
            if (typeof updateShadowMapUI === 'function') updateShadowMapUI(); if(typeof window.resizeShadowMap === 'function') window.resizeShadowMap();
          }
          if (typeof settings.shadowMapQuality === "number") {
            shadowMapQuality = Math.max(1, settings.shadowMapQuality);
            shadowMapEnabled = true;
            if (typeof updateShadowMapUI === 'function') updateShadowMapUI(); if(typeof window.resizeShadowMap === 'function') window.resizeShadowMap();
          }
          if (typeof settings.antialiasEnabled === "boolean") {
            antialiasEnabled = settings.antialiasEnabled;
            if (typeof updateAntialiasUI === 'function') updateAntialiasUI();
          }
          if (typeof settings.taauEnabled === "boolean") {
            taauEnabled = settings.taauEnabled;
            if (typeof updateTaauUI === 'function') updateTaauUI();
          }
          if (typeof settings.grassEnabled === "boolean") {
            window.globalGrassEnabled = settings.grassEnabled;
            if (typeof updateGrassUIState === 'function') updateGrassUIState();
          }
          if (typeof settings.grassDensity === "number") {
            window.globalGrassDensity = settings.grassDensity;
            if (typeof updateGrassUIState === 'function') updateGrassUIState();
          }
          if (typeof settings.fullscreen === "boolean") {
            isCurrentFullscreen = settings.fullscreen;
            if (isCurrentFullscreen) {
              setTimeout(enterFullscreen, 300);
            } else {
              const doc = document;
              const isFull = !!(
                doc.fullscreenElement ||
                doc.mozFullScreenElement ||
                doc.webkitFullscreenElement ||
                doc.msFullscreenElement
              );
              if (isFull) {
                setTimeout(exitFullscreen, 300);
              }
            }
          }
        }

        // Camera / Character Modes
        if (typeof settings.cameraMode === "string") {
          cameraMode = settings.cameraMode;
          if (cameraMode !== "tps" && cameraMode !== "thirdperson" && cameraMode !== "fps" && cameraMode !== "planet" && cameraMode !== "sun" && cameraMode !== "satellite" && !(cameraMode && cameraMode.startsWith("extra_planet_"))) {
            cameraMode = "thirdperson";
          }
          if (typeof setCameraMode === "function") {
            setCameraMode(cameraMode);
          } else {
            const toggleBtn = document.getElementById("cameraFollowToggle");
            const previewBtn = document.getElementById("cameraPreviewToggle");
            const fpsBtn = document.getElementById("devCameraFpsToggle");
            if (toggleBtn && previewBtn) {
              toggleBtn.classList.remove("active");
              previewBtn.classList.remove("active");
              if (fpsBtn) fpsBtn.classList.remove("active");
              
              if (cameraMode === "tps") {
                toggleBtn.classList.add("active");
              } else if (cameraMode === "fps") {
                if (fpsBtn) fpsBtn.classList.add("active");
              } else {
                previewBtn.classList.add("active");
              }
            }
          }
        }
        if (typeof settings.cameraCollisionEnabled === "boolean") {
          cameraCollisionEnabled = settings.cameraCollisionEnabled;
          const toggleBtn = document.getElementById("cameraCollisionToggle");
          if (toggleBtn) {
            toggleBtn.textContent = cameraCollisionEnabled
              ? "🛡️ ระบบกันกล้องชนวัตถุ: เปิด"
              : "🛡️ ระบบกันกล้องชนวัตถุ: ปิด";
            toggleBtn.classList.toggle("active", cameraCollisionEnabled);
          }
        }
        if (typeof settings.zoomLimitEnabled === "boolean") {
          zoomLimitEnabled = settings.zoomLimitEnabled;
          const toggleBtn = document.getElementById("zoomLimitToggle");
          if (toggleBtn) {
            toggleBtn.textContent = zoomLimitEnabled
              ? "🔍 จำกัดระยะซูมออก: เปิด"
              : "🔍 จำกัดระยะซูมออก: ปิด";
            toggleBtn.classList.toggle("active", zoomLimitEnabled);
          }
        }
        if (typeof settings.ragdollEnabled === "boolean") {
          ragdollEnabled = settings.ragdollEnabled;
          const toggleBtn = document.getElementById("ragdollToggle");
          if (toggleBtn) {
            toggleBtn.textContent = ragdollEnabled
              ? "🦴 โหมด Ragdoll: เปิด"
              : "🦴 โหมด Ragdoll: ปิด";
            toggleBtn.classList.toggle("active", ragdollEnabled);
          }
        }

        // Planet parameters
        let loadedRadius = 32.0;
        if (typeof settings.radius === "number" && settings.radius >= 4.0) {
          loadedRadius = settings.radius;
        } else if (typeof settings.currentGridSize === "number") {
          loadedRadius = Math.max(8.0, settings.currentGridSize / 12.5);
        }
        
        if (typeof window.updatePlanetRadiusAndHeightScale === "function") {
          window.updatePlanetRadiusAndHeightScale(loadedRadius);
        } else {
          RADIUS = loadedRadius;
          HEIGHT_SCALE = 0.6 * Math.pow(loadedRadius / 8.0, 0.7);
          if (typeof window !== "undefined") {
            window.RADIUS = RADIUS;
            window.HEIGHT_SCALE = HEIGHT_SCALE;
          }
        }

        if (typeof settings.currentGridSize === "number") {
          currentGridSize = settings.currentGridSize;
        } else {
          currentGridSize = Math.max(100, Math.min(1600, Math.round(RADIUS * 12.5)));
        }

        const input = document.getElementById("sizeInput");
        const display = document.getElementById("sizeDisplay");
        if (input) input.value = currentGridSize;
        if (display)
          display.textContent = currentGridSize + " x " + currentGridSize;
        
        const rInput = document.getElementById("radiusInput");
        const rDisplay = document.getElementById("radiusDisplay");
        if (rInput) rInput.value = RADIUS.toFixed(2);
        if (rDisplay) rDisplay.textContent = RADIUS.toFixed(2);
        if (typeof updateRadiusButtonStates === "function") updateRadiusButtonStates();
        
        if (typeof settings.globalSeed === "number") {
          window.globalSeed = settings.globalSeed; globalSeed = window.globalSeed;
        }

        // Water
        if (typeof settings.waterEnabled === "boolean") {
          waterEnabled = settings.waterEnabled;
          const toggleBtn = document.getElementById("waterToggle");
          if (toggleBtn) {
            toggleBtn.textContent = waterEnabled ? "🌊 น้ำ เปิด" : "🌊 น้ำ ปิด";
            toggleBtn.classList.toggle("active", waterEnabled);
          }
        }
        if (typeof settings.caveWaterEnabled === "boolean") {
          caveWaterEnabled = settings.caveWaterEnabled;
          const toggleBtn = document.getElementById("caveWaterToggle");
          if (toggleBtn) {
            toggleBtn.textContent = caveWaterEnabled ? "💧 น้ำในถ้ำ (Cave Water) เปิด" : "💧 น้ำในถ้ำ (Cave Water) ปิด";
            toggleBtn.classList.toggle("active", caveWaterEnabled);
          }
        }
        if (typeof settings.waterLevel === "number") {
          waterLevel = settings.waterLevel;
          const input = document.getElementById("waterLevel");
          const label = document.getElementById("waterLevelLabel");
          if (input) input.value = Math.round(waterLevel * 10);
          if (label) label.textContent = waterLevel.toFixed(2);
        }
        if (typeof settings.waterOpacity === "number") {
          waterOpacity = settings.waterOpacity;
          const input = document.getElementById("waterOpacity");
          const label = document.getElementById("waterOpacityLabel");
          if (input) input.value = Math.round(waterOpacity * 100);
          if (label) label.textContent = waterOpacity.toFixed(2);
        }
        if (typeof settings.waveStrength === "number") {
          waveStrength = settings.waveStrength;
          const input = document.getElementById("waveStrength");
          const label = document.getElementById("waveStrengthLabel");
          if (input) input.value = Math.round(waveStrength * 200);
          if (label) label.textContent = waveStrength.toFixed(3);
        }
        if (Array.isArray(settings.waterColor)) {
          waterColor = settings.waterColor;
          const picker = document.getElementById("waterColor");
          if (picker)
            picker.value = rgbToHex(
              waterColor[0],
              waterColor[1],
              waterColor[2],
            );
        }

        // Atmosphere
        if (typeof settings.atmosphereEnabled === "boolean") {
          atmosphereEnabled = settings.atmosphereEnabled;
          const toggleBtn = document.getElementById("atmosphereToggle");
          if (toggleBtn) {
            toggleBtn.textContent = atmosphereEnabled
              ? "✨ บรรยากาศ เปิด"
              : "✨ บรรยากาศ ปิด";
            toggleBtn.classList.toggle("active", atmosphereEnabled);
          }
        }
        if (typeof settings.atmosphereAlpha === "number") {
          atmosphereAlpha = settings.atmosphereAlpha;
          const input = document.getElementById("atmosphereAlpha");
          const label = document.getElementById("atmosphereAlphaLabel");
          if (input) input.value = Math.round(atmosphereAlpha * 100);
          if (label) label.textContent = atmosphereAlpha.toFixed(2);
        }
        if (typeof settings.atmosphereScale === "number") {
          atmosphereScale = settings.atmosphereScale;
          const input = document.getElementById("atmosphereScale");
          const label = document.getElementById("atmosphereScaleLabel");
          if (input) input.value = Math.round(atmosphereScale * 100);
          if (label) label.textContent = atmosphereScale.toFixed(2);
        }
        if (Array.isArray(settings.atmosphereColor)) {
          atmosphereColor = settings.atmosphereColor;
          const picker = document.getElementById("atmosphereColor");
          if (picker)
            picker.value = rgbToHex(
              atmosphereColor[0],
              atmosphereColor[1],
              atmosphereColor[2],
            );
        }

        // God Rays
        if (typeof settings.godRaysEnabled === "boolean") {
          godRaysEnabled = settings.godRaysEnabled;
          const toggleBtn = document.getElementById("godRaysToggle");
          if (toggleBtn) {
            toggleBtn.textContent = godRaysEnabled
              ? "☀️ ลำแสงเทวทูต (God Rays) เปิด"
              : "☀️ ลำแสงเทวทูต (God Rays) ปิด";
            toggleBtn.classList.toggle("active", godRaysEnabled);
          }
        }
        if (typeof settings.godRaysAlpha === "number") {
          godRaysAlpha = settings.godRaysAlpha;
          const input = document.getElementById("godRaysAlpha");
          const label = document.getElementById("godRaysAlphaLabel");
          if (input) input.value = Math.round(godRaysAlpha * 100);
          if (label) label.textContent = godRaysAlpha.toFixed(2);
        }
        if (typeof settings.godRaysCount === "number") {
          godRaysCount = settings.godRaysCount;
          const input = document.getElementById("godRaysCount");
          const label = document.getElementById("godRaysCountLabel");
          if (input) input.value = godRaysCount;
          if (label) label.textContent = godRaysCount;
        }
        if (Array.isArray(settings.godRaysColor)) {
          godRaysColor = settings.godRaysColor;
          const picker = document.getElementById("godRaysColor");
          if (picker)
            picker.value = rgbToHex(
              godRaysColor[0],
              godRaysColor[1],
              godRaysColor[2],
            );
        }

        // Sky
        if (typeof settings.skyEnabled === "boolean") {
          skyEnabled = settings.skyEnabled;
          const toggleBtn = document.getElementById("skyToggle");
          if (toggleBtn) {
            toggleBtn.textContent = skyEnabled
              ? "🌌 ท้องฟ้าอวกาศ เปิด"
              : "🌌 ท้องฟ้าอวกาศ ปิด";
            toggleBtn.classList.toggle("active", skyEnabled);
          }
        }
        if (typeof settings.skyGasIntensity === "number") {
          skyGasIntensity = settings.skyGasIntensity;
          const input = document.getElementById("skyGasIntensity");
          const label = document.getElementById("skyGasIntensityLabel");
          if (input) input.value = Math.round(skyGasIntensity * 100);
          if (label) label.textContent = skyGasIntensity.toFixed(2);
        }

        // Clouds
        if (typeof settings.cloudsEnabled === "boolean") {
          cloudsEnabled = settings.cloudsEnabled;
          const toggleBtn = document.getElementById("cloudsToggle");
          if (toggleBtn) {
            toggleBtn.textContent = cloudsEnabled
              ? "☁️ เมฆกลุ่มก๊าซ เปิด"
              : "☁️ เมฆกลุ่มก๊าซ ปิด";
            toggleBtn.classList.toggle("active", cloudsEnabled);
          }
        }
        if (typeof settings.cloudsAlpha === "number") {
          cloudsAlpha = settings.cloudsAlpha;
          const input = document.getElementById("cloudsAlpha");
          const label = document.getElementById("cloudsAlphaLabel");
          if (input) input.value = Math.round(cloudsAlpha * 100);
          if (label) label.textContent = cloudsAlpha.toFixed(2);
        }
        if (typeof settings.cloudsHeight === "number") {
          cloudsHeight = settings.cloudsHeight;
          const input = document.getElementById("cloudsHeight");
          const label = document.getElementById("cloudsHeightLabel");
          if (input) input.value = Math.round(cloudsHeight * 100);
          if (label) label.textContent = cloudsHeight.toFixed(2);
        }
        if (typeof settings.cloudsThickness === "number") {
          cloudsThickness = settings.cloudsThickness;
          const input = document.getElementById("cloudsThickness");
          const label = document.getElementById("cloudsThicknessLabel");
          if (input) input.value = Math.round(cloudsThickness * 100);
          if (label) label.textContent = cloudsThickness.toFixed(2);
        }
        if (typeof settings.cloudsSpeed === "number") {
          cloudsSpeed = settings.cloudsSpeed;
          const input = document.getElementById("cloudsSpeed");
          const label = document.getElementById("cloudsSpeedLabel");
          if (input) input.value = Math.round(cloudsSpeed * 100);
          if (label) label.textContent = cloudsSpeed.toFixed(2);
        }
        if (typeof settings.cloudsShape === "number") {
          cloudsShape = settings.cloudsShape;
          const input = document.getElementById("cloudsShape");
          const label = document.getElementById("cloudsShapeLabel");
          if (input) input.value = Math.round(cloudsShape * 100);
          if (label) label.textContent = cloudsShape.toFixed(2);
        }
        if (Array.isArray(settings.cloudsColor)) {
          cloudsColor = settings.cloudsColor;
          const picker = document.getElementById("cloudsColor");
          if (picker)
            picker.value = rgbToHex(
              cloudsColor[0],
              cloudsColor[1],
              cloudsColor[2],
            );
        }

        // Player Speed/Scale
        if (typeof settings.playerSpeed === "number") {
          playerSpeed = settings.playerSpeed;
          const input = document.getElementById("charSpeed");
          const label = document.getElementById("charSpeedLabel");
          if (input) input.value = Math.round(playerSpeed * 1000);
          if (label) label.textContent = playerSpeed.toFixed(4);
        }
        if (typeof settings.playerScale === "number") {
          playerScale = settings.playerScale;
          const input = document.getElementById("charScale");
          const label = document.getElementById("charScaleLabel");
          if (input) input.value = Math.round(playerScale * 100);
          if (label) label.textContent = playerScale.toFixed(2);
          
          // Auto-adjust action reach distance based on loaded playerScale
          actionReachDistance = playerScale * 1.5;
          const reachInput = document.getElementById("actionReachDist");
          const reachLabel = document.getElementById("actionReachLabel");
          if (reachInput) reachInput.value = actionReachDistance;
          if (reachLabel) reachLabel.textContent = actionReachDistance.toFixed(2);
        }

        // Sway/Wind
        if (typeof settings.natureSway === "number") {
          natureSway = settings.natureSway;
          const input = document.getElementById("leafSway");
          const label = document.getElementById("leafSwayLabel");
          if (input) input.value = Math.round(natureSway * 100);
          if (label) label.textContent = natureSway.toFixed(2);
        }
        if (typeof settings.waterPlantSway === "number") {
          waterPlantSway = settings.waterPlantSway;
          const input = document.getElementById("waterSway");
          const label = document.getElementById("waterSwayLabel");
          if (input) input.value = Math.round(waterPlantSway * 100);
          if (label) label.textContent = waterPlantSway.toFixed(2);
        }

        // Render Distance
        if (typeof settings.renderDistEnabled === "boolean") {
          renderDistEnabled = settings.renderDistEnabled;
          if (typeof window !== "undefined") window.renderDistEnabled = renderDistEnabled;
          const toggleBtn = document.getElementById("renderDistToggle");
          if (toggleBtn) {
            toggleBtn.textContent = renderDistEnabled
              ? "🛡️ จำกัดระยะเรนเดอร์: เปิด"
              : "🛡️ จำกัดระยะเรนเดอร์: ปิด";
            toggleBtn.classList.toggle("active", renderDistEnabled);
          }
        }
        if (typeof settings.terrainRenderDistValue === "number") {
          terrainRenderDistValue = settings.terrainRenderDistValue;
          renderDistValue = terrainRenderDistValue;
          if (typeof window !== "undefined" && typeof window.setTerrainRenderDist === "function") {
            window.setTerrainRenderDist(terrainRenderDistValue);
          } else {
            const input = document.getElementById("terrainRenderDist") || document.getElementById("renderDist");
            const label = document.getElementById("terrainRenderDistLabel") || document.getElementById("renderDistLabel");
            if (input) input.value = Math.round(terrainRenderDistValue * 10);
            if (label) label.textContent = terrainRenderDistValue.toFixed(2);
          }
        } else if (typeof settings.renderDistValue === "number") {
          terrainRenderDistValue = settings.renderDistValue;
          renderDistValue = settings.renderDistValue;
          const input = document.getElementById("terrainRenderDist") || document.getElementById("renderDist");
          const label = document.getElementById("terrainRenderDistLabel") || document.getElementById("renderDistLabel");
          if (input) input.value = Math.round(renderDistValue * 10);
          if (label) label.textContent = renderDistValue.toFixed(2);
        }

        if (typeof settings.objectRenderDistValue === "number") {
          objectRenderDistValue = settings.objectRenderDistValue;
          if (typeof window !== "undefined" && typeof window.setObjectRenderDist === "function") {
            window.setObjectRenderDist(objectRenderDistValue);
          } else {
            const input = document.getElementById("objectRenderDist");
            const label = document.getElementById("objectRenderDistLabel");
            if (input) input.value = Math.round(objectRenderDistValue * 10);
            if (label) label.textContent = objectRenderDistValue.toFixed(2);
          }
        } else if (typeof settings.renderDistValue === "number") {
          objectRenderDistValue = settings.renderDistValue;
          const input = document.getElementById("objectRenderDist");
          const label = document.getElementById("objectRenderDistLabel");
          if (input) input.value = Math.round(objectRenderDistValue * 10);
          if (label) label.textContent = objectRenderDistValue.toFixed(2);
        }

        if (typeof settings.voxelHoleRadiusMultiplier === "number") {
          voxelHoleRadiusMultiplier = settings.voxelHoleRadiusMultiplier;
          // If the loaded setting is exactly 1.0 (the old default), upgrade it to 2.0 once to match the new default!
          if (voxelHoleRadiusMultiplier === 1.0) {
            voxelHoleRadiusMultiplier = 2.0;
          }
          const input = document.getElementById("voxelHoleRadiusSlider");
          const label = document.getElementById("voxelHoleRadiusLabel");
          if (input) input.value = voxelHoleRadiusMultiplier;
          if (label) label.textContent = voxelHoleRadiusMultiplier.toFixed(1);
        }

        // Animation FPS
        if (typeof settings.charAnimFps === "number") {
          charAnimFps = settings.charAnimFps;
          const input = document.getElementById("charFps");
          const label = document.getElementById("charFpsLabel");
          if (input) input.value = charAnimFps;
          if (label) label.textContent = charAnimFps + " FPS";
        }
        if (typeof settings.waterAnimFps === "number") {
          waterAnimFps = settings.waterAnimFps;
          const input = document.getElementById("waterFps");
          const label = document.getElementById("waterFpsLabel");
          if (input) input.value = waterAnimFps;
          if (label) label.textContent = waterAnimFps + " FPS";
        }
        if (typeof settings.leafAnimFps === "number") {
          leafAnimFps = settings.leafAnimFps;
          const input = document.getElementById("leafFps");
          const label = document.getElementById("leafFpsLabel");
          if (input) input.value = leafAnimFps;
          if (label) label.textContent = leafAnimFps + " FPS";
        }
        if (typeof settings.cloudAnimFps === "number") {
          cloudAnimFps = settings.cloudAnimFps;
          const input = document.getElementById("cloudFps");
          const label = document.getElementById("cloudFpsLabel");
          if (input) input.value = cloudAnimFps;
          if (label) label.textContent = cloudAnimFps + " FPS";
        }

        // Sync Inventory Settings tab UI inputs
        syncInventorySettingsUI();

        // Player state
        if (Array.isArray(settings.inventory)) {
          inventory = settings.inventory;
          while (inventory.length < TOTAL_SLOTS) {
            inventory.push(null);
          }
          if (typeof renderInventory === "function") renderInventory();
          if (typeof updateBadge === "function") updateBadge();
        }
        if (Array.isArray(settings.actionSlotsItems)) {
          actionSlotsItems = settings.actionSlotsItems;
          while (actionSlotsItems.length < 8) {
            actionSlotsItems.push(null);
          }
          if (typeof renderActionSlots === "function") renderActionSlots();
        }
        if (typeof settings.charTheta === "number")
          charTheta = settings.charTheta;
        if (typeof settings.charPhi === "number") charPhi = settings.charPhi;
        
        if (typeof settings.playerHP === "number") {
          playerHP = settings.playerHP;
          if (typeof updatePlayerHPUI === "function") updatePlayerHPUI();
        }
        if (typeof settings.playerMaxHP === "number") {
          playerMaxHP = settings.playerMaxHP;
        }
        if (settings.collectedCount) {
          collectedCount = { ...settings.collectedCount };
        }

        if (settings.choppedTrees !== undefined) {
          choppedTrees = settings.choppedTrees;
        }

        if (settings.destroyedRocks !== undefined) {
          destroyedRocks = settings.destroyedRocks;
        }

        if (settings.collectiblesState !== undefined) {
          savedCollectiblesState = settings.collectiblesState;
        }

        let dynamicCollectibles = settings.dynamicCollectibles;
        let placedStructures = settings.placedStructures;

        if (settings.amphibiansState !== undefined) {
          savedAmphibiansState = settings.amphibiansState;
        }

        if (Array.isArray(settings.tunnels3D)) {
          tunnels3D = settings.tunnels3D;
          tunnels3DGrid = null;
          keepLoadedTunnels = true;
          rebuildTunnelBuffers();
        }

        // Rebuild planet with settings
        if (gameStarted && rebuildPlanet === true) {
          buildPlanet(currentGridSize, globalSeed);
          if (waterEnabled) buildWaterSphere(currentGridSize);
          buildAtmosphereSphere(currentGridSize);
          
          if (Array.isArray(placedStructures) && placedStructures.length > 0) {
            placedStructures.forEach(p => {
              p.isPreview = false;
              if (p.type === "wood_boat") {
                  p.isDynamic = true;
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
          
          if (Array.isArray(dynamicCollectibles) && dynamicCollectibles.length > 0) {
            collectibles = collectibles.concat(dynamicCollectibles);
          }

          window.collectibles = collectibles;
          
          refreshCollectiblesVBO();
        }
      }

      const DEFAULT_SETTINGS = {
        sfxVolume: 0.5,
        playerFootstepVolume: 0.0,
        playerSwimVolume: 0.09,
        collectSfxVolume: 0.2,
        npcSfxVolume: 0.5,
        sfxMuted: false,
        keyBindings: {
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
        },
        renderScale: /Android/i.test(navigator.userAgent) ? 0.25 : 1.0,
        mouseSensitivity: 1,
        showFps: true,
        targetFps: /Android/i.test(navigator.userAgent) ? 30 : 120,
        shadowMapEnabled: true,
        shadowMapQuality: /Android/i.test(navigator.userAgent) ? 1 : 2,
        antialiasEnabled: false,
        taauEnabled: false,
        grassEnabled: true,
        grassDensity: 1.0,
        cameraMode: "tps",
        cameraCollisionEnabled: true,
        zoomLimitEnabled: true,
        ragdollEnabled: false,
        currentGridSize: 400,
        RADIUS: 8.0,
        globalSeed: 13585,
        waterEnabled: true,
        caveWaterEnabled: true,
        waterLevel: 0,
        waterOpacity: 0.4,
        waveStrength: 0.02,
        waterColor: [0, 0.4, 0.667],
        atmosphereEnabled: true,
        atmosphereAlpha: 0.6,
        atmosphereScale: 2.5,
        atmosphereColor: [0.3, 0.58, 1],
        skyEnabled: true,
        skyGasIntensity: 0.75,
        cloudsEnabled: true,
        cloudsAlpha: 0.55,
        cloudsHeight: 12.0,
        cloudsThickness: 0.93,
        cloudsSpeed: 0.2,
        cloudsShape: 1,
        cloudsColor: [1, 1, 1],
        godRaysEnabled: false,
        godRaysAlpha: 0.0,
        godRaysCount: 0,
        godRaysColor: [1.0, 0.92, 0.75],
        playerSpeed: 0.005,
        playerScale: 0.1,
        natureSway: 1,
        waterPlantSway: 1,
        renderDistEnabled: true,
        renderDistValue: 15.0,
        terrainRenderDistValue: 15.0,
        objectRenderDistValue: 5.0,
        charAnimFps: 30,
        waterAnimFps: 30,
        leafAnimFps: 30,
        cloudAnimFps: 30,
        voxelHoleRadiusMultiplier: 2.0, // ค่าเริ่มต้นขนาดหลุมสร้างอุโมงค์เมื่อเข้าเกมใหม่หรือโหมด Dev
      };

      async function tryLoadSettingsOnStartup() {
        try {
          let settingsObj = {};
          const saved = localStorage.getItem("seedplanet_settings");
          if (saved) {
            settingsObj = JSON.parse(saved);
            if (settingsObj) {
              if (settingsObj.RADIUS === 2.5 || settingsObj.RADIUS === 3.6 || settingsObj.RADIUS === 32.0) {
                settingsObj.RADIUS = 8.0;
              }
              if (settingsObj.currentGridSize === 180 || settingsObj.currentGridSize === 1600 || settingsObj.currentGridSize === 500) {
                settingsObj.currentGridSize = 400;
              }
            }
          } else {
            settingsObj = { ...DEFAULT_SETTINGS };
          }

          // โหลดเฉพาะตัวเลือกตั้งค่าระบบที่บันทึกแยกไว้มาทับ (เพื่อให้ตั้งค่าต่างๆ คงอยู่แม้จะปิด/เปิดใหม่ หรือเล่นใน Dev mode)
          const savedOptions = localStorage.getItem("seedplanet_options_config");
          if (savedOptions) {
            try {
              const parsedOptions = JSON.parse(savedOptions);
              if (parsedOptions) {
                settingsObj = {
                  ...settingsObj,
                  ...parsedOptions
                };
              }
            } catch (e) {
              console.error("Failed to parse seedplanet_options_config:", e);
            }
          }

          applySettings(settingsObj);
          return true;
        } catch (e) {
          console.error(
            "Failed to load settings from localStorage on startup:",
            e,
          );
        }
        return false;
      }

      // Hook saving to UI inputs
      function initSettingsAutoSaveHooks() {
        const inputIds = [
          "sfxVolumeSlider",
          "playerFootstepVolumeSlider",
          "playerSwimVolumeSlider",
          "collectSfxVolumeSlider",
          "npcSfxVolumeSlider",
          "renderScaleSlider",
          "mouseSensitivitySlider",
          "sizeInput",
          "radiusInput",
          "waterLevel",
          "waterOpacity",
          "waveStrength",
          "waterColor",
          "atmosphereAlpha",
          "atmosphereScale",
          "atmosphereColor",
          "skyGasIntensity",
          "cloudsAlpha",
          "cloudsHeight",
          "cloudsThickness",
          "cloudsSpeed",
          "cloudsShape",
          "cloudsColor",
          "charSpeed",
          "charScale",
          "leafSway",
          "waterSway",
          "renderDist",
          "terrainRenderDist",
          "objectRenderDist",
          "devTerrainRenderDistSlider",
          "devObjectRenderDistSlider",
          "charFps",
          "waterFps",
          "leafFps",
          "cloudFps",
        ];

        const clickIds = [
          "sfxMuteToggle",
          "setModeWindowed",
          "setModeFullscreen",
          "fpsToggleOn",
          "fpsToggleOff",
          "cameraFollowToggle",
          "cameraCollisionToggle",
          "zoomLimitToggle",
          "ragdollToggle",
          "waterToggle",
          "atmosphereToggle",
          "skyToggle",
          "cloudsToggle",
          "renderDistToggle",
        ];

        inputIds.forEach((id) => {
          const el = document.getElementById(id);
          if (el) {
            el?.addEventListener("change", saveSettingsToLocalStorage);
            el?.addEventListener("input", saveSettingsToLocalStorage);
          }
        });

        clickIds.forEach((id) => {
          const el = document.getElementById(id);
          if (el) {
            el?.addEventListener("click", () => {
              // Small timeout to let original click handler finish state changes
              setTimeout(saveSettingsToLocalStorage, 50);
            });
          }
        });
      }

      // Export settings to JSON file
      function exportSettingsToFile() {
        try {
          const settings = {
            sfxVolume,
            sfxMuted,
            renderScale,
            mouseSensitivity,
            showFps,
            targetFps,
            cameraMode,
            cameraCollisionEnabled,
            zoomLimitEnabled,
            ragdollEnabled,
            currentGridSize,
            RADIUS,
            globalSeed,
            waterEnabled,
            waterLevel,
            waterOpacity,
            waveStrength,
            waterColor,
            atmosphereEnabled,
            atmosphereAlpha,
            atmosphereScale,
            atmosphereColor,
            godRaysEnabled,
            godRaysAlpha,
            godRaysCount,
            godRaysColor,
            skyEnabled,
            skyGasIntensity,
            cloudsEnabled,
            cloudsAlpha,
            cloudsHeight,
            cloudsThickness,
            cloudsSpeed,
            cloudsShape,
            cloudsColor,
            playerSpeed,
            playerScale,
            natureSway,
            waterPlantSway,
            renderDistEnabled,
            renderDistValue,
            terrainRenderDistValue: typeof terrainRenderDistValue !== "undefined" ? terrainRenderDistValue : renderDistValue,
            objectRenderDistValue: typeof objectRenderDistValue !== "undefined" ? objectRenderDistValue : renderDistValue,
            charAnimFps,
            waterAnimFps,
            leafAnimFps,
            cloudAnimFps,
          };
          const dataStr =
            "data:text/json;charset=utf-8," +
            encodeURIComponent(JSON.stringify(settings, null, 4));
          const downloadAnchor = document.createElement("a");
          downloadAnchor.setAttribute("href", dataStr);
          downloadAnchor.setAttribute(
            "download",
            `seedplanet_settings_profile_${globalSeed}.json`,
          );
          document.body.appendChild(downloadAnchor);
          downloadAnchor.click();
          downloadAnchor.remove();
        } catch (e) {
          alert("เกิดข้อผิดพลาดในการส่งออกไฟล์: " + e.message);
        }
      }

      const SAVE_SLOTS = [
        { id: "seedplanet_save_1", label: "เซฟช่องที่ 1 (Save Slot 1)" },
        { id: "seedplanet_save_2", label: "เซฟช่องที่ 2 (Save Slot 2)" },
        { id: "seedplanet_save_3", label: "เซฟช่องที่ 3 (Save Slot 3)" },
        { id: "seedplanet_save_4", label: "เซฟช่องที่ 4 (Save Slot 4)" },
      ];

      function getSlotData(slotId) {
        try {
          const saved = localStorage.getItem(slotId);
          if (saved) {
            return JSON.parse(saved);
          }
        } catch (e) {
          console.error("Failed to parse save data for " + slotId, e);
        }
        return null;
      }

      let lastSaveSelectorOpenedTime = 0;

      function openSaveSelector() {
        lastSaveSelectorOpenedTime = Date.now();
        const selectOverlay = document.getElementById("saveSelectOverlay");
        if (selectOverlay) {
          selectOverlay.classList.add("open");
        }
        renderSaveSlots();
      }

      function closeSaveSelector() {
        const selectOverlay = document.getElementById("saveSelectOverlay");
        if (selectOverlay) {
          selectOverlay.classList.remove("open");
        }
      }

      function renderSaveSlots() {
        const listContainer = document.getElementById("saveSlotsList");
        if (!listContainer) return;

        let html = "";
        for (const slot of SAVE_SLOTS) {
          const data = getSlotData(slot.id);
          const isEmpty = data === null;

          const statusText = isEmpty
            ? '<span style="color: #fca5a5; font-weight: bold;">[ ว่าง / New Game ]</span>'
            : '<span style="color: #86efac; font-weight: bold;">[ มีข้อมูล / Loaded ]</span>';

          let description = "";
          if (isEmpty) {
            description = "สร้างดวงดาวใหม่ด้วยขนาดและข้อมูลเริ่มต้น";
          } else {
            const gridSize = data.currentGridSize || 400;
            const seed = data.globalSeed || 13585;
            const rock =
              data.collectedCount && data.collectedCount.rock !== undefined
                ? data.collectedCount.rock
                : 0;
            const branch =
              data.collectedCount && data.collectedCount.branch !== undefined
                ? data.collectedCount.branch
                : 0;
            description = `ขนาด: ${gridSize} | Seed: ${seed} | หิน: ${rock}, กิ่งไม้: ${branch}`;
          }

          html += `
                    <div class="save-slot-card game-ui"  
                         onmouseover="this.style.background='rgba(223, 183, 108, 0.15)'; this.style.borderColor='#dfb76c'; this.style.boxShadow='0 0 12px rgba(223, 183, 108, 0.15)';" 
                         onmouseout="this.style.background='rgba(223, 183, 108, 0.05)'; this.style.borderColor='rgba(223, 183, 108, 0.25)'; this.style.boxShadow='none';"
                         onclick="selectSaveSlotAndStart('${slot.id}')" style="background: rgba(223, 183, 108, 0.05); border: 1px solid rgba(223, 183, 108, 0.25); padding: 14px; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; pointer-events: auto;">
                            <span style="color: #dfb76c; font-weight: bold; font-size: 14px; text-shadow: 0 0 4px rgba(223, 183, 108, 0.3); font-family: 'JetBrains Mono', monospace;">${slot.label}</span>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 11px; font-family: 'JetBrains Mono', monospace;">${statusText}</span>
                                ${
                                  !isEmpty
                                    ? `
                                <button onclick="event.preventDefault(); event.stopPropagation(); deleteSaveSlot('${slot.id}', this, event)" 
                                         
                                        onmouseover="this.style.background='rgba(239, 68, 68, 0.35)'; this.style.borderColor='#fca5a5';" 
                                        onmouseout="this.style.background='rgba(239, 68, 68, 0.15)'; this.style.borderColor='rgba(239, 68, 68, 0.4)';" class="game-ui" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; padding: 2px 6px; font-size: 10px; font-family: 'JetBrains Mono', monospace; cursor: pointer; transition: all 0.2s;">
                                    ลบเซฟ (Delete)
                                </button>
                                `
                                    : ""
                                }
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; color: rgba(255,255,255,0.7); font-size: 11px; font-family: 'JetBrains Mono', monospace;">
                            <span style="color: rgba(255,255,255,0.45); font-size: 10px;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px; margin-top: -2px;"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg> LocalStorage KEY: ${slot.id}</span>
                            <span style="color: rgba(255,255,255,0.8);">${description}</span>
                        </div>
                    </div>
                `;
        }
        listContainer.innerHTML = html;
      }

      function deleteSaveSlot(slotId, buttonElement, e) {
        if (e) {
          if (typeof e.preventDefault === "function") e.preventDefault();
          if (typeof e.stopPropagation === "function") e.stopPropagation();
          if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        }
        window.lastDeleteSaveSlotTime = Date.now();
        if (!buttonElement) return;
        if (buttonElement.dataset.confirm === "true") {
          localStorage.removeItem(slotId);
          renderSaveSlots();
        } else {
          buttonElement.dataset.confirm = "true";
          buttonElement.textContent = "ยืนยันลบ? (Confirm)";
          buttonElement.style.background = "rgba(239, 68, 68, 0.4)";
          buttonElement.style.borderColor = "#ef4444";
          buttonElement.style.color = "#ffffff";

          setTimeout(() => {
            if (buttonElement && buttonElement.dataset.confirm === "true") {
              buttonElement.dataset.confirm = "false";
              buttonElement.textContent = "ลบเซฟ (Delete)";
              buttonElement.style.background = "rgba(239, 68, 68, 0.15)";
              buttonElement.style.borderColor = "rgba(239, 68, 68, 0.4)";
              buttonElement.style.color = "#fca5a5";
            }
          }, 3000);
        }
      }
      deleteSaveSlot = deleteSaveSlot;

      function selectSaveSlotAndStart(slotId) {
        if (window.lastDeleteSaveSlotTime && Date.now() - window.lastDeleteSaveSlotTime < 500) {
          return;
        }
        if (Date.now() - lastSaveSelectorOpenedTime < 350) {
          return;
        }
        activeSaveSlotId = slotId;
        const data = getSlotData(slotId);

        closeSaveSelector();
        startGameWithSlot(data);
      }
      selectSaveSlotAndStart = selectSaveSlotAndStart;

      // คืนค่าเริ่มต้น (Restore Defaults)
      function initRestoreDefaultsHandler() {
        const btnRestore = document.getElementById("btnRestoreDefaults");
        if (btnRestore) {
          btnRestore?.addEventListener("click", () => {
            const currentPlanetSettings = {
              currentGridSize,
              RADIUS,
              globalSeed,
              waterLevel,
              waterOpacity,
              waveStrength,
              waterColor,
              atmosphereAlpha,
              atmosphereScale,
              atmosphereColor,
              godRaysAlpha,
              godRaysCount,
              godRaysColor,
              skyGasIntensity,
              cloudsAlpha,
              cloudsHeight,
              cloudsThickness,
              cloudsSpeed,
              cloudsShape,
              cloudsColor,
              playerSpeed,
              playerScale,
              inventory: typeof inventory !== "undefined" ? inventory : [],
              actionSlotsItems: typeof actionSlotsItems !== "undefined" ? actionSlotsItems : [],
              playerHP: typeof playerHP !== "undefined" ? playerHP : 5,
              playerMaxHP: typeof playerMaxHP !== "undefined" ? playerMaxHP : 5,
              collectedCount: typeof collectedCount !== "undefined" ? collectedCount : {},
              choppedTrees: typeof choppedTrees !== "undefined" ? choppedTrees : [],
              destroyedRocks: typeof destroyedRocks !== "undefined" ? destroyedRocks : [],
              collectiblesState: typeof savedCollectiblesState !== "undefined" ? savedCollectiblesState : null,
              dynamicCollectibles: typeof dynamicCollectibles !== "undefined" ? dynamicCollectibles : [],
              placedStructures: typeof placedStructures !== "undefined" ? placedStructures : [],
              amphibiansState: typeof savedAmphibiansState !== "undefined" ? savedAmphibiansState : null,
              tunnels3D: typeof tunnels3D !== "undefined" ? tunnels3D : [],
            };

            applySettings(
              { ...DEFAULT_SETTINGS, ...currentPlanetSettings },
              true,
              false
            );
            saveSettingsToLocalStorage();

            // Visual feedback
            const originalText = btnRestore.innerHTML;
            btnRestore.innerHTML = "🔄 คืนค่าเริ่มต้นเรียบร้อยแล้ว!";
            btnRestore.style.color = "#34d399";
            setTimeout(() => {
              btnRestore.innerHTML = originalText;
              btnRestore.style.color = "#fca5a5";
            }, 2000);
          });
        }

        const btnExitToMenu = document.getElementById("btnExitToMenu");
        if (btnExitToMenu) {
          btnExitToMenu?.addEventListener("click", () => {
            saveSettingsToLocalStorage();

            const fade = document.getElementById("fadeToBlack");
            if (fade) fade.style.opacity = "1";

            setTimeout(() => {
              window.location.reload();
            }, 1500); // Wait for fade out
          });
        }
      }


