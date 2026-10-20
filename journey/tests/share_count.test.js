// 飛鴻分享頁計數的隱私測試（太守｜飛鴻 10/21；法遵長：計數請求只能帶固定欄位，不准讀 location.hash 或完整網址送出）。
// 格式照漏斗收集端 t.fervela.ai（~/fervela-lab/funnel-collector/worker_d1.js）：POST JSON 陣列，每則剛好六欄。
// 跑法：node journey/tests/share_count.test.js [要測的 share.js 路徑]；全過離開碼 0，任何一項失敗離開碼 1。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = process.argv[2] || path.join(__dirname, '..', 'share.js');
const src = fs.readFileSync(file, 'utf8');
const SECRET = 'eJy9WVtvGkkW_iuRn9NS37vJWzTa3dmH3ZV2V7sPu6OooZsExQYL49mdGY0EtjFgzCWJDcbGxleMk4CNwTbmYv';
const FIELDS = ['product', 'version', 'platform', 'step', 'mins', 'date'];
const STEPS = { view: '從分享進來', download: '分享頁按下載' };
let fails = 0, passes = 0;
function check(name, ok, detail) {
  if (ok) { passes++; console.log('✓ ' + name); } else { fails++; console.log('✗ ' + name + (detail ? '：' + detail : '')); }
}

// 一、原始碼不准碰網址（註解除外）。
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
for (const bad of ['location', 'document.URL', 'href', '.hash', 'referrer =', 'document.referrer', 'navigator.userAgent']) {
  check('程式沒有用到 ' + bad, !code.includes(bad));
}

// 二、在「網址帶 #trip=」的假瀏覽器裡實際跑，攔下所有請求。
function run(setup, kinds) {
  const sent = [];
  const sandbox = {
    location: { href: 'https://fervela.ai/journey/?r=share#trip=' + SECRET, hash: '#trip=' + SECRET, search: '?r=share' },
    document: { URL: 'https://fervela.ai/journey/?r=share#trip=' + SECRET, referrer: 'https://line.me/#trip=' + SECRET },
    navigator: { userAgent: 'TEST-UA-' + SECRET, sendBeacon: (u, d) => { sent.push({ url: String(u), opts: { body: String(d), beacon: true } }); return true; } },
    fetch: (url, opts) => { sent.push({ url: String(url), opts: opts || {} }); return Promise.resolve(); },
    XMLHttpRequest: function () { this.open = (m, u) => sent.push({ url: String(u), opts: {} }); this.send = () => {}; this.setRequestHeader = () => {}; },
    Image: function () { Object.defineProperty(this, 'src', { set: (u) => sent.push({ url: String(u), opts: {} }) }); },
    Date, JSON, Math,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: file });
  const sc = sandbox.shareCount;
  if (typeof sc !== 'function') return { sent, missing: true };
  setup(sc);
  kinds.forEach((k) => sc(k));
  return { sent, sc };
}

const off = run((sc) => { sc.base = ''; }, ['view', 'download']);
check('有 shareCount 函式', !off.missing);
check('接收端設成空字串時一個請求都不送', off.sent.length === 0, JSON.stringify(off.sent));

const on = run(() => {}, ['view', 'download', 'bogus', '', undefined]);
check('預設接收端是漏斗收集端 https://t.fervela.ai/e', on.sc && on.sc.base === 'https://t.fervela.ai/e', on.sc && on.sc.base);
check('只送兩個合法事件', on.sent.length === 2, '送了 ' + on.sent.length + ' 個');
const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
on.sent.forEach((s, i) => {
  const whole = s.url + ' ' + JSON.stringify(s.opts);
  check(`第 ${i + 1} 則：整個請求沒有 #、trip、行程代碼、瀏覽器識別`, !whole.includes('#') && !whole.includes('trip') && !whole.includes(SECRET.slice(0, 12)) && !whole.includes('TEST-UA'), whole.slice(0, 200));
  check(`第 ${i + 1} 則：網址就是接收端本身，沒有參數`, s.url === 'https://t.fervela.ai/e', s.url);
  check(`第 ${i + 1} 則：POST、不帶 cookie、不帶來源網址`, s.opts.method === 'POST' && s.opts.credentials === 'omit' && s.opts.referrerPolicy === 'no-referrer', JSON.stringify(s.opts));
  let body; try { body = JSON.parse(s.opts.body); } catch (e) { body = null; }
  check(`第 ${i + 1} 則：內容是只有一則的 JSON 陣列`, Array.isArray(body) && body.length === 1, s.opts.body);
  const e = Array.isArray(body) ? body[0] : {};
  const keys = Object.keys(e || {});
  check(`第 ${i + 1} 則：剛好六欄 ${FIELDS.join('、')}`, keys.length === 6 && FIELDS.every((k) => keys.includes(k)), keys.join(','));
  check(`第 ${i + 1} 則：六欄都是字串`, FIELDS.every((k) => typeof e[k] === 'string'));
  check(`第 ${i + 1} 則：product＝journey、platform＝web、mins＝<1`, e.product === 'journey' && e.platform === 'web' && e.mins === '<1', JSON.stringify(e));
  check(`第 ${i + 1} 則：step 照順序是「${i === 0 ? STEPS.view : STEPS.download}」`, e.step === (i === 0 ? STEPS.view : STEPS.download), e.step);
  check(`第 ${i + 1} 則：version 是 X.Y 或 X.Y.Z`, /^\d{1,2}\.\d{1,2}(\.\d{1,2})?$/.test(e.version || ''), e.version);
  check(`第 ${i + 1} 則：date 是台灣今天`, e.date === today, e.date + ' vs ' + today);
});

console.log(`\n${passes} 項通過、${fails} 項失敗（測的是 ${file}）`);
process.exit(fails ? 1 : 0);
