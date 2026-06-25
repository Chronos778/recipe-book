import { store } from './store.js';

// Helper to parse full meal details and return a lightweight feed item
function processFullMeals(meals) {
  const newRecipes = {};
  const feedItems = [];

  if (meals) {
    meals.forEach(meal => {
      const ingredients = [];
      for (let i = 1; i <= 20; i++) {
        const ingredient = meal[`strIngredient${i}`];
        const measure = meal[`strMeasure${i}`];
        if (ingredient && ingredient.trim() !== '') {
          const formattedMeasure = measure ? measure.trim() : '';
          ingredients.push(`${formattedMeasure} ${ingredient}`.trim());
        }
      }

      newRecipes[meal.idMeal] = {
        title: meal.strMeal || 'Unknown Recipe',
        image: meal.strMealThumb || '',
        instructions: meal.strInstructions || '',
        category: meal.strCategory || 'Other',
        ingredients: ingredients
      };

      feedItems.push({
        id: meal.idMeal,
        title: meal.strMeal,
        image: meal.strMealThumb,
        category: meal.strCategory || 'Other'
      });
    });
  }

  // Merge full details into store cache
  store.setRecipes({ ...store.state.recipes, ...newRecipes });
  return feedItems;
}

const apiCache = new Map();

export async function fetchCategories() {
  if (apiCache.has('categories')) {
    store.setCategories(apiCache.get('categories'));
    return;
  }
  try {
    const response = await fetch('https://www.themealdb.com/api/json/v1/1/categories.php');
    const data = await response.json();
    if (data.categories) {
      const cats = data.categories.map(c => c.strCategory).sort();
      apiCache.set('categories', cats);
      store.setCategories(cats);
    }
  } catch (err) {
    console.error('Error fetching categories:', err);
  }
}

export async function fetchRandomFeed() {
  try {
    const letters = 'bcdefghiklmnoprstvw';
    const randomLetter = letters[Math.floor(Math.random() * letters.length)];
    const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?f=${randomLetter}`);
    const data = await response.json();
    
    const feed = processFullMeals(data.meals);
    store.setFeed(feed);
  } catch (err) {
    console.error('Error loading random feed:', err);
  }
}

export async function fetchSearch(query) {
  const cacheKey = `search_${query}`;
  if (apiCache.has(cacheKey)) {
    store.setFeed(apiCache.get(cacheKey));
    return;
  }
  try {
    const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    const feed = processFullMeals(data.meals);
    apiCache.set(cacheKey, feed);
    store.setFeed(feed);
  } catch (err) {
    console.error('Error searching recipes:', err);
  }
}

export async function fetchByCategory(category) {
  const cacheKey = `cat_${category}`;
  if (apiCache.has(cacheKey)) {
    store.setFeed(apiCache.get(cacheKey));
    return;
  }
  try {
    const response = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(category)}`);
    const data = await response.json();
    
    const feedItems = [];
    if (data.meals) {
      data.meals.forEach(meal => {
        feedItems.push({
          id: meal.idMeal,
          title: meal.strMeal,
          image: meal.strMealThumb,
          category: category // Filter endpoint doesn't return category, but we know it
        });
      });
    }
    
    apiCache.set(cacheKey, feedItems);
    store.setFeed(feedItems);
  } catch (err) {
    console.error('Error fetching category:', err);
  }
}

export async function fetchRecipeById(id) {
  // If we already have the full details cached, skip fetch
  if (store.state.recipes[id]) return store.state.recipes[id];
  
  try {
    const response = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`);
    const data = await response.json();
    processFullMeals(data.meals);
    return store.state.recipes[id];
  } catch (err) {
    console.error('Error fetching recipe details:', err);
    return null;
  }
}
