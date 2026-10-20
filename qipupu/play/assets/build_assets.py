#!/usr/bin/env python3
"""氣噗噗 0.2 素材建置腳本（太守，10/17）。

用法：cd ~/1-氣噗噗/web/assets && python3 build_assets.py
來源：~/1-氣噗噗/art/（行銷長 GPT 生圖）。輸出：同一個資料夾（web/assets/）。
規矩：Claude 不畫圖。這裡只做「縮圖」與「從視覺稿裁切」。
換正式素材：把正式檔放進 art/，重跑一次即可——
  - art/cat-*.png（8 張類別圖示：meeting boss traffic chores kid partner client misc）有就用正式檔，沒有才從視覺稿裁。
  - art/bg-ocean.png 有就用正式檔當首頁海底背景，沒有才從視覺稿裁。
  - art/puff-*、form-*、stamp.png、frame.png 直接縮圖。
目前還缺的正式檔（先用視覺稿裁切暫代）：麥克風小圖示 icon-mic。（cat-*.png、bg-ocean.png 10/17 已交，現用正式檔。）
純 Python＋PIL，不需要 numpy。
"""
import os
from PIL import Image, ImageFilter, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.abspath(os.path.join(HERE, '..', '..', 'art'))
SHOT = os.path.join(ART, '視覺稿')
OUT = HERE
SC = 1170 / 924  # 視覺稿預覽座標（寬 924）換成原圖座標（寬 1170）


def art(name):
    return os.path.join(ART, name)


# ---------- 1. 河豚、形態豚、印章、證明書底圖：一次縮到目標尺寸 ----------
PUFFS = {
    'puff-normal.png': 'puff-1-normal.png',
    'puff-medium.png': 'puff-1b-medium.png',
    'puff-angry.png': 'puff-2-angry.png',
    'puff-deflating.png': 'puff-3-deflating.png',
    'puff-hiccup.png': 'puff-4-hiccup.png',
    'puff-relaxed.png': 'puff-5-relaxed.png',
    'form-meeting.png': 'form-meeting.png',
    'form-traffic.png': 'form-traffic.png',
    'form-chores.png': 'form-chores.png',
}
for dst, srcname in PUFFS.items():
    im = Image.open(art(srcname)).convert('RGBA').resize((512, 512), Image.LANCZOS)
    im.save(os.path.join(OUT, dst), optimize=True)
# 滑桿拇指用的小河豚（128 方）
Image.open(art('puff-1-normal.png')).convert('RGBA').resize((128, 128), Image.LANCZOS).save(os.path.join(OUT, 'thumb-puff.png'), optimize=True)
Image.open(art('stamp.png')).convert('RGBA').resize((400, 400), Image.LANCZOS).save(os.path.join(OUT, 'stamp.png'), optimize=True)
Image.open(art('frame.png')).convert('RGB').save(os.path.join(OUT, 'frame.jpg'), quality=88, optimize=True)


# ---------- 2. 從視覺稿裁切的工具 ----------
def shot(n):
    return Image.open(os.path.join(SHOT, n)).convert('RGB')


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def key_out(img, lo=16, hi=44):
    """把四周底色（取邊緣像素中位數）轉成透明，邊緣用距離做柔邊。"""
    img = img.convert('RGB')
    w, h = img.size
    px = img.load()
    border = [px[x, y] for x in range(w) for y in (0, h - 1)] + [px[x, y] for y in range(h) for x in (0, w - 1)]
    bg = tuple(sorted(c[i] for c in border)[len(border) // 2] for i in range(3))
    out = Image.new('RGBA', (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            d = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
            op[x, y] = (r, g, b, int(255 * smooth((d - lo) / (hi - lo))))
    return out


def ramp(n, fade, rev=False):
    px = [min(255, int(255 * i / max(1, fade))) for i in range(n)]
    return px[::-1] if rev else px


def fade_mask(w, h, l=0, r=0, t=0, b=0):
    """四邊各自淡出若干像素的遮罩。"""
    m = Image.new('L', (w, h), 255)
    for amount, size, rev, vertical in ((l, w, False, False), (r, w, True, False), (t, h, False, True), (b, h, True, True)):
        if not amount:
            continue
        g = Image.new('L', (1, size) if vertical else (size, 1))
        g.putdata(ramp(size, amount, rev))
        m = ImageChops.multiply(m, g.resize((w, h)))
    return m


class Layered:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.img = Image.new('RGBA', (w, h), (0, 0, 0, 0))

    def add(self, piece, xy, mask):
        layer = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        p = piece.convert('RGBA')
        p.putalpha(mask)
        layer.paste(p, xy)
        self.img = Image.alpha_composite(self.img, layer)

    def sand(self, src, y0, y1, left_x, right_x, top, fade=30):
        """沙地：取左右各一條，拉寬後橫向混合，中間不會有魚或字。"""
        a = src.crop((left_x[0], y0, left_x[1], y1)).resize((self.w, y1 - y0), Image.BICUBIC).filter(ImageFilter.GaussianBlur(6))
        b = src.crop((right_x[0], y0, right_x[1], y1)).resize((self.w, y1 - y0), Image.BICUBIC).filter(ImageFilter.GaussianBlur(6))
        hm = Image.new('L', (self.w, 1))
        hm.putdata([int(255 * i / (self.w - 1)) for i in range(self.w)])
        mixed = Image.composite(b, a, hm.resize((self.w, y1 - y0)))
        self.add(mixed, (0, top), fade_mask(self.w, y1 - y0, t=fade, b=fade))

    def side(self, src, box, dest_x, dest_y, **fade):
        piece = src.crop(box)
        self.add(piece, (dest_x, dest_y), fade_mask(piece.width, piece.height, **fade))

    def save(self, name, width=750):
        h = round(self.h * width / self.w)
        im = self.img.resize((width, h), Image.LANCZOS)
        im.save(os.path.join(OUT, name), quality=86, method=6)


s1, s2 = shot('screen-1-home.png'), shot('screen-2-blow.png')

# ---------- 3. 背景（webp，全頁，寬 750） ----------
# 正式檔 art/bg-ocean.png（1170×2532 乾淨海底，中間留白）有就直接縮圖；沒有才從視覺稿 screen-1 裁左右珊瑚與沙地湊一張。
if os.path.exists(art('bg-ocean.png')):
    Image.open(art('bg-ocean.png')).convert('RGB').resize((750, 1624), Image.LANCZOS).save(os.path.join(OUT, 'bg-ocean.webp'), quality=82, method=6)
else:
    L = Layered(1170, 2532)
    L.sand(s1, 878, 936, (0, 170), (1000, 1170), top=1500)
    L.side(s1, (0, 330, 230, 940), 0, 1000, r=110, t=120, b=40)
    L.side(s1, (940, 330, 1170, 940), 940, 1000, l=110, t=120, b=40)
    bg = Image.new('RGB', (1170, 2532), (253, 246, 237))
    bg.paste(L.img, (0, 0), L.img)
    bg.resize((750, 1624), Image.LANCZOS).save(os.path.join(OUT, 'bg-ocean.webp'), quality=82, method=6)

# ---------- 4. 類別圖示（8 個）與麥克風小圖示 ----------
# 中心點（視覺稿預覽座標）。開會那顆在橘色按鈕上，不去背，裁成圓形小章。
ALIAS = {'child': 'kid', 'customer': 'client', 'other': 'misc'}
CATS = {
    'meeting': (156, 862), 'boss': (605, 862), 'traffic': (168, 1022), 'chores': (597, 1022),
    'child': (168, 1180), 'partner': (602, 1182), 'customer': (166, 1336), 'other': (602, 1337),
}
for cid, (cx, cy) in CATS.items():
    dest = os.path.join(OUT, f'cat-{cid}.png')
    official = [art(f'cat-{name}.png') for name in (cid, ALIAS.get(cid, cid))]  # 行銷長的檔名：kid／client／misc
    official = [f for f in official if os.path.exists(f)]
    if official:
        Image.open(official[0]).convert('RGBA').resize((128, 128), Image.LANCZOS).save(dest, optimize=True)
        continue
    half = 60 * SC
    crop = s1.crop((round(cx * SC - half), round(cy * SC - half), round(cx * SC + half), round(cy * SC + half))).resize((160, 160), Image.LANCZOS)
    if cid == 'meeting':
        mask = Image.new('L', (160 * 4, 160 * 4), 0)
        from PIL import ImageDraw
        ImageDraw.Draw(mask).ellipse((0, 0, 160 * 4 - 1, 160 * 4 - 1), fill=255)
        crop = crop.convert('RGBA')
        crop.putalpha(mask.resize((160, 160), Image.LANCZOS))
        crop.save(dest, optimize=True)
    else:
        key_out(crop).save(dest, optimize=True)

mic = s2.crop((round(782 * SC - 40 * SC), round(1585 * SC - 48 * SC), round(782 * SC + 40 * SC), round(1585 * SC + 48 * SC)))
key_out(mic.resize((mic.width, mic.height)), lo=14, hi=40).resize((60, 72), Image.LANCZOS).save(os.path.join(OUT, 'icon-mic.png'), optimize=True)

total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs)
print(f'web/assets 合計 {total / 1024:.0f} KB')
