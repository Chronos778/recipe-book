import { recipes } from './recipes.js';

/* ── Chrome extension compat ── */
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
}

let activeRecipe = null;
let activeMultiplier = 1;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const CAT_COLORS = {
  breakfast: 'var(--cat-breakfast)',
  lunch: 'var(--cat-lunch)',
  dinner: 'var(--cat-dinner)',
  dessert: 'var(--cat-dessert)',
};

const BOOKMARK_OUT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
const BOOKMARK_IN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;

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
      // Only explode if adding to favorites (now it's just toggled, so we check if it IS in favs)
      if (getFavorites().includes(id)) {
        const rect = e.target.getBoundingClientRect();
        triggerExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
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

  activeRecipe = r;
  activeMultiplier = 1;

  const overlay = document.getElementById('overlay');
  const details = document.getElementById('recipe-details');
  const isFav = getFavorites().includes(recipeId);
  const color = catColor(r.category);

  details.innerHTML = `
    <img src="${r.image}" alt="${r.title}" class="detail-hero">
    <div class="detail-content">
      <div class="detail-cat-badge" style="color:${color}">
        <span class="cat-dot" style="background:${color}"></span>
        ${r.category}
      </div>
      <h2 class="detail-title">${r.title}</h2>
      <p class="detail-desc">${r.description}</p>

      <div class="detail-section">
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <h3>Ingredients</h3>
            <div class="servings-control">
                <button class="serving-btn active" data-multiplier="1">1x</button>
                <button class="serving-btn" data-multiplier="2">2x</button>
                <button class="serving-btn" data-multiplier="4">4x</button>
            </div>
        </div>
        <ul class="detail-list ingredients-list" id="ing-list">
          ${r.ingredients.map(i => `
            <li>
              <label class="ing-label">
                <input type="checkbox">
                <span class="ing-text">${i}</span>
              </label>
            </li>
        `).join('')}
        </ul>
      </div>

      <div class="detail-section">
        <h3>Method</h3>
        <p class="detail-instructions">${r.instructions.replace(/\n/g, '<br>')}</p>
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


    </div>
  `;

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Attach serving button listeners
  details.querySelectorAll('.serving-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      updateServings(parseInt(btn.dataset.multiplier));
    });
  });

  details.querySelector('#fav-btn').addEventListener('click', (e) => {
    toggleFavorite(recipeId);
    viewRecipe(recipeId);
    refreshCardSaves();
    updateFavBadge();
    if (getFavorites().includes(recipeId)) {
      const rect = e.target.getBoundingClientRect();
      triggerExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  });
  details.querySelector('#print-btn').addEventListener('click', () => printRecipe(r));

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

    if (show) {
      card.style.display = '';
      // Force restart of animation
      card.style.animation = 'none';
      void card.offsetWidth; // Trigger reflow
      card.style.animation = `enter 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) backwards`;
      card.style.animationDelay = `${visible * 0.05}s`;
      visible++;
    } else {
      card.style.display = 'none';
    }
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
  try { localStorage.setItem('favorites', JSON.stringify(favs)); } catch { }
}

function updateFavBadge() {
  const favs = getFavorites();
  const badge = document.getElementById('fav-count');
  const mobBadge = document.getElementById('mob-fav-count');

  const count = favs.length;

  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  if (mobBadge) {
    if (count > 0) {
      mobBadge.textContent = count;
      mobBadge.classList.remove('hidden');
    } else {
      mobBadge.classList.add('hidden');
    }
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

  /* Mobile Menu */
  const mobMenu = document.getElementById('mobile-menu');
  const mobBtn = document.getElementById('mobile-menu-btn');
  const mobClose = document.getElementById('mobile-menu-close');
  const mobBackdrop = document.querySelector('.mobile-menu-backdrop');

  if (mobBtn) {
    mobBtn.addEventListener('click', () => {
      mobMenu.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    });
  }

  function closeMobileMenu() {
    if (mobMenu) mobMenu.classList.add('hidden');
    document.body.style.overflow = '';
  }

  if (mobClose) mobClose.addEventListener('click', closeMobileMenu);
  if (mobBackdrop) mobBackdrop.addEventListener('click', closeMobileMenu);

  document.getElementById('mob-favs').addEventListener('click', () => {
    closeMobileMenu();
    openFavSheet();
  });

  document.getElementById('mob-contact').addEventListener('click', () => {
    closeMobileMenu();
    openContactSheet();
  });
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
  } catch { }

  btn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const mode = document.body.classList.contains('dark') ? 'dark' : 'light';
    try { localStorage.setItem('theme', mode); } catch { }
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
   MICRO-INTERACTIONS
   ═══════════════════════════════════════════════════════════════ */
function updateServings(multiplier) {
  if (!activeRecipe) return;
  activeMultiplier = multiplier;

  // Update buttons
  document.querySelectorAll('.serving-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === multiplier + 'x');
  });

  // Update list
  const list = document.getElementById('ing-list');
  list.innerHTML = activeRecipe.ingredients.map(ing => {
    const parsed = parseIngredient(ing);
    let text = ing;
    if (parsed) {
      const newAmount = formatAmount(parsed.amount * multiplier);
      text = `${newAmount} ${parsed.rest}`;
    }

    return `
            <li>
              <label class="ing-label">
                <input type="checkbox">
                <span class="ing-text">${text}</span>
              </label>
            </li>
        `;
  }).join('');
}

function parseIngredient(text) {
  // Basic regex for "1 1/2 cups..." or "2.5 grams..." or "4 eggs"
  // Matches start with numbers/fractions
  const match = text.match(/^((?:\d+(?:\s+\d+\/\d+|\.\d+)?|\d*\/\d+))\s+(.*)$/);
  if (!match) return null;

  // Convert to float
  let amountStr = match[1];
  let amount = 0;

  if (amountStr.includes(' ')) {
    const parts = amountStr.split(' ');
    // Handle "1 1/2" -> 1 + 0.5
    const fractionParts = parts[1].split('/');
    const fraction = parseFloat(fractionParts[0]) / parseFloat(fractionParts[1]);
    amount = parseFloat(parts[0]) + fraction;
  } else if (amountStr.includes('/')) {
    // Handle "1/2" -> 0.5
    const fractionParts = amountStr.split('/');
    amount = parseFloat(fractionParts[0]) / parseFloat(fractionParts[1]);
  } else {
    amount = parseFloat(amountStr);
  }

  return { amount, rest: match[2] };
}

function formatAmount(num) {
  // Convert back to nice fractions if possible, or just decimal
  if (Number.isInteger(num)) return num;

  const decimal = num % 1;
  const whole = Math.floor(num);

  // Simple fraction approximations
  if (Math.abs(decimal - 0.5) < 0.01) return whole ? `${whole} 1/2` : '1/2';
  if (Math.abs(decimal - 0.25) < 0.01) return whole ? `${whole} 1/4` : '1/4';
  if (Math.abs(decimal - 0.75) < 0.01) return whole ? `${whole} 3/4` : '3/4';
  if (Math.abs(decimal - 0.33) < 0.01) return whole ? `${whole} 1/3` : '1/3';
  if (Math.abs(decimal - 0.66) < 0.01) return whole ? `${whole} 2/3` : '2/3';

  return Number(num.toFixed(2));
}

function triggerExplosion(x, y) {
  const particles = 12;
  for (let i = 0; i < particles; i++) {
    const p = document.createElement('div');
    p.classList.add('particle');
    document.body.appendChild(p);

    const angle = (i / particles) * 2 * Math.PI;
    const velocity = 40 + Math.random() * 40;
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity;

    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty('--tx', `${tx}px`);
    p.style.setProperty('--ty', `${ty}px`);
    // Randomize color slightly
    p.style.background = Math.random() > 0.5 ? 'var(--accent)' : 'var(--cat-dessert)';

    p.addEventListener('animationend', () => p.remove());
  }
}

/* ── Expose globals ── */
Object.assign(window, { viewRecipe, toggleFavorite, printRecipe, filterRecipes, triggerExplosion, updateServings });
