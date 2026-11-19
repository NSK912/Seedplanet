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

    const isWatered = !isPreviewSnap && (plant.watered === true) && (plant.plantTime > 0);
    const elapsedSec = isWatered ? Math.max(0, (Date.now() - plant.plantTime) / 1000) : 0;
    const totalDur = plant.growthDuration || 300;
    const progress = isWatered ? Math.min(1.0, elapsedSec / totalDur) : 0.0;
    const curStage = isWatered ? Math.min(5, Math.floor(elapsedSec / 60)) : 0;
    const isMature = isWatered && (progress >= 1.0);
    if (!isPreviewSnap) {
      plant.progress = progress;
      plant.mature = isMature;
      plant.stage = curStage;
    }

    const soilCenter = pt(0, 0.095, 0);
    const plantSeed = (plant.seed || 1234) + 42;
    const seedType = (plant.seedType || "DRAGON_FRUIT").toUpperCase();

    // REQUIREMENT: Preview before placing and Stage 0 (first minute) use the EXACT SAME Sprout (ต้นอ่อน) model!
    if (isPreviewSnap || curStage === 0) {
      if (typeof window.buildPlantSprout === "function") {
        const sproutScale = 0.024 * (s / 0.35);
        window.buildPlantSprout(
          soilCenter,
          n,
          r,
          f,
          sproutScale,
          seedType,
          vertices,
          colors,
          indices,
          isPreviewSnap,
          { isValid: (item.previewIsValid !== undefined ? item.previewIsValid : true) }
        );
      }
    } else {
      // Stage 1 to 5: Plant grows gradually towards full maturity (5 minutes)
      const growthFactor = 0.28 + 0.72 * progress;
      const plantTreeScale = 0.042 * (s / 0.35) * growthFactor;

      if (seedType.includes("DRAGON")) {
        const leafColor = [0.94, 0.12, 0.15];
        leafColor.isWhiteRedAlternating = true;
        if (plant.useGold) leafColor.useGoldForWhite = true;
        if (typeof window.buildSingleTree === "function") {
          window.buildSingleTree(
            soilCenter,
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
        const leafColor = [0.18, 0.52, 0.20];
        if (typeof window.buildSingleTree === "function") {
          window.buildSingleTree(
            soilCenter,
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
            soilCenter[0], soilCenter[1], soilCenter[2],
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
            soilCenter[0], soilCenter[1], soilCenter[2],
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
    }
  }
};

window.ItemRegistry["wood_planter_box"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    window.buildWoodPlanterBoxModel(item, vertices, colors, indices);
  }
};
window.ItemRegistry["WOOD_PLANTER_BOX"] = window.ItemRegistry["wood_planter_box"];
