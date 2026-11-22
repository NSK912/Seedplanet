// === SEEDPLANET MODULE: JS/ITEMS/TOUGH_MEAT.JS ===
// Raw Tough Meat cut (TOUGH_MEAT)

window.ItemRegistry = window.ItemRegistry || {};

// Build a 3D Tough Meat cut model reusing GeorgiacetusPalette & continuous-spine primitives (explicit DropTemplateCache)
window.buildToughMeatModel = function(item, vertices, colors, indices, targetBuffer) {
  const isIcon = (targetBuffer === "preview" || !!(item && item.isIconPreview));
  const p = (item && item.position) ? item.position : [0, 0, 0];
  const r = (item && item.R) ? item.R : [1, 0, 0];
  const n = (item && item.normal) ? item.normal : [0, 1, 0];
  const f = (item && item.F) ? item.F : [0, 0, 1];
  const rawS = (item && typeof item.size === "number") ? item.size : 0.085;
  const s = isIcon ? 1.0 : Math.min(rawS, 0.095);
  const yOff = isIcon ? 0.0 : 0.145;
  const seed = (item && typeof item.seed === "number") ? item.seed : 0;
  const basis = isIcon ? { R: r, F: f } : window.DropTemplateCache.rotateBasis(r, f, (seed * 6.28318) % (Math.PI * 2));

  if (typeof buildContinuousSpine !== "function" || typeof buildLowPolySphere !== "function") return;

  window.DropTemplateCache.render(
    "tough_meat",
    { position: p, R: basis.R, normal: n, F: basis.F, scale: s, yOff: yOff },
    (tv, tc, ti) => {
      const upN = [0, 1, 0];
      const pal = (typeof window !== "undefined" && window.GeorgiacetusPalette) ? window.GeorgiacetusPalette : {
        darkGrey: [0.25, 0.28, 0.32],
        lightGrey: [0.65, 0.68, 0.72],
        bellyColor: [0.75, 0.78, 0.82],
        muscleRed: [0.60, 0.16, 0.18],
        muscleDark: [0.44, 0.11, 0.13],
        sinewCream: [0.88, 0.83, 0.76],
        boneWhite: [0.92, 0.90, 0.85]
      };

      const colRindDark = [
        pal.darkGrey[0] * 0.55 + 0.18,
        pal.darkGrey[1] * 0.35 + 0.04,
        pal.darkGrey[2] * 0.35 + 0.05
      ];
      const colMeatMain = pal.muscleRed || [0.60, 0.16, 0.18];
      const colMeatDeep = pal.muscleDark || [0.44, 0.11, 0.13];
      const colSinew = pal.sinewCream || [0.88, 0.83, 0.76];
      const colBone = pal.boneWhite || [0.92, 0.90, 0.85];

      const meatPts = [
        [-0.22, -0.02, -0.10],
        [-0.10,  0.01, -0.04],
        [ 0.04,  0.02,  0.02],
        [ 0.18,  0.00,  0.08],
        [ 0.26, -0.03,  0.12]
      ];
      const meatRadii = [0.07, 0.125, 0.145, 0.12, 0.06];
      buildContinuousSpine(meatPts, meatRadii, 8, colMeatMain, tv, tc, ti, upN);
      buildLowPolySphere(meatPts[0], meatRadii[0], 2, colMeatDeep, 0, 0, tv, tc, ti);
      buildLowPolySphere(meatPts[4], meatRadii[4], 2, colMeatDeep, 0, 0, tv, tc, ti);

      const rindPts = [
        [-0.19, 0.04, -0.09],
        [-0.04, 0.09, -0.01],
        [ 0.12, 0.08,  0.06],
        [ 0.23, 0.02,  0.11]
      ];
      const rindRadii = [0.05, 0.085, 0.075, 0.045];
      buildContinuousSpine(rindPts, rindRadii, 6, colRindDark, tv, tc, ti, upN);

      if (typeof buildTaperedSegment === "function") {
        buildTaperedSegment([-0.14, 0.07, -0.01], [-0.04, -0.06, 0.09], 0.022, 0.016, 5, colSinew, tv, tc, ti);
        buildTaperedSegment([0.02, 0.09, -0.04], [0.11, -0.05, 0.12], 0.024, 0.016, 5, colSinew, tv, tc, ti);
        buildTaperedSegment([-0.08, 0.05, -0.10], [0.14, 0.05, 0.01], 0.018, 0.014, 5, colSinew, tv, tc, ti);
      }

      const pBoneStart = [-0.16, -0.01, -0.05];
      const pBoneEnd = [-0.29, -0.04, -0.13];
      if (typeof buildTaperedSegment === "function") {
        buildTaperedSegment(pBoneStart, pBoneEnd, 0.042, 0.036, 6, colBone, tv, tc, ti);
      }
      buildLowPolySphere(pBoneEnd, 0.044, 2, colBone, 0, 0, tv, tc, ti);
    },
    vertices, colors, indices
  );
};

window.ItemRegistry["tough_meat"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    window.buildToughMeatModel(item, vertices, colors, indices, targetBuffer);
  }
};
window.ItemRegistry["TOUGH_MEAT"] = window.ItemRegistry["tough_meat"];
