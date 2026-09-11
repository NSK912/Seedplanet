// === SEEDPLANET MODULE: JS/ENVIRONMENT/CAVE.JS ===

(function(global) {
  // WebGL context and capabilities reference
  let _gl = null;
  let _supportUint32 = false;

  // Buffer references
  let tunnelVertexBuffer = null;
  let tunnelColorBuffer = null;
  let tunnelTerrainRadiusBuffer = null;
  let tunnelCenterBuffer = null;
  let tunnelIndexBuffer = null;
  let tunnelWireframeIndexBuffer = null;

  let tunnelShellVertexBuffer = null;
  let tunnelShellTerrainRadiusBuffer = null;
  let tunnelShellCenterBuffer = null;
  let tunnelShellIndexBuffer = null;

  let tunnelIndicesCount = 0;
  let tunnelWireframeIndicesCount = 0;
  let tunnelShellIndicesCount = 0;

  // Spatial Index Grid
  let tunnels3DGrid = null;
  let tunnels3DGridCellSize = 1.5;

  // Reusable Float32Array for shader uniform calculations
  const f32_tunnelsData = new Float32Array(64 * 4);
  const tunnelsWithDistPool = [];

  function buildTunnelsGrid() {
    tunnels3DGrid = new Map();
    const tunnels = global.tunnels3D || [];
    if (!tunnels || tunnels.length === 0) return;
    
    const cellSize = tunnels3DGridCellSize;
    const maxBuffer = 0.5; // safe margin
    for (let i = 0; i < tunnels.length; i++) {
      const t = tunnels[i];
      const maxR = t.r + maxBuffer;
      const minX = Math.floor((t.x - maxR) / cellSize);
      const maxX = Math.floor((t.x + maxR) / cellSize);
      const minY = Math.floor((t.y - maxR) / cellSize);
      const maxY = Math.floor((t.y + maxR) / cellSize);
      const minZ = Math.floor((t.z - maxR) / cellSize);
      const maxZ = Math.floor((t.z + maxR) / cellSize);
      
      for (let ix = minX; ix <= maxX; ix++) {
        for (let iy = minY; iy <= maxY; iy++) {
          for (let iz = minZ; iz <= maxZ; iz++) {
            const key = ix + "," + iy + "," + iz;
            if (!tunnels3DGrid.has(key)) {
              tunnels3DGrid.set(key, []);
            }
            tunnels3DGrid.get(key).push(t);
          }
        }
      }
    }
  }

  function isPositionInsideCave(x, y, z, buffer = 0) {
    const tunnels = global.tunnels3D || [];
    if (!tunnels || tunnels.length === 0) return false;

    if (!tunnels3DGrid) {
      buildTunnelsGrid();
    }

    if (tunnels3DGrid) {
      const cellSize = tunnels3DGridCellSize;
      const ix = Math.floor(x / cellSize);
      const iy = Math.floor(y / cellSize);
      const iz = Math.floor(z / cellSize);
      const key = ix + "," + iy + "," + iz;
      const list = tunnels3DGrid.get(key);
      if (list && list.length > 0) {
        for (let i = 0; i < list.length; i++) {
          const t = list[i];
          const dx = x - t.x;
          const dy = y - t.y;
          const dz = z - t.z;
          const limit = t.r + buffer;
          if (dx * dx + dy * dy + dz * dz < limit * limit) {
            return true;
          }
        }
      }
      return false;
    }

    for (let i = 0; i < tunnels.length; i++) {
      const t = tunnels[i];
      const dx = x - t.x;
      const dy = y - t.y;
      const dz = z - t.z;
      const limit = t.r + buffer;
      if (dx * dx + dy * dy + dz * dz < limit * limit) {
        return true;
      }
    }
    return false;
  }

  function generateSubterraneanCaves(seed) {
    if (!global.tunnels3D) global.tunnels3D = [];
    if (global.tunnels3D.length > 0) return;

    let currentSeed = seed + 48123;
    function sRand() {
      const x = Math.sin(currentSeed++) * 10000;
      return x - Math.floor(x);
    }

    const planetRadius = typeof global.RADIUS !== "undefined" ? global.RADIUS : 8.0;
    const heightScale = typeof global.HEIGHT_SCALE !== "undefined" ? global.HEIGHT_SCALE : (0.6 * Math.pow(planetRadius / 8.0, 0.70));
    const rRatio = Math.max(0.4, planetRadius / 8.0);
    
    // Scale number of caves with planet surface area (from small moons to giant planets)
    const numCaveSystems = Math.min(60, Math.max(3, Math.floor((5 + Math.floor(sRand() * 3)) * Math.pow(rRatio, 1.25))));
    const waterH = typeof global.waterLevel !== "undefined" ? (global.waterLevel * 0.15) : 0.05;

    // Use Fibonacci spiral for uniform spherical distribution around the planet
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    for (let sys = 0; sys < numCaveSystems; sys++) {
      // Human-scale entrance and interior sizes (playable across any planet radius)
      const entranceSize = 0.36 + sRand() * 0.16;
      const interiorSize = 0.46 + sRand() * 0.22;

      const i = sys + 0.5;
      const phi_dist = 2 * Math.PI * i / goldenRatio;
      const cosTheta_dist = 1 - (2 * i) / numCaveSystems;
      const theta_dist = Math.acos(Math.max(-1.0, Math.min(1.0, cosTheta_dist)));

      // Add gentle random angular offset
      const theta = Math.max(0.08, Math.min(Math.PI - 0.08, theta_dist + (sRand() - 0.5) * 0.25));
      const phi = phi_dist + (sRand() - 0.5) * 0.35;

      const nx = Math.sin(theta) * Math.cos(phi);
      const ny = Math.cos(theta);
      const nz = Math.sin(theta) * Math.sin(phi);

      const h = typeof global.getHeightOnSphere === "function" ? global.getHeightOnSphere(theta, phi, seed) : 0.5;
      
      // Ensure cave entrance is generated on dry land / hills (above ocean water level)
      if (h < waterH + 0.03) {
        continue;
      }

      const surfRad = planetRadius + h * heightScale;

      let rx, ry, rz;
      if (Math.abs(ny) < 0.9) {
        rx = -nz; ry = 0; rz = nx;
      } else {
        rx = 1; ry = 0; rz = 0;
      }
      const lenR = Math.sqrt(rx*rx + ry*ry + rz*rz) || 1;
      const tx_u = rx / lenR, ty_u = ry / lenR, tz_u = rz / lenR;

      const bx_u = ty_u * nz - tz_u * ny;
      const by_u = tz_u * nx - tx_u * nz;
      const bz_u = tx_u * ny - ty_u * nx;

      const numSteps = 26 + Math.floor(sRand() * 22);
      const stepDist = 0.15 + sRand() * 0.08;

      let px = nx * (surfRad + 0.02);
      let py = ny * (surfRad + 0.02);
      let pz = nz * (surfRad + 0.02);
      let walkTheta = sRand() * Math.PI * 2;

      for (let step = 0; step < numSteps; step++) {
        const lenP = Math.sqrt(px*px + py*py + pz*pz) || 1;
        const upX = px / lenP;
        const upY = py / lenP;
        const upZ = pz / lenP;

        let r_walk_x, r_walk_y, r_walk_z;
        if (Math.abs(upY) < 0.9) {
          r_walk_x = -upZ; r_walk_y = 0; r_walk_z = upX;
        } else {
          r_walk_x = 1; r_walk_y = 0; r_walk_z = 0;
        }
        const lenW = Math.sqrt(r_walk_x*r_walk_x + r_walk_y*r_walk_y + r_walk_z*r_walk_z) || 1;
        const t_x = r_walk_x / lenW, t_y = r_walk_y / lenW, t_z = r_walk_z / lenW;

        const b_x = t_y * upZ - t_z * upY;
        const b_y = t_z * upX - t_x * upZ;
        const b_z = t_x * upY - t_y * upX;

        walkTheta += (sRand() - 0.5) * 1.1;

        const stepX = t_x * Math.cos(walkTheta) + b_x * Math.sin(walkTheta);
        const stepY = t_y * Math.cos(walkTheta) + b_y * Math.sin(walkTheta);
        const stepZ = t_z * Math.cos(walkTheta) + b_z * Math.sin(walkTheta);
        const targetDepthFraction = step / (numSteps - 1 || 1);
        
        let targetSubDepth;
        if (targetDepthFraction < 0.22) {
            targetSubDepth = 0.02 + (targetDepthFraction / 0.22) * 0.75;
        } else {
            const midFrac = (targetDepthFraction - 0.22) / 0.78;
            targetSubDepth = 0.77 + Math.sin(midFrac * Math.PI) * 0.55;
        }

        const currTheta = Math.acos(Math.max(-1.0, Math.min(1.0, upY)));
        const currPhi = Math.atan2(upZ, upX);
        const currSurfHeight = typeof global.getHeightOnSphere === "function" ? global.getHeightOnSphere(currTheta, currPhi, seed) : 0.5;
        const currSurfRad = planetRadius + currSurfHeight * heightScale;
        const targetRad = Math.max(planetRadius * 0.5, currSurfRad - targetSubDepth);

        let nextPx = px + stepX * stepDist;
        let nextPy = py + stepY * stepDist;
        let nextPz = pz + stepZ * stepDist;
        const nextLen = Math.sqrt(nextPx*nextPx + nextPy*nextPy + nextPz*nextPz) || 1;
        const nextUpX = nextPx / nextLen;
        const nextUpY = nextPy / nextLen;
        const nextUpZ = nextPz / nextLen;

        px = nextUpX * targetRad;
        py = nextUpY * targetRad;
        pz = nextUpZ * targetRad;

        let baseR;
        if (targetDepthFraction < 0.18) {
            const t = targetDepthFraction / 0.18;
            baseR = entranceSize + (interiorSize - entranceSize) * Math.sin(t * Math.PI / 2);
        } else {
            const t = (targetDepthFraction - 0.18) / 0.82;
            baseR = interiorSize - (t * 0.08);
        }
        const mult = (typeof global.voxelHoleRadiusMultiplier === "number") ? global.voxelHoleRadiusMultiplier : 1.0;
        const sphereR = (baseR + (sRand() - 0.5) * 0.06) * mult;

        global.tunnels3D.push({
          x: px,
          y: py,
          z: pz,
          r: sphereR,
          rSq: sphereR * sphereR
        });
      }
    }
    buildTunnelsGrid();
  }

  // Cached unit sphere template
  let _cachedTemplateSeed = null;
  let _cachedUnitTemplate = null;

  function getUnitSphereTemplate(latSeg, longSeg, seed) {
    if (_cachedUnitTemplate && _cachedTemplateSeed === seed && _cachedUnitTemplate.latSeg === latSeg && _cachedUnitTemplate.longSeg === longSeg) {
      return _cachedUnitTemplate;
    }
    const tempVerts = [];
    const tempDeforms = [];
    for (let lat = 0; lat <= latSeg; lat++) {
      const theta = (lat / latSeg) * Math.PI;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      for (let lon = 0; lon <= longSeg; lon++) {
        const phi = (lon / longSeg) * Math.PI * 2;
        const sinP = Math.sin(phi);
        const cosP = Math.cos(phi);
        const x = sinT * cosP;
        const y = cosT;
        const z = sinT * sinP;
        tempVerts.push([x, y, z]);
        const deform = (typeof global.fbmNoise === "function" ? global.fbmNoise(x * 3.5, y * 3.5, z * 3.5, seed + 721, 3) : 0) * 0.15;
        tempDeforms.push(deform);
      }
    }
    _cachedTemplateSeed = seed;
    _cachedUnitTemplate = { tempVerts, tempDeforms, latSeg, longSeg };
    return _cachedUnitTemplate;
  }

  const getCaveStrataColor = (px, py, pz, strataDepth = null) => {
    let depth = strataDepth;
    if (depth === null) {
      const len = Math.sqrt(px*px + py*py + pz*pz) || 1;
      const ux = px / len;
      const uy = py / len;
      const uz = pz / len;
      
      const theta = Math.acos(Math.max(-1, Math.min(1, uy)));
      const phi = Math.atan2(uz, ux);
      const surfHeight = global.getHeightOnSphere(theta, phi, global.globalSeed);
      const surfRad = global.RADIUS + surfHeight * global.HEIGHT_SCALE;
      depth = surfRad - len;
    }

    const warp = global.fbmNoise(px * 1.8, py * 1.8, pz * 1.8, global.globalSeed + 99, 2) * 0.04;
    const warpedDepth = depth + warp;

    const cSoil = [0.24, 0.16, 0.11];
    const cSand = [0.83, 0.70, 0.49];
    const cStone = [0.49, 0.55, 0.57];
    const cDeep  = [0.81, 0.63, 0.57];

    const d1 = 0.08;
    const d2 = 0.13;
    const d3 = 0.22;
    const d4 = 0.28;
    const d5 = 0.42;
    const d6 = 0.48;

    let rVal, gVal, bVal;

    if (warpedDepth <= d1) {
      rVal = cSoil[0]; gVal = cSoil[1]; bVal = cSoil[2];
    } else if (warpedDepth < d2) {
      const t = (warpedDepth - d1) / (d2 - d1);
      const st = t * t * (3 - 2 * t);
      rVal = cSoil[0] * (1 - st) + cSand[0] * st;
      gVal = cSoil[1] * (1 - st) + cSand[1] * st;
      bVal = cSoil[2] * (1 - st) + cSand[2] * st;
    } else if (warpedDepth <= d3) {
      rVal = cSand[0]; gVal = cSand[1]; bVal = cSand[2];
    } else if (warpedDepth < d4) {
      const t = (warpedDepth - d3) / (d4 - d3);
      const st = t * t * (3 - 2 * t);
      rVal = cSand[0] * (1 - st) + cStone[0] * st;
      gVal = cSand[1] * (1 - st) + cStone[1] * st;
      bVal = cSand[2] * (1 - st) + cStone[2] * st;
    } else if (warpedDepth <= d5) {
      rVal = cStone[0]; gVal = cStone[1]; bVal = cStone[2];
    } else {
      const t = Math.max(0, Math.min(1, (warpedDepth - d5) / (d6 - d5)));
      const st = t * t * (3 - 2 * t);
      rVal = cStone[0] * (1 - st) + cDeep[0] * st;
      gVal = cStone[1] * (1 - st) + cDeep[1] * st;
      bVal = cStone[2] * (1 - st) + cDeep[2] * st;
    }

    const grain = (global.fbmNoise(px * 150, py * 150, pz * 150, global.globalSeed + 99, 1) + 1.0) * 0.5;
    const grainFactor = 0.90 + grain * 0.16;

    return [
      Math.max(0.02, Math.min(1.0, rVal * grainFactor)),
      Math.max(0.02, Math.min(1.0, gVal * grainFactor)),
      Math.max(0.02, Math.min(1.0, bVal * grainFactor))
    ];
  };

  function generateSingleTunnelMesh(t, unitTemplate, seed) {
    const cx = t.x;
    const cy = t.y;
    const cz = t.z;
    const r = t.r;

    const tempVerts = unitTemplate.tempVerts;
    const tempDeforms = unitTemplate.tempDeforms;
    const tempVertsCount = tempVerts.length;
    const latSeg = unitTemplate.latSeg;
    const longSeg = unitTemplate.longSeg;

    const verts = new Float32Array(tempVertsCount * 3);
    const cols = new Float32Array(tempVertsCount * 3);
    const rads = new Float32Array(tempVertsCount);
    const cents = new Float32Array(tempVertsCount * 3);
    const isLid = new Uint8Array(tempVertsCount);

    const blendRange = r * 0.45;

    for (let vIdx = 0; vIdx < tempVertsCount; vIdx++) {
      const v = tempVerts[vIdx];
      const deform = tempDeforms[vIdx];
      const deformedR = r * (1.0 + deform);

      let px = cx + v[0] * deformedR;
      let py = cy + v[1] * deformedR;
      let pz = cz + v[2] * deformedR;

      const distToCenter = Math.sqrt(px*px + py*py + pz*pz) || 1;
      const ux = px / distToCenter;
      const uy = py / distToCenter;
      const uz = pz / distToCenter;

      const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
      const phi = Math.atan2(uz, ux);
      const height = global.getHeightOnSphere(theta, phi, seed);
      let terrainRadius = global.RADIUS + height * global.HEIGHT_SCALE;
      if (typeof global.getFloorTopRadiusAt === "function") {
        terrainRadius = global.getFloorTopRadiusAt(ux, uy, uz, terrainRadius);
      }

      const depth = terrainRadius - distToCenter;

      let finalPx = px;
      let finalPy = py;
      let finalPz = pz;
      let finalDistToCenter = distToCenter;

      if (depth <= 0.0) {
        finalPx = ux * terrainRadius;
        finalPy = uy * terrainRadius;
        finalPz = uz * terrainRadius;
        finalDistToCenter = terrainRadius;
      } else if (depth < blendRange) {
        const blendT = depth / blendRange;
        const smooth_t = blendT * blendT * (3 - 2 * blendT);
        const blendedRadius = terrainRadius * (1 - smooth_t) + distToCenter * smooth_t;

        finalPx = ux * blendedRadius;
        finalPy = uy * blendedRadius;
        finalPz = uz * blendedRadius;
        finalDistToCenter = blendedRadius;
      }

      const v3 = vIdx * 3;
      verts[v3] = finalPx;
      verts[v3 + 1] = finalPy;
      verts[v3 + 2] = finalPz;
      isLid[vIdx] = depth <= 0.0 ? 1 : 0;
      rads[vIdx] = terrainRadius;
      cents[v3] = cx;
      cents[v3 + 1] = cy;
      cents[v3 + 2] = cz;

      const shadowFactor = Math.max(0.12, Math.min(1.0, 1.0 - (Math.max(0.0, depth) / (r * 1.5))));
      const { color: terrainColor } = global.getTerrainHeightAndColor(theta, phi, seed);

      const strataDepth = (global.RADIUS + height * global.HEIGHT_SCALE) - finalDistToCenter;
      const caveColor = getCaveStrataColor(finalPx, finalPy, finalPz, strataDepth);

      let colorWeight = 1.0;
      if (depth < blendRange) {
        const c_t = Math.max(0.0, depth / blendRange);
        colorWeight = c_t * c_t * (3 - 2 * c_t);
      }

      const noiseVal = (Math.sin(finalPx*35) * Math.cos(finalPy*35) + Math.cos(finalPz*35)) * 0.04;
      const blendedR = terrainColor[0] * (1 - colorWeight) + caveColor[0] * colorWeight;
      const blendedG = terrainColor[1] * (1 - colorWeight) + caveColor[1] * colorWeight;
      const blendedB = terrainColor[2] * (1 - colorWeight) + caveColor[2] * colorWeight;

      cols[v3] = Math.max(0.02, Math.min(0.8, (blendedR + noiseVal) * shadowFactor));
      cols[v3 + 1] = Math.max(0.02, Math.min(0.8, (blendedG + noiseVal) * shadowFactor));
      cols[v3 + 2] = Math.max(0.02, Math.min(0.8, (blendedB + noiseVal) * shadowFactor));
    }

    const localIndices = [];
    const localCollisionIndices = [];

    for (let lat = 0; lat < latSeg; lat++) {
      for (let lon = 0; lon < longSeg; lon++) {
        const first = lat * (longSeg + 1) + lon;
        const second = first + longSeg + 1;

        localIndices.push(first, first + 1, second);
        localIndices.push(first + 1, second + 1, second);

        if (!isLid[first] || !isLid[second] || !isLid[first + 1]) {
           localCollisionIndices.push(first, first + 1, second);
        }
        if (!isLid[first + 1] || !isLid[second] || !isLid[second + 1]) {
           localCollisionIndices.push(first + 1, second + 1, second);
        }
      }
    }

    // Collar Transition Mesh
    let collarVerts = null;
    let collarColors = null;
    let collarRadii = null;
    let collarCenters = null;
    let collarIndices = null;
    let collarCollisionIndices = null;

    const d = Math.sqrt(cx*cx + cy*cy + cz*cz) || 1;
    const ux = cx / d;
    const uy = cy / d;
    const uz = cz / d;

    const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
    const phi = Math.atan2(uz, ux);
    const height = global.getHeightOnSphere(theta, phi, seed);
    let terrainRadius = global.RADIUS + height * global.HEIGHT_SCALE;
    if (typeof global.getFloorTopRadiusAt === "function") {
      terrainRadius = global.getFloorTopRadiusAt(ux, uy, uz, terrainRadius);
    }

    const depth = terrainRadius - d;
    let exposed = false;
    if (Math.abs(depth) < r * 2.5) exposed = true;

    if (!exposed) {
        const r_sample = r * 1.5;
        const samples = [
            {x: cx + r_sample, y: cy, z: cz},
            {x: cx - r_sample, y: cy, z: cz},
            {x: cx, y: cy + r_sample, z: cz},
            {x: cx, y: cy - r_sample, z: cz},
            {x: cx, y: cy, z: cz + r_sample},
            {x: cx, y: cy, z: cz - r_sample}
        ];
        for (let s of samples) {
            const sd = Math.sqrt(s.x*s.x + s.y*s.y + s.z*s.z) || 1;
            const sux = s.x / sd;
            const suy = s.y / sd;
            const suz = s.z / sd;
            const stheta = Math.acos(Math.max(-1.0, Math.min(1.0, suy)));
            const sphi = Math.atan2(suz, sux);
            let sh = global.RADIUS + global.getHeightOnSphere(stheta, sphi, seed) * global.HEIGHT_SCALE;
            if (typeof global.getFloorTopRadiusAt === "function") sh = global.getFloorTopRadiusAt(sux, suy, suz, sh);
            if (sh < sd || Math.abs(sh - sd) < r * 1.5) {
                exposed = true;
                break;
            }
        }
    }

    if (exposed) {
      const N = 32;
      collarVerts = new Float32Array(2 * N * 3);
      collarColors = new Float32Array(2 * N * 3);
      collarRadii = new Float32Array(2 * N);
      collarCenters = new Float32Array(2 * N * 3);
      collarIndices = new Uint16Array(N * 6);
      collarCollisionIndices = new Uint16Array(N * 6);

      let rx, ry, rz;
      if (Math.abs(uy) < 0.9) {
        rx = -uz; ry = 0; rz = ux;
      } else {
        rx = 1; ry = 0; rz = 0;
      }
      const lenR = Math.sqrt(rx*rx + ry*ry + rz*rz) || 1;
      const rX = rx / lenR;
      const rY = ry / lenR;
      const rZ = rz / lenR;

      const fX = rY * uz - rZ * uy;
      const fY = rZ * ux - rX * uz;
      const fZ = rX * uy - rY * ux;

      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const dx = rX * cosA + fX * sinA;
        const dy = rY * cosA + fY * sinA;
        const dz = rZ * cosA + fZ * sinA;

        const px_outer = cx + dx * (r * 1.08);
        const py_outer = cy + dy * (r * 1.08);
        const pz_outer = cz + dz * (r * 1.08);

        const d_outer = Math.sqrt(px_outer*px_outer + py_outer*py_outer + pz_outer*pz_outer) || 1;
        const ux_outer = px_outer / d_outer;
        const uy_outer = py_outer / d_outer;
        const uz_outer = pz_outer / d_outer;

        const theta_outer = Math.acos(Math.max(-1.0, Math.min(1.0, uy_outer)));
        const phi_outer = Math.atan2(uz_outer, ux_outer);
        const h_outer = global.getHeightOnSphere(theta_outer, phi_outer, seed);
        let r_outer = global.RADIUS + h_outer * global.HEIGHT_SCALE;
        if (typeof global.getFloorTopRadiusAt === "function") {
          r_outer = global.getFloorTopRadiusAt(ux_outer, uy_outer, uz_outer, r_outer);
        }

        const V_outer_x = ux_outer * r_outer;
        const V_outer_y = uy_outer * r_outer;
        const V_outer_z = uz_outer * r_outer;

        const V_inner_x = cx + dx * (r * 0.85) - ux * (r * 0.3);
        const V_inner_y = cy + dy * (r * 0.85) - uy * (r * 0.3);
        const V_inner_z = cz + dz * (r * 0.85) - uz * (r * 0.3);

        const distToCenter_inner = Math.sqrt(V_inner_x*V_inner_x + V_inner_y*V_inner_y + V_inner_z*V_inner_z) || 1;

        const idxOuter = i * 2;
        const idxInner = i * 2 + 1;

        collarVerts[idxOuter * 3] = V_outer_x;
        collarVerts[idxOuter * 3 + 1] = V_outer_y;
        collarVerts[idxOuter * 3 + 2] = V_outer_z;
        collarRadii[idxOuter] = -r_outer;
        collarCenters[idxOuter * 3] = cx;
        collarCenters[idxOuter * 3 + 1] = cy;
        collarCenters[idxOuter * 3 + 2] = cz;

        const { color: terrainColor } = global.getTerrainHeightAndColor(theta_outer, phi_outer, seed);
        collarColors[idxOuter * 3] = terrainColor[0];
        collarColors[idxOuter * 3 + 1] = terrainColor[1];
        collarColors[idxOuter * 3 + 2] = terrainColor[2];

        collarVerts[idxInner * 3] = V_inner_x;
        collarVerts[idxInner * 3 + 1] = V_inner_y;
        collarVerts[idxInner * 3 + 2] = V_inner_z;
        collarRadii[idxInner] = -terrainRadius;
        collarCenters[idxInner * 3] = cx;
        collarCenters[idxInner * 3 + 1] = cy;
        collarCenters[idxInner * 3 + 2] = cz;

        const shadowFactor = Math.max(0.12, Math.min(1.0, 1.0 - (Math.max(0.0, terrainRadius - distToCenter_inner) / (r * 1.5))));
        const innerStrataDepth = (global.RADIUS + h_outer * global.HEIGHT_SCALE) - distToCenter_inner;
        const strataColorInner = getCaveStrataColor(V_inner_x, V_inner_y, V_inner_z, innerStrataDepth);
        const noise = (Math.sin(V_inner_x*35) * Math.cos(V_inner_y*35) + Math.cos(V_inner_z*35)) * 0.04;

        collarColors[idxInner * 3] = Math.max(0.02, Math.min(0.8, (strataColorInner[0] + noise) * shadowFactor));
        collarColors[idxInner * 3 + 1] = Math.max(0.02, Math.min(0.8, (strataColorInner[1] + noise) * shadowFactor));
        collarColors[idxInner * 3 + 2] = Math.max(0.02, Math.min(0.8, (strataColorInner[2] + noise) * shadowFactor));
      }

      let cIdx = 0;
      for (let i = 0; i < N; i++) {
        const next_i = (i + 1) % N;
        const outer_curr = 2 * i;
        const inner_curr = 2 * i + 1;
        const outer_next = 2 * next_i;
        const inner_next = 2 * next_i + 1;

        collarIndices[cIdx] = outer_curr;
        collarIndices[cIdx + 1] = outer_next;
        collarIndices[cIdx + 2] = inner_curr;
        collarIndices[cIdx + 3] = outer_next;
        collarIndices[cIdx + 4] = inner_next;
        collarIndices[cIdx + 5] = inner_curr;

        collarCollisionIndices[cIdx] = outer_curr;
        collarCollisionIndices[cIdx + 1] = outer_next;
        collarCollisionIndices[cIdx + 2] = inner_curr;
        collarCollisionIndices[cIdx + 3] = outer_next;
        collarCollisionIndices[cIdx + 4] = inner_next;
        collarCollisionIndices[cIdx + 5] = inner_curr;

        cIdx += 6;
      }
    }

    // Consolidated main mesh (sphere + collar)
    const collarVertCount = collarVerts ? collarVerts.length / 3 : 0;
    const totalVertsCount = tempVertsCount + collarVertCount;
    const combinedVerts = new Float32Array(totalVertsCount * 3);
    const combinedCols = new Float32Array(totalVertsCount * 3);
    const combinedRads = new Float32Array(totalVertsCount);
    const combinedCents = new Float32Array(totalVertsCount * 3);

    combinedVerts.set(verts, 0);
    combinedCols.set(cols, 0);
    combinedRads.set(rads, 0);
    combinedCents.set(cents, 0);

    const totalIndicesCount = localIndices.length + (collarIndices ? collarIndices.length : 0);
    const combinedIndices = new Uint16Array(totalIndicesCount);
    for (let j = 0; j < localIndices.length; j++) {
      combinedIndices[j] = localIndices[j];
    }
    const totalColIndicesCount = localCollisionIndices.length + (collarCollisionIndices ? collarCollisionIndices.length : 0);
    const combinedCollisionIndices = new Uint16Array(totalColIndicesCount);
    for (let j = 0; j < localCollisionIndices.length; j++) {
      combinedCollisionIndices[j] = localCollisionIndices[j];
    }

    if (collarVerts) {
      combinedVerts.set(collarVerts, tempVertsCount * 3);
      combinedCols.set(collarColors, tempVertsCount * 3);
      combinedRads.set(collarRadii, tempVertsCount);
      combinedCents.set(collarCenters, tempVertsCount * 3);

      const collarOffset = tempVertsCount;
      const baseIdx = localIndices.length;
      for (let j = 0; j < collarIndices.length; j++) {
        combinedIndices[baseIdx + j] = collarIndices[j] + collarOffset;
      }
      const baseColIdx = localCollisionIndices.length;
      for (let j = 0; j < collarCollisionIndices.length; j++) {
        combinedCollisionIndices[baseColIdx + j] = collarCollisionIndices[j] + collarOffset;
      }
    }

    // Shell Geometry
    const shellVerts = new Float32Array(tempVertsCount * 3);
    const shellRads = new Float32Array(tempVertsCount);
    const shellCents = new Float32Array(tempVertsCount * 3);
    const shellR = r * 1.32;

    for (let vIdx = 0; vIdx < tempVertsCount; vIdx++) {
      const v = tempVerts[vIdx];
      const deform = tempDeforms[vIdx];
      const deformedR = shellR * (1.0 + deform);

      let px = cx + v[0] * deformedR;
      let py = cy + v[1] * deformedR;
      let pz = cz + v[2] * deformedR;

      const distToCenter = Math.sqrt(px*px + py*py + pz*pz) || 1;
      const ux = px / distToCenter;
      const uy = py / distToCenter;
      const uz = pz / distToCenter;

      const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
      const phi = Math.atan2(uz, ux);
      const height = global.getHeightOnSphere(theta, phi, seed);
      let terrainRadius = global.RADIUS + height * global.HEIGHT_SCALE;
      if (typeof global.getFloorTopRadiusAt === "function") {
        terrainRadius = global.getFloorTopRadiusAt(ux, uy, uz, terrainRadius);
      }

      const depth = terrainRadius - distToCenter;
      let finalPx = px;
      let finalPy = py;
      let finalPz = pz;
      if (depth <= 0.0) {
        finalPx = ux * terrainRadius;
        finalPy = uy * terrainRadius;
        finalPz = uz * terrainRadius;
      }

      const v3 = vIdx * 3;
      shellVerts[v3] = finalPx;
      shellVerts[v3 + 1] = finalPy;
      shellVerts[v3 + 2] = finalPz;
      shellRads[vIdx] = terrainRadius;
      shellCents[v3] = cx;
      shellCents[v3 + 1] = cy;
      shellCents[v3 + 2] = cz;
    }

    const shellIndices = new Uint16Array(latSeg * longSeg * 6);
    let sIdx = 0;
    for (let lat = 0; lat < latSeg; lat++) {
      for (let lon = 0; lon < longSeg; lon++) {
        const first = lat * (longSeg + 1) + lon;
        const second = first + longSeg + 1;
        shellIndices[sIdx++] = first;
        shellIndices[sIdx++] = second;
        shellIndices[sIdx++] = first + 1;
        shellIndices[sIdx++] = first + 1;
        shellIndices[sIdx++] = second;
        shellIndices[sIdx++] = second + 1;
      }
    }

    return {
      vertCount: totalVertsCount,
      vertices: combinedVerts,
      colors: combinedCols,
      terrainRadii: combinedRads,
      centers: combinedCents,
      indices: combinedIndices,
      collisionIndices: combinedCollisionIndices,
      // Shell
      shellVertCount: tempVertsCount,
      shellVertices: shellVerts,
      shellTerrainRadii: shellRads,
      shellCenters: shellCents,
      shellIndices: shellIndices
    };
  }

  function rebuildTunnelBuffers(gl, supportUint32) {
    const glCtx = gl || _gl || global.gl;
    const uint32Supported = (typeof supportUint32 !== 'undefined') ? supportUint32 : ((typeof _supportUint32 !== 'undefined' ? _supportUint32 : false) || global.supportUint32);

    const tunnels = global.tunnels3D || [];
    if (!tunnels || tunnels.length === 0) {
      tunnelIndicesCount = 0;
      tunnelWireframeIndicesCount = 0;
      tunnelShellIndicesCount = 0;
      global.tunnelRawVertices = [];
      global.tunnelRawIndices = [];
      if (tunnels3DGrid) tunnels3DGrid.clear();
      return;
    }

    const seed = (typeof global.globalSeed !== 'undefined') ? global.globalSeed : 0;
    const latSeg = 14;
    const longSeg = 14;
    const unitTemplate = getUnitSphereTemplate(latSeg, longSeg, seed);

    let totalVertices = 0;
    let totalIndices = 0;
    let totalCollisionIndices = 0;
    let totalShellVertices = 0;
    let totalShellIndices = 0;

    for (let i = 0; i < tunnels.length; i++) {
      const t = tunnels[i];
      if (!t._meshCache) {
        t._meshCache = generateSingleTunnelMesh(t, unitTemplate, seed);
      }
      const mc = t._meshCache;
      totalVertices += mc.vertCount;
      totalIndices += mc.indices.length;
      totalCollisionIndices += mc.collisionIndices.length;
      totalShellVertices += mc.shellVertCount;
      totalShellIndices += mc.shellIndices.length;
    }

    const finalVertices = new Float32Array(totalVertices * 3);
    const finalColors = new Float32Array(totalVertices * 3);
    const finalTerrainRadii = new Float32Array(totalVertices);
    const finalCenters = new Float32Array(totalVertices * 3);
    const useUint32 = uint32Supported && totalIndices > 65535;
    const finalIndices = useUint32 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);
    const finalCollisionIndices = [];

    const finalShellVertices = new Float32Array(totalShellVertices * 3);
    const finalShellTerrainRadii = new Float32Array(totalShellVertices);
    const finalShellCenters = new Float32Array(totalShellVertices * 3);
    const useUint32Shell = uint32Supported && totalShellIndices > 65535;
    const finalShellIndices = useUint32Shell ? new Uint32Array(totalShellIndices) : new Uint16Array(totalShellIndices);

    let vOffset = 0;
    let iOffset = 0;
    let shellVOffset = 0;
    let shellIOffset = 0;

    for (let i = 0; i < tunnels.length; i++) {
      const t = tunnels[i];
      const mc = t._meshCache;

      t.startIndex = iOffset;
      finalVertices.set(mc.vertices, vOffset * 3);
      finalColors.set(mc.colors, vOffset * 3);
      finalTerrainRadii.set(mc.terrainRadii, vOffset);
      finalCenters.set(mc.centers, vOffset * 3);

      const locIdx = mc.indices;
      for (let j = 0; j < locIdx.length; j++) {
        finalIndices[iOffset + j] = locIdx[j] + vOffset;
      }
      iOffset += locIdx.length;

      const locCol = mc.collisionIndices;
      for (let j = 0; j < locCol.length; j++) {
        finalCollisionIndices.push(locCol[j] + vOffset);
      }
      t.endIndex = finalCollisionIndices.length;
      vOffset += mc.vertCount;

      // Shell
      finalShellVertices.set(mc.shellVertices, shellVOffset * 3);
      finalShellTerrainRadii.set(mc.shellTerrainRadii, shellVOffset);
      finalShellCenters.set(mc.shellCenters, shellVOffset * 3);
      const locShellIdx = mc.shellIndices;
      for (let j = 0; j < locShellIdx.length; j++) {
        finalShellIndices[shellIOffset + j] = locShellIdx[j] + shellVOffset;
      }
      shellIOffset += locShellIdx.length;
      shellVOffset += mc.shellVertCount;
    }

    // Wireframe indices (generated efficiently only when needed or if buffer already active)
    let wireframeIndices = null;
    const needWireframe = (tunnelWireframeIndexBuffer !== null) || (global.isDevMode);
    if (needWireframe && totalIndices > 0) {
      const wfUseUint32 = uint32Supported && (totalIndices * 2) > 65535;
      wireframeIndices = wfUseUint32 ? new Uint32Array(totalIndices * 2) : new Uint16Array(totalIndices * 2);
      let wfIdx = 0;
      for (let i = 0; i < totalIndices; i += 3) {
        const i1 = finalIndices[i];
        const i2 = finalIndices[i+1];
        const i3 = finalIndices[i+2];
        wireframeIndices[wfIdx++] = i1;
        wireframeIndices[wfIdx++] = i2;
        wireframeIndices[wfIdx++] = i2;
        wireframeIndices[wfIdx++] = i3;
        wireframeIndices[wfIdx++] = i3;
        wireframeIndices[wfIdx++] = i1;
      }
    }

    if (glCtx) {
      if (!tunnelVertexBuffer) tunnelVertexBuffer = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelVertexBuffer);
      glCtx.bufferData(glCtx.ARRAY_BUFFER, finalVertices, glCtx.STATIC_DRAW);

      if (!tunnelColorBuffer) tunnelColorBuffer = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelColorBuffer);
      glCtx.bufferData(glCtx.ARRAY_BUFFER, finalColors, glCtx.STATIC_DRAW);

      if (!tunnelTerrainRadiusBuffer) tunnelTerrainRadiusBuffer = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelTerrainRadiusBuffer);
      glCtx.bufferData(glCtx.ARRAY_BUFFER, finalTerrainRadii, glCtx.STATIC_DRAW);

      if (!tunnelCenterBuffer) tunnelCenterBuffer = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelCenterBuffer);
      glCtx.bufferData(glCtx.ARRAY_BUFFER, finalCenters, glCtx.STATIC_DRAW);

      if (!tunnelIndexBuffer) tunnelIndexBuffer = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ELEMENT_ARRAY_BUFFER, tunnelIndexBuffer);
      glCtx.bufferData(glCtx.ELEMENT_ARRAY_BUFFER, finalIndices, glCtx.STATIC_DRAW);
      tunnelIndicesCount = finalIndices.length;

      if (wireframeIndices) {
        if (!tunnelWireframeIndexBuffer) tunnelWireframeIndexBuffer = glCtx.createBuffer();
        glCtx.bindBuffer(glCtx.ELEMENT_ARRAY_BUFFER, tunnelWireframeIndexBuffer);
        glCtx.bufferData(glCtx.ELEMENT_ARRAY_BUFFER, wireframeIndices, glCtx.STATIC_DRAW);
        tunnelWireframeIndicesCount = wireframeIndices.length;
      }

      global.tunnelRawVertices = finalVertices;
      global.tunnelRawIndices = finalCollisionIndices;

      if (totalShellIndices > 0) {
        if (!tunnelShellVertexBuffer) tunnelShellVertexBuffer = glCtx.createBuffer();
        glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelShellVertexBuffer);
        glCtx.bufferData(glCtx.ARRAY_BUFFER, finalShellVertices, glCtx.STATIC_DRAW);

        if (!tunnelShellTerrainRadiusBuffer) tunnelShellTerrainRadiusBuffer = glCtx.createBuffer();
        glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelShellTerrainRadiusBuffer);
        glCtx.bufferData(glCtx.ARRAY_BUFFER, finalShellTerrainRadii, glCtx.STATIC_DRAW);

        if (!tunnelShellCenterBuffer) tunnelShellCenterBuffer = glCtx.createBuffer();
        glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelShellCenterBuffer);
        glCtx.bufferData(glCtx.ARRAY_BUFFER, finalShellCenters, glCtx.STATIC_DRAW);

        if (!tunnelShellIndexBuffer) tunnelShellIndexBuffer = glCtx.createBuffer();
        glCtx.bindBuffer(glCtx.ELEMENT_ARRAY_BUFFER, tunnelShellIndexBuffer);
        glCtx.bufferData(glCtx.ELEMENT_ARRAY_BUFFER, finalShellIndices, glCtx.STATIC_DRAW);
        tunnelShellIndicesCount = finalShellIndices.length;
      }
    }

    buildTunnelsGrid();
  }

  // --- CaveSystem API Object ---
  const CaveSystem = {
    init: function(gl, supportUint32) {
      _gl = gl;
      _supportUint32 = supportUint32;
    },

    rebuildBuffers: function(gl, supportUint32) {
      rebuildTunnelBuffers(gl || _gl, supportUint32 || _supportUint32);
    },

    getTunnelUniformsData: function(eyePos) {
      f32_tunnelsData.fill(0);
      let count = 0;
      const tunnels = global.tunnels3D || [];
      if (tunnels && tunnels.length > 0) {
        const tLen = tunnels.length;
        if (tLen <= 64) {
          count = tLen;
          for (let i = 0; i < count; i++) {
            const t = tunnels[i];
            const base = i * 4;
            f32_tunnelsData[base] = t.x;
            f32_tunnelsData[base + 1] = t.y;
            f32_tunnelsData[base + 2] = t.z;
            f32_tunnelsData[base + 3] = t.r;
          }
        } else {
          while (tunnelsWithDistPool.length < tLen) {
            tunnelsWithDistPool.push({ t: null, distSq: 0 });
          }
          for (let i = 0; i < tLen; i++) {
            const t = tunnels[i];
            const dx = t.x - eyePos[0];
            const dy = t.y - eyePos[1];
            const dz = t.z - eyePos[2];
            const item = tunnelsWithDistPool[i];
            item.t = t;
            item.distSq = dx*dx + dy*dy + dz*dz;
          }
          tunnelsWithDistPool.length = tLen;
          tunnelsWithDistPool.sort((a, b) => a.distSq - b.distSq);
          count = 64;
          for (let i = 0; i < count; i++) {
            const t = tunnelsWithDistPool[i].t;
            const base = i * 4;
            f32_tunnelsData[base] = t.x;
            f32_tunnelsData[base + 1] = t.y;
            f32_tunnelsData[base + 2] = t.z;
            f32_tunnelsData[base + 3] = t.r;
          }
        }
      }
      return { tunnelsData: f32_tunnelsData, count: count };
    },

    drawCave: function(gl, locations) {
      if (!tunnelIndicesCount || !tunnelVertexBuffer || !tunnelColorBuffer || !tunnelIndexBuffer) {
        return;
      }

      const positionLoc = locations.positionLoc;
      const colorLoc = locations.colorLoc;
      const isTunnelMeshLoc = locations.isTunnelMeshLoc;
      const terrainRadiusAttrLoc = locations.terrainRadiusAttrLoc;
      const tunnelCenterAttrLoc = locations.tunnelCenterAttrLoc;
      const useUint32 = locations.supportUint32 && tunnelIndicesCount > 65535;

      gl.disable(gl.CULL_FACE);

      if (isTunnelMeshLoc) gl.uniform1f(isTunnelMeshLoc, 1.0);

      if (terrainRadiusAttrLoc !== -1 && tunnelTerrainRadiusBuffer) {
        gl.enableVertexAttribArray(terrainRadiusAttrLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, tunnelTerrainRadiusBuffer);
        gl.vertexAttribPointer(terrainRadiusAttrLoc, 1, gl.FLOAT, false, 0, 0);
      }

      if (tunnelCenterAttrLoc !== -1 && tunnelCenterBuffer) {
        gl.enableVertexAttribArray(tunnelCenterAttrLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, tunnelCenterBuffer);
        gl.vertexAttribPointer(tunnelCenterAttrLoc, 3, gl.FLOAT, false, 0, 0);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, tunnelVertexBuffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, tunnelColorBuffer);
      gl.enableVertexAttribArray(colorLoc);
      gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tunnelIndexBuffer);
      gl.drawElements(gl.TRIANGLES, tunnelIndicesCount, useUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);

      // Restore
      gl.cullFace(gl.BACK);
      if (terrainRadiusAttrLoc !== -1) {
        gl.disableVertexAttribArray(terrainRadiusAttrLoc);
        gl.vertexAttrib1f(terrainRadiusAttrLoc, 99999.0);
      }
      if (tunnelCenterAttrLoc !== -1) {
        gl.disableVertexAttribArray(tunnelCenterAttrLoc);
        gl.vertexAttrib3f(tunnelCenterAttrLoc, 0.0, 0.0, 0.0);
      }

      gl.disable(gl.CULL_FACE);
    },

    drawWireframe: function(gl, locations) {
      if (!tunnelWireframeIndexBuffer || !tunnelWireframeIndicesCount) {
        return;
      }

      const positionLoc = locations.positionLoc;
      const colorLoc = locations.colorLoc;
      const isTunnelMeshLoc = locations.isTunnelMeshLoc;
      const terrainRadiusAttrLoc = locations.terrainRadiusAttrLoc;
      const tunnelCenterAttrLoc = locations.tunnelCenterAttrLoc;
      const useUint32 = locations.supportUint32 && tunnelWireframeIndicesCount > 65535;

      if (isTunnelMeshLoc) gl.uniform1f(isTunnelMeshLoc, 1.0);

      if (terrainRadiusAttrLoc !== -1 && tunnelTerrainRadiusBuffer) {
        gl.enableVertexAttribArray(terrainRadiusAttrLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, tunnelTerrainRadiusBuffer);
        gl.vertexAttribPointer(terrainRadiusAttrLoc, 1, gl.FLOAT, false, 0, 0);
      }
      if (tunnelCenterAttrLoc !== -1 && tunnelCenterBuffer) {
        gl.enableVertexAttribArray(tunnelCenterAttrLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, tunnelCenterBuffer);
        gl.vertexAttribPointer(tunnelCenterAttrLoc, 3, gl.FLOAT, false, 0, 0);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, tunnelVertexBuffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

      gl.disableVertexAttribArray(colorLoc);
      gl.vertexAttrib3f(colorLoc, 1.0, 0.4, 0.4);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tunnelWireframeIndexBuffer);
      gl.drawElements(gl.LINES, tunnelWireframeIndicesCount, useUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);

      if (terrainRadiusAttrLoc !== -1) {
        gl.disableVertexAttribArray(terrainRadiusAttrLoc);
      }
      if (tunnelCenterAttrLoc !== -1) {
        gl.disableVertexAttribArray(tunnelCenterAttrLoc);
        gl.vertexAttrib3f(tunnelCenterAttrLoc, 0.0, 0.0, 0.0);
      }
      if (isTunnelMeshLoc) gl.uniform1f(isTunnelMeshLoc, 0.0);
    }
  };

  // Export to Global window
  global.CaveSystem = CaveSystem;
  global.buildTunnelsGrid = buildTunnelsGrid;
  global.isPositionInsideCave = isPositionInsideCave;
  global.generateSubterraneanCaves = generateSubterraneanCaves;
  global.rebuildTunnelBuffers = rebuildTunnelBuffers;

})(typeof window !== 'undefined' ? window : this);
