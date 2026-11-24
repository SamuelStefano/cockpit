"""Builds fx/porto-sign.png (96x64 wooden PORTO sign for the dock) and fx/porto-sign-shadow.png (96x16 alpha). Deterministic."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pixkit import blank, rect, hline, vline, put, C, glyph_pixels, shadow_ellipse, audit
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'public', 'world', 'v2', 'fx')

W, H = 96, 64
img = blank(W, H)
# posts (two wooden posts with light on the left edge, cap on top)
for x0 in (10, 80):
    rect(img, x0, 14, x0 + 5, 61, "w1")
    vline(img, x0, 14, 61, "w2"); vline(img, x0 + 1, 14, 61, "w3")
    vline(img, x0 + 5, 14, 61, "w0"); vline(img, x0 + 4, 16, 61, "w0")
    hline(img, x0 - 1, x0 + 6, 13, "w0"); hline(img, x0, x0 + 5, 14, "w3")
    for y in (28, 40, 52): hline(img, x0 + 2, x0 + 3, y, "w0")
# board: two stacked planks 76x22 between the posts
bx0, bx1, by0, by1 = 10, 85, 14, 37
rect(img, bx0, by0, bx1, by1, "w0")
for (y0, y1) in ((by0 + 1, by0 + 10), (by0 + 12, by1 - 1)):
    rect(img, bx0 + 1, y0, bx1 - 1, y1, "w2")
    hline(img, bx0 + 1, bx1 - 1, y0, "w3")
    hline(img, bx0 + 1, bx1 - 1, y1, "w1")
    for gx in ((bx0 + 9,) if y0 == by0 + 1 else (bx0 + 18, bx0 + 63)): put(img, gx, y0 + 4, C("w1")); put(img, gx + 1, y0 + 4, C("w1")); put(img, gx + 2, y0 + 5, C("w1"))
# nails
for (nx, ny) in ((bx0 + 3, by0 + 3), (bx1 - 3, by0 + 3), (bx0 + 3, by1 - 4), (bx1 - 3, by1 - 4)):
    put(img, nx, ny, C("m1")); put(img, nx, ny - 1, C("m2"))
# lettering PORTO, 2x scale 3x5 font, dark wood on light plank band (second plank), cream letters on first plank would be small, so one big line
txt = "PORTO"
lw = len(txt) * 8 - 2
tx = bx0 + (bx1 - bx0 - lw) // 2 + 6
ty = by0 + 2
for i, ch in enumerate(txt):
    for gx, gy in glyph_pixels(ch):
        for dx in (0, 1):
            for dy in (0, 1):
                px, py = tx + i * 8 + gx * 2 + dx, ty + gy * 2 + dy
                put(img, px, py + 1, C("w3")) if False else None
                put(img, px, py, C("w0"))
# anchor icon on the lower plank, left (m1/m2 iron with a rope)
ax, ay = bx0 + 8, by0 + 14
vline(img, ax, ay, ay + 7, "m1"); hline(img, ax - 3, ax + 3, ay + 2, "m1")
for dx, dy in ((-4, 6), (-3, 7), (4, 6), (3, 7)): put(img, ax + dx, ay + dy, C("m1"))
hline(img, ax - 2, ax + 2, ay + 8, "m1"); put(img, ax - 1, ay, C("m1")); put(img, ax + 1, ay, C("m1")); put(img, ax, ay - 1, C("m2"))
vline(img, ax, ay + 1, ay + 7, "m2") if False else None
# small waves on the lower plank, right
for i, wx in enumerate(range(bx0 + 26, bx1 - 6, 8)):
    for k in range(6): put(img, wx + k, by0 + 17 + (1 if k in (1, 2, 4, 5) else 0) - (1 if k in (2, 3) else 0), C("a1"))
# rope coil hanging from the right post with a hanging lantern-free hook
for k in range(5): put(img, 86, 20 + k * 2, C("t2")); put(img, 87, 21 + k * 2, C("t1"))
# lamp-style cap light-free; base stones
for x0 in (10, 80):
    for (sx, sy, c) in ((x0 - 2, 61, "t1"), (x0 - 1, 60, "t2"), (x0 + 6, 61, "t1"), (x0 + 7, 62, "t0"), (x0 - 3, 62, "t0")):
        put(img, sx, sy, C(c))
img.save(os.path.join(OUT, 'porto-sign.png'))
sh = blank(W, 16)
sh.alpha_composite(shadow_ellipse(W, 16, 48, 7, 40, 5, 70)) if hasattr(sh, 'alpha_composite') else None
sh.save(os.path.join(OUT, 'porto-sign-shadow.png'))
print('porto-sign audit (off-palette, off-overlay):', audit(img), audit(sh))
