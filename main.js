import { recipes } from './recipes.js';

/* ── Chrome extension compat ── */
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
}

let activeRecipe = null;
let activeMultiplier = 1;
let closeMobileMenuHandler = null;
const focusReturnStack = [];

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
const DEFAULT_TIME_BY_CATEGORY = {
  breakfast: '20 min',
  lunch: '25 min',
  dinner: '35 min',
  dessert: '45 min',
};

function catColor(cat) { return CAT_COLORS[cat] || 'var(--ink-3)'; }

function inferDifficulty(recipe) {
  const count = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0;
  if (count <= 6) return 'Easy';
  if (count <= 8) return 'Medium';
  return 'Hard';
}

function getRecipeMeta(recipe) {
  const servings = Number.isFinite(recipe.servings) ? recipe.servings : 2;
  const difficulty = recipe.difficulty || inferDifficulty(recipe);
  const totalTime = recipe.totalTime || DEFAULT_TIME_BY_CATEGORY[recipe.category] || '30 min';
  return { servings, difficulty, totalTime };
}

function safeReadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function safeReadText(key, fallback = '') {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : raw;
  } catch {
    return fallback;
  }
}

function safeWriteText(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function rememberFocus() {
  const active = document.activeElement;
  focusReturnStack.push(active instanceof HTMLElement ? active : null);
}

function restoreFocus() {
  const previous = focusReturnStack.pop();
  if (previous && previous.isConnected) previous.focus();
}

function syncBodyScrollLock() {
  const hasOpenLayer =
    !document.getElementById('overlay').classList.contains('hidden') ||
    !document.getElementById('fav-sheet').classList.contains('hidden') ||
    !document.getElementById('contact-sheet').classList.contains('hidden') ||
    !document.getElementById('mobile-menu').classList.contains('hidden');
  document.body.style.overflow = hasOpenLayer ? 'hidden' : '';
}

function focusFirstElement(container) {
  if (!container) return;
  const focusables = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusables.length) {
    focusables[0].focus();
  } else {
    container.focus();
  }
}

function trapFocus(event, container) {
  if (event.key !== 'Tab' || !container || container.classList.contains('hidden')) return;
  const focusables = Array.from(container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
  if (!focusables.length) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/* ═══════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
  renderRecipeCards();
  renderRecentViews();
  initDarkMode();
  setupSearch();
  setupCategoryTabs();
  setupSheets();
  setupKeyboardShortcuts();
  setupScrollDetect();
  updateFavBadge();
}

function getRecentViews() {
  const ids = safeReadJSON('recentViews', []);
  return Array.isArray(ids) ? ids.filter(id => recipes[id]) : [];
}

function pushRecentView(recipeId) {
  const recents = getRecentViews().filter(id => id !== recipeId);
  recents.unshift(recipeId);
  safeWriteJSON('recentViews', recents.slice(0, 6));
}

function renderRecentViews() {
  const section = document.getElementById('recently-viewed');
  const list = document.getElementById('recently-viewed-list');
  if (!section || !list) return;

  const recents = getRecentViews();
  list.innerHTML = '';

  if (!recents.length) {
    section.classList.add('hidden');
    return;
  }

  recents.forEach((id) => {
    const recipe = recipes[id];
    if (!recipe) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recent-pill';
    button.innerHTML = `<span class="cat-dot" style="color:${catColor(recipe.category)}"></span>${recipe.title}`;
    button.addEventListener('click', () => viewRecipe(id));
    list.appendChild(button);
  });

  section.classList.remove('hidden');
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

  ids.forEach((id, i) => {
    const r = recipes[id];
    const meta = getRecipeMeta(r);
    const isFav = getFavorites().includes(id);
    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.dataset.category = r.category;
    card.dataset.recipeId = id;
    card.dataset.searchText = `${r.title} ${r.ingredients.join(' ')}`.toLowerCase();
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View recipe: ${r.title}`);
    card.style.setProperty('--card-accent', catColor(r.category));
    card.style.animationDelay = `${0.24 + i * 0.07}s`;

    card.innerHTML = `
      <div class="card-top">
        <span class="card-cat"><span class="cat-dot"></span>${r.category}</span>
        <button type="button" class="card-save${isFav ? ' saved' : ''}" data-recipe-id="${id}" aria-label="${isFav ? 'Remove from saved' : 'Save recipe'}">${isFav ? BOOKMARK_IN : BOOKMARK_OUT}</button>
      </div>
      <h3 class="card-title">${r.title}</h3>
      <p class="card-desc">${r.description}</p>
      <p class="card-meta">Serves ${meta.servings} · ${meta.totalTime} · ${meta.difficulty}</p>
      <span class="card-cta">Read recipe <span class="arrow">\u2192</span></span>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-save')) return;
      viewRecipe(id);
    });

    card.addEventListener('keydown', (e) => {
      if (e.target.closest('.card-save')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        viewRecipe(id);
      }
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

  updateCategoryCounts();
  filterRecipes();
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

  pushRecentView(recipeId);
  renderRecentViews();

  activeRecipe = r;
  activeMultiplier = 1;

  const overlay = document.getElementById('overlay');
  const details = document.getElementById('recipe-details');
  const isFav = getFavorites().includes(recipeId);
  const color = catColor(r.category);
  const meta = getRecipeMeta(r);

  details.innerHTML = `
    <img src="${r.image}" alt="${r.title}" class="detail-hero" loading="lazy" decoding="async">
    <div class="detail-content">
      <div class="detail-cat-badge" style="color:${color}">
        <span class="cat-dot" style="background:${color}"></span>
        ${r.category}
      </div>
      <h2 id="recipe-detail-title" class="detail-title">${r.title}</h2>
      <p class="detail-desc">${r.description}</p>

      <div class="detail-meta" aria-label="Recipe details">
        <span class="meta-chip">Serves ${meta.servings}</span>
        <span class="meta-chip">${meta.totalTime}</span>
        <span class="meta-chip">${meta.difficulty}</span>
      </div>

      <div class="detail-section">
        <div class="detail-section-head">
            <h3>Ingredients</h3>
            <div class="servings-control">
                <button type="button" class="serving-btn active" data-multiplier="1">1x</button>
                <button type="button" class="serving-btn" data-multiplier="2">2x</button>
                <button type="button" class="serving-btn" data-multiplier="4">4x</button>
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
        <button type="button" class="btn-save${isFav ? ' saved' : ''}" id="fav-btn" data-recipe-id="${recipeId}">
          ${isFav ? 'Saved' : 'Save recipe'}
        </button>
        <button type="button" class="btn-print-detail" id="print-btn">Print</button>
      </div>


    </div>
  `;

  overlay.classList.remove('hidden');
  rememberFocus();
  focusFirstElement(overlay.querySelector('.panel-drawer'));
  syncBodyScrollLock();

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
  syncBodyScrollLock();
  restoreFocus();
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
    if (!tab.dataset.baseLabel) {
      tab.dataset.baseLabel = tab.textContent.trim();
    }
  });

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      tabs.forEach(t => t.setAttribute('aria-current', 'false'));
      tab.setAttribute('aria-current', 'true');
      hiddenSelect.value = tab.dataset.category;
      filterRecipes();
    });
  });

  updateCategoryCounts();
}

function updateCategoryCounts() {
  const counts = { all: 0 };
  Object.values(recipes).forEach((recipe) => {
    counts.all += 1;
    counts[recipe.category] = (counts[recipe.category] || 0) + 1;
  });

  document.querySelectorAll('#cat-bar .cat').forEach((tab) => {
    const category = tab.dataset.category;
    const baseLabel = tab.dataset.baseLabel || tab.textContent.trim();
    const count = counts[category] || 0;
    tab.textContent = `${baseLabel} (${count})`;
  });
}

function filterRecipes() {
  const search = document.getElementById('search-bar').value.toLowerCase();
  const category = document.getElementById('category-filter').value;
  let visible = 0;

  document.querySelectorAll('.recipe-card').forEach(card => {
    const searchText = card.dataset.searchText || '';
    const cat = card.dataset.category;
    const show = (searchText.includes(search) || !search) && (cat === category || category === 'all');

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
  const favs = safeReadJSON('favorites', []);
  return Array.isArray(favs) ? favs : [];
}

function toggleFavorite(id) {
  const favs = getFavorites();
  const idx = favs.indexOf(id);
  if (idx === -1) favs.push(id); else favs.splice(idx, 1);
  safeWriteJSON('favorites', favs);
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
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `Open saved recipe: ${r.title}`);
    item.innerHTML = `
      <span class="fav-cat" style="color:${catColor(r.category)}">
        <span class="cat-dot" style="background:${catColor(r.category)}"></span>
        ${r.category}
      </span>
      <h4>${r.title}</h4>
    `;
    item.addEventListener('click', () => { closeFavSheet(); viewRecipe(id); });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        closeFavSheet();
        viewRecipe(id);
      }
    });
    grid.appendChild(item);
  });
}

/* ═══════════════════════════════════════════════════════════════
   SHEETS (Overlay / Favorites / Contact)
   ═══════════════════════════════════════════════════════════════ */
function setupSheets() {
  const overlay = document.getElementById('overlay');
  const favSheet = document.getElementById('fav-sheet');
  const contactSheet = document.getElementById('contact-sheet');

  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('hidden')) trapFocus(e, overlay.querySelector('.panel-drawer'));
    else if (!favSheet.classList.contains('hidden')) trapFocus(e, favSheet.querySelector('.modal-box'));
    else if (!contactSheet.classList.contains('hidden')) trapFocus(e, contactSheet.querySelector('.modal-box'));
    else {
      const mobileMenu = document.getElementById('mobile-menu');
      if (!mobileMenu.classList.contains('hidden')) trapFocus(e, mobileMenu.querySelector('.mobile-menu-content'));
    }
  });

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
      rememberFocus();
      mobMenu.classList.remove('hidden');
      mobBtn.setAttribute('aria-expanded', 'true');
      focusFirstElement(mobMenu.querySelector('.mobile-menu-content'));
      syncBodyScrollLock();
    });
  }

  function closeMobileMenu() {
    if (mobMenu) {
      mobMenu.classList.add('hidden');
      if (mobBtn) mobBtn.setAttribute('aria-expanded', 'false');
      syncBodyScrollLock();
      restoreFocus();
    }
  }

  closeMobileMenuHandler = closeMobileMenu;

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
  const sheet = document.getElementById('fav-sheet');
  rememberFocus();
  sheet.classList.remove('hidden');
  focusFirstElement(sheet.querySelector('.modal-box'));
  syncBodyScrollLock();
}
function closeFavSheet() {
  document.getElementById('fav-sheet').classList.add('hidden');
  syncBodyScrollLock();
  restoreFocus();
}

function openContactSheet() {
  const sheet = document.getElementById('contact-sheet');
  rememberFocus();
  sheet.classList.remove('hidden');
  focusFirstElement(sheet.querySelector('.modal-box'));
  syncBodyScrollLock();
}
function closeContactSheet() {
  document.getElementById('contact-sheet').classList.add('hidden');
  syncBodyScrollLock();
  restoreFocus();
}

/* ═══════════════════════════════════════════════════════════════
   DARK MODE  (light is default; .dark enables dark palette)
   ═══════════════════════════════════════════════════════════════ */
function initDarkMode() {
  const btn = document.getElementById('toggle-dark-mode');

  if (safeReadText('theme', 'light') === 'dark') {
    document.body.classList.add('dark');
  }

  btn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const mode = document.body.classList.contains('dark') ? 'dark' : 'light';
    safeWriteText('theme', mode);
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
      const overlay = document.getElementById('overlay');
      const favSheet = document.getElementById('fav-sheet');
      const contactSheet = document.getElementById('contact-sheet');
      const mobileMenu = document.getElementById('mobile-menu');

      if (!mobileMenu.classList.contains('hidden') && closeMobileMenuHandler) {
        closeMobileMenuHandler();
      } else if (!overlay.classList.contains('hidden')) {
        closeOverlay();
      } else if (!favSheet.classList.contains('hidden')) {
        closeFavSheet();
      } else if (!contactSheet.classList.contains('hidden')) {
        closeContactSheet();
      }
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
