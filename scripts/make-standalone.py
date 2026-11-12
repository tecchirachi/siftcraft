# ShiftCraft を「1ファイルで動く HTML」に変換するスクリプト
# dist/index.html が参照する JS/CSS/アイコンをすべて埋め込み、
# ネットもサーバーもなしに file:// や Android アプリ内蔵で動く形にする。
import base64
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
dist = root / "dist"
html = (dist / "index.html").read_text(encoding="utf-8")

# JS と CSS をインライン化（</script> 等が混ざっていないか念のため確認）
js_name = re.search(r'src="\./(assets/[^"]+\.js)"', html).group(1)
js = (dist / js_name).read_text(encoding="utf-8")
assert "</script" not in js
html = re.sub(r'<script type="module"[^>]*src="\./assets/[^"]+\.js"[^>]*></script>',
              lambda _: "<script type=\"module\">\n" + js + "\n</script>", html)

css_name = re.search(r'href="\./(assets/[^"]+\.css)"', html).group(1)
css = (dist / css_name).read_text(encoding="utf-8")
html = re.sub(r'<link rel="stylesheet"[^>]*href="\./assets/[^"]+\.css"[^>]*>',
              lambda _: "<style>\n" + css + "\n</style>", html)

# アイコンは data URI 化、マニフェストは外す（単体ファイルでは使えないため）
svg64 = base64.b64encode((dist / "icon.svg").read_bytes()).decode()
html = html.replace('href="./icon.svg"', f'href="data:image/svg+xml;base64,{svg64}"')
png64 = base64.b64encode((dist / "apple-touch-icon.png").read_bytes()).decode()
html = html.replace('href="./apple-touch-icon.png"', f'href="data:image/png;base64,{png64}"')
html = re.sub(r'<link rel="manifest"[^>]*>\s*', '', html)

out = root.parent / "shiftcraft-standalone.html"
out.write_text(html, encoding="utf-8")
print("wrote", out, len(html), "bytes")
