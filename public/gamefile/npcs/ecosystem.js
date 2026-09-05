// === SEEDPLANET MODULE: JS/NPCS/ECOSYSTEM.JS ===
// Multi-Planet AI Life-Cycle Ecosystem & Dialogue Management System
// Simulates persistent living populations across all 5 extra procedural planets
// and manages NPC life-cycle states (Energy, Hunger, Daily Schedules, and Dialogue)

(function() {
  const TRIBAL_NAMES = [
    "Kaelen", "Elora", "Taran", "Sari", "Rolan", "Lyra", "Vael", "Thorne",
    "Boran", "Zephyr", "Aria", "Daren", "Mira", "Orin", "Kael", "Nyra"
  ];

  const TRIBAL_ROLES = [
    { title: "นักล่าพสุธา (Earth Hunter)", icon: "🏹", prefSchedule: "FORAGING" },
    { title: "ผู้เก็บเกี่ยวสมุนไพร (Herb Gatherer)", icon: "🌿", prefSchedule: "FORAGING" },
    { title: "ช่างสร้างและงานไม้ (Wood Craftsman)", icon: "🔨", prefSchedule: "WANDERING" },
    { title: "ผู้พิทักษ์เผ่า (Tribe Guardian)", icon: "🛡️", prefSchedule: "WANDERING" },
    { title: "นักสำรวจถ้ำ (Cave Explorer)", icon: "🧭", prefSchedule: "WANDERING" },
    { title: "ผู้ดูแลแคมป์ไฟ (Fire Keeper)", icon: "🔥", prefSchedule: "COOKING" }
  ];

  function getHumanNpcName(seed = 0) {
    const idx = Math.floor(Math.abs(Math.sin(seed * 999.123)) * TRIBAL_NAMES.length) % TRIBAL_NAMES.length;
    return TRIBAL_NAMES[idx];
  }

  function getHumanNpcRole(seed = 0) {
    const idx = Math.floor(Math.abs(Math.sin(seed * 444.789)) * TRIBAL_ROLES.length) % TRIBAL_ROLES.length;
    return TRIBAL_ROLES[idx];
  }

  // --- Planetary Biome Species Definition for the 5 Extra Planets ---
  const EXTRA_PLANET_SPECIES_DEFS = [
    {
      biomeName: "ทุ่งน้ำแข็งเยือกแข็ง (Glacial Tundra)",
      species: [
        { type: "cryo_isopod", name: "ไอโซพอดน้ำแข็ง (Cryo Isopod)", icon: "❄️", speed: 0.04 },
        { type: "arctic_meganeura", name: "แมลงปอหิมะ (Frost Meganeura)", icon: "🧊", speed: 0.12 },
        { type: "ice_stalker", name: "สิ่งมีชีวิตขั้วโลก (Polar Stalker)", icon: "🐺", speed: 0.08 }
      ]
    },
    {
      biomeName: "ธารลาวาอัคนี (Volcanic Molten)",
      species: [
        { type: "magma_beetle", name: "ด้วงลาวาเกราะหนา (Magma Beetle)", icon: "🔥", speed: 0.05 },
        { type: "pyro_lizard", name: "กิ้งก่าเพลิงใต้พิภพ (Pyro Salamander)", icon: "🦎", speed: 0.09 },
        { type: "ash_strider", name: "ผู้ท่องเถ้าภูเขาไฟ (Ash Strider)", icon: "🌋", speed: 0.06 }
      ]
    },
    {
      biomeName: "ทะเลทรายทองคำ (Golden Dunes)",
      species: [
        { type: "dune_isopod", name: "ไอโซพอดทราย (Dune Scarab)", icon: "🦂", speed: 0.05 },
        { type: "desert_wanderer", name: "ผู้พเนจรแห่งผืนทราย (Nomad Strider)", icon: "🐪", speed: 0.07 },
        { type: "mirage_flyer", name: "วิหคมายาสีทราย (Mirage Flyer)", icon: "🦅", speed: 0.14 }
      ]
    },
    {
      biomeName: "มหาสมุทรดึกดำบรรพ์ (Primordial Ocean)",
      species: [
        { type: "abyssal_placoderm", name: "พลาโคเดิร์มน้ำลึก (Abyssal Placoderm)", icon: "🐟", speed: 0.18 },
        { type: "deep_georgiacetus", name: "จอร์เจียซีตัสทะเลลึก (Deep Georgiacetus)", icon: "🐋", speed: 0.22 },
        { type: "luminescent_jelly", name: "แมงกะพรุนเรืองแสง (Bio Jelly)", icon: "🪼", speed: 0.08 }
      ]
    },
    {
      biomeName: "ป่าเอเลี่ยนสปอร์ (Bioluminescent Xenoflora)",
      species: [
        { type: "spore_mantis", name: "ตั๊กแตนสปอร์เรืองแสง (Spore Mantis)", icon: "🦗", speed: 0.09 },
        { type: "xenomorph_isopod", name: "ไอโซพอดต่างดาว (Xeno Crawler)", icon: "👽", speed: 0.06 },
        { type: "nebula_moth", name: "ผีเสื้อเนบิวลา (Nebula Moth)", icon: "🦋", speed: 0.15 }
      ]
    }
  ];

  const ExtraPlanetsEcosystem = {
    planets: [],
    tickAccumulator: 0,
    initialized: false,

    init: function(seed = 12345) {
      this.planets = [];
      for (let pIdx = 0; pIdx < 5; pIdx++) {
        const def = EXTRA_PLANET_SPECIES_DEFS[pIdx % EXTRA_PLANET_SPECIES_DEFS.length];
        const planetSeed = seed + (pIdx + 1) * 7777;
        const popCount = 10 + Math.floor(Math.abs(Math.sin(planetSeed)) * 6); // 10-15 creatures
        const inhabitants = [];

        for (let i = 0; i < popCount; i++) {
          const specIdx = i % def.species.length;
          const spec = def.species[specIdx];
          const cSeed = planetSeed + i * 123;
          inhabitants.push({
            id: `p${pIdx}_npc_${i}`,
            type: spec.type,
            name: spec.name,
            icon: spec.icon,
            theta: Math.abs(Math.sin(cSeed * 1.7)) * Math.PI,
            phi: (Math.abs(Math.cos(cSeed * 2.3)) * Math.PI * 2),
            heading: Math.abs(Math.sin(cSeed * 3.1)) * Math.PI * 2,
            speed: spec.speed,
            energy: 60 + Math.floor(Math.abs(Math.sin(cSeed * 4.9)) * 40),
            hunger: 20 + Math.floor(Math.abs(Math.cos(cSeed * 5.7)) * 40),
            schedule: (i % 3 === 0) ? "FORAGING" : (i % 3 === 1 ? "WANDERING" : "RESTING"),
            scheduleTimer: 10 + (cSeed % 20),
          });
        }

        this.planets.push({
          planetIndex: pIdx,
          biomeName: def.biomeName,
          populationCount: popCount,
          speciesList: def.species,
          inhabitants: inhabitants,
          lastActivitySummary: "ประชากรกำลังออกหากินและปรับตัวตามสภาพแวดล้อม"
        });
      }
      this.initialized = true;
      console.log("🌌 ExtraPlanetsEcosystem: จำลองระบบนิเวศ 5 ดาวเคราะห์เสร็จสมบูรณ์ (AI Life-Cycle Background Active)");
    },

    tick: function(deltaTime) {
      if (!this.initialized || !this.planets || this.planets.length === 0) return;

      this.tickAccumulator += deltaTime;
      // Tick every 3.0 seconds to keep CPU footprint near 0.001ms while maintaining living worlds
      if (this.tickAccumulator < 3.0) return;
      const stepDt = this.tickAccumulator;
      this.tickAccumulator = 0;

      for (let p of this.planets) {
        let foragingCount = 0;
        let restingCount = 0;
        let wanderingCount = 0;

        for (let creature of p.inhabitants) {
          creature.scheduleTimer -= stepDt;

          // Energy & Hunger dynamics
          if (creature.schedule === "RESTING") {
            creature.energy = Math.min(100, creature.energy + stepDt * 4.0);
            creature.hunger = Math.min(100, creature.hunger + stepDt * 0.4);
            restingCount++;
            if (creature.energy >= 90 || creature.scheduleTimer <= 0) {
              creature.schedule = creature.hunger > 60 ? "FORAGING" : "WANDERING";
              creature.scheduleTimer = 20 + Math.random() * 20;
            }
          } else if (creature.schedule === "FORAGING") {
            creature.energy = Math.max(0, creature.energy - stepDt * 0.6);
            creature.hunger = Math.max(0, creature.hunger - stepDt * 2.0);
            foragingCount++;
            if (creature.hunger <= 15 || creature.energy < 20 || creature.scheduleTimer <= 0) {
              creature.schedule = creature.energy < 20 ? "RESTING" : "WANDERING";
              creature.scheduleTimer = 20 + Math.random() * 20;
            }
          } else {
            // WANDERING / EXPLORING
            creature.energy = Math.max(0, creature.energy - stepDt * 0.8);
            creature.hunger = Math.min(100, creature.hunger + stepDt * 0.5);
            wanderingCount++;

            // Move across extra planet surface using spherical drift
            creature.heading += (Math.random() - 0.5) * 0.6;
            const dStep = creature.speed * stepDt * 0.15;
            creature.theta = Math.max(0.05, Math.min(Math.PI - 0.05, creature.theta + Math.cos(creature.heading) * dStep));
            creature.phi = (creature.phi + Math.sin(creature.heading) * dStep + Math.PI * 2) % (Math.PI * 2);

            if (creature.energy < 25) {
              creature.schedule = "RESTING";
              creature.scheduleTimer = 25 + Math.random() * 15;
            } else if (creature.hunger > 70) {
              creature.schedule = "FORAGING";
              creature.scheduleTimer = 25 + Math.random() * 15;
            }
          }
        }

        p.lastActivitySummary = `กำลังหากิน: ${foragingCount} | พักผ่อน: ${restingCount} | สำรวจ: ${wanderingCount}`;
      }
    },

    getPlanetReport: function(planetIdx) {
      if (!this.planets || !this.planets[planetIdx]) return null;
      return this.planets[planetIdx];
    },

    getAllPopulations: function() {
      return this.planets.map(p => ({
        index: p.planetIndex,
        biome: p.biomeName,
        population: p.populationCount,
        status: p.lastActivitySummary
      }));
    }
  };

  // --- Dialogue Generation for Human NPCs ---
  function getNpcDialogue(npc) {
    const role = npc.npcRole ? npc.npcRole.title : "ชาวเผ่าพสุธา";
    const name = npc.npcName || "สหาย";
    const schedule = npc.lifeSchedule || "WANDERING";
    const energy = Math.round(npc.energy !== undefined ? npc.energy : 80);

    const dialogues = {
      COOKING: [
        `"กลิ่นอาหารย่างหอมชวนน้ำลายสอจริงเชียว มาผิงไฟอุ่นๆ ด้วยกันสิสหาย ${name} กล่าว"`,
        `"ไฟนี้ช่วยปกป้องพวกเราจากความมืดและสัตว์ร้ายยามค่ำคืน นั่งพักข้างกองไฟก่อนสิ"`,
        `"การปรุงอาหารช่วยเพิ่มพลังชีวิตได้ดีมาก เจ้าพกอาหารติดตัวไว้บ้างหรือยัง?"`
      ],
      FORAGING: [
        `"แถวนี้มีทั้งผลไม้ป่าและเปลือกไม้ที่นำไปทำสิ่งของได้ ข้ากำลังสำรวจหาเสบียงเพิ่มอยู่พอดี"`,
        `"ถ้าเจ้าสังเกตดีๆ ริมชายฝั่งมักมีไอโซพอดและปลาดึกดำบรรพ์ว่ายน้ำอยู่เสมอ"`,
        `"สมุนไพรและพืชพันธุ์บนดาวดวงนี้เติบโตตามแสงแดดและผืนน้ำ หากินช่วงกลางวันปลอดภัยที่สุด"`
      ],
      RESTING: [
        `"ฮู่ว... ข้าเดินทางสำรวจมาทั้งวัน ขอแวะพักผ่อนใต้ร่มไม้นี้สักครู่ ลมพัดเย็นสบายจริงๆ"`,
        `"ยามพลังงานใกล้หมด การหยุดพักสักครู่จะช่วยฟื้นกำลังวังชาให้พร้อมออกเดินทางต่อ"`,
        `"สวัสดีสหาย ${name}... ข้ากำลังซึมซับเสียงคลื่นและสายลมแห่งดาวพสุธา"`
      ],
      SLEEPING: [
        `"Zzz... ท้องฟ้ายามราตรีช่างเงียบสงบ... (กำลังหลับสบาย)"`,
        `"(กำลังพักผ่อนอย่างเงียบสงบเพื่อฟื้นฟูพลังงานเต็มเปี่ยม)"`
      ],
      SOCIALIZING: [
        `"ยินดีที่ได้พบกัน! เผ่าของเราสร้างบ้านเรือนและแบ่งปันอาหารกันอย่างสงบสุข"`,
        `"พวกเราต่างช่วยกันดูแลดาวดวงนี้ หากเจ้าต้องการสร้างสิ่งใด ลองรวบรวมท่อนไม้และหินดูสิ"`,
        `"การร่วมมือกันทำให้การอยู่รอดบนดาวดวงนี้ง่ายขึ้นมาก เจ้าเป็นมิตรที่ดีของเรา"`
      ],
      WANDERING: [
        `"สวัสดีนักเดินทาง! ข้าคือ ${name} (${role}) เจ้าพบเห็นสิ่งอัศจรรย์ใดบนดาวดวงนี้บ้างรึยัง?"`,
        `"ระวังตัวด้วยนะ บนท้องฟ้าบางครั้งมีแมลงปอยักษ์บินโฉบลงมา หากมีธนูหรืออาวุธจะช่วยได้มาก"`,
        `"ใต้พื้นดินลึกลงไปมีถ้ำและแร่ธาตุเรืองแสง หากมีคบเพลิงจะช่วยนำทางเจ้าได้ดีทีเดียว"`
      ]
    };

    const pool = dialogues[schedule] || dialogues.WANDERING;
    const line = pool[Math.floor(Math.random() * pool.length)];
    return { name, role, schedule, energy, line };
  }

  // --- Dynamic Dialogue Modal UI ---
  let dialogueModal = null;

  function ensureDialogueModal() {
    if (dialogueModal) return dialogueModal;
    dialogueModal = document.createElement("div");
    dialogueModal.id = "npc-dialogue-modal";
    dialogueModal.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      width: min(92vw, 480px);
      background: rgba(14, 18, 27, 0.94);
      border: 1px solid rgba(74, 222, 128, 0.4);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(74, 222, 128, 0.15);
      border-radius: 14px;
      padding: 18px 22px;
      color: #f1f5f9;
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 100000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s ease;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    `;
    document.body.appendChild(dialogueModal);
    return dialogueModal;
  }

  function showNpcDialogue(npc) {
    if (!npc || npc.ragdollEnabled) return;
    const modal = ensureDialogueModal();
    const data = getNpcDialogue(npc);

    const scheduleLabels = {
      COOKING: { text: "กำลังปรุงอาหาร (Cooking)", color: "#f97316", icon: "🍖" },
      FORAGING: { text: "กำลังหาอาหาร (Foraging)", color: "#10b981", icon: "🌿" },
      RESTING: { text: "กำลังพักผ่อน (Resting)", color: "#38bdf8", icon: "💤" },
      SLEEPING: { text: "กำลังหลับ (Sleeping)", color: "#818cf8", icon: "🌙" },
      SOCIALIZING: { text: "กำลังสนทนากับเพื่อน (Socializing)", color: "#ec4899", icon: "👥" },
      WANDERING: { text: "กำลังสำรวจพื้นที่ (Exploring)", color: "#fbbf24", icon: "🚶" }
    };

    const sInfo = scheduleLabels[data.schedule] || scheduleLabels.WANDERING;

    modal.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #10b981, #0284c7); display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">
            🧑
          </div>
          <div>
            <div style="font-weight: 700; font-size: 16px; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
              ${data.name}
              <span style="font-size: 11px; font-weight: 500; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 2px 8px; border-radius: 12px;">${data.role}</span>
            </div>
            <div style="font-size: 12px; color: ${sInfo.color}; display: flex; align-items: center; gap: 4px; margin-top: 2px;">
              <span>${sInfo.icon}</span>
              <span>${sInfo.text}</span>
            </div>
          </div>
        </div>
        <button id="npc-dialogue-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: color 0.15s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#94a3b8'">✕</button>
      </div>

      <!-- Life-Cycle Status Bars -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; font-size: 11px;">
        <div style="background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #94a3b8;">
            <span>⚡ พลังงาน (Energy)</span>
            <span style="color: #38bdf8; font-weight: 600;">${data.energy}%</span>
          </div>
          <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
            <div style="height: 100%; width: ${Math.max(5, data.energy)}%; background: linear-gradient(90deg, #0284c7, #38bdf8); border-radius: 2px;"></div>
          </div>
        </div>
        <div style="background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #94a3b8;">
            <span>❤️ พลังชีวิต (HP)</span>
            <span style="color: #4ade80; font-weight: 600;">${npc.hp || 10}/${npc.maxHp || 10}</span>
          </div>
          <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
            <div style="height: 100%; width: ${Math.round(((npc.hp || 10) / (npc.maxHp || 10)) * 100)}%; background: linear-gradient(90deg, #15803d, #4ade80); border-radius: 2px;"></div>
          </div>
        </div>
      </div>

      <!-- Dialogue Content -->
      <div id="npc-dialogue-text" style="background: rgba(0,0,0,0.25); border-left: 3px solid #10b981; padding: 10px 14px; border-radius: 0 8px 8px 0; font-size: 13.5px; line-height: 1.55; color: #e2e8f0; margin-bottom: 14px; font-style: italic;">
        ${data.line}
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="npc-dialogue-gift-btn" style="background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); color: #6ee7b7; padding: 6px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: background 0.15s;" onmouseover="this.style.background='rgba(16, 185, 129, 0.3)'" onmouseout="this.style.background='rgba(16, 185, 129, 0.2)'">
          <span>🍎</span> มอบเสบียง (Gift Food)
        </button>
        <button id="npc-dialogue-talk-btn" style="background: rgba(56, 189, 248, 0.2); border: 1px solid rgba(56, 189, 248, 0.4); color: #7dd3fc; padding: 6px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: background 0.15s;" onmouseover="this.style.background='rgba(56, 189, 248, 0.3)'" onmouseout="this.style.background='rgba(56, 189, 248, 0.2)'">
          <span>💬</span> สนทนาต่อ (Inquire)
        </button>
      </div>
    `;

    modal.style.opacity = "1";
    modal.style.pointerEvents = "auto";
    modal.style.transform = "translateX(-50%) translateY(0)";

    // Wire up events
    const closeBtn = document.getElementById("npc-dialogue-close-btn");
    if (closeBtn) {
      closeBtn.onclick = () => hideNpcDialogue();
    }

    const talkBtn = document.getElementById("npc-dialogue-talk-btn");
    if (talkBtn) {
      talkBtn.onclick = () => {
        const freshData = getNpcDialogue(npc);
        const textElem = document.getElementById("npc-dialogue-text");
        if (textElem) {
          textElem.textContent = freshData.line;
        }
      };
    }

    const giftBtn = document.getElementById("npc-dialogue-gift-btn");
    if (giftBtn) {
      giftBtn.onclick = () => {
        // Attempt to find food in inventory
        let fed = false;
        if (typeof inventory !== "undefined" && Array.isArray(inventory)) {
          const foodItem = inventory.find(it => it && (it.name === "FRIED_BUG" || it.name === "BERRY" || it.name === "ISOPOD" || it.name === "FISH"));
          if (foodItem) {
            foodItem.count--;
            if (foodItem.count <= 0) {
              const idx = inventory.indexOf(foodItem);
              if (idx !== -1) inventory.splice(idx, 1);
            }
            if (typeof updateInventoryUI === "function") updateInventoryUI();
            fed = true;
          }
        }

        const textElem = document.getElementById("npc-dialogue-text");
        if (fed) {
          npc.energy = Math.min(100, (npc.energy || 50) + 40);
          npc.hunger = Math.max(0, (npc.hunger || 50) - 50);
          if (textElem) {
            textElem.innerHTML = `<span style="color: #4ade80; font-weight: bold;">"ขอบน้ำใจเจ้ามากสหาย! อาหารมื้อนี้ช่วยเติมพลังให้ข้าได้มากจริง!"</span>`;
          }
        } else {
          if (textElem) {
            textElem.innerHTML = `<span style="color: #fbbf24;">"เจ้ายังไม่มีเสบียงอาหารติดตัวเลย แต่แค่น้ำใจของเจ้า ข้าก็ซาบซึ้งใจแล้ว"</span>`;
          }
        }
      };
    }
  }

  function hideNpcDialogue() {
    if (dialogueModal) {
      dialogueModal.style.opacity = "0";
      dialogueModal.style.pointerEvents = "none";
      dialogueModal.style.transform = "translateX(-50%) translateY(20px)";
    }
  }

  window.ExtraPlanetsEcosystem = ExtraPlanetsEcosystem;
  window.getHumanNpcName = getHumanNpcName;
  window.getHumanNpcRole = getHumanNpcRole;
  window.getNpcDialogue = getNpcDialogue;
  window.showNpcDialogue = showNpcDialogue;
  window.hideNpcDialogue = hideNpcDialogue;
})();
