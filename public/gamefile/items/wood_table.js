// === SEEDPLANET MODULE: JS/ITEMS/WOOD_TABLE.JS ===
// Wooden Table (โต๊ะไม้) - Low-Poly Design
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

  window.ItemRegistry["wood_table"] = {
    render: function(item, vertices, colors, indices, targetBuffer) {
      const boxFunc = (typeof window !== "undefined" && typeof window.addBox === "function" && window.addBox !== drawBoxFallback)
        ? window.addBox
        : (typeof addBox === "function" ? addBox : drawBoxFallback);

      const p = item.position || [0, 0, 0];
      const r = item.R || [1, 0, 0];
      const f = item.F || [0, 0, 1];
      const n = item.normal || [0, 1, 0];
      const isPreview = item.isPreview;
      const isValid = item.isValidPlacement !== false;
      const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];

      const s = 0.46; // Consistent furniture scale factor matching wood_bed / wood_chest

      // Low-poly warm wood palette
      const woodTopColor = isPreview ? previewColor : [0.56, 0.38, 0.21];
      const woodPlankLight = isPreview ? previewColor : [0.61, 0.42, 0.24];
      const woodFrameColor = isPreview ? previewColor : [0.46, 0.30, 0.16];
      const woodLegColor = isPreview ? previewColor : [0.38, 0.24, 0.12];

      // 1) 4 Wooden Table Legs (ขาโต๊ะไม้ทั้ง 4 มุม)
      const legOffsets = [
        [-0.105 * s, 0.062 * s, -0.075 * s],
        [ 0.105 * s, 0.062 * s, -0.075 * s],
        [-0.105 * s, 0.062 * s,  0.075 * s],
        [ 0.105 * s, 0.062 * s,  0.075 * s]
      ];
      for (let i = 0; i < 4; i++) {
        const lo = legOffsets[i];
        const legCenter = [
          p[0] + r[0] * lo[0] + n[0] * lo[1] + f[0] * lo[2],
          p[1] + r[1] * lo[0] + n[1] * lo[1] + f[1] * lo[2],
          p[2] + r[2] * lo[0] + n[2] * lo[1] + f[2] * lo[2]
        ];
        boxFunc(legCenter, 0.028 * s, 0.124 * s, 0.028 * s, woodLegColor, r, n, f, vertices, colors, indices);
      }

      // 2) Under-table Support Apron / Frame (คานรับใต้หน้าโต๊ะ)
      const apronPos = [
        p[0] + n[0] * (0.114 * s),
        p[1] + n[1] * (0.114 * s),
        p[2] + n[2] * (0.114 * s)
      ];
      boxFunc(apronPos, 0.23 * s, 0.022 * s, 0.17 * s, woodFrameColor, r, n, f, vertices, colors, indices);

      // 3) Side Stretcher Bars between legs (คานยึดขาโต๊ะซ้าย-ขวา)
      const leftBarPos = [
        p[0] - r[0] * (0.105 * s) + n[0] * (0.036 * s),
        p[1] - r[1] * (0.105 * s) + n[1] * (0.036 * s),
        p[2] - r[2] * (0.105 * s) + n[2] * (0.036 * s)
      ];
      boxFunc(leftBarPos, 0.020 * s, 0.018 * s, 0.13 * s, woodFrameColor, r, n, f, vertices, colors, indices);

      const rightBarPos = [
        p[0] + r[0] * (0.105 * s) + n[0] * (0.036 * s),
        p[1] + r[1] * (0.105 * s) + n[1] * (0.036 * s),
        p[2] + r[2] * (0.105 * s) + n[2] * (0.036 * s)
      ];
      boxFunc(rightBarPos, 0.020 * s, 0.018 * s, 0.13 * s, woodFrameColor, r, n, f, vertices, colors, indices);

      // 4) Low-Poly Planked Tabletop (แผ่นหน้าโต๊ะไม้ 3 แผ่นเรียงกัน)
      const plankDepth = 0.064 * s;
      const plankOffsetsZ = [-0.068 * s, 0.0, 0.068 * s];
      const plankColors = [woodTopColor, woodPlankLight, woodTopColor];
      for (let i = 0; i < 3; i++) {
        const pz = plankOffsetsZ[i];
        const plankPos = [
          p[0] + n[0] * (0.134 * s) + f[0] * pz,
          p[1] + n[1] * (0.134 * s) + f[1] * pz,
          p[2] + n[2] * (0.134 * s) + f[2] * pz
        ];
        boxFunc(plankPos, 0.26 * s, 0.022 * s, plankDepth, plankColors[i], r, n, f, vertices, colors, indices);
      }
    }
  };

  window.ItemRegistry["WOOD_TABLE"] = window.ItemRegistry["wood_table"];
})();
