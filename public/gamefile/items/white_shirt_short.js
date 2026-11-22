// === SEEDPLANET MODULE: JS/ITEMS/WHITE_SHIRT_SHORT.JS ===
// White Short-Sleeve Collared Shirt (WHITE_SHIRT_SHORT) — collar 3D mesh & inventory icon mesh

(function() {
  const H = window._CapsuleClothHelpers || {};
  const _qNum = H._qNum;
  const _qVec3 = H._qVec3;
  const _cachedClothBuild = H._cachedClothBuild;
  const _appendCCWMeshAsCWIcon = H._appendCCWMeshAsCWIcon;
  const getCharacterEquippedClothingState = H.getCharacterEquippedClothingState || window.getCharacterEquippedClothingState;
  const clampPointOutsideChibiBodyForCloth = H.clampPointOutsideChibiBodyForCloth || window.clampPointOutsideChibiBodyForCloth;
  const generateChibiTorso = H.generateChibiTorso || window.generateChibiTorso;
  const generateChibiUpperArm = H.generateChibiUpperArm || window.generateChibiUpperArm;

  function buildWhiteShirtCollarMesh(headP1, chestP1, chestP2, neckP1, neckP2, scale = 1.0, ignoreOuterCoat = false) {
    const eqS = ignoreOuterCoat ? null : getCharacterEquippedClothingState(false);
    const underSuit = (eqS && eqS.wearSuit) ? 1 : 0;
    const key = "collar|" + (ignoreOuterCoat ? 1 : 0) + "|" + underSuit + "|" + _qNum(scale, 1000)
      + "|" + _qVec3(headP1) + "|" + _qVec3(chestP1) + "|" + _qVec3(chestP2) + "|" + _qVec3(neckP1) + "|" + _qVec3(neckP2);
    return _cachedClothBuild(key, null, () => _buildWhiteShirtCollarMeshRaw(headP1, chestP1, chestP2, neckP1, neckP2, scale, ignoreOuterCoat));
  }

  function _buildWhiteShirtCollarMeshRaw(headP1, chestP1, chestP2, neckP1, neckP2, scale = 1.0, ignoreOuterCoat = false) {
    const s = scale || 1.0;
    const eqState = ignoreOuterCoat ? { wearSuit: false } : getCharacterEquippedClothingState(false);
    const underSuit = !!eqState.wearSuit;
    const baseChest = chestP2 || neckP1 || [0, 0.14 * s, 0];
    const baseGroin = chestP1 || [0, -0.10 * s, 0];

    let tUpX = baseChest[0] - baseGroin[0];
    let tUpY = baseChest[1] - baseGroin[1];
    let tUpZ = baseChest[2] - baseGroin[2];
    const tUpL = Math.hypot(tUpX, tUpY, tUpZ) || 1.0;
    const tUp = [tUpX / tUpL, tUpY / tUpL, tUpZ / tUpL];

    const headCenter = headP1 || [baseChest[0], baseChest[1] + 0.08 * s, baseChest[2]];
    let fwdX = 0.0, fwdY = 0.0, fwdZ = 1.0;
    const fDot = fwdX * tUp[0] + fwdY * tUp[1] + fwdZ * tUp[2];
    fwdX -= tUp[0] * fDot; fwdY -= tUp[1] * fDot; fwdZ -= tUp[2] * fDot;
    const fLen = Math.hypot(fwdX, fwdY, fwdZ) || 1.0;
    const tFwd = [fwdX / fLen, fwdY / fLen, fwdZ / fLen];
    const tRight = [
      tUp[1] * tFwd[2] - tUp[2] * tFwd[1],
      tUp[2] * tFwd[0] - tUp[0] * tFwd[2],
      tUp[0] * tFwd[1] - tUp[1] * tFwd[0]
    ];

    const neckRef = neckP1 || [baseChest[0] + tUp[0] * 0.015 * s, baseChest[1] + tUp[1] * 0.015 * s, baseChest[2] + tUp[2] * 0.015 * s];
    const pt = (dx, dy, dz) => [
      neckRef[0] + tRight[0] * dx + tUp[0] * dy + tFwd[0] * dz,
      neckRef[1] + tRight[1] * dx + tUp[1] * dy + tFwd[1] * dz,
      neckRef[2] + tRight[2] * dx + tUp[2] * dy + tFwd[2] * dz
    ];

    const bodyColliderData = { headP1: headCenter, chestP1: baseGroin, chestP2: baseChest, scale: s };
    const outV = [], outC = [], outT = [], outI = [];

    const addV = (p, col, clampClr = 0.004) => {
      let vx = p[0], vy = p[1], vz = p[2];
      if (clampClr > 0.0) {
        const clamped = clampPointOutsideChibiBodyForCloth(vx, vy, vz, bodyColliderData, clampClr, false);
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

    const colWhite = [0.985, 0.988, 0.996];
    const colShade = [0.895, 0.905, 0.935];
    const colFold = [0.840, 0.855, 0.895];

    const segs = 12;
    const startA = 0.36;
    const endA = Math.PI * 2.0 - 0.36;
    const standBot = [];
    const standTop = [];
    const lapelMid = [];
    const lapelTip = [];
    const wingScale = underSuit ? 0.72 : 1.0;
    const standScale = underSuit ? 0.88 : 1.0;
    const yTuck = underSuit ? (-0.004 * s) : 0.0;
    const clrScale = underSuit ? 0.25 : 1.0;

    for (let i = 0; i <= segs; i++) {
      const frac = i / segs;
      const ang = startA + frac * (endA - startA);
      const sinA = Math.sin(ang);
      const cosA = Math.cos(ang);
      const isFrontTip = (i === 0 || i === segs);
      const isNearFront = (i <= 2 || i >= segs - 2);

      const sb = pt(sinA * 0.056 * standScale * s, (cosA > 0 ? -0.022 : -0.006) * s + yTuck, cosA * 0.052 * standScale * s);
      const st = pt(sinA * 0.050 * standScale * s, (cosA > 0 ? 0.006 : 0.024) * s + yTuck, cosA * 0.048 * standScale * s);

      const spreadR = (isFrontTip ? 0.068 : (isNearFront ? 0.082 : 0.076)) * wingScale;
      const tipR = (isFrontTip ? 0.066 : (isNearFront ? 0.088 : 0.082)) * wingScale;
      const foldDrop = isFrontTip ? -0.046 : (isNearFront ? -0.038 : -0.018);

      const lm = pt(sinA * spreadR * s, (foldDrop * 0.45 + 0.004) * s + yTuck, cosA * spreadR * s);
      const lt = pt(sinA * tipR * s, foldDrop * s + yTuck, cosA * tipR * s + (isFrontTip ? (underSuit ? 0.006 : 0.018) * s : 0.0));

      standBot.push(addV(sb, colShade, 0.003 * clrScale));
      standTop.push(addV(st, colWhite, 0.003 * clrScale));
      lapelMid.push(addV(lm, colWhite, 0.005 * clrScale));
      lapelTip.push(addV(lt, isNearFront ? colWhite : colShade, 0.006 * clrScale));
    }

    for (let i = 0; i < segs; i++) {
      addQuad(standBot[i], standTop[i], standTop[i + 1], standBot[i + 1]);
      addQuad(standTop[i], lapelMid[i], lapelMid[i + 1], standTop[i + 1]);
      addQuad(lapelMid[i], lapelTip[i], lapelTip[i + 1], lapelMid[i + 1]);
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
    void colFold;

    return {
      vertices: outV,
      normals: normals,
      colors: outC,
      texcoords: outT,
      indices: outI
    };
  }

  function buildWhiteShirtIconMesh(rawVertices, rawColors, rawIndices) {
    const chestP1 = [0, -0.090, 0];
    const chestP2 = [0,  0.170, 0];
    const neckP1  = [0,  0.162, 0];
    const neckP2  = [0,  0.212, 0];
    const headP1  = [0,  0.336, 0];
    const lPivot  = [-0.074, 0.124, 0];
    const lElbow  = [-0.116, 0.012, -0.006];
    const rPivot  = [ 0.074, 0.124, 0];
    const rElbow  = [ 0.116, 0.012, -0.006];

    const isShirtTri = (a, b, c, vArr, cArr) => {
      const da = cArr[a * 3 + 2] - cArr[a * 3];
      const db = cArr[b * 3 + 2] - cArr[b * 3];
      const dc = cArr[c * 3 + 2] - cArr[c * 3];
      const avgY = (vArr[a * 3 + 1] + vArr[b * 3 + 1] + vArr[c * 3 + 1]) / 3.0;
      return da >= -0.025 && db >= -0.025 && dc >= -0.025 && avgY <= 0.166;
    };

    const torsoMesh = generateChibiTorso(chestP1, chestP2, 0.09, 1.0, false, false, true, false);
    _appendCCWMeshAsCWIcon(torsoMesh, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: false,
      triFilter: isShirtTri
    });

    const lSleeve = generateChibiUpperArm(lPivot, lElbow, true, 1.0, false, true);
    const rSleeve = generateChibiUpperArm(rPivot, rElbow, false, 1.0, false, true);
    _appendCCWMeshAsCWIcon(lSleeve, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: false,
      triFilter: isShirtTri
    });
    _appendCCWMeshAsCWIcon(rSleeve, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: false,
      triFilter: isShirtTri
    });

    const collarMesh = buildWhiteShirtCollarMesh(headP1, chestP1, chestP2, neckP1, neckP2, 1.0, true);
    _appendCCWMeshAsCWIcon(collarMesh, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: true
    });

    const addV = (x, y, z, col) => {
      const idx = (rawVertices.length / 3) | 0;
      rawVertices.push(x, y, z);
      rawColors.push(col[0], col[1], col[2]);
      return idx;
    };
    const addQuadCW = (i0, i1, i2, i3) => {
      rawIndices.push(i0, i2, i1);
      rawIndices.push(i0, i3, i2);
    };
    const colNeckShadow = [0.76, 0.78, 0.84];
    const colHemShadow  = [0.80, 0.82, 0.87];
    const nSeg = 14;
    const nTop = [], nBot = [];
    for (let j = 0; j < nSeg; j++) {
      const ang = (j / nSeg) * Math.PI * 2.0;
      nTop.push(addV(Math.sin(ang) * 0.048, 0.168, Math.cos(ang) * 0.046, colNeckShadow));
      nBot.push(addV(Math.sin(ang) * 0.042, 0.132, Math.cos(ang) * 0.040, colNeckShadow));
    }
    for (let j = 0; j < nSeg; j++) {
      const nextJ = (j + 1) % nSeg;
      addQuadCW(nTop[nextJ], nTop[j], nBot[j], nBot[nextJ]);
    }
    const hOut = [], hIn = [];
    for (let j = 0; j < nSeg; j++) {
      const ang = (j / nSeg) * Math.PI * 2.0;
      hOut.push(addV(Math.sin(ang) * 0.082, -0.026, Math.cos(ang) * 0.056, colHemShadow));
      hIn.push(addV(Math.sin(ang) * 0.064,  0.004, Math.cos(ang) * 0.044, colHemShadow));
    }
    for (let j = 0; j < nSeg; j++) {
      const nextJ = (j + 1) % nSeg;
      addQuadCW(hOut[j], hOut[nextJ], hIn[nextJ], hIn[j]);
    }
  }

  window.buildWhiteShirtCollarMesh = buildWhiteShirtCollarMesh;
  window.buildWhiteShirtIconMesh = buildWhiteShirtIconMesh;
  if (window.CapsuleModel) {
    window.CapsuleModel.buildWhiteShirtCollarMesh = buildWhiteShirtCollarMesh;
    window.CapsuleModel.buildWhiteShirtIconMesh = buildWhiteShirtIconMesh;
  }
  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["white_shirt_short"] = Object.assign({}, window.ItemRegistry["WHITE_SHIRT_SHORT"] || {}, {
    buildMesh: buildWhiteShirtCollarMesh,
    buildIconMesh: buildWhiteShirtIconMesh
  });
  window.ItemRegistry["WHITE_SHIRT_SHORT"] = window.ItemRegistry["white_shirt_short"];
})();
