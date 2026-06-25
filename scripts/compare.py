#!/usr/bin/env python3
# Art-matching dev tool: composite a TARGET reference image beside the live procedural
# horse and a 50% overlay, so the procedural art can be tuned to converge on the target
# while staying procedural (recolour/poses/markings intact). The procedural frame is
# produced by sprite-preview.mjs first (see the `compare` npm script).
#
#   python3 scripts/compare.py [target.png] [our-render.png] [out.png]
#
# Defaults: target = src/art/horse.png, render = /tmp/proc.png, out = /tmp/compare.png
import sys
from PIL import Image
import numpy as np
Image.MAX_IMAGE_PIXELS = None

target = sys.argv[1] if len(sys.argv) > 1 else 'src/art/horse.png'
ours   = sys.argv[2] if len(sys.argv) > 2 else '/tmp/proc.png'
out    = sys.argv[3] if len(sys.argv) > 3 else '/tmp/compare.png'

def autocrop(im, bg):
    a = np.array(im.convert('RGB')).astype(int)
    m = np.abs(a - np.array(bg)).sum(2) > 45
    ys, xs = np.where(m)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

tgt = Image.open(target).convert('RGB'); tgt = autocrop(tgt, tgt.getpixel((5, 5)))
pr = Image.open(ours).convert('RGB'); w, h = pr.size
pr = pr.crop((0, 0, int(w / 10), h))               # frame 0 of the sprite strip
pr = autocrop(pr, pr.getpixel((2, 2)))

H = 460
fit = lambda im: im.resize((max(1, int(im.size[0] * H / im.size[1])), H), Image.NEAREST)
tgtF, prF = fit(tgt), fit(pr)
W = max(tgtF.width, prF.width)
def pad(im, bg):
    c = Image.new('RGB', (W, H), bg); c.paste(im, ((W - im.width) // 2, 0)); return c
tp, pp = pad(tgtF, (78, 82, 40)), pad(prF, (122, 150, 72))
ov = Image.blend(tp, pp, 0.5)
gap, lab = 14, 26
cv = Image.new('RGB', (W * 3 + gap * 4, H + lab + gap), (32, 34, 38))
for i, im in enumerate([tp, pp, ov]):
    cv.paste(im, (gap + (W + gap) * i, lab))
cv.save(out)
print(f'compare -> {out}  (target {tgt.size} | ours {pr.size})')
