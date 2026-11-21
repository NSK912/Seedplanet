// === SEEDPLANET MODULE: JS/ITEMS/OBSIDIAN_CUBE_ITEM.JS ===
window.ItemRegistry = window.ItemRegistry || {};
window.ItemRegistry["obsidian_cube_item"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    if (typeof window.buildObsidianCubeModel !== "function") return;
    const isIcon = (targetBuffer === "preview" || !!(item && item.isIconPreview));
    const isPreview = !!(item && item.isPreview);
    const p = (item && item.position) ? item.position : [0, 0, 0];
    const itemR = (item && item.R) ? item.R : [1, 0, 0];
    const itemF = (item && item.F) ? item.F : [0, 0, 1];
    const itemN = (item && item.normal) ? item.normal : [0, 1, 0];
    const isValid = !(item && item.isValidPlacement === false);

    let overrideColors = null;
    if (isPreview) {
      overrideColors = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    }

    const seed = (item && typeof item.seed === "number") ? item.seed : 1234;
    const isDrop = !isIcon && !isPreview;
    const scale = isDrop ? Math.min((item && typeof item.size === "number") ? item.size : 0.075, 0.095) : 1.0;
    const yOff = isDrop ? 0.44 : 0;
    const basis = isDrop
      ? window.DropTemplateCache.rotateBasis(itemR, itemF, (seed * 6.28318) % (Math.PI * 2))
      : { R: itemR, F: itemF };

    window.DropTemplateCache.render(
      "obsidian_cube_v1",
      { position: p, R: basis.R, normal: itemN, F: basis.F, scale: scale, yOff: yOff, colorTransform: overrideColors },
      (tv, tc, ti) => {
        window.buildObsidianCubeModel(
          1234,
          0,
          false,
          false,
          1.0,
          [0, 0, 0],
          [1, 0, 0], [0, 1, 0], [0, 0, 1],
          tv, tc, ti,
          null,
          null,
          null
        );
      },
      vertices, colors, indices
    );
  }
};
window.ItemRegistry["obsidian_cube"] = window.ItemRegistry["obsidian_cube_item"];
window.ItemRegistry["OBSIDIAN_CUBE"] = window.ItemRegistry["obsidian_cube_item"];
