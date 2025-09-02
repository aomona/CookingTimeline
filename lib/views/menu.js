import { fetchRecipes } from '../data.js';

// 選択状態・フィルタ状態を保持（ホーム再訪時にも維持）
const __selectedIds = new Set();
let __genreFilter = (typeof localStorage !== 'undefined' && localStorage.getItem('ct.genre')) || 'all';

const GENRE_LABELS = {
  all: 'すべて',
  japanese: '和食',
  chinese: '中華',
  italian: 'イタリアン',
  french: 'フレンチ',
  western: '洋食',
  other: 'その他'
};

function detectGenre(meta) {
  if (meta && meta.genre) return String(meta.genre);
  const tags = (meta && meta.tags ? meta.tags : []).map(t => String(t).toLowerCase());
  if (tags.includes('japanese')) return 'japanese';
  if (tags.includes('chinese')) return 'chinese';
  if (tags.includes('italian')) return 'italian';
  if (tags.includes('french')) return 'french';
  return 'other';
}

function genreLabel(key) { return GENRE_LABELS[key] || key; }

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
    // 利用可能なジャンル一覧を抽出
    const genreSet = new Set(['all']);
    sorted.forEach(r => { genreSet.add(detectGenre(r)); });
    const genres = Array.from(genreSet);

    // コントロールバーを挿入（初回のみ）
    const ensureControls = () => {
      const host = document.getElementById('home-section');
      if (!host) return;
      let ctrl = document.getElementById('multi-controls');
      if (!ctrl) {
        ctrl = document.createElement('div');
        ctrl.id = 'multi-controls';
        ctrl.className = 'max-w-4xl mx-auto -mt-2 mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between';
        ctrl.innerHTML = `
          <div class="flex items-center gap-2">
            <label for="genre-filter" class="text-sm text-gray-700">ジャンル:</label>
            <select id="genre-filter" class="px-2 py-1 border rounded text-sm bg-white"></select>
          </div>
          <div class="flex items-center gap-2">
            <span class="hidden sm:inline text-sm text-gray-600">複数選択して一緒に計画・調理できます</span>
            <span id="multi-count" class="text-sm text-gray-500">0件選択中</span>
            <button id="multi-plan-btn" class="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-40 disabled:cursor-not-allowed">選択して計画</button>
          </div>`;
        // menu-list の直前に挿入
        const listEl = document.getElementById('menu-list');
        if (listEl) listEl.insertAdjacentElement('beforebegin', ctrl);
      }
      // 状態反映（ジャンルセレクト）
      const sel = document.getElementById('genre-filter');
      if (sel) {
        // options を再構築
        sel.innerHTML = genres.map(g => `<option value="${g}">${genreLabel(g)}</option>`).join('');
        sel.value = __genreFilter && genres.includes(__genreFilter) ? __genreFilter : 'all';
        sel.onchange = (e) => {
          const v = e.target.value || 'all';
          __genreFilter = v;
          try { localStorage.setItem('ct.genre', v); } catch {}
          // 再レンダリング
          renderList();
        };
      }

      // 状態反映（複数選択のカウント・ボタン）
      const countEl = document.getElementById('multi-count');
      const btn = document.getElementById('multi-plan-btn');
      const ids = Array.from(__selectedIds);
      if (countEl) countEl.textContent = `${ids.length}件選択中`;
      if (btn) {
        btn.disabled = ids.length === 0;
        btn.onclick = () => {
          const current = Array.from(__selectedIds);
          if (current.length > 0) location.hash = `#multi/${current.join(',')}`;
        };
      }
    };

    ensureControls();

    // レンダリング関数（フィルタ反映）
    function renderList() {
      const filtered = sorted.filter(r => {
        const g = detectGenre(r);
        return __genreFilter === 'all' || g === __genreFilter;
      });

      list.innerHTML = filtered.map(r => {
        const title = (r && r.title) ? r.title : r.id;
        const servings = r.servings ? `${r.servings}人分` : '';
        // ホーム画面では「かかる時間」を表示しない（重なり防止）
        const tags = (r.tags || []).slice(0, 2).map(tag => 
          `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">${tag}</span>`
        ).join('');
        const genre = detectGenre(r);
        const genrePill = `<span class="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">${genreLabel(genre)}</span>`;
        const checked = __selectedIds.has(r.id) ? 'checked' : '';
        
        return `
          <li class="mb-3 relative">
            <div class="absolute top-2 right-2">
              <label class="inline-flex items-center gap-1 text-sm text-gray-700 bg-white/80 px-2 py-1 rounded shadow border">
                <input type="checkbox" class="multi-select" data-id="${r.id}" ${checked} />
                複数選択
              </label>
            </div>
            <a href="#${r.id}" class="block p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-200 hover:border-blue-300">
              <div class="flex justify-between items-start mb-2">
                <h3 class="text-lg font-semibold text-gray-800">${title}</h3>
              </div>
              <div class="flex justify-between items-center">
                <div class="text-sm text-gray-600 flex items-center gap-2">${servings} ${genrePill}</div>
                <div class="flex gap-1">${tags}</div>
              </div>
            </a>
          </li>
        `;
      }).join('') || '<li class="text-center py-8 text-gray-500">該当するレシピがありません</li>';

      // 変更イベント（チェックボックス）を委譲で拾う。複数バインド防止のため onChange を直設定
      list.onchange = (e) => {
        const t = e.target;
        if (!(t instanceof HTMLInputElement)) return;
        if (!t.classList.contains('multi-select')) return;
        const id = t.getAttribute('data-id');
        if (!id) return;
        if (t.checked) __selectedIds.add(id); else __selectedIds.delete(id);
        const countEl = document.getElementById('multi-count');
        const btn = document.getElementById('multi-plan-btn');
        const current = Array.from(__selectedIds);
        if (countEl) countEl.textContent = `${current.length}件選択中`;
        if (btn) btn.disabled = current.length === 0;
      };
    }

    // 初期レンダリング
    renderList();
  } catch (e) {
    console.error(e);
    list.innerHTML = '<li class="text-center py-8 text-red-500 bg-red-50 rounded-lg">読み込みに失敗しました</li>';
  }
}
