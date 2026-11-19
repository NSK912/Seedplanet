// === SEEDPLANET MODULE: JS/ITEMS/ARROW.JS ===

window.ItemRegistry["arrow"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position || [0, 0, 0];
    const f = item.F || [0, 0, 1];
    const s = typeof playerScale !== 'undefined' ? playerScale : 0.1;
    const basis = window.DropTemplateCache.basisFromF(f);

    if (item.ammoType === "IRON_BULLET") {
      window.DropTemplateCache.render(
        "arrow_iron_bullet",
        { position: p, R: basis.R, normal: basis.N, F: basis.F, scale: s, yOff: 0.0 },
        (tv, tc, ti) => {
          const ironColor = [0.78, 0.81, 0.86];
          if (typeof buildLowPolySphere === "function") {
            buildLowPolySphere([0, 0, 0], 0.038, 6, ironColor, 0, 0, tv, tc, ti);
          } else {
            buildTaperedSegment([0, 0, 0], [0, 0, 0.03], 0.02, 0.02, 6, ironColor, tv, tc, ti);
          }
        },
        vertices, colors, indices
      );
      return;
    }

    window.DropTemplateCache.render(
      "arrow_std",
      { position: p, R: basis.R, normal: basis.N, F: basis.F, scale: s, yOff: 0.0 },
      (tv, tc, ti) => {
        const shaftColor = [0.55, 0.4, 0.25];
        const flintColor = [0.35, 0.35, 0.35];
        const featherColor = [0.9, 0.2, 0.2];
        const hL = 0.56;
        const pNock = [0, 0, -hL];
        const pTipBase = [0, 0, hL];
        const pFeatherEnd = [0, 0, -hL + 0.05];
        const pTipEnd = [0, 0, hL + 0.04];
        const th = 0.005;

        buildTaperedSegment(pNock, pTipBase, th, th, 4, shaftColor, tv, tc, ti);
        buildTaperedSegment(pNock, pFeatherEnd, 0.015, 0.006, 4, featherColor, tv, tc, ti);
        buildTaperedSegment(pTipBase, pTipEnd, 0.012, 0.001, 4, flintColor, tv, tc, ti);
      },
      vertices, colors, indices
    );
  }
};
