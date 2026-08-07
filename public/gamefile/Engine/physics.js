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
    }
};

window.Physics = Physics;
