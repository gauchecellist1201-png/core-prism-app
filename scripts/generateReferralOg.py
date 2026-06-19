# ============================================================
# 紹介リンク OG 画像 (1200x630) を PIL で生成 — 正直な数字版
# 出力: public/og-referral-v2.png
# 旧 og-referral-v1.png は「+14日 / 合計21日」と誤表記していたため差し替え。
# 実際の付与は REFERRAL_BONUS_DAYS=7 → 通常7日 + 招待7日 = 合計14日。
# ============================================================
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
PUBLIC = os.path.join(os.path.dirname(__file__), "..", "public")
OUT = os.path.join(PUBLIC, "og-referral-v2.png")

W6 = "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc"   # bold
W3 = "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc"   # regular

def f(path, size):
    return ImageFont.truetype(path, size)

# ── 背景: 左上→右下のダークグラデ (#0A0A14 → #1a0f2e → #2e1456) ──
img = Image.new("RGB", (W, H))
px = img.load()
c0 = (10, 10, 20)      # #0A0A14
c1 = (26, 15, 46)      # #1a0f2e
c2 = (46, 20, 86)      # #2e1456
for y in range(H):
    for x in range(0, W, 1):
        t = (x / W * 0.55 + y / H * 0.45)  # 対角
        if t < 0.5:
            k = t / 0.5
            r = int(c0[0] + (c1[0] - c0[0]) * k)
            g = int(c0[1] + (c1[1] - c0[1]) * k)
            b = int(c0[2] + (c1[2] - c0[2]) * k)
        else:
            k = (t - 0.5) / 0.5
            r = int(c1[0] + (c2[0] - c1[0]) * k)
            g = int(c1[1] + (c2[1] - c1[1]) * k)
            b = int(c1[2] + (c2[2] - c1[2]) * k)
        px[x, y] = (r, g, b)

d = ImageDraw.Draw(img)

# ── 上端のカラフルなコンフェッティ帯 (ブランドの彩り) ──
bars = [
    (0, 150, "#0EA5E9"), (150, 110, "#7C5CFF"), (260, 90, "#FF6FA9"),
    (350, 70, "#FBBF24"), (1010, 90, "#FB923C"), (1100, 100, "#0EA5E9"),
]
for x, w, hexc in bars:
    c = tuple(int(hexc[i:i+2], 16) for i in (1, 3, 5))
    d.rectangle([x, 0, x + w, 10], fill=c)

GOLD = (251, 191, 36)     # #FBBF24
WHITE = (255, 255, 255)
GRAY = (203, 213, 225)    # #cbd5e1
MUTE = (148, 163, 184)    # #94a3b8

def tracked(draw, xy, text, font, fill, spacing):
    """文字間スペース付きでテキストを描画"""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        w = draw.textlength(ch, font=font)
        x += w + spacing

PAD = 80

# ── eyebrow ──
tracked(d, (PAD, 92), "CORE PRISM × INVITATION", f(W6, 26), GOLD, 6)

# ── headline 1 ──
d.text((PAD, 150), "招待されました。", font=f(W6, 92), fill=WHITE)

# ── headline 2: "+7日" を金、" 無料延長つき。" を白 ──
y2 = 268
plus = "+7日"
d.text((PAD, y2), plus, font=f(W6, 92), fill=GOLD)
plus_w = d.textlength(plus, font=f(W6, 92))
d.text((PAD + plus_w + 14, y2), " 無料延長つき。", font=f(W6, 92), fill=WHITE)

# ── subtext ──
d.text((PAD, 400), "AI が事業を回す、すべての事業家の OS", font=f(W3, 34), fill=GRAY)
d.text((PAD, 446), "—— CORE Prism", font=f(W6, 34), fill=GRAY)

# ── small honest line ──
d.text((PAD, 530), "通常 7 日 → 合計 14 日 無料 · クレカ不要", font=f(W3, 26), fill=MUTE)

# ── 右下 ワードマーク ──
core_font = f(W6, 64)
core_w = d.textlength("CORE", font=core_font)
d.text((W - PAD - core_w, 500), "CORE", font=core_font, fill=WHITE)
url_font = f(W3, 22)
url_w = d.textlength("core-prism-app.vercel.app", font=url_font)
d.text((W - PAD - url_w, 568), "core-prism-app.vercel.app", font=url_font, fill=MUTE)

img.save(OUT, "PNG", optimize=True)
print("✓", OUT)
