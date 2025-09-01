import { renderHome, renderRecipeById} from './views.js';

export function parseHash() {
  const h = location.hash.replace(/^#/, '').trim();
  // 支持形式: ""(home) | "<recipeId>""
  if (!h) return { id: null };
  const parts = h.split('/');
  return { id: parts[0] };
}

export function handleRoute() {
  const { id } = parseHash();
  if (!id) {
    renderHome();
  } else {
    renderRecipeById(id);
  }
}
