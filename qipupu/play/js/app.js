import { CATEGORIES, LEVEL_LABELS, SAMPLE_MS, GENTLE_MIN, VERSION, BASE_SECONDS, FLOOR_FACTOR, LOW_RATIO_MIN, FUNNEL_ON, FUNNEL_STEPS } from './config.js';
import FervelaFunnel from './funnel.js';
import { ASSETS, formImage, levelPuff, LEVEL_SCALE } from './assets.js';
import { averageFloor, createBreathState, stepBreath, progress } from './breath.js';
import { startBreathInput, startNativeMic, readVolume, micConstraints } from './mic.js';
import { selectTemplate, dateKey, displayDate, makeSerial, drawCertificate, inflatePercent } from './certificate.js';
import { read, write, sessions, collection, certificates, countFor, countForDay, saveCompletion, setAfter, resetAll } from './storage.js';
import { playSound } from './audio.js';
import { createLevel as createCandles, stepGame as stepCandles } from './games/candles.js';
import { createLevel as createSoup, stepGame as stepSoup } from './games/soup.js';
import { createLevel as createNotes, stepGame as stepNotes } from './games/notes.js';
import { createLevel as createSocks, stepGame as stepSocks, spotlightAt } from './games/socks.js';
import { createLevel as createTruck, stepGame as stepTruck } from './games/truck.js';
import { createLevel as createMeeting, stepGame as stepMeeting, wheelAt } from './games/meeting.js';
import { SOCK_CATALOG } from './games/levels.js';
import { bestStars, unlocked, totalStars, record, saveResult } from './games/progress.js';
import { GAME_ASSETS } from './games/assets.js';
import { drawGameCard } from './games/share.js';

const GAMES = {
  candles: { name: '吹蠟燭', about: '一口氣吹熄整排蠟燭', instruction: '慢慢吹，看看一口氣能熄幾根', create: createCandles, step: stepCandles },
  soup: { name: '吹涼珍奶／熱湯', about: '慢慢吹涼才能喝', instruction: '慢慢吹到 60°C，別讓湯濺出來', create: createSoup, step: stepSoup },
  notes: { name: '吹走便利貼', about: '把待辦一張張吹走', instruction: '慢慢吹，每張都要吹夠久', create: createNotes, step: stepNotes },
  socks: { name: '襪子失蹤案', about: '看準另一隻襪子', instruction: '聚光燈裡看到同款襪，短吹一下', create: createSocks, step: stepSocks },
  truck: { name: '垃圾車節拍長', about: '看燈號抓住節拍', instruction: '先看三拍倒數，橘燈短吹，灰燈別吹', create: createTruck, step: stepTruck },
  meeting: { name: '視訊會議濾鏡就位', about: '定格表情和背景', instruction: '看題目，在正確格短吹定格', create: createMeeting, step: stepMeeting },
};

const $ = id => document.getElementById(id);
const state = {
  tab: 'calm', step: 'pick', category: null, before: 3, mode: 'mic',
  breath: null, floor: 0, stream: null, audioContext: null, timer: null, micStop: null,
  token: 0, templates: [], png: null, currentSession: null, startedAt: 0,
  sound: read('sound', true), lastPuff: 0, finishing: false,
  gameId: null, gameLevel: 1, game: null, gameMicStop: null, gameBreathMs: 0,
  gameLongestMs: 0, gamePng: null,
  gameCardToken: 0, gameArt: null,
};

async function loadTemplates() {
  for (const path of ['./data/templates.json', './data/templates.sample.json']) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length) return data;
      }
    } catch { /* 本地範本接手 */ }
  }
  return [];
}

function categoryInfo(id) { return CATEGORIES.find(item => item.id === id) ?? CATEGORIES.at(-1); }
function sound(name) { playSound(name, state.sound); }
// 匿名使用漏斗：總開關關著時什麼都不做（見 config.js FUNNEL_ON）
function funnelStep(name) { if (FUNNEL_ON) FervelaFunnel.step(name); }
function funnelPlatform() {
  if (location.protocol === 'app:' || window.qipupuNative?.ios) return 'ios';
  if (location.host === 'appassets.androidplatform.net') return 'android';
  return 'web';
}
function haptic(style) {
  if (window.qipupuNative?.ios) window.qipupuNative.postMessage(JSON.stringify({ type: 'haptic', style }));
  else try { navigator.vibrate?.(30); } catch { /* 瀏覽器不支援震動 */ }
}

let toastTimer;
window.qipupuNativeToast = message => {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2000);
};

function setStep(step) {
  if (state.step === 'breathe' && step !== 'breathe') stopBreathing();
  state.step = step;
  $('tab-calm').dataset.step = step;
  for (const name of ['pick', 'breathe', 'result']) $('step-' + name).classList.toggle('active', name === step);
  syncBackStack();
}

function setTab(tab) {
  if (state.tab === 'calm' && tab !== 'calm' && state.step === 'breathe') {
    stopBreathing();
    $('mode-note').textContent = '已暫停。按下方按鈕繼續吹。';
    $('mode-button').hidden = false;  // 0.18：暫停後原本沒有按鈕可以繼續，卡住
  }
  if (state.tab === 'settings' && tab !== 'settings' && (state.stream || state.micStop)) stopMicrophone();
  if (state.tab === 'games' && tab !== 'games') stopGameMic();
  state.tab = tab;
  for (const name of ['calm', 'games', 'collection', 'certificates', 'settings']) {
    $('tab-' + name).classList.toggle('active', name === tab);
  }
  document.querySelectorAll('.nav-button').forEach(button => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (tab === 'collection') renderCollection();
  if (tab === 'certificates') renderCertificates();
  if (tab === 'games') showGameHome();
  syncBackStack();
}

function renderCategories() {
  $('category-buttons').replaceChildren(...CATEGORIES.map(item => {
    const button = document.createElement('button');
    button.className = 'category-button' + (state.category === item.id ? ' selected' : '');
    button.type = 'button';
    const icon = document.createElement('img');
    icon.src = ASSETS.catIcon(item.id);
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = item.label;
    button.append(icon, label);
    button.setAttribute('aria-pressed', String(state.category === item.id));
    button.addEventListener('click', () => {
      state.category = item.id;
      funnelStep('選類別');
      $('start-button').disabled = false;
      renderCategories();
    });
    return button;
  }));
}

function renderLevel() {
  $('before-label').textContent = LEVEL_LABELS[state.before - 1];
  const puffer = $('pick-puffer');
  const src = levelPuff(state.before);
  if (!puffer.src.endsWith(src.slice(1))) puffer.src = src;
  puffer.style.setProperty('--scale', String(LEVEL_SCALE[state.before - 1]));
  puffer.classList.toggle('shaking', state.before >= 4);
  puffer.style.animationDuration = `${Math.max(.08, .25 - state.before * .03)}s`;
  const input = $('before-level');
  input.style.setProperty('--fill', `${(state.before - 1) * 25}%`);
}

function stopMicrophone() {
  state.token++;
  state.micStop?.();
  state.micStop = null;
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  if (state.stream) state.stream.getTracks().forEach(track => track.stop());
  state.stream = null;
  if (state.audioContext) state.audioContext.close().catch(() => {});
  state.audioContext = null;
}

function stopBreathing() {
  stopMicrophone();
  glowLevel = 0;  // 亮光熄掉（0.9.9）
  $('ring').style.setProperty('--glow', '0');
  $('ring').classList.remove('glow-ok');
}

// 0.9.9 Miles：「某些角度吹沒反應，要完全正對孔才有」→ 圓環即時亮光：聽到在吹就淡藍微亮、越接近越亮；吹對了變陶土橘
let glowLevel = 0;
function showGlow(volume, lowRatio, calibration, options = {}) {
  const ring = options.ring ?? $('ring');
  const gentle = calibration?.gentleMin ?? GENTLE_MIN;
  const floor = options.floor ?? state.floor;
  const threshold = Math.max(floor * FLOOR_FACTOR, floor + gentle);
  const raw = Math.min(1, volume / threshold) * Math.min(1, lowRatio / LOW_RATIO_MIN);
  glowLevel = glowLevel * 0.6 + raw * 0.4;  // 平滑，不閃
  const ok = options.ok ?? ['gentle', 'full'].includes(state.breath.event);
  ring.style.setProperty('--glow', ok ? '1' : glowLevel.toFixed(2));
  ring.classList.toggle('glow-ok', ok);
  if (options.done ?? state.breath.done) return;
  (options.hint ?? $('ring-hint')).textContent = ok ? '對了！繼續吹' : glowLevel > 0.25 ? '再靠近一點' : options.idleText ?? '消氣中';
}

// 0.9.6：藏起來的測試數值——設定頁連點版本號 5 下開關（Miles 回報吹不動時截圖用）
function showDebug(volume, lowRatio, calibration) {
  const el = $('breath-debug');
  if (!read('debug', false)) { el.hidden = true; return; }
  el.hidden = false;
  const gentle = calibration?.gentleMin ?? GENTLE_MIN;
  const threshold = Math.max(state.floor * FLOOR_FACTOR, state.floor + gentle);
  const names = { idle: '等待', gentle: '吹氣中', hiccup: '打嗝', reinflate: '鼓回去', full: '換氣', done: '完成' };
  el.textContent = `音量 ${volume.toFixed(3)}｜門檻 ${threshold.toFixed(3)}｜低頻 ${Math.round(lowRatio * 100)}%｜${names[state.breath.event] ?? state.breath.event}｜降噪${read('nsOn', false) ? '開' : '關'}`;
}

// 麥克風打不開時講清楚原因（10/17 Miles 真機：只寫「無法使用」查不出來）
function micErrorText(error) {
  const name = error?.name || error?.message || '未知';
  // 0.18：畫面不給使用者看英文錯誤代碼；代碼只在測試數值打開時附上
  const code = read('debug', false) ? `（${name}）` : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return `還沒允許使用麥克風${code}：到手機的 設定 → 應用程式 → 氣噗噗 → 權限 → 麥克風，改成「使用期間允許」，再按下方按鈕。`;
  if (name === 'NotFoundError') return `找不到麥克風${code}，請確認手機的麥克風可以使用。`;
  if (name === 'NotReadableError' || name === 'AbortError') return `麥克風正被別的 App 使用，或被系統關掉了${code}：關掉通話或錄音的 App，並檢查快速設定的「麥克風存取」，再按下方按鈕。`;
  return `麥克風暫時打不開${code}，請再按一次下方按鈕。`;
}

function setPuffImage(puffer, src) {
  if (!puffer.src.endsWith(src.slice(1))) puffer.src = src;
}

function updateProgress() {
  const ratio = progress(state.breath);
  const value = Math.round(ratio * 100);
  const ring = $('ring');
  ring.style.setProperty('--p', String(value));
  ring.setAttribute('aria-valuenow', String(value));
  $('progress-text').textContent = `${value}%`;
  const puffer = $('breath-puffer');
  // 0.9.4 Miles：選 1（小河豚）一進吹氣畫面卻變成最大最氣的那隻 → 起點照「有多氣」，再隨進度縮小
  const startScale = 0.7 + 0.3 * (state.before - 1) / 4;  // 1→0.7、5→1
  puffer.style.setProperty('--scale', String(startScale * (1 - ratio * .4)));
  const hiccuping = state.breath.event === 'hiccup' || state.breath.cooldownMs > 0;  // 打嗝圖停留整段冷卻（約 0.8 秒），不要只閃一格
  puffer.classList.toggle('hiccup', hiccuping);
  const finished = puffer.classList.contains('finished');
  setPuffImage(puffer, finished ? ASSETS.puff.relaxed : hiccuping ? ASSETS.puff.hiccup : ratio > 0.03 ? ASSETS.puff.deflating : levelPuff(state.before));
  if (state.breath.event === 'hiccup') {
    $('breath-message').textContent = '嗝！慢一點～';
    sound('hiccup');
  } else if (state.breath.event === 'idle' && state.breath.cooldownMs === 0 && $('breath-message').textContent.startsWith('嗝')) {
    $('breath-message').textContent = '';  // 0.8：打嗝完平靜下來就收掉提示
  } else if (state.breath.event === 'full') {
    $('breath-message').textContent = '這口夠了，換口氣～';
  } else if (state.breath.event === 'reinflate') {
    $('breath-message').textContent = '停下來了，河豚又慢慢鼓起來～';
  } else if (state.breath.event === 'gentle') {
    $('breath-message').textContent = '';
    if (Date.now() - state.lastPuff > 650) {
      sound('puff');
      haptic('medium');
      state.lastPuff = Date.now();
      addBubble();
    }
  }
  if (state.breath.done) finishBreathing();
}

function addBubble() {
  const bubble = document.createElement('span');
  bubble.className = 'bubble';
  bubble.style.left = `${48 + Math.random() * 25}%`;
  $('bubbles').append(bubble);
  setTimeout(() => bubble.remove(), 950);
}

function startMic() {
  stopBreathing();
  state.mode = 'mic';
  $('breath-instruction').textContent = '慢慢吹，讓河豚消氣——';
  $('ring-hint').textContent = '消氣中';
  $('mode-button').hidden = true;
  $('mode-note').textContent = '先別吹，聽 1 秒周圍聲音…';
  const calibration = read('calibration2', null);
  state.micStop = startBreathInput(({ volume, lowRatio, dtMs, floor, gentleMin, hardMax }) => {
      state.floor = floor;
      showDebug(volume, lowRatio, calibration);
      showGlow(volume, lowRatio, calibration);
      state.breath = stepBreath(state.breath, {
        volume, floor, dtMs, lowRatio, gentleMin, hardMax,
      });
      const event = state.breath.event;
      updateProgress();
      return event;
  }, { calibration,
    onReady: () => { $('mode-note').textContent = '對著螢幕上的河豚，慢慢吹'; },
    onError: error => {
      $('mode-note').textContent = micErrorText(error);
      $('mode-button').hidden = false;
    },
  });
}

function beginBreathing() {
  if (!state.category) return;
  funnelStep('開始吹氣');
  state.finishing = false;
  state.startedAt = Date.now();  // 證明書上的「吹氣 N 秒」＝從這裡到消完實際經過（含打嗝重來）
  state.breath = createBreathState(state.before);
  state.lastPuff = 0;
  $('breath-puffer').classList.remove('finished');
  $('breath-message').textContent = '';
  setStep('breathe');
  updateProgress();
  startMic();
}

async function finishBreathing() {
  if (state.finishing) return;
  state.finishing = true;
  stopBreathing();
  $('breath-message').textContent = '噗——';
  $('breath-puffer').classList.add('finished');
  $('breath-puffer').style.setProperty('--scale', '0.6');
  setPuffImage($('breath-puffer'), ASSETS.puff.relaxed);
  sound('finish');
  await new Promise(resolve => setTimeout(resolve, 650));
  if (state.step !== 'breathe') return;
  const now = new Date();
  const today = dateKey(now);
  const usedIds = certificates().filter(item => item.date === today).map(item => item.templateId);
  const template = selectTemplate(state.templates, { category: categoryInfo(state.category).label, level: state.before, date: now, usedIds });
  if (!template) {
    $('mode-note').textContent = '證明書範本讀取失敗，請再試一次。';
    state.finishing = false;
    return;
  }
  const sec = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
  const pct = inflatePercent(state.before);
  const n = countForDay(state.category, now) + 1;
  const serial = makeSerial(now, sessions().filter(item => new Date(item.ts).toDateString() === now.toDateString()).length + 1);
  const saved = saveCompletion({ ts: now.toISOString(), category: state.category, before: state.before, templateId: template.id, date: today, serial, pct, sec });
  state.currentSession = saved.sessionIndex;
  state.png = await drawCertificate({ template, categoryLabel: categoryInfo(state.category).label, date: now, serial, n, pct, sec });
  showResult(saved.first);
}

function showResult(first) {
  funnelStep('消完氣');
  funnelStep('第一個成果');  // 拿到消氣證明書
  $('result-image').src = state.png;
  const art = first ? formImage(state.category) : ASSETS.puff.relaxed;  // 新拿到形態豚就讓牠站在證明書下面
  $('result-puffer').src = art;
  renderAfter(null);
  setStep('result');
  if (first) {
    $('reveal-name').textContent = `${categoryInfo(state.category).name}登場！`;
    $('reveal-puffer').src = formImage(state.category);
    $('reveal').hidden = false;
    sound('reveal');
  }
}

function renderAfter(selected) {
  $('after-buttons').replaceChildren(...[1, 2, 3, 4, 5].map(value => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(value);
    button.className = value === selected ? 'selected' : '';
    button.setAttribute('aria-pressed', String(value === selected));
    button.addEventListener('click', () => { setAfter(state.currentSession, value); renderAfter(value); });
    return button;
  }));
}

function renderCollection(preview = null) {
  const found = preview ?? collection();
  $('collection-grid').replaceChildren(...CATEGORIES.map(item => {
    const card = document.createElement('div');
    card.className = 'collection-card' + (found[item.id] ? '' : ' locked');
    const icon = document.createElement('img');
    icon.className = 'mini-puffer';
    icon.src = formImage(item.id);  // 沒拿到的用同一張圖的剪影（CSS filter）
    icon.alt = '';
    const words = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = found[item.id] ? item.name : '？？？';
    const detail = document.createElement('small');
    detail.textContent = found[item.id] ? `${found[item.id].slice(4, 6)}/${found[item.id].slice(6)} 初見 · ${countFor(item.id)} 次` : '還沒遇見';
    words.append(title, detail);
    card.append(icon, words);
    return card;
  }));
}

function parseDate(key) { return new Date(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8))); }

function certificateSession(item) {
  const daily = sessions().filter(session => dateKey(new Date(session.ts)) === item.date);
  const index = Number(item.serial.slice(4)) - 1;
  const session = daily[index];
  return {
    category: session?.category ?? 'other',
    before: session?.before ?? 3,
    n: session ? daily.slice(0, index + 1).filter(row => row.category === session.category).length : 1,
  };
}

function renderCertificates() {
  const list = certificates();
  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = '還沒有證明書，先消一口氣吧。';
    $('certificate-list').replaceChildren(empty);
    return;
  }
  $('certificate-list').replaceChildren(...list.map(item => {
    const { category, n, before } = certificateSession(item);
    const row = document.createElement('button');
    row.className = 'certificate-row';
    row.type = 'button';
    const info = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = `${categoryInfo(category).label}的消氣證明書`;
    const detail = document.createElement('small');
    detail.textContent = `${displayDate(parseDate(item.date))} · 第 ${item.serial} 號`;
    info.append(title, detail);
    const arrow = document.createElement('span');
    arrow.textContent = '›';
    row.append(info, arrow);
    row.addEventListener('click', async () => {
      const template = state.templates.find(t => t.id === item.templateId);
      if (!template) return;
      // 0.1 版存的證明書沒有鼓脹%與秒數，用當時的「多氣」補一個合理值
      const pct = item.pct ?? inflatePercent(before, () => .5);
      const sec = item.sec ?? BASE_SECONDS[before - 1];
      $('viewer-image').src = await drawCertificate({ template, categoryLabel: categoryInfo(category).label, date: parseDate(item.date), serial: item.serial, n, pct, sec });
      $('viewer').hidden = false;
    });
    return row;
  }));
}

function downloadPng(png = state.png) {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  const name = `qipupu-${dateKey(now)}-${pad(now.getHours())}${pad(now.getMinutes())}.png`;
  const link = document.createElement('a');
  link.download = name;
  link.href = png;
  link.click();
}

async function saveOrShare(type, png = state.png) {
  if (!png) return;
  if (window.qipupuNative?.postMessage) {
    window.qipupuNative.postMessage(JSON.stringify({ type, png }));
    return;
  }
  if (type === 'save') return downloadPng(png);
  try {
    const blob = await (await fetch(png)).blob();
    const file = new File([blob], 'qipupu.png', { type: 'image/png' });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch (error) {
    if (error?.name === 'AbortError') return;
  }
  downloadPng(png);
}

async function calibrate() {
  $('calibrate-status').textContent = '先安靜 1 秒，再慢慢吹 2 秒…';
  stopMicrophone();
  const quiet = [], blowing = [];
  let ticks = 0;
  const sample = value => {
    (ticks < 20 ? quiet : blowing).push(value);
    ticks++;
    if (ticks === 20) $('calibrate-status').textContent = '現在慢慢吹 2 秒～';
    if (ticks < 60) return;
    const floor = averageFloor(quiet);
    const gentle = Math.max(.012, averageFloor(blowing) - floor);
    write('calibration2', { floor, gentleMin: Math.max(.008, gentle * .45), hardMax: Math.max(gentle * 2.2, .08) });
    stopMicrophone();
    $('calibrate-status').textContent = '試吹完成，下次吹氣會使用這次的設定。';
  };
  if (window.qipupuNative?.ios) {
    state.micStop = startNativeMic(sample, error => {
      stopMicrophone();
      $('calibrate-status').textContent = micErrorText(error);
    });
    return;
  }
  try {
    const token = ++state.token;
    const stream = await navigator.mediaDevices.getUserMedia(micConstraints());
    if (token !== state.token || document.hidden || state.tab !== 'settings') {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    state.stream = stream;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    state.audioContext = audioContext;
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    const buffer = new Uint8Array(analyser.fftSize);
    state.timer = setInterval(() => {
      if (token !== state.token) return;
      sample(readVolume(analyser, buffer));
    }, SAMPLE_MS);
  } catch (error) {
    stopMicrophone();
    $('calibrate-status').textContent = micErrorText(error);
  }
}

function stopGameMic() {
  state.gameMicStop?.();
  state.gameMicStop = null;
  glowLevel = 0;
  $('game-ring').style.setProperty('--glow', '0');
  $('game-ring').classList.remove('glow-ok');
}

function setGameScreen(name) {
  state.gameScreen = name;
  if (name !== 'play') stopGameMic();
  for (const screen of ['home', 'levels', 'play', 'result']) {
    $('game-' + screen).classList.toggle('active', name === screen);
  }
  syncBackStack();
}

// 0.18：手機返回鍵／右滑回上一層，不要直接跳出 App（陌生人最常因此給一星；Miles 10/21 在溫故也要求同樣行為）
// 做法：不在首頁時，網頁歷史裡留一格；按返回＝吃掉那一格，我們自己退一層，還沒回到首頁就再留一格。
function atRoot() { return state.tab === 'calm' && state.step === 'pick'; }
function syncBackStack() {
  if (!atRoot() && !history.state?.qipupuInner) history.pushState({ qipupuInner: true }, '');
}
function goBackOneLevel() {
  if (state.tab === 'games') {
    const screen = state.gameScreen ?? 'home';
    if (screen === 'play' || screen === 'result') showGameLevels();
    else if (screen === 'levels') showGameHome();
    else setTab('calm');
  } else if (state.tab !== 'calm') setTab('calm');
  else if (state.step !== 'pick') setStep('pick');
}

function gameImage(src, fallback, className) {
  const host = document.createElement('span');
  host.className = className;
  const img = document.createElement('img');
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.draggable = false;
  const backup = document.createElement('span');
  backup.className = 'game-art-fallback';
  backup.textContent = fallback;
  backup.hidden = true;
  img.addEventListener('error', () => { img.hidden = true; backup.hidden = false; });
  img.addEventListener('load', () => { img.hidden = false; backup.hidden = true; });
  host.append(img, backup);
  const art = { host, img, backup };
  setGameImage(art, src);
  return art;
}

function setGameImage(art, src) {
  if (art.img.getAttribute('src') === src) return;
  art.img.hidden = false;
  art.backup.hidden = true;
  art.img.src = src;
}

function gameStars(container, earned) {
  container.replaceChildren(...Array.from({ length: 3 }, (_, index) => {
    const on = index < earned;
    return gameImage(on ? GAME_ASSETS.starOn : GAME_ASSETS.starOff,
      on ? '★' : '☆', 'game-star').host;
  }));
  container.setAttribute('aria-label', `${earned} 顆星，共 3 顆`);
}

function showGameHome() {
  setGameScreen('home');
  $('game-cards').replaceChildren(...Object.entries(GAMES).map(([id, game]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'game-card';
    const icon = gameImage(GAME_ASSETS[id].puff, GAME_ASSETS[id].icon, 'game-card-icon').host;
    const copy = document.createElement('span');
    const title = document.createElement('strong'); title.textContent = game.name;
    const about = document.createElement('small'); about.textContent = game.about;
    copy.append(title, about);
    const stars = document.createElement('b'); stars.textContent = `★ ${totalStars(id)}/30`;
    button.append(icon, copy, stars);
    button.addEventListener('click', () => showGameLevels(id));
    return button;
  }));
  $('game-home-record').textContent = `最長連續一口氣 ${(record('longestBreathMs') / 1000).toFixed(1)} 秒`;
}

function showGameLevels(id = state.gameId) {
  state.gameId = id;
  setGameScreen('levels');
  $('game-levels-title').textContent = GAMES[id].name;
  const recordKey = { candles: 'candlesMax', notes: 'notesMax', soup: 'longestBreathMs',
    socks: 'socksFound', truck: 'truckStreak', meeting: 'meetingPerfect' }[id];
  const value = record(recordKey);
  $('game-levels-record').textContent = id === 'soup' ? `最長連續一口氣 ${(value / 1000).toFixed(1)} 秒`
    : id === 'socks' ? `累計找回 ${value} 隻襪子`
    : id === 'truck' ? `最高連續命中 ${value} 拍`
    : id === 'meeting' ? `完美定格 ${value} 次`
    : `一口氣最多 ${value} ${id === 'candles' ? '根' : '張'}`;
  $('game-level-grid').replaceChildren(...Array.from({ length: 10 }, (_, index) => {
    const levelNo = index + 1;
    const button = document.createElement('button');
    button.type = 'button';
    const open = unlocked(id, levelNo);
    button.className = 'game-level' + (open ? '' : ' locked');
    button.disabled = !open;
    const number = document.createElement('strong'); number.textContent = open ? String(levelNo) : '🔒';
    const stars = document.createElement('small');
    const earned = bestStars(id, levelNo);
    if (open && earned) { stars.className = 'game-level-stars'; gameStars(stars, earned); }
    else stars.textContent = open ? '第 ' + levelNo + ' 關' : '尚未解鎖';
    button.append(number, stars);
    button.addEventListener('click', () => startGame(id, levelNo));
    return button;
  }));
}

function gameProgress() {
  const game = state.game;
  if (state.gameId === 'candles') return game.lit.filter(lit => !lit).length / game.config.count;
  if (state.gameId === 'notes') return game.gone / game.config.count;
  if (state.gameId === 'socks') return game.pairs / game.config.pairs;
  if (state.gameId === 'truck') return game.hits / game.config.pattern.filter(beat => beat.hit).length;
  if (state.gameId === 'meeting') return game.stageIndex / game.config.stages.length;
  return (game.config.start - game.temperature) / (game.config.start - game.config.target);
}

function buildCandlesStage(stage, game) {
  stage.className = 'game-stage candles-stage';
  const puff = gameImage(GAME_ASSETS.candles.puff, '🐡', 'game-puff candles-puff');
  const cake = gameImage(GAME_ASSETS.candles.cake, '🎂', 'game-cake');
  const row = document.createElement('div');
  row.className = 'game-candle-row';
  row.style.setProperty('--cols', String(Math.min(15, game.config.count)));
  row.classList.toggle('two-rows', game.config.count > 15);
  const candles = game.lit.map((_, index) => {
    const candle = gameImage(GAME_ASSETS.candles.lit, '🕯️', 'game-candle');
    candle.host.title = `${index + 1} 號蠟燭`;
    row.append(candle.host);
    return candle;
  });
  stage.replaceChildren(puff.host, cake.host, row);
  return { id: 'candles', puff, candles };
}

function buildSoupStage(stage, game) {
  stage.className = 'game-stage soup-stage';
  const scene = GAME_ASSETS.soup.scene[game.config.food];
  const puff = gameImage(GAME_ASSETS.soup.puff, '🐡', 'game-puff soup-puff');
  const bowl = gameImage(scene.hot, scene.emoji, 'game-bowl');
  const thermometer = gameImage(GAME_ASSETS.soup.thermometer, '🌡️', 'game-thermometer');
  const pointer = document.createElement('span');
  pointer.className = 'game-thermometer-pointer';
  thermometer.host.append(pointer);
  const temp = document.createElement('strong'); temp.className = 'game-temperature';
  const food = document.createElement('small'); food.className = 'game-food-label';
  food.textContent = `${game.config.food}・目標 ${game.config.target}°C`;
  stage.replaceChildren(puff.host, bowl.host, thermometer.host, temp, food);
  bowl.host.addEventListener('animationend', () => stage.classList.remove('splashed'));
  return { id: 'soup', puff, bowl, pointer, temp, scene };
}

function buildNotesStage(stage, game) {
  stage.className = 'game-stage notes-stage';
  const desk = gameImage(GAME_ASSETS.notes.desk, '🗒️', 'game-desk');
  const puff = gameImage(GAME_ASSETS.notes.puff, '🐡', 'game-puff notes-puff');
  const remain = document.createElement('strong'); remain.className = 'notes-count';
  const notes = game.phrases.map((phrase, index) => {
    const urgent = Boolean(game.config.urgentEvery && (index + 1) % game.config.urgentEvery === 0);
    const note = gameImage(urgent ? GAME_ASSETS.notes.red : GAME_ASSETS.notes.yellow, '📝', 'game-note');
    note.host.classList.add(`note-place-${index % 4}`);
    if (urgent) note.host.classList.add('urgent');
    const words = document.createElement('span');
    words.className = 'game-note-words';
    words.textContent = phrase;
    note.host.append(words);
    note.host.hidden = index >= 4;
    note.host.addEventListener('animationend', () => {
      note.host.classList.remove('flying');
      note.host.hidden = true;
    });
    return note.host;
  });
  stage.replaceChildren(desk.host, ...notes, puff.host, remain);
  return { id: 'notes', puff, remain, notes, visibleGone: 0 };
}

function gameLabel(className, value = '') {
  const node = document.createElement('div');
  node.className = className;
  node.textContent = value;
  return node;
}

function sockLabel(sock) {
  return `${sock.color}・${sock.pattern}・${sock.size}・${sock.cuff}`;
}

function buildSocksStage(stage) {
  stage.className = 'game-stage socks-stage';
  const background = gameImage(GAME_ASSETS.socks.background, '🧺', 'socks-background');
  const board = gameImage(GAME_ASSETS.socks.board, '失物招領', 'socks-board');
  const target = gameImage(GAME_ASSETS.socks.sock.red, '🧦', 'socks-target');
  const targetText = gameLabel('socks-target-text');
  board.host.append(target.host, targetText);
  const basket = gameImage(GAME_ASSETS.socks.basket, '🧺', 'socks-basket');
  const light = gameImage(GAME_ASSETS.socks.spotlight, '✦', 'socks-light');
  const current = gameImage(GAME_ASSETS.socks.sock.red, '🧦', 'socks-current');
  const detail = gameLabel('socks-detail');
  const puff = gameImage(GAME_ASSETS.socks.puff, '🐡', 'socks-puff');
  const tally = gameLabel('socks-tally');
  stage.replaceChildren(background.host, board.host, basket.host, light.host, current.host,
    detail, puff.host, tally);
  return { id: 'socks', target, targetText, light, current, detail, puff, tally };
}

function buildTruckStage(stage, game) {
  stage.className = 'game-stage truck-stage';
  const background = gameImage(GAME_ASSETS.truck.background, '🏘️', 'truck-background');
  const truck = gameImage(GAME_ASSETS.truck.truck, '🚛', 'truck-vehicle');
  const family = ['dad','mom','kid','grandma'].map((id, index) => {
    const member = gameImage(GAME_ASSETS.truck.family[id].normal, ['🐡','🐡','🐡','🐡'][index], 'truck-family');
    member.host.title = id;
    return { ...member, id };
  });
  const countdown = gameLabel('truck-countdown');
  const lights = game.config.pattern.map((beat, index) => {
    const item = gameImage(GAME_ASSETS.truck.beatOff, '○', 'truck-light');
    item.host.title = `第 ${index + 1} 拍${beat.hit ? '吹' : '空拍'}`;
    return item;
  });
  const row = gameLabel('truck-lights');
  row.replaceChildren(...lights.map(item => item.host));
  const extras = [gameImage(GAME_ASSETS.truck.umbrella, '☂️', 'truck-extra'),
    gameImage(GAME_ASSETS.truck.cart, '🛒', 'truck-extra')];
  stage.replaceChildren(background.host, truck.host, ...family.map(item => item.host),
    row, countdown, ...extras.map(item => item.host));
  return { id: 'truck', family, lights, countdown, extras };
}

function buildMeetingStage(stage, game) {
  stage.className = 'game-stage meeting-stage';
  const frame = gameImage(GAME_ASSETS.meeting.frame, '💻', 'meeting-frame');
  const prompt = gameLabel('meeting-prompt');
  const background = gameImage(GAME_ASSETS.meeting.background['乾淨書櫃'], '📚', 'meeting-background');
  const face = gameImage(GAME_ASSETS.meeting.face['專心'], '🐡', 'meeting-face');
  const choice = gameLabel('meeting-choice');
  const filter = gameImage(GAME_ASSETS.meeting.filter['河豚董事長'], '👑', 'meeting-filter');
  const boss = gameImage(GAME_ASSETS.meeting.boss, '主管：你覺得呢？', 'meeting-boss');
  const coworkers = Array.from({ length: game.config.coworkers }, (_, index) => gameLabel('meeting-coworker', `同事 ${index + 1} 🐡`));
  stage.replaceChildren(frame.host, prompt, background.host, face.host, choice,
    filter.host, boss.host, ...coworkers);
  return { id: 'meeting', prompt, background, face, choice, filter, boss };
}

function renderGamePlay(tick) {
  const game = state.game;
  const id = state.gameId;
  const stage = $('game-stage');
  const percent = Math.max(0, Math.min(100, Math.round(gameProgress() * 100)));
  $('game-clock').textContent = `${Math.max(0, Math.ceil((game.config.limitMs - game.elapsedMs) / 1000))} 秒`;
  $('game-ring').style.setProperty('--p', String(percent));
  $('game-ring').setAttribute('aria-valuenow', String(percent));
  $('game-progress').textContent = `${percent}%`;
  if (id === 'candles') {
    if (!state.gameArt) state.gameArt = buildCandlesStage(stage, game);
    const art = state.gameArt;
    setGameImage(art.puff, tick?.blowing ? GAME_ASSETS.candles.puffBlow : GAME_ASSETS.candles.puff);
    game.lit.forEach((lit, index) => {
      setGameImage(art.candles[index], lit ? GAME_ASSETS.candles.lit : GAME_ASSETS.candles.out);
      art.candles[index].backup.textContent = lit ? '🕯️' : '•';
      art.candles[index].host.classList.toggle('out', !lit);
    });
    $('game-message').textContent = game.event === 'hard' ? '太猛了，慢慢吹～' : game.event === 'relight' ? '魔術蠟燭又亮了！' : `已熄 ${game.config.count - game.lit.filter(Boolean).length} / ${game.config.count} 根`;
  } else if (id === 'soup') {
    if (!state.gameArt) state.gameArt = buildSoupStage(stage, game);
    const art = state.gameArt;
    setGameImage(art.puff, tick?.blowing ? GAME_ASSETS.soup.puffBlow : GAME_ASSETS.soup.puff);
    setGameImage(art.bowl, game.temperature > game.config.target + 5 ? art.scene.hot : art.scene.ok);
    const heat = Math.max(0, Math.min(1, (game.temperature - game.config.target) / (game.config.start - game.config.target)));
    art.pointer.style.top = `${77 - heat * 54}%`;
    art.temp.textContent = `${game.temperature.toFixed(1)}°C`;
    if (game.event === 'splash') stage.classList.add('splashed');
    $('game-message').textContent = game.event === 'splash' ? '濺出來了！慢一點～' : game.splashed ? '慢慢吹，別再濺出來～' : '慢慢吹涼';
  } else if (id === 'socks') {
    if (!state.gameArt) state.gameArt = buildSocksStage(stage);
    const art = state.gameArt;
    const target = SOCK_CATALOG[game.config.targets[game.pairs] ?? game.config.targets.at(-1)];
    const spot = spotlightAt(game.config, game.elapsedMs);
    setGameImage(art.target, GAME_ASSETS.socks.sock[target.id]);
    setGameImage(art.current, GAME_ASSETS.socks.sock[spot.sock.id]);
    setGameImage(art.puff, tick?.blowing ? GAME_ASSETS.socks.puffBlow : game.wrong ? GAME_ASSETS.socks.sockHat : GAME_ASSETS.socks.puff);  // 錯選過＝頭上戴著襪子
    art.targetText.textContent = sockLabel(target);
    art.current.backup.textContent = '🧦';
    art.current.host.style.background = art.current.img.hidden ? ({ 紅: '#e88b83', 藍: '#86b8e1', 黃: '#f2d27a',
      天藍: '#a0d8ed', 淺藍: '#c6e4ee', 白: '#f5f5f1', 綠: '#9fd39a', 灰: '#b9bcc0', 粉: '#f3b8c8', 米: '#efe2c4' })[spot.sock.color] : '';
    // 小孩尺寸用同一張圖縮小（10/19：素材沒有另畫小孩款）
    art.current.img.style.transform = spot.sock.size === '小孩' ? 'scale(.68)' : '';
    art.target.img.style.transform = target.size === '小孩' ? 'scale(.68)' : '';
    art.current.host.classList.toggle('lit', spot.lit);
    art.light.host.classList.toggle('lit', spot.lit);
    art.detail.textContent = spot.lit ? sockLabel(spot.sock) : '等襪子進聚光燈';
    art.tally.textContent = `配對 ${game.pairs}/${game.config.pairs}　錯選 ${game.wrong}/${game.config.maxWrong}`;
    $('game-message').textContent = game.event === 'wrong' ? '哎呀，戴到河豚頭上了！'
      : game.event === 'hard' ? '太猛了，短吹一下' : game.event === 'match' ? '配對成功！'
      : '找到同款，短吹選中';
  } else if (id === 'truck') {
    if (!state.gameArt) state.gameArt = buildTruckStage(stage, game);
    const art = state.gameArt;
    const now = game.elapsedMs;
    const current = game.times.findIndex(time => Math.abs(now - time) <= game.config.windowMs);
    const count = now < game.config.beatMs * 3 ? 3 - Math.floor(now / game.config.beatMs) : 0;
    art.countdown.textContent = count ? `預備 ${count}` : current < 0 ? '等下一拍' : game.config.pattern[current].hit ? '吹！' : '噓，空拍';
    game.config.pattern.forEach((beat, index) => {
      const light = art.lights[index];
      const active = index === current;
      const name = active ? beat.hit ? 'beatOn' : 'beatRest' : 'beatOff';
      setGameImage(light, GAME_ASSETS.truck[name]);
      light.backup.textContent = game.hit[index] ? '✓' : active ? beat.hit ? '🟠' : '噓' : beat.hit ? '○' : '·';
      light.host.classList.toggle('active', active);
      light.host.classList.toggle('rest', active && !beat.hit);
      light.host.classList.toggle('hit', game.hit[index]);
    });
    art.family.forEach((member, index) => setGameImage(member,
      GAME_ASSETS.truck.family[member.id][current >= 0 && game.config.pattern[current].hit ? 'bag' : 'normal']));
    art.extras[0].host.hidden = game.levelNo < 5;
    art.extras[1].host.hidden = game.levelNo < 6;
    $('game-message').textContent = game.event === 'hard' ? '太猛了，短吹才算'
      : game.event === 'extra' ? '搶拍了！' : game.event === 'miss' ? '漏了一拍'
      : `命中 ${game.hits}　漏拍 ${game.misses}　搶拍 ${game.extra}`;
  } else if (id === 'meeting') {
    if (!state.gameArt) state.gameArt = buildMeetingStage(stage, game);
    const art = state.gameArt;
    const wheel = game.done ? null : wheelAt(game);
    const face = game.expression ?? (wheel?.kind === 'expression' ? wheel.value : game.config.expression ?? '專心');
    const background = game.background ?? (wheel?.kind === 'background' ? wheel.value : '乾淨書櫃');
    setGameImage(art.face, GAME_ASSETS.meeting.face[face]);
    setGameImage(art.background, GAME_ASSETS.meeting.background[background]);
    art.face.backup.textContent = `🐡 ${face}`;
    art.background.backup.textContent = `💻 ${background}`;
    art.prompt.textContent = `題目：${game.config.theme}｜${wheel?.kind === 'background' ? '選背景' : '選表情'}`;
    art.choice.textContent = wheel ? `${wheel.kind === 'expression' ? '表情' : '背景'}：${wheel.value}${wheel.fake ? ' ⏸' : ''}` : '定格完成';
    art.choice.classList.toggle('best', Boolean(wheel?.best));
    art.filter.host.hidden = !game.filter;
    if (game.filter) { setGameImage(art.filter, GAME_ASSETS.meeting.filter[game.filter]); art.filter.backup.textContent = game.filter; }
    art.boss.host.hidden = game.levelNo !== 8 || game.elapsedMs < 5000;
    $('game-message').textContent = game.event === 'hard' ? '太猛了，短吹一下'
      : game.event === 'wrong' ? `選錯！${game.filter}` : game.event === 'perfect' ? '完美定格！'
      : `已用 ${game.puffs}/${game.config.maxPuffs} 口，${game.config.stages.length - game.stageIndex} 階段待選`;
  } else {
    if (!state.gameArt) state.gameArt = buildNotesStage(stage, game);
    const art = state.gameArt;
    setGameImage(art.puff, tick?.blowing ? GAME_ASSETS.notes.puffBlow : GAME_ASSETS.notes.puff);
    art.remain.textContent = `${game.config.count - game.gone} 張待辦`;
    if (game.gone > art.visibleGone) {
      for (let i = art.visibleGone; i < game.gone; i++) {
        art.notes[i].classList.add('flying');
        art.notes[i].hidden = false;
      }
      art.visibleGone = game.gone;
    }
    for (let i = game.gone; i < Math.min(game.config.count, game.gone + 4); i++) art.notes[i].hidden = false;
    $('game-message').textContent = game.event === 'hard' ? '太猛了，慢慢吹～' : game.config.urgentEvery && (game.gone + 1) % game.config.urgentEvery === 0 ? '急件比較黏，要連續吹久一點' : '慢慢吹走待辦';
  }
}

function startGame(id, levelNo) {
  stopGameMic();
  state.gameCardToken++;
  state.gameId = id;
  state.gameLevel = levelNo;
  state.game = id === 'notes' ? GAMES[id].create(levelNo, Math.random()) : GAMES[id].create(levelNo);
  state.gameBreathMs = 0;
  state.gameLongestMs = 0;
  state.gamePng = null;
  state.gameArt = null;
  $('game-play-title').textContent = `${GAMES[id].name}・第 ${levelNo} 關`;
  $('game-instruction').textContent = GAMES[id].instruction;
  $('game-mic-note').textContent = '先別吹，聽 1 秒周圍聲音…';
  $('game-retry-mic').hidden = true;
  $('game-ring-hint').textContent = ['socks', 'truck', 'meeting'].includes(id) ? '短吹一下' : '慢慢吹';
  setGameScreen('play');
  renderGamePlay();
  startGameMic();
}

function startGameMic() {
  stopGameMic();
  const calibration = read('calibration2', null);
  $('game-mic-note').textContent = '先別吹，聽 1 秒周圍聲音…';
  $('game-retry-mic').hidden = true;
  state.gameMicStop = startBreathInput(tick => {
    showGlow(tick.volume, tick.lowRatio, calibration, {
      ring: $('game-ring'), floor: tick.floor, ok: tick.blowing && tick.strength !== 'hard',
      done: false, hint: $('game-ring-hint'), idleText: ['socks', 'truck', 'meeting'].includes(state.gameId) ? '短吹一下' : '慢慢吹',
    });
    state.gameBreathMs = tick.blowing && tick.strength !== 'hard' ? state.gameBreathMs + tick.dtMs : 0;
    state.gameLongestMs = Math.max(state.gameLongestMs, state.gameBreathMs);
    state.game = GAMES[state.gameId].step(state.game, tick);
    renderGamePlay(tick);
    if (state.game.done || state.game.failed) {
      if (state.gameId === 'notes' && state.game.done) {
        const completed = state.game;
        stopGameMic();
        window.setTimeout(() => {
          if (state.game === completed && $('game-play').classList.contains('active')) finishGame();
        }, 460);
      } else finishGame();
    }
    return state.game.event;
  }, { calibration,
    onReady: () => { $('game-mic-note').textContent = ['socks', 'truck', 'meeting'].includes(state.gameId) ? '看準時機，對著螢幕短吹' : '對著螢幕慢慢吹'; },
    onError: error => {
      $('game-mic-note').textContent = micErrorText(error);
      $('game-retry-mic').hidden = false;
    },
  });
}

async function finishGame() {
  stopGameMic();
  const game = state.game;
  const id = state.gameId;
  const levelNo = state.gameLevel;
  if (game.done) {
    haptic('success');
    const records = { longestBreathMs: state.gameLongestMs };
    if (id === 'candles') records.candlesMax = game.maxOneBreath;
    if (id === 'notes') records.notesMax = game.maxOneBreath;
    if (id === 'socks') records.socksFound = game.pairs;
    if (id === 'truck') records.truckStreak = game.maxStreak;
    if (id === 'meeting') records.meetingPerfect = game.perfect;
    saveResult(id, levelNo, game.stars, records);
  }
  setGameScreen('result');
  $('game-result-title').textContent = game.done ? '過關！' : id === 'socks' && game.event === 'tooManyWrong' ? '洗衣機贏了'
    : id === 'truck' ? '垃圾車開走了' : id === 'meeting' && game.event === 'bossSaw' ? '被主管看到了' : '時間到了';
  gameStars($('game-result-stars'), game.done ? game.stars : 0);
  $('game-result-copy').textContent = id === 'candles' ? `一口氣吹熄 ${game.maxOneBreath} 根！`
    : id === 'notes' ? `一口氣吹走 ${game.maxOneBreath} 張！`
    : id === 'socks' ? `找回 ${game.pairs} 雙，錯選 ${game.wrong} 次`
    : id === 'truck' ? `命中 ${game.hits} 拍，搶拍 ${game.extra} 次`
    : id === 'meeting' ? `${game.expression ?? '🐡'}＋${game.background ?? '💻'}，完美定格 ${game.perfect} 次`
    : `最長一口氣 ${(state.gameLongestMs / 1000).toFixed(1)} 秒，${game.config.food} ${game.temperature.toFixed(1)}°C`;
  $('game-result-record').textContent = game.done ? `個人紀錄：${id === 'soup' ? `${(record('longestBreathMs') / 1000).toFixed(1)} 秒`
    : id === 'socks' ? `累計找回 ${record('socksFound')} 隻襪子`
    : id === 'truck' ? `最高連續命中 ${record('truckStreak')} 拍`
    : id === 'meeting' ? `完美定格 ${record('meetingPerfect')} 次`
    : `${record(id === 'candles' ? 'candlesMax' : 'notesMax')} ${id === 'candles' ? '根' : '張'}`}`
    : '再試一次，短吹抓準時機。';
  $('game-next').hidden = !game.done || levelNo === 10;
  $('game-share').hidden = !game.done;
  $('game-save').hidden = !game.done;
  $('game-share').disabled = game.done;
  $('game-save').disabled = game.done;
  if (game.done) {
    const token = ++state.gameCardToken;
    const png = await drawGameCard(id, levelNo, { ...game, foundTotal: record('socksFound'),
      longestBreathMs: state.gameLongestMs });
    if (token === state.gameCardToken) {
      state.gamePng = png;
      $('game-share').disabled = false;
      $('game-save').disabled = false;
    }
  }
}

function bindEvents() {
  document.querySelectorAll('.nav-button').forEach(button => button.addEventListener('click', () => setTab(button.dataset.tab)));
  $('before-level').addEventListener('input', event => { state.before = Number(event.target.value); renderLevel(); });
  $('start-button').addEventListener('click', beginBreathing);
  $('back-pick').addEventListener('click', () => setStep('pick'));
  // 0.18：暫停或麥克風出錯後按「繼續」，進度不歸零（同 0.14 切降噪的做法）
  $('mode-button').addEventListener('click', () => startMic());
  // 0.9.1：設定頁「檢查更新」——App 裡交給殼去查更新站；一般瀏覽器重新整理就是最新版
  $('update-button').addEventListener('click', () => {
    if (window.qipupuNative?.postMessage) window.qipupuNative.postMessage(JSON.stringify({ type: 'checkUpdate' }));
    else $('calibrate-status').textContent = '網頁版重新整理就是最新版。';
  });
  $('save-button').addEventListener('click', () => saveOrShare('save'));
  $('share-button').addEventListener('click', () => { funnelStep('按分享'); saveOrShare('share'); });
  $('game-levels-back').addEventListener('click', showGameHome);
  $('game-play-back').addEventListener('click', () => showGameLevels());
  $('game-result-back').addEventListener('click', () => showGameLevels());
  $('game-next').addEventListener('click', () => startGame(state.gameId, state.gameLevel + 1));
  $('game-replay').addEventListener('click', () => startGame(state.gameId, state.gameLevel));
  $('game-retry-mic').addEventListener('click', startGameMic);
  $('game-share').addEventListener('click', () => { funnelStep('按分享'); saveOrShare('share', state.gamePng); });
  $('game-save').addEventListener('click', () => saveOrShare('save', state.gamePng));
  $('collect-button').addEventListener('click', () => setTab('collection'));
  $('again-button').addEventListener('click', () => { state.category = null; $('start-button').disabled = true; renderCategories(); setStep('pick'); });
  const closeReveal = () => { $('reveal').hidden = true; };
  $('reveal').addEventListener('click', closeReveal);
  $('reveal').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') closeReveal(); });
  $('viewer-close').addEventListener('click', () => { $('viewer').hidden = true; });
  $('sound-switch').addEventListener('change', event => { state.sound = event.target.checked; write('sound', state.sound); });
  $('calibrate-button').addEventListener('click', calibrate);
  $('reset-button').addEventListener('click', event => {
    if (event.target.dataset.confirm !== 'yes') {
      event.target.dataset.confirm = 'yes';
      event.target.textContent = '再按一次，確定重設';
      return;
    }
    resetAll();
    state.sound = true;
    $('sound-switch').checked = true;
    event.target.dataset.confirm = '';
    event.target.textContent = '重設所有紀錄';
    $('calibrate-status').textContent = '紀錄已重設。';
    renderCollection();
    renderCertificates();
  });
  window.addEventListener('popstate', () => { goBackOneLevel(); syncBackStack(); });
  window.addEventListener('qipupu-pause', () => { stopBreathing(); stopGameMic(); stopMicrophone(); });  // 殼切背景時送來（資安長 10/17 建議②）
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    stopBreathing();
    stopGameMic();
    if (state.step === 'breathe') { $('mode-note').textContent = '已暫停。按下方按鈕繼續吹。'; $('mode-button').hidden = false; }
    if (state.tab === 'games' && $('game-play').classList.contains('active')) {
      $('game-mic-note').textContent = '已暫停。按下方按鈕繼續。';
      $('game-retry-mic').hidden = false;
    }
    else $('calibrate-status').textContent = '';
  });
}

// 除錯／驗收用：網址帶 ?demo=blow|hiccup|result（可加 &p=40 進度、&first=1 看新河豚登場）或 ?tab=collection 直接跳到畫面。
// 沒帶參數時完全不影響正常流程。
async function applyDemo() {
  const params = new URLSearchParams(location.search);
  const demo = params.get('demo');
  const tab = params.get('tab');
  if (tab) setTab(tab);
  if (params.get('unlock')) renderCollection({ meeting: '20261017', traffic: '20261016', partner: '20261015', other: '20261014' });  // 只畫畫面看，不寫入紀錄
  if (!demo) return;
  state.category = params.get('cat') || 'meeting';
  state.before = Number(params.get('lv') || 4);
  $('before-level').value = String(state.before);
  $('start-button').disabled = false;
  renderCategories();
  renderLevel();
  if (demo === 'blow' || demo === 'hiccup') {
    state.breath = createBreathState(state.before);
    state.breath.seconds = state.breath.targetSeconds * Number(params.get('p') || 40) / 100;
    setStep('breathe');
    {
      state.mode = 'mic';
      $('mode-note').textContent = '吹得剛剛好，河豚就會慢慢變小。';
      if (demo === 'hiccup') state.breath = { ...state.breath, event: 'hiccup', cooldownMs: 800 };
      updateProgress();
    }
  }
  if (demo === 'stress') {  // 驗收用：100 句範本 × 3 種長度的數字，量最後一行有沒有超出（見 certificate.js 的 LAST_BASELINE）
    globalThis.__certLast = [];
    const now = new Date();
    for (const template of state.templates) {
      for (const [pct, sec] of [[87, 42], [100, 125]]) await drawCertificate({ template, categoryLabel: '另一半', date: now, serial: '1017127', n: 3, pct, sec });
    }
    document.title = `max=${Math.max(...globalThis.__certLast)} count=${globalThis.__certLast.length}`;
  }
  if (demo === 'result') {
    const now = new Date();
    const template = selectTemplate(state.templates, { category: categoryInfo(state.category).label, level: state.before, date: now });
    const serial = makeSerial(now, 127);
    state.png = await drawCertificate({ template, categoryLabel: categoryInfo(state.category).label, date: now, serial, n: 1, pct: 87, sec: 42 });
    showResult(params.get('first') === '1');
  }
}

async function init() {
  if (FUNNEL_ON) {
    FervelaFunnel.init({ product: 'qipupu', version: VERSION, platform: funnelPlatform(),
      endpoint: 'https://t.fervela.ai/e', allow: FUNNEL_STEPS });
    if (new URLSearchParams(location.search).get('r') === 'share') FervelaFunnel.step('從分享進來');
  }
  state.templates = await loadTemplates();
  renderCategories();
  renderLevel();
  $('sound-switch').checked = state.sound;
  $('version').textContent = `版本 ${VERSION}`;
  let taps = 0, tapTimer = null;
  $('version').addEventListener('click', () => {
    taps++; clearTimeout(tapTimer); tapTimer = setTimeout(() => { taps = 0; }, 1500);
    if (taps < 5) return;
    taps = 0;
    const on = !read('debug', false);
    write('debug', on);
    $('calibrate-status').textContent = on ? '已開啟吹氣測試數值（再連點 5 下關掉）。' : '已關閉吹氣測試數值。';
  });
  // 測試數值那行點一下＝切換降噪，當場重開麥克風（10/19 Miles 真機：0.13 切完麥克風被關掉、沒重開，怎麼吹都不動）
  $('breath-debug').addEventListener('click', () => {
    write('nsOn', !read('nsOn', false));
    if (state.mode === 'mic' && state.micStop) startMic();  // 進度不歸零，只換麥克風設定
  });
  bindEvents();
  for (const src of [...Object.values(ASSETS.puff), ...Object.values(ASSETS.forms)]) new Image().src = src;  // 預先載入，切狀態不閃
  await applyDemo();
}

init();
