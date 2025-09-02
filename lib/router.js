import { renderHome, renderRecipeById, renderMultiRecipe, renderMultiCooking } from './views.js';

export function parseHash() {
  const h = location.hash.replace(/^#/, '').trim();
  // 新ルーティング:
  //  - "" → home
  //  - "<id>" → preview (材料/手順/非インタラクティブTL)
  //  - "plan/<id[,id...]>" → プランナー（並べ替え/自由配置/衝突）
  //  - "cook/<id[,id...]>" → 再生
  if (!h) return { kind: 'home' };
  const parts = h.split('/');
  if (parts[0] === 'plan') {
    const ids = (parts[1] || '').split(',').map(s => s.trim()).filter(Boolean);
    return { kind: 'plan', ids };
  }
  if (parts[0] === 'cook') {
    const ids = (parts[1] || '').split(',').map(s => s.trim()).filter(Boolean);
    return { kind: 'cook', ids };
  }
  // 旧形式は考慮しない（プレビュー扱い）
  return { kind: 'preview', id: parts[0] };
}

export function handleRoute() {
  const parsed = parseHash();
  if (parsed.kind === 'home') return renderHome();
  if (parsed.kind === 'preview') {
    const { id } = parsed; if (!id) return renderHome();
    return renderRecipeById(id);
  }
  if (parsed.kind === 'plan') {
    const { ids } = parsed; if (!ids || ids.length === 0) return renderHome();
    return renderMultiRecipe(ids);
  }
  if (parsed.kind === 'cook') {
    const { ids } = parsed; if (!ids || ids.length === 0) return renderHome();
    return renderMultiCooking(ids);
  }
}
