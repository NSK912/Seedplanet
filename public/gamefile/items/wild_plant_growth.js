// === SEEDPLANET MODULE: JS/ITEMS/WILD_PLANT_GROWTH.JS ===
// ระบบการเติบโตและงอกใหม่ของพืชที่สร้างมากับดาวทุกชนิด (ต้นไม้ปกติ, ต้นแก้วมังกร + ผลแก้วมังกร, ต้นฝ้าย, ต้นรัก, หญ้า)
// - ดึงโค้ดการโตและโมเดลระยะ 0..5 จากระบบกล่องดิน (wood_planter_box.js / planter_system.js) มาใช้ร่วมกัน
// - พืชป่าทุกต้นใช้เวลาเติบโต 10 นาที (600 วินาที) โดยนับเวลาแยกกันอิสระทุกต้น
// - กรณีพื้นผิวดาวตรงตำแหน่งเดิมโดนขุดทำลายไปแล้ว (tunnels3D / isDug / ถ้ำ / สิ่งปลูกสร้างทับ)
//   จะค้นหาพื้นผิวดาวที่ยังสมบูรณ์ในบริเวณใกล้เคียงแล้วไปงอกทดแทนตรงจุดนั้นแทน

(function () {
  "use strict";

  const WILD_GROWTH_DURATION = 600; // 10 นาที (600 วินาที) นับแยกกันทุกต้น
  const UPDATE_INTERVAL_MS = 2500;  // ตรวจอัปเดตทุก 2.5 วินาทีเพื่อประหยัด CPU
  const MAX_RELOCATED_GRASS_PER_DIG = 4; // จำกัดจำนวนกอหญ้าที่ย้ายไปงอกใกล้เคียงต่อ 1 หลุมขุดเพื่อไม่ให้กินสเปค

  let _lastUpdateCheck = 0;
  let _idSeq = 1;

  // แคชรายการ wild_growing_plant โดยตรงเพื่อไม่ต้องวนสแกน collectibles ทั้งดาวทุก 2.5 วินาที
  const _wildGrowingItems = [];

  // ตัวติดตามเวอร์ชันโลก (หลุมขุด / สิ่งปลูกสร้าง / บ้าน) เพื่อเช็กพื้นใหม่เฉพาะตอนโลกเปลี่ยนจริงหรือตอนเปลี่ยนระยะโต
  let _lastValidatedTopoVer = -1;
  let _lastValidatedTunnelLen = -1;
  let _lastValidatedHouseLen = -1;
  let _lastValidatedColsLen = -1;
  let _forceSurfaceValidation = true;

  // เก็บสำเนา vertex เดิมของต้นไม้/หญ้าในแรมเฉพาะเซสชันปัจจุบัน (ไม่เขียนลงไฟล์เซฟ)
  // เพื่อคืนร่างเข้า natureVertexBuffer ด้วย gl.bufferSubData ได้ทันทีโดยไม่ rebuild ทั้งดาว
  const _treeVertexBackups = new Map(); // treeId -> { meshStart, meshEnd, verts, obstacle }

  // รายการกอหญ้าที่กำลังงอกใหม่ใน natureVertexBuffer (กรณีพื้นเดิมยังอยู่หรือย้ายใน chunk เดิมได้)
  const _grassRegrowthEntries = [];

  // รายการผลแก้วมังกรบนต้นที่ถูกเก็บเดี่ยวๆ (โดยที่ต้นแม่ยังไม่ถูกโค่น)
  const _treeFruitRegrowthEntries = [];

  function makeTangentBasis(n) {
    const nx = n[0], ny = n[1], nz = n[2];
    let rx, ry, rz;
    if (Math.abs(ny) < 0.9) {
      rx = -nz; ry = 0; rz = nx;
    } else {
      rx = 1; ry = 0; rz = 0;
    }
    const rLen = Math.hypot(rx, ry, rz) || 1;
    const R = [rx / rLen, ry / rLen, rz / rLen];
    const F = [
      ny * R[2] - nz * R[1],
      nz * R[0] - nx * R[2],
      nx * R[1] - ny * R[0]
    ];
    return { R, F };
  }

  function getPlanetRadius() {
    if (typeof RADIUS === "number" && RADIUS > 0) return RADIUS;
    if (typeof window !== "undefined" && typeof window.RADIUS === "number" && window.RADIUS > 0) return window.RADIUS;
    return 16.0;
  }

  function getPlanetHeightScale() {
    if (typeof HEIGHT_SCALE === "number" && HEIGHT_SCALE > 0) return HEIGHT_SCALE;
    if (typeof window !== "undefined" && typeof window.HEIGHT_SCALE === "number" && window.HEIGHT_SCALE > 0) return window.HEIGHT_SCALE;
    return 0.6;
  }

  function getPlanetWaterLevel() {
    if (typeof waterLevel === "number") return waterLevel;
    if (typeof window !== "undefined" && typeof window.waterLevel === "number") return window.waterLevel;
    return 0.0;
  }

  function getPlanetSeed() {
    if (typeof window !== "undefined" && typeof window.globalSeed === "number") return window.globalSeed;
    if (typeof globalSeed === "number") return globalSeed;
    return 0;
  }

  function getNatureObstaclesArray() {
    if (typeof window !== "undefined" && Array.isArray(window.natureObstacles)) return window.natureObstacles;
    if (typeof natureObstacles !== "undefined" && Array.isArray(natureObstacles)) return natureObstacles;
    return null;
  }

  function getCollectiblesArray() {
    if (typeof window !== "undefined" && Array.isArray(window.collectibles)) return window.collectibles;
    if (typeof collectibles !== "undefined" && Array.isArray(collectibles)) return collectibles;
    return null;
  }

  function getTunnelsArray() {
    if (typeof window !== "undefined" && Array.isArray(window.tunnels3D)) return window.tunnels3D;
    if (typeof tunnels3D !== "undefined" && Array.isArray(tunnels3D)) return tunnels3D;
    return null;
  }

  function sampleSurfaceAtDirection(nx, ny, nz) {
    const seed = getPlanetSeed();
    const rad = getPlanetRadius();
    const hs = getPlanetHeightScale();
    const theta = Math.acos(Math.max(-1, Math.min(1, ny)));
    const phi = Math.atan2(nz, nx);
    const surfData = (typeof getTerrainHeightAndColor === "function")
      ? getTerrainHeightAndColor(theta, phi, seed)
      : null;
    const hVis = (typeof getVisualHeightOnSphere === "function")
      ? getVisualHeightOnSphere(theta, phi, seed)
      : ((typeof getHeightOnSphere === "function") ? getHeightOnSphere(theta, phi, seed) : (surfData ? surfData.height : 0));
    const surfR = rad + hVis * hs;
    return {
      position: [nx * surfR, ny * surfR, nz * surfR],
      normal: [nx, ny, nz],
      height: hVis,
      surfR: surfR,
      color: surfData && surfData.color ? [surfData.color[0], surfData.color[1], surfData.color[2]] : [0.3, 0.58, 0.22]
    };
  }

  function isGrassValidGround(color, height, ny) {
    if (Math.abs(ny) >= 0.60) return false;
    const wl = getPlanetWaterLevel();
    if (height < wl + 0.04) return false;
    if (color) {
      const r = color[0], g = color[1], b = color[2];
      if (r > 0.72 && g > 0.76 && b > 0.82) return false; // หิมะ
      if (height < 0.46 && r > 0.70 && g > 0.65) return false; // หาดทราย
    }
    return true;
  }

  function isInsideAnyTunnelOrDugHole(pos, margin) {
    if (!pos) return true;
    const px = pos[0], py = pos[1], pz = pos[2];
    const m = typeof margin === "number" ? margin : 0.16;

    const pLen = Math.hypot(px, py, pz) || 1;
    const nx = px / pLen, ny = py / pLen, nz = pz / pLen;
    // จุดลึกลงใต้ผิวดินเล็กน้อย (0.06m) เผื่อหลุมขุดเฉือนใต้หน้าดินพอดี
    const subX = px - nx * 0.06, subY = py - ny * 0.06, subZ = pz - nz * 0.06;

    // 1. ใช้ isPositionInsideCave (ใช้ tunnels3DGrid O(1)) ทั้งจุดผิวดาวและจุดใต้ผิว โดยไม่วนสแกน tunnels3D ซ้ำ
    if (typeof isPositionInsideCave === "function") {
      if (isPositionInsideCave(px, py, pz, m)) return true;
      if (isPositionInsideCave(subX, subY, subZ, m)) return true;
      return false;
    }

    // 2. Fallback กรณีไม่มี isPositionInsideCave (เช่นในสภาพแวดล้อมทดสอบบางชุด)
    const tunnels = getTunnelsArray();
    if (tunnels && tunnels.length > 0) {
      for (let i = 0; i < tunnels.length; i++) {
        const t = tunnels[i];
        if (!t) continue;
        const rad = (t.r || 0.1) + m;
        const radSq = rad * rad;
        const dx1 = px - t.x, dy1 = py - t.y, dz1 = pz - t.z;
        if (dx1 * dx1 + dy1 * dy1 + dz1 * dz1 <= radSq) return true;
        const dx2 = subX - t.x, dy2 = subY - t.y, dz2 = subZ - t.z;
        if (dx2 * dx2 + dy2 * dy2 + dz2 * dz2 <= radSq) return true;
      }
    }
    return false;
  }

  function isBlockedByStructureOrFlora(pos, kind, ignoreItem) {
    if (!pos) return true;
    const px = pos[0], py = pos[1], pz = pos[2];
    const isTree = (kind === "BRANCH" || kind === "DRAGON_FRUIT");
    const isGrass = (kind === "GRASS");

    // 1. เช็กบ้านสุ่ม/หมู่บ้าน (placedHouses)
    const houses = (typeof window !== "undefined" && Array.isArray(window.placedHouses)) ? window.placedHouses : null;
    if (houses && houses.length > 0) {
      const extraPad = isTree ? 0.55 : 0.25;
      for (let i = 0; i < houses.length; i++) {
        const h = houses[i];
        if (!h || !h.position) continue;
        const hr = (h.radius || 1.4) + extraPad;
        const dx = px - h.position[0], dy = py - h.position[1], dz = pz - h.position[2];
        if (dx * dx + dy * dy + dz * dz < hr * hr) return true;
      }
    }

    // 2. เช็กสิ่งปลูกสร้าง พื้น กองไฟ กล่องดิน และพืชที่กำลังโตต้นอื่น (ใช้ SpatialGrid.queryRadius เพื่อลด O(N) เป็น O(1))
    const queryR = isTree ? 2.6 : 2.2;
    let colCandidates = null;
    if (typeof SpatialGrid !== "undefined" && SpatialGrid && typeof SpatialGrid.queryRadius === "function") {
      colCandidates = SpatialGrid.queryRadius(px, py, pz, queryR);
    } else {
      colCandidates = getCollectiblesArray();
    }

    if (colCandidates && colCandidates.length > 0) {
      for (let i = 0; i < colCandidates.length; i++) {
        const c = colCandidates[i];
        if (!c || !c.active || c.isPreview || !c.position || c === ignoreItem) continue;
        const t = c.type;
        let blockR = 0;
        if (t === "stone_floor") blockR = (c.size || 0.25) * 6.5 + (isTree ? 0.45 : 0.18);
        else if (t === "wood_floor" || t === "thin_wood_floor" || t === "wood_roof") blockR = (c.size || 0.25) * 1.4 + (isTree ? 0.35 : 0.12);
        else if (t === "wood_wall" || t === "wood_door" || t === "wood_window") blockR = 0.28 + (isTree ? 0.35 : 0.10);
        else if (t === "campfire" || t === "wood_chest" || t === "wood_bed" || t === "wood_table" || t === "wood_planter_box" || t === "obsidian_pad_warp_item" || t === "obsidian_compass_pad_item") {
          blockR = (t === "campfire" ? 0.35 : 0.26) + (isTree ? 0.30 : 0.12);
        } else if (t === "wild_growing_plant") {
          const otherSeed = c.plantData ? String(c.plantData.seedType || "").toUpperCase() : "";
          const otherIsTree = otherSeed.includes("BRANCH") || otherSeed.includes("DRAGON");
          if (isTree && otherIsTree) blockR = 0.70;
          else if (!isGrass && !otherSeed.includes("GRASS")) blockR = 0.28;
          else if (isGrass && otherSeed.includes("GRASS")) blockR = 0.16;
          else continue;
        } else {
          continue;
        }
        const dx = px - c.position[0], dy = py - c.position[1], dz = pz - c.position[2];
        if (dx * dx + dy * dy + dz * dz < blockR * blockR) return true;
      }
    }

    // 3. เช็กต้นไม้/หินที่ยังยืนต้นอยู่ใน natureObstacles (ข้าม collider ของตัวต้นไม้ wild_growing_plant เอง)
    const nObs = getNatureObstaclesArray();
    if (nObs && nObs.length > 0 && !isGrass) {
      const ignoreWildId = (ignoreItem && ignoreItem.wildGrowthId) ? ignoreItem.wildGrowthId : null;
      for (let i = 0; i < nObs.length; i++) {
        const o = nObs[i];
        if (!o || !o.position || o.active === false) continue;
        if (ignoreWildId && o.isWildRelocatedTreeCollider && o.wildGrowthId === ignoreWildId) continue;
        if (o.type === "tree" || o.type === "rock" || o.type === "iron_ore" || o.type === "gold_ore" || o.type === "glow_ore") {
          const minDist = isTree ? (o.type === "tree" ? 0.75 : 0.45) : 0.30;
          const dx = px - o.position[0], dy = py - o.position[1], dz = pz - o.position[2];
          if (dx * dx + dy * dy + dz * dz < minDist * minDist) return true;
        }
      }
    }

    return false;
  }

  function isIntactSurfaceAt(pos, kind, ignoreItem) {
    if (!pos || pos.length < 3) return null;
    const len = Math.hypot(pos[0], pos[1], pos[2]);
    if (len < 0.001) return null;
    const nx = pos[0] / len, ny = pos[1] / len, nz = pos[2] / len;
    const surf = sampleSurfaceAtDirection(nx, ny, nz);

    const wl = getPlanetWaterLevel();
    const minH = (kind === "BRANCH" || kind === "DRAGON_FRUIT") ? (wl + 0.05) : (wl + 0.04);
    if (surf.height < minH) return null;
    if (kind === "GRASS" && !isGrassValidGround(surf.color, surf.height, ny)) return null;

    const caveMargin = (kind === "BRANCH" || kind === "DRAGON_FRUIT") ? 0.28 : 0.15;
    if (isInsideAnyTunnelOrDugHole(surf.position, caveMargin)) return null;
    if (isBlockedByStructureOrFlora(surf.position, kind, ignoreItem)) return null;

    return surf;
  }

  // ค้นหาจุดพื้นผิวดาวที่ยังสมบูรณ์ในบริเวณใกล้เคียง (ใช้เมื่อพื้นเดิมโดนขุดหรือโดนสิ่งปลูกสร้างทับ)
  function findValidSurfaceNear(origPos, kind, seedVal, ignoreItem) {
    if (!origPos || origPos.length < 3) return null;
    const oLen = Math.hypot(origPos[0], origPos[1], origPos[2]);
    if (oLen < 0.001) return null;
    const origN = [origPos[0] / oLen, origPos[1] / oLen, origPos[2] / oLen];
    const { R, F } = makeTangentBasis(origN);

    const isTree = (kind === "BRANCH" || kind === "DRAGON_FRUIT");
    const minRing = isTree ? 0.55 : 0.28;
    const maxRing = isTree ? 6.0 : 3.6;
    const ringStep = isTree ? 0.45 : 0.28;
    const baseAngleOff = (Math.abs(Math.sin((seedVal || 17) * 12.9898) * 43758.5453) % 1) * Math.PI * 2;

    for (let dist = minRing; dist <= maxRing; dist += ringStep) {
      const steps = dist < 1.2 ? 10 : 16;
      for (let k = 0; k < steps; k++) {
        const ang = baseAngleOff + (k / steps) * Math.PI * 2;
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);
        const cx = origPos[0] + (cosA * R[0] + sinA * F[0]) * dist;
        const cy = origPos[1] + (cosA * R[1] + sinA * F[1]) * dist;
        const cz = origPos[2] + (cosA * R[2] + sinA * F[2]) * dist;
        const valid = isIntactSurfaceAt([cx, cy, cz], kind, ignoreItem);
        if (valid) {
          return valid;
        }
      }
    }
    return null;
  }

  function resolveGrowthLocation(origPos, kind, seedVal, ignoreItem) {
    const intactOrig = isIntactSurfaceAt(origPos, kind, ignoreItem);
    if (intactOrig) {
      return { surface: intactOrig, relocated: false };
    }
    const nearby = findValidSurfaceNear(origPos, kind, seedVal, ignoreItem);
    if (nearby) {
      return { surface: nearby, relocated: true };
    }
    return null;
  }

  function markDynamicRefresh() {
    if (typeof window !== "undefined") {
      window.pendingDynamicCollectibleRefresh = true;
      window._forceDynamicCollectibleRefresh = true;
    }
    if (typeof pendingDynamicCollectibleRefresh !== "undefined") {
      pendingDynamicCollectibleRefresh = true;
    }
  }

  function markStaticRefresh() {
    if (typeof window !== "undefined") {
      window.pendingCollectibleRefresh = true;
    }
    if (typeof pendingCollectibleRefresh !== "undefined") {
      pendingCollectibleRefresh = true;
    }
  }

  // จัดการ Trunk Collider ใน natureObstacles สำหรับต้นไม้ป่าที่ย้ายที่แล้วโตเต็มวัย (Stage 5)
  // เพื่อให้ผู้เล่นเดินชนลำต้นได้จริงเหมือนต้นไม้ปกติ (กล้องข้าม COLLISION_LAYERS.TREE อยู่แล้ว)
  function removeWildTreeCollider(item) {
    if (!item || !item.wildGrowthId) return;
    const nObs = getNatureObstaclesArray();
    if (!nObs) return;
    let removed = false;
    for (let i = nObs.length - 1; i >= 0; i--) {
      const o = nObs[i];
      if (o && o.isWildRelocatedTreeCollider && o.wildGrowthId === item.wildGrowthId) {
        nObs.splice(i, 1);
        removed = true;
      }
    }
    item._trunkColliderRef = null;
    if (removed && typeof showHitboxes !== "undefined" && showHitboxes && typeof buildHitboxes === "function") {
      buildHitboxes();
    }
  }

  function attachWildTreeCollider(item) {
    if (!item || !item.wildGrowthId || !item.position || !item.plantData) return null;
    const sType = String(item.plantData.seedType || "").toUpperCase();
    if (sType !== "BRANCH" && sType !== "DRAGON_FRUIT") return null;

    const nObs = getNatureObstaclesArray();
    if (!nObs) return null;

    // ป้องกันการสร้าง collider ซ้ำ
    for (let i = 0; i < nObs.length; i++) {
      const o = nObs[i];
      if (o && o.isWildRelocatedTreeCollider && o.wildGrowthId === item.wildGrowthId) {
        item._trunkColliderRef = o;
        return o;
      }
    }

    const pos = item.position;
    const n = item.normal || [0, 1, 0];
    const baseScale = item.plantData.baseTreeScale || 0.085;
    const trunkRad = Math.max(0.055, Math.min(0.14, baseScale * 1.1));
    const trunkH = Math.max(0.42, Math.min(0.95, baseScale * 8.0));
    const treeLayer = (typeof COLLISION_LAYERS !== "undefined" && COLLISION_LAYERS.TREE !== undefined)
      ? COLLISION_LAYERS.TREE
      : 1;

    const colObs = {
      id: "wg_col_" + item.wildGrowthId,
      wildGrowthId: item.wildGrowthId,
      isWildRelocatedTreeCollider: true,
      type: "tree",
      isWhiteRedTree: (sType === "DRAGON_FRUIT"),
      layer: treeLayer,
      position: [pos[0], pos[1], pos[2]],
      normal: [n[0], n[1], n[2]],
      radius: Math.max(0.22, trunkRad * 3.0),
      trunkBaseRadius: trunkRad,
      trunkHeight: trunkH,
      colliders: [
        {
          offset: [n[0] * (trunkRad * 0.9), n[1] * (trunkRad * 0.9), n[2] * (trunkRad * 0.9)],
          radius: trunkRad
        },
        {
          offset: [n[0] * (trunkH * 0.45), n[1] * (trunkH * 0.45), n[2] * (trunkH * 0.45)],
          radius: trunkRad * 0.85
        }
      ]
    };

    nObs.push(colObs);
    item._trunkColliderRef = colObs;
    if (typeof showHitboxes !== "undefined" && showHitboxes && typeof buildHitboxes === "function") {
      buildHitboxes();
    }
    return colObs;
  }

  function removeWildGrowingItem(item) {
    if (!item) return;
    removeWildTreeCollider(item);
    item.active = false;
    const cols = getCollectiblesArray();
    if (cols) {
      const ci = cols.indexOf(item);
      if (ci !== -1) cols.splice(ci, 1);
    }
    const wi = _wildGrowingItems.indexOf(item);
    if (wi !== -1) _wildGrowingItems.splice(wi, 1);
  }

  // สร้าง/วาง wild_growing_plant collectible เพื่อแสดงผลตามระยะ 0..5 (ใช้ระบบเดียวกับกล่องดิน)
  function spawnWildGrowingCollectible(cfg) {
    const cols = getCollectiblesArray();
    if (!cols || !cfg || !cfg.surface) return null;

    const surf = cfg.surface;
    const { R, F } = makeTangentBasis(surf.normal);
    const now = typeof cfg.plantTime === "number" ? cfg.plantTime : Date.now();
    const duration = typeof cfg.growthDuration === "number" ? cfg.growthDuration : WILD_GROWTH_DURATION;
    const elapsed = Math.max(0, (now ? (Date.now() - now) / 1000 : 0));
    const stage = Math.min(5, Math.floor((elapsed / duration) * 5));

    const item = {
      type: "wild_growing_plant",
      isWildGrowth: true,
      isWorldGenerated: true,
      isDynamic: false, // อยู่ใน dynamic VBO bucket โดยไม่โดนฟิสิกส์ของตก (เหมือน wood_planter_box)
      active: true,
      position: [surf.position[0], surf.position[1], surf.position[2]],
      normal: [surf.normal[0], surf.normal[1], surf.normal[2]],
      R: R,
      F: F,
      size: 0.35,
      seed: cfg.seed || Math.floor(Math.random() * 100000),
      wildGrowthId: cfg.wildGrowthId || ("wg_" + (_idSeq++) + "_" + Math.floor(Math.random() * 10000)),
      plantData: {
        seedType: cfg.seedType,
        plantTime: now,
        watered: true, // พืชธรรมชาติโตเองอัตโนมัติ
        growthDuration: duration,
        stage: stage,
        mature: elapsed >= duration,
        seed: cfg.seed || Math.floor(Math.random() * 100000),
        useGold: !!cfg.useGold,
        isPolarWhiteLeaf: !!cfg.isPolarWhiteLeaf,
        leafColor: cfg.leafColor || null,
        groundColor: surf.color || cfg.groundColor || null,
        baseTreeScale: cfg.baseTreeScale || 0.085,
        origTreeId: cfg.origTreeId !== undefined ? cfg.origTreeId : null,
        origShrubId: cfg.origShrubId !== undefined ? cfg.origShrubId : null,
        origPos: cfg.origPos ? [cfg.origPos[0], cfg.origPos[1], cfg.origPos[2]] : [surf.position[0], surf.position[1], surf.position[2]],
        relocated: !!cfg.relocated
      }
    };

    cols.push(item);
    _wildGrowingItems.push(item);
    if (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.insert === "function") {
      SpatialGrid.insert(item);
    }
    markDynamicRefresh();
    return item;
  }

  // ซิงก์กอหญ้าลงใน natureVertexBuffer แบบย่อ/ขยายตาม Stage 0..5 โดยไม่สร้าง Draw Call ใหม่
  function applyGrassTuftScaleToVBO(entry, scaleFactor) {
    const rawVerts = (typeof natureRawVertices !== "undefined") ? natureRawVertices : (typeof window !== "undefined" ? window.natureRawVertices : null);
    const natBuf = (typeof natureVertexBuffer !== "undefined") ? natureVertexBuffer : (typeof window !== "undefined" ? window.natureVertexBuffer : null);
    const glCtx = (typeof gl !== "undefined") ? gl : (typeof window !== "undefined" ? window.gl : null);
    if (!rawVerts || !entry || typeof entry.tuftStart !== "number" || typeof entry.tuftEnd !== "number") return false;
    if (entry.tuftEnd > rawVerts.length) return false;

    const len = entry.tuftEnd - entry.tuftStart;

    // กรณี scaleFactor <= 0 (เช่นโดนขุดหรือโดนสิ่งปลูกสร้างทับ): ล้าง vertex ทุกตัวเป็น 0 สนิทเพื่อไม่ให้เหลือเศษโคนหญ้า
    if (scaleFactor <= 0) {
      for (let k = entry.tuftStart; k < entry.tuftEnd; k++) {
        rawVerts[k] = 0;
      }
    } else {
      if (!entry.baseVerts || entry.baseVerts.length !== len) return false;
      const base = entry.baseVerts;
      const c = entry.curPos;
      const wScale = 0.55 + 0.45 * scaleFactor;
      for (let off = 0; off < len; off += 9) {
        const k = entry.tuftStart + off;
        // p1, p2 อยู่โคนหญ้า (ขยับเฉพาะความกว้างเล็กน้อย), tip ยืดขึ้นตาม scaleFactor
        rawVerts[k]     = c[0] + (base[off]     - c[0]) * wScale;
        rawVerts[k + 1] = c[1] + (base[off + 1] - c[1]) * wScale;
        rawVerts[k + 2] = c[2] + (base[off + 2] - c[2]) * wScale;
        rawVerts[k + 3] = c[0] + (base[off + 3] - c[0]) * wScale;
        rawVerts[k + 4] = c[1] + (base[off + 4] - c[1]) * wScale;
        rawVerts[k + 5] = c[2] + (base[off + 5] - c[2]) * wScale;
        rawVerts[k + 6] = c[0] + (base[off + 6] - c[0]) * scaleFactor;
        rawVerts[k + 7] = c[1] + (base[off + 7] - c[1]) * scaleFactor;
        rawVerts[k + 8] = c[2] + (base[off + 8] - c[2]) * scaleFactor;
      }
    }

    if (glCtx && natBuf) {
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, natBuf);
      const sliceView = (typeof rawVerts.subarray === "function")
        ? rawVerts.subarray(entry.tuftStart, entry.tuftEnd)
        : new Float32Array(rawVerts.slice(entry.tuftStart, entry.tuftEnd));
      glCtx.bufferSubData(glCtx.ARRAY_BUFFER, entry.tuftStart * 4, sliceView);
    }
    return true;
  }

  // สร้างชุด vertex ใบหญ้าเต็มวัยใหม่ตรงตำแหน่งที่ย้ายไป (สำหรับเขียนลงสล็อตเดิมใน natureRawVertices)
  function buildRelocatedTuftVertsAt(surface, numBlades, seedVal) {
    const out = new Float32Array(numBlades * 9);
    const c = surface.position;
    const n = surface.normal;
    const { R, F } = makeTangentBasis(n);
    let s = (seedVal || 777) * 1.37 + 13;
    function rFn() {
      const x = Math.sin(s++) * 10000;
      return x - Math.floor(x);
    }
    const tuftHeightScale = 1.0 + rFn() * 0.35;
    for (let b = 0; b < numBlades; b++) {
      const baseAngle = (b / numBlades) * Math.PI * 2;
      const gAngle = baseAngle + (rFn() - 0.5) * 0.50;
      const styleRoll = rFn();
      let lean, gHeight, gWidth, curve;
      if (styleRoll < 0.35) {
        lean = 0.18 + rFn() * 0.25;
        gHeight = (0.080 + rFn() * 0.035) * tuftHeightScale;
        gWidth = 0.013 + rFn() * 0.004;
        curve = (rFn() - 0.5) * 0.45;
      } else if (styleRoll < 0.75) {
        lean = 0.14 + rFn() * 0.22;
        gHeight = (0.120 + rFn() * 0.045) * tuftHeightScale;
        gWidth = 0.015 + rFn() * 0.005;
        curve = (rFn() - 0.5) * 0.55;
      } else {
        lean = 0.08 + rFn() * 0.18;
        gHeight = (0.170 + rFn() * 0.055) * tuftHeightScale;
        gWidth = 0.017 + rFn() * 0.005;
        curve = (rFn() - 0.5) * 0.65;
      }
      const dx = Math.cos(gAngle) * R[0] + Math.sin(gAngle) * F[0] + n[0] * (2.0 - lean);
      const dy = Math.cos(gAngle) * R[1] + Math.sin(gAngle) * F[1] + n[1] * (2.0 - lean);
      const dz = Math.cos(gAngle) * R[2] + Math.sin(gAngle) * F[2] + n[2] * (2.0 - lean);
      const dl = Math.hypot(dx, dy, dz) || 1;
      const dir = [dx / dl, dy / dl, dz / dl];

      let cx = dir[1] * n[2] - dir[2] * n[1];
      let cy = dir[2] * n[0] - dir[0] * n[2];
      let cz = dir[0] * n[1] - dir[1] * n[0];
      let cl = Math.hypot(cx, cy, cz);
      if (cl < 0.0001) { cx = R[0]; cy = R[1]; cz = R[2]; cl = 1; }
      const wDir = [cx / cl, cy / cl, cz / cl];

      const off = b * 9;
      out[off]     = c[0] + wDir[0] * gWidth;
      out[off + 1] = c[1] + wDir[1] * gWidth;
      out[off + 2] = c[2] + wDir[2] * gWidth;
      out[off + 3] = c[0] - wDir[0] * gWidth;
      out[off + 4] = c[1] - wDir[1] * gWidth;
      out[off + 5] = c[2] - wDir[2] * gWidth;
      out[off + 6] = c[0] + dir[0] * gHeight + wDir[0] * gWidth * curve;
      out[off + 7] = c[1] + dir[1] * gHeight + wDir[1] * gWidth * curve;
      out[off + 8] = c[2] + dir[2] * gHeight + wDir[2] * gWidth * curve;
    }
    return out;
  }

  function removeCutGrassPosNear(pos) {
    if (!pos || !Array.isArray(window.cutGrassPositions)) return;
    for (let i = window.cutGrassPositions.length - 1; i >= 0; i--) {
      const cg = window.cutGrassPositions[i];
      if (!Array.isArray(cg) || cg.length < 3) continue;
      const dx = cg[0] - pos[0], dy = cg[1] - pos[1], dz = cg[2] - pos[2];
      if (dx * dx + dy * dy + dz * dz < 0.04) {
        window.cutGrassPositions.splice(i, 1);
        return;
      }
    }
  }

  function canReuseGrassChunkSlot(entry, newPos) {
    if (!entry || typeof entry.tuftStart !== "number" || typeof entry.tuftEnd !== "number") return false;
    if (typeof grassChunks === "undefined" || !Array.isArray(grassChunks)) return false;
    const chunk = (typeof entry.chunkIndex === "number" && grassChunks[entry.chunkIndex]) ? grassChunks[entry.chunkIndex] : null;
    if (!chunk || !chunk.pos) return false;
    const dx = newPos[0] - chunk.pos[0], dy = newPos[1] - chunk.pos[1], dz = newPos[2] - chunk.pos[2];
    const maxR = Math.max(2.0, (chunk.radius || 6.0) - 0.5);
    return (dx * dx + dy * dy + dz * dz) <= maxR * maxR;
  }

  // คืนร่างต้นไม้ที่โตครบ 10 นาที (Stage 5)
  function finalizeMatureWildTree(item) {
    const pData = item.plantData;
    if (!pData) return false;

    const origTreeId = pData.origTreeId;
    const backup = (origTreeId !== null && origTreeId !== undefined) ? _treeVertexBackups.get(origTreeId) : null;

    // กรณีงอกที่ตำแหน่งเดิมและยังมีสำเนา vertex เดิมในแรม -> คืนร่างเข้า natureVertexBuffer เดิมแบบ 0ms!
    if (!pData.relocated && backup && backup.verts) {
      const rawVerts = (typeof natureRawVertices !== "undefined") ? natureRawVertices : (typeof window !== "undefined" ? window.natureRawVertices : null);
      const natBuf = (typeof natureVertexBuffer !== "undefined") ? natureVertexBuffer : (typeof window !== "undefined" ? window.natureVertexBuffer : null);
      const glCtx = (typeof gl !== "undefined") ? gl : (typeof window !== "undefined" ? window.gl : null);
      const nObs = getNatureObstaclesArray();
      const cTrees = (typeof choppedTrees !== "undefined") ? choppedTrees : (typeof window !== "undefined" ? window.choppedTrees : null);

      const startF = backup.meshStart * 3;
      const endF = backup.meshEnd * 3;
      if (rawVerts && endF <= rawVerts.length && backup.verts.length === (endF - startF)) {
        rawVerts.set(backup.verts, startF);
        if (glCtx && natBuf) {
          glCtx.bindBuffer(glCtx.ARRAY_BUFFER, natBuf);
          glCtx.bufferSubData(glCtx.ARRAY_BUFFER, startF * 4, backup.verts);
        }
        if (Array.isArray(cTrees)) {
          const idx = cTrees.indexOf(origTreeId);
          if (idx !== -1) cTrees.splice(idx, 1);
          if (typeof window !== "undefined") window.choppedTrees = cTrees;
        }
        if (Array.isArray(nObs) && backup.obstacle) {
          const restoredObs = {
            ...backup.obstacle,
            hits: 0,
            handHits: 0,
            fruitPositions: Array.isArray(backup.fruitPositions) ? backup.fruitPositions.map(f => ({ ...f })) : []
          };
          nObs.push(restoredObs);
          // อัปเดต fruitPositions ใน allDeterministicNatureObstacles ด้วยเพื่อให้ syncTreeAttachedFruits ทำงาน
          if (Array.isArray(window.allDeterministicNatureObstacles)) {
            const det = window.allDeterministicNatureObstacles.find(o => o && o.id === origTreeId);
            if (det && restoredObs.fruitPositions.length > 0) {
              det.fruitPositions = restoredObs.fruitPositions;
            }
          }
        }
        _treeVertexBackups.delete(origTreeId);

        // ลบ wild_growing_plant ตัวช่วยออก
        removeWildGrowingItem(item);

        if (typeof window.syncTreeAttachedFruits === "function" && backup.obstacle && backup.obstacle.isWhiteRedTree) {
          window.syncTreeAttachedFruits();
        }
        if (typeof showHitboxes !== "undefined" && showHitboxes && typeof buildHitboxes === "function") {
          buildHitboxes();
        }
        markDynamicRefresh();
        return true;
      }
    }

    // กรณีย้ายไปงอกจุดใหม่ใกล้เคียง หรือหลังโหลดเซฟ (ไม่มี vertex backup ในแรม):
    // คงเป็นต้นไม้โตเต็มวัยที่ฟันตัดได้ด้วยขวานเหมือนต้นไม้จริง + ติดตั้งตัวชนลำต้นใน natureObstacles
    pData.mature = true;
    pData.stage = 5;
    pData.progress = 1.0;
    item._matureFinalized = true;
    attachWildTreeCollider(item);
    markDynamicRefresh();
    return true;
  }

  // คืนร่างต้นฝ้าย / ต้นรัก ที่โตครบ 10 นาที ให้กลับมาเป็นไอเทมเก็บได้ตามปกติ
  function finalizeMatureWildShrub(item, deferGridRebuild) {
    const pData = item.plantData;
    const cols = getCollectiblesArray();
    if (!pData || !cols) return false;

    const isCotton = String(pData.seedType || "").toUpperCase().includes("COTTON");
    const shrubType = isCotton ? "cotton_plant" : "crown_flower";
    const idField = isCotton ? "cottonId" : "crownFlowerId";
    const idVal = pData.origShrubId || (shrubType + "_wild_" + (_idSeq++));

    // ลบ worldKey เดิมออกจาก savedRemovedWorldKeys เพื่อให้เซฟแล้วยังอยู่
    if (Array.isArray(window.savedRemovedWorldKeys)) {
      const kIdx = window.savedRemovedWorldKeys.indexOf(idVal);
      if (kIdx !== -1) window.savedRemovedWorldKeys.splice(kIdx, 1);
    }

    // คืนสถานะ active ใน natureObstacles / allDeterministicNatureObstacles
    const numId = parseInt(String(idVal).replace("cotton_", "").replace("crown_flower_", ""), 10);
    if (!isNaN(numId)) {
      const lists = [window.allDeterministicNatureObstacles, window.natureObstacles];
      for (let li = 0; li < lists.length; li++) {
        const list = lists[li];
        if (!Array.isArray(list)) continue;
        const obs = list.find(o => o && o.id === numId);
        if (obs) {
          obs.active = true;
          obs.position = [item.position[0], item.position[1], item.position[2]];
          obs.normal = [item.normal[0], item.normal[1], item.normal[2]];
          obs.R = item.R ? [...item.R] : obs.R;
          obs.F = item.F ? [...item.F] : obs.F;
        }
      }
    }

    // หา collectible เดิมแล้วคืนชีพ หรือสร้างใหม่ที่พิกัดที่โตเสร็จ
    let targetCol = cols.find(c => c && c[idField] === idVal);
    if (targetCol) {
      targetCol.active = true;
      targetCol.isDemolished = false;
      targetCol.position = [item.position[0], item.position[1], item.position[2]];
      targetCol.normal = [item.normal[0], item.normal[1], item.normal[2]];
      targetCol.R = item.R ? [...item.R] : targetCol.R;
      targetCol.F = item.F ? [...item.F] : targetCol.F;
      targetCol.isWildRelocated = !!pData.relocated;
    } else {
      targetCol = {
        type: shrubType,
        position: [item.position[0], item.position[1], item.position[2]],
        normal: [item.normal[0], item.normal[1], item.normal[2]],
        R: item.R ? [...item.R] : [1, 0, 0],
        F: item.F ? [...item.F] : [0, 0, 1],
        active: true,
        size: 0.06,
        seed: pData.seed || Math.floor(Math.random() * 100000),
        color: isCotton ? [0.96, 0.96, 0.94] : [0.92, 0.90, 0.96],
        isDynamic: false,
        isWorldGenerated: true,
        isWildRelocated: !!pData.relocated,
        worldKey: idVal
      };
      targetCol[idField] = idVal;
      cols.push(targetCol);
    }

    // ลบตัวช่วยกำลังโตออก
    removeWildGrowingItem(item);

    if (!deferGridRebuild && typeof SpatialGrid !== "undefined" && typeof SpatialGrid.rebuild === "function") {
      SpatialGrid.rebuild(cols);
    }
    markDynamicRefresh();
    markStaticRefresh();
    return true;
  }

  // ย้ายพืชกำลังโตไปยังจุดพื้นผิวดาวใกล้เคียงเมื่อจุดเดิมโดนขุดหรือโดนสิ่งปลูกสร้างทับ
  function relocateWildGrowingItem(item, resetTimer, deferGridRebuild) {
    if (!item || !item.plantData) return false;
    removeWildTreeCollider(item);
    const pData = item.plantData;
    const seedType = String(pData.seedType || "BRANCH").toUpperCase();
    const nearby = findValidSurfaceNear(item.position || pData.origPos, seedType, (pData.seed || 17) + Math.floor(Math.random() * 997), item);
    if (!nearby) {
      // ไม่มีพื้นที่ว่างในรัศมีใกล้เคียงเลย -> ยกเลิกต้นนี้
      removeWildGrowingItem(item);
      if (!deferGridRebuild && typeof SpatialGrid !== "undefined" && typeof SpatialGrid.rebuild === "function") {
        const cols = getCollectiblesArray();
        if (cols) SpatialGrid.rebuild(cols);
      }
      markDynamicRefresh();
      return false;
    }

    const { R, F } = makeTangentBasis(nearby.normal);
    item.position = [nearby.position[0], nearby.position[1], nearby.position[2]];
    item.normal = [nearby.normal[0], nearby.normal[1], nearby.normal[2]];
    item.R = R;
    item.F = F;
    pData.relocated = true;
    pData.groundColor = nearby.color;
    pData.isPolarWhiteLeaf = (seedType === "BRANCH" && Math.abs(nearby.normal[1]) >= 0.60);
    pData.useGold = (seedType === "DRAGON_FRUIT" && Math.abs(nearby.normal[1]) >= 0.60);
    if (resetTimer) {
      pData.plantTime = Date.now();
      pData.stage = 0;
      pData.progress = 0;
      pData.mature = false;
      pData.hits = 0;
      pData.handHits = 0;
      item._matureFinalized = false;
    } else if (pData.mature && (seedType === "BRANCH" || seedType === "DRAGON_FRUIT")) {
      attachWildTreeCollider(item);
    }
    if (!deferGridRebuild && typeof SpatialGrid !== "undefined") {
      const cols = getCollectiblesArray();
      if (cols && typeof SpatialGrid.rebuild === "function") {
        SpatialGrid.rebuild(cols);
      } else if (typeof SpatialGrid.insert === "function") {
        SpatialGrid.insert(item);
      }
    }
    markDynamicRefresh();
    return true;
  }

  function relocateOverlappingWildPlants(checkPts, hitR) {
    if (!Array.isArray(checkPts) || checkPts.length === 0) return;
    const hitRSq = hitR * hitR;
    let movedAnyWild = false;

    // A. ย้าย wild_growing_plant ที่โดนขุดหรือโดนสิ่งปลูกสร้างทับ (วนเฉพาะ _wildGrowingItems)
    for (let i = _wildGrowingItems.length - 1; i >= 0; i--) {
      const c = _wildGrowingItems[i];
      if (!c || !c.active || !c.position) {
        _wildGrowingItems.splice(i, 1);
        continue;
      }
      let hit = false;
      for (let p = 0; p < checkPts.length; p++) {
        const pt = checkPts[p];
        const dx = c.position[0] - pt[0], dy = c.position[1] - pt[1], dz = c.position[2] - pt[2];
        if (dx * dx + dy * dy + dz * dz <= hitRSq) { hit = true; break; }
      }
      if (hit) {
        relocateWildGrowingItem(c, true, true);
        movedAnyWild = true;
      }
    }
    if (movedAnyWild && typeof SpatialGrid !== "undefined" && typeof SpatialGrid.rebuild === "function") {
      const cols = getCollectiblesArray();
      if (cols) SpatialGrid.rebuild(cols);
    }

    // B. ย้ายกอหญ้าที่กำลังงอกอยู่ใน natureRawVertices แต่โดนขุดหรือโดนสิ่งปลูกสร้างทับ
    for (let i = _grassRegrowthEntries.length - 1; i >= 0; i--) {
      const e = _grassRegrowthEntries[i];
      if (!e || !e.curPos) {
        _grassRegrowthEntries.splice(i, 1);
        continue;
      }
      let hit = false;
      for (let p = 0; p < checkPts.length; p++) {
        const pt = checkPts[p];
        const dx = e.curPos[0] - pt[0], dy = e.curPos[1] - pt[1], dz = e.curPos[2] - pt[2];
        if (dx * dx + dy * dy + dz * dz <= hitRSq) { hit = true; break; }
      }
      if (hit) {
        // ลบหน่อหญ้าเก่าที่โดนทับออกเป็น 0 สนิทก่อนย้าย
        applyGrassTuftScaleToVBO(e, 0.0);
        const nearby = findValidSurfaceNear(e.curPos, "GRASS", (e.tuftStart || 19) + Math.floor(Math.random() * 997), null);
        if (nearby) {
          if (canReuseGrassChunkSlot(e, nearby.position)) {
            const numBlades = Math.max(3, Math.round((e.tuftEnd - e.tuftStart) / 9));
            e.curPos = [nearby.position[0], nearby.position[1], nearby.position[2]];
            e.baseVerts = buildRelocatedTuftVertsAt(nearby, numBlades, e.tuftStart + 31);
            e.relocated = true;
            e.plantTime = Date.now();
            e.stage = 0;
            applyGrassTuftScaleToVBO(e, 0.16);
          } else {
            _grassRegrowthEntries.splice(i, 1);
            spawnWildGrowingCollectible({
              seedType: "GRASS",
              surface: nearby,
              relocated: true,
              origPos: e.origPos,
              seed: (e.tuftStart || 23) + 31,
              plantTime: Date.now(),
              growthDuration: WILD_GROWTH_DURATION
            });
          }
        } else {
          _grassRegrowthEntries.splice(i, 1);
        }
      }
    }
  }

  const WildPlantGrowthSystem = {
    WILD_GROWTH_DURATION: WILD_GROWTH_DURATION,

    reset: function () {
      // ลบตัวชนลำต้นของต้นไม้ย้ายที่เดิมออกจาก natureObstacles ด้วย
      const nObs = getNatureObstaclesArray();
      if (nObs) {
        for (let i = nObs.length - 1; i >= 0; i--) {
          if (nObs[i] && nObs[i].isWildRelocatedTreeCollider) {
            nObs.splice(i, 1);
          }
        }
      }
      _wildGrowingItems.length = 0;
      _treeVertexBackups.clear();
      _grassRegrowthEntries.length = 0;
      _treeFruitRegrowthEntries.length = 0;
      _lastUpdateCheck = 0;
      _lastValidatedTopoVer = -1;
      _lastValidatedTunnelLen = -1;
      _lastValidatedHouseLen = -1;
      _lastValidatedColsLen = -1;
      _forceSurfaceValidation = true;
    },

    // เช็กว่ากอหญ้าในสล็อต natureRawVertices นี้กำลังอยู่ในช่วงงอกอ่อน (Stage < 3) หรือไม่
    // ป้องกันการฟันซ้ำหน่อหญ้าที่เพิ่งงอกเพื่อปั๊มใบหญ้าไม่จำกัด
    isGrassSlotImmature: function (tuftStart, tuftEnd) {
      if (_grassRegrowthEntries.length === 0) return false;
      for (let i = 0; i < _grassRegrowthEntries.length; i++) {
        const e = _grassRegrowthEntries[i];
        if (!e) continue;
        if (e.tuftStart === tuftStart && e.tuftEnd === tuftEnd) {
          return (e.stage || 0) < 3;
        }
      }
      return false;
    },

    // เรียกจาก inventory.js เมื่อผู้เล่นตัดต้นไม้ wild_growing_plant ที่โตเต็มวัยลง
    onWildTreeChopped: function (item) {
      if (!item || !item.plantData) return;
      removeWildTreeCollider(item);
      const pData = item.plantData;
      pData.plantTime = Date.now();
      pData.growthDuration = WILD_GROWTH_DURATION;
      pData.stage = 0;
      pData.progress = 0;
      pData.mature = false;
      pData.hits = 0;
      pData.handHits = 0;
      item._matureFinalized = false;
      markDynamicRefresh();
    },

    // 1. เรียกเมื่อต้นไม้บนดาวถูกตัด (inventory.js) หรือโดนขุดพื้นใต้ราก (devgame.js) หรือโดนวางพื้นหินทับ
    onTreeDestroyed: function (obs, wasDug, origVertsBackup) {
      if (!obs || !obs.position || obs.type !== "tree" || obs.isWildRelocatedTreeCollider) return null;

      // สำรอง vertex เดิมในแรมเผื่อคืนร่างเข้า natureVertexBuffer ตอนโตครบ 10 นาทีที่ตำแหน่งเดิม
      if (!wasDug && origVertsBackup && typeof obs.meshStart === "number" && typeof obs.meshEnd === "number") {
        _treeVertexBackups.set(obs.id, {
          meshStart: obs.meshStart,
          meshEnd: obs.meshEnd,
          verts: origVertsBackup,
          obstacle: {
            id: obs.id,
            type: obs.type,
            isWhiteRedTree: !!obs.isWhiteRedTree,
            layer: obs.layer,
            normal: obs.normal ? [...obs.normal] : [0, 1, 0],
            position: [...obs.position],
            radius: obs.radius,
            trunkHeight: obs.trunkHeight,
            trunkBaseRadius: obs.trunkBaseRadius,
            meshStart: obs.meshStart,
            meshEnd: obs.meshEnd
          },
          fruitPositions: Array.isArray(obs._origFruitPositions)
            ? obs._origFruitPositions.map(f => ({ ...f }))
            : (Array.isArray(obs.fruitPositions) ? obs.fruitPositions.map(f => ({ ...f })) : [])
        });
      }

      // ป้องกันการสร้างตัวซ้ำสำหรับต้นไม้ ID เดียวกัน (เช็กจาก _wildGrowingItems โดยตรง)
      for (let i = 0; i < _wildGrowingItems.length; i++) {
        const c = _wildGrowingItems[i];
        if (c && c.active && c.plantData && c.plantData.origTreeId === obs.id) return c;
      }

      const seedType = obs.isWhiteRedTree ? "DRAGON_FRUIT" : "BRANCH";
      const treeSeed = (typeof obs.id === "number" ? obs.id * 37 + 101 : Math.floor(Math.random() * 100000));
      const loc = resolveGrowthLocation(obs.position, seedType, treeSeed, null);
      if (!loc) return null;

      const ny = loc.surface.normal[1];
      const isPolar = Math.abs(ny) >= 0.60;
      const baseScale = (typeof obs.radius === "number" && obs.radius > 0.1)
        ? Math.max(0.045, Math.min(0.14, obs.radius / 12.0))
        : 0.085;

      return spawnWildGrowingCollectible({
        seedType: seedType,
        surface: loc.surface,
        relocated: loc.relocated || !!wasDug,
        origPos: obs.position,
        origTreeId: obs.id,
        seed: treeSeed,
        baseTreeScale: baseScale,
        useGold: obs.isWhiteRedTree && isPolar,
        isPolarWhiteLeaf: !obs.isWhiteRedTree && isPolar,
        plantTime: Date.now(),
        growthDuration: WILD_GROWTH_DURATION
      });
    },

    // 2. เรียกเมื่อเก็บผลแก้วมังกรที่ติดอยู่บนต้น หรือเก็บต้นฝ้าย/ต้นรักป่า
    onCollectibleHarvested: function (item) {
      if (!item || !item.position) return null;

      // 2A. ผลแก้วมังกรที่ยังติดอยู่บนต้นเท่านั้น (isAttachedToTree === true)
      // ไม่สร้าง timer ให้ผลที่ร่วงจากต้นไม้ที่ถูกโค่นไปแล้ว
      if (item.type === "dragon_fruit" && item.isAttachedToTree === true && item.fruitId && typeof item.treeId === "number") {
        const dup = _treeFruitRegrowthEntries.find(e => e.fruitId === item.fruitId);
        if (!dup) {
          _treeFruitRegrowthEntries.push({
            fruitId: item.fruitId,
            treeId: item.treeId,
            fruitIdx: item.fruitIdx || 0,
            plantTime: Date.now(),
            growthDuration: WILD_GROWTH_DURATION
          });
        }
        return true;
      }

      // 2B. ต้นฝ้ายป่า หรือ ต้นรักป่า (ไม่นับของที่ผู้เล่นโยนทิ้งลงพื้นเอง)
      if (!item.isGroundDrop && !item.isPlayerDropped) {
        if ((item.type === "cotton_plant" && (item.cottonId || item.isWildRelocated)) ||
            (item.type === "crown_flower" && (item.crownFlowerId || item.isWildRelocated))) {
          return this.onShrubCollectedOrDestroyed(item, false);
        }
      }
      return null;
    },

    onShrubCollectedOrDestroyed: function (item, wasDug) {
      if (!item || !item.position) return null;
      const isCotton = (item.type === "cotton_plant");
      const seedType = isCotton ? "COTTON_PLANT" : "CROWN_FLOWER";
      const origShrubId = isCotton ? (item.cottonId || item.worldKey) : (item.crownFlowerId || item.worldKey);
      if (origShrubId) {
        for (let i = 0; i < _wildGrowingItems.length; i++) {
          const c = _wildGrowingItems[i];
          if (c && c.active && c.plantData && c.plantData.origShrubId === origShrubId) return c;
        }
      }

      const shrubSeed = (typeof item.seed === "number" ? item.seed : Math.floor(Math.random() * 100000));
      const loc = resolveGrowthLocation(item.position, seedType, shrubSeed, item);
      if (!loc) return null;

      return spawnWildGrowingCollectible({
        seedType: seedType,
        surface: loc.surface,
        relocated: loc.relocated || !!wasDug,
        origPos: item.position,
        origShrubId: origShrubId || (item.type + "_wild_" + (_idSeq++)),
        seed: shrubSeed,
        plantTime: Date.now(),
        growthDuration: WILD_GROWTH_DURATION
      });
    },

    // 3. เรียกเมื่อกอหญ้าถูกตัดด้วยมีดตันโตะ (ก่อนลบ vertex เป็น 0 ใน inventory.js)
    onGrassTuftCut: function (tuftInfo) {
      if (!tuftInfo || !tuftInfo.center || !tuftInfo.origVerts) return null;

      // ตรวจว่าจุดนี้กำลังรอโตอยู่แล้วหรือไม่ (ถ้าตัดตอน Stage >= 3 ให้เริ่มนับเวลา 10 นาทีใหม่)
      const existingIdx = _grassRegrowthEntries.findIndex(e => e.tuftStart === tuftInfo.tuftStart && e.tuftEnd === tuftInfo.tuftEnd);
      if (existingIdx !== -1) {
        const ex = _grassRegrowthEntries[existingIdx];
        ex.plantTime = Date.now();
        ex.stage = 0;
        applyGrassTuftScaleToVBO(ex, 0.16);
        return ex;
      }

      const loc = resolveGrowthLocation(tuftInfo.center, "GRASS", tuftInfo.tuftStart || 13, null);
      if (!loc) return null;

      const numBlades = Math.max(3, Math.round((tuftInfo.tuftEnd - tuftInfo.tuftStart) / 9));
      const entry = {
        id: "gr_" + (_idSeq++),
        tuftStart: tuftInfo.tuftStart,
        tuftEnd: tuftInfo.tuftEnd,
        chunkIndex: tuftInfo.chunkIndex,
        origPos: [tuftInfo.center[0], tuftInfo.center[1], tuftInfo.center[2]],
        curPos: [loc.surface.position[0], loc.surface.position[1], loc.surface.position[2]],
        baseVerts: loc.relocated
          ? buildRelocatedTuftVertsAt(loc.surface, numBlades, tuftInfo.tuftStart)
          : tuftInfo.origVerts,
        relocated: loc.relocated,
        plantTime: Date.now(),
        growthDuration: WILD_GROWTH_DURATION,
        stage: 0
      };

      // ถ้าย้ายออกนอกรัศมี grassChunk เดิม -> ใช้ wild_growing_plant (seedType: "GRASS") แทน
      if (loc.relocated && !canReuseGrassChunkSlot(entry, entry.curPos)) {
        return spawnWildGrowingCollectible({
          seedType: "GRASS",
          surface: loc.surface,
          relocated: true,
          origPos: tuftInfo.center,
          seed: tuftInfo.tuftStart || Math.floor(Math.random() * 100000),
          plantTime: Date.now(),
          growthDuration: WILD_GROWTH_DURATION
        });
      }

      _grassRegrowthEntries.push(entry);
      // แสดงหน่อหญ้าสั้นๆ (Stage 0) ทันที
      applyGrassTuftScaleToVBO(entry, 0.16);
      return entry;
    },

    // 4. เรียกก่อน suppressGrassUnder ใน devgame.js เมื่อผู้เล่นขุดหลุมทำลายหญ้าบนผิวดาว
    onGrassDugAt: function (digCenters, radius) {
      if (!Array.isArray(digCenters) || digCenters.length === 0) return;
      const rawVerts = (typeof natureRawVertices !== "undefined") ? natureRawVertices : (typeof window !== "undefined" ? window.natureRawVertices : null);
      if (typeof grassChunks === "undefined" || !Array.isArray(grassChunks) || !rawVerts) return;

      const rSq = radius * radius;
      const pickedCenters = [];

      for (let dc = 0; dc < digCenters.length && pickedCenters.length < MAX_RELOCATED_GRASS_PER_DIG; dc++) {
        const pos = digCenters[dc];
        if (!pos) continue;
        for (let i = 0; i < grassChunks.length && pickedCenters.length < MAX_RELOCATED_GRASS_PER_DIG; i++) {
          const chunk = grassChunks[i];
          if (!chunk || !chunk.pos) continue;
          const cdx = chunk.pos[0] - pos[0], cdy = chunk.pos[1] - pos[1], cdz = chunk.pos[2] - pos[2];
          const maxR = (chunk.radius || 6.0) + radius;
          if (cdx * cdx + cdy * cdy + cdz * cdz > maxR * maxR) continue;

          const startF = chunk.start * 3;
          const endF = (chunk.start + chunk.count) * 3;
          for (let j = startF; j < endF && pickedCenters.length < MAX_RELOCATED_GRASS_PER_DIG; j += 9) {
            const v0x = rawVerts[j], v0y = rawVerts[j + 1], v0z = rawVerts[j + 2];
            const v1x = rawVerts[j + 3], v1y = rawVerts[j + 4], v1z = rawVerts[j + 5];
            if (v0x === 0 && v0y === 0 && v0z === 0 && v1x === 0 && v1y === 0 && v1z === 0) continue;
            const bx = (v0x + v1x) * 0.5, by = (v0y + v1y) * 0.5, bz = (v0z + v1z) * 0.5;
            const vx = bx - pos[0], vy = by - pos[1], vz = bz - pos[2];
            if (vx * vx + vy * vy + vz * vz >= rSq) continue;

            // เว้นระยะห่างระหว่างกอที่ย้ายไปงอกใหม่เล็กน้อย ไม่ให้ย้ายซ้อนจุดเดียวกัน
            let tooClose = false;
            for (let p = 0; p < pickedCenters.length; p++) {
              const pdx = bx - pickedCenters[p][0], pdy = by - pickedCenters[p][1], pdz = bz - pickedCenters[p][2];
              if (pdx * pdx + pdy * pdy + pdz * pdz < 0.09) {
                tooClose = true;
                break;
              }
            }
            if (tooClose) continue;
            pickedCenters.push([bx, by, bz]);

            const loc = findValidSurfaceNear([bx, by, bz], "GRASS", j + Math.floor(Math.random() * 997), null);
            if (loc) {
              spawnWildGrowingCollectible({
                seedType: "GRASS",
                surface: loc,
                relocated: true,
                origPos: [bx, by, bz],
                seed: j + 17,
                plantTime: Date.now(),
                growthDuration: WILD_GROWTH_DURATION
              });
            }
          }
        }
      }
    },

    // 5. เรียกหลังผู้เล่นขุดหลุมใหม่ เพื่อย้ายพืชที่กำลังโตอยู่บริเวณปากหลุมไปงอกพื้นผิวใกล้เคียงแทน
    onTerrainDug: function (digPos, surfPos, radius) {
      const checkPts = [digPos, surfPos].filter(Boolean);
      const hitR = (radius || 0.1) * 1.15 + 0.16;
      relocateOverlappingWildPlants(checkPts, hitR);
      _forceSurfaceValidation = true;
    },

    // 5B. เรียกหลังวางสิ่งปลูกสร้าง (พื้นหิน, พื้นไม้, ผนัง, กองไฟ, ฯลฯ) เพื่อย้ายพืชที่กำลังโตบริเวณนั้นทันที
    onStructurePlaced: function (pos, radius) {
      if (!pos) return;
      const hitR = (typeof radius === "number" && radius > 0) ? (radius + 0.25) : 0.75;
      relocateOverlappingWildPlants([pos], hitR);
      _forceSurfaceValidation = true;
    },

    // 6. ตัดกอหญ้าที่ย้ายไปงอกในรูปแบบ wild_growing_plant (เรียกจาก cutGrassWithKnife)
    tryCutRelocatedWildGrass: function (charPos, slashReach, actor, directCollect) {
      if (!charPos || _wildGrowingItems.length === 0) return false;
      const reachSq = (slashReach + 0.12) * (slashReach + 0.12);
      let best = null;
      let bestDistSq = Infinity;

      for (let i = 0; i < _wildGrowingItems.length; i++) {
        const c = _wildGrowingItems[i];
        if (!c || !c.active || !c.plantData || !c.position) continue;
        if (String(c.plantData.seedType || "").toUpperCase() !== "GRASS") continue;
        // ยอมให้ตัดได้เมื่อโตตั้งแต่ Stage 3 ขึ้นไปหรือโตเต็มวัย
        if ((c.plantData.stage || 0) < 3 && !c.plantData.mature) continue;
        const dx = c.position[0] - charPos[0], dy = c.position[1] - charPos[1], dz = c.position[2] - charPos[2];
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq <= reachSq && dSq < bestDistSq) {
          bestDistSq = dSq;
          best = c;
        }
      }

      if (!best) return false;

      const bladeCount = 4 + Math.floor(Math.random() * 3);
      const n = best.normal || [0, 1, 0];
      const { R, F } = makeTangentBasis(n);
      for (let b = 0; b < bladeCount; b++) {
        if (directCollect && actor) {
          actor.addItem({ name: "GRASS", icon: "🌱", label: "GRASS", count: 1 }, false, false);
        } else if (typeof window.GroundDropSystem !== "undefined" && typeof window.GroundDropSystem.spawn === "function") {
          const ang = (b / bladeCount) * Math.PI * 2;
          const outX = Math.cos(ang) * R[0] + Math.sin(ang) * F[0];
          const outY = Math.cos(ang) * R[1] + Math.sin(ang) * F[1];
          const outZ = Math.cos(ang) * R[2] + Math.sin(ang) * F[2];
          window.GroundDropSystem.spawn({
            type: "grass",
            position: [
              best.position[0] + outX * 0.02 + n[0] * 0.025,
              best.position[1] + outY * 0.02 + n[1] * 0.025,
              best.position[2] + outZ * 0.02 + n[2] * 0.025
            ],
            normal: n,
            R: R,
            F: F,
            rawBasis: true,
            applyScatter: false,
            color: [0.14, 0.62, 0.16],
            size: 0.13,
            vel: [outX * 0.003 + n[0] * 0.004, outY * 0.003 + n[1] * 0.004, outZ * 0.003 + n[2] * 0.004],
            skipRefresh: true
          });
        }
      }

      // เริ่มนับเวลา 10 นาทีใหม่สำหรับกอหญ้านี้
      best.plantData.plantTime = Date.now();
      best.plantData.stage = 0;
      best.plantData.progress = 0;
      best.plantData.mature = false;
      best._matureFinalized = false;
      markDynamicRefresh();
      if (typeof playChopSound === "function") playChopSound(best.position);
      return { hit: true, destroyed: true, hitType: "grass", bladesCut: bladeCount };
    },

    // 7. อัปเดตความคืบหน้าพืชป่าทุกต้นแบบอิสระ (เรียกจาก renderer.js ต่อจาก PlanterSystem.update)
    update: function (dt) {
      const now = Date.now();
      if (now - _lastUpdateCheck < UPDATE_INTERVAL_MS) return;
      _lastUpdateCheck = now;

      // ออกทันทีเมื่อไม่มีพืชป่าใดๆ ที่ต้องอัปเดต (O(1) เมื่อดาวสมบูรณ์)
      if (_wildGrowingItems.length === 0 && _grassRegrowthEntries.length === 0 && _treeFruitRegrowthEntries.length === 0) {
        return;
      }

      const cols = getCollectiblesArray();
      const tunnels = getTunnelsArray();
      const houses = (typeof window !== "undefined" && Array.isArray(window.placedHouses)) ? window.placedHouses : null;
      const curTopoVer = (typeof window !== "undefined" && typeof window._collectiblesTopologyVersion === "number")
        ? window._collectiblesTopologyVersion
        : 0;
      const curTunnelLen = tunnels ? tunnels.length : 0;
      const curHouseLen = houses ? houses.length : 0;
      const curColsLen = cols ? cols.length : 0;

      const worldMutated = _forceSurfaceValidation ||
        curTopoVer !== _lastValidatedTopoVer ||
        curTunnelLen !== _lastValidatedTunnelLen ||
        curHouseLen !== _lastValidatedHouseLen ||
        curColsLen !== _lastValidatedColsLen;

      let needDynamicRefresh = false;
      let needStaticRefresh = false;
      let needGridRebuild = false;

      // 7A. อัปเดตเฉพาะ _wildGrowingItems (ไม่ต้องสแกน collectibles ทั้งดาว)
      for (let i = _wildGrowingItems.length - 1; i >= 0; i--) {
        const item = _wildGrowingItems[i];
        if (!item || !item.active || !item.plantData) {
          if (item) removeWildTreeCollider(item);
          _wildGrowingItems.splice(i, 1);
          continue;
        }
        const pData = item.plantData;
        const sType = String(pData.seedType || "BRANCH").toUpperCase();
        const dur = (typeof pData.growthDuration === "number" && pData.growthDuration > 0) ? pData.growthDuration : WILD_GROWTH_DURATION;
        const elapsed = Math.max(0, (now - (pData.plantTime || now)) / 1000);
        const newStage = Math.min(5, Math.floor((elapsed / dur) * 5));
        const isNowMature = elapsed >= dur;
        const stageChanged = (newStage !== pData.stage);
        const maturingNow = (isNowMature && !item._matureFinalized);

        // เช็กพื้นผิวเฉพาะเมื่อโลกมีการเปลี่ยนแปลง (ขุด/วางสิ่งปลูกสร้าง) หรือตอนเปลี่ยนระยะ/กำลังจะโตเต็มวัย
        if (worldMutated || stageChanged || maturingNow) {
          const stillIntact = isIntactSurfaceAt(item.position, sType, item);
          if (!stillIntact) {
            if (relocateWildGrowingItem(item, true, true)) {
              needDynamicRefresh = true;
            }
            needGridRebuild = true;
            continue;
          }
        }

        if (stageChanged) {
          pData.stage = newStage;
          pData.progress = Math.min(1.0, elapsed / dur);
          needDynamicRefresh = true;
        }

        if (maturingNow) {
          pData.progress = 1.0;
          pData.stage = 5;
          pData.mature = true;
          if (sType === "BRANCH" || sType === "DRAGON_FRUIT") {
            finalizeMatureWildTree(item);
            needDynamicRefresh = true;
          } else if (sType === "COTTON_PLANT" || sType === "CROWN_FLOWER") {
            finalizeMatureWildShrub(item, true);
            needDynamicRefresh = true;
            needStaticRefresh = true;
            needGridRebuild = true;
          } else if (sType === "GRASS") {
            item._matureFinalized = true;
            removeCutGrassPosNear(pData.origPos);
            needDynamicRefresh = true;
          }
        }
      }

      // 7B. อัปเดตกอหญ้าที่กำลังงอกใหม่ใน natureVertexBuffer
      for (let i = _grassRegrowthEntries.length - 1; i >= 0; i--) {
        const entry = _grassRegrowthEntries[i];
        if (!entry) { _grassRegrowthEntries.splice(i, 1); continue; }
        const dur = entry.growthDuration || WILD_GROWTH_DURATION;
        const elapsed = Math.max(0, (now - entry.plantTime) / 1000);
        const newStage = Math.min(5, Math.floor((elapsed / dur) * 5));

        if (newStage !== entry.stage || elapsed >= dur || worldMutated) {
          // เช็กก่อนว่าจุดนี้ยังไม่โดนขุดหรือโดนบ้าน/พื้นทับ
          const stillIntact = isIntactSurfaceAt(entry.curPos, "GRASS", null);
          if (!stillIntact) {
            // ลบหน่อหญ้าเก่าที่โดนทับออกเป็น 0 สนิท
            applyGrassTuftScaleToVBO(entry, 0.0);
            const nearby = findValidSurfaceNear(entry.curPos, "GRASS", (entry.tuftStart || 11) + i * 7, null);
            if (nearby && canReuseGrassChunkSlot(entry, nearby.position)) {
              const numBlades = Math.max(3, Math.round((entry.tuftEnd - entry.tuftStart) / 9));
              entry.curPos = [nearby.position[0], nearby.position[1], nearby.position[2]];
              entry.baseVerts = buildRelocatedTuftVertsAt(nearby, numBlades, entry.tuftStart + 43);
              entry.relocated = true;
              entry.plantTime = now;
              entry.stage = 0;
              applyGrassTuftScaleToVBO(entry, 0.16);
            } else {
              _grassRegrowthEntries.splice(i, 1);
              if (nearby) {
                spawnWildGrowingCollectible({
                  seedType: "GRASS",
                  surface: nearby,
                  relocated: true,
                  origPos: entry.origPos,
                  seed: (entry.tuftStart || 17) + 43,
                  plantTime: now,
                  growthDuration: WILD_GROWTH_DURATION
                });
                needDynamicRefresh = true;
              }
            }
            continue;
          }

          if (newStage !== entry.stage || elapsed >= dur) {
            entry.stage = newStage;
            if (elapsed >= dur) {
              applyGrassTuftScaleToVBO(entry, 1.0);
              removeCutGrassPosNear(entry.origPos);
              _grassRegrowthEntries.splice(i, 1);
            } else {
              const scaleMap = [0.16, 0.34, 0.52, 0.70, 0.86, 1.0];
              applyGrassTuftScaleToVBO(entry, scaleMap[newStage] || 0.5);
            }
          }
        }
      }

      // 7C. อัปเดตผลแก้วมังกรบนต้น (กรณีเก็บแค่ลูกโดยไม่ได้ตัดต้น)
      if (_treeFruitRegrowthEntries.length > 0 && cols) {
        const cTrees = (typeof choppedTrees !== "undefined") ? choppedTrees : (typeof window !== "undefined" ? window.choppedTrees : []);
        for (let i = _treeFruitRegrowthEntries.length - 1; i >= 0; i--) {
          const fe = _treeFruitRegrowthEntries[i];
          if (!fe) { _treeFruitRegrowthEntries.splice(i, 1); continue; }
          if (Array.isArray(cTrees) && cTrees.includes(fe.treeId)) {
            // ต้นแม่ถูกโค่นไปแล้ว ยกเลิกรายการงอกผลเดี่ยว (ตัวต้นไม้จะงอกใหม่ทั้งต้นพร้อมผลเอง)
            _treeFruitRegrowthEntries.splice(i, 1);
            continue;
          }
          const dur = fe.growthDuration || WILD_GROWTH_DURATION;
          if ((now - fe.plantTime) / 1000 >= dur) {
            const fruitItem = cols.find(c => c && c.fruitId === fe.fruitId);
            if (fruitItem) {
              fruitItem.active = true;
              fruitItem.isAttachedToTree = true;
              if (Array.isArray(window.savedRemovedWorldKeys)) {
                const kIdx = window.savedRemovedWorldKeys.indexOf(fe.fruitId);
                if (kIdx !== -1) window.savedRemovedWorldKeys.splice(kIdx, 1);
              }
              needGridRebuild = true;
              needStaticRefresh = true;
            } else if (typeof window.syncTreeAttachedFruits === "function") {
              window.syncTreeAttachedFruits();
            }
            _treeFruitRegrowthEntries.splice(i, 1);
          }
        }
      }

      if (needGridRebuild && cols && typeof SpatialGrid !== "undefined" && typeof SpatialGrid.rebuild === "function") {
        SpatialGrid.rebuild(cols);
      }

      // อัปเดตเวอร์ชันโลกล่าสุดหลังตรวจเสร็จ
      _lastValidatedTopoVer = (typeof window !== "undefined" && typeof window._collectiblesTopologyVersion === "number")
        ? window._collectiblesTopologyVersion
        : curTopoVer;
      _lastValidatedTunnelLen = curTunnelLen;
      _lastValidatedHouseLen = curHouseLen;
      _lastValidatedColsLen = cols ? cols.length : curColsLen;
      _forceSurfaceValidation = false;

      if (needDynamicRefresh) markDynamicRefresh();
      if (needStaticRefresh) markStaticRefresh();
    },

    // 8. Export/Import สถานะสำหรับระบบเซฟเกม (ขนาดไฟล์เล็กมาก ไม่เก็บ raw vertices)
    exportState: function () {
      const cols = getCollectiblesArray() || [];
      const wildPlants = [];
      for (let i = 0; i < _wildGrowingItems.length; i++) {
        const c = _wildGrowingItems[i];
        if (!c || !c.active || !c.plantData) continue;
        const p = c.plantData;
        wildPlants.push({
          wildGrowthId: c.wildGrowthId,
          position: [Number(c.position[0].toFixed(4)), Number(c.position[1].toFixed(4)), Number(c.position[2].toFixed(4))],
          normal: [Number(c.normal[0].toFixed(5)), Number(c.normal[1].toFixed(5)), Number(c.normal[2].toFixed(5))],
          seedType: p.seedType,
          plantTime: p.plantTime,
          growthDuration: p.growthDuration || WILD_GROWTH_DURATION,
          stage: p.stage || 0,
          mature: !!p.mature,
          seed: p.seed,
          useGold: !!p.useGold,
          isPolarWhiteLeaf: !!p.isPolarWhiteLeaf,
          leafColor: p.leafColor || null,
          groundColor: p.groundColor || null,
          baseTreeScale: p.baseTreeScale || 0.085,
          origTreeId: p.origTreeId !== undefined ? p.origTreeId : null,
          origShrubId: p.origShrubId !== undefined ? p.origShrubId : null,
          origPos: p.origPos ? [Number(p.origPos[0].toFixed(4)), Number(p.origPos[1].toFixed(4)), Number(p.origPos[2].toFixed(4))] : null,
          relocated: !!p.relocated
        });
      }

      // บันทึกพิกัดใหม่ของต้นฝ้าย / ต้นรักที่ย้ายที่แล้วโตเต็มวัย เพื่อไม่ให้วาร์ปกลับหลุมขุดตอนโหลดเซฟ
      const relocatedShrubs = [];
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        if (!c || !c.active || !c.isWildRelocated || !c.position) continue;
        if (c.type !== "cotton_plant" && c.type !== "crown_flower") continue;
        const isCotton = (c.type === "cotton_plant");
        const idField = isCotton ? "cottonId" : "crownFlowerId";
        const idVal = c[idField] || c.worldKey;
        if (!idVal) continue;
        const n = c.normal || [0, 1, 0];
        relocatedShrubs.push({
          type: c.type,
          idField: idField,
          idVal: idVal,
          seed: c.seed || 0,
          position: [Number(c.position[0].toFixed(4)), Number(c.position[1].toFixed(4)), Number(c.position[2].toFixed(4))],
          normal: [Number(n[0].toFixed(5)), Number(n[1].toFixed(5)), Number(n[2].toFixed(5))]
        });
      }

      const grassTimers = _grassRegrowthEntries.map(e => ({
        origPos: e.origPos,
        curPos: e.curPos,
        relocated: !!e.relocated,
        plantTime: e.plantTime,
        growthDuration: e.growthDuration || WILD_GROWTH_DURATION
      }));

      const fruitTimers = _treeFruitRegrowthEntries.map(f => ({
        fruitId: f.fruitId,
        treeId: f.treeId,
        fruitIdx: f.fruitIdx,
        plantTime: f.plantTime,
        growthDuration: f.growthDuration || WILD_GROWTH_DURATION
      }));

      return {
        wildPlants: wildPlants,
        relocatedShrubs: relocatedShrubs,
        grassTimers: grassTimers,
        fruitTimers: fruitTimers
      };
    },

    importState: function (state) {
      this.reset();
      if (!state || typeof state !== "object") return;

      const cols = getCollectiblesArray();
      if (cols) {
        // ล้าง wild_growing_plant เก่าก่อนโหลดใหม่
        for (let i = cols.length - 1; i >= 0; i--) {
          if (cols[i] && cols[i].type === "wild_growing_plant") {
            cols.splice(i, 1);
          }
        }
      }

      // คืนพิกัดของต้นฝ้าย / ต้นรักที่ย้ายที่และโตเต็มวัยแล้ว
      let restoredRelocatedShrubs = false;
      if (cols && Array.isArray(state.relocatedShrubs)) {
        for (let i = 0; i < state.relocatedShrubs.length; i++) {
          const rs = state.relocatedShrubs[i];
          if (!rs || !rs.idVal || !Array.isArray(rs.position) || rs.position.length < 3) continue;
          const isCotton = (rs.type === "cotton_plant");
          const idField = rs.idField || (isCotton ? "cottonId" : "crownFlowerId");
          const n = (Array.isArray(rs.normal) && rs.normal.length >= 3) ? rs.normal : [0, 1, 0];
          const { R, F } = makeTangentBasis(n);

          // อัปเดตใน natureObstacles / allDeterministicNatureObstacles
          const numId = parseInt(String(rs.idVal).replace("cotton_", "").replace("crown_flower_", ""), 10);
          if (!isNaN(numId)) {
            const lists = [window.allDeterministicNatureObstacles, window.natureObstacles];
            for (let li = 0; li < lists.length; li++) {
              const list = lists[li];
              if (!Array.isArray(list)) continue;
              const obs = list.find(o => o && o.id === numId);
              if (obs) {
                obs.active = true;
                obs.position = [rs.position[0], rs.position[1], rs.position[2]];
                obs.normal = [n[0], n[1], n[2]];
                obs.R = R;
                obs.F = F;
              }
            }
          }

          let targetCol = cols.find(c => c && c[idField] === rs.idVal);
          if (targetCol) {
            targetCol.active = true;
            targetCol.isDemolished = false;
            targetCol.position = [rs.position[0], rs.position[1], rs.position[2]];
            targetCol.normal = [n[0], n[1], n[2]];
            targetCol.R = R;
            targetCol.F = F;
            targetCol.isWildRelocated = true;
          } else {
            targetCol = {
              type: rs.type,
              position: [rs.position[0], rs.position[1], rs.position[2]],
              normal: [n[0], n[1], n[2]],
              R: R,
              F: F,
              active: true,
              size: 0.06,
              seed: rs.seed || Math.floor(Math.random() * 100000),
              color: isCotton ? [0.96, 0.96, 0.94] : [0.92, 0.90, 0.96],
              isDynamic: false,
              isWorldGenerated: true,
              isWildRelocated: true,
              worldKey: rs.idVal
            };
            targetCol[idField] = rs.idVal;
            cols.push(targetCol);
          }
          restoredRelocatedShrubs = true;
        }
      }

      if (Array.isArray(state.wildPlants)) {
        for (let i = 0; i < state.wildPlants.length; i++) {
          const wp = state.wildPlants[i];
          if (!wp || !Array.isArray(wp.position) || wp.position.length < 3) continue;
          const sType = String(wp.seedType || "BRANCH").toUpperCase();
          const validSurf = isIntactSurfaceAt(wp.position, sType, null) || findValidSurfaceNear(wp.origPos || wp.position, sType, wp.seed || i, null);
          if (!validSurf) continue;
          const item = spawnWildGrowingCollectible({
            wildGrowthId: wp.wildGrowthId,
            seedType: sType,
            surface: validSurf,
            relocated: !!wp.relocated,
            origPos: wp.origPos || wp.position,
            origTreeId: wp.origTreeId,
            origShrubId: wp.origShrubId,
            seed: wp.seed,
            baseTreeScale: wp.baseTreeScale,
            useGold: wp.useGold,
            isPolarWhiteLeaf: wp.isPolarWhiteLeaf,
            leafColor: wp.leafColor,
            groundColor: wp.groundColor || validSurf.color,
            plantTime: wp.plantTime,
            growthDuration: wp.growthDuration || WILD_GROWTH_DURATION
          });
          if (item && wp.mature) {
            item.plantData.mature = true;
            item.plantData.stage = 5;
            item.plantData.progress = 1.0;
            item._matureFinalized = true;
            if (sType === "BRANCH" || sType === "DRAGON_FRUIT") {
              attachWildTreeCollider(item);
            } else if (sType === "GRASS") {
              removeCutGrassPosNear(item.plantData.origPos);
            }
          }
        }
      }

      // สำหรับหญ้าที่กำลังงอกค้างไว้ก่อนเซฟเกม ให้แปลงเป็น wild_growing_plant (GRASS) ที่ตำแหน่งสมบูรณ์
      if (Array.isArray(state.grassTimers)) {
        for (let i = 0; i < state.grassTimers.length; i++) {
          const gt = state.grassTimers[i];
          if (!gt || !Array.isArray(gt.curPos)) continue;
          const validSurf = isIntactSurfaceAt(gt.curPos, "GRASS", null) || findValidSurfaceNear(gt.origPos || gt.curPos, "GRASS", 700 + i * 17, null);
          if (!validSurf) continue;
          spawnWildGrowingCollectible({
            seedType: "GRASS",
            surface: validSurf,
            relocated: true,
            origPos: gt.origPos || gt.curPos,
            seed: 700 + i * 17,
            plantTime: gt.plantTime,
            growthDuration: gt.growthDuration || WILD_GROWTH_DURATION
          });
        }
      }

      if (Array.isArray(state.fruitTimers)) {
        for (let i = 0; i < state.fruitTimers.length; i++) {
          const ft = state.fruitTimers[i];
          if (ft && ft.fruitId) {
            _treeFruitRegrowthEntries.push({
              fruitId: ft.fruitId,
              treeId: ft.treeId,
              fruitIdx: ft.fruitIdx || 0,
              plantTime: ft.plantTime || Date.now(),
              growthDuration: ft.growthDuration || WILD_GROWTH_DURATION
            });
          }
        }
      }

      if (restoredRelocatedShrubs) {
        if (cols && typeof SpatialGrid !== "undefined" && typeof SpatialGrid.rebuild === "function") {
          SpatialGrid.rebuild(cols);
        }
        markStaticRefresh();
      }

      // บังคับอัปเดตทันที 1 รอบหลังโหลดเซฟ (เผื่อเวลาผ่านเกิน 10 นาทีไปแล้ว)
      _lastUpdateCheck = 0;
      _forceSurfaceValidation = true;
      this.update(0);
    }
  };

  window.WildPlantGrowthSystem = WildPlantGrowthSystem;
})();
