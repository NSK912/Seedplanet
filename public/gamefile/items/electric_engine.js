// === SEEDPLANET MODULE: JS/ITEMS/ELECTRIC_ENGINE.JS ===

const _electricEngineTemplateCache = new Map();
const MAX_ENGINE_TEMPLATES = 24;

function getOrCreateRawElectricEngineTemplate(engWid, engHei, engLen) {
  const key = Math.round(engWid * 10000) + "_" + Math.round(engHei * 10000) + "_" + Math.round(engLen * 10000);
  let cached = _electricEngineTemplateCache.get(key);
  if (cached) return cached;

  const s = engLen / 0.45;
  const tempVerts = [];
  const tempColors = [];
  const tempIndices = [];
  const tempSlots = [];
  const lr = [1, 0, 0];
  const ln = [0, 1, 0];
  const lf = [0, 0, 1];
  const dummyCol = [1, 1, 1];

  const pushBox = (c, w, h, d, slot, br, bn, bf) => {
    const startV = tempVerts.length / 3;
    addBox(c, w, h, d, dummyCol, br, bn, bf, tempVerts, tempColors, tempIndices);
    const endV = tempVerts.length / 3;
    for (let v = startV; v < endV; v++) tempSlots.push(slot);
  };

  // 0: Main metal casing
  pushBox([0, 0, 0], engWid, engHei, engLen, 0, lr, ln, lf);

  // 1: Black side panels
  pushBox([engWid / 2 + 0.01 * s, 0, 0], 0.01 * s, engHei * 0.7, engLen * 0.8, 1, lr, ln, lf);
  pushBox([-(engWid / 2 + 0.01 * s), 0, 0], 0.01 * s, engHei * 0.7, engLen * 0.8, 1, lr, ln, lf);

  // 2: Top battery/capacitor ridges
  for (let i = -2; i <= 2; i++) {
    pushBox([0, engHei / 2 + 0.02 * s, i * engLen * 0.15], engWid * 0.9, 0.04 * s, engLen * 0.05, 2, lr, ln, lf);
  }

  // 1: Front connector interface
  pushBox([0, 0, engLen / 2 + 0.02 * s], engWid * 0.5, engHei * 0.5, 0.04 * s, 1, lr, ln, lf);

  // 3: Side gear/wheel made of intersecting boxes
  const gx = engWid / 2 + 0.06 * s;
  const gearRadius = engHei * 0.6;
  const gearThick = 0.06 * s;
  pushBox([gx, 0, 0], gearThick, gearRadius, gearRadius, 3, lr, ln, lf);

  const diagN = [0, 0.707, -0.707];
  const diagF = [0, 0.707, 0.707];
  pushBox([gx, 0, 0], gearThick, gearRadius, gearRadius, 3, lr, diagN, diagF);

  const tpl = {
    verts: new Float32Array(tempVerts),
    slots: new Uint8Array(tempSlots),
    indices: new Uint16Array(tempIndices),
    vertCount: tempVerts.length / 3
  };

  if (_electricEngineTemplateCache.size >= MAX_ENGINE_TEMPLATES) {
    const firstKey = _electricEngineTemplateCache.keys().next().value;
    _electricEngineTemplateCache.delete(firstKey);
  }
  _electricEngineTemplateCache.set(key, tpl);
  return tpl;
}

window.drawElectricEngine = function(center, engWid, engHei, engLen, r, n, f, cMain, cDark, cAccent, gearColor, vertices, colors, indices) {
  if (typeof addBox !== "function") return;

  const tpl = getOrCreateRawElectricEngineTemplate(engWid, engHei, engLen);
  const tVerts = tpl.verts;
  const tSlots = tpl.slots;
  const tIndices = tpl.indices;
  const vCount = tpl.vertCount;
  const baseIdx = vertices.length / 3;

  const cx = center[0], cy = center[1], cz = center[2];
  const r0 = r[0], r1 = r[1], r2 = r[2];
  const n0 = n[0], n1 = n[1], n2 = n[2];
  const f0 = f[0], f1 = f[1], f2 = f[2];
  const palette = [cMain, cDark, cAccent, gearColor];

  for (let i = 0; i < vCount; i++) {
    const i3 = i * 3;
    const lx = tVerts[i3];
    const ly = tVerts[i3 + 1];
    const lz = tVerts[i3 + 2];

    vertices.push(
      cx + r0 * lx + n0 * ly + f0 * lz,
      cy + r1 * lx + n1 * ly + f1 * lz,
      cz + r2 * lx + n2 * ly + f2 * lz
    );

    const col = palette[tSlots[i]];
    colors.push(col[0], col[1], col[2]);
  }

  const det = (r1 * n2 - r2 * n1) * f0 + (r2 * n0 - r0 * n2) * f1 + (r0 * n1 - r1 * n0) * f2;
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
};

window.ItemRegistry["electric_engine"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const isPreview = item.isPreview;
    const isValid = item.isValidPlacement !== false;
    const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    
    const cMain = isPreview ? previewColor : [0.75, 0.75, 0.78];
    const cDark = isPreview ? previewColor : [0.2, 0.2, 0.22];
    const cAccent = isPreview ? previewColor : [0.85, 0.85, 0.85];
    const gearColor = isPreview ? previewColor : [0.4, 0.4, 0.4];
    
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
    
    if (isPreview && item.isBoatSnapped) {
      const bs = 0.4;
      const engScale = typeof window.electricEngineScaleMultiplier !== "number" ? 0.36 : window.electricEngineScaleMultiplier;
      const engLen = 0.3 * 1.5 * engScale;
      const engWid = 0.3 * 0.8 * engScale;
      const engHei = 0.3 * 0.8 * engScale;
      
      const upOff = typeof window.electricEngineUpOffset !== "number" ? 0.05 : window.electricEngineUpOffset;
      const fwdOff = typeof window.electricEngineFwdOffset !== "number" ? -0.11 : window.electricEngineFwdOffset;
      const engPitch = typeof window.electricEnginePitch !== "number" ? 0 : window.electricEnginePitch;
      const engYaw = typeof window.electricEngineYaw !== "number" ? 1.57 : window.electricEngineYaw;
      const engRoll = typeof window.electricEngineRoll !== "number" ? 0 : window.electricEngineRoll;
      
      const center = [
        p[0] + n[0] * upOff + f[0] * fwdOff,
        p[1] + n[1] * upOff + f[1] * fwdOff,
        p[2] + n[2] * upOff + f[2] * fwdOff
      ];

      let engR = [...r];
      let engN = [...n];
      let engF = [...f];

      if (engYaw !== 0) {
        const cy = Math.cos(engYaw); const sy = Math.sin(engYaw);
        const tempR = [engR[0]*cy - engF[0]*sy, engR[1]*cy - engF[1]*sy, engR[2]*cy - engF[2]*sy];
        const tempF = [engF[0]*cy + engR[0]*sy, engF[1]*cy + engR[1]*sy, engF[2]*cy + engR[2]*sy];
        engR = tempR; engF = tempF;
      }
      if (engPitch !== 0) {
        const cp = Math.cos(engPitch); const sp = Math.sin(engPitch);
        const tempF = [engF[0]*cp - engN[0]*sp, engF[1]*cp - engN[1]*sp, engF[2]*cp - engN[2]*sp];
        const tempN = [engN[0]*cp + engF[0]*sp, engN[1]*cp + engF[1]*sp, engN[2]*cp + engF[2]*sp];
        engF = tempF; engN = tempN;
      }
      if (engRoll !== 0) {
        const cr = Math.cos(engRoll); const sr = Math.sin(engRoll);
        const tempR = [engR[0]*cr - engN[0]*sr, engR[1]*cr - engN[1]*sr, engR[2]*cr - engN[2]*sr];
        const tempN = [engN[0]*cr + engR[0]*sr, engN[1]*cr + engR[1]*sr, engN[2]*cr + engR[2]*sr];
        engR = tempR; engN = tempN;
      }
      
      window.drawElectricEngine(center, engWid, engHei, engLen, engR, engN, engF, previewColor, previewColor, previewColor, previewColor, vertices, colors, indices);
      return;
    }

    const scale = item.size || 0.3;
    const engLen = scale * 1.5;
    const engWid = scale * 0.8;
    const engHei = scale * 0.8;
    
    const center = [
      p[0] + n[0] * (engHei / 2),
      p[1] + n[1] * (engHei / 2),
      p[2] + n[2] * (engHei / 2)
    ];

    window.drawElectricEngine(center, engWid, engHei, engLen, r, n, f, cMain, cDark, cAccent, gearColor, vertices, colors, indices);
  }
};
