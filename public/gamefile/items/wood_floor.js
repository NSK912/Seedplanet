// === SEEDPLANET MODULE: JS/ITEMS/WOOD_FLOOR.JS ===

window.getFloorThickness = function(item) {
  const size = (item && item.size) || 0.25;
  const wfH = (typeof woodFloorHeight === "number") ? woodFloorHeight : ((typeof window !== "undefined" && typeof window.woodFloorHeight === "number") ? window.woodFloorHeight : 0.05);
  if (!item || item.type === "wood_floor") {
    return wfH + size * 0.12;
  } else if (item.type === "stone_floor") {
    return size * 0.15;
  } else if (item.type === "thin_wood_floor") {
    return size * 0.04;
  }
  return size * 0.08;
};

window.ItemRegistry["wood_floor"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const r = item.R,
      f = item.F,
      n = item.normal;
        
    // "พื้นไม้" - A flat square platform/floor panel
    const w = item.width !== undefined ? item.width : item.size * 1.2; 
    const h = window.getFloorThickness(item); 
    const d = item.depth !== undefined ? item.depth : item.size * 1.2;
        
    if (item.isPreview) {
      const isValid = item.isValidPlacement !== false;
      const col = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
      addBox(p, w, h, d, col, r, n, f, vertices, colors, indices);
    } else {
      const isThin = (item.type === "thin_wood_floor");
      let effW = w;
      let effD = d;
      let effH = h;
      let baseP = p;

      if (isThin) {
        let hasLeftN = false, hasRightN = false, hasBackN = false, hasFrontN = false;
        const allCollectibles = (typeof window !== "undefined" && window.collectibles) ? window.collectibles : [];
        const colLen = allCollectibles.length;
        if (item._extCache && item._extColLen === colLen) {
          hasLeftN = item._extCache[0];
          hasRightN = item._extCache[1];
          hasBackN = item._extCache[2];
          hasFrontN = item._extCache[3];
        } else {
          for (let k = 0; k < colLen; k++) {
            const other = allCollectibles[k];
            if (!other || !other.active || other === item || other.isPreview) continue;
            if (other.type !== "thin_wood_floor" && other.type !== "wood_floor") continue;
            const oP = other.position;
            if (!oP) continue;
            const dx = oP[0] - p[0], dy = oP[1] - p[1], dz = oP[2] - p[2];
            if (dx * dx + dy * dy + dz * dz > 0.20) continue;
            const dN = dx * n[0] + dy * n[1] + dz * n[2];
            if (Math.abs(dN) > 0.05) continue;
            const dR = dx * r[0] + dy * r[1] + dz * r[2];
            const dF = dx * f[0] + dy * f[1] + dz * f[2];
            if (Math.abs(dF) < 0.08) {
              if (dR > -0.36 && dR < -0.24) hasLeftN = true;
              else if (dR > 0.24 && dR < 0.36) hasRightN = true;
            }
            if (Math.abs(dR) < 0.08) {
              if (dF > -0.36 && dF < -0.24) hasBackN = true;
              else if (dF > 0.24 && dF < 0.36) hasFrontN = true;
            }
          }
          item._extCache = [hasLeftN, hasRightN, hasBackN, hasFrontN];
          item._extColLen = colLen;
        }
        const extL = hasLeftN ? 0.0 : 0.016;
        const extR = hasRightN ? 0.0 : 0.016;
        const extB = hasBackN ? 0.0 : 0.016;
        const extF = hasFrontN ? 0.0 : 0.016;
        effW = w + extL + extR;
        effD = d + extB + extF;
        effH = Math.max(h, 0.018);
        const offR = (extR - extL) * 0.5;
        const offF = (extF - extB) * 0.5;
        const offN = (effH - h) * 0.5;
        baseP = [
          p[0] + r[0] * offR + f[0] * offF + n[0] * offN,
          p[1] + r[1] * offR + f[1] * offF + n[1] * offN,
          p[2] + r[2] * offR + f[2] * offF + n[2] * offN
        ];
      }

      // Placed wood floor - render individual planks with wood grain shades
      const numPlanks = Math.max(1, Math.round((w / (item.size * 1.2)) * 4));
      const pw = effW / numPlanks;
      const plankW = pw;
      const plankD = effD;
            
      // Seed-based stable pseudo-random generator
      const seedVal = item.seed || (item.position[0] * 123.4 + item.position[2] * 56.7);
      function pRand(s) {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
      }
            
      const baseColor = item.color || [0.65, 0.45, 0.25];

      // Internal recessed sub-floor core (seals plank seams against light leaks without touching outer surfaces)
      const coreH = Math.max(0.008, effH * 0.65);
      const coreCenter = [
        baseP[0] - n[0] * (effH * 0.1),
        baseP[1] - n[1] * (effH * 0.1),
        baseP[2] - n[2] * (effH * 0.1)
      ];
      const coreColor = [baseColor[0] * 0.7, baseColor[1] * 0.7, baseColor[2] * 0.7];
      addBox(coreCenter, Math.max(0.01, effW - 0.004), coreH, Math.max(0.01, effD - 0.004), coreColor, r, n, f, vertices, colors, indices);
            
      for (let i = 0; i < numPlanks; i++) {
        const t = -effW / 2 + pw / 2 + i * pw;
        const plankCenter = [
          baseP[0] + r[0] * t,
          baseP[1] + r[1] * t,
          baseP[2] + r[2] * t
        ];
                
        const shadeNoise = pRand(seedVal + i * 17.3);
        // Vary base wooden color slightly to give authentic plank variation
        const rCol = baseColor[0] * (0.85 + shadeNoise * 0.3);
        const gCol = baseColor[1] * (0.85 + shadeNoise * 0.3);
        const bCol = baseColor[2] * (0.85 + shadeNoise * 0.3);
        const plankColor = [rCol, gCol, bCol];
                
        // Draw individual plank board (exact non-overlapping width & depth prevents Z-fighting shimmer)
        addBox(plankCenter, plankW, effH, plankD, plankColor, r, n, f, vertices, colors, indices);
                
        // Add dark wood grain lines on top of the plank
        const numGrainLines = 2;
        for (let j = 0; j < numGrainLines; j++) {
          const grainNoiseX = pRand(seedVal + i * 31.4 + j * 45.1);
          const grainNoiseL = pRand(seedVal + i * 19.8 + j * 73.2);
          const grainW = 0.005; 
          const grainH = 0.0024; 
          const grainD = effD * (0.3 + grainNoiseL * 0.6); 
                    
          const grainT = (grainNoiseX - 0.5) * (plankW * 0.65);
          const grainOffsetF = (pRand(seedVal + j * 91.3) - 0.5) * (effD - grainD);
                    
          const grainCenter = [
            plankCenter[0] + r[0] * grainT + f[0] * grainOffsetF + n[0] * (effH * 0.5 + 0.0012),
            plankCenter[1] + r[1] * grainT + f[1] * grainOffsetF + n[1] * (effH * 0.5 + 0.0012),
            plankCenter[2] + r[2] * grainT + f[2] * grainOffsetF + n[2] * (effH * 0.5 + 0.0012)
          ];
                    
          // Dark brown color for the grain lines
          const grainColor = [rCol * 0.65, gCol * 0.65, bCol * 0.65];
          addBox(grainCenter, grainW, grainH, grainD, grainColor, r, n, f, vertices, colors, indices);
        }
      }
    }
  }
};

window.ItemRegistry["plank"] = window.ItemRegistry["wood_floor"];
window.ItemRegistry["thin_wood_floor"] = window.ItemRegistry["wood_floor"];
