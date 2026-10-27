let context;

export function suspendSound() {
  if (context?.state === 'running') void context.suspend().catch(() => {});
}

function tone(startHz, endHz, duration, startAt = 0, kind = 'sine') {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  context ??= new AudioContextClass();
  if (context.state === 'suspended') context.resume();
  const start = context.currentTime + startAt;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = kind;
  oscillator.frequency.setValueAtTime(startHz, start);
  oscillator.frequency.exponentialRampToValueAtTime(endHz, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.075, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
}

export function playSound(name, enabled = true) {
  if (!enabled) return;
  if (name === 'puff') tone(330, 160, 0.13);
  if (name === 'hiccup') {
    tone(190, 300, 0.11);
    tone(280, 130, 0.17, 0.1);
  }
  if (name === 'reveal') {
    tone(390, 510, 0.18);
    tone(520, 700, 0.22, 0.16);
    tone(690, 880, 0.27, 0.34);
  }
  if (name === 'finish') tone(240, 95, 0.45);
}
