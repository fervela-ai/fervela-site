import { SOUP_LEVELS, levelAt } from './levels.js';

export function createLevel(levelNo) {
  const config = levelAt(SOUP_LEVELS, levelNo);
  return { levelNo, config, elapsedMs: 0, temperature: config.start, splashed: false,
    breathMs: 0, longestBreathMs: 0, event: 'idle', done: false, stars: 0, failed: false };
}

export function stepGame(state, { blowing = false, strength = 'none', dtMs = 50 }) {
  if (state.done || state.failed) return state;
  const config = state.config;
  const dt = Math.min(Math.max(0, dtMs), config.limitMs - state.elapsedMs);
  const active = blowing && (strength === 'ok' || strength === 'soft');
  const rate = active ? config.rate * (strength === 'soft' ? 0.5 : 1) : config.passiveRate;
  const temperature = Math.max(config.target, state.temperature - rate * dt / 1000);
  const breathMs = active ? state.breathMs + dt : 0;
  const next = { ...state, temperature, breathMs, longestBreathMs: Math.max(state.longestBreathMs, breathMs),
    elapsedMs: Math.min(config.limitMs, state.elapsedMs + dt),
    splashed: state.splashed || strength === 'hard', event: strength === 'hard' ? 'splash' : active ? 'cooling' : 'idle' };
  if (temperature <= config.target) {
    next.done = true;
    next.stars = next.splashed ? 1 : next.elapsedMs <= 30000 ? 3 : 2;
    next.event = 'complete';
  } else if (next.elapsedMs >= config.limitMs) {
    next.failed = true;
    next.event = 'timeout';
  }
  return next;
}
