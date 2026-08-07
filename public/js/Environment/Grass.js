(function (global) {
  function drawGrassDepth(gl, opts = {}) {
    const vBuf = opts.natureVertexBuffer !== undefined ? opts.natureVertexBuffer : global.natureVertexBuffer;
    const cBuf = opts.natureColorBuffer !== undefined ? opts.natureColorBuffer : global.natureColorBuffer;
    const iBuf = opts.natureIndexBuffer !== undefined ? opts.natureIndexBuffer : global.natureIndexBuffer;
    const idxLen = opts.natureIndicesLength !== undefined ? opts.natureIndicesLength : global.natureIndicesLength;
    const grassStartIdx = opts.natureGrassStartIndex !== undefined ? opts.natureGrassStartIndex : global.natureGrassStartIndex;
    const useUint32 = opts.supportUint32 !== undefined ? opts.supportUint32 : global.supportUint32;
    
    if (!vBuf || !cBuf || !iBuf || !idxLen || idxLen <= 0 || grassStartIdx === undefined || grassStartIdx >= idxLen) return;

    const isUint32 = useUint32 && idxLen > 65535;
    const type = isUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    const bytesPerIndex = isUint32 ? 4 : 2;

    const chunks = opts.grassChunks !== undefined ? opts.grassChunks : global.grassChunks;
    const eye = opts.eyePos !== undefined ? opts.eyePos : global.eyePos;

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);

    if (chunks && chunks.length > 0 && eye) {
      gl.disable(gl.CULL_FACE); // Grass is two-sided
      let batchStart = -1;
      let batchCount = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const dx = chunk.pos[0] - eye[0];
        const dy = chunk.pos[1] - eye[1];
        const dz = chunk.pos[2] - eye[2];
        const distSq = dx * dx + dy * dy + dz * dz;
        // Shadow distance limit for grass = 35 meters (squared = 1225)
        if (distSq <= 1225.0) {
          if (batchStart === -1) {
            batchStart = chunk.start;
            batchCount = chunk.count;
          } else {
            if (chunk.start === batchStart + batchCount) {
              batchCount += chunk.count;
            } else {
              gl.drawElements(gl.TRIANGLES, batchCount, type, batchStart * bytesPerIndex);
              batchStart = chunk.start;
              batchCount = chunk.count;
            }
          }
        } else {
          if (batchStart !== -1) {
            gl.drawElements(gl.TRIANGLES, batchCount, type, batchStart * bytesPerIndex);
            batchStart = -1;
            batchCount = 0;
          }
        }
      }
      if (batchStart !== -1) {
        gl.drawElements(gl.TRIANGLES, batchCount, type, batchStart * bytesPerIndex);
      }
      gl.enable(gl.CULL_FACE);
    }
  }

  function drawGrass(gl, opts = {}) {
    const vBuf = opts.natureVertexBuffer !== undefined ? opts.natureVertexBuffer : global.natureVertexBuffer;
    const cBuf = opts.natureColorBuffer !== undefined ? opts.natureColorBuffer : global.natureColorBuffer;
    const nBuf = opts.natureNormalBuffer !== undefined ? opts.natureNormalBuffer : global.natureNormalBuffer;
    const iBuf = opts.natureIndexBuffer !== undefined ? opts.natureIndexBuffer : global.natureIndexBuffer;
    const idxLen = opts.natureIndicesLength !== undefined ? opts.natureIndicesLength : global.natureIndicesLength;
    const grassStartIdx = opts.natureGrassStartIndex !== undefined ? opts.natureGrassStartIndex : global.natureGrassStartIndex;
    const useUint32 = opts.supportUint32 !== undefined ? opts.supportUint32 : global.supportUint32;
    
    if (!vBuf || !cBuf || !iBuf || !idxLen || idxLen <= 0 || grassStartIdx === undefined || grassStartIdx >= idxLen) return;

    const isUint32 = useUint32 && idxLen > 65535;
    const type = isUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    const bytesPerIndex = isUint32 ? 4 : 2;

    const fcEnabled = opts.frustumCullingEnabled !== undefined ? opts.frustumCullingEnabled : global.frustumCullingEnabled;
    const fPlanes = opts.frustumPlanes !== undefined ? opts.frustumPlanes : global.frustumPlanes;
    const chunks = opts.grassChunks !== undefined ? opts.grassChunks : global.grassChunks;
    const eye = opts.eyePos !== undefined ? opts.eyePos : global.eyePos;

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);

    if (chunks && chunks.length > 0 && eye) {
      gl.disable(gl.CULL_FACE);
      let batchStart = -1;
      let batchCount = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        let visible = true;
        if (opts.renderDistEnabled) {
          const dx = chunk.pos[0] - eye[0];
          const dy = chunk.pos[1] - eye[1];
          const dz = chunk.pos[2] - eye[2];
          const distSq = dx * dx + dy * dy + dz * dz;
          // Note: using the same fixed renderDist check logic if requested, or opts.renderDistValue
          if (distSq > (opts.renderDistValue + chunk.radius) * (opts.renderDistValue + chunk.radius)) {
            visible = false;
          }
        }
        if (visible && fcEnabled && fPlanes && typeof global.isSphereInFrustum === "function") {
          if (!global.isSphereInFrustum(fPlanes, chunk.pos, chunk.radius)) {
            visible = false;
          }
        }
        if (visible) {
          if (batchStart === -1) {
            batchStart = chunk.start;
            batchCount = chunk.count;
          } else {
            if (chunk.start === batchStart + batchCount) {
              batchCount += chunk.count;
            } else {
              gl.drawElements(gl.TRIANGLES, batchCount, type, batchStart * bytesPerIndex);
              batchStart = chunk.start;
              batchCount = chunk.count;
            }
          }
        } else {
          if (batchStart !== -1) {
            gl.drawElements(gl.TRIANGLES, batchCount, type, batchStart * bytesPerIndex);
            batchStart = -1;
            batchCount = 0;
          }
        }
      }
      if (batchStart !== -1) {
        gl.drawElements(gl.TRIANGLES, batchCount, type, batchStart * bytesPerIndex);
      }
      gl.enable(gl.CULL_FACE);
    }
  }

  const GrassSystem = {
    drawGrassDepth,
    drawGrass
  };
  global.GrassSystem = GrassSystem;
})(typeof window !== 'undefined' ? window : this);
