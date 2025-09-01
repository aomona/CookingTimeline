import { fetchRecipes } from '../data.js';

export async function populateMenuSelect() {
  const list = document.getElementById('menu-list');
  list.innerHTML = '<li class="text-center py-4 text-gray-500 animate-pulse">Loading...</li>';

  try {
    const recipes = await fetchRecipes();
    // manifest.json の order を使って表示順を制御
    const sorted = (recipes || []).slice().sort((a, b) => {
      const ao = (a && Number.isFinite(Number(a.order))) ? Number(a.order) : Number.POSITIVE_INFINITY;
      const bo = (b && Number.isFinite(Number(b.order))) ? Number(b.order) : Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      const at = (a && a.title) ? a.title : (a && a.id ? a.id : '');
      const bt = (b && b.title) ? b.title : (b && b.id ? b.id : '');
      return String(at).localeCompare(String(bt), 'ja');
    });
    list.innerHTML = sorted.map(r => {
      const title = (r && r.title) ? r.title : r.id;
      const servings = r.servings ? `${r.servings}人分` : '';
      const totalTime = r.makespan ? `${r.makespan}分` : '';
      const tags = (r.tags || []).slice(0, 2).map(tag => 
        `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">${tag}</span>`
      ).join('');
      
      return `
        <li class="mb-3">
          <a href="#${r.id}" class="block p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-200 hover:border-blue-300">
            <div class="flex justify-between items-start mb-2">
              <h3 class="text-lg font-semibold text-gray-800">${title}</h3>
              <div class="text-sm text-gray-500">${totalTime}</div>
            </div>
            <div class="flex justify-between items-center">
              <div class="text-sm text-gray-600">${servings}</div>
              <div class="flex gap-1">${tags}</div>
            </div>
          </a>
        </li>
      `;
    }).join('') || '<li class="text-center py-8 text-gray-500">レシピがありません</li>';
  } catch (e) {
    console.error(e);
    list.innerHTML = '<li class="text-center py-8 text-red-500 bg-red-50 rounded-lg">読み込みに失敗しました</li>';
  }
}
