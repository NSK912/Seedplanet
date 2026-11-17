// === SEEDPLANET MODULE: JS/ITEMS/STONE_FLOOR.JS ===

// Local Template Cache for stone_floor top surface (base gravel floor + 25 procedural stone slabs)
const _stoneFloorTemplateCache = {};
let _stoneFloorPreviewBaseCache = null;

function _getStoneFloorTopTemplate(w, h, d, seedBucket) {
  const key = w.toFixed(4) + '_' + h.toFixed(4) + '_' + d.toFixed(4) + '_' + seedBucket;
  if (_stoneFloorTemplateCache[key]) return _stoneFloorTemplateCache[key];

  const v = [], c = [], idx = [];
  const localP = [0, 0, 0];
  const localR = [1, 0, 0];
  const localN = [0, 1, 0];
  const localF = [0, 0, 1];

  const gravelCol = [0.35, 0.35, 0.37];
  const baseH = h * 0.8;

  // Base gravel floor in local space
  addBox(localP, w, baseH, d, gravelCol, localR, localN, localF, v, c, idx);

  // Stone slabs on top - packed grid (5x5 = 25 boxes)
  const seedVal = seedBucket * 17.31;
  function pRand(s) {
    let x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  }

  const gridCols = 5;
  const gridRows = 5;
  const cellW = w / gridCols;
  const cellD = d / gridRows;

  for (let i = 0; i < gridCols; i++) {
    for (let j = 0; j < gridRows; j++) {
      const stoneSeed = seedVal + i * 13.1 + j * 7.9;

      const gapX = cellW * 0.15;
      const gapZ = cellD * 0.15;

      const cx = -w / 2 + cellW / 2 + i * cellW;
      const cz = -d / 2 + cellD / 2 + j * cellD;

      const ox = (pRand(stoneSeed) - 0.5) * gapX;
      const oz = (pRand(stoneSeed + 1) - 0.5) * gapZ;

      const sw = cellW - gapX + (pRand(stoneSeed + 2) - 0.5) * gapX;
      const sd = cellD - gapZ + (pRand(stoneSeed + 3) - 0.5) * gapZ;
      const sh = h * 0.4 + pRand(stoneSeed + 4) * (h * 0.2);

      const shade = 0.65 + pRand(stoneSeed + 5) * 0.1;
      const stoneCol = [shade, shade, shade - 0.02];

      const sp = [
        cx + ox,
        baseH / 2 + sh / 2,
        cz + oz
      ];

      const angle = (pRand(stoneSeed + 6) - 0.5) * Math.PI * 0.1;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const stoneR = [cosA, 0, sinA];
      const stoneF = [-sinA, 0, cosA];

      addBox(sp, sw, sh, sd, stoneCol, stoneR, localN, stoneF, v, c, idx);
    }
  }

  const tpl = {
    v: new Float32Array(v),
    c: new Float32Array(c),
    idx: new Uint16Array(idx),
    vCount: v.length / 3
  };
  _stoneFloorTemplateCache[key] = tpl;
  return tpl;
}

function _computeStoneFloorMaxBaseLen(pBottom, r, f, w, d) {
  const halfW = w / 2;
  const halfD = d / 2;
  const sampleOffsets = [
    [0, 0],
    [halfW, halfD],
    [halfW, -halfD],
    [-halfW, halfD],
    [-halfW, -halfD]
  ];

  let maxBaseLen = 0.05;
  const curSeed = typeof globalSeed !== "undefined" ? globalSeed : 0;
  const curWaterEnabled = typeof waterEnabled !== "undefined" && waterEnabled;
  const waterRadius = RADIUS + (typeof waterLevel !== "undefined" ? waterLevel : 0) * 0.15;

  for (let i = 0; i < sampleOffsets.length; i++) {
    const offset = sampleOffsets[i];
    const sampleP0 = pBottom[0] + r[0] * offset[0] + f[0] * offset[1];
    const sampleP1 = pBottom[1] + r[1] * offset[0] + f[1] * offset[1];
    const sampleP2 = pBottom[2] + r[2] * offset[0] + f[2] * offset[1];
    const sampleDist = Math.sqrt(sampleP0 * sampleP0 + sampleP1 * sampleP1 + sampleP2 * sampleP2) || 1;
    const nx_s = sampleP0 / sampleDist;
    const ny_s = sampleP1 / sampleDist;
    const nz_s = sampleP2 / sampleDist;

    let groundRad_s = RADIUS;
    if (typeof getTerrainSurfaceAndCeiling === "function") {
      const caveData = getTerrainSurfaceAndCeiling(nx_s, ny_s, nz_s, sampleDist);
      if (caveData && caveData.ground !== undefined && caveData.insideTunnel) {
        groundRad_s = caveData.ground;
      } else {
        const theta_s = Math.acos(Math.max(-1.0, Math.min(1.0, ny_s)));
        const phi_s = Math.atan2(nz_s, nx_s);
        groundRad_s = RADIUS + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta_s, phi_s, curSeed) : 0) * HEIGHT_SCALE;
      }
    } else {
      const theta_s = Math.acos(Math.max(-1.0, Math.min(1.0, ny_s)));
      const phi_s = Math.atan2(nz_s, nx_s);
      groundRad_s = RADIUS + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta_s, phi_s, curSeed) : 0) * HEIGHT_SCALE;
    }

    if (curWaterEnabled && groundRad_s < waterRadius) {
      groundRad_s = waterRadius;
    }

    const extraDepth = 0.10; // penetrate slightly into terrain for seamless fit
    const reqLen = sampleDist - groundRad_s + extraDepth;
    if (reqLen > maxBaseLen) {
      maxBaseLen = reqLen;
    }
  }
  return maxBaseLen;
}

window.ItemRegistry["stone_floor"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const r = item.R, f = item.F, n = item.normal;

    // "พื้นหิน" 300x300 stone floor
    const w = item.width !== undefined ? item.width : item.size * 12.0;
    const h = item.size * 0.15;
    const d = item.depth !== undefined ? item.depth : item.size * 12.0;

    // Position at the bottom of the main floor slab
    const pBottom = [
      p[0] - n[0] * (h / 2),
      p[1] - n[1] * (h / 2),
      p[2] - n[2] * (h / 2)
    ];

    let maxBaseLen = 0.05;

    if (targetBuffer === 'preview' || item.isIconPreview) {
      maxBaseLen = 0.03;
    } else {
      const curSeed = typeof globalSeed !== "undefined" ? globalSeed : 0;
      const curWater = (typeof waterEnabled !== "undefined" && waterEnabled) ? (typeof waterLevel !== "undefined" ? waterLevel : 0) : -999;
      if (!item.isPreview) {
        // Cache foundation height directly on placed item
        if (
          item._cachedMaxBaseLen !== undefined &&
          item._cachedBaseSeed === curSeed &&
          item._cachedBaseWater === curWater &&
          item._cachedBaseW === w &&
          item._cachedBaseD === d &&
          item._cachedBasePx === p[0] &&
          item._cachedBasePy === p[1] &&
          item._cachedBasePz === p[2]
        ) {
          maxBaseLen = item._cachedMaxBaseLen;
        } else {
          maxBaseLen = _computeStoneFloorMaxBaseLen(pBottom, r, f, w, d);
          item._cachedMaxBaseLen = maxBaseLen;
          item._cachedBaseSeed = curSeed;
          item._cachedBaseWater = curWater;
          item._cachedBaseW = w;
          item._cachedBaseD = d;
          item._cachedBasePx = p[0];
          item._cachedBasePy = p[1];
          item._cachedBasePz = p[2];
        }
      } else {
        // Cache preview foundation height if position/orientation hasn't changed
        if (
          _stoneFloorPreviewBaseCache &&
          _stoneFloorPreviewBaseCache.seed === curSeed &&
          _stoneFloorPreviewBaseCache.water === curWater &&
          _stoneFloorPreviewBaseCache.w === w &&
          _stoneFloorPreviewBaseCache.d === d &&
          Math.abs(_stoneFloorPreviewBaseCache.px - p[0]) < 1e-4 &&
          Math.abs(_stoneFloorPreviewBaseCache.py - p[1]) < 1e-4 &&
          Math.abs(_stoneFloorPreviewBaseCache.pz - p[2]) < 1e-4 &&
          Math.abs(_stoneFloorPreviewBaseCache.rx - r[0]) < 1e-4 &&
          Math.abs(_stoneFloorPreviewBaseCache.fz - f[2]) < 1e-4
        ) {
          maxBaseLen = _stoneFloorPreviewBaseCache.maxBaseLen;
        } else {
          maxBaseLen = _computeStoneFloorMaxBaseLen(pBottom, r, f, w, d);
          _stoneFloorPreviewBaseCache = {
            seed: curSeed,
            water: curWater,
            w: w,
            d: d,
            px: p[0],
            py: p[1],
            pz: p[2],
            rx: r[0],
            fz: f[2],
            maxBaseLen: maxBaseLen
          };
        }
      }
    }

    const basePos = [
      pBottom[0] - n[0] * (maxBaseLen / 2),
      pBottom[1] - n[1] * (maxBaseLen / 2),
      pBottom[2] - n[2] * (maxBaseLen / 2)
    ];

    if (item.isPreview) {
      const isValid = item.isValidPlacement !== false;
      const col = isValid ? [0.6, 0.6, 0.6] : [0.9, 0.2, 0.2];
      addBox(p, w, h, d, col, r, n, f, vertices, colors, indices);
      addBox(basePos, w * 0.98, maxBaseLen, d * 0.98, col, r, n, f, vertices, colors, indices);
    } else {
      // 1. Dynamic-height solid base foundation box extending down to planet surface
      const gravelCol = [0.35, 0.35, 0.37];
      addBox(basePos, w * 0.98, maxBaseLen, d * 0.98, gravelCol, r, n, f, vertices, colors, indices);

      // 2. Pre-baked Local Template for base gravel floor + 25 irregular stone slabs
      const rawSeed = item.seed || (p[0] * 123.4 + p[2] * 56.7);
      const seedBucket = Math.abs(Math.floor(rawSeed * 10)) % 32;
      const tpl = _getStoneFloorTopTemplate(w, h, d, seedBucket);

      const baseVertIdx = vertices.length / 3;
      const tv = tpl.v;
      const tc = tpl.c;
      const tidx = tpl.idx;
      const p0 = p[0], p1 = p[1], p2 = p[2];
      const r0 = r[0], r1 = r[1], r2 = r[2];
      const n0 = n[0], n1 = n[1], n2 = n[2];
      const f0 = f[0], f1 = f[1], f2 = f[2];
      const det = (r1 * n2 - r2 * n1) * f0 + (r2 * n0 - r0 * n2) * f1 + (r0 * n1 - r1 * n0) * f2;
      const isFlipped = det < 0;

      for (let i = 0, len = tv.length; i < len; i += 3) {
        const lx = tv[i], ly = tv[i + 1], lz = tv[i + 2];
        vertices.push(
          p0 + lx * r0 + ly * n0 + lz * f0,
          p1 + lx * r1 + ly * n1 + lz * f1,
          p2 + lx * r2 + ly * n2 + lz * f2
        );
        colors.push(tc[i], tc[i + 1], tc[i + 2]);
      }

      if (isFlipped) {
        for (let i = 0, len = tidx.length; i < len; i += 3) {
          indices.push(baseVertIdx + tidx[i], baseVertIdx + tidx[i + 2], baseVertIdx + tidx[i + 1]);
        }
      } else {
        for (let i = 0, len = tidx.length; i < len; i++) {
          indices.push(baseVertIdx + tidx[i]);
        }
      }
    }
  }
};

