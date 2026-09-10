#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 _drafts/ 的 Markdown 轉成 notes/ 的網頁，並更新筆記索引。

⚠️ 刻意不用任何第三方套件（沒有 markdown 函式庫、沒有靜態網站產生器）。
   這個站的其他部分也是零相依，多一個工具鏈就多一個會壞掉的環節，
   而且改一篇文章不該需要先修好建置環境。

   支援的語法只有這幾種，夠寫文章就好：
     # 標題 / ## 小標 / > 引言 / **粗體** / *斜體* / [文字](網址) / --- 分隔

用法：
    python3 build.py            重建全部文章與索引
"""
import io, os, re, html, json

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
        if l.strip() == "---":
            flush(); continue
        buf.append(l.strip())
    flush(); flushq()
    return title, "\n".join(out)


PAGE = '''<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}｜Miles 邁爾思</title>
<meta name="description" content="{desc}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="article">
<link rel="stylesheet" href="style.css">
</head>
<body data-lang="zh">
<div class="topbar"><div class="wrap">
    <a class="brand" href="/"><span class="tmark"><svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" rx="26" fill="#ffffff"/><g color="#008B8B" transform="translate(6 6) scale(0.9)"><g transform="translate(2 14) scale(.88)">
      <path d="M60 8C34 10 14 30 13 55c-2 28 18 50 48 54 21 3 41-8 48-27-7 11-22 18-39 17-28-1-45-19-44-42 1-23 15-41 34-49Z" fill="currentColor"/>
      <path d="m66 31-30 54 27-7 3-47Z" fill="currentColor"/>
      <path d="m71 31 0 50 16-8Z" fill="currentColor" opacity=".9"/>
      <path d="M69 27v56" stroke="currentColor" stroke-width="1.25"/>
      <path d="M29 82c12 8 25 11 39 10-12 4-28 2-41-5l2-5Z" fill="currentColor"/>
      <path d="M78 70c5-5 12-3 13 3 5-5 13-1 12 6 5-1 8 3 7 8-1 7-8 11-16 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M27 84c19 10 43 13 65 6 7-2 12-6 16-12-2 8-8 14-17 18-19 8-45 6-59-3-3-2-5-6-5-9Z" fill="#fff" opacity=".94"/>
      <path d="M25 87c20 10 45 13 67 5 7-2 12-6 16-11-3 8-9 14-18 18-19 7-44 5-58-4-4-2-6-5-7-8Z" fill="currentColor"/>
      <path d="M31 88c18 7 39 8 56 2-14 9-38 10-56 2Z" fill="#fff" opacity=".92"/>
      <path d="M20 85c14 4 27 3 39-2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </g>
      <path d="m84 7 2.6 8.4L95 18l-8.4 2.6L84 29l-2.6-8.4L73 18l8.4-2.6L84 7Z" fill="#F5A623"/></g></svg></span><span class="tname">Miles 邁爾思</span></a>
    <a class="tlink" href="/notes/">筆記</a>
  </div></div>
<div class="wrap">
  <article class="post">
    <h1>{title}</h1>
    <div class="date">{date}　·　Miles 邁爾思</div>
    <p class="lede">{desc}</p>
    {body}
  </article>
  <a class="back" href="/">← 回首頁</a>
  <footer>
    <div>問題回報與合作洽詢：<a href="mailto:contact@fervela.ai">contact@fervela.ai</a></div>
    <div class="fnote">作品以 <b>Fervela.ai</b> 為名發佈。© 2026 Fervela.ai</div>
  </footer>
</div>
</body>
</html>
'''

INDEX = '''<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>筆記｜Miles 邁爾思</title>
<meta name="description" content="實作過程的紀錄——怎麼做、為什麼那樣選、哪裡踩坑，以及事後回頭看哪些判斷是錯的。">
<link rel="stylesheet" href="style.css">
</head>
<body data-lang="zh">
<div class="topbar"><div class="wrap">
    <a class="brand" href="/"><span class="tmark"><svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" rx="26" fill="#ffffff"/><g color="#008B8B" transform="translate(6 6) scale(0.9)"><g transform="translate(2 14) scale(.88)">
      <path d="M60 8C34 10 14 30 13 55c-2 28 18 50 48 54 21 3 41-8 48-27-7 11-22 18-39 17-28-1-45-19-44-42 1-23 15-41 34-49Z" fill="currentColor"/>
      <path d="m66 31-30 54 27-7 3-47Z" fill="currentColor"/>
      <path d="m71 31 0 50 16-8Z" fill="currentColor" opacity=".9"/>
      <path d="M69 27v56" stroke="currentColor" stroke-width="1.25"/>
      <path d="M29 82c12 8 25 11 39 10-12 4-28 2-41-5l2-5Z" fill="currentColor"/>
      <path d="M78 70c5-5 12-3 13 3 5-5 13-1 12 6 5-1 8 3 7 8-1 7-8 11-16 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M27 84c19 10 43 13 65 6 7-2 12-6 16-12-2 8-8 14-17 18-19 8-45 6-59-3-3-2-5-6-5-9Z" fill="#fff" opacity=".94"/>
      <path d="M25 87c20 10 45 13 67 5 7-2 12-6 16-11-3 8-9 14-18 18-19 7-44 5-58-4-4-2-6-5-7-8Z" fill="currentColor"/>
      <path d="M31 88c18 7 39 8 56 2-14 9-38 10-56 2Z" fill="#fff" opacity=".92"/>
      <path d="M20 85c14 4 27 3 39-2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </g>
      <path d="m84 7 2.6 8.4L95 18l-8.4 2.6L84 29l-2.6-8.4L73 18l8.4-2.6L84 7Z" fill="#F5A623"/></g></svg></span><span class="tname">Miles 邁爾思</span></a>
    <a class="tlink" href="/notes/">筆記</a>
  </div></div>
<div class="wrap">
  <div class="sec" style="margin-top:30px">
    <div class="sech">筆記</div>
{items}
  </div>
  <a class="back" href="/">← 回首頁</a>
  <footer>
    <div>問題回報與合作洽詢：<a href="mailto:contact@fervela.ai">contact@fervela.ai</a></div>
    <div class="fnote">作品以 <b>Fervela.ai</b> 為名發佈。© 2026 Fervela.ai</div>
  </footer>
</div>
</body>
</html>
'''

def card(href, title, date, desc):
    """索引上的一張卡。文章與外連卡片共用同一個樣子。"""
    return '''    <div class="card">
      <h2><a href="{h}" style="color:inherit;text-decoration:none">{t}</a></h2>
      <div class="pinfo">{d}</div>
      <p>{x}</p>
    </div>'''.format(h=html.escape(href), t=html.escape(title),
                     d=html.escape(date), x=html.escape(desc))


# ── 首頁的筆記清單 ────────────────────────────────────────────
# 為什麼要有這一段：首頁的清單原本是手寫的，跟 posts.json 沒有關係，
# 所以新增條目只會出現在 /notes/，首頁得有人記得手動補——實際漏過一次
# （2026-09-11 的課程地圖，Lynch 自己發現的）。
# 現在用標記把那個區塊圈起來，每次建置重寫，兩邊不會再走鐘。
HOME = os.path.join(os.path.dirname(HERE), "index.html")
MARK_A = "<!-- notelist:start 由 notes/build.py 產生，不要手改 -->"
MARK_B = "<!-- notelist:end -->"


def home_row(href, title_zh, title_en, date):
    """首頁那一列：只有標題和日期，沒有摘要。中英雙語。"""
    return ('      <a class="noteitem" href="{h}">\n'
            '        <span class="ntitle"><span class="zh">{z}</span>'
            '<span class="en">{e}</span></span>\n'
            '        <span class="ndate">{d}</span>\n'
            '      </a>').format(h=html.escape(href), z=html.escape(title_zh),
                                 e=html.escape(title_en), d=html.escape(date))


def write_home(rows):
    """把首頁標記之間的內容換掉。找不到標記就大聲失敗，不要安靜略過——
       安靜略過的話首頁會停在舊版而沒有任何提示（出貨驗證那一族的老問題）。"""
    if not os.path.exists(HOME):
        raise SystemExit("❌ 找不到首頁 " + HOME)
    s = io.open(HOME, encoding="utf-8").read()
    a, b = s.find(MARK_A), s.find(MARK_B)
    if a < 0 or b < 0 or b < a:
        raise SystemExit("❌ 首頁找不到 notelist 標記，請確認 index.html 有這兩行：\n"
                         "   " + MARK_A + "\n   " + MARK_B)
    before, after = s[:a + len(MARK_A)], s[b:]
    out = before + "\n" + "\n".join(rows) + "\n    " + after
    # 寫回去之前做個粗略的完整性檢查：標記外的內容不該憑空變少。
    if len(out) < len(s) - sum(len(r) for r in rows) - 4000:
        raise SystemExit("❌ 產出的首頁比原本短太多，中止")
    io.open(HOME, "w", encoding="utf-8").write(out)
    print("✓ 首頁筆記清單（%d 列）" % len(rows))


def main():
    meta = json.load(io.open(META, encoding="utf-8")) if os.path.exists(META) else {}
    items = []
    rows = []          # 首頁那份清單
    for fn in sorted(os.listdir(DRAFTS)):
        if not fn.endswith(".md"):
            continue
        slug = re.sub(r'^\d+-', '', fn[:-3])
        m = meta.get(fn, {})
        if not m.get("publish", False):
            print("略過（未標記發佈）：", fn); continue
        title, body = render(io.open(os.path.join(DRAFTS, fn), encoding="utf-8").read())
        date, desc = m.get("date", ""), m.get("desc", "")
        io.open(os.path.join(HERE, slug + ".html"), "w", encoding="utf-8").write(
            PAGE.format(title=html.escape(title), desc=html.escape(desc), date=date, body=body))
        print("✓", slug + ".html　—　" + title)
        items.append((m.get("order", 0), card(slug + ".html", title, date, desc)))
        rows.append((m.get("order", 0),
                     home_row("/notes/" + slug + ".html", title,
                              m.get("title_en") or title, date)))

    # posts.json 裡帶 "link" 的條目不是文章，是指到站內其他頁的卡片
    # （例如 /courses/ 那種自己一頁、不走這個建置流程的東西）。
    # 它沒有 .md 也不產生 html，只在索引上出現一張卡，需要自己寫 title。
    for key, m in meta.items():
        if not m.get("link") or not m.get("publish", False):
            continue
        items.append((m.get("order", 0),
                      card(m["link"], m.get("title", key), m.get("date", ""), m.get("desc", ""))))
        rows.append((m.get("order", 0),
                     home_row(m["link"], m.get("title", key),
                              m.get("title_en") or m.get("title", key), m.get("date", ""))))
        print("✓ 外連卡片　—　" + m.get("title", key) + "　→　" + m["link"])

    items.sort(reverse=True)
    io.open(os.path.join(HERE, "index.html"), "w", encoding="utf-8").write(
        INDEX.format(items="\n".join(x[1] for x in items)))
    print("✓ index.html（%d 篇）" % len(items))

    rows.sort(reverse=True)
    write_home([r[1] for r in rows])


if __name__ == "__main__":
    main()
