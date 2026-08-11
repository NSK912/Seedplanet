// === SEEDPLANET MODULE: JS/COLLECTIBLES.JS ===

var collectibles = window.collectibles || [];
window.collectibles = collectibles;

function buildCollectibles(count, seed) {
        const _origRandom = Math.random;

        // 1) Find original tree and rock positions deterministically so chopping trees doesn't shift collectible generation
        const originalTrees = [];
        const originalRocks = [];
        for (let i = 0; i < currentNatureCount; i++) {
          Math.random = mulberry32(seed + i * 11235);
          const theta = Math.random() * Math.PI;
          const phi = Math.random() * Math.PI * 2;
          const height = getHeightOnSphere(theta, phi, seed);
          const minLandHeight = waterLevel * 0.15 + 0.02;
          
          if (height >= minLandHeight) {
            const forestDensity = fbmNoise(
              Math.sin(theta) * Math.cos(phi) * 3.0,
              Math.cos(theta) * 3.0,
              Math.sin(theta) * Math.sin(phi) * 3.0,
              seed + 1234,
              3,
            );
            const nx = Math.sin(theta) * Math.cos(phi);
            const ny = Math.cos(theta);
            const nz = Math.sin(theta) * Math.sin(phi);
            const r = RADIUS + height * HEIGHT_SCALE;
            const wx = r * nx;
            const wy = r * ny;
            const wz = r * nz;

            if (isPositionInsideCave(wx, wy, wz, 0.25)) continue;
            
            if (forestDensity > -0.05) {
               originalTrees.push({ position: [wx, wy, wz], normal: [nx, ny, nz] });
            } else {
               originalRocks.push({ position: [wx, wy, wz], normal: [nx, ny, nz] });
            }
          }
        }

        collectibles = [];
        window.collectibles = collectibles;
        for (let i = 0; i < count; i++) {
          Math.random = mulberry32(seed + i * 24680); // Seed per iteration
          
          const type = Math.random() > 0.4 ? "branch" : "rock"; // More branches

          let theta, phi, height, r, nx, ny, nz, x, y, z;
          let rx, ry, rz, fx, fy, fz;

          if (type === "branch" && originalTrees.length > 0) {
            // Spawn near a deterministic random tree
            const treeIdx = Math.floor(Math.random() * originalTrees.length);
            const chosenTree = originalTrees[treeIdx];
            const tPos = chosenTree.position;
            const tNorm = chosenTree.normal;

            let txR, txY, txZ;
            if (Math.abs(tNorm[0]) < 0.9 && Math.abs(tNorm[2]) < 0.9) {
              txR = -tNorm[2]; txY = 0; txZ = tNorm[0];
            } else {
              txR = 1; txY = 0; txZ = 0;
            }
            const lenTxR = Math.sqrt(txR * txR + txY * txY + txZ * txZ) || 1;
            txR /= lenTxR; txY /= lenTxR; txZ /= lenTxR;

            const txFx = tNorm[1] * txZ - tNorm[2] * txY;
            const txFy = tNorm[2] * txR - tNorm[0] * txZ;
            const txFz = tNorm[0] * txY - tNorm[1] * txR;

            const dist = 0.04 + Math.random() * 0.15; // Spread around tree
            const angle = Math.random() * Math.PI * 2;

            const px = tPos[0] + (Math.cos(angle) * txR + Math.sin(angle) * txFx) * dist;
            const py = tPos[1] + (Math.cos(angle) * txY + Math.sin(angle) * txFy) * dist;
            const pz = tPos[2] + (Math.cos(angle) * txZ + Math.sin(angle) * txFz) * dist;

            const pDist = Math.sqrt(px*px + py*py + pz*pz) || 1;
            nx = px / pDist; ny = py / pDist; nz = pz / pDist;

            theta = Math.acos(Math.max(-1.0, Math.min(1.0, ny)));
            phi = Math.atan2(nz, nx);
            height = getHeightOnSphere(theta, phi, seed);
            r = RADIUS + height * HEIGHT_SCALE;

            x = r * nx; y = r * ny; z = r * nz;
          } else if (type === "rock" && originalRocks.length > 0 && Math.random() > 0.3) {
            // Spawn near a deterministic random rock
            const rockIdx = Math.floor(Math.random() * originalRocks.length);
            const chosenRock = originalRocks[rockIdx];
            const tPos = chosenRock.position;
            const tNorm = chosenRock.normal;

            let txR, txY, txZ;
            if (Math.abs(tNorm[0]) < 0.9 && Math.abs(tNorm[2]) < 0.9) {
              txR = -tNorm[2]; txY = 0; txZ = tNorm[0];
            } else {
              txR = 1; txY = 0; txZ = 0;
            }
            const lenTxR = Math.sqrt(txR * txR + txY * txY + txZ * txZ) || 1;
            txR /= lenTxR; txY /= lenTxR; txZ /= lenTxR;

            const txFx = tNorm[1] * txZ - tNorm[2] * txY;
            const txFy = tNorm[2] * txR - tNorm[0] * txZ;
            const txFz = tNorm[0] * txY - tNorm[1] * txR;

            const dist = 0.05 + Math.random() * 0.2; // Spread around rock
            const angle = Math.random() * Math.PI * 2;

            const px = tPos[0] + (Math.cos(angle) * txR + Math.sin(angle) * txFx) * dist;
            const py = tPos[1] + (Math.cos(angle) * txY + Math.sin(angle) * txFy) * dist;
            const pz = tPos[2] + (Math.cos(angle) * txZ + Math.sin(angle) * txFz) * dist;

            const pDist = Math.sqrt(px*px + py*py + pz*pz) || 1;
            nx = px / pDist; ny = py / pDist; nz = pz / pDist;

            theta = Math.acos(Math.max(-1.0, Math.min(1.0, ny)));
            phi = Math.atan2(nz, nx);
            height = getHeightOnSphere(theta, phi, seed);
            r = RADIUS + height * HEIGHT_SCALE;

            x = r * nx; y = r * ny; z = r * nz;
          } else {
            // Standard random spawn for rocks (or branches if no trees)
            theta = Math.random() * Math.PI;
            phi = Math.random() * Math.PI * 2;
            height = getHeightOnSphere(theta, phi, seed);
            
            if (type === "branch") {
              const minLandHeight = waterLevel * 0.15 + 0.05;
              if (height < minLandHeight) continue;
            }

            r = RADIUS + height * HEIGHT_SCALE;
            nx = Math.sin(theta) * Math.cos(phi);
            ny = Math.cos(theta);
            nz = Math.sin(theta) * Math.sin(phi);
            x = r * nx; y = r * ny; z = r * nz;
          }

          if (Math.abs(nx) < 0.9 && Math.abs(nz) < 0.9) {
            rx = -nz; ry = 0; rz = nx;
          } else {
            rx = 1; ry = 0; rz = 0;
          }
          const lenR = Math.sqrt(rx * rx + ry * ry + rz * rz);
          rx /= lenR; ry /= lenR; rz /= lenR;

          fx = ry * nz - rz * ny;
          fy = rz * nx - rx * nz;
          fz = rx * ny - ry * nx;

          const color = type === "rock"
              ? [ 0.4 + Math.random() * 0.1, 0.4 + Math.random() * 0.1, 0.4 + Math.random() * 0.1 ]
              : [ 0.4 + Math.random() * 0.1, 0.25 + Math.random() * 0.05, 0.15 ];

          let overlapCave = false;
          if (tunnels3D) {
            for (let t of tunnels3D) {
              const dx = x - t.x;
              const dy = y - t.y;
              const dz = z - t.z;
              const checkR = t.r + 0.15;
              if (dx*dx + dy*dy + dz*dz < checkR * checkR) {
                overlapCave = true;
                break;
              }
            }
          }
          if (overlapCave) continue;

          collectibles.push({
            type: type,
            position: [x, y, z],
            normal: [nx, ny, nz],
            R: [rx, ry, rz],
            F: [fx, fy, fz],
            active: true,
            size: 0.015 + Math.random() * 0.02,
            seed: seed + i * 200,
            color: color,
          });
        }

        collectibles.push({
          type: "planet_core",
          position: [0, 0, 0],
          radius: 2.0,
          segs: 128,
          color: [0.0, 0.0, 0.0],
          noiseStrength: 0.0,
          seed: 123,
          active: true,
          isDynamic: false
        });

        Math.random = _origRandom;

        if (
          savedCollectiblesState &&
          savedCollectiblesState.length === collectibles.length
        ) {
          for (let i = 0; i < collectibles.length; i++) {
            collectibles[i].active = savedCollectiblesState[i];
          }
        }

        refreshCollectiblesVBO();
      }

      window.addBox = addBox;
      function addBox(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices) {
        const hw = w / 2;
        const hh = h / 2;
        const hd = d / 2;
        
        let r = right, u = up, f = forward;
        if (r && u && f) {
          const det = (r[1]*u[2] - r[2]*u[1])*f[0] + (r[2]*u[0] - r[0]*u[2])*f[1] + (r[0]*u[1] - r[1]*u[0])*f[2];
          if (det < 0) {
            r = [-r[0], -r[1], -r[2]];
          }
        }

        const cubeVerts = [
          [-hw, -hh, -hd],
          [hw, -hh, -hd],
          [hw, -hh, hd],
          [-hw, -hh, hd],
          [-hw, hh, -hd],
          [hw, hh, -hd],
          [hw, hh, hd],
          [-hw, hh, hd],
        ];
        
        const cubeIndices = [
          0, 2, 1, 0, 3, 2, // bottom (CW outward)
          4, 5, 6, 4, 6, 7, // top (CW outward)
          0, 1, 5, 0, 5, 4, // back (CW outward)
          2, 3, 7, 2, 7, 6, // front (CW outward)
          0, 7, 3, 0, 4, 7, // left (CW outward)
          1, 2, 6, 1, 6, 5, // right (CW outward)
        ];
        
        const baseIdx = outVertices.length / 3;
        
        for (let i = 0; i < 8; i++) {
           const v = cubeVerts[i];
           const rx = r[0]*v[0] + u[0]*v[1] + f[0]*v[2];
           const ry = r[1]*v[0] + u[1]*v[1] + f[1]*v[2];
           const rz = r[2]*v[0] + u[2]*v[1] + f[2]*v[2];
           
           outVertices.push(center[0]+rx, center[1]+ry, center[2]+rz);
           outColors.push(color[0], color[1], color[2]);
        }
        
        for (let i = 0; i < cubeIndices.length; i++) {
            outIndices.push(baseIdx + cubeIndices[i]);
        }
      }

      function buildHitboxes() {
        const vertices = [];
        const colors = [];
        const indices = [];
        
        if (showHitboxes) {
            const allObstacles = [
              ...natureObstacles,
              ...cubeObstacles,
              ...amphibians,
            ];
            
            for (let i = 0; i < allObstacles.length; i++) {
                const obs = allObstacles[i];
                let color = [1.0, 0.0, 0.0]; // Red for hitboxes
                
                if (obs.meshStart !== undefined && obs.meshEnd !== undefined) {
                    const baseIdx = vertices.length / 3;
                    const count = obs.meshEnd - obs.meshStart;
                    for (let j = 0; j < count; j++) {
                        const vIdx = obs.meshStart + j;
                        vertices.push(
                            natureRawVertices[vIdx*3],
                            natureRawVertices[vIdx*3+1],
                            natureRawVertices[vIdx*3+2]
                        );
                        colors.push(color[0], color[1], color[2]);
                        indices.push(baseIdx + j);
                    }
                } else if (obs.colliders && obs.colliders.length > 0) {
                    for (let col of obs.colliders) {
                        const r = col.radius;
                        if (!obs.position) continue;
                        
                        const cx = obs.position[0] + (col.offset[0] || 0);
                        const cy = obs.position[1] + (col.offset[1] || 0);
                        const cz = obs.position[2] + (col.offset[2] || 0);
                        
                        const h = r * 2;
                        
                        const up = [0, 1, 0];
                        if (obs.normal) {
                           up[0] = obs.normal[0]; up[1] = obs.normal[1]; up[2] = obs.normal[2];
                        }
                        
                        let ref = [0, 1, 0];
                        if (Math.abs(up[1]) > 0.9) ref = [1, 0, 0];
                        
                        let right = [
                            up[1]*ref[2] - up[2]*ref[1],
                            up[2]*ref[0] - up[0]*ref[2],
                            up[0]*ref[1] - up[1]*ref[0]
                        ];
                        let rLen = Math.sqrt(right[0]*right[0] + right[1]*right[1] + right[2]*right[2]);
                        right = [right[0]/rLen, right[1]/rLen, right[2]/rLen];
                        
                        let fwd = [
                            right[1]*up[2] - right[2]*up[1],
                            right[2]*up[0] - right[0]*up[2],
                            right[0]*up[1] - right[1]*up[0]
                        ];
                        
                        const boxCenter = [cx, cy, cz];
                        
                        addBox(boxCenter, r*2, r*2, r*2, color, right, up, fwd, vertices, colors, indices);
                    }
                }
            }
        }
        
        hitboxIndicesLength = indices.length;
        if (hitboxIndicesLength > 0) {
            if (!hitboxVertexBuffer) hitboxVertexBuffer = gl.createBuffer();
            if (!hitboxColorBuffer) hitboxColorBuffer = gl.createBuffer();
            if (!hitboxIndexBuffer) hitboxIndexBuffer = gl.createBuffer();

            gl.bindBuffer(gl.ARRAY_BUFFER, hitboxVertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

            gl.bindBuffer(gl.ARRAY_BUFFER, hitboxColorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

            const isUint32 = supportUint32 && indices.length > 65535;
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, hitboxIndexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, isUint32 ? new Uint32Array(indices) : new Uint16Array(indices), gl.STATIC_DRAW);
        }
      }

      let cachedRawBoatHull = null;
      function getOrCreateRawBoatHull() {
        if (cachedRawBoatHull) return cachedRawBoatHull;
        
        const tempVerts = [];
        const tempColors = [];
        const tempIndices = [];
        
        const p = [0, 0, 0];
        const n = [0, 1, 0];
        const r = [1, 0, 0];
        const f = [0, 0, 1];
        
        const bs = 0.4;
        const w = 0.5 * bs;
        const l = 1.2 * bs;
        const h = 0.2 * bs;
        const t = 0.04 * bs;
        
        const bCol = [0.55, 0.4, 0.25];
        const darkCol = [0.38, 0.26, 0.15];
        const lightCol = [0.65, 0.5, 0.35];
        const bottomShade = [0.46, 0.32, 0.18];
        
        const drawPartLocal = (localCenter, size, color, rotX = 0, rotY = 0, rotZ = 0) => {
          let currR = [...r];
          let currN = [...n];
          let currF = [...f];
          
          if (rotX !== 0) {
            const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
            const ny = [
              currN[0]*cosX - currF[0]*sinX,
              currN[1]*cosX - currF[1]*sinX,
              currN[2]*cosX - currF[2]*sinX
            ];
            const fz = [
              currN[0]*sinX + currF[0]*cosX,
              currN[1]*sinX + currF[1]*cosX,
              currN[2]*sinX + currF[2]*cosX
            ];
            currN = ny;
            currF = fz;
          }
          if (rotY !== 0) {
            const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
            const rx = [
              currR[0]*cosY + currF[0]*sinY,
              currR[1]*cosY + currF[1]*sinY,
              currR[2]*cosY + currF[2]*sinY
            ];
            const fz = [
              -currR[0]*sinY + currF[0]*cosY,
              -currR[1]*sinY + currF[1]*cosY,
              -currR[2]*sinY + currF[2]*cosY
            ];
            currR = rx;
            currF = fz;
          }
          if (rotZ !== 0) {
            const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);
            const rx = [
              currR[0]*cosZ + currN[0]*sinZ,
              currR[1]*cosZ + currN[1]*sinZ,
              currR[2]*cosZ + currN[2]*sinZ
            ];
            const ny = [
              -currR[0]*sinZ + currN[0]*cosZ,
              -currR[1]*sinZ + currN[1]*cosZ,
              -currR[2]*sinZ + currN[2]*cosZ
            ];
            currR = rx;
            currN = ny;
          }
          
          const cx = p[0] + r[0]*localCenter[0] + n[0]*localCenter[1] + f[0]*localCenter[2];
          const cy = p[1] + r[1]*localCenter[0] + n[1]*localCenter[1] + f[1]*localCenter[2];
          const cz = p[2] + r[2]*localCenter[0] + n[2]*localCenter[1] + f[2]*localCenter[2];
          
          addBox([cx, cy, cz], size[0], size[1], size[2], color, currR, currN, currF, tempVerts, tempColors, tempIndices);
        };

        const segments = [
          { f: 0.0,       len: 0.12, pitch: 0.0,   y: 0.002, wf: 1.0,   sideTilt: 0.35 },
          { f: 0.10,      len: 0.10, pitch: 0.16,  y: 0.010, wf: 0.88,  sideTilt: 0.32 },
          { f: 0.19,      len: 0.10, pitch: 0.44,  y: 0.034, wf: 0.60,  sideTilt: 0.26 },
          { f: -0.10,     len: 0.10, pitch: -0.14, y: 0.008, wf: 0.92,  sideTilt: 0.32 },
          { f: -0.19,     len: 0.10, pitch: -0.38, y: 0.028, wf: 0.68,  sideTilt: 0.26 }
        ];

        for (let seg of segments) {
          const W_seg = w * seg.wf;
          drawPartLocal([0, seg.y, seg.f], [W_seg * 0.7, t, seg.len], bottomShade, seg.pitch, 0, 0);
          drawPartLocal([-W_seg * 0.32, seg.y + 0.003, seg.f], [W_seg * 0.35, t * 0.8, seg.len], bottomShade, seg.pitch, 0, -0.4);
          drawPartLocal([W_seg * 0.32, seg.y + 0.003, seg.f], [W_seg * 0.35, t * 0.8, seg.len], bottomShade, seg.pitch, 0, 0.4);

          const leftWallX = -W_seg * 0.52 - Math.sin(seg.sideTilt) * h * 0.5;
          const rightWallX = W_seg * 0.52 + Math.sin(seg.sideTilt) * h * 0.5;
          const wallY = seg.y + h * 0.45;
          drawPartLocal([leftWallX, wallY, seg.f], [t, h, seg.len], bCol, seg.pitch, 0, -seg.sideTilt);
          drawPartLocal([rightWallX, wallY, seg.f], [t, h, seg.len], bCol, seg.pitch, 0, seg.sideTilt);

          const railY = seg.y + h * 0.95;
          const leftRailX = leftWallX - Math.sin(seg.sideTilt) * h * 0.45;
          const rightRailX = rightWallX + Math.sin(seg.sideTilt) * h * 0.45;
          drawPartLocal([leftRailX, railY, seg.f], [t * 1.3, t * 0.7, seg.len * 1.04], darkCol, seg.pitch, 0, -seg.sideTilt);
          drawPartLocal([rightRailX, railY, seg.f], [t * 1.3, t * 0.7, seg.len * 1.04], darkCol, seg.pitch, 0, seg.sideTilt);
        }

        drawPartLocal([0, h * 0.38, 0.05], [w * 0.85, h * 0.72, t * 0.8], lightCol, 0, 0, 0);
        drawPartLocal([0, h * 0.38, -0.05], [w * 0.88, h * 0.72, t * 0.8], lightCol, 0, 0, 0);
        drawPartLocal([0, h * 0.55, 0.0], [w * 1.02, t * 0.6, 0.06], lightCol, 0, 0, 0);
        drawPartLocal([0, h * 0.95, 0.21], [w * 0.56, t * 0.7, 0.08], darkCol, 0.44, 0, 0);
        drawPartLocal([0, h * 0.7, 0.25], [t * 1.3, h * 0.8, t * 1.3], darkCol, 0.55, 0, 0);
        drawPartLocal([0, h * 0.48, -0.23], [w * 0.66, h * 0.95, t * 1.2], darkCol, -0.38, 0, 0);

        cachedRawBoatHull = {
          vertices: tempVerts,
          colors: tempColors,
          indices: tempIndices
        };
        return cachedRawBoatHull;
      }

      function refreshCollectiblesVBO(targetBuffer = 'all') {
        if (targetBuffer === 'all') {
          refreshCollectiblesVBO('main');
          refreshCollectiblesVBO('dynamic');
          return;
        }

        const vertices = [];
        const colors = [];
        const indices = [];

        let itemsToProcess = [];
        if (targetBuffer === 'main') {
          for (let item of collectibles) {
            if (!item.isDynamic && item.type !== "wood_door" && item.type !== "wood_window") {
              delete item.meshStart;
              delete item.meshEnd;
            }
          }
          itemsToProcess = collectibles.filter(c => !c.isDynamic && c.type !== "wood_door" && c.type !== "wood_window");
        } else if (targetBuffer === 'dynamic') {
          for (let item of collectibles) {
            if (item.isDynamic || item.type === "wood_door" || item.type === "wood_window") {
              delete item.meshStart;
              delete item.meshEnd;
            }
          }
          itemsToProcess = collectibles.filter(c => c.isDynamic || c.type === "wood_door" || c.type === "wood_window");
        } else {
          itemsToProcess = (typeof floorPreviewCollectible !== 'undefined' && floorPreviewCollectible ? [floorPreviewCollectible] : []);
        }

        const activeProcessedItems = [];
        for (let item of itemsToProcess) {
          if (!item.active) continue;
          if (targetBuffer !== 'preview' && item.isPreview) continue;

          const startIdx = indices.length;

          const handler = window.ItemRegistry[item.type];
          if (handler && typeof handler.render === "function") {
            handler.render(item, vertices, colors, indices, targetBuffer);
          }
          if (targetBuffer === 'main' || targetBuffer === 'dynamic') {
            item.meshStart = startIdx;
            item.meshEnd = indices.length;
            if (indices.length > startIdx) {
              activeProcessedItems.push(item);
            }
          }
        }

        if (targetBuffer === 'dynamic') {
          window.dynamicCollectiblesList = activeProcessedItems;
        }

        if (indices.length === 0) {
          if (targetBuffer === 'main') collectibleIndicesLength = 0;
          else if (targetBuffer === 'dynamic') dynamicCollectibleIndicesLength = 0;
          else previewIndicesLength = 0;
          return;
        }

        const DYNAMIC_TYPED_ARRAYS = window._DYNAMIC_TYPED_ARRAYS || (window._DYNAMIC_TYPED_ARRAYS = {});
        function getReusableTypedArray(key, Ctor, arr) {
            let buf = DYNAMIC_TYPED_ARRAYS[key];
            if (!buf || buf.length < arr.length) {
                buf = new Ctor(Math.max(arr.length * 1.5, 2048));
                DYNAMIC_TYPED_ARRAYS[key] = buf;
            }
            buf.set(arr);
            return buf.subarray(0, arr.length);
        }

        const flatGeom = makeFlatShadedGeometry(vertices, colors, indices, targetBuffer === 'dynamic' || targetBuffer === 'preview');
        const isUint32 = supportUint32 && flatGeom && flatGeom.indices && flatGeom.indices.length > 65535;

        if (targetBuffer === 'main') {
            collectibleIndicesLength = flatGeom.indices.length;

            if (!collectibleVertexBuffer)
              collectibleVertexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, collectibleVertexBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array(flatGeom.vertices),
              gl.STATIC_DRAW,
            );

            if (!collectibleColorBuffer) collectibleColorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, collectibleColorBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array(flatGeom.colors),
              gl.STATIC_DRAW,
            );

            if (!collectibleNormalBuffer)
              collectibleNormalBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, collectibleNormalBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array(flatGeom.normals),
              gl.STATIC_DRAW,
            );

            if (!collectibleIndexBuffer) collectibleIndexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, collectibleIndexBuffer);
            gl.bufferData(
              gl.ELEMENT_ARRAY_BUFFER,
              isUint32 ? new Uint32Array(flatGeom.indices) : new Uint16Array(flatGeom.indices),
              gl.STATIC_DRAW,
            );
        } else if (targetBuffer === 'dynamic') {
            dynamicCollectibleIndicesLength = flatGeom.indices.length;

            if (!dynamicCollectibleVertexBuffer)
              dynamicCollectibleVertexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleVertexBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              getReusableTypedArray('dynVerts', Float32Array, flatGeom.vertices),
              gl.DYNAMIC_DRAW,
            );

            if (!dynamicCollectibleColorBuffer) dynamicCollectibleColorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleColorBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              getReusableTypedArray('dynCols', Float32Array, flatGeom.colors),
              gl.DYNAMIC_DRAW,
            );

            if (!dynamicCollectibleNormalBuffer)
              dynamicCollectibleNormalBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleNormalBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              getReusableTypedArray('dynNorms', Float32Array, flatGeom.normals),
              gl.DYNAMIC_DRAW,
            );

            if (!dynamicCollectibleIndexBuffer) dynamicCollectibleIndexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, dynamicCollectibleIndexBuffer);
            gl.bufferData(
              gl.ELEMENT_ARRAY_BUFFER,
              isUint32 ? getReusableTypedArray('dynInds32', Uint32Array, flatGeom.indices) : getReusableTypedArray('dynInds16', Uint16Array, flatGeom.indices),
              gl.DYNAMIC_DRAW,
            );
        } else {
            previewIndicesLength = flatGeom.indices.length;

            if (!previewVertexBuffer)
              previewVertexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, previewVertexBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array(flatGeom.vertices),
              gl.DYNAMIC_DRAW,
            );

            if (!previewColorBuffer) previewColorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, previewColorBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array(flatGeom.colors),
              gl.DYNAMIC_DRAW,
            );

            if (!previewNormalBuffer)
              previewNormalBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, previewNormalBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array(flatGeom.normals),
              gl.DYNAMIC_DRAW,
            );

            if (!previewIndexBuffer) previewIndexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, previewIndexBuffer);
            gl.bufferData(
              gl.ELEMENT_ARRAY_BUFFER,
              isUint32 ? new Uint32Array(flatGeom.indices) : new Uint16Array(flatGeom.indices),
              gl.DYNAMIC_DRAW,
            );
        }
      }

      function updateCollectibles(dt) {
        if (!collectibles || collectibles.length === 0) return;
        
        let needRefresh = false;
        let needMainRefresh = false;
        const gravityAccel = Physics.gravityAccel;

        // --- Active Floor Placement Preview Update ---
        const isInventoryOpen = document.getElementById("inventoryOverlay")?.classList.contains("open");
        if (isPlacingFloor && !isInventoryOpen) {
          const placingItemName = floorPlacementInfo && floorPlacementInfo.item ? floorPlacementInfo.item.name : "";
          const typeToPlace = placingItemName.startsWith("ROBOT_") ? placingItemName.toLowerCase() : (placingItemName === "STONE_FLOOR" ? "stone_floor" : (placingItemName === "WOOD_STAIRS" ? "wood_stairs" : (placingItemName === "CAMPFIRE" ? "campfire" : (placingItemName === "WOOD_BOAT" ? "wood_boat" : (placingItemName === "WOOD_WHEEL" ? "wood_wheel" : (placingItemName === "WOOD_WALL" ? "wood_wall" : (placingItemName === "WOOD_WINDOW" ? "wood_window" : (placingItemName === "WOOD_DOOR" ? "wood_door" : (placingItemName === "WOOD_CHEST" ? "wood_chest" : (placingItemName === "MEGANEURA" ? "meganeura_item" : (placingItemName === "THIN_WOOD_FLOOR" ? "thin_wood_floor" : "wood_floor")))))))))));

          if (!floorPreviewCollectible || floorPreviewCollectible.type !== typeToPlace) {
            // Remove mismatched preview if it exists
            if (floorPreviewCollectible) {
              const idx = collectibles.indexOf(floorPreviewCollectible);
              if (idx !== -1) collectibles.splice(idx, 1);
            }
            floorPreviewCollectible = {
              type: typeToPlace,
              position: [0, 0, 0],
              normal: [0, 1, 0],
              R: [1, 0, 0],
              F: [0, 0, 1],
              U: [0, 1, 0],
              color: [0.95, 0.85, 0.45], // preview highlight color
              size: typeToPlace === "campfire" ? campfireSize : 0.25,
              active: true,
              isDynamic: false,
              isPreview: true,
              seed: Math.random()
            };
            if (typeToPlace === "wood_wall" || typeToPlace === "wood_window" || typeToPlace === "wood_door" || typeToPlace === "wood_chest" || typeToPlace === "meganeura_item" || typeToPlace === "wood_boat" || typeToPlace === "wood_wheel" || typeToPlace.startsWith("robot_")) {
              floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
            } else if (typeToPlace === "wood_floor" || typeToPlace === "thin_wood_floor") {
              floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_FLOOR;
            } else if (typeToPlace === "stone_floor") {
              floorPreviewCollectible.layer = COLLISION_LAYERS.STONE_FLOOR;
            }
          }

          // Update position to float in front of player, conforming to the terrain/ground surface
          const sinTheta = Math.sin(charTheta);
          const cosTheta = Math.cos(charTheta);
          const sinPhi = Math.sin(charPhi);
          const cosPhi = Math.cos(charPhi);

          const nx = sinTheta * cosPhi;
          const ny = cosTheta;
          const nz = sinTheta * sinPhi;
          
          let height = getHeightOnSphere(charTheta, charPhi, globalSeed);
          let terrainRadius = RADIUS + height * HEIGHT_SCALE;
          let groundRadius = terrainRadius;
          const waterRadius = RADIUS + waterLevel * 0.15;
          if (waterEnabled && terrainRadius < waterRadius) {
              groundRadius = waterRadius;
          }

          const East = [-sinPhi, 0, cosPhi];
          const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];

          const snappedHeading = Math.round(charHeading / (Math.PI / 2)) * (Math.PI / 2);
          const cosH = Math.cos(snappedHeading);
          const sinH = Math.sin(snappedHeading);

          const F = [
            North[0] * cosH + East[0] * sinH,
            North[1] * cosH + East[1] * sinH,
            North[2] * cosH + East[2] * sinH,
          ];

          // Set a close forward offset in actual meters (using actionReachDistance with a minimum safety fallback to prevent clipping)
          const baseOffset = typeToPlace === "campfire" ? 0.20 : 0.35;
          const forwardOffset = (typeToPlace === "campfire" || typeToPlace === "wood_chest" || typeToPlace.startsWith("robot_")) 
            ? Math.max(baseOffset, actionReachDistance) 
            : baseOffset; 
          const playerPt = [nx * groundRadius, ny * groundRadius, nz * groundRadius];
          const previewDir = [
            playerPt[0] + F[0] * forwardOffset,
            playerPt[1] + F[1] * forwardOffset,
            playerPt[2] + F[2] * forwardOffset
          ];
          const len = Math.sqrt(previewDir[0]*previewDir[0] + previewDir[1]*previewDir[1] + previewDir[2]*previewDir[2]);
          const pnx = previewDir[0] / (len || 1);
          const pny = previewDir[1] / (len || 1);
          const pnz = previewDir[2] / (len || 1);

          // Get exact height/ground radius at the preview position (so it floats along/conforms to the ground)
          let previewTheta = Math.acos(Math.max(-1.0, Math.min(1.0, pny)));
          let previewPhi = Math.atan2(pnz, pnx);

          let previewHeight = getHeightOnSphere(previewTheta, previewPhi, globalSeed);
          let previewTerrainRadius = RADIUS + previewHeight * HEIGHT_SCALE;
          
          let isInCave = false;
          if (typeof getTerrainSurfaceAndCeiling === "function") {
              const caveInfo = getTerrainSurfaceAndCeiling(pnx, pny, pnz, RADIUS - 0.5);
              if (caveInfo && caveInfo.ground < previewTerrainRadius - 0.5) {
                  previewTerrainRadius = caveInfo.ground;
                  isInCave = true;
              }
          }
          
          let previewGroundRadius = previewTerrainRadius;
          let isUnderWater = waterEnabled && previewTerrainRadius < waterRadius;
          if (isUnderWater && !isInCave) {
              previewGroundRadius = waterRadius;
          }
          
          // Calculate slope to prevent placing on too steep ground
          const eps = 0.01;
          const h1 = getHeightOnSphere(previewTheta + eps, previewPhi, globalSeed);
          const h2 = getHeightOnSphere(previewTheta, previewPhi + eps, globalSeed);
          const dhScale = HEIGHT_SCALE / (eps * Math.max(1, previewTerrainRadius));
          const slopeTheta = Math.abs(h1 - previewHeight) * dhScale;
          const slopePhi = Math.abs(h2 - previewHeight) * dhScale;
          const slopeVal = Math.sqrt(slopeTheta*slopeTheta + slopePhi*slopePhi);
          
          // Valid placement if not on water and not too steep (Stone Floor is valid everywhere)
          const maxSlope = typeToPlace === "campfire" ? 2.0 : 0.8;
          floorPreviewCollectible.isValidPlacement = (typeToPlace === "stone_floor") ? true : (!isUnderWater && (slopeVal < maxSlope));
          
          const previewEast = [-Math.sin(previewPhi), 0, Math.cos(previewPhi)];
          const previewNorth = [-Math.cos(previewTheta) * Math.cos(previewPhi), Math.sin(previewTheta), -Math.cos(previewTheta) * Math.sin(previewPhi)];

          let pF = [
            previewNorth[0] * cosH + previewEast[0] * sinH,
            previewNorth[1] * cosH + previewEast[1] * sinH,
            previewNorth[2] * cosH + previewEast[2] * sinH,
          ];

          let pR = [
            previewEast[0] * cosH - previewNorth[0] * sinH,
            previewEast[1] * cosH - previewNorth[1] * sinH,
            previewEast[2] * cosH - previewNorth[2] * sinH,
          ];

          let pN = [pnx, pny, pnz];

          // "ลอยสูงจากพื้นเสมอ" -> float slightly above the ground at the preview location
          const bobAmt = typeToPlace === "campfire" ? 0.005 : (typeToPlace === "wood_chest" || typeToPlace === "meganeura_item" ? 0.015 : ((typeToPlace === "stone_floor") ? 0.03 : ((typeToPlace === "wood_floor" || typeToPlace === "thin_wood_floor") ? 0.05 : 0.12)));
          let bob = typeToPlace === "campfire" ? 0.005 : (Math.sin(Date.now() * 0.003) * 0.01 + bobAmt); 
          if (typeToPlace === "robot_cockpit") bob = 0.14;
          else if (typeToPlace === "robot_left_leg" || typeToPlace === "robot_right_leg") bob = 0.14;
          else if (typeToPlace === "robot_stand") bob = 0.0;
          else if (typeToPlace.startsWith("robot_")) bob = 0.35;

          let targetPos = [
              (previewGroundRadius + bob) * pnx,
              (previewGroundRadius + bob) * pny,
              (previewGroundRadius + bob) * pnz
          ];

          // --- SNAPPING LOGIC ---
          let isSnapped = false;
          let bestSnapPos = null;
          let bestSnapDist = Infinity;
          let snapParent = null;
          let bestP_top = null;
          let bestP_bottom = null;
          let bestW_dir = null;
          let bestSlope_dir = null;

          const floorWidth = 0.3;
          const floorDepth = 0.3;

          if (typeToPlace === "wood_stairs") {
            // Snapping wood stairs to wood/stone floor edges
            for (let other of collectibles) {
              if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor") && !other.isPreview) {
                const odx = other.position[0] - targetPos[0];
                const ody = other.position[1] - targetPos[1];
                const odz = other.position[2] - targetPos[2];
                if (odx*odx + ody*ody + odz*odz > 36.0) continue; // Skip distant floors (>6m)

                const isStone = other.type === "stone_floor";
                const w = isStone ? other.size * 12.0 : other.size * 1.2;
                const d = isStone ? other.size * 12.0 : other.size * 1.2;
                const hw = w / 2;
                const hd = d / 2;
                
                let rBase = other.R;
                let fBase = other.F;
                
                // Define the edges
                let edges = [];
                let floorHH = 0;
                if (other.type === "stone_floor") floorHH = other.size * 0.15 / 2;
                else if (other.type === "wood_floor") floorHH = (woodFloorHeight + other.size * 0.12) / 2;
                else if (other.type === "thin_wood_floor") floorHH = other.size * 0.04 / 2;
                
                const nx = other.normal[0] * floorHH;
                const ny = other.normal[1] * floorHH;
                const nz = other.normal[2] * floorHH;
                
                edges = [
                  { center: [other.position[0] + rBase[0] * hw + nx, other.position[1] + rBase[1] * hw + ny, other.position[2] + rBase[2] * hw + nz], T: [fBase[0], fBase[1], fBase[2]], slope: [rBase[0], rBase[1], rBase[2]], halfL: hd },
                  { center: [other.position[0] - rBase[0] * hw + nx, other.position[1] - rBase[1] * hw + ny, other.position[2] - rBase[2] * hw + nz], T: [fBase[0], fBase[1], fBase[2]], slope: [-rBase[0], -rBase[1], -rBase[2]], halfL: hd },
                  { center: [other.position[0] + fBase[0] * hd + nx, other.position[1] + fBase[1] * hd + ny, other.position[2] + fBase[2] * hd + nz], T: [rBase[0], rBase[1], rBase[2]], slope: [fBase[0], fBase[1], fBase[2]], halfL: hw },
                  { center: [other.position[0] - fBase[0] * hd + nx, other.position[1] - fBase[1] * hd + ny, other.position[2] - fBase[2] * hd + nz], T: [rBase[0], rBase[1], rBase[2]], slope: [-fBase[0], -fBase[1], -fBase[2]], halfL: hw }
                ];

                for (let edge of edges) {
                  let isOccupied = false;
                  for (let c of collectibles) {
                      if (!c.active || c.isPreview) continue;
                      if (c === other) continue;
                      
                      const dx = c.position[0] - edge.center[0];
                      const dy = c.position[1] - edge.center[1];
                      const dz = c.position[2] - edge.center[2];
                      if (dx*dx + dy*dy + dz*dz > 4.0) continue; // Skip distant collectibles (>2m)
                      
                      const outwardDist = dx * edge.slope[0] + dy * edge.slope[1] + dz * edge.slope[2];
                      const sidewaysDist = dx * edge.T[0] + dy * edge.T[1] + dz * edge.T[2];
                      const verticalDist = dx * other.normal[0] + dy * other.normal[1] + dz * other.normal[2];
                      
                      if (c.type === "wood_floor" || c.type === "thin_wood_floor") {
                          if (outwardDist > 0.05 && outwardDist < 0.25 && Math.abs(sidewaysDist) < 0.1 && Math.abs(verticalDist) < 0.1) {
                              isOccupied = true;
                              break;
                          }
                      } else if (c.type === "wood_stairs") {
                          if (outwardDist > 0.05 && outwardDist < 0.25 && Math.abs(sidewaysDist) < 0.1 && Math.abs(verticalDist) < 0.25) {
                              isOccupied = true;
                              break;
                          }
                      }
                  }
                  if (isOccupied) continue;
                  
                  // Find closest point on segment
                  const dx_vec = [
                    targetPos[0] - edge.center[0],
                    targetPos[1] - edge.center[1],
                    targetPos[2] - edge.center[2]
                  ];
                  const t = dx_vec[0] * edge.T[0] + dx_vec[1] * edge.T[1] + dx_vec[2] * edge.T[2];
                  let clampedT = Math.max(-edge.halfL + 0.05, Math.min(edge.halfL - 0.05, t));
                  // Snap the horizontal offset along the edge to a multiple of 0.3 for grid alignment
                  clampedT = Math.round(clampedT / 0.3) * 0.3;
                  
                  const P_top = [
                    edge.center[0] + edge.T[0] * clampedT,
                    edge.center[1] + edge.T[1] * clampedT,
                    edge.center[2] + edge.T[2] * clampedT
                  ];
                  const slope_dir = edge.slope;
                  const W_dir = edge.T;

                  // Calculate P_bottom along the slope direction on the planet ground
                  const L_horizontal = 0.3;
                  const P_temp = [
                    P_top[0] + slope_dir[0] * L_horizontal,
                    P_top[1] + slope_dir[1] * L_horizontal,
                    P_top[2] + slope_dir[2] * L_horizontal
                  ];
                  const len_temp = Math.sqrt(P_temp[0]*P_temp[0] + P_temp[1]*P_temp[1] + P_temp[2]*P_temp[2]) || 1;
                  const n_temp = [P_temp[0] / len_temp, P_temp[1] / len_temp, P_temp[2] / len_temp];
                  
                  const theta_temp = Math.acos(Math.max(-1.0, Math.min(1.0, n_temp[1])));
                  const phi_temp = Math.atan2(n_temp[2], n_temp[0]);
                  const height_temp = getHeightOnSphere(theta_temp, phi_temp, globalSeed);
                  let r_temp = RADIUS + height_temp * HEIGHT_SCALE;
                  
                  const top_r = P_top[0]*n_temp[0] + P_top[1]*n_temp[1] + P_top[2]*n_temp[2];
                  let maxFloorRadius = r_temp;
                  
                  for (let other of collectibles) {
                    if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor" || other.type === "stone_wall" || other.type === "wood_wall") && !other.isPreview) {
                      const ox = other.position[0];
                      const oy = other.position[1];
                      const oz = other.position[2];
                      const fdx = ox - P_temp[0];
                      const fdy = oy - P_temp[1];
                      const fdz = oz - P_temp[2];
                      if (fdx*fdx + fdy*fdy + fdz*fdz > 36.0) continue; // Skip distant structures (>6m)
                      
                      const verticalDist = ox*n_temp[0] + oy*n_temp[1] + oz*n_temp[2];
                      
                      let hw = 0.15;
                      if (other.type === "stone_floor") hw = 1.5;
                      
                      const dx = P_temp[0] - ox;
                      const dy = P_temp[1] - oy;
                      const dz = P_temp[2] - oz;
                      const localX = dx * other.R[0] + dy * other.R[1] + dz * other.R[2];
                      const localZ = dx * other.F[0] + dy * other.F[1] + dz * other.F[2];
                      
                      if (Math.abs(localX) <= hw + 0.05 && Math.abs(localZ) <= hw + 0.05 && verticalDist >= r_temp) {
                         let surface_r = verticalDist;
                         if (other.type.includes("wall")) {
                            surface_r += 0.125; 
                         } else if (other.type === "stone_floor") {
                            surface_r += other.size * 0.15 / 2;
                         } else if (other.type === "wood_floor") {
                            surface_r += (woodFloorHeight + other.size * 0.12) / 2;
                         } else if (other.type === "thin_wood_floor") {
                            surface_r += other.size * 0.04 / 2;
                         }
                         
                         if (surface_r > maxFloorRadius && surface_r < top_r - 0.05) {
                            maxFloorRadius = surface_r;
                         }
                      }
                    }
                  }
                  
                  r_temp = maxFloorRadius;
                  // Enforce a minimum vertical drop to ensure the stairs are never flat
                  if (top_r - r_temp < 0.22) {
                      r_temp = top_r - 0.25;
                  }
                  const P_bottom = [n_temp[0] * r_temp, n_temp[1] * r_temp, n_temp[2] * r_temp];

                  // Stair midpoint center
                  const P_mid = [
                    (P_top[0] + P_bottom[0]) / 2,
                    (P_top[1] + P_bottom[1]) / 2,
                    (P_top[2] + P_bottom[2]) / 2
                  ];

                  const dx = P_mid[0] - targetPos[0];
                  const dy = P_mid[1] - targetPos[1];
                  const dz = P_mid[2] - targetPos[2];
                  
                  // For stairs, give less weight to the vertical difference (distance from ground)
                  // since targetPos is constrained to the ground, but stairs can be snapped to 2nd floors.
                  const verticalDiff = dx * pN[0] + dy * pN[1] + dz * pN[2];
                  const horizontalDistSq = (dx*dx + dy*dy + dz*dz) - verticalDiff*verticalDiff;
                  let dist = Math.sqrt(horizontalDistSq + verticalDiff*verticalDiff * 0.1);

                  if (dist < bestSnapDist) {
                    bestSnapDist = dist;
                    bestSnapPos = P_mid;
                    snapParent = other;
                    bestP_top = P_top;
                    bestP_bottom = P_bottom;
                    bestW_dir = W_dir;
                    bestSlope_dir = slope_dir;
                  }
                }
              }
            }

            if (bestSnapPos && bestSnapDist < 0.6) {
              targetPos = bestSnapPos;
              pN = [snapParent.normal[0], snapParent.normal[1], snapParent.normal[2]];
              pR = [bestW_dir[0], bestW_dir[1], bestW_dir[2]];
              pF = [bestSlope_dir[0], bestSlope_dir[1], bestSlope_dir[2]];
              isSnapped = true;
              floorPreviewCollectible.isValidPlacement = true;

                            floorPreviewCollectible.stairTop = bestP_top;
              floorPreviewCollectible.stairBottom = bestP_bottom;
            } else {
              let snappedToCave = false;
              let cx = playerPt[0];
              let cy = playerPt[1];
              let cz = playerPt[2];
              let bestTunnelRadius = 0.4;
              
              // Apply hysteresis based on previous frame's snapped-to-cave state to prevent rapid snapping/unsnapping flicker
              let wasSnapped = (typeof floorPreviewCollectible !== 'undefined' && floorPreviewCollectible && floorPreviewCollectible.wasSnappedToCave);
              
              if (typeof tunnels3D !== 'undefined' && tunnels3D) {
                  let minDist = Infinity;
                  let closestTunnel = null;
                  
                  for (let t of tunnels3D) {
                      let dx = t.x - targetPos[0];
                      let dy = t.y - targetPos[1];
                      let dz = t.z - targetPos[2];
                      let distSq = dx*dx + dy*dy + dz*dz;
                      
                      let t_len = Math.sqrt(t.x*t.x + t.y*t.y + t.z*t.z) || 1;
                      const theta_t = Math.acos(Math.max(-1.0, Math.min(1.0, t.y/t_len)));
                      const phi_t = Math.atan2(t.z, t.x);
                      const height_t = typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta_t, phi_t, typeof globalSeed !== 'undefined' ? globalSeed : 0) : 0;
                      let maxTerrainRadius = RADIUS + height_t * HEIGHT_SCALE;
                      
                      let isMouth = (t_len + t.r * 1.25 >= maxTerrainRadius);
                      let limitRadius = t.r * (wasSnapped ? 3.0 : 2.0);
                      if (isMouth && distSq < limitRadius * limitRadius && distSq < minDist) {
                          minDist = distSq;
                          closestTunnel = t;
                      }
                  }
                  
                  if (closestTunnel) {
                      snappedToCave = true;
                      if (floorPreviewCollectible) {
                          floorPreviewCollectible.wasSnappedToCave = true;
                      }
                      
                      // Snap directly to the closest tunnel mouth's static position to avoid any cursor-based center jitter
                      cx = closestTunnel.x;
                      cy = closestTunnel.y;
                      cz = closestTunnel.z;
                      bestTunnelRadius = closestTunnel.r;
                      
                      let t_len = Math.sqrt(cx*cx + cy*cy + cz*cz) || 1;
                      let n_t = [cx/t_len, cy/t_len, cz/t_len];
                      
                      // Calculate the surface height of the cave mouth center
                      const theta_t = Math.acos(Math.max(-1.0, Math.min(1.0, n_t[1])));
                      const phi_t = Math.atan2(n_t[2], n_t[0]);
                      const height_t = typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta_t, phi_t, typeof globalSeed !== 'undefined' ? globalSeed : 0) : 0;
                      let maxTerrainRadius = RADIUS + height_t * HEIGHT_SCALE;
                      
                      const P_surf_center = [n_t[0] * maxTerrainRadius, n_t[1] * maxTerrainRadius, n_t[2] * maxTerrainRadius];
                      
                      // Project player forward direction onto cave tangent plane to determine stair climb direction.
                      // This avoids any spinning singularities at the center of the mouth and makes the stair follow the player's look direction.
                      const dot_F_t = pF[0]*n_t[0] + pF[1]*n_t[1] + pF[2]*n_t[2];
                      let forwardDir_t = [pF[0] - n_t[0]*dot_F_t, pF[1] - n_t[1]*dot_F_t, pF[2] - n_t[2]*dot_F_t];
                      let forwardLen_t = Math.sqrt(forwardDir_t[0]*forwardDir_t[0] + forwardDir_t[1]*forwardDir_t[1] + forwardDir_t[2]*forwardDir_t[2]) || 1;
                      const slope_dir = [forwardDir_t[0]/forwardLen_t, forwardDir_t[1]/forwardLen_t, forwardDir_t[2]/forwardLen_t];
                      
                      // Position top of stair exactly on the cave mouth rim / lip in the direction closest to the player
                      // (opposite of the inward slope direction)
                      const P_lip = [
                          P_surf_center[0] - slope_dir[0] * (bestTunnelRadius * 1.02),
                          P_surf_center[1] - slope_dir[1] * (bestTunnelRadius * 1.02),
                          P_surf_center[2] - slope_dir[2] * (bestTunnelRadius * 1.02)
                      ];
                      
                      const len_lip = Math.sqrt(P_lip[0]*P_lip[0] + P_lip[1]*P_lip[1] + P_lip[2]*P_lip[2]) || 1;
                      const n_lip = [P_lip[0]/len_lip, P_lip[1]/len_lip, P_lip[2]/len_lip];
                      const theta_lip = Math.acos(Math.max(-1.0, Math.min(1.0, n_lip[1])));
                      const phi_lip = Math.atan2(n_lip[2], n_lip[0]);
                      const height_lip = typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta_lip, phi_lip, typeof globalSeed !== 'undefined' ? globalSeed : 0) : 0;
                      let r_lip = RADIUS + height_lip * HEIGHT_SCALE;
                      const P_top = [n_lip[0]*r_lip, n_lip[1]*r_lip, n_lip[2]*r_lip];
                      
                      // Project bottom position on the cave floor inside the cave mouth
                      const L_horizontal = 0.35;
                      const P_inward = [
                          P_top[0] + slope_dir[0] * L_horizontal,
                          P_top[1] + slope_dir[1] * L_horizontal,
                          P_top[2] + slope_dir[2] * L_horizontal
                      ];
                      const len_inward = Math.sqrt(P_inward[0]*P_inward[0] + P_inward[1]*P_inward[1] + P_inward[2]*P_inward[2]) || 1;
                      const n_inward = [P_inward[0]/len_inward, P_inward[1]/len_inward, P_inward[2]/len_inward];
                      
                      // Query height at a query radius inside the tunnel (r_lip - 0.5) to guarantee we are physically inside the 3D tunnel segment
                      let r_floor = r_lip - 1.2;
                      if (typeof getTerrainSurfaceAndCeiling === "function") {
                          const caveInfoTemp = getTerrainSurfaceAndCeiling(n_inward[0], n_inward[1], n_inward[2], r_lip - 0.5);
                          if (caveInfoTemp) {
                              r_floor = caveInfoTemp.ground;
                          }
                      }
                      
                      // Crucial: Enforce a minimum slope/vertical drop to guarantee the stairs are never horizontal/flat.
                      const minDrop = Math.max(0.6, bestTunnelRadius * 1.5);
                      if (r_floor > r_lip - minDrop) {
                          r_floor = r_lip - minDrop;
                      }
                      
                      const P_bottom = [n_inward[0] * r_floor, n_inward[1] * r_floor, n_inward[2] * r_floor];
                      
                      // Lateral orthogonal vector for stair rungs
                      let W_dir = [
                          n_t[1]*slope_dir[2] - n_t[2]*slope_dir[1],
                          n_t[2]*slope_dir[0] - n_t[0]*slope_dir[2],
                          n_t[0]*slope_dir[1] - n_t[1]*slope_dir[0]
                      ];
                      const lenW = Math.sqrt(W_dir[0]*W_dir[0] + W_dir[1]*W_dir[1] + W_dir[2]*W_dir[2]) || 1;
                      W_dir = [W_dir[0]/lenW, W_dir[1]/lenW, W_dir[2]/lenW];
                      
                      // Apply snapped position and axes
                      targetPos = [
                          (P_top[0] + P_bottom[0]) / 2,
                          (P_top[1] + P_bottom[1]) / 2,
                          (P_top[2] + P_bottom[2]) / 2
                      ];
                      pN = [n_t[0], n_t[1], n_t[2]];
                      pR = [W_dir[0], W_dir[1], W_dir[2]];
                      pF = [slope_dir[0], slope_dir[1], slope_dir[2]];
                      
                      floorPreviewCollectible.stairTop = P_top;
                      floorPreviewCollectible.stairBottom = P_bottom;
                      floorPreviewCollectible.isValidPlacement = true;
                  }
              }

              if (!snappedToCave) {
                  if (floorPreviewCollectible) {
                      floorPreviewCollectible.wasSnappedToCave = false;
                  }
              // Not snapped: place stairs in front of player on the ground, going UP and AWAY.
              const L_horizontal = 0.3;
              
              const dx = targetPos[0] - cx;
              const dy = targetPos[1] - cy;
              const dz = targetPos[2] - cz;
              
              const localX = dx * pR[0] + dy * pR[1] + dz * pR[2];
              const localZ = dx * pF[0] + dy * pF[1] + dz * pF[2];
              
              let gridX = Math.round(localX / 0.3);
              let gridZ = Math.round(localZ / 0.3);
              
              if (!snappedToCave) {
                  gridX = Math.max(-1, Math.min(1, gridX));
                  gridZ = Math.max(1, Math.min(2, gridZ)); // Force it to be in front
              }
              
              const P_bottom_start = [
                cx + pR[0] * (gridX * 0.3) + pF[0] * (gridZ * 0.3),
                cy + pR[1] * (gridX * 0.3) + pF[1] * (gridZ * 0.3),
                cz + pR[2] * (gridX * 0.3) + pF[2] * (gridZ * 0.3)
              ];

              const slope_dir = [pF[0], pF[1], pF[2]];
              const W_dir = [pR[0], pR[1], pR[2]];

              // Calculate true ground height for P_bottom
              const len_b = Math.sqrt(P_bottom_start[0]*P_bottom_start[0] + P_bottom_start[1]*P_bottom_start[1] + P_bottom_start[2]*P_bottom_start[2]) || 1;
              const n_b = [P_bottom_start[0] / len_b, P_bottom_start[1] / len_b, P_bottom_start[2] / len_b];
              const theta_b = Math.acos(Math.max(-1.0, Math.min(1.0, n_b[1])));
              const phi_b = Math.atan2(n_b[2], n_b[0]);
              const height_b = getHeightOnSphere(theta_b, phi_b, globalSeed);
              let r_b = RADIUS + height_b * HEIGHT_SCALE;
              if (typeof getTerrainSurfaceAndCeiling === "function") {
                  const caveInfoB = getTerrainSurfaceAndCeiling(n_b[0], n_b[1], n_b[2], RADIUS - 0.5);
                  if (caveInfoB && caveInfoB.ground < r_b - 0.5) {
                      r_b = caveInfoB.ground;
                  }
              }
              
              for (let other of collectibles) {
                if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor" || other.type === "stone_wall" || other.type === "wood_wall") && !other.isPreview) {
                  const ox = other.position[0], oy = other.position[1], oz = other.position[2];
                  const verticalDist = ox*n_b[0] + oy*n_b[1] + oz*n_b[2];
                  
                  let hw = 0.15;
                  if (other.type === "stone_floor") hw = 1.5;
                  
                  const dx = P_bottom_start[0] - ox;
                  const dy = P_bottom_start[1] - oy;
                  const dz = P_bottom_start[2] - oz;
                  const localX = dx * other.R[0] + dy * other.R[1] + dz * other.R[2];
                  const localZ = dx * other.F[0] + dy * other.F[1] + dz * other.F[2];
                  
                  if (Math.abs(localX) <= hw + 0.05 && Math.abs(localZ) <= hw + 0.05 && verticalDist >= r_b) {
                     let surface_r = verticalDist;
                     if (other.type.includes("wall")) surface_r += 0.125; 
                     else if (other.type === "stone_floor") surface_r += other.size * 0.15 / 2;
                     else if (other.type === "wood_floor") surface_r += (woodFloorHeight + other.size * 0.12) / 2;
                     else if (other.type === "thin_wood_floor") surface_r += other.size * 0.04 / 2;
                     
                     if (surface_r > r_b) r_b = surface_r;
                  }
                }
              }
              const P_bottom = [n_b[0] * r_b, n_b[1] * r_b, n_b[2] * r_b];

              // Make stairs rigid and of a fixed size by default.
              let H_vertical = 0.25;
              let L_actual = L_horizontal;
              
              // If aiming downwards slightly, flip the stair so it builds down.
              const lookDownAngle = pnx*n_b[0] + pny*n_b[1] + pnz*n_b[2];
              if (lookDownAngle < -0.2) {
                 H_vertical = -0.25;
              }

              // Check terrain at P_temp to see if we're bridging a cave drop-off
              const P_temp = [
                P_bottom[0] + slope_dir[0] * L_horizontal,
                P_bottom[1] + slope_dir[1] * L_horizontal,
                P_bottom[2] + slope_dir[2] * L_horizontal
              ];
              const len_temp = Math.sqrt(P_temp[0]*P_temp[0] + P_temp[1]*P_temp[1] + P_temp[2]*P_temp[2]) || 1;
              const n_temp = [P_temp[0] / len_temp, P_temp[1] / len_temp, P_temp[2] / len_temp];
              
              let r_temp = 0;
              let r_surface = 0;
              let caveInfoTemp = null;
              
              // Raycast slightly forward to find the true crater rim, as the slope might be wide.
              let max_r_surface = -Infinity;
              let foundCaveBoundary = false;
              let boundary_r_temp = 0;
              let boundary_caveInfo = null;
              
              for (let step = 1; step <= 5; step++) {
                  let test_L = L_horizontal * step;
                  const P_test = [
                    P_bottom[0] + slope_dir[0] * test_L,
                    P_bottom[1] + slope_dir[1] * test_L,
                    P_bottom[2] + slope_dir[2] * test_L
                  ];
                  const len_test = Math.sqrt(P_test[0]*P_test[0] + P_test[1]*P_test[1] + P_test[2]*P_test[2]) || 1;
                  const n_test = [P_test[0] / len_test, P_test[1] / len_test, P_test[2] / len_test];
                  
                  const theta_test = Math.acos(Math.max(-1.0, Math.min(1.0, n_test[1])));
                  const phi_test = Math.atan2(n_test[2], n_test[0]);
                  let height_test = 0;
                  if (typeof getHeightOnSphere === "function") height_test = getHeightOnSphere(theta_test, phi_test, typeof globalSeed !== "undefined" ? globalSeed : 0);
                  let test_r_temp = RADIUS + height_test * HEIGHT_SCALE;
                  let test_r_surface = test_r_temp;
                  
                  let testCaveInfo = null;
                  if (typeof getTerrainSurfaceAndCeiling === "function") {
                      testCaveInfo = getTerrainSurfaceAndCeiling(n_test[0], n_test[1], n_test[2], RADIUS - 0.5);
                      if (testCaveInfo) {
                          test_r_surface = testCaveInfo.surfaceRadius;
                          if (testCaveInfo.ground < test_r_temp - 0.5) {
                              test_r_temp = testCaveInfo.ground;
                          }
                      }
                  }
                  
                  if (test_r_surface > max_r_surface) {
                      max_r_surface = test_r_surface;
                  }
                  
                  if (step === 1) {
                      r_temp = test_r_temp;
                      r_surface = test_r_surface;
                      caveInfoTemp = testCaveInfo;
                  }
                  
                  // Check if we found a boundary at this step or previous
                  if (Math.abs(r_b - test_r_temp) > 0.5 || (testCaveInfo && testCaveInfo.isEntrance)) {
                      foundCaveBoundary = true;
                  }
              }
              
              // If there's a huge drop-off between P_bottom and P_temp (like a cave entrance boundary), bridge it!
              if (foundCaveBoundary || snappedToCave) {
                  let targetSurface = Math.max(max_r_surface, RADIUS - 0.2);
                  let min_ground = Math.min(r_temp, r_b);
                  
                  if (lookDownAngle < -0.2 || snappedToCave) {
                      // Aiming down into the cave. P_bottom should be lifted to the surface lip.
                      let adjust_H = targetSurface - r_b + 0.15;
                      if (adjust_H > 0) {
                          P_bottom[0] += n_b[0] * adjust_H;
                          P_bottom[1] += n_b[1] * adjust_H;
                          P_bottom[2] += n_b[2] * adjust_H;
                      }
                      
                      H_vertical = min_ground - targetSurface - 0.15;
                      L_actual = Math.max(L_horizontal, Math.abs(H_vertical) * 0.6);
                  } else {
                      // Aiming up out of the cave. P_top should reach the surface lip.
                      if (targetSurface - r_b > 0.5) {
                          H_vertical = targetSurface - r_b + 0.15;
                          L_actual = Math.max(L_horizontal, H_vertical * 0.6);
                      }
                  }
              }

              // Crucial: Enforce a minimum absolute height difference to guarantee the stairs are never horizontal/flat.
              if (Math.abs(H_vertical) < 0.22) {
                  H_vertical = (H_vertical >= 0) ? 0.22 : -0.22;
                  L_actual = Math.max(L_actual, Math.abs(H_vertical) * 0.6);
              }

              let P_top = [
                P_bottom[0] + slope_dir[0] * L_actual + n_b[0] * H_vertical,
                P_bottom[1] + slope_dir[1] * L_actual + n_b[1] * H_vertical,
                P_bottom[2] + slope_dir[2] * L_actual + n_b[2] * H_vertical
              ];
              
              // Ensure P_top is always treated as the far point regardless of height.
              // The rendering code now safely handles negative slopes.

              targetPos = [
                (P_top[0] + P_bottom[0]) / 2,
                (P_top[1] + P_bottom[1]) / 2,
                (P_top[2] + P_bottom[2]) / 2
              ];

                            floorPreviewCollectible.stairTop = P_top;
              floorPreviewCollectible.stairBottom = P_bottom;
              floorPreviewCollectible.isValidPlacement = isInCave;
              }
            }
          } else if (typeToPlace === "wood_boat") {
             floorPreviewCollectible.isValidPlacement = isUnderWater && !isDivingMode;
             floorPreviewCollectible.size = 0.25;
             targetPos = [
                 pnx * (waterRadius - 0.02),
                 pny * (waterRadius - 0.02),
                 pnz * (waterRadius - 0.02)
             ];
             pN = [pnx, pny, pnz];
             pR = [previewEast[0] * cosH - previewNorth[0] * sinH, previewEast[1] * cosH - previewNorth[1] * sinH, previewEast[2] * cosH - previewNorth[2] * sinH];
             pF = [previewNorth[0] * cosH + previewEast[0] * sinH, previewNorth[1] * cosH + previewEast[1] * sinH, previewNorth[2] * cosH + previewEast[2] * sinH];
          } else if (typeToPlace === "wood_wheel") {
             let nearestBoat = null;
             let bestDist = Infinity;
             for (let other of collectibles) {
               if (other.active && other.type === "wood_boat" && !other.isPreview) {
                 const dx = other.position[0] - targetPos[0];
                 const dy = other.position[1] - targetPos[1];
                 const dz = other.position[2] - targetPos[2];
                 const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                 if (dist < bestDist) {
                   bestDist = dist;
                   nearestBoat = other;
                 }
               }
             }

             if (nearestBoat && bestDist < 0.6) {
               const bP = nearestBoat.position;
               const bN = nearestBoat.normal || [0, 1, 0];
               const bR = nearestBoat.R || [1, 0, 0];
               const bF = nearestBoat.F || [0, 0, 1];

               targetPos = [bP[0], bP[1], bP[2]];
               pN = [bN[0], bN[1], bN[2]];
               pR = [bR[0], bR[1], bR[2]];
               pF = [bF[0], bF[1], bF[2]];
               isSnapped = true;
               floorPreviewCollectible.isValidPlacement = true;
               floorPreviewCollectible.isBoatSnapped = true;
               floorPreviewCollectible.targetBoat = nearestBoat;
               floorPreviewCollectible.size = 0.25;
             } else {
               floorPreviewCollectible.isValidPlacement = !isUnderWater;
               floorPreviewCollectible.isBoatSnapped = false;
               floorPreviewCollectible.size = 0.25;
               pN = [pnx, pny, pnz];
               pR = [previewEast[0] * cosH - previewNorth[0] * sinH, previewEast[1] * cosH - previewNorth[1] * sinH, previewEast[2] * cosH - previewNorth[2] * sinH];
               pF = [previewNorth[0] * cosH + previewEast[0] * sinH, previewNorth[1] * cosH + previewEast[1] * sinH, previewNorth[2] * cosH + previewEast[2] * sinH];
             }
          } else if (typeToPlace === "stone_floor") {
            const w = 0.25 * 12.0;
            const d = 0.25 * 12.0;
            const floorH = 0.25 * 0.15;
            
            // --- 0. Snap to nearby stone floors ---
            let nearestStone = null;
            let nearestDist = Infinity;
            for (let other of collectibles) {
                if (other.active && other.type === "stone_floor" && !other.isPreview) {
                    const dx = other.position[0] - targetPos[0];
                    const dy = other.position[1] - targetPos[1];
                    const dz = other.position[2] - targetPos[2];
                    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestStone = other;
                    }
                }
            }
            if (nearestStone && nearestDist < 5.0) { // Snap if close
                const sR = nearestStone.R;
                const sF = nearestStone.F;
                const sN = nearestStone.normal;
                const sP = nearestStone.position;
                
                const dx = targetPos[0] - sP[0];
                const dy = targetPos[1] - sP[1];
                const dz = targetPos[2] - sP[2];
                
                const localX = dx * sR[0] + dy * sR[1] + dz * sR[2];
                const localZ = dx * sF[0] + dy * sF[1] + dz * sF[2];
                
                let gridX = Math.round(localX / 3.0);
                let gridZ = Math.round(localZ / 3.0);
                
                // Snap to closest adjacent grid
                if (gridX > 1) gridX = 1; if (gridX < -1) gridX = -1;
                if (gridZ > 1) gridZ = 1; if (gridZ < -1) gridZ = -1;
                
                if (Math.abs(gridX) === 1 || Math.abs(gridZ) === 1) {
                    targetPos = [
                        sP[0] + gridX * 3.0 * sR[0] + gridZ * 3.0 * sF[0],
                        sP[1] + gridX * 3.0 * sR[1] + gridZ * 3.0 * sF[1],
                        sP[2] + gridX * 3.0 * sR[2] + gridZ * 3.0 * sF[2]
                    ];
                    floorPreviewCollectible.normal = [sN[0], sN[1], sN[2]];
                    floorPreviewCollectible.R = [sR[0], sR[1], sR[2]];
                    floorPreviewCollectible.F = [sF[0], sF[1], sF[2]];
                    if (nearestStone.angle !== undefined) {
                        floorPreviewCollectible.angle = nearestStone.angle;
                        placementRotationAngle = nearestStone.angle;
                    }
                    isSnapped = true;
                    pN = [sN[0], sN[1], sN[2]];
                    pR = [sR[0], sR[1], sR[2]];
                    pF = [sF[0], sF[1], sF[2]];
                }
            }
            
            // Ensure floorPreviewCollectible orientation vectors are updated for current frame
            floorPreviewCollectible.normal = [pN[0], pN[1], pN[2]];
            floorPreviewCollectible.R = [pR[0], pR[1], pR[2]];
            floorPreviewCollectible.F = [pF[0], pF[1], pF[2]];
            
            // Stone floor can be placed anywhere (terrain/slope/trees/rocks do not block it).
            floorPreviewCollectible.isValidPlacement = true;

            // Prevent overlapping with another stone floor placed at the exact same location
            for (let other of collectibles) {
                if (other.active && other.type === "stone_floor" && !other.isPreview) {
                    const ox = other.position[0] - targetPos[0];
                    const oy = other.position[1] - targetPos[1];
                    const oz = other.position[2] - targetPos[2];
                    if (ox*ox + oy*oy + oz*oz < 0.2) {
                        floorPreviewCollectible.isValidPlacement = false;
                        break;
                    }
                }
            }
            
            floorPreviewCollectible.size = 0.25;
          } else if (typeToPlace === "wood_floor") {
            // Find nearest stone_floor for grid snapping (Only placeable on stone floors)
            let nearestStone = null;
            let nearestDist = Infinity;
            for (let other of collectibles) {
                if (other.active && other.type === "stone_floor" && !other.isPreview) {
                    const dx = other.position[0] - targetPos[0];
                    const dy = other.position[1] - targetPos[1];
                    const dz = other.position[2] - targetPos[2];
                    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestStone = other;
                    }
                }
            }

            if (nearestStone && nearestDist < 2.5) {
                const sR = nearestStone.R || [1, 0, 0];
                const sF = nearestStone.F || [0, 0, 1];
                const sN = nearestStone.normal || [0, 1, 0];
                const sP = nearestStone.position;

                // Project targetPos onto stone floor's plane
                const dx = targetPos[0] - sP[0];
                const dy = targetPos[1] - sP[1];
                const dz = targetPos[2] - sP[2];

                const localX = dx * sR[0] + dy * sR[1] + dz * sR[2];
                const localZ = dx * sF[0] + dy * sF[1] + dz * sF[2];

                // Check if projected point is within the bounds of stone floor
                // Width of stone floor is 3.0 meters (so half width is 1.5). 
                // We allow snapping slightly outside (e.g. 1.65) to cover edges cleanly.
                if (Math.abs(localX) <= 1.65 && Math.abs(localZ) <= 1.65) {
                    // Snap to 0.3 grid
                    let gridX = Math.round(localX / 0.3);
                    let gridZ = Math.round(localZ / 0.3);

                    // Limit gridX and gridZ to -5 to 5 (covering the 3.0m x 3.0m stone floor)
                    gridX = Math.max(-5, Math.min(5, gridX));
                    gridZ = Math.max(-5, Math.min(5, gridZ));

                    floorPreviewCollectible.isValidPlacement = true;
                    floorPreviewCollectible.size = 0.25;

                    const sH = nearestStone.size * 0.15; // stone floor height
                    const wH = woodFloorHeight + 0.25 * 0.12;       // wood floor height

                    targetPos = [
                        sP[0] + sR[0] * (gridX * 0.3) + sF[0] * (gridZ * 0.3) + sN[0] * (sH/2 + wH/2),
                        sP[1] + sR[1] * (gridX * 0.3) + sF[1] * (gridZ * 0.3) + sN[1] * (sH/2 + wH/2),
                        sP[2] + sR[2] * (gridX * 0.3) + sF[2] * (gridZ * 0.3) + sN[2] * (sH/2 + wH/2)
                    ];

                    pN = [sN[0], sN[1], sN[2]];
                    pR = [sR[0], sR[1], sR[2]];
                    pF = [sF[0], sF[1], sF[2]];
                    isSnapped = true;

                    // Check if another wood_floor is already at this exact snapped position
                    for (let other of collectibles) {
                      if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor") && !other.isPreview) {
                          const ox = other.position[0] - targetPos[0];
                          const oy = other.position[1] - targetPos[1];
                          const oz = other.position[2] - targetPos[2];
                          if (ox*ox + oy*oy + oz*oz < 0.01) {
                              floorPreviewCollectible.isValidPlacement = false;
                          }
                      }
            }
          } else {
                    floorPreviewCollectible.isValidPlacement = false;
                    floorPreviewCollectible.size = 0.25;
            }
          } else {
                // No stone floor found nearby or too far
                floorPreviewCollectible.isValidPlacement = false;
                floorPreviewCollectible.size = 0.25;
            }
          } else if (typeToPlace.startsWith("robot_")) {
            let robotSnapFound = false;

            if (typeToPlace === "robot_stand") {
              // Placing Robot Stand -> Snap directly under an unmounted Robot Cockpit
              let nearestCockpit = null;
              let bestCDist = Infinity;
              for (let c of collectibles) {
                if (c.active && !c.isPreview && c.type === "robot_cockpit") {
                  const dx = c.position[0] - targetPos[0];
                  const dy = c.position[1] - targetPos[1];
                  const dz = c.position[2] - targetPos[2];
                  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                  if (dist < bestCDist) {
                    bestCDist = dist;
                    nearestCockpit = c;
                  }
                }
              }

              if (nearestCockpit && bestCDist < 0.6) {
                const updatedCPos = nearestCockpit.position;
                const cR = nearestCockpit.R || [1, 0, 0];
                const cN = nearestCockpit.normal || nearestCockpit.U || [0, 1, 0];
                const cF = nearestCockpit.F || [0, 0, 1];
                const clampOffsetN = 0.66;
                const clampOffsetF = 0.0;
                targetPos = [
                  updatedCPos[0] - cN[0] * clampOffsetN - cF[0] * clampOffsetF,
                  updatedCPos[1] - cN[1] * clampOffsetN - cF[1] * clampOffsetF,
                  updatedCPos[2] - cN[2] * clampOffsetN - cF[2] * clampOffsetF
                ];
                pN = [cN[0], cN[1], cN[2]];
                pR = [cR[0], cR[1], cR[2]];
                pF = [cF[0], cF[1], cF[2]];
                floorPreviewCollectible.isValidPlacement = true;
                floorPreviewCollectible.size = 0.25;
                isSnapped = true;
                robotSnapFound = true;
              }
            } else if (typeToPlace !== "robot_cockpit") {
              // Placing Leg, Arm, or other Robot Part -> Snap ONLY to Cockpit that is mounted on a Robot Stand
              let nearestCockpit = null;
              let bestCDist = Infinity;
              for (let c of collectibles) {
                if (c.active && !c.isPreview && c.type === "robot_cockpit") {
                  const dx = c.position[0] - targetPos[0];
                  const dy = c.position[1] - targetPos[1];
                  const dz = c.position[2] - targetPos[2];
                  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                  if (dist < bestCDist) {
                    bestCDist = dist;
                    nearestCockpit = c;
                  }
                }
              }

              // Check if nearestCockpit is mounted on a Robot Stand
              let cockpitOnStand = false;
              if (nearestCockpit && bestCDist < 0.6) {
                for (let s of collectibles) {
                  if (s.active && !s.isPreview && s.type === "robot_stand") {
                    const sdx = s.position[0] - nearestCockpit.position[0];
                    const sdy = s.position[1] - nearestCockpit.position[1];
                    const sdz = s.position[2] - nearestCockpit.position[2];
                    const sdist = Math.sqrt(sdx*sdx + sdy*sdy + sdz*sdz);
                    if (sdist < 1.2) {
                      cockpitOnStand = true;
                      break;
                    }
                  }
                }
              }

              if (nearestCockpit && bestCDist < 0.6 && cockpitOnStand) {
                const updatedCPos = nearestCockpit.position;
                const cR = nearestCockpit.R || [1, 0, 0];
                const cN = nearestCockpit.normal || nearestCockpit.U || [0, 1, 0];
                const cF = nearestCockpit.F || [0, 0, 1];

                let rOff = 0, nOff = 0, fOff = 0;
                if (typeToPlace === "robot_left_leg") {
                  rOff = -0.030; nOff = -0.5025; fOff = 0.0;
                } else if (typeToPlace === "robot_right_leg") {
                  rOff = 0.030; nOff = -0.5025; fOff = 0.0;
                } else if (typeToPlace === "robot_left_arm") {
                  rOff = -0.1875; nOff = -0.16875; fOff = 0.0;
                } else if (typeToPlace === "robot_right_arm") {
                  rOff = 0.1875; nOff = -0.16875; fOff = 0.0;
                }

                targetPos = [
                  updatedCPos[0] + cR[0]*rOff + cN[0]*nOff + cF[0]*fOff,
                  updatedCPos[1] + cR[1]*rOff + cN[1]*nOff + cF[1]*fOff,
                  updatedCPos[2] + cR[2]*rOff + cN[2]*nOff + cF[2]*fOff
                ];

                pN = [cN[0], cN[1], cN[2]];
                pR = [cR[0], cR[1], cR[2]];
                pF = [cF[0], cF[1], cF[2]];

                floorPreviewCollectible.isValidPlacement = true;
                floorPreviewCollectible.size = 0.25;
                isSnapped = true;
                robotSnapFound = true;
              }
            } else {
              // Placing Cockpit -> Snap ONLY to placed Stand
              let nearestStand = null;
              let bestSDist = Infinity;
              for (let c of collectibles) {
                if (c.active && !c.isPreview && c.type === "robot_stand") {
                  const dx = c.position[0] - targetPos[0];
                  const dy = c.position[1] - targetPos[1];
                  const dz = c.position[2] - targetPos[2];
                  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                  if (dist < bestSDist) {
                    bestSDist = dist;
                    nearestStand = c;
                  }
                }
              }

              if (nearestStand && bestSDist < 0.6) {
                const sPos = nearestStand.position;
                const sR = nearestStand.R || [1, 0, 0];
                const sN = nearestStand.normal || nearestStand.U || [0, 1, 0];
                const sF = nearestStand.F || [0, 0, 1];
                const clampOffsetN = 0.66;
                const clampOffsetF = 0.0;
                targetPos = [
                  sPos[0] + sN[0] * clampOffsetN + sF[0] * clampOffsetF,
                  sPos[1] + sN[1] * clampOffsetN + sF[1] * clampOffsetF,
                  sPos[2] + sN[2] * clampOffsetN + sF[2] * clampOffsetF
                ];
                pN = [sN[0], sN[1], sN[2]];
                pR = [sR[0], sR[1], sR[2]];
                pF = [sF[0], sF[1], sF[2]];
                floorPreviewCollectible.isValidPlacement = true;
                floorPreviewCollectible.size = 0.25;
                isSnapped = true;
                robotSnapFound = true;
              }
            }

            if (!robotSnapFound) {
              if (typeToPlace !== "robot_stand") {
                floorPreviewCollectible.isValidPlacement = false;
                floorPreviewCollectible.size = 0.25;
              } else {
                // Standalone ground/floor placement
                let nearestFloor = null;
                let nearestDist = Infinity;
                for (let other of collectibles) {
                  if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor") && !other.isPreview) {
                    const dx = other.position[0] - targetPos[0];
                    const dy = other.position[1] - targetPos[1];
                    const dz = other.position[2] - targetPos[2];
                    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    if (dist < nearestDist) {
                      nearestDist = dist;
                      nearestFloor = other;
                    }
                  }
                }

                if (nearestFloor && nearestDist < 0.6) {
                  const sR = nearestFloor.R || [1, 0, 0];
                  const sF = nearestFloor.F || [0, 0, 1];
                  const sN = nearestFloor.normal || [0, 1, 0];
                  const sP = nearestFloor.position;

                  const dx = targetPos[0] - sP[0];
                  const dy = targetPos[1] - sP[1];
                  const dz = targetPos[2] - sP[2];

                  const localX = dx * sR[0] + dy * sR[1] + dz * sR[2];
                  const localZ = dx * sF[0] + dy * sF[1] + dz * sF[2];

                  if (Math.abs(localX) <= 0.35 && Math.abs(localZ) <= 0.35) {
                    let gridX = Math.round(localX / 0.15);
                    let gridZ = Math.round(localZ / 0.15);

                    floorPreviewCollectible.isValidPlacement = true;
                    floorPreviewCollectible.size = 0.25;

                    let floorHH = 0;
                    if (nearestFloor.type === "stone_floor") floorHH = nearestFloor.size * 0.15;
                    else if (nearestFloor.type === "wood_floor") floorHH = woodFloorHeight + nearestFloor.size * 0.12;
                    else if (nearestFloor.type === "thin_wood_floor") floorHH = nearestFloor.size * 0.04;

                    let floatOffset = typeToPlace === "robot_cockpit" ? 0.14 : ((typeToPlace === "robot_left_leg" || typeToPlace === "robot_right_leg") ? 0.14 : (typeToPlace === "robot_stand" ? 0.0 : 0.35));

                    targetPos = [
                      sP[0] + sR[0] * (gridX * 0.15) + sF[0] * (gridZ * 0.15) + sN[0] * (floorHH / 2 + floatOffset),
                      sP[1] + sR[1] * (gridX * 0.15) + sF[1] * (gridZ * 0.15) + sN[1] * (floorHH / 2 + floatOffset),
                      sP[2] + sR[2] * (gridX * 0.15) + sF[2] * (gridZ * 0.15) + sN[2] * (floorHH / 2 + floatOffset)
                    ];

                    pN = [sN[0], sN[1], sN[2]];
                    pR = [sR[0], sR[1], sR[2]];
                    pF = [sF[0], sF[1], sF[2]];
                    isSnapped = true;
                  } else {
                    floorPreviewCollectible.isValidPlacement = !isUnderWater && (slopeVal < 0.6);
                    floorPreviewCollectible.size = 0.25;
                  }
                } else {
                  floorPreviewCollectible.isValidPlacement = !isUnderWater && (slopeVal < 0.6);
                  floorPreviewCollectible.size = 0.25;
                }
              }
            }
          } else if (typeToPlace === "wood_wall" || typeToPlace === "wood_window" || typeToPlace === "wood_door" || typeToPlace === "thin_wood_floor" || typeToPlace === "wood_chest" || typeToPlace === "meganeura_item") {
            // Find nearest wood_floor for grid snapping (Only placeable on wood floors)
            let nearestFloor = null;
            let nearestDist = Infinity;
            for (let other of collectibles) {
                if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor") && !other.isPreview) {
                    const dx = other.position[0] - targetPos[0];
                    const dy = other.position[1] - targetPos[1];
                    const dz = other.position[2] - targetPos[2];
                    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestFloor = other;
                    }
                }
            }

            if (nearestFloor && nearestDist < 0.6) {
                const sR = nearestFloor.R || [1, 0, 0];
                const sF = nearestFloor.F || [0, 0, 1];
                const sN = nearestFloor.normal || [0, 1, 0];
                const sP = nearestFloor.position;

                // Project targetPos onto wood floor plane
                const dx = targetPos[0] - sP[0];
                const dy = targetPos[1] - sP[1];
                const dz = targetPos[2] - sP[2];

                const localX = dx * sR[0] + dy * sR[1] + dz * sR[2];
                const localZ = dx * sF[0] + dy * sF[1] + dz * sF[2];

                // If within expanded wood_floor bounds (generous snapping)
                let snapBound = (typeToPlace === "thin_wood_floor" && (nearestFloor.type === "thin_wood_floor" || nearestFloor.type === "wood_floor")) ? 0.55 : 0.35;
                if (Math.abs(localX) <= snapBound && Math.abs(localZ) <= snapBound) {
                    // Snap localX and localZ to 0.15 grid (-0.15, 0.0, 0.15)
                    let gridX = Math.round(localX / 0.15);
                    let gridZ = Math.round(localZ / 0.15);

                    // Prevent center and corner placement for walls to avoid overlapping side-by-side, unless placing on thin_wood_floor which allows center placement, or if placing thin_wood_floor itself.
                    if (typeToPlace === "wood_chest" || typeToPlace === "meganeura_item" || typeToPlace.startsWith("robot_")) {
                        floorPreviewCollectible.isValidPlacement = true;
                        floorPreviewCollectible.size = 0.25;

                        let floorHH = 0;
                        if (nearestFloor.type === "stone_floor") floorHH = nearestFloor.size * 0.15;
                        else if (nearestFloor.type === "wood_floor") floorHH = woodFloorHeight + nearestFloor.size * 0.12;
                        else if (nearestFloor.type === "thin_wood_floor") floorHH = nearestFloor.size * 0.04;

                        let floatOffset = 0;
                        if (typeToPlace === "robot_cockpit") floatOffset = 0.14;
                        else if (typeToPlace === "robot_left_leg" || typeToPlace === "robot_right_leg") floatOffset = 0.14;
                        else if (typeToPlace === "robot_stand") floatOffset = 0.0;
                        else if (typeToPlace.startsWith("robot_")) floatOffset = 0.35;
                        targetPos = [
                            sP[0] + sR[0] * (gridX * 0.15) + sF[0] * (gridZ * 0.15) + sN[0] * (floorHH / 2 + floatOffset),
                            sP[1] + sR[1] * (gridX * 0.15) + sF[1] * (gridZ * 0.15) + sN[1] * (floorHH / 2 + floatOffset),
                            sP[2] + sR[2] * (gridX * 0.15) + sF[2] * (gridZ * 0.15) + sN[2] * (floorHH / 2 + floatOffset)
                        ];

                        pN = [sN[0], sN[1], sN[2]];
                        pR = [sR[0], sR[1], sR[2]];
                        pF = [sF[0], sF[1], sF[2]];
                        isSnapped = true;
                    } else {
                        if (gridX === 0 && gridZ === 0) {
                        if (nearestFloor.type !== "thin_wood_floor" && typeToPlace !== "thin_wood_floor") {
                            if (Math.abs(localX) > Math.abs(localZ)) {
                                gridX = localX > 0 ? 1 : -1;
                            } else {
                                gridZ = localZ > 0 ? 1 : -1;
                            }
            }
          } else {
                        if (typeToPlace === "thin_wood_floor") {
                            // Thin wood floor must align with full tiles (0 or +/-2)
                            gridX = Math.round(gridX / 2) * 2;
                            gridZ = Math.round(gridZ / 2) * 2;
                            gridX = Math.max(-2, Math.min(2, gridX));
                            gridZ = Math.max(-2, Math.min(2, gridZ));
                        } else {
                            gridX = Math.max(-1, Math.min(1, gridX));
                            gridZ = Math.max(-1, Math.min(1, gridZ));
                        }
                        
                        if (Math.abs(gridX) >= 1 && Math.abs(gridZ) >= 1) {
                            if (Math.abs(localX) > Math.abs(localZ)) {
                                gridZ = 0;
                            } else {
                                gridX = 0;
                            }
                        }
                    }

                    floorPreviewCollectible.isValidPlacement = true;
                    floorPreviewCollectible.size = 0.25;

                    const wH = woodFloorHeight + 0.25 * 0.12; // height of wood floor

                    // Center the wall relative to the floor plane but offset up on the floor normal
                    targetPos = [
                        sP[0] + sR[0] * (gridX * 0.15) + sF[0] * (gridZ * 0.15) + sN[0] * (wH / 2),
                        sP[1] + sR[1] * (gridX * 0.15) + sF[1] * (gridZ * 0.15) + sN[1] * (wH / 2),
                        sP[2] + sR[2] * (gridX * 0.15) + sF[2] * (gridZ * 0.15) + sN[2] * (wH / 2)
                    ];

                    pN = [sN[0], sN[1], sN[2]];
                    pR = [sR[0], sR[1], sR[2]];
                    pF = [sF[0], sF[1], sF[2]];
                    isSnapped = true;

                    // Clean column structures collection
                    const columnStructures = [];
                    
                    for (let other of collectibles) {
                      if (other.active && (other.type === "wood_wall" || other.type === "wood_window" || other.type === "wood_door" || other.type === "thin_wood_floor") && !other.isPreview) {
                        const odx = other.position[0] - sP[0];
                        const ody = other.position[1] - sP[1];
                        const odz = other.position[2] - sP[2];
                        
                        const olX = odx * sR[0] + ody * sR[1] + odz * sR[2];
                        const olZ = odx * sF[0] + ody * sF[1] + odz * sF[2];
                        const olN = odx * sN[0] + ody * sN[1] + odz * sN[2];
                        
                        if (Math.abs(olX) <= 0.35 && Math.abs(olZ) <= 0.35) {
                          const ogX = Math.round(olX / 0.15);
                          const ogZ = Math.round(olZ / 0.15);
                          if (ogX === gridX && ogZ === gridZ) {
                            const oLevel = Math.round((olN - wH / 2) / 0.25);
                            columnStructures.push({
                              type: other.type,
                              level: oLevel,
                              item: other
                            });
                          }
                        }
                      }
                    }

                    if (typeToPlace === "wood_wall") {
                      // Stacking: find first level >= 0 that does NOT have a wood_wall, wood_window, or wood_door
                      let targetLevel = 0;
                      while (true) {
                        const hasWallAtLevel = columnStructures.some(s => (s.type === "wood_wall" || s.type === "wood_window" || s.type === "wood_door") && s.level === targetLevel);
                        if (!hasWallAtLevel) {
                          break;
                        }
                        targetLevel++;
                      }

                      if (targetLevel < 10) {
                        floorPreviewCollectible.isValidPlacement = true;
                        floorPreviewCollectible.size = 0.25;
                        
                        targetPos = [
                          sP[0] + sR[0] * (gridX * 0.15) + sF[0] * (gridZ * 0.15) + sN[0] * (wH / 2 + targetLevel * 0.25),
                          sP[1] + sR[1] * (gridX * 0.15) + sF[1] * (gridZ * 0.15) + sN[1] * (wH / 2 + targetLevel * 0.25),
                          sP[2] + sR[2] * (gridX * 0.15) + sF[2] * (gridZ * 0.15) + sN[2] * (wH / 2 + targetLevel * 0.25)
                        ];
                        
                        pN = [sN[0], sN[1], sN[2]];
                        pR = [sR[0], sR[1], sR[2]];
                        pF = [sF[0], sF[1], sF[2]];
                        isSnapped = true;
                      } else {
                        floorPreviewCollectible.isValidPlacement = false;
                        floorPreviewCollectible.size = 0.25;
                      }
                    } else if (typeToPlace === "thin_wood_floor") {
                      // Floor grid coordinates (multiples of 2 for 0.15 grid = 0.3 steps)
                      let fgX = Math.round(localX / 0.3) * 2;
                      let fgZ = Math.round(localZ / 0.3) * 2;
                      
                      // Find if there's a wall under this fgX, fgZ
                      let maxWallLevel = -1;
                      
                      for (let other of collectibles) {
                          if (other.active && (other.type === "wood_wall" || other.type === "wood_window" || other.type === "wood_door") && !other.isPreview) {
                              const odx = other.position[0] - sP[0];
                              const ody = other.position[1] - sP[1];
                              const odz = other.position[2] - sP[2];
                              
                              const olX = odx * sR[0] + ody * sR[1] + odz * sR[2];
                              const olZ = odx * sF[0] + ody * sF[1] + odz * sF[2];
                              const olN = odx * sN[0] + ody * sN[1] + odz * sN[2];
                              
                              const ogX = Math.round(olX / 0.15);
                              const ogZ = Math.round(olZ / 0.15);
                              
                              // Check if this wall is on the edge of our fgX, fgZ floor tile
                              if ((ogX === fgX - 1 && ogZ === fgZ) ||
                                  (ogX === fgX + 1 && ogZ === fgZ) ||
                                  (ogX === fgX && ogZ === fgZ - 1) ||
                                  (ogX === fgX && ogZ === fgZ + 1) ||
                                  (ogX === fgX && ogZ === fgZ)) {
                                  
                                  const oLevel = Math.round((olN - wH / 2) / 0.25);
                                  if (oLevel > maxWallLevel) maxWallLevel = oLevel;
                              }
                          }
                      }
                      
                      if (maxWallLevel >= 0) {
                        floorPreviewCollectible.isValidPlacement = true;
                        floorPreviewCollectible.size = 0.25;
                        
                        // Centered on full floor grid, elevated to top of wall
                        const targetLevel = maxWallLevel + 1;
                        targetPos = [
                          sP[0] + sR[0] * (fgX * 0.15) + sF[0] * (fgZ * 0.15) + sN[0] * (wH / 2 + targetLevel * 0.25),
                          sP[1] + sR[1] * (fgX * 0.15) + sF[1] * (fgZ * 0.15) + sN[1] * (wH / 2 + targetLevel * 0.25),
                          sP[2] + sR[2] * (fgX * 0.15) + sF[2] * (fgZ * 0.15) + sN[2] * (wH / 2 + targetLevel * 0.25)
                        ];
                        pN = [sN[0], sN[1], sN[2]];
                        pR = [sR[0], sR[1], sR[2]];
                        pF = [sF[0], sF[1], sF[2]];
                        isSnapped = true;
                      } else {
                        // Allow extending horizontally from an adjacent thin_wood_floor
                        let adjacentThinFloor = null;
                        for (let other of collectibles) {
                          if (other.active && other.type === "thin_wood_floor" && !other.isPreview) {
                             const odx = other.position[0] - sP[0];
                             const ody = other.position[1] - sP[1];
                             const odz = other.position[2] - sP[2];
                             const olX = odx * sR[0] + ody * sR[1] + odz * sR[2];
                             const olZ = odx * sF[0] + ody * sF[1] + odz * sF[2];
                             const ogX = Math.round(olX / 0.15);
                             const ogZ = Math.round(olZ / 0.15);
                             
                             if ((ogX === fgX - 2 && ogZ === fgZ) ||
                                 (ogX === fgX + 2 && ogZ === fgZ) ||
                                 (ogX === fgX && ogZ === fgZ - 2) ||
                                 (ogX === fgX && ogZ === fgZ + 2)) {
                                 adjacentThinFloor = other;
                                 break;
                             }
                          }
                        }
                        
                        if (adjacentThinFloor) {
                            floorPreviewCollectible.isValidPlacement = true;
                            floorPreviewCollectible.size = 0.25;
                            
                            const odx = adjacentThinFloor.position[0] - sP[0];
                            const ody = adjacentThinFloor.position[1] - sP[1];
                            const odz = adjacentThinFloor.position[2] - sP[2];
                            const olN = odx * sN[0] + ody * sN[1] + odz * sN[2];
                            
                            targetPos = [
                              sP[0] + sR[0] * (fgX * 0.15) + sF[0] * (fgZ * 0.15) + sN[0] * olN,
                              sP[1] + sR[1] * (fgX * 0.15) + sF[1] * (fgZ * 0.15) + sN[1] * olN,
                              sP[2] + sR[2] * (fgX * 0.15) + sF[2] * (fgZ * 0.15) + sN[2] * olN
                            ];
                            pN = [sN[0], sN[1], sN[2]];
                            pR = [sR[0], sR[1], sR[2]];
                            pF = [sF[0], sF[1], sF[2]];
                            isSnapped = true;
                            
                            // Check if another floor is already here
                            for (let other of collectibles) {
                              if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor") && !other.isPreview) {
                                  const ox = other.position[0] - targetPos[0];
                                  const oy = other.position[1] - targetPos[1];
                                  const oz = other.position[2] - targetPos[2];
                                  if (ox*ox + oy*oy + oz*oz < 0.01) {
                                      floorPreviewCollectible.isValidPlacement = false;
                                  }
                              }
            }
          } else {
                            floorPreviewCollectible.isValidPlacement = false;
                            floorPreviewCollectible.size = 0.25;
                        }
            }
          } else {
                      // For wood_window or wood_door: must co-locate with a wood_wall at the targeted aim level
                      const localN = dx * sN[0] + dy * sN[1] + dz * sN[2];
                      const aimLevel = Math.max(0, Math.round((localN - wH / 2) / 0.25));
                      
                      const hasWallAtAimLevel = columnStructures.some(s => s.type === "wood_wall" && s.level === aimLevel);
                      const hasFixtureAtAimLevel = columnStructures.some(s => (s.type === "wood_window" || s.type === "wood_door") && s.level === aimLevel);
                      
                      if (hasWallAtAimLevel && !hasFixtureAtAimLevel) {
                        floorPreviewCollectible.isValidPlacement = true;
                        floorPreviewCollectible.size = 0.25;
                        
                        targetPos = [
                          sP[0] + sR[0] * (gridX * 0.15) + sF[0] * (gridZ * 0.15) + sN[0] * (wH / 2 + aimLevel * 0.25),
                          sP[1] + sR[1] * (gridX * 0.15) + sF[1] * (gridZ * 0.15) + sN[1] * (wH / 2 + aimLevel * 0.25),
                          sP[2] + sR[2] * (gridX * 0.15) + sF[2] * (gridZ * 0.15) + sN[2] * (wH / 2 + aimLevel * 0.25)
                        ];
                        
                        pN = [sN[0], sN[1], sN[2]];
                        pR = [sR[0], sR[1], sR[2]];
                        pF = [sF[0], sF[1], sF[2]];
                        isSnapped = true;
                      } else {
                        floorPreviewCollectible.isValidPlacement = false;
                        floorPreviewCollectible.size = 0.25;
                        
                        targetPos = [
                          sP[0] + sR[0] * (gridX * 0.15) + sF[0] * (gridZ * 0.15) + sN[0] * (wH / 2 + aimLevel * 0.25),
                          sP[1] + sR[1] * (gridX * 0.15) + sF[1] * (gridZ * 0.15) + sN[1] * (wH / 2 + aimLevel * 0.25),
                          sP[2] + sR[2] * (gridX * 0.15) + sF[2] * (gridZ * 0.15) + sN[2] * (wH / 2 + aimLevel * 0.25)
                        ];
                        
                        pN = [sN[0], sN[1], sN[2]];
                        pR = [sR[0], sR[1], sR[2]];
                        pF = [sF[0], sF[1], sF[2]];
                        isSnapped = true;
                      }
                    }
            }
          } else {
                    if (typeToPlace === "wood_chest" || typeToPlace === "meganeura_item" || typeToPlace.startsWith("robot_")) {
                        floorPreviewCollectible.isValidPlacement = !isUnderWater && (slopeVal < 0.6);
                        floorPreviewCollectible.size = 0.25;
                        pN = [pnx, pny, pnz];
                        pR = [previewEast[0] * cosH - previewNorth[0] * sinH, previewEast[1] * cosH - previewNorth[1] * sinH, previewEast[2] * cosH - previewNorth[2] * sinH];
                        pF = [previewNorth[0] * cosH + previewEast[0] * sinH, previewNorth[1] * cosH + previewEast[1] * sinH, previewNorth[2] * cosH + previewEast[2] * sinH];
                    } else {
                        floorPreviewCollectible.isValidPlacement = false;
                        floorPreviewCollectible.size = 0.25;
                    }
            }
          } else {
                // No wood floor found nearby or too far
                if (typeToPlace === "wood_chest" || typeToPlace === "meganeura_item" || typeToPlace.startsWith("robot_")) {
                    floorPreviewCollectible.isValidPlacement = !isUnderWater && (slopeVal < 0.6);
                    floorPreviewCollectible.size = 0.25;
                    pN = [pnx, pny, pnz];
                    pR = [previewEast[0] * cosH - previewNorth[0] * sinH, previewEast[1] * cosH - previewNorth[1] * sinH, previewEast[2] * cosH - previewNorth[2] * sinH];
                    pF = [previewNorth[0] * cosH + previewEast[0] * sinH, previewNorth[1] * cosH + previewEast[1] * sinH, previewNorth[2] * cosH + previewEast[2] * sinH];
                } else {
                    floorPreviewCollectible.isValidPlacement = false;
                    floorPreviewCollectible.size = 0.25;
                }
            }
          }

          // Smooth interpolation (instant if snapped to prevent lag/misalignment)
          const interpSpeed = isSnapped ? 1.0 : 0.3;
          floorPreviewCollectible.position[0] = floorPreviewCollectible.position[0] * (1 - interpSpeed) + targetPos[0] * interpSpeed;
          floorPreviewCollectible.position[1] = floorPreviewCollectible.position[1] * (1 - interpSpeed) + targetPos[1] * interpSpeed;
          floorPreviewCollectible.position[2] = floorPreviewCollectible.position[2] * (1 - interpSpeed) + targetPos[2] * interpSpeed;

          floorPreviewCollectible.normal[0] = pN[0];
          floorPreviewCollectible.normal[1] = pN[1];
          floorPreviewCollectible.normal[2] = pN[2];

          floorPreviewCollectible.R[0] = pR[0];
          floorPreviewCollectible.R[1] = pR[1];
          floorPreviewCollectible.R[2] = pR[2];

          floorPreviewCollectible.F[0] = pF[0];
          floorPreviewCollectible.F[1] = pF[1];
          floorPreviewCollectible.F[2] = pF[2];

          if (floorPreviewCollectible.isValidPlacement === false) {
              floorPreviewCollectible.color = [0.8, 0.2, 0.2]; // red if invalid
          } else {
              floorPreviewCollectible.color = [0.95, 0.85, 0.45]; // yellow if valid
          }

          refreshCollectiblesVBO('preview');
        } else {
          // If NOT placing or inventory is open, hide/remove preview
          if (floorPreviewCollectible) {
            floorPreviewCollectible = null;
            refreshCollectiblesVBO('preview');
          }
        }

        for (let c of collectibles) {
          if (!c.active || !c.isDynamic) continue;
          const _oldP = c.position ? [c.position[0], c.position[1], c.position[2]] : null;
          const _oldR = c.R ? [c.R[0], c.R[1], c.R[2]] : null;

          if ((typeof activeRidingBoat !== "undefined" && c === activeRidingBoat) || 
              (typeof activeRidingMech !== "undefined" && activeRidingMech && (c === activeRidingMech || (activeRidingMech.attachedParts && activeRidingMech.attachedParts.some(ep => ep.item === c))))) {
            c.vel = [0, 0, 0];
            continue;
          }

          if (c.type === "arrow") {
             if (c.isStuck) {
                 continue;
             }

             if (c.attachedToNPC) {
                 if (!c.attachedToNPC.active) {
                     c.active = false;
                 } else {
                     let nPos = c.attachedToNPC.ragdollPos || c.attachedToNPC.position || [0,0,0];
                     c.position[0] = nPos[0] + c.relPos[0];
                     c.position[1] = nPos[1] + c.relPos[1];
                     c.position[2] = nPos[2] + c.relPos[2];
                 }
                 window.pendingDynamicCollectibleRefresh = true;
                 continue;
             }

             // 1) Apply gravity towards the center of the sphere
             const p = c.position;
             const r_dist = Math.sqrt(p[0]**2 + p[1]**2 + p[2]**2);
             
             // Gravity acceleration pulling towards center
             const gravityPower = 0.0008 * (typeof playerScale !== 'undefined' ? playerScale : 0.1); 
             const nx = p[0] / (r_dist || 1);
             const ny = p[1] / (r_dist || 1);
             const nz = p[2] / (r_dist || 1);
             
             // Use Physics engine
             Physics.applyGravity(c.vel, nx, ny, nz, 1.0, gravityPower);
             
             // 2) Update position using velocity
             p[0] += c.vel[0];
             p[1] += c.vel[1];
             p[2] += c.vel[2];
             
             // 3) Update orientation: forward F should align with velocity
             const speed = Math.sqrt(c.vel[0]**2 + c.vel[1]**2 + c.vel[2]**2);
             if (speed > 0.0001) {
                 c.F = [c.vel[0] / speed, c.vel[1] / speed, c.vel[2] / speed];
                 const localUp = [nx, ny, nz];
                 let right = [
                     c.F[1]*localUp[2] - c.F[2]*localUp[1],
                     c.F[2]*localUp[0] - c.F[0]*localUp[2],
                     c.F[0]*localUp[1] - c.F[1]*localUp[0]
                 ];
                 const lenR = Math.sqrt(right[0]**2 + right[1]**2 + right[2]**2);
                 if (lenR > 0.001) {
                     c.R = [right[0]/lenR, right[1]/lenR, right[2]/lenR];
                 } else {
                     c.R = [1, 0, 0];
                 }
                 c.normal = [
                     c.R[1]*c.F[2] - c.R[2]*c.F[1],
                     c.R[2]*c.F[0] - c.R[0]*c.F[2],
                     c.R[0]*c.F[1] - c.R[1]*c.F[0]
                 ];
             }
             
             // 4) Check collision with amphibians (NPCs)
             let hitNPC = false;
             if (typeof amphibians !== "undefined" && amphibians) {
                 for (let npc of amphibians) {
                     if (npc.ragdollEnabled) continue;
                     
                     // Get NPC position
                     let nPos = npc.position || [0, 0, 0];
                     if (npc.ragdollPos && npc.ragdollInitialized) {
                         nPos = npc.ragdollPos;
                     }
                     const dx = p[0] - nPos[0];
                     const dy = p[1] - nPos[1];
                     const dz = p[2] - nPos[2];
                     const distSq = dx*dx + dy*dy + dz*dz;
                     const hitRadius = npc.type === "meganeura" ? 0.25 : 0.45;
                      if (distSq < hitRadius * hitRadius) {
                          // Hit!
                          if (npc.hp === undefined) {
                              const isMeg = npc.type === 'meganeura';
                              npc.hp = isMeg ? 3 : 1;
                              npc.maxHp = isMeg ? 3 : 1;
                          }
                          npc.hp -= 1;
                          let hpHearts = "";
                          for (let i = 0; i < npc.maxHp; i++) {
                              hpHearts += i < npc.hp ? "🔴" : "⚪";
                          }
                          showNotice("🎯 ยิงถูกเป้าหมาย! (Target hit!) " + hpHearts);
                          
                          if (npc.hp <= 0) {
                              npc.ragdollEnabled = true;
                              showNotice("💀 กำจัดเป้าหมายสำเร็จ! (Target eliminated!)");
                          } else {
                              npc.ragdollEnabled = false;
                          }
                         
                         const normV = speed > 0 ? [c.vel[0]/speed, c.vel[1]/speed, c.vel[2]/speed] : [0, 0, 0];
                         npc.ragdollVel = [
                             c.vel[0] * 0.4,
                             c.vel[1] * 0.4,
                             c.vel[2] * 0.4
                         ];
                         
                         if (typeof playSplashSound === "function") {
                             playSplashSound(1.0);
                         }
                         
                         c.attachedToNPC = npc;
                         c.relPos = [p[0] - nPos[0], p[1] - nPos[1], p[2] - nPos[2]];
                         c.vel = [0, 0, 0];
                         window.pendingDynamicCollectibleRefresh = true;
                         hitNPC = true;
                         // Already showed custom HP notice
                         break;
                     }
                 }
             }
             
             if (hitNPC) {
                 window.pendingDynamicCollectibleRefresh = true;
                 continue;
             }
             
             // 5) Check ground/terrain collision
             const theta_coords = Math.acos(Math.max(-1.0, Math.min(1.0, ny)));
             const phi_coords = Math.atan2(p[2], p[0]);
             const terrainH = getHeightOnSphere(theta_coords, phi_coords, globalSeed);
             const terrainRad = RADIUS + terrainH * HEIGHT_SCALE;
             
             const current_dist = Math.sqrt(p[0]**2 + p[1]**2 + p[2]**2);
             const coreCollectible = collectibles.find(c => c.type === "planet_core");
             const coreRadius = coreCollectible ? coreCollectible.radius : 2.0;
             if (current_dist <= coreRadius) {
                 p[0] = nx * (coreRadius + 0.001);
                 p[1] = ny * (coreRadius + 0.001);
                 p[2] = nz * (coreRadius + 0.001);
                 c.vel = [0, 0, 0];
                 c.isStuck = true;
                 
                 if (typeof playPlaceSound === "function") {
                     playPlaceSound();
                 }
                 window.pendingDynamicCollectibleRefresh = true;
                 continue;
             }
             
             if (current_dist <= terrainRad) {
                 // Stick into ground
                 p[0] = nx * (terrainRad + 0.001);
                 p[1] = ny * (terrainRad + 0.001);
                 p[2] = nz * (terrainRad + 0.001);
                 
                 c.vel = [0, 0, 0];
                 c.isStuck = true;
                 
                 if (typeof playPlaceSound === "function") {
                     playPlaceSound();
                 }
                 window.pendingDynamicCollectibleRefresh = true;
                 continue;
             }
             
             if (c.isDynamic !== false) {
                 window.pendingDynamicCollectibleRefresh = true;
             }
             continue;
          }

          if (c.type === "plank") {
            const sinTheta = Math.sin(charTheta);
            const cosTheta = Math.cos(charTheta);
            const sinPhi = Math.sin(charPhi);
            const cosPhi = Math.cos(charPhi);

            const nx = sinTheta * cosPhi;
            const ny = cosTheta;
            const nz = sinTheta * sinPhi;
            
            let height = getHeightOnSphere(charTheta, charPhi, globalSeed);
            let terrainRadius = RADIUS + height * HEIGHT_SCALE;
            let groundRadius = terrainRadius;
            const waterRadius = RADIUS + waterLevel * 0.15;
            if (waterEnabled && terrainRadius < waterRadius) {
                groundRadius = waterRadius;
            }
            
            const East = [-sinPhi, 0, cosPhi];
            const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];

            const cosH = Math.cos(charHeading);
            const sinH = Math.sin(charHeading);

            const F = [
              North[0] * cosH + East[0] * sinH,
              North[1] * cosH + East[1] * sinH,
              North[2] * cosH + East[2] * sinH,
            ];

            const R = [
              East[0] * cosH - North[0] * sinH,
              East[1] * cosH - North[1] * sinH,
              East[2] * cosH - North[2] * sinH,
            ];

            const dropDist = 0.5; // distance in front
            const bob = Math.sin(Date.now() * 0.003) * 0.05 + 0.15; // float above ground
            const targetPos = [
                (groundRadius + bob) * nx + F[0] * dropDist,
                (groundRadius + bob) * ny + F[1] * dropDist,
                (groundRadius + bob) * nz + F[2] * dropDist
            ];

            c.position[0] = c.position[0] * 0.85 + targetPos[0] * 0.15;
            c.position[1] = c.position[1] * 0.85 + targetPos[1] * 0.15;
            c.position[2] = c.position[2] * 0.85 + targetPos[2] * 0.15;

            c.normal[0] = c.normal[0] * 0.85 + nx * 0.15;
            c.normal[1] = c.normal[1] * 0.85 + ny * 0.15;
            c.normal[2] = c.normal[2] * 0.85 + nz * 0.15;

            c.R[0] = c.R[0] * 0.85 + R[0] * 0.15;
            c.R[1] = c.R[1] * 0.85 + R[1] * 0.15;
            c.R[2] = c.R[2] * 0.85 + R[2] * 0.15;

            c.F[0] = c.F[0] * 0.85 + F[0] * 0.15;
            c.F[1] = c.F[1] * 0.85 + F[1] * 0.15;
            c.F[2] = c.F[2] * 0.85 + F[2] * 0.15;

            needRefresh = true;
            continue;
          }
          
          if (!c.vel) {
            // initial velocity outward from the tree (greatly reduced to stay in the same spot)
            const vOut = 0.002 + Math.random() * 0.003;
            const vUp = 0.003 + Math.random() * 0.005;
            c.vel = [
              c.F[0] * vOut + c.normal[0] * vUp,
              c.F[1] * vOut + c.normal[1] * vUp,
              c.F[2] * vOut + c.normal[2] * vUp,
            ];
          }

          const r = Math.sqrt(
            c.position[0] ** 2 + c.position[1] ** 2 + c.position[2] ** 2,
          );
          
          if (r > 0.001) {
            const nx = c.position[0] / r;
            const ny = c.position[1] / r;
            const nz = c.position[2] / r;

            let force = gravityAccel;
            
            // Check if collectible is in water
            let theta = Math.acos(Math.max(-1.0, Math.min(1.0, c.position[1] / (r || 1))));
            let phi = Math.atan2(c.position[2], c.position[0]);
            let height = getHeightOnSphere(theta, phi, globalSeed);
            let caveDataForCol = getTerrainSurfaceAndCeiling(c.position[0]/(r||1), c.position[1]/(r||1), c.position[2]/(r||1), r);
            let terrainRadius = caveDataForCol.ground;
            const waterRadius = RADIUS + waterLevel * 0.15;
            
            let isLogFloat = ((c.type === "log" || c.type === "branch" || c.type === "plank" || c.type === "wood_floor" || c.type === "thin_wood_floor" || c.type === "wood_boat") && waterEnabled && !caveDataForCol.insideTunnel && terrainRadius < waterRadius && r <= waterRadius + 0.1);

            if (isLogFloat) {
                // Buoyant force counters gravity and pushes it up to the surface
                const depth = waterRadius - r;
                // Target radius for the log to float is slightly below the water surface so it looks half-submerged
                let targetR = waterRadius - 0.005; 
                if (c.type === "wood_boat") {
                    let wpx = c.position[0], wpy = c.position[1], wpz = c.position[2];
                    let rLen = Math.sqrt(wpx*wpx + wpy*wpy + wpz*wpz) || 1;
                    const wave = getWaterWave(wpx/rLen*waterRadius, wpy/rLen*waterRadius, wpz/rLen*waterRadius, waterAnimTime, waveStrength);
                    // The boat has gravity pulling it down. Under the spring force, it settles at targetR - 0.07.
                    // To make it float properly we adjust the targetR slightly below the water surface.
                    targetR = waterRadius + wave - 0.02;
                }
                const bobOffset = Math.sin(Date.now() * 0.002 + c.seed * 100) * 0.0003;
                force = gravityAccel - (targetR - r) * 0.05 - bobOffset;
                
                // Extra damping for water
                Physics.applyFriction(c.vel, 0.90);
                c.spinSpeed *= 0.85;

                // Gradually align normal to point up so the log lies flat on the water
                c.normal[0] = c.normal[0] * 0.9 + nx * 0.1;
                c.normal[1] = c.normal[1] * 0.9 + ny * 0.1;
                c.normal[2] = c.normal[2] * 0.9 + nz * 0.1;
                const nLen = Math.sqrt(c.normal[0]**2 + c.normal[1]**2 + c.normal[2]**2);
                c.normal[0] /= nLen;
                c.normal[1] /= nLen;
                c.normal[2] /= nLen;

                // Re-orthogonalize R and F
                let dot = c.R[0]*c.normal[0] + c.R[1]*c.normal[1] + c.R[2]*c.normal[2];
                c.R[0] -= dot * c.normal[0];
                c.R[1] -= dot * c.normal[1];
                c.R[2] -= dot * c.normal[2];
                let rLen = Math.sqrt(c.R[0]**2 + c.R[1]**2 + c.R[2]**2);
                if (rLen > 0.001) {
                    c.R[0] /= rLen; c.R[1] /= rLen; c.R[2] /= rLen;
                } else {
                    // Fallback
                    c.R = [c.normal[1], -c.normal[0], 0];
                }
                c.F = [
                  c.R[1]*c.normal[2] - c.R[2]*c.normal[1],
                  c.R[2]*c.normal[0] - c.R[0]*c.normal[2],
                  c.R[0]*c.normal[1] - c.R[1]*c.normal[0]
                ];
            } else {
                // Air friction (dampen quickly to land smoothly)
                Physics.applyFriction(c.vel, 0.82);
            }

            c.vel[0] -= nx * force;
            c.vel[1] -= ny * force;
            c.vel[2] -= nz * force;
          }

          c.position[0] += c.vel[0];
          c.position[1] += c.vel[1];
          c.position[2] += c.vel[2];
          
          // Random tumbling rotation logic for the logs
          if (!c.spinAxis) {
              const ax = Math.random() - 0.5;
              const ay = Math.random() - 0.5;
              const az = Math.random() - 0.5;
              const alen = Math.sqrt(ax*ax + ay*ay + az*az) || 1;
              c.spinAxis = [ax/alen, ay/alen, az/alen];
              c.spinSpeed = (Math.random() - 0.5) * 0.2;
          }
          
          // Ground collision
          let theta = Math.acos(Math.max(-1.0, Math.min(1.0, c.position[1] / (r || 1))));
          let phi = Math.atan2(c.position[2], c.position[0]);
          let height = getHeightOnSphere(theta, phi, globalSeed);
          let terrainRadius = RADIUS + height * HEIGHT_SCALE;
          const waterRadius = RADIUS + waterLevel * 0.15;
          
          let groundRadius = terrainRadius;
          let isInWater = false;
          if (waterEnabled && terrainRadius < waterRadius) {
            groundRadius = waterRadius;
            isInWater = true;
          }
          
          let collisionRadius = groundRadius;
          let pitchGrade = 0;
          let rollGrade = 0;
          
          if (c.type === "wood_boat" && (c.hasWheel || c.hasWheels || (c.wheelCount && c.wheelCount > 0)) && !isInWater) {
              const fSideOff = typeof window.wheelFrontSideOffset === "number" ? window.wheelFrontSideOffset : 0.18;
              const fFwdOff  = typeof window.wheelFrontFwdOffset  === "number" ? window.wheelFrontFwdOffset  : 0.18;
              const fUpOff   = typeof window.wheelFrontUpOffset   === "number" ? window.wheelFrontUpOffset   : -0.03;

              const rSideOff = typeof window.wheelRearSideOffset === "number" ? window.wheelRearSideOffset : 0.18;
              const rFwdOff  = typeof window.wheelRearFwdOffset  === "number" ? window.wheelRearFwdOffset  : 0.18;
              const rUpOff   = typeof window.wheelRearUpOffset   === "number" ? window.wheelRearUpOffset   : -0.03;

              const wheelScale = typeof window.wheelScaleMultiplier === "number" ? window.wheelScaleMultiplier : 1.0;
              const wheelRadius = 0.16 * wheelScale;

              const nx = c.position[0] / (r || 1);
              const ny = c.position[1] / (r || 1);
              const nz = c.position[2] / (r || 1);
              const bF = c.F, bR_vec = c.R;

              const wheelOffsets = [
                  { side: -1, fwd: fFwdOff,  sOff: fSideOff, uOff: fUpOff },
                  { side: 1,  fwd: fFwdOff,  sOff: fSideOff, uOff: fUpOff },
                  { side: -1, fwd: -rFwdOff, sOff: rSideOff, uOff: rUpOff },
                  { side: 1,  fwd: -rFwdOff, sOff: rSideOff, uOff: rUpOff }
              ];
              
              let maxWheelRequiredRadius = -Infinity;
              let wHeights = [];
              
              for (let wo of wheelOffsets) {
                  let wOffX = bR_vec[0] * (wo.side * wo.sOff) + nx * wo.uOff + bF[0] * wo.fwd;
                  let wOffY = bR_vec[1] * (wo.side * wo.sOff) + ny * wo.uOff + bF[1] * wo.fwd;
                  let wOffZ = bR_vec[2] * (wo.side * wo.sOff) + nz * wo.uOff + bF[2] * wo.fwd;
                  let wWorldX = terrainRadius * nx + wOffX;
                  let wWorldY = terrainRadius * ny + wOffY;
                  let wWorldZ = terrainRadius * nz + wOffZ;
                  let wR = Math.sqrt(wWorldX*wWorldX + wWorldY*wWorldY + wWorldZ*wWorldZ) || 1;
                  let wTheta = Math.acos(Math.max(-1, Math.min(1, wWorldY / wR)));
                  let wPhi = Math.atan2(wWorldZ, wWorldX);
                  let wTerrainRad = RADIUS + getHeightOnSphere(wTheta, wPhi, globalSeed) * HEIGHT_SCALE;
                  
                  let wSurfaceRad = wTerrainRad;
                  if (waterEnabled && wTerrainRad < waterRadius) {
                      let waveVal = getWaterWave ? getWaterWave(wWorldX, wWorldY, wWorldZ, waterAnimTime, waveStrength) : 0;
                      let depth = waterRadius - wTerrainRad;
                      let fade = Math.min(1.0, Math.max(0.0, depth / 0.1));
                      wSurfaceRad = waterRadius + waveVal * fade;
                  }
                  wHeights.push(wSurfaceRad);

                  let requiredBoatRad = wTerrainRad + wheelRadius - wo.uOff;
                  if (requiredBoatRad > maxWheelRequiredRadius) {
                      maxWheelRequiredRadius = requiredBoatRad;
                  }
              }
              
              collisionRadius = Math.max(terrainRadius + wheelRadius - fUpOff, maxWheelRequiredRadius);
              
              let fl = wHeights[0], fr = wHeights[1], rl = wHeights[2], rr = wHeights[3];
              let fAvg = (fl + fr) * 0.5;
              let rAvg = (rl + rr) * 0.5;
              let lAvg = (fl + rl) * 0.5;
              let rSideAvg = (fr + rr) * 0.5;

              pitchGrade = (fAvg - rAvg) / (fFwdOff + rFwdOff + 0.001);
              rollGrade = (rSideAvg - lAvg) / (fSideOff + rSideOff + 0.001);
              
              pitchGrade = Math.max(-0.5, Math.min(0.5, pitchGrade));
              rollGrade  = Math.max(-0.5, Math.min(0.5, rollGrade));
              
          } else if (isInWater && (c.type === "log" || c.type === "branch" || c.type === "plank" || c.type === "wood_floor" || c.type === "thin_wood_floor" || c.type === "wood_boat")) {
              // Logs don't collide with the water surface as hard ground, they collide with the terrain below it
              collisionRadius = terrainRadius;
          }
          
          if (r < collisionRadius) {
            // Hit ground/water
            const nx = c.position[0] / r;
            const ny = c.position[1] / r;
            const nz = c.position[2] / r;
            
            c.position[0] = nx * collisionRadius;
            c.position[1] = ny * collisionRadius;
            c.position[2] = nz * collisionRadius;
            
            // bounce and friction
            const dot = c.vel[0] * nx + c.vel[1] * ny + c.vel[2] * nz;
            let isWheeledBoat = c.type === "wood_boat" && (c.hasWheel || c.hasWheels || (c.wheelCount && c.wheelCount > 0)) && !isInWater;
            if (dot < 0) {
                let restitution = isWheeledBoat ? 1.0 : 1.3;
                c.vel[0] -= dot * nx * restitution;
                c.vel[1] -= dot * ny * restitution;
                c.vel[2] -= dot * nz * restitution;
            }
            let friction = 0.6;
            if (isWheeledBoat) {
                friction = 1.0; // Speed is handled by vehSpeed instead of c.vel friction
                c.spinSpeed = 0; // Wheeled boats align to terrain instead of spinning

                const bF = c.F, bR_vec = c.R;
                
                let pSpeed = typeof window.playerSpeed !== "undefined" ? window.playerSpeed : 0.005;
                let vehSpeed = typeof c.vehicleSpeed !== "undefined" ? c.vehicleSpeed : 0;
                let dt = typeof window.timeScale !== "undefined" ? window.timeScale : 1.0;

                // 1. Apply gravity to vehSpeed
                let gravityRollPower = pitchGrade * pSpeed * 0.5 * dt;
                vehSpeed -= gravityRollPower;

                // 2. Apply coast friction
                vehSpeed *= Math.pow(0.98, dt);
                if (Math.abs(vehSpeed) < 0.00001) vehSpeed = 0;
                c.vehicleSpeed = vehSpeed;

                // 3. Move along forward vector
                c.vel[0] = bF[0] * vehSpeed;
                c.vel[1] = bF[1] * vehSpeed;
                c.vel[2] = bF[2] * vehSpeed;

                // 4. Update wheel spin visually
                let moveDir = vehSpeed >= 0 ? 1 : -1;
                const wheelScale = typeof window.wheelScaleMultiplier === "number" ? window.wheelScaleMultiplier : 1.0;
                const wheelRadius = 0.16 * wheelScale;
                const distTraveled = vehSpeed * dt;
                c.spinAngle = (c.spinAngle || 0) + (distTraveled / wheelRadius);

                // 5. Normal tilt calculation
                let tiltNx = nx + bF[0] * pitchGrade * 0.4 + bR_vec[0] * rollGrade * 0.4;
                let tiltNy = ny + bF[1] * pitchGrade * 0.4 + bR_vec[1] * rollGrade * 0.4;
                let tiltNz = nz + bF[2] * pitchGrade * 0.4 + bR_vec[2] * rollGrade * 0.4;
                let tiltLen = Math.sqrt(tiltNx*tiltNx + tiltNy*tiltNy + tiltNz*tiltNz) || 1;
                c.normal = [tiltNx/tiltLen, tiltNy/tiltLen, tiltNz/tiltLen];

                // 6. Turn based on steer angle
                let currentSteer = c.steerAngle || 0;
                if (Math.abs(vehSpeed) > 0.001 && Math.abs(currentSteer) > 0.01) {
                    const topFwdSpeed = pSpeed * 5.0;
                    const turnRate = currentSteer * (Math.abs(vehSpeed) / topFwdSpeed) * 0.03 * moveDir;
                    
                    // Rotate F and R around normal by turnRate
                    let cosT = Math.cos(turnRate * dt);
                    let sinT = Math.sin(turnRate * dt);
                    
                    let rx = c.R[0]*cosT + c.F[0]*sinT;
                    let ry = c.R[1]*cosT + c.F[1]*sinT;
                    let rz = c.R[2]*cosT + c.F[2]*sinT;
                    
                    let fx = -c.R[0]*sinT + c.F[0]*cosT;
                    let fy = -c.R[1]*sinT + c.F[1]*cosT;
                    let fz = -c.R[2]*sinT + c.F[2]*cosT;
                    
                    c.R = [rx, ry, rz];
                    c.F = [fx, fy, fz];
                }

                // 7. Orthogonalize F and R
                let fDot = c.F[0]*c.normal[0] + c.F[1]*c.normal[1] + c.F[2]*c.normal[2];
                let newF = [c.F[0] - fDot*c.normal[0], c.F[1] - fDot*c.normal[1], c.F[2] - fDot*c.normal[2]];
                let lenF = Math.sqrt(newF[0]**2 + newF[1]**2 + newF[2]**2);
                if (lenF > 0.001) { c.F = [newF[0]/lenF, newF[1]/lenF, newF[2]/lenF]; }
                c.R = [c.normal[1]*c.F[2] - c.normal[2]*c.F[1], c.normal[2]*c.F[0] - c.normal[0]*c.F[2], c.normal[0]*c.F[1] - c.normal[1]*c.F[0]];
            }
            Physics.applyFriction(c.vel, friction);
            
            c.spinSpeed *= friction;

            // Stop moving if very slow
            const speedSq = c.vel[0]**2 + c.vel[1]**2 + c.vel[2]**2;
            if (speedSq < 0.0001 && Math.abs(c.spinSpeed) < 0.02 && c.type !== "wood_boat") {
                
                
                
                // Align normal to the surface
                c.normal = [nx, ny, nz];
                
                // Preserve original forward direction as much as possible
                let fDot = c.F[0]*nx + c.F[1]*ny + c.F[2]*nz;
                let newF = [c.F[0] - fDot*nx, c.F[1] - fDot*ny, c.F[2] - fDot*nz];
                let lenF = Math.sqrt(newF[0]**2 + newF[1]**2 + newF[2]**2);
                if (lenF > 0.001) {
                  c.F = [newF[0]/lenF, newF[1]/lenF, newF[2]/lenF];
                } else {
                  if (Math.abs(ny) < 0.9) {
                    c.F = [-nz, 0, nx];
                  } else {
                    c.F = [1, 0, 0];
                  }
                  let len = Math.sqrt(c.F[0]**2 + c.F[1]**2 + c.F[2]**2);
                  c.F = [c.F[0]/len, c.F[1]/len, c.F[2]/len];
                }
                
                c.R = [
                  c.normal[1]*c.F[2] - c.normal[2]*c.F[1],
                  c.normal[2]*c.F[0] - c.normal[0]*c.F[2],
                  c.normal[0]*c.F[1] - c.normal[1]*c.F[0]
                ];
            }
          } else {
             // apply spin
             const sAngle = c.spinSpeed;
             const sCos = Math.cos(sAngle);
             const sSin = Math.sin(sAngle);
             const ax = c.spinAxis[0], ay = c.spinAxis[1], az = c.spinAxis[2];
             
             const rotateVec = (v) => {
                 const dot = v[0]*ax + v[1]*ay + v[2]*az;
                 return [
                     v[0]*sCos + (ay*v[2] - az*v[1])*sSin + ax*dot*(1-sCos),
                     v[1]*sCos + (az*v[0] - ax*v[2])*sSin + ay*dot*(1-sCos),
                     v[2]*sCos + (ax*v[1] - ay*v[0])*sSin + az*dot*(1-sCos)
                 ];
             };
             
             c.R = rotateVec(c.R);
             c.F = rotateVec(c.F);
             c.normal = rotateVec(c.normal);
          }
          
          if (_oldP && (Math.abs(c.position[0]-_oldP[0])>1e-6 || Math.abs(c.position[1]-_oldP[1])>1e-6 || Math.abs(c.position[2]-_oldP[2])>1e-6)) needRefresh = true;
          if (_oldR && c.R && (Math.abs(c.R[0]-_oldR[0])>1e-6 || Math.abs(c.R[1]-_oldR[1])>1e-6 || Math.abs(c.R[2]-_oldR[2])>1e-6)) needRefresh = true;
        }
        
        if (activeRidingBoat) {
            needRefresh = true;
        }

        if (needMainRefresh) {
            window.pendingCollectibleRefresh = true;
        }
        if (needRefresh) {
            window.pendingDynamicCollectibleRefresh = true;
        }
      }