import { getRecipesDataByIds } from '../data.js';
import { renderTimeline } from './timeline.js';
import { showSection } from './navigation.js';
import { computeConflicts } from '../scheduler.js';

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

function multiRecipeTemplate(recipes, steps, conflicts, cap, total) {
  const titles = recipes.map(r => r.title || r.id).join(' / ');
  const timelineHtml = renderTimeline(steps, { conflicts, maxTime: total, rowReorder: true, embed: true });

  const conflictHtml = (conflicts && conflicts.length)
    ? `<div class="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-800 text-sm">
         <div class="font-semibold mb-1">資源の衝突が見つかりました</div>
         <ul class="list-disc ml-5 space-y-0.5">${conflicts.map(c => `<li>${c.text}</li>`).join('')}</ul>
       </div>`
    : `<div class="mb-4 p-3 rounded border border-green-200 bg-green-50 text-green-800 text-sm">資源の衝突は見つかりませんでした</div>`;

  return `
    <div class="max-w-3xl mx-auto space-y-6">
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h2 class="text-2xl font-bold text-gray-800 mb-2">調理の計画</h2>
        <div class="text-gray-700">${titles}</div>
        <div class="mt-4 flex flex-wrap items-end gap-3">
          <div class="text-sm text-gray-700">キッチン資源</div>
          <label class="text-sm text-gray-700">コンロ <input id="cap-stove" type="number" min="0" class="w-16 border rounded px-2 py-1 ml-1" value="${cap.stove}"></label>
          <label class="text-sm text-gray-700">手作業 <input id="cap-hands" type="number" min="0" class="w-16 border rounded px-2 py-1 ml-1" value="${cap.hands}"></label>
          <label class="text-sm text-gray-700">オーブン <input id="cap-oven" type="number" min="0" class="w-16 border rounded px-2 py-1 ml-1" value="${cap.oven}"></label>
          <div class="hidden sm:block w-px h-6 bg-gray-300 mx-1"></div>
          <div class="flex items-center gap-2 text-sm text-gray-700">
            <span>全体長さ(分)</span>
            <button id="btn-total-minus" class="px-2 py-1 border rounded bg-white hover:bg-gray-50">-5</button>
            <input id="view-total" type="number" min="1" class="w-24 border rounded px-2 py-1 text-sm" value="${total}">
            <button id="btn-total-plus" class="px-2 py-1 border rounded bg-white hover:bg-gray-50">+5</button>
          </div>
          <button id="btn-sort-by-time" class="px-3 py-2 bg-white text-gray-800 rounded border hover:bg-gray-50 text-sm">時間順に整列</button>
          <button id="cap-save" class="ml-auto px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 text-gray-800 text-sm">保存</button>
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
        <h3 class="text-xl font-semibold text-gray-800 mb-1">結合タイムライン</h3>
        <p class="text-sm text-gray-600 mb-3">タイムラインのバーはドラッグして移動できます。</p>
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
        after: (s.after || []).map(a => a.includes(':') ? a : `${r.id}:${a}`),
        // keep baseline for slack/drag constraints
        baseStart: s.timeline.start,
        baseEnd: s.timeline.end,
        baseTime: s.time ?? Math.max(0, s.timeline.end - s.timeline.start)
      });
    }
  }

  const originalMerged = merged; // keep baseline for repeated optimization
  const cap = loadCapacity();
  const conflicts = computeConflicts(originalMerged, cap);
  const defTotal = Math.ceil((originalMerged.reduce((m,s)=>Math.max(m, s.timeline?.end||0),0) + 5) / 5) * 5;
  let viewTotal = defTotal;
  container.innerHTML = multiRecipeTemplate(recipes, originalMerged, conflicts, cap, viewTotal);
  showSection('recipe');

  // Start Cooking リンク設定
  const start = document.getElementById('start-cooking');
  if (start) start.setAttribute('href', `#cook/${ids.join(',')}`);

  function attachBindings(renderedSteps) {
    // Bind capacity controls
    const stoveEl = document.getElementById('cap-stove');
    const handsEl = document.getElementById('cap-hands');
    const ovenEl = document.getElementById('cap-oven');
    const saveBtn = document.getElementById('cap-save');
    const resetBtn = document.getElementById('btn-reset');
    const totalMinus = document.getElementById('btn-total-minus');
    const totalPlus = document.getElementById('btn-total-plus');
    const totalInput = document.getElementById('view-total');
    const sortBtn = document.getElementById('btn-sort-by-time');

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

    const recompute = () => {
      const nc = loadCapacity();
      const conf = computeConflicts(renderedSteps, nc);
      container.innerHTML = multiRecipeTemplate(recipes, renderedSteps, conf, nc, viewTotal);
      showSection('recipe');
      const start2 = document.getElementById('start-cooking');
      if (start2) start2.setAttribute('href', `#cook/${ids.join(',')}`);
      attachBindings(renderedSteps);
    };

    const minNeeded = Math.max(1, renderedSteps.reduce((m,s)=>Math.max(m, s.timeline?.end||0),0));
    totalMinus?.addEventListener('click', () => { viewTotal = Math.max(minNeeded, viewTotal - 5); recompute(); });
    totalPlus?.addEventListener('click', () => { viewTotal = Math.max(minNeeded, viewTotal + 5); recompute(); });
    totalInput?.addEventListener('change', (e) => {
      const v = Number(e.target.value || NaN);
      if (Number.isFinite(v)) {
        viewTotal = Math.max(minNeeded, v);
        recompute();
      }
    });
    sortBtn?.addEventListener('click', () => {
      renderedSteps.sort((a,b) => (a.timeline?.start||0) - (b.timeline?.start||0) || String(a.label||a.id).localeCompare(String(b.label||b.id), 'ja'));
      recompute();
    });

    resetBtn?.addEventListener('click', () => { renderMultiRecipe(ids); });

    // Drag interactions for step bars
    const byId = new Map(renderedSteps.map(s => [s.id, s]));

    const bars = container.querySelectorAll('.tl-step-bar');
    bars.forEach(bar => {
      const id = bar.getAttribute('data-step-id');
      if (!id) return;
      let dragging = false;
      let startX = 0;
      let origStart = 0;
      let dur = 0;
      let minStartAllowed = 0;
      let maxStartAllowed = Infinity;
      let lastSnapped = null;
      const track = bar.parentElement; // the h-8 track

      function snap(x) { const step = 0.5; return Math.round(x / step) * step; }
      function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

      function onPointerDown(e) {
        const s = byId.get(id);
        if (!s || !s.timeline) return;
        dragging = true;
        startX = e.clientX;
        origStart = s.timeline.start;
        dur = s.time ?? Math.max(0, (s.timeline.end - s.timeline.start));
        minStartAllowed = 0;
        maxStartAllowed = Math.max(0, viewTotal - dur);
        // pointer capture
        try { bar.setPointerCapture(e.pointerId); } catch {}
        bar.classList.add('ring-2','ring-blue-400');
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp, { once: true });
        e.preventDefault();
      }

      function onPointerMove(e) {
        if (!dragging || !track) return;
        const rect = track.getBoundingClientRect();
        const scale = viewTotal / rect.width; // minutes per px
        const dx = (e.clientX - startX) * scale;
        let cand = origStart + dx;
        cand = clamp(cand, minStartAllowed, maxStartAllowed);
        const snapped = snap(cand);
        lastSnapped = snapped;
        // update visuals
        const leftPercent = (snapped / viewTotal) * 100;
        const widthPercent = (dur / viewTotal) * 100;
        bar.style.left = `${leftPercent}%`;
        bar.style.width = `${widthPercent}%`;
        const timeLabel = track.querySelector(`.tl-time[data-step-id="${id}"]`);
        if (timeLabel) timeLabel.textContent = `${snapped}-${(snapped + dur)}分`;
      }

      function onPointerUp() {
        dragging = false;
        bar.classList.remove('ring-2','ring-blue-400');
        window.removeEventListener('pointermove', onPointerMove);
        const s = byId.get(id);
        if (!s || lastSnapped === null) return;
        const finalStart = clamp(lastSnapped, minStartAllowed, maxStartAllowed);
        s.timeline.start = finalStart;
        s.timeline.end = finalStart + dur;
        recompute();
      }

      bar.addEventListener('pointerdown', onPointerDown);
    });

    // Row reorder via explicit dropzones between rows
    const rows = Array.from(container.querySelectorAll('.tl-row'));
    let dragSrcId = null;
    rows.forEach(row => {
      const id = row.getAttribute('data-step-id');
      const handle = row.querySelector('.tl-row-handle');
      if (!id || !handle) return;
      handle.addEventListener('dragstart', (e) => {
        dragSrcId = id;
        row.classList.add('opacity-60');
        try { e.dataTransfer.setData('text/plain', id); } catch {}
      });
      handle.addEventListener('dragend', () => {
        row.classList.remove('opacity-60');
        dragSrcId = null;
        // clear any highlighted dropzones
        container.querySelectorAll('.tl-dropzone').forEach(z => z.classList.remove('bg-blue-300','h-1.5'));
      });
    });

    // Build dropzones
    if (rows.length) {
      const listEl = rows[0].parentElement; // container holding rows
      // Remove existing
      Array.from(listEl.querySelectorAll('.tl-dropzone')).forEach(z => z.remove());
      // Create top dropzone
      const makeZone = (idx) => {
        const dz = document.createElement('div');
        dz.className = 'tl-dropzone h-0.5 bg-transparent my-1 transition-all';
        dz.setAttribute('data-insert-index', String(idx));
        dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('bg-blue-300','h-1.5'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('bg-blue-300','h-1.5'));
        dz.addEventListener('drop', (e) => {
          e.preventDefault();
          dz.classList.remove('bg-blue-300','h-1.5');
          const sourceId = dragSrcId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
          if (!sourceId) return;
          const fromIdx = renderedSteps.findIndex(s => s.id === sourceId);
          let toIdx = Number(dz.getAttribute('data-insert-index') || '0');
          if (fromIdx < 0) return;
          // Adjust insertion index if removing earlier element
          if (fromIdx < toIdx) toIdx -= 1;
          toIdx = Math.max(0, Math.min(renderedSteps.length, toIdx));
          const [moved] = renderedSteps.splice(fromIdx, 1);
          renderedSteps.splice(toIdx, 0, moved);
          recompute();
        });
        return dz;
      };
      // Insert zones before each row and one after last
      rows.forEach((row, i) => {
        const dz = makeZone(i);
        listEl.insertBefore(dz, row);
      });
      const tail = makeZone(rows.length);
      listEl.appendChild(tail);
    }
  }

  attachBindings(originalMerged);
}
