// === SEEDPLANET MODULE: ENGINE/SSRCORE.JS ===

(function(global) {
  'use strict';

  let _gl = null;
  let _sceneTexture = null;
  let _width = 0;
  let _height = 0;
  let _quality = 2; // 0 = Off, 1 = Low, 2 = Medium, 3 = High

  /**
   * SSRCore: Centralized Screen-Space Reflection Engine
   * Provides clean scene capturing, texture management, and standard GLSL ray-marching helpers
   */
  const SSRCore = {
    /**
     * Initialize WebGL context reference
     */
    init: function(gl) {
      _gl = gl;
    },

    /**
     * Set quality level (0 = Off, 1 = Low, 2 = Medium, 3 = High)
     */
    setQuality: function(q) {
      _quality = typeof q === 'number' ? q : 0;
      if (typeof window !== 'undefined') {
        window.ssrQuality = _quality;
      }
    },

    /**
     * Get current quality level
     */
    getQuality: function() {
      if (typeof window !== 'undefined' && typeof window.ssrQuality === 'number') {
        return window.ssrQuality;
      }
      return _quality;
    },

    /**
     * Check if SSR is active
     */
    isEnabled: function() {
      return this.getQuality() > 0;
    },

    /**
     * Captures the rendered color buffer into the central SSR texture
     */
    captureScene: function(gl) {
      const activeGl = gl || _gl;
      if (!activeGl) return null;

      if (!this.isEnabled()) {
        if (typeof window !== 'undefined') {
          window._SSRSceneTexture = null;
        }
        return null;
      }

      const w = activeGl.drawingBufferWidth || (activeGl.canvas ? activeGl.canvas.width : 0);
      const h = activeGl.drawingBufferHeight || (activeGl.canvas ? activeGl.canvas.height : 0);
      if (w <= 0 || h <= 0) return null;

      if (!_sceneTexture) {
        _sceneTexture = activeGl.createTexture();
        activeGl.bindTexture(activeGl.TEXTURE_2D, _sceneTexture);
        activeGl.texParameteri(activeGl.TEXTURE_2D, activeGl.TEXTURE_WRAP_S, activeGl.CLAMP_TO_EDGE);
        activeGl.texParameteri(activeGl.TEXTURE_2D, activeGl.TEXTURE_WRAP_T, activeGl.CLAMP_TO_EDGE);
        activeGl.texParameteri(activeGl.TEXTURE_2D, activeGl.TEXTURE_MIN_FILTER, activeGl.LINEAR);
        activeGl.texParameteri(activeGl.TEXTURE_2D, activeGl.TEXTURE_MAG_FILTER, activeGl.LINEAR);
        activeGl.texImage2D(activeGl.TEXTURE_2D, 0, activeGl.RGBA, w, h, 0, activeGl.RGBA, activeGl.UNSIGNED_BYTE, null);
        _width = w;
        _height = h;
      } else {
        activeGl.bindTexture(activeGl.TEXTURE_2D, _sceneTexture);
        if (_width !== w || _height !== h) {
          activeGl.texImage2D(activeGl.TEXTURE_2D, 0, activeGl.RGBA, w, h, 0, activeGl.RGBA, activeGl.UNSIGNED_BYTE, null);
          _width = w;
          _height = h;
        }
      }

      activeGl.copyTexSubImage2D(activeGl.TEXTURE_2D, 0, 0, 0, 0, 0, w, h);
      if (typeof window !== 'undefined') {
        window._SSRSceneTexture = _sceneTexture;
      }
      return _sceneTexture;
    },

    /**
     * Returns captured scene texture handle
     */
    getSceneTexture: function() {
      return _sceneTexture;
    },

    /**
     * Standard GLSL Code Snippet for Basic Screen-Space Reflections
     */
    getGLSL: function() {
      return `
        // Central Basic Screen-Space Reflection (SSR) Engine
        bool traceCoreSSR(
            vec3 worldPos,
            vec3 reflectDir,
            vec2 screenUV,
            sampler2D sceneTex,
            mat4 viewProj,
            int steps,
            float maxDist,
            out vec3 outColor,
            out float outHit
        ) {
            outColor = vec3(0.0);
            outHit = 0.0;

            vec3 stepVector = reflectDir * (maxDist / float(steps));
            vec3 rayPos = worldPos;

            for (int i = 1; i <= 32; i++) {
                if (i > steps) break;
                rayPos += stepVector;
                vec4 clipPos = viewProj * vec4(rayPos, 1.0);
                if (clipPos.w <= 0.001) continue;

                vec3 ndc = clipPos.xyz / clipPos.w;
                vec2 uv = ndc.xy * 0.5 + 0.5;

                if (uv.x >= 0.005 && uv.x <= 0.995 && uv.y >= 0.005 && uv.y <= 0.995) {
                    float sDist = length(uv - screenUV);
                    if (sDist > 0.003) {
                        vec2 edgeDist = min(uv, vec2(1.0) - uv);
                        float edgeFade = smoothstep(0.005, 0.12, min(edgeDist.x, edgeDist.y));
                        float progress = float(i) / float(steps);
                        float distFade = 1.0 - smoothstep(0.70, 1.0, progress);
                        outColor = texture(sceneTex, uv).rgb;
                        outHit = edgeFade * distFade;
                        return true;
                    }
                }
            }
            return false;
        }
      `;
    }
  };

  global.SSRCore = SSRCore;
  global.CoreSSR = SSRCore;
})(typeof window !== 'undefined' ? window : this);
