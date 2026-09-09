/**
 * UNKNOWN-SIGNAL // CLASSIFIED SCIENTIST DOSSIER & NAVIGATION ENGINE
 * Handles:
 * 1. Top navigation switching between INCIDENT MAP and SCIENTIST FILES
 * 2. High-tech audio sound effects (with customizable audio path & synthetic fallback)
 * 3. Dynamic scientist filtering, search, sorting, and responsive dossier viewing
 */

(function () {
  'use strict';

  // =========================================================================
  // AUDIO CONFIGURATION & SOUND EFFECT ENGINE
  // =========================================================================
  /**
   * USER CUSTOMIZATION:
   * You can replace the sound file at 'assets/sounds/page-switch.mp3' with any custom audio file.
   * If you move or rename the file, simply update PAGE_SWITCH_SOUND_PATH below:
   */
  const PAGE_SWITCH_SOUND_PATH = 'assets/sounds/page-switch.mp3';

  let switchAudioElement = null;
  let webAudioCtx = null;

  // Initialize audio element with preload
  try {
    switchAudioElement = new Audio(PAGE_SWITCH_SOUND_PATH);
    switchAudioElement.preload = 'auto';
    switchAudioElement.volume = 0.35;
  } catch (e) {
    // Graceful fallback if Audio constructor is restricted
  }

  /**
   * Play futuristic page switch audio
   * Uses the configured MP3 file, with instant Web Audio API synthetic chirp fallback
   */
  function playPageSwitchSound() {
    let playedFromMp3 = false;

    if (switchAudioElement) {
      try {
        switchAudioElement.currentTime = 0;
        const playPromise = switchAudioElement.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              playedFromMp3 = true;
            })
            .catch(() => {
              // If browser autoplay policy or missing audio blocked it, use synthetic chirp
              playSyntheticChirp();
            });
          return;
        }
      } catch (err) {
        // Fall through to synthetic chirp
      }
    }

    if (!playedFromMp3) {
      playSyntheticChirp();
    }
  }

  /**
   * Synthetic futuristic HUD chirp tone (Zero-dependency Web Audio API)
   */
  function playSyntheticChirp() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!webAudioCtx) {
        webAudioCtx = new AudioContextClass();
      }
      if (webAudioCtx.state === 'suspended') {
        webAudioCtx.resume();
      }

      const now = webAudioCtx.currentTime;
      const osc1 = webAudioCtx.createOscillator();
      const osc2 = webAudioCtx.createOscillator();
      const gain = webAudioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(980, now);
      osc1.frequency.exponentialRampToValueAtTime(440, now + 0.12);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1480, now);
      osc2.frequency.exponentialRampToValueAtTime(740, now + 0.10);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(webAudioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.15);
      osc2.stop(now + 0.15);
    } catch (e) {
      // Graceful silence if audio is not permitted
    }
  }

  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  let currentView = 'map'; // 'map' | 'scientists'
  let activeFilter = 'ALL'; // 'ALL' | 'DECEASED' | 'MISSING' | 'RESTRICTED'
  let searchQuery = '';
  let activeSort = 'recent'; // 'recent' | 'oldest' | 'alpha'
  let selectedScientistId = null;

  const rawScientists = typeof SCIENTISTS_DATA !== 'undefined' ? SCIENTISTS_DATA : [];

  // =========================================================================
  // PAGE SWITCHING CONTROLLER
  // =========================================================================
  function switchPage(targetView) {
    if (targetView === currentView) return;

    // Trigger sound effect on page transition
    playPageSwitchSound();

    const viewMap = document.getElementById('view-map');
    const viewScientists = document.getElementById('view-scientists');
    const tabMap = document.getElementById('tab-map');
    const tabScientists = document.getElementById('tab-scientists');
    const pageTitle = document.querySelector('.topbar-page-title');
    const subbarMap = document.getElementById('subbar-map');
    const subbarScientists = document.getElementById('subbar-scientists');

    // Trigger visual glitch/fade transition effect
    document.body.classList.add('page-transitioning');
    setTimeout(() => {
      document.body.classList.remove('page-transitioning');
    }, 280);

    currentView = targetView;

    if (targetView === 'scientists') {
      // Activate Scientist Files View
      if (viewMap) viewMap.classList.remove('active');
      if (viewScientists) viewScientists.classList.add('active');

      if (tabMap) tabMap.classList.remove('active');
      if (tabScientists) tabScientists.classList.add('active');

      if (pageTitle) {
        pageTitle.textContent = 'MISSING & DECEASED SCIENTISTS';
      }

      if (subbarMap) subbarMap.style.display = 'none';
      if (subbarScientists) subbarScientists.style.display = 'flex';

      // Ensure first scientist is selected if none currently chosen
      if (!selectedScientistId && rawScientists.length > 0) {
        selectedScientistId = rawScientists[0].id;
      }
      renderScientistView();
    } else {
      // Activate Incident Map View
      if (viewScientists) viewScientists.classList.remove('active');
      if (viewMap) viewMap.classList.add('active');

      if (tabScientists) tabScientists.classList.remove('active');
      if (tabMap) tabMap.classList.add('active');

      if (pageTitle) {
        pageTitle.textContent = 'GLOBAL UAP INCIDENT MONITOR';
      }

      if (subbarScientists) subbarScientists.style.display = 'none';
      if (subbarMap) subbarMap.style.display = 'flex';
    }
  }

  // =========================================================================
  // SCIENTISTS FILTERING & SORTING LOGIC
  // =========================================================================
  function getFilteredScientists() {
    return rawScientists.filter((sci) => {
      // Filter by category
      if (activeFilter === 'DECEASED' && sci.status !== 'DECEASED') return false;
      if (activeFilter === 'MISSING' && sci.status !== 'MISSING') return false;
      if (activeFilter === 'RESTRICTED' && !sci.restricted) return false;

      // Filter by search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = sci.name.toLowerCase().includes(q);
        const matchesField = sci.field.toLowerCase().includes(q);
        const matchesLoc = sci.location.toLowerCase().includes(q);
        const matchesCode = sci.caseCode.toLowerCase().includes(q);
        const matchesYear = String(sci.year).includes(q);
        if (!matchesName && !matchesField && !matchesLoc && !matchesCode && !matchesYear) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (activeSort === 'recent') return b.year - a.year;
      if (activeSort === 'oldest') return a.year - b.year;
      if (activeSort === 'alpha') return a.name.localeCompare(b.name);
      return 0;
    });
  }

  function updateFilterCounts() {
    const totalCount = rawScientists.length;
    const deceasedCount = rawScientists.filter((s) => s.status === 'DECEASED').length;
    const missingCount = rawScientists.filter((s) => s.status === 'MISSING').length;
    const restrictedCount = rawScientists.filter((s) => s.restricted).length;

    const countAll = document.getElementById('sci-count-all');
    const countDeceased = document.getElementById('sci-count-deceased');
    const countMissing = document.getElementById('sci-count-missing');
    const countRestricted = document.getElementById('sci-count-restricted');

    if (countAll) countAll.textContent = `(${totalCount})`;
    if (countDeceased) countDeceased.textContent = `(${deceasedCount})`;
    if (countMissing) countMissing.textContent = `(${missingCount})`;
    if (countRestricted) countRestricted.textContent = `(${restrictedCount})`;
  }

  // =========================================================================
  // DOM RENDERING: SCIENTIST LIST & DOSSIER DETAIL
  // =========================================================================
  function renderScientistView() {
    const filtered = getFilteredScientists();
    const listContainer = document.getElementById('scientist-list-items');
    const detailContainer = document.getElementById('scientist-detail-card');

    if (!listContainer || !detailContainer) return;

    // Verify selected ID is in filtered list, else select first
    const exists = filtered.some((s) => s.id === selectedScientistId);
    if (!exists && filtered.length > 0) {
      selectedScientistId = filtered[0].id;
    }

    // 1. Render Left Column List
    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="sci-empty-state">
          <div class="sci-empty-code">// NO CLASSIFIED DOSSIERS MATCH CURRENT FILTERS</div>
          <div class="sci-empty-sub">Adjust search query or filter tags</div>
        </div>
      `;
    } else {
      listContainer.innerHTML = filtered
        .map((sci) => {
          const isSelected = sci.id === selectedScientistId;
          const statusClass = sci.status === 'DECEASED' ? 'status-deceased' : 'status-missing';
          const tagClass = `tag-${(sci.categoryTag || 'GEN').toLowerCase()}`;

          return `
            <div class="sci-card ${isSelected ? 'selected' : ''}" data-id="${sci.id}" tabindex="0" role="button" aria-pressed="${isSelected}">
              <div class="sci-card-avatar-wrap">
                <img src="${sci.portrait}" class="sci-card-avatar" alt="${sci.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="sci-avatar-fallback" style="display:none;">${sci.fallbackInitials}</div>
                <div class="sci-avatar-ring ${statusClass}"></div>
              </div>
              <div class="sci-card-info">
                <div class="sci-card-top-row">
                  <span class="sci-card-name">${sci.name}</span>
                  <span class="sci-card-badge ${statusClass}">${sci.status}</span>
                </div>
                <div class="sci-card-field">${sci.field}</div>
                <div class="sci-card-meta">
                  <span class="sci-card-year-loc">${sci.year} &middot; ${sci.location}</span>
                  <span class="sci-card-tag ${tagClass}">${sci.categoryTag}</span>
                </div>
              </div>
              <div class="sci-card-arrow">►</div>
            </div>
          `;
        })
        .join('');

      // Add click listeners to cards
      listContainer.querySelectorAll('.sci-card').forEach((card) => {
        card.addEventListener('click', () => {
          const id = card.getAttribute('data-id');
          if (id && id !== selectedScientistId) {
            selectedScientistId = id;
            renderScientistView();
          }
        });
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            card.click();
          }
        });
      });
    }

    // 2. Render Right Column Detail Panel
    const currentSci = rawScientists.find((s) => s.id === selectedScientistId);
    if (!currentSci) {
      detailContainer.innerHTML = `
        <div class="sci-detail-empty">
          <span>// SELECT A SUBJECT FILE FROM THE REGISTER</span>
        </div>
      `;
      return;
    }

    const statusBadgeClass = currentSci.status === 'DECEASED' ? 'badge-deceased' : 'badge-missing';

    detailContainer.innerHTML = `
      <div class="sci-dossier-inner">
        <!-- Top Subject Profile Banner -->
        <div class="sci-dossier-header">
          <div class="sci-portrait-frame">
            <div class="sci-portrait-hud-ring"></div>
            <img src="${currentSci.portrait}" class="sci-portrait-img" alt="${currentSci.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="sci-portrait-fallback" style="display:none;">${currentSci.fallbackInitials}</div>
            <div class="sci-portrait-scanline"></div>
            <div class="sci-portrait-corner c-tl"></div>
            <div class="sci-portrait-corner c-tr"></div>
            <div class="sci-portrait-corner c-bl"></div>
            <div class="sci-portrait-corner c-br"></div>
          </div>

          <div class="sci-header-details">
            <div class="sci-case-code-row">
              <span class="sci-case-tag">CLASSIFIED FILE: ${currentSci.caseCode}</span>
              <span class="sci-case-sep">//</span>
              <span class="sci-case-date">${currentSci.date} &middot; ${currentSci.location}</span>
            </div>

            <h2 class="sci-subject-name">${currentSci.name}</h2>
            <div class="sci-subject-role">${currentSci.specialization}</div>

            <div class="sci-badges-row">
              <span class="sci-status-badge ${statusBadgeClass}">● ${currentSci.status}</span>
              ${currentSci.restricted ? '<span class="sci-badge-restricted">RESTRICTED // LVL-7</span>' : ''}
              ${currentSci.contested ? '<span class="sci-badge-contested">CONTESTED RECORD</span>' : ''}
              <span class="sci-badge-code">SYS-ID: ${currentSci.id.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <!-- Narrative Briefing Section -->
        <div class="sci-section-narrative">
          <div class="sci-section-title">
            <span class="sci-section-bullet">■</span>
            <span>DOSSIER BRIEFING & CIRCUMSTANCES</span>
            <span class="sci-section-line"></span>
          </div>
          <p class="sci-narrative-text">${currentSci.narrative}</p>
        </div>

        <!-- 8-Box Tactical Metadata Grid -->
        <div class="sci-section-metrics">
          <div class="sci-section-title">
            <span class="sci-section-bullet">■</span>
            <span>TACTICAL CLASSIFICATION METRICS</span>
            <span class="sci-section-line"></span>
          </div>

          <div class="sci-grid-8box">
            <!-- 1. STATUS -->
            <div class="sci-metric-box">
              <span class="metric-label">STATUS</span>
              <span class="metric-value ${currentSci.status === 'DECEASED' ? 'color-red' : 'color-orange'}">${currentSci.status} (UNEXPLAINED)</span>
            </div>

            <!-- 2. DATE -->
            <div class="sci-metric-box">
              <span class="metric-label">DATE</span>
              <span class="metric-value color-cyan">${currentSci.date}</span>
            </div>

            <!-- 3. LOCATION -->
            <div class="sci-metric-box">
              <span class="metric-label">LOCATION</span>
              <span class="metric-value color-light">${currentSci.location}</span>
            </div>

            <!-- 4. AFFILIATION -->
            <div class="sci-metric-box">
              <span class="metric-label">AFFILIATION</span>
              <span class="metric-value color-cyan">${currentSci.affiliation}</span>
            </div>

            <!-- 5. FIELD -->
            <div class="sci-metric-box">
              <span class="metric-label">FIELD</span>
              <span class="metric-value color-light">${currentSci.field}</span>
            </div>

            <!-- 6. RULING -->
            <div class="sci-metric-box">
              <span class="metric-label">RULING</span>
              <span class="metric-value color-orange">${currentSci.ruling}</span>
            </div>

            <!-- 7. CONTESTED -->
            <div class="sci-metric-box">
              <span class="metric-label">CONTESTED</span>
              <span class="metric-value ${currentSci.contested ? 'color-red' : 'color-green'}">${currentSci.contestedNote}</span>
            </div>

            <!-- 8. FED. REVIEW -->
            <div class="sci-metric-box">
              <span class="metric-label">FED. REVIEW</span>
              <span class="metric-value color-cyan">${currentSci.reviewStatus}</span>
            </div>
          </div>
        </div>

        <!-- Dossier Tactical Footer -->
        <div class="sci-dossier-footer">
          <div class="sci-footer-left">
            <span class="sci-foot-code">COORDINATES: ${currentSci.coordinates}</span>
          </div>
          <div class="sci-footer-right">
            <span class="sci-foot-badge">CLASSIFIED DOSSIER ARCHIVE // PROTOCOL 9-X</span>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // INITIALIZATION & EVENT BINDINGS
  // =========================================================================
  function initScientistModule() {
    // 1. Navigation Tab Buttons
    const tabMap = document.getElementById('tab-map');
    const tabScientists = document.getElementById('tab-scientists');

    if (tabMap) {
      tabMap.addEventListener('click', () => switchPage('map'));
    }
    if (tabScientists) {
      tabScientists.addEventListener('click', () => switchPage('scientists'));
    }

    // 2. Scientist Filter Buttons
    const filterButtons = document.querySelectorAll('.sci-filter-btn');
    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.getAttribute('data-filter') || 'ALL';
        renderScientistView();
      });
    });

    // 3. Search Box Input
    const searchInput = document.getElementById('sci-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderScientistView();
      });
    }

    // 4. Sort Dropdown
    const sortSelect = document.getElementById('sci-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        activeSort = e.target.value;
        renderScientistView();
      });
    }

    // 5. Initialize Counts & View
    updateFilterCounts();
    renderScientistView();
  }

  // Auto-init on DOMContentLoaded or immediate execution
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScientistModule);
  } else {
    initScientistModule();
  }

  // Expose switchPage globally for programmatic control if needed
  window.switchUnknownSignalPage = switchPage;
})();
