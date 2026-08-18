// === SEEDPLANET MODULE: JS/DEVTOOL.JS ===

// ============================================
// ระบบเครื่องมือพัฒนาเสกของ (Dev Tool Spawn Items) - Don't use LocalStorage
// ============================================
(function() {
  const listEl = document.getElementById("devSpawnItemList");
  if (listEl) {
    listEl.innerHTML = "";
    ALL_ITEMS.forEach(item => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "4px";
      
      const btn1 = document.createElement("button");
      btn1.className = "btn-random";
      btn1.style.flex = "1";
      btn1.style.margin = "0";
      btn1.style.padding = "4px";
      btn1.style.fontSize = "11px";
      btn1.style.backgroundImage = "linear-gradient(135deg, #e65100, #ff9800)";
      btn1.style.textAlign = "left";
      btn1.innerHTML = `${item.icon} ${item.name}`;
      
      const btn50 = document.createElement("button");
      btn50.className = "btn-random";
      btn50.style.flex = "0 0 40px";
      btn50.style.margin = "0";
      btn50.style.padding = "4px";
      btn50.style.fontSize = "11px";
      btn50.style.backgroundImage = "linear-gradient(135deg, #bf360c, #ff5722)";
      btn50.textContent = "x50";

      btn1.addEventListener("click", () => {
        if (!isDevMode) return;
        const added = addItemToInventory({ name: item.name, icon: item.icon, label: item.name }, false);
        if (added) {
          showNotice(`เสกสำเร็จ: ได้รับ ${item.icon} ${item.name} x1 !`);
        } else {
          showNotice("❌ กระเป๋าเต็มแล้ว! (Inventory is full)");
        }
      });

      btn50.addEventListener("click", () => {
        if (!isDevMode) return;
        let successCount = 0;
        for (let i = 0; i < 50; i++) {
          const added = addItemToInventory({ name: item.name, icon: item.icon, label: item.name }, false, false);
          if (added) {
            successCount++;
          } else {
            break;
          }
        }
        if (successCount > 0) {
          if (typeof renderInventory === "function") renderInventory();
          showNotice(`เสกสำเร็จ: ได้รับ ${item.icon} ${item.name} x${successCount} !`);
        } else {
          showNotice("❌ กระเป๋าเต็มแล้ว! (Inventory is full)");
        }
      });
      
      row.appendChild(btn1);
      row.appendChild(btn50);
      listEl.appendChild(row);
    });
  }
})();

function modTerrainAtPlayer(delta, bypassDevCheck = false, customTargetPoint = null, customR = null, mode = "normal") {
  if (!isDevMode && !bypassDevCheck) return;
  
  let x, y, z;
  if (customTargetPoint) {
      const len = Math.sqrt(customTargetPoint[0]**2 + customTargetPoint[1]**2 + customTargetPoint[2]**2);
      if (len > 0.001) {
          x = customTargetPoint[0] / len;
          y = customTargetPoint[1] / len;
          z = customTargetPoint[2] / len;
      } else {
          const sinT = Math.sin(charTheta);
          const cosT = Math.cos(charTheta);
          const sinP = Math.sin(charPhi);
          const cosP = Math.cos(charPhi);
          x = sinT * cosP;
          y = cosT;
          z = sinT * sinP;
      }
  } else {
      const sinT = Math.sin(charTheta);
      const cosT = Math.cos(charTheta);
      const sinP = Math.sin(charPhi);
      const cosP = Math.cos(charPhi);
      x = sinT * cosP;
      y = cosT;
      z = sinT * sinP;
  }
  
  if (mode === "trench" && delta < 0) {
      const targetTheta = Math.acos(y);
      const targetPhi = Math.atan2(z, x);
      const currentTargetHeight = getHeightOnSphere(targetTheta, targetPhi, globalSeed);
      const playerHeight = getHeightOnSphere(charTheta, charPhi, globalSeed);
      
      // We want the target terrain to match the player's ground level minus a tiny bit
      const hs = typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE : 0.6;
      const rad = typeof RADIUS !== 'undefined' ? RADIUS : 8.0;
      const desiredHeight = playerHeight - (0.02 / hs); 
      const neededDelta = desiredHeight - currentTargetHeight;
      
      // If the target is significantly higher than the player, we carve it down to the player's level
      if (neededDelta < 0) {
          delta = Math.max(neededDelta, -20.0);
      } else {
          // Otherwise, we perform a normal dig of -0.35 to continue expanding the hole
          delta = -0.35;
      }
  }
  
  // If digging (delta < 0), add a 3D tunnel sphere at the target
  if (delta < 0) {
      if (!tunnels3D) tunnels3D = [];
      
      let tx, ty, tz;
      if (customTargetPoint) {
          tx = customTargetPoint[0];
          ty = customTargetPoint[1];
          tz = customTargetPoint[2];
      } else {
          const currentFeetRadius = (typeof playerCenterRadius !== 'undefined' && playerCenterRadius !== null) 
            ? (playerCenterRadius - 0.46 * playerScale) 
            : (rad + getHeightOnSphere(charTheta, charPhi, globalSeed) * hs);
          
          // Center the digging sphere slightly below player's feet so they dig downwards
          const tRadius = currentFeetRadius - 0.02;
          tx = x * tRadius;
          ty = y * tRadius;
          tz = z * tRadius;
      }
      
            // Prevent creating holes in the sky
      const tLen = Math.sqrt(tx*tx + ty*ty + tz*tz);
      if (tLen > 0.001) {
          const ux = tx / tLen;
          const uy = ty / tLen;
          const uz = tz / tLen;
          const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
          const phi = Math.atan2(uz, ux);
          const surfaceRadius = (typeof RADIUS !== 'undefined' ? RADIUS : 1.0) + (typeof getHeightOnSphere !== 'undefined' ? getHeightOnSphere(theta, phi, globalSeed) * HEIGHT_SCALE : 0);
          if (tLen > surfaceRadius + 0.05) {
              tx = ux * (surfaceRadius - 0.02);
              ty = uy * (surfaceRadius - 0.02);
              tz = uz * (surfaceRadius - 0.02);
          }
      }
      
      const tr = (customR !== null ? customR * 1.5 : 0.09) * voxelHoleRadiusMultiplier;
      
      let exists = false;
      for (let t of tunnels3D) {
          const dx = tx - t.x;
          const dy = ty - t.y;
          const dz = tz - t.z;
          if (dx*dx + dy*dy + dz*dz < 0.001) {
              exists = true;
              break;
          }
      }
      if (!exists) {
          tunnels3D.push({
              x: tx, y: ty, z: tz, r: tr, rSq: tr * tr
          });
          rebuildTunnelBuffers();
      }
  }

  // 1. Add to terrain mods so physics updates correctly, ONLY if delta >= 0 (building up)
  if (delta >= 0 && mode !== "trench") {
      if (!terrainMods) terrainMods = [];
      const r = customR !== null ? customR : 0.08;
      const rSq = r * r;
      terrainMods.push({
        x, y, z, r: r, rSq: rSq, delta: delta
      });
  }
  
  // 2. Invalidate terrain collision cache (ONLY if building/adding terrain)
  if (delta >= 0 && mode !== "trench") {
      if (typeof SurfaceSystem !== 'undefined' && SurfaceSystem.clearCache) {
        SurfaceSystem.clearCache();
      } else if (typeof terrainCacheValid !== 'undefined') {
        terrainCacheValid.fill(0);
      }
  }
  
  // 3. Update the mesh directly for real-time visualization without loading (ONLY if building/adding terrain)
  if (delta >= 0 && mode !== "trench" && terrainRawVertices && typeof vertexBuffer !== 'undefined') {
    const verts = terrainRawVertices;
    let changed = false;
    
    const r = customR !== null ? customR : 0.08;
    const rSq = r * r;
    
    for (let i = 0; i < verts.length; i += 3) {
        const vx = verts[i], vy = verts[i+1], vz = verts[i+2];
        if (vx === 0 && vy === 0 && vz === 0) continue;
        
        // compute length
        const len = Math.sqrt(vx*vx + vy*vy + vz*vz);
        if (len === 0) continue;
        
        // normalized dir
        const nx = vx / len;
        const ny = vy / len;
        const nz = vz / len;
        
        const dx = nx - x;
        const dy = ny - y;
        const dz = nz - z;
        const distSq = dx*dx + dy*dy + dz*dz;
        
        if (distSq < rSq) {
            const dist = Math.sqrt(distSq);
            const factor = 1.0 - (dist / r);
            const smoothFactor = factor * factor * (3 - 2 * factor);
            
            const newDist = len + (delta * smoothFactor * HEIGHT_SCALE);
            const scale = newDist / len;
            
            verts[i] = vx * scale;
            verts[i+1] = vy * scale;
            verts[i+2] = vz * scale;
            changed = true;
        }
    }
    
    if (changed) {
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
    }
  }
  
  // No need to close the inventory, let the user spam the button!
  // Just update the mesh!
  
  showNotice(delta < 0 ? "⛏️ ขุดสำเร็จ!" : "⛰️ ถมดินสำเร็จ!");
  
  // Play a sound effect if available
  if (typeof playSplashSound === 'function') {
     playSplashSound(0.5); // use splash as temp SFX
  }
}

const digBtn = document.getElementById("devDigTerrainBtn");
if (digBtn) {
  digBtn?.addEventListener("click", () => modTerrainAtPlayer(-0.35));
}

const raiseBtn = document.getElementById("devRaiseTerrainBtn");
if (raiseBtn) {
  raiseBtn?.addEventListener("click", () => modTerrainAtPlayer(0.35));
}

  const toggleControlsBtn = document.getElementById("toggleControlsBtn");
  const mainControls = document.getElementById("mainControls");
  let controlsVisible = true;
  
  
  if (toggleControlsBtn) {
    toggleControlsBtn.style.setProperty('top', 'auto', 'important');
    toggleControlsBtn.style.setProperty('right', '50%', 'important');
    toggleControlsBtn.style.setProperty('bottom', '20px', 'important');
    toggleControlsBtn.style.setProperty('transform', 'translateX(50%)', 'important');
    toggleControlsBtn.style.setProperty('z-index', '9999', 'important');
  }
  
  if (mainControls) {
    mainControls.style.setProperty('top', '50%', 'important');
    mainControls.style.setProperty('right', '50%', 'important');
    mainControls.style.setProperty('transform', 'translate(50%, -50%)', 'important');
    mainControls.style.setProperty('width', '90vw', 'important');
    mainControls.style.setProperty('max-width', 'calc(80vh * 16 / 9)', 'important');
    mainControls.style.setProperty('aspect-ratio', '16/9', 'important');
    mainControls.style.setProperty('height', 'auto', 'important');
    mainControls.style.setProperty('max-height', '90vh', 'important');
    mainControls.style.setProperty('overflow-y', 'auto', 'important');
    mainControls.style.setProperty('padding', '24px', 'important');
    mainControls.style.setProperty('box-sizing', 'border-box', 'important');
    mainControls.style.setProperty('background', 'rgba(10, 10, 15, 0.95)', 'important');
    mainControls.style.setProperty('border', '2px solid #dfb76c', 'important');
    mainControls.style.setProperty('border-radius', '12px', 'important');
    mainControls.style.setProperty('z-index', '9998', 'important');
    
    // CSS Grid layout for perfect responsive wrapping without empty spaces
    // Flex layout for perfect responsive wrapping without empty spaces
    mainControls.style.setProperty('display', 'flex', 'important');
    mainControls.style.setProperty('flex-direction', 'row', 'important');
    mainControls.style.setProperty('flex-wrap', 'wrap', 'important');
    mainControls.style.setProperty('gap', '16px', 'important');
    mainControls.style.setProperty('align-content', 'flex-start', 'important');
    mainControls.style.setProperty('align-items', 'flex-start', 'important');
    
    // Clean up grid properties
    mainControls.style.removeProperty('grid-template-columns');
    mainControls.style.removeProperty('grid-auto-rows');

    // Fix the distanceInfo empty box issue by moving it into the distanceToggle group
    const distanceToggle = document.getElementById("distanceToggle");
    const distanceInfo = document.getElementById("distanceInfo");
    if (distanceToggle && distanceInfo) {
      const toggleGroup = distanceToggle.closest('.control-group');
      const infoGroup = distanceInfo.closest('.control-group');
      if (toggleGroup && infoGroup && toggleGroup !== infoGroup) {
        toggleGroup.appendChild(distanceInfo);
        infoGroup.remove(); // Completely remove the empty group
      }
    }

    // Inject CSS to fix control group sizes
    const styleEl = document.createElement("style");
    styleEl.innerHTML = `
      #mainControls .control-group {
        width: 240px !important;
        flex: 1 1 240px !important;
        max-width: calc(25% - 12px) !important; /* Max 4 per row */
        height: 320px !important; /* Fixed height for uniformity */
        overflow-y: auto;
        box-sizing: border-box;
        margin: 0 !important;
        padding: 16px !important;
      }
      /* Hide any genuinely empty control groups */
      #mainControls .control-group:empty {
        display: none !important;
      }
    `;
    document.head.appendChild(styleEl);
    
    // Add a close button specifically for this new layout
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "❌ ปิด";
    closeBtn.style.cssText = "position: absolute; top: 10px; right: 10px; background: #333; border: 1px solid #555; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer; z-index: 10000;";
    closeBtn.addEventListener("click", () => {
      controlsVisible = false;
      mainControls.style.display = "none";
      toggleControlsBtn.textContent = "⚙️ แสดงเมนู";
    });
    mainControls.appendChild(closeBtn);
  }
if (toggleControlsBtn && mainControls) {
    toggleControlsBtn?.addEventListener("click", () => {
      controlsVisible = !controlsVisible;
      if (controlsVisible) {
        mainControls.style.display = "flex";
        toggleControlsBtn.textContent = "⚙️ ซ่อนเมนู";
      } else {
        mainControls.style.display = "none";
        toggleControlsBtn.textContent = "⚙️ แสดงเมนู";
      }
    });
  }

// --- ระบบย้ายกล้องไปหา NPC (Teleport to NPC) ---
(function initDevNpcTeleport() {
  const updateNpcList = () => {
    const listEl = document.getElementById("devNpcList");
    if (!listEl) return;
    if (typeof amphibians === 'undefined' || !Array.isArray(amphibians)) {
      listEl.innerHTML = "<div style='color:#ccc; font-size:11px; padding:4px;'>กำลังโหลด NPC...</div>";
      return;
    }
    
    let aliveCount = 0;
    amphibians.forEach(npc => {
      if (npc.hp === undefined || npc.hp > 0) aliveCount++;
    });

    listEl.innerHTML = "";
    
    if (amphibians.length === 0 || aliveCount === 0) {
      listEl.innerHTML = "<div style='color:#ccc; font-size:11px; padding:4px;'>ไม่มี NPC ในขณะนี้</div>";
      return;
    }
    
    amphibians.forEach((npc, index) => {
      if (npc.hp !== undefined && npc.hp <= 0) return;
      
      const btn = document.createElement("button");
      btn.className = "btn-random";
      btn.style.width = "100%";
      btn.style.margin = "0";
      btn.style.padding = "4px";
      btn.style.fontSize = "11px";
      btn.style.backgroundImage = "linear-gradient(135deg, #0288d1, #29b6f6)";
      btn.style.textAlign = "left";
      btn.style.display = "block";
      
      const icon = npc.type === 'human' ? '👨' : (npc.type === 'meganeura' ? '🪰' : '🦎');
      btn.innerHTML = `${icon} ${npc.type} #${index} 🚀`;
      
      btn.addEventListener("click", () => {
        charTheta = npc.theta;
        charPhi = npc.phi;
        if (typeof playerVelocityX !== 'undefined') playerVelocityX = 0;
        if (typeof playerVelocityY !== 'undefined') playerVelocityY = 0;
        if (typeof playerVelocityZ !== 'undefined') playerVelocityZ = 0;
        if (typeof showNotice === "function") {
          showNotice(`🚀 วาร์ปไปหา ${npc.type} #${index} เรียบร้อย!`);
        } else if (typeof showNotification === "function") {
          showNotification(`🚀 วาร์ปไปหา ${npc.type} #${index} เรียบร้อย!`);
        }
      });
      
      listEl.appendChild(btn);
    });
  };

  window.updateDevNpcList = updateNpcList;

  // Update periodically
  setInterval(() => {
    const listEl = document.getElementById("devNpcList");
    if (listEl && typeof amphibians !== 'undefined') {
      let aliveCount = 0;
      amphibians.forEach(npc => {
        if (npc.hp === undefined || npc.hp > 0) aliveCount++;
      });
      if (listEl.children.length !== aliveCount && !(listEl.children.length === 1 && aliveCount === 0)) {
        updateNpcList();
      }
    }
  }, 2000);
  
  setTimeout(updateNpcList, 1000);
  setTimeout(updateNpcList, 3000);
})();

// --- ระบบปรับระยะห่าง Clouds3D จากดาว (Clouds3D Distance System) ---
(function initDevCloud3DDistance() {
  const sliderEl = document.getElementById("devCloud3DDistanceSlider");
  const labelEl = document.getElementById("devCloud3DDistanceLabel");
  
  if (!sliderEl) return;

  function updateCloudDistance(val) {
    const dist = val / 100;
    if (labelEl) labelEl.textContent = dist.toFixed(2);
    
    // Sync with main cloudsHeight slider & label if exists
    const mainSlider = document.getElementById("cloudsHeight");
    const mainLabel = document.getElementById("cloudsHeightLabel");
    if (mainSlider && mainSlider.value != val) mainSlider.value = val;
    if (mainLabel) mainLabel.textContent = dist.toFixed(2);
    
    if (typeof window.rebuildClouds3D === "function") {
      window.rebuildClouds3D(dist);
    } else if (typeof window.generateClouds3D === "function") {
      if (typeof cloudsHeight !== "undefined") cloudsHeight = dist;
      const currentSeed = typeof seedVal !== "undefined" ? seedVal : (typeof globalSeed !== "undefined" ? globalSeed : 12345);
      const currentRadius = typeof RADIUS !== "undefined" ? RADIUS : 8.0;
      window.cloud3DData = window.generateClouds3D(currentSeed, currentRadius, dist);
      if (typeof window.resetCloud3DBuffers === "function") {
        window.resetCloud3DBuffers();
      }
    }
  }

  sliderEl?.addEventListener("input", (e) => {
    updateCloudDistance(parseInt(e.target.value, 10));
  });
})();

// --- ระบบปรับความเร็วอนิเมชั่น และการเคลื่อนที่ของ Clouds3D ---
(function initDevCloud3DSpeedControls() {
  if (typeof window.cloud3DAnimSpeed !== "number") window.cloud3DAnimSpeed = 0.1;
  if (typeof window.cloud3DOrbitSpeed !== "number") window.cloud3DOrbitSpeed = 0.1;

  const animSlider = document.getElementById("devCloud3DAnimSpeedSlider");
  const animLabel = document.getElementById("devCloud3DAnimSpeedLabel");
  const orbitSlider = document.getElementById("devCloud3DOrbitSpeedSlider");
  const orbitLabel = document.getElementById("devCloud3DOrbitSpeedLabel");

  if (animSlider) {
    animSlider?.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      window.cloud3DAnimSpeed = val;
      if (animLabel) animLabel.textContent = val.toFixed(2);
    });
  }

  if (orbitSlider) {
    orbitSlider?.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      window.cloud3DOrbitSpeed = val;
      if (orbitLabel) orbitLabel.textContent = val.toFixed(2);
    });
  }
})();

// --- ระบบปรับระยะที่นั่งตัวละครในหุ่น (Mech Seat Offset System) ---
(function initDevMechSeatOffset() {
  if (typeof window.mechSeatOffset !== "number") window.mechSeatOffset = 0.71;

  const slider = document.getElementById("devMechSeatHeightSlider");
  const label = document.getElementById("devMechSeatHeightLabel");

  if (slider) {
    slider.value = Math.round(window.mechSeatOffset * 100);
    if (label) label.textContent = window.mechSeatOffset.toFixed(2);

    slider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      window.mechSeatOffset = val;
      if (label) label.textContent = val.toFixed(2);
    });
  }
})();

// --- ระบบปรับระยะกล้องขับหุ่น (Mech Camera Distance System) ---
(function initDevMechCameraDistance() {
  if (typeof window.mechCameraDistance !== "number") window.mechCameraDistance = 0.5;

  const slider = document.getElementById("devMechCameraDistSlider");
  const label = document.getElementById("devMechCameraDistLabel");

  if (slider) {
    slider.value = Math.round(window.mechCameraDistance * 100);
    if (label) label.textContent = window.mechCameraDistance.toFixed(2);

    slider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      window.mechCameraDistance = val;
      if (label) label.textContent = val.toFixed(2);
    });
  }
})();

// --- ระบบปรับระยะกล้องขับเรือ (Boat Camera Distance System) ---
(function initDevBoatCameraDistance() {
  if (typeof window.boatCameraDistance !== "number") window.boatCameraDistance = 0.37;

  const slider = document.getElementById("devBoatCameraDistSlider");
  const label = document.getElementById("devBoatCameraDistLabel");

  if (slider) {
    slider.value = Math.round(window.boatCameraDistance * 100);
    if (label) label.textContent = window.boatCameraDistance.toFixed(2);

    slider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      window.boatCameraDistance = val;
      if (label) label.textContent = val.toFixed(2);
    });
  }
})();

// --- ระบบปรับความยาวเพาล้อและตำแหน่งล้อเรือ แยกคู่หน้า-หลัง (Front/Rear Wheel Pair Controls) ---
(function initDevWheelAxleControls() {
  if (typeof window.wheelScaleMultiplier !== "number") window.wheelScaleMultiplier = 0.56;

  if (typeof window.electricEngineScaleMultiplier !== "number") window.electricEngineScaleMultiplier = 0.36;
  if (typeof window.electricEngineFwdOffset !== "number") window.electricEngineFwdOffset = -0.11;
  if (typeof window.electricEngineUpOffset !== "number") window.electricEngineUpOffset = 0.05;
  if (typeof window.electricEnginePitch !== "number") window.electricEnginePitch = 0.0;
  if (typeof window.electricEngineYaw !== "number") window.electricEngineYaw = 1.5708;
  if (typeof window.electricEngineRoll !== "number") window.electricEngineRoll = 0.0;

  if (typeof window.wheelFrontAxleLength !== "number") window.wheelFrontAxleLength = 0.28;
  if (typeof window.wheelFrontSideOffset !== "number") window.wheelFrontSideOffset = 0.14;
  if (typeof window.wheelFrontFwdOffset !== "number") window.wheelFrontFwdOffset = 0.16;
  if (typeof window.wheelFrontUpOffset !== "number") window.wheelFrontUpOffset = 0.01;

  if (typeof window.wheelRearAxleLength !== "number") window.wheelRearAxleLength = 0.28;
  if (typeof window.wheelRearSideOffset !== "number") window.wheelRearSideOffset = 0.14;
  if (typeof window.wheelRearFwdOffset !== "number") window.wheelRearFwdOffset = 0.16;
  if (typeof window.wheelRearUpOffset !== "number") window.wheelRearUpOffset = 0.01;

  function bindSlider(sliderId, labelId, getVal, setVal, isUpOffset = false) {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(labelId);
    if (!slider) return;

    if (isUpOffset) {
      slider.value = Math.round((getVal() + 0.5) * 100);
    } else {
      slider.value = Math.round(getVal() * 100);
    }
    if (label) label.textContent = getVal().toFixed(2);

    slider.addEventListener("input", (e) => {
      let val;
      if (isUpOffset) {
        val = (parseInt(e.target.value, 10) / 100) - 0.5;
      } else {
        val = parseInt(e.target.value, 10) / 100;
      }
      setVal(val);
      if (label) label.textContent = val.toFixed(2);
    });
  }

  // Scale
  bindSlider("devWheelScaleSlider", "devWheelScaleLabel", () => window.wheelScaleMultiplier, v => window.wheelScaleMultiplier = v);

  // Electric Engine
  bindSlider("devElectricEngineScaleSlider", "devElectricEngineScaleLabel", () => window.electricEngineScaleMultiplier, v => window.electricEngineScaleMultiplier = v);
  bindSlider("devElectricEngineFwdOffsetSlider", "devElectricEngineFwdOffsetLabel", () => window.electricEngineFwdOffset, v => window.electricEngineFwdOffset = v, true);
  bindSlider("devElectricEngineUpOffsetSlider", "devElectricEngineUpOffsetLabel", () => window.electricEngineUpOffset, v => window.electricEngineUpOffset = v, true);
  bindSlider("devElectricEnginePitchSlider", "devElectricEnginePitchLabel", () => window.electricEnginePitch, v => window.electricEnginePitch = v);
  bindSlider("devElectricEngineYawSlider", "devElectricEngineYawLabel", () => window.electricEngineYaw, v => window.electricEngineYaw = v);
  bindSlider("devElectricEngineRollSlider", "devElectricEngineRollLabel", () => window.electricEngineRoll, v => window.electricEngineRoll = v);

  // Front Pair
  bindSlider("devWheelFrontAxleLengthSlider", "devWheelFrontAxleLengthLabel", () => window.wheelFrontAxleLength, v => window.wheelFrontAxleLength = v);
  bindSlider("devWheelFrontSideOffsetSlider", "devWheelFrontSideOffsetLabel", () => window.wheelFrontSideOffset, v => window.wheelFrontSideOffset = v);
  bindSlider("devWheelFrontFwdOffsetSlider", "devWheelFrontFwdOffsetLabel", () => window.wheelFrontFwdOffset, v => window.wheelFrontFwdOffset = v);
  bindSlider("devWheelFrontUpOffsetSlider", "devWheelFrontUpOffsetLabel", () => window.wheelFrontUpOffset, v => window.wheelFrontUpOffset = v, true);

  // Rear Pair
  bindSlider("devWheelRearAxleLengthSlider", "devWheelRearAxleLengthLabel", () => window.wheelRearAxleLength, v => window.wheelRearAxleLength = v);
  bindSlider("devWheelRearSideOffsetSlider", "devWheelRearSideOffsetLabel", () => window.wheelRearSideOffset, v => window.wheelRearSideOffset = v);
  bindSlider("devWheelRearFwdOffsetSlider", "devWheelRearFwdOffsetLabel", () => window.wheelRearFwdOffset, v => window.wheelRearFwdOffset = v);
  bindSlider("devWheelRearUpOffsetSlider", "devWheelRearUpOffsetLabel", () => window.wheelRearUpOffset, v => window.wheelRearUpOffset = v, true);
})();

// --- ระบบปิด/เปิดการสร้าง NPCs และ Environment (Generation Toggles) ---
(function initDevGenerationToggles() {
  const npcBtn = document.getElementById("devToggleNpcBtn");
  const envBtn = document.getElementById("devToggleEnvBtn");

  if (typeof window.DISABLE_NPCS === "undefined") window.DISABLE_NPCS = false;
  if (typeof window.DISABLE_ENVIRONMENT === "undefined") window.DISABLE_ENVIRONMENT = false;

  const updateNpcBtnState = () => {
    if (npcBtn) {
      if (window.DISABLE_NPCS) {
        npcBtn.textContent = "🤖 NPCs: OFF";
        npcBtn.style.backgroundImage = "linear-gradient(135deg, #757575, #9e9e9e)";
      } else {
        npcBtn.textContent = "🤖 NPCs: ON";
        npcBtn.style.backgroundImage = "linear-gradient(135deg, #0288d1, #29b6f6)";
      }
    }
  };

  const updateEnvBtnState = () => {
    if (envBtn) {
      if (window.DISABLE_ENVIRONMENT) {
        envBtn.textContent = "🌲 Env: OFF";
        envBtn.style.backgroundImage = "linear-gradient(135deg, #757575, #9e9e9e)";
      } else {
        envBtn.textContent = "🌲 Env: ON";
        envBtn.style.backgroundImage = "linear-gradient(135deg, #43a047, #66bb6a)";
      }
    }
  };

  updateNpcBtnState();
  updateEnvBtnState();

  if (npcBtn) {
    npcBtn.addEventListener("click", () => {
      window.DISABLE_NPCS = !window.DISABLE_NPCS;
      updateNpcBtnState();
      if (typeof showNotice === "function") {
        showNotice(window.DISABLE_NPCS ? "❌ ปิดการสร้าง NPCs (รอเปลี่ยนดาว)" : "✅ เปิดการสร้าง NPCs (รอเปลี่ยนดาว)");
      }
    });
  }

  if (envBtn) {
    envBtn.addEventListener("click", () => {
      window.DISABLE_ENVIRONMENT = !window.DISABLE_ENVIRONMENT;
      updateEnvBtnState();
      if (typeof showNotice === "function") {
        showNotice(window.DISABLE_ENVIRONMENT ? "❌ ปิดการสร้าง Env (รอเปลี่ยนดาว)" : "✅ เปิดการสร้าง Env (รอเปลี่ยนดาว)");
      }
    });
  }
})();

// --- ระบบควบคุมระยะเรนเดอร์แยก 2 ระยะ: 1. พื้น (Terrain: 15.0) 2. วัตถุทุกชนิด (Objects: 5.0) ---
(function initDevSplitRenderDistance() {
  if (typeof window.terrainRenderDistValue !== "number") window.terrainRenderDistValue = 15.0;
  if (typeof window.objectRenderDistValue !== "number") window.objectRenderDistValue = 5.0;
  if (typeof window.renderDistValue !== "number") window.renderDistValue = 15.0;
  if (typeof window.renderDistEnabled !== "boolean") window.renderDistEnabled = true;

  window.setTerrainRenderDist = function(val) {
    const num = typeof val === "number" ? val : parseFloat(val);
    if (isNaN(num)) return;
    window.terrainRenderDistValue = num;
    if (typeof terrainRenderDistValue !== "undefined") {
      terrainRenderDistValue = num;
    }
    
    // Sync main input & label
    const mainInput = document.getElementById("terrainRenderDist") || document.getElementById("renderDist");
    const mainLabel = document.getElementById("terrainRenderDistLabel") || document.getElementById("renderDistLabel");
    if (mainInput && Math.round(parseFloat(mainInput.value)) !== Math.round(num * 10)) {
      mainInput.value = Math.round(num * 10);
    }
    if (mainLabel) mainLabel.textContent = num.toFixed(2);

    // Sync dev input & label
    const devInput = document.getElementById("devTerrainRenderDistSlider");
    const devLabel = document.getElementById("devTerrainRenderDistLabel");
    if (devInput && Math.round(parseFloat(devInput.value)) !== Math.round(num * 10)) {
      devInput.value = Math.round(num * 10);
    }
    if (devLabel) devLabel.textContent = num.toFixed(2);
  };

  window.setObjectRenderDist = function(val) {
    const num = typeof val === "number" ? val : parseFloat(val);
    if (isNaN(num)) return;
    window.objectRenderDistValue = num;
    if (typeof objectRenderDistValue !== "undefined") {
      objectRenderDistValue = num;
    }
    
    // Sync main input & label
    const mainInput = document.getElementById("objectRenderDist");
    const mainLabel = document.getElementById("objectRenderDistLabel");
    if (mainInput && Math.round(parseFloat(mainInput.value)) !== Math.round(num * 10)) {
      mainInput.value = Math.round(num * 10);
    }
    if (mainLabel) mainLabel.textContent = num.toFixed(2);

    // Sync dev input & label
    const devInput = document.getElementById("devObjectRenderDistSlider");
    const devLabel = document.getElementById("devObjectRenderDistLabel");
    if (devInput && Math.round(parseFloat(devInput.value)) !== Math.round(num * 10)) {
      devInput.value = Math.round(num * 10);
    }
    if (devLabel) devLabel.textContent = num.toFixed(2);
  };

  const devTerrainSlider = document.getElementById("devTerrainRenderDistSlider");
  const devObjectSlider = document.getElementById("devObjectRenderDistSlider");

  if (devTerrainSlider) {
    devTerrainSlider.value = Math.round(window.terrainRenderDistValue * 10);
    devTerrainSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) / 10;
      window.setTerrainRenderDist(val);
    });
  }

  if (devObjectSlider) {
    devObjectSlider.value = Math.round(window.objectRenderDistValue * 10);
    devObjectSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) / 10;
      window.setObjectRenderDist(val);
    });
  }
})();

// --- ระบบกล้องตัวละครมุมมองที่ 3 และกล้องฟรี (3rd-Person Camera & FreeCam Controller) ---
(function initDevFreeCameraController() {
  const mainControls = document.getElementById("mainControls");
  if (!mainControls || document.getElementById("devFreeCamControlGroup")) return;

  const group = document.createElement("div");
  group.className = "control-group";
  group.id = "devFreeCamControlGroup";
  group.innerHTML = `
    <label>🎥 โหมดกล้องตัวละคร & กล้องฟรี (Camera & FreeCam)</label>
    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
      <!-- ปุ่มเปิด/ปิด กล้องฟรี (Free Camera) ขนาดใหญ่ -->
      <button id="devToggleFreeCamBtn" class="btn-random" style="background-image: linear-gradient(135deg, #1565c0, #1e88e5); margin: 0; padding: 10px 8px; font-size: 13px; text-align: center; font-weight: bold; color: #fff; cursor: pointer; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2);">
        🚁 เปิดโหมดกล้องฟรี (FreeCam)
      </button>

      <!-- ปุ่มสลับโหมดกล้องตัวละคร 3 มุมมอง -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px;">
        <button id="devCamThirdPersonBtn" class="btn-random" style="background-image: linear-gradient(135deg, #2e7d32, #43a047); margin: 0; padding: 6px 2px; font-size: 10px; text-align: center; font-weight: bold; color: #fff;">
          มุมมองที่ 3
        </button>
        <button id="devCamTPSBtn" class="btn-random" style="background-image: linear-gradient(135deg, #00695c, #00897b); margin: 0; padding: 6px 2px; font-size: 10px; text-align: center; font-weight: bold; color: #fff;">
          TPS ข้างไหล่
        </button>
        <button id="devCamFPSBtn" class="btn-random" style="background-image: linear-gradient(135deg, #37474f, #546e7a); margin: 0; padding: 6px 2px; font-size: 10px; text-align: center; font-weight: bold; color: #fff;">
          FPS ที่ 1
        </button>
      </div>

      <!-- ปุ่มฟังก์ชันเสริมกล้องฟรี -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
        <button id="devTeleportFreeCamBtn" class="btn-random" style="background-image: linear-gradient(135deg, #e65100, #f57c00); margin: 0; padding: 6px 4px; font-size: 10px; text-align: center; font-weight: bold; color: #fff;">
          📍 วาร์ปกล้องหาผู้เล่น
        </button>
        <button id="devResetCamAngleBtn" class="btn-random" style="background-image: linear-gradient(135deg, #424242, #616161); margin: 0; padding: 6px 4px; font-size: 10px; text-align: center; color: #fff;">
          🔄 รีเซ็ตมุมมอง
        </button>
      </div>

      <!-- ปุ่มสลับกล้องไปหา Satellite Sun -->
      <button id="devCamToSunBtn" class="btn-random" style="background-image: linear-gradient(135deg, #ff6f00, #ff8f00); margin: 0; padding: 8px 4px; font-size: 11px; text-align: center; font-weight: bold; color: #fff;">
        ☀️ สลับกล้องไปหา Satellite Sun
      </button>

      <!-- สไลเดอร์ปรับความเร็วการบินของกล้องฟรี -->
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #bbb;">
          <span>🚀 ความเร็วบินกล้องฟรี (Speed):</span>
          <span id="devFreeCamSpeedLabel">15.0 m/s</span>
        </div>
        <input type="range" id="devFreeCamSpeedSlider" min="1" max="100" step="1" value="15" style="width: 100%; cursor: pointer;" />
      </div>

      <!-- คำแนะนำการควบคุมและสถานะพิกัด -->
      <div id="devFreeCamInfoBox" style="font-size: 10px; color: #90caf9; line-height: 1.4; background: rgba(0,0,0,0.4); padding: 7px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">
        <div>🎮 <b>วิธีบังคับกล้องฟรี:</b></div>
        <div style="color: #e0e0e0; font-size: 9.5px; margin-top: 2px;">
          • <b>W/A/S/D</b> : บินเคลื่อนที่ 4 ทิศทาง<br/>
          • <b>Q / E (หรือ Space)</b> : บินลด / เพิ่มระดับความสูง<br/>
          • <b>Shift</b> : บินเร่งความเร็ว x3<br/>
          • <b>ลากเมาส์</b> : หมุนหันมุมมองรอบทิศทาง 360°<br/>
          • <b>ล้อเมาส์</b> : ปรับความเร็วการบินแบบสด
        </div>
        <div id="devFreeCamPosText" style="margin-top: 4px; font-weight: bold; color: #80cbc4; font-size: 9.5px;">
          สถานะ: มุมมองที่ 3 (Third Person)
        </div>
      </div>
    </div>
  `;
  mainControls.appendChild(group);

  // Element References
  const toggleBtn = group.querySelector("#devToggleFreeCamBtn");
  const tpsBtn = group.querySelector("#devCamTPSBtn");
  const thirdPersonBtn = group.querySelector("#devCamThirdPersonBtn");
  const fpsBtn = group.querySelector("#devCamFPSBtn");
  const teleportBtn = group.querySelector("#devTeleportFreeCamBtn");
  const resetBtn = group.querySelector("#devResetCamAngleBtn");
  const speedSlider = group.querySelector("#devFreeCamSpeedSlider");
  const speedLabel = group.querySelector("#devFreeCamSpeedLabel");
  const posText = group.querySelector("#devFreeCamPosText");

  function updateCamUI() {
    const mode = window.cameraMode || (typeof cameraMode !== "undefined" ? cameraMode : "thirdperson");
    const isFree = (mode === "freecam");

    if (toggleBtn) {
      if (isFree) {
        toggleBtn.textContent = "🟢 ปิดกล้องฟรี (กลับสู่มุมมองตัวละคร)";
        toggleBtn.style.backgroundImage = "linear-gradient(135deg, #c62828, #e53935)";
      } else {
        toggleBtn.textContent = "🚁 เปิดโหมดกล้องฟรี (FreeCam)";
        toggleBtn.style.backgroundImage = "linear-gradient(135deg, #1565c0, #1e88e5)";
      }
    }

    if (speedSlider && typeof window.freeCamSpeed === "number") {
      speedSlider.value = Math.round(window.freeCamSpeed);
      if (speedLabel) speedLabel.textContent = `${window.freeCamSpeed.toFixed(1)} m/s`;
    }

    if (posText) {
      if (isFree && window.freeCamPos) {
        posText.innerHTML = `🚁 กล้องฟรี: [X: ${window.freeCamPos[0].toFixed(1)}, Y: ${window.freeCamPos[1].toFixed(1)}, Z: ${window.freeCamPos[2].toFixed(1)}]`;
        posText.style.color = "#80cbc4";
      } else {
        let label = "มุมมองที่ 3 (ตรงกลาง)";
        if (mode === "tps") label = "TPS (ข้างไหล่)";
        else if (mode === "fps") label = "FPS (บุคคลที่ 1)";
        else if (mode === "sun") label = "☀️ Satellite Sun (ดวงอาทิตย์)";
        posText.innerHTML = `📷 โหมดปัจจุบัน: <b>${label}</b>`;
        posText.style.color = mode === "sun" ? "#ffd54f" : "#90caf9";
      }
    }
  }

  // Event Listeners
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      if (typeof window.toggleFreeCamera === "function") {
        window.toggleFreeCamera();
      } else {
        const cur = window.cameraMode || "thirdperson";
        window.setCameraMode(cur === "freecam" ? "thirdperson" : "freecam");
      }
      updateCamUI();
    });
  }

  if (thirdPersonBtn) {
    thirdPersonBtn.addEventListener("click", () => {
      if (typeof window.setCameraMode === "function") window.setCameraMode("thirdperson");
      updateCamUI();
    });
  }

  if (tpsBtn) {
    tpsBtn.addEventListener("click", () => {
      if (typeof window.setCameraMode === "function") window.setCameraMode("tps");
      updateCamUI();
    });
  }

  if (fpsBtn) {
    fpsBtn.addEventListener("click", () => {
      if (typeof window.setCameraMode === "function") window.setCameraMode("fps");
      updateCamUI();
    });
  }

  const camToSunBtn = group.querySelector("#devCamToSunBtn");
  if (camToSunBtn) {
    camToSunBtn.addEventListener("click", () => {
      // สลับเป็นโหมดกล้องดาวส่อง Satellite Sun (ใช้ macroPosition [0, 0, 0] จาก SpacesMap)
      if (typeof window.setCameraMode === "function") {
        window.setCameraMode("sun");
      } else {
        window.cameraMode = "sun";
        if (window.cameraSpringArm) window.cameraSpringArm.setMode("sun");
      }

      if (typeof showNotice === "function") {
        showNotice("☀️ สลับกล้องจับ Satellite Sun (พิกัดจำลอง macroPosition: [0, 0, 0]) เรียบร้อยแล้ว");
      }
      updateCamUI();
    });
  }

  if (teleportBtn) {
    teleportBtn.addEventListener("click", () => {
      if (typeof window.teleportFreeCamToPlayer === "function") {
        window.teleportFreeCamToPlayer();
      }
      updateCamUI();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (window.cameraMode === "freecam") {
        if (typeof rotationY === "number") window.freeCamYaw = rotationY;
        if (typeof rotationX === "number") window.freeCamPitch = rotationX;
      } else {
        if (typeof rotationX !== "undefined") rotationX = 0.2;
      }
      if (typeof showNotice === "function") showNotice("🔄 รีเซ็ตมุมมองกล้องแล้ว");
      updateCamUI();
    });
  }

  if (speedSlider) {
    speedSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      window.freeCamSpeed = val;
      if (speedLabel) speedLabel.textContent = `${val.toFixed(1)} m/s`;
    });
  }

  // Update real-time loop for status text
  setInterval(() => {
    if (group.offsetParent !== null) {
      updateCamUI();
    }
  }, 400);
})();

// --- ระบบสลับดาวเคราะห์ (SpacesMap Active Planet Switcher) ---
(function initDevPlanetSwitcher() {
  const mainControls = document.getElementById("mainControls");
  if (!mainControls || document.getElementById("devPlanetSwitchGroup")) return;

  const group = document.createElement("div");
  group.className = "control-group";
  group.id = "devPlanetSwitchGroup";
  group.innerHTML = `
    <label>🪐 ระบบสลับดาวเคราะห์ (SpacesMap Planet Switcher)</label>
    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
      <!-- สถานะดาวปัจจุบัน -->
      <div id="devActivePlanetBanner" style="font-size: 11px; padding: 6px 8px; background: rgba(0, 20, 40, 0.7); border: 1px solid rgba(0, 200, 255, 0.4); border-radius: 4px; color: #80d8ff;">
        ดาวปัจจุบัน: <b id="devActivePlanetName">🌱 ดาวแม่พันธุ์พืชหลัก (Genesis)</b>
      </div>

      <!-- ปุ่มสลับดาว 1 - 5 -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
        <button id="devSwitchPlanet1" class="btn-random" style="background-image: linear-gradient(135deg, #1b5e20, #2e7d32); margin: 0; padding: 7px 4px; font-size: 11px; font-weight: bold; color: #fff; text-align: center;">
          🌱 ดาว 1 (Genesis)
        </button>
        <button id="devSwitchPlanet2" class="btn-random" style="background-image: linear-gradient(135deg, #01579b, #0288d1); margin: 0; padding: 7px 4px; font-size: 11px; font-weight: bold; color: #fff; text-align: center;">
          🌊 ดาว 2 (Oceania)
        </button>
        <button id="devSwitchPlanet3" class="btn-random" style="background-image: linear-gradient(135deg, #33691e, #558b2f); margin: 0; padding: 7px 4px; font-size: 11px; font-weight: bold; color: #fff; text-align: center;">
          🌲 ดาว 3 (Verdant)
        </button>
        <button id="devSwitchPlanet4" class="btn-random" style="background-image: linear-gradient(135deg, #880e4f, #ad1457); margin: 0; padding: 7px 4px; font-size: 11px; font-weight: bold; color: #fff; text-align: center;">
          🌸 ดาว 4 (Botanical)
        </button>
      </div>

      <button id="devSwitchPlanet5" class="btn-random" style="background-image: linear-gradient(135deg, #e65100, #f57c00); margin: 0; padding: 7px 4px; font-size: 11px; font-weight: bold; color: #fff; text-align: center;">
        ⚡ ดาว 5 (Bio-Flux)
      </button>

      <div style="font-size: 10px; color: #90a4ae; line-height: 1.4;">
        ℹ️ <i>เมื่อสลับดาว SpacesMap จะสร้างผิวดาวดวงใหม่มาวางที่ [0, 0, 0] เพื่อให้ระบบฟิสิกส์และการเดินทำงานได้อย่างสมบูรณ์</i>
      </div>
    </div>
  `;

  mainControls.appendChild(group);

  const bannerName = group.querySelector("#devActivePlanetName");

  function updateActiveUI() {
    if (window.SpacesMap && bannerName) {
      const active = window.SpacesMap.getActivePlanet();
      if (active) {
        bannerName.textContent = active.name;
      }
    }
  }

  function handleSwitch(id) {
    if (window.SpacesMap && typeof window.SpacesMap.switchActivePlanet === "function") {
      window.SpacesMap.switchActivePlanet(id);
      updateActiveUI();
    }
  }

  const p1Btn = group.querySelector("#devSwitchPlanet1");
  const p2Btn = group.querySelector("#devSwitchPlanet2");
  const p3Btn = group.querySelector("#devSwitchPlanet3");
  const p4Btn = group.querySelector("#devSwitchPlanet4");
  const p5Btn = group.querySelector("#devSwitchPlanet5");

  if (p1Btn) p1Btn.addEventListener("click", () => handleSwitch("planet_1"));
  if (p2Btn) p2Btn.addEventListener("click", () => handleSwitch("planet_2"));
  if (p3Btn) p3Btn.addEventListener("click", () => handleSwitch("planet_3"));
  if (p4Btn) p4Btn.addEventListener("click", () => handleSwitch("planet_4"));
  if (p5Btn) p5Btn.addEventListener("click", () => handleSwitch("planet_5"));

  setInterval(() => {
    if (group.offsetParent !== null) {
      updateActiveUI();
    }
  }, 800);
})();



// --- ระบบปรับตำแหน่ง UI ลอยของเรือ (Boat UI Offset System) ---
(function initDevBoatUiOffset() {
  if (typeof window.boatUiBackOffset !== "number") window.boatUiBackOffset = 1.0;
  if (typeof window.boatUiUpOffset !== "number") window.boatUiUpOffset = 1.5;

  const mainControls = document.getElementById("mainControls");
  if (!mainControls || document.getElementById("devBoatUiOffsetGroup")) return;

  const group = document.createElement("div");
  group.className = "control-group";
  group.id = "devBoatUiOffsetGroup";
  group.innerHTML = `
    <label>🚤 ระยะห่าง UI ลอยของเรือ (Boat UI Offset)</label>
    
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between;">
            <label style="font-size: 11px;">เลื่อนไปด้านหลังเรือ (Back):</label>
            <span id="devBoatUiBackLabel" style="font-size: 11px;">${window.boatUiBackOffset.toFixed(2)}</span>
        </div>
        <input type="range" id="devBoatUiBackSlider" min="-200" max="500" value="${Math.round(window.boatUiBackOffset * 100)}" style="width: 100%;">
    </div>

    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between;">
            <label style="font-size: 11px;">เลื่อนขึ้น/ลง (Up):</label>
            <span id="devBoatUiUpLabel" style="font-size: 11px;">${window.boatUiUpOffset.toFixed(2)}</span>
        </div>
        <input type="range" id="devBoatUiUpSlider" min="-200" max="500" value="${Math.round(window.boatUiUpOffset * 100)}" style="width: 100%;">
    </div>
  `;
  mainControls.appendChild(group);

  const backSlider = document.getElementById("devBoatUiBackSlider");
  const backLabel = document.getElementById("devBoatUiBackLabel");
  const upSlider = document.getElementById("devBoatUiUpSlider");
  const upLabel = document.getElementById("devBoatUiUpLabel");

  if (backSlider) {
    backSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      window.boatUiBackOffset = val;
      if (backLabel) backLabel.textContent = val.toFixed(2);
    });
  }
  if (upSlider) {
    upSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      window.boatUiUpOffset = val;
      if (upLabel) upLabel.textContent = val.toFixed(2);
    });
  }
})();
