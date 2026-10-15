#!/usr/bin/env python3
"""把 V5_SRC 資料夾的 8 張照片轉成網頁用檔（hero 2000 寬、其餘 1200 寬、JPEG 82＋webp）。"""
import os,sys
from PIL import Image
src=os.environ.get('V5_SRC')
if not src:sys.exit('請設定環境變數 V5_SRC 指向照片來源資料夾')
out=os.path.dirname(os.path.abspath(__file__))
names=['hero','step1','step2','step3','note1','note2','note3','footer']
done=0
for n in names:
    p=None
    for ext in ('jpg','jpeg','png','webp'):
        c=os.path.join(src,f'{n}.{ext}')
        if os.path.exists(c):p=c;break
    if not p:print('缺',n);continue
    im=Image.open(p).convert('RGB');w=2000 if n in('hero','footer') else 1200
    if im.width>w:im=im.resize((w,round(im.height*w/im.width)),Image.LANCZOS)
    im.save(f'{out}/{n}.jpg',quality=82,optimize=True,progressive=True);im.save(f'{out}/{n}.webp',quality=82,method=6)
    print('ok',n,im.size);done+=1
print(f'{done}/8');sys.exit(0 if done==8 else 1)
