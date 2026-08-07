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

    const dist = Math.sqrt(x*x + y*y + z*z);
    if (dist > 0.001) {
      const ux = x / dist;
      const uy = y / dist;
      const uz = z / dist;
      const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
      const phi = Math.atan2(uz, ux);
      
      let h = 0;
      if (typeof global.getHeightOnSphere === "function") {
        const seed = typeof global.globalSeed !== "undefined" ? global.globalSeed : 0;
        h = global.getHeightOnSphere(theta, phi, seed);
      }
      const r_planet = typeof global.RADIUS !== "undefined" ? global.RADIUS : 8.0;
      const h_scale = typeof global.HEIGHT_SCALE !== "undefined" ? global.HEIGHT_SCALE : 0.6;
      const terrainRadius = r_planet + h * h_scale;
      
      if (dist > terrainRadius + 1.0) {
        return false;
      }
    }

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
      if (list) {
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

    const areaScale = (global.RADIUS / 8.0) ** 2;
    const numCaveSystems = Math.floor((6 + Math.floor(sRand() * 5)) * areaScale);
    for (let sys = 0; sys < numCaveSystems; sys++) {
      const entranceSize = 0.05 + sRand() * 0.12;
      const interiorSize = 0.25 + sRand() * 0.2;

      const theta = Math.acos(2 * sRand() - 1);
      const phi = 2 * Math.PI * sRand();

      const nx = Math.sin(theta) * Math.cos(phi);
      const ny = Math.cos(theta);
      const nz = Math.sin(theta) * Math.sin(phi);

      const h = global.getHeightOnSphere(theta, phi, seed);
      const surfRad = global.RADIUS + h * global.HEIGHT_SCALE;

      let currentRad = surfRad + 0.05;
      let tx = nx * currentRad;
      let ty = ny * currentRad;
      let tz = nz * currentRad;

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

      const numSteps = 25 + Math.floor(sRand() * 20);
      const stepSize = 0.08 + sRand() * 0.06;

      let px = tx, py = ty, pz = tz;
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

        walkTheta += (sRand() - 0.5) * 1.2;

        const stepX = t_x * Math.cos(walkTheta) + b_x * Math.sin(walkTheta);
        const stepY = t_y * Math.cos(walkTheta) + b_y * Math.sin(walkTheta);
        const stepZ = t_z * Math.cos(walkTheta) + b_z * Math.sin(walkTheta);
        const targetDepthFraction = step / numSteps;
        
        let targetSubDepth;
        if (targetDepthFraction < 0.2) {
            targetSubDepth = 0.04 + (targetDepthFraction / 0.2) * 1.0;
        } else {
            targetSubDepth = 1.04 + ((targetDepthFraction - 0.2) / 0.8) * 0.5;
        }

        const currSurfHeight = global.getHeightOnSphere(Math.acos(Math.max(-1, Math.min(1, upY))), Math.atan2(upZ, upX), seed);
        const currSurfRad = global.RADIUS + currSurfHeight * global.HEIGHT_SCALE;
        const targetRad = currSurfRad - targetSubDepth;

        let nextPx = px + stepX * stepSize;
        let nextPy = py + stepY * stepSize;
        let nextPz = pz + stepZ * stepSize;
        const nextLen = Math.sqrt(nextPx*nextPx + nextPy*nextPy + nextPz*nextPz) || 1;
        const nextUpX = nextPx / nextLen;
        const nextUpY = nextPy / nextLen;
        const nextUpZ = nextPz / nextLen;

        px = nextUpX * targetRad;
        py = nextUpY * targetRad;
        pz = nextUpZ * targetRad;

        let baseR;
        if (targetDepthFraction < 0.15) {
            const t = targetDepthFraction / 0.15;
            baseR = entranceSize + (interiorSize - entranceSize) * Math.sin(t * Math.PI / 2);
        } else {
            const t = (targetDepthFraction - 0.15) / 0.85;
            baseR = interiorSize - (t * 0.15);
        }
        const mult = (typeof global.voxelHoleRadiusMultiplier === "number") ? (global.voxelHoleRadiusMultiplier * 0.6) : 0.8;
        const sphereR = (baseR + sRand() * 0.04) * mult;

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

  function rebuildTunnelBuffers(gl, supportUint32) {
    const glCtx = gl || _gl || global.gl;
    const uint32Supported = (typeof supportUint32 !== 'undefined') ? supportUint32 : ((typeof _supportUint32 !== 'undefined' ? _supportUint32 : false) || global.supportUint32);

    const tunnels = global.tunnels3D || [];
    if (!tunnels || tunnels.length === 0) {
      tunnelIndicesCount = 0;
      return;
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
    
    const vertices = [];
    const colors = [];
    const terrainRadii = [];
    const centers = [];
    const indices = [];
    const collisionIndices = [];
    const isLidVertex = [];
    
    const shellVertices = [];
    const shellTerrainRadii = [];
    const shellCenters = [];
    const shellIndices = [];
    
    const latSeg = 14;
    const longSeg = 14;
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
        
        const deform = global.fbmNoise(x * 3.5, y * 3.5, z * 3.5, global.globalSeed + 721, 3) * 0.15;
        tempDeforms.push(deform);
      }
    }
    
    let vertexOffset = 0;
    
    for (let t of tunnels) {
      t.startIndex = indices.length;
      
      const cx = t.x;
      const cy = t.y;
      const cz = t.z;
      const r = t.r;
      
      let tempVertsCount = tempVerts.length;
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
        const height = global.getHeightOnSphere(theta, phi, global.globalSeed);
        let terrainRadius = global.RADIUS + height * global.HEIGHT_SCALE;
        if (typeof global.getFloorTopRadiusAt === "function") {
          terrainRadius = global.getFloorTopRadiusAt(ux, uy, uz, terrainRadius);
        }
        
        const depth = terrainRadius - distToCenter;
        const blendRange = r * 0.45;
        
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
        
        vertices.push(finalPx, finalPy, finalPz);
        isLidVertex.push(depth <= 0.0);
        terrainRadii.push(terrainRadius);
        centers.push(cx, cy, cz);
        
        const shadowFactor = Math.max(0.12, Math.min(1.0, 1.0 - (Math.max(0.0, depth) / (r * 1.5))));
        const { color: terrainColor } = global.getTerrainHeightAndColor(theta, phi, global.globalSeed);
        
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
        
        colors.push(
          Math.max(0.02, Math.min(0.8, (blendedR + noiseVal) * shadowFactor)),
          Math.max(0.02, Math.min(0.8, (blendedG + noiseVal) * shadowFactor)),
          Math.max(0.02, Math.min(0.8, (blendedB + noiseVal) * shadowFactor))
        );
      }
      
      for (let lat = 0; lat < latSeg; lat++) {
        for (let lon = 0; lon < longSeg; lon++) {
          const first = vertexOffset + lat * (longSeg + 1) + lon;
          const second = first + longSeg + 1;
          
          indices.push(first, first + 1, second);
          indices.push(first + 1, second + 1, second);
          
          if (!isLidVertex[first] || !isLidVertex[second] || !isLidVertex[first + 1]) {
             collisionIndices.push(first, first + 1, second);
          }
          if (!isLidVertex[first + 1] || !isLidVertex[second] || !isLidVertex[second + 1]) {
             collisionIndices.push(first + 1, second + 1, second);
          }
        }
      }
      
      t.endIndex = collisionIndices.length;
      vertexOffset += tempVerts.length;
    }
    
    // Collar Transition Mesh
    if (tunnels && tunnels.length > 0) {
      const N = 32;
      for (let t of tunnels) {
        const d = Math.sqrt(t.x*t.x + t.y*t.y + t.z*t.z) || 1;
        const ux = t.x / d;
        const uy = t.y / d;
        const uz = t.z / d;
        
        const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
        const phi = Math.atan2(uz, ux);
        const height = global.getHeightOnSphere(theta, phi, global.globalSeed);
        let terrainRadius = global.RADIUS + height * global.HEIGHT_SCALE;
        if (typeof global.getFloorTopRadiusAt === "function") {
          terrainRadius = global.getFloorTopRadiusAt(ux, uy, uz, terrainRadius);
        }
        
        const depth = terrainRadius - d;
        if (Math.abs(depth) < t.r * 1.2) {
          const collarStartIdx = vertexOffset;
          
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
            
            const px_outer = t.x + dx * (t.r * 1.08);
            const py_outer = t.y + dy * (t.r * 1.08);
            const pz_outer = t.z + dz * (t.r * 1.08);
            
            const d_outer = Math.sqrt(px_outer*px_outer + py_outer*py_outer + pz_outer*pz_outer) || 1;
            const ux_outer = px_outer / d_outer;
            const uy_outer = py_outer / d_outer;
            const uz_outer = pz_outer / d_outer;
            
            const theta_outer = Math.acos(Math.max(-1.0, Math.min(1.0, uy_outer)));
            const phi_outer = Math.atan2(uz_outer, ux_outer);
            const h_outer = global.getHeightOnSphere(theta_outer, phi_outer, global.globalSeed);
            let r_outer = global.RADIUS + h_outer * global.HEIGHT_SCALE;
            if (typeof global.getFloorTopRadiusAt === "function") {
              r_outer = global.getFloorTopRadiusAt(ux_outer, uy_outer, uz_outer, r_outer);
            }
            
            const V_outer_x = ux_outer * r_outer;
            const V_outer_y = uy_outer * r_outer;
            const V_outer_z = uz_outer * r_outer;
            
            const V_inner_x = t.x + dx * (t.r * 0.85) - ux * (t.r * 0.3);
            const V_inner_y = t.y + dy * (t.r * 0.85) - uy * (t.r * 0.3);
            const V_inner_z = t.z + dz * (t.r * 0.85) - uz * (t.r * 0.3);
            
            const distToCenter_inner = Math.sqrt(V_inner_x*V_inner_x + V_inner_y*V_inner_y + V_inner_z*V_inner_z) || 1;
            
            vertices.push(V_outer_x, V_outer_y, V_outer_z);
            terrainRadii.push(-r_outer);
            centers.push(t.x, t.y, t.z);
            
            const { color: terrainColor } = global.getTerrainHeightAndColor(theta_outer, phi_outer, global.globalSeed);
            colors.push(terrainColor[0], terrainColor[1], terrainColor[2]);
            
            vertices.push(V_inner_x, V_inner_y, V_inner_z);
            terrainRadii.push(-terrainRadius);
            centers.push(t.x, t.y, t.z);
            
            const shadowFactor = Math.max(0.12, Math.min(1.0, 1.0 - (Math.max(0.0, terrainRadius - distToCenter_inner) / (t.r * 1.5))));
            const innerStrataDepth = (global.RADIUS + h_outer * global.HEIGHT_SCALE) - distToCenter_inner;
            const strataColorInner = getCaveStrataColor(V_inner_x, V_inner_y, V_inner_z, innerStrataDepth);
            const noise = (Math.sin(V_inner_x*35) * Math.cos(V_inner_y*35) + Math.cos(V_inner_z*35)) * 0.04;
            colors.push(
              Math.max(0.02, Math.min(0.8, (strataColorInner[0] + noise) * shadowFactor)),
              Math.max(0.02, Math.min(0.8, (strataColorInner[1] + noise) * shadowFactor)),
              Math.max(0.02, Math.min(0.8, (strataColorInner[2] + noise) * shadowFactor))
            );
          }
          
          for (let i = 0; i < N; i++) {
            const next_i = (i + 1) % N;
            
            const outer_curr = collarStartIdx + 2 * i;
            const inner_curr = collarStartIdx + 2 * i + 1;
            const outer_next = collarStartIdx + 2 * next_i;
            const inner_next = collarStartIdx + 2 * next_i + 1;
            
            indices.push(outer_curr, outer_next, inner_curr);
            indices.push(outer_next, inner_next, inner_curr);
            collisionIndices.push(outer_curr, outer_next, inner_curr);
            collisionIndices.push(outer_next, inner_next, inner_curr);
          }
          
          vertexOffset += 2 * N;
        }
      }
    }
    
    // Generate Shell Geometry
    let shellVertexOffset = 0;
    let tempVertsCountShell = tempVerts.length;
    for (let t of tunnels) {
      const cx = t.x;
      const cy = t.y;
      const cz = t.z;
      const r = t.r * 1.32;
      
      for (let vIdx = 0; vIdx < tempVertsCountShell; vIdx++) {
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
        const height = global.getHeightOnSphere(theta, phi, global.globalSeed);
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

        shellVertices.push(finalPx, finalPy, finalPz);
        shellTerrainRadii.push(terrainRadius);
        shellCenters.push(cx, cy, cz);
      }
      
      for (let lat = 0; lat < latSeg; lat++) {
        for (let lon = 0; lon < longSeg; lon++) {
          const first = shellVertexOffset + lat * (longSeg + 1) + lon;
          const second = first + longSeg + 1;
          
          shellIndices.push(first, second, first + 1);
          shellIndices.push(first + 1, second, second + 1);
        }
      }
      
      shellVertexOffset += tempVerts.length;
    }
    
    if (glCtx) {
      if (tunnelVertexBuffer) glCtx.deleteBuffer(tunnelVertexBuffer);
      if (tunnelColorBuffer) glCtx.deleteBuffer(tunnelColorBuffer);
      if (tunnelTerrainRadiusBuffer) glCtx.deleteBuffer(tunnelTerrainRadiusBuffer);
      if (tunnelCenterBuffer) glCtx.deleteBuffer(tunnelCenterBuffer);
      if (tunnelIndexBuffer) glCtx.deleteBuffer(tunnelIndexBuffer);
      if (tunnelWireframeIndexBuffer) glCtx.deleteBuffer(tunnelWireframeIndexBuffer);
      
      tunnelVertexBuffer = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelVertexBuffer);
      glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array(vertices), glCtx.STATIC_DRAW);
      
      tunnelColorBuffer = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelColorBuffer);
      glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array(colors), glCtx.STATIC_DRAW);
      
      tunnelTerrainRadiusBuffer = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelTerrainRadiusBuffer);
      glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array(terrainRadii), glCtx.STATIC_DRAW);
      
      tunnelCenterBuffer = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelCenterBuffer);
      glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array(centers), glCtx.STATIC_DRAW);
      
      const useUint32 = uint32Supported && indices.length > 65535;
      tunnelIndexBuffer = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ELEMENT_ARRAY_BUFFER, tunnelIndexBuffer);
      glCtx.bufferData(
        glCtx.ELEMENT_ARRAY_BUFFER,
        useUint32 ? new Uint32Array(indices) : new Uint16Array(indices),
        glCtx.STATIC_DRAW
      );
      
      tunnelIndicesCount = indices.length;

      const wireframeIndices = [];
      for (let i = 0; i < indices.length; i += 3) {
        const i1 = indices[i];
        const i2 = indices[i+1];
        const i3 = indices[i+2];
        wireframeIndices.push(i1, i2, i2, i3, i3, i1);
      }

      tunnelWireframeIndexBuffer = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ELEMENT_ARRAY_BUFFER, tunnelWireframeIndexBuffer);
      glCtx.bufferData(
        glCtx.ELEMENT_ARRAY_BUFFER,
        useUint32 ? new Uint32Array(wireframeIndices) : new Uint16Array(wireframeIndices),
        glCtx.STATIC_DRAW
      );
      tunnelWireframeIndicesCount = wireframeIndices.length;
      
      global.tunnelRawVertices = vertices;
      global.tunnelRawIndices = collisionIndices;
      
      if (shellIndices.length > 0) {
        if (tunnelShellVertexBuffer) glCtx.deleteBuffer(tunnelShellVertexBuffer);
        if (tunnelShellTerrainRadiusBuffer) glCtx.deleteBuffer(tunnelShellTerrainRadiusBuffer);
        if (tunnelShellCenterBuffer) glCtx.deleteBuffer(tunnelShellCenterBuffer);
        if (tunnelShellIndexBuffer) glCtx.deleteBuffer(tunnelShellIndexBuffer);

        tunnelShellVertexBuffer = glCtx.createBuffer();
        glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelShellVertexBuffer);
        glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array(shellVertices), glCtx.STATIC_DRAW);

        tunnelShellTerrainRadiusBuffer = glCtx.createBuffer();
        glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelShellTerrainRadiusBuffer);
        glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array(shellTerrainRadii), glCtx.STATIC_DRAW);

        tunnelShellCenterBuffer = glCtx.createBuffer();
        glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelShellCenterBuffer);
        glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array(shellCenters), glCtx.STATIC_DRAW);

        tunnelShellIndexBuffer = glCtx.createBuffer();
        glCtx.bindBuffer(glCtx.ELEMENT_ARRAY_BUFFER, tunnelShellIndexBuffer);
        const useUint32Shell = uint32Supported && shellVertices.length / 3 > 65535;
        glCtx.bufferData(
          glCtx.ELEMENT_ARRAY_BUFFER,
          useUint32Shell ? new Uint32Array(shellIndices) : new Uint16Array(shellIndices),
          glCtx.STATIC_DRAW
        );
        tunnelShellIndicesCount = shellIndices.length;
      }
    }
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
        tunnelsWithDistPool.length = 0;
        for (let i = 0; i < tunnels.length; i++) {
          const t = tunnels[i];
          const dx = t.x - eyePos[0];
          const dy = t.y - eyePos[1];
          const dz = t.z - eyePos[2];
          const distSq = dx*dx + dy*dy + dz*dz;
          tunnelsWithDistPool.push({ t: t, distSq: distSq });
        }
        tunnelsWithDistPool.sort((a, b) => a.distSq - b.distSq);
        count = Math.min(64, tunnelsWithDistPool.length);
        for (let i = 0; i < count; i++) {
          const t = tunnelsWithDistPool[i].t;
          f32_tunnelsData[i * 4 + 0] = t.x;
          f32_tunnelsData[i * 4 + 1] = t.y;
          f32_tunnelsData[i * 4 + 2] = t.z;
          f32_tunnelsData[i * 4 + 3] = t.r;
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

      gl.enable(gl.CULL_FACE);
      gl.frontFace(gl.CCW);
      gl.cullFace(gl.BACK);

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

      // Outer Black Shell Pass
      if (tunnelShellIndicesCount > 0 && tunnelShellVertexBuffer && tunnelShellIndexBuffer) {
        gl.cullFace(gl.BACK);
        if (isTunnelMeshLoc) gl.uniform1f(isTunnelMeshLoc, 2.0);

        if (terrainRadiusAttrLoc !== -1 && tunnelShellTerrainRadiusBuffer) {
          gl.bindBuffer(gl.ARRAY_BUFFER, tunnelShellTerrainRadiusBuffer);
          gl.vertexAttribPointer(terrainRadiusAttrLoc, 1, gl.FLOAT, false, 0, 0);
        }
        if (tunnelCenterAttrLoc !== -1 && tunnelShellCenterBuffer) {
          gl.bindBuffer(gl.ARRAY_BUFFER, tunnelShellCenterBuffer);
          gl.vertexAttribPointer(tunnelCenterAttrLoc, 3, gl.FLOAT, false, 0, 0);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, tunnelShellVertexBuffer);
        gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

        gl.disableVertexAttribArray(colorLoc);
        gl.vertexAttrib3f(colorLoc, 0.0, 0.0, 0.0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tunnelShellIndexBuffer);
        const useUint32Shell = locations.supportUint32 && tunnelShellIndicesCount > 65535;
        gl.drawElements(gl.TRIANGLES, tunnelShellIndicesCount, useUint32Shell ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);

        gl.enableVertexAttribArray(colorLoc);
      }

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
