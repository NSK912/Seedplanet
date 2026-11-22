// === SEEDPLANET MODULE: JS/ITEMS/CLOTH.JS ===
// Woven white cloth stack (CLOTH)

window.ItemRegistry = window.ItemRegistry || {};

// Build a 3D folded white woven cloth stack model (matching reference image: 2 stacked folded layers with woven grid texture & dark crease gap)
window.buildClothModel = function(item, vertices, colors, indices, targetBuffer) {
  const isIcon = (targetBuffer === "preview" || !!(item && item.isIconPreview));
  const p = (item && item.position) ? item.position : [0, 0, 0];
  const r = (item && item.R) ? item.R : [1, 0, 0];
  const n = (item && item.normal) ? item.normal : [0, 1, 0];
  const f = (item && item.F) ? item.F : [0, 0, 1];
  const rawS = (item && typeof item.size === "number") ? item.size : 0.08;
  const s = isIcon ? 1.0 : Math.min(rawS, 0.095);
  const yOff = isIcon ? 0.0 : 0.095;
  const seed = (item && typeof item.seed === "number") ? item.seed : 0;
  const basis = isIcon ? { R: r, F: f } : window.DropTemplateCache.rotateBasis(r, f, (seed * 6.28318) % (Math.PI * 2));

  window.DropTemplateCache.render(
    "cloth_v1",
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

      const hx = 0.30;
      const hz = 0.255;

      const colTopA   = [0.98, 0.98, 0.99];
      const colTopB   = [0.90, 0.91, 0.94];
      const colWeaveA = [0.94, 0.95, 0.97];
      const colWeaveB = [0.78, 0.80, 0.84];
      const colSideA  = [0.89, 0.90, 0.93];
      const colSideB  = [0.76, 0.78, 0.82];
      const colGap    = [0.42, 0.44, 0.48];
      const colBottom = [0.74, 0.76, 0.80];

      const getPillowLift = (u, v) => {
        const cu = Math.max(0, 1.0 - (u * 2 - 1) * (u * 2 - 1));
        const cv = Math.max(0, 1.0 - (v * 2 - 1) * (v * 2 - 1));
        return 0.015 * cu * cv;
      };
      const widthAtZ = (nzCoord) => hx * (1.0 - 0.055 * (1.0 - nzCoord) * 0.5);

      const buildFoldedLayer = (yBottom, yTop, zShift, xScale, isTopLayer) => {
        const wGrid = 8;
        const dGrid = 8;

        for (let iz = 0; iz < dGrid; iz++) {
          const v0 = iz / dGrid;
          const v1 = (iz + 1) / dGrid;
          const nz0 = -1 + v0 * 2;
          const nz1 = -1 + v1 * 2;
          const z0 = nz0 * hz + zShift;
          const z1 = nz1 * hz + zShift;
          const w0 = widthAtZ(nz0) * xScale;
          const w1 = widthAtZ(nz1) * xScale;

          for (let ix = 0; ix < wGrid; ix++) {
            const u0 = ix / wGrid;
            const u1 = (ix + 1) / wGrid;
            const nx0 = -1 + u0 * 2;
            const nx1 = -1 + u1 * 2;

            const y00 = yTop + (isTopLayer ? getPillowLift(u0, v0) : 0.004 * Math.sin(u0 * Math.PI));
            const y10 = yTop + (isTopLayer ? getPillowLift(u1, v0) : 0.004 * Math.sin(u1 * Math.PI));
            const y11 = yTop + (isTopLayer ? getPillowLift(u1, v1) : 0.004 * Math.sin(u1 * Math.PI));
            const y01 = yTop + (isTopLayer ? getPillowLift(u0, v1) : 0.004 * Math.sin(u0 * Math.PI));

            const p00 = [nx0 * w0, y00, z0];
            const p10 = [nx1 * w0, y10, z0];
            const p11 = [nx1 * w1, y11, z1];
            const p01 = [nx0 * w1, y01, z1];

            const checker = ((ix + iz) & 1) === 0;
            const cellCol = isTopLayer ? (checker ? colTopA : colTopB) : (checker ? colWeaveA : colWeaveB);
            addOrientedQuad(p00, p10, p11, p01, cellCol, [0, 1, 0]);
          }
        }

        {
          const wb = widthAtZ(-1) * xScale;
          const wf = widthAtZ(1) * xScale;
          const zBack = -hz + zShift;
          const zFront = hz + zShift;
          addOrientedQuad(
            [-wb, yBottom, zBack], [-wf, yBottom, zFront], [wf, yBottom, zFront], [wb, yBottom, zBack],
            colBottom, [0, -1, 0]
          );
        }

        const arcSegs = 4;
        const lipRadius = (yTop - yBottom) * 0.5;
        const yMid = (yTop + yBottom) * 0.5;
        const zFrontBase = hz + zShift;
        const wf = widthAtZ(1) * xScale;

        for (let sIdx = 0; sIdx < arcSegs; sIdx++) {
          const a0 = (sIdx / arcSegs) * Math.PI - Math.PI * 0.5;
          const a1 = ((sIdx + 1) / arcSegs) * Math.PI - Math.PI * 0.5;
          const sin0 = Math.sin(a0), cos0 = Math.cos(a0);
          const sin1 = Math.sin(a1), cos1 = Math.cos(a1);

          const zA = zFrontBase + cos0 * lipRadius * 1.15;
          const yA = yMid + sin0 * lipRadius;
          const zB = zFrontBase + cos1 * lipRadius * 1.15;
          const yB = yMid + sin1 * lipRadius;

          const midA = (a0 + a1) * 0.5;
          const outN = [0, Math.sin(midA), Math.cos(midA)];

          for (let ix = 0; ix < wGrid; ix++) {
            const u0 = ix / wGrid;
            const u1 = (ix + 1) / wGrid;
            const x0 = (-1 + u0 * 2) * wf;
            const x1 = (-1 + u1 * 2) * wf;
            const lipLift0 = (sIdx === arcSegs - 1 && isTopLayer) ? getPillowLift(u0, 1.0) : 0;
            const lipLift1 = (sIdx === arcSegs - 1 && isTopLayer) ? getPillowLift(u1, 1.0) : 0;

            const checker = ((ix + sIdx) & 1) === 0;
            const cLip = checker ? colWeaveA : colWeaveB;
            addOrientedQuad(
              [x0, yB + lipLift0, zB],
              [x1, yB + lipLift1, zB],
              [x1, yA, zA],
              [x0, yA, zA],
              cLip,
              outN
            );
          }
        }

        {
          const wb = widthAtZ(-1) * xScale;
          const zBack = -hz + zShift;
          for (let ix = 0; ix < wGrid; ix++) {
            const x0 = (-1 + (ix / wGrid) * 2) * wb;
            const x1 = (-1 + ((ix + 1) / wGrid) * 2) * wb;
            const checker = ((ix + (isTopLayer ? 0 : 1)) & 1) === 0;
            addOrientedQuad(
              [x0, yTop, zBack],
              [x1, yTop, zBack],
              [x1, yBottom, zBack],
              [x0, yBottom, zBack],
              checker ? colSideA : colSideB,
              [0, 0, -1]
            );
          }
        }

        for (let iz = 0; iz < dGrid; iz++) {
          const v0 = iz / dGrid;
          const v1 = (iz + 1) / dGrid;
          const nz0 = -1 + v0 * 2;
          const nz1 = -1 + v1 * 2;
          const z0 = nz0 * hz + zShift;
          const z1 = nz1 * hz + zShift;
          const w0 = widthAtZ(nz0) * xScale;
          const w1 = widthAtZ(nz1) * xScale;
          const checker = ((iz + (isTopLayer ? 0 : 1)) & 1) === 0;
          const sCol = checker ? colSideA : colSideB;

          const yTopL0 = yTop + (isTopLayer ? getPillowLift(0, v0) : 0);
          const yTopL1 = yTop + (isTopLayer ? getPillowLift(0, v1) : 0);
          const yTopR0 = yTop + (isTopLayer ? getPillowLift(1, v0) : 0);
          const yTopR1 = yTop + (isTopLayer ? getPillowLift(1, v1) : 0);

          addOrientedQuad(
            [-w0, yTopL0, z0], [-w1, yTopL1, z1], [-w1, yBottom, z1], [-w0, yBottom, z0],
            sCol, [-1, 0, 0]
          );
          addOrientedQuad(
            [w1, yTopR1, z1], [w0, yTopR0, z0], [w0, yBottom, z0], [w1, yBottom, z1],
            sCol, [1, 0, 0]
          );
        }
      };

      buildFoldedLayer(-0.088, -0.016, -0.008, 0.96, false);

      const gX = hx * 0.92;
      const gZ = hz * 0.94;
      const gyB = -0.020;
      const gyT =  0.012;
      addOrientedQuad([-gX, gyT,  gZ], [ gX, gyT,  gZ], [ gX, gyB,  gZ], [-gX, gyB,  gZ], colGap, [0, 0, 1]);
      addOrientedQuad([ gX, gyT, -gZ], [-gX, gyT, -gZ], [-gX, gyB, -gZ], [ gX, gyB, -gZ], colGap, [0, 0, -1]);
      addOrientedQuad([-gX, gyT, -gZ], [-gX, gyT,  gZ], [-gX, gyB,  gZ], [-gX, gyB, -gZ], colGap, [-1, 0, 0]);
      addOrientedQuad([ gX, gyT,  gZ], [ gX, gyT, -gZ], [ gX, gyB, -gZ], [ gX, gyB,  gZ], colGap, [1, 0, 0]);

      {
        const spineSegs = 4;
        const spineMidY = -0.002;
        const spineR = 0.082;
        const wb = widthAtZ(-1) * 0.96;
        const zBackSpine = -hz - 0.004;
        for (let sIdx = 0; sIdx < spineSegs; sIdx++) {
          const a0 = Math.PI * 0.5 + (sIdx / spineSegs) * Math.PI;
          const a1 = Math.PI * 0.5 + ((sIdx + 1) / spineSegs) * Math.PI;
          const zA = zBackSpine + Math.cos(a0) * 0.045;
          const yA = spineMidY - Math.sin(a0) * spineR * 0.5;
          const zB = zBackSpine + Math.cos(a1) * 0.045;
          const yB = spineMidY - Math.sin(a1) * spineR * 0.5;
          addOrientedQuad(
            [-wb, yA, zA], [wb, yA, zA], [wb, yB, zB], [-wb, yB, zB],
            (sIdx & 1) === 0 ? colSideA : colWeaveB,
            [0, 0, -1]
          );
        }
      }

      buildFoldedLayer(0.004, 0.086, 0.004, 1.0, true);
    },
    vertices, colors, indices
  );
};

window.ItemRegistry["cloth"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    window.buildClothModel(item, vertices, colors, indices, targetBuffer);
  }
};
window.ItemRegistry["CLOTH"] = window.ItemRegistry["cloth"];
