# Foodbook 🥘

Welcome to Foodbook! A beautifully designed, highly interactive web application for browsing recipes. Built using modern web standards and connected directly to **TheMealDB API**, Foodbook provides instant access to hundreds of high-quality meals across a wide variety of categories.

## Features

- **TheMealDB API Integration**: Access over 600+ recipes spanning 14 categories directly from the cloud.
- **Lazy-Loaded Architecture**: Lightweight category browsing ensures high performance and low bandwidth usage. Recipe details (ingredients, instructions) are instantly fetched and cached only when you click them.
- **Dynamic Categories**: Master categories are fetched directly from the database (Beef, Breakfast, Seafood, Pasta, etc.) to ensure the navigation bar is always up to date.
- **Recipe Search**: Fast search queries that look up the global database.
- **Responsive Kinfolk Design**: A clean, modern aesthetic with highly curated color palettes for each category, dynamic micro-animations, and CSS grid layouts.
- **Dark Mode**: Toggle between light and dark modes with persistent local storage.
- **Step-by-Step Cooking Mode**: A distraction-free, full-screen overlay for following recipe instructions.
- **Built-in Timers**: Clickable time phrases in recipes that start an in-app countdown timer.
- **Portion Scaler**: Dynamically adjust ingredient quantities by changing the serving size multiplier.
- **Shopping Cart**: Save recipes or add them to your grocery list.
- **Progressive Web App (PWA)**: Includes a service worker, caching, and a manifest for offline capability and installation as a native app.

## Installation

To run this project locally, simply clone the repository and open it in your browser:

1. Clone the repository:
   ```sh
   git clone https://github.com/SC136/recipe-book.git
   ```
2. Navigate to the project directory:
   ```sh
   cd recipe-book
   ```
3. Open `index.html` in your web browser or use a local dev server (e.g. `npx serve .` or VS Code Live Server).

## Architecture

- **`index.html`**: The main entry point.
- **`css/styles.css`**: The design system, typography, and layout styles.
- **`js/`**: Contains the modularized application logic.
  - `main.js`: Initialization and global event delegation.
  - `store.js`: Reactive state management using JavaScript Proxies.
  - `components.js`: UI rendering and DOM manipulation.
  - `router.js`: History API deep linking for individual recipes.
  - `api.js`: Handles asynchronous fetching of data from TheMealDB.
  - `utils.js`: Helper functions for formatting, math, and UI effects.
- **Service Worker (`service-worker.js`)**: Caches critical assets for lightning-fast subsequent loads.

## Contributing

We welcome contributions from the community! To contribute, please follow these steps:

1. Fork the repository to your own GitHub account.
2. Create a new branch for your feature or bug fix.
3. Make your changes and commit them with clear and descriptive messages.
4. Push your changes to your forked repository.
5. Open a pull request to the main repository with a detailed description of your changes.

Thank you for your contributions!
