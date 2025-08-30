import { fetchRecipes, getRecipeDataById } from './data.js';

export async function populateMenuSelect() {
  const list = document.getElementById('menu-list');
  list.innerHTML = '<li>Loading...</li>';

  try {
    const recipes = await fetchRecipes();
    list.innerHTML = (recipes || []).map(r => {
      const title = (r && r.title) ? r.title : r.id;
      return `<li><a href="#${r.id}">${title}</a></li>`;
    }).join('') || '<li disabled>レシピがありません</li>';
  } catch (e) {
    console.error(e);
    list.innerHTML = '<li disabled>読み込みに失敗しました</li>';
  }
}

export function showSection(section) {
  const home = document.getElementById('home-section');
  const recipe = document.getElementById('recipe-section');
  const cooking = document.getElementById('cooking-section');
  if (!home || !recipe || !cooking) return;

  const map = { home, recipe, cooking };
  Object.values(map).forEach(el => el.style.display = 'none');
  if (map[section]) map[section].style.display = '';
}

export function renderRecipeView(recipe) {
  const container = document.getElementById('recipe-view');
  if (!container) return;
  const tags = ((recipe && recipe.tags) ? recipe.tags : []).map(t => `<span class="mr-2 px-2 py-0.5 rounded bg-gray-200 text-gray-700">${t}</span>`).join('');
  const materials = ((recipe && recipe.materials) ? recipe.materials : []).map(m => `<li>${m.name} <span class="text-gray-500">${m.amount ? m.amount : ''}</span></li>`).join('');
  const steps = ((recipe && recipe.steps) ? recipe.steps : []).map((s, i) => `
    <li class="mb-3">
      <div class="font-semibold">${i + 1}. ${(s.label ? s.label : s.id)}</div>
      ${(s.time ? `<div class="text-sm text-gray-600">${s.time} min</div>` : '')}
      ${(s.instructions ? `<div class="mt-1">${s.instructions}</div>` : '')}
    </li>
  `).join('');

  container.innerHTML = `
    <h2 class="text-2xl mb-2">${(recipe.title ? recipe.title : recipe.id)}</h2>
    <div class="mb-2">Servings: ${(recipe.servings ? recipe.servings : '-')}</div>
    <div class="mb-4">${tags}</div>
    <h3 class="text-xl mt-4 mb-2">材料</h3>
    <ul class="list-disc ml-5 mb-4">${materials}</ul>
    <h3 class="text-xl mt-4 mb-2">手順</h3>
    <ol class="list-decimal ml-5">${steps}</ol>
  `;
}

export async function renderHome() {
  showSection('home');
  await populateMenuSelect();
}

export async function renderRecipeById(id) {
  try {
    const recipe = await getRecipeDataById(id);
    renderRecipeView(recipe);
    showSection('recipe');

    // Start Cooking リンクを設定
    const start = document.getElementById('start-cooking');
    if (start) start.setAttribute('href', `#${id}/cooking`);
  } catch (e) {
    console.error(e);
    alert((e && e.message) ? e.message : '読み込みに失敗しました');
    // フォールバックしてホームへ
    location.hash = '';
  }
}

export function renderCookingView(recipe, id) {
  const container = document.getElementById('cooking-view');
  if (!container) return;
  const steps = ((recipe && recipe.steps) ? recipe.steps : []).map(s => {
    const st = (s.timeline && typeof s.timeline.start === 'number') ? s.timeline.start : null;
    const en = (s.timeline && typeof s.timeline.end === 'number') ? s.timeline.end : null;
    const time = (st !== null && en !== null) ? `${st}-${en} min` : (s.time ? `${s.time} min` : '-');
    return `<li class="mb-3">
      <div class="font-semibold">${(s.label ? s.label : s.id)}</div>
      <div class="text-sm text-gray-600">${time}</div>
      ${(s.instructions ? `<div class="mt-1">${s.instructions}</div>` : '')}
    </li>`;
  }).join('');
  container.innerHTML = `
    <nav class="mb-4"><a href="#${id}">← Recipe</a> / <a href="#">Home</a></nav>
    <ol class="list-decimal ml-5">${steps}</ol>
  `;
}

export async function renderCookingById(id) {
  try {
    const recipe = await getRecipeDataById(id);
    renderCookingView(recipe, id);
    showSection('cooking');
  } catch (e) {
    console.error(e);
    alert((e && e.message) ? e.message : '読み込みに失敗しました');
    location.hash = '';
  }
}
