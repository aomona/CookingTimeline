// --- simple cache ---
const cache = {
  manifest: null,                // [{id,title,file,...}]
  recipes: new Map()             // id -> recipe json
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
  const button = document.getElementById('select-button');
  const select = document.getElementById('menu-select');

  button.disabled = true;
  select.innerHTML = '<option>Loading...</option>';

  try {
    const recipes = await fetchRecipes();
    select.innerHTML = '';
    recipes.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.title ?? r.id;
      select.appendChild(opt);
    });
    button.disabled = false;
  } catch (e) {
    console.error(e);
    select.innerHTML = '<option disabled>読み込みに失敗しました</option>';
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

document.addEventListener('DOMContentLoaded', () => {
  populateMenuSelect();
});

document.getElementById('select-button').addEventListener('click', async () => {
  const select = document.getElementById('menu-select');
  const button = document.getElementById('select-button');
  const id = select.value;

  button.disabled = true;
  const prevLabel = button.textContent;
  button.textContent = 'Loading...';

  try {
    const data = await getRecipeDataById(id);
    console.log(data); // ← ここで normalize -> schedule -> render へ
  } catch (e) {
    console.error(e);
    alert(e.message ?? '読み込みに失敗しました');
  } finally {
    button.textContent = prevLabel;
    button.disabled = false;
  }
});
