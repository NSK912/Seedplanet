// === SEEDPLANET MODULE: JS/ITEMS/WOOD_WINDOW.JS ===

window.ItemRegistry = window.ItemRegistry || {};

(function() {
  function drawBoxFallback(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices) {
    if (typeof window !== "undefined" && typeof window.addBox === "function" && window.addBox !== drawBoxFallback) {
      window.addBox(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices);
      return;
    }
    const hw = w / 2, hh = h / 2, hd = d / 2;
    let r = right, u = up, f = forward;
    let isFlipped = false;
    if (r && u && f) {
      const det = (r[1]*u[2] - r[2]*u[1])*f[0] + (r[2]*u[0] - r[0]*u[2])*f[1] + (r[0]*u[1] - r[1]*u[0])*f[2];
      if (det < 0) isFlipped = true;
    }
    const cubeVerts = [
      [-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd],
      [-hw, hh, -hd], [hw, hh, -hd], [hw, hh, hd], [-hw, hh, hd]
    ];
    const baseIdx = outVertices.length / 3;
    for (let i = 0; i < 8; i++) {
      const v = cubeVerts[i];
      const rx = r[0]*v[0] + u[0]*v[1] + f[0]*v[2];
      const ry = r[1]*v[0] + u[1]*v[1] + f[1]*v[2];
      const rz = r[2]*v[0] + u[2]*v[1] + f[2]*v[2];
      outVertices.push(center[0] + rx, center[1] + ry, center[2] + rz);
      outColors.push(color[0], color[1], color[2]);
    }
    const cubeIndices = isFlipped ? [
      0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6,
      0, 5, 1, 0, 4, 5, 2, 7, 3, 2, 6, 7,
      0, 3, 7, 0, 7, 4, 1, 6, 2, 1, 5, 6
    ] : [
      0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,
      0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6,
      0, 7, 3, 0, 4, 7, 1, 2, 6, 1, 6, 5
    ];
    for (let i = 0; i < cubeIndices.length; i++) {
      outIndices.push(baseIdx + cubeIndices[i]);
    }
  }

  const renderWindow = function(item, vertices, colors, indices, targetBuffer) {
    const box = (typeof addBox === "function") ? addBox : drawBoxFallback;
    const p = item.position;
    const r = item.R, f = item.F, n = item.normal;

    // Compute rotated orientation using item.angle (0.0 if undefined)
    const angle = item.angle || 0.0;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    
    const wallR = [
      r[0] * cosA + f[0] * sinA,
      r[1] * cosA + f[1] * sinA,
      r[2] * cosA + f[2] * sinA
    ];
    const wallF = [
      f[0] * cosA - r[0] * sinA,
      f[1] * cosA - r[1] * sinA,
      f[2] * cosA - r[2] * sinA
    ];

    const isValid = item.isValidPlacement !== false;
    const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    const baseColor = item.isPreview ? previewColor : (item.color || [0.65, 0.45, 0.25]);
    const rCol = baseColor[0];
    const gCol = baseColor[1];
    const bCol = baseColor[2];

    const frameColor = item.isPreview ? previewColor : [rCol * 0.55, gCol * 0.4, bCol * 0.4];
    const casingColor = item.isPreview ? previewColor : [rCol * 0.5, gCol * 0.35, bCol * 0.3];
    const shutterColor = item.isPreview ? previewColor : [rCol * 0.85, gCol * 0.85, bCol * 0.85];
    const darkAccent = item.isPreview ? previewColor : [rCol * 0.5, gCol * 0.35, bCol * 0.3];

    // ==========================================
    // 1) Window Outer Frame (Sturdy 0.032 depth, matches door frame so it protrudes past the 0.024 wall)
    // ==========================================
    const frameDepth = 0.032;

    // Projecting Window Sill (ธรณีหน้าต่างยื่นออกมาข้างหน้าและหลัง depth 0.040, height 0.016, width 0.210)
    const sillCenter = [
      p[0] + n[0] * 0.080,
      p[1] + n[1] * 0.080,
      p[2] + n[2] * 0.080
    ];
    box(sillCenter, 0.210, 0.016, 0.040, frameColor, wallR, n, wallF, vertices, colors, indices);

    // Top Header Beam (ขอบบนหน้าต่าง)
    const headerCenter = [
      p[0] + n[0] * 0.173,
      p[1] + n[1] * 0.173,
      p[2] + n[2] * 0.173
    ];
    box(headerCenter, 0.184, 0.016, frameDepth, frameColor, wallR, n, wallF, vertices, colors, indices);

    // Left Post (เสาวงกบซ้าย)
    const leftPostCenter = [
      p[0] - wallR[0] * 0.084 + n[0] * 0.1265,
      p[1] - wallR[1] * 0.084 + n[1] * 0.1265,
      p[2] - wallR[2] * 0.084 + n[2] * 0.1265
    ];
    box(leftPostCenter, 0.016, 0.077, frameDepth, frameColor, wallR, n, wallF, vertices, colors, indices);

    // Right Post (เสาวงกบขวา)
    const rightPostCenter = [
      p[0] + wallR[0] * 0.084 + n[0] * 0.1265,
      p[1] + wallR[1] * 0.084 + n[1] * 0.1265,
      p[2] + wallR[2] * 0.084 + n[2] * 0.1265
    ];
    box(rightPostCenter, 0.016, 0.077, frameDepth, frameColor, wallR, n, wallF, vertices, colors, indices);

    // Center Mullion (เสากลางแบ่งช่องหน้าต่างบานคู่)
    const centerMullionCenter = [
      p[0] + n[0] * 0.1265,
      p[1] + n[1] * 0.1265,
      p[2] + n[2] * 0.1265
    ];
    box(centerMullionCenter, 0.012, 0.077, 0.028, frameColor, wallR, n, wallF, vertices, colors, indices);

    // ==========================================
    // 2) Front and Back Casing/Trim (ประกับบัวขอบหน้าต่างทั้งหน้าและหลัง หนา 0.004 ยื่นถึง ±0.019)
    // ==========================================
    const casingThick = 0.004;

    // --- FRONT CASING (at +0.017 along wallF) ---
    const fLeftCasing = [
      p[0] - wallR[0] * 0.092 + n[0] * 0.1265 + wallF[0] * 0.017,
      p[1] - wallR[1] * 0.092 + n[1] * 0.1265 + wallF[1] * 0.017,
      p[2] - wallR[2] * 0.092 + n[2] * 0.1265 + wallF[2] * 0.017
    ];
    box(fLeftCasing, 0.018, 0.088, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    const fRightCasing = [
      p[0] + wallR[0] * 0.092 + n[0] * 0.1265 + wallF[0] * 0.017,
      p[1] + wallR[1] * 0.092 + n[1] * 0.1265 + wallF[1] * 0.017,
      p[2] + wallR[2] * 0.092 + n[2] * 0.1265 + wallF[2] * 0.017
    ];
    box(fRightCasing, 0.018, 0.088, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    const fTopCasing = [
      p[0] + n[0] * 0.177 + wallF[0] * 0.017,
      p[1] + n[1] * 0.177 + wallF[1] * 0.017,
      p[2] + n[2] * 0.177 + wallF[2] * 0.017
    ];
    box(fTopCasing, 0.208, 0.018, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    const fBottomApron = [
      p[0] + n[0] * 0.068 + wallF[0] * 0.017,
      p[1] + n[1] * 0.068 + wallF[1] * 0.017,
      p[2] + n[2] * 0.068 + wallF[2] * 0.017
    ];
    box(fBottomApron, 0.208, 0.012, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    // --- BACK CASING (at -0.017 along wallF) ---
    const bLeftCasing = [
      p[0] - wallR[0] * 0.092 + n[0] * 0.1265 - wallF[0] * 0.017,
      p[1] - wallR[1] * 0.092 + n[1] * 0.1265 - wallF[1] * 0.017,
      p[2] - wallR[2] * 0.092 + n[2] * 0.1265 - wallF[2] * 0.017
    ];
    box(bLeftCasing, 0.018, 0.088, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    const bRightCasing = [
      p[0] + wallR[0] * 0.092 + n[0] * 0.1265 - wallF[0] * 0.017,
      p[1] + wallR[1] * 0.092 + n[1] * 0.1265 - wallF[1] * 0.017,
      p[2] + wallR[2] * 0.092 + n[2] * 0.1265 - wallF[2] * 0.017
    ];
    box(bRightCasing, 0.018, 0.088, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    const bTopCasing = [
      p[0] + n[0] * 0.177 - wallF[0] * 0.017,
      p[1] + n[1] * 0.177 - wallF[1] * 0.017,
      p[2] + n[2] * 0.177 - wallF[2] * 0.017
    ];
    box(bTopCasing, 0.208, 0.018, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    const bBottomApron = [
      p[0] + n[0] * 0.068 - wallF[0] * 0.017,
      p[1] + n[1] * 0.068 - wallF[1] * 0.017,
      p[2] + n[2] * 0.068 - wallF[2] * 0.017
    ];
    box(bBottomApron, 0.208, 0.012, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    // ==========================================
    // 3) Preview Mode vs Placed Mode (Shutters & Glass)
    // ==========================================
    if (item.isPreview) {
      // In Preview Mode:
      // Draw bright preview window panels (depth 0.028, protruding past the 0.024 wall on both sides)
      // so the preview is unmistakably clear and vibrant from any viewing angle!
      const prevThick = 0.028;
      
      const leftPreviewPane = [
        p[0] - wallR[0] * 0.041 + n[0] * 0.1265,
        p[1] - wallR[1] * 0.041 + n[1] * 0.1265,
        p[2] - wallR[2] * 0.041 + n[2] * 0.1265
      ];
      box(leftPreviewPane, 0.074, 0.076, prevThick, previewColor, wallR, n, wallF, vertices, colors, indices);

      const rightPreviewPane = [
        p[0] + wallR[0] * 0.041 + n[0] * 0.1265,
        p[1] + wallR[1] * 0.041 + n[1] * 0.1265,
        p[2] + wallR[2] * 0.041 + n[2] * 0.1265
      ];
      box(rightPreviewPane, 0.074, 0.076, prevThick, previewColor, wallR, n, wallF, vertices, colors, indices);

      // Contrast sash grid / dividers on the preview panes (depth 0.030)
      const hBarCenter = [
        p[0] + n[0] * 0.1265,
        p[1] + n[1] * 0.1265,
        p[2] + n[2] * 0.1265
      ];
      box(hBarCenter, 0.158, 0.008, 0.030, casingColor, wallR, n, wallF, vertices, colors, indices);

      const vBarLeft = [
        p[0] - wallR[0] * 0.041 + n[0] * 0.1265,
        p[1] - wallR[1] * 0.041 + n[1] * 0.1265,
        p[2] - wallR[2] * 0.041 + n[2] * 0.1265
      ];
      box(vBarLeft, 0.006, 0.076, 0.030, casingColor, wallR, n, wallF, vertices, colors, indices);

      const vBarRight = [
        p[0] + wallR[0] * 0.041 + n[0] * 0.1265,
        p[1] + wallR[1] * 0.041 + n[1] * 0.1265,
        p[2] + wallR[2] * 0.041 + n[2] * 0.1265
      ];
      box(vBarRight, 0.006, 0.076, 0.030, casingColor, wallR, n, wallF, vertices, colors, indices);

    } else {
      // In Placed Mode:
      // Two swingable wooden shutters with windowAngle (opening is clear see-through when open)
      const A = item.windowAngle || 0.0;

      // 1) Left Shutter: hinged at t = -0.076
      const t_left_rot = -0.076 + 0.038 * Math.cos(A);
      const f_left_rot = 0.0 + 0.038 * Math.sin(A);
      const leftShutterCenter = [
        p[0] + wallR[0] * t_left_rot + n[0] * 0.1265 + wallF[0] * f_left_rot,
        p[1] + wallR[1] * t_left_rot + n[1] * 0.1265 + wallF[1] * f_left_rot,
        p[2] + wallR[2] * t_left_rot + n[2] * 0.1265 + wallF[2] * f_left_rot
      ];
      const R_left = [
        wallR[0] * Math.cos(A) + wallF[0] * Math.sin(A),
        wallR[1] * Math.cos(A) + wallF[1] * Math.sin(A),
        wallR[2] * Math.cos(A) + wallF[2] * Math.sin(A)
      ];
      const F_left = [
        wallF[0] * Math.cos(A) - wallR[0] * Math.sin(A),
        wallF[1] * Math.cos(A) - wallR[1] * Math.sin(A),
        wallF[2] * Math.cos(A) - wallR[2] * Math.sin(A)
      ];
      box(leftShutterCenter, 0.076, 0.075, 0.016, shutterColor, R_left, n, F_left, vertices, colors, indices);
      box(leftShutterCenter, 0.060, 0.058, 0.018, darkAccent, R_left, n, F_left, vertices, colors, indices);

      // 2) Right Shutter: hinged at t = +0.076
      const t_right_rot = 0.076 - 0.038 * Math.cos(A);
      const f_right_rot = 0.0 + 0.038 * Math.sin(A);
      const rightShutterCenter = [
        p[0] + wallR[0] * t_right_rot + n[0] * 0.1265 + wallF[0] * f_right_rot,
        p[1] + wallR[1] * t_right_rot + n[1] * 0.1265 + wallF[1] * f_right_rot,
        p[2] + wallR[2] * t_right_rot + n[2] * 0.1265 + wallF[2] * f_right_rot
      ];
      const R_right = [
        wallR[0] * Math.cos(A) - wallF[0] * Math.sin(A),
        wallR[1] * Math.cos(A) - wallF[1] * Math.sin(A),
        wallR[2] * Math.cos(A) - wallF[2] * Math.sin(A)
      ];
      const F_right = [
        wallF[0] * Math.cos(A) + wallR[0] * Math.sin(A),
        wallF[1] * Math.cos(A) + wallR[1] * Math.sin(A),
        wallF[2] * Math.cos(A) + wallR[2] * Math.sin(A)
      ];
      box(rightShutterCenter, 0.076, 0.075, 0.016, shutterColor, R_right, n, F_right, vertices, colors, indices);
      box(rightShutterCenter, 0.060, 0.058, 0.018, darkAccent, R_right, n, F_right, vertices, colors, indices);

      // Draw brass handles
      const handleColor = [0.85, 0.75, 0.25];
      const t_lh_rot = -0.076 + 0.068 * Math.cos(A);
      const f_lh_rot = 0.0 + 0.068 * Math.sin(A);
      const leftHandleCenter = [
        p[0] + wallR[0] * t_lh_rot + n[0] * 0.1265 + wallF[0] * f_lh_rot + F_left[0] * 0.012,
        p[1] + wallR[1] * t_lh_rot + n[1] * 0.1265 + wallF[1] * f_lh_rot + F_left[1] * 0.012,
        p[2] + wallR[2] * t_lh_rot + n[2] * 0.1265 + wallF[2] * f_lh_rot + F_left[2] * 0.012
      ];
      box(leftHandleCenter, 0.006, 0.015, 0.008, handleColor, R_left, n, F_left, vertices, colors, indices);

      const t_rh_rot = 0.076 - 0.068 * Math.cos(A);
      const f_rh_rot = 0.0 + 0.068 * Math.sin(A);
      const rightHandleCenter = [
        p[0] + wallR[0] * t_rh_rot + n[0] * 0.1265 + wallF[0] * f_rh_rot + F_right[0] * 0.012,
        p[1] + wallR[1] * t_rh_rot + n[1] * 0.1265 + wallF[1] * f_rh_rot + F_right[1] * 0.012,
        p[2] + wallR[2] * t_rh_rot + n[2] * 0.1265 + wallF[2] * f_rh_rot + F_right[2] * 0.012
      ];
      box(rightHandleCenter, 0.006, 0.015, 0.008, handleColor, R_right, n, F_right, vertices, colors, indices);
    }
  };

  window.ItemRegistry["wood_window"] = {
    render: renderWindow
  };
})();
