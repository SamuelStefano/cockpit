"""Rain overlay (64x64 seamless, 4 frames), ground splash, puddle + ripple, and the dim-sky tint.

Seamless in space: every streak is drawn with wrap-around (mod 64).
Seamless in time: the near layer (64x64 tile) moves (-16, +48) px per frame, so after 4 frames it has moved
(-64, +192) = whole tiles; the far layer is a separate 48x48 tile at a slower (-12, +36) px per frame,
4 frames = (-48, +144) = whole tiles. Slope is 1:3 for both; the two periods (64 and 48) do not share a repeat.
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
    """Near layer: 64x64 tile, (-16, +48) px per frame, bright streaks with a white head."""
    near_rnd = lcg(31)
    near = [(near_rnd() * 64, near_rnd() * 64) for _ in range(13)]
    frames = []
    for f in range(NR):
        al = np.zeros((RW, RW))
        col = np.zeros((RW, RW), int)   # 1 = a3 (near), 2 = wh (near head)
        for (x, y) in near:
            _streak(al, col, x - 16 * f, y + 48 * f, 8, 165, 1, 64)
            hy, hx = int(round(y + 48 * f + 7)) % 64, int(round(x - 16 * f - 7 / 3.0)) % 64
            al[hy, hx] = 200
            col[hy, hx] = 2
        layers = []
        for k, c in ((1, "a3"), (2, "wh")):
            layers.append((np.where(col == k, al, 0), c))
        frames.append(stack_alpha(layers))
    return frames


FW = 48


def rain_far_frames():
    """Far layer: its own 48x48 tile (not a divisor of the 64 near tile) and a slower speed,
    (-12, +36) px per frame, so after 4 frames it moved (-48, +144) = whole tiles."""
    far_rnd = lcg(57)
    far = [(far_rnd() * FW, far_rnd() * FW) for _ in range(7)]
    frames = []
    for f in range(NR):
        al = np.zeros((FW, FW))
        col = np.zeros((FW, FW), int)
        for (x, y) in far:
            _streak(al, col, x - 12 * f, y + 36 * f, 4, 95, 0, FW)
        frames.append(stack_alpha([(al, "a2")]))
    return frames


def splash_frames(W=32, H=16):
    """ground splash, 4 frames: impact, crown, droplets falling, fading ring"""
    out = []
    cx, cy = 16, 12
    specs = [
        [(0, 0, "wh", 230), (-1, 0, "wh", 160), (1, 0, "wh", 160), (0, -1, "a3", 150)],
        [(-2, -1, "wh", 200), (2, -1, "wh", 200), (-1, -2, "wh", 220), (1, -2, "wh", 220), (-3, 0, "a3", 170),
         (3, 0, "a3", 170), (0, 0, "a3", 130), (-1, 0, "a3", 110), (1, 0, "a3", 110)],
        [(-4, -3, "wh", 190), (4, -3, "wh", 190), (-2, -4, "wh", 200), (2, -4, "wh", 200), (-4, 0, "a3", 140),
         (4, 0, "a3", 140), (-3, 1, "a3", 110), (3, 1, "a3", 110), (-2, 1, "a3", 80), (2, 1, "a3", 80)],
        [(-5, -1, "wh", 150), (5, -1, "wh", 150), (-5, 0, "a3", 110), (5, 0, "a3", 110), (-4, 1, "a3", 90),
         (4, 1, "a3", 90), (-2, 1, "a3", 70), (2, 1, "a3", 70), (0, 1, "a3", 50)],
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
