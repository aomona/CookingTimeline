import { renderHome, renderRecipeById, renderCookingById } from './views.js';

export function parseHash() {
  const h = location.hash.replace(/^#/, '').trim();
  // 支持形式: ""(home) | "<recipeId>" | "<recipeId>/cooking"
  if (!h) return { id: null, sub: null };
  const parts = h.split('/');
  return { id: parts[0], sub: parts[1] || null };
}

export function handleRoute() {
  const { id, sub } = parseHash();
  if (!id) {
    renderHome();
  } else if (sub === 'cooking') {
    renderCookingById(id);
  } else {
    renderRecipeById(id);
  }
}
