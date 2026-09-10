/**
 * UNKNOWN SIGNAL - Interactive Cinematic Entry Controller
 * File: entry.js
 *
 * Handles the classified security clearance entry sequence, caution tape exit animations,
 * synchronized AI audio playback, keyboard accessibility, skip actions, and mode switching.
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. CONFIGURATION
  // =========================================================================
  
  /**
   * Terminal credentials placeholder configuration.
   * NOTE: Pure visual simulation for website cinematic intro.
   * Change 'username' or 'passwordLength' here anytime.
   */
  const TERMINAL_CONFIG = {
    username: "UNKNOWN_OPERATOR",       // Displayed system username
    password: "SIG-9X-CLEARANCE",       // Typed access key (masked in password field)
    startDelay: 90,                     // Snappy start delay after screen click (ms)
    typeSpeedMin: 42,                   // Min typing delay per char (ms)
    typeSpeedMax: 62,                   // Max typing delay per char (ms)
    pauseBetweenFields: 180,            // Pause before switching to password (ms)
    pauseBeforeSubmit: 300,             // Pause after typing completes before submit (ms)
    verifyDuration: 650                 // Duration of VERIFYING CREDENTIALS (ms)
  };

  /**
   * Sound effects configuration.
   * Set relative file paths below to use custom sound files (e.g. "assets/sounds/click.mp3").
   * Leaving them as null uses the built-in futuristic Web Audio API synthesizer.
   */
  const SFX_CONFIG = {
    typingSoundFile: null,      // Optional custom typing click file
    verifySoundFile: null,      // Optional custom verification beep file
    grantedSoundFile: null      // Optional custom unlocked chime file
  };

  /**
   * MASTER TOGGLE: Website HUD Boot / Spawn Animation
   * Set to true to play the futuristic HUD assembly effect when the site loads.
   * Set to false anytime to immediately disable the effect and return to basic unblur.
   */
  const ENABLE_SITE_SPAWN_EFFECT = true;

  /**
   * ENTRY_MODE Controls when the intro sequence appears:
   *  - "always"     : Plays on every page load and refresh (Default)
   *  - "session"    : Plays once per browser session (uses sessionStorage)
   *  - "firstVisit" : Plays only on very first visit (uses localStorage)
   */
  const ENTRY_MODE = "always";

  // Post-grant animation timing (in milliseconds)
  const TIMING = {
    tapesExit: 320,       // 320ms after grant: Caution tapes animate off-screen
    cardExit: 720,        // 720ms after grant: Central terminal card scales up & fades
    siteReveal: 820,      // 820ms after grant: Background dashboard unblurs & reveals
    overlayRemove: 1550   // 1550ms after grant: Overlay removed & full site interactivity restored
  };

  // =========================================================================
  // 2. STATE MACHINE & AUDIO SYNTHESIS
  // =========================================================================
  const AUTH_STATE = {
    IDLE: "IDLE",
    TYPING_USERNAME: "TYPING_USERNAME",
    TYPING_PASSWORD: "TYPING_PASSWORD",
    VERIFYING: "VERIFYING",
    ACCESS_GRANTED: "ACCESS_GRANTED",
    ENTERING_SITE: "ENTERING_SITE",
    DONE: "DONE"
  };

  let currentAuthState = AUTH_STATE.IDLE;
  let activeTimers = [];

  function addTimeout(fn, delay) {
    const id = setTimeout(() => {
      activeTimers = activeTimers.filter(t => t !== id);
      fn();
    }, delay);
    activeTimers.push(id);
    return id;
  }

  function clearAllTimers() {
    activeTimers.forEach(id => clearTimeout(id));
    activeTimers = [];
  }

  // =========================================================================
  // 3. MASTER AUDIO BUS & SOUND LEVEL PRESET SYSTEM
  // =========================================================================
  /**
   * CALIBRATED SOUND LEVELS:
   * Level 1: Solid Baseline (+9dB boost) - Clear, crisp, comfortable for all speakers.
   * Level 2: High Cyber HUD (+14dB boost) - Punchy sci-fi arcade presence.
   * Level 3: Cinematic Heavy (+18dB boost) - High-impact vault door thump & mechanical key snap.
   * Level 4 (CURRENTLY ACTIVE): Extreme Maximum (+22dB boost) - Maximum loudness through studio brickwall limiter.
   */
  let CURRENT_SOUND_LEVEL = 4;

  const SOUND_LEVEL_MULTIPLIERS = {
    1: 1.0,  // Level 1: Clean, audible baseline (~3x louder than initial whisper)
    2: 1.55, // Level 2: Punchy cyber presence (~4.5x louder)
    3: 2.25, // Level 3: Heavy cinematic arcade (~6.5x louder)
    4: 3.20  // Level 4: Maximum headroom output (~9x louder with limiter)
  };

  let audioCtx = null;
  let masterBus = null;
  let masterGain = null;
  let masterCompressor = null;

  function setSoundLevel(lvl) {
    const levelNum = Number(lvl);
    if (SOUND_LEVEL_MULTIPLIERS[levelNum] !== undefined) {
      CURRENT_SOUND_LEVEL = levelNum;
      if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(SOUND_LEVEL_MULTIPLIERS[levelNum], audioCtx.currentTime);
      }
      console.log(`[AUDIO] Sound level set to Level ${levelNum} (${SOUND_LEVEL_MULTIPLIERS[levelNum]}x boost)`);
      return true;
    }
    console.warn(`[AUDIO] Invalid level '${lvl}'. Choose from Level 1, 2, 3, or 4.`);
    return false;
  }

  // Expose globally so user can test or switch levels directly via console
  if (typeof window !== "undefined") {
    window.setSoundLevel = setSoundLevel;
    window.getSoundLevel = () => CURRENT_SOUND_LEVEL;
  }

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function getMasterAudioNode(ctx) {
    if (!masterBus) {
      // Dynamics Compressor acts as a master limiter to prevent clipping/distortion
      masterCompressor = ctx.createDynamicsCompressor();
      masterCompressor.threshold.setValueAtTime(-4, ctx.currentTime);
      masterCompressor.knee.setValueAtTime(4, ctx.currentTime);
      masterCompressor.ratio.setValueAtTime(10, ctx.currentTime);
      masterCompressor.attack.setValueAtTime(0.002, ctx.currentTime);
      masterCompressor.release.setValueAtTime(0.12, ctx.currentTime);

      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(SOUND_LEVEL_MULTIPLIERS[CURRENT_SOUND_LEVEL] || 1.0, ctx.currentTime);

      masterGain.connect(masterCompressor);
      masterCompressor.connect(ctx.destination);
      masterBus = masterGain;
    }
    return masterBus;
  }

  // Preemptively unlock Web Audio on first gesture or interaction
  if (typeof window !== "undefined") {
    const unlockEvents = ["pointerdown", "mousedown", "keydown", "touchstart"];
    const unlockAudioHandler = function () {
      getAudioContext();
      unlockEvents.forEach(evt => window.removeEventListener(evt, unlockAudioHandler));
    };
    unlockEvents.forEach(evt => window.addEventListener(evt, unlockAudioHandler, { passive: true }));
  }

  // =========================================================================
  // 3B. PROCEDURAL WEB AUDIO SYNTHESIZERS (ROUTED TO MASTER BUS)
  // =========================================================================

  // 1. Futuristic military terminal keystroke sound (Username field)
  // Low mechanical click + tiny digital chirp + high-frequency transient (20-35ms)
  function playTerminalKeySound() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const out = getMasterAudioNode(ctx);
      const t = ctx.currentTime;

      // Layer 1: Low mechanical click (130Hz -> 50Hz, 18ms)
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.018);

      oscGain.gain.setValueAtTime(0.30, t);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);

      osc.connect(oscGain);
      oscGain.connect(out);
      osc.start(t);
      osc.stop(t + 0.019);

      // Layer 2: Tiny digital chirp (950Hz -> 1350Hz, 10ms)
      const chirpOsc = ctx.createOscillator();
      const chirpGain = ctx.createGain();
      chirpOsc.type = 'sine';
      chirpOsc.frequency.setValueAtTime(950, t);
      chirpOsc.frequency.exponentialRampToValueAtTime(1350, t + 0.01);

      chirpGain.gain.setValueAtTime(0.14, t);
      chirpGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.01);

      chirpOsc.connect(chirpGain);
      chirpGain.connect(out);
      chirpOsc.start(t);
      chirpOsc.stop(t + 0.011);

      // Layer 3: High-frequency keycap friction transient (noise bandpass, 7ms)
      const bufferSize = Math.floor(ctx.sampleRate * 0.007);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2000, t);
      filter.Q.setValueAtTime(3.8, t);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.16, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.007);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(out);
      noise.start(t);
      noise.stop(t + 0.008);
    } catch (e) {}
  }

  // 2. Futuristic encrypted password key sound (Password field)
  // Deeper, more muted mechanical click with encrypted feel (22-35ms)
  function playPasswordKeySound() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const out = getMasterAudioNode(ctx);
      const t = ctx.currentTime;

      // Layer 1: Deeper low mechanical switch thump (95Hz -> 36Hz, 22ms)
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(95, t);
      osc.frequency.exponentialRampToValueAtTime(36, t + 0.022);

      oscGain.gain.setValueAtTime(0.32, t);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);

      osc.connect(oscGain);
      oscGain.connect(out);
      osc.start(t);
      osc.stop(t + 0.023);

      // Layer 2: Muted classified key chirp (600Hz -> 820Hz, 12ms)
      const chirpOsc = ctx.createOscillator();
      const chirpGain = ctx.createGain();
      chirpOsc.type = 'sine';
      chirpOsc.frequency.setValueAtTime(600, t);
      chirpOsc.frequency.exponentialRampToValueAtTime(820, t + 0.012);

      chirpGain.gain.setValueAtTime(0.13, t);
      chirpGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);

      chirpOsc.connect(chirpGain);
      chirpGain.connect(out);
      chirpOsc.start(t);
      chirpOsc.stop(t + 0.013);

      // Layer 3: Damped noise transient (1200Hz bandpass, 8ms)
      const bufferSize = Math.floor(ctx.sampleRate * 0.008);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, t);
      filter.Q.setValueAtTime(3.0, t);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.15, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.008);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(out);
      noise.start(t);
      noise.stop(t + 0.009);
    } catch (e) {}
  }

  // 3. Authentication Verification sound (when AUTHENTICATE is triggered)
  // Low digital pulse + encrypted scan chirp + subtle rising tone (~260ms)
  function playVerificationSound() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const out = getMasterAudioNode(ctx);
      const t = ctx.currentTime;

      // Pulse 1 & 2: Low digital pulses (150Hz and 210Hz)
      [150, 210].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + idx * 0.06;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.25, start + 0.045);

        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.05);

        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.052);
      });

      // Rising scan chirp (380Hz -> 680Hz, 120ms)
      const scanOsc = ctx.createOscillator();
      const scanGain = ctx.createGain();
      const scanStart = t + 0.14;

      scanOsc.type = 'sine';
      scanOsc.frequency.setValueAtTime(380, scanStart);
      scanOsc.frequency.exponentialRampToValueAtTime(680, scanStart + 0.12);

      scanGain.gain.setValueAtTime(0.10, scanStart);
      scanGain.gain.exponentialRampToValueAtTime(0.0001, scanStart + 0.12);

      scanOsc.connect(scanGain);
      scanGain.connect(out);
      scanOsc.start(scanStart);
      scanOsc.stop(scanStart + 0.13);
    } catch (e) {}
  }

  // 4. Heavy Cyber Vault Security Unlock sound (Secret Vault Opening)
  // Layer 1: Heavy low-frequency mechanical lock release / clunk (130Hz -> 30Hz)
  // Layer 2: Short pneumatic air-pressure release / hiss (1200Hz -> 260Hz)
  // Layer 3: Low cyber confirmation chord (E3 + B3 + E4)
  // Layer 4: Subtle metallic servo movement (290Hz -> 350Hz -> 270Hz)
  function playVaultUnlockSound() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const out = getMasterAudioNode(ctx);
      const t = ctx.currentTime;

      // Layer 1: Heavy Hydraulic Lock Bolt Retraction ("CLUNK")
      const thudOsc = ctx.createOscillator();
      const thudFilter = ctx.createBiquadFilter();
      const thudGain = ctx.createGain();

      thudOsc.type = 'triangle';
      thudOsc.frequency.setValueAtTime(130, t);
      thudOsc.frequency.exponentialRampToValueAtTime(30, t + 0.14);

      thudFilter.type = 'lowpass';
      thudFilter.frequency.setValueAtTime(230, t);

      thudGain.gain.setValueAtTime(0.42, t);
      thudGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

      thudOsc.connect(thudFilter);
      thudFilter.connect(thudGain);
      thudGain.connect(out);

      thudOsc.start(t);
      thudOsc.stop(t + 0.16);

      // Layer 2: Pneumatic Air / Magnetic Seal Release ("SWOOSH")
      const pneuBufferSize = Math.floor(ctx.sampleRate * 0.2);
      const pneuBuffer = ctx.createBuffer(1, pneuBufferSize, ctx.sampleRate);
      const pneuData = pneuBuffer.getChannelData(0);
      for (let i = 0; i < pneuBufferSize; i++) {
        pneuData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (pneuBufferSize * 0.38));
      }

      const pneuNoise = ctx.createBufferSource();
      pneuNoise.buffer = pneuBuffer;

      const pneuFilter = ctx.createBiquadFilter();
      pneuFilter.type = 'bandpass';
      pneuFilter.frequency.setValueAtTime(1200, t + 0.02);
      pneuFilter.frequency.exponentialRampToValueAtTime(260, t + 0.2);
      pneuFilter.Q.setValueAtTime(2.0, t + 0.02);

      const pneuGain = ctx.createGain();
      pneuGain.gain.setValueAtTime(0.0001, t);
      pneuGain.gain.setValueAtTime(0.20, t + 0.02);
      pneuGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

      pneuNoise.connect(pneuFilter);
      pneuFilter.connect(pneuGain);
      pneuGain.connect(out);

      pneuNoise.start(t + 0.02);
      pneuNoise.stop(t + 0.21);

      // Layer 3: Authoritative Low Clearance Chord (E3 + B3 + E4)
      const chordNotes = [
        { freq: 164.81, delay: 0.04, dur: 0.42, vol: 0.24 },
        { freq: 246.94, delay: 0.04, dur: 0.42, vol: 0.20 },
        { freq: 329.63, delay: 0.10, dur: 0.46, vol: 0.22 }
      ];

      chordNotes.forEach(note => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        const noteStart = t + note.delay;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.freq, noteStart);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(850, noteStart);

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.setValueAtTime(note.vol, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + note.dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(out);

        osc.start(noteStart);
        osc.stop(noteStart + note.dur + 0.01);
      });

      // Layer 4: Subtle Metallic Deadbolt Servo Movement
      const servoOsc = ctx.createOscillator();
      const servoGain = ctx.createGain();
      const servoStart = t + 0.03;

      servoOsc.type = 'triangle';
      servoOsc.frequency.setValueAtTime(290, servoStart);
      servoOsc.frequency.linearRampToValueAtTime(350, servoStart + 0.06);
      servoOsc.frequency.linearRampToValueAtTime(270, servoStart + 0.14);

      servoGain.gain.setValueAtTime(0.0001, t);
      servoGain.gain.setValueAtTime(0.08, servoStart);
      servoGain.gain.exponentialRampToValueAtTime(0.0001, servoStart + 0.14);

      servoOsc.connect(servoGain);
      servoGain.connect(out);

      servoOsc.start(servoStart);
      servoOsc.stop(servoStart + 0.15);
    } catch (e) {}
  }

  // 5. Short rejection blip (for incomplete credentials)
  function playErrorSound() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const out = getMasterAudioNode(ctx);
      const t = ctx.currentTime;

      [0, 0.07].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + offset;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, start);
        osc.frequency.exponentialRampToValueAtTime(90, start + 0.045);

        gain.gain.setValueAtTime(0.10, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.045);

        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.048);
      });
    } catch (e) {}
  }

  // 6. Retro Old TV CRT Glitch Power-On Sound
  // Cathode coil charge + high-voltage degauss zap + split laser sweep pop
  function playCrtTvSpawnSound() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const out = getMasterAudioNode(ctx);
      const t = ctx.currentTime;

      // Layer 1: High-voltage CRT flyback coil whine (1400Hz -> 4200Hz, 120ms)
      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(1400, t);
      osc1.frequency.exponentialRampToValueAtTime(4200, t + 0.12);
      g1.gain.setValueAtTime(0.0001, t);
      g1.gain.setValueAtTime(0.26, t + 0.02);
      g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc1.connect(g1);
      g1.connect(out);
      osc1.start(t);
      osc1.stop(t + 0.15);

      // Layer 2: Analog electric zap / split pulse (when the 2 lines split at 120ms)
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      const splitTime = t + 0.11;
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(480, splitTime);
      osc2.frequency.exponentialRampToValueAtTime(95, splitTime + 0.16);
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.setValueAtTime(0.38, splitTime);
      g2.gain.exponentialRampToValueAtTime(0.0001, splitTime + 0.18);
      osc2.connect(g2);
      g2.connect(out);
      osc2.start(splitTime);
      osc2.stop(splitTime + 0.2);

      // Layer 3: CRT Degauss Sub-Bass Thump (70Hz -> 28Hz)
      const osc3 = ctx.createOscillator();
      const g3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(70, t);
      osc3.frequency.exponentialRampToValueAtTime(28, t + 0.22);
      g3.gain.setValueAtTime(0.42, t);
      g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc3.connect(g3);
      g3.connect(out);
      osc3.start(t);
      osc3.stop(t + 0.26);

      // Layer 4: Screen lock click (when lines reach top and bottom at 500ms)
      const osc4 = ctx.createOscillator();
      const g4 = ctx.createGain();
      const lockTime = t + 0.48;
      osc4.type = 'sine';
      osc4.frequency.setValueAtTime(880, lockTime);
      osc4.frequency.exponentialRampToValueAtTime(220, lockTime + 0.05);
      g4.gain.setValueAtTime(0.0001, t);
      g4.gain.setValueAtTime(0.24, lockTime);
      g4.gain.exponentialRampToValueAtTime(0.0001, lockTime + 0.06);
      osc4.connect(g4);
      g4.connect(out);
      osc4.start(lockTime);
      osc4.stop(lockTime + 0.07);
    } catch (e) {}
  }
  const playTelemetryLockSound = playCrtTvSpawnSound;

  // 7. Old TV CRT Glitch Vertical Aperture & 2 Bright Beam Controller
  function triggerCrtTvSpawnEffect() {
    removeCrtTvSpawnEffect();

    const crtOverlay = document.createElement('div');
    crtOverlay.id = 'crt-spawn-overlay';
    crtOverlay.className = 'crt-spawn-overlay';
    crtOverlay.setAttribute('aria-hidden', 'true');
    crtOverlay.innerHTML = `
      <div class="crt-screen-flash"></div>
      <div class="crt-scanlines"></div>
      <div class="crt-center-spark"></div>
      <div class="crt-shutter-top">
        <div class="crt-beam-top"></div>
      </div>
      <div class="crt-shutter-bottom">
        <div class="crt-beam-bottom"></div>
      </div>
    `;

    const mapArea = document.getElementById('map-area');
    if (mapArea) {
      mapArea.appendChild(crtOverlay);
      mapArea.classList.add('map-spawning');
    } else {
      document.body.appendChild(crtOverlay);
      document.body.classList.add('site-spawning');
    }

    playCrtTvSpawnSound();

    // Auto-remove overlay and restore clean default DOM after 740ms
    addTimeout(function () {
      removeCrtTvSpawnEffect();
    }, 740);
  }

  function removeCrtTvSpawnEffect() {
    const el = document.getElementById('crt-spawn-overlay');
    if (el) el.remove();
    const mapArea = document.getElementById('map-area');
    if (mapArea) mapArea.classList.remove('map-spawning');
    document.body.classList.remove('site-spawning');
  }

  // =========================================================================
  // 4. AUDIO CONTROLLERS (VOICE RECORD REMOVED - PROCEDURAL SFX ONLY)
  // =========================================================================
  function initVoiceAudio() {}
  function playVoiceAudio() {}
  function stopVoiceAudio() {}

  // =========================================================================
  // 5. AUTOMATIC TYPING CONTROLLER WITH PROCEDURAL AUDIO
  // =========================================================================
  let autoTypeTimers = [];
  let autoTypeActive = false;

  function cancelAutoType() {
    autoTypeActive = false;
    autoTypeTimers.forEach(id => clearTimeout(id));
    autoTypeTimers = [];
  }

  function addAutoTypeTimeout(fn, delay) {
    const id = setTimeout(() => {
      autoTypeTimers = autoTypeTimers.filter(t => t !== id);
      fn();
    }, delay);
    autoTypeTimers.push(id);
    return id;
  }

  function startAutoTypeSequence(overlay) {
    if (currentAuthState !== AUTH_STATE.IDLE) return;
    cancelAutoType();
    autoTypeActive = true;

    const userInput = document.getElementById("auth-username");
    const passInput = document.getElementById("auth-password");
    const terminalStatus = document.getElementById("terminal-status");

    if (!userInput || !passInput) return;

    userInput.value = "";
    passInput.value = "";

    const userText = TERMINAL_CONFIG.username || "UNKNOWN_OPERATOR";
    const passText = TERMINAL_CONFIG.password || "SIG-9X-CLEARANCE";

    // Step 1: Brief dramatic pause before auto-typing starts
    addAutoTypeTimeout(function () {
      if (!autoTypeActive || currentAuthState !== AUTH_STATE.IDLE) return;

      currentAuthState = AUTH_STATE.TYPING_USERNAME;
      userInput.focus();
      if (terminalStatus) {
        terminalStatus.textContent = "> INITIALIZING OPERATOR AUTH...";
      }

      let uIdx = 0;

      function typeUserChar() {
        if (!autoTypeActive || currentAuthState !== AUTH_STATE.TYPING_USERNAME) return;

        if (uIdx < userText.length) {
          userInput.value = userText.slice(0, uIdx + 1);
          playTerminalKeySound();
          if (terminalStatus) {
            terminalStatus.textContent = "> OPERATOR: " + userText.slice(0, uIdx + 1);
          }
          uIdx++;
          const charDelay = Math.floor(Math.random() * (TERMINAL_CONFIG.typeSpeedMax - TERMINAL_CONFIG.typeSpeedMin + 1)) + TERMINAL_CONFIG.typeSpeedMin;
          addAutoTypeTimeout(typeUserChar, charDelay);
        } else {
          // Finished typing username
          if (terminalStatus) {
            terminalStatus.textContent = "> OPERATOR VERIFIED // AWAITING KEY";
          }

          // Step 2: Pause between username and password fields
          addAutoTypeTimeout(function () {
            if (!autoTypeActive || currentAuthState !== AUTH_STATE.TYPING_USERNAME) return;

            currentAuthState = AUTH_STATE.TYPING_PASSWORD;
            passInput.focus();

            let pIdx = 0;

            function typePassChar() {
              if (!autoTypeActive || currentAuthState !== AUTH_STATE.TYPING_PASSWORD) return;

              if (pIdx < passText.length) {
                passInput.value = passText.slice(0, pIdx + 1);
                playPasswordKeySound();
                if (terminalStatus) {
                  terminalStatus.textContent = "> ACCESS KEY: " + "•".repeat(pIdx + 1);
                }
                pIdx++;
                const charDelay = Math.floor(Math.random() * (TERMINAL_CONFIG.typeSpeedMax - TERMINAL_CONFIG.typeSpeedMin + 1)) + TERMINAL_CONFIG.typeSpeedMin;
                addAutoTypeTimeout(typePassChar, charDelay);
              } else {
                // Finished typing password
                if (terminalStatus) {
                  terminalStatus.textContent = "> CREDENTIALS LOADED // AUTHENTICATING...";
                }

                // Step 3: Pause before triggering authentication
                addAutoTypeTimeout(function () {
                  if (!autoTypeActive || currentAuthState !== AUTH_STATE.TYPING_PASSWORD) return;

                  currentAuthState = AUTH_STATE.IDLE;
                  handleAuthSubmit(overlay);
                }, TERMINAL_CONFIG.pauseBeforeSubmit);
              }
            }

            typePassChar();
          }, TERMINAL_CONFIG.pauseBetweenFields);
        }
      }

      typeUserChar();
    }, TERMINAL_CONFIG.startDelay);
  }

  // =========================================================================
  // 6. INITIALIZATION & MODE CHECK
  // =========================================================================
  function initEntry() {
    if (window.innerWidth <= 800) {
      const overlay = document.getElementById("entry-overlay");
      if (overlay) overlay.style.display = "none";
      return;
    }

    const overlay = document.getElementById("entry-overlay");
    if (!overlay) return;

    // Initialize voice audio
    initVoiceAudio();

    // Check entry mode bypass
    if (ENTRY_MODE === "session") {
      try {
        if (sessionStorage.getItem("us_entered") === "true") {
          bypassEntry(overlay);
          return;
        }
      } catch (e) {}
    } else if (ENTRY_MODE === "firstVisit") {
      try {
        if (localStorage.getItem("us_entered") === "true") {
          bypassEntry(overlay);
          return;
        }
      } catch (e) {}
    }

    // Set initial active state: site blurred, scroll locked
    document.body.classList.add("entry-active");

    const userInput = document.getElementById("auth-username");
    const passInput = document.getElementById("auth-password");
    const authForm = document.getElementById("auth-form");
    const btnAuth = document.getElementById("btn-authenticate");
    const skipBtn = document.getElementById("skip-entry");
    const card = document.getElementById("restricted-card");

    const IGNORED_KEYS = new Set([
      "Shift", "Control", "Alt", "Meta", "Tab", "CapsLock", 
      "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
      "Home", "End", "PageUp", "PageDown", "Insert", "F1", "F2", 
      "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"
    ]);

    // Typing sound & user intervention on username input
    if (userInput) {
      userInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          cancelAutoType();
          handleAuthSubmit(overlay);
          return;
        }
        cancelAutoType();
        if (!IGNORED_KEYS.has(e.key)) {
          getAudioContext();
          playTerminalKeySound();
        }
      });
    }

    // Typing sound & user intervention on password input
    if (passInput) {
      passInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          cancelAutoType();
          handleAuthSubmit(overlay);
          return;
        }
        cancelAutoType();
        if (!IGNORED_KEYS.has(e.key)) {
          getAudioContext();
          playPasswordKeySound();
        }
      });
    }

    // Form submit / Button click
    if (authForm) {
      authForm.addEventListener("submit", function (e) {
        e.preventDefault();
        cancelAutoType();
        handleAuthSubmit(overlay);
      });
    }

    const terminalStatus = document.getElementById("terminal-status");
    if (terminalStatus) {
      terminalStatus.textContent = "> CLICK ANYWHERE TO AUTHENTICATE";
    }

    // Screen click handler: user clicking anywhere on the screen begins autotyping & loads site
    overlay.addEventListener("click", function (e) {
      // Don't intercept skip button
      if (e.target === skipBtn || (skipBtn && skipBtn.contains(e.target))) {
        return;
      }

      // If IDLE, first screen click unlocks audio, starts autotyping, and loads the website!
      if (currentAuthState === AUTH_STATE.IDLE) {
        getAudioContext();
        startAutoTypeSequence(overlay);
        return;
      }

      // If user clicks [ AUTHENTICATE ] while typing is in progress, fast-track
      if (e.target === btnAuth || (btnAuth && btnAuth.contains(e.target))) {
        if (currentAuthState === AUTH_STATE.TYPING_USERNAME || currentAuthState === AUTH_STATE.TYPING_PASSWORD) {
          cancelAutoType();
          if (userInput && !userInput.value.trim()) {
            userInput.value = TERMINAL_CONFIG.username;
          }
          if (passInput && !passInput.value.trim()) {
            passInput.value = TERMINAL_CONFIG.password || "SIG-9X-CLEARANCE";
          }
          handleAuthSubmit(overlay);
        }
      }
    });

    // Keyboard support: pressing Enter or Space while IDLE also triggers autotyping
    window.addEventListener("keydown", function (e) {
      if (currentAuthState === AUTH_STATE.IDLE && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        getAudioContext();
        startAutoTypeSequence(overlay);
      }
    });

    // Skip Button Handler
    if (skipBtn) {
      skipBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        cancelAutoType();
        skipEntrySequence(overlay);
      });
    }
  }

  // =========================================================================
  // 7. AUTHENTICATION HANDLER & ENTRY SEQUENCE
  // =========================================================================
  function handleAuthSubmit(overlay) {
    if (currentAuthState === AUTH_STATE.VERIFYING || 
        currentAuthState === AUTH_STATE.ACCESS_GRANTED || 
        currentAuthState === AUTH_STATE.ENTERING_SITE || 
        currentAuthState === AUTH_STATE.DONE) return;

    cancelAutoType();

    // Unlock Web Audio on user gesture
    getAudioContext();

    const userInput = document.getElementById("auth-username");
    const passInput = document.getElementById("auth-password");
    const card = document.getElementById("restricted-card");
    const heading = document.getElementById("card-heading");
    const terminalStatus = document.getElementById("terminal-status");
    const authBtnText = document.getElementById("auth-btn-text");
    const btnAuth = document.getElementById("btn-authenticate");

    const uVal = (userInput ? userInput.value : "").trim();
    const pVal = (passInput ? passInput.value : "").trim();

    // 1. EMPTY FIELD CHECK
    if (!uVal || !pVal) {
      if (card) card.classList.add("auth-error-pulse");
      if (terminalStatus) {
        terminalStatus.textContent = "> CREDENTIALS REQUIRED";
        terminalStatus.classList.add("error");
      }
      playErrorSound();

      addTimeout(() => {
        if (card) card.classList.remove("auth-error-pulse");
        if (terminalStatus) {
          terminalStatus.classList.remove("error");
          terminalStatus.textContent = "> AWAITING CREDENTIALS...";
        }
      }, 1400);

      if (!uVal && userInput) userInput.focus();
      else if (passInput) passInput.focus();
      return;
    }

    // 2. AUTHENTICATION INITIATED (Non-empty credentials)
    currentAuthState = AUTH_STATE.VERIFYING;

    // Visually lock fields
    if (userInput) userInput.disabled = true;
    if (passInput) passInput.disabled = true;
    if (btnAuth) btnAuth.disabled = true;
    if (authBtnText) authBtnText.textContent = "[ VERIFYING... ]";

    // Card subtle tension shake
    if (card) card.classList.add("authenticating");

    // Show terminal message & play verification pulse sound
    if (terminalStatus) {
      terminalStatus.textContent = "> VERIFYING CREDENTIALS...";
    }
    playVerificationSound();

    // Record visit status in storage for session/firstVisit modes
    try {
      sessionStorage.setItem("us_entered", "true");
      localStorage.setItem("us_entered", "true");
    } catch (e) {}

    // Short verification delay (650ms)
    addTimeout(function () {
      currentAuthState = AUTH_STATE.ACCESS_GRANTED;

      // Update terminal readout
      if (terminalStatus) {
        terminalStatus.textContent = "> CLEARANCE ACCEPTED // LEVEL 7";
        terminalStatus.classList.add("cyan");
      }

      // Transition heading from ACCESS RESTRICTED to ACCESS GRANTED
      if (heading) {
        heading.textContent = "ACCESS GRANTED";
      }

      // Transition card theme to cyan/green
      if (card) {
        card.classList.remove("authenticating");
        card.classList.add("access-granted");
      }

      if (authBtnText) {
        authBtnText.textContent = "✓ ACCESS GRANTED";
      }

      // Play secret vault opening sound (Hydraulic clunk + air swoosh + power chord + servo)
      playVaultUnlockSound();

      // Immediately clear credentials from memory (privacy safety)
      if (userInput) userInput.value = "";
      if (passInput) passInput.value = "";

      currentAuthState = AUTH_STATE.ENTERING_SITE;

      // Existing exit animations:
      // Step E1: Caution tapes slide away (320ms)
      addTimeout(function () {
        overlay.classList.add("tapes-exit");
      }, TIMING.tapesExit);

      // Step E2: Terminal card scales up & fades (720ms)
      addTimeout(function () {
        if (card) {
          card.classList.add("card-exit");
        }
      }, TIMING.cardExit);

      // Step E3: Background dashboard smoothly unblurs & reveals (820ms)
      addTimeout(function () {
        document.body.classList.remove("entry-active");
        overlay.classList.add("fade-out");

        // Old TV CRT Glitch Vertical Aperture & 2 Bright Beam Spawn Effect
        if (ENABLE_SITE_SPAWN_EFFECT) {
          triggerCrtTvSpawnEffect();
        }
      }, TIMING.siteReveal);

      // Step E4: Overlay completely removed & interactions restored (1550ms)
      addTimeout(function () {
        overlay.style.display = "none";
        document.body.style.overflow = "";
        removeCrtTvSpawnEffect();
        currentAuthState = AUTH_STATE.DONE;
      }, TIMING.overlayRemove);

    }, 650);
  }

  // =========================================================================
  // 8. SKIP ENTRY ACTION
  // =========================================================================
  function skipEntrySequence(overlay) {
    if (currentAuthState === AUTH_STATE.DONE && overlay.style.display === "none") return;
    currentAuthState = AUTH_STATE.DONE;

    // Cancel auto-typing and pending timeouts
    cancelAutoType();
    clearAllTimers();

    // Stop voice audio safely
    stopVoiceAudio();

    // Clear credential values from memory
    const userInput = document.getElementById("auth-username");
    const passInput = document.getElementById("auth-password");
    if (userInput) userInput.value = "";
    if (passInput) passInput.value = "";

    // Save state for session/firstVisit modes
    try {
      sessionStorage.setItem("us_entered", "true");
      localStorage.setItem("us_entered", "true");
    } catch (e) {}

    // Fast reveal transition
    document.body.classList.remove("entry-active");
    removeCrtTvSpawnEffect();
    overlay.classList.add("fade-out");
    overlay.style.transition = "opacity 0.25s ease";

    setTimeout(function () {
      overlay.style.display = "none";
      document.body.style.overflow = "";
    }, 280);
  }

  // =========================================================================
  // 9. IMMEDIATE BYPASS (FOR SESSION / FIRST-VISIT MODES)
  // =========================================================================
  function bypassEntry(overlay) {
    cancelAutoType();
    clearAllTimers();
    overlay.style.display = "none";
    document.body.classList.remove("entry-active");
    removeCrtTvSpawnEffect();
    document.body.style.overflow = "";
    currentAuthState = AUTH_STATE.DONE;
  }

  // Self-execute once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEntry);
  } else {
    initEntry();
  }
})();
