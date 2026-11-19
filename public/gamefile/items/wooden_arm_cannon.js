// === SEEDPLANET MODULE: JS/ITEMS/WOODEN_ARM_CANNON.JS ===

window.ItemRegistry = window.ItemRegistry || {};

window.ItemRegistry["wooden_arm_cannon"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = (item && item.position) ? item.position : [0, 0, 0];
    const f = (item && item.F) ? item.F : [0, 0, 1];
    const r = (item && item.R) ? item.R : [1, 0, 0];
    const n = (item && item.normal) ? item.normal : [0, 1, 0];
    const s = (typeof playerScale !== 'undefined' ? playerScale : 0.1) * 1.2;

    window.DropTemplateCache.render(
      "wooden_arm_cannon_v1",
      { position: p, R: r, normal: n, F: f, scale: s, yOff: 0 },
      (tv, tc, ti) => {
        const woodColor = [0.55, 0.38, 0.22];
        const woodDark = [0.42, 0.28, 0.15];
        const ironColor = [0.28, 0.28, 0.30];
        const boreColor = [0.10, 0.10, 0.10];

        const length = 0.24;
        const pRear = [0, 0.04, -(length * 0.45)];
        const pMid = [0, 0.04, 0];
        const pMuzzle = [0, 0.04, length * 0.55];

        buildTaperedSegment(pRear, pMid, 0.042, 0.038, 6, woodColor, tv, tc, ti);
        buildTaperedSegment(pMid, pMuzzle, 0.038, 0.040, 6, woodDark, tv, tc, ti);

        const pRearBand = [0, 0.04, pRear[2] + 0.02];
        buildTaperedSegment(pRear, pRearBand, 0.045, 0.045, 6, ironColor, tv, tc, ti);

        const pMidBand1 = [0, 0.04, -0.012];
        const pMidBand2 = [0, 0.04, 0.012];
        buildTaperedSegment(pMidBand1, pMidBand2, 0.041, 0.041, 6, ironColor, tv, tc, ti);

        const pMuzzleRing = [0, 0.04, pMuzzle[2] - 0.015];
        buildTaperedSegment(pMuzzleRing, pMuzzle, 0.043, 0.043, 6, ironColor, tv, tc, ti);

        const pBoreIn = [0, 0.04, pMuzzle[2] - 0.04];
        buildTaperedSegment(pBoreIn, pMuzzle, 0.024, 0.026, 6, boreColor, tv, tc, ti);
      },
      vertices, colors, indices
    );
  }
};
