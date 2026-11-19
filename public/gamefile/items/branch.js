// === SEEDPLANET MODULE: JS/ITEMS/BRANCH.JS ===

window.ItemRegistry["branch"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const bColor = item.color || [0.50, 0.30, 0.15];
    const p = item.position || [0, 0, 0];
    const r = item.R || [1, 0, 0];
    const f = item.F || [0, 0, 1];
    const n = item.normal || [0, 1, 0];
    const s = (typeof item.size === "number") ? item.size : 0.025;

    const rotAngle = (item.seed || 0) % (Math.PI * 2);
    const rot = window.DropTemplateCache.rotateBasis(r, f, rotAngle);
    const key = `branch_${window.DropTemplateCache.quantizeColor(bColor)}`;

    window.DropTemplateCache.render(
      key,
      { position: p, R: rot.R, normal: n, F: rot.F, scale: s, yOff: 0.072 },
      (tv, tc, ti) => {
        buildTaperedSegment(
          [-0.8, 0, 0],
          [ 0.8, 0, 0],
          0.12,
          0.06,
          5,
          bColor,
          tv,
          tc,
          ti
        );
      },
      vertices, colors, indices
    );
  }
};
