// === SEEDPLANET MODULE: JS/ITEMS/IRON_BULLET.JS ===
// Spherical iron bullet ammunition (IRON_BULLET)

window.ItemRegistry = window.ItemRegistry || {};

window.buildIronBulletModel = function(item, vertices, colors, indices) {
  const p = (item && item.position) ? item.position : [0, 0, 0];
  const s = typeof playerScale !== 'undefined' ? playerScale : 0.1;
  const isGroundDrop = !!(item && item.isGroundDrop);
  const radius = isGroundDrop
    ? ((typeof item.size === "number") ? Math.min(item.size, 0.014) : 0.009)
    : (((item && item.radius) ? item.radius : 0.18) * s);
  const r = (isGroundDrop && item.R) ? item.R : [1, 0, 0];
  const n = (isGroundDrop && item.normal) ? item.normal : [0, 1, 0];
  const f = (isGroundDrop && item.F) ? item.F : [0, 0, 1];

  window.DropTemplateCache.render(
    "iron_bullet_std",
    { position: p, R: r, normal: n, F: f, scale: radius, yOff: isGroundDrop ? 1.0 : 0 },
    (tv, tc, ti) => {
      const segsLat = 12;
      const segsLong = 16;
      const ironColor = [0.75, 0.78, 0.82];

      if (typeof buildLowPolySphere === "function") {
        buildLowPolySphere([0, 0, 0], 1.0, segsLat, ironColor, 0, 0, tv, tc, ti);
      } else {
        for (let lat = 0; lat <= segsLat; lat++) {
          const theta = (lat / segsLat) * Math.PI;
          const sinTheta = Math.sin(theta);
          const cosTheta = Math.cos(theta);

          for (let lon = 0; lon <= segsLong; lon++) {
            const phi = (lon / segsLong) * Math.PI * 2;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            const dx = sinTheta * cosPhi;
            const dy = cosTheta;
            const dz = sinTheta * sinPhi;

            tv.push(dx, dy, dz);

            const light = Math.max(0.3, dx * 0.35 + dy * 0.75 + dz * 0.55);
            const spec = Math.pow(Math.max(0, dy * 0.65 + dz * 0.7), 6) * 0.35;
            tc.push(
              Math.min(1.0, ironColor[0] * light + spec),
              Math.min(1.0, ironColor[1] * light + spec),
              Math.min(1.0, ironColor[2] * light + spec)
            );
          }
        }

        for (let lat = 0; lat < segsLat; lat++) {
          for (let lon = 0; lon < segsLong; lon++) {
            const first = lat * (segsLong + 1) + lon;
            const second = first + segsLong + 1;
            ti.push(first, second, first + 1);
            ti.push(second, second + 1, first + 1);
          }
        }
      }
    },
    vertices, colors, indices
  );
};

window.ItemRegistry["iron_bullet"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    window.buildIronBulletModel(item, vertices, colors, indices);
  }
};
window.ItemRegistry["IRON_BULLET"] = window.ItemRegistry["iron_bullet"];
