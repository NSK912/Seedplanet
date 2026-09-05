// === SEEDPLANET MODULE: JS/PLAYER.JS ===

      function getHeldItem() {
        if (typeof selectedActionSlotIndex !== "undefined" && selectedActionSlotIndex !== -1 && typeof actionSlotsItems !== "undefined" && actionSlotsItems && actionSlotsItems[selectedActionSlotIndex]) {
          const item = actionSlotsItems[selectedActionSlotIndex];
          if (item && (item.count === undefined || item.count > 0)) {
            return item;
          }
        }
        if (typeof activeItem !== "undefined" && activeItem && activeItem.name !== "HAND") {
          return activeItem;
        }
        return null;
      }
      window.getHeldItem = getHeldItem;

      function updatePlayerHPUI() {
        const hpContainer = document.getElementById("playerHpVerticalContainer");
        if (!hpContainer) return;
        
        hpContainer.innerHTML = "";
        
        const totalSlots = playerMaxHP;
        const filledSlots = playerHP;
        
        for (let s = 0; s < totalSlots; s++) {
          const slotDiv = document.createElement("div");
          slotDiv.className = "player-hp-slot-minimal";
          if (s < filledSlots) {
            slotDiv.className += " filled";
          }
          hpContainer.appendChild(slotDiv);
        }
      }

      function project3DTo2D(pos3D, viewProj, width, height) {
        const x = pos3D[0], y = pos3D[1], z = pos3D[2];
        const m = viewProj;
        const rx = m[0]*x + m[4]*y + m[8]*z + m[12];
        const ry = m[1]*x + m[5]*y + m[9]*z + m[13];
        const rz = m[2]*x + m[6]*y + m[10]*z + m[14];
        const rw = m[3]*x + m[7]*y + m[11]*z + m[15];
        
        if (rw <= 0) return null; // Behind camera
        
        const ndcX = rx / rw;
        const ndcY = ry / rw;
        const ndcZ = rz / rw;
        
        if (ndcZ < -1 || ndcZ > 1) return null; // Outside depth bounds
        
        const screenX = (ndcX * 0.5 + 0.5) * width;
        const screenY = (1.0 - (ndcY * 0.5 + 0.5)) * height;
        
        return { x: screenX, y: screenY, z: ndcZ };
      }

      function updateFloatingNpcHpBars(vMat, pMat, eyePos) {
        const overlay = document.getElementById("npcHpOverlay");
        if (!overlay) return;
        
        if (!gameStarted || !amphibians || amphibians.length === 0) {
          if (overlay._lastHtml !== "") {
            overlay._lastHtml = "";
            overlay.innerHTML = "";
          }
          return;
        }
        
        const viewProj = multiplyMatrices(pMat, vMat);
        let htmlContent = "";
        
        for (let i = 0; i < amphibians.length; i++) {
          const c = amphibians[i];
          if (c.ragdollEnabled || !c.hp || c.hp <= 0) {
            continue;
          }
          
          // Only show floating HP bar for the active targeted/locked NPC
          if (activeTargetNPC !== c) {
            continue;
          }
          
          const sinT = Math.sin(c.theta);
          const cosT = Math.cos(c.theta);
          const sinP = Math.sin(c.phi);
          const cosP = Math.cos(c.phi);
          
          const nx = sinT * cosP;
          const ny = cosT;
          const nz = sinT * sinP;
          
          // Offset above the NPC's center so it floats perfectly above their head/body
          const floatOffset = 0.22; 
          const pos3D = [
            (c.r + floatOffset) * nx,
            (c.r + floatOffset) * ny,
            (c.r + floatOffset) * nz
          ];
          
          // Check planet occlusion to prevent showing through the planet geometry
          if (eyePos && typeof checkPlanetOcclusion === "function") {
            const isOccluded = checkPlanetOcclusion(eyePos, [c.r * nx, c.r * ny, c.r * nz], RADIUS);
            if (isOccluded) {
              continue;
            }
          }
          
          const screenPos = project3DTo2D(pos3D, viewProj, canvas.width, canvas.height);
          
          if (screenPos) {
            let slotsHtml = "";
            for (let s = 0; s < c.maxHp; s++) {
              const isFilled = s < c.hp;
              slotsHtml += `<div class="npc-hp-slot${isFilled ? ' filled' : ''}"></div>`;
            }
            
            const rect = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
            const cssX = rect.left + (screenPos.x / window.innerWidth) * rect.width;
            const cssY = rect.top + (screenPos.y / window.innerHeight) * rect.height;
            
            htmlContent += `
              <div class="npc-hp-bar" style="transform: translate(${Math.round(cssX)}px, ${Math.round(cssY)}px) translate(-50%, -100%); left: 0; top: 0;">
                ${slotsHtml}
              </div>
            `;
          }
        }
        
        if (overlay._lastHtml !== htmlContent) {
          overlay._lastHtml = htmlContent;
          overlay.innerHTML = htmlContent;
        }
      }

      function damagePlayer(amount = 1) {
        if (playerHP <= 0 || playerDamageCooldown > 0) return;
        
        playerHP = Math.max(0, playerHP - amount);
        updatePlayerHPUI();
        
        // Show flash effect
        const flash = document.getElementById("damageFlash");
        if (flash) {
          flash.style.display = "block";
          flash.style.opacity = "1";
          let op = 1.0;
          const fadeInterval = setInterval(() => {
            op -= 0.05;
            if (op <= 0) {
              clearInterval(fadeInterval);
              flash.style.display = "none";
            } else {
              flash.style.opacity = op;
            }
          }, 20);
        }
        
        if (typeof playSplashSound === "function") {
          playSplashSound(1.2);
        }
        
        if (playerHP <= 0) {
          triggerUnconscious();
        } else {
          playerDamageCooldown = 1.5; // 1.5 seconds invincibility
          showNotice(`⚠️ คุณถูกทำร้าย! HP: ${playerHP}/${playerMaxHP}`);
        }
      }

      function triggerUnconscious() {
        playerControlsLocked = true;
        setRagdoll(true);
        
        // ปล่อย Meganeura ทุกตัวที่เกาะตัวละครอยู่ทันทีเมื่อหมดสติ
        if (typeof amphibians !== "undefined" && Array.isArray(amphibians)) {
          for (let i = 0; i < amphibians.length; i++) {
            if (amphibians[i] && amphibians[i].type === "meganeura") {
              amphibians[i].attachedToPlayer = false;
            }
          }
        }

        // Wait 3 seconds in ragdoll mode before respawning (No black screen fade)
        setTimeout(() => {
          let spawned = false;
          if (typeof window.getHouseSpawnLocation === "function") {
            const houseSpawn = window.getHouseSpawnLocation();
            if (houseSpawn && typeof houseSpawn.theta === "number") {
              charTheta = houseSpawn.theta;
              charPhi = houseSpawn.phi;
              spawned = true;
            }
          }

          if (!spawned) {
            let foundSpot = false;
            let newTheta = charTheta;
            let newPhi = charPhi;
            for (let attempts = 0; attempts < 30; attempts++) {
              const distOffset = 0.15 + Math.random() * 0.20;
              const angleDir = Math.random() * Math.PI * 2;
              
              const testTheta = Math.max(0.1, Math.min(Math.PI - 0.1, charTheta + Math.cos(angleDir) * distOffset));
              let testPhi = charPhi + Math.sin(angleDir) * distOffset;
              if (testPhi < 0) testPhi += Math.PI * 2;
              if (testPhi > Math.PI * 2) testPhi -= Math.PI * 2;
              
              const height = getVisualHeightOnSphere(testTheta, testPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
              const terrainRad = RADIUS + height * HEIGHT_SCALE;
              const waterRadius = RADIUS + waterLevel * 0.15;
              if (!waterEnabled || terrainRad > waterRadius) {
                newTheta = testTheta;
                newPhi = testPhi;
                foundSpot = true;
                break;
              }
            }
            if (!foundSpot) {
              const distOffset = 0.15 + Math.random() * 0.20;
              const angleDir = Math.random() * Math.PI * 2;
              newTheta = Math.max(0.1, Math.min(Math.PI - 0.1, charTheta + Math.cos(angleDir) * distOffset));
              newPhi = charPhi + Math.sin(angleDir) * distOffset;
              if (newPhi < 0) newPhi += Math.PI * 2;
              if (newPhi > Math.PI * 2) newPhi -= Math.PI * 2;
            }
            charTheta = newTheta;
            charPhi = newPhi;
          }
          
          playerHP = playerMaxHP;
          updatePlayerHPUI();
          playerDamageCooldown = 2.0;
          playerControlsLocked = false;
          setRagdoll(false);
          
          saveSettingsToLocalStorage();
        }, 3000); // 3 seconds ragdoll
      }
      let playerScale = 0.1;
      let playerCenterRadius = null;
      let playerVerticalVel = 0.0;
      let isPlayerGrounded = true;
      let ragdollInitialized = false;
      let ragdollDiedOnSurface = false;
      let ragdollPos = [0, 0, 0];
      let ragdollVel = [0, 0, 0];
      let ragdollAxis = [1, 0, 0];
      let ragdollAngle = 0;
      let ragdollAngularSpeed = 0.1;
      let ragdollBaseMatrix = null;
      let ragdollLimbs = {
        aL: 0,
        aR: 0,
        eL: 0.1,
        eR: 0.1,
        lL: 0,
        lR: 0,
        kL: 0.1,
        kR: 0.1,
        vaL: 0,
        vaR: 0,
        veL: 0,
        veR: 0,
        vlL: 0,
        vlR: 0,
        vkL: 0,
        vkR: 0,
      };

      var RADIUS = 8.0;
      var HEIGHT_SCALE = 0.6;
      var globalSeed = 0;

      // COLLISION_LAYERS is already declared globally in collision.js

      let waterEnabled = true;
      let caveWaterEnabled = true;
      let waterLevel = 0.0;
      let waterOpacity = 0.4;
      let waveStrength = 0.02;
      let waterColor = [0.0, 0.4, 0.667];
      let waterTime = 0;
      let waterVerticesCache = null;

      let atmosphereEnabled = true;
      let atmosphereAlpha = 0.6;
      let atmosphereScale = 2.5;
      let atmosphereColor = [0.3, 0.46, 1.0]; // hex #4d94ff
      let atmosphereVertexBuffer = null;
      let atmosphereIndexBuffer = null;
      let atmosphereIndicesLength = 0;

      let skyEnabled = true;
      let skyGasIntensity = 0.75;
      let skyVertexBuffer = null;
      let skyIndexBuffer = null;
      let skyIndicesLength = 0;

      let cloudsEnabled = true;
      let cloudsAlpha = 0.55;
      let cloudsColor = [1.0, 1.0, 1.0]; // hex #ffffff
      let cloudsHeight = 12.0;
      let cloudsThickness = 0.93;
      let cloudsSpeed = 0.2;
      let cloudsShape = 1.0;
      let cloudTime = 0;
      let cloudShapeTime = 0;

      // God Rays (Disabled / Safe Fallback Globals)
      let godRaysEnabled = false;
      let godRaysAlpha = 0.0;
      let godRaysColor = [1.0, 0.92, 0.75];
      let godRaysCount = 0;
      let godRaysVertexBuffer = null;
      let godRaysIndexBuffer = null;
      let godRaysIndicesLength = 0;
      const godRaysList = [];

      let natureSway = 1.0;
      let waterPlantSway = 1.0;
      let showHitboxes = false;
      let frustumCullingEnabled = true;
      let maxColliderDistance = 20.0;
      let actionReachDistance = 0.15; // Auto-scales with playerScale * 1.5
      let showActionReach = true;
      let actionReachMode = 3; // 1 = Line, 2 = Circle, 3 = Capsule (Default is 3: Capsule)
      let woodFloorHeight = 0.05;
      if (typeof window !== "undefined") {
        window.woodFloorHeight = woodFloorHeight;
      }
      let campfireSize = 0.25;
      let voxelHoleRadiusMultiplier = 2.0;

      // --- Render Distance State (Split: 1. Terrain: 15.0, 2. Objects: 5.0) ---
      let renderDistEnabled = true;
      let terrainRenderDistValue = 15.0;
      let objectRenderDistValue = 5.0;
      let renderDistValue = 15.0; // for backwards compatibility

      // Expose to window for global access and devgame.js integration
      if (typeof window !== "undefined") {
        window.renderDistEnabled = renderDistEnabled;
        window.terrainRenderDistValue = terrainRenderDistValue;
        window.objectRenderDistValue = objectRenderDistValue;
        window.renderDistValue = renderDistValue;
      }

      // --- Throttled Animation FPS Limits & State ---
      let charAnimFps = 30;
      let lastCharAnimTime = 0;

      let waterAnimFps = 30;
      let lastWaterAnimTime = 0;
      let waterAnimTime = 0;

      let leafAnimFps = 30;
      let lastLeafAnimTime = 0;
      let leafAnimTime = 0;

      let cloudAnimFps = 30;
      let lastCloudAnimTime = 0;
      let cloudAnimTime = 0;
      let cloudShapeAnimTime = 0;


      // ============================================
      // ฟังก์ชันระบบสร้างเชิงลึกของตัวละครสามมิติดินปั้นขาวเงา
      // ============================================
      function rotatePointX(pivot, point, theta) {
        const dy = point[1] - pivot[1];
        const dz = point[2] - pivot[2];
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const ry = dy * cosT - dz * sinT;
        const rz = dy * sinT + dz * cosT;
        return [point[0], pivot[1] + ry, pivot[2] + rz];
      }

      function rotatePointY(pivot, point, theta) {
        const dx = point[0] - pivot[0];
        const dz = point[2] - pivot[2];
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const rx = dx * cosT + dz * sinT;
        const rz = -dx * sinT + dz * cosT;
        return [pivot[0] + rx, point[1], pivot[2] + rz];
      }

      function rotatePointZ(pivot, point, theta) {
        const dx = point[0] - pivot[0];
        const dy = point[1] - pivot[1];
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const rx = dx * cosT - dy * sinT;
        const ry = dx * sinT + dy * cosT;
        return [pivot[0] + rx, pivot[1] + ry, point[2]];
      }

      function generateCapsule(
        p1,
        p2,
        r,
        radialSegments = 16,
        axialSegments = 24,
      ) {
        const vertices = [];
        const normals = [];
        const indices = [];

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
          xAxis[0] * xAxis[0] + xAxis[1] * xAxis[1] + xAxis[2] * xAxis[2],
        );
        xAxis = [xAxis[0] / lenX, xAxis[1] / lenX, xAxis[2] / lenX];

        let yAxis = [
          zAxis[1] * xAxis[2] - zAxis[2] * xAxis[1],
          zAxis[2] * xAxis[0] - zAxis[0] * xAxis[2],
          zAxis[0] * xAxis[1] - zAxis[1] * xAxis[0],
        ];

        const totalSlices = axialSegments;

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

            const vx = p1[0] + zAxis[0] * zPos + ringX * ringRadius;
            const vy = p1[1] + zAxis[1] * zPos + ringY * ringRadius;
            const vz = p1[2] + zAxis[2] * zPos + ringZ * ringRadius;

            const nx = ringX * cosA + zAxis[0] * sinA;
            const ny = ringY * cosA + zAxis[1] * sinA;
            const nz = ringZ * cosA + zAxis[2] * sinA;

            vertices.push(vx, vy, vz);
            normals.push(nx, ny, nz);
          }
        }

        for (let i = 0; i < totalSlices; i++) {
          for (let j = 0; j < radialSegments; j++) {
            const row1 = i * (radialSegments + 1);
            const row2 = (i + 1) * (radialSegments + 1);

            const a = row1 + j;
            const b = row1 + j + 1;
            const c = row2 + j;
            const d = row2 + j + 1;

            indices.push(a, b, c);
            indices.push(c, b, d);
          }
        }

        return { vertices, normals, indices };
      }

      function mergeMeshes(meshes) {
        const combinedVertices = [];
        const combinedNormals = [];
        const combinedColors = [];
        const combinedIndices = [];
        let vertexOffset = 0;

        for (let mesh of meshes) {
          if (!mesh) continue;
          const vertCount = mesh.vertices.length / 3;
          for (let i = 0; i < mesh.vertices.length; i++) {
            combinedVertices.push(mesh.vertices[i]);
            combinedNormals.push(mesh.normals[i]);
          }
          for (let i = 0; i < vertCount; i++) {
            if (mesh.colors && mesh.colors.length >= (i + 1) * 3) {
              combinedColors.push(mesh.colors[i * 3], mesh.colors[i * 3 + 1], mesh.colors[i * 3 + 2]);
            } else {
              combinedColors.push(0.96, 0.96, 0.96);
            }
          }
          for (let idx of mesh.indices) {
            combinedIndices.push(idx + vertexOffset);
          }
          vertexOffset += vertCount;
        }

        return {
          vertices: combinedVertices,
          normals: combinedNormals,
          colors: combinedColors,
          indices: combinedIndices,
        };
      }

      function buildHandAndFingers(pElbow, pHand, isLeft, scaleFactor) {
        const dX = pHand[0] - pElbow[0];
        const dY = pHand[1] - pElbow[1];
        const dZ = pHand[2] - pElbow[2];
        let len = Math.sqrt(dX * dX + dY * dY + dZ * dZ);
        let dArm = len > 1e-4 ? [dX / len, dY / len, dZ / len] : [0, -1, 0];

        const sideVec = isLeft ? [-1, 0, 0] : [1, 0, 0];
        let rArm = [
          dArm[1] * sideVec[2] - dArm[2] * sideVec[1],
          dArm[2] * sideVec[0] - dArm[0] * sideVec[2],
          dArm[0] * sideVec[1] - dArm[1] * sideVec[0],
        ];
        let rLen = Math.sqrt(rArm[0] * rArm[0] + rArm[1] * rArm[1] + rArm[2] * rArm[2]);
        if (rLen < 1e-3) {
          rArm = isLeft ? [0, 0, -1] : [0, 0, 1];
        } else {
          rArm = [rArm[0] / rLen, rArm[1] / rLen, rArm[2] / rLen];
        }

        const sf = scaleFactor;
        const palmTip = [
          pHand[0] + dArm[0] * 0.02 * sf,
          pHand[1] + dArm[1] * 0.02 * sf,
          pHand[2] + dArm[2] * 0.02 * sf,
        ];

        const palm = generateCapsule(pHand, palmTip, 0.022 * sf, 8, 8);
        const parts = [palm];

        // 5 Chibi Fingers (Thumb, Index, Middle, Ring, Pinky)
        const fingerOffsets = isLeft ? [-0.012, -0.005, 0.002, 0.008, 0.014] : [0.012, 0.005, -0.002, -0.008, -0.014];
        const fingerLengths = [0.015, 0.019, 0.021, 0.018, 0.014];
        const fingerRadii = [0.0075, 0.007, 0.007, 0.0065, 0.0055];

        for (let f = 0; f < 5; f++) {
          const off = fingerOffsets[f] * sf;
          const flen = fingerLengths[f] * sf;
          const frad = fingerRadii[f] * sf;

          let fBase, fTip;
          if (f === 0) { // Thumb
            fBase = [
              pHand[0] + dArm[0] * 0.008 * sf + rArm[0] * off,
              pHand[1] + dArm[1] * 0.008 * sf + rArm[1] * off,
              pHand[2] + dArm[2] * 0.008 * sf + rArm[2] * off,
            ];
            fTip = [
              fBase[0] + dArm[0] * flen + rArm[0] * (isLeft ? -0.008 : 0.008) * sf,
              fBase[1] + dArm[1] * flen + rArm[1] * (isLeft ? -0.008 : 0.008) * sf,
              fBase[2] + dArm[2] * flen + rArm[2] * (isLeft ? -0.008 : 0.008) * sf,
            ];
          } else {
            fBase = [
              palmTip[0] + rArm[0] * off,
              palmTip[1] + rArm[1] * off,
              palmTip[2] + rArm[2] * off,
            ];
            fTip = [
              fBase[0] + dArm[0] * flen,
              fBase[1] + dArm[1] * flen,
              fBase[2] + dArm[2] * flen,
            ];
          }
          parts.push(generateCapsule(fBase, fTip, frad, 6, 6));
        }
        return parts;
      }

      function buildFootAnkleToes(pKnee, pFoot, isLeft, scaleFactor) {
        const sf = scaleFactor;
        // 1. Ankle Joint
        const ankle = generateCapsule(pFoot, [pFoot[0], pFoot[1] - 0.008 * sf, pFoot[2]], 0.032 * sf, 8, 8);

        // 2. Foot Body
        const footTip = [
          pFoot[0],
          pFoot[1] - 0.012 * sf,
          pFoot[2] + 0.040 * sf,
        ];
        const footBody = generateCapsule([pFoot[0], pFoot[1] - 0.008 * sf, pFoot[2]], footTip, 0.026 * sf, 8, 8);

        const parts = [ankle, footBody];

        // 3. 5 Chibi Toes
        const toeXOffsets = isLeft ? [0.012, 0.006, 0.0, -0.006, -0.011] : [-0.012, -0.006, 0.0, 0.006, 0.011];
        const toeLengths = [0.014, 0.013, 0.012, 0.010, 0.008];
        const toeRadii = [0.008, 0.007, 0.007, 0.006, 0.005];

        for (let t = 0; t < 5; t++) {
          const tx = toeXOffsets[t] * sf;
          const tlen = toeLengths[t] * sf;
          const trad = toeRadii[t] * sf;

          const tBase = [footTip[0] + tx, footTip[1], footTip[2]];
          const tTip = [tBase[0], tBase[1] - 0.002 * sf, tBase[2] + tlen];
          parts.push(generateCapsule(tBase, tTip, trad, 6, 6));
        }
        return parts;
      }

      function initRagdoll(px, py, pz, rx_scaled, ry_scaled, rz_scaled, phase) {
        ragdollPos = [px, py, pz];

        const r_len = Math.sqrt(
          rx_scaled[0] ** 2 + rx_scaled[1] ** 2 + rx_scaled[2] ** 2,
        );

        // Check if underwater to avoid huge pushes
        const dist = Math.sqrt(px * px + py * py + pz * pz);
        let inWater = false;
        if (waterEnabled && dist > 0.001) {
          const wRadius = typeof getWaterRadiusAt === "function"
            ? getWaterRadiusAt(px, py, pz)
            : RADIUS + waterLevel * 0.15;
          inWater = dist < wRadius + 0.05;
        }

        // Zero push/launch velocity to collapse in-place, same as NPC
        let push = 0.0;
        let sidePush = 0.0;

        ragdollVel = [0.0, 0.0, 0.0];

        const rx = [
          rx_scaled[0] / r_len,
          rx_scaled[1] / r_len,
          rx_scaled[2] / r_len,
        ];
        const ry = [
          ry_scaled[0] / r_len,
          ry_scaled[1] / r_len,
          ry_scaled[2] / r_len,
        ];
        const rz = [
          rz_scaled[0] / r_len,
          rz_scaled[1] / r_len,
          rz_scaled[2] / r_len,
        ];

        ragdollAxis = [rx[0], rx[1], rx[2]];
        ragdollAngle = 0;
        // Gentle tip-over speed to make character slide naturally onto shoulders/floor
        ragdollAngularSpeed = inWater ? 0.02 : 0.03;

        ragdollLimbs = {
          aL: Math.sin(phase) * 0.8,
          aR: Math.sin(phase + Math.PI) * 0.8,
          eL: 0.1,
          eR: 0.1,
          lL: Math.sin(phase + Math.PI) * 0.6,
          lR: Math.sin(phase) * 0.6,
          kL: 0.1,
          kR: 0.1,
          vaL: 0,
          vaR: 0,
          veL: 0,
          veR: 0,
          vlL: 0,
          vlR: 0,
          vkL: 0,
          vkR: 0,
        };

        ragdollBaseMatrix = [
          rx[0],
          rx[1],
          rx[2],
          0,
          ry[0],
          ry[1],
          ry[2],
          0,
          rz[0],
          rz[1],
          rz[2],
          0,
          0,
          0,
          0,
          1,
        ];

        // Check if player died on surface or underwater
        const height = getVisualHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
        const feetRadiusBefore = RADIUS + height * HEIGHT_SCALE;
        const terrainRadius = feetRadiusBefore;
        
        const sinTheta = Math.sin(charTheta);
        const cosTheta = Math.cos(charTheta);
        const sinPhi = Math.sin(charPhi);
        const cosPhi = Math.cos(charPhi);
        const nx = sinTheta * cosPhi;
        const ny = cosTheta;
        const nz = sinTheta * sinPhi;
        const waterRadius = RADIUS + waterLevel * 0.15;

        let wRadiusLocal = typeof getWaterRadiusAt === "function"
          ? getWaterRadiusAt(nx * feetRadiusBefore, ny * feetRadiusBefore, nz * feetRadiusBefore)
          : waterRadius;
        const caveData = typeof getTerrainSurfaceAndCeiling === "function"
          ? getTerrainSurfaceAndCeiling(nx, ny, nz, dist)
          : { ground: RADIUS + height * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };

        if (caveData.insideTunnel && wRadiusLocal === 0) {
            wRadiusLocal = waterRadius;
        }

        if (typeof getWaterRadiusAt !== "function") {
          const latCharForSwim = Math.round((charTheta / Math.PI) * Math.min(currentGridSize, 200));
          let phiCharForSwim = charPhi;
          if (phiCharForSwim < 0) phiCharForSwim += Math.PI * 2;
          const longCharForSwim = Math.round((phiCharForSwim / (Math.PI * 2)) * Math.min(currentGridSize, 200));
          const gridIdxCharSwim = latCharForSwim * (Math.min(currentGridSize, 200) + 1) + longCharForSwim;
          if (typeof waterMask !== 'undefined' && waterMask && waterMask[gridIdxCharSwim] === 0) {
             if (!caveData.insideTunnel) {
                 wRadiusLocal = 0;
             }
          }
        }

        let swimFactor = 0.0;
        if (false) { // Disabled: allow water in caves
          swimFactor = 0.0;
        } else if (waterEnabled && terrainRadius < wRadiusLocal) {
          const wDepth = wRadiusLocal - terrainRadius;
          const swimThreshold = 0.48 * playerScale;
          if (wDepth > swimThreshold) {
            swimFactor = Math.min(
              1.0,
              (wDepth - swimThreshold) / (0.15 * playerScale),
            );
          }
        }
        const initialDepth = waterRadius - dist;
        ragdollDiedOnSurface =
          !waterEnabled ||
          swimFactor <= 0.0 ||
          playerDiveDepth < 0.03 * playerScale ||
          initialDepth < 0.04 * playerScale;

        ragdollInitialized = true;
      }

      function updateRagdoll(dt) {
        if (!ragdollInitialized) return;
        const dtScale = dt / 0.016666;

        let immersion = 0.0;
        let depth = -1.0;

        const r = Math.sqrt(
          ragdollPos[0] ** 2 + ragdollPos[1] ** 2 + ragdollPos[2] ** 2,
        );
        if (r > 0.001) {
          const nx = ragdollPos[0] / r;
          const ny = ragdollPos[1] / r;
          const nz = ragdollPos[2] / r;

          const caveData = typeof getTerrainSurfaceAndCeiling === "function"
            ? getTerrainSurfaceAndCeiling(nx, ny, nz, r)
            : { ground: RADIUS + (typeof getHeightOnSphere === "function" ? getVisualHeightOnSphere(Math.acos(Math.max(-1.0, Math.min(1.0, ny))), Math.atan2(nz, nx), (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) : 0) * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };

          // Use Physics engine
          Physics.applyGravity(ragdollVel, nx, ny, nz, dtScale);
          Physics.applyFriction(ragdollVel, 0.98, dtScale);
          ragdollAngularSpeed *= Math.pow(0.98, dtScale);

          let wRadius = typeof getWaterRadiusAt === "function"
            ? getWaterRadiusAt(ragdollPos[0], ragdollPos[1], ragdollPos[2])
            : RADIUS + waterLevel * 0.15;
            
          if (caveData.insideTunnel && wRadius === 0) {
              wRadius = RADIUS + waterLevel * 0.15;
          }
          const hRange = 0.05; // 5cm floating band
          if (waterEnabled && wRadius > 0) {
            immersion = Math.max(
              0.0,
              Math.min(1.0, (wRadius + hRange - r) / (2.0 * hRange)),
            );
            depth = wRadius - r;
            if (depth < 0.04) {
              ragdollDiedOnSurface = true;
            }
          } else {
            ragdollDiedOnSurface = true;
          }

          const isNearSurface = ragdollDiedOnSurface;
          // Smoothly interpolate friction based on immersion
          // Sinking underwater should have a lot more resistance/drag than floating at surface
          const waterFriction = isNearSurface ? 0.85 : 0.78;
          const friction = 0.98 * (1.0 - immersion) + waterFriction * immersion;
          Physics.applyFriction(ragdollVel, friction, dtScale);
          ragdollAngularSpeed *= Math.pow(
            0.98 * (1.0 - immersion) +
            (isNearSurface ? 0.95 : 0.85) * immersion, dtScale);

          if (immersion > 0) {
            let buoyancyFactor = 0.0;
            if (depth > 0) {
              if (ragdollDiedOnSurface) {
                // Near the surface: float!
                const targetSubmersion = 0.5; // Half submerged
                buoyancyFactor =
                  immersion * (1.0 + (immersion - targetSubmersion) * 3.0);
                if (buoyancyFactor < 0.1) buoyancyFactor = 0.1;
              } else {
                // Deep underwater: sink slowly! (buoyancy close to gravity, e.g. 0.75 so it sinks very slowly)
                buoyancyFactor = 0.75 * immersion;
              }
            }
            Physics.applyBuoyancyForce(ragdollVel, nx, ny, nz, buoyancyFactor, dtScale);

            // Gentle underwater drift and swaying to simulate fluid resistance/currents
            const driftPhase = Date.now() * 0.001 * 2.0;
            const driftAmp = 0.0004 * immersion;
            let tx = -ny;
            let ty = nx;
            let tz = 0;
            const tlen = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (tlen > 0.001) {
              tx /= tlen;
              ty /= tlen;
              ragdollVel[0] += tx * Math.sin(driftPhase) * driftAmp;
              ragdollVel[1] += ty * Math.sin(driftPhase) * driftAmp;
              ragdollVel[2] += tz * Math.sin(driftPhase) * driftAmp;
            }
            ragdollAngularSpeed +=
              Math.sin(driftPhase * 1.5) * 0.001 * immersion;

            // Apply vertical damping to completely kill oscillations / jitter for floating bodies at surface
            if (ragdollDiedOnSurface) {
              const v_radial =
                ragdollVel[0] * nx + ragdollVel[1] * ny + ragdollVel[2] * nz;
              const v_tx = ragdollVel[0] - nx * v_radial;
              const v_ty = ragdollVel[1] - ny * v_radial;
              const v_tz = ragdollVel[2] - nz * v_radial;

              const dampFactor = 0.65;
              const new_v_radial = v_radial * dampFactor;
              ragdollVel[0] = v_tx + nx * new_v_radial;
              ragdollVel[1] = v_ty + ny * new_v_radial;
              ragdollVel[2] = v_tz + nz * new_v_radial;
            }
          }
        }

        ragdollPos[0] += ragdollVel[0] * dtScale;
        ragdollPos[1] += ragdollVel[1] * dtScale;
        ragdollPos[2] += ragdollVel[2] * dtScale;

        ragdollAngle += ragdollAngularSpeed * dtScale;

        const distToCenter = Math.sqrt(
          ragdollPos[0] ** 2 + ragdollPos[1] ** 2 + ragdollPos[2] ** 2,
        );
        if (distToCenter > 0.001) {
          const ux = ragdollPos[0] / distToCenter;
          const uy = ragdollPos[1] / distToCenter;
          const uz = ragdollPos[2] / distToCenter;

          const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
          const phi = Math.atan2(uz, ux);
          
          const surfaceRadius = RADIUS + getVisualHeightOnSphere(theta, phi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) * HEIGHT_SCALE;
          const caveData = typeof getTerrainSurfaceAndCeiling === "function"
            ? getTerrainSurfaceAndCeiling(ux, uy, uz, distToCenter)
            : { ground: surfaceRadius, insideTunnel: false, ceiling: Infinity };

          // Dynamic collision radius based on rotation
          // When standing (angle ~ 0), radius is 0.46 to keep legs above ground
          // When lying flat (angle ~ PI/2), radius is 0.15 so body touches ground
          const angleFactor = Math.abs(Math.cos(ragdollAngle));
          const colRadius = playerScale * (0.15 + 0.43 * angleFactor);
          
          let target = distToCenter;
          let hitSolid = false;

          if (caveData.insideTunnel) {
            if (distToCenter < caveData.ground + colRadius) {
              target = caveData.ground + colRadius;
              hitSolid = true;
              const v_radial = ragdollVel[0] * ux + ragdollVel[1] * uy + ragdollVel[2] * uz;
              if (v_radial < 0) {
                  ragdollVel[0] -= ux * v_radial;
                  ragdollVel[1] -= uy * v_radial;
                  ragdollVel[2] -= uz * v_radial;
              }
            } else if (caveData.ceiling !== Infinity && distToCenter > caveData.ceiling - colRadius) {
              target = caveData.ceiling - colRadius;
              hitSolid = true;
              const v_radial = ragdollVel[0] * ux + ragdollVel[1] * uy + ragdollVel[2] * uz;
              if (v_radial > 0) {
                 ragdollVel[0] -= ux * v_radial;
                 ragdollVel[1] -= uy * v_radial;
                 ragdollVel[2] -= uz * v_radial;
              }
            }
          } else {
            if (distToCenter < surfaceRadius + colRadius) {
              if (distToCenter > surfaceRadius - 0.5) {
                target = surfaceRadius + colRadius;
                hitSolid = true;
                const v_radial = ragdollVel[0] * ux + ragdollVel[1] * uy + ragdollVel[2] * uz;
                if (v_radial < 0) {
                    ragdollVel[0] -= ux * v_radial;
                    ragdollVel[1] -= uy * v_radial;
                    ragdollVel[2] -= uz * v_radial;
                }
              } else {
                Physics.applyFriction(ragdollVel, 0.5, dtScale);
              }
            }
          }

          const coreCollectible = collectibles.find(c => c.type === "planet_core");
          const coreRadius = coreCollectible ? coreCollectible.radius : 2.0;
          if (distToCenter < coreRadius + colRadius) {
            target = coreRadius + colRadius;
            hitSolid = true;
            const v_radial = ragdollVel[0] * ux + ragdollVel[1] * uy + ragdollVel[2] * uz;
            if (v_radial < 0) {
              ragdollVel[0] -= ux * v_radial;
              ragdollVel[1] -= uy * v_radial;
              ragdollVel[2] -= uz * v_radial;
            }
          }

          if (hitSolid) {
            ragdollPos[0] = ux * target;
            ragdollPos[1] = uy * target;
            ragdollPos[2] = uz * target;

            // Ground friction
            Physics.applyFriction(ragdollVel, 0.7, dtScale);
            ragdollAngularSpeed *= Math.pow(0.7, dtScale);

            // compute surface normal
            const getT = (t, p) => {
              const r =
                RADIUS + getVisualHeightOnSphere(t, p, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) * HEIGHT_SCALE;
              return [
                r * Math.sin(t) * Math.cos(p),
                r * Math.cos(t),
                r * Math.sin(t) * Math.sin(p),
              ];
            };
            const p0 = getT(theta, phi);
            const p1 = getT(theta, phi + 0.02);
            const p2 = getT(theta - 0.02, phi);
            const v1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
            const v2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
            let snX = v1[1] * v2[2] - v1[2] * v2[1];
            let snY = v1[2] * v2[0] - v1[0] * v2[2];
            let snZ = v1[0] * v2[1] - v1[1] * v2[0];
            const snLen = Math.sqrt(snX * snX + snY * snY + snZ * snZ);
            if (snLen > 0.0001) {
              snX /= snLen;
              snY /= snLen;
              snZ /= snLen;
              if (snX * ux + snY * uy + snZ * uz < 0) {
                snX = -snX;
                snY = -snY;
                snZ = -snZ;
            }
          } else {
              snX = ux;
              snY = uy;
              snZ = uz;
            }

            const dot =
              ragdollVel[0] * snX + ragdollVel[1] * snY + ragdollVel[2] * snZ;
            if (dot < 0) {
              // Sinking bodies have zero bounciness on landing and settle gracefully
              const bounciness = !ragdollDiedOnSurface ? 0.0 : 0.1;
              const friction = !ragdollDiedOnSurface ? 0.9 : 0.95; // Less friction for more sliding

              const vnX = snX * dot;
              const vnY = snY * dot;
              const vnZ = snZ * dot;

              const vtX = ragdollVel[0] - vnX;
              const vtY = ragdollVel[1] - vnY;
              const vtZ = ragdollVel[2] - vnZ;

              ragdollVel[0] = vtX * friction - vnX * bounciness;
              ragdollVel[1] = vtY * friction - vnY * bounciness;
              ragdollVel[2] = vtZ * friction - vnZ * bounciness;

              const speedSq = vtX * vtX + vtY * vtY + vtZ * vtZ;
              if (speedSq > 0.00001) {
                const speed = Math.sqrt(speedSq);
                ragdollAngularSpeed = speed * 1.5; // Rotate based on speed

                // Axis is cross product of surface normal and velocity direction
                let cX = snY * vtZ - snZ * vtY;
                let cY = snZ * vtX - snX * vtZ;
                let cZ = snX * vtY - snY * vtX;
                const cLen = Math.sqrt(cX * cX + cY * cY + cZ * cZ);
                if (cLen > 0.0001) {
                  ragdollAxis = [cX / cLen, cY / cLen, cZ / cLen];
            }
          } else {
                let normalizedAngle = Math.abs(ragdollAngle % Math.PI);
                if (
                  normalizedAngle < (Math.PI / 2) * 0.8 ||
                  normalizedAngle > Math.PI - (Math.PI / 2) * 0.8
                ) {
                  ragdollAngularSpeed =
                    0.05 * Math.sign(ragdollAngularSpeed || 1);
                } else {
                  ragdollAngularSpeed *= 0.5;
                }
              }
            }
          }
        }
        
        // Collision with chests and boats for ragdoll
        for (let item of collectibles) {
          if (item.active && (item.type === "wood_chest" || item.type === "wood_boat") && !item.isPreview) {
            const sP = item.position;
            const sR = item.R;
            const sN = item.normal;
            const sF = item.F;
            
            const dx_vec = [
              ragdollPos[0] - sP[0],
              ragdollPos[1] - sP[1],
              ragdollPos[2] - sP[2]
            ];
            
            const localX = dx_vec[0] * sR[0] + dx_vec[1] * sR[1] + dx_vec[2] * sR[2];
            const localY = dx_vec[0] * sN[0] + dx_vec[1] * sN[1] + dx_vec[2] * sN[2];
            const localZ = dx_vec[0] * sF[0] + dx_vec[1] * sF[1] + dx_vec[2] * sF[2];
            
            let hw, hh, hd;
            if (item.type === "wood_chest") {
              const cs = 0.45; 
              hw = 0.12 * cs; 
              hh = 0.13 * cs; 
              hd = 0.09 * cs; 
            } else {
              const bs = 0.4;
              hw = 0.25 * bs; 
              hh = 0.1 * bs; 
              hd = 0.6 * bs; 
            }
            
            const angleFactor = Math.abs(Math.cos(ragdollAngle));
            const rRad = playerScale * (0.15 + 0.43 * angleFactor);
            if (Math.abs(localX) < hw + rRad && Math.abs(localZ) < hd + rRad && localY > -0.1 && localY < hh * 2 + rRad) {
              const pushX = (hw + rRad) - Math.abs(localX);
              const pushZ = (hd + rRad) - Math.abs(localZ);
              if (pushX < pushZ) {
                const sign = localX > 0 ? 1 : -1;
                ragdollPos[0] += sR[0] * sign * pushX;
                ragdollPos[1] += sR[1] * sign * pushX;
                ragdollPos[2] += sR[2] * sign * pushX;
                // bounce vel
                const dot = ragdollVel[0] * sR[0] + ragdollVel[1] * sR[1] + ragdollVel[2] * sR[2];
                if (dot * sign < 0) {
                  ragdollVel[0] -= sR[0] * dot * 1.5;
                  ragdollVel[1] -= sR[1] * dot * 1.5;
                  ragdollVel[2] -= sR[2] * dot * 1.5;
            }
          } else {
                const sign = localZ > 0 ? 1 : -1;
                ragdollPos[0] += sF[0] * sign * pushZ;
                ragdollPos[1] += sF[1] * sign * pushZ;
                ragdollPos[2] += sF[2] * sign * pushZ;
                // bounce vel
                const dot = ragdollVel[0] * sF[0] + ragdollVel[1] * sF[1] + ragdollVel[2] * sF[2];
                if (dot * sign < 0) {
                  ragdollVel[0] -= sF[0] * dot * 1.5;
                  ragdollVel[1] -= sF[1] * dot * 1.5;
                  ragdollVel[2] -= sF[2] * dot * 1.5;
                }
              }
            }
          }
        }

        // Update limbs
        if (ragdollLimbs) {
          const s = Math.abs(ragdollAngularSpeed) * 3.0;
          const updateLimb = (angle, vel, target, stiffness, damping) => {
            const force = (target - angle) * stiffness;
            let v = vel + force;
            // Remove random jitter to make it floppy, lifeless, and prevent active-like animation twitching
            v *= damping;
            return { a: angle + v, v: v };
          };

          let r;
          // Soft, limp targets with very low stiffness to make limbs completely floppy/loose like NPC
          r = updateLimb(ragdollLimbs.aL, ragdollLimbs.vaL, 0.1, 0.008, 0.9);
          ragdollLimbs.aL = r.a;
          ragdollLimbs.vaL = r.v;

          r = updateLimb(ragdollLimbs.aR, ragdollLimbs.vaR, 0.1, 0.008, 0.9);
          ragdollLimbs.aR = r.a;
          ragdollLimbs.vaR = r.v;

          r = updateLimb(ragdollLimbs.eL, ragdollLimbs.veL, 0.15, 0.008, 0.9);
          ragdollLimbs.eL = Math.max(0, r.a);
          ragdollLimbs.veL = r.v;

          r = updateLimb(ragdollLimbs.eR, ragdollLimbs.veR, 0.15, 0.008, 0.9);
          ragdollLimbs.eR = Math.max(0, r.a);
          ragdollLimbs.veR = r.v;

          r = updateLimb(ragdollLimbs.lL, ragdollLimbs.vlL, 0.0, 0.008, 0.9);
          ragdollLimbs.lL = r.a;
          ragdollLimbs.vlL = r.v;

          r = updateLimb(ragdollLimbs.lR, ragdollLimbs.vlR, 0.0, 0.008, 0.9);
          ragdollLimbs.lR = r.a;
          ragdollLimbs.vlR = r.v;

          r = updateLimb(ragdollLimbs.kL, ragdollLimbs.vkL, 0.15, 0.008, 0.9);
          ragdollLimbs.kL = Math.max(0, r.a);
          ragdollLimbs.vkL = r.v;

          r = updateLimb(ragdollLimbs.kR, ragdollLimbs.vkR, 0.15, 0.008, 0.9);
          ragdollLimbs.kR = Math.max(0, r.a);
          ragdollLimbs.vkR = r.v;
        }
      }


      function updateCharacterMesh(phase) {
        const heldItem = getHeldItem();
        let chestP1,
          chestP2,
          pelvisP1,
          pelvisP2,
          neckP1,
          neckP2,
          headP1,
          headP2,
          leftEarP1,
          leftEarP2,
          rightEarP1,
          rightEarP2;
        let leftArmPivot, leftElbowRot, leftHandRot;
        let rightArmPivot, rightElbowRot, rightHandRot;
        let leftLegPivot, leftKneeRot, leftFootRot;
        let rightLegPivot, rightKneeRot, rightFootRot;

        const bOffset = ragdollEnabled
          ? 0.0
          : Math.sin(waterAnimTime * 2.5) * 0.006;
        const bRadius = ragdollEnabled
          ? 0.0
          : Math.sin(waterAnimTime * 2.5) * 0.002;

        let torsoTilt = 0.0;
        let armAngle = Math.sin(phase) * 0.8;
        let leftElbowFlex = 0.1 + Math.max(0, -armAngle * 0.5);
        let rightArmAngle = Math.sin(phase + Math.PI) * 0.8;
        let rightElbowFlex = 0.1 + Math.max(0, -rightArmAngle * 0.5);

        let legAngle = Math.sin(phase + Math.PI) * 0.6;
        let leftKneeFlex = 0.1 + Math.max(0, legAngle * 0.5);
        let rightLegAngle = Math.sin(phase) * 0.6;
        let rightKneeFlex = 0.1 + Math.max(0, rightLegAngle * 0.5);

        if (activeRidingBoat) {
          // Sitting and rowing pose
          let isLandVehicle = activeRidingBoat.hasWheel || activeRidingBoat.hasWheels || (activeRidingBoat.wheelCount && activeRidingBoat.wheelCount > 0);
          if (isLandVehicle) {
            armAngle = -0.4;
            leftElbowFlex = 0.5;
            rightArmAngle = -0.4;
            rightElbowFlex = 0.5;
            torsoTilt = 0;
          } else {
            const rowPhase = typeof boatRowTimer !== "undefined" ? boatRowTimer : 0;
            armAngle = Math.sin(rowPhase) * 0.5 - 0.5; // Arms forward and back
            leftElbowFlex = 0.3 + Math.cos(rowPhase) * 0.2;
            rightArmAngle = Math.sin(rowPhase) * 0.5 - 0.5; // Synchronized in-phase pull
            rightElbowFlex = 0.3 + Math.cos(rowPhase) * 0.2;
            torsoTilt = Math.sin(rowPhase) * 0.25; // Leaning forward and backward with rowing phase
          }
          
          legAngle = -1.5; // Legs forward (sitting)
          leftKneeFlex = 1.0; // Knees bent
          rightLegAngle = -1.5;
          rightKneeFlex = 1.0;
        } else if (typeof activeRidingMech !== "undefined" && activeRidingMech) {
          // Pilot sitting pose inside Mech Cockpit
          armAngle = -0.4;
          leftElbowFlex = 0.5;
          rightArmAngle = -0.4;
          rightElbowFlex = 0.5;
          
          torsoTilt = 0.05;
          
          legAngle = -1.5; // Legs forward (sitting)
          leftKneeFlex = 1.1; // Knees bent down inside cockpit
          rightLegAngle = -1.5;
          rightKneeFlex = 1.1;
        } else if (ragdollEnabled && ragdollLimbs) {
          armAngle = ragdollLimbs.aL;
          leftElbowFlex = ragdollLimbs.eL;
          rightArmAngle = ragdollLimbs.aR;
          rightElbowFlex = ragdollLimbs.eR;

          legAngle = ragdollLimbs.lL;
          leftKneeFlex = ragdollLimbs.kL;
          rightLegAngle = ragdollLimbs.lR;
          rightKneeFlex = ragdollLimbs.kR;
        } else if (currentSwimFactor > 0.0) {
          // --- LEFT ARM ---
          const treadLeftArm = 0.45 + Math.sin(waterAnimTime * 3.5) * 0.15;
          const treadLeftElbow = 0.55 + Math.cos(waterAnimTime * 3.5) * 0.1;

          const swimArm = Math.sin(phase * 1.5) * 1.0 + 1.2;
          const swimElbow = 0.2 + Math.cos(phase * 1.5) * 0.2;

          const combinedArm =
            treadLeftArm * (1.0 - swimMovementFactor) +
            swimArm * swimMovementFactor;
          const combinedElbow =
            treadLeftElbow * (1.0 - swimMovementFactor) +
            swimElbow * swimMovementFactor;

          armAngle =
            armAngle * (1.0 - currentSwimFactor) +
            combinedArm * currentSwimFactor;
          leftElbowFlex =
            leftElbowFlex * (1.0 - currentSwimFactor) +
            combinedElbow * currentSwimFactor;

          // --- RIGHT ARM ---
          const treadRightArm = 0.45 + Math.cos(waterAnimTime * 3.5) * 0.15;
          const treadRightElbow = 0.55 + Math.sin(waterAnimTime * 3.5) * 0.1;

          const swimRightArm = Math.sin(phase * 1.5 + Math.PI) * 1.0 + 1.2;
          const swimRightElbow = 0.2 + Math.cos(phase * 1.5 + Math.PI) * 0.2;

          const combinedRightArm =
            treadRightArm * (1.0 - swimMovementFactor) +
            swimRightArm * swimMovementFactor;
          const combinedRightElbow =
            treadRightElbow * (1.0 - swimMovementFactor) +
            swimRightElbow * swimMovementFactor;

          rightArmAngle =
            rightArmAngle * (1.0 - currentSwimFactor) +
            combinedRightArm * currentSwimFactor;
          rightElbowFlex =
            rightElbowFlex * (1.0 - currentSwimFactor) +
            combinedRightElbow * currentSwimFactor;

          // --- LEFT LEG ---
          const treadLeftLeg = 0.3 + Math.sin(waterAnimTime * 3.5) * 0.25;
          const treadLeftKnee = 0.5 + Math.cos(waterAnimTime * 3.5) * 0.2;

          const swimLeg = Math.sin(phase * 2.5) * 0.4;
          const swimKnee = 0.1 + Math.max(0, -swimLeg * 0.3);

          const combinedLeftLeg =
            treadLeftLeg * (1.0 - swimMovementFactor) +
            swimLeg * swimMovementFactor;
          const combinedLeftKnee =
            treadLeftKnee * (1.0 - swimMovementFactor) +
            swimKnee * swimMovementFactor;

          legAngle =
            legAngle * (1.0 - currentSwimFactor) +
            combinedLeftLeg * currentSwimFactor;
          leftKneeFlex =
            leftKneeFlex * (1.0 - currentSwimFactor) +
            combinedLeftKnee * currentSwimFactor;

          // --- RIGHT LEG ---
          const treadRightLeg = 0.3 - Math.sin(waterAnimTime * 3.5) * 0.25;
          const treadRightKnee = 0.5 - Math.cos(waterAnimTime * 3.5) * 0.2;

          const swimRightLeg = Math.sin(phase * 2.5 + Math.PI) * 0.4;
          const swimRightKnee = 0.1 + Math.max(0, -swimRightLeg * 0.3);

          const combinedRightLeg =
            treadRightLeg * (1.0 - swimMovementFactor) +
            swimRightLeg * swimMovementFactor;
          const combinedRightKnee =
            treadRightKnee * (1.0 - swimMovementFactor) +
            swimRightKnee * swimMovementFactor;

          rightLegAngle =
            rightLegAngle * (1.0 - currentSwimFactor) +
            combinedRightLeg * currentSwimFactor;
          rightKneeFlex =
            rightKneeFlex * (1.0 - currentSwimFactor) +
            combinedRightKnee * currentSwimFactor;
        }
        
        if (jumpBlend > 0.0) {
            // Jumping or falling animation targets
            const targetArmAngle = Math.PI / 4;
            const targetLeftElbowFlex = 0.5;
            const targetRightArmAngle = Math.PI / 4;
            const targetRightElbowFlex = 0.5;
            
            // Map vertical velocity to leg extension (-0.02 to 0.02 approx)
            const velFactor = Math.max(-1.0, Math.min(1.0, playerVerticalVel * 50));
            const targetLegAngle = 0.05 + velFactor * 0.25;
            const targetLeftKneeFlex = 0.2 + (1 - velFactor) * 0.1;
            const targetRightLegAngle = -0.3 + velFactor * 0.2;
            const targetRightKneeFlex = 0.4 - velFactor * 0.2;
            
            // Interpolate
            armAngle = armAngle * (1.0 - jumpBlend) + targetArmAngle * jumpBlend;
            leftElbowFlex = leftElbowFlex * (1.0 - jumpBlend) + targetLeftElbowFlex * jumpBlend;
            rightArmAngle = rightArmAngle * (1.0 - jumpBlend) + targetRightArmAngle * jumpBlend;
            rightElbowFlex = rightElbowFlex * (1.0 - jumpBlend) + targetRightElbowFlex * jumpBlend;
            
            legAngle = legAngle * (1.0 - jumpBlend) + targetLegAngle * jumpBlend;
            leftKneeFlex = leftKneeFlex * (1.0 - jumpBlend) + targetLeftKneeFlex * jumpBlend;
            rightLegAngle = rightLegAngle * (1.0 - jumpBlend) + targetRightLegAngle * jumpBlend;
            rightKneeFlex = rightKneeFlex * (1.0 - jumpBlend) + targetRightKneeFlex * jumpBlend;
            
            torsoTilt = torsoTilt * (1.0 - jumpBlend) + (velFactor * 0.1) * jumpBlend;
        }
        
        if (heldItem) {
             if (heldItem.name === "BOW") {
                 if (isUsingItem && useAnimTimer > 0) {
                     armAngle = -1.57;
                     leftElbowFlex = 0.0;
                     rightArmAngle = 0;
                     rightElbowFlex = 0;
                 } else {
                     armAngle = -0.8;
                     leftElbowFlex = 0.3;
                     rightArmAngle = 0.2;
                     rightElbowFlex = 0.2;
                 }
             } else {
                 if (isUsingItem && useAnimTimer > 0) {
                     // Swing animation for axe / pickaxe / shovel / items
                     let swingPhase = useAnimTimer;
                     let targetArmAngle = 0;
                     let targetElbowFlex = 0;
                     if (swingPhase > 0.8) {
                         let t = (1.0 - swingPhase) / 0.2;
                         targetArmAngle = -1.5 * t;
                         targetElbowFlex = 0.5 * t;
                     } else if (swingPhase > 0.4) {
                         let t = (0.8 - swingPhase) / 0.4;
                         targetArmAngle = -1.5 + 2.5 * t;
                         targetElbowFlex = 0.5 - 0.4 * t;
                     } else {
                         let t = (0.4 - swingPhase) / 0.4;
                         targetArmAngle = 1.0 * (1.0 - t);
                         targetElbowFlex = 0.1 * (1.0 - t);
                     }
                     rightArmAngle = targetArmAngle;
                     rightElbowFlex = targetElbowFlex;
                 } else {
                     rightArmAngle = -0.3;
                     rightElbowFlex = 0.5;
                 }
             }
        }

        const isRiding = activeRidingBoat || (typeof activeRidingMech !== "undefined" && activeRidingMech);

        chestP1 = [0, 0.02 + bOffset, 0];
        let defaultChestP2 = [0, 0.17 + bOffset, 0];
        chestP2 = isRiding ? rotatePointX(chestP1, defaultChestP2, torsoTilt) : defaultChestP2;
        
        pelvisP1 = [0, -0.15, 0];
        pelvisP2 = [0, 0.02 + bOffset, 0];
        
        let defaultNeckP1 = [0, 0.17 + bOffset, 0];
        let defaultNeckP2 = [0, 0.23 + bOffset, 0];
        let defaultHeadP1 = [0, 0.43 + bOffset, 0];
        let defaultHeadP2 = [0, 0.43 + bOffset, 0];
        
        neckP1 = isRiding ? rotatePointX(chestP1, defaultNeckP1, torsoTilt) : defaultNeckP1;
        neckP2 = isRiding ? rotatePointX(chestP1, defaultNeckP2, torsoTilt) : defaultNeckP2;
        headP1 = isRiding ? rotatePointX(chestP1, defaultHeadP1, torsoTilt) : defaultHeadP1;
        headP2 = headP1;
        
        let defaultLeftEarP1 = [-0.21, 0.41 + bOffset, -0.01];
        let defaultLeftEarP2 = [-0.23, 0.408 + bOffset, -0.01];
        let defaultRightEarP1 = [0.21, 0.41 + bOffset, -0.01];
        let defaultRightEarP2 = [0.23, 0.408 + bOffset, -0.01];
        
        leftEarP1 = isRiding ? rotatePointX(chestP1, defaultLeftEarP1, torsoTilt) : defaultLeftEarP1;
        leftEarP2 = isRiding ? rotatePointX(chestP1, defaultLeftEarP2, torsoTilt) : defaultLeftEarP2;
        rightEarP1 = isRiding ? rotatePointX(chestP1, defaultRightEarP1, torsoTilt) : defaultRightEarP1;
        rightEarP2 = isRiding ? rotatePointX(chestP1, defaultRightEarP2, torsoTilt) : defaultRightEarP2;

        let defaultLeftArmPivot = [-0.09, 0.11 + bOffset, 0];
        let defaultLeftElbowBase = [-0.15, 0.01 + bOffset, -0.01];
        let defaultLeftHandBase = [-0.18, -0.09 + bOffset, 0.04];

        let defaultRightArmPivot = [0.09, 0.11 + bOffset, 0];
        let defaultRightElbowBase = [0.15, 0.01 + bOffset, -0.01];
        let defaultRightHandBase = [0.18, -0.09 + bOffset, 0.04];

        leftArmPivot = isRiding ? rotatePointX(chestP1, defaultLeftArmPivot, torsoTilt) : defaultLeftArmPivot;
        const leftElbowBase = isRiding ? rotatePointX(chestP1, defaultLeftElbowBase, torsoTilt) : defaultLeftElbowBase;
        const leftHandBase = isRiding ? rotatePointX(chestP1, defaultLeftHandBase, torsoTilt) : defaultLeftHandBase;

        rightArmPivot = isRiding ? rotatePointX(chestP1, defaultRightArmPivot, torsoTilt) : defaultRightArmPivot;
        const rightElbowBase = isRiding ? rotatePointX(chestP1, defaultRightElbowBase, torsoTilt) : defaultRightElbowBase;
        const rightHandBase = isRiding ? rotatePointX(chestP1, defaultRightHandBase, torsoTilt) : defaultRightHandBase;

        leftLegPivot = [-0.055, -0.12, 0];
        const leftKneeBase = [-0.055, -0.27, 0.015];
        const leftFootBase = [-0.055, -0.42, 0.0];

        rightLegPivot = [0.055, -0.12, 0];
        const rightKneeBase = [0.055, -0.27, 0.015];
        const rightFootBase = [0.055, -0.42, 0.0];

        leftElbowRot = rotatePointX(leftArmPivot, leftElbowBase, armAngle);
        const leftHandLocal = rotatePointX(
          leftElbowBase,
          leftHandBase,
          -leftElbowFlex,
        );
        leftHandRot = rotatePointX(leftArmPivot, leftHandLocal, armAngle);

        rightElbowRot = rotatePointX(
          rightArmPivot,
          rightElbowBase,
          rightArmAngle,
        );
        const rightHandLocal = rotatePointX(
          rightElbowBase,
          rightHandBase,
          -rightElbowFlex,
        );
        rightHandRot = rotatePointX(
          rightArmPivot,
          rightHandLocal,
          rightArmAngle,
        );

        let legAngleFwd = legAngle;
        let rightLegAngleFwd = rightLegAngle;
        let legAngleSide = 0;
        let rightLegAngleSide = 0;
        
        let isAimingBow = false;
        
        if (isAimingBow && typeof keysPressed !== 'undefined') {
            let moveF = 0, moveS = 0;
            if (keysPressed[currentKeyBindings.forward]) moveF += 1;
            if (keysPressed[currentKeyBindings.backward]) moveF -= 1;
            if (keysPressed[currentKeyBindings.left]) moveS += 1;
            if (keysPressed[currentKeyBindings.right]) moveS -= 1;
            if (false) moveF += 1;
            if (false) moveF -= 1;
            if (false) moveS += 1;
            if (false) moveS -= 1;
            
            legAngleFwd = Math.sin(phase + Math.PI) * 0.6 * moveF;
            rightLegAngleFwd = Math.sin(phase) * 0.6 * moveF;
            
            legAngleSide = Math.sin(phase + Math.PI) * 0.3 * moveS;
            rightLegAngleSide = Math.sin(phase) * 0.3 * moveS;
            
            leftKneeFlex = 0.1 + Math.max(0, legAngleFwd * 0.5);
            rightKneeFlex = 0.1 + Math.max(0, rightLegAngleFwd * 0.5);
        }

        let lk = rotatePointX(leftLegPivot, leftKneeBase, legAngleFwd);
        const leftFootLocal = rotatePointX(
          leftKneeBase,
          leftFootBase,
          leftKneeFlex,
        );
        let lf = rotatePointX(leftLegPivot, leftFootLocal, legAngleFwd);
        
        leftKneeRot = rotatePointZ(leftLegPivot, lk, legAngleSide);
        leftFootRot = rotatePointZ(leftLegPivot, lf, legAngleSide);

        let rk = rotatePointX(
          rightLegPivot,
          rightKneeBase,
          rightLegAngleFwd,
        );
        const rightFootLocal = rotatePointX(
          rightKneeBase,
          rightFootBase,
          rightKneeFlex,
        );
        let rf = rotatePointX(
          rightLegPivot,
          rightFootLocal,
          rightLegAngleFwd,
        );
        
        rightKneeRot = rotatePointZ(rightLegPivot, rk, rightLegAngleSide);
        rightFootRot = rotatePointZ(rightLegPivot, rf, rightLegAngleSide);

        // Backup unmodified coordinates for clean face local coordinates mapping
        const localChestP1 = [chestP1[0], chestP1[1], chestP1[2]];
        const localChestP2 = [chestP2[0], chestP2[1], chestP2[2]];
        const localPelvisP1 = [pelvisP1[0], pelvisP1[1], pelvisP1[2]];
        const localPelvisP2 = [pelvisP2[0], pelvisP2[1], pelvisP2[2]];
        const localNeckP1 = [neckP1[0], neckP1[1], neckP1[2]];
        const localNeckP2 = [neckP2[0], neckP2[1], neckP2[2]];
        const localHeadP1 = [headP1[0], headP1[1], headP1[2]];
        const localHeadP2 = [headP2[0], headP2[1], headP2[2]];
        const localLeftEarP1 = [leftEarP1[0], leftEarP1[1], leftEarP1[2]];
        const localLeftEarP2 = [leftEarP2[0], leftEarP2[1], leftEarP2[2]];
        const localRightEarP1 = [rightEarP1[0], rightEarP1[1], rightEarP1[2]];
        const localRightEarP2 = [rightEarP2[0], rightEarP2[1], rightEarP2[2]];

        let axeHandleP1Rot, axeHandleP2Rot, axeBladeP1Rot, axeBladeP2Rot, axeBlade2P1Rot, axeBlade2P2Rot;
        let shovelD1Rot, shovelD2Rot, shovelLeftBranchRot, shovelRightBranchRot;
        let bowGripRot, bowUpperTipRot, bowLowerTipRot;
        
        if (heldItem) {
             if (heldItem.name === "BOW") {
                 let t = 0.0;
                 let drawT = 0.0;
                 if (arrowShotInCurrentAnim) {
                     if (useAnimTimer > 0.3) {
                         t = 1.0;
                         const holdStart = bowHoldArmTimer - 0.3;
                         if (useAnimTimer > holdStart) {
                             const p = lastBowDrawPower !== undefined ? lastBowDrawPower : 1.0;
                             drawT = ((useAnimTimer - holdStart) / 0.3) * p;
                         } else {
                             drawT = 0.0;
            }
          } else {
                         t = useAnimTimer / 0.3;
                         drawT = 0.0;
            }
          } else {
                     t = Math.min(1.0, Math.max(0.0, (1.4 - useAnimTimer) / 1.1));
                     if (bowComboActive) {
                         t = 1.0;
                         drawT = Math.min(1.0, Math.max(0.0, (1.2 - useAnimTimer) / 0.9));
                     } else {
                         drawT = t;
                     }
                 }

                 // Torso rotates right so the character stands sideways like an archer
                 let currentYaw = 1.1 * t; 

                 const transformTorso = (pt) => {
                     return rotatePointY(chestP1, pt, currentYaw);
                 };

                 const originalLeftArmPivot = [leftArmPivot[0], leftArmPivot[1], leftArmPivot[2]];

                 chestP2 = transformTorso(chestP2);
                 leftArmPivot = transformTorso(leftArmPivot);
                 rightArmPivot = transformTorso(rightArmPivot);

                 // Head stays in place so face and ears align correctly
                 // (No transformHead applied to neck, head, and ears)

                 // Arm segment lengths
                 const l_upper = 0.155;
                 const l_lower = 0.145;

                 // LEFT ARM (Holding the bow)
                 // Direction of the left arm (straight forward, slightly left, mostly horizontal)
                 let lDir = [-0.15, 0.02, 1.0];
                 let lDirLen = Math.sqrt(lDir[0]**2 + lDir[1]**2 + lDir[2]**2);
                 lDir = [lDir[0]/lDirLen, lDir[1]/lDirLen, lDir[2]/lDirLen];

                 let targetLeftElbow = [
                     leftArmPivot[0] + lDir[0] * l_upper,
                     leftArmPivot[1] + lDir[1] * l_upper,
                     leftArmPivot[2] + lDir[2] * l_upper
                 ];
                 let targetLeftHand = [
                     targetLeftElbow[0] + lDir[0] * l_lower,
                     targetLeftElbow[1] + lDir[1] * l_lower,
                     targetLeftElbow[2] + lDir[2] * l_lower
                 ];

                 let leftHandStart = leftHandRot;
                 let leftElbowStart = leftElbowRot;

                 leftHandRot = [
                     leftHandStart[0] + (targetLeftHand[0] - leftHandStart[0]) * t,
                     leftHandStart[1] + (targetLeftHand[1] - leftHandStart[1]) * t,
                     leftHandStart[2] + (targetLeftHand[2] - leftHandStart[2]) * t
                 ];
                 leftElbowRot = [
                     leftElbowStart[0] + (targetLeftElbow[0] - leftElbowStart[0]) * t,
                     leftElbowStart[1] + (targetLeftElbow[1] - leftElbowStart[1]) * t,
                     leftElbowStart[2] + (targetLeftElbow[2] - leftElbowStart[2]) * t
                 ];
                 
                 // Enforce left arm lengths
                 let lElbowDir = [leftElbowRot[0]-leftArmPivot[0], leftElbowRot[1]-leftArmPivot[1], leftElbowRot[2]-leftArmPivot[2]];
                 let lElbowLen = Math.sqrt(lElbowDir[0]**2 + lElbowDir[1]**2 + lElbowDir[2]**2);
                 if(lElbowLen > 0.001) { lElbowDir = [lElbowDir[0]/lElbowLen, lElbowDir[1]/lElbowLen, lElbowDir[2]/lElbowLen]; }
                 leftElbowRot = [leftArmPivot[0] + lElbowDir[0]*l_upper, leftArmPivot[1] + lElbowDir[1]*l_upper, leftArmPivot[2] + lElbowDir[2]*l_upper];
                 
                 let lHandDir = [leftHandRot[0]-leftElbowRot[0], leftHandRot[1]-leftElbowRot[1], leftHandRot[2]-leftElbowRot[2]];
                 let lHandLen = Math.sqrt(lHandDir[0]**2 + lHandDir[1]**2 + lHandDir[2]**2);
                 if(lHandLen > 0.001) { lHandDir = [lHandDir[0]/lHandLen, lHandDir[1]/lHandLen, lHandDir[2]/lHandLen]; }
                 leftHandRot = [leftElbowRot[0] + lHandDir[0]*l_lower, leftElbowRot[1] + lHandDir[1]*l_lower, leftElbowRot[2] + lHandDir[2]*l_lower];

                 // RIGHT ARM (Pulling the string)
                 // Hand should be near the cheek/chin
                 let pullHandTarget = [leftArmPivot[0] + 0.15, leftArmPivot[1] + 0.02, leftArmPivot[2] - 0.02];
                 
                 // Elbow points outward and backwards
                 let rElbowDir = [1.0, 0.2, -0.6]; 
                 let rElbowDirLen = Math.sqrt(rElbowDir[0]**2 + rElbowDir[1]**2 + rElbowDir[2]**2);
                 rElbowDir = [rElbowDir[0]/rElbowDirLen, rElbowDir[1]/rElbowDirLen, rElbowDir[2]/rElbowDirLen];

                 let targetRightElbow = [
                     rightArmPivot[0] + rElbowDir[0] * l_upper,
                     rightArmPivot[1] + rElbowDir[1] * l_upper,
                     rightArmPivot[2] + rElbowDir[2] * l_upper
                 ];

                 // Recalculate right hand exactly at distance l_lower from right elbow towards pullHandTarget
                 let rHandDir = [
                     pullHandTarget[0] - targetRightElbow[0],
                     pullHandTarget[1] - targetRightElbow[1],
                     pullHandTarget[2] - targetRightElbow[2]
                 ];
                 let rHandDirLen = Math.sqrt(rHandDir[0]**2 + rHandDir[1]**2 + rHandDir[2]**2);
                 rHandDir = [rHandDir[0]/rHandDirLen, rHandDir[1]/rHandDirLen, rHandDir[2]/rHandDirLen];

                 let targetRightHand = [
                     targetRightElbow[0] + rHandDir[0] * l_lower,
                     targetRightElbow[1] + rHandDir[1] * l_lower,
                     targetRightElbow[2] + rHandDir[2] * l_lower
                 ];

                 let rightHandStart = transformTorso(rightHandRot); 
                 let rightElbowStart = transformTorso(rightElbowRot);
                 if (bowComboActive) {
                     // Reach for the bow string instead of dropping to hip
                     rightHandStart = [targetLeftHand[0] + 0.05, targetLeftHand[1], targetLeftHand[2]];
                     rightElbowStart = [
                         rightArmPivot[0] + rElbowDir[0] * l_upper * 0.5,
                         rightArmPivot[1] + rElbowDir[1] * l_upper * 0.5,
                         rightArmPivot[2] + rElbowDir[2] * l_upper * 0.5
                     ];
                 }
                 
                 rightHandRot = [
                     rightHandStart[0] + (targetRightHand[0] - rightHandStart[0]) * drawT,
                     rightHandStart[1] + (targetRightHand[1] - rightHandStart[1]) * drawT,
                     rightHandStart[2] + (targetRightHand[2] - rightHandStart[2]) * drawT
                 ];

                 rightElbowRot = [
                     rightElbowStart[0] + (targetRightElbow[0] - rightElbowStart[0]) * drawT,
                     rightElbowStart[1] + (targetRightElbow[1] - rightElbowStart[1]) * drawT,
                     rightElbowStart[2] + (targetRightElbow[2] - rightElbowStart[2]) * drawT
                 ];
                 
                 // Enforce right arm lengths
                 let rE_Dir = [rightElbowRot[0]-rightArmPivot[0], rightElbowRot[1]-rightArmPivot[1], rightElbowRot[2]-rightArmPivot[2]];
                 let rE_Len = Math.sqrt(rE_Dir[0]**2 + rE_Dir[1]**2 + rE_Dir[2]**2);
                 if(rE_Len > 0.001) { rE_Dir = [rE_Dir[0]/rE_Len, rE_Dir[1]/rE_Len, rE_Dir[2]/rE_Len]; }
                 rightElbowRot = [rightArmPivot[0] + rE_Dir[0]*l_upper, rightArmPivot[1] + rE_Dir[1]*l_upper, rightArmPivot[2] + rE_Dir[2]*l_upper];
                 
                 let rH_Dir = [rightHandRot[0]-rightElbowRot[0], rightHandRot[1]-rightElbowRot[1], rightHandRot[2]-rightElbowRot[2]];
                 let rH_Len = Math.sqrt(rH_Dir[0]**2 + rH_Dir[1]**2 + rH_Dir[2]**2);
                 if(rH_Len > 0.001) { rH_Dir = [rH_Dir[0]/rH_Len, rH_Dir[1]/rH_Len, rH_Dir[2]/rH_Len]; }
                 rightHandRot = [rightElbowRot[0] + rH_Dir[0]*l_lower, rightElbowRot[1] + rH_Dir[1]*l_lower, rightElbowRot[2] + rH_Dir[2]*l_lower];

                 // BOW PLACEMENT
                 let upVec = [-0.1, 1, 0.1]; 
                 let lenU = Math.sqrt(upVec[0]**2 + upVec[1]**2 + upVec[2]**2);
                 upVec = [upVec[0]/lenU, upVec[1]/lenU, upVec[2]/lenU];

                 let bowLength = 0.45;
                 let targetBowGrip = [leftHandRot[0], leftHandRot[1], leftHandRot[2]];
                 let targetBowUpper = [
                     targetBowGrip[0] + upVec[0] * bowLength,
                     targetBowGrip[1] + upVec[1] * bowLength,
                     targetBowGrip[2] + upVec[2] * bowLength
                 ];
                 let targetBowLower = [
                     targetBowGrip[0] - upVec[0] * bowLength * 0.8,
                     targetBowGrip[1] - upVec[1] * bowLength * 0.8,
                     targetBowGrip[2] - upVec[2] * bowLength * 0.8
                 ];

                 const bowGripBase = [-0.18, -0.09 + bOffset, 0.04];
                 const bowUpperTipBase = [-0.18, -0.05 + bOffset, 0.49];
                 const bowLowerTipBase = [-0.18, -0.05 + bOffset, -0.32];
                 
                 const bgL = rotatePointX(leftElbowBase, bowGripBase, -leftElbowFlex);
                 const butL = rotatePointX(leftElbowBase, bowUpperTipBase, -leftElbowFlex);
                 const bltL = rotatePointX(leftElbowBase, bowLowerTipBase, -leftElbowFlex);
                 
                 let bowGripStart = rotatePointX(originalLeftArmPivot, bgL, armAngle);
                 let bowUpperStart = rotatePointX(originalLeftArmPivot, butL, armAngle);
                 let bowLowerStart = rotatePointX(originalLeftArmPivot, bltL, armAngle);

                 bowGripRot = [
                     bowGripStart[0] + (targetBowGrip[0] - bowGripStart[0]) * t,
                     bowGripStart[1] + (targetBowGrip[1] - bowGripStart[1]) * t,
                     bowGripStart[2] + (targetBowGrip[2] - bowGripStart[2]) * t
                 ];
                 bowUpperTipRot = [
                     bowUpperStart[0] + (targetBowUpper[0] - bowUpperStart[0]) * t,
                     bowUpperStart[1] + (targetBowUpper[1] - bowUpperStart[1]) * t,
                     bowUpperStart[2] + (targetBowUpper[2] - bowUpperStart[2]) * t
                 ];
                 bowLowerTipRot = [
                     bowLowerStart[0] + (targetBowLower[0] - bowLowerStart[0]) * t,
                     bowLowerStart[1] + (targetBowLower[1] - bowLowerStart[1]) * t,
                     bowLowerStart[2] + (targetBowLower[2] - bowLowerStart[2]) * t
                 ];
                 
                 if (typeof cameraMode !== "undefined" && (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") && typeof rotationX !== "undefined") {
                      // Pitch the whole upper body to aim at the target NPC if locked, else fallback to rotationX
                      let currentPitch = rotationX;
                      if (activeTargetNPC && activeTargetNPC.position) {
                          const sinT_g = Math.sin(charTheta);
                          const cosT_g = Math.cos(charTheta);
                          const sinP_g = Math.sin(charPhi);
                          const cosP_g = Math.cos(charPhi);
                          const nx_g = sinT_g * cosP_g;
                          const ny_g = cosT_g;
                          const nz_g = sinT_g * sinP_g;
                          const h_g = getVisualHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
                          const r_terrain_g = RADIUS + h_g * HEIGHT_SCALE;
                          let r_g = r_terrain_g + 0.46 * playerScale;
                          if (typeof playerCenterRadius !== "undefined" && playerCenterRadius !== null) {
                              r_g = playerCenterRadius;
                          }
                          const player_world_x = r_g * nx_g;
                          const player_world_y = r_g * ny_g;
                          const player_world_z = r_g * nz_g;

                          const East_g = [-sinP_g, 0, cosP_g];
                          const North_g = [-cosT_g * cosP_g, sinT_g, -cosT_g * sinP_g];
                          const cosH_g = Math.cos(charHeading);
                          const sinH_g = Math.sin(charHeading);
                          const F_g = [
                              North_g[0] * cosH_g + East_g[0] * sinH_g,
                              North_g[1] * cosH_g + East_g[1] * sinH_g,
                              North_g[2] * cosH_g + East_g[2] * sinH_g,
                          ];

                          const npc = activeTargetNPC;
                          const npc_pos = npc.position;
                          const npcLen = Math.sqrt(npc_pos[0]**2 + npc_pos[1]**2 + npc_pos[2]**2);
                          const n_npc = npcLen > 0.1 ? [npc_pos[0]/npcLen, npc_pos[1]/npcLen, npc_pos[2]/npcLen] : [nx_g, ny_g, nz_g];
                          const N = npc.N || n_npc;
                          const F = npc.F || [0, 0, 0];
                          let upOffset = 0.0;
                          let forwardOffset = 0.0;
                          if (npc.type === "meganeura") {
                              upOffset = 0.0;
                              forwardOffset = -0.06;
                          } else {
                              upOffset = -0.02;
                              forwardOffset = -0.12;
                          }
                          const target_g = [
                              npc_pos[0] + N[0] * upOffset + F[0] * forwardOffset,
                              npc_pos[1] + N[1] * upOffset + F[1] * forwardOffset,
                              npc_pos[2] + N[2] * upOffset + F[2] * forwardOffset
                          ];

                          const dVec = [
                              target_g[0] - player_world_x,
                              target_g[1] - player_world_y,
                              target_g[2] - player_world_z
                          ];
                          const d_up = dVec[0] * nx_g + dVec[1] * ny_g + dVec[2] * nz_g;
                          const d_fwd = dVec[0] * F_g[0] + dVec[1] * F_g[1] + dVec[2] * F_g[2];
                          const d_dist_planar = Math.sqrt(dVec[0]**2 + dVec[1]**2 + dVec[2]**2 - d_up**2);
                          if (d_dist_planar > 0.05) {
                              currentPitch = -Math.atan2(d_up, d_dist_planar);
                          }
                      }
                      const pitchAngle = currentPitch * t;
                      const applyPitch = (pt) => rotatePointX(chestP1, pt, pitchAngle);
                      
                      chestP2 = applyPitch(chestP2);
                      neckP1 = applyPitch(neckP1);
                      neckP2 = applyPitch(neckP2);
                      headP1 = applyPitch(headP1);
                      headP2 = applyPitch(headP2);
                      leftEarP1 = applyPitch(leftEarP1);
                      leftEarP2 = applyPitch(leftEarP2);
                      rightEarP1 = applyPitch(rightEarP1);
                      rightEarP2 = applyPitch(rightEarP2);
                      
                      leftArmPivot = applyPitch(leftArmPivot);
                      rightArmPivot = applyPitch(rightArmPivot);
                      leftElbowRot = applyPitch(leftElbowRot);
                      leftHandRot = applyPitch(leftHandRot);
                      rightElbowRot = applyPitch(rightElbowRot);
                      rightHandRot = applyPitch(rightHandRot);
                      
                      bowGripRot = applyPitch(bowGripRot);
                      bowUpperTipRot = applyPitch(bowUpperTipRot);
                      bowLowerTipRot = applyPitch(bowLowerTipRot);
            }
          } else {
                 // Hand is at [0.18, -0.09 + bOffset, 0.04]
                 // Handle goes forward (along Z axis) so it's perpendicular to the arm
                 let axeHandleP1Base, axeHandleP2Base, axeBladeP1Base, axeBladeP2Base;
                 if (heldItem.name === "SHOVEL") {
                     // Shovel stick: continuous from Z = -0.04 to Z = 0.28
                     axeHandleP1Base = [0.18, -0.09 + bOffset, -0.04];
                     axeHandleP2Base = [0.18, -0.09 + bOffset, 0.28];
                     // Shovel blade (scoop): extends forward from the handle along Z axis! (Z = 0.28 to Z = 0.44)
                     axeBladeP1Base = [0.18, -0.09 + bOffset, 0.28];
                     axeBladeP2Base = [0.18, -0.09 + bOffset, 0.44];

                     // Handle D-Loop points at the back:
                     const shovelD1Base = [0.18, -0.09 + bOffset, -0.04];
                     const shovelD2Base = [0.18, -0.09 + bOffset, -0.08];
                     const shovelLeftBase = [0.18 - 0.04, -0.09 + bOffset, -0.12];
                     const shovelRightBase = [0.18 + 0.04, -0.09 + bOffset, -0.12];
                     
                     const d1L = rotatePointX(rightElbowBase, shovelD1Base, -rightElbowFlex);
                     const d2L = rotatePointX(rightElbowBase, shovelD2Base, -rightElbowFlex);
                     const dlL = rotatePointX(rightElbowBase, shovelLeftBase, -rightElbowFlex);
                     const drL = rotatePointX(rightElbowBase, shovelRightBase, -rightElbowFlex);
                     
                     shovelD1Rot = rotatePointX(rightArmPivot, d1L, rightArmAngle);
                     shovelD2Rot = rotatePointX(rightArmPivot, d2L, rightArmAngle);
                      shovelLeftBranchRot = rotatePointX(rightArmPivot, dlL, rightArmAngle);
                      shovelRightBranchRot = rotatePointX(rightArmPivot, drL, rightArmAngle);
                  } else {
                      axeHandleP1Base = [0.18, -0.09 + bOffset, -0.04];
                      axeHandleP2Base = [0.18, -0.09 + bOffset, 0.26];
                      axeBladeP1Base = [0.18, -0.09 + bOffset, 0.21];
                      axeBladeP2Base = [0.18, -0.21 + bOffset, 0.21];
                  }
                 
                 const p1L = rotatePointX(rightElbowBase, axeHandleP1Base, -rightElbowFlex);
                 const p2L = rotatePointX(rightElbowBase, axeHandleP2Base, -rightElbowFlex);
                 const b1L = rotatePointX(rightElbowBase, axeBladeP1Base, -rightElbowFlex);
                 const b2L = rotatePointX(rightElbowBase, axeBladeP2Base, -rightElbowFlex);
                 
                 axeHandleP1Rot = rotatePointX(rightArmPivot, p1L, rightArmAngle);
                 axeHandleP2Rot = rotatePointX(rightArmPivot, p2L, rightArmAngle);
                 axeBladeP1Rot = rotatePointX(rightArmPivot, b1L, rightArmAngle);
                 axeBladeP2Rot = rotatePointX(rightArmPivot, b2L, rightArmAngle);

                 if (heldItem.name === "PICKAXE") {
                     const axeBlade2P1Base = [0.18, -0.09 + bOffset, 0.21]; // Base of blade (same)
                     const axeBlade2P2Base = [0.18, 0.03 + bOffset, 0.21]; // Tip of blade (other side, UP)
                     const b2_1L = rotatePointX(rightElbowBase, axeBlade2P1Base, -rightElbowFlex);
                     const b2_2L = rotatePointX(rightElbowBase, axeBlade2P2Base, -rightElbowFlex);
                     axeBlade2P1Rot = rotatePointX(rightArmPivot, b2_1L, rightArmAngle);
                     axeBlade2P2Rot = rotatePointX(rightArmPivot, b2_2L, rightArmAngle);
                 }
             }
        }

        let R_rot = null, N_rot = null, F_rot = null;

        if (ragdollEnabled && ragdollInitialized) {
          const rx = ragdollAxis[0],
            ry = ragdollAxis[1],
            rz = ragdollAxis[2];
          const angle = ragdollAngle;
          const c = Math.cos(angle);
          const s = Math.sin(angle);
          const t = 1 - c;

          const m00 = t * rx * rx + c;
          const m01 = t * rx * ry - s * rz;
          const m02 = t * rx * rz + s * ry;

          const m10 = t * rx * ry + s * rz;
          const m11 = t * ry * ry + c;
          const m12 = t * ry * rz - s * rx;

          const m20 = t * rx * rz - s * ry;
          const m21 = t * ry * rz + s * rx;
          const m22 = t * rz * rz + c;

          const b = ragdollBaseMatrix;
          R_rot = [
            m00 * b[0] + m01 * b[1] + m02 * b[2],
            m10 * b[0] + m11 * b[1] + m12 * b[2],
            m20 * b[0] + m21 * b[1] + m22 * b[2],
          ];
          N_rot = [
            m00 * b[4] + m01 * b[5] + m02 * b[6],
            m10 * b[4] + m11 * b[5] + m12 * b[6],
            m20 * b[4] + m21 * b[5] + m22 * b[6],
          ];
          F_rot = [
            m00 * b[8] + m01 * b[9] + m02 * b[10],
            m10 * b[8] + m11 * b[9] + m12 * b[10],
            m20 * b[8] + m21 * b[9] + m22 * b[10],
          ];

          const rp = ragdollPos;
          const r_len = Math.sqrt(rp[0] ** 2 + rp[1] ** 2 + rp[2] ** 2);
          const gravityDir =
            r_len > 0.001
              ? [-rp[0] / r_len, -rp[1] / r_len, -rp[2] / r_len]
              : [0, -1, 0];

          const toWorld = (pt, thickness, sagScale) => {
            let px =
              rp[0] +
              playerScale *
                (pt[0] * R_rot[0] + pt[1] * N_rot[0] + pt[2] * F_rot[0]);
            let py =
              rp[1] +
              playerScale *
                (pt[0] * R_rot[1] + pt[1] * N_rot[1] + pt[2] * F_rot[1]);
            let pz =
              rp[2] +
              playerScale *
                (pt[0] * R_rot[2] + pt[1] * N_rot[2] + pt[2] * F_rot[2]);

            // Apply gravity sag
            px += gravityDir[0] * sagScale * playerScale;
            py += gravityDir[1] * sagScale * playerScale;
            pz += gravityDir[2] * sagScale * playerScale;

            // Clamping to terrain to make it floppy and perfectly aligned with floor
            const dist = Math.sqrt(px * px + py * py + pz * pz);
            if (dist > 0.001) {
              const ux = px / dist;
              const uy = py / dist;
              const uz = pz / dist;

              const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
              const phi = Math.atan2(uz, ux);
              const surfaceRadius = RADIUS + getVisualHeightOnSphere(theta, phi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) * HEIGHT_SCALE;
              const caveData = typeof getTerrainSurfaceAndCeiling === "function"
                ? getTerrainSurfaceAndCeiling(ux, uy, uz, dist)
                : { ground: surfaceRadius, insideTunnel: false, ceiling: Infinity };

              if (caveData.insideTunnel) {
                  const minRad = caveData.ground + thickness * playerScale;
                  const maxRad = caveData.ceiling !== Infinity ? caveData.ceiling - thickness * playerScale : Infinity;
                  if (dist < minRad) {
                      px = ux * minRad;
                      py = uy * minRad;
                      pz = uz * minRad;
                  } else if (dist > maxRad && maxRad !== Infinity) {
                      px = ux * maxRad;
                      py = uy * maxRad;
                      pz = uz * maxRad;
                  }
              } else {
                  const minRad = surfaceRadius + thickness * playerScale;
                  if (dist < minRad) {
                      px = ux * minRad;
                      py = uy * minRad;
                      pz = uz * minRad;
                  }
              }
            }
            return [px, py, pz];
          };

          chestP1 = toWorld(chestP1, 0.09, 0.02);
          chestP2 = toWorld(chestP2, 0.09, 0.04);
          pelvisP1 = toWorld(pelvisP1, 0.085, 0.0);
          pelvisP2 = toWorld(pelvisP2, 0.085, 0.0);
          neckP1 = toWorld(neckP1, 0.045, 0.04);
          neckP2 = toWorld(neckP2, 0.045, 0.05);
          headP1 = toWorld(headP1, 0.16, 0.06);
          headP2 = toWorld(headP2, 0.16, 0.06);
          leftEarP1 = toWorld(leftEarP1, 0.035, 0.07);
          leftEarP2 = toWorld(leftEarP2, 0.035, 0.07);
          rightEarP1 = toWorld(rightEarP1, 0.035, 0.07);
          rightEarP2 = toWorld(rightEarP2, 0.035, 0.07);

          leftArmPivot = toWorld(leftArmPivot, 0.038, 0.02);
          leftElbowRot = toWorld(leftElbowRot, 0.038, 0.05);
          leftHandRot = toWorld(leftHandRot, 0.032, 0.1);

          rightArmPivot = toWorld(rightArmPivot, 0.038, 0.02);
          rightElbowRot = toWorld(rightElbowRot, 0.038, 0.05);
          rightHandRot = toWorld(rightHandRot, 0.032, 0.1);

          leftLegPivot = toWorld(leftLegPivot, 0.048, 0.02);
          leftKneeRot = toWorld(leftKneeRot, 0.048, 0.05);
          leftFootRot = toWorld(leftFootRot, 0.04, 0.1);

          rightLegPivot = toWorld(rightLegPivot, 0.048, 0.02);
          rightKneeRot = toWorld(rightKneeRot, 0.048, 0.05);
          rightFootRot = toWorld(rightFootRot, 0.04, 0.1);
          
          if (heldItem) {
              if (heldItem.name === "BOW") {
                  bowGripRot = toWorld(bowGripRot, 0.03, 0.1);
                  bowUpperTipRot = toWorld(bowUpperTipRot, 0.03, 0.1);
                  bowLowerTipRot = toWorld(bowLowerTipRot, 0.03, 0.1);
              } else {
                  axeHandleP1Rot = toWorld(axeHandleP1Rot, 0.03, 0.1);
                  axeHandleP2Rot = toWorld(axeHandleP2Rot, 0.03, 0.1);
                  axeBladeP1Rot = toWorld(axeBladeP1Rot, 0.04, 0.1);
                  axeBladeP2Rot = toWorld(axeBladeP2Rot, 0.04, 0.1);
                  if (heldItem.name === "PICKAXE") {
                      axeBlade2P1Rot = toWorld(axeBlade2P1Rot, 0.04, 0.1);
                      axeBlade2P2Rot = toWorld(axeBlade2P2Rot, 0.04, 0.1);
                  }
              }
          }
        }

        const scaleFactor = ragdollEnabled ? playerScale : 1.0;
        const chest = generateCapsule(
          chestP1,
          chestP2,
          (0.09 + bRadius) * scaleFactor,
          8,
          8,
        );
        const pelvis = generateCapsule(
          pelvisP1,
          pelvisP2,
          0.085 * scaleFactor,
          8,
          8,
        );
        const neck = generateCapsule(
          neckP1,
          neckP2,
          0.045 * scaleFactor,
          6,
          6,
        );
        const head = generateCapsule(
          headP1,
          headP2,
          0.24 * scaleFactor,
          8,
          8,
        );
        const leftEar = generateCapsule(
          leftEarP1,
          leftEarP2,
          0.035 * scaleFactor,
          6,
          6,
        );
        const rightEar = generateCapsule(
          rightEarP1,
          rightEarP2,
          0.035 * scaleFactor,
          6,
          6,
        );

        // Generate unpitched, un-yawed counterparts for local coordinate face mapping
        const localChest = generateCapsule(
          localChestP1,
          localChestP2,
          (0.09 + bRadius) * scaleFactor,
          8,
          8,
        );
        const localPelvis = generateCapsule(
          localPelvisP1,
          localPelvisP2,
          0.085 * scaleFactor,
          8,
          8,
        );
        const localNeck = generateCapsule(
          localNeckP1,
          localNeckP2,
          0.045 * scaleFactor,
          6,
          6,
        );
        const localHead = generateCapsule(
          localHeadP1,
          localHeadP2,
          0.24 * scaleFactor,
          8,
          8,
        );
        const localLeftEar = generateCapsule(
          localLeftEarP1,
          localLeftEarP2,
          0.035 * scaleFactor,
          6,
          6,
        );
        const localRightEar = generateCapsule(
          localRightEarP1,
          localRightEarP2,
          0.035 * scaleFactor,
          6,
          6,
        );

        const leftArmUpper = generateCapsule(
          leftArmPivot,
          leftElbowRot,
          0.038 * scaleFactor,
          6,
          6,
        );
        const leftArmLower = generateCapsule(
          leftElbowRot,
          leftHandRot,
          0.032 * scaleFactor,
          6,
          6,
        );

        const rightArmUpper = generateCapsule(
          rightArmPivot,
          rightElbowRot,
          0.038 * scaleFactor,
          6,
          6,
        );
        const rightArmLower = generateCapsule(
          rightElbowRot,
          rightHandRot,
          0.032 * scaleFactor,
          6,
          6,
        );

        const leftLegUpper = generateCapsule(
          leftLegPivot,
          leftKneeRot,
          0.048 * scaleFactor,
          6,
          6,
        );
        const leftLegLower = generateCapsule(
          leftKneeRot,
          leftFootRot,
          0.04 * scaleFactor,
          6,
          6,
        );

        const rightLegUpper = generateCapsule(
          rightLegPivot,
          rightKneeRot,
          0.048 * scaleFactor,
          6,
          6,
        );
        const rightLegLower = generateCapsule(
          rightKneeRot,
          rightFootRot,
          0.04 * scaleFactor,
          6,
          6,
        );

        // Build Chibi detailed hands, fingers, ankles, feet, toes
        const leftHandParts = buildHandAndFingers(leftElbowRot, leftHandRot, true, scaleFactor);
        const rightHandParts = buildHandAndFingers(rightElbowRot, rightHandRot, false, scaleFactor);
        const leftFootParts = buildFootAnkleToes(leftKneeRot, leftFootRot, true, scaleFactor);
        const rightFootParts = buildFootAnkleToes(rightKneeRot, rightFootRot, false, scaleFactor);

        // === Build 3D Anime Hair for Player Character (High Performance Cached) ===
        if (!window._cachedHairState) {
          window._cachedHairState = { key: "", baseMesh: null, localDummyV: null };
        }

        function getBaseLocalHairMesh() {
          const style = window.playerHairStyle !== undefined ? window.playerHairStyle : 0;
          if (!window.playerHairColor) {
            const colors = window.ANIME_HAIR_COLORS || [[0.85, 0.90, 0.96]];
            window.playerHairColor = colors[0];
          }
          const color = window.playerHairColor;
          const key = `${style}_${color.join(",")}_${scaleFactor}`;

          if (window._cachedHairState.baseMesh && window._cachedHairState.key === key) {
            return window._cachedHairState;
          }

          const localV = [], c = [], i = [];
          if (typeof window.build3DAnimeHair === "function") {
            const identityPtFn = (lx, ly, lz) => [lx, ly, lz];
            window.build3DAnimeHair(
              style,
              color,
              scaleFactor,
              identityPtFn,
              0, // headTilt
              localV,
              c,
              i
            );
          }

          if (localV.length === 0) {
            window._cachedHairState = {
              key,
              baseMesh: { localV: [], colors: [], normals: [], indices: [] },
              localDummyV: []
            };
            return window._cachedHairState;
          }

          const normals = new Float32Array(localV.length);
          for (let k = 0; k < i.length; k += 3) {
            const i0 = i[k], i1 = i[k+1], i2 = i[k+2];
            if (i0 * 3 + 2 >= localV.length || i1 * 3 + 2 >= localV.length || i2 * 3 + 2 >= localV.length) continue;
            const p0 = [localV[i0*3], localV[i0*3+1], localV[i0*3+2]];
            const p1 = [localV[i1*3], localV[i1*3+1], localV[i1*3+2]];
            const p2 = [localV[i2*3], localV[i2*3+1], localV[i2*3+2]];

            const ux = p1[0]-p0[0], uy = p1[1]-p0[1], uz = p1[2]-p0[2];
            const wx = p2[0]-p0[0], wy = p2[1]-p0[1], wz = p2[2]-p0[2];

            const nx = uy*wz - uz*wy;
            const ny = uz*wx - ux*wz;
            const nz = ux*wy - uy*wx;

            normals[i0*3] += nx; normals[i0*3+1] += ny; normals[i0*3+2] += nz;
            normals[i1*3] += nx; normals[i1*3+1] += ny; normals[i1*3+2] += nz;
            normals[i2*3] += nx; normals[i2*3+1] += ny; normals[i2*3+2] += nz;
          }

          for (let k = 0; k < normals.length; k += 3) {
            const len = Math.sqrt(normals[k]**2 + normals[k+1]**2 + normals[k+2]**2);
            if (len > 0.0001) {
              normals[k] /= len;
              normals[k+1] /= len;
              normals[k+2] /= len;
            } else {
              normals[k+1] = 1.0;
            }
          }

          const localDummyV = new Array(localV.length);
          for (let k = 0; k < localV.length; k += 3) {
            localDummyV[k] = 0;
            localDummyV[k+1] = -999.0;
            localDummyV[k+2] = 0;
          }

          window._cachedHairState = {
            key,
            baseMesh: {
              localV,
              colors: c,
              normals: Array.from(normals),
              indices: i
            },
            localDummyV
          };

          return window._cachedHairState;
        }

        function createHairMesh(isLocal) {
          const cached = getBaseLocalHairMesh();
          const bm = cached.baseMesh;
          if (!bm || !bm.localV || bm.localV.length === 0) {
            return { vertices: [], colors: [], normals: [], indices: [] };
          }

          if (isLocal) {
            return {
              vertices: cached.localDummyV,
              colors: bm.colors,
              normals: bm.normals,
              indices: bm.indices
            };
          }

          const isRag = !!(ragdollEnabled && ragdollInitialized && R_rot && N_rot && F_rot);
          const targetHeadP = headP1;
          const numCoords = bm.localV.length;
          const worldV = new Array(numCoords);
          const worldNormals = isRag ? new Array(numCoords) : bm.normals;
          const hx = targetHeadP[0];
          const hy = targetHeadP[1];
          const hz = targetHeadP[2];
          const scale = scaleFactor;

          const timeSec = (typeof performance !== "undefined" ? performance.now() : Date.now()) * 0.0028;

          // Action & Jump physics parameters
          const vertVel = (typeof playerVerticalVel !== "undefined") ? playerVerticalVel : 0.0;
          const isGrounded = (typeof isPlayerGrounded !== "undefined") ? isPlayerGrounded : true;

          // Landing spring simulation
          if (!window._hairSpring) {
            window._hairSpring = { y: 0.0, vy: 0.0, lastGrounded: true };
          }
          const spring = window._hairSpring;

          if (isGrounded && !spring.lastGrounded) {
            // Landing impact
            spring.vy = -0.016;
          }
          spring.lastGrounded = isGrounded;

          // Update spring oscillator (harmonic damping)
          spring.vy += (-180.0 * spring.y - 12.0 * spring.vy) * 0.016;
          spring.y += spring.vy * 0.016;
          const bounceY = spring.y;

          // Air displacement from vertical jump velocity
          let airY = 0.0;
          let airFlare = 0.0;
          if (vertVel > 0.0005) {
            // Ascending jump (lag downward)
            airY = -vertVel * 6.5;
            airFlare = vertVel * 2.5;
          } else if (vertVel < -0.0005) {
            // Descending / falling (float upward & flare outward)
            const fallSpeed = Math.abs(vertVel);
            airY = fallSpeed * 9.0;
            airFlare = fallSpeed * 5.0;
          }

          // Walk / Run cycle sway
          const walkX = Math.sin(phase) * 0.014;
          const walkZ = Math.cos(phase * 2.0) * 0.010;
          const walkY = -Math.abs(Math.sin(phase)) * 0.006;

          // Item / Tool swing action whip
          let actionZ = 0.0;
          let actionY = 0.0;
          if (typeof isUsingItem !== "undefined" && isUsingItem && typeof useAnimTimer !== "undefined") {
            const swingFactor = Math.sin((1.0 - useAnimTimer) * Math.PI);
            actionZ = swingFactor * 0.024;
            actionY = -Math.abs(swingFactor) * 0.008;
          }

          for (let k = 0; k < numCoords; k += 3) {
            const lx = bm.localV[k];
            const ly = bm.localV[k+1];
            const lz = bm.localV[k+2];

            // Flex factor increases naturally towards hair tips (scalp root lx,ly is anchored)
            const flex = Math.max(0.0, (0.24 - ly) * 1.5);
            const flexSq = flex * flex;

            // Outward direction vector from skull center for flare outwards during jump
            const distXZ = Math.sqrt(lx * lx + lz * lz) || 0.001;
            const dirX = lx / distXZ;
            const dirZ = lz / distXZ;

            // Gentle organic ambient breeze
            const breezeX = Math.sin(timeSec * 2.6 + ly * 12.0 + lx * 5.0) * 0.006 * flexSq;
            const breezeZ = Math.cos(timeSec * 2.1 + ly * 10.0 + lz * 5.0) * 0.006 * flexSq;

            // Combine all physical forces
            const totalDx = breezeX + (isRag ? 0.0 : (walkX * flexSq + dirX * airFlare * flexSq));
            const totalDy = (isRag ? 0.0 : ((walkY + actionY + airY + bounceY) * flexSq - Math.abs(totalDx) * 0.12));
            const totalDz = breezeZ + (isRag ? 0.0 : (walkZ * flexSq + actionZ * flexSq + dirZ * airFlare * flexSq));

            const offX = (lx + totalDx) * scale;
            const offY = (ly + totalDy) * scale;
            const offZ = (lz + totalDz) * scale;

            if (isRag) {
              worldV[k]   = hx + (offX * R_rot[0] + offY * N_rot[0] + offZ * F_rot[0]);
              worldV[k+1] = hy + (offX * R_rot[1] + offY * N_rot[1] + offZ * F_rot[1]);
              worldV[k+2] = hz + (offX * R_rot[2] + offY * N_rot[2] + offZ * F_rot[2]);

              const nx = bm.normals[k];
              const ny = bm.normals[k+1];
              const nz = bm.normals[k+2];
              worldNormals[k]   = nx * R_rot[0] + ny * N_rot[0] + nz * F_rot[0];
              worldNormals[k+1] = nx * R_rot[1] + ny * N_rot[1] + nz * F_rot[1];
              worldNormals[k+2] = nx * R_rot[2] + ny * N_rot[2] + nz * F_rot[2];
            } else {
              worldV[k]   = hx + offX;
              worldV[k+1] = hy + offY;
              worldV[k+2] = hz + offZ;
            }
          }

          return {
            vertices: worldV,
            colors: bm.colors,
            normals: worldNormals,
            indices: bm.indices
          };
        }

        const playerHairMesh = createHairMesh(false);
        const playerLocalHairMesh = createHairMesh(true);

        let meshesToMerge = [
          chest,
          pelvis,
          neck,
          head,
          playerHairMesh,
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
          ...leftHandParts,
          ...rightHandParts,
          ...leftFootParts,
          ...rightFootParts,
        ];

        let localMeshesToMerge = [
          localChest,
          localPelvis,
          localNeck,
          localHead,
          playerLocalHairMesh,
          localLeftEar,
          localRightEar,
          leftArmUpper,
          leftArmLower,
          rightArmUpper,
          rightArmLower,
          leftLegUpper,
          leftLegLower,
          rightLegUpper,
          rightLegLower,
          ...leftHandParts,
          ...rightHandParts,
          ...leftFootParts,
          ...rightFootParts,
        ];
        
        if (heldItem) {
            const charMat = getCharacterMatrix();
            const transformPt = (p) => {
                if (!p) return [0, 0, 0];
                return [p[0], p[1], p[2]];
            };

            const rawV = [], rawC = [], rawI = [];
            
            const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
            const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
            const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
            const normalize = (v) => {
                const l = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
                if (l < 1e-5) return [1,0,0];
                return [v[0]/l, v[1]/l, v[2]/l];
            };
            const scale = (v, s) => [v[0]*s, v[1]*s, v[2]*s];

            const isRag = (ragdollEnabled && ragdollInitialized);
            const itemScale = isRag ? playerScale : 1.0;

            const addWedge = (pBase, pTip, widthBase, widthTip, thickness, color) => {
                const dir = sub(pTip, pBase);
                const f = normalize(dir); // points from base to tip
                const charX = isRag ? [charMat[0], charMat[1], charMat[2]] : [1, 0, 0];
                
                // let's use charX as thickness direction
                const right = normalize(charX); 
                const forward = normalize(cross(right, f)); // perpendicular to thickness and blade direction

                const sx = scale(right, thickness * 0.5);
                const wBase = scale(forward, widthBase * 0.5);
                const wTip = scale(forward, widthTip * 0.5);

                const vBaseIdx = rawV.length / 3;
                
                // 4 points at base
                const b1 = add(add(pBase, sx), wBase);
                const b2 = add(sub(pBase, sx), wBase);
                const b3 = sub(sub(pBase, sx), wBase);
                const b4 = add(sub(pBase, wBase), sx);

                // 4 points at tip (wedge shape)
                const t1 = add(add(pTip, scale(sx, 0.1)), wTip); // sharper at tip
                const t2 = add(sub(pTip, scale(sx, 0.1)), wTip);
                const t3 = sub(sub(pTip, scale(sx, 0.1)), wTip);
                const t4 = add(sub(pTip, wTip), scale(sx, 0.1));

                const pts = [b1, b2, b3, b4, t1, t2, t3, t4];
                for (let p of pts) {
                    rawV.push(...p);
                    rawC.push(...color);
                }
                
                const indices = [
                    0,3,2, 0,2,1, // base (-Z)
                    4,5,6, 4,6,7, // tip (+Z)
                    0,1,5, 0,5,4, // top (+Y)
                    3,7,6, 3,6,2, // bottom (-Y)
                    0,4,7, 0,7,3, // right (+X)
                    1,2,6, 1,6,5  // left (-X)
                ];
                for (let idx of indices) {
                    rawI.push(vBaseIdx + idx);
                }
            };

            if (heldItem && heldItem.name === "BOW") {
                const wGrip = isRag ? bowGripRot : transformPt(bowGripRot);
                const wUpperTip = isRag ? bowUpperTipRot : transformPt(bowUpperTipRot);
                const wLowerTip = isRag ? bowLowerTipRot : transformPt(bowLowerTipRot);
                
                const bowScale = itemScale;
                let wNock;
                if (!arrowShotInCurrentAnim && useAnimTimer > 0) {
                    wNock = isRag ? rightHandRot : transformPt(rightHandRot);
                } else {
                    const wGripVal = wGrip;
                    const wHandVal = isRag ? rightHandRot : transformPt(rightHandRot);
                    const pullVec = [wHandVal[0] - wGripVal[0], wHandVal[1] - wGripVal[1], wHandVal[2] - wGripVal[2]];
                    const dist = Math.sqrt(pullVec[0]**2 + pullVec[1]**2 + pullVec[2]**2);
                    if (dist > 0.001) {
                        const pullDir = [pullVec[0] / dist, pullVec[1] / dist, pullVec[2] / dist];
                        let t_rel = 0;
                        if (lastBowShootTime) {
                            t_rel = (Date.now() - lastBowShootTime) / 1000.0;
                        }
                        const drawP = typeof lastBowDrawPower !== "undefined" ? lastBowDrawPower : 1.0;
                        const vibeAmp = 0.15 * bowScale * drawP * Math.cos(t_rel * 40.0) * Math.exp(-t_rel * 6.0);
                        wNock = [wGripVal[0] + pullDir[0] * vibeAmp, wGripVal[1] + pullDir[1] * vibeAmp, wGripVal[2] + pullDir[2] * vibeAmp];
                    } else {
                        wNock = wGripVal;
                    }
                }

                const bowColor = [0.55, 0.38, 0.22];
                
                // Calculate permanent bow bend shape
                let bUp = [wUpperTip[0] - wLowerTip[0], wUpperTip[1] - wLowerTip[1], wUpperTip[2] - wLowerTip[2]];
                let bUpLen = Math.sqrt(bUp[0]**2 + bUp[1]**2 + bUp[2]**2);
                if (bUpLen > 0.001) { bUp[0]/=bUpLen; bUp[1]/=bUpLen; bUp[2]/=bUpLen; }
                
                const chestW = isRag ? chestP1 : transformPt(chestP1);
                let bOut = [wGrip[0] - chestW[0], wGrip[1] - chestW[1], wGrip[2] - chestW[2]];
                
                let bRight = [
                     bUp[1]*bOut[2] - bUp[2]*bOut[1],
                     bUp[2]*bOut[0] - bUp[0]*bOut[2],
                     bUp[0]*bOut[1] - bUp[1]*bOut[0]
                ];
                let bRightLen = Math.sqrt(bRight[0]**2 + bRight[1]**2 + bRight[2]**2);
                if (bRightLen > 0.001) { bRight[0]/=bRightLen; bRight[1]/=bRightLen; bRight[2]/=bRightLen; }
                else { bRight = [1,0,0]; }
                
                let bFwd = [
                     bRight[1]*bUp[2] - bRight[2]*bUp[1],
                     bRight[2]*bUp[0] - bRight[0]*bUp[2],
                     bRight[0]*bUp[1] - bRight[1]*bUp[0]
                ];
                let dotFwdOut = bFwd[0]*bOut[0] + bFwd[1]*bOut[1] + bFwd[2]*bOut[2];
                if (dotFwdOut < 0) { bFwd[0]*=-1; bFwd[1]*=-1; bFwd[2]*=-1; }
                
                const bendMag = 0.16 * bowScale;
                const wUpperMid = [
                    (wGrip[0] + wUpperTip[0]) * 0.5 + bFwd[0] * bendMag,
                    (wGrip[1] + wUpperTip[1]) * 0.5 + bFwd[1] * bendMag,
                    (wGrip[2] + wUpperTip[2]) * 0.5 + bFwd[2] * bendMag
                ];
                const wLowerMid = [
                    (wGrip[0] + wLowerTip[0]) * 0.5 + bFwd[0] * bendMag,
                    (wGrip[1] + wLowerTip[1]) * 0.5 + bFwd[1] * bendMag,
                    (wGrip[2] + wLowerTip[2]) * 0.5 + bFwd[2] * bendMag
                ];

                buildTaperedSegment(wGrip, wUpperMid, 0.02 * bowScale, 0.014 * bowScale, 5, bowColor, rawV, rawC, rawI);
                buildTaperedSegment(wUpperMid, wUpperTip, 0.014 * bowScale, 0.008 * bowScale, 5, bowColor, rawV, rawC, rawI);
                
                buildTaperedSegment(wGrip, wLowerMid, 0.02 * bowScale, 0.014 * bowScale, 5, bowColor, rawV, rawC, rawI);
                buildTaperedSegment(wLowerMid, wLowerTip, 0.014 * bowScale, 0.008 * bowScale, 5, bowColor, rawV, rawC, rawI);

                const stringColor = [0.95, 0.95, 0.95];
                buildTaperedSegment(wUpperTip, wNock, 0.003 * bowScale, 0.003 * bowScale, 4, stringColor, rawV, rawC, rawI);
                buildTaperedSegment(wLowerTip, wNock, 0.003 * bowScale, 0.003 * bowScale, 4, stringColor, rawV, rawC, rawI);

                if (!arrowShotInCurrentAnim && useAnimTimer > 0) {
                    const arrowDir = [wGrip[0] - wNock[0], wGrip[1] - wNock[1], wGrip[2] - wNock[2]];
                    const arrowLen = Math.sqrt(arrowDir[0]**2 + arrowDir[1]**2 + arrowDir[2]**2);
                    if (arrowLen > 0.001) {
                        arrowDir[0] /= arrowLen;
                        arrowDir[1] /= arrowLen;
                        arrowDir[2] /= arrowLen;
                        if (!ragdollEnabled || !ragdollInitialized) {
                            window.lastBowGripPos = [
                                charMat[0]*wGrip[0] + charMat[4]*wGrip[1] + charMat[8]*wGrip[2] + charMat[12],
                                charMat[1]*wGrip[0] + charMat[5]*wGrip[1] + charMat[9]*wGrip[2] + charMat[13],
                                charMat[2]*wGrip[0] + charMat[6]*wGrip[1] + charMat[10]*wGrip[2] + charMat[14]
                            ];
                            window.lastBowAimDir = [
                                charMat[0]*arrowDir[0] + charMat[4]*arrowDir[1] + charMat[8]*arrowDir[2],
                                charMat[1]*arrowDir[0] + charMat[5]*arrowDir[1] + charMat[9]*arrowDir[2],
                                charMat[2]*arrowDir[0] + charMat[6]*arrowDir[1] + charMat[10]*arrowDir[2]
                            ];
                        } else {
                            window.lastBowGripPos = [wGrip[0], wGrip[1], wGrip[2]];
                            window.lastBowAimDir = [arrowDir[0], arrowDir[1], arrowDir[2]];
                        }
                    }
                    const arrowTipPos = [
                        wGrip[0] + arrowDir[0] * 0.12 * bowScale,
                        wGrip[1] + arrowDir[1] * 0.12 * bowScale,
                        wGrip[2] + arrowDir[2] * 0.12 * bowScale
                    ];
                    
                    const shaftColor = [0.55, 0.4, 0.25];
                    buildTaperedSegment(wNock, arrowTipPos, 0.005 * bowScale, 0.005 * bowScale, 4, shaftColor, rawV, rawC, rawI);

                    const featherColor = [0.9, 0.2, 0.2];
                    const fletchEnd = [
                        wNock[0] + arrowDir[0] * 0.05 * bowScale,
                        wNock[1] + arrowDir[1] * 0.05 * bowScale,
                        wNock[2] + arrowDir[2] * 0.05 * bowScale
                    ];
                    buildTaperedSegment(wNock, fletchEnd, 0.015 * bowScale, 0.006 * bowScale, 4, featherColor, rawV, rawC, rawI);

                    const flintColor = [0.35, 0.35, 0.35];
                    const headEnd = [
                        arrowTipPos[0] + arrowDir[0] * 0.02 * bowScale,
                        arrowTipPos[1] + arrowDir[1] * 0.02 * bowScale,
                        arrowTipPos[2] + arrowDir[2] * 0.02 * bowScale
                    ];
                    addWedge(arrowTipPos, headEnd, 0.025 * bowScale, 0.002 * bowScale, 0.006 * bowScale, flintColor);
            }
          } else {
                const wHandleP1 = transformPt(axeHandleP1Rot);
                const wHandleP2 = transformPt(axeHandleP2Rot);
                const wBladeBase = transformPt(axeBladeP1Rot);
                const wBladeTip = transformPt(axeBladeP2Rot);

                const handleColor = [0.4, 0.25, 0.15];
                buildTaperedSegment(wHandleP1, wHandleP2, 0.015 * itemScale, 0.015 * itemScale, 5, handleColor, rawV, rawC, rawI);
                
                const bladeColor = [0.65, 0.65, 0.65];
                
                if (heldItem.name === "AXE") {
                    // The wedge is wide at tip, narrow at base for axe
                    addWedge(wBladeBase, wBladeTip, 0.04 * itemScale, 0.08 * itemScale, 0.01 * itemScale, bladeColor);
                } else if (heldItem.name === "PICKAXE") {
                    // The wedge is pointy for pickaxe (narrow at tip)
                    addWedge(wBladeBase, wBladeTip, 0.03 * itemScale, 0.005 * itemScale, 0.01 * itemScale, bladeColor);
                    
                    const wBlade2Base = transformPt(axeBlade2P1Rot);
                    const wBlade2Tip = transformPt(axeBlade2P2Rot);
                    addWedge(wBlade2Base, wBlade2Tip, 0.03 * itemScale, 0.005 * itemScale, 0.01 * itemScale, bladeColor);
                } else if (heldItem.name === "SHOVEL") {
                    // 1. Draw D-handle components at the back of the handle
                    const wD1 = transformPt(shovelD1Rot);
                    const wD2 = transformPt(shovelD2Rot);
                    const wLeft = transformPt(shovelLeftBranchRot);
                    const wRight = transformPt(shovelRightBranchRot);
                    
                    const shovelPartsColor = [0.25, 0.25, 0.25]; // Charcoal/dark metal
                    // Stem of D-handle
                    buildTaperedSegment(wD1, wD2, 0.012 * itemScale, 0.012 * itemScale, 5, shovelPartsColor, rawV, rawC, rawI);
                    // Left and right loop branches
                    buildTaperedSegment(wD2, wLeft, 0.01 * itemScale, 0.01 * itemScale, 4, shovelPartsColor, rawV, rawC, rawI);
                    buildTaperedSegment(wD2, wRight, 0.01 * itemScale, 0.01 * itemScale, 4, shovelPartsColor, rawV, rawC, rawI);
                    // Grip bar
                    buildTaperedSegment(wLeft, wRight, 0.011 * itemScale, 0.011 * itemScale, 5, shovelPartsColor, rawV, rawC, rawI);

                    // 2. Draw shovel blade scoop
                    const wBladeSocketEnd = [
                        wBladeBase[0] + (wBladeTip[0] - wBladeBase[0]) * 0.2,
                        wBladeBase[1] + (wBladeTip[1] - wBladeBase[1]) * 0.2,
                        wBladeBase[2] + (wBladeTip[2] - wBladeBase[2]) * 0.2
                    ];
                    const wBladeMid = [
                        wBladeBase[0] + (wBladeTip[0] - wBladeBase[0]) * 0.65,
                        wBladeBase[1] + (wBladeTip[1] - wBladeBase[1]) * 0.65,
                        wBladeBase[2] + (wBladeTip[2] - wBladeBase[2]) * 0.65
                    ];

                    // Scoop neck/socket
                    buildTaperedSegment(wBladeBase, wBladeSocketEnd, 0.016 * itemScale, 0.016 * itemScale, 5, [0.35, 0.35, 0.35], rawV, rawC, rawI);
                    // Scoop main plate
                    addWedge(wBladeSocketEnd, wBladeMid, 0.07 * itemScale, 0.065 * itemScale, 0.012 * itemScale, bladeColor);
                    // Scoop pointy tip
                    addWedge(wBladeMid, wBladeTip, 0.065 * itemScale, 0.01 * itemScale, 0.01 * itemScale, bladeColor);
                } else {
                    let itemColor = [0.55, 0.38, 0.22];
                    const name = (heldItem && heldItem.name) ? heldItem.name : "";
                    if (name.includes("STONE") || name.includes("ROCK") || name.includes("ORE")) {
                        itemColor = [0.5, 0.5, 0.5];
                    } else if (name.includes("GOLD")) {
                        itemColor = [0.9, 0.8, 0.2];
                    } else if (name.includes("ROBOT")) {
                        itemColor = [0.3, 0.6, 0.9];
                    } else if (name.includes("CAMPFIRE")) {
                        itemColor = [0.8, 0.3, 0.1];
                    }
                    buildTaperedSegment(wHandleP1, wBladeBase, 0.035 * itemScale, 0.035 * itemScale, 5, itemColor, rawV, rawC, rawI);
                }
            }
            
            const flatEquip = makeFlatShadedGeometry(rawV, rawC, rawI);
            equipIndicesLength = flatEquip.indices.length;

            if (!equipVertexBuffer) equipVertexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, equipVertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flatEquip.vertices), gl.DYNAMIC_DRAW);

            if (!equipColorBuffer) equipColorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, equipColorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flatEquip.colors), gl.DYNAMIC_DRAW);

            if (!equipNormalBuffer) equipNormalBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, equipNormalBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flatEquip.normals), gl.DYNAMIC_DRAW);

            if (!equipIndexBuffer) equipIndexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, equipIndexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, supportUint32 && equipIndicesLength > 65535 ? new Uint32Array(flatEquip.indices) : new Uint16Array(flatEquip.indices), gl.DYNAMIC_DRAW);
        } else {
            equipIndicesLength = 0;
        }

        const merged = mergeMeshes(meshesToMerge);
        const localMerged = mergeMeshes(localMeshesToMerge);
        charIndicesLength = merged.indices.length;
        charRawVertices = merged.vertices;

        if (!charVertexBuffer) charVertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, charVertexBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(merged.vertices),
          gl.DYNAMIC_DRAW,
        );

        if (!charLocalVertexBuffer) charLocalVertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, charLocalVertexBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(localMerged.vertices),
          gl.DYNAMIC_DRAW,
        );

        if (!charNormalBuffer) charNormalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, charNormalBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(merged.normals),
          gl.DYNAMIC_DRAW,
        );

        if (!charColorBuffer) charColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, charColorBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(merged.colors),
          gl.DYNAMIC_DRAW,
        );

        if (!charIndexBuffer) charIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, charIndexBuffer);
        if (supportUint32 && charIndicesLength > 65535) {
          gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            new Uint32Array(merged.indices),
            gl.DYNAMIC_DRAW,
          );
        } else {
          gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            new Uint16Array(merged.indices),
            gl.DYNAMIC_DRAW,
          );
        }
      }

      function getCharacterMatrix() {
        if (ragdollEnabled && ragdollInitialized) {
          return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        }
        const sinTheta = Math.sin(charTheta);
        const cosTheta = Math.cos(charTheta);
        const sinPhi = Math.sin(charPhi);
        const cosPhi = Math.cos(charPhi);

        const nx = sinTheta * cosPhi;
        const ny = cosTheta;
        const nz = sinTheta * sinPhi;

        const height = getVisualHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
        const charScale = playerScale;

        let feetRadiusBefore = (typeof playerCenterRadius !== 'undefined' && playerCenterRadius !== null) ? (playerCenterRadius - 0.46 * charScale) : (RADIUS + height * HEIGHT_SCALE);
        const caveData = typeof getTerrainSurfaceAndCeiling === "function"
          ? getTerrainSurfaceAndCeiling(nx, ny, nz, feetRadiusBefore)
          : { ground: RADIUS + height * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };
        let terrainRadius = caveData.ground;
        const waterRadius = RADIUS + waterLevel * 0.15;
        let wRadiusLocal = typeof getWaterRadiusAt === "function"
          ? getWaterRadiusAt(nx * feetRadiusBefore, ny * feetRadiusBefore, nz * feetRadiusBefore)
          : waterRadius;
        
        if (caveData.insideTunnel && wRadiusLocal === 0) {
            wRadiusLocal = waterRadius;
        }

        if (typeof getWaterRadiusAt !== "function") {
          const latCharForSwim = Math.round((charTheta / Math.PI) * Math.min(currentGridSize, 200));
          let phiCharForSwim = charPhi;
          if (phiCharForSwim < 0) phiCharForSwim += Math.PI * 2;
          const longCharForSwim = Math.round((phiCharForSwim / (Math.PI * 2)) * Math.min(currentGridSize, 200));
          const gridIdxCharSwim = latCharForSwim * (Math.min(currentGridSize, 200) + 1) + longCharForSwim;
          if (typeof waterMask !== 'undefined' && waterMask && waterMask[gridIdxCharSwim] === 0) {
             if (!caveData.insideTunnel) {
                 wRadiusLocal = 0;
             }
          }
        }

        let swimFactor = 0.0;
        
        let currentFeetRadius = terrainRadius;

        if (false) { // Disabled: allow water in caves
            swimFactor = 0.0;
        } else if (activeRidingBoat) {
            swimFactor = 0.0;
        } else if (waterEnabled && currentFeetRadius < wRadiusLocal) {
          const depth = wRadiusLocal - currentFeetRadius;
          const swimThreshold = 0.48 * charScale;
          if (depth > swimThreshold) {
            swimFactor = Math.min(
              1.0,
              (depth - swimThreshold) / (0.15 * charScale),
            );
          }
        }

        const standOffset = ragdollEnabled
          ? 0.08 * charScale
          : 0.46 * charScale;
        let groundRadius = terrainRadius + standOffset;
        if (playerCenterRadius !== null) {
            groundRadius = playerCenterRadius;
        } else {
          if (activeRidingBoat) {
            let boatRad = activeRidingBoat.position ? Math.sqrt(activeRidingBoat.position[0]**2 + activeRidingBoat.position[1]**2 + activeRidingBoat.position[2]**2) : 0;
            if (boatRad > 1.0) {
              groundRadius = boatRad + 0.46 * charScale;
            } else {
              let baseRadius = (waterEnabled && terrainRadius < waterRadius) ? waterRadius : terrainRadius;
              if (waterEnabled && terrainRadius < waterRadius) {
                const wave = getWaterWave(nx * waterRadius, ny * waterRadius, nz * waterRadius, waterAnimTime, waveStrength);
                baseRadius += wave;
              }
              // Since the boat sits at baseRadius - 0.04, the player stands at baseRadius - 0.04 + 0.46 * charScale
              groundRadius = baseRadius - 0.04 + 0.46 * charScale;
            }
          } else if (typeof activeRidingMech !== "undefined" && activeRidingMech) {
            groundRadius = terrainRadius + (typeof window.mechSeatOffset !== "undefined" ? window.mechSeatOffset : 0.71);
          } else if (swimFactor > 0.0) {

            const targetSwimRadius =
              waterRadius + (-0.22 + swimMovementFactor * 0.27) * charScale;
            const subSwimRadius = targetSwimRadius - playerDiveDepth;
            groundRadius =
              groundRadius * (1.0 - swimFactor) + subSwimRadius * swimFactor;

            // Enforce surface limits only when not inside a cave tunnel
            if (typeof caveData !== 'undefined' && caveData && !caveData.insideTunnel) {
              // No ceiling checks needed on the surface
            }
  
            // Add gentle water bobbing (only if not diving deeply)
            const bobSpeed = isWalking ? 4.0 : 2.0;
            const bobAmp = isWalking ? 0.02 : 0.04;
            const bobFactor = Math.max(
              0,
              1.0 - playerDiveDepth / (0.1 * charScale),
            );
            const bobbing =
              Math.sin(waterTime * bobSpeed) * bobAmp * charScale * bobFactor;
            groundRadius += bobbing;
          }
        }

        let px = groundRadius * nx;
        let py = groundRadius * ny;
        let pz = groundRadius * nz;

        const N = [nx, ny, nz];

        const East = [-sinPhi, 0, cosPhi];
        const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];

        const cosH = Math.cos(charHeading);
        const sinH = Math.sin(charHeading);

        const R = [
          East[0] * cosH - North[0] * sinH,
          East[1] * cosH - North[1] * sinH,
          East[2] * cosH - North[2] * sinH,
        ];
        const F = [
          North[0] * cosH + East[0] * sinH,
          North[1] * cosH + East[1] * sinH,
          North[2] * cosH + East[2] * sinH,
        ];

        let finalN = [N[0], N[1], N[2]];
        let finalF = [F[0], F[1], F[2]];
        let finalR = [R[0], R[1], R[2]];

        if (ragdollEnabled) {
          // Lay flat on back: Rotate -90 degrees around the right axis R
          // So local Y (up) becomes -F (facing backward along ground), and local Z (forward/chest) becomes N (pointing away from planet)
          finalN = [-F[0], -F[1], -F[2]];
          finalF = [N[0], N[1], N[2]];

          // Add a slight roll/twist to make the ragdoll look beautifully imperfect
          const angleRoll = 0.35;
          const cosRoll = Math.cos(angleRoll);
          const sinRoll = Math.sin(angleRoll);

          // rotate finalR and finalF around finalN:
          const r0 = finalR[0] * cosRoll - finalF[0] * sinRoll;
          const r1 = finalR[1] * cosRoll - finalF[1] * sinRoll;
          const r2 = finalR[2] * cosRoll - finalF[2] * sinRoll;

          const f0 = finalR[0] * sinRoll + finalF[0] * cosRoll;
          const f1 = finalR[1] * sinRoll + finalF[1] * cosRoll;
          const f2 = finalR[2] * sinRoll + finalF[2] * cosRoll;

          finalR = [r0, r1, r2];
          finalF = [f0, f1, f2];
        } else if (activeRidingBoat && activeRidingBoat.normal && activeRidingBoat.F && activeRidingBoat.R) {
          finalN = [activeRidingBoat.normal[0], activeRidingBoat.normal[1], activeRidingBoat.normal[2]];
          finalF = [activeRidingBoat.F[0], activeRidingBoat.F[1], activeRidingBoat.F[2]];
          finalR = [activeRidingBoat.R[0], activeRidingBoat.R[1], activeRidingBoat.R[2]];
          if (activeRidingBoat.position) {
            px = activeRidingBoat.position[0] + finalN[0] * 0.46 * charScale;
            py = activeRidingBoat.position[1] + finalN[1] * 0.46 * charScale;
            pz = activeRidingBoat.position[2] + finalN[2] * 0.46 * charScale;
          }
        } else if (swimFactor > 0.0) {
          // Sinks neck-deep when stationary, tilts forward smoothly when swimming
          let tiltAngle =
            swimFactor *
            (Math.PI * 0.03 + swimMovementFactor * (Math.PI * 0.39));

          // Add additional pitch/tilt based on diving depth change rate or camera pitch when moving (only when submerged)
          if (
            isWalking &&
            lastMoveForwardInput !== 0 &&
            playerDiveDepth > 0.05 * charScale
          ) {
            // rotationX is positive when looking down, so moving forward tilts nose-down (positive tilt)
            // and moving backward tilts nose-up (negative tilt)
            tiltAngle += lastMoveForwardInput * rotationX * 0.6 * swimFactor;
          }

          const cosT = Math.cos(tiltAngle);
          const sinT = Math.sin(tiltAngle);

          finalN = [
            N[0] * cosT + F[0] * sinT,
            N[1] * cosT + F[1] * sinT,
            N[2] * cosT + F[2] * sinT,
          ];
          finalF = [
            -N[0] * sinT + F[0] * cosT,
            -N[1] * sinT + F[1] * cosT,
            -N[2] * sinT + F[2] * cosT,
          ];
        }

        const rx = [
          finalR[0] * charScale,
          finalR[1] * charScale,
          finalR[2] * charScale,
        ];
        const ry = [
          finalN[0] * charScale,
          finalN[1] * charScale,
          finalN[2] * charScale,
        ];
        const rz = [
          finalF[0] * charScale,
          finalF[1] * charScale,
          finalF[2] * charScale,
        ];

        return [
          rx[0],
          rx[1],
          rx[2],
          0,
          ry[0],
          ry[1],
          ry[2],
          0,
          rz[0],
          rz[1],
          rz[2],
          0,
          px,
          py,
          pz,
          1,
        ];
      }

      let reusableWaterFloat32Array = null;


      // Hair style cycle handler
      window.cyclePlayerHair = function() {
        const numStyles = window.NUM_HAIR_STYLES || 8;
        if (window.playerHairStyle === undefined) {
          window.playerHairStyle = 0;
        } else {
          window.playerHairStyle = (window.playerHairStyle + 1) % numStyles;
        }
        const colors = window.ANIME_HAIR_COLORS || [[0.85, 0.90, 0.96]];
        window.playerHairColor = colors[window.playerHairStyle % colors.length];
        const name = window.HAIR_STYLE_NAMES ? window.HAIR_STYLE_NAMES[window.playerHairStyle] : `Style #${window.playerHairStyle + 1}`;
        if (typeof showNotice === "function") {
          showNotice(`💇‍♀️ เปลี่ยนทรงผมแล้ว: ${name}`);
        }
      };

      // ============================================
      // ระบบควบคุมตัวละครและกล้องติดตาม
      // ============================================
      const keysPressed = {};
      window.clearKeysPressed = () => { for (let k in keysPressed) keysPressed[k] = false; };
      window.addEventListener("keydown", (e) => {
        initAudio();
        if (e.code === "KeyH") {
          window.cyclePlayerHair();
        }
        if (e.code === currentKeyBindings.demolish || e.code === "CapsLock") {
          isDemolishModeEnabled = !isDemolishModeEnabled;
          if (isDemolishModeEnabled) {
            isTerrainModModeEnabled = false;
            cancelFloorPlacement();
          }
          showNotice("โหมดรื้อถอน: " + (isDemolishModeEnabled ? "เปิด" : "ปิด") + " / Demolish Mode: " + (isDemolishModeEnabled ? "ON" : "OFF"));
          updateDemolishBanner();
          updateTerrainModBanner();
        }
        // Terrain modification mode (V key) has been disabled.
        /*
        if (e.code === currentKeyBindings.terrainMod || e.code === "KeyV") {
          isTerrainModModeEnabled = !isTerrainModModeEnabled;
          if (isTerrainModModeEnabled) {
            isDemolishModeEnabled = false;
            cancelFloorPlacement();
          }
          showNotice("โหมดขุด/ถมดิน: " + (isTerrainModModeEnabled ? "เปิด" : "ปิด") + " / Terrain Mod Mode: " + (isTerrainModModeEnabled ? "ON" : "OFF"));
          updateDemolishBanner();
          updateTerrainModBanner();
        }
        */
        if (e.code === (typeof currentKeyBindings !== "undefined" && currentKeyBindings.rotate ? currentKeyBindings.rotate : "KeyQ") || e.code === "KeyQ" || e.key === "q" || e.key === "Q") {
          if (isPlacingFloor) {
            placementRotationAngle = (placementRotationAngle + Math.PI / 2) % (Math.PI * 2);
            if (typeof window !== "undefined") {
              window.placementRotationAngle = placementRotationAngle;
            }
            if (floorPreviewCollectible) {
              floorPreviewCollectible.angle = placementRotationAngle;
            }
            if (typeof playPlaceSound === "function") {
              playPlaceSound();
            }
            showNotice("หมุนหลังคา/โมเดลแล้ว (Rotated) [Q]");
            pendingCollectibleRefresh = true;
            if (typeof refreshCollectiblesVBO === "function") {
              refreshCollectiblesVBO('preview');
            }
          }
        }
        if (e.key === "Alt" || e.code === "AltLeft" || e.code === "AltRight" || (typeof currentKeyBindings !== "undefined" && e.code === currentKeyBindings.toggleMouse)) {
          e.preventDefault();
          if (!e.repeat) {
            if (typeof window.toggleVirtualCursorVisibility === "function") {
              window.toggleVirtualCursorVisibility();
            }
          }
        }
        if (e.code === currentKeyBindings.interact) {
          if (activeInteractNPC) {
            if (activeInteractNPC.type === 'meganeura') {
              const itemsFound = [{ name: "MEGANEURA", count: 1, icon: "🦟", seed: activeInteractNPC.seed }];
              if (typeof addItemToInventory === "function") {
                const success = addItemToInventory(itemsFound[0]);
                if (success) {
                  showNotice("เก็บแมลงแล้ว! (Bug picked up)");
                  if (typeof playCollectSound === "function") playCollectSound();
                  
                  // Force respawn it immediately
                  activeInteractNPC.theta = Math.random() * Math.PI;
                  activeInteractNPC.phi = Math.random() * Math.PI * 2;
                  const seed = globalSeed || 1234.5;
                  const newHeight = getVisualHeightOnSphere(activeInteractNPC.theta, activeInteractNPC.phi, seed);
                  activeInteractNPC.r = RADIUS + newHeight * HEIGHT_SCALE + 0.3;
                  activeInteractNPC.ragdollEnabled = false;
                  activeInteractNPC.ragdollInitialized = false;
                  activeInteractNPC.ragdollPos = null;
                  activeInteractNPC.ragdollVel = null;
                  activeInteractNPC.ragdollAsleep = false;
                  activeInteractNPC.ragdollSleepFrames = 0;
                  activeInteractNPC.ragdollAngle = 0;
                  activeInteractNPC.ragdollAngularSpeed = 0;
                  activeInteractNPC.hp = 3;
                  activeInteractNPC.maxHp = 3;

                  const sinT = Math.sin(activeInteractNPC.theta);
                  const cosT = Math.cos(activeInteractNPC.theta);
                  const sinP = Math.sin(activeInteractNPC.phi);
                  const cosP = Math.cos(activeInteractNPC.phi);
                  activeInteractNPC.position = [sinT * cosP * activeInteractNPC.r, cosT * activeInteractNPC.r, sinT * sinP * activeInteractNPC.r];

                  // Remove arrows attached to this NPC
                  for (let coll of collectibles) {
                    if (coll.attachedToNPC === activeInteractNPC) {
                      coll.attachedToNPC = null;
                      coll.active = false;
                    }
                  }
                  window.pendingCollectibleRefresh = true;
                  window.pendingDynamicCollectibleRefresh = true;
                } else {
                  showNotice("กระเป๋าเต็ม! (Inventory full)");
                }
              }
            } else if (activeInteractNPC.type === 'isopod') {
              const itemsFound = [{ name: "ISOPOD", count: 1, icon: "🦐", seed: activeInteractNPC.seed }];
              if (typeof addItemToInventory === "function") {
                const success = addItemToInventory(itemsFound[0]);
                if (success) {
                  showNotice("เก็บไอโซพอดแล้ว! (Isopod picked up)");
                  if (typeof playCollectSound === "function") playCollectSound();
                  
                  // Force respawn it immediately
                  activeInteractNPC.theta = Math.random() * Math.PI;
                  activeInteractNPC.phi = Math.random() * Math.PI * 2;
                  const seed = globalSeed || 1234.5;
                  const newHeight = getVisualHeightOnSphere(activeInteractNPC.theta, activeInteractNPC.phi, seed);
                  const wRadius = RADIUS + waterLevel * 0.15;
                  const gRadius = RADIUS + newHeight * HEIGHT_SCALE;
                  activeInteractNPC.r = Math.max(gRadius, wRadius - 0.02) + 0.02;
                  activeInteractNPC.ragdollEnabled = false;
                  activeInteractNPC.ragdollInitialized = false;
                  activeInteractNPC.ragdollPos = null;
                  activeInteractNPC.ragdollVel = null;
                  activeInteractNPC.ragdollAsleep = false;
                  activeInteractNPC.ragdollSleepFrames = 0;
                  activeInteractNPC.ragdollAngle = 0;
                  activeInteractNPC.ragdollAngularSpeed = 0;
                  activeInteractNPC.hp = 2;
                  activeInteractNPC.maxHp = 2;

                  const sinT = Math.sin(activeInteractNPC.theta);
                  const cosT = Math.cos(activeInteractNPC.theta);
                  const sinP = Math.sin(activeInteractNPC.phi);
                  const cosP = Math.cos(activeInteractNPC.phi);
                  activeInteractNPC.position = [sinT * cosP * activeInteractNPC.r, cosT * activeInteractNPC.r, sinT * sinP * activeInteractNPC.r];

                  // Remove arrows attached to this NPC
                  for (let coll of collectibles) {
                    if (coll.attachedToNPC === activeInteractNPC) {
                      coll.attachedToNPC = null;
                      coll.active = false;
                    }
                  }
                  window.pendingCollectibleRefresh = true;
                  window.pendingDynamicCollectibleRefresh = true;
                } else {
                  showNotice("กระเป๋าเต็ม! (Inventory full)");
                }
              }
            } else if (activeInteractNPC.type === 'human') {
              if (typeof showNpcDialogue === "function") {
                showNpcDialogue(activeInteractNPC);
              }
            } else {
              activeInteractNPC.hp = 0;
              activeInteractNPC.ragdollEnabled = true;
              if (typeof playSplashSound === "function") {
                playSplashSound(0.8);
              }
            }
            const npcPrompt = document.getElementById("npcKillPrompt");
            if (npcPrompt) npcPrompt.style.display = "none";
            activeInteractNPC = null;
          } else {
            // 1. Action Reach check for Axe and Pickaxe
            let bestLineItemT = Infinity;
            let bestLineItem = null;
            for (let item of collectibles) {
              if (item.active && (item.type === "axe" || item.type === "pickaxe")) {
                const reachInfo = isTargetWithinReach(item.position, Math.max(actionReachDistance, 0.15 * (playerScale / 0.1)));
                if (reachInfo.valid) {
                  if (reachInfo.t < bestLineItemT) {
                    bestLineItemT = reachInfo.t;
                    bestLineItem = item;
                  }
                }
              }
            }

            let found = false;
            let bestDistSq = Infinity;
            let bestItem = null;

            if (bestLineItem) {
              bestItem = bestLineItem;
            } else {
              // 2. Action Reach check for other collectibles
              for (let item of collectibles) {
                if (!item.active) continue;
                if (item.type === "planet_core" || item.type === "wood_stairs" || item.type === "wood_floor" || item.type === "thin_wood_floor" || item.type === "stone_floor" || item.type === "campfire" || item.type === "wood_boat" || item.type === "wood_wheel" || item.type === "wood_wall" || item.type === "wood_window" || item.type === "wood_door" || item.type === "wood_chest" || item.type === "axe" || item.type === "pickaxe" || item.type.startsWith("robot_")) continue;
                
                const reachInfo = isTargetWithinReach(item.position, actionReachDistance);
                if (reachInfo.valid) {
                  const distSq = reachInfo.perpSq;
                  if (distSq < bestDistSq) {
                    bestDistSq = distSq;
                    bestItem = item;
                  }
                }
              }
            }

            if (bestItem) {
              let item = bestItem;
              let icon = "🌿";
              let label = "BRANCH";
              if (item.type === "rock") { icon = "🪨"; label = "ROCK"; }
              else if (item.type === "big_rock") { icon = "🪨"; label = "BIG_ROCK"; }
              else if (item.type === "iron_ore") { icon = "🟥"; label = "IRON_ORE"; }
              else if (item.type === "gold_ore") { icon = "🪙"; label = "GOLD_ORE"; }
              else if (item.type === "log") { icon = "🪵"; label = "LOG"; }
              else if (item.type === "axe") { icon = "🪓"; label = "AXE"; }
              else if (item.type === "pickaxe") { icon = "⛏️"; label = "PICKAXE"; }
              else if (item.type === "plank" || item.type === "wood_floor" || item.type === "thin_wood_floor") { icon = "🪵"; label = item.type === "thin_wood_floor" ? "THIN_WOOD_FLOOR" : "WOOD_FLOOR"; }
              else if (item.type === "stone_floor") { icon = "🪨"; label = "STONE_FLOOR"; }
              else if (item.type === "campfire") { icon = "🔥"; label = "CAMPFIRE"; }
              else if (item.type === "wood_boat") { icon = "🛶"; label = "WOOD_BOAT"; }
              else if (item.type === "robot_stand") { icon = "🏗️"; label = "ROBOT_STAND"; }
              else if (item.type === "robot_cockpit") { icon = "🤖"; label = "ROBOT_COCKPIT"; }
              else if (item.type === "robot_left_arm") { icon = "🦾"; label = "ROBOT_LEFT_ARM"; }
              else if (item.type === "robot_right_arm") { icon = "🦾"; label = "ROBOT_RIGHT_ARM"; }
              else if (item.type === "robot_left_leg") { icon = "🦿"; label = "ROBOT_LEFT_LEG"; }
              else if (item.type === "robot_right_leg") { icon = "🦿"; label = "ROBOT_RIGHT_LEG"; }
              else if (item.type === "wood_wheel") { icon = "🛞"; label = "WOOD_WHEEL"; }
              else if (item.type === "meganeura_item") { icon = "🦟"; label = "MEGANEURA"; }
              else if (item.type === "isopod_item") { icon = "🦐"; label = "ISOPOD"; }
              
              const itemData = {
                icon: icon,
                label: label,
                name: label
              };

              if (addItemToInventory(itemData)) {
                item.active = false;
                collectedCount[item.type] = (collectedCount[item.type] || 0) + 1;
                if (item.isDynamic) {
                  window.pendingDynamicCollectibleRefresh = true;
                } else {
                  pendingCollectibleRefresh = true;
                }
                found = true;
              }
            }
          }
        }
        keysPressed[e.code] = true;
      });
      window.addEventListener("keyup", (e) => {
        if (e.key === "Alt" || e.code === "AltLeft" || e.code === "AltRight" || (typeof currentKeyBindings !== "undefined" && e.code === currentKeyBindings.toggleMouse)) {
          e.preventDefault();
        }
        keysPressed[e.code] = false;
      });


      // ============================================
      // ระบบป้องการชนของกล้อง (Camera Collision Avoidance)
      // ============================================
      let currentSmoothDistance = 2.0;

      const cameraCollisionToggle = document.getElementById(
        "cameraCollisionToggle",
      );
      if (cameraCollisionToggle) {
        cameraCollisionToggle?.addEventListener("click", () => {
          cameraCollisionEnabled = !cameraCollisionEnabled;
          if (cameraCollisionEnabled) {
            cameraCollisionToggle.textContent = "🛡️ ระบบกันกล้องชนวัตถุ: เปิด";
            cameraCollisionToggle.classList.add("active");
          } else {
            cameraCollisionToggle.textContent = "🛡️ ระบบกันกล้องชนวัตถุ: ปิด";
            cameraCollisionToggle.classList.remove("active");
          }
        });
      }

      const zoomLimitToggle = document.getElementById("zoomLimitToggle");
      if (zoomLimitToggle) {
        zoomLimitToggle?.addEventListener("click", () => {
          zoomLimitEnabled = !zoomLimitEnabled;
          if (zoomLimitEnabled) {
            zoomLimitToggle.textContent = "🔍 จำกัดระยะซูมออก: เปิด";
            zoomLimitToggle.classList.add("active");
            zoom = Math.min(7.5, zoom);
          } else {
            zoomLimitToggle.textContent = "🔍 จำกัดระยะซูมออก: ปิด";
            zoomLimitToggle.classList.remove("active");
          }
        });
      }

      const ragdollToggle = document.getElementById("ragdollToggle");
      if (ragdollToggle) {
        ragdollToggle?.addEventListener("click", () => {
          setRagdoll(!ragdollEnabled);
        });
      }

      const npcSummonBtn = document.getElementById("npcSummonBtn");
      if (npcSummonBtn) {
        npcSummonBtn?.addEventListener("click", () => {
          if (amphibians && amphibians.length > 0) {
            // Spread amphibians around the player
            for (let i = 0; i < amphibians.length; i++) {
              let a = amphibians[i];

              // Spawn close to the player
              const distance = 0.05 + Math.random() * 0.02; // Close distance
              const angle = Math.random() * Math.PI * 2;
              const offsetTheta = distance * Math.cos(angle);
              const offsetPhi =
                (distance * Math.sin(angle)) /
                Math.max(0.1, Math.sin(charTheta));

              a.theta = charTheta + offsetTheta;
              a.phi = charPhi + offsetPhi;
              a.heading = Math.random() * Math.PI * 2;

              const height = getVisualHeightOnSphere(a.theta, a.phi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
              const gRadius = RADIUS + height * HEIGHT_SCALE;
              const sinT = Math.sin(a.theta);
              const cosT = Math.cos(a.theta);
              const sinP = Math.sin(a.phi);
              const cosP = Math.cos(a.phi);
              const ax = sinT * cosP * gRadius;
              const ay = cosT * gRadius;
              const az = sinT * sinP * gRadius;
              let wRadius = getWaterRadiusAt(ax, ay, az, false);

              // Set r properly based on where they land
              if (gRadius > wRadius - 0.02) {
                a.r = gRadius + 0.05; // Drop on land
                a.isSwimming = false;
              } else {
                a.r = wRadius - 0.05; // Drop in water
                a.isSwimming = true;
              }
            }

            // Show some visual feedback or alert? No alert needed.
          }
        });
      }

      const npcKillPromptBtn = document.getElementById("npcKillPrompt");
      if (npcKillPromptBtn) {
        npcKillPromptBtn?.addEventListener("click", () => {
          if (activeInteractNPC) {
            if (activeInteractNPC.type === 'meganeura') {
              const itemsFound = [{ name: "MEGANEURA", count: 1, icon: "🦟", seed: activeInteractNPC.seed }];
              if (typeof addItemToInventory === "function") {
                const success = addItemToInventory(itemsFound[0]);
                if (success) {
                  showNotice("เก็บแมลงแล้ว! (Bug picked up)");
                  if (typeof playCollectSound === "function") playCollectSound();
                  
                  // Force respawn it immediately
                  activeInteractNPC.theta = Math.random() * Math.PI;
                  activeInteractNPC.phi = Math.random() * Math.PI * 2;
                  const seed = globalSeed || 1234.5;
                  const newHeight = getVisualHeightOnSphere(activeInteractNPC.theta, activeInteractNPC.phi, seed);
                  activeInteractNPC.r = RADIUS + newHeight * HEIGHT_SCALE + 0.3;
                  activeInteractNPC.ragdollEnabled = false;
                  activeInteractNPC.ragdollInitialized = false;
                  activeInteractNPC.ragdollPos = null;
                  activeInteractNPC.ragdollVel = null;
                  activeInteractNPC.ragdollAsleep = false;
                  activeInteractNPC.ragdollSleepFrames = 0;
                  activeInteractNPC.ragdollAngle = 0;
                  activeInteractNPC.ragdollAngularSpeed = 0;
                  activeInteractNPC.hp = 3;
                  activeInteractNPC.maxHp = 3;

                  const sinT = Math.sin(activeInteractNPC.theta);
                  const cosT = Math.cos(activeInteractNPC.theta);
                  const sinP = Math.sin(activeInteractNPC.phi);
                  const cosP = Math.cos(activeInteractNPC.phi);
                  activeInteractNPC.position = [sinT * cosP * activeInteractNPC.r, cosT * activeInteractNPC.r, sinT * sinP * activeInteractNPC.r];

                  // Remove arrows attached to this NPC
                  for (let coll of collectibles) {
                    if (coll.attachedToNPC === activeInteractNPC) {
                      coll.attachedToNPC = null;
                      coll.active = false;
                    }
                  }
                  window.pendingCollectibleRefresh = true;
                  window.pendingDynamicCollectibleRefresh = true;
                } else {
                  showNotice("กระเป๋าเต็ม! (Inventory full)");
                }
              }
            } else if (activeInteractNPC.type === 'isopod') {
              const itemsFound = [{ name: "ISOPOD", count: 1, icon: "🦐", seed: activeInteractNPC.seed }];
              if (typeof addItemToInventory === "function") {
                const success = addItemToInventory(itemsFound[0]);
                if (success) {
                  showNotice("เก็บไอโซพอดแล้ว! (Isopod picked up)");
                  if (typeof playCollectSound === "function") playCollectSound();
                  
                  // Force respawn it immediately
                  activeInteractNPC.theta = Math.random() * Math.PI;
                  activeInteractNPC.phi = Math.random() * Math.PI * 2;
                  const seed = globalSeed || 1234.5;
                  const newHeight = getVisualHeightOnSphere(activeInteractNPC.theta, activeInteractNPC.phi, seed);
                  const wRadius = RADIUS + waterLevel * 0.15;
                  const gRadius = RADIUS + newHeight * HEIGHT_SCALE;
                  activeInteractNPC.r = Math.max(gRadius, wRadius - 0.02) + 0.02;
                  activeInteractNPC.ragdollEnabled = false;
                  activeInteractNPC.ragdollInitialized = false;
                  activeInteractNPC.ragdollPos = null;
                  activeInteractNPC.ragdollVel = null;
                  activeInteractNPC.ragdollAsleep = false;
                  activeInteractNPC.ragdollSleepFrames = 0;
                  activeInteractNPC.ragdollAngle = 0;
                  activeInteractNPC.ragdollAngularSpeed = 0;
                  activeInteractNPC.hp = 2;
                  activeInteractNPC.maxHp = 2;

                  const sinT = Math.sin(activeInteractNPC.theta);
                  const cosT = Math.cos(activeInteractNPC.theta);
                  const sinP = Math.sin(activeInteractNPC.phi);
                  const cosP = Math.cos(activeInteractNPC.phi);
                  activeInteractNPC.position = [sinT * cosP * activeInteractNPC.r, cosT * activeInteractNPC.r, sinT * sinP * activeInteractNPC.r];

                  // Remove arrows attached to this NPC
                  for (let coll of collectibles) {
                    if (coll.attachedToNPC === activeInteractNPC) {
                      coll.attachedToNPC = null;
                      coll.active = false;
                    }
                  }
                  window.pendingCollectibleRefresh = true;
                  window.pendingDynamicCollectibleRefresh = true;
                } else {
                  showNotice("กระเป๋าเต็ม! (Inventory full)");
                }
              }
            } else if (activeInteractNPC.type === 'human') {
              if (typeof showNpcDialogue === "function") {
                showNpcDialogue(activeInteractNPC);
              }
            } else {
              activeInteractNPC.hp = 0;
              activeInteractNPC.ragdollEnabled = true;
              if (typeof playSplashSound === "function") {
                playSplashSound(0.8);
              }
            }
            npcKillPromptBtn.style.display = "none";
            activeInteractNPC = null;
          }
        });
      }

      function checkCameraCollision(p, playerHeadPos, waterRadius, prefiltered = null) {
        return CollisionCore.checkCameraCollision(p, playerHeadPos, waterRadius, prefiltered);
        /*
        const distToCenter = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
        if (distToCenter < 0.001) return true;

        // 1. ชนพื้นผิวของดาว (Planet Terrain) หรือฝาถ้ำ/พื้นถ้ำ (Cave Floor/Ceiling)
        const ux = p[0] / distToCenter;
        const uy = p[1] / distToCenter;
        const uz = p[2] / distToCenter;
        const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
        const phi = Math.atan2(uz, ux);
        const h = getVisualHeightOnSphere(theta, phi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
        const terrainRadius = RADIUS + h * HEIGHT_SCALE;

        const playerFeetRadius = (playerCenterRadius !== null) ? (playerCenterRadius - 0.46 * playerScale) : terrainRadius;
        const camCaveData = { insideTunnel: false };

        if (camCaveData.insideTunnel) {
          // ในถ้ำ: ชนพื้นถ้ำ หรือ ชนเพดานถ้ำ (มีระยะเผื่อปลอดภัย)
          const buffer = 0.08;
          if (distToCenter < camCaveData.ground + buffer) {
            return true;
          }
          if (camCaveData.ceiling !== Infinity && distToCenter > camCaveData.ceiling - buffer) {
            return true;
          }
        } else {
          // นอกถ้ำ: ชนพื้นผิวปกติ
          if (distToCenter < terrainRadius + 0.08) {
            return true;
          }
        }

        // 2. ชนผิวน้ำ (Water Surface)
        if (waterEnabled) {
          const playerHeadDist = Math.sqrt(
            playerHeadPos[0] * playerHeadPos[0] +
              playerHeadPos[1] * playerHeadPos[1] +
              playerHeadPos[2] * playerHeadPos[2],
          );
          if (playerHeadDist > waterRadius) {
            // หากตัวผู้เล่นอยู่เหนือน้ำ ไม่ให้กล้องตกอยู่ใต้น้ำ
            if (distToCenter < waterRadius + 0.04) {
              return true;
            }
          } else {
            // หากตัวผู้เล่นอยู่ใต้น้ำ ไม่ให้กล้องทะลุขึ้นเหนือน้ำ
            if (distToCenter > waterRadius - 0.04) {
              return true;
            }
          }
        }

        // 3. ชนวัตถุอื่นๆ (Obstacles: nature & cubes)
        const checkObstacleCollisions = (obstacles, extraCushion, mask) => {
          const maxDistSq = maxColliderDistance * maxColliderDistance;
          for (let obs of obstacles) {
            if (mask !== undefined && obs.layer !== undefined && !(mask & obs.layer)) continue;
            if (!obs.position) continue;
            
            const dx = p[0] - obs.position[0];
            const dy = p[1] - obs.position[1];
            const dz = p[2] - obs.position[2];
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq > maxDistSq) continue;

            if (obs.meshStart !== undefined && obs.meshEnd !== undefined) {
              const checkDist = obs.radius + extraCushion;
              if (distSq > checkDist * checkDist) continue;
              
              const collisionEnd = obs.collisionMeshEnd !== undefined ? obs.collisionMeshEnd : obs.meshEnd;
              const count = collisionEnd - obs.meshStart;
              let hit = false;

              for (let j = 0; j < count; j += 3) {
                const vIdx = obs.meshStart + j;
                const a = [natureRawVertices[vIdx*3], natureRawVertices[vIdx*3+1], natureRawVertices[vIdx*3+2]];
                const b = [natureRawVertices[(vIdx+1)*3], natureRawVertices[(vIdx+1)*3+1], natureRawVertices[(vIdx+1)*3+2]];
                const c = [natureRawVertices[(vIdx+2)*3], natureRawVertices[(vIdx+2)*3+1], natureRawVertices[(vIdx+2)*3+2]];
                const closest = closestPointOnTriangle(p, a, b, c);
                const ctx = p[0] - closest[0];
                const cty = p[1] - closest[1];
                const ctz = p[2] - closest[2];
                if (ctx*ctx + cty*cty + ctz*ctz < extraCushion * extraCushion) {
                    hit = true;
                    break;
                }
              }
              if (hit) return true;
            } else if (obs.colliders && obs.colliders.length > 0) {
              for (let col of obs.colliders) {
                const cx = obs.position[0] + (col.offset[0] || 0);
                const cy = obs.position[1] + (col.offset[1] || 0);
                const cz = obs.position[2] + (col.offset[2] || 0);
                const cdx = p[0] - cx;
                const cdy = p[1] - cy;
                const cdz = p[2] - cz;
                const cdistSq = cdx * cdx + cdy * cdy + cdz * cdz;
                const colRad = col.radius + extraCushion;
                if (cdistSq < colRad * colRad) return true;
            }
          } else {
              const collisionRadius = obs.radius + extraCushion;
              if (distSq < collisionRadius * collisionRadius) {
                return true;
              }
            }
          }
          return false;
        };

        if (prefiltered) {
          if (checkObstacleCollisions(prefiltered.nature, 0.12, ~COLLISION_LAYERS.TREE)) return true;
          if (checkObstacleCollisions(prefiltered.cubes, 0.12, ~COLLISION_LAYERS.TREE)) return true;
          if (checkObstacleCollisions(prefiltered.amphibians, 0.12, ~COLLISION_LAYERS.TREE)) return true;
        } else {
          if (checkObstacleCollisions(natureObstacles, 0.12, ~COLLISION_LAYERS.TREE)) return true;
          if (checkObstacleCollisions(cubeObstacles, 0.12, ~COLLISION_LAYERS.TREE)) return true;
          if (checkObstacleCollisions(amphibians, 0.12, ~COLLISION_LAYERS.TREE)) return true;
        }

        const itemsToCheck = prefiltered ? prefiltered.collectibles : collectibles;

        // 4. ชนกำแพงไม้และพื้นไม้ที่ผู้เล่นสร้างไว้
        for (let other of itemsToCheck) {
          if (other.active && !other.isPreview) {
            if (other.type === "wood_wall" || other.type === "wood_window" || other.type === "wood_door") {
              const wallCenterRadius = Math.sqrt(
                other.position[0] * other.position[0] +
                other.position[1] * other.position[1] +
                other.position[2] * other.position[2]
              );
              
              const wallHeight = 0.25;
              
              // ตรวจสอบระยะรัศมีของตำแหน่งทดสอบของกล้อง
              const camRadius = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
              const cushionHeight = 0.05;
              
              if (camRadius > wallCenterRadius - cushionHeight && camRadius < wallCenterRadius + wallHeight + cushionHeight) {
                // คำนวณแกนหมุนของกำแพง
                const angle = other.angle || 0.0;
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                
                const wallR = [
                  other.R[0] * cosA + other.F[0] * sinA,
                  other.R[1] * cosA + other.F[1] * sinA,
                  other.R[2] * cosA + other.F[2] * sinA
                ];
                const wallF = [
                  other.F[0] * cosA - other.R[0] * sinA,
                  other.F[1] * cosA - other.R[1] * sinA,
                  other.F[2] * cosA - other.R[2] * sinA
                ];
                const wallN = other.normal || [0, 1, 0];
                
                // เวกเตอร์จากจุดศูนย์กลางกำแพงไปยังตำแหน่งกล้อง p
                const dx_vec = [
                  p[0] - other.position[0],
                  p[1] - other.position[1],
                  p[2] - other.position[2]
                ];
                
                // โปรเจกต์ลงบนแกนของกำแพง
                const dx = dx_vec[0] * wallR[0] + dx_vec[1] * wallR[1] + dx_vec[2] * wallR[2];
                const dz = dx_vec[0] * wallF[0] + dx_vec[1] * wallF[1] + dx_vec[2] * wallF[2];
                const dy = dx_vec[0] * wallN[0] + dx_vec[1] * wallN[1] + dx_vec[2] * wallN[2];
                
                const halfD = 0.025; // ครึ่งความหนากำแพง
  
                // Check if there is an active wood_door or wood_window sharing the same snapped position (or very close)
                let hasCoLocatedDoor = false;
                let hasCoLocatedWindow = false;
                if (other.type === "wood_wall") {
                  for (let d of itemsToCheck) {
                    if (d.active && (d.type === "wood_door" || d.type === "wood_window")) {
                      const ox = d.position[0] - other.position[0];
                      const oy = d.position[1] - other.position[1];
                      const oz = d.position[2] - other.position[2];
                      if (ox*ox + oy*oy + oz*oz < 0.005) {
                        if (d.type === "wood_door") hasCoLocatedDoor = true;
                        if (d.type === "wood_window") hasCoLocatedWindow = true;
                      }
                    }
                  }
                }
  
                let segments = [];
                if (hasCoLocatedDoor) {
                  segments.push({ cx: -0.1095, hw: 0.0405 });
                  segments.push({ cx: 0.1095, hw: 0.0405 });
                } else if (hasCoLocatedWindow) {
                  // Window is solid frame, leaves hole in middle
                  if (dy >= 0.075 && dy < 0.185) {
                    segments.push({ cx: -0.1175, hw: 0.0325 });
                    segments.push({ cx: 0.1175, hw: 0.0325 });
                  } else {
                    segments.push({ cx: 0.0, hw: 0.15 });
                  }
                } else {
                  segments.push({ cx: 0.0, hw: 0.15 });
                }
  
                let inCollision = false;
                for (let seg of segments) {
                  const ldx = dx - seg.cx;
                  const cushionR = seg.hw + 0.1; // รัศมีกันกล้องชนตามแนวขวาง
                  const cushionF = halfD + 0.1; // รัศมีกันกล้องชนตามความหนา
                  const cushionUp = 0.05;
  
                  if (Math.abs(ldx) < cushionR && Math.abs(dz) < cushionF && dy >= -cushionUp && dy <= wallHeight + cushionUp) {
                    inCollision = true;
                    break;
                  }
                }
  
                if (inCollision) {
                  return true;
                }
              }
            } else if (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor") {
              const dx_vec = [
                p[0] - other.position[0],
                p[1] - other.position[1],
                p[2] - other.position[2]
              ];
              
              const dx = dx_vec[0] * other.R[0] + dx_vec[1] * other.R[1] + dx_vec[2] * other.R[2];
              const dz = dx_vec[0] * other.F[0] + dx_vec[1] * other.F[1] + dx_vec[2] * other.F[2];
              const dy = dx_vec[0] * other.normal[0] + dx_vec[1] * other.normal[1] + dx_vec[2] * other.normal[2];
              
              const isStone = other.type === "stone_floor";
              const hw = isStone ? other.size * 6.0 : 0.15;
              const h = isStone ? other.size * 0.15 : (other.type === "wood_floor" ? woodFloorHeight + 0.25 * 0.12 : 0.25 * 0.04);
              
              const cushionR = hw + 0.1;
              const cushionUp = 0.1;
              const cushionDown = h/2 + cushionUp;
              
              if (Math.abs(dx) < cushionR && Math.abs(dz) < cushionR && dy >= -cushionDown && dy <= h/2 + cushionUp) {
                return true;
              }
            }
          }
        }
        */
        return false;
      }