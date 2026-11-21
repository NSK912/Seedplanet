// === SEEDPLANET MODULE: JS/ITEMS/RUBBER_BLOCK.JS ===
// Matte dark-charcoal rubber block (RUBBER_BLOCK)

window.ItemRegistry = window.ItemRegistry || {};

// Build a 3D matte dark-charcoal rubber block model (matching reference image: wide low-profile rectangular block with subtle molded chamfer & matte face shading)
window.buildRubberBlockModel = function(item, vertices, colors, indices, targetBuffer) {
  const isIcon = (targetBuffer === "preview" || !!(item && item.isIconPreview));
  const p = (item && item.position) ? item.position : [0, 0, 0];
  const r = (item && item.R) ? item.R : [1, 0, 0];
  const n = (item && item.normal) ? item.normal : [0, 1, 0];
  const f = (item && item.F) ? item.F : [0, 0, 1];
  const rawS = (item && typeof item.size === "number") ? item.size : 0.08;
  const s = isIcon ? 1.0 : Math.min(rawS, 0.095);
  const hy = 0.135;
  const yOff = isIcon ? 0.0 : hy;
  const seed = (item && typeof item.seed === "number") ? item.seed : 0;
  const basis = isIcon ? { R: r, F: f } : window.DropTemplateCache.rotateBasis(r, f, (seed * 6.28318) % (Math.PI * 2));

  window.DropTemplateCache.render(
    "rubber_block_v1",
    { position: p, R: basis.R, normal: n, F: basis.F, scale: s, yOff: yOff },
    (tv, tc, ti) => {
      const addOrientedQuad = (a, b, c, d, col, outDir) => {
        const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2];
        const vx = b[0] - a[0], vy = b[1] - a[1], vz = b[2] - a[2];
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        const dot = nx * outDir[0] + ny * outDir[1] + nz * outDir[2];

        const i0 = tv.length / 3;
        const pts = [a, b, c, d];
        for (let k = 0; k < 4; k++) {
          tv.push(pts[k][0], pts[k][1], pts[k][2]);
          tc.push(col[0], col[1], col[2]);
        }
        if (dot >= 0) {
          ti.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
        } else {
          ti.push(i0, i0 + 3, i0 + 2, i0, i0 + 2, i0 + 1);
        }
      };

      const addOrientedTri = (a, b, c, col, outDir) => {
        const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2];
        const vx = b[0] - a[0], vy = b[1] - a[1], vz = b[2] - a[2];
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        const dot = nx * outDir[0] + ny * outDir[1] + nz * outDir[2];

        const i0 = tv.length / 3;
        const pts = [a, b, c];
        for (let k = 0; k < 3; k++) {
          tv.push(pts[k][0], pts[k][1], pts[k][2]);
          tc.push(col[0], col[1], col[2]);
        }
        if (dot >= 0) {
          ti.push(i0, i0 + 1, i0 + 2);
        } else {
          ti.push(i0, i0 + 2, i0 + 1);
        }
      };

      const hx = 0.29;
      const hz = 0.28;
      const bev = 0.014;

      const yB = -hy;
      const yT0 = hy - bev;
      const yT1 = hy;
      const ix = hx - bev;
      const iz = hz - bev;

      const colTop     = [0.22, 0.22, 0.23];
      const colBevel   = [0.26, 0.26, 0.28];
      const colSideA   = [0.16, 0.16, 0.17];
      const colSideB   = [0.14, 0.14, 0.15];
      const colMold    = [0.12, 0.12, 0.13];
      const colBottom  = [0.10, 0.10, 0.11];

      const midY = yT1 + 0.002;
      addOrientedQuad([-ix, yT1, -iz], [0, midY, -iz], [0, midY, 0], [-ix, yT1, 0], colTop, [0, 1, 0]);
      addOrientedQuad([0, midY, -iz], [ix, yT1, -iz], [ix, yT1, 0], [0, midY, 0], colBevel, [0, 1, 0]);
      addOrientedQuad([-ix, yT1, 0], [0, midY, 0], [0, midY, iz], [-ix, yT1, iz], colBevel, [0, 1, 0]);
      addOrientedQuad([0, midY, 0], [ix, yT1, 0], [ix, yT1, iz], [0, midY, iz], colTop, [0, 1, 0]);

      addOrientedQuad([-hx, yT0,  hz], [ hx, yT0,  hz], [ ix, yT1,  iz], [-ix, yT1,  iz], colBevel, [0, 0.7,  0.7]);
      addOrientedQuad([ hx, yT0, -hz], [-hx, yT0, -hz], [-ix, yT1, -iz], [ ix, yT1, -iz], colBevel, [0, 0.7, -0.7]);
      addOrientedQuad([-hx, yT0, -hz], [-hx, yT0,  hz], [-ix, yT1,  iz], [-ix, yT1, -iz], colBevel, [-0.7, 0.7, 0]);
      addOrientedQuad([ hx, yT0,  hz], [ hx, yT0, -hz], [ ix, yT1, -iz], [ ix, yT1,  iz], colBevel, [ 0.7, 0.7, 0]);

      const addMoldedSideFace = (isFrontBack, sign) => {
        const cMain = sign > 0 ? colSideA : colSideB;
        const midYLine = (yB + yT0) * 0.5;
        if (isFrontBack) {
          const z = sign * hz;
          const inX = hx * 0.55;
          addOrientedQuad([-hx, yT0, z], [hx, yT0, z], [inX, midYLine, z], [-inX, midYLine, z], cMain, [0, 0, sign]);
          addOrientedQuad([-inX, midYLine, z], [inX, midYLine, z], [hx, yB, z], [-hx, yB, z], colMold, [0, 0, sign]);
          addOrientedTri([-hx, yT0, z], [-inX, midYLine, z], [-hx, yB, z], colSideB, [0, 0, sign]);
          addOrientedTri([hx, yT0, z], [hx, yB, z], [inX, midYLine, z], colSideB, [0, 0, sign]);
        } else {
          const x = sign * hx;
          const inZ = hz * 0.55;
          addOrientedQuad([x, yT0, -hz], [x, yT0, hz], [x, midYLine, inZ], [x, midYLine, -inZ], cMain, [sign, 0, 0]);
          addOrientedQuad([x, midYLine, -inZ], [x, midYLine, inZ], [x, yB, hz], [x, yB, -hz], colMold, [sign, 0, 0]);
          addOrientedTri([x, yT0, -hz], [x, midYLine, -inZ], [x, yB, -hz], colSideB, [sign, 0, 0]);
          addOrientedTri([x, yT0, hz], [x, yB, hz], [x, midYLine, inZ], colSideB, [sign, 0, 0]);
        }
      };

      addMoldedSideFace(true,  1);
      addMoldedSideFace(true, -1);
      addMoldedSideFace(false,  1);
      addMoldedSideFace(false, -1);

      addOrientedQuad([-hx, yB, -hz], [hx, yB, -hz], [hx, yB, hz], [-hx, yB, hz], colBottom, [0, -1, 0]);
    },
    vertices, colors, indices
  );
};

window.ItemRegistry["rubber_block"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    window.buildRubberBlockModel(item, vertices, colors, indices, targetBuffer);
  }
};
window.ItemRegistry["RUBBER_BLOCK"] = window.ItemRegistry["rubber_block"];
