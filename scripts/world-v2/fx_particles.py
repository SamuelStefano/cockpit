"""Smoke styles, merge confetti and the level-up star pop.

Smoke: every puff lives exactly one loop (6 frames) and the puffs are evenly staggered, so the
last frame flows into the first. Puffs are opaque (same part renderer as the tileset smoke) and
break apart with a checker erosion near the end of their life instead of fading with alpha.
"""
import math

import numpy as np
from PIL import Image

from pixkit import C, blank, put, grid, m_ellipse, m_poly, shift, Part, draw_parts, shape
from fxkit import lcg

STYLES = {
    # ramp (outline, shade, base, light), frame size, puffs per loop, start radius, end radius, rise
    "chimney": dict(ramp=["t1", "t2", "t4", "wh"], size=(32, 64), puffs=4, r0=2.5, r1=7.0, rise=50, drift=5,
                    src=(14, 60)),
    "tower": dict(ramp=["ol1", "m0", "m1", "m2"], size=(32, 64), puffs=4, r0=4.0, r1=9.5, rise=46, drift=4,
                  src=(16, 60)),
    "boat": dict(ramp=["ol0", "m0", "m1", "m2"], size=(32, 32), puffs=3, r0=2.5, r1=6.0, rise=22, drift=3,
                 src=(15, 29)),
}
N = 6


def erode(m, level):
    if level <= 0:
        return m
    X, Y = grid(*m.shape[::-1])
    xi, yi = X.astype(int), Y.astype(int)
    edge = m & ~(shift(m, 1, 0) & shift(m, -1, 0) & shift(m, 0, 1) & shift(m, 0, -1))
    m = m & ~(edge & ((xi + yi) % 2 == 0))
    if level >= 2:
        m = m & ~(((xi + yi * 2) % 3) == 0)
    return m


def smoke_frame(style, f):
    s = STYLES[style]
    w, h = s["size"]
    sx, sy = s["src"]
    layers = []
    for k in range(s["puffs"]):
        u = ((f + k * N / s["puffs"]) % N) / N          # life 0..1
        r = s["r0"] + (s["r1"] - s["r0"]) * math.sqrt(u)
        cy = sy - r * 0.8 - u * s["rise"]
        cx = sx + s["drift"] * u + 1.5 * math.sin(u * 2 * math.pi + k)
        m = m_ellipse(w, h, cx, cy, r, r * 0.9)
        m |= m_ellipse(w, h, cx - r * 0.5, cy - r * 0.4, r * 0.62, r * 0.6)
        m |= m_ellipse(w, h, cx + r * 0.65, cy + r * 0.05, r * 0.58, r * 0.55)
        level = 0 if u < 0.6 else (1 if u < 0.8 else 2)
        p = shape(w, h, [Part("puff", m, s["ramp"], 1, band=1, light=True)])
        # break the rendered puff apart (not the mask, so it keeps its shading)
        keep = erode(m, level)
        a = np.array(p)
        a[~keep] = 0
        layers.append((u, Image.fromarray(a, "RGBA")))
    im = blank(w, h)
    # older puffs are drawn behind younger ones
    for _, p in sorted(layers, key=lambda t: -t[0]):
        im.alpha_composite(p)
    return im


def smoke_rows():
    return {st: [smoke_frame(st, f) for f in range(N)] for st in STYLES}


# ---------------------------------------------------------------- confetti
BRIGHT = [("g2", "g1"), ("y1", "y0"), ("k1", "k0"), ("a2", "a1"), ("h3", "h2")]


def piece(im, x, y, kind, phase, col):
    """pieces are at most 3x2 (paper) or 2x2 (chip); rectangles flip between face-on (wide, light
    colour) and edge-on (thin, dark colour) for the spin illusion"""
    lt, dk = col
    x, y = int(round(x)), int(round(y))
    st = phase % 4
    if kind == 0:   # paper rectangle, 3x2 face-on
        if st == 0:
            for dx in range(3):
                for dy in range(2):
                    put(im, x + dx, y + dy, C(lt))
        elif st == 1:   # tilted one way
            put(im, x, y, C(dk))
            put(im, x + 1, y, C(lt))
            put(im, x + 1, y + 1, C(dk))
        elif st == 3:   # tilted the other way
            put(im, x + 1, y, C(dk))
            put(im, x, y, C(lt))
            put(im, x, y + 1, C(dk))
        else:           # edge-on
            put(im, x + 1, y, C(dk))
            put(im, x + 1, y + 1, C(dk))
    else:            # square chip, 2x2 face-on
        if st in (0, 2):
            put(im, x, y, C(lt))
            put(im, x + 1, y, C(lt))
            put(im, x, y + 1, C(lt))
            put(im, x + 1, y + 1, C(dk))
        else:
            put(im, x, y, C(dk))
            put(im, x + 1, y + 1, C(dk))


BURST_SIZE = 192            # frame side; spread stays within ~3 tiles (96 px) of the pop
BURST_POP = (96, 98)        # pop point, at the top of the bot's head
BURST_ANCHOR = (96, 140)    # bot feet (origin)
BURST_PIECES = 120


def burst_frames(n=10):
    W = H = BURST_SIZE
    rnd = lcg(20261117)
    pieces = []
    for i in range(BURST_PIECES):
        ang = -math.pi / 2 + (rnd() - 0.5) * 3.6
        sp = 0.8 + rnd() * 1.9
        pieces.append(dict(vx=math.cos(ang) * sp, vy=math.sin(ang) * sp - 0.2, kind=1 if i % 3 == 0 else 0,
                           col=BRIGHT[i % 5], ph=int(rnd() * 4), spin=1 + (i % 2), gone=7 + int(rnd() * 3)))
    frames = []
    cx, cy = BURST_POP
    for f in range(n):
        im = blank(W, H)
        if f <= 1:
            # pop flash at the origin
            r = 3 if f == 0 else 6
            for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
                put(im, cx + dx, cy + dy, C("wh"))
            for k in range(8):
                a = k * math.pi / 4
                put(im, cx + round(math.cos(a) * r), cy + round(math.sin(a) * r), C("y2" if k % 2 else "wh"))
        t = f + 0.6
        for p in pieces:
            if f >= p["gone"]:
                continue
            # drag + gravity: fast pop, then a slow drift down (gravity term never exceeds 8 px/frame)
            drag = (1 - 0.72 ** t) / 0.28
            x = cx + p["vx"] * drag * 7.0
            y = cy + p["vy"] * drag * 7.0 + 0.4 * t * t
            ph = p["ph"] + f * p["spin"]
            if f >= p["gone"] - 1 and (int(x) + int(y)) % 2:
                continue   # thin out just before the piece disappears
            piece(im, x, y, p["kind"], ph, p["col"])
        frames.append(im)
    return frames


FALL_W, FALL_H, FALL_N, FALL_STEP = 192, 96, 12, 8   # 12 x 8 px = 96 px: seamless
FALL_ANCHOR = (96, 72)                              # bot feet


def fall_frames():
    """seamless loop centred on the bot: every piece falls 8 px per frame (12 x 8 = 96 = frame height)
    with a sway of period 12; pieces cluster near the middle and only show inside an ellipse of
    96 x 48 px radius, so the shower stays within ~3 tiles of the bot"""
    W, H, n = FALL_W, FALL_H, FALL_N
    cx, cy = W / 2, H / 2
    rnd = lcg(77)
    pieces = []
    for i in range(40):
        # triangular distribution: denser over the bot, sparse at the sides
        dx = (rnd() - rnd()) * 88
        pieces.append(dict(x=cx + dx, y=rnd() * H, ph=int(rnd() * 4), kind=1 if i % 3 == 0 else 0,
                           col=BRIGHT[i % 5], sw=1.0 + rnd() * 2, sp=rnd() * 6.28))
    frames = []
    for f in range(n):
        im = blank(W, H)
        for p in pieces:
            y = (p["y"] + FALL_STEP * f) % H
            x = p["x"] + p["sw"] * math.sin(2 * math.pi * f / n + p["sp"])
            if ((x - cx) / 94) ** 2 + ((y - cy) / 50) ** 2 > 1:
                continue
            ph = p["ph"] + f   # flip period 4 divides the 12-frame loop
            piece(im, x, y - 2, p["kind"], ph, p["col"])
        frames.append(im)
    return frames


def star_mask(w, h, cx, cy, r_out, r_in, rot=0.0):
    pts = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5 + rot
        r = r_out if k % 2 == 0 else r_in
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return m_poly(w, h, pts)


def star_pop_frames(W=32, H=32):
    """level up: a star pops (squash, overshoot, settle), sparkles fly out, then it twinkles away"""
    spec = [(4, 0.0), (10, 0.0), (13, 0.15), (11, 0.0), (11, 0.0), (8, 0.0)]
    frames = []
    for f, (r, rot) in enumerate(spec):
        im = blank(W, H)
        m = star_mask(W, H, 16, 17, r, r * 0.45, rot)
        if f == 5:
            X, Y = grid(W, H)
            m &= ((X.astype(int) + Y.astype(int)) % 2 == 0) | m_ellipse(W, H, 16, 17, 4, 4)
        draw_parts(im, [Part("star", m, ["y0", "y1", "y1", "y2"], 1, band=1, light=True)])
        if 1 <= f <= 4:
            put(im, 14, 14, C("wh"))
            put(im, 15, 13, C("wh"))
        # radiating sparkles
        if f >= 2:
            d = [0, 0, 12, 14, 15, 15][f]
            for k in range(8):
                a = k * math.pi / 4 + math.pi / 8
                x, y = 16 + math.cos(a) * d, 17 + math.sin(a) * d
                col = "wh" if (k + f) % 2 else "y2"
                if f == 5 and k % 2:
                    continue
                put(im, round(x), round(y), C(col))
                if f in (2, 3):
                    put(im, round(x - math.cos(a)), round(y - math.sin(a)), C("y1"))
        frames.append(im)
    return frames
