// === SEEDPLANET MODULE: JS/ITEMS/IRON_BUCKET.JS ===
// Forged iron water bucket (IRON_BUCKET / WATER_BUCKET)

window.ItemRegistry = window.ItemRegistry || {};

window.buildIronBucketModel = function(scale, centerPos, rVec, nVec, fVec, vertices, colors, indices, hasWater = false, handleAngle = 0) {
  const s = scale || 0.35;
  const p = centerPos || [0, 0, 0];
  const r = rVec || [1, 0, 0];
  const n = nVec || [0, 1, 0];
  const f = fVec || [0, 0, 1];

  const pt = (rx, ny, fz) => [
    p[0] + (r[0] * rx + n[0] * ny + f[0] * fz) * s,
    p[1] + (r[1] * rx + n[1] * ny + f[1] * fz) * s,
    p[2] + (r[2] * rx + n[2] * ny + f[2] * fz) * s
  ];

  const ironBodyDark = [0.58, 0.62, 0.68];
  const ironBodyLight = [0.66, 0.70, 0.76];
  const ironBand = [0.38, 0.41, 0.46];
  const ironLug = [0.32, 0.35, 0.40];
  const ironHandle = [0.50, 0.54, 0.60];
  const waterColor = [0.18, 0.62, 0.95];
  const waterHighlight = [0.42, 0.82, 1.0];
  const innerCavityDark = [0.20, 0.22, 0.26];
  const innerCavityWall = [0.26, 0.29, 0.34];
  const gripColor = [0.42, 0.28, 0.16];

  // 1. Bottom base plate & iron foot hoop
  buildTaperedSegment(pt(0, -0.36, 0), pt(0, -0.30, 0), 0.245 * s, 0.255 * s, 8, ironBand, vertices, colors, indices, true);

  // 2. Lower bucket wall (8-sided flared low-poly)
  buildTaperedSegment(pt(0, -0.30, 0), pt(0, -0.04, 0), 0.24 * s, 0.295 * s, 8, ironBodyDark, vertices, colors, indices, false);

  // 3. Middle reinforcing iron hoop
  buildTaperedSegment(pt(0, -0.06, 0), pt(0, 0.01, 0), 0.305 * s, 0.312 * s, 8, ironBand, vertices, colors, indices, false);

  // 4. Upper bucket wall (8-sided flared low-poly)
  buildTaperedSegment(pt(0, 0.01, 0), pt(0, 0.24, 0), 0.295 * s, 0.35 * s, 8, ironBodyLight, vertices, colors, indices, false);

  // 5. Top thick iron rim / lip (Open ring: addCaps = false so no dark cap covers the opening)
  buildTaperedSegment(pt(0, 0.22, 0), pt(0, 0.28, 0), 0.355 * s, 0.365 * s, 8, ironBand, vertices, colors, indices, false);

  // 6. Bucket Interior / Water Volume
  // Always build interior metal lining first for realistic bucket depth
  buildTaperedSegment(pt(0, -0.30, 0), pt(0, -0.27, 0), 0.235 * s, 0.240 * s, 8, innerCavityDark, vertices, colors, indices, true);
  buildTaperedSegment(pt(0, -0.27, 0), pt(0, 0.23, 0), 0.240 * s, 0.340 * s, 8, innerCavityWall, vertices, colors, indices, false);

  if (hasWater) {
    // Water pool surface rests strictly inside upper bucket cavity (never penetrates bucket walls or bottom)
    buildTaperedSegment(pt(0, 0.13, 0), pt(0, 0.185, 0), 0.262 * s, 0.290 * s, 8, waterColor, vertices, colors, indices, true);
    // Crisp water surface highlight
    buildTaperedSegment(pt(0, 0.187, 0), pt(0, 0.191, 0), 0.18 * s, 0.13 * s, 8, waterHighlight, vertices, colors, indices, true);
  }

  // 7. Side mounting lugs (ears)
  buildTaperedSegment(pt(-0.365, 0.21, 0), pt(-0.365, 0.32, 0), 0.042 * s, 0.036 * s, 5, ironLug, vertices, colors, indices, true);
  buildTaperedSegment(pt(0.365, 0.21, 0), pt(0.365, 0.32, 0), 0.042 * s, 0.036 * s, 5, ironLug, vertices, colors, indices, true);

  // 8. Low-poly arched bail handle (hinged around side lugs at ny = 0.28, fz = 0)
  const cosH = Math.cos(handleAngle || 0);
  const sinH = Math.sin(handleAngle || 0);
  const ptHandle = (rx, ny) => {
    const dy = ny - 0.28;
    return pt(rx, 0.28 + dy * cosH, -dy * sinH);
  };
  const h0 = pt(-0.365, 0.28, 0);
  const h1 = ptHandle(-0.31, 0.47);
  const h2 = ptHandle(-0.14, 0.58);
  const h3 = ptHandle(0.14, 0.58);
  const h4 = ptHandle(0.31, 0.47);
  const h5 = pt(0.365, 0.28, 0);
  const hRad = 0.022 * s;
  buildTaperedSegment(h0, h1, hRad, hRad, 5, ironHandle, vertices, colors, indices, false);
  buildTaperedSegment(h1, h2, hRad, hRad, 5, ironHandle, vertices, colors, indices, false);
  buildTaperedSegment(h2, h3, hRad, hRad, 5, ironHandle, vertices, colors, indices, false);
  buildTaperedSegment(h3, h4, hRad, hRad, 5, ironHandle, vertices, colors, indices, false);
  buildTaperedSegment(h4, h5, hRad, hRad, 5, ironHandle, vertices, colors, indices, false);

  // 9. Center wooden/forged grip sleeve at top of handle
  buildTaperedSegment(ptHandle(-0.10, 0.58), ptHandle(0.10, 0.58), 0.036 * s, 0.036 * s, 6, gripColor, vertices, colors, indices, true);
};

window.ItemRegistry["iron_bucket"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const s = (item && item.size) ? item.size * 2.2 : 0.55;
    const p = (item && item.position) ? item.position : [0, 0, 0];
    const r = (item && item.R) ? item.R : [1, 0, 0];
    const n = (item && item.normal) ? item.normal : [0, 1, 0];
    const f = (item && item.F) ? item.F : [0, 0, 1];
    const hasWater = !!(item && item.hasWater);
    window.DropTemplateCache.render(
      hasWater ? "water_bucket_v1" : "iron_bucket_v1",
      { position: p, R: r, normal: n, F: f, scale: s, yOff: 0 },
      (tv, tc, ti) => {
        window.buildIronBucketModel(1.0, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], tv, tc, ti, hasWater, 0);
      },
      vertices, colors, indices
    );
  }
};
window.ItemRegistry["IRON_BUCKET"] = window.ItemRegistry["iron_bucket"];

window.ItemRegistry["water_bucket"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const s = (item && item.size) ? item.size * 2.2 : 0.55;
    const p = (item && item.position) ? item.position : [0, 0, 0];
    const r = (item && item.R) ? item.R : [1, 0, 0];
    const n = (item && item.normal) ? item.normal : [0, 1, 0];
    const f = (item && item.F) ? item.F : [0, 0, 1];
    window.DropTemplateCache.render(
      "water_bucket_v1",
      { position: p, R: r, normal: n, F: f, scale: s, yOff: 0 },
      (tv, tc, ti) => {
        window.buildIronBucketModel(1.0, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], tv, tc, ti, true, 0);
      },
      vertices, colors, indices
    );
  }
};
window.ItemRegistry["WATER_BUCKET"] = window.ItemRegistry["water_bucket"];
