import { CANDLE_LEVELS, levelAt } from './levels.js';

export function createLevel(levelNo) {
  const config = levelAt(CANDLE_LEVELS, levelNo);
  return { levelNo, config, elapsedMs: 0, lit: Array(config.count).fill(true),
    currentMs: 0, gapMs: 0, inBreath: false, breaths: 0, currentBreathCount: 0,
    maxOneBreath: 0, event: 'idle', done: false, stars: 0, failed: false };
}

export function stepGame(state, { blowing = false, strength = 'none', dtMs = 50 }) {
  if (state.done || state.failed) return state;
  const config = state.config;
  const dt = Math.min(Math.max(0, dtMs), config.limitMs - state.elapsedMs);
  const next = { ...state, lit: [...state.lit], elapsedMs: Math.min(config.limitMs, state.elapsedMs + dt), event: 'idle' };
  const active = blowing && strength !== 'hard';
  if (strength === 'hard') next.event = 'hard';
  if (active) {
    if (!next.inBreath) { next.inBreath = true; next.breaths++; next.currentBreathCount = 0; }
    next.gapMs = 0;
    let budget = dt;
    while (budget > 0) {
      const index = next.lit.indexOf(true);
      if (index < 0) break;
      const stubborn = config.stubbornEvery && (index + 1) % config.stubbornEvery === 0;
      const needed = (strength === 'soft' ? config.softMs : config.normalMs) + (stubborn ? config.stubbornMs : 0);
      const taken = Math.min(budget, needed - next.currentMs);
      next.currentMs += taken;
      budget -= taken;
      if (next.currentMs + 1e-8 < needed) break;
      next.lit[index] = false;
      next.currentMs = 0;
      next.currentBreathCount++;
      next.maxOneBreath = Math.max(next.maxOneBreath, next.currentBreathCount);
      next.event = 'extinguish';
    }
  } else if (strength !== 'hard') {
    next.gapMs += dt;
    if (next.gapMs > config.gapMs && next.inBreath) {
      next.inBreath = false;
      next.currentMs = 0;
      next.event = 'breathEnd';
    }
    if (config.magicEvery && next.gapMs > config.relightMs) {
      let relit = false;
      next.lit.forEach((lit, index) => {
        if (!lit && (index + 1) % config.magicEvery === 0) { next.lit[index] = true; relit = true; }
      });
      if (relit) next.event = 'relight';
    }
  }
  if (next.lit.every(lit => !lit)) {
    next.done = true;
    next.stars = next.breaths === 1 ? 3 : next.breaths === 2 ? 2 : 1;
    next.event = 'complete';
  } else if (next.elapsedMs >= config.limitMs) {
    next.failed = true;
    next.event = 'timeout';
  }
  return next;
}
