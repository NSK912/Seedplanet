
// --- Character Shaders ---
window.characterVertexShaderSource = `#version 300 es
            in vec3 aPosition;
            in vec3 aLocalPos;
            in vec3 aNormal;
            in vec3 aColor;
            in vec2 aTexCoord;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uModelMatrix;
            uniform mat4 uLightSpaceMatrix;
            out vec3 vPosition;
            out vec3 vNormal;
            out vec3 vLocalPos;
            out vec3 vWorldNormal;
            out vec3 vWorldPos;
            out vec4 vPositionLightSpace;
            out vec3 vColor;
            out vec2 vTexCoord;
            void main() {
                vec4 mvPosition = uModelViewMatrix * vec4(aPosition, 1.0);
                gl_Position = uProjectionMatrix * mvPosition;
                vPosition = mvPosition.xyz;
                vNormal = mat3(uModelViewMatrix) * aNormal;
                vLocalPos = aLocalPos;
                vColor = aColor;
                vTexCoord = aTexCoord;
                
                vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
                vWorldNormal = normalize(mat3(uModelMatrix) * aNormal);
                vWorldPos = worldPos.xyz;
                vPositionLightSpace = uLightSpaceMatrix * vec4(worldPos.xyz, 1.0);
            }
        `;

      window.characterFragmentShaderSource = `#version 300 es
            precision highp float;
            in vec3 vPosition;
            in vec3 vNormal;
            in vec3 vLocalPos;
            in vec3 vWorldNormal;
            in vec3 vWorldPos;
            in vec4 vPositionLightSpace;
            in vec3 vColor;
            in vec2 vTexCoord;
            uniform vec3 uLightDir;
            uniform vec3 uCameraPos;
            uniform highp sampler2DShadow uShadowMap;
            
            uniform float uWaterRadius;
            uniform vec3 uWaterColor;
            uniform float uWaterOpacity;
            uniform sampler2D uWaterMaskTex;
            uniform float uShadowsEnabled;
            uniform vec2 uShadowTexelSize;
            uniform sampler2D uFaceTex;
            uniform float uUseFaceTex;
            uniform sampler2D uMainTex;
            uniform float uHasMainTex;
            uniform float uCloneSeed;
            uniform vec4 uPointLights[16];
            uniform vec4 uPointLightColors[16];
            uniform int uPointLightCount;

            out vec4 fragColor;

            float hash12(vec2 p) {
                vec3 p3 = fract(vec3(p.xyx) * 0.1031);
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.x + p3.y) * p3.z);
            }

            vec2 hash22(vec2 p) {
                vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.xx + p3.yz) * p3.zy);
            }

            vec3 getHoodieSquareColor(float h) {
                return vec3(0.08, 0.08, 0.10); // Jet Black only
            }

            float distToSegment(vec2 p, vec2 a, vec2 b) {
                vec2 pa = p - a, ba = b - a;
                float h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
                return length(pa - ba*h);
            }

            /*__SHARED_SHADOW_GLSL__*/

            void main() {
                vec3 normal = normalize(vWorldNormal);
                vec3 viewDir = normalize(uCameraPos - vWorldPos);
                vec3 lightDir = normalize(uLightDir);
                
                // Character base color
                vec3 baseColor = vColor;
                if (vColor.b > 1.5) {
                    baseColor = vec3(vColor.r, vColor.g, vColor.b - 2.0);
                } else if (uHasMainTex > 0.5) {
                    baseColor = texture(uMainTex, vTexCoord).rgb;
                } else if (uUseFaceTex > 0.5 && vTexCoord.x > 0.01 && vTexCoord.x < 0.99 && vTexCoord.y > 0.01 && vTexCoord.y < 0.99) {
                    vec4 faceSample = texture(uFaceTex, vTexCoord);
                    baseColor = mix(baseColor, faceSample.rgb, faceSample.a);
                }

                if (uHasMainTex < 0.5 && vLocalPos.x > 5.0 && vTexCoord.x > -5.0) {
                    vec3 clothPos = vec3(vLocalPos.x - 10.0, vLocalPos.y, vLocalPos.z);
                    vec2 cellId;
                    vec2 gv;
                    if (vTexCoord.x <= -1.5 && vTexCoord.x >= -3.5) {
                        // Connected Long Sleeves cylindrical diamond pattern
                        float sU = clamp(-2.0 - vTexCoord.x, 0.0, 1.0);
                        float nSleeveCols = 6.0;
                        float rowCoord = vTexCoord.y / 0.056;
                        float rowId = floor(rowCoord);
                        float colCoord = sU * nSleeveCols + mod(rowId, 2.0) * 0.5;
                        cellId = vec2(mod(floor(colCoord), nSleeveCols) + 80.0, rowId + 80.0);
                        gv = vec2(fract(colCoord), fract(rowCoord)) - 0.5;
                    } else if (clothPos.y >= 0.215) {
                        // Hood region (outer hood, front rim, and inner hood ceiling)
                        float hAng = atan(clothPos.x, clothPos.y - 0.41);
                        float hRad = length(vec2(clothPos.x, clothPos.y - 0.41));
                        float nHoodCols = 10.0;
                        float hDepth = (0.32 - clothPos.z + (0.30 - hRad) * 0.45) / 0.066;
                        float hRowId = floor(hDepth);
                        float hColCoord = (hAng / 6.2831853 + 0.5) * nHoodCols + mod(hRowId, 2.0) * 0.5;
                        cellId = vec2(mod(floor(hColCoord), nHoodCols) + 50.0, hRowId + 50.0);
                        gv = vec2(fract(hColCoord), fract(hDepth)) - 0.5;
                    } else {
                        // Cloak, Capelet & Collar region
                        float cAng = atan(clothPos.x, clothPos.z);
                        float nCols = 12.0;
                        float rowCoord = (0.215 - clothPos.y) / 0.068;
                        float rowId = floor(rowCoord);
                        float colCoord = (cAng / 6.2831853 + 0.5) * nCols + mod(rowId, 2.0) * 0.5;
                        cellId = vec2(mod(floor(colCoord), nCols), rowId);
                        gv = vec2(fract(colCoord), fract(rowCoord)) - 0.5;
                    }
                    vec2 jitter = (hash22(cellId) - 0.5) * 0.16;
                    float rot = 0.52 + (hash12(cellId + vec2(13.7, 29.3)) - 0.5) * 0.55;
                    vec2 p = gv - jitter;
                    float ca = cos(rot);
                    float sa = sin(rot);
                    vec2 pr = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);
                    float sqSize = 0.21 + hash12(cellId + vec2(41.1, 19.7)) * 0.04;
                    float sqDist = max(abs(pr.x), abs(pr.y));
                    float sqMask = 1.0 - smoothstep(sqSize - 0.018, sqSize + 0.018, sqDist);
                    if (sqMask > 0.001) {
                        float effSeed = uCloneSeed > 0.001 ? uCloneSeed : 1.0;
                        float colH = hash12(cellId * 1.73 + vec2(effSeed, effSeed * 0.618));
                        vec3 sqColor = getHoodieSquareColor(colH);
                        baseColor = mix(baseColor, sqColor, sqMask);
                    }
                }
                vec3 pointLightAccum = vec3(0.0);
                vec3 pointTintAccum = vec3(0.0);
                for (int i = 0; i < 16; i++) {
                    if (i < uPointLightCount) {
                        vec4 pl = uPointLights[i];
                        vec4 plc = uPointLightColors[i];
                        vec3 toLight = pl.xyz - vWorldPos;
                        float d = length(toLight);
                        float rad = pl.w;
                        if (d < rad && rad > 0.001) {
                            vec3 L = d > 0.0001 ? (toLight / d) : normal;
                            float ndl = max(dot(normal, L), 0.0);
                            if (ndl > 0.001) {
                                float occl = calculatePointLightOcclusion(vWorldPos + normal * 0.015, pl.xyz);
                                if (occl > 0.001) {
                                    float falloff = clamp(1.0 - d / rad, 0.0, 1.0);
                                    float atten = falloff * falloff * (3.0 - 2.0 * falloff);
                                    float facing = ndl * smoothstep(0.0, 0.12, ndl);
                                    float wLight = atten * facing * occl * plc.w;
                                    pointLightAccum += mix(vec3(0.80, 0.96, 0.93), plc.rgb, 0.55) * wLight;
                                    pointTintAccum += plc.rgb * (0.04 * wLight);
                                }
                            }
                        }
                    }
                }
                vec3 baseLit = calculateUnifiedLighting(baseColor, normal, vWorldPos, lightDir, vPositionLightSpace, false);
                vec3 addedCharLight = baseColor * pointLightAccum + pointTintAccum;
                vec3 combinedLit = clamp(baseLit + addedCharLight * (1.0 - baseLit * 0.55), 0.0, 1.0);

                // Clean Soft Anime Cel-Shading & 3D Sculpted Bevel Hair Sheen
                float NdotL = dot(normal, lightDir);
                float NdotV = max(0.0, dot(normal, viewDir));
                vec3 celColor;
                float animeRim;

                if (vLocalPos.y < -500.0) {
                    // 3D Sculpted Beveled Curve Hair Shading (Clean satin bevel contrast like ANIME HAIR 2)
                    // Sharp facet normal contrast across split-normal bevel slopes & V-grooves
                    float lumaMask = smoothstep(0.04, 0.18, max(baseColor.r, max(baseColor.g, baseColor.b)));
                    float bevelLight = smoothstep(-0.42, 0.58, NdotL);
                    float bevelCoreHighlight = smoothstep(0.28, 0.85, NdotL);
                    vec3 deepGrooveShadow = baseColor * vec3(0.58, 0.56, 0.64);
                    vec3 midSatinTone = combinedLit * 1.02;
                    vec3 ridgeCrestTone = clamp(combinedLit * 1.24 + vec3(0.07, 0.06, 0.04) * lumaMask, 0.0, 1.0);

                    celColor = mix(deepGrooveShadow, midSatinTone, bevelLight);
                    celColor = mix(celColor, ridgeCrestTone, bevelCoreHighlight * 0.68);

                    // Smooth anisotropic Kajiya-Kay / Half-vector satin sheen along the 3D sculpted curve
                    vec3 H = normalize(lightDir + viewDir);
                    float NdotH = max(0.0, dot(normal, H));
                    float satinSheen = pow(NdotH, 18.0) * smoothstep(-0.05, 0.45, NdotL) * lumaMask;
                    celColor = clamp(celColor + (baseColor * 0.35 + vec3(0.14, 0.13, 0.10)) * satinSheen, 0.0, 1.0);

                    animeRim = pow(1.0 - NdotV, 3.0) * smoothstep(-0.15, 0.40, NdotL) * 1.35 * lumaMask;
                } else {
                    // Soft Subsurface-Scattering (Half-Lambert) Anime Chibi Skin Lighting:
                    // Prevents harsh shadow steps across facial curves and body joints while keeping a warm rosy-peach tone!
                    float halfLambert = NdotL * 0.5 + 0.5;
                    float toonStep = smoothstep(0.14, 0.78, halfLambert);
                    vec3 warmSkinShadow = vec3(0.955, 0.905, 0.895);
                    vec3 softLit = max(combinedLit, baseColor * vec3(0.76, 0.71, 0.69));
                    celColor = mix(softLit * warmSkinShadow, softLit * 1.03, toonStep);
                    animeRim = pow(1.0 - NdotV, 3.5) * smoothstep(-0.15, 0.35, NdotL);
                }

                vec3 finalColor = clamp(celColor + vec3(1.0, 0.95, 0.92) * (animeRim * 0.07), 0.0, 1.0);

                // Apply Water Volume Tint & Fog
                float dist = length(vWorldPos);
                if (dist < uWaterRadius) {
                    float depth = uWaterRadius - dist;
                    float tintFactor = 1.0 - exp(-depth * 5.0);
                    tintFactor = clamp(tintFactor * uWaterOpacity, 0.0, 0.85);
                    finalColor = mix(finalColor, uWaterColor, tintFactor);
                }

                float charAlpha = 1.0;
                fragColor = vec4(finalColor, charAlpha);
            }
        `;

      const atmosphereVertexShaderSource = `#version 300 es
            in vec3 aPosition;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            out vec3 vNormal;
            out vec3 vPosition;
            void main() {
                gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
                vNormal = normalize(aPosition);
                vPosition = aPosition;
            }
        `;

      const atmosphereFragmentShaderSource = `#version 300 es
            precision highp float;
            in vec3 vNormal;
            in vec3 vPosition;
            uniform vec3 uColor;
            uniform float uAlpha;
            uniform vec3 uLightDir;
            uniform vec3 uCameraPos;
            out vec4 fragColor;
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
                
                fragColor = vec4(uColor, finalAlpha);
            }
        `;

      
      // --- Clouds 3D Shaders ---
      window.cloud3DVertexShaderSource = `#version 300 es
            in vec3 aPosition;
            in vec3 aLocalPos;

            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uCloudOrbitMatrix;
            uniform float uAnimTime;

            out vec3 vWorldPos;
            out vec3 vLocalPos;

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

      window.cloud3DFragmentShaderSource = `#version 300 es
            precision highp float;
            in vec3 vWorldPos;
            in vec3 vLocalPos;
            out vec4 fragColor;

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
                
                fragColor = vec4(finalColor, density * uAlpha);
            }
`;

      
// === SEEDPLANET MODULE: JS/PLAYER.JS ===

      function getHeldItem() {
        if (typeof isPlacingFloor !== "undefined" && isPlacingFloor) {
          return null; // When in PRE_PLACE preview/placement mode, never hold any item in hand
        }
        if (typeof activeRidingBoat !== "undefined" && activeRidingBoat) {
          return null; // When riding boat/vehicle, hands steer or row
        }
        if (typeof activeRidingMech !== "undefined" && activeRidingMech) {
          return null; // When piloting mech, hands are on cockpit controls
        }
        let item = null;
        if (typeof selectedActionSlotIndex !== "undefined" && selectedActionSlotIndex !== -1 && typeof actionSlotsItems !== "undefined" && actionSlotsItems && actionSlotsItems[selectedActionSlotIndex]) {
          const candidate = actionSlotsItems[selectedActionSlotIndex];
          if (candidate && (candidate.count === undefined || candidate.count > 0)) {
            item = candidate;
          }
        } else if (typeof activeItem !== "undefined" && activeItem && activeItem.name !== "HAND") {
          item = activeItem;
        }

        if (!item && window.devBucketGizmoEnabled) {
          return { name: "WATER_BUCKET", isDevPreview: true };
        }
        if (!item) return null;

        const itemName = item.name || item.label || "";
        if (window.devBucketGizmoEnabled && itemName !== "IRON_BUCKET" && itemName !== "iron_bucket" && itemName !== "WATER_BUCKET" && itemName !== "water_bucket") {
          return { name: "WATER_BUCKET", isDevPreview: true };
        }

        // PRE_PLACE and NONE category items must NEVER be held in hand
        const isPlaceable = (typeof isPlaceableItem === "function") ? isPlaceableItem(itemName) : (window.isPlaceableItem ? window.isPlaceableItem(itemName) : false);
        if (isPlaceable || itemName.startsWith("ROBOT_")) {
          return null;
        }

        const isNone = (typeof isNoneItem === "function") ? isNoneItem(itemName) : (window.isNoneItem ? window.isNoneItem(itemName) : false);
        if (isNone) {
          return null;
        }

        const isHoldable = (typeof isHoldableItem === "function") ? isHoldableItem(itemName) : (window.isHoldableItem ? window.isHoldableItem(itemName) : false);
        if (isHoldable) {
          return item;
        }

        const def = (typeof getItemDefinition === "function") ? getItemDefinition(itemName) : (window.getItemDefinition ? window.getItemDefinition(itemName) : null);
        if (def) {
          if (def.category === "HOLDABLE") return item;
          return null;
        }

        // Specific whitelist for holdable tools/weapons
        const holdableNames = [
          "AXE", "PICKAXE", "SHOVEL", "IRON_BUCKET", "WATER_BUCKET", "BOW",
          "WOODEN_ARM_CANNON", "ARM_CANNON", "BRANCH", "branch", "FRIED_BUG",
          "GLOW_BATTERY", "DRAGON_FRUIT", "dragon_fruit",
          "COTTON_PLANT", "cotton_plant", "COTTON", "cotton"
        ];
        if (holdableNames.includes(itemName)) {
          return item;
        }

        return null;
      }
      window.getHeldItem = getHeldItem;

      function updatePlayerHPUI() {
        const hpContainer = document.getElementById("playerHpVerticalContainer");
        if (!hpContainer) return;
        
        hpContainer.innerHTML = "";
        
        // 5 ช่อง HP (สีแดง - อยู่ด้านล่างเนื่องจาก container ใช้ column-reverse)
        const totalHpSlots = (typeof playerMaxHP === "number") ? playerMaxHP : 5;
        const filledHpSlots = (typeof playerHP === "number") ? Math.max(0, playerHP) : 5;
        
        for (let s = 0; s < totalHpSlots; s++) {
          const slotDiv = document.createElement("div");
          slotDiv.className = "player-hp-slot-minimal";
          if (s < filledHpSlots) {
            slotDiv.className += " filled";
          }
          slotDiv.title = `HP: ${filledHpSlots}/${totalHpSlots}`;
          hpContainer.appendChild(slotDiv);
        }

        // 5 ช่องความหิว (สีขาว - อยู่ด้านบนเหนือ HP)
        const totalHungerSlots = (typeof playerMaxHunger === "number") ? playerMaxHunger : 5;
        const filledHungerSlots = (typeof playerHunger === "number") ? Math.max(0, playerHunger) : 5;

        for (let s = 0; s < totalHungerSlots; s++) {
          const slotDiv = document.createElement("div");
          slotDiv.className = "player-hunger-slot-minimal";
          if (s === 0) {
            slotDiv.className += " slot-divider"; // ช่องว่างแยกส่วนระหว่าง HP และค่าความหิว
          }
          if (s < filledHungerSlots) {
            slotDiv.className += " filled";
          }
          slotDiv.title = `ความหิว (Hunger): ${filledHungerSlots}/${totalHungerSlots}`;
          hpContainer.appendChild(slotDiv);
        }

        hpContainer.title = `HP: ${filledHpSlots}/${totalHpSlots} | ความหิว (Hunger): ${filledHungerSlots}/${totalHungerSlots}`;
      }
      window.updatePlayerHPUI = updatePlayerHPUI;

      // ระบบคำนวณค่าความหิวและผลกระทบต่อ HP (Hunger & Starvation System)
      function updatePlayerHungerSystem(dt) {
        if (typeof dt !== "number" || isNaN(dt) || dt <= 0 || dt > 1.0) return;
        if (typeof playerControlsLocked !== "undefined" && playerControlsLocked && typeof playerHP !== "undefined" && playerHP <= 0) return;
        if (typeof window.isBuildingPlanet !== "undefined" && window.isBuildingPlanet) return;

        if (typeof playerHunger === "undefined") playerHunger = 5;
        if (typeof playerMaxHunger === "undefined") playerMaxHunger = 5;
        if (typeof playerHungerTimer === "undefined") playerHungerTimer = 0.0;
        if (typeof playerStarvationTimer === "undefined") playerStarvationTimer = 0.0;

        // ตรวจสอบว่าผู้เล่นอยู่ใต้น้ำหรือไม่ (เมื่ออยู่ใต้น้ำ ค่าความหิวจะลดเร็วขึ้น 3 เท่า)
        const isPlayerUnderwater =
          (typeof isDivingMode !== "undefined" && isDivingMode) ||
          (typeof playerDiveDepth === "number" && playerDiveDepth > 0.005) ||
          (typeof currentSwimFactor === "number" && currentSwimFactor > 0.25);
        const hungerDrainMultiplier = isPlayerUnderwater ? 3.0 : 1.0;

        // ปกติ 1 จุดใช้เวลา 2 นาที (120 วินาที) แต่เมื่ออยู่ใต้น้ำจะลดเร็วขึ้น 3 เท่า (40 วินาทีต่อ 1 จุด)
        if (playerHunger > 0) {
          playerHungerTimer += dt * hungerDrainMultiplier;
          if (playerHungerTimer >= 120.0) {
            playerHungerTimer -= 120.0;
            playerHunger = Math.max(0, playerHunger - 1);
            window.playerHunger = playerHunger;
            updatePlayerHPUI();
            if (playerHunger === 0) {
              if (typeof showNotice === "function") {
                showNotice("⚠️ ความหิวหมดลงแล้ว! คุณเริ่มอดอาหาร HP จะลดลงนาทีละ 1 จุด (Starving! Find food)");
              }
            } else {
              if (typeof showNotice === "function") {
                if (isPlayerUnderwater) {
                  showNotice(`🌊 อยู่ใต้น้ำทำให้หิวเร็วขึ้น! ค่าความหิวลดลงเหลือ ${playerHunger}/${playerMaxHunger} จุด`);
                } else {
                  showNotice(`🍗 ค่าความหิวลดลงเหลือ ${playerHunger}/${playerMaxHunger} จุด`);
                }
              }
            }
          }
        }

        // เมื่อค่าหิวหมด (Hunger = 0) HP จะลดลง 1 นาที (60 วินาที) ลด 1 จุด
        if (playerHunger <= 0 && typeof playerHP === "number" && playerHP > 0) {
          playerStarvationTimer += dt;
          if (playerStarvationTimer >= 60.0) {
            playerStarvationTimer -= 60.0;
            if (typeof damagePlayer === "function") {
              damagePlayer(1, "หิวจัดจนเสียพลังชีวิต! (-1 HP จากความหิว)");
            }
          }
        } else {
          playerStarvationTimer = 0.0;
        }
      }
      window.updatePlayerHungerSystem = updatePlayerHungerSystem;

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

      let _cachedHpOverlay = null;

      function updateFloatingNpcHpBars(vMat, pMat, eyePos) {
        if (!_cachedHpOverlay) _cachedHpOverlay = document.getElementById("npcHpOverlay");
        const overlay = _cachedHpOverlay;
        if (!overlay) return;
        
        if (!gameStarted || !amphibians || amphibians.length === 0 || !activeTargetNPC) {
          if (overlay._lastHtml !== "") {
            overlay._lastHtml = "";
            overlay.innerHTML = "";
          }
          return;
        }
        
        const c = activeTargetNPC;
        if (c.ragdollEnabled || !c.hp || c.hp <= 0) {
          if (overlay._lastHtml !== "") {
            overlay._lastHtml = "";
            overlay.innerHTML = "";
          }
          return;
        }

        const viewProj = multiplyMatrices(pMat, vMat);
        let htmlContent = "";

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
              if (overlay._lastHtml !== "") {
                overlay._lastHtml = "";
                overlay.innerHTML = "";
              }
              return;
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
            
            htmlContent = `
              <div class="npc-hp-bar" style="transform: translate(${Math.round(cssX)}px, ${Math.round(cssY)}px) translate(-50%, -100%); left: 0; top: 0;">
                ${slotsHtml}
              </div>
            `;
          }
        
        if (overlay._lastHtml !== htmlContent) {
          overlay._lastHtml = htmlContent;
          overlay.innerHTML = htmlContent;
        }
      }

      function damagePlayer(amount = 1, customNotice = null) {
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
          triggerUnconscious(customNotice);
        } else {
          playerDamageCooldown = 1.5; // 1.5 seconds invincibility
          showNotice(customNotice || `⚠️ คุณถูกทำร้าย! HP: ${playerHP}/${playerMaxHP}`);
        }
      }
      window.damagePlayer = damagePlayer;

      function applyPlayerFallDamage(amount = 1, height = 0) {
        if (playerHP <= 0) return;
        const msg = (playerHP - amount <= 0)
          ? `ตกจากที่สูงจนหมดสติ! (-${amount} HP)`
          : `⚠️ ตกจากที่สูง! (-${amount} HP) เหลือ ${Math.max(0, playerHP - amount)}/${playerMaxHP}`;
        damagePlayer(amount, msg);
      }
      window.applyPlayerFallDamage = applyPlayerFallDamage;

      let isUnconsciousActive = false;

      function triggerUnconscious(customNotice = null) {
        if (isUnconsciousActive) return;
        isUnconsciousActive = true;
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

        // บทลงโทษเมื่อหมดสติ: สุ่มทำลายไอเทมในกระเป๋า 1 ช่อง
        if (typeof window.destroyRandomInventorySlotOnUnconscious === "function") {
          window.destroyRandomInventorySlotOnUnconscious(customNotice);
        } else if (typeof destroyRandomInventorySlotOnUnconscious === "function") {
          destroyRandomInventorySlotOnUnconscious(customNotice);
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
          playerHunger = playerMaxHunger;
          playerHungerTimer = 0.0;
          playerStarvationTimer = 0.0;
          window.playerHunger = playerHunger;
          updatePlayerHPUI();
          isUnconsciousActive = false;
          if (typeof window.warpPlayerToCoords === "function") {
            window.warpPlayerToCoords(charTheta, charPhi);
          } else {
            playerDamageCooldown = 2.0;
            playerControlsLocked = false;
            setRagdoll(false);
            playerCenterRadius = null;
            playerVerticalVel = 0.0;
            saveSettingsToLocalStorage();
          }
        }, 3000); // 3 seconds ragdoll
      }

      // ระบบวาร์ปพิกัดตัวละคร (ใช้ระบบเดียวกับตอนสุ่มตื่นจากตอนที่หมดสติ)
      window.warpPlayerToCoords = function(targetTheta, targetPhi) {
        isUnconsciousActive = false;
        charTheta = targetTheta;
        charPhi = targetPhi;
        playerDamageCooldown = 2.0;
        playerControlsLocked = false;
        if (typeof setRagdoll === "function") {
          setRagdoll(false);
        }
        playerCenterRadius = null;
        playerVerticalVel = 0.0;
        isPlayerGrounded = true;
        if (typeof pendingCollectibleRefresh !== "undefined") {
          pendingCollectibleRefresh = true;
        }
        if (typeof saveSettingsToLocalStorage === "function") {
          saveSettingsToLocalStorage();
        }
      };
      let playerScale = 0.1;
      let playerCenterRadius = null;
      let playerVerticalVel = 0.0;
      let isPlayerGrounded = true;
      let ragdollInitialized = false;
      let ragdollDiedOnSurface = false;
      let ragdollPos = [0, 0, 0];
      let ragdollVel = [0, 0, 0];
      let ragdollQuat = [0, 0, 0, 1];
      let ragdollAngVel = [0, 0, 0];
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

      // =========================================================================
      // 3D Quaternion & Rigid-Body Math Helpers for Free Unconstrained Ragdoll
      // =========================================================================
      function quatMultiply(a, b) {
        const ax = a[0], ay = a[1], az = a[2], aw = a[3];
        const bx = b[0], by = b[1], bz = b[2], bw = b[3];
        return [
          aw * bx + ax * bw + ay * bz - az * by,
          aw * by - ax * bz + ay * bw + az * bx,
          aw * bz + ax * by - ay * bx + az * bw,
          aw * bw - ax * bx - ay * by - az * bz
        ];
      }

      function matrix3ToQuat(R, N, F) {
        const m00 = R[0], m01 = N[0], m02 = F[0];
        const m10 = R[1], m11 = N[1], m12 = F[1];
        const m20 = R[2], m21 = N[2], m22 = F[2];
        const tr = m00 + m11 + m22;
        let qx, qy, qz, qw;
        if (tr > 0) {
          const s = 0.5 / Math.sqrt(tr + 1.0);
          qw = 0.25 / s;
          qx = (m21 - m12) * s;
          qy = (m02 - m20) * s;
          qz = (m10 - m01) * s;
        } else if ((m00 > m11) && (m00 > m22)) {
          const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
          qw = (m21 - m12) / s;
          qx = 0.25 * s;
          qy = (m01 + m10) / s;
          qz = (m02 + m20) / s;
        } else if (m11 > m22) {
          const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
          qw = (m02 - m20) / s;
          qx = (m01 + m10) / s;
          qy = 0.25 * s;
          qz = (m12 + m21) / s;
        } else {
          const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
          qw = (m10 - m01) / s;
          qx = (m02 + m20) / s;
          qy = (m12 + m21) / s;
          qz = 0.25 * s;
        }
        const len = Math.hypot(qx, qy, qz, qw) || 1;
        return [qx / len, qy / len, qz / len, qw / len];
      }

      function quatToMatrix3(q) {
        const x = q[0], y = q[1], z = q[2], w = q[3];
        const x2 = x + x, y2 = y + y, z2 = z + z;
        const xx = x * x2, xy = x * y2, xz = x * z2;
        const yy = y * y2, yz = y * z2, zz = z * z2;
        const wx = w * x2, wy = w * y2, wz = w * z2;

        const R = [1 - (yy + zz), xy + wz, xz - wy];
        const N = [xy - wz, 1 - (xx + zz), yz + wx];
        const F = [xz + wy, yz - wx, 1 - (xx + yy)];
        return { R, N, F };
      }

      function integrateQuat(q, w, dt) {
        const len = Math.hypot(w[0], w[1], w[2]);
        if (len < 1e-6) return q;
        const halfAngle = len * dt * 0.5;
        const sinH = Math.sin(halfAngle) / len;
        const cosH = Math.cos(halfAngle);
        const dq = [w[0] * sinH, w[1] * sinH, w[2] * sinH, cosH];
        const nq = quatMultiply(dq, q);
        const l = Math.hypot(nq[0], nq[1], nq[2], nq[3]) || 1;
        return [nq[0] / l, nq[1] / l, nq[2] / l, nq[3] / l];
      }

      // =========================================================================
      // Option 2: Realistic Full Procedural Bone Ragdoll for GLB Model
      // Directly drives individual GLB Bone nodes (Hips, Spine02, Spine01, Spine, Neck,
      // Head, LeftArm, LeftForeArm, RightArm, RightForeArm, LeftUpLeg, LeftLeg,
      // RightUpLeg, RightLeg) per frame using spring-damper joint physics,
      // momentum inertia, gravity droop, and multi-directional ground sprawl contact.
      // =========================================================================
      const chibiRagdollState = {
        spine02: { pitch: 0, yaw: 0, roll: 0, vp: 0, vy: 0, vr: 0, tp: 0, ty: 0, tr: 0, rp: 0, ry: 0, rr: 0 },
        spine01: { pitch: 0, yaw: 0, roll: 0, vp: 0, vy: 0, vr: 0, tp: 0, ty: 0, tr: 0, rp: 0, ry: 0, rr: 0 },
        spine:   { pitch: 0, yaw: 0, roll: 0, vp: 0, vy: 0, vr: 0, tp: 0, ty: 0, tr: 0, rp: 0, ry: 0, rr: 0 },
        neck:    { pitch: 0, yaw: 0, roll: 0, vp: 0, vy: 0, vr: 0, tp: 0, ty: 0, tr: 0, rp: 0, ry: 0, rr: 0 },
        head:    { pitch: 0, yaw: 0, roll: 0, vp: 0, vy: 0, vr: 0, tp: 0, ty: 0, tr: 0, rp: 0, ry: 0, rr: 0 },
        leftArm:     { pitch: 0, yaw: 0, roll: -0.35, vp: 0, vy: 0, vr: 0, tp: 0, ty: 0, tr: -0.55, rp: 0.25, ry: 0.15, rr: -0.65 },
        leftForeArm: { flex: 0.2, vflex: 0, tflex: 0.55, rflex: 0.65 },
        leftHand:    { pitch: 0.15, yaw: 0, roll: -0.15 },
        rightArm:     { pitch: 0, yaw: 0, roll: 0.35, vp: 0, vy: 0, vr: 0, tp: 0, ty: 0, tr: 0.55, rp: -0.30, ry: -0.15, rr: 0.70 },
        rightForeArm: { flex: 0.2, vflex: 0, tflex: 0.55, rflex: 0.50 },
        rightHand:    { pitch: 0.15, yaw: 0, roll: 0.15 },
        leftUpLeg: { pitch: 0, yaw: 0, roll: 0.08, vp: 0, vy: 0, vr: 0, tp: 0, ty: 0, tr: 0.05, rp: -0.45, ry: 0.18, rr: -0.05 },
        leftLeg:   { kneeFlex: 0.2, vflex: 0, tflex: 0.65, rflex: 0.85 },
        leftFoot:  { pitch: 0.15, yaw: 0, roll: -0.08 },
        rightUpLeg: { pitch: 0, yaw: 0, roll: -0.08, vp: 0, vy: 0, vr: 0, tp: 0, ty: 0, tr: -0.05, rp: 0.12, ry: -0.22, rr: 0.05 },
        rightLeg:   { kneeFlex: 0.2, vflex: 0, tflex: 0.40, rflex: 0.42 },
        rightFoot:  { pitch: 0.15, yaw: 0, roll: 0.08 },
        hipsOffset: [0, 0, 0],
        hipsVel: [0, 0, 0],
        isGrounded: false,
        airTime: 0
      };

      function stepChibiJointSpring(curr, vel, target, stiffness, damping, dtSec) {
        const force = -stiffness * (curr - target) - damping * vel;
        const vNext = (vel + force * dtSec) * 0.992;
        const posNext = curr + vNext * dtSec;
        return { pos: posNext, vel: vNext };
      }

      function randomizeChibiCrumplePose(s, intensity = 1.0) {
        // Generate asymmetric GTA IV-style crumpled resting offsets so limbs never look like a stiff symmetrical mannequin
        const asymSign = Math.random() < 0.5 ? 1 : -1;
        const spineTwist = (Math.random() - 0.5) * 0.22 * intensity;
        const spineBend  = (Math.random() - 0.35) * 0.18 * intensity;
        const spineSide  = (Math.random() - 0.5) * 0.16 * intensity;

        s.spine02.rp = spineBend; s.spine02.ry = spineTwist * 0.6; s.spine02.rr = spineSide * 0.6;
        s.spine01.rp = spineBend; s.spine01.ry = spineTwist * 0.8; s.spine01.rr = spineSide * 0.8;
        s.spine.rp   = spineBend * 1.2; s.spine.ry = spineTwist; s.spine.rr = spineSide;
        s.neck.rp    = (Math.random() - 0.4) * 0.25; s.neck.ry = asymSign * (0.15 + Math.random() * 0.20); s.neck.rr = -spineSide * 0.8;
        s.head.rp    = (Math.random() - 0.4) * 0.30; s.head.ry = asymSign * (0.25 + Math.random() * 0.30); s.head.rr = (Math.random() - 0.5) * 0.20;

        // Asymmetric arms: e.g., one flung out/upward, one bent across or beside torso
        if (asymSign > 0) {
          s.leftArm.rp  = -0.55 + (Math.random() - 0.5) * 0.50;
          s.leftArm.rr  = -0.65 - Math.random() * 0.40;
          s.leftArm.ry  = (Math.random() - 0.5) * 0.35;
          s.leftForeArm.rflex = 0.55 + Math.random() * 0.65;

          s.rightArm.rp = 0.35 + (Math.random() - 0.5) * 0.45;
          s.rightArm.rr = 0.45 + Math.random() * 0.35;
          s.rightArm.ry = (Math.random() - 0.5) * 0.35;
          s.rightForeArm.rflex = 0.35 + Math.random() * 0.55;
        } else {
          s.leftArm.rp  = 0.35 + (Math.random() - 0.5) * 0.45;
          s.leftArm.rr  = -0.45 - Math.random() * 0.35;
          s.leftArm.ry  = (Math.random() - 0.5) * 0.35;
          s.leftForeArm.rflex = 0.35 + Math.random() * 0.55;

          s.rightArm.rp = -0.55 + (Math.random() - 0.5) * 0.50;
          s.rightArm.rr = 0.65 + Math.random() * 0.40;
          s.rightArm.ry = (Math.random() - 0.5) * 0.35;
          s.rightForeArm.rflex = 0.55 + Math.random() * 0.65;
        }

        // Asymmetric legs: one knee bent more (recovery/crumple), other leg more extended/twisted
        if (Math.random() < 0.5) {
          // Left leg bent up, right leg more relaxed
          s.leftUpLeg.rp  = -0.45 - Math.random() * 0.40; // negative rx swings thigh forward
          s.leftUpLeg.rr  = 0.04 + (Math.random() - 0.5) * 0.12;
          s.leftUpLeg.ry  = 0.15 + Math.random() * 0.25;
          s.leftLeg.rflex = 0.70 + Math.random() * 0.55;

          s.rightUpLeg.rp  = 0.05 + (Math.random() - 0.5) * 0.25;
          s.rightUpLeg.rr  = -0.06 + (Math.random() - 0.5) * 0.12;
          s.rightUpLeg.ry  = -0.15 - Math.random() * 0.20;
          s.rightLeg.rflex = 0.25 + Math.random() * 0.30;
        } else {
          // Right leg bent up, left leg more relaxed
          s.rightUpLeg.rp  = -0.45 - Math.random() * 0.40;
          s.rightUpLeg.rr  = -0.04 + (Math.random() - 0.5) * 0.12;
          s.rightUpLeg.ry  = -0.15 - Math.random() * 0.25;
          s.rightLeg.rflex = 0.70 + Math.random() * 0.55;

          s.leftUpLeg.rp  = 0.05 + (Math.random() - 0.5) * 0.25;
          s.leftUpLeg.rr  = 0.06 + (Math.random() - 0.5) * 0.12;
          s.leftUpLeg.ry  = 0.15 + Math.random() * 0.20;
          s.leftLeg.rflex = 0.25 + Math.random() * 0.30;
        }
      }

      function initChibiRagdollPhysics(phase = 0, isMoving = false, isSprinting = false) {
        const s = chibiRagdollState;
        const moveScale = isSprinting ? 1.4 : (isMoving ? 0.9 : 0.4);

        randomizeChibiCrumplePose(s, 1.0);

        // Initial velocity jolt on spine, neck, head (GTA IV stumble reaction)
        s.spine02.pitch = 0; s.spine02.yaw = 0; s.spine02.roll = 0;
        s.spine01.pitch = 0; s.spine01.yaw = 0; s.spine01.roll = 0;
        s.spine.pitch   = 0; s.spine.yaw   = 0; s.spine.roll   = 0;
        s.neck.pitch    = 0; s.neck.yaw    = 0; s.neck.roll    = 0;
        s.head.pitch    = 0; s.head.yaw    = 0; s.head.roll    = 0;

        s.spine02.vp = (Math.random() - 0.4) * 2.5 * moveScale;
        s.spine02.vy = (Math.random() - 0.5) * 2.0;
        s.spine02.vr = (Math.random() - 0.5) * 2.0;
        s.spine01.vp = s.spine02.vp * 1.1; s.spine01.vy = s.spine02.vy; s.spine01.vr = s.spine02.vr;
        s.spine.vp   = s.spine02.vp * 1.3; s.spine.vy   = s.spine02.vy * 1.2; s.spine.vr = s.spine02.vr * 1.2;
        s.neck.vp    = (Math.random() - 0.4) * 3.5; s.neck.vy = (Math.random() - 0.5) * 3.0; s.neck.vr = (Math.random() - 0.5) * 2.5;
        s.head.vp    = (Math.random() - 0.4) * 4.5; s.head.vy = (Math.random() - 0.5) * 3.5; s.head.vr = (Math.random() - 0.5) * 3.0;

        const armSwing = Math.sin(phase) * 0.55 * moveScale;
        s.leftArm.pitch = armSwing;
        s.leftArm.yaw = 0;
        s.leftArm.roll = -0.35;
        s.leftArm.vp = (Math.cos(phase) * 3.0 + (Math.random() - 0.5) * 2.5) * moveScale;
        s.leftArm.vy = (Math.random() - 0.5) * 2.5;
        s.leftArm.vr = -2.5 - Math.random() * 2.0;
        s.leftForeArm.flex = 0.25;
        s.leftForeArm.vflex = 2.0 + Math.random() * 2.5;

        s.rightArm.pitch = -armSwing;
        s.rightArm.yaw = 0;
        s.rightArm.roll = 0.35;
        s.rightArm.vp = (-Math.cos(phase) * 3.0 + (Math.random() - 0.5) * 2.5) * moveScale;
        s.rightArm.vy = (Math.random() - 0.5) * 2.5;
        s.rightArm.vr = 2.5 + Math.random() * 2.0;
        s.rightForeArm.flex = 0.25;
        s.rightForeArm.vflex = 2.0 + Math.random() * 2.5;

        const legSwing = Math.sin(phase + Math.PI) * 0.50 * moveScale;
        s.leftUpLeg.pitch = legSwing;
        s.leftUpLeg.yaw = 0;
        s.leftUpLeg.roll = 0.08;
        s.leftUpLeg.vp = (-legSwing * 3.0 - 1.5 * Math.random()) * moveScale;
        s.leftUpLeg.vy = (Math.random() - 0.5) * 2.0;
        s.leftUpLeg.vr = (Math.random() - 0.5) * 1.5;
        s.leftLeg.kneeFlex = 0.20;
        s.leftLeg.vflex = 2.5 + Math.random() * 3.0;

        s.rightUpLeg.pitch = -legSwing;
        s.rightUpLeg.yaw = 0;
        s.rightUpLeg.roll = -0.08;
        s.rightUpLeg.vp = (legSwing * 3.0 - 1.5 * Math.random()) * moveScale;
        s.rightUpLeg.vy = (Math.random() - 0.5) * 2.0;
        s.rightUpLeg.vr = (Math.random() - 0.5) * 1.5;
        s.rightLeg.kneeFlex = 0.20;
        s.rightLeg.vflex = 2.5 + Math.random() * 3.0;

        s.hipsOffset = [0, 0, 0];
        s.hipsVel = [0, 0, 0];
        s.isGrounded = false;
        s.airTime = 0;
      }

      function updateChibiRagdollPhysics(dt, hitSolid, impactDeltaV) {
        const s = chibiRagdollState;
        const wasGrounded = s.isGrounded;
        s.isGrounded = !!hitSolid;
        const dtSec = Math.min(0.05, Math.max(0.001, dt));
        if (!hitSolid) {
          s.airTime += dtSec;
        } else {
          s.airTime = 0;
        }

        // Current body orientation axes in world space:
        const { R: charR, N: charUp, F: charFwd } = (typeof ragdollQuat !== "undefined" && ragdollQuat && ragdollQuat.length === 4)
          ? quatToMatrix3(ragdollQuat)
          : { R: [1, 0, 0], N: [0, 1, 0], F: [0, 0, 1] };

        // World gravity direction (pointing straight down toward planet center)
        const pLen = Math.hypot(ragdollPos[0], ragdollPos[1], ragdollPos[2]) || 1;
        const gravWorld = [-ragdollPos[0] / pLen, -ragdollPos[1] / pLen, -ragdollPos[2] / pLen];

        // Project world gravity into the character's local coordinate space:
        // gx > 0: gravity pulls toward character's Right (+X)
        // gy > 0: gravity pulls toward character's Head (+Y)
        // gz > 0: gravity pulls toward character's Front (+Z)
        const gx = gravWorld[0] * charR[0]   + gravWorld[1] * charR[1]   + gravWorld[2] * charR[2];
        const gy = gravWorld[0] * charUp[0]  + gravWorld[1] * charUp[1]  + gravWorld[2] * charUp[2];
        const gz = gravWorld[0] * charFwd[0] + gravWorld[1] * charFwd[1] + gravWorld[2] * charFwd[2];

        // Linear & angular velocities projected into character local space
        const vx = (ragdollVel && ragdollVel.length === 3) ? (ragdollVel[0] * charR[0]   + ragdollVel[1] * charR[1]   + ragdollVel[2] * charR[2]) : 0;
        const vy = (ragdollVel && ragdollVel.length === 3) ? (ragdollVel[0] * charUp[0]  + ragdollVel[1] * charUp[1]  + ragdollVel[2] * charUp[2]) : 0;
        const vz = (ragdollVel && ragdollVel.length === 3) ? (ragdollVel[0] * charFwd[0] + ragdollVel[1] * charFwd[1] + ragdollVel[2] * charFwd[2]) : 0;
        const linSpeed = Math.hypot(vx, vy, vz);

        const wx = (ragdollAngVel && ragdollAngVel.length === 3) ? (ragdollAngVel[0] * charR[0]   + ragdollAngVel[1] * charR[1]   + ragdollAngVel[2] * charR[2]) : 0;
        const wy = (ragdollAngVel && ragdollAngVel.length === 3) ? (ragdollAngVel[0] * charUp[0]  + ragdollAngVel[1] * charUp[1]  + ragdollAngVel[2] * charUp[2]) : 0;
        const wz = (ragdollAngVel && ragdollAngVel.length === 3) ? (ragdollAngVel[0] * charFwd[0] + ragdollAngVel[1] * charFwd[1] + ragdollAngVel[2] * charFwd[2]) : 0;
        const rotSpeed = Math.hypot(wx, wy, wz);

        // --- 1. GTA IV Ground Impact & Collision Whiplash Impulse ---
        if (impactDeltaV && impactDeltaV.length === 3) {
          const impMag = Math.hypot(impactDeltaV[0], impactDeltaV[1], impactDeltaV[2]);
          if (impMag > 0.0015) {
            const impX = impactDeltaV[0] * charR[0]   + impactDeltaV[1] * charR[1]   + impactDeltaV[2] * charR[2];
            const impY = impactDeltaV[0] * charUp[0]  + impactDeltaV[1] * charUp[1]  + impactDeltaV[2] * charUp[2];
            const impZ = impactDeltaV[0] * charFwd[0] + impactDeltaV[1] * charFwd[1] + impactDeltaV[2] * charFwd[2];

            // Reshuffle resting crumple pose on strong impact so body folds naturally
            if (impMag > 0.005 || (!wasGrounded && hitSolid)) {
              randomizeChibiCrumplePose(s, Math.min(1.6, 0.8 + impMag * 35.0));
            }

            const whip = Math.min(18.0, impMag * 280.0);
            // Torso & Head whiplash (opposite to pelvis acceleration)
            s.spine02.vp -= impZ * 95.0;
            s.spine02.vr += impX * 95.0;
            s.spine01.vp -= impZ * 115.0;
            s.spine01.vr += impX * 115.0;
            s.spine.vp   -= impZ * 140.0;
            s.spine.vr   += impX * 140.0;
            s.neck.vp    -= impZ * 180.0;
            s.neck.vr    += impX * 180.0;
            s.head.vp    -= impZ * 220.0;
            s.head.vr    += impX * 220.0;
            s.head.vy    += (impX - impZ) * 120.0;

            // Arms whip wildly from impact deceleration
            s.leftArm.vp  -= impZ * 160.0 + (Math.random() - 0.5) * whip;
            s.rightArm.vp -= impZ * 160.0 + (Math.random() - 0.5) * whip;
            s.leftArm.vr  -= Math.abs(impY) * 130.0 + impX * 110.0;
            s.rightArm.vr += Math.abs(impY) * 130.0 - impX * 110.0;
            s.leftForeArm.vflex  += whip * (0.4 + Math.random() * 0.5);
            s.rightForeArm.vflex += whip * (0.4 + Math.random() * 0.5);

            // Legs & Knees buckle violently under axial/ground impact (GTA IV leg crumple!)
            const axialBuckle = Math.max(0, impY) * 180.0 + impMag * 95.0;
            s.leftUpLeg.vp  -= axialBuckle * (0.7 + Math.random() * 0.5) - impZ * 110.0;
            s.rightUpLeg.vp -= axialBuckle * (0.7 + Math.random() * 0.5) - impZ * 110.0;
            s.leftLeg.vflex  += axialBuckle * (0.9 + Math.random() * 0.6);
            s.rightLeg.vflex += axialBuckle * (0.9 + Math.random() * 0.6);
          }
        }

        // --- 2. Compute Dynamic Joint Targets (Mid-Air Euphoria Freefall vs Grounded Crumple) ---
        if (!hitSolid) {
          // === GTA IV MID-AIR FREEFALL / TUMBLE ===
          // Rushing air relative to falling body (-vx, -vy, -vz) + centrifugal spin throw + asymmetric pedaling
          const fallFactor = Math.min(1.5, linSpeed * 28.0 + rotSpeed * 2.5);
          const windUp = Math.max(0, -vy * 22.0); // upward air rush when falling feet-first
          const tAir = s.airTime * 9.5;

          // Euphoria mid-air torso arch & twist reacting to spin
          s.spine02.tp = gz * 0.16 - vz * 6.0 + Math.sin(tAir * 0.7) * 0.12 * fallFactor;
          s.spine02.tr = -gx * 0.16 + vx * 6.0 + wz * 0.8;
          s.spine02.ty = wy * 1.2;

          s.spine01.tp = s.spine02.tp * 1.15;
          s.spine01.tr = s.spine02.tr * 1.15;
          s.spine01.ty = s.spine02.ty * 1.15;

          s.spine.tp   = s.spine02.tp * 1.3;
          s.spine.tr   = s.spine02.tr * 1.3;
          s.spine.ty   = s.spine02.ty * 1.3;

          s.neck.tp = gz * 0.25 - vz * 9.0 - windUp * 0.25;
          s.neck.tr = -gx * 0.25 + vx * 9.0;
          s.neck.ty = wy * 1.8 + Math.cos(tAir * 0.8) * 0.20 * fallFactor;

          s.head.tp = gz * 0.30 - vz * 11.0 - windUp * 0.30;
          s.head.tr = -gx * 0.30 + vx * 11.0;
          s.head.ty = s.neck.ty * 1.3;

          // Arms: Wind rush + centrifugal throw + Euphoria asymmetric windmilling in freefall
          const armSpread = Math.min(1.05, 0.45 + windUp * 0.7 + rotSpeed * 3.5);
          const windmillL = Math.sin(tAir) * 0.65 * fallFactor;
          const windmillR = Math.cos(tAir * 1.1) * 0.65 * fallFactor;

          s.leftArm.tp  = gz * 0.50 - vz * 14.0 + windmillL;
          s.rightArm.tp = gz * 0.50 - vz * 14.0 + windmillR;
          s.leftArm.tr  = -armSpread - gx * 0.25 + Math.cos(tAir * 0.9) * 0.25 * fallFactor;
          s.rightArm.tr =  armSpread - gx * 0.25 + Math.sin(tAir * 0.9) * 0.25 * fallFactor;
          s.leftArm.ty  = -wy * 1.5;
          s.rightArm.ty = -wy * 1.5;

          s.leftForeArm.tflex  = 0.45 + windUp * 0.4 + Math.max(0, windmillL) * 0.6;
          s.rightForeArm.tflex = 0.45 + windUp * 0.4 + Math.max(0, windmillR) * 0.6;

          // Legs: Euphoria freefall pedaling + knee bending + air drag
          const pedalL = Math.sin(tAir * 1.15 + 1.2) * 0.55 * fallFactor;
          const pedalR = Math.sin(tAir * 1.15 + 4.3) * 0.55 * fallFactor;

          s.leftUpLeg.tp  = -gz * 0.35 + vz * 10.0 - windUp * 0.45 + pedalL;
          s.rightUpLeg.tp = -gz * 0.35 + vz * 10.0 - windUp * 0.45 + pedalR;
          s.leftUpLeg.tr  = 0.04 + gx * 0.20 - Math.min(0.25, rotSpeed * 1.2);
          s.rightUpLeg.tr = -0.04 + gx * 0.20 + Math.min(0.25, rotSpeed * 1.2);
          s.leftUpLeg.ty  = 0.12 * fallFactor;
          s.rightUpLeg.ty = -0.12 * fallFactor;

          s.leftLeg.tflex  = 0.40 + windUp * 0.55 + Math.max(0, -pedalL) * 0.85;
          s.rightLeg.tflex = 0.40 + windUp * 0.55 + Math.max(0, -pedalR) * 0.85;
        } else {
          // === GROUNDED: ORGANIC ASYMMETRIC GTA IV CRUMPLE & GRAVITY DRAPE ===
          // Combine the organic asymmetric resting pose (s.*.rp, ry, rr, rflex) with local gravity (gx, gz)
          // so the character lies in a natural, bent-limb ragdoll sprawl while conforming to the terrain slope!
          const slideFactor = Math.min(1.0, (linSpeed * 20.0 + rotSpeed * 2.0));

          s.spine02.tp = s.spine02.rp + gz * 0.08;
          s.spine02.ty = s.spine02.ry;
          s.spine02.tr = s.spine02.rr - gx * 0.08;

          s.spine01.tp = s.spine01.rp + gz * 0.08;
          s.spine01.ty = s.spine01.ry;
          s.spine01.tr = s.spine01.rr - gx * 0.08;

          s.spine.tp   = s.spine.rp + gz * 0.10;
          s.spine.ty   = s.spine.ry;
          s.spine.tr   = s.spine.rr - gx * 0.10;

          // Turn head to the side especially when face-down (gz > 0.25) so face rests on cheek
          const headSideTurn = (gz > 0.25) ? (s.head.ry >= 0 ? 0.48 : -0.48) : s.head.ry;
          s.neck.tp = s.neck.rp + gz * 0.12;
          s.neck.ty = headSideTurn * 0.55;
          s.neck.tr = s.neck.rr - gx * 0.12;

          s.head.tp = s.head.rp + gz * 0.15;
          s.head.ty = headSideTurn;
          s.head.tr = s.head.rr - gx * 0.15;

          // Sprawled asymmetric arms pulled onto ground surface by gravity
          s.leftArm.tp  = s.leftArm.rp + gz * 0.25 - vz * 8.0 * slideFactor;
          s.leftArm.ty  = s.leftArm.ry;
          s.leftArm.tr  = Math.max(-1.15, Math.min(-0.15, s.leftArm.rr - gx * 0.25));
          s.leftForeArm.tflex = s.leftForeArm.rflex;

          s.rightArm.tp = s.rightArm.rp + gz * 0.25 - vz * 8.0 * slideFactor;
          s.rightArm.ty = s.rightArm.ry;
          s.rightArm.tr = Math.max(0.15, Math.min(1.15, s.rightArm.rr - gx * 0.25));
          s.rightForeArm.tflex = s.rightForeArm.rflex;

          // Asymmetric crumpled legs:
          // Keep knees naturally bent (rflex) and thighs asymmetrically flexed (rp),
          // while ensuring gravity pulls raised knees/feet down onto the ground surface!
          const gravLegDrop = gz < 0 ? (-gz * 0.18) : (-gz * 0.05);
          const latLegDrop  = gx * 0.22;

          s.leftUpLeg.tp  = s.leftUpLeg.rp * (gz < -0.5 ? 0.45 : 0.85) + gravLegDrop;
          s.leftUpLeg.ty  = s.leftUpLeg.ry;
          s.leftUpLeg.tr  = 0.08 + s.leftUpLeg.rr + latLegDrop;
          s.leftLeg.tflex = s.leftLeg.rflex;

          s.rightUpLeg.tp  = s.rightUpLeg.rp * (gz < -0.5 ? 0.45 : 0.85) + gravLegDrop;
          s.rightUpLeg.ty  = s.rightUpLeg.ry;
          s.rightUpLeg.tr  = -0.08 + s.rightUpLeg.rr + latLegDrop;
          s.rightLeg.tflex = s.rightLeg.rflex;
        }

        // --- 3. Loose Pendulum Spring-Damper Integration (Low Stiffness like GTA IV!) ---
        const kTorso = hitSolid ? 10.0 : 6.5;
        const dTorso = hitSolid ? 5.2  : 2.8;

        let r;
        r = stepChibiJointSpring(s.spine02.pitch, s.spine02.vp, s.spine02.tp, kTorso, dTorso, dtSec);
        s.spine02.pitch = Math.max(-0.55, Math.min(0.65, r.pos)); s.spine02.vp = r.vel;
        r = stepChibiJointSpring(s.spine02.yaw, s.spine02.vy, s.spine02.ty, kTorso, dTorso, dtSec);
        s.spine02.yaw = Math.max(-0.45, Math.min(0.45, r.pos)); s.spine02.vy = r.vel;
        r = stepChibiJointSpring(s.spine02.roll, s.spine02.vr, s.spine02.tr, kTorso, dTorso, dtSec);
        s.spine02.roll = Math.max(-0.45, Math.min(0.45, r.pos)); s.spine02.vr = r.vel;

        r = stepChibiJointSpring(s.spine01.pitch, s.spine01.vp, s.spine01.tp, kTorso, dTorso, dtSec);
        s.spine01.pitch = Math.max(-0.55, Math.min(0.65, r.pos)); s.spine01.vp = r.vel;
        r = stepChibiJointSpring(s.spine01.yaw, s.spine01.vy, s.spine01.ty, kTorso, dTorso, dtSec);
        s.spine01.yaw = Math.max(-0.45, Math.min(0.45, r.pos)); s.spine01.vy = r.vel;
        r = stepChibiJointSpring(s.spine01.roll, s.spine01.vr, s.spine01.tr, kTorso, dTorso, dtSec);
        s.spine01.roll = Math.max(-0.45, Math.min(0.45, r.pos)); s.spine01.vr = r.vel;

        r = stepChibiJointSpring(s.spine.pitch, s.spine.vp, s.spine.tp, kTorso, dTorso, dtSec);
        s.spine.pitch = Math.max(-0.60, Math.min(0.70, r.pos)); s.spine.vp = r.vel;
        r = stepChibiJointSpring(s.spine.yaw, s.spine.vy, s.spine.ty, kTorso, dTorso, dtSec);
        s.spine.yaw = Math.max(-0.50, Math.min(0.50, r.pos)); s.spine.vy = r.vel;
        r = stepChibiJointSpring(s.spine.roll, s.spine.vr, s.spine.tr, kTorso, dTorso, dtSec);
        s.spine.roll = Math.max(-0.50, Math.min(0.50, r.pos)); s.spine.vr = r.vel;

        r = stepChibiJointSpring(s.neck.pitch, s.neck.vp, s.neck.tp, kTorso * 0.85, dTorso * 0.85, dtSec);
        s.neck.pitch = Math.max(-0.65, Math.min(0.75, r.pos)); s.neck.vp = r.vel;
        r = stepChibiJointSpring(s.neck.yaw, s.neck.vy, s.neck.ty, kTorso * 0.85, dTorso * 0.85, dtSec);
        s.neck.yaw = Math.max(-0.75, Math.min(0.75, r.pos)); s.neck.vy = r.vel;
        r = stepChibiJointSpring(s.neck.roll, s.neck.vr, s.neck.tr, kTorso * 0.85, dTorso * 0.85, dtSec);
        s.neck.roll = Math.max(-0.55, Math.min(0.55, r.pos)); s.neck.vr = r.vel;

        r = stepChibiJointSpring(s.head.pitch, s.head.vp, s.head.tp, kTorso * 0.75, dTorso * 0.75, dtSec);
        s.head.pitch = Math.max(-0.75, Math.min(0.85, r.pos)); s.head.vp = r.vel;
        r = stepChibiJointSpring(s.head.yaw, s.head.vy, s.head.ty, kTorso * 0.75, dTorso * 0.75, dtSec);
        s.head.yaw = Math.max(-0.95, Math.min(0.95, r.pos)); s.head.vy = r.vel;
        r = stepChibiJointSpring(s.head.roll, s.head.vr, s.head.tr, kTorso * 0.75, dTorso * 0.75, dtSec);
        s.head.roll = Math.max(-0.65, Math.min(0.65, r.pos)); s.head.vr = r.vel;

        const kLimb = hitSolid ? 8.5 : 5.5;
        const dLimb = hitSolid ? 4.8 : 2.4;

        // Left Arm
        r = stepChibiJointSpring(s.leftArm.pitch, s.leftArm.vp, s.leftArm.tp, kLimb, dLimb, dtSec);
        s.leftArm.pitch = Math.max(-1.4, Math.min(1.4, r.pos)); s.leftArm.vp = r.vel;
        r = stepChibiJointSpring(s.leftArm.roll, s.leftArm.vr, s.leftArm.tr, kLimb, dLimb, dtSec);
        s.leftArm.roll = Math.max(-1.35, Math.min(0.25, r.pos)); s.leftArm.vr = r.vel;
        r = stepChibiJointSpring(s.leftArm.yaw, s.leftArm.vy, s.leftArm.ty, kLimb, dLimb, dtSec);
        s.leftArm.yaw = Math.max(-0.85, Math.min(0.85, r.pos)); s.leftArm.vy = r.vel;
        r = stepChibiJointSpring(s.leftForeArm.flex, s.leftForeArm.vflex, s.leftForeArm.tflex, kLimb, dLimb, dtSec);
        s.leftForeArm.flex = Math.max(0.05, Math.min(1.65, r.pos)); s.leftForeArm.vflex = r.vel;

        // Right Arm
        r = stepChibiJointSpring(s.rightArm.pitch, s.rightArm.vp, s.rightArm.tp, kLimb, dLimb, dtSec);
        s.rightArm.pitch = Math.max(-1.4, Math.min(1.4, r.pos)); s.rightArm.vp = r.vel;
        r = stepChibiJointSpring(s.rightArm.roll, s.rightArm.vr, s.rightArm.tr, kLimb, dLimb, dtSec);
        s.rightArm.roll = Math.max(-0.25, Math.min(1.35, r.pos)); s.rightArm.vr = r.vel;
        r = stepChibiJointSpring(s.rightArm.yaw, s.rightArm.vy, s.rightArm.ty, kLimb, dLimb, dtSec);
        s.rightArm.yaw = Math.max(-0.85, Math.min(0.85, r.pos)); s.rightArm.vy = r.vel;
        r = stepChibiJointSpring(s.rightForeArm.flex, s.rightForeArm.vflex, s.rightForeArm.tflex, kLimb, dLimb, dtSec);
        s.rightForeArm.flex = Math.max(0.05, Math.min(1.65, r.pos)); s.rightForeArm.vflex = r.vel;

        // Left Leg
        r = stepChibiJointSpring(s.leftUpLeg.pitch, s.leftUpLeg.vp, s.leftUpLeg.tp, kLimb, dLimb, dtSec);
        s.leftUpLeg.pitch = Math.max(-1.35, Math.min(0.95, r.pos)); s.leftUpLeg.vp = r.vel;
        r = stepChibiJointSpring(s.leftUpLeg.roll, s.leftUpLeg.vr, s.leftUpLeg.tr, kLimb, dLimb, dtSec);
        s.leftUpLeg.roll = Math.max(-0.45, Math.min(0.45, r.pos)); s.leftUpLeg.vr = r.vel;
        r = stepChibiJointSpring(s.leftUpLeg.yaw, s.leftUpLeg.vy, s.leftUpLeg.ty, kLimb, dLimb, dtSec);
        s.leftUpLeg.yaw = Math.max(-0.65, Math.min(0.65, r.pos)); s.leftUpLeg.vy = r.vel;
        r = stepChibiJointSpring(s.leftLeg.kneeFlex, s.leftLeg.vflex, s.leftLeg.tflex, kLimb, dLimb, dtSec);
        s.leftLeg.kneeFlex = Math.max(0.05, Math.min(1.85, r.pos)); s.leftLeg.vflex = r.vel;

        // Right Leg
        r = stepChibiJointSpring(s.rightUpLeg.pitch, s.rightUpLeg.vp, s.rightUpLeg.tp, kLimb, dLimb, dtSec);
        s.rightUpLeg.pitch = Math.max(-1.35, Math.min(0.95, r.pos)); s.rightUpLeg.vp = r.vel;
        r = stepChibiJointSpring(s.rightUpLeg.roll, s.rightUpLeg.vr, s.rightUpLeg.tr, kLimb, dLimb, dtSec);
        s.rightUpLeg.roll = Math.max(-0.45, Math.min(0.45, r.pos)); s.rightUpLeg.vr = r.vel;
        r = stepChibiJointSpring(s.rightUpLeg.yaw, s.rightUpLeg.vy, s.rightUpLeg.ty, kLimb, dLimb, dtSec);
        s.rightUpLeg.yaw = Math.max(-0.65, Math.min(0.65, r.pos)); s.rightUpLeg.vy = r.vel;
        r = stepChibiJointSpring(s.rightLeg.kneeFlex, s.rightLeg.vflex, s.rightLeg.tflex, kLimb, dLimb, dtSec);
        s.rightLeg.kneeFlex = Math.max(0.05, Math.min(1.85, r.pos)); s.rightLeg.vflex = r.vel;
      }

      function resetChibiRagdollPhysics() {
        const s = chibiRagdollState;
        s.spine02.pitch = 0; s.spine02.yaw = 0; s.spine02.roll = 0; s.spine02.vp = 0; s.spine02.vy = 0; s.spine02.vr = 0;
        s.spine01.pitch = 0; s.spine01.yaw = 0; s.spine01.roll = 0; s.spine01.vp = 0; s.spine01.vy = 0; s.spine01.vr = 0;
        s.spine.pitch = 0; s.spine.yaw = 0; s.spine.roll = 0; s.spine.vp = 0; s.spine.vy = 0; s.spine.vr = 0;
        s.neck.pitch = 0; s.neck.yaw = 0; s.neck.roll = 0; s.neck.vp = 0; s.neck.vy = 0; s.neck.vr = 0;
        s.head.pitch = 0; s.head.yaw = 0; s.head.roll = 0; s.head.vp = 0; s.head.vy = 0; s.head.vr = 0;
        s.leftArm.pitch = 0; s.leftArm.yaw = 0; s.leftArm.roll = -0.30; s.leftArm.vp = 0; s.leftArm.vy = 0; s.leftArm.vr = 0;
        s.leftForeArm.flex = 0.15; s.leftForeArm.vflex = 0;
        s.rightArm.pitch = 0; s.rightArm.yaw = 0; s.rightArm.roll = 0.30; s.rightArm.vp = 0; s.rightArm.vy = 0; s.rightArm.vr = 0;
        s.rightForeArm.flex = 0.15; s.rightForeArm.vflex = 0;
        s.leftUpLeg.pitch = 0; s.leftUpLeg.yaw = 0; s.leftUpLeg.roll = 0.08; s.leftUpLeg.vp = 0; s.leftUpLeg.vy = 0; s.leftUpLeg.vr = 0;
        s.leftLeg.kneeFlex = 0.15; s.leftLeg.vflex = 0;
        s.rightUpLeg.pitch = 0; s.rightUpLeg.yaw = 0; s.rightUpLeg.roll = -0.08; s.rightUpLeg.vp = 0; s.rightUpLeg.vy = 0; s.rightUpLeg.vr = 0;
        s.rightLeg.kneeFlex = 0.15; s.rightLeg.vflex = 0;
        s.isGrounded = false;
        s.airTime = 0;
        ragdollQuat = [0, 0, 0, 1];
        ragdollAngVel = [0, 0, 0];
      }

      function getChibiRagdollBoneTransforms() {
        const s = chibiRagdollState;
        return {
          Hips: [0, 0, 0],
          Spine02: [s.spine02.pitch, s.spine02.yaw, s.spine02.roll],
          Spine01: [s.spine01.pitch, s.spine01.yaw, s.spine01.roll],
          Spine:   [s.spine.pitch, s.spine.yaw, s.spine.roll],
          neck:    [s.neck.pitch, s.neck.yaw, s.neck.roll],
          Head:    [s.head.pitch, s.head.yaw, s.head.roll],
          LeftArm:     [s.leftArm.pitch, s.leftArm.yaw, s.leftArm.roll],
          LeftForeArm: [s.leftForeArm.flex, 0, -s.leftForeArm.flex * 0.25],
          LeftHand:    [0.12, 0, -0.12],
          RightArm:     [s.rightArm.pitch, s.rightArm.yaw, s.rightArm.roll],
          RightForeArm: [s.rightForeArm.flex, 0, s.rightForeArm.flex * 0.25],
          RightHand:    [0.12, 0, 0.12],
          LeftUpLeg:  [s.leftUpLeg.pitch, s.leftUpLeg.yaw, s.leftUpLeg.roll],
          LeftLeg:    [s.leftLeg.kneeFlex, 0, 0],
          LeftFoot:   [0.12, 0, 0],
          RightUpLeg: [s.rightUpLeg.pitch, s.rightUpLeg.yaw, s.rightUpLeg.roll],
          RightLeg:   [s.rightLeg.kneeFlex, 0, 0],
          RightFoot:  [0.12, 0, 0]
        };
      }

      var RADIUS = 32.0;
      var HEIGHT_SCALE = 0.6 * Math.pow(32.0 / 8.0, 0.70);
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
      let showPlanetWireframe = false;
      if (typeof window !== "undefined") {
        window.showPlanetWireframe = showPlanetWireframe;
      }
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

      // --- Render Distance State (Hierarchy: 1. Terrain: 32.0, 2. Landmarks: 20.0, 3. Shadows: 14.0, 4. Objects: 6.0, 5. Grass: 4.5) ---
      let renderDistEnabled = true;
      let terrainRenderDistValue = 32.0;
      let landmarkRenderDistValue = 20.0;
      let shadowRenderDistValue = 14.0;
      let objectRenderDistValue = 6.0;
      let grassRenderDistValue = 4.5;
      let renderDistValue = 32.0; // for backwards compatibility

      // Expose to window for global access and devgame.js integration
      if (typeof window !== "undefined") {
        window.renderDistEnabled = renderDistEnabled;
        window.terrainRenderDistValue = terrainRenderDistValue;
        window.landmarkRenderDistValue = landmarkRenderDistValue;
        window.shadowRenderDistValue = shadowRenderDistValue;
        window.objectRenderDistValue = objectRenderDistValue;
        window.grassRenderDistValue = grassRenderDistValue;
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
      // ฟังก์ชันระบบสร้างเชิงลึกของตัวละครสามมิติดินปั้นขาวเงา (ดึงจาก capsuleModel.js ส่วนกลาง)
      // ============================================
      const rotatePointX = (pivot, point, theta) => (window.CapsuleModel ? window.CapsuleModel.rotatePointX(pivot, point, theta) : window.rotatePointX(pivot, point, theta));
      const rotatePointY = (pivot, point, theta) => (window.CapsuleModel ? window.CapsuleModel.rotatePointY(pivot, point, theta) : window.rotatePointY(pivot, point, theta));
      const rotatePointZ = (pivot, point, theta) => (window.CapsuleModel ? window.CapsuleModel.rotatePointZ(pivot, point, theta) : window.rotatePointZ(pivot, point, theta));
      const generateCapsule = (p1, p2, r, rad, ax) => (window.CapsuleModel ? window.CapsuleModel.generateCapsule(p1, p2, r, rad, ax) : window.generateCapsule(p1, p2, r, rad, ax));
      const generateChibiHead = (p1, p2, r, sf) => (window.CapsuleModel && window.CapsuleModel.generateChibiHead ? window.CapsuleModel.generateChibiHead(p1, p2, r, sf) : generateCapsule(p1, p2, r, 16, 16));
      const generateChibiNeck = (p1, p2, r, sf) => (window.CapsuleModel && window.CapsuleModel.generateChibiNeck ? window.CapsuleModel.generateChibiNeck(p1, p2, r, sf) : generateCapsule(p1, p2, r, 12, 8));
      const generateChibiEar = (p1, p2, isL, sf) => (window.CapsuleModel && window.CapsuleModel.generateChibiEar ? window.CapsuleModel.generateChibiEar(p1, p2, isL, sf) : generateCapsule(p1, p2, 0.018 * sf, 10, 8));
      const generateChibiTorso = (p1, p2, r, sf, ...rest) => (window.CapsuleModel && window.CapsuleModel.generateChibiTorso ? window.CapsuleModel.generateChibiTorso(p1, p2, r, sf, ...rest) : (window.CapsuleModel && window.CapsuleModel.generateChibiChest ? window.CapsuleModel.generateChibiChest(p1, p2, r, sf) : generateCapsule(p1, p2, r, 16, 12)));
      const generateChibiChest = (p1, p2, r, sf) => (window.CapsuleModel && window.CapsuleModel.generateChibiChest ? window.CapsuleModel.generateChibiChest(p1, p2, r, sf) : generateCapsule(p1, p2, r, 16, 12));
      const generateChibiPelvis = (p1, p2, r, sf) => (window.CapsuleModel && window.CapsuleModel.generateChibiPelvis ? window.CapsuleModel.generateChibiPelvis(p1, p2, r, sf) : generateCapsule(p1, p2, r, 16, 12));
      const generateChibiUpperArm = (p1, p2, isL, sf, ...rest) => (window.CapsuleModel && window.CapsuleModel.generateChibiUpperArm ? window.CapsuleModel.generateChibiUpperArm(p1, p2, isL, sf, ...rest) : generateCapsule(p1, p2, 0.038 * sf, 12, 10));
      const generateChibiForeArm = (p1, p2, isL, sf) => (window.CapsuleModel && window.CapsuleModel.generateChibiForeArm ? window.CapsuleModel.generateChibiForeArm(p1, p2, isL, sf) : generateCapsule(p1, p2, 0.032 * sf, 12, 10));
      const generateChibiThigh = (p1, p2, isL, sf, ...rest) => (window.CapsuleModel && window.CapsuleModel.generateChibiThigh ? window.CapsuleModel.generateChibiThigh(p1, p2, isL, sf, ...rest) : generateCapsule(p1, p2, 0.048 * sf, 12, 10));
      const generateChibiCalf = (p1, p2, isL, sf, ...rest) => (window.CapsuleModel && window.CapsuleModel.generateChibiCalf ? window.CapsuleModel.generateChibiCalf(p1, p2, isL, sf, ...rest) : generateCapsule(p1, p2, 0.040 * sf, 12, 10));
      const mergeMeshes = (meshes, verticesOnly = false) => (window.CapsuleModel ? window.CapsuleModel.mergeMeshes(meshes, verticesOnly) : window.mergeMeshes(meshes, verticesOnly));
      const buildHandAndFingers = (pElbow, pHand, isLeft, sf) => (window.CapsuleModel ? window.CapsuleModel.buildHandAndFingers(pElbow, pHand, isLeft, sf) : window.buildHandAndFingers(pElbow, pHand, isLeft, sf));
      const buildFootAnkleToes = (pKnee, pFoot, isLeft, sf) => (window.CapsuleModel ? window.CapsuleModel.buildFootAnkleToes(pKnee, pFoot, isLeft, sf) : window.buildFootAnkleToes(pKnee, pFoot, isLeft, sf));
      const resetCapsuleBufferPool = () => (window.CapsuleModel ? window.CapsuleModel.resetCapsuleBufferPool() : (window.resetCapsuleBufferPool && window.resetCapsuleBufferPool()));
      const resetMergeBufferPool = () => (window.CapsuleModel ? window.CapsuleModel.resetMergeBufferPool() : (window.resetMergeBufferPool && window.resetMergeBufferPool()));

      function initRagdoll(px, py, pz, rx_scaled, ry_scaled, rz_scaled, phase) {
        ragdollPos = [px, py, pz];

        const r_len = Math.sqrt(
          rx_scaled[0] ** 2 + rx_scaled[1] ** 2 + rx_scaled[2] ** 2,
        ) || 1.0;
        const ry_len = Math.sqrt(
          ry_scaled[0] ** 2 + ry_scaled[1] ** 2 + ry_scaled[2] ** 2,
        ) || 1.0;
        const rz_len = Math.sqrt(
          rz_scaled[0] ** 2 + rz_scaled[1] ** 2 + rz_scaled[2] ** 2,
        ) || 1.0;

        const rx = [
          rx_scaled[0] / r_len,
          rx_scaled[1] / r_len,
          rx_scaled[2] / r_len,
        ];
        const ry = [
          ry_scaled[0] / ry_len,
          ry_scaled[1] / ry_len,
          ry_scaled[2] / ry_len,
        ];
        const rz = [
          rz_scaled[0] / rz_len,
          rz_scaled[1] / rz_len,
          rz_scaled[2] / rz_len,
        ];

        // 1. Seed full 3D orientation quaternion from current body frame
        ragdollQuat = matrix3ToQuat(rx, ry, rz);

        // Check if underwater to avoid huge pushes
        const dist = Math.sqrt(px * px + py * py + pz * pz);
        let inWater = false;
        if (waterEnabled && dist > 0.001) {
          const wRadius = typeof getWaterRadiusAt === "function"
            ? getWaterRadiusAt(px, py, pz)
            : RADIUS + waterLevel * 0.15;
          inWater = dist < wRadius + 0.05;
        }

        // 2. Inherit genuine movement momentum from locomotion
        const isSprint = (typeof isSprinting !== "undefined" && isSprinting);
        const isWalk = (typeof isWalking !== "undefined" && isWalking);
        const curSpeed = isSprint ? (playerSpeed * 1.7) : (isWalk ? playerSpeed : 0.0);
        const vertSpeed = (typeof window !== "undefined" && typeof window._ragdollInitialVerticalVel === "number" && !isNaN(window._ragdollInitialVerticalVel))
          ? window._ragdollInitialVerticalVel
          : ((typeof playerVerticalVel === "number" && !isNaN(playerVerticalVel)) ? playerVerticalVel : 0.0);
        if (typeof window !== "undefined") {
          window._ragdollInitialVerticalVel = null;
        }

        let vx = rz[0] * curSpeed + ry[0] * vertSpeed;
        let vy = rz[1] * curSpeed + ry[1] * vertSpeed;
        let vz = rz[2] * curSpeed + ry[2] * vertSpeed;

        if (curSpeed > 0.002) {
          // Moving: Trip/stumble and tumble forward with momentum!
          const tumbleSpeed = 0.08 + curSpeed * 6.0;
          const lateralTwist = (Math.random() - 0.5) * 0.05;
          ragdollAngVel = [
            rx[0] * tumbleSpeed + rz[0] * lateralTwist,
            rx[1] * tumbleSpeed + rz[1] * lateralTwist,
            rx[2] * tumbleSpeed + rz[2] * lateralTwist
          ];
        } else {
          // Stationary collapse (e.g. fainting / pass out / dying / knock out)
          // 35% fall backward on back, 40% buckle sideways (left/right hip), 25% slump forward
          const choice = Math.random();
          let dirX, dirZ, pitchTorque, rollTorque;
          if (choice < 0.35) {
            // Fall BACKWARD!
            dirX = (Math.random() - 0.5) * 0.4;
            dirZ = -0.7 - Math.random() * 0.5; // push backward along -Z
            pitchTorque = -0.06 - Math.random() * 0.05; // negative pitch rotates backward!
            rollTorque = (Math.random() - 0.5) * 0.03;
          } else if (choice < 0.75) {
            // Fall SIDEWAYS!
            const sideSign = Math.random() < 0.5 ? -1 : 1;
            dirX = sideSign * (0.8 + Math.random() * 0.4);
            dirZ = (Math.random() - 0.5) * 0.4;
            pitchTorque = (Math.random() - 0.5) * 0.03;
            rollTorque = -sideSign * (0.06 + Math.random() * 0.05); // roll to side!
          } else {
            // Slump forward
            dirX = (Math.random() - 0.5) * 0.4;
            dirZ = 0.7 + Math.random() * 0.4;
            pitchTorque = 0.06 + Math.random() * 0.05;
            rollTorque = (Math.random() - 0.5) * 0.03;
          }

          const impulseSpeed = inWater ? 0.003 : 0.009;
          vx += (rx[0] * dirX + rz[0] * dirZ) * impulseSpeed;
          vy += (rx[1] * dirX + rz[1] * dirZ) * impulseSpeed;
          vz += (rx[2] * dirX + rz[2] * dirZ) * impulseSpeed;

          const yawTorque = (Math.random() - 0.5) * 0.04;
          ragdollAngVel = [
            rx[0] * pitchTorque + ry[0] * yawTorque + rz[0] * rollTorque,
            rx[1] * pitchTorque + ry[1] * yawTorque + rz[1] * rollTorque,
            rx[2] * pitchTorque + ry[2] * yawTorque + rz[2] * rollTorque
          ];
        }

        ragdollVel = [vx, vy, vz];

        // Maintain legacy variables for backwards compatibility
        ragdollAxis = [rx[0], rx[1], rx[2]];
        ragdollAngle = 0;
        ragdollAngularSpeed = Math.hypot(ragdollAngVel[0], ragdollAngVel[1], ragdollAngVel[2]);

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

        if (typeof initChibiRagdollPhysics === "function") {
          initChibiRagdollPhysics(phase, (typeof isWalking !== "undefined" && isWalking), (typeof isSprinting !== "undefined" && isSprinting));
        }

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
        if (!ragdollInitialized) {
          if (ragdollEnabled) {
            const sinT = Math.sin(charTheta);
            const cosT = Math.cos(charTheta);
            const sinP = Math.sin(charPhi);
            const cosP = Math.cos(charPhi);
            const seed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0);
            const curHeight = (typeof getVisualHeightOnSphere === "function") ? getVisualHeightOnSphere(charTheta, charPhi, seed) : 0;
            const rPos = RADIUS + curHeight * HEIGHT_SCALE + 0.46 * playerScale;
            const px = sinT * cosP * rPos;
            const py = cosT * rPos;
            const pz = sinT * sinP * rPos;

            const N = [sinT * cosP, cosT, sinT * sinP];
            const F = [-cosT * cosP, sinT, -cosT * sinP];
            const R = [-sinP, 0, cosP];

            initRagdoll(px, py, pz, R, N, F, typeof walkPhase !== "undefined" ? walkPhase : 0);
          } else {
            return;
          }
        }
        const dtScale = dt / 0.016666;
        let isRagdollOnGround = false;

        let immersion = 0.0;
        let depth = -1.0;

        const r = Math.sqrt(
          ragdollPos[0] ** 2 + ragdollPos[1] ** 2 + ragdollPos[2] ** 2,
        );
        if (r > 0.001) {
          // Track highest point reached during ragdoll freefall
          if (typeof window._ragdollHighestAirRadius !== "number" || r > window._ragdollHighestAirRadius) {
            window._ragdollHighestAirRadius = r;
          }

          const nx = ragdollPos[0] / r;
          const ny = ragdollPos[1] / r;
          const nz = ragdollPos[2] / r;

          const caveData = typeof getTerrainSurfaceAndCeiling === "function"
            ? getTerrainSurfaceAndCeiling(nx, ny, nz, r)
            : { ground: RADIUS + (typeof getHeightOnSphere === "function" ? getVisualHeightOnSphere(Math.acos(Math.max(-1.0, Math.min(1.0, ny))), Math.atan2(nz, nx), (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) : 0) * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };

          // Use Physics engine with realistic freefall gravity (no duplicate air friction)
          Physics.applyGravity(ragdollVel, nx, ny, nz, dtScale, 0.00062);

          // Light air drag on 3D angular rotation
          if (ragdollAngVel && ragdollAngVel.length === 3) {
            ragdollAngVel[0] *= Math.pow(0.993, dtScale);
            ragdollAngVel[1] *= Math.pow(0.993, dtScale);
            ragdollAngVel[2] *= Math.pow(0.993, dtScale);
          }

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
          // Low aerodynamic air drag (0.996) in air so high falls accelerate realistically; strong drag in water
          const waterFriction = isNearSurface ? 0.85 : 0.78;
          const friction = 0.996 * (1.0 - immersion) + waterFriction * immersion;
          Physics.applyFriction(ragdollVel, friction, dtScale);
          if (ragdollAngVel && ragdollAngVel.length === 3) {
            const waterAngDamp = Math.pow(0.92, dtScale);
            ragdollAngVel[0] = ragdollAngVel[0] * (1.0 - immersion) + ragdollAngVel[0] * waterAngDamp * immersion;
            ragdollAngVel[1] = ragdollAngVel[1] * (1.0 - immersion) + ragdollAngVel[1] * waterAngDamp * immersion;
            ragdollAngVel[2] = ragdollAngVel[2] * (1.0 - immersion) + ragdollAngVel[2] * waterAngDamp * immersion;
          }

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
                // Deep underwater: sink slowly!
                buoyancyFactor = 0.75 * immersion;
              }
            }
            Physics.applyBuoyancyForce(ragdollVel, nx, ny, nz, buoyancyFactor, dtScale);

            // Gentle underwater drift and swaying
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

            // Apply vertical damping to kill oscillations for floating bodies at surface
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

        // 1. Integrate linear position
        ragdollPos[0] += ragdollVel[0] * dtScale;
        ragdollPos[1] += ragdollVel[1] * dtScale;
        ragdollPos[2] += ragdollVel[2] * dtScale;

        // 2. Integrate unconstrained 3D angular rotation quaternion (Free 360-degree tumbling)
        if (ragdollAngVel && ragdollAngVel.length === 3) {
          ragdollQuat = integrateQuat(ragdollQuat, ragdollAngVel, dtScale);
        }

        // Synchronize legacy helpers
        const mCurr = quatToMatrix3(ragdollQuat);
        ragdollBaseMatrix = [
          mCurr.R[0], mCurr.R[1], mCurr.R[2], 0,
          mCurr.N[0], mCurr.N[1], mCurr.N[2], 0,
          mCurr.F[0], mCurr.F[1], mCurr.F[2], 0,
          0, 0, 0, 1
        ];
        ragdollAngle = 0;
        ragdollAxis = [mCurr.R[0], mCurr.R[1], mCurr.R[2]];
        ragdollAngularSpeed = (ragdollAngVel && ragdollAngVel.length === 3)
          ? Math.hypot(ragdollAngVel[0], ragdollAngVel[1], ragdollAngVel[2])
          : 0.0;

        // Save pre-collision velocity so we can compute exact 3D impact impulse (impactDeltaV)
        const prevVx = ragdollVel[0];
        const prevVy = ragdollVel[1];
        const prevVz = ragdollVel[2];

        const distToCenter = Math.sqrt(
          ragdollPos[0] ** 2 + ragdollPos[1] ** 2 + ragdollPos[2] ** 2,
        );
        if (distToCenter > 0.001) {
          const ux = ragdollPos[0] / distToCenter;
          const uy = ragdollPos[1] / distToCenter;
          const uz = ragdollPos[2] / distToCenter;

          const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
          const phi = Math.atan2(uz, ux);
          
          let surfaceRadius = RADIUS + getVisualHeightOnSphere(theta, phi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) * HEIGHT_SCALE;
          if (typeof getFloorTopRadiusAt === "function") {
            surfaceRadius = getFloorTopRadiusAt(ux, uy, uz, surfaceRadius);
          }
          const caveData = typeof getTerrainSurfaceAndCeiling === "function"
            ? getTerrainSurfaceAndCeiling(ux, uy, uz, distToCenter)
            : { ground: surfaceRadius, insideTunnel: false, ceiling: Infinity };

          // Dynamic collision radius based on 3D tilt relative to ground normal
          // When standing upright, radius is 0.46 * playerScale
          // When lying on back, stomach, or side, radius is 0.14 * playerScale
          const cosTilt = Math.abs(mCurr.N[0] * ux + mCurr.N[1] * uy + mCurr.N[2] * uz);
          const colRadius = playerScale * (0.14 + 0.32 * cosTilt);
          
          let target = distToCenter;
          let hitSolid = false;
          let hitCeiling = false;

          if (caveData.insideTunnel) {
            if (distToCenter < caveData.ground + colRadius) {
              target = caveData.ground + colRadius;
              hitSolid = true;
            } else if (caveData.ceiling !== Infinity && distToCenter > caveData.ceiling - colRadius) {
              target = caveData.ceiling - colRadius;
              hitSolid = true;
              hitCeiling = true;
            }
          } else {
            if (distToCenter < surfaceRadius + colRadius) {
              target = surfaceRadius + colRadius;
              hitSolid = true;
            }
          }

          const coreCollectible = collectibles.find(c => c.type === "planet_core");
          const coreRadius = coreCollectible ? coreCollectible.radius : 2.0;
          if (distToCenter < coreRadius + colRadius) {
            target = coreRadius + colRadius;
            hitSolid = true;
          }

          if (!hitSolid && immersion < 0.05 && ragdollAngVel && ragdollAngVel.length === 3) {
            // GTA IV Mid-Air Freefall Aerodynamics:
            // Off-center air resistance & limb flailing imparts 3D tumbling torque while falling
            const vDown = -(ragdollVel[0] * ux + ragdollVel[1] * uy + ragdollVel[2] * uz);
            if (vDown > 0.005) {
              const aeroStrength = Math.min(0.012, (vDown - 0.005) * 0.22) * dtScale;
              // Cross product between body axis mCurr.N and velocity gives aerodynamic pitch/roll instability
              const aeroX = mCurr.N[1] * ragdollVel[2] - mCurr.N[2] * ragdollVel[1];
              const aeroY = mCurr.N[2] * ragdollVel[0] - mCurr.N[0] * ragdollVel[2];
              const aeroZ = mCurr.N[0] * ragdollVel[1] - mCurr.N[1] * ragdollVel[0];
              const aeroLen = Math.hypot(aeroX, aeroY, aeroZ);
              if (aeroLen > 0.0001) {
                ragdollAngVel[0] += (aeroX / aeroLen) * aeroStrength;
                ragdollAngVel[1] += (aeroY / aeroLen) * aeroStrength;
                ragdollAngVel[2] += (aeroZ / aeroLen) * aeroStrength;
              } else {
                // If falling nearly straight along body axis, break symmetry so body pitches/rolls in freefall
                ragdollAngVel[0] += (mCurr.R[0] * 0.7 + mCurr.F[0] * 0.5) * aeroStrength;
                ragdollAngVel[1] += (mCurr.R[1] * 0.7 + mCurr.F[1] * 0.5) * aeroStrength;
                ragdollAngVel[2] += (mCurr.R[2] * 0.7 + mCurr.F[2] * 0.5) * aeroStrength;
              }
            }
          }

          if (hitSolid) {
            isRagdollOnGround = !hitCeiling;
            ragdollPos[0] = ux * target;
            ragdollPos[1] = uy * target;
            ragdollPos[2] = uz * target;

            // Compute terrain slope normal (snX, snY, snZ) BEFORE modifying velocity
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
            if (hitCeiling) {
              snX = -ux;
              snY = -uy;
              snZ = -uz;
            }

            // 1. Linear velocity collision, GTA IV impact bounce, & natural slope sliding
            const dot = ragdollVel[0] * snX + ragdollVel[1] * snY + ragdollVel[2] * snZ;
            const impactSpeed = dot < 0 ? -dot : 0;

            if (dot < 0) {
              const bounciness = (!ragdollDiedOnSurface || impactSpeed < 0.0035)
                ? 0.0
                : Math.min(0.28, 0.15 + impactSpeed * 2.2);
              const slideFriction = !ragdollDiedOnSurface ? 0.88 : 0.92;

              const vnX = snX * dot;
              const vnY = snY * dot;
              const vnZ = snZ * dot;

              const vtX = ragdollVel[0] - vnX;
              const vtY = ragdollVel[1] - vnY;
              const vtZ = ragdollVel[2] - vnZ;

              ragdollVel[0] = vtX * slideFriction - vnX * bounciness;
              ragdollVel[1] = vtY * slideFriction - vnY * bounciness;
              ragdollVel[2] = vtZ * slideFriction - vnZ * bounciness;

              // GTA IV Off-Center Ground Impact Buckling & Tumbling Torque:
              // When slamming into the ground from a height, the off-center contact of legs/hips/shoulders
              // converts vertical impact into violent 3D rotational tumbling and lateral deflection!
              if (impactSpeed > 0.0045 && ragdollAngVel && ragdollAngVel.length === 3) {
                const dN = mCurr.N[0] * snX + mCurr.N[1] * snY + mCurr.N[2] * snZ;
                const buckleMag = Math.min(0.26, impactSpeed * (2.2 + 2.6 * Math.abs(dN)));
                // Cross product sn x mCurr.N gives natural tilt axis; add asymmetric pitch/roll if nearly vertical
                let bx = snY * mCurr.N[2] - snZ * mCurr.N[1];
                let by = snZ * mCurr.N[0] - snX * mCurr.N[2];
                let bz = snX * mCurr.N[1] - snY * mCurr.N[0];
                const bLen = Math.hypot(bx, by, bz);
                const randPitch = (Math.random() - 0.35) * 0.8;
                const randRoll  = (Math.random() - 0.5) * 0.8;
                if (bLen > 0.08) {
                  bx = (bx / bLen) * (dN >= 0 ? 1 : -1) + mCurr.R[0] * randPitch * 0.35 + mCurr.F[0] * randRoll * 0.35;
                  by = (by / bLen) * (dN >= 0 ? 1 : -1) + mCurr.R[1] * randPitch * 0.35 + mCurr.F[1] * randRoll * 0.35;
                  bz = (bz / bLen) * (dN >= 0 ? 1 : -1) + mCurr.R[2] * randPitch * 0.35 + mCurr.F[2] * randRoll * 0.35;
                } else {
                  const pSign = Math.random() < 0.5 ? 1 : -1;
                  const rSign = Math.random() < 0.5 ? 1 : -1;
                  bx = mCurr.R[0] * pSign * 0.8 + mCurr.F[0] * rSign * 0.6;
                  by = mCurr.R[1] * pSign * 0.8 + mCurr.F[1] * rSign * 0.6;
                  bz = mCurr.R[2] * pSign * 0.8 + mCurr.F[2] * rSign * 0.6;
                }
                ragdollAngVel[0] += bx * buckleMag;
                ragdollAngVel[1] += by * buckleMag;
                ragdollAngVel[2] += bz * buckleMag;

                // Lateral deflection kick from off-center leg/hip impact (sn x buckleAxis)
                const deflX = snY * bz - snZ * by;
                const deflY = snZ * bx - snX * bz;
                const deflZ = snX * by - snY * bx;
                const deflSpeed = Math.min(0.014, impactSpeed * 0.24);
                ragdollVel[0] += deflX * deflSpeed;
                ragdollVel[1] += deflY * deflSpeed;
                ragdollVel[2] += deflZ * deflSpeed;
              }

              const speedSq = vtX * vtX + vtY * vtY + vtZ * vtZ;
              if (speedSq > 0.000004 && ragdollAngVel && ragdollAngVel.length === 3) {
                // Ground contact imparts rolling torque from tangential slide
                const rollTorque = 2.8;
                ragdollAngVel[0] += (snY * vtZ - snZ * vtY) * rollTorque * dtScale * 0.25;
                ragdollAngVel[1] += (snZ * vtX - snX * vtZ) * rollTorque * dtScale * 0.25;
                ragdollAngVel[2] += (snX * vtY - snY * vtX) * rollTorque * dtScale * 0.25;
              }
            } else {
              Physics.applyFriction(ragdollVel, 0.90, dtScale);
            }

            // If this ragdoll was triggered by a high fall in mid-air, apply landing damage & recovery timer upon touchdown!
            if (!hitCeiling && typeof window !== "undefined" && window._midAirFallRagdollActive) {
              window._midAirFallRagdollActive = false;
              const charScaleVal = (typeof playerScale === "number") ? playerScale : 0.22;
              const scaleRatio = charScaleVal / 0.22;
              const highR = (typeof window._ragdollHighestAirRadius === "number") ? window._ragdollHighestAirRadius : target;
              const totalFallDist = Math.max(0, highR - target);
              window._ragdollHighestAirRadius = target;
              window._playerHighestAirRadius = null;

              if (immersion < 0.3 && totalFallDist >= 1.8 * scaleRatio) {
                let fallDamage = 1;
                if (totalFallDist >= 7.5 * scaleRatio) fallDamage = 5;
                else if (totalFallDist >= 5.0 * scaleRatio) fallDamage = 3;
                else if (totalFallDist >= 3.0 * scaleRatio) fallDamage = 2;

                if (typeof applyPlayerFallDamage === "function") {
                  applyPlayerFallDamage(fallDamage, totalFallDist);
                } else if (typeof window.applyPlayerFallDamage === "function") {
                  window.applyPlayerFallDamage(fallDamage, totalFallDist);
                }
                const ragDuration = fallDamage >= 3 ? 2200 : 1600;
                if (typeof triggerFallRagdoll === "function") {
                  triggerFallRagdoll(ragDuration);
                }
              } else if (typeof triggerFallRagdoll === "function") {
                triggerFallRagdoll(1200);
              }
              if (typeof playSplashSound === "function") {
                playSplashSound(0.6);
              }
            } else if (!hitCeiling) {
              window._ragdollHighestAirRadius = target;
            }

            // Prevent downward radial penetration into sphere (only if not bouncing upward)
            const v_radial = ragdollVel[0] * ux + ragdollVel[1] * uy + ragdollVel[2] * uz;
            if (!hitCeiling && v_radial < 0) {
              ragdollVel[0] -= ux * v_radial;
              ragdollVel[1] -= uy * v_radial;
              ragdollVel[2] -= uz * v_radial;
            } else if (hitCeiling && v_radial > 0) {
              ragdollVel[0] -= ux * v_radial;
              ragdollVel[1] -= uy * v_radial;
              ragdollVel[2] -= uz * v_radial;
            }

            // 2. Gravitational Toppling & Slope-Alignment Torque:
            // Pulls the body's spine axis (mCurr.N) flat onto the terrain slope (dN -> 0)
            // If standing/tilting (dN > 0), gravity pulls the upper body down to the ground.
            // If over-rotated so legs stick up in the air (dN < 0), gravity pulls the legs down to the ground!
            if (!hitCeiling && ragdollAngVel && ragdollAngVel.length === 3) {
              const dN = mCurr.N[0] * snX + mCurr.N[1] * snY + mCurr.N[2] * snZ;
              // Cross product: sn x mCurr.N
              let cx = snY * mCurr.N[2] - snZ * mCurr.N[1];
              let cy = snZ * mCurr.N[0] - snX * mCurr.N[2];
              let cz = snX * mCurr.N[1] - snY * mCurr.N[0];
              const cLen = Math.hypot(cx, cy, cz);
              if (cLen < 0.05 && Math.abs(dN) > 0.85) {
                // Break upright dead-center equilibrium so body never balances upright on ground
                cx = mCurr.R[0] * 0.15 + mCurr.F[0] * 0.10;
                cy = mCurr.R[1] * 0.15 + mCurr.F[1] * 0.10;
                cz = mCurr.R[2] * 0.15 + mCurr.F[2] * 0.10;
              }

              const alignStrength = 0.036 * dtScale;
              ragdollAngVel[0] += dN * cx * alignStrength;
              ragdollAngVel[1] += dN * cy * alignStrength;
              ragdollAngVel[2] += dN * cz * alignStrength;

              // Only apply strong rotational damping once the body lies flat on the slope (|dN| < 0.18).
              // While still tipping over or dropping raised legs (|dN| >= 0.18), keep damping light so it never freezes mid-tilt!
              const dampBase = Math.abs(dN) < 0.18 ? 0.80 : 0.945;
              const angGroundFriction = Math.pow(dampBase, dtScale);
              ragdollAngVel[0] *= angGroundFriction;
              ragdollAngVel[1] *= angGroundFriction;
              ragdollAngVel[2] *= angGroundFriction;
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

        // Compute 3D velocity change from ground/obstacle impact for articulated bone whiplash
        const impactDeltaV = [
          ragdollVel[0] - prevVx,
          ragdollVel[1] - prevVy,
          ragdollVel[2] - prevVz
        ];

        // Update limbs
        if (ragdollLimbs) {
          const updateLimb = (angle, vel, target, stiffness, damping) => {
            const force = (target - angle) * stiffness;
            let v = vel + force;
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

        // Option 2: Step procedural GLB bone ragdoll physics simulation with full impact impulse
        if (typeof updateChibiRagdollPhysics === "function") {
          updateChibiRagdollPhysics(dt, isRagdollOnGround, impactDeltaV);
        }
      }

      // =========================================================================
      // 3D Stylized Anime Hair Generator (Modular Data-Driven System)
      // Delegated to CapsuleModel engine (capsuleModel.js)
      // =========================================================================
      const build3DAnimeHair = (typeof window !== "undefined" && window.CapsuleModel && window.CapsuleModel.build3DAnimeHair)
        ? window.CapsuleModel.build3DAnimeHair
        : (typeof window !== "undefined" ? window.build3DAnimeHair : null);


      // =========================================================================
      // ระบบโมเดลตัวละคร: Classic (Procedural) & Chibi White (GLB)
      // =========================================================================
      if (typeof window !== "undefined") {
        if (!window.characterModel) {
          window.characterModel = "classic"; // ค่าเริ่มต้น: Classic (Base Procedural Chibi)
        }

        window.switchCharacterModel = function(modelName) {
          if (modelName === "chibi" || modelName === "chibi_white") {
            window.characterModel = "chibi";
          } else {
            window.characterModel = "classic";
          }
          if (typeof equipIndicesLength !== "undefined") {
            equipIndicesLength = 0;
          }
          if (typeof updateCharacterMesh === "function") {
            updateCharacterMesh(typeof walkPhase !== "undefined" ? walkPhase : 0.0);
          }
          if (typeof window.updateDevCharacterModelUI === "function") {
            window.updateDevCharacterModelUI();
          }
          if (typeof showNotice === "function") {
            let msg = window.characterModel === "chibi" ? "✨ Chibi White Model (GLB)" : "🧑 Classic (Base)";
            showNotice("👤 สลับโมเดลตัวละคร: " + msg);
          }
          return window.characterModel;
        };

        window.toggleCharacterModel = function() {
          let next = window.characterModel === "classic" ? "chibi" : "classic";
          return window.switchCharacterModel(next);
        };

        // Load GLB
        window.chibiGlbModel = null;
        window.createChibiGlbTexture = function(targetGl) {
          if (typeof window === "undefined") return null;
          if (window.chibiGlbTexture) return window.chibiGlbTexture;
          const model = window.chibiGlbModel;
          if (!model || !model.images || model.images.length === 0) return null;
          const img = model.images[0];
          if (!img) return null;

          const activeGl = targetGl ||
            (typeof gl !== "undefined" && gl ? gl : null) ||
            (window.gl ? window.gl : null) ||
            (window.Graphics && window.Graphics.webgl && window.Graphics.webgl.gl ? window.Graphics.webgl.gl : null) ||
            (window.Graphics && window.Graphics.gl ? window.Graphics.gl : null);

          if (!activeGl) return null;

          const uploadTex = () => {
            if (window.chibiGlbTexture) return;
            try {
              const tex = activeGl.createTexture();
              activeGl.bindTexture(activeGl.TEXTURE_2D, tex);
              activeGl.pixelStorei(activeGl.UNPACK_FLIP_Y_WEBGL, false); // GLTF doesn't flip Y
              activeGl.texImage2D(activeGl.TEXTURE_2D, 0, activeGl.RGBA, activeGl.RGBA, activeGl.UNSIGNED_BYTE, img);
              activeGl.texParameteri(activeGl.TEXTURE_2D, activeGl.TEXTURE_MIN_FILTER, activeGl.LINEAR);
              activeGl.texParameteri(activeGl.TEXTURE_2D, activeGl.TEXTURE_MAG_FILTER, activeGl.LINEAR);
              activeGl.texParameteri(activeGl.TEXTURE_2D, activeGl.TEXTURE_WRAP_S, activeGl.CLAMP_TO_EDGE);
              activeGl.texParameteri(activeGl.TEXTURE_2D, activeGl.TEXTURE_WRAP_T, activeGl.CLAMP_TO_EDGE);
              window.chibiGlbTexture = tex;
              console.log("Chibi GLB Texture created successfully");
            } catch (err) {
              console.error("Error creating Chibi GLB texture:", err);
            }
          };

          if (img.complete && img.naturalWidth > 0) {
            uploadTex();
          } else {
            img.onload = uploadTex;
          }
          return window.chibiGlbTexture;
        };

        if (window.GLBLoader) {
          const loader = new window.GLBLoader();
          loader.load('gamefile/gameplay/chibi%20white.glb').then(() => {
            window.chibiGlbModel = loader;
            if (typeof window.updateDevAnimationList === "function") window.updateDevAnimationList();
            if (typeof window.updateDevCharacterModelUI === "function") window.updateDevCharacterModelUI();
            if (typeof window.updateDevBonesAndParts === "function") window.updateDevBonesAndParts();
            console.log("Chibi GLB loaded successfully");
            
            // Create texture if gl is available
            const activeGl = (typeof gl !== "undefined" && gl) || (typeof window !== "undefined" && window.gl ? window.gl : null);
            if (activeGl) {
              window.createChibiGlbTexture(activeGl);
              if (window.characterModel === "chibi") {
                if (typeof updateCharacterMesh === "function") updateCharacterMesh(typeof walkPhase !== "undefined" ? walkPhase : 0.0);
              }
            }
          }).catch(e => console.error("Failed to load Chibi GLB:", e));
        }
      }

      let _glbCachedVertices = null;
      let _glbCachedNormals = null;
      let _glbCachedColors = null;

      // =========================================================================
      // Dynamic Hair, Hoodie, Hand Controls & Traveler Hoodie Cloak Mesh
      // Delegated to CapsuleModel engine (capsuleModel.js)
      // =========================================================================
      const chibiHairPhysics = (typeof window !== "undefined" && window.CapsuleModel) ? window.CapsuleModel.chibiHairPhysics : {};
      const updateChibiVirtualHair = (typeof window !== "undefined" && window.CapsuleModel) ? window.CapsuleModel.updateChibiVirtualHair : () => {};
      const chibiHoodiePhysics = (typeof window !== "undefined" && window.CapsuleModel) ? window.CapsuleModel.chibiHoodiePhysics : {};
      const updateChibiHoodiePhysics = (typeof window !== "undefined" && window.CapsuleModel) ? window.CapsuleModel.updateChibiHoodiePhysics : () => {};
      const chibiHandState = (typeof window !== "undefined" && window.CapsuleModel) ? window.CapsuleModel.chibiHandState : {};
      const updateChibiHandPose = (typeof window !== "undefined" && window.CapsuleModel) ? window.CapsuleModel.updateChibiHandPose : () => {};
      const buildTravelerHoodieCloakMesh = (typeof window !== "undefined" && window.CapsuleModel) ? window.CapsuleModel.buildTravelerHoodieCloakMesh : () => ({ vertices: [], normals: [], colors: [], indices: [] });
      const buildTravelerBootsMesh = (typeof window !== "undefined" && window.CapsuleModel) ? window.CapsuleModel.buildTravelerBootsMesh : () => ({ vertices: [], normals: [], colors: [], texcoords: [], indices: [] });
      const buildWhiteShirtCollarMesh = (typeof window !== "undefined" && window.CapsuleModel) ? window.CapsuleModel.buildWhiteShirtCollarMesh : () => ({ vertices: [], normals: [], colors: [], texcoords: [], indices: [] });
      const buildBlackPleatedSkirtMesh = (typeof window !== "undefined" && window.CapsuleModel) ? window.CapsuleModel.buildBlackPleatedSkirtMesh : () => ({ vertices: [], normals: [], colors: [], texcoords: [], indices: [] });


      function getGlbCharacterMeshData(phase, isClone = false, cloneWalkBlend = 1.0) {
        if (typeof window === "undefined" || !window.chibiGlbModel) return null;
        if (isClone) return null; // Force clones to use procedural classic model
        if (window.characterModel !== "chibi") return null;
        const model = window.chibiGlbModel;

        const isSprintingActive = !isClone && typeof isSprinting !== "undefined" && isSprinting;
        const isWalkingActive = isClone ? (cloneWalkBlend > 0.05) : (typeof isWalking !== "undefined" && isWalking);
        const isMovingActive = isClone ? (cloneWalkBlend > 0.05) : (typeof isMoving !== "undefined" ? isMoving : isWalkingActive);
        const isRiding = !isClone && ((typeof activeRidingBoat !== "undefined" && activeRidingBoat) || (typeof activeRidingMech !== "undefined" && activeRidingMech));
        const inWater = !isClone && typeof currentSwimFactor !== "undefined" && currentSwimFactor > 0.05;
        const isAirborne = !isClone && !inWater && !isRiding && typeof jumpBlend !== "undefined" && jumpBlend > 0.15;

        const nowPerf = performance.now() * 0.001;
        if (typeof window._charGlbLastPerfTime !== "number") window._charGlbLastPerfTime = nowPerf;
        const rawDt = nowPerf - window._charGlbLastPerfTime;
        if (!isClone && rawDt > 0.0001) window._charGlbLastPerfTime = nowPerf;
        const dt = (!isClone && rawDt > 0.0001) ? Math.min(rawDt, 0.1) : (1.0 / 60.0);

        // Track Airborne / Jump animation playback timeline (takeoff @ 1.35s -> peak spread @ 1.85s -> fall @ 2.30s -> land @ 2.65s)
        if (typeof window.charJumpAnimTime === "undefined") window.charJumpAnimTime = 1.35;
        if (typeof window.charWasAirborne === "undefined") window.charWasAirborne = false;
        if (typeof window.charLandingTimer === "undefined") window.charLandingTimer = 0.0;

        if (isAirborne) {
          if (!window.charWasAirborne) {
            // Jump takeoff start
            window.charJumpAnimTime = 1.35;
            window.charWasAirborne = true;
            window.charLandingTimer = 0.0;
          } else {
            // Smoothly advance jump animation forward through flight
            window.charJumpAnimTime += dt * 1.6;
            if (window.charJumpAnimTime > 2.30) {
              window.charJumpAnimTime = 2.30; // Hold airborne pose during long descent/fall
            }
          }
        } else {
          if (window.charWasAirborne) {
            // Landing compression on touchdown
            window.charLandingTimer += dt;
            window.charJumpAnimTime += dt * 2.0;
            if (window.charLandingTimer > 0.18 || window.charJumpAnimTime >= 2.65) {
              window.charWasAirborne = false;
              window.charLandingTimer = 0.0;
              window.charJumpAnimTime = 1.35;
            }
          } else {
            window.charJumpAnimTime = 1.35;
          }
        }

        const heldItem = isClone ? null : (typeof window.getHeldItem === "function" ? window.getHeldItem() : (typeof getHeldItem === "function" ? getHeldItem() : null));
        const isItemAction = !isClone && typeof isUsingItem !== "undefined" && isUsingItem && typeof useAnimTimer !== "undefined" && useAnimTimer > 0;
        const isDevMixMode = !isClone && typeof window.devMixMode !== "undefined" && window.devMixMode;
        const isDevOverride = !isClone && !isDevMixMode && typeof window.devForceAnimation === "string" && window.devForceAnimation !== "Auto" && window.devForceAnimation !== "";

        const isRagdoll = !isClone && typeof ragdollEnabled !== "undefined" && ragdollEnabled;
        if (!isRagdoll && typeof window.charRagdollTime !== "undefined") {
          window.charRagdollTime = 0;
        }

        // 1. Determine Lower Body / Locomotion Animation
        let lowerAnimName = "01a090e9-3d6d-7643-a07b-75e0e18cdc29"; // Default idle
        if (isDevOverride) {
          lowerAnimName = window.devForceAnimation;
        } else if (isDevMixMode && window.devMixLowerAnim) {
          lowerAnimName = window.devMixLowerAnim;
        } else if (isRagdoll) {
          lowerAnimName = "restpose";
        } else if (isRiding) {
          lowerAnimName = "01a090f9-e47a-7144-abc9-bc9fcc7af00e";
        } else if (inWater) {
          // Default Swimming Animations for Chibi White: Swim_Forward when moving, Swim_Idle when floating
          if (isMovingActive || (typeof swimMovementFactor !== "undefined" && swimMovementFactor > 0.15)) {
            lowerAnimName = "Swim_Forward";
          } else {
            lowerAnimName = "Swim_Idle";
          }
        } else if (isAirborne) {
          lowerAnimName = "Jump_with_Arms_Open";
        } else if (isMovingActive || (isClone && cloneWalkBlend > 0.05)) {
          lowerAnimName = isSprintingActive ? "Running" : "Walking";
        }

        // 2. Determine Upper Body Animation & Target Weight
        let upperAnimName = null;
        let targetUpperWeight = 0.0;
        if (isDevMixMode) {
          upperAnimName = window.devMixUpperAnim || "01a090f8-8c8f-75dc-8693-155f9574dac7";
          targetUpperWeight = typeof window.devMixUpperWeight === "number" ? window.devMixUpperWeight : 1.0;
        } else if (isItemAction) {
          if (heldItem && (heldItem.name === "WOODEN_ARM_CANNON" || heldItem.name === "ARM_CANNON")) {
            upperAnimName = "01a09186-787b-771f-b4ee-5b234572bcef";
          } else {
            upperAnimName = "01a090f8-8c8f-75dc-8693-155f9574dac7";
          }
          targetUpperWeight = 1.0;
        }

        if (isRagdoll) {
          upperAnimName = null;
          targetUpperWeight = 0.0;
        }

        // 3. Smooth blend weight for upper body (immediate attack, 150ms decay)
        if (typeof window.chibiUpperWeight === "undefined") window.chibiUpperWeight = 0.0;
        if (isItemAction) {
          window.chibiUpperWeight = 1.0;
        } else if (isDevMixMode) {
          window.chibiUpperWeight = targetUpperWeight;
        } else if (window.chibiUpperWeight > 0.0) {
          window.chibiUpperWeight = Math.max(0.0, window.chibiUpperWeight - dt / 0.15);
        }

        const isLayerMixing = !isClone && window.chibiUpperWeight > 0.001 && upperAnimName;

        // 4. Calculate Lower Body Playback Time
        const lowerAnim = model.getAnimation(lowerAnimName) || model.getAnimation("01a090e9-3d6d-7643-a07b-75e0e18cdc29") || model.getAnimation("restpose");
        let lowerAnimTime = 0.0;
        
        if (lowerAnim && lowerAnim.duration > 0) {
          if (isDevOverride) {
            // Apply custom animation player logic
            if (window.devAnimIsPlaying && !isClone) {
              const now = performance.now() / 1000.0;
              if (!window.devAnimLastUpdate) window.devAnimLastUpdate = now;
              
              if (now !== window.devAnimLastUpdate) {
                const deltaT = now - window.devAnimLastUpdate;
                window.devAnimLastUpdate = now;
                
                window.devAnimCurrentTime += Math.min(deltaT, 0.1);
                
                if (window.devAnimCurrentTime >= window.devAnimEndTime) {
                  window.devLoopCrossfadeFactor = 0.0;
                  window.devAnimCurrentTime = window.devAnimStartTime + (window.devAnimCurrentTime - window.devAnimEndTime);
                }
                
                if (typeof document !== "undefined") {
                  const lbl = document.getElementById("devAnimTimeLabel");
                  const sldr = document.getElementById("devAnimScrubSlider");
                  if (lbl) lbl.innerText = window.devAnimCurrentTime.toFixed(2) + "s / " + window.devAnimDuration.toFixed(2) + "s";
                  if (sldr && window.devAnimDuration > 0) {
                    sldr.value = (window.devAnimCurrentTime / window.devAnimDuration) * 1000;
                  }
                }
              }
            }
            lowerAnimTime = window.devAnimCurrentTime;
          } else if (lowerAnimName === "Swim_Idle") {
            const idleDur = lowerAnim.duration || 3.067;
            if (typeof window.charSwimIdleTime === "undefined") window.charSwimIdleTime = 0;
            if (typeof window.charSwimIdleLastUpdate === "undefined") window.charSwimIdleLastUpdate = performance.now() * 0.001;
            
            if (typeof window.charLastAnimName === "undefined") window.charLastAnimName = lowerAnimName;
            if (window.charLastAnimName !== lowerAnimName) {
              window.charSwimIdleTime = 0;
              window.charIdleCrossfade = 1.0;
              window.charLastAnimName = lowerAnimName;
            }
            
            const now = performance.now() * 0.001;
            const deltaT = now - window.charSwimIdleLastUpdate;
            window.charSwimIdleLastUpdate = now;
            
            const nextSwimIdle = window.charSwimIdleTime + Math.min(deltaT, 0.1);
            if (nextSwimIdle >= idleDur) {
              window.charIdleCrossfade = 0.0;
              window.charSwimIdleTime = nextSwimIdle % idleDur;
            } else {
              window.charSwimIdleTime = nextSwimIdle;
            }
            lowerAnimTime = window.charSwimIdleTime;
          } else if (lowerAnimName === "Swim_Forward") {
            // Forward swim stroke speed
            lowerAnimTime = ((phase / (Math.PI * 2)) * lowerAnim.duration) % lowerAnim.duration;
            if (lowerAnimTime < 0) lowerAnimTime += lowerAnim.duration;
          } else if (lowerAnimName === "01a09186-787b-771f-b4ee-5b234572bcef") {
            if (typeof window.charRagdollTime === "undefined") window.charRagdollTime = 0;
            window.charRagdollTime = Math.min(lowerAnim.duration - 0.05, window.charRagdollTime + dt * 1.5);
            lowerAnimTime = window.charRagdollTime;
          } else if (lowerAnimName === "Jump_with_Arms_Open") {
            lowerAnimTime = Math.min(lowerAnim.duration, window.charJumpAnimTime || 1.35);
          } else if (lowerAnimName === "01a090e9-3d6d-7643-a07b-75e0e18cdc29" || lowerAnimName === "restpose" || lowerAnimName === "01a090f9-e47a-7144-abc9-bc9fcc7af00e") {
            let idleDur = lowerAnim.duration;
            if (lowerAnimName === "01a090e9-3d6d-7643-a07b-75e0e18cdc29") idleDur = Math.min(2.98, lowerAnim.duration);
            if (lowerAnimName === "01a090f9-e47a-7144-abc9-bc9fcc7af00e") idleDur = Math.min(1.10, lowerAnim.duration);
            
            if (typeof window.charIdleTime === "undefined") window.charIdleTime = 0;
            if (typeof window.charIdleLastUpdate === "undefined") window.charIdleLastUpdate = performance.now() * 0.001;
            
            if (typeof window.charLastAnimName === "undefined") window.charLastAnimName = lowerAnimName;
            if (window.charLastAnimName !== lowerAnimName) {
              window.charIdleTime = 0;
              window.charIdleCrossfade = 1.0;
              window.charLastAnimName = lowerAnimName;
            }
            
            const now = performance.now() * 0.001;
            const deltaT = now - window.charIdleLastUpdate;
            window.charIdleLastUpdate = now;
            
            const nextIdle = window.charIdleTime + Math.min(deltaT, 0.1);
            if (nextIdle >= idleDur) {
              window.charIdleCrossfade = 0.0;
              window.charIdleTime = nextIdle % idleDur;
            } else {
              window.charIdleTime = nextIdle;
            }
            lowerAnimTime = window.charIdleTime;
          } else {
            lowerAnimTime = ((phase / (Math.PI * 2)) * lowerAnim.duration) % lowerAnim.duration;
            if (lowerAnimTime < 0) lowerAnimTime += lowerAnim.duration;
          }
        }

        // 5. Calculate Upper Body Playback Time
        let upperAnimTime = 0.0;
        if (upperAnimName) {
          const uAnim = model.getAnimation(upperAnimName);
          if (uAnim && uAnim.duration > 0) {
            if (isDevMixMode) {
              if (typeof window.devMixUpperTime === "number") {
                upperAnimTime = window.devMixUpperTime % uAnim.duration;
              } else {
                upperAnimTime = ((performance.now() * 0.001) % uAnim.duration);
              }
            } else if (isItemAction) {
              if (heldItem && (heldItem.name === "WOODEN_ARM_CANNON" || heldItem.name === "ARM_CANNON")) {
                // Animation 01a09186-787b-771f-b4ee-5b234572bcef trimmed Start: 1.40s, End: 2.47s (duration 1.07s)
                const animDuration = 2.47 - 1.40;
                const p = Math.max(0.0, Math.min(1.0, 1.0 - (useAnimTimer / animDuration)));
                upperAnimTime = 1.40 + p * (2.47 - 1.40);
              } else {
                const toolDur = Math.min(2.98, uAnim.duration);
                upperAnimTime = Math.max(0.0, Math.min(1.0, 1.0 - useAnimTimer)) * toolDur;
              }
              window.chibiLastUpperAnimTime = upperAnimTime;
            } else if (upperAnimName === "Jump_with_Arms_Open") {
              upperAnimTime = Math.min(uAnim.duration, window.charJumpAnimTime || 1.35);
            } else {
              upperAnimTime = window.chibiLastUpperAnimTime || Math.min(2.98, uAnim.duration);
            }
          }
        }

        // 6. Handle Locomotion Crossfade State on Lower Body
        if (!isClone) {
          if (typeof window.charTargetAnimName === "undefined") window.charTargetAnimName = lowerAnimName;
          
          if (window.charTargetAnimName !== lowerAnimName) {
            window.charPrevAnimName = window.charTargetAnimName;
            window.charPrevAnimTime = window.charTargetAnimTime || lowerAnimTime;
            window.charTargetAnimName = lowerAnimName;
            window.charCrossfadeFactor = 0.0;
          }
          window.charTargetAnimTime = lowerAnimTime;
        }

        // 7. Update Procedural Virtual Bone Hair Spring Physics before skinning
        if (!isClone && typeof updateChibiVirtualHair === "function") {
          if (chibiHairPhysics && chibiHairPhysics.enabled) {
            if (isRagdoll && typeof ragdollVel !== "undefined" && ragdollVel) {
              const rSpeed = Math.hypot(ragdollVel[0], ragdollVel[1], ragdollVel[2]);
              chibiHairPhysics.pitchVel += Math.min(25.0, rSpeed * 420.0) * 0.016;
              chibiHairPhysics.yawVel   += Math.sin(nowPerf * 9.0) * Math.min(18.0, rSpeed * 320.0) * 0.016;
            } else if (typeof playerVerticalVel === "number" && Math.abs(playerVerticalVel) > 0.001) {
              chibiHairPhysics.pitchVel += Math.max(-22.0, Math.min(22.0, -playerVerticalVel * 480.0)) * 0.016;
            }
          }
          updateChibiVirtualHair(model, !isRagdoll && isMovingActive, !isRagdoll && isSprintingActive, isRagdoll ? 0 : phase, dt);
        }

        // 7.1 Update Hand Pose & Finger Controls (กำมือ, แบมือ, แยกนิ้ว)
        if (!isClone && typeof updateChibiHandPose === "function") {
          updateChibiHandPose(model, heldItem, isItemAction);
        }

        // 8. Sample and Mesh Skinning
        let skinned = null;

        if (isRagdoll && typeof getChibiRagdollBoneTransforms === "function" && typeof model.getSkinnedMeshRagdoll === "function") {
          // Option 2: Full Realistic Procedural Bone Ragdoll for GLB Model
          const bones = getChibiRagdollBoneTransforms();
          skinned = model.getSkinnedMeshRagdoll(bones);
        }
        else if (isLayerMixing) {
          // Layered mixing: legs & locomotion stay on lowerAnim, upper body blends into upperAnim
          const hipsBlend = (upperAnimName === "Jump_with_Arms_Open") ? 0.0 : (isMovingActive ? 0.0 : 0.35);

          if (!isClone && typeof window.charCrossfadeFactor !== "undefined" && window.charCrossfadeFactor < 1.0 && window.charPrevAnimName) {
            const cf = Math.max(0.0, Math.min(1.0, window.charCrossfadeFactor));
            const smoothCf = cf * cf * (3.0 - 2.0 * cf);
            skinned = model.getSkinnedMeshMixed({
              lowerAnim1: window.charPrevAnimName,
              lowerTime1: window.charPrevAnimTime,
              lowerAnim2: lowerAnimName,
              lowerTime2: lowerAnimTime,
              lowerBlend: smoothCf,
              upperAnim: upperAnimName,
              upperTime: upperAnimTime,
              upperWeight: window.chibiUpperWeight,
              hipsBlend: hipsBlend,
              loop: true
            });
            window.charCrossfadeFactor += dt / 0.15;
            window.charPrevAnimTime += dt;
          } else if (!isClone && (lowerAnimName === "01a090e9-3d6d-7643-a07b-75e0e18cdc29" || lowerAnimName === "01a090f9-e47a-7144-abc9-bc9fcc7af00e" || lowerAnimName === "Swim_Idle") && typeof window.charIdleCrossfade === "number" && window.charIdleCrossfade < 1.0) {
            let idleDur = lowerAnim.duration;
            if (lowerAnimName === "01a090e9-3d6d-7643-a07b-75e0e18cdc29") idleDur = Math.min(2.98, lowerAnim.duration);
            if (lowerAnimName === "01a090f9-e47a-7144-abc9-bc9fcc7af00e") idleDur = Math.min(1.10, lowerAnim.duration);
            const endPoseTime = Math.max(0.0, idleDur - 0.001);
            const f = Math.max(0.0, Math.min(1.0, window.charIdleCrossfade));
            const smoothF = f * f * (3.0 - 2.0 * f);
            skinned = model.getSkinnedMeshMixed({
              lowerAnim1: lowerAnimName,
              lowerTime1: endPoseTime,
              lowerAnim2: lowerAnimName,
              lowerTime2: lowerAnimTime,
              lowerBlend: smoothF,
              upperAnim: upperAnimName,
              upperTime: upperAnimTime,
              upperWeight: window.chibiUpperWeight,
              hipsBlend: hipsBlend,
              loop: true
            });
            window.charIdleCrossfade += dt / 0.25;
          } else {
            skinned = model.getSkinnedMeshLayered(
              lowerAnimName,
              lowerAnimTime,
              upperAnimName,
              upperAnimTime,
              window.chibiUpperWeight,
              true,
              hipsBlend
            );
          }
        } 
        else if (!isClone && typeof window.charCrossfadeFactor !== "undefined" && window.charCrossfadeFactor < 1.0) {
          const cf = Math.max(0.0, Math.min(1.0, window.charCrossfadeFactor));
          const smoothCf = cf * cf * (3.0 - 2.0 * cf);
          skinned = model.getSkinnedMeshBlended(window.charPrevAnimName, window.charPrevAnimTime, lowerAnimName, lowerAnimTime, smoothCf, true);
          window.charCrossfadeFactor += dt / 0.15; // 150ms crossfade
          window.charPrevAnimTime += dt;
        } 
        else if (!isClone && isDevOverride && typeof window.devLoopCrossfadeFactor !== "undefined" && window.devLoopCrossfadeFactor < 1.0) {
          // Trim loop crossfading (blend End -> Start)
          const prevTime = Math.max(0.0, window.devAnimEndTime - 0.001); // hold at exact end pose without modulo wrap
          const f = Math.max(0.0, Math.min(1.0, window.devLoopCrossfadeFactor));
          const smoothF = f * f * (3.0 - 2.0 * f);
          skinned = model.getSkinnedMeshBlended(lowerAnimName, prevTime, lowerAnimName, lowerAnimTime, smoothF, true);
          window.devLoopCrossfadeFactor += dt / 0.25; // 250ms smooth crossfade
        } 
        else if (!isClone && (lowerAnimName === "01a090e9-3d6d-7643-a07b-75e0e18cdc29" || lowerAnimName === "01a090f9-e47a-7144-abc9-bc9fcc7af00e" || lowerAnimName === "Swim_Idle") && typeof window.charIdleCrossfade === "number" && window.charIdleCrossfade < 1.0) {
          let idleDur = lowerAnim.duration;
          if (lowerAnimName === "01a090e9-3d6d-7643-a07b-75e0e18cdc29") idleDur = Math.min(2.98, lowerAnim.duration);
          if (lowerAnimName === "01a090f9-e47a-7144-abc9-bc9fcc7af00e") idleDur = Math.min(1.10, lowerAnim.duration);
          if (lowerAnimName === "Swim_Idle") idleDur = lowerAnim.duration;
          const endPoseTime = Math.max(0.0, idleDur - 0.001);
          const f = Math.max(0.0, Math.min(1.0, window.charIdleCrossfade));
          const smoothF = f * f * (3.0 - 2.0 * f);
          skinned = model.getSkinnedMeshBlended(lowerAnimName, endPoseTime, lowerAnimName, lowerAnimTime, smoothF, true);
          window.charIdleCrossfade += dt / 0.25; // 250ms smooth crossfade
        }
        else {
          skinned = model.getSkinnedMesh(lowerAnimName, lowerAnimTime, true);
        }

        if (!skinned || !skinned.positions) return null;

        const vCount = skinned.positions.length / 3;
        const positions = skinned.positions;
        const normals = skinned.normals;
        const modelColors = skinned.colors;

        const scale = 0.59;
        let yOffset = -0.46;

        if (!isClone && typeof activeRidingBoat !== "undefined" && activeRidingBoat) {
          yOffset = -0.15;
        } else if (!isClone && typeof activeRidingMech !== "undefined" && activeRidingMech) {
          yOffset = -0.15;
        } else if (!isClone && typeof currentSwimFactor !== "undefined" && currentSwimFactor > 0) {
          yOffset = -0.46 - currentSwimFactor * 0.12;
        }

        if (!_glbCachedVertices || _glbCachedVertices.length !== vCount * 3) {
          _glbCachedVertices = new Float32Array(vCount * 3);
          _glbCachedNormals = new Float32Array(vCount * 3);
          _glbCachedColors = new Float32Array(vCount * 3);
        }
        const outVertices = _glbCachedVertices;
        const outNormals = _glbCachedNormals;
        const outColors = _glbCachedColors;
        const outTexCoords = skinned.texcoords;

        const colorByParts = typeof window !== "undefined" && !!window.devColorByParts;
        const partVis = (typeof window !== "undefined" && window.devPartVisibility) ? window.devPartVisibility : null;
        const selectedBone = (typeof window !== "undefined") ? window.devSelectedBone : null;
        const hasHiddenParts = partVis ? Object.values(partVis).some(v => v === false) : false;
        const partGroups = model.vertexPartGroups;
        const dominantBones = model.vertexDominantBones;
        const selectedBoneNodeIdx = (selectedBone && model.nodes)
          ? model.nodes.findIndex(n => n && n.name === selectedBone)
          : -1;

        if (!colorByParts && !hasHiddenParts && selectedBoneNodeIdx === -1) {
          // Fast-path for production gameplay: direct flat transforms without dev branching (GLB keeps original appearance without wearable clothing)
          for (let i = 0; i < vCount; i++) {
            const i3 = i * 3;
            outVertices[i3] = positions[i3] * scale;
            outVertices[i3 + 1] = positions[i3 + 1] * scale + yOffset;
            outVertices[i3 + 2] = positions[i3 + 2] * scale;
            outNormals[i3] = normals[i3];
            outNormals[i3 + 1] = normals[i3 + 1];
            outNormals[i3 + 2] = normals[i3 + 2];

            if (modelColors && modelColors.length >= (i + 1) * 3) {
              outColors[i3] = modelColors[i3];
              outColors[i3 + 1] = modelColors[i3 + 1];
              outColors[i3 + 2] = modelColors[i3 + 2];
            } else {
              outColors[i3] = 1.0;
              outColors[i3 + 1] = 1.0;
              outColors[i3 + 2] = 1.0;
            }
          }
        } else {
          // Debug / Dev visualizer path
          const partPalette = [
            [1.0, 0.43, 0.25], // 0: Head (Coral)
            [0.0, 0.69, 1.0],  // 1: Torso (Cyan)
            [0.0, 0.90, 0.46], // 2: Left Arm (Green)
            [1.0, 0.67, 0.0],  // 3: Right Arm (Gold)
            [0.83, 0.0, 0.98], // 4: Left Leg (Purple)
            [1.0, 0.09, 0.27], // 5: Right Leg (Pink/Red)
            [0.88, 0.25, 0.98]  // 6: Ponytail Hair (Magenta/Violet)
          ];
          const partKeys = ["head", "torso", "left_arm", "right_arm", "left_leg", "right_leg", "hair"];

          for (let i = 0; i < vCount; i++) {
            const i3 = i * 3;
            const pGroup = partGroups ? partGroups[i] : 1;
            const pKey = partKeys[pGroup] || "torso";

            if (partVis && partVis[pKey] === false) {
              outVertices[i3] = 0;
              outVertices[i3 + 1] = -9999;
              outVertices[i3 + 2] = 0;
            } else {
              outVertices[i3] = positions[i3] * scale;
              outVertices[i3 + 1] = positions[i3 + 1] * scale + yOffset;
              outVertices[i3 + 2] = positions[i3 + 2] * scale;
            }

            outNormals[i3] = normals[i3];
            outNormals[i3 + 1] = normals[i3 + 1];
            outNormals[i3 + 2] = normals[i3 + 2];

            if (selectedBoneNodeIdx !== -1 && dominantBones && dominantBones[i] === selectedBoneNodeIdx) {
              outColors[i3] = 1.0;
              outColors[i3 + 1] = 0.95;
              outColors[i3 + 2] = 0.15;
            } else if (colorByParts && partGroups) {
              const col = partPalette[pGroup] || [0.9, 0.9, 0.9];
              const shade = 0.85 + Math.max(0, normals[i3 + 1]) * 0.15;
              outColors[i3] = col[0] * shade;
              outColors[i3 + 1] = col[1] * shade;
              outColors[i3 + 2] = col[2] * shade;
            } else if (selectedBoneNodeIdx !== -1) {
              outColors[i3] = 0.35;
              outColors[i3 + 1] = 0.38;
              outColors[i3 + 2] = 0.42;
            } else if (modelColors && modelColors.length >= (i + 1) * 3) {
              outColors[i3] = modelColors[i3];
              outColors[i3 + 1] = modelColors[i3 + 1];
              outColors[i3 + 2] = modelColors[i3 + 2];
            } else {
              outColors[i3] = 1.0;
              outColors[i3 + 1] = 1.0;
              outColors[i3 + 2] = 1.0;
            }
          }
        }

        return {
          vertices: outVertices,
          normals: outNormals,
          colors: outColors,
          texcoords: outTexCoords,
          indices: skinned.indices
        };
      }

      function uploadDynamicBuffer(targetGl, buf, target, data) {
        targetGl.bindBuffer(target, buf);
        if (buf._allocByteLength === data.byteLength) {
          targetGl.bufferSubData(target, 0, data);
        } else {
          targetGl.bufferData(target, data, targetGl.DYNAMIC_DRAW);
          buf._allocByteLength = data.byteLength;
        }
      }

      function buildWoodenArmCannonMesh(pElbow, pHand, rawV, rawC, rawI, itemScale = 1.0) {
        const dir = [pHand[0] - pElbow[0], pHand[1] - pElbow[1], pHand[2] - pElbow[2]];
        const armLen = Math.hypot(dir[0], dir[1], dir[2]) || 0.1;
        dir[0] /= armLen; dir[1] /= armLen; dir[2] /= armLen;

        const pRear = [pElbow[0] + dir[0] * 0.015, pElbow[1] + dir[1] * 0.015, pElbow[2] + dir[2] * 0.015];
        const pMid = [pElbow[0] + dir[0] * (armLen * 0.75), pElbow[1] + dir[1] * (armLen * 0.75), pElbow[2] + dir[2] * (armLen * 0.75)];
        const pMuzzle = [pHand[0] + dir[0] * 0.065, pHand[1] + dir[1] * 0.065, pHand[2] + dir[2] * 0.065];
        const pBoreIn = [pMuzzle[0] - dir[0] * 0.035, pMuzzle[1] - dir[1] * 0.035, pMuzzle[2] - dir[2] * 0.035];

        const woodColorMain = [0.55, 0.38, 0.22];
        const woodColorDark = [0.42, 0.28, 0.15];
        const ironColor = [0.28, 0.28, 0.30];
        const darkMuzzleColor = [0.22, 0.22, 0.24];
        const innerBoreColor = [0.10, 0.10, 0.10];

        // 1. Main wooden forearm sleeve and barrel body (faceted 6-sided low-poly cylinder)
        buildTaperedSegment(pRear, pMid, 0.037 * itemScale, 0.033 * itemScale, 6, woodColorMain, rawV, rawC, rawI);
        buildTaperedSegment(pMid, pMuzzle, 0.033 * itemScale, 0.036 * itemScale, 6, woodColorDark, rawV, rawC, rawI);

        // 2. Rear reinforcement iron ring
        const pRearBand = [pRear[0] + dir[0] * 0.015, pRear[1] + dir[1] * 0.015, pRear[2] + dir[2] * 0.015];
        buildTaperedSegment(pRear, pRearBand, 0.040 * itemScale, 0.039 * itemScale, 6, ironColor, rawV, rawC, rawI);

        // 3. Mid reinforcement iron ring clamp
        const pMidBand1 = [pMid[0] - dir[0] * 0.008, pMid[1] - dir[1] * 0.008, pMid[2] - dir[2] * 0.008];
        const pMidBand2 = [pMid[0] + dir[0] * 0.008, pMid[1] + dir[1] * 0.008, pMid[2] + dir[2] * 0.008];
        buildTaperedSegment(pMidBand1, pMidBand2, 0.036 * itemScale, 0.036 * itemScale, 6, ironColor, rawV, rawC, rawI);

        // 4. Front iron muzzle collar
        const pMuzzleRing = [pMuzzle[0] - dir[0] * 0.012, pMuzzle[1] - dir[1] * 0.012, pMuzzle[2] - dir[2] * 0.012];
        buildTaperedSegment(pMuzzleRing, pMuzzle, 0.039 * itemScale, 0.039 * itemScale, 6, darkMuzzleColor, rawV, rawC, rawI);

        // 5. Inner dark hollow cannon bore
        buildTaperedSegment(pBoreIn, pMuzzle, 0.022 * itemScale, 0.024 * itemScale, 6, innerBoreColor, rawV, rawC, rawI);

        // 6. Arrow in barrel when aiming/ready
        if (!arrowShotInCurrentAnim && useAnimTimer > 0) {
          const arrowTip = [pMuzzle[0] + dir[0] * 0.04 * itemScale, pMuzzle[1] + dir[1] * 0.04 * itemScale, pMuzzle[2] + dir[2] * 0.04 * itemScale];
          const arrowShaftEnd = [pMuzzle[0] - dir[0] * 0.06 * itemScale, pMuzzle[1] - dir[1] * 0.06 * itemScale, pMuzzle[2] - dir[2] * 0.06 * itemScale];
          buildTaperedSegment(arrowShaftEnd, arrowTip, 0.005 * itemScale, 0.005 * itemScale, 4, [0.55, 0.4, 0.25], rawV, rawC, rawI);

          const arrowHeadTip = [arrowTip[0] + dir[0] * 0.025 * itemScale, arrowTip[1] + dir[1] * 0.025 * itemScale, arrowTip[2] + dir[2] * 0.025 * itemScale];
          buildTaperedSegment(arrowTip, arrowHeadTip, 0.012 * itemScale, 0.001 * itemScale, 4, [0.35, 0.35, 0.35], rawV, rawC, rawI);
        }

        // Set firing origin and direction in world space
        if (typeof getCharacterMatrix === "function") {
          const charMat = getCharacterMatrix();
          window.lastBowGripPos = [
            charMat[0] * pMuzzle[0] + charMat[4] * pMuzzle[1] + charMat[8] * pMuzzle[2] + charMat[12],
            charMat[1] * pMuzzle[0] + charMat[5] * pMuzzle[1] + charMat[9] * pMuzzle[2] + charMat[13],
            charMat[2] * pMuzzle[0] + charMat[6] * pMuzzle[1] + charMat[10] * pMuzzle[2] + charMat[14]
          ];
          const aimX = charMat[0] * dir[0] + charMat[4] * dir[1] + charMat[8] * dir[2];
          const aimY = charMat[1] * dir[0] + charMat[5] * dir[1] + charMat[9] * dir[2];
          const aimZ = charMat[2] * dir[0] + charMat[6] * dir[1] + charMat[10] * dir[2];
          const aLen = Math.hypot(aimX, aimY, aimZ);
          if (aLen > 1e-4) {
            window.lastBowAimDir = [aimX / aLen, aimY / aLen, aimZ / aLen];
          } else {
            window.lastBowAimDir = [aimX, aimY, aimZ];
          }
        }
      }

      function buildHeldIronBucketMesh(handPos, itemScale, heldItem, rawV, rawC, rawI) {
        if (typeof window.buildIronBucketModel !== "function") return;
        if (!window.devBucketOffset) {
          window.devBucketOffset = { x: 0.016, y: -0.031, z: -0.007, scale: 1.0, rotX: 0.0, rotY: -90.0, rotZ: 0.0 };
        }
        const devOff = window.devBucketOffset;
        const customScale = (typeof devOff.scale === "number" && !isNaN(devOff.scale)) ? devOff.scale : 1.0;
        const bScale = 0.22 * itemScale * customScale;
        const scoopTimer = (typeof window.bucketScoopTimer === "number" && window.bucketScoopTimer > 0) ? window.bucketScoopTimer : 0;
        const waterTimer = (typeof window.bucketWaterTimer === "number" && window.bucketWaterTimer > 0) ? window.bucketWaterTimer : 0;

        let tiltAngle = ((typeof devOff.rotX === "number" ? devOff.rotX : 0.0) * Math.PI) / 180.0;
        let offsetY = 0.0;
        let offsetZ = 0.0;
        const t = 1.0 - Math.max(0.0, Math.min(1.0, scoopTimer));
        const tw = 1.0 - Math.max(0.0, Math.min(1.0, waterTimer));

        if (scoopTimer > 0) {
          if (t < 0.40) {
            // Stage 1: Dip & tilt bucket mouth forward/down into the water
            const s = Math.sin((t / 0.40) * (Math.PI * 0.5));
            tiltAngle += s * 1.75;
            offsetY = -0.22 * itemScale * s;
            offsetZ = 0.25 * itemScale * s;
          } else if (t < 0.75) {
            // Stage 2: Drag through water & rotate upright with water inside
            const u = (t - 0.40) / 0.35;
            const su = u * u * (3.0 - 2.0 * u);
            tiltAngle += 1.75 * (1.0 - su) - 0.22 * su;
            offsetY = -0.22 * itemScale * (1.0 - su) + 0.04 * itemScale * su;
            offsetZ = 0.25 * itemScale * (1.0 - su) + 0.10 * itemScale * su;
          } else {
            // Stage 3: Settle smoothly back to hand position
            const v = (t - 0.75) / 0.25;
            const sv = v * v * (3.0 - 2.0 * v);
            tiltAngle += -0.22 * (1.0 - sv);
            offsetY = 0.04 * itemScale * (1.0 - sv);
            offsetZ = 0.10 * itemScale * (1.0 - sv);
          }
        } else if (waterTimer > 0 && (!window.activeWateringAnimPlanter || !window.activeWateringAnimPlanter.position)) {
          if (tw < 0.35) {
            const s = Math.sin((tw / 0.35) * (Math.PI * 0.5));
            tiltAngle += s * 1.85;
            offsetY = 0.06 * itemScale * s;
            offsetZ = 0.26 * itemScale * s;
          } else if (tw < 0.72) {
            const u = (tw - 0.35) / 0.37;
            const su = u * u * (3.0 - 2.0 * u);
            tiltAngle += 1.85 * (1.0 - su * 0.12) + Math.sin(u * Math.PI * 2) * 0.08;
            offsetY = (0.06 * (1.0 - su) - 0.04 * su) * itemScale;
            offsetZ = (0.26 * (1.0 - su * 0.08)) * itemScale;
          } else {
            const v = (tw - 0.72) / 0.28;
            const sv = v * v * (3.0 - 2.0 * v);
            tiltAngle += (1.85 * 0.88) * (1.0 - sv);
            offsetY = -0.04 * itemScale * (1.0 - sv);
            offsetZ = (0.26 * 0.92) * itemScale * (1.0 - sv);
          }
        }

        const rotXDeg = (typeof devOff.rotX === "number" ? devOff.rotX : 0.0);
        const rotYDeg = (typeof devOff.rotY === "number" ? devOff.rotY : 0.0);
        const rotZDeg = (typeof devOff.rotZ === "number" ? devOff.rotZ : 0.0);

        const radX = (rotXDeg * Math.PI) / 180.0 + tiltAngle;
        const radY = (rotYDeg * Math.PI) / 180.0;
        const radZ = (rotZDeg * Math.PI) / 180.0;

        const cX = Math.cos(radX), sX = Math.sin(radX);
        const cY = Math.cos(radY), sY = Math.sin(radY);
        const cZ = Math.cos(radZ), sZ = Math.sin(radZ);

        // 3D Rotation function (Euler Z -> Y -> X)
        const rotateVec3D = (v) => {
          let x = v[0], y = v[1], z = v[2];
          // 1. Roll around Z
          let x1 = x * cZ - y * sZ;
          let y1 = x * sZ + y * cZ;
          let z1 = z;
          // 2. Yaw around Y
          let x2 = x1 * cY + z1 * sY;
          let y2 = y1;
          let z2 = -x1 * sY + z1 * cY;
          // 3. Pitch around X
          let x3 = x2;
          let y3 = y2 * cX - z2 * sX;
          let z3 = y2 * sX + z2 * cX;
          return [x3, y3, z3];
        };

        let rVec = rotateVec3D([1, 0, 0]);
        let nVec = rotateVec3D([0, 1, 0]);
        let fVec = rotateVec3D([0, 0, 1]);

        const dx = (typeof devOff.x === "number" ? devOff.x : 0.03) * itemScale;
        const dy = (typeof devOff.y === "number" ? devOff.y : 0.00) * itemScale;
        const dz = (typeof devOff.z === "number" ? devOff.z : 0.04) * itemScale;

        let gripPos = [
          handPos[0] + dx,
          handPos[1] + dy + offsetY,
          handPos[2] + dz + offsetZ
        ];
        // Pivot bucket around its top handle grip (ny = 0.55 * bScale)
        let centerPos = [
          gripPos[0] - nVec[0] * 0.55 * bScale,
          gripPos[1] - nVec[1] * 0.55 * bScale,
          gripPos[2] - nVec[2] * 0.55 * bScale
        ];

        let snappedSoilLocal = null;
        let snappedUpLocal = null;

        // Temporary Snap to Planter Box during watering animation so water pours directly onto the box & sprout from above
        if (waterTimer > 0 && window.activeWateringAnimPlanter && window.activeWateringAnimPlanter.position && typeof getCharacterMatrix === "function") {
          const planter = window.activeWateringAnimPlanter;
          const pP = planter.position;
          const pN = planter.normal || [0, 1, 0];
          const pF = planter.F || [0, 0, 1];
          const pS = planter.customScale || 0.46;

          const charMat = getCharacterMatrix();
          const cScale = Math.hypot(charMat[0], charMat[1], charMat[2]) || 0.1;
          const cR = [charMat[0] / cScale, charMat[1] / cScale, charMat[2] / cScale];
          const cUp = [charMat[4] / cScale, charMat[5] / cScale, charMat[6] / cScale];
          const cFwd = [charMat[8] / cScale, charMat[9] / cScale, charMat[10] / cScale];
          const charPos = [charMat[12], charMat[13], charMat[14]];

          const worldToLocal = (wPos) => {
            const dxW = wPos[0] - charPos[0];
            const dyW = wPos[1] - charPos[1];
            const dzW = wPos[2] - charPos[2];
            return [
              (dxW * cR[0] + dyW * cR[1] + dzW * cR[2]) / cScale,
              (dxW * cUp[0] + dyW * cUp[1] + dzW * cUp[2]) / cScale,
              (dxW * cFwd[0] + dyW * cFwd[1] + dzW * cFwd[2]) / cScale
            ];
          };
          const worldDirToLocal = (wDir) => [
            wDir[0] * cR[0] + wDir[1] * cR[1] + wDir[2] * cR[2],
            wDir[0] * cUp[0] + wDir[1] * cUp[1] + wDir[2] * cUp[2],
            wDir[0] * cFwd[0] + wDir[1] * cFwd[1] + wDir[2] * cFwd[2]
          ];

          // Horizontal direction from player to planter box center
          const rawToBox = [pP[0] - charPos[0], pP[1] - charPos[1], pP[2] - charPos[2]];
          const dotN = rawToBox[0] * pN[0] + rawToBox[1] * pN[1] + rawToBox[2] * pN[2];
          const horizW = [rawToBox[0] - pN[0] * dotN, rawToBox[1] - pN[1] * dotN, rawToBox[2] - pN[2] * dotN];
          const horizLen = Math.hypot(horizW[0], horizW[1], horizW[2]);
          const pourDirW = horizLen > 0.001
            ? [horizW[0] / horizLen, horizW[1] / horizLen, horizW[2] / horizLen]
            : [pF[0], pF[1], pF[2]];

          // Right-handed side axis: pN x pourDirW
          let sideDirW = [
            pN[1] * pourDirW[2] - pN[2] * pourDirW[1],
            pN[2] * pourDirW[0] - pN[0] * pourDirW[2],
            pN[0] * pourDirW[1] - pN[1] * pourDirW[0]
          ];
          const sideLen = Math.hypot(sideDirW[0], sideDirW[1], sideDirW[2]) || 1.0;
          sideDirW = [sideDirW[0] / sideLen, sideDirW[1] / sideLen, sideDirW[2] / sideLen];

          const upL = worldDirToLocal(pN);
          const fwdL = worldDirToLocal(pourDirW);
          const sideL = worldDirToLocal(sideDirW);
          snappedUpLocal = upL;

          // Pour tilt angle & vertical bob while snapped directly above the planter box
          let pourTilt = 1.95; // ~112 degrees so bucket mouth points down into the planter box
          let heightAboveBox = 0.24 * pS;
          let backOffsetFromCenter = 0.045 * pS;
          let snapBlend = 1.0;

          if (tw < 0.20) {
            const s = Math.sin((tw / 0.20) * (Math.PI * 0.5));
            pourTilt = 0.75 + s * 1.20;
            heightAboveBox = (0.26 - 0.02 * s) * pS;
          } else if (tw <= 0.78) {
            const u = (tw - 0.20) / 0.58;
            pourTilt = 1.95 + Math.sin(u * Math.PI * 2.0) * 0.07;
            heightAboveBox = (0.24 - Math.sin(u * Math.PI) * 0.012) * pS;
          } else {
            const v = (tw - 0.78) / 0.22;
            const sv = v * v * (3.0 - 2.0 * v);
            pourTilt = 1.95 * (1.0 - sv);
            heightAboveBox = (0.24 + 0.03 * sv) * pS;
            snapBlend = 1.0 - sv;
          }

          const cosP = Math.cos(pourTilt);
          const sinP = Math.sin(pourTilt);

          const snapRVec = [sideL[0], sideL[1], sideL[2]];
          const snapNVec = [
            upL[0] * cosP + fwdL[0] * sinP,
            upL[1] * cosP + fwdL[1] * sinP,
            upL[2] * cosP + fwdL[2] * sinP
          ];
          const snapFVec = [
            -upL[0] * sinP + fwdL[0] * cosP,
            -upL[1] * sinP + fwdL[1] * cosP,
            -upL[2] * sinP + fwdL[2] * cosP
          ];

          const soilWorld = [
            pP[0] + pN[0] * (0.095 * pS),
            pP[1] + pN[1] * (0.095 * pS),
            pP[2] + pN[2] * (0.095 * pS)
          ];
          snappedSoilLocal = worldToLocal(soilWorld);

          const snapCenterWorld = [
            pP[0] + pN[0] * heightAboveBox - pourDirW[0] * backOffsetFromCenter,
            pP[1] + pN[1] * heightAboveBox - pourDirW[1] * backOffsetFromCenter,
            pP[2] + pN[2] * heightAboveBox - pourDirW[2] * backOffsetFromCenter
          ];
          const snapCenterLocal = worldToLocal(snapCenterWorld);

          centerPos = [
            centerPos[0] * (1.0 - snapBlend) + snapCenterLocal[0] * snapBlend,
            centerPos[1] * (1.0 - snapBlend) + snapCenterLocal[1] * snapBlend,
            centerPos[2] * (1.0 - snapBlend) + snapCenterLocal[2] * snapBlend
          ];
          rVec = [
            rVec[0] * (1.0 - snapBlend) + snapRVec[0] * snapBlend,
            rVec[1] * (1.0 - snapBlend) + snapRVec[1] * snapBlend,
            rVec[2] * (1.0 - snapBlend) + snapRVec[2] * snapBlend
          ];
          nVec = [
            nVec[0] * (1.0 - snapBlend) + snapNVec[0] * snapBlend,
            nVec[1] * (1.0 - snapBlend) + snapNVec[1] * snapBlend,
            nVec[2] * (1.0 - snapBlend) + snapNVec[2] * snapBlend
          ];
          fVec = [
            fVec[0] * (1.0 - snapBlend) + snapFVec[0] * snapBlend,
            fVec[1] * (1.0 - snapBlend) + snapFVec[1] * snapBlend,
            fVec[2] * (1.0 - snapBlend) + snapFVec[2] * snapBlend
          ];
          const rL = Math.hypot(rVec[0], rVec[1], rVec[2]) || 1.0;
          const nL = Math.hypot(nVec[0], nVec[1], nVec[2]) || 1.0;
          const fL = Math.hypot(fVec[0], fVec[1], fVec[2]) || 1.0;
          rVec = [rVec[0] / rL, rVec[1] / rL, rVec[2] / rL];
          nVec = [nVec[0] / nL, nVec[1] / nL, nVec[2] / nL];
          fVec = [fVec[0] / fL, fVec[1] / fL, fVec[2] / fL];

          gripPos = [
            centerPos[0] + nVec[0] * 0.55 * bScale,
            centerPos[1] + nVec[1] * 0.55 * bScale,
            centerPos[2] + nVec[2] * 0.55 * bScale
          ];
        }

        window._lastBucketGripLocalPos = [gripPos[0], gripPos[1], gripPos[2]];
        window._lastBucketCenterLocalPos = [centerPos[0], centerPos[1], centerPos[2]];
        window._lastBucketItemScale = itemScale;

        const isWaterBucketItem = !!(heldItem && (heldItem.name === "WATER_BUCKET" || heldItem.name === "water_bucket" || heldItem.hasWater));
        const showWater = (waterTimer > 0) ? (tw < 0.65) : (isWaterBucketItem && (scoopTimer <= 0 || t >= 0.35));

        window.buildIronBucketModel(
          bScale,
          centerPos,
          rVec,
          nVec,
          fVec,
          rawV,
          rawC,
          rawI,
          showWater
        );

        // Render pouring water stream directly from snapped bucket mouth down onto the planter box soil
        if (waterTimer > 0 && tw >= 0.12 && tw <= 0.78 && typeof buildTaperedSegment === "function") {
          const pourProgress = (tw - 0.12) / 0.66;
          const mouthPos = [
            centerPos[0] + nVec[0] * (0.24 * bScale),
            centerPos[1] + nVec[1] * (0.24 * bScale),
            centerPos[2] + nVec[2] * (0.24 * bScale)
          ];
          let streamEnd;
          if (snappedSoilLocal) {
            const reachSoil = Math.min(1.0, pourProgress * 4.0);
            streamEnd = [
              mouthPos[0] + (snappedSoilLocal[0] - mouthPos[0]) * reachSoil,
              mouthPos[1] + (snappedSoilLocal[1] - mouthPos[1]) * reachSoil,
              mouthPos[2] + (snappedSoilLocal[2] - mouthPos[2]) * reachSoil
            ];
          } else {
            const streamLen = 0.28 * itemScale * Math.sin(pourProgress * Math.PI);
            streamEnd = [
              mouthPos[0] + nVec[0] * (0.10 * bScale),
              mouthPos[1] - streamLen,
              mouthPos[2] + 0.06 * itemScale
            ];
          }
          buildTaperedSegment(
            mouthPos,
            streamEnd,
            0.15 * bScale,
            0.08 * bScale,
            6,
            [0.24, 0.72, 0.98],
            rawV,
            rawC,
            rawI,
            true
          );

          // Water splash ring on the planter box soil surface around the sprout
          if (snappedSoilLocal && snappedUpLocal && pourProgress > 0.15) {
            const splashWave = Math.sin(((pourProgress - 0.15) / 0.85) * Math.PI);
            const splashTop = [
              snappedSoilLocal[0] + snappedUpLocal[0] * (0.025 * bScale),
              snappedSoilLocal[1] + snappedUpLocal[1] * (0.025 * bScale),
              snappedSoilLocal[2] + snappedUpLocal[2] * (0.025 * bScale)
            ];
            buildTaperedSegment(
              snappedSoilLocal,
              splashTop,
              0.24 * bScale * splashWave,
              0.14 * bScale * splashWave,
              8,
              [0.36, 0.80, 1.0],
              rawV,
              rawC,
              rawI,
              true
            );
          }
        }
      }

      function updateChibiEquipMesh() {
        const activeGl = (typeof gl !== "undefined" && gl) || (typeof window !== "undefined" && window.gl ? window.gl : null);
        if (!activeGl) return;
        if (typeof gl === "undefined" || !gl) gl = activeGl;
        const heldItem = (typeof window.getHeldItem === "function" ? window.getHeldItem() : (typeof getHeldItem === "function" ? getHeldItem() : null));
        const isRag = !!(typeof ragdollEnabled !== "undefined" && ragdollEnabled);
        if (!heldItem || isRag || !window.chibiGlbModel || !window.chibiGlbModel.nodes) {
          equipIndicesLength = 0;
          return;
        }
        const model = window.chibiGlbModel;
        const rawV = [], rawC = [], rawI = [];
        const itemScale = (typeof playerScale !== 'undefined' ? playerScale : 0.1) / 0.1;
        const scale = 0.59;
        let yOffset = -0.46;
        if (typeof activeRidingBoat !== "undefined" && activeRidingBoat) yOffset = -0.15;
        else if (typeof activeRidingMech !== "undefined" && activeRidingMech) yOffset = -0.15;
        else if (typeof currentSwimFactor !== "undefined" && currentSwimFactor > 0) yOffset = -0.46 - currentSwimFactor * 0.12;

        if (!isRag && heldItem && (heldItem.name === "WOODEN_ARM_CANNON" || heldItem.name === "ARM_CANNON")) {
          const rFA = model.nodes.find(n => n && n.name === "RightForeArm");
          const rH = model.nodes.find(n => n && n.name === "RightHand");
          if (rFA && rH && rFA.matrix && rH.matrix) {
            const pElbow = [ rFA.matrix[12] * scale, rFA.matrix[13] * scale + yOffset, rFA.matrix[14] * scale ];
            let pHand  = [ rH.matrix[12] * scale,  rH.matrix[13] * scale + yOffset,  rH.matrix[14] * scale ];

            // When aiming, align arm cannon direction precisely towards window.currentAimTargetPos
            const isAimingRanged = (typeof isUsingItem !== "undefined" && isUsingItem) && (typeof window.isAimingBow !== "undefined" && window.isAimingBow);
            if (isAimingRanged && window.currentAimTargetPos && typeof getCharacterMatrix === "function") {
              const charMat = getCharacterMatrix();
              const pElbowWorld = [
                charMat[0] * pElbow[0] + charMat[4] * pElbow[1] + charMat[8] * pElbow[2] + charMat[12],
                charMat[1] * pElbow[0] + charMat[5] * pElbow[1] + charMat[9] * pElbow[2] + charMat[13],
                charMat[2] * pElbow[0] + charMat[6] * pElbow[1] + charMat[10] * pElbow[2] + charMat[14]
              ];
              const tPos = window.currentAimTargetPos;
              const dW = [tPos[0] - pElbowWorld[0], tPos[1] - pElbowWorld[1], tPos[2] - pElbowWorld[2]];
              const dDist = Math.hypot(dW[0], dW[1], dW[2]);
              if (dDist > 0.01) {
                const normW = [dW[0] / dDist, dW[1] / dDist, dW[2] / dDist];
                const cScale = (typeof playerScale === "number") ? playerScale : 0.1;
                const cR = [charMat[0] / cScale, charMat[1] / cScale, charMat[2] / cScale];
                const cUp = [charMat[4] / cScale, charMat[5] / cScale, charMat[6] / cScale];
                const cFwd = [charMat[8] / cScale, charMat[9] / cScale, charMat[10] / cScale];

                const aimLocal = [
                  normW[0] * cR[0] + normW[1] * cR[1] + normW[2] * cR[2],
                  normW[0] * cUp[0] + normW[1] * cUp[1] + normW[2] * cUp[2],
                  normW[0] * cFwd[0] + normW[1] * cFwd[1] + normW[2] * cFwd[2]
                ];
                const aL = Math.hypot(aimLocal[0], aimLocal[1], aimLocal[2]);
                if (aL > 0.001) {
                  aimLocal[0] /= aL; aimLocal[1] /= aL; aimLocal[2] /= aL;
                  const armLen = Math.hypot(rH.matrix[12] * scale - rFA.matrix[12] * scale, rH.matrix[13] * scale - rFA.matrix[13] * scale, rH.matrix[14] * scale - rFA.matrix[14] * scale) || (0.13 * scale);
                  pHand = [
                    pElbow[0] + aimLocal[0] * armLen,
                    pElbow[1] + aimLocal[1] * armLen,
                    pElbow[2] + aimLocal[2] * armLen
                  ];
                }
              }
            }

            buildWoodenArmCannonMesh(pElbow, pHand, rawV, rawC, rawI, itemScale);
          }
        } else if (!isRag && heldItem && (heldItem.name === "IRON_BUCKET" || heldItem.name === "iron_bucket" || heldItem.name === "WATER_BUCKET" || heldItem.name === "water_bucket" || (typeof window.bucketWaterTimer === "number" && window.bucketWaterTimer > 0)) && typeof window.buildIronBucketModel === "function") {
          const rH = model.nodes.find(n => n && n.name === "RightHand");
          const pHand = (rH && rH.matrix)
            ? [ rH.matrix[12] * scale, rH.matrix[13] * scale + yOffset, rH.matrix[14] * scale ]
            : [ 0.15 * itemScale, -0.09 + yOffset, 0.02 * itemScale ];
          buildHeldIronBucketMesh(pHand, itemScale, heldItem, rawV, rawC, rawI);
        }

        if (rawI.length > 0) {
          const flatEquip = makeFlatShadedGeometry(rawV, rawC, rawI);
          equipIndicesLength = flatEquip.indices.length;

          if (!equipVertexBuffer) equipVertexBuffer = gl.createBuffer();
          uploadDynamicBuffer(gl, equipVertexBuffer, gl.ARRAY_BUFFER, flatEquip.vertices instanceof Float32Array ? flatEquip.vertices : new Float32Array(flatEquip.vertices));

          if (!equipColorBuffer) equipColorBuffer = gl.createBuffer();
          uploadDynamicBuffer(gl, equipColorBuffer, gl.ARRAY_BUFFER, flatEquip.colors instanceof Float32Array ? flatEquip.colors : new Float32Array(flatEquip.colors));

          if (!equipNormalBuffer) equipNormalBuffer = gl.createBuffer();
          uploadDynamicBuffer(gl, equipNormalBuffer, gl.ARRAY_BUFFER, flatEquip.normals instanceof Float32Array ? flatEquip.normals : new Float32Array(flatEquip.normals));

          if (!equipIndexBuffer) equipIndexBuffer = gl.createBuffer();
          if (equipIndexBuffer._uploadedCount !== equipIndicesLength) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, equipIndexBuffer);
            const idxData = (equipIndicesLength > 65535)
              ? (flatEquip.indices instanceof Uint32Array ? flatEquip.indices : new Uint32Array(flatEquip.indices))
              : (flatEquip.indices instanceof Uint16Array ? flatEquip.indices : new Uint16Array(flatEquip.indices));
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.DYNAMIC_DRAW);
            equipIndexBuffer._uploadedCount = equipIndicesLength;
          }
        } else {
          equipIndicesLength = 0;
        }
      }
      window.updateChibiEquipMesh = updateChibiEquipMesh;

      function updateCharacterMesh(phase, isClone = false, cloneWalkBlend = 1.0, cloneSwimFactor = 0.0, cloneSwimMove = 0.0) {
        const activeGl = (typeof gl !== "undefined" && gl) || (typeof window !== "undefined" && window.gl ? window.gl : null);
        if (!activeGl) return;
        if (typeof gl === "undefined" || !gl) gl = activeGl;
        if (typeof window !== "undefined" && window.characterModel === "chibi" && !isClone) {
          if (!window.chibiGlbTexture && typeof window.createChibiGlbTexture === "function") {
            window.createChibiGlbTexture(activeGl);
          }
          const glbData = getGlbCharacterMeshData(phase, isClone, cloneWalkBlend);
          if (glbData) {
            if (typeof window !== 'undefined') {
              window.charIndicesLength = glbData.indices.length;
              charIndicesLength = window.charIndicesLength;
            }
            charRawVertices = glbData.vertices;

            if (!charVertexBuffer) charVertexBuffer = gl.createBuffer();
            uploadDynamicBuffer(gl, charVertexBuffer, gl.ARRAY_BUFFER, glbData.vertices);

            if (!charLocalVertexBuffer) charLocalVertexBuffer = gl.createBuffer();
            uploadDynamicBuffer(gl, charLocalVertexBuffer, gl.ARRAY_BUFFER, glbData.vertices);

            if (!charNormalBuffer) charNormalBuffer = gl.createBuffer();
            uploadDynamicBuffer(gl, charNormalBuffer, gl.ARRAY_BUFFER, glbData.normals);

            const isDevColorOrBone = !!(typeof window !== "undefined" && (window.devColorByParts || window.devSelectedBone));
            if (!charColorBuffer) charColorBuffer = gl.createBuffer();
            if (charColorBuffer._sourceType !== "chibi" || isDevColorOrBone || charColorBuffer._lastIsDevColor) {
              uploadDynamicBuffer(gl, charColorBuffer, gl.ARRAY_BUFFER, glbData.colors);
              charColorBuffer._sourceType = "chibi";
              charColorBuffer._lastIsDevColor = isDevColorOrBone;
            }

            if (glbData.texcoords) {
              if (typeof window.charTexCoordBuffer === "undefined" || !window.charTexCoordBuffer) {
                window.charTexCoordBuffer = gl.createBuffer();
              }
              if (window.charTexCoordBuffer._sourceType !== "chibi") {
                gl.bindBuffer(gl.ARRAY_BUFFER, window.charTexCoordBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, glbData.texcoords, gl.STATIC_DRAW);
                window.charTexCoordBuffer._sourceType = "chibi";
              }
            }

            if (!charIndexBuffer) charIndexBuffer = gl.createBuffer();
            if (charIndexBuffer._uploadedCount !== charIndicesLength || charIndexBuffer._sourceType !== "chibi") {
              gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, charIndexBuffer);
              const idxData = (charIndicesLength > 65535)
                ? (glbData.indices instanceof Uint32Array ? glbData.indices : new Uint32Array(glbData.indices))
                : (glbData.indices instanceof Uint16Array ? glbData.indices : new Uint16Array(glbData.indices));
              gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.STATIC_DRAW);
              charIndexBuffer._uploadedCount = charIndicesLength;
              charIndexBuffer._sourceType = "chibi";
            }
            updateChibiEquipMesh();
            return;
          }
        }

        resetCapsuleBufferPool();
        resetMergeBufferPool();

        const heldItem = isClone ? null : getHeldItem();
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

        const isPlayerRagdoll = !isClone && ragdollEnabled && ragdollInitialized;
        const bOffset = isPlayerRagdoll
          ? 0.0
          : Math.sin(waterAnimTime * 2.5) * 0.006;
        const bRadius = isPlayerRagdoll
          ? 0.0
          : Math.sin(waterAnimTime * 2.5) * 0.002;

        let torsoTilt = 0.0;
        const walkScale = isClone ? cloneWalkBlend : 1.0;
        const armSwingAmp = isClone ? 0.28 : 0.8;
        let armAngle = Math.sin(phase) * armSwingAmp * walkScale;
        let leftElbowFlex = 0.1 + Math.max(0, -armAngle * 0.5);
        let rightArmAngle = Math.sin(phase + Math.PI) * armSwingAmp * walkScale;
        let rightElbowFlex = 0.1 + Math.max(0, -rightArmAngle * 0.5);

        let legAngle = Math.sin(phase + Math.PI) * 0.6 * walkScale;
        let leftKneeFlex = 0.1 + Math.max(0, legAngle * 0.5);
        let rightLegAngle = Math.sin(phase) * 0.6 * walkScale;
        let rightKneeFlex = 0.1 + Math.max(0, rightLegAngle * 0.5);

        if (!isClone && typeof activeRidingBoat !== "undefined" && activeRidingBoat) {
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
        } else if (!isClone && typeof activeRidingMech !== "undefined" && activeRidingMech) {
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
        } else if (!isClone && typeof ragdollEnabled !== "undefined" && ragdollEnabled && typeof ragdollLimbs !== "undefined" && ragdollLimbs) {
          armAngle = ragdollLimbs.aL;
          leftElbowFlex = ragdollLimbs.eL;
          rightArmAngle = ragdollLimbs.aR;
          rightElbowFlex = ragdollLimbs.eR;

          legAngle = ragdollLimbs.lL;
          leftKneeFlex = ragdollLimbs.kL;
          rightLegAngle = ragdollLimbs.lR;
          rightKneeFlex = ragdollLimbs.kR;
        } else {
          const effectiveSwimFactor = isClone
            ? (typeof cloneSwimFactor !== "undefined" ? cloneSwimFactor : (window.clonesGlobalSwimFactor || 0.0))
            : (typeof currentSwimFactor !== "undefined" ? currentSwimFactor : 0.0);
          const effectiveSwimMovement = isClone
            ? (typeof cloneSwimMove !== "undefined" ? cloneSwimMove : (window.clonesGlobalSwimMove || 0.0))
            : (typeof swimMovementFactor !== "undefined" ? swimMovementFactor : 0.0);

          if (effectiveSwimFactor > 0.0) {
            // --- LEFT ARM ---
            const treadLeftArm = 0.45 + Math.sin(waterAnimTime * 3.5) * 0.15;
            const treadLeftElbow = 0.55 + Math.cos(waterAnimTime * 3.5) * 0.1;

            const swimArm = Math.sin(phase * 1.5) * 1.0 + 1.2;
            const swimElbow = 0.2 + Math.cos(phase * 1.5) * 0.2;

            const combinedArm =
              treadLeftArm * (1.0 - effectiveSwimMovement) +
              swimArm * effectiveSwimMovement;
            const combinedElbow =
              treadLeftElbow * (1.0 - effectiveSwimMovement) +
              swimElbow * effectiveSwimMovement;

            armAngle =
              armAngle * (1.0 - effectiveSwimFactor) +
              combinedArm * effectiveSwimFactor;
            leftElbowFlex =
              leftElbowFlex * (1.0 - effectiveSwimFactor) +
              combinedElbow * effectiveSwimFactor;

            // --- RIGHT ARM ---
            const treadRightArm = 0.45 + Math.cos(waterAnimTime * 3.5) * 0.15;
            const treadRightElbow = 0.55 + Math.sin(waterAnimTime * 3.5) * 0.1;

            const swimRightArm = Math.sin(phase * 1.5 + Math.PI) * 1.0 + 1.2;
            const swimRightElbow = 0.2 + Math.cos(phase * 1.5 + Math.PI) * 0.2;

            const combinedRightArm =
              treadRightArm * (1.0 - effectiveSwimMovement) +
              swimRightArm * effectiveSwimMovement;
            const combinedRightElbow =
              treadRightElbow * (1.0 - effectiveSwimMovement) +
              swimRightElbow * effectiveSwimMovement;

            rightArmAngle =
              rightArmAngle * (1.0 - effectiveSwimFactor) +
              combinedRightArm * effectiveSwimFactor;
            rightElbowFlex =
              rightElbowFlex * (1.0 - effectiveSwimFactor) +
              combinedRightElbow * effectiveSwimFactor;

            // --- LEFT LEG ---
            const treadLeftLeg = 0.3 + Math.sin(waterAnimTime * 3.5) * 0.25;
            const treadLeftKnee = 0.5 + Math.cos(waterAnimTime * 3.5) * 0.2;

            const swimLeg = Math.sin(phase * 2.5) * 0.4;
            const swimKnee = 0.1 + Math.max(0, -swimLeg * 0.3);

            const combinedLeftLeg =
              treadLeftLeg * (1.0 - effectiveSwimMovement) +
              swimLeg * effectiveSwimMovement;
            const combinedLeftKnee =
              treadLeftKnee * (1.0 - effectiveSwimMovement) +
              swimKnee * effectiveSwimMovement;

            legAngle =
              legAngle * (1.0 - effectiveSwimFactor) +
              combinedLeftLeg * effectiveSwimFactor;
            leftKneeFlex =
              leftKneeFlex * (1.0 - effectiveSwimFactor) +
              combinedLeftKnee * effectiveSwimFactor;

            // --- RIGHT LEG ---
            const treadRightLeg = 0.3 - Math.sin(waterAnimTime * 3.5) * 0.25;
            const treadRightKnee = 0.5 - Math.cos(waterAnimTime * 3.5) * 0.2;

            const swimRightLeg = Math.sin(phase * 2.5 + Math.PI) * 0.4;
            const swimRightKnee = 0.1 + Math.max(0, -swimRightLeg * 0.3);

            const combinedRightLeg =
              treadRightLeg * (1.0 - effectiveSwimMovement) +
              swimRightLeg * effectiveSwimMovement;
            const combinedRightKnee =
              treadRightKnee * (1.0 - effectiveSwimMovement) +
              swimRightKnee * effectiveSwimMovement;

            rightLegAngle =
              rightLegAngle * (1.0 - effectiveSwimFactor) +
              combinedRightLeg * effectiveSwimFactor;
            rightKneeFlex =
              rightKneeFlex * (1.0 - effectiveSwimFactor) +
              combinedRightKnee * effectiveSwimFactor;
          }
        }
        
        if (!isClone && typeof jumpBlend !== "undefined" && jumpBlend > 0.0) {
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

        // Unified torso extends from pelvic floor / groin (-0.090) up to neck collar (0.170)
        chestP1 = [0, -0.090 + bOffset, 0];
        let defaultChestP2 = [0, 0.170 + bOffset, 0];
        chestP2 = isRiding ? rotatePointX(chestP1, defaultChestP2, torsoTilt) : defaultChestP2;
        
        pelvisP1 = [0, -0.090 + bOffset, 0];
        pelvisP2 = [0, -0.090 + bOffset, 0];
        
        let defaultNeckP1 = [0, 0.162 + bOffset, 0];
        let defaultNeckP2 = [0, 0.212 + bOffset, 0];
        let defaultHeadP1 = [0, 0.336 + bOffset, 0];
        let defaultHeadP2 = [0, 0.336 + bOffset, 0];
        
        neckP1 = isRiding ? rotatePointX(chestP1, defaultNeckP1, torsoTilt) : defaultNeckP1;
        neckP2 = isRiding ? rotatePointX(chestP1, defaultNeckP2, torsoTilt) : defaultNeckP2;
        headP1 = isRiding ? rotatePointX(chestP1, defaultHeadP1, torsoTilt) : defaultHeadP1;
        headP2 = headP1;
        
        let defaultLeftEarP1 = [-0.140, 0.268 + bOffset, -0.018];
        let defaultLeftEarP2 = [-0.145, 0.312 + bOffset, -0.024];
        let defaultRightEarP1 = [0.140, 0.268 + bOffset, -0.018];
        let defaultRightEarP2 = [0.145, 0.312 + bOffset, -0.024];
        
        leftEarP1 = isRiding ? rotatePointX(chestP1, defaultLeftEarP1, torsoTilt) : defaultLeftEarP1;
        leftEarP2 = isRiding ? rotatePointX(chestP1, defaultLeftEarP2, torsoTilt) : defaultLeftEarP2;
        rightEarP1 = isRiding ? rotatePointX(chestP1, defaultRightEarP1, torsoTilt) : defaultRightEarP1;
        rightEarP2 = isRiding ? rotatePointX(chestP1, defaultRightEarP2, torsoTilt) : defaultRightEarP2;

        // Arm joints firmly seated inside the torso shoulder contours (zero gap)
        let defaultLeftArmPivot = [-0.074, 0.124 + bOffset, 0];
        let defaultLeftElbowBase = [-0.116, 0.012 + bOffset, -0.006];
        let defaultLeftHandBase = [-0.146, -0.095 + bOffset, 0.022];

        let defaultRightArmPivot = [0.074, 0.124 + bOffset, 0];
        let defaultRightElbowBase = [0.116, 0.012 + bOffset, -0.006];
        let defaultRightHandBase = [0.146, -0.095 + bOffset, 0.022];

        leftArmPivot = isRiding ? rotatePointX(chestP1, defaultLeftArmPivot, torsoTilt) : defaultLeftArmPivot;
        const leftElbowBase = isRiding ? rotatePointX(chestP1, defaultLeftElbowBase, torsoTilt) : defaultLeftElbowBase;
        const leftHandBase = isRiding ? rotatePointX(chestP1, defaultLeftHandBase, torsoTilt) : defaultLeftHandBase;

        rightArmPivot = isRiding ? rotatePointX(chestP1, defaultRightArmPivot, torsoTilt) : defaultRightArmPivot;
        const rightElbowBase = isRiding ? rotatePointX(chestP1, defaultRightElbowBase, torsoTilt) : defaultRightElbowBase;
        const rightHandBase = isRiding ? rotatePointX(chestP1, defaultRightHandBase, torsoTilt) : defaultRightHandBase;

        // Hip joints firmly seated inside the wide pelvic hip volume (zero gap, seamless leg transition)
        leftLegPivot = [-0.052, -0.068 + bOffset, 0];
        const leftKneeBase = [-0.052, -0.246, 0.010];
        const leftFootBase = [-0.052, -0.420, 0.0];

        rightLegPivot = [0.052, -0.068 + bOffset, 0];
        const rightKneeBase = [0.052, -0.246, 0.010];
        const rightFootBase = [0.052, -0.420, 0.0];

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
        
        let isAimingBow = (typeof window !== "undefined" && !!window.isAimingBow);
        
        if (!isClone && isAimingBow && typeof keysPressed !== 'undefined') {
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
          } else if (heldItem.name === "WOODEN_ARM_CANNON" || heldItem.name === "ARM_CANNON") {
                 // Classic humanoid model: Raise the right arm horizontally forward and hold it in place continuously
                 const l_upper = 0.155;
                 const l_lower = 0.145;

                 // Calculate vertical aim pitch (from TPS camera rotationX or locked target NPC)
                 let currentPitch = 0.0;
                 if (typeof cameraMode !== "undefined" && (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") && typeof rotationX !== "undefined") {
                     currentPitch = rotationX;
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
                         let upOffset = (npc.type === "meganeura") ? 0.0 : -0.02;
                         let forwardOffset = (npc.type === "meganeura") ? -0.06 : -0.12;
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
                         const d_dist_planar = Math.sqrt(dVec[0]**2 + dVec[1]**2 + dVec[2]**2 - d_up**2);
                         if (d_dist_planar > 0.05) {
                             currentPitch = -Math.atan2(d_up, d_dist_planar);
                         }
                     }
                 }

                 // Recoil kickback during firing recovery
                 let recoilZ = 0.0;
                 if (arrowShotInCurrentAnim && useAnimTimer > 0) {
                     const rP = Math.max(0.0, Math.min(1.0, useAnimTimer / 0.32));
                     recoilZ = Math.sin(rP * Math.PI) * 0.035;
                 }

                 // Right arm raised horizontally forward along +Z with slight inward convergence towards centerline
                 const targetRightElbow = [
                     rightArmPivot[0] - 0.015,
                     rightArmPivot[1],
                     rightArmPivot[2] + l_upper - recoilZ * 0.4
                 ];
                 const targetRightHand = [
                     targetRightElbow[0] - 0.015,
                     targetRightElbow[1],
                     targetRightElbow[2] + l_lower - recoilZ * 0.6
                 ];

                 // Apply vertical pitch tilt so cannon aims up/down with camera
                 rightElbowRot = rotatePointX(rightArmPivot, targetRightElbow, currentPitch);
                 rightHandRot = rotatePointX(rightArmPivot, targetRightHand, currentPitch);

                 // Apply slight upper body tilt if looking up/down
                 const applyCannonPitch = (pt) => rotatePointX(chestP1, pt, currentPitch * 0.35);
                 neckP1 = applyCannonPitch(neckP1);
                 neckP2 = applyCannonPitch(neckP2);
                 headP1 = applyCannonPitch(headP1);
                 headP2 = applyCannonPitch(headP2);
                 leftEarP1 = applyCannonPitch(leftEarP1);
                 leftEarP2 = applyCannonPitch(leftEarP2);
                 rightEarP1 = applyCannonPitch(rightEarP1);
                 rightEarP2 = applyCannonPitch(rightEarP2);
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
                  } else if (heldItem.name === "BRANCH" || heldItem.name === "branch") {
                      // Natural branch in hand: extends slightly behind the grip and forward
                      axeHandleP1Base = [0.18, -0.09 + bOffset, -0.08];
                      axeHandleP2Base = [0.18, -0.09 + bOffset, 0.32];
                      axeBladeP1Base = [0.18, -0.09 + bOffset, 0.32];
                      axeBladeP2Base = [0.18, -0.09 + bOffset, 0.32];
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

        if (!isClone && ragdollEnabled && ragdollInitialized) {
          if (typeof ragdollQuat !== "undefined" && ragdollQuat && ragdollQuat.length === 4) {
            const m = quatToMatrix3(ragdollQuat);
            R_rot = m.R;
            N_rot = m.N;
            F_rot = m.F;
          } else {
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
          }

          const rp = ragdollPos;
          const r_len = Math.sqrt(rp[0] ** 2 + rp[1] ** 2 + rp[2] ** 2);
          const gravityDir =
            r_len > 0.001
              ? [-rp[0] / r_len, -rp[1] / r_len, -rp[2] / r_len]
              : [0, -1, 0];

          const sagLimbLocal = (pt, thickness, sagScale) => {
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

            // Clamping to terrain to make limbs rest naturally on the floor
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
            const sc = (typeof playerScale === "number" && playerScale > 0.001) ? playerScale : 1.0;
            const dx = (px - rp[0]) / sc;
            const dy = (py - rp[1]) / sc;
            const dz = (pz - rp[2]) / sc;
            return [
              dx * R_rot[0] + dy * R_rot[1] + dz * R_rot[2],
              dx * N_rot[0] + dy * N_rot[1] + dz * N_rot[2],
              dx * F_rot[0] + dy * F_rot[1] + dz * F_rot[2],
            ];
          };

          // Keep torso, neck, head, ears, and shoulder/hip pivots 100% locked in local character space
          // so generateChibiTorso, generateChibiHead, generateChibiEar, and createHairMesh share the exact same local axes and center!
          leftElbowRot = sagLimbLocal(leftElbowRot, 0.038, 0.04);
          leftHandRot = sagLimbLocal(leftHandRot, 0.032, 0.08);

          rightElbowRot = sagLimbLocal(rightElbowRot, 0.038, 0.04);
          rightHandRot = sagLimbLocal(rightHandRot, 0.032, 0.08);

          leftKneeRot = sagLimbLocal(leftKneeRot, 0.048, 0.04);
          leftFootRot = sagLimbLocal(leftFootRot, 0.04, 0.08);

          rightKneeRot = sagLimbLocal(rightKneeRot, 0.048, 0.04);
          rightFootRot = sagLimbLocal(rightFootRot, 0.04, 0.08);
          
          if (heldItem) {
              if (heldItem.name === "BOW") {
                  bowGripRot = sagLimbLocal(bowGripRot, 0.03, 0.08);
                  bowUpperTipRot = sagLimbLocal(bowUpperTipRot, 0.03, 0.08);
                  bowLowerTipRot = sagLimbLocal(bowLowerTipRot, 0.03, 0.08);
              } else {
                  axeHandleP1Rot = sagLimbLocal(axeHandleP1Rot, 0.03, 0.08);
                  axeHandleP2Rot = sagLimbLocal(axeHandleP2Rot, 0.03, 0.08);
                  axeBladeP1Rot = sagLimbLocal(axeBladeP1Rot, 0.04, 0.08);
                  axeBladeP2Rot = sagLimbLocal(axeBladeP2Rot, 0.04, 0.08);
                  if (heldItem.name === "PICKAXE") {
                      axeBlade2P1Rot = sagLimbLocal(axeBlade2P1Rot, 0.04, 0.08);
                      axeBlade2P2Rot = sagLimbLocal(axeBlade2P2Rot, 0.04, 0.08);
                  }
              }
          }
        }

        const scaleFactor = 1.0;
        const cloneEq = isClone
          ? (typeof window.getCharacterEquippedClothingState === "function"
              ? window.getCharacterEquippedClothingState(true)
              : { wearTop: true, wearShorts: true, wearShirt: false, wearLeggings: false })
          : null;
        const chest = generateChibiTorso(
          chestP1,
          chestP2,
          (0.09 + bRadius) * scaleFactor,
          scaleFactor,
          cloneEq ? cloneEq.wearTop : null,
          cloneEq ? cloneEq.wearShorts : null,
          cloneEq ? cloneEq.wearShirt : null,
          cloneEq ? cloneEq.wearLeggings : null,
        );
        const head = generateChibiHead(
          headP1,
          headP2,
          0.192 * scaleFactor,
          scaleFactor,
        );
        const leftEar = generateChibiEar(
          leftEarP1,
          leftEarP2,
          true,
          scaleFactor,
        );
        const rightEar = generateChibiEar(
          rightEarP1,
          rightEarP2,
          false,
          scaleFactor,
        );

        const leftArmUpper = generateChibiUpperArm(
          leftArmPivot,
          leftElbowRot,
          true,
          scaleFactor,
          cloneEq ? cloneEq.wearTop : null,
          cloneEq ? cloneEq.wearShirt : null,
        );
        const leftArmLower = generateChibiForeArm(
          leftElbowRot,
          leftHandRot,
          true,
          scaleFactor,
        );

        const rightArmUpper = generateChibiUpperArm(
          rightArmPivot,
          rightElbowRot,
          false,
          scaleFactor,
          cloneEq ? cloneEq.wearTop : null,
          cloneEq ? cloneEq.wearShirt : null,
        );
        const rightArmLower = generateChibiForeArm(
          rightElbowRot,
          rightHandRot,
          false,
          scaleFactor,
        );

        const leftLegUpper = generateChibiThigh(
          leftLegPivot,
          leftKneeRot,
          true,
          scaleFactor,
          cloneEq ? cloneEq.wearShorts : null,
          cloneEq ? cloneEq.wearLeggings : null,
        );
        const leftLegLower = generateChibiCalf(
          leftKneeRot,
          leftFootRot,
          true,
          scaleFactor,
          cloneEq ? cloneEq.wearLeggings : null,
        );

        const rightLegUpper = generateChibiThigh(
          rightLegPivot,
          rightKneeRot,
          false,
          scaleFactor,
          cloneEq ? cloneEq.wearShorts : null,
          cloneEq ? cloneEq.wearLeggings : null,
        );
        const rightLegLower = generateChibiCalf(
          rightKneeRot,
          rightFootRot,
          false,
          scaleFactor,
          cloneEq ? cloneEq.wearLeggings : null,
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
          const key = `v16_chibi_hair_soft_whip_${style}_${color.join(",")}_${scaleFactor}`;

          if (window._cachedHairState.baseMesh && window._cachedHairState.key === key) {
            return window._cachedHairState;
          }

          const localV = [], c = [], i = [], flexW = [];
          if (typeof window.build3DAnimeHair === "function") {
            const headFit = 0.192 / 0.240;
            const identityPtFn = (lx, ly, lz) => [lx * headFit, ly * headFit, lz * headFit];
            window.build3DAnimeHair(
              style,
              color,
              scaleFactor,
              identityPtFn,
              0, // headTilt
              localV,
              c,
              i,
              flexW
            );
          }

          if (localV.length === 0) {
            window._cachedHairState = {
              key,
              baseMesh: { localV: [], colors: [], normals: [], indices: [], flexW: [] },
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
            localDummyV[k] = localV[k];
            localDummyV[k+1] = localV[k+1] - 1000.0;
            localDummyV[k+2] = localV[k+2];
          }

          window._cachedHairState = {
            key,
            baseMesh: {
              localV,
              colors: c,
              normals: Array.from(normals),
              indices: i,
              flexW
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

          const isRag = !!(!isClone && ragdollEnabled && ragdollInitialized && R_rot && N_rot && F_rot);
          const targetHeadP = headP1;
          const numCoords = bm.localV.length;
          if (!cached.worldV || cached.worldV.length !== numCoords) {
            cached.worldV = new Float32Array(numCoords);
          }
          const worldV = cached.worldV;
          const worldNormals = bm.normals;
          const hx = targetHeadP[0];
          const hy = targetHeadP[1];
          const hz = targetHeadP[2];
          const scale = scaleFactor;

          const nowPerfSec = (typeof performance !== "undefined" ? performance.now() : Date.now()) * 0.001;
          const timeSec = nowPerfSec * 1.4;

          // Action, Jump & Ragdoll Freefall physics parameters
          const vertVel = (typeof window.playerVerticalVel === "number") ? window.playerVerticalVel : ((typeof playerVerticalVel !== "undefined") ? playerVerticalVel : 0.0);
          const isGrounded = isRag
            ? !!(typeof chibiRagdollState !== "undefined" && chibiRagdollState && chibiRagdollState.isGrounded)
            : ((typeof window.isPlayerGrounded === "boolean") ? window.isPlayerGrounded : ((typeof isPlayerGrounded !== "undefined") ? isPlayerGrounded : true));
          const curHeading = (typeof charHeading !== "undefined") ? charHeading : 0.0;

          // Compute 3D character head world position & head-local orientation axes (R_head, N_head, F_head) in ALL modes
          let worldPx = hx, worldPy = hy, worldPz = hz;
          let R_head = [1.0, 0.0, 0.0];
          let N_head = [0.0, 1.0, 0.0];
          let F_head = [0.0, 0.0, 1.0];

          if (isRag && typeof ragdollPos !== "undefined" && ragdollPos) {
            const pScale = (typeof playerScale === "number") ? playerScale : 1.0;
            R_head = R_rot;
            N_head = N_rot;
            F_head = F_rot;
            worldPx = ragdollPos[0] + pScale * (hx * R_head[0] + hy * N_head[0] + hz * F_head[0]);
            worldPy = ragdollPos[1] + pScale * (hx * R_head[1] + hy * N_head[1] + hz * F_head[1]);
            worldPz = ragdollPos[2] + pScale * (hx * R_head[2] + hy * N_head[2] + hz * F_head[2]);
          } else if (typeof getCharacterMatrix === "function") {
            const cMat = getCharacterMatrix();
            if (cMat && cMat.length >= 16) {
              const rLen = Math.hypot(cMat[0], cMat[1], cMat[2]) || 1.0;
              const nLen = Math.hypot(cMat[4], cMat[5], cMat[6]) || 1.0;
              const fLen = Math.hypot(cMat[8], cMat[9], cMat[10]) || 1.0;
              R_head = [cMat[0] / rLen, cMat[1] / rLen, cMat[2] / rLen];
              N_head = [cMat[4] / nLen, cMat[5] / nLen, cMat[6] / nLen];
              F_head = [cMat[8] / fLen, cMat[9] / fLen, cMat[10] / fLen];

              // Include upper-body pitch/tilt if present (e.g. aiming or leaning)
              const bodyTilt = (typeof torsoTilt === "number" && !isNaN(torsoTilt)) ? torsoTilt : 0.0;
              if (Math.abs(bodyTilt) > 0.001) {
                const ct = Math.cos(bodyTilt);
                const st = Math.sin(bodyTilt);
                const nTilt = [
                  N_head[0] * ct + F_head[0] * st,
                  N_head[1] * ct + F_head[1] * st,
                  N_head[2] * ct + F_head[2] * st
                ];
                const fTilt = [
                  -N_head[0] * st + F_head[0] * ct,
                  -N_head[1] * st + F_head[1] * ct,
                  -N_head[2] * st + F_head[2] * ct
                ];
                N_head = nTilt;
                F_head = fTilt;
              }

              worldPx = cMat[12] + hx * cMat[0] + hy * cMat[4] + hz * cMat[8];
              worldPy = cMat[13] + hx * cMat[1] + hy * cMat[5] + hz * cMat[9];
              worldPz = cMat[14] + hx * cMat[2] + hy * cMat[6] + hz * cMat[10];
            }
          }

          // Project 3D Planetary Gravity Vector (-normalize(worldPos)) into Local Head Space
          const rpLen = Math.hypot(worldPx, worldPy, worldPz) || 1.0;
          const gxWorld = -worldPx / rpLen;
          const gyWorld = -worldPy / rpLen;
          const gzWorld = -worldPz / rpLen;
          const gravLocalX = gxWorld * R_head[0] + gyWorld * R_head[1] + gzWorld * R_head[2];
          const gravLocalY = gxWorld * N_head[0] + gyWorld * N_head[1] + gzWorld * N_head[2];
          const gravLocalZ = gxWorld * F_head[0] + gyWorld * F_head[1] + gzWorld * F_head[2];

          // Gravity delta relative to upright rest pose [0, -1, 0], plus natural downward gravity weight
          const gravDeltaX = gravLocalX;
          const gravDeltaY = gravLocalY + 1.0;
          const gravDeltaZ = gravLocalZ;
          const gravSteadyWeightY = -0.015 * Math.max(0.0, -gravLocalY);

          // 3D Head-Velocity, Gravity & Rotational-Inertia Spring Simulation (O(1) Dual-Stage Whip Spring)
          if (!window._hairSpring || typeof window._hairSpring.x !== "number" || typeof window._hairSpring.tx !== "number") {
            window._hairSpring = {
              x: 0.0, vx: 0.0,
              y: 0.0, vy: 0.0,
              z: 0.0, vz: 0.0,
              tx: 0.0, vtx: 0.0,
              ty: 0.0, vty: 0.0,
              tz: 0.0, vtz: 0.0,
              yawLag: 0.0, vYaw: 0.0,
              lastHx: worldPx, lastHy: worldPy, lastHz: worldPz,
              lastHeading: curHeading,
              lastTime: nowPerfSec,
              lastGrounded: isGrounded
            };
          }
          const spring = window._hairSpring;
          const dt = Math.min(0.033, Math.max(0.004, nowPerfSec - (spring.lastTime || nowPerfSec)));
          spring.lastTime = nowPerfSec;

          // World-space movement delta -> local head-space lag impulse
          const rawDx = Math.max(-0.25, Math.min(0.25, worldPx - spring.lastHx));
          const rawDy = Math.max(-0.25, Math.min(0.25, worldPy - spring.lastHy));
          const rawDz = Math.max(-0.25, Math.min(0.25, worldPz - spring.lastHz));
          spring.lastHx = worldPx;
          spring.lastHy = worldPy;
          spring.lastHz = worldPz;

          // Heading rotation delta -> gentle rotational lag
          let dYaw = curHeading - spring.lastHeading;
          while (dYaw < -Math.PI) dYaw += Math.PI * 2;
          while (dYaw > Math.PI) dYaw -= Math.PI * 2;
          spring.lastHeading = curHeading;

          let dhx = 0.0, dhy = 0.0, dhz = 0.0;
          if (isRag) {
            dhx = rawDx * R_head[0] + rawDy * R_head[1] + rawDz * R_head[2];
            dhy = rawDx * N_head[0] + rawDy * N_head[1] + rawDz * N_head[2];
            dhz = rawDx * F_head[0] + rawDy * F_head[1] + rawDz * F_head[2];
          } else {
            const isMovingNow = (typeof isWalking !== "undefined" && isWalking);
            const isSprintNow = (typeof isSprinting !== "undefined" && isSprinting);
            const moveSpeedZ = isMovingNow ? (isSprintNow ? 0.040 : 0.022) : 0.0;
            dhx = dYaw * 0.12;
            dhy = vertVel;
            dhz = moveSpeedZ;
          }

          if (isGrounded && !spring.lastGrounded) {
            spring.vy -= 0.038;
            spring.vty -= 0.055;
          }
          spring.lastGrounded = isGrounded;

          // Continuous 3D Gravity Equilibrium Target for Primary Spring (Bangs & Mid-Lock) & Secondary Tip-Whip Follower
          const gravTargetX = gravDeltaX * 0.052;
          const gravTargetY = gravDeltaY * 0.048 + gravSteadyWeightY;
          const gravTargetZ = gravDeltaZ * 0.052;

          const whipTargetX = gravDeltaX * 0.145;
          const whipTargetY = gravDeltaY * 0.140 + gravSteadyWeightY * 1.6;
          const whipTargetZ = gravDeltaZ * 0.145;

          // Sub-stepped oscillator: Stage 1 (soft bangs/mid-strand) + Stage 2 (delayed supple whip for long hair & ponytails)
          const subDt = dt * 0.5;
          for (let step = 0; step < 2; step++) {
            spring.vx += (-dhx * 22.0 + 62.0 * (gravTargetX - spring.x) - 13.5 * spring.vx) * subDt;
            spring.vy += (-dhy * 26.0 + 66.0 * (gravTargetY - spring.y) - 14.0 * spring.vy) * subDt;
            spring.vz += (-dhz * 22.0 + 62.0 * (gravTargetZ - spring.z) - 13.5 * spring.vz) * subDt;
            spring.vYaw += (-dYaw * 9.5 - 60.0 * spring.yawLag - 13.5 * spring.vYaw) * subDt;

            spring.x = Math.max(-0.095, Math.min(0.095, spring.x + spring.vx * subDt));
            spring.y = Math.max(-0.095, Math.min(0.095, spring.y + spring.vy * subDt));
            spring.z = Math.max(-0.095, Math.min(0.095, spring.z + spring.vz * subDt));
            spring.yawLag = Math.max(-0.35, Math.min(0.35, spring.yawLag + spring.vYaw * subDt));

            // Stage 2 softer tip-whip oscillator (stiffness 28, damping 8.2 -> supple follow-through for long locks & ponytails)
            spring.vtx += (-dhx * 30.0 + 28.0 * (whipTargetX + spring.x * 0.85 - spring.tx) - 8.2 * spring.vtx) * subDt;
            spring.vty += (-dhy * 34.0 + 28.0 * (whipTargetY + spring.y * 0.85 - spring.ty) - 8.2 * spring.vty) * subDt;
            spring.vtz += (-dhz * 30.0 + 28.0 * (whipTargetZ + spring.z * 0.85 - spring.tz) - 8.2 * spring.vtz) * subDt;

            spring.tx = Math.max(-0.28, Math.min(0.28, spring.tx + spring.vtx * subDt));
            spring.ty = Math.max(-0.28, Math.min(0.28, spring.ty + spring.vty * subDt));
            spring.tz = Math.max(-0.28, Math.min(0.28, spring.tz + spring.vtz * subDt));
          }

          const bounceY = spring.y * 0.45;

          // === 3D Freefall, Jump & Ragdoll Airflow Forces in Local Head Space ===
          let airX = 0.0;
          let airY = 0.0;
          let airZ = 0.0;
          let airFlare = 0.0;
          let windTurb = 0.0;

          if (isRag) {
            const rvx = (typeof ragdollVel !== "undefined" && ragdollVel) ? ragdollVel[0] : 0.0;
            const rvy = (typeof ragdollVel !== "undefined" && ragdollVel) ? ragdollVel[1] : 0.0;
            const rvz = (typeof ragdollVel !== "undefined" && ragdollVel) ? ragdollVel[2] : 0.0;
            const fallSpeed3D = Math.hypot(rvx, rvy, rvz);

            const relWindX = -(rvx * R_head[0] + rvy * R_head[1] + rvz * R_head[2]);
            const relWindY = -(rvx * N_head[0] + rvy * N_head[1] + rvz * N_head[2]);
            const relWindZ = -(rvx * F_head[0] + rvy * F_head[1] + rvz * F_head[2]);

            const windGain = 14.5;
            airX = Math.max(-0.14, Math.min(0.14, relWindX * windGain));
            airY = Math.max(-0.12, Math.min(0.16, relWindY * windGain));
            airZ = Math.max(-0.14, Math.min(0.14, relWindZ * windGain));

            airFlare = Math.min(0.095, fallSpeed3D * 9.5 + Math.max(0.0, gravLocalY + 0.5) * 0.032);
            windTurb = Math.min(1.0, fallSpeed3D * 45.0);
          } else {
            if (vertVel > 0.0005) {
              airY = Math.max(-0.072, -vertVel * 10.5);
              airFlare = Math.min(0.035, vertVel * 3.8);
              windTurb = Math.min(0.5, vertVel * 25.0);
            } else if (vertVel < -0.0005) {
              const fallSpeed = Math.abs(vertVel);
              airY = Math.min(0.145, fallSpeed * 14.0);
              airFlare = Math.min(0.090, fallSpeed * 8.5);
              windTurb = Math.min(1.0, fallSpeed * 45.0);
            }
          }

          // Walk / Run cycle sway
          const isMovingNow = !isRag && (typeof isWalking !== "undefined" && isWalking);
          const moveAmp = isMovingNow ? 1.0 : 0.0;
          const walkX = Math.sin(phase) * 0.0075 * moveAmp;
          const walkZ = Math.cos(phase * 2.0) * 0.0065 * moveAmp;
          const walkY = -Math.abs(Math.sin(phase)) * 0.0045 * moveAmp;

          // Item / Tool swing action whip
          let actionZ = 0.0;
          let actionY = 0.0;
          if (!isRag && typeof isUsingItem !== "undefined" && isUsingItem && typeof useAnimTimer !== "undefined") {
            const swingFactor = Math.sin((1.0 - useAnimTimer) * Math.PI);
            actionZ = swingFactor * 0.015;
            actionY = -Math.abs(swingFactor) * 0.006;
          }

          // Connect chibiHairPhysics inertia
          const hairPhys = (typeof window !== "undefined" && window.chibiHairPhysics) ? window.chibiHairPhysics : null;
          const physPitch = hairPhys ? hairPhys.pitch * 0.022 : 0.0;
          const physYaw   = hairPhys ? hairPhys.yaw * 0.022 : 0.0;
          const physRoll  = hairPhys ? hairPhys.roll * 0.018 : 0.0;

          // Fast high-frequency wind flutter phase during freefall
          const flutterTime = nowPerfSec * (12.0 + windTurb * 14.0);

          // === Continuous organic ambient breathing micro-sway (active ALWAYS!) ===
          const breezeX = Math.sin(timeSec * 1.5) * 0.0030;
          const breezeZ = Math.cos(timeSec * 1.2) * 0.0030;
          const breezeY = Math.sin(timeSec * 1.8) * 0.0015;

          // Freefall wind turbulence
          const turbX = windTurb > 0 ? Math.sin(flutterTime) * (windTurb * 0.020) : 0.0;
          const turbZ = windTurb > 0 ? Math.cos(flutterTime * 1.1) * (windTurb * 0.020) : 0.0;
          const turbY = windTurb > 0 ? Math.sin(flutterTime * 0.85) * (windTurb * 0.015) : 0.0;

          const baseDx = spring.x + physYaw + physRoll + airX + walkX + breezeX + turbX;
          const baseDy = spring.y + airY + walkY + actionY + bounceY + breezeY + turbY;
          const baseDz = spring.z - physPitch + airZ + walkZ + actionZ + breezeZ + turbZ;
          const yawLagTerm = spring.yawLag * 0.35;
          const flareTerm = airFlare + Math.abs(spring.yawLag) * 0.012;

          const clampHeadFn = (typeof window !== "undefined" && window.CapsuleModel && typeof window.CapsuleModel.clampPointOutsideChibiHead === "function")
            ? window.CapsuleModel.clampPointOutsideChibiHead
            : (typeof window !== "undefined" && typeof window.clampPointOutsideChibiHead === "function" ? window.clampPointOutsideChibiHead : null);
          const clampBodyFn = (typeof window !== "undefined" && window.CapsuleModel && typeof window.CapsuleModel.clampPointOutsideChibiBodyForCloth === "function")
            ? window.CapsuleModel.clampPointOutsideChibiBodyForCloth
            : (typeof window !== "undefined" && typeof window.clampPointOutsideChibiBodyForCloth === "function" ? window.clampPointOutsideChibiBodyForCloth : null);
          const hairBodyCollider = clampBodyFn ? {
            headP1: null,
            chestP1,
            chestP2,
            leftArmPivot,
            leftElbowRot,
            leftHandRot,
            rightArmPivot,
            rightElbowRot,
            rightHandRot,
            scale: scaleFactor
          } : null;

          // Interior centroid of the 0.192 Chibi Head for tangential skull sliding when close to the scalp
          const headCx = 0.0;
          const headCy = -0.0096;
          const headCz = -0.0163;
          const skullSlideRadiusSq = 0.204 * 0.204;

          for (let k = 0; k < numCoords; k += 3) {
            const flex = (bm.flexW && bm.flexW[k / 3] !== undefined)
              ? bm.flexW[k / 3]
              : 0.0;
            const lx = bm.localV[k];
            const ly = bm.localV[k + 1];
            const lz = bm.localV[k + 2];

            // 1. Root & skull-wrapping base: ZERO physics (flex <= 0.0001) - 100% anchored to the head in local space!
            if (flex <= 0.0001) {
              worldV[k]   = hx + lx * scale;
              worldV[k+1] = hy + ly * scale;
              worldV[k+2] = hz + lz * scale;
              continue;
            }

            // 2. Same lightweight O(1) spring principle as Forehead Bangs, extended with 2nd-stage supple whip for Long & Tied Hair!
            const flexW = flex * (0.48 + 0.52 * flex);
            const whipW = flex * flex * (0.35 + 0.65 * flex);

            // Effective hanging reach below/behind the crown tie so long locks & ponytails bend with real pendulum leverage
            const dropBelowTie = Math.max(0.0, 0.125 - ly);
            const reachBehindSkull = Math.max(0.0, -lz - 0.165);
            const reachSideTwin = Math.max(0.0, Math.abs(lx) - 0.165);
            const longReach = dropBelowTie * 0.85 + reachBehindSkull * 0.95 + reachSideTwin * 0.75;
            const hangFactor = 0.62 + 1.85 * longReach;

            const vGravX = gravDeltaX * 0.072 * hangFactor * flexW + spring.tx * whipW * (0.55 + longReach * 1.4);
            const vGravY = (gravDeltaY * 0.068 + gravSteadyWeightY * 0.60) * hangFactor * flexW + spring.ty * whipW * (0.55 + longReach * 1.4);
            const vGravZ = gravDeltaZ * 0.072 * hangFactor * flexW + spring.tz * whipW * (0.55 + longReach * 1.4);

            // Soft arch uncurling: when tilted/lying/upside-down, relax the high ponytail/twin-tail arch toward gravity
            // so tied hair uncurls and drapes naturally instead of moving as a stiff C-hook!
            const tiltAmount = Math.min(1.0, Math.hypot(gravDeltaX, gravDeltaY, gravDeltaZ) * 0.55);
            const archRelax = (reachBehindSkull > 0.01 || reachSideTwin > 0.01) ? (tiltAmount * whipW * 0.38) : 0.0;
            const relaxDx = archRelax * (gravLocalX * 0.16);
            const relaxDy = archRelax * (gravLocalY * 0.18 - Math.max(0.0, ly - 0.08) * 0.55);
            const relaxDz = archRelax * (gravLocalZ * 0.16);

            let dispX = lx + (baseDx - lz * yawLagTerm + lx * flareTerm) * flexW + vGravX + relaxDx;
            let dispY = ly + baseDy * flexW + vGravY + relaxDy;
            let dispZ = lz + (baseDz + lx * yawLagTerm + lz * flareTerm) * flexW + vGravZ + relaxDz;

            // 3. Soft Tangential Slide ONLY when a vertex actually approaches the real skull sphere (r < 0.204)
            // (Never lock long hair or ponytails in mid-air at their outer rest radius!)
            if (ly > -0.10) {
              const ndx = dispX - headCx;
              const ndy = dispY - headCy;
              const ndz = dispZ - headCz;
              const rNewSq = ndx * ndx + ndy * ndy + ndz * ndz;
              const targetR = Math.min(skullSlideRadiusSq, (lx - headCx) ** 2 + (ly - headCy) ** 2 + (lz - headCz) ** 2);
              if (rNewSq < targetR && rNewSq > 0.00001) {
                const pushOut = Math.sqrt(targetR / rNewSq);
                dispX = headCx + ndx * pushOut;
                dispY = headCy + ndy * pushOut;
                dispZ = headCz + ndz * pushOut;
              }
            }

            // 4. Exact 3D Sculpted Chibi Head, Convex Facial Shield & Neck Non-Penetration Clamp
            if (clampHeadFn) {
              const clamped = clampHeadFn(dispX, dispY, dispZ, 0.192, 0.0038);
              dispX = clamped[0];
              dispY = clamped[1];
              dispZ = clamped[2];
            }
            if (clampBodyFn && (hy + dispY * scale) < neckP2[1]) {
              const bClamped = clampBodyFn(
                hx + dispX * scale,
                hy + dispY * scale,
                hz + dispZ * scale,
                hairBodyCollider,
                0.005,
                true
              );
              dispX = (bClamped[0] - hx) / scale;
              dispY = (bClamped[1] - hy) / scale;
              dispZ = (bClamped[2] - hz) / scale;
            }

            worldV[k]   = hx + dispX * scale;
            worldV[k+1] = hy + dispY * scale;
            worldV[k+2] = hz + dispZ * scale;
          }

          return {
            vertices: worldV,
            colors: bm.colors,
            normals: worldNormals,
            indices: bm.indices
          };
        }

        const playerHairMesh = isClone ? null : createHairMesh(false);
        if (!isClone) window._lastPlayerHairMesh = playerHairMesh;
        const playerLocalHairMesh = isClone ? null : createHairMesh(true);

        let cloneHoodieMesh = null;
        let cloneLocalHoodieMesh = null;
        let cloneOpenHoodieMesh = null;
        let cloneLocalOpenHoodieMesh = null;
        let cloneBootsMesh = null;
        let playerHoodieMesh = null;
        let playerLocalHoodieMesh = null;
        let playerBootsMesh = null;
        let playerSkirtMesh = null;
        let playerShirtCollarMesh = null;

        const shiftMeshX = (srcMesh, dx) => {
          const srcV = srcMesh.vertices;
          const n = srcV.length;
          const dstV = new Float32Array(n);
          for (let k = 0; k < n; k += 3) {
            dstV[k]     = srcV[k] + dx;
            dstV[k + 1] = srcV[k + 1];
            dstV[k + 2] = srcV[k + 2];
          }
          return {
            vertices: dstV,
            normals: srcMesh.normals,
            colors: srcMesh.colors,
            texcoords: srcMesh.texcoords,
            indices: srcMesh.indices
          };
        };

        if (isClone) {
          window._cloneCurrentHeadP1 = [headP1[0], headP1[1], headP1[2]];
          window._cloneCurrentScale = scaleFactor;
          window._cloneCurrentPhase = phase;
          window._cloneCurrentWalkBlend = cloneWalkBlend;
          window._cloneAnimTick = (window._cloneAnimTick || 0) + 1;

          const isMoving = cloneWalkBlend > 0.05;
          const cloneHeading = (typeof window.playerClonesState !== "undefined" && window.playerClonesState[0])
            ? (window.playerClonesState[0].heading || 0.0)
            : 0.0;
          if (typeof updateChibiHoodiePhysics === "function") {
            updateChibiHoodiePhysics(isMoving, false, phase, cloneHeading, { isClone: true });
          }

          const cloneClothCtx = {
            isClone: true,
            leftLegPivot,
            leftKneeRot,
            leftFootRot,
            rightLegPivot,
            rightKneeRot,
            rightFootRot
          };
          cloneHoodieMesh = buildTravelerHoodieCloakMesh(
            headP1, headP2,
            chestP1, chestP2,
            neckP1, neckP2,
            leftArmPivot, leftElbowRot, leftHandRot,
            rightArmPivot, rightElbowRot, rightHandRot,
            scaleFactor,
            phase,
            false,
            leftFootRot, rightFootRot,
            false,
            cloneClothCtx
          );
          cloneLocalHoodieMesh = shiftMeshX(cloneHoodieMesh, 10.0);

          cloneOpenHoodieMesh = buildTravelerHoodieCloakMesh(
            headP1, headP2,
            chestP1, chestP2,
            neckP1, neckP2,
            leftArmPivot, leftElbowRot, leftHandRot,
            rightArmPivot, rightElbowRot, rightHandRot,
            scaleFactor,
            phase,
            false,
            leftFootRot, rightFootRot,
            true,
            cloneClothCtx
          );
          cloneLocalOpenHoodieMesh = shiftMeshX(cloneOpenHoodieMesh, 10.0);

          if (typeof buildTravelerBootsMesh === "function") {
            cloneBootsMesh = buildTravelerBootsMesh(leftFootRot, rightFootRot, scaleFactor, cloneClothCtx);
          }
        } else {
          const playerEq = (typeof window.getCharacterEquippedClothingState === "function")
            ? window.getCharacterEquippedClothingState(false)
            : null;
          const needClothPhys = !!(playerEq && (playerEq.wearHoodie || playerEq.wearSkirt));
          if (needClothPhys) {
            const isRag = !!(ragdollEnabled && ragdollInitialized && R_rot && N_rot && F_rot);
            const pMoving = !isRag && !!(
              (typeof isWalking !== "undefined" && isWalking) ||
              (typeof currentWalkBlend !== "undefined" && currentWalkBlend > 0.05)
            );
            const pSprint = !isRag && !!(typeof isSprinting !== "undefined" && isSprinting && pMoving);
            const pHeading = (typeof charHeading === "number") ? charHeading : 0.0;

            let physR = [1, 0, 0], physN = [0, 1, 0], physF = [0, 0, 1], physWorldPos = [0, 1, 0];
            if (isRag && typeof ragdollPos !== "undefined" && ragdollPos) {
              physR = R_rot; physN = N_rot; physF = F_rot;
              physWorldPos = ragdollPos;
            } else if (typeof getCharacterMatrix === "function") {
              const cMat = getCharacterMatrix();
              if (cMat && cMat.length >= 16) {
                const rL = Math.hypot(cMat[0], cMat[1], cMat[2]) || 1.0;
                const nL = Math.hypot(cMat[4], cMat[5], cMat[6]) || 1.0;
                const fL = Math.hypot(cMat[8], cMat[9], cMat[10]) || 1.0;
                physR = [cMat[0] / rL, cMat[1] / rL, cMat[2] / rL];
                physN = [cMat[4] / nL, cMat[5] / nL, cMat[6] / nL];
                physF = [cMat[8] / fL, cMat[9] / fL, cMat[10] / fL];
                physWorldPos = [cMat[12], cMat[13], cMat[14]];
              }
            }
            const vertVel = (typeof window.playerVerticalVel === "number")
              ? window.playerVerticalVel
              : ((typeof playerVerticalVel !== "undefined") ? playerVerticalVel : 0.0);
            const isGrounded = isRag
              ? !!(typeof chibiRagdollState !== "undefined" && chibiRagdollState && chibiRagdollState.isGrounded)
              : ((typeof window.isPlayerGrounded === "boolean") ? window.isPlayerGrounded : ((typeof isPlayerGrounded !== "undefined") ? isPlayerGrounded : true));

            if (typeof updateChibiHoodiePhysics === "function") {
              updateChibiHoodiePhysics(pMoving, pSprint, phase, pHeading, {
                R: physR,
                N: physN,
                F: physF,
                worldPos: physWorldPos,
                torsoTilt: (!isRag && typeof torsoTilt === "number" && !isNaN(torsoTilt)) ? torsoTilt : 0.0,
                isRagdoll: isRag,
                vertVel: vertVel,
                isGrounded: isGrounded,
                ragdollVel: (isRag && typeof ragdollVel !== "undefined") ? ragdollVel : null
              });
            }
          }

          const legClothCtx = {
            leftLegPivot,
            leftKneeRot,
            leftFootRot,
            rightLegPivot,
            rightKneeRot,
            rightFootRot
          };

          if (playerEq && playerEq.wearHoodie && typeof buildTravelerHoodieCloakMesh === "function") {
            const hoodOpenMode = (typeof window.playerHoodClosed !== "undefined") ? !window.playerHoodClosed : true;
            playerHoodieMesh = buildTravelerHoodieCloakMesh(
              headP1, headP2,
              chestP1, chestP2,
              neckP1, neckP2,
              leftArmPivot, leftElbowRot, leftHandRot,
              rightArmPivot, rightElbowRot, rightHandRot,
              scaleFactor,
              phase,
              false,
              leftFootRot, rightFootRot,
              hoodOpenMode,
              legClothCtx
            );
            playerLocalHoodieMesh = shiftMeshX(playerHoodieMesh, 10.0);
          }

          if (playerEq && playerEq.wearSkirt && typeof buildBlackPleatedSkirtMesh === "function") {
            playerSkirtMesh = buildBlackPleatedSkirtMesh(
              headP1,
              chestP1, chestP2,
              scaleFactor,
              phase,
              legClothCtx
            );
          }

          if (playerEq && playerEq.wearShirt && typeof buildWhiteShirtCollarMesh === "function") {
            playerShirtCollarMesh = buildWhiteShirtCollarMesh(
              headP1,
              chestP1, chestP2,
              neckP1, neckP2,
              scaleFactor
            );
          }

          if (playerEq && playerEq.wearBoots && typeof buildTravelerBootsMesh === "function") {
            playerBootsMesh = buildTravelerBootsMesh(leftFootRot, rightFootRot, scaleFactor, legClothCtx);
          }
        }

        // Pre-weld clone base body parts once so closed-hood and open-hood variants don't weld skin twice
        const cloneBaseWelded = isClone ? mergeMeshes([
          chest,
          head,
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
          ...(cloneBootsMesh ? [cloneBootsMesh] : [...leftFootParts, ...rightFootParts]),
        ]) : null;

        let meshesToMerge = isClone ? [
          cloneBaseWelded,
          cloneHoodieMesh,
        ] : [
          chest,
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
          ...(playerBootsMesh ? [] : [...leftFootParts, ...rightFootParts]),
          ...(playerShirtCollarMesh ? [playerShirtCollarMesh] : []),
          ...(playerSkirtMesh ? [playerSkirtMesh] : []),
          ...(playerHoodieMesh ? [playerHoodieMesh] : []),
          ...(playerBootsMesh ? [playerBootsMesh] : []),
        ];

        let localMeshesToMerge = isClone ? [
          cloneBaseWelded,
          cloneLocalHoodieMesh,
        ] : [
          chest,
          head,
          playerLocalHairMesh,
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
          ...(playerBootsMesh ? [] : [...leftFootParts, ...rightFootParts]),
          ...(playerShirtCollarMesh ? [playerShirtCollarMesh] : []),
          ...(playerSkirtMesh ? [playerSkirtMesh] : []),
          ...(playerLocalHoodieMesh ? [playerLocalHoodieMesh] : []),
          ...(playerBootsMesh ? [playerBootsMesh] : []),
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

            const isRag = false;
            const itemScale = 1.0;

            const addWedge = (pBase, pTip, widthBase, widthTip, thickness, color) => {
                const dir = sub(pTip, pBase);
                const f = normalize(dir); // points from base to tip
                const charX = [1, 0, 0];
                
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

            if (heldItem && (heldItem.name === "WOODEN_ARM_CANNON" || heldItem.name === "ARM_CANNON")) {
                const pElbow = isRag ? rightElbowRot : transformPt(rightElbowRot);
                const pHand = isRag ? rightHandRot : transformPt(rightHandRot);
                buildWoodenArmCannonMesh(pElbow, pHand, rawV, rawC, rawI, itemScale);
            } else if (heldItem && heldItem.name === "BOW") {
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
          } else if (heldItem.name === "GLOW_BATTERY" || heldItem.name === "GLOW_BATTERY_EMPTY") {
                const wHandleP1 = transformPt(axeHandleP1Rot);
                const wHandleP2 = transformPt(axeHandleP2Rot);
                
                let fillPercent = 0;
                if (heldItem.name === "GLOW_BATTERY") {
                   if (window.BatterySystem) {
                      const stats = window.BatterySystem.getStats();
                      fillPercent = (stats.activeBattery && stats.activeBattery.charge) ? (stats.activeBattery.charge / window.BatterySystem.MAX_CHARGE) * 100 : 100;
                   } else {
                      fillPercent = 100;
                   }
                } else {
                   if (heldItem.rechargeTime !== undefined && window.BatterySystem) {
                      fillPercent = (heldItem.rechargeTime / window.BatterySystem.REGEN_TIME) * 100;
                   } else {
                      fillPercent = 0;
                   }
                }

                const isLow = fillPercent <= 20;
                const batteryColor = isLow ? [0.88, 0.1, 0.1] : [0.22, 0.95, 0.88];
                const emptyColor = [0.3, 0.3, 0.3];
                
                // Pure rectangular glowing rock rod
                const startT = 0.05;
                const endT = 0.95;
                const fillT = startT + (endT - startT) * (fillPercent / 100);

                const rodP1 = [
                    wHandleP1[0] + (wHandleP2[0] - wHandleP1[0]) * startT,
                    wHandleP1[1] + (wHandleP2[1] - wHandleP1[1]) * startT,
                    wHandleP1[2] + (wHandleP2[2] - wHandleP1[2]) * startT
                ];
                const rodFillEnd = [
                    wHandleP1[0] + (wHandleP2[0] - wHandleP1[0]) * fillT,
                    wHandleP1[1] + (wHandleP2[1] - wHandleP1[1]) * fillT,
                    wHandleP1[2] + (wHandleP2[2] - wHandleP1[2]) * fillT
                ];
                const rodP2 = [
                    wHandleP1[0] + (wHandleP2[0] - wHandleP1[0]) * endT,
                    wHandleP1[1] + (wHandleP2[1] - wHandleP1[1]) * endT,
                    wHandleP1[2] + (wHandleP2[2] - wHandleP1[2]) * endT
                ];
                
                if (fillPercent > 0) {
                   buildTaperedSegment(rodP1, rodFillEnd, 0.036 * itemScale, 0.036 * itemScale, 4, batteryColor, rawV, rawC, rawI, true);
                }
                if (fillPercent < 100) {
                   buildTaperedSegment(rodFillEnd, rodP2, 0.036 * itemScale, 0.036 * itemScale, 4, emptyColor, rawV, rawC, rawI, true);
                }
          } else if (heldItem.name === "BRANCH" || heldItem.name === "branch") {
                const wHandleP1 = transformPt(axeHandleP1Rot);
                const wHandleP2 = transformPt(axeHandleP2Rot);
                const branchColor = [0.45, 0.3, 0.15];
                // Match inventory preview: buildTaperedSegment([-0.35, -0.1, 0], [0.35, 0.1, 0], 0.04, 0.02, 5, [0.45, 0.3, 0.15])
                // Natural tapered wooden branch (5-sided cylindrical cross-section, tapered base to tip, capped ends)
                buildTaperedSegment(
                    wHandleP1,
                    wHandleP2,
                    0.024 * itemScale,
                    0.012 * itemScale,
                    5,
                    branchColor,
                    rawV,
                    rawC,
                    rawI,
                    true
                );
          } else if (heldItem.name === "AXE" || heldItem.name === "PICKAXE" || heldItem.name === "SHOVEL") {
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
                }
            } else if ((heldItem.name === "OBSIDIAN_FLUX" || heldItem.name === "OBSIDIAN_FLUX") && typeof window.buildObsidianFluxModel === "function") {
                const wHandleP1 = transformPt(axeHandleP1Rot);
                const wHandleP2 = transformPt(axeHandleP2Rot);
                const handPos = [
                    (wHandleP1[0] + wHandleP2[0]) * 0.5,
                    (wHandleP1[1] + wHandleP2[1]) * 0.5,
                    (wHandleP1[2] + wHandleP2[2]) * 0.5
                ];
                window.buildObsidianFluxModel(
                    1234,
                    0,
                    false,
                    false,
                    0.18 * itemScale,
                    handPos,
                    [1, 0, 0],
                    [0, 1, 0],
                    [0, 0, 1],
                    rawV,
                    rawC,
                    rawI
                );
            } else if ((heldItem.name === "DRAGON_FRUIT" || heldItem.name === "dragon_fruit") && typeof window.buildDragonFruitModel === "function") {
                const wHandleP1 = transformPt(axeHandleP1Rot);
                const wHandleP2 = transformPt(axeHandleP2Rot);
                const handPos = [
                    (wHandleP1[0] + wHandleP2[0]) * 0.5,
                    (wHandleP1[1] + wHandleP2[1]) * 0.5,
                    (wHandleP1[2] + wHandleP2[2]) * 0.5
                ];
                window.buildDragonFruitModel(
                    1234,
                    0.26 * itemScale,
                    handPos,
                    [1, 0, 0],
                    [0, 1, 0],
                    [0, 0, 1],
                    rawV,
                    rawC,
                    rawI
                );
            } else if ((heldItem.name === "IRON_BUCKET" || heldItem.name === "iron_bucket" || heldItem.name === "WATER_BUCKET" || heldItem.name === "water_bucket" || (typeof window.bucketWaterTimer === "number" && window.bucketWaterTimer > 0)) && typeof window.buildIronBucketModel === "function") {
                const wHandleP1 = transformPt(axeHandleP1Rot);
                const wHandleP2 = transformPt(axeHandleP2Rot);
                const handPos = [
                    (wHandleP1[0] + wHandleP2[0]) * 0.5,
                    (wHandleP1[1] + wHandleP2[1]) * 0.5,
                    (wHandleP1[2] + wHandleP2[2]) * 0.5
                ];
                buildHeldIronBucketMesh(handPos, itemScale, heldItem, rawV, rawC, rawI);
            } else if ((heldItem.name === "COTTON_PLANT" || heldItem.name === "cotton_plant" || heldItem.name === "COTTON" || heldItem.name === "cotton") && typeof window.buildCottonPlant === "function") {
                const wHandleP1 = transformPt(axeHandleP1Rot);
                const wHandleP2 = transformPt(axeHandleP2Rot);
                const handPos = [
                    (wHandleP1[0] + wHandleP2[0]) * 0.5,
                    (wHandleP1[1] + wHandleP2[1]) * 0.5,
                    (wHandleP1[2] + wHandleP2[2]) * 0.5
                ];
                window.buildCottonPlant(
                    handPos[0], handPos[1], handPos[2],
                    0, 1, 0,
                    [1, 0, 0], [0, 0, 1], [0, 1, 0],
                    1234,
                    rawV, rawC, rawI,
                    false
                );
            }
            
            if (!isClone) {
                const flatEquip = makeFlatShadedGeometry(rawV, rawC, rawI);
                equipIndicesLength = flatEquip.indices.length;

                if (!equipVertexBuffer) equipVertexBuffer = gl.createBuffer();
                uploadDynamicBuffer(gl, equipVertexBuffer, gl.ARRAY_BUFFER, flatEquip.vertices instanceof Float32Array ? flatEquip.vertices : new Float32Array(flatEquip.vertices));

                if (!equipColorBuffer) equipColorBuffer = gl.createBuffer();
                uploadDynamicBuffer(gl, equipColorBuffer, gl.ARRAY_BUFFER, flatEquip.colors instanceof Float32Array ? flatEquip.colors : new Float32Array(flatEquip.colors));

                if (!equipNormalBuffer) equipNormalBuffer = gl.createBuffer();
                uploadDynamicBuffer(gl, equipNormalBuffer, gl.ARRAY_BUFFER, flatEquip.normals instanceof Float32Array ? flatEquip.normals : new Float32Array(flatEquip.normals));

                if (!equipIndexBuffer) equipIndexBuffer = gl.createBuffer();
                if (equipIndexBuffer._uploadedCount !== equipIndicesLength) {
                  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, equipIndexBuffer);
                  const idxData = (equipIndicesLength > 65535)
                    ? (flatEquip.indices instanceof Uint32Array ? flatEquip.indices : new Uint32Array(flatEquip.indices))
                    : (flatEquip.indices instanceof Uint16Array ? flatEquip.indices : new Uint16Array(flatEquip.indices));
                  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.DYNAMIC_DRAW);
                  equipIndexBuffer._uploadedCount = equipIndicesLength;
                }
            }
        } else {
            if (!isClone) {
                equipIndicesLength = 0;
            }
        }

        const merged = mergeMeshes(meshesToMerge);
        const localMerged = mergeMeshes(localMeshesToMerge, true);
        if (isClone) {
          const uploadCloneBufSet = (targetObj, mData, lmData) => {
            targetObj.indicesLength = mData.indices.length;

            const vertData = mData.vertices instanceof Float32Array ? mData.vertices : new Float32Array(mData.vertices);
            const localVertData = lmData.vertices instanceof Float32Array ? lmData.vertices : new Float32Array(lmData.vertices);
            const normData = mData.normals instanceof Float32Array ? mData.normals : new Float32Array(mData.normals);
            const colData = mData.colors instanceof Float32Array ? mData.colors : new Float32Array(mData.colors);

            if (!targetObj.vertexBuffer) targetObj.vertexBuffer = gl.createBuffer();
            uploadDynamicBuffer(gl, targetObj.vertexBuffer, gl.ARRAY_BUFFER, vertData);

            if (!targetObj.localVertexBuffer) targetObj.localVertexBuffer = gl.createBuffer();
            uploadDynamicBuffer(gl, targetObj.localVertexBuffer, gl.ARRAY_BUFFER, localVertData);

            if (!targetObj.normalBuffer) targetObj.normalBuffer = gl.createBuffer();
            uploadDynamicBuffer(gl, targetObj.normalBuffer, gl.ARRAY_BUFFER, normData);

            if (!targetObj.colorBuffer) targetObj.colorBuffer = gl.createBuffer();
            uploadDynamicBuffer(gl, targetObj.colorBuffer, gl.ARRAY_BUFFER, colData);

            if (mData.texcoords) {
              if (!targetObj.texCoordBuffer) {
                targetObj.texCoordBuffer = gl.createBuffer();
              }
              uploadDynamicBuffer(gl, targetObj.texCoordBuffer, gl.ARRAY_BUFFER, mData.texcoords instanceof Float32Array ? mData.texcoords : new Float32Array(mData.texcoords));
            }

            if (!targetObj.indexBuffer) targetObj.indexBuffer = gl.createBuffer();
            if (targetObj.indexBuffer._uploadedCount !== targetObj.indicesLength) {
              gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, targetObj.indexBuffer);
              const idxData = (targetObj.indicesLength > 65535)
                ? (mData.indices instanceof Uint32Array ? mData.indices : new Uint32Array(mData.indices))
                : (mData.indices instanceof Uint16Array ? mData.indices : new Uint16Array(mData.indices));
              gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.DYNAMIC_DRAW);
              targetObj.indexBuffer._uploadedCount = targetObj.indicesLength;
            }
          };

          if (!window.cloneMeshBuffers) window.cloneMeshBuffers = {};
          uploadCloneBufSet(window.cloneMeshBuffers, merged, localMerged);

          if (cloneOpenHoodieMesh && cloneLocalOpenHoodieMesh) {
            const openMerged = mergeMeshes([cloneBaseWelded, cloneOpenHoodieMesh]);
            const openLocalMerged = mergeMeshes([cloneBaseWelded, cloneLocalOpenHoodieMesh], true);
            if (!window.cloneOpenHoodieMeshBuffers) window.cloneOpenHoodieMeshBuffers = {};
            uploadCloneBufSet(window.cloneOpenHoodieMeshBuffers, openMerged, openLocalMerged);
          }

          if (!window.getCloneHairBuffers) {
            window._cloneHairBufferCache = new Map();
            window.getCloneHairBuffers = function(glCtx, styleIdx, colorIdx, isHoodOpen) {
              if (!glCtx || typeof window.build3DAnimeHair !== "function") return null;
              const numStyles = window.NUM_HAIR_STYLES || 9;
              const colors = window.ANIME_HAIR_COLORS || [[0.85, 0.90, 0.96]];
              const sIdx = (((styleIdx | 0) % numStyles) + numStyles) % numStyles;
              const cIdx = (((colorIdx | 0) % colors.length) + colors.length) % colors.length;
              const openFlag = isHoodOpen ? 1 : 0;
              const key = `v12_chibi_hair_freefall_${sIdx}_${cIdx}_${openFlag}`;

              let entry = window._cloneHairBufferCache.get(key);
              if (!entry) {
                const rawV = [], rawC = [], rawI = [], rawF = [];
                const headFit = 0.192 / 0.240;
                window.build3DAnimeHair(
                  sIdx,
                  colors[cIdx],
                  1.0,
                  (lx, ly, lz) => [lx * headFit, ly * headFit, lz * headFit],
                  0,
                  rawV,
                  rawC,
                  rawI,
                  rawF
                );

                let finalV = rawV;
                let finalC = rawC;
                let finalI = rawI;
                let finalF = rawF;

                // When hood is closed ("แบบปิด"), keep front bangs/side-locks inside the hood aperture
                // and cull/tuck rear/top/wide vertices so zero hair pokes through the closed white hood!
                if (!isHoodOpen && rawV.length > 0) {
                  const numVerts = (rawV.length / 3) | 0;
                  const vKeep = new Uint8Array(numVerts);
                  const clampedV = new Float32Array(rawV.length);
                  const clampedF = new Float32Array(numVerts);

                  for (let v = 0; v < numVerts; v++) {
                    let lx = rawV[v * 3];
                    let ly = rawV[v * 3 + 1];
                    let lz = rawV[v * 3 + 2];
                    const dy = ly - 0.025; // Relative to hood center hy
                    const ellR = (lx * lx) / (0.235 * 0.235) + (dy * dy) / (0.265 * 0.265);

                    if (lz >= 0.025 && ly <= 0.258 && ly >= -0.125 && ellR <= 1.12) {
                      vKeep[v] = 1;
                      if (ellR > 0.92) {
                        const shrink = 0.92 / Math.sqrt(ellR);
                        lx *= shrink;
                        ly = 0.025 + dy * shrink;
                      }
                      lz = Math.min(0.258, lz);
                    }
                    clampedV[v * 3] = lx;
                    clampedV[v * 3 + 1] = ly;
                    clampedV[v * 3 + 2] = lz;
                    clampedF[v] = (rawF[v] || 0.0) * 0.22;
                  }

                  const remap = new Int32Array(numVerts);
                  remap.fill(-1);
                  const fV = [], fC = [], fI = [], fF = [];

                  for (let k = 0; k < rawI.length; k += 3) {
                    const i0 = rawI[k], i1 = rawI[k + 1], i2 = rawI[k + 2];
                    if (vKeep[i0] && vKeep[i1] && vKeep[i2]) {
                      const tris = [i0, i1, i2];
                      for (let ti = 0; ti < 3; ti++) {
                        const oldIdx = tris[ti];
                        let newIdx = remap[oldIdx];
                        if (newIdx === -1) {
                          newIdx = (fV.length / 3) | 0;
                          remap[oldIdx] = newIdx;
                          fV.push(clampedV[oldIdx * 3], clampedV[oldIdx * 3 + 1], clampedV[oldIdx * 3 + 2]);
                          fC.push(rawC[oldIdx * 3], rawC[oldIdx * 3 + 1], rawC[oldIdx * 3 + 2]);
                          fF.push(clampedF[oldIdx]);
                        }
                        fI.push(newIdx);
                      }
                    }
                  }
                  finalV = fV;
                  finalC = fC;
                  finalI = fI;
                  finalF = fF;
                }

                const normals = new Float32Array(finalV.length);
                for (let k = 0; k < finalI.length; k += 3) {
                  const i0 = finalI[k], i1 = finalI[k + 1], i2 = finalI[k + 2];
                  if (i0 * 3 + 2 >= finalV.length || i1 * 3 + 2 >= finalV.length || i2 * 3 + 2 >= finalV.length) continue;
                  const p0x = finalV[i0 * 3], p0y = finalV[i0 * 3 + 1], p0z = finalV[i0 * 3 + 2];
                  const ux = finalV[i1 * 3] - p0x, uy = finalV[i1 * 3 + 1] - p0y, uz = finalV[i1 * 3 + 2] - p0z;
                  const wx = finalV[i2 * 3] - p0x, wy = finalV[i2 * 3 + 1] - p0y, wz = finalV[i2 * 3 + 2] - p0z;
                  const nx = uy * wz - uz * wy;
                  const ny = uz * wx - ux * wz;
                  const nz = ux * wy - uy * wx;
                  normals[i0 * 3] += nx; normals[i0 * 3 + 1] += ny; normals[i0 * 3 + 2] += nz;
                  normals[i1 * 3] += nx; normals[i1 * 3 + 1] += ny; normals[i1 * 3 + 2] += nz;
                  normals[i2 * 3] += nx; normals[i2 * 3 + 1] += ny; normals[i2 * 3 + 2] += nz;
                }
                for (let k = 0; k < normals.length; k += 3) {
                  const l = Math.hypot(normals[k], normals[k + 1], normals[k + 2]);
                  if (l > 0.0001) {
                    normals[k] /= l; normals[k + 1] /= l; normals[k + 2] /= l;
                  } else {
                    normals[k + 1] = 1.0;
                  }
                }

                const localDummyV = new Float32Array(finalV.length);
                for (let k = 0; k < finalV.length; k += 3) {
                  localDummyV[k] = finalV[k];
                  localDummyV[k + 1] = finalV[k + 1] - 1000.0;
                  localDummyV[k + 2] = finalV[k + 2];
                }

                const vertexBuffer = glCtx.createBuffer();
                const localVertexBuffer = glCtx.createBuffer();
                const normalBuffer = glCtx.createBuffer();
                const colorBuffer = glCtx.createBuffer();
                const indexBuffer = glCtx.createBuffer();

                glCtx.bindBuffer(glCtx.ARRAY_BUFFER, localVertexBuffer);
                glCtx.bufferData(glCtx.ARRAY_BUFFER, localDummyV, glCtx.STATIC_DRAW);

                glCtx.bindBuffer(glCtx.ARRAY_BUFFER, normalBuffer);
                glCtx.bufferData(glCtx.ARRAY_BUFFER, normals, glCtx.STATIC_DRAW);

                glCtx.bindBuffer(glCtx.ARRAY_BUFFER, colorBuffer);
                glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array(finalC), glCtx.STATIC_DRAW);

                const indicesLength = finalI.length;
                glCtx.bindBuffer(glCtx.ELEMENT_ARRAY_BUFFER, indexBuffer);
                const idxData = (indicesLength > 65535) ? new Uint32Array(finalI) : new Uint16Array(finalI);
                glCtx.bufferData(glCtx.ELEMENT_ARRAY_BUFFER, idxData, glCtx.STATIC_DRAW);

                entry = {
                  localV: new Float32Array(finalV),
                  flexW: new Float32Array(finalF),
                  worldV: new Float32Array(finalV.length),
                  vertexBuffer,
                  localVertexBuffer,
                  normalBuffer,
                  colorBuffer,
                  indexBuffer,
                  indicesLength,
                  lastAnimTick: -1
                };
                window._cloneHairBufferCache.set(key, entry);
              }

              if (entry.indicesLength > 0 && entry.lastAnimTick !== window._cloneAnimTick) {
                entry.lastAnimTick = window._cloneAnimTick;
                const hp = window._cloneCurrentHeadP1 || [0, 0.23, 0];
                const hx = hp[0], hy = hp[1], hz = hp[2];
                const sc = window._cloneCurrentScale || 1.0;
                const ph = window._cloneCurrentPhase || 0.0;
                const walkBlend = window._cloneCurrentWalkBlend || 0.0;
                const walkX = Math.sin(ph) * 0.006 * walkBlend;
                const walkZ = Math.cos(ph * 2.0) * 0.005 * walkBlend;
                const walkY = -Math.abs(Math.sin(ph)) * 0.0035 * walkBlend;

                const lv = entry.localV;
                const fw = entry.flexW;
                const wv = entry.worldV;
                for (let k = 0, v = 0; k < lv.length; k += 3, v++) {
                  const lx = lv[k], ly = lv[k + 1], lz = lv[k + 2];
                  const f = fw[v] || 0.0;
                  if (f <= 0.0001) {
                    wv[k]     = hx + lx * sc;
                    wv[k + 1] = hy + ly * sc;
                    wv[k + 2] = hz + lz * sc;
                    continue;
                  }
                  const flexW = f * f;
                  const wave = Math.sin(ph * 1.2 + ly * 8.0 + (lx - lz) * 4.0) * 0.002 * flexW;
                  wv[k]     = hx + (lx + walkX * flexW + wave) * sc;
                  wv[k + 1] = hy + (ly + walkY * flexW) * sc;
                  wv[k + 2] = hz + (lz + walkZ * flexW + wave) * sc;
                }
                uploadDynamicBuffer(glCtx, entry.vertexBuffer, glCtx.ARRAY_BUFFER, wv);
              }

              return entry;
            };
          }
          return;
        }

        charIndicesLength = merged.indices.length;
        charRawVertices = merged.vertices;

        const vertData = merged.vertices instanceof Float32Array ? merged.vertices : new Float32Array(merged.vertices);
        const localVertData = localMerged.vertices instanceof Float32Array ? localMerged.vertices : new Float32Array(localMerged.vertices);
        const normData = merged.normals instanceof Float32Array ? merged.normals : new Float32Array(merged.normals);
        const colData = merged.colors instanceof Float32Array ? merged.colors : new Float32Array(merged.colors);

        if (!charVertexBuffer) charVertexBuffer = gl.createBuffer();
        uploadDynamicBuffer(gl, charVertexBuffer, gl.ARRAY_BUFFER, vertData);

        if (!charLocalVertexBuffer) charLocalVertexBuffer = gl.createBuffer();
        uploadDynamicBuffer(gl, charLocalVertexBuffer, gl.ARRAY_BUFFER, localVertData);

        if (!charNormalBuffer) charNormalBuffer = gl.createBuffer();
        uploadDynamicBuffer(gl, charNormalBuffer, gl.ARRAY_BUFFER, normData);

        if (!charColorBuffer) charColorBuffer = gl.createBuffer();
        uploadDynamicBuffer(gl, charColorBuffer, gl.ARRAY_BUFFER, colData);
        charColorBuffer._sourceType = "classic";

        if (merged.texcoords) {
          if (typeof window.charTexCoordBuffer === "undefined" || !window.charTexCoordBuffer) {
            window.charTexCoordBuffer = gl.createBuffer();
          }
          uploadDynamicBuffer(gl, window.charTexCoordBuffer, gl.ARRAY_BUFFER, merged.texcoords instanceof Float32Array ? merged.texcoords : new Float32Array(merged.texcoords));
          window.charTexCoordBuffer._sourceType = "classic";
        }

        if (!charIndexBuffer) charIndexBuffer = gl.createBuffer();
        if (charIndexBuffer._uploadedCount !== charIndicesLength || charIndexBuffer._sourceType !== "classic") {
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, charIndexBuffer);
          const idxData = (charIndicesLength > 65535)
            ? (merged.indices instanceof Uint32Array ? merged.indices : new Uint32Array(merged.indices))
            : (merged.indices instanceof Uint16Array ? merged.indices : new Uint16Array(merged.indices));
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.DYNAMIC_DRAW);
          charIndexBuffer._uploadedCount = charIndicesLength;
          charIndexBuffer._sourceType = "classic";
        }
      }

      function getCharacterMatrix() {
        if (ragdollEnabled && ragdollInitialized) {
          const m = (typeof ragdollQuat !== "undefined" && ragdollQuat && ragdollQuat.length === 4)
            ? quatToMatrix3(ragdollQuat)
            : null;
          let R_rot, N_rot, F_rot;
          if (m) {
            R_rot = m.R;
            N_rot = m.N;
            F_rot = m.F;
          } else {
            const rx = (typeof ragdollAxis !== "undefined" && ragdollAxis && !isNaN(ragdollAxis[0])) ? ragdollAxis[0] : 1;
            const ry = (typeof ragdollAxis !== "undefined" && ragdollAxis && !isNaN(ragdollAxis[1])) ? ragdollAxis[1] : 0;
            const rz = (typeof ragdollAxis !== "undefined" && ragdollAxis && !isNaN(ragdollAxis[2])) ? ragdollAxis[2] : 0;
            const angle = (typeof ragdollAngle === "number" && !isNaN(ragdollAngle)) ? ragdollAngle : 0;
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

            const b = (typeof ragdollBaseMatrix !== "undefined" && ragdollBaseMatrix && ragdollBaseMatrix.length >= 16 && !isNaN(ragdollBaseMatrix[0]))
              ? ragdollBaseMatrix
              : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

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
          }

          const rp = (typeof ragdollPos !== "undefined" && ragdollPos && !isNaN(ragdollPos[0])) ? ragdollPos : [0, 0, 0];
          const scale = (typeof playerScale === "number") ? playerScale : 1.0;
          return [
            R_rot[0] * scale, R_rot[1] * scale, R_rot[2] * scale, 0,
            N_rot[0] * scale, N_rot[1] * scale, N_rot[2] * scale, 0,
            F_rot[0] * scale, F_rot[1] * scale, F_rot[2] * scale, 0,
            rp[0], rp[1], rp[2], 1
          ];
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
          if (typeof ragdollQuat !== "undefined" && ragdollQuat && ragdollQuat.length === 4) {
            const m = quatToMatrix3(ragdollQuat);
            finalR = [m.R[0], m.R[1], m.R[2]];
            finalN = [m.N[0], m.N[1], m.N[2]];
            finalF = [m.F[0], m.F[1], m.F[2]];
          } else {
            finalN = [-F[0], -F[1], -F[2]];
            finalF = [N[0], N[1], N[2]];
          }
        } else if (activeRidingBoat && activeRidingBoat.normal && activeRidingBoat.F && activeRidingBoat.R) {
          finalN = [activeRidingBoat.normal[0], activeRidingBoat.normal[1], activeRidingBoat.normal[2]];
          finalF = [activeRidingBoat.F[0], activeRidingBoat.F[1], activeRidingBoat.F[2]];
          finalR = [activeRidingBoat.R[0], activeRidingBoat.R[1], activeRidingBoat.R[2]];

          // Bank the player model with the boat hull in flight
          if (activeRidingBoat.bankAngle && Math.abs(activeRidingBoat.bankAngle) > 0.0001) {
            const cosB = Math.cos(activeRidingBoat.bankAngle);
            const sinB = Math.sin(activeRidingBoat.bankAngle);
            const bR = [
              finalR[0] * cosB - finalN[0] * sinB,
              finalR[1] * cosB - finalN[1] * sinB,
              finalR[2] * cosB - finalN[2] * sinB
            ];
            const bN = [
              finalN[0] * cosB + finalR[0] * sinB,
              finalN[1] * cosB + finalR[1] * sinB,
              finalN[2] * cosB + finalR[2] * sinB
            ];
            finalR = bR;
            finalN = bN;
          }

          if (activeRidingBoat.position) {
            px = activeRidingBoat.position[0] + finalN[0] * 0.46 * charScale;
            py = activeRidingBoat.position[1] + finalN[1] * 0.46 * charScale;
            pz = activeRidingBoat.position[2] + finalN[2] * 0.46 * charScale;
          }
        } else if (swimFactor > 0.0) {
          const isChibi = typeof window !== "undefined" && window.characterModel === "chibi";
          // Sinks neck-deep when stationary, tilts forward smoothly when swimming (for classic procedural model)
          // For GLB models (Chibi), Swim_Forward and Swim_Idle already have the body pitch baked into the skeletal animation,
          // so we don't add the procedural ~75-degree body tilt.
          let tiltAngle = isChibi ? 0.0 : (
            swimFactor *
            (Math.PI * 0.03 + swimMovementFactor * (Math.PI * 0.39))
          );

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
      // Central shared swimming transform computation (Used by Player and PlayerClones)
      window.computeSwimmingTransform = function(opts) {
        const {
          swimFactor = 0.0,
          swimMovementFactor = 0.0,
          diveDepth = 0.0,
          waterRadius = 20.0,
          terrainRadius = 20.0,
          charScale = 0.1,
          isWalking = false,
          waterTime = 0,
          N = [0, 1, 0],
          F = [0, 0, 1],
          R = [1, 0, 0],
          baseGroundRadius = 20.0
        } = opts;

        let groundRadius = baseGroundRadius;
        let finalN = [N[0], N[1], N[2]];
        let finalF = [F[0], F[1], F[2]];
        let finalR = [R[0], R[1], R[2]];

        if (swimFactor > 0.0) {
          const targetSwimRadius = waterRadius + (-0.22 + swimMovementFactor * 0.27) * charScale;
          const subSwimRadius = targetSwimRadius - diveDepth;
          groundRadius = groundRadius * (1.0 - swimFactor) + subSwimRadius * swimFactor;

          // Gentle water bobbing
          const bobSpeed = isWalking ? 4.0 : 2.0;
          const bobAmp = isWalking ? 0.02 : 0.04;
          const bobFactor = Math.max(0, 1.0 - diveDepth / (0.1 * charScale));
          const bobbing = Math.sin(waterTime * bobSpeed) * bobAmp * charScale * bobFactor;
          groundRadius += bobbing;

          // Forward swimming horizontal tilt
          const tiltAngle = swimFactor * (Math.PI * 0.03 + swimMovementFactor * (Math.PI * 0.39));
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

        return { groundRadius, finalN, finalF, finalR };
      };

      if (typeof window !== "undefined") {
        window.getCharacterMatrix = getCharacterMatrix;
        window.updateCharacterMesh = updateCharacterMesh;
        window.computeSwimmingTransform = computeSwimmingTransform;
      }

      let reusableWaterFloat32Array = null;

      // Hair style cycle handler
      window.cyclePlayerHair = function() {
        const numStyles = window.NUM_HAIR_STYLES || 9;
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
      window.keysPressed = keysPressed;
      window.clearKeysPressed = () => { for (let k in keysPressed) keysPressed[k] = false; };
      window.addEventListener("keydown", (e) => {
        if (window.isWaitingForKey) return;
        initAudio();
        if (e.code === "KeyH") {
          window.cyclePlayerHair();
        }
        if (e.code === currentKeyBindings.demolish || e.code === "CapsLock") {
          isDemolishModeEnabled = !isDemolishModeEnabled;
          if (isDemolishModeEnabled) {
            isTerrainModModeEnabled = false;
            cancelFloorPlacement();
          } else {
            window.activeDemolishTarget = null;
            if (typeof World3DUI !== "undefined") {
              World3DUI.hideAimReticle();
            }
            const prompt = document.getElementById("interactPrompt");
            if (prompt) prompt.style.display = "none";
          }
          const curDemLang = typeof getGameLanguage === "function" ? getGameLanguage() : "th";
          let demNoticeText = "";
          if (curDemLang === "en") {
            demNoticeText = "Demolish Mode: " + (isDemolishModeEnabled ? "ON" : "OFF");
          } else if (curDemLang === "seedian") {
            const rawTxt = "โหมดรื้อถอน: " + (isDemolishModeEnabled ? "เปิด" : "ปิด");
            demNoticeText = (window.Seedian && typeof window.Seedian.toSeedian === "function")
              ? window.Seedian.toSeedian(rawTxt)
              : rawTxt;
          } else {
            demNoticeText = "โหมดรื้อถอน: " + (isDemolishModeEnabled ? "เปิด" : "ปิด");
          }
          showNotice(demNoticeText);
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
          if (e.repeat) return;
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
            } else if (activeInteractNPC.type === 'obsidian_cube') {
              const itemsFound = [{ name: "OBSIDIAN_CUBE", count: 1, icon: "🔶", seed: activeInteractNPC.seed }];
              if (typeof addItemToInventory === "function") {
                const success = addItemToInventory(itemsFound[0]);
                if (success) {
                  showNotice("เก็บศิลาออบซิเดียนแล้ว! (Obsidian Cube picked up)");
                  if (typeof playCollectSound === "function") playCollectSound();
                  
                  // Force respawn it immediately
                  activeInteractNPC.theta = Math.random() * Math.PI;
                  activeInteractNPC.phi = Math.random() * Math.PI * 2;
                  const seed = globalSeed || 1234.5;
                  const newHeight = getVisualHeightOnSphere(activeInteractNPC.theta, activeInteractNPC.phi, seed);
                  const wRadius = RADIUS + waterLevel * 0.15;
                  const gRadius = RADIUS + newHeight * HEIGHT_SCALE;
                  activeInteractNPC.r = Math.max(gRadius, wRadius) + 1.25;
                  activeInteractNPC.ragdollEnabled = false;
                  activeInteractNPC.ragdollInitialized = false;
                  activeInteractNPC.ragdollPos = null;
                  activeInteractNPC.ragdollVel = null;
                  activeInteractNPC.ragdollAsleep = false;
                  activeInteractNPC.ragdollSleepFrames = 0;
                  activeInteractNPC.ragdollAngle = 0;
                  activeInteractNPC.ragdollAngularSpeed = 0;
                  activeInteractNPC.hp = 6;
                  activeInteractNPC.maxHp = 6;

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
            // Check Planter System (Planting snap target or Mature harvest target)
            if (window.PlanterSystem && typeof window.PlanterSystem.handleInteract === "function") {
              if (window.PlanterSystem.handleInteract()) {
                return;
              }
            }

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
                if (item.type === "planet_core" || item.type === "wood_stairs" || item.type === "folding_ladder" || item.type === "wood_floor" || item.type === "thin_wood_floor" || item.type === "stone_floor" || item.type === "obsidian_pad_warp_item" || item.type === "obsidian_compass_pad_item" || item.type === "campfire" || item.type === "wood_boat" || item.type === "boat" || (typeof item.type === "string" && item.type.toLowerCase().includes("boat")) || item.type === "wood_wheel" || item.type === "electric_engine" || item.type === "boat_wing" || item.type === "wood_wall" || item.type === "wood_roof" || item.type === "wood_window" || item.type === "wood_door" || item.type === "wood_chest" || item.type === "wood_bed" || item.type === "wood_table" || item.type === "wood_planter_box" || item.type === "wood_chair" || item.type === "lantern" || item.type === "axe" || item.type === "pickaxe" || item.type.startsWith("robot_")) continue;
                
                const checkDist = (item.type === "cotton_plant") ? Math.max(actionReachDistance, 0.25 * (playerScale / 0.1)) : actionReachDistance;
                const reachInfo = isTargetWithinReach(item.position, checkDist);
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
              else if (item.type === "dirt" || item.type === "DIRT") { icon = "🟫"; label = "DIRT"; }
              else if (item.type === "iron_ore") { icon = "🟥"; label = "IRON_ORE"; }
              else if (item.type === "gold_ore") { icon = "🪙"; label = "GOLD_ORE"; }
              else if (item.type === "glow_ore") { icon = "✨"; label = "GLOW_ORE"; }
              else if (item.type === "glow_battery") { icon = "🔋"; label = "GLOW_BATTERY"; }
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
              else if (item.type === "electric_engine") { icon = "🔋"; label = "ELECTRIC_ENGINE"; }
              else if (item.type === "boat_wing") { icon = "🪽"; label = "BOAT_WING"; }
              else if (item.type === "meganeura_item") { icon = "🦟"; label = "MEGANEURA"; }
              else if (item.type === "isopod_item") { icon = "🦐"; label = "ISOPOD"; }
              else if (item.type === "wooden_arm_cannon") { icon = "🪵🦾"; label = "WOODEN_ARM_CANNON"; }
              else if (item.type === "dragon_fruit") { icon = "🐉"; label = "DRAGON_FRUIT"; }
              else if (item.type === "cotton_plant") { icon = "☁️"; label = "COTTON_PLANT"; }
              
              const itemData = {
                icon: icon,
                label: label,
                name: label
              };

              if (addItemToInventory(itemData)) {
                item.active = false;
                collectedCount[item.type] = (collectedCount[item.type] || 0) + 1;
                if (item.cottonId) {
                  const obsId = parseInt(item.cottonId.replace("cotton_", ""));
                  const natureList = (window.allDeterministicNatureObstacles || []).concat(window.natureObstacles || []);
                  const obs = natureList.find(o => o && o.id === obsId);
                  if (obs) obs.active = false;
                }
                if (item.isDynamic) {
                  window.pendingDynamicCollectibleRefresh = true;
                } else if (typeof window !== "undefined" && typeof window.hideStaticCollectibleInVBO === "function" && window.hideStaticCollectibleInVBO(item)) {
                  // Surgical sub-buffer update completed without full VBO rebuild
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
        if (window.isWaitingForKey) return;
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

      const cameraWaterCollisionToggle = document.getElementById(
        "cameraWaterCollisionToggle",
      );
      if (cameraWaterCollisionToggle) {
        cameraWaterCollisionToggle.addEventListener("click", () => {
          window.cameraWaterCollisionEnabled = !window.cameraWaterCollisionEnabled;
          if (typeof cameraWaterCollisionEnabled !== "undefined") {
            cameraWaterCollisionEnabled = window.cameraWaterCollisionEnabled;
          }
          const isWaterColOn = window.cameraWaterCollisionEnabled;
          cameraWaterCollisionToggle.textContent = isWaterColOn
            ? "🌊 ระบบกันกล้องชนผิวน้ำ: เปิด"
            : "🌊 ระบบกันกล้องชนผิวน้ำ: ปิด";
          cameraWaterCollisionToggle.classList.toggle("active", isWaterColOn);

          const devBtn = document.getElementById("devCameraWaterCollisionBtn");
          if (devBtn) {
            devBtn.textContent = isWaterColOn ? "🌊 กันกล้องชนผิวน้ำ: เปิด" : "🌊 กันกล้องชนผิวน้ำ: ปิด";
            devBtn.style.backgroundImage = isWaterColOn
              ? "linear-gradient(135deg, #0288d1, #00acc1)"
              : "linear-gradient(135deg, #37474f, #455a64)";
          }
          if (typeof showNotice === "function") {
            showNotice(isWaterColOn ? "🌊 เปิดระบบกันกล้องชนผิวน้ำ" : "🌊 ปิดระบบกันกล้องชนผิวน้ำ");
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
            } else if (activeInteractNPC.type === 'obsidian_cube') {
              const itemsFound = [{ name: "OBSIDIAN_CUBE", count: 1, icon: "🔶", seed: activeInteractNPC.seed }];
              if (typeof addItemToInventory === "function") {
                const success = addItemToInventory(itemsFound[0]);
                if (success) {
                  showNotice("เก็บศิลาออบซิเดียนแล้ว! (Obsidian Cube picked up)");
                  if (typeof playCollectSound === "function") playCollectSound();
                  
                  // Force respawn it immediately
                  activeInteractNPC.theta = Math.random() * Math.PI;
                  activeInteractNPC.phi = Math.random() * Math.PI * 2;
                  const seed = globalSeed || 1234.5;
                  const newHeight = getVisualHeightOnSphere(activeInteractNPC.theta, activeInteractNPC.phi, seed);
                  const wRadius = RADIUS + waterLevel * 0.15;
                  const gRadius = RADIUS + newHeight * HEIGHT_SCALE;
                  activeInteractNPC.r = Math.max(gRadius, wRadius) + 1.25;
                  activeInteractNPC.ragdollEnabled = false;
                  activeInteractNPC.ragdollInitialized = false;
                  activeInteractNPC.ragdollPos = null;
                  activeInteractNPC.ragdollVel = null;
                  activeInteractNPC.ragdollAsleep = false;
                  activeInteractNPC.ragdollSleepFrames = 0;
                  activeInteractNPC.ragdollAngle = 0;
                  activeInteractNPC.ragdollAngularSpeed = 0;
                  activeInteractNPC.hp = 6;
                  activeInteractNPC.maxHp = 6;

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
            } else if (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor" || other.type === "obsidian_pad_warp_item" || other.type === "obsidian_compass_pad_item") {
              const dx_vec = [
                p[0] - other.position[0],
                p[1] - other.position[1],
                p[2] - other.position[2]
              ];
              
              const dx = dx_vec[0] * other.R[0] + dx_vec[1] * other.R[1] + dx_vec[2] * other.R[2];
              const dz = dx_vec[0] * other.F[0] + dx_vec[1] * other.F[1] + dx_vec[2] * other.F[2];
              const dy = dx_vec[0] * other.normal[0] + dx_vec[1] * other.normal[1] + dx_vec[2] * other.normal[2];
              
              const isStone = other.type === "stone_floor";
              const isObsidianPad = other.type === "obsidian_pad_warp_item" || other.type === "obsidian_compass_pad_item";
              const hw = isStone ? other.size * 6.0 : 0.15;
              const h = isObsidianPad ? 0.033 : (isStone ? other.size * 0.15 : (other.type === "wood_floor" ? woodFloorHeight + 0.25 * 0.12 : 0.25 * 0.04));
              
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