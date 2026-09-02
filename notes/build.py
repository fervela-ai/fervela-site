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
<div class="wrap">
  <article class="post">
    <h1>{title}</h1>
    <div class="date">{date}　·　Miles 邁爾思</div>
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
<div class="wrap">
  <div class="sec" style="margin-top:34px">
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
