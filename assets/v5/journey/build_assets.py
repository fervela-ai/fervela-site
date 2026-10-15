#!/usr/bin/env python3
"""飛鴻頁照片轉網頁用檔。用法：JOURNEY_SRC=<照片來源資料夾> python3 build_assets.py
hero／footer 2000 寬、step 1200 寬（JPEG 82＋webp）、goose 512 寬（png＋webp）、card 由 hero 裁 4:3。"""
import os,sys
from PIL import Image
src=os.environ.get('JOURNEY_SRC')
if not src:sys.exit('請設定環境變數 JOURNEY_SRC 指向照片來源資料夾')
out=os.path.dirname(os.path.abspath(__file__))
def rs(im,w):
    return im.resize((w,round(im.height*w/im.width)),Image.LANCZOS) if im.width>w else im
def save(im,n):
    im.save(f'{out}/{n}.jpg',quality=82,optimize=True,progressive=True);im.save(f'{out}/{n}.webp',quality=82,method=6);print('ok',n,im.size)
for n,w in [('hero',2000),('footer',2000),('step1',1200),('step2',1200),('step3',1200)]:
    p=os.path.join(src,n+'.jpg')
    if n=='hero' and os.path.exists(os.path.join(src,'hero_phone.jpg')): p=os.path.join(src,'hero_phone.jpg')
    if not os.path.exists(p):print('缺',n);continue
    save(rs(Image.open(p).convert('RGB'),w),n)
p=os.path.join(src,'goose_去背.png')
g=rs(Image.open(p).convert('RGBA'),512)
g.save(f'{out}/goose.png',optimize=True);g.save(f'{out}/goose.webp',quality=85,method=6);print('ok goose',g.size)
hp=os.path.join(src,'hero_phone.jpg')  # compose_phone.py 合成真實 App 畫面後的版本
h=Image.open(hp if os.path.exists(hp) else os.path.join(src,'hero.jpg')).convert('RGB')  # 3000x1300
box=(1080,0,1080+1733,1300)  # 4:3，含手機與山海
c=h.crop(box).resize((900,675),Image.LANCZOS);save(c,'card')
