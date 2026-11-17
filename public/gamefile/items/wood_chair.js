// === SEEDPLANET MODULE: JS/ITEMS/WOOD_CHAIR.JS ===
// Wooden Chair (เก้าอี้ไม้) - Low-Poly Design
// Crafted from Wood Log (1)

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

  const _woodChairTemplateCache = [null, null, null];

  function _getWoodChairTemplate(mode) {
    if (_woodChairTemplateCache[mode]) return _woodChairTemplateCache[mode];

    const isPreview = mode !== 0;
    const previewColor = mode === 1 ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    const s = 0.46;

    const woodSeatColor = isPreview ? previewColor : [0.58, 0.40, 0.22];
    const woodBackColor = isPreview ? previewColor : [0.52, 0.35, 0.19];
    const woodFrameColor = isPreview ? previewColor : [0.45, 0.29, 0.15];
    const woodLegColor = isPreview ? previewColor : [0.38, 0.24, 0.12];

    const LR = [1, 0, 0], LU = [0, 1, 0], LF = [0, 0, 1];
    const tVerts = [], tCols = [], tInds = [];

    // 1) 4 Wooden Chair Legs
    const legOffsets = [
      [-0.052 * s, 0.042 * s, -0.052 * s],
      [ 0.052 * s, 0.042 * s, -0.052 * s],
      [-0.052 * s, 0.042 * s,  0.052 * s],
      [ 0.052 * s, 0.042 * s,  0.052 * s]
    ];
    for (let i = 0; i < 4; i++) {
      drawBoxFallback(legOffsets[i], 0.022 * s, 0.084 * s, 0.022 * s, woodLegColor, LR, LU, LF, tVerts, tCols, tInds);
    }

    // 2) Seat Support Frame
    drawBoxFallback([0, 0.076 * s, 0], 0.118 * s, 0.016 * s, 0.118 * s, woodFrameColor, LR, LU, LF, tVerts, tCols, tInds);

    // 3) Wooden Seat Plank
    drawBoxFallback([0, 0.092 * s, 0], 0.135 * s, 0.020 * s, 0.135 * s, woodSeatColor, LR, LU, LF, tVerts, tCols, tInds);

    // 4) Backrest Left & Right Vertical Posts
    drawBoxFallback([-0.052 * s, 0.155 * s, -0.054 * s], 0.022 * s, 0.115 * s, 0.022 * s, woodLegColor, LR, LU, LF, tVerts, tCols, tInds);
    drawBoxFallback([ 0.052 * s, 0.155 * s, -0.054 * s], 0.022 * s, 0.115 * s, 0.022 * s, woodLegColor, LR, LU, LF, tVerts, tCols, tInds);

    // 5) Backrest Horizontal Slats
    drawBoxFallback([0, 0.138 * s, -0.054 * s], 0.128 * s, 0.028 * s, 0.018 * s, woodBackColor, LR, LU, LF, tVerts, tCols, tInds);
    drawBoxFallback([0, 0.186 * s, -0.054 * s], 0.128 * s, 0.028 * s, 0.018 * s, woodBackColor, LR, LU, LF, tVerts, tCols, tInds);

    const tpl = {
      verts: new Float32Array(tVerts),
      cols: new Float32Array(tCols),
      inds: new Uint16Array(tInds),
      vertCount: tVerts.length / 3
    };
    _woodChairTemplateCache[mode] = tpl;
    return tpl;
  }

  window.ItemRegistry["wood_chair"] = {
    render: function(item, vertices, colors, indices, targetBuffer) {
      const p = item.position || [0, 0, 0];
      const r = item.R || [1, 0, 0];
      const f = item.F || [0, 0, 1];
      const n = item.normal || [0, 1, 0];
      const isPreview = item.isPreview;
      const isValid = item.isValidPlacement !== false;
      const mode = isPreview ? (isValid ? 1 : 2) : 0;

      const tpl = _getWoodChairTemplate(mode);
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

  window.ItemRegistry["WOOD_CHAIR"] = window.ItemRegistry["wood_chair"];
})();
