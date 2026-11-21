// === SEEDPLANET MODULE: JS/ITEMS/SHOVEL.JS ===

window.ItemRegistry["shovel"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const isIcon = (targetBuffer === "preview" || (item && item.isIconPreview));
    const s = isIcon
      ? ((typeof item.size === "number") ? item.size : 0.25)
      : ((typeof item.size === "number") ? Math.min(item.size, 0.030) : 0.022);
    const p = item.position || [0, 0, 0];
    const r = item.R || [1, 0, 0];
    const f = item.F || [0, 0, 1];
    const n = item.normal || [0, 1, 0];

    const rotAngle = (item.seed || 0) % (Math.PI * 2);
    const rot = window.DropTemplateCache.rotateBasis(r, f, rotAngle);

    window.DropTemplateCache.render(
      "shovel_v1",
      { position: p, R: rot.R, normal: n, F: rot.F, scale: s, yOff: isIcon ? 0.05 : 0.28 },
      (tv, tc, ti) => {
        const handleColor = [0.4, 0.25, 0.15];
        buildTaperedSegment([-1.2, 0, 0], [0.72, 0, 0], 0.08, 0.08, 5, handleColor, tv, tc, ti);

        buildTaperedSegment([0.72, 0, 0], [0.88, 0, 0], 0.10, 0.10, 5, [0.55, 0.55, 0.55], tv, tc, ti);
        buildTaperedSegment([0.88, 0, 0], [1.52, 0, 0], 0.28, 0.26, 5, [0.65, 0.65, 0.65], tv, tc, ti);
        buildTaperedSegment([1.52, 0, 0], [1.84, 0, 0], 0.26, 0.04, 5, [0.60, 0.60, 0.60], tv, tc, ti);

        const partsColor = [0.25, 0.25, 0.25];
        buildTaperedSegment([-1.2, 0, 0], [-1.4, 0, 0], 0.08, 0.08, 5, partsColor, tv, tc, ti);
        buildTaperedSegment([-1.4, 0, 0], [-1.68, 0, -0.2], 0.06, 0.06, 4, partsColor, tv, tc, ti);
        buildTaperedSegment([-1.4, 0, 0], [-1.68, 0,  0.2], 0.06, 0.06, 4, partsColor, tv, tc, ti);
        buildTaperedSegment([-1.68, 0, -0.2], [-1.68, 0, 0.2], 0.064, 0.064, 5, partsColor, tv, tc, ti);
      },
      vertices, colors, indices
    );
  }
};
window.ItemRegistry["SHOVEL"] = window.ItemRegistry["shovel"];
