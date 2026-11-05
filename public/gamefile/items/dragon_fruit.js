// === SEEDPLANET MODULE: JS/ITEMS/DRAGON_FRUIT.JS ===

window.ItemRegistry = window.ItemRegistry || {};

window.buildDragonFruitModel = function(
  seed,
  scaleMultiplier,
  offset,
  r, n, f,
  rawVertices, rawColors, rawIndices,
  colorEncoder
) {
  const S = scaleMultiplier || 1.0;
  const ox = offset[0];
  const oy = offset[1];
  const oz = offset[2];

  const encode = typeof colorEncoder === "function" ? colorEncoder : (c) => c;

  // Colors
  const colStem = encode([0.45, 0.55, 0.20]);
  const colBodyDark = encode([0.80, 0.10, 0.38]);
  const colBodyMid = encode([0.92, 0.14, 0.46]);
  const colBodyBright = encode([0.98, 0.20, 0.52]);
  const colScaleBase = encode([0.75, 0.45, 0.25]);
  const colScaleTip = encode([0.32, 0.85, 0.22]);
  const colCrownTip = encode([0.38, 0.88, 0.25]);

  function getPt(lx, ly, lz) {
    return [
      ox + (r[0] * lx + n[0] * ly + f[0] * lz) * S,
      oy + (r[1] * lx + n[1] * ly + f[1] * lz) * S,
      oz + (r[2] * lx + n[2] * ly + f[2] * lz) * S,
    ];
  }

  function addTri(p0, p1, p2, c0, c1, c2) {
    const idx = rawVertices.length / 3;
    rawVertices.push(p0[0], p0[1], p0[2]);
    rawVertices.push(p1[0], p1[1], p1[2]);
    rawVertices.push(p2[0], p2[1], p2[2]);

    rawColors.push(c0[0], c0[1], c0[2]);
    rawColors.push(c1[0], c1[1], c1[2]);
    rawColors.push(c2[0], c2[1], c2[2]);

    rawIndices.push(idx, idx + 1, idx + 2);
  }

  function addQuad(p0, p1, p2, p3, c0, c1, c2, c3) {
    const idx = rawVertices.length / 3;
    rawVertices.push(p0[0], p0[1], p0[2]);
    rawVertices.push(p1[0], p1[1], p1[2]);
    rawVertices.push(p2[0], p2[1], p2[2]);
    rawVertices.push(p3[0], p3[1], p3[2]);

    rawColors.push(c0[0], c0[1], c0[2]);
    rawColors.push(c1[0], c1[1], c1[2]);
    rawColors.push(c2[0], c2[1], c2[2]);
    rawColors.push(c3[0], c3[1], c3[2]);

    rawIndices.push(idx, idx + 1, idx + 2);
    rawIndices.push(idx, idx + 2, idx + 3);
  }

  // 1. Faceted low-poly body rings (6-sided)
  const N_SEGS = 6;
  const rings = [
    { y: -0.16, r: 0.035, col: colStem },       // 0: stem socket
    { y: -0.09, r: 0.09,  col: colBodyDark },   // 1: lower bottom
    { y:  0.01, r: 0.145, col: colBodyMid },    // 2: mid body
    { y:  0.11, r: 0.14,  col: colBodyBright }, // 3: upper mid
    { y:  0.19, r: 0.085, col: colBodyMid },    // 4: neck
    { y:  0.25, r: 0.035, col: colScaleBase },  // 5: crown rim
  ];

  // Compute ring vertices
  const ringPts = [];
  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri];
    const pts = [];
    for (let si = 0; si < N_SEGS; si++) {
      const angle = (si / N_SEGS) * Math.PI * 2 + (ri * 0.15); // subtle twist for organic low-poly feel
      const lx = Math.cos(angle) * ring.r;
      const lz = Math.sin(angle) * ring.r;
      pts.push(getPt(lx, ring.y, lz));
    }
    ringPts.push(pts);
  }

  // Connect rings
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

  // Bottom stem (cylinder)
  const pBottomStem = getPt(0, -0.22, 0);
  for (let si = 0; si < N_SEGS; si++) {
    const nextSi = (si + 1) % N_SEGS;
    addTri(pBottomStem, ringPts[0][nextSi], ringPts[0][si], colStem, colStem, colStem);
  }

  // 2. Dragon Fruit Bracts ("Scales") curving outward and upward
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

      // Tangent for scale width
      const tanX = -sinA * tier.width * 0.5;
      const tanZ = cosA * tier.width * 0.5;

      const basePos = [cosA * baseRing.r, baseRing.y, sinA * baseRing.r];
      const pLeft = getPt(basePos[0] + tanX, basePos[1], basePos[2] + tanZ);
      const pRight = getPt(basePos[0] - tanX, basePos[1], basePos[2] - tanZ);

      // Tip curves outwards and upwards
      const tipPos = [
        cosA * (baseRing.r + tier.outDist),
        baseRing.y + tier.lift,
        sinA * (baseRing.r + tier.outDist)
      ];
      const pTip = getPt(tipPos[0], tipPos[1], tipPos[2]);

      // Both sides of the leafy scale
      addTri(pLeft, pRight, pTip, colScaleBase, colScaleBase, colScaleTip);
      addTri(pRight, pLeft, pTip, colScaleBase, colScaleBase, colScaleTip);
    }
  }

  // 3. Crown leaves at the top (Ring 5 flaring outwards)
  const crownCount = 5;
  for (let ci = 0; ci < crownCount; ci++) {
    const angle = (ci / crownCount) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const tanX = -sinA * 0.025;
    const tanZ = cosA * 0.025;

    const pBaseL = getPt(cosA * 0.035 + tanX, 0.24, sinA * 0.035 + tanZ);
    const pBaseR = getPt(cosA * 0.035 - tanX, 0.24, sinA * 0.035 - tanZ);
    const pCrownTip = getPt(cosA * 0.065, 0.31, sinA * 0.065);

    addTri(pBaseL, pBaseR, pCrownTip, colScaleBase, colScaleBase, colCrownTip);
    addTri(pBaseR, pBaseL, pCrownTip, colScaleBase, colScaleBase, colCrownTip);
  }
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
