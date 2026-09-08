/* ==========================================================================
   UAP World Monitor - Application Engine
   ========================================================================== */

// ── 1. DATA VALIDATION & SANITIZATION ─────────────────────────────────────
function validateIncidents(data) {
  if (!Array.isArray(data)) {
    console.warn("[UAP MONITOR] Incidents dataset is missing or not an array. Initializing empty.");
    return [];
  }

  const validIncidents = [];
  data.forEach((inc, index) => {
    if (!inc || typeof inc !== 'object') return;

    // Flexible ID generation
    const genId = inc.id ? String(inc.id) : ('uap-user-' + (index + 1));
    const titleStr = inc.title || inc.name || `INCIDENT ARCHIVE #${index + 1}`;
    const nameStr = (inc.name || inc.title || titleStr).toUpperCase();

    // Flexible coordinate parsing
    let lat = 0;
    let lng = 0;
    let coordsValid = false;

    if (Array.isArray(inc.coords) && inc.coords.length >= 2) {
      const parsedLat = parseFloat(inc.coords[0]);
      const parsedLng = parseFloat(inc.coords[1]);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        lat = parsedLat;
        lng = parsedLng;
        coordsValid = true;
      }
    }

    if (!coordsValid) {
      lat = 20.0;
      lng = 0.0;
      console.warn(`[UAP MONITOR] Incident '${genId}' coordinates missing or invalid. Using default [20, 0].`);
    }

    // Safe status parsing
    let rawStatus = String(inc.status || inc.category || "UNRESOLVED").trim().toUpperCase();
    if (rawStatus !== 'CONFIRMED' && rawStatus !== 'CLASSIFIED') {
      rawStatus = 'UNRESOLVED';
    }

    // Safe year parsing
    let parsedYear = 2026;
    if (inc.year && !isNaN(parseInt(inc.year, 10))) {
      parsedYear = parseInt(inc.year, 10);
    } else if (inc.date && String(inc.date).length >= 4) {
      const yr = parseInt(String(inc.date).substring(0, 4), 10);
      if (!isNaN(yr)) parsedYear = yr;
    }

    // Normalize properties for backwards and forwards compatibility
    const normalized = {
      id: genId,
      name: nameStr,
      title: titleStr,
      date: inc.date || "UNKNOWN DATE",
      year: parsedYear,
      location: inc.location || "UNKNOWN LOCATION",
      country: inc.country || "",
      coords: [lat, lng],
      status: rawStatus,
      type: (inc.type || inc.category || "UNIDENTIFIED AERIAL PHENOMENON").toUpperCase(),
      description: inc.description || "No description recorded.",
      source: inc.source || "Official Records",
      image: inc.image || (Array.isArray(inc.images) && inc.images[0]) || "images/gallery/3994c5d06c599e8194152b7bd10fd7bc.jpg"
    };

    validIncidents.push(normalized);
  });

  return validIncidents;
}

// ── 2. GLOBAL STATE & DATA INITIALIZATION ──────────────────────────────────
// Support both edits_incident_log.js (Primary) and data/incidents.js (Legacy fallback)
const rawIncidents = (typeof EDITS_INCIDENT_LOG !== 'undefined' && Array.isArray(EDITS_INCIDENT_LOG))
  ? EDITS_INCIDENT_LOG
  : (typeof INCIDENTS !== 'undefined' && Array.isArray(INCIDENTS) ? INCIDENTS : []);

const VALID_INCIDENTS = validateIncidents(rawIncidents);
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
  const utcStr = now.toISOString().substring(11, 16) + ' UTC';
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
    g.selectAll('.inc-marker circle.marker-hit')
      .attr('r', (d, i, nodes) => {
        const isSel = nodes[i].parentNode && nodes[i].parentNode.classList.contains('selected');
        return (isSel ? 7 : 5) / Math.sqrt(scale);
      });
    g.selectAll('.inc-marker circle.marker-inner').attr('r', 3 / Math.sqrt(scale));
    g.selectAll('.inc-marker circle.marker-outer')
      .attr('r', (d, i, nodes) => {
        const isSel = nodes[i].parentNode && nodes[i].parentNode.classList.contains('selected');
        return (isSel ? 7 : 5) / Math.sqrt(scale);
      })
      .attr('stroke-width', (d, i, nodes) => {
        const isSel = nodes[i].parentNode && nodes[i].parentNode.classList.contains('selected');
        return (isSel ? 1.5 : 1) / scale;
      });
    g.selectAll('.inc-marker circle.marker-pulse')
      .attr('r', 12 / Math.sqrt(scale))
      .attr('stroke-width', 1 / scale);

    if (currentHoveredIncId) {
      const hInc = VALID_INCIDENTS.find(i => i.id === currentHoveredIncId);
      if (hInc) positionTooltip(hInc, false);
    } else if (selectedIncidentId) {
      const sInc = VALID_INCIDENTS.find(i => i.id === selectedIncidentId);
      if (sInc) positionTooltip(sInc, true);
    }
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
      .attr('data-id', inc.id)
      .on('mouseenter', () => {
        onMarkerMouseEnter(inc);
      })
      .on('mouseleave', () => {
        onMarkerMouseLeave(inc);
      })
      .on('click', (e) => {
        e.stopPropagation();
        selectIncident(inc.id);
      });

    // 1. Invisible hit-target circle matching the location dot boundary
    mG.append('circle')
      .attr('class', 'marker-hit')
      .attr('r', (isSelected ? 7 : 5) / Math.sqrt(scale))
      .attr('fill', 'rgba(0, 0, 0, 0.001)')
      .attr('stroke', 'transparent')
      .attr('pointer-events', 'all')
      .style('cursor', 'pointer');

    // 2. Pulse indicator (only if selected, non-interactive)
    if (isSelected) {
      mG.append('circle')
        .attr('class', 'marker-pulse')
        .attr('r', 12 / Math.sqrt(scale))
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1 / scale)
        .attr('opacity', 0.6)
        .attr('pointer-events', 'none');
    }

    // 3. Outer ring (visible dot outline, non-interactive)
    mG.append('circle')
      .attr('class', 'marker-outer')
      .attr('r', (isSelected ? 7 : 5) / Math.sqrt(scale))
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', (isSelected ? 1.5 : 1) / scale)
      .attr('pointer-events', 'none');

    // 4. Center core dot (visible color center, non-interactive)
    mG.append('circle')
      .attr('class', 'marker-inner')
      .attr('r', 3 / Math.sqrt(scale))
      .attr('fill', color)
      .attr('pointer-events', 'none');
  });

  if (connectionsVisible) drawConnections();
}

function drawConnections() {
  const layer = g.select('.connection-lines-layer');
  if (layer.empty()) return;
  layer.selectAll('*').remove();

  if (!connectionsVisible || filteredIncidents.length < 2) return;

  const sorted = [...filteredIncidents].sort((a, b) => {
    const timeA = (a.date && !isNaN(new Date(a.date).getTime())) ? new Date(a.date).getTime() : ((a.year || 2000) * 31536000000);
    const timeB = (b.date && !isNaN(new Date(b.date).getTime())) ? new Date(b.date).getTime() : ((b.year || 2000) * 31536000000);
    return timeA - timeB;
  });

  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = projection([sorted[i].coords[1], sorted[i].coords[0]]);
    const p2 = projection([sorted[i + 1].coords[1], sorted[i + 1].coords[0]]);
    if (!p1 || !p2) continue;

    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) continue;

    const mx = (p1[0] + p2[0]) / 2;
    const my = (p1[1] + p2[1]) / 2;

    let nx = -dy / dist;
    let ny = dx / dist;

    // Bow upward towards north (negative SVG y)
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    } else if (Math.abs(ny) < 0.15) {
      nx = (i % 2 === 0 ? 0.75 : -0.75);
      ny = -0.35;
    }

    // Dynamic curve height: shallow for short distances, smooth high arc for long distances
    const arcHeight = Math.min(Math.max(dist * 0.18, 5), 110);
    const variation = 0.92 + ((i % 4) * 0.05); // subtle variation to prevent overlapping
    const curveOffset = arcHeight * variation;

    const cx = mx + nx * curveOffset;
    const cy = my + ny * curveOffset;

    const d = `M ${p1[0].toFixed(1)},${p1[1].toFixed(1)} Q ${cx.toFixed(1)},${cy.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;

    layer.append('path')
      .attr('class', 'connection-path')
      .attr('d', d);
  }
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
let hoverShowTimer = null;
let hoverHideTimer = null;
let currentHoveredIncId = null;

function onMarkerMouseEnter(inc) {
  if (hoverHideTimer) {
    clearTimeout(hoverHideTimer);
    hoverHideTimer = null;
  }

  currentHoveredIncId = inc.id;
  positionTooltip(inc, false);
}

function onMarkerMouseLeave(inc) {
  if (hoverHideTimer) {
    clearTimeout(hoverHideTimer);
    hoverHideTimer = null;
  }

  hoverHideTimer = setTimeout(() => {
    currentHoveredIncId = null;
    hideHoverTooltip();
  }, 50);
}

function calculateTooltipPosition(screenX, screenY, containerWidth, containerHeight, cardWidth, cardHeight) {
  const PADDING = 12;
  const GAP_X = 18; // clearance from marker center along X

  const spaceRight = containerWidth - (screenX + GAP_X) - PADDING;
  const spaceLeft = (screenX - GAP_X) - PADDING;

  // Decide strictly left or right side of the dot:
  // Prefer right side if it fits; otherwise use left side if it fits; else pick the side with more space
  let left;
  if (spaceRight >= cardWidth) {
    left = screenX + GAP_X;
  } else if (spaceLeft >= cardWidth) {
    left = screenX - cardWidth - GAP_X;
  } else if (spaceRight >= spaceLeft) {
    left = screenX + GAP_X;
  } else {
    left = screenX - cardWidth - GAP_X;
  }

  // Vertically center with the dot
  let top = screenY - (cardHeight / 2);

  // Clamp vertically to remain cleanly inside container boundaries
  const minTop = PADDING;
  const maxTop = Math.max(minTop, containerHeight - cardHeight - PADDING);
  top = Math.max(minTop, Math.min(maxTop, top));

  return { left: Math.round(left), top: Math.round(top) };
}

function positionTooltip(inc, isPinned = false) {
  const tooltip = document.getElementById('map-tooltip');
  if (!tooltip || !inc) return false;

  const pos = projection([inc.coords[1], inc.coords[0]]);
  if (!pos) return false;

  const transform = d3.zoomTransform(svg.node());
  const screenX = pos[0] * transform.k + transform.x;
  const screenY = pos[1] * transform.k + transform.y;

  const containerEl = document.getElementById('map-area') || container;
  const rect = containerEl.getBoundingClientRect();

  const currentId = tooltip.getAttribute('data-incident-id');
  if (currentId !== inc.id) {
    const color = getStatusColor(inc.status);
    const imgPath = inc.image || 'images/gallery/3994c5d06c599e8194152b7bd10fd7bc.jpg';

    tooltip.innerHTML = `
      <img src="${imgPath}" class="map-tooltip-img" alt="${inc.name}" onerror="this.onerror=null; this.src='images/gallery/3994c5d06c599e8194152b7bd10fd7bc.jpg'">
      <div style="font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: #ff6b1a; line-height: 1.2;">${inc.name}</div>
      <div style="color: #a0c8d8; font-size: 11px; margin-top: 3px; font-weight: 500;">${inc.location}</div>
      <div style="color: ${color}; font-size: 10px; font-weight: 600; margin-top: 4px; letter-spacing: 0.5px;">STATUS: ${inc.status} (${inc.date})</div>
      <button class="btn-see-more" onclick="openIncidentModal('${inc.id}')">SEE MORE</button>
    `;
    tooltip.setAttribute('data-incident-id', inc.id);
  }

  if (isPinned) {
    tooltip.classList.add('pinned');
  } else {
    tooltip.classList.remove('pinned');
  }

  if (tooltip.style.display !== 'block') {
    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';
  }

  const cardWidth = tooltip.offsetWidth || 230;
  const cardHeight = tooltip.offsetHeight || 195;

  const coords = calculateTooltipPosition(screenX, screenY, rect.width, rect.height, cardWidth, cardHeight);

  tooltip.style.left = `${coords.left}px`;
  tooltip.style.top = `${coords.top}px`;
  tooltip.style.visibility = 'visible';

  return true;
}

function showHoverTooltip(inc) {
  positionTooltip(inc, false);
}

function hideHoverTooltip() {
  if (selectedIncidentId) {
    updateSelectedTooltip();
  } else {
    const tooltip = document.getElementById('map-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
      tooltip.classList.remove('pinned');
      tooltip.removeAttribute('data-incident-id');
    }
  }
}

function updateSelectedTooltip() {
  const tooltip = document.getElementById('map-tooltip');
  if (!tooltip) return;

  if (currentHoveredIncId && currentHoveredIncId !== selectedIncidentId) {
    const hInc = VALID_INCIDENTS.find(i => i.id === currentHoveredIncId);
    if (hInc) {
      positionTooltip(hInc, false);
      return;
    }
  }

  if (!selectedIncidentId) {
    if (!currentHoveredIncId) {
      tooltip.style.display = 'none';
      tooltip.classList.remove('pinned');
      tooltip.removeAttribute('data-incident-id');
    }
    return;
  }

  const inc = VALID_INCIDENTS.find(i => i.id === selectedIncidentId);
  if (!inc) {
    tooltip.style.display = 'none';
    tooltip.classList.remove('pinned');
    tooltip.removeAttribute('data-incident-id');
    return;
  }

  positionTooltip(inc, true);
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
    item.className = `incident-item ${inc.id === selectedIncidentId ? 'active selected' : ''}`;
    item.setAttribute('data-id', inc.id);
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
    if (tooltip) {
      tooltip.style.display = 'none';
      tooltip.classList.remove('pinned');
      tooltip.removeAttribute('data-incident-id');
    }
    return;
  }

  // Immediately display the pinned card for the selected incident
  updateSelectedTooltip();

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
  }
}

// ── 7. VERTICAL INFINITE COVERFLOW GALLERY CAROUSEL ────────────────────────
let galleryScrollIndex = 5;

// Support both edits_gallery_media.js (Primary) and data/gallery.js (Legacy fallback)
const rawGallery = (typeof EDITS_GALLERY_MEDIA !== 'undefined' && Array.isArray(EDITS_GALLERY_MEDIA) && EDITS_GALLERY_MEDIA.length > 0)
  ? EDITS_GALLERY_MEDIA
  : (typeof GALLERY_IMAGES !== 'undefined' && Array.isArray(GALLERY_IMAGES) && GALLERY_IMAGES.length > 0
      ? GALLERY_IMAGES
      : VALID_INCIDENTS);

const GALLERY_DATA = rawGallery.map((item, idx) => ({
  id: item.id || `gal-auto-${idx + 1}`,
  title: item.title || item.name || `GALLERY ITEM #${idx + 1}`,
  name: (item.name || item.title || `GALLERY ITEM #${idx + 1}`).toUpperCase(),
  date: item.date || 'UNKNOWN',
  status: (item.status || 'UNRESOLVED').toUpperCase(),
  image: item.image || (Array.isArray(item.images) && item.images[0]) || 'images/gallery/3994c5d06c599e8194152b7bd10fd7bc.jpg',
  description: item.description || 'Surveillance archive record.'
}));

function initCarousel() {
  const track = document.getElementById('carousel-track');
  if (!track) return;
  track.innerHTML = '';

  const countEl = document.getElementById('gallery-count');
  if (countEl) countEl.textContent = `${GALLERY_DATA.length} PHOTOS`;

  const totalNumEl = document.getElementById('gallery-total-num');
  if (totalNumEl) totalNumEl.textContent = GALLERY_DATA.length;

  GALLERY_DATA.forEach((itemData, index) => {
    const item = document.createElement('div');
    item.className = 'carousel-item small-card';
    item.dataset.index = index;
    const color = getStatusColor(itemData.status || 'UNRESOLVED');
    const imgPath = itemData.image || 'images/gallery/3994c5d06c599e8194152b7bd10fd7bc.jpg';

    item.innerHTML = `
      <img src="${imgPath}" class="carousel-item-img" alt="${itemData.title || itemData.name}" onerror="this.onerror=null; this.src='images/gallery/3994c5d06c599e8194152b7bd10fd7bc.jpg'">
      <div class="carousel-item-badge">
        <div class="carousel-badge-title">${itemData.title || itemData.name}</div>
        <div class="carousel-badge-meta">
          <span class="badge-loc">${itemData.date || 'UNKNOWN'}</span>
          <span class="badge-status" style="color: ${color}; font-weight: 600;">${itemData.status || 'UNRESOLVED'}</span>
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

  const currentNumEl = document.getElementById('gallery-current-num');
  if (currentNumEl) {
    currentNumEl.textContent = (galleryScrollIndex + 1);
  }

  const totalNumEl = document.getElementById('gallery-total-num');
  if (totalNumEl) {
    totalNumEl.textContent = total;
  }

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
  const offsetAbove = (42 + gap) + (54 + gap) + (70 + gap); // 202px
  const activeHeight = 135;
  const activeCenterY = offsetAbove + activeHeight / 2; // 269.5px
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
    currentHoveredIncId = null;
    if (hoverShowTimer) clearTimeout(hoverShowTimer);
    if (hoverHideTimer) clearTimeout(hoverHideTimer);
    const tooltip = document.getElementById('map-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
      tooltip.classList.remove('pinned');
      tooltip.removeAttribute('data-incident-id');
    }
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
      requestAnimationFrame(() => {
        renderTimelineChart();
      });
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

window.addEventListener('resize', () => {
  if (timelinePopup && timelinePopup.classList.contains('open')) {
    renderTimelineChart();
  }
  if (currentHoveredIncId) {
    const hInc = VALID_INCIDENTS.find(i => i.id === currentHoveredIncId);
    if (hInc) positionTooltip(hInc, false);
  } else if (selectedIncidentId) {
    const sInc = VALID_INCIDENTS.find(i => i.id === selectedIncidentId);
    if (sInc) positionTooltip(sInc, true);
  }
});

// ── 9. D3 TIMELINE LINE CHART MODAL ─────────────────────────────────────────
function renderTimelineChart() {
  const wrap = d3.select('#timeline-svg-wrap');
  if (wrap.empty()) return;
  wrap.selectAll('*').remove();

  const containerW = wrap.node().clientWidth || 760;
  const chartW = Math.max(700, containerW);
  const chartH = 240;
  const margin = { top: 20, right: 28, bottom: 32, left: 58 };

  const chartSvg = wrap.append('svg')
    .attr('width', chartW)
    .attr('height', chartH)
    .attr('viewBox', `0 0 ${chartW} ${chartH}`)
    .style('overflow', 'visible');

  // Gradient Definition for Area Fill Under Single Line
  const defs = chartSvg.append('defs');
  const areaGrad = defs.append('linearGradient')
    .attr('id', 'timeline-area-gradient')
    .attr('x1', '0')
    .attr('y1', '0')
    .attr('x2', '0')
    .attr('y2', '1');

  areaGrad.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', '#ff5500')
    .attr('stop-opacity', 0.28);

  areaGrad.append('stop')
    .attr('offset', '80%')
    .attr('stop-color', '#ff5500')
    .attr('stop-opacity', 0.05);

  areaGrad.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', '#ff5500')
    .attr('stop-opacity', 0.0);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Extract all valid incident years dynamically
  const incidentYears = VALID_INCIDENTS
    .map(i => i.year)
    .filter(y => typeof y === 'number' && !isNaN(y) && y > 0);

  const rawMinYear = incidentYears.length > 0 ? Math.min(...incidentYears) : 1947;
  const rawMaxYear = incidentYears.length > 0 ? Math.max(...incidentYears) : 2026;

  // Align nicely to 5-year boundaries
  const minYear = Math.min(1945, Math.floor(rawMinYear / 5) * 5);
  const maxYear = Math.max(2025, Math.ceil(rawMaxYear / 5) * 5);

  // Group incidents by year
  const incidentsByYear = new Map();
  VALID_INCIDENTS.forEach(inc => {
    const y = inc.year;
    if (!y || isNaN(y)) return;
    if (!incidentsByYear.has(y)) {
      incidentsByYear.set(y, []);
    }
    incidentsByYear.get(y).push(inc);
  });

  // Calculate highest count for dynamic yScale
  let maxCount = 0;
  incidentsByYear.forEach(list => {
    if (list.length > maxCount) maxCount = list.length;
  });
  const maxY = Math.max(5, maxCount + 1);

  // Build dynamic chartData sequence
  const chartData = [];
  for (let yr = minYear; yr <= maxYear; yr++) {
    if (incidentsByYear.has(yr)) {
      const list = incidentsByYear.get(yr);
      const count = list.length;
      let label = `${yr}`;
      if (list[0].date) {
        const dObj = new Date(list[0].date);
        if (!isNaN(dObj.getTime())) {
          label = `${monthNames[dObj.getUTCMonth()]} ${yr}`;
        }
      }
      chartData.push({
        year: yr,
        value: count,
        label: label,
        count: count,
        incidents: list.map(i => i.id)
      });
    } else {
      chartData.push({
        year: yr,
        value: 0,
        label: `${yr}`,
        count: 0,
        incidents: []
      });
    }
  }

  const xScale = d3.scaleLinear()
    .domain([minYear, maxYear + 0.5])
    .range([margin.left, chartW - margin.right]);

  const yScale = d3.scaleLinear()
    .domain([0, maxY])
    .range([chartH - margin.bottom, margin.top]);

  // Dynamic Dashed Gridlines
  const yGridValues = [];
  for (let v = 0; v <= maxY; v++) {
    yGridValues.push(v);
  }

  const xGridValues = [];
  for (let yr = minYear; yr <= maxYear; yr += 5) {
    xGridValues.push(yr);
  }

  const gridG = chartSvg.append('g').attr('class', 'chart-grid-group');

  // Horizontal Grid Lines
  yGridValues.forEach(v => {
    const yPos = yScale(v);
    gridG.append('line')
      .attr('x1', margin.left)
      .attr('x2', chartW - margin.right)
      .attr('y1', yPos)
      .attr('y2', yPos)
      .attr('stroke', 'rgba(56, 189, 248, 0.12)')
      .attr('stroke-dasharray', '2,3')
      .attr('stroke-width', 1);
  });

  // Vertical Grid Lines
  xGridValues.forEach(v => {
    const xPos = xScale(v);
    gridG.append('line')
      .attr('x1', xPos)
      .attr('x2', xPos)
      .attr('y1', margin.top)
      .attr('y2', chartH - margin.bottom)
      .attr('stroke', 'rgba(56, 189, 248, 0.12)')
      .attr('stroke-dasharray', '2,3')
      .attr('stroke-width', 1);
  });

  // Plot Area Border Box
  chartSvg.append('line')
    .attr('x1', margin.left)
    .attr('x2', margin.left)
    .attr('y1', margin.top)
    .attr('y2', chartH - margin.bottom)
    .attr('stroke', '#163048')
    .attr('stroke-width', 1);

  chartSvg.append('line')
    .attr('x1', margin.left)
    .attr('x2', chartW - margin.right)
    .attr('y1', chartH - margin.bottom)
    .attr('y2', chartH - margin.bottom)
    .attr('stroke', '#163048')
    .attr('stroke-width', 1);

  chartSvg.append('line')
    .attr('x1', margin.left)
    .attr('x2', chartW - margin.right)
    .attr('y1', margin.top)
    .attr('y2', margin.top)
    .attr('stroke', 'rgba(56, 189, 248, 0.12)')
    .attr('stroke-dasharray', '2,3')
    .attr('stroke-width', 1);

  chartSvg.append('line')
    .attr('x1', chartW - margin.right)
    .attr('x2', chartW - margin.right)
    .attr('y1', margin.top)
    .attr('y2', chartH - margin.bottom)
    .attr('stroke', 'rgba(56, 189, 248, 0.12)')
    .attr('stroke-dasharray', '2,3')
    .attr('stroke-width', 1);

  // Y-Axis Ticks (0, 1, 2, 3, 4, 5)
  const yLabelsG = chartSvg.append('g').attr('class', 'y-axis-labels');
  yGridValues.forEach(v => {
    yLabelsG.append('text')
      .attr('x', margin.left - 10)
      .attr('y', yScale(v) + 3.5)
      .attr('text-anchor', 'end')
      .attr('fill', '#64748b')
      .attr('font-size', '10px')
      .attr('font-family', "'Inter', system-ui, sans-serif")
      .text(v);
  });

  // Y-Axis Rotated Title Label
  chartSvg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -((margin.top + (chartH - margin.bottom)) / 2))
    .attr('y', 18)
    .attr('fill', '#7b97a8')
    .attr('font-size', '11px')
    .attr('font-weight', '500')
    .attr('font-family', "'Inter', system-ui, sans-serif")
    .attr('text-anchor', 'middle')
    .text('Number of Incidents');

  // X-Axis Ticks (5-Year Intervals)
  const xLabelsG = chartSvg.append('g').attr('class', 'x-axis-labels');
  xGridValues.forEach(v => {
    xLabelsG.append('text')
      .attr('x', xScale(v))
      .attr('y', chartH - margin.bottom + 16)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-size', '10px')
      .attr('font-family', "'Inter', system-ui, sans-serif")
      .text(v);
  });

  // Area Generator for Single Line
  const areaGen = d3.area()
    .x(d => xScale(d.year))
    .y0(yScale(0))
    .y1(d => yScale(d.value))
    .curve(d3.curveLinear);

  // Line Generator for Single Line (Total Incident Reports)
  const lineGen = d3.line()
    .x(d => xScale(d.year))
    .y(d => yScale(d.value))
    .curve(d3.curveLinear);

  // Render Area Gradient
  chartSvg.append('path')
    .datum(chartData)
    .attr('class', 'chart-area-fill')
    .attr('d', areaGen)
    .attr('fill', 'url(#timeline-area-gradient)');

  // Render Single Orange Line
  chartSvg.append('path')
    .datum(chartData)
    .attr('class', 'chart-data-line')
    .attr('d', lineGen)
    .attr('fill', 'none')
    .attr('stroke', '#ff5500')
    .attr('stroke-width', 2);

  // Render Small Circular Data Dots (for years with incidents)
  chartSvg.selectAll('.chart-dot')
    .data(chartData.filter(d => d.count > 0))
    .enter()
    .append('circle')
    .attr('class', 'chart-dot')
    .attr('cx', d => xScale(d.year))
    .attr('cy', d => yScale(d.value))
    .attr('r', 2.8)
    .attr('fill', '#ffffff')
    .attr('stroke', '#ff5500')
    .attr('stroke-width', 1.5);

  // Interactive Elements: Vertical Dashed Guideline & Highlight Halo
  const hoverGuide = chartSvg.append('line')
    .attr('class', 'hover-guideline')
    .attr('stroke', 'rgba(255, 255, 255, 0.4)')
    .attr('stroke-dasharray', '2,2')
    .attr('stroke-width', 1)
    .attr('y1', margin.top)
    .attr('y2', chartH - margin.bottom)
    .style('display', 'none');

  const activeRing = chartSvg.append('circle')
    .attr('class', 'active-dot-ring')
    .attr('r', 6)
    .attr('fill', 'none')
    .attr('stroke', '#ff5500')
    .attr('stroke-width', 1.5)
    .style('display', 'none');

  const activeCore = chartSvg.append('circle')
    .attr('class', 'active-dot-core')
    .attr('r', 2.8)
    .attr('fill', '#ff5500')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 1)
    .style('display', 'none');

  // Tooltip Element
  let tooltip = wrap.select('.timeline-chart-tooltip');
  if (tooltip.empty()) {
    tooltip = wrap.append('div').attr('class', 'timeline-chart-tooltip');
  }

  function setActivePoint(d) {
    const cx = xScale(d.year);
    const cy = yScale(d.value);
    hoverGuide.style('display', 'block').attr('x1', cx).attr('x2', cx);
    activeRing.style('display', 'block').attr('cx', cx).attr('cy', cy);
    activeCore.style('display', 'block').attr('cx', cx).attr('cy', cy);

    const ttWidth = 125;
    let left = cx + 12;
    if (left + ttWidth > chartW - margin.right) {
      left = cx - ttWidth - 12;
    }
    const top = Math.max(margin.top - 5, cy - 38);

    tooltip.style('display', 'block')
      .style('left', `${left}px`)
      .style('top', `${top}px`)
      .html(`
        <div class="tt-date">${d.label}</div>
        <div class="tt-row"><span class="tt-dot"></span>Total Incidents: ${d.count}</div>
      `);
  }

  // Default active highlight at Mar 1947 or first incident year
  const defaultPt = chartData.find(d => d.year === 1947 && d.count > 0) || chartData.find(d => d.count > 0) || chartData[0];
  if (defaultPt) setActivePoint(defaultPt);

  // Mouse Tracking Overlay
  const overlay = chartSvg.append('rect')
    .attr('x', margin.left)
    .attr('y', margin.top)
    .attr('width', chartW - margin.left - margin.right)
    .attr('height', chartH - margin.top - margin.bottom)
    .attr('fill', 'transparent')
    .attr('pointer-events', 'all')
    .style('cursor', 'crosshair');

  overlay.on('mousemove', function(event) {
    const [mx] = d3.pointer(event);
    const yearX = xScale.invert(mx);
    let closest = chartData[0];
    let minDiff = Infinity;
    chartData.forEach(d => {
      const diff = Math.abs(d.year - yearX);
      if (diff < minDiff) {
        minDiff = diff;
        closest = d;
      }
    });
    setActivePoint(closest);
  });

  overlay.on('click', function(event) {
    const [mx] = d3.pointer(event);
    const yearX = xScale.invert(mx);
    let closest = chartData[0];
    let minDiff = Infinity;
    chartData.forEach(d => {
      const diff = Math.abs(d.year - yearX);
      if (diff < minDiff) {
        minDiff = diff;
        closest = d;
      }
    });
    if (closest && closest.incidents && closest.incidents.length > 0) {
      selectIncident(closest.incidents[0]);
      timelinePopup.classList.remove('open');
      if (btnTimeline) btnTimeline.classList.remove('active');
    }
  });

  // Summary statistics (5 columns with vertical dividers)
  const unresolved = VALID_INCIDENTS.filter(i => i.status === 'UNRESOLVED').length;
  const confirmed = VALID_INCIDENTS.filter(i => i.status === 'CONFIRMED').length;
  const classified = VALID_INCIDENTS.filter(i => i.status === 'CLASSIFIED').length;
  const total = VALID_INCIDENTS.length;

  const statsEl = document.getElementById('timeline-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="timeline-stat-col">
        <span class="timeline-stat-title">TOTAL INCIDENTS</span>
        <span class="timeline-stat-num stat-num-orange">${total}</span>
      </div>
      <div class="timeline-stat-col">
        <span class="timeline-stat-title">TIME SPAN</span>
        <span class="timeline-stat-num stat-num-cyan">${rawMinYear} - ${rawMaxYear}</span>
      </div>
      <div class="timeline-stat-col">
        <span class="timeline-stat-title">UNRESOLVED</span>
        <span class="timeline-stat-num stat-num-orange">${unresolved}</span>
      </div>
      <div class="timeline-stat-col">
        <span class="timeline-stat-title">CONFIRMED</span>
        <span class="timeline-stat-num stat-num-brightcyan">${confirmed}</span>
      </div>
      <div class="timeline-stat-col">
        <span class="timeline-stat-title">CLASSIFIED</span>
        <span class="timeline-stat-num stat-num-red">${classified}</span>
      </div>
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
