// === SEEDPLANET MODULE: JS/ITEMS/DOUBLE_BREASTED_SUIT.JS ===
// Tailored Charcoal Pinstripe Double-Breasted Suit (DOUBLE_BREASTED_SUIT) — worn 3D mesh & inventory icon mesh

(function() {
  const H = window._CapsuleClothHelpers || {};
  const _qNum = H._qNum;
  const _qVec3 = H._qVec3;
  const _wrapPhase2Pi = H._wrapPhase2Pi;
  const _getClothPhysKey = H._getClothPhysKey;
  const _cachedClothBuild = H._cachedClothBuild;
  const _createDefaultHoodiePhysState = H._createDefaultHoodiePhysState;
  const chibiCloneHoodiePhysics = H.chibiCloneHoodiePhysics;
  const _getBlackPleatedSkirtRingsDef = H._getBlackPleatedSkirtRingsDef;
  const _computeGarmentLegStride = H._computeGarmentLegStride;
  const _computeSkirtVertexDisplacement = H._computeSkirtVertexDisplacement;
  const _buildSkirtEnvelopeClampFn = H._buildSkirtEnvelopeClampFn;
  const _appendCCWMeshAsCWIcon = H._appendCCWMeshAsCWIcon;
  const clampPointOutsideSegmentCapsule = H.clampPointOutsideSegmentCapsule;
  const getCharacterEquippedClothingState = H.getCharacterEquippedClothingState || window.getCharacterEquippedClothingState;
  const clampPointOutsideChibiBodyForCloth = H.clampPointOutsideChibiBodyForCloth || window.clampPointOutsideChibiBodyForCloth;

  function buildDoubleBreastedSuitMesh(
    headP1,
    chestP1, chestP2,
    neckP1, neckP2,
    leftArmPivot, leftElbowRot, leftHandRot,
    rightArmPivot, rightElbowRot, rightHandRot,
    scale = 1.0,
    phase = 0.0,
    isLocal = false,
    leftFootRot = null,
    rightFootRot = null,
    clothContext = null
  ) {
    const lod = (clothContext && typeof clothContext.lod === "number") ? clothContext.lod : 0;
    const isCl = !!(clothContext && clothContext.isClone);
    const eqS = (!isLocal && !isCl && typeof getCharacterEquippedClothingState === "function") ? getCharacterEquippedClothingState(false) : null;
    const wSkirt = !isLocal && !!((clothContext && clothContext.wearSkirt !== undefined) ? clothContext.wearSkirt : (eqS && eqS.wearSkirt));
    const key = "suit|" + (isLocal ? 1 : 0) + "|" + (wSkirt ? 1 : 0) + "|" + lod + "|" + _qNum(scale, 1000) + "|" + _qNum(_wrapPhase2Pi(phase), 500)
      + "|" + _qVec3(headP1) + "|" + _qVec3(chestP1) + "|" + _qVec3(chestP2) + "|" + _qVec3(neckP1) + "|" + _qVec3(neckP2)
      + "|" + _qVec3(leftArmPivot) + "|" + _qVec3(leftElbowRot) + "|" + _qVec3(leftHandRot)
      + "|" + _qVec3(rightArmPivot) + "|" + _qVec3(rightElbowRot) + "|" + _qVec3(rightHandRot)
      + "|" + _qVec3(leftFootRot) + "|" + _qVec3(rightFootRot)
      + "|" + (clothContext ? (_qVec3(clothContext.leftLegPivot) + "|" + _qVec3(clothContext.rightLegPivot)) : "n")
      + "|" + _getClothPhysKey(clothContext, lod);
    return _cachedClothBuild(key, clothContext, () => _buildDoubleBreastedSuitMeshRaw(
      headP1, chestP1, chestP2, neckP1, neckP2,
      leftArmPivot, leftElbowRot, leftHandRot,
      rightArmPivot, rightElbowRot, rightHandRot,
      scale, phase, isLocal, leftFootRot, rightFootRot, clothContext
    ));
  }

  function _buildDoubleBreastedSuitMeshRaw(
    headP1,
    chestP1, chestP2,
    neckP1, neckP2,
    leftArmPivot, leftElbowRot, leftHandRot,
    rightArmPivot, rightElbowRot, rightHandRot,
    scale = 1.0,
    phase = 0.0,
    isLocal = false,
    leftFootRot = null,
    rightFootRot = null,
    clothContext = null
  ) {
    const outV = [], outC = [], outT = [], outI = [];
    const s = scale || 1.0;

    const baseGroin = chestP1 || [0, -0.090 * s, 0];
    const baseChest = chestP2 || [0,  0.170 * s, 0];
    const ny = neckP1 ? neckP1[1] : baseChest[1];

    const tdx = baseChest[0] - baseGroin[0];
    const tdy = baseChest[1] - baseGroin[1];
    const tdz = baseChest[2] - baseGroin[2];
    const torsoLen = Math.hypot(tdx, tdy, tdz) || (0.26 * s);
    const torsoUp = [tdx / torsoLen, tdy / torsoLen, tdz / torsoLen];
    const torsoRatio = Math.max(0.75, Math.min(1.15, torsoLen / (0.26 * s)));

    const fDot = torsoUp[2];
    let torsoFwd = [-torsoUp[0] * fDot, -torsoUp[1] * fDot, 1.0 - torsoUp[2] * fDot];
    const tfLen = Math.hypot(torsoFwd[0], torsoFwd[1], torsoFwd[2]);
    torsoFwd = tfLen > 1e-4 ? [torsoFwd[0] / tfLen, torsoFwd[1] / tfLen, torsoFwd[2] / tfLen] : [0, 0, 1];
    const torsoRight = [
      torsoUp[1] * torsoFwd[2] - torsoUp[2] * torsoFwd[1],
      torsoUp[2] * torsoFwd[0] - torsoUp[0] * torsoFwd[2],
      torsoUp[0] * torsoFwd[1] - torsoUp[1] * torsoFwd[0]
    ];

    const collarBaseX = baseChest[0];
    const collarBaseY = Math.min(ny, baseChest[1] + 0.008 * s);
    const collarBaseZ = baseChest[2];
    const torsoPt = (dx, dy, dz) => [
      collarBaseX + torsoRight[0] * dx + torsoUp[0] * dy + torsoFwd[0] * dz,
      collarBaseY + torsoRight[1] * dx + torsoUp[1] * dy + torsoFwd[1] * dz,
      collarBaseZ + torsoRight[2] * dx + torsoUp[2] * dy + torsoFwd[2] * dz
    ];

    // Charcoal Pinstripe Suit Palette
    const colSuitBase  = [0.238, 0.246, 0.268];
    const colStripeHi  = [0.358, 0.368, 0.394];
    const colLapelHi   = [0.285, 0.294, 0.320];
    const colSeamAO    = [0.138, 0.144, 0.162];
    const colInner     = [0.095, 0.100, 0.115];
    const colBtnRim    = [0.640, 0.450, 0.250];
    const colBtnHi     = [0.870, 0.700, 0.460];
    const colBtnDark   = [0.360, 0.220, 0.110];

    const pinstripeColor = (ang, ao = 0.0, isLapel = false) => {
      const stripeWave = Math.pow(Math.max(0.0, Math.cos(ang * 26.0)), 10.0);
      const base = isLapel ? colLapelHi : colSuitBase;
      const mix = stripeWave * (isLapel ? 0.55 : 0.75);
      return [
        Math.max(0.07, (base[0] * (1.0 - mix) + colStripeHi[0] * mix) - ao),
        Math.max(0.07, (base[1] * (1.0 - mix) + colStripeHi[1] * mix) - ao),
        Math.max(0.08, (base[2] * (1.0 - mix) + colStripeHi[2] * mix) - ao)
      ];
    };

    const bodyColliderData = {
      headP1: headP1 || [baseChest[0], baseChest[1] + 0.08 * s, baseChest[2]],
      chestP1: baseGroin,
      chestP2: baseChest,
      leftArmPivot,
      leftElbowRot,
      leftHandRot,
      rightArmPivot,
      rightElbowRot,
      rightHandRot,
      leftLegPivot: clothContext ? clothContext.leftLegPivot : null,
      leftKneeRot: clothContext ? clothContext.leftKneeRot : null,
      leftFootRot: clothContext ? (clothContext.leftFootRot || leftFootRot) : leftFootRot,
      rightLegPivot: clothContext ? clothContext.rightLegPivot : null,
      rightKneeRot: clothContext ? clothContext.rightKneeRot : null,
      rightFootRot: clothContext ? (clothContext.rightFootRot || rightFootRot) : rightFootRot,
      legRadiusBoost: 0.002,
      scale: s
    };

    const addV = (px, py, pz, col, clampClr = 0.0, includeArms = false, pushHint = null) => {
      let vx = px, vy = py, vz = pz;
      if (clampClr > 0.0 && !isLocal) {
        const clamped = clampPointOutsideChibiBodyForCloth(vx, vy, vz, bodyColliderData, clampClr, includeArms, pushHint);
        vx = clamped[0]; vy = clamped[1]; vz = clamped[2];
      }
      const idx = (outV.length / 3) | 0;
      outV.push(vx, vy, vz);
      outC.push(col[0], col[1], col[2]);
      outT.push(-9.0, -9.0);
      return idx;
    };
    const addTri = (a, b, c) => { outI.push(a, b, c); };
    const addQuad = (a, b, c, d) => { outI.push(a, b, c); outI.push(a, c, d); };

    const useClonePhys = !!(clothContext && clothContext.isClone);
    const hPhys = (clothContext && clothContext.hoodiePhysics)
      ? clothContext.hoodiePhysics
      : (useClonePhys
          ? chibiCloneHoodiePhysics
          : (window.chibiHoodiePhysics || _createDefaultHoodiePhysState()));
    const pAngle = isLocal ? 0.0 : (hPhys.pitch || 0.0);
    const yAngle = isLocal ? 0.0 : (hPhys.yaw || 0.0);
    const rAngle = isLocal ? 0.0 : (hPhys.roll || 0.0);
    const yawLagTerm = isLocal ? 0.0 : ((hPhys.yawLag || 0.0) * 0.05);
    const effPhase = isLocal ? 0.0 : phase;

    const computeSuitDisp = (w) => {
      if (isLocal || w <= 0.001) return [0.0, 0.0, 0.0];
      const wTail = Math.max(0.0, (w - 0.34) / 0.66);
      const wPrimary = wTail * (0.45 + 0.55 * wTail);
      const wWhip = wTail * wTail;
      const bounceY = Math.sin(effPhase * 2.0) * 0.0025 * wTail * s;
      const dx = (hPhys.gx * 0.12 * wPrimary + hPhys.tx * 0.12 * wWhip + hPhys.airX * 0.20 * wTail + (yAngle * 0.012 + rAngle * 0.010 + yawLagTerm) * wTail) * s;
      const dy = (hPhys.gy * 0.12 * wPrimary + hPhys.ty * 0.12 * wWhip + hPhys.airY * 0.20 * wTail) * s + bounceY;
      const dz = (hPhys.gz * 0.12 * wPrimary + hPhys.tz * 0.12 * wWhip + hPhys.airZ * 0.20 * wTail - pAngle * 0.015 * wTail) * s;
      return [dx, dy, dz];
    };

    const suitStride = _computeGarmentLegStride(bodyColliderData, torsoRight, torsoFwd, 0.18, !isLocal);
    const eqClothingSuit = (!isLocal && !useClonePhys && typeof getCharacterEquippedClothingState === "function")
      ? getCharacterEquippedClothingState(false)
      : null;
    const wearSkirtUnderSuit = !isLocal && !!(
      (clothContext && clothContext.wearSkirt !== undefined)
        ? clothContext.wearSkirt
        : (eqClothingSuit && eqClothingSuit.wearSkirt)
    );

    let clampPointOutsideActiveSkirt = null;
    if (wearSkirtUnderSuit) {
      let worldRings = (clothContext && Array.isArray(clothContext._cachedSkirtEnvelope) && clothContext._cachedSkirtEnvelope.length >= 2)
        ? clothContext._cachedSkirtEnvelope
        : null;
      if (!worldRings) {
        const torsoRatioSk = Math.max(0.75, Math.min(1.15, torsoLen / (0.27 * s)));
        const waistOriginSk = [
          baseGroin[0] + torsoUp[0] * (torsoLen * 0.41),
          baseGroin[1] + torsoUp[1] * (torsoLen * 0.41),
          baseGroin[2] + torsoUp[2] * (torsoLen * 0.41)
        ];
        const skRingsDef = _getBlackPleatedSkirtRingsDef(s, torsoRatioSk, "suit");
        const NUM_PLEATS_SK = 18;
        const skStride = _computeGarmentLegStride(bodyColliderData, torsoRight, torsoFwd, 0.44, true);
        const airFlareSk = hPhys.airFlare || 0.0;
        worldRings = [];
        for (let sr = 0; sr < skRingsDef.length; sr++) {
          const sLvl = skRingsDef[sr];
          const sw = sLvl.t;
          const wPrimarySk = sw * (0.48 + 0.52 * sw);
          const wWhipSk = sw * sw * (0.40 + 0.60 * sw);
          const coatDampSk = 0.48 + 0.52 * Math.max(0.0, (sw - 0.30) / 0.70);
          const bounceYSk = Math.sin(effPhase * 2.0) * 0.0055 * sw * s * coatDampSk;
          const sbDisp = [
            (hPhys.gx * 0.24 * coatDampSk * wPrimarySk + hPhys.tx * 0.28 * coatDampSk * wWhipSk + hPhys.airX * 0.45 * coatDampSk * sw + (yAngle * 0.024 * coatDampSk + rAngle * 0.016 * coatDampSk + yawLagTerm * 1.2 * coatDampSk) * sw) * s,
            (hPhys.gy * 0.24 * coatDampSk * wPrimarySk + hPhys.ty * 0.28 * coatDampSk * wWhipSk + hPhys.airY * 0.45 * coatDampSk * sw) * s + bounceYSk,
            (hPhys.gz * 0.24 * coatDampSk * wPrimarySk + hPhys.tz * 0.28 * coatDampSk * wWhipSk + hPhys.airZ * 0.45 * coatDampSk * sw - pAngle * 0.028 * coatDampSk * sw) * s
          ];
          const flareDampSk = 0.42 + 0.58 * Math.max(0.0, (sw - 0.35) / 0.65);
          const sFlare = (airFlareSk * 0.24 + Math.abs(yAngle) * 0.012) * sw * s * flareDampSk;
          const ringPts = [];
          for (let p = 0; p < NUM_PLEATS_SK; p++) {
            const ang = ((p + 0.02) / NUM_PLEATS_SK) * Math.PI * 2.0;
            const sinA = Math.sin(ang);
            const cosA = Math.cos(ang);
            const rz = (cosA >= 0.0) ? sLvl.rzF : sLvl.rzB;
            const skD = _computeSkirtVertexDisplacement(sinA, cosA, sw, 0.18, s, sbDisp, skStride, 0.042, effPhase, 0.003, 0.28, 0.30, 0.25, 0.20, 0.72);
            const slx = sinA * (sLvl.rx + sLvl.pleatDepth + sFlare) + sbDisp[0] + skD.legSidePush;
            const sly = sLvl.dy + sbDisp[1] + skD.rippleY + (skD.legFrontTent * 0.14 + skD.legBackTent * 0.10);
            const slz = sLvl.cy + cosA * (rz + sLvl.pleatDepth + sFlare) + skD.effDispZ + (skD.legFrontTent * 0.80 - skD.legBackTent * 0.70);
            const wx = waistOriginSk[0] + torsoRight[0] * slx + torsoUp[0] * sly + torsoFwd[0] * slz;
            const wy = waistOriginSk[1] + torsoRight[1] * slx + torsoUp[1] * sly + torsoFwd[1] * slz;
            const wz = waistOriginSk[2] + torsoRight[2] * slx + torsoUp[2] * sly + torsoFwd[2] * slz;
            const hint = (sr >= 2) ? [torsoRight[0] * sinA + torsoFwd[0] * cosA, 0.0, torsoRight[2] * sinA + torsoFwd[2] * cosA] : null;
            ringPts.push(clampPointOutsideChibiBodyForCloth(wx, wy, wz, bodyColliderData, sLvl.clr, false, hint));
          }
          worldRings.push(ringPts);
        }
      }
      clampPointOutsideActiveSkirt = _buildSkirtEnvelopeClampFn(
        worldRings, collarBaseX, collarBaseY, collarBaseZ, torsoRight, torsoUp, torsoFwd, s
      );
    }

    // 1. Tailored Double-Breasted Jacket Body
    const suitSkirtEase = wearSkirtUnderSuit
      ? [
          { rx: 0.000 * s, rzF: 0.000 * s, rzB: 0.000 * s },
          { rx: 0.000 * s, rzF: 0.000 * s, rzB: 0.000 * s },
          { rx: 0.000 * s, rzF: 0.000 * s, rzB: 0.000 * s },
          { rx: 0.000 * s, rzF: 0.000 * s, rzB: 0.000 * s },
          { rx: 0.002 * s, rzF: 0.002 * s, rzB: 0.002 * s },
          { rx: 0.005 * s, rzF: 0.004 * s, rzB: 0.004 * s },
          { rx: 0.008 * s, rzF: 0.007 * s, rzB: 0.007 * s },
          { rx: 0.010 * s, rzF: 0.009 * s, rzB: 0.009 * s }
        ]
      : null;
    const N_COLS = 36;
    const suitLevels = [
      { dy:  0.002 * s * torsoRatio, rx: 0.072 * s, rzF: 0.064 * s, rzB: 0.060 * s, t: 0.00, clr: 0.0065, gap: 0.42 },
      { dy: -0.026 * s * torsoRatio, rx: 0.116 * s, rzF: 0.077 * s, rzB: 0.071 * s, t: 0.08, clr: 0.0085, gap: 0.24 },
      { dy: -0.064 * s * torsoRatio, rx: 0.108 * s, rzF: 0.086 * s, rzB: 0.073 * s, t: 0.20, clr: 0.0095, gap: 0.05 },
      { dy: -0.104 * s * torsoRatio, rx: 0.098 * s, rzF: 0.082 * s, rzB: 0.070 * s, t: 0.34, clr: 0.0105, gap: 0.00 },
      { dy: -0.146 * s * torsoRatio, rx: 0.096 * s + (suitSkirtEase ? suitSkirtEase[4].rx : 0), rzF: 0.082 * s + (suitSkirtEase ? suitSkirtEase[4].rzF : 0), rzB: 0.076 * s + (suitSkirtEase ? suitSkirtEase[4].rzB : 0), t: 0.50, clr: 0.0110, gap: 0.00 },
      { dy: -0.192 * s * torsoRatio, rx: 0.112 * s + (suitSkirtEase ? suitSkirtEase[5].rx : 0), rzF: 0.090 * s + (suitSkirtEase ? suitSkirtEase[5].rzF : 0), rzB: 0.091 * s + (suitSkirtEase ? suitSkirtEase[5].rzB : 0), t: 0.68, clr: 0.0115, gap: 0.00 },
      { dy: -0.234 * s * torsoRatio, rx: 0.118 * s + (suitSkirtEase ? suitSkirtEase[6].rx : 0), rzF: 0.094 * s + (suitSkirtEase ? suitSkirtEase[6].rzF : 0), rzB: 0.095 * s + (suitSkirtEase ? suitSkirtEase[6].rzB : 0), t: 0.85, clr: 0.0120, gap: 0.00 },
      { dy: -0.272 * s * torsoRatio, rx: 0.121 * s + (suitSkirtEase ? suitSkirtEase[7].rx : 0), rzF: 0.097 * s + (suitSkirtEase ? suitSkirtEase[7].rzF : 0), rzB: 0.098 * s + (suitSkirtEase ? suitSkirtEase[7].rzB : 0), t: 1.00, clr: 0.0125, gap: 0.00 }
    ];

    const bodyRings = [];
    const innerHemRing = [];
    const neckInnerRing = [];

    const evalTorsoLevelPt = (lvl, ang) => {
      const sinA = Math.sin(ang);
      const cosA = Math.cos(ang);
      const rz = cosA >= 0.0 ? lvl.rzF : lvl.rzB;
      const bDisp = computeSuitDisp(lvl.t);
      const skD = _computeSkirtVertexDisplacement(
        sinA, cosA, lvl.t, 0.50, s, bDisp, suitStride, 0.048,
        effPhase, 0.0, 0.0, 0.0, 0.0, 0.0, 0.25
      );
      const wFront = Math.max(0.0, cosA);
      const wBack = Math.max(0.0, -cosA);
      const frontLegPush = skD.legFrontTent * wFront * 0.48;
      const backLegPush  = skD.legBackTent  * wBack  * 0.42;

      const lx = sinA * lvl.rx + bDisp[0] + skD.legSidePush * 0.35;
      const ly = lvl.dy + bDisp[1] + (frontLegPush * 0.06 + backLegPush * 0.05);
      const lz = cosA * rz + skD.effDispZ + (frontLegPush - backLegPush);
      let pos = torsoPt(lx, ly, lz);
      const pushHint = (lvl.t >= 0.50)
        ? [torsoRight[0] * sinA * 0.25 + torsoFwd[0] * (cosA >= 0.0 ? 1.0 : -1.0), 0.0, torsoRight[2] * sinA * 0.25 + torsoFwd[2] * (cosA >= 0.0 ? 1.0 : -1.0)]
        : null;
      if (clampPointOutsideActiveSkirt && lvl.t >= 0.45) {
        const skClr = (0.0075 + 0.0045 * Math.max(0.0, (lvl.t - 0.45) / 0.55)) * s;
        pos = clampPointOutsideActiveSkirt(pos, skClr);
      }
      return { pos, sinA, cosA, pushHint };
    };

    const evalLayeredSuitPt = (rFloat, ang, extraOut = 0.0) => {
      const r0 = Math.max(0, Math.min(suitLevels.length - 2, Math.floor(rFloat)));
      const r1 = r0 + 1;
      const tR = Math.max(0.0, Math.min(1.0, rFloat - r0));
      const L0 = suitLevels[r0], L1 = suitLevels[r1];
      const interpLvl = {
        dy:  L0.dy  * (1.0 - tR) + L1.dy  * tR,
        rx:  L0.rx  * (1.0 - tR) + L1.rx  * tR,
        rzF: L0.rzF * (1.0 - tR) + L1.rzF * tR,
        rzB: L0.rzB * (1.0 - tR) + L1.rzB * tR,
        t:   L0.t   * (1.0 - tR) + L1.t   * tR,
        clr: L0.clr * (1.0 - tR) + L1.clr * tR
      };
      const ptData = evalTorsoLevelPt(interpLvl, ang);
      let vx = ptData.pos[0], vy = ptData.pos[1], vz = ptData.pos[2];
      if (!isLocal && interpLvl.clr > 0.0) {
        const clamped = clampPointOutsideChibiBodyForCloth(vx, vy, vz, bodyColliderData, interpLvl.clr, false, ptData.pushHint);
        vx = clamped[0]; vy = clamped[1]; vz = clamped[2];
      }
      if (Math.abs(extraOut) > 1e-6) {
        const rdx = torsoRight[0] * ptData.sinA + torsoFwd[0] * ptData.cosA;
        const rdy = torsoRight[1] * ptData.sinA + torsoFwd[1] * ptData.cosA;
        const rdz = torsoRight[2] * ptData.sinA + torsoFwd[2] * ptData.cosA;
        const rLen = Math.hypot(rdx, rdy, rdz) || 1.0;
        vx += (rdx / rLen) * extraOut;
        vy += (rdy / rLen) * extraOut;
        vz += (rdz / rLen) * extraOut;
      }
      return [vx, vy, vz];
    };

    for (let rIdx = 0; rIdx < suitLevels.length; rIdx++) {
      const lvl = suitLevels[rIdx];
      const row = [];
      const startAng = lvl.gap;
      const endAng = Math.PI * 2.0 - lvl.gap;

      for (let j = 0; j < N_COLS; j++) {
        const frac = j / (N_COLS - 1);
        const ang = startAng + frac * (endAng - startAng);
        const ptData = evalTorsoLevelPt(lvl, ang);

        let ao = 0.0;
        if (lvl.t >= 0.30 && ptData.cosA > 0.55 && ptData.sinA < -0.42 && ptData.sinA > -0.58) {
          ao += (1.0 - Math.abs(ptData.sinA + 0.49) / 0.09) * 0.065;
        }
        if (rIdx === suitLevels.length - 1) ao += 0.025;

        const col = pinstripeColor(ang, ao, false);
        const outIdx = addV(ptData.pos[0], ptData.pos[1], ptData.pos[2], col, lvl.clr, false, ptData.pushHint);
        row.push(outIdx);

        if (rIdx === 0) {
          const inNeck = torsoPt(
            ptData.sinA * (lvl.rx * 0.84),
            lvl.dy - 0.012 * s,
            ptData.cosA * ((ptData.cosA >= 0 ? lvl.rzF : lvl.rzB) * 0.84)
          );
          neckInnerRing.push(addV(inNeck[0], inNeck[1], inNeck[2], colInner, 0.002));
        }

        if (rIdx === suitLevels.length - 1) {
          const ox = outV[outIdx * 3], oy = outV[outIdx * 3 + 1], oz = outV[outIdx * 3 + 2];
          const radX = torsoRight[0] * ptData.sinA + torsoFwd[0] * ptData.cosA;
          const radY = torsoRight[1] * ptData.sinA + torsoFwd[1] * ptData.cosA;
          const radZ = torsoRight[2] * ptData.sinA + torsoFwd[2] * ptData.cosA;
          const inX = ox - radX * (0.0045 * s) + torsoUp[0] * (0.0015 * s);
          const inY = oy - radY * (0.0045 * s) + torsoUp[1] * (0.0015 * s);
          const inZ = oz - radZ * (0.0045 * s) + torsoUp[2] * (0.0015 * s);
          innerHemRing.push(addV(inX, inY, inZ, colInner, 0.0));
        }
      }
      bodyRings.push(row);
    }

    for (let r = 0; r < bodyRings.length - 1; r++) {
      const r0 = bodyRings[r];
      const r1 = bodyRings[r + 1];
      for (let j = 0; j < N_COLS - 1; j++) {
        addQuad(r0[j], r1[j], r1[j + 1], r0[j + 1]);
      }
      if (suitLevels[r].gap <= 0.05 && suitLevels[r + 1].gap === 0.0) {
        addQuad(r0[N_COLS - 1], r1[N_COLS - 1], r1[0], r0[0]);
      }
    }
    for (let j = 0; j < N_COLS - 1; j++) {
      addQuad(neckInnerRing[j], bodyRings[0][j], bodyRings[0][j + 1], neckInnerRing[j + 1]);
      addQuad(bodyRings[bodyRings.length - 1][j], innerHemRing[j], innerHemRing[j + 1], bodyRings[bodyRings.length - 1][j + 1]);
    }
    addQuad(bodyRings[bodyRings.length - 1][N_COLS - 1], innerHemRing[N_COLS - 1], innerHemRing[0], bodyRings[bodyRings.length - 1][0]);

    // 2. Standing Back Collar + Symmetrical 3D Notched Lapels + Overlapping Front Flap
    const N_COLLAR_SEG = 14;
    const colTopRing = [], colBotRing = [], colInRing = [];
    for (let i = 0; i <= N_COLLAR_SEG; i++) {
      const frac = i / N_COLLAR_SEG;
      const ang = 0.42 + frac * (Math.PI * 2.0 - 0.84);
      const sA = Math.sin(ang);
      const cA = Math.cos(ang);
      const edgeFade = Math.sin(frac * Math.PI);
      const liftH = (0.011 + 0.014 * edgeFade) * s;
      const radR = (0.072 + 0.008 * edgeFade) * s;
      const radZ = (cA >= 0 ? 0.064 : 0.065) * s + 0.007 * edgeFade * s;

      const pTop = torsoPt(sA * radR, liftH, cA * radZ);
      const pBot = torsoPt(sA * (radR + 0.008 * s), liftH - 0.022 * s, cA * (radZ + 0.007 * s));
      const pIn  = torsoPt(sA * (radR * 0.84), liftH - 0.006 * s, cA * (radZ * 0.84));
      colTopRing.push(addV(pTop[0], pTop[1], pTop[2], pinstripeColor(ang, 0.02, true), 0.006));
      colBotRing.push(addV(pBot[0], pBot[1], pBot[2], pinstripeColor(ang, 0.01, true), 0.007));
      colInRing.push(addV(pIn[0], pIn[1], pIn[2], colInner, 0.002));
    }
    for (let i = 0; i < N_COLLAR_SEG; i++) {
      addQuad(colTopRing[i], colBotRing[i], colBotRing[i + 1], colTopRing[i + 1]);
      addQuad(colInRing[i], colTopRing[i], colTopRing[i + 1], colInRing[i + 1]);
    }

    // 2A. Overlapping Double-Breasted Front Panel Mesh
    const flapRowSpecs = [
      { rF: 2.15, angEdge:  0.00, angMerge: 0.52 },
      { rF: 2.70, angEdge: -0.23, angMerge: 0.52 },
      { rF: 3.25, angEdge: -0.45, angMerge: 0.52 },
      { rF: 4.00, angEdge: -0.47, angMerge: 0.50 },
      { rF: 5.00, angEdge: -0.48, angMerge: 0.50 },
      { rF: 6.00, angEdge: -0.49, angMerge: 0.50 },
      { rF: 7.00, angEdge: -0.50, angMerge: 0.50 }
    ];
    const N_FLAP_COLS = 10;
    const flapStepBaseCol = [];
    const flapTopRows = [];
    const flapThickness = 0.0052 * s;

    for (let fr = 0; fr < flapRowSpecs.length; fr++) {
      const fSpec = flapRowSpecs[fr];
      const pEdgeBase = evalLayeredSuitPt(fSpec.rF, fSpec.angEdge - 0.024, 0.0003 * s);
      flapStepBaseCol.push(addV(pEdgeBase[0], pEdgeBase[1], pEdgeBase[2], colSeamAO, 0.0));

      const fRow = [];
      for (let fc = 0; fc < N_FLAP_COLS; fc++) {
        const u = fc / (N_FLAP_COLS - 1);
        const ang = fSpec.angEdge + u * (fSpec.angMerge - fSpec.angEdge);

        const mergeFade = u <= 0.74 ? 1.0 : Math.max(0.0, 1.0 - (u - 0.74) / 0.26);
        const extraOut = flapThickness * (mergeFade * mergeFade * (3.0 - 2.0 * mergeFade));

        let colVert = pinstripeColor(ang, 0.0, false);
        if (fc === 0) {
          colVert = colLapelHi;
        } else if (fr === flapRowSpecs.length - 1) {
          colVert = pinstripeColor(ang, 0.025, false);
        }

        const pSurf = evalLayeredSuitPt(fSpec.rF, ang, extraOut);
        fRow.push(addV(pSurf[0], pSurf[1], pSurf[2], colVert, 0.0));
      }
      flapTopRows.push(fRow);
    }

    for (let fr = 0; fr < flapRowSpecs.length - 1; fr++) {
      addQuad(flapStepBaseCol[fr], flapStepBaseCol[fr + 1], flapTopRows[fr + 1][0], flapTopRows[fr][0]);
      const r0 = flapTopRows[fr];
      const r1 = flapTopRows[fr + 1];
      for (let fc = 0; fc < N_FLAP_COLS - 1; fc++) {
        addQuad(r0[fc], r1[fc], r1[fc + 1], r0[fc + 1]);
      }
    }
    {
      const lastR = flapRowSpecs.length - 1;
      const fSpec = flapRowSpecs[lastR];
      const botInRow = [];
      for (let fc = 0; fc < N_FLAP_COLS; fc++) {
        const u = fc / (N_FLAP_COLS - 1);
        const ang = fSpec.angEdge + u * (fSpec.angMerge - fSpec.angEdge);
        const pIn = evalLayeredSuitPt(fSpec.rF, ang, 0.0002 * s);
        botInRow.push(addV(pIn[0], pIn[1], pIn[2], colInner, 0.0));
      }
      for (let fc = 0; fc < N_FLAP_COLS - 1; fc++) {
        addQuad(flapTopRows[lastR][fc], botInRow[fc], botInRow[fc + 1], flapTopRows[lastR][fc + 1]);
      }
    }

    // 2B. Symmetrical Left & Right 3D Notched Suit Lapels
    const buildSymmetricalSuitLapel = (side) => {
      const isOver = side > 0;
      const lapelRows = isOver
        ? [
            { rF: 0.00, angIn:  0.42, angOut:  0.58 },
            { rF: 0.58, angIn:  0.31, angOut:  0.56 },
            { rF: 0.85, angIn:  0.26, angOut:  0.74 },
            { rF: 1.55, angIn:  0.12, angOut:  0.58 },
            { rF: 2.15, angIn:  0.00, angOut:  0.40 },
            { rF: 2.70, angIn: -0.23, angOut:  0.12 },
            { rF: 3.25, angIn: -0.45, angOut: -0.22 }
          ]
        : [
            { rF: 0.00, angIn: -0.42, angOut: -0.58 },
            { rF: 0.58, angIn: -0.31, angOut: -0.56 },
            { rF: 0.85, angIn: -0.26, angOut: -0.74 },
            { rF: 1.55, angIn: -0.12, angOut: -0.58 },
            { rF: 2.15, angIn:  0.00, angOut: -0.40 },
            { rF: 2.65, angIn:  0.10, angOut: -0.26 }
          ];

      const lHeight = isOver ? (flapThickness + 0.0022 * s) : (0.0028 * s);
      const lGrid = [];
      for (let lr = 0; lr < lapelRows.length; lr++) {
        const lSpec = lapelRows[lr];
        const tipFade = (isOver && lr === lapelRows.length - 1) ? (flapThickness + 0.0006 * s) : lHeight;
        const pInBase  = evalLayeredSuitPt(lSpec.rF, lSpec.angIn, isOver && lr >= 4 ? flapThickness * 0.85 : 0.0004 * s);
        const pInTop   = evalLayeredSuitPt(lSpec.rF, lSpec.angIn, tipFade);
        const pMidTop  = evalLayeredSuitPt(lSpec.rF, (lSpec.angIn + lSpec.angOut) * 0.5, tipFade);
        const pOutTop  = evalLayeredSuitPt(lSpec.rF, lSpec.angOut, tipFade * 0.92);
        const pOutBase = evalLayeredSuitPt(lSpec.rF, lSpec.angOut + side * 0.022, isOver && lr >= 4 ? flapThickness * 0.85 : 0.0003 * s);
        const cFace = pinstripeColor(lSpec.angOut * 0.5, -0.005, true);
        lGrid.push([
          addV(pInBase[0],  pInBase[1],  pInBase[2],  colSeamAO, 0.0),
          addV(pInTop[0],   pInTop[1],   pInTop[2],   colLapelHi, 0.0),
          addV(pMidTop[0],  pMidTop[1],  pMidTop[2],  cFace, 0.0),
          addV(pOutTop[0],  pOutTop[1],  pOutTop[2],  colLapelHi, 0.0),
          addV(pOutBase[0], pOutBase[1], pOutBase[2], colSeamAO, 0.0)
        ]);
      }
      for (let lr = 0; lr < lGrid.length - 1; lr++) {
        const g0 = lGrid[lr], g1 = lGrid[lr + 1];
        for (let c = 0; c < 4; c++) {
          if (side > 0) {
            addQuad(g0[c], g1[c], g1[c + 1], g0[c + 1]);
          } else {
            addQuad(g0[c + 1], g1[c + 1], g1[c], g0[c]);
          }
        }
      }
    };
    buildSymmetricalSuitLapel(-1.0);
    buildSymmetricalSuitLapel(1.0);

    // 2C. Two 3D Raised Hip Pocket Flaps
    for (const pSide of [1.0, -1.0]) {
      const angStart = pSide * 0.53;
      const angEnd   = pSide * 0.84;
      const rTop = 4.62;
      const rBot = 5.26;
      const N_PK = 5;
      const pkOut = 0.0042 * s;
      const topBase = [], topFace = [], botFace = [], botBase = [];
      for (let k = 0; k < N_PK; k++) {
        const u = k / (N_PK - 1);
        const ang = angStart + u * (angEnd - angStart);
        const pTB = evalLayeredSuitPt(rTop, ang, 0.0004 * s);
        const pTF = evalLayeredSuitPt(rTop, ang, pkOut);
        const pBF = evalLayeredSuitPt(rBot, ang, pkOut * 1.05);
        const pBB = evalLayeredSuitPt(rBot, ang, 0.0004 * s);
        const cPk = pinstripeColor(ang, -0.008, true);
        topBase.push(addV(pTB[0], pTB[1], pTB[2], colSeamAO, 0.0));
        topFace.push(addV(pTF[0], pTF[1], pTF[2], colLapelHi, 0.0));
        botFace.push(addV(pBF[0], pBF[1], pBF[2], cPk, 0.0));
        botBase.push(addV(pBB[0], pBB[1], pBB[2], colSeamAO, 0.0));
      }
      for (let k = 0; k < N_PK - 1; k++) {
        if (pSide > 0) {
          addQuad(topBase[k], topFace[k], topFace[k + 1], topBase[k + 1]);
          addQuad(topFace[k], botFace[k], botFace[k + 1], topFace[k + 1]);
          addQuad(botFace[k], botBase[k], botBase[k + 1], botFace[k + 1]);
        } else {
          addQuad(topBase[k + 1], topFace[k + 1], topFace[k], topBase[k]);
          addQuad(topFace[k + 1], botFace[k + 1], botFace[k], topFace[k]);
          addQuad(botFace[k + 1], botBase[k + 1], botBase[k], botFace[k]);
        }
      }
      if (pSide > 0) {
        addQuad(topBase[0], botBase[0], botFace[0], topFace[0]);
        addQuad(topFace[N_PK - 1], botFace[N_PK - 1], botBase[N_PK - 1], topBase[N_PK - 1]);
      } else {
        addQuad(topFace[0], botFace[0], botBase[0], topBase[0]);
        addQuad(topBase[N_PK - 1], botBase[N_PK - 1], botFace[N_PK - 1], topFace[N_PK - 1]);
      }
    }

    // 2D. Narrow Flush 3D Center Back Vent Slit
    {
      const ventSpecs = [
        { rF: 5.05, hScale: 0.00 },
        { rF: 5.55, hScale: 0.45 },
        { rF: 6.25, hScale: 0.85 },
        { rF: 7.00, hScale: 1.00 }
      ];
      const ventColsSpec = [
        { dAng: -0.045, off: 0.0000, shade: 0.000, isAO: false },
        { dAng: -0.022, off: 0.0004, shade: 0.000, isAO: false },
        { dAng: -0.008, off: 0.0011, shade: -0.008, isAO: false },
        { dAng:  0.002, off: 0.0013, shade: -0.010, isAO: false },
        { dAng:  0.012, off: 0.0000, shade: 0.000, isAO: true  },
        { dAng:  0.026, off: 0.0000, shade: 0.014, isAO: false },
        { dAng:  0.045, off: 0.0000, shade: 0.000, isAO: false }
      ];
      const ventGrid = [];
      for (let vr = 0; vr < ventSpecs.length; vr++) {
        const vs = ventSpecs[vr];
        const hemAO = (vr === ventSpecs.length - 1) ? 0.025 : 0.0;
        const vRow = [];
        for (let vc = 0; vc < ventColsSpec.length; vc++) {
          const cs = ventColsSpec[vc];
          const ang = Math.PI + cs.dAng;
          const extraOut = 0.0005 * s + cs.off * vs.hScale * s;
          let colV;
          if (cs.isAO && vs.hScale > 0.15) {
            colV = colSeamAO;
          } else {
            const aoAdj = hemAO + cs.shade * vs.hScale;
            colV = [
              Math.max(0.07, colSuitBase[0] - aoAdj),
              Math.max(0.07, colSuitBase[1] - aoAdj),
              Math.max(0.08, colSuitBase[2] - aoAdj)
            ];
          }
          const pV = evalLayeredSuitPt(vs.rF, ang, extraOut);
          vRow.push(addV(pV[0], pV[1], pV[2], colV, 0.0));
        }
        ventGrid.push(vRow);
      }

      for (let vr = 0; vr < ventSpecs.length - 1; vr++) {
        const r0 = ventGrid[vr];
        const r1 = ventGrid[vr + 1];
        for (let vc = 0; vc < ventColsSpec.length - 1; vc++) {
          addQuad(r0[vc], r1[vc], r1[vc + 1], r0[vc + 1]);
        }
      }

      const lastVR = ventSpecs.length - 1;
      const botInVent = [];
      for (let vc = 0; vc < ventColsSpec.length; vc++) {
        const ang = Math.PI + ventColsSpec[vc].dAng;
        const pIn = evalLayeredSuitPt(7.00, ang, 0.0005 * s);
        botInVent.push(addV(pIn[0], pIn[1], pIn[2], colInner, 0.0));
      }
      for (let vc = 0; vc < ventColsSpec.length - 1; vc++) {
        addQuad(ventGrid[lastVR][vc], botInVent[vc], botInVent[vc + 1], ventGrid[lastVR][vc + 1]);
      }
    }

    // 3. Four 3D Tortoiseshell Amber-Brown Buttons
    const getVert3 = (vIdx) => [outV[vIdx * 3], outV[vIdx * 3 + 1], outV[vIdx * 3 + 2]];
    const sampleFlapButtonPos = (frFloat, fcFloat) => {
      const r0 = Math.max(0, Math.min(flapTopRows.length - 2, Math.floor(frFloat)));
      const r1 = r0 + 1;
      const tR = frFloat - r0;
      const c0 = Math.max(0, Math.min(N_FLAP_COLS - 2, Math.floor(fcFloat)));
      const c1 = c0 + 1;
      const tC = fcFloat - c0;

      const p00 = getVert3(flapTopRows[r0][c0]);
      const p10 = getVert3(flapTopRows[r0][c1]);
      const p01 = getVert3(flapTopRows[r1][c0]);
      const p11 = getVert3(flapTopRows[r1][c1]);

      const bx = (p00[0] * (1.0 - tC) + p10[0] * tC) * (1.0 - tR) + (p01[0] * (1.0 - tC) + p11[0] * tC) * tR;
      const by = (p00[1] * (1.0 - tC) + p10[1] * tC) * (1.0 - tR) + (p01[1] * (1.0 - tC) + p11[1] * tC) * tR;
      const bz = (p00[2] * (1.0 - tC) + p10[2] * tC) * (1.0 - tR) + (p01[2] * (1.0 - tC) + p11[2] * tC) * tR;

      let maxFwdDelta = 0.0;
      const corners = [p00, p10, p01, p11];
      for (let k = 0; k < 4; k++) {
        const c = corners[k];
        const dFwd = (c[0] - bx) * torsoFwd[0] + (c[1] - by) * torsoFwd[1] + (c[2] - bz) * torsoFwd[2];
        if (dFwd > maxFwdDelta) maxFwdDelta = dFwd;
      }
      const lift = maxFwdDelta * 0.45 + 0.0030 * s;
      return [
        bx + torsoFwd[0] * lift,
        by + torsoFwd[1] * lift,
        bz + torsoFwd[2] * lift
      ];
    };

    const buttonPlacements = [
      { fr: 3.02, fc: 2.25 },
      { fr: 3.02, fc: 6.35 },
      { fr: 4.42, fc: 2.45 },
      { fr: 4.42, fc: 6.25 }
    ];
    for (let bi = 0; bi < buttonPlacements.length; bi++) {
      const bp = buttonPlacements[bi];
      const bPos = sampleFlapButtonPos(bp.fr, bp.fc);
      const bx = bPos[0];
      const by = bPos[1];
      const bz = bPos[2];
      const rBtn = 0.0076 * s;
      const bThick = 0.0038 * s;

      const vDome = addV(
        bx + torsoFwd[0] * bThick,
        by + torsoFwd[1] * bThick,
        bz + torsoFwd[2] * bThick,
        colBtnHi
      );
      const rimFront = [], rimBack = [];
      for (let j = 0; j < 8; j++) {
        const a = (j / 8) * Math.PI * 2.0;
        const cA = Math.cos(a), sA = Math.sin(a);
        const colB = (j % 2 === 0) ? colBtnRim : colBtnDark;
        rimFront.push(addV(
          bx + torsoRight[0] * (sA * rBtn) + torsoUp[0] * (cA * rBtn) + torsoFwd[0] * (bThick * 0.55),
          by + torsoRight[1] * (sA * rBtn) + torsoUp[1] * (cA * rBtn) + torsoFwd[1] * (bThick * 0.55),
          bz + torsoRight[2] * (sA * rBtn) + torsoUp[2] * (cA * rBtn) + torsoFwd[2] * (bThick * 0.55),
          colB
        ));
        rimBack.push(addV(
          bx + torsoRight[0] * (sA * rBtn * 1.08) + torsoUp[0] * (cA * rBtn * 1.08) - torsoFwd[0] * 0.0012 * s,
          by + torsoRight[1] * (sA * rBtn * 1.08) + torsoUp[1] * (cA * rBtn * 1.08) - torsoFwd[1] * 0.0012 * s,
          bz + torsoRight[2] * (sA * rBtn * 1.08) + torsoUp[2] * (cA * rBtn * 1.08) - torsoFwd[2] * 0.0012 * s,
          colSeamAO
        ));
      }
      for (let j = 0; j < 8; j++) {
        const nextJ = (j + 1) % 8;
        addTri(rimFront[j], vDome, rimFront[nextJ]);
        addQuad(rimBack[j], rimFront[j], rimFront[nextJ], rimBack[nextJ]);
      }
    }

    // 4. Structured Long Suit Sleeves
    const buildSuitSleeve = (pShoulder, pElbow, pHand, isLeft) => {
      if (!pShoulder || !pElbow || !pHand) return;
      const N_SLEEVE = 16;
      const side = isLeft ? -1.0 : 1.0;

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

      const dirUpper = norm3([pElbow[0] - pShoulder[0], pElbow[1] - pShoulder[1], pElbow[2] - pShoulder[2]], [side * 0.25, -0.96, 0]);
      const dirFore  = norm3([pHand[0] - pElbow[0], pHand[1] - pElbow[1], pHand[2] - pElbow[2]], dirUpper);
      const dirElbow = norm3([dirUpper[0] + dirFore[0], dirUpper[1] + dirFore[1], dirUpper[2] + dirFore[2]], dirUpper);

      const pArmhole = [
        pShoulder[0] - torsoRight[0] * (side * 0.015 * s) + torsoUp[0] * (0.005 * s),
        pShoulder[1] - torsoRight[1] * (side * 0.015 * s) + torsoUp[1] * (0.005 * s),
        pShoulder[2] - torsoRight[2] * (side * 0.015 * s) + torsoUp[2] * (0.005 * s)
      ];
      const dirArmhole = norm3([
        torsoRight[0] * side * 0.85 + dirUpper[0] * 0.35,
        torsoRight[1] * side * 0.85 + dirUpper[1] * 0.35 - 0.10,
        torsoRight[2] * side * 0.85 + dirUpper[2] * 0.35
      ], dirUpper);

      const slvDisp = computeSuitDisp(0.16);
      const stations = [
        { p: pArmhole,                       dir: dirArmhole,                                rx: 0.0515 * s, ry: 0.0550 * s, clamp: false, sag: 0.00, ao: 0.045, isIn: false },
        { p: pShoulder,                      dir: dirUpper,                                  rx: 0.0510 * s, ry: 0.0510 * s, clamp: false, sag: 0.05, ao: 0.000, isIn: false },
        { p: lerp3(pShoulder, pElbow, 0.34), dir: dirUpper,                                  rx: 0.0490 * s, ry: 0.0485 * s, clamp: true,  sag: 0.25, ao: 0.000, isIn: false },
        { p: lerp3(pShoulder, pElbow, 0.70), dir: dirUpper,                                  rx: 0.0460 * s, ry: 0.0455 * s, clamp: true,  sag: 0.45, ao: 0.000, isIn: false },
        { p: lerp3(pShoulder, pElbow, 0.88), dir: norm3(lerp3(dirUpper, dirElbow, 0.5)),     rx: 0.0445 * s, ry: 0.0440 * s, clamp: true,  sag: 0.55, ao: 0.005, isIn: false },
        { p: pElbow,                         dir: dirElbow,                                  rx: 0.0435 * s, ry: 0.0430 * s, clamp: true,  sag: 0.62, ao: 0.015, isIn: false },
        { p: lerp3(pElbow, pHand, 0.14),     dir: norm3(lerp3(dirElbow, dirFore, 0.5)),      rx: 0.0425 * s, ry: 0.0420 * s, clamp: true,  sag: 0.66, ao: 0.005, isIn: false },
        { p: lerp3(pElbow, pHand, 0.50),     dir: dirFore,                                   rx: 0.0405 * s, ry: 0.0400 * s, clamp: true,  sag: 0.80, ao: 0.000, isIn: false },
        { p: lerp3(pElbow, pHand, 0.85),     dir: dirFore,                                   rx: 0.0380 * s, ry: 0.0375 * s, clamp: true,  sag: 0.94, ao: 0.008, isIn: false },
        { p: lerp3(pElbow, pHand, 0.96),     dir: dirFore,                                   rx: 0.0370 * s, ry: 0.0365 * s, clamp: true,  sag: 1.00, ao: 0.025, isIn: false },
        { p: lerp3(pElbow, pHand, 0.86),     dir: dirFore,                                   rx: 0.0275 * s, ry: 0.0275 * s, clamp: false, sag: 0.94, ao: 0.000, isIn: true }
      ];

      let curU = cross3(torsoFwd, stations[0].dir);
      if (Math.hypot(curU[0], curU[1], curU[2]) < 1e-4) curU = cross3([0, 1, 0], stations[0].dir);
      curU = norm3(curU, [side, 0, 0]);
      let curV = norm3(cross3(stations[0].dir, curU), [0, 0, 1]);

      const rings = [];
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
        const ring = [];
        for (let j = 0; j < N_SLEEVE; j++) {
          const ang = (j / N_SLEEVE) * Math.PI * 2.0;
          const cosA = Math.cos(ang), sinA = Math.sin(ang);
          let vx = st.p[0] + (curU[0] * cosA * st.rx + curV[0] * sinA * st.ry) + slvDisp[0] * st.sag;
          let vy = st.p[1] + (curU[1] * cosA * st.rx + curV[1] * sinA * st.ry) + slvDisp[1] * st.sag;
          let vz = st.p[2] + (curU[2] * cosA * st.rx + curV[2] * sinA * st.ry) + slvDisp[2] * st.sag;
          if (st.clamp && !isLocal) {
            const c1 = clampPointOutsideSegmentCapsule(vx, vy, vz, pShoulder, pElbow, 0.046 * s, 0.039 * s, 0.0055 * s);
            const c2 = clampPointOutsideSegmentCapsule(c1[0], c1[1], c1[2], pElbow, pHand, 0.039 * s, 0.028 * s, 0.0050 * s);
            vx = c2[0]; vy = c2[1]; vz = c2[2];
          }
          const col = st.isIn ? colInner : pinstripeColor(ang * 0.5, st.ao, false);
          ring.push(addV(vx, vy, vz, col));
        }
        rings.push(ring);
      }

      for (let k = 0; k < rings.length - 1; k++) {
        const r0 = rings[k], r1 = rings[k + 1];
        for (let j = 0; j < N_SLEEVE; j++) {
          const nextJ = (j + 1) % N_SLEEVE;
          addQuad(r0[j], r0[nextJ], r1[nextJ], r1[j]);
        }
      }
    };

    buildSuitSleeve(leftArmPivot, leftElbowRot, leftHandRot, true);
    buildSuitSleeve(rightArmPivot, rightElbowRot, rightHandRot, false);

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

  function buildDoubleBreastedSuitIconMesh(rawVertices, rawColors, rawIndices) {
    const suitMesh = buildDoubleBreastedSuitMesh(
      [0, 0.336, 0],
      [0, -0.090, 0], [0, 0.170, 0],
      [0, 0.162, 0], [0, 0.212, 0],
      [-0.074, 0.124, 0], [-0.116, 0.012, -0.006], [-0.146, -0.095, 0.022],
      [ 0.074, 0.124, 0], [ 0.116, 0.012, -0.006], [ 0.146, -0.095, 0.022],
      1.0,
      0.0,
      false,
      [-0.052, -0.420, 0.0], [0.052, -0.420, 0.0],
      null
    );
    _appendCCWMeshAsCWIcon(suitMesh, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: true,
      colorMap: (r, g, b) => {
        if (r - b > 0.10) return [r, g, b];
        const lift = 1.16;
        return [
          Math.min(0.60, r * lift + 0.02),
          Math.min(0.62, g * lift + 0.02),
          Math.min(0.66, b * lift + 0.025)
        ];
      }
    });
  }

  window.buildDoubleBreastedSuitMesh = buildDoubleBreastedSuitMesh;
  window.buildDoubleBreastedSuitIconMesh = buildDoubleBreastedSuitIconMesh;
  if (window.CapsuleModel) {
    window.CapsuleModel.buildDoubleBreastedSuitMesh = buildDoubleBreastedSuitMesh;
    window.CapsuleModel.buildDoubleBreastedSuitIconMesh = buildDoubleBreastedSuitIconMesh;
  }
  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["double_breasted_suit"] = Object.assign({}, window.ItemRegistry["DOUBLE_BREASTED_SUIT"] || {}, {
    buildMesh: buildDoubleBreastedSuitMesh,
    buildIconMesh: buildDoubleBreastedSuitIconMesh
  });
  window.ItemRegistry["DOUBLE_BREASTED_SUIT"] = window.ItemRegistry["double_breasted_suit"];
})();
