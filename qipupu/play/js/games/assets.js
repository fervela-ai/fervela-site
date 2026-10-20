const base = './assets/games/';
const art = name => `${base}${name}.webp`;

export const GAME_ASSETS = {
  candles: {
    icon: '🕯️', puff: art('puff-party'), puffBlow: art('puff-party-blow'),
    cake: art('cake-long'), lit: art('candle-lit'), out: art('candle-out'),
  },
  soup: {
    icon: '🍜', puff: art('puff-bib'), puffBlow: art('puff-bib-blow'),
    thermometer: art('thermometer'),
    scene: {
      熱湯: { emoji: '🍲', hot: art('soup-hot'), ok: art('soup-ok') },
      熱珍奶: { emoji: '🧋', hot: art('boba-hot'), ok: art('boba-ok') },
      湯圓: { emoji: '🍡', hot: art('tangyuan-hot'), ok: art('tangyuan-ok') },
      泡麵: { emoji: '🍜', hot: art('noodle-hot'), ok: art('noodle-ok') },
    },
  },
  notes: {
    icon: '📝', puff: art('puff-tie'), puffBlow: art('puff-tie-blow'),
    desk: art('desk-bg'), yellow: art('note-yellow'), red: art('note-red'),
  },
  socks: {
    icon: '🧦', puff: art('puff-detective'), puffBlow: art('puff-detective-blow'),
    background: art('laundry-bg'), basket: art('basket'), spotlight: art('spotlight'),
    board: art('lost-found-board'), sockHat: art('puff-sock-hat'), press: art('press-conference'), sock: Object.fromEntries(Object.entries({
      red: 'red', blue: 'blue', green: 'green', stripeRed: 'stripe-red', stripeBlue: 'stripe-blue',
      kidStripe: 'stripe-blue', dotBlue: 'dot-blue', dotYellow: 'dot-yellow', sky: 'skyblue',
      pale: 'lightblue', whiteRib: 'white-rib', whiteShort: 'white-rib', whiteLace: 'white-lace',
      dadGray: 'dad-gray', momPink: 'mom-pink', kidDino: 'kid-dino', grandmaKnit: 'grandma-knit',
    }).map(([id, file]) => [id, art(`sock-${file}`)])),
  },
  truck: {
    icon: '🚛', puff: art('puff-dad'), background: art('alley-bg'), truck: art('truck'),
    beatOn: art('beat-on'), beatRest: art('beat-rest'), beatOff: art('beat-off'),
    umbrella: art('umbrella'), cart: art('neighbor-cart'),
    family: Object.fromEntries(['dad','mom','kid','grandma'].map(id =>
      [id, { normal: art(`puff-${id}`), bag: art(`puff-${id}-bag`) }])),
  },
  meeting: {
    icon: '💻', puff: art('puff-face-focus'), frame: art('call-frame'), boss: art('boss-popup'),
    face: Object.fromEntries([
      ['專心','focus'],['點頭','nod'],['打瞌睡','sleepy'],['偷吃早餐','breakfast'],
      ['放空','blank'],['翻白眼','eyeroll'],
    ].map(([label,id]) => [label, art(`puff-face-${id}`)])),
    background: Object.fromEntries([
      ['乾淨書櫃','bookshelf'],['同事路過','coworker'],['貓入鏡','cat'],
      ['亂房間','messy'],['早餐店','breakfast'],['海邊度假','beach'],
    ].map(([label,id]) => [label, art(`bg-${id}`)])),
    filter: Object.fromEntries([
      ['河豚董事長','chairman'],['夢遊模式','sleepwalk'],['早餐店老闆','shopkeeper'],
    ].map(([label,id]) => [label, art(`filter-${id}`)])),
  },
  starOn: art('star-on'), starOff: art('star-off'),
  frame: './assets/frame.jpg',
  stamp: './assets/stamp.png',
};
