// === SEEDPLANET MODULE: JS/ITEMS/CAMPFIRE.JS ===

// Pre-baked Local Template Cache for campfire (8 rocks + 4 crossed logs = 12 boxes)
const _campfireTemplateCache = {};

function _getCampfireTemplate(s, seedBucket, mode) {
  const key = s.toFixed(3) + '_' + seedBucket + '_' + mode;
  if (_campfireTemplateCache[key]) return _campfireTemplateCache[key];

  const v = [], c = [], idx = [];
  const localR = [1, 0, 0];
  const localN = [0, 1, 0];
  const localF = [0, 0, 1];

  const isPreview = mode !== 0;
  const previewColor = mode === 1 ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
  const seedVal = seedBucket * 19.73;

  function pRand(sd) {
    const x = Math.sin(sd) * 10000;
    return x - Math.floor(x);
  }

  // 1) Ring of Rocks (8 boxes)
  const numRocks = 8;
  const rockRadius = 0.15 * s;
  for (let i = 0; i < numRocks; i++) {
    const angle = (i / numRocks) * Math.PI * 2;
    const rockPos = [
      Math.cos(angle) * rockRadius,
      0.0,
      Math.sin(angle) * rockRadius
    ];
    const pNoise = pRand(seedVal + i * 11);
    const rockSize = (0.03 + pNoise * 0.03) * s;
    const rockColor = isPreview ? previewColor : [0.4 + pNoise * 0.1, 0.4 + pNoise * 0.1, 0.4 + pNoise * 0.1];
    addBox(rockPos, rockSize, rockSize, rockSize, rockColor, localR, localN, localF, v, c, idx);
  }

  // 2) Crossed Logs (4 boxes)
  const numLogs = 4;
  const logLen = 0.25 * s;
  const logW = 0.03 * s;
  const logColor = isPreview ? previewColor : [0.45, 0.3, 0.15];
  const logPos = [0.0, 0.02 * s, 0.0];
  for (let i = 0; i < numLogs; i++) {
    const angle = (i / numLogs) * Math.PI + pRand(seedVal + i * 22) * 0.5;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const r_dir = [cosA, 0, sinA];
    const f_dir = [-sinA, 0, cosA];
    addBox(logPos, logLen, logW, logW, logColor, r_dir, localN, f_dir, v, c, idx);
  }

  const tpl = {
    v: new Float32Array(v),
    c: new Float32Array(c),
    idx: new Uint16Array(idx)
  };
  _campfireTemplateCache[key] = tpl;
  return tpl;
}

window.ItemRegistry["campfire"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const r = item.R, f = item.F, n = item.normal;
    const s = item.size || 1.0;

    const isPreview = item.isPreview;
    const isValid = item.isValidPlacement !== false;
    const mode = isPreview ? (isValid ? 1 : 2) : 0;

    const rawSeed = item.seed || (p[0] * 123.4 + p[2] * 56.7);
    const seedBucket = Math.abs(Math.floor(rawSeed * 10)) % 16;
    const tpl = _getCampfireTemplate(s, seedBucket, mode);

    const baseVertIdx = vertices.length / 3;
    const tv = tpl.v;
    const tc = tpl.c;
    const tidx = tpl.idx;
    const p0 = p[0], p1 = p[1], p2 = p[2];
    const r0 = r[0], r1 = r[1], r2 = r[2];
    const n0 = n[0], n1 = n[1], n2 = n[2];
    const f0 = f[0], f1 = f[1], f2 = f[2];
    const det = (r1 * n2 - r2 * n1) * f0 + (r2 * n0 - r0 * n2) * f1 + (r0 * n1 - r1 * n0) * f2;
    const isFlipped = det < 0;

    for (let i = 0, len = tv.length; i < len; i += 3) {
      const lx = tv[i], ly = tv[i + 1], lz = tv[i + 2];
      vertices.push(
        p0 + lx * r0 + ly * n0 + lz * f0,
        p1 + lx * r1 + ly * n1 + lz * f1,
        p2 + lx * r2 + ly * n2 + lz * f2
      );
      colors.push(tc[i], tc[i + 1], tc[i + 2]);
    }
    if (isFlipped) {
      for (let i = 0, len = tidx.length; i < len; i += 3) {
        indices.push(baseVertIdx + tidx[i], baseVertIdx + tidx[i + 2], baseVertIdx + tidx[i + 1]);
      }
    } else {
      for (let i = 0, len = tidx.length; i < len; i++) {
        indices.push(baseVertIdx + tidx[i]);
      }
    }
  }
};

