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
    <div>問題回報與合作洽詢：<a href="mailto:lynchwu99@gmail.com">lynchwu99@gmail.com</a></div>
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
    <div>問題回報與合作洽詢：<a href="mailto:lynchwu99@gmail.com">lynchwu99@gmail.com</a></div>
    <div class="fnote">作品以 <b>Fervela.ai</b> 為名發佈。© 2026 Fervela.ai</div>
  </footer>
</div>
</body>
</html>
'''

def main():
    meta = json.load(io.open(META, encoding="utf-8")) if os.path.exists(META) else {}
    items = []
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
        items.append((m.get("order", 0), '''    <div class="card">
      <h2><a href="{s}.html" style="color:inherit;text-decoration:none">{t}</a></h2>
      <div class="pinfo">{d}</div>
      <p>{x}</p>
    </div>'''.format(s=slug, t=html.escape(title), d=date, x=html.escape(desc))))
    items.sort(reverse=True)
    io.open(os.path.join(HERE, "index.html"), "w", encoding="utf-8").write(
        INDEX.format(items="\n".join(x[1] for x in items)))
    print("✓ index.html（%d 篇）" % len(items))


if __name__ == "__main__":
    main()
