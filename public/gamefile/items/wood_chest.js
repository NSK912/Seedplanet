// === SEEDPLANET MODULE: JS/ITEMS/WOOD_CHEST.JS ===

window.ItemRegistry["wood_chest"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const boxFunc = typeof addBox === "function" ? addBox : (typeof window !== "undefined" && typeof window.addBox === "function" ? window.addBox : null);
    if (!boxFunc) return;

    const p = item.position;
    const r = item.R || [1,0,0], f = item.F || [0,0,1], n = item.normal || [0,1,0];
    const isPreview = item.isPreview;
    const isValid = item.isValidPlacement !== false;
    const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];

    const cs = 0.45; // chest scale factor
    // 1) Base Box
    const basePos = [
      p[0] + n[0] * (0.065 * cs),
      p[1] + n[1] * (0.065 * cs),
      p[2] + n[2] * (0.065 * cs)
    ];
    const baseColor = isPreview ? previewColor : [0.45, 0.3, 0.15];
    boxFunc(basePos, 0.24 * cs, 0.13 * cs, 0.18 * cs, baseColor, r, n, f, vertices, colors, indices);

    // 2) Lid Box
    const lidPos = [
      p[0] + n[0] * (0.16 * cs),
      p[1] + n[1] * (0.16 * cs),
      p[2] + n[2] * (0.16 * cs)
    ];
    const lidColor = isPreview ? previewColor : [0.38, 0.24, 0.12];
    boxFunc(lidPos, 0.25 * cs, 0.06 * cs, 0.19 * cs, lidColor, r, n, f, vertices, colors, indices);

    // 3) Front Clasp / Lock
    const lockPos = [
      p[0] + n[0] * (0.13 * cs) + f[0] * (0.103 * cs),
      p[1] + n[1] * (0.13 * cs) + f[1] * (0.103 * cs),
      p[2] + n[2] * (0.13 * cs) + f[2] * (0.103 * cs)
    ];
    const lockColor = isPreview ? previewColor : [0.85, 0.7, 0.25];
    boxFunc(lockPos, 0.04 * cs, 0.04 * cs, 0.016 * cs, lockColor, r, n, f, vertices, colors, indices);
  }
};
