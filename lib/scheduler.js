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

  // attach culprit steps overlapping each interval for better UX
  const culpritOf = (interval) => {
    const list = [];
    for (const s of steps) {
      if (!s || !s.timeline) continue;
      if (!s.req || !s.req[interval.res]) continue;
      const overlap = Math.max(interval.start, s.timeline.start) < Math.min(interval.end, s.timeline.end);
      if (overlap) list.push(s.id);
    }
    return list;
  };

  const labelMap = { stove: 'コンロ', hands: '手作業', oven: 'オーブン' };
  return intervals.map(i => ({
    text: `${labelMap[i.res] || i.res} が ${i.start}-${i.end}分 の間 ${i.usage}>${i.cap}`,
    culprits: culpritOf(i),
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

// ---------- Advanced pipeline scheduling & leveling ----------

// Attempt to push steps later (within slack) honoring dependencies and optional targetEnd for sinks
export function scheduleBackward(inputSteps, options = {}) {
  const steps = inputSteps.map(s => ({ ...s, timeline: { ...s.timeline } }));
  const byId = new Map(steps.map(s => [s.id, s]));
  const depsOf = (s) => (s.after || []).filter(a => byId.has(a));
  // Build dependents map
  const dependents = new Map();
  for (const s of steps) for (const a of depsOf(s)) {
    if (!dependents.has(a)) dependents.set(a, []);
    dependents.get(a).push(s.id);
  }
  // Topological order using Kahn
  const indeg = new Map(steps.map(s => [s.id, 0]));
  for (const s of steps) for (const a of depsOf(s)) indeg.set(s.id, (indeg.get(s.id) || 0) + 1);
  const q = [];
  for (const s of steps) if ((indeg.get(s.id) || 0) === 0) q.push(s.id);
  const topo = [];
  while (q.length) {
    const id = q.shift(); topo.push(id);
    const outs = dependents.get(id) || [];
    for (const v of outs) { indeg.set(v, (indeg.get(v) || 0) - 1); if ((indeg.get(v) || 0) === 0) q.push(v); }
  }
  const order = topo.reverse(); // dependents first

  const targetEnd = Number.isFinite(options.targetEnd) ? options.targetEnd : null;
  for (const id of order) {
    const s = byId.get(id); if (!s || !s.timeline) continue;
    const t = s.time ?? Math.max(0, (s.timeline.end ?? 0) - (s.timeline.start ?? 0));
    const slack = Number.isFinite(s.slack) ? s.slack : 0;
    // latest allowed by slack
    let latestStart = (s.timeline.start ?? 0) + slack;
    // latest from dependents
    const outs = dependents.get(id) || [];
    if (outs.length) {
      const minDepStart = Math.min(...outs.map(cid => (byId.get(cid)?.timeline?.start ?? Infinity)));
      latestStart = Math.min(latestStart, minDepStart - t);
    } else if (targetEnd !== null) {
      latestStart = Math.min(latestStart, targetEnd - t);
    }
    // Earliest from prerequisites
    const earliest = depsOf(s).length ? Math.max(...depsOf(s).map(pid => byId.get(pid)?.timeline?.end ?? 0)) : 0;
    const newStart = Math.max(earliest, latestStart);
    if (newStart > (s.timeline.start ?? 0)) {
      s.timeline.start = newStart;
      s.timeline.end = newStart + t;
    }
  }
  return steps;
}

function cloneSteps(input) { return input.map(s => ({ ...s, timeline: s.timeline ? { ...s.timeline } : null })); }

function severityOfConflicts(confs) {
  // Sum of (overuse * duration)
  return (confs || []).reduce((acc, c) => acc + Math.max(0, (c.usage - c.cap)) * Math.max(0, c.end - c.start), 0);
}

function computePeakUsage(steps, resKey) {
  const pts = new Set();
  steps.forEach(s => { if (s.timeline) { pts.add(s.timeline.start); pts.add(s.timeline.end); } });
  const arr = Array.from(pts).sort((a,b) => a-b);
  let peak = 0;
  for (let i = 0; i < arr.length - 1; i++) {
    const mid = (arr[i] + arr[i+1]) / 2;
    let u = 0;
    for (const s of steps) {
      if (!s.timeline || !s.req || !s.req[resKey]) continue;
      if (s.timeline.start <= mid && mid < s.timeline.end) u += s.req[resKey];
    }
    peak = Math.max(peak, u);
  }
  return peak;
}

export function levelResources(inputSteps, capacity, options = {}) {
  const step = options.step || 0.5;
  const pinned = new Set(options.pinnedIds || []);
  const steps = cloneSteps(inputSteps);

  const byId = new Map(steps.map(s => [s.id, s]));
  const depsOf = (s) => (s.after || []).filter(a => byId.has(a));
  const dependents = new Map();
  for (const s of steps) for (const a of depsOf(s)) { if (!dependents.has(a)) dependents.set(a, []); dependents.get(a).push(s.id); }

  const maxIter = options.maxIter || 200;
  let best = cloneSteps(steps);
  let bestConfs = computeConflicts(best, capacity);
  let bestScore = severityOfConflicts(bestConfs);
  let bestPeakHands = computePeakUsage(best, 'hands');

  for (let iter = 0; iter < maxIter; iter++) {
    const confs = computeConflicts(steps, capacity);
    if (!confs.length) break;
    // pick worst interval by overuse*duration
    const scored = confs.map(c => ({ c, score: Math.max(0, (c.usage - c.cap)) * Math.max(0, c.end - c.start) }))
                        .sort((a,b) => b.score - a.score);
    const { c } = scored[0];
    const resKey = c.res;

    // candidate culprits sorted: movable first, lower priority first
    const candidates = (c.culprits || [])
      .map(id => byId.get(id))
      .filter(s => s && !pinned.has(s.id) && Number.isFinite(s.slack) && s.slack > 0 && s.req && s.req[resKey] > 0)
      .sort((a,b) => (Number(a.priority || 0) - Number(b.priority || 0)) || ((a.slack||0) - (b.slack||0)));

    let improved = false;
    for (const s of candidates) {
      const dur = s.time ?? Math.max(0, s.timeline.end - s.timeline.start);
      const earliest = s.timeline.start; // only move later within slack
      const latestBySlack = s.timeline.start + (Number.isFinite(s.slack) ? s.slack : 0);
      const depsEnd = depsOf(s).length ? Math.max(...depsOf(s).map(pid => byId.get(pid)?.timeline?.end ?? 0)) : 0;
      const earliestAllowed = Math.max(earliest, depsEnd);
      const depStarts = (dependents.get(s.id) || []).map(cid => byId.get(cid)?.timeline?.start ?? Infinity);
      const latestByDeps = depStarts.length ? Math.min(...depStarts) - dur : Infinity;
      const latestAllowed = Math.min(latestBySlack, latestByDeps);
      if (!(earliestAllowed <= latestAllowed)) continue;

      // Try shifts in step increments until s no longer overlaps the conflict interval
      const current = s.timeline.start;
      const targetMin = Math.min(Math.max(c.end - 1e-6, earliestAllowed), latestAllowed);
      let bestLocal = null;
      for (let st = Math.max(roundUp(current + step, step), earliestAllowed); st <= latestAllowed + 1e-9; st = roundUp(st + step, step)) {
        const en = st + dur;
        // Skip if still overlaps the conflicting window too much
        const stillOverlap = Math.max(c.start, st) < Math.min(c.end, en);
        if (stillOverlap && st < targetMin - 1e-9) continue;
        // Tentative move
        const trial = cloneSteps(steps);
        const ts = trial.find(x => x.id === s.id);
        ts.timeline.start = st; ts.timeline.end = en;
        const confTrial = computeConflicts(trial, capacity);
        const sevTrial = severityOfConflicts(confTrial);
        const peakHandsTrial = computePeakUsage(trial, 'hands');

        // Decide based on objective
        const obj = options.objective || 'min_conflicts';
        let better = false;
        if (obj === 'min_peak_hands') better = peakHandsTrial < bestPeakHands - 1e-9 || (peakHandsTrial <= bestPeakHands && sevTrial < bestScore - 1e-9);
        else better = sevTrial < bestScore - 1e-9;
        if (better) {
          bestLocal = { st, en, sevTrial, peakHandsTrial, confTrial, trial };
          break; // accept first improvement
        }
      }
      if (bestLocal) {
        // commit
        s.timeline.start = bestLocal.st; s.timeline.end = bestLocal.en;
        best = cloneSteps(bestLocal.trial);
        bestScore = bestLocal.sevTrial;
        bestPeakHands = bestLocal.peakHandsTrial;
        improved = true;
        break;
      }
    }
    if (!improved) break; // stuck
  }
  return best;
}

export function schedulePipeline(inputSteps, capacity, options = {}) {
  // 1) Backward (optional)
  let s1 = inputSteps.map(s => ({ ...s, timeline: s.timeline ? { ...s.timeline } : null }));
  if (Number.isFinite(options.targetEnd)) {
    s1 = scheduleBackward(s1, { targetEnd: options.targetEnd });
  }
  // 2) Greedy capacity-aware forward placement
  let s2 = scheduleGreedy(s1, capacity, { step: options.step || 0.5 });
  // 3) Leveling to reduce conflicts / peaks
  let s3 = levelResources(s2, capacity, { objective: options.objective || 'min_conflicts', step: options.step || 0.5, pinnedIds: options.pinnedIds || [] });
  return s3;
}
