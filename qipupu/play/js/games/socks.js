import { SOCK_LEVELS, SOCK_CATALOG, levelAt } from './levels.js';
import { createPuffTracker, stepPuff } from './puff.js';

export function createLevel(levelNo) {
  const config = levelAt(SOCK_LEVELS, levelNo);
  return { levelNo, config, elapsedMs: 0, puff: createPuffTracker(),
    pairs: 0, wrong: 0, selected: null, event: 'idle', done: false, failed: false, stars: 0 };
}

export function spotlightAt(config, timeMs) {
  const period = config.periodMs;
  const phase = ((timeMs % period) + period) % period / period;
  const id = config.carousel[Math.floor(timeMs / period) % config.carousel.length];
  return { sock: SOCK_CATALOG[id], lit: phase >= .2 && phase <= .8, phase };
}

export function stepGame(state, { blowing = false, strength = 'none', dtMs = 50 } = {}) {
  if (state.done || state.failed) return state;
  const dt = Math.min(Math.max(0, dtMs), state.config.limitMs - state.elapsedMs);
  const { tracker, onset } = stepPuff(state.puff, { blowing, strength, dtMs: dt });
  const next = { ...state, puff: tracker, elapsedMs: state.elapsedMs + dt, event: 'idle', selected: null };
  if (tracker.hardCount > state.puff.hardCount) next.event = 'hard';
  if (onset) {
    const spot = spotlightAt(state.config, tracker.onsetAtMs);
    if (spot.lit) {
      next.selected = spot.sock.id;
      if (spot.sock.id === state.config.targets[state.pairs]) {
        next.pairs++;
        next.event = 'match';
      } else {
        next.wrong++;
        next.event = 'wrong';
      }
    }
  }
  if (next.pairs === state.config.pairs) {
    next.done = true;
    next.stars = next.wrong === 0 && tracker.hardCount === 0 ? 3 : next.wrong <= 1 ? 2 : 1;
    next.event = 'complete';
  } else if (next.wrong >= state.config.maxWrong || next.elapsedMs >= state.config.limitMs) {
    next.failed = true;
    next.event = next.wrong >= state.config.maxWrong ? 'tooManyWrong' : 'timeout';
  }
  return next;
}
