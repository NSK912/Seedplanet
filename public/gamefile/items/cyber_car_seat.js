// === SEEDPLANET MODULE: JS/ITEMS/CYBER_CAR_SEAT.JS ===
// Raised-Base Racing Bucket Seat + Dual Side-Stick Drive-by-Wire Control Console (CW-outward + Studio Shading)
// Elevates driver H-point to clear windshield eye-line without modifying chassis hull.
// Live Stick Animations:
//   - Left Stick (+R / Driver Left):  Pitches forward (W) / backward (S) via stickThrottle
//   - Right Stick (-R / Driver Right): Tilts left (A) / right (D) via stickSteer

(function() {
  let _seatStandaloneTemplate = null;
  let _seatMountedStaticTemplate = null;
  let _sideStickTemplate = null;

  // Single source of truth shared with player.js for eye-level H-point elevation & exact 2-bone Arm IK!
  const SEAT_CONFIG = {
    floorY: -0.066,
    seatRise: 0.084,       // Raises seat base + driver H-point to mid-windshield eye-line
    seatBaseY: 0.018,      // floorY + seatRise
    seatBack: -0.012,      // Driver seated Z in Cyber Car local space
    seatZ: -0.024,         // Bucket seat local Z origin
    stickX: 0.054,         // ±X offset for Left (+R) and Right (-R) Side-Stick gimbal pivots
    stickPivY: 0.104,      // Gimbal pivot Y in Cyber Car local space
    stickPivZ: 0.014,      // Gimbal pivot Z in Cyber Car local space
    gripH: 0.042,          // Distance from gimbal pivot up to ergonomic pistol-grip palm center
    maxStickRad: 0.34      // ±19.5° crisp stick deflection
  };
  window.CYBER_CAR_SEAT_CONFIG = SEAT_CONFIG;

  function shadeColor(baseColor, nx, ny, nz, metallic) {
    if (metallic === 0) return [baseColor[0], baseColor[1], baseColor[2]];
    const key = Math.max(0, nx * 0.36 + ny * 0.82 + nz * 0.44);
    const fill = Math.max(0, -nx * 0.40 + ny * 0.32 - nz * 0.32);
    const sky = 0.5 + 0.5 * ny;
    const spec = metallic > 0.4 ? Math.pow(Math.max(0, nx * 0.22 + ny * 0.88 + nz * 0.42), 6.0) * 0.22 * metallic : 0;
    const lum = 0.50 + 0.38 * key + 0.16 * fill + 0.12 * sky;
    return [
      Math.min(1, baseColor[0] * lum + spec),
      Math.min(1, baseColor[1] * lum + spec),
      Math.min(1, baseColor[2] * lum + spec)
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

    const col = shadeColor(baseColor, outNx, outNy, outNz, metallic === undefined ? 0.35 : metallic);
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

  // Properly signed right-handed local box with CW-outward winding
  function addBoxCW(verts, cols, indices, center, w, h, d, baseColor, pitchBack, yaw, roll, metallic) {
    let r = [1, 0, 0], n = [0, 1, 0], f = [0, 0, 1];
    if (pitchBack) {
      const c = Math.cos(pitchBack), s = Math.sin(pitchBack);
      n = [0, c, -s];
      f = [0, s,  c];
    }
    if (yaw) {
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const nr = [r[0] * c + f[0] * s, r[1] * c + f[1] * s, r[2] * c + f[2] * s];
      const nf = [-r[0] * s + f[0] * c, -r[1] * s + f[1] * c, -r[2] * s + f[2] * c];
      r = nr; f = nf;
    }
    if (roll) {
      const c = Math.cos(roll), s = Math.sin(roll);
      const nr = [r[0] * c + n[0] * s, r[1] * c + n[1] * s, r[2] * c + n[2] * s];
      const nn = [-r[0] * s + n[0] * c, -r[1] * s + n[1] * c, -r[2] * s + n[2] * c];
      r = nr; n = nn;
    }
    const hw = w * 0.5, hh = h * 0.5, hd = d * 0.5;
    const cx = center[0], cy = center[1], cz = center[2];
    const pt = (sx, sy, sz) => [
      cx + r[0] * (sx * hw) + n[0] * (sy * hh) + f[0] * (sz * hd),
      cy + r[1] * (sx * hw) + n[1] * (sy * hh) + f[1] * (sz * hd),
      cz + r[2] * (sx * hw) + n[2] * (sy * hh) + f[2] * (sz * hd)
    ];
    const p000 = pt(-1, -1, -1), p100 = pt(1, -1, -1), p110 = pt(1, 1, -1), p010 = pt(-1, 1, -1);
    const p001 = pt(-1, -1, 1),  p101 = pt(1, -1, 1),  p111 = pt(1, 1, 1),  p011 = pt(-1, 1, 1);
    addQuad(verts, cols, indices, p001, p101, p111, p011, baseColor, f, metallic);
    addQuad(verts, cols, indices, p100, p000, p010, p110, baseColor, [-f[0], -f[1], -f[2]], metallic);
    addQuad(verts, cols, indices, p011, p111, p110, p010, baseColor, n, metallic);
    addQuad(verts, cols, indices, p000, p100, p101, p001, baseColor, [-n[0], -n[1], -n[2]], metallic);
    addQuad(verts, cols, indices, p101, p100, p110, p111, baseColor, r, metallic);
    addQuad(verts, cols, indices, p000, p001, p011, p010, baseColor, [-r[0], -r[1], -r[2]], metallic);
  }

  // Vertical octagonal/cylindrical frustum along Y (used for gimbal bellows, red LED collar & stick shaft)
  function addFrustumY(verts, cols, indices, cx, cz, y0, y1, r0x, r0z, r1x, r1z, segs, baseColor, metallic) {
    const c0 = [cx, y0, cz];
    const c1 = [cx, y1, cz];
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2 + Math.PI / segs;
      const a1 = ((i + 1) / segs) * Math.PI * 2 + Math.PI / segs;
      const midA = (a0 + a1) * 0.5;
      const p0a = [cx + Math.cos(a0) * r0x, y0, cz + Math.sin(a0) * r0z];
      const p0b = [cx + Math.cos(a1) * r0x, y0, cz + Math.sin(a1) * r0z];
      const p1a = [cx + Math.cos(a0) * r1x, y1, cz + Math.sin(a0) * r1z];
      const p1b = [cx + Math.cos(a1) * r1x, y1, cz + Math.sin(a1) * r1z];
      addQuad(verts, cols, indices, p0a, p0b, p1b, p1a, baseColor, [Math.cos(midA), 0.15, Math.sin(midA)], metallic);
      addTri(verts, cols, indices, c0, p0b, p0a, baseColor, [0, -1, 0], metallic);
      addTri(verts, cols, indices, c1, p1a, p1b, baseColor, [0,  1, 0], metallic);
    }
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

  // Build one sculpted Dual Side-Stick Control Joystick centered at gimbal pivot (0, 0, 0)
  // Matches reference: dark rubber bellows collar + ergonomic contoured matte-black pistol grip
  // + faceted brushed-silver fighter-jet thumb-head crown + dark button cluster + cyan/red micro-LEDs!
  function buildSideStickGeometry(verts, cols, indices, ox, oy, oz) {
    const cSilver      = [0.80, 0.83, 0.87]; // Brushed titanium/silver grip crown
    const cSilverDark  = [0.56, 0.59, 0.64]; // Chamfered lower crown bevel
    const cGripMatte   = [0.14, 0.15, 0.18]; // Matte-black ergonomic rubberized shaft
    const cRubber      = [0.10, 0.11, 0.13]; // Accordion bellows boot
    const cBtnDark     = [0.22, 0.24, 0.28]; // Tactile thumb hat switches
    const cRedLed      = [0.96, 0.18, 0.22]; // Crimson accent indicator
    const cCyanLed     = [0.18, 0.90, 1.00]; // Cyan telemetry indicator

    // 1. Dynamic upper accordion bellows rings moving smoothly with stick shaft
    addFrustumY(verts, cols, indices, ox, oz, oy - 0.002, oy + 0.004, 0.0110, 0.0110, 0.0092, 0.0092, 8, cRubber, 0.22);
    addFrustumY(verts, cols, indices, ox, oz, oy + 0.004, oy + 0.010, 0.0094, 0.0094, 0.0074, 0.0074, 8, cRubber, 0.22);

    // 2. Ergonomic matte-black contoured joystick shaft (palm wraps cleanly at y = oy + 0.028..0.044)
    addFrustumY(verts, cols, indices, ox, oz, oy + 0.009, oy + 0.024, 0.0064, 0.0072, 0.0072, 0.0086, 8, cGripMatte, 0.30);
    addFrustumY(verts, cols, indices, ox, oz, oy + 0.024, oy + 0.042, 0.0072, 0.0086, 0.0082, 0.0102, 8, cGripMatte, 0.32);
    // Front index-finger trigger bump
    addBoxCW(verts, cols, indices, [ox, oy + 0.036, oz + 0.010], 0.007, 0.012, 0.006, cSilverDark, -0.20, 0, 0, 0.85);

    // 3. Sculpted Faceted Brushed-Silver V-Head Crown (exact reference fighter-jet joystick head!)
    addBoxCW(verts, cols, indices, [ox, oy + 0.048, oz + 0.001], 0.020, 0.016, 0.018, cSilver, 0.28, 0, 0, 0.96);
    // Upper tapered silver bevel brow
    addBoxCW(verts, cols, indices, [ox, oy + 0.056, oz + 0.002], 0.016, 0.006, 0.015, cSilverDark, 0.28, 0, 0, 0.92);
    // Dark recessed angled thumb-control face (facing back toward driver -Z!)
    addBoxCW(verts, cols, indices, [ox, oy + 0.049, oz - 0.0075], 0.0155, 0.0135, 0.004, cRubber, 0.28, 0, 0, 0.28);
    // Tactile thumb hat-switches & glowing micro-LED indicators on head face
    addBoxCW(verts, cols, indices, [ox - 0.0042, oy + 0.052, oz - 0.0095], 0.0045, 0.0045, 0.0035, cBtnDark, 0.28, 0, 0, 0.55);
    addBoxCW(verts, cols, indices, [ox + 0.0042, oy + 0.052, oz - 0.0095], 0.0045, 0.0045, 0.0035, cBtnDark, 0.28, 0, 0, 0.55);
    addBoxCW(verts, cols, indices, [ox, oy + 0.0455, oz - 0.0092], 0.0050, 0.0035, 0.0030, cCyanLed, 0.28, 0, 0, 0);
    addBoxCW(verts, cols, indices, [ox - 0.0042, oy + 0.052, oz - 0.0110], 0.0022, 0.0022, 0.0015, cRedLed, 0.28, 0, 0, 0);
  }

  function getOrCreateSideStickTemplate() {
    if (_sideStickTemplate) return _sideStickTemplate;
    const verts = [], cols = [], indices = [];
    buildSideStickGeometry(verts, cols, indices, 0, 0, 0);
    _sideStickTemplate = {
      verts: new Float32Array(verts),
      colors: new Float32Array(cols),
      indices: new Uint16Array(indices),
      vertCount: verts.length / 3
    };
    return _sideStickTemplate;
  }

  // Build Raised-Base Racing Bucket Seat + Sculpted Brushed-Silver Dual Side-Stick Armrest Consoles
  function buildDualStickBucketSeat(verts, cols, indices, floorY, baseY, baseZ, includeFootPedals, includeStaticSticks) {
    const cAlcantara   = [0.16, 0.17, 0.20]; // Matte black racing seat fabric
    const cLeather     = [0.24, 0.25, 0.29]; // Sculpted leather bolsters & elbow pads
    const cCarbonShell = [0.12, 0.13, 0.16]; // Rear carbon-fiber bucket shell & structural subframe
    const cSilver      = [0.78, 0.81, 0.86]; // Brushed silver armrest & gimbal pod (matches reference!)
    const cSilverDark  = [0.52, 0.55, 0.60]; // Beveled titanium risers & rails
    const cRubber      = [0.09, 0.10, 0.12]; // Gimbal rubber boot & dark console inlays
    const cRedGlow     = [0.96, 0.16, 0.20]; // Glowing crimson gimbal ambient LED ring + racing stitch
    const cHudCyan     = [0.18, 0.88, 1.00]; // Subtle cyan console status LED

    const rise = baseY - floorY;

    // === 1. BOLTED RAISED AEROSPACE SEAT RISER PEDESTAL (floorY -> baseY, zero floating!) ===
    if (rise > 0.005) {
      // Heavy floor-bolted titanium anchor rails
      addBoxCW(verts, cols, indices, [-0.058, floorY + 0.006, baseZ + 0.008], 0.024, 0.012, 0.158, cSilverDark, 0, 0, 0, 0.85);
      addBoxCW(verts, cols, indices, [ 0.058, floorY + 0.006, baseZ + 0.008], 0.024, 0.012, 0.158, cSilverDark, 0, 0, 0, 0.85);
      // Central structural matte-carbon pedestal core housing electronics & actuators
      addBoxCW(verts, cols, indices, [0.000, floorY + rise * 0.50, baseZ + 0.002], 0.088, rise * 0.92, 0.126, cCarbonShell, 0, 0, 0, 0.45);
      // Four machined brushed-titanium diagonal riser legs + side X-brace struts
      for (let s of [-1, 1]) {
        addStrut(verts, cols, indices, [s * 0.058, floorY + 0.008, baseZ + 0.074], [s * 0.052, baseY + 0.006, baseZ + 0.056], 0.014, 0.016, cSilverDark, 0.90);
        addStrut(verts, cols, indices, [s * 0.058, floorY + 0.008, baseZ - 0.058], [s * 0.052, baseY + 0.006, baseZ - 0.048], 0.014, 0.016, cSilverDark, 0.90);
        addStrut(verts, cols, indices, [s * 0.058, floorY + 0.012, baseZ + 0.068], [s * 0.052, baseY + 0.004, baseZ - 0.046], 0.010, 0.011, cSilver, 0.92);
      }
      // Upper billet subframe plate supporting seat rails
      addBoxCW(verts, cols, indices, [0.000, baseY + 0.004, baseZ + 0.006], 0.124, 0.010, 0.152, cSilverDark, 0, 0, 0, 0.88);
    }

    // Twin steel floor slider rails on top of raised subframe
    addBoxCW(verts, cols, indices, [-0.050, baseY + 0.014, baseZ + 0.010], 0.014, 0.014, 0.148, cSilver, 0, 0, 0, 0.90);
    addBoxCW(verts, cols, indices, [ 0.050, baseY + 0.014, baseZ + 0.010], 0.014, 0.014, 0.148, cSilver, 0, 0, 0, 0.90);

    // === 2. TAILORED RAISED RACING BUCKET SEAT (Snug ergonomics for Chibi proportions!) ===
    // Sculpted seat base cushion (slightly angled up toward knees)
    addBoxCW(verts, cols, indices, [0, baseY + 0.034, baseZ + 0.018], 0.114, 0.032, 0.144, cAlcantara, 0.10, 0, 0, 0.25);
    addBoxCW(verts, cols, indices, [0, baseY + 0.045, baseZ + 0.088], 0.114, 0.032, 0.030, cLeather, 0.16, 0, 0, 0.35);

    // Low-profile thigh side bolsters cleanly tucking underneath the brushed-silver Dual Side-Stick armrest pods
    addBoxCW(verts, cols, indices, [-0.066, baseY + 0.044, baseZ + 0.018], 0.022, 0.034, 0.146, cLeather, 0.10, 0, -0.14, 0.35);
    addBoxCW(verts, cols, indices, [ 0.066, baseY + 0.044, baseZ + 0.018], 0.022, 0.034, 0.146, cLeather, 0.10, 0,  0.14, 0.35);

    // Reclined Racing Backrest (compact sporty height clearing roof headliner cleanly!)
    const recline = 0.24;
    addBoxCW(verts, cols, indices, [0, baseY + 0.114, baseZ - 0.058], 0.112, 0.136, 0.030, cAlcantara, recline, 0, 0, 0.25);
    addBoxCW(verts, cols, indices, [0, baseY + 0.113, baseZ - 0.074], 0.134, 0.150, 0.014, cCarbonShell, recline, 0, 0, 0.45);

    // Rib & shoulder bolsters wrapping torso
    addBoxCW(verts, cols, indices, [-0.064, baseY + 0.120, baseZ - 0.046], 0.028, 0.140, 0.052, cLeather, recline,  0.22, -0.06, 0.35);
    addBoxCW(verts, cols, indices, [ 0.064, baseY + 0.120, baseZ - 0.046], 0.028, 0.140, 0.052, cLeather, recline, -0.22,  0.06, 0.35);

    // Signature crimson racing stitch stripes
    addBoxCW(verts, cols, indices, [-0.053, baseY + 0.120, baseZ - 0.024], 0.005, 0.120, 0.007, cRedGlow, recline, 0, 0, 0);
    addBoxCW(verts, cols, indices, [ 0.053, baseY + 0.120, baseZ - 0.024], 0.005, 0.120, 0.007, cRedGlow, recline, 0, 0, 0);

    // Twin Metallic-Rimmed Racing Harness Cutout Zone
    addBoxCW(verts, cols, indices, [ 0.000, baseY + 0.192, baseZ - 0.077], 0.024, 0.036, 0.028, cLeather, recline, 0, 0, 0.35);
    addBoxCW(verts, cols, indices, [-0.056, baseY + 0.192, baseZ - 0.076], 0.030, 0.038, 0.032, cLeather, recline,  0.12, 0, 0.35);
    addBoxCW(verts, cols, indices, [ 0.056, baseY + 0.192, baseZ - 0.076], 0.030, 0.038, 0.032, cLeather, recline, -0.12, 0, 0.35);
    addBoxCW(verts, cols, indices, [-0.028, baseY + 0.175, baseZ - 0.071], 0.032, 0.005, 0.030, cSilver, recline, 0, 0, 0.85);
    addBoxCW(verts, cols, indices, [ 0.028, baseY + 0.175, baseZ - 0.071], 0.032, 0.005, 0.030, cSilver, recline, 0, 0, 0.85);

    // Integrated Sculpted Racing Headrest (top at y ≈ baseY + 0.252 = +0.270 -> generous roof clearance!)
    addBoxCW(verts, cols, indices, [0, baseY + 0.230, baseZ - 0.086], 0.112, 0.044, 0.034, cLeather, recline * 0.72, 0, 0, 0.35);
    addBoxCW(verts, cols, indices, [0, baseY + 0.234, baseZ - 0.068], 0.032, 0.009, 0.005, cSilver, recline * 0.72, 0, 0, 0.9);

    // === 3. SCULPTED BRUSHED-SILVER DUAL SIDE-STICK ARMREST CONSOLES (Reference Image Design!) ===
    const pivX = SEAT_CONFIG.stickX;
    const pivY = baseY + (SEAT_CONFIG.stickPivY - SEAT_CONFIG.seatBaseY); // +0.104 when mounted
    const pivZ = baseZ + (SEAT_CONFIG.stickPivZ - SEAT_CONFIG.seatZ);     // +0.014 when mounted

    for (let s of [-1, 1]) {
      const sx = s * pivX;
      // Structural metallic support pylon anchoring side-stick console pod firmly down to seat subframe
      addStrut(verts, cols, indices, [s * 0.060, baseY + 0.012, pivZ - 0.018], [sx + s * 0.004, pivY - 0.024, pivZ - 0.006], 0.016, 0.018, cCarbonShell, 0.55);
      addStrut(verts, cols, indices, [s * 0.062, baseY + 0.014, baseZ - 0.042], [sx + s * 0.012, pivY - 0.024, pivZ - 0.044], 0.014, 0.016, cSilverDark, 0.85);

      // Brushed-silver cantilevered armrest spine & padded dark-leather rear elbow rest
      addBoxCW(verts, cols, indices, [sx + s * 0.008, pivY - 0.022, pivZ - 0.034], 0.032, 0.016, 0.064, cSilverDark, 0.04, 0, 0, 0.88);
      addBoxCW(verts, cols, indices, [sx + s * 0.009, pivY - 0.012, pivZ - 0.044], 0.028, 0.012, 0.044, cLeather, 0.04, 0, 0, 0.35);

      // Faceted Brushed-Silver Polygonal Side-Stick Gimbal Housing Pod (exact reference silhouette!)
      // Lower gunmetal chassis pan
      addFrustumY(verts, cols, indices, sx, pivZ + 0.002, pivY - 0.028, pivY - 0.014, 0.021, 0.032, 0.025, 0.036, 8, cCarbonShell, 0.55);
      // Main brushed-silver faceted octagonal bezel body
      addFrustumY(verts, cols, indices, sx, pivZ + 0.002, pivY - 0.014, pivY - 0.004, 0.025, 0.036, 0.021, 0.031, 8, cSilver, 0.96);
      // Dark recessed gimbal dish top plate
      addFrustumY(verts, cols, indices, sx, pivZ, pivY - 0.004, pivY - 0.001, 0.0175, 0.0195, 0.0165, 0.0185, 8, cRubber, 0.25);
      // Glowing crimson ambient LED base collar surrounding the rubber bellows (signature red glow in ref!)
      addFrustumY(verts, cols, indices, sx, pivZ, pivY - 0.003, pivY + 0.0015, 0.0148, 0.0158, 0.0132, 0.0142, 8, cRedGlow, 0);
      // Stationary lower accordion bellows collar seated inside the glowing crimson ring
      addFrustumY(verts, cols, indices, sx, pivZ, pivY - 0.002, pivY + 0.0045, 0.0126, 0.0126, 0.0108, 0.0108, 8, cRubber, 0.22);

      // Angled front brushed-silver nose bevel + dark auxiliary button pad + micro red/cyan status LEDs
      addBoxCW(verts, cols, indices, [sx, pivY - 0.016, pivZ + 0.032], 0.028, 0.016, 0.016, cSilver, -0.32, 0, 0, 0.92);
      addBoxCW(verts, cols, indices, [sx, pivY - 0.010, pivZ + 0.036], 0.018, 0.006, 0.011, cRubber, -0.32, 0, 0, 0.30);
      addBoxCW(verts, cols, indices, [sx - s * 0.004, pivY - 0.008, pivZ + 0.037], 0.005, 0.0025, 0.003, cRedGlow, -0.32, 0, 0, 0);
      addBoxCW(verts, cols, indices, [sx + s * 0.004, pivY - 0.008, pivZ + 0.037], 0.005, 0.0025, 0.003, cHudCyan, -0.32, 0, 0, 0);

      // Standalone ground-dropped item renders both sticks upright statically
      if (includeStaticSticks) {
        buildSideStickGeometry(verts, cols, indices, sx, pivY, pivZ);
      }
    }

    // === 4. FOOTWELL MACHINED ALUMINUM BRAKE & ACCELERATOR PEDALS (Matches Reference Center Footwell!) ===
    if (includeFootPedals) {
      // Wide textured metallic brake pedal (center-left)
      addBoxCW(verts, cols, indices, [ 0.008, floorY + 0.064, 0.194], 0.034, 0.024, 0.006, cSilver, -0.32, 0, 0, 0.92);
      addStrut(verts, cols, indices, [ 0.008, floorY + 0.072, 0.198], [ 0.008, floorY + 0.120, 0.224], 0.007, 0.007, cCarbonShell, 0.45);
      // Tall narrow brushed-metal accelerator pedal (right side = -X!)
      addBoxCW(verts, cols, indices, [-0.032, floorY + 0.056, 0.198], 0.018, 0.044, 0.006, cSilver, -0.38, 0, 0, 0.94);
      addStrut(verts, cols, indices, [-0.032, floorY + 0.068, 0.204], [-0.032, floorY + 0.118, 0.228], 0.006, 0.006, cCarbonShell, 0.45);
    }
  }

  function getOrCreateMountedStaticTemplate() {
    if (_seatMountedStaticTemplate) return _seatMountedStaticTemplate;
    const verts = [], cols = [], indices = [];
    buildDualStickBucketSeat(
      verts, cols, indices,
      SEAT_CONFIG.floorY,
      SEAT_CONFIG.seatBaseY,
      SEAT_CONFIG.seatZ,
      true,
      false // Sticks are emitted dynamically with live throttle/steer tilt!
    );
    _seatMountedStaticTemplate = {
      verts: new Float32Array(verts),
      colors: new Float32Array(cols),
      indices: new Uint16Array(indices),
      vertCount: verts.length / 3
    };
    return _seatMountedStaticTemplate;
  }

  function getOrCreateStandaloneTemplate() {
    if (_seatStandaloneTemplate) return _seatStandaloneTemplate;
    const verts = [], cols = [], indices = [];
    buildDualStickBucketSeat(verts, cols, indices, 0.0, SEAT_CONFIG.seatRise, 0.0, false, true);
    _seatStandaloneTemplate = {
      verts: new Float32Array(verts),
      colors: new Float32Array(cols),
      indices: new Uint16Array(indices),
      vertCount: verts.length / 3
    };
    return _seatStandaloneTemplate;
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

  // Draw mounted Raised Bucket Seat + Live Animated Dual Side-Sticks inside Cyber Car
  // stickThrottle: +1 (W Forward) -> Left Stick (+R) pitches FORWARD; -1 (S Reverse) -> pitches BACKWARD
  // stickSteer:    -1 (A Left)    -> Right Stick (-R) tilts LEFT (+R); +1 (D Right) -> tilts RIGHT (-R)
  window.drawCyberCarSeat = function(p, r, n, f, vertices, colors, indices, isPreview, previewColor, stickThrottle, stickSteer) {
    const carScale = window.CYBER_CAR_SCALE || 0.36;
    emitTemplate(getOrCreateMountedStaticTemplate(), p, carScale, r, n, f, vertices, colors, indices, isPreview, previewColor);

    const stickTpl = getOrCreateSideStickTemplate();
    const thr = Math.max(-1, Math.min(1, typeof stickThrottle === "number" ? stickThrottle : 0));
    const str = Math.max(-1, Math.min(1, typeof stickSteer === "number" ? stickSteer : 0));
    const maxRad = SEAT_CONFIG.maxStickRad;

    const sx = SEAT_CONFIG.stickX * carScale;
    const py = SEAT_CONFIG.stickPivY * carScale;
    const pz = SEAT_CONFIG.stickPivZ * carScale;

    // 1. LEFT SIDE-STICK (+R side): Forward / Reverse pitch around R
    const leftPitch = thr * maxRad; // > 0 leans top (+N) forward toward +F!
    const cp = Math.cos(leftPitch), sp = Math.sin(leftPitch);
    const nL = [n[0] * cp + f[0] * sp, n[1] * cp + f[1] * sp, n[2] * cp + f[2] * sp];
    const fL = [f[0] * cp - n[0] * sp, f[1] * cp - n[1] * sp, f[2] * cp - n[2] * sp];
    const leftOrigin = [
      p[0] + r[0] * sx + n[0] * py + f[0] * pz,
      p[1] + r[1] * sx + n[1] * py + f[1] * pz,
      p[2] + r[2] * sx + n[2] * py + f[2] * pz
    ];
    emitTemplate(stickTpl, leftOrigin, carScale, r, nL, fL, vertices, colors, indices, isPreview, previewColor);

    // 2. RIGHT SIDE-STICK (-R side): Left / Right roll around F
    // A (str = -1) -> rollLeft = +maxRad (top +N leans toward +R = LEFT!)
    // D (str = +1) -> rollLeft = -maxRad (top +N leans toward -R = RIGHT!)
    const rightRoll = -str * maxRad;
    const cr = Math.cos(rightRoll), sr = Math.sin(rightRoll);
    const nR = [n[0] * cr + r[0] * sr, n[1] * cr + r[1] * sr, n[2] * cr + r[2] * sr];
    const rR = [r[0] * cr - n[0] * sr, r[1] * cr - n[1] * sr, r[2] * cr - n[2] * sr];
    const rightOrigin = [
      p[0] - r[0] * sx + n[0] * py + f[0] * pz,
      p[1] - r[1] * sx + n[1] * py + f[1] * pz,
      p[2] - r[2] * sx + n[2] * py + f[2] * pz
    ];
    emitTemplate(stickTpl, rightOrigin, carScale, rR, nR, f, vertices, colors, indices, isPreview, previewColor);
  };

  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["cyber_car_seat"] = {
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
        window.drawCyberCarSeat(snapPos, r, n, f, vertices, colors, indices, true, previewColor, 0, 0);
        return;
      }

      const scale = (item.size || 0.25) * 4.0 * carScale;
      emitTemplate(getOrCreateStandaloneTemplate(), p, scale, r, n, f, vertices, colors, indices, isPreview, previewColor);
    }
  };
})();
