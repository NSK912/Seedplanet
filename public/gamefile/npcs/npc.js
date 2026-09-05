// === SEEDPLANET MODULE: JS/NPC.JS ===

// Persistent reusable geometry arrays to eliminate GC garbage spikes completely
const _allNpcVertices = [];
const _allNpcColors = [];
const _allNpcIndices = [];

function calculatePlanetNpcCount(radius) {
  const r = typeof radius === 'number' ? radius : (typeof RADIUS !== 'undefined' ? RADIUS : 8.0);
  // Scales smoothly with sphere surface area:
  // r = 4  => 8 NPCs (minimum to ensure full species diversity + human group)
  // r = 6  => 11 NPCs
  // r = 8  => 16 NPCs (standard planet baseline)
  // r = 12 => 28 NPCs
  // r = 16 => 40 NPCs
  // r = 24 => 68 NPCs
  // r = 32 => max 72 NPCs (performance safe-guard)
  const ratio = Math.pow(r / 8.0, 1.35);
  return Math.min(72, Math.max(8, Math.round(16 * ratio)));
}
window.calculatePlanetNpcCount = calculatePlanetNpcCount;

function initAmphibians(count, seed) { 
  amphibians = []; 
  if (window.DISABLE_NPCS) return;

  // Initialize the 5-planet living background ecosystem
  if (window.ExtraPlanetsEcosystem && typeof window.ExtraPlanetsEcosystem.init === "function") {
    window.ExtraPlanetsEcosystem.init(seed);
  }

  const planetRadius = typeof RADIUS !== 'undefined' ? RADIUS : 8.0;
  if (!count || count <= 0) {
    count = calculatePlanetNpcCount(planetRadius);
  }

  const _origRandom = Math.random;
  Math.random = mulberry32(seed);

  amphibians = [];
  const effectiveWaterH = (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15);
  const rRatio = Math.max(0.5, planetRadius / 8.0);

  // Helper to find a suitable coordinate on the planet sphere
  function findSpawnCoordinate(preferType) {
    // preferType: 'water', 'land', or 'any'
    let bestTheta = Math.random() * Math.PI;
    let bestPhi = Math.random() * Math.PI * 2;
    let bestH = getHeightOnSphere(bestTheta, bestPhi, seed);
    let bestIsLand = (bestH * HEIGHT_SCALE > effectiveWaterH);

    if (preferType === 'any') {
      return { theta: bestTheta, phi: bestPhi, height: bestH, isLand: bestIsLand };
    }

    const wantLand = (preferType === 'land');
    if (bestIsLand === wantLand) {
      return { theta: bestTheta, phi: bestPhi, height: bestH, isLand: bestIsLand };
    }

    // Try up to 40 attempts to find desired terrain type
    for (let attempt = 0; attempt < 40; attempt++) {
      const t = Math.random() * Math.PI;
      const p = Math.random() * Math.PI * 2;
      const h = getHeightOnSphere(t, p, seed);
      const isL = (h * HEIGHT_SCALE > effectiveWaterH);
      if (isL === wantLand) {
        return { theta: t, phi: p, height: h, isLand: isL };
      }
    }

    // If planet is 100% water or 100% land, fallback to best available
    return { theta: bestTheta, phi: bestPhi, height: bestH, isLand: bestIsLand };
  }

  function spawnNpcOfType(type) {
    if (amphibians.length >= count) return 0;

    if (type === 'human') {
      // Humans prefer land and spawn in cohesive groups (2, or 3 if slots permit)
      const coord = findSpawnCoordinate('land');
      const maxHp = (window.NpcRegistry && window.NpcRegistry['human']) ? window.NpcRegistry['human'].maxHp : 1;
      const remainingSlots = count - amphibians.length;
      if (remainingSlots <= 0) return 0;
      
      const groupSize = (remainingSlots >= 3 && Math.random() < 0.35) ? 3 : (remainingSlots >= 2 ? 2 : 1);
      
      for (let j = 0; j < groupSize; j++) {
        let offsetTheta = coord.theta;
        let offsetPhi = coord.phi;
        if (j > 0) {
          offsetTheta += (Math.random() - 0.5) * (0.04 / rRatio);
          offsetPhi += (Math.random() - 0.5) * (0.04 / rRatio);
        }
        const oHeight = getHeightOnSphere(offsetTheta, offsetPhi, seed);
        const oR = RADIUS + Math.max(oHeight * HEIGHT_SCALE, effectiveWaterH) + 0.05 + Math.random() * 0.04;
        
        const hSeed = Math.random();
        amphibians.push({
          type: 'human',
          theta: offsetTheta,
          phi: offsetPhi,
          r: oR,
          heading: Math.random() * Math.PI * 2,
          animPhase: Math.random() * Math.PI * 2,
          ragdollEnabled: false,
          ragdollInitialized: false,
          ragdollAxis: [0, 1, 0],
          ragdollAngle: 0,
          ragdollAngularSpeed: 0,
          isSwimming: false,
          seed: hSeed,
          hp: maxHp,
          maxHp: maxHp,
          energy: 75 + Math.random() * 25,
          hunger: 15 + Math.random() * 25,
          lifeSchedule: Math.random() < 0.35 ? 'FORAGING' : (Math.random() < 0.7 ? 'WANDERING' : 'SOCIALIZING'),
          scheduleTimer: 15 + Math.random() * 25,
          npcName: (typeof getHumanNpcName === "function") ? getHumanNpcName(hSeed * 1000) : "Tribe Member",
          npcRole: (typeof getHumanNpcRole === "function") ? getHumanNpcRole(hSeed * 1000) : { title: "ชาวเผ่าพสุธา", icon: "🏹" },
          lodLevel: 0,
        });
      }
      return groupSize;
    } else {
      const isGeorgiacetus = (type === 'georgiacetus');
      const isPlacoderm = (type === 'placoderm');
      const isMeganeura = (type === 'meganeura');
      const isIsopod = (type === 'isopod');

      // Georgiacetus and Placoderm strictly prefer ocean water; Isopod/Meganeura can be anywhere
      const pref = (isGeorgiacetus || isPlacoderm) ? 'water' : 'any';
      const coord = findSpawnCoordinate(pref);

      const maxHp = (window.NpcRegistry && window.NpcRegistry[type]) ? window.NpcRegistry[type].maxHp : 1;
      let spawnR;
      let swimming = false;

      if (isMeganeura) {
        // Flying dragonfly hovering gracefully over land and water
        const surfaceR = RADIUS + Math.max(coord.height * HEIGHT_SCALE, effectiveWaterH);
        spawnR = surfaceR + 0.35 + Math.random() * 0.15;
        swimming = false;
      } else if (isIsopod) {
        // Giant isopod crawling on ground or seabed
        spawnR = RADIUS + coord.height * HEIGHT_SCALE + 0.02;
        swimming = !coord.isLand;
      } else if (isGeorgiacetus || isPlacoderm) {
        // Prehistoric marine animals swimming in ocean, or crawling along shore if planet is dry
        if (!coord.isLand) {
          spawnR = RADIUS + Math.max(coord.height * HEIGHT_SCALE, effectiveWaterH - 0.04) + 0.04;
          swimming = true;
        } else {
          spawnR = RADIUS + coord.height * HEIGHT_SCALE + 0.05;
          swimming = false;
        }
      } else {
        spawnR = RADIUS + Math.max(coord.height * HEIGHT_SCALE, effectiveWaterH) + 0.05;
        swimming = !coord.isLand;
      }

      const aSeed = Math.random();
      amphibians.push({
        type: type,
        theta: coord.theta,
        phi: coord.phi,
        r: spawnR,
        heading: Math.random() * Math.PI * 2,
        animPhase: Math.random() * Math.PI * 2,
        ragdollEnabled: false,
        ragdollInitialized: false,
        ragdollAxis: [0, 1, 0],
        ragdollAngle: 0,
        ragdollAngularSpeed: 0,
        isSwimming: swimming,
        seed: aSeed,
        hp: maxHp,
        maxHp: maxHp,
        energy: 70 + Math.random() * 30,
        hunger: 20 + Math.random() * 30,
        lifeSchedule: Math.random() < 0.5 ? 'FORAGING' : 'WANDERING',
        scheduleTimer: 15 + Math.random() * 25,
        lodLevel: 0,
      });
      return 1;
    }
  }

  // 1. GUARANTEED PHASE: Ensure every single known NPC type is guaranteed to spawn!
  const knownTypes = ['human', 'georgiacetus', 'placoderm', 'meganeura', 'isopod'];
  if (window.NpcRegistry) {
    for (const k in window.NpcRegistry) {
      if (!knownTypes.includes(k)) knownTypes.push(k);
    }
  }

  // Spawn each registered species at least once (humans spawn as a pair)
  for (const t of knownTypes) {
    if (amphibians.length < count) {
      spawnNpcOfType(t);
    }
  }

  // 2. PROPORTIONAL FILL PHASE:
  // Distribute remaining slots smoothly across all types in a balanced rotation
  let typeIdx = 0;
  while (amphibians.length < count) {
    const t = knownTypes[typeIdx % knownTypes.length];
    spawnNpcOfType(t);
    typeIdx++;
  }

  Math.random = _origRandom;

  if (
    savedAmphibiansState &&
    savedAmphibiansState.length === amphibians.length
  ) {
    for (let i = 0; i < amphibians.length; i++) {
      if (savedAmphibiansState[i].type === amphibians[i].type || !savedAmphibiansState[i].type) {
        Object.assign(amphibians[i], savedAmphibiansState[i]);
      }
      if (amphibians[i].hp === undefined) {
        const type = amphibians[i].type;
        const maxHp = window.NpcRegistry[type] ? window.NpcRegistry[type].maxHp : 1;
        amphibians[i].hp = maxHp;
        amphibians[i].maxHp = maxHp;
      }
    }
  }
}

// === NPC Life-Cycle Simulation State Machine ===
// Simulates daily schedule, energy recovery, hunger and social behavior
function updateNpcLifeCycle(c, deltaTime, seed) {
  if (c.energy === undefined) c.energy = 80;
  if (c.hunger === undefined) c.hunger = 20;
  if (c.lifeSchedule === undefined) c.lifeSchedule = (c.type === 'human') ? 'WANDERING' : (Math.random() < 0.5 ? 'FORAGING' : 'WANDERING');
  if (c.scheduleTimer === undefined) c.scheduleTimer = 15 + Math.random() * 20;

  c.scheduleTimer -= deltaTime;

  // Check if human NPC is resting near a campfire
  let isNearCampfire = false;
  if (c.type === 'human' && typeof SpatialGrid !== "undefined" && SpatialGrid.queryRadius) {
    const nearby = SpatialGrid.queryRadius(c.position || [0, 0, 0], 2.5);
    if (nearby && nearby.some(it => it.type === 'campfire' || it.name === 'CAMPFIRE')) {
      isNearCampfire = true;
    }
  }

  if (isNearCampfire && c.lifeSchedule !== 'SLEEPING' && c.energy < 70) {
    c.lifeSchedule = 'COOKING';
  }

  switch (c.lifeSchedule) {
    case 'SLEEPING':
      c.energy = Math.min(100, c.energy + deltaTime * 4.0);
      c.hunger = Math.min(100, c.hunger + deltaTime * 0.25);
      c.walkBlend = Math.max(0, (c.walkBlend || 0) - deltaTime * 3.0);
      c.isIdle = true;
      if (c.energy >= 95 && c.scheduleTimer <= 0) {
        c.lifeSchedule = c.hunger > 60 ? 'FORAGING' : 'WANDERING';
        c.scheduleTimer = 25 + Math.random() * 20;
      }
      break;

    case 'RESTING':
      c.energy = Math.min(100, c.energy + deltaTime * 3.0);
      c.hunger = Math.min(100, c.hunger + deltaTime * 0.3);
      c.walkBlend = Math.max(0, (c.walkBlend || 0) - deltaTime * 2.0);
      c.isIdle = true;
      if (c.energy >= 85 && c.scheduleTimer <= 0) {
        c.lifeSchedule = c.hunger > 60 ? 'FORAGING' : 'WANDERING';
        c.scheduleTimer = 20 + Math.random() * 25;
      }
      break;

    case 'COOKING':
      c.energy = Math.min(100, c.energy + deltaTime * 1.5);
      c.hunger = Math.max(0, c.hunger - deltaTime * 2.5);
      c.walkBlend = Math.max(0, (c.walkBlend || 0) - deltaTime * 2.0);
      c.isIdle = true;
      if (c.hunger <= 10 || c.scheduleTimer <= 0) {
        c.lifeSchedule = 'WANDERING';
        c.scheduleTimer = 30 + Math.random() * 20;
      }
      break;

    case 'FORAGING':
      c.energy = Math.max(0, c.energy - deltaTime * 0.5);
      c.hunger = Math.max(0, c.hunger - deltaTime * 1.8);
      if (c.hunger <= 10) {
        c.lifeSchedule = 'WANDERING';
        c.scheduleTimer = 30 + Math.random() * 20;
      } else if (c.energy < 18) {
        c.lifeSchedule = 'RESTING';
        c.scheduleTimer = 20 + Math.random() * 15;
      }
      break;

    case 'SOCIALIZING':
      c.energy = Math.max(0, c.energy - deltaTime * 0.4);
      c.hunger = Math.min(100, c.hunger + deltaTime * 0.35);
      if (c.scheduleTimer <= 0) {
        c.lifeSchedule = 'WANDERING';
        c.scheduleTimer = 25 + Math.random() * 20;
      }
      break;

    case 'WANDERING':
    default:
      c.energy = Math.max(0, c.energy - deltaTime * 0.7);
      c.hunger = Math.min(100, c.hunger + deltaTime * 0.4);
      if (c.energy < 18) {
        c.lifeSchedule = 'RESTING';
        c.scheduleTimer = 25 + Math.random() * 15;
      } else if (c.hunger > 70) {
        c.lifeSchedule = 'FORAGING';
        c.scheduleTimer = 25 + Math.random() * 15;
      } else if (c.scheduleTimer <= 0) {
        if (c.type === 'human' && Math.random() < 0.3) {
          c.lifeSchedule = 'SOCIALIZING';
          c.scheduleTimer = 15 + Math.random() * 15;
        } else {
          c.lifeSchedule = Math.random() < 0.4 ? 'FORAGING' : 'WANDERING';
          c.scheduleTimer = 20 + Math.random() * 20;
        }
      }
      break;
  }
}

function updateAmphibians(deltaTime, seed) {
  if (!amphibians || amphibians.length === 0) return;

  // Background life simulation tick for the 5 extra planets
  if (window.ExtraPlanetsEcosystem && typeof window.ExtraPlanetsEcosystem.tick === "function") {
    window.ExtraPlanetsEcosystem.tick(deltaTime);
  }

  if (playerDamageCooldown > 0) {
    playerDamageCooldown -= deltaTime;
  }

  // Calculate player position in 3D space
  const sinT_player = Math.sin(charTheta);
  const cosT_player = Math.cos(charTheta);
  const sinP_player = Math.sin(charPhi);
  const cosP_player = Math.cos(charPhi);
  const player_nx = sinT_player * cosP_player;
  const player_ny = cosT_player;
  const player_nz = sinT_player * sinP_player;
  const player_h = getHeightOnSphere(charTheta, charPhi, seed);
  const player_r = RADIUS + player_h * HEIGHT_SCALE;
  const player_pos = [player_r * player_nx, player_r * player_ny, player_r * player_nz];

  const isRenderDistOn = (typeof renderDistEnabled !== "undefined"
    ? renderDistEnabled
    : (typeof window !== "undefined" && typeof window.renderDistEnabled !== "undefined" ? window.renderDistEnabled : true));
  const curObjectDist = typeof objectRenderDistValue !== "undefined"
    ? objectRenderDistValue
    : (typeof window !== "undefined" && typeof window.objectRenderDistValue !== "undefined"
      ? window.objectRenderDistValue
      : (typeof renderDistValue !== "undefined" ? renderDistValue : 5.0));
  const refPos = (typeof eyePos !== "undefined" && eyePos && eyePos.length >= 3) ? eyePos : player_pos;
  const maxNpcDistSq = (curObjectDist + 0.6) * (curObjectDist + 0.6);

  // Clear reusable persistent arrays without creating new objects
  _allNpcVertices.length = 0;
  _allNpcColors.length = 0;
  _allNpcIndices.length = 0;

  for (let c of amphibians) {
    // Remove the forced sync with the global ragdollEnabled
    // NPCs will only ragdoll if their own c.ragdollEnabled is set (which is currently never, unless we add a specific feature for it)

    // On-the-fly NPC position calculation for distance checks
    const sinT_npc = Math.sin(c.theta);
    const cosT_npc = Math.cos(c.theta);
    const sinP_npc = Math.sin(c.phi);
    const cosP_npc = Math.cos(c.phi);
    const npc_pos = [
      c.r * sinT_npc * cosP_npc,
      c.r * cosT_npc,
      c.r * sinT_npc * sinP_npc
    ];

    const effPos = (c.ragdollEnabled && c.ragdollPos) ? c.ragdollPos : npc_pos;

    // Distance check to player/camera against object render distance
    const distNpcDx = refPos[0] - effPos[0];
    const distNpcDy = refPos[1] - effPos[1];
    const distNpcDz = refPos[2] - effPos[2];
    const distNpcSq = distNpcDx * distNpcDx + distNpcDy * distNpcDy + distNpcDz * distNpcDz;

    let shouldRender = true;
    let shouldAnimate = true;
    let lodLevel = 0;

    // AI Life-Cycle LOD Tiers:
    // LOD 0 (< 15m): Full skeletal animation, breathing sway, full audio attenuation, full 3D mesh
    // LOD 1 (15m - 35m): Normal skeletal animation, full 3D mesh, sound effects muted
    // LOD 2 (> 35m or outside render distance or frustum culled): 0 3D vertices, 0 mesh calculations,
    //                        simulation runs in lightweight numeric mode (energy, hunger, schedule, drift)
    if (distNpcSq < 225.0) { // 15m * 15m
      lodLevel = 0;
    } else if (distNpcSq < 1225.0 && (!isRenderDistOn || distNpcSq <= maxNpcDistSq)) { // 35m * 35m
      lodLevel = 1;
    } else {
      lodLevel = 2;
      shouldRender = false;
      shouldAnimate = false;
    }

    if (isRenderDistOn && distNpcSq > maxNpcDistSq) {
      shouldRender = false;
      shouldAnimate = false;
      lodLevel = 2;
    }

    if (shouldRender && typeof frustumCullingEnabled !== 'undefined' && frustumCullingEnabled && typeof frustumPlanes !== 'undefined' && frustumPlanes && typeof isSphereInFrustum === 'function') {
      if (!isSphereInFrustum(frustumPlanes, effPos, 2.0)) {
        shouldRender = false;
        lodLevel = 2;
      }
    }
    c.lodLevel = lodLevel;

    if (c.ragdollEnabled) {
      if (c.ragdollPos) {
        const dx = player_pos[0] - c.ragdollPos[0];
        const dy = player_pos[1] - c.ragdollPos[1];
        const dz = player_pos[2] - c.ragdollPos[2];
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (dist > 5.0) {
          // Recycle dead NPC (ดึงโมเดลเก่ามาใช้ซ้ำ)
          let newTheta = Math.random() * Math.PI;
          let newPhi = Math.random() * Math.PI * 2;
          let newHeight = getHeightOnSphere(newTheta, newPhi, seed);

          if (c.type === 'human') {
            // Find an existing human to group with, or pick a random land spot
            let foundLeader = false;
            const effWaterH = (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15);
            const rRatio = Math.max(0.5, (typeof RADIUS !== 'undefined' ? RADIUS : 8.0) / 8.0);
            for (let other of amphibians) {
               if (other.type === 'human' && other !== c && !other.ragdollEnabled) {
                   if (Math.random() < 0.5) {
                       newTheta = other.theta + (Math.random() - 0.5) * (0.04 / rRatio);
                       newPhi = other.phi + (Math.random() - 0.5) * (0.04 / rRatio);
                       newHeight = getHeightOnSphere(newTheta, newPhi, seed);
                       if (newHeight * HEIGHT_SCALE > effWaterH) {
                           foundLeader = true;
                           break;
                       }
                   }
               }
            }
            
            if (!foundLeader) {
                for(let tries=0; tries<25; tries++) {
                   if (newHeight * HEIGHT_SCALE > effWaterH) break;
                   newTheta = Math.random() * Math.PI;
                   newPhi = Math.random() * Math.PI * 2;
                   newHeight = getHeightOnSphere(newTheta, newPhi, seed);
                }
            }
          } else if (c.type === 'georgiacetus' || c.type === 'placoderm') {
            // Prehistoric aquatic animals: try to find an ocean/water spot for respawn
            const effWaterH = (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15);
            for (let tries = 0; tries < 30; tries++) {
              if (newHeight * HEIGHT_SCALE <= effWaterH) break;
              newTheta = Math.random() * Math.PI;
              newPhi = Math.random() * Math.PI * 2;
              newHeight = getHeightOnSphere(newTheta, newPhi, seed);
            }
          }

          const isMeganeura = c.type === 'meganeura';
          const isIsopod = c.type === 'isopod';
          const isGeorgiacetus = c.type === 'georgiacetus';
          const isPlacoderm = c.type === 'placoderm';
          const effWaterH = (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15);
          const gRadius = RADIUS + newHeight * HEIGHT_SCALE;
          const wRadius = RADIUS + effWaterH;
          const isWater = (newHeight * HEIGHT_SCALE <= effWaterH);

          let newR = gRadius + 0.05;
          if (isMeganeura) {
            newR = Math.max(gRadius, wRadius) + 0.35 + Math.random() * 0.1;
          } else if (isIsopod) {
            newR = gRadius + 0.02;
          } else if (isGeorgiacetus || isPlacoderm) {
            newR = isWater ? Math.max(gRadius, wRadius - 0.04) + 0.04 : gRadius + 0.05;
          } else if (c.type === 'human') {
            newR = Math.max(gRadius, wRadius) + 0.05;
          }

          const maxHp = (window.NpcRegistry && window.NpcRegistry[c.type]) ? window.NpcRegistry[c.type].maxHp : 1;
          
          c.theta = newTheta;
          c.phi = newPhi;
          c.r = newR;
          c.heading = Math.random() * Math.PI * 2;
          c.animPhase = Math.random() * Math.PI * 2;
          c.ragdollEnabled = false;
          c.ragdollInitialized = false;
          c.ragdollPos = null;
          c.ragdollVel = null;
          c.hp = maxHp;
          c.maxHp = maxHp;
          c.isSwimming = ((isGeorgiacetus || isPlacoderm) ? isWater : (isIsopod && isWater));
          
          // Remove arrows attached to this NPC
          for (let coll of collectibles) {
            if (coll.attachedToNPC === c) {
              coll.attachedToNPC = null;
              coll.active = false;
            }
          }
          pendingCollectibleRefresh = true;
          continue;
        }
      }

      let immersion = 0.0;
      let depth = -1.0;
      if (!c.ragdollInitialized) {
        const sinT = Math.sin(c.theta);
        const cosT = Math.cos(c.theta);
        const sinP = Math.sin(c.phi);
        const cosP = Math.cos(c.phi);
        const N_init = [sinT * cosP, cosT, sinT * sinP];
        c.ragdollPos = [
          N_init[0] * c.r,
          N_init[1] * c.r,
          N_init[2] * c.r,
        ];

        // Initial velocity when killed - set to zero (plus small random twitching) to prevent any upward bouncing or popping
        c.ragdollVel = [
          (Math.random() - 0.5) * 0.001,
          (Math.random() - 0.5) * 0.001,
          (Math.random() - 0.5) * 0.001,
        ];

        c.ragdollAxis = [
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5,
        ];
        const len = Math.sqrt(
          c.ragdollAxis[0] ** 2 +
            c.ragdollAxis[1] ** 2 +
            c.ragdollAxis[2] ** 2,
        );
        c.ragdollAxis[0] /= len;
        c.ragdollAxis[1] /= len;
        c.ragdollAxis[2] /= len;
        c.ragdollAngle = 0;
        c.ragdollAngularSpeed = (Math.random() - 0.5) * 0.15;

        // Initialize diedOnSurface for NPC
        const waterRadius = RADIUS + (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15);
        const r_dist = Math.sqrt(
          c.ragdollPos[0] ** 2 +
            c.ragdollPos[1] ** 2 +
            c.ragdollPos[2] ** 2,
        );
        const initialDepth = waterRadius - r_dist;
        // If NPC dies while swimming in deep water (initialDepth >= 0.04), they will sink immediately (diedOnSurface = false)
        c.diedOnSurface =
          !waterEnabled || !c.isSwimming || initialDepth < 0.04;

        c.ragdollInitialized = true;
        c.ragdollAsleep = false;
        c.ragdollSleepFrames = 0;
      }

      if (!c.ragdollAsleep) {
        const dtScale = deltaTime / 0.016;
      const rp = c.ragdollPos;
      const r_dist = Math.sqrt(rp[0] ** 2 + rp[1] ** 2 + rp[2] ** 2);
      if (r_dist > 0.001) {
        const nx = rp[0] / r_dist;
        const ny = rp[1] / r_dist;
        const nz = rp[2] / r_dist;

        const caveData = typeof getTerrainSurfaceAndCeiling === "function"
          ? getTerrainSurfaceAndCeiling(nx, ny, nz, r_dist)
          : { ground: RADIUS + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(Math.acos(Math.max(-1.0, Math.min(1.0, ny))), Math.atan2(nz, nx), seed) : 0) * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };

        c.ragdollCaveData = caveData; // Save for vertex processing to avoid massive per-vertex terrain lookups

        // Use Physics engine
        Physics.applyGravity(c.ragdollVel, nx, ny, nz, dtScale, Physics.gravityAccel);

        // Friction
        const airFriction = Math.pow(0.98, dtScale);

        const waterRadius = RADIUS + (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15);
        const hRange = 0.05; // 5cm floating band
        if (waterEnabled && !caveData.insideTunnel) {
          immersion = Math.max(
            0.0,
            Math.min(
              1.0,
              (waterRadius + hRange - r_dist) / (2.0 * hRange),
            ),
          );
          depth = waterRadius - r_dist;
          if (depth < 0.04) {
            c.diedOnSurface = true;
          }
        } else {
          c.diedOnSurface = true;
        }

        const isNearSurface = c.diedOnSurface;
        // Smoothly interpolate friction based on immersion
        // Sinking underwater should have a lot more resistance/drag than floating at surface
        const waterFriction = isNearSurface
          ? Math.pow(0.85, dtScale)
          : Math.pow(0.78, dtScale);
        const friction =
          airFriction * (1.0 - immersion) + waterFriction * immersion;
        Physics.applyFriction(c.ragdollVel, friction);
        c.ragdollAngularSpeed *=
          airFriction * (1.0 - immersion) +
          Math.pow(isNearSurface ? 0.95 : 0.85, dtScale) * immersion;

        if (immersion > 0) {
          let buoyancyFactor = 0.0;
          if (depth > 0) {
            if (c.diedOnSurface) {
              // Near the surface: float!
              const targetSubmersion = 0.5; // Half submerged
              buoyancyFactor =
                immersion * (1.0 + (immersion - targetSubmersion) * 3.0);
              if (buoyancyFactor < 0.1) buoyancyFactor = 0.1;
            } else {
              // Deep underwater: sink slowly! (buoyancy close to gravity, e.g. 0.75 so it sinks very slowly)
              buoyancyFactor = 0.75 * immersion;
            }
          }
          Physics.applyBuoyancyForce(c.ragdollVel, nx, ny, nz, buoyancyFactor, dtScale, Physics.gravityAccel);

          // Gentle underwater drift and swaying to simulate fluid resistance/currents
          const driftPhase = Date.now() * 0.001 * 2.0 + (c.phi || 0);
          const driftAmp = 0.0004 * dtScale * immersion;
          let tx = -ny;
          let ty = nx;
          let tz = 0;
          const tlen = Math.sqrt(tx * tx + ty * ty + tz * tz);
          if (tlen > 0.001) {
            tx /= tlen;
            ty /= tlen;
            c.ragdollVel[0] += tx * Math.sin(driftPhase) * driftAmp;
            c.ragdollVel[1] += ty * Math.sin(driftPhase) * driftAmp;
            c.ragdollVel[2] += tz * Math.sin(driftPhase) * driftAmp;
          }
          c.ragdollAngularSpeed +=
            Math.sin(driftPhase * 1.5) * 0.001 * dtScale * immersion;

          // Apply vertical damping to completely kill oscillations / jitter for floating bodies at surface
          if (c.diedOnSurface) {
            const v_radial =
              c.ragdollVel[0] * nx +
              c.ragdollVel[1] * ny +
              c.ragdollVel[2] * nz;
            const v_tx = c.ragdollVel[0] - nx * v_radial;
            const v_ty = c.ragdollVel[1] - ny * v_radial;
            const v_tz = c.ragdollVel[2] - nz * v_radial;

            // Reduce vertical speed when floating at surface
            const dampFactor = Math.pow(0.65, dtScale);
            const new_v_radial = v_radial * dampFactor;
            c.ragdollVel[0] = v_tx + nx * new_v_radial;
            c.ragdollVel[1] = v_ty + ny * new_v_radial;
            c.ragdollVel[2] = v_tz + nz * new_v_radial;
          }
        }
      }

      rp[0] += c.ragdollVel[0];
      rp[1] += c.ragdollVel[1];
      rp[2] += c.ragdollVel[2];

      c.ragdollAngle += c.ragdollAngularSpeed * dtScale;

      // Collide with terrain
      const distToCenter = Math.sqrt(
        rp[0] ** 2 + rp[1] ** 2 + rp[2] ** 2,
      );
      if (distToCenter > 0.001) {
        const ux = rp[0] / distToCenter;
        const uy = rp[1] / distToCenter;
        const uz = rp[2] / distToCenter;

        c.theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
        c.phi = Math.atan2(uz, ux);
        c.r = distToCenter;

        // REUSE caveData (which is c.ragdollCaveData)
        const caveData = c.ragdollCaveData || { ground: RADIUS + getHeightOnSphere(c.theta, c.phi, seed) * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };
        const surfaceRadius = caveData.ground;

        const colRadius = 0.15 * 0.5; // matching NPC model scale
        
        let target = distToCenter;
        let hitSolid = false;
        
        if (caveData.insideTunnel) {
          if (distToCenter < caveData.ground + colRadius) {
            target = caveData.ground + colRadius;
            hitSolid = true;
            const v_radial = c.ragdollVel[0] * ux + c.ragdollVel[1] * uy + c.ragdollVel[2] * uz;
            if (v_radial < 0) {
                c.ragdollVel[0] -= ux * v_radial;
                c.ragdollVel[1] -= uy * v_radial;
                c.ragdollVel[2] -= uz * v_radial;
            }
          } else if (caveData.ceiling !== Infinity && distToCenter > caveData.ceiling - colRadius) {
            target = caveData.ceiling - colRadius;
            hitSolid = true;
            const v_radial = c.ragdollVel[0] * ux + c.ragdollVel[1] * uy + c.ragdollVel[2] * uz;
            if (v_radial > 0) {
               c.ragdollVel[0] -= ux * v_radial;
               c.ragdollVel[1] -= uy * v_radial;
               c.ragdollVel[2] -= uz * v_radial;
            }
          }
        } else {
          if (distToCenter < surfaceRadius + colRadius) {
            // Only push up to the surface if we are within 0.5 units of it.
            // This prevents teleporting from deep underground caves to the surface.
            if (distToCenter > surfaceRadius - 0.5) {
              target = surfaceRadius + colRadius;
              hitSolid = true;
              const v_radial = c.ragdollVel[0] * ux + c.ragdollVel[1] * uy + c.ragdollVel[2] * uz;
              if (v_radial < 0) {
                  c.ragdollVel[0] -= ux * v_radial;
                  c.ragdollVel[1] -= uy * v_radial;
                  c.ragdollVel[2] -= uz * v_radial;
              }
            } else {
              // Deep underground, clipped through cave floor. Stop velocity to prevent falling forever.
              Physics.applyFriction(c.ragdollVel, 0.5);
            }
          }
        }

        if (hitSolid) {
          rp[0] = ux * target;
          rp[1] = uy * target;
          rp[2] = uz * target;
          c.r = target;

          // Ground friction
          Physics.applyFriction(c.ragdollVel, 0.7);
          c.ragdollAngularSpeed *= 0.7;

          // Ground normal estimation - cached to prevent 3 heavy FBM noise evaluations per frame!
          let snX, snY, snZ;
          if (!c.ragdollNormal || !c.ragdollNormalPos ||
              Math.hypot(rp[0] - c.ragdollNormalPos[0], rp[1] - c.ragdollNormalPos[1], rp[2] - c.ragdollNormalPos[2]) > 0.05) {

            const getT = (t, p) => {
              const rad =
                RADIUS + getHeightOnSphere(t, p, seed) * HEIGHT_SCALE;
              return [
                rad * Math.sin(t) * Math.cos(p),
                rad * Math.cos(t),
                rad * Math.sin(t) * Math.sin(p),
              ];
            };
            const p0 = getT(c.theta, c.phi);
            const p1 = getT(c.theta, c.phi + 0.02);
            const p2 = getT(c.theta - 0.02, c.phi);
            const v1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
            const v2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
            let snX_calc = v1[1] * v2[2] - v1[2] * v2[1];
            let snY_calc = v1[2] * v2[0] - v1[0] * v2[2];
            let snZ_calc = v1[0] * v2[1] - v1[1] * v2[0];
            const snLen = Math.sqrt(snX_calc * snX_calc + snY_calc * snY_calc + snZ_calc * snZ_calc);
            if (snLen > 0.0001) {
              snX_calc /= snLen;
              snY_calc /= snLen;
              snZ_calc /= snLen;
              if (snX_calc * ux + snY_calc * uy + snZ_calc * uz < 0) {
                snX_calc = -snX_calc;
                snY_calc = -snY_calc;
                snZ_calc = -snZ_calc;
              }
            } else {
              snX_calc = ux;
              snY_calc = uy;
              snZ_calc = uz;
            }
            c.ragdollNormal = [snX_calc, snY_calc, snZ_calc];
            c.ragdollNormalPos = [rp[0], rp[1], rp[2]];
          }
          
          snX = c.ragdollNormal[0];
          snY = c.ragdollNormal[1];
          snZ = c.ragdollNormal[2];

          const bounciness = !c.diedOnSurface ? 0.0 : 0.1;
          const friction = !c.diedOnSurface ? 0.9 : 0.95;

          const dot = c.ragdollVel[0] * snX + c.ragdollVel[1] * snY + c.ragdollVel[2] * snZ;
          if (dot < 0) {
            const vnX = snX * dot;
            const vnY = snY * dot;
            const vnZ = snZ * dot;
            const vtX = c.ragdollVel[0] - vnX;
            const vtY = c.ragdollVel[1] - vnY;
            const vtZ = c.ragdollVel[2] - vnZ;
            
            Physics.resolveVelocityCollision(c.ragdollVel, snX, snY, snZ, bounciness, friction);
            
            const speedSq = vtX * vtX + vtY * vtY + vtZ * vtZ;
            if (speedSq > 0.00001) {
              const speed = Math.sqrt(speedSq);
              c.ragdollAngularSpeed = speed * 1.5;

              let cX = snY * vtZ - snZ * vtY;
              let cY = snZ * vtX - snX * vtZ;
              let cZ = snX * vtY - snY * vtX;
              const cLen = Math.sqrt(cX * cX + cY * cY + cZ * cZ);
              if (cLen > 0.0001) {
                c.ragdollAxis = [cX / cLen, cY / cLen, cZ / cLen];
              }
            } else {
              let normalizedAngle = Math.abs(c.ragdollAngle % Math.PI);
              if (
                normalizedAngle < (Math.PI / 2) * 0.8 ||
                normalizedAngle > Math.PI - (Math.PI / 2) * 0.8
              ) {
                c.ragdollAngularSpeed =
                  0.05 * Math.sign(c.ragdollAngularSpeed || 1);
              } else {
                c.ragdollAngularSpeed *= 0.5;
              }
            }
          }
        }
      }

      // Sleep check to put static ragdolls to rest and save 100% of their physics/collision CPU cost!
      const speedSq = c.ragdollVel[0]*c.ragdollVel[0] + c.ragdollVel[1]*c.ragdollVel[1] + c.ragdollVel[2]*c.ragdollVel[2];
      const angSpeed = Math.abs(c.ragdollAngularSpeed);
      if (speedSq < 0.000004 && angSpeed < 0.01) {
        c.ragdollSleepFrames = (c.ragdollSleepFrames || 0) + 1;
        if (c.ragdollSleepFrames > 15) {
          c.ragdollAsleep = true;
        }
      } else {
        c.ragdollSleepFrames = 0;
      }
      }
    } else {
      // Check distance to player and damage if close
      const dx = player_pos[0] - npc_pos[0];
      const dy = player_pos[1] - npc_pos[1];
      const dz = player_pos[2] - npc_pos[2];
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      let pBoat = null;
      let pMech = null;
      try { pBoat = (typeof activeRidingBoat !== "undefined" && activeRidingBoat) || (typeof window !== "undefined" && window.activeRidingBoat); } catch(e) {}
      try { pMech = (typeof activeRidingMech !== "undefined" && activeRidingMech) || (typeof window !== "undefined" && window.activeRidingMech); } catch(e) {}
      const isDriving = !!(pBoat || pMech);
      const isPlayerDown = playerHP <= 0 || playerControlsLocked || (typeof ragdollEnabled !== "undefined" && ragdollEnabled);

      if (c.type === 'meganeura' && dist < 0.45 && !isPlayerDown && !isDriving && playerDamageCooldown <= 0) {
        damagePlayer(1);
      }

      // Update living NPC life-cycle state machine (Energy, Hunger, Daily Activities)
      updateNpcLifeCycle(c, deltaTime, seed);

      if (c.lodLevel === 2) {
        // Fast numeric off-screen drift - updates position without heavy 3D math
        if (!c.isIdle && c.lifeSchedule !== 'RESTING' && c.lifeSchedule !== 'SLEEPING') {
          const moveSpeed = (c.isSwimming ? 0.20 : 0.04) * deltaTime;
          c.heading += (Math.random() - 0.5) * 0.4 * deltaTime;
          const dTheta = Math.cos(c.heading) * (moveSpeed / (c.r || RADIUS));
          const dPhi = Math.sin(c.heading) * (moveSpeed / ((c.r || RADIUS) * Math.max(0.1, Math.sin(c.theta))));
          c.theta = Math.max(0.05, Math.min(Math.PI - 0.05, c.theta + dTheta));
          c.phi = (c.phi + dPhi + Math.PI * 2) % (Math.PI * 2);
        }
        continue; // Skip all heavy 3D mesh transformations, trigonometry, and audio raycasts!
      }

      c.ragdollInitialized = false;
      const npcRegConfig = window.NpcRegistry && window.NpcRegistry[c.type];
      const animSpeed = npcRegConfig && npcRegConfig.animSpeed !== undefined ? npcRegConfig.animSpeed : 4.0;
      let moveSpeedBase = (c.isSwimming ? 0.25 : 0.05);
      if (npcRegConfig && npcRegConfig.moveSpeed !== undefined) moveSpeedBase = npcRegConfig.moveSpeed;
      
      const walkBlend = c.walkBlend !== undefined ? c.walkBlend : (c.isIdle ? 0 : 1);
      moveSpeedBase *= walkBlend;
      
      const prevAnimPhase = c.animPhase;
      if (shouldAnimate) {
        c.animPhase += deltaTime * animSpeed * walkBlend;
      }
      const moveSpeed = moveSpeedBase * deltaTime;

      // Great-circle rotation to avoid polar coordinate singularities (walking around the center of the world)
      const sinT = Math.sin(c.theta);
      const cosT = Math.cos(c.theta);
      const sinP = Math.sin(c.phi);
      const cosP = Math.cos(c.phi);

      const North = [-cosT * cosP, sinT, -cosT * sinP];
      const East = [-sinP, 0, cosP];

      const V_move = [
        North[0] * Math.cos(c.heading) + East[0] * Math.sin(c.heading),
        North[1] * Math.cos(c.heading) + East[1] * Math.sin(c.heading),
        North[2] * Math.cos(c.heading) + East[2] * Math.sin(c.heading),
      ];

      const P_curr = [sinT * cosP, cosT, sinT * sinP];
      const speed = moveSpeed / c.r;

      let P_new = [
        P_curr[0] * Math.cos(speed) + V_move[0] * Math.sin(speed),
        P_curr[1] * Math.cos(speed) + V_move[1] * Math.sin(speed),
        P_curr[2] * Math.cos(speed) + V_move[2] * Math.sin(speed),
      ];

      const pLen = Math.sqrt(
        P_new[0] * P_new[0] + P_new[1] * P_new[1] + P_new[2] * P_new[2],
      );
      if (pLen > 0.0001) {
        P_new = [P_new[0] / pLen, P_new[1] / pLen, P_new[2] / pLen];
      }

      c.theta = Math.acos(Math.max(-1, Math.min(1, P_new[1])));
      c.theta = Math.max(1e-5, Math.min(Math.PI - 1e-5, c.theta));

      c.phi = Math.atan2(P_new[2], P_new[0]);
      if (c.phi < 0) c.phi += Math.PI * 2;

      // Parallel transport the heading angle to the new position
      const sinT_new = Math.sin(c.theta);
      const cosT_new = Math.cos(c.theta);
      const sinP_new = Math.sin(c.phi);
      const cosP_new = Math.cos(c.phi);

      const North_new = [
        -cosT_new * cosP_new,
        sinT_new,
        -cosT_new * sinP_new,
      ];
      const East_new = [-sinP_new, 0, cosP_new];

      const V_tangent = [
        -P_curr[0] * Math.sin(speed) + V_move[0] * Math.cos(speed),
        -P_curr[1] * Math.sin(speed) + V_move[1] * Math.cos(speed),
        -P_curr[2] * Math.sin(speed) + V_move[2] * Math.cos(speed),
      ];

      const f_comp =
        V_tangent[0] * North_new[0] +
        V_tangent[1] * North_new[1] +
        V_tangent[2] * North_new[2];
      const r_comp =
        V_tangent[0] * East_new[0] +
        V_tangent[1] * East_new[1] +
        V_tangent[2] * East_new[2];
      c.heading = Math.atan2(r_comp, f_comp);

      c.heading += (Math.random() - 0.5) * 1.0 * deltaTime;

      const sinT_npc = Math.sin(c.theta);
      const cosT_npc = Math.cos(c.theta);
      const sinP_npc = Math.sin(c.phi);
      const cosP_npc = Math.cos(c.phi);
      const npc_nx = sinT_npc * cosP_npc;
      const npc_ny = cosT_npc;
      const npc_nz = sinT_npc * sinP_npc;

      const npc_r_est = c.r || (RADIUS + getHeightOnSphere(c.theta, c.phi, seed) * HEIGHT_SCALE);
      
      // Throttled terrain/cave and water lookup to keep the frame rate at solid 120fps!
      if (c.caveCheckAccumulator === undefined) {
        c.caveCheckAccumulator = Math.random() * 0.15; // Jitter the initial timers to spread the load across frames
      }
      c.caveCheckAccumulator += deltaTime;

      if (!c.cachedCaveData || c.caveCheckAccumulator >= 0.15) {
        c.caveCheckAccumulator = 0;
        c.cachedCaveData = typeof getTerrainSurfaceAndCeiling === "function"
          ? getTerrainSurfaceAndCeiling(npc_nx, npc_ny, npc_nz, npc_r_est)
          : { ground: RADIUS + getHeightOnSphere(c.theta, c.phi, seed) * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };
        
        const gRadiusTemp = c.cachedCaveData.ground;
        const npc_r_temp = c.r || gRadiusTemp;
        c.cachedWaterRadius = getWaterRadiusAt(npc_nx * npc_r_temp, npc_ny * npc_r_temp, npc_nz * npc_r_temp);
      }

      const npcCaveData = c.cachedCaveData;
      const gRadius = npcCaveData.ground;
      const npc_r = c.r || gRadius;
      let wRadius = c.cachedWaterRadius;
      if (npcCaveData.insideTunnel && wRadius === 0) {
          wRadius = (typeof RADIUS !== 'undefined' ? RADIUS : 8.0) + (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * 0.15;
      }

      // Update specific NPC type movement behavior
      const npcReg = window.NpcRegistry[c.type];
      if (npcReg && npcReg.updateBehavior) {
        npcReg.updateBehavior(c, deltaTime, seed, gRadius, wRadius, npcCaveData);
      }

      if (!shouldAnimate) {
        c.animPhase = prevAnimPhase;
      }

      if (c.lastAnimPhase === undefined) c.lastAnimPhase = c.animPhase;
      const phaseOffset = c.isSwimming ? 4.05 : 0; // Sync with max tail velocity (z=-0.95)
      const stepPrev = Math.floor(
        (c.lastAnimPhase - phaseOffset) / Math.PI,
      );
      const stepCurr = Math.floor((c.animPhase - phaseOffset) / Math.PI);

      if (c.lodLevel === 0 && stepPrev !== stepCurr) {
        // A step was taken. Calculate distance to player to determine volume
        const distAngle = Math.acos(
          Math.max(
            -1,
            Math.min(
              1,
              Math.sin(c.theta) *
                Math.sin(charTheta) *
                Math.cos(c.phi - charPhi) +
                Math.cos(c.theta) * Math.cos(charTheta),
            ),
          ),
        );
        const dist = distAngle * RADIUS;
        if (dist < 2.0) {
          // Quadratic falloff for more realistic sound attenuation
          const volScale =
            Math.pow(Math.max(0, 1.0 - dist / 2.0), 2) * 0.6;
          if (volScale > 0.01) {
            if (c.isSwimming) {
              playSplashSound(volScale);
            } else {
              playFootstepSound(volScale);
            }
          }
        }
      }
      c.lastAnimPhase = c.animPhase;
    }

    if (shouldRender) {
      const sinTheta = Math.sin(c.theta);
      const cosTheta = Math.cos(c.theta);
      const sinPhi = Math.sin(c.phi);
      const cosPhi = Math.cos(c.phi);
      let N = [sinTheta * cosPhi, cosTheta, sinTheta * sinPhi];

      c.position = [N[0] * c.r, N[1] * c.r, N[2] * c.r];
      c.radius = 0.15;

      // Heading local frame
      let h_rad = c.heading;
      const sinH = Math.sin(h_rad);
      const cosH = Math.cos(h_rad);

      let North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
      let East = [-sinPhi, 0, cosPhi];

      let F = [
        North[0] * cosH + East[0] * sinH,
        North[1] * cosH + East[1] * sinH,
        North[2] * cosH + East[2] * sinH,
      ];
      let R = [
        -North[0] * sinH + East[0] * cosH,
        -North[1] * sinH + East[1] * cosH,
        -North[2] * sinH + East[2] * cosH,
      ];

      if (c.ragdollEnabled) {
        const q = c.ragdollAngle;
        const cosQ = Math.cos(q);
        const sinQ = Math.sin(q);
        const ax = c.ragdollAxis[0];
        const ay = c.ragdollAxis[1];
        const az = c.ragdollAxis[2];

        const rotateVector = (v) => {
          const dot = v[0] * ax + v[1] * ay + v[2] * az;
          const cross = [
            ay * v[2] - az * v[1],
            az * v[0] - ax * v[2],
            ax * v[1] - ay * v[0],
          ];
          return [
            v[0] * cosQ + cross[0] * sinQ + ax * dot * (1.0 - cosQ),
            v[1] * cosQ + cross[1] * sinQ + ay * dot * (1.0 - cosQ),
            v[2] * cosQ + cross[2] * sinQ + az * dot * (1.0 - cosQ),
          ];
        };

        N = rotateVector(N);
        F = rotateVector(F);
        R = rotateVector(R);
      }

      const pos = c.ragdollEnabled ? c.ragdollPos : c.position;

      let f = [0, 0, 0];
      if (c.ragdollEnabled && c.ragdollVel) {
        const localVel = [
          c.ragdollVel[0] * R[0] + c.ragdollVel[1] * R[1] + c.ragdollVel[2] * R[2],
          c.ragdollVel[0] * N[0] + c.ragdollVel[1] * N[1] + c.ragdollVel[2] * N[2],
          c.ragdollVel[0] * F[0] + c.ragdollVel[1] * F[1] + c.ragdollVel[2] * F[2],
        ];
        const g = [
          -N[0] * R[0] - N[1] * R[1] - N[2] * R[2],
          -N[0] * N[0] - N[1] * N[1] - N[2] * N[2],
          -N[0] * F[0] - N[1] * F[1] - N[2] * F[2],
        ];
        f[0] = g[0] * 1.5 - localVel[0] * 12.0;
        f[1] = g[1] * 1.5 - localVel[1] * 12.0;
        f[2] = g[2] * 1.5 - localVel[2] * 12.0;
      }

      const transformPoint = (px, py, pz) => {
        let worldPos = [
          pos[0] + (px * R[0] + py * N[0] + pz * F[0]),
          pos[1] + (px * R[1] + py * N[1] + pz * F[1]),
          pos[2] + (px * R[2] + py * N[2] + pz * F[2]),
        ];
        if (c.ragdollEnabled) {
          const dist = Math.sqrt(
            worldPos[0] ** 2 + worldPos[1] ** 2 + worldPos[2] ** 2,
          );
          if (dist > 0.001) {
            const ux = worldPos[0] / dist;
            const uy = worldPos[1] / dist;
            const uz = worldPos[2] / dist;

            const caveData = c.ragdollCaveData || { ground: RADIUS + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(Math.acos(Math.max(-1.0, Math.min(1.0, uy))), Math.atan2(uz, ux), seed) : 0) * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };
            const surfaceRadius = caveData.ground;

            // Determine thickness envelope based on local coordinate
            const scale = 0.5; // matching base scale
            const localPx = px / scale;
            const localPz = pz / scale;
            let thickness = 0.06;
            if (Math.abs(localPx) > 0.05) {
              thickness = 0.015;
            } else {
              if (localPz > 0.2) thickness = 0.03;
              else if (localPz > -0.3 && localPz <= 0.2) thickness = 0.12;
              else if (localPz > -0.6 && localPz <= -0.3) thickness = 0.09;
              else if (localPz <= -0.6) thickness = 0.04;
            }

            if (caveData.insideTunnel) {
               const minRad = caveData.ground + thickness * scale;
               const maxRad = caveData.ceiling !== Infinity ? caveData.ceiling - thickness * scale : Infinity;
               if (dist < minRad) {
                 worldPos = [ux * minRad, uy * minRad, uz * minRad];
               } else if (dist > maxRad && maxRad !== Infinity) {
                 worldPos = [ux * maxRad, uy * maxRad, uz * maxRad];
               }
            } else {
               const minRad = surfaceRadius + thickness * scale;
               if (dist < minRad && dist > surfaceRadius - 0.5) {
                 worldPos = [ux * minRad, uy * minRad, uz * minRad];
               }
            }
          }
        }
        return worldPos;
      };

      const scale = c.type === 'meganeura' ? 0.25 : (c.type === 'isopod' ? 0.38 : 0.5);

      // Render using the registered NPC implementation
      const npcReg = window.NpcRegistry[c.type];
      if (npcReg && npcReg.render) {
        npcReg.render(
          c,
          _allNpcVertices,
          _allNpcColors,
          _allNpcIndices,
          scale,
          N,
          R,
          F,
          pos,
          f,
          transformPoint,
          seed
        );
      }
    }
  }

  if (_allNpcIndices.length === 0) {
    amphibianIndicesLength = 0;
    return;
  }

  const flatGeom = makeFlatShadedGeometry(
    _allNpcVertices,
    _allNpcColors,
    _allNpcIndices,
    true
  );
  amphibianIndicesLength = flatGeom.indices.length;

  if (!amphibianVertexBuffer) amphibianVertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, amphibianVertexBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    flatGeom.vertices,
    gl.DYNAMIC_DRAW,
  );

  if (!amphibianColorBuffer) amphibianColorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, amphibianColorBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    flatGeom.colors,
    gl.DYNAMIC_DRAW,
  );

  if (!amphibianNormalBuffer) amphibianNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, amphibianNormalBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    flatGeom.normals,
    gl.DYNAMIC_DRAW,
  );

  if (!amphibianIndexBuffer) amphibianIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, amphibianIndexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    flatGeom.indices,
    gl.DYNAMIC_DRAW,
  );
}

function clearActiveNPCs() {
  if (typeof amphibians !== "undefined" && Array.isArray(amphibians)) {
    amphibians.length = 0;
  }
}
window.clearActiveNPCs = clearActiveNPCs;
window.initAmphibians = initAmphibians;
window.rebuildNPCs = function(count, seed) {
  initAmphibians(count, seed || (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 12345));
};
