// === SEEDPLANET MODULE: JS/ITEMS/WOOD_WALL.JS ===

window.ItemRegistry["wood_wall"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const r = item.R, f = item.F, n = item.normal;

    // Compute rotated orientation using item.angle (0.0 if undefined)
    const angle = item.angle || 0.0;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    
    const wallR = [
      r[0] * cosA + f[0] * sinA,
      r[1] * cosA + f[1] * sinA,
      r[2] * cosA + f[2] * sinA
    ];
    const wallF = [
      f[0] * cosA - r[0] * sinA,
      f[1] * cosA - r[1] * sinA,
      f[2] * cosA - r[2] * sinA
    ];

    const isValid = item.isValidPlacement !== false;
    const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    const baseColor = item.isPreview ? previewColor : (item.color || [0.65, 0.45, 0.25]);
    const rCol = baseColor[0];
    const gCol = baseColor[1];
    const bCol = baseColor[2];

    const isWindow = item.type === "wood_window";

    const itemsList = window.collectibles || [];
    const colLen = itemsList.length;

    function checkCoLocatedFixture(fixtureType) {
      const cx = Math.floor(p[0] / 0.5);
      const cy = Math.floor(p[1] / 0.5);
      const cz = Math.floor(p[2] / 0.5);
      const spatialMap = (fixtureType === "wood_door") ? window._spatialDoors : window._spatialWindows;
      if (spatialMap) {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              const k = (cx + dx) + "_" + (cy + dy) + "_" + (cz + dz);
              const list = spatialMap.get(k);
              if (list) {
                for (let i = 0; i < list.length; i++) {
                  const other = list[i];
                  if (other && other.active && other.type === fixtureType && !other.isPreview) {
                    const ox = other.position[0] - p[0];
                    const oy = other.position[1] - p[1];
                    const oz = other.position[2] - p[2];
                    if (ox * ox + oy * oy + oz * oz < 0.02) {
                      return true;
                    }
                  }
                }
              }
            }
          }
        }
      }
      for (let i = 0; i < itemsList.length; i++) {
        const other = itemsList[i];
        if (other && other.active && other.type === fixtureType && !other.isPreview) {
          const ox = other.position[0] - p[0];
          const oy = other.position[1] - p[1];
          const oz = other.position[2] - p[2];
          if (ox * ox + oy * oy + oz * oz < 0.02) {
            return true;
          }
        }
      }
      return false;
    }

    let hasCoLocatedDoor = checkCoLocatedFixture("wood_door");
    let hasCoLocatedWindow = (item.type === "wood_wall") ? checkCoLocatedFixture("wood_window") : false;

    // Check preview hovering over this wall in real time
    if (typeof window !== "undefined" && window.floorPreviewCollectible && window.floorPreviewCollectible.isPreview && window.floorPreviewCollectible.active) {
      const prev = window.floorPreviewCollectible;
      if (prev.type === "wood_door" || prev.type === "wood_window") {
        const ox = prev.position[0] - p[0];
        const oy = prev.position[1] - p[1];
        const oz = prev.position[2] - p[2];
        if (ox * ox + oy * oy + oz * oz < 0.02) {
          if (prev.type === "wood_door") hasCoLocatedDoor = true;
          if (prev.type === "wood_window") hasCoLocatedWindow = true;
        }
      }
    }

    function getTrimHeight(tOffset, defaultMax) {
      if (!item._trimCache || item._trimColLen !== colLen) {
        item._trimCache = {};
        item._trimColLen = colLen;
      }
      const cacheKey = Math.round(tOffset * 1000);
      if (!item.isPreview && item._trimCache[cacheKey] !== undefined) {
        return item._trimCache[cacheKey];
      }

      let maxH = defaultMax;
      const queryP = [
        p[0] + wallR[0] * tOffset,
        p[1] + wallR[1] * tOffset,
        p[2] + wallR[2] * tOffset
      ];
      let roofsToCheck;
      if (window._spatialRoofs) {
        roofsToCheck = [];
        const cx = Math.floor(queryP[0] / 2.0);
        const cy = Math.floor(queryP[1] / 2.0);
        const cz = Math.floor(queryP[2] / 2.0);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              const k = (cx + dx) + "_" + (cy + dy) + "_" + (cz + dz);
              const bucket = window._spatialRoofs.get(k);
              if (bucket) {
                for (let b = 0; b < bucket.length; b++) roofsToCheck.push(bucket[b]);
              }
            }
          }
        }
      } else {
        roofsToCheck = itemsList;
      }
      for (let other of roofsToCheck) {
        if (!other.active || other === item) continue;
        if (other.isPreview && !item.isPreview) continue;
        if (other.type === "wood_roof") {
          const oP = other.position || [0,0,0];
          const dx = oP[0] - queryP[0];
          const dy = oP[1] - queryP[1];
          const dz = oP[2] - queryP[2];
          if (dx*dx + dy*dy + dz*dz > 3.0) continue;

          // 1. Lower structural walls (below roof base) should NEVER be trimmed by roofs above them!
          const elevDiff = (p[0] - oP[0]) * n[0] + (p[1] - oP[1]) * n[1] + (p[2] - oP[2]) * n[2];
          if (elevDiff < -0.05) {
            continue;
          }

          const oR = other.R || [1,0,0];
          const oF = other.F || [0,0,1];
          const oN = other.normal || [0,1,0];
          const oAngle = other.angle || 0.0;
          const cosOA = Math.cos(oAngle);
          const sinOA = Math.sin(oAngle);
              
          const roofF = [
            oF[0] * cosOA - oR[0] * sinOA,
            oF[1] * cosOA - oR[1] * sinOA,
            oF[2] * cosOA - oR[2] * sinOA
          ];
          const roofR = [
            oR[0] * cosOA + oF[0] * sinOA,
            oR[1] * cosOA + oF[1] * sinOA,
            oR[2] * cosOA + oF[2] * sinOA
          ];

          // 2. Only trim upper walls that are perpendicular to the roof ridge (Gable walls)
          const dotWallR_roofR = Math.abs(wallR[0] * roofR[0] + wallR[1] * roofR[1] + wallR[2] * roofR[2]);
          if (dotWallR_roofR > 0.707) {
            continue;
          }
              
          const roofW = 0.30;
          const roofD = 0.30;
          const rise = 0.25;
          const slopeLen = Math.sqrt(roofD * roofD + rise * rise);
          let normSlope = [
            (oN[0] * roofD - roofF[0] * rise) / slopeLen,
            (oN[1] * roofD - roofF[1] * rise) / slopeLen,
            (oN[2] * roofD - roofF[2] * rise) / slopeLen
          ];
          if (normSlope[0] * oN[0] + normSlope[1] * oN[1] + normSlope[2] * oN[2] < 0) {
            normSlope = [-normSlope[0], -normSlope[1], -normSlope[2]];
          }
             
          const P_roof = [
            oP[0] + oN[0] * 0.125,
            oP[1] + oN[1] * 0.125,
            oP[2] + oN[2] * 0.125
          ];
             
          const nDotNorm = n[0] * normSlope[0] + n[1] * normSlope[1] + n[2] * normSlope[2];
          if (Math.abs(nDotNorm) > 0.001) {
            const P_to_query = [
              P_roof[0] - queryP[0],
              P_roof[1] - queryP[1],
              P_roof[2] - queryP[2]
            ];
            const dist = (P_to_query[0] * normSlope[0] + P_to_query[1] * normSlope[1] + P_to_query[2] * normSlope[2]);
            const t_hit = dist / nDotNorm;
               
            if (t_hit > -0.05 && t_hit < maxH) {
              const hitPt = [
                queryP[0] + n[0] * t_hit,
                queryP[1] + n[1] * t_hit,
                queryP[2] + n[2] * t_hit
              ];
              const diff = [
                hitPt[0] - oP[0],
                hitPt[1] - oP[1],
                hitPt[2] - oP[2]
              ];
              const u = diff[0] * roofR[0] + diff[1] * roofR[1] + diff[2] * roofR[2];
              const v = diff[0] * roofF[0] + diff[1] * roofF[1] + diff[2] * roofF[2];
              
              let vLimitMax = roofD * 0.5;
              if (other._vMaxEff !== undefined && other._vMaxEff < slopeLen * 0.5) {
                vLimitMax = other._vMaxEff * (roofD / slopeLen);
              }

              if (Math.abs(u) <= roofW * 0.5 + 0.045 && v >= -roofD * 0.5 - 0.035 && v <= vLimitMax + 0.035) {
                maxH = Math.min(defaultMax, Math.max(0, t_hit + 0.010));
              }
            }
          }
        }
      }
      if (!item.isPreview) { item._trimCache[cacheKey] = maxH; }
      return maxH;
    }
    

    function addCustomBox(bottomCenter, w, d, hl, hr, color, rotR, rotU, rotF, outVertices, outColors, outIndices) {
      if (hl <= 0.001 && hr <= 0.001) return;
      const hw = w / 2;
      const hd = d / 2;
      
      let r_ = rotR, u_ = rotU, f_ = rotF;
      let isFlipped = false;
      if (r_ && u_ && f_) {
        const det = (r_[1]*u_[2] - r_[2]*u_[1])*f_[0] + (r_[2]*u_[0] - r_[0]*u_[2])*f_[1] + (r_[0]*u_[1] - r_[1]*u_[0])*f_[2];
        if (det < 0) {
          isFlipped = true;
        }
      }
      
      const cubeVerts = [
        [-hw, 0, -hd],
        [hw, 0, -hd],
        [hw, 0, hd],
        [-hw, 0, hd],
        [-hw, hl, -hd],
        [hw, hr, -hd],
        [hw, hr, hd],
        [-hw, hl, hd],
      ];
      const baseIdx = outVertices.length / 3;
      for (let i = 0; i < 8; i++) {
         const v = cubeVerts[i];
         const rx = r_[0]*v[0] + u_[0]*v[1] + f_[0]*v[2];
         const ry = r_[1]*v[0] + u_[1]*v[1] + f_[1]*v[2];
         const rz = r_[2]*v[0] + u_[2]*v[1] + f_[2]*v[2];
         outVertices.push(bottomCenter[0]+rx, bottomCenter[1]+ry, bottomCenter[2]+rz);
         outColors.push(color[0], color[1], color[2]);
      }
      const cubeIndices = isFlipped ? [
        0, 1, 2, 0, 2, 3, // bottom
        4, 6, 5, 4, 7, 6, // top
        0, 5, 1, 0, 4, 5, // back
        2, 7, 3, 2, 6, 7, // front
        0, 3, 7, 0, 7, 4, // left
        1, 6, 2, 1, 5, 6  // right
      ] : [
        0, 2, 1, 0, 3, 2, // bottom (CW outward)
        4, 5, 6, 4, 6, 7, // top (CW outward)
        0, 1, 5, 0, 5, 4, // back (CW outward)
        2, 3, 7, 2, 7, 6, // front (CW outward)
        0, 7, 3, 0, 4, 7, // left (CW outward)
        1, 2, 6, 1, 6, 5, // right (CW outward)
      ];
      for (let i = 0; i < cubeIndices.length; i++) {
          outIndices.push(baseIdx + cubeIndices[i]);
      }
    }

    const beamDarkColor = [rCol * 0.8, gCol * 0.8, bCol * 0.8];
    const topTrimLeft = getTrimHeight(-0.15, 0.25);
    const topTrimRight = getTrimHeight(0.15, 0.25);
    const topTrimMid = getTrimHeight(0.0, 0.25);

    if (!isWindow || item.isPreview) {
      // 1) Bottom horizontal support beam & doorway stumps (non-overlapping width 0.300, extends 2mm into floor to prevent light leaks)
      if (hasCoLocatedDoor) {
        // Left bottom stump: width 0.060, centered at t = -0.120 (meets door post at t = -0.090 cleanly)
        const leftStumpCenter = [
          p[0] - wallR[0] * 0.120 + n[0] * 0.0105,
          p[1] - wallR[1] * 0.120 + n[1] * 0.0105,
          p[2] - wallR[2] * 0.120 + n[2] * 0.0105
        ];
        addBox(leftStumpCenter, 0.060, 0.025, 0.032, beamDarkColor, wallR, n, wallF, vertices, colors, indices);

        // Right bottom stump: width 0.060, centered at t = +0.120 (meets door post at t = +0.090 cleanly)
        const rightStumpCenter = [
          p[0] + wallR[0] * 0.120 + n[0] * 0.0105,
          p[1] + wallR[1] * 0.120 + n[1] * 0.0105,
          p[2] + wallR[2] * 0.120 + n[2] * 0.0105
        ];
        addBox(rightStumpCenter, 0.060, 0.025, 0.032, beamDarkColor, wallR, n, wallF, vertices, colors, indices);

        // Internal recessed floor-joint tongues under left/right wall segments only (hidden inside wall/floor)
        const leftTongueCenter = [
          p[0] - wallR[0] * 0.120 - n[0] * 0.003,
          p[1] - wallR[1] * 0.120 - n[1] * 0.003,
          p[2] - wallR[2] * 0.120 - n[2] * 0.003
        ];
        addBox(leftTongueCenter, 0.068, 0.012, 0.022, beamDarkColor, wallR, n, wallF, vertices, colors, indices);

        const rightTongueCenter = [
          p[0] + wallR[0] * 0.120 - n[0] * 0.003,
          p[1] + wallR[1] * 0.120 - n[1] * 0.003,
          p[2] + wallR[2] * 0.120 - n[2] * 0.003
        ];
        addBox(rightTongueCenter, 0.068, 0.012, 0.022, beamDarkColor, wallR, n, wallF, vertices, colors, indices);
      } else {
        // Full-width bottom sill beam (width 0.300, extends 2mm into floor and 32mm thick to guarantee zero light leak)
        const bottomBeamCenter = [
          p[0] + n[0] * 0.0105,
          p[1] + n[1] * 0.0105,
          p[2] + n[2] * 0.0105
        ];
        addBox(bottomBeamCenter, 0.300, 0.025, 0.032, beamDarkColor, wallR, n, wallF, vertices, colors, indices);

        // Internal recessed floor-joint tongue (depth 0.022 hidden inside the 0.024 wall thickness, width 0.316 overlapping 90-deg corners)
        const bottomTongueCenter = [
          p[0] - n[0] * 0.003,
          p[1] - n[1] * 0.003,
          p[2] - n[2] * 0.003
        ];
        addBox(bottomTongueCenter, 0.316, 0.012, 0.022, beamDarkColor, wallR, n, wallF, vertices, colors, indices);
      }

      // 1.5) Internal Corner End-Seals at t = -0.15 and t = +0.15 (0.0235 x 0.0235 hidden inside 0.024 planks so zero Z-fighting, while sealing 90-degree corners)
      if (topTrimLeft > 0.010) {
        const leftCornerBottom = [
          p[0] - wallR[0] * 0.15 - n[0] * 0.002,
          p[1] - wallR[1] * 0.15 - n[1] * 0.002,
          p[2] - wallR[2] * 0.15 - n[2] * 0.002
        ];
        const leftPostHIn = Math.max(0, getTrimHeight(-0.140, 0.246));
        const leftPostHOut = Math.max(0, Math.min(0.246, topTrimLeft));
        addCustomBox(leftCornerBottom, 0.0235, 0.0235, leftPostHOut, leftPostHIn, beamDarkColor, wallR, n, wallF, vertices, colors, indices);
      }
      if (topTrimRight > 0.010) {
        const rightCornerBottom = [
          p[0] + wallR[0] * 0.15 - n[0] * 0.002,
          p[1] + wallR[1] * 0.15 - n[1] * 0.002,
          p[2] + wallR[2] * 0.15 - n[2] * 0.002
        ];
        const rightPostHIn = Math.max(0, getTrimHeight(0.140, 0.246));
        const rightPostHOut = Math.max(0, Math.min(0.246, topTrimRight));
        addCustomBox(rightCornerBottom, 0.0235, 0.0235, rightPostHIn, rightPostHOut, beamDarkColor, wallR, n, wallF, vertices, colors, indices);
      }
    }

    // 2) Top horizontal support beam (only if wall is untrimmed at top)
    const hasTopBeam = !isWindow && (topTrimLeft >= 0.245 && topTrimRight >= 0.245 && topTrimMid >= 0.245);

    if (hasTopBeam) {
      const bHL = Math.min(0.021, Math.max(0, topTrimLeft - 0.228));
      const bHR = Math.min(0.021, Math.max(0, topTrimRight - 0.228));
      if (hasCoLocatedDoor) {
        const leftBeamBottom = [
          p[0] - wallR[0] * 0.120 + n[0] * 0.228,
          p[1] - wallR[1] * 0.120 + n[1] * 0.228,
          p[2] - wallR[2] * 0.120 + n[2] * 0.228
        ];
        addCustomBox(leftBeamBottom, 0.060, 0.028, bHL, bHL, beamDarkColor, wallR, n, wallF, vertices, colors, indices);
        const rightBeamBottom = [
          p[0] + wallR[0] * 0.120 + n[0] * 0.228,
          p[1] + wallR[1] * 0.120 + n[1] * 0.228,
          p[2] + wallR[2] * 0.120 + n[2] * 0.228
        ];
        addCustomBox(rightBeamBottom, 0.060, 0.028, bHR, bHR, beamDarkColor, wallR, n, wallF, vertices, colors, indices);
      } else {
        const beamBottom = [
          p[0] + n[0] * 0.228,
          p[1] + n[1] * 0.228,
          p[2] + n[2] * 0.228
        ];
        addCustomBox(beamBottom, 0.300, 0.028, bHL, bHR, beamDarkColor, wallR, n, wallF, vertices, colors, indices);

        // Internal recessed ceiling-joint tongue (seals top wall-ceiling seam against light leaks without Z-fighting)
        const topTongueCenter = [
          p[0] + n[0] * 0.249,
          p[1] + n[1] * 0.249,
          p[2] + n[2] * 0.249
        ];
        addBox(topTongueCenter, 0.296, 0.010, 0.018, beamDarkColor, wallR, n, wallF, vertices, colors, indices);
      }
    }

    // 3) Vertical planks (only for wood_wall, wood_window has no background planks)
    if (!isWindow) {
      const numPlanks = 5;
      const seedVal = item.seed || (p[0] * 123.4 + p[2] * 56.7);
      function pRand(s) {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
      }

      const plankBaseY = 0.022;
      const maxPlankH = (hasTopBeam ? 0.228 : 0.250) - plankBaseY;
      const plankThick = 0.024;
      const plankW = 0.060;
      const halfPlankW = 0.030;

      for (let i = 0; i < numPlanks; i++) {
        if (hasCoLocatedDoor && (i === 1 || i === 2 || i === 3)) {
          continue;
        }
        const t = -0.15 + 0.03 + i * 0.06; // horizontal offset along wallR
        const shadeNoise = pRand(seedVal + i * 17.3);
        const plankColor = item.isPreview ? previewColor : [
          rCol * (0.85 + shadeNoise * 0.3),
          gCol * (0.85 + shadeNoise * 0.3),
          bCol * (0.85 + shadeNoise * 0.3)
        ];

        const hLeft = Math.max(0, getTrimHeight(t - 0.03, 0.25));
        const hMid = Math.max(0, getTrimHeight(t, 0.25));
        const hRight = Math.max(0, getTrimHeight(t + 0.03, 0.25));

        if (hasCoLocatedWindow && (i === 1 || i === 2 || i === 3)) {
          // For co-located window middle planks: draw bottom and top parts, leaving a gap in the middle
          const bottomPlankCenter = [
            p[0] + wallR[0] * t + n[0] * 0.0485,
            p[1] + wallR[1] * t + n[1] * 0.0485,
            p[2] + wallR[2] * t + n[2] * 0.0485
          ];
          addBox(bottomPlankCenter, plankW, 0.053, plankThick, plankColor, wallR, n, wallF, vertices, colors, indices);

          if (hLeft > 0.175 || hRight > 0.175 || hMid > 0.175) {
            const topMaxH = (hasTopBeam ? 0.228 : 0.250) - 0.175;
            const topHL = Math.min(topMaxH, Math.max(0, hLeft - 0.175));
            const topHR = Math.min(topMaxH, Math.max(0, hRight - 0.175));
            const topPlankBottom = [
              p[0] + wallR[0] * t + n[0] * 0.175,
              p[1] + wallR[1] * t + n[1] * 0.175,
              p[2] + wallR[2] * t + n[2] * 0.175
            ];
            addCustomBox(topPlankBottom, plankW, plankThick, topHL, topHR, plankColor, wallR, n, wallF, vertices, colors, indices);
          }
        } else {
          // Standard solid vertical plank
          const isPeak = (hMid > Math.max(hLeft, hRight) + 0.003);
          const isValley = (hMid < Math.min(hLeft, hRight) - 0.003);

          if (isPeak || isValley) {
            // Draw as two half-width planks meeting at apex hMid
            const pHL = Math.min(maxPlankH, Math.max(0, hLeft - plankBaseY));
            const pHM = Math.min(maxPlankH, Math.max(0, hMid - plankBaseY));
            const pHR = Math.min(maxPlankH, Math.max(0, hRight - plankBaseY));

            if (pHL > 0.001 || pHM > 0.001) {
              const leftCenter = [
                p[0] + wallR[0] * (t - 0.015) + n[0] * plankBaseY,
                p[1] + wallR[1] * (t - 0.015) + n[1] * plankBaseY,
                p[2] + wallR[2] * (t - 0.015) + n[2] * plankBaseY
              ];
              addCustomBox(leftCenter, halfPlankW, plankThick, pHL, pHM, plankColor, wallR, n, wallF, vertices, colors, indices);
            }

            if (pHM > 0.001 || pHR > 0.001) {
              const rightCenter = [
                p[0] + wallR[0] * (t + 0.015) + n[0] * plankBaseY,
                p[1] + wallR[1] * (t + 0.015) + n[1] * plankBaseY,
                p[2] + wallR[2] * (t + 0.015) + n[2] * plankBaseY
              ];
              addCustomBox(rightCenter, halfPlankW, plankThick, pHM, pHR, plankColor, wallR, n, wallF, vertices, colors, indices);
            }
          } else {
            // Standard single continuous plank
            if (hLeft > plankBaseY || hRight > plankBaseY) {
              const pHL = Math.min(maxPlankH, Math.max(0, hLeft - plankBaseY));
              const pHR = Math.min(maxPlankH, Math.max(0, hRight - plankBaseY));
              const plankBottom = [
                p[0] + wallR[0] * t + n[0] * plankBaseY,
                p[1] + wallR[1] * t + n[1] * plankBaseY,
                p[2] + wallR[2] * t + n[2] * plankBaseY
              ];
              addCustomBox(plankBottom, plankW, plankThick, pHL, pHR, plankColor, wallR, n, wallF, vertices, colors, indices);
            }
          }
        }
      }
    }

    // Draw window frames and solid wood shutters if it's a window!
    if (isWindow) {
      // Frame and casing colors relative to baseColor to match the door and wall, preventing magenta/purple hue
      const frameColor = item.isPreview ? previewColor : [rCol * 0.5, gCol * 0.35, bCol * 0.3]; // darker frame (like casingColor)
      const shutterColor = item.isPreview ? previewColor : [rCol * 0.85, gCol * 0.85, bCol * 0.85]; // matches wall planks but slightly distinct
      const darkAccent = item.isPreview ? previewColor : [rCol * 0.5, gCol * 0.35, bCol * 0.3]; // decorative trim

      // Window sill (horizontal bottom frame) at vertical 0.08
      const sillCenter = [
        p[0] + n[0] * 0.08,
        p[1] + n[1] * 0.08,
        p[2] + n[2] * 0.08
      ];
      addBox(sillCenter, 0.18, 0.01, 0.02, frameColor, wallR, n, wallF, vertices, colors, indices);

      // Top window frame at vertical 0.17
      const frameTopCenter = [
        p[0] + n[0] * 0.17,
        p[1] + n[1] * 0.17,
        p[2] + n[2] * 0.17
      ];
      addBox(frameTopCenter, 0.18, 0.01, 0.02, frameColor, wallR, n, wallF, vertices, colors, indices);

      // Left window frame at t = -0.09
      const frameLeftCenter = [
        p[0] - wallR[0] * 0.09 + n[0] * 0.125,
        p[1] - wallR[1] * 0.09 + n[1] * 0.125,
        p[2] - wallR[2] * 0.09 + n[2] * 0.125
      ];
      addBox(frameLeftCenter, 0.01, 0.08, 0.02, frameColor, wallR, n, wallF, vertices, colors, indices);

      // Right window frame at t = 0.09
      const frameRightCenter = [
        p[0] + wallR[0] * 0.09 + n[0] * 0.125,
        p[1] + wallR[1] * 0.09 + n[1] * 0.125,
        p[2] + wallR[2] * 0.09 + n[2] * 0.125
      ];
      addBox(frameRightCenter, 0.01, 0.08, 0.02, frameColor, wallR, n, wallF, vertices, colors, indices);

      // --- TWO SWINGING SOLID WOOD SHUTTERS ---
      const A = item.windowAngle || 0.0;

      // 1) Left Shutter: hinged at t = -0.085
      const t_left_rot = -0.085 + 0.0425 * Math.cos(A);
      const f_left_rot = 0.0 + 0.0425 * Math.sin(A);
      const leftShutterCenter = [
        p[0] + wallR[0] * t_left_rot + n[0] * 0.125 + wallF[0] * f_left_rot,
        p[1] + wallR[1] * t_left_rot + n[1] * 0.125 + wallF[1] * f_left_rot,
        p[2] + wallR[2] * t_left_rot + n[2] * 0.125 + wallF[2] * f_left_rot
      ];
      const R_left = [
        wallR[0] * Math.cos(A) + wallF[0] * Math.sin(A),
        wallR[1] * Math.cos(A) + wallF[1] * Math.sin(A),
        wallR[2] * Math.cos(A) + wallF[2] * Math.sin(A)
      ];
      const F_left = [
        wallF[0] * Math.cos(A) - wallR[0] * Math.sin(A),
        wallF[1] * Math.cos(A) - wallR[1] * Math.sin(A),
        wallF[2] * Math.cos(A) - wallR[2] * Math.sin(A)
      ];
      addBox(leftShutterCenter, 0.087, 0.082, 0.014, shutterColor, R_left, n, F_left, vertices, colors, indices);
      addBox(leftShutterCenter, 0.065, 0.060, 0.016, darkAccent, R_left, n, F_left, vertices, colors, indices);

      // 2) Right Shutter: hinged at t = 0.085
      const t_right_rot = 0.085 - 0.0425 * Math.cos(A);
      const f_right_rot = 0.0 + 0.0425 * Math.sin(A);
      const rightShutterCenter = [
        p[0] + wallR[0] * t_right_rot + n[0] * 0.125 + wallF[0] * f_right_rot,
        p[1] + wallR[1] * t_right_rot + n[1] * 0.125 + wallF[1] * f_right_rot,
        p[2] + wallR[2] * t_right_rot + n[2] * 0.125 + wallF[2] * f_right_rot
      ];
      const R_right = [
        wallR[0] * Math.cos(A) - wallF[0] * Math.sin(A),
        wallR[1] * Math.cos(A) - wallF[1] * Math.sin(A),
        wallR[2] * Math.cos(A) - wallF[2] * Math.sin(A)
      ];
      const F_right = [
        wallF[0] * Math.cos(A) + wallR[0] * Math.sin(A),
        wallF[1] * Math.cos(A) + wallR[1] * Math.sin(A),
        wallF[2] * Math.cos(A) + wallR[2] * Math.sin(A)
      ];
      addBox(rightShutterCenter, 0.087, 0.082, 0.014, shutterColor, R_right, n, F_right, vertices, colors, indices);
      addBox(rightShutterCenter, 0.065, 0.060, 0.016, darkAccent, R_right, n, F_right, vertices, colors, indices);

      // Draw tiny brass handles (only if not a preview)
      if (!item.isPreview) {
        const handleColor = [0.85, 0.75, 0.25]; // Gold brass handles

        const t_lh_rot = -0.085 + 0.075 * Math.cos(A);
        const f_lh_rot = 0.0 + 0.075 * Math.sin(A);
        const leftHandleCenter = [
          p[0] + wallR[0] * t_lh_rot + n[0] * 0.125 + wallF[0] * f_lh_rot + F_left[0] * 0.012,
          p[1] + wallR[1] * t_lh_rot + n[1] * 0.125 + wallF[1] * f_lh_rot + F_left[1] * 0.012,
          p[2] + wallR[2] * t_lh_rot + n[2] * 0.125 + wallF[2] * f_lh_rot + F_left[2] * 0.012
        ];
        addBox(leftHandleCenter, 0.006, 0.015, 0.008, handleColor, R_left, n, F_left, vertices, colors, indices);

        const t_rh_rot = 0.085 - 0.075 * Math.cos(A);
        const f_rh_rot = 0.0 + 0.075 * Math.sin(A);
        const rightHandleCenter = [
          p[0] + wallR[0] * t_rh_rot + n[0] * 0.125 + wallF[0] * f_rh_rot + F_right[0] * 0.012,
          p[1] + wallR[1] * t_rh_rot + n[1] * 0.125 + wallF[1] * f_rh_rot + F_right[1] * 0.012,
          p[2] + wallR[2] * t_rh_rot + n[2] * 0.125 + wallF[2] * f_rh_rot + F_right[2] * 0.012
        ];
        addBox(rightHandleCenter, 0.006, 0.015, 0.008, handleColor, R_right, n, F_right, vertices, colors, indices);
      }
    }
  }
};

window.ItemRegistry["wood_window"] = window.ItemRegistry["wood_wall"];
