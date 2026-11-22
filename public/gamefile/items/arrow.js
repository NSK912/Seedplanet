// === SEEDPLANET MODULE: JS/ITEMS/ARROW.JS ===

window.ItemRegistry["arrow"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const isIcon = (targetBuffer === "preview" || (item && item.isIconPreview));
    const isGroundDrop = !isIcon && !!(item && item.isGroundDrop);
    const p = item.position || [0, 0, 0];
    const f = item.F || [0, 0, 1];
    const s = isGroundDrop
      ? ((typeof item.size === "number") ? Math.min(item.size, 0.060) : 0.050)
      : (typeof playerScale !== 'undefined' ? playerScale : 0.1);

    let renderR, renderN, renderF, yOff;
    if (isGroundDrop) {
      const r = item.R || [1, 0, 0];
      const n = item.normal || [0, 1, 0];
      const rot = window.DropTemplateCache.rotateBasis(r, f, (item.seed || 0) % (Math.PI * 2));
      renderR = rot.R;
      renderN = n;
      renderF = rot.F;
      yOff = 0.035;
    } else {
      const basis = window.DropTemplateCache.basisFromF(f);
      renderR = basis.R;
      renderN = basis.N;
      renderF = basis.F;
      yOff = 0.0;
    }

    if (item.ammoType === "IRON_BULLET") {
      window.DropTemplateCache.render(
        "arrow_iron_bullet",
        { position: p, R: renderR, normal: renderN, F: renderF, scale: s, yOff: yOff },
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
      { position: p, R: renderR, normal: renderN, F: renderF, scale: s, yOff: yOff },
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
window.ItemRegistry["ARROW"] = window.ItemRegistry["arrow"];
