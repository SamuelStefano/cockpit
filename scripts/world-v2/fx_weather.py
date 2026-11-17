"""Rain overlay (64x64 seamless, 4 frames), ground splash, puddle + ripple, and the dim-sky tint.

Seamless in space: every streak is drawn with wrap-around (mod 64).
Seamless in time: the near layer moves (-16, +48) px per frame, so after 4 frames it has moved
(-64, +192) = a whole number of tiles; the far layer moves (-8, +24) on a 32 px lattice (its drop
field repeats every 32 px), so 4 frames = (-32, +96), again whole periods. Slope is 1:3 for both.
"""
import numpy as np
from PIL import Image

from pixkit import rgb, grid
from fxkit import lcg, stack_alpha

RW = 64
NR = 4


def _streak(al, colours, x, y, length, alpha, col, period):
    for t in range(length):
        yy = int(round(y + t)) % period
        xx = int(round(x - t / 3.0)) % period
        a = alpha * (0.55 + 0.45 * t / max(1, length - 1))   # brighter head (bottom)
        if a > al[yy, xx]:
            al[yy, xx] = a
            colours[yy, xx] = col


def rain_frames():
    near_rnd, far_rnd = lcg(31), lcg(57)
    near = [(near_rnd() * 64, near_rnd() * 64) for _ in range(9)]
    far = [(far_rnd() * 32, far_rnd() * 32) for _ in range(5)]
    frames = []
    for f in range(NR):
        al = np.zeros((RW, RW))
        col = np.zeros((RW, RW), int)   # 0 = a2 (far), 1 = a3 (near), 2 = wh (near head)
        # far layer on a 32px lattice, tiled 2x2 into the 64 tile
        fal = np.zeros((32, 32))
        fcol = np.zeros((32, 32), int)
        for (x, y) in far:
            _streak(fal, fcol, x - 8 * f, y + 24 * f, 4, 70, 0, 32)
        al[:] = np.tile(fal, (2, 2))
        col[:] = np.tile(fcol, (2, 2))
        for (x, y) in near:
            _streak(al, col, x - 16 * f, y + 48 * f, 7, 120, 1, 64)
            # white head pixel
            hy, hx = int(round(y + 48 * f + 6)) % 64, int(round(x - 16 * f - 2)) % 64
            al[hy, hx] = 150
            col[hy, hx] = 2
        layers = []
        for k, c in enumerate(("a2", "a3", "wh")):
            layers.append((np.where(col == k, al, 0), c))
        frames.append(stack_alpha(layers))
    return frames


def splash_frames(W=32, H=16):
    """ground splash, 4 frames: impact, crown, droplets falling, fading ring"""
    out = []
    cx, cy = 16, 12
    specs = [
        [(0, 0, "wh", 200), (-1, 0, "a3", 140), (1, 0, "a3", 140)],
        [(-2, -1, "a3", 170), (2, -1, "a3", 170), (-1, -2, "wh", 190), (1, -2, "wh", 190), (-3, 0, "a3", 120),
         (3, 0, "a3", 120), (0, 0, "a3", 90)],
        [(-4, -3, "a3", 150), (4, -3, "a3", 150), (-2, -4, "wh", 160), (2, -4, "wh", 160), (-4, 0, "a3", 80),
         (4, 0, "a3", 80), (-3, 1, "a3", 60), (3, 1, "a3", 60)],
        [(-5, -1, "a3", 110), (5, -1, "a3", 110), (-5, 0, "a3", 60), (5, 0, "a3", 60), (-4, 1, "a3", 50),
         (4, 1, "a3", 50), (-2, 1, "a3", 40), (2, 1, "a3", 40)],
    ]
    for sp in specs:
        al = {c: np.zeros((H, W)) for c in ("a3", "wh")}
        for dx, dy, c, a in sp:
            al[c][cy + dy, cx + dx] = a
        out.append(stack_alpha([(al["a3"], "a3"), (al["wh"], "wh")]))
    return out


def ripple_frames(W=32, H=16, n=6):
    X, Y = grid(W, H)
    out = []
    for f in range(n):
        r = 1.5 + f * 2.2
        d = np.sqrt(((X - 16) / r) ** 2 + ((Y - 8) / (r * 0.45)) ** 2)
        ring = np.abs(d - 1.0) < (0.55 / max(1.0, r * 0.45))
        ring |= (np.abs(d - 1.0) < 0.22)
        a = np.where(ring, 150 * (1 - f / n) + 20, 0)
        # the front edge (bottom half) is lighter, like the rest of the tileset's water highlights
        wh = np.where(ring & (Y > 8) & (f < 3), a, 0)
        out.append(stack_alpha([(np.where(wh > 0, 0, a), "a3"), (wh, "wh")]))
    return out


def puddle(W=32, H=16):
    """flat puddle (translucent water + a lighter rim), drawn on the ground under the ripples"""
    X, Y = grid(W, H)
    body = (((X - 16) / 13) ** 2 + ((Y - 8) / 5.2) ** 2) <= 1
    lobe = (((X - 9) / 6) ** 2 + ((Y - 10) / 3.4) ** 2) <= 1
    m = body | lobe
    inner = m & np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1)
    rim = m & ~inner
    a1 = np.where(inner, 110, 0)
    top = rim & (Y < 8)
    return stack_alpha([(a1, "a1"), (np.where(rim & ~top, 90, 0), "a2"), (np.where(top, 70, 0), "a0"),
                        (np.where(inner & (((X - 2 * Y).astype(int) % 11) == 0) & (Y > 6), 120, 0), "a3")])


def sky_tints():
    """dim-sky tint: one colour (p0), three strengths, 32x32 each; the engine stretches it over the view"""
    return [stack_alpha([(np.full((32, 32), a, float), "p0")]) for a in (48, 80, 112)]
