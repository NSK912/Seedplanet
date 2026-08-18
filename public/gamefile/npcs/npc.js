// === SEEDPLANET MODULE: JS/NPC.JS ===

function initAmphibians(count, seed) { amphibians = []; if (window.DISABLE_NPCS) return;
  const _origRandom = Math.random;
  Math.random = mulberry32(seed);

  amphibians = [];
  let i = 0;
  const effectiveWaterH = (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15);
  const rRatio = Math.max(1.0, (typeof RADIUS !== 'undefined' ? RADIUS : 8.0) / 8.0);
  while (i < count) {
    const theta = Math.random() * Math.PI;
    const phi = Math.random() * Math.PI * 2;
    const height = getHeightOnSphere(theta, phi, seed);
    const isLand = (height * HEIGHT_SCALE > effectiveWaterH);

    const r =
      RADIUS +
      Math.max(height * HEIGHT_SCALE, effectiveWaterH - 0.05) +
      0.05 +
      Math.random() * 0.05;

    const rand = Math.random();
    let type = 'georgiacetus';
    if (isLand) {
      if (rand < 0.35) type = 'human';
      else if (rand < 0.70) type = 'meganeura';
      else type = 'isopod';
    } else {
      if (rand < 0.25) type = 'meganeura';
      else if (rand < 0.60) type = 'georgiacetus';
      else type = 'isopod';
    }

    if (type === 'human') {
      const groupSize = 2 + Math.floor(Math.random() * 2); // 2 or 3
      for (let j = 0; j < groupSize && i < count; j++) {
        let offsetTheta = theta;
        let offsetPhi = phi;
        if (j > 0) {
           offsetTheta += (Math.random() - 0.5) * (0.04 / rRatio);
           offsetPhi += (Math.random() - 0.5) * (0.04 / rRatio);
        }
        const oHeight = getHeightOnSphere(offsetTheta, offsetPhi, seed);
        if (oHeight * HEIGHT_SCALE <= effectiveWaterH && j > 0) continue; // Must be on land
        
        const oR = RADIUS + oHeight * HEIGHT_SCALE + 0.05 + Math.random() * 0.05;
        const maxHp = window.NpcRegistry['human'] ? window.NpcRegistry['human'].maxHp : 1;
        
        amphibians.push({
          type: 'human',
          theta: offsetTheta,
          phi: offsetPhi,
          r: oR,
          heading: Math.random() * Math.PI * 2,
          animPhase: Math.random() * Math.PI * 2,
          ragdollEnabled: false,
          ragdollInitialized: false,
          ragdollAxis: [0, 1, 0],
          ragdollAngle: 0,
          ragdollAngularSpeed: 0,
          isSwimming: false,
          seed: Math.random(),
          hp: maxHp,
          maxHp: maxHp,
        });
        i++;
      }
    } else {
      const isMeganeura = type === 'meganeura';
      const isIsopod = type === 'isopod';
      const maxHp = window.NpcRegistry[type] ? window.NpcRegistry[type].maxHp : 1;
      const spawnR = isMeganeura ? RADIUS + height * HEIGHT_SCALE + 0.3 : (isIsopod ? RADIUS + height * HEIGHT_SCALE + 0.02 : r);
      amphibians.push({
        type: type,
        theta: theta,
        phi: phi,
        r: spawnR,
        heading: Math.random() * Math.PI * 2,
        animPhase: Math.random() * Math.PI * 2,
        ragdollEnabled: false,
        ragdollInitialized: false,
        ragdollAxis: [0, 1, 0],
        ragdollAngle: 0,
        ragdollAngularSpeed: 0,
        isSwimming: (type === 'georgiacetus' || (type === 'isopod' && !isLand)),
        seed: Math.random(),
        hp: maxHp,
        maxHp: maxHp,
      });
      i++;
    }
  }

  Math.random = _origRandom;

  if (
    savedAmphibiansState &&
    savedAmphibiansState.length === amphibians.length
  ) {
    for (let i = 0; i < amphibians.length; i++) {
      if (savedAmphibiansState[i].type === amphibians[i].type || !savedAmphibiansState[i].type) {
        Object.assign(amphibians[i], savedAmphibiansState[i]);
      }
      if (amphibians[i].hp === undefined) {
        const type = amphibians[i].type;
        const maxHp = window.NpcRegistry[type] ? window.NpcRegistry[type].maxHp : 1;
        amphibians[i].hp = maxHp;
        amphibians[i].maxHp = maxHp;
      }
    }
  }
}

function updateAmphibians(deltaTime, seed) {
  if (!amphibians || amphibians.length === 0) return;

  if (playerDamageCooldown > 0) {
    playerDamageCooldown -= deltaTime;
  }

  // Calculate player position in 3D space
  const sinT_player = Math.sin(charTheta);
  const cosT_player = Math.cos(charTheta);
  const sinP_player = Math.sin(charPhi);
  const cosP_player = Math.cos(charPhi);
  const player_nx = sinT_player * cosP_player;
  const player_ny = cosT_player;
  const player_nz = sinT_player * sinP_player;
  const player_h = getHeightOnSphere(charTheta, charPhi, seed);
  const player_r = RADIUS + player_h * HEIGHT_SCALE;
  const player_pos = [player_r * player_nx, player_r * player_ny, player_r * player_nz];

  const curObjectDist = typeof objectRenderDistValue !== "undefined"
    ? objectRenderDistValue
    : (typeof window !== "undefined" && typeof window.objectRenderDistValue !== "undefined"
      ? window.objectRenderDistValue
      : (typeof renderDistValue !== "undefined" ? renderDistValue : 5.0));
  const refPos = (typeof eyePos !== "undefined" && eyePos && eyePos.length >= 3) ? eyePos : player_pos;
  const maxNpcDistSq = (curObjectDist + 0.6) * (curObjectDist + 0.6);

  let allVertices = [];
  let allColors = [];
  let allIndices = [];

  for (let c of amphibians) {
    // Remove the forced sync with the global ragdollEnabled
    // NPCs will only ragdoll if their own c.ragdollEnabled is set (which is currently never, unless we add a specific feature for it)

    // On-the-fly NPC position calculation for distance checks
    const sinT_npc = Math.sin(c.theta);
    const cosT_npc = Math.cos(c.theta);
    const sinP_npc = Math.sin(c.phi);
    const cosP_npc = Math.cos(c.phi);
    const npc_pos = [
      c.r * sinT_npc * cosP_npc,
      c.r * cosT_npc,
      c.r * sinT_npc * sinP_npc
    ];

    const effPos = (c.ragdollEnabled && c.ragdollPos) ? c.ragdollPos : npc_pos;

    // Distance check to player/camera against object render distance
    const distNpcDx = refPos[0] - effPos[0];
    const distNpcDy = refPos[1] - effPos[1];
    const distNpcDz = refPos[2] - effPos[2];
    const distNpcSq = distNpcDx * distNpcDx + distNpcDy * distNpcDy + distNpcDz * distNpcDz;

    if (distNpcSq > maxNpcDistSq) {
      if (c.ragdollEnabled && c.ragdollPos) {
        const dist = Math.sqrt(distNpcSq);
        if (dist <= 5.0) {
          continue;
        }
      } else {
        continue;
      }
    }

    if (typeof frustumCullingEnabled !== 'undefined' && frustumCullingEnabled && typeof frustumPlanes !== 'undefined' && frustumPlanes && typeof isSphereInFrustum === 'function') {
      if (!isSphereInFrustum(frustumPlanes, effPos, 2.0)) {
        if (c.ragdollEnabled && c.ragdollPos) {
          const dx = player_pos[0] - c.ragdollPos[0];
          const dy = player_pos[1] - c.ragdollPos[1];
          const dz = player_pos[2] - c.ragdollPos[2];
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (dist > 5.0) {
            // Allow recycle logic to run below
          } else {
            continue;
          }
        } else {
          continue;
        }
      }
    }

    if (c.ragdollEnabled) {
      if (c.ragdollPos) {
        const dx = player_pos[0] - c.ragdollPos[0];
        const dy = player_pos[1] - c.ragdollPos[1];
        const dz = player_pos[2] - c.ragdollPos[2];
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (dist > 5.0) {
          // Recycle dead NPC (ดึงโมเดลเก่ามาใช้ซ้ำ)
          let newTheta = Math.random() * Math.PI;
          let newPhi = Math.random() * Math.PI * 2;
          let newHeight = getHeightOnSphere(newTheta, newPhi, seed);

          if (c.type === 'human') {
            // Find an existing human to group with, or pick a random land spot
            let foundLeader = false;
            const effWaterH = (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15);
            const rRatio = Math.max(1.0, (typeof RADIUS !== 'undefined' ? RADIUS : 8.0) / 8.0);
            for (let other of amphibians) {
               if (other.type === 'human' && other !== c && !other.ragdollEnabled) {
                   if (Math.random() < 0.5) {
                       newTheta = other.theta + (Math.random() - 0.5) * (0.04 / rRatio);
                       newPhi = other.phi + (Math.random() - 0.5) * (0.04 / rRatio);
                       newHeight = getHeightOnSphere(newTheta, newPhi, seed);
                       if (newHeight * HEIGHT_SCALE > effWaterH) {
                           foundLeader = true;
                           break;
                       }
                   }
               }
            }
            
            if (!foundLeader) {
                for(let tries=0; tries<10; tries++) {
                   if (newHeight * HEIGHT_SCALE > effWaterH) break;
                   newTheta = Math.random() * Math.PI;
                   newPhi = Math.random() * Math.PI * 2;
                   newHeight = getHeightOnSphere(newTheta, newPhi, seed);
                }
            }
          }

          const isMeganeura = c.type === 'meganeura';
          const isIsopod = c.type === 'isopod';
          const effWaterH = (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15);
          const gRadius = RADIUS + newHeight * HEIGHT_SCALE;
          const wRadius = RADIUS + effWaterH;
          const newR = isMeganeura ? gRadius + 0.3 : (isIsopod ? gRadius + 0.02 : Math.max(gRadius, wRadius - 0.02) + 0.05);
          const maxHp = window.NpcRegistry[c.type] ? window.NpcRegistry[c.type].maxHp : 1;
          
          c.theta = newTheta;
          c.phi = newPhi;
          c.r = newR;
          c.heading = Math.random() * Math.PI * 2;
          c.animPhase = Math.random() * Math.PI * 2;
          c.ragdollEnabled = false;
          c.ragdollInitialized = false;
          c.ragdollPos = null;
          c.ragdollVel = null;
          c.hp = maxHp;
          c.maxHp = maxHp;
          
          // Remove arrows attached to this NPC
          for (let coll of collectibles) {
            if (coll.attachedToNPC === c) {
              coll.attachedToNPC = null;
              coll.active = false;
            }
          }
          pendingCollectibleRefresh = true;
          continue;
        }
      }

      let immersion = 0.0;
      let depth = -1.0;
      if (!c.ragdollInitialized) {
        const sinT = Math.sin(c.theta);
        const cosT = Math.cos(c.theta);
        const sinP = Math.sin(c.phi);
        const cosP = Math.cos(c.phi);
        const N_init = [sinT * cosP, cosT, sinT * sinP];
        c.ragdollPos = [
          N_init[0] * c.r,
          N_init[1] * c.r,
          N_init[2] * c.r,
        ];

        // Initial velocity when killed - set to zero (plus small random twitching) to prevent any upward bouncing or popping
        c.ragdollVel = [
          (Math.random() - 0.5) * 0.001,
          (Math.random() - 0.5) * 0.001,
          (Math.random() - 0.5) * 0.001,
        ];

        c.ragdollAxis = [
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5,
        ];
        const len = Math.sqrt(
          c.ragdollAxis[0] ** 2 +
            c.ragdollAxis[1] ** 2 +
            c.ragdollAxis[2] ** 2,
        );
        c.ragdollAxis[0] /= len;
        c.ragdollAxis[1] /= len;
        c.ragdollAxis[2] /= len;
        c.ragdollAngle = 0;
        c.ragdollAngularSpeed = (Math.random() - 0.5) * 0.15;

        // Initialize diedOnSurface for NPC
        const waterRadius = RADIUS + (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15);
        const r_dist = Math.sqrt(
          c.ragdollPos[0] ** 2 +
            c.ragdollPos[1] ** 2 +
            c.ragdollPos[2] ** 2,
        );
        const initialDepth = waterRadius - r_dist;
        // If NPC dies while swimming in deep water (initialDepth >= 0.04), they will sink immediately (diedOnSurface = false)
        c.diedOnSurface =
          !waterEnabled || !c.isSwimming || initialDepth < 0.04;

        c.ragdollInitialized = true;
        c.ragdollAsleep = false;
        c.ragdollSleepFrames = 0;
      }

      if (!c.ragdollAsleep) {
        const dtScale = deltaTime / 0.016;
      const rp = c.ragdollPos;
      const r_dist = Math.sqrt(rp[0] ** 2 + rp[1] ** 2 + rp[2] ** 2);
      if (r_dist > 0.001) {
        const nx = rp[0] / r_dist;
        const ny = rp[1] / r_dist;
        const nz = rp[2] / r_dist;

        const caveData = typeof getTerrainSurfaceAndCeiling === "function"
          ? getTerrainSurfaceAndCeiling(nx, ny, nz, r_dist)
          : { ground: RADIUS + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(Math.acos(Math.max(-1.0, Math.min(1.0, ny))), Math.atan2(nz, nx), seed) : 0) * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };

        c.ragdollCaveData = caveData; // Save for vertex processing to avoid massive per-vertex terrain lookups

        // Use Physics engine
        Physics.applyGravity(c.ragdollVel, nx, ny, nz, dtScale, Physics.gravityAccel);

        // Friction
        const airFriction = Math.pow(0.98, dtScale);

        const waterRadius = RADIUS + (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15);
        const hRange = 0.05; // 5cm floating band
        if (waterEnabled && !caveData.insideTunnel) {
          immersion = Math.max(
            0.0,
            Math.min(
              1.0,
              (waterRadius + hRange - r_dist) / (2.0 * hRange),
            ),
          );
          depth = waterRadius - r_dist;
          if (depth < 0.04) {
            c.diedOnSurface = true;
          }
        } else {
          c.diedOnSurface = true;
        }

        const isNearSurface = c.diedOnSurface;
        // Smoothly interpolate friction based on immersion
        // Sinking underwater should have a lot more resistance/drag than floating at surface
        const waterFriction = isNearSurface
          ? Math.pow(0.85, dtScale)
          : Math.pow(0.78, dtScale);
        const friction =
          airFriction * (1.0 - immersion) + waterFriction * immersion;
        Physics.applyFriction(c.ragdollVel, friction);
        c.ragdollAngularSpeed *=
          airFriction * (1.0 - immersion) +
          Math.pow(isNearSurface ? 0.95 : 0.85, dtScale) * immersion;

        if (immersion > 0) {
          let buoyancyFactor = 0.0;
          if (depth > 0) {
            if (c.diedOnSurface) {
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
          Physics.applyBuoyancyForce(c.ragdollVel, nx, ny, nz, buoyancyFactor, dtScale, Physics.gravityAccel);

          // Gentle underwater drift and swaying to simulate fluid resistance/currents
          const driftPhase = Date.now() * 0.001 * 2.0 + (c.phi || 0);
          const driftAmp = 0.0004 * dtScale * immersion;
          let tx = -ny;
          let ty = nx;
          let tz = 0;
          const tlen = Math.sqrt(tx * tx + ty * ty + tz * tz);
          if (tlen > 0.001) {
            tx /= tlen;
            ty /= tlen;
            c.ragdollVel[0] += tx * Math.sin(driftPhase) * driftAmp;
            c.ragdollVel[1] += ty * Math.sin(driftPhase) * driftAmp;
            c.ragdollVel[2] += tz * Math.sin(driftPhase) * driftAmp;
          }
          c.ragdollAngularSpeed +=
            Math.sin(driftPhase * 1.5) * 0.001 * dtScale * immersion;

          // Apply vertical damping to completely kill oscillations / jitter for floating bodies at surface
          if (c.diedOnSurface) {
            const v_radial =
              c.ragdollVel[0] * nx +
              c.ragdollVel[1] * ny +
              c.ragdollVel[2] * nz;
            const v_tx = c.ragdollVel[0] - nx * v_radial;
            const v_ty = c.ragdollVel[1] - ny * v_radial;
            const v_tz = c.ragdollVel[2] - nz * v_radial;

            // Reduce vertical speed when floating at surface
            const dampFactor = Math.pow(0.65, dtScale);
            const new_v_radial = v_radial * dampFactor;
            c.ragdollVel[0] = v_tx + nx * new_v_radial;
            c.ragdollVel[1] = v_ty + ny * new_v_radial;
            c.ragdollVel[2] = v_tz + nz * new_v_radial;
          }
        }
      }

      rp[0] += c.ragdollVel[0];
      rp[1] += c.ragdollVel[1];
      rp[2] += c.ragdollVel[2];

      c.ragdollAngle += c.ragdollAngularSpeed * dtScale;

      // Collide with terrain
      const distToCenter = Math.sqrt(
        rp[0] ** 2 + rp[1] ** 2 + rp[2] ** 2,
      );
      if (distToCenter > 0.001) {
        const ux = rp[0] / distToCenter;
        const uy = rp[1] / distToCenter;
        const uz = rp[2] / distToCenter;

        c.theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
        c.phi = Math.atan2(uz, ux);
        c.r = distToCenter;

        // REUSE caveData (which is c.ragdollCaveData)
        const caveData = c.ragdollCaveData || { ground: RADIUS + getHeightOnSphere(c.theta, c.phi, seed) * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };
        const surfaceRadius = caveData.ground;

        const colRadius = 0.15 * 0.5; // matching NPC model scale
        
        let target = distToCenter;
        let hitSolid = false;
        
        if (caveData.insideTunnel) {
          if (distToCenter < caveData.ground + colRadius) {
            target = caveData.ground + colRadius;
            hitSolid = true;
            const v_radial = c.ragdollVel[0] * ux + c.ragdollVel[1] * uy + c.ragdollVel[2] * uz;
            if (v_radial < 0) {
                c.ragdollVel[0] -= ux * v_radial;
                c.ragdollVel[1] -= uy * v_radial;
                c.ragdollVel[2] -= uz * v_radial;
            }
          } else if (caveData.ceiling !== Infinity && distToCenter > caveData.ceiling - colRadius) {
            target = caveData.ceiling - colRadius;
            hitSolid = true;
            const v_radial = c.ragdollVel[0] * ux + c.ragdollVel[1] * uy + c.ragdollVel[2] * uz;
            if (v_radial > 0) {
               c.ragdollVel[0] -= ux * v_radial;
               c.ragdollVel[1] -= uy * v_radial;
               c.ragdollVel[2] -= uz * v_radial;
            }
          }
        } else {
          if (distToCenter < surfaceRadius + colRadius) {
            // Only push up to the surface if we are within 0.5 units of it.
            // This prevents teleporting from deep underground caves to the surface.
            if (distToCenter > surfaceRadius - 0.5) {
              target = surfaceRadius + colRadius;
              hitSolid = true;
              const v_radial = c.ragdollVel[0] * ux + c.ragdollVel[1] * uy + c.ragdollVel[2] * uz;
              if (v_radial < 0) {
                  c.ragdollVel[0] -= ux * v_radial;
                  c.ragdollVel[1] -= uy * v_radial;
                  c.ragdollVel[2] -= uz * v_radial;
              }
            } else {
              // Deep underground, clipped through cave floor. Stop velocity to prevent falling forever.
              Physics.applyFriction(c.ragdollVel, 0.5);
            }
          }
        }

        if (hitSolid) {
          rp[0] = ux * target;
          rp[1] = uy * target;
          rp[2] = uz * target;
          c.r = target;

          // Ground friction
          Physics.applyFriction(c.ragdollVel, 0.7);
          c.ragdollAngularSpeed *= 0.7;

          // Ground normal estimation - cached to prevent 3 heavy FBM noise evaluations per frame!
          let snX, snY, snZ;
          if (!c.ragdollNormal || !c.ragdollNormalPos ||
              Math.hypot(rp[0] - c.ragdollNormalPos[0], rp[1] - c.ragdollNormalPos[1], rp[2] - c.ragdollNormalPos[2]) > 0.05) {

            const getT = (t, p) => {
              const rad =
                RADIUS + getHeightOnSphere(t, p, seed) * HEIGHT_SCALE;
              return [
                rad * Math.sin(t) * Math.cos(p),
                rad * Math.cos(t),
                rad * Math.sin(t) * Math.sin(p),
              ];
            };
            const p0 = getT(c.theta, c.phi);
            const p1 = getT(c.theta, c.phi + 0.02);
            const p2 = getT(c.theta - 0.02, c.phi);
            const v1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
            const v2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
            let snX_calc = v1[1] * v2[2] - v1[2] * v2[1];
            let snY_calc = v1[2] * v2[0] - v1[0] * v2[2];
            let snZ_calc = v1[0] * v2[1] - v1[1] * v2[0];
            const snLen = Math.sqrt(snX_calc * snX_calc + snY_calc * snY_calc + snZ_calc * snZ_calc);
            if (snLen > 0.0001) {
              snX_calc /= snLen;
              snY_calc /= snLen;
              snZ_calc /= snLen;
              if (snX_calc * ux + snY_calc * uy + snZ_calc * uz < 0) {
                snX_calc = -snX_calc;
                snY_calc = -snY_calc;
                snZ_calc = -snZ_calc;
              }
            } else {
              snX_calc = ux;
              snY_calc = uy;
              snZ_calc = uz;
            }
            c.ragdollNormal = [snX_calc, snY_calc, snZ_calc];
            c.ragdollNormalPos = [rp[0], rp[1], rp[2]];
          }
          
          snX = c.ragdollNormal[0];
          snY = c.ragdollNormal[1];
          snZ = c.ragdollNormal[2];

          const bounciness = !c.diedOnSurface ? 0.0 : 0.1;
          const friction = !c.diedOnSurface ? 0.9 : 0.95;

          const dot = c.ragdollVel[0] * snX + c.ragdollVel[1] * snY + c.ragdollVel[2] * snZ;
          if (dot < 0) {
            const vnX = snX * dot;
            const vnY = snY * dot;
            const vnZ = snZ * dot;
            const vtX = c.ragdollVel[0] - vnX;
            const vtY = c.ragdollVel[1] - vnY;
            const vtZ = c.ragdollVel[2] - vnZ;
            
            Physics.resolveVelocityCollision(c.ragdollVel, snX, snY, snZ, bounciness, friction);
            
            const speedSq = vtX * vtX + vtY * vtY + vtZ * vtZ;
            if (speedSq > 0.00001) {
              const speed = Math.sqrt(speedSq);
              c.ragdollAngularSpeed = speed * 1.5;

              let cX = snY * vtZ - snZ * vtY;
              let cY = snZ * vtX - snX * vtZ;
              let cZ = snX * vtY - snY * vtX;
              const cLen = Math.sqrt(cX * cX + cY * cY + cZ * cZ);
              if (cLen > 0.0001) {
                c.ragdollAxis = [cX / cLen, cY / cLen, cZ / cLen];
              }
            } else {
              let normalizedAngle = Math.abs(c.ragdollAngle % Math.PI);
              if (
                normalizedAngle < (Math.PI / 2) * 0.8 ||
                normalizedAngle > Math.PI - (Math.PI / 2) * 0.8
              ) {
                c.ragdollAngularSpeed =
                  0.05 * Math.sign(c.ragdollAngularSpeed || 1);
              } else {
                c.ragdollAngularSpeed *= 0.5;
              }
            }
          }
        }
      }

      // Sleep check to put static ragdolls to rest and save 100% of their physics/collision CPU cost!
      const speedSq = c.ragdollVel[0]*c.ragdollVel[0] + c.ragdollVel[1]*c.ragdollVel[1] + c.ragdollVel[2]*c.ragdollVel[2];
      const angSpeed = Math.abs(c.ragdollAngularSpeed);
      if (speedSq < 0.000004 && angSpeed < 0.01) {
        c.ragdollSleepFrames = (c.ragdollSleepFrames || 0) + 1;
        if (c.ragdollSleepFrames > 15) {
          c.ragdollAsleep = true;
        }
      } else {
        c.ragdollSleepFrames = 0;
      }
      }
    } else {
      // Check distance to player and damage if close
      const dx = player_pos[0] - npc_pos[0];
      const dy = player_pos[1] - npc_pos[1];
      const dz = player_pos[2] - npc_pos[2];
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (c.type === 'meganeura' && dist < 0.45 && playerHP > 0 && playerDamageCooldown <= 0 && !playerControlsLocked) {
        damagePlayer(1);
      }

      c.ragdollInitialized = false;
      const npcRegConfig = window.NpcRegistry && window.NpcRegistry[c.type];
      const animSpeed = npcRegConfig && npcRegConfig.animSpeed !== undefined ? npcRegConfig.animSpeed : 4.0;
      let moveSpeedBase = (c.isSwimming ? 0.25 : 0.05);
      if (npcRegConfig && npcRegConfig.moveSpeed !== undefined) moveSpeedBase = npcRegConfig.moveSpeed;
      
      const walkBlend = c.walkBlend !== undefined ? c.walkBlend : (c.isIdle ? 0 : 1);
      moveSpeedBase *= walkBlend;
      
      c.animPhase += deltaTime * animSpeed * walkBlend;
      const moveSpeed = moveSpeedBase * deltaTime;

      // Great-circle rotation to avoid polar coordinate singularities (walking around the center of the world)
      const sinT = Math.sin(c.theta);
      const cosT = Math.cos(c.theta);
      const sinP = Math.sin(c.phi);
      const cosP = Math.cos(c.phi);

      const North = [-cosT * cosP, sinT, -cosT * sinP];
      const East = [-sinP, 0, cosP];

      const V_move = [
        North[0] * Math.cos(c.heading) + East[0] * Math.sin(c.heading),
        North[1] * Math.cos(c.heading) + East[1] * Math.sin(c.heading),
        North[2] * Math.cos(c.heading) + East[2] * Math.sin(c.heading),
      ];

      const P_curr = [sinT * cosP, cosT, sinT * sinP];
      const speed = moveSpeed / c.r;

      let P_new = [
        P_curr[0] * Math.cos(speed) + V_move[0] * Math.sin(speed),
        P_curr[1] * Math.cos(speed) + V_move[1] * Math.sin(speed),
        P_curr[2] * Math.cos(speed) + V_move[2] * Math.sin(speed),
      ];

      const pLen = Math.sqrt(
        P_new[0] * P_new[0] + P_new[1] * P_new[1] + P_new[2] * P_new[2],
      );
      if (pLen > 0.0001) {
        P_new = [P_new[0] / pLen, P_new[1] / pLen, P_new[2] / pLen];
      }

      c.theta = Math.acos(Math.max(-1, Math.min(1, P_new[1])));
      c.theta = Math.max(1e-5, Math.min(Math.PI - 1e-5, c.theta));

      c.phi = Math.atan2(P_new[2], P_new[0]);
      if (c.phi < 0) c.phi += Math.PI * 2;

      // Parallel transport the heading angle to the new position
      const sinT_new = Math.sin(c.theta);
      const cosT_new = Math.cos(c.theta);
      const sinP_new = Math.sin(c.phi);
      const cosP_new = Math.cos(c.phi);

      const North_new = [
        -cosT_new * cosP_new,
        sinT_new,
        -cosT_new * sinP_new,
      ];
      const East_new = [-sinP_new, 0, cosP_new];

      const V_tangent = [
        -P_curr[0] * Math.sin(speed) + V_move[0] * Math.cos(speed),
        -P_curr[1] * Math.sin(speed) + V_move[1] * Math.cos(speed),
        -P_curr[2] * Math.sin(speed) + V_move[2] * Math.cos(speed),
      ];

      const f_comp =
        V_tangent[0] * North_new[0] +
        V_tangent[1] * North_new[1] +
        V_tangent[2] * North_new[2];
      const r_comp =
        V_tangent[0] * East_new[0] +
        V_tangent[1] * East_new[1] +
        V_tangent[2] * East_new[2];
      c.heading = Math.atan2(r_comp, f_comp);

      c.heading += (Math.random() - 0.5) * 1.0 * deltaTime;

      const sinT_npc = Math.sin(c.theta);
      const cosT_npc = Math.cos(c.theta);
      const sinP_npc = Math.sin(c.phi);
      const cosP_npc = Math.cos(c.phi);
      const npc_nx = sinT_npc * cosP_npc;
      const npc_ny = cosT_npc;
      const npc_nz = sinT_npc * sinP_npc;

      const npc_r_est = c.r || (RADIUS + getHeightOnSphere(c.theta, c.phi, seed) * HEIGHT_SCALE);
      
      // Throttled terrain/cave and water lookup to keep the frame rate at solid 120fps!
      if (c.caveCheckAccumulator === undefined) {
        c.caveCheckAccumulator = Math.random() * 0.15; // Jitter the initial timers to spread the load across frames
      }
      c.caveCheckAccumulator += deltaTime;

      if (!c.cachedCaveData || c.caveCheckAccumulator >= 0.15) {
        c.caveCheckAccumulator = 0;
        c.cachedCaveData = typeof getTerrainSurfaceAndCeiling === "function"
          ? getTerrainSurfaceAndCeiling(npc_nx, npc_ny, npc_nz, npc_r_est)
          : { ground: RADIUS + getHeightOnSphere(c.theta, c.phi, seed) * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };
        
        const gRadiusTemp = c.cachedCaveData.ground;
        const npc_r_temp = c.r || gRadiusTemp;
        c.cachedWaterRadius = getWaterRadiusAt(npc_nx * npc_r_temp, npc_ny * npc_r_temp, npc_nz * npc_r_temp);
      }

      const npcCaveData = c.cachedCaveData;
      const gRadius = npcCaveData.ground;
      const npc_r = c.r || gRadius;
      let wRadius = c.cachedWaterRadius;
      if (npcCaveData.insideTunnel && wRadius === 0) {
          wRadius = (typeof RADIUS !== 'undefined' ? RADIUS : 8.0) + (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * 0.15;
      }

      // Update specific NPC type movement behavior
      const npcReg = window.NpcRegistry[c.type];
      if (npcReg && npcReg.updateBehavior) {
        npcReg.updateBehavior(c, deltaTime, seed, gRadius, wRadius, npcCaveData);
      }

      if (c.lastAnimPhase === undefined) c.lastAnimPhase = c.animPhase;
      const phaseOffset = c.isSwimming ? 4.05 : 0; // Sync with max tail velocity (z=-0.95)
      const stepPrev = Math.floor(
        (c.lastAnimPhase - phaseOffset) / Math.PI,
      );
      const stepCurr = Math.floor((c.animPhase - phaseOffset) / Math.PI);

      if (stepPrev !== stepCurr) {
        // A step was taken. Calculate distance to player to determine volume
        const distAngle = Math.acos(
          Math.max(
            -1,
            Math.min(
              1,
              Math.sin(c.theta) *
                Math.sin(charTheta) *
                Math.cos(c.phi - charPhi) +
                Math.cos(c.theta) * Math.cos(charTheta),
            ),
          ),
        );
        const dist = distAngle * RADIUS;
        if (dist < 2.0) {
          // Quadratic falloff for more realistic sound attenuation
          const volScale =
            Math.pow(Math.max(0, 1.0 - dist / 2.0), 2) * 0.6;
          if (volScale > 0.01) {
            if (c.isSwimming) {
              playSplashSound(volScale);
            } else {
              playFootstepSound(volScale);
            }
          }
        }
      }
      c.lastAnimPhase = c.animPhase;
    }

    const sinTheta = Math.sin(c.theta);
    const cosTheta = Math.cos(c.theta);
    const sinPhi = Math.sin(c.phi);
    const cosPhi = Math.cos(c.phi);
    let N = [sinTheta * cosPhi, cosTheta, sinTheta * sinPhi];

    c.position = [N[0] * c.r, N[1] * c.r, N[2] * c.r];
    c.radius = 0.15;

    // Heading local frame
    let h_rad = c.heading;
    const sinH = Math.sin(h_rad);
    const cosH = Math.cos(h_rad);

    let North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
    let East = [-sinPhi, 0, cosPhi];

    let F = [
      North[0] * cosH + East[0] * sinH,
      North[1] * cosH + East[1] * sinH,
      North[2] * cosH + East[2] * sinH,
    ];
    let R = [
      -North[0] * sinH + East[0] * cosH,
      -North[1] * sinH + East[1] * cosH,
      -North[2] * sinH + East[2] * cosH,
    ];

    if (c.ragdollEnabled) {
      const q = c.ragdollAngle;
      const cosQ = Math.cos(q);
      const sinQ = Math.sin(q);
      const ax = c.ragdollAxis[0];
      const ay = c.ragdollAxis[1];
      const az = c.ragdollAxis[2];

      const rotateVector = (v) => {
        const dot = v[0] * ax + v[1] * ay + v[2] * az;
        const cross = [
          ay * v[2] - az * v[1],
          az * v[0] - ax * v[2],
          ax * v[1] - ay * v[0],
        ];
        return [
          v[0] * cosQ + cross[0] * sinQ + ax * dot * (1.0 - cosQ),
          v[1] * cosQ + cross[1] * sinQ + ay * dot * (1.0 - cosQ),
          v[2] * cosQ + cross[2] * sinQ + az * dot * (1.0 - cosQ),
        ];
      };

      N = rotateVector(N);
      F = rotateVector(F);
      R = rotateVector(R);
    }

    const pos = c.ragdollEnabled ? c.ragdollPos : c.position;

    let f = [0, 0, 0];
    if (c.ragdollEnabled && c.ragdollVel) {
      const localVel = [
        c.ragdollVel[0] * R[0] + c.ragdollVel[1] * R[1] + c.ragdollVel[2] * R[2],
        c.ragdollVel[0] * N[0] + c.ragdollVel[1] * N[1] + c.ragdollVel[2] * N[2],
        c.ragdollVel[0] * F[0] + c.ragdollVel[1] * F[1] + c.ragdollVel[2] * F[2],
      ];
      const g = [
        -N[0] * R[0] - N[1] * R[1] - N[2] * R[2],
        -N[0] * N[0] - N[1] * N[1] - N[2] * N[2],
        -N[0] * F[0] - N[1] * F[1] - N[2] * F[2],
      ];
      f[0] = g[0] * 1.5 - localVel[0] * 12.0;
      f[1] = g[1] * 1.5 - localVel[1] * 12.0;
      f[2] = g[2] * 1.5 - localVel[2] * 12.0;
    }

    const transformPoint = (px, py, pz) => {
      let worldPos = [
        pos[0] + (px * R[0] + py * N[0] + pz * F[0]),
        pos[1] + (px * R[1] + py * N[1] + pz * F[1]),
        pos[2] + (px * R[2] + py * N[2] + pz * F[2]),
      ];
      if (c.ragdollEnabled) {
        const dist = Math.sqrt(
          worldPos[0] ** 2 + worldPos[1] ** 2 + worldPos[2] ** 2,
        );
        if (dist > 0.001) {
          const ux = worldPos[0] / dist;
          const uy = worldPos[1] / dist;
          const uz = worldPos[2] / dist;

          const caveData = c.ragdollCaveData || { ground: RADIUS + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(Math.acos(Math.max(-1.0, Math.min(1.0, uy))), Math.atan2(uz, ux), seed) : 0) * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };
          const surfaceRadius = caveData.ground;

          // Determine thickness envelope based on local coordinate
          const scale = 0.5; // matching base scale
          const localPx = px / scale;
          const localPz = pz / scale;
          let thickness = 0.06;
          if (Math.abs(localPx) > 0.05) {
            thickness = 0.015;
          } else {
            if (localPz > 0.2) thickness = 0.03;
            else if (localPz > -0.3 && localPz <= 0.2) thickness = 0.12;
            else if (localPz > -0.6 && localPz <= -0.3) thickness = 0.09;
            else if (localPz <= -0.6) thickness = 0.04;
          }

          if (caveData.insideTunnel) {
             const minRad = caveData.ground + thickness * scale;
             const maxRad = caveData.ceiling !== Infinity ? caveData.ceiling - thickness * scale : Infinity;
             if (dist < minRad) {
               worldPos = [ux * minRad, uy * minRad, uz * minRad];
             } else if (dist > maxRad && maxRad !== Infinity) {
               worldPos = [ux * maxRad, uy * maxRad, uz * maxRad];
             }
          } else {
             const minRad = surfaceRadius + thickness * scale;
             if (dist < minRad && dist > surfaceRadius - 0.5) {
               worldPos = [ux * minRad, uy * minRad, uz * minRad];
             }
          }
        }
      }
      return worldPos;
    };

    const scale = c.type === 'meganeura' ? 0.25 : (c.type === 'isopod' ? 0.38 : 0.5);

    // Render using the registered NPC implementation
    const npcReg = window.NpcRegistry[c.type];
    if (npcReg && npcReg.render) {
      npcReg.render(
        c,
        allVertices,
        allColors,
        allIndices,
        scale,
        N,
        R,
        F,
        pos,
        f,
        transformPoint,
        seed
      );
    }
  }

  if (allIndices.length > 0) {
    const flatGeom = makeFlatShadedGeometry(
      allVertices,
      allColors,
      allIndices,
      true
    );
    amphibianIndicesLength = flatGeom.indices.length;

    if (!amphibianVertexBuffer) amphibianVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, amphibianVertexBuffer);
    const vCount = flatGeom.vertices.length;
    const vertTyped = getReusableFloat32Array(1, vCount).subarray(0, vCount);
    vertTyped.set(flatGeom.vertices);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      vertTyped,
      gl.DYNAMIC_DRAW,
    );

    if (!amphibianColorBuffer) amphibianColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, amphibianColorBuffer);
    const cCount = flatGeom.colors.length;
    const colTyped = getReusableFloat32Array(2, cCount).subarray(0, cCount);
    colTyped.set(flatGeom.colors);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      colTyped,
      gl.DYNAMIC_DRAW,
    );

    if (!amphibianNormalBuffer) amphibianNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, amphibianNormalBuffer);
    const nCount = flatGeom.normals.length;
    const normTyped = getReusableFloat32Array(3, nCount).subarray(0, nCount);
    normTyped.set(flatGeom.normals);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      normTyped,
      gl.DYNAMIC_DRAW,
    );

    if (!amphibianIndexBuffer) amphibianIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, amphibianIndexBuffer);
    const iCount = flatGeom.indices.length;
    if (supportUint32 && iCount > 65535) {
      const indTyped = getReusableUint32Array(iCount).subarray(0, iCount);
      indTyped.set(flatGeom.indices);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        indTyped,
        gl.DYNAMIC_DRAW,
      );
    } else {
      const indTyped = getReusableUint16Array(iCount).subarray(0, iCount);
      indTyped.set(flatGeom.indices);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        indTyped,
        gl.DYNAMIC_DRAW,
      );
    }
  }
}

function clearActiveNPCs() {
  if (typeof amphibians !== "undefined" && Array.isArray(amphibians)) {
    amphibians.length = 0;
  }
}
window.clearActiveNPCs = clearActiveNPCs;
window.initAmphibians = initAmphibians;
window.rebuildNPCs = function(count, seed) {
  initAmphibians(count || 12, seed || (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 12345));
};
