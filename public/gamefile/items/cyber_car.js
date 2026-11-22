// === SEEDPLANET MODULE: JS/ITEMS/CYBER_CAR.JS ===
// Watertight Faceted Origami 3-Wheel Reverse-Trike Cyber Vehicle Chassis ("INVADER")
// Calibrated to player character scale (CYBER_CAR_SCALE = 0.56) with fully sealed panel seams
// Modular attachments:
//   - hasDoor   (CYBER_CAR_DOOR)
//   - hasSeat   (CYBER_CAR_SEAT)
//   - hasWheel  (AIRLESS_WHEEL)
//   - hasEngine (CYBER_ENGINE)

(function() {
  let _cyberCarHullTemplate = null;
  let _cyberCarGlassTemplate = null;
  let _frontFenderLeftTemplate = null;
  let _frontFenderRightTemplate = null;
  const STANDARD_GLASS_COLOR = [0.6, 0.8, 1.0];

  // Global Cyber Car scale matched tightly to character scale (~1.05x standing height, snug cockpit!)
  window.CYBER_CAR_SCALE = 0.36;
  // Local-space lift when chassis sits on ground WITHOUT wheels (belly is at local y = -0.084)
  window.CYBER_CAR_UNWHEELED_LIFT = 0.085 * window.CYBER_CAR_SCALE;
  // Independent Front/Rear wheel scales & rear width (adjustable live in DevGame UI!)
  if (typeof window.cyberCarFrontWheelScale !== "number") window.cyberCarFrontWheelScale = 0.71;
  if (typeof window.cyberCarRearWheelScale !== "number") window.cyberCarRearWheelScale = 0.80;
  if (typeof window.cyberCarRearWheelWidth !== "number") window.cyberCarRearWheelWidth = 1.0;

  function shadeMetal(baseColor, nx, ny, nz, metallic) {
    if (metallic === 0) {
      return [baseColor[0], baseColor[1], baseColor[2]];
    }
    if (metallic === 2) {
      // Dark smoked reflective panoramic glass
      const sky = 0.5 + 0.5 * ny;
      const sheen = Math.pow(Math.max(0, ny * 0.80 + nz * 0.56 + Math.abs(nx) * 0.15), 3.0) * 0.30;
      return [
        Math.min(1, baseColor[0] * (0.76 + 0.34 * sky) + sheen * 0.90),
        Math.min(1, baseColor[1] * (0.76 + 0.34 * sky) + sheen * 0.96),
        Math.min(1, baseColor[2] * (0.76 + 0.34 * sky) + sheen * 1.06)
      ];
    }
    // Bright brushed stainless-steel studio shading (stays clearly silver even in dusk/night ambient!)
    const key = Math.max(0, nx * 0.36 + ny * 0.82 + nz * 0.44);
    const fill = Math.max(0, -nx * 0.44 + ny * 0.36 - nz * 0.30);
    const sky = 0.5 + 0.5 * ny;
    const spec = metallic > 0.4 ? Math.pow(Math.max(0, nx * 0.22 + ny * 0.88 + nz * 0.42), 8.0) * 0.14 * metallic : 0;
    const lum = 0.54 + 0.34 * key + 0.15 * fill + 0.12 * sky;
    return [
      Math.min(0.92, baseColor[0] * lum + spec),
      Math.min(0.94, baseColor[1] * lum + spec),
      Math.min(0.96, baseColor[2] * lum + spec * 1.02)
    ];
  }

  // Strictly CW-outward triangle matching engine's gl.frontFace(gl.CW) + gl.cullFace(gl.BACK)
  function addTri(verts, cols, indices, a, b, c, baseColor, outDir, metallic) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-8) return;
    nx /= len; ny /= len; nz /= len;

    const dot = nx * outDir[0] + ny * outDir[1] + nz * outDir[2];
    let outNx, outNy, outNz, flip;
    if (dot < 0) {
      flip = false;
      outNx = -nx; outNy = -ny; outNz = -nz;
    } else {
      flip = true;
      outNx = nx; outNy = ny; outNz = nz;
    }

    const col = shadeMetal(baseColor, outNx, outNy, outNz, metallic === undefined ? 0.85 : metallic);
    const base = verts.length / 3;
    verts.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    cols.push(col[0], col[1], col[2], col[0], col[1], col[2], col[0], col[1], col[2]);
    if (flip) {
      indices.push(base, base + 2, base + 1);
    } else {
      indices.push(base, base + 1, base + 2);
    }
  }

  function addQuad(verts, cols, indices, a, b, c, d, baseColor, outDir, metallic) {
    addTri(verts, cols, indices, a, b, c, baseColor, outDir, metallic);
    addTri(verts, cols, indices, a, c, d, baseColor, outDir, metallic);
  }

  function addHex(verts, cols, indices, a0, a1, a2, a3, b0, b1, b2, b3, baseColor, metallic) {
    const cx = (a0[0] + a1[0] + a2[0] + a3[0] + b0[0] + b1[0] + b2[0] + b3[0]) * 0.125;
    const cy = (a0[1] + a1[1] + a2[1] + a3[1] + b0[1] + b1[1] + b2[1] + b3[1]) * 0.125;
    const cz = (a0[2] + a1[2] + a2[2] + a3[2] + b0[2] + b1[2] + b2[2] + b3[2]) * 0.125;
    const outOf = (p0, p1, p2, p3) => [
      (p0[0] + p1[0] + p2[0] + p3[0]) * 0.25 - cx,
      (p0[1] + p1[1] + p2[1] + p3[1]) * 0.25 - cy,
      (p0[2] + p1[2] + p2[2] + p3[2]) * 0.25 - cz
    ];
    addQuad(verts, cols, indices, a0, a1, a2, a3, baseColor, outOf(a0, a1, a2, a3), metallic);
    addQuad(verts, cols, indices, b0, b1, b2, b3, baseColor, outOf(b0, b1, b2, b3), metallic);
    addQuad(verts, cols, indices, a0, a1, b1, b0, baseColor, outOf(a0, a1, b1, b0), metallic);
    addQuad(verts, cols, indices, a1, a2, b2, b1, baseColor, outOf(a1, a2, b2, b1), metallic);
    addQuad(verts, cols, indices, a2, a3, b3, b2, baseColor, outOf(a2, a3, b3, b2), metallic);
    addQuad(verts, cols, indices, a3, a0, b0, b3, baseColor, outOf(a3, a0, b0, b3), metallic);
  }

  function addStrut(verts, cols, indices, pA, pB, thickX, thickPerp, baseColor, metallic) {
    const dx = pB[0] - pA[0], dy = pB[1] - pA[1], dz = pB[2] - pA[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return;
    const fx = dx / len, fy = dy / len, fz = dz / len;
    let ux = 0, uy = 1, uz = 0;
    if (Math.abs(fy) > 0.92) { ux = 0; uy = 0; uz = 1; }
    let rx = uy * fz - uz * fy;
    let ry = uz * fx - ux * fz;
    let rz = ux * fy - uy * fx;
    const rLen = Math.hypot(rx, ry, rz) || 1;
    rx /= rLen; ry /= rLen; rz /= rLen;
    const ox = fy * rz - fz * ry;
    const oy = fz * rx - fx * rz;
    const oz = fx * ry - fy * rx;

    const hx = thickX * 0.5, hy = thickPerp * 0.5;
    const mk = (p, sx, sy) => [
      p[0] + rx * (sx * hx) + ox * (sy * hy),
      p[1] + ry * (sx * hx) + oy * (sy * hy),
      p[2] + rz * (sx * hx) + oz * (sy * hy)
    ];
    addHex(
      verts, cols, indices,
      mk(pA, -1, -1), mk(pA, 1, -1), mk(pA, 1, 1), mk(pA, -1, 1),
      mk(pB, -1, -1), mk(pB, 1, -1), mk(pB, 1, 1), mk(pB, -1, 1),
      baseColor, metallic
    );
  }

  function addTrimStrip(verts, cols, indices, pA, pB, thickness, baseColor) {
    addStrut(verts, cols, indices, pA, pB, thickness, thickness, baseColor, 0);
  }

  // Machined cylinder oriented along local Z axis (for horizontal clevis pivot bolts, ball joints & coilover eyelets!)
  function addCylZ(verts, cols, indices, cx, cy, z0, z1, radius, segs, baseColor, metallic) {
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const midA = (a0 + a1) * 0.5;
      const p0a = [cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius, z0];
      const p0b = [cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius, z0];
      const p1a = [cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius, z1];
      const p1b = [cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius, z1];
      addQuad(verts, cols, indices, p0a, p0b, p1b, p1a, baseColor, [Math.cos(midA), Math.sin(midA), 0], metallic);
      addTri(verts, cols, indices, [cx, cy, z0], p0b, p0a, baseColor, [0, 0, z0 < z1 ? -1 : 1], metallic);
      addTri(verts, cols, indices, [cx, cy, z1], p1a, p1b, baseColor, [0, 0, z1 > z0 ? 1 : -1], metallic);
    }
  }

  // Detailed 3D Coilover Shock Absorber with machined top/bottom mounting eyelets, preload collars, damper body, chrome rod & 7 stacked coils!
  function addCoilover(verts, cols, indices, pTop, pBot, coilRadius, cSpring, cBody, cChrome) {
    const dx = pBot[0] - pTop[0], dy = pBot[1] - pTop[1], dz = pBot[2] - pTop[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-5) return;
    const ax = dx / len, ay = dy / len, az = dz / len;
    let ux = 0, uy = 0, uz = 1;
    if (Math.abs(az) > 0.90) { ux = 1; uy = 0; uz = 0; }
    let rx = uy * az - uz * ay;
    let ry = uz * ax - ux * az;
    let rz = ux * ay - uy * ax;
    const rLen = Math.hypot(rx, ry, rz) || 1;
    rx /= rLen; ry /= rLen; rz /= rLen;
    const ox = ay * rz - az * ry;
    const oy = az * rx - ax * rz;
    const oz = ax * ry - ay * rx;

    const lerpP = (t) => [pTop[0] + dx * t, pTop[1] + dy * t, pTop[2] + dz * t];
    const addRing = (t0, t1, rad, segs, col, met) => {
      const c0 = lerpP(t0), c1 = lerpP(t1);
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2;
        const a1 = ((i + 1) / segs) * Math.PI * 2;
        const mA = (a0 + a1) * 0.5;
        const ca0 = Math.cos(a0), sa0 = Math.sin(a0);
        const ca1 = Math.cos(a1), sa1 = Math.sin(a1);
        const q0a = [c0[0] + (rx * ca0 + ox * sa0) * rad, c0[1] + (ry * ca0 + oy * sa0) * rad, c0[2] + (rz * ca0 + oz * sa0) * rad];
        const q0b = [c0[0] + (rx * ca1 + ox * sa1) * rad, c0[1] + (ry * ca1 + oy * sa1) * rad, c0[2] + (rz * ca1 + oz * sa1) * rad];
        const q1a = [c1[0] + (rx * ca0 + ox * sa0) * rad, c1[1] + (ry * ca0 + oy * sa0) * rad, c1[2] + (rz * ca0 + oz * sa0) * rad];
        const q1b = [c1[0] + (rx * ca1 + ox * sa1) * rad, c1[1] + (ry * ca1 + oy * sa1) * rad, c1[2] + (rz * ca1 + oz * sa1) * rad];
        const out = [rx * Math.cos(mA) + ox * Math.sin(mA), ry * Math.cos(mA) + oy * Math.sin(mA), rz * Math.cos(mA) + oz * Math.sin(mA)];
        addQuad(verts, cols, indices, q0a, q0b, q1b, q1a, col, out, met);
        addTri(verts, cols, indices, c0, q0b, q0a, col, [-ax, -ay, -az], met);
        addTri(verts, cols, indices, c1, q1a, q1b, col, [ ax,  ay,  az], met);
      }
    };

    const cGold = [0.78, 0.62, 0.30];
    // Top & bottom machined Z-oriented mounting eyelet rings seated cleanly inside clevis forks
    addCylZ(verts, cols, indices, pTop[0], pTop[1], pTop[2] - 0.0085, pTop[2] + 0.0085, coilRadius * 0.72, 10, cBody, 0.90);
    addCylZ(verts, cols, indices, pBot[0], pBot[1], pBot[2] - 0.0085, pBot[2] + 0.0085, coilRadius * 0.68, 10, cBody, 0.90);
    // Upper anodized top-hat mount & main damper reservoir tube
    addRing(0.05, 0.13, coilRadius * 1.06, 8, cBody, 0.88);
    addRing(0.12, 0.64, coilRadius * 0.56, 8, cBody, 0.75);
    // Lower polished chrome piston shaft + rubber bump stop + lower billet collar
    addRing(0.62, 0.92, coilRadius * 0.34, 8, cChrome, 1.00);
    addRing(0.76, 0.82, coilRadius * 0.54, 8, [0.14, 0.15, 0.18], 0.25);
    addRing(0.90, 0.96, coilRadius * 0.68, 8, cBody, 0.88);
    // Gold anodized threaded preload spring perch collars (top & bottom of spring)
    addRing(0.14, 0.19, coilRadius * 1.04, 8, cGold, 0.95);
    addRing(0.70, 0.75, coilRadius * 1.04, 8, cGold, 0.95);
    // 7 crisp crimson racing coilover spring coils
    const numCoils = 7;
    for (let ci = 0; ci < numCoils; ci++) {
      const tc = 0.215 + (ci / (numCoils - 1)) * 0.46;
      addRing(tc - 0.019, tc + 0.019, coilRadius, 8, cSpring, 0.68);
    }
  }

  function addMirroredTri(verts, cols, indices, a, b, c, baseColor, outDir, metallic) {
    addTri(verts, cols, indices, a, b, c, baseColor, outDir, metallic);
    addTri(
      verts, cols, indices,
      [-a[0], a[1], a[2]],
      [-b[0], b[1], b[2]],
      [-c[0], c[1], c[2]],
      baseColor,
      [-outDir[0], outDir[1], outDir[2]],
      metallic
    );
  }

  function addMirroredQuad(verts, cols, indices, a, b, c, d, baseColor, outDir, metallic) {
    addQuad(verts, cols, indices, a, b, c, d, baseColor, outDir, metallic);
    addQuad(
      verts, cols, indices,
      [-a[0], a[1], a[2]],
      [-b[0], b[1], b[2]],
      [-c[0], c[1], c[2]],
      [-d[0], d[1], d[2]],
      baseColor,
      [-outDir[0], outDir[1], outDir[2]],
      metallic
    );
  }

  // Hub-centered snug, low-profile 4-segment origami faceted front wheel fender + steering knuckle upright!
  // Built around local hub (0, 0, 0) so it pivots in 100% lockstep with the front wheel steerAngle & scales with cyberCarFrontWheelScale!
  function buildSteerableFrontFenderTemplate(side) {
    const verts = [];
    const cols = [];
    const indices = [];
    const cSteel     = [0.88, 0.90, 0.93];
    const cSteelDark = [0.68, 0.70, 0.74];
    const cUnder     = [0.16, 0.17, 0.20];

    const rIn  = 0.165; // Razor-snug 0.009 clearance over frontR = 0.156 tire!
    const rOut = 0.178; // Sleek low-profile 0.013 fender crown thickness
    const xInner = -side * 0.049; // Hugs frontThick = 0.088 tire tightly!
    const xOuter =  side * 0.049;
    const xLip   =  side * 0.053;

    // 5 tight low-slung angular arch stations following the front tire curve closely
    const stations = [
      { ang:  0.86, rI: rIn + 0.002, rO: rOut + 0.003, flare: 0.000 }, // Sleek front overhang beak
      { ang:  0.34, rI: rIn + 0.001, rO: rOut + 0.001, flare: 0.002 }, // Front upper crease
      { ang: -0.18, rI: rIn + 0.001, rO: rOut + 0.001, flare: 0.002 }, // Rear-top crown crease
      { ang: -0.68, rI: rIn + 0.001, rO: rOut + 0.000, flare: 0.000 }, // Rear downward skirt
      { ang: -1.08, rI: rIn + 0.002, rO: rIn + 0.011,  flare: -0.002 } // Rear lower tip hugging tire
    ];

    const ringOut = [];
    const ringIn = [];
    const ringSideLow = [];
    for (let i = 0; i < stations.length; i++) {
      const st = stations[i];
      const sA = Math.sin(st.ang);
      const cA = Math.cos(st.ang);
      ringOut.push({
        in:  [xInner, cA * st.rO, sA * st.rO],
        out: [xOuter + side * st.flare, cA * st.rO, sA * st.rO]
      });
      ringIn.push({
        in:  [xInner, cA * st.rI, sA * st.rI],
        out: [xOuter, cA * st.rI, sA * st.rI]
      });
      // Tight sculpted outer side flange lip hugging tire shoulder
      const rSide = st.rI - 0.016;
      ringSideLow.push([xLip, cA * rSide, sA * rSide]);
    }

    for (let i = 0; i < stations.length - 1; i++) {
      const aO = ringOut[i], bO = ringOut[i + 1];
      const aI = ringIn[i],  bI = ringIn[i + 1];
      const midAng = (stations[i].ang + stations[i + 1].ang) * 0.5;
      const outRad = [0, Math.cos(midAng), Math.sin(midAng)];
      const inRad  = [0, -Math.cos(midAng), -Math.sin(midAng)];

      // Top brushed steel arch facet
      addQuad(verts, cols, indices, aO.in, aO.out, bO.out, bO.in, cSteel, outRad, 0.95);
      // Underside dark arch ceiling
      addQuad(verts, cols, indices, aI.out, aI.in, bI.in, bI.out, cUnder, inRad, 0.25);
      // Inner vertical side plate facing nose
      addQuad(verts, cols, indices, aI.in, aO.in, bO.in, bI.in, cSteelDark, [-side, 0, 0], 0.75);
      // Outer faceted beveled side skirt lip
      addQuad(verts, cols, indices, aO.out, ringSideLow[i], ringSideLow[i + 1], bO.out, cSteelDark, [side, 0.12, 0], 0.85);
      // Inner face of outer lip
      addQuad(verts, cols, indices, ringSideLow[i], aI.out, bI.out, ringSideLow[i + 1], cUnder, [-side, -0.2, 0], 0.25);
    }

    // Close front & rear endcaps of fender arch
    const first = 0, last = stations.length - 1;
    addQuad(verts, cols, indices, ringOut[first].in, ringOut[first].out, ringIn[first].out, ringIn[first].in, cSteelDark, [0, 0.3, 1], 0.75);
    addQuad(verts, cols, indices, ringOut[last].out, ringOut[last].in, ringIn[last].in, ringIn[last].out, cSteelDark, [0, -0.3, -1], 0.75);

    // Steering knuckle upright & twin fender stay brackets anchored to wheel hub kingpin (rotates with fender!)
    const knX = -side * 0.056;
    addStrut(verts, cols, indices, [knX, 0.000, 0.000], [xInner + side * 0.004, 0.168,  0.032], 0.014, 0.017, cUnder, 0.38);
    addStrut(verts, cols, indices, [knX, 0.000, 0.000], [xInner + side * 0.004, 0.132, -0.102], 0.014, 0.017, cUnder, 0.38);
    addStrut(verts, cols, indices, [-side * 0.044, 0.000, 0.000], [knX - side * 0.010, 0.000, 0.000], 0.024, 0.024, cUnder, 0.38);

    return {
      vertices: new Float32Array(verts),
      colors: new Float32Array(cols),
      indices: new Uint16Array(indices)
    };
  }

  function getOrCreateFrontFenderTemplate(side) {
    if (side < 0) {
      if (!_frontFenderLeftTemplate) _frontFenderLeftTemplate = buildSteerableFrontFenderTemplate(-1);
      return _frontFenderLeftTemplate;
    }
    if (!_frontFenderRightTemplate) _frontFenderRightTemplate = buildSteerableFrontFenderTemplate(1);
    return _frontFenderRightTemplate;
  }

  function emitTemplateMesh(tpl, origin, scale, r, n, f, vertices, colors, indices, isPreview, previewColor) {
    const baseIdx = vertices.length / 3;
    const px = origin[0], py = origin[1], pz = origin[2];
    const rx0 = r[0] * scale, rx1 = r[1] * scale, rx2 = r[2] * scale;
    const ny0 = n[0] * scale, ny1 = n[1] * scale, ny2 = n[2] * scale;
    const fz0 = f[0] * scale, fz1 = f[1] * scale, fz2 = f[2] * scale;

    const tVerts = tpl.vertices;
    const tCols = tpl.colors;
    const tIndices = tpl.indices;

    for (let i = 0; i < tVerts.length; i += 3) {
      const lx = tVerts[i];
      const ly = tVerts[i + 1];
      const lz = tVerts[i + 2];
      vertices.push(
        px + rx0 * lx + ny0 * ly + fz0 * lz,
        py + rx1 * lx + ny1 * ly + fz1 * lz,
        pz + rx2 * lx + ny2 * ly + fz2 * lz
      );
      if (isPreview) {
        colors.push(previewColor[0], previewColor[1], previewColor[2]);
      } else {
        colors.push(tCols[i], tCols[i + 1], tCols[i + 2]);
      }
    }

    const det = (r[1] * n[2] - r[2] * n[1]) * f[0] + (r[2] * n[0] - r[0] * n[2]) * f[1] + (r[0] * n[1] - r[1] * n[0]) * f[2];
    if (det < 0) {
      for (let i = 0; i < tIndices.length; i += 3) {
        indices.push(baseIdx + tIndices[i], baseIdx + tIndices[i + 2], baseIdx + tIndices[i + 1]);
      }
    } else {
      for (let i = 0; i < tIndices.length; i++) {
        indices.push(baseIdx + tIndices[i]);
      }
    }
  }

  function getOrCreateRawCyberCarHull() {
    if (_cyberCarHullTemplate) return _cyberCarHullTemplate;

    const verts = [];
    const cols = [];
    const indices = [];

    // Bright brushed stainless-steel / titanium palette (reads clearly silver day & night!)
    const cSteel      = [0.90, 0.92, 0.95]; // Primary brushed stainless steel
    const cSteelMid   = [0.78, 0.80, 0.84]; // Secondary angled steel facet
    const cSteelDark  = [0.60, 0.62, 0.67]; // Lower recessed / beveled steel
    const cCarbon     = [0.16, 0.17, 0.20]; // Dark matte carbon cockpit & underbody
    const cIntakeDeep = [0.07, 0.08, 0.10]; // Deep intake pocket
    const cGlass      = [0.15, 0.19, 0.25]; // Dark smoked reflective panoramic glass
    const cLedWhite   = [0.99, 1.00, 1.00]; // Crisp white front V-LED lightbar (emissive)
    const cRedTrim    = [0.92, 0.15, 0.18]; // Signature crimson edge accent & tail LED (emissive)
    const cHudCyan    = [0.18, 0.88, 1.00]; // Interior HUD glow strip

    // =========================================================================
    // 1. SHARP FACETED WEDGE NOSE & SLOPING HOOD — WATERTIGHT TO WINDSHIELD & DOOR JAMB!
    // =========================================================================
    const cowlC    = [ 0.000,  0.164,  0.295]; // Exact shared center cowl ridge (hood + windshield glass!)
    const cowlL    = [-0.156,  0.154,  0.285]; // Left cowl corner (A-pillar outer base)
    // Exact collinear point on cowlC -> cowlL at x = -0.130 (t = 0.83333) => ZERO hood-to-windshield gap!
    const cowlInL  = [-0.130,  0.1557, 0.2867];
    const cowlInR  = [ 0.130,  0.1557, 0.2867];
    const hoodMidC = [ 0.000,  0.088,  0.432]; // Center hood ridge
    const hoodMidL = [-0.148,  0.076,  0.415]; // Hood outer shoulder above front wheel

    // LED brow edge (sharp V pointing forward-down)
    const ledC       = [ 0.000,  0.038,  0.514];
    const ledMidL    = [-0.078,  0.044,  0.498];
    const ledOutL    = [-0.142,  0.068,  0.456];
    const ledBotC    = [ 0.000,  0.022,  0.512];
    const ledBotMidL = [-0.076,  0.028,  0.496];
    const ledBotOutL = [-0.138,  0.052,  0.454];

    // Chin & front underbody
    const chinC    = [ 0.000, -0.066,  0.468];
    const chinL    = [-0.122, -0.062,  0.452];

    // STRICTLY COLLINEAR SHARED FRONT DOOR-JAMB VERTICES (exact match with cyber_car_door.js -> ZERO GAP!)
    const jambTopL = [-0.166,  0.144,  0.232]; // Exact front-top door corner!
    const jambMidL = [-0.1684, 0.045,  0.2213]; // Exact collinear midpoint on jambTopL -> jambBotL!
    const jambBotL = [-0.170, -0.022,  0.214]; // Exact front-bottom door meets rocker top!
    const rockFBotL= [-0.166, -0.084,  0.214]; // Exact rocker sill front-bottom!

    // Sloping hood top facets (stitched vertex-for-vertex onto cowlC -> cowlInL -> cowlL!)
    addMirroredQuad(verts, cols, indices, cowlC, cowlInL, hoodMidL, hoodMidC, cSteel, [0, 1, 0.5], 1.0);
    addMirroredTri(verts, cols, indices, cowlInL, cowlL, hoodMidL, cSteel, [-0.15, 0.95, 0.45], 1.0);
    addMirroredTri(verts, cols, indices, hoodMidC, hoodMidL, ledMidL, cSteel, [0, 0.9, 0.55], 1.0);
    addMirroredTri(verts, cols, indices, hoodMidC, ledMidL, ledC, cSteel, [0, 0.9, 0.55], 1.0);
    addMirroredTri(verts, cols, indices, hoodMidL, ledOutL, ledMidL, cSteelMid, [-0.35, 0.8, 0.5], 0.95);

    // Glowing Full-Width V-Shaped White LED Headlight Bar with dark bezel contrast
    const bezTopC    = [ 0.000,  0.043,  0.512];
    const bezTopMidL = [-0.079,  0.049,  0.496];
    const bezTopOutL = [-0.144,  0.073,  0.454];
    addMirroredQuad(verts, cols, indices, bezTopC, bezTopMidL, ledMidL, ledC, cIntakeDeep, [0, 0.2, 1], 0.2);
    addMirroredQuad(verts, cols, indices, bezTopMidL, bezTopOutL, ledOutL, ledMidL, cIntakeDeep, [-0.25, 0.2, 1], 0.2);
    addMirroredQuad(verts, cols, indices, ledC, ledMidL, ledBotMidL, ledBotC, cLedWhite, [0, 0.15, 1], 0);
    addMirroredQuad(verts, cols, indices, ledMidL, ledOutL, ledBotOutL, ledBotMidL, cLedWhite, [-0.25, 0.15, 1], 0);
    const bezBotC    = [ 0.000,  0.017,  0.509];
    const bezBotMidL = [-0.075,  0.023,  0.493];
    const bezBotOutL = [-0.137,  0.047,  0.452];
    addMirroredQuad(verts, cols, indices, ledBotC, ledBotMidL, bezBotMidL, bezBotC, cIntakeDeep, [0, -0.1, 1], 0.2);
    addMirroredQuad(verts, cols, indices, ledBotMidL, ledBotOutL, bezBotOutL, bezBotMidL, cIntakeDeep, [-0.25, -0.1, 1], 0.2);

    // Lower front bumper nose valance
    addMirroredQuad(verts, cols, indices, bezBotC, bezBotMidL, chinL, chinC, cSteelDark, [0, -0.15, 1], 0.85);
    addMirroredTri(verts, cols, indices, bezBotMidL, bezBotOutL, chinL, cSteelDark, [-0.35, -0.1, 0.9], 0.85);

    // Watertight Nose Side Cheeks stitched directly onto cowlL -> jambTopL -> jambMidL -> jambBotL -> rockFBotL!
    addMirroredTri(verts, cols, indices, cowlL, jambTopL, hoodMidL, cSteelMid, [-1, 0.2, 0.2], 0.9);
    addMirroredQuad(verts, cols, indices, jambTopL, jambMidL, bezBotOutL, hoodMidL, cSteelMid, [-1, 0.08, 0.2], 0.9);
    addMirroredTri(verts, cols, indices, hoodMidL, bezBotOutL, ledOutL, cSteelMid, [-1, 0.1, 0.2], 0.9);
    addMirroredQuad(verts, cols, indices, jambMidL, jambBotL, chinL, bezBotOutL, cSteelDark, [-1, -0.18, 0.2], 0.82);
    addMirroredTri(verts, cols, indices, jambBotL, rockFBotL, chinL, cSteelDark, [-1, -0.35, 0.15], 0.80);
    // Exact shared-vertex inward dark-carbon linings on nose cheeks & cowl hood (zero exterior protrusion, zero cabin sky leaks!)
    addMirroredQuad(verts, cols, indices, cowlC, cowlInL, hoodMidL, hoodMidC, cCarbon, [0, -1, -0.5], 0.22);
    addMirroredTri(verts, cols, indices, cowlInL, cowlL, hoodMidL, cCarbon, [0.15, -0.95, -0.45], 0.22);
    addMirroredTri(verts, cols, indices, cowlL, jambTopL, hoodMidL, cCarbon, [1, -0.2, -0.2], 0.22);
    addMirroredQuad(verts, cols, indices, jambTopL, jambMidL, bezBotOutL, hoodMidL, cCarbon, [1, -0.08, -0.2], 0.22);
    addMirroredQuad(verts, cols, indices, jambMidL, jambBotL, chinL, bezBotOutL, cCarbon, [1, 0.18, -0.2], 0.22);
    addMirroredTri(verts, cols, indices, jambBotL, rockFBotL, chinL, cCarbon, [1, 0.35, -0.15], 0.22);

    // Under-nose flat skid plate sealed cleanly to rockFBotL!
    addMirroredQuad(verts, cols, indices, [0, -0.084, 0.214], rockFBotL, chinL, chinC, cCarbon, [0, -1, 0], 0.3);

    // Flush slim dark-carbon door-jamb rabbet seal (tucked strictly inside outer hull & door edge -> ZERO poke-through!)
    const rabTopOutL  = [-0.161,  0.138,  0.230];
    const rabBotOutL  = [-0.163, -0.080,  0.214];
    const rabTopBackL = [-0.159,  0.138,  0.210];
    const rabBotBackL = [-0.161, -0.080,  0.196];
    // Outer + inner faces of narrow jamb seal overlapping behind closed door front edge
    addMirroredQuad(verts, cols, indices, rabTopOutL, rabBotOutL, rabBotBackL, rabTopBackL, cCarbon, [-1, 0, 0], 0.22);
    addMirroredQuad(verts, cols, indices, rabTopOutL, rabTopBackL, rabBotBackL, rabBotOutL, cCarbon, [ 1, 0, 0], 0.22);
    // Solid transverse jamb cap sealing rabbet to inner cabin side wall (x = -0.146)
    addMirroredQuad(verts, cols, indices, rabTopOutL, [-0.146, 0.138, 0.230], [-0.146, -0.080, 0.214], rabBotOutL, cCarbon, [0, 0, -1], 0.22);
    addMirroredQuad(verts, cols, indices, rabTopOutL, rabBotOutL, [-0.146, -0.080, 0.214], [-0.146, 0.138, 0.230], cCarbon, [0, 0,  1], 0.22);

    // =========================================================================
    // 2. STEEP RAKED PANORAMIC WINDSHIELD, A-PILLARS & ROOF FRAME (100% SEALED TO HOOD!)
    // =========================================================================
    const peakL    = [-0.130,  0.362,  0.005];
    const peakR    = [ 0.130,  0.362,  0.005];
    const peakC    = [ 0.000,  0.364,  0.007];
    const peakInL  = [-0.106,  0.344,  0.012];
    const peakInR  = [ 0.106,  0.344,  0.012];
    const peakInC  = [ 0.000,  0.346,  0.015];
    const bTopL    = [-0.138,  0.330, -0.158];
    const bTopR    = [ 0.138,  0.330, -0.158];
    const bTopInL  = [-0.116,  0.314, -0.152];
    const bTopInR  = [ 0.116,  0.314, -0.152];

    // Windshield glass is rendered in the dedicated transparent see-through glass pass (getOrCreateCyberCarGlassTemplate)
    // so both exterior observers and the seated driver can see cleanly through the glass!

    // Sculpted solid metallic A-pillars stitched directly onto cowlL, cowlInL & jambTopL -> peakL!
    // BOTH outer steel AND exact shared-vertex inward carbon lining -> ZERO interior sky leaks!
    const peakBotL = [-0.134, 0.342, -0.006];
    addMirroredQuad(verts, cols, indices, cowlL, cowlInL, peakInL, peakL, cSteel, [-0.15, 0.75, 0.65], 1.0);
    addMirroredQuad(verts, cols, indices, cowlL, cowlInL, peakInL, peakL, cCarbon, [0.15, -0.75, -0.65], 0.22);
    addMirroredQuad(verts, cols, indices, cowlL, peakL, peakBotL, jambTopL, cSteelMid, [-1, 0.2, 0.1], 0.9);
    addMirroredQuad(verts, cols, indices, cowlL, peakL, peakBotL, jambTopL, cCarbon, [ 1, -0.2, -0.1], 0.22);
    addMirroredQuad(verts, cols, indices, jambTopL, peakBotL, peakInL, cowlInL, cCarbon, [0.3, -0.7, -0.6], 0.25);
    addMirroredQuad(verts, cols, indices, jambTopL, peakBotL, peakInL, cowlInL, cCarbon, [-0.3, 0.7, 0.6], 0.25);
    // Seal triangular wedge between cowlL -> jambTopL -> cowlInL (both sides)
    addMirroredTri(verts, cols, indices, cowlL, jambTopL, cowlInL, cCarbon, [0, -1, 0], 0.22);
    addMirroredTri(verts, cols, indices, cowlL, jambTopL, cowlInL, cCarbon, [0,  1, 0], 0.22);

    // Roof peak front header bar & roof top deck (sealed exterior steel + exact shared-vertex inward headliner!)
    addQuad(verts, cols, indices, peakL, peakC, peakInC, peakInL, cSteel, [0, 0.85, 0.5], 1.0);
    addQuad(verts, cols, indices, peakC, peakR, peakInR, peakInC, cSteel, [0, 0.85, 0.5], 1.0);
    addQuad(verts, cols, indices, peakL, peakC, peakInC, peakInL, cCarbon, [0, -0.85, -0.5], 0.22);
    addQuad(verts, cols, indices, peakC, peakR, peakInR, peakInC, cCarbon, [0, -0.85, -0.5], 0.22);
    addQuad(verts, cols, indices, peakInL, peakInR, [0.106, 0.338, -0.005], [-0.106, 0.338, -0.005], cCarbon, [0, -1, 0], 0.25);
    // Exterior roof steel deck
    addTri(verts, cols, indices, peakL, peakC, bTopL, cSteel, [0, 1, -0.2], 1.0);
    addTri(verts, cols, indices, peakC, peakR, bTopR, cSteel, [0, 1, -0.2], 1.0);
    addTri(verts, cols, indices, peakC, bTopR, bTopL, cSteel, [0, 1, -0.2], 1.0);
    // Exact shared-vertex interior roof headliner (100% eliminates sky gap seen from inside cabin!)
    addTri(verts, cols, indices, peakL, peakC, bTopL, cCarbon, [0, -1, 0.2], 0.22);
    addTri(verts, cols, indices, peakC, peakR, bTopR, cCarbon, [0, -1, 0.2], 0.22);
    addTri(verts, cols, indices, peakC, bTopR, bTopL, cCarbon, [0, -1, 0.2], 0.22);
    addQuad(verts, cols, indices, peakBotL, [-peakBotL[0], peakBotL[1], peakBotL[2]], bTopInR, bTopInL, cCarbon, [0, -1, 0], 0.22);

    // Upper side roof rails framing open side window (sealed outer, INNER cabin side, AND underside -> ZERO sky bar!)
    const bTopRailBotL = [-0.138, 0.314, -0.158];
    addMirroredQuad(verts, cols, indices, peakL, bTopL, bTopRailBotL, peakBotL, cSteelMid, [-1, 0.1, 0], 0.9);
    addMirroredQuad(verts, cols, indices, peakL, bTopL, bTopRailBotL, peakBotL, cCarbon,   [ 1, -0.1, 0], 0.22);
    addMirroredQuad(verts, cols, indices, peakBotL, bTopRailBotL, bTopInL, peakInL, cCarbon, [0, -1, 0], 0.22);
    addMirroredQuad(verts, cols, indices, peakBotL, bTopRailBotL, bTopInL, peakInL, cCarbon, [0,  1, 0], 0.22);
    // Seal inner side gap between bTopL -> bTopInL -> bTopRailBotL
    addMirroredTri(verts, cols, indices, bTopL, bTopRailBotL, bTopInL, cCarbon, [0, 0, 1], 0.22);
    addMirroredTri(verts, cols, indices, bTopL, bTopRailBotL, bTopInL, cCarbon, [0, 0, -1], 0.22);

    // =========================================================================
    // 3. WATERTIGHT COCKPIT FLOOR TUB, FOOTWELL FIREWALL, CONSOLE & 3D INTAKE SILL
    // =========================================================================
    const tubFL = [-0.166, -0.084,  0.214];
    const tubRL = [-0.168, -0.084, -0.175];
    const tubFR = [ 0.166, -0.084,  0.214];
    const tubRR = [ 0.168, -0.084, -0.175];

    // Underbody bottom floor & tapered watertight interior cabin floor (strictly inside tapered nose hull!)
    addQuad(verts, cols, indices, tubFL, tubFR, tubRR, tubRL, cCarbon, [0, -1, 0], 0.25);
    // Main cabin floor (door jamb back to rear bulkhead)
    addQuad(
      verts, cols, indices,
      [-0.158, -0.066,  0.214],
      [ 0.158, -0.066,  0.214],
      [ 0.162, -0.066, -0.175],
      [-0.162, -0.066, -0.175],
      cCarbon, [0, 1, 0], 0.25
    );
    addQuad(
      verts, cols, indices,
      [-0.158, -0.072,  0.214],
      [ 0.158, -0.072,  0.214],
      [ 0.162, -0.072, -0.175],
      [-0.162, -0.072, -0.175],
      cCarbon, [0, -1, 0], 0.22
    );
    // Tapered front footwell floor (narrowed to ±0.146 at z = 0.274 -> strictly inside outer nose cheeks!)
    addQuad(
      verts, cols, indices,
      [-0.146, -0.066, 0.274],
      [ 0.146, -0.066, 0.274],
      [ 0.158, -0.066, 0.214],
      [-0.158, -0.066, 0.214],
      cCarbon, [0, 1, 0], 0.25
    );
    addQuad(
      verts, cols, indices,
      [-0.146, -0.072, 0.274],
      [ 0.146, -0.072, 0.274],
      [ 0.158, -0.072, 0.214],
      [-0.158, -0.072, 0.214],
      cCarbon, [0, -1, 0], 0.22
    );

    // WATERTIGHT FRONT FOOTWELL FIREWALL BULKHEAD & UPPER COWL SHELF (strictly inside outer nose & hood!)
    addQuad(
      verts, cols, indices,
      [-0.146, -0.070, 0.274], [ 0.146, -0.070, 0.274],
      [ 0.146,  0.146, 0.280], [-0.146,  0.146, 0.280],
      cCarbon, [0, 0.1, -1], 0.22
    );
    addQuad(
      verts, cols, indices,
      [-0.146, -0.070, 0.274], [ 0.146, -0.070, 0.274],
      [ 0.146,  0.146, 0.280], [-0.146,  0.146, 0.280],
      cCarbon, [0, -0.1, 1], 0.22
    );
    // Upper dashboard-to-windshield cowl deck (tucked strictly below hood cowlL & windshield glass!)
    addMirroredQuad(verts, cols, indices, [-0.142, 0.134, 0.198], [0, 0.138, 0.198], [0, 0.156, 0.286], [-0.146, 0.146, 0.280], cCarbon, [0, 1, -0.15], 0.22);
    addMirroredQuad(verts, cols, indices, [-0.142, 0.134, 0.198], [0, 0.138, 0.198], [0, 0.156, 0.286], [-0.146, 0.146, 0.280], cCarbon, [0, -1, 0.15], 0.22);

    // Tapered Left & Right inner footwell side walls (strictly INSIDE outer nose cheeks & ending at door jamb — ZERO poke-through!)
    addMirroredQuad(
      verts, cols, indices,
      [-0.144, -0.070, 0.274], [-0.148, -0.070, 0.212],
      [-0.148,  0.136, 0.224], [-0.144,  0.146, 0.280],
      cCarbon, [1, 0, 0], 0.22
    );
    // Lower under-dash side kick-panel (stays strictly below dashboard edge y = 0.056!)
    addMirroredQuad(
      verts, cols, indices,
      [-0.148, -0.070, 0.214], [-0.148, -0.070, 0.178],
      [-0.148,  0.056, 0.178], [-0.148,  0.056, 0.214],
      cCarbon, [1, 0, 0], 0.22
    );

    // Interior Dashboard Console + Sealed Lower Under-Dash Apron + Central Tunnel + Glowing Cyan HUD Strip
    addHex(
      verts, cols, indices,
      [-0.145, 0.048, 0.276], [0.145, 0.048, 0.276], [0.145, 0.146, 0.278], [-0.145, 0.146, 0.278],
      [-0.144, 0.056, 0.178], [0.144, 0.056, 0.178], [0.142, 0.134, 0.198], [-0.142, 0.134, 0.198],
      cCarbon, 0.3
    );
    // Lower vertical center console waterfall connecting dashboard bottom down into cabin floor!
    addHex(
      verts, cols, indices,
      [-0.042, -0.068, 0.276], [0.042, -0.068, 0.276], [0.042, 0.060, 0.276], [-0.042, 0.060, 0.276],
      [-0.036, -0.068, 0.172], [0.036, -0.068, 0.172], [0.038, 0.060, 0.185], [-0.038, 0.060, 0.185],
      cIntakeDeep, 0.35
    );
    // Low center spine tunnel running back along floor to seat base
    addHex(
      verts, cols, indices,
      [-0.034, -0.068, 0.175], [0.034, -0.068, 0.175], [0.028, -0.032, 0.175], [-0.028, -0.032, 0.175],
      [-0.034, -0.068, -0.158], [0.034, -0.068, -0.158], [0.028, -0.032, -0.158], [-0.028, -0.032, -0.158],
      cIntakeDeep, 0.3
    );
    // Glowing Cyan Cockpit HUD Display Strip
    addQuad(
      verts, cols, indices,
      [-0.075, 0.105, 0.188], [0.075, 0.105, 0.188], [0.075, 0.128, 0.194], [-0.075, 0.128, 0.194],
      cHudCyan, [0, 0.2, -1], 0
    );

    // Full-Height Watertight Two-Tier Rear Cockpit Firewall Bulkhead
    // Lower tier (y = -0.070..0.186): Front cabin plane (z = -0.156) stays strictly inside lower flanks;
    // Rear wheel-well plane (z = -0.195) tapers cleanly to exact C-notch cradle inner width (|x| = 0.114..0.132) -> ZERO poke-through!
    addHex(
      verts, cols, indices,
      [-0.152, -0.070, -0.156], [ 0.152, -0.070, -0.156], [ 0.152,  0.186, -0.156], [-0.152,  0.186, -0.156],
      [-0.114, -0.070, -0.195], [ 0.114, -0.070, -0.195], [ 0.132,  0.186, -0.195], [-0.132,  0.186, -0.195],
      cCarbon, 0.25
    );
    // Upper tier (y = 0.186..0.326): Sloped cleanly along exact C-pillar quarter-window rear edge (bTopL -> hipTopL)!
    // This connects BOTH rear quarter triangular windows directly into the cockpit AND 100% seals off the hollow fastback tail cavity!
    addHex(
      verts, cols, indices,
      [-0.172,  0.186, -0.188], [ 0.172,  0.186, -0.188], [ 0.136,  0.326, -0.158], [-0.136,  0.326, -0.158],
      [-0.170,  0.186, -0.195], [ 0.170,  0.186, -0.195], [ 0.135,  0.324, -0.166], [-0.135,  0.324, -0.166],
      cCarbon, 0.25
    );
    // Interior horizontal parcel-shelf ledge & quarter-window beltline sill sealing lower firewall (z=-0.156) cleanly to upper sloped firewall (z=-0.188)
    addQuad(
      verts, cols, indices,
      [-0.152, 0.186, -0.156], [ 0.152, 0.186, -0.156],
      [ 0.172, 0.186, -0.188], [-0.172, 0.186, -0.188],
      cCarbon, [0,  1, 0], 0.25
    );
    addQuad(
      verts, cols, indices,
      [-0.152, 0.186, -0.156], [ 0.152, 0.186, -0.156],
      [ 0.172, 0.186, -0.188], [-0.172, 0.186, -0.188],
      cCarbon, [0, -1, 0], 0.22
    );
    // Seal thin headliner header strip between sloped upper firewall top (y = 0.326, z = -0.158) and roof headliner
    addQuad(
      verts, cols, indices,
      [-0.136, 0.326, -0.158], [ 0.136, 0.326, -0.158],
      [ 0.116, 0.314, -0.152], [-0.116, 0.314, -0.152],
      cCarbon, [0, -1, 0.2], 0.22
    );

    // === LOWER SIDE ROCKER SILL WITH PROTRUDING SCULPTED 3D SIDE AIR-INTAKE SCOOP POD (BULGES OUTWARD LIKE DOOR!) ===
    const sillRBotL = [-0.172, -0.084, -0.175];
    const sillMTopL = [-0.182, -0.016,  0.025]; // Exact match with door pRB!
    const sillRTopL = [-0.184,  0.036, -0.106]; // Exact match with door pRM & bladeMidL!
    const sillMBotL = [-0.170, -0.084,  0.025];

    // Watertight inner rocker sill backing panel (keeps lower side hull 100% sealed behind protruding intake pod!)
    addMirroredQuad(verts, cols, indices, rockFBotL, jambBotL, sillMTopL, sillMBotL, cSteelMid, [-1, -0.1, 0], 0.90);
    addMirroredQuad(verts, cols, indices, rockFBotL, jambBotL, sillMTopL, sillMBotL, cCarbon,   [ 1,  0.1, 0], 0.22);
    // Sealed inner cabin wall behind rear half of sill
    addMirroredQuad(verts, cols, indices, sillMBotL, sillMTopL, sillRTopL, sillRBotL, cCarbon,   [ 1,  0.0, 0], 0.22);

    // PROTRUDING ORIGAMI SIDE AIR-INTAKE POD (bulges outward to x = ±0.214 matching the sculpted origami door!)
    // Forward tapered aero wedge nose starting cleanly on the lower rocker sill (z = +0.148)
    const podNoseL    = [-0.172, -0.082,  0.148];
    // Outward-bulging outer cowl corners (protrudes +0.030..+0.038 beyond rocker sill!)
    const podMouthTL  = [-0.206, -0.020,  0.018]; // Protruding front-top scoop brow
    const podMouthBL  = [-0.206, -0.082,  0.018]; // Protruding front-bottom splitter chin
    const podCrestTL  = [-0.215,  0.024, -0.088]; // Boldest protruding rear-top fairing crest
    const podCrestBL  = [-0.214, -0.082, -0.094]; // Boldest protruding rear-bottom flank

    // Carved inner lip of the protruding scoop mouth (gives real thick beveled 3D metal cowl lip!)
    const thOutTL     = [-0.197, -0.026,  0.014];
    const thOutBL     = [-0.197, -0.075,  0.014];
    const thOutTR     = [-0.204,  0.016, -0.081];
    const thOutBR     = [-0.204, -0.075, -0.086];

    // Deep recessed radiator core plane tucked inside body (total 3D cavity depth = 0.050!)
    const thDepTL     = [-0.156, -0.026,  0.004];
    const thDepBL     = [-0.156, -0.074,  0.004];
    const thDepTR     = [-0.156,  0.014, -0.076];
    const thDepBR     = [-0.156, -0.074, -0.082];

    // 1. FORWARD PROTRUDING AERO WEDGE RAMP (sweeps smoothly outward from sill into the protruding intake pod!)
    // Bright upper sloped origami facet catching overhead sky light (mirrors the door's faceted steel!)
    addMirroredTri(verts, cols, indices, podNoseL, sillMTopL, podMouthTL, cSteel,    [-0.70,  0.58, 0.42], 0.96);
    // Outer forward flared steel wedge side
    addMirroredTri(verts, cols, indices, podNoseL, podMouthTL, podMouthBL, cSteelMid, [-0.90, -0.08, 0.42], 0.92);
    // Bottom horizontal splitter lip under wedge
    addMirroredTri(verts, cols, indices, podNoseL, podMouthBL, sillMBotL,  cCarbon,   [ 0.00, -1.00, 0.00], 0.30);

    // 2. PROTRUDING OUTER SCOOP COWL SHELL (Upper Brow, Bottom Splitter Floor & Swept Rear Fairing Cheek!)
    // Bright upper protruding scoop roof sloping outward from door bottom crease (sillMTopL->sillRTopL) to outer brow!
    addMirroredQuad(verts, cols, indices, sillMTopL, sillRTopL, podCrestTL, podMouthTL, cSteel,     [-0.55,  0.82, 0.14], 0.98);
    // Bottom protruding splitter shelf underneath scoop pod
    addMirroredQuad(verts, cols, indices, sillMBotL, podMouthBL, podCrestBL, sillRBotL, cCarbon,    [ 0.00, -1.00, 0.00], 0.30);
    // Rear swept aero cheek fairing tapering smoothly from protruding crest back into rear haunch blade!
    addMirroredQuad(verts, cols, indices, podCrestTL, sillRTopL, sillRBotL, podCrestBL, cSteelDark, [-0.72, -0.10, -0.68], 0.88);

    // 3. THICK BEVELED BRUSHED-STEEL MOUTH BEZEL (4 mitered outer frame faces framing the carved 3D opening!)
    // Top beveled lip
    addMirroredQuad(verts, cols, indices, podMouthTL, podCrestTL, thOutTR, thOutTL, cSteelMid,  [-0.86, -0.42, 0.28], 0.92);
    // Bottom beveled lip
    addMirroredQuad(verts, cols, indices, podMouthBL, thOutBL, thOutBR, podCrestBL, cSteelMid,  [-0.86,  0.48, 0.12], 0.90);
    // Front vertical aero intake lip
    addMirroredQuad(verts, cols, indices, podMouthBL, podMouthTL, thOutTL, thOutBL, cSteelDark, [-0.82,  0.00, -0.56], 0.86);
    // Rear vertical shroud pillar
    addMirroredQuad(verts, cols, indices, thOutBR, thOutTR, podCrestTL, podCrestBL, cSteelMid,  [-0.88,  0.05,  0.46], 0.92);

    // 4. DEEP 3D RECESSED INTAKE DUCT CAVITY WALLS (x = -0.204 deep inward to radiator core x = -0.156!)
    // Deep matte-black radiator core backplate
    addMirroredQuad(verts, cols, indices, thDepBL, thDepTL, thDepTR, thDepBR, cIntakeDeep, [-1, 0, 0], 0.14);
    // Bottom metallic intake floor shelf
    addMirroredQuad(verts, cols, indices, thOutBL, thDepBL, thDepBR, thOutBR, cSteelDark,  [-0.12,  1.0, 0.0], 0.72);
    // Top dark inner duct ceiling
    addMirroredQuad(verts, cols, indices, thOutTL, thOutTR, thDepTR, thDepTL, cCarbon,     [-0.12, -1.0, 0.0], 0.35);
    // Front angled intake guide ramp (curves airflow deep into radiator!)
    addMirroredQuad(verts, cols, indices, thOutBL, thOutTL, thDepTL, thDepBL, cSteelDark,  [-0.42,  0.0, -0.90], 0.75);
    // Rear vertical intake duct wall
    addMirroredQuad(verts, cols, indices, thOutBR, thDepBR, thDepTR, thOutTR, cCarbon,     [-0.35,  0.0,  0.92], 0.40);

    // 5. 3D HORIZONTAL GUNMETAL AERO COOLING LOUVER FINS + VERTICAL SPLITTER VANE INSIDE PROTRUDING DUCT!
    for (let s of [-1, 1]) {
      // Lower horizontal aero louver blade protruding cleanly inside the deep scoop
      addHex(
        verts, cols, indices,
        [s * 0.158, -0.057,  0.006], [s * 0.198, -0.057,  0.012], [s * 0.198, -0.050,  0.012], [s * 0.158, -0.050,  0.006],
        [s * 0.158, -0.057, -0.080], [s * 0.202, -0.057, -0.084], [s * 0.202, -0.050, -0.084], [s * 0.158, -0.050, -0.080],
        [0.32, 0.34, 0.38], 0.80
      );
      // Upper horizontal aero louver blade
      addHex(
        verts, cols, indices,
        [s * 0.158, -0.036,  0.006], [s * 0.199, -0.036,  0.012], [s * 0.199, -0.029,  0.012], [s * 0.158, -0.029,  0.006],
        [s * 0.158, -0.036, -0.078], [s * 0.203, -0.036, -0.082], [s * 0.203, -0.029, -0.082], [s * 0.158, -0.029, -0.078],
        [0.32, 0.34, 0.38], 0.80
      );
      // Angled mid vertical aero splitter vane inside protruding scoop
      addHex(
        verts, cols, indices,
        [s * 0.158, -0.073, -0.032], [s * 0.204, -0.074, -0.029], [s * 0.205, -0.003, -0.029], [s * 0.158, -0.006, -0.032],
        [s * 0.158, -0.073, -0.041], [s * 0.204, -0.074, -0.038], [s * 0.205, -0.003, -0.038], [s * 0.158, -0.006, -0.041],
        [0.40, 0.43, 0.48], 0.85
      );
    }

    // 6. SCULPTED 3D CRIMSON RED ACCENT TRIM HUGGING THE PROTRUDING SIDE SCOOP POD!
    for (let s of [-1, 1]) {
      const tNose = [s * 0.173, -0.081,  0.148];
      const tMB   = [s * 0.207, -0.081,  0.018];
      const tCB   = [s * 0.215, -0.081, -0.094];
      const tCT   = [s * 0.216,  0.024, -0.088];
      const tMT   = [s * 0.207, -0.020,  0.018];
      addTrimStrip(verts, cols, indices, tNose, tMB, 0.0046, cRedTrim);
      addTrimStrip(verts, cols, indices, tMB,   tCB, 0.0046, cRedTrim);
      addTrimStrip(verts, cols, indices, tCB,   tCT, 0.0046, cRedTrim);
      addTrimStrip(verts, cols, indices, tCT,   tMT, 0.0046, cRedTrim);
      addTrimStrip(verts, cols, indices, tMT, tNose, 0.0046, cRedTrim);
    }

    // Inner sill top step & continuous inner door-frame rabbet (tucked strictly inside outer hull -> zero poke-through!)
    addMirroredQuad(verts, cols, indices, jambBotL, [-0.148, -0.030, 0.214], [-0.148, -0.030, -0.156], [-0.158, -0.024, -0.156], cCarbon, [0, 1, 0], 0.3);
    addMirroredQuad(verts, cols, indices, [-0.148, -0.068, 0.214], [-0.148, -0.030, 0.214], [-0.148, -0.030, -0.156], [-0.148, -0.068, -0.156], cCarbon, [1, 0, 0], 0.25);

    // =========================================================================
    // 4. B-PILLAR, REAR QUARTER WINDOW, CANTILEVERED FASTBACK TAIL & C-NOTCH ENGINE CRADLE BAY
    //    Sculpted upper brow + recessed notch + lower chin wing cradle the Swingarm-Mounted Engine!
    // =========================================================================
    const tailTipL    = [-0.164,  0.268, -0.538];
    const tailTipR    = [ 0.164,  0.268, -0.538];
    const tailTipC    = [ 0.000,  0.274, -0.546];
    const tailMidL    = [-0.144,  0.208, -0.492];
    const tailMidR    = [ 0.144,  0.208, -0.492];
    const tailMidC    = [ 0.000,  0.214, -0.506];
    const tailUnderL  = [-0.128,  0.198, -0.402];
    const tailUnderR  = [ 0.128,  0.198, -0.402];

    // Rear shoulder, hip crease & sculpted C-Notch Engine Cradle (exact shared seam with rear of door!)
    const hipTopL       = [-0.176,  0.186, -0.188]; // Door rear-top corner meets this EXACT vertex!
    const bladeMidL     = [-0.184,  0.036, -0.106]; // Same vertex as sillRTopL! Zero seam crack!
    const hipRearL      = [-0.182,  0.208, -0.282]; // Mid-quarter sharp origami crease point
    const haunchMidL    = [-0.172,  0.074, -0.258]; // Upper armored Engine Cradle Brow overhanging engine nose
    const cradleNotchTL = [-0.162,  0.042, -0.212]; // Recessed upper-front corner of C-notch pocket
    const cradleNotchBL = [-0.160, -0.044, -0.208]; // Recessed lower-front corner of C-notch pocket
    const haunchBotL    = [-0.166, -0.074, -0.246]; // Lower armored Engine Cradle Chin Wing supporting underside
    const archShroudL   = [-0.128,  0.120, -0.286]; // Rear wheel-arch chamfered inner cheek under tail overhang
    const cradleBrowInL = [-0.122,  0.072, -0.246]; // Inner edge of upper cradle brow
    const cradleTopInL  = [-0.116,  0.044, -0.204]; // Recessed metallic upper socket rim
    const cradleBotInL  = [-0.114, -0.044, -0.202]; // Recessed metallic lower socket rim
    const cradleChinInL = [-0.118, -0.072, -0.236]; // Inner edge of lower cradle chin wing

    // Triangular rear quarter window opening (transparent glass rendered in getOrCreateCyberCarGlassTemplate!)
    const bWinFrontBotL = [-0.168, 0.186, -0.128];

    // Flush-inset slim structural B-pillar divider bar separating door glass & rear quarter cockpit glass (ZERO obstruction!)
    for (let s of [-1, 1]) {
      const topOutF = [s * 0.136, 0.324, -0.151];
      const topOutR = [s * 0.137, 0.326, -0.158];
      const topInR  = [s * 0.126, 0.318, -0.158];
      const topInF  = [s * 0.126, 0.318, -0.150];
      const botOutF = [s * 0.166, 0.186, -0.124];
      const botOutR = [s * 0.168, 0.186, -0.133];
      const botInR  = [s * 0.156, 0.186, -0.135];
      const botInF  = [s * 0.156, 0.186, -0.126];
      addHex(
        verts, cols, indices,
        topOutF, topOutR, topInR, topInF,
        botOutF, botOutR, botInR, botInF,
        cCarbon, 0.28
      );
    }

    // Recessed lower rear door-jamb pocket & quarter-window horizontal sill shelf (strictly inside hipTopL -> bladeMidL -> sillMTopL!)
    addMirroredQuad(verts, cols, indices, [-0.172, 0.185, -0.182], [-0.174, 0.036, -0.106], [-0.152, 0.036, -0.156], [-0.152, 0.186, -0.156], cCarbon, [ 0.5, 0,  0.85], 0.22);
    addMirroredQuad(verts, cols, indices, [-0.172, 0.185, -0.182], [-0.174, 0.036, -0.106], [-0.152, 0.036, -0.156], [-0.152, 0.186, -0.156], cCarbon, [-0.5, 0, -0.85], 0.22);
    addMirroredTri(verts, cols, indices,  bWinFrontBotL, [-0.174, 0.186, -0.188], [-0.152, 0.186, -0.156], cCarbon, [0,  1, 0], 0.25);
    addMirroredTri(verts, cols, indices,  bWinFrontBotL, [-0.174, 0.186, -0.188], [-0.152, 0.186, -0.156], cCarbon, [0, -1, 0], 0.22);
    addMirroredQuad(verts, cols, indices, [-0.174, 0.036, -0.106], [-0.160, -0.024, -0.156], [-0.152, -0.026, -0.156], [-0.152, 0.036, -0.156], cCarbon, [ 0.4, 0.2,  0.88], 0.22);
    addMirroredQuad(verts, cols, indices, [-0.174, 0.036, -0.106], [-0.160, -0.024, -0.156], [-0.152, -0.026, -0.156], [-0.152, 0.036, -0.156], cCarbon, [-0.4,-0.2, -0.88], 0.22);

    // Main Top Fastback Deck
    addQuad(verts, cols, indices, bTopL, bTopR, tailTipR, tailTipL, cSteel, [0, 1, -0.25], 1.0);
    addTri(verts, cols, indices, tailTipL, tailTipR, tailTipC, cSteel, [0, 1, -0.25], 1.0);

    // Upper Fastback Side Quarter Panel & Lower Tail Undercut Side Facets
    addMirroredQuad(verts, cols, indices, bTopL, tailTipL, hipRearL, hipTopL, cSteel, [-0.92, 0.40, -0.12], 1.0);
    addMirroredQuad(verts, cols, indices, bTopL, tailTipL, hipRearL, hipTopL, cCarbon, [ 0.92, -0.40,  0.12], 0.22);
    addMirroredTri(verts, cols, indices, tailTipL, tailMidL, hipRearL, cSteelMid, [-0.85, -0.35, -0.35], 0.9);
    addMirroredTri(verts, cols, indices, tailMidL, tailUnderL, hipRearL, cSteelDark, [-0.75, -0.55, -0.25], 0.85);

    // Sculpted Diagonal Metallic Blade & C-Notch Rear Quarter Flank (Watertight shared seams + exact inward carbon linings!)
    addMirroredQuad(verts, cols, indices, hipTopL, hipRearL, haunchMidL, bladeMidL, cSteelMid, [-1, 0.10, 0.15], 0.92);
    addMirroredQuad(verts, cols, indices, hipTopL, hipRearL, haunchMidL, bladeMidL, cCarbon,   [ 1,-0.10,-0.15], 0.22);
    addMirroredTri(verts, cols, indices, bladeMidL, haunchMidL, cradleNotchTL, cSteelMid, [-1, -0.05, 0.12], 0.90);
    addMirroredTri(verts, cols, indices, bladeMidL, cradleNotchTL, cradleNotchBL, cSteelDark, [-1, -0.15, 0.10], 0.86);
    addMirroredQuad(verts, cols, indices, bladeMidL, cradleNotchBL, haunchBotL, sillRBotL, cSteelDark, [-1, -0.28, 0.10], 0.86);
    addMirroredQuad(verts, cols, indices, bladeMidL, cradleNotchBL, haunchBotL, sillRBotL, cCarbon,    [ 1,  0.28,-0.10], 0.22);

    // Sculpted Rear Wheel-Arch Cowling & C-Notch Recessed Engine Cradle Shroud (Watertight from OUTSIDE AND INSIDE rear wheel-well!)
    addMirroredQuad(verts, cols, indices, hipRearL, tailUnderL, archShroudL, haunchMidL, cSteelMid, [-0.88, -0.10, -0.45], 0.92);
    // Inward wheel-well lining of rear wheel-arch cowling so looking forward from behind is 100% solid!
    addMirroredQuad(verts, cols, indices, hipRearL, tailUnderL, archShroudL, haunchMidL, cCarbon, [ 0.88,  0.10,  0.45], 0.24);
    // Upper armored brow bevel overhanging the engine's forward nose
    addMirroredTri(verts, cols, indices, haunchMidL, archShroudL, cradleBrowInL, cSteelDark, [-0.30, -0.78, -0.54], 0.82);
    addMirroredQuad(verts, cols, indices, haunchMidL, cradleBrowInL, cradleTopInL, cradleNotchTL, cSteelDark, [-0.25, -0.85, -0.45], 0.84);
    // Recessed vertical cradle notch back-cheek (hugs engine prow & cyan HV glow!)
    addMirroredQuad(verts, cols, indices, cradleNotchTL, cradleTopInL, cradleBotInL, cradleNotchBL, cSteelDark, [-0.28, 0.0, -0.96], 0.84);
    // Lower armored chin wing upper shelf (cradles underside of engine forward nose!)
    addMirroredQuad(verts, cols, indices, cradleNotchBL, cradleBotInL, cradleChinInL, haunchBotL, cSteelMid, [-0.25, 0.88, -0.40], 0.88);
    // Inner recessed dark carbon cradle socket walls (BOTH inward +X into rear wheel-well AND outward -X -> 100% watertight!)
    const bulkTopL   = [-0.136,  0.194, -0.195];
    const bulkBrowL  = [-0.122,  0.072, -0.195];
    const bulkTopInL = [-0.116,  0.044, -0.195];
    const bulkBotInL = [-0.114, -0.044, -0.195];
    const bulkChinL  = [-0.118, -0.072, -0.195];
    addMirroredQuad(verts, cols, indices, cradleTopInL,  bulkTopInL, bulkBotInL, cradleBotInL,  cCarbon, [ 0.95,  0.00, -0.30], 0.28);
    addMirroredQuad(verts, cols, indices, cradleTopInL,  bulkTopInL, bulkBotInL, cradleBotInL,  cCarbon, [-0.95,  0.00,  0.30], 0.24);
    addMirroredQuad(verts, cols, indices, cradleBrowInL, bulkBrowL,  bulkTopInL, cradleTopInL,  cCarbon, [ 0.85, -0.42, -0.30], 0.28);
    addMirroredQuad(verts, cols, indices, cradleBrowInL, bulkBrowL,  bulkTopInL, cradleTopInL,  cCarbon, [-0.85,  0.42,  0.30], 0.24);
    addMirroredQuad(verts, cols, indices, cradleBotInL,  bulkBotInL, bulkChinL,  cradleChinInL, cCarbon, [ 0.85,  0.42, -0.30], 0.28);
    addMirroredQuad(verts, cols, indices, cradleBotInL,  bulkBotInL, bulkChinL,  cradleChinInL, cCarbon, [-0.85, -0.42,  0.30], 0.24);
    // Seal upper inner wheel-well arch cheek cleanly onto rear bulkhead (inward +X into wheel well!)
    addMirroredQuad(verts, cols, indices, archShroudL, bulkTopL, bulkBrowL, cradleBrowInL, cCarbon, [ 0.90, -0.22, -0.36], 0.28);
    addMirroredQuad(verts, cols, indices, archShroudL, bulkTopL, bulkBrowL, cradleBrowInL, cCarbon, [-0.90,  0.22,  0.36], 0.24);
    // Seal underside rear chassis floor & lower chin wing bottom cleanly to rear bulkhead
    addMirroredQuad(verts, cols, indices, sillRBotL, haunchBotL, cradleChinInL, bulkChinL, cCarbon, [0, -1, 0], 0.25);
    addMirroredQuad(verts, cols, indices, sillRBotL, haunchBotL, cradleChinInL, bulkChinL, cCarbon, [0,  1, 0], 0.22);
    addMirroredQuad(verts, cols, indices, sillRBotL, bulkChinL, [0, -0.072, -0.195], [0, -0.084, -0.175], cCarbon, [0, -0.95, -0.25], 0.25);

    // Rear Transom Diamond Facets (View 2 Rear View!)
    addTri(verts, cols, indices, tailTipL, tailTipC, tailMidC, cSteelMid, [0, -0.18, -1], 0.95);
    addTri(verts, cols, indices, tailTipC, tailTipR, tailMidC, cSteelMid, [0, -0.18, -1], 0.95);
    addTri(verts, cols, indices, tailTipL, tailMidC, tailMidL, cSteelDark, [-0.3, -0.25, -0.95], 0.85);
    addTri(verts, cols, indices, tailTipR, tailMidR, tailMidC, cSteelDark, [ 0.3, -0.25, -0.95], 0.85);

    // Underside dark diffuser panel & high rear wheel-well ceiling clearing rear wheel cleanly!
    addTri(verts, cols, indices, tailMidL, tailMidC, tailUnderL, cCarbon, [0, -0.85, -0.45], 0.35);
    addTri(verts, cols, indices, tailMidC, tailMidR, tailUnderR, cCarbon, [0, -0.85, -0.45], 0.35);
    addQuad(verts, cols, indices, tailMidC, tailUnderR, [0.0, 0.196, -0.370], tailUnderL, cCarbon, [0, -0.92, -0.35], 0.35);
    addQuad(verts, cols, indices, tailUnderL, tailUnderR, [0.136, 0.194, -0.195], [-0.136, 0.194, -0.195], cCarbon, [0, -1, 0], 0.2);
    // Close left/right upper wheel-well side walls between tailUnderL, archShroudL & rear bulkhead (strictly INWARD +X into wheel-well!)
    addMirroredTri(verts, cols, indices, tailUnderL, archShroudL, bulkTopL, cCarbon, [ 0.96, -0.28, 0.0], 0.24);
    addMirroredTri(verts, cols, indices, tailUnderL, archShroudL, bulkTopL, cCarbon, [-0.96,  0.28, 0.0], 0.22);

    // =========================================================================
    // 5. FLUSH LASER-THIN CRIMSON RED TRIM LINES & TAIL LEDS (Exact Shared Endpoints!)
    // =========================================================================
    for (let s of [-1, 1]) {
      // Glowing red LED tail bar along top outer tail lip
      addTrimStrip(verts, cols, indices, [s * 0.164, 0.268, -0.539], [s * 0.085, 0.271, -0.543], 0.006, cRedTrim);
      // Upper shoulder crease line (exact tailTip -> hipRear)
      addTrimStrip(verts, cols, indices, [s * 0.165, 0.266, -0.537], [s * 0.183, 0.208, -0.282], 0.0045, cRedTrim);
      // Lower tail fin crease line (exact tailMid -> hipRear, flush so zero overhang!)
      addTrimStrip(verts, cols, indices, [s * 0.145, 0.208, -0.492], [s * 0.183, 0.208, -0.282], 0.0045, cRedTrim);
      // Rear wheel arch & C-Notch Engine Cradle crimson trim framing the engine docking pocket!
      addTrimStrip(verts, cols, indices, [s * 0.183, 0.208, -0.282], [s * 0.173,  0.074, -0.258], 0.0045, cRedTrim);
      addTrimStrip(verts, cols, indices, [s * 0.173, 0.074, -0.258], [s * 0.163,  0.042, -0.212], 0.0042, cRedTrim);
      addTrimStrip(verts, cols, indices, [s * 0.163, 0.042, -0.212], [s * 0.161, -0.044, -0.208], 0.0042, cRedTrim);
      addTrimStrip(verts, cols, indices, [s * 0.161,-0.044, -0.208], [s * 0.167, -0.074, -0.246], 0.0042, cRedTrim);
      addTrimStrip(verts, cols, indices, [s * 0.167,-0.074, -0.246], [s * 0.173, -0.083, -0.175], 0.0042, cRedTrim);
      // Diagonal door-behind blade crimson slash (exact hipTop -> bladeMid -> sillRBot)
      addTrimStrip(verts, cols, indices, [s * 0.177, 0.186, -0.188], [s * 0.185,  0.036, -0.106], 0.0045, cRedTrim);
      addTrimStrip(verts, cols, indices, [s * 0.185, 0.036, -0.106], [s * 0.173, -0.082, -0.175], 0.0045, cRedTrim);
    }

    // =========================================================================
    // 6. REALISTIC DOUBLE-WISHBONE & EXPOSED 3D COILOVER FRONT SUSPENSION
    //    Wide-V upper A-arm cleanly straddles the Coilover (zero spring collision!),
    //    billet shock-tower outrigger & lower cross-saddle U-clevis forks grip both
    //    coilover eyelets with horizontal pivot bolts, linked by a vertical hub upright!
    // =========================================================================
    const cCoilSpring = [0.88, 0.14, 0.18]; // Anodized crimson racing coil spring
    const cCoilBody   = [0.22, 0.24, 0.28]; // Gunmetal billet damper housing
    const cCoilChrome = [0.88, 0.91, 0.96]; // Polished chrome piston shaft & hardware
    const cArmMetal   = [0.34, 0.36, 0.41]; // Forged billet suspension brackets & upright
    const cGoldBolt   = [0.78, 0.62, 0.30]; // Anodized ball-joint collar & bushing accents
    for (let s of [-1, 1]) {
      const mkBox = (x0, x1, y0, y1, z0, z1, col, met) => {
        const ax = s * x0, bx = s * x1;
        const lx = Math.min(ax, bx), hx = Math.max(ax, bx);
        addHex(
          verts, cols, indices,
          [lx, y0, z0], [hx, y0, z0], [hx, y1, z0], [lx, y1, z0],
          [lx, y0, z1], [hx, y0, z1], [hx, y1, z1], [lx, y1, z1],
          col, met
        );
      };

      // --- A. UPPER CHASSIS SHOCK-TOWER OUTRIGGER + TWIN CLEVIS EARS + HORIZONTAL PIVOT BOLT ---
      const shTopX = 0.164, shTopY = 0.086, shZ = 0.336;
      const shBotX = 0.180, shBotY = -0.034;
      // Structural forged gusset bracket emerging solidly out of upper nose cheek
      mkBox(0.118, 0.162, 0.078, 0.098, shZ - 0.020, shZ + 0.020, cArmMetal, 0.88);
      // Angled lower triangulation web bracing the outrigger into the nose bulkhead
      addStrut(verts, cols, indices, [s * 0.138, 0.056, shZ], [s * 0.162, 0.082, shZ], 0.014, 0.012, cArmMetal, 0.82);
      // Twin front & rear upper clevis mounting ears straddling the coilover top eyelet (z = shZ ± 0.009..0.016)
      mkBox(0.152, 0.176, 0.075, 0.097, shZ + 0.0095, shZ + 0.0165, cSteelMid, 0.92);
      mkBox(0.152, 0.176, 0.075, 0.097, shZ - 0.0165, shZ - 0.0095, cSteelMid, 0.92);
      // Horizontal stainless pivot bolt & nut clamping coilover top eyelet inside upper clevis ears
      addCylZ(verts, cols, indices, s * shTopX, shTopY, shZ - 0.021, shZ + 0.021, 0.0046, 8, cCoilChrome, 0.98);

      // --- B. WIDE-V UPPER DOUBLE-WISHBONE A-ARM (Cleanly straddles coilover with open clearance!) ---
      const uFrontIn = [s * 0.144,  0.028, 0.422];
      const uRearIn  = [s * 0.162,  0.028, 0.252];
      const uBallOut = [s * 0.198,  0.012, 0.340];
      // Chassis front & rear upper pivot clevis brackets + pivot pins
      mkBox(0.122, 0.150, 0.018, 0.038, 0.410, 0.432, cArmMetal, 0.86);
      mkBox(0.140, 0.168, 0.018, 0.038, 0.242, 0.264, cArmMetal, 0.86);
      addCylZ(verts, cols, indices, s * 0.144, 0.028, 0.408, 0.434, 0.0042, 8, cCoilChrome, 0.95);
      addCylZ(verts, cols, indices, s * 0.162, 0.028, 0.240, 0.266, 0.0042, 8, cCoilChrome, 0.95);
      // Tubular carbon-steel upper wishbone legs (100% clear of the red coil spring!)
      addStrut(verts, cols, indices, uFrontIn, uBallOut, 0.009, 0.010, cCarbon, 0.45);
      addStrut(verts, cols, indices, uRearIn,  uBallOut, 0.009, 0.010, cCarbon, 0.45);

      // --- C. HEAVY LOWER DOUBLE-WISHBONE A-ARM + INTEGRATED COILOVER SADDLE CLEVIS ---
      const lFrontIn = [s * 0.134, -0.044, 0.404];
      const lRearIn  = [s * 0.156, -0.044, 0.262];
      const lBallOut = [s * 0.198, -0.046, 0.340];
      // Chassis front & rear lower pivot clevis brackets + pivot pins
      mkBox(0.112, 0.140, -0.054, -0.034, 0.392, 0.414, cArmMetal, 0.86);
      mkBox(0.136, 0.162, -0.054, -0.034, 0.252, 0.274, cArmMetal, 0.86);
      addCylZ(verts, cols, indices, s * 0.134, -0.044, 0.390, 0.416, 0.0046, 8, cCoilChrome, 0.95);
      addCylZ(verts, cols, indices, s * 0.156, -0.044, 0.250, 0.276, 0.0046, 8, cCoilChrome, 0.95);
      // Heavy tubular lower wishbone legs
      addStrut(verts, cols, indices, lFrontIn, lBallOut, 0.011, 0.013, cCarbon, 0.45);
      addStrut(verts, cols, indices, lRearIn,  lBallOut, 0.011, 0.013, cCarbon, 0.45);
      // Welded structural cross-saddle beam spanning cleanly between front & rear lower A-arm legs right under coilover
      addStrut(verts, cols, indices, [s * shBotX, -0.046, 0.308], [s * shBotX, -0.046, 0.356], 0.016, 0.011, cArmMetal, 0.86);
      // Twin lower U-clevis mounting ears seated 100% flush on the lower A-arm cross-saddle
      mkBox(shBotX - 0.008, shBotX + 0.008, -0.047, -0.025, shZ + 0.0090, shZ + 0.0148, cSteelMid, 0.92);
      mkBox(shBotX - 0.008, shBotX + 0.008, -0.047, -0.025, shZ - 0.0148, shZ - 0.0090, cSteelMid, 0.92);
      // Horizontal stainless cross-bolt clamping coilover lower eyelet inside lower clevis ears
      addCylZ(verts, cols, indices, s * shBotX, shBotY, shZ - 0.019, shZ + 0.019, 0.0044, 8, cCoilChrome, 0.98);

      // --- D. VERTICAL BILLET STEERING KNUCKLE UPRIGHT, BALL JOINTS & STEERING TIE-ROD ---
      // Forged vertical knuckle upright linking upper & lower ball joints cleanly at the wheel kingpin
      addStrut(verts, cols, indices, uBallOut, lBallOut, 0.014, 0.018, cArmMetal, 0.85);
      // Upper & lower spherical ball-joint collars (anodized gold + steel cap)
      addCylZ(verts, cols, indices, s * 0.198,  0.012, 0.332, 0.348, 0.0085, 8, cGoldBolt, 0.92);
      addCylZ(verts, cols, indices, s * 0.198, -0.046, 0.332, 0.348, 0.0095, 8, cGoldBolt, 0.92);
      // Hub kingpin boss collar centered at exact wheel hub (y = -0.028, z = 0.340) meeting steerable fender upright
      mkBox(0.189, 0.212, -0.039, -0.017, 0.329, 0.351, cSteelDark, 0.88);
      // Steering rack tie-rod link from nose bulkhead out to knuckle steering arm
      addStrut(verts, cols, indices, [s * 0.146, -0.024, 0.296], [s * 0.196, -0.024, 0.322], 0.007, 0.007, cSteelMid, 0.92);

      // --- E. EXPOSED 3D COILOVER SHOCK ABSORBER (Mounted bolt-to-bolt inside upper & lower clevis forks!) ---
      addCoilover(
        verts, cols, indices,
        [s * shTopX, shTopY, shZ],
        [s * shBotX, shBotY, shZ],
        0.0145, cCoilSpring, cCoilBody, cCoilChrome
      );
    }

    // =========================================================================
    // 7. PRECISION SWINGARM-MOUNTED ENGINE CRADLE BAY (Flush mechanical docking socket!)
    //    No protruding bars or shock on bare chassis — Swingarm, Motor Pods & Rear Coilovers
    //    lock cleanly into this cradle socket with exact pivot & upper shock-tower mating!
    // =========================================================================
    for (let s of [-1, 1]) {
      // Sculpted billet aluminum swingarm pivot clevis ear recessed neatly inside cradle bay (y = -0.032, z = -0.214)
      addHex(
        verts, cols, indices,
        [s * 0.072, -0.052, -0.193], [s * 0.108, -0.052, -0.193], [s * 0.108, -0.012, -0.193], [s * 0.072, -0.012, -0.193],
        [s * 0.074, -0.048, -0.222], [s * 0.106, -0.048, -0.222], [s * 0.106, -0.016, -0.222], [s * 0.074, -0.016, -0.222],
        cSteelMid, 0.90
      );
      // Recessed upper shock-tower billet gusset bracket inside rear wheel-well arch (z = -0.240..-0.268)
      addHex(
        verts, cols, indices,
        [s * 0.074, 0.178, -0.240], [s * 0.126, 0.178, -0.240], [s * 0.126, 0.196, -0.240], [s * 0.074, 0.196, -0.240],
        [s * 0.074, 0.178, -0.268], [s * 0.126, 0.178, -0.268], [s * 0.126, 0.196, -0.268], [s * 0.074, 0.196, -0.268],
        cSteelDark, 0.85
      );
      // Subtle recessed cyan HV inductive contact bar on inside of cradle cheek (illuminates engine dock seam!)
      addQuad(
        verts, cols, indices,
        [s * 0.118, -0.018, -0.200], [s * 0.118, 0.018, -0.200],
        [s * 0.122,  0.014, -0.214], [s * 0.122, -0.014, -0.214],
        cHudCyan, [s * 0.65, 0.0, -0.76], 0
      );
    }
    // Continuous recessed titanium swingarm pivot axle shaft spanning cleanly across cradle clevis forks
    addHex(
      verts, cols, indices,
      [-0.116, -0.042, -0.204], [0.116, -0.042, -0.204], [0.116, -0.022, -0.204], [-0.116, -0.022, -0.204],
      [-0.116, -0.042, -0.224], [0.116, -0.042, -0.224], [0.116, -0.022, -0.224], [-0.116, -0.022, -0.224],
      cCarbon, 0.50
    );
    // Upper structural titanium shock-tower cross-brace bar tucked flush under wheel-well ceiling
    addHex(
      verts, cols, indices,
      [-0.126, 0.180, -0.244], [0.126, 0.180, -0.244], [0.126, 0.195, -0.244], [-0.126, 0.195, -0.244],
      [-0.126, 0.180, -0.264], [0.126, 0.180, -0.264], [0.126, 0.195, -0.264], [-0.126, 0.195, -0.264],
      cCarbon, 0.45
    );
    // Recessed HV power busbar docking terminal block on center rear firewall (feeds Swingarm-Mounted Engine!)
    addHex(
      verts, cols, indices,
      [-0.048, 0.036, -0.192], [0.048, 0.036, -0.192], [0.048, 0.088, -0.192], [-0.048, 0.088, -0.192],
      [-0.044, 0.040, -0.206], [0.044, 0.040, -0.206], [0.044, 0.084, -0.206], [-0.044, 0.084, -0.206],
      cCarbon, 0.35
    );
    // Glowing cyan HV docking contact strips on center busbar
    addQuad(
      verts, cols, indices,
      [-0.034, 0.054, -0.207], [-0.008, 0.054, -0.207], [-0.008, 0.072, -0.207], [-0.034, 0.072, -0.207],
      cHudCyan, [0, 0, -1], 0
    );
    addQuad(
      verts, cols, indices,
      [ 0.008, 0.054, -0.207], [ 0.034, 0.054, -0.207], [ 0.034, 0.072, -0.207], [ 0.008, 0.072, -0.207],
      cHudCyan, [0, 0, -1], 0
    );

    _cyberCarHullTemplate = {
      vertices: new Float32Array(verts),
      colors: new Float32Array(cols),
      indices: new Uint16Array(indices)
    };
    return _cyberCarHullTemplate;
  }

  // Dedicated Standard See-Through Automotive Glass Template (Windshield + Rear Quarter Windows)
  // Double-faced laminated sheets with exact [0.6, 0.8, 1.0] vertex color triggering renderer.js standard glass Fresnel shader!
  function getOrCreateCyberCarGlassTemplate() {
    if (_cyberCarGlassTemplate) return _cyberCarGlassTemplate;
    const verts = [];
    const cols = [];
    const indices = [];

    const cowlC    = [ 0.000,  0.164,  0.295];
    const cowlInL  = [-0.130,  0.1557, 0.2867];
    const cowlInR  = [ 0.130,  0.1557, 0.2867];
    const peakInL  = [-0.106,  0.344,  0.012];
    const peakInC  = [ 0.000,  0.346,  0.015];
    const peakInR  = [ 0.106,  0.344,  0.012];

    // 1. Panoramic Front Windshield (outer + inset inner laminated faces -> crystal clear from BOTH outside & inside!)
    const wsIn = (p) => [p[0], p[1] - 0.0018, p[2] - 0.0018];
    addQuad(verts, cols, indices, cowlInL, cowlC, peakInC, peakInL, STANDARD_GLASS_COLOR, [-0.04,  0.72,  0.70], 0);
    addQuad(verts, cols, indices, cowlC, cowlInR, peakInR, peakInC, STANDARD_GLASS_COLOR, [ 0.04,  0.72,  0.70], 0);
    addQuad(verts, cols, indices, wsIn(cowlInL), wsIn(peakInL), wsIn(peakInC), wsIn(cowlC), STANDARD_GLASS_COLOR, [ 0.04, -0.72, -0.70], 0);
    addQuad(verts, cols, indices, wsIn(cowlC), wsIn(peakInC), wsIn(peakInR), wsIn(cowlInR), STANDARD_GLASS_COLOR, [-0.04, -0.72, -0.70], 0);

    // 2. Left & Right Rear Quarter Cockpit Triangular Windows (recessed cleanly into frame, opening directly into cockpit!)
    const qTopL      = [-0.137,  0.326, -0.158];
    const qRearBotL  = [-0.174,  0.186, -0.186];
    const qFrontBotL = [-0.167,  0.186, -0.130];
    const qInL = (p) => [p[0] + 0.0022, p[1] - 0.0005, p[2]];
    addMirroredTri(verts, cols, indices, qTopL, qRearBotL, qFrontBotL, STANDARD_GLASS_COLOR, [-1,  0.25, 0], 0);
    addMirroredTri(verts, cols, indices, qInL(qTopL), qInL(qFrontBotL), qInL(qRearBotL), STANDARD_GLASS_COLOR, [ 1, -0.25, 0], 0);

    _cyberCarGlassTemplate = {
      vertices: new Float32Array(verts),
      colors: new Float32Array(cols),
      indices: new Uint16Array(indices)
    };
    return _cyberCarGlassTemplate;
  }

  function computeCyberCarTransform(item) {
    const p = item.position;
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

    const bankAngle = item.bankAngle || 0;
    if (bankAngle && Math.abs(bankAngle) > 0.0001) {
      const cosB = Math.cos(bankAngle);
      const sinB = Math.sin(bankAngle);
      const bankedR = [
        r[0] * cosB - n[0] * sinB,
        r[1] * cosB - n[1] * sinB,
        r[2] * cosB - n[2] * sinB
      ];
      const bankedN = [
        n[0] * cosB + r[0] * sinB,
        n[1] * cosB + r[1] * sinB,
        n[2] * cosB + r[2] * sinB
      ];
      r = bankedR;
      n = bankedN;
    }

    const carScale = window.CYBER_CAR_SCALE || 0.36;
    const hasWheel = !!(item.hasWheel || item.hasWheels || item.hasAirlessWheel || (item.wheelCount && item.wheelCount > 0));
    const chassisLift = hasWheel ? 0.0 : (0.085 * carScale);
    const origin = [
      p[0] + n[0] * chassisLift,
      p[1] + n[1] * chassisLift,
      p[2] + n[2] * chassisLift
    ];
    return { origin, carScale, hasWheel, r, n, f };
  }

  // Emit all transparent glass panes for a placed or actively driven Cyber Car (windshield, rear quarter, + side doors if mounted)
  window.emitCyberCarGlass = function(item, vertices, colors, indices) {
    if (!item || !item.position || item.isPreview) return;
    const { origin, carScale, r, n, f } = computeCyberCarTransform(item);
    emitTemplateMesh(getOrCreateCyberCarGlassTemplate(), origin, carScale, r, n, f, vertices, colors, indices, false, null);
    if (item.hasDoor && typeof window.emitCyberCarDoorGlass === "function") {
      window.emitCyberCarDoorGlass(origin, r, n, f, vertices, colors, indices);
    }
  };

  window.getOrCreateRawCyberCarHull = getOrCreateRawCyberCarHull;
  window.getOrCreateCyberCarGlassTemplate = getOrCreateCyberCarGlassTemplate;

  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["cyber_car"] = {
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

      const bankAngle = item.bankAngle || 0;
      if (bankAngle && Math.abs(bankAngle) > 0.0001) {
        const cosB = Math.cos(bankAngle);
        const sinB = Math.sin(bankAngle);
        const bankedR = [
          r[0] * cosB - n[0] * sinB,
          r[1] * cosB - n[1] * sinB,
          r[2] * cosB - n[2] * sinB
        ];
        const bankedN = [
          n[0] * cosB + r[0] * sinB,
          n[1] * cosB + r[1] * sinB,
          n[2] * cosB + r[2] * sinB
        ];
        r = bankedR;
        n = bankedN;
      }

      const carScale = window.CYBER_CAR_SCALE || 0.36;
      const hasWheel = !!(item.hasWheel || item.hasWheels || item.hasAirlessWheel || (item.wheelCount && item.wheelCount > 0));
      const chassisLift = hasWheel ? 0.0 : (0.085 * carScale);
      const origin = [
        p[0] + n[0] * chassisLift,
        p[1] + n[1] * chassisLift,
        p[2] + n[2] * chassisLift
      ];

      const rawHull = getOrCreateRawCyberCarHull();
      emitTemplateMesh(rawHull, origin, carScale, r, n, f, vertices, colors, indices, isPreview, previewColor);

      // === STEERABLE FRONT WHEEL FENDERS (Pivot smoothly with front wheels on steerAngle & scale with cyberCarFrontWheelScale!) ===
      const fWheelScale = (typeof window.cyberCarFrontWheelScale === "number") ? window.cyberCarFrontWheelScale : 0.71;
      const steerAngle = (!isPreview && hasWheel) ? (item.steerAngle || 0) : 0;
      let sf = f;
      let sr = r;
      if (steerAngle && Math.abs(steerAngle) > 0.001) {
        const cosS = Math.cos(steerAngle), sinS = Math.sin(steerAngle);
        sf = [f[0] * cosS + r[0] * sinS, f[1] * cosS + r[1] * sinS, f[2] * cosS + r[2] * sinS];
        sr = [r[0] * cosS - f[0] * sinS, r[1] * cosS - f[1] * sinS, r[2] * cosS - f[2] * sinS];
      }
      const fSide = (0.254 + Math.max(-0.35, fWheelScale - 1.0) * 0.065) * carScale;
      const fFwd  = 0.340 * carScale;
      const fUp   = -0.028 * carScale;
      const fenderScale = carScale * fWheelScale;
      const leftHub = [
        origin[0] - r[0] * fSide + n[0] * fUp + f[0] * fFwd,
        origin[1] - r[1] * fSide + n[1] * fUp + f[1] * fFwd,
        origin[2] - r[2] * fSide + n[2] * fUp + f[2] * fFwd
      ];
      const rightHub = [
        origin[0] + r[0] * fSide + n[0] * fUp + f[0] * fFwd,
        origin[1] + r[1] * fSide + n[1] * fUp + f[1] * fFwd,
        origin[2] + r[2] * fSide + n[2] * fUp + f[2] * fFwd
      ];
      emitTemplateMesh(getOrCreateFrontFenderTemplate(-1), leftHub,  fenderScale, sr, n, sf, vertices, colors, indices, isPreview, previewColor);
      emitTemplateMesh(getOrCreateFrontFenderTemplate( 1), rightHub, fenderScale, sr, n, sf, vertices, colors, indices, isPreview, previewColor);

      if (isPreview) {
        emitTemplateMesh(getOrCreateCyberCarGlassTemplate(), origin, carScale, r, n, f, vertices, colors, indices, true, previewColor);
        return;
      }

      // === MODULAR ATTACHED PARTS (All share exact CYBER_CAR_SCALE!) ===

      if (item.hasDoor && typeof window.drawCyberCarDoors === "function") {
        window.drawCyberCarDoors(origin, r, n, f, vertices, colors, indices, false, null);
      }

      if (item.hasSeat && typeof window.drawCyberCarSeat === "function") {
        const stickThrottle = typeof item.stickThrottle === "number" ? item.stickThrottle : 0;
        const stickSteer = typeof item.stickSteer === "number" ? item.stickSteer : 0;
        window.drawCyberCarSeat(origin, r, n, f, vertices, colors, indices, false, null, stickThrottle, stickSteer);
      }

      if (hasWheel && typeof window.drawCyberCarWheelSet === "function") {
        const isAir = !!(item.isFlying || item.isAirborne);
        const spinAngle = isAir ? (item.frozenSpinAngle !== undefined ? item.frozenSpinAngle : (item.spinAngle || 0)) : (item.spinAngle || 0);
        window.drawCyberCarWheelSet(origin, r, n, f, spinAngle, steerAngle, vertices, colors, indices, false, null);
      }

      if ((item.hasEngine || item.hasCyberEngine) && typeof window.drawCyberCarMountedEngine === "function") {
        window.drawCyberCarMountedEngine(origin, r, n, f, vertices, colors, indices, false, null);
      }
    }
  };
})();
