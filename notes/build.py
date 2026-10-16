#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 _drafts/ 的 Markdown 轉成 notes/ 的網頁，並更新筆記索引。

⚠️ 刻意不用任何第三方套件（沒有 markdown 函式庫、沒有靜態網站產生器）。
   這個站的其他部分也是零相依，多一個工具鏈就多一個會壞掉的環節，
   而且改一篇文章不該需要先修好建置環境。

   支援的語法只有這幾種，夠寫文章就好：
     # 標題 / ## 小標 / > 引言 / **粗體** / *斜體* / [文字](網址) / --- 分隔
     ![圖說](img/資料夾/檔名.jpg)  ← 獨立一行；圖說會顯示在圖片下方
     ![圖說](img/資料夾/檔名.mp4)  ← 影片；同資料夾要有同名 .jpg 當封面

用法：
    python3 build.py            重建全部文章與索引
"""
import io, os, re, html, json, shutil, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
DRAFTS = os.path.join(HERE, "_drafts")
META = os.path.join(HERE, "posts.json")     # 每篇的日期與摘要，人工維護
                                            # 帶 "link" 的條目是指到站內其他頁的卡片，
                                            # 不需要 .md，但要自己寫 "title"


def inline(t):
    t = html.escape(t)
    t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    t = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<em>\1</em>', t)
    return t


def render(md):
    """回傳 (標題, 內文 HTML)。"""
    title, out, buf, quote = "", [], [], []

    def flush():
        if buf:
            out.append("<p>" + inline(" ".join(buf).strip()) + "</p>")
            buf.clear()

    def flushq():
        if quote:
            out.append("<blockquote><p>" + inline(" ".join(quote).strip()) + "</p></blockquote>")
            quote.clear()

    for raw in md.split("\n"):
        l = raw.rstrip()
        if l.startswith("> "):
            flush(); quote.append(l[2:]); continue
        flushq()
        if not l.strip():
            flush(); continue
        if l.startswith("# "):
            flush(); title = l[2:].strip(); continue
        if l.startswith("## "):
            flush(); out.append("<h2>" + inline(l[3:].strip()) + "</h2>"); continue
        m = re.match(r'^!\[([^\]]*)\]\(([^)]+)\)$', l.strip())
        if m:   # 獨立一行的圖片：alt 同時當圖說
            flush()
            alt, src = html.escape(m.group(1)), html.escape(m.group(2))
            if src.lower().endswith(".mp4"):
                # 影片：封面圖用同名 .jpg。preload=metadata＝沒按播放就不下載整支影片
                out.append('<figure><video controls playsinline preload="metadata" poster="%s" src="%s">'
                           '<a href="%s">下載影片</a></video><figcaption>%s</figcaption></figure>'
                           % (src[:-4] + ".jpg", src, src, inline(m.group(1))))
                continue
            out.append('<figure><a href="%s"><img src="%s" alt="%s" loading="lazy"></a>'
                       '<figcaption>%s</figcaption></figure>' % (src, src, alt, inline(m.group(1))))
            continue
        if l.strip() == "---":
            flush(); continue
        buf.append(l.strip())
    flush(); flushq()
    return title, "\n".join(out)


HEADER = '<header class="header"><div class="header-in"><a class="brand" href="/" aria-label="Fervela.ai 首頁"><img class="logo" src="/assets/logo-a.svg" width="34" height="34" alt=""><span>Fervela.ai</span></a><button class="menu" aria-label="開啟選單" aria-expanded="false" aria-controls="nav"><span></span><span></span><span></span></button><nav id="nav" aria-label="主選單"><ul><li><a href="/#work">作品</a></li><li><a href="/#journal">實踐筆記</a></li><li><a href="mailto:contact@fervela.ai">聊聊你的想法</a></li></ul></nav></div></header>'
FOOTER = '<footer class="footer"><div class="footer-in"><a class="brand" href="/" aria-label="Fervela.ai 首頁"><img class="logo" src="/assets/logo-a.svg" width="34" height="34" alt=""><span>Fervela.ai</span></a><p class="tag">Research. Create. Share.</p><div class="flinks"><a href="/#work">作品</a><a href="/#journal">實踐筆記</a><a href="mailto:contact@fervela.ai">聊聊你的想法</a><a href="/privacy.html">隱私權政策</a></div><p class="copy">© 2026 雲帆研創有限公司（Fervela.ai）\u3000用心設計的好軟體，解決生活的真問題。</p></div></footer>'

PAGE = '''<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<link rel="icon" type="image/png" href="/assets/fervela-icon.png">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — Fervela.ai</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#faf6ef">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="article">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@600;700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/v5/v5.css">
<link rel="stylesheet" href="/assets/v5/notes.css">
<script src="/assets/v5/v5.js" defer></script>
<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token":"9791694bcfb64758948d79fecdce88b1","spa":false}}'></script>
</head>
<body id="top">
<a class="skip" href="#main">跳至內容</a>
{header}
<main id="main" class="ar-main">
  <div class="ar-crumb" role="navigation" aria-label="麵包屑"><a href="/notes/">實踐筆記</a><span aria-hidden="true">/</span><a class="on {cat}" href="/notes/#{cat}">{catname}</a></div>
  <article class="ar-card">
    <span class="nt-label {cat}"><i class="dot {cat}"></i>{catname}</span>
    <h1 class="ar-title">{title}</h1>
    <div class="ar-date">{datedot} · Miles</div>
    <p class="ar-lede {cat}">{ledehtml}</p>
    <div class="ar-body">
{body}
    </div>
    <div class="ar-end">
      <a class="ar-back" href="/notes/"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>回到實踐筆記</a>
      <a class="ar-next" href="{nhref}">
        <picture><source srcset="/assets/v5/{nthumb}.webp" type="image/webp"><img src="/assets/v5/{nthumb}.jpg" alt="" width="1200" height="800" loading="lazy" decoding="async"></picture>
        <span class="ar-next-t"><small>下一篇</small><b>{ntitle}</b></span>
        <svg class="ar-chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
      </a>
    </div>
  </article>
</main>
{footer}
</body>
</html>
'''

CATS = [("discover", "沿途發現"), ("practice", "實踐歷程"), ("map", "學習地圖")]
CAT_NAME = dict(CATS)
# 縮圖：只用站上現有的 V5 照片，依序輪流配，不放人臉
THUMBS = ["note1", "note2", "note3", "step1", "step2", "step3", "hero"]

INDEX = '''<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>實踐筆記 — Fervela.ai</title>
<meta name="description" content="把做軟體、用 AI 的過程寫下來：沿途發現、實踐歷程、學習地圖。">
<meta name="theme-color" content="#faf6ef">
<meta property="og:title" content="實踐筆記 — Fervela.ai">
<meta property="og:description" content="把做軟體、用 AI 的過程寫下來：沿途發現、實踐歷程、學習地圖。">
<meta property="og:type" content="website">
<meta property="og:url" content="https://fervela.ai/notes/">
<meta property="og:image" content="https://fervela.ai/assets/v5/og-home.jpg">
<link rel="icon" type="image/png" href="/assets/fervela-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@600;700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/v5/v5.css">
<link rel="stylesheet" href="/assets/v5/notes.css">
<script src="/assets/v5/v5.js" defer></script>
<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token":"9791694bcfb64758948d79fecdce88b1","spa":false}}'></script>
</head>
<body id="top">
<a class="skip" href="#main">跳至內容</a>
{header}
<main id="main" class="wrap nt">
  <section class="nt-head">
    <h1>實踐筆記</h1>
    <p>把做軟體、用 AI 的過程寫下來。</p>
  </section>
  <div class="nt-tabs" role="tablist" aria-label="筆記分類">
{tabs}
  </div>
  <div class="nt-grid" id="grid">
{items}
  </div>
  <div class="nt-empty" id="empty" hidden>
    <p>第一則沿途發現，很快會出現在這裡。</p>
    <a href="/timeline/">先看 AI 的重要時刻 →</a>
  </div>
</main>
{footer}
<script>
(function(){{
  var tabs=[].slice.call(document.querySelectorAll('.nt-tab')),
      cards=[].slice.call(document.querySelectorAll('.nt-card')),
      empty=document.getElementById('empty'),
      valid={valid};
  function show(c){{
    if(c!=='all'&&valid.indexOf(c)<0)c='all';
    var n=0;
    cards.forEach(function(el){{var on=c==='all'||el.dataset.cat===c;el.hidden=!on;if(on)n++}});
    tabs.forEach(function(t){{var on=t.dataset.cat===c;t.classList.toggle('on',on);t.setAttribute('aria-selected',String(on))}});
    empty.hidden=n>0;
  }}
  tabs.forEach(function(t){{t.addEventListener('click',function(e){{
    e.preventDefault();var c=t.dataset.cat;
    history.replaceState(null,'',c==='all'?location.pathname:'#'+c);show(c);
  }})}});
  window.addEventListener('hashchange',function(){{show(location.hash.slice(1)||'all')}});
  show(location.hash.slice(1)||'all');
}})();
</script>
</body>
</html>
'''


def tab(cat, label):
    dot = '<i class="dot %s"></i>' % cat if cat != "all" else ""
    return ('    <a class="nt-tab" role="tab" href="#%s" data-cat="%s">%s%s</a>'
            % (cat if cat != "all" else "", cat, dot, label))


def card(href, title, date, desc, cat, thumb):
    """索引上的一張卡。文章與外連卡片共用同一個樣子。"""
    return '''    <a class="nt-card" href="{h}" data-cat="{c}">
      <picture><source srcset="/assets/v5/{im}.webp" type="image/webp"><img src="/assets/v5/{im}.jpg" alt="" width="1200" height="800" loading="lazy" decoding="async"></picture>
      <div class="nt-body">
        <span class="nt-label {c}"><i class="dot {c}"></i>{cn}</span>
        <h2>{t}</h2>
        <time>{d}</time>
        <p>{x}</p>
      </div>
    </a>'''.format(h=html.escape(href), t=html.escape(title), c=cat, cn=CAT_NAME[cat], im=thumb,
                   d=html.escape(date.replace("-", ".")), x=html.escape(desc))


def need_cat(key, m):
    c = m.get("category")
    if c not in CAT_NAME:
        raise SystemExit("❌ posts.json 的 %s 沒有有效的 category（要是 %s 其中之一），請先分類再建置"
                         % (key, "／".join(CAT_NAME)))
    return c


# ── 首頁的筆記清單 ────────────────────────────────────────────
# 為什麼要有這一段：首頁的清單跟 posts.json 沒有關係，新增條目只會出現在 /notes/，
# 首頁得有人記得手動補——實際漏過一次（2026-09-11 的課程地圖，Lynch 自己發現的）。
#
# 9/20～9/21 這段曾經用 notelist 標記圈住首頁清單、每次建置整段重寫。
# 9/21 官網改版後首頁是 Lynch 用 Codex 設計的版面（分類標籤、手寫英文標題、只放三篇），
# 標記也跟著消失，build.py 每次都在這裡失敗。改版的首頁是設計稿，不該被腳本重寫，
# 所以改成「只檢查、不寫入」：列出最新幾篇裡哪些沒出現在首頁，提醒人去決定要不要補。
# 這是提醒不是錯誤，所以不讓建置失敗；但找不到首頁或找不到筆記區塊，代表檢查沒跑起來，
# 那就要大聲失敗——「沒檢查」和「檢查通過」不能長得一樣。
HOME = os.path.join(os.path.dirname(HERE), "index.html")
HOME_SECTION = 'id="journal"'
# 首頁筆記區 = 三張分類大卡（連到 /notes/#分類）＋「最新一篇」清單（最新 2 篇）。
# 這裡檢查：三個分類錨點都在、最新 2 篇都在。
HOME_CHECK = 2


def check_home(latest):
    """latest：[(href, 標題)]，由新到舊。回傳沒出現在首頁筆記區的那幾篇。"""
    if not os.path.exists(HOME):
        raise SystemExit("❌ 找不到首頁 " + HOME + "，首頁檢查沒有執行")
    s = io.open(HOME, encoding="utf-8").read()
    a = s.find(HOME_SECTION)
    if a < 0:
        raise SystemExit("❌ 首頁找不到筆記區塊（" + HOME_SECTION + "），首頁檢查沒有執行")
    b = s.find("</section>", a)
    block = s[a:b if b > 0 else len(s)]
    # 首頁用絕對網址（https://fervela.ai/notes/x.html），posts.json 用站內路徑，比對時去掉網域。
    hrefs = {re.sub(r"^https?://[^/]+", "", h) for h in re.findall(r'href="([^"]+)"', block)}
    missing = [(h, t) for h, t in latest if h not in hrefs]
    for c, n in CATS:
        if "/notes/#" + c not in hrefs:
            missing.append(("/notes/#" + c, "分類大卡：" + n))
    if missing:
        print("⚠️ 首頁筆記區沒有這幾篇（首頁是手排的，要不要補請人決定）：")
        for h, t in missing:
            print("   " + t + "　→　" + h)
    else:
        print("✓ 首頁筆記區已包含三個分類入口與最新 %d 篇" % len(latest))
    return missing


# 手動加的斷行點：句子太長時，在語意交界讓瀏覽器有地方換行（Miles 10/16「我不要一句話被斷句」）。
# 這些是人工補在輸出 html 上的，原稿與 posts.json 沒有，所以重建會蓋掉——每次建置後換回來。
# 只換 <body> 之後，不動 <head> 的 meta 描述（meta 裡放 <wbr> 會變成亂碼）。
WBR = [
    ("讓框從十九中六變成", "讓框從十九中六<wbr>變成"),
    ("去銀行我再去刻一組半手工但不用這麼漂亮的來用吧", "去銀行我再去刻一組<wbr>半手工但不用這麼漂亮的<wbr>來用吧"),
    ("董事會全自動幫我找答案", "董事會<wbr>全自動<wbr>幫我找答案"),   # 標題：手機上一行放不下時在詞的交界換
]


def wordwrap(frag):
    """內文在詞與詞之間插 <wbr>（notes/wbr.mjs，用 Node 內建的中文分詞）。
    沒有 node 就原樣回傳：版面一樣能看，只是長句可能斷在詞中間。"""
    node = shutil.which("node")
    if not node:
        print("⚠ 找不到 node，文章內文沒有插斷詞點")
        return frag
    r = subprocess.run([node, os.path.join(HERE, "wbr.mjs")], input=frag, capture_output=True, text=True)
    if r.returncode != 0:
        print("⚠ wbr.mjs 失敗，文章內文沒有插斷詞點：", r.stderr.strip()[:200])
        return frag
    return r.stdout


def write_html(name, text):
    i = text.find("<body")
    head, rest = text[:i], text[i:]
    for plain, withbr in WBR:
        rest = rest.replace(plain, withbr)
    io.open(os.path.join(HERE, name), "w", encoding="utf-8").write(head + rest)


def main():
    meta = json.load(io.open(META, encoding="utf-8")) if os.path.exists(META) else {}
    # 每一筆要發佈的都必須有 category，漏了就停下
    for key, m in meta.items():
        if m.get("publish", False):
            need_cat(key, m)
    entries = []       # (date, order, 網址, 標題, 摘要, 分類)
    pages = []         # 文章頁先收集，等縮圖與「下一篇」算好再寫
    for fn in sorted(os.listdir(DRAFTS)):
        if not fn.endswith(".md"):
            continue
        slug = re.sub(r'^\d+-', '', fn[:-3])
        m = meta.get(fn, {})
        if not m.get("publish", False):
            print("略過（未標記發佈）：", fn); continue
        title, body = render(io.open(os.path.join(DRAFTS, fn), encoding="utf-8").read())
        date, desc = m.get("date", ""), m.get("desc", "")
        pages.append(dict(slug=slug, title=title, body=body, date=date, desc=desc,
                          order=m.get("order", 0), cat=m["category"]))
        entries.append((date, m.get("order", 0), slug + ".html", title, desc, m["category"]))

    # posts.json 裡帶 "link" 的條目不是文章，是指到站內其他頁的卡片
    # （例如 /courses/ 那種自己一頁、不走這個建置流程的東西）。
    # 它沒有 .md 也不產生 html，只在索引上出現一張卡，需要自己寫 title。
    for key, m in meta.items():
        if not m.get("link") or not m.get("publish", False):
            continue
        entries.append((m.get("date", ""), m.get("order", 0), m["link"], m.get("title", key),
                        m.get("desc", ""), m["category"]))
        print("✓ 外連卡片　—　" + m.get("title", key) + "　→　" + m["link"])

    entries.sort(reverse=True)     # 新的在前（日期，同日看 order）
    thumb_of = {e[2]: THUMBS[i % len(THUMBS)] for i, e in enumerate(entries)}   # 與索引卡片同一套縮圖
    cards = [card(href, t, d, x, c, thumb_of[href])
             for (d, o, href, t, x, c) in entries]
    tabs = "\n".join([tab("all", "全部")] + [tab(c, n) for c, n in CATS])
    write_html("index.html", INDEX.format(tabs=tabs, items="\n".join(cards), valid=json.dumps([c for c, _ in CATS]),
                                         header=HEADER, footer=FOOTER))
    print("✓ index.html（%d 篇）" % len(entries))

    # 文章頁：「下一篇」＝有 .md 的文章依 order 排的下一篇，最後一篇接第一篇
    pages.sort(key=lambda p: p["order"])
    for i, p in enumerate(pages):
        n = pages[(i + 1) % len(pages)]
        write_html(p["slug"] + ".html", PAGE.format(
            title=html.escape(p["title"]), desc=html.escape(p["desc"]), datedot=p["date"].replace("-", "."),
            body=wordwrap(p["body"]), ledehtml=wordwrap(html.escape(p["desc"])), cat=p["cat"], catname=CAT_NAME[p["cat"]],
            nhref=n["slug"] + ".html", nthumb=thumb_of[n["slug"] + ".html"], ntitle=html.escape(n["title"]),
            header=HEADER, footer=FOOTER))
        print("✓", p["slug"] + ".html　—　" + p["title"])

    check_home([("/notes/" + e[2] if not e[2].startswith("/") else e[2], e[3]) for e in entries][:HOME_CHECK])


if __name__ == "__main__":
    main()
