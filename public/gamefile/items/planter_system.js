// === SEEDPLANET MODULE: JS/ITEMS/PLANTER_SYSTEM.JS ===
// ระบบปลูกพืชในกล่องไม้ใส่ดิน (WOOD PLANTER BOX)
// รองรับ แก้วมังกร (Dragon Fruit), กิ่งไม้ (Branch), นุ่น (Cotton Plant)
// ใช้ระบบพรีวิวและ snap เฉพาะกล่องดินเท่านั้น
// ใช้เวลานับถอยหลัง 5 นาทีในการเติบโต โดยมีเกจแสดงผลแบบ 5 ช่อง สไตล์เดียวกับ HP

(function() {
  'use strict';

  const GROWTH_TIME_SECONDS = 300; // 5 นาที (300 วินาที)

  const SEED_CONFIGS = {
    "DRAGON_FRUIT": {
      type: "DRAGON_FRUIT",
      nameTH: "แก้วมังกร",
      nameEN: "Dragon Fruit",
      icon: "🐉",
      descTH: "ต้นไม้ใบขาวแดง/ขาวทอง",
      duration: GROWTH_TIME_SECONDS,
      harvest: [
        { name: "DRAGON_FRUIT", count: 3, icon: "🐉" },
        { name: "BRANCH", count: 2, icon: "🌿" }
      ]
    },
    "BRANCH": {
      type: "BRANCH",
      nameTH: "กิ่งไม้",
      nameEN: "Branch",
      icon: "🌿",
      descTH: "ต้นไม้ทั่วไป",
      duration: GROWTH_TIME_SECONDS,
      harvest: [
        { name: "LOG", count: 4, icon: "🪵" },
        { name: "BRANCH", count: 3, icon: "🌿" }
      ]
    },
    "COTTON_PLANT": {
      type: "COTTON_PLANT",
      nameTH: "ต้นฝ้าย (นุ่น)",
      nameEN: "Cotton Plant",
      icon: "☁️",
      descTH: "ต้นฝ้าย (นุ่น)",
      duration: GROWTH_TIME_SECONDS,
      harvest: [
        { name: "COTTON_PLANT", count: 3, icon: "☁️" }
      ]
    }
  };

  function getSeedConfig(name) {
    if (!name) return null;
    const n = String(name).toUpperCase();
    if (n.includes("DRAGON")) return SEED_CONFIGS["DRAGON_FRUIT"];
    if (n.includes("BRANCH")) return SEED_CONFIGS["BRANCH"];
    if (n.includes("COTTON")) return SEED_CONFIGS["COTTON_PLANT"];
    return null;
  }

  function isPlantableItem(name) {
    return getSeedConfig(name) !== null;
  }

  let _lastStageCheck = 0;
  let _cachedOverlay = null;
  let _planterSignIdSeq = 1;

  function getCurLang() {
    if (typeof window.getGameLanguage === "function") return window.getGameLanguage();
    return window.gameLanguage || "th";
  }

  // Plain-text translation helper (for 2D Canvas 3D UI & prompts without raw HTML tags)
  function trPlain(key, params, fallbackTH) {
    const lang = getCurLang();
    const dictAll = window.I18N_DICTIONARY || {};
    // For Seedian, use English text so _drawSeedianOrText renders clean Seedian geometric runes
    const langKey = (lang === "seedian") ? "en" : lang;
    const dict = dictAll[langKey] || dictAll.th || dictAll.en || {};
    let str = dict[key] || (dictAll.en && dictAll.en[key]) || (dictAll.th && dictAll.th[key]) || fallbackTH || key;
    if (params && typeof params === "object") {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
      }
    }
    return str;
  }

  function getLocalizedSeedName(seedCfg, forCanvas = false) {
    if (!seedCfg) return trPlain("planter_empty_title", null, "กล่องไม้ใส่ดิน");
    const lang = getCurLang();
    if (forCanvas && lang === "seedian") {
      return seedCfg.nameEN || seedCfg.type || "PLANT";
    }
    const itemKey = "item_" + String(seedCfg.type || "").toUpperCase();
    const dictAll = window.I18N_DICTIONARY || {};
    const dict = dictAll[lang] || dictAll.th || {};
    if (dict[itemKey] && !forCanvas) {
      return (typeof window.t === "function") ? window.t(itemKey) : dict[itemKey];
    }
    if (lang === "en") return seedCfg.nameEN || seedCfg.nameTH;
    if (lang === "ja") return (dictAll.ja && dictAll.ja[itemKey]) || seedCfg.nameEN || seedCfg.nameTH;
    return seedCfg.nameTH || seedCfg.nameEN;
  }

  function setPromptLocalized(text) {
    const prompt = document.getElementById("interactPrompt");
    if (!prompt) return;
    const lang = getCurLang();
    if (lang === "seedian" && window.Seedian && typeof window.Seedian.toSeedian === "function") {
      const html = window.Seedian.toSeedian(text);
      if (prompt._lastSeedianHtml !== html) {
        prompt._lastSeedianHtml = html;
        prompt.innerHTML = html;
      }
    } else {
      prompt._lastSeedianHtml = null;
      if (prompt.textContent !== text) prompt.textContent = text;
    }
    prompt.style.display = "block";
  }

  const PlanterSystem = {
    GROWTH_TIME_SECONDS,

    isPlantableItem,
    getSeedConfig,

    update: function(delta) {
      if (typeof collectibles === "undefined" || !collectibles) return;

      const sampleH = (typeof getVisualHeightOnSphere === "function")
        ? getVisualHeightOnSphere
        : (typeof getHeightOnSphere === "function" ? getHeightOnSphere : null);

      // Single pass to gather active planter boxes; only verify ground height ONCE per planter box (_groundHeightVerified)
      const planterBoxes = [];
      let snappedAnyGroundPlanter = false;

      for (let i = 0; i < collectibles.length; i++) {
        const c = collectibles[i];
        if (!c || !c.active || c.isPreview || c.type !== "wood_planter_box" || !c.position) continue;
        planterBoxes.push(c);

        c.isDynamic = false;
        c.vel = null;

        if (!c._groundHeightVerified && sampleH) {
          c._groundHeightVerified = true;
          if (!c.isFloorSnapped) {
            let onConstructedFloor = false;
            for (let j = 0; j < collectibles.length; j++) {
              const other = collectibles[j];
              if (!other || !other.active || other.isPreview) continue;
              if (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor") {
                const dx = c.position[0] - other.position[0];
                const dy = c.position[1] - other.position[1];
                const dz = c.position[2] - other.position[2];
                const maxD = (other.type === "stone_floor") ? 2.2 : 0.45;
                if (dx * dx + dy * dy + dz * dz < maxD * maxD) {
                  onConstructedFloor = true;
                  break;
                }
              }
            }
            if (!onConstructedFloor) {
              const curR = Math.hypot(c.position[0], c.position[1], c.position[2]);
              if (curR > 0.001) {
                const nx = c.position[0] / curR;
                const ny = c.position[1] / curR;
                const nz = c.position[2] / curR;
                const th = Math.acos(Math.max(-1, Math.min(1, ny)));
                const ph = Math.atan2(nz, nx);
                const h = sampleH(th, ph, window.globalSeed || 0);
                let expectedGroundR = RADIUS + h * HEIGHT_SCALE;

                if (typeof getTerrainSurfaceAndCeiling === "function") {
                  const caveInfo = getTerrainSurfaceAndCeiling(nx, ny, nz, curR);
                  if (caveInfo && (caveInfo.insideTunnel || curR < expectedGroundR - 0.35)) {
                    expectedGroundR = caveInfo.ground;
                  }
                }

                if (Math.abs(curR - expectedGroundR) > 0.002) {
                  c.position[0] = nx * expectedGroundR;
                  c.position[1] = ny * expectedGroundR;
                  c.position[2] = nz * expectedGroundR;
                  snappedAnyGroundPlanter = true;
                }
              }
            }
          }
        }
      }

      if (snappedAnyGroundPlanter) {
        window.pendingDynamicCollectibleRefresh = true;
      }

      let heldItem = (typeof getHeldItem === "function") ? getHeldItem() : null;
      if (!heldItem && typeof selectedActionSlotIndex !== "undefined" && selectedActionSlotIndex !== -1 && typeof actionSlotsItems !== "undefined" && actionSlotsItems) {
        const slot = actionSlotsItems[selectedActionSlotIndex];
        if (slot && slot.name) {
          heldItem = slot;
        }
      }
      const seedCfg = heldItem ? getSeedConfig(heldItem.name) : null;
      const isHoldingWaterBucket = !!(heldItem && (heldItem.name === "WATER_BUCKET" || heldItem.name === "water_bucket" || heldItem.hasWater));

      // Find player position once per frame
      let pPos = null;
      if (typeof charTheta !== "undefined" && typeof charPhi !== "undefined") {
        const r_terrain = RADIUS + (sampleH ? sampleH(charTheta, charPhi, window.globalSeed || 0) * HEIGHT_SCALE : 0);
        const r = (typeof playerCenterRadius !== "undefined" && playerCenterRadius !== null) ? playerCenterRadius : r_terrain;
        pPos = [
          r * Math.sin(charTheta) * Math.cos(charPhi),
          r * Math.cos(charTheta),
          r * Math.sin(charTheta) * Math.sin(charPhi)
        ];
      }

      const pScale = (typeof playerScale === "number" && playerScale > 0) ? playerScale : 0.1;
      const chestReachDist = Math.max(
        (typeof actionReachDistance === "number" && actionReachDistance > 0.01) ? actionReachDistance : (0.15 * (pScale / 0.1)),
        0.15 * (pScale / 0.1)
      );

      let closestEmptyPlanter = null;
      let closestUnwateredPlanter = null;
      let closestMaturePlanter = null;
      let bestEmptyT = Infinity;
      let bestUnwateredT = Infinity;
      let bestMatureT = Infinity;

      for (let i = 0; i < planterBoxes.length; i++) {
        const c = planterBoxes[i];

        // ใช้ระบบระยะเดียวกับ กล่องไม้ (wood_chest) 100%: ต้องอยู่ในวงระยะทำการประชิด (isTargetWithinReach) เท่านั้น!
        let reachInfo = null;
        if (typeof isTargetWithinReach === "function") {
          reachInfo = isTargetWithinReach(c.position, chestReachDist);
        } else if (pPos) {
          const d = Math.hypot(c.position[0] - pPos[0], c.position[1] - pPos[1], c.position[2] - pPos[2]);
          reachInfo = { valid: d <= chestReachDist, t: d, perpSq: d * d };
        }

        if (!reachInfo || !reachInfo.valid) continue;

        if (!c.plantData) {
          if (reachInfo.t < bestEmptyT) {
            bestEmptyT = reachInfo.t;
            closestEmptyPlanter = c;
          }
        } else if (!c.plantData.watered) {
          if (reachInfo.t < bestUnwateredT) {
            bestUnwateredT = reachInfo.t;
            closestUnwateredPlanter = c;
          }
        } else if (c.plantData.watered && c.plantData.plantTime > 0) {
          const elapsed = (Date.now() - c.plantData.plantTime) / 1000;
          if (elapsed >= (c.plantData.growthDuration || GROWTH_TIME_SECONDS)) {
            if (reachInfo.t < bestMatureT) {
              bestMatureT = reachInfo.t;
              closestMaturePlanter = c;
            }
          }
        }
      }

      // Track whether player is holding a plantable seed item or watering a planter for reach circle
      window.isHoldingPlantableSeed = !!seedCfg || isHoldingWaterBucket;

      const keyName = (typeof currentKeyBindings !== "undefined" && currentKeyBindings.interact)
        ? currentKeyBindings.interact.replace("Key", "").replace("Arrow", "")
        : "E";

      // Handle Planting Snap Preview: ONLY active when holding a plantable item AND within close reach of an empty planter box!
      if (seedCfg && closestEmptyPlanter) {
        window.activePlantingTargetPlanter = closestEmptyPlanter;
        window.activePlantingSeedItem = heldItem;

        // เช็คการเปลี่ยนไอเทมต่อเนื่องใน Hotbar ทันที หรือเปลี่ยนกล่อง
        const needsUpdate = (window._currentPreviewPlanter !== closestEmptyPlanter) ||
                            (closestEmptyPlanter.previewSeedType !== seedCfg.type) ||
                            (!closestEmptyPlanter.isPreviewPlant) ||
                            (closestEmptyPlanter.previewIsValid !== true);

        if (needsUpdate) {
          if (window._currentPreviewPlanter && window._currentPreviewPlanter !== closestEmptyPlanter) {
            window._currentPreviewPlanter.isPreviewPlant = false;
          }
          window._currentPreviewPlanter = closestEmptyPlanter;
          closestEmptyPlanter.isPreviewPlant = true;
          closestEmptyPlanter.previewSeedType = seedCfg.type;
          closestEmptyPlanter.previewIsValid = true;
          window.pendingDynamicCollectibleRefresh = true;
        }

        const plantDisplayName = getLocalizedSeedName(seedCfg, true);
        const text = trPlain("planter_prompt_plant", { key: keyName, plant: plantDisplayName }, `[${keyName} / คลิกซ้าย] ปลูก${plantDisplayName}`);
        setPromptLocalized(text);
      } else {
        window.activePlantingTargetPlanter = null;
        window.activePlantingSeedItem = null;

        if (window._currentPreviewPlanter) {
          window._currentPreviewPlanter.isPreviewPlant = false;
          window._currentPreviewPlanter = null;
          window.pendingDynamicCollectibleRefresh = true;
        }
      }

      // Handle Watering Target for Unwatered Planted Box (strictly within close reach)
      if (closestUnwateredPlanter && (!seedCfg || !closestEmptyPlanter)) {
        const uSeedCfg = getSeedConfig(closestUnwateredPlanter.plantData.seedType) || { nameTH: "ต้นอ่อน", nameEN: "Sprout" };
        const plantDisplayName = getLocalizedSeedName(uSeedCfg, true);

        if (isHoldingWaterBucket) {
          window.activeWateringTargetPlanter = closestUnwateredPlanter;
          window.activeWateringBucketItem = heldItem;
          const text = trPlain("planter_prompt_water", { key: keyName, plant: plantDisplayName }, `[${keyName} / คลิกซ้าย] รดน้ำ${plantDisplayName} 🪣💧`);
          setPromptLocalized(text);
        } else {
          window.activeWateringTargetPlanter = null;
          window.activeWateringBucketItem = null;
          const text = trPlain("planter_prompt_need_water", { plant: plantDisplayName }, `💧 ต้องใช้ถังใส่น้ำ (Water Bucket) มารดน้ำ${plantDisplayName}`);
          setPromptLocalized(text);
        }
      } else {
        window.activeWateringTargetPlanter = null;
        window.activeWateringBucketItem = null;
      }

      // Handle Mature Harvesting / Pickup Targeting (Reuses exact existing map mechanics!)
      if (closestMaturePlanter) {
        const pData = closestMaturePlanter.plantData;
        const sType = String(pData.seedType || "").toUpperCase();
        const isCotton = sType.includes("COTTON");

        if (isCotton) {
          window.activeMatureCottonPlanter = closestMaturePlanter;
          window.activeMatureTreePlanter = null;
          if ((!seedCfg || !closestEmptyPlanter) && !window.activeWateringTargetPlanter) {
            const text = trPlain("planter_prompt_harvest_cotton", { key: keyName }, `[${keyName}] เก็บต้นฝ้าย`);
            setPromptLocalized(text);
          }
        } else {
          // Trees (Dragon Fruit / Branch): Chopped down with an Axe just like trees on the map
          window.activeMatureCottonPlanter = null;
          window.activeMatureTreePlanter = closestMaturePlanter;
          if ((!seedCfg || !closestEmptyPlanter) && !window.activeWateringTargetPlanter) {
            const isHoldingAxe = heldItem && (heldItem.name === "AXE" || heldItem.name === "axe");
            if (isHoldingAxe) {
              const text = trPlain("planter_prompt_chop_tree", null, `[คลิกซ้าย] ตัดต้นไม้ 🪓`);
              setPromptLocalized(text);
            }
          }
        }
      } else {
        window.activeMatureCottonPlanter = null;
        window.activeMatureTreePlanter = null;
      }

      // Check plant growth progress updates (refresh 3D mesh when stage increments)
      const now = Date.now();
      if (now - _lastStageCheck > 5000) { // Every 5 seconds
        _lastStageCheck = now;
        let anyGrowing = false;
        for (let i = 0; i < planterBoxes.length; i++) {
          const c = planterBoxes[i];
          if (c.plantData && c.plantData.watered && c.plantData.plantTime > 0) {
            const elapsed = (now - c.plantData.plantTime) / 1000;
            const curStage = Math.min(5, Math.floor(elapsed / 60));
            if (c.plantData.stage !== curStage) {
              c.plantData.stage = curStage;
              anyGrowing = true;
            }
          }
        }
        if (anyGrowing) {
          window.pendingDynamicCollectibleRefresh = true;
        }
      }

      // Update genuine 3D World UI sign before World3DUI.render() runs
      PlanterSystem.renderFloatingGrowthUI(planterBoxes, pPos);
    },

    plant: function(planter, seedItem) {
      if (!planter || planter.plantData) return false;
      const seedCfg = getSeedConfig(seedItem ? seedItem.name : "");
      if (!seedCfg) return false;

      // Validate close reach distance using exact wood_chest reach system (isTargetWithinReach)
      const pScale = (typeof playerScale === "number" && playerScale > 0) ? playerScale : 0.1;
      const chestReachDist = Math.max(
        (typeof actionReachDistance === "number" && actionReachDistance > 0.01) ? actionReachDistance : (0.15 * (pScale / 0.1)),
        0.15 * (pScale / 0.1)
      );
      if (typeof isTargetWithinReach === "function" && planter.position) {
        const reachInfo = isTargetWithinReach(planter.position, chestReachDist);
        if (!reachInfo || !reachInfo.valid) {
          if (typeof showNotice === "function") showNotice(trPlain("planter_notice_out_of_reach", null, "🚫 อยู่นอกระยะประชิด กรุณาเดินเข้าไปชิดกล่องดิน"));
          return false;
        }
      }

      // Consume 1 seed item from action slot or inventory
      let consumed = false;
      if (typeof selectedActionSlotIndex !== "undefined" && selectedActionSlotIndex !== -1 && typeof actionSlotsItems !== "undefined") {
        const slot = actionSlotsItems[selectedActionSlotIndex];
        if (slot && isPlantableItem(slot.name) && slot.count > 0) {
          slot.count--;
          if (slot.count <= 0) {
            actionSlotsItems[selectedActionSlotIndex] = null;
          }
          consumed = true;
        }
      }

      if (!consumed && typeof consumeItem === "function") {
        consumed = consumeItem(seedItem.name, 1);
      }

      if (!consumed && typeof inventory !== "undefined") {
        for (let i = 0; i < inventory.length; i++) {
          if (inventory[i] && isPlantableItem(inventory[i].name) && inventory[i].count > 0) {
            inventory[i].count--;
            if (inventory[i].count <= 0) inventory[i] = null;
            consumed = true;
            break;
          }
        }
      }

      if (!consumed) {
        if (typeof showNotice === "function") showNotice("❌ ไม่มีไอเทมสำหรับปลูก (No seed item)");
        return false;
      }

      // Clear preview snap
      planter.isPreviewPlant = false;
      window._currentPreviewPlanter = null;

      // Initialize plant data in UNWATERED state (requires Water Bucket to start growth timer!)
      planter.plantData = {
        seedType: seedCfg.type,
        plantTime: 0,
        watered: false,
        growthDuration: seedCfg.duration || GROWTH_TIME_SECONDS,
        stage: 0,
        mature: false,
        useGold: (Math.random() < 0.25),
        seed: Math.floor(Math.random() * 10000)
      };
      planter.isDynamic = false;
      planter.vel = null;

      // Update UI
      if (typeof renderActionSlots === "function") renderActionSlots();
      if (typeof isInventoryOpen !== "undefined" && isInventoryOpen && typeof renderInventory === "function") renderInventory();
      if (typeof updateBadge === "function") updateBadge();

      // Audio & feedback
      if (typeof playCollectSound === "function") playCollectSound();
      if (typeof showNotice === "function") {
        const plantDisplayName = getLocalizedSeedName(seedCfg, true);
        showNotice(trPlain("planter_notice_planted", { plant: plantDisplayName }, `🌱 ปลูก ${plantDisplayName} ในกล่องดินแล้ว! กรุณาใช้ถังใส่น้ำมารดน้ำเพื่อเริ่มนับเวลาเติบโต`));
      }

      window.pendingDynamicCollectibleRefresh = true;

      if (typeof saveSettingsToLocalStorage === "function") {
        setTimeout(() => {
          if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
        }, 0);
      }
      return true;
    },

    water: function(planter) {
      if (!planter || !planter.plantData) return false;
      if (planter.plantData.watered) {
        if (typeof showNotice === "function") showNotice(trPlain("planter_notice_already_watered", null, "💧 ต้นไม้นี้ได้รับการรดน้ำและกำลังเติบโตอยู่แล้ว!"));
        return false;
      }

      // Validate close reach distance using exact wood_chest reach system (isTargetWithinReach)
      const pScale = (typeof playerScale === "number" && playerScale > 0) ? playerScale : 0.1;
      const chestReachDist = Math.max(
        (typeof actionReachDistance === "number" && actionReachDistance > 0.01) ? actionReachDistance : (0.15 * (pScale / 0.1)),
        0.15 * (pScale / 0.1)
      );
      if (typeof isTargetWithinReach === "function" && planter.position) {
        const reachInfo = isTargetWithinReach(planter.position, chestReachDist);
        if (!reachInfo || !reachInfo.valid) {
          if (typeof showNotice === "function") showNotice(trPlain("planter_notice_out_of_reach", null, "🚫 อยู่นอกระยะประชิด กรุณาเดินเข้าไปชิดกล่องดิน"));
          return false;
        }
      }

      // Transform 1 WATER_BUCKET back into an empty IRON_BUCKET (exact reverse of water scooping!)
      const emptyBucketObj = { name: "IRON_BUCKET", icon: "🪣", count: 1, label: "IRON_BUCKET" };
      let bucketConverted = false;

      if (typeof selectedActionSlotIndex !== "undefined" && selectedActionSlotIndex !== -1 && typeof actionSlotsItems !== "undefined") {
        const slot = actionSlotsItems[selectedActionSlotIndex];
        if (slot && (slot.name === "WATER_BUCKET" || slot.name === "water_bucket" || slot.hasWater)) {
          const count = (typeof slot.count === "number") ? slot.count : 1;
          if (count <= 1) {
            actionSlotsItems[selectedActionSlotIndex] = emptyBucketObj;
            bucketConverted = true;
          } else {
            if (typeof addItemToInventory === "function") {
              const added = addItemToInventory(emptyBucketObj, false, false);
              if (!added) {
                if (typeof showNotice === "function") showNotice(trPlain("inventory_full", null, "❌ กระเป๋าเต็ม!"));
                return false;
              }
            }
            slot.count = count - 1;
            bucketConverted = true;
          }
        }
      }

      if (!bucketConverted && typeof inventory !== "undefined") {
        for (let i = 0; i < inventory.length; i++) {
          const invItem = inventory[i];
          if (invItem && (invItem.name === "WATER_BUCKET" || invItem.name === "water_bucket" || invItem.hasWater)) {
            const count = (typeof invItem.count === "number") ? invItem.count : 1;
            if (count <= 1) {
              inventory[i] = emptyBucketObj;
              bucketConverted = true;
              break;
            } else {
              if (typeof addItemToInventory === "function") {
                const added = addItemToInventory(emptyBucketObj, false, false);
                if (!added) {
                  if (typeof showNotice === "function") showNotice(trPlain("inventory_full", null, "❌ กระเป๋าเต็ม!"));
                  return false;
                }
              }
              invItem.count = count - 1;
              bucketConverted = true;
              break;
            }
          }
        }
      }

      if (!bucketConverted) {
        if (typeof showNotice === "function") showNotice(trPlain("planter_prompt_need_water", { plant: "" }, "🚫 ต้องถือถังใส่น้ำ (Water Bucket) เพื่อรดน้ำ!"));
        return false;
      }

      // Mark watered & start 5-minute countdown timer
      planter.plantData.watered = true;
      planter.plantData.plantTime = Date.now();
      planter.plantData.stage = 0;

      // Trigger watering animation snapped temporarily above this planter box
      window.activeWateringAnimPlanter = planter;
      window.bucketWaterTimer = 1.0;

      if (typeof playSplashSound === "function") {
        playSplashSound(0.95, true);
      } else if (typeof playCollectSound === "function") {
        playCollectSound();
      }

      if (typeof renderActionSlots === "function") renderActionSlots();
      if (typeof isInventoryOpen !== "undefined" && isInventoryOpen && typeof renderInventory === "function") renderInventory();
      if (typeof updateBadge === "function") updateBadge();

      const seedCfg = getSeedConfig(planter.plantData.seedType) || { nameTH: "ต้นอ่อน", nameEN: "Sprout" };
      if (typeof showNotice === "function") {
        const plantDisplayName = getLocalizedSeedName(seedCfg, true);
        showNotice(trPlain("planter_notice_watered", { plant: plantDisplayName }, `💧 รดน้ำ${plantDisplayName}สำเร็จ! เริ่มนับเวลาเติบโต 5 นาที (ได้รับถังเปล่าคืน)`));
      }

      window.pendingDynamicCollectibleRefresh = true;

      if (typeof saveSettingsToLocalStorage === "function") {
        setTimeout(() => {
          if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
        }, 0);
      }
      return true;
    },

    harvest: function(planter) {
      if (!planter || !planter.plantData) return false;
      const pData = planter.plantData;
      const seedCfg = getSeedConfig(pData.seedType);
      if (!seedCfg) return false;

      if (!pData.watered || !pData.plantTime) {
        if (typeof showNotice === "function") {
          const plantDisplayName = getLocalizedSeedName(seedCfg, true);
          showNotice(trPlain("planter_prompt_need_water", { plant: plantDisplayName }, `💧 ยังไม่ได้รดน้ำ! กรุณาใช้ถังใส่น้ำมารดน้ำก่อน`));
        }
        return false;
      }

      const elapsed = (Date.now() - pData.plantTime) / 1000;
      if (elapsed < (pData.growthDuration || GROWTH_TIME_SECONDS)) {
        const remaining = Math.ceil((pData.growthDuration || GROWTH_TIME_SECONDS) - elapsed);
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        if (typeof showNotice === "function") {
          showNotice(`⏳ ${mins}:${secs < 10 ? '0' : ''}${secs}`);
        }
        return false;
      }

      // Add harvest rewards to player inventory
      const rewards = seedCfg.harvest || [];
      let allAdded = true;
      let rewardText = [];

      for (let r of rewards) {
        if (typeof addItemToInventory === "function") {
          const success = addItemToInventory({ name: r.name, count: r.count, icon: r.icon });
          if (success) {
            rewardText.push(`${r.icon} ${r.name} x${r.count}`);
          } else {
            allAdded = false;
          }
        }
      }

      if (!allAdded && typeof showNotice === "function") {
        showNotice(trPlain("inventory_full", null, "⚠️ ช่องเก็บของเต็มบางส่วน!"));
      }

      // Reset planter box soil so player can plant anew
      planter.plantData = null;
      planter.isPreviewPlant = false;

      if (typeof playCollectSound === "function") playCollectSound();
      if (typeof showNotice === "function") {
        const plantDisplayName = getLocalizedSeedName(seedCfg, true);
        showNotice(`🌾 ${plantDisplayName}: ${rewardText.join(", ")}`);
      }

      window.pendingDynamicCollectibleRefresh = true;

      if (typeof saveSettingsToLocalStorage === "function") {
        setTimeout(() => {
          if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
        }, 0);
      }
      return true;
    },

    handleInteract: function() {
      // 1) Planting snap target
      if (window.activePlantingTargetPlanter && window.activePlantingSeedItem) {
        return PlanterSystem.plant(window.activePlantingTargetPlanter, window.activePlantingSeedItem);
      }
      // 2) Watering unwatered plant with Water Bucket
      if (window.activeWateringTargetPlanter && window.activeWateringBucketItem) {
        return PlanterSystem.water(window.activeWateringTargetPlanter);
      }
      // 3) Mature cotton plant pickup (reuse exact same collectible pickup as map cotton)
      if (window.activeMatureCottonPlanter) {
        const planter = window.activeMatureCottonPlanter;
        if (planter && planter.plantData) {
          const success = (typeof addItemToInventory === "function")
            ? addItemToInventory({ icon: "☁️", label: "COTTON_PLANT", name: "COTTON_PLANT" })
            : false;
          if (success) {
            planter.plantData = null;
            planter.isDynamic = false;
            if (typeof playCollectSound === "function") playCollectSound();
            if (typeof collectedCount !== "undefined") {
              collectedCount["cotton_plant"] = (collectedCount["cotton_plant"] || 0) + 1;
            }
            if (typeof showNotice === "function") {
              showNotice(trPlain("planter_notice_cotton_collected", null, "☁️ เก็บต้นฝ้ายแล้ว!"));
            }
            window.pendingDynamicCollectibleRefresh = true;
            if (typeof saveSettingsToLocalStorage === "function") {
              setTimeout(() => {
                if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
              }, 0);
            }
            return true;
          } else {
            if (typeof showNotice === "function") showNotice(trPlain("inventory_full", null, "⚠️ กระเป๋าเต็ม!"));
            return true;
          }
        }
      }
      // 4) Mature tree: remind player to chop with Axe just like trees on the map!
      if (window.activeMatureTreePlanter) {
        if (typeof showNotice === "function") {
          showNotice(trPlain("planter_notice_chop_with_axe", null, "🪓 ใช้ขวาน (Axe) ตัดต้นไม้เพื่อเก็บเกี่ยวไม้และผลผลิต"));
        }
        return true;
      }
      return false;
    },

    handleLeftClick: function() {
      if (window.activePlantingTargetPlanter && window.activePlantingSeedItem) {
        return PlanterSystem.plant(window.activePlantingTargetPlanter, window.activePlantingSeedItem);
      }
      if (window.activeWateringTargetPlanter && window.activeWateringBucketItem) {
        return PlanterSystem.water(window.activeWateringTargetPlanter);
      }
      return false;
    },

    renderFloatingGrowthUI: function(precollectedPlanters, precomputedPlayerPos) {
      // Ensure legacy 2D DOM overlay is hidden (replaced by genuine 3D World UI Sign like Mech Stand)
      if (!_cachedOverlay) _cachedOverlay = document.getElementById("planterGrowthOverlay");
      if (_cachedOverlay && _cachedOverlay._lastHtml !== "") {
        _cachedOverlay._lastHtml = "";
        _cachedOverlay.innerHTML = "";
      }

      if (typeof World3DUI === "undefined" || !World3DUI.backend) return;
      if (typeof collectibles === "undefined" || !collectibles) {
        World3DUI.hidePlanterBoxUI();
        return;
      }

      let pPos = Array.isArray(precomputedPlayerPos) ? precomputedPlayerPos : null;
      if (!pPos && typeof charTheta !== "undefined" && typeof charPhi !== "undefined") {
        const sampleH = (typeof getVisualHeightOnSphere === "function")
          ? getVisualHeightOnSphere
          : (typeof getHeightOnSphere === "function" ? getHeightOnSphere : null);
        const r_terrain = RADIUS + (sampleH ? sampleH(charTheta, charPhi, window.globalSeed || 0) * HEIGHT_SCALE : 0);
        const r = (typeof playerCenterRadius !== "undefined" && playerCenterRadius !== null) ? playerCenterRadius : r_terrain;
        pPos = [
          r * Math.sin(charTheta) * Math.cos(charPhi),
          r * Math.cos(charTheta),
          r * Math.sin(charTheta) * Math.sin(charPhi)
        ];
      }

      const now = Date.now();
      const curLang = getCurLang();
      const pScale = (typeof playerScale === "number" && playerScale > 0) ? playerScale : 0.1;
      const chestReachDist = Math.max(
        (typeof actionReachDistance === "number" && actionReachDistance > 0.01) ? actionReachDistance : (0.15 * (pScale / 0.1)),
        0.15 * (pScale / 0.1)
      );

      // Default to true ("เปิดแสดงผล 3d ui ทิ้งไว้") unless explicitly toggled off in devgame UI
      const showAlways = (window.devgame && typeof window.devgame.planterUiPreviewAlways === "boolean")
        ? window.devgame.planterUiPreviewAlways
        : true;

      const keyName = (typeof currentKeyBindings !== "undefined" && currentKeyBindings.interact)
        ? currentKeyBindings.interact.replace("Key", "").replace("Arrow", "")
        : "E";

      const activeSignIds = new Set();
      const list = Array.isArray(precollectedPlanters) ? precollectedPlanters : collectibles;

      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (!c || !c.active || c.isPreview || c.type !== "wood_planter_box" || !c.position) continue;

        let shouldShowThisPlanter = false;
        if (showAlways) {
          if (pPos) {
            const dist = Math.hypot(c.position[0] - pPos[0], c.position[1] - pPos[1], c.position[2] - pPos[2]);
            if (dist <= 12.0) shouldShowThisPlanter = true;
          } else {
            shouldShowThisPlanter = true;
          }
        } else if (c.plantData) {
          if (typeof isTargetWithinReach === "function") {
            const reachInfo = isTargetWithinReach(c.position, chestReachDist);
            if (reachInfo && reachInfo.valid) shouldShowThisPlanter = true;
          } else if (pPos) {
            const dist = Math.hypot(c.position[0] - pPos[0], c.position[1] - pPos[1], c.position[2] - pPos[2]);
            if (dist <= chestReachDist) shouldShowThisPlanter = true;
          }
        }

        if (!shouldShowThisPlanter) continue;

        if (!c._planterSignId) {
          c._planterSignId = "planter_box_world_sign_" + (_planterSignIdSeq++);
        }
        const signId = c._planterSignId;
        activeSignIds.add(signId);

        if (!c.plantData) {
          // Empty planter box (or holding a seed in preview snap)
          if (c.isPreviewPlant && c.previewSeedType) {
            const prevCfg = getSeedConfig(c.previewSeedType) || { type: "DRAGON_FRUIT", nameTH: "แก้วมังกร", nameEN: "Dragon Fruit", icon: "🌱" };
            const pName = getLocalizedSeedName(prevCfg, true);
            const timerStr = trPlain("planter_timer_preview", null, "พร้อมปลูก");
            const statusStr = trPlain("planter_status_preview", { key: keyName }, `🌱 กด [${keyName}] หรือคลิกซ้ายเพื่อปลูก`);
            World3DUI.updatePlanterBoxUI({
              planter: c,
              signId: signId,
              playerPos: pPos,
              seedType: prevCfg.type,
              seedIcon: prevCfg.icon || "🌱",
              plantName: pName,
              timerText: timerStr,
              statusText: statusStr,
              filledSlots: 0,
              isWatered: false,
              isMature: false,
              isEmpty: false,
              lang: curLang
            });
          } else {
            const boxTitle = trPlain("planter_empty_title", null, "กล่องไม้ใส่ดิน");
            const timerStr = trPlain("planter_timer_empty", null, "ว่างเปล่า");
            const statusStr = trPlain("planter_status_empty", null, "🌱 ใช้พืชหรือกิ่งไม้เพื่อปลูก");
            World3DUI.updatePlanterBoxUI({
              planter: c,
              signId: signId,
              playerPos: pPos,
              seedType: "WOOD_PLANTER_BOX",
              seedIcon: "🪴",
              plantName: boxTitle,
              timerText: timerStr,
              statusText: statusStr,
              filledSlots: 0,
              isWatered: false,
              isMature: false,
              isEmpty: true,
              lang: curLang
            });
          }
          continue;
        }

        const plant = c.plantData;
        const seedCfg = getSeedConfig(plant.seedType) || { type: "DRAGON_FRUIT", nameTH: "แก้วมังกร", nameEN: "Dragon Fruit", icon: "🐉" };
        const pName = getLocalizedSeedName(seedCfg, true);
        const totalDur = plant.growthDuration || GROWTH_TIME_SECONDS;
        const isWatered = (plant.watered === true) && (plant.plantTime > 0);
        const elapsed = isWatered ? Math.max(0, (now - plant.plantTime) / 1000) : 0;
        const isMature = isWatered && (elapsed >= totalDur);
        const filledSlots = isWatered ? Math.min(5, Math.floor((elapsed / totalDur) * 5)) : 0;

        const sType = String(plant.seedType || "").toUpperCase();
        const isCotton = sType.includes("COTTON");
        let timerStr = "";
        let statusStr = "";
        if (!isWatered) {
          timerStr = trPlain("planter_timer_unwatered", null, "รอการรดน้ำ");
          statusStr = trPlain("planter_status_unwatered", null, "💧 ใช้ถังใส่น้ำรดเพื่อเริ่มโต");
        } else if (isMature) {
          timerStr = trPlain("planter_timer_mature", null, "โตเต็มที่!");
          statusStr = isCotton
            ? trPlain("planter_status_harvest_cotton", { key: keyName }, `✨ [${keyName}] เก็บต้นฝ้าย`)
            : trPlain("planter_status_mature_tree", null, "✨ โตเต็มที่แล้ว (ใช้ขวานตัด)");
        } else {
          const rem = Math.ceil(totalDur - elapsed);
          const m = Math.floor(rem / 60);
          const s = rem % 60;
          timerStr = `${m}:${s < 10 ? '0' : ''}${s}`;
          statusStr = trPlain("planter_status_growing", { filled: filledSlots }, `กำลังเติบโต (${filledSlots}/5)`);
        }

        World3DUI.updatePlanterBoxUI({
          planter: c,
          signId: signId,
          playerPos: pPos,
          seedType: seedCfg.type || plant.seedType || "DRAGON_FRUIT",
          seedIcon: seedCfg.icon || "🌱",
          plantName: pName,
          timerText: timerStr,
          statusText: statusStr,
          filledSlots: filledSlots,
          isWatered: isWatered,
          isMature: isMature,
          isEmpty: false,
          lang: curLang
        });
      }

      if (typeof World3DUI.cleanupUnusedPlanterSigns === "function") {
        World3DUI.cleanupUnusedPlanterSigns(activeSignIds);
      }
    }
  };

  window.PlanterSystem = PlanterSystem;
  window.plantInPlanterBox = PlanterSystem.plant;
  window.waterPlanterBox = PlanterSystem.water;
  window.harvestPlanterBox = PlanterSystem.harvest;

})();
