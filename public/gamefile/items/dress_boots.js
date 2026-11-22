// === SEEDPLANET MODULE: JS/ITEMS/DRESS_BOOTS.JS ===
// High-Shaft Cap-Toe Balmoral Dress Boots (DRESS_BOOTS) — worn 3D mesh & inventory icon mesh

(function() {
  const H = window._CapsuleClothHelpers || {};
  const _qNum = H._qNum;
  const _qVec3 = H._qVec3;
  const _cachedClothBuild = H._cachedClothBuild;
  const _appendCCWMeshAsCWIcon = H._appendCCWMeshAsCWIcon;
  const computeLegRigFrame = H.computeLegRigFrame || window.computeLegRigFrame;
  const getCharacterEquippedClothingState = H.getCharacterEquippedClothingState || window.getCharacterEquippedClothingState;

  function buildDressBootsMesh(leftFootRot, rightFootRot, scale = 1.0, clothContext = null) {
    const isIconFlag = (clothContext && clothContext.isIcon) ? 1 : 0;
    const eqB = isIconFlag ? null : getCharacterEquippedClothingState(false);
    const underSlacks = (eqB && eqB.wearSlacks) ? 1 : 0;
    const key = "dressBoots|" + isIconFlag + "|" + underSlacks + "|" + _qNum(scale, 1000)
      + "|" + _qVec3(leftFootRot) + "|" + _qVec3(rightFootRot)
      + "|" + (clothContext ? (_qVec3(clothContext.leftKneeRot) + "|" + _qVec3(clothContext.rightKneeRot) + "|" + _qVec3(clothContext.leftLegPivot) + "|" + _qVec3(clothContext.rightLegPivot)) : "n");
    return _cachedClothBuild(key, clothContext, () => _buildDressBootsMeshRaw(leftFootRot, rightFootRot, scale, clothContext));
  }

  function _buildDressBootsMeshRaw(leftFootRot, rightFootRot, scale = 1.0, clothContext = null) {
    const outV = [];
    const outC = [];
    const outI = [];
    const outT = [];
    const s = scale || 1.0;

    const colUpper     = [0.068, 0.072, 0.086];
    const colSheen     = [0.128, 0.135, 0.160];
    const colSeamHi    = [0.162, 0.170, 0.198];
    const colFacing    = [0.082, 0.087, 0.104];
    const colLaceBar   = [0.145, 0.152, 0.176];
    const colSlitDark  = [0.030, 0.032, 0.040];
    const colWelt      = [0.052, 0.055, 0.068];
    const colSole      = [0.036, 0.038, 0.048];
    const colHeelTier  = [0.058, 0.061, 0.075];
    const colTanWall   = [0.560, 0.390, 0.200];

    const addV = (px, py, pz, color) => {
      const idx = (outV.length / 3) | 0;
      outV.push(px, py, pz);
      outC.push(color[0], color[1], color[2]);
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

    const addDressBoot = (pFoot, pKnee, isLeft, pHip = null, legRig = null) => {
      if (!pFoot) return;
      const fx = pFoot[0];
      const fy = pFoot[1];
      const fz = pFoot[2];
      const medialSign = isLeft ? 1.0 : -1.0;

      const activeLegRig = legRig || computeLegRigFrame(pHip, pKnee, pFoot, isLeft);
      const footBasis = activeLegRig.footBoneBasis;
      const fRight = footBasis.rightAxis;
      const fUp    = footBasis.upAxis;
      const fFwd   = footBasis.fwdAxis;

      let ux = fUp[0], uy = fUp[1], uz = fUp[2];
      if (pKnee) {
        const vx = pKnee[0] - fx, vy = pKnee[1] - fy, vz = pKnee[2] - fz;
        const vLen = Math.hypot(vx, vy, vz);
        if (vLen > 1e-4) { ux = vx / vLen; uy = vy / vLen; uz = vz / vLen; }
      }
      let rxX = uy * fFwd[2] - uz * fFwd[1];
      let rxY = uz * fFwd[0] - ux * fFwd[2];
      let rxZ = ux * fFwd[1] - uy * fFwd[0];
      const rxL = Math.hypot(rxX, rxY, rxZ) || 1.0;
      rxX /= rxL; rxY /= rxL; rxZ /= rxL;
      const fxX = rxY * uz - rxZ * uy;
      const fxY = rxZ * ux - rxX * uz;
      const fxZ = rxX * uy - rxY * ux;
      const shRight = [rxX, rxY, rxZ];
      const shUp    = [ux, uy, uz];
      const shFwd   = [fxX, fxY, fxZ];

      const footPt = (dx, dy, dz) => [
        fx + fRight[0] * dx + fUp[0] * dy + fFwd[0] * dz,
        fy + fRight[1] * dx + fUp[1] * dy + fFwd[1] * dz,
        fz + fRight[2] * dx + fUp[2] * dy + fFwd[2] * dz
      ];

      const normAxis = (a, b, t) => {
        const vx = a[0] * (1.0 - t) + b[0] * t;
        const vy = a[1] * (1.0 - t) + b[1] * t;
        const vz = a[2] * (1.0 - t) + b[2] * t;
        const l = Math.hypot(vx, vy, vz) || 1.0;
        return [vx / l, vy / l, vz / l];
      };
      const eqBoots = (clothContext && clothContext.isIcon) ? null : getCharacterEquippedClothingState(false);
      const underSlacks = !!(eqBoots && eqBoots.wearSlacks);
      const shaftBlendStart = -0.010 * s;
      const shaftBlendSpan  =  0.022 * s;
      const bootShaftPt = (dx, dy, dz) => {
        const w = Math.max(0.0, Math.min(1.0, (dy - shaftBlendStart) / shaftBlendSpan));
        const rAx = normAxis(fRight, shRight, w);
        const uAx = normAxis(fUp, shUp, w);
        const fAx = normAxis(fFwd, shFwd, w);
        const zBack = -0.0014 * s * w;
        return [
          fx + rAx[0] * dx + uAx[0] * dy + fAx[0] * (dz + zBack),
          fy + rAx[1] * dx + uAx[1] * dy + fAx[1] * (dz + zBack),
          fz + rAx[2] * dx + uAx[2] * dy + fAx[2] * (dz + zBack)
        ];
      };

      const xBias = (isLeft ? -0.0010 : 0.0010) * s;

      const footShapeAtZ = (zVal) => {
        if (zVal < -0.015) {
          const u = Math.max(0.0, Math.min(1.0, (zVal + 0.0410) / 0.0260));
          const rx = (0.0308 + 0.0082 * Math.sin(u * Math.PI * 0.5)) * s;
          return { rxMed: rx, rxLat: rx, dxC: 0.0 };
        }
        if (zVal < 0.024) {
          const u = (zVal + 0.015) / 0.039;
          return { rxMed: (0.0390 + 0.0016 * u) * s, rxLat: (0.0392 + 0.0020 * u) * s, dxC: xBias * u * 0.35 };
        }
        if (zVal < 0.050) {
          const u = (zVal - 0.024) / 0.026;
          return { rxMed: (0.0406 - 0.0004 * u) * s, rxLat: (0.0412 - 0.0014 * u) * s, dxC: xBias * (0.35 + 0.45 * u) };
        }
        const u = Math.max(0.0, Math.min(1.0, (zVal - 0.050) / 0.0295));
        const taper = Math.pow(1.0 - Math.pow(u, 1.38), 0.72);
        return {
          rxMed: Math.max(0.0115 * s, 0.0402 * s * taper),
          rxLat: Math.max(0.0102 * s, 0.0398 * s * taper * (1.0 - 0.08 * u)),
          dxC: xBias * (0.80 + 0.25 * u) + medialSign * 0.0016 * u * s
        };
      };

      // 1. FOREFOOT VAMP, CAP-TOE & BASE THROAT SHELL
      const frontSlices = [
        { z: 0.0215 * s, zLatBias: 0.0005 * s, rxMed: 0.0406 * s, rxLat: 0.0412 * s, yBase: -0.0285 * s, hTop: 0.0435 * s, hBot: 0.0038 * s, pLat: 0.76, crestCol: colSheen  },
        { z: 0.0320 * s, zLatBias: 0.0012 * s, rxMed: 0.0410 * s, rxLat: 0.0416 * s, yBase: -0.0288 * s, hTop: 0.0405 * s, hBot: 0.0038 * s, pLat: 0.77, crestCol: colSheen  },
        { z: 0.0415 * s, zLatBias: 0.0020 * s, rxMed: 0.0410 * s, rxLat: 0.0414 * s, yBase: -0.0294 * s, hTop: 0.0338 * s, hBot: 0.0038 * s, pLat: 0.78, crestCol: colUpper  },
        { z: 0.0462 * s, zLatBias: 0.0024 * s, rxMed: 0.0410 * s, rxLat: 0.0412 * s, yBase: -0.0296 * s, hTop: 0.0292 * s, hBot: 0.0038 * s, pLat: 0.79, crestCol: colUpper  },
        { z: 0.0476 * s, zLatBias: 0.0024 * s, rxMed: 0.0414 * s, rxLat: 0.0416 * s, yBase: -0.0296 * s, hTop: 0.0290 * s, hBot: 0.0038 * s, pLat: 0.79, crestCol: colSeamHi },
        { z: 0.0500 * s, zLatBias: 0.0026 * s, rxMed: 0.0406 * s, rxLat: 0.0404 * s, yBase: -0.0298 * s, hTop: 0.0265 * s, hBot: 0.0038 * s, pLat: 0.80, crestCol: colSheen  },
        { z: 0.0610 * s, zLatBias: 0.0030 * s, rxMed: 0.0352 * s, rxLat: 0.0334 * s, yBase: -0.0300 * s, hTop: 0.0205 * s, hBot: 0.0036 * s, pLat: 0.82, crestCol: colSheen  },
        { z: 0.0715 * s, zLatBias: 0.0025 * s, rxMed: 0.0252 * s, rxLat: 0.0228 * s, yBase: -0.0300 * s, hTop: 0.0138 * s, hBot: 0.0034 * s, pLat: 0.85, crestCol: colSheen  },
        { z: 0.0785 * s, zLatBias: 0.0018 * s, rxMed: 0.0145 * s, rxLat: 0.0130 * s, yBase: -0.0296 * s, hTop: 0.0076 * s, hBot: 0.0030 * s, pLat: 0.88, crestCol: colUpper  }
      ];
      const FRONT_SIDES = 24;
      const frontRings = [];
      for (let r = 0; r < frontSlices.length; r++) {
        const sl = frontSlices[r];
        const ring = [];
        const tFwd = r / (frontSlices.length - 1);
        const dxC = xBias * (0.35 + 0.65 * Math.pow(tFwd, 1.1));
        for (let i = 0; i < FRONT_SIDES; i++) {
          const ang = (i / FRONT_SIDES) * Math.PI * 2.0;
          const sinA = Math.sin(ang);
          const cosA = Math.cos(ang);
          const lat = sinA * medialSign;
          const rxSide = lat >= 0.0 ? sl.rxMed : sl.rxLat;
          const sSign = sinA >= 0.0 ? 1.0 : -1.0;
          const pHoriz = cosA >= 0.0 ? (sl.pLat + 0.09 * cosA) : (sl.pLat * 0.92);
          const vxOff = sSign * Math.pow(Math.abs(sinA), pHoriz) * rxSide;
          const vyOff = cosA >= 0.0 ? (Math.pow(cosA, 0.86) * sl.hTop) : (-Math.pow(-cosA, 0.55) * sl.hBot);
          const zShift = lat * sl.zLatBias;
          const col = (cosA > 0.55) ? sl.crestCol : colUpper;
          const pt = footPt(dxC + vxOff, sl.yBase + vyOff, sl.z + zShift);
          ring.push(addV(pt[0], pt[1], pt[2], col));
        }
        frontRings.push(ring);
      }
      for (let r = 0; r < frontRings.length - 1; r++) {
        const r0 = frontRings[r], r1 = frontRings[r + 1];
        for (let i = 0; i < FRONT_SIDES; i++) {
          const nextI = (i + 1) % FRONT_SIDES;
          addQuad(r0[i], r1[i], r1[nextI], r0[nextI]);
        }
      }
      const throatCapRing = frontRings[0];
      const throatBackPt = footPt(xBias * 0.35, -0.008 * s, 0.0210 * s);
      const vThroatBack = addV(throatBackPt[0], throatBackPt[1], throatBackPt[2], colUpper);
      for (let i = 0; i < FRONT_SIDES; i++) {
        addTri(vThroatBack, throatCapRing[i], throatCapRing[(i + 1) % FRONT_SIDES]);
      }
      const toeCapRing = frontRings[frontRings.length - 1];
      const toeTipPt = footPt(xBias + medialSign * 0.0018 * s, -0.0272 * s, 0.0812 * s);
      const vToeTip = addV(toeTipPt[0], toeTipPt[1], toeTipPt[2], colSheen);
      for (let i = 0; i < FRONT_SIDES; i++) {
        addTri(vToeTip, toeCapRing[(i + 1) % FRONT_SIDES], toeCapRing[i]);
      }

      // 2. LOWER HEEL COUNTER SHELL + FITTED BALMORAL DRESS BOOT ANKLE SHAFT
      const SHAFT_SIDES = 24;
      const slTrim = underSlacks ? 0.0024 * s : 0.0;
      const slTrimZ = underSlacks ? 0.0052 * s : 0.0;
      const shaftWallProfiles = [
        { y:  0.0340 * s, rx: 0.0365 * s,                  rzF: 0.0295 * s,                  rzB: 0.0340 * s,                  zOff: -0.0012 * s, col: colTanWall, useShin: true  },
        { y:  0.0532 * s, rx: 0.0434 * s - slTrim,         rzF: 0.0408 * s - slTrimZ,        rzB: 0.0402 * s - slTrim,         zOff: -0.0012 * s, col: colTanWall, useShin: true  },
        { y:  0.0566 * s, rx: 0.0442 * s - slTrim,         rzF: 0.0416 * s - slTrimZ,        rzB: 0.0410 * s - slTrim,         zOff: -0.0013 * s, col: colSheen,   useShin: true  },
        { y:  0.0572 * s, rx: 0.0452 * s - slTrim,         rzF: 0.0422 * s - slTrimZ,        rzB: 0.0416 * s - slTrim,         zOff: -0.0013 * s, col: colSheen,   useShin: true  },
        { y:  0.0546 * s, rx: 0.0456 * s - slTrim,         rzF: 0.0426 * s - slTrimZ,        rzB: 0.0418 * s - slTrim,         zOff: -0.0013 * s, col: colSeamHi,  useShin: true  },
        { y:  0.0522 * s, rx: 0.0450 * s - slTrim,         rzF: 0.0422 * s - slTrimZ,        rzB: 0.0414 * s - slTrim,         zOff: -0.0012 * s, col: colUpper,   useShin: true  },
        { y:  0.0340 * s, rx: 0.0436 * s - slTrim * 0.75,  rzF: 0.0418 * s - slTrimZ,        rzB: 0.0408 * s - slTrim * 0.75,  zOff: -0.0010 * s, col: colUpper,   useShin: true  },
        { y:  0.0130 * s, rx: 0.0422 * s - slTrim * 0.35,  rzF: 0.0404 * s - slTrimZ * 0.5,  rzB: 0.0404 * s - slTrim * 0.35,  zOff: -0.0006 * s, col: colUpper,   useShin: true  },
        { y: -0.0110 * s, rx: 0.0420 * s,                  rzF: 0.0365 * s,                  rzB: 0.0412 * s,                  zOff:  0.0000 * s, col: colUpper,   useShin: false },
        { y: -0.0295 * s, rx: 0.0392 * s,                  rzF: 0.0320 * s,                  rzB: 0.0395 * s,                  zOff:  0.0000 * s, col: colUpper,   useShin: false }
      ];

      const shaftRings = [];
      for (let r = 0; r < shaftWallProfiles.length; r++) {
        const pf = shaftWallProfiles[r];
        const ring = [];
        for (let i = 0; i < SHAFT_SIDES; i++) {
          const ang = (i / SHAFT_SIDES) * Math.PI * 2.0;
          const sinA = Math.sin(ang);
          const cosA = Math.cos(ang);
          const rzSide = cosA >= 0.0 ? pf.rzF : pf.rzB;
          const px = sinA * pf.rx;
          const pz = pf.zOff + cosA * rzSide;
          const pt = pf.useShin ? bootShaftPt(px, pf.y, pz) : footPt(px, pf.y, pz);
          ring.push(addV(pt[0], pt[1], pt[2], pf.col));
        }
        shaftRings.push(ring);
      }
      for (let r = 0; r < shaftRings.length - 1; r++) {
        const r0 = shaftRings[r], r1 = shaftRings[r + 1];
        for (let i = 0; i < SHAFT_SIDES; i++) {
          const nextI = (i + 1) % SHAFT_SIDES;
          addQuad(r0[i], r1[i], r1[nextI], r0[nextI]);
        }
      }
      const pShaftInnerCap = bootShaftPt(0, 0.0315 * s, -0.002 * s);
      const vShaftInnerCap = addV(pShaftInnerCap[0], pShaftInnerCap[1], pShaftInnerCap[2], colTanWall);
      for (let i = 0; i < SHAFT_SIDES; i++) {
        addTri(vShaftInnerCap, shaftRings[0][(i + 1) % SHAFT_SIDES], shaftRings[0][i]);
      }
      const pShaftBotCap = footPt(0, -0.0305 * s, -0.002 * s);
      const vShaftBotCap = addV(pShaftBotCap[0], pShaftBotCap[1], pShaftBotCap[2], colUpper);
      for (let i = 0; i < SHAFT_SIDES; i++) {
        addTri(vShaftBotCap, shaftRings[shaftRings.length - 1][i], shaftRings[shaftRings.length - 1][(i + 1) % SHAFT_SIDES]);
      }

      // 3. BALMORAL CLOSED-LACING FRONT COLUMN + 7 HORIZONTAL BAR LACES + CURVED GALOSH PIPING
      const frontColumnYZ = (u) => {
        const y = (0.009 + u * 0.047) * s;
        const z = (0.0428 - Math.pow(u, 0.85) * 0.0040 - (underSlacks ? 0.0045 : 0.0)) * s;
        return { y, z };
      };

      const addClosedBoxRibbon = (ptsFn, uSteps, vSteps, colTop, colSide, flipTopWinding = false) => {
        const topGrid = [];
        const botGrid = [];
        for (let ui = 0; ui <= uSteps; ui++) {
          const u = ui / uSteps;
          const tRow = [], bRow = [];
          for (let vi = 0; vi <= vSteps; vi++) {
            const v = vi / vSteps;
            const res = ptsFn(u, v);
            const pT = res.shin ? bootShaftPt(res.top[0], res.top[1], res.top[2]) : footPt(res.top[0], res.top[1], res.top[2]);
            const pB = res.shin ? bootShaftPt(res.bot[0], res.bot[1], res.bot[2]) : footPt(res.bot[0], res.bot[1], res.bot[2]);
            tRow.push(addV(pT[0], pT[1], pT[2], res.col || colTop));
            bRow.push(addV(pB[0], pB[1], pB[2], colSide || colTop));
          }
          topGrid.push(tRow);
          botGrid.push(bRow);
        }
        for (let ui = 0; ui < uSteps; ui++) {
          for (let vi = 0; vi < vSteps; vi++) {
            if (!flipTopWinding) {
              addQuad(topGrid[ui][vi], topGrid[ui + 1][vi], topGrid[ui + 1][vi + 1], topGrid[ui][vi + 1]);
              addQuad(botGrid[ui][vi], botGrid[ui][vi + 1], botGrid[ui + 1][vi + 1], botGrid[ui + 1][vi]);
            } else {
              addQuad(topGrid[ui][vi], topGrid[ui][vi + 1], topGrid[ui + 1][vi + 1], topGrid[ui + 1][vi]);
              addQuad(botGrid[ui][vi], botGrid[ui + 1][vi], botGrid[ui + 1][vi + 1], botGrid[ui][vi + 1]);
            }
          }
        }
        for (let ui = 0; ui < uSteps; ui++) {
          if (!flipTopWinding) {
            addQuad(botGrid[ui][0], topGrid[ui][0], topGrid[ui + 1][0], botGrid[ui + 1][0]);
            addQuad(botGrid[ui + 1][vSteps], topGrid[ui + 1][vSteps], topGrid[ui][vSteps], botGrid[ui][vSteps]);
          } else {
            addQuad(botGrid[ui][0], botGrid[ui + 1][0], topGrid[ui + 1][0], topGrid[ui][0]);
            addQuad(botGrid[ui + 1][vSteps], botGrid[ui][vSteps], topGrid[ui][vSteps], topGrid[ui + 1][vSteps]);
          }
        }
        for (let vi = 0; vi < vSteps; vi++) {
          if (!flipTopWinding) {
            addQuad(botGrid[0][vi + 1], topGrid[0][vi + 1], topGrid[0][vi], botGrid[0][vi]);
            addQuad(botGrid[uSteps][vi], topGrid[uSteps][vi], topGrid[uSteps][vi + 1], botGrid[uSteps][vi + 1]);
          } else {
            addQuad(botGrid[0][vi + 1], botGrid[0][vi], topGrid[0][vi], topGrid[0][vi + 1]);
            addQuad(botGrid[uSteps][vi], botGrid[uSteps][vi + 1], topGrid[uSteps][vi + 1], topGrid[uSteps][vi]);
          }
        }
      };

      addClosedBoxRibbon((u, v) => {
        const yz = frontColumnYZ(u);
        const x = (-0.0040 + v * 0.0080) * s;
        return {
          shin: true,
          top: [x, yz.y + 0.0005 * s, yz.z + 0.0012 * s],
          bot: [x, yz.y - 0.0012 * s, yz.z - 0.0020 * s],
          col: colSlitDark
        };
      }, 6, 2, colSlitDark, colSlitDark, false);

      for (const side of [-1.0, 1.0]) {
        addClosedBoxRibbon((u, v) => {
          const yz = frontColumnYZ(u);
          const xIn  = side * (0.0018 + 0.0005 * (1.0 - u)) * s;
          const xOut = side * (0.0175 + 0.0035 * Math.sin((1.0 - u) * Math.PI * 0.5)) * s;
          const x = xIn + (xOut - xIn) * v;
          const wrapBack = Math.pow(Math.abs(x) / (0.044 * s), 2) * 0.0045 * s;
          return {
            shin: true,
            top: [x, yz.y + 0.0008 * s, yz.z + 0.0030 * s - wrapBack],
            bot: [x, yz.y - 0.0008 * s, yz.z - 0.0006 * s - wrapBack],
            col: (v < 0.20 || v > 0.86 || u < 0.09) ? colSeamHi : colFacing
          };
        }, 7, 4, colFacing, colUpper, side < 0.0);
      }

      const NUM_LACES = 7;
      for (let li = 0; li < NUM_LACES; li++) {
        const u = 0.09 + (li / (NUM_LACES - 1)) * 0.83;
        const yz = frontColumnYZ(u);
        const N_LACE_RAD = 6;
        const N_LACE_LEN = 4;
        const lRings = [];
        for (let xi = 0; xi <= N_LACE_LEN; xi++) {
          const tX = xi / N_LACE_LEN;
          const x = (-0.0086 + tX * 0.0172) * s;
          const archFwd = (1.0 - Math.pow((tX - 0.5) * 2.0, 2)) * 0.0008 * s;
          const rTube = 0.00105 * s;
          const ring = [];
          for (let ri = 0; ri < N_LACE_RAD; ri++) {
            const ang = (ri / N_LACE_RAD) * Math.PI * 2.0;
            const py = yz.y + Math.sin(ang) * rTube * 0.85;
            const pz = yz.z + 0.0034 * s + archFwd + Math.cos(ang) * rTube;
            const p = bootShaftPt(x, py, pz);
            ring.push(addV(p[0], p[1], p[2], Math.cos(ang) > 0 ? colLaceBar : colWelt));
          }
          lRings.push(ring);
        }
        for (let xi = 0; xi < N_LACE_LEN; xi++) {
          for (let ri = 0; ri < N_LACE_RAD; ri++) {
            const nextRi = (ri + 1) % N_LACE_RAD;
            addQuad(lRings[xi][ri], lRings[xi + 1][ri], lRings[xi + 1][nextRi], lRings[xi][nextRi]);
          }
        }
        const cap0 = bootShaftPt(-0.0090 * s, yz.y, yz.z + 0.0032 * s);
        const cap1 = bootShaftPt( 0.0090 * s, yz.y, yz.z + 0.0032 * s);
        const vc0 = addV(cap0[0], cap0[1], cap0[2], colLaceBar);
        const vc1 = addV(cap1[0], cap1[1], cap1[2], colLaceBar);
        for (let ri = 0; ri < N_LACE_RAD; ri++) {
          const nextRi = (ri + 1) % N_LACE_RAD;
          addTri(vc0, lRings[0][nextRi], lRings[0][ri]);
          addTri(vc1, lRings[N_LACE_LEN][ri], lRings[N_LACE_LEN][nextRi]);
        }
      }

      const addSidePipingTube = (sampleFn, steps, side) => {
        const wRings = [];
        for (let wi = 0; wi <= steps; wi++) {
          const t = wi / steps;
          const pt = sampleFn(t);
          const fs = footShapeAtZ(pt.z / s);
          const x = side * ((side * medialSign > 0 ? fs.rxMed : fs.rxLat) + (pt.xExtra || 0.0014 * s));
          const rPipe = 0.0011 * s;
          const ring = [];
          for (let ri = 0; ri < 6; ri++) {
            const ang = (ri / 6) * Math.PI * 2.0;
            const px = x + side * Math.cos(ang) * rPipe * 0.78;
            const py = pt.y + Math.sin(ang) * rPipe;
            const p = footPt(px, py, pt.z);
            ring.push(addV(p[0], p[1], p[2], Math.cos(ang) > 0 ? colSeamHi : colUpper));
          }
          wRings.push(ring);
        }
        for (let wi = 0; wi < steps; wi++) {
          for (let ri = 0; ri < 6; ri++) {
            const nextRi = (ri + 1) % 6;
            if (side > 0) addQuad(wRings[wi][ri], wRings[wi + 1][ri], wRings[wi + 1][nextRi], wRings[wi][nextRi]);
            else addQuad(wRings[wi][ri], wRings[wi][nextRi], wRings[wi + 1][nextRi], wRings[wi + 1][ri]);
          }
        }
        const capEnd = (ring, isStart) => {
          let cx = 0, cy = 0, cz = 0;
          for (let ri = 0; ri < 6; ri++) { cx += outV[ring[ri] * 3]; cy += outV[ring[ri] * 3 + 1]; cz += outV[ring[ri] * 3 + 2]; }
          cx /= 6; cy /= 6; cz /= 6;
          const pushF = (isStart ? 0.0004 : -0.0004) * s;
          const vc = addV(cx + fFwd[0] * pushF, cy + fFwd[1] * pushF, cz + fFwd[2] * pushF, colUpper);
          for (let ri = 0; ri < 6; ri++) {
            const nextRi = (ri + 1) % 6;
            if ((side > 0) === isStart) addTri(vc, ring[ri], ring[nextRi]);
            else addTri(vc, ring[nextRi], ring[ri]);
          }
        };
        capEnd(wRings[0], true);
        capEnd(wRings[steps], false);
      };

      for (const side of [-1.0, 1.0]) {
        addSidePipingTube((t) => ({
          z: (0.0335 - t * 0.0695) * s,
          y: (0.0045 - Math.sin(t * Math.PI * 0.82) * 0.0235 - t * 0.0155) * s,
          xExtra: 0.0006 * s
        }), 10, side);
        addSidePipingTube((t) => ({
          z: (-0.0040 - t * 0.0360) * s,
          y: (-0.0285 + Math.sin(t * Math.PI * 0.55) * 0.0250) * s,
          xExtra: 0.0010 * s
        }), 8, side);
      }

      // 4. GOODYEAR PROTRUDING WELT, RECESSED WAIST, FOREFOOT OUTSOLE & STACKED DRESS HEEL BLOCK
      const outsoleSlices = [
        { z: -0.0405 * s, rxMed: 0.0328 * s, rxLat: 0.0328 * s, yTop: -0.0298 * s, yBot: -0.0358 * s, cT: colWelt, cB: colSole },
        { z: -0.0250 * s, rxMed: 0.0398 * s, rxLat: 0.0398 * s, yTop: -0.0302 * s, yBot: -0.0362 * s, cT: colWelt, cB: colSole },
        { z: -0.0080 * s, rxMed: 0.0406 * s, rxLat: 0.0410 * s, yTop: -0.0300 * s, yBot: -0.0362 * s, cT: colWelt, cB: colSole },
        { z:  0.0140 * s, rxMed: 0.0414 * s, rxLat: 0.0422 * s, yTop: -0.0306 * s, yBot: -0.0378 * s, cT: colWelt, cB: colSole },
        { z:  0.0260 * s, rxMed: 0.0426 * s, rxLat: 0.0432 * s, yTop: -0.0312 * s, yBot: -0.0432 * s, cT: colWelt, cB: colSole },
        { z:  0.0490 * s, rxMed: 0.0428 * s, rxLat: 0.0428 * s, yTop: -0.0318 * s, yBot: -0.0434 * s, cT: colWelt, cB: colSole },
        { z:  0.0680 * s, rxMed: 0.0315 * s, rxLat: 0.0294 * s, yTop: -0.0316 * s, yBot: -0.0430 * s, cT: colWelt, cB: colSole },
        { z:  0.0795 * s, rxMed: 0.0165 * s, rxLat: 0.0150 * s, yTop: -0.0308 * s, yBot: -0.0412 * s, cT: colWelt, cB: colSole }
      ];
      const SOLE_SIDES = 20;
      const soleRings = [];
      for (let r = 0; r < outsoleSlices.length; r++) {
        const sl = outsoleSlices[r];
        const ring = [];
        const tFwd = r / (outsoleSlices.length - 1);
        const dxC = xBias * Math.pow(tFwd, 1.15);
        for (let i = 0; i < SOLE_SIDES; i++) {
          const ang = (i / SOLE_SIDES) * Math.PI * 2.0;
          const sinA = Math.sin(ang);
          const cosA = Math.cos(ang);
          const lat = sinA * medialSign;
          const rx = lat >= 0.0 ? sl.rxMed : sl.rxLat;
          const sSign = sinA >= 0.0 ? 1.0 : -1.0;
          const vx = dxC + sSign * Math.pow(Math.abs(sinA), 0.78) * rx;
          const vy = cosA >= 0.0
            ? (sl.yTop + cosA * 0.0018 * s)
            : (sl.yTop + (-Math.pow(-cosA, 0.42)) * (sl.yTop - sl.yBot));
          const col = cosA >= -0.10 ? sl.cT : sl.cB;
          const p = footPt(vx, vy, sl.z + lat * 0.0018 * s * Math.min(1.0, tFwd * 1.4));
          ring.push(addV(p[0], p[1], p[2], col));
        }
        soleRings.push(ring);
      }
      for (let r = 0; r < soleRings.length - 1; r++) {
        for (let i = 0; i < SOLE_SIDES; i++) {
          const nextI = (i + 1) % SOLE_SIDES;
          addQuad(soleRings[r][i], soleRings[r + 1][i], soleRings[r + 1][nextI], soleRings[r][nextI]);
        }
      }
      const pSH = footPt(0, -0.0330 * s, -0.0420 * s);
      const vSH = addV(pSH[0], pSH[1], pSH[2], colSole);
      for (let i = 0; i < SOLE_SIDES; i++) addTri(vSH, soleRings[0][i], soleRings[0][(i + 1) % SOLE_SIDES]);
      const pST = footPt(xBias + medialSign * 0.0018 * s, -0.0360 * s, 0.0825 * s);
      const vST = addV(pST[0], pST[1], pST[2], colWelt);
      for (let i = 0; i < SOLE_SIDES; i++) addTri(vST, soleRings[soleRings.length - 1][(i + 1) % SOLE_SIDES], soleRings[soleRings.length - 1][i]);

      const heelBlockSlices = [
        { z: -0.0410 * s, rx: 0.0320 * s, yTop: -0.0325 * s, yBot: -0.0438 * s },
        { z: -0.0300 * s, rx: 0.0382 * s, yTop: -0.0330 * s, yBot: -0.0438 * s },
        { z: -0.0185 * s, rx: 0.0388 * s, yTop: -0.0330 * s, yBot: -0.0438 * s },
        { z: -0.0112 * s, rx: 0.0386 * s, yTop: -0.0330 * s, yBot: -0.0438 * s }
      ];
      const HB_SIDES = 18;
      const hbRings = [];
      for (let r = 0; r < heelBlockSlices.length; r++) {
        const sl = heelBlockSlices[r];
        const ring = [];
        for (let i = 0; i < HB_SIDES; i++) {
          const ang = (i / HB_SIDES) * Math.PI * 2.0;
          const sinA = Math.sin(ang);
          const cosA = Math.cos(ang);
          const sSign = sinA >= 0.0 ? 1.0 : -1.0;
          const vx = sSign * Math.pow(Math.abs(sinA), 0.72) * sl.rx;
          const vy = cosA >= 0.0 ? sl.yTop : (sl.yTop - Math.pow(-cosA, 0.45) * (sl.yTop - sl.yBot));
          const col = (Math.abs(cosA) < 0.35) ? colHeelTier : colSole;
          const p = footPt(vx, vy, sl.z);
          ring.push(addV(p[0], p[1], p[2], col));
        }
        hbRings.push(ring);
      }
      for (let r = 0; r < hbRings.length - 1; r++) {
        for (let i = 0; i < HB_SIDES; i++) {
          const nextI = (i + 1) % HB_SIDES;
          addQuad(hbRings[r][i], hbRings[r + 1][i], hbRings[r + 1][nextI], hbRings[r][nextI]);
        }
      }
      const pHBB = footPt(0, -0.0382 * s, -0.0422 * s);
      const pHBF = footPt(0, -0.0384 * s, -0.0112 * s);
      const vHBB = addV(pHBB[0], pHBB[1], pHBB[2], colSole);
      const vHBF = addV(pHBF[0], pHBF[1], pHBF[2], colSole);
      for (let i = 0; i < HB_SIDES; i++) {
        const nextI = (i + 1) % HB_SIDES;
        addTri(vHBB, hbRings[0][i], hbRings[0][nextI]);
        addTri(vHBF, hbRings[hbRings.length - 1][nextI], hbRings[hbRings.length - 1][i]);
      }
    };

    const lHip    = clothContext ? clothContext.leftLegPivot : null;
    const rHip    = clothContext ? clothContext.rightLegPivot : null;
    const lKnee   = clothContext ? clothContext.leftKneeRot : null;
    const rKnee   = clothContext ? clothContext.rightKneeRot : null;
    const lLegRig = clothContext ? clothContext.leftLegRig : null;
    const rLegRig = clothContext ? clothContext.rightLegRig : null;
    if (leftFootRot) addDressBoot(leftFootRot, lKnee, true, lHip, lLegRig);
    if (rightFootRot) addDressBoot(rightFootRot, rKnee, false, rHip, rLegRig);

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
      normals[i0 * 3] += nX; normals[i0 * 3 + 1] += nY; normals[i0 * 3 + 2] += nZ;
      normals[i1 * 3] += nX; normals[i1 * 3 + 1] += nY; normals[i1 * 3 + 2] += nZ;
      normals[i2 * 3] += nX; normals[i2 * 3 + 1] += nY; normals[i2 * 3 + 2] += nZ;
    }
    for (let k = 0; k < normals.length; k += 3) {
      const l = Math.hypot(normals[k], normals[k + 1], normals[k + 2]);
      if (l > 1e-8) {
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

  function buildDressBootsIconMesh(rawVertices, rawColors, rawIndices) {
    const dMesh = buildDressBootsMesh(
      [-0.058, 0.0, -0.014],
      [ 0.058, 0.0,  0.016],
      1.15,
      {
        isIcon: true,
        leftKneeRot:  [-0.058, 0.175, -0.014],
        rightKneeRot: [ 0.058, 0.175,  0.016]
      }
    );
    _appendCCWMeshAsCWIcon(dMesh, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: false,
      colorMap: (r, g, b) => {
        if (r > 0.45 && r > b * 1.4) {
          return [Math.min(1.0, r * 1.08), Math.min(1.0, g * 1.06), Math.min(1.0, b * 1.04)];
        }
        if (r > 0.150) return [0.40, 0.415, 0.465];
        if (r > 0.136) return [0.34, 0.355, 0.400];
        if (r > 0.115) return [0.29, 0.305, 0.345];
        if (r > 0.075) return [0.20, 0.210, 0.245];
        if (r > 0.060) return [0.16, 0.168, 0.198];
        if (r > 0.045) return [0.105, 0.110, 0.132];
        return [0.070, 0.075, 0.092];
      }
    });
  }

  window.buildDressBootsMesh = buildDressBootsMesh;
  window.buildDressBootsIconMesh = buildDressBootsIconMesh;
  if (window.CapsuleModel) {
    window.CapsuleModel.buildDressBootsMesh = buildDressBootsMesh;
    window.CapsuleModel.buildDressBootsIconMesh = buildDressBootsIconMesh;
  }
  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["dress_boots"] = Object.assign({}, window.ItemRegistry["DRESS_BOOTS"] || {}, {
    buildMesh: buildDressBootsMesh,
    buildIconMesh: buildDressBootsIconMesh
  });
  window.ItemRegistry["DRESS_BOOTS"] = window.ItemRegistry["dress_boots"];
})();
