/* 飛鴻分享頁的匿名計數（法遵長 10/21）：只送固定字串，不讀也不送網址的任何部分。
   kind 只收 'view'（顯示成功一次）與 'download'（按下載按鈕一次）。請求只帶 r=share 與事件名。
   接收端網址 shareCount.base 目前是空字串＝不送；等營運長／架構長部署好、送法遵後再填。 */
(function (root) {
  'use strict';
  var EVENTS = { view: 'journey-share-view', download: 'journey-share-download' };
  function shareCount(kind) {
    try {
      var ev = EVENTS[kind];
      if (!ev || !shareCount.base) return false;
      var url = shareCount.base + '?r=share&e=' + ev;
      if (typeof fetch !== 'function') return false;
      fetch(url, { method: 'GET', mode: 'no-cors', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true }).catch(function () {});
      return true;
    } catch (e) { return false; }
  }
  shareCount.base = '';
  root.shareCount = shareCount;
  if (typeof module !== 'undefined' && module.exports) module.exports = shareCount;
})(typeof window !== 'undefined' ? window : globalThis);
