import { TRUCK_LEVELS, levelAt } from './levels.js';
import { createPuffTracker, stepPuff } from './puff.js';

export function beatTimes(config) {
  let time = config.beatMs * 3;
  return config.pattern.map((beat, index) => {
    if (index) time += beat.gap * config.beatMs;
    return time;
  });
}

export function createLevel(levelNo) {
  const config = levelAt(TRUCK_LEVELS, levelNo);
  return { levelNo, config, elapsedMs: 0, puff: createPuffTracker(),
    times: beatTimes(config), hit: config.pattern.map(() => false), missed: config.pattern.map(() => false),
    hits: 0, misses: 0, extra: 0, streak: 0, maxStreak: 0,
    event: 'idle', done: false, failed: false, stars: 0 };
}

export function stepGame(state, { blowing = false, strength = 'none', dtMs = 50 } = {}) {
  if (state.done || state.failed) return state;
  const dt = Math.min(Math.max(0, dtMs), state.config.limitMs - state.elapsedMs);
  const { tracker, onset } = stepPuff(state.puff, { blowing, strength, dtMs: dt });
  const next = { ...state, puff: tracker, elapsedMs: state.elapsedMs + dt,
    hit: [...state.hit], missed: [...state.missed], event: 'idle' };
  if (tracker.hardCount > state.puff.hardCount) next.event = 'hard';
  if (onset) {
    const at = tracker.onsetAtMs;
    let closest = -1, distance = Infinity;
    state.times.forEach((time, index) => {
      const d = Math.abs(at - time);
      if (d <= state.config.windowMs && d < distance) { closest = index; distance = d; }
    });
    if (closest >= 0 && state.config.pattern[closest].hit && !next.hit[closest]) {
      next.hit[closest] = true;
      next.hits++;
      next.streak++;
      next.maxStreak = Math.max(next.maxStreak, next.streak);
      next.event = 'hit';
    } else {
      next.extra++;
      next.streak = 0;
      next.event = 'extra';
    }
  }
  state.times.forEach((time, index) => {
    if (state.config.pattern[index].hit && !next.hit[index] && !next.missed[index]
        && next.elapsedMs >= time + state.config.windowMs + 150) {
      next.missed[index] = true;
      next.misses++;
      next.streak = 0;
      if (next.event === 'idle') next.event = 'miss';
    }
  });
  if (next.elapsedMs >= state.times.at(-1) + state.config.windowMs + 150
      || next.elapsedMs >= state.config.limitMs) {
    const needed = state.config.pattern.filter(beat => beat.hit).length;
    next.done = next.hits >= Math.ceil(needed / 2);
    next.failed = !next.done;
    next.stars = next.done ? next.hits === needed && next.extra === 0 && tracker.hardCount === 0
      ? 3 : next.misses <= 1 && next.extra === 0 ? 2 : 1 : 0;
    next.event = next.done ? 'complete' : 'truckLeft';
  }
  return next;
}
