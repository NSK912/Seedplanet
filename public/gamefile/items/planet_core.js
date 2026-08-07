// === SEEDPLANET MODULE: JS/ITEMS/PLANET_CORE.JS ===

window.ItemRegistry["planet_core"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    buildLowPolySphere(
      item.position,
      item.radius,
      item.segs,
      item.color,
      item.noiseStrength,
      item.seed,
      vertices,
      colors,
      indices
    );
  }
};
