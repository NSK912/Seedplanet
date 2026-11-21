// === SEEDPLANET MODULE: GAMEPLAY/ACTORCORE.JS ===
// Unified Actor Interface & Data-Driven Item Action System
// Allows Player and PlayerClones (and future NPCs/companions) to share 100% of gameplay,
// inventory, combat, tool, and item logic driven by ITEM_DEFINITIONS.

(function() {
  const cloneActorCache = new WeakMap();
  let cachedPlayerActor = null;

  function resolveCanonicalId(itemOrName) {
    if (!itemOrName) return "";
    const def = (typeof window.getItemDefinition === "function") ? window.getItemDefinition(itemOrName) : null;
    if (def && def.id) return String(def.id).toUpperCase();
    const raw = (typeof itemOrName === "string")
      ? itemOrName
      : (itemOrName.name || itemOrName.id || itemOrName.label || itemOrName.type || "");
    const upper = String(raw).toUpperCase();
    if (upper === "ARM_CANNON") return "WOODEN_ARM_CANNON";
    if (upper === "DRAGONFRUIT") return "DRAGON_FRUIT";
    return upper;
  }

  function resolveDef(itemOrName) {
    if (!itemOrName) return null;
    if (typeof window.getItemDefinition === "function") {
      return window.getItemDefinition(itemOrName);
    }
    if (typeof window.ITEM_DEFINITIONS !== "undefined") {
      const id = resolveCanonicalId(itemOrName);
      return window.ITEM_DEFINITIONS[id] || null;
    }
    return null;
  }

  function defaultItemMatch(slot, targetName) {
    if (!slot || !targetName) return false;
    if (typeof isItemMatch === "function") return isItemMatch(slot, targetName);
    const normTarget = resolveCanonicalId(targetName);
    const normSlot = resolveCanonicalId(slot);
    if (normSlot && normTarget && normSlot === normTarget) return true;
    return slot.name === targetName || slot.label === targetName;
  }

  // =========================================================================
  // 1. PLAYER ACTOR ADAPTER (Bridges global Player variables seamlessly)
  // =========================================================================
  function getPlayerActor() {
    if (cachedPlayerActor) return cachedPlayerActor;

    cachedPlayerActor = {
      id: "player",
      isPlayer: true,
      isClone: false,

      getTheta: () => (typeof charTheta !== "undefined" ? charTheta : 0),
      setTheta: (v) => { if (typeof charTheta !== "undefined") charTheta = v; },
      getPhi: () => (typeof charPhi !== "undefined" ? charPhi : 0),
      setPhi: (v) => { if (typeof charPhi !== "undefined") charPhi = v; },
      getHeading: () => (typeof charHeading !== "undefined" ? charHeading : 0),
      setHeading: (v) => { if (typeof charHeading !== "undefined") charHeading = v; },
      getCenterRadius: () => (typeof playerCenterRadius !== "undefined" ? playerCenterRadius : null),
      setCenterRadius: (v) => { if (typeof playerCenterRadius !== "undefined") playerCenterRadius = v; },
      getScale: () => (typeof playerScale !== "undefined" ? playerScale : 0.1),

      getHP: () => (typeof playerHP !== "undefined" ? playerHP : 5),
      setHP: (v) => {
        if (typeof playerHP !== "undefined") {
          const max = (typeof playerMaxHP !== "undefined" ? playerMaxHP : 5);
          playerHP = Math.max(0, Math.min(max, v));
          window.playerHP = playerHP;
        }
      },
      getMaxHP: () => (typeof playerMaxHP !== "undefined" ? playerMaxHP : 5),

      getHunger: () => (typeof playerHunger !== "undefined" ? playerHunger : 5),
      setHunger: (v) => {
        if (typeof playerHunger !== "undefined") {
          const max = (typeof playerMaxHunger !== "undefined" ? playerMaxHunger : 5);
          playerHunger = Math.max(0, Math.min(max, v));
          window.playerHunger = playerHunger;
        }
      },
      getMaxHunger: () => (typeof playerMaxHunger !== "undefined" ? playerMaxHunger : 5),
      resetHungerTimers: () => {
        if (typeof playerHungerTimer !== "undefined") playerHungerTimer = 0.0;
        if (typeof playerStarvationTimer !== "undefined") playerStarvationTimer = 0.0;
      },
      syncStatsUI: () => {
        if (typeof updatePlayerHPUI === "function") updatePlayerHPUI();
      },

      getActiveItem: () => (typeof activeItem !== "undefined" ? activeItem : null),
      setActiveItem: (item) => {
        if (typeof activeItem !== "undefined") activeItem = item;
        window.activeItem = item;
      },
      isUsingItem: () => (typeof isUsingItem !== "undefined" ? !!isUsingItem : false),
      setUsingItem: (flag) => {
        if (typeof isUsingItem !== "undefined") isUsingItem = !!flag;
        window.isUsingItem = !!flag;
      },
      getUseAnimTimer: () => (typeof useAnimTimer !== "undefined" ? useAnimTimer : 0),
      setUseAnimTimer: (v) => {
        if (typeof useAnimTimer !== "undefined") useAnimTimer = v;
        window.useAnimTimer = v;
      },
      getArrowShotInAnim: () => (typeof arrowShotInCurrentAnim !== "undefined" ? !!arrowShotInCurrentAnim : false),
      setArrowShotInAnim: (v) => {
        if (typeof arrowShotInCurrentAnim !== "undefined") arrowShotInCurrentAnim = !!v;
      },
      getBowComboActive: () => (typeof bowComboActive !== "undefined" ? !!bowComboActive : false),
      setBowComboActive: (v) => {
        if (typeof bowComboActive !== "undefined") bowComboActive = !!v;
      },
      setLastBowShootInfo: (timeMs, power) => {
        if (typeof lastBowShootTime !== "undefined") lastBowShootTime = timeMs;
        if (typeof lastBowDrawPower !== "undefined") lastBowDrawPower = power;
      },
      setEquippedTool: (toolName) => {
        // Player holds via selected action slot / activeItem; no extra mutation needed
        void toolName;
      },

      isRiding: () => (
        (typeof activeRidingBoat !== "undefined" && !!activeRidingBoat) ||
        (typeof activeRidingMech !== "undefined" && !!activeRidingMech)
      ),
      getRidingBoat: () => (typeof activeRidingBoat !== "undefined" ? activeRidingBoat : null),
      getRidingMech: () => (typeof activeRidingMech !== "undefined" ? activeRidingMech : null),

      getItemCount: (name) => (typeof getItemCount === "function" ? getItemCount(name) : 0),
      addItem: (item, playAudio = true, shouldRender = true) => {
        if (typeof addItemToInventory === "function") {
          return addItemToInventory(item, playAudio, shouldRender);
        }
        return false;
      },
      consumeItem: (name, count = 1) => {
        if (typeof consumeItem === "function") {
          consumeItem(name, count);
          return true;
        }
        return false;
      },
      consumeSlotItem: (item, index, source, count = 1) => {
        if (!item) return false;
        const cur = (typeof item.count === "number") ? item.count : 1;
        if (cur > count) {
          item.count = cur - count;
        } else {
          if (source === "inventory" && typeof inventory !== "undefined" && typeof index === "number") {
            inventory[index] = null;
          } else if (source === "action" && typeof actionSlotsItems !== "undefined" && typeof index === "number") {
            actionSlotsItems[index] = null;
            if (typeof selectedActionSlotIndex !== "undefined" && selectedActionSlotIndex === index) {
              selectedActionSlotIndex = -1;
            }
          }
        }
        return true;
      },
      findAmmo: (preferred = null) => {
        if (typeof findArrowInInventory === "function") {
          return findArrowInInventory();
        }
        void preferred;
        return null;
      },
      consumeAmmo: (ammoRef) => {
        if (typeof consumeArrow === "function" && ammoRef) {
          consumeArrow(ammoRef);
          return true;
        }
        return false;
      },

      notify: (msg) => {
        if (msg && typeof showNotice === "function") {
          showNotice(msg);
        }
      },
      setExpression: () => {},
      refreshUI: (source) => {
        if (source === "action" && typeof renderActionSlots === "function") {
          renderActionSlots();
        } else if (typeof renderInventory === "function") {
          renderInventory();
        }
        if (typeof renderActionSlots === "function" && source !== "action") {
          renderActionSlots();
        }
        if (typeof updateBadge === "function") updateBadge();
      }
    };

    return cachedPlayerActor;
  }

  // =========================================================================
  // 2. CLONE ACTOR ADAPTER (Bridges any PlayerClones cState cleanly)
  // =========================================================================
  function wrapCloneActor(cState) {
    if (!cState) return null;
    if (cloneActorCache.has(cState)) return cloneActorCache.get(cState);

    if (!Array.isArray(cState.inventory)) cState.inventory = [];
    if (typeof cState.hp !== "number") cState.hp = 5;
    if (typeof cState.maxHp !== "number") cState.maxHp = 5;
    if (typeof cState.hunger !== "number") cState.hunger = 5;
    if (typeof cState.maxHunger !== "number") cState.maxHunger = 5;

    const adapter = {
      id: "clone_" + (typeof cState.houseIndex === "number" ? cState.houseIndex : Math.floor(Math.random() * 1e6)),
      isPlayer: false,
      isClone: true,
      state: cState,

      getTheta: () => (typeof cState.theta === "number" ? cState.theta : 0),
      setTheta: (v) => { cState.theta = v; },
      getPhi: () => (typeof cState.phi === "number" ? cState.phi : 0),
      setPhi: (v) => { cState.phi = v; },
      getHeading: () => (typeof cState.heading === "number" ? cState.heading : 0),
      setHeading: (v) => { cState.heading = v; },
      getCenterRadius: () => (typeof cState.centerRadius === "number" ? cState.centerRadius : null),
      setCenterRadius: (v) => { cState.centerRadius = v; },
      getScale: () => (typeof playerScale !== "undefined" ? playerScale : 0.1),

      getHP: () => (typeof cState.hp === "number" ? cState.hp : 5),
      setHP: (v) => {
        const max = (typeof cState.maxHp === "number" ? cState.maxHp : 5);
        cState.hp = Math.max(0, Math.min(max, v));
      },
      getMaxHP: () => (typeof cState.maxHp === "number" ? cState.maxHp : 5),

      getHunger: () => (typeof cState.hunger === "number" ? cState.hunger : 5),
      setHunger: (v) => {
        const max = (typeof cState.maxHunger === "number" ? cState.maxHunger : 5);
        cState.hunger = Math.max(0, Math.min(max, v));
      },
      getMaxHunger: () => (typeof cState.maxHunger === "number" ? cState.maxHunger : 5),
      resetHungerTimers: () => {
        cState.hungerTimer = 0.0;
        cState.starvationTimer = 0.0;
      },
      syncStatsUI: () => {},

      getActiveItem: () => cState.activeItem || (cState.equippedTool ? { name: cState.equippedTool } : null),
      setActiveItem: (item) => {
        cState.activeItem = item;
        if (item && (item.name || item.label)) {
          cState.equippedTool = resolveCanonicalId(item);
        } else if (item === null) {
          cState.equippedTool = null;
        }
      },
      isUsingItem: () => !!(cState.isUsingItem || (cState.actionAnim && cState.actionAnim > 0)),
      setUsingItem: (flag) => { cState.isUsingItem = !!flag; },
      getUseAnimTimer: () => (typeof cState.actionAnim === "number" ? cState.actionAnim : 0),
      setUseAnimTimer: (v) => { cState.actionAnim = v; },
      getArrowShotInAnim: () => !!cState.arrowShotInCurrentAnim,
      setArrowShotInAnim: (v) => { cState.arrowShotInCurrentAnim = !!v; },
      getBowComboActive: () => !!cState.bowComboActive,
      setBowComboActive: (v) => { cState.bowComboActive = !!v; },
      setLastBowShootInfo: (timeMs, power) => {
        cState.lastBowShootTime = timeMs;
        cState.lastBowDrawPower = power;
      },
      setEquippedTool: (toolName) => { cState.equippedTool = toolName; },

      isRiding: () => !!(cState.ridingBoat && cState.ridingBoat.active),
      getRidingBoat: () => (cState.ridingBoat && cState.ridingBoat.active ? cState.ridingBoat : null),
      getRidingMech: () => null,

      getItemCount: (name) => {
        let total = 0;
        const norm = resolveCanonicalId(name);
        for (let i = 0; i < cState.inventory.length; i++) {
          const it = cState.inventory[i];
          if (it && (defaultItemMatch(it, name) || resolveCanonicalId(it) === norm)) {
            total += (it.count || 1);
          }
        }
        return total;
      },
      addItem: (item) => {
        if (!item) return false;
        const itemName = resolveCanonicalId(item) || item.name || item.label || "ITEM";
        const addCount = item.count || 1;
        const def = resolveDef(itemName);
        const icon = item.icon || (def ? def.icon : "📦");
        for (let i = 0; i < cState.inventory.length; i++) {
          const it = cState.inventory[i];
          if (it && (defaultItemMatch(it, itemName) || resolveCanonicalId(it) === itemName)) {
            it.count = (it.count || 1) + addCount;
            return true;
          }
        }
        cState.inventory.push({ name: itemName, icon, label: item.label || itemName, count: addCount });
        return true;
      },
      consumeItem: (name, count = 1) => {
        let needed = count;
        const norm = resolveCanonicalId(name);
        for (let i = 0; i < cState.inventory.length && needed > 0; i++) {
          const it = cState.inventory[i];
          if (it && (defaultItemMatch(it, name) || resolveCanonicalId(it) === norm)) {
            const cur = it.count || 1;
            if (cur > needed) {
              it.count = cur - needed;
              needed = 0;
            } else {
              needed -= cur;
              cState.inventory.splice(i, 1);
              i--;
            }
          }
        }
        return needed === 0;
      },
      consumeSlotItem: (item, index, source, count = 1) => {
        void source;
        if (typeof index === "number" && cState.inventory[index]) {
          const slot = cState.inventory[index];
          const cur = slot.count || 1;
          if (cur > count) {
            slot.count = cur - count;
          } else {
            cState.inventory.splice(index, 1);
          }
          return true;
        }
        const name = item ? (item.name || item.label) : null;
        return name ? adapter.consumeItem(name, count) : false;
      },
      findAmmo: (preferred = null) => {
        const order = preferred ? [preferred, "IRON_BULLET", "ARROW"] : ["IRON_BULLET", "ARROW"];
        for (let a = 0; a < order.length; a++) {
          const cand = order[a];
          for (let i = 0; i < cState.inventory.length; i++) {
            const slot = cState.inventory[i];
            if (slot && resolveCanonicalId(slot) === cand && (slot.count || 1) > 0) {
              return { type: "clone_inventory", index: i, item: slot };
            }
          }
        }
        return null;
      },
      consumeAmmo: (ammoRef) => {
        if (!ammoRef || typeof ammoRef.index !== "number") return false;
        const slot = cState.inventory[ammoRef.index];
        if (!slot) return false;
        const cur = slot.count || 1;
        if (cur > 1) {
          slot.count = cur - 1;
        } else {
          cState.inventory.splice(ammoRef.index, 1);
        }
        return true;
      },

      notify: () => {}, // Clones don't spam player's HUD notice banner
      setExpression: (expr) => {
        if (!expr) return;
        cState.emojiFaceText = expr;
        if (typeof window !== "undefined" && window.cloneFaceStyle === "emoji") {
          cState.faceText = expr;
        }
      },
      refreshUI: () => {}
    };

    cloneActorCache.set(cState, adapter);
    return adapter;
  }

  function resolveActor(actorOrEntity) {
    if (!actorOrEntity || actorOrEntity === "player") {
      return getPlayerActor();
    }
    if (typeof actorOrEntity.getTheta === "function" && typeof actorOrEntity.consumeItem === "function") {
      return actorOrEntity;
    }
    return wrapCloneActor(actorOrEntity);
  }

  // =========================================================================
  // 3. SHARED SPHERICAL TRANSFORM BASIS FOR ANY ACTOR
  // =========================================================================
  function getActorBasis(actorOrEntity, opts = null) {
    const actor = resolveActor(actorOrEntity);
    const theta = actor.getTheta();
    const phi = actor.getPhi();
    const heading = actor.getHeading();
    const pScale = actor.getScale();
    const pRad = (typeof RADIUS !== "undefined") ? RADIUS : 64.0;
    const hScale = (typeof HEIGHT_SCALE !== "undefined") ? HEIGHT_SCALE : 1.0;
    const gSeed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined")
      ? window.globalSeed
      : (typeof globalSeed !== "undefined" ? globalSeed : 0);

    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    const sinP = Math.sin(phi);
    const cosP = Math.cos(phi);

    const nx = sinT * cosP;
    const ny = cosT;
    const nz = sinT * sinP;

    const East = [-sinP, 0, cosP];
    const North = [-cosT * cosP, sinT, -cosT * sinP];
    const cosH = Math.cos(heading);
    const sinH = Math.sin(heading);

    const F = [
      North[0] * cosH + East[0] * sinH,
      North[1] * cosH + East[1] * sinH,
      North[2] * cosH + East[2] * sinH
    ];
    const R = [
      East[0] * cosH - North[0] * sinH,
      East[1] * cosH - North[1] * sinH,
      East[2] * cosH - North[2] * sinH
    ];

    const cRadRaw = actor.getCenterRadius();
    const hasValidCenterRad = (typeof cRadRaw === "number" && !Number.isNaN(cRadRaw) && cRadRaw > 0.001);
    let terrainRadius;
    let centerRadius;
    if (hasValidCenterRad && opts && opts.skipTerrainHeight) {
      centerRadius = cRadRaw;
      terrainRadius = cRadRaw - 0.46 * pScale;
    } else {
      const h = (typeof getVisualHeightOnSphere === "function")
        ? getVisualHeightOnSphere(theta, phi, gSeed)
        : ((typeof getHeightOnSphere === "function") ? getHeightOnSphere(theta, phi, gSeed) : 0);
      terrainRadius = pRad + h * hScale;
      centerRadius = hasValidCenterRad ? cRadRaw : (terrainRadius + 0.46 * pScale);
    }

    return {
      actor,
      theta,
      phi,
      heading,
      pScale,
      planetRadius: pRad,
      heightScale: hScale,
      seed: gSeed,
      normal: [nx, ny, nz],
      North,
      East,
      F,
      R,
      terrainRadius,
      centerRadius,
      terrainPos: [terrainRadius * nx, terrainRadius * ny, terrainRadius * nz],
      centerPos: [centerRadius * nx, centerRadius * ny, centerRadius * nz],
      feetPos: [(centerRadius - 0.46 * pScale) * nx, (centerRadius - 0.46 * pScale) * ny, (centerRadius - 0.46 * pScale) * nz]
    };
  }

  // =========================================================================
  // 4. DATA-DRIVEN ITEM ACTION HANDLERS (Shared by Player & PlayerClones)
  // =========================================================================
  function clearDelayedUseState(actor, delayMs) {
    if (!actor.isPlayer) return;
    setTimeout(() => {
      actor.setUsingItem(false);
      actor.setActiveItem(null);
    }, delayMs);
  }

  const ITEM_ACTION_HANDLERS = {
    // 1. Food & Consumables (DRAGON_FRUIT, FRIED_BUG, + any future food in ITEM_DEFINITIONS)
    CONSUMABLE_FOOD: function(actor, item, def, opts) {
      const canonicalId = (def && def.id) ? def.id : resolveCanonicalId(item);
      const source = opts.source || "inventory";
      actor.setActiveItem(item);
      actor.setUsingItem(true);

      const curHunger = actor.getHunger();
      const maxHunger = actor.getMaxHunger();
      const curHP = actor.getHP();
      const maxHP = actor.getMaxHP();

      const restoreHunger = (def && typeof def.restoreHunger === "number") ? def.restoreHunger : 2;
      const healHP = (def && typeof def.healHP === "number") ? def.healHP : 1;

      if (curHunger < maxHunger || curHP < maxHP) {
        actor.setHunger(curHunger + restoreHunger);
        actor.setHP(curHP + healHP);
        actor.resetHungerTimers();
        actor.syncStatsUI();

        const notice = (def && def.eatNotice)
          ? def.eatNotice
          : `กิน ${def ? (def.name_th || canonicalId) : canonicalId}! ฟื้นฟูความหิว +${restoreHunger} และ HP +${healHP}`;
        actor.notify(notice);
        actor.setExpression("(^o^)");

        actor.consumeItem(canonicalId, 1);
        actor.refreshUI(source);
        if (typeof playCollectSound === "function") playCollectSound();
        clearDelayedUseState(actor, 300);
        return true;
      }

      actor.notify("ค่าความหิวและ HP เต็มแล้ว! (Hunger & HP are full!)");
      clearDelayedUseState(actor, 300);
      return false;
    },

    // Shared ranged weapon fire helper (consumes ammo + spawns projectile via shootArrowProjectile)
    fireRangedWeaponInternal: null,

    // 2. Gathering Tools (AXE, PICKAXE, AEGIS_SHIFT, + any future tool in ITEM_DEFINITIONS)
    TOOL_HARVEST: function(actor, item, def, opts = {}) {
      const canonicalId = (def && def.id) ? def.id : resolveCanonicalId(item);
      const toolType = (def && def.toolType) ? def.toolType : canonicalId;
      const animDur = (def && typeof def.animDuration === "number") ? def.animDuration : 1.0;

      if (actor.isPlayer && canonicalId === "AEGIS_SHIFT" && typeof window.resetAegisShiftState === "function") {
        window.resetAegisShiftState();
      }

      const activePayload = (canonicalId === "AEGIS_SHIFT") ? { ...item, name: "AEGIS_SHIFT" } : item;
      actor.setActiveItem(activePayload);
      actor.setEquippedTool(toolType);
      actor.setUseAnimTimer(animDur);
      actor.setUsingItem(true);

      const preferNpc = !!(opts && (opts.preferNpc || opts.targetIsNpc));
      let hitEnv = false;
      if (!preferNpc && typeof checkMeleeHit === "function") {
        hitEnv = checkMeleeHit(toolType, {
          actor,
          directCollect: !actor.isPlayer,
          targetObstacle: (opts && opts.targetEntity) ? opts.targetEntity : null,
          reachOverride: (opts && typeof opts.reachOverride === "number") ? opts.reachOverride : undefined
        });
      }

      if (!hitEnv && ((def && def.npcHitConfig) || preferNpc) && typeof checkNpcMeleeHit === "function") {
        const cfg = (def && def.npcHitConfig) ? def.npcHitConfig : null;
        const lockDist = (typeof window.getUnifiedMeleeReach === "function")
          ? window.getUnifiedMeleeReach()
          : (typeof meleeLockDistance === "number" ? meleeLockDistance : 0.25);
        const lockedNow = actor.isPlayer
          ? ((typeof window.findTantoBestTarget === "function") ? window.findTantoBestTarget(lockDist, canonicalId) : null)
          : ((opts && opts.targetEntity) ? opts.targetEntity : null);
        if (actor.isPlayer && lockedNow && typeof activeTargetNPC !== "undefined") {
          activeTargetNPC = lockedNow;
        }
        const resolvedReach = (opts && typeof opts.reachOverride === "number")
          ? opts.reachOverride
          : ((cfg && cfg.useUnifiedMeleeReach) ? lockDist : (cfg ? cfg.reachOverride : undefined));
        const hitNpc = checkNpcMeleeHit((cfg && cfg.dmg) || (def && def.damage) || 2, (cfg && cfg.label) || null, {
          actor,
          reachOverride: resolvedReach,
          coneCos: cfg ? cfg.coneCos : null,
          maxVert: cfg ? cfg.maxVert : null,
          lockedTarget: lockedNow,
          targetEntity: opts ? opts.targetEntity : null,
          weaponId: canonicalId
        });
        if (!hitNpc && typeof playChopSound === "function") {
          playChopSound(opts && opts.targetPos ? opts.targetPos : undefined);
        }
      } else if (!hitEnv && !actor.isPlayer) {
        if (toolType === "PICKAXE" && typeof playRockHitSound === "function") {
          playRockHitSound(opts && opts.targetPos ? opts.targetPos : undefined);
        } else if (typeof playChopSound === "function") {
          playChopSound(opts && opts.targetPos ? opts.targetPos : undefined);
        }
      }
      return true;
    },

    // 3. Digging Tools (SHOVEL)
    TOOL_DIG: function(actor, item, def, opts) {
      const canonicalId = (def && def.id) ? def.id : resolveCanonicalId(item);
      const toolType = (def && def.toolType) ? def.toolType : canonicalId;
      const animDur = (def && typeof def.animDuration === "number") ? def.animDuration : 1.0;
      const digCfg = (def && def.digConfig) ? def.digConfig : {
        delta: -0.35,
        altRadius: 0.05,
        dropItem: { name: "DIRT", icon: "🟫", count: 1, label: "DIRT" }
      };

      actor.setActiveItem(item);
      actor.setEquippedTool(toolType);
      actor.setUseAnimTimer(animDur);
      actor.setUsingItem(true);

      if (actor.isPlayer) {
        if (typeof checkMeleeHit === "function") {
          checkMeleeHit(toolType, { actor });
        }
        let dugSuccess = false;
        if (opts && opts.isAltAction) {
          const forwardPoint = (typeof calculateForwardTarget === "function") ? calculateForwardTarget() : null;
          if (forwardPoint && typeof modTerrainAtPlayer === "function") {
            dugSuccess = Boolean(modTerrainAtPlayer(digCfg.delta, true, forwardPoint, digCfg.altRadius || 0.05, "trench"));
          }
        } else if (typeof modTerrainAtPlayer === "function") {
          dugSuccess = Boolean(modTerrainAtPlayer(digCfg.delta, true));
        }
        if (dugSuccess && digCfg.dropItem) {
          actor.addItem({ ...digCfg.dropItem }, false, true);
        }
      }
      return true;
    },

    // 4. Melee Weapons (BRANCH, TANTO, + any future melee weapon in ITEM_DEFINITIONS)
    WEAPON_MELEE: function(actor, item, def, opts = {}) {
      const canonicalId = (def && def.id) ? def.id : resolveCanonicalId(item);
      const toolType = (def && def.toolType) ? def.toolType : canonicalId;
      const animDur = (def && typeof def.animDuration === "number") ? def.animDuration : 1.0;
      const dmg = (def && typeof def.damage === "number") ? def.damage : 1;

      if (actor.isPlayer && canonicalId === "TANTO" && typeof window.resetTantoShirasayaState === "function") {
        window.resetTantoShirasayaState();
      }

      actor.setActiveItem({ ...item, name: canonicalId });
      actor.setEquippedTool(canonicalId);
      actor.setUseAnimTimer(animDur);
      actor.setUsingItem(true);

      let hitTarget = null;
      if (def && def.npcHitConfig) {
        const cfg = def.npcHitConfig;
        const lockDist = (typeof window.getUnifiedMeleeReach === "function")
          ? window.getUnifiedMeleeReach()
          : (typeof meleeLockDistance === "number" ? meleeLockDistance : 0.25);
        const lockedNow = actor.isPlayer
          ? ((typeof window.findTantoBestTarget === "function") ? window.findTantoBestTarget(lockDist, canonicalId) : null)
          : ((opts && opts.targetEntity) ? opts.targetEntity : null);
        if (actor.isPlayer && lockedNow && typeof activeTargetNPC !== "undefined") {
          activeTargetNPC = lockedNow;
        }
        if (typeof playSwordSlashSound === "function") {
          playSwordSlashSound(0);
        } else if (typeof playChopSound === "function") {
          playChopSound();
        }
        if (typeof checkNpcMeleeHit === "function") {
          const resolvedReach = (opts && typeof opts.reachOverride === "number")
            ? opts.reachOverride
            : (cfg.useUnifiedMeleeReach ? lockDist : cfg.reachOverride);
          hitTarget = checkNpcMeleeHit(cfg.dmg || dmg, cfg.label || null, {
            actor,
            reachOverride: resolvedReach,
            coneCos: actor.isPlayer ? cfg.coneCos : null,
            maxVert: cfg.maxVert,
            lockedTarget: lockedNow,
            targetEntity: opts ? opts.targetEntity : null,
            weaponId: canonicalId
          });
        }
        if (!hitTarget && def.targetTypes && def.targetTypes.length > 0 && typeof checkMeleeHit === "function") {
          checkMeleeHit(toolType, {
            actor,
            directCollect: !actor.isPlayer,
            targetObstacle: opts ? opts.targetEntity : null,
            reachOverride: (opts && typeof opts.reachOverride === "number") ? opts.reachOverride : undefined
          });
        }
      } else {
        if (typeof playChopSound === "function") playChopSound();
        if (typeof checkNpcMeleeHit === "function") {
          hitTarget = checkNpcMeleeHit(dmg, null, {
            actor,
            reachOverride: (opts && typeof opts.reachOverride === "number") ? opts.reachOverride : undefined,
            targetEntity: opts ? opts.targetEntity : null
          });
        }
        if (hitTarget && def && def.consumeOnNpcHit) {
          if (typeof opts.index === "number") {
            actor.consumeSlotItem(item, opts.index, opts.source, 1);
          } else {
            actor.consumeItem(canonicalId, 1);
          }
          actor.refreshUI(opts.source);
          if (def.breakNotice) {
            actor.notify(def.breakNotice);
          }
        }
      }
      return true;
    },

    // 5. Ranged Weapons (BOW, WOODEN_ARM_CANNON, ARM_CANNON, + future firearms/bows)
    WEAPON_RANGED: function(actor, item, def, opts = {}) {
      const canonicalId = (def && def.id) ? def.id : resolveCanonicalId(item);
      if (def && def.isDisabled) {
        actor.notify(def.disabledNotice || "🚫 อาวุธนี้ถูกปิดใช้งานชั่วคราว");
        return false;
      }

      if (opts && opts.isAltAction) {
        if (actor.isPlayer && typeof switchCannonAmmo === "function") {
          switchCannonAmmo();
        }
        return true;
      }

      const ammoRef = actor.findAmmo(opts ? opts.ammoName : null);
      if (!ammoRef) {
        actor.notify((def && def.noAmmoNotice) || "🚫 ไม่พบกระสุนในกระเป๋า! กรุณาคราฟ ลูกธนู หรือ กระสุนเหล็ก ทรงกลม");
        return false;
      }

      const animDur = (def && typeof def.animDuration === "number") ? def.animDuration : 1.07;
      actor.setUseAnimTimer(animDur);
      actor.setBowComboActive(false);
      actor.setActiveItem(item);
      actor.setEquippedTool(canonicalId);
      actor.setUsingItem(true);
      actor.setArrowShotInAnim(false);

      if (!actor.isPlayer || (opts && opts.immediateFire)) {
        fireRangedWeapon(actor, (opts && typeof opts.drawPower === "number") ? opts.drawPower : 1.0, {
          weaponItem: item,
          ammoName: (ammoRef.item && (ammoRef.item.name || ammoRef.item.label)) || (opts && opts.ammoName) || null,
          targetPos: (opts && opts.targetPos) || null
        });
      }
      return true;
    },

    // 6. Empty Iron Bucket
    TOOL_BUCKET: function(actor, item, def, opts) {
      void def;
      if (!actor.isPlayer) return false;
      const source = opts ? opts.source : "inventory";
      const index = opts ? opts.index : -1;

      if (source !== "action") {
        actor.notify("🪣 กรุณานำถังเหล็กไปใส่ในช่องแอคชั่น (Action Slot) เพื่อถือและตักน้ำ!");
        return false;
      }

      let isNearWater = false;
      const isWaterOn = (typeof waterEnabled !== "undefined") ? waterEnabled : true;
      if (isWaterOn && typeof RADIUS === "number" && typeof waterLevel === "number") {
        const hScale = (typeof HEIGHT_SCALE !== "undefined") ? HEIGHT_SCALE : 0.6;
        const wRad = (typeof Physics !== "undefined" && typeof Physics.getCanonicalWaterRadius === "function")
          ? Physics.getCanonicalWaterRadius(RADIUS, waterLevel, hScale)
          : (RADIUS + waterLevel * (hScale * 0.25));
        const getH = (typeof getVisualHeightOnSphere === "function")
          ? getVisualHeightOnSphere
          : ((typeof getHeightOnSphere === "function") ? getHeightOnSphere : null);

        if (typeof currentSwimFactor !== "undefined" && currentSwimFactor > 0) {
          isNearWater = true;
        } else if (getH && typeof charTheta === "number" && typeof charPhi === "number") {
          const playerTH = getH(charTheta, charPhi, window.globalSeed);
          const playerTRad = RADIUS + playerTH * hScale;
          if (playerTRad < wRad + 0.04) {
            isNearWater = true;
          } else {
            const pRad = (typeof playerCenterRadius === "number" && playerCenterRadius > 0) ? playerCenterRadius : playerTRad;
            if (pRad - wRad <= 0.45) {
              const sinT = Math.sin(charTheta), cosT = Math.cos(charTheta);
              const sinP = Math.sin(charPhi), cosP = Math.cos(charPhi);
              const nx = sinT * cosP, ny = cosT, nz = sinT * sinP;
              const East = [-sinP, 0, cosP];
              const North = [-cosT * cosP, sinT, -cosT * sinP];

              const headingsToCheck = [];
              if (typeof charHeading === "number") headingsToCheck.push(charHeading);
              if (typeof rotationY === "number") headingsToCheck.push(rotationY);

              const reachMax = (typeof actionReachDistance === "number" ? actionReachDistance : 0.4) * 1.65;
              for (let hIdx = 0; hIdx < headingsToCheck.length && !isNearWater; hIdx++) {
                const ang = headingsToCheck[hIdx];
                const cosH = Math.cos(ang), sinH = Math.sin(ang);
                const fx = North[0] * cosH + East[0] * sinH;
                const fy = North[1] * cosH + East[1] * sinH;
                const fz = North[2] * cosH + East[2] * sinH;

                for (let d = 0.06; d <= reachMax; d += 0.06) {
                  const px = nx * wRad + fx * d;
                  const py = ny * wRad + fy * d;
                  const pz = nz * wRad + fz * d;
                  const dist = Math.hypot(px, py, pz);
                  if (dist < 0.001) continue;
                  const sTheta = Math.acos(Math.max(-1.0, Math.min(1.0, py / dist)));
                  const sPhi = Math.atan2(pz / dist, px / dist);
                  const sTH = getH(sTheta, sPhi, window.globalSeed);
                  const sTRad = RADIUS + sTH * hScale;
                  if (sTRad < wRad + 0.015) {
                    isNearWater = true;
                    break;
                  }
                }
              }
            }
          }
        }
      }

      if (isNearWater) {
        const count = (typeof item.count === "number") ? item.count : 1;
        const waterBucketObj = { name: "WATER_BUCKET", icon: "🪣💧", count: 1, label: "WATER_BUCKET" };
        if (count <= 1 && typeof actionSlotsItems !== "undefined" && typeof index === "number" && index >= 0) {
          actionSlotsItems[index] = waterBucketObj;
        } else {
          const added = actor.addItem(waterBucketObj, false, false);
          if (!added) {
            actor.notify("❌ กระเป๋าเต็มแล้ว! ไม่สามารถรับถังใส่น้ำเพิ่มได้ (Inventory is full)");
            return false;
          }
          item.count = count - 1;
        }

        window.bucketScoopTimer = 1.0;
        if (typeof playSplashSound === "function") {
          playSplashSound(0.95, true);
        } else if (typeof playCollectSound === "function") {
          playCollectSound();
        }
        actor.refreshUI("all");
        actor.notify("💧 ตักน้ำสำเร็จ! ได้รับ ถังใส่น้ำ (WATER BUCKET) x1");
        return true;
      }

      actor.notify("🚫 ต้องใช้ถังน้ำตรงจุดที่มีน้ำเพื่อเติมน้ำ! (Must use near water to fill the bucket!)");
      return false;
    },

    // 7. Filled Water Bucket
    TOOL_WATER_BUCKET: function(actor, item, def, opts) {
      void item; void def;
      if (!actor.isPlayer) return false;
      const source = opts ? opts.source : "inventory";
      if (source !== "action") {
        actor.notify("🪣💧 ถังใส่น้ำ: กรุณานำไปใส่ในช่องแอคชั่น (Action Slot) เพื่อถือและใช้รดน้ำต้นไม้!");
        return false;
      }
      if (typeof window.PlanterSystem !== "undefined" && typeof window.PlanterSystem.water === "function") {
        let targetPlanter = window.activeWateringTargetPlanter || null;
        if (!targetPlanter && typeof collectibles !== "undefined" && collectibles) {
          const pScale = actor.getScale();
          const chestReachDist = Math.max(
            (typeof actionReachDistance === "number" && actionReachDistance > 0.01) ? actionReachDistance : (0.15 * (pScale / 0.1)),
            0.15 * (pScale / 0.1)
          );
          let bestT = Infinity;
          for (let i = 0; i < collectibles.length; i++) {
            const c = collectibles[i];
            if (c && c.active && !c.isPreview && c.type === "wood_planter_box" && c.plantData && !c.plantData.watered && c.position) {
              if (typeof isTargetWithinReach === "function") {
                const reachInfo = isTargetWithinReach(c.position, chestReachDist);
                if (reachInfo && reachInfo.valid && reachInfo.t < bestT) {
                  bestT = reachInfo.t;
                  targetPlanter = c;
                }
              }
            }
          }
        }
        if (targetPlanter) {
          window.PlanterSystem.water(targetPlanter);
          return true;
        }
      }
      actor.notify("💧 เดินเข้าไปชิดกล่องดินที่ปลูกต้นอ่อนไว้เพื่อรดน้ำ! (Stand next to a planted box to water it!)");
      return false;
    },

    // 8. Warp Item (OBSIDIAN_FLUX)
    WARP_ITEM: function(actor, item, def, opts) {
      void def;
      if (!actor.isPlayer) return false;
      if (typeof isActionDown !== "undefined") {
        isActionDown = false;
      }
      if (typeof openWarpUI === "function") {
        openWarpUI({ item, index: opts.index, source: opts.source });
      }
      return true;
    },

    // 9. Placeable Structures (PRE_PLACE)
    PLACE_STRUCTURE: function(actor, item, def, opts = {}) {
      void def;
      const itemName = resolveCanonicalId(item);
      if (!actor.isPlayer) {
        if (actor.isRiding()) return false;
        if (itemName === "WOOD_BOAT") {
          return !!deployBoatFromActor(actor, opts);
        }
        if ((itemName === "WOOD_WHEEL" || itemName === "ELECTRIC_ENGINE") && actor.state && actor.state.ownedBoat && actor.state.ownedBoat.active) {
          const targetBoat = actor.state.ownedBoat;
          if (itemName === "WOOD_WHEEL" && !targetBoat.hasWheel && !targetBoat.hasWheels) {
            if (!actor.consumeItem("WOOD_WHEEL", 1)) return false;
            targetBoat.hasWheel = true;
            targetBoat.hasWheels = true;
            targetBoat.wheelCount = 4;
            if (typeof window !== "undefined") window.pendingDynamicCollectibleRefresh = true;
            return true;
          }
          if (itemName === "ELECTRIC_ENGINE" && !targetBoat.hasEngine) {
            if (!actor.consumeItem("ELECTRIC_ENGINE", 1)) return false;
            targetBoat.hasEngine = true;
            if (typeof window !== "undefined") window.pendingDynamicCollectibleRefresh = true;
            return true;
          }
        }
        return false;
      }
      if (actor.isRiding()) {
        actor.notify("🚫 ไม่สามารถวางไอเทมขณะอยู่บนพาหนะได้ (Cannot place items while riding)");
        return false;
      }
      if ((itemName === "OBSIDIAN_PAD_WARP" || itemName === "OBSIDIAN_COMPASS_PAD") &&
          typeof getPlacedObsidianPadsInOrder === "function" &&
          typeof MAX_OBSIDIAN_PADS === "number" &&
          getPlacedObsidianPadsInOrder().length >= MAX_OBSIDIAN_PADS) {
        const msg = (typeof window.t === "function") ? window.t("max_warp_pads_notice") : "🚫 วาง Obsidian Pad ได้สูงสุดไม่เกิน 5 อัน! (Max 5 Obsidian Pads)";
        actor.notify(msg);
        return false;
      }
      if (typeof isPlacingFloor !== "undefined") isPlacingFloor = true;
      if (typeof placementRotationAngle !== "undefined") placementRotationAngle = 0.0;
      if (typeof floorPlacementInfo !== "undefined") {
        floorPlacementInfo = { item, index: opts.index, source: opts.source };
      }
      if (typeof closeInventoryActually === "function") closeInventoryActually();
      if (opts.source === "action" && typeof selectedActionSlotIndex !== "undefined") {
        selectedActionSlotIndex = opts.index;
        if (typeof renderActionSlots === "function") renderActionSlots();
      }
      return true;
    },

    // 10. Raw Materials / NONE items
    RAW_MATERIAL: function(actor, item, def, opts) {
      const itemName = resolveCanonicalId(item);
      if (actor.isPlayer && itemName === "LOG" && typeof spawnLogInFront === "function") {
        actor.consumeSlotItem(item, opts.index, opts.source, 1);
        actor.refreshUI("all");
        spawnLogInFront();
        return true;
      }
      if (def) {
        const usageText = def.usage_th || "ใช้เป็นวัตถุดิบคราฟต์และอื่นๆ";
        actor.notify(`📦 [${def.name_th || itemName}] เป็นไอเทมประเภทวัตถุดิบ (NONE): ${usageText}`);
      }
      return false;
    }
  };

  // Alias actionType keys onto the shared handler table so any ITEM_DEFINITIONS actionType resolves cleanly
  ITEM_ACTION_HANDLERS.TOOL_CHOP = ITEM_ACTION_HANDLERS.TOOL_HARVEST;
  ITEM_ACTION_HANDLERS.TOOL_MINE = ITEM_ACTION_HANDLERS.TOOL_HARVEST;
  ITEM_ACTION_HANDLERS.TOOL_MULTI = ITEM_ACTION_HANDLERS.TOOL_HARVEST;
  ITEM_ACTION_HANDLERS.ORE_RESOURCE = ITEM_ACTION_HANDLERS.RAW_MATERIAL;
  ITEM_ACTION_HANDLERS.ENERGY_SOURCE = ITEM_ACTION_HANDLERS.RAW_MATERIAL;
  ITEM_ACTION_HANDLERS.ENERGY_SOURCE_EMPTY = ITEM_ACTION_HANDLERS.RAW_MATERIAL;
  ITEM_ACTION_HANDLERS.AMMO = ITEM_ACTION_HANDLERS.RAW_MATERIAL;

  function fireRangedWeapon(actorOrEntity, drawPower = 1.0, opts = {}) {
    const actor = resolveActor(actorOrEntity);
    if (!actor) return null;
    const weaponItem = opts.weaponItem || actor.getActiveItem();
    const canonicalId = resolveCanonicalId(weaponItem);
    const isCannon = (canonicalId === "WOODEN_ARM_CANNON" || canonicalId === "ARM_CANNON");

    const ammoRef = actor.findAmmo(opts.ammoName || null);
    if (!ammoRef) return null;

    const ammoName = (ammoRef.item && (ammoRef.item.name || ammoRef.item.label)) || opts.ammoName || "ARROW";
    actor.consumeAmmo(ammoRef);
    actor.refreshUI("all");

    let proj = null;
    if (typeof window.shootArrowProjectile === "function") {
      proj = window.shootArrowProjectile(isCannon ? drawPower * 1.3 : drawPower, ammoName, {
        actor,
        weaponItem,
        targetPos: opts.targetPos || null
      });
    }
    if (typeof playBowShootSound === "function") playBowShootSound();
    actor.setArrowShotInAnim(true);
    if (typeof actor.setLastBowShootInfo === "function") {
      actor.setLastBowShootInfo(Date.now(), drawPower);
    }
    actor.setUseAnimTimer(isCannon ? 0.32 : 0.3);
    return proj;
  }

  // Shared animation timer & walk/row phase updater (exact same rates as Player in renderer.js)
  function stepActorAnimState(actorOrEntity, dt, opts = {}) {
    const dtClamped = Math.min(0.05, Math.max(0.0, dt || 0));
    if (dtClamped <= 0) return;
    const target = (actorOrEntity && actorOrEntity.state) ? actorOrEntity.state : actorOrEntity;
    if (!target || actorOrEntity === "player") return;

    // 1. Action swing / ranged recoil timer (exact 1.0/sec decay matching Player's useAnimTimer)
    if (!opts.phaseOnly && typeof target.actionAnim === "number" && target.actionAnim > 0) {
      target.actionAnim = Math.max(0, target.actionAnim - dtClamped);
      if (target.actionAnim <= 0) {
        target.actionAnim = 0;
        target.isUsingItem = false;
        target.arrowShotInCurrentAnim = false;
        target.bowComboActive = false;
      }
    }
    if (opts.timerOnly) return;

    // 2. Boat rowing timer & walk phase parity
    const isRidingBoat = !!(target.ridingBoat && target.ridingBoat.active);
    if (isRidingBoat) {
      const boat = target.ridingBoat;
      const isMotorOrWheeled = !!(boat.hasEngine || boat.hasWheel || boat.hasWheels);
      const boatStep = typeof opts.boatStep === "number" ? opts.boatStep : 0;
      if (!isMotorOrWheeled && boatStep > 0) {
        target.boatRowTimer = (target.boatRowTimer || 0) + boatStep * 15.0;
      } else {
        const curRow = target.boatRowTimer || 0;
        const targetRow = Math.round(curRow / Math.PI) * Math.PI;
        target.boatRowTimer = curRow + (targetRow - curRow) * Math.min(1.0, dtClamped * 6.0);
      }
      target.walkBlend = 0.0;
    } else if (opts.isWalking) {
      target.walkBlend = Math.min(1.0, (target.walkBlend || 0) + dtClamped * 4.0);
      target.animPhase = (target.animPhase || 0) + dtClamped * 14.4; // Exact match to Player walkSpeed 0.24 * 60fps
    } else {
      target.walkBlend = Math.max(0.0, (target.walkBlend || 0) - dtClamped * 4.0);
      const curPhase = target.animPhase || 0;
      const settleTarget = Math.round(curPhase / Math.PI) * Math.PI;
      target.animPhase = curPhase + (settleTarget - curPhase) * Math.min(1.0, dtClamped * 10.8);
    }
  }

  // Shared water-contact depth helper (works identically in open ocean and cave water)
  function checkWaterContact(theta, phi, feetRadius = null, planetRadius = null, depthFactor = 0.35) {
    if (typeof waterEnabled !== "undefined" && !waterEnabled) return false;
    const pRad = planetRadius || (typeof RADIUS !== "undefined" ? RADIUS : 64.0);
    const hs = (typeof HEIGHT_SCALE !== "undefined") ? HEIGHT_SCALE : 1.0;
    const seed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : 0;
    const pScale = (typeof playerScale !== "undefined") ? playerScale : 0.1;

    if (typeof Physics !== "undefined" && typeof Physics.resolveEntitySurfaceAndWater === "function") {
      const surf = Physics.resolveEntitySurfaceAndWater({
        theta,
        phi,
        feetRadius,
        planetRadius: pRad,
        heightScale: hs,
        seed
      });
      return !!(surf.isWaterPresent && surf.waterDepth > depthFactor * pScale);
    }

    const wl = (typeof waterLevel !== "undefined") ? waterLevel : 0.0;
    const waterRad = pRad + wl * (hs * 0.25);
    const bHeight = (typeof getVisualHeightOnSphere === "function") ? getVisualHeightOnSphere(theta, phi, seed) : 0;
    const terrainRad = pRad + bHeight * hs;
    return (waterRad - terrainRad) > depthFactor * pScale;
  }

  // Unified boat deployment helper (matches inventory.js / collectibles.js rules & surface physics)
  function deployBoatFromActor(actorOrEntity, opts = {}) {
    const actor = resolveActor(actorOrEntity);
    if (!actor || actor.getItemCount("WOOD_BOAT") <= 0) return null;
    if (!actor.consumeItem("WOOD_BOAT", 1)) return null;

    const colList = (typeof collectibles !== "undefined" && Array.isArray(collectibles))
      ? collectibles
      : ((typeof window !== "undefined" && window.collectibles) ? window.collectibles : []);

    const attachWheel = (opts.attachCarriedParts !== false) && actor.getItemCount("WOOD_WHEEL") > 0 && actor.consumeItem("WOOD_WHEEL", 1);
    const attachEngine = (opts.attachCarriedParts !== false) && actor.getItemCount("ELECTRIC_ENGINE") > 0 && actor.consumeItem("ELECTRIC_ENGINE", 1);

    const pRad = opts.planetRadius || (typeof RADIUS !== "undefined" ? RADIUS : 64.0);
    const seed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : 0;
    const hs = (typeof HEIGHT_SCALE !== "undefined") ? HEIGHT_SCALE : 1.0;
    const wl = (typeof waterLevel !== "undefined") ? waterLevel : 0.0;
    const wEnabled = (typeof waterEnabled !== "undefined") ? waterEnabled : true;
    const charScale = actor.getScale();
    const theta = actor.getTheta();
    const phi = actor.getPhi();
    const heading = actor.getHeading() || 0;
    const cRadRaw = actor.getCenterRadius();
    const initialCurrentRadius = (typeof cRadRaw === "number" && !Number.isNaN(cRadRaw) && cRadRaw > 0.001)
      ? Math.max(0.1, cRadRaw - 0.46 * charScale)
      : undefined;

    const boat = {
      type: "wood_boat",
      position: [pRad, 0, 0],
      normal: [0, 1, 0],
      R: [1, 0, 0],
      F: [0, 0, 1],
      active: true,
      isDynamic: true,
      vel: [0, 0, 0],
      spinAxis: [0, 1, 0],
      spinSpeed: 0,
      hasWheel: !!attachWheel,
      hasWheels: !!attachWheel,
      wheelCount: attachWheel ? 4 : 0,
      hasWing: false,
      hasWings: false,
      wingCount: 0,
      hasEngine: !!attachEngine,
      currentRadius: initialCurrentRadius,
      isCloneCrafted: !actor.isPlayer,
      houseIndex: actor.state ? actor.state.houseIndex : undefined
    };
    if (typeof COLLISION_LAYERS !== "undefined" && COLLISION_LAYERS.WOOD_WALL !== undefined) {
      boat.layer = COLLISION_LAYERS.WOOD_WALL;
    }

    if (typeof Physics !== "undefined" && typeof Physics.stepDrivenBoatOnSurface === "function") {
      Physics.stepDrivenBoatOnSurface({
        boat,
        theta,
        phi,
        heading,
        charScale,
        planetRadius: pRad,
        heightScale: hs,
        seed,
        wEnabled,
        wLevel: wl,
        wAnimTime: (typeof waterAnimTime !== "undefined") ? waterAnimTime : 0,
        wStrength: (typeof waveStrength !== "undefined") ? waveStrength : 0,
        timeScale: 1.0
      });
    } else {
      const sinT = Math.sin(theta), cosT = Math.cos(theta);
      const sinP = Math.sin(phi), cosP = Math.cos(phi);
      const nx = sinT * cosP, ny = cosT, nz = sinT * sinP;
      const bHeight = (typeof getVisualHeightOnSphere === "function") ? getVisualHeightOnSphere(theta, phi, seed) : 0;
      const terrainRad = pRad + bHeight * hs;
      const waterRad = pRad + wl * (hs * 0.25);
      const bRadius = attachWheel ? terrainRad : Math.max(waterRad - 0.04, terrainRad);
      const bEast = [-sinP, 0, cosP];
      const bNorth = [-cosT * cosP, sinT, -cosT * sinP];
      const cosH = Math.cos(heading);
      const sinH = Math.sin(heading);
      boat.position = [bRadius * nx, bRadius * ny, bRadius * nz];
      boat.normal = [nx, ny, nz];
      boat.R = [bEast[0] * cosH - bNorth[0] * sinH, bEast[1] * cosH - bNorth[1] * sinH, bEast[2] * cosH - bNorth[2] * sinH];
      boat.F = [bNorth[0] * cosH + bEast[0] * sinH, bNorth[1] * cosH + bEast[1] * sinH, bNorth[2] * cosH + bEast[2] * sinH];
      boat.angle = undefined;
    }

    colList.push(boat);
    if (actor.state) {
      actor.state.ownedBoat = boat;
    }
    if (typeof window !== "undefined") {
      window.pendingDynamicCollectibleRefresh = true;
    }
    return boat;
  }

  // Unified boat dismantle / pack helper (identical item return rules as inventory.js simulateDemolishStorage)
  function dismantleBoatToActor(actorOrEntity, boat) {
    const actor = resolveActor(actorOrEntity);
    if (!actor || !boat || boat.type !== "wood_boat") return false;
    if (boat.active) {
      boat.active = false;
      boat.isDemolished = true;
      actor.addItem({ name: "WOOD_BOAT", icon: "🛶", label: "WOOD_BOAT", count: 1 });
      if (boat.hasWheel || boat.hasWheels) {
        actor.addItem({ name: "WOOD_WHEEL", icon: "🛞", label: "WOOD_WHEEL", count: 1 });
      }
      if (boat.hasEngine) {
        actor.addItem({ name: "ELECTRIC_ENGINE", icon: "🔋", label: "ELECTRIC_ENGINE", count: 1 });
      }
      if (boat.hasWing || boat.hasWings) {
        actor.addItem({ name: "BOAT_WING", icon: "🪽", label: "BOAT_WING", count: 1 });
      }
    }

    const colList = (typeof collectibles !== "undefined" && Array.isArray(collectibles))
      ? collectibles
      : ((typeof window !== "undefined" && window.collectibles) ? window.collectibles : []);
    const idx = colList.indexOf(boat);
    if (idx !== -1) colList.splice(idx, 1);

    if (actor.state) {
      if (actor.state.ridingBoat === boat) actor.state.ridingBoat = null;
      if (actor.state.ownedBoat === boat) actor.state.ownedBoat = null;
      if (actor.state.targetBoat === boat) actor.state.targetBoat = null;
    }

    if (typeof window !== "undefined") {
      window.pendingDynamicCollectibleRefresh = true;
    }
    return true;
  }

  // Shared spherical tangent movement & collision pipeline (same order & rules as Player in renderer.js)
  function stepActorMovement(actorOrEntity, opts = {}) {
    const actor = resolveActor(actorOrEntity);
    if (!actor) return { actualMoveDist: 0, blockedRatio: 0 };

    const pRad = opts.planetRadius || (typeof RADIUS !== "undefined" ? RADIUS : 64.0);
    const hScale = opts.heightScale || (typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE : 1.0);
    const seedVal = (typeof opts.seed === "number")
      ? opts.seed
      : ((typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : 0);
    const charScale = opts.charScale || actor.getScale();

    const curTheta = actor.getTheta();
    const curPhi = actor.getPhi();
    const curHeading = actor.getHeading() || 0;

    const sinT = Math.sin(curTheta);
    const cosT = Math.cos(curTheta);
    const sinP = Math.sin(curPhi);
    const cosP = Math.cos(curPhi);

    const P_curr = [sinT * cosP, cosT, sinT * sinP];
    const East = [-sinP, 0, cosP];
    const North = [-cosT * cosP, sinT, -cosT * sinP];

    const cosH = Math.cos(curHeading);
    const sinH = Math.sin(curHeading);
    const F_3d = [
      North[0] * cosH + East[0] * sinH,
      North[1] * cosH + East[1] * sinH,
      North[2] * cosH + East[2] * sinH
    ];

    let activeCenterRad = (typeof opts.preCollisionCenterRadius === "number" && !Number.isNaN(opts.preCollisionCenterRadius))
      ? opts.preCollisionCenterRadius
      : actor.getCenterRadius();
    if (typeof activeCenterRad !== "number" || Number.isNaN(activeCenterRad) || activeCenterRad <= 0.001) {
      activeCenterRad = pRad + 0.46 * charScale;
    }

    const moveNorth = opts.moveNorth || 0;
    const moveEast = opts.moveEast || 0;
    const M_vec = [
      North[0] * moveNorth + East[0] * moveEast,
      North[1] * moveNorth + East[1] * moveEast,
      North[2] * moveNorth + East[2] * moveEast
    ];
    const moveLen = Math.hypot(M_vec[0], M_vec[1], M_vec[2]);
    if (moveLen <= 0.00001) {
      return { actualMoveDist: 0, blockedRatio: 0 };
    }

    // Geodesic spherical step (exact same formula as Player in renderer.js:4131-4153)
    const surfRadForStep = Math.max(1.0, pRad + (opts.terrainHeight || 0) * hScale);
    const angSpeed = moveLen / surfRadForStep;
    const V_move = [M_vec[0] / moveLen, M_vec[1] / moveLen, M_vec[2] / moveLen];
    let P_new = [
      P_curr[0] * Math.cos(angSpeed) + V_move[0] * Math.sin(angSpeed),
      P_curr[1] * Math.cos(angSpeed) + V_move[1] * Math.sin(angSpeed),
      P_curr[2] * Math.cos(angSpeed) + V_move[2] * Math.sin(angSpeed)
    ];
    const pNewLen = Math.hypot(P_new[0], P_new[1], P_new[2]) || 1;
    P_new[0] /= pNewLen;
    P_new[1] /= pNewLen;
    P_new[2] /= pNewLen;

    const ridingBoat = (opts.ridingBoat !== undefined) ? opts.ridingBoat : actor.getRidingBoat();
    const allCollectibles = (typeof collectibles !== "undefined" && Array.isArray(collectibles))
      ? collectibles
      : ((typeof window !== "undefined" && window.collectibles) ? window.collectibles : []);

    // 1. Shared Obstacle & Structure Collisions FIRST (trees, rocks, NPCs, walls, doors, windows, roofs)
    if (typeof resolveEntityObstacleAndStructureCollisions === "function") {
      resolveEntityObstacleAndStructureCollisions({
        P_new,
        P_curr,
        groundRadius: activeCenterRad,
        playerScale: charScale,
        activeRidingBoat: ridingBoat || null,
        collectibles: allCollectibles,
        F_3d,
        East,
        North,
        charTheta: curTheta,
        charPhi: curPhi,
        charHeading: curHeading
      });
    } else if (typeof CollisionCore !== "undefined" && typeof CollisionCore.resolveStructureCollisions === "function") {
      CollisionCore.resolveStructureCollisions({
        P_new,
        P_curr,
        groundRadius: activeCenterRad,
        playerScale: charScale,
        activeRidingBoat: ridingBoat || null,
        collectibles: allCollectibles,
        F_3d,
        East,
        North,
        charTheta: curTheta,
        charPhi: curPhi,
        charHeading: curHeading
      });
      const pRen = Math.hypot(P_new[0], P_new[1], P_new[2]) || 1;
      P_new[0] /= pRen;
      P_new[1] /= pRen;
      P_new[2] /= pRen;
    }

    // 2. Shared Terrain & Cave Collision (exact same water/boat swimFactor override as renderer.js:4193-4196)
    const isWaterOn = (typeof waterEnabled !== "undefined") ? waterEnabled : true;
    const wRadiusLocal = opts.wRadiusLocal || 0;
    const swimFactor = (typeof opts.swimFactor === "number")
      ? opts.swimFactor
      : (actor.state ? (actor.state.currentSwimFactor || 0) : 0);
    const diveDepth = (typeof opts.diveDepth === "number")
      ? opts.diveDepth
      : (actor.state ? (actor.state.diveDepth || 0) : 0);
    const swimMoveFactor = (typeof opts.swimMoveFactor === "number")
      ? opts.swimMoveFactor
      : (actor.state ? (actor.state.swimMovementFactor || 0) : 0);

    let collisionSwimFactor = swimFactor;
    if (ridingBoat && (ridingBoat.isInWater || (isWaterOn && wRadiusLocal > (pRad + (opts.terrainHeight || 0) * hScale)))) {
      collisionSwimFactor = 1.0;
    }

    if (typeof CollisionCore !== "undefined" && typeof CollisionCore.checkCaveAndTerrainCollision === "function") {
      const collisionResult = CollisionCore.checkCaveAndTerrainCollision(
        P_new,
        P_curr,
        activeCenterRad,
        charScale,
        collisionSwimFactor,
        wRadiusLocal,
        diveDepth,
        swimMoveFactor,
        opts.terrainHeight || 0,
        { ridingBoat: ridingBoat || null }
      );
      if (collisionResult && collisionResult.P_new) {
        P_new = collisionResult.P_new;
        if (typeof collisionResult.playerCenterRadius === "number" && !Number.isNaN(collisionResult.playerCenterRadius)) {
          const prevR = activeCenterRad;
          const nextR = collisionResult.playerCenterRadius;
          if (actor.state) {
            if (nextR > prevR + 0.0001 && (actor.state.verticalVel || 0) < 0) {
              if (prevR <= nextR + 0.05) {
                actor.state.verticalVel = 0;
                actor.state.isGrounded = true;
              }
            } else if (nextR < prevR - 0.0001 && (actor.state.verticalVel || 0) > 0) {
              actor.state.verticalVel = 0;
            }
          }
          actor.setCenterRadius(nextR);
        }
      }
    }

    // 3. Ceiling headroom clamp when on foot (cave-aware & matching renderer.js:4220-4232)
    const candTheta = Math.acos(Math.max(-1.0, Math.min(1.0, P_new[1])));
    const candPhi = Math.atan2(P_new[2], P_new[0]);
    const curCRForClamp = actor.getCenterRadius();
    const curFeetForClamp = (typeof curCRForClamp === "number" ? curCRForClamp : activeCenterRad) - 0.46 * charScale;
    const nextSurf = (typeof Physics !== "undefined" && typeof Physics.resolveEntitySurfaceAndWater === "function")
      ? Physics.resolveEntitySurfaceAndWater({
          theta: candTheta,
          phi: candPhi,
          nx: P_new[0],
          ny: P_new[1],
          nz: P_new[2],
          feetRadius: curFeetForClamp,
          planetRadius: pRad,
          heightScale: hScale,
          seed: seedVal
        })
      : null;
    const nextNatRad = nextSurf
      ? nextSurf.terrainRad
      : (pRad + ((typeof getVisualHeightOnSphere === "function") ? getVisualHeightOnSphere(candTheta, candPhi, seedVal) : 0) * hScale);

    if (!ridingBoat && typeof opts.clampFloorHook === "function" && typeof curCRForClamp === "number" && (!nextSurf || !nextSurf.caveData || !nextSurf.caveData.insideTunnel)) {
      const clampedFloor = opts.clampFloorHook(P_new[0], P_new[1], P_new[2], nextNatRad, curFeetForClamp);
      if (typeof clampedFloor === "number" && clampedFloor < curFeetForClamp - 0.001) {
        actor.setCenterRadius(clampedFloor + 0.46 * charScale);
      }
    }

    if (!ridingBoat && typeof getFloorCeilingRadiusAt === "function") {
      const curCR = actor.getCenterRadius();
      const curFeet = ((typeof curCR === "number" ? curCR : activeCenterRad)) - 0.46 * charScale;
      const ceilingRad = getFloorCeilingRadiusAt(P_new[0], P_new[1], P_new[2], nextNatRad, curFeet);
      if (ceilingRad < Infinity) {
        const maxCenterRad = Math.max(nextNatRad + 0.46 * charScale, ceilingRad - 0.46 * charScale);
        if ((typeof curCR === "number" ? curCR : activeCenterRad) > maxCenterRad) {
          actor.setCenterRadius(maxCenterRad);
          if (actor.state && (actor.state.verticalVel || 0) > 0) {
            actor.state.verticalVel = Math.min(0.0, -actor.state.verticalVel * 0.2);
          }
        }
      }
    }

    const candLen = Math.hypot(P_new[0], P_new[1], P_new[2]) || 1;
    const finalNx = P_new[0] / candLen;
    const finalNy = P_new[1] / candLen;
    const finalNz = P_new[2] / candLen;

    const finalTheta = Math.max(0.08, Math.min(Math.PI - 0.08, Math.acos(Math.max(-1.0, Math.min(1.0, finalNy)))));
    let finalPhi = Math.atan2(finalNz, finalNx);
    if (finalPhi < 0) finalPhi += Math.PI * 2;
    actor.setTheta(finalTheta);
    actor.setPhi(finalPhi);

    const actualMoveDist = Math.hypot(
      (finalNx - P_curr[0]) * pRad,
      (finalNy - P_curr[1]) * pRad,
      (finalNz - P_curr[2]) * pRad
    );
    const blockedRatio = moveLen > 0.0001 ? Math.max(0, 1.0 - actualMoveDist / moveLen) : 0;

    return { actualMoveDist, blockedRatio, P_new: [finalNx, finalNy, finalNz] };
  }

  // =========================================================================
  // 5. UNIFIED ENTRY POINT: useEntityItem(actorOrEntity, item, opts)
  // =========================================================================
  function useEntityItem(actorOrEntity, item, opts = {}) {
    if (!item) return false;
    const actor = resolveActor(actorOrEntity);
    if (!actor) return false;

    const itemName = item.name || item.label || "";
    const canonicalId = resolveCanonicalId(item);
    const def = resolveDef(itemName);

    let isPlaceable = false;
    if (typeof window.isPlaceableItem === "function") {
      isPlaceable = window.isPlaceableItem(itemName, actor);
    } else if (def) {
      const checkCat = Array.isArray(def.category) ? def.category.includes("PRE_PLACE") : def.category === "PRE_PLACE";
      isPlaceable = checkCat && !actor.isRiding();
    }

    if (isPlaceable || canonicalId.startsWith("ROBOT_")) {
      return ITEM_ACTION_HANDLERS.PLACE_STRUCTURE(actor, item, def, opts);
    }

    const actionType = (def && def.actionType) ? def.actionType : null;
    if (actionType && typeof ITEM_ACTION_HANDLERS[actionType] === "function") {
      return ITEM_ACTION_HANDLERS[actionType](actor, item, def, opts);
    }

    return ITEM_ACTION_HANDLERS.RAW_MATERIAL(actor, item, def, opts);
  }

  window.ActorCore = {
    getPlayerActor,
    wrapCloneActor,
    resolveActor,
    getBasis: getActorBasis,
    resolveCanonicalId,
    resolveDef,
    fireRangedWeapon,
    stepActorAnimState,
    checkWaterContact,
    deployBoatFromActor,
    dismantleBoatToActor,
    stepActorMovement,
    useEntityItem,
    ACTION_HANDLERS: ITEM_ACTION_HANDLERS
  };
  window.ITEM_ACTION_HANDLERS = ITEM_ACTION_HANDLERS;
  window.useEntityItem = useEntityItem;
})();
