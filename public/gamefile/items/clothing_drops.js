// === SEEDPLANET MODULE: JS/ITEMS/CLOTHING_DROPS.JS ===
// Lightweight, baked DropTemplateCache 3D ground-drop models for ALL 12 clothing & footwear items.
// Keeps existing high-res inventory 3D icons untouched via useCustomIconMesh = true.

(function() {
  window.ItemRegistry = window.ItemRegistry || {};

  const U0 = [1, 0, 0];
  const V0 = [0, 1, 0];
  const W0 = [0, 0, 1];

  function box(tv, tc, ti, cx, cy, cz, w, h, d, col, r = U0, u = V0, f = W0) {
    addBox([cx, cy, cz], w, h, d, col, r, u, f, tv, tc, ti);
  }

  function rotYBasis(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
      r: [c, 0, -s],
      u: [0, 1, 0],
      f: [s, 0, c]
    };
  }

  // Shared helper for a single standing boot/shoe oriented along local basis
  function buildShoeHalf(tv, tc, ti, ox, oz, yaw, opts) {
    const b = rotYBasis(yaw);
    const pt = (lx, ly, lz) => [
      ox + b.r[0] * lx + b.f[0] * lz,
      ly,
      oz + b.r[2] * lx + b.f[2] * lz
    ];
    const bBox = (lx, ly, lz, w, h, d, col) => {
      addBox(pt(lx, ly, lz), w, h, d, col, b.r, b.u, b.f, tv, tc, ti);
    };

    const soleH = opts.soleH || 0.08;
    const heelH = opts.heelH || 0.04;
    const vampH = opts.vampH || 0.16;
    const shaftH = opts.shaftH || 0.34;
    const width = opts.width || 0.28;

    // Sole + distinct heel block
    bBox(0, soleH * 0.5, 0.02, width * 1.06, soleH, 0.66, opts.colSole);
    bBox(0, (soleH + heelH) * 0.5, -0.20, width * 1.04, soleH + heelH, 0.22, opts.colHeel || opts.colSole);

    // Main foot vamp & rounded toe box
    const baseY = soleH;
    bBox(0, baseY + vampH * 0.5, -0.02, width, vampH, 0.50, opts.colUpper);
    bBox(0, baseY + vampH * 0.42, 0.25, width * 0.88, vampH * 0.78, 0.18, opts.colSheen || opts.colUpper);
    // Cap-toe seam stripe (optional)
    if (opts.colSeam) {
      bBox(0, baseY + vampH * 0.64, 0.17, width * 0.92, 0.028, 0.035, opts.colSeam);
    }

    // Ankle shaft / quarter collar
    if (shaftH > 0.01) {
      bBox(0, baseY + vampH * 0.7 + shaftH * 0.5, -0.14, width * 0.92, shaftH, 0.28, opts.colUpper);
      // Cuff trim or leather lining at top of opening
      bBox(0, baseY + vampH * 0.7 + shaftH + 0.015, -0.14, width * 0.96, 0.045, 0.30, opts.colTrim || opts.colUpper);
      // Inner cavity / insole dark or tan lining
      bBox(0, baseY + vampH * 0.7 + shaftH + 0.025, -0.14, width * 0.62, 0.03, 0.18, opts.colInner);
    } else {
      // Low-cut dress shoe collar + visible tan insole
      bBox(0, baseY + vampH + 0.025, -0.15, width * 0.94, 0.06, 0.26, opts.colTrim || opts.colUpper);
      bBox(0, baseY + vampH + 0.02, -0.13, width * 0.62, 0.04, 0.20, opts.colInner);
    }

    // Front lacing bars (optional)
    if (opts.laceCount && opts.colLace) {
      const laceStartY = baseY + vampH * 0.85;
      const laceSpanY = Math.max(0.08, shaftH * 0.78);
      for (let i = 0; i < opts.laceCount; i++) {
        const t = opts.laceCount > 1 ? (i / (opts.laceCount - 1)) : 0.5;
        const ly = laceStartY + t * laceSpanY;
        const lz = (shaftH > 0.01) ? (0.015 - t * 0.025) : (0.04 + t * 0.06);
        bBox(0, ly, lz, width * 0.42, 0.022, 0.026, opts.colLace);
      }
    }
  }

  function registerClothingDrop(keys, templateKey, defaultSize, maxSize, buildLocalFn) {
    const renderer = {
      useCustomIconMesh: true,
      render: function(item, vertices, colors, indices, targetBuffer) {
        const p = (item && item.position) ? item.position : [0, 0, 0];
        const r = (item && item.R) ? item.R : [1, 0, 0];
        const n = (item && item.normal) ? item.normal : [0, 1, 0];
        const f = (item && item.F) ? item.F : [0, 0, 1];
        const s = (item && typeof item.size === "number")
          ? Math.min(item.size, maxSize)
          : defaultSize;
        const rotAngle = (item && typeof item.seed === "number") ? (item.seed % (Math.PI * 2)) : 0;
        const rot = window.DropTemplateCache.rotateBasis(r, f, rotAngle);

        window.DropTemplateCache.render(
          templateKey,
          { position: p, R: rot.R, normal: n, F: rot.F, scale: s, yOff: 0.02 },
          buildLocalFn,
          vertices, colors, indices
        );
      }
    };

    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      window.ItemRegistry[k] = Object.assign({}, window.ItemRegistry[k] || {}, renderer);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. DOUBLE_BREASTED_SUIT — Folded charcoal pinstripe jacket with peak lapels & brass buttons
  // ---------------------------------------------------------------------------
  registerClothingDrop(
    ["double_breasted_suit", "DOUBLE_BREASTED_SUIT"],
    "cloth_drop_double_breasted_suit_v1",
    0.056,
    0.072,
    (tv, tc, ti) => {
      const base = [0.238, 0.246, 0.268];
      const stripe = [0.358, 0.368, 0.394];
      const lapel = [0.285, 0.294, 0.320];
      const inner = [0.095, 0.100, 0.115];
      const btnHi = [0.870, 0.700, 0.460];
      const btnRim = [0.640, 0.450, 0.250];
      const pocketWhite = [0.94, 0.95, 0.97];

      // Lower folded back layer & upper jacket body
      box(tv, tc, ti, 0, 0.07, 0, 0.96, 0.14, 0.86, inner);
      box(tv, tc, ti, 0, 0.18, 0, 0.94, 0.12, 0.84, base);
      // Folded sleeves tucked neatly along sides
      box(tv, tc, ti, -0.49, 0.14, 0.02, 0.14, 0.15, 0.74, base);
      box(tv, tc, ti,  0.49, 0.14, 0.02, 0.14, 0.15, 0.74, base);
      // Crisp vertical pinstripe accents across jacket front
      for (let i = -3; i <= 3; i++) {
        box(tv, tc, ti, i * 0.12, 0.244, 0.02, 0.018, 0.014, 0.78, stripe);
      }
      // Collar stand & wide double-breasted peak lapels
      box(tv, tc, ti, 0, 0.25, -0.36, 0.42, 0.08, 0.12, lapel);
      const lapL = rotYBasis(0.32);
      const lapR = rotYBasis(-0.32);
      box(tv, tc, ti, -0.17, 0.258, -0.17, 0.20, 0.035, 0.38, lapel, lapL.r, lapL.u, lapL.f);
      box(tv, tc, ti,  0.17, 0.258, -0.17, 0.20, 0.035, 0.38, lapel, lapR.r, lapR.u, lapR.f);
      // Inner V-neck shadow & crisp white breast pocket square
      box(tv, tc, ti, 0, 0.248, -0.25, 0.16, 0.025, 0.18, inner);
      box(tv, tc, ti, 0.24, 0.254, -0.12, 0.13, 0.02, 0.05, pocketWhite);
      // Double-breasted 2x3 brass button array
      for (let row = 0; row < 3; row++) {
        const bz = -0.02 + row * 0.14;
        box(tv, tc, ti, -0.12, 0.256, bz, 0.055, 0.025, 0.055, btnRim);
        box(tv, tc, ti, -0.12, 0.264, bz, 0.032, 0.016, 0.032, btnHi);
        box(tv, tc, ti,  0.12, 0.256, bz, 0.055, 0.025, 0.055, btnRim);
        box(tv, tc, ti,  0.12, 0.264, bz, 0.032, 0.016, 0.032, btnHi);
      }
    }
  );

  // ---------------------------------------------------------------------------
  // 2. BLACK_SLACKS — Neatly folded tailored charcoal dress trousers
  // ---------------------------------------------------------------------------
  registerClothingDrop(
    ["black_slacks", "BLACK_SLACKS"],
    "cloth_drop_black_slacks_v1",
    0.050,
    0.066,
    (tv, tc, ti) => {
      const base = [0.220, 0.228, 0.250];
      const dark = [0.138, 0.144, 0.162];
      const crease = [0.320, 0.330, 0.360];
      const whiteTab = [0.92, 0.93, 0.95];

      // Lower folded leg layer
      box(tv, tc, ti, -0.20, 0.06, 0.02, 0.36, 0.12, 0.86, dark);
      box(tv, tc, ti,  0.20, 0.06, 0.02, 0.36, 0.12, 0.86, dark);
      // Upper folded trouser legs + waist yoke
      box(tv, tc, ti, -0.20, 0.16, 0.04, 0.35, 0.10, 0.82, base);
      box(tv, tc, ti,  0.20, 0.16, 0.04, 0.35, 0.10, 0.82, base);
      box(tv, tc, ti,  0.00, 0.18, -0.34, 0.78, 0.13, 0.18, base);
      // Crisp pressed center creases on both legs
      box(tv, tc, ti, -0.20, 0.215, 0.06, 0.04, 0.02, 0.72, crease);
      box(tv, tc, ti,  0.20, 0.215, 0.06, 0.04, 0.02, 0.72, crease);
      // Belt loops + subtle white tailor tab at waistband
      for (const lx of [-0.30, -0.11, 0.11, 0.30]) {
        box(tv, tc, ti, lx, 0.252, -0.34, 0.045, 0.024, 0.14, crease);
      }
      box(tv, tc, ti, -0.22, 0.252, -0.26, 0.075, 0.018, 0.04, whiteTab);
    }
  );

  // ---------------------------------------------------------------------------
  // 3. OPERA_CAPE — Draped asymmetric charcoal cape showing teal lining & metal clasp
  // ---------------------------------------------------------------------------
  registerClothingDrop(
    ["opera_cape", "OPERA_CAPE"],
    "cloth_drop_opera_cape_v1",
    0.056,
    0.072,
    (tv, tc, ti) => {
      const outer = [0.095, 0.100, 0.120];
      const sheen = [0.145, 0.152, 0.178];
      const teal = [0.048, 0.168, 0.160];
      const tealDeep = [0.028, 0.100, 0.098];
      const metal = [0.460, 0.490, 0.535];
      const metalHi = [0.680, 0.715, 0.765];

      // Wide fanned lower drape showing folded teal lining peeking out
      box(tv, tc, ti, 0, 0.055, 0.06, 1.04, 0.11, 0.84, outer);
      box(tv, tc, ti, 0.12, 0.115, 0.08, 0.76, 0.05, 0.68, teal);
      box(tv, tc, ti, 0.20, 0.122, 0.18, 0.52, 0.04, 0.44, tealDeep);
      // Asymmetric upper shoulder fold draped diagonally across
      const foldB = rotYBasis(-0.24);
      box(tv, tc, ti, -0.10, 0.175, -0.02, 0.74, 0.095, 0.72, outer, foldB.r, foldB.u, foldB.f);
      box(tv, tc, ti, -0.14, 0.226, -0.04, 0.52, 0.024, 0.62, sheen, foldB.r, foldB.u, foldB.f);
      // High structured opera collar & gleaming metallic shoulder clasp
      box(tv, tc, ti, -0.06, 0.255, -0.34, 0.46, 0.11, 0.13, outer);
      box(tv, tc, ti, -0.06, 0.270, -0.29, 0.36, 0.06, 0.05, teal);
      box(tv, tc, ti,  0.14, 0.245, -0.22, 0.16, 0.042, 0.09, metal);
      box(tv, tc, ti,  0.14, 0.268, -0.22, 0.09, 0.022, 0.05, metalHi);
    }
  );

  // ---------------------------------------------------------------------------
  // 4. TRAVELER_HOODIE — Cream-white travel cloak with black diamond spots, hood & gold brooch
  // ---------------------------------------------------------------------------
  registerClothingDrop(
    ["traveler_hoodie", "TRAVELER_HOODIE", "hoodie_cloak", "HOODIE_CLOAK"],
    "cloth_drop_traveler_hoodie_v1",
    0.056,
    0.072,
    (tv, tc, ti) => {
      const cream = [0.935, 0.905, 0.855];
      const creamShade = [0.825, 0.790, 0.735];
      const spot = [0.095, 0.095, 0.115];
      const gold = [0.890, 0.725, 0.275];
      const goldDark = [0.640, 0.485, 0.155];

      // Folded cloak layers
      box(tv, tc, ti, 0, 0.065, 0.04, 0.98, 0.13, 0.86, creamShade);
      box(tv, tc, ti, 0, 0.170, 0.02, 0.92, 0.11, 0.80, cream);
      // Draped hood resting neatly at upper edge
      box(tv, tc, ti, 0, 0.260, -0.28, 0.56, 0.14, 0.30, cream);
      box(tv, tc, ti, 0, 0.268, -0.20, 0.38, 0.08, 0.12, creamShade);
      // Signature rotated black diamond spots across the cloak
      const dRot = rotYBasis(Math.PI * 0.25);
      const spots = [
        [-0.26, 0.228,  0.00], [ 0.24, 0.228, -0.02],
        [-0.08, 0.228,  0.16], [ 0.14, 0.228,  0.22],
        [-0.30, 0.228,  0.26], [ 0.32, 0.228,  0.18],
        [-0.16, 0.332, -0.30], [ 0.15, 0.332, -0.28]
      ];
      for (let i = 0; i < spots.length; i++) {
        const sp = spots[i];
        box(tv, tc, ti, sp[0], sp[1], sp[2], 0.095, 0.016, 0.095, spot, dRot.r, dRot.u, dRot.f);
      }
      // Golden chest brooch clasp at collar center
      box(tv, tc, ti, 0, 0.242, -0.09, 0.13, 0.040, 0.13, goldDark, dRot.r, dRot.u, dRot.f);
      box(tv, tc, ti, 0, 0.260, -0.09, 0.085, 0.026, 0.085, gold, dRot.r, dRot.u, dRot.f);
    }
  );

  // ---------------------------------------------------------------------------
  // 5. WHITE_SHIRT_SHORT — Neatly folded crisp white collared short-sleeve shirt
  // ---------------------------------------------------------------------------
  registerClothingDrop(
    ["white_shirt_short", "WHITE_SHIRT_SHORT"],
    "cloth_drop_white_shirt_short_v1",
    0.050,
    0.066,
    (tv, tc, ti) => {
      const white = [0.985, 0.988, 0.996];
      const shade = [0.870, 0.882, 0.915];
      const placket = [0.925, 0.935, 0.960];
      const btn = [0.760, 0.780, 0.825];

      // Folded shirt body + tucked short sleeves
      box(tv, tc, ti, 0, 0.055, 0, 0.86, 0.11, 0.78, shade);
      box(tv, tc, ti, 0, 0.145, 0, 0.84, 0.10, 0.76, white);
      box(tv, tc, ti, -0.45, 0.125, -0.14, 0.18, 0.11, 0.34, white);
      box(tv, tc, ti,  0.45, 0.125, -0.14, 0.18, 0.11, 0.34, white);
      // Center button placket & tiny shirt buttons
      box(tv, tc, ti, 0, 0.200, 0.06, 0.09, 0.018, 0.56, placket);
      for (const bz of [-0.08, 0.08, 0.24]) {
        box(tv, tc, ti, 0, 0.214, bz, 0.036, 0.014, 0.036, btn);
      }
      // Crisp folded dress-shirt collar wings
      box(tv, tc, ti, 0, 0.215, -0.32, 0.38, 0.075, 0.11, white);
      const colL = rotYBasis(0.42);
      const colR = rotYBasis(-0.42);
      box(tv, tc, ti, -0.13, 0.228, -0.23, 0.18, 0.032, 0.14, white, colL.r, colL.u, colL.f);
      box(tv, tc, ti,  0.13, 0.228, -0.23, 0.18, 0.032, 0.14, white, colR.r, colR.u, colR.f);
      box(tv, tc, ti, 0, 0.202, -0.27, 0.15, 0.025, 0.11, shade);
    }
  );

  // ---------------------------------------------------------------------------
  // 6. BLACK_PLEATED_SKIRT — Flat-laid black pleated mini skirt with fanning pleats
  // ---------------------------------------------------------------------------
  registerClothingDrop(
    ["black_pleated_skirt", "BLACK_PLEATED_SKIRT"],
    "cloth_drop_black_pleated_skirt_v1",
    0.050,
    0.066,
    (tv, tc, ti) => {
      const yoke = [0.155, 0.162, 0.192];
      const ridge = [0.125, 0.132, 0.158];
      const fold = [0.068, 0.072, 0.088];

      // Waistband yoke
      box(tv, tc, ti, 0, 0.10, -0.26, 0.66, 0.14, 0.16, yoke);
      // Base flared skirt body
      box(tv, tc, ti, 0, 0.07, 0.08, 0.90, 0.12, 0.56, fold);
      // Radiating crisp 3D pleat ridges fanning from waistband to hem
      const numPleats = 7;
      for (let i = 0; i < numPleats; i++) {
        const t = (i / (numPleats - 1)) * 2.0 - 1.0; // -1..+1
        const px = t * 0.34;
        const yaw = -t * 0.26;
        const pb = rotYBasis(yaw);
        box(tv, tc, ti, px, 0.145, 0.09, 0.078, 0.06, 0.56, ridge, pb.r, pb.u, pb.f);
      }
    }
  );

  // ---------------------------------------------------------------------------
  // 7. BLACK_LEGGINGS — Neatly folded matte charcoal-black full-length leggings
  // ---------------------------------------------------------------------------
  registerClothingDrop(
    ["black_leggings", "BLACK_LEGGINGS"],
    "cloth_drop_black_leggings_v1",
    0.048,
    0.064,
    (tv, tc, ti) => {
      const main = [0.130, 0.136, 0.162];
      const dark = [0.082, 0.086, 0.104];
      const sheen = [0.190, 0.198, 0.232];

      // Folded lower leg layer + upper slim legs
      box(tv, tc, ti, -0.17, 0.055, 0.02, 0.27, 0.11, 0.80, dark);
      box(tv, tc, ti,  0.17, 0.055, 0.02, 0.27, 0.11, 0.80, dark);
      box(tv, tc, ti, -0.17, 0.145, 0.04, 0.26, 0.09, 0.76, main);
      box(tv, tc, ti,  0.17, 0.145, 0.04, 0.26, 0.09, 0.76, main);
      // Elastic waistband across top
      box(tv, tc, ti, 0, 0.155, -0.32, 0.64, 0.12, 0.16, sheen);
      // Subtle seam highlight along each leg
      box(tv, tc, ti, -0.17, 0.194, 0.06, 0.035, 0.014, 0.66, sheen);
      box(tv, tc, ti,  0.17, 0.194, 0.06, 0.035, 0.014, 0.66, sheen);
    }
  );

  // ---------------------------------------------------------------------------
  // 8. WHITE_BODYSUIT_TOP — Neatly folded white fitted mock-neck athletic top
  // ---------------------------------------------------------------------------
  registerClothingDrop(
    ["white_bodysuit_top", "WHITE_BODYSUIT_TOP"],
    "cloth_drop_white_bodysuit_top_v1",
    0.046,
    0.062,
    (tv, tc, ti) => {
      const white = [0.975, 0.980, 0.995];
      const shade = [0.885, 0.895, 0.925];
      const seam = [0.835, 0.848, 0.885];

      box(tv, tc, ti, 0, 0.055, 0.02, 0.78, 0.11, 0.72, shade);
      box(tv, tc, ti, 0, 0.135, 0.02, 0.76, 0.09, 0.70, white);
      // Fitted short sleeves
      box(tv, tc, ti, -0.43, 0.120, -0.12, 0.17, 0.095, 0.30, white);
      box(tv, tc, ti,  0.43, 0.120, -0.12, 0.17, 0.095, 0.30, white);
      // High mock-neck athletic collar
      box(tv, tc, ti, 0, 0.190, -0.31, 0.30, 0.085, 0.14, white);
      box(tv, tc, ti, 0, 0.198, -0.31, 0.18, 0.06, 0.07, seam);
      // Subtle contoured bodice seam lines
      box(tv, tc, ti, -0.16, 0.184, 0.06, 0.028, 0.012, 0.50, seam);
      box(tv, tc, ti,  0.16, 0.184, 0.06, 0.028, 0.012, 0.50, seam);
    }
  );

  // ---------------------------------------------------------------------------
  // 9. WHITE_BODYSUIT_SHORTS — Neatly folded white high-waist athletic shorts
  // ---------------------------------------------------------------------------
  registerClothingDrop(
    ["white_bodysuit_shorts", "WHITE_BODYSUIT_SHORTS"],
    "cloth_drop_white_bodysuit_shorts_v1",
    0.044,
    0.060,
    (tv, tc, ti) => {
      const white = [0.975, 0.980, 0.995];
      const shade = [0.880, 0.890, 0.920];
      const vSeam = [0.820, 0.835, 0.875];

      // High-waist hip body
      box(tv, tc, ti, 0, 0.075, -0.14, 0.74, 0.15, 0.34, white);
      box(tv, tc, ti, 0, 0.082, -0.28, 0.72, 0.16, 0.10, shade);
      // Left & right short leg openings
      box(tv, tc, ti, -0.20, 0.068, 0.15, 0.32, 0.135, 0.34, white);
      box(tv, tc, ti,  0.20, 0.068, 0.15, 0.32, 0.135, 0.34, white);
      // Signature V-cut athletic seam accent
      const vL = rotYBasis(0.45);
      const vR = rotYBasis(-0.45);
      box(tv, tc, ti, -0.14, 0.154, -0.02, 0.032, 0.014, 0.32, vSeam, vL.r, vL.u, vL.f);
      box(tv, tc, ti,  0.14, 0.154, -0.02, 0.032, 0.014, 0.32, vSeam, vR.r, vR.u, vR.f);
    }
  );

  // ---------------------------------------------------------------------------
  // 10. TRAVELER_BOOTS — Pair of sturdy dark charcoal ankle boots standing side-by-side
  // ---------------------------------------------------------------------------
  registerClothingDrop(
    ["traveler_boots", "TRAVELER_BOOTS", "hoodie_boots", "HOODIE_BOOTS"],
    "cloth_drop_traveler_boots_v1",
    0.042,
    0.056,
    (tv, tc, ti) => {
      const opts = {
        soleH: 0.10,
        heelH: 0.04,
        vampH: 0.17,
        shaftH: 0.34,
        width: 0.30,
        colUpper: [0.145, 0.152, 0.180],
        colSheen: [0.185, 0.194, 0.228],
        colTrim: [0.220, 0.230, 0.270],
        colSole: [0.065, 0.068, 0.084],
        colHeel: [0.052, 0.055, 0.068],
        colInner: [0.050, 0.054, 0.068]
      };
      buildShoeHalf(tv, tc, ti, -0.22, -0.03,  0.16, opts);
      buildShoeHalf(tv, tc, ti,  0.22,  0.04, -0.18, opts);
    }
  );

  // ---------------------------------------------------------------------------
  // 11. OXFORD_SHOES — Pair of polished low-cut black calfskin dress shoes with tan insoles
  // ---------------------------------------------------------------------------
  registerClothingDrop(
    ["oxford_shoes", "OXFORD_SHOES"],
    "cloth_drop_oxford_shoes_v1",
    0.042,
    0.056,
    (tv, tc, ti) => {
      const opts = {
        soleH: 0.065,
        heelH: 0.038,
        vampH: 0.155,
        shaftH: 0.0,
        width: 0.27,
        colUpper: [0.082, 0.088, 0.106],
        colSheen: [0.150, 0.158, 0.186],
        colSeam: [0.185, 0.195, 0.228],
        colTrim: [0.125, 0.132, 0.156],
        colSole: [0.042, 0.045, 0.056],
        colHeel: [0.058, 0.062, 0.076],
        colInner: [0.740, 0.540, 0.290], // Warm tan leather insole
        laceCount: 3,
        colLace: [0.210, 0.220, 0.255]
      };
      buildShoeHalf(tv, tc, ti, -0.21, -0.02,  0.14, opts);
      buildShoeHalf(tv, tc, ti,  0.21,  0.03, -0.16, opts);
    }
  );

  // ---------------------------------------------------------------------------
  // 12. DRESS_BOOTS — Pair of sleek tall black Balmoral dress boots with bar laces
  // ---------------------------------------------------------------------------
  registerClothingDrop(
    ["dress_boots", "DRESS_BOOTS"],
    "cloth_drop_dress_boots_v1",
    0.042,
    0.056,
    (tv, tc, ti) => {
      const opts = {
        soleH: 0.070,
        heelH: 0.045,
        vampH: 0.155,
        shaftH: 0.44,
        width: 0.27,
        colUpper: [0.082, 0.088, 0.106],
        colSheen: [0.150, 0.158, 0.186],
        colSeam: [0.185, 0.195, 0.228],
        colTrim: [0.140, 0.148, 0.175],
        colSole: [0.042, 0.045, 0.056],
        colHeel: [0.062, 0.065, 0.080],
        colInner: [0.560, 0.390, 0.200], // Warm tan collar lining
        laceCount: 5,
        colLace: [0.210, 0.220, 0.255]
      };
      buildShoeHalf(tv, tc, ti, -0.21, -0.03,  0.15, opts);
      buildShoeHalf(tv, tc, ti,  0.21,  0.04, -0.17, opts);
    }
  );
})();
