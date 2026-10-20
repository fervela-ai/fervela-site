export function createPuffTracker() {
  return { elapsedMs: 0, gapMs: 300, inBreath: false, pendingAtMs: null,
    onsetAtMs: null, hardCount: 0, hardInBreath: false };
}

// onsetAtMs is the beginning of the breath, even though onset is delivered 150 ms later.
export function stepPuff(tracker, { blowing = false, strength = 'none', dtMs = 50 } = {}) {
  const dt = Math.max(0, dtMs);
  const next = { ...tracker, elapsedMs: tracker.elapsedMs + dt, onsetAtMs: null };
  const hard = strength === 'hard';
  const active = blowing || hard;
  if (active) {
    if (!tracker.inBreath) {
      next.inBreath = true;
      next.hardInBreath = false;
      if (tracker.gapMs >= 300 && !hard) next.pendingAtMs = tracker.elapsedMs;
    }
    next.gapMs = 0;
    if (hard && !next.hardInBreath) {
      next.hardCount++;
      next.hardInBreath = true;
    }
    if (hard) next.pendingAtMs = null;
  } else {
    next.gapMs = tracker.gapMs + dt;
    next.inBreath = false;
    if (next.gapMs >= 300) next.hardInBreath = false;
  }
  let onset = false;
  if (next.pendingAtMs !== null && next.elapsedMs - next.pendingAtMs >= 150) {
    onset = true;
    next.onsetAtMs = next.pendingAtMs;
    next.pendingAtMs = null;
  }
  return { tracker: next, onset, hard };
}
