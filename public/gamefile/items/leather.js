// === SEEDPLANET MODULE: JS/ITEMS/LEATHER.JS ===
// Stretched hide / Leather (LEATHER / HIDE)

window.ItemRegistry = window.ItemRegistry || {};

// Build a 3D stretched whale-hide Leather sheet model (explicit DropTemplateCache)
window.buildLeatherModel = function(item, vertices, colors, indices, targetBuffer) {
  const isIcon = (targetBuffer === "preview" || !!(item && item.isIconPreview));
  const p = (item && item.position) ? item.position : [0, 0, 0];
  const r = (item && item.R) ? item.R : [1, 0, 0];
  const n = (item && item.normal) ? item.normal : [0, 1, 0];
  const f = (item && item.F) ? item.F : [0, 0, 1];
  const rawS = (item && typeof item.size === "number") ? item.size : 0.085;
  const s = isIcon ? 1.0 : Math.min(rawS, 0.095);
  const yOff = isIcon ? 0.0 : 0.032;
  const seed = (item && typeof item.seed === "number") ? item.seed : 0;
  const basis = isIcon ? { R: r, F: f } : window.DropTemplateCache.rotateBasis(r, f, (seed * 6.28318) % (Math.PI * 2));

  window.DropTemplateCache.render(
    "leather",
    { position: p, R: basis.R, normal: n, F: basis.F, scale: s, yOff: yOff },
    (tv, tc, ti) => {
      const pal = (typeof window !== "undefined" && window.GeorgiacetusPalette) ? window.GeorgiacetusPalette : {
        darkGrey: [0.25, 0.28, 0.32],
        lightGrey: [0.65, 0.68, 0.72],
        bellyColor: [0.75, 0.78, 0.82]
      };
      const colOuter = pal.darkGrey;
      const colFlank = pal.lightGrey;
      const colTrim  = pal.bellyColor;
      const colBack  = [0.46, 0.44, 0.42];

      const addOrientedQuad = (a, b, c, d, col, outDir) => {
        const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2];
        const vx = b[0] - a[0], vy = b[1] - a[1], vz = b[2] - a[2];
        const qnx = uy * vz - uz * vy;
        const qny = uz * vx - ux * vz;
        const qnz = ux * vy - uy * vx;
        const dot = qnx * outDir[0] + qny * outDir[1] + qnz * outDir[2];
        const i0 = tv.length / 3;
        tv.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
        for (let k = 0; k < 4; k++) tc.push(col[0], col[1], col[2]);
        if (dot >= 0) {
          ti.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
        } else {
          ti.push(i0, i0 + 3, i0 + 2, i0, i0 + 2, i0 + 1);
        }
      };

      const th = 0.022;
      const xs = [-0.26, -0.09, 0.09, 0.26];
      const zs = [-0.22, -0.07, 0.07, 0.22];
      const getH = (ix, iz) => {
        const cornerFlare = ((ix === 0 || ix === 3) && (iz === 0 || iz === 3)) ? 0.024 : 0.0;
        const arch = (ix === 1 || ix === 2) && (iz === 1 || iz === 2) ? 0.018 : 0.0;
        return cornerFlare + arch;
      };
      const getWarpX = (ix, iz) => {
        const x = xs[ix];
        if ((ix === 0 || ix === 3) && (iz === 0 || iz === 3)) return x * 1.18;
        if ((ix === 0 || ix === 3) && (iz === 1 || iz === 2)) return x * 0.78;
        return x;
      };
      const getWarpZ = (ix, iz) => {
        const z = zs[iz];
        if ((ix === 0 || ix === 3) && (iz === 0 || iz === 3)) return z * 1.18;
        if ((iz === 0 || iz === 3) && (ix === 1 || ix === 2)) return z * 0.76;
        return z;
      };

      for (let ix = 0; ix < 3; ix++) {
        for (let iz = 0; iz < 3; iz++) {
          const p00 = [getWarpX(ix, iz),     getH(ix, iz),     getWarpZ(ix, iz)];
          const p10 = [getWarpX(ix + 1, iz), getH(ix + 1, iz), getWarpZ(ix + 1, iz)];
          const p11 = [getWarpX(ix + 1, iz + 1), getH(ix + 1, iz + 1), getWarpZ(ix + 1, iz + 1)];
          const p01 = [getWarpX(ix, iz + 1), getH(ix, iz + 1), getWarpZ(ix, iz + 1)];

          const b00 = [p00[0], p00[1] - th, p00[2]];
          const b10 = [p10[0], p10[1] - th, p10[2]];
          const b11 = [p11[0], p11[1] - th, p11[2]];
          const b01 = [p01[0], p01[1] - th, p01[2]];

          const isCenterSpine = (ix === 1);
          const isCornerTab = (ix !== 1 && iz !== 1);
          const topCol = isCenterSpine ? colOuter : (isCornerTab ? colTrim : colFlank);

          addOrientedQuad(p00, p10, p11, p01, topCol, [0, 1, 0]);
          addOrientedQuad(b00, b01, b11, b10, colBack, [0, -1, 0]);
          if (ix === 0) addOrientedQuad(p00, p01, b01, b00, colOuter, [-1, 0, 0]);
          if (ix === 2) addOrientedQuad(p11, p10, b10, b11, colOuter, [1, 0, 0]);
          if (iz === 0) addOrientedQuad(p10, p00, b00, b10, colOuter, [0, 0, -1]);
          if (iz === 2) addOrientedQuad(p01, p11, b11, b01, colOuter, [0, 0, 1]);
        }
      }

      if (typeof buildContinuousSpine === "function") {
        const ridgePts = [[0, 0.025, -0.14], [0, 0.032, 0], [0, 0.025, 0.14]];
        buildContinuousSpine(ridgePts, [0.018, 0.024, 0.018], 5, colOuter, tv, tc, ti, [0, 1, 0]);
      }
    },
    vertices, colors, indices
  );
};

window.ItemRegistry["leather"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    window.buildLeatherModel(item, vertices, colors, indices, targetBuffer);
  }
};
window.ItemRegistry["LEATHER"] = window.ItemRegistry["leather"];
window.ItemRegistry["hide"] = window.ItemRegistry["leather"];
window.ItemRegistry["HIDE"] = window.ItemRegistry["leather"];
