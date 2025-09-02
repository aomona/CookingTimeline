import { renderHome, renderRecipeById, renderCookingById, renderMultiRecipe, renderMultiCooking } from './views.js';

export function parseHash() {
  const h = location.hash.replace(/^#/, '').trim();
  // 対応形式:
  //  - "" (home)
  //  - "<recipeId>" | "<recipeId>/cooking" (単一)
  //  - "multi/<id,id,...>" | "multi/<id,id,...>/cooking" (複数)
  if (!h) return { kind: 'home' };
  const parts = h.split('/');
  if (parts[0] === 'multi') {
    const ids = (parts[1] || '').split(',').map(s => s.trim()).filter(Boolean);
    const mode = parts[2] || null;
    return { kind: 'multi', ids, mode };
  }
  return { kind: 'single', id: parts[0], mode: parts[1] || null };
}

export function handleRoute() {
  const parsed = parseHash();
  if (parsed.kind === 'home') return renderHome();

  if (parsed.kind === 'single') {
    const { id, mode } = parsed;
    if (!id) return renderHome();
    if (mode === 'cooking') return renderCookingById(id);
    return renderRecipeById(id);
  }

  if (parsed.kind === 'multi') {
    const { ids, mode } = parsed;
    if (!ids || ids.length === 0) return renderHome();
    if (mode === 'cooking') return renderMultiCooking(ids);
    return renderMultiRecipe(ids);
  }
}
