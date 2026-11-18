// === SEEDPLANET MODULE: JS/ITEMS/WOOD_DOOR.JS ===

// Pre-baked Local Template Cache for wood_door (Static Frame + Swinging Leaf + Knobs)
let _woodDoorTemplateCache = null;

function _getWoodDoorTemplates() {
  if (_woodDoorTemplateCache) return _woodDoorTemplateCache;

  const localR = [1, 0, 0];
  const localN = [0, 1, 0];
  const localF = [0, 0, 1];

  // 1) Static Frame (9 boxes in local (wallR, n, wallF) space relative to p)
  // Color multipliers stored in c: [multR, multG, multB] relative to baseColor
  const fv = [], fc = [], fidx = [];
  const frameMult = [0.55, 0.4, 0.4];
  const casingMult = [0.5, 0.35, 0.3];
  const casingThick = 0.004;
  const casingWidth = 0.028;
  const casingHeight = 0.218;

  // Left post, right post, header
  addBox([-0.076, 0.110, 0.0], 0.028, 0.218, 0.032, frameMult, localR, localN, localF, fv, fc, fidx);
  addBox([0.076, 0.110, 0.0], 0.028, 0.218, 0.032, frameMult, localR, localN, localF, fv, fc, fidx);
  addBox([0.0, 0.234, 0.0], 0.180, 0.030, 0.032, frameMult, localR, localN, localF, fv, fc, fidx);

  // Front casing (+0.017 along wallF)
  addBox([-0.085, 0.110, 0.017], casingWidth, casingHeight, casingThick, casingMult, localR, localN, localF, fv, fc, fidx);
  addBox([0.085, 0.110, 0.017], casingWidth, casingHeight, casingThick, casingMult, localR, localN, localF, fv, fc, fidx);
  addBox([0.0, 0.234, 0.017], 0.198, 0.030, casingThick, casingMult, localR, localN, localF, fv, fc, fidx);

  // Back casing (-0.017 along wallF)
  addBox([-0.085, 0.110, -0.017], casingWidth, casingHeight, casingThick, casingMult, localR, localN, localF, fv, fc, fidx);
  addBox([0.085, 0.110, -0.017], casingWidth, casingHeight, casingThick, casingMult, localR, localN, localF, fv, fc, fidx);
  addBox([0.0, 0.234, -0.017], 0.198, 0.030, casingThick, casingMult, localR, localN, localF, fv, fc, fidx);

  // 2) Swinging Leaf Wood + Cross Brace (2 boxes in local (leafR, n, leafF) space relative to hingePos)
  // Note: for leaf body, preview uses [1, 1, 1] * baseColor, placed uses [0.85, 0.85, 0.85] * baseColor.
  // We store a tag in lvTag (1 = leaf body, 2 = cross brace) or store multipliers directly.
  const lv = [], lcPlaced = [], lcPreview = [], lidx = [];
  const lvDummy = [], lidxDummy = [];
  const leafCenterLocal = [0.062, 0.0, 0.0];
  addBox(leafCenterLocal, 0.124, 0.218, 0.020, [0.85, 0.85, 0.85], localR, localN, localF, lv, lcPlaced, lidx);
  addBox(leafCenterLocal, 0.120, 0.022, 0.024, [0.65, 0.65, 0.65], localR, localN, localF, lv, lcPlaced, lidx);

  addBox(leafCenterLocal, 0.124, 0.218, 0.020, [1.0, 1.0, 1.0], localR, localN, localF, lvDummy, lcPreview, lidxDummy);
  addBox(leafCenterLocal, 0.120, 0.022, 0.024, [0.65, 0.65, 0.65], localR, localN, localF, lvDummy, lcPreview, lidxDummy);

  // 3) Brass Knobs (2 boxes in local (leafR, n, leafF) space relative to hingePos, fixed color)
  const kv = [], kc = [], kidx = [];
  const knobColor = [0.95, 0.75, 0.2];
  addBox([0.105, 0.0, 0.018], 0.015, 0.015, 0.015, knobColor, localR, localN, localF, kv, kc, kidx);
  addBox([0.105, 0.0, -0.018], 0.015, 0.015, 0.015, knobColor, localR, localN, localF, kv, kc, kidx);

  _woodDoorTemplateCache = {
    frame: {
      v: new Float32Array(fv),
      cMult: new Float32Array(fc),
      idx: new Uint16Array(fidx)
    },
    leaf: {
      v: new Float32Array(lv),
      cMultPlaced: new Float32Array(lcPlaced),
      cMultPreview: new Float32Array(lcPreview),
      idx: new Uint16Array(lidx)
    },
    knobs: {
      v: new Float32Array(kv),
      c: new Float32Array(kc),
      idx: new Uint16Array(kidx)
    }
  };
  return _woodDoorTemplateCache;
}

window.ItemRegistry["wood_door"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const r = item.R, f = item.F, n = item.normal;

    // Compute rotated orientation using item.angle (0.0 if undefined)
    const angle = item.angle || 0.0;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const wallR0 = r[0] * cosA + f[0] * sinA;
    const wallR1 = r[1] * cosA + f[1] * sinA;
    const wallR2 = r[2] * cosA + f[2] * sinA;

    const wallF0 = f[0] * cosA - r[0] * sinA;
    const wallF1 = f[1] * cosA - r[1] * sinA;
    const wallF2 = f[2] * cosA - r[2] * sinA;

    const n0 = n[0], n1 = n[1], n2 = n[2];
    const p0 = p[0], p1 = p[1], p2 = p[2];
    const det = (wallR1 * n2 - wallR2 * n1) * wallF0 + (wallR2 * n0 - wallR0 * n2) * wallF1 + (wallR0 * n1 - wallR1 * n0) * wallF2;
    const isFlipped = det < 0;

    const isValid = item.isValidPlacement !== false;
    const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    const baseColor = item.isPreview ? previewColor : (item.color || [0.65, 0.45, 0.25]);
    const rCol = baseColor[0];
    const gCol = baseColor[1];
    const bCol = baseColor[2];

    const tpl = _getWoodDoorTemplates();

    // 1) Transform Static Door Frame + Casing (9 boxes)
    {
      const baseVertIdx = vertices.length / 3;
      const fv = tpl.frame.v;
      const fcMult = tpl.frame.cMult;
      const fidx = tpl.frame.idx;

      for (let i = 0, len = fv.length; i < len; i += 3) {
        const lx = fv[i], ly = fv[i + 1], lz = fv[i + 2];
        vertices.push(
          p0 + lx * wallR0 + ly * n0 + lz * wallF0,
          p1 + lx * wallR1 + ly * n1 + lz * wallF1,
          p2 + lx * wallR2 + ly * n2 + lz * wallF2
        );
        colors.push(
          rCol * fcMult[i],
          gCol * fcMult[i + 1],
          bCol * fcMult[i + 2]
        );
      }
      if (isFlipped) {
        for (let i = 0, len = fidx.length; i < len; i += 3) {
          indices.push(baseVertIdx + fidx[i], baseVertIdx + fidx[i + 2], baseVertIdx + fidx[i + 1]);
        }
      } else {
        for (let i = 0, len = fidx.length; i < len; i++) {
          indices.push(baseVertIdx + fidx[i]);
        }
      }
    }

    // 2) Swingable Door Leaf (Half-width)
    const doorAngle = item.doorAngle || 0.0;
    const cosD = Math.cos(doorAngle);
    const sinD = Math.sin(doorAngle);

    const leafR0 = wallR0 * cosD + wallF0 * sinD;
    const leafR1 = wallR1 * cosD + wallF1 * sinD;
    const leafR2 = wallR2 * cosD + wallF2 * sinD;

    const leafF0 = wallF0 * cosD - wallR0 * sinD;
    const leafF1 = wallF1 * cosD - wallR1 * sinD;
    const leafF2 = wallF2 * cosD - wallR2 * sinD;

    const hingeOffset = -0.062;
    const hp0 = p0 + wallR0 * hingeOffset + n0 * 0.110;
    const hp1 = p1 + wallR1 * hingeOffset + n1 * 0.110;
    const hp2 = p2 + wallR2 * hingeOffset + n2 * 0.110;

    {
      const baseVertIdx = vertices.length / 3;
      const lv = tpl.leaf.v;
      const lcMult = item.isPreview ? tpl.leaf.cMultPreview : tpl.leaf.cMultPlaced;
      const lidx = tpl.leaf.idx;

      for (let i = 0, len = lv.length; i < len; i += 3) {
        const lx = lv[i], ly = lv[i + 1], lz = lv[i + 2];
        vertices.push(
          hp0 + lx * leafR0 + ly * n0 + lz * leafF0,
          hp1 + lx * leafR1 + ly * n1 + lz * leafF1,
          hp2 + lx * leafR2 + ly * n2 + lz * leafF2
        );
        colors.push(
          rCol * lcMult[i],
          gCol * lcMult[i + 1],
          bCol * lcMult[i + 2]
        );
      }
      if (isFlipped) {
        for (let i = 0, len = lidx.length; i < len; i += 3) {
          indices.push(baseVertIdx + lidx[i], baseVertIdx + lidx[i + 2], baseVertIdx + lidx[i + 1]);
        }
      } else {
        for (let i = 0, len = lidx.length; i < len; i++) {
          indices.push(baseVertIdx + lidx[i]);
        }
      }
    }

    // 3) Shiny Brass Knobs (when !item.isPreview)
    if (!item.isPreview) {
      const baseVertIdx = vertices.length / 3;
      const kv = tpl.knobs.v;
      const kc = tpl.knobs.c;
      const kidx = tpl.knobs.idx;

      for (let i = 0, len = kv.length; i < len; i += 3) {
        const lx = kv[i], ly = kv[i + 1], lz = kv[i + 2];
        vertices.push(
          hp0 + lx * leafR0 + ly * n0 + lz * leafF0,
          hp1 + lx * leafR1 + ly * n1 + lz * leafF1,
          hp2 + lx * leafR2 + ly * n2 + lz * leafF2
        );
        colors.push(kc[i], kc[i + 1], kc[i + 2]);
      }
      if (isFlipped) {
        for (let i = 0, len = kidx.length; i < len; i += 3) {
          indices.push(baseVertIdx + kidx[i], baseVertIdx + kidx[i + 2], baseVertIdx + kidx[i + 1]);
        }
      } else {
        for (let i = 0, len = kidx.length; i < len; i++) {
          indices.push(baseVertIdx + kidx[i]);
        }
      }
    }
  }
};
