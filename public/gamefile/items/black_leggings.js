// === SEEDPLANET MODULE: JS/ITEMS/BLACK_LEGGINGS.JS ===
// Matte Black Form-Fitting Full-Length Leggings (BLACK_LEGGINGS) — inventory icon mesh builder
// (Worn mesh geometry is integrated directly inside generateChibiTorso/Thigh/Calf via includeLeggings)

(function() {
  const H = window._CapsuleClothHelpers || {};
  const _appendCCWMeshAsCWIcon = H._appendCCWMeshAsCWIcon;
  const generateChibiTorso = H.generateChibiTorso || window.generateChibiTorso;
  const generateChibiThigh = H.generateChibiThigh || window.generateChibiThigh;
  const generateChibiCalf = H.generateChibiCalf || window.generateChibiCalf;

  function buildBlackLeggingsIconMesh(rawVertices, rawColors, rawIndices) {
    const chestP1 = [0, -0.090, 0];
    const chestP2 = [0,  0.170, 0];
    const lHip  = [-0.052, -0.068, 0];
    const lKnee = [-0.052, -0.246, 0.010];
    const lFoot = [-0.052, -0.420, 0];
    const rHip  = [ 0.052, -0.068, 0];
    const rKnee = [ 0.052, -0.246, 0.010];
    const rFoot = [ 0.052, -0.420, 0];

    const isLeggingsTri = (a, b, c, vArr, cArr) => {
      return cArr[a * 3] < 0.28 && cArr[b * 3] < 0.28 && cArr[c * 3] < 0.28;
    };
    const liftBlackColor = (r, g, b) => {
      const k = Math.max(0.085, Math.min(0.255, r * 1.48 + 0.035));
      return [k, k * 1.02, k * 1.14];
    };

    const pelvisMesh = generateChibiTorso(chestP1, chestP2, 0.09, 1.0, false, false, false, true);
    _appendCCWMeshAsCWIcon(pelvisMesh, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: false,
      triFilter: isLeggingsTri,
      colorMap: liftBlackColor
    });

    for (const isL of [true, false]) {
      const hip = isL ? lHip : rHip;
      const knee = isL ? lKnee : rKnee;
      const foot = isL ? lFoot : rFoot;

      const thighMesh = generateChibiThigh(hip, knee, isL, 1.0, false, true);
      _appendCCWMeshAsCWIcon(thighMesh, rawVertices, rawColors, rawIndices, {
        firstHalfOnly: false,
        triFilter: isLeggingsTri,
        colorMap: liftBlackColor
      });

      const calfMesh = generateChibiCalf(knee, foot, isL, 1.0, true);
      _appendCCWMeshAsCWIcon(calfMesh, rawVertices, rawColors, rawIndices, {
        firstHalfOnly: false,
        triFilter: isLeggingsTri,
        colorMap: liftBlackColor
      });
    }

    const addV = (x, y, z, col) => {
      const idx = (rawVertices.length / 3) | 0;
      rawVertices.push(x, y, z);
      rawColors.push(col[0], col[1], col[2]);
      return idx;
    };
    const addQuadCW = (i0, i1, i2, i3) => {
      rawIndices.push(i0, i2, i1);
      rawIndices.push(i0, i3, i2);
    };
    const colInner = [0.068, 0.072, 0.088];
    const wSegs = 16;
    const wTop = [], wBot = [];
    for (let j = 0; j < wSegs; j++) {
      const ang = (j / wSegs) * Math.PI * 2.0;
      wTop.push(addV(Math.sin(ang) * 0.078, -0.006, Math.cos(ang) * 0.056, colInner));
      wBot.push(addV(Math.sin(ang) * 0.064, -0.032, Math.cos(ang) * 0.044, colInner));
    }
    for (let j = 0; j < wSegs; j++) {
      const nextJ = (j + 1) % wSegs;
      addQuadCW(wTop[nextJ], wTop[j], wBot[j], wBot[nextJ]);
    }
  }

  window.buildBlackLeggingsIconMesh = buildBlackLeggingsIconMesh;
  if (window.CapsuleModel) {
    window.CapsuleModel.buildBlackLeggingsIconMesh = buildBlackLeggingsIconMesh;
  }
  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["black_leggings"] = Object.assign({}, window.ItemRegistry["BLACK_LEGGINGS"] || {}, {
    buildIconMesh: buildBlackLeggingsIconMesh
  });
  window.ItemRegistry["BLACK_LEGGINGS"] = window.ItemRegistry["black_leggings"];
})();
