import { getRecipesDataByIds } from '../data.js';
import { showSection } from './navigation.js';
import { scheduleGreedy } from '../scheduler.js';

// Utility: format minutes (float) to mm:ss
function formatMinToClock(min) {
  const totalSec = Math.max(0, Math.floor(min * 60));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function cookingTemplate(recipes, total) {
  const titles = recipes.map(r => r.title || r.id).join(' / ');
  return `
    <div class="max-w-3xl mx-auto">
      <nav class="mb-6">
        <a href="#plan/${recipes.map(r => r.id).join(',')}" class="inline-flex items-center px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow text-gray-700 hover:text-blue-600 border border-gray-200">
          <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"></path>
          </svg>
          計画へ戻る
        </a>
      </nav>

      <div class="bg-white rounded-lg shadow-md p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-bold text-gray-800">調理中</h2>
          <div class="flex items-center gap-3">
            <label class="text-sm text-gray-600">速度</label>
            <select id="cook-speed" class="border rounded px-2 py-1 text-sm">
              <option value="1" selected>1x (リアルタイム)</option>
              <option value="10">10x</option>
              <option value="60">60x</option>
            </select>
          </div>
        </div>

        <div class="text-sm text-gray-600 mb-3">${titles}</div>

        <div class="flex items-center justify-between mb-4">
          <div class="text-gray-700">
            現在: <span id="cook-elapsed" class="font-semibold">00:00</span>
            <span class="text-gray-400">/ 約${formatMinToClock(total)} (分:秒)</span>
          </div>
          <div class="flex items-center gap-2">
            <button id="cook-toggle" class="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700">開始</button>
            <button id="cook-stop" class="px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">停止</button>
          </div>
        </div>

        <div class="mb-4">
          <div class="w-full bg-gray-200 h-2 rounded overflow-hidden">
            <div id="cook-progress" class="h-full bg-blue-500" style="width:0%"></div>
          </div>
        </div>

        <div>
          <h3 class="text-lg font-semibold text-gray-800 mb-2">今やること</h3>
          <div id="cook-active" class="space-y-2"></div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-md p-6 mt-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">ライブタイムライン</h3>
        <div id="cook-live-timeline"></div>
      </div>

      <div id="cook-toast" class="fixed bottom-4 right-4 z-50 space-y-2"></div>
    </div>
  `;
}

function showToast(msg) {
  const host = document.getElementById('cook-toast');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'px-4 py-3 rounded shadow bg-black/80 text-white text-sm translate-y-2 opacity-0 transition-all';
  el.textContent = msg;
  host.appendChild(el);
  requestAnimationFrame(() => {
    el.classList.remove('translate-y-2', 'opacity-0');
    el.classList.add('translate-y-0', 'opacity-100');
  });
  setTimeout(() => {
    el.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

async function ensureNotifyPermission() {
  try {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const p = await Notification.requestPermission();
      return p === 'granted';
    }
  } catch {}
  return false;
}

function notify(msg) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification('CookingTimeline', { body: msg }); } catch {}
  }
  showToast(msg);
}

function loadCapacity() {
  try {
    const s = localStorage.getItem('ct-capacity');
    return s ? JSON.parse(s) : { stove: 1, hands: 1, oven: 1 };
  } catch { return { stove: 1, hands: 1, oven: 1 }; }
}

export async function renderMultiCooking(ids) {
  // Cleanup any previous session
  if (window.__cookingCleanup) {
    try { window.__cookingCleanup(); } catch {}
    window.__cookingCleanup = null;
  }

  const container = document.getElementById('cooking-view');
  if (!container) return;

  const recipes = await getRecipesDataByIds(ids);
  // マージ済みステップ（IDユニーク化 + ラベルにレシピ名）
  const steps = [];
  for (const r of recipes) {
    const rtitle = r?.title || r?.id;
    for (const s of (r?.steps || [])) {
      if (!s?.timeline || typeof s.timeline.start !== 'number' || typeof s.timeline.end !== 'number') continue;
      steps.push({
        ...s,
        id: `${r.id}:${s.id}`,
        label: `[${rtitle}] ${s.label || s.id}`,
        __recipeId: r.id,
        after: (s.after || []).map(a => a.includes(':') ? a : `${r.id}:${a}`)
      });
    }
  }

  // Apply scheduling with saved capacity
  const cap = loadCapacity();
  const scheduled = scheduleGreedy(steps, cap);
  const total = scheduled.reduce((max, s) => Math.max(max, s.timeline?.end || 0), 0);

  container.innerHTML = cookingTemplate(recipes, total);
  showSection('cooking');

  const elActive = document.getElementById('cook-active');
  const elElapsed = document.getElementById('cook-elapsed');
  const elProgress = document.getElementById('cook-progress');
  const btnToggle = document.getElementById('cook-toggle');
  const btnStop = document.getElementById('cook-stop');
  const selSpeed = document.getElementById('cook-speed');
  const elLiveTL = document.getElementById('cook-live-timeline');

  // Engine state
  let speed = Number(selSpeed?.value && selSpeed.value !== '' ? selSpeed.value : 1); // 1x, 10x, 60x
  let msPerMin = 60000 / speed; // real ms for 1 timeline minute
  let timer = null;
  let baseMs = 0; // epoch when timeline minute 0 started
  let paused = true;
  let pausedAtMin = 0; // progress at pause
  let lastT = -0.0001;
  const endedNotified = new Set();

  function currentT() {
    if (paused) return pausedAtMin;
    const elapsedMs = Date.now() - baseMs;
    return Math.min(total, elapsedMs / msPerMin);
  }

  function renderActive(t) {
    const active = scheduled.filter(s => s.timeline.start <= t && t < s.timeline.end)
                        .sort((a, b) => b.timeline.start - a.timeline.start);
    if (!elActive) return;
    if (active.length === 0) {
      elActive.innerHTML = '<div class="text-gray-500">いま行うタスクはありません</div>';
      return;
    }
    elActive.innerHTML = active.map((s, idx) => {
      const remain = Math.max(0, s.timeline.end - t);
      const accent = idx === 0 ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white';
      return `
        <div class="p-3 rounded-lg border ${accent} shadow-sm">
          <div class="flex items-center justify-between">
            <div class="font-semibold text-gray-800">${s.label || s.id}</div>
            <div class="text-sm text-gray-600">残り ${remain.toFixed(1)}分 (${formatMinToClock(remain)})</div>
          </div>
          ${s.instructions ? `<div class=\"text-gray-700 text-sm mt-1\">${s.instructions}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  // Live timeline
  const recipeIndex = new Map(recipes.map((r, i) => [r.id, i]));
  const stepColors = [
    'bg-blue-500','bg-green-500','bg-orange-500','bg-red-500',
    'bg-purple-500','bg-pink-500','bg-indigo-500','bg-gray-500'
  ];
  const timeMarks = (() => {
    const marks = []; const interval = total <= 30 ? 5 : total <= 60 ? 10 : 15;
    for (let i = 0; i <= total; i += interval) marks.push(i);
    return marks;
  })();

  function renderLiveTimelineStatic() {
    if (!elLiveTL) return;
    const html = `
      <div id="cook-tl-wrap" class="relative">
        <div class="relative mb-4">
          <div class="flex justify-between text-xs text-gray-500 mb-2">
            ${timeMarks.map(m => `<span>${m}分</span>`).join('')}
          </div>
          <div class="relative h-2 bg-gray-200 rounded">
            ${timeMarks.map(m => {
              const pos = (m / total) * 100;
              return `<div class=\"absolute top-0 bottom-0 w-px bg-gray-300\" style=\"left:${pos}%\"></div>`;
            }).join('')}
          </div>
        </div>
        <div class="space-y-3">
          ${scheduled.map((s) => {
            const idx = recipeIndex.get(s.__recipeId) ?? 0;
            const color = stepColors[idx % stepColors.length];
            const left = (s.timeline.start / total) * 100;
            const width = ((s.timeline.end - s.timeline.start) / total) * 100;
            return `
              <div class="relative" id="cook-step-row-${s.id}">
                <div class="flex items-center">
                  <div class="flex-1">
                    <div class="relative">
                      <div class="h-8 bg-gray-200 rounded relative overflow-hidden">
                        <div class="absolute top-0 left-0 h-full ${color} opacity-70 rounded" style="left:${left}%;width:${width}%"></div>
                        <div class="absolute inset-0 flex items-center px-3">
                          <span class="font-medium text-gray-700">${s.label || s.id}</span>
                          <span class="ml-auto text-sm text-gray-600">${s.timeline.start}-${s.timeline.end}分</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div id="cook-tl-pointer" class="absolute inset-y-0 w-0.5 bg-red-500 pointer-events-none" style="left:0%"></div>
      </div>
    `;
    elLiveTL.innerHTML = html;
  }
  renderLiveTimelineStatic();

  function tick() {
    const t = currentT();
    if (elElapsed) elElapsed.textContent = formatMinToClock(t);
    if (elProgress) elProgress.style.width = `${(t / total) * 100}%`;

    const justEnded = scheduled.filter(s => lastT < s.timeline.end && s.timeline.end <= t && !endedNotified.has(s.id));
    if (justEnded.length) {
      justEnded.forEach(s => {
        endedNotified.add(s.id);
        notify(`「${s.label || s.id}」が終了しました`);
      });
    }

    renderActive(t);

    const pointer = document.getElementById('cook-tl-pointer');
    if (pointer) pointer.style.left = `${(t / total) * 100}%`;
    const active = scheduled.filter(s => s.timeline.start <= t && t < s.timeline.end);
    scheduled.forEach(s => {
      const row = document.getElementById(`cook-step-row-${s.id}`);
      if (!row) return;
      row.classList.remove('ring-2','ring-blue-400','bg-blue-50');
    });
    active.sort((a,b) => b.timeline.start - a.timeline.start).forEach((s,idx) => {
      const row = document.getElementById(`cook-step-row-${s.id}`);
      if (!row) return;
      row.classList.add('ring-2','ring-blue-400');
      if (idx === 0) row.classList.add('bg-blue-50');
    });

    lastT = t;
    if (t >= total) {
      pause();
      btnToggle.textContent = '開始';
      pausedAtMin = total;
      notify('すべての工程が完了しました');
    }
  }

  function start() {
    if (!paused) return;
    paused = false;
    const progressMs = pausedAtMin * msPerMin;
    baseMs = Date.now() - progressMs;
    timer = setInterval(tick, 250);
    btnToggle.textContent = '一時停止';
  }

  function pause() {
    if (paused) return;
    pausedAtMin = currentT();
    paused = true;
    if (timer) clearInterval(timer);
    timer = null;
    btnToggle.textContent = '再開';
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    paused = true;
    pausedAtMin = 0;
    lastT = -0.0001;
    endedNotified.clear();
    btnToggle.textContent = '開始';
    tick();
  }

  function changeSpeed(newSpeed) {
    const t = currentT();
    speed = newSpeed;
    msPerMin = 60000 / speed;
    if (!paused) {
      baseMs = Date.now() - t * msPerMin;
    } else {
      pausedAtMin = t;
    }
    tick();
  }

  // Bindings
  btnToggle?.addEventListener('click', () => { if (paused) start(); else pause(); });
  btnStop?.addEventListener('click', stop);
  selSpeed?.addEventListener('change', (e) => changeSpeed(Number(e.target.value || 1)));

  await ensureNotifyPermission();
  tick();
  start();

  const cleanup = () => { if (timer) clearInterval(timer); };
  window.__cookingCleanup = cleanup;
}
