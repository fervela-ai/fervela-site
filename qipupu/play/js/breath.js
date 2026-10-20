import {
  BASE_SECONDS, GENTLE_MIN, HARD_MAX, HICCUP_MS,
  HICCUP_PENALTY, HICCUP_COOLDOWN_MS,
  FLOOR_FACTOR, FLOOR_CAP, BLOW_START_MS, LOW_RATIO_MIN, REINFLATE_AFTER_MS, REINFLATE_RATE, BOOST_PER_VOLUME, BOOST_MAX, BREATH_CAP, BREATH_GAP_MS,
} from './config.js';

export function rms(samples) {
  if (!samples.length) return 0;
  let sum = 0;
  for (const value of samples) sum += value * value;
  return Math.sqrt(sum / samples.length);
}

export function averageFloor(samples) {
  if (!samples.length) return 0;
  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

export function createBreathState(level = 1) {
  const safeLevel = Math.max(1, Math.min(5, Math.round(level)));
  return {
    targetSeconds: BASE_SECONDS[safeLevel - 1],
    seconds: 0,
    highMs: 0,
    blowMs: 0,
    quietMs: 0,
    breathGain: 0,
    cooldownMs: 0,
    event: 'idle',
    done: false,
  };
}

function hiccup(state) {
  return {
    ...state,
    seconds: Math.max(0, state.seconds - state.targetSeconds * HICCUP_PENALTY),
    highMs: 0,
    cooldownMs: HICCUP_COOLDOWN_MS,
    event: 'hiccup',
  };
}

// 與消氣狀態機共用同一組門檻及連續吹氣時間。hard 是既有打嗝的音量條件；
// stepBreath 仍依 HICCUP_MS 累積時間才真正打嗝。
export function classifyBlow({ volume, floor = 0, dtMs = 50, blowMs = 0, gentleMin = GENTLE_MIN, hardMax = HARD_MAX, lowRatio = 1 }) {
  const threshold = Math.max(floor * FLOOR_FACTOR, floor + gentleMin);
  const hard = volume > floor + hardMax && lowRatio >= LOW_RATIO_MIN * 0.7;
  const candidate = !hard && volume >= threshold && lowRatio >= LOW_RATIO_MIN;
  const nextBlowMs = candidate ? blowMs + Math.max(0, dtMs) : 0;
  const blowing = candidate && nextBlowMs >= BLOW_START_MS;
  const strength = hard ? 'hard' : !blowing ? 'none' : volume < threshold + gentleMin ? 'soft' : 'ok';
  return { hard, candidate, blowing, strength, threshold, blowMs: nextBlowMs };
}

// lowRatio：低頻（吹氣風切聲）佔總能量的比例；沒給就當 1（測試、舊呼叫）
export function stepBreath(state, { volume, floor = 0, dtMs = 50, gentleMin = GENTLE_MIN, hardMax = HARD_MAX, lowRatio = 1 }) {
  if (state.done) return state;
  const dt = Math.max(0, dtMs);
  const cooldownMs = Math.max(0, state.cooldownMs - dt);
  const next = { ...state, blowMs: state.blowMs ?? 0, quietMs: state.quietMs ?? 0, breathGain: state.breathGain ?? 0, cooldownMs, event: 'idle' };
  if (state.cooldownMs > 0) return next;
  const signal = classifyBlow({ volume, floor, dtMs: dt, blowMs: next.blowMs, gentleMin, hardMax, lowRatio });
  if (signal.hard) {
    next.highMs += dt;
    next.blowMs = 0;
    return next.highMs >= HICCUP_MS ? hiccup(next) : next;
  }
  next.highMs = 0;
  if (!signal.candidate) {
    // 沒在吹：先等一下（換氣），停太久河豚就慢慢鼓回去
    next.blowMs = 0;
    next.quietMs += dt;
    if (next.quietMs >= BREATH_GAP_MS) next.breathGain = 0;  // 換氣了，下一口重新算
    if (next.quietMs > REINFLATE_AFTER_MS && next.seconds > 0) {
      next.seconds = Math.max(0, next.seconds - (dt / 1000) * REINFLATE_RATE);
      next.event = 'reinflate';
    }
    return next;
  }
  next.quietMs = 0;
  next.blowMs = signal.blowMs;
  if (next.blowMs < BLOW_START_MS) return next;  // 要連續像吹氣 0.1 秒才算
  const boost = Math.min(BOOST_MAX, 1 + (volume - signal.threshold) * BOOST_PER_VOLUME);  // 吹得越有力消得越快
  const room = next.targetSeconds * BREATH_CAP - next.breathGain;  // 這一口還能消多少
  if (room <= 0) { next.event = 'full'; return next; }               // 這口夠了，等換氣
  const gain = Math.min(room, (dt / 1000) * boost);
  next.breathGain += gain;
  next.seconds = Math.min(next.targetSeconds, next.seconds + gain);
  next.done = next.seconds >= next.targetSeconds;
  next.event = next.done ? 'done' : 'gentle';
  return next;
}

// 底噪跟著環境走，但「像吹氣的聲音」絕不算進底噪，且永遠不超過上限
// （0.7 真機：輕吹還沒過門檻時被當成安靜，底噪越吹越高，門檻漲到 0.376，怎麼吹都不動）
export function nextFloor(floor, volume, lowRatio) {
  if (lowRatio >= LOW_RATIO_MIN) return floor;
  return Math.min(FLOOR_CAP, floor * 0.97 + volume * 0.03);
}

export function progress(state) {
  return Math.min(1, state.seconds / state.targetSeconds);
}
