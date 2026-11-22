// === SEEDPLANET MODULE: JS/ITEMS/GLOW_BATTERY.JS ===
// Glowing Battery Rod (GLOW_BATTERY / GLOW_BATTERY_EMPTY) & BatterySystem
// ความจุเต็ม = 72,000 แต้ม (ใช้งานขับขี่ได้เต็ม 20 นาที ที่ 60 ticks/วินาที)
// แต้มรีเจนเต็ม = 18,000 แต้ม (ใช้เวลารีเจน 5 นาที ที่ 60 ticks/วินาที)
// แบตเตอรี่ที่หมดพลังงาน = รอรีเจนสะสมแต้มจนเต็ม 18,000 แต้ม แล้วจะกลับมา 72,000 แต้มพร้อมใช้งาน

window.ItemRegistry = window.ItemRegistry || {};

window.BatterySystem = {
  MAX_CHARGE: 72000,     // 72,000 แต้มพลังงาน (เทียบเท่าขับต่อเนื่อง 20 นาที)
  REGEN_TIME: 18000,     // 18,000 แต้มรีเจน (เทียบเท่ารีเจน 5 นาที)
  activeCharge: 72000,
  _lastNoticeTime: 0,

  getTotalBatteryCount() {
    let count = 0;
    if (typeof inventory !== "undefined" && Array.isArray(inventory)) {
      for (let item of inventory) {
        if (item && (item.name === "GLOW_BATTERY" || item.label === "GLOW_BATTERY")) count += (item.count || 1);
      }
    }
    if (typeof actionSlotsItems !== "undefined" && Array.isArray(actionSlotsItems)) {
      for (let item of actionSlotsItems) {
        if (item && (item.name === "GLOW_BATTERY" || item.label === "GLOW_BATTERY")) count += (item.count || 1);
      }
    }
    return count;
  },

  getTotalEmptyBatteryCount() {
    let count = 0;
    if (typeof inventory !== "undefined" && Array.isArray(inventory)) {
      for (let item of inventory) {
        if (item && item.name === "GLOW_BATTERY_EMPTY") count += (item.count || 1);
      }
    }
    if (typeof actionSlotsItems !== "undefined" && Array.isArray(actionSlotsItems)) {
      for (let item of actionSlotsItems) {
        if (item && item.name === "GLOW_BATTERY_EMPTY") count += (item.count || 1);
      }
    }
    return count;
  },

  getActiveBattery() {
    if (this.getTotalBatteryCount() > 0) {
      return { charge: this.activeCharge, isRecharging: false, rechargeTime: 0 };
    }
    return null;
  },

  hasActiveBattery() {
    return this.getTotalBatteryCount() > 0;
  },

  getStats() {
    let readyCount = this.getTotalBatteryCount();
    let rechargingCount = this.getTotalEmptyBatteryCount();
    let activeBattery = readyCount > 0 ? { charge: this.activeCharge } : null;
    let minRechargePointsRemaining = Infinity;

    // Find the empty battery with the most recharge time
    const scanForRecharge = (arr) => {
      if (!arr || !Array.isArray(arr)) return;
      for (let item of arr) {
        if (item && item.name === "GLOW_BATTERY_EMPTY" && item.rechargeTime !== undefined) {
          const rem = Math.max(0, this.REGEN_TIME - item.rechargeTime);
          if (rem < minRechargePointsRemaining) minRechargePointsRemaining = rem;
        }
      }
    };
    scanForRecharge(typeof inventory !== "undefined" ? inventory : []);
    scanForRecharge(typeof actionSlotsItems !== "undefined" ? actionSlotsItems : []);

    if (rechargingCount > 0 && minRechargePointsRemaining === Infinity) {
      minRechargePointsRemaining = this.REGEN_TIME; // Default if not started yet
    }

    const minSecRemaining = minRechargePointsRemaining === Infinity ? 0 : (minRechargePointsRemaining / 60);

    return {
      total: readyCount + rechargingCount,
      readyCount,
      rechargingCount,
      activeBattery,
      minRechargeTimeRemaining: minSecRemaining
    };
  },

  consumePower(amount = 1) {
    if (this.getTotalBatteryCount() <= 0) return false;

    let deduct = 1;
    if (typeof amount === "number" && !isNaN(amount) && amount > 0) {
      deduct = amount < 0.2 ? (amount * 60) : amount;
    }

    this.activeCharge -= deduct;
    if (this.activeCharge <= 0) {
      // 1. Remove 1 GLOW_BATTERY
      let removed = false;
      if (typeof consumeItem === "function") {
        consumeItem("GLOW_BATTERY", 1);
        removed = true;
      }

      if (removed) {
        // 2. Add 1 GLOW_BATTERY_EMPTY
        if (typeof addItemToInventory === "function") {
          addItemToInventory({ name: "GLOW_BATTERY_EMPTY", count: 1 }, false, false);
        }

        // Initialize rechargeTime for the newly added empty battery
        const initRecharge = (arr) => {
          if (!arr || !Array.isArray(arr)) return;
          for (let item of arr) {
            if (item && item.name === "GLOW_BATTERY_EMPTY" && item.rechargeTime === undefined) {
              item.rechargeTime = 0;
            }
          }
        };
        initRecharge(typeof inventory !== "undefined" ? inventory : []);
        initRecharge(typeof actionSlotsItems !== "undefined" ? actionSlotsItems : []);

        this.activeCharge = this.MAX_CHARGE;

        if (this.getTotalBatteryCount() > 0) {
          if (typeof showNotice === "function") {
            showNotice("🔋 แบตเตอรี่หมด 1 ก้อน (เริ่มรีเจน 5 นาที) ➔ สลับไปใช้ก้อนถัดไปอัตโนมัติ!");
          }
        } else {
          if (typeof showNotice === "function") {
            showNotice("⚠️ แบตเตอรี่ในกระเป๋าหมดพลังงานทั้งหมดแล้ว! (กำลังรอรีเจน 5 นาที)");
          }
        }
        if (typeof renderInventory === "function" && document.getElementById("inventoryOverlay")?.classList.contains("open")) {
          renderInventory();
        }
      }
    }
    return true;
  },

  update(dt = 1) {
    let addPoints = 1;
    if (typeof dt === "number" && !isNaN(dt) && dt > 0) {
      addPoints = dt < 0.2 ? (dt * 60) : dt;
    }

    let hasRechargedAny = false;

    const processRecharge = (arr) => {
      if (!arr || !Array.isArray(arr)) return;
      for (let item of arr) {
        if (item && item.name === "GLOW_BATTERY_EMPTY") {
          if (item.rechargeTime === undefined) item.rechargeTime = 0;
          item.rechargeTime += addPoints;
          if (item.rechargeTime >= this.REGEN_TIME) {
            // Convert to GLOW_BATTERY
            item.name = "GLOW_BATTERY";
            item.label = window.Language ? (window.Language.current === "en" ? "Glowing Battery Rod" : "หินเรืองแสงอัดแท่ง(แบต)") : "GLOW_BATTERY";
            item.icon = "🔋";
            delete item.rechargeTime;
            hasRechargedAny = true;
          }
        }
      }
    };

    processRecharge(typeof inventory !== "undefined" ? inventory : []);
    processRecharge(typeof actionSlotsItems !== "undefined" ? actionSlotsItems : []);

    if (hasRechargedAny) {
      if (typeof window.mergeInventory === "function") window.mergeInventory(); // group stacked items back together

      if (typeof showNotice === "function") {
        showNotice("⚡ แบตเตอรี่หินเรืองแสงรีเจนพลังงานเต็ม 100% แล้ว! (Battery Fully Recharged)");
      }
      if (typeof renderInventory === "function" && document.getElementById("inventoryOverlay")?.classList.contains("open")) {
        renderInventory();
      }
    }
  },

  showEmptyNotice() {
    const now = Date.now();
    if (now - this._lastNoticeTime > 3500) {
      this._lastNoticeTime = now;
      const total = this.getTotalBatteryCount();
      if (total === 0) {
        if (typeof showNotice === "function") {
          showNotice("⚠️ เครื่องยนต์ไฟฟ้าต้องการไอเทม [หินเรืองแสงอัดแท่ง(แบต)] ในกระเป๋าเพื่อทำงาน!");
        }
      } else {
        const stats = this.getStats();
        if (stats.minRechargeTimeRemaining > 0) {
          const remSec = Math.ceil(stats.minRechargeTimeRemaining);
          const mins = Math.floor(remSec / 60);
          const secs = remSec % 60;
          const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
          if (typeof showNotice === "function") {
            showNotice(`🔋 แบตเตอรี่กำลังรีเจนพลังงาน... เหลืออีก ${timeStr} นาที (รอรีเจนครบ 5 นาที)`);
          }
        }
      }
    }
  },

  exportState() {
    return {
      activeCharge: this.activeCharge
    };
  },

  importState(data) {
    if (data && typeof data === "object") {
      if (typeof data.activeCharge === "number") {
        this.activeCharge = data.activeCharge;
      } else if (Array.isArray(data)) { // Support old save format
        const active = data.find(b => !b.isRecharging && b.charge > 0);
        this.activeCharge = active ? active.charge : this.MAX_CHARGE;
      }
    }
  }
};

window.buildGlowBatteryIconModel = function(name, item, rawVertices, rawColors, rawIndices) {
  let fillPercent = 0;
  if (name === "GLOW_BATTERY") {
    if (window.BatterySystem) {
      const stats = window.BatterySystem.getStats();
      fillPercent = (stats.activeBattery && stats.activeBattery.charge) ? (stats.activeBattery.charge / window.BatterySystem.MAX_CHARGE) * 100 : 100;
    } else {
      fillPercent = 100;
    }
  } else {
    // Empty battery is recharging
    if (item && typeof item.rechargeTime === "number" && window.BatterySystem) {
      fillPercent = (item.rechargeTime / window.BatterySystem.REGEN_TIME) * 100;
    } else {
      fillPercent = 0;
    }
  }

  const isLow = fillPercent <= 20;
  const fullColor = isLow ? [0.88, 0.1, 0.1] : [0.22, 0.95, 0.88];
  const emptyColor = [0.3, 0.3, 0.3];

  const totalHeight = 0.64;
  const fillHeight = totalHeight * (fillPercent / 100);

  // Empty part (top)
  if (fillPercent < 100) {
    const emptyBot = -0.32 + fillHeight;
    buildTaperedSegment([0, emptyBot, 0], [0, 0.32, 0], 0.13, 0.13, 4, emptyColor, rawVertices, rawColors, rawIndices, true);
  }
  // Filled part (bottom)
  if (fillPercent > 0) {
    const fillTop = -0.32 + fillHeight;
    buildTaperedSegment([0, -0.32, 0], [0, fillTop, 0], 0.13, 0.13, 4, fullColor, rawVertices, rawColors, rawIndices, true);
  }
};

window.buildGlowBatteryHandModel = function(heldItem, wHandleP1, wHandleP2, itemScale, rawV, rawC, rawI) {
  let fillPercent = 0;
  if (heldItem && heldItem.name === "GLOW_BATTERY") {
    if (window.BatterySystem) {
      const stats = window.BatterySystem.getStats();
      fillPercent = (stats.activeBattery && stats.activeBattery.charge) ? (stats.activeBattery.charge / window.BatterySystem.MAX_CHARGE) * 100 : 100;
    } else {
      fillPercent = 100;
    }
  } else {
    if (heldItem && heldItem.rechargeTime !== undefined && window.BatterySystem) {
      fillPercent = (heldItem.rechargeTime / window.BatterySystem.REGEN_TIME) * 100;
    } else {
      fillPercent = 0;
    }
  }

  const isLow = fillPercent <= 20;
  const batteryColor = isLow ? [0.88, 0.1, 0.1] : [0.22, 0.95, 0.88];
  const emptyColor = [0.3, 0.3, 0.3];

  const startT = 0.05;
  const endT = 0.95;
  const fillT = startT + (endT - startT) * (fillPercent / 100);

  const rodP1 = [
    wHandleP1[0] + (wHandleP2[0] - wHandleP1[0]) * startT,
    wHandleP1[1] + (wHandleP2[1] - wHandleP1[1]) * startT,
    wHandleP1[2] + (wHandleP2[2] - wHandleP1[2]) * startT
  ];
  const rodFillEnd = [
    wHandleP1[0] + (wHandleP2[0] - wHandleP1[0]) * fillT,
    wHandleP1[1] + (wHandleP2[1] - wHandleP1[1]) * fillT,
    wHandleP1[2] + (wHandleP2[2] - wHandleP1[2]) * fillT
  ];
  const rodP2 = [
    wHandleP1[0] + (wHandleP2[0] - wHandleP1[0]) * endT,
    wHandleP1[1] + (wHandleP2[1] - wHandleP1[1]) * endT,
    wHandleP1[2] + (wHandleP2[2] - wHandleP1[2]) * endT
  ];

  if (fillPercent > 0) {
    buildTaperedSegment(rodP1, rodFillEnd, 0.022 * itemScale, 0.022 * itemScale, 4, batteryColor, rawV, rawC, rawI, true);
  }
  if (fillPercent < 100) {
    buildTaperedSegment(rodFillEnd, rodP2, 0.022 * itemScale, 0.022 * itemScale, 4, emptyColor, rawV, rawC, rawI, true);
  }
};

window.ItemRegistry["glow_battery"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const typeName = (item && (item.name === "GLOW_BATTERY_EMPTY" || item.type === "glow_battery_empty"))
      ? "GLOW_BATTERY_EMPTY"
      : "GLOW_BATTERY";

    let fillPercent = 0;
    if (typeName === "GLOW_BATTERY") {
      if (window.BatterySystem) {
        const stats = window.BatterySystem.getStats();
        fillPercent = (stats.activeBattery && stats.activeBattery.charge)
          ? (stats.activeBattery.charge / window.BatterySystem.MAX_CHARGE) * 100
          : 100;
      } else {
        fillPercent = 100;
      }
    } else if (item && window.BatterySystem) {
      const rTime = (typeof item.rechargeTime === "number")
        ? item.rechargeTime
        : (typeof item.dropRechargeTime === "number" ? item.dropRechargeTime : null);
      if (rTime !== null) {
        fillPercent = (rTime / window.BatterySystem.REGEN_TIME) * 100;
      }
    }

    const clampedPct = Math.max(0, Math.min(100, fillPercent));
    const isLow = clampedPct <= 20;
    const pctBucket = Math.round(clampedPct / 5) * 5;
    const key = `glow_battery_${pctBucket}_${isLow ? "low" : "ok"}`;

    const isIcon = (targetBuffer === "preview" || !!(item && item.isIconPreview) || !(item && item.position));
    const p = isIcon ? [0, 0, 0] : item.position;
    const r = (item && item.R) ? item.R : [1, 0, 0];
    const n = (item && item.normal) ? item.normal : [0, 1, 0];
    const f = (item && item.F) ? item.F : [0, 0, 1];
    const rawS = (item && typeof item.size === "number") ? item.size : 0.065;
    const s = isIcon ? 1.0 : Math.min(rawS, 0.078);
    const yOff = isIcon ? 0.0 : 0.32;
    const seed = (item && typeof item.seed === "number") ? item.seed : 0;
    const basis = isIcon ? { R: r, F: f } : window.DropTemplateCache.rotateBasis(r, f, (seed * 6.28318) % (Math.PI * 2));

    window.DropTemplateCache.render(
      key,
      { position: p, R: basis.R, normal: n, F: basis.F, scale: s, yOff: yOff },
      (tv, tc, ti) => {
        const fullColor = isLow ? [0.88, 0.1, 0.1] : [0.22, 0.95, 0.88];
        const emptyColor = [0.3, 0.3, 0.3];
        const totalHeight = 0.64;
        const fillHeight = totalHeight * (pctBucket / 100);

        if (pctBucket < 100) {
          const emptyBot = -0.32 + fillHeight;
          buildTaperedSegment([0, emptyBot, 0], [0, 0.32, 0], 0.13, 0.13, 4, emptyColor, tv, tc, ti, true);
        }
        if (pctBucket > 0) {
          const fillTop = -0.32 + fillHeight;
          buildTaperedSegment([0, -0.32, 0], [0, fillTop, 0], 0.13, 0.13, 4, fullColor, tv, tc, ti, true);
        }
      },
      vertices, colors, indices
    );
  }
};
window.ItemRegistry["GLOW_BATTERY"] = window.ItemRegistry["glow_battery"];
window.ItemRegistry["glow_battery_empty"] = window.ItemRegistry["glow_battery"];
window.ItemRegistry["GLOW_BATTERY_EMPTY"] = window.ItemRegistry["glow_battery"];
