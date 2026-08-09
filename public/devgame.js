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
      const desiredHeight = playerHeight - (0.02 / HEIGHT_SCALE); 
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
            : (RADIUS + getHeightOnSphere(charTheta, charPhi, globalSeed) * HEIGHT_SCALE);
          
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
  const listEl = document.getElementById("devNpcList");
  if (!listEl) return;

  const updateNpcList = () => {
    if (!isDevMode || typeof amphibians === 'undefined') return;
    
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
        if (!isDevMode) return;
        charTheta = npc.theta;
        charPhi = npc.phi;
        if (typeof playerVelocityX !== 'undefined') playerVelocityX = 0;
        if (typeof playerVelocityY !== 'undefined') playerVelocityY = 0;
        if (typeof playerVelocityZ !== 'undefined') playerVelocityZ = 0;
        showNotice(`🚀 วาร์ปไปหา ${npc.type} #${index} เรียบร้อย!`);
      });
      
      listEl.appendChild(btn);
    });
  };

  // Update when expanding dev menu or periodically
  setInterval(() => {
    if (isDevMode && listEl.offsetParent !== null) {
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

// --- ระบบปรับความยาวเพาล้อและตำแหน่งล้อเรือ แยกคู่หน้า-หลัง (Front/Rear Wheel Pair Controls) ---
(function initDevWheelAxleControls() {
  if (typeof window.wheelFrontAxleLength !== "number") window.wheelFrontAxleLength = 0.36;
  if (typeof window.wheelFrontSideOffset !== "number") window.wheelFrontSideOffset = 0.18;
  if (typeof window.wheelFrontFwdOffset !== "number") window.wheelFrontFwdOffset = 0.18;
  if (typeof window.wheelFrontUpOffset !== "number") window.wheelFrontUpOffset = -0.03;

  if (typeof window.wheelRearAxleLength !== "number") window.wheelRearAxleLength = 0.36;
  if (typeof window.wheelRearSideOffset !== "number") window.wheelRearSideOffset = 0.18;
  if (typeof window.wheelRearFwdOffset !== "number") window.wheelRearFwdOffset = 0.18;
  if (typeof window.wheelRearUpOffset !== "number") window.wheelRearUpOffset = -0.03;

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
