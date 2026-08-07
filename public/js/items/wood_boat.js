// === SEEDPLANET MODULE: JS/ITEMS/WOOD_BOAT.JS ===

window.ItemRegistry["wood_boat"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const isPreview = item.isPreview;
    const isValid = item.isValidPlacement !== false;
    const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    
    let n = item.normal || [0, 1, 0];
    let r = item.R || [1, 0, 0];
    let f = item.F || [0, 0, 1];
    
    if (item.angle !== undefined) {
      const cosH = Math.cos(item.angle);
      const sinH = Math.sin(item.angle);
      let pnx = n[0], pny = n[1], pnz = n[2];
      let pEast = [-pnz, 0, pnx];
      let lenE = Math.sqrt(pEast[0]*pEast[0] + pEast[2]*pEast[2]);
      if (lenE < 0.001) pEast = [1, 0, 0];
      else { pEast[0]/=lenE; pEast[2]/=lenE; }
      let pNorth = [
         pEast[1] * pnz - pEast[2] * pny,
         pEast[2] * pnx - pEast[0] * pnz,
         pEast[0] * pny - pEast[1] * pnx
      ];
      let lenN = Math.sqrt(pNorth[0]*pNorth[0] + pNorth[1]*pNorth[1] + pNorth[2]*pNorth[2]);
      if (lenN < 0.001) pNorth = [0, 0, 1];
      else { pNorth[0]/=lenN; pNorth[1]/=lenN; pNorth[2]/=lenN; }
      r = [pEast[0] * cosH - pNorth[0] * sinH, pEast[1] * cosH - pNorth[1] * sinH, pEast[2] * cosH - pNorth[2] * sinH];
      f = [pNorth[0] * cosH + pEast[0] * sinH, pNorth[1] * cosH + pEast[1] * sinH, pNorth[2] * cosH + pEast[2] * sinH];
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
    
    if (!isPreview && typeof boatRowTimer !== "undefined" && typeof activeRidingBoat !== "undefined" && activeRidingBoat === item) {
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
  }
};
