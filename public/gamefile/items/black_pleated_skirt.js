// === SEEDPLANET MODULE: JS/ITEMS/BLACK_PLEATED_SKIRT.JS ===
// High-Waisted Black A-Line Knife-Pleated Skirt (BLACK_PLEATED_SKIRT) — worn 3D mesh & inventory icon mesh

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
  const _appendCCWMeshAsCWIcon = H._appendCCWMeshAsCWIcon;
  const getCharacterEquippedClothingState = H.getCharacterEquippedClothingState || window.getCharacterEquippedClothingState;
  const clampPointOutsideChibiBodyForCloth = H.clampPointOutsideChibiBodyForCloth || window.clampPointOutsideChibiBodyForCloth;

  function buildBlackPleatedSkirtMesh(
    headP1,
    chestP1, chestP2,
    scale = 1.0,
    phase = 0.0,
    clothContext = null
  ) {
    const lod = (clothContext && typeof clothContext.lod === "number") ? clothContext.lod : 0;
    const useClonePhys = !!(clothContext && clothContext.isClone);
    const eqS = (!useClonePhys && typeof getCharacterEquippedClothingState === "function") ? getCharacterEquippedClothingState(false) : null;
    const wHoodie = !!(clothContext && clothContext.wearHoodie !== undefined ? clothContext.wearHoodie : (eqS && eqS.wearHoodie));
    const wSuit = !wHoodie && !!(clothContext && clothContext.wearSuit !== undefined ? clothContext.wearSuit : (eqS && eqS.wearSuit));
    const outerKey = wHoodie ? "h" : (wSuit ? "s" : "n");
    const key = "skirt|" + outerKey + "|" + lod + "|" + _qNum(scale, 1000) + "|" + _qNum(_wrapPhase2Pi(phase), 500)
      + "|" + _qVec3(headP1) + "|" + _qVec3(chestP1) + "|" + _qVec3(chestP2)
      + "|" + (clothContext ? (_qVec3(clothContext.leftLegPivot) + "|" + _qVec3(clothContext.leftFootRot) + "|" + _qVec3(clothContext.rightLegPivot) + "|" + _qVec3(clothContext.rightFootRot)) : "n")
      + "|" + _getClothPhysKey(clothContext, lod);
    return _cachedClothBuild(key, clothContext, () => _buildBlackPleatedSkirtMeshRaw(headP1, chestP1, chestP2, scale, phase, clothContext));
  }

  function _buildBlackPleatedSkirtMeshRaw(
    headP1,
    chestP1, chestP2,
    scale = 1.0,
    phase = 0.0,
    clothContext = null
  ) {
    const s = scale || 1.0;
    const baseGroin = chestP1 || [0, -0.105 * s, 0];
    const baseChest = chestP2 || [0, 0.165 * s, 0];

    let tUpX = baseChest[0] - baseGroin[0];
    let tUpY = baseChest[1] - baseGroin[1];
    let tUpZ = baseChest[2] - baseGroin[2];
    const torsoLen = Math.hypot(tUpX, tUpY, tUpZ) || (0.27 * s);
    const torsoUp = [tUpX / torsoLen, tUpY / torsoLen, tUpZ / torsoLen];
    const torsoRatio = Math.max(0.75, Math.min(1.15, torsoLen / (0.27 * s)));

    let fwdX = 0.0, fwdY = 0.0, fwdZ = 1.0;
    const fDot = fwdX * torsoUp[0] + fwdY * torsoUp[1] + fwdZ * torsoUp[2];
    fwdX -= torsoUp[0] * fDot; fwdY -= torsoUp[1] * fDot; fwdZ -= torsoUp[2] * fDot;
    const fLen = Math.hypot(fwdX, fwdY, fwdZ) || 1.0;
    const torsoFwd = [fwdX / fLen, fwdY / fLen, fwdZ / fLen];
    const torsoRight = [
      torsoUp[1] * torsoFwd[2] - torsoUp[2] * torsoFwd[1],
      torsoUp[2] * torsoFwd[0] - torsoUp[0] * torsoFwd[2],
      torsoUp[0] * torsoFwd[1] - torsoUp[1] * torsoFwd[0]
    ];

    const waistOrigin = [
      baseGroin[0] + torsoUp[0] * (torsoLen * 0.41),
      baseGroin[1] + torsoUp[1] * (torsoLen * 0.41),
      baseGroin[2] + torsoUp[2] * (torsoLen * 0.41)
    ];

    const waistPt = (dx, dy, dz) => [
      waistOrigin[0] + torsoRight[0] * dx + torsoUp[0] * dy + torsoFwd[0] * dz,
      waistOrigin[1] + torsoRight[1] * dx + torsoUp[1] * dy + torsoFwd[1] * dz,
      waistOrigin[2] + torsoRight[2] * dx + torsoUp[2] * dy + torsoFwd[2] * dz
    ];

    const useClonePhys = !!(clothContext && clothContext.isClone);
    const eqClothingSkirt = (!useClonePhys && typeof getCharacterEquippedClothingState === "function")
      ? getCharacterEquippedClothingState(false)
      : null;
    const wearHoodieOverSkirt = !!(
      (clothContext && clothContext.wearHoodie !== undefined)
        ? clothContext.wearHoodie
        : (eqClothingSkirt && eqClothingSkirt.wearHoodie)
    );
    const wearSuitOverSkirt = !wearHoodieOverSkirt && !!(
      (clothContext && clothContext.wearSuit !== undefined)
        ? clothContext.wearSuit
        : (eqClothingSkirt && eqClothingSkirt.wearSuit)
    );
    const wearOuterOverSkirt = wearHoodieOverSkirt || wearSuitOverSkirt;
    const outerCoatMode = wearHoodieOverSkirt ? true : (wearSuitOverSkirt ? "suit" : false);
    const hPhys = useClonePhys
      ? chibiCloneHoodiePhysics
      : (window.chibiHoodiePhysics || _createDefaultHoodiePhysState());
    const pAngle = hPhys.pitch || 0.0;
    const yAngle = hPhys.yaw || 0.0;
    const rAngle = hPhys.roll || 0.0;
    const yawLagTerm = (hPhys.yawLag || 0.0) * (wearOuterOverSkirt ? 0.06 : 0.10);
    const airFlare = hPhys.airFlare || 0.0;
    const windTurb = hPhys.windTurb || 0.0;
    const nowPerfSec = (typeof performance !== "undefined" ? performance.now() : Date.now()) * 0.001;
    const flutterT = nowPerfSec * (11.0 + windTurb * 12.0);
    const turbMul = wearOuterOverSkirt ? 0.55 : 1.0;
    const turbX = windTurb > 0 ? Math.sin(flutterT) * (windTurb * 0.010 * turbMul) : 0.0;
    const turbY = windTurb > 0 ? Math.sin(flutterT * 0.85) * (windTurb * 0.007 * turbMul) : 0.0;
    const turbZ = windTurb > 0 ? Math.cos(flutterT * 1.1) * (windTurb * 0.010 * turbMul) : 0.0;
    const breezeT = nowPerfSec * 1.5;
    const breezeX = Math.sin(breezeT * 1.5) * 0.0018 * turbMul;
    const breezeZ = Math.cos(breezeT * 1.2) * 0.0018 * turbMul;

    const computeSkirtDisp = (w) => {
      const wPrimary = w * (0.48 + 0.52 * w);
      const wWhip = w * w * (0.40 + 0.60 * w);
      const coatDamp = wearSuitOverSkirt ? (0.48 + 0.52 * Math.max(0.0, (w - 0.30) / 0.70)) : 1.0;
      const bounceY = Math.sin(phase * 2.0) * (wearOuterOverSkirt ? 0.0055 : 0.007) * w * s * coatDamp;
      const gMul = (wearOuterOverSkirt ? 0.24 : 0.28) * coatDamp;
      const tMul = (wearOuterOverSkirt ? 0.28 : 0.34) * coatDamp;
      const aMul = (wearOuterOverSkirt ? 0.45 : 0.55) * coatDamp;
      const yMul = (wearOuterOverSkirt ? 0.024 : 0.032) * coatDamp;
      const rMul = (wearOuterOverSkirt ? 0.016 : 0.020) * coatDamp;
      const pMul = (wearOuterOverSkirt ? 0.028 : 0.036) * coatDamp;
      const dx = (hPhys.gx * gMul * wPrimary + hPhys.tx * tMul * wWhip + hPhys.airX * aMul * w + (yAngle * yMul + rAngle * rMul + yawLagTerm * coatDamp) * w + breezeX * w * coatDamp + turbX * w * coatDamp) * s;
      const dy = (hPhys.gy * gMul * wPrimary + hPhys.ty * tMul * wWhip + hPhys.airY * aMul * w + turbY * w * coatDamp) * s + bounceY;
      const dz = (hPhys.gz * gMul * wPrimary + hPhys.tz * tMul * wWhip + hPhys.airZ * aMul * w - pAngle * pMul * w + breezeZ * w * coatDamp + turbZ * w * coatDamp) * s;
      return [dx, dy, dz];
    };

    const skirtStride = _computeGarmentLegStride(clothContext, torsoRight, torsoFwd, wearSuitOverSkirt ? 0.44 : 0.68, true);

    const bodyColliderData = {
      headP1: headP1 || [baseChest[0], baseChest[1] + 0.08 * s, baseChest[2]],
      chestP1: baseGroin,
      chestP2: baseChest,
      leftLegPivot: clothContext ? clothContext.leftLegPivot : null,
      leftKneeRot: clothContext ? clothContext.leftKneeRot : null,
      leftFootRot: clothContext ? clothContext.leftFootRot : null,
      rightLegPivot: clothContext ? clothContext.rightLegPivot : null,
      rightKneeRot: clothContext ? clothContext.rightKneeRot : null,
      rightFootRot: clothContext ? clothContext.rightFootRot : null,
      scale: s
    };

    const outV = [], outC = [], outT = [], outI = [];
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
    const addQuad = (a, b, c, d) => {
      outI.push(a, b, c);
      outI.push(a, c, d);
    };

    const colRidge = [0.165, 0.170, 0.195];
    const colBlade = [0.112, 0.115, 0.135];
    const colFoldShadow = [0.042, 0.044, 0.056];
    const colYoke = [0.125, 0.128, 0.150];
    const colInner = [0.036, 0.038, 0.048];

    const NUM_PLEATS = 18;
    const SUB_PER_PLEAT = 3;
    const N_VERTS = NUM_PLEATS * SUB_PER_PLEAT;

    const skirtRingsDef = _getBlackPleatedSkirtRingsDef(s, torsoRatio, outerCoatMode);

    const ringVerts = [];
    const waistInnerRing = [];
    const hemInnerRing = [];
    const envWorldRings = (wearOuterOverSkirt && clothContext) ? [] : null;

    for (let rIdx = 0; rIdx < skirtRingsDef.length; rIdx++) {
      const lvl = skirtRingsDef[rIdx];
      const bDisp = computeSkirtDisp(lvl.t);
      const flareDamp = wearSuitOverSkirt ? (0.42 + 0.58 * Math.max(0.0, (lvl.t - 0.35) / 0.65)) : 1.0;
      const flare = (airFlare * (wearOuterOverSkirt ? 0.24 : 0.36) + Math.abs(yAngle) * (wearOuterOverSkirt ? 0.012 : 0.016)) * lvl.t * s * flareDamp;
      const row = [];
      const envCrestsRow = envWorldRings ? [] : null;

      for (let p = 0; p < NUM_PLEATS; p++) {
        for (let sub = 0; sub < SUB_PER_PLEAT; sub++) {
          const fracAngle = (sub === 0) ? 0.02 : ((sub === 1) ? 0.58 : 0.88);
          const ang = ((p + fracAngle) / NUM_PLEATS) * Math.PI * 2.0;
          const sinA = Math.sin(ang);
          const cosA = Math.cos(ang);
          const rz = (cosA >= 0.0) ? lvl.rzF : lvl.rzB;

          const pMod = (sub === 0) ? 1.0 : ((sub === 1) ? 0.15 : -0.95);
          const rBoost = lvl.pleatDepth * pMod;

          const skD = _computeSkirtVertexDisplacement(
            sinA, cosA, lvl.t, 0.18, s, bDisp, skirtStride, 0.042,
            phase, wearOuterOverSkirt ? 0.003 : 0.004,
            0.28, 0.30, 0.25, 0.20, 0.72
          );

          const lx = sinA * (lvl.rx + rBoost + flare) + bDisp[0] + skD.legSidePush;
          const ly = lvl.dy + bDisp[1] + skD.rippleY + (skD.legFrontTent * 0.14 + skD.legBackTent * 0.10);
          const lz = lvl.cy + cosA * (rz + rBoost + flare) + skD.effDispZ + (skD.legFrontTent * 0.80 - skD.legBackTent * 0.70);

          const pushHint = (rIdx >= 2)
            ? [
                torsoRight[0] * sinA + torsoFwd[0] * cosA,
                0.0,
                torsoRight[2] * sinA + torsoFwd[2] * cosA
              ]
            : null;

          const pos = waistPt(lx, ly, lz);
          const col = lvl.isYoke
            ? colYoke
            : (sub === 0 ? colRidge : (sub === 1 ? colBlade : colFoldShadow));
          const vIdx = addV(pos[0], pos[1], pos[2], col, lvl.clr, pushHint);
          row.push(vIdx);
          if (envCrestsRow && sub === 0) {
            envCrestsRow.push([outV[vIdx * 3], outV[vIdx * 3 + 1], outV[vIdx * 3 + 2]]);
          }

          if (rIdx === 0) {
            const innerWaistPos = waistPt(
              sinA * (lvl.rx * 0.90) + bDisp[0],
              lvl.dy - 0.004 * s + bDisp[1],
              lvl.cy + cosA * (rz * 0.90) + bDisp[2]
            );
            waistInnerRing.push(addV(innerWaistPos[0], innerWaistPos[1], innerWaistPos[2], colInner, 0.0));
          }

          if (rIdx === skirtRingsDef.length - 1) {
            const innerPos = waistPt(
              sinA * ((lvl.rx - 0.011 * s) + rBoost * 0.55 + flare) + bDisp[0] + skD.legSidePush,
              lvl.dy + 0.014 * s + bDisp[1] + skD.rippleY + (skD.legFrontTent * 0.14 + skD.legBackTent * 0.10),
              lvl.cy + cosA * ((rz - 0.011 * s) + rBoost * 0.55 + flare) + skD.effDispZ + (skD.legFrontTent * 0.80 - skD.legBackTent * 0.70)
            );
            hemInnerRing.push(addV(innerPos[0], innerPos[1], innerPos[2], colInner, 0.011, pushHint));
          }
        }
      }
      ringVerts.push(row);
      if (envWorldRings) envWorldRings.push(envCrestsRow);
    }
    if (envWorldRings && clothContext) {
      clothContext._cachedSkirtEnvelope = envWorldRings;
    }

    const topOuter = ringVerts[0];
    for (let j = 0; j < N_VERTS; j++) {
      const nextJ = (j + 1) % N_VERTS;
      addQuad(waistInnerRing[j], topOuter[j], topOuter[nextJ], waistInnerRing[nextJ]);
    }

    for (let r = 0; r < ringVerts.length - 1; r++) {
      const r0 = ringVerts[r];
      const r1 = ringVerts[r + 1];
      for (let j = 0; j < N_VERTS; j++) {
        const nextJ = (j + 1) % N_VERTS;
        addQuad(r0[j], r1[j], r1[nextJ], r0[nextJ]);
      }
    }

    const botOuter = ringVerts[ringVerts.length - 1];
    for (let j = 0; j < N_VERTS; j++) {
      const nextJ = (j + 1) % N_VERTS;
      addQuad(botOuter[j], hemInnerRing[j], hemInnerRing[nextJ], botOuter[nextJ]);
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
      if (l > 0.0001) { normals[k] /= l; normals[k + 1] /= l; normals[k + 2] /= l; }
      else normals[k + 1] = 1.0;
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

  function buildBlackPleatedSkirtIconMesh(rawVertices, rawColors, rawIndices) {
    const sMesh = buildBlackPleatedSkirtMesh(
      [0, 0.336, 0],
      [0, -0.090, 0],
      [0,  0.170, 0],
      1.0,
      0.0,
      null
    );
    _appendCCWMeshAsCWIcon(sMesh, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: true,
      colorMap: (r, g, b) => {
        if (r > 0.145) return [0.265, 0.275, 0.315];
        if (r > 0.118) return [0.205, 0.212, 0.245];
        if (r > 0.095) return [0.180, 0.186, 0.215];
        if (r > 0.039) return [0.082, 0.086, 0.105];
        return [0.068, 0.072, 0.088];
      }
    });
  }

  window.buildBlackPleatedSkirtMesh = buildBlackPleatedSkirtMesh;
  window.buildBlackPleatedSkirtIconMesh = buildBlackPleatedSkirtIconMesh;
  if (window.CapsuleModel) {
    window.CapsuleModel.buildBlackPleatedSkirtMesh = buildBlackPleatedSkirtMesh;
    window.CapsuleModel.buildBlackPleatedSkirtIconMesh = buildBlackPleatedSkirtIconMesh;
  }
  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["black_pleated_skirt"] = Object.assign({}, window.ItemRegistry["BLACK_PLEATED_SKIRT"] || {}, {
    buildMesh: buildBlackPleatedSkirtMesh,
    buildIconMesh: buildBlackPleatedSkirtIconMesh
  });
  window.ItemRegistry["BLACK_PLEATED_SKIRT"] = window.ItemRegistry["black_pleated_skirt"];
})();
