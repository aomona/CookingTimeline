import { populateMenuSelect } from './menu.js';

export function showSection(section) {
  const home = document.getElementById('home-section');
  const recipe = document.getElementById('recipe-section');
  const cooking = document.getElementById('cooking-section');
  if (!home || !recipe) return;

  const map = { home, recipe, cooking };
  Object.values(map).forEach(el => el.classList.add('hidden'));
  if (map[section]) map[section].classList.remove('hidden');
}

export async function renderHome() {
  showSection('home');
  await populateMenuSelect();
}
