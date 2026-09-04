// === SEEDPLANET MODULE: JS/ITEMS/LOG.JS ===

window.ItemRegistry["log"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    // Log (thicker branch)
    const lColor = item.color; // brown
    const p = item.position;
    const r = item.R, f = item.F, n = item.normal;
    const s = item.size;

    const thickness = s * 0.28;
    const length = s * 0.55;

    if (item.seed === undefined) item.seed = Math.random();
    const rotAngle = item.seed * Math.PI * 2;
    const cosA = Math.cos(rotAngle);
    const sinA = Math.sin(rotAngle);

    const dirX = r[0] * cosA + f[0] * sinA;
    const dirY = r[1] * cosA + f[1] * sinA;
    const dirZ = r[2] * cosA + f[2] * sinA;

    // Elevation equals radius so the log cylinder rests flush on the ground surface
    const elevation = thickness * 0.5;
    const center = [
      p[0] + n[0] * elevation,
      p[1] + n[1] * elevation,
      p[2] + n[2] * elevation,
    ];

    const pStart = [
      center[0] - dirX * length,
      center[1] - dirY * length,
      center[2] - dirZ * length,
    ];
    const pEnd = [
      center[0] + dirX * length,
      center[1] + dirY * length,
      center[2] + dirZ * length,
    ];

    buildTaperedSegment(
      pStart,
      pEnd,
      thickness,
      thickness * 0.9,
      6,
      lColor,
      vertices,
      colors,
      indices,
      true // add caps to make it solid
    );
  }
};
