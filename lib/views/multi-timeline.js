import { getRecipesDataByIds } from '../data.js';
import { renderTimeline } from './timeline.js';
import { showSection } from './navigation.js';
import { computeConflicts, scheduleGreedy } from '../scheduler.js';

const DEFAULT_CAPACITY = { stove: 1, hands: 1, oven: 1 };

function loadCapacity() {
  try {
    const s = localStorage.getItem('ct-capacity');
    if (!s) return { ...DEFAULT_CAPACITY };
    const obj = JSON.parse(s);
    return { ...DEFAULT_CAPACITY, ...obj };
  } catch { return { ...DEFAULT_CAPACITY }; }
}

function saveCapacity(cap) {
  try {
    localStorage.setItem('ct-capacity', JSON.stringify(cap));
  } catch {}
}

function multiRecipeTemplate(recipes, steps, conflicts, cap) {
  const titles = recipes.map(r => r.title || r.id).join(' / ');
  const timelineHtml = renderTimeline(steps);

  const conflictHtml = (conflicts && conflicts.length)
    ? `<div class="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-800 text-sm">
         <div class="font-semibold mb-1">資源の衝突が見つかりました</div>
         <ul class="list-disc ml-5 space-y-0.5">${conflicts.map(c => `<li>${c.text}</li>`).join('')}</ul>
       </div>`
    : `<div class="mb-4 p-3 rounded border border-green-200 bg-green-50 text-green-800 text-sm">資源の衝突は見つかりませんでした</div>`;

  return `
    <div class="max-w-3xl mx-auto space-y-6">
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h2 class="text-2xl font-bold text-gray-800 mb-2">複数レシピの計画</h2>
        <div class="text-gray-700">${titles}</div>
        <div class="mt-4 flex flex-wrap items-end gap-3">
          <div class="text-sm text-gray-700">キッチン資源</div>
          <label class="text-sm text-gray-700">コンロ <input id="cap-stove" type="number" min="0" class="w-16 border rounded px-2 py-1 ml-1" value="${cap.stove}"></label>
          <label class="text-sm text-gray-700">手作業 <input id="cap-hands" type="number" min="0" class="w-16 border rounded px-2 py-1 ml-1" value="${cap.hands}"></label>
          <label class="text-sm text-gray-700">オーブン <input id="cap-oven" type="number" min="0" class="w-16 border rounded px-2 py-1 ml-1" value="${cap.oven}"></label>
          <button id="cap-save" class="ml-auto px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 text-gray-800 text-sm">保存</button>
          <button id="btn-optimize" class="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">最適化して衝突解消</button>
          <button id="btn-reset" class="px-3 py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200 text-sm">元に戻す</button>
        </div>
        <div class="mt-4">
          <a id="start-cooking" class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-lg shadow hover:shadow-md">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>
            </svg>
            調理を開始
          </a>
        </div>
      </div>

      ${conflictHtml}

      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-xl font-semibold text-gray-800 mb-3">結合タイムライン</h3>
        ${timelineHtml}
      </div>
    </div>
  `;
}

export async function renderMultiRecipe(ids) {
  const container = document.getElementById('recipe-view');
  if (!container) return;

  const recipes = await getRecipesDataByIds(ids);
  // ステップを結合（ラベルにレシピ名を付加、IDもユニーク化）
  const merged = [];
  for (const r of recipes) {
    const rtitle = r?.title || r?.id;
    for (const s of (r?.steps || [])) {
      if (!s?.timeline || typeof s.timeline.start !== 'number' || typeof s.timeline.end !== 'number') continue;
      merged.push({
        ...s,
        id: `${r.id}:${s.id}`,
        label: `[${rtitle}] ${s.label || s.id}`,
        __recipeId: r.id,
        after: (s.after || []).map(a => a.includes(':') ? a : `${r.id}:${a}`)
      });
    }
  }

  const originalMerged = merged; // keep baseline for repeated optimization
  const cap = loadCapacity();
  const conflicts = computeConflicts(originalMerged, cap);
  container.innerHTML = multiRecipeTemplate(recipes, originalMerged, conflicts, cap);
  showSection('recipe');

  // Start Cooking リンク設定
  const start = document.getElementById('start-cooking');
  if (start) start.setAttribute('href', `#multi/${ids.join(',')}/cooking`);

  function attachBindings(renderedSteps) {
    // Bind capacity controls
    const stoveEl = document.getElementById('cap-stove');
    const handsEl = document.getElementById('cap-hands');
    const ovenEl = document.getElementById('cap-oven');
    const saveBtn = document.getElementById('cap-save');
    const optBtn = document.getElementById('btn-optimize');
    const resetBtn = document.getElementById('btn-reset');

    saveBtn?.addEventListener('click', () => {
      const nc = {
        stove: Number(stoveEl?.value || 0) || 0,
        hands: Number(handsEl?.value || 0) || 0,
        oven: Number(ovenEl?.value || 0) || 0
      };
      saveCapacity(nc);
      // re-render to recompute conflicts from original plan
      renderMultiRecipe(ids);
    });

    optBtn?.addEventListener('click', () => {
      const nc = loadCapacity();
      const scheduled = scheduleGreedy(originalMerged, nc);
      const conf = computeConflicts(scheduled, nc);
      container.innerHTML = multiRecipeTemplate(recipes, scheduled, conf, nc);
      showSection('recipe');
      const start2 = document.getElementById('start-cooking');
      if (start2) start2.setAttribute('href', `#multi/${ids.join(',')}/cooking`);
      // re-attach for further operations
      attachBindings(scheduled);
    });

    resetBtn?.addEventListener('click', () => {
      renderMultiRecipe(ids);
    });
  }

  attachBindings(originalMerged);
}
