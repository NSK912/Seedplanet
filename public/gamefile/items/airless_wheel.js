// === SEEDPLANET MODULE: JS/ITEMS/AIRLESS_WHEEL.JS ===
// Combined Airless Wheel & Tire (Tweel honeycomb lattice + Bronze 7-spoke alloy rim + Brake disc)

(function() {
  const _airlessWheelCache = new Map();
  const MAX_AIRLESS_WHEEL_CACHE = 24;

  function pushLocalTri(verts, slots, shades, indices, a, b, c, slot, shade) {
    const base = verts.length / 3;
    verts.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    slots.push(slot, slot, slot);
    shades.push(shade, shade, shade);
    indices.push(base, base + 1, base + 2);
  }

  function pushLocalQuad(verts, slots, shades, indices, a, b, c, d, slot, shade) {
    const base = verts.length / 3;
    verts.push(
      a[0], a[1], a[2],
      b[0], b[1], b[2],
      c[0], c[1], c[2],
      d[0], d[1], d[2]
    );
    slots.push(slot, slot, slot, slot);
    shades.push(shade, shade, shade, shade);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // Push an oriented box in wheel local space (x = axle width, y = radial up, z = radial fwd)
  function pushLocalBox(verts, slots, shades, indices, center, w, h, d, rAx, nAx, fAx, slot, shade) {
    const hw = w * 0.5, hh = h * 0.5, hd = d * 0.5;
    const cx = center[0], cy = center[1], cz = center[2];
    const pt = (sx, sy, sz) => [
      cx + rAx[0] * (sx * hw) + nAx[0] * (sy * hh) + fAx[0] * (sz * hd),
      cy + rAx[1] * (sx * hw) + nAx[1] * (sy * hh) + fAx[1] * (sz * hd),
      cz + rAx[2] * (sx * hw) + nAx[2] * (sy * hh) + fAx[2] * (sz * hd)
    ];
    const p000 = pt(-1, -1, -1), p100 = pt(1, -1, -1), p110 = pt(1, 1, -1), p010 = pt(-1, 1, -1);
    const p001 = pt(-1, -1, 1),  p101 = pt(1, -1, 1),  p111 = pt(1, 1, 1),  p011 = pt(-1, 1, 1);
    pushLocalQuad(verts, slots, shades, indices, p001, p101, p111, p011, slot, shade);
    pushLocalQuad(verts, slots, shades, indices, p100, p000, p010, p110, slot, shade * 0.94);
    pushLocalQuad(verts, slots, shades, indices, p011, p111, p110, p010, slot, shade * 1.05);
    pushLocalQuad(verts, slots, shades, indices, p000, p100, p101, p001, slot, shade * 0.88);
    pushLocalQuad(verts, slots, shades, indices, p101, p100, p110, p111, slot, shade * 0.98);
    pushLocalQuad(verts, slots, shades, indices, p000, p001, p011, p010, slot, shade * 0.96);
  }

  // Push a ring cylinder (outer & inner radius) along X axis
  function pushRing(verts, slots, shades, indices, rOuter, rInner, halfW, segs, slot, shadeFn) {
    const base = verts.length / 3;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const sh = shadeFn ? shadeFn(i) : 1.0;
      verts.push(
        halfW,  c * rOuter, s * rOuter,
        -halfW, c * rOuter, s * rOuter,
        -halfW, c * rInner, s * rInner,
        halfW,  c * rInner, s * rInner
      );
      slots.push(slot, slot, slot, slot);
      shades.push(sh, sh, sh * 0.92, sh * 0.92);
    }
    for (let i = 0; i < segs; i++) {
      const curr = base + i * 4;
      const next = base + (i + 1) * 4;
      // Outer circumference
      indices.push(curr + 0, next + 0, next + 1, curr + 0, next + 1, curr + 1);
      // Inner circumference
      indices.push(curr + 2, next + 3, curr + 3, curr + 2, next + 2, next + 3);
      // +X sidewall
      indices.push(curr + 3, next + 0, curr + 0, curr + 3, next + 3, next + 0);
      // -X sidewall
      indices.push(curr + 1, next + 2, curr + 2, curr + 1, next + 1, next + 2);
    }
  }

  function pushSolidDisc(verts, slots, shades, indices, rad, xMin, xMax, segs, slot, shade) {
    const base = verts.length / 3;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      verts.push(xMax, c * rad, s * rad, xMin, c * rad, s * rad);
      slots.push(slot, slot);
      shades.push(shade, shade * 0.95);
    }
    for (let i = 0; i < segs; i++) {
      const curr = base + i * 2;
      const next = base + (i + 1) * 2;
      indices.push(curr, next, next + 1, curr, next + 1, curr + 1);
    }
    const cRight = verts.length / 3;
    verts.push(xMax, 0, 0);
    slots.push(slot);
    shades.push(shade * 1.06);
    const cLeft = verts.length / 3;
    verts.push(xMin, 0, 0);
    slots.push(slot);
    shades.push(shade * 1.02);
    for (let i = 0; i < segs; i++) {
      const curr = base + i * 2;
      const next = base + (i + 1) * 2;
      indices.push(cRight, next, curr);
      indices.push(cLeft, curr + 1, next + 1);
    }
  }

  function getOrCreateAirlessWheelTemplate(radius, thickness, isPreview) {
    const key = Math.round(radius * 10000) + "_" + Math.round(thickness * 10000) + "_" + (isPreview ? 1 : 0);
    const cached = _airlessWheelCache.get(key);
    if (cached) return cached;

    const verts = [];
    const slots = []; // 0: rubber tread, 1: airless lattice, 2: bronze rim/spokes, 3: steel rotor/hub, 4: dark caliper/accent
    const shades = [];
    const indices = [];

    const halfW = thickness * 0.5;
    const rOuter = radius;
    const rTreadInner = radius * 0.885;
    const rRimOuter = radius * 0.685;
    const rRimInner = radius * 0.61;
    const rHub = radius * 0.21;

    // 1. Outer Dark Rubber Tread Band (slot 0)
    const treadSegs = isPreview ? 16 : 24;
    pushRing(verts, slots, shades, indices, rOuter, rTreadInner, halfW, treadSegs, 0, (i) => (isPreview ? 1.0 : (0.94 + 0.08 * (i % 2))));

    // Tread chevron lugs around circumference (skip in preview for lightweight silhouette)
    if (!isPreview) {
      const lugCount = 24;
      const lugH = radius * 0.028;
      const lugLen = (Math.PI * 2 * rOuter / lugCount) * 0.52;
      for (let i = 0; i < lugCount; i++) {
        const a = (i / lugCount) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const rAx = [1, 0, 0];
        const nAx = [0, ca, sa];
        const fAx = [0, -sa, ca];
        const rPos = rOuter + lugH * 0.35;
        // Split angled chevron blocks (left & right shoulder treads)
        pushLocalBox(verts, slots, shades, indices, [-halfW * 0.45, ca * rPos, sa * rPos], thickness * 0.42, lugH, lugLen, rAx, nAx, fAx, 0, 0.82);
        pushLocalBox(verts, slots, shades, indices, [halfW * 0.45, ca * rPos, sa * rPos], thickness * 0.42, lugH, lugLen, rAx, nAx, fAx, 0, 0.85);
      }
    }

    // 2. Open Honeycomb / Tweel Deformable Airless Lattice Spokes (slot 1)
    // Alternating V-chevron flexible ribs bridging inner rim barrel to outer rubber tread
    const latticePairs = isPreview ? 14 : 24;
    const midR = (rRimOuter + rTreadInner) * 0.5;
    const ribSpan = (rTreadInner - rRimOuter) * 1.12;
    const ribWidth = thickness * 0.86;
    const ribThick = radius * 0.022;
    for (let i = 0; i < latticePairs; i++) {
      const a0 = (i / latticePairs) * Math.PI * 2;
      const a1 = ((i + 0.5) / latticePairs) * Math.PI * 2;
      // Forward-leaning flexible rib
      {
        const tilt = a0 + 0.32;
        const cPos = Math.cos(a0), sPos = Math.sin(a0);
        const ct = Math.cos(tilt), st = Math.sin(tilt);
        pushLocalBox(
          verts, slots, shades, indices,
          [0, cPos * midR, sPos * midR],
          ribWidth, ribSpan, ribThick,
          [1, 0, 0], [0, ct, st], [0, -st, ct],
          1, 1.0
        );
      }
      // Backward-leaning intersecting honeycomb rib
      if (!isPreview) {
        const tilt = a1 - 0.32;
        const cPos = Math.cos(a1), sPos = Math.sin(a1);
        const ct = Math.cos(tilt), st = Math.sin(tilt);
        pushLocalBox(
          verts, slots, shades, indices,
          [0, cPos * midR, sPos * midR],
          ribWidth * 0.92, ribSpan, ribThick * 0.92,
          [1, 0, 0], [0, ct, st], [0, -st, ct],
          1, 0.86
        );
      }
    }

    // Mid-lattice stabilizer hoop (subtle thin inner band inside the honeycomb)
    pushRing(verts, slots, shades, indices, midR + radius * 0.014, midR - radius * 0.014, halfW * 0.72, isPreview ? 16 : 24, 1, () => 0.92);

    // 3. Bronze / Copper Alloy Inner Rim Barrel (slot 2)
    pushRing(verts, slots, shades, indices, rRimOuter, rRimInner, halfW * 0.88, isPreview ? 14 : 20, 2, (i) => (isPreview ? 1.0 : (0.94 + 0.10 * Math.cos(i * 0.7))));

    // 4. Sculpted 7-Spoke Bronze Y-Alloy Spokes (slot 2) - Signature look from Image 1
    const spokeCount = 7;
    const spokeRStart = rHub * 0.85;
    const spokeREnd = rRimInner * 1.03;
    const spokeMidR = (spokeRStart + spokeREnd) * 0.5;
    const spokeLen = spokeREnd - spokeRStart;
    const spokeThickX = thickness * 0.24;
    const spokeFaceX = halfW * 0.42;

    for (let s = 0; s < spokeCount; s++) {
      const a = (s / spokeCount) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      // Main bronze spoke arm (both outer face and inner structural depth)
      pushLocalBox(
        verts, slots, shades, indices,
        [spokeFaceX, ca * spokeMidR, sa * spokeMidR],
        spokeThickX, spokeLen, radius * 0.068,
        [1, 0, 0], [0, ca, sa], [0, -sa, ca],
        2, 1.08
      );
      pushLocalBox(
        verts, slots, shades, indices,
        [-spokeFaceX, ca * spokeMidR, sa * spokeMidR],
        spokeThickX, spokeLen, radius * 0.068,
        [1, 0, 0], [0, ca, sa], [0, -sa, ca],
        2, 0.96
      );
      // Y-split twin prongs near rim barrel
      if (!isPreview) {
        const yR = rRimInner * 0.84;
        const yLen = (rRimInner - spokeMidR) * 0.95;
        for (let dir of [-1, 1]) {
          const ya = a + dir * 0.18;
          const cy = Math.cos(ya), sy = Math.sin(ya);
          pushLocalBox(
            verts, slots, shades, indices,
            [spokeFaceX * 0.96, cy * yR, sy * yR],
            spokeThickX * 0.85, yLen, radius * 0.042,
            [1, 0, 0], [0, cy, sy], [0, -sy, cy],
            2, 1.02
          );
          pushLocalBox(
            verts, slots, shades, indices,
            [-spokeFaceX * 0.96, cy * yR, sy * yR],
            spokeThickX * 0.85, yLen, radius * 0.042,
            [1, 0, 0], [0, cy, sy], [0, -sy, cy],
            2, 0.92
          );
        }
      }
    }

    // 5. Center Hub Boss + Steel Brake Rotor Disc + Caliper (slots 3 & 4)
    pushSolidDisc(verts, slots, shades, indices, rHub, -halfW * 0.72, halfW * 0.72, 10, 3, 1.0);
    // Lug nut ring cap
    pushSolidDisc(verts, slots, shades, indices, rHub * 0.52, -halfW * 0.84, halfW * 0.84, 8, 2, 1.12);
    // Machined metallic brake rotor disc inside wheel cavity
    if (!isPreview) {
      pushSolidDisc(verts, slots, shades, indices, rRimInner * 0.76, -thickness * 0.08, thickness * 0.08, 16, 3, 0.88);
      // Red/dark performance brake caliper block
      pushLocalBox(
        verts, slots, shades, indices,
        [0, rRimInner * 0.52, -rRimInner * 0.36],
        thickness * 0.36, radius * 0.22, radius * 0.14,
        [1, 0, 0], [0, 0.82, -0.57], [0, 0.57, 0.82],
        4, 1.0
      );
    }

    const tpl = {
      verts: new Float32Array(verts),
      slots: new Uint8Array(slots),
      shades: new Float32Array(shades),
      indices: new Uint16Array(indices),
      vertCount: verts.length / 3
    };

    if (_airlessWheelCache.size >= MAX_AIRLESS_WHEEL_CACHE) {
      const firstKey = _airlessWheelCache.keys().next().value;
      _airlessWheelCache.delete(firstKey);
    }
    _airlessWheelCache.set(key, tpl);
    return tpl;
  }

  window.drawAirlessWheel = function(center, radius, thickness, R, N, F, spinAngle, vertices, colors, indices, isPreview, previewColor, steerAngle) {
    const cTread   = isPreview ? previewColor : [0.13, 0.13, 0.15];
    const cLattice = isPreview ? previewColor : [0.21, 0.21, 0.24];
    const cBronze  = isPreview ? previewColor : [0.62, 0.45, 0.33];
    const cRotor   = isPreview ? previewColor : [0.68, 0.70, 0.74];
    const cCaliper = isPreview ? previewColor : [0.76, 0.16, 0.18];

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

    const tpl = getOrCreateAirlessWheelTemplate(radius, thickness, !!isPreview);
    const tVerts = tpl.verts;
    const tSlots = tpl.slots;
    const tShades = tpl.shades;
    const tIndices = tpl.indices;
    const vCount = tpl.vertCount;
    const cx = center[0], cy = center[1], cz = center[2];
    const baseIdx = vertices.length / 3;
    const palette = [cTread, cLattice, cBronze, cRotor, cCaliper];

    for (let i = 0; i < vCount; i++) {
      const i3 = i * 3;
      const lx = tVerts[i3], ly = tVerts[i3 + 1], lz = tVerts[i3 + 2];
      vertices.push(
        cx + r0 * lx + n0 * ly + f0 * lz,
        cy + r1 * lx + n1 * ly + f1 * lz,
        cz + r2 * lx + n2 * ly + f2 * lz
      );
      const col = palette[tSlots[i]];
      const sh = tShades[i];
      colors.push(
        Math.min(1, col[0] * sh),
        Math.min(1, col[1] * sh),
        Math.min(1, col[2] * sh)
      );
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

  // Helper to draw full 3-wheel reverse-trike airless wheelset on cyber_car (decoupled from wood_boat wheelScaleMultiplier!)
  window.drawCyberCarWheelSet = function(p, r, n, f, spinAngle, steerAngle, vertices, colors, indices, isPreview, previewColor) {
    const carScale = typeof window.CYBER_CAR_SCALE === "number" ? window.CYBER_CAR_SCALE : 0.36;
    const fScale = typeof window.cyberCarFrontWheelScale === "number" ? window.cyberCarFrontWheelScale : 0.71;
    const rScale = typeof window.cyberCarRearWheelScale === "number" ? window.cyberCarRearWheelScale : 0.80;
    const rWidth = typeof window.cyberCarRearWheelWidth === "number" ? window.cyberCarRearWheelWidth : 1.0;

    const frontR = 0.156 * carScale * fScale;
    const frontThick = 0.088 * carScale * fScale;
    // Larger, beefier steamroller rear wheel (~18% taller & 2x wider than front wheels at equal scale!)
    const rearR = 0.184 * carScale * rScale;
    const rearThick = 0.178 * carScale * rScale * rWidth;

    const px = p[0], py = p[1], pz = p[2];
    const rx0 = r[0], rx1 = r[1], rx2 = r[2];
    const ny0 = n[0], ny1 = n[1], ny2 = n[2];
    const fz0 = f[0], fz1 = f[1], fz2 = f[2];

    const fSide = (0.254 + Math.max(-0.35, fScale - 1.0) * 0.065) * carScale;
    const fFwd = 0.340 * carScale;
    const fUp = -0.028 * carScale;

    const rFwd = -0.415 * carScale; // Extended rear axle matching lengthened Swingarm-Mounted Engine!
    const rUp = 0.000 * carScale;

    const axleCol = isPreview ? previewColor : [0.20, 0.21, 0.24];

    // Front double-wishbone suspension arms & rear hub axle pin
    if (typeof addBox === "function") {
      const fAxleC = [
        px + ny0 * fUp + fz0 * fFwd,
        py + ny1 * fUp + fz1 * fFwd,
        pz + ny2 * fUp + fz2 * fFwd
      ];
      addBox(fAxleC, fSide * 1.98, 0.022 * carScale, 0.022 * carScale, axleCol, r, n, f, vertices, colors, indices);

      const upperArmC = [
        px + ny0 * (fUp + 0.048 * carScale) + fz0 * (fFwd - 0.022 * carScale),
        py + ny1 * (fUp + 0.048 * carScale) + fz1 * (fFwd - 0.022 * carScale),
        pz + ny2 * (fUp + 0.048 * carScale) + fz2 * (fFwd - 0.022 * carScale)
      ];
      addBox(upperArmC, fSide * 1.84, 0.015 * carScale, 0.018 * carScale, axleCol, r, n, f, vertices, colors, indices);

      const rAxleC = [
        px + ny0 * rUp + fz0 * rFwd,
        py + ny1 * rUp + fz1 * rFwd,
        pz + ny2 * rUp + fz2 * rFwd
      ];
      const rearAxleLen = Math.max(0.22 * carScale, rearThick + 0.062 * carScale);
      addBox(rAxleC, rearAxleLen, 0.036 * carScale, 0.036 * carScale, axleCol, r, n, f, vertices, colors, indices);
    }

    const flCenter = [
      px - rx0 * fSide + ny0 * fUp + fz0 * fFwd,
      py - rx1 * fSide + ny1 * fUp + fz1 * fFwd,
      pz - rx2 * fSide + ny2 * fUp + fz2 * fFwd
    ];
    const frCenter = [
      px + rx0 * fSide + ny0 * fUp + fz0 * fFwd,
      py + rx1 * fSide + ny1 * fUp + fz1 * fFwd,
      pz + rx2 * fSide + ny2 * fUp + fz2 * fFwd
    ];
    const rearCenter = [
      px + ny0 * rUp + fz0 * rFwd,
      py + ny1 * rUp + fz1 * rFwd,
      pz + ny2 * rUp + fz2 * rFwd
    ];

    window.drawAirlessWheel(flCenter, frontR, frontThick, r, n, f, spinAngle, vertices, colors, indices, isPreview, previewColor, steerAngle);
    window.drawAirlessWheel(frCenter, frontR, frontThick, r, n, f, spinAngle, vertices, colors, indices, isPreview, previewColor, steerAngle);
    window.drawAirlessWheel(rearCenter, rearR, rearThick, r, n, f, spinAngle, vertices, colors, indices, isPreview, previewColor, 0);
  };

  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["airless_wheel"] = {
    render: function(item, vertices, colors, indices, targetBuffer) {
      const p = item.position;
      const isPreview = !!item.isPreview;
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

      const carScale = typeof window.CYBER_CAR_SCALE === "number" ? window.CYBER_CAR_SCALE : 0.36;

      if (isPreview && item.isBoatSnapped) {
        const target = item.targetBoat;
        const hasWheel = target && !!(target.hasWheel || target.hasWheels || target.hasAirlessWheel || (target.wheelCount && target.wheelCount > 0));
        const lift = hasWheel ? 0.0 : (0.085 * carScale);
        const snapPos = [p[0] + n[0] * lift, p[1] + n[1] * lift, p[2] + n[2] * lift];
        window.drawCyberCarWheelSet(snapPos, r, n, f, 0, 0, vertices, colors, indices, true, previewColor);
        return;
      }

      const scale = (item.size || 0.25) * carScale;
      const radius = scale * 0.66;
      const thickness = scale * 0.34;
      const center = [
        p[0] + n[0] * radius,
        p[1] + n[1] * radius,
        p[2] + n[2] * radius
      ];

      window.drawAirlessWheel(center, radius, thickness, r, n, f, 0, vertices, colors, indices, isPreview, previewColor, 0);
    }
  };
})();
