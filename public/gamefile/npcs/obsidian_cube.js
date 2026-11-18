// === SEEDPLANET MODULE: JS/NPCS/OBSIDIAN_CUBE.JS ===
// Gilded Obsidian Monolith / Black Gold Floating Diamond Cube (ศิลาออบซิเดียนลายทองคำ)
// Inspired by black obsidian marble with rich glowing Kintsugi gold veins,
// oriented as a diamond square standing on its vertex, gently floating in the air.
// Fully immune to arrow attacks!

(function() {
  // Shared Rigid Local-Space Templates (Built once and reused by ALL Obsidian Cubes & Items)
  let _monolithTemplate = null;
  let _coreTemplate = null;
  let _shardTemplate = null;

  function buildRigidTemplates() {
    if (_monolithTemplate && _coreTemplate && _shardTemplate) return;

    const colObsidianDark  = [0.03, 0.03, 0.04];
    const colObsidianMid   = [0.08, 0.08, 0.10];
    const colObsidianSheen = [0.14, 0.14, 0.17];
    const colGoldBright    = [1.00, 0.88, 0.28];
    const colGoldDeep      = [0.88, 0.68, 0.14];
    const colGoldGlow      = [1.00, 0.95, 0.60];
    const colGoldAccent    = [0.96, 0.76, 0.20];

    const makeBuilder = () => {
      const pos = [];
      const col = [];
      const ind = [];
      const addQuad = (p0, p1, p2, p3, c) => {
        const idx = pos.length / 3;
        pos.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2]);
        for (let i = 0; i < 4; i++) col.push(c[0], c[1], c[2]);
        ind.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
        ind.push(idx, idx + 2, idx + 1, idx, idx + 3, idx + 2);
      };
      const addTri = (p0, p1, p2, c) => {
        const idx = pos.length / 3;
        pos.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
        for (let i = 0; i < 3; i++) col.push(c[0], c[1], c[2]);
        ind.push(idx, idx + 1, idx + 2);
        ind.push(idx, idx + 2, idx + 1);
      };
      return {
        addQuad,
        addTri,
        finish: () => ({
          positions: new Float32Array(pos),
          colors: new Float32Array(col),
          indices: new Uint16Array(ind),
          vertexCount: pos.length / 3
        })
      };
    };

    // 1. Main Diamond Monolith + Kintsugi Veins + Corner Brackets + Finials
    const m = makeBuilder();
    const H = 0.92;
    const W = 0.72;
    const eqList = [[W, 0, 0], [0, 0, W], [-W, 0, 0], [0, 0, -W]];
    const topApex = [0.0, H, 0.0];
    const btmApex = [0.0, -H, 0.0];

    for (let i = 0; i < 4; i++) {
      const pA = eqList[i];
      const pB = eqList[(i + 1) % 4];
      const midEdge = [(pA[0] + pB[0]) * 0.5, 0.0, (pA[2] + pB[2]) * 0.5];
      const midTop = [(pA[0] + pB[0]) * 0.35, H * 0.42, (pA[2] + pB[2]) * 0.35];
      const midBtm = [(pA[0] + pB[0]) * 0.35, -H * 0.42, (pA[2] + pB[2]) * 0.35];

      m.addTri(topApex, pA, midTop, i % 2 === 0 ? colObsidianDark : colObsidianMid);
      m.addTri(topApex, midTop, pB, (i % 2 === 1) ? colObsidianSheen : colObsidianDark);
      m.addTri(pA, midEdge, midTop, colObsidianMid);
      m.addTri(midEdge, pB, midTop, colObsidianDark);

      m.addTri(btmApex, midBtm, pA, (i % 2 === 0) ? colObsidianSheen : colObsidianDark);
      m.addTri(btmApex, pB, midBtm, colObsidianDark);
      m.addTri(pA, midBtm, midEdge, colObsidianDark);
      m.addTri(midEdge, midBtm, pB, colObsidianMid);

      const veinW = 0.024;
      m.addTri(topApex, [midTop[0] * 1.01, midTop[1], midTop[2] * 1.01], [midTop[0] * 1.01 + veinW, midTop[1] - veinW, midTop[2] * 1.01], colGoldBright);
      m.addTri(btmApex, [midBtm[0] * 1.01, midBtm[1], midBtm[2] * 1.01], [midBtm[0] * 1.01 - veinW, midBtm[1] + veinW, midBtm[2] * 1.01], colGoldBright);

      m.addQuad(
        [pA[0] * 1.01, -0.018, pA[2] * 1.01],
        [pB[0] * 1.01, -0.018, pB[2] * 1.01],
        [pB[0] * 1.01,  0.018, pB[2] * 1.01],
        [pA[0] * 1.01,  0.018, pA[2] * 1.01],
        colGoldDeep
      );
    }

    const capSize = 0.09;
    for (let i = 0; i < 4; i++) {
      const cp = eqList[i];
      const dirX = Math.sign(cp[0]);
      const dirZ = Math.sign(cp[2]);
      const cOuter = [cp[0] + dirX * 0.035, 0.0, cp[2] + dirZ * 0.035];
      const cTop   = [cp[0] * 0.85,  capSize, cp[2] * 0.85];
      const cBtm   = [cp[0] * 0.85, -capSize, cp[2] * 0.85];
      const cLeft  = [cp[0] * 0.85 - dirZ * capSize, 0.0, cp[2] * 0.85 + dirX * capSize];
      const cRight = [cp[0] * 0.85 + dirZ * capSize, 0.0, cp[2] * 0.85 - dirX * capSize];

      m.addTri(cOuter, cTop, cLeft, colGoldBright);
      m.addTri(cOuter, cRight, cTop, colGoldBright);
      m.addTri(cOuter, cBtm, cRight, colGoldDeep);
      m.addTri(cOuter, cLeft, cBtm, colGoldDeep);
    }

    const finialH = 0.08;
    const finialW = 0.05;
    m.addTri([0, H + finialH, 0], [-finialW, H - 0.03, -finialW], [ finialW, H - 0.03, -finialW], colGoldGlow);
    m.addTri([0, H + finialH, 0], [ finialW, H - 0.03, -finialW], [ finialW, H - 0.03,  finialW], colGoldBright);
    m.addTri([0, H + finialH, 0], [ finialW, H - 0.03,  finialW], [-finialW, H - 0.03,  finialW], colGoldGlow);
    m.addTri([0, H + finialH, 0], [-finialW, H - 0.03,  finialW], [-finialW, H - 0.03, -finialW], colGoldBright);

    m.addTri([0, -H - finialH, 0], [ finialW, -H + 0.03, -finialW], [-finialW, -H + 0.03, -finialW], colGoldDeep);
    m.addTri([0, -H - finialH, 0], [ finialW, -H + 0.03,  finialW], [ finialW, -H + 0.03, -finialW], colGoldBright);
    m.addTri([0, -H - finialH, 0], [-finialW, -H + 0.03,  finialW], [ finialW, -H + 0.03,  finialW], colGoldDeep);
    m.addTri([0, -H - finialH, 0], [-finialW, -H + 0.03, -finialW], [-finialW, -H + 0.03,  finialW], colGoldBright);
    _monolithTemplate = m.finish();

    // 2. Unit Inner Core Octahedron Template (scaled by corePulse at emit time)
    const c = makeBuilder();
    const cT = [0,  1, 0], cB = [0, -1, 0];
    const c0 = [1, 0, 0], c1 = [0, 0, 1], c2 = [-1, 0, 0], c3 = [0, 0, -1];
    c.addTri(cT, c0, c1, colGoldGlow);
    c.addTri(cT, c1, c2, colGoldBright);
    c.addTri(cT, c2, c3, colGoldGlow);
    c.addTri(cT, c3, c0, colGoldBright);
    c.addTri(cB, c1, c0, colGoldDeep);
    c.addTri(cB, c2, c1, colGoldAccent);
    c.addTri(cB, c3, c2, colGoldDeep);
    c.addTri(cB, c0, c3, colGoldAccent);
    _coreTemplate = c.finish();

    // 3. Unit Satellite Shard Template (centered at [0,0,0])
    const s = makeBuilder();
    const shW = 0.08, shH = 0.13;
    const shTop = [0, shH, 0], shBtm = [0, -shH, 0];
    const shE0 = [shW, 0, 0], shE1 = [0, 0, shW], shE2 = [-shW, 0, 0], shE3 = [0, 0, -shW];
    s.addTri(shTop, shE0, shE1, colObsidianDark);
    s.addTri(shTop, shE1, shE2, colGoldBright);
    s.addTri(shTop, shE2, shE3, colObsidianDark);
    s.addTri(shTop, shE3, shE0, colGoldBright);
    s.addTri(shBtm, shE1, shE0, colGoldDeep);
    s.addTri(shBtm, shE2, shE1, colObsidianDark);
    s.addTri(shBtm, shE3, shE2, colGoldDeep);
    s.addTri(shBtm, shE0, shE3, colObsidianDark);
    _shardTemplate = s.finish();
  }

  window.buildObsidianCubeModel = function(
    seed,
    animPhase,
    isRagdoll,
    isSwimming,
    scaleMultiplier,
    pos,
    R,
    N,
    F,
    vertices,
    colors,
    indices,
    overrideColors = null,
    f = null,
    transformPoint = null,
    c = null
  ) {
    buildRigidTemplates();

    const scale = 0.42 * (scaleMultiplier || 1.0);
    const phase = animPhase || 0;
    const lodLevel = (c && typeof c.lodLevel === "number") ? c.lodLevel : 0;
    const isLod1 = lodLevel >= 1;

    const levitateY = isRagdoll ? -0.25 : Math.sin(phase * 2.2) * 0.08;
    const spinAngle = isRagdoll ? 0 : phase * 0.65;
    const cosS = Math.cos(spinAngle);
    const sinS = Math.sin(spinAngle);
    const tiltX = isRagdoll ? 0.35 : Math.sin(phase * 1.3) * 0.06;
    const tiltZ = isRagdoll ? 0.15 : Math.cos(phase * 1.7) * 0.06;

    // Precompute local-to-rig matrix coefficients matching the tilt + spin + levitation transform
    const tx_y = tiltX * tiltZ;
    const m00 = cosS * scale;
    const m01 = (tx_y * cosS - tiltX * sinS) * scale;
    const m02 = (tiltZ * cosS - sinS) * scale;

    const m11 = 1.0 * scale;
    const m12 = -tiltX * scale;
    const offY = levitateY * scale;

    const m20 = sinS * scale;
    const m21 = (tx_y * sinS + tiltX * cosS) * scale;
    const m22 = (tiltZ * sinS + cosS) * scale;

    const hasCustomTransform = !!transformPoint;
    const basePos = (pos && Array.isArray(pos) && pos.length >= 3) ? pos : ((c && c.position) || [0, 0, 0]);
    const bx = basePos[0], by = basePos[1], bz = basePos[2];
    const rx0 = R[0], rx1 = R[1], rx2 = R[2];
    const nx0 = N[0], nx1 = N[1], nx2 = N[2];
    const fx0 = F[0], fx1 = F[1], fx2 = F[2];

    const emitTemplate = (tpl, ox, oy, oz, localScale) => {
      const baseIdx = vertices.length / 3;
      const tPos = tpl.positions;
      const tCol = tpl.colors;
      const tInd = tpl.indices;
      const vLen = tPos.length;

      for (let i = 0; i < vLen; i += 3) {
        const x = tPos[i] * localScale + ox;
        const y = tPos[i + 1] * localScale + oy;
        const z = tPos[i + 2] * localScale + oz;

        const lx = m00 * x + m01 * y + m02 * z;
        const ly = m11 * y + m12 * z + offY;
        const lz = m20 * x + m21 * y + m22 * z;

        if (hasCustomTransform) {
          const wp = transformPoint(lx, ly, lz);
          vertices.push(wp[0], wp[1], wp[2]);
        } else {
          vertices.push(
            bx + lx * rx0 + ly * nx0 + lz * fx0,
            by + lx * rx1 + ly * nx1 + lz * fx1,
            bz + lx * rx2 + ly * nx2 + lz * fx2
          );
        }

        if (overrideColors) {
          colors.push(overrideColors[0], overrideColors[1], overrideColors[2]);
        } else {
          colors.push(tCol[i], tCol[i + 1], tCol[i + 2]);
        }
      }

      for (let i = 0; i < tInd.length; i++) {
        indices.push(baseIdx + tInd[i]);
      }
    };

    // 1. Main Cached Diamond Monolith
    emitTemplate(_monolithTemplate, 0, 0, 0, 1.0);

    // 2. Inner Radiant Golden Core (LOD 0 only)
    if (!isLod1) {
      const corePulse = 0.16 + Math.sin(phase * 4.0) * 0.025;
      emitTemplate(_coreTemplate, 0, 0, 0, corePulse);
    }

    // 3. Satellite Shards (4 at LOD 0, 2 at LOD 1)
    const orbitRadius = 1.15;
    const shardStep = isLod1 ? 2 : 1;
    for (let s = 0; s < 4; s += shardStep) {
      const sAngle = phase * 1.4 + (s * Math.PI * 0.5);
      const sBob = Math.sin(phase * 3.0 + s * 1.5) * 0.12;
      emitTemplate(_shardTemplate, Math.cos(sAngle) * orbitRadius, sBob, Math.sin(sAngle) * orbitRadius, 1.0);
    }
  };

  // Register in Global NPC Registry
  window.NpcRegistry = window.NpcRegistry || {};
  window.NpcRegistry["obsidian_cube"] = {
    maxHp: 6,
    immuneToArrows: true,
    name: "ศิลาออบซิเดียนลายทอง (Gilded Obsidian Cube)",
    icon: "🔶",
    moveSpeed: 0.25,
    disableRandomJitter: false,

    // Smooth floating navigation behavior using standard NPC movement system
    updateBehavior: function(c, deltaTime, seed, gRadius, wRadius, npcCaveData) {
      if (c.ragdollEnabled || (c.hp !== undefined && c.hp <= 0)) {
        const baseR = Math.max(gRadius, wRadius);
        c.r = baseR + 0.12;
        return;
      }

      if (c.animPhase === undefined) c.animPhase = Math.random() * Math.PI * 2;
      c.animPhase += deltaTime * 1.6;

      // Keep NPC hovering serenely above ground or water
      const baseR = Math.max(gRadius, wRadius);
      let targetR = baseR + 1.25 + Math.sin(c.animPhase * 2.0) * 0.22;

      // If inside cave, limit height below ceiling
      if (npcCaveData && npcCaveData.insideTunnel && npcCaveData.ceiling !== Infinity) {
        targetR = Math.min(targetR, npcCaveData.ceiling - 0.35);
      }

      // Smooth vertical lerp
      if (c.r === undefined) c.r = targetR;
      c.r += (targetR - c.r) * Math.min(1.0, deltaTime * 3.5);

      c.isSwimming = false;
    },

    render: function(c, allVertices, allColors, allIndices, scale, N, R, F, pos, f, transformPoint, seed) {
      window.buildObsidianCubeModel(
        c.seed !== undefined ? c.seed : seed,
        c.animPhase,
        c.ragdollEnabled,
        false,
        1.0,
        pos,
        R,
        N,
        F,
        allVertices,
        allColors,
        allIndices,
        null,
        f,
        transformPoint,
        c
      );
    }
  };

  console.log("🔶 Obsidian Cube NPC Module Initialized: Gilded Obsidian Monolith Loaded");
})();
