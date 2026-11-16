/* 官網每頁「看過／按讚」（11/16 營運長；規格：產品長 全產品統計規格 11/12 第 4 節；視覺稿：行銷長 頁尾計數按讚 r2，產品長 11/16 核可）
 * - 看過：每台每頁每天最多送一次，只送「頁面路徑＋台灣日期」。
 * - 按讚：每台每頁永久只算一次（法遵長 11/12 必改），隔天再按也不送；按了才送。
 * - 顯示：看過與讚各自判斷，累計少於 10 就不顯示那個數字（讚鍵永遠留著）。
 * - 瀏覽器禁止儲存時：不送看過、不顯示讚鍵，避免重複計算。 */
(function (root) {
  'use strict';
  var EP = 'https://t.fervela.ai';
  var PATHS = ['/', '/books/', '/journey/', '/wengu/', '/army/', '/qipupu/', '/ai-boardroom/', '/privacy.html'];
  var SEEN = 'ffunnel:site:seen', LIKED = 'ffunnel:site:liked', OFF = 'ffunnel:site:off', MIN = 10;

  function norm(p) { p = String(p || '/'); return p.replace(/\/index\.html$/, '/'); }
  function day(now) { return new Date((now || Date.now()) + 8 * 3600e3).toISOString().slice(0, 10); }
  function readArr(st, k) { try { var a = JSON.parse(st.getItem(k)); return Array.isArray(a) ? a : []; } catch (e) { return []; } }

  /* 純顯示規則（測試用）：兩個數字各自判斷 */
  function view(views, likes, liked) {
    return {
      showViews: typeof views === 'number' && views >= MIN,
      viewsText: views + ' 人看過',
      showLikes: typeof likes === 'number' && likes >= MIN,
      likesText: String(likes),
      filled: !!liked
    };
  }

  /* 看過：今天這頁送過就不送；回傳是否送出 */
  function sendView(st, path, send, now) {
    try { if (st.getItem(OFF) === '1') return false; } catch (e) { return false; }
    var d = day(now), s;
    try { s = JSON.parse(st.getItem(SEEN)); } catch (e) { s = null; }
    if (!s || s.day !== d || !Array.isArray(s.ids)) s = { day: d, ids: [] };
    if (s.ids.indexOf(path) >= 0) return false;
    s.ids.push(path);
    try { st.setItem(SEEN, JSON.stringify(s)); } catch (e) { return false; }
    try { if (JSON.parse(st.getItem(SEEN)).ids.indexOf(path) < 0) return false; } catch (e) { return false; }  // 沒記住就不送
    send('/a', [{ product: 'site', article: path, date: d }]);
    return true;
  }

  /* 按讚：永久只算一次；先記住才送，記不住就不送；回傳是否送出 */
  function like(st, path, send, now) {
    if (readArr(st, LIKED).indexOf(path) >= 0) return false;
    try { st.setItem(LIKED, JSON.stringify(readArr(st, LIKED).concat([path]))); } catch (e) { return false; }
    if (readArr(st, LIKED).indexOf(path) < 0) return false;
    send('/l', [{ product: 'site', article: path, date: day(now) }]);
    return true;
  }

  var api = { PATHS: PATHS, MIN: MIN, norm: norm, day: day, view: view, sendView: sendView, like: like };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  var path = norm(location.pathname);
  if (PATHS.indexOf(path) < 0) return;
  var box = document.querySelector('.footer-in');
  if (!box) return;
  var st = null;
  try { localStorage.getItem(LIKED); st = localStorage; } catch (e) { st = null; }
  var post = function (ep, body) {
    try { fetch(EP + ep, { method: 'POST', keepalive: true, body: JSON.stringify(body) }).catch(function () {}); } catch (e) {}
  };

  var css = document.createElement('style');
  css.textContent = '.pc-row{display:flex;align-items:center;justify-content:center;gap:14px;margin:0 0 22px;padding-bottom:18px;border-bottom:1px solid var(--line);color:var(--ink);font-size:16px;line-height:1}' +
    '.pc-v{display:inline-flex;align-items:center;gap:8px}.pc-v[hidden],.pc-sep[hidden]{display:none}' +
    '.pc-sep{width:1px;height:20px;background:var(--line)}' +
    '.pc-like{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 6px;border:0;background:none;color:var(--ink);font:inherit;cursor:pointer}' +
    '.pc-like svg{width:24px;height:24px;fill:none;stroke:#EA5513;stroke-width:2}.pc-like[aria-pressed="true"] svg{fill:#EA5513}' +
    '.pc-like[aria-pressed="true"]{cursor:default}.pc-like:focus-visible{outline:2px solid #EA5513;outline-offset:2px;border-radius:6px}';
  document.head.appendChild(css);

  var row = document.createElement('div');
  row.className = 'pc-row';
  row.innerHTML = '<span class="pc-v" hidden><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><span class="pc-vt"></span></span><span class="pc-sep" hidden></span>';
  var vEl = row.querySelector('.pc-v'), vt = row.querySelector('.pc-vt'), sep = row.querySelector('.pc-sep');
  var btn = null, nEl = null, c = null, mine = 0;
  if (st) {
    btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'pc-like';
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.6 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.5 0 5.7 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg><span class="pc-n"></span>';
    nEl = btn.querySelector('.pc-n');
    row.appendChild(btn);
    btn.addEventListener('click', function () { if (like(st, path, post)) { mine = 1; paint(); } });
  }
  function paint() {
    var liked = !!st && readArr(st, LIKED).indexOf(path) >= 0;
    var v = view(c ? c.views : null, c ? c.likes + mine : null, liked);
    vEl.hidden = !v.showViews; vt.textContent = v.showViews ? v.viewsText : '';
    if (btn) {
      btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
      btn.setAttribute('aria-label', liked ? '已按讚' : '按讚');
      nEl.textContent = v.showLikes ? v.likesText : '';
    }
    sep.hidden = !(v.showViews && btn);
    row.hidden = !v.showViews && !btn;
  }
  box.insertBefore(row, box.firstChild);
  paint();
  if (st) sendView(st, path, post);
  fetch(EP + '/c?product=site&article=' + encodeURIComponent(path))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { if (j && typeof j.views === 'number' && typeof j.likes === 'number') { c = j; paint(); } })
    .catch(function () {});
})(this);
