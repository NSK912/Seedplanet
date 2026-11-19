// === SEEDPLANET MODULE: JS/INVENTORY.JS ===

      // ============================================
      // ระบบกระเป๋า (Inventory System)
      // ============================================
      const TOTAL_SLOTS = 20;
      const UNLOCKED_SLOTS = TOTAL_SLOTS;
      const MAX_STACK_PER_SLOT = 30;
      window.TOTAL_SLOTS = TOTAL_SLOTS;
      window.UNLOCKED_SLOTS = UNLOCKED_SLOTS;
      window.MAX_STACK_PER_SLOT = MAX_STACK_PER_SLOT;

      function createDefaultEquipSlotsItems() {
        return [
          { name: "WHITE_SHIRT_SHORT", icon: "👔", label: "WHITE_SHIRT_SHORT", count: 1 },
          { name: "BLACK_PLEATED_SKIRT", icon: "👗", label: "BLACK_PLEATED_SKIRT", count: 1 },
          { name: "TRAVELER_BOOTS", icon: "🥾", label: "TRAVELER_BOOTS", count: 1 },
          { name: "TRAVELER_HOODIE", icon: "🧥", label: "TRAVELER_HOODIE", count: 1 },
          { name: "BLACK_LEGGINGS", icon: "👖", label: "BLACK_LEGGINGS", count: 1 }
        ];
      }
      window.createDefaultEquipSlotsItems = createDefaultEquipSlotsItems;

      let inventory = [];
      for (let i = 0; i < TOTAL_SLOTS; i++) {
        inventory.push(null);
      }
      let actionSlotsItems = new Array(8).fill(null);
      let equipSlotsItems = createDefaultEquipSlotsItems();
      let isMoveModeEnabled = false;
      let selectedActionSlotIndex = -1;
      window.inventory = inventory;
      window.actionSlotsItems = actionSlotsItems;
      window.equipSlotsItems = equipSlotsItems;

      // ============================================
      // ระบบพลังงานแบตเตอรี่หินเรืองแสง (Glow Battery Energy Points System)
      // ============================================
      // ใช้ระบบแต้มพลังงาน (Energy Points) เช่นเดียวกับระบบแต้ม HP ของผู้เล่น
      // ความจุเต็ม = 72,000 แต้ม (ใช้งานขับขี่ได้เต็ม 20 นาที ที่ 60 ticks/วินาที)
      // แต้มรีเจนเต็ม = 18,000 แต้ม (ใช้เวลารีเจน 5 นาที ที่ 60 ticks/วินาที)
      // แบตเตอรี่ที่หมดพลังงาน = รอรีเจนสะสมแต้มจนเต็ม 18,000 แต้ม แล้วจะกลับมา 72,000 แต้มพร้อมใช้งาน
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

      const ALL_ITEMS = [
        { name: "ROCK", icon: "🪨" },
        { name: "BIG_ROCK", icon: "🪨" },
        { name: "DIRT", icon: "🟫" },
        { name: "IRON_ORE", icon: "🟥" },
        { name: "GOLD_ORE", icon: "🪙" },
        { name: "GLOW_ORE", icon: "✨" },
        { name: "GLOW_BATTERY", icon: "🔋" },
        { name: "GLOW_BATTERY_EMPTY", icon: "🪫" },
        { name: "BRANCH", icon: "🌿" },
        { name: "TANTO", icon: "🗡️" },
        { name: "AXE", icon: "🪓" },
        { name: "PICKAXE", icon: "⛏️" },
        { name: "AEGIS_SHIFT", icon: "⛏️⚔️" },
        { name: "LOG", icon: "🪵" },
        { name: "BOW", icon: "🏹" },
        { name: "ARROW", icon: "🏹" },
        { name: "IRON_BULLET", icon: "⚪" },
        { name: "WOODEN_ARM_CANNON", icon: "🪵🦾" },
        { name: "WOOD_FLOOR", icon: "🪵" },
        { name: "THIN_WOOD_FLOOR", icon: "🪵" },
        { name: "STONE_FLOOR", icon: "🪨" },
        { name: "WOOD_STAIRS", icon: "🪜" },
        { name: "FOLDING_LADDER", icon: "🪜" },
        { name: "CAMPFIRE", icon: "🔥" },
        { name: "WOOD_BOAT", icon: "🛶" },
        { name: "WOOD_WHEEL", icon: "🛞" },
        { name: "BOAT_WING", icon: "🪽" },
        { name: "ELECTRIC_ENGINE", icon: "🔋" },
        { name: "WOOD_WALL", icon: "🧱" },
        { name: "WOOD_WINDOW", icon: "🪟" },
        { name: "WOOD_DOOR", icon: "🚪" },
        { name: "WOOD_ROOF", icon: "🛖" },
        { name: "WOOD_CHEST", icon: "📦" },
        { name: "WOOD_BED", icon: "🛏️" },
        { name: "WOOD_TABLE", icon: "🪑" },
        { name: "WOOD_PLANTER_BOX", icon: "🪴" },
        { name: "WOOD_CHAIR", icon: "🪑" },
        { name: "LANTERN", icon: "🏮" },
        { name: "MEGANEURA", icon: "🦟" },
        { name: "ISOPOD", icon: "🦐" },
        { name: "FRIED_BUG", icon: "🍤" },
        { name: "DRAGON_FRUIT", icon: "🐉" },
        { name: "COTTON_PLANT", icon: "☁️" },
        { name: "CROWN_FLOWER", icon: "💮" },
        { name: "GRASS", icon: "🌱" },
        { name: "CLOTH", icon: "⬜" },
        { name: "RUBBER_BLOCK", icon: "⬛" },
        { name: "TOUGH_MEAT", icon: "🥩" },
        { name: "LEATHER", icon: "🟫" },
        { name: "SHOVEL", icon: "🥄" },
        { name: "IRON_BUCKET", icon: "🪣" },
        { name: "WATER_BUCKET", icon: "🪣💧" },
        { name: "ROBOT_STAND", icon: "🏗️" },
        { name: "ROBOT_COCKPIT", icon: "🤖" },
        { name: "ROBOT_LEFT_ARM", icon: "🦾" },
        { name: "ROBOT_RIGHT_ARM", icon: "🦾" },
        { name: "ROBOT_LEFT_LEG", icon: "🦿" },
        { name: "ROBOT_RIGHT_LEG", icon: "🦿" },
        { name: "OBSIDIAN_CUBE", icon: "🔶" },
        { name: "OBSIDIAN_PAD_WARP", icon: "🧭" },
        { name: "OBSIDIAN_FLUX", icon: "⚫" },
        { name: "WHITE_BODYSUIT_TOP", icon: "👕" },
        { name: "WHITE_BODYSUIT_SHORTS", icon: "🩳" },
        { name: "TRAVELER_HOODIE", icon: "🧥" },
        { name: "TRAVELER_BOOTS", icon: "🥾" },
        { name: "OXFORD_SHOES", icon: "👞" },
        { name: "DRESS_BOOTS", icon: "🥾" },
        { name: "WHITE_SHIRT_SHORT", icon: "👔" },
        { name: "BLACK_PLEATED_SKIRT", icon: "👗" },
        { name: "BLACK_LEGGINGS", icon: "👖" },
        { name: "DOUBLE_BREASTED_SUIT", icon: "🧥" },
        { name: "BLACK_SLACKS", icon: "👖" },
        { name: "OPERA_CAPE", icon: "🧛" },
      ];

      const icon3DCache = new Map();

      function create3DIconCanvas(item, width, height, options = null) {
        if (!item) return null;
        const isInteractivePreview = !!(options && options.interactivePreview);
        let name = "";
        if (typeof item === "string") {
          name = item.toUpperCase();
        } else if (item && item.name) {
          name = item.name.toUpperCase();
        } else if (item && item.type) {
          name = item.type.toUpperCase();
        }
        if (name === "CHEST") name = "WOOD_CHEST";
        if (name === "MEGANEURA_ITEM") name = "MEGANEURA";
        if (name === "ISOPOD_ITEM") name = "ISOPOD";
        if (name === "BASE") name = "WOOD_WALL";
        if (!name) return null;

        const dpr = window.devicePixelRatio || 1;
        
        let stateKey = "";
        if (name === "GLOW_BATTERY") {
           if (window.BatterySystem) {
             const stats = window.BatterySystem.getStats();
             const pct = (stats.activeBattery && stats.activeBattery.charge) ? Math.floor((stats.activeBattery.charge / window.BatterySystem.MAX_CHARGE) * 100) : 100;
             stateKey = `_${pct}`;
           }
        } else if (name === "GLOW_BATTERY_EMPTY") {
           if (item && typeof item.rechargeTime === "number" && window.BatterySystem) {
             const pct = Math.floor((item.rechargeTime / window.BatterySystem.REGEN_TIME) * 100);
             stateKey = `_${pct}`;
           }
        } else if (name === "IRON_BUCKET") {
           stateKey = "_empty";
        } else if (name === "WATER_BUCKET") {
           stateKey = "_water";
        }

        const cacheKey = `${name}_${width}_${height}_${dpr}${stateKey}`;
        
        if (!isInteractivePreview && icon3DCache.has(cacheKey)) {
          const cachedSrc = icon3DCache.get(cacheKey);
          const img = document.createElement("img");
          img.src = cachedSrc;
          img.style.width = width + "px";
          img.style.height = height + "px";
          img.style.display = "block";
          img.style.margin = "0 auto";
          return img;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        canvas.style.display = "block";
        canvas.style.background = "transparent";
        canvas.style.margin = "0 auto";
        
        const rawVertices = [];
        const rawColors = [];
        const rawIndices = [];
        
        let scaleFactor = 1.0;
        let yOffset = 0.0;
        
        const p = [0, 0, 0];
        const r = [1, 0, 0];
        const f = [0, 0, 1];
        const n = [0, 1, 0];
        
        function buildSphereMesh(center, radius, segsLat, segsLong, color, vertices, colors, indices) {
          const startIdx = vertices.length / 3;
          for (let lat = 0; lat <= segsLat; lat++) {
            const theta = (lat / segsLat) * Math.PI;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let lon = 0; lon <= segsLong; lon++) {
              const phi = (lon / segsLong) * Math.PI * 2;
              const sinPhi = Math.sin(phi);
              const cosPhi = Math.cos(phi);

              const dx = sinTheta * cosPhi;
              const dy = cosTheta;
              const dz = sinTheta * sinPhi;

              vertices.push(center[0] + radius * dx, center[1] + radius * dy, center[2] + radius * dz);

              // Subtle forged-metal facet variation so rotation around Y is clearly visible
              const facetTone = 0.92 + 0.08 * Math.cos(phi * 2.0 + theta * 1.5);

              colors.push(
                Math.min(1.0, color[0] * facetTone),
                Math.min(1.0, color[1] * facetTone),
                Math.min(1.0, color[2] * facetTone)
              );
            }
          }

          for (let lat = 0; lat < segsLat; lat++) {
            for (let lon = 0; lon < segsLong; lon++) {
              const first = startIdx + lat * (segsLong + 1) + lon;
              const second = first + segsLong + 1;
              indices.push(first, second, first + 1);
              indices.push(second, second + 1, first + 1);
            }
          }
        }

        let isRegistryRendered = false;
        const isExcluded = (name === "IRON_ORE" || name === "GOLD_ORE" || name === "GLOW_ORE" || name === "GLOW_BATTERY" || name === "GLOW_BATTERY_EMPTY" || name === "FRIED_BUG" || name === "IRON_BULLET");
        let registryKey = name.toLowerCase();
        if (registryKey === "meganeura") registryKey = "meganeura_item";
        if (registryKey === "isopod") registryKey = "isopod_item";
        if (registryKey === "obsidian_cube") registryKey = "obsidian_cube_item";
        if (registryKey === "obsidian_pad_warp" || registryKey === "obsidian_compass_pad") registryKey = "obsidian_pad_warp_item";
        if (registryKey === "obsidian_flux" || registryKey === "obsidian_flux") registryKey = "obsidian_flux_item";

        const handler = !isExcluded && window.ItemRegistry && window.ItemRegistry[registryKey];
        if (handler && typeof handler.render === "function") {
          // Guard and override fallback globals (temporarily force context to preview-safe values)
          const savedGlobals = {};
          const globalsToGuard = {
            getHeightOnSphere: (theta, phi, seed) => 0,
            globalSeed: 12345,
            RADIUS: 0.0, // Force to 0.0 so stone floor support legs don't get clamped underground
            HEIGHT_SCALE: 1.0,
            waterLevel: 0.0,
            waterEnabled: false,
            playerScale: 0.1,
            waterRadius: 10.0,
            collectibles: []
          };
          for (let key in globalsToGuard) {
            savedGlobals[key] = window[key];
            window[key] = globalsToGuard[key];
          }

          const mockItem = {
            position: [0, 0, 0],
            R: [1, 0, 0],
            F: [0, 0, 1],
            normal: [0, 1, 0],
            size: 0.25,
            seed: 123.45,
            color: [0.65, 0.45, 0.25],
            type: registryKey,
            isPreview: false,
            isValidPlacement: true,
            angle: 0
          };

          // Customize properties for beautiful UI framing (natural sizes)
          if (name === "ROCK") {
            scaleFactor = 1.35;
            mockItem.size = 0.33;
            mockItem.color = [0.55, 0.55, 0.55];
          } else if (name === "BIG_ROCK") {
            scaleFactor = 1.0;
            mockItem.size = 0.4;
            mockItem.color = [0.5, 0.5, 0.5];
            mockItem.seed = 678.9;
          } else if (name === "DIRT") {
            scaleFactor = 1.35;
            mockItem.size = 0.33;
            mockItem.color = [0.46, 0.30, 0.16];
            mockItem.seed = 444.44;
          } else if (name === "BRANCH") {
            scaleFactor = 1.4;
            mockItem.size = 0.45;
            mockItem.color = [0.45, 0.3, 0.15];
            mockItem.seed = 0;
          } else if (name === "LOG") {
            scaleFactor = 1.25;
            mockItem.size = 0.5;
            mockItem.color = [0.45, 0.3, 0.15];
            mockItem.seed = 0;
          } else if (name === "AXE") {
            scaleFactor = 1.2;
            mockItem.size = 0.5;
            mockItem.seed = 0;
          } else if (name === "PICKAXE") {
            scaleFactor = 1.2;
            mockItem.size = 0.5;
            mockItem.seed = 0;
          } else if (name === "ARROW") {
            scaleFactor = 1.35;
          } else if (name === "WOOD_FLOOR" || name === "THIN_WOOD_FLOOR") {
            scaleFactor = 1.1;
            mockItem.size = 0.75;
          } else if (name === "STONE_FLOOR") {
            scaleFactor = 1.1;
            mockItem.size = 0.08;
            mockItem.width = 0.75;
            mockItem.depth = 0.75;
            mockItem.isIconPreview = true;
          } else if (name === "WOOD_STAIRS" || name === "FOLDING_LADDER") {
            scaleFactor = 1.05;
            mockItem.type = name === "FOLDING_LADDER" ? "folding_ladder" : "wood_stairs";
            mockItem.stairTop = [-0.175, 0.175, -0.175];
            mockItem.stairBottom = [0.175, -0.175, 0.175];
          } else if (name === "WOOD_WALL" || name === "WOOD_WINDOW") {
            scaleFactor = 1.05;
            mockItem.type = name === "WOOD_WINDOW" ? "wood_window" : "wood_wall";
          } else if (name === "WOOD_DOOR") {
            scaleFactor = 1.05;
          } else if (name === "WOOD_ROOF") {
            scaleFactor = 1.05;
            mockItem.type = "wood_roof";
            mockItem.size = 0.25;
            mockItem.angle = 0.0;
          } else if (name === "WOOD_CHEST" || name === "WOOD_BED" || name === "WOOD_PLANTER_BOX") {
            scaleFactor = 1.1;
            mockItem.type = name.toLowerCase();
          } else if (name === "CAMPFIRE") {
            scaleFactor = 1.15;
          } else if (name === "WOOD_BOAT") {
            scaleFactor = 1.05;
          } else if (name === "WOOD_WHEEL") {
            scaleFactor = 1.2;
          } else if (name === "BOAT_WING") {
            scaleFactor = 1.35;
          } else if (name === "MEGANEURA") {
            scaleFactor = 2.5;
            mockItem.seed = 1234;
          } else if (name === "ISOPOD") {
            scaleFactor = 2.0;
            mockItem.seed = 1234;
          } else if (name === "OBSIDIAN_FLUX" || name === "OBSIDIAN_FLUX") {
            scaleFactor = 1.05;
            mockItem.isIconPreview = true;
          } else if (name === "COTTON_PLANT") {
            scaleFactor = 1.25;
            mockItem.seed = 98765;
          } else if (name === "CROWN_FLOWER") {
            scaleFactor = 1.25;
            mockItem.seed = 98765;
          } else if (name === "GRASS") {
            scaleFactor = 1.25;
            mockItem.color = [0.13, 0.65, 0.15];
            mockItem.botColor = [0.13 * 0.35, 0.65 * 0.42, 0.15 * 0.35];
            mockItem.isIconPreview = true;
          } else if (name === "CLOTH") {
            scaleFactor = 1.25;
            mockItem.isIconPreview = true;
          } else if (name === "RUBBER_BLOCK") {
            scaleFactor = 1.25;
            mockItem.isIconPreview = true;
          } else if (name === "TOUGH_MEAT") {
            scaleFactor = 1.25;
            mockItem.isIconPreview = true;
          } else if (name === "LEATHER" || name === "HIDE") {
            scaleFactor = 1.25;
            mockItem.isIconPreview = true;
          } else if (name === "IRON_BUCKET") {
            scaleFactor = 1.25;
            mockItem.hasWater = false;
          } else if (name === "WATER_BUCKET") {
            scaleFactor = 1.25;
            mockItem.hasWater = true;
          } else if (name === "TANTO") {
            scaleFactor = 1.25;
            mockItem.size = 0.5;
            mockItem.isIconPreview = true;
          } else if (name === "AEGIS_SHIFT") {
            scaleFactor = 1.22;
            mockItem.size = 0.5;
            mockItem.isIconPreview = true;
          }

          try {
            handler.render(mockItem, rawVertices, rawColors, rawIndices, 'preview');
            isRegistryRendered = true;
          } catch (err) {
            console.error("Error rendering item from registry:", name, err);
          }

          // Restore guarded globals safely to original state
          for (let key in savedGlobals) {
            if (savedGlobals[key] === undefined) {
              delete window[key];
            } else {
              window[key] = savedGlobals[key];
            }
          }
        }

        if (!isRegistryRendered) {
          if (name === "ROCK") {
            scaleFactor = 1.35;
            buildRockFormation(p, 0.5, [0.55, 0.55, 0.55], 123.45, rawVertices, rawColors, rawIndices);
          } else if (name === "BIG_ROCK") {
            scaleFactor = 1.0;
            buildRockFormation(p, 0.8, [0.5, 0.5, 0.5], 678.9, rawVertices, rawColors, rawIndices);
          } else if (name === "DIRT") {
            scaleFactor = 1.35;
            buildRockFormation(p, 0.5, [0.46, 0.30, 0.16], 444.44, rawVertices, rawColors, rawIndices);
          } else if (name === "IRON_ORE") {
            scaleFactor = 1.35;
            buildRockFormation(p, 0.55, [0.45, 0.22, 0.18], 111.11, rawVertices, rawColors, rawIndices);
          } else if (name === "GOLD_ORE") {
            scaleFactor = 1.35;
            buildRockFormation(p, 0.55, [0.85, 0.68, 0.12], 222.22, rawVertices, rawColors, rawIndices);
          } else if (name === "GLOW_ORE") {
            scaleFactor = 1.35;
            buildRockFormation(p, 0.55, [0.22, 0.95, 0.88], 333.33, rawVertices, rawColors, rawIndices);
          } else if (name === "GLOW_BATTERY" || name === "GLOW_BATTERY_EMPTY") {
            scaleFactor = 1.35;
            
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
          } else if (name === "BRANCH") {
            scaleFactor = 1.4;
            buildTaperedSegment([-0.35, -0.1, 0], [0.35, 0.1, 0], 0.04, 0.02, 5, [0.45, 0.3, 0.15], rawVertices, rawColors, rawIndices);
          } else if (name === "LOG") {
            scaleFactor = 1.25;
            buildTaperedSegment([-0.4, 0, 0], [0.4, 0, 0], 0.15, 0.13, 6, [0.45, 0.3, 0.15], rawVertices, rawColors, rawIndices, true);
          } else if (name === "AXE") {
            scaleFactor = 1.2;
            buildTaperedSegment([0, -0.4, 0], [0, 0.3, 0], 0.03, 0.03, 5, [0.4, 0.25, 0.15], rawVertices, rawColors, rawIndices);
            buildTaperedSegment([-0.1, 0.15, 0], [0.25, 0.15, 0], 0.06, 0.015, 4, [0.6, 0.6, 0.6], rawVertices, rawColors, rawIndices);
          } else if (name === "PICKAXE") {
            scaleFactor = 1.2;
            buildTaperedSegment([0, -0.4, 0], [0, 0.3, 0], 0.03, 0.03, 5, [0.4, 0.25, 0.15], rawVertices, rawColors, rawIndices);
            buildTaperedSegment([-0.25, 0.15, 0], [0, 0.15, 0], 0.05, 0.01, 4, [0.6, 0.6, 0.6], rawVertices, rawColors, rawIndices);
            buildTaperedSegment([0, 0.15, 0], [0.25, 0.15, 0], 0.05, 0.01, 4, [0.6, 0.6, 0.6], rawVertices, rawColors, rawIndices);
          } else if (name === "SHOVEL") {
            scaleFactor = 1.25;
            // Shovel Handle: brown stick
            buildTaperedSegment([0, -0.3, 0], [0, 0.18, 0], 0.02, 0.02, 5, [0.4, 0.25, 0.15], rawVertices, rawColors, rawIndices);
            
            // Shovel Blade (scoop): silver gray, continuous at the end of the handle!
            // Socket
            buildTaperedSegment([0, 0.18, 0], [0, 0.22, 0], 0.025, 0.025, 5, [0.55, 0.55, 0.55], rawVertices, rawColors, rawIndices);
            // Scoop body
            buildTaperedSegment([0, 0.22, 0], [0, 0.38, 0], 0.07, 0.065, 5, [0.65, 0.65, 0.65], rawVertices, rawColors, rawIndices);
            // Scoop tip (pointy)
            buildTaperedSegment([0, 0.38, 0], [0, 0.46, 0], 0.065, 0.01, 5, [0.6, 0.6, 0.6], rawVertices, rawColors, rawIndices);
            
            // Shovel D-Handle at the back: Y = -0.3
            const partsColor = [0.25, 0.25, 0.25]; // Dark charcoal
            // Stem of D-handle
            buildTaperedSegment([0, -0.3, 0], [0, -0.35, 0], 0.02, 0.02, 5, partsColor, rawVertices, rawColors, rawIndices);
            // Left loop arm
            buildTaperedSegment([0, -0.35, 0], [-0.05, -0.42, 0], 0.015, 0.015, 4, partsColor, rawVertices, rawColors, rawIndices);
            // Right loop arm
            buildTaperedSegment([0, -0.35, 0], [0.05, -0.42, 0], 0.015, 0.015, 4, partsColor, rawVertices, rawColors, rawIndices);
            // Horizontal grip
            buildTaperedSegment([-0.05, -0.42, 0], [0.05, -0.42, 0], 0.016, 0.016, 5, partsColor, rawVertices, rawColors, rawIndices);
          } else if (name === "IRON_BUCKET" || name === "WATER_BUCKET") {
            scaleFactor = 1.25;
            if (typeof window.buildIronBucketModel === "function") {
              window.buildIronBucketModel(0.55, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], rawVertices, rawColors, rawIndices, name === "WATER_BUCKET");
            } else {
              buildTaperedSegment([0, -0.20, 0], [0, 0.16, 0], 0.14, 0.20, 8, [0.64, 0.68, 0.74], rawVertices, rawColors, rawIndices, true);
              buildTaperedSegment([-0.20, 0.16, 0], [-0.12, 0.32, 0], 0.014, 0.014, 5, [0.45, 0.48, 0.52], rawVertices, rawColors, rawIndices);
              buildTaperedSegment([-0.12, 0.32, 0], [0.12, 0.32, 0], 0.018, 0.018, 5, [0.42, 0.28, 0.16], rawVertices, rawColors, rawIndices);
              buildTaperedSegment([0.12, 0.32, 0], [0.20, 0.16, 0], 0.014, 0.014, 5, [0.45, 0.48, 0.52], rawVertices, rawColors, rawIndices);
            }
          } else if (name === "TANTO") {
            scaleFactor = 1.25;
            if (typeof window.buildTantoModel === "function") {
              window.buildTantoModel(1.0, [0, 0, 0], [0.37, 0.93, 0], [0.93, -0.37, 0], [0, 0, 1], rawVertices, rawColors, rawIndices);
            } else {
              buildTaperedSegment([0, -0.35, 0], [0, -0.05, 0], 0.03, 0.03, 5, [0.14, 0.15, 0.18], rawVertices, rawColors, rawIndices);
              buildTaperedSegment([0, -0.05, 0], [0, 0.40, 0], 0.035, 0.005, 4, [0.22, 0.95, 0.88], rawVertices, rawColors, rawIndices);
            }
          } else if (name === "AEGIS_SHIFT") {
            scaleFactor = 1.22;
            if (typeof window.buildAegisShiftModel === "function") {
              window.buildAegisShiftModel(1.0, [0, 0, 0], [0.34, 0.94, 0], [0.94, -0.34, 0], [0, 0, 1], rawVertices, rawColors, rawIndices, "pickaxe");
            } else {
              buildTaperedSegment([0, -0.4, 0], [0, 0.3, 0], 0.03, 0.03, 5, [0.16, 0.18, 0.22], rawVertices, rawColors, rawIndices);
              buildTaperedSegment([-0.28, 0.22, 0], [0.28, 0.22, 0], 0.05, 0.01, 4, [0.20, 0.94, 0.92], rawVertices, rawColors, rawIndices);
            }
          } else if (name === "BOW") {
            scaleFactor = 1.25;
            const wGrip = [0, 0, 0];
            const wUpperTip = [0, 0.45, -0.05];
            const wLowerTip = [0, -0.45, -0.05];
            const wNock = [0, 0, -0.22];
            const bendMag = 0.08;
            const wUpperMid = [0, 0.225, bendMag];
            const wLowerMid = [0, -0.225, bendMag];
            buildTaperedSegment(wGrip, wUpperMid, 0.012, 0.009, 5, [0.55, 0.38, 0.22], rawVertices, rawColors, rawIndices);
            buildTaperedSegment(wUpperMid, wUpperTip, 0.009, 0.005, 5, [0.55, 0.38, 0.22], rawVertices, rawColors, rawIndices);
            buildTaperedSegment(wGrip, wLowerMid, 0.012, 0.009, 5, [0.55, 0.38, 0.22], rawVertices, rawColors, rawIndices);
            buildTaperedSegment(wLowerMid, wLowerTip, 0.009, 0.005, 5, [0.55, 0.38, 0.22], rawVertices, rawColors, rawIndices);
            buildTaperedSegment(wUpperTip, wNock, 0.002, 0.002, 4, [0.95, 0.95, 0.95], rawVertices, rawColors, rawIndices);
            buildTaperedSegment(wLowerTip, wNock, 0.002, 0.002, 4, [0.95, 0.95, 0.95], rawVertices, rawColors, rawIndices);
          } else if (name === "ARROW") {
            scaleFactor = 1.35;
            buildTaperedSegment([0, -0.3, 0], [0, 0.3, 0], 0.005, 0.005, 4, [0.55, 0.4, 0.25], rawVertices, rawColors, rawIndices);
            buildTaperedSegment([0, -0.3, 0], [0, -0.2, 0], 0.015, 0.006, 4, [0.9, 0.2, 0.2], rawVertices, rawColors, rawIndices);
            buildTaperedSegment([0, 0.3, 0], [0, 0.34, 0], 0.012, 0.001, 4, [0.35, 0.35, 0.35], rawVertices, rawColors, rawIndices);
          } else if (name === "IRON_BULLET") {
            scaleFactor = 1.35;
            const ironColor = [0.78, 0.81, 0.86];
            // Render a single clean, perfectly smooth round metallic bullet sphere
            buildSphereMesh([0, 0, 0], 0.26, 12, 16, ironColor, rawVertices, rawColors, rawIndices);
          } else if (name === "WOODEN_ARM_CANNON" || name === "ARM_CANNON") {
            scaleFactor = 1.2;
            const woodColor = [0.55, 0.38, 0.22];
            const woodDark = [0.42, 0.28, 0.15];
            const ironColor = [0.28, 0.28, 0.30];
            const boreColor = [0.10, 0.10, 0.10];
            // Rear to front cylinder
            buildTaperedSegment([0, -0.25, 0], [0, 0, 0], 0.09, 0.08, 6, woodColor, rawVertices, rawColors, rawIndices);
            buildTaperedSegment([0, 0, 0], [0, 0.28, 0], 0.08, 0.085, 6, woodDark, rawVertices, rawColors, rawIndices);
            // Iron bands
            buildTaperedSegment([0, -0.25, 0], [0, -0.21, 0], 0.096, 0.096, 6, ironColor, rawVertices, rawColors, rawIndices);
            buildTaperedSegment([0, -0.02, 0], [0, 0.02, 0], 0.088, 0.088, 6, ironColor, rawVertices, rawColors, rawIndices);
            buildTaperedSegment([0, 0.25, 0], [0, 0.28, 0], 0.092, 0.092, 6, ironColor, rawVertices, rawColors, rawIndices);
            // Muzzle bore
            buildTaperedSegment([0, 0.22, 0], [0, 0.28, 0], 0.05, 0.055, 6, boreColor, rawVertices, rawColors, rawIndices);
          } else if (name === "STONE_FLOOR") {
            scaleFactor = 1.1;
            addBox(p, 0.9, 0.1, 0.9, [0.6, 0.6, 0.6], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0.38, -0.2, 0.38], 0.12, 0.4, 0.12, [0.45, 0.45, 0.45], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0.38, -0.2, -0.38], 0.12, 0.4, 0.12, [0.45, 0.45, 0.45], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([-0.38, -0.2, 0.38], 0.12, 0.4, 0.12, [0.45, 0.45, 0.45], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([-0.38, -0.2, -0.38], 0.12, 0.4, 0.12, [0.45, 0.45, 0.45], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "WOOD_FLOOR" || name === "THIN_WOOD_FLOOR") {
            scaleFactor = 1.1;
            const th = (name === "THIN_WOOD_FLOOR") ? 0.05 : 0.15;
            addBox(p, 0.9, th, 0.9, [0.65, 0.45, 0.25], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0.38, -0.2, 0.38], 0.1, 0.4, 0.1, [0.5, 0.33, 0.17], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0.38, -0.2, -0.38], 0.1, 0.4, 0.1, [0.5, 0.33, 0.17], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([-0.38, -0.2, 0.38], 0.1, 0.4, 0.1, [0.5, 0.33, 0.17], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([-0.38, -0.2, -0.38], 0.1, 0.4, 0.1, [0.5, 0.33, 0.17], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "WOOD_STAIRS" || name === "FOLDING_LADDER") {
            scaleFactor = 1.05;
            const ladderCol = name === "FOLDING_LADDER" ? [0.4, 0.42, 0.45] : [0.65, 0.45, 0.25];
            addBox([0, -0.15, 0.15], 0.9, 0.15, 0.3, ladderCol, r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0, 0.0, 0.0], 0.9, 0.15, 0.3, [ladderCol[0]*0.85, ladderCol[1]*0.85, ladderCol[2]*0.85], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0, 0.15, -0.15], 0.9, 0.15, 0.3, [ladderCol[0]*0.7, ladderCol[1]*0.7, ladderCol[2]*0.7], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "WOOD_WALL") {
            scaleFactor = 1.05;
            addBox(p, 0.9, 0.9, 0.1, [0.65, 0.45, 0.25], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "WOOD_WINDOW") {
            scaleFactor = 1.05;
            addBox(p, 0.9, 0.9, 0.1, [0.65, 0.45, 0.25], r, n, f, rawVertices, rawColors, rawIndices);
            addBox(p, 0.6, 0.6, 0.04, [0.4, 0.75, 0.95], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "WOOD_DOOR") {
            scaleFactor = 1.05;
            addBox(p, 0.5, 0.9, 0.08, [0.65, 0.45, 0.25], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0.15, 0, 0.05], 0.05, 0.05, 0.03, [0.95, 0.8, 0.2], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "WOOD_ROOF") {
            scaleFactor = 1.05;
            addBox(p, 0.9, 0.08, 0.9, [0.65, 0.45, 0.25], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0, 0.15, 0.2], 0.92, 0.12, 0.5, [0.55, 0.38, 0.2], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "WOOD_CHEST") {
            scaleFactor = 1.1;
            addBox([0, -0.08, 0], 0.8, 0.45, 0.5, [0.5, 0.3, 0.15], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0, 0.2, 0], 0.8, 0.15, 0.5, [0.65, 0.45, 0.25], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0, 0.1, 0.26], 0.1, 0.1, 0.02, [0.85, 0.7, 0.25], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "WOOD_PLANTER_BOX") {
            scaleFactor = 1.15;
            if (typeof window.buildWoodPlanterBoxModel === "function") {
              window.buildWoodPlanterBoxModel({ position: [0, 0, 0], R: r, F: f, normal: n, customScale: 1.5 }, rawVertices, rawColors, rawIndices);
            } else {
              addBox([0, -0.05, 0], 0.76, 0.32, 0.56, [0.52, 0.35, 0.19], r, n, f, rawVertices, rawColors, rawIndices);
              addBox([0, 0.06, 0], 0.66, 0.14, 0.46, [0.33, 0.20, 0.10], r, n, f, rawVertices, rawColors, rawIndices);
            }
          } else if (name === "CAMPFIRE") {
            scaleFactor = 1.15;
            const numRocks = 8;
            const rockRadius = 0.28;
            for (let i = 0; i < numRocks; i++) {
              const angle = (i / numRocks) * Math.PI * 2;
              const rPos = [Math.cos(angle) * rockRadius, -0.15, Math.sin(angle) * rockRadius];
              const rSize = 0.08;
              const rCol = [0.42 + Math.sin(i)*0.05, 0.42 + Math.sin(i)*0.05, 0.42 + Math.sin(i)*0.05];
              addBox(rPos, rSize, rSize, rSize, rCol, r, n, f, rawVertices, rawColors, rawIndices);
            }
            const numLogs = 4;
            for (let i = 0; i < numLogs; i++) {
              const angle = (i / numLogs) * Math.PI;
              const cosA = Math.cos(angle), sinA = Math.sin(angle);
              const r_dir = [cosA, 0, sinA];
              const f_dir = [-sinA, 0, cosA];
              addBox([0, -0.08, 0], 0.5, 0.06, 0.06, [0.45, 0.3, 0.15], r_dir, n, f_dir, rawVertices, rawColors, rawIndices);
            }
            addBox([0, 0.02, 0], 0.12, 0.24, 0.12, [0.95, 0.45, 0.1], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([-0.04, 0.08, 0.04], 0.08, 0.3, 0.08, [0.95, 0.2, 0.1], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0.04, 0.05, -0.04], 0.1, 0.2, 0.1, [0.95, 0.8, 0.15], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "WOOD_BOAT") {
            scaleFactor = 1.05;
            addBox([0, -0.12, 0], 0.5, 0.08, 0.9, [0.55, 0.4, 0.25], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([-0.26, 0.05, 0], 0.04, 0.25, 0.9, [0.45, 0.3, 0.15], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0.26, 0.05, 0], 0.04, 0.25, 0.9, [0.45, 0.3, 0.15], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0, 0.05, 0.48], 0.42, 0.25, 0.08, [0.38, 0.26, 0.15], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0, -0.02, -0.08], 0.48, 0.04, 0.15, [0.65, 0.5, 0.35], r, n, f, rawVertices, rawColors, rawIndices);
          
          } else if (name === "FRIED_BUG") {
            buildFriedBugModel(
              1234,
              4.0,
              [0,0,0],
              r, n, f,
              rawVertices, rawColors, rawIndices
            );

          } else if (name === "MEGANEURA") {
            buildMeganeuraModel(
              1234,
              0,
              false,
              false,
              4.0,
              [0,0,0],
              r, n, f,
              rawVertices, rawColors, rawIndices
            );
          } else if (name === "ISOPOD") {
            if (typeof buildIsopodModel === "function") {
              buildIsopodModel(
                1234,
                0,
                false,
                false,
                2.5,
                [0,0,0],
                r, n, f,
                rawVertices, rawColors, rawIndices
              );
            }
          } else if (name === "WHITE_BODYSUIT_TOP") {
            if (typeof window.buildWhiteBodysuitTopIconMesh === "function") {
              window.buildWhiteBodysuitTopIconMesh(rawVertices, rawColors, rawIndices);
            }
          } else if (name === "WHITE_BODYSUIT_SHORTS") {
            if (typeof window.buildWhiteBodysuitShortsIconMesh === "function") {
              window.buildWhiteBodysuitShortsIconMesh(rawVertices, rawColors, rawIndices);
            }
          } else if (name === "TRAVELER_HOODIE") {
            if (typeof window.buildTravelerHoodieIconMesh === "function") {
              window.buildTravelerHoodieIconMesh(rawVertices, rawColors, rawIndices);
            }
          } else if (name === "TRAVELER_BOOTS") {
            if (typeof window.buildTravelerBootsIconMesh === "function") {
              window.buildTravelerBootsIconMesh(rawVertices, rawColors, rawIndices);
            }
          } else if (name === "OXFORD_SHOES") {
            if (typeof window.buildOxfordShoesIconMesh === "function") {
              window.buildOxfordShoesIconMesh(rawVertices, rawColors, rawIndices);
            }
          } else if (name === "DRESS_BOOTS") {
            if (typeof window.buildDressBootsIconMesh === "function") {
              window.buildDressBootsIconMesh(rawVertices, rawColors, rawIndices);
            }
          } else if (name === "WHITE_SHIRT_SHORT") {
            if (typeof window.buildWhiteShirtIconMesh === "function") {
              window.buildWhiteShirtIconMesh(rawVertices, rawColors, rawIndices);
            }
          } else if (name === "BLACK_PLEATED_SKIRT") {
            if (typeof window.buildBlackPleatedSkirtIconMesh === "function") {
              window.buildBlackPleatedSkirtIconMesh(rawVertices, rawColors, rawIndices);
            }
          } else if (name === "BLACK_LEGGINGS") {
            if (typeof window.buildBlackLeggingsIconMesh === "function") {
              window.buildBlackLeggingsIconMesh(rawVertices, rawColors, rawIndices);
            }
          } else if (name === "DOUBLE_BREASTED_SUIT") {
            if (typeof window.buildDoubleBreastedSuitIconMesh === "function") {
              window.buildDoubleBreastedSuitIconMesh(rawVertices, rawColors, rawIndices);
            }
          } else if (name === "BLACK_SLACKS") {
            if (typeof window.buildBlackSlacksIconMesh === "function") {
              window.buildBlackSlacksIconMesh(rawVertices, rawColors, rawIndices);
            }
          } else if (name === "OPERA_CAPE") {
            if (typeof window.buildOperaCapeIconMesh === "function") {
              window.buildOperaCapeIconMesh(rawVertices, rawColors, rawIndices);
            }
          } else {
            return null; // Return null if not a 3D item
          }
        }
        
        // Auto-center and auto-scale ALL generated 3D models to fit beautifully inside the inventory slot
        if (rawVertices.length > 0) {
          let minX = Infinity, maxX = -Infinity;
          let minY = Infinity, maxY = -Infinity;
          let minZ = Infinity, maxZ = -Infinity;
          
          for (let i = 0; i < rawVertices.length; i += 3) {
            const x = rawVertices[i];
            const y = rawVertices[i+1];
            const z = rawVertices[i+2];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
          }
          
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          const centerZ = (minZ + maxZ) / 2;
          
          const sizeX = maxX - minX;
          const sizeY = maxY - minY;
          const sizeZ = maxZ - minZ;
          const maxDim = Math.max(sizeX, sizeY, sizeZ);
          
          let targetSize = 0.80; // Standard size to occupy about 80% of the canvas height/width
          
          // Fine-tuned target sizes for select item layouts to make them look uniform and visually outstanding
          if (name === "ARROW" || name === "BRANCH") {
            targetSize = 0.75;
          } else if (name === "WOOD_FLOOR" || name === "THIN_WOOD_FLOOR" || name === "STONE_FLOOR") {
            targetSize = 0.85;
          } else if (name === "WOOD_BOAT") {
            targetSize = 0.90; // Give the boat maximum visibility inside the slot
          } else if (name === "BOAT_WING") {
            targetSize = 0.85;
          } else if (name === "WOOD_BED" || name === "WOOD_TABLE" || name === "WOOD_PLANTER_BOX") {
            targetSize = 0.85;
          } else if (name === "WOOD_CHAIR" || name === "LANTERN" || name === "IRON_BUCKET" || name === "WATER_BUCKET") {
            targetSize = 0.82;
          } else if (name === "TANTO" || name === "AEGIS_SHIFT") {
            targetSize = 0.88;
          } else if (name === "GRASS") {
            targetSize = 0.84;
          } else if (name === "CLOTH" || name === "RUBBER_BLOCK" || name === "TOUGH_MEAT" || name === "LEATHER" || name === "HIDE") {
            targetSize = 0.85;
          } else if (name === "IRON_BULLET") {
            targetSize = 0.68;
          } else if (name === "WHITE_BODYSUIT_TOP" || name === "WHITE_BODYSUIT_SHORTS" || name === "TRAVELER_HOODIE" || name === "TRAVELER_BOOTS" || name === "OXFORD_SHOES" || name === "DRESS_BOOTS" || name === "WHITE_SHIRT_SHORT" || name === "BLACK_PLEATED_SKIRT" || name === "BLACK_LEGGINGS" || name === "DOUBLE_BREASTED_SUIT" || name === "BLACK_SLACKS" || name === "OPERA_CAPE") {
            targetSize = 0.86;
          }
          
          const scale = maxDim > 0.0001 ? (targetSize / maxDim) : 1.0;
          
          for (let i = 0; i < rawVertices.length; i += 3) {
            rawVertices[i] = (rawVertices[i] - centerX) * scale;
            rawVertices[i+1] = (rawVertices[i+1] - centerY) * scale;
            rawVertices[i+2] = (rawVertices[i+2] - centerZ) * scale;
          }
          
          // Overwrite the manual tweaks since bounding normalization handles all scales and offsets perfectly
          scaleFactor = 1.0;
          yOffset = 0.0;
        }

        let vertices = [];
        let faces = [];
        
        // Convert to face lists
        for (let i = 0; i < rawVertices.length; i += 3) {
          vertices.push([rawVertices[i], rawVertices[i+1], rawVertices[i+2]]);
        }
        
        for (let i = 0; i < rawIndices.length; i += 3) {
          const idx0 = rawIndices[i];
          const idx1 = rawIndices[i+1];
          const idx2 = rawIndices[i+2];
          
          const rVal = (rawColors[idx0 * 3] * 255) | 0;
          const gVal = (rawColors[idx0 * 3 + 1] * 255) | 0;
          const bVal = (rawColors[idx0 * 3 + 2] * 255) | 0;
          const rVal2 = (rawColors[idx2 * 3] * 255) | 0;
          const gVal2 = (rawColors[idx2 * 3 + 1] * 255) | 0;
          const bVal2 = (rawColors[idx2 * 3 + 2] * 255) | 0;

          const v0 = vertices[idx0];
          const v1 = vertices[idx1];
          const v2 = vertices[idx2 !== undefined ? idx2 : idx0];
          let fnx = 0, fny = 1, fnz = 0;
          if (v0 && v1 && v2) {
            // addBox uses CW outward winding, so (v2 - v0) x (v1 - v0) points outward
            const ux = v2[0] - v0[0], uy = v2[1] - v0[1], uz = v2[2] - v0[2];
            const vx = v1[0] - v0[0], vy = v1[1] - v0[1], vz = v1[2] - v0[2];
            fnx = uy * vz - uz * vy;
            fny = uz * vx - ux * vz;
            fnz = ux * vy - uy * vx;
            const len = Math.hypot(fnx, fny, fnz) || 1;
            fnx /= len;
            fny /= len;
            fnz /= len;
          }
          
          faces.push({
            indices: [idx0, idx1, idx2],
            depthIndices: [idx0, idx1, idx2],
            r: rVal,
            g: gVal,
            b: bVal,
            r2: rVal2,
            g2: gVal2,
            b2: bVal2,
            nx: fnx,
            ny: fny,
            nz: fnz,
            avgZ: 0
          });
        }

        // Pair consecutive triangles that form a rectangular box quad so both halves sort at the exact same quad center
        for (let i = 0; i + 1 < faces.length; i++) {
          const fA = faces[i];
          const fB = faces[i + 1];
          const dotN = fA.nx * fB.nx + fA.ny * fB.ny + fA.nz * fB.nz;
          if (dotN > 0.999 && fA.r === fB.r && fA.g === fB.g && fA.b === fB.b) {
            const combined = [fA.indices[0], fA.indices[1], fA.indices[2]];
            for (let k = 0; k < 3; k++) {
              const idx = fB.indices[k];
              if (combined.indexOf(idx) === -1) combined.push(idx);
            }
            if (combined.length === 4) {
              fA.depthIndices = combined;
              fB.depthIndices = combined;
              i++; // Advance past this quad pair
            }
          }
        }
        
        const ctx = canvas.getContext("2d");
        const projected = new Array(vertices.length);
        for (let i = 0; i < vertices.length; i++) {
          projected[i] = { x: 0, y: 0, z: 0 };
        }
        // Negative Rx (~-30 deg) tilts the top of the 3D model (+Y) towards the camera (-Z)
        // so the icon is viewed from an angled top-down perspective instead of from underneath
        const isGrassIcon = (name === "GRASS");
        const isClothIcon = (name === "CLOTH");
        const isRubberIcon = (name === "RUBBER_BLOCK");
        const isToughMeatIcon = (name === "TOUGH_MEAT");
        const isLeatherIcon = (name === "LEATHER" || name === "HIDE");
        const fixedRx = isGrassIcon ? 0.0 : (isRubberIcon ? -0.34 : (isClothIcon ? -0.36 : (isLeatherIcon ? -0.58 : (isToughMeatIcon ? -0.44 : -0.52))));
        const cosRx = Math.cos(fixedRx);
        const sinRx = Math.sin(fixedRx);
        const DEFAULT_PREVIEW_ANGLE = isGrassIcon ? 0.0 : (isRubberIcon ? 2.52 : (isClothIcon ? 2.86 : (isLeatherIcon ? 2.60 : 2.45)));
        const isFlux = (name === "OBSIDIAN_FLUX");
        const isBullet = (name === "IRON_BULLET");
        
        function drawFrame(customAngleY) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const ry = (typeof customAngleY === "number") ? customAngleY : DEFAULT_PREVIEW_ANGLE;
          const cosRy = Math.cos(ry);
          const sinRy = Math.sin(ry);
          
          const cx = canvas.width / 2;
          const cy = canvas.height / 2 + yOffset * dpr;
          const screenScale = Math.min(canvas.width, canvas.height) * 1.0 * scaleFactor;
          
          for (let i = 0; i < vertices.length; i++) {
            const v = vertices[i];
            const x = v[0];
            const y = v[1];
            const z = v[2];
            
            const x1 = x * cosRy - z * sinRy;
            const z1 = x * sinRy + z * cosRy;
            
            const y2 = y * cosRx - z1 * sinRx;
            const z2 = y * sinRx + z1 * cosRx;
            
            const proj = projected[i];
            proj.x = cx + x1 * screenScale;
            proj.y = cy - y2 * screenScale;
            proj.z = z2;
          }
          
          for (let i = 0; i < faces.length; i++) {
            const face = faces[i];
            const dInd = face.depthIndices;
            let sumZ = 0;
            for (let k = 0; k < dInd.length; k++) {
              sumZ += projected[dInd[k]].z;
            }
            const nz1 = face.nx * sinRy + face.nz * cosRy;
            const nz2 = face.ny * sinRx + nz1 * cosRx;
            face.avgZ = (sumZ / dInd.length) + nz2 * 0.015;
          }
          
          faces.sort((a, b) => b.avgZ - a.avgZ);
          
          for (let i = 0; i < faces.length; i++) {
            const face = faces[i];
            const ind = face.indices;
            
            ctx.beginPath();
            const p0 = projected[ind[0]];
            ctx.moveTo(p0.x, p0.y);
            for (let k = 1; k < ind.length; k++) {
              const p = projected[ind[k]];
              ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();

            if (isGrassIcon && ind.length >= 3) {
              // Interpolate vertex colors from base midpoint (p0, p1: botColor) to tip (p2: topColor)
              // matching the exact WebGL vertex color interpolation of addGrassTuft on the ground
              const p1 = projected[ind[1]];
              const p2 = projected[ind[2]];
              const baseX = (p0.x + p1.x) * 0.5;
              const baseY = (p0.y + p1.y) * 0.5;
              const grad = ctx.createLinearGradient(baseX, baseY, p2.x, p2.y);
              grad.addColorStop(0, "rgb(" + face.r + "," + face.g + "," + face.b + ")");
              grad.addColorStop(1, "rgb(" + face.r2 + "," + face.g2 + "," + face.b2 + ")");
              ctx.fillStyle = grad;
              ctx.fill();
              continue;
            }
            
            const nx1 = face.nx * cosRy - face.nz * sinRy;
            const nz1 = face.nx * sinRy + face.nz * cosRy;
            
            // Light from top (+Y), front (-Z), and slightly left (-X)
            const dot = -nx1 * 0.32 + face.ny * 0.78 - nz1 * 0.48;
            const lightIntensity = isFlux ? 1.0 : (dot > 0 ? dot : 0);
            const factor = isClothIcon
              ? (0.64 + lightIntensity * 0.36)
              : (isRubberIcon
                ? (0.65 + lightIntensity * 0.35)
                : ((isBullet ? 0.38 : 0.45) + lightIntensity * (isBullet ? 0.62 : 0.55)));
            const spec = isBullet && dot > 0 ? Math.pow(dot, 6) * 58 : 0;
            
            const sr = Math.min(255, (face.r * factor + spec) | 0);
            const sg = Math.min(255, (face.g * factor + spec) | 0);
            const sb = Math.min(255, (face.b * factor + spec) | 0);
            
            const rgbStr = "rgb(" + sr + "," + sg + "," + sb + ")";
            ctx.fillStyle = rgbStr;
            ctx.fill();
            if (isBullet) {
              ctx.strokeStyle = rgbStr;
              ctx.lineWidth = 0.65;
              ctx.stroke();
            }
          }
        }
        
        drawFrame(DEFAULT_PREVIEW_ANGLE);
        if (isInteractivePreview) {
          canvas._drawAtAngle = drawFrame;
          canvas._previewAngle = DEFAULT_PREVIEW_ANGLE;
          canvas._defaultAngle = DEFAULT_PREVIEW_ANGLE;
          return canvas;
        }

        try {
          const dataUrl = canvas.toDataURL();
          icon3DCache.set(cacheKey, dataUrl);
          const img = document.createElement("img");
          img.src = dataUrl;
          img.style.width = width + "px";
          img.style.height = height + "px";
          img.style.display = "block";
          img.style.margin = "0 auto";
          return img;
        } catch (e) {
          return canvas;
        }
      }
      window.create3DIconCanvas = create3DIconCanvas;

      // Pre-warm 3D icon cache for common collectibles including COTTON_PLANT, WOOD_BED, WOOD_TABLE, and WOOD_CHAIR during idle
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => {
          try {
            create3DIconCanvas("COTTON_PLANT", 48, 48);
            create3DIconCanvas("COTTON_PLANT", 38, 38);
            create3DIconCanvas("CROWN_FLOWER", 48, 48);
            create3DIconCanvas("CROWN_FLOWER", 38, 38);
            create3DIconCanvas("RUBBER_BLOCK", 48, 48);
            create3DIconCanvas("RUBBER_BLOCK", 38, 38);
            create3DIconCanvas("TOUGH_MEAT", 48, 48);
            create3DIconCanvas("TOUGH_MEAT", 38, 38);
            create3DIconCanvas("LEATHER", 48, 48);
            create3DIconCanvas("LEATHER", 38, 38);
            create3DIconCanvas("WOOD_BED", 48, 48);
            create3DIconCanvas("WOOD_BED", 38, 38);
            create3DIconCanvas("WOOD_TABLE", 48, 48);
            create3DIconCanvas("WOOD_TABLE", 38, 38);
            create3DIconCanvas("WOOD_CHAIR", 48, 48);
            create3DIconCanvas("WOOD_CHAIR", 38, 38);
            create3DIconCanvas("LANTERN", 48, 48);
            create3DIconCanvas("LANTERN", 38, 38);
          } catch (e) {}
        });
      } else {
        setTimeout(() => {
          try {
            create3DIconCanvas("COTTON_PLANT", 48, 48);
            create3DIconCanvas("COTTON_PLANT", 38, 38);
            create3DIconCanvas("CROWN_FLOWER", 48, 48);
            create3DIconCanvas("CROWN_FLOWER", 38, 38);
            create3DIconCanvas("RUBBER_BLOCK", 48, 48);
            create3DIconCanvas("RUBBER_BLOCK", 38, 38);
            create3DIconCanvas("TOUGH_MEAT", 48, 48);
            create3DIconCanvas("TOUGH_MEAT", 38, 38);
            create3DIconCanvas("LEATHER", 48, 48);
            create3DIconCanvas("LEATHER", 38, 38);
            create3DIconCanvas("WOOD_BED", 48, 48);
            create3DIconCanvas("WOOD_BED", 38, 38);
            create3DIconCanvas("WOOD_TABLE", 48, 48);
            create3DIconCanvas("WOOD_TABLE", 38, 38);
            create3DIconCanvas("WOOD_CHAIR", 48, 48);
            create3DIconCanvas("WOOD_CHAIR", 38, 38);
            create3DIconCanvas("LANTERN", 48, 48);
            create3DIconCanvas("LANTERN", 38, 38);
          } catch (e) {}
        }, 150);
      }

      let activeTab = "inventory";
      window.getActiveTab = () => activeTab;
      window.setActiveTab = (tab) => {
        activeTab = tab;
        const bottomBtns = document.getElementById("inventoryBottomButtons");
        if (bottomBtns) {
          const tabInv = document.getElementById("tabInventory");
          const isTabActive = tabInv ? tabInv.classList.contains("active") : (tab === "inventory");
          bottomBtns.style.display = (tab === "inventory" && isTabActive) ? "flex" : "none";
        }
        if (tab !== "inventory") {
          window.selectedInventorySlot = null;
          if (typeof updateSelectedSlotVisuals === "function") updateSelectedSlotVisuals();
          if (typeof updateBottomButtonsState === "function") updateBottomButtonsState();
        }
        if (typeof updateCustomScrollbar === "function") {
          setTimeout(updateCustomScrollbar, 30);
        }
      };

      function updateBadge() {
        const badge = document.getElementById("inventoryBadge");
        if (!badge) return;
        if (!isDevMode) {
          badge.style.display = "none";
          return;
        } else {
          badge.style.display = "flex";
        }
        const count = inventory
          .slice(0, UNLOCKED_SLOTS)
          .reduce((acc, item) => acc + (item ? item.count || 1 : 0), 0);
        badge.textContent = count;
      }

      function updateActionSlotsPosition() {
        const actionSlotsWrapper = document.getElementById("actionSlots");
        if (!actionSlotsWrapper) return;
        
        if (actionSlotsWrapper.classList.contains("move-mode") && window.innerWidth > 768) {
          const panel = document.querySelector("#inventoryOverlay .inventory-panel");
          if (panel) {
            const rect = panel.getBoundingClientRect();
            // Position action slots exactly adjacent to the right edge of the inventory panel with a 16px gap
            actionSlotsWrapper.style.left = `${rect.right + 16}px`;
            actionSlotsWrapper.style.top = `${rect.top + rect.height / 2}px`;
            actionSlotsWrapper.style.transform = "translateY(-50%) scale(var(--ui-hud-scale, 1))";
            actionSlotsWrapper.style.transformOrigin = "left center";
            actionSlotsWrapper.style.bottom = "auto";
            actionSlotsWrapper.style.right = "auto";
          }
        } else {
          // Reset custom inline styles so the CSS handles normal layout
          actionSlotsWrapper.style.left = "";
          actionSlotsWrapper.style.top = "";
          actionSlotsWrapper.style.transform = "";
          actionSlotsWrapper.style.transformOrigin = "";
          actionSlotsWrapper.style.bottom = "";
          actionSlotsWrapper.style.right = "";
        }
      }
      window.updateActionSlotsPosition = updateActionSlotsPosition;

      
      function closeInventoryActually() {
        const qBtn = document.getElementById("quitGameBtn");
        if (qBtn) qBtn.style.display = "none";
        const overlay = document.getElementById("inventoryOverlay");
        overlay.classList.remove("open");
        
        // Hide cooking tab when closed
        if (document.getElementById("tabCooking").classList.contains("active")) {
          activeTab = "inventory";
          document.getElementById("tabCooking").classList.remove("active");
          document.getElementById("tabCooking").style.display = "none";
          document.getElementById("tabInventory").classList.add("active");
          document.getElementById("cookingList").style.display = "none";
          document.getElementById("inventoryGrid").style.display = "grid";
          
          const mainLayout = document.getElementById("inventoryMainLayout");
          if (mainLayout) {
            mainLayout.style.display = "flex";
            mainLayout.style.maxWidth = "none";
          }
          const divider = document.getElementById("inventoryVerticalDivider");
          if (divider) divider.style.display = "block";
          const leftDivider = document.getElementById("inventoryLeftVerticalDivider");
          if (leftDivider) leftDivider.style.display = "block";
          const actionSlotsWrapper = document.getElementById("inventoryActionSlotsWrapper");
          if (actionSlotsWrapper) actionSlotsWrapper.style.display = "flex";
          const equipSlotsWrapper = document.getElementById("inventoryEquipSlotsWrapper");
          if (equipSlotsWrapper) equipSlotsWrapper.style.display = "flex";
        }
        document.getElementById("tabCooking").style.display = "none";


        if (gameStarted) {
          requestPointerLockSafe();
        }

        closeTrashConfirm();

        if (isMoveModeEnabled) {
          isMoveModeEnabled = false;
          const actionSlotsWrapper = document.getElementById("actionSlots");
          if (actionSlotsWrapper) {
            actionSlotsWrapper.classList.remove("move-mode");
          }
          renderInventory();
          renderActionSlots();
        }
        updateActionSlotsPosition();
      }
      window.closeInventoryActually = closeInventoryActually;

      function openChest(chestItem) {
        // Close inventory first if open
        const invOverlay = document.getElementById("inventoryOverlay");
        if (invOverlay && invOverlay.classList.contains("open")) {
          invOverlay.classList.remove("open");
        }
        
        currentOpenChest = chestItem;
        if (!currentOpenChest.storage) {
          currentOpenChest.storage = Array(20).fill(null);
        }
        
        const overlay = document.getElementById("chestOverlay");
        if (overlay) {
          overlay.classList.add("open");
        }
        
        renderChest();

      }

      function closeChest() {
        currentOpenChest = null;
        const overlay = document.getElementById("chestOverlay");
        if (overlay) {
          overlay.classList.remove("open");
        }
        if (gameStarted) {
          requestPointerLockSafe();
        }
        closeTrashConfirm();
      }

      let activeWarpFluxSource = null;

      const MAX_OBSIDIAN_PADS = 5;
      window.MAX_OBSIDIAN_PADS = MAX_OBSIDIAN_PADS;

      function isObsidianPadType(type) {
        return (
          type === "obsidian_pad_warp_item" ||
          type === "obsidian_pad_warp" ||
          type === "obsidian_compass_pad" ||
          type === "obsidian_compass_pad_item"
        );
      }

      function getPlacedObsidianPadsInOrder() {
        if (typeof collectibles === "undefined" || !Array.isArray(collectibles)) return [];
        const pads = [];
        for (let i = 0; i < collectibles.length; i++) {
          const c = collectibles[i];
          if (
            c &&
            c.active !== false &&
            !c.collected &&
            !c.isPreview &&
            !c.isDynamic &&
            isObsidianPadType(c.type)
          ) {
            let isDuplicate = false;
            for (let j = 0; j < pads.length; j++) {
              const existing = pads[j];
              if (existing === c) {
                isDuplicate = true;
                break;
              }
              if (
                typeof existing.seed === "number" &&
                typeof c.seed === "number" &&
                Math.abs(existing.seed - c.seed) < 1e-12
              ) {
                isDuplicate = true;
                break;
              }
              if (Array.isArray(existing.position) && Array.isArray(c.position)) {
                const dx = (existing.position[0] || 0) - (c.position[0] || 0);
                const dy = (existing.position[1] || 0) - (c.position[1] || 0);
                const dz = (existing.position[2] || 0) - (c.position[2] || 0);
                if (dx * dx + dy * dy + dz * dz < 0.0001) {
                  isDuplicate = true;
                  break;
                }
              }
            }
            if (isDuplicate) {
              collectibles.splice(i, 1);
              i--;
              continue;
            }
            pads.push(c);
          }
        }
        for (let idx = 0; idx < pads.length; idx++) {
          pads[idx].placedOrder = idx + 1;
        }
        return pads;
      }
      window.getPlacedObsidianPadsInOrder = getPlacedObsidianPadsInOrder;

      function openWarpUI(fluxSourceInfo = null) {
        const invOverlay = document.getElementById("inventoryOverlay");
        if (invOverlay && invOverlay.classList.contains("open")) {
          invOverlay.classList.remove("open");
        }
        const chestOverlay = document.getElementById("chestOverlay");
        if (chestOverlay && chestOverlay.classList.contains("open")) {
          chestOverlay.classList.remove("open");
          currentOpenChest = null;
        }

        activeWarpFluxSource = fluxSourceInfo;

        const overlay = document.getElementById("warpOverlay");
        if (overlay) {
          overlay.classList.add("open");
        }
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
        renderWarpUI();
      }
      window.openWarpUI = openWarpUI;

      function closeWarpUI() {
        activeWarpFluxSource = null;
        const overlay = document.getElementById("warpOverlay");
        if (overlay) {
          overlay.classList.remove("open");
        }
        if (gameStarted) {
          requestPointerLockSafe();
        }
      }
      window.closeWarpUI = closeWarpUI;

      function consumeOneObsidianFlux() {
        if (activeWarpFluxSource) {
          const { source, index } = activeWarpFluxSource;
          const list = source === "action" ? actionSlotsItems : inventory;
          const slotItem = list && list[index];
          if (slotItem && (slotItem.name === "OBSIDIAN_FLUX" || slotItem.name === "OBSIDIAN_FLUX") && slotItem.count > 0) {
            if (slotItem.count > 1) {
              slotItem.count--;
            } else {
              list[index] = null;
              if (source === "action" && selectedActionSlotIndex === index) {
                selectedActionSlotIndex = -1;
              }
            }
            renderInventory();
            renderActionSlots();
            updateBadge();
            return true;
          }
        }

        if (typeof selectedActionSlotIndex === "number" && selectedActionSlotIndex >= 0 && actionSlotsItems[selectedActionSlotIndex]) {
          const s = actionSlotsItems[selectedActionSlotIndex];
          if ((s.name === "OBSIDIAN_FLUX" || s.name === "OBSIDIAN_FLUX") && s.count > 0) {
            if (s.count > 1) {
              s.count--;
            } else {
              actionSlotsItems[selectedActionSlotIndex] = null;
              selectedActionSlotIndex = -1;
            }
            renderInventory();
            renderActionSlots();
            updateBadge();
            return true;
          }
        }

        for (let i = 0; i < actionSlotsItems.length; i++) {
          const s = actionSlotsItems[i];
          if (s && (s.name === "OBSIDIAN_FLUX" || s.name === "OBSIDIAN_FLUX") && s.count > 0) {
            if (s.count > 1) {
              s.count--;
            } else {
              actionSlotsItems[i] = null;
              if (selectedActionSlotIndex === i) selectedActionSlotIndex = -1;
            }
            renderInventory();
            renderActionSlots();
            updateBadge();
            return true;
          }
        }

        for (let i = 0; i < inventory.length; i++) {
          const s = inventory[i];
          if (s && (s.name === "OBSIDIAN_FLUX" || s.name === "OBSIDIAN_FLUX") && s.count > 0) {
            if (s.count > 1) {
              s.count--;
            } else {
              inventory[i] = null;
            }
            renderInventory();
            renderActionSlots();
            updateBadge();
            return true;
          }
        }

        return false;
      }

      function warpToObsidianPad(padItem, padSequenceNumber) {
        if (!padItem || !Array.isArray(padItem.position)) return;
        if (!consumeOneObsidianFlux()) {
          if (typeof showNotice === "function") {
            showNotice("🚫 ไม่มี Obsidian Flux สำหรับการวาร์ป!");
          }
          closeWarpUI();
          return;
        }

        closeWarpUI();

        const px = padItem.position[0];
        const py = padItem.position[1];
        const pz = padItem.position[2];
        const r = Math.hypot(px, py, pz) || 1;
        const targetTheta = Math.acos(Math.max(-1, Math.min(1, py / r)));
        let targetPhi = Math.atan2(pz, px);
        if (targetPhi < 0) targetPhi += Math.PI * 2;

        if (typeof window.warpPlayerToCoords === "function") {
          window.warpPlayerToCoords(targetTheta, targetPhi);
        } else {
          charTheta = targetTheta;
          charPhi = targetPhi;
          playerDamageCooldown = 2.0;
          playerControlsLocked = false;
          if (typeof setRagdoll === "function") setRagdoll(false);
          playerCenterRadius = null;
          playerVerticalVel = 0.0;
          if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
        }

        if (typeof playCollectSound === "function") {
          playCollectSound();
        }
        if (typeof showNotice === "function") {
          const prefix = (typeof window.t === "function") ? window.t("warp_pad_prefix") : "แท่นวาร์ป #";
          showNotice(`🌀 วาร์ปไปยัง ${prefix}${padSequenceNumber} สำเร็จ! (ใช้ Obsidian Flux 1 อัน)`);
        }
      }
      window.warpToObsidianPad = warpToObsidianPad;

      function renderWarpUI() {
        const warpGridEl = document.getElementById("warpGrid");
        if (!warpGridEl) return;
        warpGridEl.innerHTML = "";

        const pads = getPlacedObsidianPadsInOrder().slice(0, MAX_OBSIDIAN_PADS);
        const totalSlots = 20;
        const prefix = (typeof window.t === "function") ? window.t("warp_pad_prefix") : "แท่นวาร์ป #";

        for (let i = 0; i < totalSlots; i++) {
          const slotDiv = document.createElement("div");
          slotDiv.className = "inventory-slot";
          slotDiv.dataset.index = i;
          slotDiv.dataset.source = "warp";

          const padItem = pads[i] || null;
          if (padItem) {
            const padNumber = i + 1;
            slotDiv.style.cursor = "pointer";
            slotDiv.title = `${prefix}${padNumber}`;

            const canvas3D = create3DIconCanvas({ name: "OBSIDIAN_PAD_WARP" }, 56, 56);
            if (canvas3D) {
              slotDiv.appendChild(canvas3D);
            } else {
              const iconSpan = document.createElement("span");
              iconSpan.textContent = "🧭";
              slotDiv.appendChild(iconSpan);
            }

            const countBadge = document.createElement("div");
            countBadge.className = "slot-count";
            countBadge.textContent = `#${padNumber}`;
            slotDiv.appendChild(countBadge);

            const nameLabel = document.createElement("div");
            nameLabel.className = "slot-name";
            nameLabel.textContent = `PAD #${padNumber}`;
            slotDiv.appendChild(nameLabel);

            slotDiv.addEventListener("click", (e) => {
              e.stopPropagation();
              warpToObsidianPad(padItem, padNumber);
            });
          } else {
            slotDiv.classList.add("empty");
          }

          warpGridEl.appendChild(slotDiv);
        }

        if (pads.length === 0 && typeof showNotice === "function") {
          const msg = (typeof window.t === "function") ? window.t("no_warp_pads_notice") : "🚫 ยังไม่มีแท่นวาร์ป (Obsidian Pad) ที่วางไว้บนดาวดวงนี้!";
          showNotice(msg);
        }
      }
      window.renderWarpUI = renderWarpUI;

      function addItemToChest(item) {
        if (!currentOpenChest) return false;
        const itemName = item.name || item.label;
        const maxStack = MAX_STACK_PER_SLOT;

        // Check if item already exists and can be stacked (up to 30 per slot)
        for (let i = 0; i < 20; i++) {
          const st = currentOpenChest.storage[i];
          if (
            st !== null &&
            (st.name === itemName ||
             st.label === itemName) &&
            (st.count || 1) < maxStack
          ) {
            st.count = (st.count || 1) + 1;
            renderChest();
            saveSettingsToLocalStorage();
            return true;
          }
        }

        // Add to new slot in chest
        for (let i = 0; i < 20; i++) {
          if (currentOpenChest.storage[i] === null) {
            currentOpenChest.storage[i] = { ...item, count: 1 };
            currentOpenChest.storage[i].name = itemName;
            renderChest();
            saveSettingsToLocalStorage();
            return true;
          }
        }
        return false;
      }

      
      function getSlotItem(source, index) {
        if (source === "inventory" || source === "chestPlayerInventory") {
          return inventory[index];
        } else if (source === "action") {
          return actionSlotsItems[index];
        } else if (source === "equip") {
          return equipSlotsItems[index];
        } else if (source === "chest") {
          return (currentOpenChest && currentOpenChest.storage) ? currentOpenChest.storage[index] : null;
        }
        return null;
      }

      function getValidEquipSlotsForItem(item) {
        if (!item) return [];
        const raw = String(item.name || item.label || "").toUpperCase();
        const def = (typeof window !== "undefined" && window.ITEM_DEFINITIONS && window.ITEM_DEFINITIONS[raw]) ? window.ITEM_DEFINITIONS[raw] : null;
        const slotType = item.equipSlot || (def && def.equipSlot) || "";
        if (raw === "WHITE_BODYSUIT_TOP" || raw === "WHITE_SHIRT_SHORT" || slotType === "shirt") return [0];
        if (raw === "WHITE_BODYSUIT_SHORTS" || raw === "BLACK_PLEATED_SKIRT" || raw === "BLACK_SLACKS" || slotType === "pants") return [1];
        if (raw === "TRAVELER_BOOTS" || raw === "HOODIE_BOOTS" || raw === "OXFORD_SHOES" || raw === "DRESS_BOOTS" || slotType === "shoes") return [2];
        if (raw === "TRAVELER_HOODIE" || raw === "BLACK_LEGGINGS" || raw === "DOUBLE_BREASTED_SUIT" || raw === "OPERA_CAPE" || slotType === "accessory") return [3, 4];
        return [];
      }
      window.getValidEquipSlotsForItem = getValidEquipSlotsForItem;

      function getEquipSlotIndexForItem(item, preferredIndex = -1) {
        const valid = getValidEquipSlotsForItem(item);
        if (valid.length === 0) return -1;
        const raw = String(item.name || item.label || "").toUpperCase();
        // Mutual exclusion & smart pairing in accessory slots 3 & 4:
        // - DOUBLE_BREASTED_SUIT and OPERA_CAPE CAN be worn together (one in slot 3, one in slot 4).
        // - Neither DOUBLE_BREASTED_SUIT nor OPERA_CAPE can be worn simultaneously with TRAVELER_HOODIE.
        if (raw === "DOUBLE_BREASTED_SUIT" || raw === "OPERA_CAPE" || raw === "TRAVELER_HOODIE" || raw === "HOODIE_CLOAK") {
          const isHoodie = (raw === "TRAVELER_HOODIE" || raw === "HOODIE_CLOAK");
          for (let i = 0; i < valid.length; i++) {
            const sIdx = valid[i];
            const cur = equipSlotsItems[sIdx];
            if (!cur) continue;
            const curName = String(cur.name || cur.label || "").toUpperCase();
            if (!isHoodie && (curName === "TRAVELER_HOODIE" || curName === "HOODIE_CLOAK")) {
              return sIdx;
            }
            if (isHoodie && (curName === "DOUBLE_BREASTED_SUIT" || curName === "OPERA_CAPE")) {
              return sIdx;
            }
          }
        }
        if (typeof preferredIndex === "number" && valid.includes(preferredIndex)) return preferredIndex;
        for (let i = 0; i < valid.length; i++) {
          if (!equipSlotsItems[valid[i]]) return valid[i];
        }
        // If both slots 3 & 4 are occupied and equipping OPERA_CAPE while DOUBLE_BREASTED_SUIT is equipped (or vice versa),
        // pick the OTHER slot so DOUBLE_BREASTED_SUIT and OPERA_CAPE stay equipped together!
        if (raw === "OPERA_CAPE" || raw === "DOUBLE_BREASTED_SUIT") {
          const partnerName = raw === "OPERA_CAPE" ? "DOUBLE_BREASTED_SUIT" : "OPERA_CAPE";
          for (let i = 0; i < valid.length; i++) {
            const sIdx = valid[i];
            const cur = equipSlotsItems[sIdx];
            const curName = cur ? String(cur.name || cur.label || "").toUpperCase() : "";
            if (curName !== partnerName) return sIdx;
          }
        }
        return valid[0];
      }
      window.getEquipSlotIndexForItem = getEquipSlotIndexForItem;

      function refreshCharacterAppearanceNow() {
        if (typeof window.updateCharacterMesh === "function") {
          try {
            window.updateCharacterMesh(typeof window.walkPhase === "number" ? window.walkPhase : 0.0, false);
          } catch (e) {}
        }
      }
      window.refreshCharacterAppearanceNow = refreshCharacterAppearanceNow;

      function setSlotItem(source, index, item) {
        if (source === "inventory" || source === "chestPlayerInventory") {
          inventory[index] = item;
        } else if (source === "action") {
          actionSlotsItems[index] = item;
        } else if (source === "equip") {
          equipSlotsItems[index] = item;
          refreshCharacterAppearanceNow();
        } else if (source === "chest") {
          if (currentOpenChest && currentOpenChest.storage) {
            currentOpenChest.storage[index] = item;
          }
        }
      }

      function populateSlotElement(slotEl, {
        source,
        index,
        item = null,
        isLocked = false,
        isDraggable = true,
        isDropTarget = true,
        keyLabel = null,
        cursor = null,
        onClick = null,
        onRightClick = null,
        labelStyle = null,
        labelColor = null
      }) {
        slotEl.innerHTML = "";
        slotEl.dataset.source = source;
        slotEl.dataset.index = index;

        if (isLocked) {
          slotEl.classList.add("locked");
          slotEl.draggable = false;
          slotEl.onclick = null;
          slotEl.ondragstart = null;
          slotEl.ondragend = null;
          slotEl.ondragover = null;
          slotEl.ondragleave = null;
          slotEl.ondrop = null;
          return slotEl;
        } else {
          slotEl.classList.remove("locked");
        }

        // Setup Drag & Drop
        if (isDropTarget) {
          slotEl.ondragover = handleDragOver;
          slotEl.ondragleave = handleDragLeave;
          slotEl.ondrop = (e) => handleDrop(e, source, index);
        } else {
          slotEl.ondragover = null;
          slotEl.ondragleave = null;
          slotEl.ondrop = null;
        }

        // Key label for Action Slots (1, 2, 3, 4)
        if (keyLabel) {
          const keyBadge = document.createElement("span");
          keyBadge.style.position = "absolute";
          keyBadge.style.top = "2px";
          keyBadge.style.right = "4px";
          keyBadge.style.fontSize = "10px";
          keyBadge.style.color = "rgba(255,255,255,0.5)";
          keyBadge.style.fontFamily = "'Google Sans', sans-serif";
          keyBadge.textContent = keyLabel;
          slotEl.appendChild(keyBadge);
        }

        if (item) {
          slotEl.classList.remove("empty");
          slotEl.style.position = "relative";
          slotEl.style.cursor = cursor || "pointer";

          if (isDraggable) {
            slotEl.draggable = true;
            slotEl.ondragstart = (e) => handleDragStart(e, source, index);
            slotEl.ondragend = handleDragEnd;
          } else {
            slotEl.draggable = false;
            slotEl.ondragstart = null;
            slotEl.ondragend = null;
          }

          const content = document.createElement("span");
          content.className = "slot-content";
          const canvas3D = create3DIconCanvas(item, 48, 48);
          if (canvas3D) {
            content.appendChild(canvas3D);
          } else {
            content.textContent = item.icon || "📦";
          }
          slotEl.appendChild(content);

          const label = document.createElement("span");
          label.className = "slot-label";
          if (labelStyle) {
            Object.assign(label.style, labelStyle);
          } else if (labelColor) {
            label.style.color = labelColor;
          }
          const rawName = item.name || item.label || "ITEM";
          const displayName = typeof getItemDisplayName === "function" ? getItemDisplayName(rawName) : rawName;
          if (typeof window.setElementTextOrHTML === "function") {
            window.setElementTextOrHTML(label, displayName);
          } else if (typeof displayName === "string" && (displayName.includes("<svg") || displayName.includes("<span"))) {
            label.innerHTML = displayName;
          } else {
            label.textContent = displayName;
          }
          slotEl.appendChild(label);

          if (item.count > 1) {
            const countBadge = document.createElement("span");
            countBadge.style.position = "absolute";
            countBadge.style.top = "2px";
            countBadge.style.left = "4px";
            countBadge.style.fontSize = "11px";
            countBadge.style.fontWeight = "bold";
            countBadge.style.color = "#fff";
            countBadge.style.textShadow = "1px 1px 2px #000";
            countBadge.textContent = "x" + item.count;
            slotEl.appendChild(countBadge);
          }

          if (item.name === "GLOW_BATTERY" || item.label === "GLOW_BATTERY") {
            const stats = window.BatterySystem ? window.BatterySystem.getStats() : null;
            if (stats && stats.readyCount > 0 && stats.activeBattery) {
              const pct = Math.round((stats.activeBattery.charge / window.BatterySystem.MAX_CHARGE) * 100);
              const totalSecs = Math.floor(stats.activeBattery.charge / 60);
              const m = Math.floor(totalSecs / 60);
              const s = Math.floor(totalSecs % 60);
              slotEl.title = `🔋 หินเรืองแสงอัดแท่ง(แบต)\n• พร้อมใช้งาน: ${stats.readyCount} ก้อน\n• พลังงานก้อนหลัก: ${pct}% (${m}:${s < 10 ? '0' : ''}${s} นาที)\n• 1 ก้อนใช้ได้ 20 นาที / รีเจนอัตโนมัติ 5 นาทีเมื่อหมด`;
            } else {
              slotEl.title = `🔋 หินเรืองแสงอัดแท่ง(แบต)\n• พร้อมใช้งาน (20 นาที)\n• รีเจนอัตโนมัติ 5 นาทีเมื่อหมด`;
            }
          } else if (item.name === "GLOW_BATTERY_EMPTY") {
            const pct = Math.round((item.rechargeTime / 18000) * 100);
            const rem = Math.max(0, (18000 - item.rechargeTime) / 60);
            const m = Math.floor(rem / 60);
            const s = Math.ceil(rem % 60);
            slotEl.title = `⏳ แบตเตอรี่เรืองแสง(หมดพลังงาน)\n• กำลังรีเจน: ${pct}%\n• เหลือเวลารีเจน: ${m}:${s < 10 ? '0' : ''}${s} นาที`;
          } else {
            const def = (typeof getItemDefinition === "function") ? getItemDefinition(item) : (window.getItemDefinition ? window.getItemDefinition(item) : null);
            if (def) {
              const isPrePlace = window.hasItemCategory ? window.hasItemCategory(item, "PRE_PLACE") : (def.category === "PRE_PLACE");
              const isHoldable = window.hasItemCategory ? window.hasItemCategory(item, "HOLDABLE") : (def.category === "HOLDABLE");
              const isVehicle = window.hasItemCategory ? window.hasItemCategory(item, "VEHICLE") : (Array.isArray(def.category) ? def.category.includes("VEHICLE") : def.category === "VEHICLE");
              
              let catLabel = "📦 ไอเทมวัตถุดิบ/ทั่วไป (NONE)";
              if (isVehicle) catLabel = "🚙 ยานพาหนะ (VEHICLE)";
              else if (isPrePlace) catLabel = "🏗️ ไอเทม พรี-วาง (PRE_PLACE)";
              else if (isHoldable) catLabel = "⚔️ ไอเทมถือ (HOLDABLE)";

              slotEl.title = `${def.icon || ""} ${def.name_th} (${def.name_en})\n• หมวดหมู่: ${catLabel}\n• การใช้งาน: ${def.usage_th}`;
            }
          }

          if (item && (item.name === "WOODEN_ARM_CANNON" || item.name === "ARM_CANNON")) {
            // Temporary 3D ammo popup overlay when ammo is switched
            const isPopupActive = window.ammoSwitchPopup &&
                                  (window.ammoSwitchPopup.expiresAt > Date.now()) &&
                                  window.ammoSwitchPopup.ammoType;
            if (isPopupActive) {
              const popupAmmo = window.ammoSwitchPopup.ammoType;
              const ammoCount = (typeof getAmmoTotalCount === "function") ? getAmmoTotalCount(popupAmmo) : 0;

              const ammoPopupBadge = document.createElement("div");
              ammoPopupBadge.className = "ammo-3d-popup-badge";

              const bigAmmo3D = create3DIconCanvas(popupAmmo, 32, 32);
              if (bigAmmo3D) {
                ammoPopupBadge.appendChild(bigAmmo3D);
              }

              const labelEl = document.createElement("span");
              labelEl.style.fontSize = "10px";
              labelEl.style.fontWeight = "bold";
              labelEl.style.color = "#00f0ff";
              labelEl.style.textShadow = "0 0 4px #000, 1px 1px 2px #000";
              labelEl.style.marginTop = "0px";
              labelEl.style.whiteSpace = "nowrap";
              labelEl.textContent = `x${ammoCount}`;

              ammoPopupBadge.appendChild(labelEl);
              slotEl.appendChild(ammoPopupBadge);
            }
          }

          slotEl.oncontextmenu = (e) => { e.preventDefault(); };
          slotEl.onmousedown = (e) => {
            if (e.button === 2) {
              e.preventDefault();
              e.stopPropagation();
              if (typeof onRightClick === "function") {
                onRightClick(e);
              } else {
                handleSplitItem(source, index);
              }
            }
          };

          if (window.selectedInventorySlot && window.selectedInventorySlot.source === source && window.selectedInventorySlot.index === index) {
            slotEl.classList.add("item-selected");
          } else {
            slotEl.classList.remove("item-selected");
          }

          slotEl.onclick = (e) => {
            if (source === "itemsList") {
              window.selectedInventorySlot = null;
              if (onClick) onClick(e);
              return;
            }
            if (window.selectedInventorySlot) {
              const prev = window.selectedInventorySlot;
              if (prev.source === source && prev.index === index) {
                // Clicked same slot: deselect
                window.selectedInventorySlot = null;
              } else {
                // Move/swap/stack from prev to target slot
                const fromItem = getSlotItem(prev.source, prev.index);
                if (fromItem) {
                  let effTargetIndex = index;
                  if (source === "equip") {
                    const reqEquipIdx = getEquipSlotIndexForItem(fromItem, index);
                    if (reqEquipIdx === -1) {
                      if (typeof showNotice === "function") showNotice("⚠️ ไอเทมนี้ไม่ใช่เสื้อผ้าหรือของตกแต่งตัวละคร");
                      return;
                    }
                    effTargetIndex = reqEquipIdx;
                  }
                  const toItem = getSlotItem(source, effTargetIndex);
                  if (prev.source === "equip" && toItem) {
                    const validBack = getValidEquipSlotsForItem(toItem);
                    if (!validBack.includes(prev.index)) {
                      if (typeof showNotice === "function") showNotice("⚠️ ช่องสวมใส่นี้ใช้สำหรับไอเทมคนละประเภท");
                      return;
                    }
                  }
                  const fromName = fromItem.name || fromItem.label;
                  const toName = toItem ? (toItem.name || toItem.label) : null;

                  if (toItem && fromName === toName && source !== "equip") {
                    const toCount = toItem.count || 1;
                    const fromCount = fromItem.count || 1;
                    const room = MAX_STACK_PER_SLOT - toCount;
                    if (room > 0) {
                      const moveAmount = Math.min(room, fromCount);
                      toItem.count = toCount + moveAmount;
                      if (fromCount > moveAmount) {
                        fromItem.count = fromCount - moveAmount;
                      } else {
                        setSlotItem(prev.source, prev.index, null);
                      }
                    } else {
                      setSlotItem(prev.source, prev.index, toItem);
                      setSlotItem(source, effTargetIndex, fromItem);
                    }
                  } else {
                    setSlotItem(prev.source, prev.index, toItem);
                    setSlotItem(source, effTargetIndex, fromItem);
                  }

                  window.selectedInventorySlot = null;
                  if (currentOpenChest) renderChest();
                  renderInventory();
                  renderActionSlots();
                  if (typeof renderEquipSlots === "function") renderEquipSlots();
                  updateBadge();
                  saveSettingsToLocalStorage();
                  if (typeof updateSelectedSlotVisuals === "function") updateSelectedSlotVisuals();
                  if (typeof updateBottomButtonsState === "function") updateBottomButtonsState();
                  if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(err){}
                  if (window.GamepadController && typeof window.GamepadController.applyUIFocus === "function") {
                    window.GamepadController.applyUIFocus();
                  }
                  if (onClick) onClick(e);
                  return;
                }
              }
            } else {
              const cur = getSlotItem(source, index);
              if (cur) {
                window.selectedInventorySlot = { source, index, item: cur };
              }
            }
            if (typeof updateSelectedSlotVisuals === "function") updateSelectedSlotVisuals();
            if (typeof updateBottomButtonsState === "function") updateBottomButtonsState();

            if (onClick) onClick(e);
          };

          // Track hovered slot for bottom inventory action buttons
          slotEl.addEventListener("mouseenter", () => {
            window.lastHoveredSlot = { slotEl, source, index, item };
          });
          slotEl.addEventListener("mouseleave", () => {
            if (window.lastHoveredSlot && window.lastHoveredSlot.slotEl === slotEl) {
              window.lastHoveredSlot = null;
            }
          });
        } else {
          slotEl.classList.add("empty");
          slotEl.classList.remove("item-selected");
          slotEl.draggable = false;
          slotEl.ondragstart = null;
          slotEl.ondragend = null;
          if (cursor) slotEl.style.cursor = cursor;
          slotEl.onclick = (e) => {
            if (window.selectedInventorySlot) {
              const prev = window.selectedInventorySlot;
              const fromItem = getSlotItem(prev.source, prev.index);
              if (fromItem) {
                let effTargetIndex = index;
                if (source === "equip") {
                  const reqEquipIdx = getEquipSlotIndexForItem(fromItem, index);
                  if (reqEquipIdx === -1) {
                    if (typeof showNotice === "function") showNotice("⚠️ ไอเทมนี้ไม่ใช่เสื้อผ้าหรือของตกแต่งตัวละคร");
                    return;
                  }
                  effTargetIndex = reqEquipIdx;
                }
                const existingInEquip = (source === "equip") ? getSlotItem("equip", effTargetIndex) : null;
                setSlotItem(source, effTargetIndex, fromItem);
                setSlotItem(prev.source, prev.index, existingInEquip);
                window.selectedInventorySlot = null;
                if (currentOpenChest) renderChest();
                renderInventory();
                renderActionSlots();
                if (typeof renderEquipSlots === "function") renderEquipSlots();
                updateBadge();
                saveSettingsToLocalStorage();
                if (typeof updateSelectedSlotVisuals === "function") updateSelectedSlotVisuals();
                if (typeof updateBottomButtonsState === "function") updateBottomButtonsState();
                if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(err){}
                if (window.GamepadController && typeof window.GamepadController.applyUIFocus === "function") {
                  window.GamepadController.applyUIFocus();
                }
                if (onClick) onClick(e);
                return;
              }
            }
            window.selectedInventorySlot = null;
            if (typeof updateSelectedSlotVisuals === "function") updateSelectedSlotVisuals();
            if (typeof updateBottomButtonsState === "function") updateBottomButtonsState();
            if (onClick) onClick(e);
          };

          const emptyText = document.createElement("span");
          emptyText.style.fontSize = "10px";
          emptyText.style.color = "rgba(255,255,255,0.05)";
          emptyText.textContent = "□";
          slotEl.appendChild(emptyText);
        }

        return slotEl;
      }

      function createSlotElement(options) {
        const slot = document.createElement("div");
        slot.className = options.className || "inventory-slot";
        return populateSlotElement(slot, options);
      }

      function renderChest() {
        if (!currentOpenChest) return;
        const chestGrid = document.getElementById("chestGrid");
        if (!chestGrid) return;
        chestGrid.innerHTML = "";

        // 1. Render Chest Storage slots (20 slots)
        for (let i = 0; i < 20; i++) {
          const item = currentOpenChest.storage[i];
          const slot = createSlotElement({
            source: "chest",
            index: i,
            item: item,
            onClick: item ? () => {
              // Click to put/take 1 item into player inventory
              if (addItemToInventory({ ...item, count: 1 }, true)) {
                if (item.count > 1) {
                  item.count -= 1;
                } else {
                  currentOpenChest.storage[i] = null;
                }
                renderChest();
                renderInventory();
                renderActionSlots();
                updateBadge();
                saveSettingsToLocalStorage();
              } else {
                showNotice("กระเป๋าเต็มแล้ว! (Inventory Full)");
              }
            } : null
          });
          chestGrid.appendChild(slot);
        }

        // 2. Render Player Inventory slots inside Chest UI (20 slots)
        const playerGrid = document.getElementById("chestPlayerInventoryGrid");
        if (!playerGrid) return;
        playerGrid.innerHTML = "";

        for (let i = 0; i < TOTAL_SLOTS; i++) {
          const item = inventory[i];
          const isLocked = i >= UNLOCKED_SLOTS;
          const slot = createSlotElement({
            source: "chestPlayerInventory",
            index: i,
            item: item,
            isLocked: isLocked,
            onClick: (item && !isLocked) ? () => {
              // Click to put item into chest storage
              if (addItemToChest(item)) {
                if (item.count > 1) {
                  item.count -= 1;
                } else {
                  inventory[i] = null;
                }
                renderChest();
                renderInventory();
                renderActionSlots();
                updateBadge();
                saveSettingsToLocalStorage();
              } else {
                showNotice("กล่องเต็มแล้ว! (Chest Full)");
              }
            } : null
          });
          playerGrid.appendChild(slot);
        }
      }

      // Initialize chest event listeners once elements are ready
      document.addEventListener("DOMContentLoaded", () => {
        const inventoryOverlay = document.getElementById("inventoryOverlay");
        if (inventoryOverlay) {
          inventoryOverlay?.addEventListener("dragover", (e) => {
            if (e.target === inventoryOverlay) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }
          });
          inventoryOverlay?.addEventListener("drop", (e) => {
            if (e.target === inventoryOverlay) {
              handleTrashDrop(e);
            }
          });
        }
        
        const chestOverlay = document.getElementById("chestOverlay");
        if (chestOverlay) {
          chestOverlay?.addEventListener("dragover", (e) => {
            if (e.target === chestOverlay) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }
          });
          chestOverlay?.addEventListener("drop", (e) => {
            if (e.target === chestOverlay) {
              handleTrashDrop(e);
            }
          });
        }

        const chestClose = document.getElementById("chestClose");
        if (chestClose) {
          chestClose.onclick = () => {
            closeChest();
          };
        }

        const warpClose = document.getElementById("warpClose");
        if (warpClose) {
          warpClose.onclick = () => {
            closeWarpUI();
          };
        }
        const warpOverlay = document.getElementById("warpOverlay");
        if (warpOverlay) {
          warpOverlay.addEventListener("click", (e) => {
            if (e.target === warpOverlay) {
              closeWarpUI();
            }
          });
        }

        const chestTakeAll = document.getElementById("chestTakeAllBtn");
        if (chestTakeAll) {
          chestTakeAll.onclick = () => {
            if (!currentOpenChest) return;
            let anyMoved = false;
            let isFull = false;

            for (let i = 0; i < 20; i++) {
              const item = currentOpenChest.storage[i];
              if (item) {
                let count = item.count;
                let successCount = 0;
                for (let c = 0; c < count; c++) {
                  if (addItemToInventory({ ...item, count: 1 }, false, false)) {
                    successCount++;
                  } else {
                    isFull = true;
                    break;
                  }
                }
                if (successCount > 0) {
                  anyMoved = true;
                  if (successCount === count) {
                    currentOpenChest.storage[i] = null;
                  } else {
                    item.count -= successCount;
                  }
                }
                if (isFull) break;
              }
            }

            if (anyMoved) {
              playCollectSound();
              renderChest();
              renderInventory();
              renderActionSlots();
              updateBadge();
            }

            if (isFull) {
              showNotice("กระเป๋าเต็มแล้ว! (Inventory Full)");
            }
          };
        }
      });

      function toggleInventory() {
        const overlay = document.getElementById("inventoryOverlay");
        const isCurrentlyOpen = overlay.classList.contains("open");

        if (isCurrentlyOpen) {
          saveSettingsToLocalStorage();
          closeInventoryActually();
        } else {
          overlay.classList.add("open");
          const qBtn = document.getElementById("quitGameBtn");
          if (qBtn) qBtn.style.display = "none";
          // คืนค่าการแสดงผลแท็บและปุ่มออกไปหน้าหลัก
          document.getElementById("tabInventory").style.display = "inline-flex";
          document.getElementById("tabCrafting").style.display = "inline-flex";
          document.getElementById("tabSettings").style.display = "inline-flex";
          document.getElementById("tabItemsList").style.display = isDevMode ? "inline-flex" : "none";
          document.getElementById("btnExitToMenu").style.display = "block";

          // รีเซ็ตแท็บแอคทีฟเป็น กระเป๋า (Inventory) เสมอตอนเปิดครั้งแรก
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
            mainLayout.style.maxWidth = "none";
          }
          const divider = document.getElementById("inventoryVerticalDivider");
          if (divider) divider.style.display = "block";
          const leftDivider = document.getElementById("inventoryLeftVerticalDivider");
          if (leftDivider) leftDivider.style.display = "block";
          const actionSlotsWrapper = document.getElementById("inventoryActionSlotsWrapper");
          if (actionSlotsWrapper) actionSlotsWrapper.style.display = "flex";
          const equipSlotsWrapper = document.getElementById("inventoryEquipSlotsWrapper");
          if (equipSlotsWrapper) equipSlotsWrapper.style.display = "flex";

          // Auto-enable move mode when inventory opens
          isMoveModeEnabled = true;

          renderInventory();
          renderActionSlots();
          if (typeof renderEquipSlots === "function") renderEquipSlots();

        }
      }

      window.getMeleeEntityRadius = function(entity) {
        if (!entity) return 0.3;
        if (typeof entity.radius === "number") return entity.radius;
        if (entity.type === "meganeura") return 0.28;
        if (entity.type === "isopod") return 0.35;
        if (entity.type === "placoderm") return 0.65;
        if (entity.type === "georgiacetus") return 0.85;
        if (typeof entity.theta === "number" && !entity.type) {
          const pScaleVal = (typeof playerScale === "number") ? playerScale : 0.1;
          return 0.25 * (pScaleVal / 0.1);
        }
        return 0.3;
      };

      window.isButcherableNpcCorpse = function(npc, weaponId = null) {
        if (!npc || !npc.ragdollEnabled || npc._corpseButchered) return false;
        const reg = (typeof window !== "undefined" && window.NpcRegistry) ? window.NpcRegistry[npc.type] : null;
        const hasLoot = !!(reg && Array.isArray(reg.corpseLoot) && reg.corpseLoot.length > 0);
        if (!hasLoot && npc.type !== "georgiacetus") return false;
        if (weaponId !== null && weaponId !== undefined) {
          const reqWeapon = (reg && reg.butcherWeapon) ? String(reg.butcherWeapon).toUpperCase() : "TANTO";
          const norm = String(weaponId).toUpperCase();
          if (norm !== reqWeapon) return false;
        }
        return true;
      };

      window.butcherNpcCorpse = function(actorOrEntity, npc) {
        if (!npc || npc._corpseButchered) return false;
        const actor = (actorOrEntity && typeof window !== "undefined" && window.ActorCore)
          ? window.ActorCore.resolveActor(actorOrEntity)
          : ((typeof window !== "undefined" && window.ActorCore) ? window.ActorCore.getPlayerActor() : null);
        const isActorPlayer = !actor || actor.isPlayer !== false;
        const reg = (typeof window !== "undefined" && window.NpcRegistry) ? window.NpcRegistry[npc.type] : null;
        const lootList = (reg && Array.isArray(reg.corpseLoot) && reg.corpseLoot.length > 0)
          ? reg.corpseLoot
          : (npc.type === "georgiacetus"
            ? [
                { name: "TOUGH_MEAT", icon: "🥩", count: 20, label: "TOUGH_MEAT" },
                { name: "LEATHER", icon: "🟫", count: 10, label: "LEATHER" }
              ]
            : []);
        if (lootList.length === 0) return false;

        npc._corpseButchered = true;
        const dropOrigin = (npc.ragdollPos && npc.ragdollPos.length >= 3)
          ? npc.ragdollPos
          : (npc.position || [0, 0, 0]);
        let addedAny = false;
        let droppedOverflow = false;

        for (let i = 0; i < lootList.length; i++) {
          const entry = lootList[i];
          const count = entry.count || 1;
          const itemObj = { name: entry.name, icon: entry.icon, count: count, label: entry.label || entry.name };
          let stored = false;
          if (actor && typeof actor.addItem === "function") {
            stored = !!actor.addItem(itemObj, isActorPlayer && i === 0, isActorPlayer);
          } else if (isActorPlayer && typeof addItemToInventory === "function") {
            stored = !!addItemToInventory(itemObj, i === 0, true);
          }
          if (stored) {
            addedAny = true;
          } else if (typeof collectibles !== "undefined" && Array.isArray(collectibles)) {
            droppedOverflow = true;
            const pLen = Math.hypot(dropOrigin[0], dropOrigin[1], dropOrigin[2]) || 1;
            const uN = [dropOrigin[0] / pLen, dropOrigin[1] / pLen, dropOrigin[2] / pLen];
            let tA = [1, 0, 0];
            if (Math.abs(uN[0]) > 0.8) tA = [0, 1, 0];
            const tB = [
              uN[1] * tA[2] - uN[2] * tA[1],
              uN[2] * tA[0] - uN[0] * tA[2],
              uN[0] * tA[1] - uN[1] * tA[0]
            ];
            const bL = Math.hypot(tB[0], tB[1], tB[2]) || 1;
            const uF = [tB[0] / bL, tB[1] / bL, tB[2] / bL];
            const uR = [
              uN[1] * uF[2] - uN[2] * uF[1],
              uN[2] * uF[0] - uN[0] * uF[2],
              uN[0] * uF[1] - uN[1] * uF[0]
            ];
            const dropType = String(entry.name || "").toLowerCase();
            for (let k = 0; k < count; k++) {
              const ang = ((i * 13 + k) / Math.max(1, count)) * Math.PI * 2;
              const rad = 0.08 + (k % 3) * 0.04;
              const offR = Math.cos(ang) * rad;
              const offF = Math.sin(ang) * rad;
              collectibles.push({
                position: [
                  dropOrigin[0] + uR[0] * offR + uF[0] * offF,
                  dropOrigin[1] + uR[1] * offR + uF[1] * offF,
                  dropOrigin[2] + uR[2] * offR + uF[2] * offF
                ],
                normal: uN,
                R: uR,
                F: uF,
                type: dropType,
                size: 0.16,
                active: true,
                isDynamic: true,
                seed: Math.random()
              });
            }
            window.pendingDynamicCollectibleRefresh = true;
          }
        }

        if (typeof activeTargetNPC !== "undefined" && activeTargetNPC === npc) {
          activeTargetNPC = null;
        }
        if (typeof window !== "undefined" && window.tantoShirasayaState && window.tantoShirasayaState.lockedTarget === npc) {
          window.tantoShirasayaState.lockedTarget = null;
        }
        if (typeof window.recycleAndRespawnNpc === "function") {
          window.recycleAndRespawnNpc(npc);
        }
        if (isActorPlayer && typeof showNotice === "function") {
          if (droppedOverflow && !addedAny) {
            showNotice("🗡️🥩 แล่ซาก Georgiacetus สำเร็จ! กระเป๋าเต็ม จึงวาง เนื้อเหนียว x20 และ หนัง x10 บนพื้น");
          } else if (droppedOverflow) {
            showNotice("🗡️🥩 แล่ซาก Georgiacetus สำเร็จ! (เก็บลงกระเป๋าและวางส่วนเกินบนพื้น)");
          } else {
            showNotice("🗡️🥩 แล่ซาก Georgiacetus! ได้รับ เนื้อเหนียว x20 และ หนัง x10");
          }
        }
        if (!isActorPlayer && actor && typeof actor.setExpression === "function") {
          actor.setExpression("(^o^)");
        }
        return true;
      };

      window.getUnifiedMeleeReach = function() {
        return (typeof meleeLockDistance === "number" && meleeLockDistance > 0.05)
          ? meleeLockDistance
          : ((typeof actionReachDistance === "number" && actionReachDistance > 0.05) ? actionReachDistance : 0.25);
      };

      function checkNpcMeleeHit(dmg = 1, customWeaponLabel = null, options = null) {
        const actor = (options && options.actor && typeof window !== "undefined" && window.ActorCore)
          ? window.ActorCore.resolveActor(options.actor)
          : ((typeof window !== "undefined" && window.ActorCore) ? window.ActorCore.getPlayerActor() : null);
        const isActorPlayer = !actor || actor.isPlayer !== false;
        const hitSet = (options && options.hitSet) ? options.hitSet : null;
        const isOmni = !!(options && options.omni);
        const coneCos = (options && typeof options.coneCos === "number") ? options.coneCos : null;
        const maxVert = (options && typeof options.maxVert === "number") ? options.maxVert : null;
        const lockedTarget = (options && options.lockedTarget) ? options.lockedTarget : ((options && options.targetEntity) ? options.targetEntity : null);
        const isShirasayaHit = !!(customWeaponLabel && (customWeaponLabel.indexOf("ชิราซายะ") !== -1 || customWeaponLabel.indexOf("Aegis-Shift") !== -1));
        const inferredWeaponId = (options && options.weaponId)
          ? String(options.weaponId).toUpperCase()
          : ((customWeaponLabel && (customWeaponLabel.indexOf("มีดตันโตะ") !== -1 || customWeaponLabel.indexOf("ชิราซายะ") !== -1))
            ? "TANTO"
            : ((actor && typeof actor.getActiveItem === "function" && actor.getActiveItem() && actor.getActiveItem().name)
              ? String(actor.getActiveItem().name).toUpperCase()
              : null));
        const baseReachDist = (typeof actionReachDistance === "number" ? actionReachDistance : 1.0);
        const reachDist = (options && typeof options.reachOverride === "number")
          ? options.reachOverride
          : (!isActorPlayer ? Math.max(baseReachDist, 0.75) : baseReachDist);

        const basis = (actor && typeof window !== "undefined" && window.ActorCore) ? window.ActorCore.getBasis(actor) : null;
        let nx, ny, nz, F, charPos, pScale, gSeed;
        if (basis) {
          nx = basis.normal[0]; ny = basis.normal[1]; nz = basis.normal[2];
          F = basis.F;
          charPos = basis.centerPos;
          pScale = basis.pScale;
          gSeed = basis.seed;
        } else {
          const sinTheta = Math.sin(charTheta);
          const cosTheta = Math.cos(charTheta);
          const sinPhi = Math.sin(charPhi);
          const cosPhi = Math.cos(charPhi);

          nx = sinTheta * cosPhi;
          ny = cosTheta;
          nz = sinTheta * sinPhi;

          gSeed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : (typeof globalSeed !== "undefined" ? globalSeed : 0);
          const height = (typeof getHeightOnSphere === "function") ? getHeightOnSphere(charTheta, charPhi, gSeed) : 0;
          pScale = (typeof playerScale === "number") ? playerScale : 0.1;
          const terrainRadius = RADIUS + height * HEIGHT_SCALE;
          const actualPlayerRadius = (typeof playerCenterRadius === "number" && playerCenterRadius !== null)
            ? playerCenterRadius
            : (terrainRadius + 0.46 * pScale);
          charPos = [actualPlayerRadius * nx, actualPlayerRadius * ny, actualPlayerRadius * nz];

          const East = [-sinPhi, 0, cosPhi];
          const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
          const cosH = Math.cos(charHeading);
          const sinH = Math.sin(charHeading);
          F = [
            North[0] * cosH + East[0] * sinH,
            North[1] * cosH + East[1] * sinH,
            North[2] * cosH + East[2] * sinH,
          ];
        }

        const hitCenter = [charPos[0], charPos[1], charPos[2]];
        let hitTarget = null;
        let minScore = Infinity;

        const evalTargetHit = (nPos, physicalRadius, entityRef) => {
          const dx = nPos[0] - hitCenter[0];
          const dy = nPos[1] - hitCenter[1];
          const dz = nPos[2] - hitCenter[2];

          const h = dx * nx + dy * ny + dz * nz;
          const t = dx * F[0] + dy * F[1] + dz * F[2];

          const rx = dx - t * F[0];
          const ry = dy - t * F[1];
          const rz = dz - t * F[2];
          const distToRaySq = rx * rx + ry * ry + rz * rz;
          const dist3DSq = dx * dx + dy * dy + dz * dz;
          const horizDistSq = Math.max(0, dist3DSq - h * h);

          if (isOmni) {
            // Short 360° AOE (Spinning Cyclone Skill 3 ONLY)
            const maxR = reachDist + physicalRadius;
            const vertLimit = (maxVert !== null ? maxVert : 0.72) + physicalRadius;
            if (horizDistSq <= maxR * maxR && Math.abs(h) <= vertLimit) {
              return { hit: true, score: dist3DSq };
            }
            return { hit: false, score: Infinity };
          }

          if (coneCos !== null) {
            // Directional forward slash arc (Steps 1, 2, 4 — does NOT hit behind or 360°!)
            const maxR = reachDist + physicalRadius;
            const vertLimit = (maxVert !== null ? maxVert : 0.65) + physicalRadius;
            if (dist3DSq > maxR * maxR || Math.abs(h) > vertLimit) {
              return { hit: false, score: Infinity };
            }
            const horizLen = Math.sqrt(horizDistSq);
            const isCloseInFront = (horizLen <= (0.26 + physicalRadius) && t >= -0.02);
            const cosAngle = horizLen > 1e-4 ? (t / horizLen) : 1.0;
            const effectiveCone = (lockedTarget && entityRef === lockedTarget) ? Math.min(coneCos, 0.15) : coneCos;
            if (isCloseInFront || (t >= 0.0 && cosAngle >= effectiveCone)) {
              const lockBonus = (lockedTarget && entityRef === lockedTarget) ? -0.35 : 0.0;
              return { hit: true, score: dist3DSq + lockBonus };
            }
            return { hit: false, score: Infinity };
          }

          if (actionReachMode === 1 && isActorPlayer) {
            const hitRadiusSq = physicalRadius * physicalRadius;
            if (distToRaySq <= hitRadiusSq) {
              const distanceToSurface = Math.max(0, t - physicalRadius);
              if (t > 0.0 && distanceToSurface <= reachDist && h >= -15.0 && h <= 15.0) {
                return { hit: true, score: distToRaySq * 2.0 + t };
              }
            }
          } else {
            const reachInfo = (typeof isTargetWithinReach === "function") ? isTargetWithinReach(nPos, reachDist + physicalRadius, basis || actor) : null;
            if (reachInfo && reachInfo.valid) {
              return { hit: true, score: reachInfo.perpSq };
            }
          }
          return { hit: false, score: Infinity };
        };

        // 1. Check amphibians (NPCs: Meganeura, Isopod, Placoderm, Georgiacetus, + butcherable corpses with Tanto)
        if (typeof amphibians !== "undefined" && Array.isArray(amphibians)) {
          for (let npc of amphibians) {
            const isAlive = !npc.ragdollEnabled && (npc.hp === undefined || npc.hp > 0);
            const isButcherable = (inferredWeaponId === "TANTO") && window.isButcherableNpcCorpse(npc, "TANTO");
            if (!isAlive && !isButcherable) continue;
            if (hitSet && hitSet.has(npc)) continue;
            let nPos = (typeof window !== "undefined" && typeof window.getNPCTargetPoint === "function")
              ? (window.getNPCTargetPoint(npc) || npc.position || [0, 0, 0])
              : (npc.position || [0, 0, 0]);
            if (npc.ragdollPos && npc.ragdollInitialized && (!window || typeof window.getNPCTargetPoint !== "function")) {
              nPos = npc.ragdollPos;
            }

            const physicalRadius = window.getMeleeEntityRadius(npc);
            const res = evalTargetHit(nPos, physicalRadius, npc);
            if (res.hit && res.score < minScore) {
              minScore = res.score;
              hitTarget = { type: "amphibian", entity: npc };
            }
          }
        }

        // 2. Check Player Clones (only hit other actors, never self)
        if (!hitTarget && typeof window !== "undefined" && Array.isArray(window.playerClonesState)) {
          for (let clone of window.playerClonesState) {
            if (!clone || (actor && actor.isClone && clone === actor.state) || (clone.hp !== undefined && clone.hp <= 0)) continue;
            if (hitSet && hitSet.has(clone)) continue;
            let cPos = clone.position;
            if (!cPos && typeof clone.theta === "number" && typeof clone.phi === "number") {
              const cSinT = Math.sin(clone.theta);
              const cCosT = Math.cos(clone.theta);
              const cSinP = Math.sin(clone.phi);
              const cCosP = Math.cos(clone.phi);
              const cR = RADIUS + ((typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(clone.theta, clone.phi, gSeed) : 0) * HEIGHT_SCALE);
              cPos = [cR * cSinT * cCosP, cR * cCosT, cR * cSinT * cSinP];
            }
            if (!cPos) continue;

            const physicalRadius = 0.25 * (pScale / 0.1);
            const res = evalTargetHit(cPos, physicalRadius, clone);
            if (res.hit && res.score < minScore) {
              minScore = res.score;
              hitTarget = { type: "clone", entity: clone };
            }
          }
        }

        if (hitTarget) {
          if (hitTarget.type === "amphibian") {
            const npc = hitTarget.entity;
            if (npc.ragdollEnabled && window.isButcherableNpcCorpse(npc, inferredWeaponId)) {
              window.butcherNpcCorpse(actor, npc);
            } else {
              if (npc.hp === undefined) {
                const regHp = (window.NpcRegistry && window.NpcRegistry[npc.type]) ? window.NpcRegistry[npc.type].maxHp : 1;
                npc.hp = regHp;
                npc.maxHp = regHp;
              }
              npc.hp -= dmg;
              let hpHearts = "";
              for (let i = 0; i < npc.maxHp; i++) {
                hpHearts += i < npc.hp ? "🔴" : "⚪";
              }
              if (isActorPlayer && typeof showNotice === "function") {
                const hitMsg = customWeaponLabel
                  ? `${customWeaponLabel} ทำดาเมจ ${dmg} จุด (Hit target! -${dmg} DMG) ${hpHearts}`
                  : `🌿💥 ฟาดด้วยกิ่งไม้! ทำดาเมจ ${dmg} จุด (Hit target! -${dmg} DMG) ${hpHearts}`;
                showNotice(hitMsg);
              }
              if (npc.hp <= 0) {
                npc.ragdollEnabled = true;
                if (!isActorPlayer && typeof window.grantNpcKillLootToActor === "function") {
                  window.grantNpcKillLootToActor(actor, npc);
                }
                if (isActorPlayer && typeof showNotice === "function") {
                  showNotice("💀 กำจัดเป้าหมายสำเร็จ! (Target eliminated!)");
                }
              } else {
                npc.ragdollEnabled = false;
              }

              npc.ragdollVel = [
                F[0] * 0.14,
                F[1] * 0.14,
                F[2] * 0.14
              ];
            }
          } else if (hitTarget.type === "clone") {
            const clone = hitTarget.entity;
            if (clone.hp === undefined) {
              clone.hp = 3;
              clone.maxHp = 3;
            }
            clone.hp -= dmg;
            let hpHearts = "";
            for (let i = 0; i < clone.maxHp; i++) {
              hpHearts += i < clone.hp ? "🔴" : "⚪";
            }
            clone.emoji = "😵";
            clone.emojiTimer = 3.0;
            if (isActorPlayer && typeof showNotice === "function") {
              const cloneMsg = customWeaponLabel
                ? `${customWeaponLabel} (โคลน) ทำดาเมจ ${dmg} จุด (Hit clone! -${dmg} DMG) ${hpHearts}`
                : `🌿💥 ฟาดโคลนด้วยกิ่งไม้! ทำดาเมจ ${dmg} จุด (Hit clone! -${dmg} DMG) ${hpHearts}`;
              showNotice(cloneMsg);
            }
          }

          if (hitSet && hitTarget.entity) {
            hitSet.add(hitTarget.entity);
          }

          if (isShirasayaHit) {
            if (typeof playSwordSlashSound === "function") {
              if (typeof playChopSound === "function") playChopSound();
            }
          } else if (typeof playSplashSound === "function") {
            playSplashSound(0.8);
          } else if (typeof playChopSound === "function") {
            playChopSound();
          }
          return hitTarget;
        }
        return null;
      }
      window.checkNpcMeleeHit = checkNpcMeleeHit;

      // Shared Tool Target Validation rule (Data-driven via ITEM_DEFINITIONS + backward-compatible fallback)
      window.checkToolTargetValid = function(toolType, targetType) {
        if (!toolType || !targetType) return false;
        const normTool = String(toolType).toUpperCase();
        if (normTool === "HAND") return true;
        const def = (typeof getItemDefinition === "function") ? getItemDefinition(normTool) : (window.getItemDefinition ? window.getItemDefinition(normTool) : null);
        if (def && Array.isArray(def.targetTypes)) {
          return def.targetTypes.includes(targetType);
        }
        if (normTool === "AXE" || normTool === "TANTO") {
          return targetType === "tree";
        }
        if (normTool === "PICKAXE") {
          return targetType === "rock" || targetType === "iron_ore" || targetType === "gold_ore" || targetType === "glow_ore";
        }
        if (normTool === "AEGIS_SHIFT") {
          return targetType === "tree" || targetType === "rock" || targetType === "iron_ore" || targetType === "gold_ore" || targetType === "glow_ore";
        }
        return false;
      };

      // Shared Food Healing Rules (Data-driven via ITEM_DEFINITIONS + fallback)
      window.getFoodItemHealAmount = function(itemName) {
        if (!itemName) return 0;
        const def = (typeof getItemDefinition === "function") ? getItemDefinition(itemName) : (window.getItemDefinition ? window.getItemDefinition(itemName) : null);
        if (def && def.actionType === "CONSUMABLE_FOOD" && typeof def.healHP === "number") {
          return def.healHP;
        }
        const norm = String(itemName).toUpperCase();
        if (norm === "FRIED_BUG") return 2;
        if (norm === "DRAGON_FRUIT" || norm === "DRAGONFRUIT") return 1;
        if (norm === "BREAD") return 10;
        if (norm === "MEAT" || norm === "COOKED_MEAT") return 15;
        if (norm === "APPLE") return 4;
        return 0;
      };

  function getObstacleHarvestDrops(hitType, toolType) {
    const isAegisHit = (toolType === "AEGIS_SHIFT");
    const isEffectiveAxe = (toolType === "AXE" || (isAegisHit && hitType === "tree"));
    const isEffectivePick = (toolType === "PICKAXE" || (isAegisHit && (hitType === "rock" || hitType === "iron_ore" || hitType === "gold_ore" || hitType === "glow_ore")));
    const drops = [];

    if (isEffectiveAxe && hitType === "tree") {
      const numLogs = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < numLogs; i++) {
        drops.push({ type: "log", itemName: "LOG", icon: "🪵", color: [0.5, 0.3, 0.15], size: 0.075 + Math.random() * 0.025, isHand: false });
      }
      const numBranches = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < numBranches; i++) {
        drops.push({ type: "branch", itemName: "BRANCH", icon: "🌿", color: [0.4 + Math.random() * 0.1, 0.25 + Math.random() * 0.05, 0.15], size: 0.015 + Math.random() * 0.02, isHand: false });
      }
    } else if (isEffectivePick && (hitType === "rock" || hitType === "iron_ore" || hitType === "gold_ore" || hitType === "glow_ore")) {
      if (hitType === "iron_ore") {
        const numBig = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < numBig; i++) drops.push({ type: "iron_ore", itemName: "IRON_ORE", icon: "🟥", color: [0.45, 0.22, 0.18], size: 0.045 + Math.random() * 0.02, isHand: false });
        const numSmall = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < numSmall; i++) drops.push({ type: "rock", itemName: "ROCK", icon: "🪨", color: [0.4, 0.4, 0.4], size: 0.02 + Math.random() * 0.02, isHand: false });
      } else if (hitType === "gold_ore") {
        const numBig = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < numBig; i++) drops.push({ type: "gold_ore", itemName: "GOLD_ORE", icon: "🪙", color: [0.85, 0.68, 0.12], size: 0.045 + Math.random() * 0.02, isHand: false });
        drops.push({ type: "rock", itemName: "ROCK", icon: "🪨", color: [0.4, 0.4, 0.4], size: 0.02 + Math.random() * 0.02, isHand: false });
      } else if (hitType === "glow_ore") {
        const numBig = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < numBig; i++) drops.push({ type: "glow_ore", itemName: "GLOW_ORE", icon: "✨", color: [0.22, 0.95, 0.88], size: 0.045 + Math.random() * 0.02, isHand: false });
        const numSmall = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < numSmall; i++) drops.push({ type: "rock", itemName: "ROCK", icon: "🪨", color: [0.4, 0.4, 0.4], size: 0.02 + Math.random() * 0.02, isHand: false });
      } else {
        const numBig = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < numBig; i++) drops.push({ type: "big_rock", itemName: "BIG_ROCK", icon: "🪨", color: [0.5, 0.5, 0.5], size: 0.05 + Math.random() * 0.03, isHand: false });
        const numSmall = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < numSmall; i++) drops.push({ type: "rock", itemName: "ROCK", icon: "🪨", color: [0.4, 0.4, 0.4], size: 0.02 + Math.random() * 0.02, isHand: false });
      }
    } else if (toolType === "HAND") {
      const dropType = hitType === "tree" ? "branch" : "rock";
      const numDrops = 1 + Math.floor(Math.random() * 2);
      const dropColor = dropType === "rock" ? [0.5, 0.5, 0.5] : [0.5, 0.3, 0.15];
      for (let i = 0; i < numDrops; i++) {
        drops.push({ type: dropType, itemName: dropType.toUpperCase(), icon: dropType === "rock" ? "🪨" : "🌿", color: dropColor, size: 0.015 + Math.random() * 0.02, isHand: true });
      }
    }
    return drops;
  }
  window.getObstacleHarvestDrops = getObstacleHarvestDrops;

  function checkMeleeHit(toolType, options = null) {
    const actor = (options && options.actor && typeof window !== "undefined" && window.ActorCore)
      ? window.ActorCore.resolveActor(options.actor)
      : ((typeof window !== "undefined" && window.ActorCore) ? window.ActorCore.getPlayerActor() : null);
    const isActorPlayer = !actor || actor.isPlayer !== false;
    const directCollect = !!(options && options.directCollect);
    const preferredTarget = (options && options.targetObstacle) ? options.targetObstacle : null;

    const basis = (actor && typeof window !== "undefined" && window.ActorCore) ? window.ActorCore.getBasis(actor) : null;
    let charPos, F;
    if (basis) {
      charPos = basis.terrainPos;
      F = basis.F;
    } else {
      const sinTheta = Math.sin(charTheta);
      const cosTheta = Math.cos(charTheta);
      const sinPhi = Math.sin(charPhi);
      const cosPhi = Math.cos(charPhi);

      const nx = sinTheta * cosPhi;
      const ny = cosTheta;
      const nz = sinTheta * sinPhi;
      
      const height = getHeightOnSphere(charTheta, charPhi, globalSeed);
      const terrainRadius = RADIUS + height * HEIGHT_SCALE;
      
      charPos = [terrainRadius * nx, terrainRadius * ny, terrainRadius * nz];
      
      const East = [-sinPhi, 0, cosPhi];
      const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
      const cosH = Math.cos(charHeading);
      const sinH = Math.sin(charHeading);
      F = [
        North[0] * cosH + East[0] * sinH,
        North[1] * cosH + East[1] * sinH,
        North[2] * cosH + East[2] * sinH,
      ];
    }
    
    const hitCenter = [charPos[0], charPos[1], charPos[2]];
    
    let bestIndex = -1;
    let bestType = null;
    let minScore = Infinity;
    
    for (let i = 0; i < natureObstacles.length; i++) {
       const obs = natureObstacles[i];
        if (obs.type === "tree" || obs.type === "rock" || obs.type === "iron_ore" || obs.type === "gold_ore" || obs.type === "glow_ore") {
          if (typeof window.checkToolTargetValid === "function") {
            if (!window.checkToolTargetValid(toolType, obs.type)) continue;
          } else {
            if ((toolType === "AXE" || toolType === "TANTO") && obs.type !== "tree") continue;
            if (toolType === "PICKAXE" && obs.type === "tree") continue;
          }
          
          const dx = obs.position[0] - hitCenter[0];
          const dy = obs.position[1] - hitCenter[1];
          const dz = obs.position[2] - hitCenter[2];
          
          const h = dx * obs.normal[0] + dy * obs.normal[1] + dz * obs.normal[2];
          const t = dx * F[0] + dy * F[1] + dz * F[2];
          
          const rx = dx - t * F[0];
          const ry = dy - t * F[1];
          const rz = dz - t * F[2];
          const distToRaySq = rx * rx + ry * ry + rz * rz;
          
          const physicalRadius = obs.type === "tree" ? (obs.radius / 5.0) : obs.radius;
          const hitRadius = obs.radius;
          const hitRadiusSq = hitRadius * hitRadius;
          
          let isHit = false;
          let score = Infinity;
          
          if (actionReachMode === 1 && isActorPlayer) {
              if (distToRaySq <= hitRadiusSq) {
                  const distanceToSurface = Math.max(0, t - physicalRadius);
                  if (t > 0.0 && distanceToSurface <= actionReachDistance && h >= -15.0 && h <= 15.0) {
                      isHit = true;
                      score = distToRaySq * 2.0 + t;
                  }
              }
          } else {
              const minCloneReach = (options && typeof options.reachOverride === "number") ? options.reachOverride : 0.75;
              const effectiveReach = (!isActorPlayer && preferredTarget && obs === preferredTarget)
                ? Math.max(actionReachDistance, minCloneReach)
                : actionReachDistance;
              const reachInfo = isTargetWithinReach(obs.position, effectiveReach + physicalRadius, basis || actor);
              if (reachInfo.valid) {
                  isHit = true;
                  score = reachInfo.perpSq + ((preferredTarget && obs === preferredTarget) ? -1.0 : 0.0);
              }
          }
          
          if (isHit && score < minScore) {
              minScore = score;
              bestIndex = i;
              bestType = obs.type;
          }
       }
    }
    
    // Check mature trees in wood planter boxes (player & clones share tree chopping mechanics)
    let bestPlanterTree = null;
    let minPlanterScore = Infinity;

    if (toolType === "AXE" || toolType === "HAND" || toolType === "TANTO" || toolType === "AEGIS_SHIFT") {
       const plantCandidates = (typeof collectibles !== "undefined" && collectibles) ? collectibles : [];
       for (let i = 0; i < plantCandidates.length; i++) {
          const c = plantCandidates[i];
          if (!c || !c.active || c.isPreview || c.type !== "wood_planter_box" || !c.plantData || !c.position) continue;
          const pData = c.plantData;
          const sType = String(pData.seedType || "").toUpperCase();
          if (!sType.includes("DRAGON") && !sType.includes("BRANCH")) continue;

          const cNorm = (c.normal && c.normal.length === 3) ? c.normal : [0, 1, 0];
          const treePos = [
             c.position[0] + cNorm[0] * 0.15,
             c.position[1] + cNorm[1] * 0.15,
             c.position[2] + cNorm[2] * 0.15
          ];

          const dx = treePos[0] - hitCenter[0];
          const dy = treePos[1] - hitCenter[1];
          const dz = treePos[2] - hitCenter[2];

          const h = dx * cNorm[0] + dy * cNorm[1] + dz * cNorm[2];
          const t = dx * F[0] + dy * F[1] + dz * F[2];

          const rx = dx - t * F[0];
          const ry = dy - t * F[1];
          const rz = dz - t * F[2];
          const distToRaySq = rx * rx + ry * ry + rz * rz;

          const treeRadius = 0.28;
          const physicalRadius = treeRadius / 4.0;
          const hitRadiusSq = treeRadius * treeRadius;

          let isHit = false;
          let score = Infinity;

          if (actionReachMode === 1 && isActorPlayer) {
             if (distToRaySq <= hitRadiusSq) {
                const distanceToSurface = Math.max(0, t - physicalRadius);
                if (t > 0.0 && distanceToSurface <= actionReachDistance && h >= -15.0 && h <= 15.0) {
                   isHit = true;
                   score = distToRaySq * 2.0 + t;
                }
             }
          } else {
             const reachInfo = (typeof isTargetWithinReach === "function")
                ? isTargetWithinReach(treePos, actionReachDistance + physicalRadius, basis || actor)
                : { valid: Math.hypot(dx, dy, dz) <= (actionReachDistance + physicalRadius), perpSq: dx*dx + dy*dy + dz*dz };
             if (reachInfo.valid) {
                isHit = true;
                score = reachInfo.perpSq;
             }
          }

          if (isHit && score < minPlanterScore) {
             minPlanterScore = score;
             bestPlanterTree = c;
          }
       }
    }

    if (bestPlanterTree && minPlanterScore < minScore) {
       if (isActorPlayer && toolType === "AEGIS_SHIFT" && typeof window !== "undefined" && window.aegisShiftState) {
         window.aegisShiftState.toolMode = "axe";
       }
       const pData = bestPlanterTree.plantData;
       if (!pData.watered || !pData.plantTime) {
          if (isActorPlayer && typeof showNotice === "function") {
             showNotice(`💧 ต้นอ่อนยังไม่ได้รดน้ำ! กรุณาใช้ถังใส่น้ำ (Water Bucket) มารดน้ำเพื่อเริ่มเติบโต`);
          }
          return true;
       }
       const elapsed = (Date.now() - pData.plantTime) / 1000;
       const isMature = elapsed >= (pData.growthDuration || 300);

       if (!isMature) {
          if (typeof playChopSound === "function") playChopSound(bestPlanterTree.position);
          if (isActorPlayer && typeof showNotice === "function") {
             const rem = Math.ceil((pData.growthDuration || 300) - elapsed);
             const m = Math.floor(rem / 60);
             const s = rem % 60;
             showNotice(`⏳ ต้นไม้กำลังเติบโต เหลืออีก ${m}:${s < 10 ? '0' : ''}${s} นาที (ยังตัดไม่ได้)`);
          }
          return true;
       }

       if (typeof playChopSound === "function") playChopSound(bestPlanterTree.position);

       if (toolType === "HAND" || toolType === "TANTO") {
          pData.handHits = (pData.handHits || 0) + (toolType === "TANTO" ? 2 : 1);
          if (pData.handHits >= 4) {
             pData.handHits = 0;
             const tNormal = bestPlanterTree.normal || [0, 1, 0];
             let tTangent = [1, 0, 0];
             if (Math.abs(tNormal[0]) > 0.9) tTangent = [0, 1, 0];
             let tBitangent = [
                tNormal[1] * tTangent[2] - tNormal[2] * tTangent[1],
                tNormal[2] * tTangent[0] - tNormal[0] * tTangent[2],
                tNormal[0] * tTangent[1] - tNormal[1] * tTangent[0]
             ];
             const tBLen = Math.hypot(tBitangent[0], tBitangent[1], tBitangent[2]) || 1;
             tBitangent = [tBitangent[0]/tBLen, tBitangent[1]/tBLen, tBitangent[2]/tBLen];
             tTangent = [
                tBitangent[1] * tNormal[2] - tBitangent[2] * tNormal[1],
                tBitangent[2] * tNormal[0] - tBitangent[0] * tNormal[2],
                tBitangent[0] * tNormal[1] - tBitangent[1] * tNormal[0]
             ];
             const numDrops = 1 + Math.floor(Math.random() * 2);
             for (let i = 0; i < numDrops; i++) {
                if (directCollect && actor) {
                  actor.addItem({ name: "BRANCH", icon: "🌿", count: 1 }, false, false);
                } else {
                  spawnDrop(bestPlanterTree.position, "branch", tNormal, tTangent, tBitangent, [0.5, 0.3, 0.15], 0.015 + Math.random() * 0.02, true);
                }
             }
          }
          return true;
       }

       pData.hits = (pData.hits || 0) + 1;
       const requiredHits = 3;
       if (pData.hits >= requiredHits) {
          const tNormal = bestPlanterTree.normal || [0, 1, 0];
          let tTangent = [1, 0, 0];
          if (Math.abs(tNormal[0]) > 0.9) tTangent = [0, 1, 0];
          let tBitangent = [
             tNormal[1] * tTangent[2] - tNormal[2] * tTangent[1],
             tNormal[2] * tTangent[0] - tNormal[0] * tTangent[2],
             tNormal[0] * tTangent[1] - tNormal[1] * tTangent[0]
          ];
          const tBLen = Math.hypot(tBitangent[0], tBitangent[1], tBitangent[2]) || 1;
          tBitangent = [tBitangent[0]/tBLen, tBitangent[1]/tBLen, tBitangent[2]/tBLen];
          tTangent = [
             tBitangent[1] * tNormal[2] - tBitangent[2] * tNormal[1],
             tBitangent[2] * tNormal[0] - tBitangent[0] * tNormal[2],
             tBitangent[0] * tNormal[1] - tBitangent[1] * tNormal[0]
          ];

          const numLogs = 2 + Math.floor(Math.random() * 2);
          for (let i = 0; i < numLogs; i++) {
             if (directCollect && actor) actor.addItem({ name: "LOG", icon: "🪵", count: 1 }, false, false);
             else spawnDrop(bestPlanterTree.position, "log", tNormal, tTangent, tBitangent, [0.5, 0.3, 0.15], 0.075 + Math.random() * 0.025);
          }
          const numBranches = 1 + Math.floor(Math.random() * 2);
          for (let i = 0; i < numBranches; i++) {
             if (directCollect && actor) actor.addItem({ name: "BRANCH", icon: "🌿", count: 1 }, false, false);
             else spawnDrop(bestPlanterTree.position, "branch", tNormal, tTangent, tBitangent, [0.4 + Math.random() * 0.1, 0.25 + Math.random() * 0.05, 0.15], 0.015 + Math.random() * 0.02);
          }

          const sType = String(pData.seedType || "").toUpperCase();
          if (sType.includes("DRAGON")) {
             const numFruits = 2 + Math.floor(Math.random() * 2);
             for (let i = 0; i < numFruits; i++) {
                if (directCollect && actor) actor.addItem({ name: "DRAGON_FRUIT", icon: "🐉", count: 1 }, false, false);
                else spawnDrop(bestPlanterTree.position, "dragon_fruit", tNormal, tTangent, tBitangent, [0.95, 0.2, 0.4], 0.035 + Math.random() * 0.015);
             }
          }

          bestPlanterTree.plantData = null;
          bestPlanterTree.isDynamic = false;
          if (typeof window !== "undefined") {
             window.pendingCollectibleRefresh = true;
             window.pendingDynamicCollectibleRefresh = true;
          }
          if (typeof saveSettingsToLocalStorage === "function") {
             saveSettingsToLocalStorage();
          }
       }
       return true;
    }
    
    if (bestIndex !== -1) {
       const obs = natureObstacles[bestIndex];
       const hitType = bestType;
       const hitIndex = bestIndex;
       const isAegisHit = (toolType === "AEGIS_SHIFT");
       const isEffectiveAxe = (toolType === "AXE" || (isAegisHit && hitType === "tree"));
       const isEffectivePick = (toolType === "PICKAXE" || (isAegisHit && (hitType === "rock" || hitType === "iron_ore" || hitType === "gold_ore" || hitType === "glow_ore")));
       if (isActorPlayer && isAegisHit && typeof window !== "undefined" && window.aegisShiftState) {
         window.aegisShiftState.toolMode = (hitType === "tree") ? "axe" : "pickaxe";
       }
       
       if (hitType === "tree" && obs.isWhiteRedTree) {
         if (typeof window.detachTreeAttachedFruits === "function") {
           window.detachTreeAttachedFruits(obs);
         }
       }
       if (toolType !== "HAND" && toolType !== "TANTO") { obs.hits = (obs.hits || 0) + 1; } else { obs.handHits = (obs.handHits || 0) + (toolType === "TANTO" ? 2 : 1); }
       const requiredHits = 3;
       
       if (isEffectiveAxe && hitType === "tree" && typeof playChopSound === "function") playChopSound(obs.position);
       else if (isEffectivePick && (hitType === "rock" || hitType === "iron_ore" || hitType === "gold_ore" || hitType === "glow_ore") && typeof playRockHitSound === "function") playRockHitSound(obs.position);
       else if (toolType === "HAND" || toolType === "TANTO") {
         if (hitType === "tree" && typeof playChopSound === "function") playChopSound(obs.position);
         else if (hitType === "rock" && typeof playRockHitSound === "function") playRockHitSound(obs.position);
         if (obs.handHits >= 4) {
           obs.handHits = 0;
           const tNormal = obs.normal || [0, 1, 0];
           let tTangent = [1, 0, 0];
           if (Math.abs(tNormal[0]) > 0.9) tTangent = [0, 1, 0];
           let tBitangent = [
             tNormal[1] * tTangent[2] - tNormal[2] * tTangent[1],
             tNormal[2] * tTangent[0] - tNormal[0] * tTangent[2],
             tNormal[0] * tTangent[1] - tNormal[1] * tTangent[0]
           ];
           const tBLen = Math.sqrt(tBitangent[0]*tBitangent[0] + tBitangent[1]*tBitangent[1] + tBitangent[2]*tBitangent[2]);
           tBitangent = [tBitangent[0]/tBLen, tBitangent[1]/tBLen, tBitangent[2]/tBLen];
           tTangent = [
             tBitangent[1] * tNormal[2] - tBitangent[2] * tNormal[1],
             tBitangent[2] * tNormal[0] - tBitangent[0] * tNormal[2],
             tBitangent[0] * tNormal[1] - tBitangent[1] * tNormal[0]
           ];
           const dropType = hitType === "tree" ? "branch" : "rock";
           const numDrops = 1 + Math.floor(Math.random() * 2);
           const dropColor = dropType === "rock" ? [0.5, 0.5, 0.5] : [0.5, 0.3, 0.15];
           for (let i = 0; i < numDrops; i++) {
             if (directCollect && actor) actor.addItem({ name: dropType.toUpperCase(), icon: dropType === "rock" ? "🪨" : "🌿", count: 1 }, false, false);
             else spawnDrop(obs.position, dropType, tNormal, tTangent, tBitangent, dropColor, 0.015 + Math.random() * 0.02, true);
           }
         }
       }
       
       if (toolType !== "HAND" && toolType !== "TANTO" && obs.hits >= requiredHits) {
           if (isActorPlayer) console.log(toolType + " destroyed " + hitType + "!");
           
           const tNormal = obs.normal || [0, 1, 0];
           let tTangent = [1, 0, 0];
           if (Math.abs(tNormal[0]) > 0.9) tTangent = [0, 1, 0];
           let tBitangent = [
               tNormal[1] * tTangent[2] - tNormal[2] * tTangent[1],
               tNormal[2] * tTangent[0] - tNormal[0] * tTangent[2],
               tNormal[0] * tTangent[1] - tNormal[1] * tTangent[0]
           ];
           const tBLen = Math.sqrt(tBitangent[0]*tBitangent[0] + tBitangent[1]*tBitangent[1] + tBitangent[2]*tBitangent[2]);
           tBitangent = [tBitangent[0]/tBLen, tBitangent[1]/tBLen, tBitangent[2]/tBLen];
           tTangent = [
               tBitangent[1] * tNormal[2] - tBitangent[2] * tNormal[1],
               tBitangent[2] * tNormal[0] - tBitangent[0] * tNormal[2],
               tBitangent[0] * tNormal[1] - tBitangent[1] * tNormal[0]
           ];

           const drops = getObstacleHarvestDrops(hitType, toolType);
           for (let di = 0; di < drops.length; di++) {
             const d = drops[di];
             if (directCollect && actor) {
               actor.addItem({ name: d.itemName, icon: d.icon, count: 1 }, false, false);
             } else {
               spawnDrop(obs.position, d.type, tNormal, tTangent, tBitangent, d.color, d.size, d.isHand);
             }
           }

           if (hitType === "tree" && obs.isWhiteRedTree) {
             if (typeof window.detachTreeAttachedFruits === "function") {
               window.detachTreeAttachedFruits(obs);
             }
             if (obs.fruitPositions && obs.fruitPositions.length > 0) {
               obs.fruitPositions = [];
             }
           }
           
           if (hitType === "tree") {
               if (obs.id !== undefined && !choppedTrees.includes(obs.id)) choppedTrees.push(obs.id);
               window.choppedTrees = choppedTrees;
           } else {
               if (obs.id !== undefined && !destroyedRocks.includes(obs.id)) destroyedRocks.push(obs.id);
               window.destroyedRocks = destroyedRocks;
           }
           
           natureObstacles.splice(hitIndex, 1);
           
           if (obs.meshStart !== undefined && obs.meshEnd !== undefined) {
               const startF = obs.meshStart * 3;
               const endF = obs.meshEnd * 3;
               for (let j = startF; j < endF; j++) {
                   natureRawVertices[j] = 0;
               }
               gl.bindBuffer(gl.ARRAY_BUFFER, natureVertexBuffer);
               gl.bufferSubData(gl.ARRAY_BUFFER, startF * 4, new Float32Array(natureRawVertices.slice(startF, endF)));
           }
           if (typeof saveSettingsToLocalStorage === "function") {
               saveSettingsToLocalStorage();
           }
           return { hit: true, destroyed: true, obstacle: obs, hitType };
       }
       return { hit: true, destroyed: false, obstacle: obs, hitType };
    }
    if (toolType === "TANTO" && typeof window.cutGrassWithKnife === "function") {
        const grassRes = window.cutGrassWithKnife({ actor, directCollect });
        if (grassRes && grassRes.hit) {
            return grassRes;
        }
    }
    return false;
  }
  window.checkMeleeHit = checkMeleeHit;

function spawnDrop(pos, type, normal, tangent, bitangent, color, size, isHand=false) {
   const offsetRadius = 0.002 + Math.random() * 0.005;
   const offsetAngle = Math.random() * Math.PI * 2;
   const hOffset = 0.005 + Math.random() * 0.01;
   
   const dx = tangent[0]*offsetRadius*Math.cos(offsetAngle) + bitangent[0]*offsetRadius*Math.sin(offsetAngle) + normal[0]*hOffset;
   const dy = tangent[1]*offsetRadius*Math.cos(offsetAngle) + bitangent[1]*offsetRadius*Math.sin(offsetAngle) + normal[1]*hOffset;
   const dz = tangent[2]*offsetRadius*Math.cos(offsetAngle) + bitangent[2]*offsetRadius*Math.sin(offsetAngle) + normal[2]*hOffset;

   const collectible = {
       type: type,
       position: [pos[0] + dx, pos[1] + dy, pos[2] + dz],
       normal: normal,
       R: tangent,
       F: bitangent,
       U: normal,
       color: color,
       size: size,
       active: true,
       isDynamic: true,
       seed: Math.random()
   };
   
   if (isHand) {
       collectible.vel = [dx*0.01 + (Math.random()-0.5)*0.001, dy*0.01 + (Math.random()-0.5)*0.001, dz*0.01 + (Math.random()-0.5)*0.001];
       collectible.spin = [(Math.random()-0.5)*0.05, (Math.random()-0.5)*0.05, (Math.random()-0.5)*0.05];
       collectible.spinSpeed = 0.01 + Math.random()*0.02;
   }
   
   collectibles.push(collectible);
   if (typeof window !== "undefined") {
      window.pendingDynamicCollectibleRefresh = true;
      window.spawnDrop = spawnDrop;
   }
}

function cancelFloorPlacement() {
        if (isPlacingFloor) {
          isPlacingFloor = false;
          floorPlacementInfo = null;
          if (floorPreviewCollectible) {
            const idx = collectibles.indexOf(floorPreviewCollectible);
            if (idx !== -1) {
              collectibles.splice(idx, 1);
            }
            floorPreviewCollectible = null;
            pendingCollectibleRefresh = true;
            if (typeof refreshCollectiblesVBO === 'function') refreshCollectiblesVBO('preview');
          }
        }
      }

      function getSuppressRadius(type, size) {
          const t = (type || "").toLowerCase();
          const s = typeof size === "number" ? size : 0.25;
          if (t === "stone_floor") {
              return s * 10.0;
          }
          if (t === "wood_floor" || t === "thin_wood_floor") {
              return s * 2.4;
          }
          if (t === "campfire") {
              return s * 1.6;
          }
          return s * 2.4;
      }

      function suppressGrassUnder(pos, radius) {
          console.log('suppressGrassUnder', pos, radius);

          if (typeof grassChunks === 'undefined' || !natureRawVertices) return;
          let modified = false;
          let minStartF = Infinity;
          let maxEndF = 0;
          const rSq = radius * radius;
          
          for (let i = 0; i < grassChunks.length; i++) {
              const chunk = grassChunks[i];
              const dx = chunk.pos[0] - pos[0];
              const dy = chunk.pos[1] - pos[1];
              const dz = chunk.pos[2] - pos[2];
              
              if (dx*dx + dy*dy + dz*dz > (chunk.radius + radius) * (chunk.radius + radius)) {
                  continue; // Chunk is too far
              }
              
              // Check individual triangles in the chunk
              const startF = chunk.start * 3;
              const endF = (chunk.start + chunk.count) * 3;
              let chunkModified = false;
              let chunkMin = Infinity;
              let chunkMax = 0;
              
              for (let j = startF; j < endF; j += 9) {
                  // Triangle center
                  const cx = (natureRawVertices[j] + natureRawVertices[j+3] + natureRawVertices[j+6]) / 3;
                  const cy = (natureRawVertices[j+1] + natureRawVertices[j+4] + natureRawVertices[j+7]) / 3;
                  const cz = (natureRawVertices[j+2] + natureRawVertices[j+5] + natureRawVertices[j+8]) / 3;
                  
                  const vx = cx - pos[0];
                  const vy = cy - pos[1];
                  const vz = cz - pos[2];
                  
                  if (vx*vx + vy*vy + vz*vz < rSq) {
                      natureRawVertices[j] = 0; natureRawVertices[j+1] = 0; natureRawVertices[j+2] = 0;
                      natureRawVertices[j+3] = 0; natureRawVertices[j+4] = 0; natureRawVertices[j+5] = 0;
                      natureRawVertices[j+6] = 0; natureRawVertices[j+7] = 0; natureRawVertices[j+8] = 0;
                      chunkModified = true;
                      if (j < chunkMin) chunkMin = j;
                      if (j + 9 > chunkMax) chunkMax = j + 9;
                  }
              }
              
              if (chunkModified) {
                  console.log('Modified grass chunk, zeroed triangles!');
                  modified = true;
                  gl.bindBuffer(gl.ARRAY_BUFFER, natureVertexBuffer);
                  gl.bufferSubData(gl.ARRAY_BUFFER, chunkMin * 4, new Float32Array(natureRawVertices.slice(chunkMin, chunkMax)));
              }
          }
      }

      // ตัดกอหญ้าด้วยมีดตันโตะ (TANTO):
      // กอหญ้าทั้งกอจะหลุดออกจากพื้น (ลบออกจาก natureVertexBuffer ด้วย gl.bufferSubData)
      // และดรอปโมเดลใบหญ้าเดี่ยวออกมาตามจำนวนใบที่มีอยู่ในกอนั้นๆ จริงๆ
      function cutGrassWithKnife(options = null) {
          if (typeof grassChunks === "undefined" || !grassChunks || !natureRawVertices) return false;

          const actor = (options && options.actor && typeof window !== "undefined" && window.ActorCore)
            ? window.ActorCore.resolveActor(options.actor)
            : ((typeof window !== "undefined" && window.ActorCore) ? window.ActorCore.getPlayerActor() : null);
          const isActorPlayer = !actor || actor.isPlayer !== false;
          const directCollect = !!(options && options.directCollect);
          const isOmni = !!(options && options.omni);
          const maxTufts = (options && typeof options.maxTufts === "number") ? options.maxTufts : 1;

          const basis = (actor && typeof window !== "undefined" && window.ActorCore) ? window.ActorCore.getBasis(actor) : null;
          let charPos, F, N;
          if (basis && basis.terrainPos && basis.F) {
              charPos = basis.terrainPos;
              F = basis.F;
              if (basis.N && typeof basis.N[0] === "number") {
                  N = basis.N;
              } else if (basis.normal && typeof basis.normal[0] === "number") {
                  N = basis.normal;
              } else if (basis.up && typeof basis.up[0] === "number") {
                  N = basis.up;
              } else {
                  const pLen = Math.hypot(charPos[0], charPos[1], charPos[2]) || 1;
                  N = [charPos[0] / pLen, charPos[1] / pLen, charPos[2] / pLen];
              }
          } else {
              const sinTheta = Math.sin(charTheta);
              const cosTheta = Math.cos(charTheta);
              const sinPhi = Math.sin(charPhi);
              const cosPhi = Math.cos(charPhi);
              const nx = sinTheta * cosPhi;
              const ny = cosTheta;
              const nz = sinTheta * sinPhi;
              const gSeed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : 0;
              const height = (typeof getHeightOnSphere === "function") ? getHeightOnSphere(charTheta, charPhi, gSeed) : 0;
              const terrainRadius = RADIUS + height * HEIGHT_SCALE;
              charPos = [terrainRadius * nx, terrainRadius * ny, terrainRadius * nz];
              N = [nx, ny, nz];
              const East = [-sinPhi, 0, cosPhi];
              const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
              const cosH = Math.cos(charHeading);
              const sinH = Math.sin(charHeading);
              F = [
                  North[0] * cosH + East[0] * sinH,
                  North[1] * cosH + East[1] * sinH,
                  North[2] * cosH + East[2] * sinH
              ];
          }

          const baseReach = (typeof actionReachDistance === "number" ? actionReachDistance : 0.35);
          const slashReach = Math.max(baseReach, 0.48);
          const lateralRadius = isOmni ? slashReach : 0.30;
          const lateralRadiusSq = lateralRadius * lateralRadius;

          // ค้นหากอหญ้า (Tuft) ที่อยู่ในระยะคมมีด
          const candidateTufts = [];
          const seenTuftStarts = new Set();

          for (let cIdx = 0; cIdx < grassChunks.length; cIdx++) {
              const chunk = grassChunks[cIdx];
              const cdx = chunk.pos[0] - charPos[0];
              const cdy = chunk.pos[1] - charPos[1];
              const cdz = chunk.pos[2] - charPos[2];
              const maxChunkDist = chunk.radius + slashReach + 0.5;
              if (cdx * cdx + cdy * cdy + cdz * cdz > maxChunkDist * maxChunkDist) continue;

              const startF = chunk.start * 3;
              const endF = (chunk.start + chunk.count) * 3;

              for (let j = startF; j < endF; j += 9) {
                  const v0x = natureRawVertices[j],     v0y = natureRawVertices[j + 1], v0z = natureRawVertices[j + 2];
                  const v1x = natureRawVertices[j + 3], v1y = natureRawVertices[j + 4], v1z = natureRawVertices[j + 5];
                  if (v0x === 0 && v0y === 0 && v0z === 0 && v1x === 0 && v1y === 0 && v1z === 0) continue;

                  // จุดศูนย์กลางโคนกอหญ้า (ใน addGrassTuft ใบทุกใบในกอเดียวกันมี (p1 + p2) * 0.5 === gCenter เดียวกันเป๊ะ)
                  const bx = (v0x + v1x) * 0.5;
                  const by = (v0y + v1y) * 0.5;
                  const bz = (v0z + v1z) * 0.5;

                  const dx = bx - charPos[0];
                  const dy = by - charPos[1];
                  const dz = bz - charPos[2];
                  const distSq = dx * dx + dy * dy + dz * dz;
                  if (distSq > (slashReach + 0.15) * (slashReach + 0.15)) continue;

                  const h = dx * N[0] + dy * N[1] + dz * N[2];
                  if (Math.abs(h) > 0.38) continue;

                  const t = dx * F[0] + dy * F[1] + dz * F[2];
                  const rx = dx - t * F[0];
                  const ry = dy - t * F[1];
                  const rz = dz - t * F[2];
                  const perpSq = rx * rx + ry * ry + rz * rz;

                  let isHit = false;
                  let score = Infinity;

                  if (isOmni) {
                      if (distSq <= slashReach * slashReach) {
                          isHit = true;
                          score = distSq;
                      }
                  } else {
                      if (t >= -0.06 && t <= slashReach && perpSq <= lateralRadiusSq) {
                          isHit = true;
                          score = perpSq * 2.0 + Math.max(0, t);
                      } else if (distSq <= 0.18 * 0.18) {
                          // ยืนทับกอหญ้าอยู่ตรงเท้า
                          isHit = true;
                          score = distSq + 0.05;
                      }
                  }

                  if (isHit) {
                      // สแกนหาขอบเขตเริ่มต้นและสิ้นสุดของกอหญ้ากอนี้ทั้งหมดใน chunk
                      const tuftTolSq = 0.004 * 0.004;
                      let tuftStart = j;
                      while (tuftStart - 9 >= startF) {
                          const prev = tuftStart - 9;
                          const px = (natureRawVertices[prev] + natureRawVertices[prev + 3]) * 0.5;
                          const py = (natureRawVertices[prev + 1] + natureRawVertices[prev + 4]) * 0.5;
                          const pz = (natureRawVertices[prev + 2] + natureRawVertices[prev + 5]) * 0.5;
                          if ((px - bx) * (px - bx) + (py - by) * (py - by) + (pz - bz) * (pz - bz) <= tuftTolSq) {
                              tuftStart = prev;
                          } else {
                              break;
                          }
                      }
                      let tuftEnd = j + 9;
                      while (tuftEnd < endF) {
                          const nx2 = (natureRawVertices[tuftEnd] + natureRawVertices[tuftEnd + 3]) * 0.5;
                          const ny2 = (natureRawVertices[tuftEnd + 1] + natureRawVertices[tuftEnd + 4]) * 0.5;
                          const nz2 = (natureRawVertices[tuftEnd + 2] + natureRawVertices[tuftEnd + 5]) * 0.5;
                          if ((nx2 - bx) * (nx2 - bx) + (ny2 - by) * (ny2 - by) + (nz2 - bz) * (nz2 - bz) <= tuftTolSq) {
                              tuftEnd += 9;
                          } else {
                              break;
                          }
                      }

                      if (!seenTuftStarts.has(tuftStart)) {
                          seenTuftStarts.add(tuftStart);
                          candidateTufts.push({
                              tuftStart,
                              tuftEnd,
                              center: [bx, by, bz],
                              score
                          });
                      }
                      // ข้ามไปหลังจบกอนี้เลยเพื่อไม่ต้องเช็คใบซ้ำในกอเดิม
                      j = tuftEnd - 9;
                  }
              }
          }

          if (candidateTufts.length === 0) return false;
          candidateTufts.sort((a, b) => a.score - b.score);

          const tuftsToCut = candidateTufts.slice(0, maxTufts);
          let totalBladesCut = 0;
          const currentBiome = (typeof window !== "undefined" && window.CURRENT_BIOME) ? window.CURRENT_BIOME : "normal";
          const gSeed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : 0;

          for (let ti = 0; ti < tuftsToCut.length; ti++) {
              const tuft = tuftsToCut[ti];
              const gCenter = tuft.center;
              const cLen = Math.hypot(gCenter[0], gCenter[1], gCenter[2]) || 1;
              const gNx = gCenter[0] / cLen, gNy = gCenter[1] / cLen, gNz = gCenter[2] / cLen;
              const gTheta = Math.acos(Math.max(-1, Math.min(1, gNy)));
              const gPhi = Math.atan2(gNz, gNx);
              const surfData = (typeof getTerrainHeightAndColor === "function")
                  ? getTerrainHeightAndColor(gTheta, gPhi, gSeed)
                  : null;
              const groundColor = (surfData && surfData.color) ? surfData.color : null;

              const numBladesInTuft = Math.round((tuft.tuftEnd - tuft.tuftStart) / 9);

              for (let k = tuft.tuftStart, bIdx = 0; k < tuft.tuftEnd; k += 9, bIdx++) {
                  const p1x = natureRawVertices[k],     p1y = natureRawVertices[k + 1], p1z = natureRawVertices[k + 2];
                  const p2x = natureRawVertices[k + 3], p2y = natureRawVertices[k + 4], p2z = natureRawVertices[k + 5];
                  const tx  = natureRawVertices[k + 6], ty  = natureRawVertices[k + 7], tz  = natureRawVertices[k + 8];

                  // ลบใบหญ้าออกจาก VBO พื้นดาวทันที
                  natureRawVertices[k]     = 0; natureRawVertices[k + 1] = 0; natureRawVertices[k + 2] = 0;
                  natureRawVertices[k + 3] = 0; natureRawVertices[k + 4] = 0; natureRawVertices[k + 5] = 0;
                  natureRawVertices[k + 6] = 0; natureRawVertices[k + 7] = 0; natureRawVertices[k + 8] = 0;

                  if (p1x === 0 && p1y === 0 && p1z === 0 && p2x === 0 && p2y === 0 && p2z === 0) continue;

                  // คำนวณขนาดและทิศทางของใบหญ้าใบนี้จากโมเดลกอหญ้าจริง
                  const wx = (p1x - p2x) * 0.5, wy = (p1y - p2y) * 0.5, wz = (p1z - p2z) * 0.5;
                  const bladeWidth = Math.max(0.012, Math.min(0.026, Math.hypot(wx, wy, wz)));
                  const wLen = Math.hypot(wx, wy, wz) || 1;
                  const wDir = [wx / wLen, wy / wLen, wz / wLen];

                  const dxTip = tx - gCenter[0], dyTip = ty - gCenter[1], dzTip = tz - gCenter[2];
                  const bladeHeight = Math.max(0.085, Math.min(0.26, Math.hypot(dxTip, dyTip, dzTip)));
                  const tLen = Math.hypot(dxTip, dyTip, dzTip) || 1;
                  const tipDir = [dxTip / tLen, dyTip / tLen, dzTip / tLen];

                  // เวกเตอร์ตั้งฉากของใบหญ้าในจังหวะที่หลุดออกจากกอ
                  let bNormX = wDir[1] * tipDir[2] - wDir[2] * tipDir[1];
                  let bNormY = wDir[2] * tipDir[0] - wDir[0] * tipDir[2];
                  let bNormZ = wDir[0] * tipDir[1] - wDir[1] * tipDir[0];
                  const bnLen = Math.hypot(bNormX, bNormY, bNormZ) || 1;
                  bNormX /= bnLen; bNormY /= bnLen; bNormZ /= bnLen;
                  if (bNormX * gNx + bNormY * gNy + bNormZ * gNz < 0) {
                      bNormX = -bNormX; bNormY = -bNormY; bNormZ = -bNormZ;
                  }

                  // สีใบหญ้าตามพื้นผิวไบโอมเดียวกับ addGrassTuft
                  let baseToneR = 0.10 + Math.random() * 0.06;
                  let baseToneG = (currentBiome === "jungle" ? 0.65 : 0.58) + Math.random() * 0.12;
                  let baseToneB = 0.12 + Math.random() * 0.06;
                  if (groundColor && groundColor[1] > 0.20) {
                      baseToneR = Math.max(0.04, groundColor[0] * 0.85 + (Math.random() - 0.5) * 0.04);
                      baseToneG = Math.max(0.48, groundColor[1] * 1.12 + (Math.random() - 0.5) * 0.06);
                      baseToneB = Math.max(0.05, groundColor[2] * 0.85 + (Math.random() - 0.5) * 0.04);
                  }
                  const topColor = [
                      Math.max(0.02, Math.min(1.0, baseToneR)),
                      Math.max(0.35, Math.min(1.0, baseToneG)),
                      Math.max(0.02, Math.min(1.0, baseToneB))
                  ];
                  const botColor = [topColor[0] * 0.38, topColor[1] * 0.45, topColor[2] * 0.38];

                  totalBladesCut++;

                  if (directCollect && actor) {
                      actor.addItem({ name: "GRASS", icon: "🌱", label: "GRASS", count: 1 }, false, false);
                  } else {
                      // กระจายใบหญ้าแต่ละใบออกจากกอตามมุมของใบนั้นๆ เพื่อไม่ให้ซ้อนทับกันจุดเดียว
                      const fanAngle = (bIdx / Math.max(1, numBladesInTuft)) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
                      let tangX = -gNz, tangY = 0, tangZ = gNx;
                      if (Math.hypot(tangX, tangY, tangZ) < 0.1) { tangX = 1; tangY = 0; tangZ = 0; }
                      const tgLen = Math.hypot(tangX, tangY, tangZ) || 1;
                      tangX /= tgLen; tangY /= tgLen; tangZ /= tgLen;
                      const bitX = gNy * tangZ - gNz * tangY;
                      const bitY = gNz * tangX - gNx * tangZ;
                      const bitZ = gNx * tangY - gNy * tangX;

                      const outDirX = Math.cos(fanAngle) * tangX + Math.sin(fanAngle) * bitX;
                      const outDirY = Math.cos(fanAngle) * tangY + Math.sin(fanAngle) * bitY;
                      const outDirZ = Math.cos(fanAngle) * tangZ + Math.sin(fanAngle) * bitZ;

                      const initOffset = 0.014 + bIdx * 0.004;
                      const upLift = 0.022 + Math.random() * 0.015;
                      const spawnPos = [
                          gCenter[0] + outDirX * initOffset + gNx * upLift,
                          gCenter[1] + outDirY * initOffset + gNy * upLift,
                          gCenter[2] + outDirZ * initOffset + gNz * upLift
                      ];

                      const outSpeed = 0.0022 + Math.random() * 0.0020;
                      const upSpeed = 0.0038 + Math.random() * 0.0025;
                      const slashPush = 0.0014;

                      collectibles.push({
                          type: "grass",
                          position: spawnPos,
                          normal: [bNormX, bNormY, bNormZ],
                          R: [wDir[0], wDir[1], wDir[2]],
                          F: [tipDir[0], tipDir[1], tipDir[2]],
                          U: [bNormX, bNormY, bNormZ],
                          color: topColor,
                          botColor: botColor,
                          bladeHeight: bladeHeight,
                          bladeWidth: bladeWidth,
                          bladeCurve: (Math.random() - 0.5) * 0.55,
                          size: bladeHeight,
                          active: true,
                          isDynamic: true,
                          seed: Math.random(),
                          vel: [
                              outDirX * outSpeed + gNx * upSpeed + F[0] * slashPush,
                              outDirY * outSpeed + gNy * upSpeed + F[1] * slashPush,
                              outDirZ * outSpeed + gNz * upSpeed + F[2] * slashPush
                          ],
                          spinSpeed: (Math.random() < 0.5 ? 1 : -1) * (0.045 + Math.random() * 0.05)
                      });
                  }
              }

              // อัปเดตเฉพาะช่วงของกอหญ้าที่ถูกตัดใน GPU VBO ทันที
              gl.bindBuffer(gl.ARRAY_BUFFER, natureVertexBuffer);
              gl.bufferSubData(
                  gl.ARRAY_BUFFER,
                  tuft.tuftStart * 4,
                  new Float32Array(natureRawVertices.slice(tuft.tuftStart, tuft.tuftEnd))
              );

              if (!window.cutGrassPositions) window.cutGrassPositions = [];
              window.cutGrassPositions.push([
                  Number(gCenter[0].toFixed(3)),
                  Number(gCenter[1].toFixed(3)),
                  Number(gCenter[2].toFixed(3))
              ]);
          }

          if (totalBladesCut > 0) {
              window.pendingDynamicCollectibleRefresh = true;
              if (typeof playChopSound === "function") {
                  playChopSound(tuftsToCut[0].center);
              }
              return { hit: true, destroyed: true, hitType: "grass", bladesCut: totalBladesCut };
          }
          return false;
      }
      window.cutGrassWithKnife = cutGrassWithKnife;
      
      function placeFloor() {
        if (!isPlacingFloor || !floorPreviewCollectible) return;

        const placingItemName = floorPlacementInfo && floorPlacementInfo.item ? floorPlacementInfo.item.name : "";

        if (placingItemName === "OBSIDIAN_PAD_WARP" || placingItemName === "OBSIDIAN_COMPASS_PAD") {
          const currentPads = getPlacedObsidianPadsInOrder();
          if (currentPads.length >= MAX_OBSIDIAN_PADS) {
            if (typeof showNotice === "function") {
              const msg = (typeof window.t === "function") ? window.t("max_warp_pads_notice") : "🚫 วาง Obsidian Pad ได้สูงสุดไม่เกิน 5 อัน! (Max 5 Obsidian Pads)";
              showNotice(msg);
            }
            return;
          }
        }
        
        if (floorPreviewCollectible.isValidPlacement === false) {
           if (floorPreviewCollectible.type === "folding_ladder") {
             showNotice("ส่วนหัวและท้ายของบันไดต้องติดพื้นทั้ง 2 ด้าน และห้ามวางบนน้ำ! (Both ends must touch ground and cannot be placed on water)");
           } else if (floorPreviewCollectible.type === "wood_bed" || placingItemName === "WOOD_BED") {
             showNotice("🛏️ เตียงไม้ต้องวางบนพื้นไม้เท่านั้น! (Bed can only be placed on wooden floors)");
           } else if (floorPreviewCollectible.type === "lantern" || placingItemName === "LANTERN") {
             showNotice("🏮 ตะเกียงสามารถวางบนโต๊ะไม้และพื้นไม้เท่านั้น! (Lantern can only be placed on wooden tables and wooden floors)");
           } else {
             showNotice("พื้นที่ไม่เหมาะสมสำหรับการวาง! (Invalid placement)");
           }
           return;
        }

        // Play wood place sound
        playPlaceSound();

        // Convert preview to a static placed structure!
        floorPreviewCollectible.isPreview = false;
        floorPreviewCollectible.isDynamic = false;
        floorPreviewCollectible.color = placingItemName === "STONE_FLOOR" ? [0.6, 0.6, 0.6] : [0.65, 0.45, 0.25]; // beautiful wood color
        
        // Remove grass under placed structure & destroy overlapping trees/rocks for stone floor without drops
        if (placingItemName === "STONE_FLOOR" || placingItemName === "WOOD_FLOOR" || placingItemName === "THIN_WOOD_FLOOR" || placingItemName === "WOOD_ROOF" || placingItemName === "WOOD_WALL" || placingItemName === "WOOD_WINDOW" || placingItemName === "WOOD_DOOR" || placingItemName === "CAMPFIRE") {
            const rad = getSuppressRadius(placingItemName, floorPreviewCollectible.size);
            suppressGrassUnder(floorPreviewCollectible.position, rad);
        }

        if (placingItemName === "STONE_FLOOR") {
            const fpPos = floorPreviewCollectible.position;
            const clearRadSq = 3.2 * 3.2; // Destroy trees and rocks within stone floor area
            let obstaclesChanged = false;

            const nObs = (typeof natureObstacles !== "undefined" && natureObstacles) ? natureObstacles : (window.natureObstacles || []);
            for (let i = nObs.length - 1; i >= 0; i--) {
                const obs = nObs[i];
                if (!obs || !obs.position) continue;
                const dx = obs.position[0] - fpPos[0];
                const dy = obs.position[1] - fpPos[1];
                const dz = obs.position[2] - fpPos[2];
                if (dx * dx + dy * dy + dz * dz <= clearRadSq) {
                    if (obs.type === "tree") {
                        if (typeof choppedTrees !== "undefined") choppedTrees.push(obs.id);
                        else if (window.choppedTrees) window.choppedTrees.push(obs.id);
                    } else {
                        if (typeof destroyedRocks !== "undefined") destroyedRocks.push(obs.id);
                        else if (window.destroyedRocks) window.destroyedRocks.push(obs.id);
                    }

                    const rawVerts = (typeof natureRawVertices !== "undefined") ? natureRawVertices : window.natureRawVertices;
                    const vBuffer = (typeof natureVertexBuffer !== "undefined") ? natureVertexBuffer : window.natureVertexBuffer;
                    if (obs.meshStart !== undefined && obs.meshEnd !== undefined && rawVerts) {
                        const startF = obs.meshStart * 3;
                        const endF = obs.meshEnd * 3;
                        for (let j = startF; j < endF; j++) {
                            rawVerts[j] = 0;
                        }
                        if (typeof gl !== "undefined" && gl && vBuffer) {
                            gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
                            gl.bufferSubData(gl.ARRAY_BUFFER, startF * 4, new Float32Array(rawVerts.slice(startF, endF)));
                        }
                    }

                    nObs.splice(i, 1);
                    obstaclesChanged = true;
                }
            }

            // if (obstaclesChanged && typeof refreshCollectiblesVBO === "function") {
            //    refreshCollectiblesVBO();
            // }
        }
        
        if (placingItemName === "WOOD_BOAT") {
            floorPreviewCollectible.isDynamic = true;
            floorPreviewCollectible.vel = [0, 0, 0];
            floorPreviewCollectible.spinAxis = [0, 1, 0];
            floorPreviewCollectible.spinSpeed = 0;
            // If placed in water, slightly above water so it can drop and float into buoyancy
            let isWaterPlacement = (typeof waterEnabled !== "undefined" && waterEnabled);
            let pR_len = Math.sqrt(floorPreviewCollectible.position[0]**2 + floorPreviewCollectible.position[1]**2 + floorPreviewCollectible.position[2]**2) || 1;
            let pTheta = Math.acos(Math.max(-1.0, Math.min(1.0, floorPreviewCollectible.position[1] / pR_len)));
            let pPhi = Math.atan2(floorPreviewCollectible.position[2], floorPreviewCollectible.position[0]);
            const seedVal = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : 0;
            const pSurf = (typeof Physics !== "undefined" && typeof Physics.resolveEntitySurfaceAndWater === "function")
              ? Physics.resolveEntitySurfaceAndWater({ theta: pTheta, phi: pPhi, feetRadius: pR_len, planetRadius: RADIUS, heightScale: HEIGHT_SCALE, seed: seedVal })
              : null;
            const sampleH = (typeof getVisualHeightOnSphere === "function") ? getVisualHeightOnSphere : getHeightOnSphere;
            const pTerrainR = pSurf ? pSurf.terrainRad : (RADIUS + sampleH(pTheta, pPhi, seedVal) * HEIGHT_SCALE);
            const pWaterR = pSurf
              ? (pSurf.wRadiusLocal > 0 ? pSurf.wRadiusLocal : pSurf.waterRadius)
              : (typeof Physics !== "undefined" && typeof Physics.getCanonicalWaterRadius === "function"
                  ? Physics.getCanonicalWaterRadius(RADIUS, (typeof waterLevel !== "undefined" ? waterLevel : 0), HEIGHT_SCALE)
                  : (RADIUS + (typeof waterLevel !== "undefined" ? waterLevel : 0) * (HEIGHT_SCALE * 0.25)));
            if (isWaterPlacement && (pSurf ? pSurf.isWaterPresent : (pTerrainR < pWaterR))) {
                floorPreviewCollectible.position[0] += floorPreviewCollectible.normal[0] * 0.05;
                floorPreviewCollectible.position[1] += floorPreviewCollectible.normal[1] * 0.05;
                floorPreviewCollectible.position[2] += floorPreviewCollectible.normal[2] * 0.05;
            }
        }
        
        if (placingItemName === "WOOD_STAIRS" || placingItemName === "FOLDING_LADDER") {
          floorPreviewCollectible.type = placingItemName === "FOLDING_LADDER" ? "folding_ladder" : "wood_stairs";
          // Copy top and bottom points and orientation vectors so they are permanently saved
          if (floorPreviewCollectible.stairTop) {
            floorPreviewCollectible.stairTop = [...floorPreviewCollectible.stairTop];
          }
          if (floorPreviewCollectible.stairBottom) {
            floorPreviewCollectible.stairBottom = [...floorPreviewCollectible.stairBottom];
          }
          if (floorPreviewCollectible.normal) {
            floorPreviewCollectible.normal = [...floorPreviewCollectible.normal];
          }
          if (floorPreviewCollectible.R) {
            floorPreviewCollectible.R = [...floorPreviewCollectible.R];
          }
          if (floorPreviewCollectible.F) {
            floorPreviewCollectible.F = [...floorPreviewCollectible.F];
          }
        } else if (placingItemName === "CAMPFIRE") {
          floorPreviewCollectible.type = "campfire";
          floorPreviewCollectible.size = campfireSize; // Use dynamic size from devtool
          // Set exact ground-flush position (0.002 offset) for the placed campfire
          const n = floorPreviewCollectible.normal;
          const len = Math.sqrt(n[0]*n[0] + n[1]*n[1] + n[2]*n[2]) || 1;
          const pnx = n[0]/len, pny = n[1]/len, pnz = n[2]/len;
          
          let previewTheta = Math.acos(Math.max(-1.0, Math.min(1.0, pny)));
          let previewPhi = Math.atan2(pnz, pnx);
          const sampleH = (typeof getVisualHeightOnSphere === "function") ? getVisualHeightOnSphere : getHeightOnSphere;
          let groundRad = RADIUS + sampleH(previewTheta, previewPhi, globalSeed) * HEIGHT_SCALE;
          const waterRadius = RADIUS + waterLevel * 0.15;
          if (waterEnabled && groundRad < waterRadius) groundRad = waterRadius;
          const exactGroundRad = groundRad + 0.002;
          floorPreviewCollectible.position = [pnx * exactGroundRad, pny * exactGroundRad, pnz * exactGroundRad];
        } else if (placingItemName === "WOOD_BOAT") {
          floorPreviewCollectible.type = "wood_boat";
          floorPreviewCollectible.angle = placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName === "ELECTRIC_ENGINE" || placingItemName === "WOOD_WHEEL" || placingItemName === "BOAT_WING") {
          floorPreviewCollectible.type = placingItemName === "ELECTRIC_ENGINE" ? "electric_engine" : (placingItemName === "BOAT_WING" ? "boat_wing" : "wood_wheel");
          floorPreviewCollectible.angle = placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;

          let nearestBoat = null;
          let bestDist = Infinity;
          for (let c of collectibles) {
            if (c.active && !c.isPreview && c.type === "wood_boat") {
              const dx = c.position[0] - floorPreviewCollectible.position[0];
              const dy = c.position[1] - floorPreviewCollectible.position[1];
              const dz = c.position[2] - floorPreviewCollectible.position[2];
              const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
              if (dist < bestDist) {
                bestDist = dist;
                nearestBoat = c;
              }
            }
          }
          if (nearestBoat && bestDist < 3.5) {
            if (placingItemName === "WOOD_WHEEL") {
              nearestBoat.hasWheel = true;
              nearestBoat.hasWheels = true;
              floorPreviewCollectible.active = false;
              if (typeof showNotice === "function") {
                showNotice("⚙️ ติดล้อไม้กับเรือเรียบร้อย! เรือสามารถขับบนบกได้แล้ว (Wooden Wheel attached! Boat can now drive on land)");
              }
            } else if (placingItemName === "ELECTRIC_ENGINE") {
              nearestBoat.hasEngine = true;
              floorPreviewCollectible.active = false;
              if (typeof showNotice === "function") {
                showNotice("🔋 ติดตั้งเครื่องยนต์ไฟฟ้าเรียบร้อย! เรือมีความเร็วและแรงบิดสูงขึ้น (Electric Engine attached!)");
              }
            } else if (placingItemName === "BOAT_WING") {
              nearestBoat.hasWing = true;
              nearestBoat.hasWings = true;
              floorPreviewCollectible.active = false;
              if (typeof showNotice === "function") {
                if (nearestBoat.hasEngine) {
                  showNotice("🪽 ติดตั้งปีกกับเรือเรียบร้อย! กด Shift เพื่อเปิดโหมดบิน | กด W บินไปข้างหน้า | กด Z ดิ่งลง");
                } else {
                  showNotice("🪽 ติดตั้งปีกกับเรือเรียบร้อย! (ต้องติดตั้งเครื่องยนต์ไฟฟ้าก่อนจึงจะบินได้)");
                }
              }
            }
          }
        } else if (placingItemName === "WOOD_WALL") {
          floorPreviewCollectible.type = "wood_wall";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName === "WOOD_WINDOW") {
          floorPreviewCollectible.type = "wood_window";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.windowAngle = 0.0;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName === "WOOD_DOOR") {
          floorPreviewCollectible.type = "wood_door";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.doorAngle = 0.0;
          floorPreviewCollectible.doorVel = 0.0;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName === "WOOD_CHEST") {
          floorPreviewCollectible.type = "wood_chest";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
          floorPreviewCollectible.storage = Array(20).fill(null);
        } else if (placingItemName === "WOOD_BED") {
          floorPreviewCollectible.type = "wood_bed";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName === "WOOD_TABLE") {
          floorPreviewCollectible.type = "wood_table";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName === "WOOD_PLANTER_BOX") {
          floorPreviewCollectible.type = "wood_planter_box";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
          if (!floorPreviewCollectible.isFloorSnapped) {
            const pos = floorPreviewCollectible.position;
            const rLen = Math.sqrt(pos[0]*pos[0] + pos[1]*pos[1] + pos[2]*pos[2]) || 1;
            const pnx = pos[0] / rLen, pny = pos[1] / rLen, pnz = pos[2] / rLen;
            const previewTheta = Math.acos(Math.max(-1.0, Math.min(1.0, pny)));
            const previewPhi = Math.atan2(pnz, pnx);
            const sampleH = (typeof getVisualHeightOnSphere === "function") ? getVisualHeightOnSphere : getHeightOnSphere;
            let groundRad = RADIUS + sampleH(previewTheta, previewPhi, globalSeed) * HEIGHT_SCALE;
            if (typeof getTerrainSurfaceAndCeiling === "function") {
              const caveInfo = getTerrainSurfaceAndCeiling(pnx, pny, pnz, rLen - 0.15);
              if (caveInfo && (caveInfo.insideTunnel || caveInfo.ground < groundRad - 0.35)) {
                groundRad = caveInfo.ground;
              }
            }
            floorPreviewCollectible.position = [pnx * groundRad, pny * groundRad, pnz * groundRad];
          }
        } else if (placingItemName === "WOOD_CHAIR") {
          floorPreviewCollectible.type = "wood_chair";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName === "LANTERN") {
          floorPreviewCollectible.type = "lantern";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName === "MEGANEURA") {
          floorPreviewCollectible.type = "meganeura_item";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName === "ISOPOD") {
          floorPreviewCollectible.type = "isopod_item";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName === "OBSIDIAN_PAD_WARP" || placingItemName === "OBSIDIAN_COMPASS_PAD") {
          floorPreviewCollectible.type = "obsidian_pad_warp_item";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName.startsWith("ROBOT_")) {
          floorPreviewCollectible.type = placingItemName.toLowerCase();
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName === "WOOD_ROOF") {
          floorPreviewCollectible.type = "wood_roof";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_FLOOR;
        } else {
          floorPreviewCollectible.type = placingItemName === "STONE_FLOOR" ? "stone_floor" : (placingItemName === "THIN_WOOD_FLOOR" ? "thin_wood_floor" : "wood_floor");
          floorPreviewCollectible.layer = placingItemName === "STONE_FLOOR" ? COLLISION_LAYERS.STONE_FLOOR : COLLISION_LAYERS.WOOD_FLOOR;
        }

        floorPreviewCollectible.isPreview = false;
        floorPreviewCollectible.isPlayerPlaced = true;
        floorPreviewCollectible.isWorldGenerated = false;
        floorPreviewCollectible.hideFromCompass = false;
        floorPreviewCollectible.isHouse = false;
        floorPreviewCollectible.isProceduralHouse = false;
        floorPreviewCollectible.isRuin = false;

        if (floorPreviewCollectible.position) floorPreviewCollectible.position = [...floorPreviewCollectible.position];
        if (floorPreviewCollectible.normal) floorPreviewCollectible.normal = [...floorPreviewCollectible.normal];
        if (floorPreviewCollectible.R) floorPreviewCollectible.R = [...floorPreviewCollectible.R];
        if (floorPreviewCollectible.F) floorPreviewCollectible.F = [...floorPreviewCollectible.F];

        // Avoid duplicate push when floorPreviewCollectible was already pushed in collectibles.js,
        // and ensure the newly placed structure is always appended at the end in chronological order
        const existingPreviewIdx = collectibles.indexOf(floorPreviewCollectible);
        if (existingPreviewIdx !== -1) {
          collectibles.splice(existingPreviewIdx, 1);
        }
        collectibles.push(floorPreviewCollectible);

        if (placingItemName === "OBSIDIAN_PAD_WARP" || placingItemName === "OBSIDIAN_COMPASS_PAD") {
          getPlacedObsidianPadsInOrder();
        }
        
        // Remove 1 item from player's inventory or action slot
        const info = floorPlacementInfo;
        if (info && info.item) {
          if (info.item.count > 1) {
            info.item.count--;
          } else {
            if (info.source === "inventory") inventory[info.index] = null;
            else actionSlotsItems[info.index] = null;
            
            // Clear selection if slot is empty
            if (info.source === "action" && selectedActionSlotIndex === info.index) {
              selectedActionSlotIndex = -1;
            }
          }
        }

        // Refresh UI
        if (typeof renderInventory === "function") renderInventory();
        if (typeof renderActionSlots === "function") renderActionSlots();
        if (typeof updateBadge === "function") updateBadge();

        // Check if player still has items in the active slot/inventory
        let stillHasItems = false;
        if (info && info.item && info.item.count > 0 && info.item.name === placingItemName) {
          stillHasItems = true;
        }
        if ((placingItemName === "OBSIDIAN_PAD_WARP" || placingItemName === "OBSIDIAN_COMPASS_PAD") && getPlacedObsidianPadsInOrder().length >= MAX_OBSIDIAN_PADS) {
          if (info && info.source === "inventory") {
            stillHasItems = false;
          }
        }

        if (stillHasItems) {
          // Keep placing, spawn a new preview of the same type
          const typeToPlace = placingItemName.startsWith("ROBOT_") ? placingItemName.toLowerCase()
            : placingItemName === "STONE_FLOOR" ? "stone_floor"
            : placingItemName === "WOOD_STAIRS" ? "wood_stairs"
            : placingItemName === "FOLDING_LADDER" ? "folding_ladder"
            : placingItemName === "CAMPFIRE" ? "campfire"
            : placingItemName === "WOOD_BOAT" ? "wood_boat"
            : placingItemName === "ELECTRIC_ENGINE" ? "electric_engine"
            : placingItemName === "BOAT_WING" ? "boat_wing"
            : placingItemName === "WOOD_WHEEL" ? "wood_wheel"
            : placingItemName === "WOOD_WALL" ? "wood_wall"
            : placingItemName === "WOOD_WINDOW" ? "wood_window"
            : placingItemName === "WOOD_DOOR" ? "wood_door"
            : placingItemName === "WOOD_ROOF" ? "wood_roof"
            : placingItemName === "WOOD_CHEST" ? "wood_chest"
            : placingItemName === "WOOD_BED" ? "wood_bed"
            : placingItemName === "WOOD_TABLE" ? "wood_table"
            : placingItemName === "WOOD_PLANTER_BOX" ? "wood_planter_box"
            : placingItemName === "WOOD_CHAIR" ? "wood_chair"
            : placingItemName === "LANTERN" ? "lantern"
            : placingItemName === "MEGANEURA" ? "meganeura_item"
            : placingItemName === "ISOPOD" ? "isopod_item"
            : (placingItemName === "OBSIDIAN_PAD_WARP" || placingItemName === "OBSIDIAN_COMPASS_PAD") ? "obsidian_pad_warp_item"
            : placingItemName === "THIN_WOOD_FLOOR" ? "thin_wood_floor"
            : "wood_floor";
          floorPreviewCollectible = {
            type: typeToPlace,
            position: [0, 0, 0],
            normal: [0, 1, 0],
            R: [1, 0, 0],
            F: [0, 0, 1],
            U: [0, 1, 0],
            color: [0.95, 0.85, 0.45], // preview color
            size: typeToPlace === "campfire" ? campfireSize : 0.25,
            active: true,
            isDynamic: false,
            isPreview: true,
            seed: Math.random(),
            angle: placementRotationAngle
          };
          if (typeToPlace === "wood_wall" || typeToPlace === "wood_window" || typeToPlace === "wood_door" || typeToPlace === "wood_chest" || typeToPlace === "wood_bed" || typeToPlace === "wood_table" || typeToPlace === "wood_planter_box" || typeToPlace === "wood_chair" || typeToPlace === "lantern" || typeToPlace === "meganeura_item" || typeToPlace === "isopod_item" || typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item" || typeToPlace === "wood_boat" || typeToPlace === "wood_wheel" || typeToPlace === "electric_engine" || typeToPlace === "boat_wing" || typeToPlace.startsWith("robot_")) {
            floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
          } else if (typeToPlace === "wood_floor" || typeToPlace === "thin_wood_floor" || typeToPlace === "wood_roof") {
            floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_FLOOR;
          } else if (typeToPlace === "stone_floor") {
            floorPreviewCollectible.layer = COLLISION_LAYERS.STONE_FLOOR;
          }
        } else {
          // Out of items, exit placement
          isPlacingFloor = false;
          floorPlacementInfo = null;
          floorPreviewCollectible = null;
        }

        // Force WebGL buffer refresh
        pendingCollectibleRefresh = true;
        if (typeof saveSettingsToLocalStorage === "function") {
          saveSettingsToLocalStorage();
        }
      }

      window.activeAmmoType = "IRON_BULLET";

      function getAmmoDisplayName(name) {
        if (name === "IRON_BULLET") return "⚪ กระสุนเหล็ก ทรงกลม (Spherical Iron Bullet)";
        if (name === "ARROW") return "🏹 ลูกธนู (Arrow)";
        return name || "กระสุน";
      }

      function getAmmoTotalCount(ammoName) {
        let total = 0;
        if (typeof actionSlotsItems !== "undefined" && actionSlotsItems) {
          for (let i = 0; i < actionSlotsItems.length; i++) {
            const slot = actionSlotsItems[i];
            if (slot && slot.name === ammoName && slot.count > 0) total += slot.count;
          }
        }
        if (typeof inventory !== "undefined" && inventory) {
          for (let i = 0; i < inventory.length; i++) {
            const slot = inventory[i];
            if (slot && slot.name === ammoName && slot.count > 0) total += slot.count;
          }
        }
        return total;
      }

      function getAvailableAmmoTypesInInventory() {
        const ammoTypes = [];
        const candidateNames = ["IRON_BULLET", "ARROW"];
        for (const name of candidateNames) {
          if (getAmmoTotalCount(name) > 0) {
            ammoTypes.push(name);
          }
        }
        return ammoTypes;
      }

      function triggerAmmoSwitchUI(ammoType) {
        window.activeAmmoType = ammoType;
        window.ammoSwitchPopup = {
          ammoType: ammoType,
          expiresAt: Date.now() + 3000
        };
        if (window.ammoSwitchTimeout) clearTimeout(window.ammoSwitchTimeout);
        window.ammoSwitchTimeout = setTimeout(() => {
          if (typeof renderActionSlots === "function") renderActionSlots();
        }, 3050);
        if (typeof renderActionSlots === "function") renderActionSlots();
      }
      window.triggerAmmoSwitchUI = triggerAmmoSwitchUI;

      function switchCannonAmmo() {
        const available = getAvailableAmmoTypesInInventory();
        if (available.length === 0) {
          showNotice("🚫 ไม่มีกระสุนอยู่ในกระเป๋า! (No ammo in inventory)");
          return;
        }
        
        let nextIdx = 0;
        if (window.activeAmmoType) {
          const curIdx = available.indexOf(window.activeAmmoType);
          if (curIdx !== -1) {
            nextIdx = (curIdx + 1) % available.length;
          }
        }
        
        const newAmmo = available[nextIdx];
        triggerAmmoSwitchUI(newAmmo);
        const count = getAmmoTotalCount(newAmmo);
        showNotice("🔄 สลับกระสุนเป็น: " + getAmmoDisplayName(newAmmo) + " [จำนวน: " + count + "]");
      }
      window.switchCannonAmmo = switchCannonAmmo;

      function findArrowInInventory() {
        const preferred = window.activeAmmoType || "IRON_BULLET";
        
        // 1. Search for preferred active ammo first
        for (let i = 0; i < actionSlotsItems.length; i++) {
          const slot = actionSlotsItems[i];
          if (slot && slot.name === preferred && slot.count > 0) {
            return { type: "action", index: i, item: slot };
          }
        }
        for (let i = 0; i < inventory.length; i++) {
          const slot = inventory[i];
          if (slot && slot.name === preferred && slot.count > 0) {
            return { type: "inventory", index: i, item: slot };
          }
        }
        
        // 2. Fallback to any available ammo in inventory/action bar
        const candidates = ["IRON_BULLET", "ARROW"];
        for (const cand of candidates) {
          if (cand === preferred) continue;
          for (let i = 0; i < actionSlotsItems.length; i++) {
            const slot = actionSlotsItems[i];
            if (slot && slot.name === cand && slot.count > 0) {
              triggerAmmoSwitchUI(cand);
              showNotice("⚠️ สลับกระสุนอัตโนมัติเป็น: " + getAmmoDisplayName(cand) + " [เหลือ: " + slot.count + "]");
              return { type: "action", index: i, item: slot };
            }
          }
          for (let i = 0; i < inventory.length; i++) {
            const slot = inventory[i];
            if (slot && slot.name === cand && slot.count > 0) {
              triggerAmmoSwitchUI(cand);
              showNotice("⚠️ สลับกระสุนอัตโนมัติเป็น: " + getAmmoDisplayName(cand) + " [เหลือ: " + slot.count + "]");
              return { type: "inventory", index: i, item: slot };
            }
          }
        }
        return null;
      }
      window.findArrowInInventory = findArrowInInventory;

      function consumeArrow(arrowRef) {
        if (arrowRef.type === "action") {
          const slot = actionSlotsItems[arrowRef.index];
          slot.count--;
          if (slot.count <= 0) {
            actionSlotsItems[arrowRef.index] = null;
          }
        } else {
          const slot = inventory[arrowRef.index];
          slot.count--;
          if (slot.count <= 0) {
            inventory[arrowRef.index] = null;
          }
        }
        renderInventory();
        renderActionSlots();
        updateBadge();
        saveSettingsToLocalStorage();
      }

      function shootArrowProjectile(drawPower = 1.0, ammoName = null, options = null) {
        const actor = (options && options.actor && typeof window !== "undefined" && window.ActorCore)
          ? window.ActorCore.resolveActor(options.actor)
          : ((typeof window !== "undefined" && window.ActorCore) ? window.ActorCore.getPlayerActor() : null);
        const isActorPlayer = !actor || actor.isPlayer !== false;

        if (!ammoName) {
          const ref = actor ? actor.findAmmo() : findArrowInInventory();
          if (ref && ref.item) ammoName = ref.item.name;
          else ammoName = isActorPlayer ? (window.activeAmmoType || "ARROW") : "ARROW";
        }
        const isIron = (ammoName === "IRON_BULLET");
        const basis = (actor && typeof window !== "undefined" && window.ActorCore) ? window.ActorCore.getBasis(actor) : null;

        let nx, ny, nz, East, North, F_char, groundRadius, pScale;
        if (basis) {
          nx = basis.normal[0]; ny = basis.normal[1]; nz = basis.normal[2];
          East = basis.East;
          North = basis.North;
          F_char = basis.F;
          pScale = basis.pScale;
          groundRadius = basis.terrainRadius;
          const waterRadius = basis.planetRadius + waterLevel * 0.15;
          if (waterEnabled && groundRadius < waterRadius) {
            groundRadius = waterRadius;
          }
        } else {
          const sinTheta = Math.sin(charTheta);
          const cosTheta = Math.cos(charTheta);
          const sinPhi = Math.sin(charPhi);
          const cosPhi = Math.cos(charPhi);
          nx = sinTheta * cosPhi;
          ny = cosTheta;
          nz = sinTheta * sinPhi;
          pScale = playerScale;

          let height = getHeightOnSphere(charTheta, charPhi, globalSeed);
          let terrainRadius = RADIUS + height * HEIGHT_SCALE;
          groundRadius = terrainRadius;
          const waterRadius = RADIUS + waterLevel * 0.15;
          if (waterEnabled && terrainRadius < waterRadius) {
              groundRadius = waterRadius;
          }
          East = [-sinPhi, 0, cosPhi];
          North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
          const cosH = Math.cos(charHeading);
          const sinH = Math.sin(charHeading);
          F_char = [
            North[0] * cosH + East[0] * sinH,
            North[1] * cosH + East[1] * sinH,
            North[2] * cosH + East[2] * sinH,
          ];
        }
        
        const headOffset = 0.6 * pScale;
        let startPos = [
          nx * (groundRadius + headOffset) + F_char[0] * 0.2 * pScale,
          ny * (groundRadius + headOffset) + F_char[1] * 0.2 * pScale,
          nz * (groundRadius + headOffset) + F_char[2] * 0.2 * pScale
        ];
        
        let arrowDir = [];
        if (options && options.targetPos) {
            arrowDir = [
                options.targetPos[0] - startPos[0],
                options.targetPos[1] - startPos[1],
                options.targetPos[2] - startPos[2],
            ];
        } else if (isActorPlayer && typeof cameraMode !== "undefined" && (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps")) {
            let targetPoint = null;
            if (activeTargetNPC && activeTargetNPC.position) {
                const npc = activeTargetNPC;
                const npc_pos = npc.position;
                const npcLen = Math.sqrt(npc_pos[0]**2 + npc_pos[1]**2 + npc_pos[2]**2);
                const n_npc = npcLen > 0.1 ? [npc_pos[0]/npcLen, npc_pos[1]/npcLen, npc_pos[2]/npcLen] : [nx, ny, nz];
                const N = npc.N || n_npc;
                const F = npc.F || [0, 0, 0];
                let upOffset = 0.0;
                let forwardOffset = 0.0;
                if (npc.type === "meganeura") {
                    upOffset = 0.0;
                    forwardOffset = -0.06;
                } else {
                    upOffset = -0.02;
                    forwardOffset = -0.12;
                }
                targetPoint = [
                    npc_pos[0] + N[0] * upOffset + F[0] * forwardOffset,
                    npc_pos[1] + N[1] * upOffset + F[1] * forwardOffset,
                    npc_pos[2] + N[2] * upOffset + F[2] * forwardOffset
                ];
            } else {
                const clampedPitch = Math.max(-0.5, Math.min(1.2, rotationX));
                const cosP = Math.cos(clampedPitch);
                const sinP = Math.sin(clampedPitch);
                const cosY = Math.cos(rotationY);
                const sinY = Math.sin(rotationY);

                const camDirOnPlane = [
                    -North[0] * cosY - East[0] * sinY,
                    -North[1] * cosY - East[1] * sinY,
                    -North[2] * cosY - East[2] * sinY,
                ];
                const camDir = [
                    camDirOnPlane[0] * cosP + nx * sinP,
                    camDirOnPlane[1] * cosP + ny * sinP,
                    camDirOnPlane[2] * cosP + nz * sinP,
                ];
                const lookDir = [-camDir[0], -camDir[1], -camDir[2]];
                
                const headHeight = 0.45 * pScale;
                const basePlayerHeadPos = [
                    nx * groundRadius + nx * headHeight,
                    ny * groundRadius + ny * headHeight,
                    nz * groundRadius + nz * headHeight,
                ];
                const shoulderOffset = -0.9 * pScale;
                const camRight = [
                    East[0] * cosY - North[0] * sinY,
                    East[1] * cosY - North[1] * sinY,
                    East[2] * cosY - North[2] * sinY
                ];
                const playerHeadPos = [
                    basePlayerHeadPos[0] + camRight[0] * shoulderOffset,
                    basePlayerHeadPos[1] + camRight[1] * shoulderOffset,
                    basePlayerHeadPos[2] + camRight[2] * shoulderOffset
                ];
                
                const actualCamDist = typeof currentSmoothDistance !== "undefined" ? currentSmoothDistance : (1.0 + (zoom - 3.5) * 0.4) * (pScale / 0.22);
                const eyePos = [
                    playerHeadPos[0] + camDir[0] * actualCamDist,
                    playerHeadPos[1] + camDir[1] * actualCamDist,
                    playerHeadPos[2] + camDir[2] * actualCamDist,
                ];
                
                let currentDist = 1.0;
                const maxDist = 50.0;
                const step = 0.5;
                
                while (currentDist < maxDist) {
                    const testPos = [
                        eyePos[0] + lookDir[0] * currentDist,
                        eyePos[1] + lookDir[1] * currentDist,
                        eyePos[2] + lookDir[2] * currentDist,
                    ];
                    
                    const distToCenter = Math.sqrt(testPos[0]**2 + testPos[1]**2 + testPos[2]**2);
                    if (distToCenter > 0.001) {
                        const ux = testPos[0] / distToCenter;
                        const uy = testPos[1] / distToCenter;
                        const uz = testPos[2] / distToCenter;
                        const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
                        const phi = Math.atan2(uz, ux);
                        const h = getHeightOnSphere(theta, phi, globalSeed);
                        const terrainRadius = RADIUS + h * HEIGHT_SCALE;
                        
                        const wRadius = RADIUS + waterLevel * 0.15;
                        const checkRad = waterEnabled ? Math.max(terrainRadius, wRadius) : terrainRadius;
                        
                        if (distToCenter <= checkRad + 0.1) {
                            targetPoint = testPos;
                            break;
                        }
                    }
                    currentDist += step;
                }
                
                if (!targetPoint) {
                    targetPoint = [
                        eyePos[0] + lookDir[0] * maxDist,
                        eyePos[1] + lookDir[1] * maxDist,
                        eyePos[2] + lookDir[2] * maxDist,
                    ];
                }
            }
            
            arrowDir = [
                targetPoint[0] - startPos[0],
                targetPoint[1] - startPos[1],
                targetPoint[2] - startPos[2],
            ];
        } else {
            const aimPitch = isActorPlayer ? (-rotationX * 0.5 + 0.15) : 0.05;
            arrowDir = [
              F_char[0] * Math.cos(aimPitch) + nx * Math.sin(aimPitch),
              F_char[1] * Math.cos(aimPitch) + ny * Math.sin(aimPitch),
              F_char[2] * Math.cos(aimPitch) + nz * Math.sin(aimPitch)
            ];
        }

        const weaponRef = (options && options.weaponItem) ? options.weaponItem : (actor ? actor.getActiveItem() : activeItem);
        const wName = weaponRef ? (weaponRef.name || weaponRef.label || "").toUpperCase() : "";
        const isCannon = (wName === "WOODEN_ARM_CANNON" || wName === "ARM_CANNON");

        if (isActorPlayer && window.lastBowGripPos && window.lastBowAimDir && (window.lastBowAimDir[0] !== 0 || window.lastBowAimDir[1] !== 0 || window.lastBowAimDir[2] !== 0)) {
            const clearance = isCannon ? 0.09 * (pScale / 0.1) : 0.05;
            startPos = [
                window.lastBowGripPos[0] + window.lastBowAimDir[0] * clearance,
                window.lastBowGripPos[1] + window.lastBowAimDir[1] * clearance,
                window.lastBowGripPos[2] + window.lastBowAimDir[2] * clearance
            ];
            arrowDir = [
                window.lastBowAimDir[0],
                window.lastBowAimDir[1],
                window.lastBowAimDir[2]
            ];
        } else {
            let dLen = Math.sqrt(arrowDir[0]**2 + arrowDir[1]**2 + arrowDir[2]**2);
            if (dLen > 0) {
              arrowDir[0] /= dLen;
              arrowDir[1] /= dLen;
              arrowDir[2] /= dLen;
            }
        }

        if (isActorPlayer && window.currentAimTargetPos) {
            const toTarget = [
                window.currentAimTargetPos[0] - startPos[0],
                window.currentAimTargetPos[1] - startPos[1],
                window.currentAimTargetPos[2] - startPos[2]
            ];
            const tLen = Math.hypot(toTarget[0], toTarget[1], toTarget[2]);
            if (tLen > 0.001) {
                arrowDir = [toTarget[0] / tLen, toTarget[1] / tLen, toTarget[2] / tLen];
            }
        }

        if (isActorPlayer && !isCannon && !window.isAimTargetLocked) {
            const pitchUpAngle = 0.05 * (1.0 - drawPower) + 0.01;
            arrowDir[0] += nx * pitchUpAngle;
            arrowDir[1] += ny * pitchUpAngle;
            arrowDir[2] += nz * pitchUpAngle;
        }
        
        let dLen = Math.sqrt(arrowDir[0]**2 + arrowDir[1]**2 + arrowDir[2]**2);
        if (dLen > 0) {
          arrowDir[0] /= dLen;
          arrowDir[1] /= dLen;
          arrowDir[2] /= dLen;
        }
        
        const speed = (isCannon ? 1.15 : (0.2 + (0.6 * drawPower))) * pScale; 
        const arrowVel = [
          arrowDir[0] * speed,
          arrowDir[1] * speed,
          arrowDir[2] * speed
        ];
        
        const f_arrow = [arrowDir[0], arrowDir[1], arrowDir[2]];
        let r_arrow = [
          f_arrow[1]*nx - f_arrow[2]*ny,
          f_arrow[2]*nx - f_arrow[0]*nz,
          f_arrow[0]*ny - f_arrow[1]*nx
        ];
        const lenR = Math.sqrt(r_arrow[0]**2 + r_arrow[1]**2 + r_arrow[2]**2);
        if (lenR > 0.001) {
          r_arrow = [r_arrow[0]/lenR, r_arrow[1]/lenR, r_arrow[2]/lenR];
        } else {
          r_arrow = [1, 0, 0];
        }
        const u_arrow = [
          r_arrow[1]*f_arrow[2] - r_arrow[2]*f_arrow[1],
          r_arrow[2]*f_arrow[0] - r_arrow[0]*f_arrow[2],
          r_arrow[0]*f_arrow[1] - r_arrow[1]*f_arrow[0]
        ];
        
        const arrowCollectible = {
          type: "arrow",
          ammoType: ammoName || "ARROW",
          position: [startPos[0], startPos[1], startPos[2]],
          vel: arrowVel,
          normal: u_arrow,
          R: r_arrow,
          F: f_arrow,
          U: u_arrow,
          color: isIron ? [0.78, 0.81, 0.86] : (isCannon ? [0.62, 0.44, 0.26] : [0.55, 0.4, 0.25]),
          size: isIron ? 0.12 : 0.1,
          active: true,
          isDynamic: true,
          seed: Math.random(),
          sourceWeapon: isCannon ? "WOODEN_ARM_CANNON" : "BOW",
          isCannonShot: !!isCannon,
          animPhaseActive: !!isCannon,
          animElapsed: 0,
          animMaxTime: 0.25,
          animOrigin: [startPos[0], startPos[1], startPos[2]],
          animDir: [arrowDir[0], arrowDir[1], arrowDir[2]],
          animSpeed: isIron ? speed * 1.35 : speed,
          ownerActor: actor || null,
          ignorePlayer: isActorPlayer
        };
        
        collectibles.push(arrowCollectible);
        window.pendingDynamicCollectibleRefresh = true;
        
        if (typeof playPlaceSound === "function") {
          playPlaceSound();
        }
        return arrowCollectible;
      }
      window.shootArrowProjectile = shootArrowProjectile;

      function useItem(item, index, source, isAltAction = false) {
        if (!item) return;
        console.log("Using item:", item);
        if (typeof window !== "undefined" && window.ActorCore && typeof window.useEntityItem === "function") {
          return window.useEntityItem(window.ActorCore.getPlayerActor(), item, { index, source, isAltAction });
        }
        const itemName = item.name || item.label || "";
        const itemDef = (typeof getItemDefinition === "function") ? getItemDefinition(itemName) : (window.getItemDefinition ? window.getItemDefinition(itemName) : null);
        if (itemDef) {
          const usageText = itemDef.usage_th || "ใช้เป็นวัตถุดิบคราฟต์และอื่นๆ";
          showNotice(`📦 [${itemDef.name_th}] เป็นไอเทมประเภทวัตถุดิบ (NONE): ${usageText}`);
        }
      }

      window.tantoShirasayaState = {
        mode: "idle", // "idle" | "charging" | "dashing" | "post_skill"
        comboStep: 1, // 1 = Forward Dash, 2 = Low Lunge Sweep, 3 = Air Spin Cyclone, 4 = Heavy Ground Slam
        comboActive: false,
        chargeTime: 0.0,
        holdThreshold: 0.15,
        comboChargeTrigger: 0.22,
        dashTimer: 0.0,
        dashDuration: 0.27,
        dashSpeed: 0.023,
        dashDirNorth: 0.0,
        dashDirEast: 0.0,
        lockedTarget: null,
        isAerialCombo: false,
        aerialTarget: null,
        aerialBaseRadius: null,
        stopForwardMove: false,
        hitEntities: null,
        impactPlayed: false,
        visualSpinYaw: 0.0,
        visualAirLift: 0.0,
        postGraceTimer: 0.0,
        slotIndex: -1
      };

      window.findTantoBestTarget = function(maxDist = window.getUnifiedMeleeReach(), weaponId = "TANTO") {
        const sinT = Math.sin(charTheta), cosT = Math.cos(charTheta);
        const sinP = Math.sin(charPhi), cosP = Math.cos(charPhi);
        const nx = sinT * cosP, ny = cosT, nz = sinT * sinP;
        const gSeed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : 0;
        const height = (typeof getHeightOnSphere === "function") ? getHeightOnSphere(charTheta, charPhi, gSeed) : 0;
        const pScale = (typeof playerScale === "number") ? playerScale : 0.1;
        const pRad = (typeof playerCenterRadius === "number" && playerCenterRadius !== null)
          ? playerCenterRadius
          : (RADIUS + height * HEIGHT_SCALE + 0.46 * pScale);
        const pPos = [pRad * nx, pRad * ny, pRad * nz];

        const East = [-sinP, 0, cosP];
        const North = [-cosT * cosP, sinT, -cosT * sinP];
        const lookYaw = (typeof rotationY === "number") ? rotationY : ((typeof charHeading === "number") ? charHeading : 0);
        const F = [
          North[0] * Math.cos(lookYaw) + East[0] * Math.sin(lookYaw),
          North[1] * Math.cos(lookYaw) + East[1] * Math.sin(lookYaw),
          North[2] * Math.cos(lookYaw) + East[2] * Math.sin(lookYaw)
        ];

        const normWeapon = weaponId ? String(weaponId).toUpperCase() : "TANTO";
        const isValidTarget = (t) => !!(
          t && t.position && (
            (!t.ragdollEnabled && (t.hp === undefined || t.hp > 0)) ||
            (normWeapon === "TANTO" && typeof window.isButcherableNpcCorpse === "function" && window.isButcherableNpcCorpse(t, "TANTO"))
          )
        );
        if (typeof activeTargetNPC !== "undefined" && isValidTarget(activeTargetNPC)) {
          const tp = (typeof window.getNPCTargetPoint === "function" ? window.getNPCTargetPoint(activeTargetNPC) : null) || activeTargetNPC.position;
          const d3 = Math.hypot(tp[0] - pPos[0], tp[1] - pPos[1], tp[2] - pPos[2]);
          const radBonus = window.getMeleeEntityRadius(activeTargetNPC);
          if (d3 <= maxDist * 1.1 + radBonus) {
            return activeTargetNPC;
          }
        }

        let best = null;
        let bestScore = Infinity;
        if (typeof amphibians !== "undefined" && Array.isArray(amphibians)) {
          for (let npc of amphibians) {
            if (!isValidTarget(npc)) continue;
            const tp = (typeof window.getNPCTargetPoint === "function" ? window.getNPCTargetPoint(npc) : null) || npc.position;
            const dx = tp[0] - pPos[0], dy = tp[1] - pPos[1], dz = tp[2] - pPos[2];
            const dist3D = Math.hypot(dx, dy, dz);
            const npcRad = window.getMeleeEntityRadius(npc);
            if (dist3D > maxDist + npcRad) continue;
            const hDiff = dx * nx + dy * ny + dz * nz;
            const horiz = Math.sqrt(Math.max(1e-6, dist3D * dist3D - hDiff * hDiff));
            const cosF = horiz > 0.05 ? ((dx * F[0] + dy * F[1] + dz * F[2]) / horiz) : 1.0;
            if (dist3D > 0.65 && cosF < 0.15) continue;
            const score = (dist3D - npcRad) - cosF * 0.55;
            if (score < bestScore) {
              bestScore = score;
              best = npc;
            }
          }
        }
        return best;
      };

      window.updateUnifiedMeleeDashTracking = function(state, step, prog, dt, opts = {}) {
        if (!state) return;
        const weaponId = (state === window.tantoShirasayaState) ? "TANTO" : "AEGIS_SHIFT";
        const turnStopBeforeEnd = (typeof opts.turnStopBeforeEnd === "number") ? opts.turnStopBeforeEnd : 0.34;
        const turnSpeed = (typeof opts.turnSpeed === "number") ? opts.turnSpeed : 15.5;
        const _sinT = Math.sin(charTheta), _cosT = Math.cos(charTheta);
        const _sinP = Math.sin(charPhi), _cosP = Math.cos(charPhi);
        const _nx = _sinT * _cosP, _ny = _cosT, _nz = _sinT * _sinP;
        const _N = [-_cosT * _cosP, _sinT, -_cosT * _sinP];
        const _E = [-_sinP, 0, _cosP];
        const _pRad = (typeof playerCenterRadius === "number" && playerCenterRadius) ? playerCenterRadius : RADIUS;
        const _pPos = [_pRad * _nx, _pRad * _ny, _pRad * _nz];

        const _lockDistMax = window.getUnifiedMeleeReach();
        let tLocked = state.lockedTarget;
        const isStillTargetable = (t) => !!(
          t && t.position && (
            (!t.ragdollEnabled && (t.hp === undefined || t.hp > 0)) ||
            (weaponId === "TANTO" && typeof window.isButcherableNpcCorpse === "function" && window.isButcherableNpcCorpse(t, "TANTO"))
          )
        );
        if (!isStillTargetable(tLocked)) {
          tLocked = null;
        } else if (tLocked) {
          const tpChk = (typeof window.getNPCTargetPoint === "function" ? window.getNPCTargetPoint(tLocked) : null) || tLocked.position;
          const dChk = Math.hypot(tpChk[0] - _pPos[0], tpChk[1] - _pPos[1], tpChk[2] - _pPos[2]);
          const radChk = window.getMeleeEntityRadius(tLocked);
          if (dChk > (_lockDistMax + radChk) * 1.15) tLocked = null;
        }
        if (!tLocked && typeof window.findTantoBestTarget === "function") {
          tLocked = window.findTantoBestTarget(_lockDistMax, weaponId);
        }
        state.lockedTarget = tLocked;
        if (tLocked && typeof activeTargetNPC !== "undefined") {
          activeTargetNPC = tLocked;
        }

        if (tLocked && tLocked.position) {
          const tp = (typeof window.getNPCTargetPoint === "function" ? window.getNPCTargetPoint(tLocked) : null) || tLocked.position;
          const dx = tp[0] - _pPos[0], dy = tp[1] - _pPos[1], dz = tp[2] - _pPos[2];
          const tN = dx * _N[0] + dy * _N[1] + dz * _N[2];
          const tE = dx * _E[0] + dy * _E[1] + dz * _E[2];
          const horizDist = Math.hypot(tN, tE);

          if (horizDist > 0.08 && (step !== 4 || prog < turnStopBeforeEnd)) {
            const aimH = Math.atan2(tE, tN);
            const hDiff = Math.atan2(Math.sin(aimH - charHeading), Math.cos(aimH - charHeading));
            charHeading += hDiff * Math.min(1.0, dt * turnSpeed);
            state.dashDirNorth = Math.cos(charHeading);
            state.dashDirEast = Math.sin(charHeading);
          }
          // Adapt dash stop distance to target hitbox radius + unified melee reach so player stops right inside strike range
          const tRad = window.getMeleeEntityRadius(tLocked);
          const stopDist = Math.min(0.42, Math.max(0.18, tRad + _lockDistMax * 0.45));
          state.stopForwardMove = (horizDist <= stopDist);
          if (state.isAerialCombo) {
            state.aerialTarget = tLocked;
          }
        } else {
          state.stopForwardMove = false;
          if ((cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") && (step !== 4 || prog < turnStopBeforeEnd)) {
            const hDiff = Math.atan2(Math.sin(rotationY - charHeading), Math.cos(rotationY - charHeading));
            charHeading += hDiff * Math.min(1.0, dt * 10.0);
            state.dashDirNorth = Math.cos(charHeading);
            state.dashDirEast = Math.sin(charHeading);
          }
        }
      };

      window.performUnifiedMeleeSkillHit = function(dmg, label, options = {}) {
        const reachDist = window.getUnifiedMeleeReach();
        if (window.tantoShirasayaState && window.tantoShirasayaState.mode === "dashing" && typeof window.cutGrassWithKnife === "function") {
          window.cutGrassWithKnife({ omni: !!options.omni, maxTufts: 2 });
        }
        const skillWeaponId = (options && options.weaponId)
          ? options.weaponId
          : ((window.tantoShirasayaState && window.tantoShirasayaState.mode === "dashing") ? "TANTO" : "AEGIS_SHIFT");
        return checkNpcMeleeHit(dmg, label, {
          hitSet: options.hitSet || null,
          reachOverride: reachDist,
          omni: !!options.omni,
          coneCos: (options.coneCos !== undefined) ? options.coneCos : null,
          maxVert: (typeof options.maxVert === "number") ? options.maxVert : 0.72,
          lockedTarget: options.lockedTarget || null,
          weaponId: skillWeaponId
        });
      };

      function _resetMeleeSkillStateCommon(st) {
        if (!st) return;
        st.mode = "idle";
        st.comboStep = 1;
        st.comboActive = false;
        st.chargeTime = 0.0;
        st.dashTimer = 0.0;
        st.lockedTarget = null;
        st.isAerialCombo = false;
        st.aerialTarget = null;
        st.aerialBaseRadius = null;
        st.stopForwardMove = false;
        st.hitEntities = null;
        st.impactPlayed = false;
        st.visualSpinYaw = 0.0;
        st.visualAirLift = 0.0;
        st.postGraceTimer = 0.0;
        st.slotIndex = -1;
      }

      function _startMeleeChargeSkillCommon(st, item, slotIndex, validNames, resetPostGrace) {
        if (!item || validNames.indexOf(item.name) === -1) return false;
        if ((typeof activeRidingBoat !== "undefined" && activeRidingBoat) || (typeof activeRidingMech !== "undefined" && activeRidingMech)) return false;
        if (typeof ragdollEnabled !== "undefined" && ragdollEnabled) return false;
        if (!st || st.mode === "charging" || st.mode === "dashing") return false;

        const _lockDist = window.getUnifiedMeleeReach();
        const weaponId = (st === window.tantoShirasayaState) ? "TANTO" : "AEGIS_SHIFT";
        const target = (typeof window.findTantoBestTarget === "function") ? window.findTantoBestTarget(_lockDist, weaponId) : null;
        st.lockedTarget = target;
        if (target && typeof activeTargetNPC !== "undefined") {
          activeTargetNPC = target;
        }
        st.mode = "charging";
        st.comboStep = 1;
        st.comboActive = false;
        st.chargeTime = 0.0;
        st.stopForwardMove = false;
        st.hitEntities = null;
        st.impactPlayed = false;
        st.visualSpinYaw = 0.0;
        st.visualAirLift = 0.0;
        if (resetPostGrace) st.postGraceTimer = 0.0;
        st.slotIndex = (typeof slotIndex === "number") ? slotIndex : -1;
        if (typeof playSwordDrawSound === "function") playSwordDrawSound();
        return true;
      }

      function _releaseMeleeChargeSkillCommon(st, execFn) {
        if (!st || st.mode !== "charging") return;
        if (st.chargeTime < st.holdThreshold) {
          st.comboActive = false;
          execFn(1, false);
        } else {
          const curHunger = (typeof playerHunger === "number")
            ? playerHunger
            : (typeof window.playerHunger === "number" ? window.playerHunger : 5);
          if (curHunger >= 1) {
            st.comboActive = true;
            execFn(1, true);
          } else {
            st.comboActive = false;
            execFn(1, false);
          }
        }
      }

      function _executeUnifiedMeleeSkillStep(st, step, startComboCycle, cfg) {
        if (!st) return false;
        const stepNum = Math.max(1, Math.min(4, step || 1));

        if (startComboCycle) {
          const curHunger = (typeof playerHunger === "number")
            ? playerHunger
            : (typeof window.playerHunger === "number" ? window.playerHunger : 5);
          if (curHunger < 1) {
            return false;
          }
          // Deduct 1 hunger slot per full 4-skill combo cycle
          const nextHunger = Math.max(0, curHunger - 1);
          if (typeof playerHunger !== "undefined") playerHunger = nextHunger;
          window.playerHunger = nextHunger;
          if (typeof playerHungerTimer !== "undefined") playerHungerTimer = 0.0;
          if (typeof updatePlayerHPUI === "function") updatePlayerHPUI();
          if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
          if (typeof showNotice === "function") {
            const maxH = (typeof playerMaxHunger === "number") ? playerMaxHunger : 5;
            showNotice(cfg.comboNotice(nextHunger, maxH));
          }
        } else if (stepNum === 1 && !st.comboActive) {
          if (typeof showNotice === "function") {
            showNotice(cfg.singleNotice);
          }
        }

        // Refresh / acquire locked target on step start using unified melee reach
        const _lockDist = window.getUnifiedMeleeReach();
        const _stepWeaponId = (st === window.tantoShirasayaState) ? "TANTO" : "AEGIS_SHIFT";
        let target = st.lockedTarget;
        const _canHitTarget = (t) => !!(
          t && t.position && (
            (!t.ragdollEnabled && (t.hp === undefined || t.hp > 0)) ||
            (_stepWeaponId === "TANTO" && typeof window.isButcherableNpcCorpse === "function" && window.isButcherableNpcCorpse(t, "TANTO"))
          )
        );
        if (!_canHitTarget(target)) {
          target = (typeof window.findTantoBestTarget === "function") ? window.findTantoBestTarget(_lockDist, _stepWeaponId) : null;
          st.lockedTarget = target;
        }
        if (target && typeof activeTargetNPC !== "undefined") {
          activeTargetNPC = target;
        }

        const sinT = Math.sin(charTheta), cosT = Math.cos(charTheta);
        const sinP = Math.sin(charPhi), cosP = Math.cos(charPhi);
        const nx = sinT * cosP, ny = cosT, nz = sinT * sinP;
        const North = [-cosT * cosP, sinT, -cosT * sinP];
        const East = [-sinP, 0, cosP];
        const gSeed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : 0;
        const curHgt = (typeof getHeightOnSphere === "function") ? getHeightOnSphere(charTheta, charPhi, gSeed) : 0;
        const pScale = (typeof playerScale === "number") ? playerScale : 0.1;
        const minGroundR = RADIUS + curHgt * HEIGHT_SCALE + 0.46 * pScale;
        const curPlayerR = (typeof playerCenterRadius === "number" && playerCenterRadius !== null) ? playerCenterRadius : minGroundR;

        // Default heading toward camera look in TPS/FPS
        if (typeof cameraMode !== "undefined" && (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") && typeof rotationY === "number") {
          if (typeof charHeading !== "undefined") charHeading = rotationY;
        }

        let targetHorizDist = null;
        if (target && target.position) {
          const tPos = (typeof window.getNPCTargetPoint === "function" ? window.getNPCTargetPoint(target) : null) || target.position;
          const dx = tPos[0] - curPlayerR * nx;
          const dy = tPos[1] - curPlayerR * ny;
          const dz = tPos[2] - curPlayerR * nz;
          const tN = dx * North[0] + dy * North[1] + dz * North[2];
          const tE = dx * East[0] + dy * East[1] + dz * East[2];
          targetHorizDist = Math.hypot(tN, tE);
          if (targetHorizDist > 0.05) {
            const aimH = Math.atan2(tE, tN);
            if (typeof charHeading !== "undefined") charHeading = aimH;
          }
          const npcR = Math.hypot(tPos[0], tPos[1], tPos[2]);
          if (stepNum === 1) {
            if (npcR > minGroundR + 0.14 || curPlayerR > minGroundR + 0.10) {
              st.isAerialCombo = true;
              st.aerialTarget = target;
              st.aerialBaseRadius = Math.max(curPlayerR, npcR);
            } else {
              st.isAerialCombo = false;
              st.aerialTarget = null;
              st.aerialBaseRadius = null;
            }
          }
        } else if (stepNum === 1) {
          if (curPlayerR > minGroundR + 0.10) {
            st.isAerialCombo = true;
            st.aerialTarget = null;
            st.aerialBaseRadius = curPlayerR;
          } else {
            st.isAerialCombo = false;
            st.aerialTarget = null;
            st.aerialBaseRadius = null;
          }
        }

        const h = (typeof charHeading === "number") ? charHeading : 0.0;
        st.dashDirNorth = Math.cos(h);
        st.dashDirEast = Math.sin(h);
        st.mode = "dashing";
        st.comboStep = stepNum;
        st.hitEntities = new Set();
        st.impactPlayed = false;
        st.stopForwardMove = false;
        if (cfg.alwaysClearAirLift || stepNum !== 4) {
          st.visualAirLift = 0.0;
        }
        st.visualSpinYaw = 0.0;
        if (cfg.clearPostGrace) {
          st.postGraceTimer = 0.0;
        }

        st.dashDuration = cfg.durations[stepNum - 1];
        if (stepNum === 1) {
          // Gap-close cleanly toward target distance without blasting way past
          if (targetHorizDist !== null && targetHorizDist <= 0.45) {
            st.dashSpeed = 0.006;
          } else if (targetHorizDist !== null && targetHorizDist < 2.2) {
            st.dashSpeed = Math.max(0.014, Math.min(cfg.step1MaxSpeed, targetHorizDist * cfg.step1DistMul));
          } else {
            st.dashSpeed = 0.023;
          }
        } else {
          const idx = stepNum - 2;
          st.dashSpeed = st.isAerialCombo ? cfg.aerialSpeeds[idx] : cfg.groundSpeeds[idx];
        }
        st.dashTimer = st.dashDuration;

        if (cfg.playDrawOnStep1Single && stepNum === 1 && !st.comboActive && typeof playSwordDrawSound === "function") {
          playSwordDrawSound();
        }
        if (typeof playSwordSlashSound === "function") {
          playSwordSlashSound(cfg.mapSlashSound ? cfg.mapSlashSound(stepNum) : stepNum);
        } else if (typeof playChopSound === "function") {
          playChopSound();
        }
        return true;
      }

      const _SHIRASAYA_SKILL_CFG = {
        comboNotice: (nextHunger, maxH) => `⚡🗡️ คอมโบชิราซายะ 4 ท่า! (-1 ความหิว | เหลือ ${nextHunger}/${maxH})`,
        singleNotice: "🗡️💨 พุ่งฟันชิราซายะ! (คลิกเดียว: ดาเมจ 1 HP | ไม่เสียความหิว)",
        alwaysClearAirLift: false,
        clearPostGrace: false,
        durations: [0.27, 0.34, 0.40, 0.38],
        step1MaxSpeed: 0.032,
        step1DistMul: 0.022,
        aerialSpeeds: [0.008, 0.006, 0.006],
        groundSpeeds: [0.013, 0.010, 0.008],
        playDrawOnStep1Single: false,
        mapSlashSound: null
      };

      const _AEGIS_SKILL_CFG = {
        comboNotice: (nextHunger, maxH) => `⚡⚔️ คอมโบดาบใหญ่ Aegis-Shift 4 ท่า! (ท่าละ 2 DMG | -1 ความหิว | เหลือ ${nextHunger}/${maxH})`,
        singleNotice: "⚔️⚡ Aegis-Shift: แปลงเป็นดาบใหญ่พุ่งฟัน! (คลิกเดียว: 2 HP | ไม่เสียความหิว)",
        alwaysClearAirLift: true,
        clearPostGrace: true,
        durations: [0.38, 0.36, 0.38, 0.44],
        step1MaxSpeed: 0.030,
        step1DistMul: 0.021,
        aerialSpeeds: [0.007, 0.006, 0.006],
        groundSpeeds: [0.012, 0.010, 0.009],
        playDrawOnStep1Single: true,
        mapSlashSound: (stepNum) => (stepNum === 1 ? 4 : stepNum)
      };

      window.resetTantoShirasayaState = function() {
        _resetMeleeSkillStateCommon(window.tantoShirasayaState);
      };

      window.executeTantoSkillStep = function(step, startComboCycle = false) {
        return _executeUnifiedMeleeSkillStep(window.tantoShirasayaState, step, startComboCycle, _SHIRASAYA_SKILL_CFG);
      };

      window.executeTantoShirasayaDash = function() {
        return window.executeTantoSkillStep(1, true);
      };

      window.startTantoChargeSkill = function(item, slotIndex) {
        return _startMeleeChargeSkillCommon(window.tantoShirasayaState, item, slotIndex, ["TANTO", "tanto"], false);
      };

      window.releaseTantoChargeSkill = function() {
        _releaseMeleeChargeSkillCommon(window.tantoShirasayaState, window.executeTantoSkillStep);
      };

      window.aegisShiftState = {
        mode: "idle", // "idle" | "charging" | "dashing" | "post_skill"
        comboStep: 1, // 1 = Dash Cleave, 2 = Rising Diagonal Slash, 3 = Horizontal Waist Cleave, 4 = Overhead Vertical Slam
        comboActive: false,
        chargeTime: 0.0,
        holdThreshold: 0.15,
        comboChargeTrigger: 0.22,
        toolMode: "pickaxe", // "pickaxe" | "axe"
        toolModeTimer: 0.0,
        dashTimer: 0.0,
        dashDuration: 0.38,
        dashSpeed: 0.023,
        dashDirNorth: 0.0,
        dashDirEast: 0.0,
        lockedTarget: null,
        isAerialCombo: false,
        aerialTarget: null,
        aerialBaseRadius: null,
        stopForwardMove: false,
        hitEntities: null,
        impactPlayed: false,
        visualSpinYaw: 0.0,
        visualAirLift: 0.0,
        postGraceTimer: 0.0,
        slotIndex: -1
      };

      window.resetAegisShiftState = function() {
        _resetMeleeSkillStateCommon(window.aegisShiftState);
      };

      window.executeAegisSkillStep = function(step, startComboCycle = false) {
        return _executeUnifiedMeleeSkillStep(window.aegisShiftState, step, startComboCycle, _AEGIS_SKILL_CFG);
      };

      window.startAegisShiftDashSkill = function(item, slotIndex) {
        return _startMeleeChargeSkillCommon(window.aegisShiftState, item, slotIndex, ["AEGIS_SHIFT", "aegis_shift"], true);
      };
      window.startAegisChargeSkill = window.startAegisShiftDashSkill;

      window.releaseAegisChargeSkill = function() {
        _releaseMeleeChargeSkillCommon(window.aegisShiftState, window.executeAegisSkillStep);
      };

      function performSmashActionLogic() {
        checkMeleeHit("HAND");
        setTimeout(() => {
          isUsingItem = false;
          isSmashing = false; 
          activeItem = originalItem;
        }, 500);
      }

      function performSmashAction() {
        console.log("Performing smash action...");
        useAnimTimer = 1.0;
        isUsingItem = true;
        isSmashing = true; 
        
        originalItem = activeItem; 
        activeItem = { name: "HAND" }; 
        
        performSmashActionLogic();
      }
      
      let originalItem = null;

      function handleDragStart(e, source, index) {
        let item = getSlotItem(source, index);

        if (!item) {
          e.preventDefault();
          return;
        }

        e.dataTransfer.setData("source", source);
        e.dataTransfer.setData("index", index);
        e.dataTransfer.setData("text/plain", JSON.stringify({ source, index }));
        e.dataTransfer.effectAllowed = "move";

        const target = e.currentTarget;
        target.classList.add("dragging");

        if (e.dataTransfer && typeof e.dataTransfer.setDragImage === "function") {
          const offsetX = target.offsetWidth ? target.offsetWidth / 2 : 28;
          const offsetY = target.offsetHeight ? target.offsetHeight / 2 : 28;
          e.dataTransfer.setDragImage(target, offsetX, offsetY);
        }

        setTimeout(() => {
          target.classList.add("dragging-active");
          target.classList.remove("dragging");
        }, 0);
      }

      function handleDragEnd(e) {
        e.currentTarget.classList.remove("dragging");
        e.currentTarget.classList.remove("dragging-active");
        
        // Remove dragover class from all slots just in case
        document.querySelectorAll(".inventory-slot, .action-slot").forEach(slot => {
          slot.classList.remove("dragover");
        });
      }

      function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.classList.add("dragover");
      }

      function handleDragLeave(e) {
        e.currentTarget.classList.remove("dragover");
      }

      function handleDrop(e, targetSource, targetIndex) {
        e.preventDefault();
        e.currentTarget.classList.remove("dragover");

        try {
          let source = e.dataTransfer.getData("source");
          let sourceIndex = parseInt(e.dataTransfer.getData("index"), 10);
          if (!source) {
            const dataStr = e.dataTransfer.getData("text/plain");
            if (dataStr) {
              const data = JSON.parse(dataStr);
              source = data.source;
              sourceIndex = data.index;
            }
          }

          if (!source || isNaN(sourceIndex)) return;
          if (source === targetSource && sourceIndex === targetIndex) return;

          let fromItem = getSlotItem(source, sourceIndex);
          if (!fromItem) return;

          let effTargetIndex = targetIndex;
          if (targetSource === "equip") {
            const reqEquipIdx = getEquipSlotIndexForItem(fromItem, targetIndex);
            if (reqEquipIdx === -1) {
              if (typeof showNotice === "function") showNotice("⚠️ ไอเทมนี้ไม่ใช่เสื้อผ้าหรือของตกแต่งตัวละคร");
              return;
            }
            effTargetIndex = reqEquipIdx;
          }
          if (source === targetSource && sourceIndex === effTargetIndex) return;

          let toItem = getSlotItem(targetSource, effTargetIndex);
          if (source === "equip" && toItem) {
            const validBack = getValidEquipSlotsForItem(toItem);
            if (!validBack.includes(sourceIndex)) return;
          }

          const fromName = fromItem.name || fromItem.label;
          const toName = toItem ? (toItem.name || toItem.label) : null;

          // Stacking if dropping onto same item type (up to 30 per slot)
          if (toItem && fromName === toName && targetSource !== "equip") {
            const toCount = toItem.count || 1;
            const fromCount = fromItem.count || 1;
            const room = MAX_STACK_PER_SLOT - toCount;
            if (room > 0) {
              const moveAmount = Math.min(room, fromCount);
              toItem.count = toCount + moveAmount;
              if (fromCount > moveAmount) {
                fromItem.count = fromCount - moveAmount;
              } else {
                setSlotItem(source, sourceIndex, null);
              }
            } else {
              setSlotItem(source, sourceIndex, toItem);
              setSlotItem(targetSource, effTargetIndex, fromItem);
            }
          } else {
            // Swap/Move items
            setSlotItem(source, sourceIndex, toItem);
            setSlotItem(targetSource, effTargetIndex, fromItem);
          }

          if (currentOpenChest) renderChest();
          renderInventory();
          renderActionSlots();
          if (typeof renderEquipSlots === "function") renderEquipSlots();
          updateBadge();
          saveSettingsToLocalStorage();
        } catch (err) {
          console.error("Drop error", err);
        }
      }

      let _activeNoticeToast = null;
      let _activeNoticeTimer = null;
      let _activeNoticeFadeTimer = null;
      let _lastNoticeMsg = "";
      let _lastNoticeTime = 0;

      function showNotice(msg) {
        // Essential gamepad connection, flight, damage, unconscious penalties, and status notices should always be displayed to players
        const isEssentialNotice = typeof msg === "string" && (
          msg.includes("🎮") ||
          msg.includes("🪽") ||
          msg.includes("💀") ||
          msg.includes("หมดสติ") ||
          msg.includes("Unconscious") ||
          msg.includes("ทำลาย") ||
          msg.includes("สูญเสีย") ||
          msg.includes("ความหิว") ||
          msg.includes("HP")
        );
        if (!isDevMode && !isEssentialNotice) {
          return; // ซ่อนการแจ้งเตือนทั่วไปในโหมดเซฟ
        }
        const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        if (msg === _lastNoticeMsg && now - _lastNoticeTime < 1500) {
          return; // ป้องกันการเรียกซ้ำรัวๆ จาก game loop / render loop
        }
        _lastNoticeMsg = msg;
        _lastNoticeTime = now;

        if (!_activeNoticeToast) {
          _activeNoticeToast = document.createElement("div");
          _activeNoticeToast.style.position = "fixed";
          _activeNoticeToast.style.bottom = "100px";
          _activeNoticeToast.style.left = "50%";
          _activeNoticeToast.style.transform = "translateX(-50%)";
          _activeNoticeToast.style.background = "rgba(10, 10, 15, 0.9)";
          _activeNoticeToast.style.color = "#34d399";
          _activeNoticeToast.style.border = "1px solid rgba(52, 211, 153, 0.4)";
          _activeNoticeToast.style.padding = "10px 20px";
          _activeNoticeToast.style.borderRadius = "8px";
          _activeNoticeToast.style.fontFamily = "'Google Sans', sans-serif";
          _activeNoticeToast.style.fontSize = "13px";
          _activeNoticeToast.style.zIndex = "999999";
          _activeNoticeToast.style.pointerEvents = "none";
          _activeNoticeToast.style.boxShadow = "0 8px 32px rgba(0,0,0,0.6)";
          _activeNoticeToast.style.transition = "opacity 0.25s, transform 0.25s";
          document.body.appendChild(_activeNoticeToast);
        }

        if (_activeNoticeTimer) clearTimeout(_activeNoticeTimer);
        if (_activeNoticeFadeTimer) clearTimeout(_activeNoticeFadeTimer);

        let finalMsg = msg;
        if (window.GamepadController && typeof window.GamepadController.formatPromptText === "function") {
          finalMsg = window.GamepadController.formatPromptText(finalMsg);
        }
        const curLang = typeof getGameLanguage === "function" ? getGameLanguage() : (window.gameLanguage || "en");
        if (curLang === "seedian" && window.Seedian && typeof window.Seedian.toSeedian === "function") {
          finalMsg = window.Seedian.toSeedian(msg);
        }

        if (typeof window.setElementTextOrHTML === "function") {
          window.setElementTextOrHTML(_activeNoticeToast, finalMsg);
        } else if (typeof finalMsg === "string" && (finalMsg.includes("<svg") || finalMsg.includes("<span"))) {
          _activeNoticeToast.innerHTML = finalMsg;
        } else {
          _activeNoticeToast.textContent = finalMsg;
        }

        _activeNoticeToast.style.opacity = "1";
        _activeNoticeToast.style.transform = "translateX(-50%) translateY(0)";

        _activeNoticeTimer = setTimeout(() => {
          if (_activeNoticeToast) {
            _activeNoticeToast.style.opacity = "0";
            _activeNoticeToast.style.transform = "translateX(-50%) translateY(10px)";
            _activeNoticeFadeTimer = setTimeout(() => {
              if (_activeNoticeToast) {
                _activeNoticeToast.remove();
                _activeNoticeToast = null;
              }
            }, 300);
          }
        }, 2500);
      }

      function isItemMatch(item, targetName) {
        if (!item) return false;
        if (item.name === targetName || item.label === targetName) return true;
        if ((targetName === "COTTON" || targetName === "COTTON_PLANT") && (item.name === "COTTON_PLANT" || item.name === "COTTON" || item.label === "COTTON_PLANT" || item.label === "COTTON")) return true;
        if (targetName === "CROWN_FLOWER" && (item.name === "CROWN_FLOWER" || item.name === "crown_flower" || item.label === "CROWN_FLOWER" || item.label === "crown_flower")) return true;
        if (targetName === "RUBBER_BLOCK" && (item.name === "RUBBER_BLOCK" || item.name === "rubber_block" || item.label === "RUBBER_BLOCK" || item.label === "rubber_block")) return true;
        if (targetName === "TOUGH_MEAT" && (item.name === "TOUGH_MEAT" || item.name === "tough_meat" || item.label === "TOUGH_MEAT" || item.label === "tough_meat")) return true;
        if ((targetName === "LEATHER" || targetName === "HIDE") && (item.name === "LEATHER" || item.name === "leather" || item.name === "HIDE" || item.name === "hide" || item.label === "LEATHER" || item.label === "leather" || item.label === "HIDE" || item.label === "hide")) return true;
        if (targetName === "OBSIDIAN_CUBE" && (item.name === "obsidian_cube_item" || item.name === "obsidian_cube" || item.label === "obsidian_cube_item" || item.label === "obsidian_cube")) return true;
        return false;
      }

      function getItemCount(name) {
        let total = 0;
        // Check inventory (unlocked slots)
        for (let i = 0; i < UNLOCKED_SLOTS; i++) {
          const item = inventory[i];
          if (isItemMatch(item, name)) {
            total += item.count || 1;
          }
        }
        // Check action slots
        for (let i = 0; i < actionSlotsItems.length; i++) {
          const item = actionSlotsItems[i];
          if (isItemMatch(item, name)) {
            total += item.count || 1;
          }
        }
        return total;
      }

      function consumeItem(name, count) {
        let remaining = count;
        
        // Consume from inventory first
        for (let i = 0; i < UNLOCKED_SLOTS; i++) {
          if (remaining <= 0) break;
          const item = inventory[i];
          if (isItemMatch(item, name)) {
            if (item.count > remaining) {
              item.count -= remaining;
              remaining = 0;
            } else {
              remaining -= item.count;
              inventory[i] = null;
            }
          }
        }
        
        // Consume from action slots
        for (let i = 0; i < actionSlotsItems.length; i++) {
          if (remaining <= 0) break;
          const item = actionSlotsItems[i];
          if (isItemMatch(item, name)) {
            if (item.count > remaining) {
              item.count -= remaining;
              remaining = 0;
            } else {
              remaining -= item.count;
              actionSlotsItems[i] = null;
              if (selectedActionSlotIndex === i) {
                selectedActionSlotIndex = -1;
              }
            }
          }
        }
      }

      
      const COOKING_RECIPES = [
        {
          id: "fried_bug",
          output: { name: "FRIED_BUG", icon: "🍤", count: 1, label: "แมลงทอด (FRIED BUG) x1" },
          ingredients: [
            { name: "MEGANEURA", icon: "🦟", count: 1, label: "แมลงยักษ์ (MEGANEURA)" }
          ]
        }
      ];

            function openCookingUI() {
        document.getElementById("inventoryOverlay").classList.add("open");
        document.getElementById("tabCooking").style.display = "inline-flex";
        
        // Hide other tabs
        document.getElementById("tabInventory").style.display = "none";
        document.getElementById("tabItemsList").style.display = "none";
        document.getElementById("tabSettings").style.display = "none";
        document.getElementById("tabCrafting").style.display = "none";
        document.getElementById("quitGameBtn").style.display = "none";
        
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
        
        renderCooking();
      }

      function renderCooking() {
        window.renderCooking = renderCooking;
        const list = document.getElementById("cookingList");
        if (!list) return;
        list.innerHTML = "";
        
        COOKING_RECIPES.forEach(recipe => {
          const card = document.createElement("div");
          card.style.background = "rgba(255, 255, 255, 0.03)";
          card.style.border = "1px solid rgba(255, 255, 255, 0.08)";
          card.style.borderRadius = "0px";
          card.style.padding = "12px";
          card.style.display = "flex";
          card.style.flexDirection = "column";
          card.style.gap = "8px";

          const cardHeader = document.createElement("div");
          cardHeader.style.display = "flex";
          cardHeader.style.alignItems = "center";
          cardHeader.style.justifyContent = "space-between";

          const itemInfo = document.createElement("div");
          itemInfo.style.display = "flex";
          itemInfo.style.alignItems = "center";
          itemInfo.style.gap = "8px";

          const itemIcon = document.createElement("span");
          itemIcon.style.fontSize = "24px";
          itemIcon.style.display = "inline-flex";
          itemIcon.style.alignItems = "center";
          itemIcon.style.justifyContent = "center";

          const canvas3D = create3DIconCanvas(recipe.output, 40, 40);
          if (canvas3D) {
            itemIcon.appendChild(canvas3D);
          } else {
            itemIcon.textContent = recipe.output.icon;
          }

          const itemName = document.createElement("span");
          itemName.style.fontFamily = "'Google Sans', sans-serif";
          itemName.style.fontWeight = "bold";
          itemName.style.fontSize = "14px";
          itemName.style.color = "#df6c6c";
          const outName = typeof getItemDisplayName === "function" ? getItemDisplayName(recipe.output.name) : recipe.output.name;
          const outNameStr = outName + (recipe.output.count > 1 ? ` x${recipe.output.count}` : "");
          if (typeof window.setElementTextOrHTML === "function") {
            window.setElementTextOrHTML(itemName, outNameStr);
          } else {
            itemName.textContent = outNameStr;
          }

          itemInfo.appendChild(itemIcon);
          itemInfo.appendChild(itemName);
          cardHeader.appendChild(itemInfo);

          const ingContainer = document.createElement("div");
          ingContainer.style.display = "flex";
          ingContainer.style.flexDirection = "column";
          ingContainer.style.gap = "4px";
          ingContainer.style.background = "rgba(0, 0, 0, 0.2)";
          ingContainer.style.padding = "6px 10px";
          ingContainer.style.borderRadius = "0px";

          let canCraft = true;
          recipe.ingredients.forEach(ing => {
            const currentCount = getItemCount(ing.name);
            const isEnough = currentCount >= ing.count;
            if (!isEnough) {
              canCraft = false;
            }
            const ingLine = document.createElement("div");
            ingLine.style.display = "flex";
            ingLine.style.justifyContent = "space-between";
            ingLine.style.alignItems = "center";
            ingLine.style.fontSize = "12px";
            ingLine.style.fontFamily = "'Google Sans', sans-serif";

            const ingLeft = document.createElement("span");
            ingLeft.style.display = "flex";
            ingLeft.style.alignItems = "center";
            ingLeft.style.gap = "6px";
            
            const ingIconSpan = document.createElement("span");
            ingIconSpan.style.display = "inline-flex";
            ingIconSpan.style.alignItems = "center";
            ingIconSpan.style.justifyContent = "center";

            const canvas3D = create3DIconCanvas(ing, 22, 22);
            if (canvas3D) {
              ingIconSpan.appendChild(canvas3D);
            } else {
              ingIconSpan.textContent = ing.icon;
            }
            
            const ingLabelSpan = document.createElement("span");
            const ingDispName = typeof getItemDisplayName === "function" ? getItemDisplayName(ing.name) : (ing.label || ing.name);
            if (typeof window.setElementTextOrHTML === "function") {
              window.setElementTextOrHTML(ingLabelSpan, ingDispName);
            } else {
              ingLabelSpan.textContent = ingDispName;
            }
            
            ingLeft.appendChild(ingIconSpan);
            ingLeft.appendChild(ingLabelSpan);

            const ingRight = document.createElement("span");
            ingRight.style.color = isEnough ? "#34d399" : "#f87171";
            ingRight.textContent = `${currentCount} / ${ing.count}`;

            ingLine.appendChild(ingLeft);
            ingLine.appendChild(ingRight);
            ingContainer.appendChild(ingLine);
          });

          card.appendChild(cardHeader);
          card.appendChild(ingContainer);

          const btn = document.createElement("button");
          btn.style.width = "100%";
          btn.style.padding = "8px 0";
          btn.style.fontFamily = "'Google Sans', sans-serif";
          btn.style.fontWeight = "bold";
          btn.style.fontSize = "12px";
          btn.style.cursor = canCraft ? "pointer" : "not-allowed";
          btn.style.transition = "all 0.2s";
          btn.style.clipPath = "polygon(0% 0%, 96% 0%, 100% 8px, 100% 100%, 4% 100%, 0% calc(100% - 8px))";
          if (canCraft) {
            btn.style.background = "rgba(223, 108, 108, 0.15)";
            btn.style.border = "1px solid #df6c6c";
            btn.style.color = "#df6c6c";
            btn.style.textShadow = "0 0 6px rgba(223, 108, 108, 0.4)";
            const cookLabel = typeof t === "function" ? t("cook_btn") : "ทำอาหาร (Cook)";
            btn.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                </svg>
                <span>${cookLabel}</span>
              </div>
            `;
            
            btn.onmouseenter = () => {
              btn.style.background = "rgba(223, 108, 108, 0.3)";
              btn.style.boxShadow = "0 0 12px rgba(223, 108, 108, 0.15)";
            };
            btn.onmouseleave = () => {
              btn.style.background = "rgba(223, 108, 108, 0.15)";
              btn.style.boxShadow = "none";
            };
            btn.onclick = () => {
              recipe.ingredients.forEach(ing => {
                consumeItem(ing.name, ing.count);
              });
              addItemToInventory({
                name: recipe.output.name,
                label: recipe.output.name,
                icon: recipe.output.icon,
                count: recipe.output.count || 1
              });
              renderCooking();
              renderInventory();
              if (typeof playCollectSound === "function") {
                playCollectSound();
              }
            };
          } else {
            btn.style.background = "rgba(255, 255, 255, 0.05)";
            btn.style.border = "1px solid rgba(255, 255, 255, 0.1)";
            btn.style.color = "rgba(255, 255, 255, 0.3)";
            const insufficientLabel = typeof t === "function" ? t("insufficient_materials") : "วัตถุดิบไม่เพียงพอ (Insufficient Materials)";
            if (typeof window.setElementTextOrHTML === "function") {
              window.setElementTextOrHTML(btn, insufficientLabel);
            } else {
              btn.textContent = insufficientLabel;
            }
            btn.disabled = true;
          }

          card.appendChild(btn);
          list.appendChild(card);
        });
        if (typeof updateCustomScrollbar === "function") setTimeout(updateCustomScrollbar, 30);
      }
      window.renderCooking = renderCooking;

      function renderCrafting() {
        window.renderCrafting = renderCrafting;
        const craftingList = document.getElementById("craftingList");
        if (!craftingList) return;
        craftingList.innerHTML = "";

        const CRAFTING_RECIPES = [
          {
            id: "axe",
            output: { name: "AXE", icon: "🪓", label: "ขวาน (AXE)" },
            ingredients: [
              { name: "ROCK", icon: "🪨", count: 1, label: "หิน (ROCK)" },
              { name: "BRANCH", icon: "🌿", count: 3, label: "กิ่งไม้ (BRANCH)" }
            ]
          },
          {
            id: "wood_chest",
            output: { name: "WOOD_CHEST", icon: "📦", count: 1, label: "กล่องไม้ (WOODEN CHEST) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 2, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "wood_bed",
            output: { name: "WOOD_BED", icon: "🛏️", count: 1, label: "เตียงไม้พร้อมฟูก (WOODEN BED) x1" },
            ingredients: [
              { name: "COTTON_PLANT", icon: "☁️", count: 50, label: "ต้นฝ้าย (COTTON) x50" },
              { name: "LOG", icon: "🪵", count: 3, label: "ท่อนไม้ (LOG) x3" }
            ]
          },
          {
            id: "cloth",
            output: { name: "CLOTH", icon: "⬜", count: 10, label: "ผ้า (CLOTH) x10" },
            ingredients: [
              { name: "COTTON_PLANT", icon: "☁️", count: 50, label: "ต้นฝ้าย (นุ่น) x50" },
              { name: "GRASS", icon: "🌱", count: 50, label: "หญ้า (GRASS) x50" }
            ]
          },
          {
            id: "rubber_block",
            output: { name: "RUBBER_BLOCK", icon: "⬛", count: 1, label: "ก้อนยาง (RUBBER BLOCK) x1" },
            ingredients: [
              { name: "CROWN_FLOWER", icon: "💮", count: 10, label: "ต้นรัก (Crown Flower) x10" }
            ]
          },
          {
            id: "traveler_boots",
            output: { name: "TRAVELER_BOOTS", icon: "🥾", count: 1, label: "รองเท้าบูทนักเดินทาง (Traveler Ankle Boots) x1" },
            ingredients: [
              { name: "LEATHER", icon: "🟫", count: 1, label: "หนัง (LEATHER) x1" },
              { name: "RUBBER_BLOCK", icon: "⬛", count: 1, label: "ก้อนยาง (RUBBER BLOCK) x1" }
            ]
          },
          {
            id: "oxford_shoes",
            output: { name: "OXFORD_SHOES", icon: "👞", count: 1, label: "รองเท้าหนัง Oxford (Cap-Toe Oxford Shoes) x1" },
            ingredients: [
              { name: "LEATHER", icon: "🟫", count: 1, label: "หนัง (LEATHER) x1" },
              { name: "RUBBER_BLOCK", icon: "⬛", count: 1, label: "ก้อนยาง (RUBBER BLOCK) x1" }
            ]
          },
          {
            id: "dress_boots",
            output: { name: "DRESS_BOOTS", icon: "🥾", count: 1, label: "รองเท้าบูทหนัง Dress Boots (Cap-Toe Dress Boots) x1" },
            ingredients: [
              { name: "LEATHER", icon: "🟫", count: 1, label: "หนัง (LEATHER) x1" },
              { name: "RUBBER_BLOCK", icon: "⬛", count: 1, label: "ก้อนยาง (RUBBER BLOCK) x1" }
            ]
          },
          {
            id: "white_shirt_short",
            output: { name: "WHITE_SHIRT_SHORT", icon: "👔", count: 1, label: "เสื้อเชิ้ตสีขาวแขนสั้น (White Short-Sleeve Shirt) x1" },
            ingredients: [
              { name: "CLOTH", icon: "⬜", count: 3, label: "ผ้า (CLOTH) x3" }
            ]
          },
          {
            id: "black_pleated_skirt",
            output: { name: "BLACK_PLEATED_SKIRT", icon: "👗", count: 1, label: "กระโปรงพลีทสีดำ (Black Pleated Skirt) x1" },
            ingredients: [
              { name: "CLOTH", icon: "⬜", count: 2, label: "ผ้า (CLOTH) x2" }
            ]
          },
          {
            id: "black_leggings",
            output: { name: "BLACK_LEGGINGS", icon: "👖", count: 1, label: "กางเกงเลกกิ้งสีดำ (Black Leggings) x1" },
            ingredients: [
              { name: "CLOTH", icon: "⬜", count: 3, label: "ผ้า (CLOTH) x3" }
            ]
          },
          {
            id: "double_breasted_suit",
            output: { name: "DOUBLE_BREASTED_SUIT", icon: "🧥", count: 1, label: "สูทกระดุมสองแถว (Double-Breasted Suit Jacket) x1" },
            ingredients: [
              { name: "CLOTH", icon: "⬜", count: 5, label: "ผ้า (CLOTH) x5" }
            ]
          },
          {
            id: "black_slacks",
            output: { name: "BLACK_SLACKS", icon: "👖", count: 1, label: "กางเกงสแล็ค (Black Dress Slacks) x1" },
            ingredients: [
              { name: "CLOTH", icon: "⬜", count: 3, label: "ผ้า (CLOTH) x3" }
            ]
          },
          {
            id: "opera_cape",
            output: { name: "OPERA_CAPE", icon: "🧛", count: 1, label: "ผ้าคลุมไหล่ Opera Cape (Opera Cape) x1" },
            ingredients: [
              { name: "CLOTH", icon: "⬜", count: 2, label: "ผ้า (CLOTH) x2" }
            ]
          },
          {
            id: "wood_table",
            output: { name: "WOOD_TABLE", icon: "🪑", count: 1, label: "โต๊ะไม้ (WOODEN TABLE) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "wood_planter_box",
            output: { name: "WOOD_PLANTER_BOX", icon: "🪴", count: 1, label: "กล่องไม้ใส่ดิน (WOOD PLANTER BOX) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" },
              { name: "DIRT", icon: "🟫", count: 1, label: "ดิน (DIRT)" }
            ]
          },
          {
            id: "wood_chair",
            output: { name: "WOOD_CHAIR", icon: "🪑", count: 1, label: "เก้าอี้ไม้ (WOODEN CHAIR) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "lantern",
            output: { name: "LANTERN", icon: "🏮", count: 1, label: "ตะเกียง (LANTERN) x1" },
            ingredients: [
              { name: "GLOW_ORE", icon: "✨", count: 1, label: "แร่หินเรืองแสง (GLOWING ORE)" },
              { name: "IRON_ORE", icon: "🟥", count: 1, label: "แร่เหล็ก (IRON ORE)" }
            ]
          },
          {
            id: "shovel",
            output: { name: "SHOVEL", icon: "🥄", count: 1, label: "พลั่ว (SHOVEL) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" },
              { name: "BIG_ROCK", icon: "🪨", count: 1, label: "หินใหญ่ (BIG ROCK)" }
            ]
          },
          {
            id: "iron_bucket",
            output: { name: "IRON_BUCKET", icon: "🪣", count: 1, label: "ถังเหล็ก (IRON BUCKET) x1" },
            ingredients: [
              { name: "IRON_ORE", icon: "🟥", count: 1, label: "แร่เหล็ก (IRON ORE)" }
            ]
          },
          {
            id: "pickaxe",
            output: { name: "PICKAXE", icon: "⛏️", label: "อีเตอร์ (PICKAXE)" },
            ingredients: [
              { name: "ROCK", icon: "🪨", count: 2, label: "หิน (ROCK)" },
              { name: "BRANCH", icon: "🌿", count: 3, label: "กิ่งไม้ (BRANCH)" }
            ]
          },
          {
            id: "campfire",
            output: { name: "CAMPFIRE", icon: "🔥", label: "กองไฟ (CAMPFIRE)" },
            ingredients: [
              { name: "BRANCH", icon: "🌿", count: 5, label: "กิ่งไม้ (BRANCH)" },
              { name: "ROCK", icon: "🪨", count: 5, label: "หิน (ROCK)" }
            ]
          },
          {
            id: "wood_boat",
            output: { name: "WOOD_BOAT", icon: "🛶", label: "เรือไม้ (WOOD BOAT)" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 3, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "wood_wheel",
            output: { name: "WOOD_WHEEL", icon: "🛞", count: 1, label: "ล้อไม้ (WOODEN WHEEL) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 4, label: "ท่อนไม้ (LOG)" },
              { name: "IRON_ORE", icon: "🟥", count: 5, label: "แร่เหล็ก (IRON ORE)" }
            ]
          },
          {
            id: "electric_engine",
            output: { name: "ELECTRIC_ENGINE", icon: "🔋", count: 1, label: "เครื่องยนต์ไฟฟ้า (ELECTRIC ENGINE) x1" },
            ingredients: [
              { name: "IRON_ORE", icon: "🟥", count: 10, label: "แร่เหล็ก (IRON ORE)" }
            ]
          },
          {
            id: "boat_wing",
            output: { name: "BOAT_WING", icon: "🪽", count: 1, label: "ปีกเรือ (BOAT WING) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 4, label: "ท่อนไม้ (LOG)" },
              { name: "BRANCH", icon: "🌿", count: 6, label: "กิ่งไม้ (BRANCH)" }
            ]
          },
          {
            id: "glow_battery",
            output: { name: "GLOW_BATTERY", icon: "🔋", count: 1, label: "หินเรืองแสงอัดแท่ง(แบต) (GLOWING BATTERY ROD) x1" },
            ingredients: [
              { name: "GLOW_ORE", icon: "✨", count: 1, label: "แร่หินเรืองแสง (GLOWING ORE)" }
            ]
          },
          {
            id: "stone_floor", output: { name: "STONE_FLOOR", icon: "🪨", count: 1, label: "พื้นหิน (STONE FLOOR) x1" }, ingredients: [ { name: "BIG_ROCK", icon: "🪨", count: 10, label: "หินใหญ่ (BIG ROCK)" } ]
          },
          {
            id: "wood_floor",
            output: { name: "WOOD_FLOOR", icon: "🪵", count: 4, label: "พื้นไม้ (WOOD FLOOR) x4" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "wood_stairs",
            output: { name: "WOOD_STAIRS", icon: "🪜", count: 2, label: "บันไดไม้ (WOOD STAIRS) x2" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "folding_ladder",
            output: { name: "FOLDING_LADDER", icon: "🪜", count: 2, label: "บันไดพับ (FOLDING LADDER) x2" },
            ingredients: [
              { name: "IRON_ORE", icon: "🟥", count: 1, label: "แร่เหล็ก (IRON ORE)" }
            ]
          },
          {
            id: "wood_wall",
            output: { name: "WOOD_WALL", icon: "🧱", count: 3, label: "กำแพงไม้ (WOOD WALL) x3" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "wood_window",
            output: { name: "WOOD_WINDOW", icon: "🪟", count: 3, label: "หน้าต่างไม้ (WOOD WINDOW) x3" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "thin_wood_floor",
            output: { name: "THIN_WOOD_FLOOR", icon: "🪵", count: 3, label: "พื้นบาง (THIN WOOD FLOOR) x3" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "wood_door",
            output: { name: "WOOD_DOOR", icon: "🚪", count: 1, label: "ประตูไม้ (WOOD DOOR) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "wood_roof",
            output: { name: "WOOD_ROOF", icon: "🛖", count: 3, label: "หลังคาไม้ (WOOD ROOF) x3" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "arrow",
            output: { name: "ARROW", icon: "🏹", count: 30, label: "ลูกธนู (ARROW) x30" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" },
              { name: "BIG_ROCK", icon: "🪨", count: 1, label: "หินใหญ่ (BIG ROCK)" }
            ]
          },
          {
            id: "iron_bullet",
            output: { name: "IRON_BULLET", icon: "⚪", count: 5, label: "กระสุนเหล็ก ทรงกลม (SPHERICAL IRON BULLET) x5" },
            ingredients: [
              { name: "IRON_ORE", icon: "🟥", count: 1, label: "แร่เหล็ก (IRON ORE)" }
            ]
          },
          {
            id: "wooden_arm_cannon",
            output: { name: "WOODEN_ARM_CANNON", icon: "🪵🦾", count: 1, label: "ปืนไม้ติดแขน (ARM CANNON) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 2, label: "ท่อนไม้ (LOG)" },
              { name: "BIG_ROCK", icon: "🪨", count: 1, label: "หินใหญ่ (BIG ROCK)" }
            ]
          },
          {
            id: "robot_stand",
            output: { name: "ROBOT_STAND", icon: "🏗️", count: 1, label: "ฐานตั้งหุ่นยนต์ (ROBOT STAND) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 3, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "robot_cockpit",
            output: { name: "ROBOT_COCKPIT", icon: "🤖", count: 1, label: "ห้องนักบินหุ่นยนต์ (COCKPIT) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 10, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "robot_left_arm",
            output: { name: "ROBOT_LEFT_ARM", icon: "🦾", count: 1, label: "แขนซ้ายหุ่นยนต์ (LEFT ARM) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 10, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "robot_right_arm",
            output: { name: "ROBOT_RIGHT_ARM", icon: "🦾", count: 1, label: "แขนขวาหุ่นยนต์ (RIGHT ARM) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 10, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "robot_left_leg",
            output: { name: "ROBOT_LEFT_LEG", icon: "🦿", count: 1, label: "ขาซ้ายหุ่นยนต์ (LEFT LEG) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 10, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "robot_right_leg",
            output: { name: "ROBOT_RIGHT_LEG", icon: "🦿", count: 1, label: "ขาขวาหุ่นยนต์ (RIGHT LEG) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 10, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "obsidian_pad_warp",
            output: { name: "OBSIDIAN_PAD_WARP", icon: "🧭", count: 1, label: "แท่นวาร์ปออบซิเดียน (OBSIDIAN PAD Warp) x1" },
            ingredients: [
              { name: "OBSIDIAN_CUBE", icon: "🔶", count: 1, label: "ศิลาออบซิเดียน (OBSIDIAN CUBE)" },
              { name: "GLOW_ORE", icon: "✨", count: 1, label: "แร่หินเรืองแสง (GLOWING ORE)" }
            ]
          },
          {
            id: "obsidian_flux",
            output: { name: "OBSIDIAN_FLUX", icon: "⚫", count: 5, label: "ออบซิเดียนฟลักซ์ (Obsidian Flux) x5" },
            ingredients: [
              { name: "OBSIDIAN_CUBE", icon: "🔶", count: 1, label: "ศิลาออบซิเดียน (OBSIDIAN CUBE)" },
              { name: "GLOW_ORE", icon: "✨", count: 1, label: "แร่หินเรืองแสง (GLOWING ORE)" }
            ]
          },
          {
            id: "tanto",
            output: { name: "TANTO", icon: "🗡️", count: 1, label: "มีดตันโตะ (TANTO) x1" },
            ingredients: [
              { name: "OBSIDIAN_CUBE", icon: "🔶", count: 1, label: "ศิลาออบซิเดียน (OBSIDIAN CUBE)" },
              { name: "GLOW_ORE", icon: "✨", count: 1, label: "แร่หินเรืองแสง (GLOWING ORE)" },
              { name: "IRON_ORE", icon: "🟥", count: 1, label: "แร่เหล็ก (IRON ORE)" }
            ]
          },
          {
            id: "aegis_shift",
            output: { name: "AEGIS_SHIFT", icon: "⛏️⚔️", count: 1, label: "อีเตอร์ดาบใหญ่ (Aegis-Shift) x1" },
            ingredients: [
              { name: "OBSIDIAN_CUBE", icon: "🔶", count: 3, label: "ศิลาออบซิเดียน (OBSIDIAN CUBE)" },
              { name: "IRON_ORE", icon: "🟥", count: 3, label: "แร่เหล็ก (IRON ORE)" },
              { name: "GLOW_ORE", icon: "✨", count: 3, label: "แร่หินเรืองแสง (GLOWING ORE)" }
            ]
          }
        ];

        if (!document.getElementById("craftingCardPreviewStyles")) {
          const st = document.createElement("style");
          st.id = "craftingCardPreviewStyles";
          st.textContent = `
            .crafting-recipe-card {
              cursor: pointer;
              transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
            }
            .crafting-recipe-card.crafting-card-selected,
            .crafting-recipe-card.touch-preview-active,
            .crafting-recipe-card.gamepad-focused {
              border-color: #dfb76c !important;
              background: rgba(223, 183, 108, 0.08) !important;
              box-shadow: 0 0 14px rgba(223, 183, 108, 0.35) !important;
            }
          `;
          document.head.appendChild(st);
        }

        CRAFTING_RECIPES.forEach((recipe, recipeIdx) => {
          const card = document.createElement("div");
          card.className = "crafting-recipe-card";
          card.dataset.recipeId = recipe.id;
          card.dataset.recipeIndex = String(recipeIdx);
          card.style.background = "rgba(255, 255, 255, 0.03)";
          card.style.border = "1px solid rgba(255, 255, 255, 0.08)";
          card.style.borderRadius = "0px";
          card.style.padding = "12px";
          card.style.display = "flex";
          card.style.flexDirection = "column";
          card.style.gap = "8px";

          // Header: Item to craft
          const cardHeader = document.createElement("div");
          cardHeader.style.display = "flex";
          cardHeader.style.alignItems = "center";
          cardHeader.style.justifyContent = "space-between";

          const itemInfo = document.createElement("div");
          itemInfo.style.display = "flex";
          itemInfo.style.alignItems = "center";
          itemInfo.style.gap = "8px";

          const itemIcon = document.createElement("span");
          itemIcon.style.fontSize = "24px";
          itemIcon.style.display = "inline-flex";
          itemIcon.style.alignItems = "center";
          itemIcon.style.justifyContent = "center";
          // Only the main output icon uses interactivePreview: true so it can rotate continuously!
          const canvas3D = create3DIconCanvas(recipe.output, 40, 40, { interactivePreview: true });
          if (canvas3D) {
            itemIcon.appendChild(canvas3D);
            card._mainIconCanvas = canvas3D;
          } else {
            itemIcon.textContent = recipe.output.icon;
          }

          // Click (Mouse) & Tap (Touchscreen) support: clicking or tapping a crafting card selects it and activates its 3D main icon rotation preview
          const selectCardForPreview = () => {
            window._selectedCraftingCard = card;
            window._selectedCraftingRecipeId = recipe.id;
            window._activeTouchCraftingCard = card;
            window._activeTouchRecipeId = recipe.id;

            const allCards = craftingList.querySelectorAll(".crafting-recipe-card");
            allCards.forEach(c => {
              if (c === card) {
                c.classList.add("crafting-card-selected");
                c.classList.add("touch-preview-active");
              } else {
                c.classList.remove("crafting-card-selected");
                c.classList.remove("touch-preview-active");
                c.classList.remove("gamepad-focused");
              }
            });

            // Sync with GamepadController index so gamepad focus doesn't stay stuck on a different card
            if (window.GamepadController && window.GamepadController.uiNav) {
              window.GamepadController.uiNav.area = "cards";
              window.GamepadController.uiNav.index = recipeIdx;
              if (window.isUsingGamepad) {
                card.classList.add("gamepad-focused");
              }
            }

            if (typeof window.startCraftingPreviewLoop === "function") {
              window.startCraftingPreviewLoop();
            }
          };

          card.addEventListener("mousedown", selectCardForPreview);
          card.addEventListener("click", selectCardForPreview);
          card.addEventListener("touchstart", selectCardForPreview, { passive: true });
          card.addEventListener("pointerdown", selectCardForPreview, { passive: true });

          if (window._selectedCraftingRecipeId === recipe.id || window._activeTouchRecipeId === recipe.id) {
            window._selectedCraftingCard = card;
            window._activeTouchCraftingCard = card;
            card.classList.add("crafting-card-selected");
            card.classList.add("touch-preview-active");
          }

          const itemName = document.createElement("span");
          itemName.style.fontFamily = "'Google Sans', sans-serif";
          itemName.style.fontWeight = "bold";
          itemName.style.fontSize = "14px";
          itemName.style.color = "#dfb76c";
          const outName = typeof getItemDisplayName === "function" ? getItemDisplayName(recipe.output.name) : recipe.output.name;
          const outNameStr = outName + (recipe.output.count > 1 ? ` x${recipe.output.count}` : "");
          if (typeof window.setElementTextOrHTML === "function") {
            window.setElementTextOrHTML(itemName, outNameStr);
          } else {
            itemName.textContent = outNameStr;
          }

          itemInfo.appendChild(itemIcon);
          itemInfo.appendChild(itemName);

          cardHeader.appendChild(itemInfo);

          // Ingredients list
          const ingContainer = document.createElement("div");
          ingContainer.style.display = "flex";
          ingContainer.style.flexDirection = "column";
          ingContainer.style.gap = "4px";
          ingContainer.style.background = "rgba(0, 0, 0, 0.2)";
          ingContainer.style.padding = "6px 10px";
          ingContainer.style.borderRadius = "0px";

          let canCraft = true;

          recipe.ingredients.forEach(ing => {
            const currentCount = getItemCount(ing.name);
            const isEnough = currentCount >= ing.count;
            if (!isEnough) {
              canCraft = false;
            }

            const ingLine = document.createElement("div");
            ingLine.style.display = "flex";
            ingLine.style.justifyContent = "space-between";
            ingLine.style.alignItems = "center";
            ingLine.style.fontSize = "12px";
            ingLine.style.fontFamily = "'Google Sans', sans-serif";

            const ingLeft = document.createElement("span");
            ingLeft.style.display = "flex";
            ingLeft.style.alignItems = "center";
            ingLeft.style.gap = "6px";
            const ingIconSpan = document.createElement("span");
            ingIconSpan.style.display = "inline-flex";
            ingIconSpan.style.alignItems = "center";
            ingIconSpan.style.justifyContent = "center";
            const canvas3D = create3DIconCanvas(ing, 22, 22);
            if (canvas3D) {
              ingIconSpan.appendChild(canvas3D);
            } else {
              ingIconSpan.textContent = ing.icon;
            }
            
            const ingLabelSpan = document.createElement("span");
            const ingDispName = typeof getItemDisplayName === "function" ? getItemDisplayName(ing.name) : (ing.label || ing.name);
            if (typeof window.setElementTextOrHTML === "function") {
              window.setElementTextOrHTML(ingLabelSpan, ingDispName);
            } else {
              ingLabelSpan.textContent = ingDispName;
            }
            
            ingLeft.innerHTML = "";
            ingLeft.appendChild(ingIconSpan);
            ingLeft.appendChild(ingLabelSpan);

            const ingRight = document.createElement("span");
            ingRight.style.color = isEnough ? "#34d399" : "#f87171";
            ingRight.textContent = `${currentCount} / ${ing.count}`;

            ingLine.appendChild(ingLeft);
            ingLine.appendChild(ingRight);
            ingContainer.appendChild(ingLine);
          });

          card.appendChild(cardHeader);
          card.appendChild(ingContainer);

          // Craft button
          const btn = document.createElement("button");
          btn.style.width = "100%";
          btn.style.padding = "8px 0";
          btn.style.fontFamily = "'Google Sans', sans-serif";
          btn.style.fontWeight = "bold";
          btn.style.fontSize = "12px";
          btn.style.cursor = canCraft ? "pointer" : "not-allowed";
          btn.style.transition = "all 0.2s";
          btn.style.clipPath = "polygon(0% 0%, 96% 0%, 100% 8px, 100% 100%, 4% 100%, 0% calc(100% - 8px))";
          

          if (canCraft) {
            btn.style.background = "rgba(223, 183, 108, 0.15)";
            btn.style.border = "1px solid #dfb76c";
            btn.style.color = "#dfb76c";
            btn.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";
            const craftLabel = typeof t === "function" ? t("craft_btn") : "คราฟไอเทม (Craft)";
            btn.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                  <path d="m15 12-8.5 8.5a2.1 2.1 0 1 1-3-3L12 9" />
                  <path d="M17.64 15 22 10.64a2.41 2.41 0 0 0 0-3.41L16.77 2.3a2.41 2.41 0 0 0-3.41 0L9 6.64" />
                  <path d="m20 8-5 5" />
                </svg>
                <span>${craftLabel}</span>
              </div>
            `;
            
            btn.onmouseenter = () => {
              btn.style.background = "rgba(223, 183, 108, 0.3)";
              btn.style.boxShadow = "0 0 12px rgba(223, 183, 108, 0.15)";
            };
            btn.onmouseleave = () => {
              btn.style.background = "rgba(223, 183, 108, 0.15)";
              btn.style.boxShadow = "none";
            };
            
            btn.onclick = () => {
              selectCardForPreview();
              craftItem(recipe.id);
            };
          } else {
            btn.style.background = "rgba(255, 255, 255, 0.05)";
            btn.style.border = "1px solid rgba(255, 255, 255, 0.15)";
            btn.style.color = "rgba(255, 255, 255, 0.3)";
            btn.style.textShadow = "none";
            const insufficientLabel = typeof t === "function" ? t("insufficient_materials") : "วัตถุดิบไม่เพียงพอ (Insufficient Materials)";
            if (typeof window.setElementTextOrHTML === "function") {
              window.setElementTextOrHTML(btn, insufficientLabel);
            } else {
              btn.textContent = insufficientLabel;
            }
            btn.disabled = true;
          }

          card.appendChild(btn);
          craftingList.appendChild(card);
        });
        if (typeof window.startCraftingPreviewLoop === "function") {
          window.startCraftingPreviewLoop();
        }
        if (typeof updateCustomScrollbar === "function") setTimeout(updateCustomScrollbar, 30);
      }
      window.renderCrafting = renderCrafting;

      // Continuous 3D main icon preview rotation loop for Crafting Tab (Mouse click, Touchscreen tap, and Gamepad focus)
      (function setupCraftingMainIconPreviewLoop() {
        let isLoopRunning = false;
        let lastFrameTime = 0;
        // Moderately slow right-to-left rotation speed (~1.35 rad/sec, ~4.6s per full 360° turn)
        const ROTATE_SPEED_RAD_PER_SEC = 1.35;

        function isCraftingVisible() {
          const craftingList = document.getElementById("craftingList");
          if (!craftingList || craftingList.style.display === "none") return false;
          const invOverlay = document.getElementById("inventoryOverlay");
          const craftOverlay = document.getElementById("craftingOverlay");
          const isOpen = (invOverlay && invOverlay.classList.contains("open")) || (craftOverlay && craftOverlay.classList.contains("open"));
          return !!isOpen;
        }

        function tick(now) {
          if (!isCraftingVisible()) {
            isLoopRunning = false;
            return;
          }

          const dt = lastFrameTime ? Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000)) : 0.016;
          lastFrameTime = now;

          const craftingList = document.getElementById("craftingList");
          if (craftingList) {
            const cards = craftingList.querySelectorAll(".crafting-recipe-card");
            const isGamepadMode = !!(window.isUsingGamepad || window.isGamepadUINavActive);
            const hasAnyGamepadFocusedCard = !!craftingList.querySelector(".crafting-recipe-card.gamepad-focused");
            const hasAnySelectedCard = !!craftingList.querySelector(".crafting-recipe-card.crafting-card-selected, .crafting-recipe-card.touch-preview-active");

            for (let i = 0; i < cards.length; i++) {
              const card = cards[i];
              const canvas = card._mainIconCanvas;
              if (!canvas || typeof canvas._drawAtAngle !== "function") continue;

              const isClickOrTouchSelected = (
                window._selectedCraftingCard === card ||
                window._activeTouchCraftingCard === card ||
                card.classList.contains("crafting-card-selected") ||
                card.classList.contains("touch-preview-active")
              );
              const isGamepadActive = card.classList.contains("gamepad-focused") || (isGamepadMode && !hasAnyGamepadFocusedCard && !hasAnySelectedCard && i === 0);

              if (isClickOrTouchSelected || isGamepadActive) {
                // Rotate from right to left (decreasing ry moves the front surface from right to left)
                const baseAngle = typeof canvas._defaultAngle === "number" ? canvas._defaultAngle : 2.45;
                canvas._previewAngle = (typeof canvas._previewAngle === "number" ? canvas._previewAngle : baseAngle) - ROTATE_SPEED_RAD_PER_SEC * dt;
                canvas._drawAtAngle(canvas._previewAngle);
                canvas._wasRotating = true;
              } else if (canvas._wasRotating) {
                // Smoothly reset back to default static preview angle when no longer selected/focused
                canvas._previewAngle = typeof canvas._defaultAngle === "number" ? canvas._defaultAngle : 2.45;
                canvas._drawAtAngle(canvas._previewAngle);
                canvas._wasRotating = false;
              }
            }
          }

          requestAnimationFrame(tick);
        }

        window.startCraftingPreviewLoop = function() {
          if (isLoopRunning) return;
          isLoopRunning = true;
          lastFrameTime = performance.now();
          requestAnimationFrame(tick);
        };
      })();

      function craftItem(recipeId) {
        const CRAFTING_RECIPES = [
          {
            id: "axe",
            output: { name: "AXE", icon: "🪓" },
            ingredients: [
              { name: "ROCK", count: 1 },
              { name: "BRANCH", count: 3 }
            ]
          },
          {
            id: "wood_chest",
            output: { name: "WOOD_CHEST", icon: "📦", count: 1 },
            ingredients: [
              { name: "LOG", count: 2 }
            ]
          },
          {
            id: "wood_bed",
            output: { name: "WOOD_BED", icon: "🛏️", count: 1 },
            ingredients: [
              { name: "COTTON_PLANT", count: 50 },
              { name: "LOG", count: 3 }
            ]
          },
          {
            id: "cloth",
            output: { name: "CLOTH", icon: "⬜", count: 10 },
            ingredients: [
              { name: "COTTON_PLANT", count: 50 },
              { name: "GRASS", count: 50 }
            ]
          },
          {
            id: "rubber_block",
            output: { name: "RUBBER_BLOCK", icon: "⬛", count: 1 },
            ingredients: [
              { name: "CROWN_FLOWER", count: 10 }
            ]
          },
          {
            id: "traveler_boots",
            output: { name: "TRAVELER_BOOTS", icon: "🥾", count: 1 },
            ingredients: [
              { name: "LEATHER", count: 1 },
              { name: "RUBBER_BLOCK", count: 1 }
            ]
          },
          {
            id: "oxford_shoes",
            output: { name: "OXFORD_SHOES", icon: "👞", count: 1 },
            ingredients: [
              { name: "LEATHER", count: 1 },
              { name: "RUBBER_BLOCK", count: 1 }
            ]
          },
          {
            id: "dress_boots",
            output: { name: "DRESS_BOOTS", icon: "🥾", count: 1 },
            ingredients: [
              { name: "LEATHER", count: 1 },
              { name: "RUBBER_BLOCK", count: 1 }
            ]
          },
          {
            id: "white_shirt_short",
            output: { name: "WHITE_SHIRT_SHORT", icon: "👔", count: 1 },
            ingredients: [
              { name: "CLOTH", count: 3 }
            ]
          },
          {
            id: "black_pleated_skirt",
            output: { name: "BLACK_PLEATED_SKIRT", icon: "👗", count: 1 },
            ingredients: [
              { name: "CLOTH", count: 2 }
            ]
          },
          {
            id: "black_leggings",
            output: { name: "BLACK_LEGGINGS", icon: "👖", count: 1 },
            ingredients: [
              { name: "CLOTH", count: 3 }
            ]
          },
          {
            id: "double_breasted_suit",
            output: { name: "DOUBLE_BREASTED_SUIT", icon: "🧥", count: 1 },
            ingredients: [
              { name: "CLOTH", count: 5 }
            ]
          },
          {
            id: "black_slacks",
            output: { name: "BLACK_SLACKS", icon: "👖", count: 1 },
            ingredients: [
              { name: "CLOTH", count: 3 }
            ]
          },
          {
            id: "opera_cape",
            output: { name: "OPERA_CAPE", icon: "🧛", count: 1 },
            ingredients: [
              { name: "CLOTH", count: 2 }
            ]
          },
          {
            id: "wood_table",
            output: { name: "WOOD_TABLE", icon: "🪑", count: 1 },
            ingredients: [
              { name: "LOG", count: 1 }
            ]
          },
          {
            id: "wood_planter_box",
            output: { name: "WOOD_PLANTER_BOX", icon: "🪴", count: 1 },
            ingredients: [
              { name: "LOG", count: 1 },
              { name: "DIRT", count: 1 }
            ]
          },
          {
            id: "wood_chair",
            output: { name: "WOOD_CHAIR", icon: "🪑", count: 1 },
            ingredients: [
              { name: "LOG", count: 1 }
            ]
          },
          {
            id: "lantern",
            output: { name: "LANTERN", icon: "🏮", count: 1 },
            ingredients: [
              { name: "GLOW_ORE", count: 1 },
              { name: "IRON_ORE", count: 1 }
            ]
          },
          {
            id: "pickaxe",
            output: { name: "PICKAXE", icon: "⛏️", count: 1 },
            ingredients: [
              { name: "ROCK", count: 2 },
              { name: "BRANCH", count: 3 }
            ]
          },
          {
            id: "campfire",
            output: { name: "CAMPFIRE", icon: "🔥", count: 1 },
            ingredients: [
              { name: "BRANCH", count: 5 },
              { name: "ROCK", count: 5 }
            ]
          },
          {
            id: "wood_boat",
            output: { name: "WOOD_BOAT", icon: "🛶", count: 1 },
            ingredients: [
              { name: "LOG", count: 3 }
            ]
          },
          {
            id: "wood_wheel",
            output: { name: "WOOD_WHEEL", icon: "🛞", count: 1 },
            ingredients: [
              { name: "LOG", count: 4 },
              { name: "IRON_ORE", count: 5 }
            ]
          },
          {
            id: "electric_engine",
            output: { name: "ELECTRIC_ENGINE", icon: "🔋", count: 1 },
            ingredients: [
              { name: "IRON_ORE", count: 10 }
            ]
          },
          {
            id: "boat_wing",
            output: { name: "BOAT_WING", icon: "🪽", count: 1 },
            ingredients: [
              { name: "LOG", count: 4 },
              { name: "BRANCH", count: 6 }
            ]
          },
          {
            id: "glow_battery",
            output: { name: "GLOW_BATTERY", icon: "🔋", count: 1 },
            ingredients: [
              { name: "GLOW_ORE", count: 1 }
            ]
          },
          {
            id: "stone_floor", output: { name: "STONE_FLOOR", icon: "🪨", count: 1 }, ingredients: [ { name: "BIG_ROCK", count: 10 } ]
          },
          {
            id: "wood_floor",
            output: { name: "WOOD_FLOOR", icon: "🪵", count: 4 },
            ingredients: [
              { name: "LOG", count: 1 }
            ]
          },
          {
            id: "wood_stairs",
            output: { name: "WOOD_STAIRS", icon: "🪜", count: 2 },
            ingredients: [
              { name: "LOG", count: 1 }
            ]
          },
          {
            id: "folding_ladder",
            output: { name: "FOLDING_LADDER", icon: "🪜", count: 2 },
            ingredients: [
              { name: "IRON_ORE", count: 1 }
            ]
          },
          {
            id: "wood_wall",
            output: { name: "WOOD_WALL", icon: "🧱", count: 3 },
            ingredients: [
              { name: "LOG", count: 1 }
            ]
          },
          {
            id: "wood_window",
            output: { name: "WOOD_WINDOW", icon: "🪟", count: 3 },
            ingredients: [
              { name: "LOG", count: 1 }
            ]
          },
          {
            id: "thin_wood_floor",
            output: { name: "THIN_WOOD_FLOOR", icon: "🪵", count: 3 },
            ingredients: [
              { name: "LOG", count: 1 }
            ]
          },
          {
            id: "wood_door",
            output: { name: "WOOD_DOOR", icon: "🚪", count: 1 },
            ingredients: [
              { name: "LOG", count: 1 }
            ]
          },
          {
            id: "wood_roof",
            output: { name: "WOOD_ROOF", icon: "🛖", count: 3 },
            ingredients: [
              { name: "LOG", count: 1 }
            ]
          },
          {
            id: "arrow",
            output: { name: "ARROW", icon: "🏹", count: 30 },
            ingredients: [
              { name: "LOG", count: 1 },
              { name: "BIG_ROCK", count: 1 }
            ]
          },
          {
            id: "iron_bullet",
            output: { name: "IRON_BULLET", icon: "⚪", count: 5 },
            ingredients: [
              { name: "IRON_ORE", count: 1 }
            ]
          },
          {
            id: "wooden_arm_cannon",
            output: { name: "WOODEN_ARM_CANNON", icon: "🪵🦾", count: 1 },
            ingredients: [
              { name: "LOG", count: 2 },
              { name: "BIG_ROCK", count: 1 }
            ]
          },
          {
            id: "shovel",
            output: { name: "SHOVEL", icon: "🥄", count: 1 },
            ingredients: [
              { name: "LOG", count: 1 },
              { name: "BIG_ROCK", count: 1 }
            ]
          },
          {
            id: "iron_bucket",
            output: { name: "IRON_BUCKET", icon: "🪣", count: 1 },
            ingredients: [
              { name: "IRON_ORE", count: 1 }
            ]
          },
          {
            id: "robot_stand",
            output: { name: "ROBOT_STAND", icon: "🏗️", count: 1 },
            ingredients: [
              { name: "LOG", count: 3 }
            ]
          },
          {
            id: "robot_cockpit",
            output: { name: "ROBOT_COCKPIT", icon: "🤖", count: 1 },
            ingredients: [
              { name: "LOG", count: 10 }
            ]
          },
          {
            id: "robot_left_arm",
            output: { name: "ROBOT_LEFT_ARM", icon: "🦾", count: 1 },
            ingredients: [
              { name: "LOG", count: 10 }
            ]
          },
          {
            id: "robot_right_arm",
            output: { name: "ROBOT_RIGHT_ARM", icon: "🦾", count: 1 },
            ingredients: [
              { name: "LOG", count: 10 }
            ]
          },
          {
            id: "robot_left_leg",
            output: { name: "ROBOT_LEFT_LEG", icon: "🦿", count: 1 },
            ingredients: [
              { name: "LOG", count: 10 }
            ]
          },
          {
            id: "robot_right_leg",
            output: { name: "ROBOT_RIGHT_LEG", icon: "🦿", count: 1 },
            ingredients: [
              { name: "LOG", count: 10 }
            ]
          },
          {
            id: "obsidian_pad_warp",
            output: { name: "OBSIDIAN_PAD_WARP", icon: "🧭", count: 1 },
            ingredients: [
              { name: "OBSIDIAN_CUBE", count: 1 },
              { name: "GLOW_ORE", count: 1 }
            ]
          },
          {
            id: "obsidian_flux",
            output: { name: "OBSIDIAN_FLUX", icon: "⚫", count: 5 },
            ingredients: [
              { name: "OBSIDIAN_CUBE", count: 1 },
              { name: "GLOW_ORE", count: 1 }
            ]
          },
          {
            id: "tanto",
            output: { name: "TANTO", icon: "🗡️", count: 1 },
            ingredients: [
              { name: "OBSIDIAN_CUBE", count: 1 },
              { name: "GLOW_ORE", count: 1 },
              { name: "IRON_ORE", count: 1 }
            ]
          },
          {
            id: "aegis_shift",
            output: { name: "AEGIS_SHIFT", icon: "⛏️⚔️", count: 1 },
            ingredients: [
              { name: "OBSIDIAN_CUBE", count: 3 },
              { name: "IRON_ORE", count: 3 },
              { name: "GLOW_ORE", count: 3 }
            ]
          }
        ];

        const recipe = CRAFTING_RECIPES.find(r => r.id === recipeId);
        if (!recipe) return;
        
        // Double check ingredients
        let canCraft = true;
        for (let ing of recipe.ingredients) {
          if (getItemCount(ing.name) < ing.count) {
            canCraft = false;
            break;
          }
        }
        
        if (!canCraft) return;
        
        // Consume ingredients
        for (let ing of recipe.ingredients) {
          consumeItem(ing.name, ing.count);
        }
        
        // Add output item
        const outputCount = recipe.output.count || 1;
        addItemToInventory({
          name: recipe.output.name,
          label: recipe.output.name,
          icon: recipe.output.icon,
          count: outputCount
        });
        
        // Refresh UI
        renderInventory();
        renderActionSlots();
        renderCrafting();
        updateBadge();
        saveSettingsToLocalStorage();
        
        // Play sound
        if (typeof playCollectSound === "function") {
          playCollectSound();
        }
        
        // Notice
        const outDispName = typeof getItemDisplayName === "function" ? getItemDisplayName(recipe.output.name) : recipe.output.name;
        const craftSuccessText = typeof t === "function" ? t("craft_success") : "คราฟไอเทมสำเร็จ";
        showNotice(`🔨 ${craftSuccessText}: ${recipe.output.icon} ${outDispName} x${outputCount}`);
      }

      function toggleCrafting() {
        const overlay = document.getElementById("craftingOverlay");
        const isCurrentlyOpen = overlay.classList.contains("open");

        // Close inventory if open
        const invOverlay = document.getElementById("inventoryOverlay");
        if (invOverlay && invOverlay.classList.contains("open")) {
          invOverlay.classList.remove("open");
        }

        if (isCurrentlyOpen) {
          overlay.classList.remove("open");
          if (gameStarted) {
            requestPointerLockSafe();
            }
          } else {
          overlay.classList.add("open");
          renderCrafting();

        }
      }

            function handleSplitItem(source, index) {
        let item = null;
        let sourceArray = null;
        if (source === "inventory") {
          item = inventory[index];
          sourceArray = inventory;
        } else if (source === "action") {
          item = actionSlotsItems[index];
          sourceArray = actionSlotsItems;
        } else if (source === "equip") {
          item = equipSlotsItems[index];
          sourceArray = inventory;
        } else if (source === "chest") {
          if (!currentOpenChest) return;
          item = currentOpenChest.storage[index];
          sourceArray = currentOpenChest.storage;
        } else if (source === "chestPlayerInventory") {
          item = inventory[index];
          sourceArray = inventory;
        }

        if (!item || item.count <= 1) return;
        
        const splitAmount = Math.floor(item.count / 2);
        if (splitAmount <= 0) return;

        let targetArray = sourceArray;
        let limit = targetArray.length;
        if (source === "inventory" || source === "chestPlayerInventory") limit = UNLOCKED_SLOTS;

        const emptyIndex = targetArray.findIndex((i, idx) => idx < limit && i === null);
        if (emptyIndex !== -1) {
          targetArray[emptyIndex] = { ...item, count: splitAmount };
          item.count -= splitAmount;
          
          if (source === "chest" || source === "chestPlayerInventory") {
            renderChest();
            renderInventory();
            renderActionSlots();
          } else {
            renderInventory();
            renderActionSlots();
          }
          updateBadge();
          saveSettingsToLocalStorage();
        } else {
          showNotice(source === "chest" ? "กล่องเต็มแล้ว! (Chest Full)" : "กระเป๋าเต็มแล้ว! (Inventory Full)");
        }
      }

      let trashPendingData = null; // { source, index, item }
      let trashHoldTimer = null;
      let trashHoldProgress = 0;
      let trashHoldInterval = null;

      function openTrashConfirm(source, index, item) {
        window.isConfirmOverlayOpen = true; if (window.clearKeysPressed) window.clearKeysPressed();
        trashPendingData = { source, index, item };
        const rawName = item.name || item.label || "ITEM";
        const displayName = typeof getItemDisplayName === "function" ? getItemDisplayName(rawName) : rawName;
        document.getElementById("trashConfirmText").textContent = displayName + (item.count > 1 ? " x" + item.count : "");
        const iconEl = document.getElementById("trashConfirmIcon");
        if (iconEl) {
          iconEl.innerHTML = "";
          let canvas3D = null;
          if (typeof create3DIconCanvas === "function") {
            canvas3D = create3DIconCanvas(item, 56, 56);
          }
          if (canvas3D) {
            iconEl.appendChild(canvas3D);
          } else {
            iconEl.textContent = item.icon || "📦";
          }
        }
        
        const overlay = document.getElementById("trashConfirmOverlay");
        
        // Append strictly inside the active panel to keep it contained within the inventory / chest UI window
        const chestOverlay = document.getElementById("chestOverlay");
        let targetPanel = null;
        if (source === "chest" || source === "chestPlayerInventory" || (chestOverlay && chestOverlay.classList.contains("open"))) {
           targetPanel = document.querySelector("#chestOverlay .inventory-panel");
           if (targetPanel) targetPanel.style.overflow = "hidden";
        } else {
           targetPanel = document.querySelector("#inventoryOverlay .inventory-panel");
           if (targetPanel) targetPanel.style.overflow = "hidden";
        }

        if (targetPanel && overlay && overlay.parentElement !== targetPanel) {
           targetPanel.appendChild(overlay);
        }
        
        if (overlay) overlay.style.setProperty("display", "flex", "important");
        
        // Reset progress
        clearInterval(trashHoldInterval);
        trashHoldProgress = 0;
        const progressEl = document.getElementById("trashConfirmProgress");
        if (progressEl) {
          progressEl.style.transition = "none";
          progressEl.style.width = "0%";
        }

        // Setup Gamepad navigation to focus trashConfirmBtn
        if (window.GamepadController) {
          window.GamepadController.uiNav.area = "trashConfirm";
          window.GamepadController.uiNav.index = 1; // Default focus to HOLD TO DELETE button
          setTimeout(() => {
            if (window.GamepadController.applyUIFocus) window.GamepadController.applyUIFocus();
          }, 30);
        }
      }

      function closeTrashConfirm() {
        window.isConfirmOverlayOpen = false;
        trashPendingData = null;
        const iconEl = document.getElementById("trashConfirmIcon");
        if (iconEl) iconEl.innerHTML = "";
        document.getElementById("trashConfirmOverlay").style.setProperty("display", "none", "important");
        const chestPanel = document.querySelector("#chestOverlay .inventory-panel");
        if (chestPanel) chestPanel.style.overflow = "";
        const invPanel = document.querySelector("#inventoryOverlay .inventory-panel");
        if (invPanel) invPanel.style.overflow = "";
        clearInterval(trashHoldInterval);
        trashHoldProgress = 0;
        const progressEl = document.getElementById("trashConfirmProgress");
        if (progressEl) {
          progressEl.style.transition = "none";
          progressEl.style.width = "0%";
        }

        // Restore gamepad navigation back to bottom action buttons or grid
        if (window.GamepadController) {
          window.GamepadController.uiNav.area = "bottom";
          window.GamepadController.uiNav.index = 2; // back on Destroy button
          setTimeout(() => {
            if (window.GamepadController.applyUIFocus) window.GamepadController.applyUIFocus();
          }, 30);
        }
      }
      window.openTrashConfirm = openTrashConfirm;
      window.closeTrashConfirm = closeTrashConfirm;

      document.addEventListener("DOMContentLoaded", () => {
        document.getElementById("trashCancelBtn")?.addEventListener("click", closeTrashConfirm);

        const trashConfirmBtn = document.getElementById("trashConfirmBtn");
        const trashConfirmProgress = document.getElementById("trashConfirmProgress");

        function startTrashHold(e) {
          if (e) e.preventDefault();
          trashHoldProgress = 0;
          trashConfirmProgress.style.transition = "none";
          trashConfirmProgress.style.width = "0%";

          clearInterval(trashHoldInterval);
          trashHoldInterval = setInterval(() => {
            trashHoldProgress += 5;
            trashConfirmProgress.style.width = trashHoldProgress + "%";
            if (trashHoldProgress >= 100) {
              clearInterval(trashHoldInterval);
              executeTrash();
            }
          }, 30);
        }

        function cancelTrashHold(e) {
          clearInterval(trashHoldInterval);
          trashHoldProgress = 0;
          trashConfirmProgress.style.transition = "width 0.2s";
          trashConfirmProgress.style.width = "0%";
        }
        window.startTrashHold = startTrashHold;
        window.cancelTrashHold = cancelTrashHold;

        trashConfirmBtn?.addEventListener("mousedown", startTrashHold);
        trashConfirmBtn?.addEventListener("touchstart", startTrashHold, { passive: false });
        trashConfirmBtn?.addEventListener("contextmenu", (e) => e.preventDefault());
        trashConfirmBtn?.addEventListener("mouseup", cancelTrashHold);
        trashConfirmBtn?.addEventListener("mouseleave", cancelTrashHold);
        trashConfirmBtn?.addEventListener("touchend", cancelTrashHold);
        trashConfirmBtn?.addEventListener("touchcancel", cancelTrashHold);

        // Setup 3 Bottom Inventory Buttons (Action UI, Split, Destroy)
        const btnActionUI = document.getElementById("btnInventoryActionUI");
        const btnSplit = document.getElementById("btnInventorySplit");
        const btnDestroy = document.getElementById("btnInventoryDestroy");

        window.selectedInventorySlot = null; // { source, index, item }

        if (!document.getElementById("inventorySelectedSlotStyles")) {
          const st = document.createElement("style");
          st.id = "inventorySelectedSlotStyles";
          st.textContent = `
            .inventory-slot.item-selected, .action-slot.item-selected {
              border-color: #dfb76c !important;
              box-shadow: inset 0 0 0 2px #dfb76c, inset 0 0 12px rgba(223, 183, 108, 0.4) !important;
              background: rgba(223, 183, 108, 0.16) !important;
            }
          `;
          document.head.appendChild(st);
        }

        window.updateSelectedSlotVisuals = function() {
          document.querySelectorAll(".inventory-slot, .action-slot").forEach(el => {
            const s = el.dataset.source;
            const idx = parseInt(el.dataset.index, 10);
            if (window.selectedInventorySlot && window.selectedInventorySlot.source === s && window.selectedInventorySlot.index === idx) {
              el.classList.add("item-selected");
            } else {
              el.classList.remove("item-selected");
            }
          });
        };

        window.updateBottomButtonsState = function() {
          const selected = window.selectedInventorySlot;

          if (selected && selected.item) {
            const curItem = getSlotItem(selected.source, selected.index);
            if (!curItem) {
              window.selectedInventorySlot = null;
              window.updateSelectedSlotVisuals();
              window.updateBottomButtonsState();
              return;
            }
            selected.item = curItem;

            if (btnActionUI) {
              btnActionUI.style.opacity = "1";
              btnActionUI.style.cursor = "pointer";
              btnActionUI.style.boxShadow = "0 0 10px rgba(223, 183, 108, 0.35)";
            }
            if (btnSplit) {
              const canSplit = (curItem.count > 1);
              btnSplit.style.opacity = canSplit ? "1" : "0.45";
              btnSplit.style.cursor = canSplit ? "pointer" : "not-allowed";
              btnSplit.style.boxShadow = canSplit ? "0 0 10px rgba(56, 189, 248, 0.35)" : "none";
            }
            if (btnDestroy) {
              btnDestroy.style.opacity = "1";
              btnDestroy.style.cursor = "pointer";
              btnDestroy.style.boxShadow = "0 0 10px rgba(239, 68, 68, 0.35)";
            }
          } else {
            if (btnActionUI) {
              btnActionUI.style.opacity = "0.38";
              btnActionUI.style.cursor = "not-allowed";
              btnActionUI.style.boxShadow = "none";
            }
            if (btnSplit) {
              btnSplit.style.opacity = "0.38";
              btnSplit.style.cursor = "not-allowed";
              btnSplit.style.boxShadow = "none";
            }
            if (btnDestroy) {
              btnDestroy.style.opacity = "0.38";
              btnDestroy.style.cursor = "not-allowed";
              btnDestroy.style.boxShadow = "none";
            }
          }
        };

        // Initialize button states as disabled until item is selected
        window.updateBottomButtonsState();

        btnActionUI?.addEventListener("click", () => {
          if (!window.selectedInventorySlot || !window.selectedInventorySlot.item) {
            if (typeof showNotice === "function") {
              showNotice("⚠️ กรุณาคลิกเลือกไอเทมในกระเป๋าก่อนใช้งาน");
            }
            return;
          }
          const { source, index, item } = window.selectedInventorySlot;
          const equipIdx = getEquipSlotIndexForItem(item);
          if (equipIdx !== -1) {
            if (source === "equip") {
              // Unequip back to inventory
              let emptyInv = inventory.slice(0, UNLOCKED_SLOTS).findIndex(s => s === null);
              if (emptyInv === -1) {
                if (typeof showNotice === "function") showNotice("⚠️ กระเป๋าเต็ม ไม่สามารถถอดชุดได้");
                return;
              }
              setSlotItem("equip", index, null);
              setSlotItem("inventory", emptyInv, item);
              window.selectedInventorySlot = { source: "inventory", index: emptyInv, item: item };
            } else {
              // Equip directly into the matching character equipment slot
              const toItem = equipSlotsItems[equipIdx];
              setSlotItem(source, index, toItem);
              setSlotItem("equip", equipIdx, item);
              window.selectedInventorySlot = { source: "equip", index: equipIdx, item: item };
            }
            if (typeof renderChest === "function" && currentOpenChest) renderChest();
            renderInventory();
            renderActionSlots();
            if (typeof renderEquipSlots === "function") renderEquipSlots();
            updateBadge();
            saveSettingsToLocalStorage();
            if (typeof playCollectSound === "function") playCollectSound();
            return;
          }

          if (source === "action") {
            if (typeof showNotice === "function") {
              showNotice(`ℹ️ ไอเทมอยู่ในช่องแอคชั่น [ช่อง ${index + 1}] อยู่แล้ว`);
            }
          } else {
            let targetSlot = actionSlotsItems.findIndex(s => s === null);
            if (targetSlot === -1) targetSlot = (selectedActionSlotIndex !== -1 ? selectedActionSlotIndex : 0);
            
            const toItem = actionSlotsItems[targetSlot];
            setSlotItem(source, index, toItem);
            setSlotItem("action", targetSlot, item);
            selectedActionSlotIndex = targetSlot;

            window.selectedInventorySlot = { source: "action", index: targetSlot, item: item };

            if (typeof renderChest === "function" && currentOpenChest) renderChest();
            renderInventory();
            renderActionSlots();
            updateBadge();
            saveSettingsToLocalStorage();
            if (typeof playCollectSound === "function") playCollectSound();

            const dName = typeof getItemDisplayName === "function" ? getItemDisplayName(item.name || item.label) : (item.name || item.label);
            if (typeof showNotice === "function") {
              showNotice(`⚡ ย้าย ${item.icon || "📦"} ${dName} ไปยังช่องแอคชั่น [ช่อง ${targetSlot + 1}] แล้ว`);
            }
          }
        });

        btnSplit?.addEventListener("click", () => {
          if (!window.selectedInventorySlot || !window.selectedInventorySlot.item) {
            if (typeof showNotice === "function") {
              showNotice("⚠️ กรุณาคลิกเลือกไอเทมในกระเป๋าก่อนแบ่งจำนวน");
            }
            return;
          }
          const { source, index, item } = window.selectedInventorySlot;
          if ((item.count || 1) <= 1) {
            if (typeof showNotice === "function") {
              showNotice("❌ ไอเทมนี้มีเพียง 1 ชิ้น ไม่สามารถแบ่งได้");
            }
            return;
          }
          handleSplitItem(source, index);
          if (typeof playCollectSound === "function") playCollectSound();
          window.updateSelectedSlotVisuals();
          window.updateBottomButtonsState();
        });

        btnDestroy?.addEventListener("click", () => {
          if (!window.selectedInventorySlot || !window.selectedInventorySlot.item) {
            if (typeof showNotice === "function") {
              showNotice("⚠️ กรุณาคลิกเลือกไอเทมในกระเป๋าก่อนทำลาย");
            }
            return;
          }
          const { source, index, item } = window.selectedInventorySlot;
          openTrashConfirm(source, index, item);
        });

        if (btnDestroy) {
          btnDestroy.addEventListener("dragover", (e) => {
            e.preventDefault();
            btnDestroy.style.background = "rgba(239, 68, 68, 0.35)";
            btnDestroy.style.borderColor = "#ef4444";
          });
          btnDestroy.addEventListener("dragleave", () => {
            btnDestroy.style.background = "rgba(239, 68, 68, 0.12)";
            btnDestroy.style.borderColor = "rgba(239, 68, 68, 0.4)";
          });
          btnDestroy.addEventListener("drop", (e) => {
            btnDestroy.style.background = "rgba(239, 68, 68, 0.12)";
            btnDestroy.style.borderColor = "rgba(239, 68, 68, 0.4)";
            handleTrashDrop(e);
          });
        }
      });

      // ============================================
      // Custom Sci-Fi DOM Virtual Scrollbar Controller
      // ============================================
      function getActiveScrollableContainer() {
        const overlay = document.getElementById("inventoryOverlay");
        if (!overlay || !overlay.classList.contains("open")) return null;

        const activeTabName = typeof window.getActiveTab === "function" ? window.getActiveTab() : (typeof activeTab !== "undefined" ? activeTab : "inventory");

        if (activeTabName === "settings") {
          const el = document.getElementById("inventorySettings");
          if (el && el.style.display !== "none") return el;
        } else if (activeTabName === "crafting") {
          const el = document.getElementById("craftingList");
          if (el && el.style.display !== "none") return el;
        } else if (activeTabName === "cooking") {
          const el = document.getElementById("cookingList");
          if (el && el.style.display !== "none") return el;
        } else if (activeTabName === "itemsList" || activeTabName === "inventory") {
          const mainLayout = document.getElementById("inventoryMainLayout");
          if (mainLayout && mainLayout.style.display !== "none") return mainLayout;
          const grid = document.getElementById("inventoryGrid");
          if (grid && grid.style.display !== "none") return grid;
        }

        const candidates = [
          document.getElementById("inventorySettings"),
          document.getElementById("craftingList"),
          document.getElementById("cookingList"),
          document.getElementById("inventoryMainLayout"),
          document.getElementById("inventoryGrid")
        ];
        for (const el of candidates) {
          if (el && el.style.display !== "none" && window.getComputedStyle(el).display !== "none") {
            return el;
          }
        }
        return null;
      }

      function updateCustomScrollbar() {
        const saveSelect = document.getElementById("saveSelectOverlay");
        if (saveSelect && saveSelect.classList.contains("open")) {
          const track = document.getElementById("saveSelectCustomScrollbar");
          const thumb = document.getElementById("saveSelectCustomScrollbarThumb");
          const container = document.getElementById("saveSlotsList");
          if (!track || !thumb || !container) return;

          const scrollHeight = container.scrollHeight;
          const clientHeight = container.clientHeight;
          const scrollTop = container.scrollTop;

          if (scrollHeight <= clientHeight + 4) {
            track.style.display = "none";
            return;
          }

          track.style.display = "block";
          const trackHeight = track.clientHeight;
          if (trackHeight <= 0) return;

          const thumbHeight = Math.max(36, Math.min(trackHeight - 4, (clientHeight / scrollHeight) * trackHeight));
          thumb.style.height = `${thumbHeight}px`;

          const maxScroll = scrollHeight - clientHeight;
          const maxThumbTop = trackHeight - thumbHeight;
          const scrollRatio = maxScroll > 0 ? (scrollTop / maxScroll) : 0;
          const thumbTop = Math.max(0, Math.min(maxThumbTop, scrollRatio * maxThumbTop));

          thumb.style.transform = `translateY(${thumbTop}px)`;
          return;
        }

        const track = document.getElementById("panelCustomScrollbar");
        const thumb = document.getElementById("panelCustomScrollbarThumb");
        if (!track || !thumb) return;

        const container = getActiveScrollableContainer();
        if (!container) {
          track.style.display = "none";
          return;
        }

        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        const scrollTop = container.scrollTop;

        // Display scrollbar whenever content overflows client area
        if (scrollHeight <= clientHeight + 4) {
          track.style.display = "none";
          return;
        }

        track.style.display = "block";
        const trackHeight = track.clientHeight;
        if (trackHeight <= 0) return;

        const thumbHeight = Math.max(36, Math.min(trackHeight - 4, (clientHeight / scrollHeight) * trackHeight));
        thumb.style.height = `${thumbHeight}px`;

        const maxScroll = scrollHeight - clientHeight;
        const maxThumbTop = trackHeight - thumbHeight;
        const scrollRatio = maxScroll > 0 ? (scrollTop / maxScroll) : 0;
        const thumbTop = Math.max(0, Math.min(maxThumbTop, scrollRatio * maxThumbTop));

        thumb.style.transform = `translateY(${thumbTop}px)`;
      }
      window.getActiveScrollableContainer = getActiveScrollableContainer;
      window.updateCustomScrollbar = updateCustomScrollbar;

      window.updateCustomScrollbarFromPosition = function(cursorY) {
        const saveSelect = document.getElementById("saveSelectOverlay");
        let track, thumb, container;
        if (saveSelect && saveSelect.classList.contains("open")) {
          track = document.getElementById("saveSelectCustomScrollbar");
          thumb = document.getElementById("saveSelectCustomScrollbarThumb");
          container = document.getElementById("saveSlotsList");
        } else {
          track = document.getElementById("panelCustomScrollbar");
          thumb = document.getElementById("panelCustomScrollbarThumb");
          container = getActiveScrollableContainer();
        }
        if (!track || !thumb || !container) return;

        const trackRect = track.getBoundingClientRect();
        const trackHeight = trackRect.height;
        if (trackHeight <= 0) return;

        const unscaledTrackHeight = track.clientHeight || trackHeight;
        const scaleY = unscaledTrackHeight > 0 ? (trackHeight / unscaledTrackHeight) : 1;

        const thumbHeight = thumb.offsetHeight || 36;
        const maxThumbTop = unscaledTrackHeight - thumbHeight;
        if (maxThumbTop <= 0) return;

        const relativeY = ((cursorY - trackRect.top) / scaleY) - (thumbHeight / 2);
        const clampedTop = Math.max(0, Math.min(maxThumbTop, relativeY));
        const ratio = clampedTop / maxThumbTop;

        const maxScroll = container.scrollHeight - container.clientHeight;
        container.scrollTop = ratio * maxScroll;
        thumb.style.transform = `translateY(${clampedTop}px)`;
      };

      let isCustomScrollbarDragging = false;
      let isCustomScrollbarInitialized = false;
      function setupCustomScrollbarListeners() {
        if (isCustomScrollbarInitialized) return;
        isCustomScrollbarInitialized = true;

        const tracks = [
          document.getElementById("panelCustomScrollbar"),
          document.getElementById("saveSelectCustomScrollbar")
        ];
        const thumbs = [
          document.getElementById("panelCustomScrollbarThumb"),
          document.getElementById("saveSelectCustomScrollbarThumb")
        ];

        thumbs.forEach(thumb => {
          if (!thumb) return;
          thumb.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            isCustomScrollbarDragging = true;
            thumb.classList.add("dragging");
          });
        });

        tracks.forEach(track => {
          if (!track) return;
          track.addEventListener("mousedown", (e) => {
            const thumb = track.querySelector(".custom-scrollbar-thumb");
            if (e.target === thumb) return;
            e.preventDefault();
            e.stopPropagation();
            isCustomScrollbarDragging = true;
            if (thumb) thumb.classList.add("dragging");
            window.updateCustomScrollbarFromPosition(e.clientY);
          });
        });

        window.addEventListener("mousemove", (e) => {
          if (!isCustomScrollbarDragging) return;
          window.updateCustomScrollbarFromPosition(e.clientY);
        });

        window.addEventListener("mouseup", () => {
          if (isCustomScrollbarDragging) {
            isCustomScrollbarDragging = false;
            document.querySelectorAll(".custom-scrollbar-thumb.dragging").forEach(t => t.classList.remove("dragging"));
          }
        });

        const scrollables = [
          document.getElementById("inventorySettings"),
          document.getElementById("craftingList"),
          document.getElementById("cookingList"),
          document.getElementById("inventoryMainLayout"),
          document.getElementById("inventoryGrid"),
          document.getElementById("saveSlotsList")
        ];
        scrollables.forEach(el => {
          if (el) {
            el.addEventListener("scroll", () => {
              updateCustomScrollbar();
            }, { passive: true });
            el.addEventListener("wheel", (e) => {
              e.stopPropagation();
              el.scrollTop += e.deltaY;
              updateCustomScrollbar();
            }, { passive: false });
          }
        });

        window.addEventListener("resize", updateCustomScrollbar);
      }
      setupCustomScrollbarListeners();

      function executeTrash() {
        if (!trashPendingData) return;
        const { source, index } = trashPendingData;
        
        if (source === "inventory") {
          inventory[index] = null;
        } else if (source === "action") {
          actionSlotsItems[index] = null;
        } else if (source === "equip") {
          equipSlotsItems[index] = null;
          if (typeof refreshCharacterAppearanceNow === "function") {
            refreshCharacterAppearanceNow();
          }
        } else if (source === "chest") {
          if (currentOpenChest) currentOpenChest.storage[index] = null;
        } else if (source === "chestPlayerInventory") {
          inventory[index] = null;
        }
        
        if (source === "chest" || source === "chestPlayerInventory") {
          renderChest();
          renderInventory();
          renderActionSlots();
        } else {
          renderInventory();
          renderActionSlots();
        }
        updateBadge();
        saveSettingsToLocalStorage();
        
        closeTrashConfirm();
      }

      function handleTrashDrop(e) {
        e.preventDefault();
        try {
          let source = e.dataTransfer.getData("source");
          let sourceIndex = parseInt(e.dataTransfer.getData("index"), 10);
          
          if (!source) {
            const dataStr = e.dataTransfer.getData("text/plain");
            if (dataStr) {
               const data = JSON.parse(dataStr);
               source = data.source;
               sourceIndex = data.index;
            }
          }

          if (!source || isNaN(sourceIndex)) return;

          let item = null;
          if (source === "inventory") {
            item = inventory[sourceIndex];
          } else if (source === "action") {
            item = actionSlotsItems[sourceIndex];
          } else if (source === "equip") {
            item = equipSlotsItems[sourceIndex];
          } else if (source === "chest") {
            item = currentOpenChest ? currentOpenChest.storage[sourceIndex] : null;
          } else if (source === "chestPlayerInventory") {
            item = inventory[sourceIndex];
          }

          if (item) {
            openTrashConfirm(source, sourceIndex, item);
          }

        } catch(err) {
          console.error("Trash drop error", err);
        }
      }

      function renderInventory() {
        window.renderInventory = renderInventory;
        const grid = document.getElementById("inventoryGrid");
        if (!grid) return;
        grid.innerHTML = "";

        if (activeTab === "inventory") {
          for (let i = 0; i < TOTAL_SLOTS; i++) {
            const item = inventory[i];
            const isLocked = i >= UNLOCKED_SLOTS;
            const slot = createSlotElement({
              source: "inventory",
              index: i,
              item: item,
              isLocked: isLocked,
              cursor: isMoveModeEnabled ? "grab" : "pointer",
              onClick: (item && !isLocked) ? (isMoveModeEnabled ? null : () => useItem(item, i, "inventory")) : null
            });
            grid.appendChild(slot);
          }
        } else if (activeTab === "itemsList") {
          for (let i = 0; i < Math.max(TOTAL_SLOTS, ALL_ITEMS.length); i++) {
            const item = ALL_ITEMS[i];
            const slot = createSlotElement({
              source: "itemsList",
              index: i,
              item: item,
              isDraggable: false,
              isDropTarget: false,
              onClick: item ? () => {
                if (!isDevMode) return; // ปิดระบบเสกของในโหมดเซฟ
                let successCount = 0;
                for (let j = 0; j < 50; j++) {
                  const added = addItemToInventory({ name: item.name, icon: item.icon, label: item.name }, false, false);
                  if (added) {
                    successCount++;
                  } else {
                    break;
                  }
                }
                if (successCount > 0) {
                  renderInventory();
                  updateBadge();
                  const itemDispName = typeof getItemDisplayName === "function" ? getItemDisplayName(item.name) : item.name;
                  const summonText = typeof t === "function" ? t("summon_success") : "เสกสำเร็จ: ได้รับ";
                  showNotice(`${summonText} ${item.icon} ${itemDispName} x${successCount} !`);
                  slot.style.transform = "scale(0.9)";
                  setTimeout(() => { slot.style.transform = ""; }, 100);
                } else {
                  const fullText = typeof t === "function" ? t("inventory_full") : "❌ กระเป๋าเต็มแล้ว! (Inventory is full)";
                  showNotice(fullText);
                }
              } : null
            });
            grid.appendChild(slot);
          }
        }

        updateBadge();
        const tabInv = document.getElementById("tabInventory");
        const isTabInventoryActive = tabInv ? tabInv.classList.contains("active") : (activeTab === "inventory");
        const bottomBtns = document.getElementById("inventoryBottomButtons");
        if (bottomBtns) {
          bottomBtns.style.display = (isTabInventoryActive && activeTab === "inventory") ? "flex" : "none";
        }
        if (typeof renderEquipSlots === "function") renderEquipSlots();
        if (typeof updateSelectedSlotVisuals === "function") updateSelectedSlotVisuals();
        if (typeof updateBottomButtonsState === "function") updateBottomButtonsState();
        if (typeof updateCustomScrollbar === "function") setTimeout(updateCustomScrollbar, 30);
      }
      window.renderInventory = renderInventory;

      const EQUIP_SLOT_META = [
        {
          id: "shirt",
          i18nKey: "equip_shirt",
          fallbackTh: "เสื้อ",
          svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(223, 183, 108, 0.35)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" fill="rgba(223, 183, 108, 0.06)"/></svg>`
        },
        {
          id: "pants",
          i18nKey: "equip_pants",
          fallbackTh: "กางเกง/กระโปรง",
          svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(223, 183, 108, 0.35)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l1.5 18h-5.2L12 11 9.7 21H4.5L6 3z" fill="rgba(223, 183, 108, 0.06)"/><line x1="6" y1="6.5" x2="18" y2="6.5"/></svg>`
        },
        {
          id: "shoes",
          i18nKey: "equip_shoes",
          fallbackTh: "รองเท้า",
          svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(223, 183, 108, 0.35)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18v-9h5l2 5 6 1.5a3 3 0 0 1 2.2 2.9V18H4z" fill="rgba(223, 183, 108, 0.06)"/><line x1="4" y1="20" x2="19.2" y2="20"/></svg>`
        },
        {
          id: "accessory",
          i18nKey: "equip_accessory",
          fallbackTh: "ของตกแต่ง",
          svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(223, 183, 108, 0.35)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="rgba(223, 183, 108, 0.06)"/></svg>`
        },
        {
          id: "accessory",
          i18nKey: "equip_accessory2",
          fallbackTh: "ของตกแต่ง 2",
          svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(223, 183, 108, 0.35)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="rgba(223, 183, 108, 0.06)"/></svg>`
        }
      ];

      function renderEquipSlots() {
        window.renderEquipSlots = renderEquipSlots;
        const slots = document.querySelectorAll("#inventoryEquipSlots .action-slot");
        for (let i = 0; i < slots.length && i < 5; i++) {
          const slotEl = slots[i];
          if (!slotEl) continue;

          const item = equipSlotsItems[i];
          const meta = EQUIP_SLOT_META[i];
          const slotTitle = (typeof t === "function" && meta) ? t(meta.i18nKey) : (meta ? meta.fallbackTh : "");

          populateSlotElement(slotEl, {
            source: "equip",
            index: i,
            item: item,
            keyLabel: null,
            cursor: isMoveModeEnabled ? "grab" : "pointer",
            labelStyle: {
              fontSize: "8px",
              position: "absolute",
              bottom: "2px",
              color: "rgba(223, 183, 108, 0.7)",
              fontFamily: "'Google Sans', sans-serif"
            },
            onRightClick: () => {
              handleSplitItem("equip", i);
            }
          });

          if (!item && meta) {
            slotEl.style.position = "relative";
            slotEl.title = slotTitle;

            const iconWrap = document.createElement("span");
            iconWrap.className = "slot-content equip-placeholder-icon";
            iconWrap.style.display = "flex";
            iconWrap.style.alignItems = "center";
            iconWrap.style.justifyContent = "center";
            iconWrap.style.pointerEvents = "none";
            iconWrap.style.marginBottom = "8px";
            iconWrap.innerHTML = meta.svg;
            slotEl.appendChild(iconWrap);

            const emptyLabel = document.createElement("span");
            emptyLabel.className = "slot-label";
            emptyLabel.style.fontSize = "8px";
            emptyLabel.style.position = "absolute";
            emptyLabel.style.bottom = "3px";
            emptyLabel.style.left = "2px";
            emptyLabel.style.right = "2px";
            emptyLabel.style.textAlign = "center";
            emptyLabel.style.color = "rgba(223, 183, 108, 0.45)";
            emptyLabel.style.fontFamily = "'Google Sans', sans-serif";
            emptyLabel.style.pointerEvents = "none";
            emptyLabel.style.whiteSpace = "nowrap";
            emptyLabel.style.overflow = "hidden";
            emptyLabel.style.textOverflow = "ellipsis";
            if (typeof window.setElementTextOrHTML === "function") {
              window.setElementTextOrHTML(emptyLabel, slotTitle);
            } else {
              emptyLabel.textContent = slotTitle;
            }
            slotEl.appendChild(emptyLabel);
          }
        }
      }
      window.renderEquipSlots = renderEquipSlots;

      function renderActionSlots() {
        window.renderActionSlots = renderActionSlots;
        if (typeof renderEquipSlots === "function") renderEquipSlots();
        const containers = [
          document.querySelectorAll(".action-slots .action-slot"),
          document.querySelectorAll(".inventory-action-slots .action-slot")
        ];

        containers.forEach(slots => {
          for (let i = 0; i < slots.length; i++) {
            const slotEl = slots[i];
            if (!slotEl) continue;

            if (i === selectedActionSlotIndex) {
              slotEl.classList.add("selected");
            } else {
              slotEl.classList.remove("selected");
            }

            let keyLabel = null;
            if (i < 4) {
              const keyMap = { 0: "action1", 1: "action2", 2: "action3", 3: "action4" };
              const rawKey = currentKeyBindings[keyMap[i]] || "";
              keyLabel = rawKey.replace("Key", "").replace("Digit", "");
            }

            const item = actionSlotsItems[i];

            populateSlotElement(slotEl, {
              source: "action",
              index: i,
              item: item,
              keyLabel: keyLabel,
              cursor: isMoveModeEnabled ? "grab" : "pointer",
              labelStyle: {
                fontSize: "8px",
                position: "absolute",
                bottom: "2px",
                color: "rgba(223, 183, 108, 0.7)",
                fontFamily: "'Google Sans', sans-serif"
              },
              onClick: isMoveModeEnabled ? null : () => {
                if (selectedActionSlotIndex === i) {
                  selectedActionSlotIndex = -1;
                  renderActionSlots();
                  if (activeItem && (activeItem.name === "BOW" || activeItem.name === "WOODEN_ARM_CANNON" || activeItem.name === "ARM_CANNON")) {
                    useAnimTimer = 0;
                    isUsingItem = false;
                    activeItem = null;
                  }
                  wasUsingBowBeforeSwimming = false;
                } else {
                  selectedActionSlotIndex = i;
                  renderActionSlots();
                }
              },
              onRightClick: (e) => {
                if (item && (item.name === "WOODEN_ARM_CANNON" || item.name === "ARM_CANNON")) {
                  switchCannonAmmo();
                } else {
                  handleSplitItem("action", i);
                }
              }
            });
          }
        });
      }

      function addItemToInventory(item, playAudio = true, shouldRender = true) {
        const itemName = item.name || item.label;
        const addCount = Math.max(1, item.count || 1);
        const maxStack = MAX_STACK_PER_SLOT;

        // Verify total capacity across all unlocked slots first (existing stack room + empty slots)
        let availableSpace = 0;
        for (let i = 0; i < UNLOCKED_SLOTS; i++) {
          const slotItem = inventory[i];
          if (slotItem === null) {
            availableSpace += maxStack;
          } else if (slotItem.name === itemName || slotItem.label === itemName) {
            const curCount = slotItem.count || 1;
            if (curCount < maxStack) {
              availableSpace += (maxStack - curCount);
            }
          }
        }
        if (availableSpace < addCount) {
          return false;
        }

        let remaining = addCount;

        // 1. Fill existing matching slots up to maxStack (30)
        for (let i = 0; i < UNLOCKED_SLOTS && remaining > 0; i++) {
          const slotItem = inventory[i];
          if (
            slotItem !== null &&
            (slotItem.name === itemName || slotItem.label === itemName)
          ) {
            const curCount = slotItem.count || 1;
            const room = maxStack - curCount;
            if (room > 0) {
              const toAdd = Math.min(room, remaining);
              slotItem.count = curCount + toAdd;
              remaining -= toAdd;
            }
          }
        }

        // 2. Place remaining items into empty slots, capped at maxStack (30) per slot
        for (let i = 0; i < UNLOCKED_SLOTS && remaining > 0; i++) {
          if (inventory[i] === null) {
            const toPut = Math.min(maxStack, remaining);
            inventory[i] = { ...item, count: toPut };
            inventory[i].name = itemName; // Ensure name is set for future stacking
            remaining -= toPut;
          }
        }

        if (shouldRender) {
          renderInventory();
          updateBadge();
        }
        if (playAudio) playCollectSound();
        saveSettingsToLocalStorage();
        return true;
      }

      function simulateDemolishStorage(closestDemolishItem, structureItemData) {
        // Create a list of single-count items we need to insert.
        const flatItems = [];
        
        // 1. The structure itself
        flatItems.push({ name: structureItemData.name, icon: structureItemData.icon, label: structureItemData.label });

        // If it's a boat with attached items, return those too!
        if (closestDemolishItem.type === "wood_boat") {
          if (closestDemolishItem.hasWheel || closestDemolishItem.hasWheels) {
            flatItems.push({ name: "WOOD_WHEEL", icon: "🛞", label: "WOOD_WHEEL" });
          }
          if (closestDemolishItem.hasEngine) {
            flatItems.push({ name: "ELECTRIC_ENGINE", icon: "🔋", label: "ELECTRIC_ENGINE" });
          }
          if (closestDemolishItem.hasWing || closestDemolishItem.hasWings) {
            flatItems.push({ name: "BOAT_WING", icon: "🪽", label: "BOAT_WING" });
          }
        }

        // If it's a table with lanterns sitting on top, return those lanterns too!
        if (closestDemolishItem.type === "wood_table" && closestDemolishItem.position && typeof collectibles !== "undefined") {
          const tP = closestDemolishItem.position;
          const tR = closestDemolishItem.R || [1, 0, 0];
          const tF = closestDemolishItem.F || [0, 0, 1];
          const tN = closestDemolishItem.normal || [0, 1, 0];
          for (let c of collectibles) {
            if (c && c.active && !c.isPreview && c.type === "lantern" && c.position) {
              const dx = c.position[0] - tP[0];
              const dy = c.position[1] - tP[1];
              const dz = c.position[2] - tP[2];
              const lx = Math.abs(dx * tR[0] + dy * tR[1] + dz * tR[2]);
              const lz = Math.abs(dx * tF[0] + dy * tF[1] + dz * tF[2]);
              const ly = dx * tN[0] + dy * tN[1] + dz * tN[2];
              if (lx <= 0.075 && lz <= 0.060 && Math.abs(ly - 0.145 * 0.46) < 0.03) {
                flatItems.push({ name: "LANTERN", icon: "🏮", label: "LANTERN" });
              }
            }
          }
        }
        
        // 2. If it's a chest, add all its stored items
        if (closestDemolishItem.type === "wood_chest" && closestDemolishItem.storage) {
          for (let i = 0; i < closestDemolishItem.storage.length; i++) {
            const stItem = closestDemolishItem.storage[i];
            if (stItem) {
              const count = stItem.count || 1;
              for (let c = 0; c < count; c++) {
                flatItems.push({ name: stItem.name || stItem.label, icon: stItem.icon, label: stItem.label || stItem.name });
              }
            }
          }
        }
        
        // Simulate inserting flatItems into a copy of inventory
        const tempInventory = inventory.map(item => item ? { ...item } : null);
        
        for (const flatItem of flatItems) {
          let placed = false;
          // Try to stack (up to 30 per slot)
          for (let i = 0; i < UNLOCKED_SLOTS; i++) {
            if (
              tempInventory[i] !== null &&
              (tempInventory[i].name === flatItem.name || tempInventory[i].label === flatItem.name) &&
              (tempInventory[i].count || 1) < MAX_STACK_PER_SLOT
            ) {
              tempInventory[i].count = (tempInventory[i].count || 1) + 1;
              placed = true;
              break;
            }
          }
          // If not stacked, find empty slot
          if (!placed) {
            for (let i = 0; i < UNLOCKED_SLOTS; i++) {
              if (tempInventory[i] === null) {
                tempInventory[i] = { name: flatItem.name, icon: flatItem.icon, label: flatItem.label, count: 1 };
                placed = true;
                break;
              }
            }
          }
          // If we couldn't place it, return null (inventory full)
          if (!placed) {
            return null;
          }
        }
        
        return tempInventory;
      }

      function tryDemolishItem(closestDemolishItem) {
        if (!closestDemolishItem) return false;

        let itemData = null;
        if (closestDemolishItem.type === "stone_floor") {
          itemData = { name: "STONE_FLOOR", icon: "🪨", label: "STONE_FLOOR" };
        } else if (closestDemolishItem.type === "wood_floor") {
          itemData = { name: "WOOD_FLOOR", icon: "🪵", label: "WOOD_FLOOR" };
        } else if (closestDemolishItem.type === "thin_wood_floor") {
          itemData = { name: "THIN_WOOD_FLOOR", icon: "������", label: "THIN_WOOD_FLOOR" };
        } else if (closestDemolishItem.type === "wood_stairs") {
          itemData = { name: "WOOD_STAIRS", icon: "🪜", label: "WOOD_STAIRS" };
        } else if (closestDemolishItem.type === "folding_ladder") {
          itemData = { name: "FOLDING_LADDER", icon: "🪜", label: "FOLDING_LADDER" };
        } else if (closestDemolishItem.type === "campfire") {
          itemData = { name: "CAMPFIRE", icon: "🔥", label: "CAMPFIRE" };
        } else if (closestDemolishItem.type === "wood_boat") {
          itemData = { name: "WOOD_BOAT", icon: "🛶", label: "WOOD_BOAT" };
        } else if (closestDemolishItem.type === "wood_wheel") {
          itemData = { name: "WOOD_WHEEL", icon: "🛞", label: "WOOD_WHEEL" };
        } else if (closestDemolishItem.type === "electric_engine") {
          itemData = { name: "ELECTRIC_ENGINE", icon: "🔋", label: "ELECTRIC_ENGINE" };
        } else if (closestDemolishItem.type === "boat_wing") {
          itemData = { name: "BOAT_WING", icon: "🪽", label: "BOAT_WING" };
        } else if (closestDemolishItem.type === "wood_wall") {
          itemData = { name: "WOOD_WALL", icon: "🧱", label: "WOOD_WALL" };
        } else if (closestDemolishItem.type === "wood_window") {
          itemData = { name: "WOOD_WINDOW", icon: "🪟", label: "WOOD_WINDOW" };
        } else if (closestDemolishItem.type === "wood_door") {
          itemData = { name: "WOOD_DOOR", icon: "🚪", label: "WOOD_DOOR" };
        } else if (closestDemolishItem.type === "wood_roof") {
          itemData = { name: "WOOD_ROOF", icon: "🛖", label: "WOOD_ROOF" };
        } else if (closestDemolishItem.type === "wood_chest") {
          itemData = { name: "WOOD_CHEST", icon: "📦", label: "WOOD_CHEST" };
        } else if (closestDemolishItem.type === "wood_bed") {
          itemData = { name: "WOOD_BED", icon: "🛏️", label: "WOOD_BED" };
        } else if (closestDemolishItem.type === "wood_table") {
          itemData = { name: "WOOD_TABLE", icon: "🪑", label: "WOOD_TABLE" };
        } else if (closestDemolishItem.type === "wood_planter_box") {
          itemData = { name: "WOOD_PLANTER_BOX", icon: "🪴", label: "WOOD_PLANTER_BOX" };
        } else if (closestDemolishItem.type === "wood_chair") {
          itemData = { name: "WOOD_CHAIR", icon: "🪑", label: "WOOD_CHAIR" };
        } else if (closestDemolishItem.type === "lantern") {
          itemData = { name: "LANTERN", icon: "🏮", label: "LANTERN" };
        } else if (closestDemolishItem.type === "meganeura_item") {
          itemData = { name: "MEGANEURA", icon: "🦟", label: "MEGANEURA" };
        } else if (closestDemolishItem.type === "isopod_item") {
          itemData = { name: "ISOPOD", icon: "🦐", label: "ISOPOD" };
        } else if (closestDemolishItem.type === "obsidian_cube_item") {
          itemData = { name: "OBSIDIAN_CUBE", icon: "🔶", label: "OBSIDIAN_CUBE" };
        } else if (closestDemolishItem.type === "obsidian_pad_warp_item" || closestDemolishItem.type === "obsidian_compass_pad_item") {
          itemData = { name: "OBSIDIAN_PAD_WARP", icon: "🧭", label: "OBSIDIAN_PAD_WARP" };
        } else if (closestDemolishItem.type === "robot_stand") {
          itemData = { name: "ROBOT_STAND", icon: "🏗️", label: "ROBOT_STAND" };
        } else if (closestDemolishItem.type === "robot_cockpit") {
          itemData = { name: "ROBOT_COCKPIT", icon: "🤖", label: "ROBOT_COCKPIT" };
        } else if (closestDemolishItem.type === "robot_left_arm") {
          itemData = { name: "ROBOT_LEFT_ARM", icon: "🦾", label: "ROBOT_LEFT_ARM" };
        } else if (closestDemolishItem.type === "robot_right_arm") {
          itemData = { name: "ROBOT_RIGHT_ARM", icon: "🦾", label: "ROBOT_RIGHT_ARM" };
        } else if (closestDemolishItem.type === "robot_left_leg") {
          itemData = { name: "ROBOT_LEFT_LEG", icon: "🦿", label: "ROBOT_LEFT_LEG" };
        } else if (closestDemolishItem.type === "robot_right_leg") {
          itemData = { name: "ROBOT_RIGHT_LEG", icon: "🦿", label: "ROBOT_RIGHT_LEG" };
        }

        if (itemData) {
          const simulatedInventory = simulateDemolishStorage(closestDemolishItem, itemData);
          if (simulatedInventory) {
            for (let i = 0; i < UNLOCKED_SLOTS; i++) {
              inventory[i] = simulatedInventory[i];
            }
            if (closestDemolishItem.type === "wood_table" && closestDemolishItem.position && typeof collectibles !== "undefined") {
              const tP = closestDemolishItem.position;
              const tR = closestDemolishItem.R || [1, 0, 0];
              const tF = closestDemolishItem.F || [0, 0, 1];
              const tN = closestDemolishItem.normal || [0, 1, 0];
              for (let c of collectibles) {
                if (c && c.active && !c.isPreview && c.type === "lantern" && c.position) {
                  const dx = c.position[0] - tP[0];
                  const dy = c.position[1] - tP[1];
                  const dz = c.position[2] - tP[2];
                  const lx = Math.abs(dx * tR[0] + dy * tR[1] + dz * tR[2]);
                  const lz = Math.abs(dx * tF[0] + dy * tF[1] + dz * tF[2]);
                  const ly = dx * tN[0] + dy * tN[1] + dz * tN[2];
                  if (lx <= 0.075 && lz <= 0.060 && Math.abs(ly - 0.145 * 0.46) < 0.03) {
                    c.active = false;
                    c.isDemolished = true;
                  }
                }
              }
            }
            closestDemolishItem.active = false;
            closestDemolishItem.isDemolished = true;

            if (typeof currentOpenChest !== "undefined" && currentOpenChest === closestDemolishItem) {
              if (typeof closeChest === "function") closeChest();
            }

            if (closestDemolishItem.houseIndex !== undefined || closestDemolishItem.isHouseChest) {
              const hIdx = closestDemolishItem.houseIndex;
              if (typeof window !== "undefined") {
                if (!window.demolishedHouseChests) window.demolishedHouseChests = [];
                if (hIdx !== undefined && !window.demolishedHouseChests.includes(hIdx)) {
                  window.demolishedHouseChests.push(hIdx);
                }
                const houses = window.placedHouses || [];
                if (hIdx !== undefined && houses[hIdx]) {
                  houses[hIdx].chestDemolished = true;
                  houses[hIdx].chest = closestDemolishItem;
                }
                if (!Array.isArray(window.savedRemovedWorldKeys)) window.savedRemovedWorldKeys = [];
                const hk = "house_chest_" + hIdx;
                if (!window.savedRemovedWorldKeys.includes(hk)) {
                  window.savedRemovedWorldKeys.push(hk);
                }
                if (closestDemolishItem.worldKey && !window.savedRemovedWorldKeys.includes(closestDemolishItem.worldKey)) {
                  window.savedRemovedWorldKeys.push(closestDemolishItem.worldKey);
                }
              }
            }

            if (closestDemolishItem.worldKey || closestDemolishItem.isWorldGenerated || closestDemolishItem.isProceduralHouse || closestDemolishItem.isHouse) {
              const wk = closestDemolishItem.worldKey || (
                closestDemolishItem.type + "_" +
                (closestDemolishItem.position ? Math.round(closestDemolishItem.position[0] * 1000) : 0) + "_" +
                (closestDemolishItem.position ? Math.round(closestDemolishItem.position[1] * 1000) : 0) + "_" +
                (closestDemolishItem.position ? Math.round(closestDemolishItem.position[2] * 1000) : 0)
              );
              if (typeof window !== "undefined") {
                if (!Array.isArray(window.savedRemovedWorldKeys)) window.savedRemovedWorldKeys = [];
                if (!window.savedRemovedWorldKeys.includes(wk)) {
                  window.savedRemovedWorldKeys.push(wk);
                }
              }
            }

            if (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.rebuild === "function" && typeof collectibles !== "undefined") {
              SpatialGrid.rebuild(collectibles);
            }
            if (typeof window !== "undefined") {
              window.pendingCollectibleRefresh = true;
              window.pendingDynamicCollectibleRefresh = true;
            }

            if (typeof refreshCollectiblesVBO === "function") {
              refreshCollectiblesVBO();
            }
            renderInventory();
            renderActionSlots();
            updateBadge();
            saveSettingsToLocalStorage();
            playCollectSound();
            const demItemDisp = typeof getItemDisplayName === "function" ? getItemDisplayName(itemData.name) : itemData.name;
            const curDemLang = typeof getGameLanguage === "function" ? getGameLanguage() : "th";
            let demResultText = "";
            if (curDemLang === "en") {
              demResultText = "Demolished " + demItemDisp + "!";
            } else if (curDemLang === "seedian") {
              const rawTxt = "รื้อถอน " + demItemDisp + " แล้ว!";
              demResultText = (window.Seedian && typeof window.Seedian.toSeedian === "function")
                ? window.Seedian.toSeedian(rawTxt)
                : rawTxt;
            } else {
              demResultText = "รื้อถอน " + demItemDisp + " แล้ว!";
            }
            showNotice(demResultText);
            return true;
          } else {
            const curDemLang = typeof getGameLanguage === "function" ? getGameLanguage() : "th";
            let fullText = "";
            if (curDemLang === "en") {
              fullText = "Inventory full! Cannot demolish.";
            } else if (curDemLang === "seedian") {
              const rawTxt = "กระเป๋าเต็ม! ไม่สามารถรื้อถอนได้";
              fullText = (window.Seedian && typeof window.Seedian.toSeedian === "function")
                ? window.Seedian.toSeedian(rawTxt)
                : rawTxt;
            } else {
              fullText = "กระเป๋าเต็ม! ไม่สามารถรื้อถอนได้";
            }
            showNotice(fullText);
            return false;
          }
        }
        return false;
      }

      // Robot Stand 8-Slot UI Manager
      window.updateMechStandUI = function(activeStand, attachedCollectibles) {
        const uiContainer = document.getElementById("mechStandUI");
        const gridContainer = document.getElementById("mechStandGrid");
        const statusBadge = document.getElementById("mechStandStatusBadge");

        if (!uiContainer || !gridContainer) return;

        if (!activeStand) {
          if (uiContainer.classList.contains("visible")) {
            uiContainer.classList.remove("visible");
          }
          window._lastMechStandStateKey = null;
          return;
        }

        if (!uiContainer.classList.contains("visible")) {
          uiContainer.classList.add("visible");
        }

        window._lastActiveStand = activeStand;
        window._lastAttachedCollectibles = attachedCollectibles;

        function getRobotPartLabel(typeOrName) {
          const tKey = (typeOrName || "").toLowerCase();
          if (tKey.includes("cockpit")) return (typeof t === "function") ? t("mech_part_cockpit") : "Cockpit";
          if (tKey.includes("left_arm")) return (typeof t === "function") ? t("mech_part_left_arm") : "Left Arm";
          if (tKey.includes("right_arm")) return (typeof t === "function") ? t("mech_part_right_arm") : "Right Arm";
          if (tKey.includes("left_leg")) return (typeof t === "function") ? t("mech_part_left_leg") : "Left Leg";
          if (tKey.includes("right_leg")) return (typeof t === "function") ? t("mech_part_right_leg") : "Right Leg";
          if (tKey.includes("stand")) return (typeof t === "function") ? t("mech_part_stand") : "Stand";
          if (tKey.includes("core")) return (typeof t === "function") ? t("mech_part_core") : "Power Core";
          if (tKey.includes("module")) return (typeof t === "function") ? t("mech_part_module") : "Module";
          if (typeof getItemDisplayName === "function") return getItemDisplayName(typeOrName);
          return typeOrName || ((typeof t === "function") ? t("mech_part_generic") : "Robot Part");
        }

        const equippedItems = [];
        if (activeStand) {
          equippedItems.push({
            item: activeStand,
            type: "robot_stand",
            itemName: "ROBOT_STAND",
            label: getRobotPartLabel("robot_stand")
          });
        }

        const listToSearch = Array.isArray(attachedCollectibles) ? attachedCollectibles : [];
        listToSearch.forEach(c => {
          if (c && c.active && !c.isPreview && c.type && c.type !== "robot_stand") {
            equippedItems.push({
              item: c,
              type: c.type,
              itemName: c.type.toUpperCase(),
              label: getRobotPartLabel(c.type)
            });
          }
        });

        // Prevent unnecessary DOM teardowns every frame if state key has not changed
        const curLang = typeof getGameLanguage === "function" ? getGameLanguage() : (window.gameLanguage || "en");
        const standId = activeStand.id || (activeStand.position ? activeStand.position.map(n => n.toFixed(2)).join(",") : "stand");
        const itemsKey = equippedItems.map(eq => eq.type).join("|");
        const currentStateKey = `${standId}_${itemsKey}_${curLang}`;

        if (window._lastMechStandStateKey === currentStateKey && gridContainer.children.length > 0) {
          return;
        }
        window._lastMechStandStateKey = currentStateKey;

        gridContainer.innerHTML = "";

        const renderMechStandUI = (stand, parts) => {
          window._lastMechStandStateKey = null;
          window.updateMechStandUI(stand, parts);
        };
        window.renderMechStandUI = renderMechStandUI;

        // Global action trigger for Mech Stand slots (supports both 3D World Raycast and HTML click)
        window.triggerMechStandSlotAction = function(slotIndex) {
          const activeStand = window._lastActiveStand;
          const listToSearch = window._lastAttachedCollectibles || [];
          if (!activeStand) return false;

          const equippedList = [];
          equippedList.push({
            item: activeStand,
            type: "robot_stand",
            itemName: "ROBOT_STAND",
            label: getRobotPartLabel("robot_stand")
          });
          listToSearch.forEach(c => {
            if (c && c.active && !c.isPreview && c.type && c.type !== "robot_stand") {
              equippedList.push({
                item: c,
                type: c.type,
                itemName: c.type.toUpperCase(),
                label: getRobotPartLabel(c.type)
              });
            }
          });

          const eqData = equippedList[slotIndex] || null;
          const targetCol = eqData ? eqData.item : null;

          if (targetCol) {
            if (eqData.type === "robot_stand") {
              showNotice((typeof t === "function") ? t("mech_cannot_remove_stand") : "Cannot remove stand while active!");
              return false;
            }
            const itemData = { name: eqData.itemName, icon: "🤖", label: eqData.label, count: 1 };
            if (addItemToInventory(itemData)) {
              targetCol.active = false;
              const idx = collectibles.indexOf(targetCol);
              if (idx !== -1) collectibles.splice(idx, 1);
              const attIdx = listToSearch.indexOf(targetCol);
              if (attIdx !== -1) listToSearch.splice(attIdx, 1);

              if (typeof activeRidingMech !== "undefined" && activeRidingMech && activeRidingMech.attachedParts) {
                activeRidingMech.attachedParts = activeRidingMech.attachedParts.filter(e => e.item !== targetCol);
              }

              pendingCollectibleRefresh = true;
              if (typeof refreshCollectiblesVBO === "function") refreshCollectiblesVBO("demolish");
              if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
              showNotice((typeof t === "function") ? t("mech_dismantle_success", { part: eqData.label }) : `Dismantled ${eqData.label} successfully!`);
              if (typeof playCollectSound === "function") playCollectSound();
              if (typeof World3DUI !== "undefined" && World3DUI.backend) {
                const sign = World3DUI.signs.get("mech_stand_world_sign");
                if (sign) sign.needsTextureUpdate = true;
              }
              renderMechStandUI(activeStand, listToSearch);
              return true;
            } else {
              showNotice((typeof t === "function") ? t("mech_inventory_full") : "Inventory full! Cannot dismantle");
              return false;
            }
          } else {
            // Equip next available robot part
            const cockpitItem = listToSearch.find(c => c && c.active && !c.isPreview && c.type === "robot_cockpit");
            const equippedTypes = listToSearch.map(c => c.type ? c.type.toLowerCase() : "");
            
            const invIndex = inventory.findIndex(i => {
              if (!i || !i.name || !i.name.startsWith("ROBOT_") || i.name === "ROBOT_STAND") return false;
              const typeName = i.name.toLowerCase();
              if (equippedTypes.includes(typeName)) return false;
              if ((typeName.includes("arm") || typeName.includes("leg")) && !cockpitItem) return false;
              return true;
            });

            if (invIndex === -1) {
              const hasArmsLegs = inventory.some(i => i && i.name && (i.name.includes("ARM") || i.name.includes("LEG")));
              if (hasArmsLegs && !cockpitItem) {
                showNotice((typeof t === "function") ? t("mech_require_cockpit") : "Must equip Cockpit before arms or legs!");
              } else {
                showNotice((typeof t === "function") ? t("mech_no_parts_to_equip") : "No new parts to equip!");
              }
              return false;
            }

            const itemToEquip = inventory[invIndex];
            itemToEquip.count--;
            if (itemToEquip.count <= 0) inventory[invIndex] = null;
            renderInventory();
            renderActionSlots();

            let pN = activeStand.normal || activeStand.U || [0,1,0];
            let pR = activeStand.R || [1,0,0];
            let pF = activeStand.F || [0,0,1];

            let basePos = cockpitItem ? cockpitItem.position : activeStand.position;
            let baseN = cockpitItem ? (cockpitItem.normal || pN) : pN;
            let baseR = cockpitItem ? (cockpitItem.R || pR) : pR;
            let baseF = cockpitItem ? (cockpitItem.F || pF) : pF;

            const itemType = itemToEquip.name.toLowerCase();
            let rOff = 0, nOff = 0, fOff = 0;
            if (itemType === "robot_cockpit") {
              nOff = 0.66;
            } else if (itemType === "robot_left_leg") {
              rOff = -0.030;
              nOff = cockpitItem ? -0.5025 : (0.66 - 0.5025);
            } else if (itemType === "robot_right_leg") {
              rOff = 0.030;
              nOff = cockpitItem ? -0.5025 : (0.66 - 0.5025);
            } else if (itemType === "robot_left_arm") {
              rOff = -0.1875;
              nOff = cockpitItem ? -0.16875 : (0.66 - 0.16875);
            } else if (itemType === "robot_right_arm") {
              rOff = 0.1875;
              nOff = cockpitItem ? -0.16875 : (0.66 - 0.16875);
            } else {
              nOff = 0.35;
            }

            let newPos = [
              basePos[0] + baseR[0]*rOff + baseN[0]*nOff + baseF[0]*fOff,
              basePos[1] + baseR[1]*rOff + baseN[1]*nOff + baseF[1]*fOff,
              basePos[2] + baseR[2]*rOff + baseN[2]*nOff + baseF[2]*fOff
            ];

            const newCol = {
              type: itemType,
              position: newPos,
              normal: [...baseN],
              R: [...baseR],
              F: [...baseF],
              active: true,
              size: 0.25,
              color: [1, 1, 1],
              isDynamic: false,
              isPlayerPlaced: true,
              isWorldGenerated: false,
              seed: Math.random()
            };
            collectibles.push(newCol);
            if (Array.isArray(listToSearch)) {
              listToSearch.push(newCol);
            }

            if (typeof activeRidingMech !== "undefined" && activeRidingMech) {
              if (!activeRidingMech.attachedParts) activeRidingMech.attachedParts = [];
              activeRidingMech.attachedParts.push({
                item: newCol,
                localR: rOff,
                localN: nOff,
                localF: fOff
              });
            }

            pendingCollectibleRefresh = true;
            if (typeof refreshCollectiblesVBO === "function") refreshCollectiblesVBO("place");
            if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
            showNotice((typeof t === "function") ? t("mech_equip_success", { part: getRobotPartLabel(itemType) }) : `Equipped ${getRobotPartLabel(itemType)} successfully!`);
            if (typeof playCollectSound === "function") playCollectSound();
            if (typeof World3DUI !== "undefined" && World3DUI.backend) {
              const sign = World3DUI.signs.get("mech_stand_world_sign");
              if (sign) sign.needsTextureUpdate = true;
            }
            renderMechStandUI(activeStand, listToSearch);
            return true;
          }
        };

        // 8 Dynamic slots
        for (let i = 0; i < 8; i++) {
          const slotId = i + 1;
          const equippedData = equippedItems[i] || null;
          const matchingItem = equippedData ? equippedData.item : null;

          const slotEl = document.createElement("div");
          slotEl.className = "mech-stand-slot" + (matchingItem ? " equipped" : "");
          const dismantleTitle = (typeof t === "function" && equippedData) ? t("mech_slot_dismantle_title", { part: equippedData.label }) : `Click to dismantle ${equippedData ? equippedData.label : ''}`;
          const emptySlotTitle = (typeof t === "function") ? t("mech_slot_empty_title") : "Empty Slot (Click to Equip Part)";
          slotEl.title = matchingItem ? dismantleTitle : emptySlotTitle;

          const equippedText = (typeof t === "function") ? t("mech_slot_equipped") : "✔ EQUIPPED";
          const emptyText = (typeof t === "function") ? t("mech_slot_empty") : "✚ EMPTY";

          slotEl.innerHTML = `
            <span class="mech-slot-number">#0${slotId}</span>
            <div class="mech-slot-icon"></div>
            <span class="mech-slot-label">${matchingItem ? equippedData.label : ''}</span>
            <span class="mech-slot-status ${matchingItem ? '' : 'empty'}">${matchingItem ? equippedText : emptyText}</span>
          `;

          const iconContainer = slotEl.querySelector(".mech-slot-icon");
          if (matchingItem && iconContainer && typeof create3DIconCanvas === "function") {
            const icon3D = create3DIconCanvas(matchingItem.type || equippedData.itemName, 38, 38);
            if (icon3D) {
              iconContainer.appendChild(icon3D);
            }
          }

          slotEl.onclick = () => {
            window.triggerMechStandSlotAction(i);
          };

          gridContainer.appendChild(slotEl);
        }

        if (statusBadge) {
          statusBadge.style.display = "none";
        }
      };

      // ============================================
      // ระบบบทลงโทษเมื่อหมดสติ (Unconscious Death Penalty)
      // สุ่มทำลายไอเทมในกระเป๋า 1 ช่อง
      // ============================================
      function destroyRandomInventorySlotOnUnconscious(customNotice = null) {
        // ค้นหาช่องในกระเป๋า (inventory) ทั้งหมดที่มีไอเทมอยู่
        const occupiedBagSlots = [];
        if (typeof inventory !== "undefined" && Array.isArray(inventory)) {
          for (let i = 0; i < inventory.length; i++) {
            if (inventory[i] !== null && inventory[i] !== undefined) {
              occupiedBagSlots.push({ source: "inventory", index: i, item: inventory[i] });
            }
          }
        }

        let targetPool = occupiedBagSlots;
        let chosenSource = "inventory";

        // หากในกระเป๋าว่างเปล่า ไม่มีไอเทมเลย ให้ตรวจสอบช่องคีย์ลัด (actionSlotsItems) เผื่อผู้เล่นใส่ของไว้ที่คีย์ลัด
        if (targetPool.length === 0 && typeof actionSlotsItems !== "undefined" && Array.isArray(actionSlotsItems)) {
          const occupiedActionSlots = [];
          for (let i = 0; i < actionSlotsItems.length; i++) {
            if (actionSlotsItems[i] !== null && actionSlotsItems[i] !== undefined) {
              occupiedActionSlots.push({ source: "action", index: i, item: actionSlotsItems[i] });
            }
          }
          if (occupiedActionSlots.length > 0) {
            targetPool = occupiedActionSlots;
            chosenSource = "action";
          }
        }

        const isEn = (typeof window.getGameLanguage === "function" && window.getGameLanguage() === "en") ||
                     (window.gameLanguage === "en");

        // ถ้าไม่มีไอเทมใดๆ เลย
        if (targetPool.length === 0) {
          const emptyMsg = isEn
            ? (customNotice ? `💀 ${customNotice} (No items in bag to lose)` : "💀 Passed out, but had no items in bag to lose!")
            : (customNotice ? `💀 ${customNotice} (ไม่มีไอเทมในกระเป๋าให้สูญเสีย)` : "💀 คุณหมดสติ! แต่ไม่มีไอเทมในกระเป๋าให้สูญเสีย");
          if (typeof showNotice === "function") {
            showNotice(emptyMsg);
          }
          return null;
        }

        // สุ่มเลือก 1 ช่องที่ถูกใช้งาน
        const randIdx = Math.floor(Math.random() * targetPool.length);
        const target = targetPool[randIdx];
        const lostItem = target.item;
        const targetIdx = target.index;
        const targetSource = target.source;

        // ทำลายไอเทมในช่องนั้นทิ้งทั้งหมด (1 ช่อง)
        if (targetSource === "inventory") {
          inventory[targetIdx] = null;
        } else if (targetSource === "action") {
          actionSlotsItems[targetIdx] = null;
          if (typeof selectedActionSlotIndex !== "undefined" && selectedActionSlotIndex === targetIdx) {
            selectedActionSlotIndex = -1;
          }
        }

        // ยกเลิกการเลือกช่องถ้ากำลังเลือกช่องที่ถูกทำลาย
        if (window.selectedInventorySlot && window.selectedInventorySlot.source === targetSource && window.selectedInventorySlot.index === targetIdx) {
          window.selectedInventorySlot = null;
        }

        // รีเฟรช UI และบันทึกข้อมูล
        if (typeof renderInventory === "function") renderInventory();
        if (typeof renderActionSlots === "function") renderActionSlots();
        if (typeof updateBadge === "function") updateBadge();
        if (typeof updateSelectedSlotVisuals === "function") updateSelectedSlotVisuals();
        if (typeof updateBottomButtonsState === "function") updateBottomButtonsState();
        if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();

        // เล่นเสียงแจ้งเตือนการทำลาย / การกระแทก
        if (typeof playRockHitSound === "function") {
          playRockHitSound();
        }

        // แสดงข้อความแจ้งเตือนบทลงโทษ
        const rawName = lostItem.name || lostItem.label || lostItem.type || "ITEM";
        const itemDispName = (typeof getItemDisplayName === "function")
          ? getItemDisplayName(rawName)
          : (lostItem.label || rawName);
        const countStr = (lostItem.count && lostItem.count > 1) ? ` x${lostItem.count}` : "";
        const iconStr = lostItem.icon ? `${lostItem.icon} ` : "";
        const locationText = (targetSource === "inventory")
          ? (isEn ? "in bag" : "ในกระเป๋า")
          : (isEn ? "on hotbar" : "ในช่องคีย์ลัด");

        const penaltyNotice = isEn
          ? `💀 Unconscious! Randomly destroyed ${iconStr}[${itemDispName}${countStr}] ${locationText} (1 slot)!`
          : `💀 คุณหมดสติ! สุ่มทำลาย ${iconStr}[${itemDispName}${countStr}] ${locationText} 1 ช่อง!`;

        if (typeof showNotice === "function") {
          showNotice(penaltyNotice);
        }

        console.log(`[Penalty] Player became unconscious. Destroyed 1 slot (${targetSource} #${targetIdx}):`, lostItem);
        return { lostItem, slotIndex: targetIdx, source: targetSource };
      }
      window.destroyRandomInventorySlotOnUnconscious = destroyRandomInventorySlotOnUnconscious;



