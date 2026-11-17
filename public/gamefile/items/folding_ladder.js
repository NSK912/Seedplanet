// === SEEDPLANET MODULE: JS/ITEMS/FOLDING_LADDER.JS ===
// Death Stranding style Extendable Folding Ladder (บันไดพับ)

(function() {
  function drawBox(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices) {
    if (typeof addBox === "function") {
      addBox(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices);
      return;
    }
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;
    let r = right || [1, 0, 0];
    let u = up || [0, 1, 0];
    let f = forward || [0, 0, 1];
    let isFlipped = false;

    const det = (r[1] * u[2] - r[2] * u[1]) * f[0] + (r[2] * u[0] - r[0] * u[2]) * f[1] + (r[0] * u[1] - r[1] * u[0]) * f[2];
    if (det < 0) {
      isFlipped = true;
    }

    const cubeVerts = [
      [-hw, -hh, -hd],
      [hw, -hh, -hd],
      [hw, -hh, hd],
      [-hw, -hh, hd],
      [-hw, hh, -hd],
      [hw, hh, -hd],
      [hw, hh, hd],
      [-hw, hh, hd],
    ];

    const cubeIndices = isFlipped ? [
      0, 1, 2, 0, 2, 3,
      4, 6, 5, 4, 7, 6,
      0, 5, 1, 0, 4, 5,
      2, 7, 3, 2, 6, 7,
      0, 3, 7, 0, 7, 4,
      1, 6, 2, 1, 5, 6
    ] : [
      0, 2, 1, 0, 3, 2,
      4, 5, 6, 4, 6, 7,
      0, 1, 5, 0, 5, 4,
      2, 3, 7, 2, 7, 6,
      0, 7, 3, 0, 4, 7,
      1, 2, 6, 1, 6, 5,
    ];

    const baseIdx = outVertices.length / 3;
    for (let i = 0; i < 8; i++) {
      const v = cubeVerts[i];
      const rx = r[0] * v[0] + u[0] * v[1] + f[0] * v[2];
      const ry = r[1] * v[0] + u[1] * v[1] + f[1] * v[2];
      const rz = r[2] * v[0] + u[2] * v[1] + f[2] * v[2];
      outVertices.push(center[0] + rx, center[1] + ry, center[2] + rz);
      outColors.push(color[0], color[1], color[2]);
    }

    for (let i = 0; i < cubeIndices.length; i++) {
      outIndices.push(baseIdx + cubeIndices[i]);
    }
  }

  // Local-space template cache keyed by (lenBucket, mode)
  // mode: 0 = placed, 1 = valid preview, 2 = invalid preview
  const _foldingLadderTemplateCache = new Map();

  function _getFoldingLadderTemplate(lenBucket, mode) {
    const key = (lenBucket << 2) | mode;
    let tpl = _foldingLadderTemplateCache.get(key);
    if (tpl) return tpl;

    const len_v = lenBucket / 50.0;
    const isPreview = mode !== 0;
    const previewCol = mode === 1 ? [0.2, 0.85, 1.0] : [1.0, 0.25, 0.25];

    const railColor = isPreview ? previewCol : [0.38, 0.40, 0.44];
    const rungColor = isPreview ? previewCol : [0.72, 0.75, 0.78];
    const jointColor = isPreview ? previewCol : [0.18, 0.20, 0.22];
    const accentColor = isPreview ? previewCol : [0.98, 0.65, 0.08];
    const footColor = isPreview ? previewCol : [0.15, 0.16, 0.17];

    const ladderWidth = 0.38;
    const railThick = 0.022;
    const railDepth = 0.045;
    const halfW = ladderWidth * 0.45;

    const LR = [1, 0, 0], LU = [0, 1, 0], LF = [0, 0, 1];
    const tVerts = [], tCols = [], tInds = [];

    // 1. Left & Right Side Rails (centered at z = len_v * 0.5)
    drawBox([-halfW, 0, len_v * 0.5], railThick, railDepth, len_v, railColor, LR, LU, LF, tVerts, tCols, tInds);
    drawBox([ halfW, 0, len_v * 0.5], railThick, railDepth, len_v, railColor, LR, LU, LF, tVerts, tCols, tInds);

    // 2. Foldable Telescopic Joint Sleeves & Latch Hinges
    const numJoints = Math.max(1, Math.min(3, Math.floor(len_v / 1.0)));
    for (let j = 1; j <= numJoints; j++) {
      const jz = len_v * (j / (numJoints + 1));
      drawBox([-halfW, 0, jz], railThick * 1.5, railDepth * 1.25, 0.045, jointColor, LR, LU, LF, tVerts, tCols, tInds);
      drawBox([ halfW, 0, jz], railThick * 1.5, railDepth * 1.25, 0.045, jointColor, LR, LU, LF, tVerts, tCols, tInds);
    }

    // 3. Heavy-duty Rungs
    const rungSpacing = 0.18;
    const numRungs = Math.max(2, Math.floor(len_v / rungSpacing));
    const rungWidth = ladderWidth - railThick * 1.8;
    const rungH = 0.016;
    const rungD = 0.024;

    for (let i = 0; i <= numRungs; i++) {
      const t = i / numRungs;
      const clampedT = 0.04 + t * 0.92;
      const isHazardRung = (i % 3 === 0);
      drawBox([0, 0, len_v * clampedT], rungWidth, rungH, rungD, isHazardRung ? accentColor : rungColor, LR, LU, LF, tVerts, tCols, tInds);
    }

    // 4. Top Cliff / Ledge Anchor Clamp (Head at z = len_v)
    const topHookLength = 0.07;
    drawBox([-halfW, 0, len_v], railThick * 1.4, 0.025, topHookLength, jointColor, LR, LU, LF, tVerts, tCols, tInds);
    drawBox([ halfW, 0, len_v], railThick * 1.4, 0.025, topHookLength, jointColor, LR, LU, LF, tVerts, tCols, tInds);
    drawBox([0, 0, len_v], ladderWidth, 0.018, 0.025, jointColor, LR, LU, LF, tVerts, tCols, tInds);

    // 5. Bottom Terrain Stabilizer Base Pads (Tail at z = 0)
    const footW = 0.06, footH = 0.022, footD = 0.07;
    drawBox([-halfW, 0, 0], footW, footH, footD, footColor, LR, LU, LF, tVerts, tCols, tInds);
    drawBox([ halfW, 0, 0], footW, footH, footD, footColor, LR, LU, LF, tVerts, tCols, tInds);

    tpl = {
      verts: new Float32Array(tVerts),
      cols: new Float32Array(tCols),
      inds: new Uint16Array(tInds),
      vertCount: tVerts.length / 3
    };
    _foldingLadderTemplateCache.set(key, tpl);
    return tpl;
  }

  window.ItemRegistry = window.ItemRegistry || {};

  window.ItemRegistry["folding_ladder"] = {
    render: function(item, vertices, colors, indices, targetBuffer) {
      const p = item.position || [0, 0, 0];
      const r = item.R || [1, 0, 0];
      const f = item.F || [0, 0, 1];
      const n = item.normal || [0, 1, 0];

      let P_top = item.stairTop;
      let P_bottom = item.stairBottom;

      if (!P_top || !P_bottom) {
        P_top = [p[0] + f[0] * 1.0, p[1] + f[1] * 1.0, p[2] + f[2] * 1.0];
        P_bottom = [p[0] - f[0] * 1.0, p[1] - f[1] * 1.0, p[2] - f[2] * 1.0];
      }

      const dvx = P_top[0] - P_bottom[0];
      const dvy = P_top[1] - P_bottom[1];
      const dvz = P_top[2] - P_bottom[2];
      const len_v = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz) || 1;
      const invLen = 1.0 / len_v;
      const dux = dvx * invLen, duy = dvy * invLen, duz = dvz * invLen;

      // N_ladder is normal pointing out from the ladder plane (N = dir_un x r)
      let nlx = duy * r[2] - duz * r[1];
      let nly = duz * r[0] - dux * r[2];
      let nlz = dux * r[1] - duy * r[0];
      let lenN = Math.sqrt(nlx * nlx + nly * nly + nlz * nlz);
      if (lenN < 0.001) {
        const dotNDir = n[0] * dux + n[1] * duy + n[2] * duz;
        nlx = n[0] - dux * dotNDir;
        nly = n[1] - duy * dotNDir;
        nlz = n[2] - duz * dotNDir;
        lenN = Math.hypot(nlx, nly, nlz) || 1;
      }
      nlx /= lenN; nly /= lenN; nlz /= lenN;

      // Align N_ladder to face outward from planet center
      if (nlx * n[0] + nly * n[1] + nlz * n[2] < 0) {
        nlx = -nlx; nly = -nly; nlz = -nlz;
      }

      // Re-orthogonalize ladderR = N_ladder x dir_un
      let lrx = nly * duz - nlz * duy;
      let lry = nlz * dux - nlx * duz;
      let lrz = nlx * duy - nly * dux;
      const lenR = Math.sqrt(lrx * lrx + lry * lry + lrz * lrz) || 1;
      lrx /= lenR; lry /= lenR; lrz /= lenR;

      const isPreview = item.isPreview === true;
      const isValid = item.isValidPlacement !== false;
      const mode = isPreview ? (isValid ? 1 : 2) : 0;

      const lenBucket = Math.max(5, Math.round(len_v * 50));
      const tpl = _getFoldingLadderTemplate(lenBucket, mode);
      const tVerts = tpl.verts;
      const tCols = tpl.cols;
      const tInds = tpl.inds;
      const vCount = tpl.vertCount;
      const baseIdx = vertices.length / 3;

      const pbx = P_bottom[0], pby = P_bottom[1], pbz = P_bottom[2];
      const det = (lry * nlz - lrz * nly) * dux + (lrz * nlx - lrx * nlz) * duy + (lrx * nly - lry * nlx) * duz;
      const isFlipped = det < 0;

      for (let i = 0; i < vCount; i++) {
        const vi = i * 3;
        const lx = tVerts[vi], ly = tVerts[vi + 1], lz = tVerts[vi + 2];
        vertices.push(
          pbx + lrx * lx + nlx * ly + dux * lz,
          pby + lry * lx + nly * ly + duy * lz,
          pbz + lrz * lx + nlz * ly + duz * lz
        );
        colors.push(tCols[vi], tCols[vi + 1], tCols[vi + 2]);
      }

      const iLen = tInds.length;
      if (isFlipped) {
        for (let i = 0; i < iLen; i += 3) {
          indices.push(baseIdx + tInds[i], baseIdx + tInds[i + 2], baseIdx + tInds[i + 1]);
        }
      } else {
        for (let i = 0; i < iLen; i++) {
          indices.push(baseIdx + tInds[i]);
        }
      }
    }
  };
})();
