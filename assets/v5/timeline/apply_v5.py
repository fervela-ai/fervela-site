#!/usr/bin/env python3
"""通鑑 /timeline/ 套 V5「暖白、有人味」外殼（10/15）。

為什麼是後處理而不是改模板：timeline/index.html 由 ~/1-通鑑/site/build.py 產生、
每天由通鑑的流程覆蓋。這支只在產物上「加」東西，不改任何既有 id／class／data 屬性、
資料、搜尋篩選 JS、統計碼與法遵文字：
  1. <head> 尾端加字型連結、/assets/v5/timeline/timeline-v5.css、/assets/v5/v5.js（手機選單）
  2. 舊 <header id="top"> 換成站台導覽＋橫幅（大標與說明文字從原 header 取，不改字）
  3. 「今天最重要的一則」「探索更多重要時刻」兩個區塊標題；大卡內加一張暖光桌面照
  4. 把「找不到」區塊裡的熱門公司按鈕複製一份到篩選列（同 class company-chip，原 JS 自動接上）
  5. 頁尾前加暖光照片條，頁尾開頭加品牌列；原頁尾文字一字不動

用法（每次通鑑產生新的 timeline/index.html 之後跑一次；已套過會自動略過）：
  python3 assets/v5/timeline/apply_v5.py timeline/index.html
找不到預期的錨點就報錯停下，不會靜默產出半套的頁面。
"""
import re
import sys

MARK = '<!-- v5-timeline 外殼（assets/v5/timeline/apply_v5.py） -->'

HEAD_ADD = (
    MARK + '\n'
    '<meta name="theme-color" content="#faf6ef">\n'
    '<link rel="stylesheet" href="/assets/v5/timeline/timeline-v5.css">\n'
    '<script src="/assets/v5/v5.js" defer></script>\n'
)

NAV = (
    '<a class="v5-skip" href="#list">跳至內容</a>\n'
    '<header class="v5-header" id="top"><div class="v5-header-in">'
    '<a class="v5-brand" href="/" aria-label="Fervela.ai 首頁"><img class="v5-logo" src="/assets/logo-a.svg" width="34" height="34" alt=""><span>Fervela.ai</span></a>'
    '<button class="menu" aria-label="開啟選單" aria-expanded="false" aria-controls="nav"><span></span><span></span><span></span></button>'
    '<nav id="nav" aria-label="主選單"><ul><li><a href="/#work">作品</a></li><li><a href="/#journal">實踐筆記</a></li>'
    '<li><a href="mailto:contact@fervela.ai">聊聊你的想法</a></li></ul></nav></div></header>\n'
)

HERO = (
    '<section class="v5-tl-hero"><img src="/assets/v5/footer.webp" alt="" width="2000" height="533" fetchpriority="high">'
    '<div class="v5-tl-hero-in"><img class="v5-tl-icon" src="/assets/v5/icons/timeline.webp" alt="" width="190" height="190">'
    '<h1>{h1}</h1><p>{p}</p></div></section>\n'
)

HEAD_PHOTO = '<span class="v5-head-ph" aria-hidden="true"><img src="/assets/v5/step1.webp" alt="" width="1200" height="900"></span>'

FOOT_PHOTO = '<div class="v5-tl-foot" aria-hidden="true"><img src="/assets/v5/note1.webp" alt="" width="1200" height="900" loading="lazy"></div>\n'

FOOT_BRAND = (
    '<div class="v5-foot-in"><a class="v5-brand" href="/" aria-label="Fervela.ai 首頁"><img class="v5-logo" src="/assets/logo-a.svg" width="34" height="34" alt="" loading="lazy"><span>Fervela.ai</span></a>'
    '<div class="v5-flinks"><a href="/#work">作品</a><a href="/#journal">實踐筆記</a><a href="mailto:contact@fervela.ai">聊聊你的想法</a></div></div>'
)


def sub_once(pattern, repl, s, what, flags=re.S):
    new, n = re.subn(pattern, repl, s, count=1, flags=flags)
    if n != 1:
        sys.exit(f'apply_v5：找不到「{what}」，停下（通鑑的版面可能改過，請對照後再套）')
    return new


def apply(s):
    if MARK in s:
        return s, False
    # 1. head
    s = sub_once(r'</head>', lambda m: HEAD_ADD + '</head>', s, '</head>')
    # 2. header → 站台導覽＋橫幅
    m = re.search(r'<header id="top">\s*<div class="brand">[^<]*</div>\s*<h1>(.*?)</h1>\s*<p>(.*?)</p>\s*</header>\n?', s, re.S)
    if not m:
        sys.exit('apply_v5：找不到原本的 <header id="top">，停下')
    s = s[:m.start()] + NAV + HERO.format(h1=m.group(1), p=m.group(2)) + s[m.end():]
    # 3a. 今天最重要的一則
    i = s.find('<a class="headline')
    if i < 0:
        sys.exit('apply_v5：找不到 .headline，停下')
    j = s.find('</a>', i)
    s = s[:i] + '<h2 class="v5-h2">今天最重要的一則</h2>\n  ' + s[i:j] + HEAD_PHOTO + s[j:]
    # 3b. 探索更多重要時刻
    s = sub_once(r'<div class="year">', lambda m: '<h2 class="v5-h2">探索更多重要時刻</h2>\n  ' + m.group(0), s, '.year')
    # 4. 熱門公司按鈕（從「找不到」區塊複製，同 class，原 JS 會自動綁定）
    none = re.search(r'<section id="none".*?</section>', s, re.S)
    chips = re.findall(r'<button type="button" class="company-chip" data-company="[^"]*">[^<]*</button>', none.group(0) if none else '')
    if not chips:
        sys.exit('apply_v5：找不到熱門公司按鈕，停下')
    row = ''.join(chips)
    s = sub_once(r'<span id="qn"', lambda m: '<span class="v5-companies v5-companies--bar" role="group" aria-label="熱門公司">' + row + '</span>' + m.group(0), s, '#qn')
    k = s.find('</nav>', s.find('<nav class="months"'))
    if k < 0:
        sys.exit('apply_v5：找不到篩選列結尾，停下')
    k += len('</nav>')
    s = s[:k] + '<div class="v5-companies v5-companies--below" role="group" aria-label="熱門公司">' + row + '</div>' + s[k:]
    # 5. 頁尾
    s = sub_once(r'<footer>', lambda m: FOOT_PHOTO + '<footer>' + FOOT_BRAND, s, '<footer>')
    return s, True


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else 'timeline/index.html'
    s = open(path, encoding='utf-8').read()
    out, changed = apply(s)
    if not changed:
        print('apply_v5：已套過，略過')
        return
    open(path, 'w', encoding='utf-8').write(out)
    print(f'apply_v5：已套用 → {path}（{len(s.encode())} → {len(out.encode())} 位元組）')


if __name__ == '__main__':
    main()
