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
      let meleeLockDistance = 0.25;
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

      function playChopSound(position = null) {
        if (!audioCtx || sfxMuted || collectSfxVolume <= 0) return;
        
        let spatial = { distance: 0, volume: 1.0, pan: 0, isCulled: false };
        if (position && typeof calculate3DSpatial === "function") {
          spatial = calculate3DSpatial(position, 25.0, 2.0);
          if (spatial.isCulled) return;
        }

        const t = audioCtx.currentTime;
        const targetVol = sfxVolume * collectSfxVolume * 1.5 * spatial.volume;

        let panner = null;
        if (typeof audioCtx.createStereoPanner === "function") {
          panner = audioCtx.createStereoPanner();
          panner.pan.value = spatial.pan;
          panner.connect(audioCtx.destination);
        }
        const destinationNode = panner || audioCtx.destination;

        // Create a short, percussive noise burst for the "thwack"
        const bufferSize = Math.floor(audioCtx.sampleRate * 0.1); // 100ms
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
        noiseGain.connect(destinationNode);
        
        // Create a low frequency oscillator for the "thud" body of the wood sound
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
        
        const oscGain = audioCtx.createGain();
        oscGain.gain.setValueAtTime(targetVol * 1.2, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        
        osc.connect(oscGain);
        oscGain.connect(destinationNode);
        
        noise.start(t);
        osc.start(t);
        noise.stop(t + 0.1);
        osc.stop(t + 0.1);
      }

      function playRockHitSound(position = null) {
        if (!audioCtx || sfxMuted || collectSfxVolume <= 0) return;
        
        let spatial = { distance: 0, volume: 1.0, pan: 0, isCulled: false };
        if (position && typeof calculate3DSpatial === "function") {
          spatial = calculate3DSpatial(position, 25.0, 2.0);
          if (spatial.isCulled) return;
        }

        const t = audioCtx.currentTime;
        const targetVol = sfxVolume * collectSfxVolume * 1.6 * spatial.volume;

        let panner = null;
        if (typeof audioCtx.createStereoPanner === "function") {
          panner = audioCtx.createStereoPanner();
          panner.pan.value = spatial.pan;
          panner.connect(audioCtx.destination);
        }
        const destinationNode = panner || audioCtx.destination;

        // 1. High frequency mineral/stone clink
        const oscClink = audioCtx.createOscillator();
        oscClink.type = "sine";
        oscClink.frequency.setValueAtTime(650 + Math.random() * 200, t);
        oscClink.frequency.exponentialRampToValueAtTime(180, t + 0.08);

        const gainClink = audioCtx.createGain();
        gainClink.gain.setValueAtTime(targetVol * 0.9, t);
        gainClink.gain.exponentialRampToValueAtTime(0.005, t + 0.08);

        oscClink.connect(gainClink);
        gainClink.connect(destinationNode);

        // 2. Heavy rock impact thud
        const oscThud = audioCtx.createOscillator();
        oscThud.type = "triangle";
        oscThud.frequency.setValueAtTime(220, t);
        oscThud.frequency.exponentialRampToValueAtTime(45, t + 0.12);

        const gainThud = audioCtx.createGain();
        gainThud.gain.setValueAtTime(targetVol * 1.3, t);
        gainThud.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

        oscThud.connect(gainThud);
        gainThud.connect(destinationNode);

        // 3. Crunchy rock debris burst
        const bufferSize = Math.floor(audioCtx.sampleRate * 0.09);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.random();
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = "bandpass";
        noiseFilter.frequency.setValueAtTime(1800, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(300, t + 0.09);
        noiseFilter.Q.value = 1.0;

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(targetVol * 0.7, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(destinationNode);

        oscClink.start(t);
        oscThud.start(t);
        noise.start(t);
        oscClink.stop(t + 0.09);
        oscThud.stop(t + 0.13);
      }

      function playPlaceSound(position = null) {
        if (!audioCtx || sfxMuted || collectSfxVolume <= 0) return;
        
        let spatial = { distance: 0, volume: 1.0, pan: 0, isCulled: false };
        if (position && typeof calculate3DSpatial === "function") {
          spatial = calculate3DSpatial(position, 25.0, 2.0);
          if (spatial.isCulled) return;
        }

        const t = audioCtx.currentTime;
        const targetVol = sfxVolume * collectSfxVolume * 1.5 * spatial.volume;

        let panner = null;
        if (typeof audioCtx.createStereoPanner === "function") {
          panner = audioCtx.createStereoPanner();
          panner.pan.value = spatial.pan;
          panner.connect(audioCtx.destination);
        }
        const destinationNode = panner || audioCtx.destination;

        // Create a short wood knock sound
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.15);
        
        const oscGain = audioCtx.createGain();
        oscGain.gain.setValueAtTime(targetVol, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        
        osc.connect(oscGain);
        oscGain.connect(destinationNode);
        
        osc.start(t);
        osc.stop(t + 0.15);
      }

      /**
       * 3D Digging Sound for digging holes in terrain with shovel
       * Plays ONLY when a new hole is carved into the earth
       */
      function playDigSound(position = null) {
        if (!audioCtx || sfxMuted || collectSfxVolume <= 0) return;

        let spatial = { distance: 0, volume: 1.0, pan: 0, isCulled: false };
        if (position && typeof calculate3DSpatial === "function") {
          spatial = calculate3DSpatial(position, 25.0, 2.0);
          if (spatial.isCulled) return;
        }

        const t = audioCtx.currentTime;
        const targetVol = sfxVolume * collectSfxVolume * 1.7 * spatial.volume;

        let panner = null;
        if (typeof audioCtx.createStereoPanner === "function") {
          panner = audioCtx.createStereoPanner();
          panner.pan.value = spatial.pan;
          panner.connect(audioCtx.destination);
        }
        const destinationNode = panner || audioCtx.destination;

        // 1. Shovel metal blade cutting through dirt (Soil friction)
        const duration = 0.18;
        const bufferSize = Math.floor(audioCtx.sampleRate * duration);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastSample = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          lastSample = (lastSample + 0.15 * white) / 1.15; // Low-pass brown noise
          data[i] = lastSample * 2.5 * (1.0 - i / bufferSize);
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = "bandpass";
        noiseFilter.frequency.setValueAtTime(500, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(140, t + duration);
        noiseFilter.Q.value = 1.2;

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(targetVol * 1.2, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(destinationNode);

        // 2. Earth cavity thud (Deep ground vibration)
        const osc = audioCtx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(110, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.16);

        const oscGain = audioCtx.createGain();
        oscGain.gain.setValueAtTime(targetVol * 1.4, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);

        osc.connect(oscGain);
        oscGain.connect(destinationNode);

        noise.start(t);
        osc.start(t);
        osc.stop(t + duration);
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

      function playSwordDrawSound() {
        if (!audioCtx && typeof initAudio === "function") initAudio();
        if (!audioCtx || sfxMuted || collectSfxVolume <= 0) return;

        const t = audioCtx.currentTime;
        const vol = sfxVolume * collectSfxVolume * 1.4;
        const dur = 0.24;

        // 1. Metallic scabbard friction scrape (fast rising high-Q bandpass)
        const bufSize = Math.floor(audioCtx.sampleRate * dur);
        const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buf;

        const bp = audioCtx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(1600, t);
        bp.frequency.exponentialRampToValueAtTime(5400, t + 0.16);
        bp.Q.value = 5.5;

        const nGain = audioCtx.createGain();
        nGain.gain.setValueAtTime(0.001, t);
        nGain.gain.linearRampToValueAtTime(vol * 0.45, t + 0.04);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        noise.connect(bp);
        bp.connect(nGain);
        nGain.connect(audioCtx.destination);
        noise.start(t);

        // 2. Crisp "Shing!" katana steel partials
        const steelFreqs = [2820, 4460, 6390];
        const steelGains = [0.16, 0.10, 0.06];
        for (let i = 0; i < steelFreqs.length; i++) {
          const osc = audioCtx.createOscillator();
          osc.type = i === 0 ? "triangle" : "sine";
          osc.frequency.setValueAtTime(steelFreqs[i] * (0.985 + Math.random() * 0.03), t);
          osc.frequency.exponentialRampToValueAtTime(steelFreqs[i] * 0.99, t + 0.26);

          const g = audioCtx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(vol * steelGains[i], t + 0.025);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

          osc.connect(g);
          g.connect(audioCtx.destination);
          osc.start(t);
          osc.stop(t + 0.29);
        }
      }

      function playSwordSlashSound(style = 1) {
        if (!audioCtx && typeof initAudio === "function") initAudio();
        if (!audioCtx || sfxMuted || collectSfxVolume <= 0) return;

        const t = audioCtx.currentTime;
        const vol = sfxVolume * collectSfxVolume * 1.85;
        const sType = Math.max(0, Math.min(4, style | 0));

        const triggerSingleCut = (delay, dur, peakRatio, startHz, peakHz, endHz, qVal, steelBaseHz, ringMix, punchAmt) => {
          const st = t + delay;
          const peakT = st + dur * peakRatio;

          // A. Tachikaze (Blade splitting air: tightly resonant bandpass sweep + crisp upper air edge)
          const bufLen = Math.max(64, Math.floor(audioCtx.sampleRate * dur));
          const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
          const ch = buf.getChannelData(0);
          let prev = 0;
          for (let i = 0; i < bufLen; i++) {
            const w = Math.random() * 2 - 1;
            // Emphasize transient hiss vs brown rumble
            ch[i] = w - prev * 0.35;
            prev = w;
          }

          const src = audioCtx.createBufferSource();
          src.buffer = buf;

          const mainBp = audioCtx.createBiquadFilter();
          mainBp.type = "bandpass";
          mainBp.frequency.setValueAtTime(startHz, st);
          mainBp.frequency.exponentialRampToValueAtTime(peakHz, peakT);
          mainBp.frequency.exponentialRampToValueAtTime(endHz, st + dur);
          mainBp.Q.value = qVal;

          const mainGain = audioCtx.createGain();
          mainGain.gain.setValueAtTime(0.0001, st);
          mainGain.gain.linearRampToValueAtTime(vol * 1.05, peakT);
          mainGain.gain.exponentialRampToValueAtTime(0.0001, st + dur);

          src.connect(mainBp);
          mainBp.connect(mainGain);
          mainGain.connect(audioCtx.destination);

          // B. High-velocity knife-edge whistle / shimmer over air cut
          const edgeSrc = audioCtx.createBufferSource();
          edgeSrc.buffer = buf;

          const edgeBp = audioCtx.createBiquadFilter();
          edgeBp.type = "bandpass";
          edgeBp.frequency.setValueAtTime(peakHz * 1.25, st);
          edgeBp.frequency.exponentialRampToValueAtTime(endHz * 1.4, st + dur * 0.9);
          edgeBp.Q.value = qVal * 1.6;

          const edgeGain = audioCtx.createGain();
          edgeGain.gain.setValueAtTime(0.0001, st);
          edgeGain.gain.linearRampToValueAtTime(vol * 0.42, st + dur * (peakRatio * 0.75));
          edgeGain.gain.exponentialRampToValueAtTime(0.0001, st + dur * 0.85);

          edgeSrc.connect(edgeBp);
          edgeBp.connect(edgeGain);
          edgeGain.connect(audioCtx.destination);

          src.start(st);
          edgeSrc.start(st);

          // C. Forged steel resonance harmonic partials ("Sshh-ing!")
          const ratios = [1.0, 1.58, 2.27];
          const amps = [0.16, 0.09, 0.05];
          const ringDur = Math.min(0.24, dur * 0.9);
          for (let k = 0; k < ratios.length; k++) {
            const osc = audioCtx.createOscillator();
            osc.type = k === 0 ? "triangle" : "sine";
            const f0 = steelBaseHz * ratios[k] * (0.97 + Math.random() * 0.06);
            osc.frequency.setValueAtTime(f0 * 1.06, st);
            osc.frequency.exponentialRampToValueAtTime(f0 * 0.94, st + ringDur);

            const og = audioCtx.createGain();
            og.gain.setValueAtTime(0.0001, st);
            og.gain.linearRampToValueAtTime(vol * amps[k] * ringMix, st + Math.min(0.025, dur * 0.14));
            og.gain.exponentialRampToValueAtTime(0.0001, st + ringDur);

            osc.connect(og);
            og.connect(audioCtx.destination);
            osc.start(st);
            osc.stop(st + ringDur + 0.01);
          }

          // D. Sub-air displacement punch
          if (punchAmt > 0) {
            const pOsc = audioCtx.createOscillator();
            pOsc.type = "sine";
            pOsc.frequency.setValueAtTime(175, st);
            pOsc.frequency.exponentialRampToValueAtTime(42, st + 0.065);

            const pGain = audioCtx.createGain();
            pGain.gain.setValueAtTime(0.0001, st);
            pGain.gain.linearRampToValueAtTime(vol * punchAmt, st + 0.01);
            pGain.gain.exponentialRampToValueAtTime(0.0001, st + 0.07);

            pOsc.connect(pGain);
            pGain.connect(audioCtx.destination);
            pOsc.start(st);
            pOsc.stop(st + 0.075);
          }
        };

        if (sType === 0) {
          // Basic Tanto left-click quick slash
          triggerSingleCut(0.0, 0.15, 0.20, 1200, 4800, 820, 2.6, 2900, 0.75, 0.35);
        } else if (sType === 1) {
          // Skill 1: High-speed forward dash katana flash
          triggerSingleCut(0.0, 0.21, 0.18, 1050, 5400, 680, 2.9, 2750, 1.0, 0.55);
        } else if (sType === 2) {
          // Skill 2 (Panel 1): Wide low horizontal sweeping crescent cut
          triggerSingleCut(0.0, 0.28, 0.26, 650, 3950, 440, 2.4, 2450, 1.15, 0.50);
          triggerSingleCut(0.07, 0.16, 0.22, 1600, 4400, 950, 3.4, 3300, 0.55, 0.0);
        } else if (sType === 3) {
          // Skill 3 (Panel 2): 360-degree mid-air spinning cyclone multi-slash
          triggerSingleCut(0.0,  0.17, 0.25, 950,  4600, 750, 2.8, 2850, 0.85, 0.40);
          triggerSingleCut(0.09, 0.17, 0.25, 1150, 5200, 850, 3.1, 3150, 0.90, 0.30);
          triggerSingleCut(0.18, 0.19, 0.24, 900,  4900, 650, 2.7, 2650, 0.95, 0.35);
        } else {
          // Skill 4 (Panel 3): Rising overhead wind-slice before slam impact
          triggerSingleCut(0.03, 0.19, 0.38, 520, 3200, 1400, 2.2, 2250, 0.90, 0.30);
        }
      }

      function playSwordSlamImpactSound() {
        if (!audioCtx && typeof initAudio === "function") initAudio();
        if (!audioCtx || sfxMuted || collectSfxVolume <= 0) return;

        const t = audioCtx.currentTime;
        const vol = sfxVolume * collectSfxVolume * 2.0;

        // 1. Heavy cleave earth shockwave (sub drop)
        const sub = audioCtx.createOscillator();
        sub.type = "sine";
        sub.frequency.setValueAtTime(115, t);
        sub.frequency.exponentialRampToValueAtTime(28, t + 0.22);

        const subGain = audioCtx.createGain();
        subGain.gain.setValueAtTime(0.001, t);
        subGain.gain.linearRampToValueAtTime(vol * 0.95, t + 0.012);
        subGain.gain.exponentialRampToValueAtTime(0.0005, t + 0.26);

        sub.connect(subGain);
        subGain.connect(audioCtx.destination);
        sub.start(t);
        sub.stop(t + 0.28);

        // 2. Sharp cleave air-burst & debris shatter noise
        const dur = 0.28;
        const bufLen = Math.floor(audioCtx.sampleRate * dur);
        const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) {
          data[i] = (Math.random() * 2 - 1) * (0.4 + 0.6 * Math.random());
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buf;

        const lp = audioCtx.createBiquadFilter();
        lp.type = "bandpass";
        lp.frequency.setValueAtTime(2800, t);
        lp.frequency.exponentialRampToValueAtTime(220, t + dur);
        lp.Q.value = 1.1;

        const nGain = audioCtx.createGain();
        nGain.gain.setValueAtTime(vol * 0.9, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        noise.connect(lp);
        lp.connect(nGain);
        nGain.connect(audioCtx.destination);
        noise.start(t);

        // 3. Long resonant steel impact chime ("KANGGG!!")
        const freqs = [1920, 3040, 4820];
        const amps = [0.22, 0.14, 0.08];
        for (let i = 0; i < freqs.length; i++) {
          const osc = audioCtx.createOscillator();
          osc.type = i === 0 ? "triangle" : "sine";
          osc.frequency.setValueAtTime(freqs[i], t);
          osc.frequency.exponentialRampToValueAtTime(freqs[i] * 0.97, t + 0.36);

          const g = audioCtx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(vol * amps[i], t + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);

          osc.connect(g);
          g.connect(audioCtx.destination);
          osc.start(t);
          osc.stop(t + 0.40);
        }
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

      // ==============================================================
      // 1. 3D Spatial Audio, 2. Voice Limiter (50), 3. Priority System
      // Foundation module for Custom Spherical Planet Engine
      // ==============================================================
      const MAX_AUDIO_VOICES = 50;
      const DEFAULT_AUDIO_MAX_DIST = 25.0; // Distance beyond which sound is culled
      const DEFAULT_AUDIO_REF_DIST = 2.0;  // Full volume within this distance
      const PRIORITY_PLAYER_ITEM = 999999; // Priority อันดับ 1: ไอเทมที่ผู้เล่นใช้งาน (ไม่มีทางโดนปิด)

      let activeAudioVoices = [];
      let voiceIdSequence = 0;

      /**
       * ดึงข้อมูลตำแหน่งและแกนของ Listener (ผู้เล่น / กล้อง) ใน Engine
       */
      function getAudioListenerInfo() {
        let eye = null;
        let right = null;

        if (typeof window !== "undefined") {
          const csa = window.cameraSpringArm;
          if (csa && csa.eyePos) {
            eye = csa.eyePos;
            if (csa.viewMatrix && csa.viewMatrix.length >= 11) {
              // WebGL column-major matrix: Column 0 = [m0, m4, m8] is the Camera Right vector
              right = [csa.viewMatrix[0], csa.viewMatrix[4], csa.viewMatrix[8]];
            }
          }
          if (!eye && window.eyePos) {
            eye = window.eyePos;
          }
          if (!right && window.viewMatrix && window.viewMatrix.length >= 11) {
            right = [window.viewMatrix[0], window.viewMatrix[4], window.viewMatrix[8]];
          }
          if (!eye) {
            eye = window.player3DPos || [0, 0, 0];
          }
        }

        return {
          eye: eye || [0, 0, 0],
          right: right || [1, 0, 0]
        };
      }

      /**
       * 1. 3D Spatial Audio Calculation
       * คำนวณระยะห่าง, ความดัง (Distance Attenuation), และ Stereo Panning สำหรับ Custom Engine
       * @param {Array<number>} [soundPos] ตำแหน่ง 3D [x, y, z] ของแหล่งกำเนิดเสียง
       * @param {number} [maxDist] ระยะเสียงไกลสุด (default 25.0)
       * @param {number} [refDist] ระยะที่เสียงดังเต็มที่ (default 2.0)
       * @returns {{ distance: number, volume: number, pan: number, isCulled: boolean }}
       */
      function calculate3DSpatial(soundPos, maxDist = DEFAULT_AUDIO_MAX_DIST, refDist = DEFAULT_AUDIO_REF_DIST) {
        if (!soundPos) {
          return { distance: 0, volume: 1.0, pan: 0, isCulled: false };
        }

        const { eye, right } = getAudioListenerInfo();
        const dx = soundPos[0] - eye[0];
        const dy = soundPos[1] - eye[1];
        const dz = soundPos[2] - eye[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist >= maxDist) {
          return { distance: dist, volume: 0, pan: 0, isCulled: true };
        }

        // คำนวณลดทอนความดังตามระยะทาง (Smooth Quadratic Falloff)
        let vol = 1.0;
        if (dist > refDist) {
          const norm = (dist - refDist) / (maxDist - refDist);
          vol = Math.max(0, 1.0 - norm);
          vol = vol * vol;
        }

        // คำนวณ Stereo Panning (-1.0 ซ้าย, +1.0 ขวา) ผ่าน Dot Product กับ Camera Right Vector
        let pan = 0;
        if (dist > 0.0001 && right) {
          const dot = (dx * right[0] + dy * right[1] + dz * right[2]) / dist;
          pan = Math.max(-1.0, Math.min(1.0, dot));
        }

        return { distance: dist, volume: vol, pan: pan, isCulled: false };
      }

      /**
       * ตรวจสอบว่าผู้เล่นกำลังใช้งานไอเทมอยู่ในขณะนี้หรือไม่
       * (ครอบคลุมทุกไอเทมในเกมโดยอัตโนมัติ โดยไม่ต้องมานั่งกำหนดทีละไอเทม)
       */
      function isPlayerUsingAnyItem() {
        if (typeof window !== "undefined") {
          if (window.isUsingItem || window.isActionDown) return true;
          if (window.activeItem && (window.useAnimTimer > 0 || window.isSmashing)) return true;
        }
        if (typeof isUsingItem !== "undefined" && isUsingItem) return true;
        if (typeof isActionDown !== "undefined" && isActionDown) return true;
        if (typeof activeItem !== "undefined" && activeItem && typeof useAnimTimer !== "undefined" && useAnimTimer > 0) return true;
        return false;
      }

      /**
       * 2. Voice Limiter (จำกัด 50 เสียง) & 3. Priority Manager
       * 
       * - Priority อันดับ 1: ไอเทมที่ผู้เล่นกำลังใช้งาน (isPlayerItem=true หรือ isPlayerUsingAnyItem()=true)
       *   -> จะได้ PRIORITY_PLAYER_ITEM (ไม่มีทางโดนปิด / ป้องกันการถูก Evict เด็ดขาด)
       * - Priority เสียงที่เหลือ: ไล่ความสำคัญจาก "ระยะห่างของวัตถุ" (ยิ่งใกล้ยิ่งสำคัญมาก, ไกลสุดโดนตัดก่อน)
       * 
       * @param {string} id ID ประจำเสียง
       * @param {Object} [options]
       * @param {Array<number>} [options.position] ตำแหน่ง 3D ของเสียง
       * @param {boolean} [options.isPlayerItem] บังคับว่าเป็นเสียงไอเทมที่ผู้เล่นใช้งาน
       * @param {number} [options.duration=0.5] ระยะเวลาของเสียง
       * @param {Function} [options.stopCallback] ฟังก์ชันที่จะถูกเรียกเมื่อเสียงถูกตัด/หยุด
       * @returns {boolean} true ถ้าได้รับอนุญาตให้เล่น, false ถ้าถูกจำกัดโควตา
       */
      function requestAudioVoice(id, options = {}) {
        const now = (audioCtx ? audioCtx.currentTime : Date.now() / 1000);
        const duration = options.duration !== undefined ? options.duration : 0.5;
        const onStop = options.stopCallback || null;
        const soundPos = options.position || null;

        // 1. เคลียร์เสียงที่เล่นจบแล้วออกจากโควตา
        activeAudioVoices = activeAudioVoices.filter(v => v.endTime > now);

        // คำนวณระยะห่าง
        let distance = 0;
        if (soundPos) {
          const { eye } = getAudioListenerInfo();
          const dx = soundPos[0] - eye[0];
          const dy = soundPos[1] - eye[1];
          const dz = soundPos[2] - eye[2];
          distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        }

        // 2. คำนวณ Priority:
        // - อันดับ 1: ไอเทมที่ผู้เล่นใช้งานขณะนั้น -> PRIORITY_PLAYER_ITEM (ไม่มีทางโดนปิด)
        // - เสียงที่เหลือ: ไล่ความสำคัญตามระยะห่างวัตถุ (ระยะใกล้ = ค่าสูง, ระยะไกล = ค่าต่ำ)
        const isPlayerItem = options.isPlayerItem || isPlayerUsingAnyItem();
        const priority = isPlayerItem ? PRIORITY_PLAYER_ITEM : Math.max(0, 10000 - distance);

        // ถ้าเป็นเสียงเดิมที่กำลังเล่นอยู่ (เช่น เสียง Loop) ให้รีเฟรชโควตา
        const existingIdx = activeAudioVoices.findIndex(v => v.id === id);
        if (existingIdx >= 0) {
          activeAudioVoices[existingIdx].priority = priority;
          activeAudioVoices[existingIdx].distance = distance;
          activeAudioVoices[existingIdx].endTime = now + duration;
          if (onStop) activeAudioVoices[existingIdx].stop = onStop;
          return true;
        }

        // 3. ถ้าโควตายังไม่เต็ม 50 เสียง ให้เล่นได้ทันที
        if (activeAudioVoices.length < MAX_AUDIO_VOICES) {
          activeAudioVoices.push({
            id: id,
            priority: priority,
            distance: distance,
            stop: onStop,
            endTime: now + duration
          });
          return true;
        }

        // 4. กรณีโควตาเต็ม 50 เสียง:
        // หาเสียงที่ Priority ต่ำที่สุด (ระยะวัตถุไกลที่สุด) เพื่อตัดออก
        // *** กฎเหล็ก: เสียง PRIORITY_PLAYER_ITEM จะไม่มีวันโดนตัด (Protected) ***
        let lowestIdx = -1;
        let lowestPrio = priority;

        for (let i = 0; i < activeAudioVoices.length; i++) {
          const v = activeAudioVoices[i];
          // ข้ามเสียงที่เป็นไอเทมของผู้เล่นโดยเด็ดขาด
          if (v.priority >= PRIORITY_PLAYER_ITEM) continue;

          if (v.priority < lowestPrio) {
            lowestPrio = v.priority;
            lowestIdx = i;
          }
        }

        if (lowestIdx >= 0) {
          const evicted = activeAudioVoices.splice(lowestIdx, 1)[0];
          if (typeof evicted.stop === "function") {
            try { evicted.stop(); } catch(e) {}
          }
          activeAudioVoices.push({
            id: id,
            priority: priority,
            distance: distance,
            stop: onStop,
            endTime: now + duration
          });
          return true;
        }

        // ถ้าเป็นไอเทมของผู้เล่น ให้เล่นต่อไปโดยไม่ตัด
        if (priority >= PRIORITY_PLAYER_ITEM) {
          activeAudioVoices.push({
            id: id,
            priority: priority,
            distance: distance,
            stop: onStop,
            endTime: now + duration
          });
          return true;
        }

        // เสียงทั่วไปที่อยู่ไกลเกินไปและไม่มีช่องให้แทนที่ จะถูกปฏิเสธ (Drop)
        return false;
      }

      /**
       * คืนโควตาเสียงเมื่อเล่นจบ
       */
      function releaseAudioVoice(id) {
        const idx = activeAudioVoices.findIndex(v => v.id === id);
        if (idx >= 0) {
          activeAudioVoices.splice(idx, 1);
        }
      }

      // Expose globally on window
      if (typeof window !== "undefined") {
        window.calculate3DSpatial = calculate3DSpatial;
        window.requestAudioVoice = requestAudioVoice;
        window.releaseAudioVoice = releaseAudioVoice;
        window.isPlayerUsingAnyItem = isPlayerUsingAnyItem;
        window.MAX_AUDIO_VOICES = MAX_AUDIO_VOICES;
        window.PRIORITY_PLAYER_ITEM = PRIORITY_PLAYER_ITEM;
        window.playChopSound = playChopSound;
        window.playRockHitSound = playRockHitSound;
        window.playDigSound = playDigSound;
        window.playPlaceSound = playPlaceSound;
        window.playSwordDrawSound = playSwordDrawSound;
        window.playSwordSlashSound = playSwordSlashSound;
        window.playSwordSlamImpactSound = playSwordSlamImpactSound;

        window.AudioEngine3D = {
          calculate3DSpatial: calculate3DSpatial,
          requestAudioVoice: requestAudioVoice,
          releaseAudioVoice: releaseAudioVoice,
          isPlayerUsingAnyItem: isPlayerUsingAnyItem,
          MAX_AUDIO_VOICES: MAX_AUDIO_VOICES,
          PRIORITY_PLAYER_ITEM: PRIORITY_PLAYER_ITEM,
          playChopSound: playChopSound,
          playRockHitSound: playRockHitSound,
          playDigSound: playDigSound,
          playPlaceSound: playPlaceSound,
          playSwordDrawSound: playSwordDrawSound,
          playSwordSlashSound: playSwordSlashSound,
          playSwordSlamImpactSound: playSwordSlamImpactSound
        };
      }


