// === SEEDPLANET MODULE: JS/SHADERS.JS ===

      // --- Shaders ---
      const modelVertexShaderSource = `
            attribute vec3 aPosition;
            attribute vec3 aColor;
            attribute vec3 aNormal;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uLightSpaceMatrix;
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
                    
                    if (uIsTunnelMesh > 1.5) { // Shell
                        // Discard the clamped flat roof of the cave sphere (which is exactly at actualTerrainRadius)
                        if (!isCollar && distToCenter > actualTerrainRadius - 0.02) {
                            discard;
                        }
                        // If overlapping with another tunnel, discard the wall
                        for (int i = 0; i < 64; i++) {
                            if (i < uTunnelCount) {
                                vec4 t = uTunnels[i];
                                // Skip the owner tunnel of this vertex
                                if (length(t.xyz - vTunnelCenter) < 0.01) continue;
                                vec3 diff = vWorldPos - t.xyz;
                                // Less aggressive discard so collars can intersect and form a seam
                                if (dot(diff, diff) < (t.w * 0.88) * (t.w * 0.88)) {
                                    discard;
                                }
                            }
                        }
                    } else { // Inner cave
                        // Discard the clamped flat roof of the cave sphere (which is exactly at actualTerrainRadius)
                        if (!isCollar && distToCenter > actualTerrainRadius - 0.02) {
                            discard;
                        }
                        // If overlapping with another tunnel, discard the wall
                        for (int i = 0; i < 64; i++) {
                            if (i < uTunnelCount) {
                                vec4 t = uTunnels[i];
                                // Skip the owner tunnel of this vertex
                                if (length(t.xyz - vTunnelCenter) < 0.01) continue;
                                vec3 diff = vWorldPos - t.xyz;
                                if (dot(diff, diff) < (t.w * 0.94) * (t.w * 0.94)) {
                                    discard;
                                }
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

      const godRayVertexShaderSource = `
            attribute vec3 aPosition; // (localX, localY, localZ)
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform vec3 uCameraPos;
            uniform float uSphereRadius;
            
            varying vec3 vViewDir;
            varying vec3 vWorldPos;

            void main() {
                // aPosition is a vertex from the atmosphere sphere (radius > 1)
                // We normalize it to get a pure direction vector
                vec3 dir = normalize(aPosition);
                
                // Position this concentric shell around the camera
                vec3 worldPos = uCameraPos + dir * uSphereRadius;
                
                gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(worldPos, 1.0);
                
                // Direction from vertex to camera
                vViewDir = -dir;
                vWorldPos = worldPos;
            }
        `;

      const godRayFragmentShaderSource = `
            precision highp float;
            varying vec3 vViewDir;
            varying vec3 vWorldPos;

            uniform vec3 uColor;
            uniform float uAlpha;
            uniform float uTime;
            uniform float uPulseSpeed;
            uniform float uPhase;
            uniform vec3 uLightDir;
            uniform vec3 uCameraPos;
            uniform float uSphereRadius;
            uniform float uPlanetRadius;

            uniform float uCloudRadiusIn;
            uniform float uCloudRadiusOut;
            uniform float uCloudShape;
            uniform float uCloudTime;

            // Fast pseudo-random hash for 3D noise
            float hash3(vec3 p) {
                p = fract(p * vec3(127.1, 311.7, 74.7));
                return fract(sin(dot(p, vec3(269.5, 183.3, 246.1))) * 43758.5453123);
            }

            // 3D Value Noise
            float noise3D(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                vec3 u = f * f * (3.0 - 2.0 * f);

                float a = hash3(i + vec3(0.0, 0.0, 0.0));
                float b = hash3(i + vec3(1.0, 0.0, 0.0));
                float c = hash3(i + vec3(0.0, 1.0, 0.0));
                float d = hash3(i + vec3(1.0, 1.0, 0.0));
                float e = hash3(i + vec3(0.0, 0.0, 1.0));
                float f_ = hash3(i + vec3(1.0, 0.0, 1.0));
                float g = hash3(i + vec3(0.0, 1.0, 1.0));
                float h = hash3(i + vec3(1.0, 1.0, 1.0));

                return mix(
                    mix(mix(a, b, u.x), mix(c, d, u.x), u.y),
                    mix(mix(e, f_, u.x), mix(g, h, u.x), u.y),
                    u.z
                );
            }

            // Cloud noise functions
            float hashCloud(vec3 p) {
                p = fract(p * vec3(443.897, 441.423, 437.195));
                p += dot(p, p.yzx + 19.19);
                return fract((p.x + p.y) * p.z);
            }

            float noiseCloud(vec3 x) {
                vec3 p = floor(x);
                vec3 f = fract(x);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(mix(hashCloud(p+vec3(0,0,0)), hashCloud(p+vec3(1,0,0)), f.x),
                               mix(hashCloud(p+vec3(0,1,0)), hashCloud(p+vec3(1,1,0)), f.x), f.y),
                           mix(mix(hashCloud(p+vec3(0,0,1)), hashCloud(p+vec3(1,0,1)), f.x),
                               mix(hashCloud(p+vec3(0,1,1)), hashCloud(p+vec3(1,1,1)), f.x), f.y), f.z);
            }

            float fbmCloud(vec3 p) {
                float v = 0.0;
                float a = 0.5;
                vec3 shift = vec3(100.0);
                for (int i = 0; i < 3; ++i) {
                    v += a * noiseCloud(p);
                    p = p * 2.0 + shift;
                    a *= 0.5;
                }
                return v;
            }

            vec3 getCloudIntersection(vec3 p, vec3 lightDir, float rCloud) {
                float dotP_L = dot(p, lightDir);
                float c = dot(p, p) - rCloud * rCloud;
                float h = dotP_L * dotP_L - c;
                if (h >= 0.0) {
                    float t = -dotP_L + sqrt(h);
                    return p + t * lightDir;
                }
                return p;
            }

            float getCloudFactor(vec3 p) {
                float d = length(p);
                
                // Rotate coordinates around Y axis to simulate planetary wind/movement
                float s = sin(uCloudTime * 0.15);
                float c = cos(uCloudTime * 0.15);
                vec3 rotP = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);

                // Smooth envelope
                float midRadius = (uCloudRadiusIn + uCloudRadiusOut) * 0.5;
                float halfWidth = (uCloudRadiusOut - uCloudRadiusIn) * 0.5;
                float distFromCenter = abs(d - midRadius);
                float env = clamp(1.0 - (distFromCenter / halfWidth), 0.0, 1.0);
                env = env * env * (3.0 - 2.0 * env); // Smoothstep envelope
                
                // Soft macro mask with wind movement
                vec3 coord = rotP * (1.6 * uCloudShape) + vec3(uCloudTime * 0.25, uCloudTime * 0.15, uCloudTime * 0.18);
                float mask = fbmCloud(coord * 0.22 + vec3(uCloudTime * 0.12));
                mask = smoothstep(0.28, 0.58, mask);
                if (mask < 0.01) return 0.0;
                
                // Coordinate warping for realistic cloud puffiness
                vec3 warp = vec3(
                    noiseCloud(coord * 0.6 + vec3(uCloudTime * 0.22)),
                    noiseCloud(coord * 0.6 + vec3(2.1, 3.7, 1.8)),
                    noiseCloud(coord * 0.6 + vec3(4.2, 0.9, 3.5))
                );
                
                float n = fbmCloud(coord + warp * 0.4);
                float fluffy = smoothstep(0.32, 0.68, n);
                float den = fluffy * mask * env;
                
                // Crepuscular rays form where there are gaps inside cloud banks
                // Perfect balance: rays only exist under the shadow of the cloud bank footprint,
                // but only where the actual puff density is low.
                float rayFactor = smoothstep(0.0, 0.2, mask) * smoothstep(0.7, 0.0, den);
                return rayFactor;
            }

            void main() {
                // 1. Noise streaks using world space
                vec3 p1 = vWorldPos * 0.05 + vec3(uTime * 0.01, -uTime * 0.03, 0.0);
                vec3 p2 = vWorldPos * 0.10 + vec3(0.0, -uTime * 0.02, uTime * 0.01);
                float n1 = noise3D(p1);
                float n2 = noise3D(p2);
                float noiseVal = n1 * 0.65 + n2 * 0.35;
                
                // Streaks with a low base so it's not totally dark
                float streaks = mix(0.1, 1.0, smoothstep(0.3, 0.75, noiseVal));
                
                // 2. Henyey-Greenstein Forward Scattering (Mie Scattering)
                vec3 V = normalize(vViewDir);
                vec3 L = normalize(uLightDir);
                float cosAngle = dot(-V, L); // Positive when looking at the sun
                float g = 0.91; 
                float mie = (1.0 - g*g) / (4.0 * 3.14159 * pow(1.0 + g*g - 2.0 * g * cosAngle, 1.5));
                
                // Soft forward scattering that is visible but capped, narrower and more concentrated
                float forwardScattering = clamp(mie * 0.08, 0.0, 2.0);
                
                // 3. Distance fade (fade out rays below ground and high in sky)
                float distToCenter = length(vWorldPos);
                // Fade in smoothly starting just below the planet's average surface level
                float groundFade = smoothstep(uPlanetRadius - 0.6, uPlanetRadius + 0.4, distToCenter);
                // Fade out at the clouds so they connect perfectly
                float heightFade = smoothstep(uCloudRadiusIn + 2.0, uCloudRadiusIn, distToCenter);
                
                // 4. Calculate Cloud-Synced Crepuscular Ray Intensity
                vec3 pCloud = getCloudIntersection(vWorldPos, L, uCloudRadiusIn);
                float cloudRayFactor = getCloudFactor(pCloud);
                cloudRayFactor = pow(cloudRayFactor, 1.0);
                
                // 5. Planet Occlusion (Prevent rays from shining through the planet when sun is blocked)
                float planetOcclusion = 1.0;
                float R = uPlanetRadius; 
                float pDotL = dot(vWorldPos, L);
                if (pDotL < 0.0) {
                    float distSq = dot(vWorldPos, vWorldPos);
                    float d = pDotL * pDotL - distSq + R * R;
                    if (d > 0.0) {
                        float closestDistSq = distSq - pDotL * pDotL;
                        float closestDist = sqrt(max(0.0, closestDistSq));
                        planetOcclusion = smoothstep(R - 0.1, R + 0.05, closestDist);
                    }
                }

                // 5.5 Camera-to-sample-point Occlusion (Prevent rays from being seen through the planet body)
                float camToSampleOcclusion = 1.0;
                float pDotDir = dot(uCameraPos, -V);
                float t_closest = -pDotDir;
                float t_clamped = clamp(t_closest, 0.0, uSphereRadius);
                vec3 closestPoint = uCameraPos + t_clamped * (-V);
                float closestDist = length(closestPoint);
                camToSampleOcclusion = smoothstep(R - 0.1, R + 0.05, closestDist);
                
                // Pulse effect
                float pulse = 0.9 + 0.1 * sin(uTime * uPulseSpeed + uPhase);
                
                // Combine elements
                float finalAlpha = uAlpha * streaks * forwardScattering * groundFade * heightFade * cloudRayFactor * pulse * planetOcclusion * camToSampleOcclusion;
                
                gl_FragColor = vec4(uColor, finalAlpha);
            }
        `;

      const skyVertexShaderSource = `
            attribute vec3 aPosition;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            varying vec3 vWorldDir;
            void main() {
                gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
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
                if (uWaterRadius > 0.0) {
                    float b = dot(uCameraPos, dir);
                    float c = dot(uCameraPos, uCameraPos) - uWaterRadius * uWaterRadius;
                    float h = b * b - c;
                    if (h >= 0.0) {
                        float tNear = -b - sqrt(h);
                        if (c > 0.0) {
                            if (tNear > 0.0) {
                                discard;
                            }
                        } else {
                            discard;
                        }
                    }
                }
                
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

      const cloudVertexShaderSource = `
            attribute vec3 aPosition;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform float uScale;
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
                vec3 scaledPos = aPosition * uScale;
                gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(scaledPos, 1.0);
                vNormal = normalize(aPosition);
                vPosition = scaledPos;
            }
        `;

      const cloudFragmentShaderSource = `
            precision highp float;
            varying vec3 vNormal;
            varying vec3 vPosition;
            uniform vec3 uColor;
            uniform float uAlpha;
            uniform float uTime;
            uniform vec3 uLightDir;
            uniform vec3 uCameraPos;
            uniform float uCloudRadiusOut;
            uniform float uCloudRadiusIn;
            uniform float uPlanetRadius;
            uniform float uCloudShape;
            
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

            float getDensity(vec3 p) {
                float d = length(p);
                if (d < uCloudRadiusIn || d > uCloudRadiusOut) return 0.0;
                
                // Rotate coordinates around Y axis to simulate planetary wind/movement
                float s = sin(uTime * 0.15);
                float c = cos(uTime * 0.15);
                vec3 rotP = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);

                // Perfect smoothstep envelope for BOTH inner and outer boundaries (completely avoids concentric lines or hard cuts)
                float midRadius = (uCloudRadiusIn + uCloudRadiusOut) * 0.5;
                float halfWidth = (uCloudRadiusOut - uCloudRadiusIn) * 0.5;
                float distFromCenter = abs(d - midRadius);
                float env = clamp(1.0 - (distFromCenter / halfWidth), 0.0, 1.0);
                env = env * env * (3.0 - 2.0 * env); // Smoothstep envelope
                
                // Soft macro mask with warm feathered transitions and wind movement
                vec3 coord = rotP * (1.6 * uCloudShape) + vec3(uTime * 0.25, uTime * 0.15, uTime * 0.18);
                float mask = fbm(coord * 0.22 + vec3(uTime * 0.12));
                mask = smoothstep(0.28, 0.58, mask);
                if (mask < 0.01) return 0.0;
                
                // Coordinate warping for realistic cloud puffiness/creamy look
                vec3 warp = vec3(
                    noise(coord * 0.6 + vec3(uTime * 0.22)),
                    noise(coord * 0.6 + vec3(2.1, 3.7, 1.8)),
                    noise(coord * 0.6 + vec3(4.2, 0.9, 3.5))
                );
                
                float n = fbm(coord + warp * 0.4);
                
                // Soft, organic cumulus structure with no harsh/pixelated boundaries
                float fluffy = smoothstep(0.32, 0.68, n);
                
                return fluffy * mask * env;
            }

            bool getRayLimits(vec3 ro, vec3 rd, out float tMin, out float tMax) {
                float b_out = dot(ro, rd);
                float c_out = dot(ro, ro) - uCloudRadiusOut * uCloudRadiusOut;
                float h_out = b_out * b_out - c_out;
                
                if (h_out < 0.0) return false;
                
                float t_out1 = -b_out - sqrt(h_out);
                float t_out2 = -b_out + sqrt(h_out);
                
                float b_in = dot(ro, rd);
                float c_in = dot(ro, ro) - uCloudRadiusIn * uCloudRadiusIn;
                float h_in = b_in * b_in - c_in;
                
                if (h_in < 0.0) {
                    tMin = max(0.0, t_out1);
                    tMax = t_out2;
                    return tMax > tMin;
                }
                
                float t_in1 = -b_in - sqrt(h_in);
                float t_in2 = -b_in + sqrt(h_in);
                
                float camDist = length(ro);
                if (camDist > uCloudRadiusOut) {
                    if (t_out1 > 0.0) {
                        tMin = t_out1;
                        tMax = t_in1;
                        return true;
                    }
                } else if (camDist < uCloudRadiusIn) {
                    if (t_in2 > 0.0) {
                        tMin = t_in2;
                        tMax = t_out2;
                        return true;
                    }
                } else {
                    tMin = 0.0;
                    tMax = min(t_out2, t_in1 > 0.0 ? t_in1 : t_out2);
                    return true;
                }
                return false;
            }

            void main() {
                vec3 rd = normalize(vPosition - uCameraPos);
                vec3 ro = uCameraPos;
                if (length(uCameraPos) > uCloudRadiusOut) {
                    ro = vPosition;
                }
                
                float tMin, tMax;
                if (!getRayLimits(ro, rd, tMin, tMax)) {
                    discard;
                }
                
                // Planet occlusion logic to prevent rendering behind or through the planet sphere
                float b_p = dot(ro, rd);
                float c_p = dot(ro, ro) - uPlanetRadius * uPlanetRadius;
                float h_p = b_p * b_p - c_p;
                if (h_p >= 0.0) {
                    float t_p = -b_p - sqrt(h_p);
                    if (t_p > 0.0) {
                        tMax = min(tMax, t_p);
                    }
                } else if (c_p < 0.0 && b_p < 0.0) {
                    // Camera is near/below the planet surface and looking down
                    tMax = 0.0;
                }
                
                if (tMin >= tMax) {
                    discard;
                }
                
                int numSteps = 24;
                float pathLength = tMax - tMin;
                float stepSize = pathLength / float(numSteps);
                
                float T = 1.0;
                vec3 colorAcc = vec3(0.0);
                vec3 lightDir = normalize(uLightDir);
                
                // Add full dither/jitter (0.0 to 1.0) to completely eliminate banding
                float jitter = hash(vPosition + vec3(uTime));
                
                for (int i = 0; i < 24; ++i) {
                    float t = tMin + (float(i) + jitter) * stepSize;
                    if (t > tMax) break;
                    
                    vec3 p = ro + rd * t;
                    float den = getDensity(p);
                    
                    if (den > 0.01) {
                        // Light ray towards the sun for self-shadowing
                        float shadowDist = (uCloudRadiusOut - uCloudRadiusIn) * 0.42;
                        vec3 lightPos = p + lightDir * shadowDist;
                        float denLight = getDensity(lightPos);
                        
                        // Physics-based absorption shadow
                        float shadow = exp(-denLight * 4.8);
                        
                        // Dual coloring: sunlit highlight side vs dramatic soft blue-gray shadow side
                        vec3 sunColor = vec3(1.0, 0.98, 0.94);
                        vec3 shadowColor = vec3(0.24, 0.27, 0.35);
                        vec3 col = mix(shadowColor, sunColor * uColor, 0.22 + 0.78 * shadow);
                        
                        // Specular forward scattering (silver lining on cloud edges when looking towards the sun)
                        float cosPhase = dot(rd, lightDir);
                        float silverLining = pow(max(cosPhase, 0.0), 6.0) * 0.65 * shadow;
                        col += vec3(1.0, 0.96, 0.90) * silverLining;
                        
                        // Alpha transparency accumulation
                        float alpha = den * uAlpha * (stepSize / ((uCloudRadiusOut - uCloudRadiusIn) * 0.12));
                        alpha = clamp(alpha, 0.0, 1.0);
                        
                        colorAcc += col * alpha * T;
                        T *= (1.0 - alpha);
                        
                        if (T < 0.01) {
                            T = 0.0;
                            break;
                        }
                    }
                }
                
                // Silhouette fading to completely prevent hard geometric borders of the sphere mesh
                vec3 normal = normalize(vPosition);
                vec3 viewDir = -rd;
                float cosTheta = dot(normal, viewDir);
                float silhouetteFade = smoothstep(0.0, 0.20, abs(cosTheta));
                
                float finalAlpha = (1.0 - T) * silhouetteFade;
                if (finalAlpha < 0.01) discard;
                
                gl_FragColor = vec4(colorAcc, finalAlpha);
            }
        `;


