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
const f32_godRaysColor = new Float32Array(3);

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
      // WebGL Setup
      // ============================================
      canvas = document.getElementById("mapCanvas");
      gl =
        canvas.getContext("webgl2", { antialias: false, stencil: true }) ||
        canvas.getContext("webgl", { antialias: false, stencil: true });

      if (!gl) {
        alert("เบราว์เซอร์ของคุณไม่รองรับ WebGL");
      }

      isWebGL2 = gl instanceof WebGL2RenderingContext;
      supportUint32 =
        isWebGL2 || gl.getExtension("OES_element_index_uint");

      function resizeCanvas() {
        canvas.width = Math.max(1, Math.round(window.innerWidth * renderScale));
        canvas.height = Math.max(
          1,
          Math.round(window.innerHeight * renderScale),
        );
        gl.viewport(0, 0, canvas.width, canvas.height);

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

      // --- Cloud Program Setup ---
      const cloudVS = createShader(cloudVertexShaderSource, gl.VERTEX_SHADER);
      const cloudFS = createShader(
        cloudFragmentShaderSource,
        gl.FRAGMENT_SHADER,
      );
      const cloudProgram = gl.createProgram();
      gl.attachShader(cloudProgram, cloudVS);
      gl.attachShader(cloudProgram, cloudFS);
      gl.linkProgram(cloudProgram);

      const cloudPosLoc = gl.getAttribLocation(cloudProgram, "aPosition");
      const cloudMVLoc = gl.getUniformLocation(
        cloudProgram,
        "uModelViewMatrix",
      );
      const cloudProjLoc = gl.getUniformLocation(
        cloudProgram,
        "uProjectionMatrix",
      );
      const cloudScaleLoc = gl.getUniformLocation(cloudProgram, "uScale");
      const cloudColorLoc = gl.getUniformLocation(cloudProgram, "uColor");
      const cloudAlphaLoc = gl.getUniformLocation(cloudProgram, "uAlpha");
      const cloudTimeLoc = gl.getUniformLocation(cloudProgram, "uTime");
      const cloudShapeLoc = gl.getUniformLocation(cloudProgram, "uCloudShape");
      const cloudLightDirLoc = gl.getUniformLocation(cloudProgram, "uLightDir");
      const cloudCameraPosLoc = gl.getUniformLocation(
        cloudProgram,
        "uCameraPos",
      );
      const cloudRadiusOutLoc = gl.getUniformLocation(
        cloudProgram,
        "uCloudRadiusOut",
      );
      const cloudRadiusInLoc = gl.getUniformLocation(
        cloudProgram,
        "uCloudRadiusIn",
      );
      const cloudPlanetRadiusLoc = gl.getUniformLocation(
        cloudProgram,
        "uPlanetRadius",
      );

      
      // --- Clouds 3D Program Setup ---
      const cloud3DVS = createShader(window.cloud3DVertexShaderSource || cloud3DVertexShaderSource, gl.VERTEX_SHADER);
      const cloud3DFS = createShader(window.cloud3DFragmentShaderSource || cloud3DFragmentShaderSource, gl.FRAGMENT_SHADER);
      const cloud3DProgram = gl.createProgram();
      gl.attachShader(cloud3DProgram, cloud3DVS);
      gl.attachShader(cloud3DProgram, cloud3DFS);
      gl.linkProgram(cloud3DProgram);
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
          const currentSeed = typeof seedVal !== "undefined" ? seedVal : (typeof globalSeed !== "undefined" ? globalSeed : 12345);
          const currentRadius = typeof RADIUS !== "undefined" ? RADIUS : 8.0;
          window.cloud3DData = window.generateClouds3D(currentSeed, currentRadius, h);
          if (typeof window.resetCloud3DBuffers === "function") {
            window.resetCloud3DBuffers();
          }
        }
      };

      // --- God Rays Program Setup ---
      const godRayVS = createShader(godRayVertexShaderSource, gl.VERTEX_SHADER);
      const godRayFS = createShader(godRayFragmentShaderSource, gl.FRAGMENT_SHADER);
      const godRayProgram = gl.createProgram();
      gl.attachShader(godRayProgram, godRayVS);
      gl.attachShader(godRayProgram, godRayFS);
      gl.linkProgram(godRayProgram);
      if (!gl.getProgramParameter(godRayProgram, gl.LINK_STATUS)) {
        console.error("GodRay program link error:", gl.getProgramInfoLog(godRayProgram));
      }

      const godRayPosLoc = gl.getAttribLocation(godRayProgram, "aPosition");
      const godRayMVLoc = gl.getUniformLocation(godRayProgram, "uModelViewMatrix");
      const godRayProjLoc = gl.getUniformLocation(godRayProgram, "uProjectionMatrix");
      const godRaySphereRadiusLoc = gl.getUniformLocation(godRayProgram, "uSphereRadius");
      const godRayColorLoc = gl.getUniformLocation(godRayProgram, "uColor");
      const godRayAlphaLoc = gl.getUniformLocation(godRayProgram, "uAlpha");
      const godRayTimeLoc = gl.getUniformLocation(godRayProgram, "uTime");
      const godRayPulseSpeedLoc = gl.getUniformLocation(godRayProgram, "uPulseSpeed");
      const godRayPhaseLoc = gl.getUniformLocation(godRayProgram, "uPhase");
      const godRayCameraPosLoc = gl.getUniformLocation(godRayProgram, "uCameraPos");
      const godRayLightDirLoc = gl.getUniformLocation(godRayProgram, "uLightDir");
      const godRayCloudRadiusInLoc = gl.getUniformLocation(godRayProgram, "uCloudRadiusIn");
      const godRayCloudRadiusOutLoc = gl.getUniformLocation(godRayProgram, "uCloudRadiusOut");
      const godRayCloudShapeLoc = gl.getUniformLocation(godRayProgram, "uCloudShape");
      const godRayCloudTimeLoc = gl.getUniformLocation(godRayProgram, "uCloudTime");
      const godRayPlanetRadiusLoc = gl.getUniformLocation(godRayProgram, "uPlanetRadius");

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
        if (delta < frameTime - tolerance && !forceDraw) {
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
          let remainder = 0;
        if (delta >= frameTime) {
          remainder = delta % frameTime;
        } else if (delta >= frameTime - tolerance) {
          remainder = delta - frameTime;
        }
        lastFrameTime = timestamp - remainder;
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

        const bowCrosshair = document.getElementById("bowCrosshair");
        if (bowCrosshair) {
          bowCrosshair.style.display = "none";
        }

        // Synchronize active action slot with floor placement mode
        const selectedItem = (selectedActionSlotIndex !== -1) ? actionSlotsItems[selectedActionSlotIndex] : null;
        
        const isPlacementItem = selectedItem && (selectedItem.name === "STONE_FLOOR" || selectedItem.name === "WOOD_FLOOR" || selectedItem.name === "THIN_WOOD_FLOOR" || selectedItem.name === "WOOD_STAIRS" || selectedItem.name === "CAMPFIRE" || selectedItem.name === "WOOD_BOAT" || selectedItem.name === "WOOD_WHEEL" || selectedItem.name === "WOOD_WALL" || selectedItem.name === "WOOD_WINDOW" || selectedItem.name === "WOOD_DOOR" || selectedItem.name === "WOOD_CHEST" || selectedItem.name === "MEGANEURA" || selectedItem.name.startsWith("ROBOT_"));

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
            const distanceInfo = document.getElementById("distanceInfo");
            if (distanceInfo) {
                const sinTheta = Math.sin(charTheta);
                const cosTheta = Math.cos(charTheta);
                const sinPhi = Math.sin(charPhi);
                const cosPhi = Math.cos(charPhi);
                const nx = sinTheta * cosPhi;
                const ny = cosTheta;
                const nz = sinTheta * sinPhi;
                const height = getHeightOnSphere(charTheta, charPhi, globalSeed);
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

        // Door swinging physics simulation
        let doorActiveSwinging = false;
        const pRadius = playerCenterRadius || RADIUS;
        const pX = Math.sin(charTheta) * Math.cos(charPhi) * pRadius;
        const pY = Math.cos(charTheta) * pRadius;
        const pZ = Math.sin(charTheta) * Math.sin(charPhi) * pRadius;

        for (let other of collectibles) {
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
              continue;
            }

            // Restoring spring force towards 0 (closed)
            const springK = 7.0; // Spring constant
            const damping = 0.94; // Friction damping
            other.doorVel += -springK * other.doorAngle * dt;
            other.doorVel *= damping;

            if (Math.abs(other.doorVel) > 0.005 || Math.abs(other.doorAngle) > 0.005) {
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
            }
          }
        }

        // Window swinging physics and "E" holding interaction
        let windowActiveSwinging = false;
        let activeInteractWindow = null;
        let bestT_window = Infinity;

        const isInteractHeld = keysPressed[currentKeyBindings.interact] || keysPressed["KeyE"];

        for (let other of collectibles) {
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

        for (let other of collectibles) {
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
              } else if (other.windowAngle > other.windowTargetAngle) {
                other.windowAngle = Math.max(other.windowTargetAngle, other.windowAngle - speed * dt);
                windowActiveSwinging = true;
            }
          } else {
              if (other === activeInteractWindow) {
                other.isBeingHeld = false;
              }
            }
          }
        }

        let pendingDynamicRefresh = false;
        if (doorActiveSwinging || windowActiveSwinging || (typeof pendingDynamicCollectibleRefresh !== 'undefined' && pendingDynamicCollectibleRefresh)) {
          pendingDynamicRefresh = true;
          if (typeof pendingDynamicCollectibleRefresh !== 'undefined') window.pendingDynamicCollectibleRefresh = false;
        }

        if (pendingCollectibleRefresh) {
          pendingCollectibleRefresh = false;
          refreshCollectiblesVBO(); // Rebuild both main and dynamic
        } else if (pendingDynamicRefresh) {
          refreshCollectiblesVBO('dynamic'); // Only rebuild dynamic
        }

        // --- Render Loop ---
        if (lastIsCameraUnderwater) {
          gl.clearColor(0.01, 0.08, 0.16, 1.0);
        } else {
          gl.clearColor(0, 0, 0, 1);
        }
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // 1. Get movement inputs first
        let moveForwardInput = 0;
        let moveSidewaysInput = 0;

        const isInvOpen = document.getElementById("inventoryOverlay")?.classList.contains("open");
        const isCstOpen = document.getElementById("chestOverlay")?.classList.contains("open");
        const isUIOpen = isInvOpen || isCstOpen;

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
          updateAmphibians(dt, globalSeed);
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
              const charHeight_init = getHeightOnSphere(charTheta, charPhi, globalSeed);
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
              RADIUS + getHeightOnSphere(charTheta, charPhi, globalSeed) * HEIGHT_SCALE
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

        let charHeight = getHeightOnSphere(charTheta, charPhi, globalSeed);
        const charScale = playerScale;

        let feetRadiusBefore = (playerCenterRadius !== null) ? (playerCenterRadius - 0.46 * charScale) : (RADIUS + charHeight * HEIGHT_SCALE);
        const caveData = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(nx, ny, nz, feetRadiusBefore) : { ground: RADIUS + charHeight * HEIGHT_SCALE, ceiling: Infinity, insideTunnel: false };
        let terrainRadius = caveData.ground;
        const waterRadius = RADIUS + waterLevel * 0.15;
        let wRadiusLocal = getWaterRadiusAt(nx * feetRadiusBefore, ny * feetRadiusBefore, nz * feetRadiusBefore);
        
        // if (caveData.insideTunnel) { wRadiusLocal = 0; } // Disabled: allow water in caves
        
        let currentFeetRadius = (playerCenterRadius !== null) ? (playerCenterRadius - 0.46 * charScale) : terrainRadius;

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
          playerCenterRadius = terrainRadius + 0.46 * charScale;
          playerVerticalVel = 0.0;
        }

        let standGroundRadius = terrainRadius + 0.46 * charScale;
        if (activeRidingBoat) {
          const tRadius = RADIUS + getHeightOnSphere(charTheta, charPhi, globalSeed) * HEIGHT_SCALE;
          const baseRadius = (waterEnabled && tRadius < waterRadius) ? waterRadius : tRadius;
          let bR = activeRidingBoat.currentRadius !== undefined ? activeRidingBoat.currentRadius : (baseRadius - 0.04);
          standGroundRadius = bR + 0.46 * charScale;
        } else if (activeRidingMech) {
          const tRadius = RADIUS + getHeightOnSphere(charTheta, charPhi, globalSeed) * HEIGHT_SCALE;
          standGroundRadius = tRadius + (typeof window.mechSeatOffset !== "undefined" ? window.mechSeatOffset : 0.71);
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
            // Air physics - apply gravity
            playerVerticalVel = Physics.applyVerticalGravity(playerVerticalVel, 1.0, Physics.gravityAccel);
            playerCenterRadius += playerVerticalVel;

            const minGroundRadius = (typeof caveData !== 'undefined' && caveData && caveData.insideTunnel)
              ? (caveData.ground + 0.46 * charScale)
              : standGroundRadius;

            if (playerCenterRadius <= minGroundRadius) {
              const impactVelocity = -playerVerticalVel;
              playerCenterRadius = minGroundRadius;
              playerVerticalVel = 0.0;
              isPlayerGrounded = true;

              if (impactVelocity > 0.025) {
                setRagdoll(true);
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
            const topFwdSpeed = pSpeed * 5.0;
            const topRevSpeed = pSpeed * 2.0;
            const accelPower = pSpeed * 0.15 * dt;
            const brakePower = pSpeed * 0.30 * dt;
            const coastFriction = Math.pow(0.98, dt);

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
            } else if (moveForwardInput > 0.1) {
              if (vehSpeed < -0.01) {
                vehSpeed += brakePower;
              } else {
                vehSpeed = Math.min(topFwdSpeed, vehSpeed + accelPower);
              }
            } else if (moveForwardInput < -0.1) {
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
              if (typeof collectibles !== "undefined" && Array.isArray(collectibles)) {
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
          if (activeRidingBoat) { let _bDepth = waterRadius - terrainRadius; let _isInWater = waterEnabled && _bDepth > 0.48 * charScale; let _isLandBoat = activeRidingBoat.hasWheel || activeRidingBoat.hasWheels || (activeRidingBoat.wheelCount && activeRidingBoat.wheelCount > 0); if (_isLandBoat) { currentSpeedVal = Math.abs(activeRidingBoat.vehicleSpeed || 0); } else { currentSpeedVal = pSpeed * 1.5; } }
          const speed = currentSpeedVal / currentRadius;
          if (activeRidingBoat) boatRowTimer += speed * 50.0;

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

            const currentPlayPos3D = [P_new[0] * groundRadius, P_new[1] * groundRadius, P_new[2] * groundRadius];
            const nearbyCollectibles = [];
            const collFilterDistSq = 3.0 * 3.0; // 3.0 units is plenty since wood_walls are only ~0.3 units in size
            for (let i = 0; i < collectibles.length; i++) {
              const item = collectibles[i];
              if (item.active && !item.isPreview && (item.type === "wood_wall" || item.type === "wood_window" || item.type === "wood_door")) {
                const dx = currentPlayPos3D[0] - item.position[0];
                const dy = currentPlayPos3D[1] - item.position[1];
                const dz = currentPlayPos3D[2] - item.position[2];
                if (dx*dx + dy*dy + dz*dz < collFilterDistSq) {
                  nearbyCollectibles.push(item);
                }
              }
            }

            // --- COLLISION WITH WOOD WALLS ---
            for (let other of nearbyCollectibles) {
              if (other.active && other.type === "wood_wall" && !other.isPreview) {
                const wallCenterRadius = Math.sqrt(
                  other.position[0] * other.position[0] +
                  other.position[1] * other.position[1] +
                  other.position[2] * other.position[2]
                );
                
                const wallHeight = 0.25;
                const charRadius = playerScale * 0.38;
                
                const feetRadius = groundRadius - 0.46 * playerScale;
                const headRadius = groundRadius + 0.46 * playerScale;
                
                if (headRadius > wallCenterRadius && feetRadius < wallCenterRadius + wallHeight) {
                  // Compute rotated local coordinate system of the wall
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
                  
                  // Vector from wall center to player
                  const dx_vec = [
                    P_new[0] * groundRadius - other.position[0],
                    P_new[1] * groundRadius - other.position[1],
                    P_new[2] * groundRadius - other.position[2]
                  ];
                  
                  // Project onto local axes of the wall
                  const dx = dx_vec[0] * wallR[0] + dx_vec[1] * wallR[1] + dx_vec[2] * wallR[2];
                  const dz = dx_vec[0] * wallF[0] + dx_vec[1] * wallF[1] + dx_vec[2] * wallF[2];
                  
                  // Check if there is an active wood_door or wood_window sharing the same snapped position (or very close)
                  let hasCoLocatedDoor = false;
                  let hasCoLocatedWindow = false;
                  if (other.type === "wood_wall") {
                    for (let d of nearbyCollectibles) {
                      if (d.active && !d.isPreview) {
                        const ox = d.position[0] - other.position[0];
                        const oy = d.position[1] - other.position[1];
                        const oz = d.position[2] - other.position[2];
                        const distSq = ox*ox + oy*oy + oz*oz;
                        if (distSq < 0.005) {
                          if (d.type === "wood_door") {
                            hasCoLocatedDoor = true;
                          } else if (d.type === "wood_window") {
                            hasCoLocatedWindow = true;
                          }
                        }
                      }
                    }
                  }

                  let segments = [];
                  if (hasCoLocatedDoor) {
                    segments.push({ cx: -0.1095, hw: 0.0405 });
                    segments.push({ cx: 0.1095, hw: 0.0405 });
                  } else if (hasCoLocatedWindow) {
                    const feetHeight = feetRadius - wallCenterRadius;
                    // Player is passing through the window if their feet are at or above the sill (0.08), 
                    // and not too high (feet are below 0.18, which is the top frame)
                    if (feetHeight >= 0.075 && feetHeight < 0.185) {
                      // Player is vertically inside the window opening, only block by left/right window frames
                      segments.push({ cx: -0.1175, hw: 0.0325 });
                      segments.push({ cx: 0.1175, hw: 0.0325 });
                    } else {
                      // Otherwise, player height overlaps with solid parts of the wall, so block completely
                      segments.push({ cx: 0.0, hw: 0.15 });
                    }
                  } else {
                    segments.push({ cx: 0.0, hw: 0.15 });
                  }

                  const hd = 0.02; // half thickness

                  for (let seg of segments) {
                    // Project onto local axes of the wall (might have been pushed in previous iteration)
                    const cur_dx_vec = [
                      P_new[0] * groundRadius - other.position[0],
                      P_new[1] * groundRadius - other.position[1],
                      P_new[2] * groundRadius - other.position[2]
                    ];
                    const cur_dx = cur_dx_vec[0] * wallR[0] + cur_dx_vec[1] * wallR[1] + cur_dx_vec[2] * wallR[2];
                    const cur_dz = cur_dx_vec[0] * wallF[0] + cur_dx_vec[1] * wallF[1] + cur_dx_vec[2] * wallF[2];

                    const ldx = cur_dx - seg.cx;
                    const limitX = seg.hw + charRadius;
                    const limitZ = hd + charRadius;

                    if (Math.abs(ldx) < limitX && Math.abs(cur_dz) < limitZ) {
                      const penX = limitX - Math.abs(ldx);
                      const penZ = limitZ - Math.abs(cur_dz);

                      if (penX < penZ) {
                        const pushAmt = penX * Math.sign(ldx);
                        const pushVec = [wallR[0] * pushAmt, wallR[1] * pushAmt, wallR[2] * pushAmt];
                        P_new[0] += pushVec[0] / groundRadius;
                        P_new[1] += pushVec[1] / groundRadius;
                        P_new[2] += pushVec[2] / groundRadius;
                      } else {
                        const pushAmt = penZ * Math.sign(cur_dz);
                        const pushVec = [wallF[0] * pushAmt, wallF[1] * pushAmt, wallF[2] * pushAmt];
                        P_new[0] += pushVec[0] / groundRadius;
                        P_new[1] += pushVec[1] / groundRadius;
                        P_new[2] += pushVec[2] / groundRadius;
                      }

                      // Renormalize P_new after each push
                      const pLenTemp = Math.sqrt(P_new[0]*P_new[0] + P_new[1]*P_new[1] + P_new[2]*P_new[2]) || 1;
                      P_new[0] /= pLenTemp;
                      P_new[1] /= pLenTemp;
                      P_new[2] /= pLenTemp;
                    }
                  }
                }
              }
            }

            // --- COLLISION WITH WOOD WINDOWS ---
            for (let other of nearbyCollectibles) {
              if (other.active && other.type === "wood_window" && !other.isPreview) {
                const wallCenterRadius = Math.sqrt(
                  other.position[0] * other.position[0] +
                  other.position[1] * other.position[1] +
                  other.position[2] * other.position[2]
                );
                
                const wallHeight = 0.25;
                const charRadius = playerScale * 0.38;
                
                const feetRadius = groundRadius - 0.46 * playerScale;
                const headRadius = groundRadius + 0.46 * playerScale;
                
                if (headRadius > wallCenterRadius && feetRadius < wallCenterRadius + wallHeight) {
                  // Compute rotated local coordinate system of the window frame
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
                  
                  // Vector from window center to player
                  const dx_vec = [
                    P_new[0] * groundRadius - other.position[0],
                    P_new[1] * groundRadius - other.position[1],
                    P_new[2] * groundRadius - other.position[2]
                  ];
                  
                  // Project onto local axes of the window
                  const dx = dx_vec[0] * wallR[0] + dx_vec[1] * wallR[1] + dx_vec[2] * wallR[2];
                  const dz = dx_vec[0] * wallF[0] + dx_vec[1] * wallF[1] + dx_vec[2] * wallF[2];

                  // 1. Static Frame collision:
                  // The solid left and right frames of the window
                  const segments = [
                    { cx: -0.1175, hw: 0.0325 },
                    { cx: 0.1175, hw: 0.0325 }
                  ];

                  const feetHeight = feetRadius - wallCenterRadius;
                  const headHeight = headRadius - wallCenterRadius;
                  // Player is passing through the window if their feet are at or above the sill (0.08), 
                  // and not too high (feet are below 0.18, which is the top frame)
                  if (feetHeight >= 0.075 && feetHeight < 0.185) {
                    // Player is vertically inside the window opening, only block by left/right frames
                  } else {
                    // Player is outside the vertical window opening, so block the entire width
                    segments.push({ cx: 0.0, hw: 0.085 });
                  }

                  const hd = 0.02; // frame thickness half-thickness

                  for (let seg of segments) {
                    const cur_dx_vec = [
                      P_new[0] * groundRadius - other.position[0],
                      P_new[1] * groundRadius - other.position[1],
                      P_new[2] * groundRadius - other.position[2]
                    ];
                    const cur_dx = cur_dx_vec[0] * wallR[0] + cur_dx_vec[1] * wallR[1] + cur_dx_vec[2] * wallR[2];
                    const cur_dz = cur_dx_vec[0] * wallF[0] + cur_dx_vec[1] * wallF[1] + cur_dx_vec[2] * wallF[2];

                    const ldx = cur_dx - seg.cx;
                    const limitX = seg.hw + charRadius;
                    const limitZ = hd + charRadius;

                    if (Math.abs(ldx) < limitX && Math.abs(cur_dz) < limitZ) {
                      const penX = limitX - Math.abs(ldx);
                      const penZ = limitZ - Math.abs(cur_dz);

                      if (penX < penZ) {
                        const pushAmt = penX * Math.sign(ldx);
                        const pushVec = [wallR[0] * pushAmt, wallR[1] * pushAmt, wallR[2] * pushAmt];
                        P_new[0] += pushVec[0] / groundRadius;
                        P_new[1] += pushVec[1] / groundRadius;
                        P_new[2] += pushVec[2] / groundRadius;
                      } else {
                        const pushAmt = penZ * Math.sign(cur_dz);
                        const pushVec = [wallF[0] * pushAmt, wallF[1] * pushAmt, wallF[2] * pushAmt];
                        P_new[0] += pushVec[0] / groundRadius;
                        P_new[1] += pushVec[1] / groundRadius;
                        P_new[2] += pushVec[2] / groundRadius;
                      }

                      // Renormalize P_new after each push
                      const pLenTemp = Math.sqrt(P_new[0]*P_new[0] + P_new[1]*P_new[1] + P_new[2]*P_new[2]) || 1;
                      P_new[0] /= pLenTemp;
                      P_new[1] /= pLenTemp;
                      P_new[2] /= pLenTemp;
                    }
                  }

                  // 2. Window Shutters (Left & Right) collision:
                  const A = other.windowAngle || 0.0;

                  // Only collide with shutters if the player's vertical range overlaps with the window opening [0.08, 0.17]
                  if (feetHeight < 0.17 && headHeight > 0.08) {
                    const shutterLen = 0.085;
                    const shutterThickness = 0.012;
                    const colX = charRadius;
                    const colZ = shutterThickness / 2 + charRadius;

                    // --- LEFT SHUTTER CAPSULE COLLISION ---
                    const hingeLeft = [
                      other.position[0] - wallR[0] * 0.085,
                      other.position[1] - wallR[1] * 0.085,
                      other.position[2] - wallR[2] * 0.085
                    ];
                    const p_rel_left = [
                      P_new[0] * groundRadius - hingeLeft[0],
                      P_new[1] * groundRadius - hingeLeft[1],
                      P_new[2] * groundRadius - hingeLeft[2]
                    ];

                    const R_left = [
                      wallR[0] * Math.cos(A) + wallF[0] * Math.sin(A),
                      wallR[1] * Math.cos(A) + wallF[1] * Math.sin(A),
                      wallR[2] * Math.cos(A) + wallF[2] * Math.sin(A)
                    ];
                    const F_left = [
                      wallF[0] * Math.cos(A) - wallR[0] * Math.sin(A),
                      wallF[1] * Math.cos(A) - wallR[1] * Math.sin(A),
                      wallF[2] * Math.cos(A) - wallR[2] * Math.sin(A)
                    ];

                    const leftX = p_rel_left[0] * R_left[0] + p_rel_left[1] * R_left[1] + p_rel_left[2] * R_left[2];
                    const leftZ = p_rel_left[0] * F_left[0] + p_rel_left[1] * F_left[1] + p_rel_left[2] * F_left[2];

                    let isCollidingLeft = false;
                    let pushVecLeft = [0, 0, 0];

                    if (leftX >= 0 && leftX <= shutterLen) {
                      // Over the face of the shutter
                      if (Math.abs(leftZ) < colZ) {
                        isCollidingLeft = true;
                        const penZ = colZ - Math.abs(leftZ);
                        const pushAmt = penZ * (Math.sign(leftZ) || 1);
                        pushVecLeft = [F_left[0] * pushAmt, F_left[1] * pushAmt, F_left[2] * pushAmt];
                      }
                    } else if (leftX < 0 && leftX >= -charRadius) {
                      // Near the hinge - check circle collision with hinge
                      const distSq = leftX * leftX + leftZ * leftZ;
                      const limit = charRadius;
                      if (distSq < limit * limit) {
                        isCollidingLeft = true;
                        const dist = Math.sqrt(distSq) || 1e-5;
                        const pen = limit - dist;
                        const pushX = (leftX / dist) * pen;
                        const pushZ = (leftZ / dist) * pen;
                        pushVecLeft = [
                          R_left[0] * pushX + F_left[0] * pushZ,
                          R_left[1] * pushX + F_left[1] * pushZ,
                          R_left[2] * pushX + F_left[2] * pushZ
                        ];
                      }
                    } else if (leftX > shutterLen && leftX <= shutterLen + charRadius) {
                      // Near the tip - check circle collision with tip
                      const dxTip = leftX - shutterLen;
                      const distSq = dxTip * dxTip + leftZ * leftZ;
                      const limit = charRadius;
                      if (distSq < limit * limit) {
                        isCollidingLeft = true;
                        const dist = Math.sqrt(distSq) || 1e-5;
                        const pen = limit - dist;
                        const pushX = (dxTip / dist) * pen;
                        const pushZ = (leftZ / dist) * pen;
                        pushVecLeft = [
                          R_left[0] * pushX + F_left[0] * pushZ,
                          R_left[1] * pushX + F_left[1] * pushZ,
                          R_left[2] * pushX + F_left[2] * pushZ
                        ];
                      }
                    }

                    if (isCollidingLeft) {
                      P_new[0] += pushVecLeft[0] / groundRadius;
                      P_new[1] += pushVecLeft[1] / groundRadius;
                      P_new[2] += pushVecLeft[2] / groundRadius;

                      const pLenTemp = Math.sqrt(P_new[0]*P_new[0] + P_new[1]*P_new[1] + P_new[2]*P_new[2]) || 1;
                      P_new[0] /= pLenTemp;
                      P_new[1] /= pLenTemp;
                      P_new[2] /= pLenTemp;
                    }

                    // --- RIGHT SHUTTER CAPSULE COLLISION ---
                    const hingeRight = [
                      other.position[0] + wallR[0] * 0.085,
                      other.position[1] + wallR[1] * 0.085,
                      other.position[2] + wallR[2] * 0.085
                    ];
                    const p_rel_right = [
                      P_new[0] * groundRadius - hingeRight[0],
                      P_new[1] * groundRadius - hingeRight[1],
                      P_new[2] * groundRadius - hingeRight[2]
                    ];

                    const leafR_right = [
                      -wallR[0] * Math.cos(A) + wallF[0] * Math.sin(A),
                      -wallR[1] * Math.cos(A) + wallF[1] * Math.sin(A),
                      -wallR[2] * Math.cos(A) + wallF[2] * Math.sin(A)
                    ];
                    const leafF_right = [
                      wallF[0] * Math.cos(A) + wallR[0] * Math.sin(A),
                      wallF[1] * Math.cos(A) + wallR[1] * Math.sin(A),
                      wallF[2] * Math.cos(A) + wallR[2] * Math.sin(A)
                    ];

                    const rightX = p_rel_right[0] * leafR_right[0] + p_rel_right[1] * leafR_right[1] + p_rel_right[2] * leafR_right[2];
                    const rightZ = p_rel_right[0] * leafF_right[0] + p_rel_right[1] * leafF_right[1] + p_rel_right[2] * leafF_right[2];

                    let isCollidingRight = false;
                    let pushVecRight = [0, 0, 0];

                    if (rightX >= 0 && rightX <= shutterLen) {
                      // Over the face of the shutter
                      if (Math.abs(rightZ) < colZ) {
                        isCollidingRight = true;
                        const penZ = colZ - Math.abs(rightZ);
                        const pushAmt = penZ * (Math.sign(rightZ) || 1);
                        pushVecRight = [leafF_right[0] * pushAmt, leafF_right[1] * pushAmt, leafF_right[2] * pushAmt];
                      }
                    } else if (rightX < 0 && rightX >= -charRadius) {
                      // Near the hinge - check circle collision with hinge
                      const distSq = rightX * rightX + rightZ * rightZ;
                      const limit = charRadius;
                      if (distSq < limit * limit) {
                        isCollidingRight = true;
                        const dist = Math.sqrt(distSq) || 1e-5;
                        const pen = limit - dist;
                        const pushX = (rightX / dist) * pen;
                        const pushZ = (rightZ / dist) * pen;
                        pushVecRight = [
                          leafR_right[0] * pushX + leafF_right[0] * pushZ,
                          leafR_right[1] * pushX + leafF_right[1] * pushZ,
                          leafR_right[2] * pushX + leafF_right[2] * pushZ
                        ];
                      }
                    } else if (rightX > shutterLen && rightX <= shutterLen + charRadius) {
                      // Near the tip - check circle collision with tip
                      const dxTip = rightX - shutterLen;
                      const distSq = dxTip * dxTip + rightZ * rightZ;
                      const limit = charRadius;
                      if (distSq < limit * limit) {
                        isCollidingRight = true;
                        const dist = Math.sqrt(distSq) || 1e-5;
                        const pen = limit - dist;
                        const pushX = (dxTip / dist) * pen;
                        const pushZ = (rightZ / dist) * pen;
                        pushVecRight = [
                          leafR_right[0] * pushX + leafF_right[0] * pushZ,
                          leafR_right[1] * pushX + leafF_right[1] * pushZ,
                          leafR_right[2] * pushX + leafF_right[2] * pushZ
                        ];
                      }
                    }

                    if (isCollidingRight) {
                      P_new[0] += pushVecRight[0] / groundRadius;
                      P_new[1] += pushVecRight[1] / groundRadius;
                      P_new[2] += pushVecRight[2] / groundRadius;

                      const pLenTemp = Math.sqrt(P_new[0]*P_new[0] + P_new[1]*P_new[1] + P_new[2]*P_new[2]) || 1;
                      P_new[0] /= pLenTemp;
                      P_new[1] /= pLenTemp;
                      P_new[2] /= pLenTemp;
                    }
                  }
                }
              }
            }

            // --- COLLISION WITH WOOD DOORS ---
            for (let other of nearbyCollectibles) {
              if (other.active && other.type === "wood_door" && !other.isPreview) {
                const p3x = P_new[0] * groundRadius;
                const p3y = P_new[1] * groundRadius;
                const p3z = P_new[2] * groundRadius;
                
                const dx_vec_x = p3x - other.position[0];
                const dx_vec_y = p3y - other.position[1];
                const dx_vec_z = p3z - other.position[2];
                const distSq = dx_vec_x * dx_vec_x + dx_vec_y * dx_vec_y + dx_vec_z * dx_vec_z;
                if (distSq > 0.16) { // 0.4 * 0.4 = 0.16
                  continue;
                }

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
                const wallR = other._wallR;
                const wallF = other._wallF;
                
                const wallHeight = 0.25;
                const charRadius = playerScale * 0.38;
                
                const feetRadius = groundRadius - 0.46 * playerScale;
                const headRadius = groundRadius + 0.46 * playerScale;
                
                if (headRadius > wallCenterRadius && feetRadius < wallCenterRadius + wallHeight) {
                  // Project onto local axes of the door frame
                  const dx = dx_vec_x * wallR[0] + dx_vec_y * wallR[1] + dx_vec_z * wallR[2];
                  const dz = dx_vec_x * wallF[0] + dx_vec_y * wallF[1] + dx_vec_z * wallF[2];

                  let blockedByPost = false;
                  let postSide = '';
                  let pushed = false;
                  let appliedTorque = 0.0;

                  // 1. Static Frame/Posts collision:
                  // The posts are at the sides of the door (from 0.063 to 0.075, and from -0.063 to -0.075).
                  // If the player tries to walk through the side posts, they should be blocked.
                  const postRadius = 0.012;
                  const leftPostDx = dx - (-0.069);
                  const rightPostDx = dx - 0.069;
                  const collRad = postRadius + charRadius;
                  
                  // Simple circle collision check for left post:
                  const leftDistSq = leftPostDx * leftPostDx + dz * dz;
                  if (leftDistSq < collRad * collRad) {
                    blockedByPost = true;
                    postSide = 'left';
                    const dist = Math.sqrt(leftDistSq) || 1.0;
                    const pen = collRad - dist;
                    const pushX = (leftPostDx / dist) * pen;
                    const pushZ = (dz / dist) * pen;
                    const pushVec = [wallR[0] * pushX + wallF[0] * pushZ, wallR[1] * pushX + wallF[1] * pushZ, wallR[2] * pushX + wallF[2] * pushZ];
                    P_new[0] += pushVec[0] / groundRadius;
                    P_new[1] += pushVec[1] / groundRadius;
                    P_new[2] += pushVec[2] / groundRadius;
                  }

                  // Simple circle collision check for right post:
                  const rightDistSq = rightPostDx * rightPostDx + dz * dz;
                  if (rightDistSq < collRad * collRad) {
                    blockedByPost = true;
                    postSide = 'right';
                    const dist = Math.sqrt(rightDistSq) || 1.0;
                    const pen = collRad - dist;
                    const pushX = (rightPostDx / dist) * pen;
                    const pushZ = (dz / dist) * pen;
                    const pushVec = [wallR[0] * pushX + wallF[0] * pushZ, wallR[1] * pushX + wallF[1] * pushZ, wallR[2] * pushX + wallF[2] * pushZ];
                    P_new[0] += pushVec[0] / groundRadius;
                    P_new[1] += pushVec[1] / groundRadius;
                    P_new[2] += pushVec[2] / groundRadius;
                  }

                  // 2. Door leaf (swingable) collision and push:
                  // Hinge is at wallR * -0.063.
                  // The door leaf rotated coordinates relative to the hinge:
                  const hinge = [
                    other.position[0] - wallR[0] * 0.063,
                    other.position[1] - wallR[1] * 0.063,
                    other.position[2] - wallR[2] * 0.063
                  ];
                  const p_rel = [
                    P_new[0] * groundRadius - hinge[0],
                    P_new[1] * groundRadius - hinge[1],
                    P_new[2] * groundRadius - hinge[2]
                  ];

                  const doorAngle = other.doorAngle || 0.0;
                  const cosD = Math.cos(doorAngle);
                  const sinD = Math.sin(doorAngle);

                  // Local right axis of leaf:
                  const leafR = [
                    wallR[0] * cosD + wallF[0] * sinD,
                    wallR[1] * cosD + wallF[1] * sinD,
                    wallR[2] * cosD + wallF[2] * sinD
                  ];
                  // Local forward axis of leaf (thickness normal):
                  const leafF = [
                    wallF[0] * cosD - wallR[0] * sinD,
                    wallF[1] * cosD - wallR[1] * sinD,
                    wallF[2] * cosD - wallR[2] * sinD
                  ];

                  const leafX = p_rel[0] * leafR[0] + p_rel[1] * leafR[1] + p_rel[2] * leafR[2];
                  const leafZ = p_rel[0] * leafF[0] + p_rel[1] * leafF[1] + p_rel[2] * leafF[2];

                  // Check if player's cylinder overlaps the door leaf
                  const leafLength = 0.125; // leaf width from hinge (half-width)
                  const leafThickness = 0.015;
                  const colX = charRadius;
                  const colZ = leafThickness / 2 + charRadius;

                  // Player overlaps the door leaf range
                  if (leafX >= -colX && leafX <= leafLength + colX && Math.abs(leafZ) < colZ) {
                    // Push the door!
                    // Torque is applied in the direction of the push
                    if (other.doorVel === undefined) other.doorVel = 0.0;
                    
                    const leverArm = Math.max(0.05, Math.min(leafLength, leafX));
                    const forceFactor = 22.0; // Dynamic push strength
                    const forceSign = -Math.sign(leafZ);
                    const pushTorque = forceSign * forceFactor * (leverArm / leafLength);
                    
                    pushed = true;
                    appliedTorque = pushTorque;
                    other.doorVel += pushTorque * dt;
                    // No need to set pendingCollectibleRefresh = true; as doorActiveSwinging will be true and refresh the dynamic buffer instead of the entire static world.

                    // Always block the player physically so they cannot clip or slide through the solid wood door leaf panel
                    const penZ = colZ - Math.abs(leafZ);
                    const pushAmt = penZ * Math.sign(leafZ);
                    const pushVec = [leafF[0] * pushAmt, leafF[1] * pushAmt, leafF[2] * pushAmt];
                    P_new[0] += pushVec[0] / groundRadius;
                    P_new[1] += pushVec[1] / groundRadius;
                    P_new[2] += pushVec[2] / groundRadius;
                  }

                  if (typeof window.logDoorCollision === "function") {
                    const doorId = other.id || `x${other.position[0].toFixed(1)}y${other.position[1].toFixed(1)}z${other.position[2].toFixed(1)}`;
                    const playerPos = [P_new[0] * groundRadius, P_new[1] * groundRadius, P_new[2] * groundRadius];
                    window.logDoorCollision(
                      doorId,
                      playerPos,
                      other.position,
                      dx,
                      dz,
                      leafX,
                      leafZ,
                      appliedTorque,
                      doorAngle,
                      other.doorVel || 0.0,
                      pushed,
                      blockedByPost,
                      postSide
                    );
                  }

                }
              }
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

            charHeight = getHeightOnSphere(charTheta, charPhi, globalSeed);

            let feetRadiusBeforeForSwim = (playerCenterRadius !== null) ? (playerCenterRadius - 0.46 * charScale) : (RADIUS + charHeight * HEIGHT_SCALE);
            const caveDataForSwim = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(nx, ny, nz, feetRadiusBeforeForSwim) : { ground: RADIUS + charHeight * HEIGHT_SCALE, ceiling: Infinity, insideTunnel: false };
            let tRadius = caveDataForSwim.ground;
            let wRadius = getWaterRadiusAt(nx * feetRadiusBeforeForSwim, ny * feetRadiusBeforeForSwim, nz * feetRadiusBeforeForSwim);
            
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

            px = playerCenterRadius * nx;
            py = playerCenterRadius * ny;
            pz = playerCenterRadius * nz;
          
        } else {
          isWalking = false;
          const phaseWrap = walkPhase % (Math.PI * 2);
          if (phaseWrap !== 0) {
            const targetAngle = Math.round(walkPhase / Math.PI) * Math.PI;
            walkPhase += (targetAngle - walkPhase) * 0.18 * timeScale;
          }

          if (activeRidingBoat || activeRidingMech) {
            const tRadius = RADIUS + getHeightOnSphere(charTheta, charPhi, globalSeed) * HEIGHT_SCALE;
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

          px = playerCenterRadius * nx;
          py = playerCenterRadius * ny;
          pz = playerCenterRadius * nz;
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
            let height = getHeightOnSphere(charTheta, charPhi, globalSeed);
            let tRadius = RADIUS + height * HEIGHT_SCALE;
            
            // If water is disabled or terrain is higher than water, float on terrain instead of water
            let baseRadius = (waterEnabled && tRadius < wRadius) ? wRadius : tRadius;
            if (waterEnabled && tRadius < wRadius) {
                const wave = getWaterWave(nx * wRadius, ny * wRadius, nz * wRadius, waterAnimTime, waveStrength);
                let depth = wRadius - tRadius;
                let fade = Math.min(1.0, Math.max(0.0, depth / 0.1));
                baseRadius += wave * fade;
            }
            // Gravity system for wheeled boat
            let isLandVehicle = activeRidingBoat.hasWheel || activeRidingBoat.hasWheels || (activeRidingBoat.wheelCount && activeRidingBoat.wheelCount > 0);
            let bR = baseRadius - 0.04;
            let targetGroundRadius = bR;

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

            if (activeRidingBoat.hasWheel || activeRidingBoat.hasWheels || (activeRidingBoat.wheelCount && activeRidingBoat.wheelCount > 0)) {
                const fSideOff = typeof window.wheelFrontSideOffset === "number" ? window.wheelFrontSideOffset : 0.18;
                const fFwdOff  = typeof window.wheelFrontFwdOffset  === "number" ? window.wheelFrontFwdOffset  : 0.18;
                const fUpOff   = typeof window.wheelFrontUpOffset   === "number" ? window.wheelFrontUpOffset   : -0.03;

                const rSideOff = typeof window.wheelRearSideOffset === "number" ? window.wheelRearSideOffset : 0.18;
                const rFwdOff  = typeof window.wheelRearFwdOffset  === "number" ? window.wheelRearFwdOffset  : 0.18;
                const rUpOff   = typeof window.wheelRearUpOffset   === "number" ? window.wheelRearUpOffset   : -0.03;

                const wheelScale = typeof window.wheelScaleMultiplier === "number" ? window.wheelScaleMultiplier : 1.0;
                const wheelRadius = 0.16 * wheelScale;

                const wheelOffsets = [
                    { id: "FL", side: -1, fwd: fFwdOff,  sOff: fSideOff, uOff: fUpOff },
                    { id: "FR", side: 1,  fwd: fFwdOff,  sOff: fSideOff, uOff: fUpOff },
                    { id: "RL", side: -1, fwd: -rFwdOff, sOff: rSideOff, uOff: rUpOff },
                    { id: "RR", side: 1,  fwd: -rFwdOff, sOff: rSideOff, uOff: rUpOff }
                ];

                let maxWheelRequiredRadius = -Infinity;
                let wHeights = [];

                for (let wo of wheelOffsets) {
                    let wOffX = bR_vec[0] * (wo.side * wo.sOff) + nx * wo.uOff + bF[0] * wo.fwd;
                    let wOffY = bR_vec[1] * (wo.side * wo.sOff) + ny * wo.uOff + bF[1] * wo.fwd;
                    let wOffZ = bR_vec[2] * (wo.side * wo.sOff) + nz * wo.uOff + bF[2] * wo.fwd;

                    let wWorldX = tRadius * nx + wOffX;
                    let wWorldY = tRadius * ny + wOffY;
                    let wWorldZ = tRadius * nz + wOffZ;

                    let wR = Math.sqrt(wWorldX*wWorldX + wWorldY*wWorldY + wWorldZ*wWorldZ) || 1;
                    let wTheta = Math.acos(Math.max(-1, Math.min(1, wWorldY / wR)));
                    let wPhi = Math.atan2(wWorldZ, wWorldX);

                    let wTerrainH = getHeightOnSphere(wTheta, wPhi, globalSeed);
                    let wTerrainRad = RADIUS + wTerrainH * HEIGHT_SCALE;
                    
                    let wSurfaceRad = wTerrainRad;
                    if (waterEnabled && wTerrainRad < wRadius) {
                        let waveVal = getWaterWave(wWorldX, wWorldY, wWorldZ, waterAnimTime, waveStrength);
                        let depth = wRadius - wTerrainRad;
                        let fade = Math.min(1.0, Math.max(0.0, depth / 0.1));
                        wSurfaceRad = wRadius + waveVal * fade;
                    }
                    wHeights.push(wSurfaceRad); // Use surface (water or terrain) for pitch/roll

                    let requiredBoatRad = wTerrainRad + wheelRadius - wo.uOff; // Use actual terrain for physical lift
                    if (requiredBoatRad > maxWheelRequiredRadius) {
                        maxWheelRequiredRadius = requiredBoatRad;
                    }
                }

                if (maxWheelRequiredRadius > -Infinity) {
                    targetGroundRadius = Math.max(targetGroundRadius, maxWheelRequiredRadius);
                }

                // Pitch & Roll slope alignment from 4 wheel contacts
                if (wHeights.length === 4) {
                    let fl = wHeights[0], fr = wHeights[1], rl = wHeights[2], rr = wHeights[3];
                    let fAvg = (fl + fr) * 0.5;
                    let rAvg = (rl + rr) * 0.5;
                    let lAvg = (fl + rl) * 0.5;
                    let rSideAvg = (fr + rr) * 0.5;

                    let pitchGrade = (fAvg - rAvg) / (fFwdOff + rFwdOff + 0.001);
                    let rollGrade  = (rSideAvg - lAvg) / (fSideOff + rSideOff + 0.001);

                    pitchGrade = Math.max(-0.5, Math.min(0.5, pitchGrade));
                    rollGrade  = Math.max(-0.5, Math.min(0.5, rollGrade));
                    
                    activeRidingBoat.pitchGrade = pitchGrade;

                    let tiltNx = nx + bF[0] * pitchGrade * 0.4 + bR_vec[0] * rollGrade * 0.4;
                    let tiltNy = ny + bF[1] * pitchGrade * 0.4 + bR_vec[1] * rollGrade * 0.4;
                    let tiltNz = nz + bF[2] * pitchGrade * 0.4 + bR_vec[2] * rollGrade * 0.4;
                    let tiltLen = Math.sqrt(tiltNx*tiltNx + tiltNy*tiltNy + tiltNz*tiltNz) || 1;
                    
                    let newNx = tiltNx / tiltLen;
                    let newNy = tiltNy / tiltLen;
                    let newNz = tiltNz / tiltLen;

                    let dotFN = bF[0]*newNx + bF[1]*newNy + bF[2]*newNz;
                    bF = [bF[0] - newNx*dotFN, bF[1] - newNy*dotFN, bF[2] - newNz*dotFN];
                    let fLen = Math.sqrt(bF[0]*bF[0] + bF[1]*bF[1] + bF[2]*bF[2]) || 1;
                    bF = [bF[0]/fLen, bF[1]/fLen, bF[2]/fLen];

                    bR_vec = [
                        newNy*bF[2] - newNz*bF[1],
                        newNz*bF[0] - newNx*bF[2],
                        newNx*bF[1] - newNy*bF[0]
                    ];
                    
                    activeRidingBoat.normal = [newNx, newNy, newNz];
                }
            }

            if (isLandVehicle) {
                if (activeRidingBoat.currentRadius === undefined) {
                    activeRidingBoat.currentRadius = targetGroundRadius;
                    activeRidingBoat.verticalVel = 0;
                }
                
                // Apply Gravity
                activeRidingBoat.verticalVel = Physics.applyVerticalGravity(activeRidingBoat.verticalVel, 1.0, Physics.gravityAccel);
                activeRidingBoat.currentRadius += activeRidingBoat.verticalVel;
                
                // Ground collision
                if (activeRidingBoat.currentRadius <= targetGroundRadius) {
                    // Slight bounce or just stop
                    activeRidingBoat.currentRadius = targetGroundRadius;
                    activeRidingBoat.verticalVel = 0;
                }
                
                bR = activeRidingBoat.currentRadius;
            }

            activeRidingBoat.position = [bR * nx, bR * ny, bR * nz];
            playerCenterRadius = bR + 0.46 * charScale;
            px = playerCenterRadius * nx;
            py = playerCenterRadius * ny;
            pz = playerCenterRadius * nz;

            // let isLandVehicle = activeRidingBoat.hasWheel || activeRidingBoat.hasWheels || (activeRidingBoat.wheelCount && activeRidingBoat.wheelCount > 0);
            if (!isLandVehicle || !activeRidingBoat.normal) {
                activeRidingBoat.normal = [nx, ny, nz];
            }
            activeRidingBoat.angle = undefined; // clear fixed placement angle
            activeRidingBoat.F = bF;
            activeRidingBoat.R = bR_vec;
        } else if (activeRidingMech) {
            let height = getHeightOnSphere(charTheta, charPhi, globalSeed);
            let tRadius = RADIUS + height * HEIGHT_SCALE;
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

                if (typeof collectibles !== "undefined" && collectibles) {
                    for (let p of collectibles) {
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

        if (cameraMode !== "tps" && cameraMode !== "thirdperson" && cameraMode !== "fps" && cameraMode !== "planet") {
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
          viewMatrix = createLookAt(eyePos, [0, 0, 0], [0, 1, 0]);
        }

        window.eyePos = eyePos;
        window.player3DPos = [px, py, pz];
        window.rotationY = rotationY;

        const camDist = Math.sqrt(eyePos[0] * eyePos[0] + eyePos[1] * eyePos[1] + eyePos[2] * eyePos[2]);
        let isCameraUnderwater = camDist < waterRadius;
        lastIsCameraUnderwater = isCameraUnderwater;

        // คำนวณทิศทางแสงวงโคจรของดวงอาทิตย์ (หมุนตามวงโคจร)
        const orbitSpeed = 0.08; // ความเร็วของดวงอาทิตย์ที่งดงาม หมุนเปลี่ยนกลางวันกลางคืนได้อย่างลงตัว
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

        // อัปเดตตำแหน่งและรูปทรงเงามืดตามวงโคจรของแสงดวงอาทิตย์ (ใช้ระบบเงาคำนวณสดบน GPU ไม่ต้องรันฝั่ง CPU แล้ว)

        const aspect = canvas.width / canvas.height;
        const modelMatrix = createIdentity();
        const modelViewMatrix = multiplyMatrices(viewMatrix, modelMatrix);
        const dynamicNear = window.cameraNearPlane || 0.05;
        const projMatrix = createPerspective(Math.PI / 4, aspect, dynamicNear, 100000);

        // TAAU (Temporal Anti-Aliasing Upsampling) sub-pixel temporal jittering
        if (typeof taauEnabled !== "undefined" && taauEnabled) {
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
        if (typeof FrustumCullingSystem !== "undefined" && FrustumCullingSystem.updateFrustumPlanes) {
          const viewProj = multiplyMatrices(viewMatrix, projMatrix);
          frustumPlanes = FrustumCullingSystem.updateFrustumPlanes(viewProj, frustumCullingEnabled);
        } else if (frustumCullingEnabled && typeof getFrustumPlanes === "function") {
          const viewProj = multiplyMatrices(viewMatrix, projMatrix);
          frustumPlanes = getFrustumPlanes(viewProj);
        }

        // Check interaction distance for UI prompt
        const prompt = document.getElementById("interactPrompt");
        if (prompt) {
          const px = charTheta;
          const py = charPhi;
          const r_terrain = RADIUS + getHeightOnSphere(charTheta, charPhi, globalSeed) * HEIGHT_SCALE;
          const r = typeof playerCenterRadius !== 'undefined' && playerCenterRadius !== null ? playerCenterRadius - 0.46 * playerScale : r_terrain;
          const pVec = [
            r * Math.sin(px) * Math.cos(py),
            r * Math.cos(px),
            r * Math.sin(px) * Math.sin(py),
          ];
          if (isDemolishModeEnabled) {
            const demolishableTypes = ["wood_floor", "thin_wood_floor", "stone_floor", "wood_stairs", "campfire", "wood_boat", "wood_wheel", "wood_wall", "wood_window", "wood_door", "wood_chest", "meganeura_item"];
            let closestDemolishItem = null;
            let minDemolishDist = actionReachDistance;
            let currentBestDist = Infinity;
            for (let item of collectibles) {
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
                canvas.clientWidth,
                canvas.clientHeight,
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

                prompt.innerHTML = `<div style="margin: -8px -16px; padding: 8px 16px; position: relative; overflow: hidden; border-radius: 8px; background: rgba(220, 38, 38, 0.95); border: 1px solid #ff4d4d; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                  ${isStoneFloor ? `<div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${holdPercent}%; background: rgba(255, 255, 255, 0.35); pointer-events: none; transition: width 0.05s ease-out;"></div>` : ""}
                  <div style="position: relative; z-index: 1; text-align: center; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #ffffff;">
                    ${instructionsHTML}
                    <span style="font-size: 9px; opacity: 0.8; display: block; margin-top: 4px;">ระยะห่าง / Distance: ${currentBestDist.toFixed(2)} / ${minDemolishDist.toFixed(2)}</span>
                  </div>
                </div>`;
                prompt.style.display = "block";
                prompt.style.left = screenPos.x + "px";
                prompt.style.top = screenPos.y - 45 + "px";
              } else {
                prompt.style.display = "none";
            }
          } else {
              demolishHoldTimer = 0.0;
              prompt.style.display = "none";
            }
          } else if (false) {
            // Disabled orange terrain mod banner
            demolishHoldTimer = 0.0;
            prompt.innerHTML = `<div style="margin: -8px -16px; padding: 10px 20px; position: relative; overflow: hidden; border-radius: 8px; background: rgba(230, 81, 0, 0.95); border: 1px solid #ff9800; box-shadow: 0 4px 12px rgba(0,0,0,0.5); text-align: center; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #ffffff;">
              <strong>⛏️ โหมดปรับแต่งพื้นผิวดาว (TERRAIN MOD MODE)</strong><br/>
              คลิกซ้าย: ขุดหลุม / Left-click: Dig<br/>
              คลิกขวา: ถมดิน / Right-click: Raise
            </div>`;
            prompt.style.display = "block";
            prompt.style.left = "50%";
            prompt.style.top = "80%";
          } else {
            demolishHoldTimer = 0.0;
            if (activeRidingBoat) {
              let rLen = Math.sqrt(activeRidingBoat.position[0]**2 + activeRidingBoat.position[1]**2 + activeRidingBoat.position[2]**2) || 1;
              let bTheta = Math.acos(Math.max(-1, Math.min(1, activeRidingBoat.position[1] / rLen)));
              let bPhi = Math.atan2(activeRidingBoat.position[2], activeRidingBoat.position[0]);
              let bHeight = getHeightOnSphere(bTheta, bPhi, globalSeed);
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
                  }
                  boatToDismount.isDynamic = true;
                  boatToDismount.vel = [0, 0, 0];
                  activeRidingBoat = null;
            }
          } else {
                chestHoldTimer = 0.0;
              }
              const holdPercent = Math.min(100, Math.floor((chestHoldTimer / 0.8) * 100));
              let actionText = "กด [E] ค้าง เพื่อ ลงจากเรือ<br>Hold [E] to Dismount";
              let extraStatus = (!canRideBoat) ? "<br><span style='font-size: 9px; color: #ff8888;'>น้ำตื้นเกินไป พายไม่ได้ (Too shallow to row)</span>" : "";
              
              prompt.innerHTML = `<div style="margin: -8px -16px; padding: 8px 16px; position: relative; overflow: hidden; border-radius: 8px;">
                <div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${holdPercent}%; background: rgba(223, 183, 108, 0.4); pointer-events: none; transition: width 0.05s ease-out;"></div>
                <div style="position: relative; z-index: 1; text-align: center; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #dfb76c;">
                  กด [E] ค้าง เพื่อ ${actionText}
                  ${extraStatus}
                </div>
              </div>`;
              prompt.style.display = "block";
              prompt.style.left = "50%";
              prompt.style.top = "80%";
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
                    }
                    mechToDismount.isDynamic = false;
                    mechToDismount.vel = [0, 0, 0];

                    if (mechToDismount.position) {
                      const mPos = mechToDismount.position;
                      const mLen = Math.sqrt(mPos[0]*mPos[0] + mPos[1]*mPos[1] + mPos[2]*mPos[2]) || 1;
                      const mnx = mPos[0] / mLen, mny = mPos[1] / mLen, mnz = mPos[2] / mLen;
                      let mTheta = Math.acos(Math.max(-1.0, Math.min(1.0, mny)));
                      let mPhi = Math.atan2(mnz, mnx);
                      let mGroundRad = RADIUS + getHeightOnSphere(mTheta, mPhi, globalSeed) * HEIGHT_SCALE;
                      const wRad = RADIUS + waterLevel * 0.15;
                      if (waterEnabled && mGroundRad < wRad) mGroundRad = wRad;

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

              prompt.innerHTML = `<div style="margin: -8px -16px; padding: 8px 16px; position: relative; overflow: hidden; border-radius: 8px;">
                <div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${holdPercent}%; background: rgba(108, 183, 223, 0.4); pointer-events: none; transition: width 0.05s ease-out;"></div>
                <div style="position: relative; z-index: 1; text-align: center; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #6cb7df;">
                  กด [E] ค้าง เพื่อ ${actionText}
                  ${extraStatus}
                </div>
              </div>`;
              prompt.style.display = "block";
              prompt.style.left = "50%";
              prompt.style.top = "80%";
            } else {
              let closestItem = null;
              let bestItemDistSq = Infinity;
              for (let item of collectibles) {
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
                for (let item of collectibles) {
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
                for (let item of collectibles) {
                  if (item.active && item.type === "robot_cockpit" && !item.isPreview) {
                    let mechParts = [item];
                    for (let p of collectibles) {
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
                for (let item of collectibles) {
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
                for (let item of collectibles) {
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
                for (let item of collectibles) {
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
                  canvas.clientWidth,
                  canvas.clientHeight,
                );
                if (screenPos) {
                  prompt.textContent = `[${currentKeyBindings.interact.replace("Key", "").replace("Arrow", "")}]`;
                  prompt.style.display = "block";
                  prompt.style.left = screenPos.x + "px";
                  prompt.style.top = screenPos.y - 20 + "px";
                } else {
                  prompt.style.display = "none";
                }
              } else if (closestChest) {
                const screenPos = projectWorldToScreen(
                  closestChest.position,
                  viewMatrix,
                  projMatrix,
                  canvas.clientWidth,
                  canvas.clientHeight,
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
                  prompt.innerHTML = `<div style="margin: -8px -16px; padding: 8px 16px; position: relative; overflow: hidden; border-radius: 8px;">
                    <div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${holdPercent}%; background: rgba(223, 183, 108, 0.4); pointer-events: none; transition: width 0.05s ease-out;"></div>
                    <div style="position: relative; z-index: 1; text-align: center; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #dfb76c;">
                      กด [E] ค้าง เพื่อเปิดกล่องไม้<br/>
                      (HOLD [E] TO OPEN CHEST)
                    </div>
                  </div>`;
                  prompt.style.display = "block";
                  prompt.style.left = screenPos.x + "px";
                  prompt.style.top = screenPos.y - 45 + "px";
                } else {
                  prompt.style.display = "none";
                  chestHoldTimer = 0.0;
                }
              
              } else if (closestCampfire) {
                const screenPos = projectWorldToScreen(
                  closestCampfire.position,
                  viewMatrix,
                  projMatrix,
                  canvas.clientWidth,
                  canvas.clientHeight,
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
                  prompt.innerHTML = `<div style="margin: -8px -16px; padding: 8px 16px; position: relative; overflow: hidden; border-radius: 8px;">
                    <div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${holdPercent}%; background: rgba(223, 108, 108, 0.4); pointer-events: none; transition: width 0.05s ease-out;"></div>
                    <div style="position: relative; z-index: 1; text-align: center; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #df6c6c;">
                      กด [E] ค้าง เพื่อทำอาหาร<br/>
                      (HOLD [E] TO COOK)
                    </div>
                  </div>`;
                  prompt.style.display = "block";
                  prompt.style.left = screenPos.x + "px";
                  prompt.style.top = screenPos.y - 45 + "px";
                } else {
                  prompt.style.display = "none";
                  campfireHoldTimer = 0.0;
                }
} else if (closestBoat) {
                const screenPos = projectWorldToScreen(
                  closestBoat.position,
                  viewMatrix,
                  projMatrix,
                  canvas.clientWidth,
                  canvas.clientHeight,
                );
                if (screenPos) {
                  let rLen = Math.sqrt(closestBoat.position[0]**2 + closestBoat.position[1]**2 + closestBoat.position[2]**2) || 1;
                  let bTheta = Math.acos(Math.max(-1, Math.min(1, closestBoat.position[1] / rLen)));
                  let bPhi = Math.atan2(closestBoat.position[2], closestBoat.position[0]);
                  let bHeight = getHeightOnSphere(bTheta, bPhi, globalSeed);
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
                  let actionText = (closestBoat.hasWheel || closestBoat.hasWheels) ? "ขึ้นขับเรือบก<br>Drive Land Boat" : (canRideBoat ? "ขึ้นเรือพาย<br>Ride Boat" : "ติดล้อไม้เพื่อขับเรือบนบก<br>Attach Wooden Wheel for Land");
                  let extraStatus = "";

                  prompt.innerHTML = `<div style="margin: -8px -16px; padding: 8px 16px; position: relative; overflow: hidden; border-radius: 8px;">
                    <div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${holdPercent}%; background: rgba(223, 183, 108, 0.4); pointer-events: none; transition: width 0.05s ease-out;"></div>
                    <div style="position: relative; z-index: 1; text-align: center; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #dfb76c;">
                      กด [E] ค้าง เพื่อ ${actionText}
                      ${extraStatus}
                    </div>
                  </div>`;
                  prompt.style.display = "block";
                  prompt.style.left = screenPos.x + "px";
                  prompt.style.top = screenPos.y - 45 + "px";
                } else {
                  prompt.style.display = "none";
                  chestHoldTimer = 0.0;
                }
              } else if (closestMech) {
                const screenPos = projectWorldToScreen(
                  closestMechTargetPos || closestMech.position,
                  viewMatrix,
                  projMatrix,
                  canvas.clientWidth,
                  canvas.clientHeight,
                );
                if (screenPos) {
                  const isInteractHeld = keysPressed[currentKeyBindings.interact] || keysPressed["KeyE"];
                  if (isInteractHeld) {
                    chestHoldTimer += delta / 1000;
                    if (chestHoldTimer >= 0.8) {
                      chestHoldTimer = 0.0;
                      activeRidingMech = closestMech;
                      activeRidingMech.isDynamic = true;

                      let mStand = null;
                      if (typeof collectibles !== "undefined" && Array.isArray(collectibles)) {
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
                      for (let p of collectibles) {
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

                  prompt.innerHTML = `<div style="margin: -8px -16px; padding: 8px 16px; position: relative; overflow: hidden; border-radius: 8px;">
                    <div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${holdPercent}%; background: rgba(108, 183, 223, 0.4); pointer-events: none; transition: width 0.05s ease-out;"></div>
                    <div style="position: relative; z-index: 1; text-align: center; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #6cb7df;">
                      กด [E] ค้าง เพื่อ ${actionText}
                    </div>
                  </div>`;
                  prompt.style.display = "block";
                  prompt.style.left = screenPos.x + "px";
                  prompt.style.top = screenPos.y - 45 + "px";
                } else {
                  prompt.style.display = "none";
                  chestHoldTimer = 0.0;
                }
              } else if (activeInteractWindow) {
                chestHoldTimer = 0.0;
                const screenPos = projectWorldToScreen(
                  activeInteractWindow.position,
                  viewMatrix,
                  projMatrix,
                  canvas.clientWidth,
                  canvas.clientHeight,
                );
                if (screenPos) {
                  const currentAngle = activeInteractWindow.windowAngle || 0.0;
                  const actionName = (currentAngle < 0.78) ? "เปิดหน้าต่าง (Hold E)" : "ปิดหน้าต่าง (Hold E)";
                  prompt.textContent = actionName;
                  prompt.style.display = "block";
                  prompt.style.left = screenPos.x + "px";
                  prompt.style.top = screenPos.y - 20 + "px";
                } else {
                  prompt.style.display = "none";
            }
          } else {
                chestHoldTimer = 0.0;
                prompt.style.display = "none";
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
            const pRad = (typeof RADIUS !== "undefined" ? RADIUS : 100) + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(charTheta, charPhi, typeof globalSeed !== "undefined" ? globalSeed : 0) * (typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE : 1) : 0);
            player3D = [
              Math.sin(charTheta) * Math.cos(charPhi) * pRad,
              Math.cos(charTheta) * pRad,
              Math.sin(charTheta) * Math.sin(charPhi) * pRad
            ];
          }

          for (let item of collectibles) {
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
          for (let p of collectibles) {
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

        if (typeof window.updateMechStandUI === "function") {
          window.updateMechStandUI(nearbyStand, standParts);
        }

        // Check distance to closest alive NPC for Kill Prompt
        const npcPrompt = document.getElementById("npcKillPrompt");
        if (npcPrompt) {
          const px = charTheta;
          const py = charPhi;
          const r_terrain = RADIUS + getHeightOnSphere(charTheta, charPhi, globalSeed) * HEIGHT_SCALE;
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
              if (npc.type === 'meganeura' && !npc.ragdollEnabled) continue;
              if (npc.type !== 'meganeura' && !isDevMode) continue;
              if (npc.type !== 'meganeura' && npc.ragdollEnabled) continue;

              const pos = npc.ragdollPos || npc.position;
              if (!pos) continue;
              const dx = pVec[0] - pos[0];
              const dy = pVec[1] - pos[1];
              const dz = pVec[2] - pos[2];
              const distSq = dx * dx + dy * dy + dz * dz;
              if (distSq < 0.25) {
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
              canvas.clientWidth,
              canvas.clientHeight,
            );
            if (screenPos) {
              const keyText = currentKeyBindings.interact
                .replace("Key", "")
                .replace("Arrow", "");
              if (closestNPCLocal.type === 'meganeura') {
                npcPrompt.innerHTML = `
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                      <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                    <span>[${keyText}] เก็บแมลง (Pick up bug)</span>
                  </span>
                `;
              } else {
                npcPrompt.innerHTML = `
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                      <path d="M9 10h.01M15 10h.01"></path>
                      <path d="M12 2a8 8 0 0 0-8 8v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3a8 8 0 0 0-8-8z"></path>
                      <path d="M10 17v3M14 17v3"></path>
                    </svg>
                    <span>[${keyText}] กำจัด NPC (Kill NPC)</span>
                  </span>
                `;
              }
              npcPrompt.style.display = "block";
              npcPrompt.style.left = screenPos.x + "px";
              npcPrompt.style.top = screenPos.y - 40 + "px";
            } else {
              npcPrompt.style.display = "none";
            }
          } else {
            npcPrompt.style.display = "none";
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
                    const halfW = canvas.clientWidth / 2;
                    const halfH = canvas.clientHeight / 2;

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
                                canvas.clientWidth,
                                canvas.clientHeight
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
        const targetCircleEl = document.getElementById("targetCircle");
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
              canvas.clientWidth,
              canvas.clientHeight,
            );
            if (screenPos) {
              targetCircleEl.style.display = "block";
              targetCircleEl.style.left = screenPos.x + "px";
              targetCircleEl.style.top = screenPos.y + "px";
            } else {
              targetCircleEl.style.display = "none";
            }
          } else {
            targetCircleEl.style.display = "none";
          }
        }

        // ==========================================
        // PASS 1: SHADOW DEPTH MAP RENDER
        // ==========================================
        let shadowTargetX = px, shadowTargetY = py, shadowTargetZ = pz;
        let camPlayerDist = 10.0;
        if (typeof eyePos !== "undefined" && eyePos) {
          const dx = eyePos[0] - px;
          const dy = eyePos[1] - py;
          const dz = eyePos[2] - pz;
          camPlayerDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        let orthoSize = Math.min(22.0, Math.max(6.5, camPlayerDist * 0.5 + 2.5));

        const lightTarget = [shadowTargetX, shadowTargetY, shadowTargetZ];
        let lightDistance = RADIUS + 8.0;
        let lightFarPlane = RADIUS * 2.5 + 8.0;
        if (cameraMode !== "planet") {
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
          lightViewMatrix,
          lightProjMatrix,
        );

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

        // Cubes to depth
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
          if (supportUint32 && cubeIndicesLength > 65535) {
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

        // Nature / tree objects to depth
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
            grassChunks,
            eyePos
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
            eyePos
          });
        }

        // Collectibles to depth
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
          gl.drawElements(
            gl.TRIANGLES,
            collectibleIndicesLength,
            gl.UNSIGNED_SHORT,
            0,
          );
        }

        // Dynamic Collectibles to depth
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
          gl.drawElements(
            gl.TRIANGLES,
            dynamicCollectibleIndicesLength,
            gl.UNSIGNED_SHORT,
            0,
          );
        }

        // Amphibians to depth
        if (
          amphibianVertexBuffer &&
          amphibianIndexBuffer &&
          amphibianIndicesLength > 0
        ) {
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
        
        // Fire to depth
        if (
          fireVertexBuffer &&
          fireIndexBuffer &&
          fireIndicesLength > 0
        ) {
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

        // วาดท้องฟ้าอวกาศเนบิวลากลุ่มก๊าซ (Cosmic Deep Space Skybox)
        if (
          skyEnabled &&
          skyVertexBuffer &&
          skyIndexBuffer &&
          skyIndicesLength > 0
        ) {
          gl.useProgram(skyProgram);

          const skyModelMatrix = createTranslation(
            eyePos[0],
            eyePos[1],
            eyePos[2],
          );
          const skyModelViewMatrix = multiplyMatrices(
            viewMatrix,
            skyModelMatrix,
          );

          gl.uniformMatrix4fv(
            skyMVLoc,
            false,
            new Float32Array(skyModelViewMatrix),
          );
          gl.uniformMatrix4fv(skyProjLoc, false, new Float32Array(projMatrix));
          gl.uniform1f(skyTimeLoc, cloudAnimTime * 0.05);
          gl.uniform1f(skyGasIntensityLoc, skyGasIntensity);
          if (skyCameraPosLoc) gl.uniform3fv(skyCameraPosLoc, new Float32Array(eyePos));
          if (skyWaterRadiusLoc) gl.uniform1f(skyWaterRadiusLoc, waterRadius);

          gl.depthMask(false);

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

          gl.depthMask(true);
        }

        // วาดดาวอาทิตย์ขนาดใหญ่ยักษ์ (Sun) ฉากหลังสุด - ไม่รับแสงเงา (Unlit) แต่อาศัย Matrix โคจรจริงตามตำแหน่งดวงอาทิตย์
        if (
          sunVertexBuffer &&
          sunColorBuffer &&
          sunIndexBuffer &&
          sunIndicesLength > 0
        ) {
          gl.useProgram(program);
          gl.uniform1f(useLightingLoc, 0.0); // ปิดแสงเงาบนตัวดวงอาทิตย์

          const sunDistance = RADIUS * 23481; // ระยะทางดวงอาทิตย์เทียบกับรัศมีโลกจริง
          const sunModelMatrix = createTranslation(
            finalLightDir[0] * sunDistance,
            finalLightDir[1] * sunDistance,
            finalLightDir[2] * sunDistance,
          );
          const sunModelViewMatrix = multiplyMatrices(
            viewMatrix,
            sunModelMatrix,
          );
          gl.uniformMatrix4fv(
            modelViewLoc,
            false,
            new Float32Array(sunModelViewMatrix),
          );
          gl.uniformMatrix4fv(
            projectionLoc,
            false,
            new Float32Array(projMatrix),
          );

          gl.bindBuffer(gl.ARRAY_BUFFER, sunVertexBuffer);
          gl.enableVertexAttribArray(positionLoc);
          gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, sunColorBuffer);
          gl.enableVertexAttribArray(colorLoc);
          gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sunIndexBuffer);

          if (supportUint32 && sunIndicesLength > 65535) {
            gl.drawElements(gl.TRIANGLES, sunIndicesLength, gl.UNSIGNED_INT, 0);
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              sunIndicesLength,
              gl.UNSIGNED_SHORT,
              0,
            );
          }
        }
        
        // ---- DISABLE BLENDING FOR OPAQUE PASSES ----
        // To maximize GPU performance, disable alpha blending when rendering opaque geometry
        gl.disable(gl.BLEND);

        // วาดพื้นผิวโลก (Planet) - มีการคำนวณแสงเงาเคลื่อนที่ตามดวงอาทิตย์อย่างสวยงาม
        if (vertexBuffer && colorBuffer && indexBuffer && indicesLength > 0) {
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
              waterRadius: RADIUS + waterLevel * 0.15,
              waterColor,
              waterOpacity,
              renderDistEnabled,
              renderDistValue,
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
          !hideCharacter
        ) {
          gl.enable(gl.CULL_FACE);
          gl.frontFace(gl.CCW);
          gl.cullFace(gl.BACK);

          gl.useProgram(charProgram);
          gl.uniform1f(gl.getUniformLocation(charProgram, "uShadowsEnabled"), shadowMapEnabled ? 1.0 : 0.0);

          const charModelMatrix = getCharacterMatrix();
          const charModelViewMatrix = multiplyMatrices(
            charModelMatrix,
            viewMatrix,
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

          for (let i = 0; i < collectibles.length; i++) {
            const item = collectibles[i];
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
                  gl.uniform1f(modelMaxRenderDistLoc, renderDistValue);
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
                    renderDistValue,
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
                  gl.uniform1f(modelMaxRenderDistLoc, renderDistValue);
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
                  gl.uniform1f(modelMaxRenderDistLoc, renderDistValue);
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
          gl.uniform1f(modelMaxRenderDistLoc, renderDistValue);
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
        if (typeof TreeSystem !== "undefined" && TreeSystem.drawTrees) {
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
            renderDistValue,
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
            renderDistValue,
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
          gl.uniform1f(modelMaxRenderDistLoc, renderDistValue);
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
          gl.uniform1f(modelMaxRenderDistLoc, renderDistValue);
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

        // วาดขวานที่ถืออยู่ (Equipped Item)
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
          gl.uniform3fv(modelLightDirLoc, setF32(f32_finalLightDir, finalLightDir));

          const equipCharModelMatrix = (ragdollEnabled && ragdollInitialized) ? createIdentity() : getCharacterMatrix();
          const equipModelViewMatrix = multiplyMatrices(equipCharModelMatrix, viewMatrix);

          gl.uniformMatrix4fv(modelMVLoc, false, setF32(f32_modelViewMatrix, equipModelViewMatrix));
          gl.uniformMatrix4fv(modelProjLoc, false, new Float32Array(projMatrix));
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
          gl.uniform1f(modelMaxRenderDistLoc, renderDistValue);
          gl.uniform1f(modelTimeLoc, 0.0);
          gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
          gl.uniform3fv(modelCameraPosLoc, new Float32Array(eyePos));
          gl.uniform1f(modelSwayFactorLoc, 0.0);
          gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

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
          gl.uniform1f(modelMaxRenderDistLoc, renderDistValue);
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
          gl.uniform1f(modelMaxRenderDistLoc, renderDistValue);
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
            
            const height = getHeightOnSphere(charTheta, charPhi, globalSeed);
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
        
        // ---- ENABLE BLENDING FOR TRANSPARENT PASSES ----
        gl.enable(gl.BLEND);

        // วาดผิวน้ำ (Water)
        if (typeof WaterSystem !== "undefined" && WaterSystem.drawWater) {
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
            renderDistValue: renderDistValue,
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
              const currentSeed = typeof seedVal !== "undefined" ? seedVal : (typeof globalSeed !== "undefined" ? globalSeed : 12345);
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
                  if (window.FrustumCullingSystem && fPlanes && typeof frustumCullingEnabled !== 'undefined' && frustumCullingEnabled && window.cloud3DData.chunks) {
                      const rotatedChunks = window.cloud3DData.chunks.map(chunk => {
                          const cx = chunk.position[0];
                          const cy = chunk.position[1];
                          const cz = chunk.position[2];
                          const rx = cx * orbitMatrix[0] + cy * orbitMatrix[4] + cz * orbitMatrix[8];
                          const ry = cx * orbitMatrix[1] + cy * orbitMatrix[5] + cz * orbitMatrix[9];
                          const rz = cx * orbitMatrix[2] + cy * orbitMatrix[6] + cz * orbitMatrix[10];
                          return {
                              position: [rx, ry, rz],
                              radius: chunk.radius || 10.0,
                              meshStart: chunk.meshStart,
                              meshEnd: chunk.meshEnd,
                              active: chunk.active,
                              layer: chunk.layer
                          };
                      });
                      ranges = window.FrustumCullingSystem.getVisibleIndexRanges(rotatedChunks, fPlanes);
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

        // --- วาดลำแสงเทวทูต (Volumetric God Rays / Crepuscular Light Shafts) ---
        if (
          godRaysEnabled &&
          godRaysVertexBuffer &&
          godRaysIndexBuffer &&
          godRaysIndicesLength > 0
        ) {
          // 1. คำนวณหาตำแหน่งรอบตัวละครเพื่อกระจายลำแสงและหาทิศทาง "แนวตั้ง" บนพื้นผิวดาวเคราะห์ทรงกลม
          let upVec = [0, 1, 0];
          let pCenter = [0, 0, 0];
          if (typeof playerHeadPos !== "undefined" && playerHeadPos) {
            pCenter = playerHeadPos;
            const len = Math.sqrt(pCenter[0]*pCenter[0] + pCenter[1]*pCenter[1] + pCenter[2]*pCenter[2]);
            if (len > 0.001) {
              upVec = [pCenter[0]/len, pCenter[1]/len, pCenter[2]/len];
            }
          }

          // 2. คำนวณการจางลงของลำแสงตามแนวระนาบดวงอาทิตย์ (ป้องกันแสงโผล่เวลากลางคืนหรือหลังพระอาทิตย์ตกดิน)
          const cosTheta = upVec[0]*finalLightDir[0] + upVec[1]*finalLightDir[1] + upVec[2]*finalLightDir[2];
          const sunsetFade = Math.max(0.0, Math.min(1.0, cosTheta * 6.0));
          const activeAlpha = godRaysAlpha * sunsetFade;

          // หากเป็นเวลากลางคืน ให้ข้ามการวาดทันทีเพื่อความสมจริงและการประหยัดพลังงานประมวลผล GPU
          if (activeAlpha > 0.001) {
            gl.useProgram(godRayProgram);
            gl.uniformMatrix4fv(
              godRayMVLoc,
              false,
              new Float32Array(modelViewMatrix),
            );
            gl.uniformMatrix4fv(
              godRayProjLoc,
              false,
              new Float32Array(projMatrix),
            );
            gl.uniform3fv(godRayCameraPosLoc, new Float32Array(eyePos));
            gl.uniform3fv(godRayLightDirLoc, new Float32Array(finalLightDir));
            
            gl.uniform3fv(godRayColorLoc, new Float32Array(godRaysColor));
            gl.uniform1f(godRayAlphaLoc, activeAlpha);
            gl.uniform1f(godRayTimeLoc, waterTime);

            // Bind cloud synchronization uniforms for crepuscular rays
            const radiusInVal = RADIUS + HEIGHT_SCALE + cloudsHeight;
            const radiusOutVal = radiusInVal + cloudsThickness;
            gl.uniform1f(godRayCloudRadiusInLoc, radiusInVal);
            gl.uniform1f(godRayCloudRadiusOutLoc, radiusOutVal);
            gl.uniform1f(godRayCloudShapeLoc, cloudsShape + Math.sin(cloudShapeAnimTime) * 0.2);
            gl.uniform1f(godRayCloudTimeLoc, cloudAnimTime * 0.01);
            
            // Pass camera position directly to the shader
            gl.uniform3fv(godRayCameraPosLoc, new Float32Array(eyePos));
            gl.uniform1f(godRayPlanetRadiusLoc, RADIUS + HEIGHT_SCALE * 0.9);

            // ปิดการเขียน Depth Mask ชั่วคราวเพื่อการเกลี่ยสีโปร่งแสงที่นวลเนียน
            gl.depthMask(false);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // ใช้ Additive Blend เพื่อความฟุ้งเรืองรองดุจลำแสงธรรมชาติ
            
            // We use the atmosphere sphere buffer for concentric shells
            gl.bindBuffer(gl.ARRAY_BUFFER, atmosphereVertexBuffer);
            gl.enableVertexAttribArray(godRayPosLoc);
            gl.vertexAttribPointer(godRayPosLoc, 3, gl.FLOAT, false, 0, 0);
            
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, atmosphereIndexBuffer);
            
            // Cull front faces because the camera is inside the spheres.
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.FRONT);
            
            // วาดทรงกลมซ้อนทับกัน (Concentric spheres) เพื่อสร้าง Volumetric Light 
            for (let i = 0; i < godRaysCount; i++) {
                // Generate spheres from near the camera to far out. 
                // Since world unit size is small (island radius = 8), going out to radius ~25 covers the screen.
                const radius = 0.5 + (i / godRaysCount) * 35.0;
                
                gl.uniform1f(godRaySphereRadiusLoc, radius);
                gl.uniform1f(godRayPulseSpeedLoc, 0.15 + (i % 5) * 0.02);
                gl.uniform1f(godRayPhaseLoc, i * 0.1);
                
                gl.drawElements(
                    gl.TRIANGLES,
                    atmosphereIndicesLength,
                    gl.UNSIGNED_SHORT,
                    0
                );
            }
            
            gl.cullFace(gl.BACK); // คืนค่า culling กลับไปเป็นค่าดั้งเดิม
            // คืนค่ารูปแบบการ Blend แบบดั้งเดิม (Alpha Blend)
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.depthMask(true);
          }
        }

        waterTime += dt;
        cloudTime += dt * cloudsSpeed;
        cloudShapeTime += 0.06 * dt;

        if (typeof updateFloatingNpcHpBars === "function") {
          updateFloatingNpcHpBars(viewMatrix, projMatrix, eyePos);
        }

        if (typeof updateCompassHUD === "function") {
          updateCompassHUD();
        }

        // Next frame
        if (!forceDraw) {
          requestAnimationFrame(render);
        }
      }



