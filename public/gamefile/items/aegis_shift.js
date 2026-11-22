// === SEEDPLANET MODULE: JS/ITEMS/AEGIS_SHIFT.JS ===
// Shifting Obsidian Pickaxe / Axe / Greatsword (AEGIS_SHIFT)

(function() {
  window.buildAegisShiftModel = function(scale, basePos, axisAlong, edgeUp, thickRight, vertices, colors, indices, mode = "pickaxe") {
    const s = scale || 0.34;
    const p = basePos || [0, 0, 0];

    const norm = (v, fb) => {
      const l = v ? Math.hypot(v[0], v[1], v[2]) : 0;
      return l > 1e-5 ? [v[0] / l, v[1] / l, v[2] / l] : fb;
    };
    const uAxis = norm(axisAlong, [0, 1, 0]);
    let vAxis = norm(edgeUp, [1, 0, 0]);
    const dotUV = uAxis[0] * vAxis[0] + uAxis[1] * vAxis[1] + uAxis[2] * vAxis[2];
    vAxis = norm([vAxis[0] - uAxis[0] * dotUV, vAxis[1] - uAxis[1] * dotUV, vAxis[2] - uAxis[2] * dotUV], [1, 0, 0]);
    let wAxis = norm(thickRight, [
      uAxis[1] * vAxis[2] - uAxis[2] * vAxis[1],
      uAxis[2] * vAxis[0] - uAxis[0] * vAxis[2],
      uAxis[0] * vAxis[1] - uAxis[1] * vAxis[0]
    ]);
    const dotWU = uAxis[0] * wAxis[0] + uAxis[1] * wAxis[1] + uAxis[2] * wAxis[2];
    const dotWV = vAxis[0] * wAxis[0] + vAxis[1] * wAxis[1] + vAxis[2] * wAxis[2];
    wAxis = norm([
      wAxis[0] - uAxis[0] * dotWU - vAxis[0] * dotWV,
      wAxis[1] - uAxis[1] * dotWU - vAxis[1] * dotWV,
      wAxis[2] - uAxis[2] * dotWU - vAxis[2] * dotWV
    ], [0, 0, 1]);

    const cacheKey = mode || "pickaxe";
    const tpl = window.DropTemplateCache.getOrBake(`weapon_aegis_${cacheKey}`, (tv, tc, ti) => {
      const u0 = [1, 0, 0], v0 = [0, 1, 0], w0 = [0, 0, 1];
      const pt = (a, u, t) => [a, u, t];
        const addTaperedPrism = (a0, u0Min, u0Max, t0, a1, u1Min, u1Max, t1, col) => {
          const verts = [
            [a0, u0Min, -t0], [a1, u1Min, -t1], [a1, u1Min, t1], [a0, u0Min, t0],
            [a0, u0Max, -t0], [a1, u1Max, -t1], [a1, u1Max, t1], [a0, u0Max, t0]
          ];
          const baseIdx = tv.length / 3;
          for (let i = 0; i < 8; i++) {
            tv.push(verts[i][0], verts[i][1], verts[i][2]);
            tc.push(col[0], col[1], col[2]);
          }
          const idxPattern = [
            0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,
            0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6,
            0, 7, 3, 0, 4, 7, 1, 2, 6, 1, 6, 5
          ];
          for (let i = 0; i < idxPattern.length; i++) {
            ti.push(baseIdx + idxPattern[i]);
          }
        };

        const gripDark = [0.10, 0.11, 0.14];
        const gripRib = [0.17, 0.19, 0.23];
        const gunmetal = [0.22, 0.25, 0.30];
        const steelSilver = [0.56, 0.60, 0.66];
        const darkBlade = [0.14, 0.16, 0.21];
        const glowCyan = [0.20, 0.94, 0.92];
        const glowCore = [0.68, 1.00, 0.98];

        addBox(pt(-0.245, 0, 0), 0.042, 0.068, 0.056, gunmetal, u0, v0, w0, tv, tc, ti);
        addBox(pt(-0.270, 0, 0), 0.020, 0.054, 0.044, steelSilver, u0, v0, w0, tv, tc, ti);
        addBox(pt(-0.252, 0, 0), 0.036, 0.014, 0.060, glowCyan, u0, v0, w0, tv, tc, ti);

        addBox(pt(-0.025, 0, 0), 0.39, 0.054, 0.044, gripDark, u0, v0, w0, tv, tc, ti);
        for (let i = 0; i < 7; i++) {
          const rx = -0.18 + i * 0.052;
          addBox(pt(rx, 0, 0), 0.024, 0.060, 0.048, gripRib, u0, v0, w0, tv, tc, ti);
        }

        addBox(pt(0.180, 0, 0), 0.044, 0.094, 0.064, steelSilver, u0, v0, w0, tv, tc, ti);
        addBox(pt(0.265, 0, 0), 0.145, 0.082, 0.054, gunmetal, u0, v0, w0, tv, tc, ti);
        addBox(pt(0.250, 0, 0), 0.165, 0.018, 0.062, glowCyan, u0, v0, w0, tv, tc, ti);

        addBox(pt(0.370, 0, 0), 0.132, 0.132, 0.066, gunmetal, u0, v0, w0, tv, tc, ti);
        addBox(pt(0.370, 0, 0), 0.104, 0.104, 0.072, steelSilver, u0, v0, w0, tv, tc, ti);
        addBox(pt(0.370, 0, 0), 0.076, 0.076, 0.078, glowCyan, u0, v0, w0, tv, tc, ti);
        addBox(pt(0.370, 0, 0), 0.044, 0.044, 0.084, glowCore, u0, v0, w0, tv, tc, ti);

        const drawCurvedPickArm = (signU) => {
          const u1a = signU * 0.055, u1b = signU * 0.215;
          addTaperedPrism(0.335, Math.min(u1a, u1a + signU * 0.06), Math.max(u1a, u1a + signU * 0.06), 0.022,
                          0.345, Math.min(u1b, u1b + signU * 0.05), Math.max(u1b, u1b + signU * 0.05), 0.018, gunmetal);
          addTaperedPrism(0.345, Math.min(0.06 * signU, 0.215 * signU), Math.max(0.06 * signU, 0.215 * signU), 0.020,
                          0.420, Math.min(0.06 * signU, 0.215 * signU), Math.max(0.06 * signU, 0.215 * signU), 0.014, steelSilver);
          const u2a = signU * 0.205, u2b = signU * 0.385;
          addTaperedPrism(0.320, Math.min(u2a, u2b), Math.max(u2a, u2b), 0.016,
                          0.398, Math.min(u2a, u2b), Math.max(u2a, u2b), 0.010, darkBlade);
          addBox(pt(0.365, signU * 0.255, 0), 0.014, 0.088, 0.042, glowCyan, u0, v0, w0, tv, tc, ti);
          addTaperedPrism(0.285, Math.min(signU * 0.375, signU * 0.505), Math.max(signU * 0.375, signU * 0.505), 0.012,
                          0.215, Math.min(signU * 0.495, signU * 0.515), Math.max(signU * 0.495, signU * 0.515), 0.002, darkBlade);
          addTaperedPrism(0.335, Math.min(signU * 0.375, signU * 0.500), Math.max(signU * 0.375, signU * 0.500), 0.008,
                          0.218, Math.min(signU * 0.495, signU * 0.515), Math.max(signU * 0.495, signU * 0.515), 0.002, steelSilver);
        };

        if (cacheKey === "greatsword") {
          for (let si = -1; si <= 1; si += 2) {
            addTaperedPrism(0.325, Math.min(si * 0.06, si * 0.23), Math.max(si * 0.06, si * 0.23), 0.022,
                            0.380, Math.min(si * 0.06, si * 0.23), Math.max(si * 0.06, si * 0.23), 0.014, gunmetal);
            addTaperedPrism(0.345, Math.min(si * 0.21, si * 0.38), Math.max(si * 0.21, si * 0.38), 0.016,
                            0.425, Math.min(si * 0.23, si * 0.42), Math.max(si * 0.23, si * 0.42), 0.009, darkBlade);
            addTaperedPrism(0.390, Math.min(si * 0.36, si * 0.46), Math.max(si * 0.36, si * 0.46), 0.010,
                            0.475, Math.min(si * 0.46, si * 0.48), Math.max(si * 0.46, si * 0.48), 0.002, steelSilver);
            addBox(pt(0.375, si * 0.245, 0), 0.015, 0.075, 0.036, glowCyan, u0, v0, w0, tv, tc, ti);

            addBox(pt(0.475, si * 0.095, 0), 0.115, 0.056, 0.068, steelSilver, u0, v0, w0, tv, tc, ti);
            addBox(pt(0.475, si * 0.078, 0), 0.090, 0.018, 0.074, glowCyan, u0, v0, w0, tv, tc, ti);
          }

          addTaperedPrism(0.410, -0.066, 0.066, 0.022, 1.440, -0.056, 0.056, 0.017, gunmetal);
          addTaperedPrism(0.410,  0.066, 0.145, 0.014, 1.440,  0.056, 0.128, 0.007, steelSilver);
          addTaperedPrism(0.410, -0.145,-0.066, 0.014, 1.440, -0.128,-0.056, 0.007, steelSilver);
          addTaperedPrism(0.430,  0.138, 0.152, 0.004, 1.440,  0.122, 0.135, 0.003, glowCore);
          addTaperedPrism(0.430, -0.152,-0.138, 0.004, 1.440, -0.135,-0.122, 0.003, glowCore);
          addTaperedPrism(0.425, -0.018, 0.018, 0.025, 1.430, -0.013, 0.013, 0.020, glowCyan);
          addTaperedPrism(0.435, -0.008, 0.008, 0.027, 1.410, -0.006, 0.006, 0.022, glowCore);

          addTaperedPrism(1.440, -0.056, 0.056, 0.017, 1.725, -0.006, 0.006, 0.003, gunmetal);
          addTaperedPrism(1.440,  0.056, 0.128, 0.007, 1.730,  0.000, 0.008, 0.002, steelSilver);
          addTaperedPrism(1.440, -0.128,-0.056, 0.007, 1.730, -0.008, 0.000, 0.002, steelSilver);
          addTaperedPrism(1.430, -0.013, 0.013, 0.020, 1.560, -0.004, 0.004, 0.008, glowCyan);
        } else if (cacheKey === "axe") {
          const drawFoldedPickArm = (signU) => {
            const pivotA = 0.355, pivotU = signU * 0.055;
            const foldAngle = 1.18 * signU;
            const cosF = Math.cos(foldAngle), sinF = Math.sin(foldAngle);
            const rotPt = (a, u, t) => {
              const da = a - pivotA;
              const du = u - pivotU;
              return [pivotA + da * cosF - du * sinF, pivotU + du * cosF + da * sinF, t];
            };
            const rotUAxis = [cosF, sinF, 0];
            const rotVAxis = [-sinF, cosF, 0];
            const addRotTaperedPrism = (a0, u0Min, u0Max, t0, a1, u1Min, u1Max, t1, col) => {
              const verts = [
                rotPt(a0, u0Min, -t0), rotPt(a1, u1Min, -t1), rotPt(a1, u1Min, t1), rotPt(a0, u0Min, t0),
                rotPt(a0, u0Max, -t0), rotPt(a1, u1Max, -t1), rotPt(a1, u1Max, t1), rotPt(a0, u0Max, t0)
              ];
              const baseIdx = tv.length / 3;
              for (let i = 0; i < 8; i++) {
                tv.push(verts[i][0], verts[i][1], verts[i][2]);
                tc.push(col[0], col[1], col[2]);
              }
              const idxPattern = [
                0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,
                0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6,
                0, 7, 3, 0, 4, 7, 1, 2, 6, 1, 6, 5
              ];
              for (let i = 0; i < idxPattern.length; i++) {
                ti.push(baseIdx + idxPattern[i]);
              }
            };

            const u1a = signU * 0.055, u1b = signU * 0.215;
            addRotTaperedPrism(0.335, Math.min(u1a, u1a + signU * 0.06), Math.max(u1a, u1a + signU * 0.06), 0.022,
                               0.345, Math.min(u1b, u1b + signU * 0.05), Math.max(u1b, u1b + signU * 0.05), 0.018, gunmetal);
            addRotTaperedPrism(0.345, Math.min(0.06 * signU, 0.215 * signU), Math.max(0.06 * signU, 0.215 * signU), 0.020,
                               0.420, Math.min(0.06 * signU, 0.215 * signU), Math.max(0.06 * signU, 0.215 * signU), 0.014, steelSilver);
            const u2a = signU * 0.205, u2b = signU * 0.385;
            addRotTaperedPrism(0.320, Math.min(u2a, u2b), Math.max(u2a, u2b), 0.016,
                               0.398, Math.min(u2a, u2b), Math.max(u2a, u2b), 0.010, darkBlade);
            addBox(rotPt(0.365, signU * 0.255, 0), 0.014, 0.088, 0.042, glowCyan, rotUAxis, rotVAxis, w0, tv, tc, ti);
            addRotTaperedPrism(0.285, Math.min(signU * 0.375, signU * 0.505), Math.max(signU * 0.375, signU * 0.505), 0.012,
                               0.215, Math.min(signU * 0.495, signU * 0.515), Math.max(signU * 0.495, signU * 0.515), 0.002, darkBlade);
            addRotTaperedPrism(0.335, Math.min(signU * 0.375, signU * 0.500), Math.max(signU * 0.375, signU * 0.500), 0.008,
                               0.218, Math.min(signU * 0.495, signU * 0.515), Math.max(signU * 0.495, signU * 0.515), 0.002, steelSilver);
          };
          drawFoldedPickArm(1);
          drawFoldedPickArm(-1);
          addBox(pt(0.435, 0, 0), 0.032, 0.125, 0.048, steelSilver, u0, v0, w0, tv, tc, ti);
        } else {
          drawCurvedPickArm(1);
          drawCurvedPickArm(-1);
          addBox(pt(0.435, 0, 0), 0.032, 0.125, 0.048, steelSilver, u0, v0, w0, tv, tc, ti);
        }
    });
    if (!tpl) return;
    window.DropTemplateCache.emit(tpl, p, uAxis, vAxis, wAxis, s, 0, vertices, colors, indices);
  };

  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["aegis_shift"] = {
    render: function(item, vertices, colors, indices, targetBuffer) {
      const isIcon = (targetBuffer === "preview" || (item && item.isIconPreview));
      const p = (item && item.position) ? item.position : [0, 0, 0];
      const r = (item && item.R) ? item.R : [1, 0, 0];
      const n = (item && item.normal) ? item.normal : [0, 1, 0];
      const f = (item && item.F) ? item.F : [0, 0, 1];
      const mode = (item && item.aegisMode) ? item.aegisMode : "pickaxe";
      if (isIcon) {
        const ax = [r[0] * 0.34 + n[0] * 0.94, r[1] * 0.34 + n[1] * 0.94, r[2] * 0.34 + n[2] * 0.94];
        const ed = [r[0] * 0.94 - n[0] * 0.34, r[1] * 0.94 - n[1] * 0.34, r[2] * 0.94 - n[2] * 0.34];
        window.buildAegisShiftModel(1.0, p, ax, ed, f, vertices, colors, indices, mode);
      } else {
        const s = (item && typeof item.size === "number") ? Math.min(item.size, 0.075) : 0.064;
        const rotAngle = (item && typeof item.seed === "number") ? (item.seed % (Math.PI * 2)) : 0;
        const rot = window.DropTemplateCache.rotateBasis(r, f, rotAngle);
        const lift = 0.048 * s;
        const centerShift = -0.08 * s;
        const gp = [
          p[0] + n[0] * lift + rot.R[0] * centerShift,
          p[1] + n[1] * lift + rot.R[1] * centerShift,
          p[2] + n[2] * lift + rot.R[2] * centerShift
        ];
        window.buildAegisShiftModel(s, gp, rot.R, rot.F, n, vertices, colors, indices, mode);
      }
    }
  };
  window.ItemRegistry["AEGIS_SHIFT"] = window.ItemRegistry["aegis_shift"];
})();
