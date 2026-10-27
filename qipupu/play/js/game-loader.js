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

export const GAMES = {
  candles: { name: '吹蠟燭', about: '一口氣吹熄整排蠟燭', instruction: '慢慢吹，看看一口氣能熄幾根', create: createCandles, step: stepCandles },
  soup: { name: '吹涼珍奶／熱湯', about: '慢慢吹涼才能喝', instruction: '慢慢吹到 60°C，別讓湯濺出來', create: createSoup, step: stepSoup },
  notes: { name: '吹走便利貼', about: '把待辦一張張吹走', instruction: '慢慢吹，每張都要吹夠久', create: createNotes, step: stepNotes },
  socks: { name: '襪子失蹤案', about: '看準另一隻襪子', instruction: '聚光燈裡看到同款襪，短吹一下', create: createSocks, step: stepSocks },
  truck: { name: '垃圾車節拍長', about: '看燈號抓住節拍', instruction: '先看三拍倒數，橘燈短吹，灰燈別吹', create: createTruck, step: stepTruck },
  meeting: { name: '視訊會議濾鏡就位', about: '定格表情和背景', create: createMeeting, step: stepMeeting, instruction: '看題目，在正確格短吹定格' },
};
export { spotlightAt, wheelAt, SOCK_CATALOG, bestStars, unlocked, totalStars, record, saveResult, GAME_ASSETS, drawGameCard };
