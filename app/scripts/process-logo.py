"""Convert logo-icon-dark.png into a transparent-background V-glyph PNG.

Reads /app/public/assets/logo-icon-dark.png, removes the black backdrop by
mapping luminance to alpha, crops to the V glyph (excluding the wordmark),
and saves /app/public/assets/logo-icon-transparent.png.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "assets" / "logo-icon-dark.png"
DST = ROOT / "public" / "assets" / "logo-icon-transparent.png"

img = Image.open(SRC).convert("RGBA")
w, h = img.size
print(f"source: {w}x{h}")

# Crop top portion to drop the "VERDEXIS" wordmark below the V.
# The V glyph sits roughly in the upper 60% of the canvas.
crop_box = (0, 0, w, int(h * 0.62))
img = img.crop(crop_box)
w, h = img.size

px = img.load()
for y in range(h):
    for x in range(w):
        r, g, b, _ = px[x, y]
        # Luminance (Rec. 709). Pure black -> 0 alpha, pure green V -> ~150+.
        lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        # Remap so anything below 18 becomes fully transparent and we get a
        # smooth roll-off up to 90 (preserves anti-aliased glyph edges).
        if lum <= 18:
            alpha = 0
        elif lum >= 90:
            alpha = 255
        else:
            alpha = int((lum - 18) / (90 - 18) * 255)
        px[x, y] = (r, g, b, alpha)

# Trim to the bounding box of the visible glyph for a tight image.
bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)
    print(f"trimmed to: {img.size}")

img.save(DST, "PNG", optimize=True)
print(f"wrote {DST.relative_to(ROOT)}")
