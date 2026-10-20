import { NOTE_LEVELS, levelAt } from './levels.js';

export const NOTE_PHRASES = [
  '快速對一下','這個很簡單吧','下班前給我','再改一版','先這樣再看看',
  '同步一下進度','幫忙補個表','會後再討論','先開個短會','這版先參考',
  '請更新附件','有空回我一下','先列三個方向','明天再確認','下午前有嗎',
  '先做個摘要','要不要再精簡','版本號再確認','請抄送大家','資料再對齊',
  '這題先記下','明早同步一下','請加個備註','先排進行程','可以再順一下',
  '週五前更新','再補一張圖','有沒有舊版本','表格要重排','幫忙看個數字',
  '先留個紀錄','開會前先看','請確認日期','檔名再改一下','這頁再調整',
  '下一版再放','下週再追蹤','先寫個草稿','請補上連結','會議室再訂',
];

function shuffledPhrases(seed, count) {
  let value = (Math.floor(seed * 0xFFFFFFFF) >>> 0) || 1;
  const pool = [...NOTE_PHRASES];
  for (let i = pool.length - 1; i > 0; i--) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    const j = value % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function createLevel(levelNo, seed = levelNo / 11) {
  const config = levelAt(NOTE_LEVELS, levelNo);
  return { levelNo, config, elapsedMs: 0, gone: 0, currentMs: 0,
    phrases: shuffledPhrases(seed, config.count), oneBreathCount: 0, maxOneBreath: 0,
    event: 'idle', done: false, stars: 0, failed: false };
}

export function stepGame(state, { blowing = false, strength = 'none', dtMs = 50 }) {
  if (state.done || state.failed) return state;
  const config = state.config;
  const dt = Math.min(Math.max(0, dtMs), config.limitMs - state.elapsedMs);
  const next = { ...state, elapsedMs: Math.min(config.limitMs, state.elapsedMs + dt), event: 'idle' };
  if (strength === 'hard') next.event = 'hard';
  else if (blowing) {
    let budget = dt;
    while (budget > 0 && next.gone < config.count) {
      const urgent = config.urgentEvery && (next.gone + 1) % config.urgentEvery === 0;
      const needed = urgent ? config.urgentMs * (strength === 'soft' ? 2 : 1) : strength === 'soft' ? config.softMs : config.normalMs;
      const taken = Math.min(budget, needed - next.currentMs);
      next.currentMs += taken;
      budget -= taken;
      if (next.currentMs + 1e-8 < needed) break;
      next.gone++;
      next.currentMs = 0;
      next.oneBreathCount++;
      next.maxOneBreath = Math.max(next.maxOneBreath, next.oneBreathCount);
      next.event = 'fly';
    }
  } else {
    next.currentMs = 0;
    next.oneBreathCount = 0;
  }
  if (next.gone === config.count) {
    next.done = true;
    const remaining = config.limitMs - next.elapsedMs;
    next.stars = remaining >= 30000 ? 3 : remaining >= 10000 ? 2 : 1;
    next.event = 'complete';
  } else if (next.elapsedMs >= config.limitMs) {
    next.failed = true;
    next.event = 'timeout';
  }
  return next;
}
