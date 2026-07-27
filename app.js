/* ============================================================
   PEI Family Adventure Guide — App Logic
   No backend, no accounts. Favorites/visited state lives only
   in this browser's localStorage.
   ============================================================ */

(function () {
  "use strict";

  const STORAGE_KEY = "pei-guide-saved-v1";
  const HOME_ID = "home-base";

  /* ---------------- Saved state (localStorage) ---------------- */
  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { want: [], favorite: [], visited: [] };
      const parsed = JSON.parse(raw);
      return {
        want: parsed.want || [],
        favorite: parsed.favorite || [],
        visited: parsed.visited || []
      };
    } catch (e) {
      return { want: [], favorite: [], visited: [] };
    }
  }

  function persistSaved() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (e) { /* storage unavailable — fail silently */ }
  }

  let saved = loadSaved();

  function toggleSaved(kind, id) {
    const list = saved[kind];
    const idx = list.indexOf(id);
    if (idx === -1) list.push(id); else list.splice(idx, 1);
    persistSaved();
  }

  function isSaved(kind, id) {
    return saved[kind].includes(id);
  }

  /* ---------------- Data helpers ---------------- */
  function getLocation(id) {
    return PEI_LOCATIONS.find((l) => l.id === id);
  }

  function minutesFromLabel(label) {
    if (!label) return 9999;
    if (/^0 minutes/i.test(label)) return 0;
    let total = 0;
    const hr = label.match(/(\d+)\s*hr/);
    const min = label.match(/(\d+)\s*min/);
    if (hr) total += parseInt(hr[1], 10) * 60;
    if (min) total += parseInt(min[1], 10);
    if (!hr && !min) {
      const justMin = label.match(/(\d+)/);
      if (justMin) total = parseInt(justMin[1], 10);
    }
    if (/^2 hours?$/i.test(label.trim())) total = 120;
    return total;
  }

  function isFree(loc) {
    return /free/i.test(loc.cost || "");
  }

  function categoryMeta(catId) {
    return PEI_CATEGORIES[catId] || { label: catId, icon: "📍", color: "#1C6E8C" };
  }

  function primaryCategory(loc) {
    const nonHome = loc.category.filter((c) => c !== "home");
    return nonHome[0] || loc.category[0];
  }

  function googleMapsUrl(loc) {
    return `https://www.google.com/maps/dir/?api=1&destination=${loc.coordinates.lat},${loc.coordinates.lng}`;
  }

  function starString(n) {
    if (n === null || n === undefined) return "—";
    return "★".repeat(n) + "☆".repeat(5 - n);
  }

  /* ---------------- Location card (shared markup) ---------------- */
  function locationCardHTML(loc, opts) {
    opts = opts || {};
    const cat = categoryMeta(primaryCategory(loc));
    const tags = (loc.bestFor || []).slice(0, 3).map((t) => `<span class="tag">${escapeHTML(t)}</span>`).join("");
    const reason = opts.reason ? `<p class="reason-strip">${escapeHTML(opts.reason)}</p>` : "";
    return `
      <button class="loc-card" style="--card-accent:${cat.color}" data-open-loc="${loc.id}">
        <div class="loc-card__icon">${cat.icon}</div>
        <div class="loc-card__body">
          <div class="loc-card__top">
            <h4 class="loc-card__name">${escapeHTML(loc.name)}</h4>
            <span class="loc-card__meta">${escapeHTML(loc.distanceFromHome)}</span>
          </div>
          ${reason}
          <p class="loc-card__desc">${escapeHTML(loc.description)}</p>
          <div class="loc-card__tags">${tags}</div>
        </div>
      </button>
    `;
  }

  function escapeHTML(str) {
    if (str === undefined || str === null) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---------------- Navigation between views ---------------- */
  const views = document.querySelectorAll(".view");
  const navItems = document.querySelectorAll(".tab-nav__item");

  function switchView(name) {
    views.forEach((v) => v.classList.toggle("is-active", v.dataset.view === name));
    navItems.forEach((n) => n.classList.toggle("is-active", n.dataset.nav === name));
    if (name === "map" && map) {
      setTimeout(() => map.invalidateSize(), 50);
    }
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.nav));
  });

  /* ================================================================
     MAP + EXPLORE
     ================================================================ */
  let map;
  let markerLayer;
  const markersById = {};

  function makeDivIcon(loc) {
    const isHome = loc.id === HOME_ID;
    const cat = categoryMeta(primaryCategory(loc));
    const cls = isHome ? "pei-pin pei-pin--home" : "pei-pin";
    return L.divIcon({
      className: "",
      html: `<div class="${cls}" style="background:${cat.color}"><span>${cat.icon}</span></div>`,
      iconSize: isHome ? [36, 36] : [30, 30],
      iconAnchor: isHome ? [18, 18] : [15, 28]
    });
  }

  function initMap() {
    map = L.map("map", { scrollWheelZoom: true }).setView(
      [46.25, -62.9],
      9
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    markerLayer = L.layerGroup().addTo(map);
    renderMarkers(PEI_LOCATIONS);
  }

  function renderMarkers(list) {
    markerLayer.clearLayers();
    Object.keys(markersById).forEach((k) => delete markersById[k]);
    list.forEach((loc) => {
      const marker = L.marker([loc.coordinates.lat, loc.coordinates.lng], {
        icon: makeDivIcon(loc)
      });
      const popupHTML = `
        <div>
          <p class="map-popup__title">${escapeHTML(loc.name)}</p>
          <p class="map-popup__meta">${escapeHTML(loc.distanceFromHome)} · ${escapeHTML(loc.cost)}</p>
          <button class="map-popup__btn" data-open-loc="${loc.id}">View details</button>
        </div>
      `;
      marker.bindPopup(popupHTML);
      marker.addTo(markerLayer);
      markersById[loc.id] = marker;
    });
  }

  /* ---- Category filter chips ---- */
  const categoryFilterEl = document.getElementById("category-filters");
  let activeCategories = new Set();

  function renderCategoryFilters() {
    categoryFilterEl.innerHTML = Object.entries(PEI_CATEGORIES)
      .filter(([id]) => id !== "home")
      .map(
        ([id, meta]) => `
        <button type="button" class="chip" data-cat="${id}" style="--chip-color:${meta.color}">
          ${meta.icon} ${meta.label}
        </button>`
      )
      .join("");

    categoryFilterEl.querySelectorAll("[data-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.cat;
        if (activeCategories.has(id)) {
          activeCategories.delete(id);
          btn.classList.remove("is-selected");
        } else {
          activeCategories.add(id);
          btn.classList.add("is-selected");
        }
        applyExploreFilters();
      });
    });
  }

  const filterTimeEl = document.getElementById("filter-time");
  const filterAudienceEl = document.getElementById("filter-audience");
  const filterFreeEl = document.getElementById("filter-free");
  const exploreListEl = document.getElementById("explore-list");

  function applyExploreFilters() {
    const maxTime = filterTimeEl.value ? parseInt(filterTimeEl.value, 10) : null;
    const audience = filterAudienceEl.value;
    const freeOnly = filterFreeEl.checked;

    const filtered = PEI_LOCATIONS.filter((loc) => {
      if (loc.id === HOME_ID) return true;
      if (activeCategories.size > 0 && !loc.category.some((c) => activeCategories.has(c))) return false;
      if (maxTime !== null && minutesFromLabel(loc.distanceFromHome) > maxTime) return false;
      if (audience && !(loc.bestFor || []).includes(audience)) return false;
      if (freeOnly && !isFree(loc)) return false;
      return true;
    });

    renderMarkers(filtered);
    const listable = filtered.filter((l) => l.id !== HOME_ID);
    exploreListEl.innerHTML =
      `<p class="explore-list__count">${listable.length} place${listable.length === 1 ? "" : "s"} match</p>` +
      listable.map((l) => locationCardHTML(l)).join("");
  }

  [filterTimeEl, filterAudienceEl, filterFreeEl].forEach((el) =>
    el.addEventListener("change", applyExploreFilters)
  );

  /* ================================================================
     TRIP PLANNER
     ================================================================ */
  const whoChips = document.getElementById("who-chips");
  const timeChips = document.getElementById("time-chips");
  const moodChips = document.getElementById("mood-chips");
  const plannerForm = document.getElementById("planner-form");
  const plannerResults = document.getElementById("planner-results");
  const plannerResultsList = document.getElementById("planner-results-list");
  const plannerReset = document.getElementById("planner-reset");

  const plannerState = { who: new Set(), time: null, mood: null };

  function wireChipGroup(container, multi, onChange) {
    container.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const val = chip.dataset.value;
        if (multi) {
          if (plannerState.who.has(val)) {
            plannerState.who.delete(val);
            chip.classList.remove("is-selected");
          } else {
            plannerState.who.add(val);
            chip.classList.add("is-selected");
          }
        } else {
          container.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-selected"));
          chip.classList.add("is-selected");
          onChange(val);
        }
      });
    });
  }

  wireChipGroup(whoChips, true, null);
  wireChipGroup(timeChips, false, (v) => (plannerState.time = v));
  wireChipGroup(moodChips, false, (v) => (plannerState.mood = v));

  const MOOD_TO_CATEGORY = {
    beach: ["beach"],
    scenic: ["scenic", "lighthouse"],
    food: ["restaurant", "icecream", "market", "coffee"],
    adventure: ["teen", "family"],
    nature: ["nature"],
    smalltowns: ["town", "harbour"],
    rainy: ["rainy"]
  };

  const TIME_TO_DURATION = {
    short: ["1–2 hours", "1 hour", "30–60 minutes", "1–3 hours"],
    half: ["Half day", "1–3 hours", "2–4 hours", "2–3 hours"],
    full: ["Full day", "Half day"]
  };

  function whoToAudiences(whoSet) {
    const audiences = new Set();
    whoSet.forEach((w) => {
      if (w === "teenagers") audiences.add("teens");
      if (w === "grandma" || w === "grandpa") audiences.add("grandparents");
      if (w === "parents" || w === "everyone" || w === "extended") audiences.add("families");
    });
    if (audiences.size === 0) audiences.add("families");
    return audiences;
  }

  function scoreLocation(loc, audiences) {
    let score = 0;
    const reasons = [];

    if (plannerState.mood) {
      const cats = MOOD_TO_CATEGORY[plannerState.mood] || [];
      if (loc.category.some((c) => cats.includes(c))) {
        score += 3;
        reasons.push("matches the mood you picked");
      }
    }

    let audienceHit = false;
    audiences.forEach((aud) => {
      if ((loc.bestFor || []).includes(aud)) {
        score += 2;
        audienceHit = true;
      }
    });
    if (audienceHit) {
      if (audiences.has("grandparents")) reasons.push("comfortable for grandparents");
      if (audiences.has("teens")) reasons.push("a favourite with teens");
      if (audiences.has("families")) reasons.push("works well for the whole group");
    }

    if (plannerState.time) {
      const okDurations = TIME_TO_DURATION[plannerState.time] || [];
      if (okDurations.includes(loc.duration)) {
        score += 2;
        reasons.push(`fits a ${plannerState.time === "short" ? "quick" : plannerState.time === "half" ? "half-day" : "full-day"} window`);
      }
    }

    if (loc.ratings) {
      let avg = 0, count = 0;
      audiences.forEach((aud) => {
        const key = aud === "teens" ? "teen" : aud === "grandparents" ? "grandparent" : "adult";
        if (loc.ratings[key] !== undefined) { avg += loc.ratings[key]; count++; }
      });
      if (count > 0) score += (avg / count) * 0.4;
    }

    return { score, reason: reasons[0] || "a solid all-around pick" };
  }

  plannerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const audiences = whoToAudiences(plannerState.who);

    const scored = PEI_LOCATIONS.filter((l) => l.id !== HOME_ID)
      .map((loc) => ({ loc, ...scoreLocation(loc, audiences) }))
      .sort((a, b) => b.score - a.score);

    const top = scored.slice(0, 6);

    plannerResultsList.innerHTML = top
      .map(({ loc, reason }) => locationCardHTML(loc, { reason: "Good match — " + reason }))
      .join("");

    plannerResults.hidden = false;
    plannerResults.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  plannerReset.addEventListener("click", () => {
    plannerState.who.clear();
    plannerState.time = null;
    plannerState.mood = null;
    document.querySelectorAll("#planner-form .chip").forEach((c) => c.classList.remove("is-selected"));
    plannerResults.hidden = true;
    plannerForm.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ================================================================
     ROUTES
     ================================================================ */
  const routesListEl = document.getElementById("routes-list");

  const GOOD_FOR_LABEL = {
    everyone: "Everyone",
    teenagers: "Teens",
    grandparents: "Grandparents",
    families: "Families"
  };

  function renderRoutes() {
    routesListEl.innerHTML = PEI_ROUTES.map((route) => {
      const stopsHTML = route.stops
        .map((id, i) => {
          const loc = getLocation(id);
          if (!loc) return "";
          const isHome = id === HOME_ID;
          const isLast = i === route.stops.length - 1;
          return `
            <div class="route-stop ${isHome ? "route-stop--home" : ""}">
              <span class="route-stop__dot"></span>
              <span>${isHome ? "🏡" : categoryMeta(primaryCategory(loc)).icon} ${escapeHTML(loc.name)}</span>
            </div>
            ${!isLast ? '<div class="route-stop__connector"></div>' : ""}
          `;
        })
        .join("");

      const tagsHTML = route.goodFor
        .map((g) => `<span class="tag">${GOOD_FOR_LABEL[g] || g}</span>`)
        .join("");

      return `
        <div class="route-card">
          <div class="route-card__head">
            <div>
              <p class="route-card__title">${escapeHTML(route.title)}</p>
              <p class="route-card__tagline">${escapeHTML(route.tagline)}</p>
            </div>
            <span class="route-card__time">${escapeHTML(route.estimatedTime)}</span>
          </div>
          <div class="route-card__perforation"></div>
          <div class="route-card__stops">${stopsHTML}</div>
          <div class="route-card__footer">${tagsHTML}</div>
        </div>
      `;
    }).join("");
  }

  /* ================================================================
     SAVED VIEW
     ================================================================ */
  const savedTabs = document.querySelectorAll(".saved-tab");
  const savedListEl = document.getElementById("saved-list");
  const savedEmptyEl = document.getElementById("saved-empty");
  let activeSavedTab = "want";

  savedTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      savedTabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      activeSavedTab = tab.dataset.saved;
      renderSavedList();
    });
  });

  function renderSavedList() {
    const ids = saved[activeSavedTab] || [];
    const locs = ids.map(getLocation).filter(Boolean);
    savedEmptyEl.hidden = locs.length > 0;
    savedListEl.innerHTML = locs.map((l) => locationCardHTML(l)).join("");
  }

  /* ================================================================
     DETAIL SHEET
     ================================================================ */
  const sheet = document.getElementById("location-sheet");
  const sheetBackdrop = document.getElementById("sheet-backdrop");
  const sheetContent = document.getElementById("sheet-content");
  const sheetClose = document.getElementById("sheet-close");

  function openSheet(id) {
    const loc = getLocation(id);
    if (!loc) return;
    sheetContent.innerHTML = detailHTML(loc);
    sheet.classList.add("is-open");
    sheetBackdrop.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
    wireDetailActions(loc);
  }

  function closeSheetFn() {
    sheet.classList.remove("is-open");
    sheetBackdrop.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
  }

  sheetClose.addEventListener("click", closeSheetFn);
  sheetBackdrop.addEventListener("click", closeSheetFn);

  function detailHTML(loc) {
    const cat = categoryMeta(primaryCategory(loc));
    const ratingsHTML = loc.ratings
      ? `
      <div class="detail__ratings">
        <div class="rating-item"><div class="rating-item__label">Teen</div><div class="rating-item__stars">${starString(loc.ratings.teen)}</div></div>
        <div class="rating-item"><div class="rating-item__label">Adult</div><div class="rating-item__stars">${starString(loc.ratings.adult)}</div></div>
        <div class="rating-item"><div class="rating-item__label">Grandparent</div><div class="rating-item__stars">${starString(loc.ratings.grandparent)}</div></div>
      </div>`
      : "";

    const featuresHTML = (loc.features || []).map((f) => `<span class="tag">${escapeHTML(f)}</span>`).join("");
    const facilitiesHTML = (loc.facilities && loc.facilities.length)
      ? `<p class="detail__section-label">Facilities</p><div class="detail__tags">${loc.facilities.map((f) => `<span class="tag">${escapeHTML(f)}</span>`).join("")}</div>`
      : "";
    const nearbyHTML = (loc.nearby && loc.nearby.length)
      ? `<p class="detail__section-label">Nearby</p><div class="detail__tags">${loc.nearby.map((id) => {
          const n = getLocation(id);
          return n ? `<span class="tag">${escapeHTML(n.name)}</span>` : "";
        }).join("")}</div>`
      : "";

    return `
      <div class="detail__eyebrow">${cat.icon} ${cat.label}</div>
      <h2 class="detail__title">${escapeHTML(loc.name)}</h2>

      <div class="detail__stat-row">
        <div class="detail__stat"><div class="detail__stat-label">Drive time</div><div class="detail__stat-value">${escapeHTML(loc.distanceFromHome)}</div></div>
        <div class="detail__stat"><div class="detail__stat-label">Cost</div><div class="detail__stat-value">${escapeHTML(loc.cost)}</div></div>
        <div class="detail__stat"><div class="detail__stat-label">Suggested time</div><div class="detail__stat-value">${escapeHTML(loc.duration)}</div></div>
        <div class="detail__stat"><div class="detail__stat-label">Walking</div><div class="detail__stat-value">${escapeHTML(loc.walkingDifficulty || "—")}</div></div>
      </div>

      ${ratingsHTML}

      <p class="detail__desc">${escapeHTML(loc.description)}</p>

      ${featuresHTML ? `<p class="detail__section-label">Good to know</p><div class="detail__tags">${featuresHTML}</div>` : ""}
      ${facilitiesHTML}
      ${nearbyHTML}

      <div class="detail__actions">
        <button class="save-btn" data-save="want" data-id="${loc.id}"><span class="save-btn__icon">⭐</span>Want to Visit</button>
        <button class="save-btn" data-save="favorite" data-id="${loc.id}"><span class="save-btn__icon">❤️</span>Favorite</button>
        <button class="save-btn" data-save="visited" data-id="${loc.id}"><span class="save-btn__icon">✔</span>Visited</button>
      </div>

      ${loc.id !== HOME_ID ? `<a class="nav-link-btn" target="_blank" rel="noopener" href="${googleMapsUrl(loc)}">Navigate with Google Maps</a>` : ""}
    `;
  }

  function wireDetailActions(loc) {
    sheetContent.querySelectorAll("[data-save]").forEach((btn) => {
      const kind = btn.dataset.save;
      btn.classList.toggle("is-active", isSaved(kind, loc.id));
      btn.addEventListener("click", () => {
        toggleSaved(kind, loc.id);
        btn.classList.toggle("is-active", isSaved(kind, loc.id));
        if (document.getElementById("view-saved").classList.contains("is-active")) {
          renderSavedList();
        }
      });
    });
  }

  /* Delegate clicks on any card / marker popup button that opens a location */
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-open-loc]");
    if (trigger) {
      openSheet(trigger.dataset.openLoc);
    }
  });

  /* ================================================================
     INIT
     ================================================================ */
  function init() {
    renderCategoryFilters();
    initMap();
    applyExploreFilters();
    renderRoutes();
    renderSavedList();
    switchView("plan");

    if ("serviceWorker" in navigator) {
      // No service worker file is registered by default — keeping the
      // app simple and dependency-free. Left here as a hook if the
      // family later wants true offline caching on GitHub Pages.
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
