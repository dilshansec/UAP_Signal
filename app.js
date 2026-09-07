/* ==========================================================================
   UAP World Monitor - Application Engine
   ========================================================================== */

// ── 1. DATA VALIDATION & SANITIZATION ─────────────────────────────────────
function validateIncidents(data) {
  if (!Array.isArray(data)) {
    console.error("[UAP MONITOR ERROR] Incidents dataset is missing or invalid.");
    return [];
  }

  const validIncidents = [];
  data.forEach((inc, index) => {
    if (!inc.id || (!inc.name && !inc.title)) {
      console.warn(`[UAP MONITOR WARNING] Incident at index ${index} missing 'id' or 'title/name'. Skipping.`);
      return;
    }
    if (!Array.isArray(inc.coords) || inc.coords.length < 2 || isNaN(inc.coords[0]) || isNaN(inc.coords[1])) {
      console.warn(`[UAP MONITOR WARNING] Incident '${inc.id}' has invalid coordinates. Skipping.`);
      return;
    }

    // Normalize properties for backwards compatibility
    const normalized = {
      id: String(inc.id),
      name: (inc.name || inc.title).toUpperCase(),
      title: inc.title || inc.name,
      date: inc.date || "UNKNOWN DATE",
      year: inc.year || (inc.date ? parseInt(inc.date.substring(0, 4)) : 2026),
      location: inc.location || "UNKNOWN LOCATION",
      country: inc.country || "",
      coords: [Number(inc.coords[0]), Number(inc.coords[1])],
      status: (inc.status || "UNRESOLVED").toUpperCase(),
      type: (inc.type || inc.category || "UNKNOWN").toUpperCase(),
      description: inc.description || "No description recorded.",
      source: inc.source || "Official Records",
      image: inc.image || (Array.isArray(inc.images) && inc.images[0]) || "images/gallery/3994c5d06c599e8194152b7bd10fd7bc.jpg"
    };

    validIncidents.push(normalized);
  });

  return validIncidents;
}

// ── 2. GLOBAL STATE & DATA INITIALIZATION ──────────────────────────────────
const VALID_INCIDENTS = validateIncidents(typeof INCIDENTS !== 'undefined' ? INCIDENTS : []);
let filteredIncidents = [...VALID_INCIDENTS];
let selectedIncidentId = null;
let connectionsVisible = false;
let currentZoom = 1;

// Status color mapping helper
function getStatusColor(status) {
  switch (status) {
    case 'UNRESOLVED': return '#e8520a';
    case 'CONFIRMED': return '#2aff8a';
    case 'CLASSIFIED': return '#ff4040';
    default: return '#3adfff';
  }
}

// UTC Clock Display
function updateClock() {
  const now = new Date();
  const utcStr = now.toISOString().substring(11, 19) + ' UTC';
  const clockEl = document.getElementById('clock-display');
  if (clockEl) clockEl.textContent = utcStr;
}
setInterval(updateClock, 1000);
updateClock();

// ── 3. D3 WORLD MAP INITIALIZATION ──────────────────────────────────────────
const container = document.getElementById('map-area');
const width = 1000;
const height = 550;

const svg = d3.select('#world-map')
  .attr('viewBox', `0 0 ${width} ${height}`)
  .attr('preserveAspectRatio', 'xMidYMid meet');

const g = svg.append('g').attr('class', 'map-group');

const projection = d3.geoNaturalEarth1()
  .scale(160)
  .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

// Zoom and Pan Behavior
const zoom = d3.zoom()
  .scaleExtent([1, 12])
  .translateExtent([[0, 0], [width, height]])
  .on('zoom', (event) => {
    currentZoom = event.transform.k;
    g.attr('transform', event.transform);
    d3.select('#zoom-lvl').text(`${currentZoom.toFixed(1)}x`);

    const scale = currentZoom;
    g.selectAll('.inc-marker circle.marker-inner').attr('r', 3.5 / Math.sqrt(scale));
    g.selectAll('.inc-marker circle.marker-outer').attr('r', 7 / Math.sqrt(scale)).attr('stroke-width', 1 / scale);
    g.selectAll('.inc-marker circle.marker-pulse').attr('r', 10 / Math.sqrt(scale));

    updateSelectedTooltip();
  });

svg.call(zoom);

// Load TopoJSON Geographic World Data
function loadMapData() {
  d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
    .then(world => {
      document.getElementById('loading-overlay').style.opacity = '0';
      setTimeout(() => {
        document.getElementById('loading-overlay').style.display = 'none';
      }, 400);

      // Ocean Background Sphere
      g.append('path')
        .datum({ type: 'Sphere' })
        .attr('class', 'ocean')
        .attr('d', path);

      // Graticule Grid Lines
      g.append('path')
        .datum(d3.geoGraticule()())
        .attr('class', 'graticule')
        .attr('d', path);

      // Countries Layer
      g.selectAll('.country')
        .data(topojson.feature(world, world.objects.countries).features)
        .enter()
        .append('path')
        .attr('class', 'country')
        .attr('d', path);

      // Country Borders Layer
      g.append('path')
        .datum(topojson.mesh(world, world.objects.countries, (a, b) => a !== b))
        .attr('class', 'country-borders')
        .attr('d', path);

      g.append('g').attr('class', 'connection-lines-layer');
      g.append('g').attr('class', 'markers-layer');

      renderMarkers();
    })
    .catch(err => {
      console.error("[UAP MONITOR] Failed to load world map atlas:", err);
      document.getElementById('loading-overlay').innerHTML = `
        <div class="ld-text" style="color: #ff4040">MAP DATA LOAD ERROR</div>
        <div class="ld-sub">CHECK NETWORK CONNECTION OR STATIC HOSTING</div>
      `;
    });
}

// ── 4. RENDER INCIDENT MARKERS & RADAR CONNECTIVITY ────────────────────────
function renderMarkers() {
  const layer = g.select('.markers-layer');
  if (layer.empty()) return;
  layer.selectAll('*').remove();

  filteredIncidents.forEach(inc => {
    const pos = projection([inc.coords[1], inc.coords[0]]);
    if (!pos) return;

    const color = getStatusColor(inc.status);
    const isSelected = inc.id === selectedIncidentId;
    const scale = currentZoom;

    const mG = layer.append('g')
      .attr('class', `inc-marker ${isSelected ? 'selected' : ''}`)
      .attr('transform', `translate(${pos[0]}, ${pos[1]})`)
      .on('mouseenter', () => {
        showHoverTooltip(inc);
      })
      .on('mouseleave', () => {
        hideHoverTooltip();
      })
      .on('click', (e) => {
        e.stopPropagation();
        selectIncident(inc.id);
      });

    // Generous invisible hit-target circle so entire outer area catches mouse events
    mG.append('circle')
      .attr('class', 'marker-hit')
      .attr('r', 12 / Math.sqrt(scale))
      .attr('fill', 'rgba(0, 0, 0, 0.001)')
      .attr('pointer-events', 'all')
      .style('cursor', 'pointer');

    if (isSelected) {
      mG.append('circle')
        .attr('class', 'marker-pulse')
        .attr('r', 12 / Math.sqrt(scale))
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1 / scale)
        .attr('opacity', 0.6);
    }

    mG.append('circle')
      .attr('class', 'marker-outer')
      .attr('r', (isSelected ? 7 : 5) / Math.sqrt(scale))
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', (isSelected ? 1.5 : 1) / scale);

    mG.append('circle')
      .attr('class', 'marker-inner')
      .attr('r', 3 / Math.sqrt(scale))
      .attr('fill', color);
  });

  if (connectionsVisible) drawConnections();
}

function drawConnections() {
  const layer = g.select('.connection-lines-layer');
  if (layer.empty()) return;
  layer.selectAll('*').remove();

  if (!connectionsVisible || filteredIncidents.length < 2) return;

  const sorted = [...filteredIncidents].sort((a, b) => new Date(a.date) - new Date(b.date));
  let pathStr = '';

  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = projection([sorted[i].coords[1], sorted[i].coords[0]]);
    const p2 = projection([sorted[i + 1].coords[1], sorted[i + 1].coords[0]]);
    if (p1 && p2) {
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const dr = Math.sqrt(dx * dx + dy * dy) * 1.2;
      pathStr += `M${p1[0]},${p1[1]}A${dr},${dr} 0 0,1 ${p2[0]},${p2[1]} `;
    }
  }

  layer.append('path').attr('d', pathStr);
}

// Coordinates display on map hover
svg.on('mousemove', (event) => {
  const [mx, my] = d3.pointer(event, svg.node());
  const transform = d3.zoomTransform(svg.node());
  const [gx, gy] = transform.invert([mx, my]);
  const coords = projection.invert([gx, gy]);

  if (coords) {
    const latStr = (coords[1] >= 0 ? 'N ' : 'S ') + Math.abs(coords[1]).toFixed(3) + '°';
    const lngStr = (coords[0] >= 0 ? 'E ' : 'W ') + Math.abs(coords[0]).toFixed(3) + '°';
    const coordsEl = document.getElementById('coords-display');
    if (coordsEl) coordsEl.textContent = `LAT: ${latStr} | LNG: ${lngStr}`;
  }
});

// ── 5. MAP TOOLTIP ON HOVER & PINNED ON INCIDENT ZOOM ───────────────────────
function showHoverTooltip(inc) {
  const tooltip = document.getElementById('map-tooltip');
  if (!tooltip || !inc) return;

  const pos = projection([inc.coords[1], inc.coords[0]]);
  if (!pos) return;

  const transform = d3.zoomTransform(svg.node());
  const screenX = pos[0] * transform.k + transform.x;
  const screenY = pos[1] * transform.k + transform.y;

  const rect = container.getBoundingClientRect();
  const tooltipWidth = 230;
  const tooltipHeight = 190;

  let left = screenX + 16;
  let top = screenY - 20;

  if (left + tooltipWidth > rect.width - 10) {
    left = screenX - tooltipWidth - 16;
  }
  if (top + tooltipHeight > rect.height - 10) {
    top = screenY - tooltipHeight - 16;
  }

  tooltip.style.left = `${Math.max(10, left)}px`;
  tooltip.style.top = `${Math.max(10, top)}px`;
  tooltip.style.display = 'block';

  const color = getStatusColor(inc.status);
  const imgPath = inc.image || 'images/gallery/3994c5d06c599e8194152b7bd10fd7bc.jpg';

  tooltip.innerHTML = `
    <img src="${imgPath}" class="map-tooltip-img" alt="${inc.name}" onerror="this.onerror=null; this.src='images/gallery/3994c5d06c599e8194152b7bd10fd7bc.jpg'">
    <div style="font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: #ff6b1a; line-height: 1.2;">${inc.name}</div>
    <div style="color: #a0c8d8; font-size: 11px; margin-top: 3px; font-weight: 500;">${inc.location}</div>
    <div style="color: ${color}; font-size: 10px; font-weight: 600; margin-top: 4px; letter-spacing: 0.5px;">STATUS: ${inc.status} (${inc.date})</div>
    <button class="btn-see-more" onclick="openIncidentModal('${inc.id}')">SEE MORE</button>
  `;
}

function hideHoverTooltip() {
  if (selectedIncidentId) {
    updateSelectedTooltip();
  } else {
    const tooltip = document.getElementById('map-tooltip');
    if (tooltip) tooltip.style.display = 'none';
  }
}

function updateSelectedTooltip() {
  const tooltip = document.getElementById('map-tooltip');
  if (!tooltip) return;

  if (!selectedIncidentId) {
    tooltip.style.display = 'none';
    return;
  }

  const inc = VALID_INCIDENTS.find(i => i.id === selectedIncidentId);
  if (!inc) {
    tooltip.style.display = 'none';
    return;
  }

  const pos = projection([inc.coords[1], inc.coords[0]]);
  if (!pos) return;

  const transform = d3.zoomTransform(svg.node());
  const screenX = pos[0] * transform.k + transform.x;
  const screenY = pos[1] * transform.k + transform.y;

  const rect = container.getBoundingClientRect();
  const tooltipWidth = 230;
  const tooltipHeight = 190;

  let left = screenX + 16;
  let top = screenY - 20;

  if (left + tooltipWidth > rect.width - 10) {
    left = screenX - tooltipWidth - 16;
  }
  if (top + tooltipHeight > rect.height - 10) {
    top = screenY - tooltipHeight - 16;
  }

  tooltip.style.left = `${Math.max(10, left)}px`;
  tooltip.style.top = `${Math.max(10, top)}px`;
  tooltip.style.display = 'block';

  const color = getStatusColor(inc.status);
  const imgPath = inc.image || 'images/gallery/3994c5d06c599e8194152b7bd10fd7bc.jpg';

  tooltip.innerHTML = `
    <img src="${imgPath}" class="map-tooltip-img" alt="${inc.name}" onerror="this.onerror=null; this.src='images/gallery/3994c5d06c599e8194152b7bd10fd7bc.jpg'">
    <div style="font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: #ff6b1a; line-height: 1.2;">${inc.name}</div>
    <div style="color: #a0c8d8; font-size: 11px; margin-top: 3px; font-weight: 500;">${inc.location}</div>
    <div style="color: ${color}; font-size: 10px; font-weight: 600; margin-top: 4px; letter-spacing: 0.5px;">STATUS: ${inc.status} (${inc.date})</div>
    <button class="btn-see-more" onclick="openIncidentModal('${inc.id}')">SEE MORE</button>
  `;
}

// ── 6. LEFT INCIDENT LOG LIST & SEARCH ──────────────────────────────────────
function renderIncidentList() {
  const listEl = document.getElementById('incident-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  const statTotal = document.getElementById('stat-total');
  if (statTotal) statTotal.textContent = filteredIncidents.length;

  const filterCount = document.getElementById('filter-count');
  if (filterCount) filterCount.textContent = filteredIncidents.length === VALID_INCIDENTS.length ? 'ALL' : `${filteredIncidents.length} MATCH`;

  const countDisplay = document.getElementById('count-display');
  if (countDisplay) countDisplay.textContent = `${filteredIncidents.length} INCIDENTS`;

  if (filteredIncidents.length === 0) {
    listEl.innerHTML = '<div style="padding: 16px; font-size: 11px; color: #3a6060; text-align: center;">NO INCIDENTS MATCH SEARCH</div>';
    return;
  }

  filteredIncidents.forEach(inc => {
    const item = document.createElement('div');
    item.className = `incident-item ${inc.id === selectedIncidentId ? 'active' : ''}`;
    const color = getStatusColor(inc.status);

    item.innerHTML = `
      <div class="inc-name">${inc.name}</div>
      <div class="inc-meta">
        <span>${inc.date}</span>
        <span style="color: ${color}">${inc.status}</span>
      </div>
      <div class="inc-desc">${inc.location} • ${inc.type}</div>
    `;

    item.addEventListener('click', () => selectIncident(inc.id));
    listEl.appendChild(item);
  });
}

// Search Filter Input
const searchInput = document.getElementById('search-input');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      filteredIncidents = [...VALID_INCIDENTS];
    } else {
      filteredIncidents = VALID_INCIDENTS.filter(inc => 
        inc.name.toLowerCase().includes(q) ||
        inc.location.toLowerCase().includes(q) ||
        inc.type.toLowerCase().includes(q) ||
        inc.status.toLowerCase().includes(q) ||
        inc.date.includes(q) ||
        inc.description.toLowerCase().includes(q)
      );
    }
    renderIncidentList();
    renderMarkers();
  });
}

// Select incident & zoom map to dot
function selectIncident(id) {
  selectedIncidentId = id;
  renderIncidentList();
  renderMarkers();

  const inc = VALID_INCIDENTS.find(i => i.id === id);
  if (!inc) {
    const tooltip = document.getElementById('map-tooltip');
    if (tooltip) tooltip.style.display = 'none';
    return;
  }

  const pos = projection([inc.coords[1], inc.coords[0]]);
  if (pos) {
    const targetZoom = Math.max(currentZoom, 3.8);
    const x = width / 2 - pos[0] * targetZoom;
    const y = height / 2 - pos[1] * targetZoom;

    svg.transition().duration(750)
      .call(
        zoom.transform,
        d3.zoomIdentity.translate(x, y).scale(targetZoom)
      )
      .on('end', () => {
        updateSelectedTooltip();
      });

    updateSelectedTooltip();
  }
}

// ── 7. VERTICAL INFINITE COVERFLOW GALLERY CAROUSEL ────────────────────────
let galleryScrollIndex = 0;
const GALLERY_DATA = (typeof GALLERY_IMAGES !== 'undefined' && Array.isArray(GALLERY_IMAGES) && GALLERY_IMAGES.length > 0)
  ? GALLERY_IMAGES
  : VALID_INCIDENTS;

function initCarousel() {
  const track = document.getElementById('carousel-track');
  if (!track) return;
  track.innerHTML = '';

  const countEl = document.getElementById('gallery-count');
  if (countEl) countEl.textContent = `${GALLERY_DATA.length} PHOTOS`;

  GALLERY_DATA.forEach((itemData, index) => {
    const item = document.createElement('div');
    item.className = 'carousel-item small-card';
    item.dataset.index = index;
    const color = getStatusColor(itemData.status || 'CONFIRMED');
    const imgPath = itemData.image || 'images/gallery/3994c5d06c599e8194152b7bd10fd7bc.jpg';

    item.innerHTML = `
      <img src="${imgPath}" class="carousel-item-img" alt="${itemData.title || itemData.name}" onerror="this.onerror=null; this.src='images/gallery/3994c5d06c599e8194152b7bd10fd7bc.jpg'">
      <div class="carousel-item-badge">
        <div class="carousel-badge-title">${itemData.title || itemData.name}</div>
        <div class="carousel-badge-meta">
          <span>${itemData.date || ''}</span>
          <span style="color: ${color}; font-weight: 600;">${itemData.status || 'CONFIRMED'}</span>
        </div>
      </div>
      <div class="carousel-item-side-bar"></div>
    `;

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (galleryScrollIndex === index && itemData.id) {
        openIncidentModal(itemData.id);
      } else {
        galleryScrollIndex = index;
        updateCarouselLayout();
      }
    });

    track.appendChild(item);
  });

  updateCarouselLayout();
}

function updateCarouselLayout() {
  const track = document.getElementById('carousel-track');
  const viewport = document.getElementById('carousel-viewport');
  if (!track || !viewport) return;

  const items = track.querySelectorAll('.carousel-item');
  const total = items.length;
  if (!total) return;

  galleryScrollIndex = (galleryScrollIndex % total + total) % total;

  items.forEach((item, index) => {
    let diff = index - galleryScrollIndex;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;

    const absDiff = Math.abs(diff);
    item.classList.remove('big-card', 'medium-card', 'small-card', 'faint-card', 'hidden-card');
    item.style.order = diff;

    if (absDiff === 0) {
      item.classList.add('big-card');
    } else if (absDiff === 1) {
      item.classList.add('medium-card');
    } else if (absDiff === 2) {
      item.classList.add('small-card');
    } else if (absDiff === 3) {
      item.classList.add('faint-card');
    } else {
      item.classList.add('hidden-card');
    }
  });

  const gap = 12;
  const offsetAbove = (44 + gap) + (56 + gap) + (72 + gap); // 208px
  const activeHeight = 140;
  const activeCenterY = offsetAbove + activeHeight / 2; // 278px
  const viewportHeight = viewport.clientHeight || 450;
  const translateY = (viewportHeight / 2) - activeCenterY;

  track.style.transform = `translateY(${translateY}px)`;
}

window.addEventListener('resize', updateCarouselLayout);
window.addEventListener('load', updateCarouselLayout);

// Carousel Up / Down Buttons
const btnUp = document.getElementById('btn-carousel-up');
if (btnUp) {
  btnUp.addEventListener('click', () => {
    galleryScrollIndex = (galleryScrollIndex - 1 + GALLERY_DATA.length) % GALLERY_DATA.length;
    updateCarouselLayout();
  });
}

const btnDown = document.getElementById('btn-carousel-down');
if (btnDown) {
  btnDown.addEventListener('click', () => {
    galleryScrollIndex = (galleryScrollIndex + 1) % GALLERY_DATA.length;
    updateCarouselLayout();
  });
}

// Carousel Mousewheel Event with Cooldown Throttle
let wheelCooldown = false;
const viewportEl = document.getElementById('carousel-viewport');
if (viewportEl) {
  viewportEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (wheelCooldown) return;

    if (e.deltaY > 0) {
      galleryScrollIndex = (galleryScrollIndex + 1) % GALLERY_DATA.length;
      updateCarouselLayout();
    } else if (e.deltaY < 0) {
      galleryScrollIndex = (galleryScrollIndex - 1 + GALLERY_DATA.length) % GALLERY_DATA.length;
      updateCarouselLayout();
    }

    wheelCooldown = true;
    setTimeout(() => { wheelCooldown = false; }, 160);
  }, { passive: false });
}

// ── 8. TOOLBAR BUTTONS (RADAR LINES & TIMELINE MODAL) ──────────────────────
const btnTools = document.getElementById('btn-tools');
if (btnTools) {
  btnTools.addEventListener('click', (e) => {
    e.stopPropagation();
    connectionsVisible = !connectionsVisible;
    if (connectionsVisible) {
      btnTools.classList.add('active');
      drawConnections();
    } else {
      btnTools.classList.remove('active');
      const layer = g.select('.connection-lines-layer');
      if (!layer.empty()) layer.selectAll('*').remove();
    }
  });
}

// Zoom Toolbar Buttons
const btnZoomIn = document.getElementById('btn-zoom-in');
if (btnZoomIn) {
  btnZoomIn.addEventListener('click', () => {
    svg.transition().duration(300).call(zoom.scaleBy, 1.4);
  });
}

const btnZoomOut = document.getElementById('btn-zoom-out');
if (btnZoomOut) {
  btnZoomOut.addEventListener('click', () => {
    svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.4);
  });
}

const btnReset = document.getElementById('btn-reset');
if (btnReset) {
  btnReset.addEventListener('click', () => {
    selectedIncidentId = null;
    const tooltip = document.getElementById('map-tooltip');
    if (tooltip) tooltip.style.display = 'none';
    renderIncidentList();
    renderMarkers();
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
  });
}

// Timeline Modal Controls
const btnTimeline = document.getElementById('btn-timeline');
const timelinePopup = document.getElementById('timeline-popup');
const timelineClose = document.getElementById('timeline-close');

if (btnTimeline && timelinePopup) {
  btnTimeline.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = timelinePopup.classList.contains('open');
    if (isOpen) {
      timelinePopup.classList.remove('open');
      btnTimeline.classList.remove('active');
    } else {
      timelinePopup.classList.add('open');
      btnTimeline.classList.add('active');
      renderTimelineChart();
    }
  });
}

if (timelineClose && timelinePopup) {
  timelineClose.addEventListener('click', () => {
    timelinePopup.classList.remove('open');
    if (btnTimeline) btnTimeline.classList.remove('active');
  });
}

if (timelinePopup) {
  timelinePopup.addEventListener('click', (e) => {
    if (e.target === timelinePopup) {
      timelinePopup.classList.remove('open');
      if (btnTimeline) btnTimeline.classList.remove('active');
    }
  });
}

// ── 9. D3 TIMELINE LINE CHART MODAL ─────────────────────────────────────────
function renderTimelineChart() {
  const wrap = d3.select('#timeline-svg-wrap');
  if (wrap.empty()) return;
  wrap.selectAll('*').remove();

  const chartW = Math.max(700, wrap.node().clientWidth || 760);
  const chartH = 250;
  const margin = { top: 30, right: 30, bottom: 45, left: 55 };

  const chartSvg = wrap.append('svg')
    .attr('width', chartW)
    .attr('height', chartH);

  // Group incident count by year (1945 - 2026)
  const minYear = 1945;
  const maxYear = 2026;
  const yearCounts = {};
  for (let y = minYear; y <= maxYear; y++) yearCounts[y] = 0;

  VALID_INCIDENTS.forEach(inc => {
    if (inc.year >= minYear && inc.year <= maxYear) {
      yearCounts[inc.year] = (yearCounts[inc.year] || 0) + 1;
    }
  });

  const yearlyData = Object.keys(yearCounts).map(y => ({
    year: Number(y),
    count: yearCounts[y]
  }));

  const maxCount = Math.max(4, d3.max(yearlyData, d => d.count));

  const xScale = d3.scaleLinear()
    .domain([minYear, maxYear])
    .range([margin.left, chartW - margin.right]);

  const yScale = d3.scaleLinear()
    .domain([0, maxCount + 1])
    .range([chartH - margin.bottom, margin.top]);

  // Gridlines
  chartSvg.append('g')
    .attr('class', 'chart-grid')
    .attr('transform', `translate(0, ${chartH - margin.bottom})`)
    .call(d3.axisBottom(xScale).ticks(10).tickSize(-(chartH - margin.top - margin.bottom)).tickFormat(''))
    .selectAll('line')
    .attr('stroke', '#0f2030')
    .attr('stroke-dasharray', '2,2');

  chartSvg.append('g')
    .attr('class', 'chart-grid')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(yScale).ticks(maxCount + 1).tickSize(-(chartW - margin.left - margin.right)).tickFormat(''))
    .selectAll('line')
    .attr('stroke', '#0f2030')
    .attr('stroke-dasharray', '2,2');

  // Axes
  const xAxis = d3.axisBottom(xScale)
    .ticks(12)
    .tickFormat(d3.format('d'));

  const yAxis = d3.axisLeft(yScale)
    .ticks(maxCount + 1)
    .tickFormat(d3.format('d'));

  const gx = chartSvg.append('g')
    .attr('transform', `translate(0, ${chartH - margin.bottom})`)
    .call(xAxis);

  gx.selectAll('text')
    .attr('fill', '#7fa4b4')
    .attr('font-size', '10px')
    .attr('font-weight', '500');

  gx.selectAll('path, line')
    .attr('stroke', '#1e384e');

  const gy = chartSvg.append('g')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(yAxis);

  gy.selectAll('text')
    .attr('fill', '#7fa4b4')
    .attr('font-size', '10px')
    .attr('font-weight', '500');

  gy.selectAll('path, line')
    .attr('stroke', '#1e384e');

  // Y-Axis Title Label
  chartSvg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(chartH / 2))
    .attr('y', 18)
    .attr('fill', '#e8520a')
    .attr('font-family', 'Orbitron, sans-serif')
    .attr('font-size', '11px')
    .attr('font-weight', 'bold')
    .attr('text-anchor', 'middle')
    .text('Number of Incidents');

  // Straight Point-to-Point Line Generator
  const lineGenerator = d3.line()
    .x(d => xScale(d.year))
    .y(d => yScale(d.count))
    .curve(d3.curveLinear);

  chartSvg.append('path')
    .datum(yearlyData)
    .attr('fill', 'none')
    .attr('stroke', '#e8520a')
    .attr('stroke-width', 2.5)
    .attr('d', lineGenerator);

  // Square Markers
  yearlyData.filter(d => d.count > 0).forEach(d => {
    const cx = xScale(d.year);
    const cy = yScale(d.count);
    const incidentsInYear = VALID_INCIDENTS.filter(i => i.year === d.year);
    const incNames = incidentsInYear.map(i => `• ${i.name} (${i.status})`).join('\n');

    const size = 8;
    const square = chartSvg.append('rect')
      .attr('x', cx - size / 2)
      .attr('y', cy - size / 2)
      .attr('width', size)
      .attr('height', size)
      .attr('fill', '#2aff8a')
      .attr('stroke', '#050810')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer');

    square.on('click', () => {
      if (incidentsInYear.length > 0) {
        selectIncident(incidentsInYear[0].id);
        timelinePopup.classList.remove('open');
        if (btnTimeline) btnTimeline.classList.remove('active');
      }
    });

    square.append('title')
      .text(`Year: ${d.year}\nNumber of Incidents: ${d.count}\n${incNames}\n(Click to locate on map)`);
  });

  // Summary statistics
  const unresolved = VALID_INCIDENTS.filter(i => i.status === 'UNRESOLVED').length;
  const confirmed = VALID_INCIDENTS.filter(i => i.status === 'CONFIRMED').length;
  const classified = VALID_INCIDENTS.filter(i => i.status === 'CLASSIFIED').length;

  const statsEl = document.getElementById('timeline-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div>TOTAL INCIDENTS: <span>${VALID_INCIDENTS.length}</span></div>
      <div>TIME SPAN: <span>1945 - 2026</span></div>
      <div>UNRESOLVED: <span style="color: #e8520a">${unresolved}</span></div>
      <div>CONFIRMED: <span style="color: #2aff8a">${confirmed}</span></div>
      <div>CLASSIFIED: <span style="color: #ff4040">${classified}</span></div>
    `;
  }
}

// ── 10. INCIDENT DETAIL MODAL (TACTICAL FBI-STYLE) ───────────────────────────
function openIncidentModal(id) {
  const inc = VALID_INCIDENTS.find(i => i.id === id) || (typeof GALLERY_DATA !== 'undefined' ? GALLERY_DATA.find(g => g.id === id) : null);
  if (!inc) return;

  const modal = document.getElementById('incident-modal');
  const box = modal.querySelector('.modal-box');
  if (!modal || !box) return;

  const color = getStatusColor(inc.status || 'CONFIRMED');
  const imgPath = inc.image || 'images/gallery/3994c5d06c599e8194152b7bd10fd7bc.jpg';
  const nameStr = (inc.name || inc.title || 'GALLERY ASSET').toUpperCase();
  const dateStr = inc.date || 'UNKNOWN DATE';
  const yearStr = inc.year || (inc.date ? inc.date.substring(0, 4) : '2026');
  const locStr = inc.location ? inc.location.toUpperCase() : 'GALLERY ARCHIVE';
  const typeStr = (inc.type || 'MEDIA ASSET').toUpperCase();
  const sourceStr = (inc.source || 'UNKNOWN-SIGNAL ARCHIVE').toUpperCase();
  const titleHeader = `\\\\ ${inc.id.toUpperCase()}, DIGITAL RENDERING, "${nameStr}," ${yearStr}`;

  box.innerHTML = `
    <div class="modal-header-tactical">
      <div class="modal-title-tactical">${titleHeader}</div>
      <button class="modal-close-tactical" onclick="closeIncidentModal()">x</button>
    </div>
    <div class="modal-body-grid">
      <div class="modal-left-col">
        <div class="modal-desc-tactical">${inc.description || 'No description recorded.'}</div>
        <a href="${imgPath}" download class="btn-download-image" target="_blank">&gt; DOWNLOAD IMAGE</a>
        <div class="meta-table-tactical">
          <div class="meta-row-tactical">
            <span class="meta-label-tactical">ASSET FILE NAME</span>
            <span class="meta-val-tactical">[${nameStr}]</span>
          </div>
          <div class="meta-row-tactical">
            <span class="meta-label-tactical">RELEASE STATUS</span>
            <span class="meta-val-tactical" style="color: ${color}; font-weight: bold;">[${(inc.status || 'CONFIRMED').toUpperCase()}]</span>
          </div>
          <div class="meta-row-tactical">
            <span class="meta-label-tactical">INCIDENT DATE</span>
            <span class="meta-val-tactical">[${dateStr}]</span>
          </div>
          <div class="meta-row-tactical">
            <span class="meta-label-tactical">INCIDENT LOCATION</span>
            <span class="meta-val-tactical">[${locStr}]</span>
          </div>
          <div class="meta-row-tactical">
            <span class="meta-label-tactical">OBJECT TYPE</span>
            <span class="meta-val-tactical">[${typeStr}]</span>
          </div>
          <div class="meta-row-tactical">
            <span class="meta-label-tactical">PRIMARY SOURCE</span>
            <span class="meta-val-tactical">[${sourceStr}]</span>
          </div>
        </div>
      </div>
      <div class="modal-right-col">
        <div class="modal-img-container">
          <img src="${imgPath}" class="modal-img-tactical" alt="${nameStr}" onerror="this.onerror=null; this.src='images/gallery/3994c5d06c599e8194152b7bd10fd7bc.jpg'">
        </div>
      </div>
    </div>
  `;

  modal.classList.add('open');
}

function closeIncidentModal() {
  const modal = document.getElementById('incident-modal');
  if (modal) modal.classList.remove('open');
}

const incidentModal = document.getElementById('incident-modal');
if (incidentModal) {
  incidentModal.addEventListener('click', (e) => {
    if (e.target === incidentModal) closeIncidentModal();
  });
}

// ── 11. APPLICATION INITIALIZATION ─────────────────────────────────────────
renderIncidentList();
initCarousel();
loadMapData();
