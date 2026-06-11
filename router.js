import { store } from './store.js';

export function setupRouter() {
  // Listen to popstate for back/forward navigation
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.recipe) {
      store.setActiveRecipe(e.state.recipe);
    } else {
      // If no recipe in state, we must be at the home page
      store.setActiveRecipe(null);
    }
  });

  // On initial load, check if there's a recipe in the URL
  const params = new URLSearchParams(window.location.search);
  const recipeId = params.get('recipe');
  if (recipeId) {
    // We defer setting this until recipes are loaded, handled in main.js
    // But we can store it in the state's activeRecipe immediately.
    // If recipes aren't loaded yet, components will handle it reactively.
    store.setActiveRecipe(recipeId);
    
    // Replace state so we have a clean history starting point
    window.history.replaceState({ recipe: recipeId }, '', `?recipe=${recipeId}`);
  } else {
    window.history.replaceState({ recipe: null }, '', window.location.pathname);
  }
}

export function navigateToRecipe(id) {
  store.setActiveRecipe(id);
  window.history.pushState({ recipe: id }, '', `?recipe=${id}`);
}

export function navigateHome() {
  store.setActiveRecipe(null);
  window.history.pushState({ recipe: null }, '', window.location.pathname);
}
