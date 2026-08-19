/**
 * ============================================================================
 * WORLD 3D UI MODULE (In-World & Object-Attached 3D UI System)
 * ============================================================================
 * Allows creating UI signs, labels, nameplates, and interactive elements that:
 * 1. Stay fixed to 3D world coordinates OR attach to objects/vehicles/structures.
 * 2. Do NOT rotate with the screen (maintains 3D surface orientation in world space).
 * 3. Perspective-compress, tilt, foreshorten, and backface-cull realistically.
 */

(function(global) {
  'use strict';

  // Container DOM element
  let uiRoot = null;
  const activeSigns = new Map();
  let idCounter = 1;

  function ensureUIRoot() {
    if (!uiRoot) {
      uiRoot = document.getElementById('world3DUIRoot');
      if (!uiRoot) {
        uiRoot = document.createElement('div');
        uiRoot.id = 'world3DUIRoot';
        uiRoot.style.position = 'absolute';
        uiRoot.style.top = '0';
        uiRoot.style.left = '0';
        uiRoot.style.width = '100%';
        uiRoot.style.height = '100%';
        uiRoot.style.pointerEvents = 'none';
        uiRoot.style.overflow = 'hidden';
        uiRoot.style.zIndex = '50';

        const gameContainer = document.getElementById('gameContainer') || document.body;
        gameContainer.appendChild(uiRoot);
      }
    }
    return uiRoot;
  }

  /**
   * Normalize a 3D vector
   */
  function normalizeVec3(v) {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (len < 1e-7) return [0, 1, 0];
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  /**
   * Cross product of two 3D vectors
   */
  function crossVec3(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  /**
   * Dot product of two 3D vectors
   */
  function dotVec3(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  /**
   * Project a 3D world coordinate to 2D Screen pixel coordinates
   */
  function projectWorldPoint(worldPos, viewMat, projMat, width, height) {
    if (!viewMat || !projMat) return null;
    const vx = worldPos[0] * viewMat[0] + worldPos[1] * viewMat[4] + worldPos[2] * viewMat[8] + viewMat[12];
    const vy = worldPos[0] * viewMat[1] + worldPos[1] * viewMat[5] + worldPos[2] * viewMat[9] + viewMat[13];
    const vz = worldPos[0] * viewMat[2] + worldPos[1] * viewMat[6] + worldPos[2] * viewMat[10] + viewMat[14];
    const vw = worldPos[0] * viewMat[3] + worldPos[1] * viewMat[7] + worldPos[2] * viewMat[11] + viewMat[15];

    const cx = vx * projMat[0] + vy * projMat[4] + vz * projMat[8] + vw * projMat[12];
    const cy = vx * projMat[1] + vy * projMat[5] + vz * projMat[9] + vw * projMat[13];
    const cz = vx * projMat[2] + vy * projMat[6] + vz * projMat[10] + vw * projMat[14];
    const cw = vx * projMat[3] + vy * projMat[7] + vz * projMat[11] + vw * projMat[15];

    if (cw <= 0.001) return null;

    const ndcX = cx / cw;
    const ndcY = cy / cw;
    const ndcZ = cz / cw;

    if (ndcZ < -1.0 || ndcZ > 1.0) return null;

    return {
      x: (ndcX * 0.5 + 0.5) * width,
      y: (1.0 - (ndcY * 0.5 + 0.5)) * height,
      depth: cw
    };
  }

  /**
   * Check if point is behind the planet core
   */
  function isPlanetOccluded(camPos, targetPos, planetRadius) {
    if (!camPos || !targetPos) return false;
    const r = planetRadius || (typeof RADIUS !== "undefined" ? RADIUS : 1.0);
    const dx = targetPos[0] - camPos[0];
    const dy = targetPos[1] - camPos[1];
    const dz = targetPos[2] - camPos[2];
    const dLenSq = dx * dx + dy * dy + dz * dz;
    if (dLenSq < 1e-6) return false;

    const dotCD = camPos[0] * dx + camPos[1] * dy + camPos[2] * dz;
    const t = -dotCD / dLenSq;

    if (t > 0.0 && t < 1.0) {
      const closestX = camPos[0] + t * dx;
      const closestY = camPos[1] + t * dy;
      const closestZ = camPos[2] + t * dz;
      const distSq = closestX * closestX + closestY * closestY + closestZ * closestZ;
      if (distSq < r * r * 0.99) {
        return true;
      }
    }
    return false;
  }

  /**
   * Create a new In-World 3D Sign / Label
   * @param {Object} config
   * @returns {string} sign ID
   */
  function createSign(config = {}) {
    ensureUIRoot();

    const id = config.id || `world_sign_${idCounter++}`;
    if (activeSigns.has(id)) {
      removeSign(id);
    }

    const elem = document.createElement('div');
    elem.id = `world_sign_el_${id}`;
    elem.className = config.className || 'world-3d-sign';
    elem.style.position = 'absolute';
    elem.style.top = '0';
    elem.style.left = '0';
    elem.style.transformOrigin = '50% 50%';
    elem.style.display = 'none';
    elem.style.pointerEvents = config.interactive ? 'auto' : 'none';
    elem.style.userSelect = 'none';
    elem.style.boxSizing = 'border-box';
    elem.style.willChange = 'transform, opacity';

    if (config.style) {
      Object.assign(elem.style, config.style);
    }

    // Default stylized badge design if no custom HTML provided
    if (typeof config.content === 'string') {
      elem.innerHTML = config.content;
    } else if (config.content instanceof HTMLElement) {
      elem.appendChild(config.content);
    } else {
      elem.innerHTML = `
        <div style="padding: 6px 12px; background: rgba(20, 20, 25, 0.88); border: 1px solid #dfb76c; border-radius: 6px; color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
          ${config.text || '3D Sign'}
        </div>
      `;
    }

    uiRoot.appendChild(elem);

    const sign = {
      id: id,
      element: elem,
      position: config.position || [0, 1, 0],
      normal: normalizeVec3(config.normal || [0, 0, 1]),
      up: normalizeVec3(config.up || [0, 1, 0]),
      parent: config.parent || null,
      offset: config.offset || [0, 0, 0],
      size: config.size || [0.35, 0.18], // world units [width, height]
      isScreenAligned: !!config.isScreenAligned, // default false: does NOT rotate with screen
      backfaceCulling: config.backfaceCulling !== undefined ? !!config.backfaceCulling : true,
      doubleSided: !!config.doubleSided,
      maxDistance: config.maxDistance || 25.0,
      fadeDistance: config.fadeDistance || 20.0,
      visible: config.visible !== undefined ? !!config.visible : true,
      interactive: !!config.interactive,
      customData: config.customData || {}
    };

    activeSigns.set(id, sign);
    return id;
  }

  /**
   * Update configuration of an existing sign
   */
  function updateSign(id, config = {}) {
    const sign = activeSigns.get(id);
    if (!sign) return false;

    if (config.position) sign.position = config.position;
    if (config.normal) sign.normal = normalizeVec3(config.normal);
    if (config.up) sign.up = normalizeVec3(config.up);
    if (config.parent !== undefined) sign.parent = config.parent;
    if (config.offset) sign.offset = config.offset;
    if (config.size) sign.size = config.size;
    if (config.isScreenAligned !== undefined) sign.isScreenAligned = !!config.isScreenAligned;
    if (config.backfaceCulling !== undefined) sign.backfaceCulling = !!config.backfaceCulling;
    if (config.doubleSided !== undefined) sign.doubleSided = !!config.doubleSided;
    if (config.maxDistance !== undefined) sign.maxDistance = config.maxDistance;
    if (config.visible !== undefined) sign.visible = !!config.visible;
    if (config.interactive !== undefined) {
      sign.interactive = !!config.interactive;
      sign.element.style.pointerEvents = sign.interactive ? 'auto' : 'none';
    }

    if (config.content !== undefined) {
      sign.element.innerHTML = '';
      if (typeof config.content === 'string') {
        sign.element.innerHTML = config.content;
      } else if (config.content instanceof HTMLElement) {
        sign.element.appendChild(config.content);
      }
    }

    if (config.style) {
      Object.assign(sign.element.style, config.style);
    }

    return true;
  }

  /**
   * Remove a sign by ID
   */
  function removeSign(id) {
    const sign = activeSigns.get(id);
    if (sign) {
      if (sign.element && sign.element.parentNode) {
        sign.element.parentNode.removeChild(sign.element);
      }
      activeSigns.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Get a sign object
   */
  function getSign(id) {
    return activeSigns.get(id) || null;
  }

  /**
   * Get all active signs
   */
  function getAllSigns() {
    return Array.from(activeSigns.values());
  }

  /**
   * Clear all signs
   */
  function clearAll() {
    activeSigns.forEach(sign => {
      if (sign.element && sign.element.parentNode) {
        sign.element.parentNode.removeChild(sign.element);
      }
    });
    activeSigns.clear();
  }

  /**
   * Attach a sign to a target game object
   */
  function attachToObject(id, parentObject, offset = [0, 0.2, 0], normal = null, up = null) {
    const sign = activeSigns.get(id);
    if (!sign) return false;
    sign.parent = parentObject;
    sign.offset = offset;
    if (normal) sign.normal = normalizeVec3(normal);
    if (up) sign.up = normalizeVec3(up);
    return true;
  }

  /**
   * Detach a sign from its parent object
   */
  function detachFromObject(id) {
    const sign = activeSigns.get(id);
    if (!sign) return false;
    if (sign.parent && sign.parent.position) {
      sign.position = [
        sign.parent.position[0] + (sign.offset[0] || 0),
        sign.parent.position[1] + (sign.offset[1] || 0),
        sign.parent.position[2] + (sign.offset[2] || 0)
      ];
    }
    sign.parent = null;
    return true;
  }

  /**
   * Compute actual world position of a sign (including parent object translation/rotation if present)
   */
  function getSignWorldTransform(sign) {
    let pos = [sign.position[0], sign.position[1], sign.position[2]];
    let norm = [sign.normal[0], sign.normal[1], sign.normal[2]];
    let up = [sign.up[0], sign.up[1], sign.up[2]];

    if (sign.parent) {
      const pPos = sign.parent.position || [0, 0, 0];
      const pRot = sign.parent.rotation || [0, 0, 0]; // pitch, yaw, roll

      // If parent has position, add offset
      if (sign.offset && (sign.offset[0] || sign.offset[1] || sign.offset[2])) {
        // Simple spherical/world offset or parent orientation offset
        pos = [
          pPos[0] + sign.offset[0],
          pPos[1] + sign.offset[1],
          pPos[2] + sign.offset[2]
        ];
      } else {
        pos = [pPos[0], pPos[1], pPos[2]];
      }

      // If parent has facing/normal orientation, align sign normal
      if (sign.parent.normal) {
        norm = [sign.parent.normal[0], sign.parent.normal[1], sign.parent.normal[2]];
      }
    }

    return { position: pos, normal: norm, up: up };
  }

  /**
   * Core Rendering & Projection loop: called every frame by renderer.js
   */
  function render(viewMatrix, projMatrix, camPos, screenWidth, screenHeight) {
    if (activeSigns.size === 0) return;
    if (!viewMatrix || !projMatrix || !camPos) return;

    const w = screenWidth || window.innerWidth;
    const h = screenHeight || window.innerHeight;

    activeSigns.forEach(sign => {
      const el = sign.element;
      if (!sign.visible) {
        el.style.display = 'none';
        return;
      }

      const { position: P, normal: N_raw, up: U_raw } = getSignWorldTransform(sign);

      // Distance check
      const dx = P[0] - camPos[0];
      const dy = P[1] - camPos[1];
      const dz = P[2] - camPos[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist > sign.maxDistance || dist < 0.01) {
        el.style.display = 'none';
        return;
      }

      // Check planet occlusion (don't show through planet)
      if (isPlanetOccluded(camPos, P)) {
        el.style.display = 'none';
        return;
      }

      // ----------------------------------------------------
      // CASE 1: SCREEN-ALIGNED BILLBOARD (rotates with camera)
      // ----------------------------------------------------
      if (sign.isScreenAligned) {
        const screenPos = projectWorldPoint(P, viewMatrix, projMatrix, w, h);
        if (!screenPos) {
          el.style.display = 'none';
          return;
        }

        // Scale by distance
        const baseScale = Math.max(0.2, Math.min(2.0, 1.2 / screenPos.depth));
        const alpha = dist > sign.fadeDistance ? Math.max(0, 1.0 - (dist - sign.fadeDistance) / (sign.maxDistance - sign.fadeDistance)) : 1.0;

        el.style.display = 'block';
        el.style.opacity = alpha.toFixed(3);
        el.style.transform = `translate(-50%, -50%) translate3d(${screenPos.x.toFixed(1)}px, ${screenPos.y.toFixed(1)}px, 0px) scale(${baseScale.toFixed(3)})`;
        return;
      }

      // ----------------------------------------------------
      // CASE 2: WORLD-ANCHORED 3D SIGN (DOES NOT ROTATE WITH SCREEN)
      // ----------------------------------------------------
      const N = normalizeVec3(N_raw);
      let U = normalizeVec3(U_raw);
      let R = crossVec3(U, N);
      if (dotVec3(R, R) < 1e-6) {
        // U and N are parallel -> pick alternative vector
        U = Math.abs(N[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
        R = crossVec3(U, N);
      }
      R = normalizeVec3(R);
      U = normalizeVec3(crossVec3(N, R)); // re-orthogonalize U

      // Check Backface Culling (dot product of camera-to-sign vector with sign normal)
      const toCam = [camPos[0] - P[0], camPos[1] - P[1], camPos[2] - P[2]];
      const viewDotNorm = dotVec3(N, toCam);

      if (sign.backfaceCulling && !sign.doubleSided && viewDotNorm <= 0.0) {
        el.style.display = 'none';
        return;
      }

      // 3D Quad Projection using 3 sample points: Center, Right, Up
      const halfW = (sign.size[0] || 0.35) * 0.5;
      const halfH = (sign.size[1] || 0.18) * 0.5;

      const pCenter = P;
      const pRight = [P[0] + R[0] * halfW, P[1] + R[1] * halfW, P[2] + R[2] * halfW];
      const pUp = [P[0] + U[0] * halfH, P[1] + U[1] * halfH, P[2] + U[2] * halfH];

      const sCenter = projectWorldPoint(pCenter, viewMatrix, projMatrix, w, h);
      const sRight = projectWorldPoint(pRight, viewMatrix, projMatrix, w, h);
      const sUp = projectWorldPoint(pUp, viewMatrix, projMatrix, w, h);

      if (!sCenter || !sRight || !sUp) {
        el.style.display = 'none';
        return;
      }

      // 2D Screen Basis Vectors
      const rVec = [sRight.x - sCenter.x, sRight.y - sCenter.y];
      const uVec = [sUp.x - sCenter.x, sUp.y - sCenter.y];

      // Measured element unscaled dimensions (default 100px base or measured rect)
      const elWidth = el.offsetWidth || 120;
      const elHeight = el.offsetHeight || 60;

      // Affine transform matrix components:
      // a: horizontal basis X, b: horizontal basis Y
      // c: vertical basis X,   d: vertical basis Y
      const a = (rVec[0] / (elWidth * 0.5));
      const b = (rVec[1] / (elWidth * 0.5));
      const c = -(uVec[0] / (elHeight * 0.5));
      const d = -(uVec[1] / (elHeight * 0.5));

      // Opacity fade with distance
      const alpha = dist > sign.fadeDistance ? Math.max(0, 1.0 - (dist - sign.fadeDistance) / (sign.maxDistance - sign.fadeDistance)) : 1.0;

      el.style.display = 'block';
      el.style.opacity = alpha.toFixed(3);
      el.style.transform = `matrix(${a.toFixed(4)}, ${b.toFixed(4)}, ${c.toFixed(4)}, ${d.toFixed(4)}, ${sCenter.x.toFixed(1)}, ${sCenter.y.toFixed(1)}) translate(-50%, -50%)`;
    });
  }

  // Global Export
  const World3DUI = {
    createSign: createSign,
    updateSign: updateSign,
    removeSign: removeSign,
    getSign: getSign,
    getAllSigns: getAllSigns,
    attachToObject: attachToObject,
    detachFromObject: detachFromObject,
    clearAll: clearAll,
    render: render
  };

  global.World3DUI = World3DUI;
  global.createWorld3DSign = createSign;
  global.removeWorld3DSign = removeSign;
  global.updateWorld3DSign = updateSign;

})(typeof window !== 'undefined' ? window : this);
