// === SEEDPLANET MODULE: JS/ITEMS/WOODEN_ARM_CANNON.JS ===

window.ItemRegistry = window.ItemRegistry || {};

window.ItemRegistry["wooden_arm_cannon"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const isIcon = (targetBuffer === "preview" || (item && item.isIconPreview));
    const p = (item && item.position) ? item.position : [0, 0, 0];
    const f = (item && item.F) ? item.F : [0, 0, 1];
    const r = (item && item.R) ? item.R : [1, 0, 0];
    const n = (item && item.normal) ? item.normal : [0, 1, 0];
    const s = isIcon
      ? ((typeof playerScale !== 'undefined' ? playerScale : 0.1) * 1.2)
      : ((item && typeof item.size === "number") ? Math.min(Math.max(item.size, 0.16), 0.30) : 0.24);
    const basis = isIcon
      ? { R: r, F: f }
      : window.DropTemplateCache.rotateBasis(r, f, (item && typeof item.seed === "number") ? (item.seed % (Math.PI * 2)) : 0);

    window.DropTemplateCache.render(
      "wooden_arm_cannon_v2",
      { position: p, R: basis.R, normal: n, F: basis.F, scale: s, yOff: isIcon ? 0 : 0.050 },
      (tv, tc, ti) => {
        const woodColor = [0.55, 0.38, 0.22];
        const woodDark = [0.42, 0.28, 0.15];
        const ironColor = [0.28, 0.28, 0.30];
        const darkMuzzleColor = [0.22, 0.22, 0.24];
        const boreColor = [0.09, 0.09, 0.10];

        const length = 0.24;
        const pRear = [0, 0, -(length * 0.45)];
        const pMid = [0, 0, 0];
        const pMuzzle = [0, 0, length * 0.55];

        // 1. Solid capped main wooden housing & flared front barrel (inset 0.002 inside iron end caps to avoid Z-fighting)
        const pRearWood = [0, 0, pRear[2] + 0.002];
        const pMuzzleWood = [0, 0, pMuzzle[2] - 0.002];
        buildTaperedSegment(pRearWood, pMid, 0.042, 0.039, 8, woodColor, tv, tc, ti, true);
        buildTaperedSegment(pMid, pMuzzleWood, 0.039, 0.043, 8, woodDark, tv, tc, ti, true);

        // 2. Solid capped iron reinforcement bands (rear, mid clamp, front muzzle collar)
        const pRearBand = [0, 0, pRear[2] + 0.020];
        buildTaperedSegment(pRear, pRearBand, 0.046, 0.045, 8, ironColor, tv, tc, ti, true);

        const pMidBand1 = [0, 0, -0.011];
        const pMidBand2 = [0, 0, 0.011];
        buildTaperedSegment(pMidBand1, pMidBand2, 0.042, 0.042, 8, ironColor, tv, tc, ti, true);

        const pMuzzleRing = [0, 0, pMuzzle[2] - 0.018];
        buildTaperedSegment(pMuzzleRing, pMuzzle, 0.046, 0.046, 8, darkMuzzleColor, tv, tc, ti, true);

        // 3. Capped dark front bore & rear forearm-socket openings (offset +0.002 to avoid Z-fighting)
        const pBoreIn = [0, 0, pMuzzle[2] - 0.032];
        const pBoreOut = [0, 0, pMuzzle[2] + 0.002];
        buildTaperedSegment(pBoreIn, pBoreOut, 0.026, 0.027, 8, boreColor, tv, tc, ti, true);

        const pRearSocketOut = [0, 0, pRear[2] - 0.002];
        const pRearSocketIn = [0, 0, pRear[2] + 0.028];
        buildTaperedSegment(pRearSocketOut, pRearSocketIn, 0.029, 0.028, 8, boreColor, tv, tc, ti, true);
      },
      vertices, colors, indices
    );
  }
};
window.ItemRegistry["WOODEN_ARM_CANNON"] = window.ItemRegistry["wooden_arm_cannon"];
window.ItemRegistry["arm_cannon"] = window.ItemRegistry["wooden_arm_cannon"];
window.ItemRegistry["ARM_CANNON"] = window.ItemRegistry["wooden_arm_cannon"];
