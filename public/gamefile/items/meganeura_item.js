// === SEEDPLANET MODULE: JS/ITEMS/MEGANEURA_ITEM.JS ===

window.ItemRegistry["meganeura_item"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    if (typeof window.buildMeganeuraModel !== "function") return;
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

    const seed = (item && typeof item.seed === "number") ? item.seed : 0;
    const variantIdx = Math.floor(Math.abs(Math.sin(seed * 9876.54)) * 100) % 5;

    window.DropTemplateCache.render(
      `meganeura_v${variantIdx}`,
      { position: p, R: itemR, normal: itemN, F: itemF, scale: 1.5, yOff: 0, colorTransform: overrideColors },
      (tv, tc, ti) => {
        window.buildMeganeuraModel(
          variantIdx * 137 + 1,
          0,
          false,
          false,
          1.0,
          [0, 0, 0],
          [1, 0, 0], [0, 1, 0], [0, 0, 1],
          tv, tc, ti,
          null
        );
      },
      vertices, colors, indices
    );
  }
};
