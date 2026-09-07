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
   * ENTRY_MODE Controls when the intro sequence appears:
   *  - "always"     : Plays on every page load and refresh (Default)
   *  - "session"    : Plays once per browser session (uses sessionStorage)
   *  - "firstVisit" : Plays only on very first visit (uses localStorage)
   */
  const ENTRY_MODE = "always"; // "always" | "session" | "firstVisit"

  /**
   * Primary audio source file provided for the entry sequence.
   * Fallback to the original WhatsApp audio file if needed.
   */
  const AUDIO_SRC = "ai-voice.mp3";
  const AUDIO_FALLBACK = "WhatsApp Audio 2026-09-07 at 4.09.59 PM.mpeg";

  // Animation Timing Configuration (in milliseconds)
  const TIMING = {
    authShake: 0,         // 0ms: React, flash, shake, AUTHENTICATING...
    termLine1: 250,       // 250ms: Terminal line 1 appears
    termLine2: 550,       // 550ms: Terminal line 2 appears
    accessGranted: 900,   // 900ms: ACCESS GRANTED (turns cyan/green)
    tapesExit: 1000,      // 1000ms: Hazard caution tapes animate off-screen
    cardExit: 1400,       // 1400ms: Central card scales up & fades
    siteReveal: 1500,     // 1500ms: Background site unblurs & fades in
    overlayRemove: 2200   // 2200ms: Overlay removed & full interactivity restored
  };

  // =========================================================================
  // 2. STATE & ELEMENT REFERENCES
  // =========================================================================
  let isEntering = false;
  let entryAudio = null;

  // Pre-instantiate audio object cleanly
  try {
    entryAudio = new Audio(AUDIO_SRC);
    entryAudio.preload = "auto";
    entryAudio.addEventListener("error", function () {
      // Fallback to original MPEG file if needed
      if (entryAudio.src.indexOf(AUDIO_FALLBACK) === -1) {
        entryAudio.src = AUDIO_FALLBACK;
      }
    });
  } catch (e) {
    console.warn("Audio initialization notice:", e);
  }

  // =========================================================================
  // 3. INITIALIZATION & MODE CHECK
  // =========================================================================
  function initEntry() {
    if (window.innerWidth <= 800) {
      const overlay = document.getElementById("entry-overlay");
      if (overlay) overlay.style.display = "none";
      return;
    }

    const overlay = document.getElementById("entry-overlay");
    if (!overlay) return;

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

    // Click anywhere on entry overlay
    overlay.addEventListener("click", function (e) {
      if (e.target && e.target.closest("#skip-entry")) return;
      triggerEntrySequence(overlay);
    });

    // Touch support for mobile devices
    overlay.addEventListener("touchend", function (e) {
      if (e.target && e.target.closest("#skip-entry")) return;
      // Prevent synthetic click from firing twice
      if (!isEntering) {
        triggerEntrySequence(overlay);
      }
    }, { passive: true });

    // Keyboard Accessibility: ENTER or SPACE
    window.addEventListener("keydown", function (e) {
      if (isEntering) return;
      if (overlay.style.display === "none") return;
      if (e.key === "Enter" || e.key === " " || e.code === "Space") {
        e.preventDefault();
        triggerEntrySequence(overlay);
      }
    });

    // Skip Button Handler
    const skipBtn = document.getElementById("skip-entry");
    if (skipBtn) {
      skipBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        skipEntrySequence(overlay);
      });
    }
  }

  // =========================================================================
  // 4. ACCESS ENTRY SEQUENCE (CLICK / TAP / KEYBOARD)
  // =========================================================================
  function triggerEntrySequence(overlay) {
    if (isEntering) return;
    isEntering = true;

    // Record visit status in storage for session/firstVisit modes
    try {
      sessionStorage.setItem("us_entered", "true");
      localStorage.setItem("us_entered", "true");
    } catch (e) {}

    // Audio Playback (User gesture triggered - complies with browser autoplay policy)
    if (entryAudio) {
      entryAudio.currentTime = 0;
      entryAudio.play().catch(function (err) {
        // Audio playback failure or restriction must NEVER block website entry
        console.warn("Entry audio playback blocked or unavailable:", err);
      });
    }

    const card = document.getElementById("restricted-card");
    const heading = document.getElementById("card-heading");
    const subtext = document.getElementById("card-subtext");
    const termLine1 = document.getElementById("term-line-1");
    const termLine2 = document.getElementById("term-line-2");

    // 0ms: Card reacts, flashes, shakes, text changes to AUTHENTICATING...
    if (card) {
      card.classList.add("authenticating");
    }
    if (heading) {
      heading.textContent = "AUTHENTICATING...";
    }
    if (subtext) {
      subtext.textContent = "VERIFYING BIOMETRICS & CLEARANCE";
    }

    // 250ms: Terminal Line 1
    setTimeout(function () {
      if (termLine1) {
        termLine1.textContent = "> AUTH TOKEN RECEIVED [PASS]";
      }
    }, TIMING.termLine1);

    // 550ms: Terminal Line 2
    setTimeout(function () {
      if (termLine2) {
        termLine2.textContent = "> LVL-7 AUTHORIZATION CONFIRMED";
      }
    }, TIMING.termLine2);

    // 900ms: Status changes to ACCESS GRANTED (cyan theme)
    setTimeout(function () {
      if (card) {
        card.classList.remove("authenticating");
        card.classList.add("access-granted");
      }
      if (heading) {
        heading.textContent = "✓ ACCESS GRANTED";
      }
      if (subtext) {
        subtext.textContent = "UNKNOWN SIGNAL SYSTEM UNLOCKED";
      }
      if (termLine1) {
        termLine1.textContent = "> SECURITY CLEARANCE GRANTED";
        termLine1.classList.add("cyan");
      }
      if (termLine2) {
        termLine2.textContent = "> WELCOME TO UNKNOWN-SIGNAL";
        termLine2.classList.add("cyan");
      }
    }, TIMING.accessGranted);

    // 1000ms: Caution tapes animate off-screen in opposite directions
    setTimeout(function () {
      overlay.classList.add("tapes-exit");
    }, TIMING.tapesExit);

    // 1400ms: Access card scales up & fades out
    setTimeout(function () {
      if (card) {
        card.classList.add("card-exit");
      }
    }, TIMING.cardExit);

    // 1500ms: Main website smoothly reveals (unblur, opacity 1, normal scale)
    setTimeout(function () {
      document.body.classList.remove("entry-active");
      overlay.classList.add("fade-out");
    }, TIMING.siteReveal);

    // 2200ms: Entry overlay completely removed, body scroll & interactions restored
    setTimeout(function () {
      overlay.style.display = "none";
      document.body.style.overflow = "";
    }, TIMING.overlayRemove);
  }

  // =========================================================================
  // 5. SKIP ENTRY ACTION
  // =========================================================================
  function skipEntrySequence(overlay) {
    if (isEntering && overlay.style.display === "none") return;
    isEntering = true;

    // Safely stop audio if playing
    if (entryAudio) {
      try {
        entryAudio.pause();
        entryAudio.currentTime = 0;
      } catch (e) {}
    }

    // Save state
    try {
      sessionStorage.setItem("us_entered", "true");
      localStorage.setItem("us_entered", "true");
    } catch (e) {}

    // Fast reveal transition
    document.body.classList.remove("entry-active");
    overlay.classList.add("fade-out");
    overlay.style.transition = "opacity 0.25s ease";

    setTimeout(function () {
      overlay.style.display = "none";
      document.body.style.overflow = "";
    }, 280);
  }

  // =========================================================================
  // 6. IMMEDIATE BYPASS (FOR SESSION / FIRST-VISIT MODES)
  // =========================================================================
  function bypassEntry(overlay) {
    overlay.style.display = "none";
    document.body.classList.remove("entry-active");
    document.body.style.overflow = "";
  }

  // Self-execute once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEntry);
  } else {
    initEntry();
  }
})();
