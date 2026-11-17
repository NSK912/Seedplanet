// === SEEDPLANET MODULE: JS/ITEMS/LANTERN.JS ===
// Low-Poly Iron & Glow Ore Lantern (ตะเกียงหินเรืองแสง)
// Crafted from Glowing Ore (1) + Iron Ore (1)
// Placeable on Wooden Tables (wood_table) and Wooden Floors (wood_floor / thin_wood_floor)

(function() {
  window.ItemRegistry = window.ItemRegistry || {};

  function drawBoxFallback(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices) {
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;
    let r = right || [1, 0, 0], u = up || [0, 1, 0], f = forward || [0, 0, 1];
    let isFlipped = false;
    if (r && u && f) {
      const det = (r[1]*u[2] - r[2]*u[1])*f[0] + (r[2]*u[0] - r[0]*u[2])*f[1] + (r[0]*u[1] - r[1]*u[0])*f[2];
      if (det < 0) {
        isFlipped = true;
      }
    }
    const cubeVerts = [
      [-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd],
      [-hw, hh, -hd], [hw, hh, -hd], [hw, hh, hd], [-hw, hh, hd]
    ];
    const cubeIndices = isFlipped ? [
      0, 1, 2, 0, 2, 3,
      4, 6, 5, 4, 7, 6,
      0, 5, 1, 0, 4, 5,
      2, 7, 3, 2, 6, 7,
      0, 3, 7, 0, 7, 4,
      1, 6, 2, 1, 5, 6
    ] : [
      0, 2, 1, 0, 3, 2,
      4, 5, 6, 4, 6, 7,
      0, 1, 5, 0, 5, 4,
      2, 3, 7, 2, 7, 6,
      0, 7, 3, 0, 4, 7,
      1, 2, 6, 1, 6, 5
    ];
    const baseIdx = outVertices.length / 3;
    for (let i = 0; i < 8; i++) {
      const v = cubeVerts[i];
      const rx = r[0]*v[0] + u[0]*v[1] + f[0]*v[2];
      const ry = r[1]*v[0] + u[1]*v[1] + f[1]*v[2];
      const rz = r[2]*v[0] + u[2]*v[1] + f[2]*v[2];
      outVertices.push(center[0]+rx, center[1]+ry, center[2]+rz);
      outColors.push(color[0], color[1], color[2]);
    }
    for (let i = 0; i < cubeIndices.length; i++) {
      outIndices.push(baseIdx + cubeIndices[i]);
    }
  }

  const _lanternTemplateCache = [null, null, null];

  function _getLanternTemplate(mode) {
    if (_lanternTemplateCache[mode]) return _lanternTemplateCache[mode];

    const isPreview = mode !== 0;
    const previewColor = mode === 1 ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    const s = 0.46;

    const ironDark = isPreview ? previewColor : [0.24, 0.26, 0.30];
    const ironMid = isPreview ? previewColor : [0.35, 0.38, 0.43];
    const ironLight = isPreview ? previewColor : [0.46, 0.49, 0.54];
    const glowCoreColor = isPreview ? previewColor : [0.22, 0.95, 0.88];

    const LR = [1, 0, 0], LU = [0, 1, 0], LF = [0, 0, 1];
    const invSqrt2 = 0.70710678;
    const LR45 = [invSqrt2, 0, invSqrt2];
    const LF45 = [-invSqrt2, 0, invSqrt2];
    const tVerts = [], tCols = [], tInds = [];

    // 1) Stepped Iron Base
    drawBoxFallback([0, 0.006 * s, 0], 0.072 * s, 0.012 * s, 0.072 * s, ironDark, LR, LU, LF, tVerts, tCols, tInds);
    drawBoxFallback([0, 0.016 * s, 0], 0.056 * s, 0.010 * s, 0.056 * s, ironMid, LR, LU, LF, tVerts, tCols, tInds);

    // 2) Faceted Glowing Ore Crystal Core
    drawBoxFallback([0, 0.049 * s, 0], 0.038 * s, 0.056 * s, 0.038 * s, glowCoreColor, LR, LU, LF, tVerts, tCols, tInds);
    drawBoxFallback([0, 0.049 * s, 0], 0.036 * s, 0.052 * s, 0.036 * s, glowCoreColor, LR45, LU, LF45, tVerts, tCols, tInds);

    // 3) 4 Iron Corner Cage Bars
    const pillarOffsets = [
      [-0.023 * s, 0.049 * s, -0.023 * s],
      [ 0.023 * s, 0.049 * s, -0.023 * s],
      [-0.023 * s, 0.049 * s,  0.023 * s],
      [ 0.023 * s, 0.049 * s,  0.023 * s]
    ];
    for (let i = 0; i < 4; i++) {
      drawBoxFallback(pillarOffsets[i], 0.008 * s, 0.058 * s, 0.008 * s, ironMid, LR, LU, LF, tVerts, tCols, tInds);
    }

    // 4) Stepped Low-Poly Iron Hood / Cap
    drawBoxFallback([0, 0.081 * s, 0], 0.068 * s, 0.010 * s, 0.068 * s, ironMid, LR, LU, LF, tVerts, tCols, tInds);
    drawBoxFallback([0, 0.091 * s, 0], 0.048 * s, 0.012 * s, 0.048 * s, ironLight, LR, LU, LF, tVerts, tCols, tInds);
    drawBoxFallback([0, 0.101 * s, 0], 0.026 * s, 0.010 * s, 0.026 * s, ironDark, LR, LU, LF, tVerts, tCols, tInds);

    // 5) Top Iron Handle Loop
    drawBoxFallback([-0.014 * s, 0.112 * s, 0], 0.006 * s, 0.014 * s, 0.006 * s, ironDark, LR, LU, LF, tVerts, tCols, tInds);
    drawBoxFallback([ 0.014 * s, 0.112 * s, 0], 0.006 * s, 0.014 * s, 0.006 * s, ironDark, LR, LU, LF, tVerts, tCols, tInds);
    drawBoxFallback([0, 0.120 * s, 0], 0.034 * s, 0.006 * s, 0.006 * s, ironLight, LR, LU, LF, tVerts, tCols, tInds);

    const tpl = {
      verts: new Float32Array(tVerts),
      cols: new Float32Array(tCols),
      inds: new Uint16Array(tInds),
      vertCount: tVerts.length / 3
    };
    _lanternTemplateCache[mode] = tpl;
    return tpl;
  }

  window.ItemRegistry["lantern"] = {
    render: function(item, vertices, colors, indices, targetBuffer) {
      const p = item.position || [0, 0, 0];
      const r = item.R || [1, 0, 0];
      const f = item.F || [0, 0, 1];
      const n = item.normal || [0, 1, 0];
      const isPreview = item.isPreview && !item.isIconPreview;
      const isValid = item.isValidPlacement !== false;
      const mode = isPreview ? (isValid ? 1 : 2) : 0;

      const tpl = _getLanternTemplate(mode);
      const tVerts = tpl.verts;
      const tCols = tpl.cols;
      const tInds = tpl.inds;
      const vCount = tpl.vertCount;
      const baseIdx = vertices.length / 3;

      const px = p[0], py = p[1], pz = p[2];
      const rx = r[0], ry = r[1], rz = r[2];
      const nx = n[0], ny = n[1], nz = n[2];
      const fx = f[0], fy = f[1], fz = f[2];
      const det = (ry * nz - rz * ny) * fx + (rz * nx - rx * nz) * fy + (rx * ny - ry * nx) * fz;
      const isFlipped = det < 0;

      for (let i = 0; i < vCount; i++) {
        const vi = i * 3;
        const lx = tVerts[vi], ly = tVerts[vi + 1], lz = tVerts[vi + 2];
        vertices.push(
          px + rx * lx + nx * ly + fx * lz,
          py + ry * lx + ny * ly + fy * lz,
          pz + rz * lx + nz * ly + fz * lz
        );
        colors.push(tCols[vi], tCols[vi + 1], tCols[vi + 2]);
      }

      const iLen = tInds.length;
      if (isFlipped) {
        for (let i = 0; i < iLen; i += 3) {
          indices.push(baseIdx + tInds[i], baseIdx + tInds[i + 2], baseIdx + tInds[i + 1]);
        }
      } else {
        for (let i = 0; i < iLen; i++) {
          indices.push(baseIdx + tInds[i]);
        }
      }
    }
  };

  window.ItemRegistry["LANTERN"] = window.ItemRegistry["lantern"];
})();
