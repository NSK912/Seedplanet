// === SEEDPLANET MODULE: JS/ITEMS/TRAVELER_BOOTS.JS ===
// Traveler Ankle Boots (TRAVELER_BOOTS) — worn 3D mesh & inventory icon mesh

(function() {
  const H = window._CapsuleClothHelpers || {};
  const _qNum = H._qNum;
  const _qVec3 = H._qVec3;
  const _cachedClothBuild = H._cachedClothBuild;
  const _appendCCWMeshAsCWIcon = H._appendCCWMeshAsCWIcon;
  const computeLegRigFrame = H.computeLegRigFrame || window.computeLegRigFrame;

  function buildTravelerBootsMesh(leftFootRot, rightFootRot, scale = 1.0, clothContext = null) {
    const key = "boots|" + _qNum(scale, 1000) + "|" + _qVec3(leftFootRot) + "|" + _qVec3(rightFootRot)
      + "|" + (clothContext ? (_qVec3(clothContext.leftKneeRot) + "|" + _qVec3(clothContext.rightKneeRot) + "|" + _qVec3(clothContext.leftLegPivot) + "|" + _qVec3(clothContext.rightLegPivot)) : "n");
    return _cachedClothBuild(key, clothContext, () => _buildTravelerBootsMeshRaw(leftFootRot, rightFootRot, scale, clothContext));
  }

  function _buildTravelerBootsMeshRaw(leftFootRot, rightFootRot, scale = 1.0, clothContext = null) {
    const outV = [];
    const outC = [];
    const outI = [];
    const outT = [];
    const s = scale || 1.0;

    const colUpper = [0.125, 0.130, 0.155];
    const colUpperCrease = [0.105, 0.110, 0.132];
    const colTrim = [0.168, 0.175, 0.205];
    const colSole = [0.062, 0.065, 0.080];
    const colInner = [0.045, 0.048, 0.060];

    const addV = (px, py, pz, color) => {
      const idx = (outV.length / 3) | 0;
      outV.push(px, py, pz);
      outC.push(color[0], color[1], color[2]);
      // Mark outside diamond shader range so boots never receive cloak pattern spots
      outT.push(-9.0, -9.0);
      return idx;
    };

    const addTri = (v0, v1, v2) => {
      outI.push(v0, v1, v2);
    };

    const addQuad = (v0, v1, v2, v3) => {
      outI.push(v0, v1, v2);
      outI.push(v0, v2, v3);
    };

    const addTravelerBoot = (pFoot, pKnee, isLeft, pHip = null, legRig = null) => {
      if (!pFoot) return;
      const fx = pFoot[0];
      const fy = pFoot[1];
      const fz = pFoot[2];
      const medialSign = isLeft ? 1.0 : -1.0;

      const activeLegRig = legRig || computeLegRigFrame(pHip, pKnee, pFoot, isLeft);
      const footBasis = activeLegRig.footBoneBasis;
      const fRight = footBasis.rightAxis;
      const fUp = footBasis.upAxis;
      const fFwd = footBasis.fwdAxis;

      // 1. Align boot ankle shaft strictly with actual shin direction (pKnee - pFoot)
      //    and blend smoothly into footBoneBasis so walking/running/jumping never tear or clip!
      let ux = fUp[0], uy = fUp[1], uz = fUp[2];
      if (pKnee) {
        const vx = pKnee[0] - fx;
        const vy = pKnee[1] - fy;
        const vz = pKnee[2] - fz;
        const vLen = Math.hypot(vx, vy, vz);
        if (vLen > 1e-4) {
          ux = vx / vLen; uy = vy / vLen; uz = vz / vLen;
        }
      }
      // Shaft right = normalize(up x fFwd)
      let rxX = uy * fFwd[2] - uz * fFwd[1];
      let rxY = uz * fFwd[0] - ux * fFwd[2];
      let rxZ = ux * fFwd[1] - uy * fFwd[0];
      const rxL = Math.hypot(rxX, rxY, rxZ) || 1.0;
      rxX /= rxL; rxY /= rxL; rxZ /= rxL;
      // Shaft fwd = right x up
      const fxX = rxY * uz - rxZ * uy;
      const fxY = rxZ * ux - rxX * uz;
      const fxZ = rxX * uy - rxY * ux;

      const SHAFT_SIDES = 20;
      const midRxX = (rxX + fRight[0]) * 0.5, midRxY = (rxY + fRight[1]) * 0.5, midRxZ = (rxZ + fRight[2]) * 0.5;
      const midRxL = Math.hypot(midRxX, midRxY, midRxZ) || 1.0;
      const mrxX = midRxX / midRxL, mrxY = midRxY / midRxL, mrxZ = midRxZ / midRxL;

      const midFxX = (fxX + fFwd[0]) * 0.5, midFxY = (fxY + fFwd[1]) * 0.5, midFxZ = (fxZ + fFwd[2]) * 0.5;
      const midFxL = Math.hypot(midFxX, midFxY, midFxZ) || 1.0;
      const mfxX = midFxX / midFxL, mfxY = midFxY / midFxL, mfxZ = midFxZ / midFxL;

      const footPt = (dx, dy, dz) => [
        fx + fRight[0] * dx + fUp[0] * dy + fFwd[0] * dz,
        fy + fRight[1] * dx + fUp[1] * dy + fFwd[1] * dz,
        fz + fRight[2] * dx + fUp[2] * dy + fFwd[2] * dz,
      ];

      // Tailored Chibi ankle shaft: wraps leggings/calf cleanly above the cuff (no skin gap!)
      // while aligning the rear shaft with the calf backward curve and pulling the heel flush.
      const anchorPt = footPt(0, -0.015 * s, 0.0005 * s);
      const shaftPt = (hUp, zBackOff) => [
        fx + ux * hUp * s + fxX * zBackOff * s,
        fy + uy * hUp * s + fxY * zBackOff * s,
        fz + uz * hUp * s + fxZ * zBackOff * s,
      ];
      const sh0 = shaftPt(0.034, -0.0012);
      const sh1 = shaftPt(0.042, -0.0018);
      const sh2 = shaftPt(0.036, -0.0018);
      const sh3 = shaftPt(0.028, -0.0014);
      const sh4 = shaftPt(0.014, -0.0006);
      const shaftRingsDef = [
        { cx: sh0[0],      cy: sh0[1],      cz: sh0[2],      rx: 0.0345 * s, rz: 0.0345 * s, rAx: [rxX, rxY, rxZ],   fAx: [fxX, fxY, fxZ],   col: colInner       }, // 0: Inner cuff lining tucked cleanly in calf
        { cx: sh1[0],      cy: sh1[1],      cz: sh1[2],      rx: 0.0428 * s, rz: 0.0426 * s, rAx: [rxX, rxY, rxZ],   fAx: [fxX, fxY, fxZ],   col: colTrim        }, // 1: Smooth rounded top collar crest (clears leggings!)
        { cx: sh2[0],      cy: sh2[1],      cz: sh2[2],      rx: 0.0440 * s, rz: 0.0436 * s, rAx: [rxX, rxY, rxZ],   fAx: [fxX, fxY, fxZ],   col: colTrim        }, // 2: Rolled outer collar cuff
        { cx: sh3[0],      cy: sh3[1],      cz: sh3[2],      rx: 0.0420 * s, rz: 0.0418 * s, rAx: [mrxX, mrxY, mrxZ], fAx: [mfxX, mfxY, mfxZ], col: colUpperCrease }, // 3: Subtle collar tuck crease
        { cx: sh4[0],      cy: sh4[1],      cz: sh4[2],      rx: 0.0412 * s, rz: 0.0416 * s, rAx: [mrxX, mrxY, mrxZ], fAx: [mfxX, mfxY, mfxZ], col: colUpper       }, // 4: Fitted ankle bridge
        { cx: anchorPt[0], cy: anchorPt[1], cz: anchorPt[2], rx: 0.0398 * s, rz: 0.0412 * s, rAx: fRight,             fAx: fFwd,             col: colUpper       }  // 5: Anchored cleanly inside shoe throat
      ];

      const shaftRings = [];
      for (let r = 0; r < shaftRingsDef.length; r++) {
        const def = shaftRingsDef[r];
        const ring = [];
        for (let i = 0; i < SHAFT_SIDES; i++) {
          const ang = (i / SHAFT_SIDES) * Math.PI * 2.0;
          const sinA = Math.sin(ang);
          const cosA = Math.cos(ang);
          ring.push(addV(
            def.cx + def.rAx[0] * (sinA * def.rx) + def.fAx[0] * (cosA * def.rz),
            def.cy + def.rAx[1] * (sinA * def.rx) + def.fAx[1] * (cosA * def.rz),
            def.cz + def.rAx[2] * (sinA * def.rx) + def.fAx[2] * (cosA * def.rz),
            def.col
          ));
        }
        shaftRings.push(ring);
      }

      for (let r = 0; r < shaftRings.length - 1; r++) {
        const r0 = shaftRings[r];
        const r1 = shaftRings[r + 1];
        for (let i = 0; i < SHAFT_SIDES; i++) {
          const nextI = (i + 1) % SHAFT_SIDES;
          addQuad(r0[i], r1[i], r1[nextI], r0[nextI]);
        }
      }
      const botShaft = shaftRings[shaftRings.length - 1];
      const baseCPt = footPt(0, -0.017 * s, 0.0005 * s);
      const vBaseC = addV(baseCPt[0], baseCPt[1], baseCPt[2], colUpper);
      for (let i = 0; i < SHAFT_SIDES; i++) {
        const nextI = (i + 1) % SHAFT_SIDES;
        addTri(vBaseC, botShaft[nextI], botShaft[i]);
      }

      // 2. Tailored Chibi Shoe Vamp, Asymmetric Left/Right Toe Box & Defined Sole Arch
      const xBias = (isLeft ? -0.0010 : 0.0010) * s;
      const shoeSlicesDef = [
        { z: -0.0398 * s, zLatBias: 0.000 * s, rxMed: 0.0315 * s, rxLat: 0.0315 * s, yWelt: -0.0312 * s, hTop: 0.0260 * s, hBot: 0.0108 * s, pLat: 0.85 },
        { z: -0.0250 * s, zLatBias: 0.000 * s, rxMed: 0.0382 * s, rxLat: 0.0382 * s, yWelt: -0.0322 * s, hTop: 0.0380 * s, hBot: 0.0113 * s, pLat: 0.80 },
        { z: -0.0020 * s, zLatBias: 0.001 * s, rxMed: 0.0398 * s, rxLat: 0.0404 * s, yWelt: -0.0308 * s, hTop: 0.0422 * s, hBot: 0.0104 * s, pLat: 0.76 },
        { z:  0.0280 * s, zLatBias: 0.002 * s, rxMed: 0.0410 * s, rxLat: 0.0418 * s, yWelt: -0.0320 * s, hTop: 0.0325 * s, hBot: 0.0112 * s, pLat: 0.76 },
        { z:  0.0500 * s, zLatBias: 0.003 * s, rxMed: 0.0418 * s, rxLat: 0.0418 * s, yWelt: -0.0324 * s, hTop: 0.0235 * s, hBot: 0.0112 * s, pLat: 0.77 },
        { z:  0.0640 * s, zLatBias: 0.004 * s, rxMed: 0.0355 * s, rxLat: 0.0335 * s, yWelt: -0.0320 * s, hTop: 0.0175 * s, hBot: 0.0108 * s, pLat: 0.80 },
        { z:  0.0725 * s, zLatBias: 0.003 * s, rxMed: 0.0225 * s, rxLat: 0.0205 * s, yWelt: -0.0310 * s, hTop: 0.0108 * s, hBot: 0.0092 * s, pLat: 0.85 }
      ];

      const SHOE_SIDES = 20;
      const shoeRings = [];
      for (let r = 0; r < shoeSlicesDef.length; r++) {
        const sl = shoeSlicesDef[r];
        const ring = [];
        const tFwd = r / (shoeSlicesDef.length - 1);
        const dxCenter = xBias * Math.pow(tFwd, 1.3);
        for (let i = 0; i < SHOE_SIDES; i++) {
          const ang = (i / SHOE_SIDES) * Math.PI * 2.0;
          const sinA = Math.sin(ang);
          const cosA = Math.cos(ang);

          const lat = sinA * medialSign;
          const rxSide = lat >= 0.0 ? sl.rxMed : sl.rxLat;
          const sSign = sinA >= 0 ? 1.0 : -1.0;

          const pHoriz = cosA >= 0.0 ? (sl.pLat + 0.08 * cosA) : (sl.pLat * 0.90);
          const vxOff = sSign * Math.pow(Math.abs(sinA), pHoriz) * rxSide;
          const vyOff = (cosA >= 0.0)
            ? (Math.pow(cosA, 0.84) * sl.hTop)
            : (-Math.pow(-cosA, 0.48) * sl.hBot);

          const zShift = lat * sl.zLatBias;

          const isSole = cosA < -0.15;
          const isWelt = !isSole && cosA < 0.16;
          const col = isSole ? colSole : (isWelt ? colUpperCrease : colUpper);

          const pt = footPt(dxCenter + vxOff, sl.yWelt + vyOff, sl.z + zShift);
          ring.push(addV(pt[0], pt[1], pt[2], col));
        }
        shoeRings.push(ring);
      }

      for (let r = 0; r < shoeRings.length - 1; r++) {
        const r0 = shoeRings[r];
        const r1 = shoeRings[r + 1];
        for (let i = 0; i < SHOE_SIDES; i++) {
          const nextI = (i + 1) % SHOE_SIDES;
          addQuad(r0[i], r1[i], r1[nextI], r0[nextI]);
        }
      }

      const heelRing = shoeRings[0];
      const heelCapPt = footPt(0, -0.029 * s, -0.0422 * s);
      const vHeelCap = addV(heelCapPt[0], heelCapPt[1], heelCapPt[2], colUpper);
      for (let i = 0; i < SHOE_SIDES; i++) {
        const nextI = (i + 1) % SHOE_SIDES;
        addTri(vHeelCap, heelRing[i], heelRing[nextI]);
      }

      const toeRing = shoeRings[shoeRings.length - 1];
      const toeCapPt = footPt(xBias + medialSign * 0.002 * s, -0.030 * s, 0.0755 * s);
      const vToeCap = addV(toeCapPt[0], toeCapPt[1], toeCapPt[2], colUpper);
      for (let i = 0; i < SHOE_SIDES; i++) {
        const nextI = (i + 1) % SHOE_SIDES;
        addTri(vToeCap, toeRing[nextI], toeRing[i]);
      }
    };

    const lHip = clothContext ? clothContext.leftLegPivot : null;
    const rHip = clothContext ? clothContext.rightLegPivot : null;
    const lKnee = clothContext ? clothContext.leftKneeRot : null;
    const rKnee = clothContext ? clothContext.rightKneeRot : null;
    const lLegRig = clothContext ? clothContext.leftLegRig : null;
    const rLegRig = clothContext ? clothContext.rightLegRig : null;
    if (leftFootRot) addTravelerBoot(leftFootRot, lKnee, true, lHip, lLegRig);
    if (rightFootRot) addTravelerBoot(rightFootRot, rKnee, false, rHip, rLegRig);

    const normals = new Float32Array(outV.length);
    for (let k = 0; k < outI.length; k += 3) {
      const i0 = outI[k], i1 = outI[k + 1], i2 = outI[k + 2];
      const p0x = outV[i0 * 3], p0y = outV[i0 * 3 + 1], p0z = outV[i0 * 3 + 2];
      const p1x = outV[i1 * 3], p1y = outV[i1 * 3 + 1], p1z = outV[i1 * 3 + 2];
      const p2x = outV[i2 * 3], p2y = outV[i2 * 3 + 1], p2z = outV[i2 * 3 + 2];

      const uX = p1x - p0x, uY = p1y - p0y, uZ = p1z - p0z;
      const vX = p2x - p0x, vY = p2y - p0y, vZ = p2z - p0z;

      const nX = uY * vZ - uZ * vY;
      const nY = uZ * vX - uX * vZ;
      const nZ = uX * vY - uY * vX;

      normals[i0 * 3]     += nX; normals[i0 * 3 + 1] += nY; normals[i0 * 3 + 2] += nZ;
      normals[i1 * 3]     += nX; normals[i1 * 3 + 1] += nY; normals[i1 * 3 + 2] += nZ;
      normals[i2 * 3]     += nX; normals[i2 * 3 + 1] += nY; normals[i2 * 3 + 2] += nZ;
    }

    for (let k = 0; k < normals.length; k += 3) {
      const l = Math.hypot(normals[k], normals[k + 1], normals[k + 2]);
      if (l > 0.0001) {
        normals[k] /= l;
        normals[k + 1] /= l;
        normals[k + 2] /= l;
      } else {
        normals[k + 1] = 1.0;
      }
    }

    return {
      vertices: outV,
      normals: normals,
      colors: outC,
      texcoords: outT,
      indices: outI
    };
  }

  function buildTravelerBootsIconMesh(rawVertices, rawColors, rawIndices) {
    // Stagger boots cleanly side-by-side in 3/4 view with true shin shaft tilt & readable dark-charcoal highlights
    const bMesh = buildTravelerBootsMesh(
      [-0.058, 0.0, -0.014],
      [ 0.058, 0.0,  0.016],
      1.15,
      {
        leftKneeRot:  [-0.058, 0.175, -0.004],
        rightKneeRot: [ 0.058, 0.175,  0.026]
      }
    );
    _appendCCWMeshAsCWIcon(bMesh, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: false,
      colorMap: (r, g, b) => {
        if (r > 0.145) return [0.31, 0.325, 0.375];
        if (r > 0.095) return [0.22, 0.230, 0.270];
        if (r > 0.052) return [0.11, 0.115, 0.138];
        return [0.075, 0.080, 0.098];
      }
    });
  }

  window.buildTravelerBootsMesh = buildTravelerBootsMesh;
  window.buildTravelerBootsIconMesh = buildTravelerBootsIconMesh;
  if (window.CapsuleModel) {
    window.CapsuleModel.buildTravelerBootsMesh = buildTravelerBootsMesh;
    window.CapsuleModel.buildTravelerBootsIconMesh = buildTravelerBootsIconMesh;
  }
  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["traveler_boots"] = Object.assign({}, window.ItemRegistry["TRAVELER_BOOTS"] || {}, {
    buildMesh: buildTravelerBootsMesh,
    buildIconMesh: buildTravelerBootsIconMesh
  });
  window.ItemRegistry["TRAVELER_BOOTS"] = window.ItemRegistry["traveler_boots"];
})();
