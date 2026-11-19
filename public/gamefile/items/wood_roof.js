// === SEEDPLANET MODULE: JS/ITEMS/WOOD_ROOF.JS ===

window.ItemRegistry["wood_roof"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position || [0, 0, 0];
    const r = item.R || [1, 0, 0];
    const f = item.F || [0, 0, 1];
    const n = item.normal || [0, 1, 0];

    // Compute rotated orientation based on item.angle
    const angle = item.angle || 0.0;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const roofR = [
      r[0] * cosA + f[0] * sinA,
      r[1] * cosA + f[1] * sinA,
      r[2] * cosA + f[2] * sinA
    ];
    const roofF = [
      f[0] * cosA - r[0] * sinA,
      f[1] * cosA - r[1] * sinA,
      f[2] * cosA - r[2] * sinA
    ];

    // Standard structural tile dimensions exactly matching wood wall (0.30m wide x 0.30m deep)
    const w = 0.30;
    const d = 0.30;

    // Height profile: starts at 0.0 (sitting flush on top of wall/floor with zero gap),
    // and rises to 0.25 (exactly matching the 0.25m height of wood wall!)
    const hEave = 0.0;
    const hRidge = 0.25;
    const rise = hRidge - hEave; // 0.25m vertical rise

    // Calculate slope vectors
    const slopeLen = Math.sqrt(d * d + rise * rise); // ~0.3905m
    const dirSlope = [
      (roofF[0] * d + n[0] * rise) / slopeLen,
      (roofF[1] * d + n[1] * rise) / slopeLen,
      (roofF[2] * d + n[2] * rise) / slopeLen
    ];

    // Normal vector perpendicular to the inclined roof surface (pointing outward/upward)
    let normSlope = [
      (n[0] * d - roofF[0] * rise) / slopeLen,
      (n[1] * d - roofF[1] * rise) / slopeLen,
      (n[2] * d - roofF[2] * rise) / slopeLen
    ];

    if (normSlope[0] * n[0] + normSlope[1] * n[1] + normSlope[2] * n[2] < 0) {
      normSlope = [-normSlope[0], -normSlope[1], -normSlope[2]];
    }

    // Slope bounds: from eave (-slopeLen/2) to ridge (+slopeLen/2)
    const vMinEff = -slopeLen / 2;
    let vMaxEff = slopeLen / 2;
    let hasLeftNeighbor = false;
    let hasRightNeighbor = false;

    const allCollectibles = (typeof window !== "undefined" && window.collectibles) ? window.collectibles : [];
    if (!item.isPreview && !item._roofDirty && item._vMaxEff !== undefined && item._hasLeftN !== undefined && item._hasRightN !== undefined) {
      vMaxEff = item._vMaxEff;
      hasLeftNeighbor = item._hasLeftN;
      hasRightNeighbor = item._hasRightN;
    } else {
      let roofsToCheck;
      if (window._spatialRoofs) {
        roofsToCheck = [];
        const cx = Math.floor(p[0] / 2.0);
        const cy = Math.floor(p[1] / 2.0);
        const cz = Math.floor(p[2] / 2.0);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              const k = (cx + dx) + "_" + (cy + dy) + "_" + (cz + dz);
              const bucket = window._spatialRoofs.get(k);
              if (bucket) {
                for (let b = 0; b < bucket.length; b++) roofsToCheck.push(bucket[b]);
              }
            }
          }
        }
      } else {
        roofsToCheck = allCollectibles;
      }
      for (let other of roofsToCheck) {
        if (!other.active || other === item) continue;
        if (other.isPreview && !item.isPreview) continue;
        const oP = other.position || [0, 0, 0];
        const dx = oP[0] - p[0];
        const dy = oP[1] - p[1];
        const dz = oP[2] - p[2];
        if (dx*dx + dy*dy + dz*dz > 2.0) continue;
        if (other.type === "wood_roof") {
          const oR = other.R || [1, 0, 0];
          const oF = other.F || [0, 0, 1];
          const oAngle = other.angle || 0.0;
          const cosOA = Math.cos(oAngle);
          const sinOA = Math.sin(oAngle);
          const otherF = [
            oF[0] * cosOA - oR[0] * sinOA,
            oF[1] * cosOA - oR[1] * sinOA,
            oF[2] * cosOA - oR[2] * sinOA
          ];
          const signedLat = dx * roofR[0] + dy * roofR[1] + dz * roofR[2];
          const latDist = Math.abs(signedLat);
          const deltaF = dx * roofF[0] + dy * roofF[1] + dz * roofF[2];
          const deltaN = dx * n[0] + dy * n[1] + dz * n[2];
          const dotF = roofF[0] * otherF[0] + roofF[1] * otherF[1] + roofF[2] * otherF[2];

          if (dotF > 0.7 && Math.abs(deltaF) < 0.08 && Math.abs(deltaN) < 0.08) {
            if (signedLat > -w * 1.25 && signedLat < -w * 0.75) hasLeftNeighbor = true;
            if (signedLat >  w * 0.75 && signedLat <  w * 1.25) hasRightNeighbor = true;
          }

          if (latDist > w * 0.85) continue;
          if (dotF < -0.6) {
            const u_int = deltaF * 0.5 + deltaN * (d / (2.0 * rise));
            if (u_int > -d * 0.6 && u_int < d * 0.6) {
              const s_int = u_int * (slopeLen / d);
              if (s_int < vMaxEff) {
                vMaxEff = s_int;
              }
            }
          }
        }
      }
      if (!item.isPreview) {
        item._vMaxEff = vMaxEff;
        item._hasLeftN = hasLeftNeighbor;
        item._hasRightN = hasRightNeighbor;
        item._roofDirty = false;
      }
    }

    if (vMaxEff <= vMinEff + 0.01) {
      return;
    }

    // Exterior gable ends extend 0.018m outward to cleanly cap the outer half of gable wood_walls
    const extLeft = (!item.isPreview && !hasLeftNeighbor) ? 0.018 : 0.0;
    const extRight = (!item.isPreview && !hasRightNeighbor) ? 0.018 : 0.0;
    const effW = w + extLeft + extRight;
    const offR = (extRight - extLeft) * 0.5;

    const rawSeed = item.seed || (p[0] * 143.7 + p[2] * 71.9);
    const seedBucket = Math.abs(Math.floor(rawSeed * 10)) % 32;
    const vMaxQuant = Math.round(vMaxEff * 200) / 200;

    if (!window._woodRoofTemplateCache) window._woodRoofTemplateCache = {};
    const tplKey =
      vMaxQuant.toFixed(4) + '_' +
      (extLeft > 0 ? 1 : 0) + '_' +
      (extRight > 0 ? 1 : 0) + '_' +
      (item.isPreview ? 1 : 0) + '_' +
      seedBucket;

    let tpl = window._woodRoofTemplateCache[tplKey];
    if (!tpl) {
      const lv = [], lcMult = [], lidx = [];
      const localR = [1, 0, 0];
      const localN = [0, 1, 0];
      const localF = [0, 0, 1];
      const localDirSlope = [0, rise / slopeLen, d / slopeLen];
      const localNormSlope = [0, d / slopeLen, -rise / slopeLen];

      const effSL = vMaxQuant - vMinEff;
      const midDist = (vMinEff + vMaxQuant) / 2;
      const cSlope = [
        offR,
        rise / 2 + localDirSlope[1] * midDist,
        localDirSlope[2] * midDist
      ];
      const rPos = [
        offR,
        rise / 2 + localDirSlope[1] * (vMaxQuant - 0.012),
        localDirSlope[2] * (vMaxQuant - 0.012)
      ];
      const ePos = [
        offR,
        rise / 2 + localDirSlope[1] * (vMinEff + 0.012),
        localDirSlope[2] * (vMinEff + 0.012)
      ];

      if (item.isPreview) {
        addBox(cSlope, w, 0.024, effSL, [1.0, 1.0, 1.0], localR, localNormSlope, localDirSlope, lv, lcMult, lidx);
        addBox(rPos, w, 0.024, 0.024, [0.8, 0.8, 0.8], localR, localN, localF, lv, lcMult, lidx);
        addBox(ePos, w, 0.024, 0.024, [0.8, 0.8, 0.8], localR, localN, localF, lv, lcMult, lidx);
      } else {
        const seedVal = seedBucket * 19.37;
        function pRand(s) {
          const x = Math.sin(s) * 10000;
          return x - Math.floor(x);
        }

        const rafterW = 0.022;
        const rafterH = 0.024;
        const rafterBase = [
          0.0,
          rise / 2 + localDirSlope[1] * midDist - localNormSlope[1] * 0.005,
          localDirSlope[2] * midDist - localNormSlope[2] * 0.005
        ];
        const rafterInset = w / 2 - rafterW / 2 - 0.014;
        const darkMult = [0.72, 0.72, 0.72];
        const rafterLen = Math.max(0.01, effSL - 0.004);

        addBox([-rafterInset, rafterBase[1], rafterBase[2]], rafterW, rafterH, rafterLen, darkMult, localR, localNormSlope, localDirSlope, lv, lcMult, lidx);
        addBox([rafterInset, rafterBase[1], rafterBase[2]], rafterW, rafterH, rafterLen, darkMult, localR, localNormSlope, localDirSlope, lv, lcMult, lidx);
        addBox([0.0, rafterBase[1], rafterBase[2]], rafterW * 0.9, rafterH, rafterLen, darkMult, localR, localNormSlope, localDirSlope, lv, lcMult, lidx);

        const deckCenter = [
          cSlope[0],
          cSlope[1] + localNormSlope[1] * 0.002,
          cSlope[2] + localNormSlope[2] * 0.002
        ];
        addBox(deckCenter, effW, 0.018, effSL, [0.82, 0.82, 0.82], localR, localNormSlope, localDirSlope, lv, lcMult, lidx);

        const numPlanks = Math.max(1, Math.round(5 * (effSL / slopeLen)));
        const plankLen = effSL / numPlanks;
        const plankThick = 0.014;

        for (let i = 0; i < numPlanks; i++) {
          const distAlong = vMinEff + (i + 0.5) * plankLen;
          const pCenter = [
            offR,
            rise / 2 + localDirSlope[1] * distAlong + localNormSlope[1] * 0.014,
            localDirSlope[2] * distAlong + localNormSlope[2] * 0.014
          ];
          const shadeNoise = pRand(seedVal + i * 19.3);
          const pMult = 0.94 + shadeNoise * 0.12;
          addBox(pCenter, effW, plankThick, plankLen, [pMult, pMult, pMult], localR, localNormSlope, localDirSlope, lv, lcMult, lidx);

          const grainNoiseX = pRand(seedVal + i * 37.1);
          const grainOffsetR = (grainNoiseX - 0.5) * (w * 0.5);
          const gCenter = [
            pCenter[0] + grainOffsetR,
            pCenter[1] + localNormSlope[1] * (plankThick * 0.5 + 0.0012),
            pCenter[2] + localNormSlope[2] * (plankThick * 0.5 + 0.0012)
          ];
          addBox(gCenter, 0.008, 0.0024, plankLen * 0.82, [0.6, 0.6, 0.6], localR, localNormSlope, localDirSlope, lv, lcMult, lidx);
        }

        addBox(rPos, effW, 0.026, 0.028, [0.78, 0.78, 0.78], localR, localN, localF, lv, lcMult, lidx);
        addBox(ePos, effW, 0.026, 0.028, [0.75, 0.75, 0.75], localR, localN, localF, lv, lcMult, lidx);
      }

      tpl = {
        v: new Float32Array(lv),
        cMult: new Float32Array(lcMult),
        idx: new Uint16Array(lidx)
      };
      window._woodRoofTemplateCache[tplKey] = tpl;
    }

    const isValid = item.isValidPlacement !== false;
    const baseColor = item.isPreview
      ? (isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2])
      : (item.color || [0.65, 0.45, 0.25]);
    const rCol = baseColor[0], gCol = baseColor[1], bCol = baseColor[2];

    const baseVertIdx = vertices.length / 3;
    const tv = tpl.v;
    const tcMult = tpl.cMult;
    const tidx = tpl.idx;
    const p0 = p[0], p1 = p[1], p2 = p[2];
    const rr0 = roofR[0], rr1 = roofR[1], rr2 = roofR[2];
    const n0 = n[0], n1 = n[1], n2 = n[2];
    const rf0 = roofF[0], rf1 = roofF[1], rf2 = roofF[2];
    const det = (rr1 * n2 - rr2 * n1) * rf0 + (rr2 * n0 - rr0 * n2) * rf1 + (rr0 * n1 - rr1 * n0) * rf2;
    const isFlipped = det < 0;

    for (let i = 0, len = tv.length; i < len; i += 3) {
      const lx = tv[i], ly = tv[i + 1], lz = tv[i + 2];
      vertices.push(
        p0 + lx * rr0 + ly * n0 + lz * rf0,
        p1 + lx * rr1 + ly * n1 + lz * rf1,
        p2 + lx * rr2 + ly * n2 + lz * rf2
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
};

