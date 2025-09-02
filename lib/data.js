// Data access and simple cache
const cache = {
  manifest: null, // [{id,title,file,...}]
  recipes: new Map() // id -> recipe json
};

export async function fetchManifest(force = false) {
  if (cache.manifest && !force) return cache.manifest;
  const res = await fetch('./recipes/manifest.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('manifestが読めません');
  const data = await res.json();
  cache.manifest = (data && data.recipes) ? data.recipes : [];
  return cache.manifest;
}

export async function fetchRecipes() {
  return fetchManifest(false);
}

export async function getRecipeDataById(recipeId) {
  if (cache.recipes.has(recipeId)) return cache.recipes.get(recipeId);

  const recipes = await fetchManifest(false);
  const meta = recipes.find(r => r.id === recipeId);
  if (!meta) throw new Error(`レシピが見つかりません: ${recipeId}`);

  const url = `./recipes/${(meta.file ? meta.file : `${meta.id}.json`)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`レシピが読めません: ${url}`);
  const json = await res.json();
  cache.recipes.set(recipeId, json);
  return json;
}

export async function getRecipesDataByIds(ids) {
  const uniques = Array.from(new Set((ids || []).filter(Boolean)));
  const recipes = await Promise.all(uniques.map(id => getRecipeDataById(id)));
  return recipes;
}
