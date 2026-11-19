// === SEEDPLANET MODULE: JS/ITEMS/BOAT_WING.JS ===
// Vintage Biplane Wings Component for Wooden Boat (ปีกประกอบเรือไม้สไตล์เครื่องบินปีกสองชั้นโบราณ)

(function() {
  function drawBoxFallback(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices) {
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;
    
    let r = right || [1, 0, 0], u = up || [0, 1, 0], f = forward || [0, 0, 1];
    let isFlipped = false;
    if (r && u && f) {
      const det = (r[1]*u[2] - r[2]*u[1])*f[0] + (r[2]*u[0] - r[0]*u[2])*f[1] + (r[0]*u[1] - r[1]*u[0])*f[2];
      if (det < 0) {
        isFlipped = true;
      }
    }

    const cubeVerts = [
      [-hw, -hh, -hd],
      [hw, -hh, -hd],
      [hw, -hh, hd],
      [-hw, -hh, hd],
      [-hw, hh, -hd],
      [hw, hh, -hd],
      [hw, hh, hd],
      [-hw, hh, hd],
    ];
    
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
    
    const baseIdx = outVertices.length / 3;
    
    for (let i = 0; i < 8; i++) {
       const v = cubeVerts[i];
       const rx = r[0]*v[0] + u[0]*v[1] + f[0]*v[2];
       const ry = r[1]*v[0] + u[1]*v[1] + f[1]*v[2];
       const rz = r[2]*v[0] + u[2]*v[1] + f[2]*v[2];
       
       outVertices.push(center[0]+rx, center[1]+ry, center[2]+rz);
       outColors.push(color[0], color[1], color[2]);
    }
    
    for (let i = 0; i < cubeIndices.length; i++) {
        outIndices.push(baseIdx + cubeIndices[i]);
    }
  }

  function addBox(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices) {
    if (typeof window !== "undefined" && typeof window.addBox === "function" && window.addBox !== addBox) {
      window.addBox(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices);
    } else {
      drawBoxFallback(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices);
    }
  }

  // Ensure window.addBox is available if not already defined
  if (typeof window !== "undefined" && typeof window.addBox !== "function") {
    window.addBox = drawBoxFallback;
  }

  window.ItemRegistry = window.ItemRegistry || {};

const _wingTemplateCache = new Map();
const MAX_WING_TEMPLATES = 16;

function getOrCreateRawBoatWingsTemplate(span, cWidth) {
  const key = Math.round(span * 10000) + "_" + Math.round(cWidth * 10000);
  let cached = _wingTemplateCache.get(key);
  if (cached) return cached;

  const tempVerts = [];
  const tempColors = [];
  const tempIndices = [];
  const tempSlots = []; // 0: cCanvas, 1: cRib, 2: cSpar, 3: cStrut, 4: cWire, 5: cMount
  const dummyCol = [1, 1, 1];
  const lr = [1, 0, 0];
  const ln = [0, 1, 0];
  const lf = [0, 0, 1];

  const pushBox = (c, w, h, d, slot, br, bn, bf) => {
    const startV = tempVerts.length / 3;
    addBox(c, w, h, d, dummyCol, br, bn, bf, tempVerts, tempColors, tempIndices);
    const endV = tempVerts.length / 3;
    for (let v = startV; v < endV; v++) tempSlots.push(slot);
  };

  const wingThick = 0.012;

  // 1. Base Mounting Beams across boat gunwales
  const mountBeamLen = 0.44;
  const mountBeamW = 0.035;
  const mountBeamH = 0.025;
  pushBox([0, 0.045, 0.14], mountBeamLen, mountBeamH, mountBeamW, 5, lr, ln, lf);
  pushBox([0, 0.045, -0.14], mountBeamLen, mountBeamH, mountBeamW, 5, lr, ln, lf);

  // 2. Lower Stub Wings
  const lowerSpan = 0.34;
  const lowerChord = 0.32;
  const lowerUp = 0.06;
  const leftX = -(0.22 + lowerSpan * 0.5);
  const rightX = 0.22 + lowerSpan * 0.5;

  pushBox([leftX, lowerUp, 0], lowerSpan, wingThick, lowerChord, 0, lr, ln, lf);
  pushBox([leftX, lowerUp, lowerChord * 0.48], lowerSpan, wingThick * 1.6, 0.02, 2, lr, ln, lf);
  pushBox([leftX, lowerUp, -lowerChord * 0.48], lowerSpan, wingThick * 1.3, 0.015, 1, lr, ln, lf);

  pushBox([rightX, lowerUp, 0], lowerSpan, wingThick, lowerChord, 0, lr, ln, lf);
  pushBox([rightX, lowerUp, lowerChord * 0.48], lowerSpan, wingThick * 1.6, 0.02, 2, lr, ln, lf);
  pushBox([rightX, lowerUp, -lowerChord * 0.48], lowerSpan, wingThick * 1.3, 0.015, 1, lr, ln, lf);

  // 3. Upper Main Biplane Wing
  const upperUp = 0.25;
  const numPanels = 10;
  const halfSpan = span * 0.5;
  const panelW = span / numPanels;

  for (let i = 0; i < numPanels; i++) {
    const x0 = -halfSpan + i * panelW;
    const xMid = x0 + panelW * 0.5;
    const normX = Math.abs(xMid) / halfSpan;
    const panelY = upperUp + Math.pow(normX, 2.2) * 0.065;

    const camberAngle = (xMid >= 0 ? 1 : -1) * (normX * 0.10);
    const cosC = Math.cos(camberAngle);
    const sinC = Math.sin(camberAngle);
    const rCamber = [cosC, sinC, 0];
    const nCamber = [-sinC, cosC, 0];

    pushBox([xMid, panelY, 0], panelW * 0.99, wingThick, cWidth, 0, rCamber, nCamber, lf);
    pushBox([xMid, panelY, cWidth * 0.49], panelW * 1.01, wingThick * 1.8, 0.022, 2, rCamber, nCamber, lf);
    pushBox([xMid, panelY, -cWidth * 0.49], panelW * 1.01, wingThick * 1.4, 0.016, 1, rCamber, nCamber, lf);
    pushBox([x0, panelY, 0], 0.012, wingThick * 1.6, cWidth * 0.98, 1, rCamber, nCamber, lf);
  }
  pushBox([halfSpan, upperUp + 0.065, 0], 0.014, wingThick * 1.6, cWidth * 0.98, 1, lr, ln, lf);

  // 4. Biplane Truss Struts
  const strutThick = 0.014;
  const strutXPositions = [-0.46, -0.19, 0.19, 0.46];
  const strutZPositions = [-0.13, 0.13];

  for (let si = 0; si < strutXPositions.length; si++) {
    const sx = strutXPositions[si];
    const normX = Math.abs(sx) / halfSpan;
    const topY = upperUp + Math.pow(normX, 2.2) * 0.065;
    const botY = (Math.abs(sx) > 0.3) ? lowerUp : 0.045;
    const strutH = topY - botY;
    const midY = (topY + botY) * 0.5;

    for (let zi = 0; zi < strutZPositions.length; zi++) {
      pushBox([sx, midY, strutZPositions[zi]], strutThick, strutH, strutThick, 3, lr, ln, lf);
    }
    pushBox([sx, midY, 0], 0.006, strutH * 0.85, 0.006, 4, lr, ln, lf);
  }

  // Diagonal Bay Cross-Wires
  const bayPairs = [
    { x1: -0.46, x2: -0.19 },
    { x1: 0.19, x2: 0.46 }
  ];
  const wireMidY = (upperUp + lowerUp) * 0.5;
  for (let bi = 0; bi < bayPairs.length; bi++) {
    const bay = bayPairs[bi];
    const midX = (bay.x1 + bay.x2) * 0.5;
    const wireLen = Math.abs(bay.x2 - bay.x1) * 0.95;
    for (let zi = 0; zi < strutZPositions.length; zi++) {
      pushBox([midX, wireMidY, strutZPositions[zi]], wireLen, 0.006, 0.006, 4, lr, ln, lf);
    }
  }

  const tpl = {
    verts: new Float32Array(tempVerts),
    slots: new Uint8Array(tempSlots),
    indices: new Uint16Array(tempIndices),
    vertCount: tempVerts.length / 3
  };

  if (_wingTemplateCache.size >= MAX_WING_TEMPLATES) {
    const firstKey = _wingTemplateCache.keys().next().value;
    _wingTemplateCache.delete(firstKey);
  }
  _wingTemplateCache.set(key, tpl);
  return tpl;
}

window.drawBoatWings = function(
  center,
  wingSpan,
  chord,
  R,
  N,
  F,
  colors_obj,
  vertices,
  colors,
  indices,
  isPreview,
  previewColor,
  bankAngle
) {
  const cCanvas = isPreview ? previewColor : (colors_obj?.canvas || [0.86, 0.80, 0.68]);
  const cRib = isPreview ? previewColor : (colors_obj?.rib || [0.48, 0.32, 0.18]);
  const cSpar = isPreview ? previewColor : (colors_obj?.spar || [0.55, 0.38, 0.22]);
  const cStrut = isPreview ? previewColor : (colors_obj?.strut || [0.42, 0.30, 0.16]);
  const cWire = isPreview ? previewColor : (colors_obj?.wire || [0.32, 0.32, 0.35]);
  const cMount = isPreview ? previewColor : (colors_obj?.mount || [0.50, 0.35, 0.20]);

  let r0 = R[0], r1 = R[1], r2 = R[2];
  let n0 = N[0], n1 = N[1], n2 = N[2];
  const f0 = F[0], f1 = F[1], f2 = F[2];

  if (bankAngle && Math.abs(bankAngle) > 0.001) {
    const cosB = Math.cos(bankAngle);
    const sinB = Math.sin(bankAngle);
    const br0 = r0 * cosB - n0 * sinB;
    const br1 = r1 * cosB - n1 * sinB;
    const br2 = r2 * cosB - n2 * sinB;
    const bn0 = n0 * cosB + r0 * sinB;
    const bn1 = n1 * cosB + r1 * sinB;
    const bn2 = n2 * cosB + r2 * sinB;
    r0 = br0; r1 = br1; r2 = br2;
    n0 = bn0; n1 = bn1; n2 = bn2;
  }

  const tpl = getOrCreateRawBoatWingsTemplate(wingSpan || 1.55, chord || 0.40);
  const tVerts = tpl.verts;
  const tSlots = tpl.slots;
  const tIndices = tpl.indices;
  const vCount = tpl.vertCount;
  const cx = center[0], cy = center[1], cz = center[2];
  const baseIdx = vertices.length / 3;
  const palette = [cCanvas, cRib, cSpar, cStrut, cWire, cMount];

  for (let i = 0; i < vCount; i++) {
    const i3 = i * 3;
    const lx = tVerts[i3];
    const ly = tVerts[i3 + 1];
    const lz = tVerts[i3 + 2];

    vertices.push(
      cx + r0 * lx + n0 * ly + f0 * lz,
      cy + r1 * lx + n1 * ly + f1 * lz,
      cz + r2 * lx + n2 * ly + f2 * lz
    );

    const col = palette[tSlots[i]];
    colors.push(col[0], col[1], col[2]);
  }

  const det = (r1 * n2 - r2 * n1) * f0 + (r2 * n0 - r0 * n2) * f1 + (r0 * n1 - r1 * n0) * f2;
  const idxLen = tIndices.length;
  if (det < 0) {
    for (let i = 0; i < idxLen; i += 3) {
      indices.push(baseIdx + tIndices[i], baseIdx + tIndices[i + 2], baseIdx + tIndices[i + 1]);
    }
  } else {
    for (let i = 0; i < idxLen; i++) {
      indices.push(baseIdx + tIndices[i]);
    }
  }
};

window.ItemRegistry["boat_wing"] = {
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

    if (isPreview && item.isBoatSnapped) {
      // Snapped to boat: render full biplane wings mounted directly onto the boat
      const wingCenter = [
        p[0] + n[0] * 0.06,
        p[1] + n[1] * 0.06,
        p[2] + n[2] * 0.06
      ];
      window.drawBoatWings(
        wingCenter,
        1.55,
        0.40,
        r, n, f,
        null,
        vertices, colors, indices,
        true,
        previewColor,
        0
      );
      return;
    }

    // World Item / Hand / Ground Render: neat compact folded wings assembly
    const scale = item.size || 0.25;
    const cCanvas = isPreview ? previewColor : [0.86, 0.80, 0.68];
    const cWood = isPreview ? previewColor : [0.52, 0.36, 0.20];
    const cMetal = isPreview ? previewColor : [0.35, 0.35, 0.38];

    const center = [
      p[0] + n[0] * (scale * 0.3),
      p[1] + n[1] * (scale * 0.3),
      p[2] + n[2] * (scale * 0.3)
    ];

    // Folded wing spars bundle
    addBox(center, scale * 1.6, scale * 0.12, scale * 0.28, cCanvas, r, n, f, vertices, colors, indices);
    addBox([center[0] + n[0] * (scale * 0.1), center[1] + n[1] * (scale * 0.1), center[2] + n[2] * (scale * 0.1)], scale * 1.62, scale * 0.04, 0.03, cWood, r, n, f, vertices, colors, indices);
    addBox([center[0] - n[0] * (scale * 0.1), center[1] - n[1] * (scale * 0.1), center[2] - n[2] * (scale * 0.1)], scale * 1.62, scale * 0.04, 0.03, cWood, r, n, f, vertices, colors, indices);
    // Support struts tied in package
    addBox([center[0] + f[0] * (scale * 0.18), center[1] + f[1] * (scale * 0.18), center[2] + f[2] * (scale * 0.18)], scale * 0.9, scale * 0.16, scale * 0.08, cWood, r, n, f, vertices, colors, indices);
    addBox(center, scale * 0.15, scale * 0.22, scale * 0.32, cMetal, r, n, f, vertices, colors, indices);
  }
};
})();

