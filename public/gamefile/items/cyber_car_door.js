// === SEEDPLANET MODULE: JS/ITEMS/CYBER_CAR_DOOR.JS ===
// Watertight Faceted Brushed Stainless-Steel Origami Side Doors (CW-outward + Metallic Shading)
// Flush-locked vertex-for-vertex to CYBER_CAR chassis cutout & calibrated to CYBER_CAR_SCALE

(function() {
  let _doorPairTemplate = null;
  let _singleDoorTemplate = null;
  let _doorPairGlassTemplate = null;
  let _singleDoorGlassTemplate = null;

  // Engine standard see-through glass color marker (matched by renderer.js isGlass shader!)
  const STANDARD_GLASS_COLOR = [0.6, 0.8, 1.0];

  function shadeMetal(baseColor, nx, ny, nz, metallic) {
    if (metallic === 0) return [baseColor[0], baseColor[1], baseColor[2]];
    const key = Math.max(0, nx * 0.36 + ny * 0.82 + nz * 0.44);
    const fill = Math.max(0, -nx * 0.40 + ny * 0.36 - nz * 0.30);
    const sky = 0.5 + 0.5 * ny;
    const spec = metallic > 0.4 ? Math.pow(Math.max(0, nx * 0.22 + ny * 0.88 + nz * 0.42), 8.0) * 0.14 * metallic : 0;
    const lum = 0.54 + 0.34 * key + 0.15 * fill + 0.12 * sky;
    return [
      Math.min(0.92, baseColor[0] * lum + spec),
      Math.min(0.94, baseColor[1] * lum + spec),
      Math.min(0.96, baseColor[2] * lum + spec * 1.02)
    ];
  }

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

    const col = shadeMetal(baseColor, outNx, outNy, outNz, metallic === undefined ? 0.92 : metallic);
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

  // Oriented box in arbitrary orthonormal surface frame (axF = along handle, axU = up on facet, axN = outward normal)
  function addOrientedBox(verts, cols, indices, origin, axF, axU, axN, f0, f1, u0, u1, n0, n1, baseColor, metallic) {
    const pt = (fVal, uVal, nVal) => [
      origin[0] + axF[0] * fVal + axU[0] * uVal + axN[0] * nVal,
      origin[1] + axF[1] * fVal + axU[1] * uVal + axN[1] * nVal,
      origin[2] + axF[2] * fVal + axU[2] * uVal + axN[2] * nVal
    ];
    addHex(
      verts, cols, indices,
      pt(f0, u0, n0), pt(f1, u0, n0), pt(f1, u1, n0), pt(f0, u1, n0),
      pt(f0, u0, n1), pt(f1, u0, n1), pt(f1, u1, n1), pt(f0, u1, n1),
      baseColor, metallic
    );
  }

  // Compute side door window 4 corners locked cleanly inside A-pillar, roof rail, B-pillar & door beltline slot
  function getDoorWindowCorners(xBaseOffset, side) {
    const s = side;
    const isMounted = Math.abs(xBaseOffset) > 0.05;
    const dx = isMounted ? 0 : (-s * 0.166 + xBaseOffset);
    // Tucked strictly inside A-pillar (peakBotL), roof rail (bTopRailBotL), B-pillar (bWinFrontBotL) & door beltline!
    return {
      gFB: [s * 0.160 + dx, 0.141,  0.228], // Front-bottom seated inside door beltline rubber channel
      gFT: [s * 0.128 + dx, 0.340, -0.002], // Front-top tucked inside A-pillar & roof rail channel
      gRT: [s * 0.132 + dx, 0.316, -0.150], // Rear-top tucked inside roof rail & B-pillar channel
      gRB: [s * 0.162 + dx, 0.180, -0.128]  // Rear-bottom seated inside B-pillar base & rear beltline channel
    };
  }

  // Build double-faced standard see-through tempered door window glass (exact [0.6, 0.8, 1.0] engine glass material!)
  function buildDoorGlassMesh(verts, cols, indices, xBaseOffset, side) {
    const s = side;
    const { gFB, gFT, gRT, gRB } = getDoorWindowCorners(xBaseOffset, side);
    const outHint = [s * 0.98, 0.18, 0.04];
    const inHint  = [-s * 0.98, -0.18, -0.04];
    const thick   = 0.0022;
    const inset = (p) => [p[0] - s * thick, p[1] - 0.0004, p[2]];

    // Outer tempered glass face (metallic = 0 preserves exact [0.6, 0.8, 1.0] shader glass marker!)
    addQuad(verts, cols, indices, gFB, gRB, gRT, gFT, STANDARD_GLASS_COLOR, outHint, 0);
    // Inner tempered glass face (gives crisp positive Fresnel from inside cockpit with back-face culling ON!)
    addQuad(verts, cols, indices, inset(gFB), inset(gFT), inset(gRT), inset(gRB), STANDARD_GLASS_COLOR, inHint, 0);
  }

  // Build one sculpted origami door locked EXACTLY to cyber_car.js jamb/hip/sill vertices (zero seam gaps!)
  function buildDoorMesh(verts, cols, indices, xBaseOffset, side) {
    const s = side;
    const cSteelBright = [0.90, 0.92, 0.95];
    const cSteelMid    = [0.80, 0.82, 0.86];
    const cSteelLow    = [0.66, 0.68, 0.73];
    const cInnerCard   = [0.16, 0.17, 0.20];
    const cHandleDark  = [0.09, 0.10, 0.13];
    const cBezelMetal  = [0.36, 0.39, 0.44];
    const cSeamDark    = [0.12, 0.13, 0.15];
    const cAccentCyan  = [0.18, 0.88, 1.00];

    const isMounted = Math.abs(xBaseOffset) > 0.05;
    const xFTop = isMounted ? (s * 0.167) : (xBaseOffset + s * 0.008);
    const xFMid = isMounted ? (s * 0.169) : (xBaseOffset + s * 0.009);
    const xRTop = isMounted ? (s * 0.177) : (xBaseOffset + s * 0.012);
    const xRMid = isMounted ? (s * 0.184) : (xBaseOffset + s * 0.016);
    const xRBot = isMounted ? (s * 0.182) : (xBaseOffset + s * 0.014);
    const xFBot = isMounted ? (s * 0.171) : (xBaseOffset + s * 0.010);
    const xRidge = xBaseOffset + s * 0.040; // Bold origami diamond bulge
    const xIn    = xBaseOffset - s * 0.014;

    // Exact shared perimeter coordinates locked vertex-for-vertex to cyber_car.js jambTopL/jambMidL/jambBotL/hipTopL!
    const pFT = [xFTop,  0.144,  0.234]; // Overlaps jambTopL & A-pillar rabbet cleanly!
    const pFM = [xFMid,  0.045,  0.223]; // Exact collinear match with jambMidL!
    const pRT = [xRTop,  0.186, -0.188]; // Kisses hipTopL flush!
    const pRM = [xRMid,  0.036, -0.106]; // Kisses bladeMidL (diagonal red blade) flush!
    const pRB = [xRBot, -0.016,  0.025]; // Kisses sillMTopL (intake top corner) flush!
    const pFB = [xFBot, -0.022,  0.216]; // Overlaps jambBotL (front rocker top) cleanly!

    // Origami diamond ridge points across outer door skin
    const pCreaseF = [xRidge, 0.088,  0.125];
    const pCreaseR = [xRidge, 0.112, -0.068];

    // Inner cabin door card perimeter
    const iFT = [xIn,  0.142,  0.230];
    const iFM = [xIn,  0.045,  0.220];
    const iRT = [xIn,  0.184, -0.182];
    const iRM = [xIn,  0.036, -0.102];
    const iRB = [xIn, -0.016,  0.025];
    const iFB = [xIn, -0.020,  0.212];

    // === OUTER ORIGAMI BRUSHED STEEL FACETS (Watertight 3-vertex front seam!) ===
    addQuad(verts, cols, indices, pFT, pRT, pCreaseR, pCreaseF, cSteelBright, [s * 0.85, 0.52, 0.05], 1.0);
    addTri(verts, cols, indices, pFT, pCreaseF, pFM, cSteelMid, [s * 0.88, 0.08, 0.42], 0.95);
    addTri(verts, cols, indices, pFM, pCreaseF, pFB, cSteelMid, [s * 0.88, -0.06, 0.42], 0.93);
    addQuad(verts, cols, indices, pCreaseF, pCreaseR, pRB, pFB, cSteelLow, [s * 0.85, -0.52, 0.04], 0.92);
    addTri(verts, cols, indices, pCreaseR, pRM, pRB, cSteelLow, [s * 0.84, -0.46, -0.25], 0.90);
    addTri(verts, cols, indices, pRT, pRM, pCreaseR, cSteelMid, [s * 0.88, 0.12, -0.40], 0.95);

    // === INNER MATTE-CARBON DOOR CARD ===
    addQuad(verts, cols, indices, iFT, iFB, iRB, iRT, cInnerCard, [-s, 0, 0], 0.25);
    addTri(verts, cols, indices, iRT, iRB, iRM, cInnerCard, [-s, 0, 0], 0.25);

    // === SOLID PERIMETER THICKNESS EDGES ===
    addQuad(verts, cols, indices, iFT, iRT, pRT, pFT, cSteelBright, [0, 1, 0], 0.95);
    addQuad(verts, cols, indices, iFM, iFT, pFT, pFM, cSeamDark, [0, 0, 1], 0.4);
    addQuad(verts, cols, indices, iFB, iFM, pFM, pFB, cSeamDark, [0, 0, 1], 0.4);
    addQuad(verts, cols, indices, pFB, pRB, iRB, iFB, cSteelLow, [0, -1, 0], 0.7);
    addQuad(verts, cols, indices, pRB, pRM, iRM, iRB, cSeamDark, [0, -0.5, -0.85], 0.4);
    addQuad(verts, cols, indices, pRM, pRT, iRT, iRM, cSeamDark, [0, 0.2, -0.95], 0.4);

    // === SLEEK AUTOMOTIVE WINDOW BELTLINE RUBBER WEATHERSTRIP & SLIM GLASS TRIM ===
    const { gFB, gFT, gRT, gRB } = getDoorWindowCorners(xBaseOffset, side);
    const wOut = s * 0.0045;
    const wIn  = -s * 0.0045;
    // Matte-black horizontal rubber beltline squeegee molding hugging base of door glass (gFB -> gRB)
    addHex(
      verts, cols, indices,
      [gFB[0] + wIn,  gFB[1] - 0.001, gFB[2]], [gFB[0] + wOut, gFB[1] - 0.001, gFB[2]],
      [gFB[0] + wOut, gFB[1] + 0.006, gFB[2]], [gFB[0] + wIn,  gFB[1] + 0.006, gFB[2]],
      [gRB[0] + wIn,  gRB[1] - 0.001, gRB[2]], [gRB[0] + wOut, gRB[1] - 0.001, gRB[2]],
      [gRB[0] + wOut, gRB[1] + 0.006, gRB[2]], [gRB[0] + wIn,  gRB[1] + 0.006, gRB[2]],
      cHandleDark, 0.25
    );
    // Ultra-slim dark ceramic frit border framing standalone/mounted door glass edges (tucked inside roof/pillars)
    const addGlassBorder = (a, b, wX, wInward) => {
      const mx = (gFB[0] + gFT[0] + gRT[0] + gRB[0]) * 0.25;
      const my = (gFB[1] + gFT[1] + gRT[1] + gRB[1]) * 0.25;
      const mz = (gFB[2] + gFT[2] + gRT[2] + gRB[2]) * 0.25;
      const pullIn = (pt) => {
        const dx = mx - pt[0], dy = my - pt[1], dz = mz - pt[2];
        const l = Math.hypot(dx, dy, dz) || 1;
        return [pt[0] + (dx / l) * wInward, pt[1] + (dy / l) * wInward, pt[2] + (dz / l) * wInward];
      };
      const ai = pullIn(a), bi = pullIn(b);
      addHex(
        verts, cols, indices,
        [a[0] - s * wX, a[1], a[2]], [a[0] + s * wX, a[1], a[2]], [ai[0] + s * wX, ai[1], ai[2]], [ai[0] - s * wX, ai[1], ai[2]],
        [b[0] - s * wX, b[1], b[2]], [b[0] + s * wX, b[1], b[2]], [bi[0] + s * wX, bi[1], bi[2]], [bi[0] - s * wX, bi[1], bi[2]],
        cHandleDark, 0.25
      );
    };
    addGlassBorder(gFB, gFT, 0.0024, 0.0042);
    addGlassBorder(gFT, gRT, 0.0024, 0.0042);
    addGlassBorder(gRT, gRB, 0.0024, 0.0042);

    // === REAL-WORLD AUTOMOTIVE FLUSH-RECESSED SUPERCAR DOOR HANDLE ===
    // Computed directly on the exact 3D plane of the upper origami facet (pFT, pRT, pCreaseR) so it NEVER clips obliquely!
    {
      // Beltline unit vector from rear (pRT) toward front (pFT)
      const bfX = pFT[0] - pRT[0], bfY = pFT[1] - pRT[1], bfZ = pFT[2] - pRT[2];
      const bfL = Math.hypot(bfX, bfY, bfZ) || 1;
      const axF = [bfX / bfL, bfY / bfL, bfZ / bfL];

      // Vector from pRT down-outward to pCreaseR on the exact upper facet plane
      const drX = pCreaseR[0] - pRT[0], drY = pCreaseR[1] - pRT[1], drZ = pCreaseR[2] - pRT[2];
      // Outward plane normal N = cross(axF, dr) oriented toward +s X
      let nX = axF[1] * drZ - axF[2] * drY;
      let nY = axF[2] * drX - axF[0] * drZ;
      let nZ = axF[0] * drY - axF[1] * drX;
      const nL = Math.hypot(nX, nY, nZ) || 1;
      nX /= nL; nY /= nL; nZ /= nL;
      if (nX * s < 0) { nX = -nX; nY = -nY; nZ = -nZ; }
      const axN = [nX, nY, nZ];

      // In-plane "up" tangent axU orthogonal to both axF and axN (oriented toward +Y)
      let uX = axN[1] * axF[2] - axN[2] * axF[1];
      let uY = axN[2] * axF[0] - axN[0] * axF[2];
      let uZ = axN[0] * axF[1] - axN[1] * axF[0];
      const uL = Math.hypot(uX, uY, uZ) || 1;
      uX /= uL; uY /= uL; uZ /= uL;
      if (uY < 0) { uX = -uX; uY = -uY; uZ = -uZ; }
      const axU = [uX, uY, uZ];

      // Anchor handle cleanly on the upper-rear origami facet just below beltline & forward of rear edge!
      // Barycentric position strictly inside triangle (pFT, pRT, pCreaseR): 0.20*pFT + 0.56*pRT + 0.24*pCreaseR
      const hCenter = [
        pFT[0] * 0.20 + pRT[0] * 0.56 + pCreaseR[0] * 0.24,
        pFT[1] * 0.20 + pRT[1] * 0.56 + pCreaseR[1] * 0.24,
        pFT[2] * 0.20 + pRT[2] * 0.56 + pCreaseR[2] * 0.24
      ];

      // 1. Sculpted gunmetal outer perimeter bezel collar framing the recessed handle pocket (length = 0.068, height = 0.021)
      addOrientedBox(verts, cols, indices, hCenter, axF, axU, axN, -0.034,  0.034,  0.0075,  0.0108, -0.0012, 0.0024, cBezelMetal, 0.88);
      addOrientedBox(verts, cols, indices, hCenter, axF, axU, axN, -0.034,  0.034, -0.0108, -0.0075, -0.0012, 0.0024, cBezelMetal, 0.88);
      addOrientedBox(verts, cols, indices, hCenter, axF, axU, axN, -0.034, -0.029, -0.0108,  0.0108, -0.0012, 0.0024, cBezelMetal, 0.88);
      addOrientedBox(verts, cols, indices, hCenter, axF, axU, axN,  0.029,  0.034, -0.0108,  0.0108, -0.0012, 0.0024, cBezelMetal, 0.88);

      // 2. Deep matte-black recessed finger-pull well inside bezel (sits cleanly proud +0.0008 of skin -> zero Z-fighting!)
      addOrientedBox(verts, cols, indices, hCenter, axF, axU, axN, -0.0295, 0.0295, -0.0078, 0.0078, -0.0006, 0.0010, cHandleDark, 0.22);

      // 3. Rear stationary lock / capacitive touch-sensor escutcheon cap
      addOrientedBox(verts, cols, indices, hCenter, axF, axU, axN, -0.0285, -0.0155, -0.0052, 0.0052, 0.0010, 0.0044, cBezelMetal, 0.90);
      // Tiny dark sensor touch slot + micro cyan ambient unlock line on escutcheon
      addOrientedBox(verts, cols, indices, hCenter, axF, axU, axN, -0.0245, -0.0185, -0.0024, 0.0024, 0.0042, 0.0049, cHandleDark, 0.25);
      addOrientedBox(verts, cols, indices, hCenter, axF, axU, axN, -0.0162, -0.0148, -0.0044, 0.0044, 0.0038, 0.0048, cAccentCyan, 0);

      // 4. Front hinge pivot post + rear pull-arm standoffs lifting the sculpted pull-lever cleanly above the finger pocket!
      addOrientedBox(verts, cols, indices, hCenter, axF, axU, axN,  0.0205,  0.0285, -0.0046, 0.0046, 0.0010, 0.0044, cBezelMetal, 0.88);
      addOrientedBox(verts, cols, indices, hCenter, axF, axU, axN, -0.0125, -0.0075,  0.0005, 0.0052, 0.0010, 0.0038, cBezelMetal, 0.85);

      // 5. Sleek Ergonomic Brushed-Titanium Pull-Lever Bar (bridges over recessed pocket with real finger-pull clearance!)
      addOrientedBox(verts, cols, indices, hCenter, axF, axU, axN, -0.0135,  0.0275, -0.0046, 0.0050, 0.0034, 0.0064, cSteelBright, 1.00);
      // Chamfered upper specular bevel highlight strip along top crest of pull-lever
      addOrientedBox(verts, cols, indices, hCenter, axF, axU, axN, -0.0120,  0.0260,  0.0032, 0.0052, 0.0056, 0.0068, [0.95, 0.97, 0.99], 1.00);
    }

    // === INTERIOR ARMREST BOLSTER & METALLIC INTERIOR DOOR-RELEASE LATCH ===
    const aIn = xIn - s * 0.014;
    addHex(
      verts, cols, indices,
      [xIn, 0.068,  0.115], [xIn, 0.090, -0.075], [xIn, 0.065, -0.075], [xIn, 0.044,  0.115],
      [aIn, 0.068,  0.115], [aIn, 0.090, -0.075], [aIn, 0.065, -0.075], [aIn, 0.044,  0.115],
      [0.12, 0.13, 0.15], 0.3
    );
    // Sleek metallic interior release handle tucked inside upper door card
    const lIn = xIn - s * 0.006;
    addHex(
      verts, cols, indices,
      [xIn, 0.116,  0.056], [xIn, 0.116,  0.014], [xIn, 0.129,  0.014], [xIn, 0.129,  0.056],
      [lIn, 0.116,  0.056], [lIn, 0.116,  0.014], [lIn, 0.129,  0.014], [lIn, 0.129,  0.056],
      cSteelBright, 0.95
    );
  }

  function getOrCreateDoorPairTemplate() {
    if (_doorPairTemplate) return _doorPairTemplate;
    const verts = [], cols = [], indices = [];
    buildDoorMesh(verts, cols, indices, -0.166, -1); // Left door
    buildDoorMesh(verts, cols, indices,  0.166,  1); // Right door
    _doorPairTemplate = {
      verts: new Float32Array(verts),
      colors: new Float32Array(cols),
      indices: new Uint16Array(indices),
      vertCount: verts.length / 3
    };
    return _doorPairTemplate;
  }

  function getOrCreateSingleDoorTemplate() {
    if (_singleDoorTemplate) return _singleDoorTemplate;
    const verts = [], cols = [], indices = [];
    buildDoorMesh(verts, cols, indices, 0.0, -1);
    _singleDoorTemplate = {
      verts: new Float32Array(verts),
      colors: new Float32Array(cols),
      indices: new Uint16Array(indices),
      vertCount: verts.length / 3
    };
    return _singleDoorTemplate;
  }

  function getOrCreateDoorPairGlassTemplate() {
    if (_doorPairGlassTemplate) return _doorPairGlassTemplate;
    const verts = [], cols = [], indices = [];
    buildDoorGlassMesh(verts, cols, indices, -0.166, -1); // Left door glass
    buildDoorGlassMesh(verts, cols, indices,  0.166,  1); // Right door glass
    _doorPairGlassTemplate = {
      verts: new Float32Array(verts),
      colors: new Float32Array(cols),
      indices: new Uint16Array(indices),
      vertCount: verts.length / 3
    };
    return _doorPairGlassTemplate;
  }

  function getOrCreateSingleDoorGlassTemplate() {
    if (_singleDoorGlassTemplate) return _singleDoorGlassTemplate;
    const verts = [], cols = [], indices = [];
    buildDoorGlassMesh(verts, cols, indices, 0.0, -1);
    _singleDoorGlassTemplate = {
      verts: new Float32Array(verts),
      colors: new Float32Array(cols),
      indices: new Uint16Array(indices),
      vertCount: verts.length / 3
    };
    return _singleDoorGlassTemplate;
  }

  function emitTemplate(tpl, origin, scale, r, n, f, vertices, colors, indices, isPreview, previewColor) {
    const tVerts = tpl.verts;
    const tCols = tpl.colors;
    const tIndices = tpl.indices;
    const vCount = tpl.vertCount;
    const baseIdx = vertices.length / 3;

    const cx = origin[0], cy = origin[1], cz = origin[2];
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

  window.drawCyberCarDoors = function(p, r, n, f, vertices, colors, indices, isPreview, previewColor) {
    const carScale = window.CYBER_CAR_SCALE || 0.36;
    emitTemplate(getOrCreateDoorPairTemplate(), p, carScale, r, n, f, vertices, colors, indices, isPreview, previewColor);
  };

  window.emitCyberCarDoorGlass = function(p, r, n, f, vertices, colors, indices) {
    const carScale = window.CYBER_CAR_SCALE || 0.36;
    emitTemplate(getOrCreateDoorPairGlassTemplate(), p, carScale, r, n, f, vertices, colors, indices, false, null);
  };

  window.emitCyberCarSingleDoorGlass = function(item, vertices, colors, indices) {
    if (!item || item.isPreview) return;
    const p = item.position;
    if (!p) return;
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
    const scale = (item.size || 0.25) * 4.0 * carScale;
    const lift = 0.024 * scale;
    const basePos = [p[0] + n[0] * lift, p[1] + n[1] * lift, p[2] + n[2] * lift];
    emitTemplate(getOrCreateSingleDoorGlassTemplate(), basePos, scale, r, n, f, vertices, colors, indices, false, null);
  };

  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["cyber_car_door"] = {
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
        window.drawCyberCarDoors(snapPos, r, n, f, vertices, colors, indices, true, previewColor);
        return;
      }

      const scale = (item.size || 0.25) * 4.0 * carScale;
      const lift = 0.024 * scale;
      const basePos = [
        p[0] + n[0] * lift,
        p[1] + n[1] * lift,
        p[2] + n[2] * lift
      ];
      emitTemplate(getOrCreateSingleDoorTemplate(), basePos, scale, r, n, f, vertices, colors, indices, isPreview, previewColor);
    }
  };
})();
