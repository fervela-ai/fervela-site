// 素材路徑集中在這裡。素材由 web/assets/build_assets.py 從 art/（行銷長 GPT 生圖）縮圖與裁切產生；換正式素材重跑即可。
export const ASSETS = {
  certificateFrame: './assets/frame.jpg',
  stamp: './assets/stamp.png',
  puff: {
    normal: './assets/puff-normal.png',
    medium: './assets/puff-medium.png',
    angry: './assets/puff-angry.png',
    deflating: './assets/puff-deflating.png',
    hiccup: './assets/puff-hiccup.png',
    relaxed: './assets/puff-relaxed.png',
  },
  // 形態豚：目前只有 3 隻（會議、塞車、家事），其他類別先用開心河豚
  forms: {
    meeting: './assets/form-meeting.png',
    traffic: './assets/form-traffic.png',
    chores: './assets/form-chores.png',
  },
  catIcon: id => `./assets/cat-${id}.png`,
  mic: './assets/icon-mic.png',
};

export function formImage(categoryId) {
  return ASSETS.forms[categoryId] ?? ASSETS.puff.relaxed;
}

// 「有多氣」1～5 對應的河豚圖與大小：1～2 正常、3 中氣、4～5 氣到爆
export function levelPuff(level) {
  return level <= 2 ? ASSETS.puff.normal : level === 3 ? ASSETS.puff.medium : ASSETS.puff.angry;
}
export const LEVEL_SCALE = [0.8, 0.88, 0.95, 1.02, 1.1];
