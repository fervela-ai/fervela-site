#!/usr/bin/env python3
"""挑戰小遊戲素材縮圖（太守，10/18）。來源 ~/1-氣噗噗/art/games/素材/（行銷長 GPT 生圖，透明 PNG）。
輸出 web/assets/games/*.webp。Claude 不畫圖，這裡只縮圖與轉檔。用法：cd web/assets && python3 build_game_assets.py"""
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.abspath(os.path.join(HERE, '..', '..', 'art', 'games', '素材'))
OUT = os.path.join(HERE, 'games'); os.makedirs(OUT, exist_ok=True)
SIZE = {  # 最長邊
    'puff-': 512, 'candle-': 256, 'cake-long': 1200, 'star-': 128,
    'soup-': 640, 'boba-': 640, 'tangyuan-': 640, 'noodle-': 640,
    'thermometer': 384, 'note-': 320, 'desk-bg': 2532,
    # 10/19 第二批
    'sock-': 256, 'laundry-bg': 2532, 'basket': 640, 'spotlight': 640, 'lost-found-board': 512,
    'press-conference': 1080, 'alley-bg': 2532, 'truck': 800, 'beat-': 192, 'umbrella': 384,
    'neighbor-cart': 512, 'call-frame': 2532, 'bg-': 900, 'filter-': 512, 'boss-popup': 640,
}
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.png'): continue
    n = next(v for k, v in SIZE.items() if f.startswith(k))
    im = Image.open(os.path.join(SRC, f)); im.thumbnail((n, n * 3), Image.LANCZOS) if f.startswith('candle-') else im.thumbnail((n, n), Image.LANCZOS)
    q = 82 if f in ('desk-bg.png', 'laundry-bg.png', 'alley-bg.png', 'call-frame.png') or f.startswith('bg-') else 88
    im.save(os.path.join(OUT, f[:-4] + '.webp'), 'WEBP', quality=q, method=6)
print(len(os.listdir(OUT)), 'files')
