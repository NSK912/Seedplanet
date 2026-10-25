// === SEEDPLANET MODULE: JS/ITEMS/WOOD_BED.JS ===
// Wooden Bed with Soft Cotton Mattress (เตียงไม้พร้อมฟูก)
// Crafted from Cotton Plant (50) and Wood Logs (3)

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

  window.ItemRegistry["wood_bed"] = {
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

      const s = 0.46; // Scale factor sized so bed fits cleanly inside 0.30 wood_floor rooms without wall clipping

      // Colors
      const woodColor = isPreview ? previewColor : [0.46, 0.30, 0.16];
      const woodDarkColor = isPreview ? previewColor : [0.38, 0.24, 0.12];
      const woodHeadColor = isPreview ? previewColor : [0.50, 0.34, 0.18];
      const mattressColor = isPreview ? previewColor : [0.96, 0.95, 0.91];
      const pillowColor = isPreview ? previewColor : [0.99, 0.99, 0.98];
      const blanketColor = isPreview ? previewColor : [0.44, 0.56, 0.68];

      // 1) 4 Wooden Legs (ขาเตียงไม้ทั้ง 4 มุม)
      const legPositions = [
        [-0.13 * s, 0.04 * s, -0.23 * s],
        [ 0.13 * s, 0.04 * s, -0.23 * s],
        [-0.13 * s, 0.04 * s,  0.23 * s],
        [ 0.13 * s, 0.04 * s,  0.23 * s]
      ];
      for (let i = 0; i < 4; i++) {
        const lp = legPositions[i];
        const legCenter = [
          p[0] + r[0] * lp[0] + n[0] * lp[1] + f[0] * lp[2],
          p[1] + r[1] * lp[0] + n[1] * lp[1] + f[1] * lp[2],
          p[2] + r[2] * lp[0] + n[2] * lp[1] + f[2] * lp[2]
        ];
        boxFunc(legCenter, 0.038 * s, 0.08 * s, 0.038 * s, woodDarkColor, r, n, f, vertices, colors, indices);
      }

      // 2) Bedframe Base Platform (ฐานโครงเตียงไม้)
      const basePos = [
        p[0] + n[0] * (0.08 * s),
        p[1] + n[1] * (0.08 * s),
        p[2] + n[2] * (0.08 * s)
      ];
      boxFunc(basePos, 0.30 * s, 0.04 * s, 0.52 * s, woodColor, r, n, f, vertices, colors, indices);

      // 3) Headboard (หัวเตียงไม้บานสูง)
      const headPos = [
        p[0] + n[0] * (0.17 * s) - f[0] * (0.245 * s),
        p[1] + n[1] * (0.17 * s) - f[1] * (0.245 * s),
        p[2] + n[2] * (0.17 * s) - f[2] * (0.245 * s)
      ];
      boxFunc(headPos, 0.32 * s, 0.20 * s, 0.032 * s, woodHeadColor, r, n, f, vertices, colors, indices);

      // 4) Footboard (ปลายเตียงไม้บานเตี้ย)
      const footPos = [
        p[0] + n[0] * (0.12 * s) + f[0] * (0.245 * s),
        p[1] + n[1] * (0.12 * s) + f[1] * (0.245 * s),
        p[2] + n[2] * (0.12 * s) + f[2] * (0.245 * s)
      ];
      boxFunc(footPos, 0.32 * s, 0.10 * s, 0.032 * s, woodHeadColor, r, n, f, vertices, colors, indices);

      // 5) Soft Cotton Mattress (ฟูกที่นอนหนานุ่มจากฝ้ายแท้)
      const mattressPos = [
        p[0] + n[0] * (0.13 * s),
        p[1] + n[1] * (0.13 * s),
        p[2] + n[2] * (0.13 * s)
      ];
      boxFunc(mattressPos, 0.27 * s, 0.075 * s, 0.46 * s, mattressColor, r, n, f, vertices, colors, indices);

      // 6) Soft Cotton Pillow (หมอนหนุนฝ้ายขาวนุ่ม)
      const pillowPos = [
        p[0] + n[0] * (0.185 * s) - f[0] * (0.16 * s),
        p[1] + n[1] * (0.185 * s) - f[1] * (0.16 * s),
        p[2] + n[2] * (0.185 * s) - f[2] * (0.16 * s)
      ];
      boxFunc(pillowPos, 0.21 * s, 0.04 * s, 0.11 * s, pillowColor, r, n, f, vertices, colors, indices);

      // 7) Cotton Quilt / Blanket (ผ้าห่มฝ้ายคลุมปลายเตียง)
      const blanketPos = [
        p[0] + n[0] * (0.17 * s) + f[0] * (0.05 * s),
        p[1] + n[1] * (0.17 * s) + f[1] * (0.05 * s),
        p[2] + n[2] * (0.17 * s) + f[2] * (0.05 * s)
      ];
      boxFunc(blanketPos, 0.276 * s, 0.02 * s, 0.32 * s, blanketColor, r, n, f, vertices, colors, indices);
    }
  };

  window.ItemRegistry["WOOD_BED"] = window.ItemRegistry["wood_bed"];
})();
