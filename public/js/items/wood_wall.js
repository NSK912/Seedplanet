// === SEEDPLANET MODULE: JS/ITEMS/WOOD_WALL.JS ===

window.ItemRegistry["wood_wall"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
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

    const isWindow = item.type === "wood_window";

    // Check if there is an active wood_door sharing the same snapped position (or very close)
    let hasCoLocatedDoor = false;
    const itemsList = window.collectibles || [];
    for (let other of itemsList) {
      if (other.active && other.type === "wood_door") {
        const ox = other.position[0] - p[0];
        const oy = other.position[1] - p[1];
        const oz = other.position[2] - p[2];
        if (ox*ox + oy*oy + oz*oz < 0.005) {
          hasCoLocatedDoor = true;
          break;
        }
      }
    }

    // Check if there is an active wood_window sharing the same snapped position (or very close)
    let hasCoLocatedWindow = false;
    if (item.type === "wood_wall") {
      for (let other of itemsList) {
        if (other.active && other.type === "wood_window") {
          const ox = other.position[0] - p[0];
          const oy = other.position[1] - p[1];
          const oz = other.position[2] - p[2];
          if (ox*ox + oy*oy + oz*oz < 0.005) {
            hasCoLocatedWindow = true;
            break;
          }
        }
      }
    }

    // 1) Bottom horizontal support beam
    if (hasCoLocatedDoor) {
      // Left bottom stump: width 0.081, centered at t = -0.1095
      const leftStumpCenter = [
        p[0] - wallR[0] * 0.1095 + n[0] * 0.01,
        p[1] - wallR[1] * 0.1095 + n[1] * 0.01,
        p[2] - wallR[2] * 0.1095 + n[2] * 0.01
      ];
      addBox(leftStumpCenter, 0.081, 0.02, 0.025, [rCol * 0.8, gCol * 0.8, bCol * 0.8], wallR, n, wallF, vertices, colors, indices);

      // Right bottom stump: width 0.081, centered at t = 0.1095
      const rightStumpCenter = [
        p[0] + wallR[0] * 0.1095 + n[0] * 0.01,
        p[1] + wallR[1] * 0.1095 + n[1] * 0.01,
        p[2] + wallR[2] * 0.1095 + n[2] * 0.01
      ];
      addBox(rightStumpCenter, 0.081, 0.02, 0.025, [rCol * 0.8, gCol * 0.8, bCol * 0.8], wallR, n, wallF, vertices, colors, indices);
    } else if (!isWindow) {
      const bottomBeamCenter = [
        p[0] + n[0] * 0.01,
        p[1] + n[1] * 0.01,
        p[2] + n[2] * 0.01
      ];
      addBox(bottomBeamCenter, 0.3, 0.02, 0.025, [rCol * 0.8, gCol * 0.8, bCol * 0.8], wallR, n, wallF, vertices, colors, indices);
    }

    // 2) Top horizontal support beam
    if (!isWindow) {
      const topBeamCenter = [
        p[0] + n[0] * 0.24,
        p[1] + n[1] * 0.24,
        p[2] + n[2] * 0.24
      ];
      addBox(topBeamCenter, 0.3, 0.02, 0.025, [rCol * 0.8, gCol * 0.8, bCol * 0.8], wallR, n, wallF, vertices, colors, indices);
    }

    // 3) Vertical planks (only for wood_wall, wood_window has no background planks)
    if (!isWindow) {
      const numPlanks = 5;
      const seedVal = item.seed || (p[0] * 123.4 + p[2] * 56.7);
      function pRand(s) {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
      }

      for (let i = 0; i < numPlanks; i++) {
        if (hasCoLocatedDoor && (i === 1 || i === 2 || i === 3)) {
          continue;
        }
        const t = -0.15 + 0.03 + i * 0.06; // horizontal offset along wallR
        const shadeNoise = pRand(seedVal + i * 17.3);
        const plankColor = item.isPreview ? previewColor : [
          rCol * (0.85 + shadeNoise * 0.3),
          gCol * (0.85 + shadeNoise * 0.3),
          bCol * (0.85 + shadeNoise * 0.3)
        ];

        if (hasCoLocatedWindow && (i === 1 || i === 2 || i === 3)) {
          // For co-located window middle planks: draw bottom and top parts, leaving a gap in the middle
          const bottomPlankCenter = [
            p[0] + wallR[0] * t + n[0] * 0.05,
            p[1] + wallR[1] * t + n[1] * 0.05,
            p[2] + wallR[2] * t + n[2] * 0.05
          ];
          addBox(bottomPlankCenter, 0.062, 0.06, 0.015, plankColor, wallR, n, wallF, vertices, colors, indices);

          const topPlankCenter = [
            p[0] + wallR[0] * t + n[0] * 0.20,
            p[1] + wallR[1] * t + n[1] * 0.20,
            p[2] + wallR[2] * t + n[2] * 0.20
          ];
          addBox(topPlankCenter, 0.062, 0.06, 0.015, plankColor, wallR, n, wallF, vertices, colors, indices);
        } else {
          // Standard solid full vertical plank
          const plankCenter = [
            p[0] + wallR[0] * t + n[0] * 0.125,
            p[1] + wallR[1] * t + n[1] * 0.125,
            p[2] + wallR[2] * t + n[2] * 0.125
          ];
          addBox(plankCenter, 0.062, 0.21, 0.015, plankColor, wallR, n, wallF, vertices, colors, indices);

          // Draw a diagonal brace on the wall to make it look even more beautiful and structured!
          if (i === 2 && !item.isPreview) {
            // Add a small decorative cross brace on the center plank
            const braceColor = [rCol * 0.7, gCol * 0.7, bCol * 0.7];
            const braceCenter = [
              p[0] + n[0] * 0.125,
              p[1] + n[1] * 0.125,
              p[2] + n[2] * 0.125
            ];
            addBox(braceCenter, 0.22, 0.02, 0.01, braceColor, wallR, n, wallF, vertices, colors, indices);
          }
        }
      }
    }

    // Draw window frames and solid wood shutters if it's a window!
    if (isWindow) {
      // Frame and casing colors relative to baseColor to match the door and wall, preventing magenta/purple hue
      const frameColor = item.isPreview ? previewColor : [rCol * 0.5, gCol * 0.35, bCol * 0.3]; // darker frame (like casingColor)
      const shutterColor = item.isPreview ? previewColor : [rCol * 0.85, gCol * 0.85, bCol * 0.85]; // matches wall planks but slightly distinct
      const darkAccent = item.isPreview ? previewColor : [rCol * 0.5, gCol * 0.35, bCol * 0.3]; // decorative trim

      // Window sill (horizontal bottom frame) at vertical 0.08
      const sillCenter = [
        p[0] + n[0] * 0.08,
        p[1] + n[1] * 0.08,
        p[2] + n[2] * 0.08
      ];
      addBox(sillCenter, 0.18, 0.01, 0.02, frameColor, wallR, n, wallF, vertices, colors, indices);

      // Top window frame at vertical 0.17
      const frameTopCenter = [
        p[0] + n[0] * 0.17,
        p[1] + n[1] * 0.17,
        p[2] + n[2] * 0.17
      ];
      addBox(frameTopCenter, 0.18, 0.01, 0.02, frameColor, wallR, n, wallF, vertices, colors, indices);

      // Left window frame at t = -0.09
      const frameLeftCenter = [
        p[0] - wallR[0] * 0.09 + n[0] * 0.125,
        p[1] - wallR[1] * 0.09 + n[1] * 0.125,
        p[2] - wallR[2] * 0.09 + n[2] * 0.125
      ];
      addBox(frameLeftCenter, 0.01, 0.08, 0.02, frameColor, wallR, n, wallF, vertices, colors, indices);

      // Right window frame at t = 0.09
      const frameRightCenter = [
        p[0] + wallR[0] * 0.09 + n[0] * 0.125,
        p[1] + wallR[1] * 0.09 + n[1] * 0.125,
        p[2] + wallR[2] * 0.09 + n[2] * 0.125
      ];
      addBox(frameRightCenter, 0.01, 0.08, 0.02, frameColor, wallR, n, wallF, vertices, colors, indices);

      // --- TWO SWINGING SOLID WOOD SHUTTERS ---
      const A = item.windowAngle || 0.0;

      // 1) Left Shutter: hinged at t = -0.085
      const t_left_rot = -0.085 + 0.0425 * Math.cos(A);
      const f_left_rot = 0.0 + 0.0425 * Math.sin(A);
      const leftShutterCenter = [
        p[0] + wallR[0] * t_left_rot + n[0] * 0.125 + wallF[0] * f_left_rot,
        p[1] + wallR[1] * t_left_rot + n[1] * 0.125 + wallF[1] * f_left_rot,
        p[2] + wallR[2] * t_left_rot + n[2] * 0.125 + wallF[2] * f_left_rot
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
      addBox(leftShutterCenter, 0.085, 0.075, 0.012, shutterColor, R_left, n, F_left, vertices, colors, indices);
      addBox(leftShutterCenter, 0.065, 0.055, 0.015, darkAccent, R_left, n, F_left, vertices, colors, indices);

      // 2) Right Shutter: hinged at t = 0.085
      const t_right_rot = 0.085 - 0.0425 * Math.cos(A);
      const f_right_rot = 0.0 + 0.0425 * Math.sin(A);
      const rightShutterCenter = [
        p[0] + wallR[0] * t_right_rot + n[0] * 0.125 + wallF[0] * f_right_rot,
        p[1] + wallR[1] * t_right_rot + n[1] * 0.125 + wallF[1] * f_right_rot,
        p[2] + wallR[2] * t_right_rot + n[2] * 0.125 + wallF[2] * f_right_rot
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
      addBox(rightShutterCenter, 0.085, 0.075, 0.012, shutterColor, R_right, n, F_right, vertices, colors, indices);
      addBox(rightShutterCenter, 0.065, 0.055, 0.015, darkAccent, R_right, n, F_right, vertices, colors, indices);

      // Draw tiny brass handles (only if not a preview)
      if (!item.isPreview) {
        const handleColor = [0.85, 0.75, 0.25]; // Gold brass handles

        const t_lh_rot = -0.085 + 0.075 * Math.cos(A);
        const f_lh_rot = 0.0 + 0.075 * Math.sin(A);
        const leftHandleCenter = [
          p[0] + wallR[0] * t_lh_rot + n[0] * 0.125 + wallF[0] * f_lh_rot + F_left[0] * 0.012,
          p[1] + wallR[1] * t_lh_rot + n[1] * 0.125 + wallF[1] * f_lh_rot + F_left[1] * 0.012,
          p[2] + wallR[2] * t_lh_rot + n[2] * 0.125 + wallF[2] * f_lh_rot + F_left[2] * 0.012
        ];
        addBox(leftHandleCenter, 0.006, 0.015, 0.008, handleColor, R_left, n, F_left, vertices, colors, indices);

        const t_rh_rot = 0.085 - 0.075 * Math.cos(A);
        const f_rh_rot = 0.0 + 0.075 * Math.sin(A);
        const rightHandleCenter = [
          p[0] + wallR[0] * t_rh_rot + n[0] * 0.125 + wallF[0] * f_rh_rot + F_right[0] * 0.012,
          p[1] + wallR[1] * t_rh_rot + n[1] * 0.125 + wallF[1] * f_rh_rot + F_right[1] * 0.012,
          p[2] + wallR[2] * t_rh_rot + n[2] * 0.125 + wallF[2] * f_rh_rot + F_right[2] * 0.012
        ];
        addBox(rightHandleCenter, 0.006, 0.015, 0.008, handleColor, R_right, n, F_right, vertices, colors, indices);
      }
    }
  }
};

window.ItemRegistry["wood_window"] = window.ItemRegistry["wood_wall"];
