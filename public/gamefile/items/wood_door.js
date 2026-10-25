// === SEEDPLANET MODULE: JS/ITEMS/WOOD_DOOR.JS ===

window.ItemRegistry["wood_door"] = {
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

    // 1) Door Frame (Static side posts and top header beam with non-overlapping mitered joints)
    // Left post: t = -0.076, spans n = 0.001 to 0.219 (height = 0.218), width = 0.028
    const leftPostCenter = [
      p[0] - wallR[0] * 0.076 + n[0] * 0.110,
      p[1] - wallR[1] * 0.076 + n[1] * 0.110,
      p[2] - wallR[2] * 0.076 + n[2] * 0.110
    ];
    const frameColor = [rCol * 0.55, gCol * 0.4, bCol * 0.4]; // Warm darker wood frame color
    addBox(leftPostCenter, 0.028, 0.218, 0.032, frameColor, wallR, n, wallF, vertices, colors, indices);

    // Right post: t = 0.076, spans n = 0.001 to 0.219 (height = 0.218), width = 0.028
    const rightPostCenter = [
      p[0] + wallR[0] * 0.076 + n[0] * 0.110,
      p[1] + wallR[1] * 0.076 + n[1] * 0.110,
      p[2] + wallR[2] * 0.076 + n[2] * 0.110
    ];
    addBox(rightPostCenter, 0.028, 0.218, 0.032, frameColor, wallR, n, wallF, vertices, colors, indices);

    // Top header beam (spans n = 0.219 to 0.249 cleanly above the side posts without overlapping)
    const headerCenter = [
      p[0] + n[0] * 0.234,
      p[1] + n[1] * 0.234,
      p[2] + n[2] * 0.234
    ];
    addBox(headerCenter, 0.180, 0.030, 0.032, frameColor, wallR, n, wallF, vertices, colors, indices);

    // 1.5) Front and Back Casing/Trim (ประกับขอบ) with non-overlapping top/side joints
    const casingColor = [rCol * 0.5, gCol * 0.35, bCol * 0.3]; // slightly darker accent wood
    const casingThick = 0.004;
    const casingWidth = 0.028;
    const casingHeight = 0.218;

    // Front Casing (at +0.017 along wallF)
    const frontLeftCasingCenter = [
      p[0] - wallR[0] * 0.085 + n[0] * 0.110 + wallF[0] * 0.017,
      p[1] - wallR[1] * 0.085 + n[1] * 0.110 + wallF[1] * 0.017,
      p[2] - wallR[2] * 0.085 + n[2] * 0.110 + wallF[2] * 0.017
    ];
    addBox(frontLeftCasingCenter, casingWidth, casingHeight, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    const frontRightCasingCenter = [
      p[0] + wallR[0] * 0.085 + n[0] * 0.110 + wallF[0] * 0.017,
      p[1] + wallR[1] * 0.085 + n[1] * 0.110 + wallF[1] * 0.017,
      p[2] + wallR[2] * 0.085 + n[2] * 0.110 + wallF[2] * 0.017
    ];
    addBox(frontRightCasingCenter, casingWidth, casingHeight, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    const frontTopCasingCenter = [
      p[0] + n[0] * 0.234 + wallF[0] * 0.017,
      p[1] + n[1] * 0.234 + wallF[1] * 0.017,
      p[2] + n[2] * 0.234 + wallF[2] * 0.017
    ];
    addBox(frontTopCasingCenter, 0.198, 0.030, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    // Back Casing (at -0.017 along wallF)
    const backLeftCasingCenter = [
      p[0] - wallR[0] * 0.085 + n[0] * 0.110 - wallF[0] * 0.017,
      p[1] - wallR[1] * 0.085 + n[1] * 0.110 - wallF[1] * 0.017,
      p[2] - wallR[2] * 0.085 + n[2] * 0.110 - wallF[2] * 0.017
    ];
    addBox(backLeftCasingCenter, casingWidth, casingHeight, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    const backRightCasingCenter = [
      p[0] + wallR[0] * 0.085 + n[0] * 0.110 - wallF[0] * 0.017,
      p[1] + wallR[1] * 0.085 + n[1] * 0.110 - wallF[1] * 0.017,
      p[2] + wallR[2] * 0.085 + n[2] * 0.110 - wallF[2] * 0.017
    ];
    addBox(backRightCasingCenter, casingWidth, casingHeight, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    const backTopCasingCenter = [
      p[0] + n[0] * 0.234 - wallF[0] * 0.017,
      p[1] + n[1] * 0.234 - wallF[1] * 0.017,
      p[2] + n[2] * 0.234 - wallF[2] * 0.017
    ];
    addBox(backTopCasingCenter, 0.198, 0.030, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    // 2) Swingable Door Leaf (Half-width)
    const doorAngle = item.doorAngle || 0.0;
    const cosD = Math.cos(doorAngle);
    const sinD = Math.sin(doorAngle);

    // Rotated direction of the door leaf relative to door plane
    const leafR = [
      wallR[0] * cosD + wallF[0] * sinD,
      wallR[1] * cosD + wallF[1] * sinD,
      wallR[2] * cosD + wallF[2] * sinD
    ];
    const leafF = [
      wallF[0] * cosD - wallR[0] * sinD,
      wallF[1] * cosD - wallR[1] * sinD,
      wallF[2] * cosD - wallR[2] * sinD
    ];

    // Hinge is at wallR * -0.062. The door leaf spans 0.124 (n = 0.001 to 0.219)
    const hingeOffset = -0.062;
    const leafCenterOffset = 0.062;
    const leafCenter = [
      p[0] + wallR[0] * hingeOffset + leafR[0] * leafCenterOffset + n[0] * 0.110,
      p[1] + wallR[1] * hingeOffset + leafR[1] * leafCenterOffset + n[1] * 0.110,
      p[2] + wallR[2] * hingeOffset + leafR[2] * leafCenterOffset + n[2] * 0.110
    ];

    // Draw the wooden door leaf body
    const leafColor = item.isPreview ? previewColor : [rCol * 0.85, gCol * 0.85, bCol * 0.85];
    addBox(leafCenter, 0.124, 0.218, 0.020, leafColor, leafR, n, leafF, vertices, colors, indices);

    // Draw decorative cross brace boards on the door leaf (slightly narrower width 0.120 prevents side-edge Z-fighting)
    const braceColor = [rCol * 0.65, gCol * 0.65, bCol * 0.65];
    addBox(leafCenter, 0.120, 0.022, 0.024, braceColor, leafR, n, leafF, vertices, colors, indices);

    // Draw shiny door knobs on both sides
    if (!item.isPreview) {
      const knobColor = [0.95, 0.75, 0.2]; // Shiny brass
      const knobOffsetR = 0.105; // Close to the latch edge of the half-width door
      const knobOffsetF = 0.018; // Protruding slightly
      
      // Front knob
      const knobFrontCenter = [
        p[0] + wallR[0] * hingeOffset + leafR[0] * knobOffsetR + leafF[0] * knobOffsetF + n[0] * 0.11,
        p[1] + wallR[1] * hingeOffset + leafR[1] * knobOffsetR + leafF[1] * knobOffsetF + n[1] * 0.11,
        p[2] + wallR[2] * hingeOffset + leafR[2] * knobOffsetR + leafF[2] * knobOffsetF + n[2] * 0.11
      ];
      addBox(knobFrontCenter, 0.015, 0.015, 0.015, knobColor, leafR, n, leafF, vertices, colors, indices);

      // Back knob
      const knobBackCenter = [
        p[0] + wallR[0] * hingeOffset + leafR[0] * knobOffsetR - leafF[0] * knobOffsetF + n[0] * 0.11,
        p[1] + wallR[1] * hingeOffset + leafR[1] * knobOffsetR - leafF[1] * knobOffsetF + n[1] * 0.11,
        p[2] + wallR[2] * hingeOffset + leafR[2] * knobOffsetR - leafF[2] * knobOffsetF + n[2] * 0.11
      ];
      addBox(knobBackCenter, 0.015, 0.015, 0.015, knobColor, leafR, n, leafF, vertices, colors, indices);
    }
  }
};
