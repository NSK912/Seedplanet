// === SEEDPLANET MODULE: JS/ENVIRONMENT/TREE.JS ===

(function(global) {

  function drawTreeDepth(gl, opts = {}) {
    const vBuf = opts.natureVertexBuffer !== undefined ? opts.natureVertexBuffer : global.natureVertexBuffer;
    const iBuf = opts.natureIndexBuffer !== undefined ? opts.natureIndexBuffer : global.natureIndexBuffer;
    const cBuf = opts.natureColorBuffer !== undefined ? opts.natureColorBuffer : global.natureColorBuffer;
    const idxLen = opts.natureIndicesLength !== undefined ? opts.natureIndicesLength : global.natureIndicesLength;
    const grassStartIdx = opts.natureGrassStartIndex !== undefined ? opts.natureGrassStartIndex : global.natureGrassStartIndex;
    const useUint32 = opts.supportUint32 !== undefined ? opts.supportUint32 : global.supportUint32;

    if (!vBuf || !iBuf || !idxLen || idxLen <= 0) return;

    if (opts.depthSwayFactorLoc) gl.uniform1f(opts.depthSwayFactorLoc, opts.natureSway !== undefined ? opts.natureSway : (global.natureSway || 0));
    if (opts.depthWaterSwayFactorLoc) gl.uniform1f(opts.depthWaterSwayFactorLoc, opts.waterPlantSway !== undefined ? opts.waterPlantSway : (global.waterPlantSway || 0));
    if (opts.depthModelLoc && opts.createIdentity) {
      gl.uniformMatrix4fv(
        opts.depthModelLoc,
        false,
        new Float32Array(opts.createIdentity()),
      );
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
    gl.enableVertexAttribArray(opts.depthPosLoc);
    gl.vertexAttribPointer(opts.depthPosLoc, 3, gl.FLOAT, false, 0, 0);

    if (opts.depthColorLoc !== undefined && opts.depthColorLoc >= 0 && cBuf) {
      gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
      gl.enableVertexAttribArray(opts.depthColorLoc);
      gl.vertexAttribPointer(opts.depthColorLoc, 3, gl.FLOAT, false, 0, 0);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);
    const type = (useUint32 && idxLen > 65535) ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    const bytesPerIndex = type === gl.UNSIGNED_INT ? 4 : 2;

    // Draw trees and rocks (non-grass nature) with distance culling
    const obstacles = opts.natureObstacles !== undefined ? opts.natureObstacles : global.natureObstacles;
    const eye = opts.eyePos !== undefined ? opts.eyePos : global.eyePos;
    const maxDist = opts.renderDistValue !== undefined 
      ? opts.renderDistValue 
      : (typeof global.objectRenderDistValue === "number" ? global.objectRenderDistValue : (typeof global.window !== "undefined" && typeof global.window.objectRenderDistValue === "number" ? global.window.objectRenderDistValue : 5.0));

    if (obstacles && obstacles.length > 0 && typeof global.getVisibleIndexRanges === "function" && eye) {
      const ranges = global.getVisibleIndexRanges(obstacles, null, maxDist, eye);
      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        // Ensure we only draw up to grassStartIdx (nature objects, not grass)
        const rangeStart = range.start;
        const rangeEnd = (grassStartIdx !== undefined) ? Math.min(range.end, grassStartIdx) : range.end;
        const count = rangeEnd - rangeStart;
        if (count > 0) {
          gl.drawElements(gl.TRIANGLES, count, type, rangeStart * bytesPerIndex);
        }
      }
    } else {
      const treeDrawCount = grassStartIdx !== undefined ? grassStartIdx : idxLen;
      gl.drawElements(
        gl.TRIANGLES,
        treeDrawCount,
        type,
        0
      );
    }
  }

  function drawTreeMirrored(gl, opts = {}) {
    const vBuf = opts.natureVertexBuffer !== undefined ? opts.natureVertexBuffer : global.natureVertexBuffer;
    const cBuf = opts.natureColorBuffer !== undefined ? opts.natureColorBuffer : global.natureColorBuffer;
    const nBuf = opts.natureNormalBuffer !== undefined ? opts.natureNormalBuffer : global.natureNormalBuffer;
    const iBuf = opts.natureIndexBuffer !== undefined ? opts.natureIndexBuffer : global.natureIndexBuffer;
    const idxLen = opts.natureIndicesLength !== undefined ? opts.natureIndicesLength : global.natureIndicesLength;
    const useUint32 = opts.supportUint32 !== undefined ? opts.supportUint32 : global.supportUint32;

    if (!vBuf || !iBuf || !idxLen || idxLen <= 0) return;

    if (opts.modelProgram) gl.useProgram(opts.modelProgram);
    if (opts.modelLightDirLoc && opts.finalLightDir) gl.uniform3fv(opts.modelLightDirLoc, new Float32Array(opts.finalLightDir));
    if (opts.modelMVLoc && opts.reflectedModelViewMatrixStatic) gl.uniformMatrix4fv(opts.modelMVLoc, false, new Float32Array(opts.reflectedModelViewMatrixStatic));
    if (opts.modelProjLoc && opts.projMatrix) gl.uniformMatrix4fv(opts.modelProjLoc, false, new Float32Array(opts.projMatrix));
    if (opts.modelWaterRadiusLoc && opts.RADIUS !== undefined && opts.waterLevel !== undefined) {
      gl.uniform1f(opts.modelWaterRadiusLoc, opts.RADIUS + opts.waterLevel * 0.15);
    }
    if (opts.modelWaterColorLoc && opts.waterColor) gl.uniform3fv(opts.modelWaterColorLoc, new Float32Array(opts.waterColor));
    if (opts.modelWaterOpacityLoc && opts.waterOpacity !== undefined) gl.uniform1f(opts.modelWaterOpacityLoc, opts.waterOpacity);
    if (opts.modelRenderDistEnabledLoc) gl.uniform1f(opts.modelRenderDistEnabledLoc, opts.renderDistEnabled ? 1.0 : 0.0);
    if (opts.modelMaxRenderDistLoc && opts.renderDistValue !== undefined) gl.uniform1f(opts.modelMaxRenderDistLoc, opts.renderDistValue);
    if (opts.modelTimeLoc && opts.leafAnimTime !== undefined) gl.uniform1f(opts.modelTimeLoc, opts.leafAnimTime);
    if (opts.modelPlanetRadiusLoc && opts.RADIUS !== undefined) gl.uniform1f(opts.modelPlanetRadiusLoc, opts.RADIUS);
    if (opts.modelCameraPosLoc && opts.eyePos) gl.uniform3fv(opts.modelCameraPosLoc, new Float32Array(opts.eyePos));
    if (opts.modelSwayFactorLoc) gl.uniform1f(opts.modelSwayFactorLoc, opts.natureSway !== undefined ? opts.natureSway : (global.natureSway || 0));
    if (opts.modelWaterSwayFactorLoc) gl.uniform1f(opts.modelWaterSwayFactorLoc, opts.waterPlantSway !== undefined ? opts.waterPlantSway : (global.waterPlantSway || 0));

    gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
    gl.enableVertexAttribArray(opts.modelPosLoc);
    gl.vertexAttribPointer(opts.modelPosLoc, 3, gl.FLOAT, false, 0, 0);

    if (cBuf) {
      gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
      gl.enableVertexAttribArray(opts.modelColorLoc);
      gl.vertexAttribPointer(opts.modelColorLoc, 3, gl.FLOAT, false, 0, 0);
    }

    if (opts.modelNormalLoc !== undefined && opts.modelNormalLoc !== -1 && nBuf) {
      gl.bindBuffer(gl.ARRAY_BUFFER, nBuf);
      gl.enableVertexAttribArray(opts.modelNormalLoc);
      gl.vertexAttribPointer(opts.modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);

    const type = (useUint32 && idxLen > 65535) ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    const bytesPerIndex = type === gl.UNSIGNED_INT ? 4 : 2;

    const grassStartIdx = opts.natureGrassStartIndex !== undefined ? opts.natureGrassStartIndex : global.natureGrassStartIndex;
    const obstacles = opts.natureObstacles !== undefined ? opts.natureObstacles : global.natureObstacles;
    const eye = opts.eyePos !== undefined ? opts.eyePos : global.eyePos;
    const maxDist = (opts.renderDistEnabled !== false)
      ? (opts.renderDistValue !== undefined ? opts.renderDistValue : (typeof global.objectRenderDistValue === "number" ? global.objectRenderDistValue : 5.0))
      : null;

    // Trees & rocks use CW winding order normally, so mirrored is CCW
    gl.enable(gl.CULL_FACE);
    gl.frontFace(gl.CCW);
    gl.cullFace(gl.BACK);

    if (obstacles && obstacles.length > 0 && typeof global.getVisibleIndexRanges === "function" && eye) {
      const ranges = global.getVisibleIndexRanges(obstacles, null, maxDist, eye);
      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        const rangeStart = range.start;
        const rangeEnd = (grassStartIdx !== undefined) ? Math.min(range.end, grassStartIdx) : range.end;
        const count = rangeEnd - rangeStart;
        if (count > 0) {
          gl.drawElements(gl.TRIANGLES, count, type, rangeStart * bytesPerIndex);
        }
      }
    } else {
      const treeDrawCount = grassStartIdx !== undefined ? grassStartIdx : idxLen;
      gl.drawElements(gl.TRIANGLES, treeDrawCount, type, 0);
    }
    gl.disable(gl.CULL_FACE);
  }

  function drawTrees(gl, opts = {}) {
    const vBuf = opts.natureVertexBuffer !== undefined ? opts.natureVertexBuffer : global.natureVertexBuffer;
    const cBuf = opts.natureColorBuffer !== undefined ? opts.natureColorBuffer : global.natureColorBuffer;
    const nBuf = opts.natureNormalBuffer !== undefined ? opts.natureNormalBuffer : global.natureNormalBuffer;
    const iBuf = opts.natureIndexBuffer !== undefined ? opts.natureIndexBuffer : global.natureIndexBuffer;
    const idxLen = opts.natureIndicesLength !== undefined ? opts.natureIndicesLength : global.natureIndicesLength;
    const useUint32 = opts.supportUint32 !== undefined ? opts.supportUint32 : global.supportUint32;

    if (!vBuf || !cBuf || !iBuf || !idxLen || idxLen <= 0) return;

    gl.enable(gl.CULL_FACE);
    gl.frontFace(gl.CW);
    gl.cullFace(gl.BACK);

    if (opts.modelProgram) gl.useProgram(opts.modelProgram);
    if (opts.modelLightDirLoc && opts.finalLightDir) gl.uniform3fv(opts.modelLightDirLoc, new Float32Array(opts.finalLightDir));
    if (opts.modelMVLoc && opts.modelViewMatrix) gl.uniformMatrix4fv(opts.modelMVLoc, false, new Float32Array(opts.modelViewMatrix));
    if (opts.modelProjLoc && opts.projMatrix) gl.uniformMatrix4fv(opts.modelProjLoc, false, new Float32Array(opts.projMatrix));

    if (opts.modelProgram) {
      const uLightSpaceLoc = gl.getUniformLocation(opts.modelProgram, "uLightSpaceMatrix");
      if (uLightSpaceLoc && opts.lightSpaceMatrix) {
        gl.uniformMatrix4fv(uLightSpaceLoc, false, new Float32Array(opts.lightSpaceMatrix));
      }
      const uShadowMapLoc = gl.getUniformLocation(opts.modelProgram, "uShadowMap");
      if (uShadowMapLoc) gl.uniform1i(uShadowMapLoc, 1);
      const uWaterMaskLoc = gl.getUniformLocation(opts.modelProgram, "uWaterMaskTex");
      if (uWaterMaskLoc) gl.uniform1i(uWaterMaskLoc, 2);
    }

    if (opts.modelWaterRadiusLoc && opts.RADIUS !== undefined && opts.waterLevel !== undefined) {
      gl.uniform1f(opts.modelWaterRadiusLoc, opts.RADIUS + opts.waterLevel * 0.15);
    }
    if (opts.modelWaterColorLoc && opts.waterColor) gl.uniform3fv(opts.modelWaterColorLoc, new Float32Array(opts.waterColor));
    if (opts.modelWaterOpacityLoc && opts.waterOpacity !== undefined) gl.uniform1f(opts.modelWaterOpacityLoc, opts.waterOpacity);
    if (opts.modelRenderDistEnabledLoc) gl.uniform1f(opts.modelRenderDistEnabledLoc, opts.renderDistEnabled ? 1.0 : 0.0);
    if (opts.modelMaxRenderDistLoc && opts.renderDistValue !== undefined) gl.uniform1f(opts.modelMaxRenderDistLoc, opts.renderDistValue);
    if (opts.modelTimeLoc && opts.leafAnimTime !== undefined) gl.uniform1f(opts.modelTimeLoc, opts.leafAnimTime);
    if (opts.modelPlanetRadiusLoc && opts.RADIUS !== undefined) gl.uniform1f(opts.modelPlanetRadiusLoc, opts.RADIUS);
    if (opts.modelCameraPosLoc && opts.eyePos) gl.uniform3fv(opts.modelCameraPosLoc, new Float32Array(opts.eyePos));
    if (opts.modelSwayFactorLoc) gl.uniform1f(opts.modelSwayFactorLoc, opts.natureSway !== undefined ? opts.natureSway : (global.natureSway || 0));
    if (opts.modelWaterSwayFactorLoc) gl.uniform1f(opts.modelWaterSwayFactorLoc, opts.waterPlantSway !== undefined ? opts.waterPlantSway : (global.waterPlantSway || 0));

    gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
    gl.enableVertexAttribArray(opts.modelPosLoc);
    gl.vertexAttribPointer(opts.modelPosLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
    gl.enableVertexAttribArray(opts.modelColorLoc);
    gl.vertexAttribPointer(opts.modelColorLoc, 3, gl.FLOAT, false, 0, 0);

    if (opts.modelNormalLoc !== undefined && opts.modelNormalLoc !== -1 && nBuf) {
      gl.bindBuffer(gl.ARRAY_BUFFER, nBuf);
      gl.enableVertexAttribArray(opts.modelNormalLoc);
      gl.vertexAttribPointer(opts.modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);

    const isUint32 = useUint32 && idxLen > 65535;
    const type = isUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    const bytesPerIndex = isUint32 ? 4 : 2;

    const fcEnabled = opts.frustumCullingEnabled !== undefined ? opts.frustumCullingEnabled : global.frustumCullingEnabled;
    const fPlanes = opts.frustumPlanes !== undefined ? opts.frustumPlanes : global.frustumPlanes;
    const obstacles = opts.natureObstacles !== undefined ? opts.natureObstacles : global.natureObstacles;
    const chunks = opts.grassChunks !== undefined ? opts.grassChunks : global.grassChunks;
    const eye = opts.eyePos !== undefined ? opts.eyePos : global.eyePos;
    const grassStartIdx = opts.natureGrassStartIndex !== undefined ? opts.natureGrassStartIndex : global.natureGrassStartIndex;
    const maxDist = (opts.renderDistEnabled !== false)
      ? (opts.renderDistValue !== undefined ? opts.renderDistValue : (typeof global.objectRenderDistValue === "number" ? global.objectRenderDistValue : 5.0))
      : null;

    if (obstacles && obstacles.length > 0 && typeof global.getVisibleIndexRanges === "function" && eye) {
      const planes = (fcEnabled && fPlanes) ? fPlanes : null;
      const ranges = global.getVisibleIndexRanges(obstacles, planes, maxDist, eye);
      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        const rangeStart = range.start;
        const rangeEnd = (grassStartIdx !== undefined) ? Math.min(range.end, grassStartIdx) : range.end;
        const count = rangeEnd - rangeStart;
        if (count > 0) {
          gl.drawElements(gl.TRIANGLES, count, type, rangeStart * bytesPerIndex);
        }
      }
    } else {
      const treeDrawCount = grassStartIdx !== undefined ? grassStartIdx : idxLen;
      gl.drawElements(gl.TRIANGLES, treeDrawCount, type, 0);
    }
    gl.disable(gl.CULL_FACE);
  }

  const TreeSystem = {
    drawTreeDepth,
    drawTreeMirrored,
    drawTrees,
    drawNature: drawTrees,
    drawNatureDepth: drawTreeDepth,
    drawNatureMirrored: drawTreeMirrored
  };

  global.TreeSystem = TreeSystem;
  global.TreeRenderer = TreeSystem;
  global.NatureSystem = TreeSystem;

})(typeof window !== 'undefined' ? window : this);
