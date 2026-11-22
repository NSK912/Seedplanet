// === SEEDPLANET MODULE: JS/ITEMS/WOOD_WINDOW.JS ===

window.ItemRegistry = window.ItemRegistry || {};

(function() {
  function drawBoxFallback(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices) {
    if (typeof window !== "undefined" && typeof window.addBox === "function" && window.addBox !== drawBoxFallback) {
      window.addBox(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices);
      return;
    }
    const hw = w / 2, hh = h / 2, hd = d / 2;
    let r = right, u = up, f = forward;
    let isFlipped = false;
    if (r && u && f) {
      const det = (r[1]*u[2] - r[2]*u[1])*f[0] + (r[2]*u[0] - r[0]*u[2])*f[1] + (r[0]*u[1] - r[1]*u[0])*f[2];
      if (det < 0) isFlipped = true;
    }
    const cubeVerts = [
      [-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd],
      [-hw, hh, -hd], [hw, hh, -hd], [hw, hh, hd], [-hw, hh, hd]
    ];
    const baseIdx = outVertices.length / 3;
    for (let i = 0; i < 8; i++) {
      const v = cubeVerts[i];
      const rx = r[0]*v[0] + u[0]*v[1] + f[0]*v[2];
      const ry = r[1]*v[0] + u[1]*v[1] + f[1]*v[2];
      const rz = r[2]*v[0] + u[2]*v[1] + f[2]*v[2];
      outVertices.push(center[0] + rx, center[1] + ry, center[2] + rz);
      outColors.push(color[0], color[1], color[2]);
    }
    const cubeIndices = isFlipped ? [
      0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6,
      0, 5, 1, 0, 4, 5, 2, 7, 3, 2, 6, 7,
      0, 3, 7, 0, 7, 4, 1, 6, 2, 1, 5, 6
    ] : [
      0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,
      0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6,
      0, 7, 3, 0, 4, 7, 1, 2, 6, 1, 6, 5
    ];
    for (let i = 0; i < cubeIndices.length; i++) {
      outIndices.push(baseIdx + cubeIndices[i]);
    }
  }

  let _woodWindowTemplateCache = null;

  function _getWoodWindowTemplates() {
    if (_woodWindowTemplateCache) return _woodWindowTemplateCache;

    const box = (typeof addBox === "function") ? addBox : drawBoxFallback;
    const localR = [1, 0, 0];
    const localN = [0, 1, 0];
    const localF = [0, 0, 1];

    const frameMult = [0.55, 0.4, 0.4];
    const casingMult = [0.5, 0.35, 0.3];
    const shutterMult = [0.85, 0.85, 0.85];
    const darkAccentMult = [0.5, 0.35, 0.3];
    const oneMult = [1.0, 1.0, 1.0];

    const frameDepth = 0.032;
    const casingThick = 0.004;

    // 1) Static Outer Frame + Casing (13 boxes in local (wallR, n, wallF) space relative to p)
    const fv = [], fcMult = [], fidx = [];
    box([0.0, 0.080, 0.0], 0.210, 0.016, 0.040, frameMult, localR, localN, localF, fv, fcMult, fidx);
    box([0.0, 0.173, 0.0], 0.184, 0.016, frameDepth, frameMult, localR, localN, localF, fv, fcMult, fidx);
    box([-0.084, 0.1265, 0.0], 0.016, 0.077, frameDepth, frameMult, localR, localN, localF, fv, fcMult, fidx);
    box([0.084, 0.1265, 0.0], 0.016, 0.077, frameDepth, frameMult, localR, localN, localF, fv, fcMult, fidx);
    box([0.0, 0.1265, 0.0], 0.012, 0.077, 0.028, frameMult, localR, localN, localF, fv, fcMult, fidx);

    // Front Casing (+0.017)
    box([-0.092, 0.1265, 0.017], 0.018, 0.088, casingThick, casingMult, localR, localN, localF, fv, fcMult, fidx);
    box([0.092, 0.1265, 0.017], 0.018, 0.088, casingThick, casingMult, localR, localN, localF, fv, fcMult, fidx);
    box([0.0, 0.177, 0.017], 0.208, 0.018, casingThick, casingMult, localR, localN, localF, fv, fcMult, fidx);
    box([0.0, 0.068, 0.017], 0.208, 0.012, casingThick, casingMult, localR, localN, localF, fv, fcMult, fidx);

    // Back Casing (-0.017)
    box([-0.092, 0.1265, -0.017], 0.018, 0.088, casingThick, casingMult, localR, localN, localF, fv, fcMult, fidx);
    box([0.092, 0.1265, -0.017], 0.018, 0.088, casingThick, casingMult, localR, localN, localF, fv, fcMult, fidx);
    box([0.0, 0.177, -0.017], 0.208, 0.018, casingThick, casingMult, localR, localN, localF, fv, fcMult, fidx);
    box([0.0, 0.068, -0.017], 0.208, 0.012, casingThick, casingMult, localR, localN, localF, fv, fcMult, fidx);

    // 2) Preview Full Template (13 frame boxes + 5 preview pane/divider boxes = 18 boxes in (wallR, n, wallF) space)
    const pv = Array.from(fv);
    const pcMult = new Float32Array(fv.length);
    for (let i = 0; i < pcMult.length; i++) pcMult[i] = 1.0;
    const pidx = Array.from(fidx);
    const pcDummy = [];
    const prevThick = 0.028;
    box([-0.041, 0.1265, 0.0], 0.074, 0.076, prevThick, oneMult, localR, localN, localF, pv, pcDummy, pidx);
    box([0.041, 0.1265, 0.0], 0.074, 0.076, prevThick, oneMult, localR, localN, localF, pv, pcDummy, pidx);
    box([0.0, 0.1265, 0.0], 0.158, 0.008, 0.030, oneMult, localR, localN, localF, pv, pcDummy, pidx);
    box([-0.041, 0.1265, 0.0], 0.006, 0.076, 0.030, oneMult, localR, localN, localF, pv, pcDummy, pidx);
    box([0.041, 0.1265, 0.0], 0.006, 0.076, 0.030, oneMult, localR, localN, localF, pv, pcDummy, pidx);

    // 3) Left Shutter wood (2 boxes in (R_left, n, F_left) relative to leftHinge = p - wallR * 0.076 + n * 0.1265)
    const lsv = [], lscMult = [], lsidx = [];
    box([0.038, 0.0, 0.0], 0.076, 0.075, 0.016, shutterMult, localR, localN, localF, lsv, lscMult, lsidx);
    box([0.038, 0.0, 0.0], 0.060, 0.058, 0.018, darkAccentMult, localR, localN, localF, lsv, lscMult, lsidx);

    // 4) Right Shutter wood (2 boxes in (R_right, n, F_right) relative to rightHinge = p + wallR * 0.076 + n * 0.1265)
    const rsv = [], rscMult = [], rsidx = [];
    box([-0.038, 0.0, 0.0], 0.076, 0.075, 0.016, shutterMult, localR, localN, localF, rsv, rscMult, rsidx);
    box([-0.038, 0.0, 0.0], 0.060, 0.058, 0.018, darkAccentMult, localR, localN, localF, rsv, rscMult, rsidx);

    // 5) Left & Right Brass Handles (fixed color [0.85, 0.75, 0.25])
    const handleColor = [0.85, 0.75, 0.25];
    const lhv = [], lhc = [], lhidx = [];
    box([0.068, 0.0, 0.012], 0.006, 0.015, 0.008, handleColor, localR, localN, localF, lhv, lhc, lhidx);

    const rhv = [], rhc = [], rhidx = [];
    box([-0.068, 0.0, 0.012], 0.006, 0.015, 0.008, handleColor, localR, localN, localF, rhv, rhc, rhidx);

    _woodWindowTemplateCache = {
      frame: {
        v: new Float32Array(fv),
        cMult: new Float32Array(fcMult),
        idx: new Uint16Array(fidx)
      },
      previewFull: {
        v: new Float32Array(pv),
        idx: new Uint16Array(pidx)
      },
      leftShutter: {
        v: new Float32Array(lsv),
        cMult: new Float32Array(lscMult),
        idx: new Uint16Array(lsidx)
      },
      rightShutter: {
        v: new Float32Array(rsv),
        cMult: new Float32Array(rscMult),
        idx: new Uint16Array(rsidx)
      },
      leftHandle: {
        v: new Float32Array(lhv),
        c: new Float32Array(lhc),
        idx: new Uint16Array(lhidx)
      },
      rightHandle: {
        v: new Float32Array(rhv),
        c: new Float32Array(rhc),
        idx: new Uint16Array(rhidx)
      }
    };
    return _woodWindowTemplateCache;
  }

  const renderWindow = function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const r = item.R, f = item.F, n = item.normal;

    const angle = item.angle || 0.0;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const wallR0 = r[0] * cosA + f[0] * sinA;
    const wallR1 = r[1] * cosA + f[1] * sinA;
    const wallR2 = r[2] * cosA + f[2] * sinA;

    const wallF0 = f[0] * cosA - r[0] * sinA;
    const wallF1 = f[1] * cosA - r[1] * sinA;
    const wallF2 = f[2] * cosA - r[2] * sinA;

    const n0 = n[0], n1 = n[1], n2 = n[2];
    const p0 = p[0], p1 = p[1], p2 = p[2];
    const det = (wallR1 * n2 - wallR2 * n1) * wallF0 + (wallR2 * n0 - wallR0 * n2) * wallF1 + (wallR0 * n1 - wallR1 * n0) * wallF2;
    const isFlipped = det < 0;

    const isValid = item.isValidPlacement !== false;
    const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    const baseColor = item.isPreview ? previewColor : (item.color || [0.65, 0.45, 0.25]);
    const rCol = baseColor[0];
    const gCol = baseColor[1];
    const bCol = baseColor[2];

    const tpl = _getWoodWindowTemplates();

    function pushIdx(baseVertIdx, idxArr) {
      if (isFlipped) {
        for (let i = 0, len = idxArr.length; i < len; i += 3) {
          indices.push(baseVertIdx + idxArr[i], baseVertIdx + idxArr[i + 2], baseVertIdx + idxArr[i + 1]);
        }
      } else {
        for (let i = 0, len = idxArr.length; i < len; i++) {
          indices.push(baseVertIdx + idxArr[i]);
        }
      }
    }

    if (item.isPreview) {
      // Transform all 18 preview boxes in one pass
      const baseVertIdx = vertices.length / 3;
      const pv = tpl.previewFull.v;
      const pidx = tpl.previewFull.idx;

      for (let i = 0, len = pv.length; i < len; i += 3) {
        const lx = pv[i], ly = pv[i + 1], lz = pv[i + 2];
        vertices.push(
          p0 + lx * wallR0 + ly * n0 + lz * wallF0,
          p1 + lx * wallR1 + ly * n1 + lz * wallF1,
          p2 + lx * wallR2 + ly * n2 + lz * wallF2
        );
        colors.push(rCol, gCol, bCol);
      }
      pushIdx(baseVertIdx, pidx);
      return;
    }

    // 1) Transform Static Outer Frame + Casing (13 boxes)
    {
      const baseVertIdx = vertices.length / 3;
      const fv = tpl.frame.v;
      const fcMult = tpl.frame.cMult;
      const fidx = tpl.frame.idx;

      for (let i = 0, len = fv.length; i < len; i += 3) {
        const lx = fv[i], ly = fv[i + 1], lz = fv[i + 2];
        vertices.push(
          p0 + lx * wallR0 + ly * n0 + lz * wallF0,
          p1 + lx * wallR1 + ly * n1 + lz * wallF1,
          p2 + lx * wallR2 + ly * n2 + lz * wallF2
        );
        colors.push(
          rCol * fcMult[i],
          gCol * fcMult[i + 1],
          bCol * fcMult[i + 2]
        );
      }
      pushIdx(baseVertIdx, fidx);
    }

    // 2) Swingable Wooden Shutters + Brass Handles
    const A = item.windowAngle || 0.0;
    const cosW = Math.cos(A);
    const sinW = Math.sin(A);

    // Left Shutter hinge & axes
    const lh0 = p0 - wallR0 * 0.076 + n0 * 0.1265;
    const lh1 = p1 - wallR1 * 0.076 + n1 * 0.1265;
    const lh2 = p2 - wallR2 * 0.076 + n2 * 0.1265;

    const R_left0 = wallR0 * cosW + wallF0 * sinW;
    const R_left1 = wallR1 * cosW + wallF1 * sinW;
    const R_left2 = wallR2 * cosW + wallF2 * sinW;

    const F_left0 = wallF0 * cosW - wallR0 * sinW;
    const F_left1 = wallF1 * cosW - wallR1 * sinW;
    const F_left2 = wallF2 * cosW - wallR2 * sinW;

    {
      const baseVertIdx = vertices.length / 3;
      const lsv = tpl.leftShutter.v;
      const lscMult = tpl.leftShutter.cMult;
      const lsidx = tpl.leftShutter.idx;

      for (let i = 0, len = lsv.length; i < len; i += 3) {
        const lx = lsv[i], ly = lsv[i + 1], lz = lsv[i + 2];
        vertices.push(
          lh0 + lx * R_left0 + ly * n0 + lz * F_left0,
          lh1 + lx * R_left1 + ly * n1 + lz * F_left1,
          lh2 + lx * R_left2 + ly * n2 + lz * F_left2
        );
        colors.push(
          rCol * lscMult[i],
          gCol * lscMult[i + 1],
          bCol * lscMult[i + 2]
        );
      }
      pushIdx(baseVertIdx, lsidx);
    }

    // Right Shutter hinge & axes
    const rh0 = p0 + wallR0 * 0.076 + n0 * 0.1265;
    const rh1 = p1 + wallR1 * 0.076 + n1 * 0.1265;
    const rh2 = p2 + wallR2 * 0.076 + n2 * 0.1265;

    const R_right0 = wallR0 * cosW - wallF0 * sinW;
    const R_right1 = wallR1 * cosW - wallF1 * sinW;
    const R_right2 = wallR2 * cosW - wallF2 * sinW;

    const F_right0 = wallF0 * cosW + wallR0 * sinW;
    const F_right1 = wallF1 * cosW + wallR1 * sinW;
    const F_right2 = wallF2 * cosW + wallR2 * sinW;

    {
      const baseVertIdx = vertices.length / 3;
      const rsv = tpl.rightShutter.v;
      const rscMult = tpl.rightShutter.cMult;
      const rsidx = tpl.rightShutter.idx;

      for (let i = 0, len = rsv.length; i < len; i += 3) {
        const lx = rsv[i], ly = rsv[i + 1], lz = rsv[i + 2];
        vertices.push(
          rh0 + lx * R_right0 + ly * n0 + lz * F_right0,
          rh1 + lx * R_right1 + ly * n1 + lz * F_right1,
          rh2 + lx * R_right2 + ly * n2 + lz * F_right2
        );
        colors.push(
          rCol * rscMult[i],
          gCol * rscMult[i + 1],
          bCol * rscMult[i + 2]
        );
      }
      pushIdx(baseVertIdx, rsidx);
    }

    // Left Handle
    {
      const baseVertIdx = vertices.length / 3;
      const lhv = tpl.leftHandle.v;
      const lhc = tpl.leftHandle.c;
      const lhidx = tpl.leftHandle.idx;

      for (let i = 0, len = lhv.length; i < len; i += 3) {
        const lx = lhv[i], ly = lhv[i + 1], lz = lhv[i + 2];
        vertices.push(
          lh0 + lx * R_left0 + ly * n0 + lz * F_left0,
          lh1 + lx * R_left1 + ly * n1 + lz * F_left1,
          lh2 + lx * R_left2 + ly * n2 + lz * F_left2
        );
        colors.push(lhc[i], lhc[i + 1], lhc[i + 2]);
      }
      pushIdx(baseVertIdx, lhidx);
    }

    // Right Handle
    {
      const baseVertIdx = vertices.length / 3;
      const rhv = tpl.rightHandle.v;
      const rhc = tpl.rightHandle.c;
      const rhidx = tpl.rightHandle.idx;

      for (let i = 0, len = rhv.length; i < len; i += 3) {
        const lx = rhv[i], ly = rhv[i + 1], lz = rhv[i + 2];
        vertices.push(
          rh0 + lx * R_right0 + ly * n0 + lz * F_right0,
          rh1 + lx * R_right1 + ly * n1 + lz * F_right1,
          rh2 + lx * R_right2 + ly * n2 + lz * F_right2
        );
        colors.push(rhc[i], rhc[i + 1], rhc[i + 2]);
      }
      pushIdx(baseVertIdx, rhidx);
    }
  };

  window.ItemRegistry["wood_window"] = {
    render: renderWindow
  };
})();
