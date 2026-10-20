import { MEETING_LEVELS, MEETING_EXPRESSIONS, MEETING_BACKGROUNDS, levelAt } from './levels.js';
import { createPuffTracker, stepPuff } from './puff.js';

const FILTERS = ['河豚董事長', '夢遊模式', '早餐店老闆'];

export function createLevel(levelNo) {
  const config = levelAt(MEETING_LEVELS, levelNo);
  return { levelNo, config, elapsedMs: 0, puff: createPuffTracker(), stageIndex: 0,
    stageStartMs: 0, puffs: 0, wrong: 0, perfect: 0, expression: null, background: null,
    filter: null, selected: null, event: 'idle', done: false, failed: false, stars: 0 };
}

export function wheelAt(state, timeMs = state.elapsedMs) {
  const kind = state.config.stages[state.stageIndex];
  const choices = kind === 'expression' ? MEETING_EXPRESSIONS : MEETING_BACKGROUNDS;
  const config = state.config;
  let local = Math.max(0, timeMs - state.stageStartMs);
  if (config.speedUpAfterMs && timeMs > config.speedUpAfterMs) {
    const slow = Math.max(0, config.speedUpAfterMs - state.stageStartMs);
    local = Math.min(local, slow) + Math.max(0, local - slow) * config.periodMs / config.speedUpPeriodMs;
  }
  const cycleMs = choices.length * config.periodMs + config.fakePauseMs;
  const cyclePhase = local % cycleMs;
  const fakeStart = 3 * config.periodMs;
  const fake = config.fakePauseMs && cyclePhase >= fakeStart && cyclePhase < fakeStart + config.fakePauseMs;
  const adjusted = cyclePhase >= fakeStart + config.fakePauseMs ? cyclePhase - config.fakePauseMs
    : fake ? fakeStart - .001 : cyclePhase;
  const step = Math.min(choices.length - 1, Math.floor(adjusted / config.periodMs));
  // 10/19 太守驗收：輪盤從「正確那格往後兩格」開始轉，不然一開場馬上吹就過關
  const correct = kind === 'expression' ? config.expression : config.background;
  const index = (choices.indexOf(correct) + 2 + step) % choices.length;
  const phase = (adjusted % config.periodMs) / config.periodMs;
  return { kind, value: choices[index], index, phase, fake: Boolean(fake),
    best: !fake && phase >= .3 && phase <= .7 };
}

export function stepGame(state, { blowing = false, strength = 'none', dtMs = 50 } = {}) {
  if (state.done || state.failed) return state;
  const dt = Math.min(Math.max(0, dtMs), state.config.limitMs - state.elapsedMs);
  const { tracker, onset } = stepPuff(state.puff, { blowing, strength, dtMs: dt });
  const next = { ...state, puff: tracker, elapsedMs: state.elapsedMs + dt, event: 'idle', selected: null };
  if (tracker.hardCount > state.puff.hardCount) next.event = 'hard';
  if (onset) {
    const wheel = wheelAt(state, tracker.onsetAtMs);
    const correct = wheel.kind === 'expression' ? state.config.expression : state.config.background;
    next.puffs++;
    next.selected = wheel.value;
    if (wheel.value !== correct) {
      next.wrong++;
      next.filter = FILTERS[(next.wrong - 1) % FILTERS.length];
      next.event = 'wrong';
    } else {
      next[wheel.kind] = wheel.value;
      if (wheel.best) next.perfect++;
      next.filter = null;
      next.stageIndex++;
      next.stageStartMs = next.elapsedMs;
      next.event = wheel.best ? 'perfect' : 'freeze';
    }
  }
  if (next.stageIndex === state.config.stages.length) {
    next.done = true;
    next.stars = next.wrong === 0 && next.perfect === state.config.stages.length
      && tracker.hardCount === 0 ? 3 : next.wrong === 0 ? 2 : 1;
    next.event = 'complete';
  } else if (next.puffs >= state.config.maxPuffs || next.elapsedMs >= state.config.limitMs) {
    next.failed = true;
    next.event = next.puffs >= state.config.maxPuffs ? 'bossSaw' : 'timeout';
  }
  return next;
}
