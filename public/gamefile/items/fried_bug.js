// === SEEDPLANET MODULE: JS/ITEMS/FRIED_BUG.JS ===

let _friedBugTemplateCache = null;

function getFriedBugTemplate() {
  if (_friedBugTemplateCache) return _friedBugTemplateCache;

  const crispyCol1 = [0.45, 0.25, 0.08]; // Dark golden brown
  const crispyCol2 = [0.30, 0.15, 0.05]; // Dark brown
  const crispyCol3 = [0.60, 0.35, 0.10]; // Light crispy

  const boxes = [
    [[0, 0.05, 0.2], 0.08, 0.08, 0.08, crispyCol2],
    [[-0.05, 0.06, 0.22], 0.05, 0.05, 0.05, crispyCol3],
    [[0.05, 0.06, 0.22], 0.05, 0.05, 0.05, crispyCol3],
    [[0, 0.02, 0.1], 0.1, 0.1, 0.15, crispyCol1],
    [[0, 0, -0.1], 0.05, 0.05, 0.15, crispyCol2],
    [[0, -0.01, -0.25], 0.04, 0.04, 0.15, crispyCol1],
    [[0, -0.02, -0.4], 0.03, 0.03, 0.15, crispyCol2],
    [[-0.1, 0.1, 0.1], 0.08, 0.02, 0.02, crispyCol2],
    [[0.1, 0.1, 0.1], 0.08, 0.02, 0.02, crispyCol2],
    [[-0.08, 0.08, -0.05], 0.08, 0.02, 0.02, crispyCol3],
    [[0.08, 0.08, -0.05], 0.08, 0.02, 0.02, crispyCol3]
  ];

  const centers = [];
  const localOffsets = [];
  const colors = [];
  const indices = [];
  const indicesFlipped = [];

  const stdCubeIndices = [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6,
    0, 7, 3, 0, 4, 7, 1, 2, 6, 1, 6, 5
  ];
  const flipCubeIndices = [
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6,
    0, 5, 1, 0, 4, 5, 2, 7, 3, 2, 6, 7,
    0, 3, 7, 0, 7, 4, 1, 6, 2, 1, 5, 6
  ];

  for (let b = 0; b < boxes.length; b++) {
    const [c, w, h, d, col] = boxes[b];
    const hw = w * 0.5, hh = h * 0.5, hd = d * 0.5;
    const cubeVerts = [
      [-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd],
      [-hw, hh, -hd], [hw, hh, -hd], [hw, hh, hd], [-hw, hh, hd]
    ];
    const baseIdx = centers.length / 3;
    for (let i = 0; i < 8; i++) {
      centers.push(c[0], c[1], c[2]);
      localOffsets.push(cubeVerts[i][0], cubeVerts[i][1], cubeVerts[i][2]);
      colors.push(col[0], col[1], col[2]);
    }
    for (let i = 0; i < 36; i++) {
      indices.push(baseIdx + stdCubeIndices[i]);
      indicesFlipped.push(baseIdx + flipCubeIndices[i]);
    }
  }

  _friedBugTemplateCache = {
    centers: new Float32Array(centers),
    localOffsets: new Float32Array(localOffsets),
    colors: new Float32Array(colors),
    indices: new Uint16Array(indices),
    indicesFlipped: new Uint16Array(indicesFlipped)
  };
  return _friedBugTemplateCache;
}

window.buildFriedBugModel = function(
  seed,
  scaleMultiplier,
  offset,
  r, n, f,
  rawVertices, rawColors, rawIndices
) {
  const S = scaleMultiplier;
  const ox = offset[0];
  const oy = offset[1];
  const oz = offset[2];

  const tpl = getFriedBugTemplate();
  const centers = tpl.centers;
  const offs = tpl.localOffsets;
  const lc = tpl.colors;

  let isFlipped = false;
  if (r && n && f) {
    const det = (r[1] * n[2] - r[2] * n[1]) * f[0] +
                (r[2] * n[0] - r[0] * n[2]) * f[1] +
                (r[0] * n[1] - r[1] * n[0]) * f[2];
    if (det < 0) isFlipped = true;
  }
  const li = isFlipped ? tpl.indicesFlipped : tpl.indices;
  const baseIdx = rawVertices.length / 3;

  for (let i = 0, len = centers.length; i < len; i += 3) {
    const vx = offs[i], vy = offs[i + 1], vz = offs[i + 2];
    const rx = r[0] * vx + n[0] * vy + f[0] * vz;
    const ry = r[1] * vx + n[1] * vy + f[1] * vz;
    const rz = r[2] * vx + n[2] * vy + f[2] * vz;
    rawVertices.push(
      ox + (centers[i] + rx) * S,
      oy + (centers[i + 1] + ry) * S,
      oz + (centers[i + 2] + rz) * S
    );
    rawColors.push(lc[i], lc[i + 1], lc[i + 2]);
  }

  for (let i = 0, len = li.length; i < len; i++) {
    rawIndices.push(baseIdx + li[i]);
  }
};

// Also export as a global function directly
window.buildFriedBugModel = window.buildFriedBugModel;
