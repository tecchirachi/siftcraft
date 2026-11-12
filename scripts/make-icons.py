# ShiftCraft アイコン生成スクリプト（Issue #39）
#
# 使い方: python3 scripts/make-icons.py
# 必要なもの: Pillow（pip install pillow）と Liberation Sans Bold フォント。
# 無い場合は DejaVu Sans Bold など太字フォントのパスに書き換えてください。
#
# デザイン（2026-11-12 決定）: 「一目でシフト管理アプリと分かる」こと。
# - 桃グラデーションの地に、白いカレンダーページ（コーラルのヘッダー＋S）
# - 日付ドットの一部をバイト先カラーにして「シフトのある日」を表す
# - 右下に時計バッジを重ねて「時間＝シフト」を補強する
#
# 出力（public/ 配下）:
# - icon-512.png / icon-192.png : 角丸＋透過（通常アイコン）
# - icon-maskable-512.png       : 全面＋安全圏に縮小（Android の形抜き用）
# - apple-touch-icon.png        : 180px 全面（iOS が角丸を付け足す）
import math
import os

from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
SS = 4  # スーパーサンプリング倍率（縁をなめらかにする）
PUBLIC = os.path.join(os.path.dirname(__file__), "..", "public")

PEACH = [(255, 178, 135), (255, 158, 110), (255, 140, 90)]  # グラデの3色
CORAL = (240, 135, 79, 255)       # カレンダーのヘッダー
PAGE = (255, 251, 244, 255)       # カレンダーの紙の色
GRAYDOT = (232, 221, 210, 255)    # シフトの無い日
COLS = [(224, 127, 69, 255), (63, 143, 210, 255), (63, 156, 114, 255)]  # バイト先カラー
CLOCK = (255, 138, 95, 255)       # 時計バッジ


def gradient(size):
    """対角グラデーションを作る（linear_gradient を45度回して色付け）。"""
    g = Image.linear_gradient("L").resize((size, size))
    g = g.rotate(-45, resample=Image.BILINEAR, expand=False)
    g = g.crop((int(size * 0.15), int(size * 0.15), int(size * 0.85), int(size * 0.85)))
    g = g.resize((size, size))
    chans = []
    for ch in range(3):
        lut = []
        for i in range(256):
            t = i / 255
            if t < 0.5:
                a, b, u = PEACH[0][ch], PEACH[1][ch], t * 2
            else:
                a, b, u = PEACH[1][ch], PEACH[2][ch], (t - 0.5) * 2
            lut.append(round(a + (b - a) * u))
        chans.append(g.point(lut))
    return Image.merge("RGB", chans)


def draw_design(size):
    """正方形いっぱいのデザインを描く（角丸マスクは呼び出し側で付ける）。"""
    S = size * SS
    img = gradient(S).convert("RGBA")
    d = ImageDraw.Draw(img)

    # カレンダーページ
    x0, y0, x1, y1 = S * 0.14, S * 0.17, S * 0.86, S * 0.85
    r = S * 0.055
    d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=PAGE)
    # ヘッダー帯（上の角だけ丸くするため帯の下半分を重ね塗りする）
    d.rounded_rectangle([x0, y0, x1, y0 + S * 0.17], radius=r, fill=CORAL)
    d.rectangle([x0, y0 + S * 0.10, x1, y0 + S * 0.17], fill=CORAL)
    # 綴じリング
    for tx in (S * 0.30, S * 0.655):
        d.rounded_rectangle(
            [tx, y0 - S * 0.038, tx + S * 0.055, y0 + S * 0.05],
            radius=S * 0.026, fill=PAGE, outline=(214, 120, 66, 255), width=int(S * 0.008),
        )
    # ヘッダーの S
    font = ImageFont.truetype(FONT, int(S * 0.115))
    d.text(((x0 + x1) / 2, y0 + S * 0.088), "S", font=font, fill=(255, 255, 255, 255), anchor="mm")

    # 日付ドット（4列×3行、一部だけ色付き＝シフトのある日）
    colored = {0: 0, 4: 1, 9: 2}
    idx = 0
    for row in range(3):
        for col in range(4):
            cx = x0 + S * 0.075 + S * 0.145 * col
            cy = y0 + S * 0.245 + S * 0.135 * row
            rr = S * 0.026
            fill = COLS[colored[idx]] if idx in colored else GRAYDOT
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=fill)
            idx += 1

    # 時計バッジ（右下に重ねる）
    cx, cy, cr = S * 0.755, S * 0.755, S * 0.155
    d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=CLOCK, outline=PAGE, width=int(S * 0.016))

    def hand(angle_deg, length):
        a = math.radians(angle_deg - 90)
        d.line([cx, cy, cx + length * math.cos(a), cy + length * math.sin(a)],
               fill=(255, 255, 255, 255), width=int(S * 0.020))

    hand(270, cr * 0.62)  # 短針（9時方向）
    hand(0, cr * 0.45)    # 長針（12時方向）
    d.ellipse([cx - S * 0.018, cy - S * 0.018, cx + S * 0.018, cy + S * 0.018],
              fill=(255, 255, 255, 255))
    return img.resize((size, size), Image.LANCZOS)


def rounded(img, size):
    """角丸マスクを付けて外側を透過にする（通常アイコン用）。"""
    S = size * SS
    big = img.resize((S, S), Image.LANCZOS)
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=112 / 512 * S, fill=255)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(big, (0, 0), mask)
    return out.resize((size, size), Image.LANCZOS)


def main():
    design = draw_design(512)
    rounded(design, 512).save(os.path.join(PUBLIC, "icon-512.png"))
    rounded(design, 192).save(os.path.join(PUBLIC, "icon-192.png"))
    # maskable: 形抜きされても欠けないよう、全面グラデの上に82%で載せる
    bg = gradient(512 * SS).convert("RGBA").resize((512, 512), Image.LANCZOS)
    small = design.resize((420, 420), Image.LANCZOS)
    bg.paste(small, (46, 46), small)
    bg.save(os.path.join(PUBLIC, "icon-maskable-512.png"))
    # apple-touch-icon: iOS が角丸を付け足すので全面のまま
    draw_design(180).save(os.path.join(PUBLIC, "apple-touch-icon.png"))
    print("icons written to", os.path.normpath(PUBLIC))


if __name__ == "__main__":
    main()
