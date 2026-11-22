// === SEEDPLANET MODULE: JS/ITEMS/CYBER_ENGINE.JS ===
// Swingarm-Mounted Engine: Integrated Structural Swingarm + Dual Geo-Hex Hub-Drive Motor Pods + Twin Rear Coilovers
// Adapts automatically to Rear Wheel Scale & Rear Wheel Width settings from DevGame UI

(function() {
  let _standaloneTemplate = null;
  let _mountedLeftPodTemplate = null;
  let _mountedRightPodTemplate = null;

  function shadeMetal(baseColor, nx, ny, nz, metallic) {
    if (metallic === 0) return [baseColor[0], baseColor[1], baseColor[2]];
    const key = Math.max(0, nx * 0.36 + ny * 0.82 + nz * 0.44);
    const fill = Math.max(0, -nx * 0.44 + ny * 0.36 - nz * 0.30);
    const sky = 0.5 + 0.5 * ny;
    const spec = metallic > 0.4 ? Math.pow(Math.max(0, nx * 0.22 + ny * 0.88 + nz * 0.42), 8.0) * 0.15 * metallic : 0;
    const lum = 0.54 + 0.34 * key + 0.15 * fill + 0.12 * sky;
    return [
      Math.min(0.92, baseColor[0] * lum + spec),
      Math.min(0.94, baseColor[1] * lum + spec),
      Math.min(0.96, baseColor[2] * lum + spec * 1.02)
    ];
  }

  // Strictly CW-outward triangle matching engine's gl.frontFace(gl.CW)
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

    const col = shadeMetal(baseColor, outNx, outNy, outNz, metallic === undefined ? 0.9 : metallic);
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

  function addCylX(verts, cols, indices, cy, cz, x0, x1, radius, segs, baseColor, metallic) {
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const midA = (a0 + a1) * 0.5;
      const p0a = [x0, cy + Math.cos(a0) * radius, cz + Math.sin(a0) * radius];
      const p0b = [x0, cy + Math.cos(a1) * radius, cz + Math.sin(a1) * radius];
      const p1a = [x1, cy + Math.cos(a0) * radius, cz + Math.sin(a0) * radius];
      const p1b = [x1, cy + Math.cos(a1) * radius, cz + Math.sin(a1) * radius];
      addQuad(verts, cols, indices, p0a, p0b, p1b, p1a, baseColor, [0, Math.cos(midA), Math.sin(midA)], metallic);
      addTri(verts, cols, indices, [x0, cy, cz], p0b, p0a, baseColor, [x0 < x1 ? -1 : 1, 0, 0], metallic);
      addTri(verts, cols, indices, [x1, cy, cz], p1a, p1b, baseColor, [x1 > x0 ? 1 : -1, 0, 0], metallic);
    }
  }

  // Detailed 3D Coilover Shock Absorber integrated into Swingarm-Mounted Engine
  function addCoilover(verts, cols, indices, pTop, pBot, coilRadius, cSpring, cBody, cChrome) {
    const dx = pBot[0] - pTop[0], dy = pBot[1] - pTop[1], dz = pBot[2] - pTop[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-5) return;
    const ax = dx / len, ay = dy / len, az = dz / len;
    let ux = 1, uy = 0, uz = 0;
    if (Math.abs(ax) > 0.90) { ux = 0; uy = 0; uz = 1; }
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

    addRing(0.00, 0.09, coilRadius * 1.12, 8, cBody, 0.85);
    addRing(0.08, 0.62, coilRadius * 0.58, 8, cBody, 0.70);
    addRing(0.60, 0.94, coilRadius * 0.34, 8, cChrome, 1.00);
    addRing(0.92, 1.00, coilRadius * 0.72, 8, cBody, 0.85);
    addRing(0.11, 0.16, coilRadius * 1.06, 8, [0.78, 0.62, 0.30], 0.95);
    addRing(0.70, 0.75, coilRadius * 1.06, 8, [0.78, 0.62, 0.30], 0.95);
    const numCoils = 6;
    for (let ci = 0; ci < numCoils; ci++) {
      const tc = 0.19 + (ci / (numCoils - 1)) * 0.48;
      addRing(tc - 0.022, tc + 0.022, coilRadius, 8, cSpring, 0.65);
    }
  }

  // Build one Geo-Hex Hub-Integrated Motor Pod
  // side = -1 (left outer faces -X, hub shaft points +X into wheel)
  // side = +1 (right outer faces +X, hub shaft points -X into wheel)
  // xCenter, yCenter, zHubCenter = exact alignment with rear wheel axle (or [0,0,0] standalone)
  function buildGeoHexPod(verts, cols, indices, side, ox, oy, oz, scale, includeFullTopDetails) {
    const s = side; // outward X sign (-1 left, +1 right)
    const pt = (lx, ly, lz) => [ox + s * lx * scale, oy + ly * scale, oz + lz * scale];
    const dir = (dx, dy, dz) => [s * dx, dy, dz];

    const cTiBright = [0.70, 0.72, 0.76]; // Brushed titanium upper facet
    const cTiMid    = [0.50, 0.52, 0.56]; // Dark titanium side armor
    const cTiDark   = [0.32, 0.34, 0.38]; // Lower dark gunmetal facet
    const cGunmetal = [0.18, 0.20, 0.23]; // Thermal fins & recessed bezel
    const cRedTrim  = [0.90, 0.16, 0.19]; // Geo-Hex crimson edge trim
    const cScreenBg = [0.06, 0.11, 0.20]; // Digital Diagnostics OLED glass
    const cCyan     = [0.18, 0.88, 1.00]; // Cyan diagnostic telemetry & HV glow
    const cMagenta  = [0.98, 0.25, 0.48]; // Crimson/magenta diagnostic waveform
    const cCopper   = [0.84, 0.48, 0.25]; // Braided copper HV busbars
    const cBraided  = [0.44, 0.46, 0.50]; // Metallic braided conduit
    const cSteel    = [0.78, 0.80, 0.84]; // Machined hub flange & splined output shaft

    // === 1. ELONGATED FACETED GEO-HEX OUTER SHELL ===
    // Profile loop in (ly, lz) relative to rear wheel hub at (ly=0, lz=0), sweeping cleanly forward to lz = +0.190
    // Elongated to span rear hub (z=-0.415) -> chassis Engine Cradle Bay (z=-0.222..-0.200) with ZERO clipping!
    const ring = [
      [ 0.022,  0.190], // 0: forward upper shoulder locking into chassis cradle lip
      [ 0.054,  0.105], // 1: sleek upper crest above diagnostics OLED screen
      [ 0.056,  0.004], // 2: symmetric rear hub collar upper
      [ 0.028, -0.058], // 3: symmetric rear hub upper-back bevel
      [-0.028, -0.058], // 4: symmetric rear hub lower-back bevel
      [-0.054,  0.004], // 5: symmetric rear hub collar lower
      [-0.048,  0.072], // 6: armored belly crest under OLED bezel
      [-0.026,  0.176]  // 7: forward lower chin locking into cradle lower lip
    ];

    const xIn  = -0.022; // Inner side facing rear wheel (snug clearance!)
    const xOut =  0.032; // Outer faceted shoulder
    const xRim =  0.044; // Raised faceted outer crown (flush with chassis hip!)

    const nPts = ring.length;
    for (let i = 0; i < nPts; i++) {
      const pA = ring[i];
      const pB = ring[(i + 1) % nPts];
      const midY = (pA[0] + pB[0]) * 0.5;
      const midZ = (pA[1] + pB[1]) * 0.5 - 0.06;

      const aIn  = pt(xIn,  pA[0] * 0.92, pA[1] * 0.97);
      const bIn  = pt(xIn,  pB[0] * 0.92, pB[1] * 0.97);
      const aOut = pt(xOut, pA[0], pA[1]);
      const bOut = pt(xOut, pB[0], pB[1]);
      const aRim = pt(xRim, pA[0] * 0.78, pA[1] * 0.88);
      const bRim = pt(xRim, pB[0] * 0.78, pB[1] * 0.88);

      const wallCol = (i <= 2) ? cTiBright : cTiDark;
      addQuad(verts, cols, indices, aIn, bIn, bOut, aOut, wallCol, dir(0, midY, midZ), 0.9);
      addQuad(verts, cols, indices, aOut, bOut, bRim, aRim, cTiMid, dir(0.65, midY * 0.7, midZ * 0.4), 0.95);
    }

    // Close inner (-s) backing wall
    const inC = pt(xIn, 0.0, 0.06);
    for (let i = 0; i < nPts; i++) {
      const pA = ring[i];
      const pB = ring[(i + 1) % nPts];
      addTri(verts, cols, indices, inC, pt(xIn, pA[0] * 0.92, pA[1] * 0.97), pt(xIn, pB[0] * 0.92, pB[1] * 0.97), cTiDark, dir(-1, 0, 0), 0.6);
    }

    // Close outer face background plate behind screen + hub stator cap
    const outC = pt(xRim, 0.002, 0.075);
    for (let i = 0; i < nPts; i++) {
      const pA = ring[i];
      const pB = ring[(i + 1) % nPts];
      addTri(
        verts, cols, indices,
        outC,
        pt(xRim, pA[0] * 0.78, pA[1] * 0.88),
        pt(xRim, pB[0] * 0.78, pB[1] * 0.88),
        cTiMid,
        dir(1, 0, 0),
        0.9
      );
    }

    // === 2. FLUSH CNC-MACHINED FLAT-TOP HEXAGONAL HUB STATOR CAP (Seated strictly inside pod face at lz = 0!) ===
    // Flat horizontal top & bottom edges (|ly| = 0.031 < pod rim ±0.042, |lz| = 0.036 < OLED start 0.064) -> ZERO overhang!
    const hexRing = (lx, rad) => {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2; // Flat top/bottom, crisp fore/aft points along swingarm axis
        pts.push(pt(lx, Math.sin(a) * rad, Math.cos(a) * rad));
      }
      return pts;
    };
    const hSeat  = hexRing(xRim - 0.001,  0.0365); // Embedded cleanly into pod plate (zero floating gap!)
    const hBase  = hexRing(xRim + 0.0045, 0.0345); // Dark gunmetal recessed base collar
    const hBevel = hexRing(xRim + 0.0120, 0.0245); // Brushed titanium chamfered stator housing
    const hInner = hexRing(xRim + 0.0125, 0.0165); // Dark recessed inner stator ring
    const hNut0  = hexRing(xRim + 0.0125, 0.0125); // Center machined steel axle nut base
    const hNut1  = hexRing(xRim + 0.0160, 0.0095); // Center machined steel axle nut cap
    const hubCenter = pt(xRim + 0.0162, 0.0, 0.0);

    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      const mA = ((i + 0.5) / 6) * Math.PI * 2;
      const mY = Math.sin(mA), mZ = Math.cos(mA);
      // 1. Flush dark gunmetal mounting collar welded into pod face
      addQuad(verts, cols, indices, hSeat[i], hSeat[j], hBase[j], hBase[i], cGunmetal, dir(0.35, mY * 0.9, mZ * 0.9), 0.55);
      // 2. Crisp brushed-titanium beveled hexagonal side facets
      const bevelCol = (i === 0 || i === 1 || i === 2) ? cTiBright : cTiDark;
      addQuad(verts, cols, indices, hBase[i], hBase[j], hBevel[j], hBevel[i], bevelCol, dir(0.75, mY * 0.65, mZ * 0.65), 0.95);
      // 3. Flat machined titanium outer stator faceplate ring
      addQuad(verts, cols, indices, hBevel[i], hBevel[j], hInner[j], hInner[i], cTiMid, dir(1, 0, 0), 0.92);
      // 4. Recessed dark gunmetal inner collar surrounding center axle nut
      addQuad(verts, cols, indices, hInner[i], hInner[j], hNut0[j], hNut0[i], cGunmetal, dir(1, 0, 0), 0.40);
      // 5. Raised machined stainless-steel hex axle nut boss & flat cap
      addQuad(verts, cols, indices, hNut0[i], hNut0[j], hNut1[j], hNut1[i], cSteel, dir(0.65, mY * 0.75, mZ * 0.75), 0.98);
      addTri(verts, cols, indices, hubCenter, hNut1[i], hNut1[j], cSteel, dir(1, 0, 0), 0.98);
    }

    // === 3. INTEGRATED DIGITAL DIAGNOSTICS SCREEN (Cleanly exposed ahead of hex hub & behind chassis cradle!) ===
    const sx = xRim + 0.0035;
    // Dark bezel polygon (z = -0.351 .. -0.253 when mounted at oz = -0.415 -> 100% clear of chassis!)
    const b0 = pt(sx,  0.029,  0.064);
    const b1 = pt(sx,  0.034,  0.128);
    const b2 = pt(sx,  0.006,  0.162);
    const b3 = pt(sx, -0.024,  0.146);
    const b4 = pt(sx, -0.030,  0.076);
    addQuad(verts, cols, indices, b0, b1, b3, b4, cGunmetal, dir(1, 0, 0), 0.35);
    addTri(verts, cols, indices, b1, b2, b3, cGunmetal, dir(1, 0, 0), 0.35);

    // Dark navy glowing screen surface
    const sx2 = sx + 0.003;
    const s0 = pt(sx2,  0.022,  0.070);
    const s1 = pt(sx2,  0.027,  0.124);
    const s2 = pt(sx2,  0.005,  0.152);
    const s3 = pt(sx2, -0.018,  0.139);
    const s4 = pt(sx2, -0.023,  0.080);
    addQuad(verts, cols, indices, s0, s1, s3, s4, cScreenBg, dir(1, 0, 0), 0);
    addTri(verts, cols, indices, s1, s2, s3, cScreenBg, dir(1, 0, 0), 0);

    // Bright cyan & magenta digital diagnostic waveform bars (exact concept art telemetry glow!)
    const sx3 = sx2 + 0.0025;
    const bars = [
      { y:  0.014, z0: 0.080, z1: 0.130, h: 0.0044, col: cCyan },
      { y:  0.006, z0: 0.078, z1: 0.142, h: 0.0044, col: cCyan },
      { y: -0.002, z0: 0.080, z1: 0.138, h: 0.0052, col: cMagenta },
      { y: -0.010, z0: 0.082, z1: 0.128, h: 0.0044, col: cCyan },
      { y: -0.017, z0: 0.084, z1: 0.116, h: 0.0038, col: cMagenta }
    ];
    for (let bi = 0; bi < bars.length; bi++) {
      const br = bars[bi];
      addQuad(
        verts, cols, indices,
        pt(sx3, br.y + br.h * 0.5, br.z0),
        pt(sx3, br.y + br.h * 0.5, br.z1),
        pt(sx3, br.y - br.h * 0.5, br.z1),
        pt(sx3, br.y - br.h * 0.5, br.z0),
        br.col, dir(1, 0, 0), 0
      );
    }

    // === 4. PRECISION FORWARD DOCKING PROW + GLOWING CYAN/CRIMSON HV SEAM COUPLER ===
    // Slides snugly into the recessed chassis Engine Cradle Bay (z = -0.222 .. -0.200)!
    const prowTip = pt(0.006, -0.012, 0.214);
    const pTop    = pt(0.010,  0.022, 0.184);
    const pOut    = pt(0.032, -0.002, 0.178);
    const pBot    = pt(0.010, -0.026, 0.172);
    const pIn     = pt(-0.018, -0.002, 0.178);
    addTri(verts, cols, indices, prowTip, pTop, pOut, cTiBright, dir(0.5, 0.5, 0.7), 1.0);
    addTri(verts, cols, indices, prowTip, pIn, pTop, cTiMid, dir(-0.5, 0.5, 0.7), 0.9);
    addTri(verts, cols, indices, prowTip, pOut, pBot, cTiDark, dir(0.5, -0.6, 0.6), 0.85);
    addTri(verts, cols, indices, prowTip, pBot, pIn, cTiDark, dir(-0.5, -0.6, 0.6), 0.85);

    // Glowing cyan + crimson HV power intake light illuminating the exact chassis cradle docking seam!
    addStrut(verts, cols, indices, pt(0.004,  0.022, 0.186), pt(0.026, -0.006, 0.188), 0.010 * scale, 0.012 * scale, cCyan, 0);
    addStrut(verts, cols, indices, pt(0.004, -0.012, 0.184), pt(0.024, -0.026, 0.180), 0.008 * scale, 0.009 * scale, cRedTrim, 0);

    // === 5. CRIMSON GEO-HEX EDGE TRIM LINES (Exact flush contour along upper & lower pod rim!) ===
    addStrut(verts, cols, indices, pt(xRim,  0.0435,  0.004), pt(xRim,  0.0420,  0.092), 0.0042 * scale, 0.0042 * scale, cRedTrim, 0);
    addStrut(verts, cols, indices, pt(xRim,  0.0420,  0.092), pt(xRim,  0.0172,  0.167), 0.0042 * scale, 0.0042 * scale, cRedTrim, 0);
    addStrut(verts, cols, indices, pt(xRim, -0.0420,  0.004), pt(xRim, -0.0374,  0.063), 0.0042 * scale, 0.0042 * scale, cRedTrim, 0);
    addStrut(verts, cols, indices, pt(xRim, -0.0374,  0.063), pt(xRim, -0.0203,  0.155), 0.0042 * scale, 0.0042 * scale, cRedTrim, 0);

    // === 6. STANDALONE FULL DETAILS: COOLING FINS, COPPER HV CABLES & SPLINED OUTPUT SHAFT ===
    if (includeFullTopDetails) {
      // Thermal management cooling fins
      for (let fi = 0; fi < 5; fi++) {
        const fz = 0.068 - fi * 0.018;
        addStrut(verts, cols, indices, pt(-0.020, 0.056, fz), pt(0.024, 0.056, fz), 0.006 * scale, 0.018 * scale, cGunmetal, 0.5);
      }
      // Upper HV manifold + twin red connector boots + copper busbar cables
      addStrut(verts, cols, indices, pt(-0.014, 0.070, 0.082), pt(0.022, 0.070, 0.082), 0.026 * scale, 0.020 * scale, cTiBright, 0.95);
      addStrut(verts, cols, indices, pt(-0.006, 0.072, 0.066), pt(-0.006, 0.072, 0.048), 0.014 * scale, 0.014 * scale, cRedTrim, 0.5);
      addStrut(verts, cols, indices, pt( 0.014, 0.072, 0.066), pt( 0.014, 0.072, 0.048), 0.014 * scale, 0.014 * scale, cRedTrim, 0.5);
      addStrut(verts, cols, indices, pt(-0.006, 0.070, 0.050), pt(-0.006, 0.046, 0.006), 0.008 * scale, 0.008 * scale, cCopper, 0.85);
      addStrut(verts, cols, indices, pt( 0.014, 0.070, 0.050), pt( 0.014, 0.046, 0.006), 0.008 * scale, 0.008 * scale, cCopper, 0.85);
      addStrut(verts, cols, indices, pt( 0.006, 0.062, 0.095), pt( 0.006, 0.032, 0.156), 0.010 * scale, 0.010 * scale, cBraided, 0.65);

      // Stepped machined hub flange + protruding splined Reinforced Drive Output Shaft (pointing inward into wheel)
      const xFlange0 = ox + s * xIn * scale;
      const xFlange1 = ox + s * (xIn - 0.020) * scale;
      const xFlange2 = ox + s * (xIn - 0.034) * scale;
      const xShaftEnd = ox + s * (xIn - 0.074) * scale;
      addCylX(verts, cols, indices, oy, oz, xFlange0, xFlange1, 0.042 * scale, 12, cSteel, 0.95);
      addCylX(verts, cols, indices, oy, oz, xFlange1, xFlange2, 0.026 * scale, 10, cTiMid, 0.85);
      addCylX(verts, cols, indices, oy, oz, xFlange2, xShaftEnd, 0.015 * scale, 10, cSteel, 0.95);
    }
  }

  // Build elongated structural Swingarm Spar + Pivot Bushing + Integrated Rear Coilover Shock for one mounted half
  function buildSwingarmHalfAssembly(verts, cols, indices, side) {
    const s = side;
    const cArmDark   = [0.22, 0.24, 0.28];
    const cArmSteel  = [0.56, 0.58, 0.63];
    const cCoilRed   = [0.90, 0.15, 0.19];
    const cChrome    = [0.88, 0.91, 0.96];
    // 1. Elongated Geo-Hex Hub-Drive Motor Pod centered directly at extended rear hub (0, 0.000, -0.415)
    buildGeoHexPod(verts, cols, indices, s, 0.0, 0.000, -0.415, 1.06, false);

    // 2. Sculpted Elongated Swingarm Main Beam sweeping cleanly from hub housing into chassis pivot axle (y=-0.032, z=-0.214)
    addStrut(verts, cols, indices, [-s * 0.012, -0.012, -0.415], [-s * 0.012, -0.032, -0.214], 0.024, 0.036, cArmDark, 0.55);
    // Upper triangulated swingarm truss brace supporting the billet coilover clevis lug
    addStrut(verts, cols, indices, [-s * 0.010,  0.044, -0.356], [-s * 0.012, -0.018, -0.220], 0.016, 0.020, cArmSteel, 0.85);
    addStrut(verts, cols, indices, [-s * 0.010,  0.044, -0.356], [-s * 0.010,  0.006, -0.412], 0.016, 0.018, cArmSteel, 0.85);
    // Forward machined titanium swingarm pivot bushing collar locking flush into chassis clevis!
    addCylX(verts, cols, indices, -0.032, -0.214, -s * 0.030, s * 0.014, 0.019, 10, cArmSteel, 0.90);

    // 3. Integrated Rear Coilover Shock Absorber angled smoothly from swingarm lug up into chassis shock-tower beam!
    addCoilover(
      verts, cols, indices,
      [-s * 0.014, 0.180, -0.254],
      [-s * 0.008, 0.044, -0.356],
      0.018, cCoilRed, cArmDark, cChrome
    );
  }

  function getOrCreateStandaloneTemplate() {
    if (_standaloneTemplate) return _standaloneTemplate;
    const verts = [], cols = [], indices = [];
    buildGeoHexPod(verts, cols, indices, -1, 0, 0, -0.06, 1.0, true);
    // Include elongated integrated swingarm spar + angled coilover shock on standalone dropped item!
    addStrut(verts, cols, indices, [0.010, -0.012, -0.06], [0.010, -0.030, 0.135], 0.020, 0.030, [0.22, 0.24, 0.28], 0.55);
    addStrut(verts, cols, indices, [0.010,  0.040, -0.005], [0.010, -0.016, 0.128], 0.014, 0.016, [0.56, 0.58, 0.63], 0.85);
    addCylX(verts, cols, indices, -0.030, 0.135, -0.016, 0.026, 0.016, 10, [0.56, 0.58, 0.63], 0.90);
    addCoilover(
      verts, cols, indices,
      [0.012, 0.155, 0.098],
      [0.008, 0.040, -0.005],
      0.016, [0.90, 0.15, 0.19], [0.22, 0.24, 0.28], [0.88, 0.91, 0.96]
    );
    _standaloneTemplate = {
      verts: new Float32Array(verts),
      colors: new Float32Array(cols),
      indices: new Uint16Array(indices),
      vertCount: verts.length / 3
    };
    return _standaloneTemplate;
  }

  // Dual symmetric Swingarm-Mounted Engine Halves (Swingarm + Geo-Hex Hub Motor + Integrated Coilover!)
  function getOrCreateMountedPodHalf(side) {
    if (side < 0) {
      if (_mountedLeftPodTemplate) return _mountedLeftPodTemplate;
      const verts = [], cols = [], indices = [];
      buildSwingarmHalfAssembly(verts, cols, indices, -1);
      _mountedLeftPodTemplate = {
        verts: new Float32Array(verts),
        colors: new Float32Array(cols),
        indices: new Uint16Array(indices),
        vertCount: verts.length / 3
      };
      return _mountedLeftPodTemplate;
    }
    if (_mountedRightPodTemplate) return _mountedRightPodTemplate;
    const verts = [], cols = [], indices = [];
    buildSwingarmHalfAssembly(verts, cols, indices, 1);
    _mountedRightPodTemplate = {
      verts: new Float32Array(verts),
      colors: new Float32Array(cols),
      indices: new Uint16Array(indices),
      vertCount: verts.length / 3
    };
    return _mountedRightPodTemplate;
  }

  function emitTemplate(tpl, center, scale, r, n, f, vertices, colors, indices, isPreview, previewColor) {
    const tVerts = tpl.verts;
    const tCols = tpl.colors;
    const tIndices = tpl.indices;
    const vCount = tpl.vertCount;
    const baseIdx = vertices.length / 3;

    const cx = center[0], cy = center[1], cz = center[2];
    const r0 = r[0] * scale, r1 = r[1] * scale, r2 = r[2] * scale;
    const n0 = n[0] * scale, n1 = n[1] * scale, n2 = n[2] * scale;
    const f0 = f[0] * scale, f1 = f[1] * scale, f2 = f[2] * scale;

    for (let i = 0; i < vCount; i++) {
      const i3 = i * 3;
      const lx = tVerts[i3], ly = tVerts[i3 + 1], lz = tVerts[i3 + 2];
      vertices.push(
        cx + r0 * lx + n0 * ly + f0 * lz,
        cy + r1 * lx + n1 * ly + f1 * lz,
        cz + r2 * lx + n2 * ly + f2 * lz
      );
      if (isPreview) {
        colors.push(previewColor[0], previewColor[1], previewColor[2]);
      } else {
        colors.push(tCols[i3], tCols[i3 + 1], tCols[i3 + 2]);
      }
    }

    const det = (r[1] * n[2] - r[2] * n[1]) * f[0] + (r[2] * n[0] - r[0] * n[2]) * f[1] + (r[0] * n[1] - r[1] * n[0]) * f[2];
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
  }

  window.drawCyberEngine = function(center, scale, r, n, f, vertices, colors, indices, isPreview, previewColor) {
    emitTemplate(getOrCreateStandaloneTemplate(), center, scale, r, n, f, vertices, colors, indices, isPreview, previewColor);
  };

  window.drawCyberCarMountedEngine = function(p, r, n, f, vertices, colors, indices, isPreview, previewColor) {
    const carScale = window.CYBER_CAR_SCALE || 0.36;
    const rScale = typeof window.cyberCarRearWheelScale === "number" ? window.cyberCarRearWheelScale : 0.80;
    const rWidth = typeof window.cyberCarRearWheelWidth === "number" ? window.cyberCarRearWheelWidth : 1.0;
    const rearHalfThick = 0.089 * rScale * rWidth;
    const podHalfSpan = Math.max(0.094, rearHalfThick + 0.026) * carScale;
    const leftOrigin  = [p[0] - r[0] * podHalfSpan, p[1] - r[1] * podHalfSpan, p[2] - r[2] * podHalfSpan];
    const rightOrigin = [p[0] + r[0] * podHalfSpan, p[1] + r[1] * podHalfSpan, p[2] + r[2] * podHalfSpan];
    emitTemplate(getOrCreateMountedPodHalf(-1), leftOrigin,  carScale, r, n, f, vertices, colors, indices, isPreview, previewColor);
    emitTemplate(getOrCreateMountedPodHalf( 1), rightOrigin, carScale, r, n, f, vertices, colors, indices, isPreview, previewColor);
    // Keep wide rear-tire swingarms visibly linked to the central chassis pivot axle shaft
    if (podHalfSpan > 0.112 * carScale && typeof addBox === "function") {
      const pivC = [
        p[0] + n[0] * (-0.032 * carScale) + f[0] * (-0.214 * carScale),
        p[1] + n[1] * (-0.032 * carScale) + f[1] * (-0.214 * carScale),
        p[2] + n[2] * (-0.032 * carScale) + f[2] * (-0.214 * carScale)
      ];
      addBox(pivC, podHalfSpan * 2.02, 0.024 * carScale, 0.024 * carScale, isPreview ? previewColor : [0.42, 0.44, 0.48], r, n, f, vertices, colors, indices);
    }
  };

  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["cyber_engine"] = {
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

      const carScale = window.CYBER_CAR_SCALE || 0.36;

      if (isPreview && item.isBoatSnapped) {
        const target = item.targetBoat;
        const hasWheel = target && !!(target.hasWheel || target.hasWheels || target.hasAirlessWheel || (target.wheelCount && target.wheelCount > 0));
        const lift = hasWheel ? 0.0 : (0.085 * carScale);
        const snapPos = [p[0] + n[0] * lift, p[1] + n[1] * lift, p[2] + n[2] * lift];
        window.drawCyberCarMountedEngine(snapPos, r, n, f, vertices, colors, indices, true, previewColor);
        return;
      }

      const scale = (item.size || 0.25) * 4.0 * carScale;
      const lift = 0.058 * scale;
      const center = [
        p[0] + n[0] * lift,
        p[1] + n[1] * lift,
        p[2] + n[2] * lift
      ];
      window.drawCyberEngine(center, scale, r, n, f, vertices, colors, indices, isPreview, previewColor);
    }
  };
})();
