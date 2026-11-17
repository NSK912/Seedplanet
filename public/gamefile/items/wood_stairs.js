// === SEEDPLANET MODULE: JS/ITEMS/WOOD_STAIRS.JS ===

(function() {
  const UNIT_CUBE_CORNERS = [
    [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5],
    [-0.5,  0.5, -0.5], [0.5,  0.5, -0.5], [0.5,  0.5, 0.5], [-0.5,  0.5, 0.5]
  ];
  const CUBE_INDS_NORMAL = [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    2, 3, 7, 2, 7, 6,
    0, 7, 3, 0, 4, 7,
    1, 2, 6, 1, 6, 5
  ];
  const CUBE_INDS_FLIPPED = [
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 5, 1, 0, 4, 5,
    2, 7, 3, 2, 6, 7,
    0, 3, 7, 0, 7, 4,
    1, 6, 2, 1, 5, 6
  ];

  const _stairShadeMultCache = new Map();
  function _getStairShadeMults(seedBucket, numSteps) {
    const key = (seedBucket << 8) | numSteps;
    let mults = _stairShadeMultCache.get(key);
    if (mults) return mults;
    mults = new Float32Array(numSteps);
    for (let i = 0; i < numSteps; i++) {
      const x = Math.sin(seedBucket + i * 17.3) * 10000;
      const noise = x - Math.floor(x);
      mults[i] = 0.85 + noise * 0.25;
    }
    _stairShadeMultCache.set(key, mults);
    return mults;
  }

  const _beamCornerX = new Float32Array(8);
  const _beamCornerY = new Float32Array(8);
  const _beamCornerZ = new Float32Array(8);
  const _stepCornerX = new Float32Array(8);
  const _stepCornerY = new Float32Array(8);
  const _stepCornerZ = new Float32Array(8);

  window.ItemRegistry["wood_stairs"] = {
    render: function(item, vertices, colors, indices, targetBuffer) {
      const p = item.position || [0, 0, 0];
      const r = item.R || [1, 0, 0], // sideways vector (tangent along the edge)
        f = item.F || [0, 0, 1],     // forward slope vector
        n = item.normal || [0, 1, 0]; // up vector of the parent floor panel

      let P_top = item.stairTop;
      let P_bottom = item.stairBottom;

      if (!P_top || !P_bottom) {
        P_top = [p[0] - f[0] * 0.175, p[1] - f[1] * 0.175, p[2] - f[2] * 0.175];
        P_bottom = [p[0] + f[0] * 0.175, p[1] + f[1] * 0.175, p[2] + f[2] * 0.175];
      }

      // Shift stairs down and outwards slightly to prevent top step and beams from poking above the snapped floor surface or clipping into it
      const vOffset = 0.01;
      const dx0 = P_top[0] - P_bottom[0];
      const dy0 = P_top[1] - P_bottom[1];
      const dz0 = P_top[2] - P_bottom[2];
      const len_v_initial = Math.sqrt(dx0 * dx0 + dy0 * dy0 + dz0 * dz0) || 1;
      const invLen0 = 1.0 / len_v_initial;
      const dux0 = dx0 * invLen0, duy0 = dy0 * invLen0, duz0 = dz0 * invLen0;

      const hOffset = 0.025; // Shift outward along slope
      const shiftX = -n[0] * vOffset - dux0 * hOffset;
      const shiftY = -n[1] * vOffset - duy0 * hOffset;
      const shiftZ = -n[2] * vOffset - duz0 * hOffset;

      const pTopX = P_top[0] + shiftX, pTopY = P_top[1] + shiftY, pTopZ = P_top[2] + shiftZ;
      const pBotX = P_bottom[0] + shiftX, pBotY = P_bottom[1] + shiftY, pBotZ = P_bottom[2] + shiftZ;

      const dvx = pTopX - pBotX, dvy = pTopY - pBotY, dvz = pTopZ - pBotZ;
      const len_v = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz) || 1;
      const invLen = 1.0 / len_v;
      const dux = dvx * invLen, duy = dvy * invLen, duz = dvz * invLen;

      // N_stair is the orthogonal up vector of the inclined stair (N_stair = dir_un x r)
      let nsx = duy * r[2] - duz * r[1];
      let nsy = duz * r[0] - dux * r[2];
      let nsz = dux * r[1] - duy * r[0];
      let srx = r[0], sry = r[1], srz = r[2];

      // Ensure N_stair points outwards away from planet center (matching n)
      if (nsx * n[0] + nsy * n[1] + nsz * n[2] < 0) {
        nsx = -nsx; nsy = -nsy; nsz = -nsz;
        srx = -srx; sry = -sry; srz = -srz;
      }

      const w_stair = 0.3;
      const beamW = 0.02;
      const beamH = 0.035;

      const isValid = item.isValidPlacement !== false;
      const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
      const baseColor = item.isPreview ? previewColor : (item.color || [0.65, 0.45, 0.25]);
      const rCol = baseColor[0], gCol = baseColor[1], bCol = baseColor[2];
      const bR = rCol * 0.8, bG = gCol * 0.8, bB = bCol * 0.8;

      // Precompute the 8 rotated corner offsets for the 2 side stringer beams once per stair
      const bRx = srx * beamW, bRy = sry * beamW, bRz = srz * beamW;
      const bUx = nsx * beamH, bUy = nsy * beamH, bUz = nsz * beamH;
      const bFx = dux * len_v, bFy = duy * len_v, bFz = duz * len_v;
      for (let c = 0; c < 8; c++) {
        const u = UNIT_CUBE_CORNERS[c];
        _beamCornerX[c] = bRx * u[0] + bUx * u[1] + bFx * u[2];
        _beamCornerY[c] = bRy * u[0] + bUy * u[1] + bFy * u[2];
        _beamCornerZ[c] = bRz * u[0] + bUz * u[1] + bFz * u[2];
      }
      const detBeam = (srx * (nsy * duz - nsz * duy) - sry * (nsx * duz - nsz * dux) + srz * (nsx * duy - nsy * dux));
      const beamInds = detBeam < 0 ? CUBE_INDS_FLIPPED : CUBE_INDS_NORMAL;

      const midX = pBotX + dvx * 0.5, midY = pBotY + dvy * 0.5, midZ = pBotZ + dvz * 0.5;
      const sideOff = w_stair * 0.42;

      // Emit Left & Right Stringer Beams (2 boxes = 16 verts, 72 indices)
      for (let side = -1; side <= 1; side += 2) {
        const cx = midX + r[0] * (side * sideOff);
        const cy = midY + r[1] * (side * sideOff);
        const cz = midZ + r[2] * (side * sideOff);
        const baseIdx = vertices.length / 3;
        for (let c = 0; c < 8; c++) {
          vertices.push(cx + _beamCornerX[c], cy + _beamCornerY[c], cz + _beamCornerZ[c]);
          colors.push(bR, bG, bB);
        }
        for (let k = 0; k < 36; k++) {
          indices.push(baseIdx + beamInds[k]);
        }
      }

      // Precompute the 8 rotated corner offsets for horizontal step treads once per stair
      const numSteps = Math.max(2, Math.floor(len_v / 0.08));
      const stepW = w_stair - 0.02;
      const stepH = 0.015;
      const stepD = 0.075;
      const sRx = r[0] * stepW, sRy = r[1] * stepW, sRz = r[2] * stepW;
      const sUx = n[0] * stepH, sUy = n[1] * stepH, sUz = n[2] * stepH;
      const sFx = f[0] * stepD, sFy = f[1] * stepD, sFz = f[2] * stepD;
      for (let c = 0; c < 8; c++) {
        const u = UNIT_CUBE_CORNERS[c];
        _stepCornerX[c] = sRx * u[0] + sUx * u[1] + sFx * u[2];
        _stepCornerY[c] = sRy * u[0] + sUy * u[1] + sFy * u[2];
        _stepCornerZ[c] = sRz * u[0] + sUz * u[1] + sFz * u[2];
      }
      const detStep = (r[1] * n[2] - r[2] * n[1]) * f[0] + (r[2] * n[0] - r[0] * n[2]) * f[1] + (r[0] * n[1] - r[1] * n[0]) * f[2];
      const stepInds = detStep < 0 ? CUBE_INDS_FLIPPED : CUBE_INDS_NORMAL;

      const rawSeed = item.seed || (p[0] * 123.4 + p[2] * 56.7);
      const seedBucket = Math.abs(Math.floor(rawSeed * 10)) % 64;
      const shadeMults = _getStairShadeMults(seedBucket, numSteps);
      const invStepDenom = 1.0 / (numSteps - 1);

      for (let i = 0; i < numSteps; i++) {
        const t = i * invStepDenom;
        const cx = pBotX + dvx * t;
        const cy = pBotY + dvy * t;
        const cz = pBotZ + dvz * t;
        const m = shadeMults[i];
        const sR = rCol * m, sG = gCol * m, sB = bCol * m;
        const baseIdx = vertices.length / 3;
        for (let c = 0; c < 8; c++) {
          vertices.push(cx + _stepCornerX[c], cy + _stepCornerY[c], cz + _stepCornerZ[c]);
          colors.push(sR, sG, sB);
        }
        for (let k = 0; k < 36; k++) {
          indices.push(baseIdx + stepInds[k]);
        }
      }
    }
  };
})();

