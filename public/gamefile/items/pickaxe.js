// === SEEDPLANET MODULE: JS/ITEMS/PICKAXE.JS ===

window.ItemRegistry["pickaxe"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const isIcon = (targetBuffer === "preview" || (item && item.isIconPreview));
    const s = isIcon
      ? ((typeof item.size === "number") ? item.size : 0.5)
      : ((typeof item.size === "number") ? Math.min(item.size, 0.055) : 0.042);
    const p = item.position || [0, 0, 0];
    const r = item.R || [1, 0, 0];
    const f = item.F || [0, 0, 1];
    const n = item.normal || [0, 1, 0];

    const rotAngle = (item.seed || 0) % (Math.PI * 2);
    const rot = window.DropTemplateCache.rotateBasis(r, f, rotAngle);

    window.DropTemplateCache.render(
      "pickaxe_v1",
      { position: p, R: rot.R, normal: n, F: rot.F, scale: s, yOff: isIcon ? 0.072 : 0.12 },
      (tv, tc, ti) => {
        const handleColor = [0.4, 0.25, 0.15];
        buildTaperedSegment([-0.75, 0, 0], [0.75, 0, 0], 0.12, 0.12, 5, handleColor, tv, tc, ti);

        const bladeColor = [0.6, 0.6, 0.6];
        const bladeCenter = [0.525, 0.1, 0];
        buildTaperedSegment(bladeCenter, [0.525, 0.1, -0.5], 0.144, 0.012, 4, bladeColor, tv, tc, ti);
        buildTaperedSegment(bladeCenter, [0.525, 0.1,  0.5], 0.144, 0.012, 4, bladeColor, tv, tc, ti);
      },
      vertices, colors, indices
    );
  }
};
window.ItemRegistry["PICKAXE"] = window.ItemRegistry["pickaxe"];
