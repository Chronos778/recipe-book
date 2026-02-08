import { recipes } from './recipes.js';

/* ── Chrome extension compat ── */
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const CAT_COLORS = {
  breakfast: 'var(--cat-breakfast)',
  lunch:     'var(--cat-lunch)',
  dinner:    'var(--cat-dinner)',
  dessert:   'var(--cat-dessert)',
};

const BOOKMARK_OUT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
const BOOKMARK_IN  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;

function catColor(cat) { return CAT_COLORS[cat] || 'var(--ink-3)'; }

/* ═══════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
  renderRecipeCards();
  initDarkMode();
  setupSearch();
  setupCategoryTabs();
  setupSheets();
  setupKeyboardShortcuts();
  setupScrollDetect();
  updateFavBadge();
}

/* ── Nav glass effect on scroll ── */
function setupScrollDetect() {
  const nav = document.getElementById('topnav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 16);
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════════════════
   RECIPE CARDS
   ═══════════════════════════════════════════════════════════════ */
function renderRecipeCards() {
  const container = document.getElementById('recipes');
  container.innerHTML = '';

  const ids = Object.keys(recipes);
  const countEl = document.getElementById('recipe-count');
  if (countEl) countEl.textContent = `${ids.length} recipe${ids.length !== 1 ? 's' : ''}`;

  ids.forEach((id, i) => {
    const r = recipes[id];
    const isFav = getFavorites().includes(id);
    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.dataset.category = r.category;
    card.dataset.recipeId = id;
    card.style.setProperty('--card-accent', catColor(r.category));
    card.style.animationDelay = `${0.24 + i * 0.07}s`;

    card.innerHTML = `
      <div class="card-top">
        <span class="card-cat"><span class="cat-dot"></span>${r.category}</span>
        <button class="card-save${isFav ? ' saved' : ''}" data-recipe-id="${id}" aria-label="${isFav ? 'Remove from saved' : 'Save recipe'}">${isFav ? BOOKMARK_IN : BOOKMARK_OUT}</button>
      </div>
      <h3 class="card-title">${r.title}</h3>
      <p class="card-desc">${r.description}</p>
      <span class="card-cta">Read recipe <span class="arrow">\u2192</span></span>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-save')) return;
      viewRecipe(id);
    });

    card.querySelector('.card-save').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(id);
      refreshCardSaves();
      updateFavBadge();
    });

    container.appendChild(card);
  });
}

function refreshCardSaves() {
  const favs = getFavorites();
  document.querySelectorAll('.card-save').forEach(btn => {
    const id = btn.dataset.recipeId;
    const saved = favs.includes(id);
    btn.classList.toggle('saved', saved);
    btn.innerHTML = saved ? BOOKMARK_IN : BOOKMARK_OUT;
    btn.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save recipe');
  });
}

/* ═══════════════════════════════════════════════════════════════
   VIEW RECIPE — side panel
   ═══════════════════════════════════════════════════════════════ */
function viewRecipe(recipeId) {
  const r = recipes[recipeId];
  if (!r) return;

  const overlay = document.getElementById('overlay');
  const details = document.getElementById('recipe-details');
  const isFav = getFavorites().includes(recipeId);
  const color = catColor(r.category);

  details.innerHTML = `
    <div class="detail-cat-badge" style="color:${color}">
      <span class="cat-dot" style="background:${color}"></span>
      ${r.category}
    </div>
    <h2 class="detail-title">${r.title}</h2>
    <p class="detail-desc">${r.description}</p>

    <div class="detail-section">
      <h3>Ingredients</h3>
      <ul class="detail-list">
        ${r.ingredients.map(i => `<li>${i}</li>`).join('')}
      </ul>
    </div>

    <div class="detail-section">
      <h3>Method</h3>
      <p class="detail-instructions">${r.instructions}</p>
    </div>

    <div class="detail-section">
      <h3>Nutrition</h3>
      <div class="detail-nutrition">${r.nutrition}</div>
    </div>

    <div class="detail-toolbar">
      <button class="btn-save${isFav ? ' saved' : ''}" id="fav-btn" data-recipe-id="${recipeId}">
        ${isFav ? 'Saved' : 'Save recipe'}
      </button>
      <button class="btn-print-detail" id="print-btn">Print</button>
    </div>

    <div class="detail-timer">
      <h3>Cooking Timer</h3>
      <div class="timer-controls">
        <input type="number" id="timer-minutes" min="1" max="120" value="5" aria-label="Minutes">
        <span class="timer-min-label">min</span>
        <button id="start-timer-btn">Start</button>
      </div>
      <div id="timer-display"></div>
    </div>
  `;

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  details.querySelector('#fav-btn').addEventListener('click', () => {
    toggleFavorite(recipeId);
    viewRecipe(recipeId);
    refreshCardSaves();
    updateFavBadge();
  });
  details.querySelector('#print-btn').addEventListener('click', () => printRecipe(r));
  details.querySelector('#start-timer-btn').addEventListener('click', startTimer);
}

function closeOverlay() {
  document.getElementById('overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

/* ═══════════════════════════════════════════════════════════════
   SEARCH & CATEGORY FILTER
   ═══════════════════════════════════════════════════════════════ */
function setupSearch() {
  document.getElementById('search-bar').addEventListener('input', filterRecipes);
}

function setupCategoryTabs() {
  const tabs = document.querySelectorAll('#cat-bar .cat');
  const hiddenSelect = document.getElementById('category-filter');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      hiddenSelect.value = tab.dataset.category;
      filterRecipes();
    });
  });
}

function filterRecipes() {
  const search = document.getElementById('search-bar').value.toLowerCase();
  const category = document.getElementById('category-filter').value;
  let visible = 0;

  document.querySelectorAll('.recipe-card').forEach(card => {
    const title = card.querySelector('h3').textContent.toLowerCase();
    const cat = card.dataset.category;
    const show = (title.includes(search) || !search) && (cat === category || category === 'all');
    card.style.display = show ? '' : 'none';
    if (show) visible++;
  });

  const countEl = document.getElementById('recipe-count');
  if (countEl) countEl.textContent = `${visible} recipe${visible !== 1 ? 's' : ''}`;

  document.getElementById('no-results').classList.toggle('hidden', visible > 0);

  const titleEl = document.getElementById('recipes-title');
  titleEl.textContent = category === 'all'
    ? 'All recipes'
    : category.charAt(0).toUpperCase() + category.slice(1) + ' recipes';
}

/* ═══════════════════════════════════════════════════════════════
   FAVORITES
   ═══════════════════════════════════════════════════════════════ */
function getFavorites() {
  try { return JSON.parse(localStorage.getItem('favorites')) || []; }
  catch { return []; }
}

function toggleFavorite(id) {
  const favs = getFavorites();
  const idx = favs.indexOf(id);
  if (idx === -1) favs.push(id); else favs.splice(idx, 1);
  try { localStorage.setItem('favorites', JSON.stringify(favs)); } catch {}
}

function updateFavBadge() {
  const favs = getFavorites();
  const badge = document.getElementById('fav-count');
  if (!badge) return;
  if (favs.length > 0) {
    badge.textContent = favs.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function renderFavoritesGrid() {
  const grid = document.getElementById('favorites-grid');
  const empty = document.getElementById('no-favorites');
  const favs = getFavorites();
  grid.innerHTML = '';

  if (favs.length === 0) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  favs.forEach(id => {
    const r = recipes[id];
    if (!r) return;

    const item = document.createElement('div');
    item.className = 'fav-item';
    item.innerHTML = `
      <span class="fav-cat" style="color:${catColor(r.category)}">
        <span class="cat-dot" style="background:${catColor(r.category)}"></span>
        ${r.category}
      </span>
      <h4>${r.title}</h4>
    `;
    item.addEventListener('click', () => { closeFavSheet(); viewRecipe(id); });
    grid.appendChild(item);
  });
}

/* ═══════════════════════════════════════════════════════════════
   SHEETS (Overlay / Favorites / Contact)
   ═══════════════════════════════════════════════════════════════ */
function setupSheets() {
  document.getElementById('overlay-close').addEventListener('click', closeOverlay);
  document.querySelector('#overlay .panel-backdrop').addEventListener('click', closeOverlay);

  document.getElementById('btn-favs').addEventListener('click', openFavSheet);
  document.getElementById('fav-sheet-close').addEventListener('click', closeFavSheet);
  document.querySelector('#fav-sheet .modal-backdrop').addEventListener('click', closeFavSheet);

  document.getElementById('btn-contact').addEventListener('click', openContactSheet);
  document.getElementById('contact-sheet-close').addEventListener('click', closeContactSheet);
  document.querySelector('#contact-sheet .modal-backdrop').addEventListener('click', closeContactSheet);
}

function openFavSheet() {
  renderFavoritesGrid();
  document.getElementById('fav-sheet').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeFavSheet() {
  document.getElementById('fav-sheet').classList.add('hidden');
  if (document.getElementById('overlay').classList.contains('hidden')) document.body.style.overflow = '';
}

function openContactSheet() {
  document.getElementById('contact-sheet').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeContactSheet() {
  document.getElementById('contact-sheet').classList.add('hidden');
  if (document.getElementById('overlay').classList.contains('hidden')) document.body.style.overflow = '';
}

/* ═══════════════════════════════════════════════════════════════
   DARK MODE  (light is default; .dark enables dark palette)
   ═══════════════════════════════════════════════════════════════ */
function initDarkMode() {
  const btn = document.getElementById('toggle-dark-mode');

  try {
    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark');
    }
  } catch {}

  btn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const mode = document.body.classList.contains('dark') ? 'dark' : 'light';
    try { localStorage.setItem('theme', mode); } catch {}
  });
}

/* ═══════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ═══════════════════════════════════════════════════════════════ */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      document.getElementById('search-bar').focus();
    }
    if (e.key === 'Escape') {
      document.getElementById('search-bar').blur();
      closeOverlay();
      closeFavSheet();
      closeContactSheet();
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   PRINT
   ═══════════════════════════════════════════════════════════════ */
function printRecipe(recipe) {
  const pw = window.open('', '_blank');
  pw.document.write(`<html><head><title>${recipe.title}</title>
    <style>
      body{font-family:Georgia,serif;max-width:640px;margin:40px auto;padding:0 20px;color:#1A1815}
      h2{margin-bottom:8px;font-size:1.8rem}
      h3{margin-top:24px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.1em;color:#999;border-bottom:1px solid #eee;padding-bottom:8px}
      ul{padding-left:20px;margin-top:12px}li{margin-bottom:6px}
      p{line-height:1.7;margin-top:10px}
      .nut{margin-top:16px;padding:12px;background:#f5f2ec;border-radius:4px;font-size:0.85rem}
    </style></head><body>
    <h2>${recipe.title}</h2>
    <p>${recipe.description}</p>
    <h3>Ingredients</h3>
    <ul>${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
    <h3>Method</h3>
    <p>${recipe.instructions}</p>
    <h3>Nutrition</h3>
    <div class="nut">${recipe.nutrition}</div>
    </body></html>`);
  pw.document.close();
  pw.print();
}

/* ═══════════════════════════════════════════════════════════════
   COOKING TIMER
   ═══════════════════════════════════════════════════════════════ */
let timerInterval = null;

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);

  const minutes = parseInt(document.getElementById('timer-minutes').value) || 5;
  let seconds = minutes * 60;
  const display = document.getElementById('timer-display');

  timerInterval = setInterval(() => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    display.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    if (seconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      display.textContent = 'Done!';
      alert('Timer finished!');
    }
    seconds--;
  }, 1000);
}

/* ── Expose globals ── */
Object.assign(window, { viewRecipe, toggleFavorite, startTimer, printRecipe, filterRecipes });
