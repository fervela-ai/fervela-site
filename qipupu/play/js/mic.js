import { SAMPLE_MS, FLOOR_MS, GENTLE_MIN, HARD_MAX, LOW_BAND_HZ, FLOOR_CAP } from './config.js';
import { rms, classifyBlow, nextFloor } from './breath.js';
import { read } from './storage.js';

// 0.15：預設關掉 Android 語音降噪。10/19 Miles 真機對著螢幕吹：降噪開 0.006（吹不動）、關 0.021（吹得動）——降噪把風聲當雜音吃掉。
// 測試數值模式裡點數值那行可以切回「降噪開」對照。
export function micConstraints() {
  return read('nsOn', false) ? { audio: true } : { audio: { noiseSuppression: false } };
}

export function readVolume(analyser, buffer) {
  analyser.getByteTimeDomainData(buffer);
  const samples = Array.from(buffer, value => (value - 128) / 128);
  return rms(samples);
}

function quietFloor(samples, calibrated) {
  const sorted = [...samples].sort((a, b) => a - b);
  const quiet = sorted.length ? sorted[Math.floor(sorted.length * 0.2)] : 0;
  return Math.min(Math.max(quiet, calibrated ?? 0), FLOOR_CAP);
}

function readLowRatio(analyser, sampleRate) {
  const bins = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(bins);
  const hzPerBin = sampleRate / analyser.fftSize;
  const range = analyser.maxDecibels - analyser.minDecibels;
  let low = 0, total = 0;
  for (let i = 1; i < bins.length && i * hzPerBin <= 8000; i++) {
    const power = Math.pow(10, (analyser.minDecibels + (bins[i] / 255) * range) / 10);
    total += power;
    if (i * hzPerBin <= LOW_BAND_HZ) low += power;
  }
  return total > 0 ? low / total : 0;
}

// iOS 的 app://local/ 沒有瀏覽器麥克風權限；由原生殼送數值，停止時也清掉回呼。
export function startNativeMic(onSample, onError = () => {}) {
  let stopped = false;
  window.qipupuNativeMicTick = (volume, lowRatio) => {
    if (!stopped) onSample(volume, lowRatio);
  };
  window.qipupuNativeMicError = name => {
    if (stopped) return;
    stop();
    onError({ name });
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    delete window.qipupuNativeMicTick;
    delete window.qipupuNativeMicError;
    window.qipupuNative.postMessage(JSON.stringify({ type: 'micStop' }));
  };
  try {
    window.qipupuNative.postMessage(JSON.stringify({ type: 'micStart' }));
  } catch {
    stop();
    onError({ name: 'NotReadableError' });
  }
  return stop;
}

// 同步回傳 stop，讓切頁或進背景時連「正在等權限」的開啟也能取消。
export function startBreathInput(onTick, { calibration = null, onReady = () => {}, onError = () => {} } = {}) {
  let stopped = false, stream = null, audioContext = null, timer = null;
  let floor = 0, blowMs = 0, count = 0;
  const floorSamples = [];
  const gentleMin = calibration?.gentleMin ?? GENTLE_MIN;
  const hardMax = calibration?.hardMax ?? HARD_MAX;
  let nativeStop = null;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    nativeStop?.();
    nativeStop = null;
    if (timer) clearInterval(timer);
    timer = null;
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    audioContext?.close().catch(() => {});
    audioContext = null;
  };
  const tick = (volume, lowRatio) => {
    if (stopped) return;
    if (!Number.isFinite(volume) || volume < 0) return;
    if (!Number.isFinite(lowRatio) || lowRatio < 0) lowRatio = 0;
    if (count++ < FLOOR_MS / SAMPLE_MS) { floorSamples.push(volume); return; }
    if (count === FLOOR_MS / SAMPLE_MS + 1) {
      floor = quietFloor(floorSamples, calibration?.floor);
      onReady();
    }
    const signal = classifyBlow({ volume, floor, dtMs: SAMPLE_MS, blowMs, gentleMin, hardMax, lowRatio });
    blowMs = signal.blowMs;
    const event = onTick({ blowing: signal.blowing, strength: signal.strength, volume, threshold: signal.threshold, lowRatio, dtMs: SAMPLE_MS, floor, gentleMin, hardMax });
    if (event === 'idle' || event === 'reinflate') floor = nextFloor(floor, volume, lowRatio);
  };
  if (window.qipupuNative?.ios) {
    nativeStop = startNativeMic(tick, error => { if (!stopped) { stop(); onError(error); } });
    if (stopped) nativeStop();
    return stop;
  }
  (async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no microphone');
      const acquired = await navigator.mediaDevices.getUserMedia(micConstraints());
      if (stopped || document.hidden) {
        acquired.getTracks().forEach(track => track.stop());
        return;
      }
      stream = acquired;
      stream.getTracks().forEach(track => track.addEventListener?.('ended', () => {
        if (!stopped) { stop(); onError({ name: 'NotReadableError' }); }
      }, { once: true }));
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('no audio context');
      audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Uint8Array(analyser.fftSize);
      const sampleRate = audioContext.sampleRate;
      timer = setInterval(() => {
        if (stopped) return;
        const volume = readVolume(analyser, buffer);
        tick(volume, count < FLOOR_MS / SAMPLE_MS ? 0 : readLowRatio(analyser, sampleRate));
      }, SAMPLE_MS);
    } catch (error) {
      if (!stopped) { stop(); onError(error); }
    }
  })();
  return stop;
}
