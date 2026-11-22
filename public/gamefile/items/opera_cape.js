// === SEEDPLANET MODULE: JS/ITEMS/OPERA_CAPE.JS ===
// Asymmetric One-Shoulder Opera Cape (OPERA_CAPE) — worn 3D mesh & inventory icon mesh

(function() {
  const H = window._CapsuleClothHelpers || {};
  const _qNum = H._qNum;
  const _qVec3 = H._qVec3;
  const _wrapPhase2Pi = H._wrapPhase2Pi;
  const _getClothPhysKey = H._getClothPhysKey;
  const _cachedClothBuild = H._cachedClothBuild;
  const _createDefaultHoodiePhysState = H._createDefaultHoodiePhysState;
  const chibiCloneHoodiePhysics = H.chibiCloneHoodiePhysics;
  const _computeGarmentLegStride = H._computeGarmentLegStride;
  const _computeSkirtVertexDisplacement = H._computeSkirtVertexDisplacement;
  const _appendCCWMeshAsCWIcon = H._appendCCWMeshAsCWIcon;
  const clampPointOutsideSegmentCapsule = H.clampPointOutsideSegmentCapsule;
  const clampPointOutsideChibiBodyForCloth = H.clampPointOutsideChibiBodyForCloth || window.clampPointOutsideChibiBodyForCloth;

  function buildOperaCapeMesh(
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
    const key = "operaCape|" + (isLocal ? 1 : 0) + "|" + lod + "|" + _qNum(scale, 1000) + "|" + _qNum(_wrapPhase2Pi(phase), 500)
      + "|" + _qVec3(headP1) + "|" + _qVec3(chestP1) + "|" + _qVec3(chestP2) + "|" + _qVec3(neckP1) + "|" + _qVec3(neckP2)
      + "|" + _qVec3(leftArmPivot) + "|" + _qVec3(leftElbowRot) + "|" + _qVec3(leftHandRot)
      + "|" + _qVec3(rightArmPivot) + "|" + _qVec3(rightElbowRot) + "|" + _qVec3(rightHandRot)
      + "|" + _qVec3(leftFootRot) + "|" + _qVec3(rightFootRot)
      + "|" + _getClothPhysKey(clothContext, lod);
    return _cachedClothBuild(key, clothContext, () => _buildOperaCapeMeshRaw(
      headP1, chestP1, chestP2, neckP1, neckP2,
      leftArmPivot, leftElbowRot, leftHandRot,
      rightArmPivot, rightElbowRot, rightHandRot,
      scale, phase, isLocal, leftFootRot, rightFootRot, clothContext
    ));
  }

  function _buildOperaCapeMeshRaw(
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
    const ny = neckP1 ? neckP1[1] : (baseChest[1] + 0.008 * s);

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

    // Opera Cape Palette
    const colCapeOuter     = [0.082, 0.086, 0.102];
    const colCapeSheen     = [0.124, 0.130, 0.152];
    const colCapeEdge      = [0.062, 0.066, 0.080];
    const colLiningTeal    = [0.044, 0.124, 0.118];
    const colLiningDeep    = [0.025, 0.072, 0.070];
    const colMetalDark     = [0.220, 0.238, 0.265];
    const colMetalMid      = [0.440, 0.468, 0.508];
    const colMetalHi       = [0.735, 0.765, 0.810];
    const colMetalHole     = [0.075, 0.080, 0.092];

    const addV = (px, py, pz, col) => {
      const idx = (outV.length / 3) | 0;
      outV.push(px, py, pz);
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
    const yawLagTerm = isLocal ? 0.0 : ((hPhys.yawLag || 0.0) * 0.24);
    const effPhase = isLocal ? 0.0 : phase;

    const nowPerfSec = (typeof performance !== "undefined" ? performance.now() : Date.now()) * 0.001;
    const windTurb = isLocal ? 0.0 : (hPhys.windTurb || 0.0);
    const airFlare = isLocal ? 0.0 : (hPhys.airFlare || 0.0);
    const flutterT = nowPerfSec * (12.0 + windTurb * 14.0);
    const turbX = (!isLocal && windTurb > 0) ? Math.sin(flutterT) * (windTurb * 0.018) : 0.0;
    const turbY = (!isLocal && windTurb > 0) ? Math.sin(flutterT * 0.85) * (windTurb * 0.013) : 0.0;
    const turbZ = (!isLocal && windTurb > 0) ? Math.cos(flutterT * 1.1) * (windTurb * 0.018) : 0.0;

    const breezeT = nowPerfSec * 1.45;
    const breezeX = isLocal ? 0.0 : Math.sin(breezeT * 1.5) * 0.0042;
    const breezeZ = isLocal ? 0.0 : Math.cos(breezeT * 1.2) * 0.0045;
    const breezeY = isLocal ? 0.0 : Math.sin(breezeT * 1.8) * 0.0020;

    const pLHip  = clothContext && clothContext.leftLegPivot  ? clothContext.leftLegPivot  : [-0.052 * s, baseGroin[1], baseGroin[2]];
    const pLKnee = clothContext && clothContext.leftKneeRot   ? clothContext.leftKneeRot   : [-0.052 * s, baseGroin[1] - 0.15 * s, baseGroin[2]];
    const pLFoot = clothContext && clothContext.leftFootRot   ? clothContext.leftFootRot   : (leftFootRot  || [-0.052 * s, baseGroin[1] - 0.30 * s, baseGroin[2]]);
    const pRHip  = clothContext && clothContext.rightLegPivot ? clothContext.rightLegPivot : [ 0.052 * s, baseGroin[1], baseGroin[2]];
    const pRKnee = clothContext && clothContext.rightKneeRot  ? clothContext.rightKneeRot  : [ 0.052 * s, baseGroin[1] - 0.15 * s, baseGroin[2]];
    const pRFoot = clothContext && clothContext.rightFootRot  ? clothContext.rightFootRot  : (rightFootRot || [ 0.052 * s, baseGroin[1] - 0.30 * s, baseGroin[2]]);

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
      leftLegPivot: pLHip,
      leftKneeRot: pLKnee,
      leftFootRot: pLFoot,
      rightLegPivot: pRHip,
      rightKneeRot: pRKnee,
      rightFootRot: pRFoot,
      legRadiusBoost: 0.002,
      scale: s
    };

    const capeStride = _computeGarmentLegStride(clothContext, torsoRight, torsoFwd, 0.72, !isLocal);
    const strideAct = isLocal
      ? 0.0
      : Math.min(1.0, (capeStride.lFwd + capeStride.lBack + capeStride.rFwd + capeStride.rBack) / (0.13 * s));
    const physAct = isLocal
      ? 0.0
      : Math.min(1.0, Math.hypot(hPhys.gx || 0.0, hPhys.gz || 0.0) * 18.0 + Math.hypot(hPhys.tx || 0.0, hPhys.tz || 0.0) * 10.0 + Math.abs(pAngle) * 2.4 + Math.abs(yAngle) * 2.4);
    const motionIntensity = isLocal ? 0.0 : Math.min(1.0, Math.max(strideAct, physAct));

    const toTorsoLocal = (pt) => {
      const dx = pt[0] - collarBaseX, dy = pt[1] - collarBaseY, dz = pt[2] - collarBaseZ;
      return [
        dx * torsoRight[0] + dy * torsoRight[1] + dz * torsoRight[2],
        dx * torsoUp[0]    + dy * torsoUp[1]    + dz * torsoUp[2],
        dx * torsoFwd[0]   + dy * torsoFwd[1]   + dz * torsoFwd[2]
      ];
    };
    let armSwingX = 0.0, armSwingZ = 0.0;
    let elbLocal = null, handLocal = null, handTipWorld = null;
    let elbBackReach = 0.0, handBackReach = 0.0, armOutReach = 0.0;
    let elbAng = Math.PI * 0.5, handAng = Math.PI * 0.5;
    if (!isLocal && rightArmPivot && rightElbowRot) {
      const pvtLocal = toTorsoLocal(rightArmPivot);
      elbLocal = toTorsoLocal(rightElbowRot);
      handLocal = rightHandRot ? toTorsoLocal(rightHandRot) : elbLocal;
      if (rightHandRot) {
        const fdx = rightHandRot[0] - rightElbowRot[0];
        const fdy = rightHandRot[1] - rightElbowRot[1];
        const fdz = rightHandRot[2] - rightElbowRot[2];
        const fLen = Math.hypot(fdx, fdy, fdz) || 1.0;
        handTipWorld = [
          rightHandRot[0] + (fdx / fLen) * (0.030 * s),
          rightHandRot[1] + (fdy / fLen) * (0.030 * s),
          rightHandRot[2] + (fdz / fLen) * (0.030 * s)
        ];
      }
      const projX = elbLocal[0] - pvtLocal[0];
      const projZ = elbLocal[2] - pvtLocal[2];
      armSwingX = Math.max(-0.025 * s, Math.min(0.065 * s, (projX - 0.028 * s) * 0.65));
      armSwingZ = Math.max(-0.095 * s, Math.min(0.045 * s, projZ * 0.85));
      elbBackReach  = Math.max(0.0, -elbLocal[2] - 0.008 * s);
      handBackReach = Math.max(0.0, -handLocal[2] - 0.010 * s);
      armOutReach   = Math.max(0.0, elbLocal[0] - 0.116 * s, handLocal[0] - 0.146 * s);
      elbAng  = Math.atan2(elbLocal[0], elbLocal[2]);
      if (elbAng < 0.0) elbAng += Math.PI * 2.0;
      handAng = Math.atan2(handLocal[0], handLocal[2]);
      if (handAng < 0.0) handAng += Math.PI * 2.0;
    }

    const clampCapeOutsideArmSeg = (pt, segA, segB, radA, radB, clr, outDir) => {
      if (!segA || !segB) return pt;
      const abx = segB[0] - segA[0], aby = segB[1] - segA[1], abz = segB[2] - segA[2];
      const lenSq = abx * abx + aby * aby + abz * abz;
      let t = 0.0;
      if (lenSq > 1e-8) {
        t = ((pt[0] - segA[0]) * abx + (pt[1] - segA[1]) * aby + (pt[2] - segA[2]) * abz) / lenSq;
        if (t < 0.0) t = 0.0;
        else if (t > 1.0) t = 1.0;
      }
      const cx = segA[0] + abx * t;
      const cy = segA[1] + aby * t;
      const cz = segA[2] + abz * t;
      let dx = pt[0] - cx;
      let dy = pt[1] - cy;
      let dz = pt[2] - cz;
      let dist = Math.hypot(dx, dy, dz);
      const minR = radA * (1.0 - t) + radB * t + clr;
      if (dist < minR) {
        if (dist < 1e-5) {
          dx = outDir[0]; dy = outDir[1]; dz = outDir[2];
          dist = Math.hypot(dx, dy, dz) || 1.0;
        } else {
          const dotOut = dx * outDir[0] + dy * outDir[1] + dz * outDir[2];
          const minOutDot = dist * 0.62;
          if (dotOut < minOutDot) {
            const boost = minOutDot - dotOut;
            dx += outDir[0] * boost;
            dy += outDir[1] * boost;
            dz += outDir[2] * boost;
            dist = Math.hypot(dx, dy, dz) || 1.0;
          }
        }
        const push = minR / dist;
        return [cx + dx * push, cy + dy * push, cz + dz * push];
      }
      return pt;
    };

    const computeCapeDisp = (w) => {
      if (isLocal || w <= 0.001) return [0.0, 0.0, 0.0];
      const wEff = Math.max(0.0, (w - 0.04) / 0.96);
      const wPrimary = wEff * (0.50 + 0.50 * wEff);
      const wWhip = wEff * wEff * (0.38 + 0.62 * wEff);
      const wHem = wEff * Math.sqrt(wEff);
      const bounceY = Math.sin(effPhase * 2.0 - w * 1.1) * 0.013 * wEff * s;
      const dx = (
        hPhys.gx * 0.78 * wPrimary +
        hPhys.tx * 0.96 * wWhip +
        hPhys.airX * 1.15 * wEff +
        (yAngle * 0.075 + rAngle * 0.048 + yawLagTerm) * wEff +
        breezeX * wEff +
        turbX * wEff
      ) * s;
      const dy = (
        hPhys.gy * 0.64 * wPrimary +
        hPhys.ty * 0.82 * wWhip +
        hPhys.airY * 0.68 * wHem +
        breezeY * wEff +
        turbY * wEff
      ) * s + bounceY;
      const dz = (
        hPhys.gz * 0.85 * wPrimary +
        hPhys.tz * 1.12 * wWhip +
        hPhys.airZ * 1.15 * wEff -
        pAngle * 0.095 * wEff +
        breezeZ * wEff +
        turbZ * wEff
      ) * s;
      return [dx, dy, dz];
    };

    const clampOutsideSuitCollar = (pt, extraPad = 0.004 * s) => {
      const rx = pt[0] - collarBaseX, ry = pt[1] - collarBaseY, rz = pt[2] - collarBaseZ;
      const tx = rx * torsoRight[0] + ry * torsoRight[1] + rz * torsoRight[2];
      const ty = rx * torsoUp[0]    + ry * torsoUp[1]    + rz * torsoUp[2];
      const tz = rx * torsoFwd[0]   + ry * torsoFwd[1]   + rz * torsoFwd[2];
      if (ty < -0.028 * s || ty > 0.036 * s) return pt;
      const minRx = 0.096 * s + extraPad;
      const minRz = (tz >= 0.0 ? 0.080 : 0.094) * s + extraPad;
      const nx = tx / minRx, nz = tz / minRz;
      const rE = Math.hypot(nx, nz);
      if (rE < 1.0 && rE > 1e-4) {
        const sc = 1.0 / rE;
        return torsoPt(tx * sc, ty, tz * sc);
      }
      return pt;
    };

    // 1. Standing Velvet Collar
    {
      const ang0 = 0.22;
      const ang1 = Math.PI * 2.0 - 0.26;
      const nSeg = 22;
      const topOut = [], botOut = [], topIn = [], botIn = [];
      for (let i = 0; i <= nSeg; i++) {
        const u = i / nSeg;
        const ang = ang0 + u * (ang1 - ang0);
        const sA = Math.sin(ang);
        const cA = Math.cos(ang);
        const endTaper = Math.sin(u * Math.PI);
        const backWeight = Math.max(0.0, -cA);
        const env = Math.min(1.0, endTaper * (0.75 + 0.35 * backWeight));

        const hTop = (0.017 + 0.012 * env) * s;
        const hBot = -0.006 * s;
        const rOutX = (0.090 + 0.010 * env) * s;
        const rOutZ = (cA >= 0 ? 0.078 : 0.092) * s + 0.008 * env * s;
        const colThick = 0.0036 * s;

        let pTO = torsoPt(sA * rOutX, hTop, cA * rOutZ);
        let pBO = torsoPt(sA * (rOutX + 0.006 * s), hBot, cA * (rOutZ + 0.006 * s));
        pTO = clampPointOutsideChibiBodyForCloth(pTO[0], pTO[1], pTO[2], bodyColliderData, 0.012, false);
        pBO = clampPointOutsideChibiBodyForCloth(pBO[0], pBO[1], pBO[2], bodyColliderData, 0.013, false);
        pTO = clampOutsideSuitCollar(pTO, 0.0050 * s);
        pBO = clampOutsideSuitCollar(pBO, 0.0070 * s);

        const rdx = torsoRight[0] * sA + torsoFwd[0] * cA;
        const rdy = torsoRight[1] * sA + torsoFwd[1] * cA;
        const rdz = torsoRight[2] * sA + torsoFwd[2] * cA;
        const rL = Math.hypot(rdx, rdy, rdz) || 1.0;
        const nx = rdx / rL, nyN = rdy / rL, nz = rdz / rL;

        const pTI = [pTO[0] - nx * colThick, pTO[1] - nyN * colThick - 0.0008 * s, pTO[2] - nz * colThick];
        const pBI = [pBO[0] - nx * colThick, pBO[1] - nyN * colThick, pBO[2] - nz * colThick];

        topOut.push(addV(pTO[0], pTO[1], pTO[2], colCapeSheen));
        botOut.push(addV(pBO[0], pBO[1], pBO[2], colCapeOuter));
        topIn.push(addV(pTI[0], pTI[1], pTI[2], colCapeEdge));
        botIn.push(addV(pBI[0], pBI[1], pBI[2], colLiningDeep));
      }
      for (let i = 0; i < nSeg; i++) {
        addQuad(topOut[i], botOut[i], botOut[i + 1], topOut[i + 1]);
        addQuad(botIn[i],  topIn[i],  topIn[i + 1],  botIn[i + 1]);
        addQuad(topIn[i],  topOut[i], topOut[i + 1], topIn[i + 1]);
      }
      addQuad(topIn[0], botIn[0], botOut[0], topOut[0]);
      addQuad(topOut[nSeg], botOut[nSeg], botIn[nSeg], topIn[nSeg]);
    }

    // 2. One-Shoulder Asymmetric Opera Cape Body (Double-Sided 3D Shell Mesh)
    const capeLevels = [
      { dy:  0.004 * s * torsoRatio, rx: 0.103 * s, rzF: 0.085 * s, rzB: 0.098 * s, shiftX: 0.003 * s, angStart: 0.22, angEnd: 3.68, t: 0.00 },
      { dy: -0.022 * s * torsoRatio, rx: 0.140 * s, rzF: 0.095 * s, rzB: 0.102 * s, shiftX: 0.010 * s, angStart: 0.44, angEnd: 3.65, t: 0.08 },
      { dy: -0.058 * s * torsoRatio, rx: 0.153 * s, rzF: 0.100 * s, rzB: 0.105 * s, shiftX: 0.016 * s, angStart: 0.74, angEnd: 3.60, t: 0.18 },
      { dy: -0.095 * s * torsoRatio, rx: 0.161 * s, rzF: 0.103 * s, rzB: 0.106 * s, shiftX: 0.019 * s, angStart: 1.00, angEnd: 3.55, t: 0.28 },
      { dy: -0.130 * s * torsoRatio, rx: 0.166 * s, rzF: 0.106 * s, rzB: 0.108 * s, shiftX: 0.021 * s, angStart: 1.18, angEnd: 3.51, t: 0.36 },
      { dy: -0.168 * s * torsoRatio, rx: 0.171 * s, rzF: 0.108 * s, rzB: 0.111 * s, shiftX: 0.023 * s, angStart: 1.30, angEnd: 3.47, t: 0.45 },
      { dy: -0.215 * s * torsoRatio, rx: 0.176 * s, rzF: 0.110 * s, rzB: 0.115 * s, shiftX: 0.025 * s, angStart: 1.35, angEnd: 3.43, t: 0.56 },
      { dy: -0.275 * s * torsoRatio, rx: 0.182 * s, rzF: 0.112 * s, rzB: 0.120 * s, shiftX: 0.028 * s, angStart: 1.38, angEnd: 3.38, t: 0.70 },
      { dy: -0.340 * s * torsoRatio, rx: 0.189 * s, rzF: 0.115 * s, rzB: 0.127 * s, shiftX: 0.030 * s, angStart: 1.40, angEnd: 3.34, t: 0.85 },
      { dy: -0.408 * s * torsoRatio, rx: 0.196 * s, rzF: 0.118 * s, rzB: 0.134 * s, shiftX: 0.032 * s, angStart: 1.42, angEnd: 3.30, t: 1.00 }
    ];

    const N_CAPE_COLS = 18;
    const capeThick = 0.0036 * s;
    const outerGrid = [];
    const innerGrid = [];

    for (let r = 0; r < capeLevels.length; r++) {
      const lvl = capeLevels[r];
      const w = lvl.t;
      const wEff = Math.max(0.0, (w - 0.04) / 0.96);
      const bDisp = computeCapeDisp(w);
      const flare = isLocal ? 0.0 : ((airFlare * 0.65 + Math.abs(yAngle) * 0.034 + motionIntensity * 0.028) * wEff * s);
      const outRow = [];
      const inRow = [];

      for (let c = 0; c < N_CAPE_COLS; c++) {
        const u = c / (N_CAPE_COLS - 1);
        const ang = lvl.angStart + u * (lvl.angEnd - lvl.angStart);
        const sinA = Math.sin(ang);
        const cosA = Math.cos(ang);

        const staticFlute = Math.sin(u * Math.PI * 3.0) * 0.0032 * s * (0.30 + 0.70 * w);
        const waveArg = effPhase * 2.0 - w * 2.5 + u * Math.PI * 3.0 + breezeT * 0.7;
        const dynWaveAmp = isLocal ? 0.0 : ((0.0028 + 0.015 * motionIntensity + windTurb * 0.012) * wEff * s);
        const rippleR = Math.sin(waveArg) * dynWaveAmp;
        const rippleY = Math.cos(waveArg * 1.15) * dynWaveAmp * 0.62;

        const skD = _computeSkirtVertexDisplacement(
          sinA, cosA, w, 0.24, s, bDisp, capeStride, 0.045,
          effPhase, 0.005, 0.24, 0.42, 0.30, 0.28, 0.78
        );

        const armSectorW = Math.max(0.0, sinA * 0.75 + Math.max(0.0, -cosA) * 0.55);
        const armHeightEnv = (!isLocal && r >= 1) ? Math.sin(Math.min(1.0, w / 0.88) * Math.PI) : 0.0;
        const armFollowW = armSectorW * armHeightEnv;
        const backArcW = Math.max(0.0, (0.28 - cosA) / 1.28);
        const backArmTentZ = (!isLocal && (elbBackReach > 0.0 || handBackReach > 0.0) && backArcW > 0.0)
          ? (Math.max(elbBackReach * 0.85, handBackReach * 0.95) * armHeightEnv * Math.min(1.0, armSectorW * 1.15) * backArcW)
          : 0.0;
        const outArmTentX = (!isLocal && armOutReach > 0.0 && sinA > 0.15)
          ? (armOutReach * 0.95 * armHeightEnv * sinA)
          : 0.0;
        const zBackDamp = (r <= 5 && skD.effDispZ < 0.0 && cosA > -0.25) ? (0.45 + 0.55 * Math.max(0.0, (-cosA + 0.25) / 0.5)) : 1.0;

        const backStreamZ = isLocal
          ? 0.0
          : (-Math.max(0.0, -cosA + 0.15) * motionIntensity * 0.036 * wEff * wEff * s);

        const rz = (cosA >= 0.0 ? lvl.rzF : lvl.rzB) + staticFlute + flare + rippleR;
        const rx = lvl.rx + (staticFlute + flare + rippleR) * 0.88;

        const lx = lvl.shiftX + sinA * rx + bDisp[0] + skD.legSidePush + armSwingX * armFollowW * 0.55 + outArmTentX;
        const ly = lvl.dy + bDisp[1] + rippleY + skD.rippleY + (skD.legFrontTent * 0.16 + skD.legBackTent * 0.22);
        const lz = cosA * rz + skD.effDispZ * zBackDamp + backStreamZ - backArmTentZ + armSwingZ * armFollowW * 0.35 * backArcW + (skD.legFrontTent * 0.78 - skD.legBackTent * 0.88);
        let pos = torsoPt(lx, ly, lz);

        const rdxOut = torsoRight[0] * sinA + torsoFwd[0] * cosA;
        const rdyOut = torsoRight[1] * sinA + torsoFwd[1] * cosA;
        const rdzOut = torsoRight[2] * sinA + torsoFwd[2] * cosA;
        const rOutLen = Math.hypot(rdxOut, rdyOut, rdzOut) || 1.0;
        const outDir = [rdxOut / rOutLen, rdyOut / rOutLen, rdzOut / rOutLen];

        if (r <= 2) {
          pos = clampPointOutsideChibiBodyForCloth(pos[0], pos[1], pos[2], bodyColliderData, 0.012, false);
        }
        if (r <= 1) {
          pos = clampOutsideSuitCollar(pos, 0.0065 * s);
        }

        if (rightArmPivot && rightElbowRot && r >= 1 && r <= 7 && (sinA > 0.05 || cosA < 0.0)) {
          pos = clampCapeOutsideArmSeg(pos, rightArmPivot, rightElbowRot, 0.056 * s, 0.050 * s, 0.012 * s, outDir);
        }
        if (!isLocal && rightElbowRot && rightHandRot && r >= 2 && r <= 8 && (c >= 1 || ang >= lvl.angStart + 0.10)) {
          const foreArmCovered = (handLocal && (handLocal[2] <= 0.050 * s || handAng >= lvl.angStart - 0.16)) ||
                                 (elbLocal  && (elbLocal[2]  <= 0.030 * s || elbAng  >= lvl.angStart - 0.16));
          if (foreArmCovered) {
            pos = clampCapeOutsideArmSeg(pos, rightElbowRot, rightHandRot, 0.049 * s, 0.044 * s, 0.012 * s, outDir);
            if (handTipWorld) {
              pos = clampCapeOutsideArmSeg(pos, rightHandRot, handTipWorld, 0.040 * s, 0.035 * s, 0.012 * s, outDir);
            }
          }
        }

        if (r <= 6) {
          const suitRx = (r === 0 ? 0.100 : (r === 1 ? 0.132 : (r <= 5 ? 0.112 : 0.128))) * s;
          const suitRzB = (r === 0 ? 0.097 : (r === 1 ? 0.099 : (r <= 5 ? 0.095 : 0.105))) * s;
          const suitRzF = (r === 0 ? 0.083 : (r === 1 ? 0.089 : (r <= 5 ? 0.090 : 0.102))) * s;
          const relX = pos[0] - collarBaseX, relY = pos[1] - collarBaseY, relZ = pos[2] - collarBaseZ;
          const tx = relX * torsoRight[0] + relY * torsoRight[1] + relZ * torsoRight[2];
          const ty = relX * torsoUp[0]    + relY * torsoUp[1]    + relZ * torsoUp[2];
          const tz = relX * torsoFwd[0]   + relY * torsoFwd[1]   + relZ * torsoFwd[2];
          const suitRz = tz >= 0.0 ? suitRzF : suitRzB;
          const nxE = tx / suitRx, nzE = tz / suitRz;
          const radE = Math.hypot(nxE, nzE);
          if (radE < 1.04 && radE > 1e-4) {
            const pushScale = 1.04 / radE;
            pos = torsoPt(tx * pushScale, ty, tz * pushScale);
          }
        }

        if (r >= 6) {
          pos = clampPointOutsideSegmentCapsule(pos[0], pos[1], pos[2], pRHip, pRKnee, 0.068 * s, 0.056 * s, 0.006 * s, outDir);
          pos = clampPointOutsideSegmentCapsule(pos[0], pos[1], pos[2], pRKnee, pRFoot, 0.056 * s, 0.048 * s, 0.006 * s, outDir);
          pos = clampPointOutsideSegmentCapsule(pos[0], pos[1], pos[2], pLHip, pLKnee, 0.068 * s, 0.056 * s, 0.006 * s, outDir);
          pos = clampPointOutsideSegmentCapsule(pos[0], pos[1], pos[2], pLKnee, pLFoot, 0.056 * s, 0.048 * s, 0.006 * s, outDir);
        }

        const rdx = torsoRight[0] * sinA + torsoFwd[0] * cosA;
        const rdy = torsoRight[1] * sinA + torsoFwd[1] * cosA;
        const rdz = torsoRight[2] * sinA + torsoFwd[2] * cosA;
        const rLen = Math.hypot(rdx, rdy, rdz) || 1.0;
        const nOutX = rdx / rLen, nOutY = rdy / rLen, nOutZ = rdz / rLen;

        const pIn = [
          pos[0] - nOutX * capeThick,
          pos[1] - nOutY * capeThick,
          pos[2] - nOutZ * capeThick
        ];

        const isFoldCrest = (c <= 1) || (r <= 2 && u < 0.35) || (r >= 3 && Math.sin(u * Math.PI * 3.0) > 0.65);
        const colOut = isFoldCrest ? colCapeSheen : colCapeOuter;
        const liningMix = Math.min(1.0, Math.max(0.0, (lvl.t - 0.15) / 0.65));
        const colIn = [
          colLiningDeep[0] * (1.0 - liningMix) + colLiningTeal[0] * liningMix,
          colLiningDeep[1] * (1.0 - liningMix) + colLiningTeal[1] * liningMix,
          colLiningDeep[2] * (1.0 - liningMix) + colLiningTeal[2] * liningMix
        ];

        outRow.push(addV(pos[0], pos[1], pos[2], colOut));
        inRow.push(addV(pIn[0], pIn[1], pIn[2], colIn));
      }
      outerGrid.push(outRow);
      innerGrid.push(inRow);
    }

    for (let r = 0; r < capeLevels.length - 1; r++) {
      const o0 = outerGrid[r], o1 = outerGrid[r + 1];
      const i0 = innerGrid[r], i1 = innerGrid[r + 1];
      for (let c = 0; c < N_CAPE_COLS - 1; c++) {
        addQuad(o0[c], o1[c], o1[c + 1], o0[c + 1]);
        addQuad(i0[c + 1], i1[c + 1], i1[c], i0[c]);
      }
      const lastC = N_CAPE_COLS - 1;
      addQuad(i0[0], i1[0], o1[0], o0[0]);
      addQuad(o0[lastC], o1[lastC], i1[lastC], i0[lastC]);
    }
    {
      const lastR = capeLevels.length - 1;
      for (let c = 0; c < N_CAPE_COLS - 1; c++) {
        addQuad(innerGrid[0][c], outerGrid[0][c], outerGrid[0][c + 1], innerGrid[0][c + 1]);
        addQuad(outerGrid[lastR][c], innerGrid[lastR][c], innerGrid[lastR][c + 1], outerGrid[lastR][c + 1]);
      }
    }

    // 3. Curved Brushed Gunmetal-Silver Collar Strap & Pentagonal Shield Clasp
    {
      const N_STRAP = 12;
      const strapTopOut = [], strapBotOut = [], strapTopIn = [], strapBotIn = [];
      for (let i = 0; i <= N_STRAP; i++) {
        const u = i / N_STRAP;
        const dx = (-0.044 + u * 0.068) * s;
        const sag = Math.sin(u * Math.PI) * 0.005 * s;
        const dyMid = (0.015 * (1.0 - u) + (-0.006) * u) * s - sag;
        const dzOut = (0.075 + Math.sin(u * Math.PI) * 0.013 + u * 0.008) * s;
        const dzIn  = dzOut - 0.0034 * s;
        const halfW = 0.0068 * s;

        const spec = Math.exp(-Math.pow((u - 0.62) / 0.24, 2));
        const colFace = [
          colMetalDark[0] * (1.0 - spec) + colMetalHi[0] * spec,
          colMetalDark[1] * (1.0 - spec) + colMetalHi[1] * spec,
          colMetalDark[2] * (1.0 - spec) + colMetalHi[2] * spec
        ];

        const pTO = torsoPt(dx, dyMid + halfW, dzOut);
        const pBO = torsoPt(dx, dyMid - halfW, dzOut);
        const pTI = torsoPt(dx, dyMid + halfW, dzIn);
        const pBI = torsoPt(dx, dyMid - halfW, dzIn);

        strapTopOut.push(addV(pTO[0], pTO[1], pTO[2], colFace));
        strapBotOut.push(addV(pBO[0], pBO[1], pBO[2], colMetalMid));
        strapTopIn.push(addV(pTI[0], pTI[1], pTI[2], colMetalDark));
        strapBotIn.push(addV(pBI[0], pBI[1], pBI[2], colMetalDark));
      }
      for (let i = 0; i < N_STRAP; i++) {
        addQuad(strapTopOut[i], strapBotOut[i], strapBotOut[i + 1], strapTopOut[i + 1]);
        addQuad(strapBotIn[i],  strapTopIn[i],  strapTopIn[i + 1],  strapBotIn[i + 1]);
        addQuad(strapTopIn[i],  strapTopOut[i], strapTopOut[i + 1], strapTopIn[i + 1]);
        addQuad(strapBotOut[i], strapBotIn[i],  strapBotIn[i + 1],  strapBotOut[i + 1]);
      }
      addQuad(strapTopIn[0], strapBotIn[0], strapBotOut[0], strapTopOut[0]);

      {
        const hTL = addV(...torsoPt(-0.040 * s, 0.0165 * s, 0.0778 * s), colMetalHole);
        const hTR = addV(...torsoPt(-0.034 * s, 0.0150 * s, 0.0792 * s), colMetalHole);
        const hBL = addV(...torsoPt(-0.040 * s, 0.0110 * s, 0.0778 * s), colMetalHole);
        const hBR = addV(...torsoPt(-0.034 * s, 0.0095 * s, 0.0792 * s), colMetalHole);
        addQuad(hTL, hBL, hBR, hTR);
      }

      {
        const cx =  0.035 * s;
        const cy = -0.008 * s;
        const cz =  0.084 * s;
        const cosT =  0.966;
        const sinT = -0.259;
        const shieldPt = (uL, vU, zOff, scaleUV = 1.0) => {
          const su = uL * scaleUV;
          const sv = vU * scaleUV;
          const dx = cx + (su * cosT - sv * sinT);
          const dy = cy + (su * sinT + sv * cosT);
          const curveZ = cz + zOff - Math.max(0.0, su) * 0.18;
          return torsoPt(dx, dy, curveZ);
        };

        const wL = -0.013 * s, wM = 0.007 * s, wTip = 0.016 * s;
        const hB =  0.0105 * s;
        const polyUV = [
          [wL,   hB],
          [wL,  -hB],
          [wM,  -hB],
          [wTip, 0.0],
          [wM,   hB]
        ];

        const baseRing = [], rimRing = [], innerRing = [];
        for (let k = 0; k < 5; k++) {
          const uv = polyUV[k];
          const pBase = shieldPt(uv[0], uv[1], -0.0022 * s, 1.04);
          const pRim  = shieldPt(uv[0], uv[1],  0.0032 * s, 1.00);
          const pIn   = shieldPt(uv[0], uv[1],  0.0036 * s, 0.72);
          baseRing.push(addV(pBase[0], pBase[1], pBase[2], colMetalDark));
          rimRing.push(addV(pRim[0],   pRim[1],   pRim[2],   colMetalHi));
          innerRing.push(addV(pIn[0],  pIn[1],    pIn[2],    colMetalMid));
        }
        const pCenter = shieldPt(0.001 * s, 0.0, 0.0040 * s, 1.0);
        const vCenter = addV(pCenter[0], pCenter[1], pCenter[2], colMetalMid);

        for (let k = 0; k < 5; k++) {
          const nextK = (k + 1) % 5;
          addQuad(baseRing[k], baseRing[nextK], rimRing[nextK], rimRing[k]);
          addQuad(rimRing[k], rimRing[nextK], innerRing[nextK], innerRing[k]);
          addTri(innerRing[k], innerRing[nextK], vCenter);
        }
      }
    }

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

  function buildOperaCapeIconMesh(rawVertices, rawColors, rawIndices) {
    const capeMesh = buildOperaCapeMesh(
      [0, 0.336, 0],
      [0, -0.090, 0], [0, 0.170, 0],
      [0, 0.162, 0], [0, 0.212, 0],
      [-0.074, 0.124, 0], [-0.116, 0.012, -0.006], [-0.146, -0.095, 0.022],
      [ 0.074, 0.124, 0], [ 0.116, 0.012, -0.006], [ 0.146, -0.095, 0.022],
      1.0,
      0.0,
      true,
      [-0.052, -0.420, 0], [0.052, -0.420, 0],
      null
    );
    _appendCCWMeshAsCWIcon(capeMesh, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: true,
      colorMap: (r, g, b) => {
        if (r > 0.20 || g > 0.10) return [Math.min(0.92, r * 1.15), Math.min(0.94, g * 1.15), Math.min(0.96, b * 1.15)];
        return [r * 1.35 + 0.035, g * 1.35 + 0.038, b * 1.38 + 0.045];
      }
    });
  }

  window.buildOperaCapeMesh = buildOperaCapeMesh;
  window.buildOperaCapeIconMesh = buildOperaCapeIconMesh;
  if (window.CapsuleModel) {
    window.CapsuleModel.buildOperaCapeMesh = buildOperaCapeMesh;
    window.CapsuleModel.buildOperaCapeIconMesh = buildOperaCapeIconMesh;
  }
  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["opera_cape"] = Object.assign({}, window.ItemRegistry["OPERA_CAPE"] || {}, {
    buildMesh: buildOperaCapeMesh,
    buildIconMesh: buildOperaCapeIconMesh
  });
  window.ItemRegistry["OPERA_CAPE"] = window.ItemRegistry["opera_cape"];
})();
