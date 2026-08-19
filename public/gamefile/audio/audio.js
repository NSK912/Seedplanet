// === SEEDPLANET MODULE: JS/AUDIO.JS ===

      // ============================================
      // Audio System
      // ============================================
      let audioCtx = null;
      let gameStarted = false;
      let isDevMode = false;
      let lastAutoSaveTime = 0;
      let activeSaveSlotId = "seedplanet_save_1";

      let activeItem = null;
      let isSmashing = false;
      let useAnimTimer = 0;
      let arrowShotInCurrentAnim = false;
      let bowHoldArmTimer = 3.3;
      let bowSpamClickDelay = 0.5;
      let bowLockDistance = 3.0;
      let isUsingItem = false;
      let isActionDown = false;

      let isPlacingFloor = false;
      let floorPlacementInfo = null; // { item, index, source }
      let floorPreviewCollectible = null;
      let placementRotationAngle = 0.0;
      let chestHoldTimer = 0.0;
      let campfireHoldTimer = 0.0;
      let demolishHoldTimer = 0.0;
      let currentOpenChest = null;

      // Swim audio variables
      let swimAudioNode = null;
      let swimGainNode = null;
      let swimFilterNode = null;

      // Underwater audio variables
      let uwAudioNode = null;
      let uwGainNode = null;
      let uwFilterNode = null;

      let isSwimAudioInitialized = false;

      function initAudio() {
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === "suspended") {
          audioCtx.resume();
        }

        if (!isSwimAudioInitialized && audioCtx) {
          isSwimAudioInitialized = true;
          const bufferSize = audioCtx.sampleRate * 2;
          const buffer = audioCtx.createBuffer(
            1,
            bufferSize,
            audioCtx.sampleRate,
          );
          const data = buffer.getChannelData(0);

          // Deep Brown noise for water base
          let lastOut = 0;
          for (let i = 0; i < bufferSize; i++) {
            let white = Math.random() * 2 - 1;
            lastOut = (lastOut + 0.02 * white) / 1.02; // Brown noise approximation
            data[i] = lastOut * 3.5;
          }

          // --- Surface Swim Splash ---
          swimAudioNode = audioCtx.createBufferSource();
          swimAudioNode.buffer = buffer;
          swimAudioNode.loop = true;

          swimFilterNode = audioCtx.createBiquadFilter();
          swimFilterNode.type = "lowpass";
          swimFilterNode.frequency.value = 300;
          swimFilterNode.Q.value = 1.2; // Add a bit of resonance for 'liquid' feel

          swimGainNode = audioCtx.createGain();
          swimGainNode.gain.value = 0;

          swimAudioNode.connect(swimFilterNode);
          swimFilterNode.connect(swimGainNode);
          swimGainNode.connect(audioCtx.destination);

          swimAudioNode.start();

          // --- Underwater Ambience ---
          uwAudioNode = audioCtx.createBufferSource();
          uwAudioNode.buffer = buffer;
          uwAudioNode.loop = true;

          uwFilterNode = audioCtx.createBiquadFilter();
          uwFilterNode.type = "lowpass";
          uwFilterNode.frequency.value = 150; // Very deep, muffled rumble
          uwFilterNode.Q.value = 0.5;

          uwGainNode = audioCtx.createGain();
          uwGainNode.gain.value = 0; // Starts muted

          uwAudioNode.connect(uwFilterNode);
          uwFilterNode.connect(uwGainNode);
          uwGainNode.connect(audioCtx.destination);

          uwAudioNode.start();
        }
      }

      function playFootstepSound(volScale = 1.0, isPlayer = false) {
        if (!audioCtx || sfxMuted) return;

        const baseVol = isPlayer ? playerFootstepVolume : npcSfxVolume;
        if (baseVol <= 0) return;

        const t = audioCtx.currentTime;

        // Deep dirt thud
        const osc = audioCtx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.1);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(
          sfxVolume * baseVol * 0.8 * volScale,
          t + 0.02,
        );
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(t);
        osc.stop(t + 0.15);

        // Crunchy dirt/grass noise
        const bufferSize = Math.floor(audioCtx.sampleRate * 0.1);
        const buffer = audioCtx.createBuffer(
          1,
          bufferSize,
          audioCtx.sampleRate,
        );
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          // Add some roughness to the noise for a crunchier sound
          data[i] = (Math.random() * 2 - 1) * Math.random();
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        // Bandpass filter to shape the noise into a footstep
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = "bandpass";
        noiseFilter.frequency.value = 1200 + Math.random() * 300;
        noiseFilter.Q.value = 0.5;

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0, t);
        noiseGain.gain.linearRampToValueAtTime(
          sfxVolume * baseVol * 0.6 * volScale,
          t + 0.02,
        );
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);

        noise.start(t);
      }

      function playSplashSound(volScale = 1.0, isPlayer = false) {
        if (!audioCtx || sfxMuted) return;

        const baseVol = isPlayer ? playerSwimVolume : npcSfxVolume;
        if (baseVol <= 0) return;

        const t = audioCtx.currentTime;

        const duration = 0.45;

        // 1. Water impact (low frequency thump)
        const osc = audioCtx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(isPlayer ? 180 : 120, t);
        osc.frequency.exponentialRampToValueAtTime(
          isPlayer ? 50 : 30,
          t + 0.15,
        );

        const oscGain = audioCtx.createGain();
        oscGain.gain.setValueAtTime(0, t);
        oscGain.gain.linearRampToValueAtTime(
          sfxVolume * baseVol * 0.5 * volScale,
          t + 0.02,
        );
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

        osc.connect(oscGain);
        oscGain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.3);

        // 2. Splash noise (water breaking)
        const bufferSize = Math.floor(audioCtx.sampleRate * duration);
        const buffer = audioCtx.createBuffer(
          1,
          bufferSize,
          audioCtx.sampleRate,
        );
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
          let white = Math.random() * 2 - 1;
          lastOut = lastOut * 0.8 + white * 0.2; // Pink noise
          data[i] = lastOut * 3.5;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = "bandpass";
        noiseFilter.frequency.setValueAtTime(
          isPlayer ? 1200 + Math.random() * 300 : 800 + Math.random() * 300,
          t,
        );
        noiseFilter.frequency.exponentialRampToValueAtTime(
          isPlayer ? 300 : 150,
          t + duration,
        );
        noiseFilter.Q.value = 0.8;

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0, t);
        noiseGain.gain.linearRampToValueAtTime(
          sfxVolume * baseVol * 0.6 * volScale,
          t + 0.03,
        );
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);

        noise.start(t);
      }

      function playUnderwaterSwimSound(volScale = 1.0, isPlayer = false) {
        if (!audioCtx || sfxMuted) return;

        const baseVol = isPlayer ? playerSwimVolume : npcSfxVolume;
        if (baseVol <= 0) return;

        const t = audioCtx.currentTime;
        const duration = 0.6;

        // Deep swoosh
        const bufferSize = Math.floor(audioCtx.sampleRate * duration);
        const buffer = audioCtx.createBuffer(
          1,
          bufferSize,
          audioCtx.sampleRate,
        );
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
          let white = Math.random() * 2 - 1;
          lastOut = lastOut * 0.95 + white * 0.05; // Brownish noise
          data[i] = lastOut * 4.0;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = "lowpass";
        noiseFilter.frequency.setValueAtTime(isPlayer ? 400 : 250, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(80, t + duration);
        noiseFilter.Q.value = 0.5;

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0, t);
        noiseGain.gain.linearRampToValueAtTime(
          sfxVolume * baseVol * 0.8 * volScale,
          t + 0.1,
        );
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);

        noise.start(t);
      }

      function playChopSound() {
        if (!audioCtx || sfxMuted || collectSfxVolume <= 0) return;
        
        const t = audioCtx.currentTime;
        const targetVol = sfxVolume * collectSfxVolume * 1.5;

        // Create a short, percussive noise burst for the "thwack"
        const bufferSize = audioCtx.sampleRate * 0.1; // 100ms
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(1200, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(100, t + 0.1);
        
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(targetVol, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        
        // Create a low frequency oscillator for the "thud" body of the wood sound
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
        
        const oscGain = audioCtx.createGain();
        oscGain.gain.setValueAtTime(targetVol * 1.2, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        
        osc.connect(oscGain);
        oscGain.connect(audioCtx.destination);
        
        noise.start(t);
        osc.start(t);
        noise.stop(t + 0.1);
        osc.stop(t + 0.1);
      }

      function playPlaceSound() {
        if (!audioCtx || sfxMuted || collectSfxVolume <= 0) return;
        
        const t = audioCtx.currentTime;
        const targetVol = sfxVolume * collectSfxVolume * 1.5;

        // Create a short wood knock sound
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.15);
        
        const oscGain = audioCtx.createGain();
        oscGain.gain.setValueAtTime(targetVol, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        
        osc.connect(oscGain);
        oscGain.connect(audioCtx.destination);
        
        osc.start(t);
        osc.stop(t + 0.15);
      }

      function playBowShootSound() {
        if (!audioCtx || sfxMuted || collectSfxVolume <= 0) return;
        
        const t = audioCtx.currentTime;
        const targetVol = sfxVolume * collectSfxVolume * 1.8;

        // Twang oscillator (fast downward pitch ramp)
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, t);
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.12);
        
        const oscGain = audioCtx.createGain();
        oscGain.gain.setValueAtTime(targetVol, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        
        osc.connect(oscGain);
        oscGain.connect(audioCtx.destination);
        
        // High frequency string snap noise
        const bufferSize = audioCtx.sampleRate * 0.08; // 80ms
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(2000, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(600, t + 0.08);
        
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(targetVol * 0.6, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        
        osc.start(t);
        noise.start(t);
        osc.stop(t + 0.15);
        noise.stop(t + 0.15);
      }

      function playCollectSound() {
        if (!audioCtx || sfxMuted || collectSfxVolume <= 0) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        // รูปร่างของคลื่นเสียง (sine, square, sawtooth, triangle)
        osc.type = "sine";

        // ความถี่เสียง (ระดับเสียง) สูงขึ้นไปเรื่อยๆ เพื่อให้รู้สึกเหมือนได้ของ
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
          800,
          audioCtx.currentTime + 0.1,
        );

        // ระดับความดัง
        const targetVol = sfxVolume * collectSfxVolume;
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(
          targetVol,
          audioCtx.currentTime + 0.02,
        );
        gain.gain.exponentialRampToValueAtTime(
          Math.max(0.001, targetVol * 0.02),
          audioCtx.currentTime + 0.3,
        );

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      }

      function updateSwimSound(
        swimFactor,
        swimMovementFactor,
        walkPhase,
        isCameraUnderwater,
      ) {
        if (
          !isSwimAudioInitialized ||
          !swimGainNode ||
          !uwGainNode ||
          sfxMuted ||
          playerSwimVolume <= 0
        ) {
          if (swimGainNode) swimGainNode.gain.value = 0;
          if (uwGainNode) uwGainNode.gain.value = 0;
          return;
        }

        // --- Surface Swim Splashes ---
        swimFilterNode.frequency.setTargetAtTime(
          100,
          audioCtx.currentTime,
          0.1,
        );

        // Smoothly interpolate surface volume
        swimGainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);

        // --- Underwater Ambience ---
        let uwTargetVol = 0;
        if (isCameraUnderwater) {
          // When camera is underwater, play a deep ambient rumble.
          // Modulate it slightly by movement for water resistance sounds.
          const baseUwVol = 0.4;
          const moveUwVol = swimMovementFactor * 0.3;
          uwTargetVol = (baseUwVol + moveUwVol) * sfxVolume * playerSwimVolume;

          // Add a "whoosh" when swimming fast underwater
          const uwFreq = 150 + swimMovementFactor * 100;
          uwFilterNode.frequency.setTargetAtTime(
            uwFreq,
            audioCtx.currentTime,
            0.2,
          );
        }

        uwGainNode.gain.setTargetAtTime(uwTargetVol, audioCtx.currentTime, 0.1);
      }


