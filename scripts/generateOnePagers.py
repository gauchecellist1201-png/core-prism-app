#!/usr/bin/env python3
# ============================================================
# CORE 4プロダクト 価格×できること ペラ1 (縦長 1200x1680)
# corp サイトのロゴ/カラーに統一。日本語は Hiragino で確実描画。
# 出力: ~/Desktop/CORE 営業資料/CORE_<Name>_料金ペラ_2026-06-10.png
# ============================================================
import math, os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.expanduser('~/Desktop/CORE 営業資料')
W, H = 1200, 1680
SS = 4

F_MIN = '/System/Library/Fonts/ヒラギノ明朝 ProN.ttc'
F_W7  = '/System/Library/Fonts/ヒラギノ角ゴシック W7.ttc'
F_W6  = '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc'
F_W3  = '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'

def F(p, s): return ImageFont.truetype(p, s)
def hx(h):
    h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def lerp(a,b,t): return tuple(round(a[i]+(b[i]-a[i])*t) for i in range(3))

INK=(245,247,250); DIM=(174,180,194); FAINT=(110,118,134)
BG_TOP=hx('#0a0e1a'); BG_BOT=hx('#05060c')

# ── マーク (corp ロゴ準拠、SS で描いて縮小) ──
def _canvas(size):
    s=size*SS; img=Image.new('RGBA',(s,s),(0,0,0,0)); return img, ImageDraw.Draw(img), s, s/100.0

def m_prism(size, grad):
    img,d,s,k=_canvas(size)
    # 多面体プリズム (Logo.tsx のポリゴン構成)
    polys=[((50,5),(30,55),(50,55),'#C13584'),((50,5),(50,55),(65,32),'#7B2CBF'),
           ((65,32),(50,55),(78,55),'#06A77D'),((65,32),(78,55),(88,38),'#118AB2'),
           ((30,55),(50,55),(40,75),'#E1306C'),((50,55),(78,55),(60,75),'#833AB4'),
           ((10,92),(30,55),(40,75),'#FFD60A'),((10,92),(40,75),(60,75),'#F77F00'),
           ((60,75),(78,55),(90,92),'#06A77D'),((40,75),(60,75),(90,92),'#84C44A'),
           ((60,75),(90,92),(88,38),'#5B2C8A')]
    for p in polys:
        pts=[(p[i][0]*k,p[i][1]*k) for i in range(3)]
        d.polygon(pts, fill=hx(p[3])+(255,))
    return img.resize((size,size),Image.LANCZOS)

def m_iris(size, grad):
    img,d,s,k=_canvas(size)
    cx,cy=s/2,s/2
    for rot in range(0,360,60):
        L=Image.new('RGBA',(s,s),(0,0,0,0)); ld=ImageDraw.Draw(L)
        # 花弁 (二重ライン) を縦向きで描き回転
        ld.ellipse([cx-9*k, cy-46*k, cx+9*k, cy+2*k], outline=hx('#E1306C')+(255,), width=int(3*k))
        ld.ellipse([cx-5.5*k, cy-40*k, cx+5.5*k, cy-2*k], outline=hx('#F77737')+(220,), width=int(2*k))
        img.alpha_composite(L.rotate(rot, center=(cx,cy), resample=Image.BICUBIC))
    d.ellipse([cx-5*k,cy-5*k,cx+5*k,cy+5*k], fill=hx('#C13584')+(255,))
    return img.resize((size,size),Image.LANCZOS)

def m_resonance(size, grad):
    img,d,s,k=_canvas(size)
    src=(28*k,72*k)
    for i,(r,op) in enumerate([(22,1.0),(38,0.72),(54,0.45)]):
        col=lerp(grad[0],grad[2],i/2)
        d.arc([src[0]-r*k,src[1]-r*k,src[0]+r*k,src[1]+r*k], start=-90,end=0, fill=col+(int(255*op),), width=int(3*k))
    d.ellipse([src[0]-5.5*k,src[1]-5.5*k,src[0]+5.5*k,src[1]+5.5*k], fill=grad[0]+(255,))
    return img.resize((size,size),Image.LANCZOS)

def m_lume(size, grad):
    img,d,s,k=_canvas(size)
    tl=hx('#FFD86B'); br=hx('#FF7A18')
    rect=Image.new('RGBA',(s,s),(0,0,0,0)); rp=rect.load()
    for y in range(s):
        for x in range(s):
            rp[x,y]=lerp(tl,br,(x+y)/(2*s))+(255,)
    mask=Image.new('L',(s,s),0); ImageDraw.Draw(mask).rounded_rectangle([4*k,4*k,96*k,96*k],radius=int(26*k),fill=255)
    img.paste(rect,(0,0),mask)
    cx,cy=50*k,43*k
    bloom=Image.new('RGBA',(s,s),(0,0,0,0)); bd=ImageDraw.Draw(bloom); R=int(34*k)
    for r in range(R,0,-1):
        t=r/R
        if t<0.30: col=(255,255,255); a=255
        else:
            tt=(t-0.30)/0.70; col=lerp(hx('#FFFFFF'),hx('#FFF1D6'),tt); a=int(255*(1-tt)**1.7)
        bd.ellipse([cx-r,cy-r,cx+r,cy+r], fill=col+(a,))
    img.alpha_composite(Image.composite(bloom,Image.new('RGBA',(s,s),(0,0,0,0)),mask))
    cr=int(15*k); d.ellipse([cx-cr,cy-cr,cx+cr,cy+cr], fill=(255,255,255,255))
    d.ellipse([cx-6*k-4*k,cy-6*k-4*k,cx-6*k+4*k,cy-6*k+4*k], fill=(255,255,255,235))
    return img.resize((size,size),Image.LANCZOS)

MARKS={'prism':m_prism,'iris':m_iris,'resonance':m_resonance,'lume':m_lume}

# ── 背景 ──
def make_bg(accent):
    bg=Image.new('RGB',(W,H)); px=bg.load()
    for y in range(H):
        c=lerp(BG_TOP,BG_BOT,y/H)
        for x in range(W): px[x,y]=c
    bg=bg.convert('RGBA')
    glow=Image.new('RGBA',(W,H),(0,0,0,0)); gd=ImageDraw.Draw(glow)
    cx,cy=W//2,300; R=620
    for r in range(R,0,-3):
        a=int(46*(1-r/R)**2); gd.ellipse([cx-r,cy-r,cx+r,cy+r], fill=accent+(a,))
    bg.alpha_composite(glow)
    return bg

def rrect(d, box, radius, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def text_w(d, t, f):
    b=d.textbbox((0,0),t,font=f); return b[2]-b[0]

# ── 1枚生成 ──
def build(prod):
    accent=hx(prod['accent']); bright=hx(prod['bright']); grad=[hx(c) for c in prod['grad']]
    img=make_bg(accent); d=ImageDraw.Draw(img)
    M=80
    # ロゴ
    ls=190; logo=MARKS[prod['mark']](ls, grad)
    img.alpha_composite(logo, ((W-ls)//2, 70))
    # eyebrow
    eb=f"CORE {prod['name'].upper()}　/　{prod['role']}"
    f_eb=F(F_W6,24); d.text(((W-text_w(d,eb,f_eb))//2, 286), eb, font=f_eb, fill=bright)
    # tagline JP (明朝)
    f_tag=F(F_MIN,60); tw=text_w(d,prod['tag'],f_tag)
    d.text(((W-tw)//2, 330), prod['tag'], font=f_tag, fill=INK)
    # tagline EN
    f_en=F(F_W3,26); d.text(((W-text_w(d,prod['en'],f_en))//2, 418), prod['en'], font=f_en, fill=FAINT)
    # 見出し: 料金 × できること
    f_h=F(F_W6,22); hd='料金プラン　×　できること'
    d.text(((W-text_w(d,hd,f_h))//2, 478), hd, font=f_h, fill=DIM)
    # グラデ下線の代わりに細い中央バー
    seg=160//len(grad)
    for i,c in enumerate(grad):
        d.rectangle([W//2-80+i*seg, 516, W//2-80+(i+1)*seg, 519], fill=c)

    # プラン行
    plans=prod['plans']; n=len(plans)
    top=556; bottom=H-150; gap=16
    rh=(bottom-top-gap*(n-1))//n
    f_pn=F(F_W7,30); f_pr=F(F_W7,40); f_pr_s=F(F_W6,18); f_per=F(F_W3,16)
    f_bul=F(F_W3,19); f_tag2=F(F_W6,15)
    for i,pl in enumerate(plans):
        y=top+i*(rh+gap)
        hot=pl.get('hot')
        # 注意: フラット化(convert RGB)でアルファは捨てられるため、半透明ではなく
        # あらかじめ暗背景にブレンドした「不透明色」で塗る。
        if hot:
            fillc=lerp(BG_TOP,accent,0.16)+(255,); outc=accent+(255,); ow=3
        else:
            fillc=lerp(BG_TOP,(255,255,255),0.055)+(255,); outc=lerp(BG_TOP,(255,255,255),0.16)+(255,); ow=1
        rrect(d, [M,y,W-M,y+rh], 18, fill=fillc, outline=outc, width=ow)
        # 左: プラン名 + 価格
        lx=M+34
        d.text((lx, y+26), pl['name'], font=f_pn, fill=INK)
        if hot:
            tg='人気'; tgw=text_w(d,tg,f_tag2)
            rrect(d,[lx+text_w(d,pl['name'],f_pn)+16, y+30, lx+text_w(d,pl['name'],f_pn)+16+tgw+24, y+58], 14, fill=accent+(255,))
            d.text((lx+text_w(d,pl['name'],f_pn)+28, y+34), tg, font=f_tag2, fill=(8,8,16))
        # price
        price=pl['price']
        d.text((lx, y+72), price, font=f_pr, fill=bright if price!='¥0' else INK)
        pw=text_w(d,price,f_pr)
        if pl.get('per'):
            d.text((lx+pw+8, y+92), pl['per'], font=f_per, fill=DIM)
        if pl.get('note'):
            d.text((lx, y+rh-44), pl['note'], font=f_per, fill=FAINT)
        # 右: できること bullets
        rx=M+360; rxw=W-M-rx-30
        feats=pl['features']
        bh=(rh-40)//len(feats)
        for j,ft in enumerate(feats):
            by=y+24+j*bh
            d.ellipse([rx, by+8, rx+9, by+17], fill=accent+(255,))
            d.text((rx+20, by), ft, font=f_bul, fill=(225,229,238))

    # フッター
    fy=H-110
    seg2=(W-2*M)//len(grad)
    for i,c in enumerate(grad):
        d.rectangle([M+i*seg2, fy, M+(i+1)*seg2, fy+4], fill=c)
    f_ft=F(F_W6,22); f_ft2=F(F_W3,18)
    d.text((M, fy+22), prod['url'], font=f_ft, fill=DIM)
    note=prod['foot']; d.text((W-M-text_w(d,note,f_ft2), fy+24), note, font=f_ft2, fill=FAINT)
    # 会社名
    f_co=F(F_W3,15); co='株式会社コア  ·  CORE Inc.'
    d.text((M, fy+58), co, font=f_co, fill=FAINT)

    out=f"{OUT}/{prod['name']}/CORE_{prod['name']}_料金ペラ_2026-06-10.png"
    img.convert('RGB').save(out,'PNG')
    print('wrote', out)


PRODUCTS=[
 dict(name='Prism', mark='prism', accent='#a78bfa', bright='#c4b5fd',
      grad=['#ff5757','#ff9842','#fbbf24','#4ade80','#60a5fa','#a78bfa','#f472b6'],
      role='全事業の司令塔', tag='すべての事業を、ひとつの頭脳で。',
      en='One mind for your whole business.',
      url='core-prism-app.vercel.app', foot='全プラン 7日間無料・クレカ不要',
      plans=[
        dict(name='Free', price='¥0', per='/7日間', note='全機能トライアル', features=['全機能を7日間おためし','カード登録不要','自動課金なし']),
        dict(name='Starter', price='¥4,800', per='/月', note='個人・スタートアップ', features=['基本AI機能','1人格・1ユーザー','ナレッジ100件まで']),
        dict(name='Standard', price='¥9,800', per='/月', hot=True, note='年¥98,000（17%off）', features=['全AI機能（商談AI含む）','人格・ユーザー無制限','ナレッジ無制限・音声秘書']),
        dict(name='Exclusive', price='¥29,800', per='/月', note='年¥298,000', features=['Standard全機能＋専任CS','優先サポート（1営業日）','カスタム連携・社内研修']),
      ]),
 dict(name='Iris', mark='iris', accent='#E1306C', bright='#F472B6',
      grad=['#FCB045','#E1306C','#833AB4'],
      role='Instagram 運用 AI', tag='Instagramを、AIと育てる。',
      en='Run Instagram with an AI agent.',
      url='core-prism-app.vercel.app/iris', foot='全プラン 7日間無料・クレカ不要',
      plans=[
        dict(name='Free', price='¥0', per='/7日間', note='全機能トライアル', features=['全機能を7日間おためし','カード登録不要・自動課金なし']),
        dict(name='Lite', price='¥2,800', per='/月', note='入門・副業クリエイター', features=['AI戦略相談 30回/月','案件管理 無制限','投稿構成・キャプション 月30回']),
        dict(name='Standard', price='¥6,800', per='/月', hot=True, note='年¥49,800', features=['AI相談・解析ほぼ無制限','Instagram解析 月10回','コミュニティ参加']),
        dict(name='Pro', price='¥9,800', per='/月', note='チーム/マネージャー', features=['連携アカウント 5','ブランドマッチ（Prism連動）','投稿カレンダー・専任CS']),
        dict(name='Studio', price='¥29,800', per='/月', note='事務所・代理店', features=['連携アカウント 無制限','ホワイトラベル・API連携','月次研修']),
      ]),
 dict(name='Resonance', mark='resonance', accent='#06C755', bright='#34D399',
      grad=['#34D399','#06C755','#0EA5E9'],
      role='LINE 個別配信', tag='LINEのご縁を、AIが温める。',
      en='Let it resonate.',
      url='resonancebot-ivory.vercel.app', foot='全プラン7日間無料・クレカ不要（BYOK）',
      plans=[
        dict(name='7日間無料', price='¥0', per='/7日間', note='全機能トライアル', features=['全機能を7日間おためし','カード登録不要・自動課金なし']),
        dict(name='Pro', price='¥980', per='/月', hot=True, note='1アカウント', features=['AIが一人ひとり文面を書き分け','月3,000通','送信前に全件確認']),
        dict(name='Business', price='¥2,980', per='/月', note='3アカウント', features=['Pro全機能','月15,000通','複数アカウント管理']),
        dict(name='Premium', price='¥4,980', per='/月', note='10アカウント', features=['Business全機能','月50,000通','大規模配信に']),
      ]),
 dict(name='Lume', mark='lume', accent='#FFA42A', bright='#FFD86B',
      grad=['#FFD86B','#FFA42A','#FF7A18'],
      role='リンクハブ＋クリック解析', tag='すべてのリンクを、ひとつに。',
      en='Every link, in one place.',
      url='lume-deploy-five.vercel.app', foot='全プラン7日間無料・クレジットカード登録不要',
      plans=[
        dict(name='7日間無料', price='¥0', per='/7日間', note='全機能トライアル', features=['全機能を7日間おためし','カード登録不要・自動課金なし']),
        dict(name='Pro', price='¥980', per='/月', hot=True, note='解析フル機能', features=['クリックヒートマップ','流入元クロス分析','時間帯・傾向の可視化']),
        dict(name='Business', price='¥2,980', per='/月', note='複数プロフィール', features=['Pro全機能','複数プロフィール管理','チーム運用に']),
      ]),
]

for p in PRODUCTS:
    build(p)
print('ALL DONE')
