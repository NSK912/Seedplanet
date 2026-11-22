// === SEEDPLANET MODULE: JS/ITEMS/BOW.JS ===
// Curved wooden hunting bow (BOW) ground drop & 3D preview renderer

window.ItemRegistry = window.ItemRegistry || {};

window.ItemRegistry["bow"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const isIcon = (targetBuffer === "preview" || (item && item.isIconPreview));
    const p = (item && item.position) ? item.position : [0, 0, 0];
    const r = (item && item.R) ? item.R : [1, 0, 0];
    const n = (item && item.normal) ? item.normal : [0, 1, 0];
    const f = (item && item.F) ? item.F : [0, 0, 1];

    if (isIcon) {
      window.DropTemplateCache.render(
        "bow_icon_v1",
        { position: p, R: r, normal: n, F: f, scale: 1.0, yOff: 0 },
        (tv, tc, ti) => {
          const woodColor = [0.55, 0.38, 0.22];
          const gripColor = [0.36, 0.23, 0.13];
          const stringColor = [0.95, 0.95, 0.95];
          const wGrip = [0, 0, 0];
          const wUpperTip = [0, 0.45, -0.05];
          const wLowerTip = [0, -0.45, -0.05];
          const wNock = [0, 0, -0.22];
          const wUpperMid = [0, 0.225, 0.08];
          const wLowerMid = [0, -0.225, 0.08];
          buildTaperedSegment([0, -0.055, 0.012], [0, 0.055, 0.012], 0.015, 0.015, 5, gripColor, tv, tc, ti);
          buildTaperedSegment(wGrip, wUpperMid, 0.012, 0.009, 5, woodColor, tv, tc, ti);
          buildTaperedSegment(wUpperMid, wUpperTip, 0.009, 0.005, 5, woodColor, tv, tc, ti);
          buildTaperedSegment(wGrip, wLowerMid, 0.012, 0.009, 5, woodColor, tv, tc, ti);
          buildTaperedSegment(wLowerMid, wLowerTip, 0.009, 0.005, 5, woodColor, tv, tc, ti);
          buildTaperedSegment(wUpperTip, wNock, 0.0025, 0.0025, 4, stringColor, tv, tc, ti);
          buildTaperedSegment(wLowerTip, wNock, 0.0025, 0.0025, 4, stringColor, tv, tc, ti);
        },
        vertices, colors, indices
      );
      return;
    }

    const s = (item && typeof item.size === "number") ? Math.min(item.size, 0.10) : 0.085;
    const rotAngle = (item && typeof item.seed === "number") ? (item.seed % (Math.PI * 2)) : 0;
    const rot = window.DropTemplateCache.rotateBasis(r, f, rotAngle);

    window.DropTemplateCache.render(
      "bow_drop_v1",
      { position: p, R: rot.R, normal: n, F: rot.F, scale: s, yOff: 0.032 },
      (tv, tc, ti) => {
        const woodColor = [0.55, 0.38, 0.22];
        const gripColor = [0.36, 0.23, 0.13];
        const stringColor = [0.95, 0.95, 0.95];
        // Flat bow resting in X-Z ground plane, centered around origin
        const grip = [0, 0, 0.06];
        const upperMid = [0.23, 0, 0.14];
        const lowerMid = [-0.23, 0, 0.14];
        const upperTip = [0.45, 0, -0.06];
        const lowerTip = [-0.45, 0, -0.06];

        buildTaperedSegment([-0.06, 0, 0.065], [0.06, 0, 0.065], 0.024, 0.024, 5, gripColor, tv, tc, ti);
        buildTaperedSegment(grip, upperMid, 0.020, 0.015, 5, woodColor, tv, tc, ti);
        buildTaperedSegment(upperMid, upperTip, 0.015, 0.009, 5, woodColor, tv, tc, ti);
        buildTaperedSegment(grip, lowerMid, 0.020, 0.015, 5, woodColor, tv, tc, ti);
        buildTaperedSegment(lowerMid, lowerTip, 0.015, 0.009, 5, woodColor, tv, tc, ti);
        buildTaperedSegment(upperTip, lowerTip, 0.005, 0.005, 4, stringColor, tv, tc, ti);
      },
      vertices, colors, indices
    );
  }
};
window.ItemRegistry["BOW"] = window.ItemRegistry["bow"];
