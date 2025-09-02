import { getRecipeDataById } from '../data.js';
import { renderTimeline } from './timeline.js';
import { showSection } from './navigation.js';

export function renderRecipeView(recipe) {
  const container = document.getElementById('recipe-view');
  if (!container) return;
  
  const tags = ((recipe && recipe.tags) ? recipe.tags : []).map(t => 
    `<span class="inline-block mr-2 mb-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 text-sm font-medium">${t}</span>`
  ).join('');
  
  const materials = ((recipe && recipe.materials) ? recipe.materials : []).map(m => `
    <li class="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg mb-2 hover:bg-gray-100 transition-colors">
      <span class="font-medium text-gray-800">${m.name}</span>
      <span class="text-gray-600 bg-white px-2 py-1 rounded text-sm">${m.amount ? m.amount : '-'}</span>
    </li>
  `).join('');
  
  const steps = ((recipe && recipe.steps) ? recipe.steps : []).map((s, i) => {
    const timeInfo = s.time ? `<div class="inline-flex items-center text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-full mb-2">
      <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v5a1 1 0 00.293.707l3 3a1 1 0 001.414-1.414L11 10.586V5z" clip-rule="evenodd"></path>
      </svg>
      ${s.time}分
    </div>` : '';
    
    const reqInfo = s.req ? Object.entries(s.req).map(([key, value]) => {
      const icons = {
        hands: '👤',
        stove: '🔥',
        oven: '🔥'
      };
      return `<span class="inline-flex items-center text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full mr-1">
        ${icons[key] || '⚙️'} ${value}
      </span>`;
    }).join('') : '';
    
    return `
      <li class="mb-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1">
            <div class="flex items-center mb-2">
              <span class="inline-flex items-center justify-center w-6 h-6 bg-blue-500 text-white text-sm font-bold rounded-full mr-3">${i + 1}</span>
              <h4 class="font-semibold text-gray-800 text-lg">${(s.label ? s.label : s.id)}</h4>
            </div>
            <div class="flex flex-wrap gap-1 mb-2">
              ${timeInfo}
              ${reqInfo}
            </div>
          </div>
        </div>
        ${(s.instructions ? `<div class="text-gray-700 leading-relaxed pl-9">${s.instructions}</div>` : '')}
      </li>
    `;
  }).join('');

  const timeline = renderTimeline(recipe.steps || [], { rowReorder: false, embed: true });
  const totalTime = recipe.steps?.reduce((max, step) => Math.max(max, step.timeline?.end || 0), 0) || 0;

  container.innerHTML = `
    <div class="max-w-4xl mx-auto">
      <!-- レシピヘッダー -->
      <div class="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg mb-6 shadow-lg">
        <h2 class="text-3xl font-bold mb-3">${(recipe.title ? recipe.title : recipe.id)}</h2>
        <div class="flex flex-wrap items-center gap-4 text-blue-100">
          <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"></path>
            </svg>
            ${(recipe.servings ? recipe.servings : '-')}人分
          </div>
          ${totalTime > 0 ? `
            <div class="flex items-center">
              <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v5a1 1 0 00.293.707l3 3a1 1 0 001.414-1.414L11 10.586V5z" clip-rule="evenodd"></path>
              </svg>
              約${totalTime}分
            </div>
          ` : ''}
        </div>
        <div class="mt-4">${tags}</div>
      </div>

      <!-- 材料セクション -->
      <div class="bg-white p-6 rounded-lg shadow-md mb-6">
        <h3 class="text-2xl font-bold text-gray-800 mb-4 flex items-center">
          <svg class="w-6 h-6 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
          </svg>
          材料
        </h3>
        <ul class="space-y-0">${materials}</ul>
      </div>
      
      <!-- タイムラインセクション -->
      <div class="bg-white p-6 rounded-lg shadow-md mb-6">
        <h3 class="text-2xl font-bold text-gray-800 mb-4 flex items-center">
          <svg class="w-6 h-6 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v5a1 1 0 00.293.707l3 3a1 1 0 001.414-1.414L11 10.586V5z" clip-rule="evenodd"></path>
          </svg>
          調理タイムライン
        </h3>
        ${timeline}
      </div>

      <!-- プラン/再生CTA -->
      <div class="flex flex-wrap gap-3 mb-6">
        <a href="#plan/${recipe.id}" class="inline-flex items-center px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow text-gray-700 hover:text-blue-600 border border-gray-200">
          計画する
        </a>
        <a href="#cook/${recipe.id}" class="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
          調理を開始
        </a>
      </div>

      <!-- 手順セクション -->
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-2xl font-bold text-gray-800 mb-4 flex items-center">
          <svg class="w-6 h-6 mr-2 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
          調理手順
        </h3>
        <ol class="space-y-0">${steps}</ol>
      </div>
    </div>
  `;

}

export async function renderRecipeById(id) {
  try {
    const recipe = await getRecipeDataById(id);
    renderRecipeView(recipe);
    showSection('recipe');
  } catch (e) {
    console.error(e);
    alert((e && e.message) ? e.message : '読み込みに失敗しました');
    // フォールバックしてホームへ
    location.hash = '';
  }
}
