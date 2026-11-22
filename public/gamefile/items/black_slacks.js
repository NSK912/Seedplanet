// === SEEDPLANET MODULE: JS/ITEMS/BLACK_SLACKS.JS ===
// Tailored Pleated Straight-Leg Dark Slacks (BLACK_SLACKS) — worn 3D mesh & inventory icon mesh

(function() {
  const H = window._CapsuleClothHelpers || {};
  const _qNum = H._qNum;
  const _qVec3 = H._qVec3;
  const _wrapPhase2Pi = H._wrapPhase2Pi;
  const _cachedClothBuild = H._cachedClothBuild;
  const _appendCCWMeshAsCWIcon = H._appendCCWMeshAsCWIcon;
  const clampPointOutsideSegmentCapsule = H.clampPointOutsideSegmentCapsule;
  const getCharacterEquippedClothingState = H.getCharacterEquippedClothingState || window.getCharacterEquippedClothingState;
  const clampPointOutsideChibiBodyForCloth = H.clampPointOutsideChibiBodyForCloth || window.clampPointOutsideChibiBodyForCloth;

  function buildBlackSlacksMesh(
    headP1,
    chestP1, chestP2,
    leftLegPivot, leftKneeRot, leftFootRot,
    rightLegPivot, rightKneeRot, rightFootRot,
    scale = 1.0,
    phase = 0.0,
    clothContext = null
  ) {
    const eqS = (clothContext !== null && typeof getCharacterEquippedClothingState === "function") ? getCharacterEquippedClothingState(false) : null;
    const underSuit = (eqS && eqS.wearSuit) ? 1 : 0;
    const key = "slacks|" + (clothContext !== null ? 1 : 0) + "|" + underSuit + "|" + _qNum(scale, 1000) + "|" + _qNum(_wrapPhase2Pi(phase), 500)
      + "|" + _qVec3(headP1) + "|" + _qVec3(chestP1) + "|" + _qVec3(chestP2)
      + "|" + _qVec3(leftLegPivot) + "|" + _qVec3(leftKneeRot) + "|" + _qVec3(leftFootRot)
      + "|" + _qVec3(rightLegPivot) + "|" + _qVec3(rightKneeRot) + "|" + _qVec3(rightFootRot);
    return _cachedClothBuild(key, clothContext, () => _buildBlackSlacksMeshRaw(
      headP1, chestP1, chestP2,
      leftLegPivot, leftKneeRot, leftFootRot,
      rightLegPivot, rightKneeRot, rightFootRot,
      scale, phase, clothContext
    ));
  }

  function _buildBlackSlacksMeshRaw(
    headP1,
    chestP1, chestP2,
    leftLegPivot, leftKneeRot, leftFootRot,
    rightLegPivot, rightKneeRot, rightFootRot,
    scale = 1.0,
    phase = 0.0,
    clothContext = null
  ) {
    const outV = [], outC = [], outT = [], outI = [];
    const s = scale || 1.0;

    const baseGroin = chestP1 || [0, -0.090 * s, 0];
    const baseChest = chestP2 || [0,  0.170 * s, 0];

    const tdx = baseChest[0] - baseGroin[0];
    const tdy = baseChest[1] - baseGroin[1];
    const tdz = baseChest[2] - baseGroin[2];
    const torsoLen = Math.hypot(tdx, tdy, tdz) || (0.26 * s);
    const torsoUp = [tdx / torsoLen, tdy / torsoLen, tdz / torsoLen];

    const fDot = torsoUp[2];
    let torsoFwd = [-torsoUp[0] * fDot, -torsoUp[1] * fDot, 1.0 - torsoUp[2] * fDot];
    const tfLen = Math.hypot(torsoFwd[0], torsoFwd[1], torsoFwd[2]);
    torsoFwd = tfLen > 1e-4 ? [torsoFwd[0] / tfLen, torsoFwd[1] / tfLen, torsoFwd[2] / tfLen] : [0, 0, 1];
    const torsoRight = [
      torsoUp[1] * torsoFwd[2] - torsoUp[2] * torsoFwd[1],
      torsoUp[2] * torsoFwd[0] - torsoUp[0] * torsoFwd[2],
      torsoUp[0] * torsoFwd[1] - torsoUp[1] * torsoFwd[0]
    ];

    const groinPt = (dx, dy, dz) => [
      baseGroin[0] + torsoRight[0] * dx + torsoUp[0] * dy + torsoFwd[0] * dz,
      baseGroin[1] + torsoRight[1] * dx + torsoUp[1] * dy + torsoFwd[1] * dz,
      baseGroin[2] + torsoRight[2] * dx + torsoUp[2] * dy + torsoFwd[2] * dz
    ];

    const colBase       = [0.238, 0.246, 0.268];
    const colLit        = [0.262, 0.270, 0.294];
    const colCreaseHi   = [0.284, 0.293, 0.318];
    const colTuckStep   = [0.182, 0.188, 0.208];
    const colInner      = [0.095, 0.100, 0.115];
    const colTabWhite   = [0.865, 0.870, 0.900];

    const eqState = (clothContext !== null && typeof getCharacterEquippedClothingState === "function")
      ? getCharacterEquippedClothingState(false)
      : null;
    const underSuit = !!(eqState && eqState.wearSuit);
    const pScale = underSuit ? 0.88 : 1.0;

    const bodyColliderData = {
      headP1: headP1 || [baseChest[0], baseChest[1] + 0.08 * s, baseChest[2]],
      chestP1: baseGroin,
      chestP2: baseChest,
      leftLegPivot,
      leftKneeRot,
      leftFootRot,
      rightLegPivot,
      rightKneeRot,
      rightFootRot,
      scale: s
    };

    const addV = (px, py, pz, col, clampClr = 0.0, pushHint = null) => {
      let vx = px, vy = py, vz = pz;
      if (clampClr > 0.0) {
        const clamped = clampPointOutsideChibiBodyForCloth(vx, vy, vz, bodyColliderData, clampClr, false, pushHint);
        vx = clamped[0]; vy = clamped[1]; vz = clamped[2];
      }
      const idx = (outV.length / 3) | 0;
      outV.push(vx, vy, vz);
      outC.push(col[0], col[1], col[2]);
      outT.push(-9.0, -9.0);
      return idx;
    };
    const addQuad = (a, b, c, d) => { outI.push(a, b, c); outI.push(a, c, d); };

    // 1. High-Waisted Slacks Pelvis, Waistband, Overlapping Fly Flap, Waist Pleats & Crotch Saddle
    const N_WAIST = 32;
    const pelvisLevels = [
      { dy: torsoLen * 0.425, rx: 0.079 * s * pScale, rzF: 0.067 * s * pScale, rzB: 0.064 * s * pScale, cy: -0.001 * s, isBand: true,  clr: underSuit ? 0.0010 : 0.0025 },
      { dy: torsoLen * 0.360, rx: 0.083 * s * pScale, rzF: 0.070 * s * pScale, rzB: 0.068 * s * pScale, cy: -0.002 * s, isBand: true,  clr: underSuit ? 0.0015 : 0.0040 },
      { dy: torsoLen * 0.270, rx: 0.104 * s * pScale, rzF: 0.077 * s * pScale, rzB: 0.084 * s * pScale, cy: -0.002 * s, isBand: false, clr: underSuit ? 0.0020 : 0.0065 },
      { dy: torsoLen * 0.160, rx: 0.118 * s * pScale, rzF: 0.083 * s * pScale, rzB: 0.093 * s * pScale, cy: -0.003 * s, isBand: false, clr: underSuit ? 0.0025 : 0.0075 },
      { dy: torsoLen * 0.050, rx: 0.114 * s * pScale, rzF: 0.078 * s * pScale, rzB: 0.086 * s * pScale, cy: -0.002 * s, isBand: false, clr: underSuit ? 0.0025 : 0.0065 },
      { dy: -0.010 * s,       rx: 0.102 * s * pScale, rzF: 0.068 * s * pScale, rzB: 0.074 * s * pScale, cy: -0.001 * s, isBand: false, clr: underSuit ? 0.0020 : 0.0045 },
      { dy: -0.022 * s,       rx: 0.088 * s * pScale, rzF: 0.056 * s * pScale, rzB: 0.060 * s * pScale, cy: -0.001 * s, isBand: false, clr: underSuit ? 0.0015 : 0.0030 }
    ];

    const evalPelvisSurfacePt = (rFloat, ang, extraOut = 0.0) => {
      const r0 = Math.max(0, Math.min(pelvisLevels.length - 2, Math.floor(rFloat)));
      const r1 = r0 + 1;
      const tR = Math.max(0.0, Math.min(1.0, rFloat - r0));
      const L0 = pelvisLevels[r0], L1 = pelvisLevels[r1];
      const rx  = L0.rx  * (1.0 - tR) + L1.rx  * tR;
      const rzF = L0.rzF * (1.0 - tR) + L1.rzF * tR;
      const rzB = L0.rzB * (1.0 - tR) + L1.rzB * tR;
      const dy  = L0.dy  * (1.0 - tR) + L1.dy  * tR;
      const cy  = L0.cy  * (1.0 - tR) + L1.cy  * tR;
      const clr = L0.clr * (1.0 - tR) + L1.clr * tR;

      const sinA = Math.sin(ang);
      const cosA = Math.cos(ang);
      const rz = cosA >= 0.0 ? rzF : rzB;
      const p = groinPt(sinA * (rx + extraOut), dy, cy + cosA * (rz + extraOut));
      if (clr > 0.0) {
        return clampPointOutsideChibiBodyForCloth(p[0], p[1], p[2], bodyColliderData, clr + extraOut * 0.5, false, null);
      }
      return p;
    };

    const pelvisRings = [];
    const waistInnerRing = [];
    for (let rIdx = 0; rIdx < pelvisLevels.length; rIdx++) {
      const lvl = pelvisLevels[rIdx];
      const row = [];
      for (let j = 0; j < N_WAIST; j++) {
        const ang = (j / N_WAIST) * Math.PI * 2.0;
        const sinA = Math.sin(ang);
        const cosA = Math.cos(ang);
        const rz = cosA >= 0.0 ? lvl.rzF : lvl.rzB;

        const bandBump = lvl.isBand ? (0.0014 * s) : 0.0;
        const col = (lvl.isBand && rIdx === 0) ? colLit : colBase;

        const p = groinPt(
          sinA * (lvl.rx + bandBump),
          lvl.dy,
          lvl.cy + cosA * (rz + bandBump)
        );

        row.push(addV(p[0], p[1], p[2], col, lvl.clr));
        if (rIdx === 0) {
          const pIn = groinPt(sinA * (lvl.rx * 0.88), lvl.dy - 0.008 * s, lvl.cy + cosA * (rz * 0.88));
          waistInnerRing.push(addV(pIn[0], pIn[1], pIn[2], colInner));
        }
      }
      pelvisRings.push(row);
    }

    for (let j = 0; j < N_WAIST; j++) {
      const nextJ = (j + 1) % N_WAIST;
      addQuad(waistInnerRing[j], pelvisRings[0][j], pelvisRings[0][nextJ], waistInnerRing[nextJ]);
    }
    for (let r = 0; r < pelvisRings.length - 1; r++) {
      const r0 = pelvisRings[r], r1 = pelvisRings[r + 1];
      for (let j = 0; j < N_WAIST; j++) {
        const nextJ = (j + 1) % N_WAIST;
        addQuad(r0[j], r1[j], r1[nextJ], r0[nextJ]);
      }
    }
    const botPelvis = pelvisRings[pelvisRings.length - 1];
    for (let step = 1; step < (N_WAIST / 2) - 1; step++) {
      const a0 = step - 1, a1 = step;
      const b0 = N_WAIST - step + 1, b1 = N_WAIST - step;
      addQuad(botPelvis[b0 % N_WAIST], botPelvis[b1], botPelvis[a1], botPelvis[a0 === 0 ? 0 : a0]);
    }

    // 1B. 3D Overlapping Front Fly Placket & Upper-Hip 3D Pleat Origins
    {
      const flyRows = [1.0, 1.8, 2.7, 3.6];
      const flyThick = 0.0032 * s * pScale;
      const fGrid = [];
      for (let r = 0; r < flyRows.length; r++) {
        const rF = flyRows[r];
        const bottomCurve = (r === flyRows.length - 1) ? 0.06 : 0.16;
        const pLBase = evalPelvisSurfacePt(rF, -0.16, 0.0004 * s);
        const pLTop  = evalPelvisSurfacePt(rF, -0.14, flyThick * 0.75);
        const pMid   = evalPelvisSurfacePt(rF,  0.00, flyThick);
        const pRTop  = evalPelvisSurfacePt(rF,  bottomCurve, flyThick);
        const pRBase = evalPelvisSurfacePt(rF,  bottomCurve + 0.028, 0.0004 * s);
        fGrid.push([
          addV(pLBase[0], pLBase[1], pLBase[2], colBase),
          addV(pLTop[0],  pLTop[1],  pLTop[2],  colLit),
          addV(pMid[0],   pMid[1],   pMid[2],   colLit),
          addV(pRTop[0],  pRTop[1],  pRTop[2],  colCreaseHi),
          addV(pRBase[0], pRBase[1], pRBase[2], colTuckStep)
        ]);
      }
      for (let r = 0; r < fGrid.length - 1; r++) {
        const g0 = fGrid[r], g1 = fGrid[r + 1];
        for (let c = 0; c < 4; c++) {
          addQuad(g0[c], g1[c], g1[c + 1], g0[c + 1]);
        }
      }

      for (const side of [-1.0, 1.0]) {
        const pRows = [1.05, 1.85, 2.70, 3.45];
        const pThick = 0.0038 * s * pScale;
        const pGrid = [];
        for (let r = 0; r < pRows.length; r++) {
          const rF = pRows[r];
          const angTuck  = side * 0.49;
          const angEdge  = side * 0.52;
          const angBlade = side * 0.63;
          const angMerge = side * 0.76;
          const pTuck  = evalPelvisSurfacePt(rF, angTuck,  0.0004 * s);
          const pEdge  = evalPelvisSurfacePt(rF, angEdge,  pThick);
          const pBlade = evalPelvisSurfacePt(rF, angBlade, pThick * 0.72);
          const pMerge = evalPelvisSurfacePt(rF, angMerge, 0.0004 * s);
          pGrid.push([
            addV(pTuck[0],  pTuck[1],  pTuck[2],  colTuckStep),
            addV(pEdge[0],  pEdge[1],  pEdge[2],  colCreaseHi),
            addV(pBlade[0], pBlade[1], pBlade[2], colLit),
            addV(pMerge[0], pMerge[1], pMerge[2], colBase)
          ]);
        }
        for (let r = 0; r < pGrid.length - 1; r++) {
          const g0 = pGrid[r], g1 = pGrid[r + 1];
          for (let c = 0; c < 3; c++) {
            if (side > 0) {
              addQuad(g0[c], g1[c], g1[c + 1], g0[c + 1]);
            } else {
              addQuad(g0[c + 1], g1[c + 1], g1[c], g0[c]);
            }
          }
        }
      }
    }

    if (!underSuit) {
      const loopAngles = [-0.48, 0.48, -1.48, 1.48, Math.PI - 0.48, Math.PI + 0.48];
      for (let li = 0; li < loopAngles.length; li++) {
        const ang = loopAngles[li];
        const hw = 0.068;
        const aL = ang - hw, aR = ang + hw;
        const rB = 0.0865 * s;
        const rZF = 0.0745 * s;
        const rZB = 0.0715 * s;
        const ptLoop = (a, dy) => {
          const sA = Math.sin(a), cA = Math.cos(a);
          return groinPt(sA * rB, dy, -0.0015 * s + cA * (cA >= 0 ? rZF : rZB));
        };
        const vTL = addV(...ptLoop(aL, torsoLen * 0.430), colCreaseHi);
        const vTR = addV(...ptLoop(aR, torsoLen * 0.430), colCreaseHi);
        const vBL = addV(...ptLoop(aL, torsoLen * 0.355), colLit);
        const vBR = addV(...ptLoop(aR, torsoLen * 0.355), colLit);
        addQuad(vTL, vBL, vBR, vTR);
      }
      {
        const aTabL = -0.82, aTabR = -0.71;
        const ptTab = (a, dy) => {
          const sA = Math.sin(a), cA = Math.cos(a);
          return groinPt(sA * 0.089 * s, dy, -0.0015 * s + cA * 0.075 * s);
        };
        const tTL = addV(...ptTab(aTabL, torsoLen * 0.358), colTabWhite);
        const tTR = addV(...ptTab(aTabR, torsoLen * 0.358), colTabWhite);
        const tBL = addV(...ptTab(aTabL, torsoLen * 0.332), colTabWhite);
        const tBR = addV(...ptTab(aTabR, torsoLen * 0.332), colTabWhite);
        addQuad(tTL, tBL, tBR, tTR);
      }
    }

    // 2. Articulated Straight-Leg Trouser Tubes + Real 3D Folded Pleat & Crease Meshes
    const addSlacksLeg = (pHip, pKnee, pFoot, isLeft) => {
      if (!pHip || !pKnee || !pFoot) return;
      const N_LEG = 28;
      const outerSign = isLeft ? -1.0 : 1.0;

      const norm3 = (v, fb = [0, -1, 0]) => {
        const l = Math.hypot(v[0], v[1], v[2]);
        return l > 1e-5 ? [v[0] / l, v[1] / l, v[2] / l] : fb;
      };
      const cross3 = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
      ];
      const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

      const dirThigh = norm3([pKnee[0] - pHip[0], pKnee[1] - pHip[1], pKnee[2] - pHip[2]], [0, -1, 0]);
      const dirCalf  = norm3([pFoot[0] - pKnee[0], pFoot[1] - pKnee[1], pFoot[2] - pKnee[2]], dirThigh);
      const dirKnee  = norm3([dirThigh[0] + dirCalf[0], dirThigh[1] + dirCalf[1], dirThigh[2] + dirCalf[2]], dirThigh);

      const shiftHip = (pt, upAmt, outAmt) => [
        pt[0] + torsoUp[0] * upAmt + torsoRight[0] * (outerSign * outAmt),
        pt[1] + torsoUp[1] * upAmt + torsoRight[1] * (outerSign * outAmt),
        pt[2] + torsoUp[2] * upAmt + torsoRight[2] * (outerSign * outAmt)
      ];

      const uS0 = underSuit ? 0.88 : 1.0;
      const uS1 = underSuit ? 0.92 : 1.0;
      const overBoots = !!(eqState && (eqState.wearBoots || eqState.wearOxfords || eqState.wearDressBoots));
      const wearDressBoots = !!(eqState && eqState.wearDressBoots);
      const bootEase = wearDressBoots ? 0.0072 * s
        : ((eqState && eqState.wearBoots) ? 0.0042 * s : (overBoots ? 0.0018 * s : 0.0));
      const calfEase = wearDressBoots ? bootEase * 0.45 : 0.0;
      const hemT = wearDressBoots ? 0.902 : 0.945;
      const hemInT = wearDressBoots ? 0.838 : 0.87;
      const stations = [
        { p: shiftHip(pHip, 0.024 * s, 0.0030 * s * uS0),                dir: dirThigh,                             rxOut: 0.0660 * s * uS0, rxIn: 0.0510 * s * uS0, rz: 0.0630 * s * uS0, t: 0.00, clamp: false,      isHemIn: false },
        { p: shiftHip(lerp3(pHip, pKnee, 0.16), 0.0, 0.0028 * s * uS1),  dir: dirThigh,                             rxOut: 0.0640 * s * uS1, rxIn: 0.0445 * s * uS1, rz: 0.0600 * s * uS1, t: 0.14, clamp: !underSuit, isHemIn: false },
        { p: shiftHip(lerp3(pHip, pKnee, 0.42), 0.0, 0.0022 * s),        dir: dirThigh,                             rxOut: 0.0605 * s,       rxIn: 0.0435 * s,       rz: 0.0570 * s,       t: 0.30, clamp: true,       isHemIn: false },
        { p: shiftHip(lerp3(pHip, pKnee, 0.72), 0.0, 0.0014 * s),        dir: dirThigh,                             rxOut: 0.0565 * s,       rxIn: 0.0430 * s,       rz: 0.0545 * s,       t: 0.44, clamp: true,       isHemIn: false },
        { p: shiftHip(lerp3(pHip, pKnee, 0.92), 0.0, 0.0008 * s),        dir: norm3(lerp3(dirThigh, dirKnee, 0.5)), rxOut: 0.0540 * s,       rxIn: 0.0425 * s,       rz: 0.0530 * s,       t: 0.52, clamp: true,       isHemIn: false },
        { p: pKnee,                                                      dir: dirKnee,                              rxOut: 0.0525 * s,       rxIn: 0.0420 * s,       rz: 0.0520 * s,       t: 0.58, clamp: true,       isHemIn: false },
        { p: lerp3(pKnee, pFoot, 0.16),                                  dir: norm3(lerp3(dirKnee, dirCalf, 0.5)),  rxOut: 0.0515 * s,       rxIn: 0.0418 * s,       rz: 0.0515 * s,       t: 0.66, clamp: true,       isHemIn: false },
        { p: lerp3(pKnee, pFoot, 0.50),                                  dir: dirCalf,                              rxOut: 0.0500 * s + calfEase * 0.65, rxIn: 0.0412 * s + calfEase * 1.15, rz: 0.0500 * s + calfEase * 0.90, t: 0.80, clamp: true, isHemIn: false },
        { p: lerp3(pKnee, pFoot, 0.82),                                  dir: dirCalf,                              rxOut: 0.0485 * s + bootEase * 0.85, rxIn: 0.0408 * s + bootEase * 1.15, rz: 0.0485 * s + bootEase * 0.95, t: 0.92, clamp: true, isHemIn: false },
        { p: lerp3(pKnee, pFoot, hemT),                                  dir: dirCalf,                              rxOut: 0.0470 * s + bootEase * 0.90, rxIn: 0.0402 * s + bootEase * 1.25, rz: 0.0475 * s + bootEase * 1.05, t: 1.00, clamp: true, isHemIn: false },
        { p: lerp3(pKnee, pFoot, hemInT),                                dir: dirCalf,                              rxOut: 0.0365 * s,       rxIn: 0.0355 * s,       rz: 0.0365 * s,       t: 0.94, clamp: false,      isHemIn: true }
      ];

      let curU = cross3(torsoFwd, stations[0].dir);
      if (Math.hypot(curU[0], curU[1], curU[2]) < 1e-4) curU = [1, 0, 0];
      curU = norm3(curU, [1, 0, 0]);
      let curV = norm3(cross3(stations[0].dir, curU), torsoFwd);
      if (dot3(curV, torsoFwd) < 0) {
        curU = [-curU[0], -curU[1], -curU[2]];
        curV = [-curV[0], -curV[1], -curV[2]];
      }
      for (let k = 0; k < stations.length; k++) {
        const st = stations[k];
        if (k > 0) {
          const proj = dot3(curU, st.dir);
          const nextU = [curU[0] - st.dir[0] * proj, curU[1] - st.dir[1] * proj, curU[2] - st.dir[2] * proj];
          if (Math.hypot(nextU[0], nextU[1], nextU[2]) > 1e-4) {
            curU = norm3(nextU, curU);
            curV = norm3(cross3(st.dir, curU), curV);
          }
        }
        st.U = [curU[0], curU[1], curU[2]];
        st.V = [curV[0], curV[1], curV[2]];
      }

      const evalLegPt = (kFloat, ang, extraOut = 0.0, isHemIn = false) => {
        const maxOuterK = stations.length - 2;
        const k0 = isHemIn ? (stations.length - 1) : Math.max(0, Math.min(maxOuterK - 1, Math.floor(kFloat)));
        const k1 = isHemIn ? k0 : Math.min(maxOuterK, k0 + 1);
        const tK = isHemIn ? 0.0 : Math.max(0.0, Math.min(1.0, kFloat - k0));
        const S0 = stations[k0], S1 = stations[k1];

        const p = lerp3(S0.p, S1.p, tK);
        const U = norm3(lerp3(S0.U, S1.U, tK), S0.U);
        const V = norm3(lerp3(S0.V, S1.V, tK), S0.V);
        const rxOut = S0.rxOut * (1.0 - tK) + S1.rxOut * tK;
        const rxIn  = S0.rxIn  * (1.0 - tK) + S1.rxIn  * tK;
        const rz    = S0.rz    * (1.0 - tK) + S1.rz    * tK;
        const doClamp = S0.clamp || S1.clamp;

        const sinA = Math.sin(ang);
        const cosA = Math.cos(ang);

        const isOuterHalf = (cosA * outerSign) >= 0.0;
        const baseRx = isOuterHalf
          ? (rxIn + (rxOut - rxIn) * Math.pow(Math.abs(cosA), 0.65))
          : (rxIn * (1.0 - 0.06 * Math.pow(Math.abs(cosA), 1.2)));

        const frontTailorTaper = (!isHemIn && sinA > 0.0) ? (Math.pow(sinA, 3.0) * 0.0018 * s) : 0.0;
        const backTailorTaper  = (!isHemIn && sinA < 0.0) ? (Math.pow(-sinA, 4.0) * 0.0014 * s) : 0.0;
        const radX = baseRx;
        const radZ = rz + frontTailorTaper + backTailorTaper;

        let vx = p[0] + U[0] * (cosA * radX) + V[0] * (sinA * radZ);
        let vy = p[1] + U[1] * (cosA * radX) + V[1] * (sinA * radZ);
        let vz = p[2] + U[2] * (cosA * radX) + V[2] * (sinA * radZ);

        if (doClamp && !isHemIn) {
          const isInnerCrotchSide = !isOuterHalf && Math.abs(sinA) < 0.55;
          if (!isInnerCrotchSide) {
            const c1 = clampPointOutsideSegmentCapsule(vx, vy, vz, pHip, pKnee, 0.0550 * s, 0.0440 * s, 0.0035 * s);
            const c2 = clampPointOutsideSegmentCapsule(c1[0], c1[1], c1[2], pKnee, pFoot, 0.0440 * s, 0.0360 * s, 0.0035 * s);
            vx = c2[0]; vy = c2[1]; vz = c2[2];
          }
        }

        if (Math.abs(extraOut) > 1e-6) {
          const nx = U[0] * cosA + V[0] * sinA;
          const ny = U[1] * cosA + V[1] * sinA;
          const nz = U[2] * cosA + V[2] * sinA;
          const nLen = Math.hypot(nx, ny, nz) || 1.0;
          vx += (nx / nLen) * extraOut;
          vy += (ny / nLen) * extraOut;
          vz += (nz / nLen) * extraOut;
        }
        return [vx, vy, vz];
      };

      // 2A. Base Smooth Tailored Trouser Tube
      const rings = [];
      for (let k = 0; k < stations.length; k++) {
        const st = stations[k];
        const ring = [];
        const col = st.isHemIn
          ? colInner
          : (k === stations.length - 2 ? [colBase[0] * 0.92, colBase[1] * 0.92, colBase[2] * 0.93] : colBase);
        for (let j = 0; j < N_LEG; j++) {
          const ang = (j / N_LEG) * Math.PI * 2.0;
          const pt = evalLegPt(k, ang, 0.0, st.isHemIn);
          ring.push(addV(pt[0], pt[1], pt[2], col));
        }
        rings.push(ring);
      }

      for (let k = 0; k < rings.length - 1; k++) {
        const r0 = rings[k], r1 = rings[k + 1];
        for (let j = 0; j < N_LEG; j++) {
          const nextJ = (j + 1) % N_LEG;
          addQuad(r0[j], r0[nextJ], r1[nextJ], r1[j]);
        }
      }

      // 2B. Real 3D Folded Front Knife-Pleat & Full-Length Center Press Crease Mesh
      {
        const angCenter = Math.PI * 0.5;
        const innerAngSign = isLeft ? -1.0 : 1.0;
        const outerAngSign = -innerAngSign;

        const creaseStations = [0.0, 0.8, 1.7, 2.7, 3.8, 5.0, 6.2, 7.5, 8.8, 9.0];
        const pleatGrid = [];
        for (let r = 0; r < creaseStations.length; r++) {
          const kF = creaseStations[r];
          const pleatEnv = Math.max(0.0, 1.0 - kF / 4.8);
          const ridgeH = (0.0030 + 0.0020 * pleatEnv) * s * (kF < 1.5 ? uS0 : 1.0);
          const bladeW = 0.16 + 0.12 * pleatEnv;

          const angInBase  = angCenter + innerAngSign * (0.07 + 0.03 * pleatEnv);
          const angTuckIn  = angCenter + innerAngSign * (0.015 - 0.020 * pleatEnv);
          const angCrest   = angCenter;
          const angBlade   = angCenter + outerAngSign * (bladeW * 0.52);
          const angOutBase = angCenter + outerAngSign * bladeW;

          const pInBase  = evalLegPt(kF, angInBase,  0.0002 * s);
          const pTuckIn  = evalLegPt(kF, angTuckIn,  0.0005 * s);
          const pCrest   = evalLegPt(kF, angCrest,   ridgeH);
          const pBlade   = evalLegPt(kF, angBlade,   ridgeH * (0.48 + 0.24 * pleatEnv));
          const pOutBase = evalLegPt(kF, angOutBase, 0.0002 * s);

          pleatGrid.push([
            addV(pInBase[0],  pInBase[1],  pInBase[2],  colBase),
            addV(pTuckIn[0],  pTuckIn[1],  pTuckIn[2],  pleatEnv > 0.15 ? colTuckStep : colBase),
            addV(pCrest[0],   pCrest[1],   pCrest[2],   colCreaseHi),
            addV(pBlade[0],   pBlade[1],   pBlade[2],   colLit),
            addV(pOutBase[0], pOutBase[1], pOutBase[2], colBase)
          ]);
        }

        for (let r = 0; r < pleatGrid.length - 1; r++) {
          const g0 = pleatGrid[r], g1 = pleatGrid[r + 1];
          for (let c = 0; c < 4; c++) {
            if (isLeft) {
              addQuad(g0[c], g0[c + 1], g1[c + 1], g1[c]);
            } else {
              addQuad(g0[c + 1], g0[c], g1[c], g1[c + 1]);
            }
          }
        }
      }

      // 2C. Secondary Outer-Front 3D Waist Pleat Fold Mesh
      {
        const angCenter = Math.PI * 0.5;
        const outerAngSign = isLeft ? 1.0 : -1.0;
        const secStations = [0.0, 0.9, 1.9, 3.2];
        const secGrid = [];
        for (let r = 0; r < secStations.length; r++) {
          const kF = secStations[r];
          const env = Math.max(0.0, 1.0 - kF / 3.2);
          const foldH = 0.0032 * env * s * (kF < 1.5 ? uS0 : 1.0);
          const angCenterSec = angCenter + outerAngSign * (0.34 - 0.04 * (kF / 3.2));

          const angTuck  = angCenterSec - outerAngSign * 0.035;
          const angCrest = angCenterSec;
          const angBlade = angCenterSec + outerAngSign * 0.075;
          const angMerge = angCenterSec + outerAngSign * 0.150;

          const pTuck  = evalLegPt(kF, angTuck,  0.0003 * s);
          const pCrest = evalLegPt(kF, angCrest, foldH);
          const pBlade = evalLegPt(kF, angBlade, foldH * 0.62);
          const pMerge = evalLegPt(kF, angMerge, 0.0002 * s);

          secGrid.push([
            addV(pTuck[0],  pTuck[1],  pTuck[2],  env > 0.2 ? colTuckStep : colBase),
            addV(pCrest[0], pCrest[1], pCrest[2], env > 0.1 ? colCreaseHi : colBase),
            addV(pBlade[0], pBlade[1], pBlade[2], colLit),
            addV(pMerge[0], pMerge[1], pMerge[2], colBase)
          ]);
        }
        for (let r = 0; r < secGrid.length - 1; r++) {
          const g0 = secGrid[r], g1 = secGrid[r + 1];
          for (let c = 0; c < 3; c++) {
            if (isLeft) {
              addQuad(g0[c], g0[c + 1], g1[c + 1], g1[c]);
            } else {
              addQuad(g0[c + 1], g0[c], g1[c], g1[c + 1]);
            }
          }
        }
      }

      // 2D. Diagonal 3D Groin / Upper-Inner-Thigh Drape Fold Ridge
      {
        const angCenter = Math.PI * 0.5;
        const innerAngSign = isLeft ? -1.0 : 1.0;
        const diagStations = [0.4, 1.3, 2.3];
        const diagGrid = [];
        for (let r = 0; r < diagStations.length; r++) {
          const kF = diagStations[r];
          const u = r / (diagStations.length - 1);
          const env = Math.sin(u * Math.PI);
          const foldH = 0.0024 * env * s * (kF < 1.5 ? uS0 : 1.0);
          const angMid = angCenter + innerAngSign * (0.42 - u * 0.24);
          const pIn  = evalLegPt(kF, angMid + innerAngSign * 0.08, 0.0002 * s);
          const pTop = evalLegPt(kF, angMid, foldH);
          const pOut = evalLegPt(kF, angMid - innerAngSign * 0.08, 0.0002 * s);
          diagGrid.push([
            addV(pIn[0],  pIn[1],  pIn[2],  colBase),
            addV(pTop[0], pTop[1], pTop[2], colLit),
            addV(pOut[0], pOut[1], pOut[2], colBase)
          ]);
        }
        for (let r = 0; r < diagGrid.length - 1; r++) {
          const g0 = diagGrid[r], g1 = diagGrid[r + 1];
          for (let c = 0; c < 2; c++) {
            if (isLeft) {
              addQuad(g0[c], g0[c + 1], g1[c + 1], g1[c]);
            } else {
              addQuad(g0[c + 1], g0[c], g1[c], g1[c + 1]);
            }
          }
        }
      }
    };

    addSlacksLeg(leftLegPivot, leftKneeRot, leftFootRot, true);
    addSlacksLeg(rightLegPivot, rightKneeRot, rightFootRot, false);

    const frontTriCount = outI.length;
    const normals = new Float32Array(outV.length);
    for (let k = 0; k < frontTriCount; k += 3) {
      const i0 = outI[k], i1 = outI[k + 1], i2 = outI[k + 2];
      const ux = outV[i1 * 3] - outV[i0 * 3], uy = outV[i1 * 3 + 1] - outV[i0 * 3 + 1], uz = outV[i1 * 3 + 2] - outV[i0 * 3 + 2];
      const vx = outV[i2 * 3] - outV[i0 * 3], vy = outV[i2 * 3 + 1] - outV[i0 * 3 + 1], vz = outV[i2 * 3 + 2] - outV[i0 * 3 + 2];
      const nX = uy * vz - uz * vy, nY = uz * vx - ux * vz, nZ = ux * vy - uy * vx;
      normals[i0 * 3] += nX; normals[i0 * 3 + 1] += nY; normals[i0 * 3 + 2] += nZ;
      normals[i1 * 3] += nX; normals[i1 * 3 + 1] += nY; normals[i1 * 3 + 2] += nZ;
      normals[i2 * 3] += nX; normals[i2 * 3 + 1] += nY; normals[i2 * 3 + 2] += nZ;
    }
    for (let k = 0; k < normals.length; k += 3) {
      const l = Math.hypot(normals[k], normals[k + 1], normals[k + 2]);
      if (l > 1e-12) { normals[k] /= l; normals[k + 1] /= l; normals[k + 2] /= l; }
      else { normals[k] = 0.0; normals[k + 1] = 1.0; normals[k + 2] = 0.0; }
    }
    for (let k = 0; k < frontTriCount; k += 3) {
      outI.push(outI[k], outI[k + 2], outI[k + 1]);
    }

    return {
      vertices: outV,
      normals: normals,
      colors: outC,
      texcoords: outT,
      indices: outI
    };
  }

  function buildBlackSlacksIconMesh(rawVertices, rawColors, rawIndices) {
    const slMesh = buildBlackSlacksMesh(
      [0, 0.336, 0],
      [0, -0.090, 0], [0, 0.170, 0],
      [-0.052, -0.068, 0], [-0.052, -0.246, 0.010], [-0.052, -0.420, 0],
      [ 0.052, -0.068, 0], [ 0.052, -0.246, 0.010], [ 0.052, -0.420, 0],
      1.0,
      0.0,
      null
    );
    _appendCCWMeshAsCWIcon(slMesh, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: true,
      colorMap: (r, g, b) => {
        if (r > 0.60) return [r, g, b];
        const lift = 1.16;
        return [
          Math.min(0.60, r * lift + 0.02),
          Math.min(0.62, g * lift + 0.02),
          Math.min(0.66, b * lift + 0.025)
        ];
      }
    });
  }

  window.buildBlackSlacksMesh = buildBlackSlacksMesh;
  window.buildBlackSlacksIconMesh = buildBlackSlacksIconMesh;
  if (window.CapsuleModel) {
    window.CapsuleModel.buildBlackSlacksMesh = buildBlackSlacksMesh;
    window.CapsuleModel.buildBlackSlacksIconMesh = buildBlackSlacksIconMesh;
  }
  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["black_slacks"] = Object.assign({}, window.ItemRegistry["BLACK_SLACKS"] || {}, {
    buildMesh: buildBlackSlacksMesh,
    buildIconMesh: buildBlackSlacksIconMesh
  });
  window.ItemRegistry["BLACK_SLACKS"] = window.ItemRegistry["black_slacks"];
})();
