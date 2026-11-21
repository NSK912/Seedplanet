// === SEEDPLANET MODULE: JS/ITEMS/OBSIDIAN_FLUX_ITEM.JS ===
// Gilded Obsidian Flux (OBSIDIAN_FLUX)
// Crafted from 1x Obsidian Cube + 1x Glow Ore -> 5x Obsidian Ball

(function() {
  function _buildObsidianFluxLocal(isIconMode, localVerts, localCols, localIndices, isDropLowPoly) {

    const unitRadius = 0.26;
    const cosRy = Math.cos(2.0);
    const sinRy = Math.sin(2.0);
    const cosRx = Math.cos(0.53407);
    const sinRx = Math.sin(0.53407);

    function screenToLocal(sx, sy, sz) {
      const y = sy * cosRx + sz * sinRx;
      const z1 = -sy * sinRx + sz * cosRx;
      const x = sx * cosRy + z1 * sinRy;
      const z = -sx * sinRy + z1 * cosRy;
      return [x, y, z];
    }

    let ax = -0.61, ay = 0.75, az = -0.25;
    const aLen = Math.hypot(ax, ay, az) || 1;
    ax /= aLen; ay /= aLen; az /= aLen;

    let bx = 0.0, by = 0.0, bz = -1.0;
    const dotAB = bx * ax + by * ay + bz * az;
    bx -= dotAB * ax;
    by -= dotAB * ay;
    bz -= dotAB * az;
    const bLen = Math.hypot(bx, by, bz) || 1;
    bx /= bLen; by /= bLen; bz /= bLen;

    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;

    const segsLat = isDropLowPoly ? 16 : 40;
    const segsLon = isDropLowPoly ? 20 : 48;
    const lx = -0.35, ly = 0.62, lz = -0.70;

    function makeLocalVertex(theta, phi, rScale) {
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);

      const sx = ax * cosT + (bx * cosP + cx * sinP) * sinT;
      const sy = ay * cosT + (by * cosP + cy * sinP) * sinT;
      const sz = az * cosT + (bz * cosP + cz * sinP) * sinT;

      return screenToLocal(sx * unitRadius * rScale, sy * unitRadius * rScale, sz * unitRadius * rScale);
    }

    for (let lat = 0; lat < segsLat; lat++) {
      const theta0 = (lat / segsLat) * Math.PI;
      const theta1 = ((lat + 1) / segsLat) * Math.PI;
      const tMid = Math.cos((theta0 + theta1) * 0.5);

      for (let lon = 0; lon < segsLon; lon++) {
        const phi0 = (lon / segsLon) * Math.PI * 2 - Math.PI;
        const phi1 = ((lon + 1) / segsLon) * Math.PI * 2 - Math.PI;
        const phiMid = (phi0 + phi1) * 0.5;

        let matType = "obsidian";
        let rScale0 = 1.0;
        let rScale1 = 1.0;

        if (tMid > 0.355) {
          matType = "obsidian";
          if (Math.abs(phiMid + 0.62) < 0.055 && tMid < 0.88) {
            matType = "groove";
            rScale0 = 0.990;
            rScale1 = 0.990;
          }
        } else if (tMid > 0.245) {
          if (tMid > 0.285 && tMid < 0.315) {
            matType = "rib";
            rScale0 = 0.994;
            rScale1 = 0.994;
          } else {
            matType = "groove";
            rScale0 = 0.970;
            rScale1 = 0.970;
          }
        } else if (tMid >= -0.245) {
          const absSinPhi = Math.abs(Math.sin(phiMid));
          const sideCurve = Math.pow(absSinPhi, 2.2);
          const panelLimitT = 0.188 * Math.max(0.0, 1.0 - 1.18 * sideCurve);
          const absT = Math.abs(tMid);

          if (absSinPhi > 0.88 || absT > panelLimitT) {
            matType = "gold";
            rScale0 = 1.004;
            rScale1 = 1.004;
          } else if (absT > panelLimitT - 0.016) {
            matType = "groove";
            rScale0 = 0.992;
            rScale1 = 0.992;
          } else {
            matType = "obsidian";
          }
        } else if (tMid >= -0.355) {
          if (tMid < -0.285 && tMid > -0.315) {
            matType = "rib";
            rScale0 = 0.994;
            rScale1 = 0.994;
          } else {
            matType = "groove";
            rScale0 = 0.970;
            rScale1 = 0.970;
          }
        } else {
          matType = "gold";
          rScale0 = 1.003;
          rScale1 = 1.003;
          if (Math.abs(phiMid - 0.48) < 0.05 && tMid > -0.90) {
            matType = "groove";
            rScale0 = 0.990;
            rScale1 = 0.990;
          }
        }

        const sinTM = Math.sin((theta0 + theta1) * 0.5);
        const cosPM = Math.cos(phiMid);
        const sinPM = Math.sin(phiMid);
        const nsx = ax * tMid + (bx * cosPM + cx * sinPM) * sinTM;
        const nsy = ay * tMid + (by * cosPM + cy * sinPM) * sinTM;
        const nsz = az * tMid + (bz * cosPM + cz * sinPM) * sinTM;

        const ndotl = Math.max(0.0, nsx * lx + nsy * ly + nsz * lz);
        let hx = lx, hy = ly, hz = lz - 1.0;
        const hLen = Math.hypot(hx, hy, hz) || 1;
        hx /= hLen; hy /= hLen; hz /= hLen;
        const ndoth = Math.max(0.0, nsx * hx + nsy * hy + nsz * hz);

        const envDot = Math.max(0.0, nsx * 0.55 - nsy * 0.45 - nsz * 0.70);
        const envSpec = Math.pow(envDot, 6.0) * 0.35;

        let stdCol, iconCol;
        if (matType === "gold") {
          const spec = Math.pow(ndoth, 16.0) * 0.45 + envSpec;
          const diff = 0.68 + 0.36 * ndotl;
          iconCol = [
            Math.min(1.0, 0.96 * diff + spec * 0.45),
            Math.min(1.0, 0.79 * diff + spec * 0.42),
            Math.min(1.0, 0.26 * diff + spec * 0.55)
          ];
          stdCol = [0.95, 0.78, 0.23];
        } else if (matType === "groove") {
          stdCol = [0.04, 0.04, 0.06];
          iconCol = stdCol;
        } else if (matType === "rib") {
          const diff = 0.55 + 0.45 * ndotl;
          stdCol = [0.18 * diff, 0.19 * diff, 0.22 * diff];
          iconCol = stdCol;
        } else {
          const spec = Math.pow(ndoth, 9.0) * 0.24;
          const diff = 0.48 + 0.62 * ndotl;
          stdCol = [
            Math.min(1.0, 0.19 * diff + spec),
            Math.min(1.0, 0.20 * diff + spec),
            Math.min(1.0, 0.23 * diff + spec * 1.05)
          ];
          iconCol = stdCol;
        }

        const p00 = makeLocalVertex(theta0, phi0, rScale0);
        const p10 = makeLocalVertex(theta1, phi0, rScale1);
        const p11 = makeLocalVertex(theta1, phi1, rScale1);
        const p01 = makeLocalVertex(theta0, phi1, rScale0);

        const baseIdx = localVerts.length / 3;
        localVerts.push(
          p00[0], p00[1], p00[2],
          p01[0], p01[1], p01[2],
          p11[0], p11[1], p11[2],
          p10[0], p10[1], p10[2]
        );
        const colOut = isIconMode ? iconCol : stdCol;
        for (let k = 0; k < 4; k++) {
          localCols.push(colOut[0], colOut[1], colOut[2]);
        }
        localIndices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
      }
    }
  }

  window.buildObsidianFluxModel = function(
    seed,
    animPhase,
    isRagdoll,
    isSwimming,
    scaleMultiplier,
    pos,
    R,
    N,
    F,
    vertices,
    colors,
    indices,
    overrideColors = null,
    f = null,
    transformPoint = null,
    c = null
  ) {
    const basePos = (pos && Array.isArray(pos) && pos.length >= 3)
      ? pos
      : ((c && c.position) || [0, 0, 0]);
    const itemR = R || [1, 0, 0];
    const itemN = N || [0, 1, 0];
    const itemF = F || [0, 0, 1];
    const isIconPreview = Boolean(c && c.isIconPreview);
    const isDropMode = Boolean(c && c._isGroundDropRender);
    const s = scaleMultiplier || 1.0;
    const yOff = isDropMode ? 0.26 : 0;

    const tplKey = isIconPreview ? "obsidian_flux_icon" : (isDropMode ? "obsidian_flux_drop" : "obsidian_flux_std");
    const tpl = window.DropTemplateCache.getOrBake(
      tplKey,
      (tv, tc, ti) => _buildObsidianFluxLocal(isIconPreview, tv, tc, ti, isDropMode)
    );
    if (!tpl) return;

    if (transformPoint) {
      const lv = tpl.verts;
      const lc = tpl.cols;
      const li = tpl.inds;
      const baseIdx = vertices.length / 3;
      for (let i = 0, len = lv.length; i < len; i += 3) {
        const pt = transformPoint(lv[i] * s, lv[i + 1] * s, lv[i + 2] * s);
        vertices.push(pt[0], pt[1], pt[2]);
      }
      if (overrideColors) {
        const oc0 = overrideColors[0], oc1 = overrideColors[1], oc2 = overrideColors[2];
        const vCount = lv.length / 3;
        for (let i = 0; i < vCount; i++) {
          colors.push(oc0, oc1, oc2);
        }
      } else {
        for (let i = 0, len = lc.length; i < len; i += 3) {
          colors.push(lc[i], lc[i + 1], lc[i + 2]);
        }
      }
      for (let i = 0, len = li.length; i < len; i++) {
        indices.push(baseIdx + li[i]);
      }
    } else {
      window.DropTemplateCache.emit(
        tpl,
        basePos,
        itemR,
        itemN,
        itemF,
        s,
        yOff,
        vertices,
        colors,
        indices,
        overrideColors
      );
    }
  };

  const renderHandler = {
    render: function(item, vertices, colors, indices, targetBuffer) {
      const isIcon = (targetBuffer === "preview" || !!(item && item.isIconPreview));
      const isPreview = !!(item && item.isPreview);
      const p = (item && item.position) ? item.position : [0, 0, 0];
      const itemR = (item && item.R) ? item.R : [1, 0, 0];
      const itemF = (item && item.F) ? item.F : [0, 0, 1];
      const itemN = (item && item.normal) ? item.normal : [0, 1, 0];
      const isValid = !(item && item.isValidPlacement === false);

      let overrideColors = null;
      if (isPreview) {
        overrideColors = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
      }

      const isDrop = !isIcon && !isPreview;
      const seed = (item && typeof item.seed === "number") ? item.seed : 1234;
      const scale = isDrop
        ? (item && typeof item.scaleMultiplier === "number"
            ? item.scaleMultiplier
            : Math.min((item && typeof item.size === "number") ? item.size : 0.078, 0.095))
        : ((item && item.scaleMultiplier) || 1.0);
      const basis = isDrop
        ? window.DropTemplateCache.rotateBasis(itemR, itemF, (seed * 6.28318) % (Math.PI * 2))
        : { R: itemR, F: itemF };
      const ctxItem = isDrop
        ? Object.assign({}, item, { _isGroundDropRender: true })
        : item;

      window.buildObsidianFluxModel(
        seed,
        0,
        false,
        false,
        scale,
        p,
        basis.R, itemN, basis.F,
        vertices, colors, indices,
        overrideColors,
        null,
        null,
        ctxItem
      );
    }
  };

  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["obsidian_flux_item"] = renderHandler;
  window.ItemRegistry["obsidian_flux"] = renderHandler;
  window.ItemRegistry["OBSIDIAN_FLUX"] = renderHandler;
})();
