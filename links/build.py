#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""用 links.json 重建 links/index.html 的清單區（只換 LINKS:START/END 之間）。
用法：在 links 資料夾跑 python3 build.py（不需要任何套件）。"""
import json, os, html
H = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(H, "links.json"), encoding="utf-8"))
e = html.escape
def tgt(i): return ' target="_blank" rel="noopener"' if i.get("external") else ""
def more_item(i):
    img = f'<img src="{e(i["img"])}" alt="" width="200" height="130">' if i.get("img") else ""
    cls = ' class="plain"' if i.get("plain") else ""
    tag = f'<span class="tag">{e(i["tag"])}</span>' if i.get("tag") else ""
    return (f'    <a{cls} href="{e(i["href"])}"{tgt(i)}>{img}<div><b>{tag}{e(i["name"])}</b>'
            f'<small>{e(i["desc"])}</small></div><span class="chev"></span></a>')
def row(i):
    return (f'    <a class="row" href="{e(i["href"])}"{tgt(i)}><img src="{e(i["icon"])}" alt="" width="60" height="60">'
            f'<div><b>{e(i["name"])}</b><small>{e(i["desc"])}</small></div><span class="chev"></span></a>')
h = d["hero"]
out = []
la = d.get("latest")
if la and la["items"]:
    out += [f'  <h2 class="label">{e(la["title"])}</h2>', '  <div class="more">'] + [more_item(i) for i in la["items"]] + ['  </div>', '']
out += [f'  <h2 class="label">{e(h["title"])}</h2>',
 f'  <a class="hero" href="{e(h["href"])}">', '    <div class="hero-top">',
 f'      <div><img class="ic" src="{e(h["icon"])}" alt="" width="72" height="72"><b>{e(h["name"])}</b><small>{e(h["tagline"])}</small></div>',
 f'      <img class="ph" src="{e(h["photo"])}" alt="" width="300" height="225">', '    </div>',
 f'    <p>{e(h["desc"])}</p>', f'    <span class="go">{e(h["button"])}</span>', f'    <div class="sub">{e(h["note"])}</div>', '  </a>', '',
 f'  <h2 class="label">{e(d["works"]["title"])}</h2>', '  <nav class="list" aria-label="Fervela.ai 的作品">']
out += [row(i) for i in d["works"]["items"]] + ['  </nav>', '', f'  <h2 class="label">{e(d["more"]["title"])}</h2>', '  <div class="more">']
out += [more_item(i) for i in d["more"]["items"]] + ['  </div>']
p = os.path.join(H, "index.html")
s = open(p, encoding="utf-8").read()
a = s.index("<!--LINKS:START-->") + len("<!--LINKS:START-->")
b = s.index("<!--LINKS:END-->")
s = s[:a] + "\n" + "\n".join(out) + "\n  " + s[b:]
open(p, "w", encoding="utf-8").write(s)
print("links/index.html 已更新")
