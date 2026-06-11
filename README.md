# Cooking for Cooked's

Welcome to Cooking for Cooked's! This website is a comprehensive recipe book where you can discover a variety of delicious recipes to try at home. From appetizers to desserts, find your next favorite dish!

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Service Worker](#service-worker)
- [Manifest](#manifest)
- [Contributing](#contributing)

## Features

- **Recipe Search**: Search recipes by title and ingredient keywords.
- **Category Filter**: Filter recipes by category.
- **Category Counts**: See how many recipes are available in each category.
- **Recipe Metadata Chips**: Cards and detail views now show servings, total time, and difficulty.
- **Recently Viewed**: Quick-access strip for the most recently opened recipes.
- **Featured Recipe**: Highlighted featured recipe section.
- **Dark Mode**: Toggle between light and dark mode.
- **Responsive Design**: Mobile-friendly design.
- **Offline Support**: Service worker for offline capabilities.
- **Keyboard & Accessibility Improvements**: Better dialog semantics, focus handling, and keyboard navigation for recipe cards and saved items.
- **Portion Scaler**: Dynamically adjust ingredient quantities by changing the serving size.
- **Shopping List Generator**: Add recipes to a comprehensive shopping cart to manage your grocery list.
- **Step-by-Step Cooking Mode**: A distraction-free, full-screen overlay for following recipe instructions.
- **Built-in Timers**: Clickable time phrases in recipes that start an in-app countdown timer.
- **Print / PDF Export**: Printer-friendly CSS layout that strips out unnecessary UI elements for a clean physical copy.
- **Dynamic Nutritional Macros**: An automated, responsive CSS donut chart that visually re-calculates Protein, Fat, and Carbs automatically based on the selected serving multiplier.


## Installation

To run this project locally, follow these steps:

1. Clone the repository:

   ```sh
   git clone https://github.com/SC136/recipe-book.git
   ```

2. Navigate to the project directory:

   ```sh
   cd recipe-book
   ```

3. Open `index.html` in your browser to view the website.

## Usage

### Architecture & Folder Structure

- **`index.html`**: The main entry point.
- **`css/styles.css`**: The design system, typography, and layout styles.
- **`js/`**: Contains the modularized application logic.
  - `main.js`: Initialization and global event delegation.
  - `store.js`: Reactive state management using JavaScript Proxies.
  - `components.js`: UI rendering and DOM manipulation.
  - `router.js`: History API deep linking for individual recipes.
  - `api.js`: Handles asynchronous fetching of data.
  - `utils.js`: Pure helper functions for formatting, math, and UI effects.
- **`data/recipes.json`**: The database of recipes.

### Service Worker

The service worker, defined in the `service-worker.js` file, is used to cache resources for offline use.

### Manifest

The web app manifest, defined in the `manifest.json` file, provides metadata for the web application.

## Contributing

We welcome contributions from the community! To contribute, please follow these steps:

1. Fork the repository to your own GitHub account.
2. Create a new branch for your feature or bug fix.
3. Make your changes and commit them with clear and descriptive messages.
4. Push your changes to your forked repository.
5. Open a pull request to the main repository with a detailed description of your changes.

Thank you for your contributions!

### Adding Recipes to the Site

To add a new recipe to the site, follow these steps:

1. **Update `data/recipes.json`:**

    - Open the `data/recipes.json` file.
    - Add a new recipe object entry to the top-level JSON object. It requires the following properties:
    - `title`: The name of the recipe.
    - `image`: The URL or path to the recipe image.
    - `description`: A brief description of the recipe.
    - `ingredients`: An array of strings representing ingredients required for the recipe.
    - `instructions`: Step-by-step instructions on how to prepare the recipe.
    - `macros`: Nutritional information object (`calories`, `protein`, `fat`, `carbs`).
    - `category`: The category of the recipe (e.g., `"breakfast"`, `"dessert"`).
    - `servings`: Number of servings (for example, `2` or `4`).
    - `totalTime`: Total recipe time (for example, `"25 min"`).
    - `difficulty`: Difficulty label (`"Easy"`, `"Medium"`, or `"Hard"`).

2. **Add Recipe Image:**
   - Place the recipe image in the `images` folder (if hosting locally) or provide a remote URL.
   - Ensure the image path in `data/recipes.json` is correct.

Example of adding a new recipe in `data/recipes.json`:

```json
{
    "new_recipe_id": {
        "title": "Blueberry Pancakes",
        "image": "images/recipe.jpg",
        "description": "Fluffy pancakes loaded with fresh blueberries.",
        "ingredients": [
            "1 cup of ingredient A",
            "2 tbsp of ingredient B",
            "3 pieces of ingredient C"
        ],
        "instructions": "Mix all ingredients together and cook for 20 minutes.",
        "macros": { "calories": 200, "protein": 10, "fat": 5, "carbs": 30 },
        "category": "breakfast",
        "servings": 2,
        "totalTime": "20 min",
        "difficulty": "Easy"
    }
}
```
