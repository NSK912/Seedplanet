
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
                if (uPointLightCount > 0) {
                    for (int i = 0; i < 16; i++) {
                        if (i >= uPointLightCount) break;
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
          "AXE", "PICKAXE", "AEGIS_SHIFT", "aegis_shift", "SHOVEL", "IRON_BUCKET", "WATER_BUCKET", "BOW",
          "WOODEN_ARM_CANNON", "ARM_CANNON", "BRANCH", "branch", "TANTO", "tanto",
          "FRIED_BUG", "GLOW_BATTERY", "DRAGON_FRUIT", "dragon_fruit",
          "COTTON_PLANT", "cotton_plant", "COTTON", "cotton",
          "CROWN_FLOWER", "crown_flower",
          "TOUGH_MEAT", "tough_meat"
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

        let hpGroup = document.getElementById("playerHpSlotsGroup");
        let hungerGroup = document.getElementById("playerHungerSlotsGroup");

        if (!hpGroup) {
          hpGroup = document.createElement("div");
          hpGroup.className = "player-hp-slots-group";
          hpGroup.id = "playerHpSlotsGroup";
          hpContainer.prepend(hpGroup);
        }
        if (!hungerGroup) {
          hungerGroup = document.createElement("div");
          hungerGroup.className = "player-hunger-slots-group";
          hungerGroup.id = "playerHungerSlotsGroup";
          hpContainer.appendChild(hungerGroup);
        }

        hpGroup.innerHTML = "";
        hungerGroup.innerHTML = "";

        // 5 ช่อง HP (สีแดง - ฝั่งซ้าย)
        const totalHpSlots = (typeof playerMaxHP === "number") ? playerMaxHP : 5;
        const filledHpSlots = (typeof playerHP === "number") ? Math.max(0, playerHP) : 5;

        for (let s = 0; s < totalHpSlots; s++) {
          const slotDiv = document.createElement("div");
          slotDiv.className = "player-hp-slot-minimal";
          if (s < filledHpSlots) {
            slotDiv.className += " filled";
          }
          slotDiv.title = `HP: ${filledHpSlots}/${totalHpSlots}`;
          hpGroup.appendChild(slotDiv);
        }

        // 5 ช่องความหิว (สีขาว - ฝั่งขวา)
        const totalHungerSlots = (typeof playerMaxHunger === "number") ? playerMaxHunger : 5;
        const filledHungerSlots = (typeof playerHunger === "number") ? Math.max(0, playerHunger) : 5;

        for (let s = 0; s < totalHungerSlots; s++) {
          const slotDiv = document.createElement("div");
          slotDiv.className = "player-hunger-slot-minimal";
          if (s < filledHungerSlots) {
            slotDiv.className += " filled";
          }
          slotDiv.title = `ความหิว (Hunger): ${filledHungerSlots}/${totalHungerSlots}`;
          hungerGroup.appendChild(slotDiv);
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
      const generateChibiHead = (p1, p2, r, sf, headBasis = null) => (window.CapsuleModel && window.CapsuleModel.generateChibiHead ? window.CapsuleModel.generateChibiHead(p1, p2, r, sf, headBasis) : generateCapsule(p1, p2, r, 16, 16));
      const generateChibiNeck = (p1, p2, r, sf, boneBasis = null) => (window.CapsuleModel && window.CapsuleModel.generateChibiNeck ? window.CapsuleModel.generateChibiNeck(p1, p2, r, sf, boneBasis) : generateCapsule(p1, p2, r, 12, 8));
      const generateChibiEar = (p1, p2, isL, sf, boneBasis = null) => (window.CapsuleModel && window.CapsuleModel.generateChibiEar ? window.CapsuleModel.generateChibiEar(p1, p2, isL, sf, boneBasis) : generateCapsule(p1, p2, 0.018 * sf, 10, 8));
      const generateChibiTorso = (p1, p2, r, sf, ...rest) => (window.CapsuleModel && window.CapsuleModel.generateChibiTorso ? window.CapsuleModel.generateChibiTorso(p1, p2, r, sf, ...rest) : (window.CapsuleModel && window.CapsuleModel.generateChibiChest ? window.CapsuleModel.generateChibiChest(p1, p2, r, sf) : generateCapsule(p1, p2, r, 16, 12)));
      const generateChibiChest = (p1, p2, r, sf, ...rest) => (window.CapsuleModel && window.CapsuleModel.generateChibiChest ? window.CapsuleModel.generateChibiChest(p1, p2, r, sf, ...rest) : generateCapsule(p1, p2, r, 16, 12));
      const generateChibiPelvis = (p1, p2, r, sf) => (window.CapsuleModel && window.CapsuleModel.generateChibiPelvis ? window.CapsuleModel.generateChibiPelvis(p1, p2, r, sf) : generateCapsule(p1, p2, r, 16, 12));
      const generateChibiUpperArm = (p1, p2, isL, sf, ...rest) => (window.CapsuleModel && window.CapsuleModel.generateChibiUpperArm ? window.CapsuleModel.generateChibiUpperArm(p1, p2, isL, sf, ...rest) : generateCapsule(p1, p2, 0.038 * sf, 12, 10));
      const generateChibiForeArm = (p1, p2, isL, sf, boneBasis = null) => (window.CapsuleModel && window.CapsuleModel.generateChibiForeArm ? window.CapsuleModel.generateChibiForeArm(p1, p2, isL, sf, boneBasis) : generateCapsule(p1, p2, 0.032 * sf, 12, 10));
      const generateChibiThigh = (p1, p2, isL, sf, ...rest) => (window.CapsuleModel && window.CapsuleModel.generateChibiThigh ? window.CapsuleModel.generateChibiThigh(p1, p2, isL, sf, ...rest) : generateCapsule(p1, p2, 0.048 * sf, 12, 10));
      const generateChibiCalf = (p1, p2, isL, sf, ...rest) => (window.CapsuleModel && window.CapsuleModel.generateChibiCalf ? window.CapsuleModel.generateChibiCalf(p1, p2, isL, sf, ...rest) : generateCapsule(p1, p2, 0.040 * sf, 12, 10));
      const mergeMeshes = (meshes, verticesOnly = false) => (window.CapsuleModel ? window.CapsuleModel.mergeMeshes(meshes, verticesOnly) : window.mergeMeshes(meshes, verticesOnly));
      const buildHandAndFingers = (pElbow, pHand, isLeft, sf, gripAmount = 0, wristPose = null, pShoulder = null) => (window.CapsuleModel ? window.CapsuleModel.buildHandAndFingers(pElbow, pHand, isLeft, sf, gripAmount, wristPose, pShoulder) : window.buildHandAndFingers(pElbow, pHand, isLeft, sf, gripAmount, wristPose, pShoulder));
      const buildFootAnkleToes = (pKnee, pFoot, isLeft, sf, legRig = null) => (window.CapsuleModel ? window.CapsuleModel.buildFootAnkleToes(pKnee, pFoot, isLeft, sf, legRig) : window.buildFootAnkleToes(pKnee, pFoot, isLeft, sf, legRig));
      const computeFullBodyRig = (cfg) => (window.CapsuleModel && window.CapsuleModel.computeFullBodyRig ? window.CapsuleModel.computeFullBodyRig(cfg) : (window.computeFullBodyRig ? window.computeFullBodyRig(cfg) : null));
      const resetCapsuleBufferPool = () => (window.CapsuleModel ? window.CapsuleModel.resetCapsuleBufferPool() : (window.resetCapsuleBufferPool && window.resetCapsuleBufferPool()));
      const resetMergeBufferPool = () => (window.CapsuleModel ? window.CapsuleModel.resetMergeBufferPool() : (window.resetMergeBufferPool && window.resetMergeBufferPool()));

      // Hoisted pure vector math, easing, IK, hair, VFX, and vertex-patching helpers (avoid per-frame closure churn)
      function _v3Sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
      function _v3Add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
      function _v3Scale(v, s) { return [v[0] * s, v[1] * s, v[2] * s]; }
      function _v3Dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
      function _v3Crs(a, b) {
        return [
          a[1] * b[2] - a[2] * b[1],
          a[2] * b[0] - a[0] * b[2],
          a[0] * b[1] - a[1] * b[0]
        ];
      }
      function _v3Nrm(v, fb) {
        const l = v ? Math.hypot(v[0], v[1], v[2]) : 0.0;
        return l > 1e-5 ? [v[0] / l, v[1] / l, v[2] / l] : (fb || [1, 0, 0]);
      }
      function _v3Lerp(a, b, t) {
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      }
      function _v3Perp(v, b, fb) {
        const d = _v3Dot(v, b);
        return _v3Nrm([v[0] - b[0] * d, v[1] - b[1] * d, v[2] - b[2] * d], fb);
      }
      function shiraSm(a, b, x) {
        const t = Math.max(0.0, Math.min(1.0, (x - a) / Math.max(1e-4, b - a)));
        return t * t * (3.0 - 2.0 * t);
      }
      function solveSwordIK(shoulder, targetWrist, L1, L2, poleDir) {
        const dx = targetWrist[0] - shoulder[0];
        const dy = targetWrist[1] - shoulder[1];
        const dz = targetWrist[2] - shoulder[2];
        let dist = Math.hypot(dx, dy, dz);
        if (dist < 1e-4) dist = 1e-4;
        const dir = [dx / dist, dy / dist, dz / dist];
        const maxReach = (L1 + L2) * 0.992;
        const minReach = Math.abs(L1 - L2) + 0.01;
        const d = Math.max(minReach, Math.min(maxReach, dist));
        const cosA = Math.max(-1.0, Math.min(1.0, (L1 * L1 + d * d - L2 * L2) / (2.0 * L1 * d)));
        const sinA = Math.sqrt(Math.max(0.0, 1.0 - cosA * cosA));
        const dotP = poleDir[0] * dir[0] + poleDir[1] * dir[1] + poleDir[2] * dir[2];
        let bend = [
          poleDir[0] - dir[0] * dotP,
          poleDir[1] - dir[1] * dotP,
          poleDir[2] - dir[2] * dotP
        ];
        let bLen = Math.hypot(bend[0], bend[1], bend[2]);
        if (bLen < 1e-4) {
          const dF = -dir[1];
          bend = [-dir[0] * dF, 1.0 - dir[1] * dF, -dir[2] * dF];
          bLen = Math.hypot(bend[0], bend[1], bend[2]) || 1.0;
        }
        bend = [bend[0] / bLen, bend[1] / bLen, bend[2] / bLen];
        return {
          elbow: [
            shoulder[0] + (dir[0] * cosA + bend[0] * sinA) * L1,
            shoulder[1] + (dir[1] * cosA + bend[1] * sinA) * L1,
            shoulder[2] + (dir[2] * cosA + bend[2] * sinA) * L1
          ],
          wrist: [
            shoulder[0] + dir[0] * d,
            shoulder[1] + dir[1] * d,
            shoulder[2] + dir[2] * d
          ]
        };
      }
      function _smoothSkillWristVec(mem, key, tgt, kA) {
        if (!tgt) {
          mem[key] = null;
          return;
        }
        const cur = mem[key];
        if (!cur) {
          mem[key] = [tgt[0], tgt[1], tgt[2]];
        } else {
          mem[key] = _v3Nrm([
            cur[0] + (tgt[0] - cur[0]) * kA,
            cur[1] + (tgt[1] - cur[1]) * kA,
            cur[2] + (tgt[2] - cur[2]) * kA
          ], tgt);
        }
      }
      function _smoothSkillWristPose(mem, initKey, bladeKey, handKey, edgeKey, palmKey, skillWrist, kA) {
        if (!skillWrist || !skillWrist.bladeDir) {
          mem[initKey] = false;
          return skillWrist;
        }
        const nrmFallback = (v) => {
          const l = Math.hypot(v[0], v[1], v[2]) || 1.0;
          return [v[0] / l, v[1] / l, v[2] / l];
        };
        const tgtB = nrmFallback(skillWrist.bladeDir);
        const tgtH = skillWrist.handDir ? nrmFallback(skillWrist.handDir) : null;
        const tgtE = skillWrist.edgeDir ? nrmFallback(skillWrist.edgeDir) : null;
        const tgtP = skillWrist.palmHint ? nrmFallback(skillWrist.palmHint) : null;
        if (!mem[initKey] || kA >= 0.999) {
          mem[bladeKey] = [tgtB[0], tgtB[1], tgtB[2]];
          mem[handKey] = tgtH ? [tgtH[0], tgtH[1], tgtH[2]] : null;
          mem[edgeKey] = tgtE ? [tgtE[0], tgtE[1], tgtE[2]] : null;
          mem[palmKey] = tgtP ? [tgtP[0], tgtP[1], tgtP[2]] : null;
          mem[initKey] = true;
        } else {
          _smoothSkillWristVec(mem, bladeKey, tgtB, kA);
          _smoothSkillWristVec(mem, handKey, tgtH, kA);
          _smoothSkillWristVec(mem, edgeKey, tgtE, kA);
          _smoothSkillWristVec(mem, palmKey, tgtP, kA);
        }
        return {
          bladeDir: mem[bladeKey],
          handDir: mem[handKey],
          handBlend: skillWrist.handBlend,
          edgeDir: mem[edgeKey],
          palmHint: mem[palmKey] || skillWrist.palmHint || null,
          gripMode: skillWrist.gripMode || "normal"
        };
      }
      function _buildAnimeHairLocalAndNormals(styleIdx, colorRgb, scaleFactor, clipUnderHood) {
        const rawV = [], rawC = [], rawI = [], rawF = [];
        if (typeof window.build3DAnimeHair === "function") {
          const headFit = 0.192 / 0.240;
          window.build3DAnimeHair(
            styleIdx,
            colorRgb,
            scaleFactor,
            (lx, ly, lz) => [lx * headFit, ly * headFit, lz * headFit],
            0,
            rawV,
            rawC,
            rawI,
            rawF
          );
        }
        let finalV = rawV, finalC = rawC, finalI = rawI, finalF = rawF;
        if (clipUnderHood && rawV.length > 0) {
          const numVerts = (rawV.length / 3) | 0;
          const vKeep = new Uint8Array(numVerts);
          const clampedV = new Float32Array(rawV.length);
          const clampedF = new Float32Array(numVerts);
          for (let v = 0; v < numVerts; v++) {
            let lx = rawV[v * 3];
            let ly = rawV[v * 3 + 1];
            let lz = rawV[v * 3 + 2];
            const dy = ly - 0.025;
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
          finalV = fV; finalC = fC; finalI = fI; finalF = fF;
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
          const len = Math.hypot(normals[k], normals[k + 1], normals[k + 2]);
          if (len > 0.0001) {
            normals[k] /= len; normals[k + 1] /= len; normals[k + 2] /= len;
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
        return { localV: finalV, colors: finalC, indices: finalI, flexW: finalF, normals, localDummyV };
      }
      function _addSlashArcRibbon(rawV, rawC, rawI, centerPt, uDir, vDir, nDir, rIn, rOut, aStart, aEnd, segs, maxThick, cCore, cRim, brightMin, brightSpan) {
        const baseIdx = rawV.length / 3;
        for (let i = 0; i <= segs; i++) {
          const u = i / segs;
          const ang = aStart + (aEnd - aStart) * u;
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const taper = Math.sin(u * Math.PI);
          const wCur = rIn + (rOut - rIn) * (0.18 + 0.82 * Math.pow(taper, 0.65));
          const halfT = maxThick * taper;
          const radDir0 = uDir[0] * ca + vDir[0] * sa;
          const radDir1 = uDir[1] * ca + vDir[1] * sa;
          const radDir2 = uDir[2] * ca + vDir[2] * sa;
          const midRad = rIn + (wCur - rIn) * 0.55;
          const pMidX = centerPt[0] + radDir0 * midRad;
          const pMidY = centerPt[1] + radDir1 * midRad;
          const pMidZ = centerPt[2] + radDir2 * midRad;
          const bright = brightMin + brightSpan * taper;
          const cr = Math.min(1, cCore[0] * bright), cg = Math.min(1, cCore[1] * bright), cb = Math.min(1, cCore[2] * bright);
          rawV.push(
            centerPt[0] + radDir0 * rIn, centerPt[1] + radDir1 * rIn, centerPt[2] + radDir2 * rIn,
            pMidX + nDir[0] * halfT, pMidY + nDir[1] * halfT, pMidZ + nDir[2] * halfT,
            centerPt[0] + radDir0 * wCur, centerPt[1] + radDir1 * wCur, centerPt[2] + radDir2 * wCur,
            pMidX - nDir[0] * halfT, pMidY - nDir[1] * halfT, pMidZ - nDir[2] * halfT
          );
          rawC.push(cr, cg, cb, cRim[0], cRim[1], cRim[2], cr, cg, cb, cRim[0], cRim[1], cRim[2]);
        }
        for (let i = 0; i < segs; i++) {
          const a = baseIdx + i * 4;
          const b = baseIdx + (i + 1) * 4;
          rawI.push(a + 0, a + 1, b + 1, a + 0, b + 1, b + 0);
          rawI.push(a + 1, a + 2, b + 2, a + 1, b + 2, b + 1);
          rawI.push(a + 2, a + 3, b + 3, a + 2, b + 3, b + 2);
          rawI.push(a + 3, a + 0, b + 0, a + 3, b + 0, b + 3);
        }
      }
      function _emitGroundShatterSpikes(addWedgeFn, tipImpact, spikeDirs, spScale, wBase, wTip, depth, colEven, colOdd) {
        for (let si = 0; si < spikeDirs.length; si++) {
          const sd = _v3Nrm(spikeDirs[si]);
          const spTip = [
            tipImpact[0] + sd[0] * spScale,
            tipImpact[1] + sd[1] * spScale,
            tipImpact[2] + sd[2] * spScale
          ];
          addWedgeFn(tipImpact, spTip, wBase, wTip, depth, (si % 2 === 0) ? colEven : colOdd, [1, 0, 0]);
        }
      }
      let _reusableLocalVertBuf = null;
      function _buildPatchedLocalVerts(mergedVerts, meshesList, hairMesh, hairDummyV, hoodieMesh) {
        const len = mergedVerts.length;
        if (!_reusableLocalVertBuf || _reusableLocalVertBuf.length < len) {
          _reusableLocalVertBuf = new Float32Array(Math.max(len, 1024));
        }
        const out = _reusableLocalVertBuf.subarray(0, len);
        out.set(mergedVerts);
        let offset = 0;
        for (let k = 0; k < meshesList.length; k++) {
          const m = meshesList[k];
          if (!m || !m.vertices || m.vertices.length === 0) continue;
          const mLen = m.vertices.length;
          if (m === hairMesh && hairDummyV && hairDummyV.length === mLen) {
            out.set(hairDummyV, offset);
          } else if (m === hoodieMesh) {
            for (let v = 0; v < mLen; v += 3) {
              out[offset + v] += 10.0;
            }
          }
          offset += mLen;
        }
        return out;
      }

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
      // ระบบโมเดลตัวละคร: Classic (Procedural) & Chibi White (GLB - ปิดใช้งานชั่วคราว)
      // =========================================================================
      if (typeof window !== "undefined") {
        window.GLB_DISABLED = true; // ปิดใช้งานโมเดล GLB ชั่วคราวตามคำขอ
        window.characterModel = "classic"; // ค่าเริ่มต้น: Classic (Base Procedural Chibi)

        window.switchCharacterModel = function(modelName) {
          if (window.GLB_DISABLED) {
            window.characterModel = "classic";
            if (typeof equipIndicesLength !== "undefined") {
              equipIndicesLength = 0;
            }
            if (typeof updateCharacterMesh === "function") {
              updateCharacterMesh(typeof walkPhase !== "undefined" ? walkPhase : 0.0);
            }
            if (typeof window.updateDevCharacterModelUI === "function") {
              window.updateDevCharacterModelUI();
            }
            if (typeof showNotice === "function" && (modelName === "chibi" || modelName === "chibi_white")) {
              showNotice("🚫 โมเดล GLB (Chibi White) ถูกปิดใช้งานชั่วคราว (ใช้ 🧑 Classic แทน)");
            }
            return window.characterModel;
          }
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
          if (window.GLB_DISABLED) {
            return window.switchCharacterModel("chibi");
          }
          let next = window.characterModel === "classic" ? "chibi" : "classic";
          return window.switchCharacterModel(next);
        };

        // Load GLB (skipped while GLB_DISABLED is true)
        window.chibiGlbModel = null;
        window.createChibiGlbTexture = function(targetGl) {
          if (typeof window === "undefined" || window.GLB_DISABLED) return null;
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

        if (!window.GLB_DISABLED && window.GLBLoader) {
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
      const buildOxfordShoesMesh = (typeof window !== "undefined" && window.CapsuleModel) ? window.CapsuleModel.buildOxfordShoesMesh : () => ({ vertices: [], normals: [], colors: [], texcoords: [], indices: [] });
      const buildDressBootsMesh = (typeof window !== "undefined" && window.CapsuleModel) ? window.CapsuleModel.buildDressBootsMesh : () => ({ vertices: [], normals: [], colors: [], texcoords: [], indices: [] });
      const buildWhiteShirtCollarMesh = (typeof window !== "undefined" && window.CapsuleModel) ? window.CapsuleModel.buildWhiteShirtCollarMesh : () => ({ vertices: [], normals: [], colors: [], texcoords: [], indices: [] });
      const buildBlackPleatedSkirtMesh = (typeof window !== "undefined" && window.CapsuleModel) ? window.CapsuleModel.buildBlackPleatedSkirtMesh : () => ({ vertices: [], normals: [], colors: [], texcoords: [], indices: [] });
      const buildDoubleBreastedSuitMesh = (typeof window !== "undefined" && window.CapsuleModel) ? window.CapsuleModel.buildDoubleBreastedSuitMesh : () => ({ vertices: [], normals: [], colors: [], texcoords: [], indices: [] });
      const buildBlackSlacksMesh = (typeof window !== "undefined" && window.CapsuleModel) ? window.CapsuleModel.buildBlackSlacksMesh : () => ({ vertices: [], normals: [], colors: [], texcoords: [], indices: [] });


      function getGlbCharacterMeshData(phase, isClone = false, cloneWalkBlend = 1.0) {
        if (typeof window === "undefined" || window.GLB_DISABLED || !window.chibiGlbModel) return null;
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

        const pRear = [pElbow[0] + dir[0] * (0.005 * itemScale), pElbow[1] + dir[1] * (0.005 * itemScale), pElbow[2] + dir[2] * (0.005 * itemScale)];
        const pMid = [pElbow[0] + dir[0] * (armLen * 0.72), pElbow[1] + dir[1] * (armLen * 0.72), pElbow[2] + dir[2] * (armLen * 0.72)];
        const pMuzzle = [pHand[0] + dir[0] * (0.130 * itemScale), pHand[1] + dir[1] * (0.130 * itemScale), pHand[2] + dir[2] * (0.130 * itemScale)];
        const pBoreIn = [pMuzzle[0] - dir[0] * (0.045 * itemScale), pMuzzle[1] - dir[1] * (0.045 * itemScale), pMuzzle[2] - dir[2] * (0.045 * itemScale)];
        const pBoreOut = [pMuzzle[0] + dir[0] * (0.002 * itemScale), pMuzzle[1] + dir[1] * (0.002 * itemScale), pMuzzle[2] + dir[2] * (0.002 * itemScale)];

        const woodColorMain = [0.55, 0.38, 0.22];
        const woodColorDark = [0.42, 0.28, 0.15];
        const ironColor = [0.28, 0.28, 0.30];
        const darkMuzzleColor = [0.22, 0.22, 0.24];
        const innerBoreColor = [0.10, 0.10, 0.10];

        // 1. Main wooden forearm housing and flared barrel body (8-sided cylinder sized outside forearm & closed fist)
        buildTaperedSegment(pRear, pMid, 0.056 * itemScale, 0.054 * itemScale, 8, woodColorMain, rawV, rawC, rawI, true);
        buildTaperedSegment(pMid, pMuzzle, 0.054 * itemScale, 0.060 * itemScale, 8, woodColorDark, rawV, rawC, rawI, true);

        // 2. Rear reinforcement iron ring
        const pRearBand = [pRear[0] + dir[0] * (0.018 * itemScale), pRear[1] + dir[1] * (0.018 * itemScale), pRear[2] + dir[2] * (0.018 * itemScale)];
        buildTaperedSegment(pRear, pRearBand, 0.060 * itemScale, 0.059 * itemScale, 8, ironColor, rawV, rawC, rawI, false);

        // 3. Mid reinforcement iron ring clamp
        const pMidBand1 = [pMid[0] - dir[0] * (0.009 * itemScale), pMid[1] - dir[1] * (0.009 * itemScale), pMid[2] - dir[2] * (0.009 * itemScale)];
        const pMidBand2 = [pMid[0] + dir[0] * (0.009 * itemScale), pMid[1] + dir[1] * (0.009 * itemScale), pMid[2] + dir[2] * (0.009 * itemScale)];
        buildTaperedSegment(pMidBand1, pMidBand2, 0.058 * itemScale, 0.058 * itemScale, 8, ironColor, rawV, rawC, rawI, false);

        // 4. Front iron muzzle collar
        const pMuzzleRing = [pMuzzle[0] - dir[0] * (0.022 * itemScale), pMuzzle[1] - dir[1] * (0.022 * itemScale), pMuzzle[2] - dir[2] * (0.022 * itemScale)];
        buildTaperedSegment(pMuzzleRing, pMuzzle, 0.065 * itemScale, 0.065 * itemScale, 8, darkMuzzleColor, rawV, rawC, rawI, false);

        // 5. Inner dark hollow cannon bore (capped cleanly to prevent seeing fist inside)
        buildTaperedSegment(pBoreIn, pBoreOut, 0.036 * itemScale, 0.037 * itemScale, 8, innerBoreColor, rawV, rawC, rawI, true);

        // 6. Arrow in barrel when aiming/ready
        if (!arrowShotInCurrentAnim && useAnimTimer > 0) {
          const arrowTip = [pMuzzle[0] + dir[0] * (0.048 * itemScale), pMuzzle[1] + dir[1] * (0.048 * itemScale), pMuzzle[2] + dir[2] * (0.048 * itemScale)];
          const arrowShaftEnd = [pMuzzle[0] - dir[0] * (0.055 * itemScale), pMuzzle[1] - dir[1] * (0.055 * itemScale), pMuzzle[2] - dir[2] * (0.055 * itemScale)];
          buildTaperedSegment(arrowShaftEnd, arrowTip, 0.0065 * itemScale, 0.0065 * itemScale, 4, [0.55, 0.4, 0.25], rawV, rawC, rawI);

          const arrowHeadTip = [arrowTip[0] + dir[0] * (0.030 * itemScale), arrowTip[1] + dir[1] * (0.030 * itemScale), arrowTip[2] + dir[2] * (0.030 * itemScale)];
          buildTaperedSegment(arrowTip, arrowHeadTip, 0.015 * itemScale, 0.001 * itemScale, 4, [0.35, 0.35, 0.35], rawV, rawC, rawI);
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

      function buildHeldIronBucketMesh(handPos, itemScale, heldItem, rawV, rawC, rawI, chibiMode = false, chibiPourPose = null) {
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
        let handleAngle = 0.0;
        const t = 1.0 - Math.max(0.0, Math.min(1.0, scoopTimer));
        const tw = 1.0 - Math.max(0.0, Math.min(1.0, waterTimer));

        if (scoopTimer > 0) {
          if (t < 0.40) {
            // Stage 1: Dip & tilt bucket mouth forward/down into the water
            const s = Math.sin((t / 0.40) * (Math.PI * 0.5));
            tiltAngle += s * (chibiMode ? 1.55 : 1.75);
            if (chibiMode) {
              handleAngle = Math.max(0.0, s * 1.12);
            } else {
              offsetY = -0.22 * itemScale * s;
              offsetZ = 0.25 * itemScale * s;
            }
          } else if (t < 0.75) {
            // Stage 2: Drag through water & rotate upright with water inside
            const u = (t - 0.40) / 0.35;
            const su = u * u * (3.0 - 2.0 * u);
            const dipPeak = chibiMode ? 1.55 : 1.75;
            const dTilt = dipPeak * (1.0 - su) - 0.22 * su;
            tiltAngle += dTilt;
            if (chibiMode) {
              handleAngle = Math.max(0.0, dTilt * 0.72);
            } else {
              offsetY = -0.22 * itemScale * (1.0 - su) + 0.04 * itemScale * su;
              offsetZ = 0.25 * itemScale * (1.0 - su) + 0.10 * itemScale * su;
            }
          } else {
            // Stage 3: Settle smoothly back to hand position
            const v = (t - 0.75) / 0.25;
            const sv = v * v * (3.0 - 2.0 * v);
            tiltAngle += -0.22 * (1.0 - sv);
            if (!chibiMode) {
              offsetY = 0.04 * itemScale * (1.0 - sv);
              offsetZ = 0.10 * itemScale * (1.0 - sv);
            }
          }
        } else if (waterTimer > 0 && !chibiMode && (!window.activeWateringAnimPlanter || !window.activeWateringAnimPlanter.position)) {
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

        if (chibiMode && waterTimer > 0 && chibiPourPose && chibiPourPose.pourEnv > 0.001) {
          const p = chibiPourPose.pourEnv;
          const bR = chibiPourPose.bR;
          const bN = chibiPourPose.bN;
          const bF = chibiPourPose.bF;
          rVec = [
            rVec[0] * (1.0 - p) + bR[0] * p,
            rVec[1] * (1.0 - p) + bR[1] * p,
            rVec[2] * (1.0 - p) + bR[2] * p
          ];
          nVec = [
            nVec[0] * (1.0 - p) + bN[0] * p,
            nVec[1] * (1.0 - p) + bN[1] * p,
            nVec[2] * (1.0 - p) + bN[2] * p
          ];
          const nL = Math.hypot(nVec[0], nVec[1], nVec[2]) || 1.0;
          nVec = [nVec[0] / nL, nVec[1] / nL, nVec[2] / nL];
          // Orthonormalize rVec & fVec cleanly
          const dotRN = rVec[0] * nVec[0] + rVec[1] * nVec[1] + rVec[2] * nVec[2];
          rVec = [
            rVec[0] - nVec[0] * dotRN,
            rVec[1] - nVec[1] * dotRN,
            rVec[2] - nVec[2] * dotRN
          ];
          const rL = Math.hypot(rVec[0], rVec[1], rVec[2]) || 1.0;
          rVec = [rVec[0] / rL, rVec[1] / rL, rVec[2] / rL];
          fVec = [
            rVec[1] * nVec[2] - rVec[2] * nVec[1],
            rVec[2] * nVec[0] - rVec[0] * nVec[2],
            rVec[0] * nVec[1] - rVec[1] * nVec[0]
          ];
          const fL = Math.hypot(fVec[0], fVec[1], fVec[2]) || 1.0;
          fVec = [fVec[0] / fL, fVec[1] / fL, fVec[2] / fL];
          // Ensure fVec aligns with blended fVec/bF sign
          const bFBlend = [
            (1.0 - p) * fVec[0] + p * bF[0],
            (1.0 - p) * fVec[1] + p * bF[1],
            (1.0 - p) * fVec[2] + p * bF[2]
          ];
          if (fVec[0] * bFBlend[0] + fVec[1] * bFBlend[1] + fVec[2] * bFBlend[2] < 0) {
            fVec = [-fVec[0], -fVec[1], -fVec[2]];
          }
          handleAngle = chibiPourPose.handleAngle * p;
        }

        const dx = (typeof devOff.x === "number" ? devOff.x : 0.03) * itemScale;
        const dy = (typeof devOff.y === "number" ? devOff.y : 0.00) * itemScale;
        const dz = (typeof devOff.z === "number" ? devOff.z : 0.04) * itemScale;

        let gripPos = [
          handPos[0] + dx,
          handPos[1] + dy + offsetY,
          handPos[2] + dz + offsetZ
        ];
        // Pivot bucket around its hinged top handle grip sleeve
        const cosH = Math.cos(handleAngle);
        const sinH = Math.sin(handleAngle);
        const hDir = [
          nVec[0] * cosH - fVec[0] * sinH,
          nVec[1] * cosH - fVec[1] * sinH,
          nVec[2] * cosH - fVec[2] * sinH
        ];
        const gripFromCenter = chibiMode
          ? [
              nVec[0] * (0.28 * bScale) + hDir[0] * (0.29 * bScale),
              nVec[1] * (0.28 * bScale) + hDir[1] * (0.29 * bScale),
              nVec[2] * (0.28 * bScale) + hDir[2] * (0.29 * bScale)
            ]
          : [
              nVec[0] * (0.55 * bScale),
              nVec[1] * (0.55 * bScale),
              nVec[2] * (0.55 * bScale)
            ];
        let centerPos = [
          gripPos[0] - gripFromCenter[0],
          gripPos[1] - gripFromCenter[1],
          gripPos[2] - gripFromCenter[2]
        ];

        let snappedSoilLocal = null;
        let snappedUpLocal = null;

        // Locate planter soil target during watering animation (GLB snaps over box; Chibi pours from its own two hands)
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

          const soilWorld = [
            pP[0] + pN[0] * (0.095 * pS),
            pP[1] + pN[1] * (0.095 * pS),
            pP[2] + pN[2] * (0.095 * pS)
          ];
          snappedSoilLocal = worldToLocal(soilWorld);
          snappedUpLocal = worldDirToLocal(pN);

          if (!chibiMode) {
            const rawToBox = [pP[0] - charPos[0], pP[1] - charPos[1], pP[2] - charPos[2]];
            const dotN = rawToBox[0] * pN[0] + rawToBox[1] * pN[1] + rawToBox[2] * pN[2];
            const horizW = [rawToBox[0] - pN[0] * dotN, rawToBox[1] - pN[1] * dotN, rawToBox[2] - pN[2] * dotN];
            const horizLen = Math.hypot(horizW[0], horizW[1], horizW[2]);
            const pourDirW = horizLen > 0.001
              ? [horizW[0] / horizLen, horizW[1] / horizLen, horizW[2] / horizLen]
              : [pF[0], pF[1], pF[2]];

            let sideDirW = [
              pN[1] * pourDirW[2] - pN[2] * pourDirW[1],
              pN[2] * pourDirW[0] - pN[0] * pourDirW[2],
              pN[0] * pourDirW[1] - pN[1] * pourDirW[0]
            ];
            const sideLen = Math.hypot(sideDirW[0], sideDirW[1], sideDirW[2]) || 1.0;
            sideDirW = [sideDirW[0] / sideLen, sideDirW[1] / sideLen, sideDirW[2] / sideLen];

            const upL = snappedUpLocal;
            const fwdL = worldDirToLocal(pourDirW);
            const sideL = worldDirToLocal(sideDirW);

            let pourTilt = 1.95;
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
          showWater,
          handleAngle
        );

        // Render pouring water stream directly from lower bucket rim lip down onto the planter soil
        if (waterTimer > 0 && tw >= 0.14 && tw <= 0.78 && typeof buildTaperedSegment === "function") {
          const pourProgress = (tw - 0.14) / 0.64;
          const upRef = snappedUpLocal || [0, 1, 0];
          const dotUn = (-upRef[0]) * nVec[0] + (-upRef[1]) * nVec[1] + (-upRef[2]) * nVec[2];
          let lipDir = [
            -upRef[0] - nVec[0] * dotUn,
            -upRef[1] - nVec[1] * dotUn,
            -upRef[2] - nVec[2] * dotUn
          ];
          const lipLen = Math.hypot(lipDir[0], lipDir[1], lipDir[2]);
          lipDir = lipLen > 0.001
            ? [lipDir[0] / lipLen, lipDir[1] / lipLen, lipDir[2] / lipLen]
            : [0, -1, 0];
          const mouthPos = chibiMode
            ? [
                centerPos[0] + nVec[0] * (0.24 * bScale) + lipDir[0] * (0.29 * bScale),
                centerPos[1] + nVec[1] * (0.24 * bScale) + lipDir[1] * (0.29 * bScale),
                centerPos[2] + nVec[2] * (0.24 * bScale) + lipDir[2] * (0.29 * bScale)
              ]
            : [
                centerPos[0] + nVec[0] * (0.24 * bScale),
                centerPos[1] + nVec[1] * (0.24 * bScale),
                centerPos[2] + nVec[2] * (0.24 * bScale)
              ];

          if (chibiMode) {
            const reachSoil = Math.min(1.0, pourProgress * 3.5);
            let horizVec, vertDrop;
            if (snappedSoilLocal) {
              const delta = [
                snappedSoilLocal[0] - mouthPos[0],
                snappedSoilLocal[1] - mouthPos[1],
                snappedSoilLocal[2] - mouthPos[2]
              ];
              const deltaUp = delta[0] * upRef[0] + delta[1] * upRef[1] + delta[2] * upRef[2];
              const rawHoriz = [
                delta[0] - upRef[0] * deltaUp,
                delta[1] - upRef[1] * deltaUp,
                delta[2] - upRef[2] * deltaUp
              ];
              const hDist = Math.hypot(rawHoriz[0], rawHoriz[1], rawHoriz[2]);
              const maxPourHoriz = 0.32 * itemScale;
              const clampedHoriz = Math.min(hDist, maxPourHoriz);
              horizVec = hDist > 0.001
                ? [
                    (rawHoriz[0] / hDist) * clampedHoriz,
                    (rawHoriz[1] / hDist) * clampedHoriz,
                    (rawHoriz[2] / hDist) * clampedHoriz
                  ]
                : [0, 0, 0.16 * itemScale];
              vertDrop = Math.min(-0.10 * itemScale, deltaUp);
            } else {
              const yawDir = (chibiPourPose && chibiPourPose.fwd) ? chibiPourPose.fwd : [0, 0, 1];
              horizVec = [yawDir[0] * 0.20 * itemScale, yawDir[1] * 0.20 * itemScale, yawDir[2] * 0.20 * itemScale];
              vertDrop = -0.22 * itemScale;
            }

            const arcPt = (k) => {
              const hk = Math.pow(k, 0.78);
              const vk = k * k;
              return [
                mouthPos[0] + horizVec[0] * hk + upRef[0] * (vertDrop * vk),
                mouthPos[1] + horizVec[1] * hk + upRef[1] * (vertDrop * vk),
                mouthPos[2] + horizVec[2] * hk + upRef[2] * (vertDrop * vk)
              ];
            };

            const segs = 4;
            for (let sIdx = 0; sIdx < segs; sIdx++) {
              const k0 = (sIdx / segs) * reachSoil;
              const k1 = ((sIdx + 1) / segs) * reachSoil;
              const p0 = arcPt(k0);
              const p1 = arcPt(k1);
              const r0 = (0.145 - 0.045 * (sIdx / segs)) * bScale;
              const r1 = (0.145 - 0.045 * ((sIdx + 1) / segs)) * bScale;
              buildTaperedSegment(
                p0,
                p1,
                r0,
                r1,
                6,
                [0.24, 0.72, 0.98],
                rawV,
                rawC,
                rawI,
                sIdx === 0 || sIdx === segs - 1
              );
            }

            if (snappedSoilLocal && pourProgress > 0.18) {
              const landingPt = arcPt(1.0);
              const splashWave = Math.sin(((pourProgress - 0.18) / 0.82) * Math.PI);
              const splashTop = [
                landingPt[0] + upRef[0] * (0.025 * bScale),
                landingPt[1] + upRef[1] * (0.025 * bScale),
                landingPt[2] + upRef[2] * (0.025 * bScale)
              ];
              buildTaperedSegment(
                landingPt,
                splashTop,
                0.22 * bScale * splashWave,
                0.13 * bScale * splashWave,
                8,
                [0.36, 0.80, 1.0],
                rawV,
                rawC,
                rawI,
                true
              );
            }
          } else {
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
      }

      // === HELD ITEM FLAT-SHADED TEMPLATE CACHE & DIRTY-STATE TRACKING ===
      const _heldFlatTemplateCache = {};
      let _lastChibiEquipSig = null;
      let _lastCapsuleEquipSig = null;
      let _lastEquipRenderMode = "";

      function _getOrBakeHeldFlatTemplate(templateKey, buildUnitFn) {
        let entry = _heldFlatTemplateCache[templateKey];
        if (entry) return entry;
        const rawV = [], rawC = [], rawI = [];
        buildUnitFn(rawV, rawC, rawI);
        const posFlat = makeFlatShadedGeometry(rawV, rawC, rawI);

        const flippedI = new Array(rawI.length);
        for (let i = 0; i < rawI.length; i += 3) {
          flippedI[i] = rawI[i];
          flippedI[i + 1] = rawI[i + 2];
          flippedI[i + 2] = rawI[i + 1];
        }
        const negFlat = makeFlatShadedGeometry(rawV, rawC, flippedI);
        const negNormals = negFlat.normals instanceof Float32Array ? negFlat.normals : new Float32Array(negFlat.normals);
        for (let i = 0; i < negNormals.length; i++) {
          negNormals[i] = -negNormals[i];
        }

        const posVerts = posFlat.vertices instanceof Float32Array ? posFlat.vertices : new Float32Array(posFlat.vertices);
        const posNorms = posFlat.normals instanceof Float32Array ? posFlat.normals : new Float32Array(posFlat.normals);
        const posColors = posFlat.colors instanceof Float32Array ? posFlat.colors : new Float32Array(posFlat.colors);
        const posIndices = (posFlat.indices.length > 65535)
          ? (posFlat.indices instanceof Uint32Array ? posFlat.indices : new Uint32Array(posFlat.indices))
          : (posFlat.indices instanceof Uint16Array ? posFlat.indices : new Uint16Array(posFlat.indices));

        const negVerts = negFlat.vertices instanceof Float32Array ? negFlat.vertices : new Float32Array(negFlat.vertices);
        const negColors = negFlat.colors instanceof Float32Array ? negFlat.colors : new Float32Array(negFlat.colors);
        const negIndices = (negFlat.indices.length > 65535)
          ? (negFlat.indices instanceof Uint32Array ? negFlat.indices : new Uint32Array(negFlat.indices))
          : (negFlat.indices instanceof Uint16Array ? negFlat.indices : new Uint16Array(negFlat.indices));

        entry = {
          pos: {
            key: templateKey + ":pos",
            vertices: posVerts,
            normals: posNorms,
            colors: posColors,
            indices: posIndices,
            outVertices: new Float32Array(posVerts.length),
            outNormals: new Float32Array(posNorms.length)
          },
          neg: {
            key: templateKey + ":neg",
            vertices: negVerts,
            normals: negNormals,
            colors: negColors,
            indices: negIndices,
            outVertices: new Float32Array(negVerts.length),
            outNormals: new Float32Array(negNormals.length)
          }
        };
        _heldFlatTemplateCache[templateKey] = entry;
        return entry;
      }

      function _getTransformedHeldFlatEquip(templateKey, buildUnitFn, pos, uAxis, vAxis, wAxis, scale, isClone) {
        const entry = _getOrBakeHeldFlatTemplate(templateKey, buildUnitFn);
        const ux = uAxis[0], uy = uAxis[1], uz = uAxis[2];
        const vx = vAxis[0], vy = vAxis[1], vz = vAxis[2];
        const wx = wAxis[0], wy = wAxis[1], wz = wAxis[2];
        const det = ux * (vy * wz - vz * wy) - uy * (vx * wz - vz * wx) + uz * (vx * wy - vy * wx);
        const variant = (det < 0) ? entry.neg : entry.pos;
        const srcV = variant.vertices;
        const srcN = variant.normals;
        const vLen = srcV.length;
        const outV = isClone ? new Float32Array(vLen) : variant.outVertices;
        const outN = isClone ? new Float32Array(vLen) : variant.outNormals;
        const sux = ux * scale, suy = uy * scale, suz = uz * scale;
        const svx = vx * scale, svy = vy * scale, svz = vz * scale;
        const swx = wx * scale, swy = wy * scale, swz = wz * scale;
        const px = pos[0], py = pos[1], pz = pos[2];
        for (let i = 0; i < vLen; i += 3) {
          const lx = srcV[i], ly = srcV[i + 1], lz = srcV[i + 2];
          outV[i]     = px + lx * sux + ly * svx + lz * swx;
          outV[i + 1] = py + lx * suy + ly * svy + lz * swy;
          outV[i + 2] = pz + lx * suz + ly * svz + lz * swz;
          const nx = srcN[i], ny = srcN[i + 1], nz = srcN[i + 2];
          outN[i]     = nx * ux + ny * vx + nz * wx;
          outN[i + 1] = nx * uy + ny * vy + nz * wy;
          outN[i + 2] = nx * uz + ny * vz + nz * wz;
        }
        return {
          _templateKey: variant.key,
          vertices: outV,
          normals: outN,
          colors: variant.colors,
          indices: variant.indices
        };
      }

      function _uploadFlatEquipToGL(activeGl, flatEquip) {
        equipIndicesLength = flatEquip.indices.length;

        if (!equipVertexBuffer) equipVertexBuffer = activeGl.createBuffer();
        uploadDynamicBuffer(activeGl, equipVertexBuffer, activeGl.ARRAY_BUFFER, flatEquip.vertices instanceof Float32Array ? flatEquip.vertices : new Float32Array(flatEquip.vertices));

        if (!equipNormalBuffer) equipNormalBuffer = activeGl.createBuffer();
        uploadDynamicBuffer(activeGl, equipNormalBuffer, activeGl.ARRAY_BUFFER, flatEquip.normals instanceof Float32Array ? flatEquip.normals : new Float32Array(flatEquip.normals));

        if (!equipColorBuffer) equipColorBuffer = activeGl.createBuffer();
        const tplKey = flatEquip._templateKey || null;
        if (!tplKey || equipColorBuffer._templateKey !== tplKey || equipColorBuffer._allocByteLength !== flatEquip.colors.byteLength) {
          uploadDynamicBuffer(activeGl, equipColorBuffer, activeGl.ARRAY_BUFFER, flatEquip.colors instanceof Float32Array ? flatEquip.colors : new Float32Array(flatEquip.colors));
          equipColorBuffer._templateKey = tplKey;
        }

        if (!equipIndexBuffer) equipIndexBuffer = activeGl.createBuffer();
        if (!tplKey || equipIndexBuffer._templateKey !== tplKey || equipIndexBuffer._uploadedCount !== equipIndicesLength) {
          const idxData = (equipIndicesLength > 65535)
            ? (flatEquip.indices instanceof Uint32Array ? flatEquip.indices : new Uint32Array(flatEquip.indices))
            : (flatEquip.indices instanceof Uint16Array ? flatEquip.indices : new Uint16Array(flatEquip.indices));
          uploadDynamicBuffer(activeGl, equipIndexBuffer, activeGl.ELEMENT_ARRAY_BUFFER, idxData);
          equipIndexBuffer._uploadedCount = equipIndicesLength;
          equipIndexBuffer._templateKey = tplKey;
        }
      }

      function _updateArmCannonWorldAim(pElbow, pHand, itemScale) {
        if (typeof getCharacterMatrix !== "function") return;
        const dir = [pHand[0] - pElbow[0], pHand[1] - pElbow[1], pHand[2] - pElbow[2]];
        const armLen = Math.hypot(dir[0], dir[1], dir[2]) || 0.1;
        dir[0] /= armLen; dir[1] /= armLen; dir[2] /= armLen;
        const pMuzzle = [
          pHand[0] + dir[0] * (0.130 * itemScale),
          pHand[1] + dir[1] * (0.130 * itemScale),
          pHand[2] + dir[2] * (0.130 * itemScale)
        ];
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

      function _buildUnitHeldToolGeometry(toolType, rawV, rawC, rawI) {
        const sub = _v3Sub;
        const add = _v3Add;
        const cross = _v3Crs;
        const normalize = (v) => _v3Nrm(v, [1, 0, 0]);
        const scale = _v3Scale;
        const addWedgeLocal = (pBase, pTip, widthBase, widthTip, thickness, color, thicknessDir) => {
          const dir = sub(pTip, pBase);
          const f = normalize(dir);
          const right = normalize(thicknessDir || [1, 0, 0]);
          const forward = normalize(cross(right, f));
          const sx = scale(right, thickness * 0.5);
          const wBase = scale(forward, widthBase * 0.5);
          const wTip = scale(forward, widthTip * 0.5);
          const vBaseIdx = rawV.length / 3;
          const b1 = add(add(pBase, sx), wBase);
          const b2 = add(sub(pBase, sx), wBase);
          const b3 = sub(sub(pBase, sx), wBase);
          const b4 = add(sub(pBase, wBase), sx);
          const t1 = add(add(pTip, scale(sx, 0.1)), wTip);
          const t2 = add(sub(pTip, scale(sx, 0.1)), wTip);
          const t3 = sub(sub(pTip, scale(sx, 0.1)), wTip);
          const t4 = add(sub(pTip, wTip), scale(sx, 0.1));
          const pts = [b1, b2, b3, b4, t1, t2, t3, t4];
          for (let p of pts) {
            rawV.push(...p);
            rawC.push(...color);
          }
          const indices = [
            0,3,2, 0,2,1,
            4,5,6, 4,6,7,
            0,1,5, 0,5,4,
            3,7,6, 3,6,2,
            0,4,7, 0,7,3,
            1,2,6, 1,6,5
          ];
          for (let idx of indices) rawI.push(vBaseIdx + idx);
        };

        if (toolType === "BRANCH") {
          buildTaperedSegment([-0.080, 0, 0], [0.260, 0, 0], 0.016, 0.008, 5, [0.45, 0.3, 0.15], rawV, rawC, rawI, true);
          return;
        }
        const handleColor = [0.4, 0.25, 0.15];
        const bladeColor = [0.65, 0.65, 0.65];
        if (toolType === "AXE") {
          buildTaperedSegment([-0.065, 0, 0], [0.215, 0, 0], 0.0115, 0.0115, 5, handleColor, rawV, rawC, rawI);
          addWedgeLocal([0.175, 0, 0], [0.175, 0.115, 0], 0.04, 0.08, 0.01, bladeColor, [0, 0, 1]);
        } else if (toolType === "PICKAXE") {
          buildTaperedSegment([-0.065, 0, 0], [0.215, 0, 0], 0.0115, 0.0115, 5, handleColor, rawV, rawC, rawI);
          addWedgeLocal([0.180, 0, 0], [0.180, 0.115, 0], 0.03, 0.005, 0.01, bladeColor, [0, 0, 1]);
          addWedgeLocal([0.180, 0, 0], [0.180, -0.115, 0], 0.03, 0.005, 0.01, bladeColor, [0, 0, 1]);
        } else if (toolType === "SHOVEL") {
          buildTaperedSegment([-0.055, 0, 0], [0.235, 0, 0], 0.0115, 0.0115, 5, handleColor, rawV, rawC, rawI);
          const shovelPartsColor = [0.25, 0.25, 0.25];
          const wD1 = [-0.055, 0, 0];
          const wD2 = [-0.090, 0, 0];
          const wLeft = [-0.125, 0, 0.036];
          const wRight = [-0.125, 0, -0.036];
          buildTaperedSegment(wD1, wD2, 0.0105, 0.0105, 5, shovelPartsColor, rawV, rawC, rawI);
          buildTaperedSegment(wD2, wLeft, 0.009, 0.009, 4, shovelPartsColor, rawV, rawC, rawI);
          buildTaperedSegment(wD2, wRight, 0.009, 0.009, 4, shovelPartsColor, rawV, rawC, rawI);
          buildTaperedSegment(wLeft, wRight, 0.010, 0.010, 5, shovelPartsColor, rawV, rawC, rawI);
          const wBladeBase = [0.235, 0, 0];
          const wBladeTip = [0.395, 0, 0];
          const wBladeSocketEnd = [0.235 + (0.395 - 0.235) * 0.2, 0, 0];
          const wBladeMid = [0.235 + (0.395 - 0.235) * 0.65, 0, 0];
          buildTaperedSegment(wBladeBase, wBladeSocketEnd, 0.014, 0.014, 5, [0.35, 0.35, 0.35], rawV, rawC, rawI);
          addWedgeLocal(wBladeSocketEnd, wBladeMid, 0.07, 0.065, 0.012, bladeColor, [0, 1, 0]);
          addWedgeLocal(wBladeMid, wBladeTip, 0.065, 0.01, 0.01, bladeColor, [0, 1, 0]);
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
          _lastChibiEquipSig = null;
          return;
        }
        const model = window.chibiGlbModel;
        const itemScale = (typeof playerScale !== 'undefined' ? playerScale : 0.1) / 0.1;
        const scale = 0.59;
        let yOffset = -0.46;
        if (typeof activeRidingBoat !== "undefined" && activeRidingBoat) yOffset = -0.15;
        else if (typeof activeRidingMech !== "undefined" && activeRidingMech) yOffset = -0.15;
        else if (typeof currentSwimFactor !== "undefined" && currentSwimFactor > 0) yOffset = -0.46 - currentSwimFactor * 0.12;

        const rFA = model.nodes.find(n => n && n.name === "RightForeArm");
        const rH = model.nodes.find(n => n && n.name === "RightHand");
        const pElbow = (rFA && rFA.matrix) ? [ rFA.matrix[12] * scale, rFA.matrix[13] * scale + yOffset, rFA.matrix[14] * scale ] : [0, yOffset, 0];
        let pHand = (rH && rH.matrix) ? [ rH.matrix[12] * scale, rH.matrix[13] * scale + yOffset, rH.matrix[14] * scale ] : [0.15 * itemScale, -0.09 + yOffset, 0.02 * itemScale];

        if (heldItem.name === "WOODEN_ARM_CANNON" || heldItem.name === "ARM_CANNON") {
          const isAimingRanged = (typeof isUsingItem !== "undefined" && isUsingItem) && (typeof window.isAimingBow !== "undefined" && window.isAimingBow);
          if (isAimingRanged && window.currentAimTargetPos && typeof getCharacterMatrix === "function" && rFA && rH && rFA.matrix && rH.matrix) {
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
          _updateArmCannonWorldAim(pElbow, pHand, itemScale * 0.85);
        }

        const aStChibi = (typeof window.aegisShiftState === "object") ? window.aegisShiftState : null;
        const chibiAegisMode = (aStChibi && (aStChibi.mode === "charging" || aStChibi.mode === "dashing" || aStChibi.mode === "post_skill"))
          ? "greatsword"
          : ((aStChibi && aStChibi.toolMode === "axe") ? "axe" : "pickaxe");
        const bScoop = (typeof window.bucketScoopTimer === "number" && window.bucketScoopTimer > 0) ? window.bucketScoopTimer : 0;
        const bWater = (typeof window.bucketWaterTimer === "number" && window.bucketWaterTimer > 0) ? window.bucketWaterTimer : 0;
        const hasArrowInCannon = (!arrowShotInCurrentAnim && useAnimTimer > 0) ? 1 : 0;

        if (_lastEquipRenderMode === "chibi" && equipIndicesLength > 0 && _lastChibiEquipSig && bScoop === 0 && bWater === 0) {
          const s = _lastChibiEquipSig;
          if (
            s.name === heldItem.name &&
            s.aegisMode === chibiAegisMode &&
            s.hasWater === !!heldItem.hasWater &&
            s.hasArrow === hasArrowInCannon &&
            Math.abs(s.scale - itemScale) < 1e-5 &&
            Math.abs(s.ex - pElbow[0]) < 1e-5 &&
            Math.abs(s.ey - pElbow[1]) < 1e-5 &&
            Math.abs(s.ez - pElbow[2]) < 1e-5 &&
            Math.abs(s.hx - pHand[0]) < 1e-5 &&
            Math.abs(s.hy - pHand[1]) < 1e-5 &&
            Math.abs(s.hz - pHand[2]) < 1e-5
          ) {
            return;
          }
        }
        _lastEquipRenderMode = "chibi";
        _lastChibiEquipSig = {
          name: heldItem.name,
          aegisMode: chibiAegisMode,
          hasWater: !!heldItem.hasWater,
          hasArrow: hasArrowInCannon,
          scale: itemScale,
          ex: pElbow[0], ey: pElbow[1], ez: pElbow[2],
          hx: pHand[0], hy: pHand[1], hz: pHand[2]
        };

        let flatEquip = null;
        const rawV = [], rawC = [], rawI = [];

        if (!isRag && heldItem && (heldItem.name === "WOODEN_ARM_CANNON" || heldItem.name === "ARM_CANNON")) {
          if (rFA && rH && rFA.matrix && rH.matrix) {
            buildWoodenArmCannonMesh(pElbow, pHand, rawV, rawC, rawI, itemScale * 0.85);
          }
        } else if (!isRag && heldItem && (heldItem.name === "IRON_BUCKET" || heldItem.name === "iron_bucket" || heldItem.name === "WATER_BUCKET" || heldItem.name === "water_bucket" || (typeof window.bucketWaterTimer === "number" && window.bucketWaterTimer > 0)) && typeof window.buildIronBucketModel === "function") {
          buildHeldIronBucketMesh(pHand, itemScale, heldItem, rawV, rawC, rawI);
        } else if (!isRag && heldItem && (heldItem.name === "TANTO" || heldItem.name === "tanto") && typeof window.buildTantoModel === "function") {
          if (rFA && rH && rFA.matrix && rH.matrix) {
            const dx = pHand[0] - pElbow[0], dy = pHand[1] - pElbow[1], dz = pHand[2] - pElbow[2];
            const dLen = Math.hypot(dx, dy, dz) || 1.0;
            const dArm = [dx / dLen, dy / dLen, dz / dLen];
            let palmIn = [-0.85, -0.15, -0.45];
            const dotIn = palmIn[0] * dArm[0] + palmIn[1] * dArm[1] + palmIn[2] * dArm[2];
            palmIn = [palmIn[0] - dArm[0] * dotIn, palmIn[1] - dArm[1] * dotIn, palmIn[2] - dArm[2] * dotIn];
            const pLen = Math.hypot(palmIn[0], palmIn[1], palmIn[2]) || 1.0;
            palmIn = [palmIn[0] / pLen, palmIn[1] / pLen, palmIn[2] / pLen];
            let rKnuckle = [
              palmIn[1] * dArm[2] - palmIn[2] * dArm[1],
              palmIn[2] * dArm[0] - palmIn[0] * dArm[2],
              palmIn[0] * dArm[1] - palmIn[1] * dArm[0]
            ];
            const rkLen = Math.hypot(rKnuckle[0], rKnuckle[1], rKnuckle[2]) || 1.0;
            rKnuckle = [rKnuckle[0] / rkLen, rKnuckle[1] / rkLen, rKnuckle[2] / rkLen];
            const gripCenter = [
              pHand[0] + dArm[0] * 0.032 * itemScale + palmIn[0] * 0.014 * itemScale,
              pHand[1] + dArm[1] * 0.032 * itemScale + palmIn[1] * 0.014 * itemScale,
              pHand[2] + dArm[2] * 0.032 * itemScale + palmIn[2] * 0.014 * itemScale
            ];
            flatEquip = _getTransformedHeldFlatEquip(
              "TANTO",
              (v, c, idx) => window.buildTantoModel(1.0, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], v, c, idx),
              gripCenter, rKnuckle, dArm, palmIn, 0.28 * itemScale, false
            );
          }
        } else if (!isRag && heldItem && (heldItem.name === "AEGIS_SHIFT" || heldItem.name === "aegis_shift") && typeof window.buildAegisShiftModel === "function") {
          if (rFA && rH && rFA.matrix && rH.matrix) {
            const dx = pHand[0] - pElbow[0], dy = pHand[1] - pElbow[1], dz = pHand[2] - pElbow[2];
            const dLen = Math.hypot(dx, dy, dz) || 1.0;
            const dArm = [dx / dLen, dy / dLen, dz / dLen];
            let palmIn = [-0.85, -0.15, -0.45];
            const dotIn = palmIn[0] * dArm[0] + palmIn[1] * dArm[1] + palmIn[2] * dArm[2];
            palmIn = [palmIn[0] - dArm[0] * dotIn, palmIn[1] - dArm[1] * dotIn, palmIn[2] - dArm[2] * dotIn];
            const pLen = Math.hypot(palmIn[0], palmIn[1], palmIn[2]) || 1.0;
            palmIn = [palmIn[0] / pLen, palmIn[1] / pLen, palmIn[2] / pLen];
            let rKnuckle = [
              palmIn[1] * dArm[2] - palmIn[2] * dArm[1],
              palmIn[2] * dArm[0] - palmIn[0] * dArm[2],
              palmIn[0] * dArm[1] - palmIn[1] * dArm[0]
            ];
            const rkLen = Math.hypot(rKnuckle[0], rKnuckle[1], rKnuckle[2]) || 1.0;
            rKnuckle = [rKnuckle[0] / rkLen, rKnuckle[1] / rkLen, rKnuckle[2] / rkLen];
            const gripCenter = [
              pHand[0] + dArm[0] * 0.032 * itemScale + palmIn[0] * 0.014 * itemScale,
              pHand[1] + dArm[1] * 0.032 * itemScale + palmIn[1] * 0.014 * itemScale,
              pHand[2] + dArm[2] * 0.032 * itemScale + palmIn[2] * 0.014 * itemScale
            ];
            flatEquip = _getTransformedHeldFlatEquip(
              "AEGIS_SHIFT:" + chibiAegisMode,
              (v, c, idx) => window.buildAegisShiftModel(1.0, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], v, c, idx, chibiAegisMode),
              gripCenter, rKnuckle, dArm, palmIn, 0.32 * itemScale, false
            );
          }
        }

        if (!flatEquip && rawI.length > 0) {
          flatEquip = makeFlatShadedGeometry(rawV, rawC, rawI);
        }

        if (flatEquip && flatEquip.indices && flatEquip.indices.length > 0) {
          _uploadFlatEquipToGL(activeGl, flatEquip);
        } else {
          equipIndicesLength = 0;
        }
      }
      window.updateChibiEquipMesh = updateChibiEquipMesh;

      function updateCharacterMesh(phase, isClone = false, cloneWalkBlend = 1.0, cloneSwimFactor = 0.0, cloneSwimMove = 0.0, cloneState = null) {
        const activeGl = (typeof gl !== "undefined" && gl) || (typeof window !== "undefined" && window.gl ? window.gl : null);
        if (!activeGl) return;
        if (typeof gl === "undefined" || !gl) gl = activeGl;
        if (typeof window !== "undefined" && !window.GLB_DISABLED && window.characterModel === "chibi" && !isClone) {
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

        const heldItem = isClone
          ? (cloneState && cloneState.activeItem
              ? cloneState.activeItem
              : (cloneState && cloneState.equippedTool ? { name: cloneState.equippedTool } : null))
          : getHeldItem();
        const effectiveRidingBoat = isClone
          ? (cloneState && cloneState.ridingBoat && cloneState.ridingBoat.active ? cloneState.ridingBoat : null)
          : (typeof activeRidingBoat !== "undefined" ? activeRidingBoat : null);
        const effectiveUseAnimTimer = isClone
          ? (cloneState && typeof cloneState.actionAnim === "number" ? cloneState.actionAnim : 0)
          : (typeof useAnimTimer !== "undefined" ? useAnimTimer : 0);
        const effectiveIsUsingItem = isClone
          ? (effectiveUseAnimTimer > 0)
          : (typeof isUsingItem !== "undefined" && isUsingItem);
        const effectiveArrowShot = isClone
          ? !!(cloneState && cloneState.arrowShotInCurrentAnim)
          : (typeof arrowShotInCurrentAnim !== "undefined" && !!arrowShotInCurrentAnim);
        const effectiveBowCombo = isClone
          ? !!(cloneState && cloneState.bowComboActive)
          : (typeof bowComboActive !== "undefined" && !!bowComboActive);
        const effectiveLastBowDrawPower = isClone
          ? (cloneState && typeof cloneState.lastBowDrawPower === "number" ? cloneState.lastBowDrawPower : 1.0)
          : (typeof lastBowDrawPower !== "undefined" ? lastBowDrawPower : 1.0);
        const effectiveLastBowShootTime = isClone
          ? (cloneState && cloneState.lastBowShootTime ? cloneState.lastBowShootTime : 0)
          : (typeof lastBowShootTime !== "undefined" ? lastBowShootTime : 0);
        const effectiveBowHoldArmTimer = (typeof bowHoldArmTimer !== "undefined" ? bowHoldArmTimer : 0.6);

        // Clothing & Hair LOD quantization + Shared Clone Outfit GPU Buffer Cache check
        const cloneLodInfo = (isClone && cloneState && cloneState._lodInfo)
          ? cloneState._lodInfo
          : ((isClone && cloneState && typeof cloneState._lod === "number")
              ? (cloneState._lod === 2
                  ? { lod: 2, phaseBuckets: 8, walkBuckets: 2, updateStride: 6, enableSpringPhysics: false, enableBodyCollider: false, enableHairSway: false, enableHairBodyCollider: false }
                  : (cloneState._lod === 1
                      ? { lod: 1, phaseBuckets: 16, walkBuckets: 4, updateStride: 2, enableSpringPhysics: false, enableBodyCollider: false, enableHairSway: true, enableHairBodyCollider: false }
                      : null))
              : null);
        const cloneLodLevel = cloneLodInfo ? cloneLodInfo.lod : 0;

        if (isClone && cloneLodInfo && cloneLodLevel >= 1) {
          if (typeof window !== "undefined" && typeof window.quantizePhaseForLOD === "function") {
            phase = window.quantizePhaseForLOD(phase, cloneLodInfo);
            cloneWalkBlend = window.quantizeBlendForLOD(cloneWalkBlend, cloneLodInfo.walkBuckets);
          } else {
            const tau = Math.PI * 2.0;
            let wPh = (phase || 0.0) % tau;
            if (wPh < 0.0) wPh += tau;
            const pb = cloneLodInfo.phaseBuckets || 8;
            const step = tau / pb;
            phase = (Math.round(wPh / step) % pb) * step;
            const wb = cloneLodInfo.walkBuckets || 2;
            cloneWalkBlend = Math.round(Math.max(0.0, Math.min(1.0, cloneWalkBlend)) * wb) / wb;
          }
          if (cloneWalkBlend <= 0.001) {
            phase = 0.0;
          }
        }

        const isCloneIdleSettled = isClone && cloneWalkBlend <= 0.01 && cloneSwimFactor <= 0.01 && !effectiveRidingBoat && (!heldItem || effectiveUseAnimTimer <= 0.01);
        const canUseSharedCloneBodyCache = !!(isClone && cloneState && !effectiveRidingBoat && (cloneLodLevel >= 1 || isCloneIdleSettled));
        let cloneBodyCacheKey = null;
        if (canUseSharedCloneBodyCache) {
          if (!window._cloneBodyBufferCache) window._cloneBodyBufferCache = new Map();
          const eqStateCl = (typeof window.getCharacterEquippedClothingState === "function")
            ? window.getCharacterEquippedClothingState(true)
            : null;
          const eqKeyCl = (eqStateCl && eqStateCl.key) ? eqStateCl.key : "clone_default";
          const hoodFlagCl = (cloneState && cloneState.hoodOpen) ? 1 : 0;
          const tau = Math.PI * 2.0;
          let wPhCl = (phase || 0.0) % tau;
          if (wPhCl < 0.0) wPhCl += tau;
          const phQ = (cloneWalkBlend <= 0.01) ? 0 : Math.round(wPhCl * 100);
          const wkQ = Math.round(cloneWalkBlend * 20);
          const swQ = Math.round(cloneSwimFactor * 10);
          const swmQ = Math.round(cloneSwimMove * 10);
          const heldKey = heldItem ? (String(heldItem.name || "item") + "_" + Math.round(effectiveUseAnimTimer * 10)) : "none";
          const brBucket = (cloneLodLevel >= 1) ? 0 : Math.round((Math.sin(waterAnimTime * 2.5) + 1.0) * 6);
          const scQ = Math.round(((typeof charScale === "number" ? charScale : 0.1) || 0.1) * 1000);
          cloneBodyCacheKey = `cb_${eqKeyCl}_${hoodFlagCl}_${cloneLodLevel}_${phQ}_${wkQ}_${swQ}_${swmQ}_${heldKey}_${brBucket}_${scQ}`;

          const cachedCloneBuf = window._cloneBodyBufferCache.get(cloneBodyCacheKey);
          if (cachedCloneBuf && cachedCloneBuf.vertexBuffer && cachedCloneBuf.indexBuffer) {
            window._cloneBodyBufferCache.delete(cloneBodyCacheKey);
            window._cloneBodyBufferCache.set(cloneBodyCacheKey, cachedCloneBuf);
            cloneState._meshBuffers = cachedCloneBuf;
            cloneState._headP1 = cachedCloneBuf.headP1 || cloneState._headP1 || [0, 0.23, 0];
            cloneState._scale = cachedCloneBuf.scale || cloneState._scale || 1.0;
            cloneState._phase = phase;
            cloneState._walkBlend = cloneWalkBlend;
            cloneState._animTick = (cloneState._animTick || 0) + 1;
            if (!window.cloneMeshBuffers) {
              window.cloneMeshBuffers = cachedCloneBuf;
            }
            return;
          }
        }

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
        const cloneBreathPhase = (isClone && cloneLodLevel >= 2)
          ? 0.0
          : ((isClone && cloneLodLevel === 1)
              ? (Math.round(((waterAnimTime * 2.5) % (Math.PI * 2.0)) * 2.0) * 0.5)
              : (canUseSharedCloneBodyCache
                  ? (Math.round(((waterAnimTime * 2.5) % (Math.PI * 2.0)) * 4.0) * 0.25)
                  : (waterAnimTime * 2.5)));
        let bOffset = (isPlayerRagdoll || (isClone && cloneLodLevel >= 2))
          ? 0.0
          : Math.sin(isClone ? cloneBreathPhase : (waterAnimTime * 2.5)) * 0.006;
        const bRadius = (isPlayerRagdoll || (isClone && cloneLodLevel >= 2))
          ? 0.0
          : Math.sin(isClone ? cloneBreathPhase : (waterAnimTime * 2.5)) * 0.002;

        const shirasayaSt = (!isClone && !isPlayerRagdoll && heldItem && (heldItem.name === "TANTO" || heldItem.name === "tanto") && typeof window !== "undefined" && window.tantoShirasayaState && window.tantoShirasayaState.mode !== "idle")
          ? window.tantoShirasayaState
          : null;
        const shirasayaMode = shirasayaSt ? shirasayaSt.mode : "idle";
        const shirasayaStep = shirasayaSt ? (shirasayaSt.comboStep || 1) : 1;
        const shirasayaDashProg = (shirasayaMode === "dashing" && shirasayaSt)
          ? (1.0 - Math.max(0.0, Math.min(1.0, (shirasayaSt.dashTimer || 0.0) / Math.max(0.01, shirasayaSt.dashDuration || 0.27))))
          : 0.0;

        const aegisSt = (!isClone && !isPlayerRagdoll && heldItem && (heldItem.name === "AEGIS_SHIFT" || heldItem.name === "aegis_shift") && typeof window !== "undefined" && window.aegisShiftState && window.aegisShiftState.mode !== "idle")
          ? window.aegisShiftState
          : null;
        const aegisMode = aegisSt ? aegisSt.mode : "idle";
        const aegisStep = aegisSt ? (aegisSt.comboStep || 1) : 1;
        const aegisDashProg = (aegisMode === "dashing" && aegisSt)
          ? (1.0 - Math.max(0.0, Math.min(1.0, (aegisSt.dashTimer || 0.0) / Math.max(0.01, aegisSt.dashDuration || 0.38))))
          : 0.0;
        const activeSkillMode = shirasayaSt ? shirasayaMode : aegisMode;

        let shiraMem = null;
        let shiraDt = 0.016;
        if (!isClone && !isPlayerRagdoll && typeof window !== "undefined") {
          if (!window._shiraPoseMem) {
            window._shiraPoseMem = { initialized: false, armsInit: false, bladeInit: false, idleFade: 0.0, lastKey: "", transTimer: 0.0, lastMs: performance.now() };
          }
          shiraMem = window._shiraPoseMem;
          const nowMs = performance.now();
          const elSec = (nowMs - (shiraMem.lastMs || nowMs)) / 1000.0;
          shiraMem.lastMs = nowMs;
          shiraDt = (elSec > 0.0005) ? Math.min(0.05, elSec) : 0.0;
          const curKey = aegisSt ? `aegis_${aegisMode}_${aegisStep}` : `${shirasayaMode}_${shirasayaStep}`;
          if (activeSkillMode !== "idle") {
            if (shiraMem.lastKey !== curKey) {
              shiraMem.transTimer = 0.14;
              shiraMem.lastKey = curKey;
            }
            shiraMem.transTimer = Math.max(0.0, shiraMem.transTimer - shiraDt);
            shiraMem.idleFade = 1.0;
          } else {
            shiraMem.lastKey = "idle";
            if (shiraMem.initialized) {
              shiraMem.idleFade = Math.max(0.0, shiraMem.idleFade - shiraDt * 6.5);
              if (shiraMem.idleFade <= 0.001) {
                shiraMem.initialized = false;
                shiraMem.armsInit = false;
                shiraMem.bladeInit = false;
                shiraMem.wInit = false;
                shiraMem.wRInit = false;
              }
            }
          }
        }
        const shirasayaChargeEnv = (shirasayaMode === "charging" && shirasayaSt)
          ? Math.min(1.0, (shirasayaSt.chargeTime || 0.0) / 0.20)
          : 0.0;
        const shirasayaChargeSmooth = shirasayaChargeEnv * shirasayaChargeEnv * (3.0 - 2.0 * shirasayaChargeEnv);
        const aegisChargeEnv = (aegisMode === "charging" && aegisSt)
          ? Math.min(1.0, (aegisSt.chargeTime || 0.0) / 0.16)
          : 0.0;
        const aegisChargeSmooth = aegisChargeEnv * aegisChargeEnv * (3.0 - 2.0 * aegisChargeEnv);
        if (shirasayaMode === "charging") {
          bOffset -= 0.088 * shirasayaChargeSmooth;
        } else if (shirasayaMode === "dashing") {
          if (shirasayaStep === 1) {
            bOffset -= 0.062;
          } else if (shirasayaStep === 2) {
            bOffset -= 0.095;
          } else if (shirasayaStep === 3) {
            const curl = shiraSm(0.0, 0.25, shirasayaDashProg) * (1.0 - 0.55 * shiraSm(0.76, 1.0, shirasayaDashProg));
            bOffset += 0.028 * curl;
          } else {
            const drop = shiraSm(0.16, 0.34, shirasayaDashProg);
            bOffset -= 0.015 * (1.0 - drop) + 0.082 * drop;
          }
        } else if (aegisMode === "charging") {
          bOffset -= 0.055 * aegisChargeSmooth;
        } else if (aegisMode === "dashing") {
          if (aegisStep === 1) {
            const dropA = shiraSm(0.14, 0.42, aegisDashProg);
            const settleA = shiraSm(0.62, 1.0, aegisDashProg);
            bOffset -= (0.024 * (1.0 - dropA) + 0.074 * dropA) * (1.0 - settleA) + 0.042 * settleA;
          } else if (aegisStep === 2) {
            const riseB = shiraSm(0.14, 0.56, aegisDashProg);
            bOffset -= 0.068 * (1.0 - riseB) + 0.014 * riseB;
          } else if (aegisStep === 3) {
            bOffset -= 0.052;
          } else {
            const up4 = shiraSm(0.0, 0.26, aegisDashProg);
            const slam4 = shiraSm(0.26, 0.52, aegisDashProg);
            bOffset += 0.018 * up4 * (1.0 - slam4) - 0.086 * slam4;
          }
        } else if (aegisMode === "post_skill") {
          bOffset -= 0.042;
        }

        let torsoTilt = 0.0;
        const walkScale = isClone ? cloneWalkBlend : 1.0;
        const armSwingAmp = 0.8; // Exact same swing amplitude for Player & Clones
        let armAngle = Math.sin(phase) * armSwingAmp * walkScale;
        let leftElbowFlex = 0.1 + Math.max(0, -armAngle * 0.5);
        let rightArmAngle = Math.sin(phase + Math.PI) * armSwingAmp * walkScale;
        let rightElbowFlex = 0.1 + Math.max(0, -rightArmAngle * 0.5);

        let legAngle = Math.sin(phase + Math.PI) * 0.6 * walkScale;
        let leftKneeFlex = 0.1 + Math.max(0, legAngle * 0.5);
        let rightLegAngle = Math.sin(phase) * 0.6 * walkScale;
        let rightKneeFlex = 0.1 + Math.max(0, rightLegAngle * 0.5);

        if (effectiveRidingBoat) {
          // Sitting and rowing pose (shared by player and clones)
          let isLandVehicle = effectiveRidingBoat.hasWheel || effectiveRidingBoat.hasWheels || (effectiveRidingBoat.wheelCount && effectiveRidingBoat.wheelCount > 0);
          if (isLandVehicle) {
            armAngle = -0.4;
            leftElbowFlex = 0.5;
            rightArmAngle = -0.4;
            rightElbowFlex = 0.5;
            torsoTilt = 0;
          } else {
            const rowPhase = isClone
              ? (cloneState && typeof cloneState.boatRowTimer === "number" ? cloneState.boatRowTimer : phase)
              : (typeof boatRowTimer !== "undefined" ? boatRowTimer : 0);
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
        
        const isBucketHeld = !!(heldItem && (
          heldItem.name === "IRON_BUCKET" || heldItem.name === "iron_bucket" ||
          heldItem.name === "WATER_BUCKET" || heldItem.name === "water_bucket"
        ));
        const activeBucketScoop = (!isClone && isBucketHeld && typeof window.bucketScoopTimer === "number" && window.bucketScoopTimer > 0) ? window.bucketScoopTimer : 0;
        const activeBucketWater = (!isClone && (isBucketHeld || (typeof window.bucketWaterTimer === "number" && window.bucketWaterTimer > 0)) && typeof window.bucketWaterTimer === "number" && window.bucketWaterTimer > 0) ? window.bucketWaterTimer : 0;
        let bucketArmAbduct = 0.0;
        let bucketArmYaw = 0.0;
        let waterPourEnv = 0.0;
        let waterTiltEnv = 0.0;
        let waterPourBob = 0.0;
        let waterAimYaw = 0.0;

        const isBareHandSwing = !!(
          !heldItem &&
          effectiveIsUsingItem &&
          effectiveUseAnimTimer > 0 &&
          (isClone || (typeof isSmashing !== "undefined" && isSmashing) || (typeof activeItem !== "undefined" && activeItem && activeItem.name === "HAND"))
        );

        if (heldItem || activeBucketWater > 0 || isBareHandSwing) {
             if (heldItem && heldItem.name === "BOW") {
                 if (effectiveIsUsingItem && effectiveUseAnimTimer > 0) {
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
             } else if (isBucketHeld || activeBucketWater > 0) {
                 if (activeBucketScoop > 0) {
                     // Chibi performs the 3-stage water scoop animation physically with torso & right arm
                     const t = 1.0 - Math.max(0.0, Math.min(1.0, activeBucketScoop));
                     if (t < 0.40) {
                         const s = Math.sin((t / 0.40) * (Math.PI * 0.5));
                         torsoTilt += 0.36 * s;
                         rightArmAngle = 0.04 * (1.0 - s) - 0.88 * s;
                         rightElbowFlex = 0.12 + 0.14 * s;
                         armAngle += 0.26 * s;
                         bucketArmAbduct = 0.15 * (1.0 - s);
                     } else if (t < 0.75) {
                         const u = (t - 0.40) / 0.35;
                         const su = u * u * (3.0 - 2.0 * u);
                         torsoTilt += 0.36 * (1.0 - su);
                         rightArmAngle = -0.88 * (1.0 - su) - 0.22 * su;
                         rightElbowFlex = 0.26 + 0.30 * Math.sin(u * Math.PI);
                         armAngle += 0.26 * (1.0 - su);
                         bucketArmAbduct = 0.15 * su;
                     } else {
                         const v = (t - 0.75) / 0.25;
                         const sv = v * v * (3.0 - 2.0 * v);
                         rightArmAngle = -0.22 * (1.0 - sv) + 0.04 * sv;
                         rightElbowFlex = 0.26 * (1.0 - sv) + 0.12 * sv;
                         bucketArmAbduct = 0.15;
                     }
                 } else if (activeBucketWater > 0) {
                     // Two-handed pour envelope: lift bucket above planter rim, tilt & pour, return smoothly to carry pose
                     const tw = 1.0 - Math.max(0.0, Math.min(1.0, activeBucketWater));
                     if (tw < 0.28) {
                         const s = Math.sin((tw / 0.28) * (Math.PI * 0.5));
                         waterPourEnv = s;
                         waterTiltEnv = s * s;
                     } else if (tw <= 0.75) {
                         const u = (tw - 0.28) / 0.47;
                         waterPourEnv = 1.0;
                         waterTiltEnv = 1.0;
                         waterPourBob = Math.sin(u * Math.PI * 2.0) * 0.06;
                     } else {
                         const v = (tw - 0.75) / 0.25;
                         const sv = v * v * (3.0 - 2.0 * v);
                         waterPourEnv = 1.0 - sv;
                         waterTiltEnv = 1.0 - sv;
                     }
                     torsoTilt += 0.12 * waterPourEnv;
                     rightArmAngle = rightArmAngle * 0.25 + 0.04;
                     rightElbowFlex = 0.12;
                     bucketArmAbduct = 0.15 * (1.0 - waterPourEnv);

                     if (window.activeWateringAnimPlanter && window.activeWateringAnimPlanter.position && typeof getCharacterMatrix === "function") {
                         const planterPos = window.activeWateringAnimPlanter.position;
                         const charMat = getCharacterMatrix();
                         const cScale = Math.hypot(charMat[0], charMat[1], charMat[2]) || 0.1;
                         const dxW = planterPos[0] - charMat[12];
                         const dyW = planterPos[1] - charMat[13];
                         const dzW = planterPos[2] - charMat[14];
                         const localX = (dxW * (charMat[0] / cScale) + dyW * (charMat[1] / cScale) + dzW * (charMat[2] / cScale)) / cScale;
                         const localZ = (dxW * (charMat[8] / cScale) + dyW * (charMat[9] / cScale) + dzW * (charMat[10] / cScale)) / cScale;
                         const aimYaw = Math.atan2(localX, Math.max(0.15, localZ));
                         waterAimYaw = Math.max(-0.65, Math.min(0.65, aimYaw)) * waterPourEnv;
                     }
                 } else {
                     // Natural lowered carry pose: relax arm down along side with gentle damped walk sway
                     rightArmAngle = rightArmAngle * 0.25 + 0.04;
                     rightElbowFlex = 0.12;
                     bucketArmAbduct = 0.15;
                 }
             } else {
                 if (effectiveIsUsingItem && effectiveUseAnimTimer > 0) {
                     // Swing animation for bare-hand / axe / pickaxe / shovel / items (quantized to 24 steps for smooth cloth-cache reuse)
                     let swingPhase = Math.round(effectiveUseAnimTimer * 24) / 24;
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

        let legAngleSide = 0.0;
        let rightLegAngleSide = 0.0;
        if (shirasayaMode === "charging") {
          torsoTilt = torsoTilt * (1.0 - shirasayaChargeSmooth) + 0.22 * shirasayaChargeSmooth;
          legAngle = legAngle * (1.0 - shirasayaChargeSmooth) + 0.58 * shirasayaChargeSmooth;
          leftKneeFlex = leftKneeFlex * (1.0 - shirasayaChargeSmooth) + 0.88 * shirasayaChargeSmooth;
          rightLegAngle = rightLegAngle * (1.0 - shirasayaChargeSmooth) - 0.72 * shirasayaChargeSmooth;
          rightKneeFlex = rightKneeFlex * (1.0 - shirasayaChargeSmooth) + 1.05 * shirasayaChargeSmooth;
          legAngleSide = -0.32 * shirasayaChargeSmooth;
          rightLegAngleSide = 0.28 * shirasayaChargeSmooth;
        } else if (shirasayaMode === "dashing") {
          if (shirasayaStep === 1) {
            const p1 = shiraSm(0.0, 0.35, shirasayaDashProg);
            torsoTilt = 0.28 + 0.16 * p1;
            legAngle = 0.65 + 0.16 * p1;
            leftKneeFlex = 0.62 - 0.18 * p1;
            rightLegAngle = -0.74 - 0.10 * p1;
            rightKneeFlex = 0.98;
            legAngleSide = -0.15;
            rightLegAngleSide = 0.15;
          } else if (shirasayaStep === 2) {
            // Skill 2 (Panel 1): deep low forward lunge, back leg stretched straight behind, front knee deeply bent
            const p2 = shiraSm(0.0, 0.42, shirasayaDashProg);
            torsoTilt = 0.44 + 0.16 * p2;
            legAngle = 0.85 + 0.24 * p2;
            leftKneeFlex = 0.32 - 0.20 * p2;
            rightLegAngle = -0.92 - 0.20 * p2;
            rightKneeFlex = 1.05 + 0.24 * p2;
            legAngleSide = -0.18;
            rightLegAngleSide = 0.16;
          } else if (shirasayaStep === 3) {
            // Skill 3 (Panel 2): mid-air spinning cyclone — curl knee up then prepare landing into Step 4
            const prepLand = shiraSm(0.75, 1.0, shirasayaDashProg);
            torsoTilt = 0.14 + 0.06 * prepLand;
            legAngle = -1.32 * (1.0 - 0.55 * prepLand);
            leftKneeFlex = 1.72 * (1.0 - 0.45 * prepLand);
            rightLegAngle = 0.28 * (1.0 - 0.70 * prepLand);
            rightKneeFlex = 0.52 + 0.25 * prepLand;
            legAngleSide = -0.16;
            rightLegAngleSide = 0.22;
          } else {
            // Skill 4 (Panel 3): heavy overhead windup -> planted forward ground slam cleave -> subtle recovery
            const slamT = shiraSm(0.16, 0.36, shirasayaDashProg);
            const recT = shiraSm(0.80, 1.0, shirasayaDashProg);
            torsoTilt = 0.16 * (1.0 - slamT) + 0.52 * slamT - 0.12 * recT;
            legAngle = 0.88 - 0.18 * recT;
            leftKneeFlex = 0.22 + 0.15 * recT;
            rightLegAngle = -0.96 + 0.20 * recT;
            rightKneeFlex = 1.15 - 0.18 * recT;
            legAngleSide = -0.20;
            rightLegAngleSide = 0.18;
          }
        } else if (shirasayaMode === "post_skill") {
          // Relax anatomical left arm at side while anatomical right arm holds reverse-grip Shirasaya
          rightArmAngle = 0.08;
          rightElbowFlex = 0.15;
          armAngle = -0.38;
          leftElbowFlex = 0.62;
        } else if (aegisMode === "charging") {
          const sA = aegisChargeSmooth;
          torsoTilt = torsoTilt * (1.0 - sA) + 0.24 * sA;
          legAngle = legAngle * (1.0 - sA) + 0.48 * sA;
          leftKneeFlex = leftKneeFlex * (1.0 - sA) + 0.72 * sA;
          rightLegAngle = rightLegAngle * (1.0 - sA) - 0.56 * sA;
          rightKneeFlex = rightKneeFlex * (1.0 - sA) + 0.85 * sA;
          legAngleSide = -0.22 * sA;
          rightLegAngleSide = 0.22 * sA;
        } else if (aegisMode === "dashing") {
          if (aegisStep === 1) {
            const cleaveBodyT = shiraSm(0.14, 0.44, aegisDashProg);
            const settleBodyT = shiraSm(0.62, 1.0, aegisDashProg);
            const lungeTorso = 0.14 * (1.0 - cleaveBodyT) + 0.48 * cleaveBodyT;
            const lungeLeftLeg = 0.45 * (1.0 - cleaveBodyT) + 0.86 * cleaveBodyT;
            const lungeLeftKnee = 0.45 - 0.18 * cleaveBodyT;
            const lungeRightLeg = -0.52 * (1.0 - cleaveBodyT) - 0.88 * cleaveBodyT;
            const lungeRightKnee = 0.72 + 0.34 * cleaveBodyT;
            torsoTilt = lungeTorso * (1.0 - settleBodyT) + 0.26 * settleBodyT;
            legAngle = lungeLeftLeg * (1.0 - settleBodyT) - 0.30 * settleBodyT;
            leftKneeFlex = lungeLeftKnee * (1.0 - settleBodyT) + 0.36 * settleBodyT;
            rightLegAngle = lungeRightLeg * (1.0 - settleBodyT) + 0.14 * settleBodyT;
            rightKneeFlex = lungeRightKnee * (1.0 - settleBodyT) + 0.16 * settleBodyT;
            legAngleSide = -0.16 * (1.0 - settleBodyT) - 0.21 * settleBodyT;
            rightLegAngleSide = 0.16 * (1.0 - settleBodyT) + 0.20 * settleBodyT;
          } else if (aegisStep === 2) {
            // Skill 2 (Ref Figure 2): Low coiled right lunge -> Rising diagonal upward slash
            const riseBodyT = shiraSm(0.14, 0.56, aegisDashProg);
            torsoTilt = 0.34 * (1.0 - riseBodyT) + 0.12 * riseBodyT;
            legAngle = 0.62 * (1.0 - riseBodyT) + 0.38 * riseBodyT;
            leftKneeFlex = 0.72 * (1.0 - riseBodyT) + 0.42 * riseBodyT;
            rightLegAngle = -0.68 * (1.0 - riseBodyT) - 0.46 * riseBodyT;
            rightKneeFlex = 0.85 * (1.0 - riseBodyT) + 0.52 * riseBodyT;
            legAngleSide = -0.22;
            rightLegAngleSide = 0.22;
          } else if (aegisStep === 3) {
            // Skill 3 (Ref Figure 3): Wide grounded stance sweeping horizontal cleave across waist
            const swBody3 = shiraSm(0.14, 0.58, aegisDashProg);
            torsoTilt = 0.16 + 0.08 * swBody3;
            legAngle = -0.36;
            leftKneeFlex = 0.42;
            rightLegAngle = 0.28;
            rightKneeFlex = 0.36;
            legAngleSide = -0.25;
            rightLegAngleSide = 0.25;
          } else {
            // Skill 4 (Ref Figure 4): Overhead windup raise -> Heavy vertical ground slam -> settle
            const raiseBody4 = shiraSm(0.0, 0.26, aegisDashProg);
            const slamBody4 = shiraSm(0.26, 0.52, aegisDashProg);
            const recBody4 = shiraSm(0.76, 1.0, aegisDashProg);
            torsoTilt = (-0.06 * raiseBody4) * (1.0 - slamBody4) + (0.50 * slamBody4) * (1.0 - recBody4) + 0.26 * recBody4;
            legAngle = (0.35 * (1.0 - slamBody4) + 0.86 * slamBody4) * (1.0 - recBody4) - 0.30 * recBody4;
            leftKneeFlex = (0.45 * (1.0 - slamBody4) + 0.28 * slamBody4) * (1.0 - recBody4) + 0.36 * recBody4;
            rightLegAngle = (-0.42 * (1.0 - slamBody4) - 0.92 * slamBody4) * (1.0 - recBody4) + 0.14 * recBody4;
            rightKneeFlex = (0.52 * (1.0 - slamBody4) + 1.08 * slamBody4) * (1.0 - recBody4) + 0.16 * recBody4;
            legAngleSide = -0.20;
            rightLegAngleSide = 0.20;
          }
        } else if (aegisMode === "post_skill") {
          // Two-handed heavy greatsword stance: wide braced legs, bent knees, slight forward lean supporting heavy blade
          torsoTilt = 0.26;
          legAngle = -0.30;
          leftKneeFlex = 0.36;
          rightLegAngle = 0.14;
          rightKneeFlex = 0.16;
          legAngleSide = -0.21;
          rightLegAngleSide = 0.20;
        }

        if (shiraMem && (activeSkillMode !== "idle" || shiraMem.idleFade > 0.001)) {
          if (activeSkillMode !== "idle") {
            const bodyRate = (activeSkillMode === "dashing") ? 95.0 : 15.0;
            const kB = (shiraDt > 0) ? (1.0 - Math.exp(-shiraDt * bodyRate)) : 1.0;
            if (!shiraMem.initialized) {
              shiraMem.bOffset = bOffset;
              shiraMem.torsoTilt = torsoTilt;
              shiraMem.legAngle = legAngle;
              shiraMem.leftKneeFlex = leftKneeFlex;
              shiraMem.rightLegAngle = rightLegAngle;
              shiraMem.rightKneeFlex = rightKneeFlex;
              shiraMem.legAngleSide = legAngleSide;
              shiraMem.rightLegAngleSide = rightLegAngleSide;
              shiraMem.armAngle = armAngle;
              shiraMem.leftElbowFlex = leftElbowFlex;
              shiraMem.rightArmAngle = rightArmAngle;
              shiraMem.rightElbowFlex = rightElbowFlex;
              shiraMem.initialized = true;
            } else {
              shiraMem.bOffset += (bOffset - shiraMem.bOffset) * kB;
              shiraMem.torsoTilt += (torsoTilt - shiraMem.torsoTilt) * kB;
              shiraMem.legAngle += (legAngle - shiraMem.legAngle) * kB;
              shiraMem.leftKneeFlex += (leftKneeFlex - shiraMem.leftKneeFlex) * kB;
              shiraMem.rightLegAngle += (rightLegAngle - shiraMem.rightLegAngle) * kB;
              shiraMem.rightKneeFlex += (rightKneeFlex - shiraMem.rightKneeFlex) * kB;
              shiraMem.legAngleSide += (legAngleSide - shiraMem.legAngleSide) * kB;
              shiraMem.rightLegAngleSide += (rightLegAngleSide - shiraMem.rightLegAngleSide) * kB;
              shiraMem.armAngle += (armAngle - shiraMem.armAngle) * kB;
              shiraMem.leftElbowFlex += (leftElbowFlex - shiraMem.leftElbowFlex) * kB;
              shiraMem.rightArmAngle += (rightArmAngle - shiraMem.rightArmAngle) * kB;
              shiraMem.rightElbowFlex += (rightElbowFlex - shiraMem.rightElbowFlex) * kB;
            }
            bOffset = shiraMem.bOffset;
            torsoTilt = shiraMem.torsoTilt;
            legAngle = shiraMem.legAngle;
            leftKneeFlex = shiraMem.leftKneeFlex;
            rightLegAngle = shiraMem.rightLegAngle;
            rightKneeFlex = shiraMem.rightKneeFlex;
            legAngleSide = shiraMem.legAngleSide;
            rightLegAngleSide = shiraMem.rightLegAngleSide;
            armAngle = shiraMem.armAngle;
            leftElbowFlex = shiraMem.leftElbowFlex;
            rightArmAngle = shiraMem.rightArmAngle;
            rightElbowFlex = shiraMem.rightElbowFlex;
          } else if (shiraMem.initialized) {
            // Smooth exit back into walk/idle stance when walking cancels post_skill
            const f = shiraMem.idleFade;
            bOffset = bOffset * (1.0 - f) + shiraMem.bOffset * f;
            torsoTilt = torsoTilt * (1.0 - f) + shiraMem.torsoTilt * f;
            legAngle = legAngle * (1.0 - f) + shiraMem.legAngle * f;
            leftKneeFlex = leftKneeFlex * (1.0 - f) + shiraMem.leftKneeFlex * f;
            rightLegAngle = rightLegAngle * (1.0 - f) + shiraMem.rightLegAngle * f;
            rightKneeFlex = rightKneeFlex * (1.0 - f) + shiraMem.rightKneeFlex * f;
            legAngleSide = legAngleSide * (1.0 - f) + shiraMem.legAngleSide * f;
            rightLegAngleSide = rightLegAngleSide * (1.0 - f) + shiraMem.rightLegAngleSide * f;
            armAngle = armAngle * (1.0 - f) + shiraMem.armAngle * f;
            leftElbowFlex = leftElbowFlex * (1.0 - f) + shiraMem.leftElbowFlex * f;
            rightArmAngle = rightArmAngle * (1.0 - f) + shiraMem.rightArmAngle * f;
            rightElbowFlex = rightElbowFlex * (1.0 - f) + shiraMem.rightElbowFlex * f;
          }
        }

        const isRiding = activeRidingBoat || (typeof activeRidingMech !== "undefined" && activeRidingMech);
        const hasUpperTilt = isRiding || Math.abs(torsoTilt) > 0.001;

        // Unified torso extends from pelvic floor / groin (-0.090) up to neck collar (0.170)
        chestP1 = [0, -0.090 + bOffset, 0];
        let defaultChestP2 = [0, 0.170 + bOffset, 0];
        chestP2 = hasUpperTilt ? rotatePointX(chestP1, defaultChestP2, torsoTilt) : defaultChestP2;
        
        pelvisP1 = [0, -0.090 + bOffset, 0];
        pelvisP2 = [0, -0.090 + bOffset, 0];
        
        let defaultNeckP1 = [0, 0.162 + bOffset, 0];
        let defaultNeckP2 = [0, 0.212 + bOffset, 0];
        let defaultHeadP1 = [0, 0.336 + bOffset, 0];
        let defaultHeadP2 = [0, 0.336 + bOffset, 0];
        
        neckP1 = hasUpperTilt ? rotatePointX(chestP1, defaultNeckP1, torsoTilt) : defaultNeckP1;
        neckP2 = hasUpperTilt ? rotatePointX(chestP1, defaultNeckP2, torsoTilt) : defaultNeckP2;
        headP1 = hasUpperTilt ? rotatePointX(chestP1, defaultHeadP1, torsoTilt) : defaultHeadP1;
        headP2 = headP1;
        
        let defaultLeftEarP1 = [-0.140, 0.268 + bOffset, -0.018];
        let defaultLeftEarP2 = [-0.145, 0.312 + bOffset, -0.024];
        let defaultRightEarP1 = [0.140, 0.268 + bOffset, -0.018];
        let defaultRightEarP2 = [0.145, 0.312 + bOffset, -0.024];
        
        leftEarP1 = hasUpperTilt ? rotatePointX(chestP1, defaultLeftEarP1, torsoTilt) : defaultLeftEarP1;
        leftEarP2 = hasUpperTilt ? rotatePointX(chestP1, defaultLeftEarP2, torsoTilt) : defaultLeftEarP2;
        rightEarP1 = hasUpperTilt ? rotatePointX(chestP1, defaultRightEarP1, torsoTilt) : defaultRightEarP1;
        rightEarP2 = hasUpperTilt ? rotatePointX(chestP1, defaultRightEarP2, torsoTilt) : defaultRightEarP2;

        // Arm joints firmly seated inside the torso shoulder contours (zero gap)
        let defaultLeftArmPivot = [-0.074, 0.124 + bOffset, 0];
        let defaultLeftElbowBase = [-0.116, 0.012 + bOffset, -0.006];
        let defaultLeftHandBase = [-0.146, -0.095 + bOffset, 0.022];

        let defaultRightArmPivot = [0.074, 0.124 + bOffset, 0];
        let defaultRightElbowBase = [0.116, 0.012 + bOffset, -0.006];
        let defaultRightHandBase = [0.146, -0.095 + bOffset, 0.022];

        leftArmPivot = hasUpperTilt ? rotatePointX(chestP1, defaultLeftArmPivot, torsoTilt) : defaultLeftArmPivot;
        const leftElbowBase = hasUpperTilt ? rotatePointX(chestP1, defaultLeftElbowBase, torsoTilt) : defaultLeftElbowBase;
        const leftHandBase = hasUpperTilt ? rotatePointX(chestP1, defaultLeftHandBase, torsoTilt) : defaultLeftHandBase;

        rightArmPivot = hasUpperTilt ? rotatePointX(chestP1, defaultRightArmPivot, torsoTilt) : defaultRightArmPivot;
        const rightElbowBase = hasUpperTilt ? rotatePointX(chestP1, defaultRightElbowBase, torsoTilt) : defaultRightElbowBase;
        const rightHandBase = hasUpperTilt ? rotatePointX(chestP1, defaultRightHandBase, torsoTilt) : defaultRightHandBase;

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
        if (Math.abs(bucketArmAbduct) > 0.001) {
          rightElbowRot = rotatePointZ(rightArmPivot, rightElbowRot, bucketArmAbduct);
          rightHandRot = rotatePointZ(rightArmPivot, rightHandRot, bucketArmAbduct);
        }
        if (Math.abs(bucketArmYaw) > 0.001) {
          rightElbowRot = rotatePointY(rightArmPivot, rightElbowRot, bucketArmYaw);
          rightHandRot = rotatePointY(rightArmPivot, rightHandRot, bucketArmYaw);
        }
        if (shirasayaMode === "post_skill") {
          leftElbowRot = rotatePointZ(leftArmPivot, leftElbowRot, -0.16);
          leftHandRot = rotatePointZ(leftArmPivot, leftHandRot, -0.16);
        }

        let legAngleFwd = legAngle;
        let rightLegAngleFwd = rightLegAngle;
        
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

        const getHandGripFrame = (elbowPt, handPt, isLeft, wristPose = null, shoulderPt = null) => {
          if (window.CapsuleModel && typeof window.CapsuleModel.computeHandGripFrame === "function") {
            return window.CapsuleModel.computeHandGripFrame(elbowPt, handPt, isLeft, wristPose, shoulderPt);
          }
          const dx = handPt[0] - elbowPt[0];
          const dy = handPt[1] - elbowPt[1];
          const dz = handPt[2] - elbowPt[2];
          const len = Math.hypot(dx, dy, dz);
          const dArm = len > 1e-4 ? [dx / len, dy / len, dz / len] : [0, -1, 0];
          const inSign = isLeft ? 1.0 : -1.0;
          let palmIn = [inSign * 0.85, -0.15, -0.45];
          const dotIn = palmIn[0] * dArm[0] + palmIn[1] * dArm[1] + palmIn[2] * dArm[2];
          palmIn = [
            palmIn[0] - dArm[0] * dotIn,
            palmIn[1] - dArm[1] * dotIn,
            palmIn[2] - dArm[2] * dotIn,
          ];
          const inLen = Math.hypot(palmIn[0], palmIn[1], palmIn[2]) || 1.0;
          palmIn = [palmIn[0] / inLen, palmIn[1] / inLen, palmIn[2] / inLen];
          let rKnuckle = isLeft
            ? [
                dArm[1] * palmIn[2] - dArm[2] * palmIn[1],
                dArm[2] * palmIn[0] - dArm[0] * palmIn[2],
                dArm[0] * palmIn[1] - dArm[1] * palmIn[0],
              ]
            : [
                palmIn[1] * dArm[2] - palmIn[2] * dArm[1],
                palmIn[2] * dArm[0] - palmIn[0] * dArm[2],
                palmIn[0] * dArm[1] - palmIn[1] * dArm[0],
              ];
          const rkLen = Math.hypot(rKnuckle[0], rKnuckle[1], rKnuckle[2]) || 1.0;
          rKnuckle = [rKnuckle[0] / rkLen, rKnuckle[1] / rkLen, rKnuckle[2] / rkLen];
          const gripCenter = [
            handPt[0] + dArm[0] * 0.036 + palmIn[0] * 0.016,
            handPt[1] + dArm[1] * 0.036 + palmIn[1] * 0.016,
            handPt[2] + dArm[2] * 0.036 + palmIn[2] * 0.016,
          ];
          return { dArm, palmIn, rKnuckle, gripCenter };
        };

        let axeHandleP1Rot, axeHandleP2Rot, axeBladeP1Rot, axeBladeP2Rot, axeBlade2P1Rot, axeBlade2P2Rot;
        let shovelD1Rot, shovelD2Rot, shovelLeftBranchRot, shovelRightBranchRot;
        let bowGripRot, bowUpperTipRot, bowLowerTipRot;
        let rightGripPos, rightArmDir, rightPalmIn, rightKnuckleDir;
        let skillWristLeft = null;
        let skillWristRight = null;
        let spineRigPose = { torsoYaw: 0.0, lockHeadYaw: false, headPitch: 0.0, headYaw: 0.0 };
        let leftAnklePose = null;
        let rightAnklePose = null;

        if (typeof effectiveSwimFactor === "number" && effectiveSwimFactor > 0.01) {
          leftAnklePose = { pitch: 0.35 * effectiveSwimFactor };
          rightAnklePose = { pitch: 0.35 * effectiveSwimFactor };
        } else if (!isClone && typeof jumpBlend === "number" && jumpBlend > 0.01) {
          leftAnklePose = { pitch: 0.22 * jumpBlend };
          rightAnklePose = { pitch: 0.22 * jumpBlend };
        }

        const computeRightHeldItemPoints = (itemName, elbowPt, handPt, wristPoseOverride = null) => {
          const activeRightWrist = wristPoseOverride !== null ? wristPoseOverride : skillWristRight;
          const { dArm, palmIn, rKnuckle, gripCenter } = getHandGripFrame(elbowPt, handPt, false, activeRightWrist, rightArmPivot);
          rightGripPos = gripCenter;
          rightArmDir = dArm;
          rightPalmIn = palmIn;
          rightKnuckleDir = rKnuckle;
          const ptOffset = (dR, dA, dP) => [
            gripCenter[0] + rKnuckle[0] * dR + dArm[0] * dA + palmIn[0] * dP,
            gripCenter[1] + rKnuckle[1] * dR + dArm[1] * dA + palmIn[1] * dP,
            gripCenter[2] + rKnuckle[2] * dR + dArm[2] * dA + palmIn[2] * dP,
          ];
          if (itemName === "SHOVEL") {
            axeHandleP1Rot = ptOffset(-0.055, 0, 0);
            axeHandleP2Rot = ptOffset(0.235, 0, 0);
            axeBladeP1Rot = ptOffset(0.235, 0, 0);
            axeBladeP2Rot = ptOffset(0.395, 0, 0);
            shovelD1Rot = ptOffset(-0.055, 0, 0);
            shovelD2Rot = ptOffset(-0.090, 0, 0);
            shovelLeftBranchRot = ptOffset(-0.125, 0, 0.036);
            shovelRightBranchRot = ptOffset(-0.125, 0, -0.036);
          } else if (itemName === "BRANCH" || itemName === "branch") {
            axeHandleP1Rot = ptOffset(-0.080, 0, 0);
            axeHandleP2Rot = ptOffset(0.260, 0, 0);
            axeBladeP1Rot = axeHandleP2Rot;
            axeBladeP2Rot = axeHandleP2Rot;
          } else if (itemName === "PICKAXE") {
            axeHandleP1Rot = ptOffset(-0.065, 0, 0);
            axeHandleP2Rot = ptOffset(0.215, 0, 0);
            axeBladeP1Rot = ptOffset(0.180, 0, 0);
            axeBladeP2Rot = ptOffset(0.180, 0.115, 0);
            axeBlade2P1Rot = ptOffset(0.180, 0, 0);
            axeBlade2P2Rot = ptOffset(0.180, -0.115, 0);
          } else {
            axeHandleP1Rot = ptOffset(-0.065, 0, 0);
            axeHandleP2Rot = ptOffset(0.215, 0, 0);
            axeBladeP1Rot = ptOffset(0.175, 0, 0);
            axeBladeP2Rot = ptOffset(0.175, 0.115, 0);
          }
        };
        
        let chibiBucketPourPose = null;
        if (heldItem || activeBucketWater > 0) {
             if (heldItem && heldItem.name === "BOW") {
                 let t = 0.0;
                 let drawT = 0.0;
                 if (effectiveArrowShot) {
                     if (effectiveUseAnimTimer > 0.3) {
                         t = 1.0;
                         const holdStart = effectiveBowHoldArmTimer - 0.3;
                         if (effectiveUseAnimTimer > holdStart) {
                             drawT = ((effectiveUseAnimTimer - holdStart) / 0.3) * effectiveLastBowDrawPower;
                         } else {
                             drawT = 0.0;
            }
          } else {
                         t = effectiveUseAnimTimer / 0.3;
                         drawT = 0.0;
            }
          } else {
                     t = Math.min(1.0, Math.max(0.0, (1.4 - effectiveUseAnimTimer) / 1.1));
                     if (effectiveBowCombo) {
                         t = 1.0;
                         drawT = Math.min(1.0, Math.max(0.0, (1.2 - effectiveUseAnimTimer) / 0.9));
                     } else {
                         drawT = t;
                     }
                 }

                 // Torso rotates right so the character stands sideways like an archer
                 let currentYaw = 1.1 * t; 
                 spineRigPose.torsoYaw = currentYaw;
                 spineRigPose.lockHeadYaw = true;

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
                 if (effectiveBowCombo) {
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

                 // BOW PLACEMENT (seated inside left Chibi palm/finger curl)
                 let upVec = [-0.1, 1, 0.1]; 
                 let lenU = Math.sqrt(upVec[0]**2 + upVec[1]**2 + upVec[2]**2);
                 upVec = [upVec[0]/lenU, upVec[1]/lenU, upVec[2]/lenU];

                 let bowLength = 0.45;
                 const leftStartFrame = getHandGripFrame(leftElbowStart, leftHandStart, true);
                 const leftTargetFrame = getHandGripFrame(targetLeftElbow, targetLeftHand, true);
                 let targetBowGrip = leftTargetFrame.gripCenter;
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

                 let bowGripStart = leftStartFrame.gripCenter;
                 let bowUpperStart = [
                     bowGripStart[0] + leftStartFrame.rKnuckle[0] * bowLength,
                     bowGripStart[1] + leftStartFrame.rKnuckle[1] * bowLength,
                     bowGripStart[2] + leftStartFrame.rKnuckle[2] * bowLength
                 ];
                 let bowLowerStart = [
                     bowGripStart[0] - leftStartFrame.rKnuckle[0] * bowLength * 0.8,
                     bowGripStart[1] - leftStartFrame.rKnuckle[1] * bowLength * 0.8,
                     bowGripStart[2] - leftStartFrame.rKnuckle[2] * bowLength * 0.8
                 ];

                 const leftNowFrame = getHandGripFrame(leftElbowRot, leftHandRot, true);
                 bowGripRot = leftNowFrame.gripCenter;
                 const rawInterpGrip = [
                     bowGripStart[0] + (targetBowGrip[0] - bowGripStart[0]) * t,
                     bowGripStart[1] + (targetBowGrip[1] - bowGripStart[1]) * t,
                     bowGripStart[2] + (targetBowGrip[2] - bowGripStart[2]) * t
                 ];
                 const gripFix = [
                     bowGripRot[0] - rawInterpGrip[0],
                     bowGripRot[1] - rawInterpGrip[1],
                     bowGripRot[2] - rawInterpGrip[2]
                 ];
                 bowUpperTipRot = [
                     bowUpperStart[0] + (targetBowUpper[0] - bowUpperStart[0]) * t + gripFix[0],
                     bowUpperStart[1] + (targetBowUpper[1] - bowUpperStart[1]) * t + gripFix[1],
                     bowUpperStart[2] + (targetBowUpper[2] - bowUpperStart[2]) * t + gripFix[2]
                 ];
                 bowLowerTipRot = [
                     bowLowerStart[0] + (targetBowLower[0] - bowLowerStart[0]) * t + gripFix[0],
                     bowLowerStart[1] + (targetBowLower[1] - bowLowerStart[1]) * t + gripFix[1],
                     bowLowerStart[2] + (targetBowLower[2] - bowLowerStart[2]) * t + gripFix[2]
                 ];
                 
                 const bowTargetNpc = isClone
                   ? (cloneState && cloneState.targetAnimal ? cloneState.targetAnimal : null)
                   : (typeof activeTargetNPC !== "undefined" ? activeTargetNPC : null);
                 const isPlayerPitchCam = !isClone && typeof cameraMode !== "undefined" && (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") && typeof rotationX !== "undefined";
                 if (isPlayerPitchCam || (bowTargetNpc && bowTargetNpc.position)) {
                      // Pitch the whole upper body to aim at the target NPC if locked, else fallback to rotationX
                      let currentPitch = isPlayerPitchCam ? rotationX : 0.0;
                      if (bowTargetNpc && bowTargetNpc.position) {
                          const basis = (typeof window !== "undefined" && window.ActorCore && typeof window.ActorCore.getBasis === "function")
                            ? window.ActorCore.getBasis(isClone ? cloneState : "player")
                            : null;
                          if (basis) {
                              const npc = bowTargetNpc;
                              const npc_pos = npc.position;
                              const N = npc.N || basis.normal;
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
                                  target_g[0] - basis.centerPos[0],
                                  target_g[1] - basis.centerPos[1],
                                  target_g[2] - basis.centerPos[2]
                              ];
                              const d_up = dVec[0] * basis.normal[0] + dVec[1] * basis.normal[1] + dVec[2] * basis.normal[2];
                              const d_dist_planar = Math.sqrt(Math.max(0.0, dVec[0]**2 + dVec[1]**2 + dVec[2]**2 - d_up**2));
                              if (d_dist_planar > 0.05) {
                                  currentPitch = -Math.atan2(d_up, d_dist_planar);
                              }
                          }
                      }
                      const pitchAngle = currentPitch * t;
                      spineRigPose.headPitch = pitchAngle;
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
                 if (t > 0.05 && bowUpperTipRot && bowLowerTipRot) {
                     skillWristLeft = {
                         bladeDir: [
                             bowUpperTipRot[0] - bowLowerTipRot[0],
                             bowUpperTipRot[1] - bowLowerTipRot[1],
                             bowUpperTipRot[2] - bowLowerTipRot[2]
                         ],
                         handBlend: 0.45 * t
                     };
                 }
          } else if (heldItem && (heldItem.name === "WOODEN_ARM_CANNON" || heldItem.name === "ARM_CANNON")) {
                 // Classic humanoid model: Raise the right arm horizontally forward and hold it in place continuously
                 const l_upper = 0.155;
                 const l_lower = 0.145;

                 // Calculate vertical aim pitch (same NPC aim pitch solver for Player & Clones)
                 let currentPitch = 0.0;
                 const rangedTargetNpc = isClone
                   ? (cloneState && cloneState.targetAnimal ? cloneState.targetAnimal : null)
                   : (typeof activeTargetNPC !== "undefined" ? activeTargetNPC : null);
                 if (!isClone && typeof cameraMode !== "undefined" && (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") && typeof rotationX !== "undefined") {
                     currentPitch = rotationX;
                 }
                 if (rangedTargetNpc && rangedTargetNpc.position) {
                     const basis = (typeof window !== "undefined" && window.ActorCore && typeof window.ActorCore.getBasis === "function")
                       ? window.ActorCore.getBasis(isClone ? cloneState : "player")
                       : null;
                     if (basis) {
                         const npc_pos = rangedTargetNpc.position;
                         const N = rangedTargetNpc.N || basis.normal;
                         const F = rangedTargetNpc.F || [0, 0, 0];
                         const upOffset = (rangedTargetNpc.type === "meganeura") ? 0.0 : -0.02;
                         const forwardOffset = (rangedTargetNpc.type === "meganeura") ? -0.06 : -0.12;
                         const target_g = [
                             npc_pos[0] + N[0] * upOffset + F[0] * forwardOffset,
                             npc_pos[1] + N[1] * upOffset + F[1] * forwardOffset,
                             npc_pos[2] + N[2] * upOffset + F[2] * forwardOffset
                         ];
                         const dVec = [
                             target_g[0] - basis.centerPos[0],
                             target_g[1] - basis.centerPos[1],
                             target_g[2] - basis.centerPos[2]
                         ];
                         const d_up = dVec[0] * basis.normal[0] + dVec[1] * basis.normal[1] + dVec[2] * basis.normal[2];
                         const d_dist_planar = Math.sqrt(Math.max(0.0, dVec[0]**2 + dVec[1]**2 + dVec[2]**2 - d_up**2));
                         if (d_dist_planar > 0.05) {
                             currentPitch = -Math.atan2(d_up, d_dist_planar);
                         }
                     }
                 }

                 // Recoil kickback during firing recovery (identical 0.32s duration for Player & Clones)
                 let recoilZ = 0.0;
                 if (effectiveArrowShot && effectiveUseAnimTimer > 0) {
                     const rP = Math.max(0.0, Math.min(1.0, effectiveUseAnimTimer / 0.32));
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
                 spineRigPose.headPitch = currentPitch * 0.35;
                 const applyCannonPitch = (pt) => rotatePointX(chestP1, pt, currentPitch * 0.35);
                 neckP1 = applyCannonPitch(neckP1);
                 neckP2 = applyCannonPitch(neckP2);
                 headP1 = applyCannonPitch(headP1);
                 headP2 = applyCannonPitch(headP2);
                 leftEarP1 = applyCannonPitch(leftEarP1);
                 leftEarP2 = applyCannonPitch(leftEarP2);
                 rightEarP1 = applyCannonPitch(rightEarP1);
                 rightEarP2 = applyCannonPitch(rightEarP2);
          } else if (activeBucketWater > 0 && waterPourEnv > 0.001) {
                 const solveTwoBoneIK = (shoulder, targetWrist, L1, L2, poleDir) => {
                     const dx = targetWrist[0] - shoulder[0];
                     const dy = targetWrist[1] - shoulder[1];
                     const dz = targetWrist[2] - shoulder[2];
                     let dist = Math.hypot(dx, dy, dz);
                     if (dist < 1e-4) dist = 1e-4;
                     const dir = [dx / dist, dy / dist, dz / dist];
                     const maxReach = (L1 + L2) * 0.992;
                     const minReach = Math.abs(L1 - L2) + 0.01;
                     const d = Math.max(minReach, Math.min(maxReach, dist));
                     const cosA = Math.max(-1.0, Math.min(1.0, (L1 * L1 + d * d - L2 * L2) / (2.0 * L1 * d)));
                     const sinA = Math.sqrt(Math.max(0.0, 1.0 - cosA * cosA));
                     const dotP = poleDir[0] * dir[0] + poleDir[1] * dir[1] + poleDir[2] * dir[2];
                     let bend = [
                         poleDir[0] - dir[0] * dotP,
                         poleDir[1] - dir[1] * dotP,
                         poleDir[2] - dir[2] * dotP
                     ];
                     let bLen = Math.hypot(bend[0], bend[1], bend[2]);
                     if (bLen < 1e-4) {
                         const fallback = [0, -1, 0];
                         const dF = fallback[1] * dir[1];
                         bend = [-dir[0] * dF, 1.0 - dir[1] * dF, -dir[2] * dF];
                         bLen = Math.hypot(bend[0], bend[1], bend[2]) || 1.0;
                     }
                     bend = [bend[0] / bLen, bend[1] / bLen, bend[2] / bLen];
                     const elbow = [
                         shoulder[0] + (dir[0] * cosA + bend[0] * sinA) * L1,
                         shoulder[1] + (dir[1] * cosA + bend[1] * sinA) * L1,
                         shoulder[2] + (dir[2] * cosA + bend[2] * sinA) * L1
                     ];
                     const wrist = [
                         shoulder[0] + dir[0] * d,
                         shoulder[1] + dir[1] * d,
                         shoulder[2] + dir[2] * d
                     ];
                     return { elbow, wrist };
                 };

                 const fwd = [Math.sin(waterAimYaw), 0.0, Math.cos(waterAimYaw)];
                 const right = [Math.cos(waterAimYaw), 0.0, -Math.sin(waterAimYaw)];
                 const up = [0.0, 1.0, 0.0];
                 const customBucketScale = (window.devBucketOffset && typeof window.devBucketOffset.scale === "number" && !isNaN(window.devBucketOffset.scale))
                     ? window.devBucketOffset.scale
                     : 1.0;
                 const bScalePour = 0.22 * customBucketScale;

                 const pourTilt = 1.78 * waterTiltEnv + waterPourBob * waterPourEnv;
                 const cosP = Math.cos(pourTilt);
                 const sinP = Math.sin(pourTilt);
                 const bR = right;
                 const bN = [
                     up[0] * cosP + fwd[0] * sinP,
                     up[1] * cosP + fwd[1] * sinP,
                     up[2] * cosP + fwd[2] * sinP
                 ];
                 const bF = [
                     -up[0] * sinP + fwd[0] * cosP,
                     -up[1] * sinP + fwd[1] * cosP,
                     -up[2] * sinP + fwd[2] * cosP
                 ];
                 const handleAngle = Math.max(0.0, pourTilt - 0.14);
                 const cosH = Math.cos(handleAngle);
                 const sinH = Math.sin(handleAngle);
                 const handleDir = [
                     bN[0] * cosH - bF[0] * sinH,
                     bN[1] * cosH - bF[1] * sinH,
                     bN[2] * cosH - bF[2] * sinH
                 ];

                 // Bucket hovers high in front of chest & above planter rim
                 const bucketPourCenter = [
                     chestP1[0] + up[0] * 0.222 + fwd[0] * 0.236 + right[0] * 0.015,
                     chestP1[1] + up[1] * 0.222 + fwd[1] * 0.236 + right[1] * 0.015,
                     chestP1[2] + up[2] * 0.222 + fwd[2] * 0.236 + right[2] * 0.015
                 ];
                 // Top hand (right) holds hinged top handle grip
                 const targetRightGrip = [
                     bucketPourCenter[0] + bN[0] * (0.28 * bScalePour) + handleDir[0] * (0.29 * bScalePour),
                     bucketPourCenter[1] + bN[1] * (0.28 * bScalePour) + handleDir[1] * (0.29 * bScalePour),
                     bucketPourCenter[2] + bN[2] * (0.28 * bScalePour) + handleDir[2] * (0.29 * bScalePour)
                 ];
                 // Bottom hand (left) cradles lower-back belly of bucket
                 const targetLeftGrip = [
                     bucketPourCenter[0] - bN[0] * (0.18 * bScalePour) + bF[0] * (0.26 * bScalePour) - bR[0] * (0.16 * bScalePour),
                     bucketPourCenter[1] - bN[1] * (0.18 * bScalePour) + bF[1] * (0.26 * bScalePour) - bR[1] * (0.16 * bScalePour),
                     bucketPourCenter[2] - bN[2] * (0.18 * bScalePour) + bF[2] * (0.26 * bScalePour) - bR[2] * (0.16 * bScalePour)
                 ];

                 const rReach = [
                     targetRightGrip[0] - rightArmPivot[0],
                     targetRightGrip[1] - rightArmPivot[1],
                     targetRightGrip[2] - rightArmPivot[2]
                 ];
                 const rRL = Math.hypot(rReach[0], rReach[1], rReach[2]) || 1.0;
                 const targetRightWrist = [
                     targetRightGrip[0] - (rReach[0] / rRL) * 0.036,
                     targetRightGrip[1] - (rReach[1] / rRL) * 0.036 + 0.012,
                     targetRightGrip[2] - (rReach[2] / rRL) * 0.036
                 ];

                 const lReach = [
                     targetLeftGrip[0] - leftArmPivot[0],
                     targetLeftGrip[1] - leftArmPivot[1],
                     targetLeftGrip[2] - leftArmPivot[2]
                 ];
                 const lRL = Math.hypot(lReach[0], lReach[1], lReach[2]) || 1.0;
                 const targetLeftWrist = [
                     targetLeftGrip[0] - (lReach[0] / lRL) * 0.036,
                     targetLeftGrip[1] - (lReach[1] / lRL) * 0.036,
                     targetLeftGrip[2] - (lReach[2] / lRL) * 0.036
                 ];

                 const rightIK = solveTwoBoneIK(
                     rightArmPivot,
                     targetRightWrist,
                     0.132,
                     0.128,
                     [0.48 * right[0] - 0.14 * fwd[0], -0.82, 0.48 * right[2] - 0.14 * fwd[2]]
                 );
                 const leftIK = solveTwoBoneIK(
                     leftArmPivot,
                     targetLeftWrist,
                     0.122,
                     0.118,
                     [-0.58 * right[0] - 0.10 * fwd[0], -0.80, -0.58 * right[2] - 0.10 * fwd[2]]
                 );

                 const carryLE = [leftElbowRot[0], leftElbowRot[1], leftElbowRot[2]];
                 const carryLH = [leftHandRot[0], leftHandRot[1], leftHandRot[2]];
                 const carryRE = [rightElbowRot[0], rightElbowRot[1], rightElbowRot[2]];
                 const carryRH = [rightHandRot[0], rightHandRot[1], rightHandRot[2]];

                 const p = waterPourEnv;
                 leftElbowRot = [
                     carryLE[0] * (1.0 - p) + leftIK.elbow[0] * p,
                     carryLE[1] * (1.0 - p) + leftIK.elbow[1] * p,
                     carryLE[2] * (1.0 - p) + leftIK.elbow[2] * p
                 ];
                 leftHandRot = [
                     carryLH[0] * (1.0 - p) + leftIK.wrist[0] * p,
                     carryLH[1] * (1.0 - p) + leftIK.wrist[1] * p,
                     carryLH[2] * (1.0 - p) + leftIK.wrist[2] * p
                 ];
                 rightElbowRot = [
                     carryRE[0] * (1.0 - p) + rightIK.elbow[0] * p,
                     carryRE[1] * (1.0 - p) + rightIK.elbow[1] * p,
                     carryRE[2] * (1.0 - p) + rightIK.elbow[2] * p
                 ];
                 rightHandRot = [
                     carryRH[0] * (1.0 - p) + rightIK.wrist[0] * p,
                     carryRH[1] * (1.0 - p) + rightIK.wrist[1] * p,
                     carryRH[2] * (1.0 - p) + rightIK.wrist[2] * p
                 ];

                 chibiBucketPourPose = {
                     pourEnv: p,
                     bR,
                     bN,
                     bF,
                     fwd,
                     handleAngle
                 };
                 skillWristLeft = {
                     bladeDir: bF,
                     handDir: bN,
                     handBlend: 0.45 * p
                 };
                 skillWristRight = {
                     bladeDir: [-bR[0], -bR[1], -bR[2]],
                     handDir: [-handleDir[0], -handleDir[1], -handleDir[2]],
                     handBlend: 0.50 * p
                 };
                 computeRightHeldItemPoints(heldItem ? heldItem.name : "IRON_BUCKET", rightElbowRot, rightHandRot);
          } else if (shirasayaMode === "charging" || shirasayaMode === "dashing" || aegisMode === "charging" || aegisMode === "dashing" || aegisMode === "post_skill") {
                 if (shirasayaMode === "charging") {
                     // One-handed samurai ready guard (normal forward grip on anatomical right hand, left arm relaxed at side like Step 1):
                     const targetRightHandWrist = [-0.042, 0.148 + bOffset, 0.156];
                     const targetLeftHandWrist = [0.018, 0.072 + bOffset, 0.092];
                     const rSwordIK = solveSwordIK(leftArmPivot, targetRightHandWrist, 0.128, 0.124, [-0.68, -0.42, 0.15]);
                     const s = shirasayaChargeSmooth;
                     leftElbowRot = [
                         leftElbowRot[0] * (1.0 - s) + rSwordIK.elbow[0] * s,
                         leftElbowRot[1] * (1.0 - s) + rSwordIK.elbow[1] * s,
                         leftElbowRot[2] * (1.0 - s) + rSwordIK.elbow[2] * s
                     ];
                     leftHandRot = [
                         leftHandRot[0] * (1.0 - s) + rSwordIK.wrist[0] * s,
                         leftHandRot[1] * (1.0 - s) + rSwordIK.wrist[1] * s,
                         leftHandRot[2] * (1.0 - s) + rSwordIK.wrist[2] * s
                     ];
                     const chargeAlong = [
                         targetRightHandWrist[0] - targetLeftHandWrist[0],
                         targetRightHandWrist[1] - targetLeftHandWrist[1],
                         targetRightHandWrist[2] - targetLeftHandWrist[2]
                     ];
                     skillWristLeft = {
                         bladeDir: chargeAlong,
                         edgeDir: [-0.32, -0.62, 0.72],
                         palmHint: [0.84, -0.38, 0.38],
                         gripMode: "normal"
                     };
                 } else if (shirasayaMode === "dashing") {
                     const dProg = shirasayaDashProg;
                     if (shirasayaStep === 1) {
                         // Skill 1 (Dash Thrust / Stabbing Dash): Clean forward thrust / stab along +Z into the target
                         const s1 = 1.0 - Math.pow(1.0 - Math.min(1.0, dProg / 0.82), 2.2);
                         const thrustWrist = [
                             leftArmPivot[0] - 0.04 * (1.0 - s1) - 0.08 * s1,
                             leftArmPivot[1] + 0.015,
                             leftArmPivot[2] + 0.12 + 0.16 * s1
                         ];
                         const rDashIK = solveSwordIK(leftArmPivot, thrustWrist, 0.134, 0.130, [-0.55, 0.12, 0.82]);
                         leftElbowRot = rDashIK.elbow;
                         leftHandRot = rDashIK.wrist;
                         // Blade points straight forward along +Z; palmIn faces inward (+X) and cutting edge faces down/forward
                         skillWristLeft = {
                             bladeDir: [0.04, 0.05, 0.99],
                             edgeDir: [0.08, 0.99, -0.05],
                             palmHint: [0.92, 0.28, 0.15],
                             gripMode: "normal"
                         };
                     } else if (shirasayaStep === 2) {
                         // Skill 2: Wide extended crescent sweep across front (+Z) with natural forward katana grip (matching Step 1 & ref 03-47-13)
                         const rawSw = shiraSm(0.0, 0.68, dProg);
                         const arcAng = 0.42 - rawSw * 0.94;
                         const slashWrist = [
                             leftArmPivot[0] + Math.sin(arcAng) * 0.242,
                             leftArmPivot[1] + 0.012 + 0.018 * rawSw,
                             leftArmPivot[2] + Math.cos(arcAng) * 0.242
                         ];
                         const rSweepIK = solveSwordIK(leftArmPivot, slashWrist, 0.132, 0.128, [-0.52, -0.58, 0.25]);
                         leftElbowRot = rSweepIK.elbow;
                         leftHandRot = rSweepIK.wrist;
                         const bAng2 = 0.30 - rawSw * 1.08;
                         // Unified forward grip family with Step 1 & Step 4: edgeDir leads the cut (-cos, -y, +sin) so palmIn faces inward-down (+X, -Y) and back of hand faces up/camera
                         skillWristLeft = {
                             bladeDir: [Math.sin(bAng2), 0.08, Math.cos(bAng2)],
                             edgeDir: [-Math.cos(bAng2) * 0.52, -0.84, Math.sin(bAng2) * 0.52],
                             palmHint: [Math.cos(bAng2) * 0.85, -0.52, -Math.sin(bAng2) * 0.85],
                             gripMode: "normal"
                         };
                     } else if (shirasayaStep === 3) {
                         // Skill 3: Mid-air 360-degree spinning cyclone -> smooth overhead transition into Step 4
                         const s3Prep = shiraSm(0.80, 1.0, dProg);
                         const spinPitch = 0.06 * (1.0 - s3Prep) + 0.88 * s3Prep;
                         const spinYaw = -0.48 * (1.0 - s3Prep) - 0.12 * s3Prep;
                         const spinWrist = [
                             leftArmPivot[0] + Math.sin(spinYaw) * Math.cos(spinPitch) * 0.242,
                             leftArmPivot[1] + Math.sin(spinPitch) * 0.242,
                             leftArmPivot[2] + Math.cos(spinYaw) * Math.cos(spinPitch) * 0.242
                         ];
                         const rSpinIK = solveSwordIK(leftArmPivot, spinWrist, 0.132, 0.128, [-0.55, -0.45 * (1.0 - s3Prep) + 0.55 * s3Prep, 0.25]);
                         leftElbowRot = rSpinIK.elbow;
                         leftHandRot = rSpinIK.wrist;
                         const bAng3 = -0.72 * (1.0 - s3Prep) - 0.12 * s3Prep;
                         const bPitch3 = 0.08 * (1.0 - s3Prep) + 0.98 * s3Prep;
                         const bDirSpin = [Math.sin(bAng3) * Math.cos(bPitch3), Math.sin(bPitch3), Math.cos(bAng3) * Math.cos(bPitch3)];
                         const eDirSpin = [
                             (-Math.cos(bAng3) * 0.52) * (1.0 - s3Prep) + Math.sin(bAng3) * Math.sin(bPitch3) * s3Prep,
                             -0.84 * (1.0 - s3Prep) - Math.cos(bPitch3) * s3Prep,
                             (Math.sin(bAng3) * 0.52) * (1.0 - s3Prep) + Math.cos(bAng3) * Math.sin(bPitch3) * s3Prep
                         ];
                         skillWristLeft = {
                             bladeDir: bDirSpin,
                             edgeDir: eDirSpin,
                             palmHint: [
                                 Math.cos(bAng3) * 0.85 * (1.0 - s3Prep) + Math.cos(bAng3) * s3Prep,
                                 -0.52 * (1.0 - s3Prep) + 0.15 * s3Prep,
                                 -Math.sin(bAng3) * 0.85 * (1.0 - s3Prep) - Math.sin(bAng3) * s3Prep
                             ],
                             gripMode: "normal"
                         };
                     } else {
                         // Skill 4: Spherical-arc overhead vertical cleave -> forward ground slam in front of character (+Z)
                         // Keeps arm at 95% extension (radius = 0.242) along a forward polar arc so the arm NEVER folds through the shoulder
                         const slamEased = shiraSm(0.08, 0.34, dProg);
                         const recEased = shiraSm(0.82, 1.0, dProg);
                         const cleavePitch = 0.96 * (1.0 - slamEased) - 0.42 * slamEased + 0.16 * recEased;
                         const cleaveYaw = -0.12 * (1.0 - slamEased) - 0.05 * slamEased;
                         const slamWrist = [
                             leftArmPivot[0] + Math.sin(cleaveYaw) * Math.cos(cleavePitch) * 0.242,
                             leftArmPivot[1] + Math.sin(cleavePitch) * 0.242,
                             leftArmPivot[2] + Math.cos(cleaveYaw) * Math.cos(cleavePitch) * 0.242
                         ];
                         const rSlamIK = solveSwordIK(leftArmPivot, slamWrist, 0.134, 0.130, [-0.52, 0.76, 0.22]);
                         leftElbowRot = rSlamIK.elbow;
                         leftHandRot = rSlamIK.wrist;
                         const bPitch4 = 1.05 * (1.0 - slamEased) - 0.30 * slamEased + 0.14 * recEased;
                         skillWristLeft = {
                             bladeDir: [
                                 Math.sin(cleaveYaw) * Math.cos(bPitch4),
                                 Math.sin(bPitch4),
                                 Math.cos(cleaveYaw) * Math.cos(bPitch4)
                             ],
                             edgeDir: [
                                 Math.sin(cleaveYaw) * Math.sin(bPitch4),
                                 -Math.cos(bPitch4),
                                 Math.cos(cleaveYaw) * Math.sin(bPitch4)
                             ],
                             palmHint: [Math.cos(cleaveYaw), 0.15, -Math.sin(cleaveYaw)],
                             gripMode: "normal"
                         };
                     }
                 } else if (aegisMode === "charging" || aegisMode === "dashing" || aegisMode === "post_skill") {
                     // Two-handed Aegis-Shift Greatsword shared rig solver (4-skill combo + downward carry stance)
                     const nrmGs = _v3Nrm;
                     const crsGs = _v3Crs;
                     const dotGs = _v3Dot;
                     const lerpV3 = _v3Lerp;
                     const perpGs = _v3Perp;

                     const shoulderMid = [
                         0.5 * (leftArmPivot[0] + rightArmPivot[0]),
                         0.5 * (leftArmPivot[1] + rightArmPivot[1]),
                         0.5 * (leftArmPivot[2] + rightArmPivot[2])
                     ];
                     const carryHiltRel = [-0.020, -0.090, 0.180];
                     const carryBladeDir = nrmGs([-0.38, -0.44, 0.81]);
                     const carryEdgeRightDir = nrmGs([0.65, -0.20, 0.73]);
                     const carryEdgeLeftDir = nrmGs([-0.88, 0.33, 0.33]);

                     let targetHiltRel = carryHiltRel;
                     let targetBladeDir = carryBladeDir;
                     let trueEdge = perpGs(carryEdgeRightDir, carryBladeDir, [0, -1, 0]);
                     let edgeWeightR = 0.85;
                     let poleRight = [-0.78, -0.42, -0.25];
                     let poleLeft = [0.78, -0.42, -0.25];

                     const gsN1 = nrmGs([-0.92, -0.32, 0.22]);
                     const gsN2 = nrmGs([-0.52, 0.42, -0.74]);
                     const gsN3 = [0, 1, 0];

                     if (aegisMode === "charging") {
                         const sCh = aegisChargeSmooth;
                         targetHiltRel = lerpV3(carryHiltRel, [-0.030, -0.045, 0.165], sCh);
                         targetBladeDir = nrmGs(lerpV3(carryBladeDir, [-0.34, 0.36, 0.87], sCh));
                         const carryEdgePerp = perpGs(carryEdgeRightDir, carryBladeDir, [0, -1, 0]);
                         const guardEdge = perpGs(crsGs(targetBladeDir, gsN1), targetBladeDir, [0.4, -0.8, 0.4]);
                         trueEdge = perpGs(lerpV3(carryEdgePerp, guardEdge, sCh), targetBladeDir, guardEdge);
                         edgeWeightR = 0.85;
                     } else if (aegisMode === "dashing") {
                         if (aegisStep === 1) {
                             // Skill 1: Dash Forward Diagonal Cleave (cutting edge strictly inside tilted cleave plane gsN1)
                             const windT = shiraSm(0.0, 0.20, aegisDashProg);
                             const cleaveT = shiraSm(0.16, 0.54, aegisDashProg);
                             const settleT = (aegisSt && aegisSt.comboActive) ? shiraSm(0.76, 1.0, aegisDashProg) : shiraSm(0.60, 1.0, aegisDashProg);

                             const hPitch = 0.58 * (1.0 - cleaveT) - 0.36 * cleaveT;
                             const hYaw = -0.24 * (1.0 - cleaveT) + 0.16 * cleaveT;
                             const cleaveHilt = [
                                 Math.sin(hYaw) * Math.cos(hPitch) * 0.165,
                                 Math.sin(hPitch) * 0.165,
                                 Math.cos(hYaw) * Math.cos(hPitch) * 0.165 + 0.030
                             ];
                             const windStartHilt = [-0.025, 0.040, 0.175];
                             const activeHilt = lerpV3(windStartHilt, cleaveHilt, windT);
                             const endHilt1 = (aegisSt && aegisSt.comboActive) ? [-0.045, -0.065, 0.160] : carryHiltRel;
                             const endBlade1 = (aegisSt && aegisSt.comboActive) ? nrmGs([-0.66, -0.54, 0.52]) : carryBladeDir;
                             targetHiltRel = lerpV3(activeHilt, endHilt1, settleT);

                             const bPitchWind = 0.48 * (1.0 - windT) + 0.98 * windT;
                             const bPitch = bPitchWind * (1.0 - cleaveT) - 0.16 * cleaveT;
                             const bYawWind = -0.28 * (1.0 - windT) - 0.42 * windT;
                             const bYaw = bYawWind * (1.0 - cleaveT) + 0.34 * cleaveT;
                             const activeBlade = [
                                 Math.sin(bYaw) * Math.cos(bPitch),
                                 Math.sin(bPitch),
                                 Math.cos(bYaw) * Math.cos(bPitch)
                             ];
                             targetBladeDir = nrmGs(lerpV3(activeBlade, endBlade1, settleT));

                             const activeEdge1 = perpGs(crsGs(activeBlade, gsN1), activeBlade, [0.35, -0.92, 0.10]);
                             let endEdge1 = (aegisSt && aegisSt.comboActive)
                                 ? perpGs(crsGs(endBlade1, gsN2), endBlade1, [0.19, -0.79, -0.58])
                                 : perpGs(carryEdgeRightDir, carryBladeDir, [0.91, -0.01, 0.42]);
                             if (dotGs(endEdge1, activeEdge1) < 0.0) {
                                 endEdge1 = [-endEdge1[0], -endEdge1[1], -endEdge1[2]];
                             }
                             trueEdge = perpGs(lerpV3(activeEdge1, endEdge1, settleT), targetBladeDir, activeEdge1);
                             edgeWeightR = 0.85;
                         } else if (aegisStep === 2) {
                             // Skill 2 (Ref Figure 2): Upward Diagonal Rising Slash (cutting edge strictly inside rising slash plane gsN2)
                             const wind2 = shiraSm(0.0, 0.16, aegisDashProg);
                             const slash2A = shiraSm(0.14, 0.36, aegisDashProg);
                             const slash2B = shiraSm(0.36, 0.62, aegisDashProg);
                             const prepNext = shiraSm(0.76, 1.0, aegisDashProg);

                             const hStart2 = [-0.045, -0.065, 0.160];
                             const hMid2 = [0.000, -0.015, 0.180];
                             const hEnd2 = [0.035, 0.045, 0.155];
                             const hNext2 = [0.045, -0.030, 0.150];
                             let hPos2 = lerpV3(hStart2, hMid2, slash2A);
                             hPos2 = lerpV3(hPos2, hEnd2, slash2B);
                             targetHiltRel = lerpV3(lerpV3([-0.035, -0.055, 0.160], hPos2, wind2), hNext2, prepNext);

                             const bStart2 = nrmGs([-0.66, -0.54, 0.52]);
                             const bMid2 = nrmGs([0.05, 0.16, 0.98]);
                             const bEnd2 = nrmGs([0.56, 0.68, 0.47]);
                             const bNext2 = nrmGs([0.85, 0.06, 0.52]);
                             let bDir2 = nrmGs(lerpV3(bStart2, bMid2, slash2A));
                             bDir2 = nrmGs(lerpV3(bDir2, bEnd2, slash2B));
                             targetBladeDir = nrmGs(lerpV3(bDir2, bNext2, prepNext));

                             const activeEdge2 = perpGs(crsGs(gsN2, bDir2), bDir2, [0.55, 0.65, 0.52]);
                             const nextEdge2 = perpGs(crsGs(gsN3, bNext2), bNext2, [0.52, 0.0, -0.85]);
                             trueEdge = perpGs(lerpV3(activeEdge2, nextEdge2, prepNext), targetBladeDir, activeEdge2);
                             edgeWeightR = 0.85;
                             poleRight = lerpV3([-0.78, -0.42, -0.25], [-0.78, -0.25, -0.25], slash2B);
                             poleLeft = lerpV3([0.78, -0.42, -0.25], [0.78, -0.25, -0.25], slash2B);
                         } else if (aegisStep === 3) {
                             // Skill 3 (Ref Figure 3): Wide Horizontal Waist Cleave (cutting edge strictly horizontal inside XZ plane gsN3 = [0,1,0])
                             const wind3 = shiraSm(0.0, 0.16, aegisDashProg);
                             const slash3A = shiraSm(0.14, 0.36, aegisDashProg);
                             const slash3B = shiraSm(0.36, 0.60, aegisDashProg);
                             const prepNext3 = shiraSm(0.76, 1.0, aegisDashProg);

                             const hStart3 = [0.045, -0.030, 0.150];
                             const hMid3 = [0.015, -0.035, 0.175];
                             const hEnd3 = [0.042, -0.035, 0.148];
                             const hNext3 = [-0.010, 0.125, 0.115];
                             let hPos3 = lerpV3(hStart3, hMid3, slash3A);
                             hPos3 = lerpV3(hPos3, hEnd3, slash3B);
                             targetHiltRel = lerpV3(lerpV3(hStart3, hPos3, wind3), hNext3, prepNext3);

                             const bStart3 = nrmGs([0.85, 0.06, 0.52]);
                             const bMid3 = nrmGs([0.00, 0.04, 1.00]);
                             const bEnd3 = nrmGs([-0.88, 0.04, 0.47]);
                             const bNext3 = nrmGs([-0.22, 0.86, -0.25]);
                             let bDir3 = nrmGs(lerpV3(bStart3, bMid3, slash3A));
                             bDir3 = nrmGs(lerpV3(bDir3, bEnd3, slash3B));
                             targetBladeDir = nrmGs(lerpV3(bDir3, bNext3, prepNext3));

                             const activeEdge3 = perpGs(crsGs(gsN3, bDir3), bDir3, [1.0, 0.0, 0.0]);
                             const nextEdge3 = perpGs(crsGs([1.0, 0.0, 0.0], bNext3), bNext3, [0.0, 0.28, 0.96]);
                             trueEdge = perpGs(lerpV3(activeEdge3, nextEdge3, prepNext3), targetBladeDir, activeEdge3);
                             edgeWeightR = 0.88;
                             poleRight = lerpV3([-0.78, -0.42, -0.25], [-0.72, -0.42, -0.15], slash3B);
                             poleRight = lerpV3(poleRight, [-0.78, 0.45, 0.15], prepNext3);
                             poleLeft = lerpV3([0.78, -0.42, -0.25], [0.78, 0.45, 0.15], prepNext3);
                         } else {
                             // Skill 4 (Ref Figure 4): Overhead Vertical Slam Finisher (cutting edge strictly inside vertical sagittal plane YZ, Shirasaya Step 4 style)
                             const up4 = shiraSm(0.0, 0.28, aegisDashProg);
                             const over4 = shiraSm(0.24, 0.38, aegisDashProg);
                             const slam4 = shiraSm(0.36, 0.56, aegisDashProg);
                             const settle4 = shiraSm(0.72, 1.0, aegisDashProg);

                             const hLowStart = [-0.010, 0.125, 0.115];
                             const hTop4 = [-0.010, 0.185, 0.085];
                             const hOver4 = [0.000, 0.180, 0.115];
                             const hSlam4 = [0.000, -0.080, 0.185];
                             let hPos4 = lerpV3(hLowStart, hTop4, up4);
                             hPos4 = lerpV3(hPos4, hOver4, over4);
                             hPos4 = lerpV3(hPos4, hSlam4, slam4);
                             targetHiltRel = lerpV3(hPos4, carryHiltRel, settle4);

                             const bTop4 = nrmGs([-0.22, 0.86, -0.46]);
                             const bOver4 = nrmGs([0.00, 0.86, 0.51]);
                             const bSlam4 = nrmGs([0.00, -0.28, 0.96]);
                             let bDir4 = nrmGs(lerpV3(nrmGs([-0.22, 0.86, -0.25]), bTop4, up4));
                             bDir4 = nrmGs(lerpV3(bDir4, bOver4, over4));
                             bDir4 = nrmGs(lerpV3(bDir4, bSlam4, slam4));
                             targetBladeDir = nrmGs(lerpV3(bDir4, carryBladeDir, settle4));

                             const activeEdge4 = perpGs(crsGs([1.0, 0.0, 0.0], bDir4), bDir4, [0.0, -0.96, -0.28]);
                             const endEdge4 = perpGs(carryEdgeRightDir, carryBladeDir, [0.91, -0.01, 0.42]);
                             trueEdge = perpGs(lerpV3(activeEdge4, endEdge4, settle4), targetBladeDir, activeEdge4);
                             edgeWeightR = 0.92;

                             const topPoleR = [-0.78, 0.45, 0.15];
                             const topPoleL = [0.78, 0.45, 0.15];
                             const downPoleR = [-0.78, -0.42, -0.25];
                             const downPoleL = [0.78, -0.42, -0.25];
                             poleRight = lerpV3(topPoleR, downPoleR, slam4);
                             poleLeft = lerpV3(topPoleL, downPoleL, slam4);
                         }
                     }

                     const bDir = nrmGs(targetBladeDir, [0, 0, 1]);
                     const hiltWorld = [
                         shoulderMid[0] + targetHiltRel[0],
                         shoulderMid[1] + targetHiltRel[1],
                         shoulderMid[2] + targetHiltRel[2]
                     ];
                     const halfSpan = 0.036;
                     const upperGripCenter = [
                         hiltWorld[0] + bDir[0] * halfSpan,
                         hiltWorld[1] + bDir[1] * halfSpan,
                         hiltWorld[2] + bDir[2] * halfSpan
                     ];
                     const lowerGripCenter = [
                         hiltWorld[0] - bDir[0] * halfSpan,
                         hiltWorld[1] - bDir[1] * halfSpan,
                         hiltWorld[2] - bDir[2] * halfSpan
                     ];

                     let eDirR, palmRight, eDirL, palmLeft, activeSwordEdge;
                     if (aegisMode === "post_skill") {
                         // Preserve verified downward carry grip orientations unchanged
                         eDirR = perpGs(carryEdgeRightDir, bDir, [0, -1, 0]);
                         palmRight = nrmGs(crsGs(bDir, eDirR), [1, 0, 0]);
                         eDirL = perpGs(carryEdgeLeftDir, bDir, [-0.5, -0.5, 0.7]);
                         palmLeft = nrmGs(crsGs(eDirL, bDir), [-1, 0, 0]);
                     } else {
                         // Forearm-safe two-handed grip + exact slash-plane sword cutting edge (zero wrist twist, 100% true edge orientation)
                         const roughIKR = solveSwordIK(leftArmPivot, upperGripCenter, 0.132, 0.128, poleRight);
                         const natER = perpGs([
                             roughIKR.wrist[0] - roughIKR.elbow[0],
                             roughIKR.wrist[1] - roughIKR.elbow[1],
                             roughIKR.wrist[2] - roughIKR.elbow[2]
                         ], bDir, [0, 0, 1]);
                         let desER = perpGs(trueEdge, bDir, natER);
                         activeSwordEdge = desER;
                         if (dotGs(desER, natER) < 0.0) {
                             desER = [-desER[0], -desER[1], -desER[2]];
                         }
                         eDirR = nrmGs([
                             desER[0] * edgeWeightR + natER[0] * (1.0 - edgeWeightR),
                             desER[1] * edgeWeightR + natER[1] * (1.0 - edgeWeightR),
                             desER[2] * edgeWeightR + natER[2] * (1.0 - edgeWeightR)
                         ], desER);
                         palmRight = nrmGs(crsGs(bDir, eDirR), [1, 0, 0]);

                         const roughIKL = solveSwordIK(rightArmPivot, lowerGripCenter, 0.132, 0.128, poleLeft);
                         const natEL = perpGs([
                             roughIKL.wrist[0] - roughIKL.elbow[0],
                             roughIKL.wrist[1] - roughIKL.elbow[1],
                             roughIKL.wrist[2] - roughIKL.elbow[2]
                         ], bDir, [0, 0, 1]);
                         const lBlend = (dotGs(eDirR, natEL) >= 0.0) ? 0.22 : 0.0;
                         eDirL = nrmGs([
                             eDirR[0] * lBlend + natEL[0] * (1.0 - lBlend),
                             eDirR[1] * lBlend + natEL[1] * (1.0 - lBlend),
                             eDirR[2] * lBlend + natEL[2] * (1.0 - lBlend)
                         ], natEL);
                         palmLeft = nrmGs(crsGs(eDirL, bDir), [-1, 0, 0]);
                     }

                     const upperWristTarget = [
                         upperGripCenter[0] - eDirR[0] * 0.036 - palmRight[0] * 0.016,
                         upperGripCenter[1] - eDirR[1] * 0.036 - palmRight[1] * 0.016,
                         upperGripCenter[2] - eDirR[2] * 0.036 - palmRight[2] * 0.016
                     ];
                     const lowerWristTarget = [
                         lowerGripCenter[0] - eDirL[0] * 0.036 - palmLeft[0] * 0.016,
                         lowerGripCenter[1] - eDirL[1] * 0.036 - palmLeft[1] * 0.016,
                         lowerGripCenter[2] - eDirL[2] * 0.036 - palmLeft[2] * 0.016
                     ];
                     const gsRightIK = solveSwordIK(leftArmPivot, upperWristTarget, 0.132, 0.128, poleRight);
                     const gsLeftIK = solveSwordIK(rightArmPivot, lowerWristTarget, 0.132, 0.128, poleLeft);
                     leftElbowRot = gsRightIK.elbow;
                     leftHandRot = gsRightIK.wrist;
                     rightElbowRot = gsLeftIK.elbow;
                     rightHandRot = gsLeftIK.wrist;
                     skillWristLeft = { bladeDir: bDir, edgeDir: eDirR, palmHint: palmRight, swordEdge: activeSwordEdge, gripMode: "normal" };
                     skillWristRight = { bladeDir: bDir, edgeDir: eDirL, palmHint: palmLeft, gripMode: "normal" };
                 }
                 computeRightHeldItemPoints(heldItem.name, rightElbowRot, rightHandRot);
          } else if (shirasayaMode === "post_skill") {
                 skillWristLeft = { gripMode: "reverse" };
                 if (heldItem) computeRightHeldItemPoints(heldItem.name, rightElbowRot, rightHandRot);
          } else if (heldItem || isBareHandSwing) {
                 // Tool swing wrist extension & flexion rig (AXE, PICKAXE, SHOVEL, BRANCH, and bare-hand HAND)
                 // Note: Normal TANTO holding (shirasayaMode === "idle") is untouched!
                 const isSwingingTool = !!(
                   effectiveIsUsingItem &&
                   effectiveUseAnimTimer > 0 &&
                   (!heldItem || (
                     heldItem.name !== "TANTO" &&
                     heldItem.name !== "tanto" &&
                     heldItem.name !== "AEGIS_SHIFT" &&
                     heldItem.name !== "aegis_shift"
                   ))
                 );
                 if (isSwingingTool) {
                     const swP = Math.round(effectiveUseAnimTimer * 24) / 24;
                     let wSnap = 0.0;
                     if (swP > 0.8) {
                         const tW = (1.0 - swP) / 0.2;
                         wSnap = -0.45 * tW;
                     } else if (swP > 0.4) {
                         const tS = (0.8 - swP) / 0.4;
                         wSnap = -0.45 + 1.05 * tS;
                     } else {
                         const tR = (0.4 - swP) / 0.4;
                         wSnap = 0.60 * (1.0 - tR);
                     }
                     const faDx = rightHandRot[0] - rightElbowRot[0];
                     const faDy = rightHandRot[1] - rightElbowRot[1];
                     const faDz = rightHandRot[2] - rightElbowRot[2];
                     const faL = Math.hypot(faDx, faDy, faDz) || 1.0;
                     const faDir = [faDx / faL, faDy / faL, faDz / faL];
                     const toolPitchAng = Math.atan2(faDir[2], -faDir[1]) + wSnap * 0.55;
                     const toolDir = [
                         faDir[0] * 0.25,
                         Math.sin(toolPitchAng),
                         Math.cos(toolPitchAng)
                     ];
                     skillWristRight = {
                         bladeDir: toolDir,
                         handDir: [
                             faDir[0],
                             faDir[1] * Math.cos(wSnap * 0.35) - faDir[2] * Math.sin(wSnap * 0.35),
                             faDir[1] * Math.sin(wSnap * 0.35) + faDir[2] * Math.cos(wSnap * 0.35)
                         ],
                         handBlend: 0.55
                     };
                 }
                 if (heldItem) {
                     computeRightHeldItemPoints(heldItem.name, rightElbowRot, rightHandRot, skillWristRight);
                 }
          }

          if (shiraMem && (activeSkillMode !== "idle" || shiraMem.idleFade > 0.001)) {
            const relLE = [leftElbowRot[0] - leftArmPivot[0], leftElbowRot[1] - leftArmPivot[1], leftElbowRot[2] - leftArmPivot[2]];
            const relLH = [leftHandRot[0] - leftArmPivot[0], leftHandRot[1] - leftArmPivot[1], leftHandRot[2] - leftArmPivot[2]];
            const relRE = [rightElbowRot[0] - rightArmPivot[0], rightElbowRot[1] - rightArmPivot[1], rightElbowRot[2] - rightArmPivot[2]];
            const relRH = [rightHandRot[0] - rightArmPivot[0], rightHandRot[1] - rightArmPivot[1], rightHandRot[2] - rightArmPivot[2]];
            if (activeSkillMode !== "idle") {
              // Exact spherical-arc tracking during dashing (kA = 1.0) so fast 150-deg swings never chord-shorten through the shoulder/chest
              const kA = (activeSkillMode === "dashing") ? 1.0 : ((shiraDt > 0) ? (1.0 - Math.exp(-shiraDt * 18.0)) : 1.0);
              if (!shiraMem.armsInit || kA >= 0.999) {
                shiraMem.relLE = [...relLE];
                shiraMem.relLH = [...relLH];
                shiraMem.relRE = [...relRE];
                shiraMem.relRH = [...relRH];
                shiraMem.armsInit = true;
              } else {
                for (let j = 0; j < 3; j++) {
                  shiraMem.relLE[j] += (relLE[j] - shiraMem.relLE[j]) * kA;
                  shiraMem.relLH[j] += (relLH[j] - shiraMem.relLH[j]) * kA;
                  shiraMem.relRE[j] += (relRE[j] - shiraMem.relRE[j]) * kA;
                  shiraMem.relRH[j] += (relRH[j] - shiraMem.relRH[j]) * kA;
                }
              }
              leftElbowRot = [leftArmPivot[0] + shiraMem.relLE[0], leftArmPivot[1] + shiraMem.relLE[1], leftArmPivot[2] + shiraMem.relLE[2]];
              leftHandRot = [leftArmPivot[0] + shiraMem.relLH[0], leftArmPivot[1] + shiraMem.relLH[1], leftArmPivot[2] + shiraMem.relLH[2]];
              rightElbowRot = [rightArmPivot[0] + shiraMem.relRE[0], rightArmPivot[1] + shiraMem.relRE[1], rightArmPivot[2] + shiraMem.relRE[2]];
              rightHandRot = [rightArmPivot[0] + shiraMem.relRH[0], rightArmPivot[1] + shiraMem.relRH[1], rightArmPivot[2] + shiraMem.relRH[2]];
              skillWristLeft = _smoothSkillWristPose(shiraMem, "wInit", "wLBlade", "wLHand", "wLEdge", "wLPalm", skillWristLeft, kA);
              skillWristRight = _smoothSkillWristPose(shiraMem, "wRInit", "wRBlade", "wRHand", "wREdge", "wRPalm", skillWristRight, kA);
            } else if (shiraMem.armsInit) {
              const f = shiraMem.idleFade;
              leftElbowRot = [leftArmPivot[0] + relLE[0] * (1 - f) + shiraMem.relLE[0] * f, leftArmPivot[1] + relLE[1] * (1 - f) + shiraMem.relLE[1] * f, leftArmPivot[2] + relLE[2] * (1 - f) + shiraMem.relLE[2] * f];
              leftHandRot = [leftArmPivot[0] + relLH[0] * (1 - f) + shiraMem.relLH[0] * f, leftArmPivot[1] + relLH[1] * (1 - f) + shiraMem.relLH[1] * f, leftArmPivot[2] + relLH[2] * (1 - f) + shiraMem.relLH[2] * f];
              rightElbowRot = [rightArmPivot[0] + relRE[0] * (1 - f) + shiraMem.relRE[0] * f, rightArmPivot[1] + relRE[1] * (1 - f) + shiraMem.relRE[1] * f, rightArmPivot[2] + relRE[2] * (1 - f) + shiraMem.relRE[2] * f];
              rightHandRot = [rightArmPivot[0] + relRH[0] * (1 - f) + shiraMem.relRH[0] * f, rightArmPivot[1] + relRH[1] * (1 - f) + shiraMem.relRH[1] * f, rightArmPivot[2] + relRH[2] * (1 - f) + shiraMem.relRH[2] * f];
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
              } else if (heldItem.name !== "WOODEN_ARM_CANNON" && heldItem.name !== "ARM_CANNON") {
                  computeRightHeldItemPoints(heldItem.name, rightElbowRot, rightHandRot, skillWristRight);
              }
          }
        }

        const scaleFactor = 1.0;
        const cloneEq = isClone
          ? (typeof window.getCharacterEquippedClothingState === "function"
              ? window.getCharacterEquippedClothingState(true)
              : { wearTop: true, wearShorts: true, wearShirt: false, wearLeggings: false })
          : null;

        // Compute unified full-body rig (Spine/Head/Ears, UpperArm/ForeArm/Hand/Fingers, Thigh/Calf/Ankle/Foot/Toes)
        const fullBodyRig = computeFullBodyRig({
          chestP1,
          chestP2,
          headP1,
          headP2,
          leftArmPivot,
          leftElbowRot,
          leftHandRot,
          rightArmPivot,
          rightElbowRot,
          rightHandRot,
          leftLegPivot,
          leftKneeRot,
          leftFootRot,
          rightLegPivot,
          rightKneeRot,
          rightFootRot,
          spinePose: spineRigPose,
          leftWristPose: skillWristLeft,
          rightWristPose: skillWristRight,
          leftAnklePose,
          rightAnklePose,
        });
        const spineRig = fullBodyRig ? fullBodyRig.spine : null;
        const leftRigFrame = fullBodyRig ? fullBodyRig.leftArm : getHandGripFrame(leftElbowRot, leftHandRot, true, skillWristLeft, leftArmPivot);
        const rightRigFrame = fullBodyRig ? fullBodyRig.rightArm : getHandGripFrame(rightElbowRot, rightHandRot, false, skillWristRight, rightArmPivot);
        const leftLegRig = fullBodyRig ? fullBodyRig.leftLeg : null;
        const rightLegRig = fullBodyRig ? fullBodyRig.rightLeg : null;

        const chest = generateChibiTorso(
          chestP1,
          chestP2,
          (0.09 + bRadius) * scaleFactor,
          scaleFactor,
          cloneEq ? cloneEq.wearTop : null,
          cloneEq ? cloneEq.wearShorts : null,
          cloneEq ? cloneEq.wearShirt : null,
          cloneEq ? cloneEq.wearLeggings : null,
          spineRig ? spineRig.torsoBoneBasis : null,
        );
        const head = generateChibiHead(
          headP1,
          headP2,
          0.192 * scaleFactor,
          scaleFactor,
          spineRig ? spineRig.headBoneBasis : null,
        );
        const leftEar = generateChibiEar(
          leftEarP1,
          leftEarP2,
          true,
          scaleFactor,
          spineRig ? spineRig.leftEarBoneBasis : null,
        );
        const rightEar = generateChibiEar(
          rightEarP1,
          rightEarP2,
          false,
          scaleFactor,
          spineRig ? spineRig.rightEarBoneBasis : null,
        );

        const leftArmUpper = generateChibiUpperArm(
          leftArmPivot,
          leftElbowRot,
          true,
          scaleFactor,
          cloneEq ? cloneEq.wearTop : null,
          cloneEq ? cloneEq.wearShirt : null,
          leftRigFrame ? leftRigFrame.upperArmBoneBasis : null,
        );
        const leftArmLower = generateChibiForeArm(
          leftElbowRot,
          leftHandRot,
          true,
          scaleFactor,
          leftRigFrame ? leftRigFrame.forearmBoneBasis : null,
        );

        const rightArmUpper = generateChibiUpperArm(
          rightArmPivot,
          rightElbowRot,
          false,
          scaleFactor,
          cloneEq ? cloneEq.wearTop : null,
          cloneEq ? cloneEq.wearShirt : null,
          rightRigFrame ? rightRigFrame.upperArmBoneBasis : null,
        );
        const rightArmLower = generateChibiForeArm(
          rightElbowRot,
          rightHandRot,
          false,
          scaleFactor,
          rightRigFrame ? rightRigFrame.forearmBoneBasis : null,
        );

        const leftLegUpper = generateChibiThigh(
          leftLegPivot,
          leftKneeRot,
          true,
          scaleFactor,
          cloneEq ? cloneEq.wearShorts : null,
          cloneEq ? cloneEq.wearLeggings : null,
          leftLegRig ? leftLegRig.thighBoneBasis : null,
        );
        const leftLegLower = generateChibiCalf(
          leftKneeRot,
          leftFootRot,
          true,
          scaleFactor,
          cloneEq ? cloneEq.wearLeggings : null,
          leftLegRig ? leftLegRig.calfBoneBasis : null,
        );

        const rightLegUpper = generateChibiThigh(
          rightLegPivot,
          rightKneeRot,
          false,
          scaleFactor,
          cloneEq ? cloneEq.wearShorts : null,
          cloneEq ? cloneEq.wearLeggings : null,
          rightLegRig ? rightLegRig.thighBoneBasis : null,
        );
        const rightLegLower = generateChibiCalf(
          rightKneeRot,
          rightFootRot,
          false,
          scaleFactor,
          cloneEq ? cloneEq.wearLeggings : null,
          rightLegRig ? rightLegRig.calfBoneBasis : null,
        );

        // Determine hand grip amount (0 = relaxed open hand, 0.55 = cupped orb/fruit grip, 1.0 = closed fist wrapping held handle)
        let leftHandGrip = 0.0;
        let rightHandGrip = 0.0;
        if (heldItem || activeBucketWater > 0 || isBareHandSwing) {
          if (shirasayaMode === "charging") {
            leftHandGrip = 1.0;
            rightHandGrip = 0.0;
          } else if (shirasayaMode === "dashing") {
            leftHandGrip = 1.0;
            rightHandGrip = 0.0;
          } else if (aegisMode === "post_skill" || aegisMode === "dashing" || aegisMode === "charging") {
            // Two-handed heavy greatsword carry & combo: both hands closed tightly around the hilt
            leftHandGrip = 1.0;
            rightHandGrip = 1.0;
          } else if (shirasayaMode === "post_skill") {
            // Skill weapon held in anatomical RIGHT hand (leftArmPivot / -X)
            leftHandGrip = 1.0;
            rightHandGrip = 0.0;
          } else if (heldItem && heldItem.name === "BOW") {
            leftHandGrip = 1.0;
            rightHandGrip = (!effectiveArrowShot && effectiveUseAnimTimer > 0) ? 0.85 : 0.0;
          } else if (heldItem && (heldItem.name === "OBSIDIAN_FLUX" || heldItem.name === "DRAGON_FRUIT" || heldItem.name === "dragon_fruit")) {
            rightHandGrip = 0.55;
          } else {
            rightHandGrip = 1.0;
            if (activeBucketWater > 0) {
              leftHandGrip = (chibiBucketPourPose && typeof chibiBucketPourPose.pourEnv === "number")
                ? chibiBucketPourPose.pourEnv
                : 0.85;
            }
          }
        }

        // Build Chibi detailed hands, fingers, ankles, feet, toes using unified rig frames
        const leftHandParts = buildHandAndFingers(leftElbowRot, leftHandRot, true, scaleFactor, leftHandGrip, skillWristLeft, leftArmPivot);
        const rightHandParts = buildHandAndFingers(rightElbowRot, rightHandRot, false, scaleFactor, rightHandGrip, skillWristRight, rightArmPivot);
        const leftFootParts = buildFootAnkleToes(leftKneeRot, leftFootRot, true, scaleFactor, leftLegRig);
        const rightFootParts = buildFootAnkleToes(rightKneeRot, rightFootRot, false, scaleFactor, rightLegRig);

        // === Build 3D Anime Hair for Player Character (Shared Model Cache + LOD) ===
        if (!window._sharedLocalHairMeshCache) {
          window._sharedLocalHairMeshCache = new Map();
        }
        if (!window._cachedHairState) {
          window._cachedHairState = { key: "", baseMesh: null, localDummyV: null };
        }

        function getOrBuildSharedLocalHairMesh(styleIdx, colorRgb, scaleVal, clipUnderHood) {
          const colors = window.ANIME_HAIR_COLORS || [[0.85, 0.90, 0.96]];
          const rgb = colorRgb || colors[0];
          const sKey = Math.round((scaleVal || 1.0) * 1000);
          const colKey = `${Math.round((rgb[0] || 0) * 255)},${Math.round((rgb[1] || 0) * 255)},${Math.round((rgb[2] || 0) * 255)}`;
          const sharedKey = `v16_hair_${styleIdx}_${colKey}_${sKey}_${clipUnderHood ? 1 : 0}`;
          const existing = window._sharedLocalHairMeshCache.get(sharedKey);
          if (existing) {
            window._sharedLocalHairMeshCache.delete(sharedKey);
            window._sharedLocalHairMeshCache.set(sharedKey, existing);
            return existing;
          }
          const built = _buildAnimeHairLocalAndNormals(styleIdx, rgb, scaleVal, clipUnderHood);
          const entry = (built.localV.length === 0)
            ? {
                key: sharedKey,
                baseMesh: { localV: [], colors: [], normals: [], indices: [], flexW: [] },
                localDummyV: []
              }
            : {
                key: sharedKey,
                baseMesh: {
                  localV: built.localV,
                  colors: built.colors,
                  normals: built.normals,
                  indices: built.indices,
                  flexW: built.flexW
                },
                localDummyV: built.localDummyV
              };
          if (window._sharedLocalHairMeshCache.size >= 64) {
            const oldest = window._sharedLocalHairMeshCache.keys().next().value;
            if (oldest !== undefined) window._sharedLocalHairMeshCache.delete(oldest);
          }
          window._sharedLocalHairMeshCache.set(sharedKey, entry);
          return entry;
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

          const shared = getOrBuildSharedLocalHairMesh(style, color, scaleFactor, false);
          window._cachedHairState = {
            key,
            baseMesh: shared.baseMesh,
            localDummyV: shared.localDummyV,
            worldV: window._cachedHairState.worldV
          };

          return window._cachedHairState;
        }

        function createHairMesh(hairLodLevel = 0) {
          const cached = getBaseLocalHairMesh();
          const bm = cached.baseMesh;
          if (!bm || !bm.localV || bm.localV.length === 0) {
            return { vertices: [], colors: [], normals: [], indices: [] };
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
          if (!isRag && effectiveIsUsingItem && effectiveUseAnimTimer > 0) {
            const swingFactor = Math.sin((1.0 - effectiveUseAnimTimer) * Math.PI);
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
            if (hairLodLevel === 0 && clampBodyFn && (hy + dispY * scale) < neckP2[1]) {
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

        const playerHairMesh = isClone ? null : createHairMesh();
        if (!isClone) window._lastPlayerHairMesh = playerHairMesh;
        const playerLocalHairDummyV = (!isClone && window._cachedHairState) ? window._cachedHairState.localDummyV : null;

        let cloneHoodieMesh = null;
        let cloneOpenHoodieMesh = null;
        let cloneBootsMesh = null;
        let playerHoodieMesh = null;
        let playerBootsMesh = null;
        let playerSkirtMesh = null;
        let playerShirtCollarMesh = null;
        let playerSuitMesh = null;
        let playerSlacksMesh = null;
        let playerOperaCapeMesh = null;

        if (isClone) {
          window._cloneCurrentHeadP1 = [headP1[0], headP1[1], headP1[2]];
          window._cloneCurrentScale = scaleFactor;
          window._cloneCurrentPhase = phase;
          window._cloneCurrentWalkBlend = cloneWalkBlend;
          window._cloneAnimTick = (window._cloneAnimTick || 0) + 1;

          const isMoving = cloneWalkBlend > 0.05;
          const cloneHeading = cloneState
            ? (cloneState.heading || 0.0)
            : ((typeof window.playerClonesState !== "undefined" && window.playerClonesState[0])
              ? (window.playerClonesState[0].heading || 0.0)
              : 0.0);

          let cloneHoodiePhys = null;
          if (cloneState) {
            if (!cloneState._hoodiePhysics && typeof window !== "undefined" && window.CapsuleModel && typeof window.CapsuleModel.createHoodiePhysicsState === "function") {
              cloneState._hoodiePhysics = window.CapsuleModel.createHoodiePhysicsState();
            }
            cloneHoodiePhys = cloneState._hoodiePhysics || null;
          }

          let clonePhysR = null, clonePhysN = null, clonePhysF = null, cloneWorldPos = null;
          if (cloneState && typeof cloneState.theta === "number" && typeof cloneState.phi === "number") {
            const cSinT = Math.sin(cloneState.theta), cCosT = Math.cos(cloneState.theta);
            const cSinP = Math.sin(cloneState.phi), cCosP = Math.cos(cloneState.phi);
            const cNx = cSinT * cCosP, cNy = cCosT, cNz = cSinT * cSinP;
            const cEast = [-cSinP, 0, cCosP];
            const cNorth = [-cCosT * cCosP, cSinT, -cCosT * cSinP];
            const cCosH = Math.cos(cloneHeading), cSinH = Math.sin(cloneHeading);
            clonePhysN = [cNx, cNy, cNz];
            clonePhysR = [cEast[0] * cCosH - cNorth[0] * cSinH, cEast[1] * cCosH - cNorth[1] * cSinH, cEast[2] * cCosH - cNorth[2] * cSinH];
            clonePhysF = [cNorth[0] * cCosH + cEast[0] * cSinH, cNorth[1] * cCosH + cEast[1] * cSinH, cNorth[2] * cCosH + cEast[2] * cSinH];
            const rad = cloneState.centerRadius || (typeof RADIUS !== "undefined" ? RADIUS : 32.0);
            cloneWorldPos = [rad * cNx, rad * cNy, rad * cNz];
          }

          if (typeof updateChibiHoodiePhysics === "function") {
            updateChibiHoodiePhysics(isMoving, false, phase, cloneHeading, {
              isClone: true,
              lod: cloneLodLevel,
              hoodiePhysics: cloneHoodiePhys,
              R: clonePhysR,
              N: clonePhysN,
              F: clonePhysF,
              worldPos: cloneWorldPos,
              torsoTilt: torsoTilt,
              vertVel: cloneState ? (cloneState.verticalVel || 0.0) : 0.0,
              isGrounded: cloneState ? (cloneState.isGrounded !== false) : true
            });
          }

          const cloneClothCtx = {
            isClone: true,
            lod: cloneLodLevel,
            hoodiePhysics: cloneHoodiePhys,
            leftLegPivot,
            leftKneeRot,
            leftFootRot,
            rightLegPivot,
            rightKneeRot,
            rightFootRot,
            leftLegRig,
            rightLegRig
          };
          const buildClosed = !cloneState || !cloneState.hoodOpen;
          const buildOpen = !cloneState || !!cloneState.hoodOpen;

          if (buildClosed) {
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
          }

          if (buildOpen) {
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
          }

          if (typeof buildTravelerBootsMesh === "function") {
            cloneBootsMesh = buildTravelerBootsMesh(leftFootRot, rightFootRot, scaleFactor, cloneClothCtx);
          }
        } else {
          const playerEq = (typeof window.getCharacterEquippedClothingState === "function")
            ? window.getCharacterEquippedClothingState(false)
            : null;
          const needClothPhys = !!(playerEq && (playerEq.wearHoodie || playerEq.wearSkirt || playerEq.wearSuit || playerEq.wearOperaCape));
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
            rightFootRot,
            leftLegRig,
            rightLegRig,
            wearSkirt: !!(playerEq && playerEq.wearSkirt),
            wearHoodie: !!(playerEq && playerEq.wearHoodie),
            wearSuit: !!(playerEq && playerEq.wearSuit)
          };

          // Build skirt BEFORE hoodie so hoodie reuses the skirt's clamped crest envelope without clamping 108 skirt vertices twice
          if (playerEq && playerEq.wearSkirt && typeof buildBlackPleatedSkirtMesh === "function") {
            playerSkirtMesh = buildBlackPleatedSkirtMesh(
              headP1,
              chestP1, chestP2,
              scaleFactor,
              phase,
              legClothCtx
            );
          }

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
          }

          if (playerEq && playerEq.wearShirt && typeof buildWhiteShirtCollarMesh === "function") {
            playerShirtCollarMesh = buildWhiteShirtCollarMesh(
              headP1,
              chestP1, chestP2,
              neckP1, neckP2,
              scaleFactor
            );
          }

          if (playerEq && playerEq.wearSlacks && typeof buildBlackSlacksMesh === "function") {
            playerSlacksMesh = buildBlackSlacksMesh(
              headP1,
              chestP1, chestP2,
              leftLegPivot, leftKneeRot, leftFootRot,
              rightLegPivot, rightKneeRot, rightFootRot,
              scaleFactor,
              phase,
              legClothCtx
            );
          }

          if (playerEq && playerEq.wearSuit && typeof buildDoubleBreastedSuitMesh === "function") {
            playerSuitMesh = buildDoubleBreastedSuitMesh(
              headP1,
              chestP1, chestP2,
              neckP1, neckP2,
              leftArmPivot, leftElbowRot, leftHandRot,
              rightArmPivot, rightElbowRot, rightHandRot,
              scaleFactor,
              phase,
              false,
              leftFootRot, rightFootRot,
              legClothCtx
            );
          }

          if (playerEq && playerEq.wearOperaCape && typeof buildOperaCapeMesh === "function") {
            playerOperaCapeMesh = buildOperaCapeMesh(
              headP1,
              chestP1, chestP2,
              neckP1, neckP2,
              leftArmPivot, leftElbowRot, leftHandRot,
              rightArmPivot, rightElbowRot, rightHandRot,
              scaleFactor,
              phase,
              false,
              leftFootRot, rightFootRot,
              legClothCtx
            );
          }

          if (playerEq && playerEq.wearDressBoots && typeof buildDressBootsMesh === "function") {
            playerBootsMesh = buildDressBootsMesh(leftFootRot, rightFootRot, scaleFactor, legClothCtx);
          } else if (playerEq && playerEq.wearOxfords && typeof buildOxfordShoesMesh === "function") {
            playerBootsMesh = buildOxfordShoesMesh(leftFootRot, rightFootRot, scaleFactor, legClothCtx);
          } else if (playerEq && playerEq.wearBoots && typeof buildTravelerBootsMesh === "function") {
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

        const primaryCloneHoodie = (cloneState && cloneState.hoodOpen) ? cloneOpenHoodieMesh : cloneHoodieMesh;

        let meshesToMerge = isClone ? [
          cloneBaseWelded,
          primaryCloneHoodie,
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
          ...(playerSlacksMesh ? [playerSlacksMesh] : []),
          ...(playerSkirtMesh ? [playerSkirtMesh] : []),
          ...(playerSuitMesh ? [playerSuitMesh] : []),
          ...(playerOperaCapeMesh ? [playerOperaCapeMesh] : []),
          ...(playerHoodieMesh ? [playerHoodieMesh] : []),
          ...(playerBootsMesh ? [playerBootsMesh] : []),
        ];
        
        const isWateringBucketAnim = (!isClone && typeof window.bucketWaterTimer === "number" && window.bucketWaterTimer > 0);
        if (heldItem || isWateringBucketAnim) {
            const charMat = (!isClone && typeof getCharacterMatrix === "function") ? getCharacterMatrix() : null;
            const transformPt = (p) => {
                if (!p) return [0, 0, 0];
                return [p[0], p[1], p[2]];
            };
            const wOriginPt = transformPt([0, 0, 0]);
            const xformDir = (v) => {
                const tp = transformPt(v);
                return [tp[0] - wOriginPt[0], tp[1] - wOriginPt[1], tp[2] - wOriginPt[2]];
            };

            const isRag = false;
            const itemScale = 1.0;

            if (!isClone && heldItem && (heldItem.name === "WOODEN_ARM_CANNON" || heldItem.name === "ARM_CANNON")) {
                _updateArmCannonWorldAim(rightElbowRot, rightHandRot, itemScale);
            } else if (!isClone && heldItem && heldItem.name === "BOW" && !effectiveArrowShot && effectiveUseAnimTimer > 0 && charMat) {
                const wGrip = transformPt(bowGripRot);
                const wNock = transformPt(getHandGripFrame(rightElbowRot, rightHandRot, false).gripCenter);
                const arrowDir = [wGrip[0] - wNock[0], wGrip[1] - wNock[1], wGrip[2] - wNock[2]];
                const arrowLen = Math.hypot(arrowDir[0], arrowDir[1], arrowDir[2]);
                if (arrowLen > 0.001) {
                    arrowDir[0] /= arrowLen; arrowDir[1] /= arrowLen; arrowDir[2] /= arrowLen;
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
            }

            let skipEquipRebuild = false;
            if (!isClone) {
                const heldName = heldItem ? (heldItem.name || "") : "";
                const aStTool = (typeof window.aegisShiftState === "object") ? window.aegisShiftState : null;
                const subToolMode = (aStTool && aStTool.toolMode === "axe") ? "axe" : "pickaxe";
                const bScoop = (typeof window.bucketScoopTimer === "number" && window.bucketScoopTimer > 0) ? window.bucketScoopTimer : 0;
                const bowVibe = (heldName === "BOW" && effectiveLastBowShootTime && (Date.now() - effectiveLastBowShootTime) < 900);
                let curBatFill = 0;
                if (heldName === "GLOW_BATTERY") {
                    if (window.BatterySystem) {
                        const stats = window.BatterySystem.getStats();
                        curBatFill = (stats.activeBattery && stats.activeBattery.charge) ? (stats.activeBattery.charge / window.BatterySystem.MAX_CHARGE) * 100 : 100;
                    } else {
                        curBatFill = 100;
                    }
                } else if (heldName === "GLOW_BATTERY_EMPTY" && heldItem && heldItem.rechargeTime !== undefined && window.BatterySystem) {
                    curBatFill = (heldItem.rechargeTime / window.BatterySystem.REGEN_TIME) * 100;
                }
                const rg = rightGripPos || [0, 0, 0];
                const ra = rightArmDir || [0, 1, 0];
                const rp = rightPalmIn || [0, 0, 1];
                const rk = rightKnuckleDir || [1, 0, 0];
                const re = rightElbowRot || [0, 0, 0];
                const rh = rightHandRot || [0, 0, 0];
                const le = leftElbowRot || [0, 0, 0];
                const lh = leftHandRot || [0, 0, 0];

                if (
                    _lastEquipRenderMode === "capsule" &&
                    equipIndicesLength > 0 &&
                    _lastCapsuleEquipSig &&
                    !isWateringBucketAnim &&
                    bScoop === 0 &&
                    shirasayaMode === "idle" &&
                    aegisMode === "idle" &&
                    !bowVibe
                ) {
                    const s = _lastCapsuleEquipSig;
                    if (
                        s.name === heldName &&
                        s.subToolMode === subToolMode &&
                        s.hasWater === !!(heldItem && heldItem.hasWater) &&
                        s.arrowShot === !!effectiveArrowShot &&
                        Math.abs(s.useTimer - effectiveUseAnimTimer) < 1e-5 &&
                        Math.abs(s.batFill - curBatFill) < 0.05 &&
                        Math.abs(s.rgx - rg[0]) < 1e-5 && Math.abs(s.rgy - rg[1]) < 1e-5 && Math.abs(s.rgz - rg[2]) < 1e-5 &&
                        Math.abs(s.rax - ra[0]) < 1e-5 && Math.abs(s.ray - ra[1]) < 1e-5 && Math.abs(s.raz - ra[2]) < 1e-5 &&
                        Math.abs(s.rpx - rp[0]) < 1e-5 && Math.abs(s.rpy - rp[1]) < 1e-5 && Math.abs(s.rpz - rp[2]) < 1e-5 &&
                        Math.abs(s.rkx - rk[0]) < 1e-5 && Math.abs(s.rky - rk[1]) < 1e-5 && Math.abs(s.rkz - rk[2]) < 1e-5 &&
                        Math.abs(s.rex - re[0]) < 1e-5 && Math.abs(s.rey - re[1]) < 1e-5 && Math.abs(s.rez - re[2]) < 1e-5 &&
                        Math.abs(s.rhx - rh[0]) < 1e-5 && Math.abs(s.rhy - rh[1]) < 1e-5 && Math.abs(s.rhz - rh[2]) < 1e-5 &&
                        Math.abs(s.lex - le[0]) < 1e-5 && Math.abs(s.ley - le[1]) < 1e-5 && Math.abs(s.lez - le[2]) < 1e-5 &&
                        Math.abs(s.lhx - lh[0]) < 1e-5 && Math.abs(s.lhy - lh[1]) < 1e-5 && Math.abs(s.lhz - lh[2]) < 1e-5
                    ) {
                        skipEquipRebuild = true;
                    }
                }
                if (!skipEquipRebuild) {
                    _lastEquipRenderMode = "capsule";
                    _lastCapsuleEquipSig = {
                        name: heldName,
                        subToolMode: subToolMode,
                        hasWater: !!(heldItem && heldItem.hasWater),
                        arrowShot: !!effectiveArrowShot,
                        useTimer: effectiveUseAnimTimer,
                        batFill: curBatFill,
                        rgx: rg[0], rgy: rg[1], rgz: rg[2],
                        rax: ra[0], ray: ra[1], raz: ra[2],
                        rpx: rp[0], rpy: rp[1], rpz: rp[2],
                        rkx: rk[0], rky: rk[1], rkz: rk[2],
                        rex: re[0], rey: re[1], rez: re[2],
                        rhx: rh[0], rhy: rh[1], rhz: rh[2],
                        lex: le[0], ley: le[1], lez: le[2],
                        lhx: lh[0], lhy: lh[1], lhz: lh[2]
                    };
                }
            }

            if (!skipEquipRebuild) {
                let flatEquip = null;
                const rawV = [], rawC = [], rawI = [];
                
                const sub = _v3Sub;
                const add = _v3Add;
                const cross = _v3Crs;
                const normalize = (v) => _v3Nrm(v, [1, 0, 0]);
                const scale = _v3Scale;

                const addWedge = (pBase, pTip, widthBase, widthTip, thickness, color, thicknessDir = null) => {
                    const dir = sub(pTip, pBase);
                    const f = normalize(dir);
                    const charX = thicknessDir || [1, 0, 0];
                    const right = normalize(charX); 
                    const forward = normalize(cross(right, f));

                    const sx = scale(right, thickness * 0.5);
                    const wBase = scale(forward, widthBase * 0.5);
                    const wTip = scale(forward, widthTip * 0.5);

                    const vBaseIdx = rawV.length / 3;
                    const b1 = add(add(pBase, sx), wBase);
                    const b2 = add(sub(pBase, sx), wBase);
                    const b3 = sub(sub(pBase, sx), wBase);
                    const b4 = add(sub(pBase, wBase), sx);

                    const t1 = add(add(pTip, scale(sx, 0.1)), wTip);
                    const t2 = add(sub(pTip, scale(sx, 0.1)), wTip);
                    const t3 = sub(sub(pTip, scale(sx, 0.1)), wTip);
                    const t4 = add(sub(pTip, wTip), scale(sx, 0.1));

                    const pts = [b1, b2, b3, b4, t1, t2, t3, t4];
                    for (let p of pts) {
                        rawV.push(...p);
                        rawC.push(...color);
                    }
                    
                    const indices = [
                        0,3,2, 0,2,1,
                        4,5,6, 4,6,7,
                        0,1,5, 0,5,4,
                        3,7,6, 3,6,2,
                        0,4,7, 0,7,3,
                        1,2,6, 1,6,5
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
                    const rightDrawGrip = getHandGripFrame(rightElbowRot, rightHandRot, false).gripCenter;
                    let wNock;
                    if (!effectiveArrowShot && effectiveUseAnimTimer > 0) {
                        wNock = isRag ? rightDrawGrip : transformPt(rightDrawGrip);
                    } else {
                        const wGripVal = wGrip;
                        const wHandVal = isRag ? rightDrawGrip : transformPt(rightDrawGrip);
                        const pullVec = [wHandVal[0] - wGripVal[0], wHandVal[1] - wGripVal[1], wHandVal[2] - wGripVal[2]];
                        const dist = Math.sqrt(pullVec[0]**2 + pullVec[1]**2 + pullVec[2]**2);
                        if (dist > 0.001) {
                            const pullDir = [pullVec[0] / dist, pullVec[1] / dist, pullVec[2] / dist];
                            let t_rel = 0;
                            if (effectiveLastBowShootTime) {
                                t_rel = (Date.now() - effectiveLastBowShootTime) / 1000.0;
                            }
                            const vibeAmp = 0.15 * bowScale * effectiveLastBowDrawPower * Math.cos(t_rel * 40.0) * Math.exp(-t_rel * 6.0);
                            wNock = [wGripVal[0] + pullDir[0] * vibeAmp, wGripVal[1] + pullDir[1] * vibeAmp, wGripVal[2] + pullDir[2] * vibeAmp];
                        } else {
                            wNock = wGripVal;
                        }
                    }

                    const bowColor = [0.55, 0.38, 0.22];
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

                    if (!effectiveArrowShot && effectiveUseAnimTimer > 0) {
                        const arrowDir = [wGrip[0] - wNock[0], wGrip[1] - wNock[1], wGrip[2] - wNock[2]];
                        const arrowLen = Math.sqrt(arrowDir[0]**2 + arrowDir[1]**2 + arrowDir[2]**2);
                        if (arrowLen > 0.001) {
                            arrowDir[0] /= arrowLen;
                            arrowDir[1] /= arrowLen;
                            arrowDir[2] /= arrowLen;
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
                } else if (heldItem && (heldItem.name === "GLOW_BATTERY" || heldItem.name === "GLOW_BATTERY_EMPTY")) {
                    const wHandleP1 = transformPt(axeHandleP1Rot);
                    const wHandleP2 = transformPt(axeHandleP2Rot);
                    if (typeof window.buildGlowBatteryHandModel === "function") {
                        window.buildGlowBatteryHandModel(heldItem, wHandleP1, wHandleP2, itemScale, rawV, rawC, rawI);
                    }
                } else if (heldItem && (heldItem.name === "BRANCH" || heldItem.name === "branch")) {
                    flatEquip = _getTransformedHeldFlatEquip(
                        "TOOL:BRANCH",
                        (v, c, idx) => _buildUnitHeldToolGeometry("BRANCH", v, c, idx),
                        transformPt(rightGripPos),
                        xformDir(rightKnuckleDir),
                        xformDir(rightArmDir),
                        xformDir(rightPalmIn),
                        itemScale,
                        isClone
                    );
                } else if (heldItem && (heldItem.name === "TANTO" || heldItem.name === "tanto") && typeof window.buildTantoModel === "function") {
                    if (shirasayaMode !== "idle" && typeof window.buildShirasayaModel === "function") {
                      const anaRightFrame = leftRigFrame || getHandGripFrame(leftElbowRot, leftHandRot, true, skillWristLeft, leftArmPivot);
                      if (shirasayaMode === "charging") {
                        const anaLeftFrame = rightRigFrame || getHandGripFrame(rightElbowRot, rightHandRot, false, skillWristRight, rightArmPivot);
                        const rawAlong = [
                          anaRightFrame.gripCenter[0] - anaLeftFrame.gripCenter[0],
                          anaRightFrame.gripCenter[1] - anaLeftFrame.gripCenter[1],
                          anaRightFrame.gripCenter[2] - anaLeftFrame.gripCenter[2]
                        ];
                        const aLen = Math.hypot(rawAlong[0], rawAlong[1], rawAlong[2]) || 1.0;
                        const alongDir = [rawAlong[0] / aLen, rawAlong[1] / aLen, rawAlong[2] / aLen];
                        const shiraPos = [
                          anaRightFrame.gripCenter[0] - alongDir[0] * 0.015 * itemScale,
                          anaRightFrame.gripCenter[1] - alongDir[1] * 0.015 * itemScale,
                          anaRightFrame.gripCenter[2] - alongDir[2] * 0.015 * itemScale
                        ];
                        const wGripPos = transformPt(shiraPos);
                        const wAxisAlong = xformDir(alongDir);
                        const wEdgeUp = xformDir(anaRightFrame.dArm);
                        const wThickRight = xformDir(anaRightFrame.palmIn);
                        flatEquip = _getTransformedHeldFlatEquip(
                          "SHIRASAYA",
                          (v, c, idx) => window.buildShirasayaModel(1.0, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], v, c, idx),
                          wGripPos, wAxisAlong, wEdgeUp, wThickRight, 0.31 * itemScale, isClone
                        );
                      } else if (shirasayaMode === "post_skill") {
                        const ws = anaRightFrame.weaponSocket;
                        const revAlong = ws ? ws.axisAlong : [-anaRightFrame.rKnuckle[0], -anaRightFrame.rKnuckle[1], -anaRightFrame.rKnuckle[2]];
                        const revEdge = ws ? ws.edgeUp : [-anaRightFrame.dArm[0], -anaRightFrame.dArm[1], -anaRightFrame.dArm[2]];
                        const shiraPos = [
                          anaRightFrame.gripCenter[0] - revAlong[0] * 0.048 * itemScale,
                          anaRightFrame.gripCenter[1] - revAlong[1] * 0.048 * itemScale,
                          anaRightFrame.gripCenter[2] - revAlong[2] * 0.048 * itemScale
                        ];
                        const wGripPos = transformPt(shiraPos);
                        const wAxisAlong = xformDir(revAlong);
                        const wEdgeUp = xformDir(revEdge);
                        const wThickRight = xformDir(anaRightFrame.palmIn);
                        flatEquip = _getTransformedHeldFlatEquip(
                          "SHIRASAYA",
                          (v, c, idx) => window.buildShirasayaModel(1.0, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], v, c, idx),
                          wGripPos, wAxisAlong, wEdgeUp, wThickRight, 0.31 * itemScale, isClone
                        );
                      } else {
                        const ws = anaRightFrame.weaponSocket;
                        const localAxisAlong = ws ? ws.axisAlong : anaRightFrame.rKnuckle;
                        const localEdgeUp = ws ? ws.edgeUp : anaRightFrame.dArm;
                        const localThickRight = ws ? ws.thickRight : anaRightFrame.palmIn;
                        const baseOrigin = ws ? ws.origin : anaRightFrame.gripCenter;
                        const shiraDashPos = [
                          baseOrigin[0] + localAxisAlong[0] * 0.038 * itemScale,
                          baseOrigin[1] + localAxisAlong[1] * 0.038 * itemScale,
                          baseOrigin[2] + localAxisAlong[2] * 0.038 * itemScale
                        ];
                        const wGripPos = transformPt(shiraDashPos);
                        const wAxisAlong = xformDir(localAxisAlong);
                        const wEdgeUp = xformDir(localEdgeUp);
                        const wThickRight = xformDir(localThickRight);
                        window.buildShirasayaModel(0.31 * itemScale, wGripPos, wAxisAlong, wEdgeUp, wThickRight, rawV, rawC, rawI);

                        const fadeOut = Math.max(0.0, Math.min(1.0, (1.0 - shirasayaDashProg) / 0.28));
                        if (shirasayaStep === 1 && shirasayaDashProg > 0.05 && shirasayaDashProg < 0.94) {
                          const thrustProg = Math.min(1.0, shirasayaDashProg / 0.75);
                          const thrustStart = transformPt([-0.05, 0.06 + bOffset, 0.15]);
                          const thrustTip = transformPt([-0.05, 0.06 + bOffset, 0.15 + 0.55 * thrustProg]);
                          addWedge(thrustStart, thrustTip, 0.045 * fadeOut, 0.008, 0.022, [0.82, 0.96, 1.0], [0, 1, 0]);
                        } else if (shirasayaStep === 2 && shirasayaDashProg > 0.05) {
                          const arcGrow = Math.min(1.0, shirasayaDashProg / 0.42);
                          _addSlashArcRibbon(
                            rawV, rawC, rawI,
                            transformPt([-0.03, 0.06 + bOffset, 0.08]),
                            [0, 0, 1], [-1, 0, 0], [0, 1, 0],
                            0.27, 0.27 + 0.31 * fadeOut,
                            -0.45, -0.45 + 1.88 * arcGrow, 22, 0.012,
                            [0.88, 0.99, 1.0], [0.20, 0.76, 1.0], 0.65, 0.35
                          );
                          _addSlashArcRibbon(
                            rawV, rawC, rawI,
                            transformPt([-0.03, 0.03 + bOffset, 0.08]),
                            [0, 0, 1], [-1, 0, 0], [0, 1, 0],
                            0.19, 0.19 + 0.14 * fadeOut,
                            -0.30, -0.30 + 1.65 * arcGrow, 18, 0.008,
                            [0.95, 1.0, 1.0], [0.35, 0.85, 1.0], 0.65, 0.35
                          );
                        } else if (shirasayaStep === 3) {
                          const ringSpin = shirasayaDashProg * Math.PI * 3.0;
                          const tiltA = normalize([0.14, 0.97, -0.18]);
                          const uA = normalize([Math.cos(ringSpin), -0.14 * Math.cos(ringSpin), Math.sin(ringSpin)]);
                          const vA = normalize(cross(tiltA, uA));
                          _addSlashArcRibbon(
                            rawV, rawC, rawI,
                            transformPt([0, 0.10 + bOffset, 0]),
                            uA, vA, tiltA,
                            0.30, 0.56,
                            0.0, Math.PI * 1.82, 24, 0.011,
                            [0.88, 0.99, 1.0], [0.22, 0.78, 1.0], 0.65, 0.35
                          );
                          const tiltB = normalize([-0.22, 0.94, 0.24]);
                          const uB = normalize([Math.cos(ringSpin + 2.1), 0.18, Math.sin(ringSpin + 2.1)]);
                          const vB = normalize(cross(tiltB, uB));
                          _addSlashArcRibbon(
                            rawV, rawC, rawI,
                            transformPt([0, 0.02 + bOffset, 0]),
                            uB, vB, tiltB,
                            0.24, 0.44,
                            0.0, Math.PI * 1.68, 20, 0.009,
                            [0.94, 1.0, 1.0], [0.32, 0.84, 1.0], 0.65, 0.35
                          );
                        } else if (shirasayaStep === 4 && shirasayaDashProg >= 0.14) {
                          const cleaveArcProg = Math.min(1.0, (shirasayaDashProg - 0.14) / 0.22);
                          const cleaveOrigin = transformPt([-0.08, 0.04 + bOffset, 0.14]);
                          _addSlashArcRibbon(
                            rawV, rawC, rawI,
                            cleaveOrigin,
                            [0, 0, 1], [0, 1, 0], [-1, 0, 0],
                            0.22, 0.22 + 0.28 * fadeOut,
                            0.88 - 1.38 * cleaveArcProg, 0.88, 20, 0.012,
                            [0.90, 0.99, 1.0], [0.18, 0.72, 1.0], 0.65, 0.35
                          );
                          if (shirasayaDashProg >= 0.26) {
                            const waveProg = Math.min(1.0, (shirasayaDashProg - 0.26) / 0.22);
                            const tipImpact = transformPt([-0.09, -0.34, 0.56]);
                            const spikeDirs = [
                              [-0.55, 0.65, 0.52], [-0.82, 0.42, 0.22], [-0.42, 0.78, -0.35],
                              [0.58, 0.62, 0.48], [0.85, 0.45, 0.18], [0.38, 0.82, -0.30],
                              [0.02, 0.88, 0.45]
                            ];
                            const spScale = (0.12 + 0.14 * waveProg) * Math.max(0.25, fadeOut);
                            _emitGroundShatterSpikes(addWedge, tipImpact, spikeDirs, spScale, 0.032, 0.002, 0.014, [0.78, 0.96, 1.0], [0.22, 0.76, 1.0]);
                          }
                        }
                      }
                    } else {
                      const wGripPos = transformPt(rightGripPos);
                      const wAxisAlong = xformDir(rightKnuckleDir);
                      const wEdgeUp = xformDir(rightArmDir);
                      const wThickRight = xformDir(rightPalmIn);
                      flatEquip = _getTransformedHeldFlatEquip(
                        "TANTO",
                        (v, c, idx) => window.buildTantoModel(1.0, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], v, c, idx),
                        wGripPos, wAxisAlong, wEdgeUp, wThickRight, 0.28 * itemScale, isClone
                      );
                    }
                } else if (heldItem && (heldItem.name === "AEGIS_SHIFT" || heldItem.name === "aegis_shift") && typeof window.buildAegisShiftModel === "function") {
                    if (aegisMode !== "idle") {
                      const anaRightFrame = leftRigFrame || getHandGripFrame(leftElbowRot, leftHandRot, true, skillWristLeft, leftArmPivot);
                      const anaLeftFrame = rightRigFrame || getHandGripFrame(rightElbowRot, rightHandRot, false, skillWristRight, rightArmPivot);
                      const rawAlong = [
                        anaRightFrame.gripCenter[0] - anaLeftFrame.gripCenter[0],
                        anaRightFrame.gripCenter[1] - anaLeftFrame.gripCenter[1],
                        anaRightFrame.gripCenter[2] - anaLeftFrame.gripCenter[2]
                      ];
                      const alongLen = Math.hypot(rawAlong[0], rawAlong[1], rawAlong[2]);
                      const wsR = anaRightFrame.weaponSocket;
                      const curAlong = (alongLen > 0.025)
                        ? [rawAlong[0] / alongLen, rawAlong[1] / alongLen, rawAlong[2] / alongLen]
                        : (wsR ? wsR.axisAlong : anaRightFrame.rKnuckle);
                      const rawEdge = (skillWristLeft && skillWristLeft.swordEdge)
                        ? skillWristLeft.swordEdge
                        : ((wsR && wsR.edgeUp) ? wsR.edgeUp : anaRightFrame.dArm);
                      const dotEA = rawEdge[0] * curAlong[0] + rawEdge[1] * curAlong[1] + rawEdge[2] * curAlong[2];
                      const curEdge = normalize([
                        rawEdge[0] - curAlong[0] * dotEA,
                        rawEdge[1] - curAlong[1] * dotEA,
                        rawEdge[2] - curAlong[2] * dotEA
                      ]);
                      const curThick = normalize(cross(curAlong, curEdge));
                      const gsScale = 0.36 * itemScale;
                      const midGrip = [
                        0.5 * (anaLeftFrame.gripCenter[0] + anaRightFrame.gripCenter[0]),
                        0.5 * (anaLeftFrame.gripCenter[1] + anaRightFrame.gripCenter[1]),
                        0.5 * (anaLeftFrame.gripCenter[2] + anaRightFrame.gripCenter[2])
                      ];
                      const modelBaseLocal = [
                        midGrip[0] + curAlong[0] * (0.04 * gsScale),
                        midGrip[1] + curAlong[1] * (0.04 * gsScale),
                        midGrip[2] + curAlong[2] * (0.04 * gsScale)
                      ];
                      const wGripPos = transformPt(modelBaseLocal);

                      if (aegisMode === "dashing") {
                        window.buildAegisShiftModel(gsScale, wGripPos, xformDir(curAlong), xformDir(curEdge), xformDir(curThick), rawV, rawC, rawI, "greatsword");
                        const fadeOutGs = Math.max(0.0, Math.min(1.0, (1.0 - aegisDashProg) / 0.32));
                        const gsC = [0.86, 0.99, 1.0], gsRim = [0.20, 0.86, 1.0];

                        if (aegisStep === 1 && aegisDashProg >= 0.14 && aegisDashProg < 0.94) {
                          const arcGrowGs = Math.min(1.0, (aegisDashProg - 0.14) / 0.30);
                          const gsCenter = transformPt([0.0, 0.04 + bOffset, 0.16]);
                          const gsN = normalize([-0.92, -0.32, 0.22]);
                          const gsU = normalize([0.16, -0.20, 0.96]);
                          const gsV = normalize(cross(gsN, gsU));
                          _addSlashArcRibbon(rawV, rawC, rawI, gsCenter, gsU, gsV, gsN, 0.28, 0.28 + 0.42 * fadeOutGs, 0.98 - 1.25 * arcGrowGs, 0.98, 24, 0.016, gsC, gsRim, 0.7, 0.3);
                          if (aegisDashProg >= 0.32) {
                            const waveGs = Math.min(1.0, (aegisDashProg - 0.32) / 0.22);
                            const tipImpactGs = transformPt([0.04, -0.34, 0.58]);
                            const spikeDirsGs = [
                              [-0.55, 0.65, 0.52], [-0.82, 0.42, 0.22], [-0.42, 0.78, -0.35],
                              [0.58, 0.62, 0.48], [0.85, 0.45, 0.18], [0.38, 0.82, -0.30],
                              [0.02, 0.88, 0.45]
                            ];
                            const spScaleGs = (0.14 + 0.16 * waveGs) * Math.max(0.25, fadeOutGs);
                            _emitGroundShatterSpikes(addWedge, tipImpactGs, spikeDirsGs, spScaleGs, 0.036, 0.002, 0.016, [0.78, 0.96, 1.0], [0.22, 0.76, 1.0]);
                          }
                        } else if (aegisStep === 2 && aegisDashProg >= 0.12 && aegisDashProg < 0.94) {
                          const arcGrow2 = Math.min(1.0, (aegisDashProg - 0.12) / 0.34);
                          const gsCenter2 = transformPt([0.0, 0.02 + bOffset, 0.14]);
                          const gsN2 = normalize([-0.52, 0.42, -0.74]);
                          const gsU2 = normalize([0.0, 0.0, 1.0]);
                          const gsV2 = normalize(cross(gsN2, gsU2));
                          _addSlashArcRibbon(rawV, rawC, rawI, gsCenter2, gsU2, gsV2, gsN2, 0.28, 0.28 + 0.44 * fadeOutGs, -1.05, -1.05 + 2.05 * arcGrow2, 24, 0.017, gsC, gsRim, 0.7, 0.3);
                        } else if (aegisStep === 3 && aegisDashProg >= 0.12 && aegisDashProg < 0.94) {
                          const arcGrow3 = Math.min(1.0, (aegisDashProg - 0.12) / 0.34);
                          const gsCenter3 = transformPt([0.0, -0.02 + bOffset, 0.10]);
                          const gsN3 = [0, 1, 0];
                          const gsU3 = [0, 0, 1];
                          const gsV3 = [-1, 0, 0];
                          _addSlashArcRibbon(rawV, rawC, rawI, gsCenter3, gsU3, gsV3, gsN3, 0.30, 0.30 + 0.46 * fadeOutGs, -0.95, -0.95 + 2.10 * arcGrow3, 26, 0.018, gsC, gsRim, 0.7, 0.3);
                          _addSlashArcRibbon(rawV, rawC, rawI, transformPt([0.0, -0.05 + bOffset, 0.10]), gsU3, gsV3, gsN3, 0.22, 0.22 + 0.24 * fadeOutGs, -0.75, -0.75 + 1.80 * arcGrow3, 20, 0.011, gsC, gsRim, 0.7, 0.3);
                        } else if (aegisStep === 4 && aegisDashProg >= 0.24 && aegisDashProg < 0.96) {
                          const arcGrow4 = Math.min(1.0, (aegisDashProg - 0.24) / 0.24);
                          const gsCenter4 = transformPt([0.0, 0.05 + bOffset, 0.14]);
                          const gsN4 = [-1, 0, 0];
                          const gsU4 = [0, 0, 1];
                          const gsV4 = [0, 1, 0];
                          _addSlashArcRibbon(rawV, rawC, rawI, gsCenter4, gsU4, gsV4, gsN4, 0.28, 0.28 + 0.46 * fadeOutGs, 1.05 - 1.48 * arcGrow4, 1.05, 24, 0.019, gsC, gsRim, 0.7, 0.3);
                          if (aegisDashProg >= 0.38) {
                            const wave4 = Math.min(1.0, (aegisDashProg - 0.38) / 0.22);
                            const tipImpact4 = transformPt([0.0, -0.34, 0.62]);
                            const spikeDirs4 = [
                              [-0.65, 0.62, 0.44], [-0.88, 0.38, 0.15], [-0.45, 0.78, -0.32],
                              [0.65, 0.62, 0.44], [0.88, 0.38, 0.15], [0.45, 0.78, -0.32],
                              [0.0, 0.92, 0.38], [-0.25, 0.75, 0.60], [0.25, 0.75, 0.60]
                            ];
                            const spScale4 = (0.18 + 0.20 * wave4) * Math.max(0.25, fadeOutGs);
                            _emitGroundShatterSpikes(addWedge, tipImpact4, spikeDirs4, spScale4, 0.044, 0.003, 0.020, [0.82, 0.98, 1.0], [0.20, 0.78, 1.0]);
                          }
                        }
                      } else {
                        flatEquip = _getTransformedHeldFlatEquip(
                          "AEGIS_SHIFT:greatsword",
                          (v, c, idx) => window.buildAegisShiftModel(1.0, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], v, c, idx, "greatsword"),
                          wGripPos, xformDir(curAlong), xformDir(curEdge), xformDir(curThick), gsScale, isClone
                        );
                      }
                    } else {
                      const aStTool = (typeof window.aegisShiftState === "object") ? window.aegisShiftState : null;
                      const subToolMode = (aStTool && aStTool.toolMode === "axe") ? "axe" : "pickaxe";
                      const wGripPos = transformPt(rightGripPos);
                      const wAxisAlong = xformDir(rightKnuckleDir);
                      const wEdgeUp = xformDir(rightArmDir);
                      const wThickRight = xformDir(rightPalmIn);
                      flatEquip = _getTransformedHeldFlatEquip(
                        "AEGIS_SHIFT:" + subToolMode,
                        (v, c, idx) => window.buildAegisShiftModel(1.0, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], v, c, idx, subToolMode),
                        wGripPos, wAxisAlong, wEdgeUp, wThickRight, 0.32 * itemScale, isClone
                      );
                    }
                } else if (heldItem && (heldItem.name === "AXE" || heldItem.name === "PICKAXE" || heldItem.name === "SHOVEL")) {
                    const toolType = heldItem.name;
                    flatEquip = _getTransformedHeldFlatEquip(
                        "TOOL:" + toolType,
                        (v, c, idx) => _buildUnitHeldToolGeometry(toolType, v, c, idx),
                        transformPt(rightGripPos),
                        xformDir(rightKnuckleDir),
                        xformDir(rightArmDir),
                        xformDir(rightPalmIn),
                        itemScale,
                        isClone
                    );
                } else if (heldItem && heldItem.name === "OBSIDIAN_FLUX" && typeof window.buildObsidianFluxModel === "function") {
                    const handPos = transformPt([
                        rightGripPos[0] + rightPalmIn[0] * 0.022 * itemScale,
                        rightGripPos[1] + rightPalmIn[1] * 0.022 * itemScale,
                        rightGripPos[2] + rightPalmIn[2] * 0.022 * itemScale
                    ]);
                    flatEquip = _getTransformedHeldFlatEquip(
                        "OBSIDIAN_FLUX",
                        (v, c, idx) => window.buildObsidianFluxModel(1234, 0, false, false, 1.0, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], v, c, idx),
                        handPos,
                        [1, 0, 0],
                        [0, 1, 0],
                        [0, 0, 1],
                        0.15 * itemScale,
                        isClone
                    );
                } else if (heldItem && (heldItem.name === "DRAGON_FRUIT" || heldItem.name === "dragon_fruit") && typeof window.buildDragonFruitModel === "function") {
                    const handPos = transformPt([
                        rightGripPos[0] + rightPalmIn[0] * 0.016 * itemScale + rightKnuckleDir[0] * 0.012 * itemScale,
                        rightGripPos[1] + rightPalmIn[1] * 0.016 * itemScale + rightKnuckleDir[1] * 0.012 * itemScale,
                        rightGripPos[2] + rightPalmIn[2] * 0.016 * itemScale + rightKnuckleDir[2] * 0.012 * itemScale
                    ]);
                    flatEquip = _getTransformedHeldFlatEquip(
                        "DRAGON_FRUIT",
                        (v, c, idx) => window.buildDragonFruitModel(1234, 1.0, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], v, c, idx),
                        handPos,
                        rightArmDir,
                        rightKnuckleDir,
                        rightPalmIn,
                        0.24 * itemScale,
                        isClone
                    );
                } else if (heldItem && (heldItem.name === "FRIED_BUG" || heldItem.name === "fried_bug") && typeof window.buildFriedBugModel === "function") {
                    const handPos = transformPt([
                        rightGripPos[0] + rightPalmIn[0] * 0.018 * itemScale + rightKnuckleDir[0] * 0.012 * itemScale,
                        rightGripPos[1] + rightPalmIn[1] * 0.018 * itemScale + rightKnuckleDir[1] * 0.012 * itemScale,
                        rightGripPos[2] + rightPalmIn[2] * 0.018 * itemScale + rightKnuckleDir[2] * 0.012 * itemScale
                    ]);
                    flatEquip = _getTransformedHeldFlatEquip(
                        "FRIED_BUG",
                        (v, c, idx) => window.buildFriedBugModel(1234, 1.0, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], v, c, idx),
                        handPos,
                        rightArmDir,
                        rightKnuckleDir,
                        rightPalmIn,
                        0.55 * itemScale,
                        isClone
                    );
                } else if (((heldItem && (heldItem.name === "IRON_BUCKET" || heldItem.name === "iron_bucket" || heldItem.name === "WATER_BUCKET" || heldItem.name === "water_bucket")) || isWateringBucketAnim) && typeof window.buildIronBucketModel === "function") {
                    const handPos = transformPt([
                        rightGripPos[0] - 0.016 * itemScale,
                        rightGripPos[1] + 0.031 * itemScale,
                        rightGripPos[2] + 0.007 * itemScale
                    ]);
                    buildHeldIronBucketMesh(handPos, itemScale, heldItem, rawV, rawC, rawI, true, chibiBucketPourPose);
                } else if (heldItem && (heldItem.name === "COTTON_PLANT" || heldItem.name === "cotton_plant" || heldItem.name === "COTTON" || heldItem.name === "cotton") && typeof window.buildCottonPlant === "function") {
                    const handPos = transformPt([
                        rightGripPos[0] - rightKnuckleDir[0] * 0.03 * itemScale,
                        rightGripPos[1] - rightKnuckleDir[1] * 0.03 * itemScale,
                        rightGripPos[2] - rightKnuckleDir[2] * 0.03 * itemScale
                    ]);
                    flatEquip = _getTransformedHeldFlatEquip(
                        "COTTON_PLANT",
                        (v, c, idx) => window.buildCottonPlant(0, 0, 0, 0, 1, 0, [1, 0, 0], [0, 0, 1], [0, 1, 0], 1234, v, c, idx, false),
                        handPos,
                        rightArmDir,
                        rightKnuckleDir,
                        rightPalmIn,
                        1.0,
                        isClone
                    );
                } else if (heldItem && (heldItem.name === "CROWN_FLOWER" || heldItem.name === "crown_flower") && typeof window.buildCrownFlowerPlant === "function") {
                    const handPos = transformPt([
                        rightGripPos[0] - rightKnuckleDir[0] * 0.03 * itemScale,
                        rightGripPos[1] - rightKnuckleDir[1] * 0.03 * itemScale,
                        rightGripPos[2] - rightKnuckleDir[2] * 0.03 * itemScale
                    ]);
                    flatEquip = _getTransformedHeldFlatEquip(
                        "CROWN_FLOWER",
                        (v, c, idx) => window.buildCrownFlowerPlant(0, 0, 0, 0, 1, 0, [1, 0, 0], [0, 0, 1], [0, 1, 0], 1234, v, c, idx, false),
                        handPos,
                        rightArmDir,
                        rightKnuckleDir,
                        rightPalmIn,
                        1.0,
                        isClone
                    );
                } else if (heldItem && (heldItem.name === "TOUGH_MEAT" || heldItem.name === "tough_meat") && typeof window.buildToughMeatModel === "function") {
                    const handPos = transformPt([
                        rightGripPos[0] + rightPalmIn[0] * 0.018 * itemScale + rightKnuckleDir[0] * 0.012 * itemScale,
                        rightGripPos[1] + rightPalmIn[1] * 0.018 * itemScale + rightKnuckleDir[1] * 0.012 * itemScale,
                        rightGripPos[2] + rightPalmIn[2] * 0.018 * itemScale + rightKnuckleDir[2] * 0.012 * itemScale
                    ]);
                    flatEquip = _getTransformedHeldFlatEquip(
                        "TOUGH_MEAT",
                        (v, c, idx) => window.buildToughMeatModel({ isIconPreview: false, size: 1.0, position: [0, 0, 0], R: [1, 0, 0], normal: [0, 1, 0], F: [0, 0, 1] }, v, c, idx, "held"),
                        handPos,
                        rightArmDir,
                        rightKnuckleDir,
                        rightPalmIn,
                        0.45 * itemScale,
                        isClone
                    );
                }

                if (!flatEquip && rawI.length > 0) {
                    flatEquip = makeFlatShadedGeometry(rawV, rawC, rawI);
                }

                if (!isClone) {
                    if (flatEquip && flatEquip.indices && flatEquip.indices.length > 0) {
                        _uploadFlatEquipToGL(gl, flatEquip);
                    } else {
                        equipIndicesLength = 0;
                    }
                } else if (flatEquip && flatEquip.indices && flatEquip.indices.length > 0) {
                    meshesToMerge.push(flatEquip);
                }
            }
        } else {
            if (!isClone) {
                equipIndicesLength = 0;
                _lastCapsuleEquipSig = null;
            }
        }

        const merged = mergeMeshes(meshesToMerge);
        const localVertData = _buildPatchedLocalVerts(
          merged.vertices,
          meshesToMerge,
          isClone ? null : playerHairMesh,
          isClone ? null : playerLocalHairDummyV,
          isClone ? primaryCloneHoodie : playerHoodieMesh
        );
        if (isClone) {
          const uploadCloneBufSet = (targetObj, mData, lVertData) => {
            targetObj.indicesLength = mData.indices.length;

            const vertData = mData.vertices instanceof Float32Array ? mData.vertices : new Float32Array(mData.vertices);
            const normData = mData.normals instanceof Float32Array ? mData.normals : new Float32Array(mData.normals);
            const colData = mData.colors instanceof Float32Array ? mData.colors : new Float32Array(mData.colors);

            if (!targetObj.vertexBuffer) targetObj.vertexBuffer = gl.createBuffer();
            uploadDynamicBuffer(gl, targetObj.vertexBuffer, gl.ARRAY_BUFFER, vertData);

            if (!targetObj.localVertexBuffer) targetObj.localVertexBuffer = gl.createBuffer();
            uploadDynamicBuffer(gl, targetObj.localVertexBuffer, gl.ARRAY_BUFFER, lVertData);

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

          if (cloneState) {
            cloneState._headP1 = [headP1[0], headP1[1], headP1[2]];
            cloneState._scale = scaleFactor;
            cloneState._phase = phase;
            cloneState._walkBlend = cloneWalkBlend;
            cloneState._animTick = (cloneState._animTick || 0) + 1;

            if (canUseSharedCloneBodyCache && cloneBodyCacheKey) {
              const sharedBufSet = {};
              uploadCloneBufSet(sharedBufSet, merged, localVertData);
              sharedBufSet.isSharedCache = true;
              sharedBufSet.headP1 = [headP1[0], headP1[1], headP1[2]];
              sharedBufSet.scale = scaleFactor;
              if (window._cloneBodyBufferCache.size >= 192) {
                const oldestKey = window._cloneBodyBufferCache.keys().next().value;
                if (oldestKey !== undefined) window._cloneBodyBufferCache.delete(oldestKey);
              }
              window._cloneBodyBufferCache.set(cloneBodyCacheKey, sharedBufSet);
              cloneState._meshBuffers = sharedBufSet;
            } else {
              if (!cloneState._privateMeshBuffers) cloneState._privateMeshBuffers = {};
              uploadCloneBufSet(cloneState._privateMeshBuffers, merged, localVertData);
              cloneState._meshBuffers = cloneState._privateMeshBuffers;
            }
            if (!window.cloneMeshBuffers) {
              window.cloneMeshBuffers = cloneState._meshBuffers;
            }
          } else {
            if (!window.cloneMeshBuffers) window.cloneMeshBuffers = {};
            uploadCloneBufSet(window.cloneMeshBuffers, merged, localVertData);

            if (cloneOpenHoodieMesh) {
              const openList = [cloneBaseWelded, cloneOpenHoodieMesh];
              const openMerged = mergeMeshes(openList);
              const openLocalVerts = _buildPatchedLocalVerts(openMerged.vertices, openList, null, null, cloneOpenHoodieMesh);
              if (!window.cloneOpenHoodieMeshBuffers) window.cloneOpenHoodieMeshBuffers = {};
              uploadCloneBufSet(window.cloneOpenHoodieMeshBuffers, openMerged, openLocalVerts);
            }
          }

          if (!window.getCloneHairBuffers) {
            window._cloneHairBufferCache = new Map();
            window._cloneHairPoseBufferCache = new Map();
            window.getCloneHairBuffers = function(glCtx, styleIdx, colorIdx, isHoodOpen, targetClone = null) {
              if (!glCtx || typeof window.build3DAnimeHair !== "function") return null;
              const numStyles = window.NUM_HAIR_STYLES || 9;
              const colors = window.ANIME_HAIR_COLORS || [[0.85, 0.90, 0.96]];
              const sIdx = (((styleIdx | 0) % numStyles) + numStyles) % numStyles;
              const cIdx = (((colorIdx | 0) % colors.length) + colors.length) % colors.length;
              const openFlag = isHoodOpen ? 1 : 0;
              const baseKey = `v12_chibi_hair_freefall_${sIdx}_${cIdx}_${openFlag}`;

              let baseEntry = window._cloneHairBufferCache.get(baseKey);
              if (!baseEntry) {
                const built = getOrBuildSharedLocalHairMesh(sIdx, colors[cIdx], 1.0, !isHoodOpen);
                const bm = built.baseMesh;
                const finalV = bm.localV;
                const finalC = bm.colors;
                const finalI = bm.indices;
                const finalF = bm.flexW;
                const normals = bm.normals;
                const localDummyV = built.localDummyV;

                const localVertexBuffer = glCtx.createBuffer();
                const normalBuffer = glCtx.createBuffer();
                const colorBuffer = glCtx.createBuffer();
                const indexBuffer = glCtx.createBuffer();

                glCtx.bindBuffer(glCtx.ARRAY_BUFFER, localVertexBuffer);
                glCtx.bufferData(glCtx.ARRAY_BUFFER, localDummyV instanceof Float32Array ? localDummyV : new Float32Array(localDummyV), glCtx.STATIC_DRAW);

                glCtx.bindBuffer(glCtx.ARRAY_BUFFER, normalBuffer);
                glCtx.bufferData(glCtx.ARRAY_BUFFER, normals instanceof Float32Array ? normals : new Float32Array(normals), glCtx.STATIC_DRAW);

                glCtx.bindBuffer(glCtx.ARRAY_BUFFER, colorBuffer);
                glCtx.bufferData(glCtx.ARRAY_BUFFER, finalC instanceof Float32Array ? finalC : new Float32Array(finalC), glCtx.STATIC_DRAW);

                const indicesLength = finalI.length;
                glCtx.bindBuffer(glCtx.ELEMENT_ARRAY_BUFFER, indexBuffer);
                const idxData = (indicesLength > 65535)
                  ? (finalI instanceof Uint32Array ? finalI : new Uint32Array(finalI))
                  : (finalI instanceof Uint16Array ? finalI : new Uint16Array(finalI));
                glCtx.bufferData(glCtx.ELEMENT_ARRAY_BUFFER, idxData, glCtx.STATIC_DRAW);

                baseEntry = {
                  localV: finalV instanceof Float32Array ? finalV : new Float32Array(finalV),
                  flexW: finalF instanceof Float32Array ? finalF : new Float32Array(finalF),
                  localVertexBuffer,
                  normalBuffer,
                  colorBuffer,
                  indexBuffer,
                  indicesLength
                };
                window._cloneHairBufferCache.set(baseKey, baseEntry);
              }

              if (!baseEntry || baseEntry.indicesLength <= 0) {
                return null;
              }

              // Compute pose-quantized LOD key so clones wearing identical hair in the same LOD pose share 1 GPU vertexBuffer (0 CPU/GPU thrashing!)
              const cloneLod = (targetClone && typeof targetClone._lod === "number") ? targetClone._lod : 0;
              const hp = (targetClone && targetClone._headP1) ? targetClone._headP1 : (window._cloneCurrentHeadP1 || [0, 0.23, 0]);
              const sc = (targetClone && targetClone._scale) ? targetClone._scale : (window._cloneCurrentScale || 1.0);
              const rawPh = (targetClone && typeof targetClone._phase === "number") ? targetClone._phase : (window._cloneCurrentPhase || 0.0);
              const walkBlend = (targetClone && typeof targetClone._walkBlend === "number") ? targetClone._walkBlend : (window._cloneCurrentWalkBlend || 0.0);

              const tau = Math.PI * 2.0;
              let wrapPh = rawPh % tau;
              if (wrapPh < 0.0) wrapPh += tau;

              let phBucket = 0;
              let walkBucket = 0;
              let hxQ = Math.round(hp[0] * 100);
              let hyQ = Math.round(hp[1] * 100);
              let hzQ = Math.round(hp[2] * 100);
              let quantizedPh = 0.0;
              let quantizedWalk = 0.0;

              if (cloneLod === 0) {
                walkBucket = walkBlend <= 0.02 ? 0 : Math.max(1, Math.round(walkBlend * 6));
                quantizedWalk = walkBucket / 6.0;
                const steps = 24;
                phBucket = (walkBucket === 0) ? 0 : (Math.round((wrapPh / tau) * steps) % steps);
                quantizedPh = (phBucket / steps) * tau;
                hxQ = Math.round(hp[0] * 200);
                hyQ = Math.round(hp[1] * 200);
                hzQ = Math.round(hp[2] * 200);
              } else if (cloneLod === 1) {
                walkBucket = walkBlend <= 0.05 ? 0 : Math.max(1, Math.round(walkBlend * 3));
                quantizedWalk = walkBucket / 3.0;
                const steps = 12;
                phBucket = (walkBucket === 0) ? 0 : (Math.round((wrapPh / tau) * steps) % steps);
                quantizedPh = (phBucket / steps) * tau;
                hxQ = Math.round(hp[0] * 50);
                hyQ = Math.round(hp[1] * 50);
                hzQ = Math.round(hp[2] * 50);
              } else {
                // LOD 2 (Far): Static rigid head-locked hair -> 1 shared GPU VBO for all far clones with this style+color!
                walkBucket = 0;
                phBucket = 0;
                quantizedWalk = 0.0;
                quantizedPh = 0.0;
                hxQ = Math.round(hp[0] * 25);
                hyQ = Math.round(hp[1] * 25);
                hzQ = Math.round(hp[2] * 25);
              }

              const scQ = Math.round(sc * 1000);
              const poseKey = `${baseKey}_l${cloneLod}_${hxQ}_${hyQ}_${hzQ}_${scQ}_${phBucket}_${walkBucket}`;

              let poseEntry = window._cloneHairPoseBufferCache.get(poseKey);
              if (poseEntry && poseEntry.vertexBuffer) {
                window._cloneHairPoseBufferCache.delete(poseKey);
                window._cloneHairPoseBufferCache.set(poseKey, poseEntry);
                return poseEntry;
              }

              const hx = (cloneLod >= 2) ? (hxQ / 25.0) : hp[0];
              const hy = (cloneLod >= 2) ? (hyQ / 25.0) : hp[1];
              const hz = (cloneLod >= 2) ? (hzQ / 25.0) : hp[2];
              const lv = baseEntry.localV;
              const fw = baseEntry.flexW;
              const wv = new Float32Array(lv.length);

              if (cloneLod >= 2 || quantizedWalk <= 0.001) {
                for (let k = 0; k < lv.length; k += 3) {
                  wv[k]     = hx + lv[k] * sc;
                  wv[k + 1] = hy + lv[k + 1] * sc;
                  wv[k + 2] = hz + lv[k + 2] * sc;
                }
              } else {
                const walkX = Math.sin(quantizedPh) * 0.006 * quantizedWalk;
                const walkZ = Math.cos(quantizedPh * 2.0) * 0.005 * quantizedWalk;
                const walkY = -Math.abs(Math.sin(quantizedPh)) * 0.0035 * quantizedWalk;
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
                  const wave = Math.sin(quantizedPh * 1.2 + ly * 8.0 + (lx - lz) * 4.0) * 0.002 * flexW;
                  wv[k]     = hx + (lx + walkX * flexW + wave) * sc;
                  wv[k + 1] = hy + (ly + walkY * flexW) * sc;
                  wv[k + 2] = hz + (lz + walkZ * flexW + wave) * sc;
                }
              }

              const vertexBuffer = glCtx.createBuffer();
              glCtx.bindBuffer(glCtx.ARRAY_BUFFER, vertexBuffer);
              glCtx.bufferData(glCtx.ARRAY_BUFFER, wv, glCtx.STATIC_DRAW);

              poseEntry = {
                vertexBuffer,
                localVertexBuffer: baseEntry.localVertexBuffer,
                normalBuffer: baseEntry.normalBuffer,
                colorBuffer: baseEntry.colorBuffer,
                indexBuffer: baseEntry.indexBuffer,
                indicesLength: baseEntry.indicesLength
              };
              if (window._cloneHairPoseBufferCache.size >= 256) {
                const oldestKey = window._cloneHairPoseBufferCache.keys().next().value;
                if (oldestKey !== undefined) window._cloneHairPoseBufferCache.delete(oldestKey);
              }
              window._cloneHairPoseBufferCache.set(poseKey, poseEntry);
              return poseEntry;
            };
          }
          return;
        }

        charIndicesLength = merged.indices.length;
        charRawVertices = merged.vertices;

        const vertData = merged.vertices instanceof Float32Array ? merged.vertices : new Float32Array(merged.vertices);
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

      let _charMatCacheKey = "";
      let _charMatCacheVal = null;

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

        // Fast per-frame memoization so repeated calls (hair, hoodie, equip, shadow pass, main pass) don't recompute terrain/cave SDFs 8x/frame
        const _shiraMatStPre = (!ragdollEnabled && !activeRidingBoat && !(typeof activeRidingMech !== "undefined" && activeRidingMech)
          && !(typeof window !== "undefined" && !window.GLB_DISABLED && window.characterModel === "chibi")
          && typeof window !== "undefined" && ((window.tantoShirasayaState && window.tantoShirasayaState.mode === "dashing") || (window.aegisShiftState && window.aegisShiftState.mode === "dashing")))
          ? ((window.aegisShiftState && window.aegisShiftState.mode === "dashing") ? window.aegisShiftState : window.tantoShirasayaState)
          : null;
        const _shiraLiftPre = _shiraMatStPre ? (_shiraMatStPre.visualAirLift || 0.0) : 0.0;
        const _shiraSpinPre = _shiraMatStPre ? (_shiraMatStPre.visualSpinYaw || 0.0) : 0.0;
        const _curSwimF = (typeof currentSwimFactor === "number") ? currentSwimFactor : 0.0;
        const _curSwimM = (typeof swimMovementFactor === "number") ? swimMovementFactor : 0.0;
        const _boatPosKey = (activeRidingBoat && activeRidingBoat.position)
          ? `${activeRidingBoat.position[0]}_${activeRidingBoat.position[1]}_${activeRidingBoat.position[2]}_${activeRidingBoat.bankAngle || 0}`
          : "0";
        const _matKey = `${charTheta}_${charPhi}_${charHeading}_${playerCenterRadius}_${playerScale}_${ragdollEnabled ? 1 : 0}_${_boatPosKey}_${(typeof activeRidingMech !== "undefined" && activeRidingMech) ? 1 : 0}_${_curSwimF}_${_curSwimM}_${typeof playerDiveDepth === "number" ? playerDiveDepth : 0}_${_shiraLiftPre}_${_shiraSpinPre}_${waterEnabled ? 1 : 0}_${waterLevel}_${RADIUS}_${HEIGHT_SCALE}_${typeof window !== "undefined" ? window.characterModel : ""}`;
        if (!ragdollEnabled && !activeRidingBoat && _curSwimF <= 0.0001 && _charMatCacheVal && _charMatCacheKey === _matKey) {
          return _charMatCacheVal;
        }

        const sinTheta = Math.sin(charTheta);
        const cosTheta = Math.cos(charTheta);
        const sinPhi = Math.sin(charPhi);
        const cosPhi = Math.cos(charPhi);

        const nx = sinTheta * cosPhi;
        const ny = cosTheta;
        const nz = sinTheta * sinPhi;

        const charScale = playerScale;
        let terrainRadius = 0;
        let waterRadius = 0;
        let swimFactor = 0.0;
        let caveData = null;

        // Fast-path on dry land when playerCenterRadius is already computed: skip expensive terrain noise + cave SDF + water queries!
        const canSkipTerrainLookup = (
          playerCenterRadius !== null &&
          !activeRidingBoat &&
          !(typeof activeRidingMech !== "undefined" && activeRidingMech) &&
          (!waterEnabled || _curSwimF <= 0.0001)
        );

        if (!canSkipTerrainLookup) {
          const height = getVisualHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));

          let feetRadiusBefore = (typeof playerCenterRadius !== 'undefined' && playerCenterRadius !== null) ? (playerCenterRadius - 0.46 * charScale) : (RADIUS + height * HEIGHT_SCALE);
          caveData = typeof getTerrainSurfaceAndCeiling === "function"
            ? getTerrainSurfaceAndCeiling(nx, ny, nz, feetRadiusBefore)
            : { ground: RADIUS + height * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };
          terrainRadius = caveData.ground;
          waterRadius = (typeof Physics !== "undefined" && typeof Physics.getCanonicalWaterRadius === "function")
            ? Physics.getCanonicalWaterRadius(RADIUS, waterLevel, HEIGHT_SCALE)
            : (RADIUS + waterLevel * (typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE * 0.25 : 0.15));
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

        const shiraMatSt = (!ragdollEnabled && !activeRidingBoat && !(typeof activeRidingMech !== "undefined" && activeRidingMech)
          && !(typeof window !== "undefined" && !window.GLB_DISABLED && window.characterModel === "chibi")
          && typeof window !== "undefined" && ((window.tantoShirasayaState && window.tantoShirasayaState.mode === "dashing") || (window.aegisShiftState && window.aegisShiftState.mode === "dashing")))
          ? ((window.aegisShiftState && window.aegisShiftState.mode === "dashing") ? window.aegisShiftState : window.tantoShirasayaState)
          : null;
        const shiraAirLift = shiraMatSt ? (shiraMatSt.visualAirLift || 0.0) : 0.0;
        const shiraSpinYaw = shiraMatSt ? (shiraMatSt.visualSpinYaw || 0.0) : 0.0;
        const effectiveGroundRadius = groundRadius + shiraAirLift * charScale;

        let px = effectiveGroundRadius * nx;
        let py = effectiveGroundRadius * ny;
        let pz = effectiveGroundRadius * nz;

        const N = [nx, ny, nz];

        const East = [-sinPhi, 0, cosPhi];
        const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];

        const effectiveCharHeading = charHeading + shiraSpinYaw;
        const cosH = Math.cos(effectiveCharHeading);
        const sinH = Math.sin(effectiveCharHeading);

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
          const isChibi = typeof window !== "undefined" && !window.GLB_DISABLED && window.characterModel === "chibi";
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

        const _matOut = [
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
        if (!ragdollEnabled && !activeRidingBoat && _curSwimF <= 0.0001) {
          _charMatCacheKey = _matKey;
          _charMatCacheVal = _matOut;
        }
        return _matOut;
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
                  let removedNpcArrows = false;
                  for (let coll of collectibles) {
                    if (coll.attachedToNPC === activeInteractNPC) {
                      coll.attachedToNPC = null;
                      coll.active = false;
                      removedNpcArrows = true;
                    }
                  }
                  if (removedNpcArrows) {
                    window.pendingDynamicCollectibleRefresh = true;
                  }
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
                  let removedNpcArrows = false;
                  for (let coll of collectibles) {
                    if (coll.attachedToNPC === activeInteractNPC) {
                      coll.attachedToNPC = null;
                      coll.active = false;
                      removedNpcArrows = true;
                    }
                  }
                  if (removedNpcArrows) {
                    window.pendingDynamicCollectibleRefresh = true;
                  }
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
                  let removedNpcArrows = false;
                  for (let coll of collectibles) {
                    if (coll.attachedToNPC === activeInteractNPC) {
                      coll.attachedToNPC = null;
                      coll.active = false;
                      removedNpcArrows = true;
                    }
                  }
                  if (removedNpcArrows) {
                    window.pendingDynamicCollectibleRefresh = true;
                  }
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
                
                const checkDist = (item.type === "cotton_plant" || item.type === "crown_flower" || item.type === "grass") ? Math.max(actionReachDistance, 0.25 * (playerScale / 0.1)) : actionReachDistance;
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
              if (typeof window !== "undefined" && window.GroundDropSystem && window.GroundDropSystem.isGroundDropType(item.type)) {
                const meta = window.GroundDropSystem.getMeta(item.type);
                icon = meta.icon;
                label = meta.label;
              } else if (item.type === "plank" || item.type === "wood_floor" || item.type === "thin_wood_floor") { icon = "🪵"; label = item.type === "thin_wood_floor" ? "THIN_WOOD_FLOOR" : "WOOD_FLOOR"; }
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
              else if (item.type === "wooden_arm_cannon") { icon = "🪵🦾"; label = "WOODEN_ARM_CANNON"; }
              
              const dropTotal = Math.max(1, Math.floor(item.count || 1));
              const availSpace = (dropTotal > 1 && typeof window.getAvailableInventorySpace === "function")
                ? window.getAvailableInventorySpace(label)
                : dropTotal;
              const takeCount = dropTotal > 1 ? Math.min(dropTotal, availSpace) : 1;

              if (takeCount > 0) {
                const itemData = {
                  icon: icon,
                  label: label,
                  name: label,
                  count: takeCount
                };

                if (addItemToInventory(itemData)) {
                  collectedCount[item.type] = (collectedCount[item.type] || 0) + takeCount;
                  if (typeof window !== "undefined" && window.GroundDropSystem && typeof window.GroundDropSystem.takeFromDrop === "function") {
                    window.GroundDropSystem.takeFromDrop(item, takeCount);
                  } else if (takeCount < dropTotal) {
                    item.count = dropTotal - takeCount;
                  } else if (typeof window !== "undefined" && window.GroundDropSystem && typeof window.GroundDropSystem.markCollected === "function") {
                    window.GroundDropSystem.markCollected(item);
                  } else {
                    item.active = false;
                    if (item.isDynamic) {
                      window.pendingDynamicCollectibleRefresh = true;
                    } else if (typeof window !== "undefined" && typeof window.hideStaticCollectibleInVBO === "function" && window.hideStaticCollectibleInVBO(item)) {
                      // Surgical sub-buffer update
                    } else {
                      pendingCollectibleRefresh = true;
                    }
                  }
                  found = true;
                }
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
                  let removedNpcArrows = false;
                  for (let coll of collectibles) {
                    if (coll.attachedToNPC === activeInteractNPC) {
                      coll.attachedToNPC = null;
                      coll.active = false;
                      removedNpcArrows = true;
                    }
                  }
                  if (removedNpcArrows) {
                    window.pendingDynamicCollectibleRefresh = true;
                  }
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
                  let removedNpcArrows = false;
                  for (let coll of collectibles) {
                    if (coll.attachedToNPC === activeInteractNPC) {
                      coll.attachedToNPC = null;
                      coll.active = false;
                      removedNpcArrows = true;
                    }
                  }
                  if (removedNpcArrows) {
                    window.pendingDynamicCollectibleRefresh = true;
                  }
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
                  let removedNpcArrows = false;
                  for (let coll of collectibles) {
                    if (coll.attachedToNPC === activeInteractNPC) {
                      coll.attachedToNPC = null;
                      coll.active = false;
                      removedNpcArrows = true;
                    }
                  }
                  if (removedNpcArrows) {
                    window.pendingDynamicCollectibleRefresh = true;
                  }
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