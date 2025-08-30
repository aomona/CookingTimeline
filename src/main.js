// --- cache ---
const cache = {
  manifest: null, // [{id,title,file,...}]
  recipes: new Map() // id -> recipe json
};

// manifestを一度だけ読む（必要なら強制更新可）
async function fetchManifest(force = false) {
  if (cache.manifest && !force) return cache.manifest;
  const res = await fetch('./recipes/manifest.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('manifestが読めません');
  const data = await res.json();
  cache.manifest = data.recipes ?? [];
  return cache.manifest;
}

async function fetchRecipes() {
  return fetchManifest(false);
}

async function populateMenuSelect() {
  const list = document.getElementById('menu-list');
  list.innerHTML = '<li>Loading...</li>';

  try {
    const recipes = await fetchRecipes();
    list.innerHTML = '';
    recipes.forEach(r => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.textContent = r.title ?? r.id;
      a.href = `#${r.id}`;
      li.appendChild(a);
      list.appendChild(li);
    });
  } catch (e) {
    console.error(e);
    list.innerHTML = '<li disabled>読み込みに失敗しました</li>';
  }
}

async function getRecipeDataById(recipeId) {
  if (cache.recipes.has(recipeId)) return cache.recipes.get(recipeId);

  const recipes = await fetchManifest(false);
  const meta = recipes.find(r => r.id === recipeId);
  if (!meta) throw new Error(`レシピが見つかりません: ${recipeId}`);

  const url = `./recipes/${meta.file ?? `${meta.id}.json`}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`レシピが読めません: ${url}`);
  const json = await res.json();
  cache.recipes.set(recipeId, json);
  return json;
}

// --- simple render helpers ---
function showSection(section) {
  const home = document.getElementById('home-section');
  const recipe = document.getElementById('recipe-section');
  if (!home || !recipe) return;
  if (section === 'home') {
    home.style.display = '';
    recipe.style.display = 'none';
  } else if (section === 'recipe') {
    home.style.display = 'none';
    recipe.style.display = '';
  }
}

function renderRecipeView(recipe) {
  const container = document.getElementById('recipe-view');
  if (!container) return;
  const tags = (recipe.tags ?? []).map(t => `<span class="mr-2 px-2 py-0.5 rounded bg-gray-200 text-gray-700">${t}</span>`).join('');
  const materials = (recipe.materials ?? []).map(m => `<li>${m.name} <span class="text-gray-500">${m.amount ?? ''}</span></li>`).join('');
  const steps = (recipe.steps ?? []).map((s, i) => `
    <li class="mb-3">
      <div class="font-semibold">${i + 1}. ${s.label ?? s.id}</div>
      ${s.time ? `<div class="text-sm text-gray-600">${s.time} min</div>` : ''}
      ${s.instructions ? `<div class="mt-1">${s.instructions}</div>` : ''}
    </li>
  `).join('');

  container.innerHTML = `
    <h2 class="text-2xl mb-2">${recipe.title ?? recipe.id}</h2>
    <div class="mb-2">Servings: ${recipe.servings ?? '-'}</div>
    <div class="mb-4">${tags}</div>
    <h3 class="text-xl mt-4 mb-2">材料</h3>
    <ul class="list-disc ml-5 mb-4">${materials}</ul>
    <h3 class="text-xl mt-4 mb-2">手順</h3>
    <ol class="list-decimal ml-5">${steps}</ol>
  `;
}

async function renderHome() {
  showSection('home');
  await populateMenuSelect();
}

async function renderRecipeById(id) {
  try {
    const recipe = await getRecipeDataById(id);
    renderRecipeView(recipe);
    showSection('recipe');
  } catch (e) {
    console.error(e);
    alert(e.message ?? '読み込みに失敗しました');
    // フォールバックしてホームへ
    location.hash = '';
  }
}

function parseHash() {
  const h = location.hash.replace(/^#/, '').trim();
  // 支持形式: ""(home) or "<recipeId>"
  return h;
}

function handleRoute() {
  const id = parseHash();
  if (!id) {
    renderHome();
  } else {
    renderRecipeById(id);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // 初期表示（直リンクも考慮）
  handleRoute();
  // ハッシュ変更でルーティング
  window.addEventListener('hashchange', handleRoute);
});
