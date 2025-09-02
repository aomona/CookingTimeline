// Simple capacity conflict checker and greedy scheduler

export function computeConflicts(steps, capacity) {
  const resources = new Set();
  steps.forEach(s => Object.keys(s.req || {}).forEach(k => resources.add(k)));
  if (resources.size === 0) return [];

  const evts = [];
  for (const s of steps) {
    if (!s.timeline) continue;
    const req = s.req || {};
    evts.push({ t: s.timeline.start, type: 'start', req });
    evts.push({ t: s.timeline.end, type: 'end', req });
  }
  evts.sort((a, b) => a.t === b.t ? (a.type === 'end' ? -1 : 1) : a.t - b.t);

  const curr = {}; for (const r of resources) curr[r] = 0;
  let prevT = null;
  const intervals = [];
  for (const e of evts) {
    if (prevT !== null && prevT < e.t) {
      for (const r of resources) {
        const cap = (capacity && Number.isFinite(capacity[r])) ? capacity[r] : 1;
        if (curr[r] > cap) {
          intervals.push({ res: r, start: prevT, end: e.t, usage: curr[r], cap });
        }
      }
    }
    for (const [k, v] of Object.entries(e.req || {})) {
      curr[k] = (curr[k] || 0) + (e.type === 'start' ? v : -v);
    }
    prevT = e.t;
  }

  const labelMap = { stove: 'コンロ', hands: '手作業', oven: 'オーブン' };
  return intervals.map(i => ({
    text: `${labelMap[i.res] || i.res} が ${i.start}-${i.end}分 の間 ${i.usage}>${i.cap}`,
    ...i
  }));
}

export function scheduleGreedy(inputSteps, capacity, options = {}) {
  const step = options.step || 0.5; // search granularity in minutes
  const steps = inputSteps.map(s => ({ ...s, timeline: { ...s.timeline } }));

  // Normalize dependencies to global ids expected in merged steps
  const idSet = new Set(steps.map(s => s.id));
  const depOf = (s) => (s.after || []).map(a => {
    // if already prefixed with recipe (contains ':'), keep; else assume same recipe
    if (a.includes(':')) return a;
    return `${s.__recipeId}:${a}`;
  }).filter(a => idSet.has(a));

  // Scheduled intervals for capacity checks
  const scheduled = []; // { start, end, req, id }

  function fits(start, end, req) {
    // Check overlap with scheduled to ensure capacity not exceeded at any time
    const resources = Object.keys(req || {});
    // iterate over all "change points"
    const points = new Set([start, end]);
    for (const sc of scheduled) {
      // Only consider overlapping windows
      if (Math.max(start, sc.start) < Math.min(end, sc.end)) {
        points.add(sc.start); points.add(sc.end);
      }
    }
    const sorted = Array.from(points).sort((a,b) => a-b);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i+1];
      const mid = (a + b) / 2;
      // compute usage at mid
      const usage = {};
      for (const sc of scheduled) {
        if (sc.start <= mid && mid < sc.end) {
          for (const [k,v] of Object.entries(sc.req || {})) usage[k] = (usage[k]||0) + v;
        }
      }
      for (const [k,v] of Object.entries(req || {})) usage[k] = (usage[k]||0) + v;
      for (const k of Object.keys(usage)) {
        const cap = (capacity && Number.isFinite(capacity[k])) ? capacity[k] : 1;
        if (usage[k] > cap) return false;
      }
    }
    return true;
  }

  // Sort by baseline start (then by recipe id to stabilize)
  steps.sort((a,b) => (a.timeline.start - b.timeline.start) || String(a.__recipeId).localeCompare(String(b.__recipeId)));

  const byId = new Map(steps.map(s => [s.id, s]));
  const finishTime = (id) => {
    const s = byId.get(id); if (!s) return 0; return s.timeline.end;
  };

  for (const s of steps) {
    const baseStart = s.timeline.start;
    const t = s.time ?? Math.max(0, (s.timeline.end ?? baseStart) - baseStart);
    const slack = Number.isFinite(s.slack) ? s.slack : 0; // no back-compat needed
    const deps = depOf(s);
    const depsReady = deps.length ? Math.max(...deps.map(finishTime)) : 0;
    const earliest = Math.max(baseStart, depsReady);
    const latest = earliest + slack;
    let placed = false;
    // Try feasible placement
    for (let st = roundUp(earliest, step); st <= latest + 1e-9; st = roundUp(st + step, step)) {
      const en = st + t;
      if (fits(st, en, s.req || {})) {
        s.timeline.start = st; s.timeline.end = en;
        scheduled.push({ start: st, end: en, req: s.req || {}, id: s.id });
        placed = true; break;
      }
    }
    if (!placed) {
      // Place at earliest even if conflicts; still push so dependent steps can proceed
      s.timeline.start = earliest; s.timeline.end = earliest + t;
      scheduled.push({ start: earliest, end: earliest + t, req: s.req || {}, id: s.id });
    }
  }

  return steps;
}

function roundUp(x, step) {
  return Math.ceil(x / step - 1e-9) * step;
}

