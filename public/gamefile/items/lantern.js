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

  window.ItemRegistry["lantern"] = {
    render: function(item, vertices, colors, indices, targetBuffer) {
      const boxFunc = (typeof window !== "undefined" && typeof window.addBox === "function" && window.addBox !== drawBoxFallback)
        ? window.addBox
        : (typeof addBox === "function" ? addBox : drawBoxFallback);

      const p = item.position || [0, 0, 0];
      const r = item.R || [1, 0, 0];
      const f = item.F || [0, 0, 1];
      const n = item.normal || [0, 1, 0];
      const isPreview = item.isPreview && !item.isIconPreview;
      const isValid = item.isValidPlacement !== false;
      const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];

      const s = 0.46; // Consistent furniture scale factor matching wood_table / wood_chair

      // Low-poly iron & glowing ore palette
      const ironDark = isPreview ? previewColor : [0.24, 0.26, 0.30];
      const ironMid = isPreview ? previewColor : [0.35, 0.38, 0.43];
      const ironLight = isPreview ? previewColor : [0.46, 0.49, 0.54];
      // Exact shader-recognized Glowing Ore emissive color [0.22, 0.95, 0.88]
      const glowCoreColor = isPreview ? previewColor : [0.22, 0.95, 0.88];

      const offsetPos = (ox, oy, oz) => [
        p[0] + r[0] * ox + n[0] * oy + f[0] * oz,
        p[1] + r[1] * ox + n[1] * oy + f[1] * oz,
        p[2] + r[2] * ox + n[2] * oy + f[2] * oz
      ];

      // 1) Stepped Iron Base (ฐานเหล็กตะเกียง 2 ชั้น)
      boxFunc(offsetPos(0, 0.006 * s, 0), 0.072 * s, 0.012 * s, 0.072 * s, ironDark, r, n, f, vertices, colors, indices);
      boxFunc(offsetPos(0, 0.016 * s, 0), 0.056 * s, 0.010 * s, 0.056 * s, ironMid, r, n, f, vertices, colors, indices);

      // 2) Faceted Glowing Ore Crystal Core (ผลึกแร่หินเรืองแสงใจกลางตะเกียง)
      boxFunc(offsetPos(0, 0.049 * s, 0), 0.038 * s, 0.056 * s, 0.038 * s, glowCoreColor, r, n, f, vertices, colors, indices);

      // 45-degree rotated inner crystal facet for low-poly octagonal lantern glow
      const invSqrt2 = 0.70710678;
      const r45 = [
        (r[0] + f[0]) * invSqrt2,
        (r[1] + f[1]) * invSqrt2,
        (r[2] + f[2]) * invSqrt2
      ];
      const f45 = [
        (f[0] - r[0]) * invSqrt2,
        (f[1] - r[1]) * invSqrt2,
        (f[2] - r[2]) * invSqrt2
      ];
      boxFunc(offsetPos(0, 0.049 * s, 0), 0.036 * s, 0.052 * s, 0.036 * s, glowCoreColor, r45, n, f45, vertices, colors, indices);

      // 3) 4 Iron Corner Cage Bars (เสาโครงเหล็ก 4 มุม)
      const pillarOffsets = [
        [-0.023 * s, 0.049 * s, -0.023 * s],
        [ 0.023 * s, 0.049 * s, -0.023 * s],
        [-0.023 * s, 0.049 * s,  0.023 * s],
        [ 0.023 * s, 0.049 * s,  0.023 * s]
      ];
      for (let i = 0; i < 4; i++) {
        const po = pillarOffsets[i];
        boxFunc(offsetPos(po[0], po[1], po[2]), 0.008 * s, 0.058 * s, 0.008 * s, ironMid, r, n, f, vertices, colors, indices);
      }

      // 4) Stepped Low-Poly Iron Hood / Cap (ฝาครอบตะเกียงเหล็กด้านบน)
      boxFunc(offsetPos(0, 0.081 * s, 0), 0.068 * s, 0.010 * s, 0.068 * s, ironMid, r, n, f, vertices, colors, indices);
      boxFunc(offsetPos(0, 0.091 * s, 0), 0.048 * s, 0.012 * s, 0.048 * s, ironLight, r, n, f, vertices, colors, indices);
      boxFunc(offsetPos(0, 0.101 * s, 0), 0.026 * s, 0.010 * s, 0.026 * s, ironDark, r, n, f, vertices, colors, indices);

      // 5) Top Iron Handle Loop (หูหิ้วตะเกียงด้านบน)
      boxFunc(offsetPos(-0.014 * s, 0.112 * s, 0), 0.006 * s, 0.014 * s, 0.006 * s, ironDark, r, n, f, vertices, colors, indices);
      boxFunc(offsetPos( 0.014 * s, 0.112 * s, 0), 0.006 * s, 0.014 * s, 0.006 * s, ironDark, r, n, f, vertices, colors, indices);
      boxFunc(offsetPos(0, 0.120 * s, 0), 0.034 * s, 0.006 * s, 0.006 * s, ironLight, r, n, f, vertices, colors, indices);
    }
  };

  window.ItemRegistry["LANTERN"] = window.ItemRegistry["lantern"];
})();
