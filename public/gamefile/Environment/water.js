// === SEEDPLANET MODULE: JS/WATER.JS ===

(function(global) {
  // --- Water Shader Sources ---
  const waterVertexShaderSource = `
        attribute vec3 aPosition;
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        uniform float uTime;
        uniform float uWaveStrength;
        uniform float uWaterLevel;
        
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying float vDist;
        varying vec4 vClipPos;
        varying vec4 vNormClipPos;
        
        void main() {
            float wave1 = sin(aPosition.x * 6.0 + uTime * 2.3) * 0.04;
            float wave2 = cos(aPosition.z * 5.0 + uTime * 1.8) * 0.035;
            float wave3 = sin(aPosition.y * 4.0 + uTime * 2.7) * 0.025;
            float wave4 = cos(aPosition.x * 3.5 + aPosition.z * 4.5 + uTime * 3.1) * 0.03;
            float wave = (wave1 + wave2 + wave3 + wave4) * uWaveStrength * 1.2;
            
            vec3 dir = normalize(aPosition);
            vec3 pos = aPosition + dir * wave;
            
            vec4 mvPosition = uModelViewMatrix * vec4(pos, 1.0);
            vec4 clipPos = uProjectionMatrix * mvPosition;
            gl_Position = clipPos;
            vPosition = pos;
            vNormal = dir;
            vDist = length(mvPosition.xyz);
            vClipPos = clipPos;
            vNormClipPos = uProjectionMatrix * (uModelViewMatrix * vec4(pos + dir * 0.4, 1.0));
        }
  `;

  const waterFragmentShaderSource = `
        precision highp float;
        uniform vec3 uWaterColor;
        uniform float uOpacity;
        uniform float uTime;
        uniform vec3 uLightDir;
        uniform vec3 uCameraPos;
        uniform sampler2D uWaterMaskTex;
        
        uniform float uRenderDistEnabled;
        uniform float uMaxRenderDist;
        
        // Unified Screen-Space Reflection (SSR) Uniforms
        uniform sampler2D uSSRSceneTex;
        uniform mat4 uViewProjMatrix;
        uniform float uSSREnabled;
        uniform vec3 uPlayerPos;
        uniform float uPlayerRadius;
        
        // Boat parameters to prevent water clipping inside the hull
        uniform vec3 uBoatPos[4];
        uniform vec3 uBoatRight[4];
        uniform vec3 uBoatNormal[4];
        uniform vec3 uBoatForward[4];
        uniform vec3 uBoatSize[4];
        uniform vec3 uBoatOffset[4]; // [offsetY, shapeType (1.0 for boat, 0.0 for box), unused]
        uniform float uBoatCount;
        
        // Tunnel parameters to prevent water clipping inside caves
        uniform vec4 uTunnels[64];
        uniform int uTunnelCount;
        
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying float vDist;
        varying vec4 vClipPos;
        varying vec4 vNormClipPos;
        
        // --- GLSL Noise ---
        float hash(vec3 p) {
            p = fract(p * vec3(127.1, 311.7, 74.7));
            return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        }

        float noise3D(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            vec3 u = f * f * (3.0 - 2.0 * f);
            
            return mix(
                mix(mix(hash(i + vec3(0.0,0.0,0.0)), hash(i + vec3(1.0,0.0,0.0)), u.x),
                    mix(hash(i + vec3(0.0,1.0,0.0)), hash(i + vec3(1.0,1.0,0.0)), u.x), u.y),
                mix(mix(hash(i + vec3(0.0,0.0,1.0)), hash(i + vec3(1.0,0.0,1.0)), u.x),
                    mix(hash(i + vec3(0.0,1.0,1.0)), hash(i + vec3(1.0,1.0,1.0)), u.x), u.y), u.z
            );
        }

        float fbm(vec3 p) {
            float value = 0.0;
            float amplitude = 1.0;
            float frequency = 1.0;
            float maxVal = 0.0;
            for (int i = 0; i < 3; i++) {
                value += amplitude * noise3D(p * frequency);
                maxVal += amplitude;
                amplitude *= 0.5;
                frequency *= 2.0;
            }
            return value / maxVal;
        }

        void main() {
            if (uRenderDistEnabled > 0.5 && vDist > uMaxRenderDist) {
                discard;
            }
            
            vec3 nPos = normalize(vPosition);
            float theta = acos(nPos.y);
            float phi = atan(nPos.z, nPos.x);
            if (phi < 0.0) phi += 2.0 * 3.14159265359;
            vec2 uv = vec2(phi / (2.0 * 3.14159265359), theta / 3.14159265359);
            float isWater = texture2D(uWaterMaskTex, uv).r;
            if (isWater <= 0.001) {
                discard;
            }
            float edgeFade = smoothstep(0.0, 0.08, isWater);
            
            // Discard water fragments inside any active floating clipping hulls (e.g., boats)
            for (int i = 0; i < 4; i++) {
                if (float(i) >= uBoatCount) {
                    break;
                }
                vec3 rel = vPosition - uBoatPos[i];
                float localX = dot(rel, uBoatRight[i]);
                float localY = dot(rel, uBoatNormal[i]);
                float localZ = dot(rel, uBoatForward[i]);
                
                vec3 size = uBoatSize[i];
                vec3 offset = uBoatOffset[i];
                
                float offsetY = offset.x;
                float shapeType = offset.y;
                
                float dy = localY - offsetY;
                if (abs(dy) < size.y) {
                    float halfWidth = size.x;
                    float halfLength = size.z;
                    
                    float t = abs(localZ) / halfLength;
                    if (t <= 1.0) {
                        if (shapeType > 0.5) {
                            halfWidth = halfWidth * (1.0 - t * t * 0.85);
                        }
                        
                        if (abs(localX) < halfWidth) {
                            discard;
                        }
                    }
                }
            }
            
            vec3 normal = normalize(vNormal);
            
            // Ripple wave calculation
            float ripple = sin(vPosition.x * 25.0 + uTime * 4.0) * 0.02 
                         + cos(vPosition.z * 20.0 + uTime * 3.5) * 0.02
                         + sin(vPosition.y * 15.0 + uTime * 5.0) * 0.015;
            normal = normalize(normal + vec3(ripple, ripple * 0.5, ripple * 0.7));
            
            vec3 viewDir = normalize(vPosition - uCameraPos);
            vec3 reflectDir = reflect(viewDir, normal);
            
            // --- UNIFIED SCREEN-SPACE REFLECTION (SSR) PIPELINE WITH 4 QUALITY LEVELS & DISTANCE LOD ---
            // uSSREnabled encodes quality level: 0.0 = Off (ปิด), 1.0 = Low (ต่ำ), 2.0 = Medium (กลาง), 3.0 = High (สูง)
            vec2 waterUV = (vClipPos.w > 0.001) ? ((vClipPos.xy / vClipPos.w) * 0.5 + 0.5) : vec2(0.5);
            vec2 normUV = (vNormClipPos.w > 0.001) ? ((vNormClipPos.xy / vNormClipPos.w) * 0.5 + 0.5) : (waterUV + vec2(0.0, 0.01));
            vec2 screenUp = normalize(normUV - waterUV + vec2(0.0, 1e-5));
            vec2 screenRight = vec2(-screenUp.y, screenUp.x);
            vec2 reflRipple = vec2(ripple, ripple * 0.5) * 0.006;

            // 1. Twinkling Cosmic Stars & Atmosphere Fallback (Sky / Horizon)
            vec3 skyColor = vec3(0.02, 0.03, 0.07) * (1.0 - max(0.0, reflectDir.y));
            float starPattern = hash(floor(reflectDir * 160.0));
            if (starPattern > 0.993) {
                skyColor += vec3(1.0, 1.0, 1.0) * (sin(uTime * 3.0 + starPattern * 10.0) * 0.5 + 0.5);
            }
            float horizonFactor = smoothstep(-0.25, 0.35, 0.5 - dot(reflectDir, normalize(vPosition)));
            vec3 fallbackEnv = mix(skyColor, vec3(0.12, 0.32, 0.16), horizonFactor * 0.55);
            
            // 2. Unified Screen-Space Reflection (SSR) with Exact Waterline Bisection, Silhouette Mask & Distance LOD
            float waterRadius = length(vPosition);
            bool isCamAboveWater = (length(uCameraPos) > waterRadius + 0.01);
            vec4 ssrHit = vec4(0.0);

            // Distance cutoff per SSR quality level (Low = 12m, Medium = 20m, High = 32m)
            float maxSSRDist = (uSSREnabled < 1.5) ? 12.0 : ((uSSREnabled < 2.5) ? 20.0 : 32.0);

            if (uSSREnabled > 0.5 && isCamAboveWater && vDist < maxSSRDist) {
                float ssrLodFade = 1.0 - smoothstep(maxSSRDist * 0.90, maxSSRDist, vDist);
                float hitWeight = 0.0;
                vec3 hitColor = vec3(0.0);
                bool inForegroundObjZone = false;

                // Unperturbed spherical normal & horizontal reflection direction (prevents wave ripples from swinging rays into stripes)
                vec3 vNorm = normalize(vNormal);
                vec3 rawHoriz = viewDir - vNorm * dot(viewDir, vNorm);
                float reflHorizLen = length(rawHoriz);
                vec3 reflHoriz = (reflHorizLen > 0.0001) ? (rawHoriz / reflHorizLen) : normalize(vPosition - uCameraPos);
                vec3 reflPerp = normalize(cross(vNorm, reflHoriz));
                float camSteep = clamp(dot(vNorm, -viewDir), 0.0, 1.0);

                // A) Foreground Boat / Wagon Exact Screen-Space Waterline Bisection (Zero gap along wheels, hull & bow/stern)
                for (int i = 0; i < 4; i++) {
                    if (float(i) >= uBoatCount) break;
                    vec3 bCenter = normalize(uBoatPos[i]) * waterRadius;
                    vec3 bRel = vPosition - bCenter;
                    vec2 ro = vec2(dot(bRel, uBoatRight[i]), dot(bRel, uBoatForward[i]));
                    vec2 rd = vec2(dot(reflHoriz, uBoatRight[i]), dot(reflHoriz, uBoatForward[i]));
                    float hasW = uBoatOffset[i].z;
                    vec2 halfBox = vec2(
                        uBoatSize[i].x * (hasW > 0.5 ? 1.85 : 1.15),
                        uBoatSize[i].z * (hasW > 0.5 ? 1.30 : 1.12)
                    );
                    vec2 invRd = 1.0 / (sign(rd) * max(abs(rd), vec2(1e-4)));
                    vec2 t0 = (-halfBox - ro) * invRd;
                    vec2 t1 = ( halfBox - ro) * invRd;
                    vec2 tMin2 = min(t0, t1);
                    vec2 tMax2 = max(t0, t1);
                    float tEnter = max(tMin2.x, tMin2.y);
                    float tExit  = min(tMax2.x, tMax2.y);

                    if (tEnter < tExit && tExit > 0.02 && tEnter < 0.85) {
                        inForegroundObjZone = true;
                        float boatTopH = (hasW > 0.5) ? 0.19 : 0.13;
                        vec4 topClip = uViewProjMatrix * vec4(vPosition + vNorm * boatTopH, 1.0);
                        if (topClip.w > 0.001) {
                            vec2 topUV = topClip.xy / topClip.w * 0.5 + 0.5;
                            float maxSpan = clamp(dot(topUV - waterUV, screenUp), 0.012, 0.24);
                            // March upward along screenUp from waterUV to find the exact rendered waterline of wheel/hull (alpha > 0.994)
                            float prevS = 0.0;
                            float hitS = -1.0;
                            for (int s = 1; s <= 6; s++) {
                                float curS = maxSpan * (float(s) / 6.0);
                                vec2 sUV = waterUV + screenUp * curS;
                                if (sUV.y > 0.995 || sUV.x < 0.002 || sUV.x > 0.998) break;
                                float sA = texture2D(uSSRSceneTex, sUV).a;
                                if (sA > 0.994) {
                                    float loS = prevS;
                                    float hiS = curS;
                                    for (int b = 0; b < 4; b++) {
                                        float midS = 0.5 * (loS + hiS);
                                        float mA = texture2D(uSSRSceneTex, waterUV + screenUp * midS).a;
                                        if (mA > 0.994) hiS = midS;
                                        else loS = midS;
                                    }
                                    hitS = 0.5 * (loS + hiS);
                                    break;
                                }
                                prevS = curS;
                            }
                            if (hitS >= 0.0) {
                                // Verify solid above-water boat body slightly above waterline so rear top edges behind the boat are ignored
                                float bodyA = texture2D(uSSRSceneTex, waterUV + screenUp * (hitS + 0.008)).a;
                                if (bodyA > 0.994) {
                                    vec2 invertedUV = waterUV + screenUp * (2.0 * hitS) + reflRipple;
                                  if (invertedUV.x >= 0.002 && invertedUV.x <= 0.998 && invertedUV.y >= 0.002 && invertedUV.y <= 0.995) {
                                    vec2 edgeDistanceToScreen = min(invertedUV, 1.0 - invertedUV);
                                        float edgeFade = smoothstep(0.0, 0.06, edgeDistanceToScreen.x);
                                        vec4 sceneSample = texture2D(uSSRSceneTex, invertedUV);
                                        float objMask = smoothstep(0.991, 0.997, sceneSample.a);
                                        if (objMask > 0.01) {
                                            float fadeY = smoothstep(0.002, 0.04, 1.0 - invertedUV.y);
                                            float spanFade = 1.0 - smoothstep(maxSpan * 0.75, maxSpan, hitS);
                                            hitColor = sceneSample.rgb;
                                      hitWeight = fadeY * (0.65 + 0.35 * spanFade) * objMask * edgeFade;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // B) Foreground GLB Player Character Exact Screen-Space Waterline Bisection (Close/Mid LOD < 14m)
                if (hitWeight < 0.05 && uPlayerRadius > 0.01 && vDist < 14.0) {
                    vec3 pRel = vPosition - uPlayerPos;
                    float distToPlayer = length(pRel);
                    float pForwardDist = dot(-pRel, reflHoriz);
                    float pSideDist = abs(dot(pRel, reflPerp));
                    if (distToPlayer < uPlayerRadius * 3.2 && pForwardDist > -uPlayerRadius * 0.35 && pSideDist < uPlayerRadius * 0.95) {
                        inForegroundObjZone = true;
                        vec4 pTopClip = uViewProjMatrix * vec4(vPosition + vNorm * (uPlayerRadius * 0.95), 1.0);
                        if (pTopClip.w > 0.001) {
                            vec2 pTopUV = pTopClip.xy / pTopClip.w * 0.5 + 0.5;
                            float pMaxSpan = clamp(dot(pTopUV - waterUV, screenUp), 0.008, 0.22);
                            float prevS = 0.0;
                            float hitS = -1.0;
                            for (int s = 1; s <= 6; s++) {
                                float curS = pMaxSpan * (float(s) / 6.0);
                                vec2 sUV = waterUV + screenUp * curS;
                                if (sUV.y > 0.995 || sUV.x < 0.002 || sUV.x > 0.998) break;
                                float sA = texture2D(uSSRSceneTex, sUV).a;
                                if (sA > 0.994) {
                                    float loS = prevS;
                                    float hiS = curS;
                                    for (int b = 0; b < 4; b++) {
                                        float midS = 0.5 * (loS + hiS);
                                        float mA = texture2D(uSSRSceneTex, waterUV + screenUp * midS).a;
                                        if (mA > 0.994) hiS = midS;
                                        else loS = midS;
                                    }
                                    hitS = 0.5 * (loS + hiS);
                                    break;
                                }
                                prevS = curS;
                            }
                            if (hitS >= 0.0) {
                                float bodyA = texture2D(uSSRSceneTex, waterUV + screenUp * (hitS + 0.006)).a;
                                vec4 currSample = texture2D(uSSRSceneTex, waterUV);
                                if (bodyA > 0.994 && currSample.a < 0.993) {
                                    vec2 invertedUV = waterUV + screenUp * (2.0 * hitS) + reflRipple;
                                  if (invertedUV.x >= 0.002 && invertedUV.x <= 0.998 && invertedUV.y >= 0.002 && invertedUV.y <= 0.995) {
                                    vec2 edgeDistanceToScreen = min(invertedUV, 1.0 - invertedUV);
                                        float edgeFade = smoothstep(0.0, 0.06, edgeDistanceToScreen.x);
                                        vec4 sceneSample = texture2D(uSSRSceneTex, invertedUV);
                                        float objMask = smoothstep(0.991, 0.997, sceneSample.a);
                                        float steepFade = 1.0 - smoothstep(0.65, 0.92, camSteep);
                                        if (objMask * steepFade > 0.01) {
                                            float fadeY = smoothstep(0.002, 0.04, 1.0 - invertedUV.y);
                                            float spanFade = 1.0 - smoothstep(pMaxSpan * 0.75, pMaxSpan, hitS);
                                            hitColor = sceneSample.rgb;
                                            hitWeight = fadeY * (0.70 + 0.30 * spanFade) * objMask * steepFade * edgeFade;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // C) Shoreline / Terrain / Trees / Hills Screen-Space Waterline Bisection & SSR LOD
                if (hitWeight < 0.05) {
                    int activeSteps = 0;
                  const float maxRayDist = 6.0;
                    if (uSSREnabled > 2.5) {
                      // High Quality (สูง): keep enough samples across each distance LOD.
                      activeSteps = (vDist < 14.0) ? 8 : ((vDist < 24.0) ? 6 : 4);
                    } else if (uSSREnabled > 1.5) {
                      // Medium Quality (กลาง): avoid a sample-density drop in the mid-distance band.
                    activeSteps = 8;
                    } else {
                      // Low Quality (ต่ำ): keep its four samples through the full SSR range.
                      activeSteps = (vDist < maxSSRDist) ? 4 : 0;
                    }

                    if (activeSteps > 0) {
                        // Project both max coastal hill/tree height (1.8m) and max 3D water surface reach (4.2m) to screen space
                        vec3 shoreTopWorld = vPosition + vNorm * 1.8;
                        vec3 maxWaterWorld = normalize(vPosition + reflHoriz * maxRayDist) * waterRadius;
                        vec4 shoreTopClip = uViewProjMatrix * vec4(shoreTopWorld, 1.0);
                        vec4 maxWaterClip = uViewProjMatrix * vec4(maxWaterWorld, 1.0);

                        // Points behind the camera plane have no valid screen position; use the capped span instead of skipping SSR on a whole screen row.
                        {
                            float maxShoreSpan = 0.25;
                            if (shoreTopClip.w > 0.05) {
                                vec2 shoreTopUV = shoreTopClip.xy / shoreTopClip.w * 0.5 + 0.5;
                                maxShoreSpan = clamp(dot(shoreTopUV - waterUV, screenUp), 0.012, 0.25);
                            }
                            float maxWaterlineSpan = 0.25;
                            if (maxWaterClip.w > 0.05) {
                                vec2 maxWaterUV = maxWaterClip.xy / maxWaterClip.w * 0.5 + 0.5;
                                maxWaterlineSpan = clamp(dot(maxWaterUV - waterUV, screenUp), 0.008, 0.25);
                            }
                            float searchSpan = min(maxShoreSpan, maxWaterlineSpan);

                            float invSteps = 1.0 / float(activeSteps);
                            float prevS = 0.0;
                            float hitS = -1.0;

                            for (int s = 1; s <= 8; s++) {
                                if (s > activeSteps) break;
                                float curS = searchSpan * (float(s) * invSteps);
                                vec2 sUV = waterUV + screenUp * curS;
                                if (sUV.y > 0.995 || sUV.x < 0.002 || sUV.x > 0.998) break;
                                float sA = texture2D(uSSRSceneTex, sUV).a;
                                // If ray passes behind a foreground boat/player, require terrain shoreline alpha (252/255 = 0.9882) so it skips the boat (1.0)
                                bool isShore = inForegroundObjZone
                                    ? (sA >= 0.984 && sA <= 0.992 && texture2D(uSSRSceneTex, sUV + screenUp * 0.005).a <= 0.992)
                                    : (sA >= 0.984);
                                if (isShore) {
                                    float loS = prevS;
                                    float hiS = curS;
                                    for (int b = 0; b < 4; b++) {
                                        float midS = 0.5 * (loS + hiS);
                                        float mA = texture2D(uSSRSceneTex, waterUV + screenUp * midS).a;
                                        bool midHit = inForegroundObjZone ? (mA >= 0.984 && mA <= 0.992) : (mA >= 0.984);
                                        if (midHit) hiS = midS;
                                        else loS = midS;
                                    }
                                    hitS = 0.5 * (loS + hiS);
                                    break;
                                }
                                prevS = curS;
                            }

                            if (hitS >= 0.0) {
                                vec2 invertedUV = waterUV + screenUp * (2.0 * hitS) + reflRipple;
                              if (invertedUV.x >= 0.002 && invertedUV.x <= 0.998 && invertedUV.y >= 0.002 && invertedUV.y <= 0.995) {
                                vec2 edgeDistanceToScreen = min(invertedUV, 1.0 - invertedUV);
                                    float edgeFade = smoothstep(0.0, 0.06, edgeDistanceToScreen.x);
                                    vec4 sceneSample = texture2D(uSSRSceneTex, invertedUV);
                                    // Reflect only above-water terrain (252/255) and coastal trees/grass/models (255/255), never sky or underwater seabed (250/255)
                                    float landMask = smoothstep(0.983, 0.987, sceneSample.a);
                                    float steepFade = 1.0 - smoothstep(0.55, 0.92, camSteep);
                                    float fadeY = smoothstep(0.002, 0.04, 1.0 - invertedUV.y);
                                    float spanFade = 1.0 - smoothstep(searchSpan * 0.90, searchSpan, hitS);
                                    float weight = fadeY * spanFade * landMask * steepFade * edgeFade;
                                    if (weight > 0.001) {
                                        hitColor = sceneSample.rgb;
                                        hitWeight = weight;
                                    }
                                }
                            }
                        }
                    }
                }

                hitWeight *= ssrLodFade;
                if (hitWeight > 0.001) {
                    ssrHit = vec4(hitColor, hitWeight);
                }
            }

            
            // Blend SSR hit with fallback environment based on hit weight
            vec3 reflectedScene = mix(fallbackEnv, ssrHit.rgb, ssrHit.a * 0.95);
            
            // 3. Specular Sun Highlight
            vec3 lightDir = normalize(uLightDir);
            float sunSpec = pow(max(dot(reflectDir, lightDir), 0.0), 120.0);
            reflectedScene += vec3(1.0, 0.96, 0.85) * sunSpec * 2.0;
            
            // 4. Fresnel: water reflects little head-on and strongly at grazing angles.
            float NdotV = max(dot(normal, -viewDir), 0.0);
            float fresnel = 0.08 + 0.92 * pow(1.0 - clamp(NdotV, 0.0, 1.0), 5.0);
            float reflAlpha = clamp(fresnel + ssrHit.a * 0.12, 0.0, 0.96);
            if (!isCamAboveWater) {
              reflAlpha *= 0.45;
            }
            
            // 5. Natural Water Transparency & Depth Gradient (Clear shallow water over sand -> Deep navy blue sea)
            vec3 deepNavyColor = vec3(0.01, 0.08, 0.32); // Dark navy blue in deep ocean

            vec3 baseSeaColor = uWaterColor;
            if (isWater > 0.35) {
                float t = clamp((isWater - 0.35) / 0.65, 0.0, 1.0);
                baseSeaColor = mix(uWaterColor, deepNavyColor, t);
            }

            float spec = pow(max(dot(reflect(-lightDir, normal), -viewDir), 0.0), 32.0) * 0.35;
            vec3 baseWaterColor = baseSeaColor * (0.85 + 0.15 * spec);
            
            vec3 finalColor = mix(baseWaterColor, reflectedScene, reflAlpha);
            
            // Subdued soft light caustics in shallow waters
            if (isWater < 0.40) {
                vec3 cPos = vPosition * 22.0 + vec3(uTime * 0.9, uTime * 0.7, uTime * 0.8);
                float c1 = noise3D(cPos);
                float c2 = noise3D(cPos * 1.4 + vec3(2.3, 1.7, 4.1));
                float caustic = pow(min(c1, c2), 2.2) * 1.5;
                float causticMask = (1.0 - smoothstep(0.05, 0.40, isWater)) * smoothstep(0.01, 0.05, isWater);
                finalColor += vec3(0.08, 0.10, 0.12) * caustic * causticMask;
            }

            // Animated white foam at sandy beach shoreline
            float foamFactor = smoothstep(0.0, 0.03, edgeFade) * (1.0 - smoothstep(0.03, 0.18, edgeFade));
            float foamNoise = sin(vPosition.x * 65.0 + vPosition.z * 55.0 + uTime * 3.8) * 0.5 + 0.5;
            foamNoise += cos(vPosition.y * 110.0 - uTime * 3.5) * 0.25;
            foamNoise = clamp(foamNoise, 0.0, 1.0);
            vec3 foamColor = vec3(0.96, 0.98, 1.0);
            finalColor = mix(finalColor, foamColor, foamFactor * 0.75 * foamNoise);
            
            // Shallow water fades smoothly to transparent so the sand terrain naturally shows through
            float depthOpacity = smoothstep(0.0, 0.40, isWater);
            float alpha = mix(uOpacity * depthOpacity, 0.96, fresnel);
            alpha += ripple * 0.10;
            alpha = clamp(alpha, 0.0, 0.98);
            alpha *= edgeFade;

            // Atmospheric Fog / Mist at Water Max Render Distance
            if (uRenderDistEnabled > 0.5) {
                float fogStart = uMaxRenderDist * 0.55;
                float fogFactor = smoothstep(fogStart, uMaxRenderDist, vDist);
                vec3 fogDir = normalize(vPosition - uCameraPos);
                float sunDot = max(dot(fogDir, lightDir), 0.0);
                vec3 baseSkyFog = vec3(0.012, 0.035, 0.09);
                vec3 litSkyFog = vec3(0.08, 0.14, 0.24);
                vec3 atmosphericFog = mix(baseSkyFog, litSkyFog, sunDot * 0.5 + 0.1);
                finalColor = mix(finalColor, atmosphericFog, fogFactor * 0.98);
                alpha = mix(alpha, 0.0, fogFactor * 0.95);
            }
            
            gl_FragColor = vec4(finalColor, alpha);
        }
  `;

  // --- Internal State & WebGL Handles ---
  let glContext = null;
  let supportUint32Ext = false;

  let waterProgram = null;
  let waterPosLoc = -1;
  let waterMVLoc = null;
  let waterProjLoc = null;
  let waterColorLoc = null;
  let waterOpacityLoc = null;
  let waterTimeLoc = null;
  let waterWaveStrengthLoc = null;
  let waterLevelLoc = null;
  let waterLightDirLoc = null;
  let waterCameraPosLoc = null;
  let waterRenderDistEnabledLoc = null;
  let waterMaxRenderDistLoc = null;

  let waterBoatPosLoc = null;
  let waterBoatRightLoc = null;
  let waterBoatNormalLoc = null;
  let waterBoatForwardLoc = null;
  let waterBoatSizeLoc = null;
  let waterBoatOffsetLoc = null;
  let waterBoatCountLoc = null;

  let waterTunnelsLoc = null;
  let waterTunnelCountLoc = null;
  let waterSSRSceneTexLoc = null;
  let waterSSREnabledLoc = null;
  let waterViewProjLoc = null;
  let waterPlayerPosLoc = null;
  let waterPlayerRadiusLoc = null;
  const f32_vp = new Float32Array(16);
  const f32_playerPos = new Float32Array(3);

  let waterVertexBuffer = null;
  let waterIndexBuffer = null;
  let waterIndicesLength = 0;
  let waterVerticesCache = null;

  let waterMaskTex = null;
  let waterMask = null;
  let waterTerrainHeights = null;
  let lastTerrainModCount = -1;
  let reusableWaterFloat32Array = null;

  // Pre-allocated typed arrays for uniforms
  const f32_boatPositions = new Float32Array(12);
  const f32_boatRights = new Float32Array(12);
  const f32_boatNormals = new Float32Array(12);
  const f32_boatForwards = new Float32Array(12);
  const f32_boatSizes = new Float32Array(12);
  const f32_boatOffsets = new Float32Array(12);

  const f32_waterTunnelsData = new Float32Array(64 * 4);
  const f32_mv = new Float32Array(16);
  const f32_proj = new Float32Array(16);
  const f32_color = new Float32Array(3);
  const f32_light = new Float32Array(3);
  const f32_cam = new Float32Array(3);
  function setF32(target, source) {
    for (let i = 0; i < source.length; i++) target[i] = source[i];
    return target;
  }
  const tunnelsWithDistPool = [];

  const CLIPPING_MODELS = {
    "wood_boat": {
      size: [0.115, 0.055, 0.27],
      offset: [0.035, 1.0, 0.0]
    }
  };

  function createShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Water Shader error: " + gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function initWaterSystem(gl, supportUint32) {
    if (!gl) return;
    glContext = gl;
    supportUint32Ext = !!supportUint32;

    const vs = createShader(gl, waterVertexShaderSource, gl.VERTEX_SHADER);
    const fs = createShader(gl, waterFragmentShaderSource, gl.FRAGMENT_SHADER);
    waterProgram = gl.createProgram();
    gl.attachShader(waterProgram, vs);
    gl.attachShader(waterProgram, fs);
    gl.linkProgram(waterProgram);

    waterPosLoc = gl.getAttribLocation(waterProgram, "aPosition");
    waterMVLoc = gl.getUniformLocation(waterProgram, "uModelViewMatrix");
    waterProjLoc = gl.getUniformLocation(waterProgram, "uProjectionMatrix");
    waterColorLoc = gl.getUniformLocation(waterProgram, "uWaterColor");
    waterOpacityLoc = gl.getUniformLocation(waterProgram, "uOpacity");
    waterTimeLoc = gl.getUniformLocation(waterProgram, "uTime");
    waterWaveStrengthLoc = gl.getUniformLocation(waterProgram, "uWaveStrength");
    waterLevelLoc = gl.getUniformLocation(waterProgram, "uWaterLevel");
    waterLightDirLoc = gl.getUniformLocation(waterProgram, "uLightDir");
    waterCameraPosLoc = gl.getUniformLocation(waterProgram, "uCameraPos");
    waterRenderDistEnabledLoc = gl.getUniformLocation(waterProgram, "uRenderDistEnabled");
    waterMaxRenderDistLoc = gl.getUniformLocation(waterProgram, "uMaxRenderDist");

    waterBoatPosLoc = gl.getUniformLocation(waterProgram, "uBoatPos");
    waterBoatRightLoc = gl.getUniformLocation(waterProgram, "uBoatRight");
    waterBoatNormalLoc = gl.getUniformLocation(waterProgram, "uBoatNormal");
    waterBoatForwardLoc = gl.getUniformLocation(waterProgram, "uBoatForward");
    waterBoatSizeLoc = gl.getUniformLocation(waterProgram, "uBoatSize");
    waterBoatOffsetLoc = gl.getUniformLocation(waterProgram, "uBoatOffset");
    waterBoatCountLoc = gl.getUniformLocation(waterProgram, "uBoatCount");

    waterTunnelsLoc = gl.getUniformLocation(waterProgram, "uTunnels");
    waterTunnelCountLoc = gl.getUniformLocation(waterProgram, "uTunnelCount");
    waterSSRSceneTexLoc = gl.getUniformLocation(waterProgram, "uSSRSceneTex");
    waterSSREnabledLoc = gl.getUniformLocation(waterProgram, "uSSREnabled");
    waterViewProjLoc = gl.getUniformLocation(waterProgram, "uViewProjMatrix");
    waterPlayerPosLoc = gl.getUniformLocation(waterProgram, "uPlayerPos");
    waterPlayerRadiusLoc = gl.getUniformLocation(waterProgram, "uPlayerRadius");

    const initialGridSize = typeof currentGridSize !== 'undefined' ? currentGridSize : 400;
    const initialWaterLevel = typeof waterLevel !== 'undefined' ? waterLevel : 1.0;
    const initialRadius = typeof RADIUS !== 'undefined' ? RADIUS : 8.0;

    buildWaterSphere(initialGridSize, initialWaterLevel, initialRadius);
  }

  function getWaterWave(px, py, pz, time, strength) {
    const wave1 = Math.sin(px * 6.0 + time * 2.3) * 0.04;
    const wave2 = Math.cos(pz * 5.0 + time * 1.8) * 0.035;
    const wave3 = Math.sin(py * 4.0 + time * 2.7) * 0.025;
    const wave4 = Math.cos(px * 3.5 + pz * 4.5 + time * 3.1) * 0.03;
    return (wave1 + wave2 + wave3 + wave4) * strength * 1.8;
  }

  function getWaterRadiusAt(x, y, z) {
    const wEnabled = typeof waterEnabled !== 'undefined' ? waterEnabled : true;
    if (!wEnabled) return 0;
    
    const wLevel = typeof waterLevel !== 'undefined' ? waterLevel : 1.0;
    const planetR = typeof RADIUS !== 'undefined' ? RADIUS : 8.0;
    const hScale = typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE : (0.6 * Math.pow(planetR / 8.0, 0.70));
    const baseWaterRadius = planetR + wLevel * (hScale * 0.25);
    
    const r = Math.sqrt(x*x + y*y + z*z);
    if (r < 0.01) return 0;
    const nx = x / r;
    const ny = y / r;
    const nz = z / r;
    
    const theta = Math.acos(Math.max(-1, Math.min(1, ny)));
    let phi = Math.atan2(nz, nx);
    if (phi < 0) phi += Math.PI * 2;
    
    const gridSize = typeof currentGridSize !== 'undefined' ? currentGridSize : 400;
    const maxGrid = Math.min(gridSize, 200);
    const lat = Math.round((theta / Math.PI) * maxGrid);
    const long = Math.round((phi / (Math.PI * 2)) * maxGrid);
    const gridIdx = lat * (maxGrid + 1) + long;
    
    if (waterMask && waterMask[gridIdx] === 0) {
      return 0;
    }
    
    return baseWaterRadius;
  }

  let _lastWaterGSize = -1;
  let _lastWaterLevel = -1;
  let _lastWaterRad = -1;

  function buildWaterSphere(gridSize, wLevel, planetR) {
    if (!glContext) return;
    const gl = glContext;

    const gSize = gridSize || (typeof currentGridSize !== 'undefined' ? currentGridSize : 400);
    const level = wLevel !== undefined ? wLevel : (typeof waterLevel !== 'undefined' ? waterLevel : 1.0);
    const rad = planetR || (typeof RADIUS !== 'undefined' ? RADIUS : 8.0);

    // Skip redundant rebuild if parameters have not changed and buffer is valid
    if (gSize === _lastWaterGSize && level === _lastWaterLevel && rad === _lastWaterRad && waterVertexBuffer) {
      return;
    }
    _lastWaterGSize = gSize;
    _lastWaterLevel = level;
    _lastWaterRad = rad;

    const maxWaterSize = Math.min(gSize, 200);
    const latSeg = maxWaterSize;
    const longSeg = maxWaterSize;

    const vertexCount = (latSeg + 1) * (longSeg + 1);
    const vertices = new Float32Array(vertexCount * 3);
    const indexCount = latSeg * longSeg * 6;
    const isUint32 = supportUint32Ext && indexCount > 65535;
    const indices = isUint32 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

    const hScale = typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE : (0.6 * Math.pow(rad / 8.0, 0.70));
    const waterRadius = rad + level * (hScale * 0.25);

    // Precompute longitude trig table once to eliminate tens of thousands of duplicate sin/cos calls
    const sinPhiTable = new Float64Array(longSeg + 1);
    const cosPhiTable = new Float64Array(longSeg + 1);
    for (let long = 0; long <= longSeg; long++) {
      const phi = (long / longSeg) * Math.PI * 2;
      sinPhiTable[long] = Math.sin(phi);
      cosPhiTable[long] = Math.cos(phi);
    }

    let vIdx = 0;
    for (let lat = 0; lat <= latSeg; lat++) {
      const theta = (lat / latSeg) * Math.PI;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const rSin = waterRadius * sinTheta;
      const rCos = waterRadius * cosTheta;

      for (let long = 0; long <= longSeg; long++) {
        vertices[vIdx++] = rSin * cosPhiTable[long];
        vertices[vIdx++] = rCos;
        vertices[vIdx++] = rSin * sinPhiTable[long];
      }
    }

    let iIdx = 0;
    for (let lat = 0; lat < latSeg; lat++) {
      for (let long = 0; long < longSeg; long++) {
        const a = lat * (longSeg + 1) + long;
        const b = a + longSeg + 1;
        const c = a + 1;
        const d = b + 1;
        indices[iIdx++] = a;
        indices[iIdx++] = b;
        indices[iIdx++] = c;
        indices[iIdx++] = c;
        indices[iIdx++] = b;
        indices[iIdx++] = d;
      }
    }

    waterIndicesLength = indices.length;
    waterVerticesCache = vertices;

    if (waterVertexBuffer) gl.deleteBuffer(waterVertexBuffer);
    if (waterIndexBuffer) gl.deleteBuffer(waterIndexBuffer);

    waterVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, waterVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, waterVerticesCache, gl.DYNAMIC_DRAW);

    waterIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, waterIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    // Sync Native WebGPU Buffers if WebGPU is available
    if (typeof Graphics !== 'undefined' && Graphics.webgpu && Graphics.webgpu.device) {
      const device = Graphics.webgpu.device;
      if (Graphics.webgpu.waterVertexBuffer) {
        Graphics.webgpu.waterVertexBuffer.destroy();
      }
      if (Graphics.webgpu.waterIndexBuffer) {
        Graphics.webgpu.waterIndexBuffer.destroy();
      }
      Graphics.webgpu.waterVertexBuffer = device.createBuffer({
        size: waterVerticesCache.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(Graphics.webgpu.waterVertexBuffer, 0, waterVerticesCache);

      Graphics.webgpu.waterIndexBuffer = device.createBuffer({
        size: indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(Graphics.webgpu.waterIndexBuffer, 0, indices);
      Graphics.webgpu.waterIndicesLength = waterIndicesLength;
      Graphics.webgpu.waterUseUint32 = isUint32;
    }

    // Synchronize global references if they exist
    if (typeof window !== 'undefined') {
      window.waterVertexBuffer = waterVertexBuffer;
      window.waterIndexBuffer = waterIndexBuffer;
      window.waterIndicesLength = waterIndicesLength;
    }
  }

  function updateWaterMask() {
    if (!glContext) return;
    const gl = glContext;

    const gSize = typeof currentGridSize !== 'undefined' ? currentGridSize : 400;
    const planetR = typeof RADIUS !== 'undefined' ? RADIUS : 8.0;
    const wLevel = typeof waterLevel !== 'undefined' ? waterLevel : 1.0;
    const seed = typeof window !== 'undefined' && typeof window.globalSeed !== 'undefined' ? window.globalSeed : 12345;
    const hScale = typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE : (0.6 * Math.pow(planetR / 8.0, 0.70));
    const tMods = typeof terrainMods !== 'undefined' ? terrainMods : null;
    const t3D = typeof tunnels3D !== 'undefined' ? tunnels3D : null;

    const latSeg = Math.min(gSize, 200);
    const longSeg = Math.min(gSize, 200);
    const numNodes = (latSeg + 1) * (longSeg + 1);
    
    if (!waterMask || waterMask.length !== numNodes) {
      waterMask = new Uint8Array(numNodes);
      waterTerrainHeights = new Float32Array(numNodes);
    }
    
    waterMask.fill(0);
    const baseWaterRadius = planetR + wLevel * (hScale * 0.25);
    
    const cols = longSeg + 1;
    for (let lat = 0; lat <= latSeg; lat++) {
      const theta = (lat / latSeg) * Math.PI;
      for (let long = 0; long <= longSeg; long++) {
        const phi = (long / longSeg) * Math.PI * 2;
        const h = typeof getVisualHeightOnSphere === 'function' 
          ? getVisualHeightOnSphere(theta, phi, seed) 
          : (typeof getHeightOnSphere === 'function' ? getHeightOnSphere(theta, phi, seed) : 0);
        let tr = planetR + h * hScale;
        
        if (tMods) {
           const nx = Math.sin(theta)*Math.cos(phi);
           const ny = Math.cos(theta);
           const nz = Math.sin(theta)*Math.sin(phi);
           for(let i=0; i<tMods.length; i++) {
             const mod = tMods[i];
             const dx = nx - mod.x;
             const dy = ny - mod.y;
             const dz = nz - mod.z;
             const distSq = dx*dx + dy*dy + dz*dz;
             if (distSq < mod.rSq) {
                const dist = Math.sqrt(distSq);
                const factor = 1.0 - (dist / mod.r);
                const smoothFactor = factor * factor * (3 - 2 * factor);
                tr += mod.delta * smoothFactor * hScale;
             }
           }
        }
        
        if (t3D && t3D.length > 0) {
           const nx = Math.sin(theta)*Math.cos(phi);
           const ny = Math.cos(theta);
           const nz = Math.sin(theta)*Math.sin(phi);
           
           let changed = true;
           let visited = new Uint8Array(t3D.length);
           while (changed) {
              changed = false;
              for (let i = 0; i < t3D.length; i++) {
                 if (visited[i] === 1) continue;
                 const t = t3D[i];
                 const dot = nx * t.x + ny * t.y + nz * t.z;
                 const distSq = t.x*t.x + t.y*t.y + t.z*t.z;
                 const D4 = dot * dot - (distSq - t.rSq);
                 if (D4 >= 0) {
                    const sqrtD = Math.sqrt(D4);
                    const r1 = dot - sqrtD;
                    if (r1 < tr) {
                       tr = r1;
                       changed = true;
                       visited[i] = 1;
                    }
                 }
              }
           }
        }
        const gridIdx = lat * cols + long;
        waterTerrainHeights[gridIdx] = tr;
      }
    }

    // Ensure seamless wrapping across longitude seam (phi = 0 and phi = 2*PI)
    for (let lat = 0; lat <= latSeg; lat++) {
      waterTerrainHeights[lat * cols + longSeg] = waterTerrainHeights[lat * cols + 0];
    }
    
    for (let lat = 0; lat <= latSeg; lat++) {
      for (let long = 0; long <= longSeg; long++) {
        const gridIdx = lat * cols + long;
        const tr = waterTerrainHeights[gridIdx];
        let depth = baseWaterRadius - tr;
        if (depth <= 0.0) {
           waterMask[gridIdx] = 0;
        } else {
           const depthRef = Math.max(0.4, 0.80 * (hScale / 1.5));
           let normDepth = Math.max(0.0, Math.min(1.0, depth / depthRef));
           waterMask[gridIdx] = Math.max(1, Math.floor(normDepth * 254 + 1));
        }
      }
    }
    
    if (!waterMaskTex) {
       waterMaskTex = gl.createTexture();
    }
    gl.bindTexture(gl.TEXTURE_2D, waterMaskTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, longSeg + 1, latSeg + 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, waterMask);
    if (typeof Graphics !== 'undefined' && Graphics.webgpu && Graphics.webgpu.device) {
        if (!Graphics.webgpu.waterMaskTexture) {
            Graphics.webgpu.waterMaskTexture = Graphics.webgpu.device.createTexture({
                size: [longSeg + 1, latSeg + 1, 1],
                format: 'r8unorm',
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
            });
            Graphics.webgpu.waterMaskTextureView = Graphics.webgpu.waterMaskTexture.createView();
            Graphics.webgpu.waterMaskSampler = Graphics.webgpu.device.createSampler({
                magFilter: 'linear',
                minFilter: 'linear',
                addressModeU: 'repeat',
                addressModeV: 'clamp-to-edge'
            });
        }
        Graphics.webgpu.device.queue.writeTexture(
            { texture: Graphics.webgpu.waterMaskTexture },
            waterMask,
            { bytesPerRow: longSeg + 1, rowsPerImage: latSeg + 1 },
            [longSeg + 1, latSeg + 1, 1]
        );
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    if (typeof window !== 'undefined') {
      window.waterMaskTex = waterMaskTex;
      window.waterMask = waterMask;
    }
  }

  function updateWaterVertices(time) {
    if (!glContext) return;
    const gl = glContext;

    const wEnabled = typeof waterEnabled !== 'undefined' ? waterEnabled : true;
    if (!wEnabled || !waterVertexBuffer || !waterVerticesCache) return;

    const wLevel = typeof waterLevel !== 'undefined' ? waterLevel : 1.0;
    const gSize = typeof currentGridSize !== 'undefined' ? currentGridSize : 400;
    const tMods = typeof terrainMods !== 'undefined' ? terrainMods : null;
    const t3D = typeof tunnels3D !== 'undefined' ? tunnels3D : null;

    const currentModCount = (tMods ? tMods.length : 0) + (t3D ? t3D.length : 0) + Math.round(wLevel * 1000) + gSize * 100000;
    if (currentModCount !== lastTerrainModCount || !waterMask) {
       updateWaterMask();
       lastTerrainModCount = currentModCount;
    }
  }

  function drawWater(gl, params) {
    if (!gl || !waterProgram || !waterVertexBuffer || !waterIndexBuffer || waterIndicesLength <= 0) return;

    const p = params || {};
    const wEnabled = p.waterEnabled !== undefined ? p.waterEnabled : (typeof waterEnabled !== 'undefined' ? waterEnabled : true);
    if (!wEnabled) return;

    const modelViewMatrix = p.modelViewMatrix;
    const projMatrix = p.projMatrix;
    const wColor = p.waterColor || (typeof waterColor !== 'undefined' ? waterColor : [0.1, 0.4, 0.8]);
    const wOpacity = p.waterOpacity !== undefined ? p.waterOpacity : (typeof waterOpacity !== 'undefined' ? waterOpacity : 0.8);
    const time = p.waterAnimTime !== undefined ? p.waterAnimTime : (typeof waterAnimTime !== 'undefined' ? waterAnimTime : 0.0);
    const wWaveStrength = p.waveStrength !== undefined ? p.waveStrength : (typeof waveStrength !== 'undefined' ? waveStrength : 1.0);
    const wLevel = p.waterLevel !== undefined ? p.waterLevel : (typeof waterLevel !== 'undefined' ? waterLevel : 1.0);
    const lightDir = p.finalLightDir || [0, 1, 0];
    const cameraPos = p.eyePos || [0, 0, 0];
    const renderDistE = p.renderDistEnabled ? 1.0 : 0.0;
    const renderDistVal = p.renderDistValue !== undefined ? p.renderDistValue : 100.0;
    const colls = p.collectibles || (typeof collectibles !== 'undefined' ? collectibles : []);
    const t3D = p.tunnels3D || (typeof tunnels3D !== 'undefined' ? tunnels3D : []);
    const isUint32 = p.supportUint32 !== undefined ? p.supportUint32 : supportUint32Ext;

    gl.useProgram(waterProgram);

    gl.uniformMatrix4fv(waterMVLoc, false, setF32(f32_mv, modelViewMatrix));
    gl.uniformMatrix4fv(waterProjLoc, false, setF32(f32_proj, projMatrix));
    gl.uniform3fv(waterColorLoc, setF32(f32_color, wColor));
    gl.uniform1f(waterOpacityLoc, wOpacity);
    gl.uniform1f(waterTimeLoc, time);
    gl.uniform1f(waterWaveStrengthLoc, wWaveStrength);
    gl.uniform1f(waterLevelLoc, wLevel);
    gl.uniform3fv(waterLightDirLoc, setF32(f32_light, lightDir));
    gl.uniform3fv(waterCameraPosLoc, setF32(f32_cam, cameraPos));
    gl.uniform1i(gl.getUniformLocation(waterProgram, "uWaterMaskTex"), 2);
    gl.uniform1f(waterRenderDistEnabledLoc, renderDistE);
    gl.uniform1f(waterMaxRenderDistLoc, renderDistVal);

    // Screen-Space Reflection (SSR) Setup
    const vp = p.viewProjMatrix || window.gpuViewProj;
    if (waterViewProjLoc && vp) {
      gl.uniformMatrix4fv(waterViewProjLoc, false, setF32(f32_vp, vp));
    }
    const hasSSR = !!window._SSRSceneTexture;
    const ssrQualityVal = p.ssrQuality !== undefined ? p.ssrQuality : (typeof window.ssrQuality === "number" ? window.ssrQuality : 2);
    if (waterSSREnabledLoc) {
      gl.uniform1f(waterSSREnabledLoc, (hasSSR && ssrQualityVal > 0) ? ssrQualityVal : 0.0);
    }
    if (waterSSRSceneTexLoc) {
      gl.uniform1i(waterSSRSceneTexLoc, 3);
    }
    if (hasSSR) {
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, window._SSRSceneTexture);
    }
    const playerPos = p.playerPos || [0, 0, 0];
    const playerRadius = (p.playerScale !== undefined ? p.playerScale : 0.1);
    if (waterPlayerPosLoc) {
      gl.uniform3fv(waterPlayerPosLoc, setF32(f32_playerPos, playerPos));
    }
    if (waterPlayerRadiusLoc) {
      gl.uniform1f(waterPlayerRadiusLoc, playerRadius);
    }

    // Boat clipping parameters
    let boatCount = 0;
    const topBoats = [null, null, null, null];
    const topBoatsDistSq = [Infinity, Infinity, Infinity, Infinity];

    const currentPlanetR = typeof RADIUS !== 'undefined' ? RADIUS : 8.0;
    const currentHScale = typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE : (0.6 * Math.pow(currentPlanetR / 8.0, 0.70));
    const currentWaterR = currentPlanetR + wLevel * (currentHScale * 0.25);

    for (let i = 0; i < colls.length; i++) {
      const c = colls[i];
      if (c.active && (c.type in CLIPPING_MODELS) && !c.isPreview) {
        // Check if boat is close to water surface and not strictly on land
        const bRad = Math.hypot(c.position[0], c.position[1], c.position[2]);
        const distToWater = Math.abs(bRad - currentWaterR);
        if (c.isInWater === false && distToWater > 1.0) {
          continue;
        }

        const dx = c.position[0] - cameraPos[0];
        const dy = c.position[1] - cameraPos[1];
        const dz = c.position[2] - cameraPos[2];
        const distSq = dx*dx + dy*dy + dz*dz;
        
        for (let j = 0; j < 4; j++) {
          if (distSq < topBoatsDistSq[j]) {
            for (let k = 3; k > j; k--) {
              topBoats[k] = topBoats[k - 1];
              topBoatsDistSq[k] = topBoatsDistSq[k - 1];
            }
            topBoats[j] = c;
            topBoatsDistSq[j] = distSq;
            break;
          }
        }
      }
    }
    
    for (let j = 0; j < 4; j++) {
      if (topBoats[j] !== null) {
        boatCount++;
      }
    }

    f32_boatPositions.fill(0);
    f32_boatRights.fill(0);
    f32_boatNormals.fill(0);
    f32_boatForwards.fill(0);
    f32_boatSizes.fill(0);
    f32_boatOffsets.fill(0);

    for (let i = 0; i < boatCount; i++) {
      const item = topBoats[i];
      const pPos = item.position;

      let n = item.normal || [0, 1, 0];
      let baseR = item.R || [1, 0, 0];
      let baseF = item.F || [0, 0, 1];
      let r = baseR;
      let f = baseF;

      if (item.angle !== undefined && item.angle !== 0) {
        const cosH = Math.cos(item.angle);
        const sinH = Math.sin(item.angle);
        r = [baseR[0] * cosH - baseF[0] * sinH, baseR[1] * cosH - baseF[1] * sinH, baseR[2] * cosH - baseF[2] * sinH];
        f = [baseF[0] * cosH + baseR[0] * sinH, baseF[1] * cosH + baseR[1] * sinH, baseF[2] * cosH + baseR[2] * sinH];
      }

      const lenR = Math.hypot(r[0], r[1], r[2]) || 1;
      const lenN = Math.hypot(n[0], n[1], n[2]) || 1;
      const lenF = Math.hypot(f[0], f[1], f[2]) || 1;

      f32_boatPositions[i * 3 + 0] = pPos[0];
      f32_boatPositions[i * 3 + 1] = pPos[1];
      f32_boatPositions[i * 3 + 2] = pPos[2];

      f32_boatRights[i * 3 + 0] = r[0] / lenR;
      f32_boatRights[i * 3 + 1] = r[1] / lenR;
      f32_boatRights[i * 3 + 2] = r[2] / lenR;

      f32_boatNormals[i * 3 + 0] = n[0] / lenN;
      f32_boatNormals[i * 3 + 1] = n[1] / lenN;
      f32_boatNormals[i * 3 + 2] = n[2] / lenN;

      f32_boatForwards[i * 3 + 0] = f[0] / lenF;
      f32_boatForwards[i * 3 + 1] = f[1] / lenF;
      f32_boatForwards[i * 3 + 2] = f[2] / lenF;

      const config = CLIPPING_MODELS[item.type];
      f32_boatSizes[i * 3 + 0] = config.size[0];
      f32_boatSizes[i * 3 + 1] = config.size[1];
      f32_boatSizes[i * 3 + 2] = config.size[2];

      const hasWheels = !!(item.hasWheel || item.hasWheels || (item.wheelCount && item.wheelCount > 0));
      f32_boatOffsets[i * 3 + 0] = config.offset[0];
      f32_boatOffsets[i * 3 + 1] = config.offset[1];
      f32_boatOffsets[i * 3 + 2] = hasWheels ? 1.0 : 0.0;
    }


    gl.uniform3fv(waterBoatPosLoc, f32_boatPositions);
    gl.uniform3fv(waterBoatRightLoc, f32_boatRights);
    gl.uniform3fv(waterBoatNormalLoc, f32_boatNormals);
    gl.uniform3fv(waterBoatForwardLoc, f32_boatForwards);
    gl.uniform3fv(waterBoatSizeLoc, f32_boatSizes);
    gl.uniform3fv(waterBoatOffsetLoc, f32_boatOffsets);
    gl.uniform1f(waterBoatCountLoc, boatCount);

    // Tunnel clipping parameters
    let waterTunnelCount = 0;
    if (t3D) {
      const count = t3D.length;
      while (tunnelsWithDistPool.length < count) {
        tunnelsWithDistPool.push({ t: null, distSq: 0 });
      }
      for (let i = 0; i < tunnelsWithDistPool.length; i++) {
        if (i < count) {
          const t = t3D[i];
          const dx = t.x - cameraPos[0];
          const dy = t.y - cameraPos[1];
          const dz = t.z - cameraPos[2];
          tunnelsWithDistPool[i].t = t;
          tunnelsWithDistPool[i].distSq = dx*dx + dy*dy + dz*dz;
        } else {
          tunnelsWithDistPool[i].t = null;
          tunnelsWithDistPool[i].distSq = Infinity;
        }
      }
      tunnelsWithDistPool.sort((a, b) => a.distSq - b.distSq);
      waterTunnelCount = Math.min(64, count);
      f32_waterTunnelsData.fill(0);
      for (let i = 0; i < waterTunnelCount; i++) {
        const t = tunnelsWithDistPool[i].t;
        if (t) {
          f32_waterTunnelsData[i * 4 + 0] = t.x;
          f32_waterTunnelsData[i * 4 + 1] = t.y;
          f32_waterTunnelsData[i * 4 + 2] = t.z;
          f32_waterTunnelsData[i * 4 + 3] = t.r;
        }
      }
    }
    if (waterTunnelsLoc) gl.uniform4fv(waterTunnelsLoc, f32_waterTunnelsData);
    if (waterTunnelCountLoc) gl.uniform1i(waterTunnelCountLoc, waterTunnelCount);

    gl.bindBuffer(gl.ARRAY_BUFFER, waterVertexBuffer);
    gl.enableVertexAttribArray(waterPosLoc);
    gl.vertexAttribPointer(waterPosLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, waterIndexBuffer);

    // Transparent water pass should not write to depth buffer so 3D UI and other transparent passes are not clipped
    gl.depthMask(false);

    if (isUint32 && waterIndicesLength > 65535) {
      gl.drawElements(gl.TRIANGLES, waterIndicesLength, gl.UNSIGNED_INT, 0);
    } else {
      gl.drawElements(gl.TRIANGLES, waterIndicesLength, gl.UNSIGNED_SHORT, 0);
    }

    gl.depthMask(true);
  }

  function getMaskTexture() {
    return waterMaskTex;
  }

  function clearActiveWater() {
    waterIndicesLength = 0;
    global.waterEnabled = false;
    if (typeof waterEnabled !== "undefined") waterEnabled = false;
  }

  // --- Export System ---
  const WaterSystem = {
    init: initWaterSystem,
    buildWaterSphere: buildWaterSphere,
    clearActiveWater: clearActiveWater,
    updateWaterMask: updateWaterMask,
    updateWaterVertices: updateWaterVertices,
    drawWater: drawWater,
    getMaskTexture: getMaskTexture,
    getWaterWave: getWaterWave,
    getWaterRadiusAt: getWaterRadiusAt
  };

  global.WaterSystem = WaterSystem;
  global.getWaterWave = getWaterWave;
  global.getWaterRadiusAt = getWaterRadiusAt;
  global.buildWaterSphere = buildWaterSphere;
  global.clearActiveWater = clearActiveWater;
  global.updateWaterMask = updateWaterMask;
  global.updateWaterVertices = updateWaterVertices;

})(typeof window !== 'undefined' ? window : this);
