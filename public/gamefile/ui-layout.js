document.body.insertAdjacentHTML("afterbegin", `<div
      id="fadeToBlack"
      style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #000;
        z-index: 100000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 1.5s ease-in-out;
      "
    ></div>

    <!-- Damage Flash Overlay -->
    <div id="damageFlash" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle, rgba(255,0,0,0) 40%, rgba(255,0,0,0.4) 100%); border: 3px solid rgba(255,0,0,0.5); z-index: 15000; pointer-events: none;"></div>

    <!-- Floating NPC HP Overlay -->
    <div id="npcHpOverlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10005;"></div>

    <!-- Unconscious Screen Overlay -->
    <div id="unconsciousOverlay" class="unconscious-overlay">
    </div>

    <!-- หน้าเข้าเกม (Title Screen) -->
    <div class="game-start-overlay" id="gameStartOverlay">
      <div class="starfield"></div>
      <div class="planet-decor"></div>
      <div class="planet-decor-2"></div>
      <div class="logo-container">
        <h1 class="logo-title">seedplanet</h1>
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 0px;">
          <!-- YouTube Icon Link -->
          <a
            href="https://www.youtube.com/@Nat_suki452"
            target="_blank"
            rel="noopener noreferrer"
            style="width: 36px; height: 36px; background-color: rgba(220, 38, 38, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #ef4444; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); flex-shrink: 0;"
            title="YouTube"
            onmouseover="this.style.backgroundColor='rgba(220, 38, 38, 0.2)'"
            onmouseout="this.style.backgroundColor='rgba(220, 38, 38, 0.1)'"
          >
            <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </a>

          <!-- GitHub Icon Link -->
          <a
            href="https://github.com/NSK912/NSKSW/tree/NSK912-patch-1"
            target="_blank"
            rel="noopener noreferrer"
            style="width: 36px; height: 36px; background-color: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #cbd5e1; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); flex-shrink: 0;"
            title="GitHub"
            onmouseover="this.style.backgroundColor='rgba(255, 255, 255, 0.1)'; this.style.color='#ffffff';"
            onmouseout="this.style.backgroundColor='rgba(255, 255, 255, 0.05)'; this.style.color='#cbd5e1';"
          >
            <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          </a>

          <!-- Donate Icon + Text Link -->
          <a
            href="https://www.patreon.com/c/natsuki69/membership"
            target="_blank"
            rel="noopener noreferrer"
            style="height: 36px; padding: 0 12px; display: flex; align-items: center; gap: 6px; background-color: rgba(255, 66, 77, 0.1); border: 1px solid rgba(255, 66, 77, 0.3); color: #FF424D; border-radius: 8px; font-weight: 500; font-size: 12px; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); flex-shrink: 0; text-decoration: none;"
            title="Donate"
            onmouseover="this.style.backgroundColor='rgba(255, 66, 77, 0.2)'"
            onmouseout="this.style.backgroundColor='rgba(255, 66, 77, 0.1)'"
          >
            <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24">
              <path d="M15.386 0c-4.767 0-8.64 3.873-8.64 8.64 0 4.755 3.873 8.633 8.64 8.633 4.755 0 8.633-3.878 8.633-8.633C24.019 3.873 20.141 0 15.386 0zM2.404 24H0V0h2.404v24z" />
            </svg>
            <span>Donate</span>
          </a>

          <!-- Version Info -->
          <div style="color: #64748b; font-size: 12px; font-weight: 500; font-family: monospace; margin-left: 8px;">
            <span style="font-weight: 700; margin-right: 4px;">NSK App</span>
            ver 2.0.0.0
          </div>
        </div>
      </div>
      <div
        id="startMenuButtonsContainer"
        style="
          display: flex;
          flex-direction: column;
          gap: 15px;
          align-items: center;
          z-index: 2;
          transition: opacity 0.5s ease-in-out;
        "
      >
        <button class="start-btn game-ui" id="gameStartBtn">
          เริ่มเล่น (Start Game)
        </button>
        <button
          class="start-btn game-ui"
          id="gameSettingsBtn"
          style="
            font-size: 14px;
            padding: 10px 30px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: rgba(255, 255, 255, 0.7);
            box-shadow: none;
          "
        >
          ตั้งค่า (Settings)
        </button>
        <button
          class="start-btn game-ui"
          id="gameDevBtn"
          style="
            display: none;
            font-size: 14px;
            padding: 10px 30px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: rgba(255, 255, 255, 0.7);
            box-shadow: none;
          "
        >
          โหมดผู้พัฒนา (Dev Mode)
        </button>
      </div>
    </div>

    <!-- หน้าต่างเลือกเซฟ (Save Slots Selection) -->
    <div
      class="inventory-overlay"
      id="saveSelectOverlay"
      style="z-index: 10005"
    >
      <div
        class="inventory-panel game-ui lg"
        style="
          max-width: 520px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          border: 1px solid rgba(223, 183, 108, 0.4);
          box-shadow: 0 0 35px rgba(223, 183, 108, 0.25);
        "
      >
        <div
          class="save-select-header"
          style="
            display: flex;
            justify-content: center;
            align-items: center;
            position: relative;
            margin: 0 0 8px 0;
            padding: 0 0 14px 0;
            border-bottom: 1px solid rgba(223, 183, 108, 0.25);
          "
        >
          <h2
            style="
              color: #dfb76c;
              font-size: 18px;
              font-weight: bold;
              margin: 0;
              text-shadow: 0 0 10px rgba(223, 183, 108, 0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              font-family: 'JetBrains Mono', monospace;
              letter-spacing: 0.5px;
            "
          >
            📂 เลือกข้อมูลเซฟ (Select Save Slot)
          </h2>
        </div>

        <!-- รายการเซฟไฟล์ -->
        <div
          id="saveSlotsList"
          style="
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-height: 50vh;
            overflow-y: auto;
            padding-right: 4px;
          "
        >
          <!-- ช่องเซฟจะถูกสร้างด้วย JS ที่นี่ -->
        </div>

        <div
          style="
            display: flex;
            gap: 12px;
            margin-top: 8px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding-top: 12px;
            position: relative;
          "
        >
          <button
            id="btnSaveSelectBack"
            
           class="game-ui" style="flex: 1;
              background: rgba(239, 68, 68, 0.1);
              border: 1px solid rgba(239, 68, 68, 0.4);
              color: #fca5a5;
              padding: 10px;
              font-size: 11px;
              font-family: 'JetBrains Mono', monospace;
              cursor: pointer;
              transition: all 0.2s;
              
              font-weight: bold;">
            ย้อนกลับ (Back)
          </button>
          <div
            id="saveLoadingIndicator"
            
           class="game-ui" style="display: none;
              flex: 1;
              align-items: center;
              justify-content: center;
              gap: 12px;
              background: rgba(223, 183, 108, 0.05);
              border: 1px solid rgba(223, 183, 108, 0.2);
              color: #dfb76c;
              padding: 10px;
              font-size: 11px;
              font-family: 'JetBrains Mono', monospace;
              font-weight: bold;">
            <div class="loading-squares">
              <div class="loading-square"></div>
              <div class="loading-square"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <canvas id="mapCanvas"></canvas>

    <!-- Long Horizontal AAA Compass HUD -->
    <div id="compassContainer" class="game-ui visible" style="position: fixed; top: 10px; left: 50%; transform: translateX(-50%); width: 560px; max-width: 90vw; height: 56px; z-index: 10000; pointer-events: none; display: flex; align-items: center; justify-content: center; user-select: none; background: transparent; backdrop-filter: none; -webkit-backdrop-filter: none; border: none; box-shadow: none; clip-path: none;">
      <canvas id="compassCanvas" width="1120" height="112" style="width: 560px; height: 56px; display: block; background: transparent;"></canvas>
    </div>

    <!-- เมนูซ้ายบน -->
    <div class="top-left-menu game-ui">
      <!-- ปุ่มเปิดกระเป๋า -->
      <button
        class="inventory-btn game-ui"
        id="inventoryToggle"
        title="เปิดกระเป๋า (Inventory)"
      >
        <span id="inventoryToggleNormalContent" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="display: block"
          >
            <path
              d="M4 20V10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"
            />
            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            <rect x="9" y="10" width="6" height="5" rx="1" />
          </svg>
          <span class="inventory-badge game-ui" id="inventoryBadge">0</span>
        </span>
        <span id="inventoryToggleDemolishContent" style="display: none; align-items: center; justify-content: center; width: 100%; height: 100%;">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="display: block"
          >
            <path d="m15 12-8.5 8.5a2.1 2.1 0 1 1-3-3L12 9" />
            <path d="M17.64 15 22 10.64a2.41 2.41 0 0 0 0-3.41L16.77 2.3a2.41 2.41 0 0 0-3.41 0L9 6.64" />
            <path d="m20 8-5 5" />
          </svg>
        </span>
      </button>

      <!-- FPS Counter -->
      <div class="fps-counter game-ui" id="fpsCounter">
        FPS: <span class="fps-value" id="fpsDisplay">0</span>
        <span class="fps-lock"> | ⚡120</span>
      </div>

      <!-- ปุ่มเต็มจอ -->
      <button id="fullscreenBtn" class="fullscreen-btn" style="display: none;">📺 เต็มจอ</button>
    </div>

    <!-- ปุ่มเต็มจอส่วนเกมเพย์ มุมขวาบน (Gameplay Fullscreen Button Top-Right) -->
    <button
      id="gameplayFullscreenBtn"
      class="game-ui"
      title="เต็มจอ / ย่อจอ (Toggle Fullscreen)"
      style="
        position: fixed;
        top: calc(10px + var(--ui-margin, 0px));
        right: calc(10px + var(--ui-margin, 0px));
        width: 36px;
        height: 36px;
        z-index: 10001;
        background: rgba(10, 10, 15, 0.85);
        color: #dfb76c;
        border: 1px solid rgba(223, 183, 108, 0.4);
        border-radius: 0;
        --cut: 6px;
        clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, var(--cut) 100%, 0 calc(100% - var(--cut)));
        padding: 0;
        cursor: pointer;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        transition: background 0.2s, border-color 0.2s, transform 0.15s;
      "
      onmouseover="this.style.background='rgba(223, 183, 108, 0.25)'; this.style.borderColor='rgba(223, 183, 108, 0.8)';"
      onmouseout="this.style.background='rgba(10, 10, 15, 0.85)'; this.style.borderColor='rgba(223, 183, 108, 0.4)';"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"></path>
      </svg>
    </button>

    <!-- Virtual Joystick - ปุ่มเดียวลากได้ -->
    <div class="joystick-container game-ui" id="joystickContainer">
      <div class="joystick-base" id="joystickBase">
        <span class="joystick-dir up">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </span>
        <span class="joystick-dir down">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
        <span class="joystick-dir left">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </span>
        <span class="joystick-dir right">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </span>
        <div class="joystick-thumb" id="joystickThumb"></div>
      </div>
    </div>


    <!-- Modal ยืนยันทำลายไอเทม -->
    <div class="confirm-overlay" id="trashConfirmOverlay" onwheel="event.preventDefault(); event.stopPropagation();" ontouchmove="event.preventDefault(); event.stopPropagation();" style="display: none; position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(0, 0, 0, 0.85) !important; z-index: 2147483647 !important; align-items: center !important; justify-content: center !important; backdrop-filter: blur(4px) !important; pointer-events: auto !important;">
      <div  class="game-ui" style="background: #0a0a0f; border: 1px solid rgba(255, 60, 60, 0.3); padding: 24px; text-align: center; min-width: 280px; max-width: 320px; display: flex; flex-direction: column; gap: 16px;  box-shadow: inset 0 0 20px rgba(255,60,60,0.05); position: relative;">
        <!-- decorative corner accents -->
        <div style="position: absolute; top: -1px; left: -1px; width: 8px; height: 8px; border-top: 2px solid #ff5555; border-left: 2px solid #ff5555;"></div>
        <div style="position: absolute; bottom: -1px; right: -1px; width: 8px; height: 8px; border-bottom: 2px solid #ff5555; border-right: 2px solid #ff5555;"></div>
        
        <h3 style="color: #ff5555; margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 14px; letter-spacing: 1px; display: flex; flex-direction: column; gap: 4px;">
          <span>ทำลายไอเทม?</span>
          <span style="font-size: 11px; opacity: 0.7;">DESTROY ITEM?</span>
        </h3>
        
        <div  class="game-ui" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 8px;">
           <span id="trashConfirmIcon" style="font-size: 28px; line-height: 1; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.3));">📦</span>
           <span id="trashConfirmText" style="color: rgba(255, 255, 255, 0.35); font-size: 11px; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.5px; text-transform: uppercase;">Item Name x1</span>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 10px;">
          <button id="trashCancelBtn"  onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'" class="game-ui" style="flex: 1; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 10px 0; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 12px; display: flex; flex-direction: column; gap: 2px; align-items: center; justify-content: center; transition: all 0.2s;">
            <span>ยกเลิก</span>
            <span style="font-size: 9px; opacity: 0.6;">CANCEL</span>
          </button>
          
          <button id="trashConfirmBtn"  onmouseover="this.style.background='rgba(255,60,60,0.15)'" onmouseout="this.style.background='rgba(255,60,60,0.1)'" class="game-ui" style="flex: 1; background: rgba(255, 60, 60, 0.1); color: #ff5555; border: 1px solid rgba(255,60,60,0.4); padding: 10px 0; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 12px; position: relative; overflow: hidden; user-select: none; display: flex; flex-direction: column; gap: 2px; align-items: center; justify-content: center; transition: all 0.2s;">
            <div id="trashConfirmProgress" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: rgba(255, 60, 60, 0.3); pointer-events: none;"></div>
            <span style="position: relative; z-index: 1;">กดค้าง (ลบ)</span>
            <span style="position: relative; z-index: 1; font-size: 9px; opacity: 0.8;">HOLD TO DELETE</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal ยืนยันรีโหลดเกมเมื่อเปิด/ปิด Anti-Aliasing -->
    <div class="confirm-overlay" id="antialiasConfirmOverlay" onwheel="event.preventDefault(); event.stopPropagation();" ontouchmove="event.preventDefault(); event.stopPropagation();" style="display: none; position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(0, 0, 0, 0.85) !important; z-index: 2147483647 !important; align-items: center !important; justify-content: center !important; backdrop-filter: blur(4px) !important; pointer-events: auto !important;">
      <div class="game-ui" style="background: #0a0a0f; border: 1px solid rgba(223, 183, 108, 0.3); padding: 24px; text-align: center; min-width: 300px; max-width: 340px; display: flex; flex-direction: column; gap: 16px; box-shadow: inset 0 0 20px rgba(223, 183, 108, 0.05); position: relative;">
        <!-- decorative corner accents -->
        <div style="position: absolute; top: -1px; left: -1px; width: 8px; height: 8px; border-top: 2px solid #dfb76c; border-left: 2px solid #dfb76c;"></div>
        <div style="position: absolute; bottom: -1px; right: -1px; width: 8px; height: 8px; border-bottom: 2px solid #dfb76c; border-right: 2px solid #dfb76c;"></div>
        
        <h3 style="color: #dfb76c; margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 14px; letter-spacing: 1px; display: flex; flex-direction: column; gap: 4px; text-align: center;">
          <span>ลดรอยหยัก เปิด-ปิด</span>
          <span style="font-size: 11px; opacity: 0.7;">ANTI-ALIASING ON/OFF</span>
        </h3>
        
        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 10px;">
          <button id="antialiasCancelBtn" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'" class="game-ui" style="flex: 1; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 10px 0; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 12px; display: flex; flex-direction: column; gap: 2px; align-items: center; justify-content: center; transition: all 0.2s;">
            <span>ยกเลิก</span>
            <span style="font-size: 9px; opacity: 0.6;">CANCEL</span>
          </button>
          
          <button id="antialiasConfirmBtn" onmouseover="this.style.background='rgba(223, 183, 108, 0.25)'" onmouseout="this.style.background='rgba(223, 183, 108, 0.15)'" class="game-ui" style="flex: 1; background: rgba(223, 183, 108, 0.15); color: #dfb76c; border: 1px solid rgba(223, 183, 108, 0.5); padding: 10px 0; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 12px; position: relative; overflow: hidden; user-select: none; display: flex; flex-direction: column; gap: 2px; align-items: center; justify-content: center; transition: all 0.2s; text-shadow: 0 0 6px rgba(223, 183, 108, 0.4);">
            <span style="position: relative; z-index: 1;">ตกลง (รีโหลด)</span>
            <span style="position: relative; z-index: 1; font-size: 9px; opacity: 0.8;">RELOAD</span>
          </button>
        </div>
      </div>
    </div>
    <!-- หน้าต่างกระเป๋า -->
    <div class="inventory-overlay" id="inventoryOverlay">
      <div class="inventory-panel game-ui">
        <div class="inventory-header">
          <div class="inventory-tabs">
            <h2 id="tabCrafting">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="display: block"
              >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              CRAFTING
            </h2>
            <h2 id="tabInventory" class="active">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="display: block"
              >
                <path
                  d="M4 20V10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"
                />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                <rect x="9" y="10" width="6" height="5" rx="1" />
              </svg>
              INVENTORY
            </h2>
            <h2 id="tabItemsList">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="display: block"
              >
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
              ITEMS LIST
            </h2>
            <h2 id="tabSettings">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="display: block"
              >
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                />
              </svg>
              SETTINGS
            </h2>
            <h2 id="tabCooking" style="display: none;">
              COOKING
            </h2>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; height: 32px;">
            <button
              class="close-btn game-ui"
              id="quitGameBtn"
              style="
                display: none !important;
                color: #ff5555;
                border-color: rgba(255, 60, 60, 0.4);
                position: relative;
                overflow: hidden;
              "
              title="กดค้างเพื่อออกเกม (Hold to Quit)"
            >
              <div
                id="quitGameProgress"
                style="
                  position: absolute;
                  bottom: 0;
                  left: 0;
                  height: 100%;
                  width: 0%;
                  background: rgba(255, 60, 60, 0.3);
                  pointer-events: none;
                "
              ></div>
              <svg
                style="position: relative; z-index: 1"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
            <button class="close-btn game-ui" id="inventoryClose">✕</button>
          </div>
        </div>



        <div id="inventoryMainLayout" style="display: flex; gap: 24px; align-items: stretch; justify-content: center; width: 100%; max-width: 520px; margin: 16px auto; box-sizing: border-box;">
          <div class="inventory-grid" id="inventoryGrid" style="flex: 1; margin: 0; min-width: 0;">
            <!-- สร้างช่องกระเป๋าผ่าน JavaScript -->
          </div>

          <!-- Vertical Divider line for Inventory Tab -->
          <div id="inventoryVerticalDivider" style="width: 1px; background: rgba(255, 255, 255, 0.1); margin: 0 4px; display: block;"></div>

          <!-- ช่องแอคชั่นข้างหน้าต่างกระเป๋า (Inventory Action Slots) -->
          <div id="inventoryActionSlotsWrapper" style="display: flex; flex-direction: column; gap: 8px; align-items: center; width: 64px; flex-shrink: 0; margin-top: 4px; border: none; padding: 0;">
            <div style="color: #dfb76c; font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; writing-mode: vertical-rl; text-orientation: mixed; margin-bottom: 8px; opacity: 0.7; display: flex; align-items: center; gap: 4px;">
              ⚡ ACTIONS
            </div>
            <div class="inventory-action-slots keyboard-mode" id="inventoryActionSlots">
              <div class="action-slot game-ui"></div>
              <div class="action-slot game-ui"></div>
              <div class="action-slot game-ui"></div>
              <div class="action-slot game-ui"></div>
              <div class="action-slot game-ui"></div>
              <div class="action-slot game-ui"></div>
              <div class="action-slot game-ui"></div>
              <div class="action-slot game-ui"></div>
            </div>
          </div>
        </div>
        <div
          id="craftingList"
          style="
            display: none;
            flex-direction: column;
            gap: 12px;
            margin-top: 15px;
            color: #fff;
          "
        >
          <!-- สร้างรายการคราฟผ่าน JavaScript -->
        </div>

        <div
          id="cookingList"
          style="
            display: none;
            flex-direction: column;
            gap: 12px;
            margin-top: 15px;
            color: #fff;
          "
        >
          <!-- สร้างรายการทำอาหารผ่าน JavaScript -->
        </div>
        <div
          id="inventorySettings"
          style="
            display: none;
            padding: 12px 4px;
            color: #fff;
            flex-direction: column;
            gap: 18px;
          "
        >
          <!-- เสียงเอฟเฟกต์รวม (SFX Volume) -->
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div
              style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 13px;
                font-family: 'JetBrains Mono', monospace;
              "
            >
              <span style="display: inline-flex; align-items: center; gap: 8px">
                ระดับเสียงรวม (Master SFX Volume)
                <button
                  id="sfxMuteToggle"
                  style="
                    background: none;
                    border: none;
                    padding: 4px;
                    color: #dfb76c;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    transition: all 0.2s;
                    outline: none;
                    border-radius: 4px;
                  "
                  title="Mute/Unmute"
                  onmouseover="this.style.background = 'rgba(223,183,108,0.1)'"
                  onmouseout="this.style.background = 'none'"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    style="display: block"
                  >
                    <polygon
                      points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                    ></polygon>
                    <path
                      d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"
                    ></path>
                  </svg>
                </button>
              </span>
              <span id="sfxVolumeVal" style="color: #dfb76c; font-weight: bold"
                >50%</span
              >
            </div>
            <input
              type="range"
              id="sfxVolumeSlider"
              min="1"
              max="100"
              value="50"
              style="width: 100%; cursor: pointer; accent-color: #dfb76c"
            />
          </div>

          <!-- สเกล เรนเดอร์ จอเกม (Render Scale) -->
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div
              style="
                display: flex;
                justify-content: space-between;
                font-size: 13px;
                font-family: 'JetBrains Mono', monospace;
              "
            >
              <span>สเกล เรนเดอร์ จอเกม (Render Scale)</span>
              <span
                id="renderScaleVal"
                style="color: #dfb76c; font-weight: bold"
                >100%</span
              >
            </div>
            <input
              type="range"
              id="renderScaleSlider"
              min="10"
              max="100"
              step="10"
              value="100"
              style="width: 100%; cursor: pointer; accent-color: #dfb76c"
            />
          </div>

          <!-- FPS Limit -->
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div
              style="
                display: flex;
                justify-content: space-between;
                font-size: 13px;
                font-family: 'CustomGoogleSans', 'Kanit', sans-serif;
              "
            >
              <span>ขีดจำกัดเฟรมเรต (FPS Limit)</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; height: 32px;">
              <button
                id="fps30Btn"
                class="game-ui"
                style="flex: 1; padding: 6px 0; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); color: rgba(255, 255, 255, 0.6); font-size: 11px; cursor: pointer; font-family: 'CustomGoogleSans', 'Kanit', sans-serif; transition: all 0.2s;"
              >
                30 FPS
              </button>
              <button
                id="fps60Btn"
                class="game-ui"
                style="flex: 1; padding: 6px 0; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); color: rgba(255, 255, 255, 0.6); font-size: 11px; cursor: pointer; font-family: 'CustomGoogleSans', 'Kanit', sans-serif; transition: all 0.2s;"
              >
                60 FPS
              </button>
              <button
                id="fps120Btn"
                class="game-ui"
                style="flex: 1; padding: 6px 0; background: rgba(223, 183, 108, 0.15); border: 1px solid #dfb76c; color: #dfb76c; font-size: 11px; cursor: pointer; font-family: 'CustomGoogleSans', 'Kanit', sans-serif; transition: all 0.2s; text-shadow: 0 0 6px rgba(223, 183, 108, 0.4);"
              >
                120 FPS
              </button>
            </div>
          </div>
          <!-- ความเร็วเมาส์ (Mouse Sensitivity) -->
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div
              style="
                display: flex;
                justify-content: space-between;
                font-size: 13px;
                font-family: 'JetBrains Mono', monospace;
              "
            >
              <span>ความเร็วเมาส์ (Mouse Sensitivity)</span>
              <span
                id="mouseSensitivityVal"
                style="color: #dfb76c; font-weight: bold"
                >1.00x</span
              >
            </div>
            <input
              type="range"
              id="mouseSensitivitySlider"
              min="10"
              max="300"
              step="5"
              value="100"
              style="width: 100%; cursor: pointer; accent-color: #dfb76c"
            />
          </div>

          <!-- การตั้งค่าโหมดแสดงผล (Screen Mode) -->
          <div id="screenModeSettingContainer" style="display: none !important; flex-direction: column; gap: 6px">
            <span style="font-size: 13px; font-family: 'JetBrains Mono', monospace"
              >โหมดแสดงผล (Screen Mode)</span
            >
            <div style="display: flex; gap: 8px; align-items: center; height: 32px;">
              <button
                id="setModeWindowed"
                
               class="game-ui" style="flex: 1;
                  background: rgba(223, 183, 108, 0.15);
                  border: 1px solid #dfb76c;
                  color: #dfb76c;
                  padding: 6px 0;
                  font-size: 11px;
                  font-family: 'JetBrains Mono', monospace;
                  cursor: pointer;
                  transition: all 0.2s;
                  
                  text-shadow: 0 0 6px rgba(223, 183, 108, 0.4);">
                โหมดหน้าต่าง (Window)
              </button>
              <button
                id="setModeFullscreen"
                
               class="game-ui" style="flex: 1;
                  background: rgba(255, 255, 255, 0.05);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  color: rgba(255, 255, 255, 0.6);
                  padding: 6px 0;
                  font-size: 11px;
                  font-family: 'JetBrains Mono', monospace;
                  cursor: pointer;
                  transition: all 0.2s;">
                เต็มจอ (Fullscreen)
              </button>
            </div>
          </div>

          <!-- การตั้งค่าแสดงผล FPS (FPS UI Toggle) -->
          <div style="display: flex; flex-direction: column; gap: 6px">
            <span style="font-size: 13px; font-family: 'JetBrains Mono', monospace"
              >แสดงผลข้อมูล FPS (FPS Counter)</span
            >
            <div style="display: flex; gap: 8px; align-items: center; height: 32px;">
              <button
                id="fpsToggleOn"
                
               class="game-ui" style="flex: 1;
                  background: rgba(223, 183, 108, 0.15);
                  border: 1px solid #dfb76c;
                  color: #dfb76c;
                  padding: 6px 0;
                  font-size: 11px;
                  font-family: 'JetBrains Mono', monospace;
                  cursor: pointer;
                  transition: all 0.2s;
                  
                  text-shadow: 0 0 6px rgba(223, 183, 108, 0.4);">
                เปิด (On)
              </button>
              <button
                id="fpsToggleOff"
                
               class="game-ui" style="flex: 1;
                  background: rgba(255, 255, 255, 0.05);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  color: rgba(255, 255, 255, 0.6);
                  padding: 6px 0;
                  font-size: 11px;
                  font-family: 'JetBrains Mono', monospace;
                  cursor: pointer;
                  transition: all 0.2s;">
                ปิด (Off)
              </button>
            </div>
          </div>

          <!-- การตั้งค่า Shadow Map (Shadow Map Quality) -->
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div style="display: flex; justify-content: space-between">
              <span style="font-size: 13px; font-family: 'JetBrains Mono', monospace"
                >แสดงผลเงาในเกม (Shadow Map)</span
              >
              <span id="shadowMapQualityVal" style="font-size: 13px; font-family: 'JetBrains Mono', monospace; color: #dfb76c;">Medium</span>
            </div>
            <input
              type="range"
              id="shadowMapQualitySlider"
              style="width: 100%; cursor: pointer; accent-color: #dfb76c"
              min="1"
              max="4"
              value="2"
              step="1"
            />
          </div>

          <!-- การตั้งค่า Anti-Aliasing (Hidden) -->
          <div style="display: none !important;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-family: 'JetBrains Mono', monospace"
                >Anti-Aliasing</span>
              <span style="font-size: 10px; color: rgba(255, 255, 255, 0.4); font-family: 'Kanit', sans-serif;">(ต้องการรีโหลด)</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; height: 32px;">
              <button
                id="antialiasToggleOn"
                class="game-ui" style="flex: 1;
                  background: rgba(223, 183, 108, 0.15);
                  border: 1px solid #dfb76c;
                  color: #dfb76c;
                  padding: 6px 0;
                  font-size: 11px;
                  font-family: 'JetBrains Mono', monospace;
                  cursor: pointer;
                  transition: all 0.2s;
                  text-shadow: 0 0 6px rgba(223, 183, 108, 0.4);">
                เปิด (On)
              </button>
              <button
                id="antialiasToggleOff"
                class="game-ui" style="flex: 1;
                  background: rgba(255, 255, 255, 0.05);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  color: rgba(255, 255, 255, 0.6);
                  padding: 6px 0;
                  font-size: 11px;
                  font-family: 'JetBrains Mono', monospace;
                  cursor: pointer;
                  transition: all 0.2s;">
                ปิด (Off)
              </button>
            </div>
          </div>

          <!-- การตั้งค่า TAAU (Temporal Anti-Aliasing Upsampling) -->
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-family: 'JetBrains Mono', monospace"
                >TAAU (Temporal Upsampling)</span>
              <span style="font-size: 10px; color: rgba(223, 183, 108, 0.8); font-family: 'Kanit', sans-serif;">(เพิ่มความคมชัดสด)</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; height: 32px;">
              <button
                id="taauToggleOn"
                class="game-ui" style="flex: 1;
                  background: rgba(223, 183, 108, 0.15);
                  border: 1px solid #dfb76c;
                  color: #dfb76c;
                  padding: 6px 0;
                  font-size: 11px;
                  font-family: 'JetBrains Mono', monospace;
                  cursor: pointer;
                  transition: all 0.2s;
                  text-shadow: 0 0 6px rgba(223, 183, 108, 0.4);">
                เปิด (On)
              </button>
              <button
                id="taauToggleOff"
                class="game-ui" style="flex: 1;
                  background: rgba(255, 255, 255, 0.05);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  color: rgba(255, 255, 255, 0.6);
                  padding: 6px 0;
                  font-size: 11px;
                  font-family: 'JetBrains Mono', monospace;
                  cursor: pointer;
                  transition: all 0.2s;">
                ปิด (Off)
              </button>
            </div>
          </div>

          <!-- ตั้งค่าปุ่มควบคุม (Key Bindings) -->
          <div
            style="
              display: flex;
              flex-direction: column;
              gap: 8px;
              border-top: 1px solid rgba(255, 255, 255, 0.1);
              padding-top: 12px;
            "
          >
            <span
              style="
                font-size: 13px;
                font-family: 'JetBrains Mono', monospace;
                color: #dfb76c;
                font-weight: bold;
              "
              >ตั้งค่าปุ่มควบคุม (Key Bindings)</span
            >
            <div
              style="display: grid; grid-template-columns: 1fr; gap: 6px"
              id="keyBindingsContainer"
            >
              <!-- ถูกสร้างด้วย JS -->
            </div>
          </div>

          <!-- คืนค่า การตั้งค่า (Restore Defaults) -->
          <div
            style="
              display: flex;
              flex-direction: column;
              gap: 6px;
              border-top: 1px solid rgba(255, 255, 255, 0.1);
              padding-top: 12px;
              margin-top: 4px;
            "
          >
            <button
              id="btnRestoreDefaults"
              
              onmouseover="this.style.background = 'rgba(239, 68, 68, 0.25)'"
              onmouseout="this.style.background = 'rgba(239, 68, 68, 0.1)'"
             class="game-ui" style="width: 100%;
                background: rgba(239, 68, 68, 0.1);
                border: 1px solid rgba(239, 68, 68, 0.4);
                color: #fca5a5;
                padding: 10px 0;
                font-size: 11px;
                font-family: 'JetBrains Mono', monospace;
                cursor: pointer;
                transition: all 0.2s;
                
                font-weight: bold;">
              คืนค่า การตั้งค่า (Restore Defaults)
            </button>
            <button
              id="btnExitToMenu"
              
              onmouseover="this.style.background = 'rgba(223, 183, 108, 0.25)'"
              onmouseout="this.style.background = 'rgba(223, 183, 108, 0.1)'"
             class="game-ui" style="width: 100%;
                background: rgba(223, 183, 108, 0.1);
                border: 1px solid rgba(223, 183, 108, 0.4);
                color: #dfb76c;
                padding: 10px 0;
                font-size: 11px;
                font-family: 'JetBrains Mono', monospace;
                cursor: pointer;
                transition: all 0.2s;
                
                font-weight: bold;">
              กลับไปหน้าเริ่มเกม (Main Menu)
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- หน้าต่างกล่องไม้ (Wooden Chest Overlay) -->
    <div class="inventory-overlay" id="chestOverlay">
      <div class="inventory-panel game-ui" style="width: 95%; max-width: 1232px; max-height: 90vh; display: flex; flex-direction: row; gap: 24px; padding: 24px;">
        <!-- Left Column: Chest Storage -->
        <div style="flex: 1; display: flex; flex-direction: column;">
          <!-- Chest Header -->
          <div class="inventory-header" style="margin-bottom: 12px;">
            <div class="inventory-tabs">
              <h2 class="active" style="font-size: 13px; display: inline-flex; align-items: center; gap: 8px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                  <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
                กล่องเก็บของ (CHEST STORAGE)
              </h2>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; height: 100%;">
              <button id="chestTakeAllBtn"  onmouseover="this.style.background='rgba(223, 183, 108, 0.1)'; this.style.borderColor='#dfb76c';" onmouseout="this.style.background='rgba(0, 0, 0, 0.85)'; this.style.borderColor='rgba(223, 183, 108, 0.3)';" class="game-ui" style="height: 32px; padding: 0 12px; font-size: 11px; background: rgba(0, 0, 0, 0.85); border: 1px solid rgba(223, 183, 108, 0.3); color: #dfb76c; cursor: pointer; transition: all 0.2s;  display: flex; align-items: center;">
                เก็บทั้งหมด (Take All)
              </button>
            </div>
          </div>

          <!-- Chest Grid -->
          <div class="inventory-grid" id="chestGrid">
            <!-- สร้างช่องเก็บของในกล่อง 20 ช่องผ่าน JavaScript -->
          </div>
        </div>

        <!-- Right Column: Player Inventory -->
        <div style="flex: 1; display: flex; flex-direction: column; border-left: 1px solid rgba(255, 255, 255, 0.06); padding-left: 24px; position: relative;">
          <!-- Player Inventory Header in Chest UI -->
          <div class="inventory-header" style="margin-bottom: 12px;">
            <div class="inventory-tabs">
              <h2 class="active" style="font-size: 13px; display: inline-flex; align-items: center; gap: 8px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                  <path d="M4 20V10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                  <rect x="9" y="10" width="6" height="5" rx="1"/>
                </svg>
                กระเป๋าเดินทาง (YOUR INVENTORY)
              </h2>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; height: 100%;">
              <button class="close-btn game-ui" id="chestClose" style="height: 32px; width: 32px; display: flex; align-items: center; justify-content: center; padding: 0;">✕</button>
            </div>
          </div>

          <!-- Player Inventory Grid in Chest UI -->
          <div class="inventory-grid" id="chestPlayerInventoryGrid">
            <!-- สร้างช่องเก็บของกระเป๋าเดินทางในหน้านี้ผ่าน JavaScript -->
          </div>
        </div>
      </div>
    </div>

    <div
      id="interactPrompt"
      
     class="game-ui" style="position: fixed;
        background: rgba(10, 10, 15, 0.85);
        color: #dfb76c;
        padding: 6px 14px;
        font-family: 'JetBrains Mono', monospace;
        font-weight: bold;
        font-size: 11px;
        letter-spacing: 1px;
        text-transform: uppercase;
        border: 1px solid rgba(223, 183, 108, 0.35);
        backdrop-filter: blur(8px);
        display: none;
        pointer-events: none;
        z-index: 100;
        transform: translate(-50%, -100%);
        
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);">
      [E]
    </div>

    <button
      id="npcKillPrompt"
      style="
        position: fixed;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 6px 12px;
        border-radius: 8px;
        font-weight: bold;
        border: 1px solid rgba(255, 255, 255, 0.2);
        display: none;
        cursor: pointer;
        z-index: 101;
        transform: translate(-50%, -100%);
        font-family: 'CustomGoogleSans', 'Kanit', sans-serif;
        pointer-events: auto;
        transition:
          background 0.2s,
          transform 0.1s;
      "
      onmouseover="
        this.style.background = 'rgba(220, 50, 50, 0.9)';
        this.style.borderColor = 'rgba(255,100,100,0.5)';
        this.style.color = 'white';
      "
      onmouseout="
        this.style.background = 'rgba(0,0,0,0.8)';
        this.style.borderColor = 'rgba(255,255,255,0.2)';
        this.style.color = 'white';
      "
    >
      <span style="display: inline-flex; align-items: center; gap: 6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
          <path d="M9 10h.01M15 10h.01" />
          <path d="M12 2a8 8 0 0 0-8 8v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3a8 8 0 0 0-8-8z" />
          <path d="M10 17v3M14 17v3" />
        </svg>
        <span>กำจัด NPC (Kill NPC)</span>
      </span>
    </button>

    <button id="toggleControlsBtn"
      style="
        position: fixed;
        top: 0;
        right: 0;
        z-index: 20;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 6px 12px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5); display: none;
      "
    >
      ⚙️ ซ่อนเมนู
    </button>

    <div id="bowCrosshair" style="display: none; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; border: 1.5px solid white; pointer-events: none; z-index: 1000; box-shadow: 0 0 2px rgba(0,0,0,0.5);"></div>
    <div id="targetCircle" style="display: none; position: absolute; width: 22px; height: 22px; border: 1.5px solid white; border-radius: 50%; pointer-events: none; z-index: 999; transform: translate(-50%, -50%); box-shadow: 0 0 4px rgba(0,0,0,0.6);"></div>

    <div class="controls" id="mainControls" style="top: 45px; display: none;">
      <div class="control-group">
        <button class="btn-toggle" id="distanceToggle">ระยะทาง: ปิด</button>
      </div>
      <div class="control-group">
        <div id="distanceInfo" style="display: none; color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 12px; margin-top: 5px;"></div>
      </div>
      <div class="control-group">
        <label>📐 ขนาดดาว (Grid)</label>
        <input
          type="range"
          id="sizeInput"
          min="25"
          max="3200"
          step="25"
          value="400"
        />
        <div class="value-display" id="sizeDisplay">400 x 400</div>
        <div class="warning">⚠️ ขนาดใหญ่ (500+) อาจช้า</div>
      </div>

      <div class="control-group">
        <label>🌍 รัศมีดาว (Planet Radius)</label>
        <input
          type="range"
          id="radiusInput"
          min="0.5"
          max="64.0"
          step="0.5"
          value="8.0"
        />
        <div class="value-display" id="radiusDisplay">8.00</div>
      </div>

      <div class="control-group">
        <div class="control-row">
          <button class="btn-toggle active" id="waterToggle">
            🌊 น้ำ เปิด
          </button>
        </div>
        <label>📏 ระดับน้ำ <span id="waterLevelLabel">0.00</span></label>
        <input type="range" id="waterLevel" min="-50" max="50" value="0" />
        <label>💧 ความใส <span id="waterOpacityLabel">0.40</span></label>
        <input type="range" id="waterOpacity" min="5" max="80" value="40" />
        <label>🌊 ความแรงคลื่น <span id="waveStrengthLabel">0.020</span></label>
        <input type="range" id="waveStrength" min="1" max="100" value="2" />
        <label>🎨 สีน้ำ</label>
        <input
          type="color"
          id="waterColor"
          value="#0066aa"
          style="
            width: 100%;
            padding: 2px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: transparent;
            cursor: pointer;
          "
        />
      </div>

      <div class="control-group">
        <div class="control-row">
          <button class="btn-toggle active" id="atmosphereToggle">
            ✨ บรรยากาศ เปิด
          </button>
        </div>
        <label>📏 ความเข้ม <span id="atmosphereAlphaLabel">0.60</span></label>
        <input type="range" id="atmosphereAlpha" min="1" max="100" value="60" />
        <label
          >🚀 ระยะห่างบรรยากาศ
          <span id="atmosphereScaleLabel">2.50</span></label
        >
        <input
          type="range"
          id="atmosphereScale"
          min="101"
          max="250"
          value="250"
        />
        <label>🎨 สีชั้นบรรยากาศ</label>
        <input
          type="color"
          id="atmosphereColor"
          value="#4d94ff"
          style="
            width: 100%;
            padding: 2px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: transparent;
            cursor: pointer;
          "
        />
      </div>

      <div class="control-group">
        <div class="control-row">
          <button class="btn-toggle active" id="godRaysToggle">
            ☀️ ลำแสงเทวทูต (God Rays) เปิด
          </button>
        </div>
        <label>📏 ความเข้มลำแสง <span id="godRaysAlphaLabel">0.25</span></label>
        <input type="range" id="godRaysAlpha" min="1" max="100" value="25" />
        <label>📏 จำนวนชั้นลำแสง <span id="godRaysCountLabel">20</span></label>
        <input type="range" id="godRaysCount" min="8" max="128" value="20" step="4" />
        <label>🎨 สีลำแสงเทวทูต</label>
        <input
          type="color"
          id="godRaysColor"
          value="#ffe6b3"
          style="
            width: 100%;
            padding: 2px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: transparent;
            cursor: pointer;
          "
        />
      </div>

      <div class="control-group">
        <div class="control-row">
          <button class="btn-toggle active" id="skyToggle">
            🌌 ท้องฟ้าอวกาศ เปิด
          </button>
        </div>
        <label
          >✨ ความหนาแน่นก๊าซเนบิวลา
          <span id="skyGasIntensityLabel">0.75</span></label
        >
        <input type="range" id="skyGasIntensity" min="1" max="150" value="75" />
      </div>

      <div class="control-group">
        <div class="control-row">
          <button class="btn-toggle active" id="cloudsToggle">
            ☁️ เมฆกลุ่มก๊าซ เปิด
          </button>
        </div>
        <label>📏 ความเข้มเมฆ <span id="cloudsAlphaLabel">0.55</span></label>
        <input type="range" id="cloudsAlpha" min="1" max="100" value="55" />
        <label
          >🚀 ระยะห่างเมฆจากผิวดาว
          <span id="cloudsHeightLabel">12.00</span></label
        >
        <input type="range" id="cloudsHeight" min="50" max="3000" value="1200" />
        <label
          >☁️ ความหนาของชั้นเมฆ
          <span id="cloudsThicknessLabel">0.93</span></label
        >
        <input
          type="range"
          id="cloudsThickness"
          min="10"
          max="250"
          value="93"
        />
        <label>💨 ความเร็วเมฆ <span id="cloudsSpeedLabel">0.20</span></label>
        <input type="range" id="cloudsSpeed" min="1" max="500" value="20" />
        <label>☁️ รูปร่างเมฆ <span id="cloudsShapeLabel">1.00</span></label>
        <input type="range" id="cloudsShape" min="10" max="300" value="100" />
        <label>🎨 สีของเมฆแก๊ส</label>
        <input
          type="color"
          id="cloudsColor"
          value="#ffffff"
          style="
            width: 100%;
            padding: 2px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: transparent;
            cursor: pointer;
          "
        />
      </div>

      <div class="control-group">
        <label>👤 มุมมองกล้องสปริงอาร์ม (Camera Mode)</label>
        <select id="cameraModeSelect" style="margin-top: 4px; padding: 6px; border-radius: 4px; background: #1a1a1a; color: white; border: 1px solid #444; width: 100%; margin-bottom: 8px;">
          <option value="tps">🎥 TPS (มุมมองข้างไหล่)</option>
          <option value="thirdperson">🎥 มุมมองที่ 3 (ตรงกลาง)</option>
          <option value="fps">🎥 FPS (บุคคลที่ 1)</option>
          <option value="planet">🌍 กล้องจับดาวทั้งดวง (Planet Overview)</option>
        </select>
        <button
          class="btn-toggle active"
          id="cameraCollisionToggle"
          style="margin-bottom: 8px"
        >
          🛡️ ระบบกันกล้องชนวัตถุ: เปิด
        </button>
        <button
          class="btn-toggle active"
          id="zoomLimitToggle"
          style="margin-bottom: 8px"
        >
          🔍 จำกัดระยะซูมออก: เปิด
        </button>
        <button
          class="btn-toggle"
          id="ragdollToggle"
          style="margin-bottom: 8px"
        >
          🦴 โหมด Ragdoll: ปิด
        </button>
        <button class="btn-toggle" id="npcSummonBtn" style="margin-bottom: 8px">
          🦕 เรียก NPC มาหา
        </button>

        <label>🏃 ความเร็วเดิน <span id="charSpeedLabel">0.005</span></label>
        <input
          type="range"
          id="charSpeed"
          min="5"
          max="150"
          value="5"
          style="margin-bottom: 8px"
        />

        <label>📏 ขนาดตัวละคร <span id="charScaleLabel">0.10</span></label>
        <input type="range" id="charScale" min="5" max="70" value="10" />

        <p
          style="
            color: #aaa;
            font-size: 11px;
            margin-top: 8px;
            line-height: 1.3;
            text-align: center;
          "
        >
          เดิน: WASD / จอยสติ๊กลาก<br />Alt: ล็อกเมาส์ & หมุนกล้องเสรี<br />ดำน้ำ:
          Z (กดค้าง) / ขึ้นเหนือน้ำ: Shift หรือ Space (กดค้าง)
        </p>
      </div>

      <div class="control-group">
        <label>🍃 อนิเมชั่นต้นไม้ (Wind Sway)</label>
        <label>💨 ความแรงลม <span id="leafSwayLabel">1.0</span></label>
        <input type="range" id="leafSway" min="1" max="500" value="100" />
      </div>

      <div class="control-group">
        <label>🐠 อนิเมชั่นพืชใต้น้ำ (Water Sway)</label>
        <label>🌊 ความแรงกระแสน้ำ <span id="waterSwayLabel">1.0</span></label>
        <input type="range" id="waterSway" min="1" max="500" value="100" />
      </div>

      <div class="control-group">
        <label>👁️ ระยะการมองเห็น (Render Distance)</label>
        <button
          class="btn-toggle active"
          id="renderDistToggle"
          style="margin-bottom: 8px"
        >
          🛡️ จำกัดระยะเรนเดอร์: เปิด
        </button>
        <label>📏 ระยะเรนเดอร์ <span id="renderDistLabel">3.50</span></label>
        <input type="range" id="renderDist" min="5" max="150" value="35" />
      </div>

      <div class="control-group">
        <label>⚡ จำกัดอัตราเฟรมอนิเมชั่น (Animation FPS)</label>
        <label
          >👤 ตัวละคร (Character) <span id="charFpsLabel">30 FPS</span></label
        >
        <input type="range" id="charFps" min="1" max="120" value="30" />

        <label
          >🌊 น้ำ (Water Waves) <span id="waterFpsLabel">30 FPS</span></label
        >
        <input type="range" id="waterFps" min="1" max="120" value="30" />

        <label
          >🍃 ใบไม้ (Wind Sway) <span id="leafFpsLabel">30 FPS</span></label
        >
        <input type="range" id="leafFps" min="1" max="120" value="30" />

        <label
          >☁️ เมฆ (Clouds & Sky) <span id="cloudFpsLabel">30 FPS</span></label
        >
        <input type="range" id="cloudFps" min="1" max="120" value="30" />
      </div>

      <div class="control-group">
        <label
          >👣 เสียงเดินตัวละคร (Player Footsteps)
          <span id="playerFootstepVolumeVal">0%</span></label
        >
        <input
          type="range"
          id="playerFootstepVolumeSlider"
          min="1"
          max="100"
          value="0"
        />

        <label
          >🏊 เสียงว่ายน้ำตัวละคร (Player Swim)
          <span id="playerSwimVolumeVal">9%</span></label
        >
        <input
          type="range"
          id="playerSwimVolumeSlider"
          min="1"
          max="100"
          value="9"
        />

        <label
          >✨ เสียงเก็บของ (Collect Item)
          <span id="collectSfxVolumeVal">20%</span></label
        >
        <input
          type="range"
          id="collectSfxVolumeSlider"
          min="1"
          max="100"
          value="20"
        />

        <label
          >🔈 ระดับเสียง NPC (NPC Volume)
          <span id="npcSfxVolumeVal">50%</span></label
        >
        <input
          type="range"
          id="npcSfxVolumeSlider"
          min="1"
          max="100"
          value="50"
        />
      </div>

      <div class="control-group">
        <button class="btn-random" id="randomBtn">🎲 สุ่มภูมิประเทศใหม่</button>
        <button class="btn-random" id="randomCubesBtn" style="margin-top: 6px">
          📦 สุ่มวัตถุ (50 ชิ้น)
        </button>
        <button
          class="btn-random"
          id="randomNatureBtn"
          style="
            margin-top: 6px;
            background-image: linear-gradient(135deg, #1b5e20, #4caf50);
          "
        >
          🌲 สุ่มวัตถุธรรมชาติ (ต้นไม้, หิน & พืชใต้น้ำ)
        </button>
      </div>

      <div class="control-group">
        <label>🛠️ เครื่องมือพัฒนา (Dev Tools)</label>
        <button class="btn-toggle" id="devInputModeToggle" style="margin-top: 6px; background-image: linear-gradient(135deg, #6a1b9a, #8e24aa);">
          🎮 โหมดอินพุต: อัตโนมัติ (Auto)
        </button>
        <button class="btn-toggle" id="screenModeVisibilityToggle" style="margin-top: 6px; background-image: linear-gradient(135deg, #0277bd, #039be5);">
          🖥️ โหมดแสดงผล (Screen Mode): แสดง
        </button>
        <button class="btn-toggle" id="hitboxToggle" style="margin-top: 6px; background-image: linear-gradient(135deg, #d32f2f, #f44336);">
          🟥 แสดงโครงสร้างการชน (Show Hitboxes) ปิด
        </button>
        <button class="btn-toggle active" id="frustumCullingToggle" style="margin-top: 6px; background-image: linear-gradient(135deg, #2e7d32, #4caf50);">
          👁️ Frustum Culling (คัดออกวัตถุนอกจอ) เปิด
        </button>
        <button class="btn-toggle active" id="caveWaterToggle" style="margin-top: 6px; background-image: linear-gradient(135deg, #00acc1, #00838f);">
          💧 น้ำในถ้ำ (Cave Water) เปิด
        </button>
        <label style="margin-top: 10px;">📏 ระยะคำนวณการชน <span id="colliderDistLabel">20.00</span></label>
        <input type="range" id="colliderDist" min="5" max="100" value="20" />
        <label style="margin-top: 10px;">🔲 ระยะขอบ UI (UI Margin) <span id="uiMarginLabel">0</span>px</label>
        <input type="range" id="uiMarginDist" min="0" max="100" value="10" />
        <label style="margin-top: 10px;">📏 ระยะทำการ (Action Reach) <span id="actionReachLabel">0.15</span></label>
        <input type="range" id="actionReachDist" min="0.1" max="10" step="0.05" value="0.15" />
        <button class="btn-toggle active" id="actionReachToggle" style="margin-top: 6px; background-image: linear-gradient(135deg, #0288d1, #03a9f4);">
          ⚪ แสดงวงระยะทำการ (Show Action Reach) เปิด
        </button>
        <label style="margin-top: 10px;">🎯 รูปแบบระยะทำการ (Action Reach Mode)</label>
        <select id="actionReachModeSelect" style="margin-top: 4px; padding: 6px; border-radius: 4px; background: #1a1a1a; color: white; border: 1px solid #444; width: 100%;">
          <option value="1">Line (แบบเส้น)</option>
          <option value="2">Circle (แบบวง)</option>
          <option value="3" selected>Capsule (แบบแคปซูล)</option>
        </select>
        <label style="margin-top: 10px;">🪵 ความสูงพื้นไม้ (Wood Floor Height) <span id="woodFloorHeightLabel">0.05</span></label>
        <input type="range" id="woodFloorHeightSlider" min="0.0" max="5.0" step="0.05" value="0.05" />
        <label style="margin-top: 10px;">������ ขนาดกองไฟ (Campfire Size) <span id="campfireSizeLabel">0.25</span></label>
        <input type="range" id="campfireSizeSlider" min="0.1" max="5.0" step="0.05" value="0.25" />
        <label style="margin-top: 10px;">🕳️ ขนาดหลุมสร้างอุโมงค์ (Voxel Hole Multiplier) <span id="voxelHoleRadiusLabel">2.0</span>x</label>
        <input type="range" id="voxelHoleRadiusSlider" min="0.2" max="5.0" step="0.1" value="2.0" />
        <label style="margin-top: 10px;">🔍 ระยะซูมกล้อง (Camera Zoom) <span id="devCameraZoomLabel">3.5</span></label>
        <input type="range" id="devCameraZoomSlider" min="3.5" max="15.0" step="0.1" value="3.5" />
      </div>

      <div class="control-group">
        <label>🎯 <b>ตั้งค่าธนู (Bow Settings)</b></label>
        <label style="margin-top: 5px;">⏱️ เวลายกแขนค้าง (วินาที) <span id="bowHoldArmLabel">3.3</span></label>
        <input type="range" id="bowHoldArmSlider" min="0.5" max="10.0" step="0.1" value="3.3" />
        
        <label style="margin-top: 5px;">⚡ ดีเลย์ Spam Click (วินาที) <span id="bowSpamClickDelayLabel">0.5</span></label>
        <input type="range" id="bowSpamClickDelaySlider" min="0.0" max="3.0" step="0.1" value="0.5" />
        
        <label style="margin-top: 5px;">🎯 ระยะเล็งล็อกเป้า (เมตร/หน่วย) <span id="bowLockDistanceLabel">3.0</span></label>
        <input type="range" id="bowLockDistanceSlider" min="2.0" max="20.0" step="0.5" value="3.0" />
      </div>

      <div class="control-group" id="devSpawnItemContainer">
        <label>🧪 เสกของเข้ากระเป๋า (Spawn Items)</label>
        <select id="devSpawnItemSelect" style="
          width: 100%;
          background: rgba(10, 10, 15, 0.95);
          border: 1px solid rgba(223, 183, 108, 0.4);
          color: #fff;
          padding: 6px;
          border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          margin-top: 4px;
          outline: none;
        ">
        </select>
        <div style="display: flex; gap: 4px; margin-top: 6px;">
          <button class="btn-random" id="devSpawnItemBtn" style="background-image: linear-gradient(135deg, #e65100, #ff9800); flex: 1; margin: 0; padding: 0 4px; font-size: 11px;">
            🪄 เสกเข้าตัว
          </button>
          <button class="btn-random" id="devSpawnItemBtnX50" style="background-image: linear-gradient(135deg, #bf360c, #ff5722); flex: 1; margin: 0; padding: 0 4px; font-size: 11px;">
            🪄 เสก x50
          </button>
        </div>
      </div>
      <div class="control-group" id="devDigTerrainContainer" style="margin-top: 8px;">
        <label>🛠️ ระบบขุด/ถมพื้นดาว (Terrain Mod)</label>
        <div style="display: flex; gap: 4px; margin-top: 6px;">
          <button class="btn-random" id="devDigTerrainBtn" style="background-image: linear-gradient(135deg, #e53935, #ef5350); flex: 1; margin: 0; padding: 0 4px; font-size: 11px;">
            ⛏️ ขุดหลุม
          </button>
          <button class="btn-random" id="devRaiseTerrainBtn" style="background-image: linear-gradient(135deg, #43a047, #66bb6a); flex: 1; margin: 0; padding: 0 4px; font-size: 11px;">
            ⛰️ ถมดิน
          </button>
        </div>
      </div>
      
      <div class="control-group" id="devNpcTeleportContainer" style="margin-top: 8px;">
        <label>👀 ย้ายกล้องไปหา NPC</label>
        <div style="display: flex; gap: 4px; margin-top: 6px; width: 100%;">
          <select id="devNpcSelect" style="
            flex: 1;
            min-width: 0;
            background: rgba(10, 10, 15, 0.95);
            border: 1px solid rgba(223, 183, 108, 0.4);
            color: #fff;
            padding: 6px;
            border-radius: 4px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            outline: none;
          "></select>
          <button class="btn-random" id="devNpcTeleportBtn" style="background-image: linear-gradient(135deg, #0288d1, #29b6f6); flex: 0 0 60px; margin: 0; padding: 0 4px; font-size: 11px; white-space: nowrap;">
            🚀 วาร์ป
          </button>
        </div>
      </div>

      <div class="control-group" id="devClouds3DContainer" style="margin-top: 8px; border-top: 1px dashed rgba(223, 183, 108, 0.3); padding-top: 8px;">
        <label>☁️ ปรับระยะห่าง Clouds3D จากดาว <span id="devCloud3DDistanceLabel">12.00</span></label>
        <input type="range" id="devCloud3DDistanceSlider" min="50" max="3000" value="1200" style="width: 100%; margin-top: 4px;" />

        <label style="margin-top: 8px; display: block;">🌀 ความเร็วอนิเมชั่น Clouds3D <span id="devCloud3DAnimSpeedLabel">0.10</span>x</label>
        <input type="range" id="devCloud3DAnimSpeedSlider" min="0" max="500" value="10" style="width: 100%; margin-top: 4px;" />

        <label style="margin-top: 8px; display: block;">🌍 ความเร็วการเคลื่อนที่รอบดาว <span id="devCloud3DOrbitSpeedLabel">0.10</span>x</label>
        <input type="range" id="devCloud3DOrbitSpeedSlider" min="0" max="500" value="10" style="width: 100%; margin-top: 4px;" />
      </div>

      <div class="control-group" id="devMechSeatingContainer" style="margin-top: 8px; border-top: 1px dashed rgba(223, 183, 108, 0.3); padding-top: 8px;">
        <label>🤖 ปรับระยะที่นั่งตัวละครในหุ่น <span id="devMechSeatHeightLabel">0.71</span></label>
        <input type="range" id="devMechSeatHeightSlider" min="50" max="150" value="71" style="width: 100%; margin-top: 4px;" />
      </div>

      <div class="control-group" id="devMechCameraContainer" style="margin-top: 8px; border-top: 1px dashed rgba(223, 183, 108, 0.3); padding-top: 8px;">
        <label>📷 ปรับระยะกล้องขับหุ่น <span id="devMechCameraDistLabel">0.50</span></label>
        <input type="range" id="devMechCameraDistSlider" min="0" max="1500" value="50" style="width: 100%; margin-top: 4px;" />
      </div>
    </div>

    <div class="action-slots" id="actionSlots" style="display: none;">
      <div class="action-slots-normal">
        <div class="action-slots-title game-ui" id="actionSlotsNormalTitle">Action Slots</div>
        <div class="action-slot game-ui"></div>
        <div class="action-slot game-ui"></div>
        <div class="action-slot game-ui"></div>
        <div class="action-slot game-ui"></div>
      </div>
      
      <div class="action-slots-touch" id="actionSlotsTouch">
        <div class="action-slots-title game-ui" id="actionSlotsTitle">Slots Touch</div>
        <div class="touch-btn game-ui" id="btnTouchQ">
          <div class="touch-btn-icon" id="btnTouchQIcon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
          </div>
          <span class="touch-btn-key">Q</span>
          <span class="touch-btn-label">หมุน/Rotate</span>
        </div>
        <div class="touch-btn game-ui" id="btnTouchE">
          <div class="touch-btn-icon" id="btnTouchEIcon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 11V3a2 2 0 1 1 4 0v8h1a2 2 0 0 1 2 2v2a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-2a2 2 0 0 1 2-2h1V7a2 2 0 1 1 4 0v4h2z"/>
            </svg>
          </div>
          <span class="touch-btn-key">E</span>
          <span class="touch-btn-label">เก็บ/คุย</span>
        </div>
        <div class="touch-btn game-ui" id="btnTouchRightClick">
          <div class="touch-btn-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          </div>
          <span class="touch-btn-key">R-Click</span>
          <span class="touch-btn-label">ขุด-ถม/ขวา</span>
        </div>
        <div class="touch-btn game-ui" id="btnTouchLeftClick">
          <div class="touch-btn-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline>
              <line x1="13" y1="19" x2="19" y2="13"></line>
              <line x1="16" y1="20" x2="20" y2="16"></line>
              <line x1="19" y1="21" x2="21" y2="19"></line>
            </svg>
          </div>
          <span class="touch-btn-key">L-Click</span>
          <span class="touch-btn-label">ตี-ใช้/ซ้าย</span>
        </div>
      </div>

      <!-- Player HP Minimalist Vertical -->
      <div class="player-hp-vertical-container game-ui" id="playerHpVerticalContainer">
        <!-- Dynamically populated -->
      </div>
    </div>`);
