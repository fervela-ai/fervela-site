"""把真實 App 截圖合成進 hero 照片裡的手機空白螢幕（透視貼合＋圓角），輸出 hero_phone.jpg。
用法：JOURNEY_SRC=<素材資料夾> python3 compose_phone.py   （素材資料夾含 hero.jpg；截圖用本 repo 的 journey/shots/00-home.jpg）"""
import os
from PIL import Image, ImageDraw, ImageFilter
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..','..'))
src=os.environ['JOURNEY_SRC']
hero=Image.open(os.path.join(src,'hero.jpg')).convert('RGB')        # 3000x1300
shot=Image.open(os.path.join(ROOT,'journey','shots','00-home.jpg')).convert('RGB')
# 螢幕四角（hero 3000 寬座標，量測自空白螢幕邊緣，向內縮 3px）：左上、右上、右下、左下
Q=[(2061,116),(2476,90),(2540,972),(2113,992)]
sw,sh=shot.size; ratio=((Q[3][1]-Q[0][1]+Q[2][1]-Q[1][1])/2)/((Q[1][0]-Q[0][0]+Q[2][0]-Q[3][0])/2)
crop_h=min(sh,round(sw*ratio)); shot=shot.crop((0,0,sw,crop_h)); sw,sh=shot.size
def solve(A,b):
    n=len(b); M=[row[:]+[b[i]] for i,row in enumerate(A)]
    for c in range(n):
        p=max(range(c,n),key=lambda r:abs(M[r][c])); M[c],M[p]=M[p],M[c]
        for r in range(n):
            if r!=c:
                f=M[r][c]/M[c][c]; M[r]=[a-f*bb for a,bb in zip(M[r],M[c])]
    return [M[i][n]/M[i][i] for i in range(n)]
# 目的四角 → 來源四角（PIL 的 PERSPECTIVE 是由輸出座標找輸入座標）
S=[(0,0),(sw,0),(sw,sh),(0,sh)]; A=[];b=[]
for (x,y),(u,v) in zip(Q,S):
    A.append([x,y,1,0,0,0,-u*x,-u*y]); b.append(u)
    A.append([0,0,0,x,y,1,-v*x,-v*y]); b.append(v)
co=solve(A,b)
W,H=hero.size
warp=shot.transform((W,H),Image.PERSPECTIVE,co,Image.BICUBIC)
m=Image.new('L',(sw,sh),0); r=int(sw*0.075); ImageDraw.Draw(m).rounded_rectangle((0,0,sw-1,sh-1),r,fill=255)
mask=m.transform((W,H),Image.PERSPECTIVE,co,Image.BICUBIC).filter(ImageFilter.GaussianBlur(0.8))
out=hero.copy(); out.paste(warp,(0,0),mask)
dst=os.path.join(src,'hero_phone.jpg'); out.save(dst,quality=92); print(dst)
