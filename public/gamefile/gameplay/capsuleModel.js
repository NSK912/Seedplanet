// ============================================================
// capsuleModel.js - Central Procedural 3D Capsule Character Model Engine
// Shared by Player, PlayerClones, and NPC procedural entities
// ============================================================
(function() {
  'use strict';

  // --- 1. 3D Rotation Math Helpers ---
  function rotatePointX(pivot, point, theta) {
    if (theta === 0) return point;
    const dy = point[1] - pivot[1];
    const dz = point[2] - pivot[2];
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const ry = dy * cosT - dz * sinT;
    const rz = dy * sinT + dz * cosT;
    return [point[0], pivot[1] + ry, pivot[2] + rz];
  }

  function rotatePointY(pivot, point, theta) {
    if (theta === 0) return point;
    const dx = point[0] - pivot[0];
    const dz = point[2] - pivot[2];
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const rx = dx * cosT + dz * sinT;
    const rz = -dx * sinT + dz * cosT;
    return [pivot[0] + rx, point[1], pivot[2] + rz];
  }

  function rotatePointZ(pivot, point, theta) {
    if (theta === 0) return point;
    const dx = point[0] - pivot[0];
    const dy = point[1] - pivot[1];
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const rx = dx * cosT - dy * sinT;
    const ry = dx * sinT + dy * cosT;
    return [pivot[0] + rx, pivot[1] + ry, point[2]];
  }

  // --- 2. High-Performance Capsule Buffer Pools & Index Cache ---
  const _capsuleIndexCache = {};

  function getCapsuleIndices(radialSegments, axialSegments) {
    const key = radialSegments + "_" + axialSegments;
    if (_capsuleIndexCache[key]) return _capsuleIndexCache[key];
    const indices = new Uint16Array(axialSegments * radialSegments * 6);
    let ptr = 0;
    for (let i = 0; i < axialSegments; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const row1 = i * (radialSegments + 1);
        const row2 = (i + 1) * (radialSegments + 1);

        const a = row1 + j;
        const b = row1 + j + 1;
        const c = row2 + j;
        const d = row2 + j + 1;

        indices[ptr++] = a;
        indices[ptr++] = b;
        indices[ptr++] = c;
        indices[ptr++] = c;
        indices[ptr++] = b;
        indices[ptr++] = d;
      }
    }
    _capsuleIndexCache[key] = indices;
    return indices;
  }

  const _capsuleBufferPool = [];
  let _capsulePoolIndex = 0;

  function resetCapsuleBufferPool() {
    _capsulePoolIndex = 0;
  }

  function getPooledCapsuleBuffers(totalVerts) {
    const reqLen = totalVerts * 3;
    const reqTexLen = totalVerts * 2;
    if (_capsulePoolIndex >= _capsuleBufferPool.length) {
      _capsuleBufferPool.push({
        vertices: new Float32Array(reqLen),
        normals: new Float32Array(reqLen),
        colors: new Float32Array(reqLen),
        texcoords: new Float32Array(reqTexLen),
      });
    }
    const item = _capsuleBufferPool[_capsulePoolIndex++];
    if (item.vertices.length < reqLen) {
      item.vertices = new Float32Array(reqLen);
      item.normals = new Float32Array(reqLen);
      item.colors = new Float32Array(reqLen);
    }
    if (!item.texcoords || item.texcoords.length < reqTexLen) {
      item.texcoords = new Float32Array(reqTexLen);
    }
    return item;
  }

  // --- 3. Core Procedural Capsule Generator ---
  function generateCapsule(
    p1,
    p2,
    r,
    radialSegments = 16,
    axialSegments = 24
  ) {
    const totalSlices = axialSegments;
    const totalVerts = (totalSlices + 1) * (radialSegments + 1);
    const pooled = getPooledCapsuleBuffers(totalVerts);
    const vertices = pooled.vertices.subarray(0, totalVerts * 3);
    const normals = pooled.normals.subarray(0, totalVerts * 3);

    const dX = p2[0] - p1[0];
    const dY = p2[1] - p1[1];
    const dZ = p2[2] - p1[2];
    const L = Math.sqrt(dX * dX + dY * dY + dZ * dZ);

    let zAxis = [0, 1, 0];
    if (L > 0.00001) {
      zAxis = [dX / L, dY / L, dZ / L];
    }

    let up = [0, 1, 0];
    if (Math.abs(zAxis[1]) > 0.99) {
      up = [1, 0, 0];
    }

    let xAxis = [
      up[1] * zAxis[2] - up[2] * zAxis[1],
      up[2] * zAxis[0] - up[0] * zAxis[2],
      up[0] * zAxis[1] - up[1] * zAxis[0],
    ];
    let lenX = Math.sqrt(
      xAxis[0] * xAxis[0] + xAxis[1] * xAxis[1] + xAxis[2] * xAxis[2]
    );
    xAxis = [xAxis[0] / lenX, xAxis[1] / lenX, xAxis[2] / lenX];

    let yAxis = [
      zAxis[1] * xAxis[2] - zAxis[2] * xAxis[1],
      zAxis[2] * xAxis[0] - zAxis[0] * xAxis[2],
      zAxis[0] * xAxis[1] - zAxis[1] * xAxis[0],
    ];

    let vIdx = 0;
    for (let i = 0; i <= totalSlices; i++) {
      const angle = -Math.PI / 2 + Math.PI * (i / totalSlices);
      const sinA = Math.sin(angle);
      const cosA = Math.cos(angle);

      let zPos = 0;
      let ringRadius = r * cosA;

      if (sinA < 0) {
        zPos = sinA * r;
      } else {
        zPos = L + sinA * r;
      }

      for (let j = 0; j <= radialSegments; j++) {
        const phi = (j / radialSegments) * Math.PI * 2;
        const cosP = Math.cos(phi);
        const sinP = Math.sin(phi);

        const ringX = xAxis[0] * cosP + yAxis[0] * sinP;
        const ringY = xAxis[1] * cosP + yAxis[1] * sinP;
        const ringZ = xAxis[2] * cosP + yAxis[2] * sinP;

        vertices[vIdx] = p1[0] + zAxis[0] * zPos + ringX * ringRadius;
        vertices[vIdx + 1] = p1[1] + zAxis[1] * zPos + ringY * ringRadius;
        vertices[vIdx + 2] = p1[2] + zAxis[2] * zPos + ringZ * ringRadius;

        normals[vIdx] = ringX * cosA + zAxis[0] * sinA;
        normals[vIdx + 1] = ringY * cosA + zAxis[1] * sinA;
        normals[vIdx + 2] = ringZ * cosA + zAxis[2] * sinA;

        vIdx += 3;
      }
    }

    const indices = getCapsuleIndices(radialSegments, axialSegments);
    return { vertices, normals, indices };
  }

  // --- 4. High-Performance Mesh Merger Pool ---
  const _mergeBufferPool = [];
  let _mergePoolIndex = 0;

  function resetMergeBufferPool() {
    _mergePoolIndex = 0;
  }

  function getPooledMergeBuffers(totalVerts, totalIndices) {
    const vLen = totalVerts * 3;
    const tLen = totalVerts * 2;
    const iLen = totalIndices;
    if (_mergePoolIndex >= _mergeBufferPool.length) {
      _mergeBufferPool.push({
        vertices: new Float32Array(Math.max(vLen, 1024)),
        normals: new Float32Array(Math.max(vLen, 1024)),
        colors: new Float32Array(Math.max(vLen, 1024)),
        texcoords: new Float32Array(Math.max(tLen, 1024)),
        indices16: new Uint16Array(Math.max(iLen, 1024)),
        indices32: new Uint32Array(Math.max(iLen, 1024)),
      });
    }
    const item = _mergeBufferPool[_mergePoolIndex++];
    if (item.vertices.length < vLen) {
      item.vertices = new Float32Array(vLen);
      item.normals = new Float32Array(vLen);
      item.colors = new Float32Array(vLen);
    }
    if (item.texcoords.length < tLen) {
      item.texcoords = new Float32Array(tLen);
    }
    if (item.indices16.length < iLen) {
      item.indices16 = new Uint16Array(iLen);
      item.indices32 = new Uint32Array(iLen);
    }
    return item;
  }

  const _EMPTY_SKIN_MESH = Object.freeze({
    vertices: new Float32Array(0),
    normals: new Float32Array(0),
    colors: new Float32Array(0),
    indices: new Uint16Array(0),
  });

  function mergeMeshes(meshes, verticesOnly = false) {
    let totalVerts = 0;
    let totalIndices = 0;
    for (let k = 0; k < meshes.length; k++) {
      const m = meshes[k];
      if (!m || !m.vertices || m.vertices.length === 0) continue;
      totalVerts += (m.vertices.length / 3) | 0;
      if (!verticesOnly && m.indices) totalIndices += m.indices.length;
    }

    const pool = getPooledMergeBuffers(totalVerts, totalIndices);
    const combinedVertices = pool.vertices.subarray(0, totalVerts * 3);

    if (verticesOnly) {
      let vOffset = 0;
      for (let k = 0; k < meshes.length; k++) {
        const mesh = meshes[k];
        if (!mesh || !mesh.vertices || mesh.vertices.length === 0) continue;
        const mv = mesh.vertices;
        if (mv instanceof Float32Array) {
          combinedVertices.set(mv, vOffset);
        } else {
          for (let i = 0; i < mv.length; i++) combinedVertices[vOffset + i] = mv[i];
        }
        vOffset += mv.length;
      }
      return { vertices: combinedVertices };
    }

    const combinedNormals = pool.normals.subarray(0, totalVerts * 3);
    const combinedColors = pool.colors.subarray(0, totalVerts * 3);
    const combinedTexCoords = pool.texcoords.subarray(0, totalVerts * 2);
    const combinedIndices = totalVerts > 65535 ? pool.indices32.subarray(0, totalIndices) : pool.indices16.subarray(0, totalIndices);

    let vertexOffset = 0;
    let vOffset = 0;
    let cOffset = 0;
    let tOffset = 0;
    let iOffset = 0;

    for (let k = 0; k < meshes.length; k++) {
      const mesh = meshes[k];
      if (!mesh || !mesh.vertices || mesh.vertices.length === 0) continue;
      const mv = mesh.vertices;
      const mn = mesh.normals;
      const mc = mesh.colors;
      const mt = mesh.texcoords;
      const mi = mesh.indices;
      const vertCount = (mv.length / 3) | 0;

      if (mv instanceof Float32Array) {
        combinedVertices.set(mv, vOffset);
      } else {
        for (let i = 0; i < mv.length; i++) combinedVertices[vOffset + i] = mv[i];
      }

      if (mn instanceof Float32Array) {
        combinedNormals.set(mn, vOffset);
      } else {
        for (let i = 0; i < mn.length; i++) combinedNormals[vOffset + i] = mn[i];
      }

      if (mt && mt.length >= vertCount * 2) {
        if (mt instanceof Float32Array) {
          combinedTexCoords.set(mt.subarray(0, vertCount * 2), tOffset);
        } else {
          for (let i = 0; i < vertCount * 2; i++) combinedTexCoords[tOffset + i] = mt[i];
        }
      } else {
        combinedTexCoords.fill(-1.0, tOffset, tOffset + vertCount * 2);
      }

      if (mc && mc.length >= vertCount * 3) {
        if (mc instanceof Float32Array) {
          combinedColors.set(mc.subarray(0, vertCount * 3), cOffset);
        } else {
          for (let i = 0; i < vertCount * 3; i++) combinedColors[cOffset + i] = mc[i];
        }
      } else {
        for (let i = 0; i < vertCount; i++) {
          const base = cOffset + i * 3;
          combinedColors[base] = 0.99;
          combinedColors[base + 1] = 0.885;
          combinedColors[base + 2] = 0.825;
        }
      }

      if (mi) {
        for (let i = 0; i < mi.length; i++) {
          combinedIndices[iOffset++] = mi[i] + vertexOffset;
        }
      }

      vOffset += mv.length;
      cOffset += vertCount * 3;
      tOffset += vertCount * 2;
      vertexOffset += vertCount;
    }

    return {
      vertices: combinedVertices,
      normals: combinedNormals,
      colors: combinedColors,
      texcoords: combinedTexCoords,
      indices: combinedIndices,
    };
  }

  // --- 4B. Sculpted Organic Chibi Capsule & Limb Generator (with Local-Space Template Cache) ---
  const _sculptedTemplateCache = {};

  function generateSculptedCapsule(
    p1,
    p2,
    radialSegments = 16,
    axialSegments = 16,
    profileFn,
    skinGroup = 0,
    cacheKey = null,
    boneBasis = null
  ) {
    const totalSlices = axialSegments;
    const totalVerts = (totalSlices + 1) * (radialSegments + 1);
    const pooled = getPooledCapsuleBuffers(totalVerts);
    const vertices = pooled.vertices.subarray(0, totalVerts * 3);
    const normals = pooled.normals.subarray(0, totalVerts * 3);

    const dX = p2[0] - p1[0];
    const dY = p2[1] - p1[1];
    const dZ = p2[2] - p1[2];
    const L = Math.sqrt(dX * dX + dY * dY + dZ * dZ);

    let zAxis = [0, 1, 0];
    if (L > 0.00001) {
      zAxis = [dX / L, dY / L, dZ / L];
    }

    let xAxis, yAxis;
    let latSign = 1.0;
    if (boneBasis && boneBasis.xAxis && boneBasis.yAxis) {
      // Standard Rig Bone Basis override: orthogonalize xAxis against zAxis so capsule roll/twist follows bone rotation 1:1
      const bx = boneBasis.xAxis;
      const dotXZ = bx[0] * zAxis[0] + bx[1] * zAxis[1] + bx[2] * zAxis[2];
      let ox = bx[0] - zAxis[0] * dotXZ;
      let oy = bx[1] - zAxis[1] * dotXZ;
      let oz = bx[2] - zAxis[2] * dotXZ;
      let oLen = Math.hypot(ox, oy, oz);
      if (oLen > 1e-4) {
        xAxis = [ox / oLen, oy / oLen, oz / oLen];
      } else {
        xAxis = [0, 0, 1];
      }
      yAxis = [
        zAxis[1] * xAxis[2] - zAxis[2] * xAxis[1],
        zAxis[2] * xAxis[0] - zAxis[0] * xAxis[2],
        zAxis[0] * xAxis[1] - zAxis[1] * xAxis[0],
      ];
      const yLen = Math.hypot(yAxis[0], yAxis[1], yAxis[2]) || 1.0;
      yAxis = [yAxis[0] / yLen, yAxis[1] / yLen, yAxis[2] / yLen];
      latSign = typeof boneBasis.latSign === "number" ? boneBasis.latSign : (yAxis[0] >= 0 ? 1.0 : -1.0);
    } else if (Math.abs(zAxis[1]) > 0.95) {
      if (zAxis[1] > 0) {
        xAxis = [0, 0, 1];
        yAxis = [1, 0, 0];
        latSign = 1.0;
      } else {
        xAxis = [0, 0, 1];
        yAxis = [-1, 0, 0];
        latSign = -1.0;
      }
    } else {
      let fZ = 1.0 - zAxis[2] * zAxis[2];
      let fX = -zAxis[0] * zAxis[2];
      let fY = -zAxis[1] * zAxis[2];
      let lenF = Math.hypot(fX, fY, fZ);
      if (lenF > 0.001) {
        xAxis = [fX / lenF, fY / lenF, fZ / lenF];
      } else {
        xAxis = [0, 0, 1];
      }
      if (xAxis[2] < 0) {
        xAxis = [-xAxis[0], -xAxis[1], -xAxis[2]];
      }
      yAxis = [
        zAxis[1] * xAxis[2] - zAxis[2] * xAxis[1],
        zAxis[2] * xAxis[0] - zAxis[0] * xAxis[2],
        zAxis[0] * xAxis[1] - zAxis[1] * xAxis[0],
      ];
      let lenY = Math.hypot(yAxis[0], yAxis[1], yAxis[2]);
      if (lenY > 0.001) {
        yAxis = [yAxis[0] / lenY, yAxis[1] / lenY, yAxis[2] / lenY];
      } else {
        yAxis = [1, 0, 0];
      }
      latSign = yAxis[0] >= 0 ? 1.0 : -1.0;
    }

    const indices = getCapsuleIndices(radialSegments, axialSegments);
    const fullKey = cacheKey ? (cacheKey + "_" + (latSign > 0 ? "P" : "N") + "_" + Math.round(L * 1000)) : null;

    if (fullKey && _sculptedTemplateCache[fullKey]) {
      const tpl = _sculptedTemplateCache[fullKey];
      const lCoords = tpl.localCoords;
      const lNorms = tpl.localNormals;
      const p1x = p1[0], p1y = p1[1], p1z = p1[2];
      const zx = zAxis[0], zy = zAxis[1], zz = zAxis[2];
      const xx = xAxis[0], xy = xAxis[1], xz = xAxis[2];
      const yx = yAxis[0], yy = yAxis[1], yz = yAxis[2];
      const len3 = totalVerts * 3;
      for (let k = 0; k < len3; k += 3) {
        const zP = lCoords[k];
        const lA = lCoords[k + 1];
        const lL = lCoords[k + 2];
        vertices[k]     = p1x + zx * zP + xx * lA + yx * lL;
        vertices[k + 1] = p1y + zy * zP + xy * lA + yy * lL;
        vertices[k + 2] = p1z + zz * zP + xz * lA + yz * lL;

        const nZ = lNorms[k];
        const nA = lNorms[k + 1];
        const nL = lNorms[k + 2];
        normals[k]     = zx * nZ + xx * nA + yx * nL;
        normals[k + 1] = zy * nZ + xy * nA + yy * nL;
        normals[k + 2] = zz * nZ + xz * nA + yz * nL;
      }
      return { vertices, normals, colors: tpl.colors, indices, skinGroup };
    }

    const colors = fullKey ? new Float32Array(totalVerts * 3) : pooled.colors.subarray(0, totalVerts * 3);
    const localCoords = fullKey ? new Float32Array(totalVerts * 3) : null;

    let vIdx = 0;
    for (let i = 0; i <= totalSlices; i++) {
      const u = i / totalSlices;
      const angle = -Math.PI / 2 + Math.PI * u;
      const sinA = Math.sin(angle);
      const cosA = Math.cos(angle);

      for (let j = 0; j <= radialSegments; j++) {
        const phi = (j === radialSegments ? 0 : (j / radialSegments) * Math.PI * 2);
        const cosP = Math.cos(phi);
        const sinP = Math.sin(phi);

        const ant = cosP;
        const lat = sinP * latSign;

        const prof = profileFn(u, angle, sinA, cosA, lat, ant, L);
        const zPos = prof.zPos;
        const rx = prof.rx;
        const ry = prof.ry !== undefined ? prof.ry : prof.rx;
        const cx = (prof.cx || 0.0);
        const cy = (prof.cy || 0.0);
        const shade = prof.shade !== undefined ? prof.shade : 0.96;

        const localAnt = cy + cosP * ry;
        const localLat = cx * latSign + sinP * rx;

        if (localCoords) {
          localCoords[vIdx] = zPos;
          localCoords[vIdx + 1] = localAnt;
          localCoords[vIdx + 2] = localLat;
        }

        vertices[vIdx]     = p1[0] + zAxis[0] * zPos + xAxis[0] * localAnt + yAxis[0] * localLat;
        vertices[vIdx + 1] = p1[1] + zAxis[1] * zPos + xAxis[1] * localAnt + yAxis[1] * localLat;
        vertices[vIdx + 2] = p1[2] + zAxis[2] * zPos + xAxis[2] * localAnt + yAxis[2] * localLat;

        const aoDepth = Math.max(0.0, 0.97 - shade);
        const skinR = Math.min(1.0, shade * 1.025 + aoDepth * 0.12);
        const skinG = Math.min(1.0, shade * 0.910 - aoDepth * 0.08);
        const skinB = Math.min(1.0, shade * 0.845 - aoDepth * 0.14);

        if (prof.clothMix && prof.clothMix > 0.0001 && prof.clothRGB) {
          const cm = Math.max(0.0, Math.min(1.0, prof.clothMix));
          colors[vIdx]     = skinR * (1.0 - cm) + prof.clothRGB[0] * cm;
          colors[vIdx + 1] = skinG * (1.0 - cm) + prof.clothRGB[1] * cm;
          colors[vIdx + 2] = skinB * (1.0 - cm) + prof.clothRGB[2] * cm;
        } else {
          colors[vIdx]     = skinR;
          colors[vIdx + 1] = skinG;
          colors[vIdx + 2] = skinB;
        }

        normals[vIdx] = 0.0;
        normals[vIdx + 1] = 0.0;
        normals[vIdx + 2] = 0.0;

        vIdx += 3;
      }
    }

    for (let k = 0; k < indices.length; k += 3) {
      const i0 = indices[k] * 3;
      const i1 = indices[k + 1] * 3;
      const i2 = indices[k + 2] * 3;

      const ux = vertices[i1] - vertices[i0];
      const uy = vertices[i1 + 1] - vertices[i0 + 1];
      const uz = vertices[i1 + 2] - vertices[i0 + 2];

      const vx = vertices[i2] - vertices[i0];
      const vy = vertices[i2 + 1] - vertices[i0 + 1];
      const vz = vertices[i2 + 2] - vertices[i0 + 2];

      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;

      normals[i0] += nx; normals[i0 + 1] += ny; normals[i0 + 2] += nz;
      normals[i1] += nx; normals[i1 + 1] += ny; normals[i1 + 2] += nz;
      normals[i2] += nx; normals[i2 + 1] += ny; normals[i2 + 2] += nz;
    }

    const stride = radialSegments + 1;
    for (let i = 0; i <= totalSlices; i++) {
      const uSlice = i / totalSlices;
      const capDist = uSlice < 0.22 ? (uSlice / 0.22) : (uSlice > 0.78 ? ((1.0 - uSlice) / 0.22) : 1.0);
      const axialKeep = 0.06 + 0.94 * (capDist * capDist * (3.0 - 2.0 * capDist));

      for (let j = 0; j <= radialSegments; j++) {
        const idx = (i * stride + j) * 3;
        const dotZ = normals[idx] * zAxis[0] + normals[idx + 1] * zAxis[1] + normals[idx + 2] * zAxis[2];
        const removeZ = dotZ * (1.0 - axialKeep);
        normals[idx]     -= zAxis[0] * removeZ;
        normals[idx + 1] -= zAxis[1] * removeZ;
        normals[idx + 2] -= zAxis[2] * removeZ;
      }

      const base0 = (i * stride) * 3;
      const baseN = (i * stride + radialSegments) * 3;
      const sx = normals[base0] + normals[baseN];
      const sy = normals[base0 + 1] + normals[baseN + 1];
      const sz = normals[base0 + 2] + normals[baseN + 2];
      normals[base0] = normals[baseN] = sx;
      normals[base0 + 1] = normals[baseN + 1] = sy;
      normals[base0 + 2] = normals[baseN + 2] = sz;
    }

    for (let k = 0; k < totalVerts * 3; k += 3) {
      const nl = Math.sqrt(normals[k] * normals[k] + normals[k + 1] * normals[k + 1] + normals[k + 2] * normals[k + 2]);
      if (nl > 1e-6) {
        normals[k] /= nl;
        normals[k + 1] /= nl;
        normals[k + 2] /= nl;
      } else {
        normals[k + 1] = 1.0;
      }
    }

    if (fullKey) {
      const localNormals = new Float32Array(totalVerts * 3);
      for (let k = 0; k < totalVerts * 3; k += 3) {
        const nx = normals[k], ny = normals[k + 1], nz = normals[k + 2];
        localNormals[k]     = nx * zAxis[0] + ny * zAxis[1] + nz * zAxis[2];
        localNormals[k + 1] = nx * xAxis[0] + ny * xAxis[1] + nz * xAxis[2];
        localNormals[k + 2] = nx * yAxis[0] + ny * yAxis[1] + nz * yAxis[2];
      }
      _sculptedTemplateCache[fullKey] = {
        localCoords,
        localNormals,
        colors,
      };
    }

    return { vertices, normals, colors, indices, skinGroup };
  }

  // Helper for seamless multi-slice limb & joint shaft lofting:
  // Eliminates the old sinA < 0 -> L + sinA jump at u = 0.5 and eliminates cosA sausage-pinching along the limb!
  function loftSeamlessJointShaft(u, L, rStart, rEnd) {
    const capFrac = 0.14;
    if (u < capFrac) {
      const t = u / capFrac; // 0 (pole) -> 1 (joint center zPos = 0)
      const ang = (1.0 - t) * Math.PI * 0.5;
      const zPos = -Math.sin(ang) * rStart * 0.42;
      const capEnv = Math.max(0.08, Math.pow(Math.cos(ang), 0.52));
      return { zPos, h: 0.0, capEnv };
    } else if (u > 1.0 - capFrac) {
      const t = (u - (1.0 - capFrac)) / capFrac; // 0 (joint center zPos = L) -> 1 (pole)
      const ang = t * Math.PI * 0.5;
      const zPos = L + Math.sin(ang) * rEnd * 0.42;
      const capEnv = Math.max(0.08, Math.pow(Math.cos(ang), 0.52));
      return { zPos, h: 1.0, capEnv };
    } else {
      const h = (u - capFrac) / (1.0 - 2.0 * capFrac); // 0 -> 1 smoothly across the entire shaft!
      return { zPos: h * L, h, capEnv: 1.0 };
    }
  }

  // 1. Dedicated 3D Anime Chibi Head Generator
  // Replaces the revolved UV sphere capsule with true Anime Chibi morphology:
  // - Counter-clockwise (CCW) standard winding: outward-facing normals, zero culling artifacts
  // - Monotonically increasing vertical profile from under-jaw (-0.155) to cranium (+0.240) with zero fold
  // - Upper Cranium Dome (R = 0.24) ensuring exact 3D hair root placement & zero bald spots
  // - Softly flattened forehead & wide anime eye-plane (eliminating alien cone distortion)
  // - Adorable puffed Mochi Cheeks expanding laterally in the lower mid-face
  // - Tapered V-line jaw angling forward into a cute, forward-projecting chin apex
  // - Horizontal under-jaw (submandibular) plane sealing smoothly into the neck collar
  const _headTemplateCache = {};

  function generateChibiHead(headP1, headP2, baseR, scaleFactor = 1.0, headBasis = null) {
    const sf = scaleFactor;
    const r = (baseR / sf <= 0.200) ? (baseR / sf) : ((baseR / sf) * (0.192 / 0.240));
    const numRings = 24;
    const numSlices = 24;
    const totalVerts = (numRings + 1) * (numSlices + 1);

    const pooled = getPooledCapsuleBuffers(totalVerts);
    const vertices = pooled.vertices.subarray(0, totalVerts * 3);
    const normals = pooled.normals.subarray(0, totalVerts * 3);

    const hx = (headP1[0] + headP2[0]) * 0.5;
    const hy = (headP1[1] + headP2[1]) * 0.5;
    const hz = (headP1[2] + headP2[2]) * 0.5;

    const dx = headP2[0] - headP1[0];
    const dy = headP2[1] - headP1[1];
    const dz = headP2[2] - headP1[2];
    const L = Math.hypot(dx, dy, dz);

    let upAxis = [0, 1, 0];
    let frontAxis = [0, 0, 1];
    let rightAxis = [1, 0, 0];

    if (headBasis && headBasis.upAxis && headBasis.frontAxis && headBasis.rightAxis) {
      upAxis = headBasis.upAxis;
      frontAxis = headBasis.frontAxis;
      rightAxis = headBasis.rightAxis;
    } else if (L > 0.0001) {
      upAxis = [dx / L, dy / L, dz / L];
      const dot = frontAxis[0] * upAxis[0] + frontAxis[1] * upAxis[1] + frontAxis[2] * upAxis[2];
      frontAxis = [frontAxis[0] - upAxis[0] * dot, frontAxis[1] - upAxis[1] * dot, frontAxis[2] - upAxis[2] * dot];
      const fLen = Math.hypot(frontAxis[0], frontAxis[1], frontAxis[2]);
      if (fLen > 0.0001) {
        frontAxis = [frontAxis[0] / fLen, frontAxis[1] / fLen, frontAxis[2] / fLen];
      } else {
        frontAxis = [0, 0, 1];
      }
      rightAxis = [
        upAxis[1] * frontAxis[2] - upAxis[2] * frontAxis[1],
        upAxis[2] * frontAxis[0] - upAxis[0] * frontAxis[2],
        upAxis[0] * frontAxis[1] - upAxis[1] * frontAxis[0],
      ];
    }

    const indices = getCapsuleIndices(numSlices, numRings);
    const hKey = Math.round(r * 10000) + "_" + Math.round(sf * 1000);
    if (_headTemplateCache[hKey]) {
      const tpl = _headTemplateCache[hKey];
      const lCoords = tpl.localCoords;
      const lNorms = tpl.localNormals;
      const rx0 = rightAxis[0] * sf, rx1 = rightAxis[1] * sf, rx2 = rightAxis[2] * sf;
      const ux0 = upAxis[0] * sf,    ux1 = upAxis[1] * sf,    ux2 = upAxis[2] * sf;
      const fx0 = frontAxis[0] * sf, fx1 = frontAxis[1] * sf, fx2 = frontAxis[2] * sf;
      const nr0 = rightAxis[0], nr1 = rightAxis[1], nr2 = rightAxis[2];
      const nu0 = upAxis[0],    nu1 = upAxis[1],    nu2 = upAxis[2];
      const nf0 = frontAxis[0], nf1 = frontAxis[1], nf2 = frontAxis[2];
      const len3 = totalVerts * 3;
      for (let k = 0; k < len3; k += 3) {
        const lx = lCoords[k];
        const ly = lCoords[k + 1];
        const lz = lCoords[k + 2];
        vertices[k]     = hx + rx0 * lx + ux0 * ly + fx0 * lz;
        vertices[k + 1] = hy + rx1 * lx + ux1 * ly + fx1 * lz;
        vertices[k + 2] = hz + rx2 * lx + ux2 * ly + fx2 * lz;

        const nlx = lNorms[k];
        const nly = lNorms[k + 1];
        const nlz = lNorms[k + 2];
        normals[k]     = nr0 * nlx + nu0 * nly + nf0 * nlz;
        normals[k + 1] = nr1 * nlx + nu1 * nly + nf1 * nlz;
        normals[k + 2] = nr2 * nlx + nu2 * nly + nf2 * nlz;
      }
      return { vertices, normals, colors: tpl.colors, texcoords: tpl.texcoords, indices, skinGroup: 2 };
    }

    const colors = new Float32Array(totalVerts * 3);
    const texcoords = new Float32Array(totalVerts * 2);
    const localCoords = new Float32Array(totalVerts * 3);

    let vIdx = 0;
    let tIdx = 0;
    // Iterate from bottom (u = 0, latAngle = -PI/2) to top crown (u = 1, latAngle = +PI/2)
    // to strictly match CCW triangle winding and positive outward surface normals
    for (let i = 0; i <= numRings; i++) {
      const u = i / numRings;
      const latAngle = -Math.PI * 0.5 + Math.PI * u;
      const sinLat = Math.sin(latAngle);
      const cosLat = Math.cos(latAngle);

      for (let j = 0; j <= numSlices; j++) {
        const phi = (j === numSlices ? 0 : (j / numSlices) * Math.PI * 2);
        const cosP = Math.cos(phi); // +1 = Front (+Z), -1 = Back (-Z)
        const sinP = Math.sin(phi); // +1 = Right (+X), -1 = Left (-X)

        const isFront = Math.max(0.0, cosP);
        const isSide = Math.abs(sinP);
        const frontMask = Math.max(0.0, (cosP + 0.12) / 1.12);
        const centerFront = Math.pow(isFront, 1.35) * (1.0 - isSide * 0.62);

        // Broad U-Jaw Plateau Mask: stays ~1.0 across the entire front and lower cheek corners (cosP > -0.22)
        // so the left/right lower cheeks never lift upward into a pointed V-shape!
        const rawUFront = Math.max(0.0, (cosP + 0.22) / 1.22);
        const uJawPlateau = 1.0 - Math.pow(1.0 - rawUFront, 2.8);

        // Broad U-Chin Front Span (for Z depth): stays flat across |sinP| <= 0.48 (|X|/W <= 0.45) like chibi white.glb
        // (where GLB chin Z is 0.2290 at |X|=0.03, 0.2289 at |X|=0.06, 0.2257 at |X|=0.09)
        const uChinFront = Math.pow(isFront, 0.72) * (1.0 - Math.pow(isSide, 2.8) * 0.58);

        // 1. Vertical Profile (ly) — Upright Chibi Head with U-Shaped Chin Contour (matching chibi white.glb):
        // - Upper skull (sinLat >= 0): +0.94 * r
        // - Lower face (0 down to -0.74): descends to a flat-bottomed U-curve across |X|/W = 0.00..0.45 (rise/W <= 0.01)
        //   by gently flattening the center tip (centerChinFlatten) and holding uJawPlateau level across the lower cheeks!
        // - Under-jaw shelf (-0.74 down to -1.0): tucks horizontally back into the neck (-0.84 * r)
        let ly;
        if (sinLat >= 0.0) {
          ly = sinLat * (r * 0.94);
        } else {
          let backLy;
          if (sinLat >= -0.74) {
            backLy = sinLat * (r * 0.80);
          } else {
            const tNape = (-sinLat - 0.74) / 0.26;
            backLy = -r * (0.592 + 0.248 * Math.sin(tNape * Math.PI * 0.5));
          }

          let frontLy;
          if (sinLat >= -0.74) {
            const tFace = -sinLat / 0.74;
            // Flatten the center chin tip slightly so the bottom contour is a broad U instead of a pointed V:
            const centerChinFlatten = Math.pow(isFront, 2.0) * (1.0 - isSide * 0.85) * Math.pow(tFace, 2.2) * 0.038;
            frontLy = -r * (0.81 * tFace - centerChinFlatten);
          } else {
            const tUnder = (-sinLat - 0.74) / 0.26;
            frontLy = -r * (0.81 + 0.03 * Math.pow(tUnder, 1.1));
          }

          ly = frontLy * uJawPlateau + backLy * (1.0 - uJawPlateau);
        }

        // Compact 0.80 width & 0.80 depth so Height > Width = Depth
        const craniumR = r * cosLat;
        const widthRatio = 0.80;
        const depthRatio = 0.80;

        // 2. Lateral Profile (lx) — Wide U-Shaped Mochi Lower Cheeks & Rounded U-Jaw Corners:
        // In chibi white.glb, jawHalfX stays at 0.95..1.08 of cheek width from Y=1.08 down to Y=0.95 (sinLat = -0.20..-0.66),
        // then rounds smoothly across the U-bottom (Y=0.935 -> 0.910).
        const cheekBell = Math.exp(-Math.pow((sinLat - (-0.34)) / 0.22, 2));
        const cheekBulge = 0.056 * cheekBell * frontMask * (isSide * 0.75 + isFront * 0.25);

        // Compensate spherical cosLat narrowing in the lower cheeks (sinLat = -0.20 down to -0.68) to form a U-jaw instead of a V-cone:
        const uJawBell = (sinLat < -0.08 && sinLat > -0.84)
          ? Math.exp(-Math.pow((sinLat - (-0.48)) / 0.24, 2))
          : 0.0;
        const uCheekFill = 1.0 + 0.19 * uJawBell * uJawPlateau * (0.35 + 0.65 * isSide);

        // Smoothly round ONLY the lower U-corner (sinLat < -0.62) into the flat U-chin bottom
        const chinCornerT = sinLat < -0.62 ? Math.min(1.0, (-0.62 - sinLat) / 0.16) : 0.0;
        const uCornerRound = 1.0 - 0.14 * Math.pow(chinCornerT, 2.2);

        // Under-jaw convergence from chin bottom (sinLat < -0.74) into neck column
        const underJawT = sinLat < -0.74 ? Math.min(1.0, (-0.74 - sinLat) / 0.26) : 0.0;
        const throatTaper = 1.0 - Math.pow(underJawT, 1.35) * 0.44;

        // 3. Forward-Back Profile (lz) — Matching Reference Chibi Side Silhouette & Broad U-Chin Front Plane:
        const neckConvergence = sinLat < -0.68 ? Math.min(1.0, (-0.68 - sinLat) / 0.32) : 0.0;
        const craniumShiftZ = -r * 0.095 * (1.0 - neckConvergence * 0.75);

        // - Stage A: Recessed Orbital Eye Socket (sinLat ~ -0.10)
        const eyeSocketBell = Math.exp(-Math.pow((sinLat - (-0.10)) / 0.17, 2));
        const eyeSocketIndent = -r * 0.042 * eyeSocketBell * isFront * (1.0 - isSide * 0.45);

        // - Stage B: Outward-Curving Cute Chibi Nose Tip & Puffy Blush Cheek Peak (sinLat ~ -0.36, right below the eyes!)
        const nosePeakBell = Math.exp(-Math.pow((sinLat - (-0.36)) / 0.12, 2));
        const cheekForwardBell = Math.exp(-Math.pow((sinLat - (-0.38)) / 0.18, 2));
        const noseCheekOutward = r * (0.046 * nosePeakBell * centerFront + 0.038 * cheekForwardBell * uChinFront);

        // - Stage C: Broad U-Shaped Lower Jaw & Chin Plane (eliminates the central V-prow ridge!)
        //   Compensates spherical cosP falloff across |sinP| <= 0.48 so Z(x) across the chin is flat/U-shaped like chibi white.glb
        const uDepthSquaring = sinLat < -0.22 && sinLat > -0.78
          ? Math.sin(Math.min(1.0, (-sinLat - 0.22) / 0.54) * Math.PI * 0.85)
          : 0.0;
        const flatUFrontCosP = cosP + uDepthSquaring * (0.42 * sinP * sinP * Math.pow(isFront, 1.35));

        let lowerChinSupport = 0.0;
        if (sinLat < -0.36 && sinLat >= -0.74) {
          const tChin = (-sinLat - 0.36) / 0.38;
          lowerChinSupport = r * 0.048 * Math.sin(tChin * Math.PI * 0.65) * uChinFront;
        } else if (sinLat < -0.74) {
          const tUnder = Math.min(1.0, (-sinLat - 0.74) / 0.22);
          lowerChinSupport = r * 0.042 * Math.pow(1.0 - tUnder, 1.8) * uChinFront;
        }

        const upperLipDip = Math.exp(-Math.pow((sinLat - (-0.45)) / 0.045, 2));
        const mouthMoundBell = Math.exp(-Math.pow((sinLat - (-0.52)) / 0.065, 2));
        const underLipGroove = Math.exp(-Math.pow((sinLat - (-0.61)) / 0.045, 2));
        const chinTipBell = Math.exp(-Math.pow((sinLat - (-0.70)) / 0.075, 2));
        const mouthChinContour = r * (
          (-0.009 * upperLipDip + 0.020 * mouthMoundBell - 0.012 * underLipGroove) * centerFront +
          (0.028 * chinTipBell) * uChinFront
        );

        const lx = craniumR * sinP * widthRatio * (1.0 + cheekBulge) * uCheekFill * uCornerRound * throatTaper;
        const lz = craniumShiftZ + craniumR * flatUFrontCosP * depthRatio * throatTaper + eyeSocketIndent + noseCheekOutward + lowerChinSupport + mouthChinContour;

        localCoords[vIdx]     = lx;
        localCoords[vIdx + 1] = ly;
        localCoords[vIdx + 2] = lz;

        // Soft ambient occlusion under the U-chin shelf (matches neck shade = 0.962 so there is zero dark ring at the neck!)
        const underChinAO = (sinLat < -0.74 && sinLat > -0.94)
          ? Math.sin(((sinLat - (-0.94)) / 0.20) * Math.PI) * 0.030 * uJawPlateau
          : 0.0;
        const lipCreaseAO = underLipGroove * centerFront * 0.018;
        const shade = 0.965 - underChinAO - lipCreaseAO;

        const worldX = hx + (rightAxis[0] * lx + upAxis[0] * ly + frontAxis[0] * lz) * sf;
        const worldY = hy + (rightAxis[1] * lx + upAxis[1] * ly + frontAxis[1] * lz) * sf;
        const worldZ = hz + (rightAxis[2] * lx + upAxis[2] * ly + frontAxis[2] * lz) * sf;

        vertices[vIdx]     = worldX;
        vertices[vIdx + 1] = worldY;
        vertices[vIdx + 2] = worldZ;

        // Warm Anime Chibi Flesh Tone (สีเนื้อพีชอมชมพูละมุน เข้ากับลำตัวและใบหู 100%)
        const aoDepth = Math.max(0.0, 0.97 - shade);
        colors[vIdx]     = Math.min(1.0, shade * 1.025 + aoDepth * 0.12);
        colors[vIdx + 1] = Math.min(1.0, shade * 0.910 - aoDepth * 0.08);
        colors[vIdx + 2] = Math.min(1.0, shade * 0.845 - aoDepth * 0.14);

        normals[vIdx]     = 0.0;
        normals[vIdx + 1] = 0.0;
        normals[vIdx + 2] = 0.0;

        const horiz = cosP >= 0 ? sinP : (sinP >= 0 ? 2.0 - sinP : -2.0 - sinP);
        const uTex = 0.5 + horiz * 0.50;
        const vTex = ((0.20 - sinLat) / 0.94) + (cosP < 0 ? 5.0 : 0.0);
        texcoords[tIdx]     = uTex;
        texcoords[tIdx + 1] = vTex;

        vIdx += 3;
        tIdx += 2;
      }
    }

    for (let k = 0; k < indices.length; k += 3) {
      const i0 = indices[k] * 3;
      const i1 = indices[k + 1] * 3;
      const i2 = indices[k + 2] * 3;

      const ux = vertices[i1] - vertices[i0];
      const uy = vertices[i1 + 1] - vertices[i0 + 1];
      const uz = vertices[i1 + 2] - vertices[i0 + 2];

      const vx = vertices[i2] - vertices[i0];
      const vy = vertices[i2 + 1] - vertices[i0 + 1];
      const vz = vertices[i2 + 2] - vertices[i0 + 2];

      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;

      normals[i0] += nx; normals[i0 + 1] += ny; normals[i0 + 2] += nz;
      normals[i1] += nx; normals[i1 + 1] += ny; normals[i1 + 2] += nz;
      normals[i2] += nx; normals[i2 + 1] += ny; normals[i2 + 2] += nz;
    }

    // Weld seam normals (j = 0 and j = numSlices) and tilt bottom throat ring normals outward-horizontally
    // so the under-jaw / throat collar blends smoothly into the vertical neck column!
    const stride = numSlices + 1;
    for (let i = 0; i <= numRings; i++) {
      const uRing = i / numRings;
      if (uRing < 0.16) {
        const throatBlend = 1.0 - uRing / 0.16;
        for (let j = 0; j <= numSlices; j++) {
          const phi = (j === numSlices ? 0 : (j / numSlices) * Math.PI * 2);
          const cosP = Math.cos(phi);
          const sinP = Math.sin(phi);
          const idx = (i * stride + j) * 3;
          const horizX = rightAxis[0] * sinP + frontAxis[0] * cosP;
          const horizY = rightAxis[1] * sinP + frontAxis[1] * cosP;
          const horizZ = rightAxis[2] * sinP + frontAxis[2] * cosP;
          const nLen = Math.hypot(normals[idx], normals[idx + 1], normals[idx + 2]) || 1.0;
          normals[idx]     = normals[idx] * (1.0 - throatBlend * 0.72) + horizX * nLen * (throatBlend * 0.72);
          normals[idx + 1] = normals[idx + 1] * (1.0 - throatBlend * 0.72) + horizY * nLen * (throatBlend * 0.72);
          normals[idx + 2] = normals[idx + 2] * (1.0 - throatBlend * 0.72) + horizZ * nLen * (throatBlend * 0.72);
        }
      }
      const base0 = (i * stride) * 3;
      const baseN = (i * stride + numSlices) * 3;
      const sx = normals[base0] + normals[baseN];
      const sy = normals[base0 + 1] + normals[baseN + 1];
      const sz = normals[base0 + 2] + normals[baseN + 2];
      normals[base0] = normals[baseN] = sx;
      normals[base0 + 1] = normals[baseN + 1] = sy;
      normals[base0 + 2] = normals[baseN + 2] = sz;
    }

    // Weld top crown pole (i = numRings)
    let topNx = 0, topNy = 0, topNz = 0;
    const topRowOffset = numRings * (numSlices + 1) * 3;
    for (let j = 0; j <= numSlices; j++) {
      const idx = topRowOffset + j * 3;
      topNx += normals[idx];
      topNy += normals[idx + 1];
      topNz += normals[idx + 2];
    }
    for (let j = 0; j <= numSlices; j++) {
      const idx = topRowOffset + j * 3;
      normals[idx] = topNx;
      normals[idx + 1] = topNy;
      normals[idx + 2] = topNz;
    }

    for (let k = 0; k < totalVerts * 3; k += 3) {
      const nl = Math.hypot(normals[k], normals[k + 1], normals[k + 2]);
      if (nl > 1e-6) {
        normals[k] /= nl;
        normals[k + 1] /= nl;
        normals[k + 2] /= nl;
      } else {
        normals[k + 1] = 1.0;
      }
    }

    const localNormals = new Float32Array(totalVerts * 3);
    for (let k = 0; k < totalVerts * 3; k += 3) {
      const nx = normals[k], ny = normals[k + 1], nz = normals[k + 2];
      localNormals[k]     = nx * rightAxis[0] + ny * rightAxis[1] + nz * rightAxis[2];
      localNormals[k + 1] = nx * upAxis[0]    + ny * upAxis[1]    + nz * upAxis[2];
      localNormals[k + 2] = nx * frontAxis[0] + ny * frontAxis[1] + nz * frontAxis[2];
    }
    _headTemplateCache[hKey] = {
      localCoords,
      localNormals,
      colors,
      texcoords,
    };

    return { vertices, normals, colors, texcoords, indices, skinGroup: 2 };
  }

  // 2. Sculpted Chibi Neck:
  // Now 100% unified into generateChibiTorso (which lofts continuously from pelvis through shoulders, collarbone, and neck column into the head),
  // so generateChibiNeck returns the shared frozen empty mesh — zero allocation and zero neck-to-chest seam!
  function generateChibiNeck(neckP1, neckP2, baseR, scaleFactor = 1.0) {
    return _EMPTY_SKIN_MESH;
  }

  // 2b. Sculpted 3D Anime Chibi Ear (Flush C-cup pinna with both ends & inner root anchored deep inside the skull!)
  function generateChibiEar(earP1, earP2, isLeft = true, scaleFactor = 1.0, boneBasis = null) {
    const sf = scaleFactor;
    const side = isLeft ? -1.0 : 1.0;
    return generateSculptedCapsule(earP1, earP2, 16, 14, (u, angle, sinA, cosA, lat, ant, L) => {
      // u: 0.0 (bottom earlobe root inside head) -> 0.5 (mid C-arch pinna) -> 1.0 (upper helix root inside head)
      const outward = lat * side; // +1 = outer ear rim away from head, -1 = inner root attached inside skull

      // Smooth vertical progression along the ear axis
      const zPos = u * L;

      // Symmetric C-cup arch that starts and ends at 0 at u=0 and u=1 so both ear tips tuck smoothly INSIDE the skull!
      const earArch = Math.pow(Math.max(0.0, Math.sin(u * Math.PI)), 0.65);
      const capRound = Math.max(0.08, earArch);

      // Lateral outward C-arch offset: 0 at u=0 (inside cheek), +0.0145 at u=0.5 (protruding mid-ear), 0 at u=1 (inside temple)!
      const cx = side * (0.0145 * earArch) * sf;

      // Subtle backward tilt in mid-ear
      const cy = (-0.0040 * earArch + 0.0015 * Math.sin(u * Math.PI * 2.0)) * sf;

      // Front-to-back ear breadth (ry): rounded C-cup pinna
      const ry = (0.005 + 0.0185 * earArch) * sf;

      // Asymmetric lateral radius (rx):
      // - Inward half (outward < 0) extends deep into the skull (0.022) so there is NEVER a gap between ear and head!
      // - Outward half (outward > 0) forms a plump rounded C-rim (0.0185) that curves smoothly back into the head at top & bottom!
      const inwardReach = outward < 0.0 ? (-outward * 0.0065 * earArch) : 0.0;
      const inConchaZone = (u > 0.18 && u < 0.82) ? Math.sin(((u - 0.18) / 0.64) * Math.PI) : 0.0;
      const conchaHollow = (ant > 0.10 && outward > -0.20) ? (-0.0032 * ant * inConchaZone) : 0.0;
      const rx = (0.0035 + 0.0155 * capRound + inwardReach + conchaHollow) * sf;

      // Soft warm concha shading matching head skin tone
      const conchaAO = (ant > 0.12 && outward > -0.25) ? (0.055 * ant * inConchaZone) : 0.0;
      const shade = 0.962 - conchaAO;

      return { zPos, rx, ry, cx, cy, shade };
    }, 5, "ear_" + (isLeft ? "L" : "R") + "_" + Math.round(sf * 1000), boneBasis);
  }

  // Helper to read active character clothing equipment state from window.equipSlotsItems
  function getCharacterEquippedClothingState(isClone = false) {
    if (isClone) {
      return {
        wearTop: true,
        wearShorts: true,
        wearHoodie: true,
        wearBoots: true,
        wearShirt: false,
        wearSkirt: false,
        wearLeggings: false,
        wearSuit: false,
        wearSlacks: false,
        wearOperaCape: false,
        key: "1_1_1_1_0_0_0_0_0_0"
      };
    }
    let wearTop = false;
    let wearShorts = false;
    let wearHoodie = false;
    let wearBoots = false;
    let wearShirt = false;
    let wearSkirt = false;
    let wearLeggings = false;
    let wearSuit = false;
    let wearSlacks = false;
    let wearOperaCape = false;
    const eq = (typeof window !== "undefined" && Array.isArray(window.equipSlotsItems)) ? window.equipSlotsItems : null;
    if (eq) {
      for (let i = 0; i < eq.length; i++) {
        const it = eq[i];
        if (!it) continue;
        const nm = String(it.name || it.label || "").toUpperCase();
        if (nm === "WHITE_BODYSUIT_TOP") wearTop = true;
        else if (nm === "WHITE_BODYSUIT_SHORTS") wearShorts = true;
        else if (nm === "TRAVELER_HOODIE" || nm === "HOODIE_CLOAK") wearHoodie = true;
        else if (nm === "TRAVELER_BOOTS" || nm === "HOODIE_BOOTS") wearBoots = true;
        else if (nm === "WHITE_SHIRT_SHORT") wearShirt = true;
        else if (nm === "BLACK_PLEATED_SKIRT") wearSkirt = true;
        else if (nm === "BLACK_LEGGINGS") wearLeggings = true;
        else if (nm === "DOUBLE_BREASTED_SUIT") wearSuit = true;
        else if (nm === "BLACK_SLACKS") wearSlacks = true;
        else if (nm === "OPERA_CAPE") wearOperaCape = true;
      }
    }
    // Suit / Opera Cape and Traveler Hoodie are mutually exclusive with Traveler Hoodie
    if ((wearSuit || wearOperaCape) && wearHoodie) {
      wearHoodie = false;
    }
    // Built-in default bodysuit: worn automatically under outer clothes unless replaced by shirt/suit (top) or leggings/slacks (bottom),
    // without occupying any equipment slot or showing items in slots.
    const effectiveWearTop = !(wearShirt || wearSuit);
    const effectiveWearShorts = !(wearLeggings || wearSlacks);
    return {
      wearTop: effectiveWearTop,
      wearShorts: effectiveWearShorts,
      wearHoodie,
      wearBoots,
      wearShirt,
      wearSkirt,
      wearLeggings,
      wearSuit,
      wearSlacks,
      wearOperaCape,
      key: `${effectiveWearTop ? 1 : 0}_${effectiveWearShorts ? 1 : 0}_${wearHoodie ? 1 : 0}_${wearBoots ? 1 : 0}_${wearShirt ? 1 : 0}_${wearSkirt ? 1 : 0}_${wearLeggings ? 1 : 0}_${wearSuit ? 1 : 0}_${wearSlacks ? 1 : 0}_${wearOperaCape ? 1 : 0}`
    };
  }

  // 3. Unified Sculpted Organic Chibi Torso + Collarbone + Neck:
  // Single continuous mesh from pelvic floor (u = 0.0) -> hips (u = 0.17) -> waist (u = 0.36) -> chest (u = 0.56) ->
  // shoulders (u = 0.68) -> concave trapezius/collarbone (u = 0.78) -> vertical neck column (u = 0.78..1.00) inside the head!
  function generateChibiTorso(groinP, neckP, baseR, scaleFactor = 1.0, wearTopOverride = null, wearShortsOverride = null, wearShirtOverride = null, wearLeggingsOverride = null, boneBasis = null) {
    const sf = scaleFactor;
    const hasOverride = (wearTopOverride !== null || wearShortsOverride !== null || wearShirtOverride !== null || wearLeggingsOverride !== null);
    const eqState = hasOverride
      ? {
          wearTop: !!wearTopOverride,
          wearShorts: !!wearShortsOverride,
          wearShirt: !!wearShirtOverride,
          wearLeggings: !!wearLeggingsOverride,
          wearSkirt: false,
          wearSuit: false,
          wearSlacks: false
        }
      : getCharacterEquippedClothingState(false);
    const wearTop = eqState.wearTop;
    const wearShorts = eqState.wearShorts;
    const wearShirt = eqState.wearShirt;
    const wearLeggings = eqState.wearLeggings;
    const wearSkirt = !!eqState.wearSkirt;
    const wearSuit = !!eqState.wearSuit;
    const wearSlacks = !!eqState.wearSlacks;
    const eqSuffix = `_${wearTop ? 1 : 0}_${wearShorts ? 1 : 0}_${wearShirt ? 1 : 0}_${wearLeggings ? 1 : 0}_${wearSkirt ? 1 : 0}_${wearSuit ? 1 : 0}_${wearSlacks ? 1 : 0}`;

    return generateSculptedCapsule(groinP, neckP, 24, 28, (u, angle, sinA, cosA, lat, ant, L) => {
      // Map u in [0.00, 0.78] to the main torso body (h = 0.0 -> 1.0, zPos = 0 -> 0.96 * L),
      // and u in [0.78, 1.00] to the seamless trapezius collar & vertical neck column (zPos = 0.96 * L -> 1.18 * L inside the head)
      const neckSplit = 0.78;
      let zPos, rx, ry, cy, shade;
      let clothMix = 0.0;
      let clothRGB = null;

      if (u <= neckSplit) {
        const h = u / neckSplit; // 0.0 (groin) -> 1.0 (collarbone / shoulder top)
        zPos = h * 0.96 * L;
        if (h < 0.08) {
          const botT = (0.08 - h) / 0.08;
          zPos -= botT * botT * 0.014 * sf;
        }

        const hipBell = Math.exp(-Math.pow((h - 0.20) / 0.18, 2));
        const waistTaper = Math.exp(-Math.pow((h - 0.46) / 0.15, 2));
        const shoulderBell = Math.exp(-Math.pow((h - 0.84) / 0.13, 2));

        // Lateral width profile (rx): Wide Hips (0.105) -> Tapered Waist (0.068) -> Chest (0.082) -> Full Deltoid Shoulders (0.104)
        let rxProfile = (0.081 + 0.024 * hipBell - 0.013 * waistTaper + 0.023 * shoulderBell) * sf;

        // Smooth trapezius curve at the top of the shoulders (h = 0.88..1.00) narrowing toward the neck base (0.056)
        if (h > 0.86) {
          const collarT = (h - 0.86) / 0.14;
          const sCollar = collarT * collarT * (3.0 - 2.0 * collarT);
          rxProfile = rxProfile * (1.0 - sCollar) + (0.058 * sf) * sCollar;
        }
        if (h < 0.10) {
          const groinT = (0.10 - h) / 0.10;
          rxProfile = rxProfile * (1.0 - 0.12 * groinT);
        }

        let capFactor = 1.0;
        if (h < 0.05) {
          const t = h / 0.05;
          capFactor = Math.sqrt(Math.max(0.02, t * (2.0 - t)));
        }
        rx = rxProfile * capFactor;

        const wFront = Math.max(0.0, ant);
        const wBack = Math.max(0.0, -ant);

        // Front depth: full lower pelvis/hip socket so the top of the thighs is 100% flush with the tummy/pelvis (zero thigh bulge!)
        const frontChestPuff = Math.exp(-Math.pow((h - 0.72) / 0.16, 2)) * 0.015 * sf;
        const frontTummyPuff = Math.exp(-Math.pow((h - 0.36) / 0.18, 2)) * 0.008 * sf;
        const hipSocketFrontFill = Math.exp(-Math.pow((h - 0.14) / 0.14, 2)) * (0.006 + 0.006 * Math.abs(lat)) * sf;
        const frontDepth = (0.059 + frontChestPuff + frontTummyPuff + hipSocketFrontFill - 0.005 * waistTaper) * sf;

        // Back depth: flat upper back + lumbar curve + rounded chibi glutes
        const backUpperFlat = Math.exp(-Math.pow((h - 0.72) / 0.18, 2)) * 0.006 * sf;
        const backLumbarArch = Math.exp(-Math.pow((h - 0.46) / 0.14, 2)) * 0.007 * sf;
        const backGluteSwell = Math.exp(-Math.pow((h - 0.20) / 0.16, 2)) * (0.022 + 0.005 * Math.abs(lat)) * sf;
        const backDepth = (0.059 - backUpperFlat - backLumbarArch + backGluteSwell - 0.004 * waistTaper) * sf;

        let ryProfile = frontDepth * wFront + backDepth * wBack + (0.059 - 0.005 * waistTaper) * sf * (1.0 - wFront - wBack);
        if (h > 0.86) {
          const collarT = (h - 0.86) / 0.14;
          const sCollar = collarT * collarT * (3.0 - 2.0 * collarT);
          ryProfile = ryProfile * (1.0 - sCollar) + (0.052 * sf) * sCollar;
        }
        ry = ryProfile * capFactor;
        cy = (wFront * (frontTummyPuff * 0.28) - wBack * (backGluteSwell * 0.32 + backLumbarArch * 0.22));

        const sternumGroove = (ant > 0.45 && Math.abs(lat) < 0.18 && h > 0.42 && h < 0.76)
          ? (1.0 - Math.abs(lat) / 0.18) * 0.012
          : 0.0;
        const spineCrease = (ant < -0.25 && Math.abs(lat) < 0.16 && h > 0.34 && h < 0.84)
          ? (1.0 - Math.abs(lat) / 0.16) * 0.016
          : 0.0;
        const buttCleft = (ant < -0.30 && Math.abs(lat) < 0.14 && h > 0.06 && h < 0.26)
          ? (1.0 - Math.abs(lat) / 0.14) * 0.028
          : 0.0;
        shade = 0.962 - sternumGroove - spineCrease - buttCleft - waistTaper * 0.010;

        // =========================================================================
        // Layered Torso Clothing:
        //   1) Matte Black High-Waisted Leggings / Dark Slacks Under-layer
        //   2) Seamless White Bodysuit (wearTop / wearShorts, +0.85mm)
        //   3) Tailored White Short-Sleeve Button-Up Shirt (wearShirt, +1.45mm)
        // =========================================================================
        let legMix = 0.0;
        let legRGB = null;
        if ((wearLeggings || wearSlacks) && h <= 0.39) {
          const topCut = wearSlacks ? 0.39 : 0.35;
          legMix = Math.max(0.0, Math.min(1.0, (topCut - h) / 0.032));
          if (legMix > 0.0001) {
            const bandSeam = Math.exp(-Math.pow((h - (topCut - 0.04)) / 0.025, 2)) * 0.022;
            const legAO = Math.abs(lat) * 0.020 + (h < 0.12 ? ((0.12 - h) / 0.12) * 0.025 : 0.0) + buttCleft * 0.65;
            if (wearSlacks) {
              const sFactor = Math.max(0.58, 1.0 - legAO - bandSeam);
              legRGB = [0.238 * sFactor, 0.246 * sFactor, 0.268 * sFactor];
            } else {
              const val = Math.max(0.055, 0.138 - legAO - bandSeam);
              legRGB = [val, val * 1.02, val * 1.14];
            }
          }
        }

        let bodyMix = 0.0;
        let bodyRGB = null;
        if (wearTop || wearShorts) {
          const splitH = 0.32;
          if (wearTop && wearShorts) {
            bodyMix = 1.0;
          } else if (wearTop) {
            bodyMix = Math.max(0.0, Math.min(1.0, (h - (splitH - 0.015)) / 0.030));
          } else if (wearShorts) {
            bodyMix = Math.max(0.0, Math.min(1.0, ((splitH + 0.015) - h) / 0.030));
          }

          if (bodyMix > 0.0001) {
            // Subtle navel indentation & shadow
            const navelDist = Math.hypot((h - 0.31) / 0.035, lat / 0.09);
            const navelDimple = (ant > 0.55 && navelDist < 1.0)
              ? (1.0 - navelDist * navelDist) * Math.max(0.0, (ant - 0.55) / 0.45)
              : 0.0;
            if (navelDimple > 0.0 && !wearShirt) {
              ry -= navelDimple * 0.0012 * sf * bodyMix;
            }

            // High-leg V-hip bodysuit seam lines on the front/side pelvis
            const targetLatV = 0.22 + Math.max(0.0, Math.min(1.0, (h - 0.03) / 0.29)) * 0.68;
            const vSeamDist = Math.abs(Math.abs(lat) - targetLatV);
            const vSeamMask = (ant > -0.10 && h >= 0.03 && h <= 0.33 && vSeamDist < 0.085)
              ? (1.0 - vSeamDist / 0.085) * Math.max(0.0, Math.min(1.0, (ant + 0.10) / 0.50))
              : 0.0;

            const underBustAO = (ant > 0.25 && h > 0.54 && h < 0.68)
              ? Math.exp(-Math.pow((h - 0.60) / 0.045, 2)) * Math.max(0.0, ant - 0.25) * 0.045
              : 0.0;
            const waistSideAO = (Math.abs(lat) > 0.55 && h > 0.30 && h < 0.62)
              ? ((Math.abs(lat) - 0.55) / 0.45) * 0.032
              : 0.0;
            const groinCreaseAO = (h < 0.12)
              ? ((0.12 - h) / 0.12) * 0.045
              : 0.0;

            const totalClothAO = navelDimple * 0.095 + vSeamMask * 0.075 + underBustAO + waistSideAO + groinCreaseAO + sternumGroove * 0.8 + spineCrease * 0.8 + buttCleft * 0.85;
            bodyRGB = [
              Math.max(0.76, 0.975 - totalClothAO * 1.15),
              Math.max(0.77, 0.980 - totalClothAO * 1.10),
              Math.max(0.82, 0.995 - totalClothAO * 0.85)
            ];
          }
        }

        let shirtMix = 0.0;
        let shirtRGB = null;
        const shirtMinH = wearSuit ? 0.52 : (wearSkirt ? 0.31 : 0.23);
        if (wearShirt && h >= shirtMinH) {
          shirtMix = Math.max(0.0, Math.min(1.0, (h - shirtMinH) / 0.030));
          // When wearing the double-breasted suit over the shirt, only render the shirt inside the front V-neck lapel opening
          // so the white shirt never pokes through the suit's back, shoulders, sides, or lower waist.
          if (wearSuit) {
            const frontMask = Math.max(0.0, Math.min(1.0, (ant - 0.38) / 0.18));
            const latMask = Math.max(0.0, Math.min(1.0, (0.44 - Math.abs(lat)) / 0.10));
            shirtMix *= frontMask * latMask;
          }
          // Open tailored V-neck at upper front throat leaving bare skin visible inside the collar
          if (h > 0.83 && ant > 0.25) {
            const vWidth = 0.08 + ((h - 0.83) / 0.17) * 0.30;
            const distLat = Math.abs(lat);
            if (distLat < vWidth) {
              const vFade = Math.max(0.0, Math.min(1.0, (distLat - (vWidth - 0.05)) / 0.05));
              shirtMix *= vFade;
            }
          }
          if (shirtMix > 0.0001) {
            const underBustAO = (ant > 0.25 && h > 0.54 && h < 0.68)
              ? Math.exp(-Math.pow((h - 0.60) / 0.045, 2)) * Math.max(0.0, ant - 0.25) * 0.036
              : 0.0;
            const waistSideAO = (Math.abs(lat) > 0.55 && h > 0.25 && h < 0.60)
              ? ((Math.abs(lat) - 0.55) / 0.45) * 0.026
              : 0.0;
            const hemEdgeAO = Math.exp(-Math.pow((h - 0.25) / 0.022, 2)) * 0.035;
            const placketSeam = (ant > 0.55 && h >= 0.25 && h <= 0.86)
              ? Math.exp(-Math.pow((Math.abs(lat) - 0.085) / 0.028, 2)) * 0.055
              : 0.0;
            let buttonAO = 0.0;
            if (ant > 0.65 && Math.abs(lat) < 0.065) {
              const bHeights = [0.77, 0.63, 0.49, 0.35];
              for (let bi = 0; bi < bHeights.length; bi++) {
                const bd = Math.hypot((h - bHeights[bi]) / 0.024, lat / 0.055);
                if (bd < 1.0) {
                  buttonAO = Math.max(buttonAO, (1.0 - bd * bd) * 0.20);
                }
              }
            }
            const totalShirtAO = underBustAO + waistSideAO + hemEdgeAO + placketSeam + buttonAO + spineCrease * 0.6;
            shirtRGB = [
              Math.max(0.70, 0.980 - totalShirtAO * 1.12),
              Math.max(0.71, 0.984 - totalShirtAO * 1.08),
              Math.max(0.76, 0.994 - totalShirtAO * 0.90)
            ];
          }
        }

        // Resolve physical thickness & visible color strictly by outer layer order: Shirt > Shorts/Bodysuit > Leggings/Slacks
        if (shirtMix > 0.0001 || bodyMix > 0.0001 || legMix > 0.0001) {
          const shirtBulge = wearSuit ? 0.0 : (shirtMix * 0.00145);
          const bodyBulge = wearSuit ? 0.0 : (bodyMix * 0.00085);
          const legBulge = wearSlacks ? 0.0 : (legMix * 0.00070);
          const fabricBulge = Math.max(shirtBulge, bodyBulge, legBulge) * sf;
          rx += fabricBulge;
          ry += fabricBulge;

          if (shirtMix >= 0.999) {
            clothMix = 1.0;
            clothRGB = shirtRGB;
          } else {
            let underMix = 0.0;
            let underRGB = null;
            if (legMix > 0.0001 && bodyMix > 0.0001) {
              underMix = Math.max(legMix, bodyMix);
              underRGB = [
                legRGB[0] * (1.0 - bodyMix) + bodyRGB[0] * bodyMix,
                legRGB[1] * (1.0 - bodyMix) + bodyRGB[1] * bodyMix,
                legRGB[2] * (1.0 - bodyMix) + bodyRGB[2] * bodyMix
              ];
            } else if (bodyMix > 0.0001) {
              underMix = bodyMix;
              underRGB = bodyRGB;
            } else if (legMix > 0.0001) {
              underMix = legMix;
              underRGB = legRGB;
            }

            if (shirtMix > 0.0001 && underMix > 0.0001) {
              clothMix = Math.max(shirtMix, underMix);
              clothRGB = [
                underRGB[0] * (1.0 - shirtMix) + shirtRGB[0] * shirtMix,
                underRGB[1] * (1.0 - shirtMix) + shirtRGB[1] * shirtMix,
                underRGB[2] * (1.0 - shirtMix) + shirtRGB[2] * shirtMix
              ];
            } else if (shirtMix > 0.0001) {
              clothMix = shirtMix;
              clothRGB = shirtRGB;
            } else {
              clothMix = underMix;
              clothRGB = underRGB;
            }
          }
        }
      } else {
        // Integrated Collarbone-to-Neck Column (u = 0.78..1.00 -> tNeck = 0.0..1.0)
        // Lofts continuously from zPos = 0.96 * L (collarbone) up to zPos = 1.18 * L (inside head under-jaw)
        const tNeck = (u - neckSplit) / (1.0 - neckSplit);
        zPos = (0.96 + 0.22 * tNeck) * L;

        // Concave trapezius curve from collarbone (0.058, 0.052) into cylindrical neck (0.046, 0.044) and slight upper flare inside head
        const neckCurve = Math.pow(1.0 - tNeck, 1.7);
        const topCap = tNeck > 0.85 ? Math.sqrt(Math.max(0.04, 1.0 - Math.pow((tNeck - 0.85) / 0.15, 2))) : 1.0;
        rx = (0.046 + 0.012 * neckCurve) * sf * topCap;
        ry = (0.044 + 0.008 * neckCurve) * sf * topCap;
        cy = -0.003 * tNeck * sf;
        shade = 0.962;

        // Mock-neck / high turtleneck collar of the White Bodysuit Top (matching reference image_da2dfca4.png)
        if (wearTop && tNeck <= 0.48) {
          clothMix = Math.max(0.0, Math.min(1.0, (0.48 - tNeck) / 0.10));
          const collarRim = Math.exp(-Math.pow((tNeck - 0.40) / 0.06, 2)) * 0.0011 * sf;
          rx += (0.00085 * sf + collarRim) * clothMix;
          ry += (0.00085 * sf + collarRim) * clothMix;
          const collarSeamAO = Math.exp(-Math.pow((tNeck - 0.06) / 0.05, 2)) * 0.055;
          clothRGB = [
            0.972 - collarSeamAO * 1.15,
            0.978 - collarSeamAO * 1.10,
            0.995 - collarSeamAO * 0.85
          ];
        }
      }

      return { zPos, rx, ry, cx: 0.0, cy, shade, clothMix, clothRGB };
    }, 1, "torso_" + Math.round(sf * 1000) + eqSuffix, boneBasis);
  }

  // Backward-compatible delegator: generateChibiChest produces the unified sculpted torso
  function generateChibiChest(chestP1, chestP2, baseR, scaleFactor = 1.0, boneBasis = null) {
    return generateChibiTorso(chestP1, chestP2, baseR, scaleFactor, null, null, null, null, boneBasis);
  }

  // Backward-compatible delegator: pelvis is now integral part of generateChibiTorso, so return shared frozen empty mesh
  function generateChibiPelvis(pelvisP1, pelvisP2, baseR, scaleFactor = 1.0) {
    return _EMPTY_SKIN_MESH;
  }

  // 5. Sculpted Chibi Upper Arm (Seamless Shoulder Socket -> Continuous Shaft -> Exact Elbow Radius Match)
  function generateChibiUpperArm(pShoulder, pElbow, isLeft, scaleFactor = 1.0, wearTopOverride = null, wearShirtOverride = null, boneBasis = null) {
    const sf = scaleFactor;
    const eqState = (wearTopOverride !== null || wearShirtOverride !== null)
      ? { wearTop: !!wearTopOverride, wearShirt: !!wearShirtOverride, wearSuit: false, wearHoodie: false }
      : getCharacterEquippedClothingState(false);
    const wearOuterLongSleeve = !!(eqState.wearSuit || eqState.wearHoodie);
    // Suppress short-sleeve puff/color under long-sleeve outer coats (Suit / Traveler Hoodie) so sleeves never clip
    const wearTop = eqState.wearTop && !wearOuterLongSleeve;
    const wearShirt = eqState.wearShirt && !wearOuterLongSleeve;
    const eqSuffix = `${wearTop ? "_top1" : "_top0"}${wearShirt ? "_shrt1" : "_shrt0"}`;

    return generateSculptedCapsule(pShoulder, pElbow, 16, 14, (u, angle, sinA, cosA, lat, ant, L) => {
      const rShoulder = 0.0425 * sf;
      const rElbow = 0.0355 * sf;
      const loft = loftSeamlessJointShaft(u, L, rShoulder, rElbow);
      const h = loft.h;
      const innerSide = isLeft ? Math.max(0.0, lat) : Math.max(0.0, -lat);
      // Tuck inner shoulder socket slightly into chest so only the outer deltoid curve is visible
      const shoulderTuck = h < 0.28 ? (1.0 - h / 0.28) * innerSide * 0.0055 * sf : 0.0;
      const deltoid = Math.sin(Math.pow(1.0 - h, 1.3) * Math.PI) * 0.0032 * sf;
      const baseR = (rShoulder * (1.0 - h) + rElbow * h + deltoid - shoulderTuck) * loft.capEnv;
      let rx = baseR * 1.01;
      let ry = baseR * 0.96;
      const shade = 0.962 - innerSide * 0.012;

      let clothMix = 0.0;
      let clothRGB = null;
      if (wearShirt && h <= 0.56) {
        // Tailored short-sleeve shirt cuff (slightly looser than second-skin bodysuit)
        clothMix = Math.max(0.0, Math.min(1.0, (0.56 - h) / 0.055));
        const cuffLip = Math.exp(-Math.pow((h - 0.49) / 0.040, 2)) * 0.0014 * sf;
        rx += (0.0020 * sf + cuffLip) * clothMix;
        ry += (0.0020 * sf + cuffLip) * clothMix;
        const armSeamAO = Math.exp(-Math.pow((h - 0.08) / 0.05, 2)) * 0.045 + Math.exp(-Math.pow((h - 0.51) / 0.03, 2)) * 0.035 + innerSide * 0.025;
        clothRGB = [
          0.980 - armSeamAO * 1.12,
          0.984 - armSeamAO * 1.08,
          0.994 - armSeamAO * 0.90
        ];
      } else if (wearTop && h <= 0.58) {
        clothMix = Math.max(0.0, Math.min(1.0, (0.58 - h) / 0.07));
        const cuffLip = Math.exp(-Math.pow((h - 0.51) / 0.045, 2)) * 0.0008 * sf;
        rx += (0.00085 * sf + cuffLip) * clothMix;
        ry += (0.00085 * sf + cuffLip) * clothMix;
        const armSeamAO = Math.exp(-Math.pow((h - 0.08) / 0.05, 2)) * 0.045 + innerSide * 0.025;
        clothRGB = [
          0.975 - armSeamAO * 1.15,
          0.980 - armSeamAO * 1.10,
          0.995 - armSeamAO * 0.85
        ];
      }

      return { zPos: loft.zPos, rx, ry, shade, clothMix, clothRGB };
    }, 3, "uarm_" + (isLeft ? "L" : "R") + "_" + Math.round(sf * 1000) + eqSuffix, boneBasis);
  }

  // 6. Sculpted Chibi Forearm (1:1 Seamless Elbow Match -> Soft Forearm Taper -> 1:1 Wrist Match)
  function generateChibiForeArm(pElbow, pHand, isLeft, scaleFactor = 1.0, boneBasis = null) {
    const sf = scaleFactor;
    return generateSculptedCapsule(pElbow, pHand, 16, 14, (u, angle, sinA, cosA, lat, ant, L) => {
      const rElbow = 0.0355 * sf; // Matches UpperArm end radius 1:1!
      const rWrist = 0.0265 * sf;
      const loft = loftSeamlessJointShaft(u, L, rElbow, rWrist);
      const h = loft.h;
      const forearmBell = Math.sin(Math.pow(h, 0.80) * Math.PI) * 0.0030 * sf;
      const baseR = (rElbow * (1.0 - h) + rWrist * h + forearmBell) * loft.capEnv;
      // Smoothly transition elliptical aspect from elbow (rx=1.01, ry=0.96) to palm wrist orientation (rx=0.96 thickness, ry=1.01 knuckle width)
      const wT = h * h * (3.0 - 2.0 * h);
      const rx = baseR * (1.01 - 0.05 * wT);
      const ry = baseR * (0.96 + 0.05 * wT);
      const innerSide = isLeft ? Math.max(0.0, lat) : Math.max(0.0, -lat);
      const shade = 0.962 - innerSide * (0.012 - 0.004 * wT);
      return { zPos: loft.zPos, rx, ry, shade };
    }, 6, "farm_" + (isLeft ? "L" : "R") + "_" + Math.round(sf * 1000), boneBasis);
  }

  // 7. Sculpted Chibi Upper Leg / Thigh (Flush Hip Socket -> Continuous Thigh Curve -> 1:1 Knee Match)
  function generateChibiThigh(pHip, pKnee, isLeft, scaleFactor = 1.0, wearShortsOverride = null, wearLeggingsOverride = null, boneBasis = null) {
    const sf = scaleFactor;
    const eqState = (wearShortsOverride !== null || wearLeggingsOverride !== null)
      ? { wearShorts: !!wearShortsOverride, wearLeggings: !!wearLeggingsOverride, wearSlacks: false }
      : getCharacterEquippedClothingState(false);
    const wearShorts = eqState.wearShorts;
    const wearLeggings = eqState.wearLeggings;
    const wearSlacks = !!eqState.wearSlacks;
    const eqSuffix = `${wearShorts ? "_sh1" : "_sh0"}${wearLeggings ? "_leg1" : "_leg0"}${wearSlacks ? "_slk1" : "_slk0"}`;

    return generateSculptedCapsule(pHip, pKnee, 18, 16, (u, angle, sinA, cosA, lat, ant, L) => {
      const rHip = 0.0545 * sf;
      const rKnee = 0.0435 * sf;
      const loft = loftSeamlessJointShaft(u, L, rHip, rKnee);
      const h = loft.h;
      const innerThigh = isLeft ? Math.max(0.0, lat) : Math.max(0.0, -lat);

      // Taper top anterior/medial hip cap slightly so the thigh sits flush inside the lower tummy/pelvis (zero hip dome bulge!)
      const topSocketT = h < 0.30 ? Math.pow(1.0 - h / 0.30, 1.5) : 0.0;
      const frontHipTuck = topSocketT * Math.max(0.0, ant * 0.75 + innerThigh * 0.45) * 0.0075 * sf;

      const thighCurve = Math.sin(Math.pow(h, 0.72) * Math.PI) * 0.0040 * sf;
      const baseR = (rHip * (1.0 - h) + rKnee * h + thighCurve) * loft.capEnv;
      let rx = (baseR - topSocketT * innerThigh * 0.004 * sf) * 1.02;
      let ry = (baseR - frontHipTuck) * 0.98;

      const outerDir = isLeft ? -1.0 : 1.0;
      const cx = outerDir * Math.sin(h * Math.PI) * 0.0018 * sf;
      const cy = Math.sin(h * Math.PI) * 0.0012 * sf;

      const shade = 0.962 - innerThigh * 0.014;

      let legMix = 0.0;
      let legRGB = null;
      if (wearLeggings || wearSlacks) {
        legMix = 1.0;
        const sideSeamAO = Math.exp(-Math.pow((1.0 - Math.abs(lat)) / 0.14, 2)) * 0.012;
        const legAO = innerThigh * 0.025 + sideSeamAO + (ant > 0.3 ? -0.012 * ant : 0.010);
        if (wearSlacks) {
          const sFactor = Math.max(0.58, 1.0 - legAO);
          legRGB = [0.238 * sFactor, 0.246 * sFactor, 0.268 * sFactor];
        } else {
          const val = Math.max(0.060, 0.138 - legAO);
          legRGB = [val, val * 1.02, val * 1.14];
        }
      }

      let shortsMix = 0.0;
      let shortsRGB = null;
      if (wearShorts && h <= 0.40) {
        shortsMix = Math.max(0.0, Math.min(1.0, (0.40 - h) / 0.06));
        const thighCreaseAO = innerThigh * 0.032 + Math.exp(-Math.pow((h - 0.05) / 0.04, 2)) * 0.035;
        shortsRGB = [
          0.975 - thighCreaseAO * 1.15,
          0.980 - thighCreaseAO * 1.10,
          0.995 - thighCreaseAO * 0.85
        ];
      }

      let clothMix = 0.0;
      let clothRGB = null;
      if (shortsMix > 0.0001 || legMix > 0.0001) {
        const hemLip = shortsMix > 0.0001 ? Math.exp(-Math.pow((h - 0.34) / 0.04, 2)) * 0.00075 * sf * shortsMix : 0.0;
        const legBulge = wearSlacks ? 0.0 : (legMix * 0.00070);
        const bulge = Math.max(shortsMix * 0.00095, legBulge) * sf + hemLip;
        rx += bulge;
        ry += bulge;
        if (shortsMix >= 0.999) {
          clothMix = 1.0;
          clothRGB = shortsRGB;
        } else if (shortsMix > 0.0001 && legMix > 0.0001) {
          clothMix = 1.0;
          clothRGB = [
            legRGB[0] * (1.0 - shortsMix) + shortsRGB[0] * shortsMix,
            legRGB[1] * (1.0 - shortsMix) + shortsRGB[1] * shortsMix,
            legRGB[2] * (1.0 - shortsMix) + shortsRGB[2] * shortsMix
          ];
        } else if (shortsMix > 0.0001) {
          clothMix = shortsMix;
          clothRGB = shortsRGB;
        } else {
          clothMix = legMix;
          clothRGB = legRGB;
        }
      }

      return { zPos: loft.zPos, rx, ry, cx, cy, shade, clothMix, clothRGB };
    }, 4, "thigh_" + (isLeft ? "L" : "R") + "_" + Math.round(sf * 1000) + eqSuffix, boneBasis);
  }

  // 8. Sculpted Chibi Lower Leg / Calf & Shin (1:1 Seamless Knee Match -> Rounded Calf -> 1:1 Ankle Match)
  function generateChibiCalf(pKnee, pFoot, isLeft, scaleFactor = 1.0, wearLeggingsOverride = null, boneBasis = null) {
    const sf = scaleFactor;
    const eqState = (wearLeggingsOverride !== null)
      ? { wearLeggings: !!wearLeggingsOverride, wearSlacks: false }
      : getCharacterEquippedClothingState(false);
    const wearLeggings = eqState.wearLeggings;
    const wearSlacks = !!eqState.wearSlacks;
    const eqSuffix = `${wearLeggings ? "_leg1" : "_leg0"}${wearSlacks ? "_slk1" : "_slk0"}`;

    return generateSculptedCapsule(pKnee, pFoot, 18, 16, (u, angle, sinA, cosA, lat, ant, L) => {
      const rKnee = 0.0435 * sf; // Matches Thigh end radius 1:1!
      const rAnkle = 0.0355 * sf;
      const loft = loftSeamlessJointShaft(u, L, rKnee, rAnkle);
      const h = loft.h;

      const calfBell = Math.sin(Math.pow(h, 0.75) * Math.PI) * 0.0042 * sf;
      const baseR = (rKnee * (1.0 - h) + rAnkle * h + calfBell) * loft.capEnv;
      let rx = baseR * 1.02;
      let ry = baseR * 0.98;

      const cy = -Math.sin(h * Math.PI) * 0.0030 * sf;
      const innerLeg = isLeft ? Math.max(0.0, lat) : Math.max(0.0, -lat);
      const shade = 0.962 - innerLeg * 0.014;

      let clothMix = 0.0;
      let clothRGB = null;
      if ((wearLeggings || wearSlacks) && h <= 0.90) {
        clothMix = Math.max(0.0, Math.min(1.0, (0.90 - h) / 0.05));
        if (!wearSlacks) {
          const cuffLip = Math.exp(-Math.pow((h - 0.85) / 0.035, 2)) * 0.0005 * sf;
          rx += (0.00070 * sf + cuffLip) * clothMix;
          ry += (0.00070 * sf + cuffLip) * clothMix;
        }
        const sideSeamAO = Math.exp(-Math.pow((1.0 - Math.abs(lat)) / 0.14, 2)) * 0.012;
        const ankleCuffAO = Math.exp(-Math.pow((h - 0.86) / 0.03, 2)) * 0.025;
        const legAO = innerLeg * 0.025 + sideSeamAO + ankleCuffAO + (ant > 0.3 ? -0.012 * ant : 0.010);
        if (wearSlacks) {
          const sFactor = Math.max(0.58, 1.0 - legAO);
          clothRGB = [0.238 * sFactor, 0.246 * sFactor, 0.268 * sFactor];
        } else {
          const val = Math.max(0.055, 0.138 - legAO);
          clothRGB = [val, val * 1.02, val * 1.14];
        }
      }

      return { zPos: loft.zPos, rx, ry, cx: 0.0, cy, shade, clothMix, clothRGB };
    }, 8, "calf_" + (isLeft ? "L" : "R") + "_" + Math.round(sf * 1000) + eqSuffix, boneBasis);
  }

  // --- 5. Standard Skeletal Bone Rig: Spine/Head, Arms/Wrists/Fingers, Legs/Ankles/Feet/Toes ---
  function computeSpineHeadRig(chestP1, chestP2, headP1, headP2, pose = null) {
    const norm3 = (v, fb) => {
      if (!v) return fb;
      const l = Math.hypot(v[0], v[1], v[2]);
      return l > 1e-5 ? [v[0] / l, v[1] / l, v[2] / l] : fb;
    };
    const cross3 = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const rotAxis = (v, ax, ang) => {
      const c = Math.cos(ang), s = Math.sin(ang), d = dot3(v, ax);
      const cr = cross3(ax, v);
      return [
        v[0] * c + ax[0] * d * (1.0 - c) + cr[0] * s,
        v[1] * c + ax[1] * d * (1.0 - c) + cr[1] * s,
        v[2] * c + ax[2] * d * (1.0 - c) + cr[2] * s,
      ];
    };

    const p1 = chestP1 || [0, -0.09, 0];
    const p2 = chestP2 || [0, 0.17, 0];
    const spineUp = norm3([p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]], [0, 1, 0]);

    const torsoYaw = (pose && typeof pose.torsoYaw === "number") ? pose.torsoYaw : 0.0;
    const baseFwd = [Math.sin(torsoYaw), 0.0, Math.cos(torsoYaw)];
    const dF = dot3(baseFwd, spineUp);
    const torsoFwd = norm3([baseFwd[0] - spineUp[0] * dF, baseFwd[1] - spineUp[1] * dF, baseFwd[2] - spineUp[2] * dF], [0, 0, 1]);
    const torsoRight = norm3(cross3(spineUp, torsoFwd), [1, 0, 0]);

    const torsoBoneBasis = {
      zAxis: spineUp,
      xAxis: torsoFwd,
      yAxis: torsoRight,
      latSign: 1.0,
    };

    // Head Bone: inherits spine pitch/tilt by default, or explicit headPitch / headYaw / headRoll if provided
    let headUp = spineUp;
    let headFwd = torsoFwd;
    let headRight = torsoRight;
    if (pose && pose.lockHeadYaw) {
      // When torso rotates sideways (e.g., archer stance), keep head looking forward along +Z with pitch
      const hD = spineUp[2];
      headFwd = norm3([-spineUp[0] * hD, -spineUp[1] * hD, 1.0 - spineUp[2] * hD], [0, 0, 1]);
      headRight = norm3(cross3(headUp, headFwd), [1, 0, 0]);
    }
    if (pose) {
      if (typeof pose.headYaw === "number" && Math.abs(pose.headYaw) > 1e-4) {
        headFwd = norm3(rotAxis(headFwd, headUp, pose.headYaw), headFwd);
        headRight = norm3(cross3(headUp, headFwd), headRight);
      }
      if (typeof pose.headPitch === "number" && Math.abs(pose.headPitch) > 1e-4) {
        headUp = norm3(rotAxis(headUp, headRight, pose.headPitch), headUp);
        headFwd = norm3(rotAxis(headFwd, headRight, pose.headPitch), headFwd);
      }
      if (typeof pose.headRoll === "number" && Math.abs(pose.headRoll) > 1e-4) {
        headUp = norm3(rotAxis(headUp, headFwd, pose.headRoll), headUp);
        headRight = norm3(rotAxis(headRight, headFwd, pose.headRoll), headRight);
      }
    }

    const headBoneBasis = {
      upAxis: headUp,
      frontAxis: headFwd,
      rightAxis: headRight,
    };
    const earBoneBasis = {
      zAxis: headUp,
      xAxis: headFwd,
      yAxis: headRight,
      latSign: 1.0,
    };

    return {
      spineUp,
      torsoFwd,
      torsoRight,
      torsoBoneBasis,
      headBoneBasis,
      leftEarBoneBasis: earBoneBasis,
      rightEarBoneBasis: earBoneBasis,
    };
  }

  function computeHandGripFrame(pElbow, pHand, isLeft, wristPose = null, pShoulder = null) {
    const dX = pHand[0] - pElbow[0];
    const dY = pHand[1] - pElbow[1];
    const dZ = pHand[2] - pElbow[2];
    const len = Math.sqrt(dX * dX + dY * dY + dZ * dZ);
    const dForearm = len > 1e-4 ? [dX / len, dY / len, dZ / len] : [0, -1, 0];
    const norm3 = (v, fb) => {
      if (!v) return fb;
      const l = Math.hypot(v[0], v[1], v[2]);
      return l > 1e-5 ? [v[0] / l, v[1] / l, v[2] / l] : fb;
    };
    const cross3 = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const rotAxis = (v, ax, ang) => {
      const c = Math.cos(ang), s = Math.sin(ang), d = dot3(v, ax);
      const cr = cross3(ax, v);
      return [
        v[0] * c + ax[0] * d * (1.0 - c) + cr[0] * s,
        v[1] * c + ax[1] * d * (1.0 - c) + cr[1] * s,
        v[2] * c + ax[2] * d * (1.0 - c) + cr[2] * s,
      ];
    };

    const inSign = isLeft ? 1.0 : -1.0;
    let dArm = dForearm;
    let palmIn;
    let rKnuckle;

    if (wristPose && (wristPose.bladeDir || wristPose.handDir || wristPose.palmHint || typeof wristPose.pitch === "number" || typeof wristPose.yaw === "number" || typeof wristPose.roll === "number")) {
      if (typeof wristPose.pitch === "number" || typeof wristPose.yaw === "number" || typeof wristPose.roll === "number") {
        // Standard 3-DOF Bone Joint Rotation on Wrist (Roll = forearm pronation/supination, Pitch = radial/ulnar flex, Yaw = palmar/dorsal flex)
        let basePalm = [inSign * 0.85, -0.15, -0.45];
        const dp0 = dot3(basePalm, dForearm);
        basePalm = norm3([basePalm[0] - dForearm[0] * dp0, basePalm[1] - dForearm[1] * dp0, basePalm[2] - dForearm[2] * dp0], [inSign, 0, 0]);
        let baseKnuckle = norm3(isLeft ? cross3(dForearm, basePalm) : cross3(basePalm, dForearm), [0, 0, 1]);
        const roll = wristPose.roll || 0.0;
        const pitch = wristPose.pitch || 0.0;
        const yaw = wristPose.yaw || 0.0;
        if (Math.abs(roll) > 1e-4) {
          basePalm = norm3(rotAxis(basePalm, dForearm, roll), basePalm);
          baseKnuckle = norm3(rotAxis(baseKnuckle, dForearm, roll), baseKnuckle);
        }
        dArm = dForearm;
        if (Math.abs(pitch) > 1e-4) {
          dArm = norm3(rotAxis(dArm, basePalm, isLeft ? -pitch : pitch), dArm);
          baseKnuckle = norm3(rotAxis(baseKnuckle, basePalm, isLeft ? -pitch : pitch), baseKnuckle);
        }
        if (Math.abs(yaw) > 1e-4) {
          dArm = norm3(rotAxis(dArm, baseKnuckle, isLeft ? yaw : -yaw), dArm);
          basePalm = norm3(rotAxis(basePalm, baseKnuckle, isLeft ? yaw : -yaw), basePalm);
        }
        rKnuckle = baseKnuckle;
        palmIn = norm3(isLeft ? cross3(rKnuckle, dArm) : cross3(dArm, rKnuckle), basePalm);
      } else {
        if (wristPose.handDir) {
          const hd = norm3(wristPose.handDir, dForearm);
          const hb = Math.max(0.0, Math.min(1.0, typeof wristPose.handBlend === "number" ? wristPose.handBlend : 0.65));
          dArm = norm3([
            dForearm[0] * (1.0 - hb) + hd[0] * hb,
            dForearm[1] * (1.0 - hb) + hd[1] * hb,
            dForearm[2] * (1.0 - hb) + hd[2] * hb,
          ], dForearm);
        }
        if (wristPose.bladeDir) {
          const gripMode = wristPose.gripMode || "normal";
          const tb = norm3(wristPose.bladeDir, [0, 0, 1]);
          rKnuckle = gripMode === "reverse" ? [-tb[0], -tb[1], -tb[2]] : [tb[0], tb[1], tb[2]];
          const anatPalm = norm3(wristPose.palmHint, [inSign * 0.62, 0.42, 0.66]);
          const anatDArm = norm3(
            isLeft ? cross3(anatPalm, rKnuckle) : cross3(rKnuckle, anatPalm),
            [0, -0.6, 0.8]
          );
          if (wristPose.edgeDir) {
            const te = norm3(wristPose.edgeDir, anatDArm);
            const rawK = gripMode === "reverse" ? [-te[0], -te[1], -te[2]] : te;
            const dotKR = dot3(rawK, rKnuckle);
            dArm = norm3([
              rawK[0] - rKnuckle[0] * dotKR,
              rawK[1] - rKnuckle[1] * dotKR,
              rawK[2] - rKnuckle[2] * dotKR,
            ], anatDArm);
            const testPalm = norm3(
              isLeft ? cross3(rKnuckle, dArm) : cross3(dArm, rKnuckle),
              anatPalm
            );
            if (wristPose.palmHint && dot3(testPalm, anatPalm) < -0.10) {
              dArm = anatDArm;
            }
          } else {
            const dotDR = dot3(dArm, rKnuckle);
            let perp = [
              dArm[0] - rKnuckle[0] * dotDR,
              dArm[1] - rKnuckle[1] * dotDR,
              dArm[2] - rKnuckle[2] * dotDR,
            ];
            const pLen = Math.hypot(perp[0], perp[1], perp[2]);
            if (pLen < 0.38 || dot3(perp, anatDArm) < 0.0) {
              const wAnat = pLen < 0.38 ? (1.0 - pLen / 0.38) : 0.75;
              const pNorm = pLen > 1e-4 ? [perp[0] / pLen, perp[1] / pLen, perp[2] / pLen] : anatDArm;
              const alignedP = dot3(pNorm, anatDArm) < 0.0 ? anatDArm : pNorm;
              dArm = norm3([
                alignedP[0] * (1.0 - wAnat) + anatDArm[0] * wAnat,
                alignedP[1] * (1.0 - wAnat) + anatDArm[1] * wAnat,
                alignedP[2] * (1.0 - wAnat) + anatDArm[2] * wAnat,
              ], anatDArm);
              const dFix = dot3(dArm, rKnuckle);
              dArm = norm3([
                dArm[0] - rKnuckle[0] * dFix,
                dArm[1] - rKnuckle[1] * dFix,
                dArm[2] - rKnuckle[2] * dFix,
              ], anatDArm);
            } else {
              dArm = [perp[0] / pLen, perp[1] / pLen, perp[2] / pLen];
            }
          }
          palmIn = norm3(
            isLeft ? cross3(rKnuckle, dArm) : cross3(dArm, rKnuckle),
            anatPalm
          );
        } else {
          const ph = norm3(wristPose.palmHint, [inSign * 0.85, -0.15, -0.45]);
          const dotIn = dot3(ph, dArm);
          palmIn = norm3([
            ph[0] - dArm[0] * dotIn,
            ph[1] - dArm[1] * dotIn,
            ph[2] - dArm[2] * dotIn,
          ], [inSign, 0, 0]);
          rKnuckle = norm3(
            isLeft ? cross3(dArm, palmIn) : cross3(palmIn, dArm),
            [0, 0, 1]
          );
        }
      }
    } else {
      palmIn = [inSign * 0.85, -0.15, -0.45];
      const dotIn = dot3(palmIn, dArm);
      palmIn = norm3([
        palmIn[0] - dArm[0] * dotIn,
        palmIn[1] - dArm[1] * dotIn,
        palmIn[2] - dArm[2] * dotIn,
      ], [inSign, 0, 0]);
      rKnuckle = norm3(
        isLeft ? cross3(dArm, palmIn) : cross3(palmIn, dArm),
        [0, 0, 1]
      );
    }

    const gripCenter = [
      pHand[0] + dArm[0] * 0.036 + palmIn[0] * 0.016,
      pHand[1] + dArm[1] * 0.036 + palmIn[1] * 0.016,
      pHand[2] + dArm[2] * 0.036 + palmIn[2] * 0.016,
    ];

    // UpperArm Bone Basis (Shoulder -> Elbow) with continuous anterior axis (never gimbal-flips at |zAxis[1]| > 0.95)
    let upperArmBoneBasis = null;
    if (pShoulder) {
      const dUpper = norm3([pElbow[0] - pShoulder[0], pElbow[1] - pShoulder[1], pElbow[2] - pShoulder[2]], [0, -1, 0]);
      const uAntHint = norm3([rKnuckle[0] * 0.35, rKnuckle[1] * 0.35, rKnuckle[2] * 0.35 + 0.65], [0, 0, 1]);
      const duA = dot3(uAntHint, dUpper);
      const uX = norm3([uAntHint[0] - dUpper[0] * duA, uAntHint[1] - dUpper[1] * duA, uAntHint[2] - dUpper[2] * duA], [0, 0, 1]);
      const uY = norm3(cross3(dUpper, uX), [-1, 0, 0]);
      upperArmBoneBasis = { zAxis: dUpper, xAxis: uX, yAxis: uY, latSign: -1.0 };
    }

    // Forearm & Hand Bone Basis for generateSculptedCapsule (locked to rKnuckle so forearm and palm twist in the exact same anatomical plane)
    const fAnt = norm3(rKnuckle, [0, 0, 1]);
    const dfA = dot3(fAnt, dForearm);
    const fX = norm3([fAnt[0] - dForearm[0] * dfA, fAnt[1] - dForearm[1] * dfA, fAnt[2] - dForearm[2] * dfA], [0, 0, 1]);
    const fY = norm3(cross3(dForearm, fX), [-1, 0, 0]);
    const forearmBoneBasis = { zAxis: dForearm, xAxis: fX, yAxis: fY, latSign: -1.0 };
    const handBoneBasis = {
      zAxis: dArm,
      xAxis: rKnuckle,
      yAxis: isLeft ? palmIn : [-palmIn[0], -palmIn[1], -palmIn[2]],
      latSign: -1.0,
    };

    // Standard WeaponSocket Bone attached to Hand Bone:
    // +axisAlong = blade tip direction (locked to +rKnuckle in normal grip, -rKnuckle in reverse grip)
    // +edgeUp    = cutting edge direction (+vAxis in buildShirasayaModel = locked 1:1 to +dArm in normal grip, -dArm in reverse grip)
    // +thickRight= flat side normal
    const gripMode = (wristPose && wristPose.gripMode) ? wristPose.gripMode : "normal";
    const socketAlong = gripMode === "reverse"
      ? [-rKnuckle[0], -rKnuckle[1], -rKnuckle[2]]
      : [rKnuckle[0], rKnuckle[1], rKnuckle[2]];
    const socketEdge = gripMode === "reverse"
      ? [-dArm[0], -dArm[1], -dArm[2]]
      : [dArm[0], dArm[1], dArm[2]];
    const socketThick = norm3(cross3(socketAlong, socketEdge), palmIn);

    return {
      dArm,
      dForearm,
      palmIn,
      rKnuckle,
      gripCenter,
      upperArmBoneBasis,
      forearmBoneBasis,
      handBoneBasis,
      weaponSocket: {
        origin: gripCenter,
        axisAlong: socketAlong,
        edgeUp: socketEdge,
        thickRight: socketThick,
      },
    };
  }

  const _fingerTubeTemplateCache = {};
  const _flippedCapsuleIndexCache = {};

  function getFlippedCapsuleIndices(radialSegments, axialSegments) {
    const key = radialSegments + "_" + axialSegments;
    if (_flippedCapsuleIndexCache[key]) return _flippedCapsuleIndexCache[key];
    const src = getCapsuleIndices(radialSegments, axialSegments);
    const flipped = new Uint16Array(src.length);
    for (let i = 0; i < src.length; i += 3) {
      flipped[i] = src[i];
      flipped[i + 1] = src[i + 2];
      flipped[i + 2] = src[i + 1];
    }
    _flippedCapsuleIndexCache[key] = flipped;
    return flipped;
  }

  function buildContinuousFingerTube(
    cacheKey,
    localJoints,
    radii,
    radialSegs,
    sf,
    baseShade,
    pHand,
    dArm,
    palmIn,
    rKnuckle
  ) {
    let tpl = _fingerTubeTemplateCache[cacheKey];
    if (!tpl) {
      const n3 = (v, fb) => {
        const l = Math.hypot(v[0], v[1], v[2]);
        return l > 1e-6 ? [v[0] / l, v[1] / l, v[2] / l] : fb;
      };
      const c3 = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ];
      const d3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const mix3 = (a, b, t) => [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ];
      const lerpVal = (a, b, t) => a + (b - a) * t;

      const M = localJoints.length;
      const samples = []; // { pos: [d,p,r], rad, uFrac, jointBump }

      // Anchor root deeply inside the palm mesh so the finger/thumb emerges organically without any gap
      const d0 = n3([
        localJoints[1][0] - localJoints[0][0],
        localJoints[1][1] - localJoints[0][1],
        localJoints[1][2] - localJoints[0][2],
      ], [1, 0, 0]);
      const r0 = radii[0];
      const sinkDist = 0.0055 * sf;
      const pRoot = [
        localJoints[0][0] - d0[0] * sinkDist,
        localJoints[0][1] - d0[1] * sinkDist,
        localJoints[0][2] - d0[2] * sinkDist,
      ];
      const pRootCap = [
        pRoot[0] - d0[0] * r0 * 0.25,
        pRoot[1] - d0[1] * r0 * 0.25,
        pRoot[2] - d0[2] * r0 * 0.25,
      ];

      samples.push({ pos: pRootCap, rad: r0 * 0.14, uFrac: 0.0 });
      samples.push({ pos: pRoot, rad: r0 * 1.12, uFrac: 0.03 });
      samples.push({ pos: localJoints[0], rad: r0 * 1.02, uFrac: 0.08 });

      let prevPos = localJoints[0];
      let prevRad = r0;
      const segSpan = 0.80 / Math.max(1, M - 1);

      for (let k = 1; k < M - 1; k++) {
        const currP = localJoints[k];
        const prevP = localJoints[k - 1];
        const nextP = localJoints[k + 1];
        const currR = radii[k];
        const nextR = radii[k + 1];

        const vIn = [currP[0] - prevP[0], currP[1] - prevP[1], currP[2] - prevP[2]];
        const vOut = [nextP[0] - currP[0], nextP[1] - currP[1], nextP[2] - currP[2]];
        const lIn = Math.hypot(vIn[0], vIn[1], vIn[2]) || 1e-4;
        const lOut = Math.hypot(vOut[0], vOut[1], vOut[2]) || 1e-4;
        const uIn = [vIn[0] / lIn, vIn[1] / lIn, vIn[2] / lIn];
        const uOut = [vOut[0] / lOut, vOut[1] / lOut, vOut[2] / lOut];

        const trim = Math.min(lIn, lOut) * 0.36;
        const tIn = Math.min(0.45, trim / lIn);
        const tOut = Math.min(0.45, trim / lOut);

        const qIn = [currP[0] - uIn[0] * trim, currP[1] - uIn[1] * trim, currP[2] - uIn[2] * trim];
        const qOut = [currP[0] + uOut[0] * trim, currP[1] + uOut[1] * trim, currP[2] + uOut[2] * trim];
        const rIn = lerpVal(currR, prevRad, tIn);
        const rOut = lerpVal(currR, nextR, tOut);

        const baseU = 0.08 + (k - 1) * segSpan;
        // Mid-shaft sample only when straight span is long enough to avoid sliver rings
        const distPrevQIn = Math.hypot(qIn[0] - prevPos[0], qIn[1] - prevPos[1], qIn[2] - prevPos[2]);
        if (distPrevQIn > currR * 0.9) {
          samples.push({
            pos: mix3(prevPos, qIn, 0.5),
            rad: lerpVal(prevRad, rIn, 0.5),
            uFrac: baseU + segSpan * 0.30,
          });
        }

        // Smooth quadratic Bezier arc around joint k (continuous tube with gentle joint pad fullness, zero ball-pinching)
        const arcSteps = 3;
        for (let s = 0; s <= arcSteps; s++) {
          const bt = s / arcSteps;
          const omt = 1.0 - bt;
          const bPos = [
            omt * omt * qIn[0] + 2.0 * omt * bt * currP[0] + bt * bt * qOut[0],
            omt * omt * qIn[1] + 2.0 * omt * bt * currP[1] + bt * bt * qOut[1],
            omt * omt * qIn[2] + 2.0 * omt * bt * currP[2] + bt * bt * qOut[2],
          ];
          const bRad = lerpVal(rIn, rOut, bt) * (1.0 + 0.032 * Math.sin(bt * Math.PI));
          samples.push({
            pos: bPos,
            rad: bRad,
            uFrac: baseU + segSpan * (0.60 + 0.40 * bt),
          });
        }

        prevPos = qOut;
        prevRad = rOut;
      }

      const tipBase = localJoints[M - 1];
      const rTip = radii[M - 1];
      const distPrevTip = Math.hypot(tipBase[0] - prevPos[0], tipBase[1] - prevPos[1], tipBase[2] - prevPos[2]);
      if (distPrevTip > rTip * 0.9) {
        samples.push({
          pos: mix3(prevPos, tipBase, 0.52),
          rad: lerpVal(prevRad, rTip, 0.52),
          uFrac: 0.90,
        });
      }
      samples.push({ pos: tipBase, rad: rTip, uFrac: 0.94 });

      // Rounded Chibi fingertip dome
      const endDir = n3([
        tipBase[0] - prevPos[0],
        tipBase[1] - prevPos[1],
        tipBase[2] - prevPos[2],
      ], d0);
      const domeAngles = [0.42, 0.88, 1.28, Math.PI * 0.5];
      for (let a = 0; a < domeAngles.length; a++) {
        const ang = domeAngles[a];
        const advance = Math.sin(ang) * rTip * 0.92;
        const capR = Math.max(rTip * 0.025, Math.cos(ang) * rTip);
        samples.push({
          pos: [
            tipBase[0] + endDir[0] * advance,
            tipBase[1] + endDir[1] * advance,
            tipBase[2] + endDir[2] * advance,
          ],
          rad: capR,
          uFrac: 0.95 + 0.05 * ((a + 1) / domeAngles.length),
        });
      }

      // Filter out overly tight interior sample clusters (< 0.42 * rad apart)
      const filteredSamples = [samples[0], samples[1], samples[2]];
      for (let i = 3; i < samples.length - 5; i++) {
        const prevKept = filteredSamples[filteredSamples.length - 1];
        const curS = samples[i];
        const stepDist = Math.hypot(curS.pos[0] - prevKept.pos[0], curS.pos[1] - prevKept.pos[1], curS.pos[2] - prevKept.pos[2]);
        if (stepDist >= Math.max(curS.rad, prevKept.rad) * 0.42) {
          filteredSamples.push(curS);
        }
      }
      for (let i = Math.max(3, samples.length - 5); i < samples.length; i++) {
        const prevKept = filteredSamples[filteredSamples.length - 1];
        const curS = samples[i];
        const stepDist = Math.hypot(curS.pos[0] - prevKept.pos[0], curS.pos[1] - prevKept.pos[1], curS.pos[2] - prevKept.pos[2]);
        if (stepDist > 1e-5) {
          filteredSamples.push(curS);
        }
      }

      const ringCount = filteredSamples.length;
      const totalVerts = ringCount * (radialSegs + 1);
      const localCoords = new Float32Array(totalVerts * 3);
      const localNormals = new Float32Array(totalVerts * 3);
      const colors = new Float32Array(totalVerts * 3);

      // Compute tangents & parallel-transported cross-section frames (U = lateral knuckle axis, V = palmar-dorsal)
      const T = new Array(ringCount);
      for (let i = 0; i < ringCount; i++) {
        const pPrev = filteredSamples[Math.max(0, i - 1)].pos;
        const pNext = filteredSamples[Math.min(ringCount - 1, i + 1)].pos;
        T[i] = n3([pNext[0] - pPrev[0], pNext[1] - pPrev[1], pNext[2] - pPrev[2]], d0);
      }

      let prevU = n3([
        -T[0][0] * T[0][2],
        -T[0][1] * T[0][2],
        1.0 - T[0][2] * T[0][2],
      ], null);
      if (!prevU || Math.hypot(prevU[0], prevU[1], prevU[2]) < 1e-4) {
        prevU = n3([
          -T[0][0] * T[0][1],
          1.0 - T[0][1] * T[0][1],
          -T[0][2] * T[0][1],
        ], [1, 0, 0]);
      }

      let vIdx = 0;
      for (let i = 0; i < ringCount; i++) {
        const ti = T[i];
        const dotUT = prevU[0] * ti[0] + prevU[1] * ti[1] + prevU[2] * ti[2];
        let ui = [prevU[0] - ti[0] * dotUT, prevU[1] - ti[1] * dotUT, prevU[2] - ti[2] * dotUT];
        if (Math.hypot(ui[0], ui[1], ui[2]) < 1e-4) {
          ui = n3([-ti[0] * ti[2], -ti[1] * ti[2], 1.0 - ti[2] * ti[2]], [1, 0, 0]);
        } else {
          ui = n3(ui, [0, 0, 1]);
        }
        prevU = ui;
        const vi = n3(c3(ti, ui), [0, 1, 0]); // right-handed: V = T x U

        const s = filteredSamples[i];
        const rx = s.rad;
        const ry = s.rad * 0.94; // Slight natural palmar-dorsal flatness
        const tipGrad = Math.min(1.0, Math.max(0.0, s.uFrac));

        // C1-smooth inner-bend modulation: scales inner side gently based on local curvature so flexed rings never self-intersect
        let bendDir = null;
        let innerScale = 1.0;
        if (i > 0 && i < ringCount - 1) {
          const tPrev = T[i - 1], tNext = T[i + 1];
          const dtx = tNext[0] - tPrev[0], dty = tNext[1] - tPrev[1], dtz = tNext[2] - tPrev[2];
          const dtLen = Math.hypot(dtx, dty, dtz);
          if (dtLen > 0.05) {
            bendDir = [dtx / dtLen, dty / dtLen, dtz / dtLen];
            const pPrev = filteredSamples[i - 1].pos, pCurr = filteredSamples[i].pos, pNext = filteredSamples[i + 1].pos;
            const stepPrev = Math.hypot(pCurr[0] - pPrev[0], pCurr[1] - pPrev[1], pCurr[2] - pPrev[2]);
            const stepNext = Math.hypot(pNext[0] - pCurr[0], pNext[1] - pCurr[1], pNext[2] - pCurr[2]);
            const rCurv = (2.0 * Math.min(stepPrev, stepNext)) / dtLen;
            if (s.rad > 1e-5 && rCurv * 0.65 < s.rad) {
              innerScale = Math.max(0.28, (rCurv * 0.65) / s.rad);
            }
          }
        }

        for (let j = 0; j <= radialSegs; j++) {
          const phi = (j === radialSegs ? 0 : (j / radialSegs) * Math.PI * 2);
          const cosP = Math.cos(phi);
          const sinP = Math.sin(phi);

          let offD = ui[0] * cosP * rx + vi[0] * sinP * ry;
          let offP = ui[1] * cosP * rx + vi[1] * sinP * ry;
          let offR = ui[2] * cosP * rx + vi[2] * sinP * ry;

          if (bendDir && innerScale < 0.999) {
            const radLen = Math.hypot(offD, offP, offR) || 1e-5;
            const inAlign = (offD * bendDir[0] + offP * bendDir[1] + offR * bendDir[2]) / radLen;
            const w = 0.5 + 0.5 * inAlign;
            const mod = 1.0 - (1.0 - innerScale) * w * w;
            offD *= mod;
            offP *= mod;
            offR *= mod;
          }

          localCoords[vIdx]     = s.pos[0] + offD;
          localCoords[vIdx + 1] = s.pos[1] + offP;
          localCoords[vIdx + 2] = s.pos[2] + offR;

          // Match palm shading seamlessly: softer shade at palm root, gentle inner crease tint, brighter fingertip
          const radN = n3([offD, offP, offR], ui);
          const innerPalmBias = Math.max(0.0, radN[1]); // +p corresponds to palmIn side
          const shade = baseShade - 0.008 * (1.0 - tipGrad) - innerPalmBias * 0.008 + tipGrad * 0.006;
          const aoDepth = Math.max(0.0, 0.97 - shade);
          colors[vIdx]     = Math.min(1.0, shade * 1.025 + aoDepth * 0.12);
          colors[vIdx + 1] = Math.min(1.0, shade * 0.910 - aoDepth * 0.08);
          colors[vIdx + 2] = Math.min(1.0, shade * 0.845 - aoDepth * 0.14);

          localNormals[vIdx] = 0.0;
          localNormals[vIdx + 1] = 0.0;
          localNormals[vIdx + 2] = 0.0;
          vIdx += 3;
        }
      }

      const baseIndices = getCapsuleIndices(radialSegs, ringCount - 1);
      for (let k = 0; k < baseIndices.length; k += 3) {
        const i0 = baseIndices[k] * 3;
        const i1 = baseIndices[k + 1] * 3;
        const i2 = baseIndices[k + 2] * 3;

        const ux = localCoords[i1] - localCoords[i0];
        const uy = localCoords[i1 + 1] - localCoords[i0 + 1];
        const uz = localCoords[i1 + 2] - localCoords[i0 + 2];

        const vx = localCoords[i2] - localCoords[i0];
        const vy = localCoords[i2 + 1] - localCoords[i0 + 1];
        const vz = localCoords[i2 + 2] - localCoords[i0 + 2];

        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;

        localNormals[i0] += nx; localNormals[i0 + 1] += ny; localNormals[i0 + 2] += nz;
        localNormals[i1] += nx; localNormals[i1 + 1] += ny; localNormals[i1 + 2] += nz;
        localNormals[i2] += nx; localNormals[i2 + 1] += ny; localNormals[i2 + 2] += nz;
      }

      const stride = radialSegs + 1;
      for (let i = 0; i < ringCount; i++) {
        // Weld radial seam normals between j=0 and j=radialSegs
        const b0 = (i * stride) * 3;
        const bN = (i * stride + radialSegs) * 3;
        const sx = localNormals[b0] + localNormals[bN];
        const sy = localNormals[b0 + 1] + localNormals[bN + 1];
        const sz = localNormals[b0 + 2] + localNormals[bN + 2];
        localNormals[b0] = localNormals[bN] = sx;
        localNormals[b0 + 1] = localNormals[bN + 1] = sy;
        localNormals[b0 + 2] = localNormals[bN + 2] = sz;
      }

      // Clean axial pole normals at root cap and fingertip apex
      const tEnd = T[ringCount - 1];
      const tStart = T[0];
      for (let j = 0; j <= radialSegs; j++) {
        const idx0 = j * 3;
        localNormals[idx0] = -tStart[0];
        localNormals[idx0 + 1] = -tStart[1];
        localNormals[idx0 + 2] = -tStart[2];

        const idxE = ((ringCount - 1) * stride + j) * 3;
        localNormals[idxE] = tEnd[0];
        localNormals[idxE + 1] = tEnd[1];
        localNormals[idxE + 2] = tEnd[2];
      }

      for (let k = 0; k < totalVerts * 3; k += 3) {
        const nl = Math.hypot(localNormals[k], localNormals[k + 1], localNormals[k + 2]);
        if (nl > 1e-6) {
          localNormals[k] /= nl;
          localNormals[k + 1] /= nl;
          localNormals[k + 2] /= nl;
        } else {
          localNormals[k] = 1.0;
        }
      }

      tpl = { ringCount, localCoords, localNormals, colors };
      _fingerTubeTemplateCache[cacheKey] = tpl;
    }

    const totalVerts = tpl.ringCount * (radialSegs + 1);
    const pooled = getPooledCapsuleBuffers(totalVerts);
    const vertices = pooled.vertices.subarray(0, totalVerts * 3);
    const normals = pooled.normals.subarray(0, totalVerts * 3);

    const lCoords = tpl.localCoords;
    const lNorms = tpl.localNormals;
    const phx = pHand[0], phy = pHand[1], phz = pHand[2];
    const dx = dArm[0], dy = dArm[1], dz = dArm[2];
    const px = palmIn[0], py = palmIn[1], pz = palmIn[2];
    const rx = rKnuckle[0], ry = rKnuckle[1], rz = rKnuckle[2];

    const len3 = totalVerts * 3;
    for (let k = 0; k < len3; k += 3) {
      const ld = lCoords[k];
      const lp = lCoords[k + 1];
      const lr = lCoords[k + 2];
      vertices[k]     = phx + dx * ld + px * lp + rx * lr;
      vertices[k + 1] = phy + dy * ld + py * lp + ry * lr;
      vertices[k + 2] = phz + dz * ld + pz * lp + rz * lr;

      const nd = lNorms[k];
      const np = lNorms[k + 1];
      const nr = lNorms[k + 2];
      normals[k]     = dx * nd + px * np + rx * nr;
      normals[k + 1] = dy * nd + py * np + ry * nr;
      normals[k + 2] = dz * nd + pz * np + rz * nr;
    }

    // Account for mirrored right-hand [dArm, palmIn, rKnuckle] basis (det < 0) so triangle winding stays strictly CCW outward
    const crossDPx = dy * pz - dz * py;
    const crossDPy = dz * px - dx * pz;
    const crossDPz = dx * py - dy * px;
    const basisDet = crossDPx * rx + crossDPy * ry + crossDPz * rz;
    const indices = basisDet < 0.0
      ? getFlippedCapsuleIndices(radialSegs, tpl.ringCount - 1)
      : getCapsuleIndices(radialSegs, tpl.ringCount - 1);

    return { vertices, normals, colors: tpl.colors, indices, skinGroup: 7 };
  }

  function buildHandAndFingers(pElbow, pHand, isLeft, scaleFactor, gripAmount = 0, wristPose = null, pShoulder = null) {
    const { dArm, palmIn, rKnuckle, handBoneBasis } = computeHandGripFrame(pElbow, pHand, isLeft, wristPose, pShoulder);

    const g = Math.max(0.0, Math.min(1.0, typeof gripAmount === "number" ? gripAmount : 0.0));
    const gKey = "_g" + Math.round(g * 100);
    const sf = scaleFactor;
    const toLocalPt = (dOff, pOff, rOff) => [
      pHand[0] + dArm[0] * dOff * sf + palmIn[0] * pOff * sf + rKnuckle[0] * rOff * sf,
      pHand[1] + dArm[1] * dOff * sf + palmIn[1] * pOff * sf + rKnuckle[1] * rOff * sf,
      pHand[2] + dArm[2] * dOff * sf + palmIn[2] * pOff * sf + rKnuckle[2] * rOff * sf,
    ];
    const lerp = (a, b, t) => a + (b - a) * t;

    const palmTip = toLocalPt(0.025, 0.0, 0.0);

    // Sculpted chibi palm: 16 radial segments matching forearm 1:1, continuous wrist shade & seamless knuckle seating
    const sfKey = Math.round(sf * 1000);
    const sideStr = isLeft ? "L" : "R";
    const palm = generateSculptedCapsule(pHand, palmTip, 16, 12, (u, angle, sinA, cosA, lat, ant, L) => {
      const loft = loftSeamlessJointShaft(u, L, 0.0265 * sf, 0.0245 * sf);
      const h = loft.h;
      const widthBell = Math.sin(h * Math.PI * 0.78) * 0.0032 * sf;
      const rx = (0.0254 * (1.0 - h) + 0.0205 * h) * sf * loft.capEnv;
      const ry = ((0.0268 * (1.0 - h) + 0.0300 * h) * sf + widthBell) * loft.capEnv;
      const innerSide = isLeft ? Math.max(0.0, lat) : Math.max(0.0, -lat);
      const palmShadeFade = Math.max(0.0, Math.min(1.0, (h - 0.16) / 0.55));
      const innerPalmAO = innerSide * (0.008 + 0.010 * palmShadeFade);
      return { zPos: loft.zPos, rx, ry, shade: 0.962 - innerPalmAO };
    }, 7, "palm_" + sideStr + "_" + sfKey, handBoneBasis);
    const parts = [palm];

    // 1. Continuous Opposable Chibi Thumb (blends smoothly from relaxed open pose into closed grip over the index/middle fingers)
    const thumbJoints = [
      [0.011 * sf, 0.007 * sf, 0.018 * sf],
      [lerp(0.0250, 0.025, g) * sf, lerp(0.0117, 0.029, g) * sf, lerp(0.0301, 0.021, g) * sf],
      [lerp(0.0391, 0.041, g) * sf, lerp(0.0187, 0.029, g) * sf, lerp(0.0330, 0.010, g) * sf],
    ];
    parts.push(
      buildContinuousFingerTube(
        "ftube_th" + gKey + "_" + sfKey,
        thumbJoints,
        [0.0108 * sf, 0.0097 * sf, 0.0080 * sf],
        10,
        sf,
        0.958,
        pHand,
        dArm,
        palmIn,
        rKnuckle
      )
    );

    // 2. 4 Continuous Sculpted Chibi Fingers (zero segmented sausage capsules; blends smoothly from open curl to full handle wrap)
    const fingerKnuckleSpread = [0.0175, 0.0062, -0.0055, -0.0172];
    const fingerLengths = [0.028, 0.032, 0.029, 0.023];
    const fingerRadii = [0.0094, 0.0098, 0.0093, 0.0082];
    const degToRad = Math.PI / 180.0;

    for (let f = 0; f < 4; f++) {
      const kOff = fingerKnuckleSpread[f];
      const fLen = fingerLengths[f];
      const fRad = fingerRadii[f] * sf;
      const archDrop = (f === 1 ? 0.001 : (f === 3 ? -0.004 : -0.001));

      const kD = 0.025 + archDrop;
      const kP = 0.0;

      // Open hand trajectory
      const openMidD = kD + 0.96 * (fLen * 0.54);
      const openMidP = kP + 0.28 * (fLen * 0.54);
      const openTipD = openMidD + 0.83 * (fLen * 0.48);
      const openTipP = openMidP + 0.55 * (fLen * 0.48);

      const openJ1D = lerp(kD, openMidD, 0.70);
      const openJ1P = lerp(kP, openMidP, 0.70);
      const openJ2D = lerp(openMidD, openTipD, 0.45);
      const openJ2P = lerp(openMidP, openTipP, 0.45);

      // Closed grip circular arc around handle center (d=0.036, p=0.016)
      const wrapR = 0.0185 + (f === 1 ? 0.001 : (f === 3 ? -0.001 : 0));
      const gripJ1D = 0.036 + Math.cos(-50 * degToRad) * wrapR;
      const gripJ1P = 0.016 + Math.sin(-50 * degToRad) * wrapR;
      const gripJ2D = 0.036 + Math.cos(30 * degToRad) * wrapR;
      const gripJ2P = 0.016 + Math.sin(30 * degToRad) * wrapR;
      const gripTipD = 0.036 + Math.cos(115 * degToRad) * wrapR;
      const gripTipP = 0.016 + Math.sin(115 * degToRad) * wrapR;

      const fingerJoints = [
        [kD * sf, kP * sf, kOff * sf],
        [lerp(openJ1D, gripJ1D, g) * sf, lerp(openJ1P, gripJ1P, g) * sf, kOff * sf],
        [lerp(openJ2D, gripJ2D, g) * sf, lerp(openJ2P, gripJ2P, g) * sf, kOff * sf],
        [lerp(openTipD, gripTipD, g) * sf, lerp(openTipP, gripTipP, g) * sf, kOff * sf],
      ];

      parts.push(
        buildContinuousFingerTube(
          "ftube_f" + f + gKey + "_" + sfKey,
          fingerJoints,
          [fRad, fRad * 0.96, fRad * 0.89, fRad * 0.77],
          10,
          sf,
          0.956,
          pHand,
          dArm,
          palmIn,
          rKnuckle
        )
      );
    }
    return parts;
  }

  // Standard Leg, Ankle & Foot Skeletal Bone Rig (Hip -> Thigh -> Knee -> Calf -> Ankle -> Foot -> 5 Toes)
  function computeLegRigFrame(pHip, pKnee, pFoot, isLeft, anklePose = null) {
    const norm3 = (v, fb) => {
      if (!v) return fb;
      const l = Math.hypot(v[0], v[1], v[2]);
      return l > 1e-5 ? [v[0] / l, v[1] / l, v[2] / l] : fb;
    };
    const cross3 = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

    const footPt = pFoot || [isLeft ? -0.052 : 0.052, -0.42, 0];
    const kneePt = pKnee || [footPt[0], footPt[1] + 0.174, footPt[2] + 0.01];
    const hipPt = pHip || [kneePt[0], kneePt[1] + 0.178, kneePt[2] - 0.01];

    const dThigh = norm3([kneePt[0] - hipPt[0], kneePt[1] - hipPt[1], kneePt[2] - hipPt[2]], [0, -1, 0]);
    const dCalf = norm3([footPt[0] - kneePt[0], footPt[1] - kneePt[1], footPt[2] - kneePt[2]], [0, -1, 0]);
    const uShin = [-dCalf[0], -dCalf[1], -dCalf[2]]; // points from ankle up toward knee

    // Anterior direction of thigh & calf (tracks leg swing without gimbal flip when leg kicks high)
    const antRef = [0, 0, 1];
    const dtA = dot3(antRef, dThigh);
    const tX = norm3([antRef[0] - dThigh[0] * dtA, antRef[1] - dThigh[1] * dtA, antRef[2] - dThigh[2] * dtA], [0, 1, 0]);
    const tY = norm3(cross3(dThigh, tX), [-1, 0, 0]);
    const thighBoneBasis = { zAxis: dThigh, xAxis: tX, yAxis: tY, latSign: -1.0 };

    const dcA = dot3(antRef, dCalf);
    const cX = norm3([antRef[0] - dCalf[0] * dcA, antRef[1] - dCalf[1] * dcA, antRef[2] - dCalf[2] * dcA], [0, 1, 0]);
    const cY = norm3(cross3(dCalf, cX), [-1, 0, 0]);
    const calfBoneBasis = { zAxis: dCalf, xAxis: cX, yAxis: cY, latSign: -1.0 };

    // Ankle & Foot Bone Basis:
    // Smoothly couples foot orientation to the shin bone (uShin) so high knee bends, jumps, swimming kicks,
    // boat sitting, and skill dashes tilt the foot naturally with the leg instead of locking to world +Z!
    const shinTilt = Math.acos(Math.max(-1.0, Math.min(1.0, uShin[1])));
    const defaultFollow = shinTilt > 0.22
      ? Math.min(0.72, 0.26 + (shinTilt - 0.22) * 0.48)
      : 0.26;
    const followBlend = (anklePose && typeof anklePose.shinFollow === "number")
      ? anklePose.shinFollow
      : defaultFollow;

    const footUp = norm3([
      uShin[0] * followBlend,
      (1.0 - followBlend) + uShin[1] * followBlend,
      uShin[2] * followBlend,
    ], [0, 1, 0]);
    const yawHint = (anklePose && typeof anklePose.yaw === "number") ? anklePose.yaw : 0.0;
    const rawFwd = [Math.sin(yawHint), 0, Math.cos(yawHint)];
    const dfU = dot3(rawFwd, footUp);
    let footFwd = norm3([rawFwd[0] - footUp[0] * dfU, rawFwd[1] - footUp[1] * dfU, rawFwd[2] - footUp[2] * dfU], [0, 0, 1]);
    let footRight = norm3(cross3(footUp, footFwd), [1, 0, 0]);

    if (anklePose && typeof anklePose.pitch === "number" && Math.abs(anklePose.pitch) > 1e-4) {
      const cp = Math.cos(anklePose.pitch), sp = Math.sin(anklePose.pitch);
      const nUp = norm3([footUp[0] * cp - footFwd[0] * sp, footUp[1] * cp - footFwd[1] * sp, footUp[2] * cp - footFwd[2] * sp], footUp);
      const nFwd = norm3([footUp[0] * sp + footFwd[0] * cp, footUp[1] * sp + footFwd[1] * cp, footUp[2] * sp + footFwd[2] * cp], footFwd);
      footFwd = nFwd;
      footRight = norm3(cross3(nUp, footFwd), footRight);
    }

    const ankleBoneBasis = {
      zAxis: [-footUp[0], -footUp[1], -footUp[2]],
      xAxis: footFwd,
      yAxis: [-footRight[0], -footRight[1], -footRight[2]],
      latSign: -1.0,
    };
    const footShaftBasis = {
      zAxis: footFwd,
      xAxis: footUp,
      yAxis: [-footRight[0], -footRight[1], -footRight[2]],
      latSign: -1.0,
    };

    return {
      dThigh,
      dCalf,
      uShin,
      thighBoneBasis,
      calfBoneBasis,
      footBoneBasis: {
        upAxis: footUp,
        fwdAxis: footFwd,
        rightAxis: footRight,
        ankleBoneBasis,
        footShaftBasis,
      },
    };
  }

  function buildFootAnkleToes(pKnee, pFoot, isLeft, scaleFactor, legRig = null) {
    const sf = scaleFactor;
    const sfKey = Math.round(sf * 1000);
    const rig = legRig || computeLegRigFrame(null, pKnee, pFoot, isLeft);
    const fb = rig.footBoneBasis;
    const fRight = fb.rightAxis;
    const fUp = fb.upAxis;
    const fFwd = fb.fwdAxis;

    const toFootPt = (rx, uy, fz) => [
      pFoot[0] + (fRight[0] * rx + fUp[0] * uy + fFwd[0] * fz) * sf,
      pFoot[1] + (fRight[1] * rx + fUp[1] * uy + fFwd[1] * fz) * sf,
      pFoot[2] + (fRight[2] * rx + fUp[2] * uy + fFwd[2] * fz) * sf,
    ];

    // 1. Sculpted Ankle & Heel Bridge (matches Calf end radius rAnkle = 0.0355 * sf seamlessly!)
    const heelBase = toFootPt(0.0, -0.012, -0.004);
    const ankle = generateSculptedCapsule(pFoot, heelBase, 14, 10, (u, angle, sinA, cosA, lat, ant, L) => {
      const loft = loftSeamlessJointShaft(u, L, 0.0355 * sf, 0.033 * sf);
      const r = (0.0355 - 0.0020 * loft.h) * sf * loft.capEnv;
      return { zPos: loft.zPos, rx: r * 1.02, ry: r * 1.00, shade: 0.962 };
    }, 9, "ankle_" + sfKey, fb.ankleBoneBasis);

    // 2. Sculpted Arched Chibi Foot Body (Heel -> Instep Bridge -> Widened Forefoot with Flat Sole)
    const footStart = toFootPt(0.0, -0.011, -0.006);
    const footTip = toFootPt(isLeft ? -0.002 : 0.002, -0.015, 0.042);
    const footBody = generateSculptedCapsule(footStart, footTip, 14, 10, (u, angle, sinA, cosA, lat, ant, L) => {
      const loft = loftSeamlessJointShaft(u, L, 0.029 * sf, 0.031 * sf);
      const h = loft.h;
      const rx = (0.028 + 0.007 * Math.pow(h, 0.8)) * sf * loft.capEnv;
      const ry = (0.024 - 0.005 * Math.pow(h, 0.9)) * sf * loft.capEnv;
      return { zPos: loft.zPos, rx, ry, shade: 0.962 };
    }, 9, "foot_" + sfKey, fb.footShaftBasis);

    const parts = [ankle, footBody];

    // 3. 5 Plump Rounded Chibi Toes along a natural forefoot arc (Big Toe on inner side -> Little Toe on outer side)
    const toeXOffsets = isLeft
      ? [0.014, 0.0065, -0.0005, -0.0072, -0.0132]
      : [-0.014, -0.0065, 0.0005, 0.0072, 0.0132];
    const toeZArc = [0.001, 0.003, 0.002, -0.0005, -0.0035];
    const toeLengths = [0.0145, 0.0130, 0.0118, 0.0102, 0.0085];
    const toeRadii = [0.0086, 0.0072, 0.0068, 0.0062, 0.0054];

    for (let t = 0; t < 5; t++) {
      const tx = toeXOffsets[t];
      const tz = toeZArc[t];
      const tlen = toeLengths[t];
      const trad = toeRadii[t] * sf;

      const tipRx = (isLeft ? -0.002 : 0.002) + tx;
      const tipUy = -0.016;
      const tipFz = 0.042 + tz;
      const tBase = toFootPt(tipRx, tipUy, tipFz);
      const tTip = toFootPt(tipRx + tx * 0.08, tipUy - 0.0025, tipFz + tlen);
      parts.push(
        generateSculptedCapsule(tBase, tTip, 8, 6, (u, angle, sinA, cosA, lat, ant, L) => {
          const r = trad * (0.94 + 0.10 * Math.sin(u * Math.PI));
          const zPos = sinA < 0 ? sinA * r * 0.75 : L + sinA * r * 0.85;
          const baseCrease = u < 0.35 ? (1.0 - u / 0.35) * 0.08 : 0.0;
          return {
            zPos,
            rx: r * cosA,
            ry: r * cosA * 0.88,
            shade: 0.96 - baseCrease,
          };
        }, 0, "toe_" + t + "_" + sfKey, fb.footShaftBasis)
      );
    }
    return parts;
  }

  // Unified Full-Body Skeletal Rig Solver (Spine/Head + Left/Right Arms/Hands + Left/Right Legs/Feet)
  function computeFullBodyRig(cfg) {
    const spineHead = computeSpineHeadRig(cfg.chestP1, cfg.chestP2, cfg.headP1, cfg.headP2, cfg.spinePose || null);
    const leftArm = computeHandGripFrame(cfg.leftElbowRot, cfg.leftHandRot, true, cfg.leftWristPose || null, cfg.leftArmPivot);
    const rightArm = computeHandGripFrame(cfg.rightElbowRot, cfg.rightHandRot, false, cfg.rightWristPose || null, cfg.rightArmPivot);
    const leftLeg = computeLegRigFrame(cfg.leftLegPivot, cfg.leftKneeRot, cfg.leftFootRot, true, cfg.leftAnklePose || null);
    const rightLeg = computeLegRigFrame(cfg.rightLegPivot, cfg.rightKneeRot, cfg.rightFootRot, false, cfg.rightAnklePose || null);
    return {
      spineHead,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
    };
  }

  // --- 6. Full Body Capsule Character Assembler (Used by Player & Clones) ---
  function buildCapsuleCharacterSegments(cfg) {
    const {
      chestP1, chestP2,
      pelvisP1, pelvisP2,
      neckP1, neckP2,
      headP1, headP2,
      leftEarP1, leftEarP2,
      rightEarP1, rightEarP2,
      leftArmPivot, leftElbowRot, leftHandRot,
      rightArmPivot, rightElbowRot, rightHandRot,
      leftLegPivot, leftKneeRot, leftFootRot,
      rightLegPivot, rightKneeRot, rightFootRot,
      bRadius = 0.0,
      scaleFactor = 1.0,
      leftHandGrip = 0.0,
      rightHandGrip = 0.0,
    } = cfg;

    const fullRig = computeFullBodyRig(cfg);

    const chest = generateChibiChest(chestP1, chestP2, (0.09 + bRadius) * scaleFactor, scaleFactor, fullRig.spineHead.torsoBoneBasis);
    const pelvis = generateChibiPelvis(pelvisP1, pelvisP2, (0.085 + bRadius) * scaleFactor, scaleFactor);
    const neck = generateChibiNeck(neckP1, neckP2, 0.048 * scaleFactor, scaleFactor);
    const head = generateChibiHead(headP1, headP2, 0.192 * scaleFactor, scaleFactor, fullRig.spineHead.headBoneBasis);
    const leftEar = generateChibiEar(leftEarP1, leftEarP2, true, scaleFactor, fullRig.spineHead.leftEarBoneBasis);
    const rightEar = generateChibiEar(rightEarP1, rightEarP2, false, scaleFactor, fullRig.spineHead.rightEarBoneBasis);

    const leftArmUpper = generateChibiUpperArm(leftArmPivot, leftElbowRot, true, scaleFactor, null, null, fullRig.leftArm.upperArmBoneBasis);
    const leftArmLower = generateChibiForeArm(leftElbowRot, leftHandRot, true, scaleFactor, fullRig.leftArm.forearmBoneBasis);
    const rightArmUpper = generateChibiUpperArm(rightArmPivot, rightElbowRot, false, scaleFactor, null, null, fullRig.rightArm.upperArmBoneBasis);
    const rightArmLower = generateChibiForeArm(rightElbowRot, rightHandRot, false, scaleFactor, fullRig.rightArm.forearmBoneBasis);

    const leftLegUpper = generateChibiThigh(leftLegPivot, leftKneeRot, true, scaleFactor, null, null, fullRig.leftLeg.thighBoneBasis);
    const leftLegLower = generateChibiCalf(leftKneeRot, leftFootRot, true, scaleFactor, null, fullRig.leftLeg.calfBoneBasis);
    const rightLegUpper = generateChibiThigh(rightLegPivot, rightKneeRot, false, scaleFactor, null, null, fullRig.rightLeg.thighBoneBasis);
    const rightLegLower = generateChibiCalf(rightKneeRot, rightFootRot, false, scaleFactor, null, fullRig.rightLeg.calfBoneBasis);

    const leftHandParts = buildHandAndFingers(leftElbowRot, leftHandRot, true, scaleFactor, leftHandGrip, cfg.leftWristPose || null, leftArmPivot);
    const rightHandParts = buildHandAndFingers(rightElbowRot, rightHandRot, false, scaleFactor, rightHandGrip, cfg.rightWristPose || null, rightArmPivot);
    const leftFootParts = buildFootAnkleToes(leftKneeRot, leftFootRot, true, scaleFactor, fullRig.leftLeg);
    const rightFootParts = buildFootAnkleToes(rightKneeRot, rightFootRot, false, scaleFactor, fullRig.rightLeg);

    return {
      fullRig,
      chest,
      pelvis,
      neck,
      head,
      leftEar,
      rightEar,
      leftArmUpper,
      leftArmLower,
      rightArmUpper,
      rightArmLower,
      leftLegUpper,
      leftLegLower,
      rightLegUpper,
      rightLegLower,
      handParts: [...leftHandParts, ...rightHandParts],
      footParts: [...leftFootParts, ...rightFootParts],
    };
  }

  // =========================================================================
  // --- 7. 3D Anime Hairstyles System (7 Unique Styles + Scalp Coverage) ---
  // Provides 100% full scalp coverage with multi-layered 3D anime hair strand generator,
  // angel ring highlights, zero-baldness dome, and natural strand orientation.
  // =========================================================================
  const ANIME_HAIR_COLORS = [
    [0.85, 0.90, 0.96], // 0: Platinum Silver / Ice Blue
    [0.18, 0.18, 0.22], // 1: Jet Black / Raven
    [0.88, 0.72, 0.52], // 2: Blonde Gold
    [0.72, 0.35, 0.22], // 3: Chestnut Brown
    [0.85, 0.45, 0.55], // 4: Sakura Pink
    [0.45, 0.65, 0.85], // 5: Sky Blue
    [0.55, 0.40, 0.70], // 6: Deep Purple
    [0.92, 0.93, 0.97], // 7: Pure White / Kemonomimi Silver
    [0.83, 0.76, 0.80], // 8: Sculpted Rose-Taupe / Clay Silver (ตามภาพต้นแบบหางม้า)
  ];

  const NUM_HAIR_STYLES = 9;

  const HAIR_STYLE_NAMES = [
    "1: Classic Bob & Fringe",
    "2: Detailed Anime Twin-Horn & Low-Tail",
    "3: Trendy Side-Swept Cut (ปัดข้าง)",
    "4: Twin Tails (Pigtails)",
    "5: High Ponytail & Sweep",
    "6: Elegant Center Parting (แสกกลาง)",
    "7: Long Flowing Cascade",
    "8: Sleek Center-Strand Cut (ทรงปอยกลางยาว)",
    "9: Sculpted Ribbed High Ponytail (ทรงมัดหางม้าสูงรวบตึง)"
  ];

  // =========================================================================
  // Exact 3D Chibi Head, Facial Shield & Neck Non-Penetration Surface Clamp
  // Prevents hair strands (all 9 hairstyles, both static & dynamic physics)
  // from ever sinking or clipping into generateChibiHead or the neck column.
  // =========================================================================
  function _evalUnitChibiHeadHullTo(sinLat, sinP, cosP, out) {
    const sLat = Math.max(-0.998, Math.min(0.998, sinLat));
    const cLat = Math.sqrt(Math.max(0.0, 1.0 - sLat * sLat));

    const isFront = Math.max(0.0, cosP);
    const isSide = Math.abs(sinP);
    const frontMask = Math.max(0.0, (cosP + 0.12) / 1.12);
    const centerFront = Math.pow(isFront, 1.35) * (1.0 - isSide * 0.62);
    const rawUFront = Math.max(0.0, (cosP + 0.22) / 1.22);
    const uJawPlateau = 1.0 - Math.pow(1.0 - rawUFront, 2.8);
    const uChinFront = Math.pow(isFront, 0.72) * (1.0 - Math.pow(isSide, 2.8) * 0.58);

    let ly;
    if (sLat >= 0.0) {
      ly = sLat * 0.94;
    } else {
      let backLy;
      if (sLat >= -0.74) {
        backLy = sLat * 0.80;
      } else {
        const tNape = (-sLat - 0.74) / 0.26;
        backLy = -(0.592 + 0.248 * Math.sin(tNape * Math.PI * 0.5));
      }
      let frontLy;
      if (sLat >= -0.74) {
        const tFace = -sLat / 0.74;
        const centerChinFlatten = Math.pow(isFront, 2.0) * (1.0 - isSide * 0.85) * Math.pow(tFace, 2.2) * 0.038;
        frontLy = -(0.81 * tFace - centerChinFlatten);
      } else {
        const tUnder = (-sLat - 0.74) / 0.26;
        frontLy = -(0.81 + 0.03 * Math.pow(tUnder, 1.1));
      }
      ly = frontLy * uJawPlateau + backLy * (1.0 - uJawPlateau);
    }

    const craniumR = cLat;
    const widthRatio = 0.80;
    const depthRatio = 0.80;

    const cheekBell = Math.exp(-Math.pow((sLat - (-0.34)) / 0.22, 2));
    const cheekBulge = 0.056 * cheekBell * frontMask * (isSide * 0.75 + isFront * 0.25);

    const uJawBell = (sLat < -0.08 && sLat > -0.84)
      ? Math.exp(-Math.pow((sLat - (-0.48)) / 0.24, 2))
      : 0.0;
    const uCheekFill = 1.0 + 0.19 * uJawBell * uJawPlateau * (0.35 + 0.65 * isSide);

    const chinCornerT = sLat < -0.62 ? Math.min(1.0, (-0.62 - sLat) / 0.16) : 0.0;
    const uCornerRound = 1.0 - 0.14 * Math.pow(chinCornerT, 2.2);

    const underJawT = sLat < -0.74 ? Math.min(1.0, (-0.74 - sLat) / 0.26) : 0.0;
    const throatTaper = 1.0 - Math.pow(underJawT, 1.35) * 0.44;

    const neckConvergence = sLat < -0.68 ? Math.min(1.0, (-0.68 - sLat) / 0.32) : 0.0;
    const craniumShiftZ = -0.095 * (1.0 - neckConvergence * 0.75);

    // Convex facial shield: omit concave eyeSocketIndent so bangs/side-locks never dip into eye sockets
    const nosePeakBell = Math.exp(-Math.pow((sLat - (-0.36)) / 0.12, 2));
    const cheekForwardBell = Math.exp(-Math.pow((sLat - (-0.38)) / 0.18, 2));
    const noseCheekOutward = 0.046 * nosePeakBell * centerFront + 0.038 * cheekForwardBell * uChinFront;

    const uDepthSquaring = sLat < -0.22 && sLat > -0.78
      ? Math.sin(Math.min(1.0, (-sLat - 0.22) / 0.54) * Math.PI * 0.85)
      : 0.0;
    const flatUFrontCosP = cosP + uDepthSquaring * (0.42 * sinP * sinP * Math.pow(isFront, 1.35));

    let lowerChinSupport = 0.0;
    if (sLat < -0.36 && sLat >= -0.74) {
      const tChin = (-sLat - 0.36) / 0.38;
      lowerChinSupport = 0.048 * Math.sin(tChin * Math.PI * 0.65) * uChinFront;
    } else if (sLat < -0.74) {
      const tUnder = Math.min(1.0, (-sLat - 0.74) / 0.22);
      lowerChinSupport = 0.042 * Math.pow(1.0 - tUnder, 1.8) * uChinFront;
    }

    const mouthMoundBell = Math.exp(-Math.pow((sLat - (-0.52)) / 0.065, 2));
    const chinTipBell = Math.exp(-Math.pow((sLat - (-0.70)) / 0.075, 2));
    const mouthChinConvex = 0.020 * mouthMoundBell * centerFront + 0.028 * chinTipBell * uChinFront;

    out[0] = craniumR * sinP * widthRatio * (1.0 + cheekBulge) * uCheekFill * uCornerRound * throatTaper;
    out[1] = ly;
    out[2] = craniumShiftZ + craniumR * flatUFrontCosP * depthRatio * throatTaper + noseCheekOutward + lowerChinSupport + mouthChinConvex;
    return out;
  }

  function evalUnitChibiHeadHull(sinLat, sinP, cosP) {
    return _evalUnitChibiHeadHullTo(sinLat, sinP, cosP, [0, 0, 0]);
  }

  const _hullScratch = [0, 0, 0];

  function clampPointOutsideChibiHead(x, y, z, headRadius = 0.192, clearance = 0.0035, skipTorsoCone = false) {
    const r = headRadius > 0.0001 ? headRadius : 0.192;
    const invR = 1.0 / r;
    let ux = x * invR;
    let uy = y * invR;
    let uz = z * invR;
    const uClear = clearance * invR;

    // 1. 3D Sculpted Chibi Head Hull Check (Crown, Forehead, Eyes/Cheeks, U-Jaw, Temples, Occipital Skull)
    if (uy >= -0.88) {
      const Cx = 0.0;
      const Cy = -0.05;
      const Cz = -0.085;
      const vx = ux - Cx;
      const vy = uy - Cy;
      const vz = uz - Cz;
      const dist = Math.hypot(vx, vy, vz);

      if (dist > 1e-6) {
        const ex = vx / 0.80;
        const ey = vy / 0.88;
        const ez = vz / 0.80;
        const eLen = Math.hypot(ex, ey, ez) || 1.0;
        let sinLat = Math.max(-0.998, Math.min(0.998, ey / eLen));
        const hLen = Math.hypot(ex, ez);
        const sinP = hLen > 1e-6 ? ex / hLen : 0.0;
        const cosP = hLen > 1e-6 ? ez / hLen : 1.0;

        _evalUnitChibiHeadHullTo(sinLat, sinP, cosP, _hullScratch);
        const d0 = Math.hypot(_hullScratch[0] - Cx, _hullScratch[1] - Cy, _hullScratch[2] - Cz) || 1.0;
        const errY = (vy / dist) - ((_hullScratch[1] - Cy) / d0);
        sinLat = Math.max(-0.998, Math.min(0.998, sinLat + errY * 1.08));

        _evalUnitChibiHeadHullTo(sinLat, sinP, cosP, _hullScratch);
        const rHead = Math.hypot(_hullScratch[0] - Cx, _hullScratch[1] - Cy, _hullScratch[2] - Cz);
        const minDist = rHead + uClear;

        if (dist < minDist) {
          const scaleOut = minDist / dist;
          ux = Cx + vx * scaleOut;
          uy = Cy + vy * scaleOut;
          uz = Cz + vz * scaleOut;
        }
      }
    }

    // 2. Neck & Upper Shoulder Column Check (prevents long side/back/ponytail locks from clipping into neck/chest)
    // When skipTorsoCone is true (e.g. clothing clamp that already runs the exact torso collider), limit to the neck column only.
    const minNeckUy = skipTorsoCone ? -1.08 : -2.20;
    if (uy < -0.68 && uy > minNeckUy) {
      const neckCz = -0.09;
      const rNeck = (skipTorsoCone || uy >= -1.12)
        ? 0.35
        : Math.min(0.66, 0.35 + (-1.12 - uy) * 0.52);
      const nDx = ux;
      const nDz = uz - neckCz;
      const nDist = Math.hypot(nDx, nDz);
      const minNeckDist = rNeck + uClear;
      if (nDist < minNeckDist) {
        if (nDist > 1e-6) {
          const pushNeck = minNeckDist / nDist;
          ux = nDx * pushNeck;
          uz = neckCz + nDz * pushNeck;
        } else {
          uz = neckCz - minNeckDist;
        }
      }
    }

    return [ux * r, uy * r, uz * r];
  }

  // =========================================================================
  // Unified Chibi Body & Limb Non-Penetration Surface Clamp for Clothing & Hair
  // Uses the exact same clampPointOutsideChibiHead hull check + exact torso
  // elliptical profile + arm & leg capsule pushout so dynamic clothes/hoodie
  // never sink into the character's head, face, neck, torso, arms, or legs!
  // =========================================================================
  function clampPointOutsideSegmentCapsule(px, py, pz, a, b, radA, radB, clearance = 0.006, pushHint = null) {
    if (!a || !b) return [px, py, pz];
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const abz = b[2] - a[2];
    const lenSq = abx * abx + aby * aby + abz * abz;
    let t = 0.0;
    if (lenSq > 1e-8) {
      t = ((px - a[0]) * abx + (py - a[1]) * aby + (pz - a[2]) * abz) / lenSq;
      if (t < 0.0) t = 0.0;
      else if (t > 1.0) t = 1.0;
    }
    const cx = a[0] + abx * t;
    const cy = a[1] + aby * t;
    const cz = a[2] + abz * t;
    let dx = px - cx;
    let dy = py - cy;
    let dz = pz - cz;
    let dist = Math.hypot(dx, dy, dz);
    const minR = (radA * (1.0 - t) + radB * t) + clearance;
    if (dist < minR) {
      if (pushHint) {
        const hx = pushHint[0] || 0.0;
        const hz = pushHint[2] || 0.0;
        const hLen = Math.hypot(hx, hz);
        if (hLen > 1e-4) {
          const nhx = hx / hLen;
          const nhz = hz / hLen;
          if (dist < 1e-5) {
            dx = nhx;
            dy = 0.0;
            dz = nhz;
            dist = 1.0;
          } else {
            const dotH = dx * nhx + dz * nhz;
            const minForwardDot = dist * 0.30;
            if (dotH < minForwardDot) {
              const boost = (minForwardDot - dotH);
              dx += nhx * boost;
              dz += nhz * boost;
              dist = Math.hypot(dx, dy, dz) || 1.0;
            }
          }
        }
      }
      if (dist > 1e-6) {
        const push = minR / dist;
        return [cx + dx * push, cy + dy * push, cz + dz * push];
      }
      return [cx, cy, cz + minR];
    }
    return [px, py, pz];
  }

  function _getCachedTorsoFrame(bodyData) {
    const p1 = bodyData.chestP1;
    const p2 = bodyData.chestP2;
    if (!p1 || !p2) return null;
    const c = bodyData._torsoCache;
    if (
      c &&
      c.p1x === p1[0] && c.p1y === p1[1] && c.p1z === p1[2] &&
      c.p2x === p2[0] && c.p2y === p2[1] && c.p2z === p2[2]
    ) {
      return c;
    }
    const ax = p2[0] - p1[0];
    const ay = p2[1] - p1[1];
    const az = p2[2] - p1[2];
    const L = Math.hypot(ax, ay, az);
    if (L <= 1e-5) return null;
    const dAxis = [ax / L, ay / L, az / L];
    const fDot = dAxis[2];
    let frontAxis = [-dAxis[0] * fDot, -dAxis[1] * fDot, 1.0 - dAxis[2] * fDot];
    const fLen = Math.hypot(frontAxis[0], frontAxis[1], frontAxis[2]);
    if (fLen < 1e-4) {
      frontAxis = [0, 0, 1];
    } else {
      frontAxis = [frontAxis[0] / fLen, frontAxis[1] / fLen, frontAxis[2] / fLen];
    }
    const rightAxis = [
      frontAxis[1] * dAxis[2] - frontAxis[2] * dAxis[1],
      frontAxis[2] * dAxis[0] - frontAxis[0] * dAxis[2],
      frontAxis[0] * dAxis[1] - frontAxis[1] * dAxis[0]
    ];
    const cache = {
      p1x: p1[0], p1y: p1[1], p1z: p1[2],
      p2x: p2[0], p2y: p2[1], p2z: p2[2],
      L,
      dAxis,
      frontAxis,
      rightAxis
    };
    bodyData._torsoCache = cache;
    return cache;
  }

  function clampPointOutsideChibiBodyForCloth(px, py, pz, bodyData, clearance = 0.008, includeArms = true, pushHint = null) {
    if (!bodyData) return [px, py, pz];
    const s = bodyData.scale || 1.0;
    let x = px;
    let y = py;
    let z = pz;

    // 1. Exact Chibi Head & Upper Neck check (skip oversized shoulder cone when torso ellipse collider is active)
    if (bodyData.headP1) {
      const h1 = bodyData.headP1;
      const hx = (x - h1[0]) / s;
      const hy = (y - h1[1]) / s;
      const hz = (z - h1[2]) / s;
      const hasTorsoCollider = !!(bodyData.chestP1 && bodyData.chestP2);
      const clampedH = clampPointOutsideChibiHead(hx, hy, hz, 0.192, clearance, hasTorsoCollider);
      x = h1[0] + clampedH[0] * s;
      y = h1[1] + clampedH[1] * s;
      z = h1[2] + clampedH[2] * s;
    }

    // 2. Sculpted Chibi Torso Ellipse (chest, belly, waist, hips, glutes, shoulders)
    const torsoFrame = _getCachedTorsoFrame(bodyData);
    if (torsoFrame) {
      const p1 = bodyData.chestP1;
      const { L, dAxis, frontAxis, rightAxis } = torsoFrame;
      const proj = (x - p1[0]) * dAxis[0] + (y - p1[1]) * dAxis[1] + (z - p1[2]) * dAxis[2];
      const hRaw = proj / (0.96 * L);
      if (hRaw >= -0.06 && hRaw <= 1.06) {
        const h = Math.max(0.0, Math.min(1.0, hRaw));
        const hipBell = Math.exp(-Math.pow((h - 0.20) / 0.18, 2));
        const waistTaper = Math.exp(-Math.pow((h - 0.46) / 0.15, 2));
        const shoulderBell = Math.exp(-Math.pow((h - 0.84) / 0.13, 2));
        let rx = (0.081 + 0.024 * hipBell - 0.013 * waistTaper + 0.023 * shoulderBell) * s;
        if (h > 0.86) {
          const collarT = (h - 0.86) / 0.14;
          const sCollar = collarT * collarT * (3.0 - 2.0 * collarT);
          rx = rx * (1.0 - sCollar) + (0.058 * s) * sCollar;
        }

        const relX = x - (p1[0] + dAxis[0] * proj);
        const relY = y - (p1[1] + dAxis[1] * proj);
        const relZ = z - (p1[2] + dAxis[2] * proj);
        const uLat = relX * rightAxis[0] + relY * rightAxis[1] + relZ * rightAxis[2];
        const uAnt = relX * frontAxis[0] + relY * frontAxis[1] + relZ * frontAxis[2];
        const rad2D = Math.hypot(uLat, uAnt);
        const antNorm = rad2D > 1e-5 ? (uAnt / rad2D) : 0.0;
        const latNorm = rad2D > 1e-5 ? (uLat / rad2D) : 1.0;

        const wFront = Math.max(0.0, antNorm);
        const wBack = Math.max(0.0, -antNorm);
        const frontChestPuff = Math.exp(-Math.pow((h - 0.72) / 0.16, 2)) * 0.015 * s;
        const frontTummyPuff = Math.exp(-Math.pow((h - 0.36) / 0.18, 2)) * 0.008 * s;
        const hipSocketFrontFill = Math.exp(-Math.pow((h - 0.14) / 0.14, 2)) * (0.006 + 0.006 * Math.abs(latNorm)) * s;
        const frontDepth = (0.059 + frontChestPuff + frontTummyPuff + hipSocketFrontFill - 0.005 * waistTaper) * s;

        const backUpperFlat = Math.exp(-Math.pow((h - 0.72) / 0.18, 2)) * 0.006 * s;
        const backLumbarArch = Math.exp(-Math.pow((h - 0.46) / 0.14, 2)) * 0.007 * s;
        const backGluteSwell = Math.exp(-Math.pow((h - 0.20) / 0.16, 2)) * (0.022 + 0.005 * Math.abs(latNorm)) * s;
        const backDepth = (0.059 - backUpperFlat - backLumbarArch + backGluteSwell - 0.004 * waistTaper) * s;

        let ry = frontDepth * wFront + backDepth * wBack + (0.059 - 0.005 * waistTaper) * s * (1.0 - wFront - wBack);
        if (h > 0.86) {
          const collarT = (h - 0.86) / 0.14;
          const sCollar = collarT * collarT * (3.0 - 2.0 * collarT);
          ry = ry * (1.0 - sCollar) + (0.052 * s) * sCollar;
        }
        const cyOff = wFront * (frontTummyPuff * 0.28) - wBack * (backGluteSwell * 0.32 + backLumbarArch * 0.22);

        const rxPad = rx + clearance * s;
        const ryPad = ry + clearance * s;
        const ex = uLat / rxPad;
        const ey = (uAnt - cyOff) / ryPad;
        const eDist = Math.hypot(ex, ey);
        if (eDist < 1.0) {
          const invE = eDist > 1e-5 ? (1.0 / eDist) : 1.0;
          const pushLat = (eDist > 1e-5 ? ex * invE : 0.0) * rxPad;
          const pushAnt = cyOff + (eDist > 1e-5 ? ey * invE : -1.0) * ryPad;
          x = p1[0] + dAxis[0] * proj + rightAxis[0] * pushLat + frontAxis[0] * pushAnt;
          y = p1[1] + dAxis[1] * proj + rightAxis[1] * pushLat + frontAxis[1] * pushAnt;
          z = p1[2] + dAxis[2] * proj + rightAxis[2] * pushLat + frontAxis[2] * pushAnt;
        }
      }
    }

    // 3. Arms & Forearms Capsule Pushout
    if (includeArms) {
      const arms = [
        [bodyData.leftArmPivot, bodyData.leftElbowRot, 0.043 * s, 0.036 * s],
        [bodyData.leftElbowRot, bodyData.leftHandRot, 0.036 * s, 0.027 * s],
        [bodyData.rightArmPivot, bodyData.rightElbowRot, 0.043 * s, 0.036 * s],
        [bodyData.rightElbowRot, bodyData.rightHandRot, 0.036 * s, 0.027 * s]
      ];
      for (let i = 0; i < arms.length; i++) {
        const seg = arms[i];
        if (seg[0] && seg[1]) {
          const c = clampPointOutsideSegmentCapsule(x, y, z, seg[0], seg[1], seg[2], seg[3], clearance * s, pushHint);
          x = c[0]; y = c[1]; z = c[2];
        }
      }
    }

    // 4. Thighs & Calves Capsule Pushout
    const legBoost = (bodyData.legRadiusBoost || 0.0) * s;
    const legs = [
      [bodyData.leftLegPivot, bodyData.leftKneeRot, 0.056 * s + legBoost, 0.0445 * s + legBoost * 0.85],
      [bodyData.leftKneeRot, bodyData.leftFootRot, 0.0445 * s + legBoost * 0.85, 0.0365 * s + legBoost * 0.70],
      [bodyData.rightLegPivot, bodyData.rightKneeRot, 0.056 * s + legBoost, 0.0445 * s + legBoost * 0.85],
      [bodyData.rightKneeRot, bodyData.rightFootRot, 0.0445 * s + legBoost * 0.85, 0.0365 * s + legBoost * 0.70]
    ];
    for (let i = 0; i < legs.length; i++) {
      const seg = legs[i];
      if (seg[0] && seg[1]) {
        const c = clampPointOutsideSegmentCapsule(x, y, z, seg[0], seg[1], seg[2], seg[3], clearance * s, pushHint);
        x = c[0]; y = c[1]; z = c[2];
      }
    }

    return [x, y, z];
  }

  function build3DAnimeHair(
    styleIdx,
    color,
    scale,
    ptTransformFn,
    headTilt,
    outV,
    outC,
    outI,
    outF
  ) {
    const colBase = (color && Array.isArray(color) && color.length >= 3)
      ? [color[0], color[1], color[2]]
      : [0.85, 0.90, 0.96]; // Default Silver/Platinum

    const bo = headTilt || 0;

    // Clean anime hair color ramp: rich crease shadows + silky highlight sheen
    const computeAnimeHairColor = (rgb, shadeFactor = 1.0, highlightBoost = 0.0, grooveDarken = 0.0) => {
      const grooveMul = Math.max(0.38, 1.0 - grooveDarken);
      const shadowR = rgb[0] * grooveMul * (1.0 - grooveDarken * 0.10);
      const shadowG = rgb[1] * grooveMul * (1.0 - grooveDarken * 0.06);
      const shadowB = rgb[2] * grooveMul * (1.0 + grooveDarken * 0.08);

      let r = shadowR * shadeFactor;
      let g = shadowG * shadeFactor;
      let b = shadowB * shadeFactor;

      if (highlightBoost > 0.0) {
        const sheenR = Math.min(1.0, rgb[0] * 1.42 + 0.24);
        const sheenG = Math.min(1.0, rgb[1] * 1.42 + 0.24);
        const sheenB = Math.min(1.0, rgb[2] * 1.48 + 0.28);
        const k = Math.min(0.60, highlightBoost);
        r = r * (1.0 - k) + sheenR * k;
        g = g * (1.0 - k) + sheenG * k;
        b = b * (1.0 - k) + sheenB * k;
      }

      return [
        Math.min(1.0, Math.max(0.0, r)),
        Math.min(1.0, Math.max(0.0, g)),
        Math.min(1.0, Math.max(0.0, b)),
      ];
    };

    const addVertex = (localP, shadeFactor = 1.0, highlightBoost = 0.0, flexWeight = 0.0, grooveDarken = 0.0) => {
      const p = ptTransformFn(localP[0], localP[1] + bo, localP[2]);
      const vIdx = outV.length / 3;
      outV.push(p[0], p[1], p[2]);

      const [r, g, b] = computeAnimeHairColor(colBase, shadeFactor, highlightBoost, grooveDarken);
      outC.push(r, g, b);
      if (outF) outF.push(flexWeight);
      return vIdx;
    };

    const addTri = (v1, v2, v3) => {
      outI.push(v1, v2, v3);
    };

    const addQuad = (v1, v2, v3, v4) => {
      outI.push(v1, v2, v3);
      outI.push(v1, v3, v4);
    };

    const getHairlineMinElevation = (azDeg) => {
      let az = azDeg;
      while (az > 180) az -= 360;
      while (az < -180) az += 360;
      const absAz = Math.abs(az);

      // 1. Front Forehead (0..44 deg): Clean natural hairline above forehead (44 deg -> 18 deg)
      if (absAz < 44) {
        const t = absAz / 44;
        return 44.0 - 26.0 * (t * t);
      }
      // 2. Temple & Sideburn in front of Ear (44..78 deg): Dips down to -20 deg
      else if (absAz < 78) {
        const t = (absAz - 44) / 34;
        const s = t * t * (3 - 2 * t);
        return 18.0 - 38.0 * s;
      }
      // 3. Around Ear Arch (78..96 deg)
      else if (absAz < 96) {
        const t = (absAz - 78) / 18;
        return -20.0 + Math.sin(t * Math.PI) * 14.0 - 12.0 * t;
      }
      // 4. Behind Ear & Full Nape of Neck (96..180 deg): Hugs Chibi nape at -44 deg (never hangs below jaw!)
      else {
        const t = Math.min(1.0, (absAz - 96) / 32);
        const s = t * t * (3 - 2 * t);
        return -32.0 - 12.0 * s;
      }
    };

    // Maps hair roots & scalp dome 1:1 onto the exact generateChibiHead surface with outward normal clearance
    // so neither the scalp dome nor any beveled hair lock ever clips into the Chibi skull!
    const getHairRoot = (azimuthDeg, elevationDeg, radiusOffset = 0.002, clampToHairline = false) => {
      const safeEl = clampToHairline
        ? Math.max(elevationDeg, getHairlineMinElevation(azimuthDeg))
        : elevationDeg;

      const az = (azimuthDeg * Math.PI) / 180;
      const el = (safeEl * Math.PI) / 180;

      const cosLat = Math.cos(el);
      const sinLat = Math.sin(el);
      const sinP = Math.sin(az); // +1 = Right (+X), -1 = Left (-X)
      const cosP = Math.cos(az); // +1 = Front (+Z), -1 = Back (-Z)

      const isFront = Math.max(0.0, cosP);
      const isSide = Math.abs(sinP);
      const frontMask = Math.max(0.0, (cosP + 0.12) / 1.12);
      const centerFront = Math.pow(isFront, 1.35) * (1.0 - isSide * 0.62);
      const rawUFront = Math.max(0.0, (cosP + 0.22) / 1.22);
      const uJawPlateau = 1.0 - Math.pow(1.0 - rawUFront, 2.8);
      const uChinFront = Math.pow(isFront, 0.72) * (1.0 - Math.pow(isSide, 2.8) * 0.58);

      // Exact 0.240 reference space matching generateChibiHead 1:1
      const r = 0.240;
      let ly;
      if (sinLat >= 0.0) {
        ly = sinLat * (r * 0.94);
      } else {
        let backLy;
        if (sinLat >= -0.74) {
          backLy = sinLat * (r * 0.80);
        } else {
          const tNape = (-sinLat - 0.74) / 0.26;
          backLy = -r * (0.592 + 0.248 * Math.sin(tNape * Math.PI * 0.5));
        }
        let frontLy;
        if (sinLat >= -0.74) {
          const tFace = -sinLat / 0.74;
          const centerChinFlatten = Math.pow(isFront, 2.0) * (1.0 - isSide * 0.85) * Math.pow(tFace, 2.2) * 0.038;
          frontLy = -r * (0.81 * tFace - centerChinFlatten);
        } else {
          const tUnder = (-sinLat - 0.74) / 0.26;
          frontLy = -r * (0.81 + 0.03 * Math.pow(tUnder, 1.1));
        }
        ly = frontLy * uJawPlateau + backLy * (1.0 - uJawPlateau);
      }

      const craniumR = r * cosLat;
      const widthRatio = 0.80;
      const depthRatio = 0.80;

      const cheekBell = Math.exp(-Math.pow((sinLat - (-0.34)) / 0.22, 2));
      const cheekBulge = 0.056 * cheekBell * frontMask * (isSide * 0.75 + isFront * 0.25);

      const uJawBell = (sinLat < -0.08 && sinLat > -0.84)
        ? Math.exp(-Math.pow((sinLat - (-0.48)) / 0.24, 2))
        : 0.0;
      const uCheekFill = 1.0 + 0.19 * uJawBell * uJawPlateau * (0.35 + 0.65 * isSide);

      const chinCornerT = sinLat < -0.62 ? Math.min(1.0, (-0.62 - sinLat) / 0.16) : 0.0;
      const uCornerRound = 1.0 - 0.14 * Math.pow(chinCornerT, 2.2);

      const underJawT = sinLat < -0.74 ? Math.min(1.0, (-0.74 - sinLat) / 0.26) : 0.0;
      const throatTaper = 1.0 - Math.pow(underJawT, 1.35) * 0.44;

      const neckConvergence = sinLat < -0.68 ? Math.min(1.0, (-0.68 - sinLat) / 0.32) : 0.0;
      const craniumShiftZ = -r * 0.095 * (1.0 - neckConvergence * 0.75);

      const eyeSocketBell = Math.exp(-Math.pow((sinLat - (-0.10)) / 0.17, 2));
      const eyeSocketIndent = -r * 0.042 * eyeSocketBell * isFront * (1.0 - isSide * 0.45);

      const nosePeakBell = Math.exp(-Math.pow((sinLat - (-0.36)) / 0.12, 2));
      const cheekForwardBell = Math.exp(-Math.pow((sinLat - (-0.38)) / 0.18, 2));
      const noseCheekOutward = r * (0.046 * nosePeakBell * centerFront + 0.038 * cheekForwardBell * uChinFront);

      const uDepthSquaring = sinLat < -0.22 && sinLat > -0.78
        ? Math.sin(Math.min(1.0, (-sinLat - 0.22) / 0.54) * Math.PI * 0.85)
        : 0.0;
      const flatUFrontCosP = cosP + uDepthSquaring * (0.42 * sinP * sinP * Math.pow(isFront, 1.35));

      let lowerChinSupport = 0.0;
      if (sinLat < -0.36 && sinLat >= -0.74) {
        const tChin = (-sinLat - 0.36) / 0.38;
        lowerChinSupport = r * 0.048 * Math.sin(tChin * Math.PI * 0.65) * uChinFront;
      } else if (sinLat < -0.74) {
        const tUnder = Math.min(1.0, (-sinLat - 0.74) / 0.22);
        lowerChinSupport = r * 0.042 * Math.pow(1.0 - tUnder, 1.8) * uChinFront;
      }

      const lx = craniumR * sinP * widthRatio * (1.0 + cheekBulge) * uCheekFill * uCornerRound * throatTaper;
      const lz = craniumShiftZ + craniumR * flatUFrontCosP * depthRatio * throatTaper + eyeSocketIndent + noseCheekOutward + lowerChinSupport;

      const rawNx = lx / widthRatio;
      const rawNy = ly / (sinLat < 0 ? 0.81 : 0.94);
      const rawNz = (lz - craniumShiftZ) / depthRatio;
      const nLen = Math.hypot(rawNx, rawNy, rawNz) || 1.0;
      const nx = rawNx / nLen;
      const ny = rawNy / nLen;
      const nz = rawNz / nLen;

      // Guarantee positive outward scalp clearance so hair never clips inside the skull
      const outLift = 0.0062 + radiusOffset * 0.82;

      return {
        p: [lx + nx * outLift, ly + ny * outLift, lz + nz * outLift],
        n: [nx, ny, nz],
        azDeg: azimuthDeg,
        elDeg: safeEl,
      };
    };

    // Seamless hair-colored under-scalp dome contoured 1:1 to the Chibi Head skull
    const addSolidHairDome = () => {
      const nLon = 48;
      const nLat = 14;
      const grid = [];
      const rimInnerRow = [];

      for (let lon = 0; lon <= nLon; lon++) {
        const azDeg = -180 + (lon / nLon) * 360;
        const minEl = getHairlineMinElevation(azDeg);
        const maxEl = 88.5;

        const innerRoot = getHairRoot(azDeg, minEl, -0.0020, false);
        rimInnerRow.push(addVertex(innerRoot.p, 0.88, 0.0, 0.0, 0.06));

        const col = [];
        for (let lat = 0; lat <= nLat; lat++) {
          const u = lat / nLat;
          const elDeg = minEl + u * (maxEl - minEl);
          const domeOffset = 0.0020 + 0.0022 * Math.sin(u * Math.PI * 0.5);
          const root = getHairRoot(azDeg, elDeg, domeOffset, false);
          col.push(addVertex(root.p, 0.90 + 0.06 * u, 0.0, 0.0, 0.05));
        }
        grid.push(col);
      }

      for (let lon = 0; lon < nLon; lon++) {
        addQuad(rimInnerRow[lon], rimInnerRow[lon + 1], grid[lon + 1][0], grid[lon][0]);
      }

      for (let lon = 0; lon < nLon; lon++) {
        for (let lat = 0; lat < nLat; lat++) {
          addQuad(grid[lon][lat], grid[lon + 1][lat], grid[lon + 1][lat + 1], grid[lon][lat + 1]);
        }
      }

      const topRoot = getHairRoot(0, 89.5, 0.0035, false);
      const vZenith = addVertex(topRoot.p, 0.94, 0.0, 0.0, 0.05);
      for (let lon = 0; lon < nLon; lon++) {
        addTri(grid[lon][nLat], grid[lon + 1][nLat], vZenith);
      }
    };

    // =========================================================================
    // Hard-Creased Beveled 3D Curve Strand Builder (Blender Curve Hair Standard)
    // =========================================================================
    // Uses split vertex indices across longitudinal bevel ridges & V-grooves so
    // `calculateNormals` keeps every ridge/groove razor-sharp laterally while
    // interpolating 100% smoothly from root to tip!
    const buildBeveledCurveStrand = (
      samples,
      wStart,
      wMid,
      thick,
      shadeRoot = 0.92,
      shadeTip = 1.04,
      overrideRgb = null,
      profileType = "double", // "double" (2 sharp ridges + center V-cut) or "single" (1 sharp diamond ridge)
      taperStart = 0.55,
      swellEnd = 0.18
    ) => {
      const steps = samples.length - 1;
      if (steps < 1) return;

      const rgb = overrideRgb || colBase;

      // Define cross-section bevel facets: each facet [uL, hL, shadeL, grooveL, uR, hR, shadeR, grooveR]
      // has its own dedicated longitudinal vertex strip so normals never blur across sharp creases!
      const facetDefs = (profileType === "single")
        ? [
            // Sharp Diamond Single-Ridge Profile (like outer wisps, side-flicks & nape feathers in image_71741f02)
            { xL: -1.00, yL: -0.22, bL: 0.00, gL: 0.26,  xR:  0.00, yR:  1.18, bR: 0.12, gR: 0.00 }, // Left bevel slope -> Center sharp ridge
            { xL:  0.00, yL:  1.18, bL: 0.08, gL: 0.04,  xR:  1.00, yR: -0.22, bR: 0.00, gR: 0.26 }, // Center sharp ridge -> Right bevel slope
            { xL:  1.00, yL: -0.22, bL: 0.00, gL: 0.30,  xR:  0.00, yR: -0.46, bR: 0.00, gR: 0.38 }, // Underside right
            { xL:  0.00, yL: -0.46, bL: 0.00, gL: 0.38,  xR: -1.00, yR: -0.22, bR: 0.00, gR: 0.30 }, // Underside left
          ]
        : [
            // Sculpted Double-Ridge W-Bevel Profile (2 sharp peaks + deep carved V-groove in the middle)
            { xL: -1.00, yL: -0.24, bL: 0.00, gL: 0.28,  xR: -0.34, yR:  1.04, bR: 0.11, gR: 0.00 }, // Left outer bevel -> Left peak
            { xL: -0.34, yL:  1.04, bL: 0.05, gL: 0.06,  xR:  0.02, yR:  0.16, bR: 0.00, gR: 0.26 }, // Left peak -> Deep V-groove
            { xL:  0.02, yL:  0.16, bL: 0.00, gL: 0.26,  xR:  0.38, yR:  1.14, bR: 0.13, gR: 0.00 }, // Deep V-groove -> Right main peak
            { xL:  0.38, yL:  1.14, bL: 0.08, gL: 0.04,  xR:  1.00, yR: -0.24, bR: 0.00, gR: 0.28 }, // Right main peak -> Right outer bevel
            { xL:  1.00, yL: -0.24, bL: 0.00, gL: 0.32,  xR:  0.00, yR: -0.46, bR: 0.00, gR: 0.40 }, // Underside right
            { xL:  0.00, yL: -0.46, bL: 0.00, gL: 0.40,  xR: -1.00, yR: -0.24, bR: 0.00, gR: 0.32 }, // Underside left
          ];

      const numFacets = facetDefs.length;
      const facetStrips = Array.from({ length: numFacets }, () => []);

      // Pre-clamp all spine sample points outside the 3D Chibi Head & Neck hull so tangents T & normals StrandN
      // smoothly follow the forehead, cheeks, jaw, temples, and nape without ever cutting inside the head!
      for (let s = 0; s <= steps; s++) {
        const u = samples[s].u;
        const tCur = Math.sin(Math.min(1.0, u * 1.08) * Math.PI * 0.5 + 0.36) * Math.pow(Math.max(0.0, 1.0 - u), 0.65) * thick;
        const spineClear = (s === 0) ? 0.0040 : (0.0052 + tCur * 0.38);
        samples[s].p = clampPointOutsideChibiHead(samples[s].p[0], samples[s].p[1], samples[s].p[2], 0.240, spineClear);
      }

      for (let s = 0; s <= steps; s++) {
        const samp = samples[s];
        const u = samp.u;
        const currP = samp.p;
        const N = samp.n;
        const twist = samp.twist || 0.0;

        let tx, ty, tz;
        if (s < steps) {
          tx = samples[s + 1].p[0] - currP[0];
          ty = samples[s + 1].p[1] - currP[1];
          tz = samples[s + 1].p[2] - currP[2];
        } else {
          tx = currP[0] - samples[s - 1].p[0];
          ty = currP[1] - samples[s - 1].p[1];
          tz = currP[2] - samples[s - 1].p[2];
        }
        const tLen = Math.hypot(tx, ty, tz) || 1;
        const T = [tx / tLen, ty / tLen, tz / tLen];

        let bx = N[1] * T[2] - N[2] * T[1];
        let by = N[2] * T[0] - N[0] * T[2];
        let bz = N[0] * T[1] - N[1] * T[0];
        let bLen = Math.hypot(bx, by, bz);
        if (bLen < 0.001) {
          bx = 1; by = 0; bz = 0; bLen = 1;
        }
        const B0 = [bx / bLen, by / bLen, bz / bLen];
        const N0 = [
          T[1] * B0[2] - T[2] * B0[1],
          T[2] * B0[0] - T[0] * B0[2],
          T[0] * B0[1] - T[1] * B0[0],
        ];

        // Apply optional strand axial twist so curved locks tilt naturally into the light
        const cosTw = Math.cos(twist);
        const sinTw = Math.sin(twist);
        const B = [
          B0[0] * cosTw + N0[0] * sinTw,
          B0[1] * cosTw + N0[1] * sinTw,
          B0[2] * cosTw + N0[2] * sinTw,
        ];
        const StrandN = [
          N0[0] * cosTw - B0[0] * sinTw,
          N0[1] * cosTw - B0[1] * sinTw,
          N0[2] * cosTw - B0[2] * sinTw,
        ];

        // Leaf-shaped anime strand width envelope:
        // Starts at wStart at root (u=0) -> swells to wMid by swellEnd -> tapers to a razor-sharp point (u=1)
        let w;
        if (u < swellEnd) {
          const k = u / Math.max(0.01, swellEnd);
          w = wStart + (wMid - wStart) * Math.sin(k * Math.PI * 0.5);
        } else if (u < taperStart) {
          const k = (u - swellEnd) / Math.max(0.01, taperStart - swellEnd);
          w = wMid * (1.0 - 0.06 * k);
        } else {
          const k = (u - taperStart) / Math.max(0.01, 1.0 - taperStart);
          w = wMid * 0.94 * Math.pow(Math.max(0.0, 1.0 - k), 1.05);
        }

        // Bold 3D thickness profile so each lock has real sculptural depth right from the root
        const t = Math.sin(Math.min(1.0, u * 1.08) * Math.PI * 0.5 + 0.36) * Math.pow(Math.max(0.0, 1.0 - u), 0.65) * thick;

        const rootAO = (u < 0.12) ? (1.0 - u / 0.12) * 0.06 : 0.0;
        const curShade = shadeRoot + u * (shadeTip - shadeRoot);
        const flexW = samp.flex || 0.0;
        const edgeSag = 1.65 * w * w;

        const emitVert = (xNorm, yNorm, boost, groove) => {
          const latOff = xNorm * w;
          const sag = (xNorm * xNorm) * edgeSag;
          const normOff = yNorm * t - sag;
          const rawPt = [
            currP[0] + B[0] * latOff + StrandN[0] * normOff,
            currP[1] + B[1] * latOff + StrandN[1] * normOff,
            currP[2] + B[2] * latOff + StrandN[2] * normOff,
          ];
          const vertClear = (u < 0.14) ? 0.0014 : 0.0030;
          const pt = clampPointOutsideChibiHead(rawPt[0], rawPt[1], rawPt[2], 0.240, vertClear);
          const p = ptTransformFn(pt[0], pt[1] + bo, pt[2]);
          const vIdx = outV.length / 3;
          outV.push(p[0], p[1], p[2]);
          const [r, g, b] = computeAnimeHairColor(rgb, curShade, boost, groove + rootAO);
          outC.push(r, g, b);
          if (outF) outF.push(flexW);
          return vIdx;
        };

        for (let f = 0; f < numFacets; f++) {
          const fd = facetDefs[f];
          if (s === steps || w <= 0.0008) {
            const vTip = emitVert(0.0, 0.0, fd.bL * 0.5, fd.gL * 0.5);
            facetStrips[f].push([vTip, vTip]);
          } else {
            const vL = emitVert(fd.xL, fd.yL, fd.bL, fd.gL);
            const vR = emitVert(fd.xR, fd.yR, fd.bR, fd.gR);
            facetStrips[f].push([vL, vR]);
          }
        }
      }

      // Connect each bevel facet strip longitudinally (100% smooth along strand, hard-creased across ridges!)
      for (let f = 0; f < numFacets; f++) {
        const strip = facetStrips[f];
        for (let s = 0; s < steps; s++) {
          const [vL1, vR1] = strip[s];
          const [vL2, vR2] = strip[s + 1];
          if (s === steps - 1) {
            addTri(vL1, vL2, vR1);
          } else {
            addQuad(vL1, vL2, vR2, vR1);
          }
        }
      }
    };

    // =========================================================================
    // Volumetric Sculpted Anime Lock (Puffs out from parting, wraps, then flicks!)
    // =========================================================================
    const addSculptedAnimeLock = (cfg) => {
      const {
        azStart, elStart,
        azDepart, elDepart,
        tailLen: rawTailLen = 0.12,
        archLift: rawArchLift = 0.028,
        archUpY: rawArchUpY = 0.0,
        departLift: rawDepartLift = 0.006,
        dirX = 0.0, dirY = -1.0, dirZ = 0.0,
        tipFlickOut: rawTipFlickOut = 0.018,
        tipFlickSide: rawTipFlickSide = 0.0,
        wStart: rawWStart = 0.012,
        wMid: rawWMid = 0.048,
        thick: rawThick = 0.022,
        wrapSteps = 6,
        tailSteps = 6,
        shadeRoot = 0.90,
        shadeTip = 1.04,
        rootDepth = -0.002,
        gravity: rawGravity = 0.012,
        overrideRgb = null,
        flexMax = 0.20,
        profileType = "double",
        taperStart = 0.52,
        twist = 0.0
      } = cfg;

      // Proportion strand overhang, arch puff, and tail length to fit the compact Chibi lower face
      const tailLen = rawTailLen * 0.70;
      const archLift = rawArchLift * 0.74;
      const archUpY = rawArchUpY * 0.65;
      const departLift = Math.max(0.006, rawDepartLift * 0.82);
      const tipFlickOut = rawTipFlickOut * 0.68;
      const tipFlickSide = rawTipFlickSide * 0.75;
      const wStart = rawWStart * 0.88;
      const wMid = rawWMid * 0.88;
      const thick = rawThick * 0.78;
      const gravity = rawGravity * 0.70;

      const totalSteps = wrapSteps + tailSteps;
      const samples = [];

      const fLen = Math.hypot(dirX, dirY, dirZ) || 1;
      const D = [dirX / fLen, dirY / fLen, dirZ / fLen];

      const depRoot = getHairRoot(azDepart, elDepart, departLift, false);
      const P_dep = depRoot.p;
      const N_dep = depRoot.n;
      const azDepRad = (depRoot.azDeg * Math.PI) / 180;
      const elDepRad = (depRoot.elDeg * Math.PI) / 180;

      const sinElClamped = Math.max(-0.12, Math.sin(elDepRad));
      const T_meridian = [
        Math.sin(azDepRad) * sinElClamped,
        -Math.cos(elDepRad),
        Math.cos(azDepRad) * sinElClamped,
      ];
      const tmLen = Math.hypot(T_meridian[0], T_meridian[1], T_meridian[2]) || 1;
      T_meridian[0] /= tmLen;
      T_meridian[1] /= tmLen;
      T_meridian[2] /= tmLen;

      const Lat = [Math.cos(azDepRad), 0.0, -Math.sin(azDepRad)];

      // 1. Volumetric Arch & Wrap Phase (s = 0 .. wrapSteps)
      // Root anchor (s = 0) has flex = 0.0; segments growing out from the root (s >= 1) flex progressively!
      const effFlexMax = (flexMax <= 0.10) ? flexMax : Math.max(0.46, Math.min(0.95, flexMax * 2.4));
      for (let s = 0; s <= wrapSteps; s++) {
        const tWrap = wrapSteps > 0 ? (s / wrapSteps) : 1.0;
        const u = s / totalSteps;

        const sAz = tWrap * tWrap * (3.0 - 2.0 * tWrap);
        const curAz = azStart + (azDepart - azStart) * sAz;
        const curEl = elStart + (elDepart - elStart) * tWrap;

        const baseR = rootDepth * (1.0 - tWrap) + departLift * tWrap;
        const puffCurve = Math.sin(Math.pow(tWrap, 0.72) * Math.PI) * archLift;
        const sph = getHairRoot(curAz, curEl, baseR + puffCurve, false);
        if (archUpY !== 0.0) {
          sph.p[1] += Math.sin(Math.pow(tWrap, 0.62) * Math.PI) * archUpY;
        }

        samples.push({
          p: sph.p,
          n: sph.n,
          u,
          flex: (s === 0) ? 0.0 : (Math.pow(tWrap, 1.12) * (effFlexMax * 0.46)),
          twist: twist * tWrap * 0.5,
        });
      }

      // 2. Sculpted S-Curve & Tip-Flick Tail Phase (s = 1 .. tailSteps)
      const P0 = P_dep;
      const P1 = [
        P0[0] + (T_meridian[0] * 0.60 + D[0] * 0.40) * (tailLen * 0.36) + N_dep[0] * (archLift * 0.35),
        P0[1] + (T_meridian[1] * 0.60 + D[1] * 0.40) * (tailLen * 0.36) + N_dep[1] * (archLift * 0.35) - gravity * 0.15,
        P0[2] + (T_meridian[2] * 0.60 + D[2] * 0.40) * (tailLen * 0.36) + N_dep[2] * (archLift * 0.35),
      ];
      const P2 = [
        P0[0] + D[0] * (tailLen * 0.72) - N_dep[0] * (tipFlickOut * 0.25) + Lat[0] * (tipFlickSide * 0.45),
        P0[1] + D[1] * (tailLen * 0.72) - gravity * 0.65,
        P0[2] + D[2] * (tailLen * 0.72) - N_dep[2] * (tipFlickOut * 0.25) + Lat[2] * (tipFlickSide * 0.45),
      ];
      const P3 = [
        P0[0] + D[0] * tailLen + N_dep[0] * tipFlickOut + Lat[0] * tipFlickSide,
        P0[1] + D[1] * tailLen - gravity + Math.abs(tipFlickOut) * 0.35,
        P0[2] + D[2] * tailLen + N_dep[2] * tipFlickOut + Lat[2] * tipFlickSide,
      ];

      for (let s = 1; s <= tailSteps; s++) {
        const tTail = s / tailSteps;
        const invT = 1.0 - tTail;
        const u = (wrapSteps + s) / totalSteps;

        const b0 = invT * invT * invT;
        const b1 = 3.0 * invT * invT * tTail;
        const b2 = 3.0 * invT * tTail * tTail;
        const b3 = tTail * tTail * tTail;

        const px = b0 * P0[0] + b1 * P1[0] + b2 * P2[0] + b3 * P3[0];
        const py = b0 * P0[1] + b1 * P1[1] + b2 * P2[1] + b3 * P3[1];
        const pz = b0 * P0[2] + b1 * P1[2] + b2 * P2[2] + b3 * P3[2];

        samples.push({
          p: [px, py, pz],
          n: N_dep,
          u,
          flex: effFlexMax * (0.46 + 0.54 * Math.pow(tTail, 1.05)),
          twist: twist * (0.5 + 0.5 * tTail),
        });
      }

      buildBeveledCurveStrand(samples, wStart, wMid, thick, shadeRoot, shadeTip, overrideRgb, profileType, taperStart);
    };

    // =========================================================================
    // Center-Parted Root-Up-Then-Bend-Down Lock (ต่อจากโคนผมขึ้นมาแล้วค่อยดัดลง)
    // =========================================================================
    const addPartedArchLock = (cfg) => {
      const {
        azRoot, elRoot,
        elPeak = 70,
        azDepart, elDepart,
        tailLen: rawTailLen = 0.20,
        archLift: rawArchLift = 0.036,
        archUpY: rawArchUpY = 0.022,
        rootLift: rawRootLift = 0.004,
        departLift: rawDepartLift = 0.012,
        dirX = 0.0, dirY = -1.0, dirZ = 0.0,
        tipFlickOut: rawTipFlickOut = -0.006,
        tipFlickSide: rawTipFlickSide = 0.0,
        wStart: rawWStart = 0.022,
        wMid: rawWMid = 0.048,
        thick: rawThick = 0.024,
        archSteps = 9,
        tailSteps = 7,
        shadeRoot = 0.92,
        shadeTip = 1.06,
        gravity: rawGravity = 0.010,
        overrideRgb = null,
        flexMax = 0.20,
        profileType = "double",
        taperStart = 0.50,
        swellEnd = 0.36,
        twist = 0.0
      } = cfg;

      const tailLen = rawTailLen * 0.68;
      const archLift = rawArchLift * 0.72;
      const archUpY = rawArchUpY * 0.62;
      const rootLift = Math.max(0.003, rawRootLift * 0.75);
      const departLift = Math.max(0.007, rawDepartLift * 0.80);
      const tipFlickOut = rawTipFlickOut * 0.68;
      const tipFlickSide = rawTipFlickSide * 0.75;
      const wStart = rawWStart * 0.88;
      const wMid = rawWMid * 0.88;
      const thick = rawThick * 0.78;
      const gravity = rawGravity * 0.68;

      const totalSteps = archSteps + tailSteps;
      const samples = [];

      const fLen = Math.hypot(dirX, dirY, dirZ) || 1;
      const D = [dirX / fLen, dirY / fLen, dirZ / fLen];

      const depRoot = getHairRoot(azDepart, elDepart, departLift, false);
      const P_dep = depRoot.p;
      const N_dep = depRoot.n;
      const azDepRad = (depRoot.azDeg * Math.PI) / 180;
      const elDepRad = (depRoot.elDeg * Math.PI) / 180;

      const sinElClamped = Math.max(-0.12, Math.sin(elDepRad));
      const T_meridian = [
        Math.sin(azDepRad) * sinElClamped,
        -Math.cos(elDepRad),
        Math.cos(azDepRad) * sinElClamped,
      ];
      const tmLen = Math.hypot(T_meridian[0], T_meridian[1], T_meridian[2]) || 1;
      T_meridian[0] /= tmLen;
      T_meridian[1] /= tmLen;
      T_meridian[2] /= tmLen;

      const Lat = [Math.cos(azDepRad), 0.0, -Math.sin(azDepRad)];

      const A0 = azRoot;
      const A1 = azRoot + (azDepart - azRoot) * 0.22;
      const A2 = azRoot + (azDepart - azRoot) * 0.78;
      const A3 = azDepart;

      const peakEl = Math.max(elRoot + 6.0, elPeak);
      const E0 = elRoot;
      const E1 = peakEl + (peakEl - elRoot) * 0.55;
      const E2 = peakEl + (peakEl - elDepart) * 0.14;
      const E3 = elDepart;

      // 1. Root-Upward Growth & Over-the-Temple Bend Phase (s = 0 .. archSteps)
      // Root on the parting stays firmly anchored (flex = 0.0), while the outer arch towards the temple
      // progressively gains flexibility so parted styles (Styles 5, 7, 8) respond naturally to 3D gravity!
      const effPartedFlexMax = (flexMax <= 0.10) ? flexMax : Math.max(0.52, Math.min(0.95, flexMax * 2.5));
      for (let s = 0; s <= archSteps; s++) {
        const t = s / archSteps;
        const invT = 1.0 - t;
        const u = s / totalSteps;

        const b0 = invT * invT * invT;
        const b1 = 3.0 * invT * invT * t;
        const b2 = 3.0 * invT * t * t;
        const b3 = t * t * t;

        const curAz = b0 * A0 + b1 * A1 + b2 * A2 + b3 * A3;
        const curEl = b0 * E0 + b1 * E1 + b2 * E2 + b3 * E3;

        const baseR = rootLift * invT + departLift * t;
        const puffCurve = Math.sin(Math.pow(t, 0.68) * Math.PI) * archLift;
        const sph = getHairRoot(curAz, curEl, baseR + puffCurve, false);
        if (archUpY !== 0.0) {
          sph.p[1] += Math.sin(Math.pow(t, 0.60) * Math.PI) * archUpY;
        }

        const archFlex = (s <= 2) ? 0.0 : (Math.pow((t - 2 / archSteps) / Math.max(0.01, 1.0 - 2 / archSteps), 1.35) * (effPartedFlexMax * 0.36));
        samples.push({
          p: sph.p,
          n: sph.n,
          u,
          flex: archFlex,
          twist: twist * t * 0.5,
        });
      }

      // 2. Downward Curtain & Tip-Flick Tail Phase (s = 1 .. tailSteps)
      const P0 = P_dep;
      const P1 = [
        P0[0] + (T_meridian[0] * 0.58 + D[0] * 0.42) * (tailLen * 0.36) + N_dep[0] * (archLift * 0.32),
        P0[1] + (T_meridian[1] * 0.58 + D[1] * 0.42) * (tailLen * 0.36) + N_dep[1] * (archLift * 0.32) - gravity * 0.15,
        P0[2] + (T_meridian[2] * 0.58 + D[2] * 0.42) * (tailLen * 0.36) + N_dep[2] * (archLift * 0.32),
      ];
      const P2 = [
        P0[0] + D[0] * (tailLen * 0.72) - N_dep[0] * (tipFlickOut * 0.25) + Lat[0] * (tipFlickSide * 0.45),
        P0[1] + D[1] * (tailLen * 0.72) - gravity * 0.65,
        P0[2] + D[2] * (tailLen * 0.72) - N_dep[2] * (tipFlickOut * 0.25) + Lat[2] * (tipFlickSide * 0.45),
      ];
      const P3 = [
        P0[0] + D[0] * tailLen + N_dep[0] * tipFlickOut + Lat[0] * tipFlickSide,
        P0[1] + D[1] * tailLen - gravity + Math.abs(tipFlickOut) * 0.35,
        P0[2] + D[2] * tailLen + N_dep[2] * tipFlickOut + Lat[2] * tipFlickSide,
      ];

      for (let s = 1; s <= tailSteps; s++) {
        const tTail = s / tailSteps;
        const invT = 1.0 - tTail;
        const u = (archSteps + s) / totalSteps;

        const b0 = invT * invT * invT;
        const b1 = 3.0 * invT * invT * tTail;
        const b2 = 3.0 * invT * tTail * tTail;
        const b3 = tTail * tTail * tTail;

        const px = b0 * P0[0] + b1 * P1[0] + b2 * P2[0] + b3 * P3[0];
        const py = b0 * P0[1] + b1 * P1[1] + b2 * P2[1] + b3 * P3[1];
        const pz = b0 * P0[2] + b1 * P1[2] + b2 * P2[2] + b3 * P3[2];

        samples.push({
          p: [px, py, pz],
          n: N_dep,
          u,
          flex: effPartedFlexMax * (0.36 + 0.64 * Math.pow(tTail, 1.05)),
          twist: twist * (0.5 + 0.5 * tTail),
        });
      }

      buildBeveledCurveStrand(samples, wStart, wMid, thick, shadeRoot, shadeTip, overrideRgb, profileType, taperStart, swellEnd);
    };

    // Free-standing Cubic Bezier Beveled Strand (for Ahoge crest, Ponytails, Twin-tails, Horns & Nape Tufts)
    const addHairStrand = (
      rootAz, rootEl,
      rawLength,
      rawArchOut,
      dirX, dirY, dirZ,
      rawWStart = 0.018,
      rawWMid = 0.050,
      rawThick = 0.022,
      steps = 8,
      shadeRoot = 0.90,
      shadeTip = 1.05,
      radiusOffset = 0.002,
      rawGravity = 0.020,
      overrideRgb = null,
      flexMax = 0.25,
      profileType = "double",
      rawTipFlickOut = 0.015,
      rawTipFlickSide = 0.0,
      twist = 0.0
    ) => {
      const length = rawLength * 0.72;
      const archOut = rawArchOut * 0.68;
      const wStart = rawWStart * 0.85;
      const wMid = rawWMid * 0.85;
      const thick = rawThick * 0.78;
      const gravity = rawGravity * 0.70;
      const tipFlickOut = rawTipFlickOut * 0.70;
      const tipFlickSide = rawTipFlickSide * 0.75;
      const root = getHairRoot(rootAz, rootEl, radiusOffset, false);
      const P0 = root.p;
      const N = root.n;
      const azRad = (rootAz * Math.PI) / 180;
      const Lat = [Math.cos(azRad), 0.0, -Math.sin(azRad)];

      const fLen = Math.hypot(dirX, dirY, dirZ) || 1;
      const D = [dirX / fLen, dirY / fLen, dirZ / fLen];

      const P1 = [
        P0[0] + N[0] * (archOut * 1.25) + D[0] * (length * 0.35),
        P0[1] + N[1] * (archOut * 1.25) + D[1] * (length * 0.35) - gravity * 0.20,
        P0[2] + N[2] * (archOut * 1.25) + D[2] * (length * 0.35),
      ];
      const P2 = [
        P0[0] + N[0] * (archOut * 0.35) + D[0] * (length * 0.72) + Lat[0] * (tipFlickSide * 0.4),
        P0[1] + N[1] * (archOut * 0.35) + D[1] * (length * 0.72) - gravity * 0.65,
        P0[2] + N[2] * (archOut * 0.35) + D[2] * (length * 0.72) + Lat[2] * (tipFlickSide * 0.4),
      ];
      const P3 = [
        P0[0] + N[0] * tipFlickOut + D[0] * length + Lat[0] * tipFlickSide,
        P0[1] + N[1] * tipFlickOut + D[1] * length - gravity,
        P0[2] + N[2] * tipFlickOut + D[2] * length + Lat[2] * tipFlickSide,
      ];

      const samples = [];
      const effStrandFlexMax = (flexMax <= 0.10) ? flexMax : Math.max(0.46, Math.min(0.95, flexMax * 2.2));
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const invU = 1.0 - u;
        const b0 = invU * invU * invU;
        const b1 = 3.0 * invU * invU * u;
        const b2 = 3.0 * invU * u * u;
        const b3 = u * u * u;
        const px = b0 * P0[0] + b1 * P1[0] + b2 * P2[0] + b3 * P3[0];
        const py = b0 * P0[1] + b1 * P1[1] + b2 * P2[1] + b3 * P3[1];
        const pz = b0 * P0[2] + b1 * P1[2] + b2 * P2[2] + b3 * P3[2];
        samples.push({
          p: [px, py, pz],
          n: N,
          u,
          flex: (s === 0) ? 0.0 : (Math.pow(u, 1.08) * effStrandFlexMax),
          twist: twist * u,
        });
      }

      buildBeveledCurveStrand(samples, wStart, wMid, thick, shadeRoot, shadeTip, overrideRgb, profileType, 0.50);
    };

    addSolidHairDome();

    const activeStyle = ((styleIdx % NUM_HAIR_STYLES) + NUM_HAIR_STYLES) % NUM_HAIR_STYLES;

    // =========================================================================
    // 1. 4-Tier Shingled Sculpted Back, Nape Tuft Cluster & Volumetric Side-Flicks
    // (Modeled directly after the "ANIME HAIR 2" reference: image_71741f02.png)
    // =========================================================================
    const buildSculptedCrownSidesAndShingledBack = (isLongCascade = false) => {
      // --- TIER 4 (Bottom-most): Dense Sculpted Nape Feather Cluster (ท้ายทอยซ้อนเป็นช่อแหลมละเอียดเหมือนรูปขวาของ image_71741f02) ---
      // 17 sharply beveled leaf-locks emerging from the lower occipital skull (el = -4)
      // and hugging the nape of the neck (el = -44) with feathered tips!
      const napeLowerCount = 16;
      for (let i = 0; i <= napeLowerCount; i++) {
        const u = i / napeLowerCount;
        const az = 96 + u * 168; // 96 -> 180 -> 264
        const rad = (az * Math.PI) / 180;
        const toCenter = (180 - az) * 0.0012; // Subtle inward V-convergence at the neck
        const staggerLen = (i % 2 === 0) ? 0.105 : 0.088;
        addSculptedAnimeLock({
          azStart: az, elStart: -4,
          azDepart: az + (180 - az) * 0.06, elDepart: -44,
          tailLen: isLongCascade ? 0.18 : staggerLen,
          archLift: 0.012,
          departLift: 0.004,
          dirX: Math.sin(rad) * 0.05, dirY: -0.99, dirZ: Math.cos(rad) * 0.05,
          tipFlickOut: 0.008,
          tipFlickSide: toCenter,
          wStart: 0.016, wMid: 0.038, thick: 0.018,
          wrapSteps: 4, tailSteps: 5,
          shadeRoot: 0.74, shadeTip: 0.92,
          rootDepth: 0.001, gravity: 0.008,
          flexMax: 0.14,
          profileType: (i % 2 === 0) ? "double" : "single",
          taperStart: 0.48,
        });
      }

      // Upper Nape Feathers (ซ้อนทับชั้นท้ายทอยขึ้นมาอีก 1 ชั้น: el = +24 -> -24, ปลายแหลมคมชัด)
      const napeUpperCount = 14;
      for (let i = 0; i <= napeUpperCount; i++) {
        const u = i / napeUpperCount;
        const az = 100 + u * 160;
        const rad = (az * Math.PI) / 180;
        const sideFlick = ((i % 3) - 1) * 0.010;
        addSculptedAnimeLock({
          azStart: az, elStart: 24,
          azDepart: az, elDepart: -24,
          tailLen: isLongCascade ? 0.24 : (0.115 + (i % 2) * 0.018),
          archLift: 0.018,
          departLift: 0.007,
          dirX: Math.sin(rad) * 0.08, dirY: -0.98, dirZ: Math.cos(rad) * 0.08,
          tipFlickOut: 0.014,
          tipFlickSide: sideFlick,
          wStart: 0.018, wMid: 0.044, thick: 0.020,
          wrapSteps: 5, tailSteps: 5,
          shadeRoot: 0.80, shadeTip: 0.98,
          rootDepth: 0.001, gravity: 0.010,
          flexMax: 0.16,
          profileType: "single",
          taperStart: 0.45,
        });
      }

      // --- TIER 2 (Mid-Occipital Shingle Layer): Starts behind the ear (az = 108..252) so ears stay clearly visible ---
      if (!isLongCascade) {
        const midTierCount = 12;
        for (let i = 0; i <= midTierCount; i++) {
          const u = i / midTierCount;
          const az = 108 + u * 144;
          const rad = (az * Math.PI) / 180;
          const stagger = Math.sin(i * 2.1) * 0.018;
          const flickSide = (az < 180 ? -1 : 1) * 0.010;
          addSculptedAnimeLock({
            azStart: az, elStart: 62,
            azDepart: az, elDepart: -6,
            tailLen: 0.125 + stagger,
            archLift: 0.024,
            departLift: 0.010,
            dirX: Math.sin(rad) * 0.12, dirY: -0.97, dirZ: Math.cos(rad) * 0.12,
            tipFlickOut: 0.016,
            tipFlickSide: flickSide,
            wStart: 0.018, wMid: 0.050, thick: 0.022,
            wrapSteps: 5, tailSteps: 6,
            shadeRoot: 0.86, shadeTip: 1.02,
            rootDepth: 0.000, gravity: 0.012,
            flexMax: 0.18,
            profileType: "double",
            taperStart: 0.50,
          });
        }
      }

      // --- TIER 1 (Top Crown Shingle Layer): Starts behind the ear (az = 106..254) ---
      const topCrownCount = 11;
      for (let i = 0; i <= topCrownCount; i++) {
        const u = i / topCrownCount;
        const az = 106 + u * 148;
        const rad = (az * Math.PI) / 180;
        const stagger = (i % 2 === 0) ? 0.016 : -0.010;
        const curveAz = az + (az < 180 ? 2 : -2);
        addSculptedAnimeLock({
          azStart: az, elStart: 85,
          azDepart: curveAz, elDepart: 18,
          tailLen: (isLongCascade ? 0.155 : 0.118) + stagger,
          archLift: 0.034,
          departLift: 0.015,
          dirX: Math.sin(rad) * 0.16, dirY: -0.96, dirZ: Math.cos(rad) * 0.16,
          tipFlickOut: 0.012,
          tipFlickSide: (az < 180 ? -0.008 : 0.008),
          wStart: 0.014, wMid: 0.054, thick: 0.025,
          wrapSteps: 6, tailSteps: 5,
          shadeRoot: 0.90, shadeTip: 1.06,
          rootDepth: -0.003, gravity: 0.010,
          flexMax: 0.14,
          profileType: "double",
          taperStart: 0.54,
        });
      }

      // --- SIDEBURNS, CHEEK FRAMES & EAR-ARCH CUTOUT (เว้นซุ้มใบหู az = 72..102 ให้เห็นใบหูชัดเจนเหมือนโมเดลต้นแบบ!) ---
      for (let side of [-1, 1]) {
        const innerSideburns = [
          { azS: 38, azD: 42, elD:  16, len: 0.092, wMid: 0.042, arch: 0.024, flickOut: 0.010, flickSide: -0.012, prof: "double" },
          { azS: 49, azD: 53, elD:  -2, len: 0.128, wMid: 0.045, arch: 0.024, flickOut: 0.012, flickSide: -0.014, prof: "double" },
          { azS: 59, azD: 61, elD:  -4, len: 0.110, wMid: 0.042, arch: 0.022, flickOut: 0.012, flickSide: -0.010, prof: "single" },
          { azS: 74, azD: 77, elD:  28, len: 0.044, wMid: 0.038, arch: 0.018, flickOut: 0.008, flickSide:  0.006, prof: "single" },
          { azS: 88, azD: 90, elD:  30, len: 0.040, wMid: 0.038, arch: 0.018, flickOut: 0.008, flickSide:  0.008, prof: "single" },
        ];
        for (let sb of innerSideburns) {
          addSculptedAnimeLock({
            azStart: side * sb.azS, elStart: 84,
            azDepart: side * sb.azD, elDepart: sb.elD,
            tailLen: sb.len,
            archLift: sb.arch,
            departLift: 0.005,
            dirX: side * 0.08, dirY: -0.98, dirZ: 0.06,
            tipFlickOut: sb.flickOut,
            tipFlickSide: side * sb.flickSide,
            wStart: 0.014, wMid: sb.wMid, thick: 0.021,
            wrapSteps: 6, tailSteps: 6,
            shadeRoot: 0.88, shadeTip: 1.04,
            rootDepth: -0.002, gravity: 0.010,
            flexMax: 0.18,
            profileType: sb.prof,
            taperStart: 0.52,
            twist: side * 0.18,
          });
        }

        const outerSideFlicks = [
          { azS: 35, azD: 46, elD: 26, len: 0.102, wMid: 0.040, arch: 0.032, flickOut: 0.024, flickSide:  0.018, prof: "single" },
          { azS: 52, azD: 59, elD: 18, len: 0.128, wMid: 0.042, arch: 0.032, flickOut: 0.024, flickSide:  0.018, prof: "double" },
          { azS: 72, azD: 80, elD: 32, len: 0.048, wMid: 0.036, arch: 0.024, flickOut: 0.016, flickSide:  0.012, prof: "single" },
          { azS: 96, azD: 106, elD: 22, len: 0.105, wMid: 0.038, arch: 0.030, flickOut: 0.022, flickSide: 0.016, prof: "single" },
        ];
        for (let sf of outerSideFlicks) {
          const rad = (side * sf.azD * Math.PI) / 180;
          addSculptedAnimeLock({
            azStart: side * sf.azS, elStart: 85,
            azDepart: side * sf.azD, elDepart: sf.elD,
            tailLen: sf.len,
            archLift: sf.arch,
            departLift: 0.014,
            dirX: Math.sin(rad) * 0.28, dirY: -0.94, dirZ: Math.cos(rad) * 0.12,
            tipFlickOut: sf.flickOut,
            tipFlickSide: side * sf.flickSide,
            wStart: 0.012, wMid: sf.wMid, thick: 0.022,
            wrapSteps: 6, tailSteps: 6,
            shadeRoot: 0.92, shadeTip: 1.07,
            rootDepth: -0.003, gravity: 0.008,
            flexMax: 0.22,
            profileType: sf.prof,
            taperStart: 0.48,
            twist: side * 0.25,
          });
        }
      }
    };

    // =========================================================================
    // 2. Signature Top Ahoge / Sculpted Crest Strands (หงอนผมโค้งพริ้วด้านบนเหมือน image_71741f02)
    // =========================================================================
    const buildSculptedTopAhogeCrest = () => {
      // Main tall S-arched crest strand sweeping up and to the right
      addHairStrand(
        -4, 86,
        0.165, 0.052,
        0.68, 0.55, -0.18,
        0.012, 0.038, 0.022, 8,
        0.94, 1.08, -0.002, 0.028, null, 0.26,
        "single", 0.022, 0.015, 0.35
      );
      // Secondary lower companion crest strand
      addHairStrand(
        4, 84,
        0.130, 0.038,
        0.78, 0.38, -0.22,
        0.010, 0.030, 0.018, 7,
        0.92, 1.06, -0.002, 0.022, null, 0.22,
        "single", 0.016, 0.010, 0.25
      );
    };

    // =========================================================================
    // 3. Sculpted Volumetric Bangs with S-Curve Forehead Locks (หน้าม้าปั้น 3 มิติพร้อมปอยโค้งตัว S)
    // =========================================================================
    const buildStandardBangs = (tailScale = 1.0) => {
      // Layer 1: Sculpted base forehead locks with root-puff arch
      const bangLocks = [
        { azS: -30, azD: -35, elD: 25, len: 0.095 * tailScale, wMid: 0.044, arch: 0.026, dx: -0.24, flickS: -0.012, prof: "double" },
        { azS: -18, azD: -22, elD: 26, len: 0.076 * tailScale, wMid: 0.044, arch: 0.028, dx: -0.14, flickS: -0.008, prof: "double" },
        { azS:  -7, azD:  -9, elD: 27, len: 0.066 * tailScale, wMid: 0.042, arch: 0.030, dx: -0.04, flickS:  0.006, prof: "single" },
        { azS:   5, azD:   4, elD: 27, len: 0.070 * tailScale, wMid: 0.046, arch: 0.032, dx:  0.06, flickS:  0.010, prof: "double" },
        { azS:  17, azD:  19, elD: 26, len: 0.074 * tailScale, wMid: 0.044, arch: 0.028, dx:  0.14, flickS:  0.008, prof: "double" },
        { azS:  29, azD:  34, elD: 25, len: 0.092 * tailScale, wMid: 0.044, arch: 0.026, dx:  0.24, flickS:  0.012, prof: "double" },
      ];
      for (let b of bangLocks) {
        addSculptedAnimeLock({
          azStart: b.azS, elStart: 85,
          azDepart: b.azD, elDepart: b.elD,
          tailLen: b.len,
          archLift: b.arch,
          departLift: 0.006,
          dirX: b.dx, dirY: -0.97, dirZ: 0.08,
          tipFlickOut: 0.006,
          tipFlickSide: b.flickS,
          wStart: 0.012, wMid: b.wMid, thick: 0.022,
          wrapSteps: 6, tailSteps: 5,
          shadeRoot: 0.90, shadeTip: 1.05,
          rootDepth: -0.003, gravity: 0.008,
          flexMax: 0.12,
          profileType: b.prof,
          taperStart: 0.50,
        });
      }

      // Layer 2: Dynamic overlapping S-curved accent strands across the bangs (ปอยผมโค้งตัว S ซ้อนทับด้านหน้า)
      const sCurveBangs = [
        { azS: -14, azD: -18, elD: 30, len: 0.082 * tailScale, wMid: 0.032, arch: 0.036, dx: -0.10, flickS:  0.016, tw:  0.22 },
        { azS:   0, azD:  -2, elD: 31, len: 0.078 * tailScale, wMid: 0.034, arch: 0.038, dx:  0.08, flickS: -0.014, tw: -0.20 },
        { azS:  14, azD:  18, elD: 30, len: 0.082 * tailScale, wMid: 0.032, arch: 0.036, dx:  0.16, flickS: -0.012, tw: -0.22 },
      ];
      for (let sb of sCurveBangs) {
        addSculptedAnimeLock({
          azStart: sb.azS, elStart: 85,
          azDepart: sb.azD, elDepart: sb.elD,
          tailLen: sb.len,
          archLift: sb.arch,
          departLift: 0.012,
          dirX: sb.dx, dirY: -0.96, dirZ: 0.10,
          tipFlickOut: 0.010,
          tipFlickSide: sb.flickS,
          wStart: 0.010, wMid: sb.wMid, thick: 0.020,
          wrapSteps: 6, tailSteps: 6,
          shadeRoot: 0.94, shadeTip: 1.07,
          rootDepth: -0.003, gravity: 0.006,
          flexMax: 0.15,
          profileType: "single",
          taperStart: 0.45,
          twist: sb.tw,
        });
      }
    };

    // =========================================================================
    // 4. Center-Parting M-Arch & Stepped Side Curtain Hair (Style 5 - ต่อจากโคนผมขึ้นมาแล้วค่อยดัดลง!)
    // =========================================================================
    const buildCenterPartingCurtainHair = () => {
      // Every front & crown lock starts at the hair root (โคนผม: elRoot = 38..84),
      // grows UPWARD first (ต่อจากโคนผมขึ้นมา -> elPeak = 64..89), and THEN bends
      // over and curves DOWNWARD (แล้วค่อยดัดลง -> elDepart = 24..10) along the sides!
      const partedCurtainRows = [
        // Row 0: Front-most Hairline Root-Arch Lock (งอกขึ้นจากโคนผมหน้าผาก el=38 ขึ้นไปที่ elPeak=64 แล้วดัดโค้งลงขมับ)
        { azR:   1.5, elR: 38, elP: 64, azD:  18, elD: 25, len: 0.195, wS: 0.022, wMid: 0.040, arch: 0.036, upY: 0.024, depL: 0.015, dx: 0.04, dz:  0.10, flickOut: -0.010, flickSide: -0.014, prof: "double" },
        // Row 1: High M-Arch Forehead Curtain Lock (ซุ้มปอยหน้าแสกกลางยกโคนสูงแล้วดัดลงข้างคิ้ว)
        { azR:   2.0, elR: 43, elP: 69, azD:  25, elD: 21, len: 0.222, wS: 0.024, wMid: 0.045, arch: 0.038, upY: 0.026, depL: 0.014, dx: 0.03, dz:  0.11, flickOut: -0.009, flickSide: -0.015, prof: "double" },
        // Row 2: Primary Wide Cheek-Framing Lock (ปอยแก้มช่อใหญ่ยาวสุดถึงแนวกรามตามภาพ image_3a2115e0.png!)
        { azR:   2.5, elR: 49, elP: 74, azD:  34, elD: 15, len: 0.248, wS: 0.025, wMid: 0.052, arch: 0.038, upY: 0.024, depL: 0.012, dx: 0.02, dz:  0.12, flickOut: -0.008, flickSide: -0.016, prof: "double" },
        // Rows 3-11: Stepped Side & Crown Curtain Locks (ไล่ระดับปลายเฉียงขึ้นไปทางด้านหลังเหมือนในภาพ image_3a2115e0.png!)
        { azR:   3.5, elR: 56, elP: 78, azD:  47, elD: 12, len: 0.222, wS: 0.024, wMid: 0.048, arch: 0.036, upY: 0.022, depL: 0.010, dx: 0.03, dz:  0.06, flickOut: -0.006, flickSide: -0.008, prof: "double" },
        { azR:   5.0, elR: 63, elP: 82, azD:  61, elD: 11, len: 0.198, wS: 0.024, wMid: 0.050, arch: 0.035, upY: 0.020, depL: 0.010, dx: 0.03, dz:  0.03, flickOut: -0.005, flickSide: -0.004, prof: "double" },
        { azR:   7.5, elR: 70, elP: 85, azD:  76, elD: 10, len: 0.180, wS: 0.024, wMid: 0.050, arch: 0.034, upY: 0.018, depL: 0.009, dx: 0.04, dz:  0.00, flickOut: -0.005, flickSide:  0.000, prof: "double" },
        { azR:  12.0, elR: 76, elP: 87, azD:  91, elD: 10, len: 0.166, wS: 0.024, wMid: 0.050, arch: 0.033, upY: 0.016, depL: 0.009, dx: 0.04, dz: -0.02, flickOut: -0.004, flickSide:  0.000, prof: "double" },
        { azR:  28.0, elR: 80, elP: 88, azD: 107, elD: 10, len: 0.156, wS: 0.023, wMid: 0.050, arch: 0.032, upY: 0.014, depL: 0.009, dx: 0.03, dz: -0.04, flickOut: -0.004, flickSide:  0.000, prof: "double" },
        { azR:  60.0, elR: 82, elP: 88, azD: 123, elD: 10, len: 0.149, wS: 0.023, wMid: 0.050, arch: 0.030, upY: 0.012, depL: 0.009, dx: 0.03, dz: -0.05, flickOut: -0.004, flickSide:  0.000, prof: "double" },
        { azR:  98.0, elR: 82, elP: 88, azD: 139, elD: 10, len: 0.144, wS: 0.022, wMid: 0.048, arch: 0.028, upY: 0.010, depL: 0.008, dx: 0.02, dz: -0.06, flickOut: -0.004, flickSide:  0.000, prof: "double" },
        { azR: 134.0, elR: 81, elP: 87, azD: 155, elD: 10, len: 0.140, wS: 0.022, wMid: 0.048, arch: 0.026, upY: 0.008, depL: 0.008, dx: 0.02, dz: -0.06, flickOut: -0.004, flickSide:  0.000, prof: "double" },
        { azR: 162.0, elR: 80, elP: 86, azD: 171, elD: 10, len: 0.136, wS: 0.022, wMid: 0.046, arch: 0.025, upY: 0.006, depL: 0.008, dx: 0.01, dz: -0.06, flickOut: -0.004, flickSide:  0.000, prof: "double" },
      ];

      for (let side of [-1, 1]) {
        for (let cl of partedCurtainRows) {
          addPartedArchLock({
            azRoot: side * cl.azR, elRoot: cl.elR,
            elPeak: cl.elP,
            azDepart: side * cl.azD, elDepart: cl.elD,
            tailLen: cl.len,
            archLift: cl.arch,
            archUpY: cl.upY,
            rootLift: 0.004,
            departLift: cl.depL,
            dirX: side * cl.dx, dirY: -0.992, dirZ: cl.dz,
            tipFlickOut: cl.flickOut,
            tipFlickSide: side * cl.flickSide,
            wStart: cl.wS, wMid: cl.wMid, thick: 0.025,
            archSteps: 9, tailSteps: 7,
            shadeRoot: 0.92, shadeTip: 1.06,
            gravity: 0.010,
            flexMax: 0.20,
            profileType: cl.prof,
            taperStart: 0.48,
            swellEnd: 0.36,
            twist: side * 0.08,
          });
        }

        // Under-Arch Front Hairline Root Cushion Locks (โคนผมชั้นในที่งอกเชิดขึ้นจากตีนผมหน้าผากรับใต้ซุ้มแสกกลาง!)
        addPartedArchLock({
          azRoot: side * 5.5, elRoot: 39,
          elPeak: 58,
          azDepart: side * 21, elDepart: 23,
          tailLen: 0.165,
          archLift: 0.022,
          archUpY: 0.012,
          rootLift: 0.002,
          departLift: 0.009,
          dirX: side * 0.03, dirY: -0.992, dirZ: 0.09,
          tipFlickOut: -0.008,
          tipFlickSide: -side * 0.012,
          wStart: 0.024, wMid: 0.042, thick: 0.022,
          archSteps: 8, tailSteps: 6,
          shadeRoot: 0.88, shadeTip: 1.02,
          gravity: 0.009,
          flexMax: 0.16,
          profileType: "double",
          taperStart: 0.48,
          swellEnd: 0.34,
          twist: side * 0.06,
        });

        addPartedArchLock({
          azRoot: side * 12.0, elRoot: 37,
          elPeak: 55,
          azDepart: side * 30, elDepart: 18,
          tailLen: 0.185,
          archLift: 0.020,
          archUpY: 0.010,
          rootLift: 0.002,
          departLift: 0.008,
          dirX: side * 0.02, dirY: -0.992, dirZ: 0.08,
          tipFlickOut: -0.007,
          tipFlickSide: -side * 0.010,
          wStart: 0.024, wMid: 0.044, thick: 0.022,
          archSteps: 8, tailSteps: 6,
          shadeRoot: 0.88, shadeTip: 1.02,
          gravity: 0.009,
          flexMax: 0.16,
          profileType: "double",
          taperStart: 0.48,
          swellEnd: 0.34,
          twist: side * 0.06,
        });

        // Shorter Overlapping Upper-Cheek & Mid-Temple Accent Wisps (ปอยสั้นซ้อนทับด้านบนเหมือนในภาพ image_3a2115e0.png!)
        addPartedArchLock({
          azRoot: side * 2.2, elRoot: 45,
          elPeak: 70,
          azDepart: side * 26, elDepart: 24,
          tailLen: 0.128,
          archLift: 0.042,
          archUpY: 0.028,
          rootLift: 0.005,
          departLift: 0.018,
          dirX: side * 0.02, dirY: -0.992, dirZ: 0.11,
          tipFlickOut: -0.006,
          tipFlickSide: -side * 0.010,
          wStart: 0.018, wMid: 0.028, thick: 0.020,
          archSteps: 9, tailSteps: 6,
          shadeRoot: 0.94, shadeTip: 1.08,
          gravity: 0.008,
          flexMax: 0.16,
          profileType: "single",
          taperStart: 0.45,
          swellEnd: 0.36,
          twist: side * 0.12,
        });

        addPartedArchLock({
          azRoot: side * 4.5, elRoot: 58,
          elPeak: 80,
          azDepart: side * 44, elDepart: 18,
          tailLen: 0.146,
          archLift: 0.040,
          archUpY: 0.024,
          rootLift: 0.005,
          departLift: 0.015,
          dirX: side * 0.03, dirY: -0.992, dirZ: 0.06,
          tipFlickOut: -0.005,
          tipFlickSide: -side * 0.006,
          wStart: 0.018, wMid: 0.032, thick: 0.021,
          archSteps: 9, tailSteps: 6,
          shadeRoot: 0.94, shadeTip: 1.08,
          gravity: 0.008,
          flexMax: 0.16,
          profileType: "single",
          taperStart: 0.46,
          swellEnd: 0.36,
          twist: side * 0.10,
        });
      }

      // Inner Shadow-Fill Layer under the stepped side/back gaps
      const innerFillAz = [41, 55, 69, 84, 100, 116, 132, 148, 164, 180];
      for (let side of [-1, 1]) {
        for (let idx = 0; idx < innerFillAz.length; idx++) {
          const azD = innerFillAz[idx];
          if (side === 1 && azD === 180) continue;
          const fillLen = Math.max(0.125, 0.195 - idx * 0.008);
          addSculptedAnimeLock({
            azStart: side * (azD * 0.80), elStart: 62,
            azDepart: side * azD, elDepart: -2,
            tailLen: fillLen,
            archLift: 0.018,
            departLift: 0.004,
            dirX: side * 0.02, dirY: -0.995, dirZ: -0.02,
            tipFlickOut: -0.005,
            tipFlickSide: 0.0,
            wStart: 0.016, wMid: 0.044, thick: 0.020,
            wrapSteps: 5, tailSteps: 6,
            shadeRoot: 0.76, shadeTip: 0.92,
            rootDepth: 0.000, gravity: 0.008,
            flexMax: 0.16,
            profileType: "single",
            taperStart: 0.48,
          });
        }
      }

      // Tapered Nape Tail / Lower Neck Tuft (ปอยท้ายทอยเรียวแหลมด้านล่างตามภาพ image_3a2115e0.png!)
      const napeCount = 12;
      for (let i = 0; i <= napeCount; i++) {
        const u = i / napeCount;
        const az = 98 + u * 164;
        const centerProx = 1.0 - Math.abs(u - 0.5) * 2.0; // Longer tapered tail near center-nape (180 deg)
        addSculptedAnimeLock({
          azStart: az, elStart: 8,
          azDepart: az + (180 - az) * 0.10, elDepart: -38,
          tailLen: 0.095 + centerProx * 0.045,
          archLift: 0.012,
          departLift: 0.003,
          dirX: 0.0, dirY: -0.96, dirZ: 0.24, // Sweeps neatly down & slightly forward along the nape curve!
          tipFlickOut: -0.004,
          tipFlickSide: (180 - az) * 0.0010,
          wStart: 0.016, wMid: 0.038, thick: 0.018,
          wrapSteps: 4, tailSteps: 5,
          shadeRoot: 0.72, shadeTip: 0.88,
          rootDepth: 0.001, gravity: 0.006,
          flexMax: 0.14,
          profileType: "single",
          taperStart: 0.46,
        });
      }
    };

    // =========================================================================
    // 5. Side-Swept Volumetric Anime Hair (Style 2 - ทรงปัดข้างมีโวลุ่มพองและปลายสะบัด)
    // =========================================================================
    const buildSideSweptHair = () => {
      // Left side-parted temple lock
      addSculptedAnimeLock({
        azStart: -24, elStart: 86,
        azDepart: -35, elDepart: 24,
        tailLen: 0.108,
        archLift: 0.034,
        departLift: 0.008,
        dirX: -0.32, dirY: -0.94, dirZ: 0.08,
        tipFlickOut: 0.018,
        tipFlickSide: -0.016,
        wStart: 0.012, wMid: 0.044, thick: 0.022,
        wrapSteps: 6, tailSteps: 6,
        shadeRoot: 0.90, shadeTip: 1.05,
        rootDepth: -0.004, gravity: 0.009,
        flexMax: 0.15,
        profileType: "double",
        taperStart: 0.50,
        twist: -0.20,
      });

      // Volumetric sweeping locks arching out from the left parting (-18 deg) across the forehead
      const sweepSpecs = [
        { azS: -18, azD: -12, elD: 30, len: 0.084, wMid: 0.046, arch: 0.036, dx: 0.62, dy: -0.78, flickS:  0.014, prof: "double" },
        { azS: -10, azD:   0, elD: 29, len: 0.090, wMid: 0.048, arch: 0.038, dx: 0.60, dy: -0.80, flickS:  0.016, prof: "double" },
        { azS:   0, azD:  12, elD: 27, len: 0.098, wMid: 0.046, arch: 0.036, dx: 0.54, dy: -0.84, flickS:  0.018, prof: "double" },
        { azS:  12, azD:  24, elD: 25, len: 0.110, wMid: 0.044, arch: 0.034, dx: 0.44, dy: -0.89, flickS:  0.020, prof: "single" },
        { azS:  24, azD:  34, elD: 22, len: 0.125, wMid: 0.044, arch: 0.032, dx: 0.30, dy: -0.95, flickS:  0.022, prof: "double" },
        // Outer high-arch S-curve accent strands crossing over the sweep
        { azS: -14, azD:  -2, elD: 32, len: 0.092, wMid: 0.032, arch: 0.044, dx: 0.64, dy: -0.76, flickS: -0.014, prof: "single" },
        { azS:   4, azD:  18, elD: 30, len: 0.105, wMid: 0.032, arch: 0.042, dx: 0.50, dy: -0.86, flickS:  0.024, prof: "single" },
      ];

      for (let sw of sweepSpecs) {
        addSculptedAnimeLock({
          azStart: sw.azS, elStart: 86,
          azDepart: sw.azD, elDepart: sw.elD,
          tailLen: sw.len,
          archLift: sw.arch,
          departLift: 0.010,
          dirX: sw.dx, dirY: sw.dy, dirZ: 0.10,
          tipFlickOut: 0.014,
          tipFlickSide: sw.flickS,
          wStart: 0.012, wMid: sw.wMid, thick: 0.022,
          wrapSteps: 6, tailSteps: 6,
          shadeRoot: 0.92, shadeTip: 1.06,
          rootDepth: -0.004, gravity: 0.008,
          flexMax: 0.15,
          profileType: sw.prof,
          taperStart: 0.48,
          twist: 0.25,
        });
      }

      buildSculptedTopAhogeCrest();
    };

    // =========================================================================
    // 6. Sleek Center-Strand & Vertical Layered Cut (Style 7 - ต่อจากโคนผมขึ้นมาแล้วค่อยดัดลง!)
    // =========================================================================
    const buildKemonomimiCenterStrandHair = () => {
      // 1. Signature Long Center Forehead-to-Nose Strand (งอกจากโคนผมหน้าผากเชิดขึ้นแล้วดัดโค้งลงมากลางหน้าผากถึงปลายจมูก)
      addPartedArchLock({
        azRoot: -0.5, elRoot: 40,
        elPeak: 68,
        azDepart: 2, elDepart: 25,
        tailLen: 0.215,
        archLift: 0.036,
        archUpY: 0.022,
        rootLift: 0.005,
        departLift: 0.014,
        dirX: 0.14, dirY: -0.985, dirZ: 0.07,
        tipFlickOut: -0.008,
        tipFlickSide: 0.016,
        wStart: 0.018, wMid: 0.033, thick: 0.021,
        archSteps: 9, tailSteps: 7,
        shadeRoot: 0.94, shadeTip: 1.07,
        gravity: 0.008,
        flexMax: 0.20,
        profileType: "double",
        taperStart: 0.44,
        swellEnd: 0.34,
        twist: 0.12,
      });

      // 2. Inner Crescent Temple-to-Cheek Bangs (งอกจากโคนผมแสกกลางขึ้นมาแล้วดัดโค้งโอบหางคิ้วเข้าหาโหนกแก้ม ซ้าย-ขวา)
      for (let side of [-1, 1]) {
        addPartedArchLock({
          azRoot: side * 2.0, elRoot: 41,
          elPeak: 67,
          azDepart: side * 22, elDepart: 24,
          tailLen: 0.118,
          archLift: 0.034,
          archUpY: 0.020,
          rootLift: 0.004,
          departLift: 0.011,
          dirX: side * 0.12, dirY: -0.985, dirZ: 0.08,
          tipFlickOut: -0.006,
          tipFlickSide: -side * 0.028, // Curves inward to hug the cheekbone!
          wStart: 0.022, wMid: 0.038, thick: 0.021,
          archSteps: 9, tailSteps: 6,
          shadeRoot: 0.91, shadeTip: 1.04,
          gravity: 0.008,
          flexMax: 0.14,
          profileType: "double",
          taperStart: 0.48,
          swellEnd: 0.35,
          twist: side * 0.15,
        });

        // Under-arch hairline root filler
        addPartedArchLock({
          azRoot: side * 6.5, elRoot: 38,
          elPeak: 58,
          azDepart: side * 26, elDepart: 20,
          tailLen: 0.155,
          archLift: 0.022,
          archUpY: 0.012,
          rootLift: 0.002,
          departLift: 0.008,
          dirX: side * 0.04, dirY: -0.992, dirZ: 0.07,
          tipFlickOut: -0.006,
          tipFlickSide: -side * 0.014,
          wStart: 0.022, wMid: 0.040, thick: 0.021,
          archSteps: 8, tailSteps: 6,
          shadeRoot: 0.88, shadeTip: 1.02,
          gravity: 0.008,
          flexMax: 0.16,
          profileType: "double",
          taperStart: 0.48,
          swellEnd: 0.34,
          twist: side * 0.08,
        });
      }

      // Secondary Asymmetric Left Curtain Strand
      addPartedArchLock({
        azRoot: 3.0, elRoot: 46,
        elPeak: 72,
        azDepart: 29, elDepart: 18,
        tailLen: 0.175,
        archLift: 0.034,
        archUpY: 0.020,
        rootLift: 0.004,
        departLift: 0.011,
        dirX: 0.06, dirY: -0.99, dirZ: 0.07,
        tipFlickOut: -0.006,
        tipFlickSide: -0.014,
        wStart: 0.020, wMid: 0.036, thick: 0.021,
        archSteps: 9, tailSteps: 6,
        shadeRoot: 0.92, shadeTip: 1.06,
        gravity: 0.009,
        flexMax: 0.18,
        profileType: "double",
        taperStart: 0.48,
        swellEnd: 0.35,
        twist: 0.14,
      });

      // 3. Sleek Vertical Tubular-Beveled Side & Back Locks (rising from parted root then bending down)
      const outerVerticalSpecs = [
        { azR:   3.0, elR: 50, elP: 75, azD:  34, elD: 12, len: 0.278, wMid: 0.044, arch: 0.034, upY: 0.020, dx: 0.02, dz: 0.06, flickOut: -0.008, flickSide: -0.008 },
        { azR:   4.5, elR: 57, elP: 79, azD:  46, elD: 11, len: 0.246, wMid: 0.045, arch: 0.034, upY: 0.018, dx: 0.03, dz: 0.04, flickOut: -0.006, flickSide: -0.005 },
        { azR:   6.5, elR: 64, elP: 83, azD:  59, elD: 10, len: 0.224, wMid: 0.046, arch: 0.032, upY: 0.016, dx: 0.04, dz: 0.02, flickOut: -0.005, flickSide: -0.003 },
        { azR:  10.0, elR: 71, elP: 85, azD:  72, elD:  9, len: 0.208, wMid: 0.046, arch: 0.030, upY: 0.014, dx: 0.04, dz: 0.00, flickOut: -0.005, flickSide:  0.000 },
        { azR:  18.0, elR: 77, elP: 87, azD:  85, elD:  9, len: 0.198, wMid: 0.047, arch: 0.028, upY: 0.012, dx: 0.04, dz: -0.01, flickOut: -0.004, flickSide: 0.000 },
        { azR:  36.0, elR: 80, elP: 88, azD:  98, elD:  8, len: 0.194, wMid: 0.047, arch: 0.028, upY: 0.010, dx: 0.04, dz: -0.02, flickOut: -0.004, flickSide: 0.000 },
        { azR:  64.0, elR: 82, elP: 88, azD: 112, elD:  8, len: 0.190, wMid: 0.048, arch: 0.028, upY: 0.008, dx: 0.03, dz: -0.03, flickOut: -0.004, flickSide: 0.000 },
        { azR:  94.0, elR: 82, elP: 88, azD: 126, elD:  8, len: 0.196, wMid: 0.048, arch: 0.028, upY: 0.008, dx: 0.03, dz: -0.04, flickOut: -0.004, flickSide: 0.000 },
        { azR: 120.0, elR: 82, elP: 87, azD: 140, elD:  8, len: 0.188, wMid: 0.048, arch: 0.028, upY: 0.006, dx: 0.02, dz: -0.05, flickOut: -0.004, flickSide: 0.000 },
        { azR: 142.0, elR: 81, elP: 87, azD: 154, elD:  8, len: 0.195, wMid: 0.048, arch: 0.028, upY: 0.006, dx: 0.02, dz: -0.05, flickOut: -0.004, flickSide: 0.000 },
        { azR: 162.0, elR: 80, elP: 86, azD: 168, elD:  8, len: 0.188, wMid: 0.048, arch: 0.028, upY: 0.006, dx: 0.01, dz: -0.05, flickOut: -0.004, flickSide: 0.000 },
      ];

      for (let side of [-1, 1]) {
        for (let lk of outerVerticalSpecs) {
          addPartedArchLock({
            azRoot: side * lk.azR, elRoot: lk.elR,
            elPeak: lk.elP,
            azDepart: side * lk.azD, elDepart: lk.elD,
            tailLen: lk.len,
            archLift: lk.arch,
            archUpY: lk.upY,
            rootLift: 0.004,
            departLift: 0.009,
            dirX: side * lk.dx, dirY: -0.995, dirZ: lk.dz,
            tipFlickOut: lk.flickOut,
            tipFlickSide: side * lk.flickSide,
            wStart: 0.022, wMid: lk.wMid, thick: 0.024,
            archSteps: 9, tailSteps: 7,
            shadeRoot: 0.91, shadeTip: 1.05,
            gravity: 0.010,
            flexMax: 0.22,
            profileType: "double",
            taperStart: 0.50,
            swellEnd: 0.36,
            twist: side * 0.06,
          });
        }
      }

      // Center-back vertical lock at 180 deg
      addSculptedAnimeLock({
        azStart: 180, elStart: 85,
        azDepart: 180, elDepart: 8,
        tailLen: 0.194,
        archLift: 0.028,
        departLift: 0.009,
        dirX: 0.0, dirY: -0.995, dirZ: -0.05,
        tipFlickOut: -0.004,
        tipFlickSide: 0.0,
        wStart: 0.018, wMid: 0.048, thick: 0.024,
        wrapSteps: 6, tailSteps: 7,
        shadeRoot: 0.90, shadeTip: 1.05,
        rootDepth: 0.002, gravity: 0.010,
        flexMax: 0.22,
        profileType: "double",
        taperStart: 0.50,
      });

      // 4. Inner Staggered Shadow-Tip Layer
      const innerStaggerAz = [40, 52, 65, 78, 91, 105, 119, 133, 147, 161, 174];
      for (let side of [-1, 1]) {
        for (let idx = 0; idx < innerStaggerAz.length; idx++) {
          const azD = innerStaggerAz[idx];
          const innerLen = (idx < 3) ? (0.225 - idx * 0.014) : (0.184 + (idx % 2) * 0.010);
          addSculptedAnimeLock({
            azStart: side * (azD * 0.85), elStart: 64,
            azDepart: side * azD, elDepart: -4,
            tailLen: innerLen,
            archLift: 0.018,
            departLift: 0.004,
            dirX: side * 0.02, dirY: -0.996, dirZ: 0.0,
            tipFlickOut: -0.006,
            tipFlickSide: 0.0,
            wStart: 0.016, wMid: 0.044, thick: 0.020,
            wrapSteps: 5, tailSteps: 6,
            shadeRoot: 0.76, shadeTip: 0.92,
            rootDepth: 0.000, gravity: 0.008,
            flexMax: 0.18,
            profileType: "single",
            taperStart: 0.46,
          });
        }
      }

      // 5. Lower Nape Under-Cover Layer
      const napeCount = 12;
      for (let i = 0; i <= napeCount; i++) {
        const az = 96 + (i / napeCount) * 168;
        addSculptedAnimeLock({
          azStart: az, elStart: 8,
          azDepart: az, elDepart: -38,
          tailLen: 0.110,
          archLift: 0.012,
          departLift: 0.003,
          dirX: 0.0, dirY: -0.995, dirZ: 0.0,
          tipFlickOut: -0.004,
          tipFlickSide: (180 - az) * 0.0008,
          wStart: 0.016, wMid: 0.040, thick: 0.018,
          wrapSteps: 4, tailSteps: 5,
          shadeRoot: 0.72, shadeTip: 0.88,
          rootDepth: 0.001, gravity: 0.006,
          flexMax: 0.14,
          profileType: "single",
          taperStart: 0.48,
        });
      }
    };

    // =========================================================================
    // 7. Sculpted Ribbed High Ponytail (Style 8 / #9 - ตามภาพ image_706943dc.png & image_99e99ad4.png!)
    // =========================================================================
    // Full 100% Hairline-Root Coverage (เต็มโคนผม 100% รอบหัว ไม่มีพื้นโดมโล่ง) + Full Strand Physics:
    //  1) Pulled-Back Ribbed Skull Cap starting right from the hairline edge (front crown, temple, ear arch & bottom nape)
    //  2) 2-Layer Sideburn & Temple Locks in front of the ear (completely covering the pre-auricular hairline & framing the cheek)
    //  3) Lush Forward-Swept Volumetric Layered Bangs + 3 High-Arched Narrow Overlay Wisps
    //  4) 3D Sculpted Torus Hair Tie / Scrunchie Collar at (az=180, el=38)
    //  5) Broad High-Fountain S-Curve Multi-Strand Ponytail + 8 Freestanding Airy Outer Ribbon Loops
    const buildRibbedHighPonytailHair = () => {
      const tieAz = 180.0;
      const tieEl = 38.0;

      // Helper A: Wide-Root Pulled-Back 3D Beveled Rib starting flush at the hairline root and converging into the Tie
      const addPulledToTieRib = (cfg) => {
        const {
          azStart, elStart,
          azEnd = 178.0, elEnd = 38.0,
          elMidBoost = 8.0,
          archLift = 0.028,
          wStart = 0.044, // Wide at the hairline root so adjacent ribs overlap 100% with zero bare dome!
          wMid = 0.054,
          thick = 0.026,
          steps = 11,
          shadeRoot = 0.90,
          shadeTip = 0.97,
          profileType = "double",
          twist = 0.0
        } = cfg;

        const samples = [];
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          const sCurve = u * u * (3.0 - 2.0 * u);
          const curAz = azStart + (azEnd - azStart) * sCurve;
          const curEl = elStart + (elEnd - elStart) * u + Math.sin(u * Math.PI) * elMidBoost;
          const lift = 0.002 * (1.0 - u) + 0.003 * u + Math.sin(Math.pow(u, 0.72) * Math.PI) * (archLift * 0.55);
          const sph = getHairRoot(curAz, curEl, lift, false);
          samples.push({
            p: sph.p,
            n: sph.n,
            u,
            // Root (s=0) is anchored to hairline; segments growing out toward the ponytail tie flex with airflow!
            flex: (s === 0) ? 0.0 : (Math.sin(u * Math.PI) * 0.34 + u * 0.24),
            twist: twist * Math.sin(u * Math.PI),
          });
        }
        buildBeveledCurveStrand(samples, wStart * 0.85, wMid * 0.85, thick * 0.78, shadeRoot, shadeTip, null, profileType, 0.82, 0.08);
      };

      // 1. Top-Center Meridional Crown Ribs (starting right behind the front hairline el=42 and sweeping over the crown into the tie!)
      for (let azOff of [-10.0, -5.0, 0.0, 5.0, 10.0]) {
        const samples = [];
        const steps = 11;
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          // Sweep from front hairline (az=azOff, el=42) over the top zenith (el=89) down to the back tie (az=180, el=38)
          let curAz, curEl;
          if (u <= 0.48) {
            const k = u / 0.48;
            curAz = azOff * (1.0 - k * 0.5);
            curEl = 42.0 + k * 47.0;
          } else {
            const k = (u - 0.48) / 0.52;
            curAz = (azOff >= 0 ? 180.0 : -180.0) - azOff * (1.0 - k) * 0.5;
            curEl = 89.0 - k * 51.0;
          }
          const lift = 0.003 + Math.sin(u * Math.PI) * 0.014;
          const sph = getHairRoot(curAz, curEl, lift, false);
          samples.push({
            p: sph.p,
            n: sph.n,
            u,
            flex: (s === 0) ? 0.0 : (Math.sin(u * Math.PI) * 0.34 + u * 0.24),
            twist: 0.0,
          });
        }
        buildBeveledCurveStrand(samples, 0.036, 0.046, 0.020, 0.92, 0.98, null, "double", 0.82, 0.08);
      }

      // 2. Full-Hairline Fan of 13 Wide Pulled-Back Sculpted Ribs per Side (Covers 100% of Crown, Temple, Ear-Arch & Lower Nape!)
      const pulledRibSpecs = [
        // Upper Forehead & Crown Ribs (start underneath the bangs at el=42..30 and arch over the crown into the tie)
        { azS:  14, elS: 42, azE: 172, elE: 43, boost: 22, arch: 0.028, wS: 0.044, wMid: 0.054, th: 0.024 },
        { azS:  26, elS: 38, azE: 173, elE: 42, boost: 20, arch: 0.028, wS: 0.046, wMid: 0.056, th: 0.024 },
        { azS:  38, elS: 28, azE: 174, elE: 41, boost: 18, arch: 0.027, wS: 0.046, wMid: 0.056, th: 0.024 },
        // Temple & Pre-Auricular Ribs (start right behind the sideburns at el=14..-14 and sweep back above the ear)
        { azS:  50, elS: 14, azE: 175, elE: 40, boost: 15, arch: 0.026, wS: 0.048, wMid: 0.056, th: 0.024 },
        { azS:  62, elS: -4, azE: 176, elE: 39, boost: 12, arch: 0.025, wS: 0.048, wMid: 0.056, th: 0.024 },
        { azS:  74, elS:-16, azE: 176, elE: 38, boost: 10, arch: 0.024, wS: 0.048, wMid: 0.054, th: 0.023 },
        // Ear-Arch & Post-Auricular Ribs (start around/behind the ear at el=-18..-30 and sweep up-back into the tie)
        { azS:  86, elS:-18, azE: 177, elE: 37, boost:  9, arch: 0.024, wS: 0.048, wMid: 0.054, th: 0.023 },
        { azS:  98, elS:-30, azE: 177, elE: 36, boost:  8, arch: 0.023, wS: 0.050, wMid: 0.056, th: 0.023 },
        // Bottom Nape Hairline Ribs (start at the Chibi nape el=-36..-44 and sweep UPWARD into the tie!)
        { azS: 110, elS:-36, azE: 178, elE: 35, boost:  6, arch: 0.022, wS: 0.050, wMid: 0.056, th: 0.023 },
        { azS: 124, elS:-40, azE: 178, elE: 34, boost:  5, arch: 0.022, wS: 0.050, wMid: 0.056, th: 0.022 },
        { azS: 138, elS:-42, azE: 179, elE: 33, boost:  4, arch: 0.021, wS: 0.050, wMid: 0.054, th: 0.022 },
        { azS: 154, elS:-44, azE: 179, elE: 32, boost:  4, arch: 0.020, wS: 0.048, wMid: 0.052, th: 0.022 },
        { azS: 168, elS:-44, azE: 180, elE: 32, boost:  3, arch: 0.020, wS: 0.048, wMid: 0.052, th: 0.022 },
      ];

      for (let side of [-1, 1]) {
        for (let rb of pulledRibSpecs) {
          addPulledToTieRib({
            azStart: side * rb.azS,
            elStart: rb.elS,
            azEnd: side * rb.azE,
            elEnd: rb.elE,
            elMidBoost: rb.boost,
            archLift: rb.arch,
            wStart: rb.wS,
            wMid: rb.wMid,
            thick: rb.th,
            steps: 11,
            shadeRoot: (rb.elS < -20) ? 0.86 : 0.92,
            shadeTip: 0.97,
            profileType: "double",
            twist: side * 0.05,
          });
        }
      }

      // Center-Back Nape Vertical Pulled Rib (az=180, el=-44 -> el=32)
      addPulledToTieRib({
        azStart: 180, elStart: -44,
        azEnd: 180, elEnd: 32,
        elMidBoost: 3,
        archLift: 0.020,
        wStart: 0.050, wMid: 0.054, thick: 0.022,
        steps: 10,
        shadeRoot: 0.86, shadeTip: 0.96,
        profileType: "double",
      });

      // 3. 2-Layer Sideburn & Temple Tufts in Front of Ear (ปิดโคนผมหน้าใบหูเต็ม 100% + 4 ช่อจอนปลายแหลมไล่ระดับตามภาพ image_706943dc.png!)
      const innerSideburnCover = [
        { azS: 38, elS: 68, azD: 44, elD: -6,  len: 0.145, wS: 0.032, wMid: 0.048, arch: 0.022, dx: 0.06, dz: 0.18 },
        { azS: 52, elS: 64, azD: 58, elD: -14, len: 0.135, wS: 0.032, wMid: 0.048, arch: 0.022, dx: 0.05, dz: 0.14 },
        { azS: 66, elS: 58, azD: 73, elD: -18, len: 0.120, wS: 0.032, wMid: 0.046, arch: 0.020, dx: 0.04, dz: 0.10 },
      ];
      for (let side of [-1, 1]) {
        for (let ic of innerSideburnCover) {
          addSculptedAnimeLock({
            azStart: side * ic.azS, elStart: ic.elS,
            azDepart: side * ic.azD, elDepart: ic.elD,
            tailLen: ic.len,
            archLift: ic.arch,
            departLift: 0.005,
            dirX: side * ic.dx, dirY: -0.97, dirZ: ic.dz,
            tipFlickOut: -0.004,
            tipFlickSide: -side * 0.012,
            wStart: ic.wS, wMid: ic.wMid, thick: 0.022,
            wrapSteps: 6, tailSteps: 6,
            shadeRoot: 0.88, shadeTip: 1.02,
            rootDepth: 0.002, gravity: 0.008,
            flexMax: 0.26,
            profileType: "double",
            taperStart: 0.48,
            twist: side * 0.08,
          });
        }
      }

      const sideburnTufts = [
        // Tuft 1: Back-most Pre-Auricular Sideburn right in front of the ear
        { azS: 66, elS: 62, azD: 75, elD:  2, len: 0.138, wS: 0.026, wMid: 0.042, arch: 0.028, dx: 0.05, dz: 0.12, flickOut: -0.004, flickSide: 0.010, prof: "double" },
        // Tuft 2: Shorter Staggered Mid-Sideburn Tuft
        { azS: 54, elS: 66, azD: 63, elD:  8, len: 0.126, wS: 0.024, wMid: 0.040, arch: 0.030, dx: 0.06, dz: 0.16, flickOut: -0.004, flickSide: 0.012, prof: "single" },
        // Tuft 3: Longer Pointed Cheek-Sideburn Lock
        { azS: 42, elS: 70, azD: 51, elD: 12, len: 0.175, wS: 0.026, wMid: 0.046, arch: 0.032, dx: 0.06, dz: 0.22, flickOut: -0.006, flickSide: 0.016, prof: "double" },
        // Tuft 4: Forward-Swept Upper-Cheek Framing Lock
        { azS: 30, elS: 74, azD: 39, elD: 18, len: 0.192, wS: 0.026, wMid: 0.046, arch: 0.034, dx: 0.08, dz: 0.28, flickOut:  0.006, flickSide: 0.020, prof: "double" },
      ];

      for (let side of [-1, 1]) {
        for (let st of sideburnTufts) {
          addSculptedAnimeLock({
            azStart: side * st.azS, elStart: st.elS,
            azDepart: side * st.azD, elDepart: st.elD,
            tailLen: st.len,
            archLift: st.arch,
            departLift: 0.010,
            dirX: side * st.dx, dirY: -0.95, dirZ: st.dz,
            tipFlickOut: st.flickOut,
            tipFlickSide: -side * st.flickSide,
            wStart: st.wS, wMid: st.wMid, thick: 0.024,
            wrapSteps: 6, tailSteps: 7,
            shadeRoot: 0.91, shadeTip: 1.05,
            rootDepth: 0.003, gravity: 0.008,
            flexMax: 0.28,
            profileType: st.prof,
            taperStart: 0.46,
            twist: side * 0.10,
          });
        }
      }

      // 4. Lush Full-Root Forward-Swept Layered Bangs + Loose Overlay Wisps (หน้าม้าหนาเต็มโคนปัดเฉียงพุ่งไปด้านหน้าแบบ image_706943dc.png!)
      const forwardBangs = [
        { azR: -22, elR: 44, elP: 74, azD: -33, elD: 22, len: 0.162, wS: 0.032, wMid: 0.048, arch: 0.036, upY: 0.020, dx: -0.08, dz: 0.26, flickOut: 0.012, flickSide:  0.016, prof: "double" },
        { azR: -13, elR: 42, elP: 75, azD: -21, elD: 25, len: 0.136, wS: 0.034, wMid: 0.052, arch: 0.038, upY: 0.022, dx:  0.14, dz: 0.28, flickOut: 0.010, flickSide:  0.016, prof: "double" },
        { azR:  -4, elR: 41, elP: 76, azD:  -8, elD: 26, len: 0.128, wS: 0.034, wMid: 0.054, arch: 0.040, upY: 0.024, dx:  0.22, dz: 0.30, flickOut: 0.010, flickSide:  0.018, prof: "double" },
        { azR:   4, elR: 41, elP: 76, azD:   6, elD: 26, len: 0.130, wS: 0.034, wMid: 0.054, arch: 0.040, upY: 0.024, dx:  0.26, dz: 0.30, flickOut: 0.012, flickSide:  0.018, prof: "double" },
        { azR:  13, elR: 42, elP: 75, azD:  19, elD: 25, len: 0.142, wS: 0.034, wMid: 0.052, arch: 0.038, upY: 0.022, dx:  0.24, dz: 0.28, flickOut: 0.014, flickSide:  0.020, prof: "double" },
        { azR:  22, elR: 44, elP: 74, azD:  31, elD: 22, len: 0.168, wS: 0.032, wMid: 0.048, arch: 0.036, upY: 0.020, dx:  0.14, dz: 0.26, flickOut: 0.016, flickSide:  0.022, prof: "double" },
      ];

      for (let fb of forwardBangs) {
        addPartedArchLock({
          azRoot: fb.azR, elRoot: fb.elR,
          elPeak: fb.elP,
          azDepart: fb.azD, elDepart: fb.elD,
          tailLen: fb.len,
          archLift: fb.arch,
          archUpY: fb.upY,
          rootLift: 0.004,
          departLift: 0.014,
          dirX: fb.dx, dirY: -0.92, dirZ: fb.dz,
          tipFlickOut: fb.flickOut,
          tipFlickSide: fb.flickSide,
          wStart: fb.wS, wMid: fb.wMid, thick: 0.025,
          archSteps: 8, tailSteps: 6,
          shadeRoot: 0.92, shadeTip: 1.06,
          gravity: 0.008,
          flexMax: 0.28,
          profileType: fb.prof,
          taperStart: 0.46,
          swellEnd: 0.28,
          twist: 0.14,
        });
      }

      // High-Arched Narrow Overlay Wisps Crossing the Bangs (ปอยเส้นเล็กที่ลอยโค้งซ้อนทับหน้าม้าตามภาพ image_706943dc.png!)
      const overlayWisps = [
        { azR: -10, elR: 54, elP: 78, azD:  -6, elD: 30, len: 0.132, wMid: 0.028, arch: 0.048, upY: 0.026, dx:  0.32, dz: 0.34, flickOut: 0.018, flickSide:  0.018 },
        { azR:   2, elR: 56, elP: 79, azD:  10, elD: 29, len: 0.138, wMid: 0.028, arch: 0.050, upY: 0.028, dx:  0.34, dz: 0.34, flickOut: 0.020, flickSide:  0.020 },
        { azR:  12, elR: 54, elP: 77, azD:  24, elD: 27, len: 0.144, wMid: 0.026, arch: 0.046, upY: 0.024, dx:  0.26, dz: 0.32, flickOut: 0.022, flickSide:  0.022 },
      ];
      for (let ow of overlayWisps) {
        addPartedArchLock({
          azRoot: ow.azR, elRoot: ow.elR,
          elPeak: ow.elP,
          azDepart: ow.azD, elDepart: ow.elD,
          tailLen: ow.len,
          archLift: ow.arch,
          archUpY: ow.upY,
          rootLift: 0.005,
          departLift: 0.020,
          dirX: ow.dx, dirY: -0.90, dirZ: ow.dz,
          tipFlickOut: ow.flickOut,
          tipFlickSide: ow.flickSide,
          wStart: 0.018, wMid: ow.wMid, thick: 0.021,
          archSteps: 8, tailSteps: 6,
          shadeRoot: 0.95, shadeTip: 1.08,
          gravity: 0.006,
          flexMax: 0.32,
          profileType: "single",
          taperStart: 0.42,
          swellEnd: 0.30,
          twist: 0.22,
        });
      }

      // 5. 3D Sculpted Torus Hair Tie / Band at (az=180, el=38) (ยางมัดผมทรงโดนัท 3 มิติตามภาพ!)
      const tieRoot = getHairRoot(tieAz, tieEl, 0.006, false);
      const tieCenter = tieRoot.p;
      const axisY = 0.62;
      const axisZ = -0.7846;
      const U_tie = [1.0, 0.0, 0.0];
      const V_tie = [0.0, -axisZ, axisY];
      const majorR = 0.050;
      const tubeR = 0.017;
      const nRing = 20;
      const nTube = 10;
      const torusGrid = [];

      for (let i = 0; i <= nRing; i++) {
        const phi = (i / nRing) * Math.PI * 2.0;
        const cosP = Math.cos(phi);
        const sinP = Math.sin(phi);
        const rx = U_tie[0] * cosP + V_tie[0] * sinP;
        const ry = U_tie[1] * cosP + V_tie[1] * sinP;
        const rz = U_tie[2] * cosP + V_tie[2] * sinP;

        const ringCol = [];
        for (let j = 0; j <= nTube; j++) {
          const theta = (j / nTube) * Math.PI * 2.0;
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);

          const px = tieCenter[0] + rx * (majorR + tubeR * cosT);
          const py = tieCenter[1] + ry * (majorR + tubeR * cosT) + axisY * (tubeR * sinT);
          const pz = tieCenter[2] + rz * (majorR + tubeR * cosT) + axisZ * (tubeR * sinT);

          const shade = 0.84 + 0.14 * (0.5 + 0.5 * cosT);
          const groove = (cosT < -0.2) ? 0.22 : 0.04;
          ringCol.push(addVertex([px, py, pz], shade, (cosT > 0.6 ? 0.08 : 0.0), 0.03, groove));
        }
        torusGrid.push(ringCol);
      }

      for (let i = 0; i < nRing; i++) {
        for (let j = 0; j < nTube; j++) {
          addQuad(
            torusGrid[i][j],
            torusGrid[i + 1][j],
            torusGrid[i + 1][j + 1],
            torusGrid[i][j + 1]
          );
        }
      }

      // 6. High-Fountain Sculpted Multi-Strand Ponytail + Airy Outer Ribbon Loops
      const addFountainPonytailLock = (cfg) => {
        const {
          P0, P1, P2, P3,
          outNormal = [0.0, 0.35, -0.94],
          wStart = 0.020,
          wMid = 0.064,
          thick = 0.028,
          steps = 14,
          shadeRoot = 0.88,
          shadeTip = 1.06,
          profileType = "double",
          taperStart = 0.54,
          swellEnd = 0.22,
          flexMax = 0.95,
          twist = 0.0
        } = cfg;

        const nLen = Math.hypot(outNormal[0], outNormal[1], outNormal[2]) || 1;
        const N_ref = [outNormal[0] / nLen, outNormal[1] / nLen, outNormal[2] / nLen];

        const samples = [];
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          const invU = 1.0 - u;
          const b0 = invU * invU * invU;
          const b1 = 3.0 * invU * invU * u;
          const b2 = 3.0 * invU * u * u;
          const b3 = u * u * u;

          // Keep root P0 anchored at the tie, and scale ponytail fountain reach to match the compact Chibi body
          const px = P0[0] + (b1 * (P1[0] - P0[0]) + b2 * (P2[0] - P0[0]) + b3 * (P3[0] - P0[0])) * 0.76;
          const py = P0[1] + (b1 * (P1[1] - P0[1]) + b2 * (P2[1] - P0[1]) + b3 * (P3[1] - P0[1])) * 0.72;
          const pz = P0[2] + (b1 * (P1[2] - P0[2]) + b2 * (P2[2] - P0[2]) + b3 * (P3[2] - P0[2])) * 0.76;

          samples.push({
            p: [px, py, pz],
            n: N_ref,
            u,
            // Root (s=0) anchored inside the hair tie (0.0), then progressive soft whip curve (u^1.42) to tip!
            flex: (s === 0) ? 0.0 : (Math.pow(u, 1.42) * flexMax),
            twist: twist * Math.sin(u * Math.PI * 0.85),
          });
        }

        buildBeveledCurveStrand(samples, wStart * 0.84, wMid * 0.84, thick * 0.78, shadeRoot, shadeTip, null, profileType, taperStart, swellEnd);
      };

      // Layer A: Broad, Voluminous Sculpted Double-Ridge Ponytail Body Clumps
      const mainPonytailClumps = [
        // Top-Center Highest Fountain Crest Lock (arches high and far back like image_706943dc!)
        {
          P0: [ 0.000, 0.168, -0.202],
          P1: [ 0.000, 0.375, -0.355],
          P2: [ 0.000, 0.045, -0.475],
          P3: [ 0.000,-0.355, -0.285],
          n:  [ 0.00,  0.45,  -0.89],
          wS: 0.024, wMid: 0.068, th: 0.030, tw: 0.00
        },
        // Upper-Left & Upper-Right Fountain Crest Locks
        {
          P0: [-0.018, 0.164, -0.200],
          P1: [-0.072, 0.360, -0.345],
          P2: [-0.084, 0.025, -0.455],
          P3: [-0.015,-0.345, -0.285],
          n:  [-0.68,  0.35,  -0.64],
          wS: 0.022, wMid: 0.066, th: 0.029, tw: -0.12
        },
        {
          P0: [ 0.018, 0.164, -0.200],
          P1: [ 0.072, 0.360, -0.345],
          P2: [ 0.084, 0.025, -0.455],
          P3: [ 0.015,-0.345, -0.285],
          n:  [ 0.68,  0.35,  -0.64],
          wS: 0.022, wMid: 0.066, th: 0.029, tw:  0.12
        },
        // Mid-Lateral Wide Profile Clumps (gives the thick, broad side silhouette in image_706943dc & image_99e99ad4!)
        {
          P0: [-0.026, 0.152, -0.198],
          P1: [-0.102, 0.310, -0.315],
          P2: [-0.114,-0.015, -0.405],
          P3: [-0.028,-0.315, -0.270],
          n:  [-0.88,  0.15,  -0.45],
          wS: 0.022, wMid: 0.070, th: 0.029, tw: -0.16
        },
        {
          P0: [ 0.026, 0.152, -0.198],
          P1: [ 0.102, 0.310, -0.315],
          P2: [ 0.114,-0.015, -0.405],
          P3: [ 0.028,-0.315, -0.270],
          n:  [ 0.88,  0.15,  -0.45],
          wS: 0.022, wMid: 0.070, th: 0.029, tw:  0.16
        },
        // Inner-Front (Neck-Facing) Support Clumps
        {
          P0: [-0.016, 0.140, -0.194],
          P1: [-0.062, 0.245, -0.280],
          P2: [-0.068,-0.040, -0.335],
          P3: [-0.018,-0.285, -0.255],
          n:  [-0.75, -0.15,   0.64],
          wS: 0.020, wMid: 0.058, th: 0.026, tw:  0.10
        },
        {
          P0: [ 0.016, 0.140, -0.194],
          P1: [ 0.062, 0.245, -0.280],
          P2: [ 0.068,-0.040, -0.335],
          P3: [ 0.018,-0.285, -0.255],
          n:  [ 0.75, -0.15,   0.64],
          wS: 0.020, wMid: 0.058, th: 0.026, tw: -0.10
        },
        // Deep Central Core Filler Clump
        {
          P0: [ 0.000, 0.150, -0.198],
          P1: [ 0.000, 0.305, -0.315],
          P2: [ 0.000,-0.020, -0.390],
          P3: [ 0.000,-0.325, -0.270],
          n:  [ 0.00,  0.20,  -0.98],
          wS: 0.024, wMid: 0.072, th: 0.030, tw:  0.00
        },
      ];

      for (let mc of mainPonytailClumps) {
        addFountainPonytailLock({
          P0: mc.P0, P1: mc.P1, P2: mc.P2, P3: mc.P3,
          outNormal: mc.n,
          wStart: mc.wS, wMid: mc.wMid, thick: mc.th,
          steps: 14,
          shadeRoot: 0.88, shadeTip: 1.05,
          profileType: "double",
          taperStart: 0.54,
          swellEnd: 0.22,
          flexMax: 0.90,
          twist: mc.tw,
        });
      }

      // Layer B: Signature Freestanding Airy Outer Ribbon Loops (เส้นปอยผมโปร่งโค้งโอบด้านนอกหางม้าตามภาพ image_706943dc & image_99e99ad4!)
      const airyOuterLoops = [
        // 1. Back-Outer High Arch Loops (forms the airy gap on the back edge of the ponytail in image_706943dc!)
        {
          P0: [ 0.000, 0.166, -0.204],
          P1: [ 0.020, 0.385, -0.385],
          P2: [ 0.028, 0.015, -0.525],
          P3: [ 0.010,-0.295, -0.315],
          n:  [ 0.15,  0.35,  -0.92],
          wS: 0.012, wMid: 0.024, th: 0.019, tw: 0.15
        },
        {
          P0: [-0.012, 0.162, -0.202],
          P1: [-0.052, 0.370, -0.380],
          P2: [-0.068,-0.020, -0.510],
          P3: [-0.024,-0.278, -0.310],
          n:  [-0.45,  0.30,  -0.84],
          wS: 0.012, wMid: 0.024, th: 0.019, tw: -0.18
        },
        // 2. Neck-Facing Forward Arch Loops (forms the graceful curved strand between ear/neck and ponytail in image_706943dc!)
        {
          P0: [-0.022, 0.138, -0.192],
          P1: [-0.084, 0.185, -0.235],
          P2: [-0.095,-0.055, -0.248],
          P3: [-0.026,-0.255, -0.250],
          n:  [-0.82, -0.10,   0.56],
          wS: 0.012, wMid: 0.022, th: 0.018, tw: 0.18
        },
        {
          P0: [ 0.022, 0.138, -0.192],
          P1: [ 0.084, 0.185, -0.235],
          P2: [ 0.095,-0.055, -0.248],
          P3: [ 0.026,-0.255, -0.250],
          n:  [ 0.82, -0.10,   0.56],
          wS: 0.012, wMid: 0.022, th: 0.018, tw: -0.18
        },
        // 3. Lateral Flank S-Curve Loops (forms the side-loop ribbons with daylight gaps in image_99e99ad4!)
        {
          P0: [-0.028, 0.156, -0.200],
          P1: [-0.138, 0.320, -0.335],
          P2: [-0.156,-0.030, -0.430],
          P3: [-0.042,-0.275, -0.290],
          n:  [-0.94,  0.15,  -0.30],
          wS: 0.012, wMid: 0.024, th: 0.019, tw: -0.22
        },
        {
          P0: [ 0.028, 0.156, -0.200],
          P1: [ 0.138, 0.320, -0.335],
          P2: [ 0.156,-0.030, -0.430],
          P3: [ 0.042,-0.275, -0.290],
          n:  [ 0.94,  0.15,  -0.30],
          wS: 0.012, wMid: 0.024, th: 0.019, tw:  0.22
        },
        // 4. Lower Spiral Cross-Over Wisps
        {
          P0: [-0.020, 0.158, -0.202],
          P1: [-0.104, 0.335, -0.355],
          P2: [-0.050,-0.075, -0.485],
          P3: [ 0.016,-0.330, -0.290],
          n:  [-0.55,  0.20,  -0.81],
          wS: 0.012, wMid: 0.026, th: 0.020, tw:  0.25
        },
        {
          P0: [ 0.020, 0.158, -0.202],
          P1: [ 0.104, 0.335, -0.355],
          P2: [ 0.050,-0.075, -0.485],
          P3: [-0.016,-0.330, -0.290],
          n:  [ 0.55,  0.20,  -0.81],
          wS: 0.012, wMid: 0.026, th: 0.020, tw: -0.25
        },
      ];

      for (let al of airyOuterLoops) {
        addFountainPonytailLock({
          P0: al.P0, P1: al.P1, P2: al.P2, P3: al.P3,
          outNormal: al.n,
          wStart: al.wS, wMid: al.wMid, thick: al.th,
          steps: 14,
          shadeRoot: 0.94, shadeTip: 1.08,
          profileType: "single",
          taperStart: 0.45,
          swellEnd: 0.24,
          flexMax: 0.96,
          twist: al.tw,
        });
      }
    };

    if (activeStyle !== 5 && activeStyle !== 7 && activeStyle !== 8) {
      buildSculptedCrownSidesAndShingledBack(activeStyle === 6);
    }

    switch (activeStyle) {
      case 0: {
        buildStandardBangs(1.0);
        buildSculptedTopAhogeCrest();
        break;
      }
      case 1: {
        buildStandardBangs(0.95);
        const hornRedRgb = [0.90, 0.20, 0.26];
        addHairStrand(-38, 64, 0.22, 0.028, -0.68, 0.82, -0.28, 0.028, 0.054, 0.024, 8, 0.90, 1.08, 0.004, -0.03, hornRedRgb, 0.08, "single", 0.015, 0.0);
        addHairStrand( 38, 64, 0.22, 0.028,  0.68, 0.82, -0.28, 0.028, 0.054, 0.024, 8, 0.90, 1.08, 0.004, -0.03, hornRedRgb, 0.08, "single", 0.015, 0.0);
        const violetTipRgb = [0.45, 0.52, 0.88];
        addHairStrand(180, -18, 0.44, 0.024,  0.00, -0.94, -0.32, 0.030, 0.064, 0.024, 10, 0.84, 1.10, 0.004, 0.07, violetTipRgb, 0.65, "double", 0.025, 0.0);
        addHairStrand(168, -22, 0.40, 0.022, -0.20, -0.92, -0.28, 0.026, 0.056, 0.022,  9, 0.86, 1.06, 0.004, 0.06, null, 0.55, "double", 0.022, -0.018);
        addHairStrand(192, -22, 0.40, 0.022,  0.20, -0.92, -0.28, 0.026, 0.056, 0.022,  9, 0.86, 1.06, 0.004, 0.06, null, 0.55, "double", 0.022,  0.018);
        addHairStrand(174, -20, 0.42, 0.026, -0.10, -0.93, -0.30, 0.018, 0.038, 0.018,  9, 0.92, 1.08, 0.005, 0.06, violetTipRgb, 0.60, "single", 0.028, -0.012);
        addHairStrand(186, -20, 0.42, 0.026,  0.10, -0.93, -0.30, 0.018, 0.038, 0.018,  9, 0.92, 1.08, 0.005, 0.06, violetTipRgb, 0.60, "single", 0.028,  0.012);
        buildSculptedTopAhogeCrest();
        break;
      }
      case 2: {
        buildSideSweptHair();
        break;
      }
      case 3: {
        buildStandardBangs(0.95);
        const tieColor = [0.95, 0.32, 0.58];
        addHairStrand(-70, 48, 0.055, 0.024, -0.7, 0.5, -0.3, 0.034, 0.058, 0.024, 5, 1.0, 1.0, 0.004, 0, tieColor, 0.05, "single", 0.0, 0.0);
        addHairStrand( 70, 48, 0.055, 0.024,  0.7, 0.5, -0.3, 0.034, 0.058, 0.024, 5, 1.0, 1.0, 0.004, 0, tieColor, 0.05, "single", 0.0, 0.0);
        for (let side of [-1, 1]) {
          addHairStrand(side * 68, 48, 0.48, 0.038, side * 0.46, -0.94, -0.16, 0.028, 0.060, 0.024, 10, 0.88, 1.06, 0.004, 0.08, null, 0.70, "double", 0.030, side * 0.020);
          addHairStrand(side * 75, 46, 0.45, 0.034, side * 0.52, -0.92, -0.26, 0.024, 0.052, 0.022, 10, 0.86, 1.04, 0.004, 0.08, null, 0.65, "double", 0.026, side * 0.016);
          addHairStrand(side * 63, 46, 0.43, 0.034, side * 0.42, -0.95, -0.06, 0.022, 0.046, 0.020,  9, 0.90, 1.06, 0.005, 0.07, null, 0.65, "single", 0.028, side * 0.024);
          addHairStrand(side * 71, 52, 0.46, 0.044, side * 0.48, -0.93, -0.20, 0.014, 0.032, 0.018,  9, 0.96, 1.08, 0.006, 0.08, null, 0.72, "single", 0.035, -side * 0.018);
        }
        buildSculptedTopAhogeCrest();
        break;
      }
      case 4: {
        buildStandardBangs(0.95);
        const scrunchieRgb = [0.32, 0.85, 0.78];
        addHairStrand(180, 58, 0.065, 0.026, 0.0, 0.4, -0.85, 0.040, 0.064, 0.026, 5, 1.0, 1.0, 0.004, 0, scrunchieRgb, 0.05, "single", 0.0, 0.0);
        addHairStrand(180, 58, 0.48, 0.042,  0.00, -0.88, -0.60, 0.032, 0.066, 0.026, 10, 0.88, 1.08, 0.004, 0.10, null, 0.70, "double", 0.032,  0.000);
        addHairStrand(170, 56, 0.44, 0.038, -0.18, -0.88, -0.58, 0.026, 0.056, 0.022, 10, 0.86, 1.05, 0.004, 0.09, null, 0.65, "double", 0.028, -0.022);
        addHairStrand(190, 56, 0.44, 0.038,  0.18, -0.88, -0.58, 0.026, 0.056, 0.022, 10, 0.86, 1.05, 0.004, 0.09, null, 0.65, "double", 0.028,  0.022);
        addHairStrand(175, 62, 0.46, 0.048, -0.10, -0.86, -0.62, 0.016, 0.036, 0.018,  9, 0.95, 1.08, 0.006, 0.09, null, 0.72, "single", 0.036,  0.018);
        addHairStrand(185, 62, 0.46, 0.048,  0.10, -0.86, -0.62, 0.016, 0.036, 0.018,  9, 0.95, 1.08, 0.006, 0.09, null, 0.72, "single", 0.036, -0.018);
        buildSculptedTopAhogeCrest();
        break;
      }
      case 5: {
        buildCenterPartingCurtainHair();
        break;
      }
      case 6: {
        buildStandardBangs(0.95);
        buildSculptedTopAhogeCrest();
        // 3-Tier Sculpted Beveled Long Anime Cascade
        // Tier A: Deep Inner Beveled Curtain Locks (13 wide double-ridge locks)
        const innerCount = 12;
        for (let i = 0; i <= innerCount; i++) {
          const u = i / innerCount;
          const az = 98 + u * 164;
          const rad = (az * Math.PI) / 180;
          const archCurve = Math.sin(u * Math.PI) * 0.05;
          addSculptedAnimeLock({
            azStart: az, elStart: 68,
            azDepart: az, elDepart: -22,
            tailLen: 0.34 + archCurve,
            archLift: 0.024,
            departLift: 0.006,
            dirX: Math.sin(rad) * 0.06, dirY: -0.99, dirZ: Math.cos(rad) * 0.08,
            tipFlickOut: 0.020,
            tipFlickSide: ((i % 2 === 0) ? 1 : -1) * 0.014,
            wStart: 0.022, wMid: 0.058, thick: 0.022,
            wrapSteps: 6, tailSteps: 8,
            shadeRoot: 0.82, shadeTip: 0.99,
            rootDepth: 0.000, gravity: 0.036,
            flexMax: 0.50,
            profileType: "double",
            taperStart: 0.62,
          });
        }

        // Tier B: Mid-Layer Sculpted Beveled Cascade Locks with Outward J-Flicks (11 locks)
        const midCount = 10;
        for (let i = 0; i <= midCount; i++) {
          const u = i / midCount;
          const az = 102 + u * 156;
          const rad = (az * Math.PI) / 180;
          const stagger = (i % 2 === 0) ? 0.028 : -0.014;
          addSculptedAnimeLock({
            azStart: az, elStart: 78,
            azDepart: az, elDepart: -12,
            tailLen: 0.36 + Math.sin(u * Math.PI) * 0.05 + stagger,
            archLift: 0.030,
            departLift: 0.012,
            dirX: Math.sin(rad) * 0.09, dirY: -0.98, dirZ: Math.cos(rad) * 0.10,
            tipFlickOut: 0.028,
            tipFlickSide: (az < 180 ? -1 : 1) * 0.020,
            wStart: 0.020, wMid: 0.052, thick: 0.024,
            wrapSteps: 6, tailSteps: 8,
            shadeRoot: 0.89, shadeTip: 1.05,
            rootDepth: -0.002, gravity: 0.038,
            flexMax: 0.56,
            profileType: "double",
            taperStart: 0.55,
            twist: (az < 180 ? -0.18 : 0.18),
          });
        }

        // Tier C: Dynamic Outer Diamond-Ridge Wisps & Mid-Back Feathers (9 strands)
        const outerCount = 8;
        for (let i = 0; i <= outerCount; i++) {
          const u = i / outerCount;
          const az = 106 + u * 148;
          const rad = (az * Math.PI) / 180;
          const isMidFeather = (i % 2 === 1);
          addSculptedAnimeLock({
            azStart: az, elStart: 82,
            azDepart: az + (isMidFeather ? 5 : -5), elDepart: isMidFeather ? 4 : -6,
            tailLen: isMidFeather ? 0.22 : 0.37,
            archLift: 0.036,
            departLift: 0.016,
            dirX: Math.sin(rad) * 0.14, dirY: -0.97, dirZ: Math.cos(rad) * 0.12,
            tipFlickOut: 0.034,
            tipFlickSide: (isMidFeather ? 1 : -1) * 0.024,
            wStart: 0.014, wMid: 0.036, thick: 0.020,
            wrapSteps: 6, tailSteps: 8,
            shadeRoot: 0.94, shadeTip: 1.08,
            rootDepth: -0.003, gravity: 0.030,
            flexMax: 0.60,
            profileType: "single",
            taperStart: 0.48,
            twist: (isMidFeather ? 0.25 : -0.25),
          });
        }
        break;
      }
      case 7: {
        buildKemonomimiCenterStrandHair();
        break;
      }
      case 8: {
        buildRibbedHighPonytailHair();
        break;
      }
    }
  }

  // =========================================================================
  // --- 8. Hair Dynamic Physics System ---
  // =========================================================================
  const chibiHairPhysics = {
    enabled: true,
    stiffness: 26.0,
    damping: 8.0,
    inertia: 1.0,
    maxAngle: 1.15,
    pitch: 0.0,
    pitchVel: 0.0,
    yaw: 0.0,
    yawVel: 0.0,
    roll: 0.0,
    rollVel: 0.0,
    lastHeading: 0.0,
    _lastTime: 0.0
  };

  function triggerHairJiggle(impulsePitch = 12.0, impulseYaw = 15.0, impulseRoll = 8.0) {
    chibiHairPhysics.pitchVel += impulsePitch;
    chibiHairPhysics.yawVel += impulseYaw;
    chibiHairPhysics.rollVel += impulseRoll;
  }

  function updateChibiVirtualHair(model, isMovingActive, isSprintingActive, phase) {
    if (!chibiHairPhysics.enabled) {
      if (model && typeof model.setPonytailRotation === "function") {
        model.setPonytailRotation(0, 0, 0, 1);
      }
      return;
    }

    const hairPhys = chibiHairPhysics;
    const nowSec = (typeof performance !== "undefined" ? performance.now() : Date.now()) * 0.001;
    if (!hairPhys._lastTime) hairPhys._lastTime = nowSec;
    const clampedDt = Math.min(0.033, Math.max(0.001, nowSec - hairPhys._lastTime));
    hairPhys._lastTime = nowSec;

    let forcePitch = 0.0;
    let forceYaw = 0.0;
    let forceRoll = 0.0;

    const inertia = hairPhys.inertia;

    if (isMovingActive) {
      const bounce = Math.sin(phase * 2.0);
      forcePitch += bounce * (isSprintingActive ? 11.0 : 6.5) * inertia;
      forcePitch += (isSprintingActive ? 8.0 : 4.0) * inertia;
      const sway = Math.cos(phase);
      forceYaw += sway * (isSprintingActive ? 8.0 : 4.5) * inertia;
      forceRoll += sway * (isSprintingActive ? 6.0 : 3.5) * inertia;
    } else {
      forcePitch += Math.sin(nowSec * 1.5) * 0.9 * inertia;
      forceYaw += Math.cos(nowSec * 1.1) * 1.1 * inertia;
      forceRoll += Math.sin(nowSec * 1.3 + 0.6) * 0.6 * inertia;
    }

    const currentHeading = (typeof window !== "undefined" && typeof window.charHeading !== "undefined") ? window.charHeading : 0.0;
    let dHeading = currentHeading - hairPhys.lastHeading;
    while (dHeading < -Math.PI) dHeading += Math.PI * 2;
    while (dHeading > Math.PI) dHeading -= Math.PI * 2;
    hairPhys.lastHeading = currentHeading;

    const turnRate = Math.max(-8.0, Math.min(8.0, dHeading / clampedDt));
    forceYaw -= turnRate * 1.1 * inertia;
    forceRoll -= turnRate * 0.7 * inertia;

    // 3D Planetary Gravity & Vertical Velocity Pull for Virtual Hair
    const vertVel = (typeof window !== "undefined" && typeof window.playerVerticalVel === "number") ? window.playerVerticalVel : 0.0;
    if (Math.abs(vertVel) > 0.0002) {
      forcePitch += Math.max(-16.0, Math.min(20.0, -vertVel * 280.0)) * inertia;
    }
    if (typeof window !== "undefined" && typeof window.getCharacterMatrix === "function") {
      const m = window.getCharacterMatrix();
      if (m && m.length >= 16) {
        const px = m[12], py = m[13], pz = m[14];
        const pLen = Math.hypot(px, py, pz) || 1.0;
        const gx = -px / pLen, gy = -py / pLen, gz = -pz / pLen;
        const rLen = Math.hypot(m[0], m[1], m[2]) || 1.0;
        const nLen = Math.hypot(m[4], m[5], m[6]) || 1.0;
        const fLen = Math.hypot(m[8], m[9], m[10]) || 1.0;
        const gravLocalX = (gx * m[0] + gy * m[1] + gz * m[2]) / rLen;
        const gravLocalY = (gx * m[4] + gy * m[5] + gz * m[6]) / nLen;
        const gravLocalZ = (gx * m[8] + gy * m[9] + gz * m[10]) / fLen;
        // Soft natural gravity pendulum target for the ponytail
        const targetPitch = Math.max(0.0, -gravLocalZ * 0.65 + (gravLocalY + 1.0) * 0.48);
        const targetYaw   = gravLocalX * 0.55;
        const targetRoll  = gravLocalX * 0.45;
        forcePitch += targetPitch * hairPhys.stiffness * inertia;
        forceYaw   += targetYaw   * hairPhys.stiffness * inertia;
        forceRoll  += targetRoll  * hairPhys.stiffness * inertia;
      }
    }

    const stiffness = hairPhys.stiffness;
    const damping = hairPhys.damping;
    const subSteps = 2;
    const subDt = clampedDt / subSteps;

    for (let s = 0; s < subSteps; s++) {
      const accPitch = -stiffness * hairPhys.pitch - damping * hairPhys.pitchVel + forcePitch;
      const accYaw   = -stiffness * hairPhys.yaw   - damping * hairPhys.yawVel   + forceYaw;
      const accRoll  = -stiffness * hairPhys.roll  - damping * hairPhys.rollVel  + forceRoll;

      hairPhys.pitchVel += accPitch * subDt;
      hairPhys.yawVel   += accYaw   * subDt;
      hairPhys.rollVel  += accRoll  * subDt;

      hairPhys.pitch += hairPhys.pitchVel * subDt;
      hairPhys.yaw   += hairPhys.yawVel   * subDt;
      hairPhys.roll  += hairPhys.rollVel  * subDt;
    }

    const maxA = hairPhys.maxAngle;
    // Clamp inward pitch (-0.06) so the ponytail never rotates forward into the back of the Chibi head!
    hairPhys.pitch = Math.max(-0.06, Math.min(maxA, hairPhys.pitch));
    hairPhys.yaw   = Math.max(-maxA, Math.min(maxA, hairPhys.yaw));
    hairPhys.roll  = Math.max(-maxA, Math.min(maxA, hairPhys.roll));

    if (model && typeof model.setPonytailRotation === "function") {
      const p = hairPhys.pitch, y = hairPhys.yaw, r = hairPhys.roll;
      const cp = Math.cos(p * 0.5), sp = Math.sin(p * 0.5);
      const cy = Math.cos(y * 0.5), sy = Math.sin(y * 0.5);
      const cr = Math.cos(r * 0.5), sr = Math.sin(r * 0.5);

      const qx = sp * cy * cr + cp * sy * sr;
      const qy = cp * sy * cr - sp * cy * sr;
      const qz = cp * cy * sr + sp * sy * cr;
      const qw = cp * cy * cr - sp * sy * sr;

      model.setPonytailRotation(qx, qy, qz, qw);
    }
  }

  // =========================================================================
  // --- 9. Clothes, Traveler Hoodie & Cloak Dynamic Physics System ---
  // =========================================================================
  function _createDefaultHoodiePhysState() {
    return {
      enabled: true,
      stiffness: 58.0,
      damping: 13.0,
      tipStiffness: 28.0,
      tipDamping: 8.2,
      inertia: 1.0,
      maxAngle: 0.45,
      gravity: 0.055,
      pitch: 0.0,
      pitchVel: 0.0,
      yaw: 0.0,
      yawVel: 0.0,
      roll: 0.0,
      rollVel: 0.0,
      yawLag: 0.0,
      vYaw: 0.0,
      // 3D Local Planetary Gravity & Dual-Stage Pendulum Spring State (matches Hair Physics)
      gx: 0.0, vx: 0.0,
      gy: 0.0, vy: 0.0,
      gz: 0.0, vz: 0.0,
      tx: 0.0, vtx: 0.0,
      ty: 0.0, vty: 0.0,
      tz: 0.0, vtz: 0.0,
      gravLocalX: 0.0,
      gravLocalY: -1.0,
      gravLocalZ: 0.0,
      airX: 0.0,
      airY: 0.0,
      airZ: 0.0,
      airFlare: 0.0,
      windTurb: 0.0,
      lastPx: null,
      lastPy: null,
      lastPz: null,
      lastGrounded: true,
      lastHeading: null,
      _lastTime: 0.0
    };
  }

  const chibiHoodiePhysics = _createDefaultHoodiePhysState();
  const chibiCloneHoodiePhysics = _createDefaultHoodiePhysState();

  function triggerHoodieJiggle(impulsePitch = 10.0, impulseYaw = 12.0, impulseRoll = 6.0) {
    chibiHoodiePhysics.pitchVel += impulsePitch;
    chibiHoodiePhysics.yawVel += impulseYaw;
    chibiHoodiePhysics.rollVel += impulseRoll;
    chibiHoodiePhysics.vy -= 0.12;
    chibiHoodiePhysics.vty -= 0.18;
  }

  function updateChibiHoodiePhysics(isMovingActive, isSprintingActive, phase, currentHeading, physContext = null) {
    const isCloneEntity = !!(physContext && physContext.isClone);
    const hoodiePhys = (physContext && physContext.hoodiePhysics)
      ? physContext.hoodiePhysics
      : (isCloneEntity ? chibiCloneHoodiePhysics : chibiHoodiePhysics);
    if (!hoodiePhys.enabled) {
      hoodiePhys.pitch = 0.0; hoodiePhys.yaw = 0.0; hoodiePhys.roll = 0.0;
      hoodiePhys.yawLag = 0.0; hoodiePhys.vYaw = 0.0;
      hoodiePhys.gx = 0.0; hoodiePhys.gy = 0.0; hoodiePhys.gz = 0.0;
      hoodiePhys.tx = 0.0; hoodiePhys.ty = 0.0; hoodiePhys.tz = 0.0;
      hoodiePhys.airX = 0.0; hoodiePhys.airY = 0.0; hoodiePhys.airZ = 0.0;
      hoodiePhys.airFlare = 0.0; hoodiePhys.windTurb = 0.0;
      hoodiePhys.gravLocalX = 0.0; hoodiePhys.gravLocalY = -1.0; hoodiePhys.gravLocalZ = 0.0;
      return;
    }

    const nowSec = (typeof performance !== "undefined" ? performance.now() : Date.now()) * 0.001;
    if (!hoodiePhys._lastTime) hoodiePhys._lastTime = nowSec;
    const clampedDt = Math.min(0.033, Math.max(0.004, nowSec - hoodiePhys._lastTime));
    hoodiePhys._lastTime = nowSec;

    const inertia = hoodiePhys.inertia;

    // 1. Project 3D Planetary Gravity Vector (-normalize(worldPos)) into Character Local Space (R, N, F)
    let R_ax = [1.0, 0.0, 0.0];
    let N_ax = [0.0, 1.0, 0.0];
    let F_ax = [0.0, 0.0, 1.0];
    let worldPx = 0.0, worldPy = 1.0, worldPz = 0.0;
    let hasOrientation = false;

    if (physContext && physContext.R && physContext.N && physContext.F && physContext.worldPos) {
      R_ax = physContext.R;
      N_ax = physContext.N;
      F_ax = physContext.F;
      worldPx = physContext.worldPos[0];
      worldPy = physContext.worldPos[1];
      worldPz = physContext.worldPos[2];
      hasOrientation = true;
    } else if (!isCloneEntity && typeof window !== "undefined" && typeof window.getCharacterMatrix === "function") {
      const m = window.getCharacterMatrix();
      if (m && m.length >= 16) {
        const rLen = Math.hypot(m[0], m[1], m[2]) || 1.0;
        const nLen = Math.hypot(m[4], m[5], m[6]) || 1.0;
        const fLen = Math.hypot(m[8], m[9], m[10]) || 1.0;
        R_ax = [m[0] / rLen, m[1] / rLen, m[2] / rLen];
        N_ax = [m[4] / nLen, m[5] / nLen, m[6] / nLen];
        F_ax = [m[8] / fLen, m[9] / fLen, m[10] / fLen];
        worldPx = m[12];
        worldPy = m[13];
        worldPz = m[14];
        hasOrientation = true;
      }
    }

    // Apply optional body pitch/tilt (e.g., rowing, aiming)
    const bodyTilt = (physContext && typeof physContext.torsoTilt === "number") ? physContext.torsoTilt : 0.0;
    if (hasOrientation && Math.abs(bodyTilt) > 0.001) {
      const ct = Math.cos(bodyTilt);
      const st = Math.sin(bodyTilt);
      const nTilt = [N_ax[0] * ct + F_ax[0] * st, N_ax[1] * ct + F_ax[1] * st, N_ax[2] * ct + F_ax[2] * st];
      const fTilt = [-N_ax[0] * st + F_ax[0] * ct, -N_ax[1] * st + F_ax[1] * ct, -N_ax[2] * st + F_ax[2] * ct];
      N_ax = nTilt;
      F_ax = fTilt;
    }

    let gravLocalX = 0.0, gravLocalY = -1.0, gravLocalZ = 0.0;
    if (hasOrientation) {
      const rpLen = Math.hypot(worldPx, worldPy, worldPz) || 1.0;
      const gwx = -worldPx / rpLen;
      const gwy = -worldPy / rpLen;
      const gwz = -worldPz / rpLen;
      gravLocalX = gwx * R_ax[0] + gwy * R_ax[1] + gwz * R_ax[2];
      gravLocalY = gwx * N_ax[0] + gwy * N_ax[1] + gwz * N_ax[2];
      gravLocalZ = gwx * F_ax[0] + gwy * F_ax[1] + gwz * F_ax[2];
    }
    hoodiePhys.gravLocalX = gravLocalX;
    hoodiePhys.gravLocalY = gravLocalY;
    hoodiePhys.gravLocalZ = gravLocalZ;

    // Gravity delta relative to upright rest pose [0, -1, 0], plus gentle downward drape when upright
    const gravDeltaX = gravLocalX;
    const gravDeltaY = gravLocalY + 1.0;
    const gravDeltaZ = gravLocalZ;
    const steadyDrapeY = -0.018 * Math.max(0.0, -gravLocalY);

    // 2. World Movement Delta, Grounded Landing Impact & Heading Turn Lag (aligned with Hair Physics)
    const isRag = !!(physContext && physContext.isRagdoll);
    const vertVel = (physContext && typeof physContext.vertVel === "number")
      ? physContext.vertVel
      : (!isCloneEntity && typeof window !== "undefined" && typeof window.playerVerticalVel === "number" ? window.playerVerticalVel : 0.0);
    const isGrounded = (physContext && typeof physContext.isGrounded === "boolean")
      ? physContext.isGrounded
      : (!isCloneEntity && typeof window !== "undefined" && typeof window.isPlayerGrounded === "boolean" ? window.isPlayerGrounded : true);

    const headingNow = (typeof currentHeading === "number" && !isNaN(currentHeading)) ? currentHeading : 0.0;
    if (hoodiePhys.lastPx === null || hoodiePhys.lastHeading === null) {
      hoodiePhys.lastPx = worldPx;
      hoodiePhys.lastPy = worldPy;
      hoodiePhys.lastPz = worldPz;
      hoodiePhys.lastHeading = headingNow;
      hoodiePhys.lastGrounded = isGrounded;
    }

    const rawDx = Math.max(-0.25, Math.min(0.25, worldPx - hoodiePhys.lastPx));
    const rawDy = Math.max(-0.25, Math.min(0.25, worldPy - hoodiePhys.lastPy));
    const rawDz = Math.max(-0.25, Math.min(0.25, worldPz - hoodiePhys.lastPz));
    hoodiePhys.lastPx = worldPx;
    hoodiePhys.lastPy = worldPy;
    hoodiePhys.lastPz = worldPz;

    let dHeading = headingNow - hoodiePhys.lastHeading;
    while (dHeading < -Math.PI) dHeading += Math.PI * 2;
    while (dHeading > Math.PI) dHeading -= Math.PI * 2;
    hoodiePhys.lastHeading = headingNow;

    let dhx = 0.0, dhy = 0.0, dhz = 0.0;
    if (isRag) {
      dhx = rawDx * R_ax[0] + rawDy * R_ax[1] + rawDz * R_ax[2];
      dhy = rawDx * N_ax[0] + rawDy * N_ax[1] + rawDz * N_ax[2];
      dhz = rawDx * F_ax[0] + rawDy * F_ax[1] + rawDz * F_ax[2];
    } else {
      const moveSpeedZ = isMovingActive ? (isSprintingActive ? 0.042 : 0.022) : 0.0;
      dhx = dHeading * 0.12;
      dhy = vertVel;
      dhz = moveSpeedZ;
    }

    if (isGrounded && !hoodiePhys.lastGrounded) {
      hoodiePhys.vy -= 0.042;
      hoodiePhys.vty -= 0.068;
      hoodiePhys.pitchVel += 5.5;
    }
    hoodiePhys.lastGrounded = isGrounded;

    // 3. Rotational Micro-Inertia Forces (zero static directional bias)
    let forcePitch = 0.0;
    let forceYaw = 0.0;
    let forceRoll = 0.0;

    if (!isRag && isMovingActive) {
      const bounce = Math.sin(phase * 2.0);
      forcePitch += bounce * (isSprintingActive ? 14.0 : 8.5) * inertia;
      forcePitch += (isSprintingActive ? 10.0 : 5.5) * inertia;
      const sway = Math.cos(phase);
      forceYaw += sway * (isSprintingActive ? 9.0 : 5.5) * inertia;
      forceRoll += sway * (isSprintingActive ? 6.5 : 4.0) * inertia;
    } else if (!isRag) {
      forcePitch += Math.sin(nowSec * 1.4) * 0.9 * inertia;
      forceYaw += Math.cos(nowSec * 1.1) * 1.0 * inertia;
      forceRoll += Math.sin(nowSec * 1.3 + 0.6) * 0.6 * inertia;
    }

    // 4. Dual-Stage 3D Gravity & Whip Pendulum Targets (identical principle to Hair Physics)
    const gravTargetX = gravDeltaX * 0.088 * inertia;
    const gravTargetY = (gravDeltaY * 0.084 + steadyDrapeY) * inertia;
    const gravTargetZ = gravDeltaZ * 0.088 * inertia;

    const whipTargetX = gravDeltaX * 0.185 * inertia;
    const whipTargetY = (gravDeltaY * 0.175 + steadyDrapeY * 1.55) * inertia;
    const whipTargetZ = gravDeltaZ * 0.185 * inertia;

    const stiffness = hoodiePhys.stiffness;
    const damping = hoodiePhys.damping;
    const tipStiff = hoodiePhys.tipStiffness;
    const tipDamp = hoodiePhys.tipDamping;
    const subSteps = 2;
    const subDt = clampedDt / subSteps;

    for (let s = 0; s < subSteps; s++) {
      // Angular & turn-lag springs
      const accPitch = -stiffness * hoodiePhys.pitch - damping * hoodiePhys.pitchVel + forcePitch;
      const accYaw   = -stiffness * hoodiePhys.yaw   - damping * hoodiePhys.yawVel   + forceYaw;
      const accRoll  = -stiffness * hoodiePhys.roll  - damping * hoodiePhys.rollVel  + forceRoll;
      hoodiePhys.pitchVel += accPitch * subDt;
      hoodiePhys.yawVel   += accYaw   * subDt;
      hoodiePhys.rollVel  += accRoll  * subDt;
      hoodiePhys.pitch += hoodiePhys.pitchVel * subDt;
      hoodiePhys.yaw   += hoodiePhys.yawVel   * subDt;
      hoodiePhys.roll  += hoodiePhys.rollVel  * subDt;

      hoodiePhys.vYaw += (-dHeading * 9.5 - 60.0 * hoodiePhys.yawLag - 13.5 * hoodiePhys.vYaw) * subDt;
      hoodiePhys.yawLag = Math.max(-0.35, Math.min(0.35, hoodiePhys.yawLag + hoodiePhys.vYaw * subDt));

      // Stage 1: Primary 3D Cloth Mass (Upper Cloak, Capelet, Folded Hood Pouch)
      hoodiePhys.vx += (-dhx * 22.0 + stiffness * (gravTargetX - hoodiePhys.gx) - damping * hoodiePhys.vx) * subDt;
      hoodiePhys.vy += (-dhy * 26.0 + stiffness * (gravTargetY - hoodiePhys.gy) - damping * hoodiePhys.vy) * subDt;
      hoodiePhys.vz += (-dhz * 22.0 + stiffness * (gravTargetZ - hoodiePhys.gz) - damping * hoodiePhys.vz) * subDt;
      hoodiePhys.gx = Math.max(-0.14, Math.min(0.14, hoodiePhys.gx + hoodiePhys.vx * subDt));
      hoodiePhys.gy = Math.max(-0.14, Math.min(0.14, hoodiePhys.gy + hoodiePhys.vy * subDt));
      hoodiePhys.gz = Math.max(-0.14, Math.min(0.14, hoodiePhys.gz + hoodiePhys.vz * subDt));

      // Stage 2: Secondary Tip-Whip Follower (Cloak Scalloped Hem & Pointed Hood Tail)
      hoodiePhys.vtx += (-dhx * 30.0 + tipStiff * (whipTargetX + hoodiePhys.gx * 0.85 - hoodiePhys.tx) - tipDamp * hoodiePhys.vtx) * subDt;
      hoodiePhys.vty += (-dhy * 34.0 + tipStiff * (whipTargetY + hoodiePhys.gy * 0.85 - hoodiePhys.ty) - tipDamp * hoodiePhys.vty) * subDt;
      hoodiePhys.vtz += (-dhz * 30.0 + tipStiff * (whipTargetZ + hoodiePhys.gz * 0.85 - hoodiePhys.tz) - tipDamp * hoodiePhys.vtz) * subDt;
      hoodiePhys.tx = Math.max(-0.24, Math.min(0.24, hoodiePhys.tx + hoodiePhys.vtx * subDt));
      hoodiePhys.ty = Math.max(-0.24, Math.min(0.24, hoodiePhys.ty + hoodiePhys.vty * subDt));
      hoodiePhys.tz = Math.max(-0.24, Math.min(0.24, hoodiePhys.tz + hoodiePhys.vtz * subDt));
    }

    const maxA = hoodiePhys.maxAngle;
    hoodiePhys.pitch = Math.max(-maxA, Math.min(maxA, hoodiePhys.pitch));
    hoodiePhys.yaw   = Math.max(-maxA, Math.min(maxA, hoodiePhys.yaw));
    hoodiePhys.roll  = Math.max(-maxA, Math.min(maxA, hoodiePhys.roll));

    // 5. Freefall, Jump & Ragdoll 3D Airflow Forces
    let airX = 0.0, airY = 0.0, airZ = 0.0, airFlare = 0.0, windTurb = 0.0;
    if (isRag && physContext && physContext.ragdollVel) {
      const rvx = physContext.ragdollVel[0] || 0.0;
      const rvy = physContext.ragdollVel[1] || 0.0;
      const rvz = physContext.ragdollVel[2] || 0.0;
      const fallSpeed3D = Math.hypot(rvx, rvy, rvz);
      const relWindX = -(rvx * R_ax[0] + rvy * R_ax[1] + rvz * R_ax[2]);
      const relWindY = -(rvx * N_ax[0] + rvy * N_ax[1] + rvz * N_ax[2]);
      const relWindZ = -(rvx * F_ax[0] + rvy * F_ax[1] + rvz * F_ax[2]);
      const windGain = 14.0;
      airX = Math.max(-0.14, Math.min(0.14, relWindX * windGain));
      airY = Math.max(-0.12, Math.min(0.16, relWindY * windGain));
      airZ = Math.max(-0.14, Math.min(0.14, relWindZ * windGain));
      airFlare = Math.min(0.11, fallSpeed3D * 9.5 + Math.max(0.0, gravLocalY + 0.45) * 0.038);
      windTurb = Math.min(1.0, fallSpeed3D * 45.0);
    } else if (!isRag) {
      if (vertVel > 0.0005) {
        airY = Math.max(-0.075, -vertVel * 10.5);
        airFlare = Math.min(0.04, vertVel * 3.8);
        windTurb = Math.min(0.5, vertVel * 25.0);
      } else if (vertVel < -0.0005) {
        const fallSpeed = Math.abs(vertVel);
        airY = Math.min(0.145, fallSpeed * 14.0);
        airFlare = Math.min(0.095, fallSpeed * 8.5);
        windTurb = Math.min(1.0, fallSpeed * 45.0);
      }
    }
    hoodiePhys.airX = airX;
    hoodiePhys.airY = airY;
    hoodiePhys.airZ = airZ;
    hoodiePhys.airFlare = airFlare;
    hoodiePhys.windTurb = windTurb;
  }

  // =========================================================================
  // --- 10. Chibi Hand Pose & Finger Controls ---
  // =========================================================================
  const chibiHandState = {
    rightCurl: 0.0,
    leftCurl: 0.0,
    rightSpread: 0.0,
    leftSpread: 0.0,
    syncBoth: true
  };

  function setChibiHandCurl(val, hand = "both") {
    if (hand === "both" || hand === "right") chibiHandState.rightCurl = val;
    if (hand === "both" || hand === "left") chibiHandState.leftCurl = val;
    if (typeof window !== "undefined" && window.chibiGlbModel && typeof window.chibiGlbModel.setHandPose === "function") {
      window.chibiGlbModel.setHandPose(chibiHandState);
    }
    if (typeof window !== "undefined" && typeof window.updateCharacterMesh === "function") {
      window.updateCharacterMesh(typeof window.walkPhase !== "undefined" ? window.walkPhase : 0.0);
    }
  }

  function setChibiHandSpread(val, hand = "both") {
    if (hand === "both" || hand === "right") chibiHandState.rightSpread = val;
    if (hand === "both" || hand === "left") chibiHandState.leftSpread = val;
    if (typeof window !== "undefined" && window.chibiGlbModel && typeof window.chibiGlbModel.setHandPose === "function") {
      window.chibiGlbModel.setHandPose(chibiHandState);
    }
    if (typeof window !== "undefined" && typeof window.updateCharacterMesh === "function") {
      window.updateCharacterMesh(typeof window.walkPhase !== "undefined" ? window.walkPhase : 0.0);
    }
  }

  function updateChibiHandPose(model, heldItem, isItemAction) {
    if (!model || typeof model.setHandPose !== "function") return;
    let rCurl = chibiHandState.rightCurl;
    let lCurl = chibiHandState.leftCurl;
    let rSpread = chibiHandState.rightSpread;
    let lSpread = chibiHandState.leftSpread;

    if (heldItem && rCurl === 0.0) {
      rCurl = 0.85;
    }

    model.setHandPose({
      rightCurl: rCurl,
      leftCurl: lCurl,
      rightSpread: rSpread,
      leftSpread: lSpread
    });
  }

  // =========================================================================
  // --- 11. Traveler Hoodie & Cloak 3D Mesh Generator (Tailored Fit & Connected Long Sleeves) ---
  // =========================================================================
  function _getBlackPleatedSkirtRingsDef(s, torsoRatio = 1.0, wearHoodieOverSkirt = false) {
    const pleatDepthScale = wearHoodieOverSkirt ? 0.62 : 1.0;
    const baseDefs = [
      { dy:  0.002 * s * torsoRatio, rx: 0.0770 * s, rzF: 0.0665 * s, rzB: 0.0585 * s, cy: -0.001 * s, pleatDepth: 0.0000 * s, t: 0.00, clr: 0.0012, isYoke: true },
      { dy: -0.028 * s * torsoRatio, rx: 0.0950 * s, rzF: 0.0705 * s, rzB: 0.0785 * s, cy: -0.002 * s, pleatDepth: 0.0010 * s, t: 0.08, clr: 0.0040, isYoke: true },
      { dy: -0.060 * s * torsoRatio, rx: 0.1140 * s, rzF: 0.0820 * s, rzB: 0.0910 * s, cy: -0.003 * s, pleatDepth: 0.0060 * s, t: 0.25, clr: 0.0065, isYoke: false },
      { dy: -0.096 * s * torsoRatio, rx: 0.1280 * s, rzF: 0.0930 * s, rzB: 0.0990 * s, cy: -0.004 * s, pleatDepth: 0.0090 * s, t: 0.50, clr: 0.0085, isYoke: false },
      { dy: -0.134 * s * torsoRatio, rx: 0.1410 * s, rzF: 0.1040 * s, rzB: 0.1090 * s, cy: -0.004 * s, pleatDepth: 0.0110 * s, t: 0.76, clr: 0.0105, isYoke: false },
      { dy: -0.172 * s * torsoRatio, rx: 0.1520 * s, rzF: 0.1140 * s, rzB: 0.1190 * s, cy: -0.004 * s, pleatDepth: 0.0125 * s, t: 1.00, clr: 0.0125, isYoke: false }
    ];
    if (!wearHoodieOverSkirt) return baseDefs;
    return baseDefs.map((lvl) => {
      const rxScale = 1.0 - 0.10 * lvl.t;
      const rzScale = 1.0 - 0.09 * lvl.t;
      return {
        dy: lvl.dy,
        rx: lvl.rx * rxScale,
        rzF: lvl.rzF * rzScale,
        rzB: lvl.rzB * rzScale,
        cy: lvl.cy,
        pleatDepth: lvl.pleatDepth * pleatDepthScale,
        t: lvl.t,
        clr: lvl.clr,
        isYoke: lvl.isYoke
      };
    });
  }

  function _computeGarmentLegStride(src, torsoRight, torsoFwd, footWeight, enabled = true) {
    if (!enabled || !src) {
      return { lFwd: 0.0, lBack: 0.0, lOut: 0.0, rFwd: 0.0, rBack: 0.0, rOut: 0.0 };
    }
    const dotFwd = (p, q) => (p[0] - q[0]) * torsoFwd[0] + (p[1] - q[1]) * torsoFwd[1] + (p[2] - q[2]) * torsoFwd[2];
    const dotLat = (p, q) => (p[0] - q[0]) * torsoRight[0] + (p[1] - q[1]) * torsoRight[1] + (p[2] - q[2]) * torsoRight[2];
    const lHipP = src.leftLegPivot;
    const lKneeP = src.leftKneeRot;
    const lFootP = src.leftFootRot;
    const rHipP = src.rightLegPivot;
    const rKneeP = src.rightKneeRot;
    const rFootP = src.rightFootRot;

    return {
      lFwd: (lHipP && lKneeP) ? Math.max(0.0, dotFwd(lKneeP, lHipP), lFootP ? dotFwd(lFootP, lHipP) * footWeight : 0.0) : 0.0,
      lBack: (lHipP && lKneeP) ? Math.max(0.0, -dotFwd(lKneeP, lHipP), lFootP ? -dotFwd(lFootP, lHipP) * footWeight : 0.0) : 0.0,
      lOut: (lHipP && lKneeP) ? Math.max(0.0, -dotLat(lKneeP, lHipP)) : 0.0,
      rFwd: (rHipP && rKneeP) ? Math.max(0.0, dotFwd(rKneeP, rHipP), rFootP ? dotFwd(rFootP, rHipP) * footWeight : 0.0) : 0.0,
      rBack: (rHipP && rKneeP) ? Math.max(0.0, -dotFwd(rKneeP, rHipP), rFootP ? -dotFwd(rFootP, rHipP) * footWeight : 0.0) : 0.0,
      rOut: (rHipP && rKneeP) ? Math.max(0.0, dotLat(rKneeP, rHipP)) : 0.0
    };
  }

  function _computeSkirtVertexDisplacement(sinA, cosA, w, skirtStartW, s, bDisp, stride, windShieldDenom, ripplePhase, rippleScale, tentFwdMul, tentBackMul, sideFwdMul, sideBackMul, sideOutMul) {
    const skirtW = Math.max(0.0, (w - skirtStartW) / (1.0 - skirtStartW));
    const wLeft = Math.max(0.0, -sinA);
    const wRight = Math.max(0.0, sinA);
    const wFront = Math.max(0.0, cosA);
    const wBack = Math.max(0.0, -cosA);
    const legFrontTent = (wLeft * stride.lFwd + wRight * stride.rFwd) * (tentFwdMul + (1.0 - tentFwdMul) * wFront) * skirtW;
    const legBackTent = (wLeft * stride.lBack + wRight * stride.rBack) * (tentBackMul + (1.0 - tentBackMul) * wBack) * skirtW;
    const legSidePush = (
      wRight * (stride.rFwd * sideFwdMul + stride.rBack * sideBackMul + stride.rOut * sideOutMul) -
      wLeft  * (stride.lFwd * sideFwdMul + stride.lBack * sideBackMul + stride.lOut * sideOutMul)
    ) * skirtW;
    const dragShield = Math.min(1.0, ((wLeft * stride.lFwd + wRight * stride.rFwd) * (0.35 + 0.65 * wFront)) / (windShieldDenom * s));
    const effDispZ = (bDisp[2] < 0.0) ? (bDisp[2] * (1.0 - 0.80 * dragShield)) : bDisp[2];
    const rippleY = (w < 0.05 || rippleScale === 0.0) ? 0.0 : (Math.sin(ripplePhase * 2.2 + Math.atan2(sinA, cosA) * 3.0) * rippleScale * w * s);
    return { legFrontTent, legBackTent, legSidePush, effDispZ, rippleY };
  }

  function _buildSkirtEnvelopeClampFn(worldRings, collarBaseX, collarBaseY, collarBaseZ, torsoRight, torsoUp, torsoFwd, s) {
    const skRingSamples = [];
    let skTopY = -Infinity;
    let skBotY = Infinity;
    for (let sr = 0; sr < worldRings.length; sr++) {
      const pts = worldRings[sr];
      const ringCrests = new Array(pts.length);
      let ringYAvg = 0.0;
      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        const dxC = pt[0] - collarBaseX;
        const dyC = pt[1] - collarBaseY;
        const dzC = pt[2] - collarBaseZ;
        const tx = dxC * torsoRight[0] + dyC * torsoRight[1] + dzC * torsoRight[2];
        const ty = dxC * torsoUp[0]    + dyC * torsoUp[1]    + dzC * torsoUp[2];
        const tz = dxC * torsoFwd[0]   + dyC * torsoFwd[1]   + dzC * torsoFwd[2];
        ringYAvg += ty;
        ringCrests[i] = { ang: Math.atan2(tx, tz), r: Math.hypot(tx, tz), tx, ty, tz };
      }
      ringYAvg /= pts.length;
      if (ringYAvg > skTopY) skTopY = ringYAvg;
      if (ringYAvg < skBotY) skBotY = ringYAvg;
      skRingSamples.push({ y: ringYAvg, crests: ringCrests });
    }

    const maxCrestRAtAngle = (ringSamples, ang, halfWin = 0.28) => {
      let maxR = 0.0;
      const crests = ringSamples.crests;
      const sA = Math.sin(ang);
      const cA = Math.cos(ang);
      for (let i = 0; i < crests.length; i++) {
        let dA = crests[i].ang - ang;
        while (dA > Math.PI) dA -= Math.PI * 2;
        while (dA < -Math.PI) dA += Math.PI * 2;
        if (Math.abs(dA) <= halfWin) {
          const proj = crests[i].tx * sA + crests[i].tz * cA;
          if (proj > maxR) maxR = proj;
        }
      }
      return maxR;
    };

    return (pos, extraClearance) => {
      const dxC = pos[0] - collarBaseX;
      const dyC = pos[1] - collarBaseY;
      const dzC = pos[2] - collarBaseZ;
      const tx = dxC * torsoRight[0] + dyC * torsoRight[1] + dzC * torsoRight[2];
      const ty = dxC * torsoUp[0]    + dyC * torsoUp[1]    + dzC * torsoUp[2];
      const tz = dxC * torsoFwd[0]   + dyC * torsoFwd[1]   + dzC * torsoFwd[2];
      if (ty > skTopY + 0.018 * s || ty < skBotY - 0.036 * s) return pos;

      const r = Math.hypot(tx, tz);
      if (r < 1e-5) return pos;
      const ang = Math.atan2(tx, tz);

      let envR = 0.0;
      let clrScale = 1.0;
      if (ty >= skRingSamples[0].y) {
        envR = maxCrestRAtAngle(skRingSamples[0], ang);
        const aboveT = Math.max(0.0, Math.min(1.0, (ty - skRingSamples[0].y) / (0.018 * s)));
        clrScale = 1.0 - aboveT;
      } else if (ty <= skRingSamples[skRingSamples.length - 1].y) {
        envR = maxCrestRAtAngle(skRingSamples[skRingSamples.length - 1], ang);
        const belowT = Math.max(0.0, Math.min(1.0, (skRingSamples[skRingSamples.length - 1].y - ty) / (0.036 * s)));
        clrScale = 1.0 - belowT * 0.45;
      } else {
        for (let sr = 0; sr < skRingSamples.length - 1; sr++) {
          const rHi = skRingSamples[sr];
          const rLo = skRingSamples[sr + 1];
          if (ty <= rHi.y && ty >= rLo.y) {
            const span = Math.max(1e-5, rHi.y - rLo.y);
            const f = (rHi.y - ty) / span;
            envR = maxCrestRAtAngle(rHi, ang) * (1.0 - f) + maxCrestRAtAngle(rLo, ang) * f;
            break;
          }
        }
      }

      const targetR = (envR + extraClearance) * clrScale + r * (1.0 - clrScale);
      if (r < targetR) {
        const push = targetR - r;
        const dirX = torsoRight[0] * (tx / r) + torsoFwd[0] * (tz / r);
        const dirY = torsoRight[1] * (tx / r) + torsoFwd[1] * (tz / r);
        const dirZ = torsoRight[2] * (tx / r) + torsoFwd[2] * (tz / r);
        return [pos[0] + dirX * push, pos[1] + dirY * push, pos[2] + dirZ * push];
      }
      return pos;
    };
  }

  function buildTravelerHoodieCloakMesh(
    headP1, headP2,
    chestP1, chestP2,
    neckP1, neckP2,
    leftArmPivot, leftElbowRot, leftHandRot,
    rightArmPivot, rightElbowRot, rightHandRot,
    scale,
    phase,
    isLocal,
    leftFootRot, rightFootRot,
    isHoodOpen = false,
    clothContext = null
  ) {
    const outV = [];
    const outC = [];
    const outI = [];
    const outT = [];

    const hx = (headP1[0] + headP2[0]) * 0.5;
    const hy = (headP1[1] + headP2[1]) * 0.5;
    const hz = (headP1[2] + headP2[2]) * 0.5;

    const nx = (neckP1[0] + neckP2[0]) * 0.5;
    const ny = (neckP1[1] + neckP2[1]) * 0.5;
    const nz = (neckP1[2] + neckP2[2]) * 0.5;

    const s = scale || 1.0;

    // Derive torso basis frame from chestP1 -> chestP2 so tilted poses (riding/aiming) align seamlessly
    const tdx = chestP2[0] - chestP1[0];
    const tdy = chestP2[1] - chestP1[1];
    const tdz = chestP2[2] - chestP1[2];
    const tLen = Math.hypot(tdx, tdy, tdz) || 1.0;
    const torsoUp = [tdx / tLen, tdy / tLen, tdz / tLen];
    const fDot = torsoUp[2];
    let torsoFwd = [-torsoUp[0] * fDot, -torsoUp[1] * fDot, 1.0 - torsoUp[2] * fDot];
    const tfLen = Math.hypot(torsoFwd[0], torsoFwd[1], torsoFwd[2]);
    if (tfLen > 1e-4) {
      torsoFwd = [torsoFwd[0] / tfLen, torsoFwd[1] / tfLen, torsoFwd[2] / tfLen];
    } else {
      torsoFwd = [0, 0, 1];
    }
    const torsoRight = [
      torsoUp[1] * torsoFwd[2] - torsoUp[2] * torsoFwd[1],
      torsoUp[2] * torsoFwd[0] - torsoUp[0] * torsoFwd[2],
      torsoUp[0] * torsoFwd[1] - torsoUp[1] * torsoFwd[0]
    ];

    // Anchor bodice reference right at collar/chest top so garment aligns cleanly with neck & shoulders
    const collarBaseX = chestP2[0];
    const collarBaseY = Math.min(ny, chestP2[1] + 0.010 * s);
    const collarBaseZ = chestP2[2];

    const colCloth = [0.95, 0.94, 0.91];
    const colHighlight = [0.99, 0.98, 0.96];
    const colCrease = [0.84, 0.81, 0.77];
    const colDark = [0.12, 0.12, 0.15];
    const colBrooch = [0.98, 0.85, 0.45];
    const colBroochCenter = [1.0, 0.96, 0.88];

    let isClothSection = true;

    const bodyColliderData = {
      headP1,
      chestP1,
      chestP2,
      leftArmPivot,
      leftElbowRot,
      leftHandRot,
      rightArmPivot,
      rightElbowRot,
      rightHandRot,
      leftLegPivot: clothContext ? clothContext.leftLegPivot : null,
      leftKneeRot: clothContext ? clothContext.leftKneeRot : null,
      leftFootRot: clothContext ? (clothContext.leftFootRot || leftFootRot) : leftFootRot,
      rightLegPivot: clothContext ? clothContext.rightLegPivot : null,
      rightKneeRot: clothContext ? clothContext.rightKneeRot : null,
      rightFootRot: clothContext ? (clothContext.rightFootRot || rightFootRot) : rightFootRot,
      scale: s
    };

    const addV = (px, py, pz, color, clampClearance = 0.0, includeArmsClamp = true, uv = null, pushHint = null) => {
      let vx = px, vy = py, vz = pz;
      if (clampClearance > 0.0 && !isLocal) {
        const clamped = clampPointOutsideChibiBodyForCloth(vx, vy, vz, bodyColliderData, clampClearance, includeArmsClamp, pushHint);
        vx = clamped[0];
        vy = clamped[1];
        vz = clamped[2];
      }
      const idx = (outV.length / 3) | 0;
      if (isLocal && isClothSection) {
        outV.push((vx / s) + 10.0, vy / s, vz / s);
      } else {
        outV.push(vx, vy, vz);
      }
      outC.push(color[0], color[1], color[2]);
      if (uv) {
        outT.push(uv[0], uv[1]);
      } else if (isClothSection) {
        outT.push(-1.0, -1.0);
      } else {
        outT.push(-9.0, -9.0);
      }
      return idx;
    };

    const addTri = (v0, v1, v2) => {
      outI.push(v0, v1, v2);
    };

    const addQuad = (v0, v1, v2, v3) => {
      outI.push(v0, v1, v2);
      outI.push(v0, v2, v3);
    };

    const addCylinder = (p0, p1, r0, r1, sides, color, capStart = false, capEnd = false, innerSides = false, clampClr = 0.0, includeArms = true) => {
      if (!p0 || !p1) return;
      const dx = p1[0] - p0[0];
      const dy = p1[1] - p0[1];
      const dz = p1[2] - p0[2];
      const len = Math.hypot(dx, dy, dz) || 0.001;
      const dir = [dx / len, dy / len, dz / len];

      const up = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      let uX = up[1] * dir[2] - up[2] * dir[1];
      let uY = up[2] * dir[0] - up[0] * dir[2];
      let uZ = up[0] * dir[1] - up[1] * dir[0];
      const uLen = Math.hypot(uX, uY, uZ) || 1;
      uX /= uLen; uY /= uLen; uZ /= uLen;

      const vX = dir[1] * uZ - dir[2] * uY;
      const vY = dir[2] * uX - dir[0] * uZ;
      const vZ = dir[0] * uY - dir[1] * uX;

      const ring0 = [];
      const ring1 = [];
      for (let i = 0; i < sides; i++) {
        const ang = (i / sides) * Math.PI * 2;
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);

        const offX0 = (uX * cosA + vX * sinA) * r0;
        const offY0 = (uY * cosA + vY * sinA) * r0;
        const offZ0 = (uZ * cosA + vZ * sinA) * r0;

        const offX1 = (uX * cosA + vX * sinA) * r1;
        const offY1 = (uY * cosA + vY * sinA) * r1;
        const offZ1 = (uZ * cosA + vZ * sinA) * r1;

        ring0.push(addV(p0[0] + offX0, p0[1] + offY0, p0[2] + offZ0, color, clampClr, includeArms));
        ring1.push(addV(p1[0] + offX1, p1[1] + offY1, p1[2] + offZ1, color, clampClr, includeArms));
      }

      for (let i = 0; i < sides; i++) {
        const nextI = (i + 1) % sides;
        addQuad(ring0[i], ring0[nextI], ring1[nextI], ring1[i]);
      }

      if (innerSides) {
        const inRing0 = [];
        const inRing1 = [];
        const rIn0 = r0 * 0.92;
        const rIn1 = r1 * 0.92;
        for (let i = 0; i < sides; i++) {
          const ang = (i / sides) * Math.PI * 2;
          const cosA = Math.cos(ang);
          const sinA = Math.sin(ang);
          const offX0 = (uX * cosA + vX * sinA) * rIn0;
          const offY0 = (uY * cosA + vY * sinA) * rIn0;
          const offZ0 = (uZ * cosA + vZ * sinA) * rIn0;
          const offX1 = (uX * cosA + vX * sinA) * rIn1;
          const offY1 = (uY * cosA + vY * sinA) * rIn1;
          const offZ1 = (uZ * cosA + vZ * sinA) * rIn1;
          inRing0.push(addV(p0[0] + offX0, p0[1] + offY0, p0[2] + offZ0, colCrease, 0.0, false));
          inRing1.push(addV(p1[0] + offX1, p1[1] + offY1, p1[2] + offZ1, colCrease, 0.0, false));
        }
        for (let i = 0; i < sides; i++) {
          const nextI = (i + 1) % sides;
          addQuad(inRing0[nextI], inRing0[i], inRing1[i], inRing1[nextI]);
          addQuad(ring1[i], ring1[nextI], inRing1[nextI], inRing1[i]);
        }
      }

      if (capStart) {
        const vC0 = addV(p0[0], p0[1], p0[2], color);
        for (let i = 0; i < sides; i++) {
          const nextI = (i + 1) % sides;
          addTri(vC0, ring0[nextI], ring0[i]);
        }
      }
      if (capEnd) {
        const vC1 = addV(p1[0], p1[1], p1[2], color);
        for (let i = 0; i < sides; i++) {
          const nextI = (i + 1) % sides;
          addTri(vC1, ring1[i], ring1[nextI]);
        }
      }
    };

    const useClonePhys = !!(clothContext && clothContext.isClone);
    const hPhys = (clothContext && clothContext.hoodiePhysics)
      ? clothContext.hoodiePhysics
      : (useClonePhys
          ? chibiCloneHoodiePhysics
          : ((typeof chibiHoodiePhysics !== "undefined") ? chibiHoodiePhysics : _createDefaultHoodiePhysState()));
    const pAngle = isLocal ? 0.0 : (hPhys.pitch || 0.0);
    const yAngle = isLocal ? 0.0 : (hPhys.yaw || 0.0);
    const rAngle = isLocal ? 0.0 : (hPhys.roll || 0.0);
    const yawLagTerm = isLocal ? 0.0 : ((hPhys.yawLag || 0.0) * 0.14);
    const grav = (typeof hPhys.gravity === "number") ? hPhys.gravity : 0.055;
    const effPhase = isLocal ? 0.0 : phase;

    const nowPerfSec = (typeof performance !== "undefined" ? performance.now() : Date.now()) * 0.001;
    const windTurb = isLocal ? 0.0 : (hPhys.windTurb || 0.0);
    const airFlare = isLocal ? 0.0 : (hPhys.airFlare || 0.0);
    const flutterT = nowPerfSec * (12.0 + windTurb * 14.0);
    const turbX = (!isLocal && windTurb > 0) ? Math.sin(flutterT) * (windTurb * 0.016) : 0.0;
    const turbY = (!isLocal && windTurb > 0) ? Math.sin(flutterT * 0.85) * (windTurb * 0.012) : 0.0;
    const turbZ = (!isLocal && windTurb > 0) ? Math.cos(flutterT * 1.1) * (windTurb * 0.016) : 0.0;

    // Gentle symmetric ambient breeze sway (matches Hair Physics)
    const breezeT = nowPerfSec * 1.4;
    const breezeX = isLocal ? 0.0 : Math.sin(breezeT * 1.5) * 0.003;
    const breezeZ = isLocal ? 0.0 : Math.cos(breezeT * 1.2) * 0.003;
    const breezeY = isLocal ? 0.0 : Math.sin(breezeT * 1.8) * 0.0015;

    // 3D Gravity & Cloth-Mass Offset Helper
    const computeClothDisp = (w, ampScale = 1.0) => {
      if (isLocal) {
        return [0.0, -grav * 0.45 * w * s, 0.0];
      }
      const wPrimary = w * (0.52 + 0.48 * w);
      const wWhip = w * w * (0.40 + 0.60 * w);
      const bounceY = Math.sin(effPhase * 2.0) * 0.010 * w * s;
      const dx = ((hPhys.gx * 0.46 * wPrimary + hPhys.tx * 0.52 * wWhip + hPhys.airX * w + (yAngle * 0.045 + rAngle * 0.028 + yawLagTerm) * w + breezeX * w + turbX * w) * s) * ampScale;
      const dy = ((hPhys.gy * 0.46 * wPrimary + hPhys.ty * 0.52 * wWhip + hPhys.airY * w + breezeY * w + turbY * w) * s + bounceY) * ampScale;
      const dz = ((hPhys.gz * 0.46 * wPrimary + hPhys.tz * 0.52 * wWhip + hPhys.airZ * w - pAngle * 0.052 * w + breezeZ * w + turbZ * w) * s) * ampScale;
      return [dx, dy, dz];
    };

    const tipDisp = computeClothDisp(1.0, 0.92);
    const tipYawX = tipDisp[0];
    const tipGravY = tipDisp[1];
    const tipPitchZ = tipDisp[2];

    const torsoPt = (dx, dy, dz) => [
      collarBaseX + torsoRight[0] * dx + torsoUp[0] * dy + torsoFwd[0] * dz,
      collarBaseY + torsoRight[1] * dx + torsoUp[1] * dy + torsoFwd[1] * dz,
      collarBaseZ + torsoRight[2] * dx + torsoUp[2] * dy + torsoFwd[2] * dz
    ];

    // -------------------------------------------------------------------------
    // 1. Fitted Neck Collar (wraps snugly around Chibi collarbone / turtleneck)
    // -------------------------------------------------------------------------
    const collarOffsets = [
      [ 0.000 * s, -0.018 * s,  0.072 * s], // 0: Front throat clasp dip
      [-0.056 * s, -0.010 * s,  0.054 * s], // 1: Front-left collarbone
      [-0.078 * s, -0.006 * s,  0.000 * s], // 2: Left shoulder-neck seam
      [-0.058 * s, -0.004 * s, -0.054 * s], // 3: Back-left neck
      [ 0.000 * s, -0.002 * s, -0.070 * s], // 4: Center back neck
      [ 0.058 * s, -0.004 * s, -0.054 * s], // 5: Back-right neck
      [ 0.078 * s, -0.006 * s,  0.000 * s], // 6: Right shoulder-neck seam
      [ 0.056 * s, -0.010 * s,  0.054 * s]  // 7: Front-right collarbone
    ];
    const vCollar = [];
    for (let i = 0; i < 8; i++) {
      const off = collarOffsets[i];
      const pt = torsoPt(off[0], off[1], off[2]);
      vCollar.push(addV(pt[0], pt[1], pt[2], colCloth, 0.005, false));
    }

    // -------------------------------------------------------------------------
    // 2. Hood Section (Closed over head vs Open folded neatly behind neck/shoulders)
    // -------------------------------------------------------------------------
    if (!isHoodOpen) {
      // CLOSED HOOD ("แบบปิด" — ฮูดคลุมศีรษะขนาดพอดีตัว)
      const apertureOffsets = [
        [ 0.00 * s,  0.26 * s,  0.22 * s],
        [-0.17 * s,  0.22 * s,  0.20 * s],
        [-0.23 * s,  0.05 * s,  0.16 * s],
        [-0.17 * s, -0.12 * s,  0.13 * s],
        [ 0.00 * s, -0.16 * s,  0.12 * s],
        [ 0.17 * s, -0.12 * s,  0.13 * s],
        [ 0.23 * s,  0.05 * s,  0.16 * s],
        [ 0.17 * s,  0.22 * s,  0.20 * s]
      ];
      const vAperture = [];
      for (let i = 0; i < 8; i++) {
        const off = apertureOffsets[i];
        const col = (i === 0) ? colHighlight : colCloth;
        vAperture.push(addV(hx + off[0], hy + off[1], hz + off[2], col, 0.009, false));
      }

      const vInner = [];
      for (let i = 0; i < 8; i++) {
        const off = apertureOffsets[i];
        vInner.push(addV(hx + off[0] * 0.90, hy + off[1] * 0.90, hz + off[2] - 0.075 * s, colCrease, 0.005, false));
      }
      for (let i = 0; i < 8; i++) {
        const nextI = (i + 1) % 8;
        addQuad(vAperture[i], vAperture[nextI], vInner[nextI], vInner[i]);
      }

      const crownOffsets = [
        [ 0.00 * s,  0.28 * s,  0.05 * s],
        [-0.19 * s,  0.24 * s,  0.02 * s],
        [-0.25 * s,  0.05 * s, -0.02 * s],
        [-0.19 * s, -0.12 * s, -0.04 * s],
        [ 0.00 * s, -0.15 * s, -0.06 * s],
        [ 0.19 * s, -0.12 * s, -0.04 * s],
        [ 0.25 * s,  0.05 * s, -0.02 * s],
        [ 0.19 * s,  0.24 * s,  0.02 * s]
      ];
      const vCrown = [];
      const crownDisp = computeClothDisp(0.16, 0.60);
      for (let i = 0; i < 8; i++) {
        const off = crownOffsets[i];
        vCrown.push(addV(hx + off[0] + crownDisp[0], hy + off[1] + crownDisp[1], hz + off[2] + crownDisp[2], colCloth, 0.009, false));
      }
      for (let i = 0; i < 8; i++) {
        const nextI = (i + 1) % 8;
        addQuad(vAperture[i], vCrown[i], vCrown[nextI], vAperture[nextI]);
      }

      const rearOffsets = [
        [ 0.00 * s,  0.25 * s, -0.14 * s],
        [-0.16 * s,  0.21 * s, -0.15 * s],
        [-0.21 * s,  0.05 * s, -0.18 * s],
        [-0.15 * s, -0.11 * s, -0.16 * s],
        [ 0.00 * s, -0.13 * s, -0.15 * s],
        [ 0.15 * s, -0.11 * s, -0.16 * s],
        [ 0.21 * s,  0.05 * s, -0.18 * s],
        [ 0.16 * s,  0.21 * s, -0.15 * s]
      ];
      const vRear = [];
      const rearDisp = computeClothDisp(0.42, 0.80);
      for (let i = 0; i < 8; i++) {
        const off = rearOffsets[i];
        vRear.push(addV(hx + off[0] + rearDisp[0], hy + off[1] + rearDisp[1], hz + off[2] + rearDisp[2], colCloth, 0.009, false));
      }
      for (let i = 0; i < 8; i++) {
        const nextI = (i + 1) % 8;
        addQuad(vCrown[i], vRear[i], vRear[nextI], vCrown[nextI]);
      }

      const vApexTip = addV(
        hx + tipYawX,
        hy + 0.14 * s + tipGravY,
        hz - 0.31 * s + tipPitchZ,
        colHighlight,
        0.010,
        false
      );
      for (let i = 0; i < 8; i++) {
        const nextI = (i + 1) % 8;
        addTri(vRear[i], vApexTip, vRear[nextI]);
      }

      addQuad(vAperture[3], vAperture[4], vCollar[0], vCollar[1]);
      addQuad(vAperture[4], vAperture[5], vCollar[7], vCollar[0]);
      addQuad(vAperture[2], vAperture[3], vCollar[1], vCollar[2]);
      addQuad(vAperture[5], vAperture[6], vCollar[6], vCollar[7]);
      addQuad(vRear[3], vRear[4], vCollar[4], vCollar[3]);
      addQuad(vRear[4], vRear[5], vCollar[5], vCollar[4]);
      addQuad(vRear[2], vRear[3], vCollar[3], vCollar[2]);
      addQuad(vRear[5], vRear[6], vCollar[6], vCollar[5]);
      addQuad(vCrown[3], vCrown[4], vCollar[4], vCollar[3]);
      addQuad(vCrown[4], vCrown[5], vCollar[5], vCollar[4]);
    } else {
      // OPEN HOOD ("แบบเปิด": ถอดฮูดพับไว้ด้านหลังคอขนาดพอดีตัวตามภาพเรฟ image_477ce4ad.png)
      const foldedRimOffsets = [
        [ 0.000 * s,  0.002 * s,  0.072 * s], // 0: Front-throat clasp dip
        [-0.088 * s,  0.032 * s,  0.042 * s], // 1: Left front collar lapel
        [-0.158 * s,  0.068 * s, -0.055 * s], // 2: Left neck-side fold
        [-0.145 * s,  0.095 * s, -0.170 * s], // 3: Left-back hood fold
        [ 0.000 * s,  0.105 * s, -0.215 * s], // 4: Center-back hood crest
        [ 0.145 * s,  0.095 * s, -0.170 * s], // 5: Right-back hood fold
        [ 0.158 * s,  0.068 * s, -0.055 * s], // 6: Right neck-side fold
        [ 0.088 * s,  0.032 * s,  0.042 * s]  // 7: Right front collar lapel
      ];
      const rimDisp = computeClothDisp(0.18, 0.65);
      const vFoldRim = [];
      const vFoldInner = [];
      for (let i = 0; i < 8; i++) {
        const off = foldedRimOffsets[i];
        const w = (i >= 2 && i <= 6) ? 1.0 : 0.20;
        const col = (i === 4 || i === 1 || i === 7) ? colHighlight : colCloth;
        const rp = torsoPt(off[0] + rimDisp[0] * w, off[1] + rimDisp[1] * w, off[2] + rimDisp[2] * w);
        vFoldRim.push(addV(rp[0], rp[1], rp[2], col, 0.007, false));
        const ip = torsoPt(
          off[0] * 0.78 + rimDisp[0] * w * 0.55,
          off[1] - 0.025 * s + rimDisp[1] * w * 0.55,
          off[2] * 0.78 + rimDisp[2] * w * 0.55
        );
        vFoldInner.push(addV(ip[0], ip[1], ip[2], colCrease, 0.005, false));
      }
      for (let i = 0; i < 8; i++) {
        const nextI = (i + 1) % 8;
        addQuad(vFoldRim[i], vFoldRim[nextI], vFoldInner[nextI], vFoldInner[i]);
        addQuad(vFoldInner[i], vFoldInner[nextI], vCollar[nextI], vCollar[i]);
      }

      const foldedPouchOffsets = [
        [ 0.000 * s, -0.018 * s,  0.068 * s],
        [-0.080 * s, -0.008 * s,  0.032 * s],
        [-0.142 * s, -0.008 * s, -0.075 * s],
        [-0.130 * s, -0.035 * s, -0.205 * s],
        [ 0.000 * s, -0.048 * s, -0.245 * s],
        [ 0.130 * s, -0.035 * s, -0.205 * s],
        [ 0.142 * s, -0.008 * s, -0.075 * s],
        [ 0.080 * s, -0.008 * s,  0.032 * s]
      ];
      const pouchDisp = computeClothDisp(0.50, 0.90);
      const vFoldPouch = [];
      for (let i = 0; i < 8; i++) {
        const off = foldedPouchOffsets[i];
        const w = (i >= 2 && i <= 6) ? 1.0 : 0.15;
        const pp = torsoPt(off[0] + pouchDisp[0] * w, off[1] + pouchDisp[1] * w, off[2] + pouchDisp[2] * w);
        vFoldPouch.push(addV(pp[0], pp[1], pp[2], colCloth, 0.008, false));
      }
      for (let i = 0; i < 8; i++) {
        const nextI = (i + 1) % 8;
        addQuad(vFoldRim[i], vFoldPouch[i], vFoldPouch[nextI], vFoldRim[nextI]);
      }

      const tipPos = torsoPt(tipYawX * 0.90, -0.145 * s + tipGravY * 0.85, -0.265 * s + tipPitchZ * 0.90);
      const vOpenApexTip = addV(tipPos[0], tipPos[1], tipPos[2], colHighlight, 0.009, false);
      for (let i = 2; i < 6; i++) {
        addTri(vFoldPouch[i], vOpenApexTip, vFoldPouch[i + 1]);
      }
      addTri(vFoldPouch[1], vFoldPouch[2], vCollar[2]);
      addTri(vFoldPouch[6], vCollar[6], vFoldPouch[7]);
    }

    // -------------------------------------------------------------------------
    // 3. Fitted Hoodie Bodice / Coat (ขนาดพอดีตัว + ชายเสื้อโค้งตามจังหวะก้าวขาและกันขา/กระโปรงทะลุ)
    // -------------------------------------------------------------------------
    const eqClothingState = (!isLocal && !useClonePhys && typeof getCharacterEquippedClothingState === "function")
      ? getCharacterEquippedClothingState(false)
      : null;
    const wearSkirtUnderHoodie = !isLocal && !!(
      (clothContext && clothContext.wearSkirt !== undefined)
        ? clothContext.wearSkirt
        : (eqClothingState && eqClothingState.wearSkirt)
    );

    const N_BODICE = isHoodOpen ? 29 : 28;
    const bodiceRings = [];
    const skirtEase = wearSkirtUnderHoodie
      ? [
          { rx: 0.000 * s, rzF: 0.000 * s, rzB: 0.000 * s },
          { rx: 0.000 * s, rzF: 0.000 * s, rzB: 0.000 * s },
          { rx: 0.000 * s, rzF: 0.000 * s, rzB: 0.000 * s },
          { rx: 0.011 * s, rzF: 0.010 * s, rzB: 0.010 * s },
          { rx: 0.022 * s, rzF: 0.021 * s, rzB: 0.021 * s },
          { rx: 0.025 * s, rzF: 0.024 * s, rzB: 0.024 * s },
          { rx: 0.025 * s, rzF: 0.024 * s, rzB: 0.024 * s },
          { rx: 0.023 * s, rzF: 0.022 * s, rzB: 0.022 * s },
          { rx: 0.021 * s, rzF: 0.020 * s, rzB: 0.020 * s }
        ]
      : null;
    const bodiceLevels = [
      // dy from collarBase, rx, rzFront, rzBack, openGapHalfAng, weight, scalloped
      { dy: -0.016 * s, rx: 0.082 * s, rzF: 0.072 * s, rzB: 0.068 * s, gap: 0.11, t: 0.00, scalloped: false }, // 0: Collarbone seam
      { dy: -0.056 * s, rx: 0.106 * s, rzF: 0.084 * s, rzB: 0.072 * s, gap: 0.21, t: 0.06, scalloped: false }, // 1: Shoulder / upper armhole line
      { dy: -0.100 * s, rx: 0.095 * s, rzF: 0.086 * s, rzB: 0.068 * s, gap: 0.27, t: 0.16, scalloped: false }, // 2: Bust / armpit line
      { dy: -0.156 * s, rx: 0.084 * s + (skirtEase ? skirtEase[3].rx : 0), rzF: 0.074 * s + (skirtEase ? skirtEase[3].rzF : 0), rzB: 0.069 * s + (skirtEase ? skirtEase[3].rzB : 0), gap: 0.32, t: 0.35, scalloped: false }, // 3: Tailored waist taper
      { dy: -0.208 * s, rx: 0.106 * s + (skirtEase ? skirtEase[4].rx : 0), rzF: 0.084 * s + (skirtEase ? skirtEase[4].rzF : 0), rzB: 0.090 * s + (skirtEase ? skirtEase[4].rzB : 0), gap: 0.36, t: 0.50, scalloped: false }, // 4: Upper hip transition
      { dy: -0.258 * s, rx: 0.126 * s + (skirtEase ? skirtEase[5].rx : 0), rzF: 0.095 * s + (skirtEase ? skirtEase[5].rzF : 0), rzB: 0.108 * s + (skirtEase ? skirtEase[5].rzB : 0), gap: 0.39, t: 0.66, scalloped: false }, // 5: Full hip / thigh start
      { dy: -0.310 * s, rx: 0.138 * s + (skirtEase ? skirtEase[6].rx : 0), rzF: 0.104 * s + (skirtEase ? skirtEase[6].rzF : 0), rzB: 0.115 * s + (skirtEase ? skirtEase[6].rzB : 0), gap: 0.42, t: 0.80, scalloped: false }, // 6: Upper thigh wrap ring
      { dy: -0.356 * s, rx: 0.146 * s + (skirtEase ? skirtEase[7].rx : 0), rzF: 0.110 * s + (skirtEase ? skirtEase[7].rzF : 0), rzB: 0.120 * s + (skirtEase ? skirtEase[7].rzB : 0), gap: 0.44, t: 0.91, scalloped: false }, // 7: Mid thigh wrap ring
      { dy: -0.398 * s, rx: 0.154 * s + (skirtEase ? skirtEase[8].rx : 0), rzF: 0.116 * s + (skirtEase ? skirtEase[8].rzF : 0), rzB: 0.126 * s + (skirtEase ? skirtEase[8].rzB : 0), gap: 0.46, t: 1.00, scalloped: true  }  // 8: Mid-thigh scalloped hem
    ];

    // Measure current stride swing of left/right legs in torso space so skirt drapes OVER raised knees instead of lagging behind them
    const bodiceStride = _computeGarmentLegStride(bodyColliderData, torsoRight, torsoFwd, 0.72, !isLocal);
    const lFwdSwing = bodiceStride.lFwd;
    const lBackSwing = bodiceStride.lBack;
    const lOutSpread = bodiceStride.lOut;
    const rFwdSwing = bodiceStride.rFwd;
    const rBackSwing = bodiceStride.rBack;
    const rOutSpread = bodiceStride.rOut;

    // When wearing Black Pleated Skirt underneath, reuse its clamped crest envelope from clothContext if built earlier in the frame,
    // otherwise sample its outer pleat crests directly so hoodie walls stay strictly outside.
    let clampPointOutsideActiveSkirt = null;
    if (wearSkirtUnderHoodie) {
      let worldRings = (clothContext && clothContext._cachedSkirtEnvelope) ? clothContext._cachedSkirtEnvelope : null;
      if (!worldRings) {
        const torsoRatioSk = Math.max(0.75, Math.min(1.15, tLen / (0.27 * s)));
        const waistOriginSk = [
          chestP1[0] + torsoUp[0] * (tLen * 0.41),
          chestP1[1] + torsoUp[1] * (tLen * 0.41),
          chestP1[2] + torsoUp[2] * (tLen * 0.41)
        ];
        const skRingsDef = _getBlackPleatedSkirtRingsDef(s, torsoRatioSk, true);
        const NUM_PLEATS_SK = 18;
        const skStride = _computeGarmentLegStride(bodyColliderData, torsoRight, torsoFwd, 0.68, true);
        worldRings = [];
        for (let sr = 0; sr < skRingsDef.length; sr++) {
          const sLvl = skRingsDef[sr];
          const sw = sLvl.t;
          const wPrimarySk = sw * (0.48 + 0.52 * sw);
          const wWhipSk = sw * sw * (0.40 + 0.60 * sw);
          const bounceYSk = Math.sin(effPhase * 2.0) * 0.0055 * sw * s;
          const sbDisp = [
            (hPhys.gx * 0.24 * wPrimarySk + hPhys.tx * 0.28 * wWhipSk + hPhys.airX * 0.45 * sw + (yAngle * 0.024 + rAngle * 0.016 + yawLagTerm * 0.60) * sw + breezeX * 0.55 * sw + turbX * 0.55 * sw) * s,
            (hPhys.gy * 0.24 * wPrimarySk + hPhys.ty * 0.28 * wWhipSk + hPhys.airY * 0.45 * sw + turbY * 0.55 * sw) * s + bounceYSk,
            (hPhys.gz * 0.24 * wPrimarySk + hPhys.tz * 0.28 * wWhipSk + hPhys.airZ * 0.45 * sw - pAngle * 0.028 * sw + breezeZ * 0.55 * sw + turbZ * 0.55 * sw) * s
          ];
          const sFlare = (airFlare * 0.24 + Math.abs(yAngle) * 0.012) * sw * s;
          const ringPts = [];
          for (let p = 0; p < NUM_PLEATS_SK; p++) {
            const ang = ((p + 0.02) / NUM_PLEATS_SK) * Math.PI * 2.0;
            const sinA = Math.sin(ang);
            const cosA = Math.cos(ang);
            const rz = (cosA >= 0.0) ? sLvl.rzF : sLvl.rzB;
            const skD = _computeSkirtVertexDisplacement(sinA, cosA, sw, 0.18, s, sbDisp, skStride, 0.042, effPhase, 0.003, 0.28, 0.30, 0.25, 0.20, 0.72);
            const slx = sinA * (sLvl.rx + sLvl.pleatDepth + sFlare) + sbDisp[0] + skD.legSidePush;
            const sly = sLvl.dy + sbDisp[1] + skD.rippleY + (skD.legFrontTent * 0.14 + skD.legBackTent * 0.10);
            const slz = sLvl.cy + cosA * (rz + sLvl.pleatDepth + sFlare) + skD.effDispZ + (skD.legFrontTent * 0.80 - skD.legBackTent * 0.70);
            const wx = waistOriginSk[0] + torsoRight[0] * slx + torsoUp[0] * sly + torsoFwd[0] * slz;
            const wy = waistOriginSk[1] + torsoRight[1] * slx + torsoUp[1] * sly + torsoFwd[1] * slz;
            const wz = waistOriginSk[2] + torsoRight[2] * slx + torsoUp[2] * sly + torsoFwd[2] * slz;
            const hint = (sr >= 2) ? [torsoRight[0] * sinA + torsoFwd[0] * cosA, 0.0, torsoRight[2] * sinA + torsoFwd[2] * cosA] : null;
            ringPts.push(clampPointOutsideChibiBodyForCloth(wx, wy, wz, bodyColliderData, sLvl.clr, false, hint));
          }
          worldRings.push(ringPts);
        }
      }
      clampPointOutsideActiveSkirt = _buildSkirtEnvelopeClampFn(
        worldRings, collarBaseX, collarBaseY, collarBaseZ, torsoRight, torsoUp, torsoFwd, s
      );
    }

    const computeSkirtVertex = (lvl, rIdx, ang, jIdx, radScale = 1.0) => {
      const w = lvl.t;
      const bDisp = computeClothDisp(w, 0.90);
      const flare = (airFlare * 0.55 + Math.abs(yAngle) * 0.025) * w * s;
      const sinA = Math.sin(ang);
      const cosA = Math.cos(ang);
      const rz = (cosA >= 0.0) ? lvl.rzF : lvl.rzB;

      const rippleY = (isLocal || w < 0.05) ? 0.0 : (Math.sin(effPhase * 2.2 + ang * 2.0) * 0.008 * w * s);
      const rippleR = (isLocal || w < 0.05) ? 0.0 : (Math.cos(effPhase * 1.8 + ang * 2.0) * 0.006 * w * s);

      const bd = _computeSkirtVertexDisplacement(sinA, cosA, w, 0.35, s, bDisp, bodiceStride, 0.045, 0.0, 0.0, 0.24, 0.28, 0.28, 0.22, 0.75);

      let lx = sinA * (lvl.rx * radScale + flare + rippleR) + bDisp[0] + bd.legSidePush;
      let ly = lvl.dy + bDisp[1] + rippleY + (bd.legFrontTent * 0.16 + bd.legBackTent * 0.12);
      let lz = cosA * (rz * radScale + flare + rippleR) + bd.effDispZ + (bd.legFrontTent * 0.82 - bd.legBackTent * 0.72);

      const isRidge = (jIdx % 2 === 0);
      if (lvl.scalloped) {
        if (radScale < 0.99) {
          ly -= 0.018 * s;
        } else if (isRidge) {
          ly -= 0.036 * s;
          lx += sinA * (0.009 * s);
          lz += cosA * (0.009 * s);
        } else {
          ly += 0.020 * s;
          lx -= sinA * (0.004 * s);
          lz -= cosA * (0.004 * s);
        }
      }

      const pushHint = (rIdx >= 4)
        ? [
            torsoRight[0] * sinA + torsoFwd[0] * cosA,
            0.0,
            torsoRight[2] * sinA + torsoFwd[2] * cosA
          ]
        : null;

      return { pos: torsoPt(lx, ly, lz), isRidge, pushHint };
    };

    for (let rIdx = 0; rIdx < bodiceLevels.length; rIdx++) {
      const lvl = bodiceLevels[rIdx];
      const ringVerts = [];
      const startAng = isHoodOpen ? lvl.gap : 0.0;
      const endAng = isHoodOpen ? (Math.PI * 2 - lvl.gap) : (Math.PI * 2);

      for (let j = 0; j < N_BODICE; j++) {
        const ang = isHoodOpen
          ? (startAng + (j / (N_BODICE - 1)) * (endAng - startAng))
          : ((j / N_BODICE) * Math.PI * 2);
        const vData = computeSkirtVertex(lvl, rIdx, ang, j, 1.0);
        const col = (lvl.scalloped && !vData.isRidge) ? colCrease : (vData.isRidge ? colHighlight : colCloth);
        // Clamp lower skirt generously over moving thighs & calves, keeping upper collar/shoulder snug
        const clr = (rIdx <= 1) ? 0.005 : ((rIdx <= 3) ? 0.008 : (rIdx >= bodiceLevels.length - 1 ? 0.015 : 0.012));
        const checkArms = (rIdx >= 3);
        let pOut = vData.pos;
        if (clampPointOutsideActiveSkirt && rIdx >= 3) {
          pOut = clampPointOutsideActiveSkirt(pOut, 0.0155 * s);
        }
        ringVerts.push(addV(pOut[0], pOut[1], pOut[2], col, clr, checkArms, null, vData.pushHint));
      }
      bodiceRings.push(ringVerts);
    }

    const bodiceSegs = isHoodOpen ? (N_BODICE - 1) : N_BODICE;
    for (let r = 0; r < bodiceRings.length - 1; r++) {
      const r0 = bodiceRings[r];
      const r1 = bodiceRings[r + 1];
      for (let j = 0; j < bodiceSegs; j++) {
        const nextJ = (j + 1) % N_BODICE;
        addQuad(r0[j], r1[j], r1[nextJ], r0[nextJ]);
      }
    }

    // Bridge collar directly onto upper bodice Ring 0 (zero neck-shoulder gap)
    if (!isHoodOpen) {
      for (let j = 0; j < N_BODICE; j++) {
        const nextJ = (j + 1) % N_BODICE;
        const cIdx0 = Math.round((j / N_BODICE) * 8) % 8;
        const cIdx1 = Math.round((nextJ / N_BODICE) * 8) % 8;
        addTri(vCollar[cIdx0], bodiceRings[0][j], bodiceRings[0][nextJ]);
        if (cIdx0 !== cIdx1) {
          addTri(vCollar[cIdx0], bodiceRings[0][nextJ], vCollar[cIdx1]);
        }
      }
    } else {
      for (let j = 0; j < N_BODICE - 1; j++) {
        const startAng0 = bodiceLevels[0].gap;
        const endAng0 = Math.PI * 2 - bodiceLevels[0].gap;
        const ang0 = startAng0 + (j / (N_BODICE - 1)) * (endAng0 - startAng0);
        const ang1 = startAng0 + ((j + 1) / (N_BODICE - 1)) * (endAng0 - startAng0);
        const cIdx0 = Math.round((ang0 / (Math.PI * 2)) * 8) % 8;
        const cIdx1 = Math.round((ang1 / (Math.PI * 2)) * 8) % 8;
        const vc0 = vCollar[cIdx0];
        const vc1 = vCollar[cIdx1];
        addTri(vc0, bodiceRings[0][j], bodiceRings[0][j + 1]);
        if (vc0 !== vc1) {
          addTri(vc0, bodiceRings[0][j + 1], vc1);
        }
      }

      // Tailored front opening inner lapel facing (follows exact same leg tenting & pushout so it never lags into legs)
      const lapelRadScale = wearSkirtUnderHoodie ? 0.94 : 0.86;
      for (const sideIdx of [0, N_BODICE - 1]) {
        const innerLapelVerts = [];
        for (let rIdx = 0; rIdx < bodiceLevels.length; rIdx++) {
          const lvl = bodiceLevels[rIdx];
          const ang = (sideIdx === 0) ? (lvl.gap + 0.04) : (Math.PI * 2 - lvl.gap - 0.04);
          const vData = computeSkirtVertex(lvl, rIdx, ang, sideIdx, lapelRadScale);
          const clr = (rIdx <= 3) ? 0.005 : 0.010;
          let pLapel = vData.pos;
          if (clampPointOutsideActiveSkirt && rIdx >= 3) {
            pLapel = clampPointOutsideActiveSkirt(pLapel, 0.0065 * s);
          }
          innerLapelVerts.push(addV(pLapel[0], pLapel[1], pLapel[2], colCrease, clr, false, null, vData.pushHint));
        }
        for (let r = 0; r < bodiceRings.length - 1; r++) {
          if (sideIdx === 0) {
            addQuad(innerLapelVerts[r], innerLapelVerts[r + 1], bodiceRings[r + 1][0], bodiceRings[r][0]);
          } else {
            addQuad(bodiceRings[r][N_BODICE - 1], bodiceRings[r + 1][N_BODICE - 1], innerLapelVerts[r + 1], innerLapelVerts[r]);
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // 4. Compact Fitted Shoulder Mantle / Upper Capelet (ตามเรฟ image_477ce4ad.png, พอดีไหล่ไม่กางออก)
    // -------------------------------------------------------------------------
    const N_CAPELET = 14;
    const capeletLevels = [
      { dy: -0.012 * s, rx: 0.082 * s, rz: 0.072 * s, t: 0.00, gap: 0.12 },
      { dy: -0.086 * s, rx: 0.122 * s, rz: 0.098 * s, t: 0.18, gap: 0.25 }
    ];
    const capeletRings = [];
    for (let rIdx = 0; rIdx < capeletLevels.length; rIdx++) {
      const lvl = capeletLevels[rIdx];
      const ring = [];
      const w = lvl.t;
      const capDisp = computeClothDisp(w, 0.72);
      const capFlare = airFlare * 0.25 * w * s;
      const startAng = isHoodOpen ? lvl.gap : 0.0;
      const endAng = isHoodOpen ? (Math.PI * 2 - lvl.gap) : (Math.PI * 2);

      for (let j = 0; j < N_CAPELET; j++) {
        const ang = isHoodOpen
          ? (startAng + (j / (N_CAPELET - 1)) * (endAng - startAng))
          : ((j / N_CAPELET) * Math.PI * 2);
        const sinA = Math.sin(ang);
        const cosA = Math.cos(ang);
        // Arch gently up over the outer shoulder seam (|sinA| large) so the connected sleeves flow cleanly underneath!
        const shoulderArch = (rIdx === 1) ? (Math.pow(Math.abs(sinA), 2.0) * 0.018 * s) : 0.0;
        const isRidge = (j % 2 === 0);
        const scallop = (rIdx === 1) ? (isRidge ? -0.012 * s : 0.008 * s) : 0.0;
        const cp = torsoPt(
          sinA * (lvl.rx + capFlare) + capDisp[0],
          lvl.dy + capDisp[1] + scallop + shoulderArch,
          cosA * (lvl.rz + capFlare) + capDisp[2]
        );
        ring.push(addV(cp[0], cp[1], cp[2], (rIdx === 1 && isRidge) ? colHighlight : colCloth, 0.006, false));
      }
      capeletRings.push(ring);
    }
    const capSegs = isHoodOpen ? (N_CAPELET - 1) : N_CAPELET;
    for (let j = 0; j < capSegs; j++) {
      const nextJ = (j + 1) % N_CAPELET;
      addQuad(capeletRings[0][j], capeletRings[1][j], capeletRings[1][nextJ], capeletRings[0][nextJ]);
    }

    // -------------------------------------------------------------------------
    // 5. Seamless Long Sleeves Connected Directly to Hoodie Shoulders (แขนเสื้อยาวเชื่อมกับฮูด)
    // -------------------------------------------------------------------------
    const buildConnectedLongSleeve = (pShoulder, pElbow, pHand, isLeft) => {
      if (!pShoulder || !pElbow || !pHand) return;
      const N_SLEEVE = 12;
      const side = isLeft ? -1.0 : 1.0;

      const norm3 = (v, fb = [0, -1, 0]) => {
        const l = Math.hypot(v[0], v[1], v[2]);
        return l > 1e-5 ? [v[0] / l, v[1] / l, v[2] / l] : fb;
      };
      const cross3 = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
      ];
      const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const lerp3 = (a, b, t) => [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t
      ];

      const dirUpper = norm3([pElbow[0] - pShoulder[0], pElbow[1] - pShoulder[1], pElbow[2] - pShoulder[2]], [side * 0.25, -0.96, 0]);
      const dirFore  = norm3([pHand[0] - pElbow[0], pHand[1] - pElbow[1], pHand[2] - pElbow[2]], dirUpper);
      const dirElbow = norm3([dirUpper[0] + dirFore[0], dirUpper[1] + dirFore[1], dirUpper[2] + dirFore[2]], dirUpper);

      // Anchor armhole ring right inside the hoodie bodice shoulder seam so there is ZERO gap!
      const pArmhole = [
        pShoulder[0] - torsoRight[0] * (side * 0.016 * s) + torsoUp[0] * (0.004 * s),
        pShoulder[1] - torsoRight[1] * (side * 0.016 * s) + torsoUp[1] * (0.004 * s),
        pShoulder[2] - torsoRight[2] * (side * 0.016 * s) + torsoUp[2] * (0.004 * s)
      ];
      const dirArmhole = norm3([
        torsoRight[0] * side * 0.85 + dirUpper[0] * 0.35,
        torsoRight[1] * side * 0.85 + dirUpper[1] * 0.35 - 0.12,
        torsoRight[2] * side * 0.85 + dirUpper[2] * 0.35
      ], dirUpper);

      // Subtle cloth gravity sag on hanging sleeve sections
      const slvDisp = computeClothDisp(0.24, 0.55);

      const stations = [
        // Armhole root seated directly inside bodice shoulder wall
        { p: pArmhole,                     dir: dirArmhole, rx: 0.048 * s, ry: 0.052 * s, col: colCrease, clamp: false, sag: 0.00, vAx: 0.000 },
        // Shoulder cap transitioning smoothly over deltoid
        { p: pShoulder,                    dir: dirUpper,   rx: 0.049 * s, ry: 0.049 * s, col: colCloth,  clamp: false, sag: 0.05, vAx: 0.025 },
        // Upper arm contour
        { p: lerp3(pShoulder, pElbow, 0.32), dir: dirUpper, rx: 0.047 * s, ry: 0.046 * s, col: colCloth,  clamp: true,  sag: 0.25, vAx: 0.065 },
        { p: lerp3(pShoulder, pElbow, 0.68), dir: dirUpper, rx: 0.044 * s, ry: 0.043 * s, col: colCloth,  clamp: true,  sag: 0.45, vAx: 0.110 },
        // Smooth mitered elbow bend (zero break/notch during any bend!)
        { p: lerp3(pShoulder, pElbow, 0.88), dir: norm3(lerp3(dirUpper, dirElbow, 0.5)), rx: 0.043 * s, ry: 0.042 * s, col: colCloth, clamp: true, sag: 0.55, vAx: 0.132 },
        { p: pElbow,                       dir: dirElbow,   rx: 0.042 * s, ry: 0.041 * s, col: colCrease, clamp: true,  sag: 0.62, vAx: 0.148 },
        { p: lerp3(pElbow, pHand, 0.12),   dir: norm3(lerp3(dirElbow, dirFore, 0.5)),  rx: 0.042 * s, ry: 0.041 * s, col: colCloth, clamp: true, sag: 0.66, vAx: 0.165 },
        // Forearm fitted taper down toward wrist
        { p: lerp3(pElbow, pHand, 0.45),   dir: dirFore,    rx: 0.040 * s, ry: 0.039 * s, col: colCloth,  clamp: true,  sag: 0.78, vAx: 0.205 },
        { p: lerp3(pElbow, pHand, 0.78),   dir: dirFore,    rx: 0.038 * s, ry: 0.037 * s, col: colCloth,  clamp: true,  sag: 0.90, vAx: 0.245 },
        // Tailored fitted hoodie wrist cuff & inner return lip (ยาวพอดีข้อมือ)
        { p: lerp3(pElbow, pHand, 0.92),   dir: dirFore,    rx: 0.039 * s, ry: 0.038 * s, col: colHighlight, clamp: true, sag: 0.96, vAx: 0.264 },
        { p: lerp3(pElbow, pHand, 0.99),   dir: dirFore,    rx: 0.036 * s, ry: 0.035 * s, col: colHighlight, clamp: true, sag: 1.00, vAx: 0.275 },
        { p: lerp3(pElbow, pHand, 0.90),   dir: dirFore,    rx: 0.028 * s, ry: 0.028 * s, col: colCrease,    clamp: false, sag: 0.96, vAx: -1.0 }
      ];

      // Build parallel-transported local cross-section basis (U, V) so twisting is completely smooth
      let curU = cross3(torsoFwd, stations[0].dir);
      if (Math.hypot(curU[0], curU[1], curU[2]) < 1e-4) {
        curU = cross3([0, 1, 0], stations[0].dir);
      }
      curU = norm3(curU, [side, 0, 0]);
      let curV = norm3(cross3(stations[0].dir, curU), [0, 0, 1]);

      const rings = [];
      for (let k = 0; k < stations.length; k++) {
        const st = stations[k];
        if (k > 0) {
          const proj = dot3(curU, st.dir);
          const nextU = [curU[0] - st.dir[0] * proj, curU[1] - st.dir[1] * proj, curU[2] - st.dir[2] * proj];
          if (Math.hypot(nextU[0], nextU[1], nextU[2]) > 1e-4) {
            curU = norm3(nextU, curU);
            curV = norm3(cross3(st.dir, curU), curV);
          }
        }

        const ring = [];
        for (let j = 0; j < N_SLEEVE; j++) {
          const ang = (j / N_SLEEVE) * Math.PI * 2;
          const cosA = Math.cos(ang);
          const sinA = Math.sin(ang);

          let vx = st.p[0] + (curU[0] * cosA * st.rx + curV[0] * sinA * st.ry) + slvDisp[0] * st.sag;
          let vy = st.p[1] + (curU[1] * cosA * st.rx + curV[1] * sinA * st.ry) + slvDisp[1] * st.sag;
          let vz = st.p[2] + (curU[2] * cosA * st.rx + curV[2] * sinA * st.ry) + slvDisp[2] * st.sag;

          if (st.clamp && !isLocal) {
            const c1 = clampPointOutsideSegmentCapsule(vx, vy, vz, pShoulder, pElbow, 0.043 * s, 0.036 * s, 0.004 * s);
            const c2 = clampPointOutsideSegmentCapsule(c1[0], c1[1], c1[2], pElbow, pHand, 0.036 * s, 0.027 * s, 0.004 * s);
            vx = c2[0]; vy = c2[1]; vz = c2[2];
          }

          const uv = (st.vAx >= 0.0) ? [-2.0 - (j / N_SLEEVE), st.vAx] : [-9.0, -9.0];
          ring.push(addV(vx, vy, vz, st.col, 0.0, false, uv));
        }
        rings.push(ring);
      }

      for (let k = 0; k < rings.length - 1; k++) {
        const r0 = rings[k];
        const r1 = rings[k + 1];
        for (let j = 0; j < N_SLEEVE; j++) {
          const nextJ = (j + 1) % N_SLEEVE;
          addQuad(r0[j], r0[nextJ], r1[nextJ], r1[j]);
        }
      }
    };

    buildConnectedLongSleeve(leftArmPivot, leftElbowRot, leftHandRot, true);
    buildConnectedLongSleeve(rightArmPivot, rightElbowRot, rightHandRot, false);

    // -------------------------------------------------------------------------
    // 6. Golden Flower Brooch at Throat Clasp (เข็มกลัดทองตรงคอเสื้อ)
    // -------------------------------------------------------------------------
    const broochOffX = isHoodOpen ? -0.020 * s : 0.0;
    const broochPos = torsoPt(broochOffX, -0.018 * s, 0.082 * s);
    const bX = broochPos[0];
    const bY = broochPos[1];
    const bZ = broochPos[2];

    isClothSection = false;
    const rBrooch = 0.020 * s;
    const vBroochC = addV(bX, bY, bZ + rBrooch * 0.75, colBroochCenter, 0.005, false);
    const broochRing = [];
    for (let j = 0; j < 8; j++) {
      const ang = (j / 8) * Math.PI * 2;
      const bx = bX + Math.sin(ang) * rBrooch;
      const by = bY + Math.cos(ang) * rBrooch;
      broochRing.push(addV(bx, by, bZ, colBrooch, 0.005, false));
    }
    for (let j = 0; j < 8; j++) {
      const nextI = (j + 1) % 8;
      addTri(broochRing[j], vBroochC, broochRing[nextI]);
    }

    isClothSection = true;
    const rPetal = 0.036 * s;
    for (let j = 0; j < 6; j++) {
      const ang = (j / 6) * Math.PI * 2;
      const pTipX = bX + Math.sin(ang) * rPetal;
      const pTipY = bY + Math.cos(ang) * rPetal;
      const pTipZ = bZ + 0.003 * s;
      const angL = ang - 0.30;
      const angR = ang + 0.30;
      const pBaseLX = bX + Math.sin(angL) * (rBrooch * 0.85);
      const pBaseLY = bY + Math.cos(angL) * (rBrooch * 0.85);
      const pBaseRX = bX + Math.sin(angR) * (rBrooch * 0.85);
      const pBaseRY = bY + Math.cos(angR) * (rBrooch * 0.85);
      const vTipP = addV(pTipX, pTipY, pTipZ, colHighlight);
      const vBaseL = addV(pBaseLX, pBaseLY, bZ, colCloth);
      const vBaseR = addV(pBaseRX, pBaseRY, bZ, colCloth);
      addTri(vBaseL, vTipP, vBaseR);
    }

    const frontTriCount = outI.length;
    const normals = new Float32Array(outV.length);
    for (let k = 0; k < frontTriCount; k += 3) {
      const i0 = outI[k], i1 = outI[k + 1], i2 = outI[k + 2];
      const p0x = outV[i0 * 3], p0y = outV[i0 * 3 + 1], p0z = outV[i0 * 3 + 2];
      const p1x = outV[i1 * 3], p1y = outV[i1 * 3 + 1], p1z = outV[i1 * 3 + 2];
      const p2x = outV[i2 * 3], p2y = outV[i2 * 3 + 1], p2z = outV[i2 * 3 + 2];

      const uX = p1x - p0x, uY = p1y - p0y, uZ = p1z - p0z;
      const vX = p2x - p0x, vY = p2y - p0y, vZ = p2z - p0z;

      const nX = uY * vZ - uZ * vY;
      const nY = uZ * vX - uX * vZ;
      const nZ = uX * vY - uY * vX;

      normals[i0 * 3]     += nX; normals[i0 * 3 + 1] += nY; normals[i0 * 3 + 2] += nZ;
      normals[i1 * 3]     += nX; normals[i1 * 3 + 1] += nY; normals[i1 * 3 + 2] += nZ;
      normals[i2 * 3]     += nX; normals[i2 * 3 + 1] += nY; normals[i2 * 3 + 2] += nZ;
    }

    for (let k = 0; k < normals.length; k += 3) {
      const l = Math.hypot(normals[k], normals[k + 1], normals[k + 2]);
      if (l > 0.0001) {
        normals[k] /= l;
        normals[k + 1] /= l;
        normals[k + 2] /= l;
      } else {
        normals[k + 1] = 1.0;
      }
    }

    for (let k = 0; k < frontTriCount; k += 3) {
      outI.push(outI[k], outI[k + 2], outI[k + 1]);
    }

    return {
      vertices: outV,
      normals: normals,
      colors: outC,
      texcoords: outT,
      indices: outI
    };
  }

  // =========================================================================
  // --- 11A. Traveler Ankle Boots Standalone Mesh Builder (TRAVELER_BOOTS) ---
  // =========================================================================
  function buildTravelerBootsMesh(leftFootRot, rightFootRot, scale = 1.0, clothContext = null) {
    const outV = [];
    const outC = [];
    const outI = [];
    const outT = [];
    const s = scale || 1.0;

    const colUpper = [0.125, 0.130, 0.155];
    const colTrim = [0.165, 0.172, 0.200];
    const colSole = [0.062, 0.065, 0.080];
    const colInner = [0.045, 0.048, 0.060];

    const addV = (px, py, pz, color) => {
      const idx = (outV.length / 3) | 0;
      outV.push(px, py, pz);
      outC.push(color[0], color[1], color[2]);
      // Mark outside diamond shader range so boots never receive cloak pattern spots
      outT.push(-9.0, -9.0);
      return idx;
    };

    const addTri = (v0, v1, v2) => {
      outI.push(v0, v1, v2);
    };

    const addQuad = (v0, v1, v2, v3) => {
      outI.push(v0, v1, v2);
      outI.push(v0, v2, v3);
    };

    const addTravelerBoot = (pFoot, pKnee, isLeft, pHip = null, legRig = null) => {
      if (!pFoot) return;
      const fx = pFoot[0];
      const fy = pFoot[1];
      const fz = pFoot[2];

      const activeLegRig = legRig || computeLegRigFrame(pHip, pKnee, pFoot, isLeft);
      const footBasis = activeLegRig.footBoneBasis;
      const fRight = footBasis.rightAxis;
      const fUp = footBasis.upAxis;
      const fFwd = footBasis.fwdAxis;

      // 1. Align boot ankle shaft strictly with actual shin direction (pKnee - pFoot)
      //    and blend smoothly into footBoneBasis so walking/running/jumping never tear or clip!
      let ux = fUp[0], uy = fUp[1], uz = fUp[2];
      if (pKnee) {
        const vx = pKnee[0] - fx;
        const vy = pKnee[1] - fy;
        const vz = pKnee[2] - fz;
        const vLen = Math.hypot(vx, vy, vz);
        if (vLen > 1e-4) {
          ux = vx / vLen; uy = vy / vLen; uz = vz / vLen;
        }
      }
      // Shaft right = normalize(up x fFwd)
      let rxX = uy * fFwd[2] - uz * fFwd[1];
      let rxY = uz * fFwd[0] - ux * fFwd[2];
      let rxZ = ux * fFwd[1] - uy * fFwd[0];
      const rxL = Math.hypot(rxX, rxY, rxZ) || 1.0;
      rxX /= rxL; rxY /= rxL; rxZ /= rxL;
      // Shaft fwd = right x up
      const fxX = rxY * uz - rxZ * uy;
      const fxY = rxZ * ux - rxX * uz;
      const fxZ = rxX * uy - rxY * ux;

      const SHAFT_SIDES = 16;
      const midRxX = (rxX + fRight[0]) * 0.5, midRxY = (rxY + fRight[1]) * 0.5, midRxZ = (rxZ + fRight[2]) * 0.5;
      const midRxL = Math.hypot(midRxX, midRxY, midRxZ) || 1.0;
      const mrxX = midRxX / midRxL, mrxY = midRxY / midRxL, mrxZ = midRxZ / midRxL;

      const midFxX = (fxX + fFwd[0]) * 0.5, midFxY = (fxY + fFwd[1]) * 0.5, midFxZ = (fxZ + fFwd[2]) * 0.5;
      const midFxL = Math.hypot(midFxX, midFxY, midFxZ) || 1.0;
      const mfxX = midFxX / midFxL, mfxY = midFxY / midFxL, mfxZ = midFxZ / midFxL;

      const footPt = (dx, dy, dz) => [
        fx + fRight[0] * dx + fUp[0] * dy + fFwd[0] * dz,
        fy + fRight[1] * dx + fUp[1] * dy + fFwd[1] * dz,
        fz + fRight[2] * dx + fUp[2] * dy + fFwd[2] * dz,
      ];

      const anchorPt = footPt(0, -0.013 * s, 0.002 * s);
      const shaftRingsDef = [
        { cx: fx + ux * 0.034 * s, cy: fy + uy * 0.034 * s, cz: fz + uz * 0.034 * s, rx: 0.0335 * s, rz: 0.0335 * s, rAx: [rxX, rxY, rxZ], fAx: [fxX, fxY, fxZ], col: colInner }, // 0: Inner cuff tucked cleanly inside calf/leggings
        { cx: fx + ux * 0.039 * s, cy: fy + uy * 0.039 * s, cz: fz + uz * 0.039 * s, rx: 0.0415 * s, rz: 0.0420 * s, rAx: [rxX, rxY, rxZ], fAx: [fxX, fxY, fxZ], col: colTrim  }, // 1: Smooth rolled top collar rim
        { cx: fx + ux * 0.015 * s, cy: fy + uy * 0.015 * s, cz: fz + uz * 0.015 * s, rx: 0.0420 * s, rz: 0.0430 * s, rAx: [mrxX, mrxY, mrxZ], fAx: [mfxX, mfxY, mfxZ], col: colUpper }, // 2: Elastic ankle bridge following stride
        { cx: anchorPt[0],         cy: anchorPt[1],         cz: anchorPt[2],         rx: 0.0425 * s, rz: 0.0440 * s, rAx: fRight,            fAx: fFwd,            col: colUpper }  // 3: Anchored deep inside solid shoe vamp (zero gap!)
      ];

      const shaftRings = [];
      for (let r = 0; r < shaftRingsDef.length; r++) {
        const def = shaftRingsDef[r];
        const ring = [];
        for (let i = 0; i < SHAFT_SIDES; i++) {
          const ang = (i / SHAFT_SIDES) * Math.PI * 2.0;
          const sinA = Math.sin(ang);
          const cosA = Math.cos(ang);
          ring.push(addV(
            def.cx + def.rAx[0] * (sinA * def.rx) + def.fAx[0] * (cosA * def.rz),
            def.cy + def.rAx[1] * (sinA * def.rx) + def.fAx[1] * (cosA * def.rz),
            def.cz + def.rAx[2] * (sinA * def.rx) + def.fAx[2] * (cosA * def.rz),
            def.col
          ));
        }
        shaftRings.push(ring);
      }

      for (let r = 0; r < shaftRings.length - 1; r++) {
        const r0 = shaftRings[r];
        const r1 = shaftRings[r + 1];
        for (let i = 0; i < SHAFT_SIDES; i++) {
          const nextI = (i + 1) % SHAFT_SIDES;
          addQuad(r0[i], r1[i], r1[nextI], r0[nextI]);
        }
      }
      const botShaft = shaftRings[shaftRings.length - 1];
      const baseCPt = footPt(0, -0.015 * s, 0.002 * s);
      const vBaseC = addV(baseCPt[0], baseCPt[1], baseCPt[2], colUpper);
      for (let i = 0; i < SHAFT_SIDES; i++) {
        const nextI = (i + 1) % SHAFT_SIDES;
        addTri(vBaseC, botShaft[nextI], botShaft[i]);
      }

      // 2. Sculpted Superellipse Shoe Vamp, Toe Box & Flat Sole oriented along footBoneBasis
      const xBias = (isLeft ? -0.001 : 0.001) * s;
      const shoeSlicesDef = [
        { z: -0.048 * s, rx: 0.034 * s, hTop: 0.017 * s, hBot: 0.016 * s, yMid: -0.020 * s }, // 0: Heel back bevel
        { z: -0.030 * s, rx: 0.044 * s, hTop: 0.028 * s, hBot: 0.022 * s, yMid: -0.020 * s }, // 1: Full heel counter
        { z:  0.000 * s, rx: 0.045 * s, hTop: 0.031 * s, hBot: 0.022 * s, yMid: -0.020 * s }, // 2: Ankle throat / midfoot arch
        { z:  0.032 * s, rx: 0.046 * s, hTop: 0.028 * s, hBot: 0.022 * s, yMid: -0.020 * s }, // 3: Instep / forefoot ball
        { z:  0.056 * s, rx: 0.043 * s, hTop: 0.022 * s, hBot: 0.021 * s, yMid: -0.021 * s }, // 4: Rounded toe box
        { z:  0.075 * s, rx: 0.024 * s, hTop: 0.012 * s, hBot: 0.014 * s, yMid: -0.023 * s }  // 5: Toe front bevel
      ];

      const SHOE_SIDES = 16;
      const shoeRings = [];
      for (let r = 0; r < shoeSlicesDef.length; r++) {
        const sl = shoeSlicesDef[r];
        const ring = [];
        const dxCenter = xBias * ((r / (shoeSlicesDef.length - 1)) * 1.5);
        for (let i = 0; i < SHOE_SIDES; i++) {
          const ang = (i / SHOE_SIDES) * Math.PI * 2.0;
          const sinA = Math.sin(ang);
          const cosA = Math.cos(ang);
          // Superellipse cross-section gives full side-corner clearance so toes/ankle never poke out
          const sSign = sinA >= 0 ? 1.0 : -1.0;
          const cSign = cosA >= 0 ? 1.0 : -1.0;
          const vxOff = sSign * Math.pow(Math.abs(sinA), 0.78) * sl.rx;
          const vyOff = (cSign > 0)
            ? (Math.pow(cosA, 0.80) * sl.hTop)
            : (-Math.pow(-cosA, 0.55) * sl.hBot);
          const isSolePart = cosA < -0.30;
          const pt = footPt(dxCenter + vxOff, sl.yMid + vyOff, sl.z);
          ring.push(addV(
            pt[0],
            pt[1],
            pt[2],
            isSolePart ? colSole : colUpper
          ));
        }
        shoeRings.push(ring);
      }

      for (let r = 0; r < shoeRings.length - 1; r++) {
        const r0 = shoeRings[r];
        const r1 = shoeRings[r + 1];
        for (let i = 0; i < SHOE_SIDES; i++) {
          const nextI = (i + 1) % SHOE_SIDES;
          addQuad(r0[i], r1[i], r1[nextI], r0[nextI]);
        }
      }

      const heelRing = shoeRings[0];
      const heelCapPt = footPt(0, -0.020 * s, -0.051 * s);
      const vHeelCap = addV(heelCapPt[0], heelCapPt[1], heelCapPt[2], colUpper);
      for (let i = 0; i < SHOE_SIDES; i++) {
        const nextI = (i + 1) % SHOE_SIDES;
        addTri(vHeelCap, heelRing[i], heelRing[nextI]);
      }

      const toeRing = shoeRings[shoeRings.length - 1];
      const toeCapPt = footPt(xBias * 1.5, -0.023 * s, 0.079 * s);
      const vToeCap = addV(toeCapPt[0], toeCapPt[1], toeCapPt[2], colUpper);
      for (let i = 0; i < SHOE_SIDES; i++) {
        const nextI = (i + 1) % SHOE_SIDES;
        addTri(vToeCap, toeRing[nextI], toeRing[i]);
      }
    };

    const lHip = clothContext ? clothContext.leftLegPivot : null;
    const rHip = clothContext ? clothContext.rightLegPivot : null;
    const lKnee = clothContext ? clothContext.leftKneeRot : null;
    const rKnee = clothContext ? clothContext.rightKneeRot : null;
    const lLegRig = clothContext ? clothContext.leftLegRig : null;
    const rLegRig = clothContext ? clothContext.rightLegRig : null;
    if (leftFootRot) addTravelerBoot(leftFootRot, lKnee, true, lHip, lLegRig);
    if (rightFootRot) addTravelerBoot(rightFootRot, rKnee, false, rHip, rLegRig);

    const normals = new Float32Array(outV.length);
    for (let k = 0; k < outI.length; k += 3) {
      const i0 = outI[k], i1 = outI[k + 1], i2 = outI[k + 2];
      const p0x = outV[i0 * 3], p0y = outV[i0 * 3 + 1], p0z = outV[i0 * 3 + 2];
      const p1x = outV[i1 * 3], p1y = outV[i1 * 3 + 1], p1z = outV[i1 * 3 + 2];
      const p2x = outV[i2 * 3], p2y = outV[i2 * 3 + 1], p2z = outV[i2 * 3 + 2];

      const uX = p1x - p0x, uY = p1y - p0y, uZ = p1z - p0z;
      const vX = p2x - p0x, vY = p2y - p0y, vZ = p2z - p0z;

      const nX = uY * vZ - uZ * vY;
      const nY = uZ * vX - uX * vZ;
      const nZ = uX * vY - uY * vX;

      normals[i0 * 3]     += nX; normals[i0 * 3 + 1] += nY; normals[i0 * 3 + 2] += nZ;
      normals[i1 * 3]     += nX; normals[i1 * 3 + 1] += nY; normals[i1 * 3 + 2] += nZ;
      normals[i2 * 3]     += nX; normals[i2 * 3 + 1] += nY; normals[i2 * 3 + 2] += nZ;
    }

    for (let k = 0; k < normals.length; k += 3) {
      const l = Math.hypot(normals[k], normals[k + 1], normals[k + 2]);
      if (l > 0.0001) {
        normals[k] /= l;
        normals[k + 1] /= l;
        normals[k + 2] /= l;
      } else {
        normals[k + 1] = 1.0;
      }
    }

    return {
      vertices: outV,
      normals: normals,
      colors: outC,
      texcoords: outT,
      indices: outI
    };
  }

  // =========================================================================
  // --- 11A-2. 3D White Spread Shirt Collar Mesh (WHITE_SHIRT_SHORT) ---
  // =========================================================================
  function buildWhiteShirtCollarMesh(headP1, chestP1, chestP2, neckP1, neckP2, scale = 1.0, ignoreOuterCoat = false) {
    const s = scale || 1.0;
    const eqState = ignoreOuterCoat ? { wearSuit: false } : getCharacterEquippedClothingState(false);
    const underSuit = !!eqState.wearSuit;
    const baseChest = chestP2 || neckP1 || [0, 0.14 * s, 0];
    const baseGroin = chestP1 || [0, -0.10 * s, 0];

    let tUpX = baseChest[0] - baseGroin[0];
    let tUpY = baseChest[1] - baseGroin[1];
    let tUpZ = baseChest[2] - baseGroin[2];
    const tUpL = Math.hypot(tUpX, tUpY, tUpZ) || 1.0;
    const tUp = [tUpX / tUpL, tUpY / tUpL, tUpZ / tUpL];

    const headCenter = headP1 || [baseChest[0], baseChest[1] + 0.08 * s, baseChest[2]];
    let fwdX = 0.0, fwdY = 0.0, fwdZ = 1.0;
    const fDot = fwdX * tUp[0] + fwdY * tUp[1] + fwdZ * tUp[2];
    fwdX -= tUp[0] * fDot; fwdY -= tUp[1] * fDot; fwdZ -= tUp[2] * fDot;
    const fLen = Math.hypot(fwdX, fwdY, fwdZ) || 1.0;
    const tFwd = [fwdX / fLen, fwdY / fLen, fwdZ / fLen];
    const tRight = [
      tUp[1] * tFwd[2] - tUp[2] * tFwd[1],
      tUp[2] * tFwd[0] - tUp[0] * tFwd[2],
      tUp[0] * tFwd[1] - tUp[1] * tFwd[0]
    ];

    const neckRef = neckP1 || [baseChest[0] + tUp[0] * 0.015 * s, baseChest[1] + tUp[1] * 0.015 * s, baseChest[2] + tUp[2] * 0.015 * s];
    const pt = (dx, dy, dz) => [
      neckRef[0] + tRight[0] * dx + tUp[0] * dy + tFwd[0] * dz,
      neckRef[1] + tRight[1] * dx + tUp[1] * dy + tFwd[1] * dz,
      neckRef[2] + tRight[2] * dx + tUp[2] * dy + tFwd[2] * dz
    ];

    const bodyColliderData = { headP1: headCenter, chestP1: baseGroin, chestP2: baseChest, scale: s };
    const outV = [], outC = [], outT = [], outI = [];

    const addV = (p, col, clampClr = 0.004) => {
      let vx = p[0], vy = p[1], vz = p[2];
      if (clampClr > 0.0) {
        const clamped = clampPointOutsideChibiBodyForCloth(vx, vy, vz, bodyColliderData, clampClr, false);
        vx = clamped[0]; vy = clamped[1]; vz = clamped[2];
      }
      const idx = (outV.length / 3) | 0;
      outV.push(vx, vy, vz);
      outC.push(col[0], col[1], col[2]);
      outT.push(-9.0, -9.0);
      return idx;
    };
    const addQuad = (a, b, c, d) => {
      outI.push(a, b, c);
      outI.push(a, c, d);
    };

    const colWhite = [0.985, 0.988, 0.996];
    const colShade = [0.895, 0.905, 0.935];
    const colFold = [0.840, 0.855, 0.895];

    // Inner stand wrapping snugly around back & sides of neck (leaves open V at front)
    // Angles go from front-left (+0.36 rad) around back (PI) to front-right (2*PI - 0.36 rad)
    const segs = 12;
    const startA = 0.36;
    const endA = Math.PI * 2.0 - 0.36;
    const standBot = [];
    const standTop = [];
    const lapelMid = [];
    const lapelTip = [];
    // When worn under DOUBLE_BREASTED_SUIT, tuck the shirt collar wings inside the suit collar & peak lapels so they never poke through
    const wingScale = underSuit ? 0.72 : 1.0;
    const standScale = underSuit ? 0.88 : 1.0;
    const yTuck = underSuit ? (-0.004 * s) : 0.0;
    const clrScale = underSuit ? 0.25 : 1.0;

    for (let i = 0; i <= segs; i++) {
      const frac = i / segs;
      const ang = startA + frac * (endA - startA);
      const sinA = Math.sin(ang);
      const cosA = Math.cos(ang);
      const isFrontTip = (i === 0 || i === segs);
      const isNearFront = (i <= 2 || i >= segs - 2);

      // Stand base hugging neck base
      const sb = pt(sinA * 0.056 * standScale * s, (cosA > 0 ? -0.022 : -0.006) * s + yTuck, cosA * 0.052 * standScale * s);
      const st = pt(sinA * 0.050 * standScale * s, (cosA > 0 ? 0.006 : 0.024) * s + yTuck, cosA * 0.048 * standScale * s);

      // Folded spread collar wing extending outward & slightly down onto collarbone
      const spreadR = (isFrontTip ? 0.068 : (isNearFront ? 0.082 : 0.076)) * wingScale;
      const tipR = (isFrontTip ? 0.066 : (isNearFront ? 0.088 : 0.082)) * wingScale;
      const foldDrop = isFrontTip ? -0.046 : (isNearFront ? -0.038 : -0.018);

      const lm = pt(sinA * spreadR * s, (foldDrop * 0.45 + 0.004) * s + yTuck, cosA * spreadR * s);
      const lt = pt(sinA * tipR * s, foldDrop * s + yTuck, cosA * tipR * s + (isFrontTip ? (underSuit ? 0.006 : 0.018) * s : 0.0));

      standBot.push(addV(sb, colShade, 0.003 * clrScale));
      standTop.push(addV(st, colWhite, 0.003 * clrScale));
      lapelMid.push(addV(lm, colWhite, 0.005 * clrScale));
      lapelTip.push(addV(lt, isNearFront ? colWhite : colShade, 0.006 * clrScale));
    }

    for (let i = 0; i < segs; i++) {
      addQuad(standBot[i], standTop[i], standTop[i + 1], standBot[i + 1]);
      addQuad(standTop[i], lapelMid[i], lapelMid[i + 1], standTop[i + 1]);
      addQuad(lapelMid[i], lapelTip[i], lapelTip[i + 1], lapelMid[i + 1]);
    }

    const frontTriCount = outI.length;
    const normals = new Float32Array(outV.length);
    for (let k = 0; k < frontTriCount; k += 3) {
      const i0 = outI[k], i1 = outI[k + 1], i2 = outI[k + 2];
      const ux = outV[i1 * 3] - outV[i0 * 3], uy = outV[i1 * 3 + 1] - outV[i0 * 3 + 1], uz = outV[i1 * 3 + 2] - outV[i0 * 3 + 2];
      const vx = outV[i2 * 3] - outV[i0 * 3], vy = outV[i2 * 3 + 1] - outV[i0 * 3 + 1], vz = outV[i2 * 3 + 2] - outV[i0 * 3 + 2];
      const nX = uy * vz - uz * vy, nY = uz * vx - ux * vz, nZ = ux * vy - uy * vx;
      normals[i0 * 3] += nX; normals[i0 * 3 + 1] += nY; normals[i0 * 3 + 2] += nZ;
      normals[i1 * 3] += nX; normals[i1 * 3 + 1] += nY; normals[i1 * 3 + 2] += nZ;
      normals[i2 * 3] += nX; normals[i2 * 3 + 1] += nY; normals[i2 * 3 + 2] += nZ;
    }
    for (let k = 0; k < normals.length; k += 3) {
      const l = Math.hypot(normals[k], normals[k + 1], normals[k + 2]);
      if (l > 0.0001) { normals[k] /= l; normals[k + 1] /= l; normals[k + 2] /= l; }
      else normals[k + 1] = 1.0;
    }
    for (let k = 0; k < frontTriCount; k += 3) {
      outI.push(outI[k], outI[k + 2], outI[k + 1]);
    }
    // Darken inner stand subtle fold if needed (handled via vertex shade), avoid unused var lint:
    void colFold;

    return {
      vertices: outV,
      normals: normals,
      colors: outC,
      texcoords: outT,
      indices: outI
    };
  }

  // =========================================================================
  // --- 11A-3. High-Waisted Black A-Line Knife-Pleated Skirt (BLACK_PLEATED_SKIRT) ---
  // Reference: image_d6cef329.png (smooth fitted waistband/yoke + 18 crisp A-line pleats)
  // =========================================================================
  function buildBlackPleatedSkirtMesh(
    headP1,
    chestP1, chestP2,
    scale = 1.0,
    phase = 0.0,
    clothContext = null
  ) {
    const s = scale || 1.0;
    const baseGroin = chestP1 || [0, -0.105 * s, 0];
    const baseChest = chestP2 || [0, 0.165 * s, 0];

    let tUpX = baseChest[0] - baseGroin[0];
    let tUpY = baseChest[1] - baseGroin[1];
    let tUpZ = baseChest[2] - baseGroin[2];
    const torsoLen = Math.hypot(tUpX, tUpY, tUpZ) || (0.27 * s);
    const torsoUp = [tUpX / torsoLen, tUpY / torsoLen, tUpZ / torsoLen];
    const torsoRatio = Math.max(0.75, Math.min(1.15, torsoLen / (0.27 * s)));

    let fwdX = 0.0, fwdY = 0.0, fwdZ = 1.0;
    const fDot = fwdX * torsoUp[0] + fwdY * torsoUp[1] + fwdZ * torsoUp[2];
    fwdX -= torsoUp[0] * fDot; fwdY -= torsoUp[1] * fDot; fwdZ -= torsoUp[2] * fDot;
    const fLen = Math.hypot(fwdX, fwdY, fwdZ) || 1.0;
    const torsoFwd = [fwdX / fLen, fwdY / fLen, fwdZ / fLen];
    const torsoRight = [
      torsoUp[1] * torsoFwd[2] - torsoUp[2] * torsoFwd[1],
      torsoUp[2] * torsoFwd[0] - torsoUp[0] * torsoFwd[2],
      torsoUp[0] * torsoFwd[1] - torsoUp[1] * torsoFwd[0]
    ];

    // Anchor at natural slim high waist (h ~ 0.43 -> 0.41 * torsoLen above groin)
    const waistOrigin = [
      baseGroin[0] + torsoUp[0] * (torsoLen * 0.41),
      baseGroin[1] + torsoUp[1] * (torsoLen * 0.41),
      baseGroin[2] + torsoUp[2] * (torsoLen * 0.41)
    ];

    const waistPt = (dx, dy, dz) => [
      waistOrigin[0] + torsoRight[0] * dx + torsoUp[0] * dy + torsoFwd[0] * dz,
      waistOrigin[1] + torsoRight[1] * dx + torsoUp[1] * dy + torsoFwd[1] * dz,
      waistOrigin[2] + torsoRight[2] * dx + torsoUp[2] * dy + torsoFwd[2] * dz
    ];

    const useClonePhys = !!(clothContext && clothContext.isClone);
    const eqClothingSkirt = (!useClonePhys && typeof getCharacterEquippedClothingState === "function")
      ? getCharacterEquippedClothingState(false)
      : null;
    const wearHoodieOverSkirt = !!(
      (clothContext && clothContext.wearHoodie !== undefined)
        ? clothContext.wearHoodie
        : (eqClothingSkirt && eqClothingSkirt.wearHoodie)
    );
    const hPhys = useClonePhys
      ? chibiCloneHoodiePhysics
      : ((typeof chibiHoodiePhysics !== "undefined") ? chibiHoodiePhysics : _createDefaultHoodiePhysState());
    const pAngle = hPhys.pitch || 0.0;
    const yAngle = hPhys.yaw || 0.0;
    const rAngle = hPhys.roll || 0.0;
    const yawLagTerm = (hPhys.yawLag || 0.0) * (wearHoodieOverSkirt ? 0.06 : 0.10);
    const airFlare = hPhys.airFlare || 0.0;
    const windTurb = hPhys.windTurb || 0.0;
    const nowPerfSec = (typeof performance !== "undefined" ? performance.now() : Date.now()) * 0.001;
    const flutterT = nowPerfSec * (11.0 + windTurb * 12.0);
    const turbMul = wearHoodieOverSkirt ? 0.55 : 1.0;
    const turbX = windTurb > 0 ? Math.sin(flutterT) * (windTurb * 0.010 * turbMul) : 0.0;
    const turbY = windTurb > 0 ? Math.sin(flutterT * 0.85) * (windTurb * 0.007 * turbMul) : 0.0;
    const turbZ = windTurb > 0 ? Math.cos(flutterT * 1.1) * (windTurb * 0.010 * turbMul) : 0.0;
    const breezeT = nowPerfSec * 1.5;
    const breezeX = Math.sin(breezeT * 1.5) * 0.0018 * turbMul;
    const breezeZ = Math.cos(breezeT * 1.2) * 0.0018 * turbMul;

    const computeSkirtDisp = (w) => {
      const wPrimary = w * (0.48 + 0.52 * w);
      const wWhip = w * w * (0.40 + 0.60 * w);
      const bounceY = Math.sin(phase * 2.0) * (wearHoodieOverSkirt ? 0.0055 : 0.007) * w * s;
      const gMul = wearHoodieOverSkirt ? 0.24 : 0.28;
      const tMul = wearHoodieOverSkirt ? 0.28 : 0.34;
      const aMul = wearHoodieOverSkirt ? 0.45 : 0.55;
      const yMul = wearHoodieOverSkirt ? 0.024 : 0.032;
      const rMul = wearHoodieOverSkirt ? 0.016 : 0.020;
      const pMul = wearHoodieOverSkirt ? 0.028 : 0.036;
      const dx = (hPhys.gx * gMul * wPrimary + hPhys.tx * tMul * wWhip + hPhys.airX * aMul * w + (yAngle * yMul + rAngle * rMul + yawLagTerm) * w + breezeX * w + turbX * w) * s;
      const dy = (hPhys.gy * gMul * wPrimary + hPhys.ty * tMul * wWhip + hPhys.airY * aMul * w + turbY * w) * s + bounceY;
      const dz = (hPhys.gz * gMul * wPrimary + hPhys.tz * tMul * wWhip + hPhys.airZ * aMul * w - pAngle * pMul * w + breezeZ * w + turbZ * w) * s;
      return [dx, dy, dz];
    };

    const skirtStride = _computeGarmentLegStride(clothContext, torsoRight, torsoFwd, 0.68, true);

    const bodyColliderData = {
      headP1: headP1 || [baseChest[0], baseChest[1] + 0.08 * s, baseChest[2]],
      chestP1: baseGroin,
      chestP2: baseChest,
      leftLegPivot: clothContext ? clothContext.leftLegPivot : null,
      leftKneeRot: clothContext ? clothContext.leftKneeRot : null,
      leftFootRot: clothContext ? clothContext.leftFootRot : null,
      rightLegPivot: clothContext ? clothContext.rightLegPivot : null,
      rightKneeRot: clothContext ? clothContext.rightKneeRot : null,
      rightFootRot: clothContext ? clothContext.rightFootRot : null,
      scale: s
    };

    const outV = [], outC = [], outT = [], outI = [];
    const addV = (px, py, pz, col, clampClr = 0.0, pushHint = null) => {
      let vx = px, vy = py, vz = pz;
      if (clampClr > 0.0) {
        const clamped = clampPointOutsideChibiBodyForCloth(vx, vy, vz, bodyColliderData, clampClr, false, pushHint);
        vx = clamped[0]; vy = clamped[1]; vz = clamped[2];
      }
      const idx = (outV.length / 3) | 0;
      outV.push(vx, vy, vz);
      outC.push(col[0], col[1], col[2]);
      outT.push(-9.0, -9.0);
      return idx;
    };
    const addQuad = (a, b, c, d) => {
      outI.push(a, b, c);
      outI.push(a, c, d);
    };

    const colRidge = [0.165, 0.170, 0.195];
    const colBlade = [0.112, 0.115, 0.135];
    const colFoldShadow = [0.042, 0.044, 0.056];
    const colYoke = [0.125, 0.128, 0.150];
    const colInner = [0.036, 0.038, 0.048];

    // 18 radial knife pleats * 3 sub-vertices per pleat = 54 vertices around circumference
    const NUM_PLEATS = 18;
    const SUB_PER_PLEAT = 3; // 0: crisp outer edge, 1: mid sloped pleat blade, 2: tucked under-fold shadow
    const N_VERTS = NUM_PLEATS * SUB_PER_PLEAT;

    // Fitted exactly to Capsule/GLB waist -> hip yoke -> crisp A-line flare (tucked smoothly when worn under hoodie coat)
    const skirtRingsDef = _getBlackPleatedSkirtRingsDef(s, torsoRatio, wearHoodieOverSkirt);

    const ringVerts = [];
    const waistInnerRing = [];
    const hemInnerRing = [];
    const envWorldRings = (wearHoodieOverSkirt && clothContext) ? [] : null;

    for (let rIdx = 0; rIdx < skirtRingsDef.length; rIdx++) {
      const lvl = skirtRingsDef[rIdx];
      const bDisp = computeSkirtDisp(lvl.t);
      const flare = (airFlare * (wearHoodieOverSkirt ? 0.24 : 0.36) + Math.abs(yAngle) * (wearHoodieOverSkirt ? 0.012 : 0.016)) * lvl.t * s;
      const row = [];
      const envCrestsRow = envWorldRings ? [] : null;

      for (let p = 0; p < NUM_PLEATS; p++) {
        for (let sub = 0; sub < SUB_PER_PLEAT; sub++) {
          // Knife-pleat sawtooth angle & radial offsets:
          // sub 0 -> outer knife crest; sub 1 -> wide diagonal face; sub 2 -> tucked shadow valley
          const fracAngle = (sub === 0) ? 0.02 : ((sub === 1) ? 0.58 : 0.88);
          const ang = ((p + fracAngle) / NUM_PLEATS) * Math.PI * 2.0;
          const sinA = Math.sin(ang);
          const cosA = Math.cos(ang);
          const rz = (cosA >= 0.0) ? lvl.rzF : lvl.rzB;

          const pMod = (sub === 0) ? 1.0 : ((sub === 1) ? 0.15 : -0.95);
          const rBoost = lvl.pleatDepth * pMod;

          const skD = _computeSkirtVertexDisplacement(
            sinA, cosA, lvl.t, 0.18, s, bDisp, skirtStride, 0.042,
            phase, wearHoodieOverSkirt ? 0.003 : 0.004,
            0.28, 0.30, 0.25, 0.20, 0.72
          );

          const lx = sinA * (lvl.rx + rBoost + flare) + bDisp[0] + skD.legSidePush;
          const ly = lvl.dy + bDisp[1] + skD.rippleY + (skD.legFrontTent * 0.14 + skD.legBackTent * 0.10);
          const lz = lvl.cy + cosA * (rz + rBoost + flare) + skD.effDispZ + (skD.legFrontTent * 0.80 - skD.legBackTent * 0.70);

          const pushHint = (rIdx >= 2)
            ? [
                torsoRight[0] * sinA + torsoFwd[0] * cosA,
                0.0,
                torsoRight[2] * sinA + torsoFwd[2] * cosA
              ]
            : null;

          const pos = waistPt(lx, ly, lz);
          const col = lvl.isYoke
            ? colYoke
            : (sub === 0 ? colRidge : (sub === 1 ? colBlade : colFoldShadow));
          const vIdx = addV(pos[0], pos[1], pos[2], col, lvl.clr, pushHint);
          row.push(vIdx);
          if (envCrestsRow && sub === 0) {
            envCrestsRow.push([outV[vIdx * 3], outV[vIdx * 3 + 1], outV[vIdx * 3 + 2]]);
          }

          if (rIdx === 0) {
            // Tuck top edge slightly inside waist so zero gap is ever visible from above
            const innerWaistPos = waistPt(
              sinA * (lvl.rx * 0.90) + bDisp[0],
              lvl.dy - 0.004 * s + bDisp[1],
              lvl.cy + cosA * (rz * 0.90) + bDisp[2]
            );
            waistInnerRing.push(addV(innerWaistPos[0], innerWaistPos[1], innerWaistPos[2], colInner, 0.0));
          }

          if (rIdx === skirtRingsDef.length - 1) {
            const innerPos = waistPt(
              sinA * ((lvl.rx - 0.011 * s) + rBoost * 0.55 + flare) + bDisp[0] + skD.legSidePush,
              lvl.dy + 0.014 * s + bDisp[1] + skD.rippleY + (skD.legFrontTent * 0.14 + skD.legBackTent * 0.10),
              lvl.cy + cosA * ((rz - 0.011 * s) + rBoost * 0.55 + flare) + skD.effDispZ + (skD.legFrontTent * 0.80 - skD.legBackTent * 0.70)
            );
            hemInnerRing.push(addV(innerPos[0], innerPos[1], innerPos[2], colInner, 0.011, pushHint));
          }
        }
      }
      ringVerts.push(row);
      if (envWorldRings) envWorldRings.push(envCrestsRow);
    }
    if (envWorldRings && clothContext) {
      clothContext._cachedSkirtEnvelope = envWorldRings;
    }

    // Close top waistband edge neatly against the torso
    const topOuter = ringVerts[0];
    for (let j = 0; j < N_VERTS; j++) {
      const nextJ = (j + 1) % N_VERTS;
      addQuad(waistInnerRing[j], topOuter[j], topOuter[nextJ], waistInnerRing[nextJ]);
    }

    for (let r = 0; r < ringVerts.length - 1; r++) {
      const r0 = ringVerts[r];
      const r1 = ringVerts[r + 1];
      for (let j = 0; j < N_VERTS; j++) {
        const nextJ = (j + 1) % N_VERTS;
        addQuad(r0[j], r1[j], r1[nextJ], r0[nextJ]);
      }
    }

    // Inner dark return hem thickness at bottom of skirt
    const botOuter = ringVerts[ringVerts.length - 1];
    for (let j = 0; j < N_VERTS; j++) {
      const nextJ = (j + 1) % N_VERTS;
      addQuad(botOuter[j], hemInnerRing[j], hemInnerRing[nextJ], botOuter[nextJ]);
    }

    const frontTriCount = outI.length;
    const normals = new Float32Array(outV.length);
    for (let k = 0; k < frontTriCount; k += 3) {
      const i0 = outI[k], i1 = outI[k + 1], i2 = outI[k + 2];
      const ux = outV[i1 * 3] - outV[i0 * 3], uy = outV[i1 * 3 + 1] - outV[i0 * 3 + 1], uz = outV[i1 * 3 + 2] - outV[i0 * 3 + 2];
      const vx = outV[i2 * 3] - outV[i0 * 3], vy = outV[i2 * 3 + 1] - outV[i0 * 3 + 1], vz = outV[i2 * 3 + 2] - outV[i0 * 3 + 2];
      const nX = uy * vz - uz * vy, nY = uz * vx - ux * vz, nZ = ux * vy - uy * vx;
      normals[i0 * 3] += nX; normals[i0 * 3 + 1] += nY; normals[i0 * 3 + 2] += nZ;
      normals[i1 * 3] += nX; normals[i1 * 3 + 1] += nY; normals[i1 * 3 + 2] += nZ;
      normals[i2 * 3] += nX; normals[i2 * 3 + 1] += nY; normals[i2 * 3 + 2] += nZ;
    }
    for (let k = 0; k < normals.length; k += 3) {
      const l = Math.hypot(normals[k], normals[k + 1], normals[k + 2]);
      if (l > 0.0001) { normals[k] /= l; normals[k + 1] /= l; normals[k + 2] /= l; }
      else normals[k + 1] = 1.0;
    }
    for (let k = 0; k < frontTriCount; k += 3) {
      outI.push(outI[k], outI[k + 2], outI[k + 1]);
    }

    return {
      vertices: outV,
      normals: normals,
      colors: outC,
      texcoords: outT,
      indices: outI
    };
  }

  // =========================================================================
  // --- 11A-4. Double-Breasted Pinstripe Suit Jacket (DOUBLE_BREASTED_SUIT) ---
  // Reference: image_6f55adb1.png & Screenshot_2026-11-17_04-32-21_cc436ed5.png
  // (Suit jacket ONLY — charcoal grey pinstripe wool, wide peak lapels,
  // open V neckline, 4 lower marbled amber buttons [top 2 buttons removed],
  // worn as an outer Accessory coat mutually exclusive with Traveler Hoodie)
  // =========================================================================
  function buildDoubleBreastedSuitMesh(
    headP1,
    chestP1, chestP2,
    neckP1, neckP2,
    leftArmPivot, leftElbowRot, leftHandRot,
    rightArmPivot, rightElbowRot, rightHandRot,
    scale = 1.0,
    phase = 0.0,
    isLocal = false,
    leftFootRot = null,
    rightFootRot = null,
    clothContext = null
  ) {
    const outV = [], outC = [], outT = [], outI = [];
    const s = scale || 1.0;

    const baseGroin = chestP1 || [0, -0.090 * s, 0];
    const baseChest = chestP2 || [0,  0.170 * s, 0];
    const ny = neckP1 ? neckP1[1] : baseChest[1];

    const tdx = baseChest[0] - baseGroin[0];
    const tdy = baseChest[1] - baseGroin[1];
    const tdz = baseChest[2] - baseGroin[2];
    const torsoLen = Math.hypot(tdx, tdy, tdz) || (0.26 * s);
    const torsoUp = [tdx / torsoLen, tdy / torsoLen, tdz / torsoLen];
    const torsoRatio = Math.max(0.75, Math.min(1.15, torsoLen / (0.26 * s)));

    const fDot = torsoUp[2];
    let torsoFwd = [-torsoUp[0] * fDot, -torsoUp[1] * fDot, 1.0 - torsoUp[2] * fDot];
    const tfLen = Math.hypot(torsoFwd[0], torsoFwd[1], torsoFwd[2]);
    torsoFwd = tfLen > 1e-4 ? [torsoFwd[0] / tfLen, torsoFwd[1] / tfLen, torsoFwd[2] / tfLen] : [0, 0, 1];
    const torsoRight = [
      torsoUp[1] * torsoFwd[2] - torsoUp[2] * torsoFwd[1],
      torsoUp[2] * torsoFwd[0] - torsoUp[0] * torsoFwd[2],
      torsoUp[0] * torsoFwd[1] - torsoUp[1] * torsoFwd[0]
    ];

    const collarBaseX = baseChest[0];
    const collarBaseY = Math.min(ny, baseChest[1] + 0.008 * s);
    const collarBaseZ = baseChest[2];
    const torsoPt = (dx, dy, dz) => [
      collarBaseX + torsoRight[0] * dx + torsoUp[0] * dy + torsoFwd[0] * dz,
      collarBaseY + torsoRight[1] * dx + torsoUp[1] * dy + torsoFwd[1] * dz,
      collarBaseZ + torsoRight[2] * dx + torsoUp[2] * dy + torsoFwd[2] * dz
    ];

    // Charcoal Pinstripe Suit Palette (matching image_6f55adb1.png)
    const colSuitBase  = [0.238, 0.246, 0.268];
    const colStripeHi  = [0.358, 0.368, 0.394];
    const colLapelHi   = [0.285, 0.294, 0.320];
    const colSeamAO    = [0.138, 0.144, 0.162];
    const colInner     = [0.095, 0.100, 0.115];
    const colBtnRim    = [0.640, 0.450, 0.250];
    const colBtnHi     = [0.870, 0.700, 0.460];
    const colBtnDark   = [0.360, 0.220, 0.110];

    const pinstripeColor = (ang, ao = 0.0, isLapel = false) => {
      const stripeWave = Math.pow(Math.max(0.0, Math.cos(ang * 26.0)), 10.0);
      const base = isLapel ? colLapelHi : colSuitBase;
      const mix = stripeWave * (isLapel ? 0.55 : 0.75);
      return [
        Math.max(0.07, (base[0] * (1.0 - mix) + colStripeHi[0] * mix) - ao),
        Math.max(0.07, (base[1] * (1.0 - mix) + colStripeHi[1] * mix) - ao),
        Math.max(0.08, (base[2] * (1.0 - mix) + colStripeHi[2] * mix) - ao)
      ];
    };

    const bodyColliderData = {
      headP1: headP1 || [baseChest[0], baseChest[1] + 0.08 * s, baseChest[2]],
      chestP1: baseGroin,
      chestP2: baseChest,
      leftArmPivot,
      leftElbowRot,
      leftHandRot,
      rightArmPivot,
      rightElbowRot,
      rightHandRot,
      leftLegPivot: clothContext ? clothContext.leftLegPivot : null,
      leftKneeRot: clothContext ? clothContext.leftKneeRot : null,
      leftFootRot: clothContext ? (clothContext.leftFootRot || leftFootRot) : leftFootRot,
      rightLegPivot: clothContext ? clothContext.rightLegPivot : null,
      rightKneeRot: clothContext ? clothContext.rightKneeRot : null,
      rightFootRot: clothContext ? (clothContext.rightFootRot || rightFootRot) : rightFootRot,
      legRadiusBoost: 0.002,
      scale: s
    };

    const addV = (px, py, pz, col, clampClr = 0.0, includeArms = false, pushHint = null) => {
      let vx = px, vy = py, vz = pz;
      if (clampClr > 0.0 && !isLocal) {
        const clamped = clampPointOutsideChibiBodyForCloth(vx, vy, vz, bodyColliderData, clampClr, includeArms, pushHint);
        vx = clamped[0]; vy = clamped[1]; vz = clamped[2];
      }
      const idx = (outV.length / 3) | 0;
      outV.push(vx, vy, vz);
      outC.push(col[0], col[1], col[2]);
      // Explicitly outside Traveler Hoodie diamond-pattern shader range
      outT.push(-9.0, -9.0);
      return idx;
    };
    const addTri = (a, b, c) => { outI.push(a, b, c); };
    const addQuad = (a, b, c, d) => { outI.push(a, b, c); outI.push(a, c, d); };

    const useClonePhys = !!(clothContext && clothContext.isClone);
    const hPhys = (clothContext && clothContext.hoodiePhysics)
      ? clothContext.hoodiePhysics
      : (useClonePhys
          ? chibiCloneHoodiePhysics
          : ((typeof chibiHoodiePhysics !== "undefined") ? chibiHoodiePhysics : _createDefaultHoodiePhysState()));
    const pAngle = isLocal ? 0.0 : (hPhys.pitch || 0.0);
    const yAngle = isLocal ? 0.0 : (hPhys.yaw || 0.0);
    const rAngle = isLocal ? 0.0 : (hPhys.roll || 0.0);
    const yawLagTerm = isLocal ? 0.0 : ((hPhys.yawLag || 0.0) * 0.05);
    const effPhase = isLocal ? 0.0 : phase;

    const computeSuitDisp = (w) => {
      if (isLocal || w <= 0.001) return [0.0, 0.0, 0.0];
      const wTail = Math.max(0.0, (w - 0.34) / 0.66);
      const wPrimary = wTail * (0.45 + 0.55 * wTail);
      const wWhip = wTail * wTail;
      const bounceY = Math.sin(effPhase * 2.0) * 0.0025 * wTail * s;
      // Structured wool jacket: subtle sway below the waist
      const dx = (hPhys.gx * 0.12 * wPrimary + hPhys.tx * 0.12 * wWhip + hPhys.airX * 0.20 * wTail + (yAngle * 0.012 + rAngle * 0.010 + yawLagTerm) * wTail) * s;
      const dy = (hPhys.gy * 0.12 * wPrimary + hPhys.ty * 0.12 * wWhip + hPhys.airY * 0.20 * wTail) * s + bounceY;
      const dz = (hPhys.gz * 0.12 * wPrimary + hPhys.tz * 0.12 * wWhip + hPhys.airZ * 0.20 * wTail - pAngle * 0.015 * wTail) * s;
      return [dx, dy, dz];
    };

    // Suit hem ends on the upper thigh (~3cm below hip pivot), so use low footWeight (0.18)
    // to measure upper-thigh swing rather than full ankle swing.
    const suitStride = _computeGarmentLegStride(bodyColliderData, torsoRight, torsoFwd, 0.18, !isLocal);
    const clampPointOutsideActiveSkirt = (!isLocal && clothContext && Array.isArray(clothContext._cachedSkirtEnvelope) && clothContext._cachedSkirtEnvelope.length >= 2)
      ? _buildSkirtEnvelopeClampFn(clothContext._cachedSkirtEnvelope, collarBaseX, collarBaseY, collarBaseZ, torsoRight, torsoUp, torsoFwd, s)
      : null;

    // -------------------------------------------------------------------------
    // 1. Tailored Double-Breasted Jacket Body (Open V Neckline at Top + Straight Tailored Hem)
    //    Trim, straight tailored hip silhouette (no A-line skirt flare) that still clears
    //    inner shirts and slacks while allowing subtle front/back thigh push when walking.
    // -------------------------------------------------------------------------
    const N_COLS = 36;
    const suitLevels = [
      { dy:  0.002 * s * torsoRatio, rx: 0.072 * s, rzF: 0.064 * s, rzB: 0.060 * s, t: 0.00, clr: 0.0065, gap: 0.42 }, // 0: Collarbone neckline
      { dy: -0.026 * s * torsoRatio, rx: 0.116 * s, rzF: 0.077 * s, rzB: 0.071 * s, t: 0.08, clr: 0.0085, gap: 0.24 }, // 1: Structured padded shoulders
      { dy: -0.064 * s * torsoRatio, rx: 0.108 * s, rzF: 0.086 * s, rzB: 0.073 * s, t: 0.20, clr: 0.0095, gap: 0.05 }, // 2: Upper chest (near V-apex)
      { dy: -0.104 * s * torsoRatio, rx: 0.098 * s, rzF: 0.082 * s, rzB: 0.070 * s, t: 0.34, clr: 0.0105, gap: 0.00 }, // 3: Closed below V-apex
      { dy: -0.146 * s * torsoRatio, rx: 0.096 * s, rzF: 0.082 * s, rzB: 0.076 * s, t: 0.50, clr: 0.0110, gap: 0.00 }, // 4: Tailored waist taper (mid button row)
      { dy: -0.192 * s * torsoRatio, rx: 0.112 * s, rzF: 0.090 * s, rzB: 0.091 * s, t: 0.68, clr: 0.0115, gap: 0.00 }, // 5: High hip
      { dy: -0.234 * s * torsoRatio, rx: 0.118 * s, rzF: 0.094 * s, rzB: 0.095 * s, t: 0.85, clr: 0.0120, gap: 0.00 }, // 6: Mid hip / pocket level
      { dy: -0.272 * s * torsoRatio, rx: 0.121 * s, rzF: 0.097 * s, rzB: 0.098 * s, t: 1.00, clr: 0.0125, gap: 0.00 }  // 7: Crisp tailored jacket hem
    ];

    const bodyRings = [];
    const innerHemRing = [];
    const neckInnerRing = [];

    const evalTorsoLevelPt = (lvl, ang) => {
      const sinA = Math.sin(ang);
      const cosA = Math.cos(ang);
      const rz = cosA >= 0.0 ? lvl.rzF : lvl.rzB;
      const bDisp = computeSuitDisp(lvl.t);
      // Zero sideFwdMul/sideBackMul (0.0, 0.0) so forward/back leg swings never push the sides outward like a skirt,
      // and tentFwdMul/tentBackMul = 0.0 so only the front over the stepping thigh pushes forward and only the back pushes backward.
      const skD = _computeSkirtVertexDisplacement(
        sinA, cosA, lvl.t, 0.50, s, bDisp, suitStride, 0.048,
        effPhase, 0.0, 0.0, 0.0, 0.0, 0.0, 0.25
      );
      const wFront = Math.max(0.0, cosA);
      const wBack = Math.max(0.0, -cosA);
      const frontLegPush = skD.legFrontTent * wFront * 0.48;
      const backLegPush  = skD.legBackTent  * wBack  * 0.42;

      const lx = sinA * lvl.rx + bDisp[0] + skD.legSidePush * 0.35;
      const ly = lvl.dy + bDisp[1] + (frontLegPush * 0.06 + backLegPush * 0.05);
      const lz = cosA * rz + skD.effDispZ + (frontLegPush - backLegPush);
      let pos = torsoPt(lx, ly, lz);
      // Direct capsule pushout primarily forward/backward (Z) so thigh capsules push the hem in Z rather than flaring X
      const pushHint = (lvl.t >= 0.50)
        ? [torsoRight[0] * sinA * 0.25 + torsoFwd[0] * (cosA >= 0.0 ? 1.0 : -1.0), 0.0, torsoRight[2] * sinA * 0.25 + torsoFwd[2] * (cosA >= 0.0 ? 1.0 : -1.0)]
        : null;
      if (clampPointOutsideActiveSkirt && lvl.t >= 0.45) {
        pos = clampPointOutsideActiveSkirt(pos, 0.0085 * s);
      }
      return { pos, sinA, cosA, pushHint };
    };

    // Helper to evaluate and clamp any point on the jacket torso at continuous row rFloat (0..7) and angle ang,
    // then push outward along the local radial normal by extraOut so layered 3D flaps/lapels/pockets/buttons
    // deform 1:1 with the torso and never clip when walking.
    const evalLayeredSuitPt = (rFloat, ang, extraOut = 0.0) => {
      const r0 = Math.max(0, Math.min(suitLevels.length - 2, Math.floor(rFloat)));
      const r1 = r0 + 1;
      const tR = Math.max(0.0, Math.min(1.0, rFloat - r0));
      const L0 = suitLevels[r0], L1 = suitLevels[r1];
      const interpLvl = {
        dy:  L0.dy  * (1.0 - tR) + L1.dy  * tR,
        rx:  L0.rx  * (1.0 - tR) + L1.rx  * tR,
        rzF: L0.rzF * (1.0 - tR) + L1.rzF * tR,
        rzB: L0.rzB * (1.0 - tR) + L1.rzB * tR,
        t:   L0.t   * (1.0 - tR) + L1.t   * tR,
        clr: L0.clr * (1.0 - tR) + L1.clr * tR
      };
      const ptData = evalTorsoLevelPt(interpLvl, ang);
      let vx = ptData.pos[0], vy = ptData.pos[1], vz = ptData.pos[2];
      if (!isLocal && interpLvl.clr > 0.0) {
        const clamped = clampPointOutsideChibiBodyForCloth(vx, vy, vz, bodyColliderData, interpLvl.clr, false, ptData.pushHint);
        vx = clamped[0]; vy = clamped[1]; vz = clamped[2];
      }
      if (Math.abs(extraOut) > 1e-6) {
        const rdx = torsoRight[0] * ptData.sinA + torsoFwd[0] * ptData.cosA;
        const rdy = torsoRight[1] * ptData.sinA + torsoFwd[1] * ptData.cosA;
        const rdz = torsoRight[2] * ptData.sinA + torsoFwd[2] * ptData.cosA;
        const rLen = Math.hypot(rdx, rdy, rdz) || 1.0;
        vx += (rdx / rLen) * extraOut;
        vy += (rdy / rLen) * extraOut;
        vz += (rdz / rLen) * extraOut;
      }
      return [vx, vy, vz];
    };

    for (let rIdx = 0; rIdx < suitLevels.length; rIdx++) {
      const lvl = suitLevels[rIdx];
      const row = [];
      const startAng = lvl.gap;
      const endAng = Math.PI * 2.0 - lvl.gap;

      for (let j = 0; j < N_COLS; j++) {
        const frac = j / (N_COLS - 1);
        const ang = startAng + frac * (endAng - startAng);
        const ptData = evalTorsoLevelPt(lvl, ang);

        // Subtle ambient occlusion under the overlapping front flap edge (on viewer's left, sinA ~ -0.46..-0.52)
        let ao = 0.0;
        if (lvl.t >= 0.30 && ptData.cosA > 0.55 && ptData.sinA < -0.42 && ptData.sinA > -0.58) {
          ao += (1.0 - Math.abs(ptData.sinA + 0.49) / 0.09) * 0.065;
        }
        // Back center vent slit AO
        if (lvl.t >= 0.72 && ptData.cosA < -0.92 && Math.abs(ptData.sinA) < 0.09) {
          ao += 0.065;
        }
        // Under-hem crisp shadow line
        if (rIdx === suitLevels.length - 1) ao += 0.025;

        const col = pinstripeColor(ang, ao, false);
        const outIdx = addV(ptData.pos[0], ptData.pos[1], ptData.pos[2], col, lvl.clr, false, ptData.pushHint);
        row.push(outIdx);

        if (rIdx === 0) {
          const inNeck = torsoPt(
            ptData.sinA * (lvl.rx * 0.84),
            lvl.dy - 0.012 * s,
            ptData.cosA * ((ptData.cosA >= 0 ? lvl.rzF : lvl.rzB) * 0.84)
          );
          neckInnerRing.push(addV(inNeck[0], inNeck[1], inNeck[2], colInner, 0.002));
        }

        if (rIdx === suitLevels.length - 1) {
          const ox = outV[outIdx * 3], oy = outV[outIdx * 3 + 1], oz = outV[outIdx * 3 + 2];
          const radX = torsoRight[0] * ptData.sinA + torsoFwd[0] * ptData.cosA;
          const radY = torsoRight[1] * ptData.sinA + torsoFwd[1] * ptData.cosA;
          const radZ = torsoRight[2] * ptData.sinA + torsoFwd[2] * ptData.cosA;
          const inX = ox - radX * (0.0045 * s) + torsoUp[0] * (0.0015 * s);
          const inY = oy - radY * (0.0045 * s) + torsoUp[1] * (0.0015 * s);
          const inZ = oz - radZ * (0.0045 * s) + torsoUp[2] * (0.0015 * s);
          innerHemRing.push(addV(inX, inY, inZ, colInner, 0.0));
        }
      }
      bodyRings.push(row);
    }

    // Stitch body rings
    for (let r = 0; r < bodyRings.length - 1; r++) {
      const r0 = bodyRings[r];
      const r1 = bodyRings[r + 1];
      for (let j = 0; j < N_COLS - 1; j++) {
        addQuad(r0[j], r1[j], r1[j + 1], r0[j + 1]);
      }
      // Seam front closure from V-apex downward
      if (suitLevels[r].gap <= 0.05 && suitLevels[r + 1].gap === 0.0) {
        addQuad(r0[N_COLS - 1], r1[N_COLS - 1], r1[0], r0[0]);
      }
    }
    // Inner neck & inner hem thickness
    for (let j = 0; j < N_COLS - 1; j++) {
      addQuad(neckInnerRing[j], bodyRings[0][j], bodyRings[0][j + 1], neckInnerRing[j + 1]);
      addQuad(bodyRings[bodyRings.length - 1][j], innerHemRing[j], innerHemRing[j + 1], bodyRings[bodyRings.length - 1][j + 1]);
    }
    addQuad(bodyRings[bodyRings.length - 1][N_COLS - 1], innerHemRing[N_COLS - 1], innerHemRing[0], bodyRings[bodyRings.length - 1][0]);

    // -------------------------------------------------------------------------
    // 2. Standing Back Collar + Symmetrical 3D Notched Lapels + Overlapping Front Flap
    //    (Matches Screenshot_2026-11-17_06-15-54_f927412f.png:
    //     - Left & Right collar and notched lapels are 100% symmetrical flanking the V-neck.
    //     - Viewer's Left lapel (ang < 0) tucks UNDER Viewer's Right lapel (ang > 0) at the center V-apex.
    //     - Viewer's Right lapel & front flap cross diagonally down-left (/) to ang = -0.46 above the
    //       top-left button and run down outside the left button column to the bottom hem.)
    // -------------------------------------------------------------------------
    const N_COLLAR_SEG = 14;
    const colTopRing = [], colBotRing = [], colInRing = [];
    for (let i = 0; i <= N_COLLAR_SEG; i++) {
      const frac = i / N_COLLAR_SEG;
      // Symmetrical standing collar from +0.42 (viewer's right) around back (PI) to 2*PI - 0.42 (viewer's left)
      const ang = 0.42 + frac * (Math.PI * 2.0 - 0.84);
      const sA = Math.sin(ang);
      const cA = Math.cos(ang);
      const edgeFade = Math.sin(frac * Math.PI);
      const liftH = (0.011 + 0.014 * edgeFade) * s;
      const radR = (0.072 + 0.008 * edgeFade) * s;
      const radZ = (cA >= 0 ? 0.064 : 0.065) * s + 0.007 * edgeFade * s;

      const pTop = torsoPt(sA * radR, liftH, cA * radZ);
      const pBot = torsoPt(sA * (radR + 0.008 * s), liftH - 0.022 * s, cA * (radZ + 0.007 * s));
      const pIn  = torsoPt(sA * (radR * 0.84), liftH - 0.006 * s, cA * (radZ * 0.84));
      colTopRing.push(addV(pTop[0], pTop[1], pTop[2], pinstripeColor(ang, 0.02, true), 0.006));
      colBotRing.push(addV(pBot[0], pBot[1], pBot[2], pinstripeColor(ang, 0.01, true), 0.007));
      colInRing.push(addV(pIn[0], pIn[1], pIn[2], colInner, 0.002));
    }
    for (let i = 0; i < N_COLLAR_SEG; i++) {
      addQuad(colTopRing[i], colBotRing[i], colBotRing[i + 1], colTopRing[i + 1]);
      addQuad(colInRing[i], colTopRing[i], colTopRing[i + 1], colInRing[i + 1]);
    }

    // 2A. Overlapping Double-Breasted Front Panel Mesh (rF = 2.15 .. 7.00)
    //     Starts at the centered V-apex (rF = 2.15, ang = 0.00), sweeps diagonally down-left (/)
    //     to the corner above the top-left button (rF = 3.25, ang = -0.45), and runs down outside
    //     the left button column (ang = -0.47 .. -0.50) to the bottom hem.
    const flapRowSpecs = [
      { rF: 2.15, angEdge:  0.00, angMerge: 0.52 }, // 0: Center V-apex crossing point
      { rF: 2.70, angEdge: -0.23, angMerge: 0.52 }, // 1: Diagonal crossover (/) toward viewer's left
      { rF: 3.25, angEdge: -0.45, angMerge: 0.52 }, // 2: Corner just above & left of top-left button
      { rF: 4.00, angEdge: -0.47, angMerge: 0.50 }, // 3: Top button row level (waist)
      { rF: 5.00, angEdge: -0.48, angMerge: 0.50 }, // 4: High hip level
      { rF: 6.00, angEdge: -0.49, angMerge: 0.50 }, // 5: Bottom button row / mid-hip level
      { rF: 7.00, angEdge: -0.50, angMerge: 0.50 }  // 6: Jacket bottom hem
    ];
    const N_FLAP_COLS = 10; // fc=0 is angEdge (viewer's left, -X), fc=N-1 is angMerge (viewer's right, +X)
    const flapStepBaseCol = [];
    const flapTopRows = [];
    const flapThickness = 0.0052 * s;

    for (let fr = 0; fr < flapRowSpecs.length; fr++) {
      const fSpec = flapRowSpecs[fr];
      // Underlying base point just outside angEdge (more negative ang) to form a crisp 3D step wall
      const pEdgeBase = evalLayeredSuitPt(fSpec.rF, fSpec.angEdge - 0.024, 0.0003 * s);
      flapStepBaseCol.push(addV(pEdgeBase[0], pEdgeBase[1], pEdgeBase[2], colSeamAO, 0.0));

      const fRow = [];
      for (let fc = 0; fc < N_FLAP_COLS; fc++) {
        const u = fc / (N_FLAP_COLS - 1); // 0 = angEdge (-X), 1 = angMerge (+X)
        const ang = fSpec.angEdge + u * (fSpec.angMerge - fSpec.angEdge);

        // Full 3D overlap thickness across the overlap edge and both button columns (u <= 0.74),
        // then smoothly blend into the right-screen chest body (u = 0.74 .. 1.0)
        const mergeFade = u <= 0.74 ? 1.0 : Math.max(0.0, 1.0 - (u - 0.74) / 0.26);
        const extraOut = flapThickness * (mergeFade * mergeFade * (3.0 - 2.0 * mergeFade));

        let colVert = pinstripeColor(ang, 0.0, false);
        if (fc === 0) {
          colVert = colLapelHi; // Crisp lit edge along the overlapping seam
        } else if (fr === flapRowSpecs.length - 1) {
          colVert = pinstripeColor(ang, 0.025, false);
        }

        const pSurf = evalLayeredSuitPt(fSpec.rF, ang, extraOut);
        fRow.push(addV(pSurf[0], pSurf[1], pSurf[2], colVert, 0.0));
      }
      flapTopRows.push(fRow);
    }

    // Stitch 3D step wall along the viewer-left overlap edge + front surface quads (fc increases toward +X -> outward +Z normal)
    for (let fr = 0; fr < flapRowSpecs.length - 1; fr++) {
      addQuad(flapStepBaseCol[fr], flapStepBaseCol[fr + 1], flapTopRows[fr + 1][0], flapTopRows[fr][0]);
      const r0 = flapTopRows[fr];
      const r1 = flapTopRows[fr + 1];
      for (let fc = 0; fc < N_FLAP_COLS - 1; fc++) {
        addQuad(r0[fc], r1[fc], r1[fc + 1], r0[fc + 1]);
      }
    }
    // Close bottom hem thickness of the overlapping flap at rF = 7.0
    {
      const lastR = flapRowSpecs.length - 1;
      const fSpec = flapRowSpecs[lastR];
      const botInRow = [];
      for (let fc = 0; fc < N_FLAP_COLS; fc++) {
        const u = fc / (N_FLAP_COLS - 1);
        const ang = fSpec.angEdge + u * (fSpec.angMerge - fSpec.angEdge);
        const pIn = evalLayeredSuitPt(fSpec.rF, ang, 0.0002 * s);
        botInRow.push(addV(pIn[0], pIn[1], pIn[2], colInner, 0.0));
      }
      for (let fc = 0; fc < N_FLAP_COLS - 1; fc++) {
        addQuad(flapTopRows[lastR][fc], botInRow[fc], botInRow[fc + 1], flapTopRows[lastR][fc + 1]);
      }
    }

    // 2B. Symmetrical Left & Right 3D Notched Suit Lapels (ปกสูทซ้าย-ขวาสมมาตรกัน)
    //     side = -1 (Viewer's Left, ang < 0): Under-lapel that tucks cleanly under the right lapel at the center V-apex (rF = 2.15).
    //     side = +1 (Viewer's Right, ang > 0): Over-lapel with identical upper notch/peak geometry that crosses over at rF = 2.15
    //     and tapers along the diagonal overlap edge down to rF = 3.25.
    const buildSymmetricalSuitLapel = (side) => {
      const isOver = side > 0;
      const lapelRows = isOver
        ? [
            { rF: 0.00, angIn:  0.42, angOut:  0.58 }, // 0: Collar root (symmetrical)
            { rF: 0.58, angIn:  0.31, angOut:  0.56 }, // 1: Upper collar step / gorge notch (symmetrical)
            { rF: 0.85, angIn:  0.26, angOut:  0.74 }, // 2: Wide outer lapel peak tip (symmetrical)
            { rF: 1.55, angIn:  0.12, angOut:  0.58 }, // 3: Mid lapel outer blade (symmetrical)
            { rF: 2.15, angIn:  0.00, angOut:  0.40 }, // 4: Center V-apex crossing point (symmetrical)
            { rF: 2.70, angIn: -0.23, angOut:  0.12 }, // 5: Diagonal crossover extension over under-lapel
            { rF: 3.25, angIn: -0.45, angOut: -0.22 }  // 6: Tapers into overlap corner above top-left button
          ]
        : [
            { rF: 0.00, angIn: -0.42, angOut: -0.58 }, // 0: Collar root (symmetrical)
            { rF: 0.58, angIn: -0.31, angOut: -0.56 }, // 1: Upper collar step / gorge notch (symmetrical)
            { rF: 0.85, angIn: -0.26, angOut: -0.74 }, // 2: Wide outer lapel peak tip (symmetrical)
            { rF: 1.55, angIn: -0.12, angOut: -0.58 }, // 3: Mid lapel outer blade (symmetrical)
            { rF: 2.15, angIn:  0.00, angOut: -0.40 }, // 4: Center V-apex crossing point (tucks under over-lapel)
            { rF: 2.65, angIn:  0.10, angOut: -0.26 }  // 5: Tucks cleanly underneath the overlapping front flap
          ];

      const lHeight = isOver ? (flapThickness + 0.0022 * s) : (0.0028 * s);
      const lGrid = [];
      for (let lr = 0; lr < lapelRows.length; lr++) {
        const lSpec = lapelRows[lr];
        // Taper height slightly at the very bottom tip of the over-lapel (lr === 6) so it merges seamlessly into flapTopRows
        const tipFade = (isOver && lr === lapelRows.length - 1) ? (flapThickness + 0.0006 * s) : lHeight;
        const pInBase  = evalLayeredSuitPt(lSpec.rF, lSpec.angIn, isOver && lr >= 4 ? flapThickness * 0.85 : 0.0004 * s);
        const pInTop   = evalLayeredSuitPt(lSpec.rF, lSpec.angIn, tipFade);
        const pMidTop  = evalLayeredSuitPt(lSpec.rF, (lSpec.angIn + lSpec.angOut) * 0.5, tipFade);
        const pOutTop  = evalLayeredSuitPt(lSpec.rF, lSpec.angOut, tipFade * 0.92);
        const pOutBase = evalLayeredSuitPt(lSpec.rF, lSpec.angOut + side * 0.022, isOver && lr >= 4 ? flapThickness * 0.85 : 0.0003 * s);
        const cFace = pinstripeColor(lSpec.angOut * 0.5, -0.005, true);
        lGrid.push([
          addV(pInBase[0],  pInBase[1],  pInBase[2],  colSeamAO, 0.0),
          addV(pInTop[0],   pInTop[1],   pInTop[2],   colLapelHi, 0.0),
          addV(pMidTop[0],  pMidTop[1],  pMidTop[2],  cFace, 0.0),
          addV(pOutTop[0],  pOutTop[1],  pOutTop[2],  colLapelHi, 0.0),
          addV(pOutBase[0], pOutBase[1], pOutBase[2], colSeamAO, 0.0)
        ]);
      }
      for (let lr = 0; lr < lGrid.length - 1; lr++) {
        const g0 = lGrid[lr], g1 = lGrid[lr + 1];
        for (let c = 0; c < 4; c++) {
          if (side > 0) {
            // c increases from angIn to angOut (+ang / +X), so g0[c]->g1[c]->g1[c+1]->g0[c+1] faces +Z
            addQuad(g0[c], g1[c], g1[c + 1], g0[c + 1]);
          } else {
            // c increases from angIn to angOut (-ang / -X), so g0[c+1]->g1[c+1]->g1[c]->g0[c] faces +Z
            addQuad(g0[c + 1], g1[c + 1], g1[c], g0[c]);
          }
        }
      }
    };
    buildSymmetricalSuitLapel(-1.0); // Viewer's Left (under-lapel)
    buildSymmetricalSuitLapel(1.0);  // Viewer's Right (over-lapel)

    // -------------------------------------------------------------------------
    // 2C. Two 3D Raised Hip Pocket Flaps (Left & Right Hips, matching image_45db25ee.png)
    // -------------------------------------------------------------------------
    for (const pSide of [1.0, -1.0]) {
      const angStart = pSide * 0.53;
      const angEnd   = pSide * 0.84;
      const rTop = 4.62;
      const rBot = 5.26;
      const N_PK = 5;
      const pkOut = 0.0042 * s;
      const topBase = [], topFace = [], botFace = [], botBase = [];
      for (let k = 0; k < N_PK; k++) {
        const u = k / (N_PK - 1);
        const ang = angStart + u * (angEnd - angStart);
        const pTB = evalLayeredSuitPt(rTop, ang, 0.0004 * s);
        const pTF = evalLayeredSuitPt(rTop, ang, pkOut);
        const pBF = evalLayeredSuitPt(rBot, ang, pkOut * 1.05);
        const pBB = evalLayeredSuitPt(rBot, ang, 0.0004 * s);
        const cPk = pinstripeColor(ang, -0.008, true);
        topBase.push(addV(pTB[0], pTB[1], pTB[2], colSeamAO, 0.0));
        topFace.push(addV(pTF[0], pTF[1], pTF[2], colLapelHi, 0.0));
        botFace.push(addV(pBF[0], pBF[1], pBF[2], cPk, 0.0));
        botBase.push(addV(pBB[0], pBB[1], pBB[2], colSeamAO, 0.0));
      }
      for (let k = 0; k < N_PK - 1; k++) {
        if (pSide > 0) {
          addQuad(topBase[k], topFace[k], topFace[k + 1], topBase[k + 1]);
          addQuad(topFace[k], botFace[k], botFace[k + 1], topFace[k + 1]);
          addQuad(botFace[k], botBase[k], botBase[k + 1], botFace[k + 1]);
        } else {
          addQuad(topBase[k + 1], topFace[k + 1], topFace[k], topBase[k]);
          addQuad(topFace[k + 1], botFace[k + 1], botFace[k], topFace[k]);
          addQuad(botFace[k + 1], botBase[k + 1], botBase[k], botFace[k]);
        }
      }
      // Side end-caps of the pocket flap
      if (pSide > 0) {
        addQuad(topBase[0], botBase[0], botFace[0], topFace[0]);
        addQuad(topFace[N_PK - 1], botFace[N_PK - 1], botBase[N_PK - 1], topBase[N_PK - 1]);
      } else {
        addQuad(topFace[0], botFace[0], botBase[0], topBase[0]);
        addQuad(topBase[N_PK - 1], botBase[N_PK - 1], botFace[N_PK - 1], topFace[N_PK - 1]);
      }
    }

    // -------------------------------------------------------------------------
    // 3. Four 3D Tortoiseshell Amber-Brown Buttons (2 Columns x 2 Lower Rows)
    //    Anchored directly to the raised 3D overlapping front panel quads (flapTopRows)
    //    so buttons stay locked to the overlapping suit flap in every walking pose.
    // -------------------------------------------------------------------------
    const getVert3 = (vIdx) => [outV[vIdx * 3], outV[vIdx * 3 + 1], outV[vIdx * 3 + 2]];
    const sampleFlapButtonPos = (frFloat, fcFloat) => {
      const r0 = Math.max(0, Math.min(flapTopRows.length - 2, Math.floor(frFloat)));
      const r1 = r0 + 1;
      const tR = frFloat - r0;
      const c0 = Math.max(0, Math.min(N_FLAP_COLS - 2, Math.floor(fcFloat)));
      const c1 = c0 + 1;
      const tC = fcFloat - c0;

      const p00 = getVert3(flapTopRows[r0][c0]);
      const p10 = getVert3(flapTopRows[r0][c1]);
      const p01 = getVert3(flapTopRows[r1][c0]);
      const p11 = getVert3(flapTopRows[r1][c1]);

      const bx = (p00[0] * (1.0 - tC) + p10[0] * tC) * (1.0 - tR) + (p01[0] * (1.0 - tC) + p11[0] * tC) * tR;
      const by = (p00[1] * (1.0 - tC) + p10[1] * tC) * (1.0 - tR) + (p01[1] * (1.0 - tC) + p11[1] * tC) * tR;
      const bz = (p00[2] * (1.0 - tC) + p10[2] * tC) * (1.0 - tR) + (p01[2] * (1.0 - tC) + p11[2] * tC) * tR;

      let maxFwdDelta = 0.0;
      const corners = [p00, p10, p01, p11];
      for (let k = 0; k < 4; k++) {
        const c = corners[k];
        const dFwd = (c[0] - bx) * torsoFwd[0] + (c[1] - by) * torsoFwd[1] + (c[2] - bz) * torsoFwd[2];
        if (dFwd > maxFwdDelta) maxFwdDelta = dFwd;
      }
      const lift = maxFwdDelta * 0.45 + 0.0030 * s;
      return [
        bx + torsoFwd[0] * lift,
        by + torsoFwd[1] * lift,
        bz + torsoFwd[2] * lift
      ];
    };

    const buttonPlacements = [
      // Middle row (at waist level fr ≈ 3.02 in flapRowSpecs -> rF ≈ 4.02, symmetrical ±x button columns)
      { fr: 3.02, fc: 2.25 },
      { fr: 3.02, fc: 6.35 },
      // Bottom row (at lower hip level fr ≈ 4.42 in flapRowSpecs -> rF ≈ 5.42, symmetrical ±x button columns)
      { fr: 4.42, fc: 2.45 },
      { fr: 4.42, fc: 6.25 }
    ];
    for (let bi = 0; bi < buttonPlacements.length; bi++) {
      const bp = buttonPlacements[bi];
      const bPos = sampleFlapButtonPos(bp.fr, bp.fc);
      const bx = bPos[0];
      const by = bPos[1];
      const bz = bPos[2];
      const rBtn = 0.0076 * s;
      const bThick = 0.0038 * s;

      const vDome = addV(
        bx + torsoFwd[0] * bThick,
        by + torsoFwd[1] * bThick,
        bz + torsoFwd[2] * bThick,
        colBtnHi
      );
      const rimFront = [], rimBack = [];
      for (let j = 0; j < 8; j++) {
        const a = (j / 8) * Math.PI * 2.0;
        const cA = Math.cos(a), sA = Math.sin(a);
        const colB = (j % 2 === 0) ? colBtnRim : colBtnDark;
        rimFront.push(addV(
          bx + torsoRight[0] * (sA * rBtn) + torsoUp[0] * (cA * rBtn) + torsoFwd[0] * (bThick * 0.55),
          by + torsoRight[1] * (sA * rBtn) + torsoUp[1] * (cA * rBtn) + torsoFwd[1] * (bThick * 0.55),
          bz + torsoRight[2] * (sA * rBtn) + torsoUp[2] * (cA * rBtn) + torsoFwd[2] * (bThick * 0.55),
          colB
        ));
        rimBack.push(addV(
          bx + torsoRight[0] * (sA * rBtn * 1.08) + torsoUp[0] * (cA * rBtn * 1.08) - torsoFwd[0] * 0.0012 * s,
          by + torsoRight[1] * (sA * rBtn * 1.08) + torsoUp[1] * (cA * rBtn * 1.08) - torsoFwd[1] * 0.0012 * s,
          bz + torsoRight[2] * (sA * rBtn * 1.08) + torsoUp[2] * (cA * rBtn * 1.08) - torsoFwd[2] * 0.0012 * s,
          colSeamAO
        ));
      }
      for (let j = 0; j < 8; j++) {
        const nextJ = (j + 1) % 8;
        addTri(rimFront[j], vDome, rimFront[nextJ]);
        addQuad(rimBack[j], rimFront[j], rimFront[nextJ], rimBack[nextJ]);
      }
    }

    // -------------------------------------------------------------------------
    // 4. Structured Long Suit Sleeves (Generous Upper-Arm Clearance, No Inner Cuff)
    // -------------------------------------------------------------------------
    const buildSuitSleeve = (pShoulder, pElbow, pHand, isLeft) => {
      if (!pShoulder || !pElbow || !pHand) return;
      const N_SLEEVE = 16;
      const side = isLeft ? -1.0 : 1.0;

      const norm3 = (v, fb = [0, -1, 0]) => {
        const l = Math.hypot(v[0], v[1], v[2]);
        return l > 1e-5 ? [v[0] / l, v[1] / l, v[2] / l] : fb;
      };
      const cross3 = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
      ];
      const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

      const dirUpper = norm3([pElbow[0] - pShoulder[0], pElbow[1] - pShoulder[1], pElbow[2] - pShoulder[2]], [side * 0.25, -0.96, 0]);
      const dirFore  = norm3([pHand[0] - pElbow[0], pHand[1] - pElbow[1], pHand[2] - pElbow[2]], dirUpper);
      const dirElbow = norm3([dirUpper[0] + dirFore[0], dirUpper[1] + dirFore[1], dirUpper[2] + dirFore[2]], dirUpper);

      const pArmhole = [
        pShoulder[0] - torsoRight[0] * (side * 0.015 * s) + torsoUp[0] * (0.005 * s),
        pShoulder[1] - torsoRight[1] * (side * 0.015 * s) + torsoUp[1] * (0.005 * s),
        pShoulder[2] - torsoRight[2] * (side * 0.015 * s) + torsoUp[2] * (0.005 * s)
      ];
      const dirArmhole = norm3([
        torsoRight[0] * side * 0.85 + dirUpper[0] * 0.35,
        torsoRight[1] * side * 0.85 + dirUpper[1] * 0.35 - 0.10,
        torsoRight[2] * side * 0.85 + dirUpper[2] * 0.35
      ], dirUpper);

      const slvDisp = computeSuitDisp(0.16);
      const stations = [
        { p: pArmhole,                       dir: dirArmhole,                                rx: 0.0515 * s, ry: 0.0550 * s, clamp: false, sag: 0.00, ao: 0.045, isIn: false },
        { p: pShoulder,                      dir: dirUpper,                                  rx: 0.0510 * s, ry: 0.0510 * s, clamp: false, sag: 0.05, ao: 0.000, isIn: false },
        { p: lerp3(pShoulder, pElbow, 0.34), dir: dirUpper,                                  rx: 0.0490 * s, ry: 0.0485 * s, clamp: true,  sag: 0.25, ao: 0.000, isIn: false },
        { p: lerp3(pShoulder, pElbow, 0.70), dir: dirUpper,                                  rx: 0.0460 * s, ry: 0.0455 * s, clamp: true,  sag: 0.45, ao: 0.000, isIn: false },
        { p: lerp3(pShoulder, pElbow, 0.88), dir: norm3(lerp3(dirUpper, dirElbow, 0.5)),     rx: 0.0445 * s, ry: 0.0440 * s, clamp: true,  sag: 0.55, ao: 0.005, isIn: false },
        { p: pElbow,                         dir: dirElbow,                                  rx: 0.0435 * s, ry: 0.0430 * s, clamp: true,  sag: 0.62, ao: 0.015, isIn: false },
        { p: lerp3(pElbow, pHand, 0.14),     dir: norm3(lerp3(dirElbow, dirFore, 0.5)),      rx: 0.0425 * s, ry: 0.0420 * s, clamp: true,  sag: 0.66, ao: 0.005, isIn: false },
        { p: lerp3(pElbow, pHand, 0.50),     dir: dirFore,                                   rx: 0.0405 * s, ry: 0.0400 * s, clamp: true,  sag: 0.80, ao: 0.000, isIn: false },
        { p: lerp3(pElbow, pHand, 0.85),     dir: dirFore,                                   rx: 0.0380 * s, ry: 0.0375 * s, clamp: true,  sag: 0.94, ao: 0.008, isIn: false },
        { p: lerp3(pElbow, pHand, 0.96),     dir: dirFore,                                   rx: 0.0370 * s, ry: 0.0365 * s, clamp: true,  sag: 1.00, ao: 0.025, isIn: false },
        { p: lerp3(pElbow, pHand, 0.86),     dir: dirFore,                                   rx: 0.0275 * s, ry: 0.0275 * s, clamp: false, sag: 0.94, ao: 0.000, isIn: true }
      ];

      let curU = cross3(torsoFwd, stations[0].dir);
      if (Math.hypot(curU[0], curU[1], curU[2]) < 1e-4) curU = cross3([0, 1, 0], stations[0].dir);
      curU = norm3(curU, [side, 0, 0]);
      let curV = norm3(cross3(stations[0].dir, curU), [0, 0, 1]);

      const rings = [];
      for (let k = 0; k < stations.length; k++) {
        const st = stations[k];
        if (k > 0) {
          const proj = dot3(curU, st.dir);
          const nextU = [curU[0] - st.dir[0] * proj, curU[1] - st.dir[1] * proj, curU[2] - st.dir[2] * proj];
          if (Math.hypot(nextU[0], nextU[1], nextU[2]) > 1e-4) {
            curU = norm3(nextU, curU);
            curV = norm3(cross3(st.dir, curU), curV);
          }
        }
        const ring = [];
        for (let j = 0; j < N_SLEEVE; j++) {
          const ang = (j / N_SLEEVE) * Math.PI * 2.0;
          const cosA = Math.cos(ang), sinA = Math.sin(ang);
          let vx = st.p[0] + (curU[0] * cosA * st.rx + curV[0] * sinA * st.ry) + slvDisp[0] * st.sag;
          let vy = st.p[1] + (curU[1] * cosA * st.rx + curV[1] * sinA * st.ry) + slvDisp[1] * st.sag;
          let vz = st.p[2] + (curU[2] * cosA * st.rx + curV[2] * sinA * st.ry) + slvDisp[2] * st.sag;
          if (st.clamp && !isLocal) {
            const c1 = clampPointOutsideSegmentCapsule(vx, vy, vz, pShoulder, pElbow, 0.046 * s, 0.039 * s, 0.0055 * s);
            const c2 = clampPointOutsideSegmentCapsule(c1[0], c1[1], c1[2], pElbow, pHand, 0.039 * s, 0.028 * s, 0.0050 * s);
            vx = c2[0]; vy = c2[1]; vz = c2[2];
          }
          const col = st.isIn ? colInner : pinstripeColor(ang * 0.5, st.ao, false);
          ring.push(addV(vx, vy, vz, col));
        }
        rings.push(ring);
      }

      for (let k = 0; k < rings.length - 1; k++) {
        const r0 = rings[k], r1 = rings[k + 1];
        for (let j = 0; j < N_SLEEVE; j++) {
          const nextJ = (j + 1) % N_SLEEVE;
          addQuad(r0[j], r0[nextJ], r1[nextJ], r1[j]);
        }
      }
    };

    buildSuitSleeve(leftArmPivot, leftElbowRot, leftHandRot, true);
    buildSuitSleeve(rightArmPivot, rightElbowRot, rightHandRot, false);

    // Smooth normals & double-sided inside faces
    const frontTriCount = outI.length;
    const normals = new Float32Array(outV.length);
    for (let k = 0; k < frontTriCount; k += 3) {
      const i0 = outI[k], i1 = outI[k + 1], i2 = outI[k + 2];
      const ux = outV[i1 * 3] - outV[i0 * 3], uy = outV[i1 * 3 + 1] - outV[i0 * 3 + 1], uz = outV[i1 * 3 + 2] - outV[i0 * 3 + 2];
      const vx = outV[i2 * 3] - outV[i0 * 3], vy = outV[i2 * 3 + 1] - outV[i0 * 3 + 1], vz = outV[i2 * 3 + 2] - outV[i0 * 3 + 2];
      const nX = uy * vz - uz * vy, nY = uz * vx - ux * vz, nZ = ux * vy - uy * vx;
      normals[i0 * 3] += nX; normals[i0 * 3 + 1] += nY; normals[i0 * 3 + 2] += nZ;
      normals[i1 * 3] += nX; normals[i1 * 3 + 1] += nY; normals[i1 * 3 + 2] += nZ;
      normals[i2 * 3] += nX; normals[i2 * 3 + 1] += nY; normals[i2 * 3 + 2] += nZ;
    }
    for (let k = 0; k < normals.length; k += 3) {
      const l = Math.hypot(normals[k], normals[k + 1], normals[k + 2]);
      if (l > 1e-12) { normals[k] /= l; normals[k + 1] /= l; normals[k + 2] /= l; }
      else { normals[k] = 0.0; normals[k + 1] = 1.0; normals[k + 2] = 0.0; }
    }
    for (let k = 0; k < frontTriCount; k += 3) {
      outI.push(outI[k], outI[k + 2], outI[k + 1]);
    }

    return {
      vertices: outV,
      normals: normals,
      colors: outC,
      texcoords: outT,
      indices: outI
    };
  }

  // =========================================================================
  // --- 11A-5. Tailored Pleated Straight-Leg Dark Slacks Mesh (BLACK_SLACKS) ---
  // Reference: Screenshot_2026-11-17_04-30-49_9938dd28.png & image_8ca5cef7.png
  //   - Exact warm dark plum-charcoal slate palette (R > G, B > R)
  //   - Sculpted 3D sawtooth front waist pleats descending into crisp center-leg
  //     press creases, secondary outer-front thigh pleat fold, diagonal fly/crotch
  //     tension folds, and knee drape creases
  //   - Full enclosed crotch saddle & wide outer-hip envelope (zero skin clipping)
  //   - Asymmetric inner/outer leg radii for a clean separation gap between legs
  // =========================================================================
  function buildBlackSlacksMesh(
    headP1,
    chestP1, chestP2,
    leftLegPivot, leftKneeRot, leftFootRot,
    rightLegPivot, rightKneeRot, rightFootRot,
    scale = 1.0,
    phase = 0.0,
    clothContext = null
  ) {
    const outV = [], outC = [], outT = [], outI = [];
    const s = scale || 1.0;

    const baseGroin = chestP1 || [0, -0.090 * s, 0];
    const baseChest = chestP2 || [0,  0.170 * s, 0];

    const tdx = baseChest[0] - baseGroin[0];
    const tdy = baseChest[1] - baseGroin[1];
    const tdz = baseChest[2] - baseGroin[2];
    const torsoLen = Math.hypot(tdx, tdy, tdz) || (0.26 * s);
    const torsoUp = [tdx / torsoLen, tdy / torsoLen, tdz / torsoLen];

    const fDot = torsoUp[2];
    let torsoFwd = [-torsoUp[0] * fDot, -torsoUp[1] * fDot, 1.0 - torsoUp[2] * fDot];
    const tfLen = Math.hypot(torsoFwd[0], torsoFwd[1], torsoFwd[2]);
    torsoFwd = tfLen > 1e-4 ? [torsoFwd[0] / tfLen, torsoFwd[1] / tfLen, torsoFwd[2] / tfLen] : [0, 0, 1];
    const torsoRight = [
      torsoUp[1] * torsoFwd[2] - torsoUp[2] * torsoFwd[1],
      torsoUp[2] * torsoFwd[0] - torsoUp[0] * torsoFwd[2],
      torsoUp[0] * torsoFwd[1] - torsoUp[1] * torsoFwd[0]
    ];

    const groinPt = (dx, dy, dz) => [
      baseGroin[0] + torsoRight[0] * dx + torsoUp[0] * dy + torsoFwd[0] * dz,
      baseGroin[1] + torsoRight[1] * dx + torsoUp[1] * dy + torsoFwd[1] * dz,
      baseGroin[2] + torsoRight[2] * dx + torsoUp[2] * dy + torsoFwd[2] * dz
    ];

    // Charcoal grey tailored wool palette matching DOUBLE_BREASTED_SUIT (colSuitBase = [0.238, 0.246, 0.268]).
    // No dark vertical stripes on the base cylinder; all pleats and creases are built as real 3D folded meshes!
    const colBase       = [0.238, 0.246, 0.268];
    const colLit        = [0.262, 0.270, 0.294];
    const colCreaseHi   = [0.284, 0.293, 0.318];
    const colTuckStep   = [0.182, 0.188, 0.208]; // Subtle inner fold-step shade (only on hidden 3D step wall)
    const colInner      = [0.095, 0.100, 0.115];
    const colTabWhite   = [0.865, 0.870, 0.900];

    const eqState = (clothContext !== null && typeof getCharacterEquippedClothingState === "function")
      ? getCharacterEquippedClothingState(false)
      : null;
    const underSuit = !!(eqState && eqState.wearSuit);
    const pScale = underSuit ? 0.88 : 1.0;

    const bodyColliderData = {
      headP1: headP1 || [baseChest[0], baseChest[1] + 0.08 * s, baseChest[2]],
      chestP1: baseGroin,
      chestP2: baseChest,
      leftLegPivot,
      leftKneeRot,
      leftFootRot,
      rightLegPivot,
      rightKneeRot,
      rightFootRot,
      scale: s
    };

    const addV = (px, py, pz, col, clampClr = 0.0, pushHint = null) => {
      let vx = px, vy = py, vz = pz;
      if (clampClr > 0.0) {
        const clamped = clampPointOutsideChibiBodyForCloth(vx, vy, vz, bodyColliderData, clampClr, false, pushHint);
        vx = clamped[0]; vy = clamped[1]; vz = clamped[2];
      }
      const idx = (outV.length / 3) | 0;
      outV.push(vx, vy, vz);
      outC.push(col[0], col[1], col[2]);
      outT.push(-9.0, -9.0);
      return idx;
    };
    const addQuad = (a, b, c, d) => { outI.push(a, b, c); outI.push(a, c, d); };

    // -------------------------------------------------------------------------
    // 1. Clean High-Waisted Slacks Pelvis, 3D Waistband, 3D Overlapping Fly Flap,
    //    3D Waist Pleat Folds & Full Crotch Saddle
    // -------------------------------------------------------------------------
    const N_WAIST = 32;
    const pelvisLevels = [
      { dy: torsoLen * 0.425, rx: 0.079 * s * pScale, rzF: 0.067 * s * pScale, rzB: 0.064 * s * pScale, cy: -0.001 * s, isBand: true,  clr: underSuit ? 0.0010 : 0.0025 }, // 0: Top waistband edge
      { dy: torsoLen * 0.360, rx: 0.083 * s * pScale, rzF: 0.070 * s * pScale, rzB: 0.068 * s * pScale, cy: -0.002 * s, isBand: true,  clr: underSuit ? 0.0015 : 0.0040 }, // 1: Waistband bottom edge
      { dy: torsoLen * 0.270, rx: 0.104 * s * pScale, rzF: 0.077 * s * pScale, rzB: 0.084 * s * pScale, cy: -0.002 * s, isBand: false, clr: underSuit ? 0.0020 : 0.0065 }, // 2: Upper hip
      { dy: torsoLen * 0.160, rx: 0.118 * s * pScale, rzF: 0.083 * s * pScale, rzB: 0.093 * s * pScale, cy: -0.003 * s, isBand: false, clr: underSuit ? 0.0025 : 0.0075 }, // 3: Full hip
      { dy: torsoLen * 0.050, rx: 0.114 * s * pScale, rzF: 0.078 * s * pScale, rzB: 0.086 * s * pScale, cy: -0.002 * s, isBand: false, clr: underSuit ? 0.0025 : 0.0065 }, // 4: Upper crotch
      { dy: -0.010 * s,       rx: 0.102 * s * pScale, rzF: 0.068 * s * pScale, rzB: 0.074 * s * pScale, cy: -0.001 * s, isBand: false, clr: underSuit ? 0.0020 : 0.0045 }, // 5: Lower groin wrap
      { dy: -0.022 * s,       rx: 0.088 * s * pScale, rzF: 0.056 * s * pScale, rzB: 0.060 * s * pScale, cy: -0.001 * s, isBand: false, clr: underSuit ? 0.0015 : 0.0030 }  // 6: Under-crotch saddle floor
    ];

    const evalPelvisSurfacePt = (rFloat, ang, extraOut = 0.0) => {
      const r0 = Math.max(0, Math.min(pelvisLevels.length - 2, Math.floor(rFloat)));
      const r1 = r0 + 1;
      const tR = Math.max(0.0, Math.min(1.0, rFloat - r0));
      const L0 = pelvisLevels[r0], L1 = pelvisLevels[r1];
      const rx  = L0.rx  * (1.0 - tR) + L1.rx  * tR;
      const rzF = L0.rzF * (1.0 - tR) + L1.rzF * tR;
      const rzB = L0.rzB * (1.0 - tR) + L1.rzB * tR;
      const dy  = L0.dy  * (1.0 - tR) + L1.dy  * tR;
      const cy  = L0.cy  * (1.0 - tR) + L1.cy  * tR;
      const clr = L0.clr * (1.0 - tR) + L1.clr * tR;

      const sinA = Math.sin(ang);
      const cosA = Math.cos(ang);
      const rz = cosA >= 0.0 ? rzF : rzB;
      const p = groinPt(sinA * (rx + extraOut), dy, cy + cosA * (rz + extraOut));
      if (clr > 0.0) {
        return clampPointOutsideChibiBodyForCloth(p[0], p[1], p[2], bodyColliderData, clr + extraOut * 0.5, false, null);
      }
      return p;
    };

    const pelvisRings = [];
    const waistInnerRing = [];
    for (let rIdx = 0; rIdx < pelvisLevels.length; rIdx++) {
      const lvl = pelvisLevels[rIdx];
      const row = [];
      for (let j = 0; j < N_WAIST; j++) {
        const ang = (j / N_WAIST) * Math.PI * 2.0;
        const sinA = Math.sin(ang);
        const cosA = Math.cos(ang);
        const rz = cosA >= 0.0 ? lvl.rzF : lvl.rzB;

        const bandBump = lvl.isBand ? (0.0014 * s) : 0.0;
        const col = (lvl.isBand && rIdx === 0) ? colLit : colBase;

        const p = groinPt(
          sinA * (lvl.rx + bandBump),
          lvl.dy,
          lvl.cy + cosA * (rz + bandBump)
        );

        row.push(addV(p[0], p[1], p[2], col, lvl.clr));
        if (rIdx === 0) {
          const pIn = groinPt(sinA * (lvl.rx * 0.88), lvl.dy - 0.008 * s, lvl.cy + cosA * (rz * 0.88));
          waistInnerRing.push(addV(pIn[0], pIn[1], pIn[2], colInner));
        }
      }
      pelvisRings.push(row);
    }

    for (let j = 0; j < N_WAIST; j++) {
      const nextJ = (j + 1) % N_WAIST;
      addQuad(waistInnerRing[j], pelvisRings[0][j], pelvisRings[0][nextJ], waistInnerRing[nextJ]);
    }
    for (let r = 0; r < pelvisRings.length - 1; r++) {
      const r0 = pelvisRings[r], r1 = pelvisRings[r + 1];
      for (let j = 0; j < N_WAIST; j++) {
        const nextJ = (j + 1) % N_WAIST;
        addQuad(r0[j], r1[j], r1[nextJ], r0[nextJ]);
      }
    }
    // Close the under-crotch saddle floor (pelvisRings[last]) from front to back across the groin
    const botPelvis = pelvisRings[pelvisRings.length - 1];
    for (let step = 1; step < (N_WAIST / 2) - 1; step++) {
      const a0 = step - 1, a1 = step;
      const b0 = N_WAIST - step + 1, b1 = N_WAIST - step;
      addQuad(botPelvis[b0 % N_WAIST], botPelvis[b1], botPelvis[a1], botPelvis[a0 === 0 ? 0 : a0]);
    }

    // 1B. 3D Overlapping Front Fly Placket & Upper-Hip 3D Pleat Origins on Pelvis
    //     (Visible when worn standalone or partially below suit hem)
    {
      // Center-front 3D overlapping fly flap (ang from -0.15 on viewer's left to +0.16 on viewer's right,
      // with a 3D step wall on the viewer's right / wearer's left J-seam at ang = +0.16)
      const flyRows = [1.0, 1.8, 2.7, 3.6];
      const flyThick = 0.0032 * s * pScale;
      const fGrid = [];
      for (let r = 0; r < flyRows.length; r++) {
        const rF = flyRows[r];
        const bottomCurve = (r === flyRows.length - 1) ? 0.06 : 0.16;
        const pLBase = evalPelvisSurfacePt(rF, -0.16, 0.0004 * s);
        const pLTop  = evalPelvisSurfacePt(rF, -0.14, flyThick * 0.75);
        const pMid   = evalPelvisSurfacePt(rF,  0.00, flyThick);
        const pRTop  = evalPelvisSurfacePt(rF,  bottomCurve, flyThick);
        const pRBase = evalPelvisSurfacePt(rF,  bottomCurve + 0.028, 0.0004 * s);
        fGrid.push([
          addV(pLBase[0], pLBase[1], pLBase[2], colBase),
          addV(pLTop[0],  pLTop[1],  pLTop[2],  colLit),
          addV(pMid[0],   pMid[1],   pMid[2],   colLit),
          addV(pRTop[0],  pRTop[1],  pRTop[2],  colCreaseHi),
          addV(pRBase[0], pRBase[1], pRBase[2], colTuckStep)
        ]);
      }
      for (let r = 0; r < fGrid.length - 1; r++) {
        const g0 = fGrid[r], g1 = fGrid[r + 1];
        for (let c = 0; c < 4; c++) {
          addQuad(g0[c], g1[c], g1[c + 1], g0[c + 1]);
        }
      }

      // Upper pelvis 3D front waist pleat folds (descending from waistband rF = 1.05 into the top of each leg)
      for (const side of [-1.0, 1.0]) {
        const pRows = [1.05, 1.85, 2.70, 3.45];
        const pThick = 0.0038 * s * pScale;
        const pGrid = [];
        for (let r = 0; r < pRows.length; r++) {
          const rF = pRows[r];
          // Main waist pleat fold centered around ang = side * 0.56, folding inward toward center-front
          const angTuck  = side * 0.49;
          const angEdge  = side * 0.52;
          const angBlade = side * 0.63;
          const angMerge = side * 0.76;
          const pTuck  = evalPelvisSurfacePt(rF, angTuck,  0.0004 * s);
          const pEdge  = evalPelvisSurfacePt(rF, angEdge,  pThick);
          const pBlade = evalPelvisSurfacePt(rF, angBlade, pThick * 0.72);
          const pMerge = evalPelvisSurfacePt(rF, angMerge, 0.0004 * s);
          pGrid.push([
            addV(pTuck[0],  pTuck[1],  pTuck[2],  colTuckStep),
            addV(pEdge[0],  pEdge[1],  pEdge[2],  colCreaseHi),
            addV(pBlade[0], pBlade[1], pBlade[2], colLit),
            addV(pMerge[0], pMerge[1], pMerge[2], colBase)
          ]);
        }
        for (let r = 0; r < pGrid.length - 1; r++) {
          const g0 = pGrid[r], g1 = pGrid[r + 1];
          for (let c = 0; c < 3; c++) {
            if (side > 0) {
              addQuad(g0[c], g1[c], g1[c + 1], g0[c + 1]);
            } else {
              addQuad(g0[c + 1], g1[c + 1], g1[c], g0[c]);
            }
          }
        }
      }
    }

    if (!underSuit) {
      // 6 Raised 3D Belt Loops around the waistband + small white/silver brand tab below right-front waistband
      const loopAngles = [-0.48, 0.48, -1.48, 1.48, Math.PI - 0.48, Math.PI + 0.48];
      for (let li = 0; li < loopAngles.length; li++) {
        const ang = loopAngles[li];
        const hw = 0.068;
        const aL = ang - hw, aR = ang + hw;
        const rB = 0.0865 * s;
        const rZF = 0.0745 * s;
        const rZB = 0.0715 * s;
        const ptLoop = (a, dy) => {
          const sA = Math.sin(a), cA = Math.cos(a);
          return groinPt(sA * rB, dy, -0.0015 * s + cA * (cA >= 0 ? rZF : rZB));
        };
        const vTL = addV(...ptLoop(aL, torsoLen * 0.430), colCreaseHi);
        const vTR = addV(...ptLoop(aR, torsoLen * 0.430), colCreaseHi);
        const vBL = addV(...ptLoop(aL, torsoLen * 0.355), colLit);
        const vBR = addV(...ptLoop(aR, torsoLen * 0.355), colLit);
        addQuad(vTL, vBL, vBR, vTR);
      }
      // Small crisp metallic/white brand tab at wearer's right upper hip
      {
        const aTabL = -0.82, aTabR = -0.71;
        const ptTab = (a, dy) => {
          const sA = Math.sin(a), cA = Math.cos(a);
          return groinPt(sA * 0.089 * s, dy, -0.0015 * s + cA * 0.075 * s);
        };
        const tTL = addV(...ptTab(aTabL, torsoLen * 0.358), colTabWhite);
        const tTR = addV(...ptTab(aTabR, torsoLen * 0.358), colTabWhite);
        const tBL = addV(...ptTab(aTabL, torsoLen * 0.332), colTabWhite);
        const tBR = addV(...ptTab(aTabR, torsoLen * 0.332), colTabWhite);
        addQuad(tTL, tBL, tBR, tTR);
      }
    }

    // -------------------------------------------------------------------------
    // 2. Articulated Straight-Leg Trouser Tubes + Real 3D Folded Pleat & Crease Meshes
    //    - Base leg tube is 100% smooth, uniform charcoal (colBase) around the back,
    //      sides, and front so there are NEVER any dark vertical stripes!
    //    - Front knife-pleats, full-length center press creases, secondary outer-thigh
    //      pleats, and groin drape folds are constructed as real 3D folded mesh layers
    //      with dedicated vertices and 3D step walls.
    // -------------------------------------------------------------------------
    const addSlacksLeg = (pHip, pKnee, pFoot, isLeft) => {
      if (!pHip || !pKnee || !pFoot) return;
      const N_LEG = 28;
      const outerSign = isLeft ? -1.0 : 1.0;

      const norm3 = (v, fb = [0, -1, 0]) => {
        const l = Math.hypot(v[0], v[1], v[2]);
        return l > 1e-5 ? [v[0] / l, v[1] / l, v[2] / l] : fb;
      };
      const cross3 = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
      ];
      const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

      const dirThigh = norm3([pKnee[0] - pHip[0], pKnee[1] - pHip[1], pKnee[2] - pHip[2]], [0, -1, 0]);
      const dirCalf  = norm3([pFoot[0] - pKnee[0], pFoot[1] - pKnee[1], pFoot[2] - pKnee[2]], dirThigh);
      const dirKnee  = norm3([dirThigh[0] + dirCalf[0], dirThigh[1] + dirCalf[1], dirThigh[2] + dirCalf[2]], dirThigh);

      const shiftHip = (pt, upAmt, outAmt) => [
        pt[0] + torsoUp[0] * upAmt + torsoRight[0] * (outerSign * outAmt),
        pt[1] + torsoUp[1] * upAmt + torsoRight[1] * (outerSign * outAmt),
        pt[2] + torsoUp[2] * upAmt + torsoRight[2] * (outerSign * outAmt)
      ];

      const uS0 = underSuit ? 0.88 : 1.0;
      const uS1 = underSuit ? 0.92 : 1.0;
      const stations = [
        { p: shiftHip(pHip, 0.024 * s, 0.0030 * s * uS0),                dir: dirThigh,                             rxOut: 0.0660 * s * uS0, rxIn: 0.0510 * s * uS0, rz: 0.0630 * s * uS0, t: 0.00, clamp: false,      isHemIn: false },
        { p: shiftHip(lerp3(pHip, pKnee, 0.16), 0.0, 0.0028 * s * uS1),  dir: dirThigh,                             rxOut: 0.0640 * s * uS1, rxIn: 0.0445 * s * uS1, rz: 0.0600 * s * uS1, t: 0.14, clamp: !underSuit, isHemIn: false },
        { p: shiftHip(lerp3(pHip, pKnee, 0.42), 0.0, 0.0022 * s),        dir: dirThigh,                             rxOut: 0.0605 * s,       rxIn: 0.0435 * s,       rz: 0.0570 * s,       t: 0.30, clamp: true,       isHemIn: false },
        { p: shiftHip(lerp3(pHip, pKnee, 0.72), 0.0, 0.0014 * s),        dir: dirThigh,                             rxOut: 0.0565 * s,       rxIn: 0.0430 * s,       rz: 0.0545 * s,       t: 0.44, clamp: true,       isHemIn: false },
        { p: shiftHip(lerp3(pHip, pKnee, 0.92), 0.0, 0.0008 * s),        dir: norm3(lerp3(dirThigh, dirKnee, 0.5)), rxOut: 0.0540 * s,       rxIn: 0.0425 * s,       rz: 0.0530 * s,       t: 0.52, clamp: true,       isHemIn: false },
        { p: pKnee,                                                      dir: dirKnee,                              rxOut: 0.0525 * s,       rxIn: 0.0420 * s,       rz: 0.0520 * s,       t: 0.58, clamp: true,       isHemIn: false },
        { p: lerp3(pKnee, pFoot, 0.16),                                  dir: norm3(lerp3(dirKnee, dirCalf, 0.5)),  rxOut: 0.0515 * s,       rxIn: 0.0418 * s,       rz: 0.0515 * s,       t: 0.66, clamp: true,       isHemIn: false },
        { p: lerp3(pKnee, pFoot, 0.50),                                  dir: dirCalf,                              rxOut: 0.0500 * s,       rxIn: 0.0412 * s,       rz: 0.0500 * s,       t: 0.80, clamp: true,       isHemIn: false },
        { p: lerp3(pKnee, pFoot, 0.82),                                  dir: dirCalf,                              rxOut: 0.0485 * s,       rxIn: 0.0408 * s,       rz: 0.0485 * s,       t: 0.92, clamp: true,       isHemIn: false },
        { p: lerp3(pKnee, pFoot, 0.945),                                 dir: dirCalf,                              rxOut: 0.0470 * s,       rxIn: 0.0402 * s,       rz: 0.0475 * s,       t: 1.00, clamp: true,       isHemIn: false },
        { p: lerp3(pKnee, pFoot, 0.87),                                  dir: dirCalf,                              rxOut: 0.0365 * s,       rxIn: 0.0355 * s,       rz: 0.0365 * s,       t: 0.94, clamp: false,      isHemIn: true }
      ];

      // Precompute orthonormal frame (U = +torsoRight, V = +torsoFwd) at every leg station
      let curU = cross3(torsoFwd, stations[0].dir);
      if (Math.hypot(curU[0], curU[1], curU[2]) < 1e-4) curU = [1, 0, 0];
      curU = norm3(curU, [1, 0, 0]);
      let curV = norm3(cross3(stations[0].dir, curU), torsoFwd);
      if (dot3(curV, torsoFwd) < 0) {
        curU = [-curU[0], -curU[1], -curU[2]];
        curV = [-curV[0], -curV[1], -curV[2]];
      }
      for (let k = 0; k < stations.length; k++) {
        const st = stations[k];
        if (k > 0) {
          const proj = dot3(curU, st.dir);
          const nextU = [curU[0] - st.dir[0] * proj, curU[1] - st.dir[1] * proj, curU[2] - st.dir[2] * proj];
          if (Math.hypot(nextU[0], nextU[1], nextU[2]) > 1e-4) {
            curU = norm3(nextU, curU);
            curV = norm3(cross3(st.dir, curU), curV);
          }
        }
        st.U = [curU[0], curU[1], curU[2]];
        st.V = [curV[0], curV[1], curV[2]];
      }

      // Evaluate any point on the smooth base leg tube at station index kFloat (0..9) and angle ang,
      // plus an outward radial offset extraOut along the local leg normal for 3D folded pleat layers.
      const evalLegPt = (kFloat, ang, extraOut = 0.0, isHemIn = false) => {
        const maxOuterK = stations.length - 2; // station 9 is bottom hem
        const k0 = isHemIn ? (stations.length - 1) : Math.max(0, Math.min(maxOuterK - 1, Math.floor(kFloat)));
        const k1 = isHemIn ? k0 : Math.min(maxOuterK, k0 + 1);
        const tK = isHemIn ? 0.0 : Math.max(0.0, Math.min(1.0, kFloat - k0));
        const S0 = stations[k0], S1 = stations[k1];

        const p = lerp3(S0.p, S1.p, tK);
        const U = norm3(lerp3(S0.U, S1.U, tK), S0.U);
        const V = norm3(lerp3(S0.V, S1.V, tK), S0.V);
        const rxOut = S0.rxOut * (1.0 - tK) + S1.rxOut * tK;
        const rxIn  = S0.rxIn  * (1.0 - tK) + S1.rxIn  * tK;
        const rz    = S0.rz    * (1.0 - tK) + S1.rz    * tK;
        const doClamp = S0.clamp || S1.clamp;

        const sinA = Math.sin(ang); // +1 = front, -1 = back
        const cosA = Math.cos(ang); // +1 = +torsoRight, -1 = -torsoRight

        const isOuterHalf = (cosA * outerSign) >= 0.0;
        const baseRx = isOuterHalf
          ? (rxIn + (rxOut - rxIn) * Math.pow(Math.abs(cosA), 0.65))
          : (rxIn * (1.0 - 0.06 * Math.pow(Math.abs(cosA), 1.2)));

        // Subtle smooth front/back ironed trouser taper on the base cylinder (no sharp single-vertex spikes)
        const frontTailorTaper = (!isHemIn && sinA > 0.0) ? (Math.pow(sinA, 3.0) * 0.0018 * s) : 0.0;
        const backTailorTaper  = (!isHemIn && sinA < 0.0) ? (Math.pow(-sinA, 4.0) * 0.0014 * s) : 0.0;
        const radX = baseRx;
        const radZ = rz + frontTailorTaper + backTailorTaper;

        let vx = p[0] + U[0] * (cosA * radX) + V[0] * (sinA * radZ);
        let vy = p[1] + U[1] * (cosA * radX) + V[1] * (sinA * radZ);
        let vz = p[2] + U[2] * (cosA * radX) + V[2] * (sinA * radZ);

        if (doClamp && !isHemIn) {
          const isInnerCrotchSide = !isOuterHalf && Math.abs(sinA) < 0.55;
          if (!isInnerCrotchSide) {
            const c1 = clampPointOutsideSegmentCapsule(vx, vy, vz, pHip, pKnee, 0.0550 * s, 0.0440 * s, 0.0035 * s);
            const c2 = clampPointOutsideSegmentCapsule(c1[0], c1[1], c1[2], pKnee, pFoot, 0.0440 * s, 0.0360 * s, 0.0035 * s);
            vx = c2[0]; vy = c2[1]; vz = c2[2];
          }
        }

        if (Math.abs(extraOut) > 1e-6) {
          const nx = U[0] * cosA + V[0] * sinA;
          const ny = U[1] * cosA + V[1] * sinA;
          const nz = U[2] * cosA + V[2] * sinA;
          const nLen = Math.hypot(nx, ny, nz) || 1.0;
          vx += (nx / nLen) * extraOut;
          vy += (ny / nLen) * extraOut;
          vz += (nz / nLen) * extraOut;
        }
        return [vx, vy, vz];
      };

      // 2A. Base Smooth Tailored Trouser Tube (100% uniform charcoal around back, sides, and front)
      const rings = [];
      for (let k = 0; k < stations.length; k++) {
        const st = stations[k];
        const ring = [];
        const col = st.isHemIn
          ? colInner
          : (k === stations.length - 2 ? [colBase[0] * 0.92, colBase[1] * 0.92, colBase[2] * 0.93] : colBase);
        for (let j = 0; j < N_LEG; j++) {
          const ang = (j / N_LEG) * Math.PI * 2.0;
          const pt = evalLegPt(k, ang, 0.0, st.isHemIn);
          ring.push(addV(pt[0], pt[1], pt[2], col));
        }
        rings.push(ring);
      }

      for (let k = 0; k < rings.length - 1; k++) {
        const r0 = rings[k], r1 = rings[k + 1];
        for (let j = 0; j < N_LEG; j++) {
          const nextJ = (j + 1) % N_LEG;
          addQuad(r0[j], r0[nextJ], r1[nextJ], r1[j]);
        }
      }

      // -----------------------------------------------------------------------
      // 2B. Real 3D Folded Front Knife-Pleat & Full-Length Center Press Crease Mesh
      //     (พับแมส 3D จริงสำหรับจีบพับหน้ากางเกงและสันกลีบรีดหน้าขายาวถึงปลายขา)
      //     - At upper thigh (kF = 0.0 .. 4.5), the outer-front pleat blade folds
      //       over toward the center-front crease with a real 3D tucked step wall.
      //     - From upper thigh all the way to the ankle hem (kF = 0.0 .. 9.0),
      //       it forms a crisp 3D pinched center press-crease ridge with dedicated
      //       angled bevel faces and zero painted dark stripes!
      // -----------------------------------------------------------------------
      {
        const angCenter = Math.PI * 0.5; // Dead-center FRONT of leg (sinA = +1, cosA = 0)
        // Note: as ang increases around π/2, cos(ang) decreases (moves toward -U = -torsoRight).
        // Therefore:
        // - For Left leg (outerSign = -1): inner side (+U) is ang < π/2, outer side (-U) is ang > π/2.
        // - For Right leg (outerSign = +1): inner side (-U) is ang > π/2, outer side (+U) is ang < π/2.
        const innerAngSign = isLeft ? -1.0 : 1.0;
        const outerAngSign = -innerAngSign;

        const creaseStations = [0.0, 0.8, 1.7, 2.7, 3.8, 5.0, 6.2, 7.5, 8.8, 9.0];
        const pleatGrid = [];
        for (let r = 0; r < creaseStations.length; r++) {
          const kF = creaseStations[r];
          // Pleat fold width & overhang are strongest at the hip/upper thigh (kF = 0..3.5)
          // and taper smoothly into the sharp ironed center press-crease ridge down to the ankle (kF = 9.0).
          const pleatEnv = Math.max(0.0, 1.0 - kF / 4.8);
          const ridgeH = (0.0030 + 0.0020 * pleatEnv) * s * (kF < 1.5 ? uS0 : 1.0);
          const bladeW = 0.16 + 0.12 * pleatEnv; // Angular width of the outer-front pleat blade

          // 5-column 3D folded cross-section across the front of the leg:
          // c=0: Inner-side base on leg surface (tucked just inside the fold edge)
          // c=1: Inner-side 3D tucked step wall under the pleat overhang
          // c=2: Sharp 3D Center Press-Crease & Pleat Crest (raised outward by ridgeH)
          // c=3: Outer-front 3D Pleat Blade surface (raised by ridgeH * 0.65)
          // c=4: Outer-front merge edge blending seamlessly back into the base trouser surface
          const angInBase  = angCenter + innerAngSign * (0.07 + 0.03 * pleatEnv);
          const angTuckIn  = angCenter + innerAngSign * (0.015 - 0.020 * pleatEnv); // Overhangs slightly at upper thigh!
          const angCrest   = angCenter;
          const angBlade   = angCenter + outerAngSign * (bladeW * 0.52);
          const angOutBase = angCenter + outerAngSign * bladeW;

          const pInBase  = evalLegPt(kF, angInBase,  0.0002 * s);
          const pTuckIn  = evalLegPt(kF, angTuckIn,  0.0005 * s);
          const pCrest   = evalLegPt(kF, angCrest,   ridgeH);
          const pBlade   = evalLegPt(kF, angBlade,   ridgeH * (0.48 + 0.24 * pleatEnv));
          const pOutBase = evalLegPt(kF, angOutBase, 0.0002 * s);

          pleatGrid.push([
            addV(pInBase[0],  pInBase[1],  pInBase[2],  colBase),
            addV(pTuckIn[0],  pTuckIn[1],  pTuckIn[2],  pleatEnv > 0.15 ? colTuckStep : colBase),
            addV(pCrest[0],   pCrest[1],   pCrest[2],   colCreaseHi),
            addV(pBlade[0],   pBlade[1],   pBlade[2],   colLit),
            addV(pOutBase[0], pOutBase[1], pOutBase[2], colBase)
          ]);
        }

        for (let r = 0; r < pleatGrid.length - 1; r++) {
          const g0 = pleatGrid[r], g1 = pleatGrid[r + 1];
          for (let c = 0; c < 4; c++) {
            // Winding order: on the base leg tube, increasing ang (j -> j+1) has quad (r0[j], r0[j+1], r1[j+1], r1[j]).
            // For Left leg, c increases from innerAngSign (-1) to outerAngSign (+1), so ang INCREASES with c.
            // For Right leg, c increases from innerAngSign (+1) to outerAngSign (-1), so ang DECREASES with c.
            if (isLeft) {
              addQuad(g0[c], g0[c + 1], g1[c + 1], g1[c]);
            } else {
              addQuad(g0[c + 1], g0[c], g1[c], g1[c + 1]);
            }
          }
        }
      }

      // -----------------------------------------------------------------------
      // 2C. Secondary Outer-Front 3D Waist Pleat Fold Mesh (Upper Thigh kF = 0.0 .. 3.4)
      //     Matches the second outer-front waist pleat in reference image_8ca5cef7.png
      // -----------------------------------------------------------------------
      {
        const angCenter = Math.PI * 0.5;
        const outerAngSign = isLeft ? 1.0 : -1.0;
        const secStations = [0.0, 0.9, 1.9, 3.2];
        const secGrid = [];
        for (let r = 0; r < secStations.length; r++) {
          const kF = secStations[r];
          const env = Math.max(0.0, 1.0 - kF / 3.2);
          const foldH = 0.0032 * env * s * (kF < 1.5 ? uS0 : 1.0);
          const angCenterSec = angCenter + outerAngSign * (0.34 - 0.04 * (kF / 3.2));

          const angTuck  = angCenterSec - outerAngSign * 0.035;
          const angCrest = angCenterSec;
          const angBlade = angCenterSec + outerAngSign * 0.075;
          const angMerge = angCenterSec + outerAngSign * 0.150;

          const pTuck  = evalLegPt(kF, angTuck,  0.0003 * s);
          const pCrest = evalLegPt(kF, angCrest, foldH);
          const pBlade = evalLegPt(kF, angBlade, foldH * 0.62);
          const pMerge = evalLegPt(kF, angMerge, 0.0002 * s);

          secGrid.push([
            addV(pTuck[0],  pTuck[1],  pTuck[2],  env > 0.2 ? colTuckStep : colBase),
            addV(pCrest[0], pCrest[1], pCrest[2], env > 0.1 ? colCreaseHi : colBase),
            addV(pBlade[0], pBlade[1], pBlade[2], colLit),
            addV(pMerge[0], pMerge[1], pMerge[2], colBase)
          ]);
        }
        for (let r = 0; r < secGrid.length - 1; r++) {
          const g0 = secGrid[r], g1 = secGrid[r + 1];
          for (let c = 0; c < 3; c++) {
            if (isLeft) {
              addQuad(g0[c], g0[c + 1], g1[c + 1], g1[c]);
            } else {
              addQuad(g0[c + 1], g0[c], g1[c], g1[c + 1]);
            }
          }
        }
      }

      // -----------------------------------------------------------------------
      // 2D. Diagonal 3D Groin / Upper-Inner-Thigh Drape Fold Ridge (kF = 0.4 .. 2.4)
      //     Matches the natural diagonal fabric fold below the fly in image_8ca5cef7.png
      // -----------------------------------------------------------------------
      {
        const angCenter = Math.PI * 0.5;
        const innerAngSign = isLeft ? -1.0 : 1.0;
        const diagStations = [0.4, 1.3, 2.3];
        const diagGrid = [];
        for (let r = 0; r < diagStations.length; r++) {
          const kF = diagStations[r];
          const u = r / (diagStations.length - 1);
          const env = Math.sin(u * Math.PI);
          const foldH = 0.0024 * env * s * (kF < 1.5 ? uS0 : 1.0);
          // Sweeps diagonally from near the lower fly (inner-front) outward toward the front-thigh crease
          const angMid = angCenter + innerAngSign * (0.42 - u * 0.24);
          const pIn  = evalLegPt(kF, angMid + innerAngSign * 0.08, 0.0002 * s);
          const pTop = evalLegPt(kF, angMid, foldH);
          const pOut = evalLegPt(kF, angMid - innerAngSign * 0.08, 0.0002 * s);
          diagGrid.push([
            addV(pIn[0],  pIn[1],  pIn[2],  colBase),
            addV(pTop[0], pTop[1], pTop[2], colLit),
            addV(pOut[0], pOut[1], pOut[2], colBase)
          ]);
        }
        for (let r = 0; r < diagGrid.length - 1; r++) {
          const g0 = diagGrid[r], g1 = diagGrid[r + 1];
          for (let c = 0; c < 2; c++) {
            if (isLeft) {
              addQuad(g0[c], g0[c + 1], g1[c + 1], g1[c]);
            } else {
              addQuad(g0[c + 1], g0[c], g1[c], g1[c + 1]);
            }
          }
        }
      }
    };

    addSlacksLeg(leftLegPivot, leftKneeRot, leftFootRot, true);
    addSlacksLeg(rightLegPivot, rightKneeRot, rightFootRot, false);

    const frontTriCount = outI.length;
    const normals = new Float32Array(outV.length);
    for (let k = 0; k < frontTriCount; k += 3) {
      const i0 = outI[k], i1 = outI[k + 1], i2 = outI[k + 2];
      const ux = outV[i1 * 3] - outV[i0 * 3], uy = outV[i1 * 3 + 1] - outV[i0 * 3 + 1], uz = outV[i1 * 3 + 2] - outV[i0 * 3 + 2];
      const vx = outV[i2 * 3] - outV[i0 * 3], vy = outV[i2 * 3 + 1] - outV[i0 * 3 + 1], vz = outV[i2 * 3 + 2] - outV[i0 * 3 + 2];
      const nX = uy * vz - uz * vy, nY = uz * vx - ux * vz, nZ = ux * vy - uy * vx;
      normals[i0 * 3] += nX; normals[i0 * 3 + 1] += nY; normals[i0 * 3 + 2] += nZ;
      normals[i1 * 3] += nX; normals[i1 * 3 + 1] += nY; normals[i1 * 3 + 2] += nZ;
      normals[i2 * 3] += nX; normals[i2 * 3 + 1] += nY; normals[i2 * 3 + 2] += nZ;
    }
    for (let k = 0; k < normals.length; k += 3) {
      const l = Math.hypot(normals[k], normals[k + 1], normals[k + 2]);
      if (l > 1e-12) { normals[k] /= l; normals[k + 1] /= l; normals[k + 2] /= l; }
      else { normals[k] = 0.0; normals[k + 1] = 1.0; normals[k + 2] = 0.0; }
    }
    for (let k = 0; k < frontTriCount; k += 3) {
      outI.push(outI[k], outI[k + 2], outI[k + 1]);
    }

    return {
      vertices: outV,
      normals: normals,
      colors: outC,
      texcoords: outT,
      indices: outI
    };
  }

  // =========================================================================
  // --- 11A-6. Asymmetric One-Shoulder Opera Cape (OPERA_CAPE) ---
  // Reference: /public/assets/aistudio/image_1cba5f2b.png
  //   - Drapes over the viewer's right shoulder (+torsoRight / rightArmPivot)
  //     and back down to mid-calf, leaving the viewer's left arm & chest uncovered
  //   - Deep velvet jet-black outer shell with subtle slate-violet shoulder sheen
  //     and rich dark emerald-teal satin inner lining + 3D stitched border thickness
  //   - Standing velvet collar + curved brushed gunmetal-silver collar strap across
  //     the collarbone with left eyelet buckle tab and 3D pentagonal shield clasp
  // =========================================================================
  function buildOperaCapeMesh(
    headP1,
    chestP1, chestP2,
    neckP1, neckP2,
    leftArmPivot, leftElbowRot, leftHandRot,
    rightArmPivot, rightElbowRot, rightHandRot,
    scale = 1.0,
    phase = 0.0,
    isLocal = false,
    leftFootRot = null,
    rightFootRot = null,
    clothContext = null
  ) {
    const outV = [], outC = [], outT = [], outI = [];
    const s = scale || 1.0;

    const baseGroin = chestP1 || [0, -0.090 * s, 0];
    const baseChest = chestP2 || [0,  0.170 * s, 0];
    const ny = neckP1 ? neckP1[1] : (baseChest[1] + 0.008 * s);

    const tdx = baseChest[0] - baseGroin[0];
    const tdy = baseChest[1] - baseGroin[1];
    const tdz = baseChest[2] - baseGroin[2];
    const torsoLen = Math.hypot(tdx, tdy, tdz) || (0.26 * s);
    const torsoUp = [tdx / torsoLen, tdy / torsoLen, tdz / torsoLen];
    const torsoRatio = Math.max(0.75, Math.min(1.15, torsoLen / (0.26 * s)));

    const fDot = torsoUp[2];
    let torsoFwd = [-torsoUp[0] * fDot, -torsoUp[1] * fDot, 1.0 - torsoUp[2] * fDot];
    const tfLen = Math.hypot(torsoFwd[0], torsoFwd[1], torsoFwd[2]);
    torsoFwd = tfLen > 1e-4 ? [torsoFwd[0] / tfLen, torsoFwd[1] / tfLen, torsoFwd[2] / tfLen] : [0, 0, 1];
    const torsoRight = [
      torsoUp[1] * torsoFwd[2] - torsoUp[2] * torsoFwd[1],
      torsoUp[2] * torsoFwd[0] - torsoUp[0] * torsoFwd[2],
      torsoUp[0] * torsoFwd[1] - torsoUp[1] * torsoFwd[0]
    ];

    const collarBaseX = baseChest[0];
    const collarBaseY = Math.min(ny, baseChest[1] + 0.008 * s);
    const collarBaseZ = baseChest[2];
    const torsoPt = (dx, dy, dz) => [
      collarBaseX + torsoRight[0] * dx + torsoUp[0] * dy + torsoFwd[0] * dz,
      collarBaseY + torsoRight[1] * dx + torsoUp[1] * dy + torsoFwd[1] * dz,
      collarBaseZ + torsoRight[2] * dx + torsoUp[2] * dy + torsoFwd[2] * dz
    ];

    // Opera Cape Palette (matching image_1cba5f2b.png)
    const colCapeOuter     = [0.082, 0.086, 0.102]; // Deep velvet jet-black outer fabric
    const colCapeSheen     = [0.124, 0.130, 0.152]; // Subtle shoulder & outer fold edge sheen
    const colCapeEdge      = [0.062, 0.066, 0.080]; // Crisp 3D border rim
    const colLiningTeal    = [0.044, 0.124, 0.118]; // Rich dark emerald-teal inner satin lining
    const colLiningDeep    = [0.025, 0.072, 0.070]; // Shaded upper interior lining under shoulder/back
    const colMetalDark     = [0.220, 0.238, 0.265]; // Dark gunmetal strap edge & buckle slot
    const colMetalMid      = [0.440, 0.468, 0.508]; // Brushed steel-silver midtone
    const colMetalHi       = [0.735, 0.765, 0.810]; // Specular silver highlight on strap & shield bevel
    const colMetalHole     = [0.075, 0.080, 0.092]; // Recessed rectangular buckle hole

    const addV = (px, py, pz, col) => {
      const idx = (outV.length / 3) | 0;
      outV.push(px, py, pz);
      outC.push(col[0], col[1], col[2]);
      outT.push(-9.0, -9.0);
      return idx;
    };
    const addTri = (a, b, c) => { outI.push(a, b, c); };
    const addQuad = (a, b, c, d) => { outI.push(a, b, c); outI.push(a, c, d); };

    const useClonePhys = !!(clothContext && clothContext.isClone);
    const hPhys = (clothContext && clothContext.hoodiePhysics)
      ? clothContext.hoodiePhysics
      : (useClonePhys
          ? chibiCloneHoodiePhysics
          : ((typeof chibiHoodiePhysics !== "undefined") ? chibiHoodiePhysics : _createDefaultHoodiePhysState()));
    const pAngle = isLocal ? 0.0 : (hPhys.pitch || 0.0);
    const yAngle = isLocal ? 0.0 : (hPhys.yaw || 0.0);
    const rAngle = isLocal ? 0.0 : (hPhys.roll || 0.0);
    const yawLagTerm = isLocal ? 0.0 : ((hPhys.yawLag || 0.0) * 0.24);
    const effPhase = isLocal ? 0.0 : phase;

    const nowPerfSec = (typeof performance !== "undefined" ? performance.now() : Date.now()) * 0.001;
    const windTurb = isLocal ? 0.0 : (hPhys.windTurb || 0.0);
    const airFlare = isLocal ? 0.0 : (hPhys.airFlare || 0.0);
    const flutterT = nowPerfSec * (12.0 + windTurb * 14.0);
    const turbX = (!isLocal && windTurb > 0) ? Math.sin(flutterT) * (windTurb * 0.018) : 0.0;
    const turbY = (!isLocal && windTurb > 0) ? Math.sin(flutterT * 0.85) * (windTurb * 0.013) : 0.0;
    const turbZ = (!isLocal && windTurb > 0) ? Math.cos(flutterT * 1.1) * (windTurb * 0.018) : 0.0;

    // Gentle continuous ambient breeze sway so the cape breathes even when standing still
    const breezeT = nowPerfSec * 1.45;
    const breezeX = isLocal ? 0.0 : Math.sin(breezeT * 1.5) * 0.0042;
    const breezeZ = isLocal ? 0.0 : Math.cos(breezeT * 1.2) * 0.0045;
    const breezeY = isLocal ? 0.0 : Math.sin(breezeT * 1.8) * 0.0020;

    const pLHip  = clothContext && clothContext.leftLegPivot  ? clothContext.leftLegPivot  : [-0.052 * s, baseGroin[1], baseGroin[2]];
    const pLKnee = clothContext && clothContext.leftKneeRot   ? clothContext.leftKneeRot   : [-0.052 * s, baseGroin[1] - 0.15 * s, baseGroin[2]];
    const pLFoot = clothContext && clothContext.leftFootRot   ? clothContext.leftFootRot   : (leftFootRot  || [-0.052 * s, baseGroin[1] - 0.30 * s, baseGroin[2]]);
    const pRHip  = clothContext && clothContext.rightLegPivot ? clothContext.rightLegPivot : [ 0.052 * s, baseGroin[1], baseGroin[2]];
    const pRKnee = clothContext && clothContext.rightKneeRot  ? clothContext.rightKneeRot  : [ 0.052 * s, baseGroin[1] - 0.15 * s, baseGroin[2]];
    const pRFoot = clothContext && clothContext.rightFootRot  ? clothContext.rightFootRot  : (rightFootRot || [ 0.052 * s, baseGroin[1] - 0.30 * s, baseGroin[2]]);

    const bodyColliderData = {
      headP1: headP1 || [baseChest[0], baseChest[1] + 0.08 * s, baseChest[2]],
      chestP1: baseGroin,
      chestP2: baseChest,
      leftArmPivot,
      leftElbowRot,
      leftHandRot,
      rightArmPivot,
      rightElbowRot,
      rightHandRot,
      leftLegPivot: pLHip,
      leftKneeRot: pLKnee,
      leftFootRot: pLFoot,
      rightLegPivot: pRHip,
      rightKneeRot: pRKnee,
      rightFootRot: pRFoot,
      legRadiusBoost: 0.002,
      scale: s
    };

    const capeStride = _computeGarmentLegStride(clothContext, torsoRight, torsoFwd, 0.72, !isLocal);
    const strideAct = isLocal
      ? 0.0
      : Math.min(1.0, (capeStride.lFwd + capeStride.lBack + capeStride.rFwd + capeStride.rBack) / (0.13 * s));
    const physAct = isLocal
      ? 0.0
      : Math.min(1.0, Math.hypot(hPhys.gx || 0.0, hPhys.gz || 0.0) * 18.0 + Math.hypot(hPhys.tx || 0.0, hPhys.tz || 0.0) * 10.0 + Math.abs(pAngle) * 2.4 + Math.abs(yAngle) * 2.4);
    const motionIntensity = isLocal ? 0.0 : Math.min(1.0, Math.max(strideAct, physAct));

    // Right upper-arm swing offset relative to neutral hanging pose so the right shoulder drape flows with the arm
    let armSwingX = 0.0, armSwingZ = 0.0;
    if (!isLocal && rightArmPivot && rightElbowRot) {
      const adx = rightElbowRot[0] - rightArmPivot[0];
      const ady = rightElbowRot[1] - rightArmPivot[1];
      const adz = rightElbowRot[2] - rightArmPivot[2];
      const projX = adx * torsoRight[0] + ady * torsoRight[1] + adz * torsoRight[2];
      const projZ = adx * torsoFwd[0]   + ady * torsoFwd[1]   + adz * torsoFwd[2];
      armSwingX = Math.max(-0.035 * s, Math.min(0.045 * s, (projX - 0.028 * s) * 0.55));
      armSwingZ = Math.max(-0.055 * s, Math.min(0.055 * s, projZ * 0.65));
    }

    const computeCapeDisp = (w) => {
      if (isLocal || w <= 0.001) return [0.0, 0.0, 0.0];
      const wEff = Math.max(0.0, (w - 0.04) / 0.96);
      const wPrimary = wEff * (0.50 + 0.50 * wEff);
      const wWhip = wEff * wEff * (0.38 + 0.62 * wEff);
      const bounceY = Math.sin(effPhase * 2.0 - w * 1.1) * 0.013 * wEff * s;
      const dx = (
        hPhys.gx * 0.78 * wPrimary +
        hPhys.tx * 0.96 * wWhip +
        hPhys.airX * 1.15 * wEff +
        (yAngle * 0.075 + rAngle * 0.048 + yawLagTerm) * wEff +
        breezeX * wEff +
        turbX * wEff
      ) * s;
      const dy = (
        hPhys.gy * 0.64 * wPrimary +
        hPhys.ty * 0.82 * wWhip +
        hPhys.airY * 0.95 * wEff +
        breezeY * wEff +
        turbY * wEff
      ) * s + bounceY;
      const dz = (
        hPhys.gz * 0.85 * wPrimary +
        hPhys.tz * 1.12 * wWhip +
        hPhys.airZ * 1.15 * wEff -
        pAngle * 0.095 * wEff +
        breezeZ * wEff +
        turbZ * wEff
      ) * s;
      return [dx, dy, dz];
    };

    // Helper to guarantee any collar/upper-cape point sits strictly outside the suit's standing collar
    const clampOutsideSuitCollar = (pt, extraPad = 0.004 * s) => {
      const rx = pt[0] - collarBaseX, ry = pt[1] - collarBaseY, rz = pt[2] - collarBaseZ;
      const tx = rx * torsoRight[0] + ry * torsoRight[1] + rz * torsoRight[2];
      const ty = rx * torsoUp[0]    + ry * torsoUp[1]    + rz * torsoUp[2];
      const tz = rx * torsoFwd[0]   + ry * torsoFwd[1]   + rz * torsoFwd[2];
      if (ty < -0.028 * s || ty > 0.036 * s) return pt;
      const minRx = 0.096 * s + extraPad;
      const minRz = (tz >= 0.0 ? 0.080 : 0.094) * s + extraPad;
      const nx = tx / minRx, nz = tz / minRz;
      const rE = Math.hypot(nx, nz);
      if (rE < 1.0 && rE > 1e-4) {
        const sc = 1.0 / rE;
        return torsoPt(tx * sc, ty, tz * sc);
      }
      return pt;
    };

    // -------------------------------------------------------------------------
    // 1. Standing Velvet Collar Wrapping Cleanly Outside the Suit Collar
    //    Spans continuously from the front-right shield clasp (ang = 0.22)
    //    around the right shoulder (PI/2), full back of the neck (PI), and left
    //    neck side to the front-left strap buckle (ang = 2*PI - 0.26 = 6.02).
    // -------------------------------------------------------------------------
    {
      const ang0 = 0.22;
      const ang1 = Math.PI * 2.0 - 0.26;
      const nSeg = 22;
      const topOut = [], botOut = [], topIn = [], botIn = [];
      for (let i = 0; i <= nSeg; i++) {
        const u = i / nSeg;
        const ang = ang0 + u * (ang1 - ang0);
        const sA = Math.sin(ang);
        const cA = Math.cos(ang);
        // Peak height & radial clearance centered across the back of the neck (ang ≈ PI)
        const endTaper = Math.sin(u * Math.PI);
        const backWeight = Math.max(0.0, -cA);
        const env = Math.min(1.0, endTaper * (0.75 + 0.35 * backWeight));

        const hTop = (0.017 + 0.012 * env) * s;
        const hBot = -0.006 * s;
        const rOutX = (0.090 + 0.010 * env) * s;
        const rOutZ = (cA >= 0 ? 0.078 : 0.092) * s + 0.008 * env * s;
        const colThick = 0.0036 * s;

        let pTO = torsoPt(sA * rOutX, hTop, cA * rOutZ);
        let pBO = torsoPt(sA * (rOutX + 0.006 * s), hBot, cA * (rOutZ + 0.006 * s));
        pTO = clampPointOutsideChibiBodyForCloth(pTO[0], pTO[1], pTO[2], bodyColliderData, 0.012, false);
        pBO = clampPointOutsideChibiBodyForCloth(pBO[0], pBO[1], pBO[2], bodyColliderData, 0.013, false);
        pTO = clampOutsideSuitCollar(pTO, 0.0050 * s);
        pBO = clampOutsideSuitCollar(pBO, 0.0070 * s);

        const rdx = torsoRight[0] * sA + torsoFwd[0] * cA;
        const rdy = torsoRight[1] * sA + torsoFwd[1] * cA;
        const rdz = torsoRight[2] * sA + torsoFwd[2] * cA;
        const rL = Math.hypot(rdx, rdy, rdz) || 1.0;
        const nx = rdx / rL, nyN = rdy / rL, nz = rdz / rL;

        const pTI = [pTO[0] - nx * colThick, pTO[1] - nyN * colThick - 0.0008 * s, pTO[2] - nz * colThick];
        const pBI = [pBO[0] - nx * colThick, pBO[1] - nyN * colThick, pBO[2] - nz * colThick];

        topOut.push(addV(pTO[0], pTO[1], pTO[2], colCapeSheen));
        botOut.push(addV(pBO[0], pBO[1], pBO[2], colCapeOuter));
        topIn.push(addV(pTI[0], pTI[1], pTI[2], colCapeEdge));
        botIn.push(addV(pBI[0], pBI[1], pBI[2], colLiningDeep));
      }
      for (let i = 0; i < nSeg; i++) {
        addQuad(topOut[i], botOut[i], botOut[i + 1], topOut[i + 1]); // Outer collar face
        addQuad(botIn[i],  topIn[i],  topIn[i + 1],  botIn[i + 1]);  // Inner collar face
        addQuad(topIn[i],  topOut[i], topOut[i + 1], topIn[i + 1]);  // Top collar rim
      }
      addQuad(topIn[0], botIn[0], botOut[0], topOut[0]);
      addQuad(topOut[nSeg], botOut[nSeg], botIn[nSeg], topIn[nSeg]);
    }

    // -------------------------------------------------------------------------
    // 2. One-Shoulder Asymmetric Opera Cape Body (Double-Sided 3D Shell Mesh)
    //    - Outer surface: deep velvet jet-black (colCapeOuter / colCapeSheen)
    //    - Inner surface: dark emerald-teal satin lining (colLiningTeal / colLiningDeep)
    //    - Drapes over viewer's right shoulder (+X, rightArmPivot) down to mid-calf (-0.408*s)
    //    - Diagonal front cut from the silver shield clasp (ang = 0.22) across the upper
    //      arm (ang = 1.28 at elbow) so the forearm/hand holding weapons stays completely clear!
    // -------------------------------------------------------------------------
    const capeLevels = [
      { dy:  0.004 * s * torsoRatio, rx: 0.103 * s, rzF: 0.085 * s, rzB: 0.098 * s, shiftX: 0.003 * s, angStart: 0.22, angEnd: 3.68, t: 0.00 }, // 0: Neck / collar base
      { dy: -0.022 * s * torsoRatio, rx: 0.140 * s, rzF: 0.095 * s, rzB: 0.102 * s, shiftX: 0.010 * s, angStart: 0.44, angEnd: 3.65, t: 0.08 }, // 1: Right shoulder cap
      { dy: -0.058 * s * torsoRatio, rx: 0.153 * s, rzF: 0.100 * s, rzB: 0.105 * s, shiftX: 0.016 * s, angStart: 0.74, angEnd: 3.60, t: 0.18 }, // 2: Upper arm drape
      { dy: -0.104 * s * torsoRatio, rx: 0.162 * s, rzF: 0.104 * s, rzB: 0.106 * s, shiftX: 0.020 * s, angStart: 1.04, angEnd: 3.54, t: 0.30 }, // 3: Mid arm diagonal sweep
      { dy: -0.156 * s * torsoRatio, rx: 0.169 * s, rzF: 0.107 * s, rzB: 0.109 * s, shiftX: 0.022 * s, angStart: 1.28, angEnd: 3.48, t: 0.43 }, // 4: Forearm/hand exit level
      { dy: -0.215 * s * torsoRatio, rx: 0.175 * s, rzF: 0.109 * s, rzB: 0.114 * s, shiftX: 0.025 * s, angStart: 1.35, angEnd: 3.43, t: 0.56 }, // 5: Hip level
      { dy: -0.278 * s * torsoRatio, rx: 0.182 * s, rzF: 0.112 * s, rzB: 0.120 * s, shiftX: 0.028 * s, angStart: 1.38, angEnd: 3.38, t: 0.70 }, // 6: Suit hem / upper thigh
      { dy: -0.342 * s * torsoRatio, rx: 0.189 * s, rzF: 0.115 * s, rzB: 0.127 * s, shiftX: 0.030 * s, angStart: 1.40, angEnd: 3.34, t: 0.85 }, // 7: Knee level
      { dy: -0.408 * s * torsoRatio, rx: 0.196 * s, rzF: 0.118 * s, rzB: 0.134 * s, shiftX: 0.032 * s, angStart: 1.42, angEnd: 3.30, t: 1.00 }  // 8: Mid-calf bottom hem
    ];

    const N_CAPE_COLS = 18;
    const capeThick = 0.0036 * s;
    const outerGrid = [];
    const innerGrid = [];

    for (let r = 0; r < capeLevels.length; r++) {
      const lvl = capeLevels[r];
      const w = lvl.t;
      const wEff = Math.max(0.0, (w - 0.04) / 0.96);
      const bDisp = computeCapeDisp(w);
      const flare = isLocal ? 0.0 : ((airFlare * 0.65 + Math.abs(yAngle) * 0.034 + motionIntensity * 0.028) * wEff * s);
      const outRow = [];
      const inRow = [];

      for (let c = 0; c < N_CAPE_COLS; c++) {
        const u = c / (N_CAPE_COLS - 1);
        const ang = lvl.angStart + u * (lvl.angEnd - lvl.angStart);
        const sinA = Math.sin(ang); // +1 at right shoulder (ang = PI/2), 0 at back (ang = PI), < 0 past PI
        const cosA = Math.cos(ang); // +1 at front, -1 at back

        // Tailored vertical drape flutes + dynamic phase-delayed travelling wave when moving/in wind
        const staticFlute = Math.sin(u * Math.PI * 3.0) * 0.0032 * s * (0.30 + 0.70 * w);
        const waveArg = effPhase * 2.0 - w * 2.5 + u * Math.PI * 3.0 + breezeT * 0.7;
        const dynWaveAmp = isLocal ? 0.0 : ((0.0028 + 0.015 * motionIntensity + windTurb * 0.012) * wEff * s);
        const rippleR = Math.sin(waveArg) * dynWaveAmp;
        const rippleY = Math.cos(waveArg * 1.15) * dynWaveAmp * 0.62;

        // Leg-stride tenting & side push on the lower cape (r >= 3)
        const skD = _computeSkirtVertexDisplacement(
          sinA, cosA, w, 0.24, s, bDisp, capeStride, 0.045,
          effPhase, 0.005, 0.24, 0.42, 0.30, 0.28, 0.78
        );

        // Right-arm swing follow on the shoulder & upper-side drape
        const armFollowW = (!isLocal && r >= 1 && r <= 6 && sinA > 0.15)
          ? (Math.max(0.0, sinA) * Math.sin(Math.min(1.0, w / 0.72) * Math.PI) * 0.48)
          : 0.0;

        // Aerodynamic backward stream along the back of the cape when moving forward
        const backStreamZ = isLocal
          ? 0.0
          : (-Math.max(0.0, -cosA + 0.25) * motionIntensity * 0.036 * wEff * wEff * s);

        const rz = (cosA >= 0.0 ? lvl.rzF : lvl.rzB) + staticFlute + flare + rippleR;
        const rx = lvl.rx + (staticFlute + flare + rippleR) * 0.88;

        const lx = lvl.shiftX + sinA * rx + bDisp[0] + skD.legSidePush + armSwingX * armFollowW;
        const ly = lvl.dy + bDisp[1] + rippleY + skD.rippleY + (skD.legFrontTent * 0.16 + skD.legBackTent * 0.22);
        const lz = cosA * rz + skD.effDispZ + backStreamZ + armSwingZ * armFollowW + (skD.legFrontTent * 0.78 - skD.legBackTent * 0.88);
        let pos = torsoPt(lx, ly, lz);

        // 1) Clamp against Chibi neck/chest/torso collider on upper rows so collar & upper back never clip
        if (r <= 2) {
          pos = clampPointOutsideChibiBodyForCloth(pos[0], pos[1], pos[2], bodyColliderData, 0.012, false);
        }
        if (r <= 1) {
          pos = clampOutsideSuitCollar(pos, 0.0065 * s);
        }

        // 2) Ensure outer clearance over the right shoulder & upper arm (rightArmPivot -> rightElbowRot)
        //    while allowing the lower forearm/hand to emerge cleanly in front of the diagonal cut!
        if (rightArmPivot && rightElbowRot && r >= 1 && r <= 4 && sinA > 0.25) {
          const armRestEnd = [
            rightArmPivot[0] + (rightElbowRot[0] - rightArmPivot[0]) * 0.85,
            rightArmPivot[1] + (rightElbowRot[1] - rightArmPivot[1]) * 0.85,
            rightArmPivot[2] + (rightElbowRot[2] - rightArmPivot[2]) * 0.85
          ];
          pos = clampPointOutsideSegmentCapsule(pos[0], pos[1], pos[2], rightArmPivot, armRestEnd, 0.055 * s, 0.049 * s, 0.005 * s);
        }

        // 3) Ensure clearance outside the suit torso & upper back (including inner lining thickness!)
        if (r <= 5) {
          const suitRx = (r === 0 ? 0.100 : (r === 1 ? 0.132 : (r <= 4 ? 0.112 : 0.128))) * s;
          const suitRzB = (r === 0 ? 0.097 : (r === 1 ? 0.099 : (r <= 4 ? 0.095 : 0.105))) * s;
          const suitRzF = (r === 0 ? 0.083 : (r === 1 ? 0.089 : (r <= 4 ? 0.090 : 0.102))) * s;
          const relX = pos[0] - collarBaseX, relY = pos[1] - collarBaseY, relZ = pos[2] - collarBaseZ;
          const tx = relX * torsoRight[0] + relY * torsoRight[1] + relZ * torsoRight[2];
          const ty = relX * torsoUp[0]    + relY * torsoUp[1]    + relZ * torsoUp[2];
          const tz = relX * torsoFwd[0]   + relY * torsoFwd[1]   + relZ * torsoFwd[2];
          const suitRz = tz >= 0.0 ? suitRzF : suitRzB;
          const nxE = tx / suitRx, nzE = tz / suitRz;
          const radE = Math.hypot(nxE, nzE);
          if (radE < 1.04 && radE > 1e-4) {
            const pushScale = 1.04 / radE;
            pos = torsoPt(tx * pushScale, ty, tz * pushScale);
          }
        }

        // 4) Ensure lower cape clears walking thighs and calves (pushing backward/outward, never forward through the leg)
        if (r >= 5) {
          pos = clampPointOutsideSegmentCapsule(pos[0], pos[1], pos[2], pRHip, pRKnee, 0.068 * s, 0.056 * s, 0.006 * s);
          pos = clampPointOutsideSegmentCapsule(pos[0], pos[1], pos[2], pRKnee, pRFoot, 0.056 * s, 0.048 * s, 0.006 * s);
          pos = clampPointOutsideSegmentCapsule(pos[0], pos[1], pos[2], pLHip, pLKnee, 0.068 * s, 0.056 * s, 0.006 * s);
          pos = clampPointOutsideSegmentCapsule(pos[0], pos[1], pos[2], pLKnee, pLFoot, 0.056 * s, 0.048 * s, 0.006 * s);
        }

        // Outward radial normal for offsetting the inner emerald-teal lining shell
        const rdx = torsoRight[0] * sinA + torsoFwd[0] * cosA;
        const rdy = torsoRight[1] * sinA + torsoFwd[1] * cosA;
        const rdz = torsoRight[2] * sinA + torsoFwd[2] * cosA;
        const rLen = Math.hypot(rdx, rdy, rdz) || 1.0;
        const nOutX = rdx / rLen, nOutY = rdy / rLen, nOutZ = rdz / rLen;

        const pIn = [
          pos[0] - nOutX * capeThick,
          pos[1] - nOutY * capeThick,
          pos[2] - nOutZ * capeThick
        ];

        // Outer color: jet-black velvet with subtle shoulder & fold-crest sheen
        const isFoldCrest = (c <= 1) || (r <= 2 && u < 0.35) || (r >= 3 && Math.sin(u * Math.PI * 3.0) > 0.65);
        const colOut = isFoldCrest ? colCapeSheen : colCapeOuter;
        // Inner color: dark emerald-teal satin lining (slightly deeper higher up in the interior shadow)
        const liningMix = Math.min(1.0, Math.max(0.0, (lvl.t - 0.15) / 0.65));
        const colIn = [
          colLiningDeep[0] * (1.0 - liningMix) + colLiningTeal[0] * liningMix,
          colLiningDeep[1] * (1.0 - liningMix) + colLiningTeal[1] * liningMix,
          colLiningDeep[2] * (1.0 - liningMix) + colLiningTeal[2] * liningMix
        ];

        outRow.push(addV(pos[0], pos[1], pos[2], colOut));
        inRow.push(addV(pIn[0], pIn[1], pIn[2], colIn));
      }
      outerGrid.push(outRow);
      innerGrid.push(inRow);
    }

    // Stitch Outer Shell (outward normals) & Inner Lining Shell (inward normals)
    for (let r = 0; r < capeLevels.length - 1; r++) {
      const o0 = outerGrid[r], o1 = outerGrid[r + 1];
      const i0 = innerGrid[r], i1 = innerGrid[r + 1];
      for (let c = 0; c < N_CAPE_COLS - 1; c++) {
        // As c increases, ang increases (from front +Z around right +X to back -Z),
        // and as r increases, y decreases (-Y). Thus (o0[c] -> o1[c] -> o1[c+1] -> o0[c+1]) has outward normal!
        addQuad(o0[c], o1[c], o1[c + 1], o0[c + 1]);
        // Reversed winding on innerGrid so inner emerald-teal lining faces INWARD toward the body/viewer!
        addQuad(i0[c + 1], i1[c + 1], i1[c], i0[c]);
      }
      // Stitch 3D front diagonal border wall (c = 0) & back border wall (c = N_CAPE_COLS - 1)
      const lastC = N_CAPE_COLS - 1;
      addQuad(i0[0], i1[0], o1[0], o0[0]);
      addQuad(o0[lastC], o1[lastC], i1[lastC], i0[lastC]);
    }
    // Stitch 3D top shoulder rim (r = 0) & bottom hem rim (r = capeLevels.length - 1)
    {
      const lastR = capeLevels.length - 1;
      for (let c = 0; c < N_CAPE_COLS - 1; c++) {
        addQuad(innerGrid[0][c], outerGrid[0][c], outerGrid[0][c + 1], innerGrid[0][c + 1]);
        addQuad(outerGrid[lastR][c], innerGrid[lastR][c], innerGrid[lastR][c + 1], outerGrid[lastR][c + 1]);
      }
    }

    // -------------------------------------------------------------------------
    // 3. Curved Brushed Gunmetal-Silver Collar Strap & Pentagonal Shield Clasp
    //    (Matches image_1cba5f2b.png:
    //     - Spans from viewer's left collar [-0.044*s, +0.015*s, +0.075*s] with a
    //       recessed rectangular buckle slot, curving across the open V-neck to
    //       the 3D 5-sided pentagonal shield clasp at [+0.022*s .. +0.052*s, -0.008*s, +0.084*s])
    // -------------------------------------------------------------------------
    {
      const N_STRAP = 12;
      const strapTopOut = [], strapBotOut = [], strapTopIn = [], strapBotIn = [];
      for (let i = 0; i <= N_STRAP; i++) {
        const u = i / N_STRAP; // 0 = viewer's left buckle end, 1 = viewer's right shield clasp entry
        // Smooth curved arc across the front collarbone
        const dx = (-0.044 + u * 0.068) * s;
        const sag = Math.sin(u * Math.PI) * 0.005 * s;
        const dyMid = (0.015 * (1.0 - u) + (-0.006) * u) * s - sag;
        const dzOut = (0.075 + Math.sin(u * Math.PI) * 0.013 + u * 0.008) * s;
        const dzIn  = dzOut - 0.0034 * s;
        const halfW = 0.0068 * s;

        // Brushed metallic specular gradient: gunmetal at ends -> bright silver highlight near u = 0.62
        const spec = Math.exp(-Math.pow((u - 0.62) / 0.24, 2));
        const colFace = [
          colMetalDark[0] * (1.0 - spec) + colMetalHi[0] * spec,
          colMetalDark[1] * (1.0 - spec) + colMetalHi[1] * spec,
          colMetalDark[2] * (1.0 - spec) + colMetalHi[2] * spec
        ];

        const pTO = torsoPt(dx, dyMid + halfW, dzOut);
        const pBO = torsoPt(dx, dyMid - halfW, dzOut);
        const pTI = torsoPt(dx, dyMid + halfW, dzIn);
        const pBI = torsoPt(dx, dyMid - halfW, dzIn);

        strapTopOut.push(addV(pTO[0], pTO[1], pTO[2], colFace));
        strapBotOut.push(addV(pBO[0], pBO[1], pBO[2], colMetalMid));
        strapTopIn.push(addV(pTI[0], pTI[1], pTI[2], colMetalDark));
        strapBotIn.push(addV(pBI[0], pBI[1], pBI[2], colMetalDark));
      }
      for (let i = 0; i < N_STRAP; i++) {
        addQuad(strapTopOut[i], strapBotOut[i], strapBotOut[i + 1], strapTopOut[i + 1]); // Front metallic face
        addQuad(strapBotIn[i],  strapTopIn[i],  strapTopIn[i + 1],  strapBotIn[i + 1]);  // Back face
        addQuad(strapTopIn[i],  strapTopOut[i], strapTopOut[i + 1], strapTopIn[i + 1]);  // Top bevel rim
        addQuad(strapBotOut[i], strapBotIn[i],  strapBotIn[i + 1],  strapBotOut[i + 1]); // Bottom bevel rim
      }
      // Left end cap of strap
      addQuad(strapTopIn[0], strapBotIn[0], strapBotOut[0], strapTopOut[0]);

      // Small dark rectangular buckle eyelet slot near the viewer's left end of the strap (u ≈ 0.06 .. 0.15)
      {
        const hTL = addV(...torsoPt(-0.040 * s, 0.0165 * s, 0.0778 * s), colMetalHole);
        const hTR = addV(...torsoPt(-0.034 * s, 0.0150 * s, 0.0792 * s), colMetalHole);
        const hBL = addV(...torsoPt(-0.040 * s, 0.0110 * s, 0.0778 * s), colMetalHole);
        const hBR = addV(...torsoPt(-0.034 * s, 0.0095 * s, 0.0792 * s), colMetalHole);
        addQuad(hTL, hBL, hBR, hTR);
      }

      // 3D 5-Sided Pentagonal Shield Clasp on the Viewer's Right Collarbone
      // (Sits at the right end of the strap, overlapping the front-right edge of the cape)
      {
        // Local 2D coordinates (uAlong, vUp) of the 5-sided shield centered at (dx0, dy0, dz0),
        // tilted slightly downward-right (-15 deg) along the strap direction
        const cx =  0.035 * s;
        const cy = -0.008 * s;
        const cz =  0.084 * s;
        const cosT =  0.966;
        const sinT = -0.259; // -15 deg tilt
        const shieldPt = (uL, vU, zOff, scaleUV = 1.0) => {
          const su = uL * scaleUV;
          const sv = vU * scaleUV;
          const dx = cx + (su * cosT - sv * sinT);
          const dy = cy + (su * sinT + sv * cosT);
          // Curve slightly backward along the shoulder contour as dx increases
          const curveZ = cz + zOff - Math.max(0.0, su) * 0.18;
          return torsoPt(dx, dy, curveZ);
        };

        // 5 vertices of the pentagonal shield in CCW order:
        // 0: Top-Left, 1: Bottom-Left, 2: Bottom-Right shoulder, 3: Right Tip (>), 4: Top-Right shoulder
        const wL = -0.013 * s, wM = 0.007 * s, wTip = 0.016 * s;
        const hB =  0.0105 * s;
        const polyUV = [
          [wL,   hB],   // 0: Top-Left
          [wL,  -hB],   // 1: Bottom-Left
          [wM,  -hB],   // 2: Bottom-Right
          [wTip, 0.0],  // 3: Pointed Right Tip (>)
          [wM,   hB]    // 4: Top-Right
        ];

        const baseRing = [], rimRing = [], innerRing = [];
        for (let k = 0; k < 5; k++) {
          const uv = polyUV[k];
          const pBase = shieldPt(uv[0], uv[1], -0.0022 * s, 1.04);
          const pRim  = shieldPt(uv[0], uv[1],  0.0032 * s, 1.00);
          const pIn   = shieldPt(uv[0], uv[1],  0.0036 * s, 0.72);
          baseRing.push(addV(pBase[0], pBase[1], pBase[2], colMetalDark));
          rimRing.push(addV(pRim[0],   pRim[1],   pRim[2],   colMetalHi));
          innerRing.push(addV(pIn[0],  pIn[1],    pIn[2],    colMetalMid));
        }
        const pCenter = shieldPt(0.001 * s, 0.0, 0.0040 * s, 1.0);
        const vCenter = addV(pCenter[0], pCenter[1], pCenter[2], colMetalMid);

        for (let k = 0; k < 5; k++) {
          const nextK = (k + 1) % 5;
          // Outer side wall of the shield clasp
          addQuad(baseRing[k], baseRing[nextK], rimRing[nextK], rimRing[k]);
          // Raised silver bevel frame of the shield clasp
          addQuad(rimRing[k], rimRing[nextK], innerRing[nextK], innerRing[k]);
          // Brushed gunmetal-silver inner plate
          addTri(innerRing[k], innerRing[nextK], vCenter);
        }
      }
    }

    const frontTriCount = outI.length;
    const normals = new Float32Array(outV.length);
    for (let k = 0; k < frontTriCount; k += 3) {
      const i0 = outI[k], i1 = outI[k + 1], i2 = outI[k + 2];
      const ux = outV[i1 * 3] - outV[i0 * 3], uy = outV[i1 * 3 + 1] - outV[i0 * 3 + 1], uz = outV[i1 * 3 + 2] - outV[i0 * 3 + 2];
      const vx = outV[i2 * 3] - outV[i0 * 3], vy = outV[i2 * 3 + 1] - outV[i0 * 3 + 1], vz = outV[i2 * 3 + 2] - outV[i0 * 3 + 2];
      const nX = uy * vz - uz * vy, nY = uz * vx - ux * vz, nZ = ux * vy - uy * vx;
      normals[i0 * 3] += nX; normals[i0 * 3 + 1] += nY; normals[i0 * 3 + 2] += nZ;
      normals[i1 * 3] += nX; normals[i1 * 3 + 1] += nY; normals[i1 * 3 + 2] += nZ;
      normals[i2 * 3] += nX; normals[i2 * 3 + 1] += nY; normals[i2 * 3 + 2] += nZ;
    }
    for (let k = 0; k < normals.length; k += 3) {
      const l = Math.hypot(normals[k], normals[k + 1], normals[k + 2]);
      if (l > 1e-12) { normals[k] /= l; normals[k + 1] /= l; normals[k + 2] /= l; }
      else { normals[k] = 0.0; normals[k + 1] = 1.0; normals[k + 2] = 0.0; }
    }
    for (let k = 0; k < frontTriCount; k += 3) {
      outI.push(outI[k], outI[k + 2], outI[k + 1]);
    }

    return {
      vertices: outV,
      normals: normals,
      colors: outC,
      texcoords: outT,
      indices: outI
    };
  }

  // =========================================================================
  // --- 11B. 3D Clothing Item Icon Mesh Builders (Bodysuit, Shirt, Skirt, Leggings, Hoodie, Boots, Suit, Slacks, Opera Cape) ---
  // =========================================================================
  function buildWhiteBodysuitTopIconMesh(rawVertices, rawColors, rawIndices) {
    const baseV = (rawVertices.length / 3) | 0;
    const addV = (x, y, z, col) => {
      const idx = (rawVertices.length / 3) | 0;
      rawVertices.push(x, y, z);
      rawColors.push(col[0], col[1], col[2]);
      return idx;
    };
    // Note: create3DIconCanvas uses CW outward winding: (v2 - v0) x (v1 - v0)
    const addQuadCW = (i0, i1, i2, i3) => {
      rawIndices.push(i0, i2, i1);
      rawIndices.push(i0, i3, i2);
    };
    const addTriCW = (i0, i1, i2) => {
      rawIndices.push(i0, i2, i1);
    };

    // 1. Sculpted Bodysuit Upper Torso (from waist split h=0.32 up through chest, shoulders & mock-neck collar)
    const radialSegs = 16;
    const rings = [
      { y: -0.14, rx: 0.125, rz: 0.088, isCollar: false, shade: 0.92 }, // Waist split hem
      { y: -0.05, rx: 0.118, rz: 0.085, isCollar: false, shade: 0.95 }, // Tapered waist
      { y:  0.06, rx: 0.148, rz: 0.112, isCollar: false, shade: 0.99 }, // Full bust / chest contour
      { y:  0.15, rx: 0.172, rz: 0.096, isCollar: false, shade: 0.98 }, // Deltoid shoulders
      { y:  0.20, rx: 0.092, rz: 0.078, isCollar: true,  shade: 0.94 }, // Collarbone seam
      { y:  0.26, rx: 0.084, rz: 0.074, isCollar: true,  shade: 0.99 }  // High mock-neck collar top
    ];

    const ringIndices = [];
    for (let r = 0; r < rings.length; r++) {
      const lv = rings[r];
      const row = [];
      for (let j = 0; j < radialSegs; j++) {
        const ang = (j / radialSegs) * Math.PI * 2;
        const sinA = Math.sin(ang);
        const cosA = Math.cos(ang);
        let zOff = cosA * lv.rz;
        // Front bust contour & under-bust shadow
        if (r === 2 && cosA > 0) zOff += cosA * 0.018;
        const sideAO = Math.abs(sinA) * 0.04;
        const s = lv.shade - sideAO;
        const col = [
          Math.min(1.0, s * 0.98),
          Math.min(1.0, s * 0.985),
          Math.min(1.0, s * 1.00)
        ];
        row.push(addV(sinA * lv.rx, lv.y, zOff, col));
      }
      ringIndices.push(row);
    }

    for (let r = 0; r < ringIndices.length - 1; r++) {
      for (let j = 0; j < radialSegs; j++) {
        const nextJ = (j + 1) % radialSegs;
        addQuadCW(ringIndices[r][j], ringIndices[r][nextJ], ringIndices[r + 1][nextJ], ringIndices[r + 1][j]);
      }
    }

    // Cap top collar & bottom waist opening with dark inner shadow
    const topC = addV(0, 0.255, 0, [0.80, 0.82, 0.86]);
    const botC = addV(0, -0.14, 0, [0.84, 0.85, 0.89]);
    const lastR = ringIndices[ringIndices.length - 1];
    const firstR = ringIndices[0];
    for (let j = 0; j < radialSegs; j++) {
      const nextJ = (j + 1) % radialSegs;
      addTriCW(lastR[j], lastR[nextJ], topC);
      addTriCW(firstR[nextJ], firstR[j], botC);
    }

    // 2. Short Fitted Sleeves (Left & Right)
    for (let side of [-1, 1]) {
      const sRings = [
        { cx: side * 0.155, cy: 0.135, r: 0.056, shade: 0.96 },
        { cx: side * 0.215, cy: 0.085, r: 0.051, shade: 0.98 },
        { cx: side * 0.265, cy: 0.038, r: 0.048, shade: 0.94 }
      ];
      const dX = side * 0.74, dY = -0.67;
      const uX = -dY, uY = dX;
      const slRows = [];
      const segs = 10;
      for (let r = 0; r < sRings.length; r++) {
        const sr = sRings[r];
        const row = [];
        for (let j = 0; j < segs; j++) {
          const ang = (j / segs) * Math.PI * 2;
          const cosA = Math.cos(ang);
          const sinA = Math.sin(ang);
          const px = sr.cx + uX * cosA * sr.r;
          const py = sr.cy + uY * cosA * sr.r;
          const pz = sinA * sr.r * 0.95;
          const s = sr.shade - (cosA < 0 ? 0.04 : 0.0);
          row.push(addV(px, py, pz, [s * 0.98, s * 0.985, s]));
        }
        slRows.push(row);
      }
      for (let r = 0; r < slRows.length - 1; r++) {
        for (let j = 0; j < segs; j++) {
          const nextJ = (j + 1) % segs;
          if (side > 0) {
            addQuadCW(slRows[r][j], slRows[r][nextJ], slRows[r + 1][nextJ], slRows[r + 1][j]);
          } else {
            addQuadCW(slRows[r][nextJ], slRows[r][j], slRows[r + 1][j], slRows[r + 1][nextJ]);
          }
        }
      }
      const endC = addV(sRings[2].cx, sRings[2].cy, 0, [0.82, 0.83, 0.88]);
      for (let j = 0; j < segs; j++) {
        const nextJ = (j + 1) % segs;
        if (side > 0) addTriCW(slRows[2][j], slRows[2][nextJ], endC);
        else addTriCW(slRows[2][nextJ], slRows[2][j], endC);
      }
    }
    return baseV;
  }

  function buildWhiteBodysuitShortsIconMesh(rawVertices, rawColors, rawIndices) {
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
    const addTriCW = (i0, i1, i2) => {
      rawIndices.push(i0, i2, i1);
    };

    // 1. High-Waist Pelvis / Hip Body with V-Cut Bodysuit Seam Shading
    const radialSegs = 16;
    const hipRings = [
      { y: -0.02, rx: 0.145, rz: 0.098, h: 0.05 }, // Lower pelvis
      { y:  0.07, rx: 0.172, rz: 0.116, h: 0.18 }, // Full curved hips & glutes
      { y:  0.16, rx: 0.138, rz: 0.094, h: 0.32 }  // Seamless waist join rim
    ];
    const pRows = [];
    for (let r = 0; r < hipRings.length; r++) {
      const lv = hipRings[r];
      const row = [];
      for (let j = 0; j < radialSegs; j++) {
        const ang = (j / radialSegs) * Math.PI * 2;
        const sinA = Math.sin(ang);
        const cosA = Math.cos(ang);
        const targetLatV = 0.25 + ((lv.h - 0.05) / 0.27) * 0.65;
        const isVSeam = (cosA > 0 && Math.abs(Math.abs(sinA) - targetLatV) < 0.14);
        const s = (isVSeam ? 0.89 : 0.98) - Math.abs(sinA) * 0.03;
        row.push(addV(sinA * lv.rx, lv.y, cosA * lv.rz, [s * 0.98, s * 0.985, s]));
      }
      pRows.push(row);
    }
    for (let r = 0; r < pRows.length - 1; r++) {
      for (let j = 0; j < radialSegs; j++) {
        const nextJ = (j + 1) % radialSegs;
        addQuadCW(pRows[r][j], pRows[r][nextJ], pRows[r + 1][nextJ], pRows[r + 1][j]);
      }
    }
    const topC = addV(0, 0.16, 0, [0.84, 0.85, 0.89]);
    const botC = addV(0, -0.04, 0, [0.88, 0.89, 0.93]);
    for (let j = 0; j < radialSegs; j++) {
      const nextJ = (j + 1) % radialSegs;
      addTriCW(pRows[pRows.length - 1][j], pRows[pRows.length - 1][nextJ], topC);
      addTriCW(pRows[0][nextJ], pRows[0][j], botC);
    }

    // 2. Snug Short-Leg Cuffs (Left & Right Thighs)
    for (let side of [-1, 1]) {
      const legSegs = 12;
      const legLevels = [
        { y:  0.01, rx: 0.082, rz: 0.086, shade: 0.96 },
        { y: -0.08, rx: 0.078, rz: 0.082, shade: 0.98 },
        { y: -0.16, rx: 0.075, rz: 0.079, shade: 0.93 }
      ];
      const lRows = [];
      const cx = side * 0.082;
      for (let r = 0; r < legLevels.length; r++) {
        const ll = legLevels[r];
        const row = [];
        for (let j = 0; j < legSegs; j++) {
          const ang = (j / legSegs) * Math.PI * 2;
          const sinA = Math.sin(ang);
          const cosA = Math.cos(ang);
          const s = ll.shade - (sinA * side < 0 ? 0.04 : 0.0);
          row.push(addV(cx + sinA * ll.rx, ll.y, cosA * ll.rz, [s * 0.98, s * 0.985, s]));
        }
        lRows.push(row);
      }
      for (let r = 0; r < lRows.length - 1; r++) {
        for (let j = 0; j < legSegs; j++) {
          const nextJ = (j + 1) % legSegs;
          addQuadCW(lRows[r][nextJ], lRows[r][j], lRows[r + 1][j], lRows[r + 1][nextJ]);
        }
      }
      const legBotC = addV(cx, -0.16, 0, [0.82, 0.83, 0.88]);
      for (let j = 0; j < legSegs; j++) {
        const nextJ = (j + 1) % legSegs;
        addTriCW(lRows[2][nextJ], lRows[2][j], legBotC);
      }
    }
  }

  // Shared icon mesh helper: evaluates the exact Traveler Hoodie diamond shader pattern in JS
  function _fractShader(x) {
    return x - Math.floor(x);
  }
  function _hash12Shader(px, py) {
    let x = _fractShader(px * 0.1031);
    let y = _fractShader(py * 0.1031);
    let z = _fractShader(px * 0.1031);
    const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
    x += d; y += d; z += d;
    return _fractShader((x + y) * z);
  }
  function _hash22Shader(px, py) {
    let x = _fractShader(px * 0.1031);
    let y = _fractShader(py * 0.1030);
    let z = _fractShader(px * 0.0973);
    const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
    x += d; y += d; z += d;
    return [_fractShader((x + x) * z), _fractShader((x + y) * y)];
  }
  function _evalHoodieDiamondMask(cx, cy, cz, tu, tv) {
    if (tu <= -5.0) return 0.0;
    let cellX = 0.0, cellY = 0.0, gvX = 0.0, gvY = 0.0;
    if (tu <= -1.5 && tu >= -3.5) {
      const sU = Math.max(0.0, Math.min(1.0, -2.0 - tu));
      const nSleeveCols = 6.0;
      const rowCoord = tv / 0.056;
      const rowId = Math.floor(rowCoord);
      const mod2 = ((rowId % 2) + 2) % 2;
      const colCoord = sU * nSleeveCols + mod2 * 0.5;
      const colMod = ((Math.floor(colCoord) % nSleeveCols) + nSleeveCols) % nSleeveCols;
      cellX = colMod + 80.0;
      cellY = rowId + 80.0;
      gvX = _fractShader(colCoord) - 0.5;
      gvY = _fractShader(rowCoord) - 0.5;
    } else if (cy >= 0.215) {
      const hAng = Math.atan2(cx, cy - 0.41);
      const hRad = Math.hypot(cx, cy - 0.41);
      const nHoodCols = 10.0;
      const hDepth = (0.32 - cz + (0.30 - hRad) * 0.45) / 0.066;
      const hRowId = Math.floor(hDepth);
      const mod2 = ((hRowId % 2) + 2) % 2;
      const hColCoord = (hAng / 6.2831853 + 0.5) * nHoodCols + mod2 * 0.5;
      const colMod = ((Math.floor(hColCoord) % nHoodCols) + nHoodCols) % nHoodCols;
      cellX = colMod + 50.0;
      cellY = hRowId + 50.0;
      gvX = _fractShader(hColCoord) - 0.5;
      gvY = _fractShader(hDepth) - 0.5;
    } else {
      const cAng = Math.atan2(cx, cz);
      const nCols = 12.0;
      const rowCoord = (0.215 - cy) / 0.068;
      const rowId = Math.floor(rowCoord);
      const mod2 = ((rowId % 2) + 2) % 2;
      const colCoord = (cAng / 6.2831853 + 0.5) * nCols + mod2 * 0.5;
      const colMod = ((Math.floor(colCoord) % nCols) + nCols) % nCols;
      cellX = colMod;
      cellY = rowId;
      gvX = _fractShader(colCoord) - 0.5;
      gvY = _fractShader(rowCoord) - 0.5;
    }
    const j = _hash22Shader(cellX, cellY);
    const rot = 0.52 + (_hash12Shader(cellX + 13.7, cellY + 29.3) - 0.5) * 0.55;
    const px = gvX - (j[0] - 0.5) * 0.16;
    const py = gvY - (j[1] - 0.5) * 0.16;
    const ca = Math.cos(rot);
    const sa = Math.sin(rot);
    const prx = Math.abs(ca * px - sa * py);
    const pry = Math.abs(sa * px + ca * py);
    const sqSize = 0.21 + _hash12Shader(cellX + 41.1, cellY + 19.7) * 0.04;
    const sqDist = prx > pry ? prx : pry;
    const edge0 = sqSize - 0.018;
    const edge1 = sqSize + 0.018;
    const t = Math.max(0.0, Math.min(1.0, (sqDist - edge0) / (edge1 - edge0)));
    const smooth = t * t * (3.0 - 2.0 * t);
    return 1.0 - smooth;
  }

  function _appendCCWMeshAsCWIcon(mesh, rawVertices, rawColors, rawIndices, opts = {}) {
    if (!mesh || !mesh.vertices || !mesh.indices || mesh.indices.length === 0) return;
    const vArr = mesh.vertices;
    const cArr = mesh.colors;
    const iArr = mesh.indices;
    const triLimit = opts.firstHalfOnly ? ((iArr.length / 2) | 0) : iArr.length;
    const triFilter = opts.triFilter || null;
    const colorMap = opts.colorMap || null;
    const baseOutV = (rawVertices.length / 3) | 0;

    // Emit flat-colored triangles with CW winding: (i0, i2, i1) => (v2 - v0) x (v1 - v0) matches CCW outward normal
    for (let k = 0; k + 2 < triLimit; k += 3) {
      const a = iArr[k], b = iArr[k + 1], c = iArr[k + 2];
      if (triFilter && !triFilter(a, b, c, vArr, cArr)) continue;

      const ax = vArr[a * 3], ay = vArr[a * 3 + 1], az = vArr[a * 3 + 2];
      const bx = vArr[b * 3], by = vArr[b * 3 + 1], bz = vArr[b * 3 + 2];
      const cx = vArr[c * 3], cy = vArr[c * 3 + 1], cz = vArr[c * 3 + 2];

      let colR = (cArr[a * 3] + cArr[b * 3] + cArr[c * 3]) / 3.0;
      let colG = (cArr[a * 3 + 1] + cArr[b * 3 + 1] + cArr[c * 3 + 1]) / 3.0;
      let colB = (cArr[a * 3 + 2] + cArr[b * 3 + 2] + cArr[c * 3 + 2]) / 3.0;
      if (colorMap) {
        const mapped = colorMap(colR, colG, colB, (ax + bx + cx) / 3.0, (ay + by + cy) / 3.0, (az + bz + cz) / 3.0);
        colR = mapped[0]; colG = mapped[1]; colB = mapped[2];
      }

      const idx0 = (rawVertices.length / 3) | 0;
      rawVertices.push(ax, ay, az, cx, cy, cz, bx, by, bz);
      rawColors.push(colR, colG, colB, colR, colG, colB, colR, colG, colB);
      rawIndices.push(idx0, idx0 + 1, idx0 + 2);
    }
    return baseOutV;
  }

  function buildTravelerHoodieIconMesh(rawVertices, rawColors, rawIndices) {
    // Use exact standing chibi proportions + open hood (folded behind neck + golden brooch + diamond spots)
    // matching the real worn TRAVELER_HOODIE 1:1
    const hMesh = buildTravelerHoodieCloakMesh(
      [0, 0.336, 0], [0, 0.336, 0],
      [0, -0.090, 0], [0, 0.170, 0],
      [0, 0.162, 0], [0, 0.212, 0],
      [-0.074, 0.124, 0], [-0.116, 0.012, -0.006], [-0.146, -0.095, 0.022],
      [ 0.074, 0.124, 0], [ 0.116, 0.012, -0.006], [ 0.146, -0.095, 0.022],
      1.0,
      0.0,
      false,
      [-0.052, -0.420, 0.0], [0.052, -0.420, 0.0],
      true,
      null
    );
    const vArr = hMesh.vertices;
    const cArr = hMesh.colors;
    const tArr = hMesh.texcoords;
    const iArr = hMesh.indices;
    const halfLen = (iArr.length / 2) | 0;

    const pushTriCW = (p0x, p0y, p0z, p1x, p1y, p1z, p2x, p2y, p2z, r, g, b) => {
      const base = (rawVertices.length / 3) | 0;
      rawVertices.push(p0x, p0y, p0z, p2x, p2y, p2z, p1x, p1y, p1z);
      rawColors.push(r, g, b, r, g, b, r, g, b);
      rawIndices.push(base, base + 1, base + 2);
    };

    for (let k = 0; k + 2 < halfLen; k += 3) {
      const a = iArr[k], b = iArr[k + 1], c = iArr[k + 2];
      const ax = vArr[a * 3], ay = vArr[a * 3 + 1], az = vArr[a * 3 + 2];
      const bx = vArr[b * 3], by = vArr[b * 3 + 1], bz = vArr[b * 3 + 2];
      const cx = vArr[c * 3], cy = vArr[c * 3 + 1], cz = vArr[c * 3 + 2];

      const baseR = (cArr[a * 3] + cArr[b * 3] + cArr[c * 3]) / 3.0;
      const baseG = (cArr[a * 3 + 1] + cArr[b * 3 + 1] + cArr[c * 3 + 1]) / 3.0;
      const baseB = (cArr[a * 3 + 2] + cArr[b * 3 + 2] + cArr[c * 3 + 2]) / 3.0;

      const ua = tArr ? tArr[a * 2] : -9.0, va = tArr ? tArr[a * 2 + 1] : -9.0;
      const ub = tArr ? tArr[b * 2] : -9.0, vb = tArr ? tArr[b * 2 + 1] : -9.0;
      const uc = tArr ? tArr[c * 2] : -9.0, vc = tArr ? tArr[c * 2 + 1] : -9.0;

      // Skip diamond spots on non-cloth (golden brooch) or inner shadow lips (u <= -5)
      if (ua <= -5.0 || ub <= -5.0 || uc <= -5.0) {
        pushTriCW(ax, ay, az, bx, by, bz, cx, cy, cz, baseR, baseG, baseB);
        continue;
      }

      // Adaptive barycentric subdivision so rotated black diamond spots appear crisp inside create3DIconCanvas
      const e1 = Math.hypot(bx - ax, by - ay, bz - az);
      const e2 = Math.hypot(cx - bx, cy - by, cz - bz);
      const e3 = Math.hypot(ax - cx, ay - cy, az - cz);
      const maxE = Math.max(e1, e2, e3);
      const nSub = maxE > 0.055 ? 4 : (maxE > 0.025 ? 3 : 2);
      const invN = 1.0 / nSub;

      for (let i = 0; i < nSub; i++) {
        for (let j = 0; j < nSub - i; j++) {
          const interp = (ii, jj) => {
            const u = ii * invN;
            const v = jj * invN;
            const w = 1.0 - u - v;
            return [
              ax * w + bx * u + cx * v,
              ay * w + by * u + cy * v,
              az * w + bz * u + cz * v,
              ua * w + ub * u + uc * v,
              va * w + vb * u + vc * v
            ];
          };
          const emitSub = (q0, q1, q2) => {
            const mx = (q0[0] + q1[0] + q2[0]) / 3.0;
            const my = (q0[1] + q1[1] + q2[1]) / 3.0;
            const mz = (q0[2] + q1[2] + q2[2]) / 3.0;
            const mu = (q0[3] + q1[3] + q2[3]) / 3.0;
            const mv = (q0[4] + q1[4] + q2[4]) / 3.0;
            const mask = _evalHoodieDiamondMask(mx, my, mz, mu, mv);
            const r = baseR * (1.0 - mask) + 0.08 * mask;
            const g = baseG * (1.0 - mask) + 0.08 * mask;
            const bCol = baseB * (1.0 - mask) + 0.10 * mask;
            pushTriCW(q0[0], q0[1], q0[2], q1[0], q1[1], q1[2], q2[0], q2[1], q2[2], r, g, bCol);
          };

          const v00 = interp(i, j);
          const v10 = interp(i + 1, j);
          const v01 = interp(i, j + 1);
          emitSub(v00, v10, v01);
          if (i + j + 1 < nSub) {
            const v11 = interp(i + 1, j + 1);
            emitSub(v10, v11, v01);
          }
        }
      }
    }
  }

  function buildTravelerBootsIconMesh(rawVertices, rawColors, rawIndices) {
    // Stagger boots cleanly side-by-side in 3/4 view with true shin shaft tilt & readable dark-charcoal highlights
    const bMesh = buildTravelerBootsMesh(
      [-0.058, 0.0, -0.014],
      [ 0.058, 0.0,  0.016],
      1.15,
      {
        leftKneeRot:  [-0.058, 0.175, -0.004],
        rightKneeRot: [ 0.058, 0.175,  0.026]
      }
    );
    _appendCCWMeshAsCWIcon(bMesh, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: false,
      colorMap: (r, g, b) => {
        // Lift dark leather/trim slightly so silhouette, rolled collar trim, and sole contrast clearly on dark UI slots
        if (r > 0.145) return [0.31, 0.325, 0.375]; // Trim rim highlight
        if (r > 0.095) return [0.22, 0.230, 0.270]; // Matte black leather upper
        if (r > 0.052) return [0.11, 0.115, 0.138]; // Outsole
        return [0.075, 0.080, 0.098];               // Inner cuff shadow
      }
    });
  }

  function buildWhiteShirtIconMesh(rawVertices, rawColors, rawIndices) {
    const chestP1 = [0, -0.090, 0];
    const chestP2 = [0,  0.170, 0];
    const neckP1  = [0,  0.162, 0];
    const neckP2  = [0,  0.212, 0];
    const headP1  = [0,  0.336, 0];
    const lPivot  = [-0.074, 0.124, 0];
    const lElbow  = [-0.116, 0.012, -0.006];
    const rPivot  = [ 0.074, 0.124, 0];
    const rElbow  = [ 0.116, 0.012, -0.006];

    const isShirtTri = (a, b, c, vArr, cArr) => {
      // Shirt white & pearl buttons have (b - r >= -0.025); peach skin has (r - b > 0.08)
      const da = cArr[a * 3 + 2] - cArr[a * 3];
      const db = cArr[b * 3 + 2] - cArr[b * 3];
      const dc = cArr[c * 3 + 2] - cArr[c * 3];
      const avgY = (vArr[a * 3 + 1] + vArr[b * 3 + 1] + vArr[c * 3 + 1]) / 3.0;
      return da >= -0.025 && db >= -0.025 && dc >= -0.025 && avgY <= 0.166;
    };

    // 1. Real Sculpted Torso Shirt Body (with V-neck opening, placket & front buttons)
    const torsoMesh = generateChibiTorso(chestP1, chestP2, 0.09, 1.0, false, false, true, false);
    _appendCCWMeshAsCWIcon(torsoMesh, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: false,
      triFilter: isShirtTri
    });

    // 2. Real Sculpted Upper Arm Short Sleeves (Left & Right at natural hang angle)
    const lSleeve = generateChibiUpperArm(lPivot, lElbow, true, 1.0, false, true);
    const rSleeve = generateChibiUpperArm(rPivot, rElbow, false, 1.0, false, true);
    _appendCCWMeshAsCWIcon(lSleeve, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: false,
      triFilter: isShirtTri
    });
    _appendCCWMeshAsCWIcon(rSleeve, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: false,
      triFilter: isShirtTri
    });

    // 3. Real 3D Folded Spread Shirt Collar
    const collarMesh = buildWhiteShirtCollarMesh(headP1, chestP1, chestP2, neckP1, neckP2, 1.0, true);
    _appendCCWMeshAsCWIcon(collarMesh, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: true
    });

    // 4. Clean recessed inner-neck shadow cylinder (prevents floating gap looking down at -0.52 rad)
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
    const colNeckShadow = [0.76, 0.78, 0.84];
    const colHemShadow  = [0.80, 0.82, 0.87];
    const nSeg = 14;
    const nTop = [], nBot = [];
    for (let j = 0; j < nSeg; j++) {
      const ang = (j / nSeg) * Math.PI * 2.0;
      nTop.push(addV(Math.sin(ang) * 0.048, 0.168, Math.cos(ang) * 0.046, colNeckShadow));
      nBot.push(addV(Math.sin(ang) * 0.042, 0.132, Math.cos(ang) * 0.040, colNeckShadow));
    }
    for (let j = 0; j < nSeg; j++) {
      const nextJ = (j + 1) % nSeg;
      // Inward facing wall inside neck aperture
      addQuadCW(nTop[nextJ], nTop[j], nBot[j], nBot[nextJ]);
    }
    // Recessed hem shadow ring tucked strictly inside lower torso opening
    const hOut = [], hIn = [];
    for (let j = 0; j < nSeg; j++) {
      const ang = (j / nSeg) * Math.PI * 2.0;
      hOut.push(addV(Math.sin(ang) * 0.082, -0.026, Math.cos(ang) * 0.056, colHemShadow));
      hIn.push(addV(Math.sin(ang) * 0.064,  0.004, Math.cos(ang) * 0.044, colHemShadow));
    }
    for (let j = 0; j < nSeg; j++) {
      const nextJ = (j + 1) % nSeg;
      addQuadCW(hOut[j], hOut[nextJ], hIn[nextJ], hIn[j]);
    }
  }

  function buildBlackPleatedSkirtIconMesh(rawVertices, rawColors, rawIndices) {
    // Use exact buildBlackPleatedSkirtMesh (18 crisp knife pleats, fitted waistband/yoke, inner hem)
    const sMesh = buildBlackPleatedSkirtMesh(
      [0, 0.336, 0],
      [0, -0.090, 0],
      [0,  0.170, 0],
      1.0,
      0.0,
      null
    );
    _appendCCWMeshAsCWIcon(sMesh, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: true,
      colorMap: (r, g, b) => {
        // Lift black/charcoal pleat ridges cleanly so all 18 knife pleats & waistband read clearly on dark slots
        if (r > 0.145) return [0.265, 0.275, 0.315]; // Crisp outer pleat ridge
        if (r > 0.118) return [0.205, 0.212, 0.245]; // Waistband yoke
        if (r > 0.095) return [0.180, 0.186, 0.215]; // Sloped pleat blade
        if (r > 0.039) return [0.082, 0.086, 0.105]; // Deep pleat fold shadow
        return [0.068, 0.072, 0.088];                // Inner skirt lining
      }
    });
  }

  function buildBlackLeggingsIconMesh(rawVertices, rawColors, rawIndices) {
    // Extract exact sculpted leggings geometry from torso pelvis + thighs + calves
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

    // Subtle hollow inner-waistband rim at top opening (no flat disc poking out)
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

  function buildDoubleBreastedSuitIconMesh(rawVertices, rawColors, rawIndices) {
    const suitMesh = buildDoubleBreastedSuitMesh(
      [0, 0.336, 0],
      [0, -0.090, 0], [0, 0.170, 0],
      [0, 0.162, 0], [0, 0.212, 0],
      [-0.074, 0.124, 0], [-0.116, 0.012, -0.006], [-0.146, -0.095, 0.022],
      [ 0.074, 0.124, 0], [ 0.116, 0.012, -0.006], [ 0.146, -0.095, 0.022],
      1.0,
      0.0,
      false,
      [-0.052, -0.420, 0.0], [0.052, -0.420, 0.0],
      null
    );
    _appendCCWMeshAsCWIcon(suitMesh, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: true,
      colorMap: (r, g, b) => {
        // Keep warm tortoiseshell amber buttons faithful while lifting charcoal pinstripe slightly for crisp inventory slot contrast
        if (r - b > 0.10) return [r, g, b];
        const lift = 1.16;
        return [
          Math.min(0.60, r * lift + 0.02),
          Math.min(0.62, g * lift + 0.02),
          Math.min(0.66, b * lift + 0.025)
        ];
      }
    });
  }

  function buildBlackSlacksIconMesh(rawVertices, rawColors, rawIndices) {
    const slMesh = buildBlackSlacksMesh(
      [0, 0.336, 0],
      [0, -0.090, 0], [0, 0.170, 0],
      [-0.052, -0.068, 0], [-0.052, -0.246, 0.010], [-0.052, -0.420, 0],
      [ 0.052, -0.068, 0], [ 0.052, -0.246, 0.010], [ 0.052, -0.420, 0],
      1.0,
      0.0,
      null
    );
    _appendCCWMeshAsCWIcon(slMesh, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: true,
      colorMap: (r, g, b) => {
        if (r > 0.60) return [r, g, b]; // Preserve crisp white brand tab
        // Match DOUBLE_BREASTED_SUIT icon lift so suit & slacks look identical in the inventory
        const lift = 1.16;
        return [
          Math.min(0.60, r * lift + 0.02),
          Math.min(0.62, g * lift + 0.02),
          Math.min(0.66, b * lift + 0.025)
        ];
      }
    });
  }

  function buildOperaCapeIconMesh(rawVertices, rawColors, rawIndices) {
    const capeMesh = buildOperaCapeMesh(
      [0, 0.336, 0],
      [0, -0.090, 0], [0, 0.170, 0],
      [0, 0.162, 0], [0, 0.212, 0],
      [-0.074, 0.124, 0], [-0.116, 0.012, -0.006], [-0.146, -0.095, 0.022],
      [ 0.074, 0.124, 0], [ 0.116, 0.012, -0.006], [ 0.146, -0.095, 0.022],
      1.0,
      0.0,
      true,
      [-0.052, -0.420, 0], [0.052, -0.420, 0],
      null
    );
    _appendCCWMeshAsCWIcon(capeMesh, rawVertices, rawColors, rawIndices, {
      firstHalfOnly: true,
      colorMap: (r, g, b) => {
        // Preserve bright silver clasp/strap & rich emerald-teal inner lining while lifting velvet black slightly for slot visibility
        if (r > 0.20 || g > 0.10) return [Math.min(0.92, r * 1.15), Math.min(0.94, g * 1.15), Math.min(0.96, b * 1.15)];
        return [r * 1.35 + 0.035, g * 1.35 + 0.038, b * 1.38 + 0.045];
      }
    });
  }

  // =========================================================================
  // --- 12. Chibi / Anime Face Texture Generator (Expressions & Kaomojis) ---
  // =========================================================================
  const CLONE_EMOJI_FACES = [
    "(^_^)",    // Happy smile
    "(o_o)",    // Curious wide-eyed
    "(^o^)",    // Big cheering smile
    "(¬_¬)",    // Sassy side-eye
    "(*_*)",    // Star-struck
    "(•‿•)",    // Sweet gentle smile
    "(^_-)",    // Playful wink
    "(◕‿◕)",    // Big anime sparkle eyes
    "(>_<)",    // Cute scrunched eyes
    "(≧◡≦)",    // Blushing glee
    "(•ω•)",    // Chibi cat mouth
    "(•̀ᴗ•́)",    // Determined hero grin
    "(♥_♥)",    // Heart eyes
    "(^з^)",    // Whistle kiss
    "(UwU)",    // Classic UwU
    "(OwO)",    // Surprised OwO
    "(^人^)",    // Polite thank-you
    "(•_•)",    // Cool stoic look
    "(¬‿¬)",    // Cheeky sly grin
    "(ᵔᴥᵔ)",    // Cute puppy / bear
    "(⌒‿⌒)",    // Serene closed-eyes smile
    "(★‿★)",    // Starry eyes grin
    "(◕ω◕)",    // Shiny chibi kitty
    "(ʘ‿ʘ)",    // Excited round eyes
    "(•ө•)",    // Cute chick face
    "(´∀｀)",    // Cozy happy warmth
    "(✿◠‿◠)",   // Flower maiden smile
    "(¬o¬)",    // Pouting eyebrow
    "(^Д^)",    // Joyful laughing
    "(｡♥‿♥｡)",  // Romantic heart chibi
    "(=^･ω･^=)",// Little kitty with whiskers
    "(•̀o•́)",    // Brave little face
    "( ˘ ³˘)",   // Whistling tune
    "(∩_∩)",    // Shy cute hands up
    "(ﾟヮﾟ)",    // Retro anime happy
    "(~_~)"     // Sleepy cozy
  ];

  const cloneFaceTextureCache = new Map();

  // Standard Embedded SVG Builder for Anime Chibi Faces (Eyes, Eyebrows, Blush & Mouth)
  // Designed on a 512x512 transparent UV canvas mapped onto generateChibiHead's front face plane.
  function buildChibiFaceSvgMarkup(expression = "default") {
    const expr = expression || "default";

    // Common defs: Soft Coral-Pink Cheek Blush + Multi-Stop Golden-Amber Anime Iris Gradient
    const commonDefs = `
      <defs>
        <radialGradient id="chibiBlushGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ff6e91" stop-opacity="0.62"/>
          <stop offset="55%" stop-color="#ff7a9a" stop-opacity="0.30"/>
          <stop offset="100%" stop-color="#ff8da8" stop-opacity="0.0"/>
        </radialGradient>
        <linearGradient id="chibiIrisGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#36190d"/>
          <stop offset="32%" stop-color="#6e3616"/>
          <stop offset="72%" stop-color="#c47324"/>
          <stop offset="100%" stop-color="#f7b73b"/>
        </linearGradient>
        <linearGradient id="chibiScleraShadow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#d8dce8" stop-opacity="0.85"/>
          <stop offset="35%" stop-color="#ffffff" stop-opacity="1.0"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="1.0"/>
        </linearGradient>
        <clipPath id="leftEyeClip">
          <ellipse cx="136" cy="212" rx="52" ry="64"/>
        </clipPath>
        <clipPath id="rightEyeClip">
          <ellipse cx="376" cy="212" rx="52" ry="64"/>
        </clipPath>
      </defs>
    `;

    // Round Puffy Mochi Blush Cheeks (seated on the 3D Nose & Cheek Puff at sinLat = -0.36 -> y = 308)
    const blushLayer = `
      <g id="blush">
        <ellipse cx="88" cy="312" rx="56" ry="30" fill="url(#chibiBlushGrad)"/>
        <ellipse cx="424" cy="312" rx="56" ry="30" fill="url(#chibiBlushGrad)"/>
        <g stroke="#ff5c86" stroke-width="2.8" stroke-linecap="round" opacity="0.48">
          <line x1="72" y1="318" x2="82" y2="304"/>
          <line x1="86" y1="320" x2="96" y2="306"/>
          <line x1="100" y1="318" x2="110" y2="304"/>
          <line x1="402" y1="318" x2="412" y2="304"/>
          <line x1="416" y1="320" x2="426" y2="306"/>
          <line x1="430" y1="318" x2="440" y2="304"/>
        </g>
        <!-- Cute Chibi Nose Accent on the 3D Nose Peak (y = 304) -->
        <path d="M 252 300 Q 256 308 260 300" fill="none" stroke="#6b4432" stroke-width="3.4" stroke-linecap="round" opacity="0.58"/>
      </g>
    `;

    const eyebrowsSvg = `
      <path d="M 84 114 Q 136 96 188 118" fill="none" stroke="#3d2214" stroke-width="9.0" stroke-linecap="round"/>
      <path d="M 324 118 Q 376 96 428 114" fill="none" stroke="#3d2214" stroke-width="9.0" stroke-linecap="round"/>
    `;
    const renderMouthSvg = (topCurveD) => `
      <g id="mouth">
        <path d="${topCurveD}" fill="#c83e5b" stroke="#26110a" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 240 366 Q 256 358 272 366 Q 268 378 256 378 Q 244 378 240 366 Z" fill="#ff8aa1"/>
      </g>
    `;

    if (expr === "blink" || expr === "happy") {
      const isHappy = expr === "happy";
      const eyeY = isHappy ? 208 : 222;
      const archCtrlY = isHappy ? 158 : 252;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
        ${commonDefs}
        ${blushLayer}
        <!-- Eyebrows -->
        ${eyebrowsSvg}
        <!-- Closed / Happy Arched Anime Eyes -->
        <path d="M 80 ${eyeY} Q 136 ${archCtrlY} 192 ${eyeY}" fill="none" stroke="#26130b" stroke-width="12.5" stroke-linecap="round"/>
        <path d="M 70 ${eyeY - 5} L 86 ${eyeY + 3}" fill="none" stroke="#26130b" stroke-width="8" stroke-linecap="round"/>
        <path d="M 320 ${eyeY} Q 376 ${archCtrlY} 432 ${eyeY}" fill="none" stroke="#26130b" stroke-width="12.5" stroke-linecap="round"/>
        <path d="M 442 ${eyeY - 5} L 426 ${eyeY + 3}" fill="none" stroke="#26130b" stroke-width="8" stroke-linecap="round"/>
        <!-- Cute Chibi Mouth -->
        ${renderMouthSvg("M 234 356 Q 256 350 278 356 Q 273 380 256 380 Q 239 380 234 356 Z")}
      </svg>`;
    }

    const renderOpenEyeSvg = (id, clipId, cxSclera, cxIris, catchX, smallCX, glowX0, glowX1, upperLashD, wingD, lowerLashD) => `
      <g id="${id}">
        <g clip-path="url(#${clipId})">
          <ellipse cx="${cxSclera}" cy="212" rx="52" ry="64" fill="url(#chibiScleraShadow)"/>
          <ellipse cx="${cxIris}" cy="216" rx="40" ry="56" fill="url(#chibiIrisGrad)" stroke="#2c140a" stroke-width="4.0"/>
          <path d="M ${glowX0} 240 A 29 30 0 0 0 ${glowX1} 240" fill="none" stroke="#ffe58f" stroke-width="6.5" stroke-linecap="round" opacity="0.90"/>
          <ellipse cx="${cxIris}" cy="218" rx="19" ry="27" fill="#1f0d06"/>
          <ellipse cx="${cxIris - 19}" cy="184" rx="14.5" ry="18.5" transform="rotate(-12 ${cxIris - 19} 184)" fill="#ffffff"/>
          <circle cx="${catchX}" cy="244" r="7.5" fill="#ffffff"/>
          <circle cx="${smallCX}" cy="248" r="4.0" fill="#ffffff" opacity="0.88"/>
        </g>
        <path d="${upperLashD}" fill="none" stroke="#241109" stroke-width="15.0" stroke-linecap="round"/>
        <path d="${wingD}" fill="none" stroke="#241109" stroke-width="8.5" stroke-linecap="round"/>
        <path d="${lowerLashD}" fill="none" stroke="#3d2014" stroke-width="4.2" stroke-linecap="round" opacity="0.78"/>
      </g>
    `;

    // Default Tall Expressive Anime Chibi Eyes + Blush + 3D Mouth
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
      ${commonDefs}
      ${blushLayer}
      ${eyebrowsSvg}
      <path d="M 92 138 Q 136 120 182 140" fill="none" stroke="#5c3624" stroke-width="4.0" stroke-linecap="round" opacity="0.68"/>
      <path d="M 330 140 Q 376 120 420 138" fill="none" stroke="#5c3624" stroke-width="4.0" stroke-linecap="round" opacity="0.68"/>
      ${renderOpenEyeSvg("leftEye", "leftEyeClip", 136, 140, 158, 128, 112, 168, "M 76 196 Q 134 128 194 188", "M 70 184 L 86 194", "M 104 274 Q 136 284 168 272")}
      ${renderOpenEyeSvg("rightEye", "rightEyeClip", 376, 372, 390, 360, 344, 400, "M 318 188 Q 378 128 436 196", "M 442 184 L 426 194", "M 344 272 Q 376 284 408 274")}
      ${renderMouthSvg("M 234 356 Q 245 350 256 354 Q 267 350 278 356 Q 273 380 256 380 Q 239 380 234 356 Z")}
    </svg>`;
  }

  function getChibiSvgFaceTexture(gl, expression = "default") {
    if (!gl) return null;
    const key = `chibi_svg_face_v6_${expression || "default"}`;
    if (cloneFaceTextureCache.has(key)) {
      return cloneFaceTextureCache.get(key);
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Initialize with 1x1 transparent pixel until SVG image rasterizes
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0])
    );

    cloneFaceTextureCache.set(key, tex);

    const svgMarkup = buildChibiFaceSvgMarkup(expression);
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 512, 512);
      ctx.drawImage(img, 0, 0, 512, 512);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgMarkup);

    return tex;
  }

  function getCloneFaceTexture(gl, faceText) {
    if (!gl) return null;
    if (!faceText || faceText === "traveler" || faceText === "svg" || faceText === "chibi" || faceText === "default") {
      return getChibiSvgFaceTexture(gl, "default");
    }
    const key = `kaomoji_512_${faceText}`;
    if (cloneFaceTextureCache.has(key)) {
      return cloneFaceTextureCache.get(key);
    }

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 512, 512);

    const drawCheek = (cx, cy) => {
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 46);
      grad.addColorStop(0, "rgba(255, 110, 145, 0.68)");
      grad.addColorStop(0.55, "rgba(255, 110, 145, 0.32)");
      grad.addColorStop(1, "rgba(255, 110, 145, 0.0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 46, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCheek(108, 304);
    drawCheek(404, 304);

    let fontSize = 80;
    if (faceText.length >= 9) fontSize = 54;
    else if (faceText.length >= 7) fontSize = 64;
    else if (faceText.length >= 5) fontSize = 72;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1e120c";
    ctx.font = "900 " + fontSize + "px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', monospace, 'Courier New', sans-serif";

    const maxTextWidth = 340;
    const measuredWidth = ctx.measureText(faceText).width;
    if (measuredWidth > maxTextWidth && measuredWidth > 0) {
      fontSize = Math.floor(fontSize * (maxTextWidth / measuredWidth));
      ctx.font = "900 " + fontSize + "px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', monospace, 'Courier New', sans-serif";
    }

    ctx.fillText(faceText, 256, 254);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);

    cloneFaceTextureCache.set(key, tex);
    return tex;
  }

  // =========================================================================
  // --- 13. Export to Window & CapsuleModel Unified Character Engine ---
  // =========================================================================
  // Primitives & Core Skeleton
  window.rotatePointX = rotatePointX;
  window.rotatePointY = rotatePointY;
  window.rotatePointZ = rotatePointZ;
  window.generateCapsule = generateCapsule;
  window.generateSculptedCapsule = generateSculptedCapsule;
  window.generateChibiHead = generateChibiHead;
  window.generateChibiNeck = generateChibiNeck;
  window.generateChibiEar = generateChibiEar;
  window.generateChibiTorso = generateChibiTorso;
  window.generateChibiChest = generateChibiChest;
  window.generateChibiPelvis = generateChibiPelvis;
  window.generateChibiUpperArm = generateChibiUpperArm;
  window.generateChibiForeArm = generateChibiForeArm;
  window.generateChibiThigh = generateChibiThigh;
  window.generateChibiCalf = generateChibiCalf;
  window.mergeMeshes = mergeMeshes;
  window.computeSpineHeadRig = computeSpineHeadRig;
  window.computeHandGripFrame = computeHandGripFrame;
  window.computeLegRigFrame = computeLegRigFrame;
  window.computeFullBodyRig = computeFullBodyRig;
  window.buildHandAndFingers = buildHandAndFingers;
  window.buildFootAnkleToes = buildFootAnkleToes;
  window.resetCapsuleBufferPool = resetCapsuleBufferPool;
  window.resetMergeBufferPool = resetMergeBufferPool;
  window.buildCapsuleCharacterSegments = buildCapsuleCharacterSegments;

  // 3D Anime Hairstyles & Head Collision Hull
  window.ANIME_HAIR_COLORS = ANIME_HAIR_COLORS;
  window.NUM_HAIR_STYLES = NUM_HAIR_STYLES;
  window.HAIR_STYLE_NAMES = HAIR_STYLE_NAMES;
  window.clampPointOutsideChibiHead = clampPointOutsideChibiHead;
  window.clampPointOutsideChibiBodyForCloth = clampPointOutsideChibiBodyForCloth;
  window.build3DAnimeHair = build3DAnimeHair;
  window.chibiHairPhysics = chibiHairPhysics;
  window.triggerHairJiggle = triggerHairJiggle;
  window.updateChibiVirtualHair = updateChibiVirtualHair;
  if (window.playerHairStyle === undefined) {
    window.playerHairStyle = 8;
    window.playerHairColor = ANIME_HAIR_COLORS[8];
  }

  // Clothes, Traveler Hoodie & Cloak, and Seamless White Bodysuit
  window.getCharacterEquippedClothingState = getCharacterEquippedClothingState;
  window.chibiHoodiePhysics = chibiHoodiePhysics;
  window.triggerHoodieJiggle = triggerHoodieJiggle;
  window.updateChibiHoodiePhysics = updateChibiHoodiePhysics;
  window.chibiHandState = chibiHandState;
  window.setChibiHandCurl = setChibiHandCurl;
  window.setChibiHandSpread = setChibiHandSpread;
  window.updateChibiHandPose = updateChibiHandPose;
  window.buildTravelerHoodieCloakMesh = buildTravelerHoodieCloakMesh;
  window.buildTravelerBootsMesh = buildTravelerBootsMesh;
  window.buildWhiteShirtCollarMesh = buildWhiteShirtCollarMesh;
  window.buildBlackPleatedSkirtMesh = buildBlackPleatedSkirtMesh;
  window.buildDoubleBreastedSuitMesh = buildDoubleBreastedSuitMesh;
  window.buildBlackSlacksMesh = buildBlackSlacksMesh;
  window.buildOperaCapeMesh = buildOperaCapeMesh;
  window.buildWhiteBodysuitTopIconMesh = buildWhiteBodysuitTopIconMesh;
  window.buildWhiteBodysuitShortsIconMesh = buildWhiteBodysuitShortsIconMesh;
  window.buildTravelerHoodieIconMesh = buildTravelerHoodieIconMesh;
  window.buildTravelerBootsIconMesh = buildTravelerBootsIconMesh;
  window.buildWhiteShirtIconMesh = buildWhiteShirtIconMesh;
  window.buildBlackPleatedSkirtIconMesh = buildBlackPleatedSkirtIconMesh;
  window.buildBlackLeggingsIconMesh = buildBlackLeggingsIconMesh;
  window.buildDoubleBreastedSuitIconMesh = buildDoubleBreastedSuitIconMesh;
  window.buildBlackSlacksIconMesh = buildBlackSlacksIconMesh;
  window.buildOperaCapeIconMesh = buildOperaCapeIconMesh;

  // Face Textures & Expressions
  window.CLONE_EMOJI_FACES = CLONE_EMOJI_FACES;
  window.cloneFaceTextureCache = cloneFaceTextureCache;
  window.buildChibiFaceSvgMarkup = buildChibiFaceSvgMarkup;
  window.getChibiSvgFaceTexture = getChibiSvgFaceTexture;
  window.getCloneFaceTexture = getCloneFaceTexture;

  // Unified Namespace
  window.CapsuleModel = {
    // 3D Math & Primitives
    rotatePointX,
    rotatePointY,
    rotatePointZ,
    generateCapsule,
    generateSculptedCapsule,
    generateChibiHead,
    generateChibiNeck,
    generateChibiEar,
    generateChibiTorso,
    generateChibiChest,
    generateChibiPelvis,
    generateChibiUpperArm,
    generateChibiForeArm,
    generateChibiThigh,
    generateChibiCalf,
    mergeMeshes,
    computeSpineHeadRig,
    computeHandGripFrame,
    computeLegRigFrame,
    computeFullBodyRig,
    buildHandAndFingers,
    buildFootAnkleToes,
    resetCapsuleBufferPool,
    resetMergeBufferPool,
    buildCapsuleCharacterSegments,

    // Hairstyles & Head/Body Collision Hull
    ANIME_HAIR_COLORS,
    NUM_HAIR_STYLES,
    HAIR_STYLE_NAMES,
    clampPointOutsideChibiHead,
    clampPointOutsideChibiBodyForCloth,
    build3DAnimeHair,
    chibiHairPhysics,
    triggerHairJiggle,
    updateChibiVirtualHair,

    // Clothes, Bodysuit & Hoodie
    getCharacterEquippedClothingState,
    createHoodiePhysicsState: _createDefaultHoodiePhysState,
    chibiHoodiePhysics,
    triggerHoodieJiggle,
    updateChibiHoodiePhysics,
    chibiHandState,
    setChibiHandCurl,
    setChibiHandSpread,
    updateChibiHandPose,
    buildTravelerHoodieCloakMesh,
    buildTravelerBootsMesh,
    buildWhiteShirtCollarMesh,
    buildBlackPleatedSkirtMesh,
    buildDoubleBreastedSuitMesh,
    buildBlackSlacksMesh,
    buildOperaCapeMesh,
    buildWhiteBodysuitTopIconMesh,
    buildWhiteBodysuitShortsIconMesh,
    buildTravelerHoodieIconMesh,
    buildTravelerBootsIconMesh,
    buildWhiteShirtIconMesh,
    buildBlackPleatedSkirtIconMesh,
    buildBlackLeggingsIconMesh,
    buildDoubleBreastedSuitIconMesh,
    buildBlackSlacksIconMesh,
    buildOperaCapeIconMesh,

    // Face Textures
    CLONE_EMOJI_FACES,
    cloneFaceTextureCache,
    buildChibiFaceSvgMarkup,
    getChibiSvgFaceTexture,
    getCloneFaceTexture,
  };
})();
