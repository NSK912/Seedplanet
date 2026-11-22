// === SEEDPLANET MODULE: JS/ITEMS/WOOD_PLANTER_BOX.JS ===
// Low-poly Wooden Planter Box with soil mound and growing plant renderer (WOOD_PLANTER_BOX)

window.ItemRegistry = window.ItemRegistry || {};

window.buildWoodPlanterBoxModel = function(item, vertices, colors, indices) {
  const p = (item && item.position) ? item.position : [0, 0, 0];
  const r = (item && item.R) ? item.R : [1, 0, 0];
  const f = (item && item.F) ? item.F : [0, 0, 1];
  const n = (item && item.normal) ? item.normal : [0, 1, 0];
  const isPreview = !!(item && item.isPreview);
  const isValid = !(item && item.isValidPlacement === false);
  const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];

  const s = (item && item.customScale) ? item.customScale : 0.46;

  const woodPostColor = isPreview ? previewColor : [0.38, 0.24, 0.12];
  const woodPlankDark = isPreview ? previewColor : [0.52, 0.35, 0.19];
  const woodPlankLight = isPreview ? previewColor : [0.60, 0.41, 0.23];
  const woodRimColor = isPreview ? previewColor : [0.46, 0.30, 0.16];

  const pt = (rx, ny, fz) => [
    p[0] + (r[0] * rx + n[0] * ny + f[0] * fz) * s,
    p[1] + (r[1] * rx + n[1] * ny + f[1] * fz) * s,
    p[2] + (r[2] * rx + n[2] * ny + f[2] * fz) * s
  ];

  // 1) Bottom wooden floor plate
  addBox(pt(0, 0.014, 0), 0.236 * s, 0.016 * s, 0.176 * s, woodPostColor, r, n, f, vertices, colors, indices);

  // 2) 4 Corner Wooden Posts
  const postX = 0.112;
  const postZ = 0.082;
  const postCoords = [
    [-postX, 0.056, -postZ],
    [ postX, 0.056, -postZ],
    [-postX, 0.056,  postZ],
    [ postX, 0.056,  postZ]
  ];
  for (let i = 0; i < 4; i++) {
    const c = postCoords[i];
    addBox(pt(c[0], c[1], c[2]), 0.028 * s, 0.112 * s, 0.028 * s, woodPostColor, r, n, f, vertices, colors, indices);
  }

  // 3) Front & Back Low-Poly Wooden Plank Walls (2 horizontal planks each)
  addBox(pt(0, 0.032, -postZ), 0.210 * s, 0.036 * s, 0.018 * s, woodPlankDark, r, n, f, vertices, colors, indices);
  addBox(pt(0, 0.072, -postZ), 0.210 * s, 0.036 * s, 0.018 * s, woodPlankLight, r, n, f, vertices, colors, indices);
  addBox(pt(0, 0.032,  postZ), 0.210 * s, 0.036 * s, 0.018 * s, woodPlankDark, r, n, f, vertices, colors, indices);
  addBox(pt(0, 0.072,  postZ), 0.210 * s, 0.036 * s, 0.018 * s, woodPlankLight, r, n, f, vertices, colors, indices);

  // 4) Left & Right Low-Poly Wooden Plank Walls (2 horizontal planks each)
  addBox(pt(-postX, 0.032, 0), 0.018 * s, 0.036 * s, 0.150 * s, woodPlankLight, r, n, f, vertices, colors, indices);
  addBox(pt(-postX, 0.072, 0), 0.018 * s, 0.036 * s, 0.150 * s, woodPlankDark, r, n, f, vertices, colors, indices);
  addBox(pt( postX, 0.032, 0), 0.018 * s, 0.036 * s, 0.150 * s, woodPlankLight, r, n, f, vertices, colors, indices);
  addBox(pt( postX, 0.072, 0), 0.018 * s, 0.036 * s, 0.150 * s, woodPlankDark, r, n, f, vertices, colors, indices);

  // 5) Top Wooden Rim Trim around all 4 edges
  addBox(pt(0, 0.100, -postZ), 0.252 * s, 0.016 * s, 0.030 * s, woodRimColor, r, n, f, vertices, colors, indices);
  addBox(pt(0, 0.100,  postZ), 0.252 * s, 0.016 * s, 0.030 * s, woodRimColor, r, n, f, vertices, colors, indices);
  addBox(pt(-postX, 0.100, 0), 0.030 * s, 0.016 * s, 0.152 * s, woodRimColor, r, n, f, vertices, colors, indices);
  addBox(pt( postX, 0.100, 0), 0.030 * s, 0.016 * s, 0.152 * s, woodRimColor, r, n, f, vertices, colors, indices);

  // 6) Planetary Terrain Surface Mound inside the planter box (adapted from terrain.js buildPlanetAsync)
  let det = (r[1] * n[2] - r[2] * n[1]) * f[0] +
            (r[2] * n[0] - r[0] * n[2]) * f[1] +
            (r[0] * n[1] - r[1] * n[0]) * f[2];
  const isFlipped = det < 0;

  const latSeg = 10;
  const longSeg = 12;
  const gridBaseIdx = vertices.length / 3;
  const planetSeed = (typeof window !== "undefined" && typeof window.globalSeed === "number") ? window.globalSeed : 12345;
  const itemSeed = (item && typeof item.seed === "number") ? item.seed : 123.45;
  const fbm = (typeof window !== "undefined" && typeof window.fbmNoise === "function")
    ? window.fbmNoise
    : ((typeof fbmNoise === "function") ? fbmNoise : null);

  // สีดินสีเดียวล้วน (เข้มชุ่มน้ำเมื่อรดน้ำแล้ว)
  const isDirtMoist = !!(item && item.plantData && item.plantData.watered);
  const singleDirtColor = isPreview ? previewColor : (isDirtMoist ? [0.28, 0.18, 0.09] : [0.46, 0.30, 0.16]);

  let moundHeights = (item && item._cachedMoundHeights && item._cachedMoundSeed === itemSeed)
    ? item._cachedMoundHeights
    : null;
  if (!moundHeights) {
    moundHeights = new Float32Array((latSeg + 1) * (longSeg + 1));
    let mIdx = 0;
    for (let lat = 0; lat <= latSeg; lat++) {
      const v = (lat / latSeg) * 2.0 - 1.0;
      for (let long = 0; long <= longSeg; long++) {
        const u = (long / longSeg) * 2.0 - 1.0;
        const edgeFalloff = Math.max(0.0, (1.0 - u * u * 0.88) * (1.0 - v * v * 0.88));
        const localNoise = fbm
          ? fbm(u * 2.4 + itemSeed, v * 2.4 + itemSeed, 0.5, planetSeed + 300, 3)
          : (Math.sin(u * 4.0 + itemSeed) * Math.cos(v * 4.0) * 0.35);
        moundHeights[mIdx++] = 0.082 + edgeFalloff * (0.022 + localNoise * 0.010);
      }
    }
    if (item && typeof item === "object") {
      item._cachedMoundHeights = moundHeights;
      item._cachedMoundSeed = itemSeed;
    }
  }

  let mhIdx = 0;
  for (let lat = 0; lat <= latSeg; lat++) {
    const v = (lat / latSeg) * 2.0 - 1.0; // -1 to +1
    const fz = v * 0.073;

    for (let long = 0; long <= longSeg; long++) {
      const u = (long / longSeg) * 2.0 - 1.0; // -1 to +1
      const rx = u * 0.103;
      const moundHeight = moundHeights[mhIdx++];
      const vPos = pt(rx, moundHeight, fz);

      vertices.push(vPos[0], vPos[1], vPos[2]);
      colors.push(singleDirtColor[0], singleDirtColor[1], singleDirtColor[2]);
    }
  }

  for (let lat = 0; lat < latSeg; lat++) {
    for (let long = 0; long < longSeg; long++) {
      const a = gridBaseIdx + lat * (longSeg + 1) + long;
      const b = a + longSeg + 1;
      const c = a + 1;
      const d = b + 1;
      if (isFlipped) {
        indices.push(a, d, c);
        indices.push(a, b, d);
      } else {
        indices.push(a, c, d);
        indices.push(a, d, b);
      }
    }
  }

  // 7) Plant Growing inside the Planter Box or Snap Placement Preview
  if (item && (item.plantData || item.isPreviewPlant)) {
    const isPreviewSnap = !item.plantData && item.isPreviewPlant;
    const plant = item.plantData || {
      seedType: item.previewSeedType || "DRAGON_FRUIT",
      plantTime: 0,
      watered: false,
      growthDuration: 300,
      seed: 1234
    };

    const soilCenter = pt(0, 0.095, 0);
    window.buildGrowingPlantGeometry({
      center: soilCenter,
      n: n,
      r: r,
      f: f,
      plantData: plant,
      isPreviewSnap: isPreviewSnap,
      previewIsValid: (item.previewIsValid !== undefined ? item.previewIsValid : true),
      sproutScale: 0.024 * (s / 0.35),
      baseTreeScale: 0.042 * (s / 0.35),
      requireWatering: true,
      defaultDuration: 300,
      vertices: vertices,
      colors: colors,
      indices: indices
    });
  }
};

// Shared procedural growing-plant builder reused by BOTH wood_planter_box (5 min)
// and planet wild plant regrowth (10 min): DRAGON_FRUIT, BRANCH, COTTON_PLANT, CROWN_FLOWER, GRASS
window.buildGrowingPlantGeometry = function(opts) {
  if (!opts || !opts.center || !opts.vertices || !opts.colors || !opts.indices) return;

  const center = opts.center;
  const n = opts.n || [0, 1, 0];
  const r = opts.r || [1, 0, 0];
  const f = opts.f || [0, 0, 1];
  const plant = opts.plantData || {};
  const isPreviewSnap = !!opts.isPreviewSnap;
  const requireWatering = opts.requireWatering !== false;
  const defaultDur = (typeof opts.defaultDuration === "number" && opts.defaultDuration > 0) ? opts.defaultDuration : 300;
  const vertices = opts.vertices;
  const colors = opts.colors;
  const indices = opts.indices;

  const totalDur = (typeof plant.growthDuration === "number" && plant.growthDuration > 0) ? plant.growthDuration : defaultDur;
  const isActiveGrow = !isPreviewSnap && (requireWatering ? (plant.watered === true && plant.plantTime > 0) : (plant.plantTime > 0));
  const elapsedSec = isActiveGrow ? Math.max(0, (Date.now() - plant.plantTime) / 1000) : 0;
  const progress = isActiveGrow ? Math.min(1.0, elapsedSec / totalDur) : 0.0;
  const stageInterval = totalDur / 5.0;
  const curStage = isActiveGrow ? Math.min(5, Math.floor(elapsedSec / stageInterval)) : 0;
  const isMature = isActiveGrow && (progress >= 1.0);

  if (!isPreviewSnap) {
    plant.progress = progress;
    plant.mature = isMature;
    plant.stage = curStage;
  }

  const plantSeed = (typeof plant.seed === "number" ? plant.seed : 1234) + 42;
  const seedType = String(plant.seedType || "DRAGON_FRUIT").toUpperCase();

  // GRASS grows as biome-matched low-poly grass tuft scaling smoothly from Stage 0..5
  if (seedType.includes("GRASS")) {
    const gScale = 0.20 + 0.80 * (curStage / 5.0);
    window.buildGrowingGrassTuft(center, n, r, f, plantSeed, gScale, plant.groundColor || null, vertices, colors, indices);
    return;
  }

  // Preview before placing and Stage 0 use the EXACT SAME Sprout (ต้นอ่อน) model
  if (isPreviewSnap || curStage === 0) {
    if (typeof window.buildPlantSprout === "function") {
      const sproutScale = (typeof opts.sproutScale === "number" && opts.sproutScale > 0) ? opts.sproutScale : 0.024;
      window.buildPlantSprout(
        center,
        n,
        r,
        f,
        sproutScale,
        seedType,
        vertices,
        colors,
        indices,
        isPreviewSnap,
        { isValid: (opts.previewIsValid !== undefined ? opts.previewIsValid : true) }
      );
    }
    return;
  }

  // Stage 1 to 5: Plant grows gradually towards full maturity
  const growthFactor = 0.28 + 0.72 * progress;
  const baseTreeScale = (typeof opts.baseTreeScale === "number" && opts.baseTreeScale > 0) ? opts.baseTreeScale : 0.042;
  const plantTreeScale = baseTreeScale * growthFactor;

  if (seedType.includes("DRAGON")) {
    const leafColor = [0.94, 0.12, 0.15];
    leafColor.isWhiteRedAlternating = true;
    if (plant.useGold) leafColor.useGoldForWhite = true;
    if (typeof window.buildSingleTree === "function") {
      window.buildSingleTree(
        center,
        n,
        r,
        f,
        plantTreeScale,
        leafColor,
        plantSeed,
        vertices,
        colors,
        indices,
        { hasFruits: isMature }
      );
    }
  } else if (seedType.includes("BRANCH")) {
    let leafColor;
    if (Array.isArray(plant.leafColor) && plant.leafColor.length >= 3) {
      leafColor = [plant.leafColor[0], plant.leafColor[1], plant.leafColor[2]];
      if (plant.isPolarWhiteLeaf) leafColor.isPolarWhiteLeaf = true;
    } else if (plant.isPolarWhiteLeaf) {
      leafColor = [0.95, 0.96, 0.98];
      leafColor.isPolarWhiteLeaf = true;
    } else {
      leafColor = [0.18, 0.52, 0.20];
    }
    if (typeof window.buildSingleTree === "function") {
      window.buildSingleTree(
        center,
        n,
        r,
        f,
        plantTreeScale,
        leafColor,
        plantSeed,
        vertices,
        colors,
        indices,
        { hasFruits: false }
      );
    }
  } else if (seedType.includes("COTTON")) {
    if (typeof window.buildCottonPlant === "function") {
      window.buildCottonPlant(
        center[0], center[1], center[2],
        n[0], n[1], n[2],
        r, f, n,
        plantSeed,
        vertices,
        colors,
        indices,
        false,
        0.38 + 0.62 * progress,
        { hasBolls: isMature }
      );
    }
  } else if (seedType.includes("CROWN")) {
    if (typeof window.buildCrownFlowerPlant === "function") {
      window.buildCrownFlowerPlant(
        center[0], center[1], center[2],
        n[0], n[1], n[2],
        r, f, n,
        plantSeed,
        vertices,
        colors,
        indices,
        false,
        0.38 + 0.62 * progress,
        { hasFlowers: isMature }
      );
    }
  }
};

// Procedural biome-colored grass tuft builder matching terrain.js addGrassTuft style
window.buildGrowingGrassTuft = function(center, n, r, f, seedVal, heightScale, groundColor, vertices, colors, indices) {
  let s = (typeof seedVal === "number" ? seedVal : 1234) * 1.13 + 7;
  function gRand() {
    const x = Math.sin(s++) * 10000;
    return x - Math.floor(x);
  }
  const hScale = Math.max(0.16, Math.min(1.25, typeof heightScale === "number" ? heightScale : 1.0));
  const numBlades = 5 + Math.floor(gRand() * 3);
  const tuftHeightScale = (1.0 + gRand() * 0.30) * hScale;
  const currentBiome = (typeof window !== "undefined" && window.CURRENT_BIOME) ? window.CURRENT_BIOME : "normal";
  const encodeFn = (typeof window !== "undefined" && typeof window.encodeTreeColor === "function") ? window.encodeTreeColor : null;

  for (let b = 0; b < numBlades; b++) {
    const baseAngle = (b / numBlades) * Math.PI * 2;
    const gAngle = baseAngle + (gRand() - 0.5) * 0.50;
    const styleRoll = gRand();
    let lean, gHeight, gWidth, curve;
    if (styleRoll < 0.35) {
      lean = 0.18 + gRand() * 0.25;
      gHeight = (0.080 + gRand() * 0.035) * tuftHeightScale;
      gWidth = (0.013 + gRand() * 0.004) * (0.55 + 0.45 * hScale);
      curve = (gRand() - 0.5) * 0.45;
    } else if (styleRoll < 0.75) {
      lean = 0.14 + gRand() * 0.22;
      gHeight = (0.120 + gRand() * 0.045) * tuftHeightScale;
      gWidth = (0.015 + gRand() * 0.005) * (0.55 + 0.45 * hScale);
      curve = (gRand() - 0.5) * 0.55;
    } else {
      lean = 0.08 + gRand() * 0.18;
      gHeight = (0.170 + gRand() * 0.055) * tuftHeightScale;
      gWidth = (0.017 + gRand() * 0.005) * (0.55 + 0.45 * hScale);
      curve = (gRand() - 0.5) * 0.65;
    }

    const gDirX = Math.cos(gAngle) * r[0] + Math.sin(gAngle) * f[0] + n[0] * (2.0 - lean);
    const gDirY = Math.cos(gAngle) * r[1] + Math.sin(gAngle) * f[1] + n[1] * (2.0 - lean);
    const gDirZ = Math.cos(gAngle) * r[2] + Math.sin(gAngle) * f[2] + n[2] * (2.0 - lean);
    const lDir = Math.hypot(gDirX, gDirY, gDirZ) || 1;
    const dir = [gDirX / lDir, gDirY / lDir, gDirZ / lDir];

    let cX = dir[1] * n[2] - dir[2] * n[1];
    let cY = dir[2] * n[0] - dir[0] * n[2];
    let cZ = dir[0] * n[1] - dir[1] * n[0];
    let lC = Math.hypot(cX, cY, cZ);
    if (lC < 0.0001) { cX = r[0]; cY = r[1]; cZ = r[2]; lC = 1; }
    const wDir = [cX / lC, cY / lC, cZ / lC];

    const topPt = [
      center[0] + dir[0] * gHeight + wDir[0] * gWidth * curve,
      center[1] + dir[1] * gHeight + wDir[1] * gWidth * curve,
      center[2] + dir[2] * gHeight + wDir[2] * gWidth * curve
    ];
    const p1 = [center[0] + wDir[0] * gWidth, center[1] + wDir[1] * gWidth, center[2] + wDir[2] * gWidth];
    const p2 = [center[0] - wDir[0] * gWidth, center[1] - wDir[1] * gWidth, center[2] - wDir[2] * gWidth];

    let baseToneR = 0.10 + gRand() * 0.06;
    let baseToneG = (currentBiome === "jungle" ? 0.65 : 0.58) + gRand() * 0.12;
    let baseToneB = 0.12 + gRand() * 0.06;
    if (groundColor && groundColor[1] > 0.20) {
      baseToneR = Math.max(0.04, groundColor[0] * 0.85 + (gRand() - 0.5) * 0.04);
      baseToneG = Math.max(0.48, groundColor[1] * 1.12 + (gRand() - 0.5) * 0.06);
      baseToneB = Math.max(0.05, groundColor[2] * 0.85 + (gRand() - 0.5) * 0.04);
    }
    const topRaw = [
      Math.max(0.02, Math.min(1.0, baseToneR)),
      Math.max(0.35, Math.min(1.0, baseToneG)),
      Math.max(0.02, Math.min(1.0, baseToneB))
    ];
    const botRaw = [topRaw[0] * 0.35, topRaw[1] * 0.42, topRaw[2] * 0.35];

    const botCol = encodeFn ? encodeFn(botRaw, false, 0.0) : botRaw;
    const topCol = encodeFn ? encodeFn(topRaw, true, 0.85) : topRaw;

    const vOff = vertices.length / 3;
    vertices.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], topPt[0], topPt[1], topPt[2]);
    colors.push(botCol[0], botCol[1], botCol[2], botCol[0], botCol[1], botCol[2], topCol[0], topCol[1], topCol[2]);
    // Double-sided so relocated grass is visible from every angle
    indices.push(vOff, vOff + 1, vOff + 2, vOff, vOff + 2, vOff + 1);
  }
};

window.ItemRegistry["wood_planter_box"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    window.buildWoodPlanterBoxModel(item, vertices, colors, indices);
  }
};
window.ItemRegistry["WOOD_PLANTER_BOX"] = window.ItemRegistry["wood_planter_box"];

// Wild planet growing/relocated plant renderer (reuses exact planter box growth models)
window.ItemRegistry["wild_growing_plant"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    if (!item || !item.position || !item.plantData) return;
    const pos = item.position;
    let n = item.normal;
    if (!n || n.length < 3) {
      const len = Math.hypot(pos[0], pos[1], pos[2]) || 1;
      n = [pos[0] / len, pos[1] / len, pos[2] / len];
    }
    let r = item.R;
    let f = item.F;
    if (!r || !f) {
      const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      let rx = ref[1] * n[2] - ref[2] * n[1];
      let ry = ref[2] * n[0] - ref[0] * n[2];
      let rz = ref[0] * n[1] - ref[1] * n[0];
      const rLen = Math.hypot(rx, ry, rz) || 1;
      r = [rx / rLen, ry / rLen, rz / rLen];
      f = [
        n[1] * r[2] - n[2] * r[1],
        n[2] * r[0] - n[0] * r[2],
        n[0] * r[1] - n[1] * r[0]
      ];
    }
    const pData = item.plantData;
    const baseTreeScale = (typeof pData.baseTreeScale === "number" && pData.baseTreeScale > 0) ? pData.baseTreeScale : 0.085;
    window.buildGrowingPlantGeometry({
      center: pos,
      n: n,
      r: r,
      f: f,
      plantData: pData,
      isPreviewSnap: false,
      sproutScale: 0.032,
      baseTreeScale: baseTreeScale,
      requireWatering: false,
      defaultDuration: 600,
      vertices: vertices,
      colors: colors,
      indices: indices
    });
  }
};
