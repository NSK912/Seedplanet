// === SEEDPLANET MODULE: ENVIRONMENT/COTTON_PLANT.JS ===

(function (global) {
  "use strict";

  // สร้างดอก/สมอฝ้ายโลโพลี (Low-Poly Cotton Boll & Calyx Bracts)
  function buildCottonBollCluster(
    center,
    dirNorm,
    bollRadius,
    seed,
    swayWeight,
    vertices,
    colors,
    indices,
    isPreview
  ) {
    let curSeed = seed;
    function cRand() {
      const x = Math.sin(curSeed++) * 10000;
      return x - Math.floor(x);
    }

    const encodeFn = typeof global.encodeTreeColor === "function" ? global.encodeTreeColor : null;
    const isPreviewMode = isPreview || (global._disableTreeColorEncoding === true);

    // สร้างกรอบพิกัดตั้งฉากกับทิศทางก้านดอก (dirNorm)
    let bx = 0, by = 0, bz = 0;
    if (Math.abs(dirNorm[1]) < 0.9) {
      bx = -dirNorm[2]; by = 0; bz = dirNorm[0];
    } else {
      bx = 1; by = 0; bz = 0;
    }
    const lenB = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
    const B1 = [bx / lenB, by / lenB, bz / lenB];
    const B2 = [
      dirNorm[1] * B1[2] - dirNorm[2] * B1[1],
      dirNorm[2] * B1[0] - dirNorm[0] * B1[2],
      dirNorm[0] * B1[1] - dirNorm[1] * B1[0]
    ];

    // Helper วาดก้อนปุยฝ้าย 3 มิตินูนฟู (Volumetric 3D Low-Poly Puff Sphere)
    // ใช้ latSegs=3 และ lonSegs=6 (หรือ 5 ในพรีวิว) พร้อมผูกเข้ากับแกนสัมผัส (B1, dirNorm, B2)
    // เพื่อให้เป็นก้อนทรงกลม 3D นูนฟูทุกมุมมอง ไม่แบนเป็นแผ่น 2D อีกต่อไป
    function addSwayLowPolyPuff(puffCenter, puffRad, latSegs, lonSegs, baseCol, noiseStr, puffSeed) {
      const baseIdx = vertices.length / 3;
      for (let lat = 0; lat <= latSegs; lat++) {
        const theta = (lat / latSegs) * Math.PI;
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);
        for (let lon = 0; lon <= lonSegs; lon++) {
          const phi = (lon / lonSegs) * Math.PI * 2;
          const dx = sinT * Math.cos(phi);
          const dy = cosT;
          const dz = sinT * Math.sin(phi);

          const nVal = Math.sin(dx * 3.8 + dy * 4.2 + puffSeed) * 0.14 + Math.cos(dz * 4.0 + puffSeed * 1.5) * 0.08;
          const defR = puffRad * (1.0 + nVal * noiseStr);

          // แปลงพิกัดเข้าสู่ระบบแกน 3D ท้องถิ่น (B1, dirNorm, B2) เพื่อสร้างความนูนฟูรอบทิศทาง 3 มิติอย่างแท้จริง
          const vx = puffCenter[0] + defR * (dx * B1[0] + dy * dirNorm[0] + dz * B2[0]);
          const vy = puffCenter[1] + defR * (dx * B1[1] + dy * dirNorm[1] + dz * B2[1]);
          const vz = puffCenter[2] + defR * (dx * B1[2] + dy * dirNorm[2] + dz * B2[2]);
          vertices.push(vx, vy, vz);

          const shade = (dx * 0.12 + dy * 0.22 + dz * 0.12) * 0.08;
          const rawCol = [
            Math.max(0.85, Math.min(1.0, baseCol[0] + shade)),
            Math.max(0.85, Math.min(1.0, baseCol[1] + shade)),
            Math.max(0.82, Math.min(0.99, baseCol[2] + shade))
          ];
          const enc = (encodeFn && !isPreviewMode)
            ? encodeFn(rawCol, false, swayWeight)
            : rawCol;
          colors.push(enc[0], enc[1], enc[2]);
        }
      }
      for (let lat = 0; lat < latSegs; lat++) {
        for (let lon = 0; lon < lonSegs; lon++) {
          const a = baseIdx + lat * (lonSegs + 1) + lon;
          const b = a + lonSegs + 1;
          const c = a + 1;
          const d = b + 1;
          indices.push(a, b, c);
          indices.push(c, b, d);
        }
      }
    }

    // 1. กลีบเลี้ยง/เปลือกสมอฝ้ายแห้งที่อ้าออก (Calyx Bracts / Husk) 4 แฉกใต้ปุยฝ้าย
    const numBracts = 4;
    const bractBase = [
      center[0] - dirNorm[0] * (bollRadius * 0.28),
      center[1] - dirNorm[1] * (bollRadius * 0.28),
      center[2] - dirNorm[2] * (bollRadius * 0.28)
    ];
    for (let k = 0; k < numBracts; k++) {
      const ang = (k / numBracts) * Math.PI * 2 + cRand() * 0.25;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      const radOut = [
        cosA * B1[0] + sinA * B2[0],
        cosA * B1[1] + sinA * B2[1],
        cosA * B1[2] + sinA * B2[2]
      ];
      const sideTan = [
        -sinA * B1[0] + cosA * B2[0],
        -sinA * B1[1] + cosA * B2[1],
        -sinA * B1[2] + cosA * B2[2]
      ];

      const bractLen = bollRadius * 1.05;
      const bractW = bollRadius * 0.42;
      const v0 = bractBase;
      const v1 = [
        bractBase[0] + radOut[0] * (bractLen * 0.55) + dirNorm[0] * (bollRadius * 0.12) - sideTan[0] * bractW,
        bractBase[1] + radOut[1] * (bractLen * 0.55) + dirNorm[1] * (bollRadius * 0.12) - sideTan[1] * bractW,
        bractBase[2] + radOut[2] * (bractLen * 0.55) + dirNorm[2] * (bollRadius * 0.12) - sideTan[2] * bractW
      ];
      const v2 = [
        bractBase[0] + radOut[0] * (bractLen * 0.55) + dirNorm[0] * (bollRadius * 0.12) + sideTan[0] * bractW,
        bractBase[1] + radOut[1] * (bractLen * 0.55) + dirNorm[1] * (bollRadius * 0.12) + sideTan[0] * bractW,
        bractBase[2] + radOut[2] * (bractLen * 0.55) + dirNorm[2] * (bollRadius * 0.12) + sideTan[2] * bractW
      ];
      const v3 = [
        bractBase[0] + radOut[0] * bractLen + dirNorm[0] * (bollRadius * 0.40),
        bractBase[1] + radOut[1] * bractLen + dirNorm[0] * (bollRadius * 0.40),
        bractBase[2] + radOut[2] * bractLen + dirNorm[2] * (bollRadius * 0.40)
      ];

      const bractCol = (k % 2 === 0) ? [0.34, 0.25, 0.15] : [0.26, 0.36, 0.16];
      const encBract = (encodeFn && !isPreviewMode)
        ? encodeFn(bractCol, false, swayWeight)
        : bractCol;

      const bIdx = vertices.length / 3;
      vertices.push(v0[0], v0[1], v0[2], v1[0], v1[1], v1[2], v2[0], v2[1], v2[2], v3[0], v3[1], v3[2]);
      colors.push(
        encBract[0], encBract[1], encBract[2],
        encBract[0], encBract[1], encBract[2],
        encBract[0], encBract[1], encBract[2],
        encBract[0], encBract[1], encBract[2]
      );
      indices.push(
        bIdx, bIdx + 1, bIdx + 3,
        bIdx, bIdx + 3, bIdx + 2,
        bIdx, bIdx + 3, bIdx + 1,
        bIdx, bIdx + 2, bIdx + 3
      );
    }

    // 2. ก้อนปุยฝ้ายสีขาวฟูทรง 3D โลโพลี (Volumetric 3D Fluffy White Cotton Boll)
    // ใช้โครงสร้างโมเดลทรงกลม 3D นูนฟูแบบเดียวกัน 100% ทั้งบนแมพและในไอคอน
    const whiteCoreCol = [0.98, 0.98, 0.96];
    addSwayLowPolyPuff(
      [
        center[0] + dirNorm[0] * (bollRadius * 0.38),
        center[1] + dirNorm[1] * (bollRadius * 0.38),
        center[2] + dirNorm[2] * (bollRadius * 0.38)
      ],
      bollRadius * 1.05,
      3,
      6,
      whiteCoreCol,
      0.20,
      curSeed++
    );
  }

  // สร้างต้นฝ้ายโลโพลี (Low-Poly Cotton Plant)
  function buildCottonPlant(
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
    const hasBolls = (options && options.hasBolls !== undefined) ? !!options.hasBolls : true;

    // สัดส่วนพุ่มต้นฝ้ายโลโพลี
    const scale = (0.085 + prng() * 0.032) * 0.5 * gFactor;
    const stemHeight = scale * (2.2 + prng() * 0.7);
    const baseRadius = scale * 0.14;
    const plantYaw = prng() * Math.PI * 2;

    const stemColor = [
      0.35 + prng() * 0.05,
      0.24 + prng() * 0.04,
      0.14 + prng() * 0.03
    ];
    const leafBaseColor = [
      0.14 + prng() * 0.05,
      0.46 + prng() * 0.08,
      0.16 + prng() * 0.04
    ];

    // Helper สร้างใบฝ้ายโลโพลี
    function addCottonLeaf(origin, dirVec, leafSize, swayW) {
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
      const leafW = leafSize * 0.72;
      const arch = leafSize * 0.14;

      const v0 = origin;
      const v1 = [
        origin[0] + dirVec[0] * (leafLen * 0.45) - L_side[0] * (leafW * 0.5) + L_up[0] * arch,
        origin[1] + dirVec[1] * (leafLen * 0.45) - L_side[1] * (leafW * 0.5) + L_up[1] * arch,
        origin[2] + dirVec[2] * (leafLen * 0.45) - L_side[2] * (leafW * 0.5) + L_up[2] * arch
      ];
      const v2 = [
        origin[0] + dirVec[0] * (leafLen * 0.45) + L_side[0] * (leafW * 0.5) + L_up[0] * arch,
        origin[1] + dirVec[1] * (leafLen * 0.45) + L_side[1] * (leafW * 0.5) + L_up[1] * arch,
        origin[2] + dirVec[2] * (leafLen * 0.45) + L_side[2] * (leafW * 0.5) + L_up[2] * arch
      ];
      const v3 = [
        origin[0] + dirVec[0] * leafLen - L_up[0] * (arch * 0.3),
        origin[1] + dirVec[1] * leafLen - L_up[1] * (arch * 0.3),
        origin[2] + dirVec[2] * leafLen - L_up[2] * (arch * 0.3)
      ];

      const shade = (prng() - 0.5) * 0.10;
      const col = [
        Math.max(0.05, Math.min(0.9, leafBaseColor[0] + shade)),
        Math.max(0.15, Math.min(0.9, leafBaseColor[1] + shade)),
        Math.max(0.05, Math.min(0.9, leafBaseColor[2] + shade * 0.5))
      ];
      const enc = encodeFn ? encodeFn(col, true, swayW) : col;

      const bIdx = vertices.length / 3;
      vertices.push(v0[0], v0[1], v0[2], v1[0], v1[1], v1[2], v2[0], v2[1], v2[2], v3[0], v3[1], v3[2]);
      colors.push(
        enc[0], enc[1], enc[2],
        enc[0], enc[1], enc[2],
        enc[0], enc[1], enc[2],
        enc[0], enc[1], enc[2]
      );
      indices.push(
        bIdx, bIdx + 1, bIdx + 3,
        bIdx, bIdx + 3, bIdx + 2,
        bIdx, bIdx + 3, bIdx + 1,
        bIdx, bIdx + 2, bIdx + 3
      );
    }

    // 1. สร้างลำต้นหลักของต้นฝ้าย (Main Stem - 3 ข้อปล้อง)
    const numStemSegs = 3;
    const stemPts = [[wx - N[0] * (scale * 0.08), wy - N[1] * (scale * 0.08), wz - N[2] * (scale * 0.08)]];
    for (let s = 1; s <= numStemSegs; s++) {
      const bendR = (prng() - 0.5) * 0.14 * scale;
      const bendF = (prng() - 0.5) * 0.14 * scale;
      const stepH = stemHeight / numStemSegs;
      const prev = stemPts[s - 1];
      const nextP = [
        prev[0] + N[0] * stepH + R[0] * bendR + F[0] * bendF,
        prev[1] + N[1] * stepH + R[1] * bendR + F[1] * bendF,
        prev[2] + N[2] * stepH + R[2] * bendR + F[2] * bendF
      ];
      stemPts.push(nextP);

      const r0 = baseRadius * (1.0 - 0.55 * ((s - 1) / numStemSegs));
      const r1 = baseRadius * (1.0 - 0.55 * (s / numStemSegs));
      const sway0 = ((s - 1) / numStemSegs) * 0.35;
      const sway1 = (s / numStemSegs) * 0.35;

      if (taperFn) {
        taperFn(
          prev,
          nextP,
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
    }

    // ดอกฝ้ายปุยขาวบนยอดสุดของลำต้นหลัก (สร้างเฉพาะเมื่อโตเต็มที่แล้วเท่านั้น)
    const bollBaseRadius = scale * (0.34 + prng() * 0.06);
    if (hasBolls) {
      buildCottonBollCluster(
        stemPts[numStemSegs],
        N,
        bollBaseRadius,
        curSeed + 101,
        0.35,
        vertices,
        colors,
        indices,
        isPreviewMode
      );
    }

    // 2. แตกกิ่งก้านสาขา (3 กิ่ง) พร้อมใบฝ้ายและปุยฝ้ายสีขาวที่ปลายกิ่ง (โครงสร้างโลโพลีคล่องตัว ไม่หนักเครื่อง)
    const numBranches = 3;
    for (let b = 0; b < numBranches; b++) {
      const frac = 0.32 + 0.58 * (b / (numBranches - 1 || 1));
      const segF = frac * numStemSegs;
      const sIdx = Math.min(numStemSegs - 1, Math.floor(segF));
      const tSub = segF - sIdx;
      const pA = stemPts[sIdx];
      const pB = stemPts[sIdx + 1];

      const bOrigin = [
        pA[0] + (pB[0] - pA[0]) * tSub,
        pA[1] + (pB[1] - pA[1]) * tSub,
        pA[2] + (pB[2] - pA[2]) * tSub
      ];
      const originSway = frac * 0.35;

      const bAngle = plantYaw + b * 2.399963 + (prng() - 0.5) * 0.35;
      const bTilt = 0.42 + prng() * 0.32;
      const rawDirX = Math.cos(bAngle) * R[0] + Math.sin(bAngle) * F[0] + bTilt * N[0];
      const rawDirY = Math.cos(bAngle) * R[1] + Math.sin(bAngle) * F[1] + bTilt * N[1];
      const rawDirZ = Math.cos(bAngle) * R[2] + Math.sin(bAngle) * F[2] + bTilt * N[2];
      const lenBD = Math.sqrt(rawDirX * rawDirX + rawDirY * rawDirY + rawDirZ * rawDirZ) || 1;
      const bDir = [rawDirX / lenBD, rawDirY / lenBD, rawDirZ / lenBD];

      const bLen = scale * (0.95 + (1.0 - frac * 0.35) * 0.55);
      const bMid = [
        bOrigin[0] + bDir[0] * (bLen * 0.55),
        bOrigin[1] + bDir[1] * (bLen * 0.55),
        bOrigin[2] + bDir[2] * (bLen * 0.55)
      ];
      const tipDirX = bDir[0] + N[0] * 0.25;
      const tipDirY = bDir[1] + N[1] * 0.25;
      const tipDirZ = bDir[2] + N[2] * 0.25;
      const lenTD = Math.sqrt(tipDirX * tipDirX + tipDirY * tipDirY + tipDirZ * tipDirZ) || 1;
      const tipDir = [tipDirX / lenTD, tipDirY / lenTD, tipDirZ / lenTD];

      const bTip = [
        bMid[0] + tipDir[0] * (bLen * 0.48),
        bMid[1] + tipDir[1] * (bLen * 0.48),
        bMid[2] + tipDir[2] * (bLen * 0.48)
      ];

      const rBranchBase = baseRadius * 0.58;
      const rBranchMid = baseRadius * 0.42;
      const rBranchTip = baseRadius * 0.28;
      const midSway = originSway + 0.12;
      const tipSway = midSway + 0.12;

      if (taperFn) {
        taperFn(
          bOrigin,
          bMid,
          rBranchBase,
          rBranchMid,
          4,
          stemColor,
          vertices,
          colors,
          indices,
          false,
          originSway,
          midSway
        );
        taperFn(
          bMid,
          bTip,
          rBranchMid,
          rBranchTip,
          4,
          stemColor,
          vertices,
          colors,
          indices,
          false,
          midSway,
          tipSway
        );
      }

      // สร้างใบฝ้ายโลโพลี 2 ใบตามแนวกิ่ง
      for (let lf = 0; lf < 2; lf++) {
        const lSide = (lf % 2 === 0) ? 1.0 : -1.0;
        const lAng = bAngle + lSide * (0.75 + prng() * 0.35);
        const lDirX = Math.cos(lAng) * R[0] + Math.sin(lAng) * F[0] + 0.18 * N[0];
        const lDirY = Math.cos(lAng) * R[1] + Math.sin(lAng) * F[1] + 0.18 * N[1];
        const lDirZ = Math.cos(lAng) * R[2] + Math.sin(lAng) * F[2] + 0.18 * N[2];
        const lenLD = Math.sqrt(lDirX * lDirX + lDirY * lDirY + lDirZ * lDirZ) || 1;
        const lOrigin = (lf === 0) ? bOrigin : bMid;
        const lSway = (lf === 0) ? originSway : midSway;
        addCottonLeaf(
          lOrigin,
          [lDirX / lenLD, lDirY / lenLD, lDirZ / lenLD],
          scale * (0.50 + prng() * 0.15),
          lSway
        );
      }

      // สร้างปุยฝ้ายสีขาวโลโพลีที่ปลายกิ่ง (สร้างเฉพาะเมื่อโตเต็มที่แล้วเท่านั้น)
      if (hasBolls) {
        buildCottonBollCluster(
          bTip,
          tipDir,
          bollBaseRadius * (0.88 + prng() * 0.15),
          curSeed + b * 73,
          tipSway,
          vertices,
          colors,
          indices,
          isPreviewMode
        );
      }
    }
  }

  // ============================================
  // สร้างกลุ่มพืชฝ้าย (COTTON PLANT GROUPS)
  // - แยกกลุ่มออกจากกลุ่มต้นไม้ชัดเจน
  // - จำนวนกลุ่มของต้นฝ้าย = ครึ่งหนึ่งของจำนวนกลุ่มต้นไม้ (50%)
  // - ใน 1 กลุ่มจะมีต้นฝ้าย 1 ถึง 3 ต้น (โมเดลโลโพลี)
  // ============================================
  async function generateCottonPlantGroups({
    seed,
    RADIUS,
    HEIGHT_SCALE,
    waterLevel,
    treeGroupCenters,
    treePositions,
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
    const targetCottonGroups = numTreeGroups > 0 ? Math.max(1, Math.floor(numTreeGroups / 2)) : 0;
    const cottonGroupCenters = [];
    global.treeGroupCount = numTreeGroups;
    global.cottonGroupCount = targetCottonGroups;

    if (targetCottonGroups > 0 && !global.DISABLE_ENVIRONMENT) {
      const minLandH = waterLevel * 0.15 + 0.02;
      const baseTreeGroupDist = Math.min(3.2, Math.max(1.8, RADIUS * 0.24));
      const baseTreeSingleDist = Math.min(2.0, Math.max(1.25, RADIUS * 0.15));
      const baseCottonGroupDist = Math.min(2.4, Math.max(1.4, RADIUS * 0.18));

      for (let g = 0; g < targetCottonGroups; g++) {
        await yieldFn();
        let chosenGroup = null;

        for (let attempt = 0; attempt < 80; attempt++) {
          const candRng = rngFactory(seed + 55123 + g * 4999 + attempt * 313);
          const u = candRng();
          const v = candRng();
          const cTheta = Math.acos(2 * u - 1);
          const cPhi = 2 * Math.PI * v;

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

          // ค่อยๆ ผ่อนปรนระยะห่างหากสุ่มหลายรอบในดาวขนาดเล็ก แต่ยังคงแยกจากกลุ่มต้นไม้เสมอ
          const relax = attempt < 35 ? 1.0 : (attempt < 60 ? 0.72 : 0.50);
          const minTreeGrpSq = (baseTreeGroupDist * relax) * (baseTreeGroupDist * relax);
          const minTreePosSq = (baseTreeSingleDist * relax) * (baseTreeSingleDist * relax);
          const minCottonGrpSq = (baseCottonGroupDist * relax) * (baseCottonGroupDist * relax);

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

          let tooCloseToOtherCotton = false;
          for (let cg = 0; cg < cottonGroupCenters.length; cg++) {
            const dx = cWx - cottonGroupCenters[cg].wx;
            const dy = cWy - cottonGroupCenters[cg].wy;
            const dz = cWz - cottonGroupCenters[cg].wz;
            if (dx * dx + dy * dy + dz * dz < minCottonGrpSq) {
              tooCloseToOtherCotton = true;
              break;
            }
          }
          if (tooCloseToOtherCotton) continue;

          chosenGroup = { wx: cWx, wy: cWy, wz: cWz, nx: cNx, ny: cNy, nz: cNz, theta: cTheta, phi: cPhi };
          break;
        }

        if (!chosenGroup) continue;
        cottonGroupCenters.push(chosenGroup);

        // สร้างกรอบพิกัดสัมผัส (R, F, N) ของกลุ่มต้นฝ้าย
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

        // 1 กลุ่มจะมี 1 ถึง 3 ต้น (1 + Math.floor(rng * 3))
        const grpRng = rngFactory(seed + 88421 + g * 1777);
        const cottonCountInGroup = 1 + Math.floor(grpRng() * 3);

        for (let cIdx = 0; cIdx < cottonCountInGroup; cIdx++) {
          await yieldFn();
          const plantSeed = seed + 99000 + g * 100 + cIdx * 17;

          // จัดวางต้นฝ้ายในกลุ่มให้เกาะกลุ่มกันอย่างเป็นธรรมชาติ (ไม่ซ้อนทับกัน)
          let offX = 0;
          let offZ = 0;
          if (cottonCountInGroup > 1) {
            const ang = (cIdx / cottonCountInGroup) * Math.PI * 2 + (grpRng() - 0.5) * 0.55;
            const rad = 0.24 + grpRng() * 0.34;
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

          const cottonId = 500000 + g * 10 + cIdx;
          const cottonObj = {
            id: cottonId,
            type: "cotton_plant",
            groupId: g,
            layer: 0, // พุ่มฝ้ายเดินผ่านได้และเก็บได้ทันที (ไม่มีระบบกันชน)
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
            global.allDeterministicNatureObstacles.push(cottonObj);
          }
          if (Array.isArray(natureObstacles)) {
            natureObstacles.push(cottonObj);
          }
        }
      }
    }

    return { targetCottonGroups, cottonGroupCenters };
  }

  global.buildCottonBollCluster = buildCottonBollCluster;
  global.buildCottonPlant = buildCottonPlant;
  global.generateCottonPlantGroups = generateCottonPlantGroups;
  global.CottonPlantSystem = {
    buildCottonBollCluster,
    buildCottonPlant,
    generateCottonPlantGroups
  };
})(typeof window !== "undefined" ? window : globalThis);
