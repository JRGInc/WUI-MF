"""Generate the good-vs-loose mask example for the CVAT labeling guide.

Uses a CC-licensed scraped image (NOT a real client property) so the asset is
safe to commit. Tight mask = a foliage contour traced by HSV threshold; loose
mask = an over-padded box around the same object.

Run with the export venv (has cv2/numpy/PIL):
    ~/yolo-export-venv/bin/python scripts/make-labeling-examples.py
"""
import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# "Rosemary Bush" by Tobyotter, CC BY 2.0 — https://www.flickr.com/photos/78428166@N00/7114511333
SRC = os.path.join(ROOT, "training-data/harvest/images/openverse-d054630f-1e1e-41ab-ac84-4cafbd51bb2b.jpg")
OUT = os.path.join(ROOT, "training-data/labeling/examples/good-vs-loose-mask.png")
CREDIT = 'example image: "Rosemary Bush" by Tobyotter, CC BY 2.0'

img = cv2.imread(SRC)
H, W = img.shape[:2]

# ROI around the foreground rosemary bush (fractions of the frame).
x0, y0, x1, y1 = int(0.10 * W), int(0.30 * H), int(0.80 * W), int(0.86 * H)
roi = img[y0:y1, x0:x1]
hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
# Muted gray-green rosemary foliage: broad hue, low-moderate sat, mid value.
mask = cv2.inRange(hsv, (30, 18, 25), (95, 255, 200))
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
c = max(cnts, key=cv2.contourArea)
eps = 0.008 * cv2.arcLength(c, True)
poly = cv2.approxPolyDP(c, eps, True).reshape(-1, 2) + [x0, y0]
bx, by, bw, bh = cv2.boundingRect(c)


def panel(loose):
    base = Image.open(SRC).convert("RGBA")
    ov = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    if loose:
        px, py = int(0.20 * bw), int(0.45 * bh)
        bb = [x0 + bx - px, y0 + by - py, x0 + bx + bw + px, y0 + by + bh + py]
        d.rectangle(bb, fill=(255, 60, 60, 70), outline=(255, 40, 40, 255), width=6)
    else:
        pts = [tuple(int(v) for v in p) for p in poly]
        d.polygon(pts, fill=(40, 220, 90, 70))
        d.line(pts + [pts[0]], fill=(20, 200, 70, 255), width=5)
    return Image.alpha_composite(base, ov).convert("RGB")


good, loose = panel(False), panel(True)
scale = 760 / H
nw, nh = int(W * scale), int(H * scale)
good, loose = good.resize((nw, nh)), loose.resize((nw, nh))
pad, band, foot = 24, 88, 34
canvas = Image.new("RGB", (nw * 2 + pad * 3, nh + band + foot + pad * 2), (245, 245, 245))
canvas.paste(good, (pad, band + pad))
canvas.paste(loose, (nw + pad * 2, band + pad))
d = ImageDraw.Draw(canvas)


def font(sz, bold=True):
    for p in [
        f"/usr/share/fonts/truetype/dejavu/DejaVuSans{'-Bold' if bold else ''}.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]:
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            pass
    return ImageFont.load_default()


fb, fs = font(34), font(20, bold=False)
d.text((pad, 24), "GOOD - tight mask hugs the shrub", fill=(20, 140, 50), font=fb)
d.text((nw + pad * 2, 24), "LOOSE - box spills onto path, lawn & house", fill=(190, 30, 30), font=fb)
d.text((pad, 60), "polygon follows the object edge", fill=(90, 90, 90), font=fs)
d.text((nw + pad * 2, 60), "includes non-hazard pixels = bad training signal", fill=(90, 90, 90), font=fs)
d.text((pad, nh + band + pad + 8), CREDIT, fill=(120, 120, 120), font=fs)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
canvas.save(OUT)
print("saved", OUT, canvas.size)
