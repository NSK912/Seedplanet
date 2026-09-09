// === SEEDPLANET MODULE: JS/PLAYERCLONES.JS ===
// Independent Player Clones System (Spawned at procedural houses)

(function() {
  const f32_cloneModel = new Float32Array(16);
  const f32_cloneMV = new Float32Array(16);

  // Rich collection of cute expressive anime / kaomoji / emoji faces
  const CLONE_EMOJI_FACES = [
    "(^_^)",    // Happy smile
    "(o_o)",    // Curious wide-eyed
    "(^o^)",    // Big cheering smile
    "(¬_¬)",    // Sassy side-eye
    "(*_*)",    // Star-struck
    "(•‿•)",    // Sweet gentle smile
    "(^_-)",    // Playful wink
    "(◕‿◕)",    // Big anime sparkle eyes
    "(>_<)",    // Cute scrunched eyes
    "(≧◡≦)",    // Blushing glee
    "(•ω•)",    // Chibi cat mouth
    "(•̀ᴗ•́)",    // Determined hero grin
    "(♥_♥)",    // Heart eyes
    "(^з^)",    // Whistle kiss
    "(UwU)",    // Classic UwU
    "(OwO)",    // Surprised OwO
    "(^人^)",    // Polite thank-you
    "(•_•)",    // Cool stoic look
    "(¬‿¬)",    // Cheeky sly grin
    "(ᵔᴥᵔ)",    // Cute puppy / bear
    "(⌒‿⌒)",    // Serene closed-eyes smile
    "(★‿★)",    // Starry eyes grin
    "(◕ω◕)",    // Shiny chibi kitty
    "(ʘ‿ʘ)",    // Excited round eyes
    "(•ө•)",    // Cute chick face
    "(´∀｀)",    // Cozy happy warmth
    "(✿◠‿◠)",   // Flower maiden smile
    "(¬o¬)",    // Pouting eyebrow
    "(^Д^)",    // Joyful laughing
    "(｡♥‿♥｡)",  // Romantic heart chibi
    "(=^･ω･^=)",// Little kitty with whiskers
    "(•̀o•́)",    // Brave little face
    "( ˘ ³˘)",   // Whistling tune
    "(∩_∩)",    // Shy cute hands up
    "(ﾟヮﾟ)",    // Retro anime happy
    "(~_~)"     // Sleepy cozy
  ];

  function getCloneVectors(cState, charScale, planetRadius) {
    const cSinT = Math.sin(cState.theta);
    const cCosT = Math.cos(cState.theta);
    const cSinP = Math.sin(cState.phi);
    const cCosP = Math.cos(cState.phi);

    const cNx = cSinT * cCosP;
    const cNy = cCosT;
    const cNz = cSinT * cSinP;

    const heightScale = (typeof HEIGHT_SCALE !== "undefined") ? HEIGHT_SCALE : 1.0;
    const cHeight = (typeof getVisualHeightOnSphere === "function")
      ? getVisualHeightOnSphere(cState.theta, cState.phi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0))
      : 0;
    const cGroundRad = planetRadius + cHeight * heightScale + 0.46 * charScale;
    const cPos = [cGroundRad * cNx, cGroundRad * cNy, cGroundRad * cNz];

    const cEast = [-cSinP, 0, cCosP];
    const cNorth = [-cCosT * cCosP, cSinT, -cCosT * cSinP];

    const cCosH = Math.cos(cState.heading);
    const cSinH = Math.sin(cState.heading);

    const cR = [
      cEast[0] * cCosH - cNorth[0] * cSinH,
      cEast[1] * cCosH - cNorth[1] * cSinH,
      cEast[2] * cCosH - cNorth[2] * cSinH
    ];
    const cF = [
      cNorth[0] * cCosH + cEast[0] * cSinH,
      cNorth[1] * cCosH + cEast[1] * cSinH,
      cNorth[2] * cCosH + cEast[2] * cSinH
    ];
    const cN = [cNx, cNy, cNz];

    return { cPos, cR, cF, cN };
  }

  function clearOldCloneFaceSigns() {
    if (typeof World3DUI !== "undefined" && typeof World3DUI.removeSign === "function") {
      for (let i = 0; i < 40; i++) {
        const sid = "clone_face_" + i;
        if (typeof World3DUI.hasSign === "function" ? World3DUI.hasSign(sid) : true) {
          World3DUI.removeSign(sid);
        }
      }
    }
  }

  const cloneFaceTextureCache = new Map();

  function getCloneFaceTexture(gl, faceText) {
    if (cloneFaceTextureCache.has(faceText)) {
      return cloneFaceTextureCache.get(faceText);
    }

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 512, 256);

    // Soft rosy chibi blush cheeks on left and right
    const drawCheek = (cx, cy) => {
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 42);
      grad.addColorStop(0, "rgba(255, 110, 145, 0.75)");
      grad.addColorStop(0.55, "rgba(255, 110, 145, 0.35)");
      grad.addColorStop(1, "rgba(255, 110, 145, 0.0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 42, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCheek(102, 162);
    drawCheek(410, 162);

    // Dynamic font sizing based on emoji string length
    let fontSize = 84;
    if (faceText.length >= 9) fontSize = 56;
    else if (faceText.length >= 7) fontSize = 66;
    else if (faceText.length >= 5) fontSize = 76;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#161616";
    ctx.font = "900 " + fontSize + "px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', monospace, 'Courier New', sans-serif";

    // Auto-scale if text exceeds available head face width
    const maxTextWidth = 360;
    const measuredWidth = ctx.measureText(faceText).width;
    if (measuredWidth > maxTextWidth && measuredWidth > 0) {
      fontSize = Math.floor(fontSize * (maxTextWidth / measuredWidth));
      ctx.font = "900 " + fontSize + "px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', monospace, 'Courier New', sans-serif";
    }

    ctx.fillText(faceText, 256, 126);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);

    cloneFaceTextureCache.set(faceText, tex);
    return tex;
  }

  // Helper to retrieve spawn location near a specific house (matching player's house spawn system)
  function getCloneHouseSpawn(hIdx, houses, seed, planetRadius) {
    if (typeof window.getHouseSpawnLocation === "function") {
      const loc = window.getHouseSpawnLocation(hIdx);
      if (loc && loc.success && typeof loc.theta === "number") {
        return loc;
      }
    }

    const house = (houses && houses[hIdx]) ? houses[hIdx] : null;
    if (!house) return null;

    const hx = house.x, hy = house.y, hz = house.z;
    const hR = house.R || [1, 0, 0];
    const hF = house.F || [0, 0, 1];
    const wfW = house.wfW || 0.30;
    const totalW = house.totalW || 0.6;
    const totalD = house.totalD || 0.6;
    const door = house.entranceDoor;
    const safeClearance = 0.65;

    let offR = 0, offF = 0;
    if (door) {
      const cellCx = -totalW / 2 + wfW / 2 + door.gx * wfW;
      const cellCy = -totalD / 2 + wfW / 2 + door.gy * wfW;
      if (door.side === "bottom") { offR = cellCx; offF = cellCy - wfW / 2 - safeClearance; }
      else if (door.side === "top") { offR = cellCx; offF = cellCy + wfW / 2 + safeClearance; }
      else if (door.side === "left") { offR = cellCx - wfW / 2 - safeClearance; offF = cellCy; }
      else if (door.side === "right") { offR = cellCx + wfW / 2 + safeClearance; offF = cellCy; }
    } else {
      offR = (totalW / 2 + safeClearance) * (Math.random() > 0.5 ? 1 : -1);
      offF = (totalD / 2 + safeClearance) * (Math.random() > 0.5 ? 1 : -1);
    }

    const candWx = hx + hR[0] * offR + hF[0] * offF;
    const candWy = hy + hR[1] * offR + hF[1] * offF;
    const candWz = hz + hR[2] * offR + hF[2] * offF;
    const dist = Math.sqrt(candWx * candWx + candWy * candWy + candWz * candWz) || 1;
    const theta = Math.acos(Math.max(-1.0, Math.min(1.0, candWy / dist)));
    let phi = Math.atan2(candWz, candWx);
    if (phi < 0) phi += Math.PI * 2;

    return { theta, phi, house, houseIndex: hIdx, x: candWx, y: candWy, z: candWz, success: true };
  }

  let lastTrackedHousesRef = null;
  let lastTrackedHousesCount = -1;

  window.initPlayerClonesIfNeeded = function(forceRespawn = false) {
    clearOldCloneFaceSigns();

    const houses = (typeof window !== "undefined" && window.placedHouses && Array.isArray(window.placedHouses))
      ? window.placedHouses
      : [];
    const numHouses = houses.length;

    // Check if we already have valid clones and houses haven't changed
    if (!forceRespawn && window.playerClonesState && window.playerClonesState.length > 0 && typeof window.playerClonesState[0].theta === "number") {
      // If clones were initialized before houses existed, re-init once houses become available!
      if (numHouses > 0 && lastTrackedHousesCount === 0) {
        // Proceed to spawn at houses
      } else if (lastTrackedHousesRef === houses && lastTrackedHousesCount === numHouses) {
        return;
      }
    }

    lastTrackedHousesRef = houses;
    lastTrackedHousesCount = numHouses;

    // Target clone count: half of the procedural houses count (at least 1 if houses exist)
    const cloneCount = numHouses > 0 ? Math.max(1, Math.floor(numHouses / 2)) : 0;
    if (cloneCount === 0) {
      window.playerClonesState = [];
      return;
    }

    const seed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : 0;
    const planetRadius = (typeof RADIUS !== "undefined") ? RADIUS : 8.0;

    // Shuffle house indices so clones are placed at distinct random houses
    const shuffledHouseIndices = [];
    for (let i = 0; i < numHouses; i++) shuffledHouseIndices.push(i);
    for (let i = shuffledHouseIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffledHouseIndices[i];
      shuffledHouseIndices[i] = shuffledHouseIndices[j];
      shuffledHouseIndices[j] = tmp;
    }

    // Shuffle emoji faces for diverse, unique expressions
    const shuffledFaces = CLONE_EMOJI_FACES.slice();
    for (let i = shuffledFaces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffledFaces[i];
      shuffledFaces[i] = shuffledFaces[j];
      shuffledFaces[j] = tmp;
    }

    const clones = [];
    for (let i = 0; i < cloneCount; i++) {
      const hIdx = shuffledHouseIndices[i % numHouses];
      const spawnLoc = getCloneHouseSpawn(hIdx, houses, seed, planetRadius);

      let cTheta = 0.6;
      let cPhi = 0.0;
      let heading = Math.random() * Math.PI * 2;

      if (spawnLoc && typeof spawnLoc.theta === "number") {
        cTheta = spawnLoc.theta;
        cPhi = spawnLoc.phi;

        // Face outward away from the house front
        if (spawnLoc.house && typeof spawnLoc.x === "number") {
          const dx = spawnLoc.x - spawnLoc.house.x;
          const dy = spawnLoc.y - spawnLoc.house.y;
          const dz = spawnLoc.z - spawnLoc.house.z;
          const sinT = Math.sin(cTheta);
          const cosT = Math.cos(cTheta);
          const sinP = Math.sin(cPhi);
          const cosP = Math.cos(cPhi);
          const east = [-sinP, 0, cosP];
          const north = [-cosT * cosP, sinT, -cosT * sinP];
          const dEast = dx * east[0] + dy * east[1] + dz * east[2];
          const dNorth = dx * north[0] + dy * north[1] + dz * north[2];
          if (dEast * dEast + dNorth * dNorth > 0.0001) {
            heading = Math.atan2(dEast, dNorth) + (Math.random() - 0.5) * 0.4;
          }
        }
      } else {
        // Fallback near player if house location could not be determined
        const pTheta = (typeof charTheta !== "undefined") ? charTheta : 0.6;
        const pPhi = (typeof charPhi !== "undefined") ? charPhi : 0.0;
        const pHeading = (typeof charHeading !== "undefined") ? charHeading : 0.0;
        const angle = (i / cloneCount) * Math.PI * 2;
        const dist = 1.0 + (i % 3) * 0.3;
        const dNorth = Math.cos(angle) * dist;
        const dEast = Math.sin(angle) * dist;
        const sinT = Math.max(0.05, Math.sin(pTheta));
        cTheta = Math.max(0.08, Math.min(Math.PI - 0.08, pTheta - dNorth / planetRadius));
        cPhi = pPhi + dEast / (planetRadius * sinT);
        heading = pHeading + (i - cloneCount / 2) * 0.3;
      }

      const face = shuffledFaces[i % shuffledFaces.length];

      clones.push({
        houseIndex: hIdx,
        theta: cTheta,
        phi: cPhi,
        baseTheta: cTheta,
        basePhi: cPhi,
        targetTheta: cTheta,
        targetPhi: cPhi,
        heading: heading,
        timer: 1.0 + (i % 4) * 0.4,
        isIdle: true,
        moveSpeed: 0.65 + (i % 3) * 0.15,
        animPhase: i * 1.3,
        walkBlend: 0.0,
        faceText: face
      });
    }

    window.playerClonesState = clones;
    console.log("👥 สปอนตัวโคลนรอบบ้านสุ่มสำเร็จ:", clones.length, "ตัว จากบ้านทั้งหมด:", numHouses, "หลัง");
  };

  window.respawnPlayerClonesNearHouses = function() {
    window.playerClonesState = null;
    window.initPlayerClonesIfNeeded(true);
  };

  window.respawnPlayerClonesNearPlayer = function() {
    window.respawnPlayerClonesNearHouses();
  };

  window.updatePlayerClones = function(dt) {
    if (typeof window.initPlayerClonesIfNeeded === "function") {
      window.initPlayerClonesIfNeeded();
    }
    if (!window.playerClonesState || window.playerClonesState.length === 0) return;

    const planetRadius = (typeof RADIUS !== "undefined") ? RADIUS : 8.0;
    const heightScale = (typeof HEIGHT_SCALE !== "undefined") ? HEIGHT_SCALE : 1.0;
    const seed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : 0;
    const wLevel = (typeof waterLevel !== "undefined") ? waterLevel : 1.0;
    const minDryRadius = planetRadius + wLevel * (heightScale * 0.25) + 0.05;
    const dtClamped = Math.min(0.05, Math.max(0.001, dt || 0.016));

    for (let i = 0; i < window.playerClonesState.length; i++) {
      const cState = window.playerClonesState[i];

      // Independent wandering AI: each clone strolls peacefully in the yard around their assigned house
      cState.timer -= dtClamped;
      if (cState.isIdle) {
        cState.walkBlend = Math.max(0.0, cState.walkBlend - dtClamped * 4.0);
        if (cState.timer <= 0) {
          cState.isIdle = false;
          cState.timer = 2.0 + Math.random() * 3.5;

          // Pick random waypoint around their assigned house
          const rAngle = Math.random() * Math.PI * 2;
          const rDist = 0.35 + Math.random() * 1.25;
          const dNorth = Math.cos(rAngle) * rDist;
          const dEast = Math.sin(rAngle) * rDist;
          const candTheta = Math.max(0.08, Math.min(Math.PI - 0.08, cState.baseTheta - dNorth / planetRadius));
          const sinBaseT = Math.max(0.05, Math.sin(cState.baseTheta));
          const candPhi = cState.basePhi + dEast / (planetRadius * sinBaseT);

          // Verify waypoint is above water
          const hVal = (typeof getVisualHeightOnSphere === "function")
            ? getVisualHeightOnSphere(candTheta, candPhi, seed)
            : 0;
          const candRadius = planetRadius + hVal * heightScale;

          if (candRadius >= minDryRadius) {
            cState.targetTheta = candTheta;
            cState.targetPhi = candPhi;
          } else {
            // Keep close to house base if near water boundary
            cState.targetTheta = cState.baseTheta;
            cState.targetPhi = cState.basePhi;
          }
        }
      } else {
        cState.walkBlend = Math.min(1.0, cState.walkBlend + dtClamped * 4.0);
        cState.animPhase += dtClamped * 7.5;

        const dNorth = -(cState.targetTheta - cState.theta) * planetRadius;
        const sinT = Math.max(0.05, Math.sin(cState.theta));
        let dPhi = cState.targetPhi - cState.phi;
        while (dPhi > Math.PI) dPhi -= Math.PI * 2;
        while (dPhi < -Math.PI) dPhi += Math.PI * 2;
        const dEast = dPhi * (planetRadius * sinT);
        const distToTarget = Math.sqrt(dNorth * dNorth + dEast * dEast);

        if (distToTarget > 0.04) {
          cState.heading = Math.atan2(dEast, dNorth);
          const step = Math.min(cState.moveSpeed * dtClamped, distToTarget);
          cState.theta = Math.max(0.08, Math.min(Math.PI - 0.08, cState.theta - (Math.cos(cState.heading) * step) / planetRadius));
          cState.phi += (Math.sin(cState.heading) * step) / (planetRadius * sinT);
        }

        if (distToTarget <= 0.04 || cState.timer <= 0) {
          cState.isIdle = true;
          cState.timer = 1.2 + Math.random() * 2.8;
        }
      }
    }
  };

  window.renderPlayerClones = function(gl, opts) {
    if (!window.playerClonesState || window.playerClonesState.length === 0) return;
    
    const {
      viewMatrix,
      eyePos,
      charMVLoc,
      charModelMatrixLoc,
      charPosLoc,
      charNormLoc,
      charColorLoc,
      charLocalPosLoc,
      charFaceTexLoc,
      charUseFaceTexLoc,
      charIndicesLength: originalCharIndicesLength,
      supportUint32
    } = opts;

    const charScale = (typeof playerScale !== "undefined") ? playerScale : 0.1;
    const planetRadius = (typeof RADIUS !== "undefined") ? RADIUS : 8.0;

    const minCameraDistToCloneSq = (0.04 * (charScale / 0.22)) * (0.04 * (charScale / 0.22));

    let currentIndicesLen = originalCharIndicesLength;
    let useCloneBuffers = false;

    if (window.cloneMeshBuffers && window.cloneMeshBuffers.vertexBuffer) {
      const cb = window.cloneMeshBuffers;
      useCloneBuffers = true;
      currentIndicesLen = cb.indicesLength;
      
      if (typeof charPosLoc !== "undefined" && charPosLoc !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, cb.vertexBuffer);
        gl.vertexAttribPointer(charPosLoc, 3, gl.FLOAT, false, 0, 0);
      }
      if (typeof charLocalPosLoc !== "undefined" && charLocalPosLoc !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, cb.localVertexBuffer);
        gl.vertexAttribPointer(charLocalPosLoc, 3, gl.FLOAT, false, 0, 0);
      }
      if (typeof charNormLoc !== "undefined" && charNormLoc !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, cb.normalBuffer);
        gl.vertexAttribPointer(charNormLoc, 3, gl.FLOAT, false, 0, 0);
      }
      if (typeof charColorLoc !== "undefined" && charColorLoc !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, cb.colorBuffer);
        gl.vertexAttribPointer(charColorLoc, 3, gl.FLOAT, false, 0, 0);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cb.indexBuffer);
    } else {
      if (charLocalPosLoc !== -1 && typeof charLocalVertexBuffer !== "undefined" && charLocalVertexBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, charLocalVertexBuffer);
        gl.enableVertexAttribArray(charLocalPosLoc);
        gl.vertexAttribPointer(charLocalPosLoc, 3, gl.FLOAT, false, 0, 0);
      }
    }

    if (charUseFaceTexLoc) {
      gl.uniform1f(charUseFaceTexLoc, 1.0);
    }
    if (charFaceTexLoc) {
      gl.uniform1i(charFaceTexLoc, 3);
    }

    const mulMat = (typeof multiplyMatrices === "function") ? multiplyMatrices : function(a, b) {
      const r = new Array(16);
      for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
          r[col * 4 + row] =
            a[0 * 4 + row] * b[col * 4 + 0] +
            a[1 * 4 + row] * b[col * 4 + 1] +
            a[2 * 4 + row] * b[col * 4 + 2] +
            a[3 * 4 + row] * b[col * 4 + 3];
        }
      }
      return r;
    };

    for (let i = 0; i < window.playerClonesState.length; i++) {
      const cState = window.playerClonesState[i];
      const { cPos, cR, cF, cN } = getCloneVectors(cState, charScale, planetRadius);

      const walkBob = Math.sin(cState.animPhase) * 0.010 * cState.walkBlend * charScale;
      const idleBob = Math.sin(cState.timer * 2.5) * 0.003 * (1.0 - cState.walkBlend) * charScale;
      const finalPos = [
        cPos[0] + (walkBob + idleBob) * cN[0],
        cPos[1] + (walkBob + idleBob) * cN[1],
        cPos[2] + (walkBob + idleBob) * cN[2]
      ];

      if (eyePos) {
        const dx = finalPos[0] - eyePos[0];
        const dy = finalPos[1] - eyePos[1];
        const dz = finalPos[2] - eyePos[2];
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq < minCameraDistToCloneSq) {
          continue; 
        }
      }

      f32_cloneModel[0] = cR[0] * charScale; f32_cloneModel[1] = cR[1] * charScale; f32_cloneModel[2] = cR[2] * charScale; f32_cloneModel[3] = 0;
      f32_cloneModel[4] = cN[0] * charScale; f32_cloneModel[5] = cN[1] * charScale; f32_cloneModel[6] = cN[2] * charScale; f32_cloneModel[7] = 0;
      f32_cloneModel[8] = cF[0] * charScale; f32_cloneModel[9] = cF[1] * charScale; f32_cloneModel[10] = cF[2] * charScale; f32_cloneModel[11] = 0;
      f32_cloneModel[12] = finalPos[0]; f32_cloneModel[13] = finalPos[1]; f32_cloneModel[14] = finalPos[2]; f32_cloneModel[15] = 1;

      const cloneMV = mulMat(viewMatrix, f32_cloneModel);
      for (let mi = 0; mi < 16; mi++) f32_cloneMV[mi] = cloneMV[mi];

      gl.uniformMatrix4fv(charMVLoc, false, f32_cloneMV);
      if (charModelMatrixLoc) {
        gl.uniformMatrix4fv(charModelMatrixLoc, false, f32_cloneModel);
      }

      if (charFaceTexLoc) {
        gl.activeTexture(gl.TEXTURE3);
        const faceTex = getCloneFaceTexture(gl, cState.faceText || "(^_^)");
        gl.bindTexture(gl.TEXTURE_2D, faceTex);
      }

      if (supportUint32 && currentIndicesLen > 65535) {
        gl.drawElements(gl.TRIANGLES, currentIndicesLen, gl.UNSIGNED_INT, 0);
      } else {
        gl.drawElements(gl.TRIANGLES, currentIndicesLen, gl.UNSIGNED_SHORT, 0);
      }
    }

    if (charUseFaceTexLoc) {
      gl.uniform1f(charUseFaceTexLoc, 0.0);
    }
    gl.activeTexture(gl.TEXTURE0);

    if (useCloneBuffers) {
      if (typeof charPosLoc !== "undefined" && charPosLoc !== -1 && typeof charVertexBuffer !== "undefined" && charVertexBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, charVertexBuffer);
        gl.vertexAttribPointer(charPosLoc, 3, gl.FLOAT, false, 0, 0);
      }
      if (typeof charLocalPosLoc !== "undefined" && charLocalPosLoc !== -1 && typeof charLocalVertexBuffer !== "undefined" && charLocalVertexBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, charLocalVertexBuffer);
        gl.vertexAttribPointer(charLocalPosLoc, 3, gl.FLOAT, false, 0, 0);
      }
      if (typeof charNormLoc !== "undefined" && charNormLoc !== -1 && typeof charNormalBuffer !== "undefined" && charNormalBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, charNormalBuffer);
        gl.vertexAttribPointer(charNormLoc, 3, gl.FLOAT, false, 0, 0);
      }
      if (typeof charColorLoc !== "undefined" && charColorLoc !== -1 && typeof charColorBuffer !== "undefined" && charColorBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, charColorBuffer);
        gl.vertexAttribPointer(charColorLoc, 3, gl.FLOAT, false, 0, 0);
      }
      if (typeof charIndexBuffer !== "undefined" && charIndexBuffer) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, charIndexBuffer);
      }
    } else {
      if (charLocalPosLoc !== -1 && typeof charLocalVertexBuffer !== "undefined" && charLocalVertexBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, charLocalVertexBuffer);
        gl.vertexAttribPointer(charLocalPosLoc, 3, gl.FLOAT, false, 0, 0);
      }
    }
  };

  window.renderPlayerClonesShadow = function(gl, depthModelLoc, charIndicesLengthArg, supportUint32, depthPosLoc) {
    if (!window.playerClonesState || window.playerClonesState.length === 0) return;
    const charScale = (typeof playerScale !== "undefined") ? playerScale : 0.1;
    const planetRadius = (typeof RADIUS !== "undefined") ? RADIUS : 8.0;
    
    let currentIndicesLen = charIndicesLengthArg;
    let useCloneBuffers = false;
    
    if (window.cloneMeshBuffers && window.cloneMeshBuffers.vertexBuffer) {
      useCloneBuffers = true;
      currentIndicesLen = window.cloneMeshBuffers.indicesLength;
      
      if (typeof depthPosLoc !== "undefined" && depthPosLoc !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, window.cloneMeshBuffers.vertexBuffer);
        gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, window.cloneMeshBuffers.indexBuffer);
    }

    for (let i = 0; i < window.playerClonesState.length; i++) {
      const cState = window.playerClonesState[i];
      const { cPos, cR, cF, cN } = getCloneVectors(cState, charScale, planetRadius);

      const walkBob = Math.sin(cState.animPhase) * 0.010 * cState.walkBlend * charScale;
      const idleBob = Math.sin(cState.timer * 2.5) * 0.003 * (1.0 - cState.walkBlend) * charScale;
      const finalPos = [
        cPos[0] + (walkBob + idleBob) * cN[0],
        cPos[1] + (walkBob + idleBob) * cN[1],
        cPos[2] + (walkBob + idleBob) * cN[2]
      ];

      f32_cloneModel[0] = cR[0] * charScale; f32_cloneModel[1] = cR[1] * charScale; f32_cloneModel[2] = cR[2] * charScale; f32_cloneModel[3] = 0;
      f32_cloneModel[4] = cN[0] * charScale; f32_cloneModel[5] = cN[1] * charScale; f32_cloneModel[6] = cN[2] * charScale; f32_cloneModel[7] = 0;
      f32_cloneModel[8] = cF[0] * charScale; f32_cloneModel[9] = cF[1] * charScale; f32_cloneModel[10] = cF[2] * charScale; f32_cloneModel[11] = 0;
      f32_cloneModel[12] = finalPos[0]; f32_cloneModel[13] = finalPos[1]; f32_cloneModel[14] = finalPos[2]; f32_cloneModel[15] = 1;

      gl.uniformMatrix4fv(depthModelLoc, false, f32_cloneModel);

      if (supportUint32 && currentIndicesLen > 65535) {
        gl.drawElements(gl.TRIANGLES, currentIndicesLen, gl.UNSIGNED_INT, 0);
      } else {
        gl.drawElements(gl.TRIANGLES, currentIndicesLen, gl.UNSIGNED_SHORT, 0);
      }
    }
    
    if (useCloneBuffers) {
      if (typeof depthPosLoc !== "undefined" && depthPosLoc !== -1 && typeof charVertexBuffer !== "undefined" && charVertexBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, charVertexBuffer);
        gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
      }
      if (typeof charIndexBuffer !== "undefined" && charIndexBuffer) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, charIndexBuffer);
      }
    }
  };

  // Expose PlayerClones namespace object
  window.PlayerClones = {
    getVectors: getCloneVectors,
    getFaceTexture: getCloneFaceTexture,
    init: window.initPlayerClonesIfNeeded,
    respawn: window.respawnPlayerClonesNearHouses,
    respawnNearPlayer: window.respawnPlayerClonesNearHouses,
    update: window.updatePlayerClones,
    render: window.renderPlayerClones,
    renderShadow: window.renderPlayerClonesShadow,
    EMOJI_FACES: CLONE_EMOJI_FACES
  };
})();
