// === SEEDPLANET MODULE: ENVIRONMENT/CROWN_FLOWER.JS ===

(function (global) {
  "use strict";

  // สร้างช่อดอกรัก (Crown Flower Cluster - Calotropis gigantea) ตามภาพเรฟ
  function buildCrownFlowerCluster(
    center,
    dirVec,
    clusterRadius,
    seedVal,
    swayWeight,
    vertices,
    colors,
    indices,
    isPreviewMode
  ) {
    let curSeed = seedVal;
    function cfRand() {
      const x = Math.sin(curSeed++) * 10000;
      return x - Math.floor(x);
    }

    const encodeFn = typeof global.encodeTreeColor === "function" ? global.encodeTreeColor : null;
    const taperFn = typeof global.buildTaperedSegment === "function" ? global.buildTaperedSegment : null;

    const dirLen = Math.sqrt(dirVec[0] * dirVec[0] + dirVec[1] * dirVec[1] + dirVec[2] * dirVec[2]) || 1;
    const D = [dirVec[0] / dirLen, dirVec[1] / dirLen, dirVec[2] / dirLen];

    let ax = [0, 1, 0];
    if (Math.abs(D[1]) > 0.85) ax = [1, 0, 0];
    let b1x = D[1] * ax[2] - D[2] * ax[1];
    let b1y = D[2] * ax[0] - D[0] * ax[2];
    let b1z = D[0] * ax[1] - D[1] * ax[0];
    const lenB1 = Math.sqrt(b1x * b1x + b1y * b1y + b1z * b1z) || 1;
    const B1 = [b1x / lenB1, b1y / lenB1, b1z / lenB1];
    const B2 = [
      D[1] * B1[2] - D[2] * B1[1],
      D[2] * B1[0] - D[0] * B1[2],
      D[0] * B1[1] - D[1] * B1[0]
    ];

    function encCF(col, isLeafFlag) {
      return (encodeFn && !isPreviewMode)
        ? encodeFn(col, isLeafFlag, swayWeight)
        : col;
    }

    // Helper: 1 ดอกรักรูปมงกุฎ 5 กลีบสีขาวอมม่วงอ่อน + แกนมงกุฎสีม่วงลาเวนเดอร์อ่อนตรงกลาง
    function addSingleCrownFloret(fPos, fUp, floretR) {
      const uLen = Math.sqrt(fUp[0] * fUp[0] + fUp[1] * fUp[1] + fUp[2] * fUp[2]) || 1;
      const U = [fUp[0] / uLen, fUp[1] / uLen, fUp[2] / uLen];
      let ref = Math.abs(U[1]) > 0.85 ? [1, 0, 0] : [0, 1, 0];
      let rx = U[1] * ref[2] - U[2] * ref[1];
      let ry = U[2] * ref[0] - U[0] * ref[2];
      let rz = U[0] * ref[1] - U[1] * ref[0];
      const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
      const R1 = [rx / rLen, ry / rLen, rz / rLen];
      const R2 = [
        U[1] * R1[2] - U[2] * R1[1],
        U[2] * R1[0] - U[0] * R1[2],
        U[0] * R1[1] - U[1] * R1[0]
      ];

      const petalCol = encCF([0.96, 0.96, 0.98], false);
      const crownCol = encCF([0.80, 0.72, 0.92], false);
      const rotOff = cfRand() * Math.PI * 2;

      // 5 กลีบดอก (Corolla lobes) แผ่ออกรอบฐาน
      for (let p = 0; p < 5; p++) {
        const ang = rotOff + (p / 5) * Math.PI * 2;
        const cA = Math.cos(ang);
        const sA = Math.sin(ang);
        const outDir = [
          cA * R1[0] + sA * R2[0],
          cA * R1[1] + sA * R2[1],
          cA * R1[2] + sA * R2[2]
        ];
        const tanDir = [
          -sA * R1[0] + cA * R2[0],
          -sA * R1[1] + cA * R2[1],
          -sA * R1[2] + cA * R2[2]
        ];

        const pBase = [
          fPos[0] + outDir[0] * (floretR * 0.14),
          fPos[1] + outDir[1] * (floretR * 0.14),
          fPos[2] + outDir[2] * (floretR * 0.14)
        ];
        const pLeft = [
          fPos[0] + outDir[0] * (floretR * 0.56) - tanDir[0] * (floretR * 0.30) + U[0] * (floretR * 0.10),
          fPos[1] + outDir[1] * (floretR * 0.56) - tanDir[1] * (floretR * 0.30) + U[1] * (floretR * 0.10),
          fPos[2] + outDir[2] * (floretR * 0.56) - tanDir[2] * (floretR * 0.30) + U[2] * (floretR * 0.10)
        ];
        const pRight = [
          fPos[0] + outDir[0] * (floretR * 0.56) + tanDir[0] * (floretR * 0.30) + U[0] * (floretR * 0.10),
          fPos[1] + outDir[1] * (floretR * 0.56) + tanDir[1] * (floretR * 0.30) + U[1] * (floretR * 0.10),
          fPos[2] + outDir[2] * (floretR * 0.56) + tanDir[2] * (floretR * 0.30) + U[2] * (floretR * 0.10)
        ];
        const pTip = [
          fPos[0] + outDir[0] * floretR + U[0] * (floretR * 0.14),
          fPos[1] + outDir[1] * floretR + U[1] * (floretR * 0.14),
          fPos[2] + outDir[2] * floretR + U[2] * (floretR * 0.14)
        ];

        const vIdx = vertices.length / 3;
        vertices.push(
          pBase[0], pBase[1], pBase[2],
          pLeft[0], pLeft[1], pLeft[2],
          pRight[0], pRight[1], pRight[2],
          pTip[0], pTip[1], pTip[2]
        );
        for (let k = 0; k < 4; k++) {
          colors.push(petalCol[0], petalCol[1], petalCol[2]);
        }
        indices.push(
          vIdx, vIdx + 1, vIdx + 3,
          vIdx, vIdx + 3, vIdx + 2,
          vIdx, vIdx + 3, vIdx + 1,
          vIdx, vIdx + 2, vIdx + 3
        );
      }

      // มงกุฎตรงกลาง (Crown center) ทรงพีระมิดห้าเหลี่ยมสีขาวอมม่วงอ่อน
      const crR = floretR * 0.38;
      const crH = floretR * 0.42;
      const crApex = [
        fPos[0] + U[0] * crH,
        fPos[1] + U[1] * crH,
        fPos[2] + U[2] * crH
      ];
      const cIdx = vertices.length / 3;
      vertices.push(crApex[0], crApex[1], crApex[2]);
      colors.push(crownCol[0], crownCol[1], crownCol[2]);
      for (let p = 0; p < 5; p++) {
        const ang = rotOff + (p / 5) * Math.PI * 2;
        const px = fPos[0] + (Math.cos(ang) * R1[0] + Math.sin(ang) * R2[0]) * crR + U[0] * (floretR * 0.08);
        const py = fPos[1] + (Math.cos(ang) * R1[1] + Math.sin(ang) * R2[1]) * crR + U[1] * (floretR * 0.08);
        const pz = fPos[2] + (Math.cos(ang) * R1[2] + Math.sin(ang) * R2[2]) * crR + U[2] * (floretR * 0.08);
        vertices.push(px, py, pz);
        colors.push(crownCol[0], crownCol[1], crownCol[2]);
      }
      for (let p = 0; p < 5; p++) {
        const cur = cIdx + 1 + p;
        const nxt = cIdx + 1 + ((p + 1) % 5);
        indices.push(cIdx, nxt, cur);
      }
    }

    // Helper: ดอกตูมกลมรีสีขาวอมเขียวอ่อน (Flower bud)
    function addCrownBud(bPos, budR) {
      const budCol = encCF([0.84, 0.90, 0.80], false);
      const latSegs = 2;
      const lonSegs = 5;
      const bIdx = vertices.length / 3;
      for (let lat = 0; lat <= latSegs; lat++) {
        const theta = (lat / latSegs) * Math.PI;
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);
        for (let lon = 0; lon <= lonSegs; lon++) {
          const phi = (lon / lonSegs) * Math.PI * 2;
          const rx = sinT * Math.cos(phi);
          const rz = sinT * Math.sin(phi);
          const vx = bPos[0] + (rx * B1[0] + rz * B2[0] + cosT * D[0]) * budR;
          const vy = bPos[1] + (rx * B1[1] + rz * B2[1] + cosT * D[1]) * budR;
          const vz = bPos[2] + (rx * B1[2] + rz * B2[2] + cosT * D[2]) * budR;
          vertices.push(vx, vy, vz);
          colors.push(budCol[0], budCol[1], budCol[2]);
        }
      }
      for (let lat = 0; lat < latSegs; lat++) {
        for (let lon = 0; lon < lonSegs; lon++) {
          const a = bIdx + lat * (lonSegs + 1) + lon;
          const b = a + lonSegs + 1;
          const c = a + 1;
          const d = b + 1;
          indices.push(a, b, c, c, b, d);
        }
      }
    }

    // ก้านช่อดอกสั้น + ดอกรักบาน 4 ดอกและดอกตูม 2 ดอกจัดเป็นพวงกลมที่ปลายยอด
    const pedicelCol = [0.44, 0.60, 0.36];
    const floretCount = 4;
    const baseRot = cfRand() * Math.PI * 2;
    for (let f = 0; f < floretCount; f++) {
      const isTop = (f === 0);
      const ang = baseRot + (f / (floretCount - 1 || 1)) * Math.PI * 2;
      const spread = isTop ? 0.12 : (0.55 + cfRand() * 0.25);
      const fDirX = D[0] + (Math.cos(ang) * B1[0] + Math.sin(ang) * B2[0]) * spread;
      const fDirY = D[1] + (Math.cos(ang) * B1[1] + Math.sin(ang) * B2[1]) * spread;
      const fDirZ = D[2] + (Math.cos(ang) * B1[2] + Math.sin(ang) * B2[2]) * spread;
      const fLen = Math.sqrt(fDirX * fDirX + fDirY * fDirY + fDirZ * fDirZ) || 1;
      const fDir = [fDirX / fLen, fDirY / fLen, fDirZ / fLen];

      const stalkLen = clusterRadius * (isTop ? 0.85 : 0.72);
      const fPos = [
        center[0] + fDir[0] * stalkLen,
        center[1] + fDir[1] * stalkLen,
        center[2] + fDir[2] * stalkLen
      ];
      if (taperFn) {
        taperFn(
          center,
          fPos,
          clusterRadius * 0.08,
          clusterRadius * 0.05,
          3,
          pedicelCol,
          vertices,
          colors,
          indices,
          false,
          swayWeight * 0.9,
          swayWeight
        );
      }
      addSingleCrownFloret(fPos, fDir, clusterRadius * (isTop ? 0.56 : 0.48));
    }

    // ดอกตูมด้านข้าง 2 ดอก
    for (let b = 0; b < 2; b++) {
      const bAng = baseRot + 1.1 + b * Math.PI;
      const bDir = [
        D[0] * 0.6 + (Math.cos(bAng) * B1[0] + Math.sin(bAng) * B2[0]) * 0.7,
        D[1] * 0.6 + (Math.cos(bAng) * B1[1] + Math.sin(bAng) * B2[1]) * 0.7,
        D[2] * 0.6 + (Math.cos(bAng) * B1[2] + Math.sin(bAng) * B2[2]) * 0.7
      ];
      const bPos = [
        center[0] + bDir[0] * (clusterRadius * 0.58),
        center[1] + bDir[1] * (clusterRadius * 0.58),
        center[2] + bDir[2] * (clusterRadius * 0.58)
      ];
      addCrownBud(bPos, clusterRadius * 0.20);
    }
  }

  // สร้างพุ่มต้นรัก (Low-Poly Crown Flower Bush - Calotropis gigantea) ตามภาพเรฟ
  function buildCrownFlowerPlant(
    wx,
    wy,
    wz,
    nx,
    ny,
    nz,
    R,
    F,
    N,
    seed,
    vertices,
    colors,
    indices,
    isPreview,
    growthFactor,
    options
  ) {
    let curSeed = seed;
    function prng() {
      const x = Math.sin(curSeed++) * 10000;
      return x - Math.floor(x);
    }

    const encodeFn = typeof global.encodeTreeColor === "function" ? global.encodeTreeColor : null;
    const taperFn = typeof global.buildTaperedSegment === "function" ? global.buildTaperedSegment : null;

    const isPreviewMode = isPreview || (global._disableTreeColorEncoding === true);
    const gFactor = (typeof growthFactor === "number" && growthFactor > 0) ? growthFactor : 1.0;
    const hasFlowers = (options && options.hasFlowers !== undefined) ? !!options.hasFlowers : true;

    // พุ่มต้นรักสูงและแผ่กิ่งหลายลำขึ้นจากโคนต้น (ตามภาพเรฟ)
    const scale = (0.095 + prng() * 0.032) * 0.5 * gFactor;
    const baseRadius = scale * 0.16;
    const plantYaw = prng() * Math.PI * 2;

    // ลำต้นสีเขียวหม่นอมเทา (Pale Grey-Green Herbaceous Stems)
    const stemColor = [
      0.40 + prng() * 0.05,
      0.55 + prng() * 0.06,
      0.34 + prng() * 0.04
    ];
    // ใบทรงรีใหญ่หนาสีเขียวตอง/เขียวเทาอ่อน พร้อมใบโคนบางใบอมเหลืองเล็กน้อย
    const leafBaseColor = [
      0.22 + prng() * 0.05,
      0.52 + prng() * 0.07,
      0.23 + prng() * 0.04
    ];

    // Helper สร้างใบรักโลโพลีทรงไข่กลับ/รีมนกว้าง 6 จุด (Broad Obovate-Oval Opposite Leaf)
    function addCrownFlowerLeaf(origin, dirVec, leafSize, swayW, tintYellow) {
      let sx = dirVec[1] * N[2] - dirVec[2] * N[1];
      let sy = dirVec[2] * N[0] - dirVec[0] * N[2];
      let sz = dirVec[0] * N[1] - dirVec[1] * N[0];
      const lenS = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
      const L_side = [sx / lenS, sy / lenS, sz / lenS];
      const L_up = [
        dirVec[1] * L_side[2] - dirVec[2] * L_side[1],
        dirVec[2] * L_side[0] - dirVec[0] * L_side[2],
        dirVec[0] * L_side[1] - dirVec[1] * L_side[0]
      ];

      const leafLen = leafSize;
      const leafW = leafSize * 0.84; // ใบกว้างอวบมนตามภาพเรฟ
      const cup = leafSize * 0.12;

      const v0 = origin; // โคนใบติดข้อลำต้น
      const v1L = [
        origin[0] + dirVec[0] * (leafLen * 0.36) - L_side[0] * (leafW * 0.44) + L_up[0] * (cup * 0.7),
        origin[1] + dirVec[1] * (leafLen * 0.36) - L_side[1] * (leafW * 0.44) + L_up[1] * (cup * 0.7),
        origin[2] + dirVec[2] * (leafLen * 0.36) - L_side[2] * (leafW * 0.44) + L_up[2] * (cup * 0.7)
      ];
      const v1R = [
        origin[0] + dirVec[0] * (leafLen * 0.36) + L_side[0] * (leafW * 0.44) + L_up[0] * (cup * 0.7),
        origin[1] + dirVec[1] * (leafLen * 0.36) + L_side[1] * (leafW * 0.44) + L_up[1] * (cup * 0.7),
        origin[2] + dirVec[2] * (leafLen * 0.36) + L_side[2] * (leafW * 0.44) + L_up[2] * (cup * 0.7)
      ];
      const v2L = [
        origin[0] + dirVec[0] * (leafLen * 0.76) - L_side[0] * (leafW * 0.48) + L_up[0] * cup,
        origin[1] + dirVec[1] * (leafLen * 0.76) - L_side[1] * (leafW * 0.48) + L_up[1] * cup,
        origin[2] + dirVec[2] * (leafLen * 0.76) - L_side[2] * (leafW * 0.48) + L_up[2] * cup
      ];
      const v2R = [
        origin[0] + dirVec[0] * (leafLen * 0.76) + L_side[0] * (leafW * 0.48) + L_up[0] * cup,
        origin[1] + dirVec[1] * (leafLen * 0.76) + L_side[1] * (leafW * 0.48) + L_up[1] * cup,
        origin[2] + dirVec[2] * (leafLen * 0.76) + L_side[2] * (leafW * 0.48) + L_up[2] * cup
      ];
      const v3 = [
        origin[0] + dirVec[0] * leafLen + L_up[0] * (cup * 0.35),
        origin[1] + dirVec[1] * leafLen + L_up[1] * (cup * 0.35),
        origin[2] + dirVec[2] * leafLen + L_up[2] * (cup * 0.35)
      ];

      const shade = (prng() - 0.5) * 0.08;
      const col = tintYellow
        ? [0.62 + shade, 0.66 + shade, 0.22]
        : [
            Math.max(0.08, Math.min(0.9, leafBaseColor[0] + shade)),
            Math.max(0.20, Math.min(0.9, leafBaseColor[1] + shade)),
            Math.max(0.08, Math.min(0.9, leafBaseColor[2] + shade * 0.6))
          ];
      const enc = (encodeFn && !isPreviewMode)
        ? encodeFn(col, true, swayW)
        : col;

      const bIdx = vertices.length / 3;
      vertices.push(
        v0[0], v0[1], v0[2],
        v1L[0], v1L[1], v1L[2],
        v1R[0], v1R[1], v1R[2],
        v2L[0], v2L[1], v2L[2],
        v2R[0], v2R[1], v2R[2],
        v3[0], v3[1], v3[2]
      );
      for (let k = 0; k < 6; k++) {
        colors.push(enc[0], enc[1], enc[2]);
      }
      // Double-sided broad obovate leaf triangles
      indices.push(
        // Front
        bIdx, bIdx + 1, bIdx + 2,
        bIdx + 1, bIdx + 3, bIdx + 2,
        bIdx + 2, bIdx + 3, bIdx + 4,
        bIdx + 3, bIdx + 5, bIdx + 4,
        // Back
        bIdx, bIdx + 2, bIdx + 1,
        bIdx + 1, bIdx + 2, bIdx + 3,
        bIdx + 2, bIdx + 4, bIdx + 3,
        bIdx + 3, bIdx + 4, bIdx + 5
      );
    }

    // โคนพุ่มเตี้ย
    const crownRoot = [
      wx - N[0] * (scale * 0.08),
      wy - N[1] * (scale * 0.08),
      wz - N[2] * (scale * 0.08)
    ];

    // 4 ลำต้นหลักตั้งตรงแผ่เป็นพุ่ม (ตามภาพเรฟที่แตกกอหลายลำต้นสูงไล่เลี่ยกัน)
    const numStems = 4;
    const clusterBaseRadius = scale * (0.34 + prng() * 0.06);

    for (let s = 0; s < numStems; s++) {
      const isCenterTall = (s === 0);
      const sAng = plantYaw + (s / numStems) * Math.PI * 2 + (prng() - 0.5) * 0.45;
      const outLean = isCenterTall ? 0.14 : (0.38 + prng() * 0.24);
      const sHeight = scale * (isCenterTall ? (2.75 + prng() * 0.45) : (2.15 + prng() * 0.55));

      const sDirX = Math.cos(sAng) * outLean * R[0] + Math.sin(sAng) * outLean * F[0] + N[0];
      const sDirY = Math.cos(sAng) * outLean * R[1] + Math.sin(sAng) * outLean * F[1] + N[1];
      const sDirZ = Math.cos(sAng) * outLean * R[2] + Math.sin(sAng) * outLean * F[2] + N[2];
      const sLenN = Math.sqrt(sDirX * sDirX + sDirY * sDirY + sDirZ * sDirZ) || 1;
      const stemDir = [sDirX / sLenN, sDirY / sLenN, sDirZ / sLenN];

      const stemStart = [
        crownRoot[0] + (Math.cos(sAng) * R[0] + Math.sin(sAng) * F[0]) * (isCenterTall ? 0.0 : scale * 0.10),
        crownRoot[1] + (Math.cos(sAng) * R[1] + Math.sin(sAng) * F[1]) * (isCenterTall ? 0.0 : scale * 0.10),
        crownRoot[2] + (Math.cos(sAng) * R[2] + Math.sin(sAng) * F[2]) * (isCenterTall ? 0.0 : scale * 0.10)
      ];

      const numNodes = 4;
      const segPts = [stemStart];
      for (let nd = 1; nd <= numNodes; nd++) {
        const frac = nd / numNodes;
        // ค่อยๆ ตั้งตรงขึ้นช่วงปลายยอดตามธรรมชาติของต้นรัก
        const bendUp = frac * 0.22;
        const prev = segPts[nd - 1];
        const stepLen = sHeight / numNodes;
        const curDirX = stemDir[0] + N[0] * bendUp + (prng() - 0.5) * 0.08 * R[0];
        const curDirY = stemDir[1] + N[1] * bendUp + (prng() - 0.5) * 0.08 * R[1];
        const curDirZ = stemDir[2] + N[2] * bendUp + (prng() - 0.5) * 0.08 * R[2];
        const cLen = Math.sqrt(curDirX * curDirX + curDirY * curDirY + curDirZ * curDirZ) || 1;
        const nxt = [
          prev[0] + (curDirX / cLen) * stepLen,
          prev[1] + (curDirY / cLen) * stepLen,
          prev[2] + (curDirZ / cLen) * stepLen
        ];
        segPts.push(nxt);

        const r0 = baseRadius * (isCenterTall ? 0.85 : 0.72) * (1.0 - 0.45 * ((nd - 1) / numNodes));
        const r1 = baseRadius * (isCenterTall ? 0.85 : 0.72) * (1.0 - 0.45 * frac);
        const sway0 = ((nd - 1) / numNodes) * 0.32;
        const sway1 = frac * 0.32;
        if (taperFn) {
          taperFn(
            prev,
            nxt,
            r0,
            r1,
            4,
            stemColor,
            vertices,
            colors,
            indices,
            false,
            sway0,
            sway1
          );
        }

        // ใบคู่ตรงข้ามสลับฉาก 90° (Opposite Decussate Leaves) หนาแน่นตลอดลำต้น
        const pairYaw = sAng + nd * (Math.PI * 0.5);
        const leafS = scale * (nd === 1 ? 0.68 : (nd === numNodes ? 0.46 : 0.62));
        const upBias = 0.55 + frac * 0.35;
        for (let side = -1; side <= 1; side += 2) {
          const lAng = pairYaw + (side > 0 ? 0 : Math.PI);
          const ldx = Math.cos(lAng) * R[0] + Math.sin(lAng) * F[0] + upBias * N[0];
          const ldy = Math.cos(lAng) * R[1] + Math.sin(lAng) * F[1] + upBias * N[1];
          const ldz = Math.cos(lAng) * R[2] + Math.sin(lAng) * F[2] + upBias * N[2];
          const lLen = Math.sqrt(ldx * ldx + ldy * ldy + ldz * ldz) || 1;
          const isLowerYellow = (nd === 1 && side === 1 && prng() < 0.35);
          addCrownFlowerLeaf(
            nxt,
            [ldx / lLen, ldy / lLen, ldz / lLen],
            leafS,
            sway1,
            isLowerYellow
          );
        }
      }

      // ช่อดอกรักสีขาวอมม่วงอ่อนที่ปลายยอดของแต่ละลำต้น (สร้างเมื่อโตเต็มที่)
      if (hasFlowers) {
        const stemTip = segPts[numNodes];
        buildCrownFlowerCluster(
          stemTip,
          [stemDir[0] + N[0] * 0.35, stemDir[1] + N[1] * 0.35, stemDir[2] + N[2] * 0.35],
          clusterBaseRadius * (isCenterTall ? 1.05 : 0.90),
          curSeed + s * 67 + 19,
          0.34,
          vertices,
          colors,
          indices,
          isPreviewMode
        );
      }
    }
  }

  // ============================================
  // สร้างกลุ่มต้นรัก (CROWN FLOWER PLANT GROUPS)
  // - แยกออกมาเป็นกลุ่มของตัวเอง กระจายรอบๆ กลุ่มต้นไม้
  // - จำนวนกลุ่มของต้นรัก = จำนวนกลุ่มต้นนุ่น/ฝ้าย (targetCottonGroups)
  // - ใน 1 กลุ่มจะมีต้นรัก 1 ถึง 3 ต้น (โมเดลโลโพลี)
  // ============================================
  async function generateCrownFlowerGroups({
    seed,
    RADIUS,
    HEIGHT_SCALE,
    waterLevel,
    treeGroupCenters,
    treePositions,
    cottonGroupCenters,
    targetCrownFlowerGroups,
    natureObstacles,
    mulberry32,
    getVisualHeightOnSphere,
    getHeightOnSphere,
    isPositionInsideCave,
    checkYield
  }) {
    const rngFactory = typeof mulberry32 === "function" ? mulberry32 : global.mulberry32;
    const heightVisFn = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere : global.getVisualHeightOnSphere;
    const heightFn = typeof getHeightOnSphere === "function" ? getHeightOnSphere : global.getHeightOnSphere;
    const caveCheckFn = typeof isPositionInsideCave === "function" ? isPositionInsideCave : global.isPositionInsideCave;
    const yieldFn = typeof checkYield === "function" ? checkYield : async () => {};

    const numTreeGroups = Array.isArray(treeGroupCenters) ? treeGroupCenters.length : 0;
    const cottonCenters = Array.isArray(cottonGroupCenters) ? cottonGroupCenters : [];
    const targetGroups = typeof targetCrownFlowerGroups === "number"
      ? targetCrownFlowerGroups
      : (numTreeGroups > 0 ? Math.max(1, Math.floor(numTreeGroups / 2)) : 0);

    const crownFlowerGroupCenters = [];
    global.crownFlowerGroupCount = targetGroups;

    if (targetGroups > 0 && !global.DISABLE_ENVIRONMENT) {
      const minLandH = waterLevel * 0.15 + 0.02;
      const baseTreeGroupDist = Math.min(2.6, Math.max(1.5, RADIUS * 0.18));
      const baseTreeSingleDist = Math.min(1.6, Math.max(1.05, RADIUS * 0.12));
      const baseCottonSepDist = Math.min(2.0, Math.max(1.2, RADIUS * 0.15));
      const baseCrownSepDist = Math.min(2.2, Math.max(1.3, RADIUS * 0.16));

      for (let g = 0; g < targetGroups; g++) {
        await yieldFn();
        let chosenGroup = null;

        for (let attempt = 0; attempt < 90; attempt++) {
          const candRng = rngFactory(seed + 71237 + g * 5381 + attempt * 401);
          let cTheta, cPhi;

          if (numTreeGroups > 0 && attempt < 75) {
            // เลือกกลุ่มต้นไม้แล้วสุ่มวางเป็นกลุ่มรอบๆ กลุ่มต้นไม้ในรัศมีที่กำหนด
            const tgIdx = (g * 2 + attempt) % numTreeGroups;
            const anchorTreeGrp = treeGroupCenters[tgIdx];
            let aRx, aRy, aRz;
            if (Math.abs(anchorTreeGrp.ny) < 0.9) {
              aRx = -anchorTreeGrp.nz; aRy = 0; aRz = anchorTreeGrp.nx;
            } else {
              aRx = 1; aRy = 0; aRz = 0;
            }
            const lenAR = Math.sqrt(aRx * aRx + aRy * aRy + aRz * aRz) || 1;
            aRx /= lenAR; aRy /= lenAR; aRz /= lenAR;
            let aFx = aRy * anchorTreeGrp.nz - aRz * anchorTreeGrp.ny;
            let aFy = aRz * anchorTreeGrp.nx - aRx * anchorTreeGrp.nz;
            let aFz = aRx * anchorTreeGrp.ny - aRy * anchorTreeGrp.nx;
            const lenAF = Math.sqrt(aFx * aFx + aFy * aFy + aFz * aFz) || 1;
            aFx /= lenAF; aFy /= lenAF; aFz /= lenAF;

            const ringAng = candRng() * Math.PI * 2;
            const ringRad = baseTreeGroupDist * (1.05 + candRng() * 0.95);
            const rOx = Math.cos(ringAng) * ringRad;
            const rOz = Math.sin(ringAng) * ringRad;
            const rPx = anchorTreeGrp.wx + rOx * aRx + rOz * aFx;
            const rPy = anchorTreeGrp.wy + rOx * aRy + rOz * aFy;
            const rPz = anchorTreeGrp.wz + rOx * aRz + rOz * aFz;
            const rLen = Math.sqrt(rPx * rPx + rPy * rPy + rPz * rPz) || 1;
            cTheta = Math.acos(Math.max(-1.0, Math.min(1.0, rPy / rLen)));
            cPhi = Math.atan2(rPz / rLen, rPx / rLen);
          } else {
            const u = candRng();
            const v = candRng();
            cTheta = Math.acos(2 * u - 1);
            cPhi = 2 * Math.PI * v;
          }

          const cHeight = typeof heightVisFn === "function"
            ? heightVisFn(cTheta, cPhi, seed)
            : heightFn(cTheta, cPhi, seed);

          // ต้องอยู่บนบก และไม่สูงจนเป็นยอดเขาหิมะ
          if (cHeight < minLandH || cHeight > 1.48) continue;

          const cR = RADIUS + cHeight * HEIGHT_SCALE;
          const cNx = Math.sin(cTheta) * Math.cos(cPhi);
          const cNy = Math.cos(cTheta);
          const cNz = Math.sin(cTheta) * Math.sin(cPhi);
          const cWx = cR * cNx;
          const cWy = cR * cNy;
          const cWz = cR * cNz;

          if (typeof caveCheckFn === "function" && caveCheckFn(cWx, cWy, cWz, 0.45)) continue;

          const relax = attempt < 40 ? 1.0 : (attempt < 70 ? 0.72 : 0.48);
          const minTreeGrpSq = (baseTreeGroupDist * relax) * (baseTreeGroupDist * relax);
          const minTreePosSq = (baseTreeSingleDist * relax) * (baseTreeSingleDist * relax);
          const minCottonSepSq = (baseCottonSepDist * relax) * (baseCottonSepDist * relax);
          const minCrownSepSq = (baseCrownSepDist * relax) * (baseCrownSepDist * relax);

          let tooCloseToTreeGroup = false;
          for (let tg = 0; tg < treeGroupCenters.length; tg++) {
            const dx = cWx - treeGroupCenters[tg].wx;
            const dy = cWy - treeGroupCenters[tg].wy;
            const dz = cWz - treeGroupCenters[tg].wz;
            if (dx * dx + dy * dy + dz * dz < minTreeGrpSq) {
              tooCloseToTreeGroup = true;
              break;
            }
          }
          if (tooCloseToTreeGroup) continue;

          let tooCloseToTree = false;
          for (let tp = 0; tp < treePositions.length; tp++) {
            const tPos = treePositions[tp];
            if (tPos.wx !== undefined) {
              const dx = cWx - tPos.wx;
              const dy = cWy - tPos.wy;
              const dz = cWz - tPos.wz;
              if (dx * dx + dy * dy + dz * dz < minTreePosSq) {
                tooCloseToTree = true;
                break;
              }
            }
          }
          if (tooCloseToTree) continue;

          let tooCloseToCotton = false;
          for (let cg = 0; cg < cottonCenters.length; cg++) {
            const dx = cWx - cottonCenters[cg].wx;
            const dy = cWy - cottonCenters[cg].wy;
            const dz = cWz - cottonCenters[cg].wz;
            if (dx * dx + dy * dy + dz * dz < minCottonSepSq) {
              tooCloseToCotton = true;
              break;
            }
          }
          if (tooCloseToCotton) continue;

          let tooCloseToOtherCrown = false;
          for (let cfg = 0; cfg < crownFlowerGroupCenters.length; cfg++) {
            const dx = cWx - crownFlowerGroupCenters[cfg].wx;
            const dy = cWy - crownFlowerGroupCenters[cfg].wy;
            const dz = cWz - crownFlowerGroupCenters[cfg].wz;
            if (dx * dx + dy * dy + dz * dz < minCrownSepSq) {
              tooCloseToOtherCrown = true;
              break;
            }
          }
          if (tooCloseToOtherCrown) continue;

          chosenGroup = { wx: cWx, wy: cWy, wz: cWz, nx: cNx, ny: cNy, nz: cNz, theta: cTheta, phi: cPhi };
          break;
        }

        if (!chosenGroup) continue;
        crownFlowerGroupCenters.push(chosenGroup);

        let cRx, cRy, cRz;
        if (Math.abs(chosenGroup.ny) < 0.9) {
          cRx = -chosenGroup.nz; cRy = 0; cRz = chosenGroup.nx;
        } else {
          cRx = 1; cRy = 0; cRz = 0;
        }
        const lenCR = Math.sqrt(cRx * cRx + cRy * cRy + cRz * cRz) || 1;
        cRx /= lenCR; cRy /= lenCR; cRz /= lenCR;
        let cFx = cRy * chosenGroup.nz - cRz * chosenGroup.ny;
        let cFy = cRz * chosenGroup.nx - cRx * chosenGroup.nz;
        let cFz = cRx * chosenGroup.ny - cRy * chosenGroup.nx;
        const lenCF = Math.sqrt(cFx * cFx + cFy * cFy + cFz * cFz) || 1;
        cFx /= lenCF; cFy /= lenCF; cFz /= lenCF;

        const grpR = [cRx, cRy, cRz];
        const grpF = [cFx, cFy, cFz];

        // 1 กลุ่มจะมีต้นรัก 1 ถึง 3 ต้น (เหมือนต้นฝ้าย)
        const grpRng = rngFactory(seed + 93113 + g * 1931);
        const crownCountInGroup = 1 + Math.floor(grpRng() * 3);

        for (let cIdx = 0; cIdx < crownCountInGroup; cIdx++) {
          await yieldFn();
          const plantSeed = seed + 125000 + g * 100 + cIdx * 19;

          let offX = 0;
          let offZ = 0;
          if (crownCountInGroup > 1) {
            const ang = (cIdx / crownCountInGroup) * Math.PI * 2 + (grpRng() - 0.5) * 0.55;
            const rad = 0.26 + grpRng() * 0.36;
            offX = Math.cos(ang) * rad;
            offZ = Math.sin(ang) * rad;
          } else {
            offX = (grpRng() - 0.5) * 0.14;
            offZ = (grpRng() - 0.5) * 0.14;
          }

          const rawPx = chosenGroup.wx + offX * grpR[0] + offZ * grpF[0];
          const rawPy = chosenGroup.wy + offX * grpR[1] + offZ * grpF[1];
          const rawPz = chosenGroup.wz + offX * grpR[2] + offZ * grpF[2];
          const lenP = Math.sqrt(rawPx * rawPx + rawPy * rawPy + rawPz * rawPz) || 1;
          const pNx = rawPx / lenP;
          const pNy = rawPy / lenP;
          const pNz = rawPz / lenP;

          const pTheta = Math.acos(Math.max(-1.0, Math.min(1.0, pNy)));
          const pPhi = Math.atan2(pNz, pNx);
          const pH = typeof heightVisFn === "function"
            ? heightVisFn(pTheta, pPhi, seed)
            : heightFn(pTheta, pPhi, seed);
          if (pH < minLandH) continue;

          const pSurfR = RADIUS + pH * HEIGHT_SCALE;
          const pWx = pNx * pSurfR;
          const pWy = pNy * pSurfR;
          const pWz = pNz * pSurfR;

          if (typeof caveCheckFn === "function" && caveCheckFn(pWx, pWy, pWz, 0.30)) continue;

          let pRx, pRy, pRz;
          if (Math.abs(pNy) < 0.9) {
            pRx = -pNz; pRy = 0; pRz = pNx;
          } else {
            pRx = 1; pRy = 0; pRz = 0;
          }
          const lenPR = Math.sqrt(pRx * pRx + pRy * pRy + pRz * pRz) || 1;
          pRx /= lenPR; pRy /= lenPR; pRz /= lenPR;
          const pFx = pRy * pNz - pRz * pNy;
          const pFy = pRz * pNx - pRx * pNz;
          const pFz = pRx * pNy - pRy * pNx;
          const lenPF = Math.sqrt(pFx * pFx + pFy * pFy + pFz * pFz) || 1;
          const pRVec = [pRx, pRy, pRz];
          const pFVec = [pFx / lenPF, pFy / lenPF, pFz / lenPF];

          const crownId = 600000 + g * 10 + cIdx;
          const crownObj = {
            id: crownId,
            type: "crown_flower",
            groupId: g,
            layer: 0, // พุ่มต้นรักเดินผ่านได้และเก็บได้ทันที (ไม่มีระบบกันชน)
            noCollision: true,
            isPassable: true,
            normal: [pNx, pNy, pNz],
            position: [pWx, pWy, pWz],
            R: pRVec,
            F: pFVec,
            seed: plantSeed,
            radius: 0.0
          };
          if (Array.isArray(global.allDeterministicNatureObstacles)) {
            global.allDeterministicNatureObstacles.push(crownObj);
          }
          if (Array.isArray(natureObstacles)) {
            natureObstacles.push(crownObj);
          }
        }
      }
    }

    return { targetCrownFlowerGroups: targetGroups, crownFlowerGroupCenters };
  }

  global.buildCrownFlowerCluster = buildCrownFlowerCluster;
  global.buildCrownFlowerPlant = buildCrownFlowerPlant;
  global.generateCrownFlowerGroups = generateCrownFlowerGroups;
  global.CrownFlowerSystem = {
    buildCrownFlowerCluster,
    buildCrownFlowerPlant,
    generateCrownFlowerGroups
  };
})(typeof window !== "undefined" ? window : globalThis);
