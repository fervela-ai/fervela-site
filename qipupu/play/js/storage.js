import { MAX_CERTIFICATES } from './config.js';

const PREFIX = 'qipupu.';

export function read(key, fallback) {
  try {
    const value = localStorage.getItem(PREFIX + key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function sessions() {
  const value = read('sessions', []);
  return Array.isArray(value) ? value : [];
}
export function collection() {
  const value = read('collection', {});
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).slice(-MAX_CERTIFICATES)) : {};
}
export function certificates() {
  const value = read('certificates', []);
  return Array.isArray(value) ? value.slice(0, MAX_CERTIFICATES) : [];
}

export function countFor(category) {
  return sessions().filter(item => item && item.category === category).length;
}

export function countForDay(category, date) {
  const day = date.toDateString();
  return sessions().filter(item => item && item.category === category && new Date(item.ts).toDateString() === day).length;
}

export function saveCompletion({ ts, category, before, templateId, date, serial, pct, sec }) {
  const history = sessions();
  const sessionIndex = history.length;
  history.push({ ts, category, before, after: null, pct, sec });
  const found = collection();
  const first = !found[category];
  if (first) found[category] = date;
  const recent = certificates();
  recent.unshift({ templateId, date, serial, pct, sec });
  const data = {
    sessions: history,
    collection: Object.fromEntries(Object.entries(found).slice(-MAX_CERTIFICATES)),
    certificates: recent.slice(0, MAX_CERTIFICATES),
  };
  const failed = [];
  for (const [key, value] of Object.entries(data)) {
    try { write(key, value); } catch { failed.push(key); }
  }
  return { first, sessionIndex, saved: failed.length === 0, failed };
}

export function setAfter(sessionIndex, after) {
  const history = sessions();
  if (!history[sessionIndex]) return;
  history[sessionIndex].after = after;
  try { write('sessions', history); return true; } catch { return false; }
}

export function resetAll() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}
