// === SEEDPLANET MODULE: JS/ITEMS/TANTO.JS ===
// Glowing Obsidian Tanto Knife (TANTO) & Shirasaya form

(function() {
  window.buildTantoModel = function(scale, basePos, axisAlong, edgeUp, thickRight, vertices, colors, indices) {
    const s = scale || 0.35;
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

    const tpl = window.DropTemplateCache.getOrBake("weapon_tanto", (tv, tc, ti) => {
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
        const gripRib = [0.18, 0.20, 0.24];
        const metalGuard = [0.26, 0.29, 0.34];
        const habakiSteel = [0.34, 0.38, 0.44];
        const obsidianBody = [0.11, 0.12, 0.16];
        const spineSteel = [0.22, 0.25, 0.31];
        const glowCyan = [0.22, 0.95, 0.88];
        const glowCore = [0.58, 1.00, 0.96];

        addBox(pt(-0.24, 0.008, 0), 0.045, 0.068, 0.044, metalGuard, u0, v0, w0, tv, tc, ti);
        addBox(pt(-0.265, 0.008, 0), 0.014, 0.052, 0.032, spineSteel, u0, v0, w0, tv, tc, ti);
        addBox(pt(-0.06, 0.008, 0), 0.32, 0.064, 0.040, gripDark, u0, v0, w0, tv, tc, ti);
        for (let i = 0; i < 6; i++) {
          const rx = -0.185 + i * 0.046;
          addBox(pt(rx, 0.008, 0), 0.022, 0.070, 0.044, gripRib, u0, v0, w0, tv, tc, ti);
        }
        addBox(pt(0.065, 0.010, 0), 0.028, 0.022, 0.046, glowCyan, u0, v0, w0, tv, tc, ti);
        addBox(pt(0.125, 0.012, 0), 0.040, 0.112, 0.076, metalGuard, u0, v0, w0, tv, tc, ti);
        addBox(pt(0.125, 0.068, 0), 0.026, 0.012, 0.040, glowCyan, u0, v0, w0, tv, tc, ti);
        addBox(pt(0.180, 0.012, 0), 0.070, 0.072, 0.044, habakiSteel, u0, v0, w0, tv, tc, ti);
        addBox(pt(0.180, 0.012, 0), 0.030, 0.078, 0.048, spineSteel, u0, v0, w0, tv, tc, ti);

        addTaperedPrism(0.215, -0.024, -0.004, 0.018, 0.595, -0.020, -0.004, 0.014, spineSteel);
        addTaperedPrism(0.215, -0.004,  0.036, 0.016, 0.595, -0.004,  0.034, 0.012, obsidianBody);
        addTaperedPrism(0.215,  0.036,  0.049, 0.008, 0.595,  0.034,  0.046, 0.006, glowCyan);
        addTaperedPrism(0.320,  0.046,  0.053, 0.004, 0.595,  0.044,  0.050, 0.003, glowCore);

        addBox(pt(0.295, 0.004, 0), 0.120, 0.007, 0.036, glowCyan, u0, v0, w0, tv, tc, ti);
        addBox(pt(0.385, 0.020, 0), 0.070, 0.006, 0.034, glowCyan, u0, v0, w0, tv, tc, ti);

        addTaperedPrism(0.595, -0.020, -0.004, 0.014, 0.775, -0.020, -0.011, 0.003, spineSteel);
        addTaperedPrism(0.595, -0.004,  0.034, 0.012, 0.775, -0.018, -0.009, 0.002, obsidianBody);
        addTaperedPrism(0.595,  0.034,  0.046, 0.006, 0.775, -0.015, -0.007, 0.002, glowCyan);
        addTaperedPrism(0.595,  0.044,  0.051, 0.003, 0.775, -0.012, -0.005, 0.0015, glowCore);
    });
    if (!tpl) return;
    window.DropTemplateCache.emit(tpl, p, uAxis, vAxis, wAxis, s, 0, vertices, colors, indices);
  };

  window.buildShirasayaModel = function(scale, basePos, axisAlong, edgeUp, thickRight, vertices, colors, indices) {
    const s = scale || 0.32;
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

    const tpl = window.DropTemplateCache.getOrBake("weapon_shirasaya", (tv, tc, ti) => {
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

        const gripDark = [0.09, 0.10, 0.13];
        const gripWrap = [0.16, 0.18, 0.22];
        const kashiraMetal = [0.28, 0.31, 0.36];
        const collarSteel = [0.36, 0.40, 0.46];
        const obsidianBody = [0.10, 0.11, 0.15];
        const spineSteel = [0.24, 0.28, 0.34];
        const glowCyan = [0.22, 0.95, 0.88];
        const glowCore = [0.64, 1.00, 0.97];

        addBox(pt(-0.415, 0.006, 0), 0.032, 0.062, 0.042, kashiraMetal, u0, v0, w0, tv, tc, ti);
        addBox(pt(-0.12, 0.006, 0), 0.56, 0.058, 0.038, gripDark, u0, v0, w0, tv, tc, ti);
        for (let i = 0; i < 10; i++) {
          const rx = -0.365 + i * 0.052;
          addBox(pt(rx, 0.006, 0), 0.024, 0.064, 0.042, gripWrap, u0, v0, w0, tv, tc, ti);
        }

        addBox(pt(0.185, 0.008, 0), 0.050, 0.072, 0.044, collarSteel, u0, v0, w0, tv, tc, ti);
        addBox(pt(0.220, 0.008, 0), 0.022, 0.068, 0.042, glowCyan, u0, v0, w0, tv, tc, ti);

        const segs = [
          { a0: 0.23, u0:  0.000, t0: 0.016, a1: 0.58, u1: -0.012, t1: 0.014 },
          { a0: 0.58, u0: -0.012, t0: 0.014, a1: 0.94, u1: -0.034, t1: 0.012 },
          { a0: 0.94, u0: -0.034, t0: 0.012, a1: 1.28, u1: -0.064, t1: 0.009 }
        ];
        for (let i = 0; i < segs.length; i++) {
          const sg = segs[i];
          addTaperedPrism(sg.a0, -0.024 + sg.u0, -0.005 + sg.u0, sg.t0, sg.a1, -0.022 + sg.u1, -0.005 + sg.u1, sg.t1, spineSteel);
          addTaperedPrism(sg.a0, -0.005 + sg.u0,  0.032 + sg.u0, sg.t0 * 0.9, sg.a1, -0.005 + sg.u1,  0.028 + sg.u1, sg.t1 * 0.9, obsidianBody);
          addTaperedPrism(sg.a0,  0.032 + sg.u0,  0.044 + sg.u0, sg.t0 * 0.5, sg.a1,  0.028 + sg.u1,  0.040 + sg.u1, sg.t1 * 0.5, glowCyan);
          addTaperedPrism(sg.a0,  0.042 + sg.u0,  0.048 + sg.u0, sg.t0 * 0.25, sg.a1,  0.038 + sg.u1,  0.044 + sg.u1, sg.t1 * 0.25, glowCore);
        }

        addBox(pt(0.39, 0.002, 0), 0.220, 0.006, 0.032, glowCyan, u0, v0, w0, tv, tc, ti);
        addBox(pt(0.72, -0.018, 0), 0.160, 0.005, 0.026, glowCyan, u0, v0, w0, tv, tc, ti);

        addTaperedPrism(1.28, -0.022 - 0.064, -0.005 - 0.064, 0.009, 1.48, -0.022 - 0.088, -0.014 - 0.088, 0.0025, spineSteel);
        addTaperedPrism(1.28, -0.005 - 0.064,  0.028 - 0.064, 0.008, 1.48, -0.020 - 0.088, -0.011 - 0.088, 0.002, obsidianBody);
        addTaperedPrism(1.28,  0.028 - 0.064,  0.040 - 0.064, 0.0045, 1.48, -0.017 - 0.088, -0.008 - 0.088, 0.0015, glowCyan);
        addTaperedPrism(1.28,  0.038 - 0.064,  0.044 - 0.064, 0.0025, 1.48, -0.014 - 0.088, -0.006 - 0.088, 0.001, glowCore);
    });
    if (!tpl) return;
    window.DropTemplateCache.emit(tpl, p, uAxis, vAxis, wAxis, s, 0, vertices, colors, indices);
  };

  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["tanto"] = {
    render: function(item, vertices, colors, indices, targetBuffer) {
      const isIcon = (targetBuffer === "preview" || (item && item.isIconPreview));
      const s = isIcon ? 1.0 : ((item && item.size) ? item.size * 2.4 : 0.45);
      const p = (item && item.position) ? item.position : [0, 0, 0];
      const r = (item && item.R) ? item.R : [1, 0, 0];
      const n = (item && item.normal) ? item.normal : [0, 1, 0];
      const f = (item && item.F) ? item.F : [0, 0, 1];
      if (isIcon) {
        // Slight 22-deg diagonal tilt so blade, circuit trace, and guard pop in 3D inventory cards
        const ax = [r[0] * 0.37 + n[0] * 0.93, r[1] * 0.37 + n[1] * 0.93, r[2] * 0.37 + n[2] * 0.93];
        const ed = [r[0] * 0.93 - n[0] * 0.37, r[1] * 0.93 - n[1] * 0.37, r[2] * 0.93 - n[2] * 0.37];
        window.buildTantoModel(s, p, ax, ed, f, vertices, colors, indices);
      } else {
        // World drop: lay blade flat along R with cutting edge along F and thickness vertical along normal
        window.buildTantoModel(s, p, r, f, n, vertices, colors, indices);
      }
    }
  };
  window.ItemRegistry["TANTO"] = window.ItemRegistry["tanto"];
})();
