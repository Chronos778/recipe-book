import { store } from './store.js';

export async function fetchRecipes() {
  try {
    const response = await fetch('recipes.json');
    if (!response.ok) throw new Error('Failed to fetch recipes');
    const data = await response.json();
    store.setRecipes(data);
    return data;
  } catch (error) {
    console.error('Error loading recipes:', error);
    // You could set an error state here if added to the store
    return null;
  }
}
