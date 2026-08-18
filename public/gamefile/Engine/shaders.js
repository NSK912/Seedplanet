// === SEEDPLANET MODULE: JS/SHADERS.JS ===

      // --- Shaders ---
      const modelVertexShaderSource = `
            attribute vec3 aPosition;
            attribute vec3 aColor;
            attribute vec3 aNormal;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uLightSpaceMatrix;
            uniform vec3 uTint;
            uniform float uTime;
            uniform float uSwayFactor;
            uniform float uWaterSwayFactor;
            uniform float uPlanetRadius;
            uniform float uWaterRadius;
            
            varying vec3 vColor;
            varying vec3 vNormal;
            varying vec3 vViewPos;
            varying vec3 vWorldNormal;
            varying vec3 vWorldPos;
            varying vec4 vPositionLightSpace;
            varying float vDist;
            varying float vIsGrass;
            
            void main() {
                vec3 pos = aPosition;
                
                vec3 actualColor = aColor * (length(uTint) > 0.001 ? uTint : vec3(1.0));
                bool isGrass = false;
                float vertexType = 1.0;
                if (aColor.r < 0.0) {
                    isGrass = true;
                    if (aColor.r < -9.0) {
                        actualColor.r = -aColor.r - 10.0;
                        vertexType = 0.0;
                    } else {
                        actualColor.r = -aColor.r;
                        vertexType = 1.0;
                    }
                }
                bool isTree = false;
                bool isTreeLeaf = false;
                float treeSwayWeight = 0.0;
                if (aColor.b < -0.5) {
                    isTree = true;
                    float encoded = -aColor.b;
                    actualColor.b = mod(encoded, 2.0);
                    float rawSway = floor(encoded / 2.0) - 10.0;
                    if (rawSway >= 500.0) {
                        isTreeLeaf = true;
                        rawSway -= 1000.0;
                    }
                    treeSwayWeight = max(0.0, rawSway / 100.0);
                }
                bool isLeaf = isGrass || isTreeLeaf || ((actualColor.g > 0.32) && (abs(actualColor.r - actualColor.g) > 0.05));
                float distToCenter = length(pos);
                bool isSeaweed = (distToCenter < uWaterRadius) && (actualColor.g > 0.35 && actualColor.r < 0.45 && actualColor.b < 0.5);
                
                if ((isLeaf || isTree) && uSwayFactor > 0.0) {
                    float h = distToCenter - uPlanetRadius;
                    
                    if (isGrass || isTree || h > 0.01) {
                        vec3 up = normalize(pos);
                        vec3 tangent = vec3(1.0, 0.0, 0.0);
                        if (abs(up.x) > 0.9) {
                            tangent = vec3(0.0, 1.0, 0.0);
                        }
                        vec3 bitangent = cross(up, tangent);
                        tangent = cross(bitangent, up);

                        if (isTree) {
                            // Very gentle branch/trunk sway. Note that treeSwayWeight is 0.0 for trunks (meaning no sway!)
                            float swayAmount = treeSwayWeight * 0.03 * uSwayFactor;
                            
                            // Slower time scaling for calm, organic motion
                            float windPhase = uTime * 0.45 + (pos.x + pos.y + pos.z) * 0.05;
                            float branchWind = sin(windPhase);

                            // We want a pure linear displacement along a fixed wind direction vector in the tangent plane.
                            // This completely eliminates any circular orbital rotation/spinning around the trunk.
                            vec3 windDir = normalize(tangent * 1.0 + bitangent * 0.3);
                            pos += windDir * branchWind * swayAmount;

                            if (isTreeLeaf) {
                                // Leaf flutter (gentle fluttering, base of leaf is anchored)
                                float leafPhase = uTime * 1.4 + (pos.x + pos.y + pos.z) * 0.1;
                                float leafWind = sin(leafPhase);
                                float lSway = 0.0025 * treeSwayWeight * uSwayFactor; // Very subtle fluttering

                                // Pure linear flutter direction in the tangent plane to prevent spinning
                                vec3 flutterDir = normalize(tangent * -0.3 + bitangent * 1.0);
                                pos += flutterDir * leafWind * lSway;
                            }
                        } else {
                            // Grass sway
                            float swayAmount = isGrass ? (vertexType * 0.15 * uSwayFactor) : (h > 0.2 ? (h - 0.2) * 0.1 * uSwayFactor : 0.0);

                            float windX = sin(uTime * 1.5 + pos.y * 5.0 + pos.x * 2.0);
                            float windZ = cos(uTime * 1.5 + pos.y * 5.0 + pos.z * 2.0);
                            float macroWindX = sin(uTime * 0.15) * 0.5 - 1.5;
                            float macroWindZ = cos(uTime * 0.15) * 0.5 + 1.2;
                            pos.x += (windX * 0.2 + macroWindX * 0.3) * swayAmount;
                            pos.z += (windZ * 0.2 + macroWindZ * 0.3) * swayAmount;
                        }
                    }
                } else if (isSeaweed && uWaterSwayFactor > 0.0) {
                    // Seaweed/Kelp: Sway with fluid water viscosity
                    float h = max(0.0, distToCenter - uPlanetRadius);
                    // Pivot anchor: base doesn't sway, sway increases with height
                    float swayAmount = max(0.0, h - 0.015) * 0.9 * uWaterSwayFactor;
                    
                    // Fluid physics: Slower frequencies & high-density phase shifts (waves)
                    float waterSwayX = sin(uTime * 0.7 + pos.y * 14.0 + pos.x * 5.0);
                    float waterSwayZ = cos(uTime * 0.7 + pos.y * 14.0 + pos.z * 5.0);
                    
                    // Slower background current drift
                    float currentX = sin(uTime * 0.15) * 0.5;
                    float currentZ = cos(uTime * 0.15) * 0.5;
                    
                    pos.x += (waterSwayX * 0.14 + currentX * 0.15) * swayAmount;
                    pos.z += (waterSwayZ * 0.14 + currentZ * 0.15) * swayAmount;
                }
                
                vec4 mvPosition = uModelViewMatrix * vec4(pos, 1.0);
                gl_Position = uProjectionMatrix * mvPosition;
                vColor = actualColor;
                vNormal = mat3(uModelViewMatrix) * aNormal;
                
                if (isGrass) {
                    vWorldNormal = normalize(pos);
                    vIsGrass = 1.0;
                } else {
                    vWorldNormal = aNormal;
                    vIsGrass = 0.0;
                }

                vViewPos = mvPosition.xyz;
                vWorldPos = pos;
                vPositionLightSpace = uLightSpaceMatrix * vec4(pos, 1.0);
                vDist = length(mvPosition.xyz);
            }
        `;

      const modelFragmentShaderSource = `
            precision highp float;
            varying vec3 vColor;
            varying vec3 vNormal;
            varying vec3 vViewPos;
            varying vec3 vWorldNormal;
            varying vec3 vWorldPos;
            varying vec4 vPositionLightSpace;
            varying float vDist;
            varying float vIsGrass;
            uniform vec3 uLightDir;
            uniform sampler2D uShadowMap;
            
            uniform float uRenderDistEnabled;
            uniform float uMaxRenderDist;
            
            uniform float uWaterRadius;
            uniform vec3 uWaterColor;
            uniform float uWaterOpacity;
            uniform sampler2D uWaterMaskTex;
            uniform vec3 uCameraPos;
            uniform float uTime;
            uniform float uShadowsEnabled;
            uniform vec2 uShadowTexelSize;

            float calculateShadow(vec4 lightSpacePos, vec3 normal, vec3 lightDir) {
                if (uShadowsEnabled < 0.5) return 1.0;
                vec3 projCoords = lightSpacePos.xyz / lightSpacePos.w;
                projCoords = projCoords * 0.5 + 0.5;
                
                if (projCoords.z > 1.0 || projCoords.z < 0.0) return 1.0;
                if (projCoords.x < 0.0 || projCoords.x > 1.0 || projCoords.y < 0.0 || projCoords.y > 1.0) return 1.0;

                float currentDepth = projCoords.z;
                float cosTheta = clamp(dot(normal, lightDir), 0.0, 1.0);
                float slope = sqrt(max(0.0, 1.0 - cosTheta * cosTheta)) / max(cosTheta, 0.05);
                float bias = clamp(0.0005 + 0.0012 * slope, 0.0005, 0.0022);
                
                vec2 texelSize = (uShadowTexelSize.x > 0.0) ? uShadowTexelSize : vec2(1.0 / 1024.0);
                float shadow = 0.0;

                for (int x = -1; x <= 1; x++) {
                    for (int y = -1; y <= 1; y++) {
                        float pcfDepth = texture2D(uShadowMap, projCoords.xy + vec2(float(x), float(y)) * texelSize).r;
                        shadow += (currentDepth - bias) > pcfDepth ? 0.0 : 1.0;
                    }
                }
                shadow /= 9.0;

                float distFromCenter = length(projCoords.xy - vec2(0.5));
                float edgeFade = 1.0 - smoothstep(0.36, 0.49, distFromCenter);

                return mix(1.0, shadow, edgeFade);
            }

            void main() {
                if (uRenderDistEnabled > 0.5 && vDist > uMaxRenderDist) {
                    discard;
                }
                vec3 normal = normalize(vWorldNormal);
                vec3 lightDir = normalize(uLightDir);
                
                // Diffuse
                float diffuseVal = max(dot(normal, lightDir), 0.0);
                
                // Shadow
                float shadow = calculateShadow(vPositionLightSpace, normalize(vWorldNormal), normalize(uLightDir));
                if (diffuseVal <= 0.0) {
                    shadow = 0.0;
                }
                float lit = mix(0.3, 1.0, shadow);
                float diffuse = diffuseVal * lit * 0.8 + 0.2;
                
                // Specular
                vec3 viewDir = normalize(uCameraPos - vWorldPos);
                vec3 halfDir = normalize(lightDir + viewDir);
                float spec = pow(max(dot(normal, halfDir), 0.0), 16.0) * 0.25 * shadow;
                
                // Fresnel
                float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0) * 0.15;
                
                vec3 finalColor = vColor * diffuse + vec3(1.0) * spec + vec3(0.95, 0.97, 1.0) * fresnel;
                 if (vIsGrass > 0.5) {
                     // Grass is slightly brighter and doesn't get fully shadowed to stand out
                     finalColor = vColor * diffuseVal * 1.2 + vec3(0.1, 0.2, 0.05);
                 }

                // Apply Water Volume Tint & Fog
                float dist = length(vWorldPos);
                if (dist < uWaterRadius) {
                    float depth = uWaterRadius - dist;
                    float tintFactor = 1.0 - exp(-depth * 5.0);
                    tintFactor = clamp(tintFactor * uWaterOpacity, 0.0, 0.85);
                    finalColor = mix(finalColor, uWaterColor, tintFactor);
                }

                float glassAlpha = 1.0;
                bool isGlass = (abs(vColor.r - 0.6) < 0.01 && abs(vColor.g - 0.8) < 0.01 && abs(vColor.b - 1.0) < 0.01);
                if (isGlass) {
                    // Base opacity of the glass is low (translucent), but increases at grazing/Fresnel angles
                    glassAlpha = mix(0.35, 0.75, fresnel);

                    // Proximity factor to only show strong reflections when close to the window
                    // Extended distance range (from 15.0m to 1.0m) so reflection is beautiful at normal play distance
                    float reflectionProximity = smoothstep(15.0, 1.0, vDist);

                    // Compute world-space reflection ray
                    vec3 viewDirWorld = normalize(vWorldPos - uCameraPos);
                    vec3 normalWorld = normalize(vWorldNormal);
                    vec3 reflVecWorld = reflect(viewDirWorld, normalWorld);

                    // local coordinate frame for the window pane
                    vec3 localUp = normalize(vWorldPos); // Radially outward from planet center
                    vec3 localTangent = normalize(cross(localUp, normalWorld));

                    // Project reflection ray onto the local frame
                    float reflUp = dot(reflVecWorld, localUp);
                    float reflTangent = dot(reflVecWorld, localTangent);
                    float reflNormal = dot(reflVecWorld, normalWorld);

                    vec3 reflectedColor = vec3(0.0);

                    // 1. SKY / ATMOSPHERE REFLECTION (Upwards direction)
                    vec3 skyColor = mix(vec3(0.12, 0.18, 0.35), vec3(0.55, 0.75, 1.0), max(0.0, dot(reflVecWorld, lightDir)) * 0.4 + 0.6);
                    // Add soft clouds
                    float cloudPattern = sin(reflVecWorld.x * 3.5 + uTime * 0.05) * cos(reflVecWorld.z * 3.5 + uTime * 0.04) * 0.5 + 0.5;
                    if (cloudPattern > 0.58) {
                        skyColor = mix(skyColor, vec3(0.96, 0.98, 1.0), (cloudPattern - 0.58) * 1.6);
                    }

                    // 2. GROUND / TERRAIN / WATER REFLECTION (Downwards direction)
                    vec3 groundColor = vec3(0.48, 0.32, 0.18); // Wood floor / earth brown
                    // Check if it's below water level (ocean reflection)
                    float reflectDistToCenter = length(vWorldPos + reflVecWorld * 2.0);
                    if (reflectDistToCenter < uWaterRadius) {
                        groundColor = mix(groundColor, vec3(0.12, 0.48, 0.58), 0.85); // Beautiful turquoise water reflection
                    } else {
                        // Procedural wood/grass tiles on ground reflection
                        float grassTile = sin(vWorldPos.x * 2.0 + reflVecWorld.x * 4.0) * cos(vWorldPos.z * 2.0 + reflVecWorld.z * 4.0);
                        if (grassTile > 0.1) {
                            groundColor = mix(groundColor, vec3(0.28, 0.46, 0.16), 0.75); // Grass/tree reflection
                        }
                    }

                    // 3. ADJACENT WOOD WALLS / COLUMNS / WINDOW FRAMES (Horizontal sides)
                    // We project virtual adjacent walls at regular intervals along the wall direction
                    float wallU = reflTangent / (abs(reflNormal) + 0.01);
                    float wallV = reflUp / (abs(reflNormal) + 0.01);

                    // Wooden walls have vertical planks (wood panels) and horizontal joints
                    float verticalPlanks = step(0.88, abs(sin(wallU * 6.28)));
                    float horizontalPlanks = step(0.93, abs(sin(wallV * 3.14)));
                    
                    // Dark brown wood structure reflection
                    vec3 structureColor = mix(vec3(0.38, 0.22, 0.12), vec3(0.20, 0.11, 0.06), max(verticalPlanks, horizontalPlanks));
                    
                    // Add some natural green wood moss / forest reflection spots
                    float leafSpots = sin(wallU * 1.5 + wallV * 2.0) * cos(wallV * 1.2 - wallU * 0.8);
                    if (leafSpots > 0.4) {
                        structureColor = mix(structureColor, vec3(0.18, 0.38, 0.12), 0.65); // Surrounding leaves / bushes
                    }

                    // Blend different components based on reflection ray angles
                    if (reflUp >= 0.0) {
                        // Upper half: blend sky with adjacent walls
                        float skyFactor = smoothstep(0.0, 0.4, reflUp);
                        reflectedColor = mix(structureColor, skyColor, skyFactor);
                    } else {
                        // Lower half: blend ground/water with structures
                        float groundFactor = smoothstep(0.0, -0.4, reflUp);
                        reflectedColor = mix(structureColor, groundColor, groundFactor);
                    }

                    // Soft specular glow on the reflection
                    reflectedColor += vec3(1.0, 1.0, 1.0) * spec * 0.5;

                    // Blend final color with reflection based on proximity and Fresnel angle
                    finalColor = mix(finalColor, reflectedColor, reflectionProximity * (0.50 + 0.45 * fresnel));

                    // Boost specular glare when standing close (reflection highlight)
                    finalColor += vec3(1.0, 1.0, 1.0) * spec * (1.2 + 2.8 * reflectionProximity);

                    // Add a gorgeous stylized diagonal reflection shine/stripe
                    float diagLine = fract((vWorldPos.x + vWorldPos.y + vWorldPos.z) * 6.0);
                    float shineStripe = smoothstep(0.85, 0.92, diagLine) * smoothstep(0.99, 0.92, diagLine);
                    finalColor += vec3(1.0, 1.0, 1.0) * shineStripe * 0.38;
                }

                // Atmospheric Fog / Mist at Terrain Max Render Distance
                if (uRenderDistEnabled > 0.5) {
                    float fogStart = uMaxRenderDist * 0.55;
                    float fogFactor = smoothstep(fogStart, uMaxRenderDist, vDist);
                    vec3 fogDir = normalize(vWorldPos - uCameraPos);
                    float sunDot = max(dot(fogDir, lightDir), 0.0);
                    vec3 baseSkyFog = vec3(0.012, 0.035, 0.09);
                    vec3 litSkyFog = vec3(0.08, 0.14, 0.24);
                    vec3 atmosphericFog = mix(baseSkyFog, litSkyFog, sunDot * 0.5 + 0.1);
                    if (length(uCameraPos) < uWaterRadius || dist < uWaterRadius) {
                        atmosphericFog = mix(atmosphericFog, uWaterColor * 0.6, 0.85);
                    }
                    finalColor = mix(finalColor, atmosphericFog, fogFactor * 0.98);
                }

                gl_FragColor = vec4(finalColor, glassAlpha);
            }
        `;

      const depthVertexShaderSource = `
            attribute vec3 aPosition;
            attribute vec3 aColor;
            uniform mat4 uModelMatrix;
            uniform mat4 uLightSpaceMatrix;
            uniform float uTime;
            uniform float uSwayFactor;
            uniform float uWaterSwayFactor;
            uniform float uPlanetRadius;
            uniform float uWaterRadius;
            void main() {
                if (length(aPosition) < 0.01) {
                    gl_Position = vec4(9999.0, 9999.0, 9999.0, 1.0);
                    return;
                }
                vec3 pos = aPosition;
                
                vec3 actualColor = aColor;
                bool isGrass = false;
                float vertexType = 1.0;
                if (aColor.r < 0.0) {
                    isGrass = true;
                    if (aColor.r < -9.0) {
                        actualColor.r = -aColor.r - 10.0;
                        vertexType = 0.0;
                    } else {
                        actualColor.r = -aColor.r;
                        vertexType = 1.0;
                    }
                }
                bool isTree = false;
                bool isTreeLeaf = false;
                float treeSwayWeight = 0.0;
                if (aColor.b < -0.5) {
                    isTree = true;
                    float encoded = -aColor.b;
                    actualColor.b = mod(encoded, 2.0);
                    float rawSway = floor(encoded / 2.0) - 10.0;
                    if (rawSway >= 500.0) {
                        isTreeLeaf = true;
                        rawSway -= 1000.0;
                    }
                    treeSwayWeight = max(0.0, rawSway / 100.0);
                }
                bool isLeaf = isGrass || isTreeLeaf || ((actualColor.g > 0.32) && (abs(actualColor.r - actualColor.g) > 0.05));
                float distToCenter = length(pos);
                bool isSeaweed = (distToCenter < uWaterRadius) && (actualColor.g > 0.35 && actualColor.r < 0.45 && actualColor.b < 0.5);
                
                if ((isLeaf || isTree) && uSwayFactor > 0.0) {
                    float h = distToCenter - uPlanetRadius;
                    
                    if (isGrass || isTree || h > 0.01) {
                        vec3 up = normalize(pos);
                        vec3 tangent = vec3(1.0, 0.0, 0.0);
                        if (abs(up.x) > 0.9) {
                            tangent = vec3(0.0, 1.0, 0.0);
                        }
                        vec3 bitangent = cross(up, tangent);
                        tangent = cross(bitangent, up);

                        if (isTree) {
                            // Very gentle branch/trunk sway. Note that treeSwayWeight is 0.0 for trunks (meaning no sway!)
                            float swayAmount = treeSwayWeight * 0.03 * uSwayFactor;
                            
                            // Slower time scaling for calm, organic motion
                            float windPhase = uTime * 0.45 + (pos.x + pos.y + pos.z) * 0.05;
                            float branchWind = sin(windPhase);

                            // We want a pure linear displacement along a fixed wind direction vector in the tangent plane.
                            // This completely eliminates any circular orbital rotation/spinning around the trunk.
                            vec3 windDir = normalize(tangent * 1.0 + bitangent * 0.3);
                            pos += windDir * branchWind * swayAmount;

                            if (isTreeLeaf) {
                                // Leaf flutter (gentle fluttering, base of leaf is anchored)
                                float leafPhase = uTime * 1.4 + (pos.x + pos.y + pos.z) * 0.1;
                                float leafWind = sin(leafPhase);
                                float lSway = 0.0025 * treeSwayWeight * uSwayFactor; // Very subtle fluttering

                                // Pure linear flutter direction in the tangent plane to prevent spinning
                                vec3 flutterDir = normalize(tangent * -0.3 + bitangent * 1.0);
                                pos += flutterDir * leafWind * lSway;
                            }
                        } else {
                            // Grass sway
                            float swayAmount = isGrass ? (vertexType * 0.15 * uSwayFactor) : (h > 0.2 ? (h - 0.2) * 0.1 * uSwayFactor : 0.0);

                            float windX = sin(uTime * 1.5 + pos.y * 5.0 + pos.x * 2.0);
                            float windZ = cos(uTime * 1.5 + pos.y * 5.0 + pos.z * 2.0);
                            float macroWindX = sin(uTime * 0.15) * 0.5 - 1.5;
                            float macroWindZ = cos(uTime * 0.15) * 0.5 + 1.2;
                            pos.x += (windX * 0.2 + macroWindX * 0.3) * swayAmount;
                            pos.z += (windZ * 0.2 + macroWindZ * 0.3) * swayAmount;
                        }
                    }
                } else if (isSeaweed && uWaterSwayFactor > 0.0) {
                    // Seaweed/Kelp: Sway with fluid water viscosity
                    float h = max(0.0, distToCenter - uPlanetRadius);
                    float swayAmount = max(0.0, h - 0.015) * 0.9 * uWaterSwayFactor;
                    
                    float waterSwayX = sin(uTime * 0.7 + pos.y * 14.0 + pos.x * 5.0);
                    float waterSwayZ = cos(uTime * 0.7 + pos.y * 14.0 + pos.z * 5.0);
                    
                    float currentX = sin(uTime * 0.15) * 0.5;
                    float currentZ = cos(uTime * 0.15) * 0.5;
                    
                    pos.x += (waterSwayX * 0.14 + currentX * 0.15) * swayAmount;
                    pos.z += (waterSwayZ * 0.14 + currentZ * 0.15) * swayAmount;
                }
                gl_Position = uLightSpaceMatrix * uModelMatrix * vec4(pos, 1.0);
            }
        `;

      const depthFragmentShaderSource = `
            precision highp float;
            void main() {
                gl_FragColor = vec4(gl_FragCoord.z, gl_FragCoord.z, gl_FragCoord.z, 1.0);
            }
        `;

      const vertexShaderSource = `
            attribute vec3 aPosition;
            attribute vec3 aColor;
            attribute float aTerrainRadius;
            attribute vec3 aTunnelCenter;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uLightSpaceMatrix;
            varying vec3 vColor;
            varying vec3 vNormal;
            varying vec3 vWorldPos;
            varying vec4 vPositionLightSpace;
            varying float vDist;
            varying float vTerrainRadius;
            varying vec3 vTunnelCenter;
            
            void main() {
                if (length(aPosition) < 0.01) {
                    gl_Position = vec4(9999.0, 9999.0, 9999.0, 1.0);
                    return;
                }
                vec4 mvPosition = uModelViewMatrix * vec4(aPosition, 1.0);
                gl_Position = uProjectionMatrix * mvPosition;
                vColor = aColor;
                vNormal = normalize(aPosition);
                vWorldPos = aPosition;
                vPositionLightSpace = uLightSpaceMatrix * vec4(aPosition, 1.0);
                vDist = length(mvPosition.xyz);
                vTerrainRadius = aTerrainRadius;
                vTunnelCenter = aTunnelCenter;
            }
        `;

      const fragmentShaderSource = `
            precision highp float;
            varying vec3 vColor;
            varying vec3 vNormal;
            varying vec3 vWorldPos;
            varying vec4 vPositionLightSpace;
            varying float vDist;
            varying float vTerrainRadius;
            varying vec3 vTunnelCenter;
            uniform vec3 uLightDir;
            uniform float uUseLighting;
            uniform sampler2D uShadowMap;
            
            uniform float uRenderDistEnabled;
            uniform float uMaxRenderDist;
            
            uniform float uWaterRadius;
            uniform vec3 uWaterColor;
            uniform float uWaterOpacity;
            uniform sampler2D uWaterMaskTex;
            uniform vec3 uCameraPos;

            // Tunnel parameters
            uniform vec4 uTunnels[64];
            uniform int uTunnelCount;
            uniform float uIsTunnelMesh;
            uniform float uShadowsEnabled;
            uniform vec2 uShadowTexelSize;

            float calculateShadow(vec4 lightSpacePos, vec3 normal, vec3 lightDir) {
                if (uShadowsEnabled < 0.5) return 1.0;
                vec3 projCoords = lightSpacePos.xyz / lightSpacePos.w;
                projCoords = projCoords * 0.5 + 0.5;
                
                if (projCoords.z > 1.0 || projCoords.z < 0.0) return 1.0;
                if (projCoords.x < 0.0 || projCoords.x > 1.0 || projCoords.y < 0.0 || projCoords.y > 1.0) return 1.0;

                float currentDepth = projCoords.z;
                float cosTheta = clamp(dot(normal, lightDir), 0.0, 1.0);
                float slope = sqrt(max(0.0, 1.0 - cosTheta * cosTheta)) / max(cosTheta, 0.05);
                float bias = clamp(0.0005 + 0.0012 * slope, 0.0005, 0.0022);
                
                vec2 texelSize = (uShadowTexelSize.x > 0.0) ? uShadowTexelSize : vec2(1.0 / 1024.0);
                float shadow = 0.0;

                for (int x = -1; x <= 1; x++) {
                    for (int y = -1; y <= 1; y++) {
                        float pcfDepth = texture2D(uShadowMap, projCoords.xy + vec2(float(x), float(y)) * texelSize).r;
                        shadow += (currentDepth - bias) > pcfDepth ? 0.0 : 1.0;
                    }
                }
                shadow /= 9.0;

                float distFromCenter = length(projCoords.xy - vec2(0.5));
                float edgeFade = 1.0 - smoothstep(0.36, 0.49, distFromCenter);

                return mix(1.0, shadow, edgeFade);
            }

            void main() {
                // Hole cutting or cave clipping
                if (uIsTunnelMesh > 0.5) {
                    float distToCenter = length(vWorldPos);
                    float actualTerrainRadius = abs(vTerrainRadius);
                    bool isCollar = vTerrainRadius < 0.0;
                    
                    // Discard only the clamped flat roof of the cave sphere (which is exactly at actualTerrainRadius)
                    if (!isCollar && distToCenter > actualTerrainRadius - 0.02) {
                        discard;
                    }
                    // If overlapping with another tunnel, discard the inner wall so tunnels connect smoothly
                    for (int i = 0; i < 64; i++) {
                        if (i < uTunnelCount) {
                            vec4 t = uTunnels[i];
                            // Skip the owner tunnel sphere of this vertex
                            if (length(t.xyz - vTunnelCenter) < 0.05) continue;
                            vec3 diff = vWorldPos - t.xyz;
                            if (dot(diff, diff) < (t.w * 0.94) * (t.w * 0.94)) {
                                discard;
                            }
                        }
                    }
                } else {
                    for (int i = 0; i < 64; i++) {
                        if (i < uTunnelCount) {
                            vec4 t = uTunnels[i];
                            vec3 diff = vWorldPos - t.xyz;
                            if (dot(diff, diff) < (t.w * 0.96) * (t.w * 0.96)) {
                                discard;
                            }
                        }
                    }
                }

                if (uRenderDistEnabled > 0.5 && vDist > uMaxRenderDist) {
                    discard;
                }
                vec3 finalColor;
                if (uUseLighting > 0.5) {
                    vec3 normal = normalize(vNormal);
                    vec3 lightDir = normalize(uLightDir);
                    float diffuseVal = max(dot(normal, lightDir), 0.0);
                    
                    // Shadow
                    float shadow = calculateShadow(vPositionLightSpace, normal, lightDir);
                    if (diffuseVal <= 0.0) {
                        shadow = 0.0;
                    }
                    float lit = mix(0.3, 1.0, shadow);
                    float diffuse = diffuseVal * lit * 0.8 + 0.2;
                    finalColor = vColor * diffuse;
                } else {
                    finalColor = vColor;
                }

                // Apply Water Volume Tint & Fog
                float dist = length(vWorldPos);
                if (dist < uWaterRadius) {
                    float depth = uWaterRadius - dist;
                    float tintFactor = 1.0 - exp(-depth * 5.0);
                    tintFactor = clamp(tintFactor * uWaterOpacity, 0.0, 0.85);
                    finalColor = mix(finalColor, uWaterColor, tintFactor);
                }

                // Atmospheric Fog / Mist at Object Max Render Distance
                if (uRenderDistEnabled > 0.5) {
                    float fogStart = uMaxRenderDist * 0.60;
                    float fogFactor = smoothstep(fogStart, uMaxRenderDist, vDist);
                    vec3 fogDir = normalize(vWorldPos - uCameraPos);
                    vec3 lightDir = normalize(uLightDir);
                    float sunDot = max(dot(fogDir, lightDir), 0.0);
                    vec3 baseSkyFog = vec3(0.012, 0.035, 0.09);
                    vec3 litSkyFog = vec3(0.08, 0.14, 0.24);
                    vec3 atmosphericFog = mix(baseSkyFog, litSkyFog, sunDot * 0.5 + 0.1);
                    if (length(uCameraPos) < uWaterRadius || dist < uWaterRadius) {
                        atmosphericFog = mix(atmosphericFog, uWaterColor * 0.6, 0.85);
                    }
                    finalColor = mix(finalColor, atmosphericFog, fogFactor * 0.98);
                }

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

      const characterVertexShaderSource = `
            attribute vec3 aPosition;
            attribute vec3 aLocalPos;
            attribute vec3 aNormal;
            attribute vec3 aColor;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uModelMatrix;
            uniform mat4 uLightSpaceMatrix;
            varying vec3 vPosition;
            varying vec3 vNormal;
            varying vec3 vLocalPos;
            varying vec3 vWorldNormal;
            varying vec3 vWorldPos;
            varying vec4 vPositionLightSpace;
            varying vec3 vColor;
            void main() {
                vec4 mvPosition = uModelViewMatrix * vec4(aPosition, 1.0);
                gl_Position = uProjectionMatrix * mvPosition;
                vPosition = mvPosition.xyz;
                vNormal = mat3(uModelViewMatrix) * aNormal;
                vLocalPos = aLocalPos;
                vColor = aColor;
                
                vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
                vWorldNormal = normalize(mat3(uModelMatrix) * aNormal);
                vWorldPos = worldPos.xyz;
                vPositionLightSpace = uLightSpaceMatrix * worldPos;
                            }
        `;

      const characterFragmentShaderSource = `
            precision highp float;
            varying vec3 vPosition;
            varying vec3 vNormal;
            varying vec3 vLocalPos;
            varying vec3 vWorldNormal;
            varying vec3 vWorldPos;
            varying vec4 vPositionLightSpace;
            varying vec3 vColor;
            uniform vec3 uLightDir;
            uniform vec3 uCameraPos;
            uniform sampler2D uShadowMap;
            
            uniform float uWaterRadius;
            uniform vec3 uWaterColor;
            uniform float uWaterOpacity;
            uniform sampler2D uWaterMaskTex;
            uniform float uShadowsEnabled;
            uniform vec2 uShadowTexelSize;

            float distToSegment(vec2 p, vec2 a, vec2 b) {
                vec2 pa = p - a, ba = b - a;
                float h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
                return length(pa - ba*h);
            }

            float calculateShadow(vec4 lightSpacePos, vec3 normal, vec3 lightDir) {
                if (uShadowsEnabled < 0.5) return 1.0;
                vec3 projCoords = lightSpacePos.xyz / lightSpacePos.w;
                projCoords = projCoords * 0.5 + 0.5;
                
                if (projCoords.z > 1.0 || projCoords.z < 0.0) return 1.0;
                if (projCoords.x < 0.0 || projCoords.x > 1.0 || projCoords.y < 0.0 || projCoords.y > 1.0) return 1.0;

                float currentDepth = projCoords.z;
                float cosTheta = clamp(dot(normal, lightDir), 0.0, 1.0);
                float slope = sqrt(max(0.0, 1.0 - cosTheta * cosTheta)) / max(cosTheta, 0.05);
                float bias = clamp(0.0005 + 0.0012 * slope, 0.0005, 0.0022);
                
                vec2 texelSize = (uShadowTexelSize.x > 0.0) ? uShadowTexelSize : vec2(1.0 / 1024.0);
                float shadow = 0.0;

                for (int x = -1; x <= 1; x++) {
                    for (int y = -1; y <= 1; y++) {
                        float pcfDepth = texture2D(uShadowMap, projCoords.xy + vec2(float(x), float(y)) * texelSize).r;
                        shadow += (currentDepth - bias) > pcfDepth ? 0.0 : 1.0;
                    }
                }
                shadow /= 9.0;

                float distFromCenter = length(projCoords.xy - vec2(0.5));
                float edgeFade = 1.0 - smoothstep(0.36, 0.49, distFromCenter);

                return mix(1.0, shadow, edgeFade);
            }

            void main() {
                vec3 normal = normalize(vWorldNormal);
                vec3 viewDir = normalize(uCameraPos - vWorldPos);
                vec3 lightDir = normalize(uLightDir);
                
                float diffuseVal = max(dot(normal, lightDir), 0.0);
                
                // Shadow
                float shadow = calculateShadow(vPositionLightSpace, normalize(vWorldNormal), normalize(uLightDir));
                if (diffuseVal <= 0.0) {
                    shadow = 0.0;
                }
                float lit = mix(0.3, 1.0, shadow);
                float diffuse = diffuseVal * lit * 0.75 + 0.25;
                
                vec3 halfDir = normalize(lightDir + viewDir);
                float spec = pow(max(dot(normal, halfDir), 0.0), 38.0) * 0.75 * shadow;
                
                float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0) * 0.25;
                
                vec3 baseColor = vColor;

                if (vLocalPos.y > 0.22 && vLocalPos.y < 0.67 && vLocalPos.z > 0.04 && vLocalPos.z < 0.28) {
                    vec2 uv = vec2(vLocalPos.x, vLocalPos.y - 0.43) / 0.24;
                    
                    // --- 1. Rosy ChiBi Blush Cheeks ---
                    float dLeftCheek = length(vec2(uv.x - (-0.38), (uv.y - (-0.18)) * 1.3));
                    float dRightCheek = length(vec2(uv.x - 0.38, (uv.y - (-0.18)) * 1.3));
                    float sCheeks = max(smoothstep(0.14, 0.02, dLeftCheek), smoothstep(0.14, 0.02, dRightCheek)) * 0.55;
                    vec3 cheekColor = vec3(1.0, 0.52, 0.60);
                    
                    // --- 2. Large Anime Chibi Eyes ---
                    vec2 leftEyeUv = vec2(uv.x - (-0.23), (uv.y - 0.01) * 0.75);
                    vec2 rightEyeUv = vec2(uv.x - 0.23, (uv.y - 0.01) * 0.75);
                    float dLeftEye = length(leftEyeUv);
                    float dRightEye = length(rightEyeUv);
                    
                    // Sclera / Eye White
                    float eyeRadius = 0.125;
                    float sEyeWhite = max(smoothstep(eyeRadius, eyeRadius - 0.015, dLeftEye),
                                          smoothstep(eyeRadius, eyeRadius - 0.015, dRightEye));
                    
                    // Large Warm Amber Gradient Iris
                    float dLeftIris = length(vec2(leftEyeUv.x, leftEyeUv.y * 0.88));
                    float dRightIris = length(vec2(rightEyeUv.x, rightEyeUv.y * 0.88));
                    float irisRadius = 0.098;
                    float sIris = max(smoothstep(irisRadius, irisRadius - 0.015, dLeftIris),
                                      smoothstep(irisRadius, irisRadius - 0.015, dRightIris));
                    
                    float irisY = clamp((uv.y - 0.01) / 0.12, -1.0, 1.0);
                    vec3 irisColor = mix(vec3(0.85, 0.52, 0.18), vec3(0.24, 0.11, 0.05), irisY * 0.5 + 0.5);
                    
                    // Dark Pupil
                    float dLeftPupil = length(vec2(leftEyeUv.x, leftEyeUv.y - 0.01));
                    float dRightPupil = length(vec2(rightEyeUv.x, rightEyeUv.y - 0.01));
                    float sPupil = max(smoothstep(0.045, 0.028, dLeftPupil),
                                       smoothstep(0.045, 0.028, dRightPupil));
                    vec3 pupilColor = vec3(0.08, 0.04, 0.02);
                    
                    // Dual Glossy White Sparkle Catchlights
                    float dLeftH1 = length(leftEyeUv - vec2(-0.038, 0.038));
                    float dRightH1 = length(rightEyeUv - vec2(-0.038, 0.038));
                    float sH1 = max(smoothstep(0.035, 0.018, dLeftH1),
                                    smoothstep(0.035, 0.018, dRightH1));
                                    
                    float dLeftH2 = length(leftEyeUv - vec2(0.032, -0.038));
                    float dRightH2 = length(rightEyeUv - vec2(0.032, -0.038));
                    float sH2 = max(smoothstep(0.020, 0.008, dLeftH2),
                                    smoothstep(0.020, 0.008, dRightH2));
                                    
                    // Eyelashes & Eyeliner
                    float dLeftLash = distToSegment(uv, vec2(-0.35, 0.08), vec2(-0.11, 0.13));
                    float dRightLash = distToSegment(uv, vec2(0.11, 0.13), vec2(0.35, 0.08));
                    float sEyelash = max(smoothstep(0.032, 0.010, dLeftLash),
                                         smoothstep(0.032, 0.010, dRightLash));
                    
                    // --- 3. Anime Eyebrows ---
                    float dLeftBrow = distToSegment(uv, vec2(-0.32, 0.18), vec2(-0.14, 0.22));
                    float dRightBrow = distToSegment(uv, vec2(0.14, 0.22), vec2(0.32, 0.18));
                    float sEyebrow = max(smoothstep(0.020, 0.006, dLeftBrow),
                                         smoothstep(0.020, 0.006, dRightBrow));
                    vec3 browColor = vec3(0.32, 0.18, 0.10);
                    
                    // --- 4. Cute Open Chibi Mouth ---
                    vec2 mouthUv = vec2(uv.x, (uv.y - (-0.17)) * 1.3);
                    float dMouthOpen = length(vec2(mouthUv.x, max(0.0, mouthUv.y)));
                    float sMouthOutline = smoothstep(0.060, 0.042, dMouthOpen) * step(-0.035, mouthUv.y);
                    float sMouthInner = smoothstep(0.042, 0.028, dMouthOpen) * step(-0.025, mouthUv.y);
                    
                    float dTongue = length(vec2(mouthUv.x, mouthUv.y - (-0.015)));
                    float sTongue = smoothstep(0.032, 0.015, dTongue) * sMouthInner;
                    
                    vec3 mouthBorderColor = vec3(0.22, 0.08, 0.08);
                    vec3 mouthInnerColor = vec3(0.88, 0.32, 0.38);
                    vec3 tongueColor = vec3(0.98, 0.58, 0.65);
                    
                    // Apply Face Composite Layers
                    baseColor = mix(baseColor, cheekColor, sCheeks);
                    
                    if (sEyeWhite > 0.01) {
                        vec3 eyeCol = vec3(0.98, 0.98, 0.98);
                        eyeCol = mix(eyeCol, irisColor, sIris);
                        eyeCol = mix(eyeCol, pupilColor, sPupil);
                        eyeCol = mix(eyeCol, vec3(1.0), max(sH1, sH2));
                        baseColor = mix(baseColor, eyeCol, sEyeWhite);
                    }
                    
                    baseColor = mix(baseColor, vec3(0.15, 0.10, 0.08), sEyelash);
                    baseColor = mix(baseColor, browColor, sEyebrow);
                    
                    if (sMouthOutline > 0.01) {
                        vec3 mCol = mix(mouthBorderColor, mouthInnerColor, clamp(sMouthInner / max(0.001, sMouthOutline), 0.0, 1.0));
                        mCol = mix(mCol, tongueColor, sTongue);
                        baseColor = mix(baseColor, mCol, sMouthOutline);
                    }
                }
                vec3 finalColor = baseColor * diffuse + vec3(1.0) * spec + vec3(0.92, 0.95, 1.0) * fresnel;

                // Apply Water Volume Tint & Fog
                float dist = length(vWorldPos);
                if (dist < uWaterRadius) {
                    float depth = uWaterRadius - dist;
                    float tintFactor = 1.0 - exp(-depth * 5.0);
                    tintFactor = clamp(tintFactor * uWaterOpacity, 0.0, 0.85);
                    finalColor = mix(finalColor, uWaterColor, tintFactor);
                }

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

      const atmosphereVertexShaderSource = `
            attribute vec3 aPosition;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
                gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
                vNormal = normalize(aPosition);
                vPosition = aPosition;
            }
        `;

      const atmosphereFragmentShaderSource = `
            precision highp float;
            varying vec3 vNormal;
            varying vec3 vPosition;
            uniform vec3 uColor;
            uniform float uAlpha;
            uniform vec3 uLightDir;
            uniform vec3 uCameraPos;
            void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(uCameraPos - vPosition);
                vec3 lightDir = normalize(uLightDir);
                
                float cosTheta = dot(normal, viewDir);
                float fresnel = 1.0 - abs(cosTheta);
                
                float rim;
                if (cosTheta < 0.0) {
                    // CAMERA IS INSIDE: Beautiful ambient sky looking from inside out
                    rim = mix(0.42, 1.0, fresnel);
                } else {
                    // CAMERA IS OUTSIDE: Standard glowing rim that fades to 0 smoothly at the very edge to prevent sharp outlines
                    rim = pow(fresnel, 3.5) * smoothstep(0.0, 0.20, cosTheta);
                }
                
                // Sunlight influence
                float lightInfluence = dot(normal, lightDir);
                float intensity = smoothstep(-0.4, 0.4, lightInfluence);
                
                // Allow ambient scattering glow even on the shadow/night side
                float finalAlpha = rim * uAlpha * (0.15 + 0.85 * intensity);
                
                gl_FragColor = vec4(uColor, finalAlpha);
            }
        `;

      
      // --- Clouds 3D Shaders ---
      window.cloud3DVertexShaderSource = `
            attribute vec3 aPosition;
            attribute vec3 aLocalPos;

            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uCloudOrbitMatrix;
            uniform float uAnimTime;

            varying vec3 vWorldPos;
            varying vec3 vLocalPos;

            // Procedural sine/cosine noise for organic cloud puff animation
            float puffNoise(vec3 p, float t) {
                return sin(p.x * 0.8 + t * 1.5) * cos(p.y * 1.1 + t * 1.2) * sin(p.z * 0.9 + t * 1.7);
            }

            void main() {
                vLocalPos = aLocalPos;
                
                // Animated swelling & puffing morphing on cloud geometry
                vec3 animatedPos = aPosition;
                vec3 normLocal = length(aLocalPos) > 0.001 ? normalize(aLocalPos) : vec3(0.0, 1.0, 0.0);
                float puff = puffNoise(aPosition * 0.5, uAnimTime) * 0.35;
                animatedPos += normLocal * puff;

                // Apply orbital rotation around planet
                vec4 rotatedPos = uCloudOrbitMatrix * vec4(animatedPos, 1.0);
                
                vWorldPos = rotatedPos.xyz;
                gl_Position = uProjectionMatrix * uModelViewMatrix * rotatedPos;
            }
      `;

      window.cloud3DFragmentShaderSource = `
            precision highp float;
            varying vec3 vWorldPos;
            varying vec3 vLocalPos;

            uniform vec3 uColor;
            uniform float uAlpha;
            uniform float uTime;
            uniform vec3 uLightDir;
            uniform vec3 uCameraPos;
            uniform float uWaterRadius;
            
            float hash(vec3 p) {
                p = fract(p * vec3(443.897, 441.423, 437.195));
                p += dot(p, p.yzx + 19.19);
                return fract((p.x + p.y) * p.z);
            }
            float noise(vec3 x) {
                vec3 p = floor(x);
                vec3 f = fract(x);
                f = f*f*(3.0-2.0*f);
                return mix(mix(mix(hash(p+vec3(0,0,0)), hash(p+vec3(1,0,0)), f.x),
                               mix(hash(p+vec3(0,1,0)), hash(p+vec3(1,1,0)), f.x), f.y),
                           mix(mix(hash(p+vec3(0,0,1)), hash(p+vec3(1,0,1)), f.x),
                               mix(hash(p+vec3(0,1,1)), hash(p+vec3(1,1,1)), f.x), f.y), f.z);
            }
            float fbm(vec3 p) {
                float v = 0.0;
                float a = 0.5;
                vec3 shift = vec3(100.0);
                for (int i = 0; i < 3; ++i) {
                    v += a * noise(p);
                    p = p * 2.0 + shift;
                    a *= 0.5;
                }
                return v;
            }

            void main() {
                if (uWaterRadius > 0.0) {
                    vec3 rayDir = normalize(vWorldPos - uCameraPos);
                    float cloudDist = length(vWorldPos - uCameraPos);
                    float b = dot(uCameraPos, rayDir);
                    float c = dot(uCameraPos, uCameraPos) - uWaterRadius * uWaterRadius;
                    float h = b * b - c;
                    if (h >= 0.0) {
                        float tNear = -b - sqrt(h);
                        if (c > 0.0) {
                            if (tNear > 0.0 && tNear < cloudDist) {
                                discard;
                            }
                        } else {
                            discard;
                        }
                    }
                }
                vec3 viewDir = normalize(uCameraPos - vWorldPos);
                vec3 normal = normalize(vLocalPos); // For a sphere at origin, localPos is the normal
                
                // Rim fade (so the spheres look soft at the edges instead of hard geometry)
                float rim = max(0.0, dot(normal, viewDir));
                float env = smoothstep(0.0, 0.6, rim); // Fade out near the grazing angles
                
                // Add wind displacement using animated time
                vec3 coord = vWorldPos * 0.8 + vec3(uTime * 0.25, uTime * 0.1, uTime * 0.18);
                
                // Fluffy noise
                float n = fbm(coord);
                float fluffy = smoothstep(0.2, 0.65, n);
                
                float density = clamp(fluffy * 1.6 * env, 0.0, 1.0);
                if (density < 0.02) discard;
                
                // Self-shadowing approximation
                float shadowNoise = fbm(coord + uLightDir * 0.5);
                float shadow = smoothstep(0.2, 0.8, shadowNoise);
                
                // Dual tone lighting
                vec3 baseColor = uColor;
                vec3 shadowColor = mix(uColor * 0.6, vec3(0.55, 0.65, 0.8), 0.6);
                
                // Side light contribution
                float lightDot = dot(normal, uLightDir);
                float lightIntensity = smoothstep(-0.2, 0.8, lightDot);
                
                vec3 finalColor = mix(shadowColor, baseColor, lightIntensity * shadow);
                
                gl_FragColor = vec4(finalColor, density * uAlpha);
            }
`;

      const skyVertexShaderSource = `
            attribute vec3 aPosition;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            varying vec3 vWorldDir;
            void main() {
                vec4 pos = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
                gl_Position = pos.xyww;
                vWorldDir = normalize(aPosition);
            }
        `;

      const skyFragmentShaderSource = `
            precision highp float;
            varying vec3 vWorldDir;
            uniform float uTime;
            uniform float uGasIntensity;
            uniform vec3 uCameraPos;
            uniform float uWaterRadius;
            
            float hash(vec3 p) {
                p = fract(p * vec3(443.897, 441.423, 437.195));
                p += dot(p, p.yzx + 19.19);
                return fract((p.x + p.y) * p.z);
            }
            
            float noise(vec3 x) {
                vec3 p = floor(x);
                vec3 f = fract(x);
                f = f*f*(3.0-2.0*f);
                return mix(mix(mix(hash(p+vec3(0,0,0)), hash(p+vec3(1,0,0)), f.x),
                               mix(hash(p+vec3(0,1,0)), hash(p+vec3(1,1,0)), f.x), f.y),
                           mix(mix(hash(p+vec3(0,0,1)), hash(p+vec3(1,0,1)), f.x),
                               mix(hash(p+vec3(0,1,1)), hash(p+vec3(1,1,1)), f.x), f.y), f.z);
            }
            
            float fbm(vec3 p) {
                float v = 0.0;
                float a = 0.5;
                vec3 shift = vec3(100.0);
                for (int i = 0; i < 4; ++i) {
                    v += a * noise(p);
                    p = p * 2.0 + shift;
                    a *= 0.5;
                }
                return v;
            }

            void main() {
                vec3 dir = normalize(vWorldDir);
                
                // ดาวระยิบระยับ
                float starPattern = hash(floor(dir * 160.0));
                float stars = 0.0;
                if (starPattern > 0.995) {
                    float intensity = sin(uTime * 1.8 + starPattern * 100.0) * 0.4 + 0.6;
                    stars = pow(fract(starPattern * 1234.56), 25.0) * intensity * 2.0;
                }
                
                // กลุ่มก๊าซในอวกาศเนบิวลา (Nebula Gas)
                vec3 gasCoords = dir * 2.8 + vec3(0.0, uTime * 0.003, uTime * 0.0015);
                float n1 = fbm(gasCoords);
                float n2 = fbm(gasCoords + vec3(3.2, 1.5, -2.1));
                
                vec3 colorNebula1 = vec3(0.01, 0.005, 0.04);  // อวกาศมืดลึก
                vec3 colorNebula2 = vec3(0.08, 0.03, 0.22);   // สีม่วงแก๊สดั้งเดิม
                vec3 colorNebula3 = vec3(0.01, 0.12, 0.25);   // สีฟ้าแก๊สเรืองรอง
                vec3 colorNebula4 = vec3(0.28, 0.04, 0.16);   // สีแดงแก๊สรังสีดาวฤกษ์
                
                vec3 skyColor = mix(colorNebula1, colorNebula2, n1);
                skyColor = mix(skyColor, colorNebula3, n2 * 0.7);
                skyColor += colorNebula4 * max(n1 * n2 - 0.08, 0.0) * 1.5;
                
                skyColor *= uGasIntensity;
                vec3 finalColor = skyColor + vec3(stars);
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

      // --- Sun & Celestial Shader ---
      const sunVertexShaderSource = `
            attribute vec3 aPosition;
            attribute vec3 aColor;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            varying vec3 vColor;
            varying vec3 vNormal;
            varying vec3 vViewNormal;
            varying vec3 vLocalPos;
            
            void main() {
                vColor = aColor;
                vNormal = normalize(aPosition);
                vViewNormal = normalize((uModelViewMatrix * vec4(aPosition, 0.0)).xyz);
                vLocalPos = aPosition;
                gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
            }
      `;

      const sunFragmentShaderSource = `
            precision highp float;
            varying vec3 vColor;
            varying vec3 vNormal;
            varying vec3 vViewNormal;
            varying vec3 vLocalPos;
            uniform float uTime;
            uniform vec3 uTint;
            uniform float uIsSun; // 1.0 = Glowing Sun, 0.0 = Shaded Planet
            uniform vec3 uLightDir;

            float hash(vec3 p) {
                p = fract(p * vec3(443.897, 441.423, 437.195));
                p += dot(p, p.yzx + 19.19);
                return fract((p.x + p.y) * p.z);
            }

            float snoise(vec3 x) {
                vec3 p = floor(x);
                vec3 f = fract(x);
                f = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(mix(hash(p + vec3(0.0, 0.0, 0.0)), hash(p + vec3(1.0, 0.0, 0.0)), f.x),
                        mix(hash(p + vec3(0.0, 1.0, 0.0)), hash(p + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                    mix(mix(hash(p + vec3(0.0, 0.0, 1.0)), hash(p + vec3(1.0, 0.0, 1.0)), f.x),
                        mix(hash(p + vec3(0.0, 1.0, 1.0)), hash(p + vec3(1.0, 1.0, 1.0)), f.x), f.y),
                    f.z
                );
            }

            void main() {
                if (uIsSun > 0.5) {
                    vec3 n = normalize(vNormal);
                    float pulse = sin(uTime * 1.5) * 0.03 + 1.0;

                    // View-facing limb darkening (Fresnel / Rim Corona)
                    float facing = abs(vViewNormal.z); // 1.0 at center, 0.0 at rim
                    float limb = pow(1.0 - clamp(facing, 0.0, 1.0), 1.5);

                    // Solar plasma flares / convection granulation
                    vec3 plasmaCoord = n * 6.5 + vec3(uTime * 0.06, uTime * 0.03, sin(uTime * 0.04));
                    float noise1 = snoise(plasmaCoord);
                    float noise2 = snoise(plasmaCoord * 2.4 - vec3(uTime * 0.09, uTime * 0.04, 0.0));
                    float plasma = noise1 * 0.65 + noise2 * 0.35; // 0.0 to 1.0

                    // Realistic Sun Palette:
                    // Core: Brilliant Warm Solar Gold (ไม่ใช่สีขาวล้วน)
                    vec3 coreColor = vec3(1.0, 0.88, 0.25);
                    // Mid Solar Surface: Rich Golden-Amber / Tangerine
                    vec3 midColor = vec3(1.0, 0.55, 0.04);
                    // Outer Rim & Coronal Flares: Deep Fiery Orange-Red
                    vec3 rimColor = vec3(0.92, 0.20, 0.02);

                    // Mix core to mid with dynamic solar granules
                    vec3 sunCol = mix(midColor, coreColor, clamp(plasma * 0.7 + (1.0 - limb) * 0.5, 0.0, 1.0));
                    // Mix fiery orange-red rim on edges
                    sunCol = mix(sunCol, rimColor, clamp(limb * 1.2 + (1.0 - plasma) * 0.25, 0.0, 1.0));

                    // Multiply vertex color subtly
                    sunCol *= mix(vec3(1.0), vColor, 0.4);

                    vec3 tint = (length(uTint) > 0.01) ? uTint : vec3(1.0);
                    gl_FragColor = vec4(clamp(sunCol * tint * pulse, 0.0, 1.0), 1.0);
                } else {
                    // Shaded background planet
                    vec3 normal = normalize(vNormal);
                    vec3 lDir = length(uLightDir) > 0.01 ? normalize(uLightDir) : vec3(0.0, 1.0, 0.0);
                    float diff = max(dot(normal, lDir), 0.0);
                    float ambient = 0.18;
                    float lit = diff * 0.82 + ambient;
                    
                    vec3 baseCol = (length(uTint) > 0.01) ? uTint : vColor;
                    gl_FragColor = vec4(baseCol * lit, 1.0);
                }
            }
      `;

      window.sunVertexShaderSource = sunVertexShaderSource;
      window.sunFragmentShaderSource = sunFragmentShaderSource;


      

