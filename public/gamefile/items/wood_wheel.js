// === SEEDPLANET MODULE: JS/ITEMS/WOOD_WHEEL.JS ===

const _wheelTemplateCache = new Map();
const MAX_WHEEL_TEMPLATES = 24;

function getOrCreateRawWoodenWheelTemplate(radius, thickness, isPreview) {
  const rKey = Math.round(radius * 10000);
  const tKey = Math.round(thickness * 10000);
  const key = rKey + "_" + tKey + "_" + (isPreview ? 1 : 0);
  let cached = _wheelTemplateCache.get(key);
  if (cached) {
    return cached;
  }

  const tempVerts = [];
  const tempIndices = [];
  const tempSlots = []; // 0: cRim, 1: cHub, 2: cSpoke, 3: cIronBand
  const tempShades = [];

  const segs = 12;
  const rimWidth = radius * 0.24;
  const rOuter = radius;
  const rInner = radius - rimWidth;
  const halfThick = thickness * 0.5;

  // Rim (slot 0)
  for (let i = 0; i <= segs; i++) {
    const angle = (i / segs) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const pOutY = cosA * rOuter;
    const pOutZ = sinA * rOuter;
    const pInY = cosA * rInner;
    const pInZ = sinA * rInner;

    tempVerts.push(halfThick, pOutY, pOutZ);
    tempVerts.push(-halfThick, pOutY, pOutZ);
    tempVerts.push(-halfThick, pInY, pInZ);
    tempVerts.push(halfThick, pInY, pInZ);

    const woodGrain = isPreview ? 1.0 : (0.92 + 0.16 * Math.sin(i * 1.5));
    for (let c = 0; c < 4; c++) {
      tempSlots.push(0);
      tempShades.push(woodGrain);
    }
  }

  for (let i = 0; i < segs; i++) {
    const curr = i * 4;
    const next = (i + 1) * 4;

    tempIndices.push(curr + 0, next + 0, next + 1, curr + 0, next + 1, next + 0);
    tempIndices.push(curr + 0, next + 1, curr + 1, curr + 0, curr + 1, next + 1);

    tempIndices.push(curr + 2, curr + 3, next + 3, curr + 2, next + 3, curr + 3);
    tempIndices.push(curr + 2, next + 3, next + 2, curr + 2, next + 2, next + 3);

    tempIndices.push(curr + 3, curr + 0, next + 0, curr + 3, next + 0, curr + 0);
    tempIndices.push(curr + 3, next + 0, next + 3, curr + 3, next + 3, next + 0);

    tempIndices.push(curr + 1, curr + 2, next + 2, curr + 1, next + 2, curr + 2);
    tempIndices.push(curr + 1, next + 2, next + 1, curr + 1, next + 1, next + 2);
  }

  // Hub (slot 1)
  const hubRadius = radius * 0.28;
  const hubThick = thickness * 1.4;
  const hubSegs = 8;
  const hubHalfThick = hubThick * 0.5;
  const hubBaseIdx = tempVerts.length / 3;

  for (let i = 0; i <= hubSegs; i++) {
    const angle = (i / hubSegs) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const hY = cosA * hubRadius;
    const hZ = sinA * hubRadius;

    tempVerts.push(hubHalfThick, hY, hZ);
    tempVerts.push(-hubHalfThick, hY, hZ);

    tempSlots.push(1, 1);
    tempShades.push(1.0, 1.0);
  }

  for (let i = 0; i < hubSegs; i++) {
    const curr = hubBaseIdx + i * 2;
    const next = hubBaseIdx + (i + 1) * 2;

    tempIndices.push(curr + 0, curr + 1, next + 1, curr + 0, next + 1, curr + 1);
    tempIndices.push(curr + 0, next + 1, next + 0, curr + 0, next + 0, next + 1);
  }

  const capRightIdx = tempVerts.length / 3;
  tempVerts.push(hubHalfThick, 0, 0);
  tempSlots.push(1);
  tempShades.push(1.15);

  const capLeftIdx = tempVerts.length / 3;
  tempVerts.push(-hubHalfThick, 0, 0);
  tempSlots.push(1);
  tempShades.push(1.15);

  for (let i = 0; i < hubSegs; i++) {
    const curr = hubBaseIdx + i * 2;
    const next = hubBaseIdx + (i + 1) * 2;

    tempIndices.push(capRightIdx, curr + 0, next + 0, capRightIdx, next + 0, curr + 0);
    tempIndices.push(capLeftIdx, next + 1, curr + 1, capLeftIdx, curr + 1, next + 1);
  }

  // Spokes (slot 2)
  const hasSpokesBuilder = typeof buildTaperedSegment === "function";
  if (hasSpokesBuilder) {
    const spokeCount = 6;
    const spokeThick = thickness * 0.42;
    const dummyCol = [1, 1, 1];
    const spokeColors = [];
    const vBeforeSpokes = tempVerts.length / 3;

    for (let s = 0; s < spokeCount; s++) {
      const angle = (s / spokeCount) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const pStart = [0, cosA * (hubRadius * 0.85), sinA * (hubRadius * 0.85)];
      const pEnd = [0, cosA * (rInner * 1.02), sinA * (rInner * 1.02)];

      buildTaperedSegment(pStart, pEnd, spokeThick, spokeThick * 0.8, 4, dummyCol, tempVerts, spokeColors, tempIndices, false);
    }

    const vAfterSpokes = tempVerts.length / 3;
    for (let v = vBeforeSpokes; v < vAfterSpokes; v++) {
      tempSlots.push(2);
      tempShades.push(1.0);
    }
  }

  // Iron outer band (slot 3)
  if (!isPreview) {
    const ironSegs = 12;
    const ironOuter = rOuter + 0.003;
    const ironThick = halfThick * 0.92;
    const ironBaseIdx = tempVerts.length / 3;

    for (let i = 0; i <= ironSegs; i++) {
      const angle = (i / ironSegs) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const pY = cosA * ironOuter;
      const pZ = sinA * ironOuter;

      tempVerts.push(ironThick, pY, pZ);
      tempVerts.push(-ironThick, pY, pZ);

      tempSlots.push(3, 3);
      tempShades.push(1.0, 1.0);
    }

    for (let i = 0; i < ironSegs; i++) {
      const curr = ironBaseIdx + i * 2;
      const next = ironBaseIdx + (i + 1) * 2;

      tempIndices.push(curr + 0, next + 0, next + 1, curr + 0, next + 1, next + 0);
      tempIndices.push(curr + 0, next + 1, curr + 1, curr + 0, curr + 1, next + 1);
    }
  }

  const tpl = {
    verts: new Float32Array(tempVerts),
    slots: new Uint8Array(tempSlots),
    shades: new Float32Array(tempShades),
    indices: new Uint16Array(tempIndices),
    vertCount: tempVerts.length / 3
  };

  if (hasSpokesBuilder) {
    if (_wheelTemplateCache.size >= MAX_WHEEL_TEMPLATES) {
      const firstKey = _wheelTemplateCache.keys().next().value;
      _wheelTemplateCache.delete(firstKey);
    }
    _wheelTemplateCache.set(key, tpl);
  }
  return tpl;
}

window.drawDetailedWoodenWheel = function(center, radius, thickness, R, N, F, spinAngle, woodColor, darkWoodColor, metalColor, vertices, colors, indices, isPreview, previewColor, steerAngle) {
  const cRim = isPreview ? previewColor : (woodColor || [0.55, 0.38, 0.22]);
  const cSpoke = isPreview ? previewColor : (darkWoodColor || [0.4, 0.26, 0.14]);
  const cHub = isPreview ? previewColor : (metalColor || [0.35, 0.35, 0.35]);
  const cIronBand = isPreview ? previewColor : [0.22, 0.22, 0.25];

  let r0 = R[0], r1 = R[1], r2 = R[2];
  let f0 = F[0], f1 = F[1], f2 = F[2];
  if (steerAngle && Math.abs(steerAngle) > 0.001) {
    const cosS = Math.cos(steerAngle), sinS = Math.sin(steerAngle);
    const nf0 = f0 * cosS + r0 * sinS;
    const nf1 = f1 * cosS + r1 * sinS;
    const nf2 = f2 * cosS + r2 * sinS;
    const nr0 = r0 * cosS - f0 * sinS;
    const nr1 = r1 * cosS - f1 * sinS;
    const nr2 = r2 * cosS - f2 * sinS;
    f0 = nf0; f1 = nf1; f2 = nf2;
    r0 = nr0; r1 = nr1; r2 = nr2;
  }

  let n0 = N[0], n1 = N[1], n2 = N[2];
  if (spinAngle && Math.abs(spinAngle) > 1e-6) {
    const cosSpin = Math.cos(spinAngle), sinSpin = Math.sin(spinAngle);
    const sn0 = n0 * cosSpin + f0 * sinSpin;
    const sn1 = n1 * cosSpin + f1 * sinSpin;
    const sn2 = n2 * cosSpin + f2 * sinSpin;
    const sf0 = f0 * cosSpin - n0 * sinSpin;
    const sf1 = f1 * cosSpin - n1 * sinSpin;
    const sf2 = f2 * cosSpin - n2 * sinSpin;
    n0 = sn0; n1 = sn1; n2 = sn2;
    f0 = sf0; f1 = sf1; f2 = sf2;
  }

  const tpl = getOrCreateRawWoodenWheelTemplate(radius, thickness, !!isPreview);
  const tVerts = tpl.verts;
  const tSlots = tpl.slots;
  const tShades = tpl.shades;
  const tIndices = tpl.indices;
  const vCount = tpl.vertCount;
  const cx = center[0], cy = center[1], cz = center[2];
  const baseIdx = vertices.length / 3;

  const palette = [cRim, cHub, cSpoke, cIronBand];

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
    const sh = tShades[i];
    colors.push(col[0] * sh, col[1] * sh, col[2] * sh);
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

window.ItemRegistry["wood_wheel"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const isPreview = item.isPreview;
    const isValid = item.isValidPlacement !== false;
    const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    const woodColor = item.color || [0.55, 0.38, 0.22];
    const darkWoodColor = [0.4, 0.26, 0.14];
    const metalHubColor = [0.35, 0.35, 0.35];

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
      const wheelScale = typeof window.wheelScaleMultiplier === "number" ? window.wheelScaleMultiplier : 1.0;
      const wheelRadius = 0.16 * wheelScale;
      const wheelThick = 0.04 * wheelScale;

      const fAxleLen = typeof window.wheelFrontAxleLength === "number" ? window.wheelFrontAxleLength : 0.36;
      const fSideOff = typeof window.wheelFrontSideOffset === "number" ? window.wheelFrontSideOffset : 0.18;
      const fFwdOff  = typeof window.wheelFrontFwdOffset  === "number" ? window.wheelFrontFwdOffset  : 0.18;
      const fUpOff   = typeof window.wheelFrontUpOffset   === "number" ? window.wheelFrontUpOffset   : -0.03;

      const rAxleLen = typeof window.wheelRearAxleLength === "number" ? window.wheelRearAxleLength : 0.36;
      const rSideOff = typeof window.wheelRearSideOffset === "number" ? window.wheelRearSideOffset : 0.18;
      const rFwdOff  = typeof window.wheelRearFwdOffset  === "number" ? window.wheelRearFwdOffset  : 0.18;
      const rUpOff   = typeof window.wheelRearUpOffset   === "number" ? window.wheelRearUpOffset   : -0.03;

      const wheelOffsets = [
        { side: -1, forward: fFwdOff,  sideOff: fSideOff, upOff: fUpOff, isFront: true },
        { side: 1,  forward: fFwdOff,  sideOff: fSideOff, upOff: fUpOff, isFront: true },
        { side: -1, forward: -rFwdOff, sideOff: rSideOff, upOff: rUpOff, isFront: false },
        { side: 1,  forward: -rFwdOff, sideOff: rSideOff, upOff: rUpOff, isFront: false }
      ];

      // Front axle bar
      const fAxleCenter = [
        p[0] + n[0] * fUpOff + f[0] * fFwdOff,
        p[1] + n[1] * fUpOff + f[1] * fFwdOff,
        p[2] + n[2] * fUpOff + f[2] * fFwdOff
      ];
      addBox(fAxleCenter, fAxleLen, 0.03, 0.03, previewColor, r, n, f, vertices, colors, indices);

      // Rear axle bar
      const rAxleCenter = [
        p[0] + n[0] * rUpOff + f[0] * (-rFwdOff),
        p[1] + n[1] * rUpOff + f[1] * (-rFwdOff),
        p[2] + n[2] * rUpOff + f[2] * (-rFwdOff)
      ];
      addBox(rAxleCenter, rAxleLen, 0.03, 0.03, previewColor, r, n, f, vertices, colors, indices);

      for (let wo of wheelOffsets) {
        const sideOffset = wo.side * wo.sideOff;
        const fwdOffset = wo.forward;
        const upOffset = wo.upOff;

        const wCenter = [
          p[0] + r[0] * sideOffset + n[0] * upOffset + f[0] * fwdOffset,
          p[1] + r[1] * sideOffset + n[1] * upOffset + f[1] * fwdOffset,
          p[2] + r[2] * sideOffset + n[2] * upOffset + f[2] * fwdOffset
        ];

        window.drawDetailedWoodenWheel(
          wCenter, wheelRadius, wheelThick,
          r, n, f, 0,
          woodColor, darkWoodColor, metalHubColor,
          vertices, colors, indices,
          true, previewColor
        );
      }
      return;
    }

    const scale = item.size || 0.25;
    const radius = scale * 0.6;
    const thickness = scale * 0.12;

    window.drawDetailedWoodenWheel(
      p, radius, thickness,
      r, n, f, 0,
      woodColor, darkWoodColor, metalHubColor,
      vertices, colors, indices,
      isPreview, previewColor
    );
  }
};
