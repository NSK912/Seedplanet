// === SEEDPLANET MODULE: JS/ITEMS/GOLD_ORE.JS ===
// Gold Ore chunk (GOLD_ORE)

window.ItemRegistry = window.ItemRegistry || {};

window.ItemRegistry["gold_ore"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const color = [0.85, 0.68, 0.12];
    const baseSize = (item && typeof item.size === "number") ? item.size : 0.04;
    const s = baseSize * 1.5;
    const p = (item && item.position) ? item.position : [0, 0, 0];
    const r = (item && item.R) ? item.R : [1, 0, 0];
    const n = (item && item.normal) ? item.normal : [0, 1, 0];
    const f = (item && item.F) ? item.F : [0, 0, 1];
    const yOff = s > 0 ? (-(baseSize * 0.2) / s) : 0;

    const colKey = window.DropTemplateCache.quantizeColor(color);
    const seed = (item && typeof item.seed === "number") ? item.seed : 0;
    const variant = Math.floor(Math.abs(seed * 137.5)) % 6;
    const key = `gold_ore_${colKey}_v${variant}`;

    window.DropTemplateCache.render(
      key,
      { position: p, R: r, normal: n, F: f, scale: s, yOff: yOff },
      (tv, tc, ti) => {
        buildRockFormation(
          [0, 0, 0],
          1.0,
          color,
          seed,
          tv,
          tc,
          ti
        );
      },
      vertices, colors, indices
    );
  }
};
window.ItemRegistry["GOLD_ORE"] = window.ItemRegistry["gold_ore"];
