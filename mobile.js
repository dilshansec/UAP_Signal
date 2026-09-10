/* Optional mobile dashboard. Remove its script and mobile.css link to uninstall.
   Desktop rendering and the shared datasets/application are left intact. */
(() => {
  'use strict';
  const viewport = window.matchMedia('(max-width: 800px)');
  const desktopPanBounds = zoom.translateExtent();
  const desktopTouchDetection = zoom.touchable();
  let initialized = false;
  let showAll = false;
  const icons = {
    menu: '<path d="M3 5h18M3 12h18M3 19h18"/>',
    map: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/>',
    incidents: '<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/>',
    gallery: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
    radar: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="3"/><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
  function goTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    document.querySelectorAll('.mobile-nav button').forEach(button => {
      button.classList.toggle('is-active', button.dataset.target === id);
    });
  }
  function initialize() {
    if (initialized) return;
    initialized = true;
    const header = document.createElement('header');
    header.className = 'mobile-header mobile-only';
    header.innerHTML = `<button class="mobile-menu-button" aria-label="Open navigation" aria-expanded="false" aria-controls="mobile-menu">${icon('menu')}</button>
      <div class="mobile-brand"><h1 data-text="UNKNOWN-SIGNAL">UNKNOWN-SIGNAL</h1><p>GLOBAL INCIDENT MONITORING</p></div>
      <div class="mobile-system"><span><i></i> SYSTEM ONLINE</span><time></time></div>
      <nav id="mobile-menu" hidden aria-label="Mobile menu"><button data-target="map-area">Global map</button><button data-target="mobile-incidents">Incident log</button><button data-target="mobile-gallery">Gallery media</button></nav>`;
    document.body.prepend(header);
    const menu = header.querySelector('nav');
    const menuButton = header.querySelector('.mobile-menu-button');
    menuButton.addEventListener('click', () => {
      menu.hidden = !menu.hidden;
      menuButton.setAttribute('aria-expanded', String(!menu.hidden));
    });
    menu.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      goTo(button.dataset.target);
      menu.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
    });
    const clock = () => { header.querySelector('time').textContent = new Date().toISOString().slice(11, 16) + ' UTC'; };
    clock();
    setInterval(clock, 30000);

    const section = document.createElement('section');
    section.id = 'mobile-incidents';
    section.className = 'mobile-section mobile-only';
    section.innerHTML = `<div class="mobile-section-heading"><h2>RECENT INCIDENTS</h2><button class="mobile-view-all" aria-expanded="false">VIEW ALL →</button></div>
      <label class="mobile-search" hidden>SEARCH INCIDENTS<input type="search" placeholder="Name, location or status…" aria-label="Search mobile incidents"></label><div class="mobile-incident-list"></div>`;
    const list = section.querySelector('.mobile-incident-list');
    const search = section.querySelector('input');
    const render = () => {
      list.replaceChildren();
      const query = search.value.trim().toLowerCase();
      const matches = VALID_INCIDENTS.filter(inc => [inc.name, inc.location, inc.date, inc.type, inc.status].some(value => String(value).toLowerCase().includes(query)));
      (showAll ? matches : matches.slice(0, 4)).forEach(inc => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'mobile-incident';
        card.style.setProperty('--status-color', getStatusColor(inc.status));
        card.innerHTML = '<span class="mobile-thumb"><img alt="" loading="lazy"><i></i></span><span class="mobile-incident-info"><strong></strong><span class="mobile-date"></span><span class="mobile-location"></span><span class="mobile-type"></span></span><span class="mobile-status"></span><span class="mobile-chevron" aria-hidden="true">›</span>';
        card.querySelector('img').src = inc.image;
        card.querySelector('strong').textContent = inc.name;
        card.querySelector('.mobile-date').textContent = inc.date;
        card.querySelector('.mobile-location').textContent = inc.location;
        card.querySelector('.mobile-type').textContent = inc.type;
        card.querySelector('.mobile-status').textContent = inc.status;
        card.addEventListener('click', () => openDetails(inc.id, card));
        list.append(card);
      });
      if (!list.children.length) list.textContent = 'NO INCIDENTS MATCH YOUR SEARCH';
    };
    section.querySelector('.mobile-view-all').addEventListener('click', event => {
      showAll = !showAll;
      event.currentTarget.textContent = showAll ? 'SHOW LESS ↑' : 'VIEW ALL →';
      event.currentTarget.setAttribute('aria-expanded', String(showAll));
      section.querySelector('label').hidden = !showAll;
      if (!showAll) search.value = '';
      render();
    });
    search.addEventListener('input', render);
    render();
    document.querySelector('.main').append(section);

    const gallery = document.createElement('section');
    gallery.id = 'mobile-gallery';
    gallery.className = 'mobile-section mobile-only';
    gallery.innerHTML = '<div class="mobile-section-heading"><h2>GALLERY MEDIA</h2><span></span></div><div class="mobile-gallery-track"></div>';
    gallery.querySelector('.mobile-section-heading span').textContent = `${GALLERY_DATA.length} PHOTOS →`;
    GALLERY_DATA.forEach(item => {
      const card = document.createElement('button');
      card.className = 'mobile-gallery-card';
      card.innerHTML = '<img loading="lazy" alt=""><strong></strong><span></span>';
      card.querySelector('img').src = item.image;
      card.querySelector('strong').textContent = item.name || item.title;
      card.querySelector('span').textContent = item.date;
      card.addEventListener('click', () => openDetails(item.id, card));
      gallery.querySelector('.mobile-gallery-track').append(card);
    });
    document.querySelector('.main').append(gallery);

    const telemetry = document.createElement('div');
    telemetry.className = 'mobile-telemetry mobile-only';
    telemetry.innerHTML = `<span>${VALID_INCIDENTS.length} INCIDENTS</span><span>SENSORS ONLINE <i></i></span>`;
    section.prepend(telemetry);
    const nav = document.createElement('nav');
    nav.className = 'mobile-nav mobile-only';
    nav.setAttribute('aria-label', 'Dashboard navigation');
    nav.innerHTML = `<button class="mobile-radar" aria-label="Reset map view" data-target="map-area">${icon('radar')}</button>`;
    nav.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.classList.contains('mobile-radar')) document.getElementById('btn-reset').click();
      goTo(button.dataset.target);
    });
    document.body.append(nav);
    initializeMobileLoading();
  }
  function playMobileMapIntro() {
    const map = document.getElementById('map-area');
    if (!map || !viewport.matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const play = () => {
      map.classList.add('mobile-map-boot');
      setTimeout(() => map.classList.remove('mobile-map-boot'), 1300);
    };
    if (map.querySelector('.country')) {
      play();
    } else {
      // Wait for the atlas if sign-in finishes before the geographic data loads.
      const observer = new MutationObserver(() => {
        if (!map.querySelector('.country')) return;
        observer.disconnect();
        if (viewport.matches) play();
      });
      observer.observe(map, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 30000);
    }
  }
  function initializeMobileLoading() {
    const overlay = document.createElement('div');
    overlay.className = 'mobile-loading mobile-only';
    overlay.innerHTML = '<div class="mobile-loading-content" role="status" aria-live="polite"><div class="mobile-loading-radar" aria-hidden="true"></div><h2>UNKNOWN-SIGNAL</h2><p>LOADING GLOBAL INCIDENT MAP</p><div class="mobile-loading-track" aria-hidden="true"><span></span></div><small>ESTABLISHING SENSOR UPLINK</small></div>';
    document.body.append(overlay);
    document.documentElement.classList.add('mobile-loading-pending');
    const background = [...document.body.children].filter(element => element !== overlay && !['SCRIPT', 'LINK'].includes(element.tagName));
    const priorInert = background.map(element => element.inert);
    const syncLock = () => background.forEach((element, index) => { element.inert = viewport.matches || priorInert[index]; });
    viewport.addEventListener('change', syncLock);
    syncLock();
    const map = document.getElementById('map-area');
    let minimumElapsed = false;
    let finished = false;
    const observer = new MutationObserver(checkReady);
    const timeout = setTimeout(finish, 10000);
    function finish() {
      if (finished) return;
      finished = true;
      observer.disconnect();
      clearTimeout(timeout);
      viewport.removeEventListener('change', syncLock);
      background.forEach((element, index) => { element.inert = priorInert[index]; });
      document.documentElement.classList.remove('mobile-loading-pending');
      overlay.remove();
      playMobileMapIntro();
    }
    function checkReady() {
      if (!minimumElapsed) return;
      if (map.querySelector('.country') || map.querySelector('#loading-overlay')?.textContent.includes('MAP DATA LOAD ERROR')) finish();
    }
    observer.observe(map, { childList: true, subtree: true });
    setTimeout(() => { minimumElapsed = true; checkReady(); }, 900);
  }
  function openDetails(id, trigger) {
    openIncidentModal(id);
    const modal = document.getElementById('incident-modal');
    if (!modal || !modal.classList.contains('open')) return;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Incident and media details');
    const close = modal.querySelector('.modal-close-tactical');
    if (!close) return;
    close.setAttribute('aria-label', 'Close details');
    close.focus();
    const keyHandler = event => {
      if (event.key === 'Escape') closeIncidentModal();
      if (event.key === 'Tab') {
        const focusable = [...modal.querySelectorAll('button, a[href]')];
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keyHandler);
    const observer = new MutationObserver(() => {
      if (!modal.classList.contains('open')) {
        document.removeEventListener('keydown', keyHandler);
        observer.disconnect();
        trigger.focus({ preventScroll: true });
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }
  function syncViewport() {
    document.documentElement.classList.toggle('mobile-enabled', viewport.matches);
    // The desktop bounds lock panning at 1x. Give the phone map room to move,
    // and register touch handlers even when responsive mode starts without touch.
    zoom.translateExtent(viewport.matches
      ? [[-width / 2, -height / 2], [width * 1.5, height * 1.5]]
      : desktopPanBounds);
    zoom.touchable(viewport.matches ? () => true : desktopTouchDetection);
    svg.call(zoom);
    const map = document.getElementById('map-area');
    const tooltip = document.getElementById('map-tooltip');
    if (viewport.matches) {
      document.body.classList.remove('entry-active');
      initialize();
      // Keep the shared incident card in the page flow below the mobile map.
      if (map && tooltip) map.after(tooltip);
    } else if (map && tooltip && tooltip.parentElement !== map) {
      // Restore the original overlay location when returning to desktop.
      map.append(tooltip);
    }
  }
  viewport.addEventListener('change', syncViewport);
  syncViewport();
})();
