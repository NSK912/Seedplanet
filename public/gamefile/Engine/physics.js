const Physics = {
    gravityAccel: 0.00015,
    
    // Apply gravity to a 3D velocity vector along a normal (nx, ny, nz)
    applyGravity: function(vel, nx, ny, nz, dtScale = 1.0, customGravity = 0.00015) {
        const g = customGravity * dtScale;
        vel[0] -= nx * g;
        vel[1] -= ny * g;
        vel[2] -= nz * g;
    },

    // Apply gravity to a 1D vertical velocity
    applyVerticalGravity: function(verticalVel, dtScale = 1.0, customGravity = 0.00015) {
        return verticalVel - (customGravity * dtScale);
    },

    // Apply simple air/water friction
    applyFriction: function(vel, friction = 0.98, dtScale = 1.0) {
        const scaledFriction = Math.pow(friction, dtScale);
        vel[0] *= scaledFriction;
        vel[1] *= scaledFriction;
        vel[2] *= scaledFriction;
    },

    // Apply a buoyant force to a 3D velocity vector
    applyBuoyancyForce: function(vel, nx, ny, nz, buoyancyFactor, dtScale = 1.0, customGravity = 0.00015) {
        const buoyancy = customGravity * buoyancyFactor * dtScale;
        vel[0] += nx * buoyancy;
        vel[1] += ny * buoyancy;
        vel[2] += nz * buoyancy;
    },

    // Resolve collision with a surface
    resolveVelocityCollision: function(vel, nx, ny, nz, bounce = 0.0, friction = 0.8) {
        const dot = vel[0]*nx + vel[1]*ny + vel[2]*nz;
        if (dot < 0) {
            const vnX = nx * dot;
            const vnY = ny * dot;
            const vnZ = nz * dot;

            const vtX = vel[0] - vnX;
            const vtY = vel[1] - vnY;
            const vtZ = vel[2] - vnZ;

            vel[0] = vtX * friction - vnX * bounce;
            vel[1] = vtY * friction - vnY * bounce;
            vel[2] = vtZ * friction - vnZ * bounce;
        }
    },

    resolveSurfaceCollision: function(pos, vel, groundRadius, nx, ny, nz, bounce = 0.0, friction = 0.8) {
        // Impact velocity along normal
        const impactVel = -(vel[0]*nx + vel[1]*ny + vel[2]*nz);
        if (impactVel > 0) {
            // Cancel velocity along normal
            vel[0] += nx * impactVel;
            vel[1] += ny * impactVel;
            vel[2] += nz * impactVel;
            
            // Apply bounce
            if (bounce > 0) {
                vel[0] += nx * impactVel * bounce;
                vel[1] += ny * impactVel * bounce;
                vel[2] += nz * impactVel * bounce;
            }
            
            // Apply surface friction
            this.applyFriction(vel, friction);
            
            // Snap position to surface
            pos[0] = nx * groundRadius;
            pos[1] = ny * groundRadius;
            pos[2] = nz * groundRadius;
        }
    },

    // Unified Land Boat (Wheeled Vehicle) terrain contact and transform calculation
    calculateLandBoatTransform: function({
        position,
        nx, ny, nz,
        F, R,
        baseRadius = null,
        waterEnabled = false,
        waterLevel = 0,
        waterAnimTime = 0,
        waveStrength = 0
    }) {
        const rad = typeof RADIUS !== "undefined" ? RADIUS : 100;
        const hScale = typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE : 1;
        const seed = typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0;
        const getH = typeof getHeightOnSphere === "function" ? getHeightOnSphere : null;
        
        let pR = Math.sqrt(position[0]*position[0] + position[1]*position[1] + position[2]*position[2]) || 1;
        if (nx === undefined || ny === undefined || nz === undefined) {
            nx = position[0] / pR;
            ny = position[1] / pR;
            nz = position[2] / pR;
        }

        const theta = Math.acos(Math.max(-1.0, Math.min(1.0, ny)));
        const phi = Math.atan2(nz, nx);
        
        let centerTerrainRad = baseRadius;
        if (centerTerrainRad === null) {
            const centerTerrainH = getH ? getH(theta, phi, seed) : 0;
            centerTerrainRad = rad + centerTerrainH * hScale;
        }
        
        const waterRadius = rad + waterLevel * 0.15;

        let isInWater = false;
        if (baseRadius === null) {
            baseRadius = centerTerrainRad;
            if (waterEnabled && centerTerrainRad < waterRadius) {
                baseRadius = waterRadius;
                isInWater = true;
                if (typeof getWaterWave === "function") {
                    const wave = getWaterWave(nx * waterRadius, ny * waterRadius, nz * waterRadius, waterAnimTime, waveStrength);
                    let depth = waterRadius - centerTerrainRad;
                    let fade = Math.min(1.0, Math.max(0.0, depth / 0.1));
                    baseRadius += wave * fade;
                }
            }
        } else {
            // baseRadius is already provided, just add waves if it's matching water radius
            if (waterEnabled && Math.abs(baseRadius - waterRadius) < 0.01) {
                isInWater = true;
                if (typeof getWaterWave === "function") {
                    const wave = getWaterWave(nx * waterRadius, ny * waterRadius, nz * waterRadius, waterAnimTime, waveStrength);
                    let depth = waterRadius - centerTerrainRad;
                    let fade = Math.min(1.0, Math.max(0.0, depth / 0.1));
                    baseRadius += wave * fade;
                }
            }
        }

        const fSideOff = typeof window !== "undefined" && typeof window.wheelFrontSideOffset === "number" ? window.wheelFrontSideOffset : 0.18;
        const fFwdOff  = typeof window !== "undefined" && typeof window.wheelFrontFwdOffset  === "number" ? window.wheelFrontFwdOffset  : 0.18;
        const fUpOff   = typeof window !== "undefined" && typeof window.wheelFrontUpOffset   === "number" ? window.wheelFrontUpOffset   : -0.03;

        const rSideOff = typeof window !== "undefined" && typeof window.wheelRearSideOffset === "number" ? window.wheelRearSideOffset : 0.18;
        const rFwdOff  = typeof window !== "undefined" && typeof window.wheelRearFwdOffset  === "number" ? window.wheelRearFwdOffset  : 0.18;
        const rUpOff   = typeof window !== "undefined" && typeof window.wheelRearUpOffset   === "number" ? window.wheelRearUpOffset   : -0.03;

        const wheelScale = typeof window !== "undefined" && typeof window.wheelScaleMultiplier === "number" ? window.wheelScaleMultiplier : 1.0;
        const wheelRadius = 0.16 * wheelScale;

        let bF = F ? [F[0], F[1], F[2]] : [0, 0, 1];
        let bR_vec = R ? [R[0], R[1], R[2]] : [1, 0, 0];

        const wheelOffsets = [
            { id: "FL", side: -1, fwd: fFwdOff,  sOff: fSideOff, uOff: fUpOff },
            { id: "FR", side: 1,  fwd: fFwdOff,  sOff: fSideOff, uOff: fUpOff },
            { id: "RL", side: -1, fwd: -rFwdOff, sOff: rSideOff, uOff: rUpOff },
            { id: "RR", side: 1,  fwd: -rFwdOff, sOff: rSideOff, uOff: rUpOff }
        ];

        let maxWheelRequiredRadius = -Infinity;
        let reqRadii = [];
        let wHeights = [];

        for (let wo of wheelOffsets) {
            let wOffX = bR_vec[0] * (wo.side * wo.sOff) + nx * wo.uOff + bF[0] * wo.fwd;
            let wOffY = bR_vec[1] * (wo.side * wo.sOff) + ny * wo.uOff + bF[1] * wo.fwd;
            let wOffZ = bR_vec[2] * (wo.side * wo.sOff) + nz * wo.uOff + bF[2] * wo.fwd;

            let wWorldX = centerTerrainRad * nx + wOffX;
            let wWorldY = centerTerrainRad * ny + wOffY;
            let wWorldZ = centerTerrainRad * nz + wOffZ;

            let wR = Math.sqrt(wWorldX*wWorldX + wWorldY*wWorldY + wWorldZ*wWorldZ) || 1;
            let wTheta = Math.acos(Math.max(-1.0, Math.min(1.0, wWorldY / wR)));
            let wPhi = Math.atan2(wWorldZ, wWorldX);

            let wTerrainH = getH ? getH(wTheta, wPhi, seed) : 0;
            let wTerrainRad = rad + wTerrainH * hScale;

            let wSurfaceRad = wTerrainRad;
            if (waterEnabled && wTerrainRad < waterRadius) {
                let waveVal = (typeof getWaterWave === "function") ? getWaterWave(wWorldX, wWorldY, wWorldZ, waterAnimTime, waveStrength) : 0;
                let depth = waterRadius - wTerrainRad;
                let fade = Math.min(1.0, Math.max(0.0, depth / 0.1));
                wSurfaceRad = waterRadius + waveVal * fade;
            }
            wHeights.push(wSurfaceRad);

            let dSq = (wo.sOff * wo.sOff) + (wo.fwd * wo.fwd);
            let wheelContactRad = wTerrainRad + wheelRadius;
            let requiredBoatRad = (wheelContactRad * wheelContactRad > dSq)
                ? Math.sqrt(wheelContactRad * wheelContactRad - dSq) - wo.uOff
                : wheelContactRad - wo.uOff;

            if (requiredBoatRad > maxWheelRequiredRadius) {
                maxWheelRequiredRadius = requiredBoatRad;
            }
            reqRadii.push(requiredBoatRad);
        }

        let bR_baseline = baseRadius - 0.04;
        let targetGroundRadius = bR_baseline;
        if (reqRadii.length === 4) {
            let avgWheelReq = (reqRadii[0] + reqRadii[1] + reqRadii[2] + reqRadii[3]) / 4;
            targetGroundRadius = Math.max(bR_baseline, avgWheelReq);
        } else if (maxWheelRequiredRadius > -Infinity) {
            targetGroundRadius = Math.max(targetGroundRadius, maxWheelRequiredRadius);
        }

        let pitchGrade = 0;
        let rollGrade = 0;
        let newNx = nx, newNy = ny, newNz = nz;
        let newF = [bF[0], bF[1], bF[2]];
        let newR = [bR_vec[0], bR_vec[1], bR_vec[2]];

        if (wHeights.length === 4) {
            let fl = wHeights[0], fr = wHeights[1], rl = wHeights[2], rr = wHeights[3];
            let fAvg = (fl + fr) * 0.5;
            let rAvg = (rl + rr) * 0.5;
            let lAvg = (fl + rl) * 0.5;
            let rSideAvg = (fr + rr) * 0.5;

            pitchGrade = (fAvg - rAvg) / (fFwdOff + rFwdOff + 0.001);
            rollGrade  = (rSideAvg - lAvg) / (fSideOff + rSideOff + 0.001);

            pitchGrade = Math.max(-0.5, Math.min(0.5, pitchGrade));
            rollGrade  = Math.max(-0.5, Math.min(0.5, rollGrade));

            let tiltNx = nx - bF[0] * pitchGrade - bR_vec[0] * rollGrade;
            let tiltNy = ny - bF[1] * pitchGrade - bR_vec[1] * rollGrade;
            let tiltNz = nz - bF[2] * pitchGrade - bR_vec[2] * rollGrade;
            let tiltLen = Math.sqrt(tiltNx*tiltNx + tiltNy*tiltNy + tiltNz*tiltNz) || 1;

            newNx = tiltNx / tiltLen;
            newNy = tiltNy / tiltLen;
            newNz = tiltNz / tiltLen;

            let dotFN = bF[0]*newNx + bF[1]*newNy + bF[2]*newNz;
            let alignedF = [bF[0] - newNx*dotFN, bF[1] - newNy*dotFN, bF[2] - newNz*dotFN];
            let fLen = Math.sqrt(alignedF[0]*alignedF[0] + alignedF[1]*alignedF[1] + alignedF[2]*alignedF[2]) || 1;
            newF = [alignedF[0]/fLen, alignedF[1]/fLen, alignedF[2]/fLen];

            newR = [
                newNy*newF[2] - newNz*newF[1],
                newNz*newF[0] - newNx*newF[2],
                newNx*newF[1] - newNy*newF[0]
            ];
        }

        return {
            targetGroundRadius,
            baseRadius,
            centerTerrainRad,
            isInWater,
            pitchGrade,
            rollGrade,
            normal: [newNx, newNy, newNz],
            F: newF,
            R: newR,
            wheelHeights: wHeights
        };
    }
};

window.Physics = Physics;
