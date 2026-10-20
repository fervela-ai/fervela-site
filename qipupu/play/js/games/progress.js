const PREFIX = 'qipupu.game.';
export const GAME_IDS = ['candles', 'soup', 'notes', 'socks', 'truck', 'meeting'];

function read(key, storage) {
  try { return JSON.parse(storage.getItem(PREFIX + key)) ?? null; }
  catch { return null; }
}

export function bestStars(game, levelNo, storage = localStorage) {
  if (!GAME_IDS.includes(game) || levelNo < 1 || levelNo > 10) return 0;
  return read(`${game}.level.${levelNo}`, storage) ?? 0;
}

export function unlocked(game, levelNo, storage = localStorage) {
  return levelNo === 1 || bestStars(game, levelNo - 1, storage) >= 1;
}

export function totalStars(game, storage = localStorage) {
  return Array.from({ length: 10 }, (_, index) => bestStars(game, index + 1, storage)).reduce((a, b) => a + b, 0);
}

export function record(key, storage = localStorage) {
  return read(`record.${key}`, storage) ?? 0;
}

export function saveResult(game, levelNo, stars, records = {}, storage = localStorage) {
  if (!GAME_IDS.includes(game) || !Number.isInteger(levelNo) || levelNo < 1 || levelNo > 10) throw new RangeError('遊戲或關卡錯誤');
  if (!unlocked(game, levelNo, storage)) throw new Error('關卡尚未解鎖');
  const best = Math.max(bestStars(game, levelNo, storage), Math.max(0, Math.min(3, Math.floor(stars))));
  storage.setItem(PREFIX + `${game}.level.${levelNo}`, JSON.stringify(best));
  for (const [key, value] of Object.entries(records)) {
    if (!['candlesMax', 'notesMax', 'longestBreathMs', 'socksFound', 'truckStreak', 'meetingPerfect'].includes(key)) continue;
    const updated = ['socksFound', 'meetingPerfect'].includes(key)
      ? record(key, storage) + Math.max(0, value) : Math.max(record(key, storage), value);
    storage.setItem(PREFIX + `record.${key}`, JSON.stringify(updated));
  }
  return best;
}
