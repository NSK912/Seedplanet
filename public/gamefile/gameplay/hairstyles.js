// === SEEDPLANET MODULE: JS/GAMEPLAY/HAIRSTYLES.JS ===
// 3D Stylized Anime Hair Generator
// Provides 100% full scalp coverage with 10+ dense staggered 3D hair strand layers covering 360° of the skull.

window.ANIME_HAIR_COLORS = [
  [0.85, 0.90, 0.96], // 0: Platinum Silver / Ice Blue
  [0.18, 0.18, 0.22], // 1: Jet Black / Raven
  [0.88, 0.72, 0.52], // 2: Blonde Gold
  [0.72, 0.35, 0.22], // 3: Chestnut Brown
  [0.85, 0.45, 0.55], // 4: Sakura Pink
  [0.45, 0.65, 0.85], // 5: Sky Blue
  [0.55, 0.40, 0.70], // 6: Deep Purple
];

window.NUM_HAIR_STYLES = 1;

window.HAIR_STYLE_NAMES = [
  "Anime Stylized Hair (ทรงผมอนิเมะ 3D ละเอียด 10 ชั้น)",
];

window.build3DAnimeHair = function(
  styleIdx,
  color,
  scale,
  ptTransformFn,
  headTilt,
  outV,
  outC,
  outI
) {
  // 1. UNIFORM HAIR COLOR ACCURACY
  const colBase = (color && Array.isArray(color) && color.length >= 3)
    ? [color[0], color[1], color[2]]
    : [0.85, 0.90, 0.96]; // Default Silver/Platinum

  const bo = headTilt || 0;

  // Add vertex with light shading factor
  const addVertex = (localP, shadeFactor = 1.0) => {
    const p = ptTransformFn(localP[0], localP[1] + bo, localP[2]);
    const vIdx = outV.length / 3;
    outV.push(p[0], p[1], p[2]);
    outC.push(
      Math.min(1.0, Math.max(0.0, colBase[0] * shadeFactor)),
      Math.min(1.0, Math.max(0.0, colBase[1] * shadeFactor)),
      Math.min(1.0, Math.max(0.0, colBase[2] * shadeFactor))
    );
    return vIdx;
  };

  const addTri = (v1, v2, v3) => {
    outI.push(v1, v2, v3);
  };

  // Double-sided quad (renders both CCW & CW to guarantee 360° visibility)
  const addTwoSidedQuad = (v1, v2, v3, v4) => {
    // Front face
    outI.push(v1, v2, v3);
    outI.push(v1, v3, v4);
    // Back face
    outI.push(v1, v4, v3);
    outI.push(v1, v3, v2);
  };

  // ----------------------------------------------------
  // 2. HAIRLINE BOUNDARY FUNCTION (ขอบไรผมรอบศีรษะ)
  // Head sphere radius R_HEAD = 0.240
  // Hair dome sits outside head sphere at R = 0.255
  // ----------------------------------------------------
  const getHairlineMinElevation = (azDeg) => {
    let az = azDeg;
    while (az > 180) az -= 360;
    while (az < -180) az += 360;
    const absAz = Math.abs(az);

    if (absAz < 60) {
      // Forehead hairline (Above eyebrows)
      const t = absAz / 60;
      return 28.0 - 14.0 * (t * t); // 28° center -> 14° temples
    } else if (absAz < 95) {
      // Temples down to sideburns
      const t = (absAz - 60) / 35;
      return 14.0 - 46.0 * t; // 14° -> -32°
    } else {
      // Back of head & deep nape (ท้ายทอย คลุมลึกลงถึงระดับลำคอ)
      const t = (absAz - 95) / 85;
      return -32.0 - 28.0 * t; // -32° -> -60°
    }
  };

  // Calculates scalp root coordinates and normal on hair dome
  const getHairRoot = (azimuthDeg, elevationDeg, radiusOffset = 0.015) => {
    const minEl = getHairlineMinElevation(azimuthDeg);
    const safeEl = Math.max(elevationDeg, minEl);

    const az = (azimuthDeg * Math.PI) / 180;
    const el = (safeEl * Math.PI) / 180;

    const cosEl = Math.cos(el);
    const sinEl = Math.sin(el);
    const sinAz = Math.sin(az);
    const cosAz = Math.cos(az);

    const r = 0.240 + radiusOffset; // Hair sits outside head sphere (R=0.240)

    const x = r * sinAz * cosEl;
    const y = r * sinEl;
    const z = r * cosAz * cosEl;

    return {
      p: [x, y, z],
      n: [sinAz * cosEl, sinEl, cosAz * cosEl],
      azDeg: azimuthDeg,
      elDeg: safeEl,
    };
  };

  // ----------------------------------------------------
  // 3. SOLID 3D BASE HAIR DOME CAP (หมวกทรงผมรองพื้นปิดศีรษะ 100% ไร้รอยโหว่)
  // High-density grid that fully encloses the head sphere
  // ----------------------------------------------------
  const addSolidHairDome = () => {
    const nLon = 24;
    const nLat = 10;
    const grid = [];

    for (let lon = 0; lon <= nLon; lon++) {
      const azDeg = -180 + (lon / nLon) * 360;
      const minEl = getHairlineMinElevation(azDeg);
      const maxEl = 88.0;

      const col = [];
      for (let lat = 0; lat <= nLat; lat++) {
        const u = lat / nLat;
        const elDeg = minEl + u * (maxEl - minEl);
        // Base Cap radius R = 0.255 (0.240 + 0.015 offset)
        const root = getHairRoot(azDeg, elDeg, 0.015);
        // Subtle vertical lighting gradient
        const shade = 0.86 + 0.14 * u;
        col.push(addVertex(root.p, shade));
      }
      grid.push(col);
    }

    // Connect dome grid cells with double-sided quads
    for (let lon = 0; lon < nLon; lon++) {
      for (let lat = 0; lat < nLat; lat++) {
        const v1 = grid[lon][lat];
        const v2 = grid[lon + 1][lat];
        const v3 = grid[lon + 1][lat + 1];
        const v4 = grid[lon][lat + 1];
        addTwoSidedQuad(v1, v2, v3, v4);
      }
    }

    // Seal top crown zenith cap
    const vZenith = addVertex([0, 0.256, 0], 1.00);
    for (let lon = 0; lon < nLon; lon++) {
      const v1 = grid[lon][nLat];
      const v2 = grid[lon + 1][nLat];
      addTri(vZenith, v2, v1);
      addTri(vZenith, v1, v2);
    }
  };

  // ----------------------------------------------------
  // 4. HIGH-PRECISION 3D ANIME HAIR STRAND GENERATOR
  // Creates voluminous 3D anime hair locks with natural gravity droop & Bezier curvature
  // ----------------------------------------------------
  const addHairStrand = (
    rootAz, rootEl,            // Scalp Root Angles
    length,                    // Strand Length
    archOut,                   // Bulge distance from scalp
    dirX, dirY, dirZ,          // Direction vector
    wStart = 0.038,            // Broad root width
    wMid = 0.065,              // Volumetric mid width
    thick = 0.016,             // 3D Volume thickness
    steps = 6,                 // Smooth organic curve divisions
    shadeRoot = 0.86,
    shadeTip = 1.00,
    radiusOffset = 0.018,
    gravity = 0.06             // Soft natural gravity droop on hair tips
  ) => {
    // Root on scalp hair layer
    const root = getHairRoot(rootAz, rootEl, radiusOffset);
    const P0 = root.p;
    const N = root.n;

    const fLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ) || 1;
    const D = [dirX / fLen, dirY / fLen, dirZ / fLen];

    // Bezier control points sprouting out from scalp normal N and curving with graceful natural gravity
    const P1 = [
      P0[0] + N[0] * (archOut * 1.25) + D[0] * (length * 0.42),
      P0[1] + N[1] * (archOut * 1.25) + D[1] * (length * 0.42) - gravity * 0.4,
      P0[2] + N[2] * (archOut * 1.25) + D[2] * (length * 0.42),
    ];
    const P2 = [
      P0[0] + N[0] * (archOut * 0.25) + D[0] * length,
      P0[1] + N[1] * (archOut * 0.25) + D[1] * length - gravity * 1.1,
      P0[2] + N[2] * (archOut * 0.25) + D[2] * length,
    ];

    const rings = [];

    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const invU = 1 - u;

      // Quadratic Bezier curve point P(u)
      const px = invU * invU * P0[0] + 2 * invU * u * P1[0] + u * u * P2[0];
      const py = invU * invU * P0[1] + 2 * invU * u * P1[1] + u * u * P2[1];
      const pz = invU * invU * P0[2] + 2 * invU * u * P1[2] + u * u * P2[2];
      const currP = [px, py, pz];

      // Local tangent vector T(u) = dP/du along Bezier curve
      let tx = 2 * (invU * (P1[0] - P0[0]) + u * (P2[0] - P1[0]));
      let ty = 2 * (invU * (P1[1] - P0[1]) + u * (P2[1] - P1[1]));
      let tz = 2 * (invU * (P1[2] - P0[2]) + u * (P2[2] - P1[2]));
      let tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (tLen < 0.0001) {
        tx = D[0]; ty = D[1]; tz = D[2]; tLen = 1;
      }
      const T = [tx / tLen, ty / tLen, tz / tLen];

      // Binormal vector across hair strand width
      let bx = N[1] * T[2] - N[2] * T[1];
      let by = N[2] * T[0] - N[0] * T[2];
      let bz = N[0] * T[1] - N[1] * T[0];
      let bLen = Math.sqrt(bx * bx + by * by + bz * bz);
      if (bLen < 0.001) {
        bx = 1; by = 0; bz = 0; bLen = 1;
      }
      const B = [bx / bLen, by / bLen, bz / bLen];

      // Strand Normal vector
      const StrandN = [
        B[1] * T[2] - B[2] * T[1],
        B[2] * T[0] - B[0] * T[2],
        B[0] * T[1] - B[1] * T[0],
      ];

      let w = (u < 0.25) ? (1 - u / 0.25) * wStart + (u / 0.25) * wMid : (1 - (u - 0.25) / 0.75) * wMid;
      let t = (1 - u * 0.75) * thick;

      const curShade = shadeRoot + u * (shadeTip - shadeRoot);

      if (s === steps || w <= 0.002) {
        // Tapered sharp tip point
        const vTip = addVertex(currP, curShade);
        rings.push([vTip, vTip, vTip, vTip]);
      } else {
        const vTop   = addVertex([currP[0] + StrandN[0] * t, currP[1] + StrandN[1] * t, currP[2] + StrandN[2] * t], curShade);
        const vRight = addVertex([currP[0] + B[0] * w, currP[1] + B[1] * w, currP[2] + B[2] * w], curShade * 0.96);
        const vBot   = addVertex([currP[0] - StrandN[0] * t, currP[1] - StrandN[1] * t, currP[2] - StrandN[2] * t], curShade * 0.92);
        const vLeft  = addVertex([currP[0] - B[0] * w, currP[1] - B[1] * w, currP[2] - B[2] * w], curShade * 0.96);

        rings.push([vTop, vRight, vBot, vLeft]);
      }
    }

    // Connect rings into 3D volume mesh with double-sided quads
    for (let s = 0; s < steps; s++) {
      const r1 = rings[s];
      const r2 = rings[s + 1];

      if (s === steps - 1) {
        const vTip = r2[0];
        addTwoSidedQuad(r1[0], r1[1], vTip, r1[0]);
        addTwoSidedQuad(r1[1], r1[2], vTip, r1[1]);
        addTwoSidedQuad(r1[2], r1[3], vTip, r1[2]);
        addTwoSidedQuad(r1[3], r1[0], vTip, r1[3]);
      } else {
        addTwoSidedQuad(r1[0], r1[1], r2[1], r2[0]);
        addTwoSidedQuad(r1[1], r1[2], r2[2], r2[1]);
        addTwoSidedQuad(r1[2], r1[3], r2[3], r2[2]);
        addTwoSidedQuad(r1[3], r1[0], r2[0], r2[3]);
      }
    }
  };

  // Helper function to render a full circular ring of staggered strands around the skull
  const addStrandRing = (
    numStrands,
    elevationDeg,
    azimuthOffsetDeg,
    length,
    archOut,
    wStart,
    wMid,
    thick,
    radiusOffset,
    downSlope = 0.80
  ) => {
    for (let i = 0; i < numStrands; i++) {
      const az = -180 + (i / numStrands) * 360 + azimuthOffsetDeg;
      const isFront = Math.abs(az) < 55;
      const rad = (az * Math.PI) / 180;

      // Flow direction outwards and downwards
      const fx = Math.sin(rad) * 0.80;
      const fy = -downSlope;
      const fz = Math.cos(rad) * 0.80;

      const actualLen = isFront && elevationDeg < 45 ? length * 0.60 : length;

      addHairStrand(
        az, elevationDeg,
        actualLen, archOut,
        fx, fy, fz,
        wStart, wMid, thick, 6, 0.86, 0.98, radiusOffset
      );
    }
  };

  // ----------------------------------------------------
  // 5. BUILD COMPLETE 10-LAYER DENSE 360° ANIME HAIR MESH
  // ----------------------------------------------------

  // Layer 0: Solid base cap (100% full scalp seal)
  addSolidHairDome();

  // Layer 1: Top Crown Zenith (elevation = +80°, 12 strands)
  addStrandRing(12, 80, 0, 0.22, 0.040, 0.035, 0.055, 0.014, 0.018, 0.65);

  // Layer 2: Upper Crown Ring (elevation = +68°, 20 strands, staggered offset)
  addStrandRing(20, 68, (360 / 20) / 2, 0.25, 0.038, 0.038, 0.062, 0.015, 0.020, 0.70);

  // Layer 3: High Skull Ring (elevation = +54°, 26 strands)
  addStrandRing(26, 54, 0, 0.28, 0.036, 0.040, 0.065, 0.015, 0.022, 0.75);

  // Layer 4: Mid-Upper Skull Ring (elevation = +40°, 30 strands, staggered offset)
  addStrandRing(30, 40, (360 / 30) / 2, 0.32, 0.034, 0.042, 0.068, 0.016, 0.024, 0.80);

  // Layer 5: Mid Skull Ring (elevation = +26°, 32 strands)
  addStrandRing(32, 26, 0, 0.35, 0.032, 0.042, 0.070, 0.016, 0.026, 0.82);

  // Layer 6: Lower Skull Ring (elevation = +12°, 30 strands, staggered offset)
  addStrandRing(30, 12, (360 / 30) / 2, 0.36, 0.030, 0.044, 0.070, 0.016, 0.028, 0.85);

  // Layer 7: Lower Head & Ear Line (elevation = -2°, 28 strands)
  addStrandRing(28, -2, 0, 0.38, 0.028, 0.044, 0.068, 0.016, 0.030, 0.88);

  // Layer 8: Upper Nape & Neck Coverage (elevation = -16°, 24 strands, staggered offset)
  addStrandRing(24, -16, (360 / 24) / 2, 0.36, 0.025, 0.042, 0.065, 0.015, 0.032, 0.90);

  // Layer 9: Deep Nape & Lower Neck Coverage (elevation = -30°, 20 strands)
  addStrandRing(20, -30, 0, 0.32, 0.022, 0.040, 0.060, 0.015, 0.034, 0.92);

  // Layer 10: Lowest Neck Boundary (elevation = -44°, 16 strands)
  addStrandRing(16, -44, (360 / 16) / 2, 0.28, 0.018, 0.038, 0.055, 0.014, 0.036, 0.95);

  // ----------------------------------------------------
  // 6. SPECIALIZED FACE FRAMING, BANGS & ANIME STYLES
  // ----------------------------------------------------

  // Layer 11: Inner Forehead Bangs (15 overlapping close bangs)
  for (let i = 0; i <= 14; i++) {
    const az = -56 + (i / 14) * 112; // -56° to +56°
    const t = Math.abs(az) / 56;
    const bangLen = 0.15 + 0.06 * t;
    const rad = (az * Math.PI) / 180;
    addHairStrand(
      az, 36,
      bangLen, 0.028,
      Math.sin(rad) * 0.35, -0.85, Math.cos(rad) * 0.65,
      0.028, 0.052, 0.014, 6, 0.94, 1.00, 0.032
    );
  }

  // Layer 12: Outer Swept Bangs (13 layered outer bangs)
  for (let i = 0; i <= 12; i++) {
    const az = -50 + (i / 12) * 100;
    const t = Math.abs(az) / 50;
    const bangLen = 0.18 + 0.07 * t;
    const rad = (az * Math.PI) / 180;
    addHairStrand(
      az, 46,
      bangLen, 0.038,
      Math.sin(rad) * 0.45, -0.80, Math.cos(rad) * 0.70,
      0.032, 0.058, 0.015, 6, 0.96, 1.00, 0.038
    );
  }

  // Layer 13: Sideburns & Cheek Framing Locks (ปอยผมข้างแก้มและจรไทร)
  addHairStrand(-68, 18, 0.28, 0.032, -0.75, -0.85, 0.10, 0.036, 0.055, 0.015, 7, 0.92, 0.98, 0.035);
  addHairStrand( 68, 18, 0.28, 0.032,  0.75, -0.85, 0.10, 0.036, 0.055, 0.015, 7, 0.92, 0.98, 0.035);

  addHairStrand(-82, 8, 0.32, 0.034, -0.82, -0.85, -0.15, 0.038, 0.058, 0.015, 7, 0.90, 0.96, 0.035);
  addHairStrand( 82, 8, 0.32, 0.034,  0.82, -0.85, -0.15, 0.038, 0.058, 0.015, 7, 0.90, 0.96, 0.035);

  // Layer 14: Volumetric Crown Anime Spikes & Ahoge (ปอยผมชี้อนิเมะ)
  addHairStrand(-35, 62, 0.20, 0.048, -0.5, -0.65, 0.2, 0.032, 0.050, 0.014, 6, 0.98, 1.00, 0.040);
  addHairStrand( 35, 62, 0.20, 0.048,  0.5, -0.65, 0.2, 0.032, 0.050, 0.014, 6, 0.98, 1.00, 0.040);

  addHairStrand(-72, 54, 0.26, 0.050, -0.8, -0.55, -0.1, 0.034, 0.052, 0.015, 6, 0.96, 1.00, 0.040);
  addHairStrand( 72, 54, 0.26, 0.050,  0.8, -0.55, -0.1, 0.034, 0.052, 0.015, 6, 0.96, 1.00, 0.040);

  // Ahoge (ขวัญผมชี้อนิเมะยอดหัว)
  addHairStrand(0, 84, 0.22, 0.065, -0.2, 0.65, 0.35, 0.020, 0.035, 0.012, 6, 1.00, 1.00, 0.042);
};
