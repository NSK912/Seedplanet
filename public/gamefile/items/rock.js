// === SEEDPLANET MODULE: JS/ITEMS/ROCK.JS ===

window.ItemRegistry["rock"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    let color = item.color || [0.5, 0.5, 0.5];
    if (item.type === "dirt" || item.type === "DIRT") color = [0.46, 0.30, 0.16];

    const s = item.type === "big_rock" ? item.size * 2.0 : item.size * 1.5;
    const p = item.position || [0, 0, 0];
    const r = item.R || [1, 0, 0];
    const n = item.normal || [0, 1, 0];
    const f = item.F || [0, 0, 1];
    const yOff = s > 0 ? (-(item.size * 0.2) / s) : 0;

    const colKey = window.DropTemplateCache.quantizeColor(color);
    const variant = Math.floor(Math.abs((item.seed || 0) * 137.5)) % 6;
    const key = `rock_${item.type || "rock"}_${colKey}_v${variant}`;

    window.DropTemplateCache.render(
      key,
      { position: p, R: r, normal: n, F: f, scale: s, yOff: yOff },
      (tv, tc, ti) => {
        buildRockFormation(
          [0, 0, 0],
          1.0,
          color,
          item.seed,
          tv,
          tc,
          ti
        );
      },
      vertices, colors, indices
    );
  }
};

window.ItemRegistry["big_rock"] = window.ItemRegistry["rock"];
window.ItemRegistry["dirt"] = window.ItemRegistry["rock"];
window.ItemRegistry["DIRT"] = window.ItemRegistry["rock"];
