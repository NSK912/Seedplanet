// === SEEDPLANET MODULE: JS/ITEMS/DRAGON_FRUIT.JS ===

window.ItemRegistry = window.ItemRegistry || {};

function _buildDragonFruitLocalTemplate(localVertices, localColors, localIndices) {
  const colStem = [0.45, 0.55, 0.20];
  const colBodyDark = [0.80, 0.10, 0.38];
  const colBodyMid = [0.92, 0.14, 0.46];
  const colBodyBright = [0.98, 0.20, 0.52];
  const colScaleBase = [0.75, 0.45, 0.25];
  const colScaleTip = [0.32, 0.85, 0.22];
  const colCrownTip = [0.38, 0.88, 0.25];

  function addTri(p0, p1, p2, c0, c1, c2) {
    const idx = localVertices.length / 3;
    localVertices.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    localColors.push(c0[0], c0[1], c0[2], c1[0], c1[1], c1[2], c2[0], c2[1], c2[2]);
    localIndices.push(idx, idx + 1, idx + 2);
  }

  function addQuad(p0, p1, p2, p3, c0, c1, c2, c3) {
    const idx = localVertices.length / 3;
    localVertices.push(
      p0[0], p0[1], p0[2],
      p1[0], p1[1], p1[2],
      p2[0], p2[1], p2[2],
      p3[0], p3[1], p3[2]
    );
    localColors.push(
      c0[0], c0[1], c0[2],
      c1[0], c1[1], c1[2],
      c2[0], c2[1], c2[2],
      c3[0], c3[1], c3[2]
    );
    localIndices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
  }

  const N_SEGS = 6;
  const rings = [
    { y: -0.16, r: 0.035, col: colStem },
    { y: -0.09, r: 0.09,  col: colBodyDark },
    { y:  0.01, r: 0.145, col: colBodyMid },
    { y:  0.11, r: 0.14,  col: colBodyBright },
    { y:  0.19, r: 0.085, col: colBodyMid },
    { y:  0.25, r: 0.035, col: colScaleBase },
  ];

  const ringPts = [];
  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri];
    const pts = [];
    for (let si = 0; si < N_SEGS; si++) {
      const angle = (si / N_SEGS) * Math.PI * 2 + (ri * 0.15);
      pts.push([Math.cos(angle) * ring.r, ring.y, Math.sin(angle) * ring.r]);
    }
    ringPts.push(pts);
  }

  for (let ri = 0; ri < rings.length - 1; ri++) {
    const curR = rings[ri];
    const nextR = rings[ri + 1];
    const curPts = ringPts[ri];
    const nextPts = ringPts[ri + 1];
    for (let si = 0; si < N_SEGS; si++) {
      const nextSi = (si + 1) % N_SEGS;
      addQuad(
        curPts[si], curPts[nextSi], nextPts[nextSi], nextPts[si],
        curR.col, curR.col, nextR.col, nextR.col
      );
    }
  }

  const pBottomStem = [0, -0.22, 0];
  for (let si = 0; si < N_SEGS; si++) {
    const nextSi = (si + 1) % N_SEGS;
    addTri(pBottomStem, ringPts[0][nextSi], ringPts[0][si], colStem, colStem, colStem);
  }

  const scaleTiers = [
    { ringIdx: 1, outDist: 0.07, lift: 0.08, width: 0.05, count: 6, angleOffset: 0.0 },
    { ringIdx: 2, outDist: 0.085, lift: 0.09, width: 0.055, count: 6, angleOffset: Math.PI / 6 },
    { ringIdx: 3, outDist: 0.075, lift: 0.08, width: 0.045, count: 6, angleOffset: 0.0 },
  ];

  for (let ti = 0; ti < scaleTiers.length; ti++) {
    const tier = scaleTiers[ti];
    const baseRing = rings[tier.ringIdx];
    for (let si = 0; si < tier.count; si++) {
      const angle = (si / tier.count) * Math.PI * 2 + tier.angleOffset;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const tanX = -sinA * tier.width * 0.5;
      const tanZ = cosA * tier.width * 0.5;

      const basePos = [cosA * baseRing.r, baseRing.y, sinA * baseRing.r];
      const pLeft = [basePos[0] + tanX, basePos[1], basePos[2] + tanZ];
      const pRight = [basePos[0] - tanX, basePos[1], basePos[2] - tanZ];
      const pTip = [
        cosA * (baseRing.r + tier.outDist),
        baseRing.y + tier.lift,
        sinA * (baseRing.r + tier.outDist)
      ];

      addTri(pLeft, pRight, pTip, colScaleBase, colScaleBase, colScaleTip);
      addTri(pRight, pLeft, pTip, colScaleBase, colScaleBase, colScaleTip);
    }
  }

  const crownCount = 5;
  for (let ci = 0; ci < crownCount; ci++) {
    const angle = (ci / crownCount) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const tanX = -sinA * 0.025;
    const tanZ = cosA * 0.025;

    const pBaseL = [cosA * 0.035 + tanX, 0.24, sinA * 0.035 + tanZ];
    const pBaseR = [cosA * 0.035 - tanX, 0.24, sinA * 0.035 - tanZ];
    const pCrownTip = [cosA * 0.065, 0.31, sinA * 0.065];

    addTri(pBaseL, pBaseR, pCrownTip, colScaleBase, colScaleBase, colCrownTip);
    addTri(pBaseR, pBaseL, pCrownTip, colScaleBase, colScaleBase, colCrownTip);
  }
}

window.buildDragonFruitModel = function(
  seed,
  scaleMultiplier,
  offset,
  r, n, f,
  rawVertices, rawColors, rawIndices,
  colorEncoder
) {
  const S = scaleMultiplier || 1.0;
  const tpl = window.DropTemplateCache.getOrBake("dragon_fruit_v1", _buildDragonFruitLocalTemplate);
  if (!tpl) return;
  window.DropTemplateCache.emit(tpl, offset, r, n, f, S, 0, rawVertices, rawColors, rawIndices, colorEncoder);
};

window.ItemRegistry["dragon_fruit"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const r = item.R || [1, 0, 0];
    const n = item.normal || [0, 1, 0];
    const f = item.F || [0, 0, 1];
    const s = item.size || 0.04;

    const scale = s * 2.2;
    // When attached to a tree branch, anchor the stem socket (y = -0.16) directly at the branch position p
    // so pBottomStem (y = -0.22) embeds inside the existing branch with zero gap.
    const liftDist = item.isAttachedToTree ? (scale * 0.16) : (s * 0.45);
    const elevatedPos = [
      p[0] + n[0] * liftDist,
      p[1] + n[1] * liftDist,
      p[2] + n[2] * liftDist,
    ];

    const colorEncoder = item.isAttachedToTree
      ? function(col) {
          const cR = Math.max(0.0, Math.min(1.0, col[0]));
          const cG = Math.max(0.0, Math.min(1.0, col[1]));
          const cB = Math.max(0.0, Math.min(1.0, col[2]));
          const swayWeight = typeof item.swayWeight === "number" ? item.swayWeight : 1.0;
          const swayWeightInt = Math.round(Math.max(0.0, Math.min(1.0, swayWeight)) * 100.0);
          const encoded = cB + (swayWeightInt + 10.0) * 2.0;
          return [cR, cG, -encoded];
        }
      : null;

    window.buildDragonFruitModel(
      item.seed || 1234,
      scale,
      elevatedPos,
      r, n, f,
      vertices, colors, indices,
      colorEncoder
    );
  }
};

window.ItemRegistry["DRAGON_FRUIT"] = window.ItemRegistry["dragon_fruit"];
