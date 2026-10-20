/* 飛鴻分享頁的匿名計數（法遵長 10/21；架構長 10/21 定全公司只用漏斗收集端 t.fervela.ai）。
   只送固定字串：不讀也不送網址的任何部分（沒有 location、href、hash、referrer）。
   格式照 fervela-lab/funnel-collector/worker_d1.js：POST JSON，剛好六欄
   product、version、platform、step、mins、date；多一欄整批退 400，所以一則一批、分開送。
   kind 只收 'view'（顯示成功一次 → 步驟「從分享進來」）與 'download'（按下載一次 → 「分享頁按下載」）。
   shareCount.base 設成空字串就什麼都不送。 */
(function (root) {
  'use strict';
  var STEPS = { view: '從分享進來', download: '分享頁按下載' };
  function taiwanToday() {
    var d = new Date(Date.now() + 8 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }
  function shareCount(kind) {
    try {
      var step = STEPS[kind];
      if (!step || !shareCount.base) return false;
      if (typeof fetch !== 'function') return false;
      var body = JSON.stringify([{
        product: 'journey',
        version: shareCount.version,
        platform: 'web',
        step: step,
        mins: '<1',
        date: taiwanToday()
      }]);
      fetch(shareCount.base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        keepalive: true
      }).catch(function () {});
      return true;
    } catch (e) { return false; }
  }
  shareCount.base = 'https://t.fervela.ai/e';
  shareCount.version = '0.9';
  root.shareCount = shareCount;
  if (typeof module !== 'undefined' && module.exports) module.exports = shareCount;
})(typeof window !== 'undefined' ? window : globalThis);
