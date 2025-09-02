import { renderHome, renderRecipeById, renderCookingById } from './views.js';

export function parseHash() {
  const h = location.hash.replace(/^#/, '').trim();
  // 支持形式: ""(home) | "<recipeId>""
  if (!h) return { id: null, mode: null };
  const parts = h.split('/');
  return { id: parts[0], mode: parts[1] || null };
}

export function handleRoute() {
  const { id, mode } = parseHash();
  if (!id) {
    renderHome();
  } else {
    if (mode === 'cooking') {
      renderCookingById(id);
    } else {
      renderRecipeById(id);
    }
  }
}
