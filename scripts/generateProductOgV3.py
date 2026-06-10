#!/usr/bin/env python3
# ============================================================
# CORE Resonance / Lume — OG 画像 (1200x630) v3 スタイル
# Prism/Iris の og-*-v3.png に揃えたダーク基調・左ロゴ・右コピー。
# 日本語は Hiragino で確実描画。出力: public/og-resonance-v3.png / og-lume-v3.png
# ============================================================
import math
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
PUBLIC = __file__.rsplit('/scripts/', 1)[0] + '/public'

# ── フォント ──
F_GOTHIC_W7 = '/System/Library/Fonts/ヒラギノ角ゴシック W7.ttc'
F_GOTHIC_W6 = '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc'
F_GOTHIC_W3 = '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'

def font(path, size):
    return ImageFont.truetype(path, size)

def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

# ── 背景: 縦グラデ(濃紺→黒) + 左に accent の放射グロー ──
def make_bg(accent_rgb):
    top = hex2rgb('#0a0e1a')
    bot = hex2rgb('#05060c')
    bg = Image.new('RGB', (W, H))
    px = bg.load()
    for y in range(H):
        c = lerp(top, bot, y / H)
        for x in range(W):
            px[x, y] = c
    # 左の放射グロー (accent)
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy = 300, 315
    maxr = 520
    for r in range(maxr, 0, -4):
        t = r / maxr
        alpha = int(70 * (1 - t) ** 2)
        gd.ellipse([cx - r, cy - r, cx + r, cy + r],
                   fill=(accent_rgb[0], accent_rgb[1], accent_rgb[2], alpha))
    bg = bg.convert('RGBA')
    bg.alpha_composite(glow)
    return bg

# ── ロゴ描画 (高解像度で描いて縮小=アンチエイリアス) ──
SS = 4  # supersample

def draw_resonance_logo(size, grad):
    s = size * SS
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # viewBox 100 系を size にスケール
    k = s / 100.0
    src = (28 * k, 72 * k)
    # 3 重の音紋アーク (右上 90度)。色は半径で grad を補間
    arcs = [(22, 1.0), (38, 0.72), (54, 0.45)]
    for i, (r, op) in enumerate(arcs):
        col = lerp(grad[0], grad[2], i / 2)
        bbox = [src[0] - r * k, src[1] - r * k, src[0] + r * k, src[1] + r * k]
        d.arc(bbox, start=-90, end=0, fill=col + (int(255 * op),), width=int(3 * k))
    # 源の核
    rr = 5.5 * k
    d.ellipse([src[0] - rr, src[1] - rr, src[0] + rr, src[1] + rr], fill=grad[0] + (255,))
    return img.resize((size, size), Image.LANCZOS)

def draw_lume_logo(size, grad):
    # 紫のスクイクル + 白く発光するオーブ (アプリアイコン再現)
    s = size * SS
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = s / 100.0
    # スクイクル地: 斜めグラデ (ラベンダー→ディープバイオレット)
    sq_tl = hex2rgb('#FFD86B')
    sq_br = hex2rgb('#FF7A18')
    rect = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    rp = rect.load()
    for y in range(s):
        for x in range(s):
            t = (x + y) / (2 * s)
            rp[x, y] = lerp(sq_tl, sq_br, t) + (255,)
    # 角丸マスク
    mask = Image.new('L', (s, s), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([4 * k, 4 * k, 96 * k, 96 * k], radius=int(26 * k), fill=255)
    img.paste(rect, (0, 0), mask)
    # 発光ブルーム (白→ラベンダー、放射状フェード)
    cx, cy = 50 * k, 43 * k
    bloom = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bloom)
    R = int(34 * k)
    for r in range(R, 0, -1):
        t = r / R
        if t < 0.30:
            col = (255, 255, 255); a = 255
        else:
            tt = (t - 0.30) / 0.70
            col = lerp(hex2rgb('#FFFFFF'), hex2rgb('#FFF1D6'), tt)
            a = int(255 * (1 - tt) ** 1.7)
        bd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col + (a,))
    img.alpha_composite(Image.composite(bloom, Image.new('RGBA', (s, s), (0, 0, 0, 0)), mask))
    # 明るい核
    cr = int(15 * k)
    d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(255, 255, 255, 255))
    # スペキュラ
    hr = 4 * k
    d.ellipse([cx - 6 * k - hr, cy - 6 * k - hr, cx - 6 * k + hr, cy - 6 * k + hr], fill=(255, 255, 255, 235))
    return img.resize((size, size), Image.LANCZOS)

def draw_core_logo(size, grad):
    # 発光する核 + 傾いた軌道リング (アトム/コア)。シアン基調・強いブルーム。
    s = size * SS
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = s / 100.0
    cx, cy = s / 2, s / 2
    ring = hex2rgb('#38BDF8')
    # 外周ブルーム (シアンの滲み)
    R = int(46 * k)
    for r in range(R, 0, -1):
        t = r / R
        a = int(60 * (1 - t) ** 2.2)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ring + (a,))
    # 傾いた軌道リング 2 本 (個別レイヤーで描いて回転)
    def ring_layer(rx, ry, lw, col, alpha, angle):
        L = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        ld = ImageDraw.Draw(L)
        ld.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=col + (alpha,), width=int(lw * k))
        return L.rotate(angle, center=(cx, cy), resample=Image.BICUBIC)
    img.alpha_composite(ring_layer(43 * k, 16 * k, 2.6, ring, 235, -24))
    img.alpha_composite(ring_layer(43 * k, 16 * k, 2.2, hex2rgb('#7DD3FC'), 150, 34))
    # 中央核 (白→シアン→ブルーの発光球)
    cr = int(16 * k)
    inner = hex2rgb('#FFFFFF'); midc = hex2rgb('#BAE6FD'); outer = hex2rgb('#0EA5E9')
    for r in range(cr, 0, -1):
        t = r / cr
        col = lerp(inner, midc, t / 0.5) if t < 0.5 else lerp(midc, outer, (t - 0.5) / 0.5)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col + (255,))
    # スペキュラ
    hr = 3.4 * k
    d.ellipse([cx - 5 * k - hr, cy - 5 * k - hr, cx - 5 * k + hr, cy - 5 * k + hr], fill=(255, 255, 255, 235))
    return img.resize((size, size), Image.LANCZOS)


# ── ピル (角丸チップ) ──
def draw_pill(draw, x, y, text, fnt, accent):
    pad_x, pad_y = 22, 13
    tb = draw.textbbox((0, 0), text, font=fnt)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    w = tw + pad_x * 2
    h = th + pad_y * 2
    draw.rounded_rectangle([x, y, x + w, y + h], radius=h // 2,
                           fill=(255, 255, 255, 16),
                           outline=accent + (120,), width=2)
    draw.text((x + pad_x, y + pad_y - tb[1]), text, font=fnt, fill=(235, 238, 245))
    return w, h

# ── 1 枚生成 ──
def build(slug, accent_hexes, eyebrow, headline, sub, pills, url, logo_fn):
    grad = [hex2rgb(h) for h in accent_hexes]
    accent = grad[0]
    accent_bright = grad[1] if len(grad) > 1 else grad[0]
    img = make_bg(accent)
    d = ImageDraw.Draw(img)

    # 左: ロゴ (中央やや左)
    logo_size = 300
    logo = logo_fn(logo_size, grad)
    img.alpha_composite(logo, (40, (H - logo_size) // 2))

    # 右カラム
    RX = 470
    f_eyebrow = font(F_GOTHIC_W6, 22)
    f_head = font(F_GOTHIC_W7, 66)
    f_sub = font(F_GOTHIC_W3, 30)
    f_pill = font(F_GOTHIC_W6, 23)
    f_url = font(F_GOTHIC_W6, 24)

    y = 120
    # eyebrow (accent, レター間隔)
    eb = ' '.join(eyebrow)  # 擬似トラッキング
    d.text((RX, y), eyebrow, font=f_eyebrow, fill=accent_bright)
    y += 52

    # headline 2行 (2行目 accent)
    for i, line in enumerate(headline):
        col = accent_bright if i == 1 else (245, 247, 250)
        d.text((RX, y), line, font=f_head, fill=col)
        y += 82
    y += 14

    # subline
    d.text((RX, y), sub, font=f_sub, fill=(180, 188, 200))
    y += 60

    # pills
    px = RX
    for p in pills:
        w, h = draw_pill(d, px, y, p, f_pill, accent)
        px += w + 14

    # footer url (中央下)
    ub = d.textbbox((0, 0), url, font=f_url)
    d.text(((W - (ub[2] - ub[0])) // 2, H - 56), url, font=f_url, fill=(150, 158, 170))

    out = PUBLIC + f'/og-{slug}-v3.png'
    img.convert('RGB').save(out, 'PNG')
    print('wrote', out)

# ── Resonance ──
build(
    slug='resonance',
    accent_hexes=['#06C755', '#34D399', '#0EA5E9'],
    eyebrow='CORE RESONANCE — FOR SHOPS & SALONS',
    headline=['一斉配信なのに、', '一人ひとりに。'],
    sub='AIが文面を書き分け ・ LINEで届く ・ 7日間 無料',
    pills=['個別文面AI', '送信前に全件確認', 'LINE公式に接続'],
    url='resonancebot-ivory.vercel.app',
    logo_fn=draw_resonance_logo,
)

# ── CORE (法人 OG) ──
build(
    slug='core',
    accent_hexes=['#38BDF8', '#7DD3FC', '#0EA5E9'],
    eyebrow='CORE INC. — すべての時代の、核となるものを',
    headline=['仕事も SNS も、', 'ひとつの流れに。'],
    sub='Prism ・ Iris ・ Resonance ・ Lume',
    pills=['事業', 'Instagram', 'LINE', 'リンク'],
    url='core-prism-app.vercel.app/corp',
    logo_fn=draw_core_logo,
)

# ── Lume ──
build(
    slug='lume',
    accent_hexes=['#FFA42A', '#FFD86B', '#FF7A18'],
    eyebrow='CORE LUME — FOR CREATORS',
    headline=['あなたのリンクを、', 'いちばん美しく。'],
    sub='リンクまとめ ・ クリック解析 ・ 月¥980〜',
    pills=['クリックヒートマップ', '流入元分析', '30秒で完成'],
    url='lume-deploy-five.vercel.app',
    logo_fn=draw_lume_logo,
)
