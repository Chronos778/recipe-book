import { store } from './store.js';
import { navigateToRecipe, navigateHome } from './router.js';
import { 
  getRecipeMeta, catColor, formatInstructions, 
  triggerExplosion, BOOKMARK_IN, BOOKMARK_OUT, parseIngredient, formatAmount,
  rememberFocus, restoreFocus, syncBodyScrollLock, focusFirstElement, playDing,
  escapeHtml, generateMacrosFromIngredients, renderMacros, parseInstructionSteps,
  formatSingleInstruction
} from './utils.js';

let activeMultiplier = 1;
export let activeTimers = [];
let windowTimerInterval = null;

// Subscribe to store changes to automatically update UI
export function setupReactivity() {
  store.subscribe('feed', () => {
    renderRecipeCards();
  });
  
  store.subscribe('categories', renderCategoryTabs);
  store.subscribe('activeCategory', renderCategoryTabs);

  store.subscribe('favorites', () => {
    updateFavBadge();
    refreshCardSaves();
    renderFavoritesGrid();
    if (store.state.activeRecipeId) {
      // Refresh the save button in the detail view without full re-render
      const btn = document.getElementById('fav-btn');
      if (btn) {
        const isFav = store.state.favorites.includes(store.state.activeRecipeId);
        btn.classList.toggle('saved', isFav);
        btn.textContent = isFav ? 'Saved' : 'Save recipe';
      }
    }
  });

  store.subscribe('cart', () => {
    updateCartBadge();
    renderCartItems();
    // Refresh card cart icons
    document.querySelectorAll('.card-cart').forEach(btn => {
      const inCart = store.state.cart.includes(btn.dataset.recipeId);
      btn.classList.toggle('in-cart', inCart);
      btn.setAttribute('aria-label', inCart ? 'Remove from cart' : 'Add to cart');
    });
    // Refresh detail cart button
    if (store.state.activeRecipeId) {
      const btn = document.getElementById('cart-add-btn');
      if (btn) {
        const inCart = store.state.cart.includes(store.state.activeRecipeId);
        btn.classList.toggle('saved', inCart);
        btn.textContent = inCart ? 'In List' : 'Add to List';
      }
    }
  });

  store.subscribe('recentViews', () => renderRecentViews());

  store.subscribe('activeRecipeId', async (id) => {
    if (id) {
      if (!store.state.recipes[id]) {
        const api = await import('./api.js');
        await api.fetchRecipeById(id);
      }
      viewRecipe(id);
    } else {
      closeOverlay();
    }
  });
}

// -----------------------------------------------------------------------------
// BADGES
// -----------------------------------------------------------------------------
function updateFavBadge() {
  const favs = store.state.favorites;
  const badge = document.getElementById('fav-count');
  const mobBadge = document.getElementById('mob-fav-count');
  const count = favs.length;

  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  }
  if (mobBadge) {
    mobBadge.textContent = count;
    mobBadge.classList.toggle('hidden', count === 0);
  }
}

function updateCartBadge() {
  const cart = store.state.cart;
  const badge = document.getElementById('cart-count');
  const mobBadge = document.getElementById('mob-cart-count');
  const count = cart.length;

  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  }
  if (mobBadge) {
    mobBadge.textContent = count;
    mobBadge.classList.toggle('hidden', count === 0);
  }
}

// -----------------------------------------------------------------------------
// RECIPE CARDS & LISTINGS
// -----------------------------------------------------------------------------
function renderRecipeCards() {
  const grid = document.getElementById('recipes');
  if (!grid) return;
  grid.innerHTML = '';

  const feed = store.state.feed;
  const count = feed.length;

  const countEl = document.getElementById('recipe-count');
  if (countEl) countEl.textContent = `${count} recipe${count !== 1 ? 's' : ''}`;

  const noRes = document.getElementById('no-results');
  if(noRes) noRes.classList.toggle('hidden', count > 0);

  const titleEl = document.getElementById('recipes-title');
  const category = store.state.activeCategory;
  if (titleEl) {
    titleEl.textContent = category === 'all'
      ? 'All recipes'
      : category.charAt(0).toUpperCase() + category.slice(1) + ' recipes';
  }

  const frag = document.createDocumentFragment();

  feed.forEach((item, i) => {
    const id = item.id;
    const r = store.state.recipes[id];
    
    let meta = { servings: 2, totalTime: '30 min', difficulty: 'Medium' };
    if (r) {
      meta = getRecipeMeta(r);
    }

    const isFav = store.state.favorites.includes(id);
    const inCart = store.state.cart.includes(id);
    const catName = escapeHtml(item.category || 'Other');
    
    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.dataset.category = catName;
    card.dataset.recipeId = id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View recipe: ${escapeHtml(item.title)}`);
    card.style.setProperty('--card-accent', catColor(catName));
    card.style.animationDelay = `${0.24 + i * 0.05}s`;

    card.innerHTML = `
      <div class="card-top">
        <span class="card-cat"><span class="cat-dot"></span>${catName}</span>
        <div class="card-actions">
           <button type="button" class="card-cart${inCart ? ' in-cart' : ''}" data-recipe-id="${escapeHtml(id)}" aria-label="${inCart ? 'Remove from cart' : 'Add to cart'}">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
           </button>
           <button type="button" class="card-save${isFav ? ' saved' : ''}" data-recipe-id="${escapeHtml(id)}" aria-label="${isFav ? 'Remove from saved' : 'Save recipe'}">${isFav ? BOOKMARK_IN : BOOKMARK_OUT}</button>
        </div>
      </div>
      <div class="card-img-wrap" style="height: 140px; overflow: hidden; border-radius: 8px; margin-bottom: 12px; background: #222;">
         <img src="${item.image}/preview" alt="${escapeHtml(item.title)}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;" />
      </div>
      <h3 class="card-title">${escapeHtml(item.title)}</h3>
      ${r ? `<p class="card-meta">Serves ${escapeHtml(meta.servings)} · ${escapeHtml(meta.totalTime)} · ${escapeHtml(meta.difficulty)}</p>` : ''}
      <span class="card-cta">Read recipe <span class="arrow">\u2192</span></span>
    `;

    frag.appendChild(card);
  });
  
  grid.appendChild(frag);
}

function refreshCardSaves() {
  const favs = store.state.favorites;
  document.querySelectorAll('.card-save').forEach(btn => {
    const id = btn.dataset.recipeId;
    const saved = favs.includes(id);
    btn.classList.toggle('saved', saved);
    btn.innerHTML = saved ? BOOKMARK_IN : BOOKMARK_OUT;
    btn.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save recipe');
  });
}

function renderCategoryTabs() {
  const catBar = document.getElementById('cat-bar');
  if (!catBar) return;
  const activeCat = store.state.activeCategory;
  
  catBar.innerHTML = `<button class="cat ${activeCat === 'all' ? 'active' : ''}" data-category="all" aria-current="${activeCat === 'all' ? 'true' : 'false'}">Discover</button>`;
  
  store.state.categories.forEach(cat => {
    const btn = document.createElement('button');
    const isActive = activeCat === cat;
    btn.className = `cat ${isActive ? 'active' : ''}`;
    btn.dataset.category = cat;
    btn.setAttribute('aria-current', isActive ? 'true' : 'false');
    btn.textContent = cat;
    catBar.appendChild(btn);
  });
}

// -----------------------------------------------------------------------------
// RECENT VIEWS
// -----------------------------------------------------------------------------
function renderRecentViews() {
  const section = document.getElementById('recently-viewed');
  const list = document.getElementById('recently-viewed-list');
  if (!section || !list) return;

  const recents = store.state.recentViews.filter(id => store.state.recipes[id]);
  list.innerHTML = '';

  if (!recents.length) {
    section.classList.add('hidden');
    return;
  }

  recents.forEach((id) => {
    const recipe = store.state.recipes[id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recent-pill';
    const dot = document.createElement('span');
    dot.className = 'cat-dot';
    dot.style.color = catColor(recipe.category);
    button.appendChild(dot);
    button.appendChild(document.createTextNode(recipe.title));
    button.addEventListener('click', () => navigateToRecipe(id));
    list.appendChild(button);
  });

  section.classList.remove('hidden');
}

// -----------------------------------------------------------------------------
// RECIPE DETAIL OVERLAY
// -----------------------------------------------------------------------------
export function viewRecipe(recipeId) {
  const r = store.state.recipes[recipeId];
  if (!r) return;

  activeMultiplier = 1;

  const overlay = document.getElementById('overlay');
  const details = document.getElementById('recipe-details');
  const isFav = store.state.favorites.includes(recipeId);
  const inCart = store.state.cart.includes(recipeId);
  const color = catColor(r.category);
  const meta = getRecipeMeta(r);

  details.innerHTML = `
    <img src="${escapeHtml(r.image)}" alt="${escapeHtml(r.title)}" class="detail-hero" loading="lazy" decoding="async">
    <div class="detail-content">
      <div class="detail-cat-badge" style="color:${color}">
        <span class="cat-dot" style="background:${color}"></span>
        ${escapeHtml(r.category)}
      </div>
      <h2 id="recipe-detail-title" class="detail-title">${escapeHtml(r.title)}</h2>

      <div class="detail-meta" aria-label="Recipe details">
        <span class="meta-chip">Serves ${escapeHtml(meta.servings)}</span>
        <span class="meta-chip">${escapeHtml(meta.totalTime)}</span>
        <span class="meta-chip">${escapeHtml(meta.difficulty)}</span>
      </div>

      <div class="detail-section">
        <div class="detail-section-head">
            <h3>Ingredients</h3>
            <div class="servings-control">
                <button type="button" class="serve-btn serve-minus" aria-label="Decrease servings">&minus;</button>
                <span class="serve-count" aria-live="polite">${escapeHtml(meta.servings)} servings</span>
                <button type="button" class="serve-btn serve-plus" aria-label="Increase servings">&plus;</button>
            </div>
        </div>
        <ul class="detail-list ingredients-list" id="ing-list">
          ${r.ingredients.map(i => `
            <li>
              <label class="ing-label">
                <input type="checkbox">
                <span class="ing-text">${escapeHtml(i)}</span>
              </label>
            </li>
        `).join('')}
        </ul>
      </div>

      <div class="detail-section">
        <h3>Method</h3>
        ${formatInstructions(r.instructions)}
      </div>

      <div class="detail-section">
        <h3>Nutrition per Serving</h3>
        <div id="macro-container">
          ${renderMacros(generateMacrosFromIngredients(r.ingredients), 1 / meta.servings)}
        </div>
      </div>

      <div class="detail-toolbar">
        <button type="button" class="btn-save${isFav ? ' saved' : ''}" id="fav-btn" data-recipe-id="${escapeHtml(recipeId)}">
          ${isFav ? 'Saved' : 'Save recipe'}
        </button>
        <button type="button" class="btn-save${inCart ? ' saved' : ''}" id="cart-add-btn" data-recipe-id="${escapeHtml(recipeId)}">
          ${inCart ? 'In List' : 'Add to List'}
        </button>
        <button type="button" class="btn-cooking-mode btn-save" id="cooking-mode-btn">Cooking Mode</button>
        <button type="button" class="btn-print-detail" id="print-btn">Print</button>
      </div>
    </div>
  `;

  if (overlay.classList.contains('hidden')) {
    rememberFocus();
    overlay.classList.remove('hidden');
    focusFirstElement(overlay.querySelector('.panel-drawer'));
    syncBodyScrollLock();
  }

  // Attach serving button listeners
  let activeServings = meta.servings;
  const updateServingsDisplay = () => {
    details.querySelector('.serve-count').textContent = `${activeServings} serving${activeServings > 1 ? 's' : ''}`;
    updateServings(activeServings / meta.servings, r);
  };

  details.querySelector('.serve-minus').addEventListener('click', () => {
    if (activeServings > 1) {
      activeServings--;
      updateServingsDisplay();
    }
  });

  details.querySelector('.serve-plus').addEventListener('click', () => {
    activeServings++;
    updateServingsDisplay();
  });

  details.querySelector('#fav-btn').addEventListener('click', (e) => {
    store.toggleFavorite(recipeId);
    if (store.state.favorites.includes(recipeId)) {
      const rect = e.target.getBoundingClientRect();
      triggerExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  });

  details.querySelector('#cart-add-btn').addEventListener('click', (e) => {
    store.toggleCart(recipeId);
    if (store.state.cart.includes(recipeId)) {
      const rect = e.target.getBoundingClientRect();
      triggerExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  });

  details.querySelector('#cooking-mode-btn').addEventListener('click', () => openCookingMode(r));
  details.querySelector('#print-btn').addEventListener('click', () => window.print());
}

export function closeOverlay() {
  const overlay = document.getElementById('overlay');
  if (overlay && !overlay.classList.contains('hidden')) {
    overlay.classList.add('hidden');
    syncBodyScrollLock();
    restoreFocus();
  }
}

function updateServings(multiplier, recipe) {
  activeMultiplier = multiplier;
  const list = document.getElementById('ing-list');
  list.innerHTML = recipe.ingredients.map(ing => {
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
          <span class="ing-text">${escapeHtml(text)}</span>
        </label>
      </li>
    `;
  }).join('');

}

// -----------------------------------------------------------------------------
// FAVORITES GRID
// -----------------------------------------------------------------------------
export function renderFavoritesGrid() {
  const grid = document.getElementById('favorites-grid');
  const empty = document.getElementById('no-favorites');
  const favs = store.state.favorites;
  if (!grid || !empty) return;
  
  grid.innerHTML = '';

  if (favs.length === 0) { 
    empty.style.display = ''; 
    return; 
  }
  empty.style.display = 'none';

  const frag = document.createDocumentFragment();

  favs.forEach(id => {
    const r = store.state.recipes[id];
    if (!r) return;

    const item = document.createElement('div');
    item.className = 'fav-item';
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `Open saved recipe: ${escapeHtml(r.title)}`);
    item.innerHTML = `
      <span class="fav-cat" style="color:${catColor(r.category)}">
        <span class="cat-dot" style="background:${catColor(r.category)}"></span>
        ${escapeHtml(r.category)}
      </span>
      <h4>${escapeHtml(r.title)}</h4>
    `;
    
    item.addEventListener('click', () => { 
      document.getElementById('fav-sheet').classList.add('hidden');
      syncBodyScrollLock();
      restoreFocus(); // Fix for focus flow
      navigateToRecipe(id); 
    });
    
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        document.getElementById('fav-sheet').classList.add('hidden');
        syncBodyScrollLock();
        restoreFocus(); // Fix for focus flow
        navigateToRecipe(id);
      }
    });
    frag.appendChild(item);
  });
  
  grid.appendChild(frag);
}

// -----------------------------------------------------------------------------
// CART
// -----------------------------------------------------------------------------
export function renderCartItems() {
  const container = document.getElementById('cart-items');
  const empty = document.getElementById('no-cart');
  const actions = document.getElementById('cart-actions');
  const cart = store.state.cart;
  if (!container || !empty || !actions) return;
  
  container.innerHTML = '';

  if (cart.length === 0) { 
    empty.style.display = ''; 
    actions.style.display = 'none';
    return; 
  }
  
  empty.style.display = 'none';
  actions.style.display = 'block';

  const frag = document.createDocumentFragment();

  cart.forEach(id => {
    const r = store.state.recipes[id];
    if (!r) return;

    const group = document.createElement('div');
    group.className = 'cart-recipe-group';
    group.innerHTML = `<h3 class="cart-recipe-title">${escapeHtml(r.title)}</h3>`;
    
    r.ingredients.forEach(ing => {
      group.innerHTML += `
        <label class="cart-ingredient">
          <input type="checkbox">
          <span>${escapeHtml(ing)}</span>
        </label>
      `;
    });
    frag.appendChild(group);
  });
  
  container.appendChild(frag);
  
  const clearBtn = document.getElementById('cart-clear');
  if (clearBtn) {
    clearBtn.onclick = () => store.clearCart();
  }
}

// -----------------------------------------------------------------------------
// COOKING MODE
// -----------------------------------------------------------------------------
let cookingSteps = [];
let currentCookingStep = 0;
let wakeLock = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (err) { }
}

function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => { wakeLock = null; });
  }
}

export function openCookingMode(recipe) {
  cookingSteps = parseInstructionSteps(recipe.instructions);
  if (cookingSteps.length === 0) cookingSteps = ["No instructions available."];
  currentCookingStep = 0;
  
  document.getElementById('cooking-mode-title').textContent = recipe.title;
  updateCookingModeUI();
  
  const overlay = document.getElementById('cooking-mode-overlay');
  rememberFocus();
  overlay.classList.remove('hidden');
  focusFirstElement(overlay);
  syncBodyScrollLock();
  requestWakeLock();
}

export function closeCookingMode() {
  document.getElementById('cooking-mode-overlay').classList.add('hidden');
  syncBodyScrollLock();
  restoreFocus();
  releaseWakeLock();
}

export function updateCookingModeUI() {
  const textEl = document.getElementById('cooking-step-text');
  const progEl = document.getElementById('cooking-progress');
  const prevBtn = document.getElementById('cooking-prev');
  const nextBtn = document.getElementById('cooking-next');
  
  let stepText = cookingSteps[currentCookingStep].replace(/^\d+[\.\)]\s*/, '');
  textEl.innerHTML = formatSingleInstruction(stepText);
  progEl.textContent = `Step ${currentCookingStep + 1} of ${cookingSteps.length}`;
  
  prevBtn.disabled = currentCookingStep === 0;
  nextBtn.textContent = currentCookingStep === cookingSteps.length - 1 ? "Finish" : "Next Step";
}

export function nextCookingStep() {
    if (currentCookingStep < cookingSteps.length - 1) {
        currentCookingStep++;
        updateCookingModeUI();
    } else {
        closeCookingMode();
    }
}

export function prevCookingStep() {
    if (currentCookingStep > 0) {
        currentCookingStep--;
        updateCookingModeUI();
    }
}


// -----------------------------------------------------------------------------
// TIMERS
// -----------------------------------------------------------------------------
export function startTimer(amount, unit) {
  let ms = amount * 60000;
  if (unit.toLowerCase().startsWith('hr') || unit.toLowerCase().startsWith('hour')) {
    ms = amount * 3600000;
  }
  
  const timer = { id: Date.now(), end: Date.now() + ms, total: ms, done: false };
  activeTimers.push(timer);
  renderTimers();
  
  if (!windowTimerInterval) {
    windowTimerInterval = setInterval(updateTimers, 1000);
  }
}

function updateTimers() {
  if (activeTimers.length === 0) {
    clearInterval(windowTimerInterval);
    windowTimerInterval = null;
    return;
  }
  
  const now = Date.now();
  
  activeTimers.forEach(t => {
    if (now >= t.end && !t.done) {
      t.done = true;
      playDing();
    }
  });
  
  renderTimers();
}

export function removeTimer(id) {
  activeTimers = activeTimers.filter(t => t.id !== id);
  renderTimers();
}

export function renderTimers() {
  const container = document.getElementById('active-timers');
  if (!container) return;
  
  if (activeTimers.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  const now = Date.now();
  container.innerHTML = activeTimers.map(t => {
    if (t.done) {
      return `
        <div class="active-timer active-timer--done">
          <span class="timer-text">Timer Done!</span>
          <button type="button" class="timer-close" data-id="${t.id}">&times;</button>
        </div>
      `;
    }
    
    const left = Math.max(0, t.end - now);
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    const timeStr = `${m}:${s.toString().padStart(2, '0')}`;
    const pct = ((t.total - left) / t.total) * 100;
    
    return `
      <div class="active-timer">
        <div class="timer-ring-bg">
           <div class="timer-ring-fg" style="width: ${pct}%"></div>
        </div>
        <span class="timer-text">${timeStr}</span>
        <button type="button" class="timer-close" data-id="${t.id}">&times;</button>
      </div>
    `;
  }).join('');
}
