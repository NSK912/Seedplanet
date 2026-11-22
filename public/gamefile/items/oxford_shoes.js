// === SEEDPLANET MODULE: JS/ITEMS/OXFORD_SHOES.JS ===
// Polished Black Cap-Toe Oxford Dress Shoes (OXFORD_SHOES) — worn 3D mesh & inventory icon mesh

(function() {
  const H = window._CapsuleClothHelpers || {};
  const _qNum = H._qNum;
  const _qVec3 = H._qVec3;
  const _cachedClothBuild = H._cachedClothBuild;
  const _appendCCWMeshAsCWIcon = H._appendCCWMeshAsCWIcon;
  const computeLegRigFrame = H.computeLegRigFrame || window.computeLegRigFrame;

  function buildOxfordShoesMesh(leftFootRot, rightFootRot, scale = 1.0, clothContext = null) {
    const key = "oxfords|" + _qNum(scale, 1000) + "|" + _qVec3(leftFootRot) + "|" + _qVec3(rightFootRot)
      + "|" + (clothContext ? (_qVec3(clothContext.leftKneeRot) + "|" + _qVec3(clothContext.rightKneeRot) + "|" + _qVec3(clothContext.leftLegPivot) + "|" + _qVec3(clothContext.rightLegPivot)) : "n");
    return _cachedClothBuild(key, clothContext, () => _buildOxfordShoesMeshRaw(leftFootRot, rightFootRot, scale, clothContext));
  }

  function _buildOxfordShoesMeshRaw(leftFootRot, rightFootRot, scale = 1.0, clothContext = null) {
    const outV = [];
    const outC = [];
    const outI = [];
    const outT = [];
    const s = scale || 1.0;

    // Color bands carefully separated so both in-world shading & 3D icon lifting read crisply
    const colUpper     = [0.068, 0.072, 0.086]; // Polished black calfskin upper
    const colSheen     = [0.128, 0.135, 0.160]; // Glossy leather bevel & vamp highlight
    const colSeamHi    = [0.162, 0.170, 0.198]; // Stitched cap-toe ridge & quarter piping
    const colFacing    = [0.082, 0.087, 0.104]; // Raised closed-lacing quarter panels
    const colLaceBar   = [0.145, 0.152, 0.176]; // Waxed parallel bar laces
    const colSlitDark  = [0.030, 0.032, 0.040]; // Deep closed-lacing throat channel
    const colWelt      = [0.052, 0.055, 0.068]; // Protruding Goodyear leather welt rim
    const colSole      = [0.036, 0.038, 0.048]; // Stacked dress heel & sole bottom
    const colHeelTier  = [0.058, 0.061, 0.075]; // Subtle stacked leather heel lift highlight
    const colTanWall   = [0.560, 0.390, 0.200]; // Warm tan leather inner collar lining
    const colTanInsole = [0.740, 0.540, 0.290]; // Warm tan calfskin footbed insole

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

    const addOxfordShoe = (pFoot, pKnee, isLeft, pHip = null, legRig = null) => {
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

      const footPt = (dx, dy, dz) => [
        fx + fRight[0] * dx + fUp[0] * dy + fFwd[0] * dz,
        fy + fRight[1] * dx + fUp[1] * dy + fFwd[1] * dz,
        fz + fRight[2] * dx + fUp[2] * dy + fFwd[2] * dz
      ];

      const xBias = (isLeft ? -0.0010 : 0.0010) * s;

      // Helper for tapered Oxford footprint width at longitudinal coordinate zLocal
      const footShapeAtZ = (zVal) => {
        if (zVal < -0.015) {
          const u = Math.max(0.0, Math.min(1.0, (zVal + 0.0410) / 0.0260));
          const rx = (0.0308 + 0.0082 * Math.sin(u * Math.PI * 0.5)) * s;
          return { rxMed: rx, rxLat: rx, dxC: 0.0 };
        }
        if (zVal < 0.024) {
          const u = (zVal + 0.015) / 0.039;
          return {
            rxMed: (0.0390 + 0.0016 * u) * s,
            rxLat: (0.0392 + 0.0020 * u) * s,
            dxC: xBias * u * 0.35
          };
        }
        if (zVal < 0.050) {
          const u = (zVal - 0.024) / 0.026;
          return {
            rxMed: (0.0406 - 0.0004 * u) * s,
            rxLat: (0.0412 - 0.0014 * u) * s,
            dxC: xBias * (0.35 + 0.45 * u)
          };
        }
        const u = Math.max(0.0, Math.min(1.0, (zVal - 0.050) / 0.0295));
        const taper = Math.pow(1.0 - Math.pow(u, 1.38), 0.72);
        return {
          rxMed: Math.max(0.0115 * s, 0.0402 * s * taper),
          rxLat: Math.max(0.0102 * s, 0.0398 * s * taper * (1.0 - 0.08 * u)),
          dxC: xBias * (0.80 + 0.25 * u) + medialSign * 0.0016 * u * s
        };
      };

      // 1. FOREFOOT VAMP, CAP-TOE, INSTEP & CLOSED THROAT SHELL
      const frontSlices = [
        { z: 0.0215 * s, zLatBias: 0.0005 * s, rxMed: 0.0406 * s, rxLat: 0.0412 * s, yBase: -0.0285 * s, hTop: 0.0450 * s, hBot: 0.0038 * s, pLat: 0.76, crestCol: colSheen  },
        { z: 0.0320 * s, zLatBias: 0.0012 * s, rxMed: 0.0410 * s, rxLat: 0.0416 * s, yBase: -0.0288 * s, hTop: 0.0415 * s, hBot: 0.0038 * s, pLat: 0.77, crestCol: colSheen  },
        { z: 0.0415 * s, zLatBias: 0.0020 * s, rxMed: 0.0410 * s, rxLat: 0.0414 * s, yBase: -0.0294 * s, hTop: 0.0342 * s, hBot: 0.0038 * s, pLat: 0.78, crestCol: colUpper  },
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
          const vyOff = cosA >= 0.0
            ? (Math.pow(cosA, 0.86) * sl.hTop)
            : (-Math.pow(-cosA, 0.55) * sl.hBot);
          const zShift = lat * sl.zLatBias;

          const col = (cosA > 0.55) ? sl.crestCol : colUpper;
          const pt = footPt(dxC + vxOff, sl.yBase + vyOff, sl.z + zShift);
          ring.push(addV(pt[0], pt[1], pt[2], col));
        }
        frontRings.push(ring);
      }
      for (let r = 0; r < frontRings.length - 1; r++) {
        const r0 = frontRings[r];
        const r1 = frontRings[r + 1];
        for (let i = 0; i < FRONT_SIDES; i++) {
          const nextI = (i + 1) % FRONT_SIDES;
          addQuad(r0[i], r1[i], r1[nextI], r0[nextI]);
        }
      }
      const throatCapRing = frontRings[0];
      const throatBackPt = footPt(xBias * 0.35, -0.008 * s, 0.0210 * s);
      const vThroatBack = addV(throatBackPt[0], throatBackPt[1], throatBackPt[2], colTanWall);
      for (let i = 0; i < FRONT_SIDES; i++) {
        const nextI = (i + 1) % FRONT_SIDES;
        addTri(vThroatBack, throatCapRing[i], throatCapRing[nextI]);
      }
      const toeCapRing = frontRings[frontRings.length - 1];
      const toeTipPt = footPt(xBias + medialSign * 0.0018 * s, -0.0272 * s, 0.0812 * s);
      const vToeTip = addV(toeTipPt[0], toeTipPt[1], toeTipPt[2], colSheen);
      for (let i = 0; i < FRONT_SIDES; i++) {
        const nextI = (i + 1) % FRONT_SIDES;
        addTri(vToeTip, toeCapRing[nextI], toeCapRing[i]);
      }

      // 2. U-SHAPED QUARTER & LOW-CUT TOPLINE COLLAR + TAN INNER LINING
      const U_STEPS = 22;
      const thetaMax = Math.PI * 0.61;
      const zColCenter = 0.0040 * s;
      const zBackRxOut = 0.0442 * s;
      const zBackRxIn  = 0.0405 * s;
      const zFwdRxOut  = 0.0560 * s;
      const zFwdRxIn   = 0.0495 * s;

      const collarSweeps = [];
      for (let uIdx = 0; uIdx <= U_STEPS; uIdx++) {
        const uNorm = uIdx / U_STEPS;
        const theta = -thetaMax + uNorm * (thetaMax * 2.0);
        const sT = Math.sin(theta);
        const cT = Math.cos(theta);

        const rxOut = (0.0422 - 0.0028 * Math.max(0, cT)) * s;
        const rxIn  = 0.0384 * s;
        const rzOut = cT >= 0.0 ? zBackRxOut : zFwdRxOut;
        const rzIn  = cT >= 0.0 ? zBackRxIn  : zFwdRxIn;

        const outX = sT * rxOut;
        const outZ = zColCenter - cT * rzOut;
        const inX  = sT * rxIn;
        const inZ  = zColCenter - cT * rzIn;

        const heelBump = Math.pow(Math.max(0.0, cT), 1.45) * 0.0105 * s;
        const throatClimb = Math.pow(Math.max(0.0, -cT) / 0.34, 1.25) * 0.0155 * s;
        const yTopline = 0.0010 * s + heelBump + throatClimb;

        const bellyFlare = 1.0 + 0.035 * Math.pow(Math.max(0.0, cT), 0.7);
        const midX = outX * bellyFlare;
        const midZ = zColCenter - cT * (rzOut * (1.0 + 0.025 * Math.max(0.0, cT)));
        const yMid = (-0.0185 * s + yTopline) * 0.52;

        const botX = outX * 0.92;
        const botZ = zColCenter - cT * (rzOut * 0.92);
        const wallDefs = [
          { x: outX * 0.48 + inX * 0.45, y: -0.0315 * s,            z: outZ * 0.48 + inZ * 0.45, col: colUpper     },
          { x: botX,                      y: -0.0298 * s,            z: botZ,                      col: colUpper     },
          { x: midX,                      y: yMid,                   z: midZ,                      col: colUpper     },
          { x: outX,                      y: yTopline - 0.0018 * s,  z: outZ,                      col: colSheen     },
          { x: outX * 0.55 + inX * 0.45,  y: yTopline,               z: outZ * 0.55 + inZ * 0.45,  col: colSheen     },
          { x: inX,                       y: yTopline - 0.0014 * s,  z: inZ,                       col: colTanWall   },
          { x: inX * 0.96,                y: -0.0150 * s,            z: inZ * 0.96,                col: colTanWall   },
          { x: inX * 0.91,                y: -0.0282 * s,            z: inZ * 0.91,                col: colTanInsole }
        ];

        const sec = [];
        for (let k = 0; k < wallDefs.length; k++) {
          const wd = wallDefs[k];
          const p = footPt(wd.x, wd.y, wd.z);
          sec.push({ idx: addV(p[0], p[1], p[2], wd.col), x: wd.x, y: wd.y, z: wd.z });
        }
        collarSweeps.push(sec);
      }

      const W_LEN = collarSweeps[0].length;
      for (let uIdx = 0; uIdx < U_STEPS; uIdx++) {
        const s0 = collarSweeps[uIdx];
        const s1 = collarSweeps[uIdx + 1];
        for (let k = 0; k < W_LEN; k++) {
          const nextK = (k + 1) % W_LEN;
          addQuad(s0[k].idx, s0[nextK].idx, s1[nextK].idx, s1[k].idx);
        }
      }
      const capWallEnd = (sec, isStart) => {
        let cx = 0, cy = 0, cz = 0;
        for (let k = 0; k < W_LEN; k++) { cx += sec[k].x; cy += sec[k].y; cz += sec[k].z; }
        cx /= W_LEN; cy /= W_LEN; cz /= W_LEN;
        const cp = footPt(cx, cy, cz);
        const vC = addV(cp[0], cp[1], cp[2], colUpper);
        for (let k = 0; k < W_LEN; k++) {
          const nextK = (k + 1) % W_LEN;
          if (isStart) addTri(vC, sec[nextK].idx, sec[k].idx);
          else addTri(vC, sec[k].idx, sec[nextK].idx);
        }
      };
      capWallEnd(collarSweeps[0], true);
      capWallEnd(collarSweeps[U_STEPS], false);

      // 3. WARM TAN LEATHER FOOTBED INSOLE FLOOR & INNER THROAT WALL
      const INSOLE_SIDES = 20;
      const insTop = [], insBot = [];
      for (let i = 0; i < INSOLE_SIDES; i++) {
        const ang = (i / INSOLE_SIDES) * Math.PI * 2.0;
        const sinA = Math.sin(ang);
        const cosA = Math.cos(ang);
        const zP = cosA >= 0 ? (0.002 + cosA * 0.0230) * s : (0.002 + cosA * 0.0365) * s;
        const xP = sinA * 0.0360 * s;
        const ptT = footPt(xP, -0.0282 * s, zP);
        const ptB = footPt(xP, -0.0315 * s, zP);
        insTop.push(addV(ptT[0], ptT[1], ptT[2], colTanInsole));
        insBot.push(addV(ptB[0], ptB[1], ptB[2], colUpper));
      }
      const pInsTopC = footPt(0, -0.0282 * s, -0.004 * s);
      const pInsBotC = footPt(0, -0.0315 * s, -0.004 * s);
      const vInsTopC = addV(pInsTopC[0], pInsTopC[1], pInsTopC[2], colTanInsole);
      const vInsBotC = addV(pInsBotC[0], pInsBotC[1], pInsBotC[2], colUpper);
      for (let i = 0; i < INSOLE_SIDES; i++) {
        const nextI = (i + 1) % INSOLE_SIDES;
        addTri(vInsTopC, insTop[i], insTop[nextI]);
        addTri(vInsBotC, insBot[nextI], insBot[i]);
        addQuad(insBot[i], insBot[nextI], insTop[nextI], insTop[i]);
      }

      const TONGUE_COLS = 8;
      const tLeft = -0.0295 * s, tRight = 0.0295 * s;
      const throatWallFront = [], throatWallBack = [];
      for (let ci = 0; ci <= TONGUE_COLS; ci++) {
        const u = ci / TONGUE_COLS;
        const x = tLeft + (tRight - tLeft) * u;
        const yTop = (0.0155 - Math.pow((u - 0.5) * 2.0, 2) * 0.0025) * s;
        const zCurve = (0.0228 - Math.pow((u - 0.5) * 2.0, 2) * 0.0045) * s;
        const rowF = [];
        const rowB = [];
        const ys = [-0.0290 * s, -0.0080 * s, yTop];
        for (let yi = 0; yi < ys.length; yi++) {
          const pF = footPt(x, ys[yi], zCurve);
          const pB = footPt(x, ys[yi], zCurve + 0.0035 * s);
          const col = (yi === 2) ? colSheen : colTanWall;
          rowF.push(addV(pF[0], pF[1], pF[2], col));
          rowB.push(addV(pB[0], pB[1], pB[2], colUpper));
        }
        throatWallFront.push(rowF);
        throatWallBack.push(rowB);
      }
      for (let ci = 0; ci < TONGUE_COLS; ci++) {
        for (let yi = 0; yi < 2; yi++) {
          addQuad(throatWallFront[ci][yi], throatWallFront[ci][yi + 1], throatWallFront[ci + 1][yi + 1], throatWallFront[ci + 1][yi]);
          addQuad(throatWallBack[ci][yi], throatWallBack[ci + 1][yi], throatWallBack[ci + 1][yi + 1], throatWallBack[ci][yi + 1]);
        }
        addQuad(throatWallFront[ci][2], throatWallBack[ci][2], throatWallBack[ci + 1][2], throatWallFront[ci + 1][2]);
      }

      // 4. CLOSED OXFORD QUARTERS, VAMP THROAT PIPING, CAP-TOE SEAM RIB & 5 BAR LACES + WING STITCHES
      const addClosedBoxRibbon = (ptsFn, uSteps, vSteps, colTop, colSide, flipTopWinding = false) => {
        const topGrid = [];
        const botGrid = [];
        for (let ui = 0; ui <= uSteps; ui++) {
          const u = ui / uSteps;
          const tRow = [], bRow = [];
          for (let vi = 0; vi <= vSteps; vi++) {
            const v = vi / vSteps;
            const res = ptsFn(u, v);
            const pT = footPt(res.top[0], res.top[1], res.top[2]);
            const pB = footPt(res.bot[0], res.bot[1], res.bot[2]);
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

      const instepY = (zLoc, xLoc) => {
        const yCenter = zLoc <= 0.032 * s
          ? (0.0165 * s - ((zLoc - 0.0215 * s) / (0.0105 * s)) * 0.0038 * s)
          : (0.0127 * s - ((zLoc - 0.0320 * s) / (0.0156 * s)) * 0.0133 * s);
        const rx = 0.0410 * s;
        const drop = Math.min(1.0, Math.pow(xLoc / rx, 2)) * 0.0145 * s;
        return yCenter - drop;
      };

      for (const side of [-1.0, 1.0]) {
        addClosedBoxRibbon((u, v) => {
          const zLoc = (0.0225 + u * 0.0180) * s;
          const xIn = side * (0.0014 + 0.0004 * u) * s;
          const xOut = side * (0.0155 + 0.0055 * Math.sin(u * Math.PI * 0.7)) * s;
          const xLoc = xIn + (xOut - xIn) * v;
          const yBase = instepY(zLoc, xLoc);
          return {
            top: [xLoc + 0.0005 * s * u, yBase + 0.0020 * s, zLoc],
            bot: [xLoc + 0.0005 * s * u, yBase - 0.0004 * s, zLoc],
            col: (v < 0.18 || u > 0.85) ? colSeamHi : colFacing
          };
        }, 5, 4, colFacing, colUpper, side < 0.0);
      }

      addClosedBoxRibbon((u, v) => {
        const zLoc = (0.0225 + u * 0.0178) * s;
        const xLoc = (-0.0018 + v * 0.0036) * s;
        const yBase = instepY(zLoc, xLoc);
        return {
          top: [xLoc, yBase + 0.0012 * s, zLoc],
          bot: [xLoc, yBase - 0.0006 * s, zLoc],
          col: colSlitDark
        };
      }, 4, 2, colSlitDark, colSlitDark, false);

      const laceZs = [0.0245, 0.0280, 0.0315, 0.0350, 0.0385];
      for (let li = 0; li < laceZs.length; li++) {
        const lz = laceZs[li] * s;
        const N_LACE_RAD = 6;
        const N_LACE_LEN = 4;
        const lRings = [];
        for (let xi = 0; xi <= N_LACE_LEN; xi++) {
          const tX = xi / N_LACE_LEN;
          const x = (-0.0078 + tX * 0.0156) * s;
          const yC = instepY(lz, x) + 0.0023 * s;
          const rTube = 0.00105 * s;
          const ring = [];
          for (let ri = 0; ri < N_LACE_RAD; ri++) {
            const ang = (ri / N_LACE_RAD) * Math.PI * 2.0;
            const py = yC + Math.cos(ang) * rTube * 0.80;
            const pz = lz + Math.sin(ang) * rTube;
            const p = footPt(x + xBias * 0.4, py, pz);
            ring.push(addV(p[0], p[1], p[2], Math.cos(ang) > 0 ? colLaceBar : colWelt));
          }
          lRings.push(ring);
        }
        for (let xi = 0; xi < N_LACE_LEN; xi++) {
          for (let ri = 0; ri < N_LACE_RAD; ri++) {
            const nextRi = (ri + 1) % N_LACE_RAD;
            addQuad(lRings[xi][ri], lRings[xi][nextRi], lRings[xi + 1][nextRi], lRings[xi + 1][ri]);
          }
        }
        const yC0 = instepY(lz, -0.0078 * s) + 0.0023 * s;
        const yC1 = instepY(lz,  0.0078 * s) + 0.0023 * s;
        const cap0 = footPt(-0.0082 * s + xBias * 0.4, yC0, lz);
        const cap1 = footPt( 0.0082 * s + xBias * 0.4, yC1, lz);
        const vc0 = addV(cap0[0], cap0[1], cap0[2], colLaceBar);
        const vc1 = addV(cap1[0], cap1[1], cap1[2], colLaceBar);
        for (let ri = 0; ri < N_LACE_RAD; ri++) {
          const nextRi = (ri + 1) % N_LACE_RAD;
          addTri(vc0, lRings[0][nextRi], lRings[0][ri]);
          addTri(vc1, lRings[N_LACE_LEN][ri], lRings[N_LACE_LEN][nextRi]);
        }
      }

      for (const side of [-1.0, 1.0]) {
        const WING_STEPS = 10;
        const wRings = [];
        for (let wi = 0; wi <= WING_STEPS; wi++) {
          const t = wi / WING_STEPS;
          const z = (0.022 - t * 0.058) * s;
          const y = (-0.027 + Math.sin(t * Math.PI * 0.52) * 0.0275) * s;
          const fs = footShapeAtZ(z / s);
          const x = side * ((side * medialSign > 0 ? fs.rxMed : fs.rxLat) + 0.0011 * s);
          const rPipe = 0.0011 * s;
          const ring = [];
          for (let ri = 0; ri < 6; ri++) {
            const ang = (ri / 6) * Math.PI * 2.0;
            const px = x + side * Math.cos(ang) * rPipe * 0.75;
            const py = y + Math.sin(ang) * rPipe;
            const p = footPt(px, py, z);
            ring.push(addV(p[0], p[1], p[2], Math.cos(ang) > 0 ? colSeamHi : colUpper));
          }
          wRings.push(ring);
        }
        for (let wi = 0; wi < WING_STEPS; wi++) {
          for (let ri = 0; ri < 6; ri++) {
            const nextRi = (ri + 1) % 6;
            if (side > 0) addQuad(wRings[wi][ri], wRings[wi + 1][ri], wRings[wi + 1][nextRi], wRings[wi][nextRi]);
            else addQuad(wRings[wi][ri], wRings[wi][nextRi], wRings[wi + 1][nextRi], wRings[wi + 1][ri]);
          }
        }
        const endCap = (ring, isFront) => {
          let cx = 0, cy = 0, cz = 0;
          for (let ri = 0; ri < 6; ri++) {
            cx += outV[ring[ri] * 3];
            cy += outV[ring[ri] * 3 + 1];
            cz += outV[ring[ri] * 3 + 2];
          }
          cx /= 6; cy /= 6; cz /= 6;
          const pushFwd = (isFront ? 0.0005 : -0.0005) * s;
          const vc = addV(cx + fFwd[0] * pushFwd, cy + fFwd[1] * pushFwd, cz + fFwd[2] * pushFwd, colUpper);
          for (let ri = 0; ri < 6; ri++) {
            const nextRi = (ri + 1) % 6;
            if ((side > 0) === isFront) addTri(vc, ring[ri], ring[nextRi]);
            else addTri(vc, ring[nextRi], ring[ri]);
          }
        };
        endCap(wRings[0], true);
        endCap(wRings[WING_STEPS], false);
      }

      // 5. GOODYEAR PROTRUDING WELT, RECESSED WAIST ARCH & FOREFOOT OUTSOLE + STACKED HEEL BLOCK
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
    if (leftFootRot) addOxfordShoe(leftFootRot, lKnee, true, lHip, lLegRig);
    if (rightFootRot) addOxfordShoe(rightFootRot, rKnee, false, rHip, rLegRig);

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

  function buildOxfordShoesIconMesh(rawVertices, rawColors, rawIndices) {
    const oMesh = buildOxfordShoesMesh(
      [-0.056, 0.0, -0.012],
      [ 0.056, 0.0,  0.014],
      1.15,
      {
        leftKneeRot:  [-0.056, 0.175, -0.012],
        rightKneeRot: [ 0.056, 0.175,  0.014]
      }
    );
    _appendCCWMeshAsCWIcon(oMesh, rawVertices, rawColors, rawIndices, {
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

  window.buildOxfordShoesMesh = buildOxfordShoesMesh;
  window.buildOxfordShoesIconMesh = buildOxfordShoesIconMesh;
  if (window.CapsuleModel) {
    window.CapsuleModel.buildOxfordShoesMesh = buildOxfordShoesMesh;
    window.CapsuleModel.buildOxfordShoesIconMesh = buildOxfordShoesIconMesh;
  }
  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["oxford_shoes"] = Object.assign({}, window.ItemRegistry["OXFORD_SHOES"] || {}, {
    buildMesh: buildOxfordShoesMesh,
    buildIconMesh: buildOxfordShoesIconMesh
  });
  window.ItemRegistry["OXFORD_SHOES"] = window.ItemRegistry["oxford_shoes"];
})();
