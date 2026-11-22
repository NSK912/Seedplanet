// === SEEDPLANET MODULE: JS/ITEMS/WOOD_FLOOR.JS ===

window.getFloorThickness = function(item) {
  const size = (item && item.size) || 0.25;
  const wfH = (typeof woodFloorHeight === "number") ? woodFloorHeight : ((typeof window !== "undefined" && typeof window.woodFloorHeight === "number") ? window.woodFloorHeight : 0.05);
  if (!item || item.type === "wood_floor") {
    return wfH + size * 0.12;
  } else if (item.type === "stone_floor") {
    return size * 0.15;
  } else if (item.type === "thin_wood_floor") {
    return size * 0.04;
  }
  return size * 0.08;
};

// Pre-baked Local Template Cache for wood_floor & thin_wood_floor (1 core + 4 planks + 8 wood grain lines = 13 boxes)
const _woodFloorTemplateCache = {};

function _getWoodFloorTemplate(effW, effH, effD, numPlanks, seedBucket) {
  const key = effW.toFixed(4) + '_' + effH.toFixed(4) + '_' + effD.toFixed(4) + '_' + numPlanks + '_' + seedBucket;
  if (_woodFloorTemplateCache[key]) return _woodFloorTemplateCache[key];

  const v = [], cMult = [], idx = [];
  const localR = [1, 0, 0];
  const localN = [0, 1, 0];
  const localF = [0, 0, 1];

  const pw = effW / numPlanks;
  const plankW = pw;
  const plankD = effD;
  const seedVal = seedBucket * 19.37;

  function pRand(s) {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  }

  // Internal recessed sub-floor core
  const coreH = Math.max(0.008, effH * 0.65);
  const coreCenter = [0.0, -effH * 0.1, 0.0];
  addBox(coreCenter, Math.max(0.01, effW - 0.004), coreH, Math.max(0.01, effD - 0.004), [0.7, 0.7, 0.7], localR, localN, localF, v, cMult, idx);

  for (let i = 0; i < numPlanks; i++) {
    const t = -effW / 2 + pw / 2 + i * pw;
    const plankCenter = [t, 0.0, 0.0];

    const shadeNoise = pRand(seedVal + i * 17.3);
    const mult = 0.94 + shadeNoise * 0.12;
    addBox(plankCenter, plankW, effH, plankD, [mult, mult, mult], localR, localN, localF, v, cMult, idx);

    const numGrainLines = 2;
    const grainMult = mult * 0.65;
    for (let j = 0; j < numGrainLines; j++) {
      const grainNoiseX = pRand(seedVal + i * 31.4 + j * 45.1);
      const grainNoiseL = pRand(seedVal + i * 19.8 + j * 73.2);
      const grainW = 0.005;
      const grainH = 0.0024;
      const grainD = effD * (0.3 + grainNoiseL * 0.6);

      const grainT = (grainNoiseX - 0.5) * (plankW * 0.65);
      const grainOffsetF = (pRand(seedVal + j * 91.3) - 0.5) * (effD - grainD);

      const grainCenter = [
        t + grainT,
        effH * 0.5 + 0.0012,
        grainOffsetF
      ];
      addBox(grainCenter, grainW, grainH, grainD, [grainMult, grainMult, grainMult], localR, localN, localF, v, cMult, idx);
    }
  }

  const tpl = {
    v: new Float32Array(v),
    cMult: new Float32Array(cMult),
    idx: new Uint16Array(idx)
  };
  _woodFloorTemplateCache[key] = tpl;
  return tpl;
}

window.ItemRegistry["wood_floor"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const r = item.R,
      f = item.F,
      n = item.normal;

    // "พื้นไม้" - A flat square platform/floor panel
    const w = item.width !== undefined ? item.width : item.size * 1.2;
    const h = window.getFloorThickness(item);
    const d = item.depth !== undefined ? item.depth : item.size * 1.2;

    if (item.isPreview) {
      const isValid = item.isValidPlacement !== false;
      const col = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
      addBox(p, w, h, d, col, r, n, f, vertices, colors, indices);
    } else {
      const isThin = (item.type === "thin_wood_floor");
      let effW = w;
      let effD = d;
      let effH = h;
      let baseP = p;

      if (isThin) {
        let hasLeftN = false, hasRightN = false, hasBackN = false, hasFrontN = false;
        if (!item.isPreview && item._extCache && !item._extDirty) {
          hasLeftN = item._extCache[0];
          hasRightN = item._extCache[1];
          hasBackN = item._extCache[2];
          hasFrontN = item._extCache[3];
        } else {
          let floorsToCheck = null;
          if (window._spatialFloors) {
            floorsToCheck = [];
            const cx = Math.floor(p[0]);
            const cy = Math.floor(p[1]);
            const cz = Math.floor(p[2]);
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                  const bucket = window._spatialFloors.get((cx + dx) + "_" + (cy + dy) + "_" + (cz + dz));
                  if (bucket) {
                    for (let b = 0; b < bucket.length; b++) floorsToCheck.push(bucket[b]);
                  }
                }
              }
            }
          } else {
            floorsToCheck = (typeof window !== "undefined" && window.collectibles) ? window.collectibles : [];
          }
          for (let k = 0, kLen = floorsToCheck.length; k < kLen; k++) {
            const other = floorsToCheck[k];
            if (!other || !other.active || other === item || other.isPreview) continue;
            if (other.type !== "thin_wood_floor" && other.type !== "wood_floor") continue;
            const oP = other.position;
            if (!oP) continue;
            const dx = oP[0] - p[0], dy = oP[1] - p[1], dz = oP[2] - p[2];
            if (dx * dx + dy * dy + dz * dz > 0.20) continue;
            const dN = dx * n[0] + dy * n[1] + dz * n[2];
            if (Math.abs(dN) > 0.05) continue;
            const dR = dx * r[0] + dy * r[1] + dz * r[2];
            const dF = dx * f[0] + dy * f[1] + dz * f[2];
            if (Math.abs(dF) < 0.08) {
              if (dR > -0.36 && dR < -0.24) hasLeftN = true;
              else if (dR > 0.24 && dR < 0.36) hasRightN = true;
            }
            if (Math.abs(dR) < 0.08) {
              if (dF > -0.36 && dF < -0.24) hasBackN = true;
              else if (dF > 0.24 && dF < 0.36) hasFrontN = true;
            }
          }
          if (!item.isPreview) {
            item._extCache = [hasLeftN, hasRightN, hasBackN, hasFrontN];
            item._extDirty = false;
          }
        }
        const extL = hasLeftN ? 0.0 : 0.016;
        const extR = hasRightN ? 0.0 : 0.016;
        const extB = hasBackN ? 0.0 : 0.016;
        const extF = hasFrontN ? 0.0 : 0.016;
        effW = w + extL + extR;
        effD = d + extB + extF;
        effH = Math.max(h, 0.018);
        const offR = (extR - extL) * 0.5;
        const offF = (extF - extB) * 0.5;
        const offN = (effH - h) * 0.5;
        baseP = [
          p[0] + r[0] * offR + f[0] * offF + n[0] * offN,
          p[1] + r[1] * offR + f[1] * offF + n[1] * offN,
          p[2] + r[2] * offR + f[2] * offF + n[2] * offN
        ];
      }

      const numPlanks = Math.max(1, Math.round((w / (item.size * 1.2)) * 4));
      const rawSeed = item.seed || (p[0] * 123.4 + p[2] * 56.7);
      const seedBucket = Math.abs(Math.floor(rawSeed * 10)) % 32;
      const tpl = _getWoodFloorTemplate(effW, effH, effD, numPlanks, seedBucket);

      const baseColor = item.color || [0.65, 0.45, 0.25];
      const rCol = baseColor[0], gCol = baseColor[1], bCol = baseColor[2];

      const baseVertIdx = vertices.length / 3;
      const tv = tpl.v;
      const tcMult = tpl.cMult;
      const tidx = tpl.idx;
      const bp0 = baseP[0], bp1 = baseP[1], bp2 = baseP[2];
      const r0 = r[0], r1 = r[1], r2 = r[2];
      const n0 = n[0], n1 = n[1], n2 = n[2];
      const f0 = f[0], f1 = f[1], f2 = f[2];
      const det = (r1 * n2 - r2 * n1) * f0 + (r2 * n0 - r0 * n2) * f1 + (r0 * n1 - r1 * n0) * f2;
      const isFlipped = det < 0;

      for (let i = 0, len = tv.length; i < len; i += 3) {
        const lx = tv[i], ly = tv[i + 1], lz = tv[i + 2];
        vertices.push(
          bp0 + lx * r0 + ly * n0 + lz * f0,
          bp1 + lx * r1 + ly * n1 + lz * f1,
          bp2 + lx * r2 + ly * n2 + lz * f2
        );
        colors.push(
          rCol * tcMult[i],
          gCol * tcMult[i + 1],
          bCol * tcMult[i + 2]
        );
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

window.ItemRegistry["plank"] = window.ItemRegistry["wood_floor"];
window.ItemRegistry["thin_wood_floor"] = window.ItemRegistry["wood_floor"];

