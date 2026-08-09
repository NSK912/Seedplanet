// === SEEDPLANET MODULE: JS/ITEMS/WOOD_BOAT.JS ===

window.ItemRegistry["wood_boat"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const isPreview = item.isPreview;
    const isValid = item.isValidPlacement !== false;
    const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    
    let n = item.normal || [0, 1, 0];
    let baseR = item.R || [1, 0, 0];
    let baseF = item.F || [0, 0, 1];

    let r = baseR;
    let f = baseF;

    if (item.angle !== undefined && item.angle !== 0) {
      const cosH = Math.cos(item.angle);
      const sinH = Math.sin(item.angle);
      r = [baseR[0] * cosH - baseF[0] * sinH, baseR[1] * cosH - baseF[1] * sinH, baseR[2] * cosH - baseF[2] * sinH];
      f = [baseF[0] * cosH + baseR[0] * sinH, baseF[1] * cosH + baseR[1] * sinH, baseF[2] * cosH + baseR[2] * sinH];
    }

    const rawHull = getOrCreateRawBoatHull();
    const baseIdx = vertices.length / 3;
    
    const px = p[0], py = p[1], pz = p[2];
    const rx0 = r[0], rx1 = r[1], rx2 = r[2];
    const ny0 = n[0], ny1 = n[1], ny2 = n[2];
    const fz0 = f[0], fz1 = f[1], fz2 = f[2];
    
    const hullVerts = rawHull.vertices;
    const hullColors = rawHull.colors;
    const hullIndices = rawHull.indices;
    
    for (let i = 0; i < hullVerts.length; i += 3) {
      const lx = hullVerts[i];
      const ly = hullVerts[i+1];
      const lz = hullVerts[i+2];
      
      vertices.push(
        px + rx0 * lx + ny0 * ly + fz0 * lz,
        py + rx1 * lx + ny1 * ly + fz1 * lz,
        pz + rx2 * lx + ny2 * ly + fz2 * lz
      );
      
      if (isPreview) {
        colors.push(previewColor[0], previewColor[1], previewColor[2]);
      } else {
        colors.push(hullColors[i], hullColors[i+1], hullColors[i+2]);
      }
    }
    
    for (let i = 0; i < hullIndices.length; i++) {
      indices.push(baseIdx + hullIndices[i]);
    }
    
    const bs = 0.4;
    const h = 0.2*bs;
    const t = 0.04*bs;
    
    if (!isPreview && typeof boatRowTimer !== "undefined" && typeof activeRidingBoat !== "undefined" && activeRidingBoat === item && !(item.hasWheel || item.hasWheels || (item.wheelCount && item.wheelCount > 0))) {
      const oarCol = [0.65, 0.5, 0.35];
      const oarAngle = Math.sin(boatRowTimer) * 0.5;
      const r_oarL = [r[0]*Math.cos(oarAngle) - f[0]*Math.sin(oarAngle), r[1]*Math.cos(oarAngle) - f[1]*Math.sin(oarAngle), r[2]*Math.cos(oarAngle) - f[2]*Math.sin(oarAngle)];
      const f_oarL = [r[0]*Math.sin(oarAngle) + f[0]*Math.cos(oarAngle), r[1]*Math.sin(oarAngle) + f[1]*Math.cos(oarAngle), r[2]*Math.sin(oarAngle) + f[2]*Math.cos(oarAngle)];
      
      const slant = 0.28;
      const cosS = Math.cos(slant), sinS = Math.sin(slant);
      const r_oarL_rotated = [
        r_oarL[0]*cosS + n[0]*sinS,
        r_oarL[1]*cosS + n[1]*sinS,
        r_oarL[2]*cosS + n[2]*sinS
      ];
      const n_oarL_rotated = [
        n[0]*cosS - r_oarL[0]*sinS,
        n[1]*cosS - r_oarL[1]*sinS,
        n[2]*cosS - r_oarL[2]*sinS
      ];
      const pivotL = [
        p[0] - r[0]*(0.33*bs) + n[0]*(h*0.95),
        p[1] - r[1]*(0.33*bs) + n[1]*(h*0.95),
        p[2] - r[2]*(0.33*bs) + n[2]*(h*0.95)
      ];
      
      const L_oar = 0.88 * bs;
      const L_in = 0.16 * bs;
      const L_out = 0.72 * bs;
      const shiftL = (L_out - L_in) / 2;
      
      const centerL = [
        pivotL[0] - r_oarL_rotated[0]*shiftL,
        pivotL[1] - r_oarL_rotated[1]*shiftL,
        pivotL[2] - r_oarL_rotated[2]*shiftL
      ];
      addBox(centerL, L_oar, t/2, t, oarCol, r_oarL_rotated, n_oarL_rotated, f_oarL, vertices, colors, indices);
      
      const r_oarR = [r[0]*Math.cos(-oarAngle) - f[0]*Math.sin(-oarAngle), r[1]*Math.cos(-oarAngle) - f[1]*Math.sin(-oarAngle), r[2]*Math.cos(-oarAngle) - f[2]*Math.sin(-oarAngle)];
      const f_oarR = [r[0]*Math.sin(-oarAngle) + f[0]*Math.cos(-oarAngle), r[1]*Math.sin(-oarAngle) + f[1]*Math.cos(-oarAngle), r[2]*Math.sin(-oarAngle) + f[2]*Math.cos(-oarAngle)];
      
      const r_oarR_rotated = [
        r_oarR[0]*cosS - n[0]*sinS,
        r_oarR[1]*cosS - n[1]*sinS,
        r_oarR[2]*cosS - n[2]*sinS
      ];
      const n_oarR_rotated = [
        n[0]*cosS + r_oarR[0]*sinS,
        n[1]*cosS + r_oarR[1]*sinS,
        n[2]*cosS + r_oarR[2]*sinS
      ];
      
      const pivotR = [
        p[0] + r[0]*(0.33*bs) + n[0]*(h*0.95),
        p[1] + r[1]*(0.33*bs) + n[1]*(h*0.95),
        p[2] + r[2]*(0.33*bs) + n[2]*(h*0.95)
      ];
      const shiftR = (L_out - L_in) / 2;
      
      const centerR = [
        pivotR[0] + r_oarR_rotated[0]*shiftR,
        pivotR[1] + r_oarR_rotated[1]*shiftR,
        pivotR[2] + r_oarR_rotated[2]*shiftR
      ];
      addBox(centerR, L_oar, t/2, t, oarCol, r_oarR_rotated, n_oarR_rotated, f_oarR, vertices, colors, indices);
    }

    if (!isPreview && (item.hasWheel || item.hasWheels || (item.wheelCount && item.wheelCount > 0))) {
      const wheelRadius = 0.16;
      const wheelThick = 0.04;
      const wheelCol = [0.55, 0.38, 0.22];
      const darkWood = [0.4, 0.26, 0.14];
      const metalCol = [0.3, 0.3, 0.3];

      let spinAngle = item.spinAngle || 0;
      let steerAngle = item.steerAngle || 0;
      if (!item.spinAngle && typeof boatRowTimer !== "undefined" && typeof activeRidingBoat !== "undefined" && activeRidingBoat === item) {
        spinAngle = boatRowTimer * 0.1;
      }

      const fAxleLen = typeof window.wheelFrontAxleLength === "number" ? window.wheelFrontAxleLength : 0.36;
      const fSideOff = typeof window.wheelFrontSideOffset === "number" ? window.wheelFrontSideOffset : 0.18;
      const fFwdOff  = typeof window.wheelFrontFwdOffset  === "number" ? window.wheelFrontFwdOffset  : 0.18;
      const fUpOff   = typeof window.wheelFrontUpOffset   === "number" ? window.wheelFrontUpOffset   : -0.03;

      const rAxleLen = typeof window.wheelRearAxleLength === "number" ? window.wheelRearAxleLength : 0.36;
      const rSideOff = typeof window.wheelRearSideOffset === "number" ? window.wheelRearSideOffset : 0.18;
      const rFwdOff  = typeof window.wheelRearFwdOffset  === "number" ? window.wheelRearFwdOffset  : 0.18;
      const rUpOff   = typeof window.wheelRearUpOffset   === "number" ? window.wheelRearUpOffset   : -0.03;

      // Draw front cross axle bar
      const fAxleCenter = [
        px + ny0 * fUpOff + fz0 * fFwdOff,
        py + ny1 * fUpOff + fz1 * fFwdOff,
        pz + ny2 * fUpOff + fz2 * fFwdOff
      ];
      addBox(fAxleCenter, fAxleLen, 0.03, 0.03, metalCol, r, n, f, vertices, colors, indices);

      // Draw rear cross axle bar
      const rAxleCenter = [
        px + ny0 * rUpOff + fz0 * (-rFwdOff),
        py + ny1 * rUpOff + fz1 * (-rFwdOff),
        pz + ny2 * rUpOff + fz2 * (-rFwdOff)
      ];
      addBox(rAxleCenter, rAxleLen, 0.03, 0.03, metalCol, r, n, f, vertices, colors, indices);

      const wheelOffsets = [
        { side: -1, forward: fFwdOff,  sideOff: fSideOff, upOff: fUpOff, isFront: true },
        { side: 1,  forward: fFwdOff,  sideOff: fSideOff, upOff: fUpOff, isFront: true },
        { side: -1, forward: -rFwdOff, sideOff: rSideOff, upOff: rUpOff, isFront: false },
        { side: 1,  forward: -rFwdOff, sideOff: rSideOff, upOff: rUpOff, isFront: false }
      ];

      for (let wo of wheelOffsets) {
        const sideOffset = wo.side * wo.sideOff;
        const fwdOffset = wo.forward;
        const upOffset = wo.upOff;

        const wCenter = [
          px + rx0 * sideOffset + ny0 * upOffset + fz0 * fwdOffset,
          py + rx1 * sideOffset + ny1 * upOffset + fz1 * fwdOffset,
          pz + rx2 * sideOffset + ny2 * upOffset + fz2 * fwdOffset
        ];

        if (typeof window.drawDetailedWoodenWheel === "function") {
          window.drawDetailedWoodenWheel(
            wCenter, wheelRadius, wheelThick,
            r, n, f, spinAngle,
            wheelCol, darkWood, metalCol,
            vertices, colors, indices,
            isPreview, previewColor,
            wo.isFront ? steerAngle : 0
          );
        }
      }
    }
  }
};
