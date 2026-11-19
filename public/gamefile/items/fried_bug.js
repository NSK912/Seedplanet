// === SEEDPLANET MODULE: JS/ITEMS/FRIED_BUG.JS ===

window.ItemRegistry = window.ItemRegistry || {};

function _buildFriedBugLocalTemplate(localVertices, localColors, localIndices) {
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

  const stdCubeIndices = [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6,
    0, 7, 3, 0, 4, 7, 1, 2, 6, 1, 6, 5
  ];

  for (let b = 0; b < boxes.length; b++) {
    const [c, w, h, d, col] = boxes[b];
    const hw = w * 0.5, hh = h * 0.5, hd = d * 0.5;
    const cubeVerts = [
      [-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd],
      [-hw, hh, -hd], [hw, hh, -hd], [hw, hh, hd], [-hw, hh, hd]
    ];
    const baseIdx = localVertices.length / 3;
    for (let i = 0; i < 8; i++) {
      localVertices.push(c[0] + cubeVerts[i][0], c[1] + cubeVerts[i][1], c[2] + cubeVerts[i][2]);
      localColors.push(col[0], col[1], col[2]);
    }
    for (let i = 0; i < 36; i++) {
      localIndices.push(baseIdx + stdCubeIndices[i]);
    }
  }
}

window.buildFriedBugModel = function(
  seed,
  scaleMultiplier,
  offset,
  r, n, f,
  rawVertices, rawColors, rawIndices
) {
  const S = scaleMultiplier || 1.0;
  const tpl = window.DropTemplateCache.getOrBake("fried_bug_v1", _buildFriedBugLocalTemplate);
  if (!tpl) return;
  window.DropTemplateCache.emit(
    tpl,
    offset || [0, 0, 0],
    r || [1, 0, 0],
    n || [0, 1, 0],
    f || [0, 0, 1],
    S,
    0,
    rawVertices,
    rawColors,
    rawIndices
  );
};

// Also export as a global function directly
window.buildFriedBugModel = window.buildFriedBugModel;

window.ItemRegistry["fried_bug"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const isIcon = (targetBuffer === "preview" || !!(item && item.isIconPreview));
    const p = (item && item.position) ? item.position : [0, 0, 0];
    const r = (item && item.R) ? item.R : [1, 0, 0];
    const n = (item && item.normal) ? item.normal : [0, 1, 0];
    const f = (item && item.F) ? item.F : [0, 0, 1];
    const s = isIcon ? 1.0 : ((item && typeof item.size === "number") ? item.size * 3.0 : 0.24);
    const lift = isIcon ? 0.0 : 0.08;
    const pos = [p[0] + n[0] * lift * s, p[1] + n[1] * lift * s, p[2] + n[2] * lift * s];
    window.buildFriedBugModel(item && item.seed ? item.seed : 1234, s, pos, r, n, f, vertices, colors, indices);
  }
};
window.ItemRegistry["FRIED_BUG"] = window.ItemRegistry["fried_bug"];
