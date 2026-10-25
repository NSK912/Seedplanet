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
    if (r && u && f) {
      const det = (r[1]*u[2] - r[2]*u[1])*f[0] + (r[2]*u[0] - r[0]*u[2])*f[1] + (r[0]*u[1] - r[1]*u[0])*f[2];
      if (det < 0) {
        r = [-r[0], -r[1], -r[2]];
      }
    }
    const cubeVerts = [
      [-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd],
      [-hw, hh, -hd], [hw, hh, -hd], [hw, hh, hd], [-hw, hh, hd]
    ];
    const cubeIndices = [
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

  window.ItemRegistry["wood_chair"] = {
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

      const s = 0.46; // Consistent furniture scale factor matching wood_table / wood_bed / wood_chest

      // Low-poly warm wood palette
      const woodSeatColor = isPreview ? previewColor : [0.58, 0.40, 0.22];
      const woodBackColor = isPreview ? previewColor : [0.52, 0.35, 0.19];
      const woodFrameColor = isPreview ? previewColor : [0.45, 0.29, 0.15];
      const woodLegColor = isPreview ? previewColor : [0.38, 0.24, 0.12];

      // 1) 4 Wooden Chair Legs (ขาเก้าอี้ทั้ง 4 มุม)
      const legOffsets = [
        [-0.052 * s, 0.042 * s, -0.052 * s],
        [ 0.052 * s, 0.042 * s, -0.052 * s],
        [-0.052 * s, 0.042 * s,  0.052 * s],
        [ 0.052 * s, 0.042 * s,  0.052 * s]
      ];
      for (let i = 0; i < 4; i++) {
        const lo = legOffsets[i];
        const legCenter = [
          p[0] + r[0] * lo[0] + n[0] * lo[1] + f[0] * lo[2],
          p[1] + r[1] * lo[0] + n[1] * lo[1] + f[1] * lo[2],
          p[2] + r[2] * lo[0] + n[2] * lo[1] + f[2] * lo[2]
        ];
        boxFunc(legCenter, 0.022 * s, 0.084 * s, 0.022 * s, woodLegColor, r, n, f, vertices, colors, indices);
      }

      // 2) Seat Support Frame (คานรับใต้เบาะนั่ง)
      const framePos = [
        p[0] + n[0] * (0.076 * s),
        p[1] + n[1] * (0.076 * s),
        p[2] + n[2] * (0.076 * s)
      ];
      boxFunc(framePos, 0.118 * s, 0.016 * s, 0.118 * s, woodFrameColor, r, n, f, vertices, colors, indices);

      // 3) Wooden Seat Plank (แผ่นรองนั่งเก้าอี้ไม้)
      const seatPos = [
        p[0] + n[0] * (0.092 * s),
        p[1] + n[1] * (0.092 * s),
        p[2] + n[2] * (0.092 * s)
      ];
      boxFunc(seatPos, 0.135 * s, 0.020 * s, 0.135 * s, woodSeatColor, r, n, f, vertices, colors, indices);

      // 4) Backrest Left & Right Vertical Posts (เสาพนักพิงหลังซ้าย-ขวา)
      const postOffsetsX = [-0.052 * s, 0.052 * s];
      for (let i = 0; i < 2; i++) {
        const px = postOffsetsX[i];
        const postPos = [
          p[0] + r[0] * px + n[0] * (0.155 * s) - f[0] * (0.054 * s),
          p[1] + r[1] * px + n[1] * (0.155 * s) - f[1] * (0.054 * s),
          p[2] + r[2] * px + n[2] * (0.155 * s) - f[2] * (0.054 * s)
        ];
        boxFunc(postPos, 0.022 * s, 0.115 * s, 0.022 * s, woodLegColor, r, n, f, vertices, colors, indices);
      }

      // 5) Backrest Horizontal Slats (แผ่นไม้พนักพิงหลัง 2 ชั้น)
      const slatHeights = [0.138 * s, 0.186 * s];
      for (let i = 0; i < 2; i++) {
        const sy = slatHeights[i];
        const slatPos = [
          p[0] + n[0] * sy - f[0] * (0.054 * s),
          p[1] + n[1] * sy - f[1] * (0.054 * s),
          p[2] + n[2] * sy - f[2] * (0.054 * s)
        ];
        boxFunc(slatPos, 0.128 * s, 0.028 * s, 0.018 * s, woodBackColor, r, n, f, vertices, colors, indices);
      }
    }
  };

  window.ItemRegistry["WOOD_CHAIR"] = window.ItemRegistry["wood_chair"];
})();
