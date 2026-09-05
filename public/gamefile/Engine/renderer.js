let frustumPlanes = null;

window.isMechFullyAssembled = function(mech) {
  if (!mech) return false;
  const attached = mech.attachedParts || [];
  const hasLeftLeg = attached.some(p => p.item && p.item.active && p.item.type === "robot_left_leg");
  const hasRightLeg = attached.some(p => p.item && p.item.active && p.item.type === "robot_right_leg");
  const hasLeftArm = attached.some(p => p.item && p.item.active && p.item.type === "robot_left_arm");
  const hasRightArm = attached.some(p => p.item && p.item.active && p.item.type === "robot_right_arm");
  return hasLeftLeg && hasRightLeg && hasLeftArm && hasRightArm;
};

window.tryAutoAssembleMechParts = function(mech) {
  // Auto-assembly disabled as per player preference for manual assembly
};

// Pre-allocated Float32Arrays for uniforms to avoid GC allocations and stutters inside the render loop
const f32_finalLightDir = new Float32Array(3);
const f32_eyePos = new Float32Array(3);
const f32_waterColor = new Float32Array(3);
const f32_atmosphereColor = new Float32Array(3);
const f32_cloudsColor = new Float32Array(3);

const f32_viewMatrix = new Float32Array(16);
const f32_projMatrix = new Float32Array(16);
const f32_lightSpaceMatrix = new Float32Array(16);
const f32_modelMatrix = new Float32Array(16);
const f32_modelViewMatrix = new Float32Array(16);
const f32_reflectedModelViewMatrixStatic = new Float32Array(16);
const f32_reflectedModelViewMatrix = new Float32Array(16);
const f32_reflectedModelMatrix = new Float32Array(16);
const f32_charModelViewMatrix = new Float32Array(16);
const f32_charModelMatrix = new Float32Array(16);

const f32_identity = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
const f32_forceZFarProj = new Float32Array(16);

const f32_boatPositions = new Float32Array(4 * 3);
const f32_boatRights = new Float32Array(4 * 3);
const f32_boatNormals = new Float32Array(4 * 3);
const f32_boatForwards = new Float32Array(4 * 3);
const f32_boatSizes = new Float32Array(4 * 3);
const f32_boatOffsets = new Float32Array(4 * 3);

const f32_waterTunnelsData = new Float32Array(64 * 4);
const tunnelsWithDistPool = [];

function setF32(target, source) {
  for (let i = 0; i < source.length; i++) {
    target[i] = source[i];
  }
  return target;
}

// === SEEDPLANET MODULE: JS/RENDERER.JS ===

// ============================================
// Graphics API Manager (WebGPU + WebGL Fallback)
// ============================================
const Graphics = {
  mode: 'unknown', // 'webgpu', 'webgl', or 'hybrid'
  webgpu: {
    device: null,
    context: null,
    format: 'bgra8unorm',
    ready: false,
    skyPipeline: null,
    skyBindGroup: null,
    skyUniformBuffer: null,
    terrainPipeline: null,
    terrainShadowPipeline: null,
    terrainBindGroup: null,
    terrainUniformBuffer: null,
    terrainShadowBindGroup: null,
    terrainVertexBuffer: null,
    terrainColorBuffer: null,
    terrainIndexBuffer: null,
    terrainIndicesLength: 0,
    mainDepthTexture: null,
    mainDepthTextureView: null,
    shadowDepthTexture: null,
    shadowDepthTextureView: null,
    shadowSampler: null,
  },
  webgl: {
    gl: null,
    isWebGL2: false,
    supportUint32: false
  },

  multiplyMatrices4(a, b, out) {
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        out[col * 4 + row] =
          a[0 * 4 + row] * b[col * 4 + 0] +
          a[1 * 4 + row] * b[col * 4 + 1] +
          a[2 * 4 + row] * b[col * 4 + 2] +
          a[3 * 4 + row] * b[col * 4 + 3];
      }
    }
    return out;
  },

  invertMatrix4(a, out) {
    let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    let a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    let a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    let b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
    let b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    let b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
    let b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1.0 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  },

  async init(gpuCanvas, glCanvas) {
    console.log("Graphics API: Initializing...");
    
    // 1. Try to initialize WebGPU (Primary Target)
    if (navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
        if (adapter) {
          this.webgpu.device = await adapter.requestDevice();
          this.webgpu.context = gpuCanvas.getContext('webgpu');
          if (this.webgpu.context) {
            this.webgpu.format = navigator.gpu.getPreferredCanvasFormat();
            this.webgpu.context.configure({
              device: this.webgpu.device,
              format: this.webgpu.format,
              alphaMode: 'opaque'
            });

            
            const modelWGSL = `
struct ModelUniforms {
    modelViewMatrix : mat4x4<f32>,
    projMatrix : mat4x4<f32>,
    lightSpaceMatrix : mat4x4<f32>,
    cameraPos : vec4<f32>,
    lightDir : vec4<f32>,
    waterColor : vec4<f32>,
    params : vec4<f32>,
    params2 : vec4<f32>,
    shadowTexelSize : vec2<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : ModelUniforms;
@group(0) @binding(1) var shadowMap : texture_depth_2d;
@group(0) @binding(2) var shadowSampler : sampler_comparison;

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) color : vec3<f32>,
    @location(2) normal : vec3<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) color : vec3<f32>,
    @location(1) normal : vec3<f32>,
    @location(2) viewPos : vec3<f32>,
    @location(3) worldNormal : vec3<f32>,
    @location(4) worldPos : vec3<f32>,
    @location(5) lightSpacePos : vec4<f32>,
    @location(6) dist : f32,
    @location(7) isGrass : f32,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    var pos = in.position;
    var actualColor = in.color;
    var isGrass = 0.0;
    var vertexType = 1.0;
    
    if (in.color.r < 0.0) {
        isGrass = 1.0;
        if (in.color.r < -9.0) {
            actualColor.r = -in.color.r - 10.0;
            vertexType = 0.0;
        } else {
            actualColor.r = -in.color.r;
            vertexType = 1.0;
        }
    }
    
    var isTree = false;
    var isTreeLeaf = false;
    var treeSwayWeight = 0.0;
    if (in.color.b < -0.5) {
        isTree = true;
        let encoded = -in.color.b;
        actualColor.b = encoded - 2.0 * floor(encoded / 2.0);
        var rawSway = floor(encoded / 2.0) - 10.0;
        if (rawSway >= 500.0) {
            isTreeLeaf = true;
            rawSway -= 1000.0;
        }
        treeSwayWeight = max(0.0, rawSway / 100.0);
    }
    
    let isLeaf = (isGrass > 0.5) || isTreeLeaf || ((actualColor.g > 0.32) && (abs(actualColor.r - actualColor.g) > 0.05));
    let distToCenter = length(pos);
    let isSeaweed = (distToCenter < uniforms.params2.y) && (actualColor.g > 0.35 && actualColor.r < 0.45 && actualColor.b < 0.5);
    
    if ((isLeaf || isTree) && uniforms.params.y > 0.0) {
        let h = distToCenter - uniforms.params2.x;
        if (isGrass > 0.5 || isTree || h > 0.01) {
            let up = normalize(pos);
            var tangent = vec3<f32>(1.0, 0.0, 0.0);
            if (abs(up.x) > 0.9) { tangent = vec3<f32>(0.0, 1.0, 0.0); }
            let bitangent = cross(up, tangent);
            tangent = cross(bitangent, up);
            
            if (isTree) {
                let swayAmount = treeSwayWeight * 0.03 * uniforms.params.y;
                let windPhase = uniforms.params.x * 0.45 + (pos.x + pos.y + pos.z) * 0.05;
                let branchWind = sin(windPhase);
                let windDir = normalize(tangent * 1.0 + bitangent * 0.3);
                pos += windDir * branchWind * swayAmount;
                
                if (isTreeLeaf) {
                    let leafPhase = uniforms.params.x * 1.4 + (pos.x + pos.y + pos.z) * 0.1;
                    let leafWind = sin(leafPhase);
                    let lSway = 0.0025 * treeSwayWeight * uniforms.params.y;
                    let flutterDir = normalize(tangent * -0.3 + bitangent * 1.0);
                    pos += flutterDir * leafWind * lSway;
                }
            } else {
                var swayAmount = 0.0;
                if (isGrass > 0.5) {
                    swayAmount = vertexType * 0.15 * uniforms.params.y;
                } else if (h > 0.2) {
                    swayAmount = (h - 0.2) * 0.1 * uniforms.params.y;
                }
                let windX = sin(uniforms.params.x * 1.5 + pos.y * 5.0 + pos.x * 2.0);
                let windZ = cos(uniforms.params.x * 1.5 + pos.y * 5.0 + pos.z * 2.0);
                let macroWindX = sin(uniforms.params.x * 0.15) * 0.5 - 1.5;
                let macroWindZ = cos(uniforms.params.x * 0.15) * 0.5 + 1.2;
                pos.x += (windX * 0.2 + macroWindX * 0.3) * swayAmount;
                pos.z += (windZ * 0.2 + macroWindZ * 0.3) * swayAmount;
            }
        }
    } else if (isSeaweed && uniforms.params.z > 0.0) {
        let h = max(0.0, distToCenter - uniforms.params2.x);
        let swayAmount = max(0.0, h - 0.015) * 0.9 * uniforms.params.z;
        let waterSwayX = sin(uniforms.params.x * 0.7 + pos.y * 14.0 + pos.x * 5.0);
        let waterSwayZ = cos(uniforms.params.x * 0.7 + pos.y * 14.0 + pos.z * 5.0);
        let currentX = sin(uniforms.params.x * 0.15) * 0.5;
        let currentZ = cos(uniforms.params.x * 0.15) * 0.5;
        pos.x += (waterSwayX * 0.14 + currentX * 0.15) * swayAmount;
        pos.z += (waterSwayZ * 0.14 + currentZ * 0.15) * swayAmount;
    }
    
    let mvPosition = uniforms.modelViewMatrix * vec4<f32>(pos, 1.0);
    out.position = uniforms.projMatrix * mvPosition;
    out.color = actualColor;
    
    let normalMatrix = mat3x3<f32>(
        uniforms.modelViewMatrix[0].xyz,
        uniforms.modelViewMatrix[1].xyz,
        uniforms.modelViewMatrix[2].xyz
    );
    out.normal = normalMatrix * in.normal;
    
    if (isGrass > 0.5) {
        out.worldNormal = normalize(pos);
        out.isGrass = 1.0;
    } else {
        out.worldNormal = in.normal;
        out.isGrass = 0.0;
    }
    
    out.viewPos = mvPosition.xyz;
    out.worldPos = pos;
    out.lightSpacePos = uniforms.lightSpaceMatrix * vec4<f32>(pos, 1.0);
    out.dist = length(mvPosition.xyz);
    
    return out;
}

fn calculateShadow(lightSpacePos: vec4<f32>, normal: vec3<f32>, lightDir: vec3<f32>) -> f32 {
    if (uniforms.params.w < 0.5) { return 1.0; }
    var projCoords = lightSpacePos.xyz / lightSpacePos.w;
    projCoords = projCoords * 0.5 + vec3<f32>(0.5);
    projCoords.y = 1.0 - projCoords.y;
    
    if (projCoords.z > 1.0 || projCoords.z < 0.0) { return 1.0; }
    if (projCoords.x < 0.0 || projCoords.x > 1.0 || projCoords.y < 0.0 || projCoords.y > 1.0) { return 1.0; }
    
    let cosTheta = clamp(dot(normal, lightDir), 0.0, 1.0);
    let slope = sqrt(max(0.0, 1.0 - cosTheta * cosTheta)) / max(cosTheta, 0.05);
    let bias = clamp(0.0005 + 0.0012 * slope, 0.0005, 0.0022);
    
    var texelSize = uniforms.shadowTexelSize;
    if (texelSize.x <= 0.0) { texelSize = vec2<f32>(1.0 / 1024.0); }
    
    var shadow = 0.0;
    for (var x = -1; x <= 1; x++) {
        for (var y = -1; y <= 1; y++) {
            let offset = vec2<f32>(f32(x), f32(y)) * texelSize;
            shadow += textureSampleCompare(shadowMap, shadowSampler, projCoords.xy + offset, projCoords.z - bias);
        }
    }
    shadow = shadow / 9.0;
    
    let distFromCenter = length(projCoords.xy - vec2<f32>(0.5));
    let edgeFade = 1.0 - smoothstep(0.36, 0.49, distFromCenter);
    return mix(1.0, shadow, edgeFade);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    if (uniforms.params2.z > 0.5 && in.dist > uniforms.params2.w) {
        discard;
    }
    
    let normal = normalize(in.worldNormal);
    let lightDir = normalize(uniforms.lightDir.xyz);
    let diffuseVal = max(dot(normal, lightDir), 0.0);
    
    var shadow = calculateShadow(in.lightSpacePos, normalize(in.worldNormal), normalize(uniforms.lightDir.xyz));
    if (diffuseVal <= 0.0) { shadow = 0.0; }
    let lit = mix(0.3, 1.0, shadow);
    let diffuse = diffuseVal * lit * 0.8 + 0.2;
    
    let viewDir = normalize(uniforms.cameraPos.xyz - in.worldPos);
    let halfDir = normalize(lightDir + viewDir);
    let spec = pow(max(dot(normal, halfDir), 0.0), 16.0) * 0.25 * shadow;
    
    let fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0) * 0.15;
    
    var finalColor = in.color * diffuse + vec3<f32>(1.0) * spec + vec3<f32>(0.95, 0.97, 1.0) * fresnel;
    if (in.isGrass > 0.5) {
        finalColor = in.color * diffuseVal * 1.2 + vec3<f32>(0.1, 0.2, 0.05);
    }
    
    let dist = length(in.worldPos);
    if (dist < uniforms.params2.y) {
        let depth = uniforms.params2.y - dist;
        var tintFactor = 1.0 - exp(-depth * 5.0);
        tintFactor = clamp(tintFactor * uniforms.waterColor.w, 0.0, 0.85);
        finalColor = mix(finalColor, uniforms.waterColor.xyz, tintFactor);
    }
    
    var glassAlpha = 1.0;
    let isGlass = (abs(in.color.r - 0.6) < 0.01 && abs(in.color.g - 0.8) < 0.01 && abs(in.color.b - 1.0) < 0.01);
    
    if (isGlass) {
        glassAlpha = mix(0.35, 0.75, fresnel);
        let reflectionProximity = smoothstep(15.0, 1.0, in.dist);
        let viewDirWorld = normalize(in.worldPos - uniforms.cameraPos.xyz);
        let normalWorld = normalize(in.worldNormal);
        let reflVecWorld = reflect(viewDirWorld, normalWorld);
        
        let localUp = normalize(in.worldPos);
        let localTangent = normalize(cross(localUp, normalWorld));
        let reflUp = dot(reflVecWorld, localUp);
        let reflTangent = dot(reflVecWorld, localTangent);
        let reflNormal = dot(reflVecWorld, normalWorld);
        
        var skyColor = mix(vec3<f32>(0.12, 0.18, 0.35), vec3<f32>(0.55, 0.75, 1.0), max(0.0, dot(reflVecWorld, lightDir)) * 0.4 + 0.6);
        let cloudPattern = sin(reflVecWorld.x * 3.5 + uniforms.params.x * 0.05) * cos(reflVecWorld.z * 3.5 + uniforms.params.x * 0.04) * 0.5 + 0.5;
        if (cloudPattern > 0.58) {
            skyColor = mix(skyColor, vec3<f32>(0.96, 0.98, 1.0), (cloudPattern - 0.58) * 1.6);
        }
        
        var groundColor = vec3<f32>(0.48, 0.32, 0.18);
        let reflectDistToCenter = length(in.worldPos + reflVecWorld * 2.0);
        if (reflectDistToCenter < uniforms.params2.y) {
            groundColor = mix(groundColor, vec3<f32>(0.12, 0.48, 0.58), 0.85);
        } else {
            let grassTile = sin(in.worldPos.x * 2.0 + reflVecWorld.x * 4.0) * cos(in.worldPos.z * 2.0 + reflVecWorld.z * 4.0);
            if (grassTile > 0.1) {
                groundColor = mix(groundColor, vec3<f32>(0.28, 0.46, 0.16), 0.75);
            }
        }
        
        let wallU = reflTangent / (abs(reflNormal) + 0.01);
        let wallV = reflUp / (abs(reflNormal) + 0.01);
        
        let verticalPlanks = step(0.88, abs(sin(wallU * 6.28)));
        let horizontalPlanks = step(0.93, abs(sin(wallV * 3.14)));
        var structureColor = mix(vec3<f32>(0.38, 0.22, 0.12), vec3<f32>(0.20, 0.11, 0.06), max(verticalPlanks, horizontalPlanks));
        
        let leafSpots = sin(wallU * 1.5 + wallV * 2.0) * cos(wallV * 1.2 - wallU * 0.8);
        if (leafSpots > 0.4) {
            structureColor = mix(structureColor, vec3<f32>(0.18, 0.38, 0.12), 0.65);
        }
        
        var reflectedColor = vec3<f32>(0.0);
        if (reflUp >= 0.0) {
            let skyFactor = smoothstep(0.0, 0.4, reflUp);
            reflectedColor = mix(structureColor, skyColor, skyFactor);
        } else {
            let groundFactor = smoothstep(0.0, 0.4, -reflUp);
            reflectedColor = mix(structureColor, groundColor, groundFactor);
        }
        
        finalColor = mix(finalColor, reflectedColor, reflectionProximity * 0.8);
    }
    
    return vec4<f32>(finalColor, glassAlpha);
}
`;

            const charWGSL = `
struct CharUniforms {
    modelViewMatrix : mat4x4<f32>,
    projMatrix : mat4x4<f32>,
    modelMatrix : mat4x4<f32>,
    lightSpaceMatrix : mat4x4<f32>,
    cameraPos : vec4<f32>,
    lightDir : vec4<f32>,
    waterColor : vec4<f32>,
    params : vec4<f32>,
    shadowTexelSize : vec2<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : CharUniforms;
@group(0) @binding(1) var shadowMap : texture_depth_2d;
@group(0) @binding(2) var shadowSampler : sampler_comparison;

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) localPos : vec3<f32>,
    @location(2) normal : vec3<f32>,
    @location(3) color : vec3<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) color : vec3<f32>,
    @location(1) normal : vec3<f32>,
    @location(2) localPos : vec3<f32>,
    @location(3) worldNormal : vec3<f32>,
    @location(4) worldPos : vec3<f32>,
    @location(5) lightSpacePos : vec4<f32>,
    @location(6) viewPos : vec3<f32>,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    let mvPosition = uniforms.modelViewMatrix * vec4<f32>(in.position, 1.0);
    out.position = uniforms.projMatrix * mvPosition;
    
    let normalMatrix = mat3x3<f32>(
        uniforms.modelViewMatrix[0].xyz,
        uniforms.modelViewMatrix[1].xyz,
        uniforms.modelViewMatrix[2].xyz
    );
    out.normal = normalMatrix * in.normal;
    out.localPos = in.localPos;
    out.color = in.color;
    
    let worldPos = uniforms.modelMatrix * vec4<f32>(in.position, 1.0);
    
    let worldNormalMatrix = mat3x3<f32>(
        uniforms.modelMatrix[0].xyz,
        uniforms.modelMatrix[1].xyz,
        uniforms.modelMatrix[2].xyz
    );
    out.worldNormal = normalize(worldNormalMatrix * in.normal);
    out.worldPos = worldPos.xyz;
    out.lightSpacePos = uniforms.lightSpaceMatrix * worldPos;
    out.viewPos = mvPosition.xyz;
    return out;
}

fn distToSegment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
    return length(pa - ba*h);
}

fn calculateShadow(lightSpacePos: vec4<f32>, normal: vec3<f32>, lightDir: vec3<f32>) -> f32 {
    if (uniforms.params.z < 0.5) { return 1.0; }
    var projCoords = lightSpacePos.xyz / lightSpacePos.w;
    projCoords = projCoords * 0.5 + vec3<f32>(0.5);
    projCoords.y = 1.0 - projCoords.y;
    
    if (projCoords.z > 1.0 || projCoords.z < 0.0) { return 1.0; }
    if (projCoords.x < 0.0 || projCoords.x > 1.0 || projCoords.y < 0.0 || projCoords.y > 1.0) { return 1.0; }
    
    let cosTheta = clamp(dot(normal, lightDir), 0.0, 1.0);
    let slope = sqrt(max(0.0, 1.0 - cosTheta * cosTheta)) / max(cosTheta, 0.05);
    let bias = clamp(0.0005 + 0.0012 * slope, 0.0005, 0.0022);
    
    var texelSize = uniforms.shadowTexelSize;
    if (texelSize.x <= 0.0) { texelSize = vec2<f32>(1.0 / 1024.0); }
    
    var shadow = 0.0;
    for (var x = -1; x <= 1; x++) {
        for (var y = -1; y <= 1; y++) {
            let offset = vec2<f32>(f32(x), f32(y)) * texelSize;
            shadow += textureSampleCompare(shadowMap, shadowSampler, projCoords.xy + offset, projCoords.z - bias);
        }
    }
    shadow = shadow / 9.0;
    
    let distFromCenter = length(projCoords.xy - vec2<f32>(0.5));
    let edgeFade = 1.0 - smoothstep(0.36, 0.49, distFromCenter);
    return mix(1.0, shadow, edgeFade);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let normal = normalize(in.worldNormal);
    let viewDir = normalize(uniforms.cameraPos.xyz - in.worldPos);
    let lightDir = normalize(uniforms.lightDir.xyz);
    
    let diffuseVal = max(dot(normal, lightDir), 0.0);
    var shadow = calculateShadow(in.lightSpacePos, normal, lightDir);
    if (diffuseVal <= 0.0) { shadow = 0.0; }
    let lit = mix(0.3, 1.0, shadow);
    let diffuse = diffuseVal * lit * 0.75 + 0.25;
    
    let halfDir = normalize(lightDir + viewDir);
    let spec = pow(max(dot(normal, halfDir), 0.0), 38.0) * 0.75 * shadow;
    
    let fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0) * 0.25;
    var baseColor = in.color;
    
    if (in.localPos.y > 0.22 && in.localPos.y < 0.67 && in.localPos.z > 0.04 && in.localPos.z < 0.28) {
        let uv = vec2<f32>(in.localPos.x, in.localPos.y - 0.43) / 0.24;
        
        let dLeftCheek = length(vec2<f32>(uv.x - (-0.38), (uv.y - (-0.18)) * 1.3));
        let dRightCheek = length(vec2<f32>(uv.x - 0.38, (uv.y - (-0.18)) * 1.3));
        let sCheeks = max(smoothstep(0.14, 0.02, dLeftCheek), smoothstep(0.14, 0.02, dRightCheek)) * 0.55;
        let cheekColor = vec3<f32>(1.0, 0.52, 0.60);
        
        let leftEyeUv = vec2<f32>(uv.x - (-0.23), (uv.y - 0.01) * 0.75);
        let rightEyeUv = vec2<f32>(uv.x - 0.23, (uv.y - 0.01) * 0.75);
        let dLeftEye = length(leftEyeUv);
        let dRightEye = length(rightEyeUv);
        
        let eyeRadius = 0.125;
        let sEyeWhite = max(smoothstep(eyeRadius, eyeRadius - 0.015, dLeftEye), smoothstep(eyeRadius, eyeRadius - 0.015, dRightEye));
        
        let dLeftIris = length(vec2<f32>(leftEyeUv.x, leftEyeUv.y * 0.88));
        let dRightIris = length(vec2<f32>(rightEyeUv.x, rightEyeUv.y * 0.88));
        let irisRadius = 0.098;
        let sIris = max(smoothstep(irisRadius, irisRadius - 0.015, dLeftIris), smoothstep(irisRadius, irisRadius - 0.015, dRightIris));
        
        let irisY = clamp((uv.y - 0.01) / 0.12, -1.0, 1.0);
        let irisColor = mix(vec3<f32>(0.85, 0.52, 0.18), vec3<f32>(0.24, 0.11, 0.05), irisY * 0.5 + 0.5);
        
        let dLeftPupil = length(vec2<f32>(leftEyeUv.x, leftEyeUv.y - 0.01));
        let dRightPupil = length(vec2<f32>(rightEyeUv.x, rightEyeUv.y - 0.01));
        let sPupil = max(smoothstep(0.045, 0.028, dLeftPupil), smoothstep(0.045, 0.028, dRightPupil));
        let pupilColor = vec3<f32>(0.08, 0.04, 0.02);
        
        let dLeftH1 = length(leftEyeUv - vec2<f32>(-0.038, 0.038));
        let dRightH1 = length(rightEyeUv - vec2<f32>(-0.038, 0.038));
        let sH1 = max(smoothstep(0.035, 0.018, dLeftH1), smoothstep(0.035, 0.018, dRightH1));
        
        let dLeftH2 = length(leftEyeUv - vec2<f32>(0.032, -0.038));
        let dRightH2 = length(rightEyeUv - vec2<f32>(0.032, -0.038));
        let sH2 = max(smoothstep(0.020, 0.008, dLeftH2), smoothstep(0.020, 0.008, dRightH2));
        
        let dLeftLash = distToSegment(uv, vec2<f32>(-0.35, 0.08), vec2<f32>(-0.11, 0.13));
        let dRightLash = distToSegment(uv, vec2<f32>(0.11, 0.13), vec2<f32>(0.35, 0.08));
        let sEyelash = max(smoothstep(0.032, 0.010, dLeftLash), smoothstep(0.032, 0.010, dRightLash));
        
        let dLeftBrow = distToSegment(uv, vec2<f32>(-0.32, 0.18), vec2<f32>(-0.14, 0.22));
        let dRightBrow = distToSegment(uv, vec2<f32>(0.14, 0.22), vec2<f32>(0.32, 0.18));
        let sEyebrow = max(smoothstep(0.020, 0.006, dLeftBrow), smoothstep(0.020, 0.006, dRightBrow));
        let browColor = vec3<f32>(0.32, 0.18, 0.10);
        
        let mouthUv = vec2<f32>(uv.x, (uv.y - (-0.17)) * 1.3);
        let dMouthOpen = length(vec2<f32>(mouthUv.x, max(0.0, mouthUv.y)));
        let sMouthOutline = smoothstep(0.060, 0.042, dMouthOpen) * step(-0.035, mouthUv.y);
        let sMouthInner = smoothstep(0.042, 0.028, dMouthOpen) * step(-0.025, mouthUv.y);
        
        let dTongue = length(vec2<f32>(mouthUv.x, mouthUv.y - (-0.015)));
        let sTongue = smoothstep(0.032, 0.015, dTongue) * sMouthInner;
        
        let mouthBorderColor = vec3<f32>(0.22, 0.08, 0.08);
        let mouthInnerColor = vec3<f32>(0.88, 0.32, 0.38);
        let tongueColor = vec3<f32>(0.98, 0.58, 0.65);
        
        baseColor = mix(baseColor, cheekColor, sCheeks);
        baseColor = mix(baseColor, vec3<f32>(1.0, 1.0, 1.0), sEyeWhite);
        baseColor = mix(baseColor, irisColor, sIris);
        baseColor = mix(baseColor, pupilColor, sPupil);
        baseColor = mix(baseColor, vec3<f32>(1.0, 1.0, 1.0), max(sH1, sH2));
        baseColor = mix(baseColor, vec3<f32>(0.08, 0.04, 0.04), sEyelash);
        baseColor = mix(baseColor, browColor, sEyebrow);
        baseColor = mix(baseColor, mouthBorderColor, sMouthOutline);
        baseColor = mix(baseColor, mouthInnerColor, sMouthInner);
        baseColor = mix(baseColor, tongueColor, sTongue);
    }
    
    var finalColor = baseColor * diffuse + vec3<f32>(1.0) * spec + vec3<f32>(0.9, 0.95, 1.0) * fresnel;
    
    let dist = length(in.worldPos);
    if (dist < uniforms.params.x) {
        let depth = uniforms.params.x - dist;
        var tintFactor = 1.0 - exp(-depth * 5.0);
        tintFactor = clamp(tintFactor * uniforms.params.y, 0.0, 0.85);
        finalColor = mix(finalColor, uniforms.waterColor.xyz, tintFactor);
    }
    
    return vec4<f32>(finalColor, 1.0);
}
`;

            Graphics.webgpu.modelShaderModule = this.webgpu.device.createShaderModule({ code: modelWGSL });
            Graphics.webgpu.charShaderModule = this.webgpu.device.createShaderModule({ code: charWGSL });
            Graphics.webgpu.depthShaderModule = this.webgpu.device.createShaderModule({ code: `
struct DepthUniforms {
    modelViewMatrix : mat4x4<f32>,
    projMatrix : mat4x4<f32>,
    modelMatrix : mat4x4<f32>,
    params : vec4<f32>, // x: time, y: swayFactor, z: isChar, w: 0
};
@group(0) @binding(0) var<uniform> uniforms : DepthUniforms;

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) color : vec3<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    var pos = in.position;
    
    if (uniforms.params.z < 0.5 && uniforms.params.y > 0.0) {
        var actualColor = in.color;
        var isGrass = 0.0;
        var vertexType = 1.0;
        if (in.color.r < 0.0) {
            isGrass = 1.0;
            if (in.color.r < -9.0) {
                vertexType = 0.0;
            }
        }
        var isTree = false;
        var isTreeLeaf = false;
        var treeSwayWeight = 0.0;
        if (in.color.b < -0.5) {
            isTree = true;
            let encoded = -in.color.b;
            var rawSway = floor(encoded / 2.0) - 10.0;
            if (rawSway >= 500.0) {
                isTreeLeaf = true;
                rawSway -= 1000.0;
            }
            treeSwayWeight = max(0.0, rawSway / 100.0);
        }
        let isLeaf = (isGrass > 0.5) || isTreeLeaf || ((actualColor.g > 0.32) && (abs(actualColor.r - actualColor.g) > 0.05));
        let distToCenter = length(pos);
        if (isLeaf || isTree) {
            let up = normalize(pos);
            var tangent = vec3<f32>(1.0, 0.0, 0.0);
            if (abs(up.x) > 0.9) { tangent = vec3<f32>(0.0, 1.0, 0.0); }
            let bitangent = cross(up, tangent);
            tangent = cross(bitangent, up);
            if (isTree) {
                let swayAmount = treeSwayWeight * 0.03 * uniforms.params.y;
                let windPhase = uniforms.params.x * 0.45 + (pos.x + pos.y + pos.z) * 0.05;
                let branchWind = sin(windPhase);
                let windDir = normalize(tangent * 1.0 + bitangent * 0.3);
                pos += windDir * branchWind * swayAmount;
                if (isTreeLeaf) {
                    let leafPhase = uniforms.params.x * 1.4 + (pos.x + pos.y + pos.z) * 0.1;
                    let leafWind = sin(leafPhase);
                    let lSway = 0.0025 * treeSwayWeight * uniforms.params.y;
                    let flutterDir = normalize(tangent * -0.3 + bitangent * 1.0);
                    pos += flutterDir * leafWind * lSway;
                }
            } else {
                let swayAmount = isGrass > 0.5 ? (vertexType * 0.15 * uniforms.params.y) : 0.0; // simple grass sway
                let windX = sin(uniforms.params.x * 1.5 + pos.y * 5.0 + pos.x * 2.0);
                let windZ = cos(uniforms.params.x * 1.5 + pos.y * 5.0 + pos.z * 2.0);
                let macroWindX = sin(uniforms.params.x * 0.15) * 0.5 - 1.5;
                let macroWindZ = cos(uniforms.params.x * 0.15) * 0.5 + 1.2;
                pos.x += (windX * 0.2 + macroWindX * 0.3) * swayAmount;
                pos.z += (windZ * 0.2 + macroWindZ * 0.3) * swayAmount;
            }
        }
    }
    
    var mvPosition : vec4<f32>;
    if (uniforms.params.z > 0.5) { // isChar
        mvPosition = uniforms.modelViewMatrix * vec4<f32>(in.position, 1.0);
    } else { // isModel
        mvPosition = uniforms.modelViewMatrix * vec4<f32>(pos, 1.0);
    }
    
    out.position = uniforms.projMatrix * mvPosition;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) {
    // Write depth automatically
}
` });
            
            Graphics.webgpu.depthBindGroupLayout = this.webgpu.device.createBindGroupLayout({
                entries: [
                    { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform', hasDynamicOffset: false, minBindingSize: 208 } }
                ]
            });

            
            Graphics.webgpu.monkeyUniformBuffer = this.webgpu.device.createBuffer({
                size: 512 * 2000,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
            Graphics.webgpu.monkeyUniformOffset = 0;
            
            Graphics.webgpu.monkeyBindGroupLayout = this.webgpu.device.createBindGroupLayout({
                entries: [
                    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform', hasDynamicOffset: false, minBindingSize: 288 } },
                    { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
                    { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } }
                ]
            });
            
            Graphics.webgpu.pipelineCache = {};
            
            Graphics.webgpu.getMonkeyPipeline = function(progName, state) {
                const key = `${progName}_${state.cullEnabled}_${state.cullFace}_${state.frontFace}_${state.depthTest}_${state.depthMask}`;
                if (this.pipelineCache[key]) return this.pipelineCache[key];
                
                const module = progName === 'depth' ? this.depthShaderModule : (progName === 'model' ? this.modelShaderModule : this.charShaderModule);
                const desc = {
                    layout: this.device.createPipelineLayout({ bindGroupLayouts: [progName === 'depth' ? this.depthBindGroupLayout : this.monkeyBindGroupLayout] }),
                    vertex: {
                        module: module,
                        entryPoint: 'vs_main',
                        buffers: (progName === 'depth') ? [
                            { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                            { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] }
                        ] : (progName === 'atmosphere' || progName === 'water' || progName === 'sky' ? [
                            { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }
                        ] : (progName === 'cloud3D' ? [
                            { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                            { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] }
                        ] : (progName === 'model' ? [
                            { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                            { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
                            { arrayStride: 12, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x3' }] }
                        ] : [
                            { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                            { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
                            { arrayStride: 12, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x3' }] },
                            { arrayStride: 12, attributes: [{ shaderLocation: 3, offset: 0, format: 'float32x3' }] }
                        ])))
                    },
                    fragment: progName === 'depth' ? { module: module, entryPoint: 'fs_main', targets: [] } : {
                        module: module,
                        entryPoint: 'fs_main',
                        targets: [{ format: this.format, blend: {
                            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
                        } }]
                    },
                    primitive: {
                        topology: 'triangle-list',
                        cullMode: state.cullEnabled ? (state.cullFace === 1028 ? 'front' : 'back') : 'none', // 1028 is gl.FRONT
                        frontFace: state.frontFace === 2304 ? 'cw' : 'ccw' // 2304 is gl.CW
                    },
                    depthStencil: {
                        depthWriteEnabled: progName === 'sky' ? false : state.depthMask, // Sky always depthWrite false
                        depthCompare: progName === 'depth' ? 'less' : (state.depthTest ? 'less' : 'always'),
                        format: progName === 'depth' ? 'depth32float' : 'depth24plus' 
                    }
                };
                
                this.pipelineCache[key] = this.device.createRenderPipeline(desc);
                return this.pipelineCache[key];
            };
            
            Graphics.webgpu.executeMonkeyDraw = function(gl, count, type, offset) {
                const prog = gl._currentProgram;
                const isModel = prog._name === 'model';
                const isChar = prog._name === 'char';
                const vals = prog._uniformValues;
                
                if (this.monkeyUniformOffset >= 512 * 1900) this.monkeyUniformOffset = 0;
                const currentOffset = this.monkeyUniformOffset;
                this.monkeyUniformOffset += 512;
                
                const uData = new Float32Array(84);
                const setMat4 = (name, arrOff) => { if(vals[name]) uData.set(vals[name], arrOff); };
                const setVec3 = (name, arrOff) => { if(vals[name]) { uData[arrOff] = vals[name][0]; uData[arrOff+1] = vals[name][1]; uData[arrOff+2] = vals[name][2]; } };
                const setFloat = (name, arrOff) => { if(vals[name]) uData[arrOff] = vals[name][0]; };
                const setVec2 = (name, arrOff) => { if(vals[name]) { uData[arrOff] = vals[name][0]; uData[arrOff+1] = vals[name][1]; } };
                
                const isDepth = prog._name === 'depth';
                if (isModel) {
                    setMat4("uModelViewMatrix", 0); setMat4("uProjectionMatrix", 16); setMat4("uLightSpaceMatrix", 32);
                    setVec3("uCameraPos", 48); setVec3("uLightDir", 52); uData[55] = 1.0;
                    setVec3("uWaterColor", 56); uData[59] = vals["uWaterOpacity"] ? vals["uWaterOpacity"][0] : 0.0;
                    setFloat("uTime", 60); setFloat("uSwayFactor", 61); setFloat("uWaterSwayFactor", 62); setFloat("uShadowsEnabled", 63);
                    setFloat("uPlanetRadius", 64); setFloat("uWaterRadius", 65); setFloat("uRenderDistEnabled", 66); setFloat("uMaxRenderDist", 67);
                    setVec2("uShadowTexelSize", 68);
                } else if (isChar) {
                    setMat4("uModelViewMatrix", 0); setMat4("uProjectionMatrix", 16); setMat4("uModelMatrix", 32); setMat4("uLightSpaceMatrix", 48);
                    setVec3("uCameraPos", 64); setVec3("uLightDir", 68); uData[71] = 1.0;
                    setVec3("uWaterColor", 72); uData[75] = vals["uWaterOpacity"] ? vals["uWaterOpacity"][0] : 0.0;
                    setFloat("uWaterRadius", 76); setFloat("uShadowsEnabled", 78);
                    setVec2("uShadowTexelSize", 80);
                }
                const isAtmosphere = prog._name === 'atmosphere';
                const isWater = prog._name === 'water';
                const isCloud3D = prog._name === 'cloud3D';
                const isSky = prog._name === 'sky';
                if (isSky) {
                    setMat4("uModelViewMatrix", 0);
                    setMat4("uProjectionMatrix", 16);
                    if(vals["uTime"]) { uData[32] = vals["uTime"][0]; }
                    if(vals["uGasIntensity"]) { uData[33] = vals["uGasIntensity"][0]; }
                    if(vals["uWaterRadius"]) { uData[34] = vals["uWaterRadius"][0]; }
                    setVec3("uCameraPos", 36);
                } else if (isCloud3D) {
                    setMat4("uModelViewMatrix", 0);
                    setMat4("uProjectionMatrix", 16);
                    if(vals["uCloudOrbitMatrix"]) { uData.set(vals["uCloudOrbitMatrix"], 32); } // Correctly map matrix array
                    if(vals["uColor"]) { uData[48] = vals["uColor"][0]; uData[49] = vals["uColor"][1]; uData[50] = vals["uColor"][2]; }
                    if(vals["uAlpha"]) { uData[51] = vals["uAlpha"][0]; }
                    if(vals["uAnimTime"]) { uData[52] = vals["uAnimTime"][0]; }
                    if(vals["uTime"]) { uData[53] = vals["uTime"][0]; }
                    if(vals["uWaterRadius"]) { uData[54] = vals["uWaterRadius"][0]; }
                    setVec3("uLightDir", 56);
                    setVec3("uCameraPos", 60);
                } else if (isWater) {
                    setMat4("uModelViewMatrix", 0);
                    setMat4("uProjectionMatrix", 16);
                    if(vals["uWaterColor"]) { uData[32] = vals["uWaterColor"][0]; uData[33] = vals["uWaterColor"][1]; uData[34] = vals["uWaterColor"][2]; }
                    if(vals["uOpacity"]) { uData[36] = vals["uOpacity"][0]; }
                    if(vals["uTime"]) { uData[37] = vals["uTime"][0]; }
                    if(vals["uWaveStrength"]) { uData[38] = vals["uWaveStrength"][0]; }
                    if(vals["uWaterLevel"]) { uData[39] = vals["uWaterLevel"][0]; }
                    setVec3("uLightDir", 40);
                    setVec3("uCameraPos", 44);
                    if(vals["uRenderDistEnabled"]) { uData[48] = vals["uRenderDistEnabled"][0]; }
                    if(vals["uMaxRenderDist"]) { uData[49] = vals["uMaxRenderDist"][0]; }
                    if(vals["uBoatCount"]) { uData[52] = vals["uBoatCount"][0]; }
                    // Ignore boats to save space as it's not strictly needed yet
                } else if (isAtmosphere) {
                    setMat4("uModelViewMatrix", 0);
                    setMat4("uProjectionMatrix", 16);
                    if(vals["uColor"]) { uData[32] = vals["uColor"][0]; uData[33] = vals["uColor"][1]; uData[34] = vals["uColor"][2]; }
                    if(vals["uAlpha"]) { uData[35] = vals["uAlpha"][0]; }
                    setVec3("uLightDir", 36);
                    setVec3("uCameraPos", 40);
                } else if (isDepth) {
                    setMat4("uModelMatrix", 0); // mapped to modelViewMatrix in WGSL
                    setMat4("uLightSpaceMatrix", 16); // mapped to projMatrix in WGSL
                    setMat4("uModelMatrix", 32); 
                    setFloat("uTime", 48); 
                    setFloat("uSwayFactor", 49); 
                    
                    let isCharVBO = false;
                    const aPosLoc = prog._attribNamesInv ? prog._attribNamesInv["aPosition"] : -1;
                    if (aPosLoc >= 0 && gl._activeAttributes[aPosLoc]) {
                        const vbo = gl._activeAttributes[aPosLoc].buffer;
                        if (vbo === window.charVertexBuffer || (typeof window.equipVertexBuffer !== 'undefined' && vbo === window.equipVertexBuffer)) {
                            isCharVBO = true;
                        }
                    }
                    uData[50] = isCharVBO ? 1.0 : 0.0;
                    setFloat("uWaterSwayFactor", 51);
                    setFloat("uPlanetRadius", 52);
                    setFloat("uWaterRadius", 53);
                }
                
                this.device.queue.writeBuffer(this.monkeyUniformBuffer, currentOffset, uData.buffer);
                
                const bgl = isDepth ? this.depthBindGroupLayout : (isAtmosphere ? this.atmosphereBindGroupLayout : (isWater ? this.waterBindGroupLayout : (isCloud3D ? this.cloud3DBindGroupLayout : (isSky ? this.skyBindGroupLayout : this.monkeyBindGroupLayout))));
                let entries;
                if (isDepth || isAtmosphere || isCloud3D || isSky) {
                    entries = [
                        { binding: 0, resource: { buffer: this.monkeyUniformBuffer, offset: currentOffset, size: 512 } }
                    ];
                } else if (isWater) {
                    entries = [
                        { binding: 0, resource: { buffer: this.monkeyUniformBuffer, offset: currentOffset, size: 512 } },
                        { binding: 1, resource: this.waterMaskTextureView },
                        { binding: 2, resource: this.waterMaskSampler }
                    ];
                } else {
                    entries = [
                    { binding: 0, resource: { buffer: this.monkeyUniformBuffer, offset: currentOffset, size: 512 } },
                    { binding: 1, resource: this.shadowDepthTextureView },
                    { binding: 2, resource: this.shadowSampler }
                ];
                }
                const bindGroup = this.device.createBindGroup({
                    layout: bgl,
                    entries: entries
                });
                
                const pipeline = this.getMonkeyPipeline(prog._name, {
                    cullEnabled: gl._cullEnabled, cullFace: gl._cullFace, frontFace: gl._frontFace, depthTest: gl._depthTest, depthMask: gl._depthMask
                });
                
                const encoder = this.currentPassEncoder;
                encoder.setPipeline(pipeline);
                encoder.setBindGroup(0, bindGroup);
                
                const aPosLoc = prog._attribNamesInv ? prog._attribNamesInv["aPosition"] : -1;
                const aColorLoc = prog._attribNamesInv ? prog._attribNamesInv["aColor"] : -1;
                const aNormLoc = prog._attribNamesInv ? prog._attribNamesInv["aNormal"] : -1;
                const aLocalPosLoc = (isChar || isCloud3D) && prog._attribNamesInv ? prog._attribNamesInv["aLocalPos"] : -1;
                
                if (aPosLoc >= 0 && gl._activeAttributes[aPosLoc] && gl._activeAttributes[aPosLoc].buffer._webgpuBuffer)
                    encoder.setVertexBuffer(0, gl._activeAttributes[aPosLoc].buffer._webgpuBuffer);
                    
                if (isModel) {
                    if (aColorLoc >= 0 && gl._activeAttributes[aColorLoc] && gl._activeAttributes[aColorLoc].buffer._webgpuBuffer)
                        encoder.setVertexBuffer(1, gl._activeAttributes[aColorLoc].buffer._webgpuBuffer);
                    if (aNormLoc >= 0 && gl._activeAttributes[aNormLoc] && gl._activeAttributes[aNormLoc].buffer && gl._activeAttributes[aNormLoc].buffer._webgpuBuffer)
                        encoder.setVertexBuffer(2, gl._activeAttributes[aNormLoc].buffer._webgpuBuffer);
                    else
                        encoder.setVertexBuffer(2, this.dummyNormalBuffer || this.dummyColorBuffer);
                } else if (isCloud3D) {
                    if (aLocalPosLoc >= 0 && gl._activeAttributes[aLocalPosLoc] && gl._activeAttributes[aLocalPosLoc].buffer._webgpuBuffer)
                        encoder.setVertexBuffer(1, gl._activeAttributes[aLocalPosLoc].buffer._webgpuBuffer);
                } else if (isChar) {
                    if (aLocalPosLoc >= 0 && gl._activeAttributes[aLocalPosLoc] && gl._activeAttributes[aLocalPosLoc].buffer._webgpuBuffer)
                        encoder.setVertexBuffer(1, gl._activeAttributes[aLocalPosLoc].buffer._webgpuBuffer);
                    if (aNormLoc >= 0 && gl._activeAttributes[aNormLoc] && gl._activeAttributes[aNormLoc].buffer._webgpuBuffer)
                        encoder.setVertexBuffer(2, gl._activeAttributes[aNormLoc].buffer._webgpuBuffer);
                    if (aColorLoc >= 0 && gl._activeAttributes[aColorLoc] && gl._activeAttributes[aColorLoc].buffer._webgpuBuffer)
                        encoder.setVertexBuffer(3, gl._activeAttributes[aColorLoc].buffer._webgpuBuffer);
                } else if (isDepth) {
                    if (aColorLoc >= 0 && gl._activeAttributes[aColorLoc] && gl._activeAttributes[aColorLoc].buffer && gl._activeAttributes[aColorLoc].buffer._webgpuBuffer) {
                        encoder.setVertexBuffer(1, gl._activeAttributes[aColorLoc].buffer._webgpuBuffer);
                    } else {
                        encoder.setVertexBuffer(1, this.dummyColorBuffer);
                    }
                }
                
                const indexBuf = gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING);
                if (indexBuf && indexBuf._webgpuBuffer) {
                    encoder.setIndexBuffer(indexBuf._webgpuBuffer, type === gl.UNSIGNED_INT ? 'uint32' : 'uint16');
                    encoder.drawIndexed(count, 1, offset / (type === gl.UNSIGNED_INT ? 4 : 2), 0, 0);
                }
            };

            
            
            
            
            // --- Compile WebGPU Cloud 3D Pipeline ---
            const cloud3DWGSL = `
struct Cloud3DUniforms {
    modelViewMatrix : mat4x4<f32>,
    projectionMatrix : mat4x4<f32>,
    cloudOrbitMatrix : mat4x4<f32>,
    colorParams : vec4<f32>, // rgb: color, a: alpha
    timeParams : vec4<f32>, // x: animTime, y: time, z: waterRadius, w: 0
    lightDir : vec4<f32>,
    cameraPos : vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : Cloud3DUniforms;

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) localPos : vec3<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) vWorldPos : vec3<f32>,
    @location(1) vLocalPos : vec3<f32>,
};

fn puffNoise(p : vec3<f32>, t : f32) -> f32 {
    return sin(p.x * 0.8 + t * 1.5) * cos(p.y * 1.1 + t * 1.2) * sin(p.z * 0.9 + t * 1.7);
}

@vertex
fn vs_main(in : VertexInput) -> VertexOutput {
    var out : VertexOutput;
    out.vLocalPos = in.localPos;
    
    var animatedPos = in.position;
    var normLocal = vec3<f32>(0.0, 1.0, 0.0);
    if (length(in.localPos) > 0.001) {
        normLocal = normalize(in.localPos);
    }
    
    let puff = puffNoise(in.position * 0.5, uniforms.timeParams.x) * 0.35;
    animatedPos = animatedPos + normLocal * puff;
    
    let rotatedPos = uniforms.cloudOrbitMatrix * vec4<f32>(animatedPos, 1.0);
    out.vWorldPos = rotatedPos.xyz;
    out.position = uniforms.projectionMatrix * uniforms.modelViewMatrix * rotatedPos;
    
    return out;
}

fn hash(p_in : vec3<f32>) -> f32 {
    var p = fract(p_in * vec3<f32>(443.897, 441.423, 437.195));
    p = p + dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
}

fn noise(x : vec3<f32>) -> f32 {
    let p = floor(x);
    var f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(p+vec3<f32>(0.0,0.0,0.0)), hash(p+vec3<f32>(1.0,0.0,0.0)), f.x),
                   mix(hash(p+vec3<f32>(0.0,1.0,0.0)), hash(p+vec3<f32>(1.0,1.0,0.0)), f.x), f.y),
               mix(mix(hash(p+vec3<f32>(0.0,0.0,1.0)), hash(p+vec3<f32>(1.0,0.0,1.0)), f.x),
                   mix(hash(p+vec3<f32>(0.0,1.0,1.0)), hash(p+vec3<f32>(1.0,1.0,1.0)), f.x), f.y), f.z);
}

fn fbm(p_in : vec3<f32>) -> f32 {
    var p = p_in;
    var v = 0.0;
    var a = 0.5;
    let shift = vec3<f32>(100.0);
    for (var i = 0; i < 3; i++) {
        v += a * noise(p);
        p = p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

@fragment
fn fs_main(in : VertexOutput) -> @location(0) vec4<f32> {
    let waterRadius = uniforms.timeParams.z;
    if (waterRadius > 0.0) {
        let rayDir = normalize(in.vWorldPos - uniforms.cameraPos.xyz);
        let cloudDist = length(in.vWorldPos - uniforms.cameraPos.xyz);
        let b = dot(uniforms.cameraPos.xyz, rayDir);
        let c = dot(uniforms.cameraPos.xyz, uniforms.cameraPos.xyz) - waterRadius * waterRadius;
        let h = b * b - c;
        if (h >= 0.0) {
            let tNear = -b - sqrt(h);
            if (c > 0.0) {
                if (tNear > 0.0 && tNear < cloudDist) {
                    discard;
                }
            } else {
                discard;
            }
        }
    }
    
    let viewDir = normalize(uniforms.cameraPos.xyz - in.vWorldPos);
    let normal = normalize(in.vLocalPos);
    
    let rim = max(0.0, dot(normal, viewDir));
    let env = smoothstep(0.0, 0.6, rim);
    
    let time = uniforms.timeParams.y;
    let coord = in.vWorldPos * 0.8 + vec3<f32>(time * 0.25, time * 0.1, time * 0.18);
    
    let n = fbm(coord);
    let fluffy = smoothstep(0.2, 0.65, n);
    
    let density = clamp(fluffy * 1.6 * env, 0.0, 1.0);
    if (density < 0.02) {
        discard;
    }
    
    let lightDir = normalize(uniforms.lightDir.xyz);
    let shadowNoise = fbm(coord + lightDir * 0.5);
    let shadow = smoothstep(0.2, 0.8, shadowNoise);
    
    let baseColor = uniforms.colorParams.rgb;
    let shadowColor = mix(baseColor * 0.6, vec3<f32>(0.55, 0.65, 0.8), 0.6);
    
    let lightDot = dot(normal, lightDir);
    let lightIntensity = smoothstep(-0.2, 0.8, lightDot);
    
    let finalColor = mix(shadowColor, baseColor, lightIntensity * shadow);
    
    return vec4<f32>(finalColor, density * uniforms.colorParams.a);
}
`;
            this.cloud3DShaderModule = this.device.createShaderModule({ code: cloud3DWGSL });
            
            this.cloud3DBindGroupLayout = this.device.createBindGroupLayout({
                entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }]
            });

            // --- Compile WebGPU Water Pipeline ---
            const waterWGSL = `
struct WaterUniforms {
    modelViewMatrix : mat4x4<f32>,
    projectionMatrix : mat4x4<f32>,
    waterColor : vec4<f32>,
    opacityTimeWaveLevel : vec4<f32>, // x: opacity, y: time, z: waveStrength, w: waterLevel
    lightDir : vec4<f32>,
    cameraPos : vec4<f32>,
    renderDist : vec4<f32>, // x: enabled, y: maxDist, z: 0, w: 0
    boatCount : vec4<f32>,  // x: count, yzw: 0
    boatPos0 : vec4<f32>, boatPos1 : vec4<f32>, boatPos2 : vec4<f32>, boatPos3 : vec4<f32>,
    boatRight0 : vec4<f32>, boatRight1 : vec4<f32>, boatRight2 : vec4<f32>, boatRight3 : vec4<f32>,
    boatNormal0 : vec4<f32>, boatNormal1 : vec4<f32>, boatNormal2 : vec4<f32>, boatNormal3 : vec4<f32>,
    boatForward0 : vec4<f32>, boatForward1 : vec4<f32>, boatForward2 : vec4<f32>, boatForward3 : vec4<f32>,
    boatSize0 : vec4<f32>, boatSize1 : vec4<f32>, boatSize2 : vec4<f32>, boatSize3 : vec4<f32>,
    boatOffset0 : vec4<f32>, boatOffset1 : vec4<f32>, boatOffset2 : vec4<f32>, boatOffset3 : vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : WaterUniforms;
@group(0) @binding(1) var waterMaskTex : texture_2d<f32>;
@group(0) @binding(2) var waterSampler : sampler;

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) vPosition : vec3<f32>,
    @location(1) vNormal : vec3<f32>,
    @location(2) vDist : f32,
};

@vertex
fn vs_main(@location(0) aPosition : vec3<f32>) -> VertexOutput {
    var out : VertexOutput;
    let mvPosition = uniforms.modelViewMatrix * vec4<f32>(aPosition, 1.0);
    out.position = uniforms.projectionMatrix * mvPosition;
    out.vPosition = aPosition;
    out.vNormal = normalize(aPosition);
    out.vDist = length(mvPosition.xyz);
    return out;
}

fn hash(p : vec3<f32>) -> f32 {
    let pf = fract(p * vec3<f32>(127.1, 311.7, 74.7));
    return fract(sin(dot(pf, vec3<f32>(12.9898, 78.233, 37.719))) * 43758.5453);
}

fn noise3D(p : vec3<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(hash(i + vec3<f32>(0.0,0.0,0.0)), hash(i + vec3<f32>(1.0,0.0,0.0)), u.x),
            mix(hash(i + vec3<f32>(0.0,1.0,0.0)), hash(i + vec3<f32>(1.0,1.0,0.0)), u.x), u.y),
        mix(mix(hash(i + vec3<f32>(0.0,0.0,1.0)), hash(i + vec3<f32>(1.0,0.0,1.0)), u.x),
            mix(hash(i + vec3<f32>(0.0,1.0,1.0)), hash(i + vec3<f32>(1.0,1.0,1.0)), u.x), u.y), u.z
    );
}

fn fbm(p : vec3<f32>) -> f32 {
    var value = 0.0;
    var amplitude = 1.0;
    var frequency = 1.0;
    var maxVal = 0.0;
    for (var i = 0; i < 3; i++) {
        value += amplitude * noise3D(p * frequency);
        maxVal += amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value / maxVal;
}

fn getBoatPos(i : i32) -> vec3<f32> {
    if (i == 0) { return uniforms.boatPos0.xyz; }
    if (i == 1) { return uniforms.boatPos1.xyz; }
    if (i == 2) { return uniforms.boatPos2.xyz; }
    return uniforms.boatPos3.xyz;
}
fn getBoatRight(i : i32) -> vec3<f32> {
    if (i == 0) { return uniforms.boatRight0.xyz; }
    if (i == 1) { return uniforms.boatRight1.xyz; }
    if (i == 2) { return uniforms.boatRight2.xyz; }
    return uniforms.boatRight3.xyz;
}
fn getBoatNormal(i : i32) -> vec3<f32> {
    if (i == 0) { return uniforms.boatNormal0.xyz; }
    if (i == 1) { return uniforms.boatNormal1.xyz; }
    if (i == 2) { return uniforms.boatNormal2.xyz; }
    return uniforms.boatNormal3.xyz;
}
fn getBoatForward(i : i32) -> vec3<f32> {
    if (i == 0) { return uniforms.boatForward0.xyz; }
    if (i == 1) { return uniforms.boatForward1.xyz; }
    if (i == 2) { return uniforms.boatForward2.xyz; }
    return uniforms.boatForward3.xyz;
}
fn getBoatSize(i : i32) -> vec3<f32> {
    if (i == 0) { return uniforms.boatSize0.xyz; }
    if (i == 1) { return uniforms.boatSize1.xyz; }
    if (i == 2) { return uniforms.boatSize2.xyz; }
    return uniforms.boatSize3.xyz;
}
fn getBoatOffset(i : i32) -> vec3<f32> {
    if (i == 0) { return uniforms.boatOffset0.xyz; }
    if (i == 1) { return uniforms.boatOffset1.xyz; }
    if (i == 2) { return uniforms.boatOffset2.xyz; }
    return uniforms.boatOffset3.xyz;
}

@fragment
fn fs_main(in : VertexOutput) -> @location(0) vec4<f32> {
    if (uniforms.renderDist.x > 0.5 && in.vDist > uniforms.renderDist.y) {
        discard;
    }
    
    let nPos = normalize(in.vPosition);
    let theta = acos(clamp(nPos.y, -1.0, 1.0));
    var phi = atan2(nPos.z, nPos.x);
    if (phi < 0.0) { phi += 2.0 * 3.14159265359; }
    let uv = vec2<f32>(phi / (2.0 * 3.14159265359), theta / 3.14159265359);
    
    let isWater = textureSample(waterMaskTex, waterSampler, uv).r;
    if (isWater <= 0.001) {
        discard;
    }

    // Boat hull clipping
    let bCount = i32(uniforms.boatCount.x);
    for (var i = 0; i < 4; i++) {
        if (i >= bCount) { break; }
        let rel = in.vPosition - getBoatPos(i);
        let localX = dot(rel, getBoatRight(i));
        let localY = dot(rel, getBoatNormal(i));
        let localZ = dot(rel, getBoatForward(i));
        
        let size = getBoatSize(i);
        let offset = getBoatOffset(i);
        let offsetY = offset.x;
        let shapeType = offset.y;
        
        let dy = localY - offsetY;
        if (abs(dy) < size.y) {
            var halfWidth = size.x;
            let halfLength = size.z;
            let t = abs(localZ) / halfLength;
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
    
    let time = uniforms.opacityTimeWaveLevel.y;
    var normal = normalize(in.vNormal);
    
    let ripple = sin(in.vPosition.x * 25.0 + time * 4.0) * 0.02
               + cos(in.vPosition.z * 20.0 + time * 3.5) * 0.02
               + sin(in.vPosition.y * 15.0 + time * 5.0) * 0.015;
    normal = normalize(normal + vec3<f32>(ripple, ripple * 0.5, ripple * 0.7));
    
    let viewDir = normalize(in.vPosition - uniforms.cameraPos.xyz);
    let reflectDir = reflect(viewDir, normal);
    
    var skyColor = vec3<f32>(0.02, 0.03, 0.07) * (1.0 - max(0.0, reflectDir.y));
    let starPattern = hash(floor(reflectDir * 160.0));
    if (starPattern > 0.993) {
        skyColor += vec3<f32>(1.0, 1.0, 1.0) * (sin(time * 3.0 + starPattern * 10.0) * 0.5 + 0.5);
    }
    
    let landNoise = fbm(reflectDir * 4.5);
    let treeNoise = fbm(reflectDir * 12.0 + vec3<f32>(1.2, 3.4, 5.6));
    
    let horizonFactor = smoothstep(-0.25, 0.35, 0.5 - dot(reflectDir, normalize(in.vPosition)));
    let landFactor = smoothstep(0.38, 0.65, landNoise) * horizonFactor;
    
    var landReflColor = mix(vec3<f32>(0.12, 0.35, 0.15), vec3<f32>(0.38, 0.32, 0.22), smoothstep(0.4, 0.7, landNoise));
    if (treeNoise > 0.55 && landNoise > 0.42) {
        landReflColor = mix(landReflColor, vec3<f32>(0.06, 0.22, 0.08), 0.7);
    }
    
    var reflectedScene = mix(skyColor, landReflColor, landFactor);
    
    let lightDir = normalize(uniforms.lightDir.xyz);
    let sunSpec = pow(max(dot(reflectDir, lightDir), 0.0), 120.0);
    reflectedScene += vec3<f32>(1.0, 0.96, 0.85) * sunSpec * 2.0;
    
    var fresnel = pow(1.0 - abs(dot(normal, viewDir)), 4.0);
    fresnel = clamp(fresnel * 0.75 + 0.12, 0.0, 1.0);
    
    let deepNavyColor = vec3<f32>(0.01, 0.08, 0.32);
    var baseSeaColor = uniforms.waterColor.rgb;
    if (isWater > 0.35) {
        let t = clamp((isWater - 0.35) / 0.65, 0.0, 1.0);
        baseSeaColor = mix(uniforms.waterColor.rgb, deepNavyColor, t);
    }
    
    let spec = pow(max(dot(reflect(-lightDir, normal), -viewDir), 0.0), 32.0) * 0.35;
    let baseWaterColor = baseSeaColor * (0.85 + 0.15 * spec);
    
    var finalColor = mix(baseWaterColor, reflectedScene, fresnel);
    
    // Caustics in shallow water
    if (isWater < 0.40) {
        let cPos = in.vPosition * 22.0 + vec3<f32>(time * 0.9, time * 0.7, time * 0.8);
        let c1 = noise3D(cPos);
        let c2 = noise3D(cPos * 1.4 + vec3<f32>(2.3, 1.7, 4.1));
        let caustic = pow(min(c1, c2), 2.2) * 1.5;
        let causticMask = (1.0 - smoothstep(0.05, 0.40, isWater)) * smoothstep(0.01, 0.05, isWater);
        finalColor += vec3<f32>(0.08, 0.10, 0.12) * caustic * causticMask;
    }
    
    // Shoreline animated foam
    let edgeFade = smoothstep(0.0, 0.08, isWater);
    let foamFactor = smoothstep(0.0, 0.03, edgeFade) * (1.0 - smoothstep(0.03, 0.18, edgeFade));
    var foamNoise = sin(in.vPosition.x * 65.0 + in.vPosition.z * 55.0 + time * 3.8) * 0.5 + 0.5;
    foamNoise += cos(in.vPosition.y * 110.0 - time * 3.5) * 0.25;
    foamNoise = clamp(foamNoise, 0.0, 1.0);
    let foamColor = vec3<f32>(0.96, 0.98, 1.0);
    finalColor = mix(finalColor, foamColor, foamFactor * 0.75 * foamNoise);
    
    // Depth opacity & fresnel alpha
    let depthOpacity = smoothstep(0.0, 0.40, isWater);
    var alpha = mix(uniforms.opacityTimeWaveLevel.x * depthOpacity, 0.96, fresnel);
    alpha += ripple * 0.10;
    alpha = clamp(alpha, 0.0, 0.98);
    alpha *= edgeFade;

    // Atmospheric Fog
    if (uniforms.renderDist.x > 0.5) {
        let fogStart = uniforms.renderDist.y * 0.55;
        let fogFactor = smoothstep(fogStart, uniforms.renderDist.y, in.vDist);
        let fogDir = normalize(in.vPosition - uniforms.cameraPos.xyz);
        let sunDot = max(dot(fogDir, lightDir), 0.0);
        let baseSkyFog = vec3<f32>(0.012, 0.035, 0.09);
        let litSkyFog = vec3<f32>(0.08, 0.14, 0.24);
        let atmosphericFog = mix(baseSkyFog, litSkyFog, sunDot * 0.5 + 0.1);
        finalColor = mix(finalColor, atmosphericFog, fogFactor * 0.98);
        alpha = mix(alpha, 0.0, fogFactor * 0.95);
    }

    return vec4<f32>(finalColor, alpha);
}
`;
            this.waterShaderModule = this.device.createShaderModule({ code: waterWGSL });
            
            this.waterBindGroupLayout = this.device.createBindGroupLayout({
                entries: [
                    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
                    { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
                    { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }
                ]
            });

            // --- Compile WebGPU Atmosphere Pipeline ---
            const atmosphereWGSL = `
struct AtmosphereUniforms {
    modelViewMatrix : mat4x4<f32>,
    projectionMatrix : mat4x4<f32>,
    color : vec4<f32>,
    lightDir : vec4<f32>,
    cameraPos : vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : AtmosphereUniforms;

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) vNormal : vec3<f32>,
    @location(1) vPosition : vec3<f32>,
};

@vertex
fn vs_main(@location(0) aPosition : vec3<f32>) -> VertexOutput {
    var out : VertexOutput;
    out.position = uniforms.projectionMatrix * uniforms.modelViewMatrix * vec4<f32>(aPosition, 1.0);
    out.vNormal = normalize(aPosition);
    out.vPosition = aPosition;
    return out;
}

@fragment
fn fs_main(in : VertexOutput) -> @location(0) vec4<f32> {
    let normal = normalize(in.vNormal);
    let viewDir = normalize(uniforms.cameraPos.xyz - in.vPosition);
    let lightDir = normalize(uniforms.lightDir.xyz);
    
    let cosTheta = dot(normal, viewDir);
    let fresnel = 1.0 - abs(cosTheta);
    
    var rim : f32;
    if (cosTheta < 0.0) {
        rim = mix(0.42, 1.0, fresnel);
    } else {
        rim = pow(fresnel, 3.5) * smoothstep(0.0, 0.20, cosTheta);
    }
    
    let lightInfluence = dot(normal, lightDir);
    let intensity = smoothstep(-0.4, 0.4, lightInfluence);
    
    let finalAlpha = rim * uniforms.color.a * (0.15 + 0.85 * intensity);
    return vec4<f32>(uniforms.color.rgb, finalAlpha);
}
`;
            this.atmosphereShaderModule = this.device.createShaderModule({ code: atmosphereWGSL });
            
            this.atmosphereBindGroupLayout = this.device.createBindGroupLayout({
                entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }]
            });

            
            // --- Compile WebGPU Sky Pipeline ---
            const skyWGSL2 = `
struct SkyUniforms {
    modelViewMatrix : mat4x4<f32>,
    projectionMatrix : mat4x4<f32>,
    timeParams : vec4<f32>, // x: time, y: gasIntensity, z: waterRadius, w: 0
    cameraPos : vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : SkyUniforms;

struct VertexInput {
    @location(0) position : vec3<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) vWorldDir : vec3<f32>,
};

@vertex
fn vs_main(in : VertexInput) -> VertexOutput {
    var out : VertexOutput;
    out.position = uniforms.projectionMatrix * uniforms.modelViewMatrix * vec4<f32>(in.position, 1.0);
    out.vWorldDir = normalize(in.position);
    return out;
}

fn hash(p_in : vec3<f32>) -> f32 {
    var p = fract(p_in * vec3<f32>(443.897, 441.423, 437.195));
    p = p + dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
}

fn noise(x : vec3<f32>) -> f32 {
    let p = floor(x);
    var f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(p+vec3<f32>(0.0,0.0,0.0)), hash(p+vec3<f32>(1.0,0.0,0.0)), f.x),
                   mix(hash(p+vec3<f32>(0.0,1.0,0.0)), hash(p+vec3<f32>(1.0,1.0,0.0)), f.x), f.y),
               mix(mix(hash(p+vec3<f32>(0.0,0.0,1.0)), hash(p+vec3<f32>(1.0,0.0,1.0)), f.x),
                   mix(hash(p+vec3<f32>(0.0,1.0,1.0)), hash(p+vec3<f32>(1.0,1.0,1.0)), f.x), f.y), f.z);
}

fn fbm(p_in : vec3<f32>) -> f32 {
    var p = p_in;
    var v = 0.0;
    var a = 0.5;
    let shift = vec3<f32>(100.0);
    for (var i = 0; i < 4; i++) {
        v += a * noise(p);
        p = p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

@fragment
fn fs_main(in : VertexOutput) -> @location(0) vec4<f32> {
    let dir = normalize(in.vWorldDir);
    let waterRadius = uniforms.timeParams.z;
    if (waterRadius > 0.0) {
        let b = dot(uniforms.cameraPos.xyz, dir);
        let c = dot(uniforms.cameraPos.xyz, uniforms.cameraPos.xyz) - waterRadius * waterRadius;
        let h = b * b - c;
        if (h >= 0.0) {
            let tNear = -b - sqrt(h);
            if (c > 0.0) {
                if (tNear > 0.0) {
                    discard;
                }
            } else {
                discard;
            }
        }
    }
    
    let starPattern = hash(floor(dir * 160.0));
    var stars = 0.0;
    if (starPattern > 0.995) {
        let intensity = sin(uniforms.timeParams.x * 1.8 + starPattern * 100.0) * 0.4 + 0.6;
        stars = pow(fract(starPattern * 1234.56), 25.0) * intensity * 2.0;
    }
    
    let gasCoords = dir * 2.8 + vec3<f32>(0.0, uniforms.timeParams.x * 0.003, uniforms.timeParams.x * 0.0015);
    let n1 = fbm(gasCoords);
    let n2 = fbm(gasCoords + vec3<f32>(3.2, 1.5, -2.1));
    
    let colorNebula1 = vec3<f32>(0.01, 0.005, 0.04);
    let colorNebula2 = vec3<f32>(0.08, 0.03, 0.22);
    let colorNebula3 = vec3<f32>(0.01, 0.12, 0.25);
    
    let blend1 = smoothstep(0.2, 0.7, n1);
    let blend2 = smoothstep(0.4, 0.8, n2);
    var gasColor = mix(colorNebula1, colorNebula2, blend1);
    gasColor = mix(gasColor, colorNebula3, blend2);
    
    gasColor = gasColor * uniforms.timeParams.y;
    
    let finalColor = gasColor + vec3<f32>(stars, stars, stars);
    return vec4<f32>(finalColor, 1.0);
}
`;
            this.skyShaderModule = this.device.createShaderModule({ code: skyWGSL2 });
            
            this.skyBindGroupLayout = this.device.createBindGroupLayout({
                entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }]
            });

            // --- Compile WebGPU Sky Pipeline ---
            const skyWGSL = `
struct SkyUniforms {
    viewProjInverse : mat4x4<f32>,
    cameraPos : vec4<f32>,
    params : vec4<f32>, // x: time, y: gasIntensity, z: waterRadius, w: 0
    sunDir : vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : SkyUniforms;

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) worldDir : vec3<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
    var pos = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0,  3.0)
    );
    let xy = pos[vertexIndex];
    var out : VertexOutput;
    out.position = vec4<f32>(xy, 1.0, 1.0);
    
    let clipPos = vec4<f32>(xy, 1.0, 1.0);
    var worldPos = uniforms.viewProjInverse * clipPos;
    worldPos = worldPos / worldPos.w;
    
    out.worldDir = normalize(worldPos.xyz - uniforms.cameraPos.xyz);
    return out;
}

fn hash(p_in: vec3<f32>) -> f32 {
    var p = fract(p_in * vec3<f32>(443.897, 441.423, 437.195));
    let d = dot(p, p.yzx + vec3<f32>(19.19, 19.19, 19.19));
    p += vec3<f32>(d, d, d);
    return fract((p.x + p.y) * p.z);
}

fn noise(x: vec3<f32>) -> f32 {
    let p = floor(x);
    var f = fract(x);
    f = f * f * (vec3<f32>(3.0, 3.0, 3.0) - vec3<f32>(2.0, 2.0, 2.0) * f);
    return mix(
        mix(
            mix(hash(p + vec3<f32>(0.0,0.0,0.0)), hash(p + vec3<f32>(1.0,0.0,0.0)), f.x),
            mix(hash(p + vec3<f32>(0.0,1.0,0.0)), hash(p + vec3<f32>(1.0,1.0,0.0)), f.x),
            f.y
        ),
        mix(
            mix(hash(p + vec3<f32>(0.0,0.0,1.0)), hash(p + vec3<f32>(1.0,0.0,1.0)), f.x),
            mix(hash(p + vec3<f32>(0.0,1.0,1.0)), hash(p + vec3<f32>(1.0,1.0,1.0)), f.x),
            f.y
        ),
        f.z
    );
}

fn fbm(p_in: vec3<f32>) -> f32 {
    var v = 0.0;
    var a = 0.5;
    let shift = vec3<f32>(100.0, 100.0, 100.0);
    var p = p_in;
    for (var i = 0u; i < 4u; i++) {
        v += a * noise(p);
        p = p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

@fragment
fn fs_main(@location(0) worldDir : vec3<f32>) -> @location(0) vec4<f32> {
    let dir = normalize(worldDir);
    let uWaterRadius = uniforms.params.z;
    let uCameraPos = uniforms.cameraPos.xyz;
    let uTime = uniforms.params.x;
    let uGasIntensity = uniforms.params.y;
    let uSunDir = normalize(uniforms.sunDir.xyz);

    if (uWaterRadius > 0.0) {
        let b = dot(uCameraPos, dir);
        let c = dot(uCameraPos, uCameraPos) - uWaterRadius * uWaterRadius;
        let h = b * b - c;
        if (h >= 0.0) {
            let tNear = -b - sqrt(h);
            if (c > 0.0) {
                if (tNear > 0.0) {
                    discard;
                }
            } else {
                discard;
            }
        }
    }
    
    // Draw Sun
    let sunDot = dot(dir, uSunDir);
    var sunColor = vec3<f32>(0.0);
    if (sunDot > 0.9998) {
        sunColor = vec3<f32>(2.0, 1.9, 1.8); // Core bright white-yellow
    } else if (sunDot > 0.998) {
        let glow = (sunDot - 0.998) / (0.9998 - 0.998);
        sunColor = vec3<f32>(1.0, 0.8, 0.5) * glow;
    }
    
    let starPattern = hash(floor(dir * 160.0));
    var stars = 0.0;
    if (starPattern > 0.995) {
        let intensity = sin(uTime * 1.8 + starPattern * 100.0) * 0.4 + 0.6;
        stars = pow(fract(starPattern * 1234.56), 25.0) * intensity * 2.0;
    }
    
    let gasCoords = dir * 2.8 + vec3<f32>(0.0, uTime * 0.003, uTime * 0.0015);
    let n1 = fbm(gasCoords);
    let n2 = fbm(gasCoords + vec3<f32>(3.2, 1.5, -2.1));
    
    let colorNebula1 = vec3<f32>(0.01, 0.005, 0.04);
    let colorNebula2 = vec3<f32>(0.08, 0.03, 0.22);
    let colorNebula3 = vec3<f32>(0.01, 0.12, 0.25);
    let colorNebula4 = vec3<f32>(0.28, 0.04, 0.16);
    
    var skyColor = mix(colorNebula1, colorNebula2, n1);
    skyColor = mix(skyColor, colorNebula3, n2 * 0.7);
    skyColor += colorNebula4 * max(n1 * n2 - 0.08, 0.0) * 1.5;
    
    skyColor *= uGasIntensity;
    let finalColor = skyColor + vec3<f32>(stars, stars, stars) + sunColor;
    
    return vec4<f32>(finalColor, 1.0);
}
            `;

            const shaderModule = this.webgpu.device.createShaderModule({ code: skyWGSL });

            this.webgpu.skyPipeline = this.webgpu.device.createRenderPipeline({
              layout: 'auto',
              vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
              },
              fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{ format: this.webgpu.format }],
              },
              primitive: {
                topology: 'triangle-list',
              },
              depthStencil: {
                depthWriteEnabled: false,
                depthCompare: 'always',
                format: 'depth24plus',
              },
            });

            
            // --- Compile WebGPU Terrain Pipeline ---
            const terrainWGSL = `
struct TerrainUniforms {
    viewProj : mat4x4<f32>,
    lightSpaceMatrix : mat4x4<f32>,
    cameraPos : vec4<f32>,
    lightDir : vec4<f32>,
    waterColor : vec4<f32>,
    params : vec4<f32>, // x: waterRadius, y: renderDistEnabled, z: maxRenderDist, w: shadowsEnabled
    shadowTexelSize : vec2<f32>,
    tunnelCount : u32,
    isTunnelMesh : f32,
    tunnels : array<vec4<f32>, 64>,
};

@group(0) @binding(0) var<uniform> uniforms : TerrainUniforms;
@group(0) @binding(1) var shadowMap : texture_depth_2d;
@group(0) @binding(2) var shadowSampler : sampler_comparison;

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) color : vec3<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) color : vec3<f32>,
    @location(1) normal : vec3<f32>,
    @location(2) worldPos : vec3<f32>,
    @location(3) lightSpacePos : vec4<f32>,
    @location(4) dist : f32,
};

@vertex
fn vs_main(in : VertexInput) -> VertexOutput {
    var out : VertexOutput;
    if (length(in.position) < 0.01) {
        out.position = vec4<f32>(9999.0, 9999.0, 9999.0, 1.0);
        return out;
    }
    
    out.worldPos = in.position;
    out.normal = normalize(in.position);
    out.color = in.color;
    out.dist = length(in.position - uniforms.cameraPos.xyz);
    
    out.position = uniforms.viewProj * vec4<f32>(in.position, 1.0);
    out.lightSpacePos = uniforms.lightSpaceMatrix * vec4<f32>(in.position, 1.0);
    
    return out;
}

fn calculateShadow(lightSpacePos : vec4<f32>, normal : vec3<f32>, lightDir : vec3<f32>) -> f32 {
    if (uniforms.params.w < 0.5) { return 1.0; }
    
    var projCoords = lightSpacePos.xyz / lightSpacePos.w;
    projCoords = projCoords * 0.5 + vec3<f32>(0.5, 0.5, 0.5); // convert to 0-1 range
    projCoords.y = 1.0 - projCoords.y; // Flip Y for WebGPU shadow map lookup
    
    if (projCoords.z > 1.0 || projCoords.z < 0.0) { return 1.0; }
    if (projCoords.x < 0.0 || projCoords.x > 1.0 || projCoords.y < 0.0 || projCoords.y > 1.0) { return 1.0; }
    
    let cosTheta = clamp(dot(normal, lightDir), 0.0, 1.0);
    let slope = sqrt(max(0.0, 1.0 - cosTheta * cosTheta)) / max(cosTheta, 0.05);
    let bias = clamp(0.0005 + 0.0012 * slope, 0.0005, 0.0022);
    
    var shadow = 0.0;
    for (var x = -1; x <= 1; x++) {
        for (var y = -1; y <= 1; y++) {
            let offset = vec2<f32>(f32(x), f32(y)) * uniforms.shadowTexelSize;
            shadow += textureSampleCompare(shadowMap, shadowSampler, projCoords.xy + offset, projCoords.z - bias);
        }
    }
    shadow = shadow / 9.0;
    
    let distFromCenter = length(projCoords.xy - vec2<f32>(0.5));
    let edgeFade = 1.0 - smoothstep(0.36, 0.49, distFromCenter);
    
    return mix(1.0, shadow, edgeFade);
}

@fragment
fn fs_main(in : VertexOutput) -> @location(0) vec4<f32> {
    if (uniforms.isTunnelMesh > 0.5) {
        let distToCenter = length(in.worldPos);
    } else {
        for (var i = 0u; i < 64u; i++) {
            if (i < uniforms.tunnelCount) {
                let t = uniforms.tunnels[i];
                let diff = in.worldPos - t.xyz;
                if (dot(diff, diff) < (t.w * 0.96) * (t.w * 0.96)) {
                    discard;
                }
            }
        }
    }
    
    if (uniforms.params.y > 0.5 && in.dist > uniforms.params.z) {
        discard;
    }
    
    var finalColor = in.color;
    if (uniforms.lightDir.w > 0.5) {
        let normal = normalize(in.normal);
        let lightDir = normalize(uniforms.lightDir.xyz);
        let diffuseVal = max(dot(normal, lightDir), 0.0);
        
        var shadow = calculateShadow(in.lightSpacePos, normal, lightDir);
        if (diffuseVal <= 0.0) { shadow = 0.0; }
        let lit = mix(0.3, 1.0, shadow);
        let diffuse = diffuseVal * lit * 0.8 + 0.2;
        finalColor = in.color * diffuse;
    }
    
    let dist = length(in.worldPos);
    if (dist < uniforms.params.x) {
        let depth = uniforms.params.x - dist;
        var tintFactor = 1.0 - exp(-depth * 5.0);
        tintFactor = clamp(tintFactor * uniforms.waterColor.w, 0.0, 0.85);
        finalColor = mix(finalColor, uniforms.waterColor.xyz, tintFactor);
    }
    
    return vec4<f32>(finalColor, 1.0);
}
`;
            const terrainModule = this.webgpu.device.createShaderModule({ label: 'Terrain Shader', code: terrainWGSL });
            
            this.webgpu.terrainPipeline = this.webgpu.device.createRenderPipeline({
                label: 'Terrain Pipeline',
                layout: 'auto',
                vertex: {
                    module: terrainModule,
                    entryPoint: 'vs_main',
                    buffers: [
                        { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                        { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] }
                    ]
                },
                fragment: {
                    module: terrainModule,
                    entryPoint: 'fs_main',
                    targets: [{ format: this.webgpu.format }]
                },
                primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'cw' },
                depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' }
            });

            const shadowSize = 1024;
            this.webgpu.shadowDepthTexture = this.webgpu.device.createTexture({
                size: [shadowSize, shadowSize, 1],
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
                format: 'depth32float',
            });
            this.webgpu.shadowDepthTextureView = this.webgpu.shadowDepthTexture.createView();
            
            this.webgpu.shadowSampler = this.webgpu.device.createSampler({
                compare: 'less',
                magFilter: 'linear',
                minFilter: 'linear',
            });

            this.webgpu.terrainShadowPipeline = this.webgpu.device.createRenderPipeline({
                label: 'Terrain Shadow Pipeline',
                layout: 'auto',
                vertex: {
                    module: terrainModule,
                    entryPoint: 'vs_main',
                    buffers: [
                        { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                        { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] }
                    ]
                },
                primitive: { topology: 'triangle-list', cullMode: 'none', frontFace: 'cw' },
                depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth32float' }
            });

            this.webgpu.terrainUniformBuffer = this.webgpu.device.createBuffer({
                size: 1232,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            this.webgpu.terrainBindGroup = this.webgpu.device.createBindGroup({
                layout: this.webgpu.terrainPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.webgpu.terrainUniformBuffer } },
                    { binding: 1, resource: this.webgpu.shadowDepthTextureView },
                    { binding: 2, resource: this.webgpu.shadowSampler }
                ]
            });
            
            this.webgpu.terrainShadowBindGroup = this.webgpu.device.createBindGroup({
                layout: this.webgpu.terrainShadowPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.webgpu.terrainUniformBuffer } },
                    { binding: 1, resource: this.webgpu.shadowDepthTextureView },
                    { binding: 2, resource: this.webgpu.shadowSampler }
                ]
            });

            // Uniform buffer size: 
            // viewProjInverse (mat4x4 = 64 bytes)
            // cameraPos (vec4 = 16 bytes)
            // params (vec4 = 16 bytes)
            // sunDir (vec4 = 16 bytes)
            // Total = 112 bytes
            this.webgpu.skyUniformBuffer = this.webgpu.device.createBuffer({
              size: 112,
              usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            this.webgpu.skyBindGroup = this.webgpu.device.createBindGroup({
              layout: this.webgpu.skyPipeline.getBindGroupLayout(0),
              entries: [
                {
                  binding: 0,
                  resource: {
                    buffer: this.webgpu.skyUniformBuffer,
                  },
                },
              ],
            });

    
            // Water Uniform Buffer & Dummy Water Mask
            this.webgpu.waterUniformBuffer = this.webgpu.device.createBuffer({
                size: 2048,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            const dummyWaterTex = this.webgpu.device.createTexture({
                size: [1, 1, 1],
                format: 'r8unorm',
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
            });
            this.webgpu.device.queue.writeTexture(
                { texture: dummyWaterTex },
                new Uint8Array([255]),
                { bytesPerRow: 1 },
                [1, 1, 1]
            );
            this.webgpu.dummyWaterMaskTextureView = dummyWaterTex.createView();
            this.webgpu.dummyWaterMaskSampler = this.webgpu.device.createSampler({
                magFilter: 'linear',
                minFilter: 'linear'
            });

            this.webgpu.waterPipeline = this.webgpu.device.createRenderPipeline({
                label: 'Native Water Pipeline',
                layout: 'auto',
                vertex: {
                    module: this.waterShaderModule,
                    entryPoint: 'vs_main',
                    buffers: [
                        { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }
                    ]
                },
                fragment: {
                    module: this.waterShaderModule,
                    entryPoint: 'fs_main',
                    targets: [{
                        format: this.format,
                        blend: {
                            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
                        }
                    }]
                },
                primitive: {
                    topology: 'triangle-list',
                    cullMode: 'none'
                },
                depthStencil: {
                    depthWriteEnabled: false,
                    depthCompare: 'less',
                    format: 'depth24plus'
                }
            });

        this.webgpu.dummyNormalBuffer = this.webgpu.device.createBuffer({
            size: 12,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        this.webgpu.device.queue.writeBuffer(this.webgpu.dummyNormalBuffer, 0, new Float32Array([0, 1, 0]));
        this.webgpu.dummyColorBuffer = this.webgpu.device.createBuffer({
            size: 12,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        this.webgpu.device.queue.writeBuffer(this.webgpu.dummyColorBuffer, 0, new Float32Array([0, 0, 0]));
        this.webgpu.ready = true;
            this.mode = 'webgl'; // Set primary high-performance WebGL mode
            console.log("Graphics API: Operating in Native WebGL High-Performance Mode.");
          }
        }
      } catch (e) {
        console.warn("Graphics API: WebGPU initialization check complete, using WebGL.", e);
      }
    } else {
      console.warn("Graphics API: Using WebGL Engine.");
    }

    this.mode = 'webgl';
    console.log("Graphics API: Operating in Native WebGL Engine Mode.");
  },

  renderWebGPU_MigratedParts(params) {
    if (!this.webgpu.ready) return;
    const { isUnderwater, invViewProj: viewProjInv, cameraPos, time, gasIntensity, waterRadius, finalLightDir, viewMatrix, projMatrix, lightSpaceMatrix, waterColor, waterOpacity, renderDistEnabled, maxRenderDist, shadowMapEnabled, shadowTexelSize } = params;
    const commandEncoder = this.webgpu.currentCommandEncoder || this.webgpu.device.createCommandEncoder();
    this.webgpu.currentCommandEncoder = commandEncoder;
    
    

    // --- Main Color Pass ---
    const textureView = this.webgpu.context.getCurrentTexture().createView();
    const clearColor = isUnderwater 
      ? { r: 0.01, g: 0.08, b: 0.16, a: 1.0 }
      : { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };

    const renderPassDescriptor = {
      colorAttachments: [{
        view: textureView,
        clearValue: clearColor,
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.webgpu.mainDepthTextureView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      }
    };
    
    
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    this.webgpu.currentPassEncoder = passEncoder;
    this.webgpu.currentCommandEncoder = commandEncoder;


    
    // Render Sky natively if available
    const isSkyOn = params.skyEnabled !== undefined ? params.skyEnabled : (typeof skyEnabled !== 'undefined' ? skyEnabled : true);
    if (this.webgpu.skyPipeline && isSkyOn) {
        passEncoder.setPipeline(this.webgpu.skyPipeline);
        passEncoder.setBindGroup(0, this.webgpu.skyBindGroup);
        
        const skyUniforms = new Float32Array(28); // 16 (inv) + 4 (camPos) + 4 (params) + 4 (sunDir) = 28
        if (viewProjInv) skyUniforms.set(viewProjInv, 0);
        if (cameraPos) skyUniforms.set(cameraPos, 16);
        skyUniforms[20] = (time || 0) * 0.05; // Time
        skyUniforms[21] = gasIntensity !== undefined ? gasIntensity : (typeof skyGasIntensity !== 'undefined' ? skyGasIntensity : 1.0); // GasIntensity
        skyUniforms[22] = (typeof window.isSpaceCameraMode !== 'undefined' && window.isSpaceCameraMode) ? 0.0 : (waterRadius || 0.0); // WaterRadius
        skyUniforms[23] = 0.0;
        if (finalLightDir) {
            skyUniforms.set(finalLightDir, 24);
        }
        this.webgpu.device.queue.writeBuffer(this.webgpu.skyUniformBuffer, 0, skyUniforms);
        
        passEncoder.draw(3, 1, 0, 0);
    }
    
    // Render Terrain
    if (this.webgpu.terrainPipeline && this.webgpu.terrainVertexBuffer) {
        passEncoder.setPipeline(this.webgpu.terrainPipeline);
        passEncoder.setBindGroup(0, this.webgpu.terrainBindGroup);
        passEncoder.setVertexBuffer(0, this.webgpu.terrainVertexBuffer);
        passEncoder.setVertexBuffer(1, this.webgpu.terrainColorBuffer);
        passEncoder.setIndexBuffer(this.webgpu.terrainIndexBuffer, this.webgpu.terrainUseUint32 ? 'uint32' : 'uint16');
        passEncoder.drawIndexed(this.webgpu.terrainIndicesLength, 1, 0, 0, 0);
    }

    // --- Render Water (Native WebGPU) ---
    if (this.webgpu.waterPipeline && this.webgpu.waterVertexBuffer && this.webgpu.waterIndicesLength > 0 && (typeof waterEnabled === 'undefined' || waterEnabled)) {
        const timeVal = time || 0;
        const wColor = waterColor || (typeof window.waterColor !== 'undefined' ? window.waterColor : [0.1, 0.4, 0.8]);
        const wOpacity = waterOpacity !== undefined ? waterOpacity : (typeof window.waterOpacity !== 'undefined' ? window.waterOpacity : 0.8);
        const wAnimTime = typeof window.waterAnimTime !== 'undefined' ? window.waterAnimTime : timeVal;
        const wWaveStrength = typeof window.waveStrength !== 'undefined' ? window.waveStrength : 1.0;
        const wLevel = typeof window.waterLevel !== 'undefined' ? window.waterLevel : 1.0;
        const lightDir = finalLightDir || [0, 1, 0];
        const camPos = cameraPos || [0, 0, 0];
        const renderDistE = renderDistEnabled ? 1.0 : 0.0;
        const renderDistVal = maxRenderDist !== undefined ? maxRenderDist : 100.0;
        const colls = typeof collectibles !== 'undefined' ? collectibles : [];

        // Collect top 4 boats for clipping
        let boatCount = 0;
        const topBoats = [null, null, null, null];
        const topBoatsDistSq = [Infinity, Infinity, Infinity, Infinity];

        const CLIPPING_MODELS = { "wood_boat": { size: [0.115, 0.055, 0.27], offset: [0.035, 1.0, 0.0] } };

        for (let i = 0; i < colls.length; i++) {
          const c = colls[i];
          if (c && c.active && (c.type in CLIPPING_MODELS) && !c.isPreview) {
            const dx = c.position[0] - camPos[0];
            const dy = c.position[1] - camPos[1];
            const dz = c.position[2] - camPos[2];
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
          if (topBoats[j] !== null) boatCount++;
        }

        const uData = new Float32Array(512); // 2048 bytes
        if (viewMatrix) uData.set(viewMatrix, 0);
        if (projMatrix) uData.set(projMatrix, 16);
        uData[32] = wColor[0]; uData[33] = wColor[1]; uData[34] = wColor[2]; uData[35] = 1.0;
        uData[36] = wOpacity; uData[37] = wAnimTime; uData[38] = wWaveStrength; uData[39] = wLevel;
        uData[40] = lightDir[0]; uData[41] = lightDir[1]; uData[42] = lightDir[2]; uData[43] = 0.0;
        uData[44] = camPos[0]; uData[45] = camPos[1]; uData[46] = camPos[2]; uData[47] = 0.0;
        uData[48] = renderDistE; uData[49] = renderDistVal; uData[50] = 0.0; uData[51] = 0.0;
        uData[52] = boatCount; uData[53] = 0.0; uData[54] = 0.0; uData[55] = 0.0;

        for (let i = 0; i < boatCount; i++) {
          const item = topBoats[i];
          const pPos = item.position;
          let n = item.normal || [0, 1, 0];
          let r = item.R || [1, 0, 0];
          let f = item.F || [0, 0, 1];
          const lenR = Math.hypot(r[0], r[1], r[2]) || 1;
          const lenN = Math.hypot(n[0], n[1], n[2]) || 1;
          const lenF = Math.hypot(f[0], f[1], f[2]) || 1;
          const cfg = CLIPPING_MODELS[item.type];

          const offP = 56 + i * 4;
          const offR = 72 + i * 4;
          const offN = 88 + i * 4;
          const offF = 104 + i * 4;
          const offS = 120 + i * 4;
          const offO = 136 + i * 4;

          uData[offP] = pPos[0]; uData[offP+1] = pPos[1]; uData[offP+2] = pPos[2]; uData[offP+3] = 0;
          uData[offR] = r[0]/lenR; uData[offR+1] = r[1]/lenR; uData[offR+2] = r[2]/lenR; uData[offR+3] = 0;
          uData[offN] = n[0]/lenN; uData[offN+1] = n[1]/lenN; uData[offN+2] = n[2]/lenN; uData[offN+3] = 0;
          uData[offF] = f[0]/lenF; uData[offF+1] = f[1]/lenF; uData[offF+2] = f[2]/lenF; uData[offF+3] = 0;
          uData[offS] = cfg.size[0]; uData[offS+1] = cfg.size[1]; uData[offS+2] = cfg.size[2]; uData[offS+3] = 0;
          uData[offO] = cfg.offset[0]; uData[offO+1] = cfg.offset[1]; uData[offO+2] = cfg.offset[2]; uData[offO+3] = 0;
        }

        this.webgpu.device.queue.writeBuffer(this.webgpu.waterUniformBuffer, 0, uData.buffer);

        const maskTexView = this.webgpu.waterMaskTextureView || this.webgpu.dummyWaterMaskTextureView;
        const maskSampler = this.webgpu.waterMaskSampler || this.webgpu.dummyWaterMaskSampler;

        const waterBindGroup = this.webgpu.device.createBindGroup({
            layout: this.webgpu.waterPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.webgpu.waterUniformBuffer } },
                { binding: 1, resource: maskTexView },
                { binding: 2, resource: maskSampler }
            ]
        });

        passEncoder.setPipeline(this.webgpu.waterPipeline);
        passEncoder.setBindGroup(0, waterBindGroup);
        passEncoder.setVertexBuffer(0, this.webgpu.waterVertexBuffer);
        passEncoder.setIndexBuffer(this.webgpu.waterIndexBuffer, this.webgpu.waterUseUint32 ? 'uint32' : 'uint16');
        passEncoder.drawIndexed(this.webgpu.waterIndicesLength, 1, 0, 0, 0);
    }

  },
};

// Expose legacy globals for the rest of the engine during migration
let isWebGPUReady = false; 

// Setup canvases
canvas = document.getElementById("mapCanvas"); // Primary Canvas (WebGPU)
let glCanvas = document.getElementById("glCanvas"); // Secondary Canvas (WebGL Overlay)

// Initialize WebGPU asynchronously
Graphics.init(canvas, glCanvas).then(() => {
  isWebGPUReady = Graphics.webgpu.ready;
});

// Initialize WebGL synchronously (Legacy requirement)
const initialAntialias = (typeof antialiasEnabled !== "undefined" && antialiasEnabled) || (typeof taauEnabled !== "undefined" && taauEnabled);
gl =
  glCanvas.getContext("webgl2", { antialias: initialAntialias, stencil: true, alpha: true, premultipliedAlpha: false }) ||
  glCanvas.getContext("webgl", { antialias: initialAntialias, stencil: true, alpha: true, premultipliedAlpha: false });

if (!gl) {
  // If overlay fails, try the primary canvas (legacy fallback path)
  gl = canvas.getContext("webgl2", { antialias: initialAntialias, stencil: true }) ||
       canvas.getContext("webgl", { antialias: initialAntialias, stencil: true });
}

if (!gl) {
  alert("เบราว์เซอร์ของคุณไม่รองรับ WebGL");
}

Graphics.webgl.gl = gl;
isWebGL2 = gl instanceof WebGL2RenderingContext;
Graphics.webgl.isWebGL2 = isWebGL2;
supportUint32 = isWebGL2 || gl.getExtension("OES_element_index_uint");

Graphics.webgl.supportUint32 = supportUint32;

if (!gl._patchedForWebGPU) {
    gl._patchedForWebGPU = true;
    gl._activeAttributes = {};
    gl._uniformValues = {};
    gl._colorMask = [true, true, true, true];
    gl._depthMask = true;
    gl._cullFace = gl.BACK;
    gl._frontFace = gl.CCW;
    gl._cullEnabled = false;
    gl._depthTest = false;
    gl._stencilEnabled = false;

    const origColorMask = gl.colorMask;
    gl.colorMask = function(r, g, b, a) { origColorMask.apply(this, arguments); gl._colorMask = [r, g, b, a]; };
    const origDepthMask = gl.depthMask;
    gl.depthMask = function(flag) { origDepthMask.apply(this, arguments); gl._depthMask = flag; };
    const origEnable = gl.enable;
    gl.enable = function(cap) { origEnable.apply(this, arguments); if (cap === gl.CULL_FACE) gl._cullEnabled = true; if (cap === gl.DEPTH_TEST) gl._depthTest = true; if (cap === gl.STENCIL_TEST) gl._stencilEnabled = true; };
    const origDisable = gl.disable;
    gl.disable = function(cap) { origDisable.apply(this, arguments); if (cap === gl.CULL_FACE) gl._cullEnabled = false; if (cap === gl.DEPTH_TEST) gl._depthTest = false; if (cap === gl.STENCIL_TEST) gl._stencilEnabled = false; };
    const origCullFace = gl.cullFace;
    gl.cullFace = function(mode) { origCullFace.apply(this, arguments); gl._cullFace = mode; };
    const origFrontFace = gl.frontFace;
    gl.frontFace = function(mode) { origFrontFace.apply(this, arguments); gl._frontFace = mode; };

    const origGetAttribLocation = gl.getAttribLocation;
    gl.getAttribLocation = function(prog, name) {
        const loc = origGetAttribLocation.apply(this, arguments);
        if (!prog._attribNamesInv) prog._attribNamesInv = {};
        prog._attribNamesInv[name] = loc;
        return loc;
    };

    const origVertexAttribPointer = gl.vertexAttribPointer;
    gl.vertexAttribPointer = function(index, size, type, normalized, stride, offset) {
        origVertexAttribPointer.apply(this, arguments);
    };

    const origGetUniformLocation = gl.getUniformLocation;
    gl.getUniformLocation = function(prog, name) {
        const loc = origGetUniformLocation.apply(this, arguments);
        if (loc) { loc._name = name; loc._prog = prog; }
        return loc;
    };

    const origUseProgram = gl.useProgram;
    gl.useProgram = function(prog) {
        origUseProgram.apply(this, arguments);
        gl._currentProgram = prog;
        if (prog === window.modelProgram) prog._name = 'model';
        if (prog === window.charProgram) prog._name = 'char';
        if (!prog._uniformValues) prog._uniformValues = {};
    };

    function trackUniform(loc, value) {
        if (loc && loc._name && loc._prog) loc._prog._uniformValues[loc._name] = value;
    }

    const origUniform1f = gl.uniform1f; gl.uniform1f = function(loc, v0) { origUniform1f.apply(this, arguments); trackUniform(loc, [v0]); };
    const origUniform2f = gl.uniform2f; gl.uniform2f = function(loc, v0, v1) { origUniform2f.apply(this, arguments); trackUniform(loc, [v0, v1]); };
    const origUniform3f = gl.uniform3f; gl.uniform3f = function(loc, v0, v1, v2) { origUniform3f.apply(this, arguments); trackUniform(loc, [v0, v1, v2]); };
    const origUniform1i = gl.uniform1i; gl.uniform1i = function(loc, v0) { origUniform1i.apply(this, arguments); trackUniform(loc, [v0]); };
    const origUniform3fv = gl.uniform3fv; gl.uniform3fv = function(loc, v) { origUniform3fv.apply(this, arguments); trackUniform(loc, v); };
    const origUniformMatrix4fv = gl.uniformMatrix4fv; gl.uniformMatrix4fv = function(loc, trans, v) { origUniformMatrix4fv.apply(this, arguments); trackUniform(loc, v); };

    const origBufferData = gl.bufferData;
    gl.bufferData = function(target, data, usage) {
        origBufferData.apply(this, arguments);
    };
    
    const origDrawElements = gl.drawElements;
    gl.drawElements = function(mode, count, type, offset) {
        origDrawElements.apply(this, arguments);
    };
}


      function resizeCanvas() {
        const w = Math.max(1, Math.round(window.innerWidth * renderScale));
        const h = Math.max(1, Math.round(window.innerHeight * renderScale));
        canvas.width = w;
        canvas.height = h;
        if (Graphics.webgpu.device && Graphics.webgpu.context) {
          const device = Graphics.webgpu.device;
          if (Graphics.webgpu.mainDepthTexture) Graphics.webgpu.mainDepthTexture.destroy();
          Graphics.webgpu.mainDepthTexture = device.createTexture({
            size: [w, h, 1],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
          });
          Graphics.webgpu.mainDepthTextureView = Graphics.webgpu.mainDepthTexture.createView();
        }
        if (glCanvas) {
          glCanvas.width = w;
          glCanvas.height = h;
        }
        gl.viewport(0, 0, w, h);

        if (
          typeof render === "function" &&
          typeof gameStarted !== "undefined" &&
          gameStarted
        ) {
          render(performance.now(), true);
        }
      }
      resizeCanvas();
      window.addEventListener("resize", () => {
        resizeCanvas();
        updateActionSlotsPosition();
      });


      function createShader(source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.error("Shader error:", gl.getShaderInfoLog(shader));
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      }

      const vertexShader = createShader(vertexShaderSource, gl.VERTEX_SHADER);
      const fragmentShader = createShader(
        fragmentShaderSource,
        gl.FRAGMENT_SHADER,
      );
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.useProgram(program);
      program._name = 'model'; // Route to model WGSL in hybrid mode
      window.surfaceProgram = program;

      const positionLoc = gl.getAttribLocation(program, "aPosition");
      const colorLoc = gl.getAttribLocation(program, "aColor");
      const terrainRadiusAttrLoc = gl.getAttribLocation(program, "aTerrainRadius");
      const tunnelCenterAttrLoc = gl.getAttribLocation(program, "aTunnelCenter");
      const modelViewLoc = gl.getUniformLocation(program, "uModelViewMatrix");
      const projectionLoc = gl.getUniformLocation(program, "uProjectionMatrix");
      const lightDirLoc = gl.getUniformLocation(program, "uLightDir");
      const useLightingLoc = gl.getUniformLocation(program, "uUseLighting");

      const tunnelsLoc = gl.getUniformLocation(program, "uTunnels");
      const tunnelCountLoc = gl.getUniformLocation(program, "uTunnelCount");
      const isTunnelMeshLoc = gl.getUniformLocation(program, "uIsTunnelMesh");

      const terrainWaterRadiusLoc = gl.getUniformLocation(
        program,
        "uWaterRadius",
      );
      const terrainWaterColorLoc = gl.getUniformLocation(
        program,
        "uWaterColor",
      );
      const terrainWaterOpacityLoc = gl.getUniformLocation(
        program,
        "uWaterOpacity",
      );

      const terrainRenderDistEnabledLoc = gl.getUniformLocation(
        program,
        "uRenderDistEnabled",
      );
      const terrainMaxRenderDistLoc = gl.getUniformLocation(
        program,
        "uMaxRenderDist",
      );
      const terrainCameraPosLoc = gl.getUniformLocation(
        program,
        "uCameraPos",
      );

      // --- Model Program Setup ---
      const modelVS = createShader(modelVertexShaderSource, gl.VERTEX_SHADER);
      const modelFS = createShader(
        modelFragmentShaderSource,
        gl.FRAGMENT_SHADER,
      );
      const modelProgram = gl.createProgram();
      gl.attachShader(modelProgram, modelVS);
      gl.attachShader(modelProgram, modelFS);
      gl.linkProgram(modelProgram);

      const modelPosLoc = gl.getAttribLocation(modelProgram, "aPosition");
      const modelColorLoc = gl.getAttribLocation(modelProgram, "aColor");
      const modelNormalLoc = gl.getAttribLocation(modelProgram, "aNormal");
      const modelMVLoc = gl.getUniformLocation(
        modelProgram,
        "uModelViewMatrix",
      );
      const modelProjLoc = gl.getUniformLocation(
        modelProgram,
        "uProjectionMatrix",
      );
      const modelLightDirLoc = gl.getUniformLocation(modelProgram, "uLightDir");
      const modelTintLoc = gl.getUniformLocation(modelProgram, "uTint");
      window.modelTintLoc = modelTintLoc;

      const modelWaterRadiusLoc = gl.getUniformLocation(
        modelProgram,
        "uWaterRadius",
      );
      const modelWaterColorLoc = gl.getUniformLocation(
        modelProgram,
        "uWaterColor",
      );
      const modelWaterOpacityLoc = gl.getUniformLocation(
        modelProgram,
        "uWaterOpacity",
      );

      const modelTimeLoc = gl.getUniformLocation(modelProgram, "uTime");
      const modelSwayFactorLoc = gl.getUniformLocation(
        modelProgram,
        "uSwayFactor",
      );
      const modelWaterSwayFactorLoc = gl.getUniformLocation(
        modelProgram,
        "uWaterSwayFactor",
      );
      const modelPlanetRadiusLoc = gl.getUniformLocation(
        modelProgram,
        "uPlanetRadius",
      );
      const modelCameraPosLoc = gl.getUniformLocation(
        modelProgram,
        "uCameraPos",
      );
      const modelRenderDistEnabledLoc = gl.getUniformLocation(
        modelProgram,
        "uRenderDistEnabled",
      );
      const modelMaxRenderDistLoc = gl.getUniformLocation(
        modelProgram,
        "uMaxRenderDist",
      );

      let charLocalPosLoc, charColorLoc;

      const charVS = createShader(
        characterVertexShaderSource,
        gl.VERTEX_SHADER,
      );
      const charFS = createShader(
        characterFragmentShaderSource,
        gl.FRAGMENT_SHADER,
      );
      const charProgram = gl.createProgram();
      gl.attachShader(charProgram, charVS);
      gl.attachShader(charProgram, charFS);
      gl.linkProgram(charProgram);

      const charPosLoc = gl.getAttribLocation(charProgram, "aPosition");
      charLocalPosLoc = gl.getAttribLocation(charProgram, "aLocalPos");
      const charNormLoc = gl.getAttribLocation(charProgram, "aNormal");
      charColorLoc = gl.getAttribLocation(charProgram, "aColor");
      const charMVLoc = gl.getUniformLocation(charProgram, "uModelViewMatrix");
      const charProjLoc = gl.getUniformLocation(
        charProgram,
        "uProjectionMatrix",
      );
      const charLightDirLoc = gl.getUniformLocation(charProgram, "uLightDir");
      const charCameraPosLoc = gl.getUniformLocation(charProgram, "uCameraPos");

      const charWaterRadiusLoc = gl.getUniformLocation(
        charProgram,
        "uWaterRadius",
      );
      const charWaterColorLoc = gl.getUniformLocation(
        charProgram,
        "uWaterColor",
      );
      const charWaterOpacityLoc = gl.getUniformLocation(
        charProgram,
        "uWaterOpacity",
      );

      if (typeof WaterSystem !== "undefined" && WaterSystem.init) {
        WaterSystem.init(gl, supportUint32);
      }
      if (typeof CaveSystem !== "undefined" && CaveSystem.init) {
        CaveSystem.init(gl, supportUint32);
      }

      // --- Atmosphere Program Setup ---
      const atmosphereVS = createShader(
        atmosphereVertexShaderSource,
        gl.VERTEX_SHADER,
      );
      const atmosphereFS = createShader(
        atmosphereFragmentShaderSource,
        gl.FRAGMENT_SHADER,
      );
      const atmosphereProgram = gl.createProgram();
      gl.attachShader(atmosphereProgram, atmosphereVS);
      gl.attachShader(atmosphereProgram, atmosphereFS);
      gl.linkProgram(atmosphereProgram);
atmosphereProgram._name = 'atmosphere';
window.atmosphereProgram = atmosphereProgram;

      const atmospherePosLoc = gl.getAttribLocation(
        atmosphereProgram,
        "aPosition",
      );
      const atmosphereMVLoc = gl.getUniformLocation(
        atmosphereProgram,
        "uModelViewMatrix",
      );
      const atmosphereProjLoc = gl.getUniformLocation(
        atmosphereProgram,
        "uProjectionMatrix",
      );
      const atmosphereColorLoc = gl.getUniformLocation(
        atmosphereProgram,
        "uColor",
      );
      const atmosphereAlphaLoc = gl.getUniformLocation(
        atmosphereProgram,
        "uAlpha",
      );
      const atmosphereLightDirLoc = gl.getUniformLocation(
        atmosphereProgram,
        "uLightDir",
      );
      const atmosphereCameraPosLoc = gl.getUniformLocation(
        atmosphereProgram,
        "uCameraPos",
      );

      // --- Sky (Space Background) Program Setup ---
      const skyVS = createShader(skyVertexShaderSource, gl.VERTEX_SHADER);
      const skyFS = createShader(skyFragmentShaderSource, gl.FRAGMENT_SHADER);
      const skyProgram = gl.createProgram();
      gl.attachShader(skyProgram, skyVS);
      gl.attachShader(skyProgram, skyFS);
      gl.linkProgram(skyProgram);
skyProgram._name = 'sky';
window.skyProgram = skyProgram;

      const skyPosLoc = gl.getAttribLocation(skyProgram, "aPosition");
      const skyMVLoc = gl.getUniformLocation(skyProgram, "uModelViewMatrix");
      const skyProjLoc = gl.getUniformLocation(skyProgram, "uProjectionMatrix");
      const skyTimeLoc = gl.getUniformLocation(skyProgram, "uTime");
      const skyGasIntensityLoc = gl.getUniformLocation(
        skyProgram,
        "uGasIntensity",
      );
      const skyCameraPosLoc = gl.getUniformLocation(skyProgram, "uCameraPos");
      const skyWaterRadiusLoc = gl.getUniformLocation(skyProgram, "uWaterRadius");

      // --- Clouds 3D Program Setup ---
      const cloud3DVS = createShader(window.cloud3DVertexShaderSource || cloud3DVertexShaderSource, gl.VERTEX_SHADER);
      const cloud3DFS = createShader(window.cloud3DFragmentShaderSource || cloud3DFragmentShaderSource, gl.FRAGMENT_SHADER);
      const cloud3DProgram = gl.createProgram();
      gl.attachShader(cloud3DProgram, cloud3DVS);
      gl.attachShader(cloud3DProgram, cloud3DFS);
      gl.linkProgram(cloud3DProgram);
cloud3DProgram._name = 'cloud3D';
window.cloud3DProgram = cloud3DProgram;
      const cloud3DPosLoc = gl.getAttribLocation(cloud3DProgram, "aPosition");
      const cloud3DLocalPosLoc = gl.getAttribLocation(cloud3DProgram, "aLocalPos");
      const cloud3DMVLoc = gl.getUniformLocation(cloud3DProgram, "uModelViewMatrix");
      const cloud3DProjLoc = gl.getUniformLocation(cloud3DProgram, "uProjectionMatrix");
      const cloud3DColorLoc = gl.getUniformLocation(cloud3DProgram, "uColor");
      const cloud3DAlphaLoc = gl.getUniformLocation(cloud3DProgram, "uAlpha");
      const cloud3DTimeLoc = gl.getUniformLocation(cloud3DProgram, "uTime");
      const cloud3DAnimTimeLoc = gl.getUniformLocation(cloud3DProgram, "uAnimTime");
      const cloud3DOrbitMatrixLoc = gl.getUniformLocation(cloud3DProgram, "uCloudOrbitMatrix");
      const cloud3DLightDirLoc = gl.getUniformLocation(cloud3DProgram, "uLightDir");
      const cloud3DCameraPosLoc = gl.getUniformLocation(cloud3DProgram, "uCameraPos");
      const cloud3DWaterRadiusLoc = gl.getUniformLocation(cloud3DProgram, "uWaterRadius");

      // --- Sun & Celestial Program Setup ---
      let sunProgram = null;
      let sunPosLoc = -1, sunColorLoc = -1;
      let sunMVLoc = null, sunProjLoc = null, sunTimeLoc = null, sunTintLoc = null, sunIsSunLoc = null, sunLightDirLoc = null;
      try {
        const sunVS = createShader(window.sunVertexShaderSource || sunVertexShaderSource, gl.VERTEX_SHADER);
        const sunFS = createShader(window.sunFragmentShaderSource || sunFragmentShaderSource, gl.FRAGMENT_SHADER);
        if (sunVS && sunFS) {
          sunProgram = gl.createProgram();
          gl.attachShader(sunProgram, sunVS);
          gl.attachShader(sunProgram, sunFS);
          gl.linkProgram(sunProgram);
          if (gl.getProgramParameter(sunProgram, gl.LINK_STATUS)) {
            sunProgram._name = 'sun';
            window.sunProgram = sunProgram;
            sunPosLoc = gl.getAttribLocation(sunProgram, "aPosition");
            sunColorLoc = gl.getAttribLocation(sunProgram, "aColor");
            sunMVLoc = gl.getUniformLocation(sunProgram, "uModelViewMatrix");
            sunProjLoc = gl.getUniformLocation(sunProgram, "uProjectionMatrix");
            sunTimeLoc = gl.getUniformLocation(sunProgram, "uTime");
            sunTintLoc = gl.getUniformLocation(sunProgram, "uTint");
            sunIsSunLoc = gl.getUniformLocation(sunProgram, "uIsSun");
            sunLightDirLoc = gl.getUniformLocation(sunProgram, "uLightDir");
          } else {
            console.error("Sun program link error:", gl.getProgramInfoLog(sunProgram));
          }
        }
      } catch(e) {
        console.warn("Sun shader initialization error:", e);
      }

      // Global buffers
      let cloud3DVertexBuffer = null;
      let cloud3DLocalPosBuffer = null;
      let cloud3DIndexBuffer = null;

      window.resetCloud3DBuffers = function() {
        if (cloud3DVertexBuffer && typeof gl !== "undefined" && gl) {
          try {
            gl.deleteBuffer(cloud3DVertexBuffer);
            gl.deleteBuffer(cloud3DLocalPosBuffer);
            gl.deleteBuffer(cloud3DIndexBuffer);
          } catch(e) {}
        }
        cloud3DVertexBuffer = null;
        cloud3DLocalPosBuffer = null;
        cloud3DIndexBuffer = null;
      };

      window.rebuildClouds3D = function(newHeight) {
        if (typeof newHeight === "number") {
          if (typeof cloudsHeight !== "undefined") cloudsHeight = newHeight;
        }
        const h = typeof cloudsHeight !== "undefined" ? cloudsHeight : (typeof newHeight === "number" ? newHeight : 12.0);
        if (typeof window.generateClouds3D === "function") {
          const currentSeed = typeof seedVal !== "undefined" ? seedVal : (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 12345);
          const currentRadius = typeof RADIUS !== "undefined" ? RADIUS : 8.0;
          window.cloud3DData = window.generateClouds3D(currentSeed, currentRadius, h);
          if (typeof window.resetCloud3DBuffers === "function") {
            window.resetCloud3DBuffers();
          }
        }
      };

      // --- Depth Program Setup for Shadow Mapping ---
      const depthVS = createShader(depthVertexShaderSource, gl.VERTEX_SHADER);
      const depthFS = createShader(
        depthFragmentShaderSource,
        gl.FRAGMENT_SHADER,
      );
      const depthProgram = gl.createProgram();
      gl.attachShader(depthProgram, depthVS);
      gl.attachShader(depthProgram, depthFS);
      gl.linkProgram(depthProgram);

      const depthPosLoc = gl.getAttribLocation(depthProgram, "aPosition");
      const depthColorLoc = gl.getAttribLocation(depthProgram, "aColor");
      const depthModelLoc = gl.getUniformLocation(depthProgram, "uModelMatrix");
      const depthLightSpaceLoc = gl.getUniformLocation(
        depthProgram,
        "uLightSpaceMatrix",
      );
      const depthTimeLoc = gl.getUniformLocation(depthProgram, "uTime");
      const depthSwayFactorLoc = gl.getUniformLocation(
        depthProgram,
        "uSwayFactor",
      );
      const depthWaterSwayFactorLoc = gl.getUniformLocation(
        depthProgram,
        "uWaterSwayFactor",
      );
      const depthPlanetRadiusLoc = gl.getUniformLocation(
        depthProgram,
        "uPlanetRadius",
      );
      const depthWaterRadiusLoc = gl.getUniformLocation(
        depthProgram,
        "uWaterRadius",
      );

      // Shadow Map Framebuffer initialization
      let shadowFramebuffer;
      let shadowDepthTexture;
      let dummyColorTex = null;
      
      function computeShadowMapSize() {
        if (typeof shadowMapQuality === "number" && shadowMapQuality > 0) {
          if (shadowMapQuality === 1) return 1024; // Low: 1024x1024
          if (shadowMapQuality === 2) return 2048; // Medium: 2048x2048
          if (shadowMapQuality === 3) return 2048; // High: 2048x2048
          if (shadowMapQuality >= 4) return 4096; // Ultra: 4096x4096
        }
        return 1024;
      }
      let SHADOW_WIDTH = computeShadowMapSize();
      let SHADOW_HEIGHT = computeShadowMapSize();

      function initShadowMap() {
        if (!isWebGL2) {
          const ext = gl.getExtension("WEBGL_depth_texture");
          if (!ext) {
            console.error("WEBGL_depth_texture extension is not supported.");
          }
        }

        shadowFramebuffer = gl.createFramebuffer();
        shadowDepthTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture);

        if (isWebGL2) {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.DEPTH_COMPONENT24,
            SHADOW_WIDTH,
            SHADOW_HEIGHT,
            0,
            gl.DEPTH_COMPONENT,
            gl.UNSIGNED_INT,
            null,
          );
        } else {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.DEPTH_COMPONENT,
            SHADOW_WIDTH,
            SHADOW_HEIGHT,
            0,
            gl.DEPTH_COMPONENT,
            gl.UNSIGNED_INT,
            null,
          );
        }

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.DEPTH_ATTACHMENT,
          gl.TEXTURE_2D,
          shadowDepthTexture,
          0,
        );

        // Dummy color texture to ensure framebuffer completeness on all platforms
        dummyColorTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, dummyColorTex);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          SHADOW_WIDTH,
          SHADOW_HEIGHT,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          dummyColorTex,
          0,
        );

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
          console.error("Shadow Framebuffer incomplete: " + status);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      initShadowMap();
      window.resizeShadowMap = function() {
        if (typeof shadowMapQuality === "number" && shadowMapQuality > 0) {
          SHADOW_WIDTH = computeShadowMapSize();
          SHADOW_HEIGHT = SHADOW_WIDTH;
        }
        if (!shadowDepthTexture || !shadowFramebuffer) return;

        gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture);
        if (isWebGL2) {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.DEPTH_COMPONENT24,
            SHADOW_WIDTH,
            SHADOW_HEIGHT,
            0,
            gl.DEPTH_COMPONENT,
            gl.UNSIGNED_INT,
            null,
          );
        } else {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.DEPTH_COMPONENT,
            SHADOW_WIDTH,
            SHADOW_HEIGHT,
            0,
            gl.DEPTH_COMPONENT,
            gl.UNSIGNED_INT,
            null,
          );
        }

        if (dummyColorTex) {
          gl.bindTexture(gl.TEXTURE_2D, dummyColorTex);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            SHADOW_WIDTH,
            SHADOW_HEIGHT,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null,
          );
        }
      };


      // ============================================
      // Post-Processing Anti-Aliasing (FXAA / TAAU Edge Smoothing)
      // ============================================
      let fxaaProgram = null;
      let fxaaQuadBuffer = null;
      let fxaaPosLoc = -1;
      let fxaaTexLoc = null;
      let fxaaResolutionLoc = null;
      let fxaaCopyTex = null;
      let fxaaCopyWidth = 0;
      let fxaaCopyHeight = 0;

      const fxaaVS = `
        attribute vec2 aPosition;
        varying vec2 vUv;
        void main() {
          vUv = aPosition * 0.5 + 0.5;
          gl_Position = vec4(aPosition, 0.0, 1.0);
        }
      `;

      const fxaaFS = `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        uniform vec2 uResolution;

        #define FXAA_REDUCE_MIN   (1.0 / 128.0)
        #define FXAA_REDUCE_MUL   (1.0 / 8.0)
        #define FXAA_SPAN_MAX     8.0

        void main() {
          vec2 inverseVP = 1.0 / uResolution;
          vec3 rgbNW = texture2D(uTexture, vUv + vec2(-1.0, -1.0) * inverseVP).rgb;
          vec3 rgbNE = texture2D(uTexture, vUv + vec2( 1.0, -1.0) * inverseVP).rgb;
          vec3 rgbSW = texture2D(uTexture, vUv + vec2(-1.0,  1.0) * inverseVP).rgb;
          vec3 rgbSE = texture2D(uTexture, vUv + vec2( 1.0,  1.0) * inverseVP).rgb;
          vec3 rgbM  = texture2D(uTexture, vUv).rgb;

          vec3 luma = vec3(0.299, 0.587, 0.114);
          float lumaNW = dot(rgbNW, luma);
          float lumaNE = dot(rgbNE, luma);
          float lumaSW = dot(rgbSW, luma);
          float lumaSE = dot(rgbSE, luma);
          float lumaM  = dot(rgbM,  luma);

          float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
          float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

          vec2 dir;
          dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
          dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));

          float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);
          float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
          dir = min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX), max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX), dir * rcpDirMin)) * inverseVP;

          vec3 rgbA = 0.5 * (
            texture2D(uTexture, vUv + dir * (1.0 / 3.0 - 0.5)).rgb +
            texture2D(uTexture, vUv + dir * (2.0 / 3.0 - 0.5)).rgb
          );
          vec3 rgbB = rgbA * 0.5 + 0.25 * (
            texture2D(uTexture, vUv + dir * -0.5).rgb +
            texture2D(uTexture, vUv + dir *  0.5).rgb
          );

          float lumaB = dot(rgbB, luma);
          if ((lumaB < lumaMin) || (lumaB > lumaMax)) {
            gl_FragColor = vec4(rgbA, 1.0);
          } else {
            gl_FragColor = vec4(rgbB, 1.0);
          }
        }
      `;

      function initFXAASystem() {
        if (fxaaProgram) return;
        const vs = createShader(fxaaVS, gl.VERTEX_SHADER);
        const fs = createShader(fxaaFS, gl.FRAGMENT_SHADER);
        if (!vs || !fs) return;
        fxaaProgram = gl.createProgram();
        gl.attachShader(fxaaProgram, vs);
        gl.attachShader(fxaaProgram, fs);
        gl.linkProgram(fxaaProgram);

        fxaaPosLoc = gl.getAttribLocation(fxaaProgram, "aPosition");
        fxaaTexLoc = gl.getUniformLocation(fxaaProgram, "uTexture");
        fxaaResolutionLoc = gl.getUniformLocation(fxaaProgram, "uResolution");

        fxaaQuadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, fxaaQuadBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
            -1.0,  1.0,
             1.0, -1.0,
             1.0,  1.0
          ]),
          gl.STATIC_DRAW
        );

        fxaaCopyTex = gl.createTexture();
      }

      // ============================================
      // Wireframe
      // ============================================
      function buildWireframe(gridSize) {
        const maxSegments = 24;
        const segments = Math.min(Math.floor(gridSize / 2), maxSegments);

        const points = [];
        for (let lat = 0; lat <= segments; lat++) {
          const theta = (lat / segments) * Math.PI;
          const sinTheta = Math.sin(theta);
          const cosTheta = Math.cos(theta);
          for (let long = 0; long <= segments * 2; long++) {
            const phi = (long / (segments * 2)) * Math.PI * 2;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);
            const r = RADIUS * 1.002;
            points.push(
              r * sinTheta * cosPhi,
              r * cosTheta,
              r * sinTheta * sinPhi,
            );
          }
        }
        for (let long = 0; long <= segments * 2; long++) {
          const phi = (long / (segments * 2)) * Math.PI * 2;
          const sinPhi = Math.sin(phi);
          const cosPhi = Math.cos(phi);
          for (let lat = 0; lat <= segments; lat++) {
            const theta = (lat / segments) * Math.PI;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);
            const r = RADIUS * 1.002;
            points.push(
              r * sinTheta * cosPhi,
              r * cosTheta,
              r * sinTheta * sinPhi,
            );
          }
        }

        wireframePointCount = points.length / 3;

        if (wireframeBuffer) gl.deleteBuffer(wireframeBuffer);
        wireframeBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, wireframeBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(points),
          gl.STATIC_DRAW,
        );

        const wireColors = new Float32Array(points.length);
        for (let i = 0; i < points.length / 3; i++) {
          wireColors[i * 3] = 0.15 + (i % 3) * 0.05;
          wireColors[i * 3 + 1] = 0.35 + (i % 2) * 0.05;
          wireColors[i * 3 + 2] = 0.25 + (i % 4) * 0.03;
        }
        if (wireColorBuffer) gl.deleteBuffer(wireColorBuffer);
        wireColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, wireColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, wireColors, gl.STATIC_DRAW);
      }

      // ============================================
      // Dots
      // ============================================
      function createDots(radius, count) {
        const positions = [];
        for (let i = 0; i < count; i++) {
          const theta = Math.random() * Math.PI;
          const phi = Math.random() * Math.PI * 2;
          const r = radius * 1.003;
          positions.push(
            r * Math.sin(theta) * Math.cos(phi),
            r * Math.cos(theta),
            r * Math.sin(theta) * Math.sin(phi),
          );
        }
        return positions;
      }

      const dotPositions = createDots(RADIUS, 400);
      dotBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, dotBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(dotPositions),
        gl.STATIC_DRAW,
      );

      const dotColors = new Float32Array(dotPositions.length);
      for (let i = 0; i < dotPositions.length / 3; i++) {
        dotColors[i * 3] = 0.3 + Math.random() * 0.4;
        dotColors[i * 3 + 1] = 0.6 + Math.random() * 0.3;
        dotColors[i * 3 + 2] = 0.4 + Math.random() * 0.4;
      }
      dotColorBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, dotColorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, dotColors, gl.STATIC_DRAW);


      function closestPointOnTriangle(p, a, b, c) {
        const ab = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
        const ac = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
        const ap = [p[0]-a[0], p[1]-a[1], p[2]-a[2]];

        const d1 = ab[0]*ap[0] + ab[1]*ap[1] + ab[2]*ap[2];
        const d2 = ac[0]*ap[0] + ac[1]*ap[1] + ac[2]*ap[2];
        if (d1 <= 0.0 && d2 <= 0.0) return a;

        const bp = [p[0]-b[0], p[1]-b[1], p[2]-b[2]];
        const d3 = ab[0]*bp[0] + ab[1]*bp[1] + ab[2]*bp[2];
        const d4 = ac[0]*bp[0] + ac[1]*bp[1] + ac[2]*bp[2];
        if (d3 >= 0.0 && d4 <= d3) return b;

        const vc = d1*d4 - d3*d2;
        if (vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0) {
            const v = d1 / (d1 - d3);
            return [a[0] + v*ab[0], a[1] + v*ab[1], a[2] + v*ab[2]];
        }

        const cp = [p[0]-c[0], p[1]-c[1], p[2]-c[2]];
        const d5 = ab[0]*cp[0] + ab[1]*cp[1] + ab[2]*cp[2];
        const d6 = ac[0]*cp[0] + ac[1]*cp[1] + ac[2]*cp[2];
        if (d6 >= 0.0 && d5 <= d6) return c;

        const vb = d5*d2 - d1*d6;
        if (vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0) {
            const w = d2 / (d2 - d6);
            return [a[0] + w*ac[0], a[1] + w*ac[1], a[2] + w*ac[2]];
        }

        const va = d3*d6 - d5*d4;
        if (va <= 0.0 && (d4 - d3) >= 0.0 && (d5 - d6) >= 0.0) {
            const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
            return [b[0] + w*(c[0]-b[0]), b[1] + w*(c[1]-b[1]), b[2] + w*(c[2]-b[2])];
        }

        const denom = 1.0 / (va + vb + vc);
        const v = vb * denom;
        const w = vc * denom;
        return [
            a[0] + ab[0]*v + ac[0]*w,
            a[1] + ab[1]*v + ac[1]*w,
            a[2] + ab[2]*v + ac[2]*w
        ];
      }

      function projectWorldToScreen(worldPos, viewMat, projMat, width, height) {
        if (!viewMat || !projMat) return null;
        const vx =
          worldPos[0] * viewMat[0] +
          worldPos[1] * viewMat[4] +
          worldPos[2] * viewMat[8] +
          viewMat[12];
        const vy =
          worldPos[0] * viewMat[1] +
          worldPos[1] * viewMat[5] +
          worldPos[2] * viewMat[9] +
          viewMat[13];
        const vz =
          worldPos[0] * viewMat[2] +
          worldPos[1] * viewMat[6] +
          worldPos[2] * viewMat[10] +
          viewMat[14];
        const vw =
          worldPos[0] * viewMat[3] +
          worldPos[1] * viewMat[7] +
          worldPos[2] * viewMat[11] +
          viewMat[15];

        const cx =
          vx * projMat[0] +
          vy * projMat[4] +
          vz * projMat[8] +
          vw * projMat[12];
        const cy =
          vx * projMat[1] +
          vy * projMat[5] +
          vz * projMat[9] +
          vw * projMat[13];
        const cz =
          vx * projMat[2] +
          vy * projMat[6] +
          vz * projMat[10] +
          vw * projMat[14];
        const cw =
          vx * projMat[3] +
          vy * projMat[7] +
          vz * projMat[11] +
          vw * projMat[15];

        if (cw <= 0) return null;

        const ndcX = cx / cw;
        const ndcY = cy / cw;
        const ndcZ = cz / cw;

        if (ndcZ < -1.0 || ndcZ > 1.0) return null;

        const screenX = (ndcX * 0.5 + 0.5) * width;
        const screenY = (1.0 - (ndcY * 0.5 + 0.5)) * height;

        return { x: screenX, y: screenY, w: cw };
      }

      function checkPlanetOcclusion(camPos, targetPos, r) {
        if (!camPos || !targetPos) return false;
        const dx = targetPos[0] - camPos[0];
        const dy = targetPos[1] - camPos[1];
        const dz = targetPos[2] - camPos[2];
        const dLenSq = dx*dx + dy*dy + dz*dz;
        if (dLenSq < 1e-6) return false;
        
        // Parameter t of projection of sphere center (origin [0,0,0]) onto the line segment camPos -> targetPos
        const dotCD = camPos[0]*dx + camPos[1]*dy + camPos[2]*dz;
        const t = -dotCD / dLenSq;
        
        if (t > 0.0 && t < 1.0) {
          const closestX = camPos[0] + t * dx;
          const closestY = camPos[1] + t * dy;
          const closestZ = camPos[2] + t * dz;
          const distSq = closestX*closestX + closestY*closestY + closestZ*closestZ;
          
          // Use a threshold safely below the minimum terrain height to account for surface elevations and valleys
          const baseR = r || (typeof RADIUS !== "undefined" ? RADIUS : 8.0);
          const threshold = baseR * 0.88;
          if (distSq < threshold * threshold) {
            return true;
          }
        }
        return false;
      }


      // ============================================
      // Frustum Culling Functions (Separated to /public/js/frustumCulling.js)
      // ============================================

      // ============================================
      // Render - พร้อม FPS Counter และ Lock
      // ============================================
      let _cachedBowCrosshair = null;
      let _cachedDistanceInfo = null;
      let _cachedInvOverlay = null;
      let _cachedChestOverlay = null;
      let _cachedInteractPrompt = null;
      let _cachedNpcPrompt = null;
      let _cachedTargetCircle = null;

      function render(timestamp, forceDraw = false) {
        if (lastFrameTime === 0) {
          lastFrameTime = timestamp;
          lastWaterAnimTime = timestamp;
          lastLeafAnimTime = timestamp;
          lastCloudAnimTime = timestamp;
          lastCharAnimTime = timestamp;
          lastFpsUpdate = timestamp;
        }

        const delta = timestamp - lastFrameTime;
        // Apply a 1.5ms tolerance to prevent minor browser rAF scheduling fluctuations from skipping frames,
        // which would drop the FPS on 120Hz or 60Hz displays.
        const tolerance = 1.5;
        // Bypassing the limiter for 120+ FPS settings allows the game to utilize the monitor's max refresh rate uncapped
        if (targetFps < 120 && delta < frameTime - tolerance && !forceDraw) {
  
        if (Graphics.mode === 'hybrid' && Graphics.webgpu.currentPassEncoder) {
            Graphics.webgpu.currentPassEncoder.end();
            Graphics.webgpu.device.queue.submit([Graphics.webgpu.currentCommandEncoder.finish()]);
            Graphics.webgpu.currentPassEncoder = null;
            Graphics.webgpu.currentCommandEncoder = null;
        }
        requestAnimationFrame(render);

          return;
        }

        const frameDelta = delta;
        const dt = Math.max(0.001, Math.min(0.1, frameDelta / 1000.0));
        const timeScale = dt / 0.016666;

        // FPS Counter
        if (!forceDraw) {
          frameCount++;
          if (timestamp - lastFpsUpdate >= 1000) {
            currentFps = frameCount;
            frameCount = 0;
            lastFpsUpdate = timestamp;
            if (fpsDisplay) {
              fpsDisplay.textContent = currentFps;
            }
          }
        }

        if (!forceDraw) {
          if (targetFps >= 120) {
             // For uncapped / max-hz displays, we just step exactly with timestamp
             lastFrameTime = timestamp;
          } else {
             let remainder = 0;
             if (delta >= frameTime) {
               remainder = delta % frameTime;
             } else if (delta >= frameTime - tolerance) {
               remainder = delta - frameTime;
             }
             lastFrameTime = timestamp - remainder;
          }
        }
        // Throttled Auto-Save (Every 20 seconds, if game started)
        if (gameStarted && !forceDraw) {
          if (timestamp - lastAutoSaveTime >= 20000) {
            lastAutoSaveTime = timestamp;
            saveSettingsToLocalStorage();
          }
        }

        // --- Throttled Animation Updates ---
        const now = timestamp;

        if (!_cachedBowCrosshair) _cachedBowCrosshair = document.getElementById("bowCrosshair");
        if (_cachedBowCrosshair && _cachedBowCrosshair.style.display !== "none") {
          _cachedBowCrosshair.style.display = "none";
        }

        // Synchronize active action slot with floor placement mode
        const selectedItem = (selectedActionSlotIndex !== -1) ? actionSlotsItems[selectedActionSlotIndex] : null;
        
        const isPlacementItem = selectedItem && (selectedItem.name === "STONE_FLOOR" || selectedItem.name === "WOOD_FLOOR" || selectedItem.name === "THIN_WOOD_FLOOR" || selectedItem.name === "WOOD_ROOF" || selectedItem.name === "WOOD_STAIRS" || selectedItem.name === "CAMPFIRE" || selectedItem.name === "WOOD_BOAT" || selectedItem.name === "WOOD_WHEEL" || selectedItem.name === "ELECTRIC_ENGINE" || selectedItem.name === "WOOD_WALL" || selectedItem.name === "WOOD_WINDOW" || selectedItem.name === "WOOD_DOOR" || selectedItem.name === "WOOD_CHEST" || selectedItem.name === "MEGANEURA" || selectedItem.name === "ISOPOD" || selectedItem.name.startsWith("ROBOT_"));

        if (isPlacementItem) {
          if (!isPlacingFloor || floorPlacementInfo?.index !== selectedActionSlotIndex) {
            isPlacingFloor = true;
            placementRotationAngle = 0.0;
            floorPlacementInfo = { item: selectedItem, index: selectedActionSlotIndex, source: "action" };
            }
          } else {
          if (isPlacingFloor && floorPlacementInfo && floorPlacementInfo.source === "action") {
            cancelFloorPlacement();
          }
        }

        // Cancel BOW if the selected item is NOT a bow, or if the slot is empty / selection is toggled off
        if (!selectedItem || selectedItem.name !== "BOW") {
          if (activeItem && activeItem.name === "BOW") {
            useAnimTimer = 0;
            isUsingItem = false;
            activeItem = null;
          }
        }
        
        if (useAnimTimer > 0) {
            if (activeItem && activeItem.name === "BOW" && !arrowShotInCurrentAnim) {
                let drawPower = Math.min(1.0, Math.max(0.0, (1.4 - useAnimTimer) / 1.1));
                if (bowComboActive) {
                    drawPower = Math.min(1.0, Math.max(0.0, (1.2 - useAnimTimer) / 0.9));
                }
                const isClicking = isActionDown && (document.pointerLockElement === canvas || window.simulatedPointerLock);
                if (isClicking || drawPower < 0.15) {
                    useAnimTimer = Math.max(0.3, useAnimTimer - delta / 1000);
                } else {
                    const arrRef = findArrowInInventory();
                    if (arrRef) {
                        consumeArrow(arrRef);
                        shootArrowProjectile(drawPower);
                        if (typeof playBowShootSound === "function") {
                            playBowShootSound();
                        }
                    }
                    arrowShotInCurrentAnim = true;
                    lastBowShootTime = Date.now();
                    lastBowDrawPower = drawPower;
                    bowComboActive = false;
                    useAnimTimer = bowHoldArmTimer;
            }
          } else {
                useAnimTimer -= delta / 1000;
            }

            if (useAnimTimer <= 0) {
                useAnimTimer = 0;
                isUsingItem = false;
                activeItem = null;
                
                // If action button is still held down, trigger again (but not for BOW to prevent auto-fire)
                if (isActionDown && (document.pointerLockElement === canvas || window.simulatedPointerLock)) {
                    if (selectedActionSlotIndex !== -1 && actionSlotsItems[selectedActionSlotIndex]) {
                        const slotItem = actionSlotsItems[selectedActionSlotIndex];
                        if (slotItem && slotItem.name !== "BOW") {
                            useItem(slotItem, selectedActionSlotIndex, "action");
                        }
                    }
                }
            }
        }

        // Update Distance Display
        if (distanceDisplayEnabled) {
            if (!_cachedDistanceInfo) _cachedDistanceInfo = document.getElementById("distanceInfo");
            const distanceInfo = _cachedDistanceInfo;
            if (distanceInfo) {
                const sinTheta = Math.sin(charTheta);
                const cosTheta = Math.cos(charTheta);
                const sinPhi = Math.sin(charPhi);
                const cosPhi = Math.cos(charPhi);
                const nx = sinTheta * cosPhi;
                const ny = cosTheta;
                const nz = sinTheta * sinPhi;
                const height = getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
                const terrainRadius = RADIUS + height * HEIGHT_SCALE;
                const charPos = [terrainRadius * nx, terrainRadius * ny, terrainRadius * nz];

                let minDistance = Infinity;
                for (const obs of natureObstacles) {
                    if (obs.type === "tree" || obs.type === "rock") {
                        const dx = charPos[0] - obs.position[0];
                        const dy = charPos[1] - obs.position[1];
                        const dz = charPos[2] - obs.position[2];
                        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                        if (dist < minDistance) minDistance = dist;
                    }
                }
                distanceInfo.textContent = `ระยะห่าง: ${minDistance === Infinity ? "ไม่มีใกล้เคียง" : minDistance.toFixed(2)}`;
            }
        }

        // 1. Water Update Check
        const waterInterval = 1000 / waterAnimFps;
        if (now - lastWaterAnimTime >= waterInterval) {
          const elapsed = (now - lastWaterAnimTime) / 1000;
          waterAnimTime += elapsed;
          lastWaterAnimTime = now - ((now - lastWaterAnimTime) % waterInterval);
          if (waterEnabled) {
            updateWaterVertices(waterAnimTime);
          }
        }

        // 2. Leaf Update Check
        const leafInterval = 1000 / leafAnimFps;
        if (now - lastLeafAnimTime >= leafInterval) {
          const elapsed = (now - lastLeafAnimTime) / 1000;
          leafAnimTime += elapsed;
          lastLeafAnimTime = now - ((now - lastLeafAnimTime) % leafInterval);
        }

        // 3. Cloud Update Check
        const cloudInterval = 1000 / cloudAnimFps;
        if (now - lastCloudAnimTime >= cloudInterval) {
          const elapsed = (now - lastCloudAnimTime) / 1000;
          cloudAnimTime += elapsed * cloudsSpeed;
          cloudShapeAnimTime += elapsed * 0.06;

          // Clouds3D animation & orbital rotation update
          const animSpd = typeof window.cloud3DAnimSpeed === "number" ? window.cloud3DAnimSpeed : 0.1;
          const orbSpd = typeof window.cloud3DOrbitSpeed === "number" ? window.cloud3DOrbitSpeed : 0.1;
          if (typeof window.cloud3DAnimTime !== "number") window.cloud3DAnimTime = 0.0;
          if (typeof window.cloud3DOrbitAngle !== "number") window.cloud3DOrbitAngle = 0.0;
          
          window.cloud3DAnimTime += elapsed * animSpd * 1.5;
          window.cloud3DOrbitAngle += elapsed * orbSpd * 0.04; // base ~0.04 rad/s orbital motion

          lastCloudAnimTime = now - ((now - lastCloudAnimTime) % cloudInterval);
        }

        // Door swinging physics simulation (Accelerated with SpatialGrid)
        let doorActiveSwinging = false;
        const pRadius = playerCenterRadius || RADIUS;
        const pX = Math.sin(charTheta) * Math.cos(charPhi) * pRadius;
        const pY = Math.cos(charTheta) * pRadius;
        const pZ = Math.sin(charTheta) * Math.sin(charPhi) * pRadius;

        let doorsToCheck = [];
        if (typeof SpatialGrid !== "undefined") {
          doorsToCheck = SpatialGrid.queryRadius(pX, pY, pZ, 2.5, item => item.type === "wood_door" && !item.isPreview);
          if (!window._activeSwingingDoors) window._activeSwingingDoors = new Set();
          for (const d of window._activeSwingingDoors) {
            if (!doorsToCheck.includes(d)) doorsToCheck.push(d);
          }
        } else {
          doorsToCheck = collectibles;
        }

        for (let other of doorsToCheck) {
          if (other.active && other.type === "wood_door" && !other.isPreview) {
            if (other.doorAngle === undefined) other.doorAngle = 0.0;
            if (other.doorVel === undefined) other.doorVel = 0.0;

            const isSwinging = (Math.abs(other.doorVel) > 0.005 || Math.abs(other.doorAngle) > 0.005);
            
            // Fast distance check to see if player is near
            const dx = pX - other.position[0];
            const dy = pY - other.position[1];
            const dz = pZ - other.position[2];
            const distSq = dx*dx + dy*dy + dz*dz;
            const playerIsNear = (distSq <= 0.16); // 0.4 * 0.4 = 0.16

            if (!isSwinging && !playerIsNear) {
              other.doorAngle = 0.0;
              other.doorVel = 0.0;
              if (window._activeSwingingDoors) window._activeSwingingDoors.delete(other);
              continue;
            }

            // Restoring spring force towards 0 (closed)
            const springK = 7.0; // Spring constant
            const damping = 0.94; // Friction damping
            other.doorVel += -springK * other.doorAngle * dt;
            other.doorVel *= damping;

            if (Math.abs(other.doorVel) > 0.005 || Math.abs(other.doorAngle) > 0.005) {
              if (window._activeSwingingDoors) window._activeSwingingDoors.add(other);
              other.doorAngle += other.doorVel * dt;

              // Only constrain door swing angle by player position if player is near
              if (playerIsNear) {
                if (other._wallR === undefined) {
                  const angle = other.angle || 0.0;
                  const cosA = Math.cos(angle);
                  const sinA = Math.sin(angle);
                  other._wallR = [
                    other.R[0] * cosA + other.F[0] * sinA,
                    other.R[1] * cosA + other.F[1] * sinA,
                    other.R[2] * cosA + other.F[2] * sinA
                  ];
                  other._wallF = [
                    other.F[0] * cosA - other.R[0] * sinA,
                    other.F[1] * cosA - other.R[1] * sinA,
                    other.F[2] * cosA - other.R[2] * sinA
                  ];
                  other._centerRadius = Math.sqrt(
                    other.position[0] * other.position[0] +
                    other.position[1] * other.position[1] +
                    other.position[2] * other.position[2]
                  );
                }
                const wallCenterRadius = other._centerRadius;
                const wallHeight = 0.25;
                const feetRadius = pRadius - 0.46 * playerScale;
                const headRadius = pRadius + 0.46 * playerScale;
                const overlapsVertically = (headRadius > wallCenterRadius && feetRadius < wallCenterRadius + wallHeight);

                if (overlapsVertically) {
                  const wallR = other._wallR;
                  const wallF = other._wallF;

                  const local_dx = dx * wallR[0] + dy * wallR[1] + dz * wallR[2];
                  const local_dz = dx * wallF[0] + dy * wallF[1] + dz * wallF[2];

                  const px = local_dx + 0.063;
                  const pz = local_dz;
                  const d = Math.sqrt(px*px + pz*pz);

                  const charRadius = playerScale * 0.38;
                  const leafLength = 0.125;
                  const leafThickness = 0.015;
                  const colZ = leafThickness / 2 + charRadius;

                  if (d <= leafLength + charRadius && d > colZ) {
                    const playerAngle = Math.atan2(pz, px);
                    const limitAngle = Math.asin(colZ / d);

                    const angleDiff = other.doorAngle - playerAngle;
                    if (Math.abs(angleDiff) < limitAngle) {
                      if (angleDiff >= 0) {
                        other.doorAngle = playerAngle + limitAngle;
                      } else {
                        other.doorAngle = playerAngle - limitAngle;
                      }
                      other.doorVel = 0.0;
                    }
                  }
                }
              }

              // Clamp door swing angle and bounce back slightly
              const limit = 1.6; // ~92 degrees
              if (other.doorAngle > limit) {
                other.doorAngle = limit;
                other.doorVel = -other.doorVel * 0.3;
              } else if (other.doorAngle < -limit) {
                other.doorAngle = -limit;
                other.doorVel = -other.doorVel * 0.3;
              }
              doorActiveSwinging = true;
            } else {
              other.doorAngle = 0.0;
              other.doorVel = 0.0;
              if (window._activeSwingingDoors) window._activeSwingingDoors.delete(other);
            }
          }
        }

        // Window swinging physics and "E" holding interaction (Accelerated with SpatialGrid)
        let windowActiveSwinging = false;
        let activeInteractWindow = null;
        let bestT_window = Infinity;

        const isInteractHeld = keysPressed[currentKeyBindings.interact] || keysPressed["KeyE"];

        let windowsToCheck = [];
        if (typeof SpatialGrid !== "undefined") {
          const maxWinReach = Math.max(actionReachDistance, 0.15 * (playerScale / 0.1)) + 1.5;
          windowsToCheck = SpatialGrid.queryRadius(pX, pY, pZ, maxWinReach, item => item.type === "wood_window" && !item.isPreview);
          if (!window._activeSwingingWindows) window._activeSwingingWindows = new Set();
          for (const w of window._activeSwingingWindows) {
            if (!windowsToCheck.includes(w)) windowsToCheck.push(w);
          }
        } else {
          windowsToCheck = collectibles;
        }

        for (let other of windowsToCheck) {
          if (other.active && other.type === "wood_window" && !other.isPreview) {
            const reachInfo = isTargetWithinReach(other.position, Math.max(actionReachDistance, 0.15 * (playerScale / 0.1)));
            if (reachInfo.valid) {
              if (reachInfo.t < bestT_window) {
                bestT_window = reachInfo.t;
                activeInteractWindow = other;
              }
            }
          }
        }

        for (let other of windowsToCheck) {
          if (other.active && other.type === "wood_window" && !other.isPreview) {
            if (other.windowAngle === undefined) other.windowAngle = 0.0;
            if (other.windowTargetAngle === undefined) other.windowTargetAngle = 0.0;

            if (other === activeInteractWindow && isInteractHeld) {
              if (other.isBeingHeld === undefined || other.isBeingHeld === false) {
                other.isBeingHeld = true;
                other.windowTargetAngle = (other.windowAngle < 0.78) ? 1.57 : 0.0;
              }

              const speed = 2.0; // swing speed in rads/sec
              if (other.windowAngle < other.windowTargetAngle) {
                other.windowAngle = Math.min(other.windowTargetAngle, other.windowAngle + speed * dt);
                windowActiveSwinging = true;
                if (window._activeSwingingWindows) window._activeSwingingWindows.add(other);
              } else if (other.windowAngle > other.windowTargetAngle) {
                other.windowAngle = Math.max(other.windowTargetAngle, other.windowAngle - speed * dt);
                windowActiveSwinging = true;
                if (window._activeSwingingWindows) window._activeSwingingWindows.add(other);
              } else {
                if (window._activeSwingingWindows) window._activeSwingingWindows.delete(other);
              }
            } else {
              if (other === activeInteractWindow) {
                other.isBeingHeld = false;
              }
              // If still animating to target angle
              if (Math.abs(other.windowAngle - other.windowTargetAngle) > 0.005) {
                const speed = 2.0;
                if (other.windowAngle < other.windowTargetAngle) {
                  other.windowAngle = Math.min(other.windowTargetAngle, other.windowAngle + speed * dt);
                  windowActiveSwinging = true;
                  if (window._activeSwingingWindows) window._activeSwingingWindows.add(other);
                } else {
                  other.windowAngle = Math.max(other.windowTargetAngle, other.windowAngle - speed * dt);
                  windowActiveSwinging = true;
                  if (window._activeSwingingWindows) window._activeSwingingWindows.add(other);
                }
              } else {
                if (window._activeSwingingWindows) window._activeSwingingWindows.delete(other);
              }
            }
          }
        }

        let pendingDynamicRefresh = false;
        if (doorActiveSwinging || windowActiveSwinging || (typeof pendingDynamicCollectibleRefresh !== 'undefined' && pendingDynamicCollectibleRefresh)) {
          let shouldRefresh = true;
          const isRenderDistOn = (typeof renderDistEnabled !== "undefined"
            ? renderDistEnabled
            : (typeof window !== "undefined" && typeof window.renderDistEnabled !== "undefined" ? window.renderDistEnabled : true));

          if (isRenderDistOn && !doorActiveSwinging && !windowActiveSwinging && (typeof activeRidingBoat === "undefined" || !activeRidingBoat)) {
            const curObjectDist = typeof objectRenderDistValue !== "undefined"
              ? objectRenderDistValue
              : (typeof window !== "undefined" && typeof window.objectRenderDistValue !== "undefined"
                ? window.objectRenderDistValue
                : 5.0);
            const maxDistSq = (curObjectDist + 1.0) * (curObjectDist + 1.0);
            const pX = Math.sin(charTheta) * Math.cos(charPhi) * (playerCenterRadius || RADIUS);
            const pY = Math.cos(charTheta) * (playerCenterRadius || RADIUS);
            const pZ = Math.sin(charTheta) * Math.sin(charPhi) * (playerCenterRadius || RADIUS);

            let hasNearDynamicItem = false;
            if (typeof SpatialGrid !== "undefined") {
              const nearDyn = SpatialGrid.queryRadius(pX, pY, pZ, curObjectDist + 1.0, c => (c.isDynamic || c.type === "wood_door" || c.type === "wood_window"));
              hasNearDynamicItem = nearDyn.length > 0;
            } else if (typeof collectibles !== "undefined" && collectibles) {
              for (let i = 0; i < collectibles.length; i++) {
                const c = collectibles[i];
                if (c.active && (c.isDynamic || c.type === "wood_door" || c.type === "wood_window") && c.position) {
                  const dx = c.position[0] - pX;
                  const dy = c.position[1] - pY;
                  const dz = c.position[2] - pZ;
                  if (dx * dx + dy * dy + dz * dz <= maxDistSq) {
                    hasNearDynamicItem = true;
                    break;
                  }
                }
              }
            }
            if (!hasNearDynamicItem) {
              shouldRefresh = false;
            }
          }

          if (shouldRefresh) {
            pendingDynamicRefresh = true;
          }
          if (typeof pendingDynamicCollectibleRefresh !== 'undefined') window.pendingDynamicCollectibleRefresh = false;
        }

        if (pendingCollectibleRefresh) {
          pendingCollectibleRefresh = false;
          refreshCollectiblesVBO(); // Rebuild both main and dynamic
        } else if (pendingDynamicRefresh) {
          refreshCollectiblesVBO('dynamic'); // Only rebuild dynamic
        }

        // --- Render Loop ---
        if (Graphics.mode === 'hybrid') {
          // Clear WebGL with transparent color so WebGPU is visible
          gl.clearColor(0.0, 0.0, 0.0, 0.0);
        } else {
          if (lastIsCameraUnderwater) {
            gl.clearColor(0.01, 0.08, 0.16, 1.0);
          } else {
            gl.clearColor(0, 0, 0, 1);
          }
        }
        
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // 1. Get movement inputs first
        let moveForwardInput = 0;
        let moveSidewaysInput = 0;

        if (!_cachedInvOverlay) _cachedInvOverlay = document.getElementById("inventoryOverlay");
        if (!_cachedChestOverlay) _cachedChestOverlay = document.getElementById("chestOverlay");
        const isInvOpen = _cachedInvOverlay?.classList.contains("open");
        const isCstOpen = _cachedChestOverlay?.classList.contains("open");
        const isFreeCamActive = (cameraMode === "freecam" || (typeof window.cameraMode !== "undefined" && window.cameraMode === "freecam"));
        const isUIOpen = isInvOpen || isCstOpen || isFreeCamActive;

        // Keyboard input
        if (!isUIOpen && (keysPressed[currentKeyBindings.forward] || keysPressed["ArrowUp"]))
          moveForwardInput = 1;
        if (
          !isUIOpen && (keysPressed[currentKeyBindings.backward] ||
          keysPressed["ArrowDown"])
        )
          moveForwardInput = -1;
        if (!isUIOpen && (keysPressed[currentKeyBindings.right] || keysPressed["ArrowRight"]))
          moveSidewaysInput = 1;
        if (!isUIOpen && (keysPressed[currentKeyBindings.left] || keysPressed["ArrowLeft"]))
          moveSidewaysInput = -1;

        // Joystick input
        const joyLen = Math.sqrt(joystickX * joystickX + joystickY * joystickY);
        if (!isUIOpen && joyLen > 0.05) {
          moveForwardInput = joystickY;
          moveSidewaysInput = joystickX;

          const speedFactor = Math.min(1.0, joyLen * 1.2);
          moveForwardInput *= speedFactor;
          moveSidewaysInput *= speedFactor;
        }

        moveForwardInput = Math.max(-1, Math.min(1, moveForwardInput));
        moveSidewaysInput = Math.max(-1, Math.min(1, moveSidewaysInput));
        
        // Jump input handling
        if (!isUIOpen && keysPressed["Space"]) {
          if (isPlayerGrounded && !ragdollEnabled && !activeRidingBoat && currentSwimFactor === 0.0) {
            playerVerticalVel = 0.008; // Initial jump velocity
            isPlayerGrounded = false;
            isJumping = true;
          }
        }
        
        lastMoveForwardInput = moveForwardInput;

        if (typeof updateAmphibians === "function") {
          updateAmphibians(dt, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
        }
        if (typeof updateFireParticles === "function") {
          updateFireParticles(timestamp / 1000);
        }

        if (ragdollEnabled) {
          if (!ragdollInitialized) {
            const sinTheta_init = Math.sin(charTheta);
            const cosTheta_init = Math.cos(charTheta);
            const sinPhi_init = Math.sin(charPhi);
            const cosPhi_init = Math.cos(charPhi);

            const nx_init = sinTheta_init * cosPhi_init;
            const ny_init = cosTheta_init;
            const nz_init = sinTheta_init * sinPhi_init;

            let groundRadius_init = playerCenterRadius;
            if (groundRadius_init === null) {
              const charHeight_init = getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
              groundRadius_init = RADIUS + charHeight_init * HEIGHT_SCALE + 0.46 * playerScale;
            }

            const px_init = groundRadius_init * nx_init;
            const py_init = groundRadius_init * ny_init;
            const pz_init = groundRadius_init * nz_init;

            let N_init = [nx_init, ny_init, nz_init];
            const East_init = [-sinPhi_init, 0, cosPhi_init];
            const North_init = [
              -cosTheta_init * cosPhi_init,
              sinTheta_init,
              -cosTheta_init * sinPhi_init,
            ];

            const cosH_init = Math.cos(charHeading);
            const sinH_init = Math.sin(charHeading);

            const R_init = [
              East_init[0] * cosH_init - North_init[0] * sinH_init,
              East_init[1] * cosH_init - North_init[1] * sinH_init,
              East_init[2] * cosH_init - North_init[2] * sinH_init,
            ];
            let F_init = [
              North_init[0] * cosH_init + East_init[0] * sinH_init,
              North_init[1] * cosH_init + East_init[1] * sinH_init,
              North_init[2] * cosH_init + East_init[2] * sinH_init,
            ];

            let swimFactor_init = currentSwimFactor || 0.0;
            if (swimFactor_init > 0.0) {
              const swimPitch =
                Math.PI / 2 - swimMovementFactor * 0.3 - playerDiveDepth * 3.0;
              const cosPitch = Math.cos(swimPitch);
              const sinPitch = Math.sin(swimPitch);

              const tempN = [
                N_init[0] * cosPitch + F_init[0] * sinPitch,
                N_init[1] * cosPitch + F_init[1] * sinPitch,
                N_init[2] * cosPitch + F_init[2] * sinPitch,
              ];

              const tempF = [
                F_init[0] * cosPitch - N_init[0] * sinPitch,
                F_init[1] * cosPitch - N_init[1] * sinPitch,
                F_init[2] * cosPitch - N_init[2] * sinPitch,
              ];

              N_init = tempN;
              F_init = tempF;
            }

            initRagdoll(
              px_init,
              py_init,
              pz_init,
              R_init,
              N_init,
              F_init,
              walkPhase,
            );
          }

          // Update physical simulation
          updateRagdoll(dt);

          const pelvisPos = ragdollPos;
          const dLen = Math.sqrt(
            pelvisPos[0] * pelvisPos[0] +
              pelvisPos[1] * pelvisPos[1] +
              pelvisPos[2] * pelvisPos[2],
          );
          if (dLen > 0.001) {
            const ux = pelvisPos[0] / dLen;
            const uy = pelvisPos[1] / dLen;
            const uz = pelvisPos[2] / dLen;
            charTheta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
            charPhi = Math.atan2(uz, ux);
            if (charPhi < 0) charPhi += Math.PI * 2;

            const charScale_sync = playerScale;
            const terrainRadius_sync = getFloorTopRadiusAt(
              ux, uy, uz,
              RADIUS + getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) * HEIGHT_SCALE
            );
            const waterRadius_sync = RADIUS + waterLevel * 0.15;
            if (waterEnabled && terrainRadius_sync < waterRadius_sync) {
              const targetSwimRadius_sync =
                waterRadius_sync +
                (-0.22 + swimMovementFactor * 0.27) * charScale_sync;
              playerDiveDepth = Math.max(0, targetSwimRadius_sync - dLen);
            }
          }

          moveForwardInput = 0;
          moveSidewaysInput = 0;
          isWalking = false;
        } else {
          ragdollInitialized = false;
        }
        
        updateCollectibles(dt);

        let sinTheta = Math.sin(charTheta);
        let cosTheta = Math.cos(charTheta);
        let sinPhi = Math.sin(charPhi);
        let cosPhi = Math.cos(charPhi);

        let nx = sinTheta * cosPhi;
        let ny = cosTheta;
        let nz = sinTheta * sinPhi;
        let localUp = [nx, ny, nz];

        let charHeight = getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
        const charScale = playerScale;

        const mechOffset = typeof window.mechSeatOffset !== "undefined" ? window.mechSeatOffset : 0.71;
        let feetRadiusBefore = (playerCenterRadius !== null) ? (playerCenterRadius - (activeRidingMech ? mechOffset : 0.46 * charScale)) : (RADIUS + charHeight * HEIGHT_SCALE);
        const caveData = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(nx, ny, nz, feetRadiusBefore) : { ground: RADIUS + charHeight * HEIGHT_SCALE, ceiling: Infinity, insideTunnel: false };
        let terrainRadius = caveData.ground;
        const waterRadius = RADIUS + waterLevel * 0.15;
        let wRadiusLocal = getWaterRadiusAt(nx * feetRadiusBefore, ny * feetRadiusBefore, nz * feetRadiusBefore);
        if (caveData.insideTunnel && wRadiusLocal === 0) {
            wRadiusLocal = waterRadius;
        }
        
        // if (caveData.insideTunnel) { wRadiusLocal = 0; } // Disabled: allow water in caves
        
        let currentFeetRadius = (playerCenterRadius !== null) ? (playerCenterRadius - (activeRidingMech ? mechOffset : 0.46 * charScale)) : terrainRadius;

        // เรียกใช้ฟังก์ชันควบคุมการว่ายน้ำและดำน้ำจาก ui.js เพื่อลดความซ้ำซ้อนของโค้ด
        updatePlayerSwimmingAndDiving(
          currentFeetRadius,
          wRadiusLocal,
          waterRadius,
          terrainRadius,
          charScale,
          rotationX,
          moveForwardInput
        );

        // Initialize playerCenterRadius if null
        if (playerCenterRadius === null) {
          playerCenterRadius = terrainRadius + (activeRidingMech ? mechOffset : 0.46 * charScale);
          playerVerticalVel = 0.0;
        }

        let standGroundRadius = terrainRadius + (activeRidingMech ? mechOffset : 0.46 * charScale);
        if (activeRidingBoat) {
          const tRadius = terrainRadius;
          const baseRadius = (waterEnabled && tRadius < waterRadius) ? waterRadius : tRadius;
          let bR = activeRidingBoat.currentRadius !== undefined ? activeRidingBoat.currentRadius : (baseRadius - 0.04);
          standGroundRadius = bR + 0.46 * charScale;
        } else if (activeRidingMech) {
          standGroundRadius = terrainRadius + mechOffset;
        } else if (currentSwimFactor > 0.0) {
          const targetSwimRadius =
            waterRadius + (-0.22 + swimMovementFactor * 0.27) * charScale;
          const subSwimRadius = targetSwimRadius - playerDiveDepth;
          standGroundRadius =
            standGroundRadius * (1.0 - currentSwimFactor) +
            subSwimRadius * currentSwimFactor;

          // Enforce floor/ceiling limits on the standGroundRadius
          if (typeof caveData !== 'undefined' && caveData) {
            if (caveData.insideTunnel) {
              const minCenter = caveData.ground + 0.46 * charScale;
              const maxCenter = (caveData.ceiling !== Infinity) ? (caveData.ceiling - 0.46 * charScale) : Infinity;
              if (standGroundRadius < minCenter) {
                standGroundRadius = minCenter;
              }
              if (standGroundRadius > maxCenter) {
                standGroundRadius = maxCenter;
              }
            } else {
              const minCenter = terrainRadius + 0.46 * charScale;
              if (standGroundRadius < minCenter) {
                standGroundRadius = minCenter;
              }
            }
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
          standGroundRadius += bobbing;
        }

        // Simulate vertical physics (gravity/falling)
        if (ragdollEnabled && ragdollInitialized) {
          playerCenterRadius = Math.sqrt(
            ragdollPos[0] * ragdollPos[0] +
            ragdollPos[1] * ragdollPos[1] +
            ragdollPos[2] * ragdollPos[2]
          );
          playerVerticalVel = 0.0;
          isPlayerGrounded = true;
        } else {
          if ((currentSwimFactor > 0.0 && playerVerticalVel <= 0) || activeRidingBoat || activeRidingMech) {
            // Swimming or riding - lock to stand radius
            playerCenterRadius = standGroundRadius;
            playerVerticalVel = 0.0;
            isPlayerGrounded = true;
          } else {
            const minGroundRadius = (typeof caveData !== 'undefined' && caveData && caveData.insideTunnel)
              ? (caveData.ground + 0.46 * charScale)
              : standGroundRadius;

            if (isPlayerGrounded && playerVerticalVel <= 0.0 && Math.abs(playerCenterRadius - minGroundRadius) < 0.02) {
              playerCenterRadius = minGroundRadius;
              playerVerticalVel = 0.0;
            } else {
              // Air physics - apply gravity
              playerVerticalVel = Physics.applyVerticalGravity(playerVerticalVel, 1.0, Physics.gravityAccel);
              playerCenterRadius += playerVerticalVel;

              if (playerCenterRadius <= minGroundRadius) {
                const impactVelocity = -playerVerticalVel;
                playerCenterRadius = minGroundRadius;
                playerVerticalVel = 0.0;
                isPlayerGrounded = true;

                if (impactVelocity > 0.025) {
                  if (typeof triggerFallRagdoll === "function") {
                    triggerFallRagdoll(1500);
                  } else {
                    setRagdoll(true);
                  }
                  if (typeof playSplashSound === "function") {
                    playSplashSound(0.5);
                  }
                }
              } else if (typeof caveData !== 'undefined' && caveData && caveData.insideTunnel && caveData.ceiling !== Infinity && playerCenterRadius > (caveData.ceiling - 0.46 * charScale)) {
                playerCenterRadius = caveData.ceiling - 0.46 * charScale;
                playerVerticalVel = Math.min(0.0, -playerVerticalVel * 0.2); // Ceiling bump bounce
              } else {
                isPlayerGrounded = false;
              }
            }
          }
        }



        // Synchronize playerDiveDepth with actual position to prevent sudden snapping/springing
        if (currentSwimFactor >= 0.99 && typeof caveData !== 'undefined' && caveData && playerCenterRadius !== null) {
          const targetSwimRadius = waterRadius + (-0.22 + swimMovementFactor * 0.27) * charScale;
          const actualDepth = targetSwimRadius - playerCenterRadius;
          const currentExpectedRadius = targetSwimRadius - playerDiveDepth;
          // Synchronize anytime we are in a cave tunnel, or when physical position differs significantly from expected depth.
          // We use a larger threshold on the surface (0.3) than in caves (0.05) to prevent false-positive dive triggers
          // during swimMovementFactor transitions or water wave bobbing.
          const syncThreshold = (caveData.insideTunnel ? 0.05 : 0.3) * charScale;
          if (caveData.insideTunnel || Math.abs(playerCenterRadius - currentExpectedRadius) > syncThreshold) {
            const bottomRadius = terrainRadius + 0.46 * charScale;
            const maxDiveDepth = Math.max(0, targetSwimRadius - bottomRadius);
            playerDiveDepth = Math.max(0.0, Math.min(maxDiveDepth, actualDepth));
            isDivingMode = playerDiveDepth > 0.015 * charScale;
          }
        }

        let groundRadius = playerCenterRadius;

        let px = groundRadius * nx;
        let py = groundRadius * ny;
        let pz = groundRadius * nz;

        if (ragdollEnabled && ragdollInitialized) {
          const pelvisPos = ragdollPos;
          px = pelvisPos[0];
          py = pelvisPos[1];
          pz = pelvisPos[2];
        }

        let North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
        let East = [-sinPhi, 0, cosPhi];

        if (activeRidingBoat) {
          let boatDepth = waterRadius - terrainRadius;
          let isInWater = waterEnabled && boatDepth > 0.48 * charScale;
          let isLandBoat = activeRidingBoat.hasWheel || activeRidingBoat.hasWheels || (activeRidingBoat.wheelCount && activeRidingBoat.wheelCount > 0);

          if (isLandBoat) {
            // === GTA REALISTIC VEHICLE DRIVING PHYSICS ===
            const dt = timeScale;
            
            // 1. Front Wheel Steering Angle (A / D keys)
            const maxSteerRad = 0.52; // ~30 degrees
            const targetSteer = -moveSidewaysInput * maxSteerRad;
            let currentSteer = activeRidingBoat.steerAngle || 0;
            currentSteer += (targetSteer - currentSteer) * Math.min(1.0, 0.2 * dt);
            activeRidingBoat.steerAngle = currentSteer;

            // 2. Acceleration, Braking, Reversing & Handbrake (W / S / Space)
            let vehSpeed = activeRidingBoat.vehicleSpeed || 0;
            const pSpeed = typeof playerSpeed !== "undefined" ? playerSpeed : 0.005;
            let topFwdSpeed = pSpeed * 5.0;
            let topRevSpeed = pSpeed * 2.0;
            let accelPower = pSpeed * 0.15 * dt;
            let brakePower = pSpeed * 0.30 * dt;
            let coastFriction = Math.pow(0.98, dt);
            
            // Require electric engine to move a wheeled land boat
            let canAccelerate = activeRidingBoat.hasEngine;

            const isHandbrake = (typeof keys !== "undefined" && (keys["Space"] || keys[" "]));
            activeRidingBoat.isHandbraking = isHandbrake;
            
            // Add Gravity Roll
            const currentPitch = activeRidingBoat.pitchGrade || 0;
            const gravityRollPower = currentPitch * pSpeed * 0.5 * dt; 
            
            if (!isHandbrake) {
                vehSpeed -= gravityRollPower;
            }

            if (isHandbrake) {
              vehSpeed *= Math.pow(0.85, dt);
            } else if (moveForwardInput > 0.1 && canAccelerate) {
              if (vehSpeed < -0.01) {
                vehSpeed += brakePower;
              } else {
                vehSpeed = Math.min(topFwdSpeed, vehSpeed + accelPower);
              }
            } else if (moveForwardInput < -0.1 && canAccelerate) {
              if (vehSpeed > 0.01) {
                vehSpeed -= brakePower;
              } else {
                vehSpeed = Math.max(-topRevSpeed, vehSpeed - accelPower);
              }
            } else {
              vehSpeed *= coastFriction;
              // Remove the strict zeroing here so it can roll slowly
              if (Math.abs(vehSpeed) < 0.00001) vehSpeed = 0;
            }

            activeRidingBoat.vehicleSpeed = vehSpeed;

            // 3. Vehicle Turning / Steering Heading (GTA Car Physics)
            // Car turns proportionally to speed and steer angle; reverses turn direction in reverse
            if (Math.abs(vehSpeed) > 0.001) {
              const turnDir = vehSpeed >= 0 ? 1 : -1;
              const driftMultiplier = isHandbrake ? 2.4 : 1.0;
              const turnRate = currentSteer * (Math.abs(vehSpeed) / topFwdSpeed) * 0.03 * turnDir * driftMultiplier;
              charHeading += turnRate * dt;
            }

            // 4. Wheel Spin Angle
            const wheelScale = typeof window.wheelScaleMultiplier === "number" ? window.wheelScaleMultiplier : 1.0;
            const wheelRadius = 0.16 * wheelScale;
            const distTraveled = vehSpeed * dt;
            activeRidingBoat.spinAngle = (activeRidingBoat.spinAngle || 0) + (distTraveled / wheelRadius);
          } else {
            let canRow = isInWater || isLandBoat;
            if (canRow) {
              charHeading += -moveSidewaysInput * 0.05 * timeScale;
            }
          }
        }

        const F_3d = [
          North[0] * Math.cos(charHeading) + East[0] * Math.sin(charHeading),
          North[1] * Math.cos(charHeading) + East[1] * Math.sin(charHeading),
          North[2] * Math.cos(charHeading) + East[2] * Math.sin(charHeading),
        ];

        const C_3d = [
          North[0] * Math.cos(rotationY) + East[0] * Math.sin(rotationY),
          North[1] * Math.cos(rotationY) + East[1] * Math.sin(rotationY),
          North[2] * Math.cos(rotationY) + East[2] * Math.sin(rotationY),
        ];

        let moveNorthFactor = 0;
        let moveEastFactor = 0;
        
        if (activeRidingBoat) {
          let boatDepth = waterRadius - terrainRadius;
          let isInWater = waterEnabled && boatDepth > 0.48 * charScale;
          let isLandBoat = activeRidingBoat.hasWheel || activeRidingBoat.hasWheels || (activeRidingBoat.wheelCount && activeRidingBoat.wheelCount > 0);

          if (isLandBoat) {
            let speedRatio = (activeRidingBoat.vehicleSpeed || 0) / (typeof playerSpeed !== "undefined" ? playerSpeed : 0.005);
            moveNorthFactor = Math.cos(charHeading) * (Math.abs(speedRatio) > 0.001 ? Math.sign(speedRatio) : 0);
            moveEastFactor = Math.sin(charHeading) * (Math.abs(speedRatio) > 0.001 ? Math.sign(speedRatio) : 0);
          } else if (isInWater || isLandBoat) {
            moveNorthFactor = Math.cos(charHeading) * moveForwardInput;
            moveEastFactor = Math.sin(charHeading) * moveForwardInput;
          } else {
            moveNorthFactor = 0;
            moveEastFactor = 0;
            if (Math.abs(moveForwardInput) > 0.1 || Math.abs(moveSidewaysInput) > 0.1) {
              showNotice("เรือต้องอยู่บนน้ำ หรือติดล้อไม้เพื่อวิ่งบนบก! (Attach Wooden Wheel to drive on land)");
            }
          }
        } else if (activeRidingMech) {
          if (!window.isMechFullyAssembled(activeRidingMech)) {
            moveNorthFactor = 0;
            moveEastFactor = 0;
            if (Math.abs(moveForwardInput) > 0.1 || Math.abs(moveSidewaysInput) > 0.1) {
              if (typeof showNotice === "function") {
                showNotice("⚠️ ต้องประกอบชิ้นส่วนหุ่นยนต์ให้ครบ 4 ชิ้น (ขาซ้าย, ขาขวา, แขนซ้าย, แขนขวา) ก่อนจึงจะขับได้!");
              }
            }
          } else {
            // Mech is fully assembled!
            if (activeRidingMech.dockedStand) {
              // Currently docked on Robot Stand
              const isHoldingForwardOnly = (moveForwardInput > 0.2) && (Math.abs(moveSidewaysInput) < 0.3);
              if (isHoldingForwardOnly) {
                activeRidingMech._undockHoldTimer = (activeRidingMech._undockHoldTimer || 0) + dt;
                if (activeRidingMech._undockHoldTimer >= 0.35) {
                  // Undock / Break away from stand!
                  const prevStand = activeRidingMech.dockedStand;
                  activeRidingMech.dockedStand = null;
                  activeRidingMech._undockedFromStand = prevStand;
                  activeRidingMech._hasLeftStand = false;
                  if (prevStand) {
                    prevStand.isDynamic = false;
                    if (prevStand.vel) prevStand.vel = [0, 0, 0];
                  }
                  if (activeRidingMech.attachedParts) {
                    activeRidingMech.attachedParts = activeRidingMech.attachedParts.filter(entry => entry.item && entry.item.type !== "robot_stand");
                  }
                  activeRidingMech._undockHoldTimer = 0;
                  activeRidingMech._redockCooldown = 3.0; // 3 seconds cooldown before can re-dock
                  if (typeof showNotice === "function") {
                    showNotice("🔓 ปลดล็อคออกจากฐานตั้งแล้ว! / Undocked from Stand!");
                  }
                  moveNorthFactor = Math.cos(rotationY) * moveForwardInput + Math.sin(rotationY) * moveSidewaysInput;
                  moveEastFactor  = Math.sin(rotationY) * moveForwardInput - Math.cos(rotationY) * moveSidewaysInput;
                } else {
                  moveNorthFactor = 0;
                  moveEastFactor = 0;
                }
              } else {
                activeRidingMech._undockHoldTimer = 0;
                moveNorthFactor = 0;
                moveEastFactor = 0;

                // Anchor position & orientation smoothly to stand
                const stand = activeRidingMech.dockedStand;
                if (stand && stand.position) {
                  const sPos = stand.position;
                  const sLen = Math.sqrt(sPos[0]*sPos[0] + sPos[1]*sPos[1] + sPos[2]*sPos[2]) || 1;
                  const snx = sPos[0]/sLen, sny = sPos[1]/sLen, snz = sPos[2]/sLen;
                  charTheta = Math.acos(Math.max(-1.0, Math.min(1.0, sny)));
                  charPhi = Math.atan2(snz, snx);
                  if (charPhi < 0) charPhi += Math.PI * 2;
                  if (stand.F) {
                    const North = [-Math.cos(charTheta) * Math.cos(charPhi), Math.sin(charTheta), -Math.cos(charTheta) * Math.sin(charPhi)];
                    const East = [-Math.sin(charPhi), 0, Math.cos(charPhi)];
                    const fNorth = stand.F[0]*North[0] + stand.F[1]*North[1] + stand.F[2]*North[2];
                    const fEast = stand.F[0]*East[0] + stand.F[1]*East[1] + stand.F[2]*East[2];
                    charHeading = Math.atan2(fEast, fNorth);
                  }
                }
              }
            } else {
              // Undocked, driving freely!
              moveNorthFactor = Math.cos(rotationY) * moveForwardInput + Math.sin(rotationY) * moveSidewaysInput;
              moveEastFactor  = Math.sin(rotationY) * moveForwardInput - Math.cos(rotationY) * moveSidewaysInput;

              // Check proximity to Robot Stand for manual re-docking via holding [E]
              let closestStand = null;
              let minStandDistSq = 0.81; // within 0.9 meters (close proximity)
              if (typeof SpatialGrid !== "undefined") {
                const nearStands = SpatialGrid.queryRadius(activeRidingMech.position[0], activeRidingMech.position[1], activeRidingMech.position[2], 0.95, item => item.active && !item.isPreview && item.type === "robot_stand");
                for (let item of nearStands) {
                  const dx = item.position[0] - activeRidingMech.position[0];
                  const dy = item.position[1] - activeRidingMech.position[1];
                  const dz = item.position[2] - activeRidingMech.position[2];
                  const distSq = dx*dx + dy*dy + dz*dz;
                  if (distSq < minStandDistSq) {
                    minStandDistSq = distSq;
                    closestStand = item;
                  }
                }
              } else if (typeof collectibles !== "undefined" && Array.isArray(collectibles)) {
                for (let item of collectibles) {
                  if (item.active && !item.isPreview && item.type === "robot_stand") {
                    const dx = item.position[0] - activeRidingMech.position[0];
                    const dy = item.position[1] - activeRidingMech.position[1];
                    const dz = item.position[2] - activeRidingMech.position[2];
                    const distSq = dx*dx + dy*dy + dz*dz;
                    if (distSq < minStandDistSq) {
                      minStandDistSq = distSq;
                      closestStand = item;
                    }
                  }
                }
              }
              activeRidingMech._nearbyStand = closestStand;
            }
          }
        } else if (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") {
          moveNorthFactor = Math.cos(rotationY) * moveForwardInput + Math.sin(rotationY) * moveSidewaysInput;
          moveEastFactor  = Math.sin(rotationY) * moveForwardInput - Math.cos(rotationY) * moveSidewaysInput;
        } else {
          moveNorthFactor = moveForwardInput;
          moveEastFactor = -moveSidewaysInput;
        }

        const moveLen = Math.sqrt(
          moveNorthFactor * moveNorthFactor + moveEastFactor * moveEastFactor,
        );
        if (moveLen > 0.001) {
          const moveNorthNorm = moveNorthFactor / moveLen;
          const moveEastNorm = moveEastFactor / moveLen;

          const currentRadius = RADIUS + charHeight * HEIGHT_SCALE;
          let pSpeed = typeof playerSpeed !== "undefined" ? playerSpeed : 0.005;
          let currentSpeedVal = pSpeed * (1.0 - 0.4 * currentSwimFactor);
          if (activeRidingBoat) {
            let _bDepth = waterRadius - terrainRadius;
            let _isInWater = waterEnabled && _bDepth > 0.48 * charScale;
            let _isLandBoat = activeRidingBoat.hasWheel || activeRidingBoat.hasWheels || (activeRidingBoat.wheelCount && activeRidingBoat.wheelCount > 0);
            if (_isLandBoat) {
              currentSpeedVal = Math.abs(activeRidingBoat.vehicleSpeed || 0);
            } else if (_isInWater) {
              if (activeRidingBoat.hasEngine) {
                 currentSpeedVal = pSpeed * 5.0;
              } else {
                 currentSpeedVal = pSpeed * 1.5;
              }
            } else {
              // Non-wheeled boat on land: dragged with friction
              if (activeRidingBoat.hasEngine) {
                 currentSpeedVal = pSpeed * 1.8;
              } else {
                 currentSpeedVal = pSpeed * 0.6;
              }
            }
          }
          const speed = currentSpeedVal / currentRadius;
          if (activeRidingBoat) {
            let isMotorBoat = activeRidingBoat.hasEngine && !(activeRidingBoat.hasWheel || activeRidingBoat.hasWheels || (activeRidingBoat.wheelCount && activeRidingBoat.wheelCount > 0));
            if (!isMotorBoat) boatRowTimer += speed * 50.0;
          }

          const V_move = [
            North[0] * moveNorthNorm + East[0] * moveEastNorm,
            North[1] * moveNorthNorm + East[1] * moveEastNorm,
            North[2] * moveNorthNorm + East[2] * moveEastNorm,
          ];

          const P_curr = [nx, ny, nz];
          let P_new = [
            P_curr[0] * Math.cos(speed) + V_move[0] * Math.sin(speed),
            P_curr[1] * Math.cos(speed) + V_move[1] * Math.sin(speed),
            P_curr[2] * Math.cos(speed) + V_move[2] * Math.sin(speed),
          ];

          const pLen = Math.sqrt(
            P_new[0] * P_new[0] + P_new[1] * P_new[1] + P_new[2] * P_new[2],
          );
          P_new = [P_new[0] / pLen, P_new[1] / pLen, P_new[2] / pLen];

          const allObstacles = [
            ...natureObstacles,
            ...cubeObstacles,
            ...amphibians,
          ];
          const nearbyObstacles = [];
          const playerPos3D = [P_new[0] * groundRadius, P_new[1] * groundRadius, P_new[2] * groundRadius];
          const filterDistSq = (maxColliderDistance + 1.5) * (maxColliderDistance + 1.5);
          for (let i = 0; i < allObstacles.length; i++) {
            const obs = allObstacles[i];
            if (!obs.position) continue;
            const dx = playerPos3D[0] - obs.position[0];
            const dy = playerPos3D[1] - obs.position[1];
            const dz = playerPos3D[2] - obs.position[2];
            if (dx*dx + dy*dy + dz*dz < filterDistSq) {
              nearbyObstacles.push(obs);
            }
          }

          // --- ระบบป้องกันการเดินชนต้นไม้ หิน และสี่เหลี่ยม (ใช้ Simplified Mesh/Capsule Collider) ---
          const maxDistSq = maxColliderDistance * maxColliderDistance;
          for (let iter = 0; iter < 3; iter++) {
            for (let obs of nearbyObstacles) {
              if (!obs.position) continue;
              
              const C = [P_new[0] * groundRadius, P_new[1] * groundRadius, P_new[2] * groundRadius];
              const dx = C[0] - obs.position[0];
              const dy = C[1] - obs.position[1];
              const dz = C[2] - obs.position[2];
              
              if (dx*dx + dy*dy + dz*dz > maxDistSq) continue;
              
              const charCollisionRadius = playerScale * 0.38;

              if (obs.meshStart !== undefined && obs.meshEnd !== undefined) {
                  if (dx*dx + dy*dy + dz*dz > (obs.radius + charCollisionRadius)*(obs.radius + charCollisionRadius)) {
                      continue;
                  }

                  const collisionEnd = obs.collisionMeshEnd !== undefined ? obs.collisionMeshEnd : obs.meshEnd;
                  const count = collisionEnd - obs.meshStart;

                  for(let j=0; j<count; j+=3) {
                      const vIdx = obs.meshStart + j;
                      const a = [natureRawVertices[vIdx*3], natureRawVertices[vIdx*3+1], natureRawVertices[vIdx*3+2]];
                      const b = [natureRawVertices[(vIdx+1)*3], natureRawVertices[(vIdx+1)*3+1], natureRawVertices[(vIdx+1)*3+2]];
                      const c = [natureRawVertices[(vIdx+2)*3], natureRawVertices[(vIdx+2)*3+1], natureRawVertices[(vIdx+2)*3+2]];
                      
                      const closest = closestPointOnTriangle(C, a, b, c);
                      const px = C[0] - closest[0];
                      const py = C[1] - closest[1];
                      const pz = C[2] - closest[2];
                      const pLenSq = px*px + py*py + pz*pz;
                      
                      if (pLenSq < charCollisionRadius * charCollisionRadius && pLenSq > 0.0001) {
                          const pLen = Math.sqrt(pLenSq);
                          const pushDist = charCollisionRadius - pLen;
                          C[0] += (px / pLen) * pushDist;
                          C[1] += (py / pLen) * pushDist;
                          C[2] += (pz / pLen) * pushDist;
                      }
                  }
                  
                  const newLen = Math.sqrt(C[0]*C[0] + C[1]*C[1] + C[2]*C[2]);
                  if (newLen > 0.001) {
                      P_new[0] = C[0] / newLen;
                      P_new[1] = C[1] / newLen;
                      P_new[2] = C[2] / newLen;
                  }
              } else if (obs.colliders && obs.colliders.length > 0) {
                for (let col of obs.colliders) {
                  const cx = obs.position[0] + (col.offset[0] || 0);
                  const cy = obs.position[1] + (col.offset[1] || 0);
                  const cz = obs.position[2] + (col.offset[2] || 0);
                  const clen = Math.sqrt(cx * cx + cy * cy + cz * cz);
                  const obsNormalX = cx / clen;
                  const obsNormalY = cy / clen;
                  const obsNormalZ = cz / clen;

                  const charCollisionRadius = playerScale * 0.38;
                  const minDistance = col.radius + charCollisionRadius;

                  // 3D Distance check using player's 3D groundRadius and joint's 3D height clen
                  const vertical_diff = Math.abs(groundRadius - clen);

                  if (vertical_diff < minDistance) {
                    // Required horizontal distance on the sphere to clear collision in 3D
                    const h_req = Math.sqrt(
                      minDistance * minDistance - vertical_diff * vertical_diff,
                    );

                    const dx = P_new[0] - obsNormalX;
                    const dy = P_new[1] - obsNormalY;
                    const dz = P_new[2] - obsNormalZ;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    const h_actual = dist * groundRadius; // current horizontal distance

                    if (h_actual < h_req && dist > 0.001) {
                      let pushX = P_new[0] - obsNormalX;
                      let pushY = P_new[1] - obsNormalY;
                      let pushZ = P_new[2] - obsNormalZ;
                      let pushLen = Math.sqrt(
                        pushX * pushX + pushY * pushY + pushZ * pushZ,
                      );
                      if (pushLen < 1e-6) {
                        pushX = 1;
                        pushY = 0;
                        pushZ = 0;
                        pushLen = 1;
                      }
                      pushX /= pushLen;
                      pushY /= pushLen;
                      pushZ /= pushLen;

                      const targetUnitDist = h_req / groundRadius;
                      P_new[0] = obsNormalX + pushX * targetUnitDist;
                      P_new[1] = obsNormalY + pushY * targetUnitDist;
                      P_new[2] = obsNormalZ + pushZ * targetUnitDist;

                      const pLen2 = Math.sqrt(
                        P_new[0] * P_new[0] +
                          P_new[1] * P_new[1] +
                          P_new[2] * P_new[2],
                      );
                      if (pLen2 > 0.001) {
                        P_new[0] /= pLen2;
                        P_new[1] /= pLen2;
                        P_new[2] /= pLen2;
                      }
                    }
                  }
            }
          } else {
                // คำนวณระยะห่างบนผิวทรงกลม 3D
                // ใช้ position จาก obs ที่เก็บจากโมเดลจริง
                const obsLen = Math.sqrt(
                  obs.position[0] * obs.position[0] +
                    obs.position[1] * obs.position[1] +
                    obs.position[2] * obs.position[2],
                );
                if (obsLen > 0.001) {
                  const obsNormalX = obs.position[0] / obsLen;
                  const obsNormalY = obs.position[1] / obsLen;
                  const obsNormalZ = obs.position[2] / obsLen;

                  const charCollisionRadius = playerScale * 0.38;
                  let minDistance = obs.radius + charCollisionRadius;

                  const vertical_diff = Math.abs(groundRadius - obsLen);
                  if (vertical_diff < minDistance) {
                    const h_req = Math.sqrt(
                      minDistance * minDistance - vertical_diff * vertical_diff,
                    );

                    const dx = P_new[0] - obsNormalX;
                    const dy = P_new[1] - obsNormalY;
                    const dz = P_new[2] - obsNormalZ;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    const h_actual = dist * groundRadius;

                    if (h_actual < h_req && dist > 0.001) {
                      let pushX = P_new[0] - obsNormalX;
                      let pushY = P_new[1] - obsNormalY;
                      let pushZ = P_new[2] - obsNormalZ;
                      let pushLen = Math.sqrt(
                        pushX * pushX + pushY * pushY + pushZ * pushZ,
                      );
                      if (pushLen < 1e-6) {
                        pushX = 1;
                        pushY = 0;
                        pushZ = 0;
                        pushLen = 1;
                      }
                      pushX /= pushLen;
                      pushY /= pushLen;
                      pushZ /= pushLen;

                      const targetUnitDist = h_req / groundRadius;
                      P_new[0] = obsNormalX + pushX * targetUnitDist;
                      P_new[1] = obsNormalY + pushY * targetUnitDist;
                      P_new[2] = obsNormalZ + pushZ * targetUnitDist;

                      const pLen2 = Math.sqrt(
                        P_new[0] * P_new[0] +
                          P_new[1] * P_new[1] +
                          P_new[2] * P_new[2],
                      );
                      if (pLen2 > 0.001) {
                        P_new[0] /= pLen2;
                        P_new[1] /= pLen2;
                        P_new[2] /= pLen2;
                      }
                    }
                  }
                }
              }
            }
          }

            // --- COLLISION WITH WOOD FLOORS & STONE FLOORS (horizontal blocking disabled to prevent redundant/overlapping collision) ---
            // Wood floors and stone floors are flat surfaces and should not block the player horizontally.
            // This prevents the player from floating unusually high due to conflicting/overlapping horizontal wall and floor collisions.

            // Structure Collision (wood_wall, wood_roof, wood_window, wood_door)
            // Prevents both on-foot player and wheeled land boat from passing through walls and roofs
            if (typeof resolveStructureCollisions === "function") {
              resolveStructureCollisions({
                P_new,
                P_curr,
                groundRadius,
                playerScale,
                activeRidingBoat,
                collectibles,
                F_3d,
                East,
                North,
                charTheta,
                charPhi,
                charHeading
              });
            }

            // Renormalize P_new after physics
            const pLenTemp = Math.sqrt(P_new[0]*P_new[0] + P_new[1]*P_new[1] + P_new[2]*P_new[2]) || 1;
            P_new[0] /= pLenTemp;
            P_new[1] /= pLenTemp;
            P_new[2] /= pLenTemp;

            // Step-height / Cave-wall and low ceiling blocking check to prevent clipping/teleporting to surface
            const collisionResult = checkCaveAndTerrainCollision(
              P_new,
              P_curr,
              playerCenterRadius,
              charScale,
              currentSwimFactor,
              waterRadius,
              playerDiveDepth,
              swimMovementFactor,
              charHeight
            );
            
            if (collisionResult.playerCenterRadius > playerCenterRadius + 0.0001 && playerVerticalVel < 0) {
               if (playerCenterRadius <= collisionResult.playerCenterRadius + 0.05) {
                 playerVerticalVel = 0;
                 isPlayerGrounded = true;
               }
            } else if (collisionResult.playerCenterRadius < playerCenterRadius - 0.0001 && playerVerticalVel > 0) {
               playerVerticalVel = 0;
            }

            P_new = collisionResult.P_new;
            playerCenterRadius = collisionResult.playerCenterRadius;
            playerDiveDepth = collisionResult.playerDiveDepth;
            isDivingMode = collisionResult.isDivingMode;

            charTheta = Math.acos(Math.max(-1, Math.min(1, P_new[1])));
            charTheta = Math.max(1e-5, Math.min(Math.PI - 1e-5, charTheta));

            charPhi = Math.atan2(P_new[2], P_new[0]);
            if (charPhi < 0) charPhi += Math.PI * 2;

            sinTheta = Math.sin(charTheta);
            cosTheta = Math.cos(charTheta);
            sinPhi = Math.sin(charPhi);
            cosPhi = Math.cos(charPhi);

            nx = sinTheta * cosPhi;
            ny = cosTheta;
            nz = sinTheta * sinPhi;
            localUp = [nx, ny, nz];

            North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
            East = [-sinPhi, 0, cosPhi];

            const C_proj_North =
              C_3d[0] * North[0] + C_3d[1] * North[1] + C_3d[2] * North[2];
            const C_proj_East =
              C_3d[0] * East[0] + C_3d[1] * East[1] + C_3d[2] * East[2];
            rotationY = Math.atan2(C_proj_East, C_proj_North);

            const F_proj_North =
              F_3d[0] * North[0] + F_3d[1] * North[1] + F_3d[2] * North[2];
            const F_proj_East =
              F_3d[0] * East[0] + F_3d[1] * East[1] + F_3d[2] * East[2];
            charHeading = Math.atan2(F_proj_East, F_proj_North);

            const V_proj_North =
              V_move[0] * North[0] + V_move[1] * North[1] + V_move[2] * North[2];
            const V_proj_East =
              V_move[0] * East[0] + V_move[1] * East[1] + V_move[2] * East[2];
            const moveHeading = Math.atan2(V_proj_East, V_proj_North);

            let diffHeading = moveHeading - charHeading;
            while (diffHeading < -Math.PI) diffHeading += Math.PI * 2;
            while (diffHeading > Math.PI) diffHeading -= Math.PI * 2;
            
            let isAimingBow = (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") && isUsingItem && activeItem && activeItem.name === "BOW";
            
            if (!activeRidingBoat && !isAimingBow) {
              charHeading += diffHeading * 0.22 * timeScale;
            }

            isWalking = !activeRidingBoat;
            if (!activeRidingBoat) {
              const walkSpeed = activeRidingMech ? 0.12 : 0.24;
              walkPhase += walkSpeed * timeScale;
            }

            charHeight = getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));

            const mechOffsetMoving = typeof window.mechSeatOffset !== "undefined" ? window.mechSeatOffset : 0.71;
            let feetRadiusBeforeForSwim = (playerCenterRadius !== null) ? (playerCenterRadius - (activeRidingMech ? mechOffsetMoving : 0.46 * charScale)) : (RADIUS + charHeight * HEIGHT_SCALE);
            const caveDataForSwim = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(nx, ny, nz, feetRadiusBeforeForSwim) : { ground: RADIUS + charHeight * HEIGHT_SCALE, ceiling: Infinity, insideTunnel: false };
            let tRadius = caveDataForSwim.ground;
            let wRadius = getWaterRadiusAt(nx * feetRadiusBeforeForSwim, ny * feetRadiusBeforeForSwim, nz * feetRadiusBeforeForSwim);
            if (caveDataForSwim.insideTunnel && wRadius === 0) {
                wRadius = waterRadius;
            }
            
            updatePlayerSwimmingAndDiving(
              feetRadiusBeforeForSwim,
              wRadius,
              waterRadius,
              tRadius,
              charScale,
              rotationX,
              moveForwardInput
            );

            if (activeRidingBoat) {
              let baseRadius = (waterEnabled && tRadius < wRadius) ? wRadius : tRadius;
              if (waterEnabled && tRadius < wRadius) {
                  const wave = getWaterWave(nx * wRadius, ny * wRadius, nz * wRadius, waterAnimTime, waveStrength);
                  let depth = wRadius - tRadius;
                  let fade = Math.min(1.0, Math.max(0.0, depth / 0.1));
                  baseRadius += wave * fade;
              }
              let bR = activeRidingBoat.currentRadius !== undefined ? (activeRidingBoat.currentRadius + 0.01) : (baseRadius - 0.03);
              groundRadius = bR + 0.46 * charScale;
            } else if (activeRidingMech) {
              const isMechWalking = typeof isWalking !== "undefined" && isWalking;
              const wPhase = typeof walkPhase !== "undefined" ? walkPhase : 0.0;
              const stepBob = 0.0; // Steady camera when driving mech
              groundRadius = tRadius + (typeof window.mechSeatOffset !== "undefined" ? window.mechSeatOffset : 0.71) + stepBob;
            } else {
              groundRadius = tRadius + 0.46 * charScale;
            }
            
            if (currentSwimFactor > 0.0) {
              const targetSwimRadius =
                wRadius + (-0.22 + swimMovementFactor * 0.27) * charScale;
              const subSwimRadius = targetSwimRadius - playerDiveDepth;
              groundRadius =
                groundRadius * (1.0 - currentSwimFactor) +
                subSwimRadius * currentSwimFactor;

              // Add gentle water bobbing (only if not diving deeply)
              const bobSpeed = isWalking ? 4.0 : 2.0;
              const bobAmp = isWalking ? 0.02 : 0.04;
              const bobFactor = Math.max(
                0,
                1.0 - playerDiveDepth / (0.1 * charScale),
              );
              const bobbing =
                Math.sin(waterAnimTime * bobSpeed) *
                bobAmp *
                charScale *
                bobFactor;
              groundRadius += bobbing;
            }

            const maxStepDown = 0.20 * charScale;
            if (activeRidingBoat || activeRidingMech || currentSwimFactor > 0.0) {
              playerCenterRadius = groundRadius;
              isPlayerGrounded = true;
            } else if (isPlayerGrounded) {
              if (groundRadius < standGroundRadius - maxStepDown) {
                // Stepped off a ledge or cliff! Become airborne and fall.
                isPlayerGrounded = false;
              } else {
                // Stepping on slope/ground/stairs smoothly
                playerCenterRadius = groundRadius;
              }
            }

            const planetCore = (typeof window.getPlanetCorePosition === "function") ? window.getPlanetCorePosition() : (window.PLANET_CORE_POS || [0, 0, 0]);
            px = planetCore[0] + playerCenterRadius * nx;
            py = planetCore[1] + playerCenterRadius * ny;
            pz = planetCore[2] + playerCenterRadius * nz;
          
        } else {
          isWalking = false;
          const phaseWrap = walkPhase % (Math.PI * 2);
          if (phaseWrap !== 0) {
            const targetAngle = Math.round(walkPhase / Math.PI) * Math.PI;
            walkPhase += (targetAngle - walkPhase) * 0.18 * timeScale;
          }

          if (activeRidingBoat || activeRidingMech) {
            const rawH = getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
            const feetRadiusBefore = (playerCenterRadius !== null) ? (playerCenterRadius - 0.46 * charScale) : (RADIUS + rawH * HEIGHT_SCALE);
            const caveData = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(nx, ny, nz, feetRadiusBefore) : { ground: RADIUS + rawH * HEIGHT_SCALE, ceiling: Infinity, insideTunnel: false };
            const tRadius = caveData.ground;
            if (activeRidingMech) {
              playerCenterRadius = tRadius + (typeof window.mechSeatOffset !== "undefined" ? window.mechSeatOffset : 0.71);
            } else if (activeRidingBoat) {
              const baseRadius = (waterEnabled && tRadius < waterRadius) ? waterRadius : tRadius;
              let bR = activeRidingBoat.currentRadius !== undefined ? activeRidingBoat.currentRadius : (baseRadius - 0.04);
              playerCenterRadius = bR + 0.46 * charScale;
            }
            isPlayerGrounded = true;
            playerVerticalVel = 0.0;
          } else {
            // Enforce cave & terrain collision checks even when horizontally stationary,
            // so manual diving (Shift / Z) or water bobbing respects cave ceilings/floors and 3D mesh collisions.
            const P_curr = [nx, ny, nz];
            const collisionResult = checkCaveAndTerrainCollision(
              P_curr,
              P_curr,
              playerCenterRadius,
              charScale,
              currentSwimFactor,
              waterRadius,
              playerDiveDepth,
              swimMovementFactor,
              charHeight
            );
            
            playerCenterRadius = collisionResult.playerCenterRadius;
            playerDiveDepth = collisionResult.playerDiveDepth;
            isDivingMode = collisionResult.isDivingMode;

            // Apply horizontal push from 3D mesh cave colliders if applicable
            const P_new = collisionResult.P_new;
            if (Math.abs(P_new[0] - P_curr[0]) > 0.000001 || 
                Math.abs(P_new[1] - P_curr[1]) > 0.000001 || 
                Math.abs(P_new[2] - P_curr[2]) > 0.000001) {
              
              charTheta = Math.acos(Math.max(-1, Math.min(1, P_new[1])));
              charTheta = Math.max(1e-5, Math.min(Math.PI - 1e-5, charTheta));

              charPhi = Math.atan2(P_new[2], P_new[0]);
              if (charPhi < 0) charPhi += Math.PI * 2;

              sinTheta = Math.sin(charTheta);
              cosTheta = Math.cos(charTheta);
              sinPhi = Math.sin(charPhi);
              cosPhi = Math.cos(charPhi);

              nx = sinTheta * cosPhi;
              ny = cosTheta;
              nz = sinTheta * sinPhi;
            }
          }

          localUp = [nx, ny, nz];

          North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
          East = [-sinPhi, 0, cosPhi];

          const planetCoreStationary = (typeof window.getPlanetCorePosition === "function") ? window.getPlanetCorePosition() : (window.PLANET_CORE_POS || [0, 0, 0]);
          px = planetCoreStationary[0] + playerCenterRadius * nx;
          py = planetCoreStationary[1] + playerCenterRadius * ny;
          pz = planetCoreStationary[2] + playerCenterRadius * nz;

          if (activeRidingBoat && typeof boatRowTimer !== "undefined") {
            let target = Math.round(boatRowTimer / Math.PI) * Math.PI;
            boatRowTimer += (target - boatRowTimer) * 0.1;
          }
        }
        
        if ((cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") && isUsingItem && activeItem && activeItem.name === "BOW") {
          let targetHeading = rotationY;
          if (activeTargetNPC && activeTargetNPC.position) {
              const npc = activeTargetNPC;
              const npc_pos = npc.position;
              const npcLen = Math.sqrt(npc_pos[0]**2 + npc_pos[1]**2 + npc_pos[2]**2);
              const n_npc = npcLen > 0.1 ? [npc_pos[0]/npcLen, npc_pos[1]/npcLen, npc_pos[2]/npcLen] : [nx, ny, nz];
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
              const target_world_x = npc_pos[0] + N[0] * upOffset + F[0] * forwardOffset;
              const target_world_y = npc_pos[1] + N[1] * upOffset + F[1] * forwardOffset;
              const target_world_z = npc_pos[2] + N[2] * upOffset + F[2] * forwardOffset;

              const dx = target_world_x - px;
              const dy = target_world_y - py;
              const dz = target_world_z - pz;
              
              // Project relative vector to target onto North/East tangent plane
              const t_proj_North = dx * North[0] + dy * North[1] + dz * North[2];
              const t_proj_East = dx * East[0] + dy * East[1] + dz * East[2];
              targetHeading = Math.atan2(t_proj_East, t_proj_North);

              // Smoothly auto-rotate camera (both rotationY and rotationX) to track the target NPC!
              const d_up = dx * nx + dy * ny + dz * nz;
              const d_dist_planar = Math.sqrt(dx**2 + dy**2 + dz**2 - d_up**2);
              if (d_dist_planar > 0.05) {
                  const targetCamX = -Math.atan2(d_up, d_dist_planar);
                  let diffCamY = targetHeading - rotationY;
                  while (diffCamY < -Math.PI) diffCamY += Math.PI * 2;
                  while (diffCamY > Math.PI) diffCamY -= Math.PI * 2;
                  
                  // Smoothly guide camera to face the target
                  rotationY += diffCamY * 0.35 * timeScale;
                  rotationX += (targetCamX - rotationX) * 0.35 * timeScale;
                  rotationX = Math.max(-0.55, Math.min(1.2, rotationX));
              }
          }
          
          let diffHeading = targetHeading - charHeading;
          while (diffHeading < -Math.PI) diffHeading += Math.PI * 2;
          while (diffHeading > Math.PI) diffHeading -= Math.PI * 2;
          // When aiming, character quickly turns to face target
          charHeading += diffHeading * 0.4 * timeScale;
        } else {
            activeTargetNPC = null;
        }

        if (activeRidingBoat) {
            const wRadius = RADIUS + waterLevel * 0.15;
            let height = getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
            let feetBeforeBoat = activeRidingBoat.currentRadius || (playerCenterRadius ? (playerCenterRadius - 0.46 * charScale) : (RADIUS + height * HEIGHT_SCALE));
            const caveDataBoat = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(nx, ny, nz, feetBeforeBoat) : { ground: RADIUS + height * HEIGHT_SCALE, ceiling: Infinity, insideTunnel: false };
            let tRadius = caveDataBoat.ground;
            
            // If water is disabled or terrain is higher than water, float on terrain instead of water
            let isBoatInWater = waterEnabled && (tRadius < wRadius) && ((wRadius - tRadius) > 0.3 * charScale);
            activeRidingBoat.isInWater = isBoatInWater;
            let baseRadius = (waterEnabled && tRadius < wRadius) ? wRadius : tRadius;
            if (waterEnabled && tRadius < wRadius) {
                const wave = getWaterWave(nx * wRadius, ny * wRadius, nz * wRadius, waterAnimTime, waveStrength);
                let depth = wRadius - tRadius;
                let fade = Math.min(1.0, Math.max(0.0, depth / 0.1));
                baseRadius += wave * fade;
            }
            
            let isLandVehicle = activeRidingBoat.hasWheel || activeRidingBoat.hasWheels || (activeRidingBoat.wheelCount && activeRidingBoat.wheelCount > 0);

            // Recalculate F_3d and R for the boat based on the updated charHeading and nx,ny,nz
            let cNorth = [-Math.cos(charTheta) * Math.cos(charPhi), Math.sin(charTheta), -Math.cos(charTheta) * Math.sin(charPhi)];
            let cEast = [-Math.sin(charPhi), 0, Math.cos(charPhi)];
            let bF = [
                cNorth[0] * Math.cos(charHeading) + cEast[0] * Math.sin(charHeading),
                cNorth[1] * Math.cos(charHeading) + cEast[1] * Math.sin(charHeading),
                cNorth[2] * Math.cos(charHeading) + cEast[2] * Math.sin(charHeading)
            ];
            let bR_vec = [
                cEast[0] * Math.cos(charHeading) - cNorth[0] * Math.sin(charHeading),
                cEast[1] * Math.cos(charHeading) - cNorth[1] * Math.sin(charHeading),
                cEast[2] * Math.cos(charHeading) - cNorth[2] * Math.sin(charHeading)
            ];

            let bR;
            if (isBoatInWater) {
                // BOAT IN WATER: Keep exact original water submersion depth (-0.04)
                bR = baseRadius - 0.04;
                activeRidingBoat.currentRadius = bR;
                activeRidingBoat.verticalVel = 0;
                activeRidingBoat.pitchGrade = 0;
                activeRidingBoat.normal = [nx, ny, nz];
            } else if (isLandVehicle) {
                // WHEELED VEHICLE ON LAND: calculate wheeled vehicle physics
                const vehicleTransform = Physics.calculateLandBoatTransform({
                    position: [tRadius * nx, tRadius * ny, tRadius * nz],
                    nx, ny, nz,
                    F: bF,
                    R: bR_vec,
                    baseRadius: tRadius,
                    waterEnabled,
                    waterLevel,
                    waterAnimTime,
                    waveStrength,
                    hasWheels: true,
                    isInWater: false
                });

                let targetGroundRadius = vehicleTransform.targetGroundRadius;
                activeRidingBoat.pitchGrade = vehicleTransform.pitchGrade;
                activeRidingBoat.normal = vehicleTransform.normal;
                bF = vehicleTransform.F;
                bR_vec = vehicleTransform.R;

                if (activeRidingBoat.currentRadius === undefined) {
                    activeRidingBoat.currentRadius = targetGroundRadius;
                    activeRidingBoat.verticalVel = 0;
                }
                
                // Apply Gravity
                activeRidingBoat.verticalVel = Physics.applyVerticalGravity(activeRidingBoat.verticalVel, 1.0, Physics.gravityAccel);
                activeRidingBoat.currentRadius += activeRidingBoat.verticalVel;
                
                // Ground collision
                if (activeRidingBoat.currentRadius <= targetGroundRadius) {
                    activeRidingBoat.currentRadius = targetGroundRadius;
                    activeRidingBoat.verticalVel = 0;
                }
                
                bR = activeRidingBoat.currentRadius;
            } else {
                // NON-WHEELED BOAT ON LAND: sits flush touching the ground / floor
                let landGroundRad = tRadius;
                if (typeof Physics !== "undefined" && typeof Physics.getFloorSurfaceRadiusAt === "function") {
                    landGroundRad = Physics.getFloorSurfaceRadiusAt(nx * tRadius, ny * tRadius, nz * tRadius, tRadius);
                }
                bR = landGroundRad + 0.002;
                activeRidingBoat.currentRadius = bR;
                activeRidingBoat.verticalVel = 0;
                activeRidingBoat.pitchGrade = 0;
                activeRidingBoat.normal = [nx, ny, nz];
            }

            activeRidingBoat.position = [bR * nx, bR * ny, bR * nz];
            playerCenterRadius = bR + 0.46 * charScale;
            px = playerCenterRadius * nx;
            py = playerCenterRadius * ny;
            pz = playerCenterRadius * nz;

            activeRidingBoat.angle = undefined; // clear fixed placement angle
            activeRidingBoat.F = bF;
            activeRidingBoat.R = bR_vec;
        } else if (activeRidingMech) {
            let height = getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
            const mechOffsetRendering = typeof window.mechSeatOffset !== "undefined" ? window.mechSeatOffset : 0.71;
            let feetBeforeMech = (playerCenterRadius !== null) ? (playerCenterRadius - mechOffsetRendering) : (RADIUS + height * HEIGHT_SCALE);
            const caveDataMech = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(nx, ny, nz, feetBeforeMech) : { ground: RADIUS + height * HEIGHT_SCALE, ceiling: Infinity, insideTunnel: false };
            let tRadius = caveDataMech.ground;
            const isMechWalking = typeof isWalking !== "undefined" && isWalking;
            const wPhase = typeof walkPhase !== "undefined" ? walkPhase : 0.0;
            const stepBob = 0.0; // Steady mech height to keep camera smooth
            const hasLegs = activeRidingMech.attachedParts && activeRidingMech.attachedParts.some(entry =>
              entry.item && entry.item.active && entry.item.type && entry.item.type.includes("leg")
            );
            const mechHeight = (activeRidingMech.dockedStand || hasLegs) ? 0.66 : 0.20;
            const mR = tRadius + mechHeight + stepBob;
            activeRidingMech.position = [mR * nx, mR * ny, mR * nz];
            activeRidingMech.normal = [nx, ny, nz];
            activeRidingMech.angle = undefined;

            let cNorth = [-Math.cos(charTheta) * Math.cos(charPhi), Math.sin(charTheta), -Math.cos(charTheta) * Math.sin(charPhi)];
            let cEast = [-Math.sin(charPhi), 0, Math.cos(charPhi)];
            activeRidingMech.F = [
                cNorth[0] * Math.cos(charHeading) + cEast[0] * Math.sin(charHeading),
                cNorth[1] * Math.cos(charHeading) + cEast[1] * Math.sin(charHeading),
                cNorth[2] * Math.cos(charHeading) + cEast[2] * Math.sin(charHeading)
            ];
            activeRidingMech.R = [
                cEast[0] * Math.cos(charHeading) - cNorth[0] * Math.sin(charHeading),
                cEast[1] * Math.cos(charHeading) - cNorth[1] * Math.sin(charHeading),
                cEast[2] * Math.cos(charHeading) - cNorth[2] * Math.sin(charHeading)
            ];

            if (activeRidingMech.attachedParts) {
                // Ensure robot_stand is never in attachedParts
                activeRidingMech.attachedParts = activeRidingMech.attachedParts.filter(entry => entry.item && entry.item.type !== "robot_stand");

                const candidateParts = (typeof SpatialGrid !== "undefined")
                  ? SpatialGrid.queryRadius(activeRidingMech.position[0], activeRidingMech.position[1], activeRidingMech.position[2], 1.75, p => p.active && !p.isPreview && p.type.startsWith("robot_") && p.type !== "robot_stand" && p !== activeRidingMech)
                  : (typeof collectibles !== "undefined" && collectibles ? collectibles : []);

                for (let p of candidateParts) {
                    if (p.active && !p.isPreview && p.type.startsWith("robot_") && p.type !== "robot_stand" && p !== activeRidingMech) {
                            if (!activeRidingMech.attachedParts.some(entry => entry.item === p)) {
                                const dx = p.position[0] - activeRidingMech.position[0];
                                const dy = p.position[1] - activeRidingMech.position[1];
                                const dz = p.position[2] - activeRidingMech.position[2];
                                if (dx*dx + dy*dy + dz*dz < 3.0) {
                                    p.isDynamic = true;
                                    const cR = activeRidingMech.R || [1,0,0];
                                    const cN = activeRidingMech.normal || activeRidingMech.U || [0,1,0];
                                    const cF = activeRidingMech.F || [0,0,1];

                                    let localR = dx * cR[0] + dy * cR[1] + dz * cR[2];
                                    let localN = dx * cN[0] + dy * cN[1] + dz * cN[2];
                                    let localF = dx * cF[0] + dy * cF[1] + dz * cF[2];

                                    activeRidingMech.attachedParts.push({
                                        item: p,
                                        localR: localR,
                                        localN: localN,
                                        localF: localF
                                    });
                                }
                            }
                        }
                    }

                for (let entry of activeRidingMech.attachedParts) {
                    let p = entry.item;
                    if (!p || !p.active) continue;

                    let pitchAngle = 0.0;
                    let kneeAngle = 0.0;
                    let elbowAngle = 0.20;

                    if (isMechWalking) {
                        if (p.type === "robot_left_leg") {
                            pitchAngle = Math.sin(wPhase) * 0.38;
                            let rawBend = Math.max(0, -Math.sin(wPhase + 0.2));
                            kneeAngle = Math.pow(rawBend, 1.2) * 0.65;
                        } else if (p.type === "robot_right_leg") {
                            pitchAngle = Math.sin(wPhase + Math.PI) * 0.38;
                            let rawBend = Math.max(0, -Math.sin(wPhase + Math.PI + 0.2));
                            kneeAngle = Math.pow(rawBend, 1.2) * 0.65;
                        } else if (p.type === "robot_left_arm") {
                            pitchAngle = Math.sin(wPhase + Math.PI) * 0.42;
                            let swingFwd = Math.sin(wPhase + Math.PI);
                            elbowAngle = 0.20 + Math.max(0, swingFwd) * 0.55;
                        } else if (p.type === "robot_right_arm") {
                            pitchAngle = Math.sin(wPhase) * 0.42;
                            let swingFwd = Math.sin(wPhase);
                            elbowAngle = 0.20 + Math.max(0, swingFwd) * 0.55;
                        }
                    }

                    p.kneeAngle = kneeAngle;
                    p.elbowAngle = elbowAngle;

                    const isLeg = p.type.includes("leg");
                    const isArm = p.type.includes("arm");

                    const csScale = (typeof p.size === "number" ? p.size : 1.0) * 1.5;

                    let curR = entry.localR;
                    let curN = entry.localN;
                    let curF = entry.localF;

                    const cosP = Math.cos(pitchAngle);
                    const sinP = Math.sin(pitchAngle);

                    if (isLeg || isArm) {
                        const jointOffN = isLeg ? 0.85 * csScale : 0.90 * csScale;
                        curN = entry.localN + jointOffN * (1.0 - cosP);
                        curF = entry.localF - jointOffN * sinP;
                    }

                    p.position = [
                        activeRidingMech.position[0] + activeRidingMech.R[0]*curR + activeRidingMech.normal[0]*curN + activeRidingMech.F[0]*curF,
                        activeRidingMech.position[1] + activeRidingMech.R[1]*curR + activeRidingMech.normal[1]*curN + activeRidingMech.F[1]*curF,
                        activeRidingMech.position[2] + activeRidingMech.R[2]*curR + activeRidingMech.normal[2]*curN + activeRidingMech.F[2]*curF
                    ];

                    const mN = activeRidingMech.normal;
                    const mF = activeRidingMech.F;
                    const mR = activeRidingMech.R;

                    p.R = [mR[0], mR[1], mR[2]];
                    p.normal = [
                        mN[0] * cosP + mF[0] * sinP,
                        mN[1] * cosP + mF[1] * sinP,
                        mN[2] * cosP + mF[2] * sinP
                    ];
                    p.F = [
                        -mN[0] * sinP + mF[0] * cosP,
                        -mN[1] * sinP + mF[1] * cosP,
                        -mN[2] * sinP + mF[2] * cosP
                    ];
                }

                let poseChanged = isMechWalking || activeRidingMech._lastWalkPhase !== wPhase;
                if (activeRidingMech._lastWalkState !== isMechWalking) {
                    poseChanged = true;
                    activeRidingMech._lastWalkState = isMechWalking;
                }
                activeRidingMech._lastWalkPhase = isMechWalking ? wPhase : null;

                if (poseChanged || activeRidingMech._forceVBORefresh) {
                    activeRidingMech._forceVBORefresh = false;
                    if (typeof refreshCollectiblesVBO === "function") {
                        refreshCollectiblesVBO('dynamic');
                    }
                }
            }
        }

        // Smoothly update swimMovementFactor based on current state
        if (currentSwimFactor > 0.0) {
          if (isWalking) {
            swimMovementFactor += (1.0 - swimMovementFactor) * 0.08 * timeScale;
          } else {
            swimMovementFactor += (0.0 - swimMovementFactor) * 0.08 * timeScale;
            }
          } else {
          swimMovementFactor += (0.0 - swimMovementFactor) * 0.12 * timeScale;
        }

        // Update swim sound
        if (isSwimAudioInitialized) {
          updateSwimSound(
            currentSwimFactor,
            swimMovementFactor,
            walkPhase,
            lastIsCameraUnderwater,
          );
        }

        // Update wheeled boat rolling sound (only on land, not on water)
        if (typeof updateWheeledBoatSound === "function") {
          let isBoatOnWater = activeRidingBoat ? (activeRidingBoat.isInWater !== undefined ? activeRidingBoat.isInWater : (waterEnabled && (waterRadius - terrainRadius) > 0.35 * charScale)) : false;
          updateWheeledBoatSound(activeRidingBoat, timeScale, isBoatOnWater);
        }

        // Update footstep / splash sound
        if (isWalking) {
          if (currentSwimFactor === 0.0) {
            if (walkPhase - lastFootstepPhase >= Math.PI / 2) {
              playFootstepSound(1.0, true);
              lastFootstepPhase = walkPhase;
            }
          } else {
            // Swimming or wading
            // For swimming, the arms move at phase * 1.5
            const swimPhase = walkPhase * 1.5;
            const lastSwimPhase = lastFootstepPhase * 1.5;
            if (swimPhase - lastSwimPhase >= Math.PI) {
              if (!lastIsCameraUnderwater) {
                playSplashSound(0.5 + currentSwimFactor * 0.5, true);
              } else {
                playUnderwaterSwimSound(0.5 + currentSwimFactor * 0.5, true);
              }
              lastFootstepPhase = walkPhase;
            }
            }
          } else {
          lastFootstepPhase = walkPhase;
        }

        const charInterval = 1000 / charAnimFps;
        const needsEveryFrame = ragdollEnabled;
        
        if (!isPlayerGrounded && !ragdollEnabled && !activeRidingBoat && !activeRidingMech && currentSwimFactor === 0.0) {
            jumpBlend = Math.min(1.0, jumpBlend + 10.0 * dt);
        } else {
            jumpBlend = Math.max(0.0, jumpBlend - 15.0 * dt);
        }
        
        if (needsEveryFrame || timestamp - lastCharAnimTime >= charInterval) {
          updateCharacterMesh(walkPhase);
          if (!needsEveryFrame) {
            lastCharAnimTime =
              timestamp - ((timestamp - lastCharAnimTime) % charInterval);
          }
        }

        let eyePos;
        let viewMatrix;

        if (cameraMode !== "tps" && cameraMode !== "thirdperson" && cameraMode !== "fps" && cameraMode !== "freecam" && cameraMode !== "planet" && cameraMode !== "sun" && cameraMode !== "satellite" && cameraMode !== "overview" && cameraMode !== "solarsystem" && cameraMode !== "spacesmap_overview" && !(cameraMode && (cameraMode.startsWith("extra_planet_") || cameraMode.startsWith("planet_")))) {
          cameraMode = "thirdperson";
        }

        if (cameraSpringArm) {
          const currentNorth = [
            -cosTheta * cosPhi,
            sinTheta,
            -cosTheta * sinPhi,
          ];
          const currentEast = [-sinPhi, 0, cosPhi];

          cameraSpringArm.setMode(cameraMode);
          cameraSpringArm.update(
            dt,
            [px, py, pz],
            localUp,
            currentNorth,
            currentEast,
            rotationX,
            rotationY,
            zoom,
            charScale,
            waterRadius,
            cameraCollisionEnabled
          );
          eyePos = cameraSpringArm.eyePos;
          viewMatrix = cameraSpringArm.viewMatrix;
        } else {
          eyePos = [px, py, pz];
          const planetCoreFallback = (typeof window.getPlanetCorePosition === "function") ? window.getPlanetCorePosition() : (window.PLANET_CORE_POS || [0, 0, 0]);
          viewMatrix = createLookAt(eyePos, planetCoreFallback, [0, 1, 0]);
        }

        window.eyePos = eyePos;
        window.player3DPos = [px, py, pz];
        window.rotationY = rotationY;

        const activePlanetCore = (typeof window.getPlanetCorePosition === "function") ? window.getPlanetCorePosition() : (window.PLANET_CORE_POS || [0, 0, 0]);
        const relCamX = eyePos[0] - activePlanetCore[0];
        const relCamY = eyePos[1] - activePlanetCore[1];
        const relCamZ = eyePos[2] - activePlanetCore[2];
        const camDist = Math.sqrt(relCamX * relCamX + relCamY * relCamY + relCamZ * relCamZ);
        let isCameraUnderwater = camDist < waterRadius;
        lastIsCameraUnderwater = isCameraUnderwater;

        // คำนวณทิศทางแสงวงโคจรของดวงอาทิตย์ (หมุนตามวงโคจร)
        const orbitSpeed = (typeof window !== "undefined" && typeof window.dayNightOrbitSpeed === "number") ? window.dayNightOrbitSpeed : 0.01; // ความเร็วของดวงอาทิตย์ (0.01 ให้เวลา 1 วันประมาณ 10 นาทีครึ่ง)
        const orbitAngle = waterTime * orbitSpeed;
        const baseLightDir = [0.8, 0.45, 0.4];
        const baseLen = Math.sqrt(
          baseLightDir[0] * baseLightDir[0] +
            baseLightDir[1] * baseLightDir[1] +
            baseLightDir[2] * baseLightDir[2],
        );
        const normalizedBase = [
          baseLightDir[0] / baseLen,
          baseLightDir[1] / baseLen,
          baseLightDir[2] / baseLen,
        ];

        // หมุนรอบแกน Y เพื่อจำลองวงโคจร
        const cosO = Math.cos(orbitAngle);
        const sinO = Math.sin(orbitAngle);
        const currentLightDir = [
          normalizedBase[0] * cosO - normalizedBase[2] * sinO,
          normalizedBase[1], // รักษาระดับความสูงแนวตั้งเฉียงไว้สวยงาม
          normalizedBase[0] * sinO + normalizedBase[2] * cosO,
        ];
        const curLen = Math.sqrt(
          currentLightDir[0] * currentLightDir[0] +
            currentLightDir[1] * currentLightDir[1] +
            currentLightDir[2] * currentLightDir[2],
        );
        const finalLightDir = [
          currentLightDir[0] / curLen,
          currentLightDir[1] / curLen,
          currentLightDir[2] / curLen,
        ];
        window.finalLightDir = finalLightDir;
        const currentSunDist = RADIUS * 23481;
        window.sunDistance = currentSunDist;
        window.sunPosition = [
          finalLightDir[0] * currentSunDist,
          finalLightDir[1] * currentSunDist,
          finalLightDir[2] * currentSunDist,
        ];

        // อัปเดตตำแหน่งและรูปทรงเงามืดตามวงโคจรของแสงดวงอาทิตย์ (ใช้ระบบเงาคำนวณสดบน GPU ไม่ต้องรันฝั่ง CPU แล้ว)

        const aspect = canvas.width / canvas.height;
        const modelMatrix = createIdentity();
        const modelViewMatrix = multiplyMatrices(viewMatrix, modelMatrix);
        const isFreeCam = cameraMode === "freecam";
        const dynamicNear = isFreeCam ? 0.08 : (window.cameraNearPlane || 0.05);
        const dynamicFar = isFreeCam ? 50000.0 : Math.max(2500, (typeof RADIUS !== "undefined" ? RADIUS : 8.0) * 30.0);
        const projMatrix = createPerspective(Math.PI / 4, aspect, dynamicNear, dynamicFar);

        // TAAU (Temporal Anti-Aliasing Upsampling) sub-pixel temporal jittering
        // Only apply sub-pixel jitter when a temporal history accumulation pass is actively resolving frames,
        // otherwise raw jitter causes continuous 60fps screen vibration/shaking.
        if (typeof taauEnabled !== "undefined" && taauEnabled && typeof window.taauHistoryResolveReady !== "undefined" && window.taauHistoryResolveReady) {
          if (typeof window.taauJitterFrame === "undefined") window.taauJitterFrame = 0;
          window.taauJitterFrame = (window.taauJitterFrame + 1) % 8;
          const halton2 = [0.5, 0.25, 0.75, 0.125, 0.625, 0.375, 0.875, 0.0];
          const halton3 = [0.333, 0.666, 0.111, 0.444, 0.777, 0.222, 0.555, 0.0];
          const jx = ((halton2[window.taauJitterFrame] - 0.5) / Math.max(1, canvas.width)) * 2.0;
          const jy = ((halton3[window.taauJitterFrame] - 0.5) / Math.max(1, canvas.height)) * 2.0;
          projMatrix[8] += jx;
          projMatrix[9] += jy;
        }

        // Extract frustum planes for Frustum Culling
        frustumPlanes = null;
        if (typeof FrustumCullingSystem !== "undefined" && FrustumCullingSystem.updateFrustumPlanesFromPV) {
          frustumPlanes = FrustumCullingSystem.updateFrustumPlanesFromPV(projMatrix, viewMatrix, frustumCullingEnabled);
        } else if (typeof FrustumCullingSystem !== "undefined" && FrustumCullingSystem.updateFrustumPlanes) {
          const vp = typeof FrustumCullingSystem.multiplyMat4 === "function" ? FrustumCullingSystem.multiplyMat4(projMatrix, viewMatrix) : multiplyMatrices(projMatrix, viewMatrix);
          frustumPlanes = FrustumCullingSystem.updateFrustumPlanes(vp, frustumCullingEnabled);
        } else if (frustumCullingEnabled && typeof getFrustumPlanes === "function") {
          const vp = multiplyMatrices(projMatrix, viewMatrix);
          frustumPlanes = getFrustumPlanes(vp);
        }
        
        // Render WebGPU Migrated Parts
        // Old WebGPU hook removed

        // Check interaction distance for UI prompt
        if (!_cachedInteractPrompt) _cachedInteractPrompt = document.getElementById("interactPrompt");
        const prompt = _cachedInteractPrompt;
        if (prompt) {
          const px = charTheta;
          const py = charPhi;
          const r_terrain = RADIUS + getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) * HEIGHT_SCALE;
          const r = typeof playerCenterRadius !== 'undefined' && playerCenterRadius !== null ? playerCenterRadius - 0.46 * playerScale : r_terrain;
          const pVec = [
            r * Math.sin(px) * Math.cos(py),
            r * Math.cos(px),
            r * Math.sin(px) * Math.sin(py),
          ];
          if (isDemolishModeEnabled) {
            const demolishableTypes = ["wood_floor", "thin_wood_floor", "stone_floor", "wood_stairs", "campfire", "wood_boat", "wood_wheel", "wood_wall", "wood_window", "wood_door", "wood_chest", "meganeura_item", "isopod_item"];
            let closestDemolishItem = null;
            let minDemolishDist = actionReachDistance;
            let currentBestDist = Infinity;
            const maxDemolishReach = Math.max(actionReachDistance, 0.15 * (playerScale / 0.1)) + 1.5;
            const candidates = (typeof SpatialGrid !== "undefined")
              ? SpatialGrid.queryRadius(pVec[0], pVec[1], pVec[2], maxDemolishReach, item => item.active && !item.isPreview && item.position && demolishableTypes.includes(item.type))
              : collectibles;

            for (let item of candidates) {
              if (!item.active || item.isPreview || !item.position) continue;
              if (demolishableTypes.includes(item.type)) {
                const reachInfo = isTargetWithinReach(item.position, Math.max(actionReachDistance, 0.15 * (playerScale / 0.1)));
                if (reachInfo.valid) {
                  if (reachInfo.t < currentBestDist) {
                    currentBestDist = reachInfo.t;
                    closestDemolishItem = item;
                  }
                }
              }
            }
            if (closestDemolishItem) {
              const isStoneFloor = closestDemolishItem.type === "stone_floor";
              if (isStoneFloor) {
                const isHeld = isActionDown && (document.pointerLockElement === canvas || window.simulatedPointerLock);
                if (isHeld) {
                  demolishHoldTimer += delta / 1000;
                  if (demolishHoldTimer >= 1.0) {
                    demolishHoldTimer = 0.0;
                    tryDemolishItem(closestDemolishItem);
            }
          } else {
                  demolishHoldTimer = 0.0;
            }
          } else {
                demolishHoldTimer = 0.0;
              }

              const screenPos = projectWorldToScreen(
                closestDemolishItem.position,
                viewMatrix,
                projMatrix,
                window.innerWidth,
                window.innerHeight,
              );
              if (screenPos) {
                let holdPercent = 0;
                let instructionsHTML = "";
                if (isStoneFloor) {
                  holdPercent = Math.min(100, Math.floor((demolishHoldTimer / 1.0) * 100));
                  instructionsHTML = `
                    <strong>🔨 โหมดรื้อถอน (DEMOLISH MODE)</strong><br/>
                    กดคลิกซ้ายค้าง เพื่อรื้อถอน STONE FLOOR<br/>
                    <span style="font-size: 10px; opacity: 0.9; display: block; margin-top: 2px;">Hold Left-click to demolish STONE FLOOR</span>
                  `;
                } else {
                  instructionsHTML = `
                    <strong>🔨 โหมดรื้อถอน (DEMOLISH MODE)</strong><br/>
                    คลิกซ้าย เพื่อรื้อถอน ${closestDemolishItem.type.toUpperCase().replace("_", " ")}<br/>
                    <span style="font-size: 10px; opacity: 0.9; display: block; margin-top: 2px;">Left-click to demolish ${closestDemolishItem.type.toUpperCase().replace("_", " ")}</span>
                  `;
                }

                const _newHtml_1 = `<div style="margin: -8px -16px; padding: 8px 16px; position: relative; overflow: hidden; border-radius: 8px; background: rgba(220, 38, 38, 0.95); border: 1px solid #ff4d4d; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                  ${isStoneFloor ? `<div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${holdPercent}%; background: rgba(255, 255, 255, 0.35); pointer-events: none; transition: width 0.05s ease-out;"></div>` : ""}
                  <div style="position: relative; z-index: 1; text-align: center; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #ffffff;">
                    ${instructionsHTML}
                    <span style="font-size: 9px; opacity: 0.8; display: block; margin-top: 4px;">ระยะห่าง / Distance: ${currentBestDist.toFixed(2)} / ${minDemolishDist.toFixed(2)}</span>
                  </div>
                </div>`;
if (prompt._lastHTML !== _newHtml_1) {
    prompt.innerHTML = _newHtml_1;
    prompt._lastHTML = _newHtml_1;
}
                if (prompt.style.display !== "block") prompt.style.display = "block";
                const newT = `translate(${Math.round(screenPos.x)}px, ${Math.round(screenPos.y - 45 )}px) translate(-50%, -100%)`;
                  if (prompt._lastT !== newT) {
                      prompt.style.transform = newT;
                      prompt._lastT = newT;
                  }
              } else {
                if (prompt.style.display !== "none") prompt.style.display = "none";
            }
          } else {
              demolishHoldTimer = 0.0;
              if (prompt.style.display !== "none") prompt.style.display = "none";
            }
          } else if (false) {
            // Disabled orange terrain mod banner
            demolishHoldTimer = 0.0;
            const _newHtml_2 = `<div style="margin: -8px -16px; padding: 10px 20px; position: relative; overflow: hidden; border-radius: 8px; background: rgba(230, 81, 0, 0.95); border: 1px solid #ff9800; box-shadow: 0 4px 12px rgba(0,0,0,0.5); text-align: center; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #ffffff;">
              <strong>⛏️ โหมดปรับแต่งพื้นผิวดาว (TERRAIN MOD MODE)</strong><br/>
              คลิกซ้าย: ขุดหลุม / Left-click: Dig<br/>
              คลิกขวา: ถมดิน / Right-click: Raise
            </div>`;
if (prompt._lastHTML !== _newHtml_2) {
    prompt.innerHTML = _newHtml_2;
    prompt._lastHTML = _newHtml_2;
}
            if (prompt.style.display !== "block") prompt.style.display = "block";
            const newT = `translate(50vw, 80vh) translate(-50%, -100%)`;
            if (prompt._lastT !== newT) {
                prompt.style.transform = newT;
                prompt._lastT = newT;
            }
          } else {
            demolishHoldTimer = 0.0;
            if (activeRidingBoat) {
              let rLen = Math.sqrt(activeRidingBoat.position[0]**2 + activeRidingBoat.position[1]**2 + activeRidingBoat.position[2]**2) || 1;
              let bTheta = Math.acos(Math.max(-1, Math.min(1, activeRidingBoat.position[1] / rLen)));
              let bPhi = Math.atan2(activeRidingBoat.position[2], activeRidingBoat.position[0]);
              let bHeight = getHeightOnSphere(bTheta, bPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
              let bTerrainRadius = RADIUS + bHeight * HEIGHT_SCALE;
              const bWaterRadius = RADIUS + waterLevel * 0.15;
              const bDepth = bWaterRadius - bTerrainRadius;
              const hasWheels = activeRidingBoat.hasWheel || activeRidingBoat.hasWheels || (activeRidingBoat.wheelCount && activeRidingBoat.wheelCount > 0);
              const canRideBoat = (waterEnabled && bDepth > 0.48 * playerScale) || hasWheels;

              const isInteractHeld = keysPressed[currentKeyBindings.interact] || keysPressed["KeyE"];
              if (isInteractHeld) {
                chestHoldTimer += delta / 1000;
                if (chestHoldTimer >= 0.8) {
                  chestHoldTimer = 0.0;
                  const boatToDismount = activeRidingBoat;
                  // Dismounting - place player slightly to the right side of the boat to prevent collision trapping
                  if (boatToDismount.R) {
                     const sideOffset = 0.45;
                     const p3d = [
                       boatToDismount.position[0] + boatToDismount.R[0] * sideOffset,
                       boatToDismount.position[1] + boatToDismount.R[1] * sideOffset,
                       boatToDismount.position[2] + boatToDismount.R[2] * sideOffset
                     ];
                     const pLen = Math.sqrt(p3d[0]*p3d[0] + p3d[1]*p3d[1] + p3d[2]*p3d[2]) || 1;
                     charTheta = Math.acos(Math.max(-1.0, Math.min(1.0, p3d[1] / pLen)));
                     charPhi = Math.atan2(p3d[2], p3d[0]);
                     if (charPhi < 0) charPhi += Math.PI * 2;

                     const pnx = p3d[0] / pLen, pny = p3d[1] / pLen, pnz = p3d[2] / pLen;
                     const pFeetRad = (playerCenterRadius !== null) ? (playerCenterRadius - 0.46 * playerScale) : (pLen - 0.46 * playerScale);
                     const pCaveData = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(pnx, pny, pnz, pFeetRad) : null;
                     const pGroundRad = pCaveData ? pCaveData.ground : (RADIUS + bHeight * HEIGHT_SCALE);
                     playerCenterRadius = pGroundRad + 0.46 * playerScale;
                     isPlayerGrounded = true;
                     playerVerticalVel = 0.0;
                  }
                  boatToDismount.isDynamic = true;
                  boatToDismount.vel = [0, 0, 0];
                  activeRidingBoat = null;
                  if (typeof World3DUI !== "undefined" && World3DUI.hasSign("boat_world_sign")) {
                    World3DUI.removeSign("boat_world_sign");
                  }
                  if (typeof stopWheeledBoatSound === "function") stopWheeledBoatSound();
            }
          } else {
                chestHoldTimer = 0.0;
              }
              const holdPercent = Math.min(100, Math.floor((chestHoldTimer / 0.8) * 100));
              let actionText = "ลงจากเรือ<br>Dismount Boat";
              let isBoatInWater = waterEnabled && (bTerrainRadius < bWaterRadius) && (bDepth > 0.48 * playerScale);
              let extraStatus = "";
              if (!isBoatInWater) {
                if (!hasWheels) {
                  extraStatus = "<br><span style='font-size: 9px; color: #ffaa44;'>เรืออยู่บนบก - ติดล้อไม้เพื่อขับเคลื่อนเต็มที่<br>(On land - attach Wooden Wheels to drive)</span>";
                }
              } else if (!canRideBoat) {
                extraStatus = "<br><span style='font-size: 9px; color: #ff8888;'>น้ำตื้นเกินไป พายไม่ได้ (Too shallow to row)</span>";
              }
              
              const _newHtml_3 = `<div style="position: relative; width: 36px; height: 36px; padding: 1px; background: rgba(223, 183, 108, 0.55); clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px)); filter: drop-shadow(0 4px 15px rgba(0,0,0,0.6)); user-select: none; box-sizing: border-box;">
                <div style="position: relative; width: 100%; height: 100%; background: rgba(10, 10, 15, 0.88); backdrop-filter: blur(8px); clip-path: polygon(0 0, calc(100% - 5.5px) 0, 100% 5.5px, 100% 100%, 5.5px 100%, 0 calc(100% - 5.5px)); overflow: hidden; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">
                  <div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${holdPercent}%; background: rgba(223, 183, 108, 0.4); pointer-events: none; transition: width 0.05s ease-out;"></div>
                  <div style="position: relative; z-index: 1; text-align: center; font-size: 16px; font-family: 'JetBrains Mono', monospace; color: #dfb76c; font-weight: 900; line-height: 1; letter-spacing: 0.5px; user-select: none;">
                    E
                  </div>
                </div>
              </div>`;

              if (prompt && prompt.style.display !== "none") prompt.style.display = "none";
              
              if (activeRidingBoat) {
                let targetWorldPos = activeRidingBoat.position;
                let bf = activeRidingBoat.F || [0, 0, 1];
                let bn = activeRidingBoat.normal || [0, 1, 0];
                if (activeRidingBoat.position && activeRidingBoat.F && activeRidingBoat.normal) {
                    const backOffset = (typeof window.boatUiBackOffset !== 'undefined' ? window.boatUiBackOffset : 2.47) * playerScale;
                    const upOffset = (typeof window.boatUiUpOffset !== 'undefined' ? window.boatUiUpOffset : 0.43) * playerScale;
                    
                    if (activeRidingBoat.angle !== undefined && activeRidingBoat.angle !== 0 && activeRidingBoat.R) {
                        const cosH = Math.cos(activeRidingBoat.angle);
                        const sinH = Math.sin(activeRidingBoat.angle);
                        bf = [
                            activeRidingBoat.F[0] * cosH + activeRidingBoat.R[0] * sinH,
                            activeRidingBoat.F[1] * cosH + activeRidingBoat.R[1] * sinH,
                            activeRidingBoat.F[2] * cosH + activeRidingBoat.R[2] * sinH
                        ];
                    }
                    
                    targetWorldPos = [
                        activeRidingBoat.position[0] - bf[0] * backOffset + bn[0] * upOffset,
                        activeRidingBoat.position[1] - bf[1] * backOffset + bn[1] * upOffset,
                        activeRidingBoat.position[2] - bf[2] * backOffset + bn[2] * upOffset
                    ];
                }

                if (typeof World3DUI !== "undefined") {
                    const signNormal = [-bf[0], -bf[1], -bf[2]];
                    const signUp = [bn[0], bn[1], bn[2]];
                    const boatScale = (typeof window.boatUiScale === 'number' ? window.boatUiScale : 0.47);
                    const signW = 0.18 * boatScale * (playerScale / 0.1);
                    const signH = 0.18 * boatScale * (playerScale / 0.1);
                    const boatSignId = "boat_world_sign";
                    if (!World3DUI.hasSign(boatSignId)) {
                        World3DUI.createSign({
                            id: boatSignId,
                            position: targetWorldPos,
                            normal: signNormal,
                            up: signUp,
                            size: [signW, signH],
                            isScreenAligned: false,
                            backfaceCulling: false,
                            doubleSided: true,
                            checkOcclusion: false,
                            maxDistance: 35.0,
                            fadeDistance: 25.0,
                            visible: true,
                            content: _newHtml_3
                        });
                    } else {
                        World3DUI.updateSign(boatSignId, {
                            position: targetWorldPos,
                            normal: signNormal,
                            up: signUp,
                            size: [signW, signH],
                            isScreenAligned: false,
                            visible: true,
                            content: _newHtml_3
                        });
                    }
                }
              } else {
                if (typeof World3DUI !== "undefined" && World3DUI.hasSign("boat_world_sign") && !closestBoat) {
                    World3DUI.removeSign("boat_world_sign");
                }
                if (prompt.style.display !== "none") prompt.style.display = "none";
              }
            } else if (activeRidingMech) {
              window.tryAutoAssembleMechParts(activeRidingMech);
              const isInteractHeld = keysPressed[currentKeyBindings.interact] || keysPressed["KeyE"];

              if (activeRidingMech._nearbyStand && !activeRidingMech.dockedStand) {
                // Holding [E] near a robot stand re-docks the mech
                if (isInteractHeld) {
                  activeRidingMech._dockingTimer = (activeRidingMech._dockingTimer || 0) + delta / 1000;
                  chestHoldTimer = 0.0;
                  if (activeRidingMech._dockingTimer >= 0.8) {
                    activeRidingMech.dockedStand = activeRidingMech._nearbyStand;
                    activeRidingMech._dockingTimer = 0.0;
                    activeRidingMech._nearbyStand = null;
                    if (typeof showNotice === "function") {
                      showNotice("⚙️ กลับเข้าสู่โหมดประกอบกับฐานตั้งแล้ว / Docked to Stand");
                    }
                  }
                } else {
                  activeRidingMech._dockingTimer = 0.0;
                  chestHoldTimer = 0.0;
                }
              } else {
                activeRidingMech._dockingTimer = 0.0;
                if (isInteractHeld) {
                  chestHoldTimer += delta / 1000;
                  if (chestHoldTimer >= 0.8) {
                    chestHoldTimer = 0.0;
                    const mechToDismount = activeRidingMech;
                    if (mechToDismount.R) {
                       const sideOffset = 0.65;
                       const p3d = [
                         mechToDismount.position[0] + mechToDismount.R[0] * sideOffset,
                         mechToDismount.position[1] + mechToDismount.R[1] * sideOffset,
                         mechToDismount.position[2] + mechToDismount.R[2] * sideOffset
                       ];
                       const pLen = Math.sqrt(p3d[0]*p3d[0] + p3d[1]*p3d[1] + p3d[2]*p3d[2]) || 1;
                       charTheta = Math.acos(Math.max(-1.0, Math.min(1.0, p3d[1] / pLen)));
                       charPhi = Math.atan2(p3d[2], p3d[0]);
                       if (charPhi < 0) charPhi += Math.PI * 2;

                       const pnx = p3d[0] / pLen, pny = p3d[1] / pLen, pnz = p3d[2] / pLen;
                       const pFeetRad = (playerCenterRadius !== null) ? (playerCenterRadius - 0.46 * playerScale) : (pLen - 0.46 * playerScale);
                       const pCaveData = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(pnx, pny, pnz, pFeetRad) : null;
                       const pGroundRad = pCaveData ? pCaveData.ground : (RADIUS + getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) * HEIGHT_SCALE);
                       playerCenterRadius = pGroundRad + 0.46 * playerScale;
                       isPlayerGrounded = true;
                       playerVerticalVel = 0.0;
                    }
                    mechToDismount.isDynamic = false;
                    mechToDismount.vel = [0, 0, 0];

                    if (mechToDismount.position) {
                      const mPos = mechToDismount.position;
                      const mLen = Math.sqrt(mPos[0]*mPos[0] + mPos[1]*mPos[1] + mPos[2]*mPos[2]) || 1;
                      const mnx = mPos[0] / mLen, mny = mPos[1] / mLen, mnz = mPos[2] / mLen;
                      let mTheta = Math.acos(Math.max(-1.0, Math.min(1.0, mny)));
                      let mPhi = Math.atan2(mnz, mnx);
                      let mFeetRad = mLen - 0.66;
                      const mCaveData = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(mnx, mny, mnz, mFeetRad) : null;
                      let mGroundRad = mCaveData ? mCaveData.ground : (RADIUS + getHeightOnSphere(mTheta, mPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) * HEIGHT_SCALE);
                      const wRad = RADIUS + waterLevel * 0.15;
                      if (waterEnabled && mGroundRad < wRad && (!mCaveData || !mCaveData.insideTunnel)) mGroundRad = wRad;

                      // Check if mech has legs or stand attached
                      const hasLegsOrStand = mechToDismount.attachedParts && mechToDismount.attachedParts.some(entry =>
                        entry.item && entry.item.active && entry.item.type && (
                          entry.item.type.includes("leg") ||
                          entry.item.type.includes("stand")
                        )
                      );

                      const unmountedRad = hasLegsOrStand ? (mGroundRad + 0.66) : (mGroundRad + 0.20);
                      mechToDismount.position = [mnx * unmountedRad, mny * unmountedRad, mnz * unmountedRad];
                    }

                    if (mechToDismount.attachedParts) {
                      for (let entry of mechToDismount.attachedParts) {
                        if (entry.item) {
                          entry.item.isDynamic = false;
                          entry.item.vel = [0, 0, 0];
                          const mR = mechToDismount.R || [1, 0, 0];
                          const mN = mechToDismount.normal || mechToDismount.U || [0, 1, 0];
                          const mF = mechToDismount.F || [0, 0, 1];
                          entry.item.position = [
                            mechToDismount.position[0] + mR[0]*entry.localR + mN[0]*entry.localN + mF[0]*entry.localF,
                            mechToDismount.position[1] + mR[1]*entry.localR + mN[1]*entry.localN + mF[1]*entry.localF,
                            mechToDismount.position[2] + mR[2]*entry.localR + mN[2]*entry.localN + mF[2]*entry.localF
                          ];
                        }
                      }
                    }
                    activeRidingMech = null;
                    window.activeRidingMech = null;
                    pendingCollectibleRefresh = true;
                  }
                } else {
                  chestHoldTimer = 0.0;
                }
              }

              let holdPercent = Math.min(100, Math.floor((chestHoldTimer / 0.8) * 100));
              let actionText = "ลงจากหุ่นยนต์<br>Dismount Mech";
              
              if (activeRidingMech && activeRidingMech._nearbyStand && !activeRidingMech.dockedStand) {
                const dockPct = Math.min(100, Math.floor(((activeRidingMech._dockingTimer || 0) / 0.8) * 100));
                holdPercent = dockPct;
                actionText = "ยึดหุ่นเข้ากับฐานตั้ง<br>Dock Mech to Stand";
              }

              const fullyAssembled = window.isMechFullyAssembled(activeRidingMech);
              let extraStatus = "";
              if (activeRidingMech && activeRidingMech._nearbyStand && !activeRidingMech.dockedStand) {
                const dockPct = Math.min(100, Math.floor(((activeRidingMech._dockingTimer || 0) / 0.8) * 100));
                extraStatus = `<br><span style="color: #6cebdf; font-size: 10px;">⚙️ อยู่ใกล้ฐานตั้ง! กด [E] ค้าง เพื่อยึดหุ่นเข้ากับฐาน ${dockPct > 0 ? '(' + dockPct + '%)' : ''}</span>`;
              } else if (!fullyAssembled && activeRidingMech) {
                let missing = [];
                const attached = activeRidingMech.attachedParts || [];
                if (!attached.some(p => p.item && p.item.active && p.item.type === "robot_left_leg")) missing.push("ขาซ้าย");
                if (!attached.some(p => p.item && p.item.active && p.item.type === "robot_right_leg")) missing.push("ขาขวา");
                if (!attached.some(p => p.item && p.item.active && p.item.type === "robot_left_arm")) missing.push("แขนซ้าย");
                if (!attached.some(p => p.item && p.item.active && p.item.type === "robot_right_arm")) missing.push("แขนขวา");
                extraStatus = `<br><span style="color: #ff8888; font-size: 10px;">⚠️ หุ่นยังประกอบไม่ครบ (ขาด: ${missing.join(", ")}) — วางชิ้นส่วนใส่หุ่นยนต์ให้ครบ 4 ชิ้นก่อนจึงจะขับได้</span>`;
              } else if (activeRidingMech && activeRidingMech.dockedStand) {
                let holdPct = Math.min(100, Math.floor(((activeRidingMech._undockHoldTimer || 0) / 0.35) * 100));
                extraStatus = `<br><span style="color: #6cebdf; font-size: 10px;">🏗️ กด [W] ค้าง (เดินหน้าอย่างเดียว) เพื่อปลดล็อคออกจากฐานตั้ง ${holdPct > 0 ? '(' + holdPct + '%)' : ''}</span>`;
              }

              const _newHtml_4 = `<div style="margin: -8px -16px; padding: 8px 16px; position: relative; overflow: hidden; border-radius: 8px;">
                <div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${holdPercent}%; background: rgba(108, 183, 223, 0.4); pointer-events: none; transition: width 0.05s ease-out;"></div>
                <div style="position: relative; z-index: 1; text-align: center; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #6cb7df;">
                  กด [E] ค้าง เพื่อ ${actionText}
                  ${extraStatus}
                </div>
              </div>`;
if (prompt._lastHTML !== _newHtml_4) {
    prompt.innerHTML = _newHtml_4;
    prompt._lastHTML = _newHtml_4;
}
              if (prompt.style.display !== "block") prompt.style.display = "block";
              const newT = `translate(50vw, 80vh) translate(-50%, -100%)`;
            if (prompt._lastT !== newT) {
                prompt.style.transform = newT;
                prompt._lastT = newT;
            }
            } else {
              let closestItem = null;
              let bestItemDistSq = Infinity;

              const nearbyCandidates = (typeof SpatialGrid !== "undefined")
                ? SpatialGrid.queryRadius(pVec[0], pVec[1], pVec[2], 4.0)
                : collectibles;

              for (let item of nearbyCandidates) {
                if (!item.active) continue;
                if (item.type === "wood_stairs" || item.type === "wood_floor" || item.type === "thin_wood_floor" || item.type === "stone_floor" || item.type === "campfire" || item.type === "wood_boat" || item.type === "wood_wall" || item.type === "wood_window" || item.type === "wood_door" || item.type === "wood_chest" || item.type === "axe" || item.type === "pickaxe" || item.type.startsWith("robot_")) continue;
                
                const reachInfo = isTargetWithinReach(item.position, actionReachDistance);
                if (reachInfo.valid) {
                  const distSq = reachInfo.perpSq;
                  if (distSq < bestItemDistSq) {
                    bestItemDistSq = distSq;
                    closestItem = item;
                  }
                }
              }

              // Check line-based Axe and Pickaxe items!
              let closestLineItem = null;
              let bestLineItemT = Infinity;
              if (!closestItem) {
                for (let item of nearbyCandidates) {
                  if (item.active && (item.type === "axe" || item.type === "pickaxe")) {
                    const reachInfo = isTargetWithinReach(item.position, Math.max(actionReachDistance, 0.15 * (playerScale / 0.1)));
                    if (reachInfo.valid) {
                      if (reachInfo.t < bestLineItemT) {
                        bestLineItemT = reachInfo.t;
                        closestLineItem = item;
                      }
                    }
                  }
                }
                if (closestLineItem) {
                  closestItem = closestLineItem;
                }
              }

              let closestChest = null;
              let closestCampfire = null;
              let closestBoat = null;
              let closestMech = null;
              let closestMechTargetPos = null;
              if (!closestItem) {
                let bestMechT = Infinity;
                let candidateMech = null;
                let candidateMechTargetPos = null;
                for (let item of nearbyCandidates) {
                  if (item.active && item.type === "robot_cockpit" && !item.isPreview) {
                    let mechParts = [item];
                    const nearbyParts = (typeof SpatialGrid !== "undefined")
                      ? SpatialGrid.queryRadius(item.position[0], item.position[1], item.position[2], 1.75, p => p.active && !p.isPreview && p !== item && p.type.startsWith("robot_") && p.type !== "robot_stand")
                      : nearbyCandidates;
                    for (let p of nearbyParts) {
                      if (p.active && !p.isPreview && p !== item && p.type.startsWith("robot_") && p.type !== "robot_stand") {
                        const dx = p.position[0] - item.position[0];
                        const dy = p.position[1] - item.position[1];
                        const dz = p.position[2] - item.position[2];
                        if (dx*dx + dy*dy + dz*dz < 3.0) {
                          mechParts.push(p);
                        }
                      }
                    }
                    for (let part of mechParts) {
                      const reachInfo = isTargetWithinReach(part.position, Math.max(actionReachDistance, 0.45 * (playerScale / 0.1)));
                      if (reachInfo.valid) {
                        if (reachInfo.t < bestMechT) {
                          bestMechT = reachInfo.t;
                          candidateMech = item;
                          candidateMechTargetPos = part.position;
                        }
                      }
                    }
                  }
                }

                let bestBoatT = Infinity;
                let candidateBoat = null;
                for (let item of nearbyCandidates) {
                  if (item.active && item.type === "wood_boat" && !item.isPreview) {
                    const reachInfo = isTargetWithinReach(item.position, Math.max(actionReachDistance, 0.22 * (playerScale / 0.1)));
                    if (reachInfo.valid) {
                      if (reachInfo.t < bestBoatT) {
                        bestBoatT = reachInfo.t;
                        candidateBoat = item;
                      }
                    }
                  }
                }

                let bestChestT = Infinity;
                let candidateChest = null;
                for (let item of nearbyCandidates) {
                  if (item.active && item.type === "wood_chest" && !item.isPreview) {
                    const reachInfo = isTargetWithinReach(item.position, Math.max(actionReachDistance, 0.15 * (playerScale / 0.1)));
                    if (reachInfo.valid) {
                      if (reachInfo.t < bestChestT) {
                        bestChestT = reachInfo.t;
                        candidateChest = item;
                      }
                    }
                  }
                }

                let bestCampfireT = Infinity;
                let candidateCampfire = null;
                for (let item of nearbyCandidates) {
                  if (item.active && item.type === "campfire" && !item.isPreview) {
                    const reachInfo = isTargetWithinReach(item.position, Math.max(actionReachDistance, 0.15 * (playerScale / 0.1)));
                    if (reachInfo.valid) {
                      if (reachInfo.t < bestCampfireT) {
                        bestCampfireT = reachInfo.t;
                        candidateCampfire = item;
                      }
                    }
                  }
                }
                
                if (candidateChest) {
                  closestChest = candidateChest;
                  closestMech = null;
                  closestBoat = null;
                  closestCampfire = null;
                } else if (candidateMech) {
                  closestMech = candidateMech;
                  closestMechTargetPos = candidateMechTargetPos || candidateMech.position;
                  closestChest = null;
                  closestBoat = null;
                  closestCampfire = null;
                } else if (candidateBoat) {
                  closestBoat = candidateBoat;
                  closestChest = null;
                  closestCampfire = null;
                  closestMech = null;
                } else if (candidateCampfire) {
                  closestCampfire = candidateCampfire;
                  closestChest = null;
                  closestBoat = null;
                  closestMech = null;
                }

              }

              if (closestItem) {
                chestHoldTimer = 0.0;
                const screenPos = projectWorldToScreen(
                  closestItem.position,
                  viewMatrix,
                  projMatrix,
                  window.innerWidth,
                  window.innerHeight,
                );
                if (screenPos) {
                  const _newText_1 = `[${currentKeyBindings.interact.replace("Key", "").replace("Arrow", "")}]`;
if (prompt._lastText !== _newText_1) {
    prompt.textContent = _newText_1;
    prompt._lastText = _newText_1;
}
                  if (prompt.style.display !== "block") prompt.style.display = "block";
                  const newT = `translate(${Math.round(screenPos.x)}px, ${Math.round(screenPos.y - 20 )}px) translate(-50%, -100%)`;
                  if (prompt._lastT !== newT) {
                      prompt.style.transform = newT;
                      prompt._lastT = newT;
                  }
                } else {
                  if (prompt.style.display !== "none") prompt.style.display = "none";
                }
              } else if (closestChest) {
                const screenPos = projectWorldToScreen(
                  closestChest.position,
                  viewMatrix,
                  projMatrix,
                  window.innerWidth,
                  window.innerHeight,
                );
                if (screenPos) {
                  const isInteractHeld = keysPressed[currentKeyBindings.interact] || keysPressed["KeyE"];
                  if (isInteractHeld) {
                    chestHoldTimer += delta / 1000;
                    if (chestHoldTimer >= 0.8) {
                      chestHoldTimer = 0.0;
                      openChest(closestChest);
            }
          } else {
                    chestHoldTimer = 0.0;
                  }

                  const holdPercent = Math.min(100, Math.floor((chestHoldTimer / 0.8) * 100));
                  const _newHtml_5 = `<div style="margin: -8px -16px; padding: 8px 16px; position: relative; overflow: hidden; border-radius: 8px;">
                    <div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${holdPercent}%; background: rgba(223, 183, 108, 0.4); pointer-events: none; transition: width 0.05s ease-out;"></div>
                    <div style="position: relative; z-index: 1; text-align: center; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #dfb76c;">
                      กด [E] ค้าง เพื่อเปิดกล่องไม้<br/>
                      (HOLD [E] TO OPEN CHEST)
                    </div>
                  </div>`;
if (prompt._lastHTML !== _newHtml_5) {
    prompt.innerHTML = _newHtml_5;
    prompt._lastHTML = _newHtml_5;
}
                  if (prompt.style.display !== "block") prompt.style.display = "block";
                  const newT = `translate(${Math.round(screenPos.x)}px, ${Math.round(screenPos.y - 45 )}px) translate(-50%, -100%)`;
                  if (prompt._lastT !== newT) {
                      prompt.style.transform = newT;
                      prompt._lastT = newT;
                  }
                } else {
                  if (prompt.style.display !== "none") prompt.style.display = "none";
                  chestHoldTimer = 0.0;
                }
              
              } else if (closestCampfire) {
                const screenPos = projectWorldToScreen(
                  closestCampfire.position,
                  viewMatrix,
                  projMatrix,
                  window.innerWidth,
                  window.innerHeight,
                );
                if (screenPos) {
                  const isInteractHeld = keysPressed[currentKeyBindings.interact] || keysPressed["KeyE"];
                  if (isInteractHeld) {
                    campfireHoldTimer += delta / 1000;
                    if (campfireHoldTimer >= 0.5) {
                      campfireHoldTimer = 0.0;
                      openCookingUI();
            }
          } else {
                    campfireHoldTimer = 0.0;
                  }
                  const holdPercent = Math.min(100, Math.floor((campfireHoldTimer / 0.5) * 100));
                  const _newHtml_6 = `<div style="margin: -8px -16px; padding: 8px 16px; position: relative; overflow: hidden; border-radius: 8px;">
                    <div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${holdPercent}%; background: rgba(223, 108, 108, 0.4); pointer-events: none; transition: width 0.05s ease-out;"></div>
                    <div style="position: relative; z-index: 1; text-align: center; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #df6c6c;">
                      กด [E] ค้าง เพื่อทำอาหาร<br/>
                      (HOLD [E] TO COOK)
                    </div>
                  </div>`;
if (prompt._lastHTML !== _newHtml_6) {
    prompt.innerHTML = _newHtml_6;
    prompt._lastHTML = _newHtml_6;
}
                  if (prompt.style.display !== "block") prompt.style.display = "block";
                  const newT = `translate(${Math.round(screenPos.x)}px, ${Math.round(screenPos.y - 45 )}px) translate(-50%, -100%)`;
                  if (prompt._lastT !== newT) {
                      prompt.style.transform = newT;
                      prompt._lastT = newT;
                  }
                } else {
                  if (prompt.style.display !== "none") prompt.style.display = "none";
                  campfireHoldTimer = 0.0;
                }
} else if (closestBoat) {
                if (prompt && prompt.style.display !== "none") prompt.style.display = "none";
                let targetWorldPos = closestBoat.position;
                let bf = closestBoat.F || [0, 0, 1];
                let bn = closestBoat.normal || [0, 1, 0];
                if (closestBoat.position && closestBoat.F && closestBoat.normal) {
                    const backOffset = (typeof window.boatUiBackOffset !== 'undefined' ? window.boatUiBackOffset : 2.47) * playerScale;
                    const upOffset = (typeof window.boatUiUpOffset !== 'undefined' ? window.boatUiUpOffset : 0.43) * playerScale;
                    
                    if (closestBoat.angle !== undefined && closestBoat.angle !== 0 && closestBoat.R) {
                        const cosH = Math.cos(closestBoat.angle);
                        const sinH = Math.sin(closestBoat.angle);
                        bf = [
                            closestBoat.F[0] * cosH + closestBoat.R[0] * sinH,
                            closestBoat.F[1] * cosH + closestBoat.R[1] * sinH,
                            closestBoat.F[2] * cosH + closestBoat.R[2] * sinH
                        ];
                    }
                    
                    targetWorldPos = [
                        closestBoat.position[0] - bf[0] * backOffset + bn[0] * upOffset,
                        closestBoat.position[1] - bf[1] * backOffset + bn[1] * upOffset,
                        closestBoat.position[2] - bf[2] * backOffset + bn[2] * upOffset
                    ];
                }

                let rLen = Math.sqrt(closestBoat.position[0]**2 + closestBoat.position[1]**2 + closestBoat.position[2]**2) || 1;
                let bTheta = Math.acos(Math.max(-1, Math.min(1, closestBoat.position[1] / rLen)));
                let bPhi = Math.atan2(closestBoat.position[2], closestBoat.position[0]);
                let bHeight = getHeightOnSphere(bTheta, bPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
                let bTerrainRadius = RADIUS + bHeight * HEIGHT_SCALE;
                const bWaterRadius = RADIUS + waterLevel * 0.15;
                const bDepth = bWaterRadius - bTerrainRadius;
                const canRideBoat = (waterEnabled && bDepth > 0.48 * playerScale) || closestBoat.hasWheel || closestBoat.hasWheels;

                const isInteractHeld = keysPressed[currentKeyBindings.interact] || keysPressed["KeyE"];
                if (isInteractHeld) {
                    chestHoldTimer += delta / 1000;
                    if (chestHoldTimer >= 0.8) {
                      chestHoldTimer = 0.0;
                      activeRidingBoat = closestBoat;
                      activeRidingBoat.isDynamic = true;
                      pendingCollectibleRefresh = true;
                      // Teleport player to the boat's exact position on boarding so the boat doesn't jump
                      if (activeRidingBoat.position) {
                          const bPos = activeRidingBoat.position;
                          const bLen = Math.sqrt(bPos[0]*bPos[0] + bPos[1]*bPos[1] + bPos[2]*bPos[2]) || 1;
                          const bnx = bPos[0] / bLen;
                          const bny = bPos[1] / bLen;
                          const bnz = bPos[2] / bLen;
                          charTheta = Math.acos(Math.max(-1.0, Math.min(1.0, bny)));
                          charPhi = Math.atan2(bnz, bnx);
                          if (charPhi < 0) charPhi += Math.PI * 2;
                      }
                      if (activeRidingBoat.F && activeRidingBoat.normal) {
                          const North = [-Math.cos(charTheta) * Math.cos(charPhi), Math.sin(charTheta), -Math.cos(charTheta) * Math.sin(charPhi)];
                          const East = [-Math.sin(charPhi), 0, Math.cos(charPhi)];
                          const fNorth = activeRidingBoat.F[0]*North[0] + activeRidingBoat.F[1]*North[1] + activeRidingBoat.F[2]*North[2];
                          const fEast = activeRidingBoat.F[0]*East[0] + activeRidingBoat.F[1]*East[1] + activeRidingBoat.F[2]*East[2];
                          charHeading = Math.atan2(fEast, fNorth);
                      }
                    }
                } else {
                    chestHoldTimer = 0.0;
                }
                const holdPercent = Math.min(100, Math.floor((chestHoldTimer / 0.8) * 100));
                let actionText = (closestBoat.hasWheel || closestBoat.hasWheels) ? "ขึ้นขับเรือบก<br>Drive Land Boat" : (canRideBoat ? "ขึ้นเรือพาย<br>Ride Boat" : "ขึ้นนั่งเรือ (ติดล้อไม้เพื่อขับบนบก)<br>Board Boat (Attach Wheel to drive)");
                let extraStatus = "";

                const _newHtml_7 = `<div style="position: relative; width: 36px; height: 36px; padding: 1px; background: rgba(223, 183, 108, 0.55); clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px)); filter: drop-shadow(0 4px 15px rgba(0,0,0,0.6)); user-select: none; box-sizing: border-box;">
                  <div style="position: relative; width: 100%; height: 100%; background: rgba(10, 10, 15, 0.88); backdrop-filter: blur(8px); clip-path: polygon(0 0, calc(100% - 5.5px) 0, 100% 5.5px, 100% 100%, 5.5px 100%, 0 calc(100% - 5.5px)); overflow: hidden; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">
                    <div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${holdPercent}%; background: rgba(223, 183, 108, 0.4); pointer-events: none; transition: width 0.05s ease-out;"></div>
                    <div style="position: relative; z-index: 1; text-align: center; font-size: 16px; font-family: 'JetBrains Mono', monospace; color: #dfb76c; font-weight: 900; line-height: 1; letter-spacing: 0.5px; user-select: none;">
                      E
                    </div>
                  </div>
                </div>`;

                if (typeof World3DUI !== "undefined") {
                    const signNormal = [-bf[0], -bf[1], -bf[2]];
                    const signUp = [bn[0], bn[1], bn[2]];
                    const boatScale = (typeof window.boatUiScale === 'number' ? window.boatUiScale : 0.47);
                    const signW = 0.18 * boatScale * (playerScale / 0.1);
                    const signH = 0.18 * boatScale * (playerScale / 0.1);
                    const boatSignId = "boat_world_sign";
                    if (!World3DUI.hasSign(boatSignId)) {
                        World3DUI.createSign({
                            id: boatSignId,
                            position: targetWorldPos,
                            normal: signNormal,
                            up: signUp,
                            size: [signW, signH],
                            isScreenAligned: false,
                            backfaceCulling: false,
                            doubleSided: true,
                            checkOcclusion: false,
                            maxDistance: 35.0,
                            fadeDistance: 25.0,
                            visible: true,
                            content: _newHtml_7
                        });
                    } else {
                        World3DUI.updateSign(boatSignId, {
                            position: targetWorldPos,
                            normal: signNormal,
                            up: signUp,
                            size: [signW, signH],
                            isScreenAligned: false,
                            visible: true,
                            content: _newHtml_7
                        });
                    }
                }
              } else if (closestMech) {
                if (typeof World3DUI !== "undefined" && World3DUI.hasSign("boat_world_sign") && !activeRidingBoat) {
                    World3DUI.removeSign("boat_world_sign");
                }
                const screenPos = projectWorldToScreen(
                  closestMechTargetPos || closestMech.position,
                  viewMatrix,
                  projMatrix,
                  window.innerWidth,
                  window.innerHeight,
                );
                if (screenPos) {
                  const isInteractHeld = keysPressed[currentKeyBindings.interact] || keysPressed["KeyE"];
                  if (isInteractHeld) {
                    chestHoldTimer += delta / 1000;
                    if (chestHoldTimer >= 0.8) {
                      chestHoldTimer = 0.0;
                      activeRidingMech = closestMech;
                      window.activeRidingMech = activeRidingMech;
                      activeRidingMech.isDynamic = true;

                      let mStand = null;
                      if (typeof SpatialGrid !== "undefined") {
                        const nearStands = SpatialGrid.queryRadius(activeRidingMech.position[0], activeRidingMech.position[1], activeRidingMech.position[2], 1.0, item => item.active && !item.isPreview && item.type === "robot_stand");
                        if (nearStands.length > 0) mStand = nearStands[0];
                      } else if (typeof collectibles !== "undefined" && Array.isArray(collectibles)) {
                        for (let item of collectibles) {
                          if (item.active && !item.isPreview && item.type === "robot_stand") {
                            const dx = item.position[0] - activeRidingMech.position[0];
                            const dy = item.position[1] - activeRidingMech.position[1];
                            const dz = item.position[2] - activeRidingMech.position[2];
                            if (dx*dx + dy*dy + dz*dz < 1.0) {
                              mStand = item;
                              break;
                            }
                          }
                        }
                      }
                      activeRidingMech.dockedStand = mStand;
                      activeRidingMech._undockHoldTimer = 0;
                      activeRidingMech._dockingTimer = 0;
                      activeRidingMech._redockCooldown = 0;

                      activeRidingMech.attachedParts = [];
                      const nearbyRobotParts = (typeof SpatialGrid !== "undefined")
                        ? SpatialGrid.queryRadius(activeRidingMech.position[0], activeRidingMech.position[1], activeRidingMech.position[2], 1.75, p => p.active && !p.isPreview && p.type.startsWith("robot_") && p.type !== "robot_stand" && p !== activeRidingMech)
                        : (typeof collectibles !== "undefined" ? collectibles : []);
                      for (let p of nearbyRobotParts) {
                        if (p.active && !p.isPreview && p.type.startsWith("robot_") && p.type !== "robot_stand" && p !== activeRidingMech) {
                          const dx = p.position[0] - activeRidingMech.position[0];
                          const dy = p.position[1] - activeRidingMech.position[1];
                          const dz = p.position[2] - activeRidingMech.position[2];
                          if (dx*dx + dy*dy + dz*dz < 3.0) {
                            p.isDynamic = true;
                            const cR = activeRidingMech.R || [1,0,0];
                            const cN = activeRidingMech.normal || activeRidingMech.U || [0,1,0];
                            const cF = activeRidingMech.F || [0,0,1];

                            const localR = dx * cR[0] + dy * cR[1] + dz * cR[2];
                            const localN = dx * cN[0] + dy * cN[1] + dz * cN[2];
                            const localF = dx * cF[0] + dy * cF[1] + dz * cF[2];

                            activeRidingMech.attachedParts.push({
                              item: p,
                              localR: localR,
                              localN: localN,
                              localF: localF
                            });
                          }
                        }
                      }

                      window.tryAutoAssembleMechParts(activeRidingMech);

                      pendingCollectibleRefresh = true;

                      if (activeRidingMech.position) {
                          const mPos = activeRidingMech.position;
                          const mLen = Math.sqrt(mPos[0]*mPos[0] + mPos[1]*mPos[1] + mPos[2]*mPos[2]) || 1;
                          const mnx = mPos[0] / mLen;
                          const mny = mPos[1] / mLen;
                          const mnz = mPos[2] / mLen;
                          charTheta = Math.acos(Math.max(-1.0, Math.min(1.0, mny)));
                          charPhi = Math.atan2(mnz, mnx);
                          if (charPhi < 0) charPhi += Math.PI * 2;
                      }
                      if (activeRidingMech.F && activeRidingMech.normal) {
                          const North = [-Math.cos(charTheta) * Math.cos(charPhi), Math.sin(charTheta), -Math.cos(charTheta) * Math.sin(charPhi)];
                          const East = [-Math.sin(charPhi), 0, Math.cos(charPhi)];
                          const fNorth = activeRidingMech.F[0]*North[0] + activeRidingMech.F[1]*North[1] + activeRidingMech.F[2]*North[2];
                          const fEast = activeRidingMech.F[0]*East[0] + activeRidingMech.F[1]*East[1] + activeRidingMech.F[2]*East[2];
                          charHeading = Math.atan2(fEast, fNorth);
                      }
                    }
                  } else {
                    chestHoldTimer = 0.0;
                  }
                  const holdPercent = Math.min(100, Math.floor((chestHoldTimer / 0.8) * 100));
                  let actionText = "ขึ้นขับหุ่นยนต์<br>Ride Mech";

                  const _newHtml_8 = `<div style="margin: -8px -16px; padding: 8px 16px; position: relative; overflow: hidden; border-radius: 8px;">
                    <div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${holdPercent}%; background: rgba(108, 183, 223, 0.4); pointer-events: none; transition: width 0.05s ease-out;"></div>
                    <div style="position: relative; z-index: 1; text-align: center; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #6cb7df;">
                      กด [E] ค้าง เพื่อ ${actionText}
                    </div>
                  </div>`;
if (prompt._lastHTML !== _newHtml_8) {
    prompt.innerHTML = _newHtml_8;
    prompt._lastHTML = _newHtml_8;
}
                  if (prompt.style.display !== "block") prompt.style.display = "block";
                  const newT = `translate(${Math.round(screenPos.x)}px, ${Math.round(screenPos.y - 45 )}px) translate(-50%, -100%)`;
                  if (prompt._lastT !== newT) {
                      prompt.style.transform = newT;
                      prompt._lastT = newT;
                  }
                } else {
                  if (prompt.style.display !== "none") prompt.style.display = "none";
                  chestHoldTimer = 0.0;
                }
              } else if (activeInteractWindow) {
                chestHoldTimer = 0.0;
                const screenPos = projectWorldToScreen(
                  activeInteractWindow.position,
                  viewMatrix,
                  projMatrix,
                  window.innerWidth,
                  window.innerHeight,
                );
                if (screenPos) {
                  const currentAngle = activeInteractWindow.windowAngle || 0.0;
                  const actionName = (currentAngle < 0.78) ? "เปิดหน้าต่าง (Hold E)" : "ปิดหน้าต่าง (Hold E)";
                  const _newText_2 = actionName;
if (prompt._lastText !== _newText_2) {
    prompt.textContent = _newText_2;
    prompt._lastText = _newText_2;
}
                  if (prompt.style.display !== "block") prompt.style.display = "block";
                  const newT = `translate(${Math.round(screenPos.x)}px, ${Math.round(screenPos.y - 20 )}px) translate(-50%, -100%)`;
                  if (prompt._lastT !== newT) {
                      prompt.style.transform = newT;
                      prompt._lastT = newT;
                  }
                } else {
                  if (prompt.style.display !== "none") prompt.style.display = "none";
            }
          } else {
                chestHoldTimer = 0.0;
                if (prompt.style.display !== "none") prompt.style.display = "none";
                if (typeof World3DUI !== "undefined" && World3DUI.hasSign("boat_world_sign") && !activeRidingBoat && !closestBoat) {
                    World3DUI.removeSign("boat_world_sign");
                }
              }
            }
          }
        }

        // Mech Stand System 8-Slot UI Update
        let nearbyStand = null;
        let standParts = [];
        let bestStandDistSq = 1.0; // within 1.0 meters

        if (activeRidingMech) {
          if (activeRidingMech.dockedStand) {
            nearbyStand = activeRidingMech.dockedStand;
          } else {
            nearbyStand = null; // Undocked mech walking freely -> hide stand UI
          }
        } else if (typeof collectibles !== "undefined" && Array.isArray(collectibles)) {
          let player3D = [0, 0, 0];
          if (typeof charTheta !== "undefined" && typeof charPhi !== "undefined") {
            const pRad = (typeof RADIUS !== "undefined" ? RADIUS : 100) + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(charTheta, charPhi, typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0) * (typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE : 1) : 0);
            player3D = [
              Math.sin(charTheta) * Math.cos(charPhi) * pRad,
              Math.cos(charTheta) * pRad,
              Math.sin(charTheta) * Math.sin(charPhi) * pRad
            ];
          }

          const candidateStands = (typeof SpatialGrid !== "undefined")
            ? SpatialGrid.queryRadius(player3D[0], player3D[1], player3D[2], 3.0, item => item.active && !item.isPreview && item.type === "robot_stand")
            : collectibles;

          for (let item of candidateStands) {
            if (item.active && !item.isPreview && item.type === "robot_stand") {
              const dx = item.position[0] - player3D[0];
              const dy = item.position[1] - player3D[1];
              const dz = item.position[2] - player3D[2];
              const distSq = dx*dx + dy*dy + dz*dz;
              if (distSq < bestStandDistSq) {
                bestStandDistSq = distSq;
                nearbyStand = item;
              }
            }
          }
        }

        if (nearbyStand) {
          const candidateParts = (typeof SpatialGrid !== "undefined")
            ? SpatialGrid.queryRadius(nearbyStand.position[0], nearbyStand.position[1], nearbyStand.position[2], 2.45, p => p.active && !p.isPreview && p.type.startsWith("robot_") && p.type !== "robot_stand")
            : collectibles;
          for (let p of candidateParts) {
            if (p.active && !p.isPreview && p.type.startsWith("robot_") && p.type !== "robot_stand") {
              const dx = p.position[0] - nearbyStand.position[0];
              const dy = p.position[1] - nearbyStand.position[1];
              const dz = p.position[2] - nearbyStand.position[2];
              if (dx*dx + dy*dy + dz*dz < 6.0) {
                standParts.push(p);
              }
            }
          }

          // If riding a docked mech, guarantee cockpit and attached parts are included in UI
          if (activeRidingMech && activeRidingMech.dockedStand === nearbyStand) {
            if (activeRidingMech.active && !activeRidingMech.isPreview && !standParts.includes(activeRidingMech)) {
              standParts.push(activeRidingMech);
            }
            if (activeRidingMech.attachedParts) {
              for (let entry of activeRidingMech.attachedParts) {
                if (entry && entry.item && entry.item.active && !entry.item.isPreview && !standParts.includes(entry.item)) {
                  standParts.push(entry.item);
                }
              }
            }
          }
        }

        if (nearbyStand || window._hadNearbyStand !== false) {
          if (typeof window.updateMechStandUI === "function") {
            window.updateMechStandUI(nearbyStand, standParts);
          }
          window._hadNearbyStand = !!nearbyStand;
        }

        // Check distance to closest alive NPC for Kill Prompt
        if (!_cachedNpcPrompt) _cachedNpcPrompt = document.getElementById("npcKillPrompt");
        const npcPrompt = _cachedNpcPrompt;
        if (npcPrompt) {
          const px = charTheta;
          const py = charPhi;
          const r_terrain = RADIUS + getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) * HEIGHT_SCALE;
          const r = typeof playerCenterRadius !== 'undefined' && playerCenterRadius !== null ? playerCenterRadius - 0.46 * playerScale : r_terrain;
          const pVec = [
            r * Math.sin(px) * Math.cos(py),
            r * Math.cos(px),
            r * Math.sin(px) * Math.sin(py),
          ];

          let closestNPCLocal = null;
          let minDistSq = Infinity;
          if (amphibians && amphibians.length > 0) {
            for (let npc of amphibians) {
              if ((npc.type === 'meganeura' || npc.type === 'isopod') && !npc.ragdollEnabled) continue;
              if (npc.type !== 'meganeura' && npc.type !== 'isopod' && npc.type !== 'human' && !isDevMode) continue;
              if (npc.type !== 'meganeura' && npc.type !== 'isopod' && npc.ragdollEnabled) continue;

              const pos = npc.ragdollPos || npc.position;
              if (!pos) continue;
              const dx = pVec[0] - pos[0];
              const dy = pVec[1] - pos[1];
              const dz = pVec[2] - pos[2];
              const distSq = dx * dx + dy * dy + dz * dz;
              if (distSq < (npc.type === 'human' ? 0.9 : 0.25)) {
                if (distSq < minDistSq) {
                  minDistSq = distSq;
                  closestNPCLocal = npc;
                }
              }
            }
          }

          if (closestNPCLocal) {
            activeInteractNPC = closestNPCLocal;
            const screenPos = projectWorldToScreen(
              closestNPCLocal.ragdollPos || closestNPCLocal.position,
              viewMatrix,
              projMatrix,
              window.innerWidth,
              window.innerHeight,
            );
            if (screenPos) {
              const keyText = currentKeyBindings.interact
                .replace("Key", "")
                .replace("Arrow", "");
              if (closestNPCLocal.type === 'meganeura') {
                const _newHtml_9 = `
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                      <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                    <span>[${keyText}] เก็บแมลง (Pick up bug)</span>
                  </span>
                `;
if (npcPrompt._lastHTML !== _newHtml_9) {
    npcPrompt.innerHTML = _newHtml_9;
    npcPrompt._lastHTML = _newHtml_9;
}
              } else if (closestNPCLocal.type === 'isopod') {
                const _newHtml_10 = `
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                      <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                    <span>[${keyText}] เก็บไอโซพอด (Pick up Isopod)</span>
                  </span>
                `;
if (npcPrompt._lastHTML !== _newHtml_10) {
    npcPrompt.innerHTML = _newHtml_10;
    npcPrompt._lastHTML = _newHtml_10;
}
              } else if (closestNPCLocal.type === 'human') {
                const hName = closestNPCLocal.name || "ชาวบ้าน";
                const hRole = closestNPCLocal.role || "นักสำรวจ";
                const _newHtml_human = `
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span>[${keyText}] พูดคุยกับ ${hName} (${hRole})</span>
                  </span>
                `;
if (npcPrompt._lastHTML !== _newHtml_human) {
    npcPrompt.innerHTML = _newHtml_human;
    npcPrompt._lastHTML = _newHtml_human;
}
              } else {
                const _newHtml_11 = `
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                      <path d="M9 10h.01M15 10h.01"></path>
                      <path d="M12 2a8 8 0 0 0-8 8v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3a8 8 0 0 0-8-8z"></path>
                      <path d="M10 17v3M14 17v3"></path>
                    </svg>
                    <span>[${keyText}] กำจัด NPC (Kill NPC)</span>
                  </span>
                `;
if (npcPrompt._lastHTML !== _newHtml_11) {
    npcPrompt.innerHTML = _newHtml_11;
    npcPrompt._lastHTML = _newHtml_11;
}
              }
              if (npcPrompt.style.display !== "block") npcPrompt.style.display = "block";
              const newT = `translate(${Math.round(screenPos.x)}px, ${Math.round(screenPos.y - 40 )}px) translate(-50%, -100%)`;
              if (npcPrompt._lastT !== newT) {
                  npcPrompt.style.transform = newT;
                  npcPrompt._lastT = newT;
              }
            } else {
              if (npcPrompt.style.display !== "none") npcPrompt.style.display = "none";
            }
          } else {
            if (npcPrompt.style.display !== "none") npcPrompt.style.display = "none";
            activeInteractNPC = null;
          }
        }

        // Update Bow Auto-Lock Target NPC first using screen space projection
        if ((cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") && isUsingItem && activeItem && activeItem.name === "BOW") {
            const p_x = playerCenterRadius * nx;
            const p_y = playerCenterRadius * ny;
            const p_z = playerCenterRadius * nz;

            let currentTargetStillValid = false;

            // 1. If we already have a locked target, check if it's still valid (not dead, and within range)
            if (activeTargetNPC) {
                const npc = activeTargetNPC;
                const exists = typeof amphibians !== 'undefined' && amphibians.includes(npc);
                if (exists && !npc.ragdollEnabled && npc.position) {
                    const dx = p_x - npc.position[0];
                    const dy = p_y - npc.position[1];
                    const dz = p_z - npc.position[2];
                    const distSq = dx * dx + dy * dy + dz * dz;

                    // Allow a tiny hysteresis (e.g. 5% extra distance) to prevent lock breaking right at the boundary
                    const maxBreakDist = bowLockDistance * 1.05;
                    const isWithinRange = distSq < maxBreakDist * maxBreakDist;
                    const isOccluded = typeof checkPlanetOcclusion === "function" && checkPlanetOcclusion(eyePos, npc.position, RADIUS);

                    if (isWithinRange && !isOccluded) {
                        currentTargetStillValid = true;
                    }
                }
            }

            // 2. If current target is no longer valid, clear it
            if (!currentTargetStillValid) {
                activeTargetNPC = null;
            }

            // 3. If we don't have a valid target, look for the closest to the screen center
            if (!activeTargetNPC) {
                let minScreenDistSq = Infinity;
                let closest = null;
                if (typeof amphibians !== 'undefined' && amphibians.length > 0) {
                    const halfW = window.innerWidth / 2;
                    const halfH = window.innerHeight / 2;

                    for (let npc of amphibians) {
                        if (npc.ragdollEnabled) continue;
                        if (!npc.position) continue;

                        const dx = p_x - npc.position[0];
                        const dy = p_y - npc.position[1];
                        const dz = p_z - npc.position[2];
                        const distSq = dx * dx + dy * dy + dz * dz;

                        if (distSq < bowLockDistance * bowLockDistance) { // Dynamic lock distance limit
                            if (typeof checkPlanetOcclusion === "function" && checkPlanetOcclusion(eyePos, npc.position, RADIUS)) {
                                continue;
                            }
                            const screenPos = projectWorldToScreen(
                                npc.position,
                                viewMatrix,
                                projMatrix,
                                window.innerWidth,
                                window.innerHeight
                            );
                            if (screenPos) {
                                const sdx = screenPos.x - halfW;
                                const sdy = screenPos.y - halfH;
                                const sDistSq = sdx * sdx + sdy * sdy;
                                if (sDistSq < minScreenDistSq) {
                                    minScreenDistSq = sDistSq;
                                    closest = npc;
                                }
                            }
                        }
                    }
                }
                activeTargetNPC = closest;
            }
          } else {
            activeTargetNPC = null;
        }

        // Update Bow Auto-Lock Target Circle overlay
        if (!_cachedTargetCircle) _cachedTargetCircle = document.getElementById("targetCircle");
        const targetCircleEl = _cachedTargetCircle;
        if (targetCircleEl) {
          if ((cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") && isUsingItem && activeItem && activeItem.name === "BOW" && activeTargetNPC && activeTargetNPC.position) {
            const npc = activeTargetNPC;
            const npc_pos = npc.position;
            const npcLen = Math.sqrt(npc_pos[0]**2 + npc_pos[1]**2 + npc_pos[2]**2);
            const n_npc = npcLen > 0.1 ? [npc_pos[0]/npcLen, npc_pos[1]/npcLen, npc_pos[2]/npcLen] : [0, 1, 0];
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
            const centerPos = [
              npc_pos[0] + N[0] * upOffset + F[0] * forwardOffset,
              npc_pos[1] + N[1] * upOffset + F[1] * forwardOffset,
              npc_pos[2] + N[2] * upOffset + F[2] * forwardOffset
            ];
            const screenPos = projectWorldToScreen(
              centerPos,
              viewMatrix,
              projMatrix,
              window.innerWidth,
              window.innerHeight,
            );
            if (screenPos) {
              if (targetCircleEl.style.display !== "block") targetCircleEl.style.display = "block";
              const newT = `translate(${Math.round(screenPos.x)}px, ${Math.round(screenPos.y)}px) translate(-50%, -50%)`;
              if (targetCircleEl._lastT !== newT) {
                  targetCircleEl.style.transform = newT;
                  targetCircleEl._lastT = newT;
              }
            } else {
              if (targetCircleEl.style.display !== "none") targetCircleEl.style.display = "none";
            }
          } else {
            if (targetCircleEl.style.display !== "none") targetCircleEl.style.display = "none";
          }
        }

        // ==========================================
        // PASS 1: SHADOW DEPTH MAP RENDER
        // ==========================================
        const curTerrainDist = typeof terrainRenderDistValue !== "undefined"
          ? terrainRenderDistValue
          : (typeof window !== "undefined" && typeof window.terrainRenderDistValue !== "undefined"
            ? window.terrainRenderDistValue
            : renderDistValue);

        const curObjectDist = typeof objectRenderDistValue !== "undefined"
          ? objectRenderDistValue
          : (typeof window !== "undefined" && typeof window.objectRenderDistValue !== "undefined"
            ? window.objectRenderDistValue
            : renderDistValue);

        let shadowTargetX = px, shadowTargetY = py, shadowTargetZ = pz;
        let camPlayerDist = 10.0;
        if (typeof eyePos !== "undefined" && eyePos) {
          const dx = eyePos[0] - px;
          const dy = eyePos[1] - py;
          const dz = eyePos[2] - pz;
          camPlayerDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        let orthoSize = Math.min(22.0, Math.max(5.0, Math.min(curObjectDist + 2.0, camPlayerDist * 0.5 + 2.5)));

        const lightTarget = [shadowTargetX, shadowTargetY, shadowTargetZ];
        let lightDistance = RADIUS + 8.0;
        let lightFarPlane = RADIUS * 2.5 + 8.0;
        if (cameraMode !== "planet" && cameraMode !== "sun") {
            lightDistance = 30.0;
            lightFarPlane = 60.0;
        }
        const lightEye = [
          shadowTargetX + finalLightDir[0] * lightDistance,
          shadowTargetY + finalLightDir[1] * lightDistance,
          shadowTargetZ + finalLightDir[2] * lightDistance,
        ];
        const lightUp =
          Math.abs(finalLightDir[1]) > 0.99 ? [0.0, 0.0, 1.0] : [0.0, 1.0, 0.0];
        const lightViewMatrix = createLookAt(lightEye, lightTarget, lightUp);
        const lightProjMatrix = createOrtho(-orthoSize, orthoSize, -orthoSize, orthoSize, 0.1, lightFarPlane);
        const lightSpaceMatrix = multiplyMatrices(
          lightProjMatrix,
          lightViewMatrix,
        );

                const timeVal = typeof cloudAnimTime !== 'undefined' ? cloudAnimTime * 0.05 : 0;
        const waterRad = typeof waterRadius !== 'undefined' ? waterRadius : 0.0;
        const gasVal = typeof skyGasIntensity !== 'undefined' ? skyGasIntensity : 0.75;
        
        const gpuViewProj = new Float32Array(16);
        Graphics.multiplyMatrices4(projMatrix, viewMatrix, gpuViewProj);
        const invViewProj = new Float32Array(16);
        Graphics.invertMatrix4(gpuViewProj, invViewProj);
        
        if (shadowMapEnabled) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
          gl.viewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT);
          gl.clearColor(1.0, 1.0, 1.0, 1.0);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

          gl.enable(gl.DEPTH_TEST);
          gl.disable(gl.BLEND);
          gl.disable(gl.CULL_FACE); // Draw both faces into shadow map to prevent missing shadows from wrong windings

          gl.useProgram(depthProgram);
        gl.uniformMatrix4fv(
          depthLightSpaceLoc,
          false,
          new Float32Array(lightSpaceMatrix),
        );
        gl.uniform1f(depthTimeLoc, leafAnimTime);
        gl.uniform1f(depthPlanetRadiusLoc, RADIUS);
        gl.uniform1f(depthWaterRadiusLoc, RADIUS + waterLevel * 0.15);

        // Terrain to depth
        if (typeof SurfaceSystem !== "undefined" && SurfaceSystem.drawSurfaceDepth) {
          SurfaceSystem.drawSurfaceDepth(gl, {
            vertexBuffer,
            indexBuffer,
            indicesLength,
            supportUint32,
            depthSwayFactorLoc,
            depthWaterSwayFactorLoc,
            depthModelLoc,
            depthPosLoc,
            createIdentity
          });
        }

        // Cubes to depth (Cull by object render distance)
        if (cubeVertexBuffer && cubeIndexBuffer && cubeIndicesLength > 0) {
          gl.uniform1f(depthSwayFactorLoc, 0.0);
          gl.uniform1f(depthWaterSwayFactorLoc, 0.0);
          gl.uniformMatrix4fv(
            depthModelLoc,
            false,
            new Float32Array(createIdentity()),
          );
          gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
          gl.enableVertexAttribArray(depthPosLoc);
          gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuffer);
          const isUint32 = supportUint32 && cubeIndicesLength > 65535;
          const type = isUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
          const bytesPerIndex = isUint32 ? 4 : 2;

          if (cubeObstacles && cubeObstacles.length > 0 && typeof getVisibleIndexRanges === "function" && eyePos) {
            const shadowRanges = getVisibleIndexRanges(cubeObstacles, null, curObjectDist, eyePos);
            for (let i = 0; i < shadowRanges.length; i++) {
              const range = shadowRanges[i];
              const count = range.end - range.start;
              if (count > 0) {
                gl.drawElements(gl.TRIANGLES, count, type, range.start * bytesPerIndex);
              }
            }
          } else {
            if (isUint32) {
              gl.drawElements(
                gl.TRIANGLES,
                cubeIndicesLength,
                gl.UNSIGNED_INT,
                0,
              );
            } else {
              gl.drawElements(
                gl.TRIANGLES,
                cubeIndicesLength,
                gl.UNSIGNED_SHORT,
                0,
              );
            }
          }
        }

        // Nature / tree objects to depth (Cull by object render distance)
        if (typeof TreeSystem !== "undefined" && TreeSystem.drawTreeDepth) {
          TreeSystem.drawTreeDepth(gl, {
            natureVertexBuffer,
            natureIndexBuffer,
            natureColorBuffer,
            natureIndicesLength,
            natureGrassStartIndex,
            supportUint32,
            depthSwayFactorLoc,
            depthWaterSwayFactorLoc,
            depthModelLoc,
            depthPosLoc,
            depthColorLoc,
            natureSway,
            waterPlantSway,
            createIdentity,
            natureObstacles,
            grassChunks,
            eyePos,
            renderDistValue: curObjectDist
          });
          if (depthColorLoc >= 0) {
            gl.disableVertexAttribArray(depthColorLoc);
          }
        }
        
        if (typeof GrassSystem !== "undefined" && GrassSystem.drawGrassDepth) {
          GrassSystem.drawGrassDepth(gl, {
            natureVertexBuffer,
            natureIndexBuffer,
            natureColorBuffer,
            natureIndicesLength,
            natureGrassStartIndex,
            supportUint32,
            grassChunks,
            eyePos,
            renderDistValue: curObjectDist
          });
        }

        // Collectibles to depth (Cull by object render distance)
        if (
          collectibleVertexBuffer &&
          collectibleIndexBuffer &&
          collectibleIndicesLength > 0
        ) {
          gl.uniform1f(depthSwayFactorLoc, 0.0);
          gl.uniform1f(depthWaterSwayFactorLoc, 0.0);
          gl.uniformMatrix4fv(
            depthModelLoc,
            false,
            new Float32Array(createIdentity()),
          );
          gl.bindBuffer(gl.ARRAY_BUFFER, collectibleVertexBuffer);
          gl.enableVertexAttribArray(depthPosLoc);
          gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, collectibleIndexBuffer);
          const isUint32 = supportUint32 && collectibleIndicesLength > 65535;
          const type = isUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
          const bytesPerIndex = isUint32 ? 4 : 2;

          if (collectibles && collectibles.length > 0 && typeof getVisibleIndexRanges === "function" && eyePos) {
            const shadowRanges = getVisibleIndexRanges(collectibles, null, curObjectDist, eyePos);
            for (let i = 0; i < shadowRanges.length; i++) {
              const range = shadowRanges[i];
              const count = range.end - range.start;
              if (count > 0) {
                gl.drawElements(gl.TRIANGLES, count, type, range.start * bytesPerIndex);
              }
            }
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              collectibleIndicesLength,
              type,
              0,
            );
          }
        }

        // Dynamic Collectibles to depth (Cull by object render distance)
        if (
          dynamicCollectibleVertexBuffer &&
          dynamicCollectibleIndexBuffer &&
          dynamicCollectibleIndicesLength > 0
        ) {
          gl.uniform1f(depthSwayFactorLoc, 0.0);
          gl.uniform1f(depthWaterSwayFactorLoc, 0.0);
          gl.uniformMatrix4fv(
            depthModelLoc,
            false,
            new Float32Array(createIdentity()),
          );
          gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleVertexBuffer);
          gl.enableVertexAttribArray(depthPosLoc);
          gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, dynamicCollectibleIndexBuffer);
          const isUint32 = supportUint32 && dynamicCollectibleIndicesLength > 65535;
          const type = isUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
          const bytesPerIndex = isUint32 ? 4 : 2;

          const dynList = (typeof dynamicCollectiblesList !== "undefined" && dynamicCollectiblesList) ? dynamicCollectiblesList : (window.dynamicCollectiblesList || []);
          if (dynList && dynList.length > 0 && typeof getVisibleIndexRanges === "function" && eyePos) {
            const shadowRanges = getVisibleIndexRanges(dynList, null, curObjectDist, eyePos);
            for (let i = 0; i < shadowRanges.length; i++) {
              const range = shadowRanges[i];
              const count = range.end - range.start;
              if (count > 0) {
                gl.drawElements(gl.TRIANGLES, count, type, range.start * bytesPerIndex);
              }
            }
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              dynamicCollectibleIndicesLength,
              type,
              0,
            );
          }
        }

        // Amphibians to depth (Cull creatures if outside object render distance)
        if (
          amphibianVertexBuffer &&
          amphibianIndexBuffer &&
          amphibianIndicesLength > 0
        ) {
          let hasNearbyAmphibians = true;
          if (typeof amphibians !== "undefined" && amphibians && amphibians.length > 0 && eyePos) {
            const maxSq = (curObjectDist + 1.0) * (curObjectDist + 1.0);
            hasNearbyAmphibians = amphibians.some(npc => {
              if (npc.hp !== undefined && npc.hp <= 0) return false;
              const pos = npc.position || npc.pos;
              if (!pos) return true;
              const dx = pos[0] - eyePos[0], dy = pos[1] - eyePos[1], dz = pos[2] - eyePos[2];
              return (dx * dx + dy * dy + dz * dz) <= maxSq;
            });
          }

          if (hasNearbyAmphibians) {
            gl.uniform1f(depthSwayFactorLoc, 0.0);
            gl.uniform1f(depthWaterSwayFactorLoc, 0.0);
            gl.uniformMatrix4fv(
              depthModelLoc,
              false,
              new Float32Array(createIdentity()),
            );
            gl.bindBuffer(gl.ARRAY_BUFFER, amphibianVertexBuffer);
            gl.enableVertexAttribArray(depthPosLoc);
            gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, amphibianIndexBuffer);
            if (supportUint32 && amphibianIndicesLength > 65535) {
               gl.drawElements(gl.TRIANGLES, amphibianIndicesLength, gl.UNSIGNED_INT, 0);
            } else {
               gl.drawElements(gl.TRIANGLES, amphibianIndicesLength, gl.UNSIGNED_SHORT, 0);
            }
          }
        }
        
        // Fire to depth (Cull by object render distance)
        if (
          fireVertexBuffer &&
          fireIndexBuffer &&
          fireIndicesLength > 0
        ) {
          let hasNearbyFire = true;
          if (typeof fireObstacles !== "undefined" && fireObstacles && fireObstacles.length > 0 && eyePos) {
            const maxSq = (curObjectDist + 1.0) * (curObjectDist + 1.0);
            hasNearbyFire = fireObstacles.some(f => {
              const pos = f.position || f.pos;
              if (!pos) return true;
              const dx = pos[0] - eyePos[0], dy = pos[1] - eyePos[1], dz = pos[2] - eyePos[2];
              return (dx * dx + dy * dy + dz * dz) <= maxSq;
            });
          }

          if (hasNearbyFire) {
            gl.uniform1f(depthSwayFactorLoc, 0.0);
            gl.uniform1f(depthWaterSwayFactorLoc, 0.0);
            gl.uniformMatrix4fv(
              depthModelLoc,
              false,
              new Float32Array(createIdentity()),
            );
            gl.bindBuffer(gl.ARRAY_BUFFER, fireVertexBuffer);
            gl.enableVertexAttribArray(depthPosLoc);
            gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fireIndexBuffer);
            if (supportUint32 && fireIndicesLength > 65535) {
               gl.drawElements(gl.TRIANGLES, fireIndicesLength, gl.UNSIGNED_INT, 0);
            } else {
               gl.drawElements(gl.TRIANGLES, fireIndicesLength, gl.UNSIGNED_SHORT, 0);
            }
          }
        }

        // Character to depth
        if (charVertexBuffer && charIndexBuffer && charIndicesLength > 0) {
          gl.uniform1f(depthSwayFactorLoc, 0.0);
          gl.uniform1f(depthWaterSwayFactorLoc, 0.0);
          const charModelMatrix = getCharacterMatrix();
          gl.uniformMatrix4fv(
            depthModelLoc,
            false,
            new Float32Array(charModelMatrix),
          );
          gl.bindBuffer(gl.ARRAY_BUFFER, charVertexBuffer);
          gl.enableVertexAttribArray(depthPosLoc);
          gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, charIndexBuffer);
          if (supportUint32 && charIndicesLength > 65535) {
            gl.drawElements(
              gl.TRIANGLES,
              charIndicesLength,
              gl.UNSIGNED_INT,
              0,
            );
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              charIndicesLength,
              gl.UNSIGNED_SHORT,
              0,
            );
          }
        }

        // Equip to depth
        if (equipVertexBuffer && equipIndexBuffer && equipIndicesLength > 0) {
          gl.uniform1f(depthSwayFactorLoc, 0.0);
          gl.uniform1f(depthWaterSwayFactorLoc, 0.0);
          const equipCharModelMatrix = (ragdollEnabled && ragdollInitialized) ? createIdentity() : getCharacterMatrix();
          gl.uniformMatrix4fv(
            depthModelLoc,
            false,
            setF32(f32_charModelMatrix, equipCharModelMatrix),
          );
          gl.bindBuffer(gl.ARRAY_BUFFER, equipVertexBuffer);
          gl.enableVertexAttribArray(depthPosLoc);
          gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, equipIndexBuffer);
          if (supportUint32 && equipIndicesLength > 65535) {
            gl.drawElements(
              gl.TRIANGLES,
              equipIndicesLength,
              gl.UNSIGNED_INT,
              0,
            );
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              equipIndicesLength,
              gl.UNSIGNED_SHORT,
              0,
            );
          }
        }
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Bind shadow depth texture to TEXTURE1 for main render pass
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture);
        
        // Bind water mask texture to TEXTURE2 for main render pass
        gl.activeTexture(gl.TEXTURE2);
        const activeWaterMaskTex = typeof WaterSystem !== 'undefined' ? WaterSystem.getMaskTexture() : (typeof waterMaskTex !== 'undefined' ? waterMaskTex : null);
        if (activeWaterMaskTex) {
            gl.bindTexture(gl.TEXTURE_2D, activeWaterMaskTex);
        } else if (dummyColorTex) {
            gl.bindTexture(gl.TEXTURE_2D, dummyColorTex);
        }

        // ==========================================
        // PASS 2: MAIN SCENE RENDER
        // ==========================================

        // สกัดเฉพาะเมทริกซ์การหมุนของกล้อง (Pure 3x3 Rotation View Matrix)
        // ตัด Translation ทิ้งทั้งหมด เพื่อให้ Skybox และวัตถุท้องฟ้าเป็น Infinite Celestial Dome ครอบคลุม 360 องศาทั้งระบบ SpacesMap
        const skyViewMatrix = [
          viewMatrix[0], viewMatrix[1], viewMatrix[2], 0,
          viewMatrix[4], viewMatrix[5], viewMatrix[6], 0,
          viewMatrix[8], viewMatrix[9], viewMatrix[10], 0,
          0, 0, 0, 1
        ];

        // วาดท้องฟ้าอวกาศเนบิวลากลุ่มก๊าซ (Cosmic Deep Space Skybox)
        if (
          skyEnabled &&
          skyVertexBuffer &&
          skyIndexBuffer &&
          skyIndicesLength > 0
        ) {
            gl.useProgram(skyProgram);

            gl.uniformMatrix4fv(
              skyMVLoc,
              false,
              new Float32Array(skyViewMatrix),
            );
            gl.uniformMatrix4fv(skyProjLoc, false, new Float32Array(projMatrix));
            gl.uniform1f(skyTimeLoc, cloudAnimTime * 0.05);
            gl.uniform1f(skyGasIntensityLoc, skyGasIntensity);
            if (skyCameraPosLoc) gl.uniform3fv(skyCameraPosLoc, new Float32Array(eyePos));
            if (skyWaterRadiusLoc) gl.uniform1f(skyWaterRadiusLoc, isSpaceCameraMode ? 0.0 : waterRadius);

            gl.depthMask(false);
            const prevDepthFunc = gl.getParameter(gl.DEPTH_FUNC);
            gl.depthFunc(gl.LEQUAL);
            const prevCull = gl.isEnabled(gl.CULL_FACE);
            if (prevCull) gl.disable(gl.CULL_FACE);

            gl.bindBuffer(gl.ARRAY_BUFFER, skyVertexBuffer);
            gl.enableVertexAttribArray(skyPosLoc);
            gl.vertexAttribPointer(skyPosLoc, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skyIndexBuffer);

            if (supportUint32 && skyIndicesLength > 65535) {
              gl.drawElements(gl.TRIANGLES, skyIndicesLength, gl.UNSIGNED_INT, 0);
            } else {
              gl.drawElements(
                gl.TRIANGLES,
                skyIndicesLength,
                gl.UNSIGNED_SHORT,
                0,
              );
            }

            if (prevCull) gl.enable(gl.CULL_FACE);
            gl.depthFunc(prevDepthFunc || gl.LESS);
            gl.depthMask(true);
        }

        // ============================================
        // วาดดาวบริวาร (ดวงจันทร์ 3D Noise) เด่นชัดกลางท้องฟ้าดาวหลัก มองเห็นด้วยตาเปล่าทันที
        // ============================================
        const satVBO = window.satelliteVertexBuffer;
        const satCBO = window.satelliteColorBuffer;
        const satIBO = window.satelliteIndexBuffer;
        const satLen = window.satelliteIndicesLength || 0;

        if (satVBO && satCBO && satIBO && satLen > 0) {
          const satProg = sunProgram || modelProgram;
          if (satProg) {
            gl.useProgram(satProg);
            const posLoc = (satProg === sunProgram && sunPosLoc !== -1) ? sunPosLoc : modelPosLoc;
            const colLoc = (satProg === sunProgram && sunColorLoc !== -1) ? sunColorLoc : modelColorLoc;
            const mvLoc = (satProg === sunProgram && sunMVLoc) ? sunMVLoc : modelMVLoc;
            const projLoc = (satProg === sunProgram && sunProjLoc) ? sunProjLoc : modelProjLoc;

            const sunTime = typeof globalTime !== "undefined" ? globalTime : (waterTime || performance.now() / 1000);
            if (satProg === sunProgram) {
              if (sunIsSunLoc) gl.uniform1f(sunIsSunLoc, 1.0);
              if (sunTimeLoc) gl.uniform1f(sunTimeLoc, sunTime);
              if (sunTintLoc) gl.uniform3fv(sunTintLoc, new Float32Array([1.0, 1.0, 1.0]));
            } else if (modelLightDirLoc) {
              setF32(f32_finalLightDir, finalLightDir);
              gl.uniform3fv(modelLightDirLoc, f32_finalLightDir);
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, satVBO);
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, satCBO);
            gl.enableVertexAttribArray(colLoc);
            gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, satIBO);

            let satPos = [-800.0, 0.0, 0.0];
            let satScaleVal = 70.0;
            if (window.SpacesMap && typeof window.SpacesMap.getCelestialTransform === "function") {
              const cel = window.SpacesMap.getCelestialTransform("sun");
              if (cel) {
                satPos = cel.pos;
                satScaleVal = cel.scale;
              }
            } else if (typeof window.getSunWorldPosition === "function") {
              satPos = window.getSunWorldPosition();
            }

            const makeScale = (typeof createScale === "function") ? createScale : (sx, sy, sz) => [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
            const sScaleMat = makeScale(satScaleVal, satScaleVal, satScaleVal);
            const sTransMat = createTranslation(satPos[0], satPos[1], satPos[2]);
            const satModelMatrix = multiplyMatrices(sTransMat, sScaleMat);
            
            // ใช้ viewMatrix ในโหมดกล้องพระอาทิตย์ เพื่อให้กล้องสามารถเข้าใกล้/โคจรรอบโมเดลของจริงได้
            const activeSatViewMatrix = cameraMode === "sun" ? viewMatrix : skyViewMatrix;
            const satMV = multiplyMatrices(activeSatViewMatrix, satModelMatrix);

            setF32(f32_modelViewMatrix, satMV);
            setF32(f32_projMatrix, projMatrix);
            gl.uniformMatrix4fv(mvLoc, false, f32_modelViewMatrix);
            gl.uniformMatrix4fv(projLoc, false, f32_projMatrix);

            gl.enable(gl.CULL_FACE);
            gl.frontFace(gl.CW);
            gl.cullFace(gl.BACK);

            if (supportUint32 && satLen > 65535) {
              gl.drawElements(gl.TRIANGLES, satLen, gl.UNSIGNED_INT, 0);
            } else {
              gl.drawElements(gl.TRIANGLES, satLen, gl.UNSIGNED_SHORT, 0);
            }
          }
        }

        // ============================================
        // วาดดาวบริวารดวงอื่นๆ ในระบบสุริยะ SpacesMap ( Celestial Neighbor Planets - ไม่ล็อคตามกล้อง )
        // ============================================
        if (window.EXTRA_PLANETS && Array.isArray(window.EXTRA_PLANETS) && window.EXTRA_PLANETS.length > 0) {
          const extraProg = modelProgram || sunProgram;
          if (extraProg) {
            gl.useProgram(extraProg);
            const posLoc = (modelPosLoc !== -1) ? modelPosLoc : sunPosLoc;
            const colLoc = (modelColorLoc !== -1) ? modelColorLoc : sunColorLoc;
            const mvLoc = modelMVLoc || sunMVLoc;
            const projLoc = modelProjLoc || sunProjLoc;

            if (modelLightDirLoc) {
              setF32(f32_finalLightDir, finalLightDir);
              gl.uniform3fv(modelLightDirLoc, f32_finalLightDir);
            }

            setF32(f32_projMatrix, projMatrix);
            gl.uniformMatrix4fv(projLoc, false, f32_projMatrix);

            gl.enable(gl.CULL_FACE);
            gl.frontFace(gl.CW);
            gl.cullFace(gl.BACK);

            // ดึงรายชื่อดาวบริวารที่ไม่ใช่ดาว Active ปัจจุบันเพื่อวาดขึ้นท้องฟ้า
            const nonActivePlanetIds = (window.SpacesMap && window.SpacesMap.allPlanets)
              ? Object.keys(window.SpacesMap.allPlanets).filter(id => id !== window.SpacesMap.activePlanetId)
              : [6, 7, 8, 9, 10].map(n => `planet_${n}`);

            for (let i = 0; i < nonActivePlanetIds.length; i++) {
              const targetPlanetId = nonActivePlanetIds[i];
              const epMesh = window.EXTRA_PLANETS[i % window.EXTRA_PLANETS.length];

              if (epMesh && epMesh.vbo && epMesh.cbo && epMesh.ibo && epMesh.indicesLength > 0) {
                let epPos = [800.0, 0.0, 0.0];
                let epScaleVal = 25.0;

                if (window.SpacesMap && typeof window.SpacesMap.getCelestialTransform === "function") {
                  const cel = window.SpacesMap.getCelestialTransform(targetPlanetId);
                  if (cel) {
                    epPos = cel.pos;
                    epScaleVal = cel.scale;
                  }
                } else if (epMesh.pos) {
                  epPos = epMesh.pos;
                }

                gl.bindBuffer(gl.ARRAY_BUFFER, epMesh.vbo);
                gl.enableVertexAttribArray(posLoc);
                gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

                gl.bindBuffer(gl.ARRAY_BUFFER, epMesh.cbo);
                gl.enableVertexAttribArray(colLoc);
                gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 0, 0);

                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, epMesh.ibo);

                const makeScale = (typeof createScale === "function") ? createScale : (sx, sy, sz) => [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
                const scaleMat = makeScale(epScaleVal, epScaleVal, epScaleVal);
                const transMat = createTranslation(epPos[0], epPos[1], epPos[2]);
                const epModelMatrix = multiplyMatrices(transMat, scaleMat);
                
                const activeEpViewMatrix = cameraMode === "sun" ? viewMatrix : skyViewMatrix;
                const epMV = multiplyMatrices(activeEpViewMatrix, epModelMatrix);

                setF32(f32_modelViewMatrix, epMV);
                gl.uniformMatrix4fv(mvLoc, false, f32_modelViewMatrix);

                if (supportUint32 && epMesh.indicesLength > 65535) {
                  gl.drawElements(gl.TRIANGLES, epMesh.indicesLength, gl.UNSIGNED_INT, 0);
                } else {
                  gl.drawElements(gl.TRIANGLES, epMesh.indicesLength, gl.UNSIGNED_SHORT, 0);
                }
              }
            }
          }
        }
        
        // ---- DISABLE BLENDING FOR OPAQUE PASSES ----
        // To maximize GPU performance, disable alpha blending when rendering opaque geometry
        gl.disable(gl.BLEND);

        // วาดพื้นผิวโลก (Planet) - มีการคำนวณแสงเงาเคลื่อนที่ตามดวงอาทิตย์อย่างสวยงาม
        if (cameraMode !== "sun" && vertexBuffer && colorBuffer && indexBuffer && indicesLength > 0) {
          gl.enable(gl.CULL_FACE);
          gl.frontFace(gl.CW);
          gl.cullFace(gl.BACK);

          gl.useProgram(program);
          gl.uniform1f(gl.getUniformLocation(program, "uShadowsEnabled"), shadowMapEnabled ? 1.0 : 0.0);
          gl.uniform1f(useLightingLoc, 1.0); // เปิดแสงเงาดิฟฟิวส์
          gl.uniform3fv(lightDirLoc, new Float32Array(finalLightDir));
          gl.uniformMatrix4fv(
            modelViewLoc,
            false,
            new Float32Array(modelViewMatrix),
          );
          gl.uniformMatrix4fv(
            projectionLoc,
            false,
            new Float32Array(projMatrix),
          );
          gl.uniformMatrix4fv(
            gl.getUniformLocation(program, "uLightSpaceMatrix"),
            false,
            new Float32Array(lightSpaceMatrix),
          );
          gl.uniform1i(gl.getUniformLocation(program, "uShadowMap"), 1);
          gl.uniform2f(gl.getUniformLocation(program, "uShadowTexelSize"), 1.0 / SHADOW_WIDTH, 1.0 / SHADOW_HEIGHT);
          gl.uniform1i(gl.getUniformLocation(program, "uWaterMaskTex"), 2);

          if (Graphics.mode === 'hybrid') { gl.colorMask(false, false, false, false); }
          if (typeof SurfaceSystem !== "undefined" && SurfaceSystem.drawSurface) {
            SurfaceSystem.drawSurface(gl, {
              vertexBuffer,
              colorBuffer,
              indexBuffer,
              indicesLength,
              supportUint32,
              terrainWaterRadiusLoc,
              terrainWaterColorLoc,
              terrainWaterOpacityLoc,
              terrainRenderDistEnabledLoc,
              terrainMaxRenderDistLoc,
              terrainCameraPosLoc,
              waterRadius: RADIUS + waterLevel * 0.15,
              waterColor,
              waterOpacity,
              renderDistEnabled,
              renderDistValue: curTerrainDist,
              positionLoc,
              colorLoc,
              terrainRadiusAttrLoc,
              tunnelCenterAttrLoc,
              tunnelsLoc,
              tunnelCountLoc,
              isTunnelMeshLoc,
              eyePos
            });
          }
          if (Graphics.mode === 'hybrid') { gl.colorMask(true, true, true, true); }

          // Draw 3D Tunnel Spheres (Voxel Mesh & Shell)
          if (typeof CaveSystem !== "undefined" && CaveSystem.drawCave) {
            CaveSystem.drawCave(gl, {
              positionLoc,
              colorLoc,
              isTunnelMeshLoc,
              terrainRadiusAttrLoc,
              tunnelCenterAttrLoc,
              supportUint32
            });
          }

          gl.disable(gl.CULL_FACE);
        }

        // วาดตัวละคร (Character) - คำนวณแสงเงาเคลื่อนตามดวงอาทิตย์
        let springDistance = 3.0;
        if (cameraSpringArm && cameraSpringArm.layers[cameraSpringArm.mode]) {
          springDistance = cameraSpringArm.layers[cameraSpringArm.mode].currentSmoothDistance;
        }
        const minSpringDistToHide = 0.08 * (typeof playerScale !== "undefined" ? (playerScale / 0.22) : 1.0);
        const hideCharacter = (springDistance < minSpringDistToHide);
        if (
          charProgram &&
          charVertexBuffer &&
          charNormalBuffer &&
          charIndexBuffer &&
          charIndicesLength > 0 &&
          !hideCharacter &&
          cameraMode !== "sun"
        ) {
          gl.enable(gl.CULL_FACE);
          gl.frontFace(gl.CCW);
          gl.cullFace(gl.BACK);

          gl.useProgram(charProgram);
          gl.uniform1f(gl.getUniformLocation(charProgram, "uShadowsEnabled"), shadowMapEnabled ? 1.0 : 0.0);

          const charModelMatrix = getCharacterMatrix();
          const charModelViewMatrix = multiplyMatrices(
            viewMatrix,
            charModelMatrix,
          );

          gl.uniformMatrix4fv(
            charMVLoc,
            false,
            setF32(f32_charModelViewMatrix, charModelViewMatrix),
          );
          gl.uniformMatrix4fv(charProjLoc, false, setF32(f32_projMatrix, projMatrix));
          gl.uniform3fv(charLightDirLoc, setF32(f32_finalLightDir, finalLightDir));
          gl.uniform3fv(charCameraPosLoc, setF32(f32_eyePos, eyePos));
          gl.uniformMatrix4fv(
            gl.getUniformLocation(charProgram, "uLightSpaceMatrix"),
            false,
            setF32(f32_lightSpaceMatrix, lightSpaceMatrix),
          );
          gl.uniformMatrix4fv(
            gl.getUniformLocation(charProgram, "uModelMatrix"),
            false,
            setF32(f32_charModelMatrix, charModelMatrix),
          );
          gl.uniform1i(gl.getUniformLocation(charProgram, "uShadowMap"), 1);
          gl.uniform2f(gl.getUniformLocation(charProgram, "uShadowTexelSize"), 1.0 / SHADOW_WIDTH, 1.0 / SHADOW_HEIGHT);
          gl.uniform1i(gl.getUniformLocation(charProgram, "uWaterMaskTex"), 2);

          gl.uniform1f(charWaterRadiusLoc, RADIUS + waterLevel * 0.15);
          gl.uniform3fv(charWaterColorLoc, setF32(f32_waterColor, waterColor));
          gl.uniform1f(charWaterOpacityLoc, waterOpacity);

          gl.bindBuffer(gl.ARRAY_BUFFER, charVertexBuffer);
          gl.enableVertexAttribArray(charPosLoc);
          gl.vertexAttribPointer(charPosLoc, 3, gl.FLOAT, false, 0, 0);

          if (charLocalPosLoc !== -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, charLocalVertexBuffer);
            gl.enableVertexAttribArray(charLocalPosLoc);
            gl.vertexAttribPointer(charLocalPosLoc, 3, gl.FLOAT, false, 0, 0);
          }

          gl.bindBuffer(gl.ARRAY_BUFFER, charNormalBuffer);
          gl.enableVertexAttribArray(charNormLoc);
          gl.vertexAttribPointer(charNormLoc, 3, gl.FLOAT, false, 0, 0);

          if (charColorLoc !== -1 && typeof charColorBuffer !== "undefined" && charColorBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, charColorBuffer);
            gl.enableVertexAttribArray(charColorLoc);
            gl.vertexAttribPointer(charColorLoc, 3, gl.FLOAT, false, 0, 0);
          }

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, charIndexBuffer);

          if (supportUint32 && charIndicesLength > 65535) {
            gl.drawElements(
              gl.TRIANGLES,
              charIndicesLength,
              gl.UNSIGNED_INT,
              0,
            );
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              charIndicesLength,
              gl.UNSIGNED_SHORT,
              0,
            );
          }

           // Object Cloning: Render a mirrored clone of the player, static structures, trees, rocks, and creatures for each nearby active wood_window (disabled as wood_window is now solid wood)
          const px = charModelMatrix[12];
          const py = charModelMatrix[13];
          const pz = charModelMatrix[14];

          const mirrorCandidates = (typeof SpatialGrid !== "undefined")
            ? SpatialGrid.queryRadius(px, py, pz, 3.0, item => item.active && !item.isPreview && item.type === "wood_window_mirror_disabled")
            : collectibles;

          for (let i = 0; i < mirrorCandidates.length; i++) {
            const item = mirrorCandidates[i];
            if (item.active && item.type === "wood_window_mirror_disabled" && !item.isPreview) {
              const dx = px - item.position[0];
              const dy = py - item.position[1];
              const dz = pz - item.position[2];
              const distSq = dx * dx + dy * dy + dz * dz;

              // Draw clone only if player is within 3.0 meters of the window (distSq < 9.0)
              if (distSq < 9.0) {
                const p = item.position;
                const r = item.R, f = item.F, n = item.normal;
                if (!r || !f || !n) continue;

                const angle = item.angle || 0.0;
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);

                // Compute R (right) and F (forward) directions of the window wall
                const wallR = [
                  r[0] * cosA + f[0] * sinA,
                  r[1] * cosA + f[1] * sinA,
                  r[2] * cosA + f[2] * sinA
                ];
                const wallF = [
                  f[0] * cosA - r[0] * sinA,
                  f[1] * cosA - r[1] * sinA,
                  f[2] * cosA - r[2] * sinA
                ];

                const len = Math.hypot(wallF[0], wallF[1], wallF[2]);
                if (len < 0.0001) continue;
                const nx_plane = wallF[0] / len;
                const ny_plane = wallF[1] / len;
                const nz_plane = wallF[2] / len;

                // Center of the glass
                const cx = p[0] + n[0] * 0.125;
                const cy = p[1] + n[1] * 0.125;
                const cz = p[2] + n[2] * 0.125;

                const dot_c_n = cx * nx_plane + cy * ny_plane + cz * nz_plane;

                // Build 4x4 reflection matrix (column-major)
                const R_refl = [
                  1 - 2 * nx_plane * nx_plane,     -2 * nx_plane * ny_plane,        -2 * nx_plane * nz_plane,        0,
                  -2 * nx_plane * ny_plane,        1 - 2 * ny_plane * ny_plane,     -2 * ny_plane * nz_plane,        0,
                  -2 * nx_plane * nz_plane,        -2 * ny_plane * nz_plane,        1 - 2 * nz_plane * nz_plane,     0,
                  2 * dot_c_n * nx_plane,          2 * dot_c_n * ny_plane,          2 * dot_c_n * nz_plane,          1
                ];

                // -------------------------------------------------------------------------
                // A) Use Stencil Buffer to mask the reflections strictly to the window glass!
                // -------------------------------------------------------------------------
                
                if (!windowGlassVertexBuffer) {
                  windowGlassVertexBuffer = gl.createBuffer();
                }
                if (!windowGlassIndexBuffer) {
                  windowGlassIndexBuffer = gl.createBuffer();
                  const cubeIndices = new Uint16Array([
                    0, 2, 1, 0, 3, 2, // bottom
                    4, 5, 6, 4, 6, 7, // top
                    0, 1, 5, 0, 5, 4, // back
                    2, 3, 7, 2, 7, 6, // front
                    0, 7, 3, 0, 4, 7, // left
                    1, 2, 6, 1, 6, 5, // right
                  ]);
                  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, windowGlassIndexBuffer);
                  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW);
                }

                // Compute 8 corners of the glass pane
                const hw = 0.17 / 2;
                const hh = 0.08 / 2;
                const hd = 0.005 / 2;
                const glassVerts = [];
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
                for (let vi = 0; vi < 8; vi++) {
                  const cv = cubeVerts[vi];
                  const rx = wallR[0] * cv[0] + n[0] * cv[1] + wallF[0] * cv[2];
                  const ry = wallR[1] * cv[0] + n[1] * cv[1] + wallF[1] * cv[2];
                  const rz = wallR[2] * cv[0] + n[2] * cv[1] + wallF[2] * cv[2];
                  glassVerts.push(cx + rx, cy + ry, cz + rz);
                }

                // Upload glass corners
                gl.bindBuffer(gl.ARRAY_BUFFER, windowGlassVertexBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(glassVerts), gl.DYNAMIC_DRAW);

                // Configure stencil to WRITE 1s to the stencil buffer, disabling color/depth writes
                gl.enable(gl.STENCIL_TEST);
                gl.clear(gl.STENCIL_BUFFER_BIT);
                gl.colorMask(false, false, false, false);
                gl.depthMask(false);

                gl.stencilFunc(gl.ALWAYS, 1, 0xFF);
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
                gl.stencilMask(0xFF);

                // Draw the glass pane box to the stencil buffer
                gl.useProgram(modelProgram);
                gl.uniformMatrix4fv(modelMVLoc, false, new Float32Array(viewMatrix));
                gl.uniformMatrix4fv(modelProjLoc, false, new Float32Array(projMatrix));

                gl.bindBuffer(gl.ARRAY_BUFFER, windowGlassVertexBuffer);
                gl.enableVertexAttribArray(modelPosLoc);
                gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

                // Disable color attribute and use a constant (0.0, 0.0, 0.0) so no wind/seaweed sway is applied
                gl.disableVertexAttribArray(modelColorLoc);
                gl.vertexAttrib3f(modelColorLoc, 0.0, 0.0, 0.0);

                if (modelNormalLoc !== -1) {
                  gl.disableVertexAttribArray(modelNormalLoc);
                  gl.vertexAttrib3f(modelNormalLoc, 0.0, 1.0, 0.0);
                }

                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, windowGlassIndexBuffer);
                gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

                // Overwrite depth of glass pixels to 1.0 (far plane) in the stencil area so reflections pass depth test
                gl.depthMask(true);
                gl.depthFunc(gl.ALWAYS);
                gl.stencilFunc(gl.EQUAL, 1, 0xFF);
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

                // Force projected Z to be 1.0 (far plane)
                const forceZFarProj = [...projMatrix];
                forceZFarProj[2] = projMatrix[3];
                forceZFarProj[6] = projMatrix[7];
                forceZFarProj[10] = projMatrix[11];
                forceZFarProj[14] = projMatrix[15];

                gl.uniformMatrix4fv(modelProjLoc, false, new Float32Array(forceZFarProj));
                gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

                // Re-enable color/depth writes, configure stencil to ONLY pass where stencil is 1
                gl.colorMask(true, true, true, true);
                gl.depthFunc(gl.LEQUAL);

                if (modelNormalLoc !== -1) {
                  gl.enableVertexAttribArray(modelNormalLoc);
                }

                // -------------------------------------------------------------------------
                // B) Draw the Mirrored Scenes
                // -------------------------------------------------------------------------
                // Compute correct mirrored matrices using proper multiplication order (viewMatrix * reflectedMatrix)
                const reflectedModelMatrix = multiplyMatrices(R_refl, charModelMatrix);
                const reflectedModelViewMatrix = multiplyMatrices(viewMatrix, reflectedModelMatrix);
                const reflectedModelViewMatrixStatic = multiplyMatrices(viewMatrix, R_refl);

                // 1) Draw Mirrored Player
                gl.useProgram(charProgram);
                gl.uniform1f(gl.getUniformLocation(charProgram, "uShadowsEnabled"), shadowMapEnabled ? 1.0 : 0.0);
                gl.uniformMatrix4fv(
                  charMVLoc,
                  false,
                  new Float32Array(reflectedModelViewMatrix),
                );
                gl.uniformMatrix4fv(
                  gl.getUniformLocation(charProgram, "uModelMatrix"),
                  false,
                  new Float32Array(reflectedModelMatrix),
                );
                gl.uniformMatrix4fv(charProjLoc, false, new Float32Array(projMatrix));
                gl.uniform3fv(charLightDirLoc, new Float32Array(finalLightDir));
                gl.uniformMatrix4fv(
                  gl.getUniformLocation(charProgram, "uLightSpaceMatrix"),
                  false,
                  new Float32Array(lightSpaceMatrix),
                );
                gl.uniform1i(gl.getUniformLocation(charProgram, "uShadowMap"), 1);
          gl.uniform1i(gl.getUniformLocation(charProgram, "uWaterMaskTex"), 2);
                gl.uniform1f(charWaterRadiusLoc, RADIUS + waterLevel * 0.15);
                gl.uniform3fv(charWaterColorLoc, new Float32Array(waterColor));
                gl.uniform1f(charWaterOpacityLoc, waterOpacity);

                gl.bindBuffer(gl.ARRAY_BUFFER, charVertexBuffer);
                gl.enableVertexAttribArray(charPosLoc);
                gl.vertexAttribPointer(charPosLoc, 3, gl.FLOAT, false, 0, 0);

                if (charLocalPosLoc !== -1) {
                  gl.bindBuffer(gl.ARRAY_BUFFER, charLocalVertexBuffer);
                  gl.enableVertexAttribArray(charLocalPosLoc);
                  gl.vertexAttribPointer(charLocalPosLoc, 3, gl.FLOAT, false, 0, 0);
                }

                gl.bindBuffer(gl.ARRAY_BUFFER, charNormalBuffer);
                gl.enableVertexAttribArray(charNormLoc);
                gl.vertexAttribPointer(charNormLoc, 3, gl.FLOAT, false, 0, 0);

                if (charColorLoc !== -1 && typeof charColorBuffer !== "undefined" && charColorBuffer) {
                  gl.bindBuffer(gl.ARRAY_BUFFER, charColorBuffer);
                  gl.enableVertexAttribArray(charColorLoc);
                  gl.vertexAttribPointer(charColorLoc, 3, gl.FLOAT, false, 0, 0);
                }

                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, charIndexBuffer);

                // Reflection inverts vertex winding order!
                gl.frontFace(gl.CW);

                if (supportUint32 && charIndicesLength > 65535) {
                  gl.drawElements(gl.TRIANGLES, charIndicesLength, gl.UNSIGNED_INT, 0);
                } else {
                  gl.drawElements(gl.TRIANGLES, charIndicesLength, gl.UNSIGNED_SHORT, 0);
                }

                gl.frontFace(gl.CCW);

                // 2) Draw Mirrored Placed Cubes/Structures
                if (cubeVertexBuffer && cubeIndicesLength > 0) {
                  gl.useProgram(modelProgram);
                  gl.uniform3fv(modelLightDirLoc, new Float32Array(finalLightDir));
                  gl.uniformMatrix4fv(modelMVLoc, false, new Float32Array(reflectedModelViewMatrixStatic));
                  gl.uniformMatrix4fv(modelProjLoc, false, new Float32Array(projMatrix));
                  gl.uniform1f(modelWaterRadiusLoc, RADIUS + waterLevel * 0.15);
                  gl.uniform3fv(modelWaterColorLoc, new Float32Array(waterColor));
                  gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
                  gl.uniform1f(modelRenderDistEnabledLoc, renderDistEnabled ? 1.0 : 0.0);
                  gl.uniform1f(modelMaxRenderDistLoc, curObjectDist);
                  gl.uniform1f(modelTimeLoc, leafAnimTime);
                  gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
                  gl.uniform3fv(modelCameraPosLoc, new Float32Array(eyePos));
                  gl.uniform1f(modelSwayFactorLoc, 0.0);
                  gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

                  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
                  gl.enableVertexAttribArray(modelPosLoc);
                  gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

                  gl.bindBuffer(gl.ARRAY_BUFFER, cubeColorBuffer);
                  gl.enableVertexAttribArray(modelColorLoc);
                  gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

                  if (modelNormalLoc !== -1 && cubeNormalBuffer) {
                    gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuffer);
                    gl.enableVertexAttribArray(modelNormalLoc);
                    gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
                  }

                  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuffer);
                  
                  gl.disable(gl.CULL_FACE);

                  if (supportUint32 && cubeIndicesLength > 65535) {
                    gl.drawElements(gl.TRIANGLES, cubeIndicesLength, gl.UNSIGNED_INT, 0);
                  } else {
                    gl.drawElements(gl.TRIANGLES, cubeIndicesLength, gl.UNSIGNED_SHORT, 0);
                  }
                }

                // 3) Draw Mirrored Trees & Rocks
                if (typeof TreeSystem !== "undefined" && TreeSystem.drawTreeMirrored) {
                  TreeSystem.drawTreeMirrored(gl, {
                    natureVertexBuffer,
                    natureColorBuffer,
                    natureNormalBuffer,
                    natureIndexBuffer,
                    natureIndicesLength,
                    supportUint32,
                    modelProgram,
                    modelLightDirLoc,
                    modelMVLoc,
                    modelProjLoc,
                    modelWaterRadiusLoc,
                    modelWaterColorLoc,
                    modelWaterOpacityLoc,
                    modelRenderDistEnabledLoc,
                    modelMaxRenderDistLoc,
                    modelTimeLoc,
                    modelPlanetRadiusLoc,
                    modelCameraPosLoc,
                    modelSwayFactorLoc,
                    modelWaterSwayFactorLoc,
                    modelPosLoc,
                    modelColorLoc,
                    modelNormalLoc,
                    finalLightDir,
                    reflectedModelViewMatrixStatic,
                    projMatrix,
                    RADIUS,
                    waterLevel,
                    waterColor,
                    waterOpacity,
                    renderDistEnabled,
                    renderDistValue: curObjectDist,
                    leafAnimTime,
                    eyePos,
                    natureSway,
                    waterPlantSway
                  });
                }

                // 4) Draw Mirrored Creatures (Amphibians)
                if (amphibianVertexBuffer && amphibianIndicesLength > 0) {
                  gl.useProgram(modelProgram);
                  gl.uniform3fv(modelLightDirLoc, new Float32Array(finalLightDir));
                  gl.uniformMatrix4fv(modelMVLoc, false, new Float32Array(reflectedModelViewMatrixStatic));
                  gl.uniformMatrix4fv(modelProjLoc, false, new Float32Array(projMatrix));
                  gl.uniform1f(modelWaterRadiusLoc, RADIUS + waterLevel * 0.15);
                  gl.uniform3fv(modelWaterColorLoc, new Float32Array(waterColor));
                  gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
                  gl.uniform1f(modelRenderDistEnabledLoc, renderDistEnabled ? 1.0 : 0.0);
                  gl.uniform1f(modelMaxRenderDistLoc, curObjectDist);
                  gl.uniform1f(modelTimeLoc, waterAnimTime);
                  gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
                  gl.uniform3fv(modelCameraPosLoc, new Float32Array(eyePos));
                  gl.uniform1f(modelSwayFactorLoc, 0.0);
                  gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

                  gl.bindBuffer(gl.ARRAY_BUFFER, amphibianVertexBuffer);
                  gl.enableVertexAttribArray(modelPosLoc);
                  gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

                  gl.bindBuffer(gl.ARRAY_BUFFER, amphibianColorBuffer);
                  gl.enableVertexAttribArray(modelColorLoc);
                  gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

                  if (modelNormalLoc !== -1 && amphibianNormalBuffer) {
                    gl.bindBuffer(gl.ARRAY_BUFFER, amphibianNormalBuffer);
                    gl.enableVertexAttribArray(modelNormalLoc);
                    gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
                  }

                  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, amphibianIndexBuffer);

                  // Creatures use CW winding order normally, so mirrored is CCW
                  gl.enable(gl.CULL_FACE);
                  gl.frontFace(gl.CCW);
                  gl.cullFace(gl.BACK);

                  if (supportUint32 && amphibianIndicesLength > 65535) {
                    gl.drawElements(gl.TRIANGLES, amphibianIndicesLength, gl.UNSIGNED_INT, 0);
                  } else {
                    gl.drawElements(gl.TRIANGLES, amphibianIndicesLength, gl.UNSIGNED_SHORT, 0);
                  }
                  gl.disable(gl.CULL_FACE);
                }

                // 5) Draw Mirrored Fire Particles
                if (fireVertexBuffer && fireIndicesLength > 0) {
                  gl.useProgram(modelProgram);
                  gl.uniform3fv(modelLightDirLoc, new Float32Array(finalLightDir));
                  gl.uniformMatrix4fv(modelMVLoc, false, new Float32Array(reflectedModelViewMatrixStatic));
                  gl.uniformMatrix4fv(modelProjLoc, false, new Float32Array(projMatrix));
                  gl.uniform1f(modelWaterRadiusLoc, RADIUS + waterLevel * 0.15);
                  gl.uniform3fv(modelWaterColorLoc, new Float32Array(waterColor));
                  gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
                  gl.uniform1f(modelRenderDistEnabledLoc, renderDistEnabled ? 1.0 : 0.0);
                  gl.uniform1f(modelMaxRenderDistLoc, curObjectDist);
                  gl.uniform1f(modelTimeLoc, waterAnimTime);
                  gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
                  gl.uniform3fv(modelCameraPosLoc, new Float32Array(eyePos));
                  gl.uniform1f(modelSwayFactorLoc, 0.0);
                  gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

                  gl.bindBuffer(gl.ARRAY_BUFFER, fireVertexBuffer);
                  gl.enableVertexAttribArray(modelPosLoc);
                  gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

                  gl.bindBuffer(gl.ARRAY_BUFFER, fireColorBuffer);
                  gl.enableVertexAttribArray(modelColorLoc);
                  gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

                  if (modelNormalLoc !== -1 && fireNormalBuffer) {
                    gl.bindBuffer(gl.ARRAY_BUFFER, fireNormalBuffer);
                    gl.enableVertexAttribArray(modelNormalLoc);
                    gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
                  }

                  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fireIndexBuffer);

                  if (supportUint32 && fireIndicesLength > 65535) {
                    gl.drawElements(gl.TRIANGLES, fireIndicesLength, gl.UNSIGNED_INT, 0);
                  } else {
                    gl.drawElements(gl.TRIANGLES, fireIndicesLength, gl.UNSIGNED_SHORT, 0);
                  }
                }

                // Restore stencil and winding order
                gl.disable(gl.STENCIL_TEST);
                gl.frontFace(gl.CCW);
              }
            }
          }

          gl.disable(gl.CULL_FACE);
        }

        // วาดสิ่งก่อสร้าง/กล่องสี่เหลี่ยม (Cubes) - คำนวณแสงเงาเคลื่อนตามดวงอาทิตย์อย่างเหมาะสมด้วย modelProgram
        if (
          cubeVertexBuffer &&
          cubeColorBuffer &&
          cubeIndexBuffer &&
          cubeIndicesLength > 0
        ) {
          gl.useProgram(modelProgram);
          gl.uniform1f(gl.getUniformLocation(modelProgram, "uShadowsEnabled"), shadowMapEnabled ? 1.0 : 0.0);
          gl.uniform3fv(modelLightDirLoc, new Float32Array(finalLightDir));
          gl.uniformMatrix4fv(
            modelMVLoc,
            false,
            new Float32Array(modelViewMatrix),
          );
          gl.uniformMatrix4fv(
            modelProjLoc,
            false,
            new Float32Array(projMatrix),
          );
          gl.uniformMatrix4fv(
            gl.getUniformLocation(modelProgram, "uLightSpaceMatrix"),
            false,
            new Float32Array(lightSpaceMatrix),
          );
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uShadowMap"), 1);
          gl.uniform2f(gl.getUniformLocation(modelProgram, "uShadowTexelSize"), 1.0 / SHADOW_WIDTH, 1.0 / SHADOW_HEIGHT);
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uWaterMaskTex"), 2);

          gl.uniform1f(modelWaterRadiusLoc, RADIUS + waterLevel * 0.15);
          gl.uniform3fv(modelWaterColorLoc, new Float32Array(waterColor));
          gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
          gl.uniform1f(
            modelRenderDistEnabledLoc,
            renderDistEnabled ? 1.0 : 0.0,
          );
          gl.uniform1f(modelMaxRenderDistLoc, curObjectDist);
          gl.uniform1f(modelTimeLoc, leafAnimTime);
          gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
          gl.uniform3fv(modelCameraPosLoc, new Float32Array(eyePos));
          gl.uniform1f(modelSwayFactorLoc, 0.0);
          gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

          gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
          gl.enableVertexAttribArray(modelPosLoc);
          gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, cubeColorBuffer);
          gl.enableVertexAttribArray(modelColorLoc);
          gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

          if (modelNormalLoc !== -1 && cubeNormalBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuffer);
            gl.enableVertexAttribArray(modelNormalLoc);
            gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
          }

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuffer);

          const isUint32 = supportUint32 && cubeIndicesLength > 65535;
          if (frustumCullingEnabled && frustumPlanes) {
            const ranges = getVisibleIndexRanges(cubeObstacles, frustumPlanes);
            const type = isUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
            const bytesPerIndex = isUint32 ? 4 : 2;
            for (let i = 0; i < ranges.length; i++) {
              const range = ranges[i];
              const count = range.end - range.start;
              if (count > 0) {
                gl.drawElements(gl.TRIANGLES, count, type, range.start * bytesPerIndex);
              }
            }
          } else {
            if (isUint32) {
              gl.drawElements(gl.TRIANGLES, cubeIndicesLength, gl.UNSIGNED_INT, 0);
            } else {
              gl.drawElements(gl.TRIANGLES, cubeIndicesLength, gl.UNSIGNED_SHORT, 0);
            }
          }
        }

        // วาดวัตถุธรรมชาติ (Trees & Rocks) - คำนวณแสงเงาเคลื่อนตามดวงอาทิตย์อย่างเหมาะสมด้วย modelProgram
        if (cameraMode !== "sun" && typeof TreeSystem !== "undefined" && TreeSystem.drawTrees) {
          TreeSystem.drawTrees(gl, {
            natureVertexBuffer,
            natureColorBuffer,
            natureNormalBuffer,
            natureIndexBuffer,
            natureIndicesLength,
            supportUint32,
            modelProgram,
            modelLightDirLoc,
            modelMVLoc,
            modelProjLoc,
            modelWaterRadiusLoc,
            modelWaterColorLoc,
            modelWaterOpacityLoc,
            modelRenderDistEnabledLoc,
            modelMaxRenderDistLoc,
            modelTimeLoc,
            modelPlanetRadiusLoc,
            modelCameraPosLoc,
            modelSwayFactorLoc,
            modelWaterSwayFactorLoc,
            modelPosLoc,
            modelColorLoc,
            modelNormalLoc,
            finalLightDir,
            modelViewMatrix,
            projMatrix,
            lightSpaceMatrix,
            RADIUS,
            waterLevel,
            waterColor,
            waterOpacity,
            renderDistEnabled,
            renderDistValue: curObjectDist,
            leafAnimTime,
            eyePos,
            natureSway,
            waterPlantSway,
            frustumCullingEnabled,
            frustumPlanes,
            natureObstacles,
            natureGrassStartIndex
          });
        }

        if (typeof GrassSystem !== "undefined" && GrassSystem.drawGrass) {
          GrassSystem.drawGrass(gl, {
            natureVertexBuffer,
            natureColorBuffer,
            natureNormalBuffer,
            natureIndexBuffer,
            natureIndicesLength,
            natureGrassStartIndex,
            supportUint32,
            renderDistEnabled,
            renderDistValue: curObjectDist,
            frustumCullingEnabled,
            frustumPlanes,
            grassChunks,
            eyePos
          });
        }

        // วาดกล่องชน (Hitboxes)
        if (showHitboxes && hitboxVertexBuffer && hitboxColorBuffer && hitboxIndexBuffer && hitboxIndicesLength > 0) {
          gl.bindBuffer(gl.ARRAY_BUFFER, hitboxVertexBuffer);
          gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, hitboxColorBuffer);
          gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

          if (modelNormalLoc !== -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, hitboxVertexBuffer); // just binding same buffer for normal for simplicity or better zero out? Hitboxes don't have normals yet, so we could bind color just to avoid crash, but wait, addBox does not generate normals if not requested? Oh wait, addBox generates vertices, colors, indices. It does not generate normals array directly but if I used addBox I only passed vertices, colors, indices!
            // Wait, addBox has `vertices, colors, indices`. It pushes to those arrays. It does not push normals!
            // Let's check `addBox` signature: `addBox(p, w, h, d, color, r, n, f, vertices, colors, indices)`
            // So there are no normals for hitboxes!
            // We should probably just disable modelNormalLoc
            gl.disableVertexAttribArray(modelNormalLoc);
          }

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, hitboxIndexBuffer);

          if (supportUint32 && hitboxIndicesLength > 65535) {
            gl.drawElements(
              gl.TRIANGLES,
              hitboxIndicesLength,
              gl.UNSIGNED_INT,
              0,
            );
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              hitboxIndicesLength,
              gl.UNSIGNED_SHORT,
              0,
            );
          }
          
          if (modelNormalLoc !== -1) {
              gl.enableVertexAttribArray(modelNormalLoc);
          }
        }

        const hasStaticCollectibles = collectibleVertexBuffer && collectibleColorBuffer && collectibleIndexBuffer && collectibleIndicesLength > 0;
        const hasDynamicCollectibles = dynamicCollectibleVertexBuffer && dynamicCollectibleColorBuffer && dynamicCollectibleIndexBuffer && dynamicCollectibleIndicesLength > 0;

        // วาดไอเทมสวมใส่ (Collectibles)
        if (hasStaticCollectibles || hasDynamicCollectibles) {
          gl.enable(gl.CULL_FACE);
          gl.frontFace(gl.CW);
          gl.cullFace(gl.BACK);

          gl.useProgram(modelProgram);
          gl.uniform3fv(modelLightDirLoc, new Float32Array(finalLightDir));
          gl.uniformMatrix4fv(
            modelMVLoc,
            false,
            new Float32Array(modelViewMatrix),
          );
          gl.uniformMatrix4fv(
            modelProjLoc,
            false,
            new Float32Array(projMatrix),
          );
          gl.uniformMatrix4fv(
            gl.getUniformLocation(modelProgram, "uLightSpaceMatrix"),
            false,
            new Float32Array(lightSpaceMatrix),
          );
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uShadowMap"), 1);
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uWaterMaskTex"), 2);

          gl.uniform1f(modelWaterRadiusLoc, RADIUS + waterLevel * 0.15);
          gl.uniform3fv(modelWaterColorLoc, new Float32Array(waterColor));
          gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
          gl.uniform1f(
            modelRenderDistEnabledLoc,
            renderDistEnabled ? 1.0 : 0.0,
          );
          gl.uniform1f(modelMaxRenderDistLoc, curObjectDist);
          gl.uniform1f(modelTimeLoc, leafAnimTime);
          gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
          gl.uniform3fv(modelCameraPosLoc, new Float32Array(eyePos));
          gl.uniform1f(modelSwayFactorLoc, 0.0);
          gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

          if (hasStaticCollectibles) {
            gl.bindBuffer(gl.ARRAY_BUFFER, collectibleVertexBuffer);
            gl.enableVertexAttribArray(modelPosLoc);
            gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, collectibleColorBuffer);
            gl.enableVertexAttribArray(modelColorLoc);
            gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

            if (modelNormalLoc !== -1 && collectibleNormalBuffer) {
              gl.bindBuffer(gl.ARRAY_BUFFER, collectibleNormalBuffer);
              gl.enableVertexAttribArray(modelNormalLoc);
              gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
            }

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, collectibleIndexBuffer);
            const isUint32 = supportUint32 && collectibleIndicesLength > 65535;
            if (frustumCullingEnabled && frustumPlanes) {
              const ranges = getVisibleIndexRanges(collectibles, frustumPlanes);
              const type = isUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
              const bytesPerIndex = isUint32 ? 4 : 2;
              for (let i = 0; i < ranges.length; i++) {
                const range = ranges[i];
                const count = range.end - range.start;
                if (count > 0) {
                  gl.drawElements(gl.TRIANGLES, count, type, range.start * bytesPerIndex);
                }
            }
          } else {
              if (isUint32) {
                gl.drawElements(gl.TRIANGLES, collectibleIndicesLength, gl.UNSIGNED_INT, 0);
              } else {
                gl.drawElements(gl.TRIANGLES, collectibleIndicesLength, gl.UNSIGNED_SHORT, 0);
              }
            }
          }

          if (hasDynamicCollectibles) {
            gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleVertexBuffer);
            gl.enableVertexAttribArray(modelPosLoc);
            gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleColorBuffer);
            gl.enableVertexAttribArray(modelColorLoc);
            gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

            if (modelNormalLoc !== -1 && dynamicCollectibleNormalBuffer) {
              gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleNormalBuffer);
              gl.enableVertexAttribArray(modelNormalLoc);
              gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
            }

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, dynamicCollectibleIndexBuffer);
            const isUint32Dynamic = supportUint32 && dynamicCollectibleIndicesLength > 65535;
            if (frustumCullingEnabled && frustumPlanes && window.dynamicCollectiblesList && window.dynamicCollectiblesList.length > 0) {
              const ranges = getVisibleIndexRanges(window.dynamicCollectiblesList, frustumPlanes);
              const type = isUint32Dynamic ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
              const bytesPerIndex = isUint32Dynamic ? 4 : 2;
              for (let i = 0; i < ranges.length; i++) {
                const range = ranges[i];
                const count = range.end - range.start;
                if (count > 0) {
                  gl.drawElements(gl.TRIANGLES, count, type, range.start * bytesPerIndex);
                }
              }
            } else {
              if (isUint32Dynamic) {
                gl.drawElements(gl.TRIANGLES, dynamicCollectibleIndicesLength, gl.UNSIGNED_INT, 0);
              } else {
                gl.drawElements(gl.TRIANGLES, dynamicCollectibleIndicesLength, gl.UNSIGNED_SHORT, 0);
              }
            }
          }
          
          gl.disable(gl.CULL_FACE);
        }
        
        // Render preview collectible
        if (
          previewVertexBuffer &&
          previewColorBuffer &&
          previewIndexBuffer &&
          previewIndicesLength > 0
        ) {
          gl.enable(gl.CULL_FACE);
          gl.frontFace(gl.CW);
          gl.cullFace(gl.BACK);
          gl.useProgram(modelProgram);

          gl.uniform3fv(modelLightDirLoc, new Float32Array(finalLightDir));
          gl.uniformMatrix4fv(modelMVLoc, false, new Float32Array(modelViewMatrix));
          gl.uniformMatrix4fv(modelProjLoc, false, new Float32Array(projMatrix));
          gl.uniformMatrix4fv(gl.getUniformLocation(modelProgram, "uLightSpaceMatrix"), false, new Float32Array(lightSpaceMatrix));
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uShadowMap"), 1);
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uWaterMaskTex"), 2);
          gl.uniform1f(modelWaterRadiusLoc, RADIUS + waterLevel * 0.15);
          gl.uniform3fv(modelWaterColorLoc, new Float32Array(waterColor));
          gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
          gl.uniform1f(modelRenderDistEnabledLoc, renderDistEnabled ? 1.0 : 0.0);
          gl.uniform1f(modelMaxRenderDistLoc, curObjectDist);
          gl.uniform1f(modelTimeLoc, leafAnimTime);
          gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
          gl.uniform3fv(modelCameraPosLoc, new Float32Array(eyePos));
          gl.uniform1f(modelSwayFactorLoc, 0.0);
          gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

          gl.bindBuffer(gl.ARRAY_BUFFER, previewVertexBuffer);
          gl.enableVertexAttribArray(modelPosLoc);
          gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, previewColorBuffer);
          gl.enableVertexAttribArray(modelColorLoc);
          gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

          if (modelNormalLoc !== -1 && previewNormalBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, previewNormalBuffer);
            gl.enableVertexAttribArray(modelNormalLoc);
            gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
          }

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, previewIndexBuffer);
          if (supportUint32 && previewIndicesLength > 65535) {
            gl.drawElements(gl.TRIANGLES, previewIndicesLength, gl.UNSIGNED_INT, 0);
          } else {
            gl.drawElements(gl.TRIANGLES, previewIndicesLength, gl.UNSIGNED_SHORT, 0);
          }
          gl.disable(gl.CULL_FACE);
        }

        // วาดขวาน/ไอเทมที่ถืออยู่ (Equipped Item)
        if (
          !hideCharacter &&
          !isSmashing &&
          equipVertexBuffer &&
          equipColorBuffer &&
          equipNormalBuffer &&
          equipIndexBuffer &&
          equipIndicesLength > 0
        ) {
          gl.useProgram(modelProgram);

          const isRag = (ragdollEnabled && ragdollInitialized);
          const equipCharModelMatrix = isRag ? createIdentity() : getCharacterMatrix();
          const equipModelViewMatrix = multiplyMatrices(viewMatrix, equipCharModelMatrix);

          gl.uniformMatrix4fv(modelMVLoc, false, setF32(f32_modelViewMatrix, equipModelViewMatrix));
          gl.uniformMatrix4fv(modelProjLoc, false, new Float32Array(projMatrix));
          gl.uniformMatrix4fv(
            gl.getUniformLocation(modelProgram, "uLightSpaceMatrix"),
            false,
            new Float32Array(lightSpaceMatrix),
          );
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uShadowMap"), 1);
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uWaterMaskTex"), 2);
          gl.uniform1f(gl.getUniformLocation(modelProgram, "uShadowsEnabled"), 0.0);

          // For local space vertices, prevent underwater fog unless player is actually underwater
          const isPlayerUnderwater = (typeof currentSwimFactor !== "undefined" && currentSwimFactor > 0.5);
          gl.uniform1f(modelWaterRadiusLoc, isRag ? (RADIUS + waterLevel * 0.15) : (isPlayerUnderwater ? 999.0 : -999.0));
          gl.uniform3fv(modelWaterColorLoc, new Float32Array(waterColor));
          gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
          gl.uniform1f(modelRenderDistEnabledLoc, 0.0);
          gl.uniform1f(modelMaxRenderDistLoc, 9999.0);
          gl.uniform1f(modelTimeLoc, 0.0);
          gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
          gl.uniform3fv(modelCameraPosLoc, new Float32Array(eyePos));
          gl.uniform1f(modelSwayFactorLoc, 0.0);
          gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

          // Rotate light direction to local model space so lighting on item is bright and consistent
          let localLightDir = finalLightDir;
          if (!isRag) {
            const m = equipCharModelMatrix;
            const lx = (m[0]*finalLightDir[0] + m[1]*finalLightDir[1] + m[2]*finalLightDir[2]);
            const ly = (m[4]*finalLightDir[0] + m[5]*finalLightDir[1] + m[6]*finalLightDir[2]);
            const lz = (m[8]*finalLightDir[0] + m[9]*finalLightDir[1] + m[10]*finalLightDir[2]);
            const lLen = Math.sqrt(lx*lx + ly*ly + lz*lz) || 1.0;
            localLightDir = [lx / lLen, ly / lLen, lz / lLen];
          }
          gl.uniform3fv(modelLightDirLoc, setF32(f32_finalLightDir, localLightDir));

          gl.bindBuffer(gl.ARRAY_BUFFER, equipVertexBuffer);
          gl.enableVertexAttribArray(modelPosLoc);
          gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, equipColorBuffer);
          gl.enableVertexAttribArray(modelColorLoc);
          gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

          if (modelNormalLoc !== -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, equipNormalBuffer);
            gl.enableVertexAttribArray(modelNormalLoc);
            gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
          }

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, equipIndexBuffer);

          if (supportUint32 && equipIndicesLength > 65535) {
            gl.drawElements(
              gl.TRIANGLES,
              equipIndicesLength,
              gl.UNSIGNED_INT,
              0,
            );
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              equipIndicesLength,
              gl.UNSIGNED_SHORT,
              0,
            );
          }
        }

        // วาดสัตว์ครึ่งบกครึ่งน้ำ (Amphibians)
        if (
          amphibianVertexBuffer &&
          amphibianColorBuffer &&
          amphibianIndexBuffer &&
          amphibianIndicesLength > 0
        ) {
          gl.enable(gl.CULL_FACE);
          gl.frontFace(gl.CW);
          gl.cullFace(gl.BACK);

          gl.useProgram(modelProgram);
          gl.uniform3fv(modelLightDirLoc, new Float32Array(finalLightDir));
          gl.uniformMatrix4fv(
            modelMVLoc,
            false,
            new Float32Array(modelViewMatrix),
          );
          gl.uniformMatrix4fv(
            modelProjLoc,
            false,
            new Float32Array(projMatrix),
          );
          gl.uniformMatrix4fv(
            gl.getUniformLocation(modelProgram, "uLightSpaceMatrix"),
            false,
            new Float32Array(lightSpaceMatrix),
          );
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uShadowMap"), 1);
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uWaterMaskTex"), 2);

          gl.uniform1f(modelWaterRadiusLoc, RADIUS + waterLevel * 0.15);
          gl.uniform3fv(modelWaterColorLoc, new Float32Array(waterColor));
          gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
          gl.uniform1f(
            modelRenderDistEnabledLoc,
            renderDistEnabled ? 1.0 : 0.0,
          );
          gl.uniform1f(modelMaxRenderDistLoc, curObjectDist);
          gl.uniform1f(modelTimeLoc, waterAnimTime);
          gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
          gl.uniform3fv(modelCameraPosLoc, new Float32Array(eyePos));
          gl.uniform1f(modelSwayFactorLoc, 0.0);
          gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

          gl.bindBuffer(gl.ARRAY_BUFFER, amphibianVertexBuffer);
          gl.enableVertexAttribArray(modelPosLoc);
          gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, amphibianColorBuffer);
          gl.enableVertexAttribArray(modelColorLoc);
          gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

          if (modelNormalLoc !== -1 && amphibianNormalBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, amphibianNormalBuffer);
            gl.enableVertexAttribArray(modelNormalLoc);
            gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
          }

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, amphibianIndexBuffer);
          if (supportUint32 && amphibianIndicesLength > 65535) {
            gl.drawElements(
              gl.TRIANGLES,
              amphibianIndicesLength,
              gl.UNSIGNED_INT,
              0,
            );
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              amphibianIndicesLength,
              gl.UNSIGNED_SHORT,
              0,
            );
          }
          gl.disable(gl.CULL_FACE);
        }
        
        // วาดกองไฟ (Fire Particles)
        if (
          fireVertexBuffer &&
          fireColorBuffer &&
          fireIndexBuffer &&
          fireIndicesLength > 0
        ) {
          gl.useProgram(modelProgram);
          gl.uniform3fv(modelLightDirLoc, new Float32Array(finalLightDir));
          gl.uniformMatrix4fv(
            modelMVLoc,
            false,
            new Float32Array(modelViewMatrix),
          );
          gl.uniformMatrix4fv(
            modelProjLoc,
            false,
            new Float32Array(projMatrix),
          );
          gl.uniformMatrix4fv(
            gl.getUniformLocation(modelProgram, "uLightSpaceMatrix"),
            false,
            new Float32Array(lightSpaceMatrix),
          );
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uShadowMap"), 1);
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uWaterMaskTex"), 2);

          gl.uniform1f(modelWaterRadiusLoc, RADIUS + waterLevel * 0.15);
          gl.uniform3fv(modelWaterColorLoc, new Float32Array(waterColor));
          gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
          gl.uniform1f(
            modelRenderDistEnabledLoc,
            renderDistEnabled ? 1.0 : 0.0,
          );
          gl.uniform1f(modelMaxRenderDistLoc, curObjectDist);
          gl.uniform1f(modelTimeLoc, waterAnimTime);
          gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
          gl.uniform3fv(modelCameraPosLoc, new Float32Array(eyePos));
          gl.uniform1f(modelSwayFactorLoc, 0.0);
          gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

          gl.bindBuffer(gl.ARRAY_BUFFER, fireVertexBuffer);
          gl.enableVertexAttribArray(modelPosLoc);
          gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, fireColorBuffer);
          gl.enableVertexAttribArray(modelColorLoc);
          gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

          if (modelNormalLoc !== -1 && fireNormalBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, fireNormalBuffer);
            gl.enableVertexAttribArray(modelNormalLoc);
            gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
          }

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fireIndexBuffer);
          if (supportUint32 && fireIndicesLength > 65535) {
            gl.drawElements(
              gl.TRIANGLES,
              fireIndicesLength,
              gl.UNSIGNED_INT,
              0,
            );
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              fireIndicesLength,
              gl.UNSIGNED_SHORT,
              0,
            );
          }
        }

        // วาดเส้นกริดภูมิประเทศ (Wireframe) - ไม่รับแสงเงา (Unlit)
        gl.useProgram(program);
        gl.uniform1f(useLightingLoc, 0.0); // ปิดแสงเงาบนเส้น wireframe
        if (typeof SurfaceSystem !== "undefined" && SurfaceSystem.drawWireframe) {
          SurfaceSystem.drawWireframe(gl, {
            wireframeBuffer,
            wireColorBuffer,
            wireframePointCount,
            positionLoc,
            colorLoc
          });
        }

        // วาดโครงสร้างการชนระบบถ้ำทุกจุด (Cave Collision Wireframe Everywhere)
        if (showHitboxes && typeof CaveSystem !== "undefined" && CaveSystem.drawWireframe) {
          CaveSystem.drawWireframe(gl, {
            positionLoc,
            colorLoc,
            isTunnelMeshLoc,
            terrainRadiusAttrLoc,
            tunnelCenterAttrLoc,
            supportUint32
          });
        }
        
        if (showActionReach && isDevMode) {
            const numSegments = 32;
            const arVerts = [];
            const arCols = [];
            
            const sinTheta = Math.sin(charTheta);
            const cosTheta = Math.cos(charTheta);
            const sinPhi = Math.sin(charPhi);
            const cosPhi = Math.cos(charPhi);
            const nx = sinTheta * cosPhi;
            const ny = cosTheta;
            const nz = sinTheta * sinPhi;
            
            const height = getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
            const terrainRadius = RADIUS + height * HEIGHT_SCALE;
            const currentRadius = (typeof playerCenterRadius !== 'undefined' && playerCenterRadius !== null) 
              ? (playerCenterRadius - 0.46 * playerScale) 
              : terrainRadius;
            
            const center = [currentRadius * nx, currentRadius * ny, currentRadius * nz];
            const up = [nx, ny, nz]; // character normal
            
            let right = [0, 1, 0];
            if (Math.abs(up[1]) > 0.99) right = [1, 0, 0];
            let rightLen = Math.sqrt( (up[1]*right[2] - up[2]*right[1])**2 + (up[2]*right[0] - up[0]*right[2])**2 + (up[0]*right[1] - up[1]*right[0])**2 );
            const fwd = [
                (up[1]*right[2] - up[2]*right[1])/rightLen,
                (up[2]*right[0] - up[0]*right[2])/rightLen,
                (up[0]*right[1] - up[1]*right[0])/rightLen
            ];
            right = [
                fwd[1]*up[2] - fwd[2]*up[1],
                fwd[2]*up[0] - fwd[0]*up[2],
                fwd[0]*up[1] - fwd[1]*up[0]
            ];
            
            const East = [-sinPhi, 0, cosPhi];
            const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
            const cosH = Math.cos(charHeading);
            const sinH = Math.sin(charHeading);
            const F = [
              North[0] * cosH + East[0] * sinH,
              North[1] * cosH + East[1] * sinH,
              North[2] * cosH + East[2] * sinH,
            ];

            // Add a small offset to the center along the normal vector so the circle doesn't clip into the ground
            const circleCenter = [
                center[0] + up[0] * 0.05,
                center[1] + up[1] * 0.05,
                center[2] + up[2] * 0.05
            ];

            // Draw a line pointing forward (แบบเส้น)
            const p1 = [
                circleCenter[0],
                circleCenter[1],
                circleCenter[2]
            ];
            const p2 = [
                circleCenter[0] + F[0] * actionReachDistance,
                circleCenter[1] + F[1] * actionReachDistance,
                circleCenter[2] + F[2] * actionReachDistance
            ];
            arVerts.push(...p1, ...p2);
            arCols.push(1.0, 1.0, 1.0, 1.0, 1.0, 1.0); // White line for aim reach

            // Draw a circle on the ground (แบบวง)
            for (let i = 0; i < numSegments; i++) {
                const a1 = (i / numSegments) * Math.PI * 2;
                const a2 = ((i + 1) / numSegments) * Math.PI * 2;
                
                const c1 = Math.cos(a1);
                const s1 = Math.sin(a1);
                const c2 = Math.cos(a2);
                const s2 = Math.sin(a2);
                
                const pStart = [
                    circleCenter[0] + (right[0] * c1 + fwd[0] * s1) * actionReachDistance,
                    circleCenter[1] + (right[1] * c1 + fwd[1] * s1) * actionReachDistance,
                    circleCenter[2] + (right[2] * c1 + fwd[2] * s1) * actionReachDistance
                ];
                
                const pEnd = [
                    circleCenter[0] + (right[0] * c2 + fwd[0] * s2) * actionReachDistance,
                    circleCenter[1] + (right[1] * c2 + fwd[1] * s2) * actionReachDistance,
                    circleCenter[2] + (right[2] * c2 + fwd[2] * s2) * actionReachDistance
                ];
                
                arVerts.push(...pStart, ...pEnd);
                arCols.push(0.3, 0.9, 0.3, 0.3, 0.9, 0.3); // Soft green color for circular reach
            }
            
            if (!actionReachLineBuffer) actionReachLineBuffer = gl.createBuffer();
            if (!actionReachColorBuffer) actionReachColorBuffer = gl.createBuffer();
            
            gl.bindBuffer(gl.ARRAY_BUFFER, actionReachLineBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arVerts), gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(positionLoc);
            gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, actionReachColorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arCols), gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(colorLoc);
            gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);
            
            gl.drawArrays(gl.LINES, 0, arVerts.length / 3);
        }

        // วาดจุดดาวเล็กๆ (Dots/Stars) - ไม่รับแสงเงา (Unlit)
        if (dotBuffer) {
          gl.bindBuffer(gl.ARRAY_BUFFER, dotBuffer);
          gl.enableVertexAttribArray(positionLoc);
          gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, dotColorBuffer);
          gl.enableVertexAttribArray(colorLoc);
          gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

          gl.drawArrays(gl.POINTS, 0, dotPositions.length / 3);
        }
        
        // ============================================
        // วาดวงโคจรรอบดวงอาทิตย์ (Orbit Rings) - แสดงผลเฉพาะเมื่ออยู่ในโหมดกล้องอวกาศ/พระอาทิตย์/Freecam ไม่แสดงในกล้องตัวละคร
        // ============================================
        const isCharCam = (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps");
        if (program && !isCharCam) {
          gl.useProgram(program);
          if (useLightingLoc) gl.uniform1f(useLightingLoc, 0.0);
          if (terrainRenderDistEnabledLoc) gl.uniform1f(terrainRenderDistEnabledLoc, 0.0);
          if (terrainWaterRadiusLoc) gl.uniform1f(terrainWaterRadiusLoc, 0.0);
          if (isTunnelMeshLoc) gl.uniform1f(isTunnelMeshLoc, 0.0);
          if (tunnelCountLoc) gl.uniform1i(tunnelCountLoc, 0);

          if (terrainRadiusAttrLoc !== -1) gl.disableVertexAttribArray(terrainRadiusAttrLoc);
          if (tunnelCenterAttrLoc !== -1) gl.disableVertexAttribArray(tunnelCenterAttrLoc);
          
          let sunPos = [-800.0, 0.0, 0.0];
          if (window.SpacesMap && typeof window.SpacesMap.getCelestialTransform === "function") {
            const cel = window.SpacesMap.getCelestialTransform("sun");
            if (cel && cel.pos) sunPos = cel.pos;
          } else if (typeof window.getSunWorldPosition === "function") {
            sunPos = window.getSunWorldPosition();
          }

          const orbitVerts = [];
          const orbitCols = [];
          const numSegments = 128;
          const activePlanetId = (window.SpacesMap && window.SpacesMap.activePlanetId) ? window.SpacesMap.activePlanetId : "planet_1";

          // รวบรวมข้อมูลวงโคจรของดาวเคราะห์ในระบบสุริยะ SpacesMap (5 วงโคจรหลัก)
          const orbitsToDraw = [];

          if (window.SpacesMap && window.SpacesMap.allPlanets) {
            Object.keys(window.SpacesMap.allPlanets).forEach(pId => {
              const p = window.SpacesMap.allPlanets[pId];
              const isActive = (pId === activePlanetId);
              let rad = p.orbitRadius || 800.0;
              let tilt = isActive ? 0.0 : ((typeof p.orbitTilt === "number") ? p.orbitTilt : 0.0);

              if (typeof window.SpacesMap.getCelestialTransform === "function") {
                const cel = window.SpacesMap.getCelestialTransform(pId);
                if (cel) {
                  rad = cel.orbitRadius || rad;
                  tilt = (typeof cel.orbitTilt === "number") ? cel.orbitTilt : tilt;
                }
              }

              // วงโคจรของดาวแม่ (Genesis/Active Planet) รัศมี 800 หน่วยบนระนาบ 0 เพื่อให้ผ่านศูนย์กลาง [0, 0, 0] พอดี
              if (isActive) {
                const dx = 0.0 - sunPos[0];
                const dy = 0.0 - sunPos[1];
                const dz = 0.0 - sunPos[2];
                rad = Math.sqrt(dx * dx + dy * dy + dz * dz);
                tilt = 0.0;
              }

              orbitsToDraw.push({
                id: pId,
                radius: rad,
                tilt: tilt,
                isActive: isActive
              });
            });
          }

          // สร้างเส้นเวกเตอร์สำหรับ Orbit Rings
          for (let i = 0; i < orbitsToDraw.length; i++) {
            const orbit = orbitsToDraw[i];
            const radius = orbit.radius;
            const tilt = orbit.tilt;

            if (radius > 10.0) {
              const col = orbit.isActive
                ? [1.0, 1.0, 1.0]          // เส้นสีขาวสว่างชัดเจนสำหรับดาวหลักที่ผู้เล่นอยู่
                : [0.75, 0.85, 1.0];        // เส้นสีขาวนวลประกายเงิน/ฟ้าสำหรับดาวบริวารดวงอื่น

              if (orbit.isActive) {
                // คำนวณระนาบวงโคจรของดาวหลัก (Active Planet) ให้ผ่านจุดศูนย์กลาง [0, 0, 0] ของดาวแม่ 100%
                const ux = -sunPos[0];
                const uy = -sunPos[1];
                const uz = -sunPos[2];
                const uLen = Math.sqrt(ux * ux + uy * uy + uz * uz);
                let vx = -uz;
                let vy = 0.0;
                let vz = ux;
                const vLen = Math.sqrt(vx * vx + vz * vz);
                if (vLen > 0.0001) {
                  vx = (vx / vLen) * uLen;
                  vz = (vz / vLen) * uLen;
                } else {
                  vx = 0.0;
                  vy = 0.0;
                  vz = uLen;
                }

                for (let s = 0; s < numSegments; s++) {
                  const a1 = (s / numSegments) * Math.PI * 2;
                  const a2 = ((s + 1) / numSegments) * Math.PI * 2;

                  const p1x = sunPos[0] + ux * Math.cos(a1) + vx * Math.sin(a1);
                  const p1y = sunPos[1] + uy * Math.cos(a1) + vy * Math.sin(a1);
                  const p1z = sunPos[2] + uz * Math.cos(a1) + vz * Math.sin(a1);

                  const p2x = sunPos[0] + ux * Math.cos(a2) + vx * Math.sin(a2);
                  const p2y = sunPos[1] + uy * Math.cos(a2) + vy * Math.sin(a2);
                  const p2z = sunPos[2] + uz * Math.cos(a2) + vz * Math.sin(a2);

                  orbitVerts.push(p1x, p1y, p1z, p2x, p2y, p2z);
                  orbitCols.push(col[0], col[1], col[2], col[0], col[1], col[2]);
                }
              } else {
                for (let s = 0; s < numSegments; s++) {
                  const a1 = (s / numSegments) * Math.PI * 2;
                  const a2 = ((s + 1) / numSegments) * Math.PI * 2;

                  orbitVerts.push(
                    sunPos[0] + Math.cos(a1) * radius,
                    sunPos[1] + Math.sin(a1) * (radius * tilt),
                    sunPos[2] + Math.sin(a1) * radius,

                    sunPos[0] + Math.cos(a2) * radius,
                    sunPos[1] + Math.sin(a2) * (radius * tilt),
                    sunPos[2] + Math.sin(a2) * radius
                  );

                  orbitCols.push(col[0], col[1], col[2], col[0], col[1], col[2]);
                }
              }
            }
          }

          if (orbitVerts.length > 0) {
            if (!window.orbitLineBuffer) window.orbitLineBuffer = gl.createBuffer();
            if (!window.orbitColorBuffer) window.orbitColorBuffer = gl.createBuffer();

            gl.disable(gl.CULL_FACE);
            
            setF32(f32_modelViewMatrix, viewMatrix);
            gl.uniformMatrix4fv(modelViewLoc, false, f32_modelViewMatrix);
            setF32(f32_projMatrix, projMatrix);
            gl.uniformMatrix4fv(projectionLoc, false, f32_projMatrix);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, window.orbitLineBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(orbitVerts), gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(positionLoc);
            gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, window.orbitColorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(orbitCols), gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(colorLoc);
            gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);
            
            gl.drawArrays(gl.LINES, 0, orbitVerts.length / 3);
          }
        }
        
        // ---- ENABLE BLENDING FOR TRANSPARENT PASSES ----
        gl.enable(gl.BLEND);

        // วาดผิวน้ำ (Water)
        if (cameraMode !== "sun" && typeof WaterSystem !== "undefined" && WaterSystem.drawWater) {
          WaterSystem.drawWater(gl, {
            waterEnabled: waterEnabled,
            modelViewMatrix: modelViewMatrix,
            projMatrix: projMatrix,
            waterColor: waterColor,
            waterOpacity: waterOpacity,
            waterAnimTime: waterAnimTime,
            waveStrength: waveStrength,
            waterLevel: waterLevel,
            finalLightDir: finalLightDir,
            eyePos: eyePos,
            renderDistEnabled: renderDistEnabled,
            renderDistValue: curTerrainDist,
            collectibles: collectibles,
            tunnels3D: tunnels3D,
            supportUint32: supportUint32
          });
        }

        // วาดชั้นบรรยากาศ (Atmosphere) - เรืองแสงฟิสิกส์ Fresnel สวยงามรอบดวงดาว
        if (
          atmosphereEnabled &&
          atmosphereVertexBuffer &&
          atmosphereIndexBuffer &&
          atmosphereIndicesLength > 0
        ) {
          gl.useProgram(atmosphereProgram);
          gl.uniformMatrix4fv(
            atmosphereMVLoc,
            false,
            new Float32Array(modelViewMatrix),
          );
          gl.uniformMatrix4fv(
            atmosphereProjLoc,
            false,
            new Float32Array(projMatrix),
          );
          gl.uniform3fv(atmosphereColorLoc, new Float32Array(atmosphereColor));
          gl.uniform1f(atmosphereAlphaLoc, atmosphereAlpha);
          gl.uniform3fv(atmosphereLightDirLoc, new Float32Array(finalLightDir));
          gl.uniform3fv(atmosphereCameraPosLoc, new Float32Array(eyePos));

          // ปิดเขียนลง Depth Buffer ชั่วคราวเพื่อให้เบลนด์กับเบื้องหลังได้อย่างสมบูรณ์แบบ
          gl.depthMask(false);

          gl.bindBuffer(gl.ARRAY_BUFFER, atmosphereVertexBuffer);
          gl.enableVertexAttribArray(atmospherePosLoc);
          gl.vertexAttribPointer(atmospherePosLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, atmosphereIndexBuffer);

          if (supportUint32 && atmosphereIndicesLength > 65535) {
            gl.drawElements(
              gl.TRIANGLES,
              atmosphereIndicesLength,
              gl.UNSIGNED_INT,
              0,
            );
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              atmosphereIndicesLength,
              gl.UNSIGNED_SHORT,
              0,
            );
          }

          gl.depthMask(true);
        }

        
        // วาดเมฆแก๊สลอยตัว (Gaseous Clouds)
        if (cloudsEnabled) {
          if (typeof window.cloud3DData === "undefined" && typeof window.generateClouds3D === "function") {
              const currentSeed = typeof seedVal !== "undefined" ? seedVal : (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 12345);
              const currentRadius = typeof RADIUS !== "undefined" ? RADIUS : 8.0;
              const currentHeight = typeof cloudsHeight !== "undefined" ? cloudsHeight : 12.0;
              window.cloud3DData = window.generateClouds3D(currentSeed, currentRadius, currentHeight);
          }
          if (typeof window.cloud3DData !== "undefined" && window.cloud3DData) {
              if (!cloud3DVertexBuffer) {
                  cloud3DVertexBuffer = gl.createBuffer();
                  gl.bindBuffer(gl.ARRAY_BUFFER, cloud3DVertexBuffer);
                  gl.bufferData(gl.ARRAY_BUFFER, window.cloud3DData.vertices, gl.STATIC_DRAW);
                  
                  cloud3DLocalPosBuffer = gl.createBuffer();
                  gl.bindBuffer(gl.ARRAY_BUFFER, cloud3DLocalPosBuffer);
                  gl.bufferData(gl.ARRAY_BUFFER, window.cloud3DData.localPos, gl.STATIC_DRAW);
                  
                  cloud3DIndexBuffer = gl.createBuffer();
                  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cloud3DIndexBuffer);
                  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, window.cloud3DData.indices, gl.STATIC_DRAW);
              }

              if (cloud3DVertexBuffer) {
                  gl.useProgram(cloud3DProgram);
                  gl.uniformMatrix4fv(cloud3DMVLoc, false, new Float32Array(modelViewMatrix));
                  gl.uniformMatrix4fv(cloud3DProjLoc, false, new Float32Array(projMatrix));
                  
                  // Calculate Clouds3D Orbital Rotation Matrix around planet
                  const orbAngle = typeof window.cloud3DOrbitAngle === "number" ? window.cloud3DOrbitAngle : 0.0;
                  const cosA = Math.cos(orbAngle);
                  const sinA = Math.sin(orbAngle);
                  const cosT = Math.cos(0.21); // ~12 degree orbital tilt
                  const sinT = Math.sin(0.21);
                  const orbitMatrix = new Float32Array([
                    cosA,        sinA * sinT,   sinA * cosT,  0,
                    0,           cosT,          -sinT,        0,
                   -sinA,        cosA * sinT,   cosA * cosT,  0,
                    0,           0,             0,            1
                  ]);
                  if (cloud3DOrbitMatrixLoc) {
                    gl.uniformMatrix4fv(cloud3DOrbitMatrixLoc, false, orbitMatrix);
                  }

                  gl.uniform3fv(cloud3DColorLoc, new Float32Array(cloudsColor));
                  gl.uniform1f(cloud3DAlphaLoc, cloudsAlpha);

                  const c3dAnimT = typeof window.cloud3DAnimTime === "number" ? window.cloud3DAnimTime : cloudAnimTime * 0.01;
                  gl.uniform1f(cloud3DTimeLoc, c3dAnimT);
                  if (cloud3DAnimTimeLoc) {
                    gl.uniform1f(cloud3DAnimTimeLoc, c3dAnimT);
                  }

                  gl.uniform3fv(cloud3DLightDirLoc, new Float32Array(finalLightDir));
                  gl.uniform3fv(cloud3DCameraPosLoc, new Float32Array(eyePos));
                  if (cloud3DWaterRadiusLoc) {
                    gl.uniform1f(cloud3DWaterRadiusLoc, waterRadius);
                  }
                  
                  gl.depthMask(false);
                  
                  gl.bindBuffer(gl.ARRAY_BUFFER, cloud3DVertexBuffer);
                  gl.enableVertexAttribArray(cloud3DPosLoc);
                  gl.vertexAttribPointer(cloud3DPosLoc, 3, gl.FLOAT, false, 0, 0);
                  
                  gl.bindBuffer(gl.ARRAY_BUFFER, cloud3DLocalPosBuffer);
                  gl.enableVertexAttribArray(cloud3DLocalPosLoc);
                  gl.vertexAttribPointer(cloud3DLocalPosLoc, 3, gl.FLOAT, false, 0, 0);
                  
                  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cloud3DIndexBuffer);
                  
                  // Frustum Culling with rotated cloud chunks
                  let ranges = [];
                  const fPlanes = typeof frustumPlanes !== 'undefined' ? frustumPlanes : null;
                  if (window.FrustumCullingSystem && typeof window.FrustumCullingSystem.getVisibleCloudRanges === 'function' && fPlanes && typeof frustumCullingEnabled !== 'undefined' && frustumCullingEnabled && window.cloud3DData.chunks) {
                      ranges = window.FrustumCullingSystem.getVisibleCloudRanges(window.cloud3DData.chunks, orbitMatrix, fPlanes);
                  }
                  if (!ranges || ranges.length === 0) {
                      ranges = [{ start: 0, end: window.cloud3DData.indices.length }];
                  }
                  
                  for (let r = 0; r < ranges.length; r++) {
                      const range = ranges[r];
                      if (range.end > range.start) {
                          gl.drawElements(
                              gl.TRIANGLES,
                              range.end - range.start,
                              gl.UNSIGNED_SHORT,
                              range.start * 2 // 2 bytes per index
                          );
                      }
                  }
                  
                  gl.disableVertexAttribArray(cloud3DLocalPosLoc);
                  gl.depthMask(true);
              }
          }
        }

        waterTime += dt;
        cloudTime += dt * cloudsSpeed;
        cloudShapeTime += 0.06 * dt;

        // Anti-Aliasing / TAAU Post-Processing Pass
        const isAAPostProcess = !!((typeof taauEnabled !== "undefined" && taauEnabled) || (typeof window.taauEnabled !== "undefined" && window.taauEnabled) || (typeof antialiasEnabled !== "undefined" && antialiasEnabled));
        if (isAAPostProcess && gl) {
          initFXAASystem();
          if (fxaaProgram && fxaaCopyTex) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, canvas.width, canvas.height);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, fxaaCopyTex);
            gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, canvas.width, canvas.height, 0);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.BLEND);

            gl.useProgram(fxaaProgram);
            gl.uniform1i(fxaaTexLoc, 0);
            gl.uniform2f(fxaaResolutionLoc, canvas.width, canvas.height);

            gl.bindBuffer(gl.ARRAY_BUFFER, fxaaQuadBuffer);
            gl.enableVertexAttribArray(fxaaPosLoc);
            gl.vertexAttribPointer(fxaaPosLoc, 2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.disableVertexAttribArray(fxaaPosLoc);

            gl.enable(gl.DEPTH_TEST);
          }
        }

        if (typeof updateFloatingNpcHpBars === "function") {
          updateFloatingNpcHpBars(viewMatrix, projMatrix, eyePos);
        }

        if (typeof World3DUI !== "undefined" && typeof World3DUI.render === "function") {
          World3DUI.render(viewMatrix, projMatrix, eyePos, window.innerWidth, window.innerHeight);
        }

        if (typeof updateCompassHUD === "function") {
          updateCompassHUD();
        }

        // Next frame
        if (!forceDraw) {
          requestAnimationFrame(render);
        }
      }



