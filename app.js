// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Global State
let map;
let markersGroup;
let selectedFilter = 'all';
let userFavorites = JSON.parse(localStorage.getItem('pei_favs') || '{}');

// Icon Category Emojis
const CATEGORY_EMOJIS = {
  home: '🏡',
  beach: '🏖',
  lighthouse: '🌅',
  nature: '🌲',
  harbour: '⚓',
  towns: '🏙',
  family: '🎢',
  teen: '🏎',
  ice_cream: '🍦',
  food: '🍽',
  coffee: '☕',
  markets: '🛒',
  scenic: '📸',
  events: '🎵',
  rainy: '🌧'
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  renderRoutes();
  renderLocations(LOCATIONS_DATA);
  setupChipListeners();
  setupFilterListeners();
});

// Map Initialization
function initMap() {
  // Center map near Alliston Home Base
  const home = LOCATIONS_DATA.find(l => l.isHome);
  map = L.map('map').setView([home.coordinates.lat, home.coordinates.lng], 10);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(map);

  markersGroup = L.layerGroup().addTo(map);
  updateMapMarkers(LOCATIONS_DATA);
}

// Update Markers on Map
function updateMapMarkers(locations) {
  markersGroup.clearLayers();

  locations.forEach(loc => {
    const emoji = loc.isHome ? '🏡' : (CATEGORY_EMOJIS[loc.category[0]] || '📍');
    
    // Custom SVG Icon Marker
    const customIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `<div style="background:${loc.isHome ? '#d9381e' : '#006699'}; color:white; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:16px; border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3);">${emoji}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([loc.coordinates.lat, loc.coordinates.lng], { icon: customIcon })
      .bindPopup(`
        <div style="font-family:sans-serif; text-align:center;">
          <strong style="font-size:1rem; color:#0a2540;">${loc.name}</strong><br/>
          <span style="font-size:0.8rem; color:#64748b;">⏱ Drive: ${loc.distanceFromHome} from Alliston</span><br/>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${loc.coordinates.lat},${loc.coordinates.lng}" target="_blank" style="display:inline-block; margin-top:6px; background:#006699; color:white; padding:4px 8px; border-radius:4px; text-decoration:none; font-size:0.75rem;">Get Directions</a>
        </div>
      `);
    
    markersGroup.addLayer(marker);
  });
}

// Setup Interactive UI Chips for Planner
function setupChipListeners() {
  document.querySelectorAll('.chip-grid').forEach(grid => {
    grid.addEventListener('click', (e) => {
      if (e.target.classList.contains('chip')) {
        // Toggle or single select
        if (grid.id === 'group-chips') {
          e.target.classList.toggle('selected');
        } else {
          grid.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
          e.target.classList.add('selected');
        }
      }
    });
  });

  document.getElementById('btn-recommend').addEventListener('click', calculateSmartRecommendations);
}

// Smart Recommendation Logic Engine
function calculateSmartRecommendations() {
  const selectedGroups = Array.from(document.querySelectorAll('#group-chips .chip.selected')).map(c => c.dataset.value);
  const timeAvailable = document.querySelector('#time-chips .chip.selected')?.dataset.value || 'half';
  const mood = document.querySelector('#mood-chips .chip.selected')?.dataset.value || 'all';

  let scoredLocations = LOCATIONS_DATA.filter(l => !l.isHome).map(loc => {
    let score = 0;

    // 1. Group Preference Scoring
    if (selectedGroups.includes('grandma') || selectedGroups.includes('grandpa')) {
      score += loc.ratings.grandparent * 3;
      if (loc.features.includes('seating') || loc.features.includes('washrooms')) score += 2;
      if (loc.walkingDifficulty === 'Easy') score += 3;
      if (loc.walkingDifficulty === 'Hard') score -= 5;
    }

    if (selectedGroups.includes('teens')) {
      score += loc.ratings.teen * 3;
      if (loc.category.includes('teen') || loc.features.includes('swimming')) score += 4;
    }

    if (selectedGroups.includes('parents')) {
      score += loc.ratings.adult * 2;
    }

    // 2. Mood Match Scoring
    if (mood !== 'all') {
      if (loc.category.includes(mood) || loc.features.includes(mood)) {
        score += 6;
      }
    }

    // 3. Time Filter
    const driveMinutes = parseInt(loc.distanceFromHome) || 30;
    if (timeAvailable === 'short' && driveMinutes > 25) score -= 8;
    if (timeAvailable === 'full') score += 2;

    return { ...loc, recommendScore: score };
  });

  // Sort by calculated score descending
  scoredLocations.sort((a, b) => b.recommendScore - a.recommendScore);

  // Render top results
  renderLocations(scoredLocations);
  updateMapMarkers(scoredLocations);

  // Smooth scroll to locations section
  document.getElementById('filter-bar').scrollIntoView({ behavior: 'smooth' });
}

// Render Suggested Route Cards
function renderRoutes() {
  const container = document.getElementById('routes-container');
  container.innerHTML = ROUTES_DATA.map(route => `
    <div class="route-card" onclick="highlightRoute('${route.id}')">
      <div class="route-title">${route.title}</div>
      <div class="route-subtitle">${route.subtitle}</div>
      <p style="font-size:0.8rem; color:#475569; margin-bottom:8px;">${route.description}</p>
      <div class="route-meta">
        <span>⏱ ${route.estimatedTime}</span>
        <span>👥 ${route.bestFor}</span>
      </div>
    </div>
  `).join('');
}

// Highlight Route on Map
function highlightRoute(routeId) {
  const route = ROUTES_DATA.find(r => r.id === routeId);
  if (!route) return;

  const routeLocations = LOCATIONS_DATA.filter(l => route.stops.includes(l.id));
  renderLocations(routeLocations);
  updateMapMarkers(routeLocations);

  // Fit map bounds to route
  const bounds = L.latLngBounds(routeLocations.map(l => [l.coordinates.lat, l.coordinates.lng]));
  map.fitBounds(bounds, { padding: [30, 30] });
}

// Filter Bar Handler
function setupFilterListeners() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      const filter = e.target.dataset.filter;
      filterLocations(filter);
    });
  });
}

function filterLocations(filter) {
  selectedFilter = filter;
  let filtered = LOCATIONS_DATA;

  if (filter === 'grandparent') {
    filtered = LOCATIONS_DATA.filter(l => l.ratings.grandparent >= 4 && l.walkingDifficulty === 'Easy');
  } else if (filter === 'teen') {
    filtered = LOCATIONS_DATA.filter(l => l.ratings.teen >= 4 || l.category.includes('teen'));
  } else if (filter === 'favs') {
    filtered = LOCATIONS_DATA.filter(l => userFavorites[l.id]);
  } else if (filter !== 'all') {
    filtered = LOCATIONS_DATA.filter(l => l.category.includes(filter));
  }

  renderLocations(filtered);
  updateMapMarkers(filtered);
}

// Render Location Cards
function renderLocations(locations) {
  const container = document.getElementById('locations-container');
  
  if (locations.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:2rem; color:#64748b;">No places match your current filter selection.</div>`;
    return;
  }

  container.innerHTML = locations.map(loc => {
    const isFav = userFavorites[loc.id] || false;
    const categoryEmoji = CATEGORY_EMOJIS[loc.category[0]] || '📍';

    return `
      <div class="card" id="card-${loc.id}">
        <div class="card-header-banner">
          ${categoryEmoji}
        </div>
        <div class="card-body">
          <div class="card-title">${loc.name}</div>
          
          <div class="card-tags">
            ${loc.category.map(c => `<span class="tag tag-${c}">${c}</span>`).join('')}
            <span class="tag">🚶 ${loc.walkingDifficulty} Walk</span>
          </div>

          <p class="card-description">${loc.description}</p>

          <div class="meta-table">
            <div>🚗 <strong>Drive:</strong> ${loc.distanceFromHome}</div>
            <div>⏱ <strong>Visit:</strong> ${loc.duration}</div>
            <div>💵 <strong>Cost:</strong> ${loc.cost}</div>
            <div>🛡 <strong>Base:</strong> Alliston</div>
          </div>

          <div class="rating-bar">
            <div class="rating-item">
              <span>🏎 ${loc.ratings.teen}/5</span>
              Teen
            </div>
            <div class="rating-item">
              <span>☕ ${loc.ratings.adult}/5</span>
              Adult
            </div>
            <div class="rating-item">
              <span>👴 ${loc.ratings.grandparent}/5</span>
              Grandparent
            </div>
          </div>

          <div class="card-actions">
            <button class="btn-card ${isFav ? 'active-fav' : ''}" onclick="toggleFavorite('${loc.id}')">
              ${isFav ? '⭐ Saved' : '☆ Save'}
            </button>
            <a class="btn-card btn-nav" href="https://www.google.com/maps/dir/?api=1&destination=${loc.coordinates.lat},${loc.coordinates.lng}" target="_blank">
              🧭 Navigate
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Toggle Favorite Saved Status in LocalStorage
function toggleFavorite(id) {
  if (userFavorites[id]) {
    delete userFavorites[id];
  } else {
    userFavorites[id] = true;
  }
  localStorage.setItem('pei_favs', JSON.stringify(userFavorites));

  if (selectedFilter === 'favs') {
    filterLocations('favs');
  } else {
    renderLocations(LOCATIONS_DATA);
  }
}

// Smooth Helper Scroll
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}
