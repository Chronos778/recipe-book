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

class Store {
  constructor() {
    this.listeners = {};
    
    // Initial state
    const initialState = {
      recipes: {},
      favorites: safeReadJSON('favorites', []),
      cart: safeReadJSON('shoppingCart', []),
      recentViews: safeReadJSON('recentViews', []),
      activeRecipeId: null,
      searchQuery: '',
      activeCategory: 'all',
      categories: [],
      feed: []
    };

    // Proxy to intercept state changes
    this.state = new Proxy(initialState, {
      set: (target, property, value) => {
        target[property] = value;
        this.notify(property, value);
        
        // Persist specific state slices
        if (property === 'favorites') safeWriteJSON('favorites', value);
        if (property === 'cart') safeWriteJSON('shoppingCart', value);
        if (property === 'recentViews') safeWriteJSON('recentViews', value);
        
        return true;
      }
    });
  }

  // Subscribe to changes on a specific property
  subscribe(property, callback) {
    if (!this.listeners[property]) {
      this.listeners[property] = [];
    }
    this.listeners[property].push(callback);
    
    // Call immediately with current value
    callback(this.state[property]);
    
    // Return unsubscribe function
    return () => {
      this.listeners[property] = this.listeners[property].filter(cb => cb !== callback);
    };
  }

  // Notify listeners of a change
  notify(property, value) {
    if (this.listeners[property]) {
      this.listeners[property].forEach(callback => callback(value));
    }
  }

  // Actions
  setRecipes(recipes) {
    this.state.recipes = recipes;
  }

  toggleFavorite(id) {
    const favs = [...this.state.favorites];
    const idx = favs.indexOf(id);
    if (idx === -1) favs.push(id);
    else favs.splice(idx, 1);
    this.state.favorites = favs;
  }

  toggleCart(id) {
    const cart = [...this.state.cart];
    const idx = cart.indexOf(id);
    if (idx === -1) cart.push(id);
    else cart.splice(idx, 1);
    this.state.cart = cart;
  }
  
  clearCart() {
    this.state.cart = [];
  }

  addRecentView(id) {
    let recents = [...this.state.recentViews];
    recents = recents.filter(rid => rid !== id);
    recents.unshift(id);
    this.state.recentViews = recents.slice(0, 6);
  }

  setActiveRecipe(id) {
    this.state.activeRecipeId = id;
    if (id) {
      this.addRecentView(id);
    }
  }

  setSearchQuery(query) {
    this.state.searchQuery = query.toLowerCase();
  }

  setActiveCategory(category) {
    this.state.activeCategory = category;
  }

  setCategories(cats) {
    this.state.categories = cats;
  }
  setFeed(feedItems) {
    this.state.feed = feedItems;
  }
}

export const store = new Store();
