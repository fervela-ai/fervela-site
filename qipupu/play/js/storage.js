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

export function sessions() { return read('sessions', []); }
export function collection() { return read('collection', {}); }
export function certificates() { return read('certificates', []); }

export function countFor(category) {
  return sessions().filter(item => item.category === category).length;
}

export function countForDay(category, date) {
  const day = date.toDateString();
  return sessions().filter(item => item.category === category && new Date(item.ts).toDateString() === day).length;
}

export function saveCompletion({ ts, category, before, templateId, date, serial, pct, sec }) {
  const history = sessions();
  const sessionIndex = history.length;
  history.push({ ts, category, before, after: null, pct, sec });
  write('sessions', history);

  const found = collection();
  const first = !found[category];
  if (first) found[category] = date;
  write('collection', found);

  const recent = certificates();
  recent.unshift({ templateId, date, serial, pct, sec });
  write('certificates', recent.slice(0, MAX_CERTIFICATES));
  return { first, sessionIndex };
}

export function setAfter(sessionIndex, after) {
  const history = sessions();
  if (!history[sessionIndex]) return;
  history[sessionIndex].after = after;
  write('sessions', history);
}

export function resetAll() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  }
}
