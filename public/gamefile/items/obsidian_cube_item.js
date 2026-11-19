// === SEEDPLANET MODULE: JS/ITEMS/OBSIDIAN_CUBE_ITEM.JS ===
window.ItemRegistry = window.ItemRegistry || {};
window.ItemRegistry["obsidian_cube_item"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    if (typeof window.buildObsidianCubeModel !== "function") return;
    const p = (item && item.position) ? item.position : [0, 0, 0];
    const itemR = (item && item.R) ? item.R : [1, 0, 0];
    const itemF = (item && item.F) ? item.F : [0, 0, 1];
    const itemN = (item && item.normal) ? item.normal : [0, 1, 0];
    const isPreview = !!(item && item.isPreview);
    const isValid = !(item && item.isValidPlacement === false);

    let overrideColors = null;
    if (isPreview) {
      overrideColors = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    }

    window.DropTemplateCache.render(
      "obsidian_cube_v1",
      { position: p, R: itemR, normal: itemN, F: itemF, scale: 1.0, yOff: 0, colorTransform: overrideColors },
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
