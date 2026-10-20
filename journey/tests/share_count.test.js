// 飛鴻分享頁計數的隱私測試（太守｜飛鴻 10/21；法遵長：計數請求只能帶固定來源標記，不准讀 location.hash 或完整網址送出）。
// 跑法：node journey/tests/share_count.test.js [要測的 share.js 路徑]；全過離開碼 0，任何一項失敗離開碼 1。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = process.argv[2] || path.join(__dirname, '..', 'share.js');
const src = fs.readFileSync(file, 'utf8');
const SECRET = 'eJy9WVtvGkkW_iuRn9NS37vJWzTa3dmH3ZV2V7sPu6OooZsExQYL49mdGY0EtjFgzCWJDcbGxleMk4CNwTbmYv';
let fails = 0, passes = 0;
function check(name, ok, detail) {
  if (ok) { passes++; console.log('✓ ' + name); } else { fails++; console.log('✗ ' + name + (detail ? '：' + detail : '')); }
}

// 一、原始碼不准碰網址：location、document.URL、href、hash、referrer 都不准出現在程式（註解除外）。
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
for (const bad of ['location', 'document.URL', 'href', '.hash', 'referrer =', 'document.referrer']) {
  check('程式沒有用到 ' + bad, !code.includes(bad));
}

// 二、在「網址帶 #trip=」的假瀏覽器裡實際跑，攔下所有請求。
function run(base, kinds) {
  const sent = [];
  const sandbox = {
    location: { href: 'https://fervela.ai/journey/?r=share#trip=' + SECRET, hash: '#trip=' + SECRET, search: '?r=share' },
    document: { URL: 'https://fervela.ai/journey/?r=share#trip=' + SECRET, referrer: 'https://line.me/#trip=' + SECRET },
    fetch: (url, opts) => { sent.push({ url: String(url), opts: opts || {} }); return Promise.resolve(); },
    navigator: { sendBeacon: (url, data) => { sent.push({ url: String(url), opts: { beacon: data } }); return true; } },
    XMLHttpRequest: function () { this.open = (m, u) => sent.push({ url: String(u), opts: {} }); this.send = () => {}; },
    Image: function () { Object.defineProperty(this, 'src', { set: (u) => sent.push({ url: String(u), opts: {} }) }); },
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: file });
  const sc = sandbox.shareCount;
  if (typeof sc !== 'function') return { sent, missing: true };
  if (base !== undefined) sc.base = base;
  kinds.forEach((k) => sc(k));
  return { sent };
}

const off = run(undefined, ['view', 'download']);
check('有 shareCount 函式', !off.missing);
check('接收端沒設定時一個請求都不送', off.sent.length === 0, JSON.stringify(off.sent));

const BASE = 'https://count.example.test/hit';
const on = run(BASE, ['view', 'download', 'bogus', '', undefined]);
check('只送兩個合法事件', on.sent.length === 2, '送了 ' + on.sent.length + ' 個');
for (const s of on.sent) {
  check('請求沒有 # 後面的內容：' + s.url, !s.url.includes('#') && !s.url.includes('trip') && !s.url.includes(SECRET.slice(0, 12)));
  const q = s.url.slice(BASE.length);
  check('請求只有 r=share 與固定事件名：' + q, /^\?r=share&e=journey-share-(view|download)$/.test(q));
  check('請求不帶 cookie、不帶來源網址', s.opts.credentials === 'omit' && s.opts.referrerPolicy === 'no-referrer',
    JSON.stringify(s.opts));
  check('請求內容沒有帶東西', s.opts.body === undefined && s.opts.beacon === undefined);
}

console.log(`\n${passes} 項通過、${fails} 項失敗（測的是 ${file}）`);
process.exit(fails ? 1 : 0);
