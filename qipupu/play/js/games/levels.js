export const CANDLE_LEVELS = [5, 6, 8, 10, 12, 14, 16, 20, 24, 30].map((count, index) => ({
  count, limitMs: 60000, normalMs: 1000 / 3, softMs: 1000 / 1.5,
  stubbornMs: 600, stubbornEvery: index >= 3 ? 4 : 0,
  magicEvery: index >= 6 ? 5 : 0, gapMs: 400, relightMs: 1500,
}));

export const SOUP_LEVELS = [
  [85, 4], [86, 3.8], [88, 3.6], [89, 3.5], [91, 3.3],
  [92, 3.1], [94, 3], [95, 2.8], [97, 2.6], [98, 2.5],
].map(([start, rate], index) => ({
  start, rate, target: 60, passiveRate: 0.2, limitMs: 60000,
  food: index < 3 ? '熱湯' : index < 6 ? '熱珍奶' : index < 8 ? '湯圓' : '泡麵',
}));

export const NOTE_LEVELS = [5, 7, 9, 11, 13, 15, 18, 21, 25, 30].map((count, index) => ({
  count, limitMs: 60000, normalMs: 500, softMs: 1000,
  urgentMs: 1200, urgentEvery: index >= 2 ? 4 : 0,
}));

// 10/19 太守：襪子清單改成跟行銷長素材一致（art/games/素材/sock-*.png 15 隻）；小孩尺寸用同一張圖縮小
const SOCKS = {
  red: ['紅', '純色', '大人', '羅紋口'], blue: ['藍', '純色', '大人', '羅紋口'],
  green: ['綠', '純色', '大人', '羅紋口'], stripeRed: ['紅', '條紋', '大人', '羅紋口'],
  stripeBlue: ['藍', '條紋', '大人', '羅紋口'], kidStripe: ['藍', '條紋', '小孩', '羅紋口'],
  dotBlue: ['藍', '點點', '大人', '羅紋口'], dotYellow: ['黃', '點點', '大人', '羅紋口'],
  sky: ['天藍', '純色', '大人', '羅紋口'], pale: ['淺藍', '純色', '大人', '羅紋口'],
  whiteRib: ['白', '純色', '大人', '羅紋口'], whiteShort: ['白', '純色', '小孩', '羅紋口'],
  whiteLace: ['白', '純色', '大人', '蕾絲口'],
  dadGray: ['灰', '爸爸款', '大人', '羅紋口'], momPink: ['粉', '媽媽款', '大人', '羅紋口'],
  kidDino: ['綠', '恐龍', '小孩', '羅紋口'], grandmaKnit: ['米', '毛線', '大人', '毛線口'],
};
export const SOCK_CATALOG = Object.fromEntries(Object.entries(SOCKS).map(([id, fields]) =>
  [id, { id, color: fields[0], pattern: fields[1], size: fields[2], cuff: fields[3] }]));

export const SOCK_LEVELS = [
  ['純色', 2000, ['red'], ['blue', 'green', 'red']],
  ['條紋', 1900, ['stripeRed'], ['red', 'stripeBlue', 'stripeRed']],
  ['條紋與點點', 1800, ['dotBlue'], ['stripeBlue', 'dotYellow', 'dotBlue']],
  ['相似色', 1700, ['sky'], ['pale', 'blue', 'sky']],
  ['大人與小孩尺寸', 1600, ['stripeBlue'], ['kidStripe', 'stripeRed', 'stripeBlue']],
  ['制服白襪', 1500, ['whiteRib'], ['whiteShort', 'whiteLace', 'grandmaKnit', 'whiteRib']],
  ['同色不同襪口', 1400, ['whiteLace'], ['whiteRib', 'whiteShort', 'whiteLace']],
  ['兩雙交錯', 1400, ['stripeRed', 'dotBlue'], ['dotBlue', 'stripeBlue', 'stripeRed', 'dotYellow']],
  ['三雙依序配', 1300, ['sky', 'dotYellow', 'whiteLace'], ['whiteLace', 'pale', 'dotYellow', 'whiteRib', 'sky']],
  ['全家四雙', 1200, ['kidDino', 'dadGray', 'momPink', 'grandmaKnit'], ['grandmaKnit', 'whiteRib', 'momPink', 'dadGray', 'green', 'kidDino']],
].map(([theme, periodMs, targets, carousel]) => ({
  theme, periodMs, targets, carousel, pairs: targets.length, limitMs: 60000, maxWrong: 4,
}));

const truck = (theme, pattern, beatMs, windowMs) => ({ theme,
  pattern: pattern.map(([hit, gap]) => ({ hit, gap })), beatMs, windowMs, limitMs: 60000 });
export const TRUCK_LEVELS = [
  truck('兩個等拍', [[1,1],[1,1]], 1000, 300),
  truck('三拍', [[1,1],[1,1],[1,1]], 1000, 300),
  truck('加入空拍', [[1,1],[0,1],[1,1]], 900, 280),
  truck('兩慢一快', [[1,1],[1,1],[1,.5]], 900, 260),
  truck('雨傘入隊', [[1,1],[1,1],[0,1],[1,1]], 850, 250),
  truck('鄰居推車', [[1,1],[0,1],[1,1],[1,1]], 800, 250),
  truck('兩個空拍', [[1,1],[0,1],[0,1],[1,1],[1,1]], 800, 240),
  truck('快慢交替', [[1,1],[1,1],[0,.5],[1,1],[1,.5]], 750, 230),
  truck('家人輪流出門', [[1,1],[0,1],[1,1],[0,1],[1,1],[1,1]], 700, 220),
  truck('全巷聯合編舞', [[1,1],[1,1],[0,1],[1,1],[0,1],[1,1],[1,1]], 650, 200),
];

export const MEETING_EXPRESSIONS = ['專心', '點頭', '打瞌睡', '偷吃早餐', '放空', '翻白眼'];
export const MEETING_BACKGROUNDS = ['乾淨書櫃', '同事路過', '貓入鏡', '亂房間', '早餐店', '海邊度假'];
export const MEETING_LEVELS = [
  ['專心臉', 1600, ['expression'], '專心', null],
  ['點頭臉', 1500, ['expression'], '點頭', null],
  ['正常背景', 1500, ['background'], null, '乾淨書櫃'],
  ['同事路過', 1400, ['background'], null, '乾淨書櫃'],
  ['貓入鏡', 1400, ['background'], null, '乾淨書櫃'],
  ['表情與背景', 1400, ['expression','background'], '專心', '乾淨書櫃'],
  ['假停格', 1300, ['expression','background'], '專心', '乾淨書櫃'],
  ['突然被點名', 1300, ['expression','background'], '專心', '乾淨書櫃'],
  ['全員同框', 1100, ['expression','background'], '專心', '乾淨書櫃'],
  ['其實在吃早餐', 1000, ['expression','background'], '點頭', '乾淨書櫃'],
].map(([theme, periodMs, stages, expression, background], index) => ({
  theme, periodMs, stages, expression, background, maxPuffs: index < 5 ? 2 : 3,
  fakePauseMs: index === 6 ? 600 : 0, speedUpAfterMs: index === 7 ? 5000 : null,
  speedUpPeriodMs: index === 7 ? 900 : null, coworkers: index === 8 ? 3 : 0,
  limitMs: 60000,
}));

export function levelAt(table, levelNo) {
  if (!Number.isInteger(levelNo) || levelNo < 1 || levelNo > table.length) throw new RangeError('關卡須為 1～10');
  return table[levelNo - 1];
}
