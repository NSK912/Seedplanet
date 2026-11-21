// === SEEDPLANET MODULE: JS/ITEMS/MEGANEURA_ITEM.JS ===

window.ItemRegistry = window.ItemRegistry || {};
window.ItemRegistry["meganeura_item"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    if (typeof window.buildMeganeuraModel !== "function") return;
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

    const seed = (item && typeof item.seed === "number") ? item.seed : 0;
    const variantIdx = Math.floor(Math.abs(Math.sin(seed * 9876.54)) * 100) % 5;
    const isDrop = !isIcon && !isPreview;
    const scale = isDrop ? Math.min((item && typeof item.size === "number") ? item.size : 0.24, 0.28) : 1.5;
    const yOff = isDrop ? 0.045 : 0;
    const basis = isDrop
      ? window.DropTemplateCache.rotateBasis(itemR, itemF, (seed * 6.28318) % (Math.PI * 2))
      : { R: itemR, F: itemF };

    window.DropTemplateCache.render(
      `meganeura_v${variantIdx}`,
      { position: p, R: basis.R, normal: itemN, F: basis.F, scale: scale, yOff: yOff, colorTransform: overrideColors },
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
window.ItemRegistry["meganeura"] = window.ItemRegistry["meganeura_item"];
window.ItemRegistry["MEGANEURA"] = window.ItemRegistry["meganeura_item"];
