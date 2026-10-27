export const BASE_SECONDS = [9, 10, 11, 12, 13];  // 0.9.2 Miles：「每一口吹氣大概 20 到 25 趴，所以我會吹 4 到 5 口」（0.9 的 5～9 秒兩口就滿，太快）
export const SAMPLE_MS = 50;
export const FLOOR_MS = 1000;
export const GENTLE_MIN = 0.007;        // 0.15 Miles 真機：對著螢幕吹（不對小孔）關降噪後 0.008～0.021，舊值 0.015 太高；講話靠低頻比例擋
export const HARD_MAX = 0.5;            // 0.9：Miles 真機用力吹到 0.35 被當成太猛不前進 → 再放寬
export const HICCUP_MS = 300;
export const HICCUP_PENALTY = 0.08;      // 0.9 Miles：「不要讓吹氣變成負擔」→ 打嗝少扣一點
export const HICCUP_COOLDOWN_MS = 800;
// 10/17 Miles 真機：沒吹也慢慢消、停下來也不會鼓回去 → 以下五個（0.5）
export const FLOOR_CAP = 0.03;           // 0.6：開頭量到的底噪最多到這裡（一進來就吹時不會把門檻墊太高）
export const FLOOR_FACTOR = 2;          // 剛好門檻至少是環境音的 2 倍（手機環境音會浮動）
export const BLOW_START_MS = 100;       // 連續 0.1 秒像吹氣才開始算（擋掉講話、咳嗽這種短聲）
export const LOW_BAND_HZ = 500;         // 吹氣是低頻風切聲；講話、電視的能量多在 500 Hz 以上
export const LOW_RATIO_MIN = 0.35;      // 0.8 真機實測：吹氣 59～93%、講話 7% → 0.35 分得很開
export const REINFLATE_AFTER_MS = 2000; // 停下來 2 秒後河豚慢慢鼓回去（0.9 放寬，換氣不用急）
export const REINFLATE_RATE = 0.2;      // 每秒退回的「吹氣秒數」（0.9 放慢）
export const BOOST_PER_VOLUME = 8;      // 0.9：吹得越有力消得越快，每超過門檻 0.1 加快 0.8 倍
export const BOOST_MAX = 1.3;           // 最多 1.3 倍速（0.9.2 從 2.5 降，靠「每口上限」控制節奏）
export const BREATH_CAP = 0.25;         // 0.9.2：一口氣最多消 25%（至少 4 口）
export const BREATH_GAP_MS = 400;       // 停超過 0.4 秒才算這口結束、換下一口
export const MAX_CERTIFICATES = 30;
export const VERSION = '0.23';
// 匿名使用漏斗（決策 885、產品長 10/21 定步驟）。總開關：法遵核過隱私說明段＋收集端上線（Miles 說「發佈」）才改 true，
// 同一版要一起換 privacy.html 的「匿名使用統計」段（草稿 docs/隱私說明_匿名使用統計_草稿.md）。false 時完全不送、不寫任何紀錄。
// 分享時附的一句話＋網頁版連結（朋友點了直接玩，不用裝 App）
export const SHARE_TEXT = '我剛幫河豚消氣了，你也來吹吹看（免安裝）：https://fervela.ai/qipupu/play/';
export const FUNNEL_ON = true;
export const FUNNEL_STEPS = ['首次打開', '選類別', '開始吹氣', '消完氣', '第一個成果'];  // 法遵 10/21：還沒有分享連結與分享頁，另兩步做好時同一版加回

export const CATEGORIES = [
  { id: 'meeting', label: '開會', name: '會議豚' },
  { id: 'boss', label: '老闆', name: '老闆豚' },
  { id: 'traffic', label: '塞車', name: '塞車豚' },
  { id: 'chores', label: '家事', name: '家事豚' },
  { id: 'child', label: '小孩', name: '小孩豚' },
  { id: 'partner', label: '另一半', name: '另一半豚' },
  { id: 'customer', label: '客人', name: '客人豚' },
  { id: 'other', label: '其他', name: '無名豚' },
];

export const LEVEL_LABELS = ['有點不爽', '煩', '很氣', '超氣', '氣到冒煙'];
