"""Animated plaza fountain (96x96 = 3x3 tiles, 8 frames) and its night variant.

Same stone basin, pedestal and bowl as `props.fountain_frames` (the static tileset fountain), with a
smoother 8-frame water cycle: two ripple rings, a breathing jet, arcs that follow the jet, falling
droplets and twinkling sparkles. Night: the pool is lit from below (lighter water ring around the
pedestal), sparkles are bigger and whiter, plus a faint a3/y2 halo outside the rim (translucent).
"""
import math

import numpy as np
from PIL import Image

from pixkit import C, R, rgb, blank, put, grid, m_ellipse, m_rect, m_rrect, Part, draw_parts
from nature import has

W = H = 96
N = 8


def basin():
    im = blank(W, H)
    outer = m_ellipse(W, H, 48, 54, 45, 28)
    wall = m_ellipse(W, H, 48, 62, 45, 28) | (outer & m_rect(W, H, 0, 54, W, H))
    draw_parts(im, [Part("wall", wall | outer, R["stone"], 1, band=2, light=False),
                    Part("rim", outer, R["stone"], 2, band=1, light=True, light_band=1)])
    a = np.array(im)
    for x in range(8, 92, 9):
        for y in range(58, 88):
            if wall[y, x] and not outer[y, x] and has(a, "t2")[y, x]:
                a[y, x, :3] = rgb("t1")
    return Image.fromarray(a, "RGBA"), outer


def pool(f, night):
    water = m_ellipse(W, H, 48, 53, 38, 21)
    wa = np.zeros((H, W, 4), np.uint8)
    wa[water] = C("a2")
    back = water & ~m_ellipse(W, H, 48, 57, 38, 21)
    wa[back] = C("a1")
    back2 = water & ~m_ellipse(W, H, 48, 55, 38, 21)
    wa[back2] = C("a0")
    X, Y = grid(W, H)
    d = np.sqrt((X - 48) ** 2 + ((Y - 56) / 0.55) ** 2)
    if night:
        # underwater lamp: lighter band around the pedestal foot
        lit = water & ~back & (d < 17)
        wa[lit] = C("a3")
        wa[water & ~back & (d >= 17) & (d < 21) & (((X + Y).astype(int)) % 2 == 0)] = C("a3")
    for k in range(2):
        r = 10 + ((f * 2 + k * 8) % 16)
        ring = water & (np.abs(d - r) < 0.7)
        ring &= ~m_ellipse(W, H, 48, 56, 9, 5) & ~back
        if night and r < 19:
            wa[ring] = C("wh")
            continue
        wa[ring] = C("a3" if r < 20 else "a2")
        if r >= 20:
            wa[ring & (Y > 56)] = C("a3")
    return Image.fromarray(wa, "RGBA")


def pedestal(im):
    ped = m_rrect(W, H, 43, 30, 52, 60, 1)
    foot = m_ellipse(W, H, 48, 59, 8, 3.5)
    bowl = m_ellipse(W, H, 48, 31, 14, 6) | m_ellipse(W, H, 48, 34, 11, 5)
    draw_parts(im, [Part("foot", foot, R["stone"], 1, band=1), Part("ped", ped, R["stone"], 2, band=1),
                    Part("bowl", bowl, R["stone"], 3, band=1)])
    bw = m_ellipse(W, H, 48, 30, 11, 3.6)
    ba = np.zeros((H, W, 4), np.uint8)
    ba[bw] = C("a2")
    ba[bw & ~m_ellipse(W, H, 48, 31.5, 11, 3.6)] = C("a1")
    im.alpha_composite(Image.fromarray(ba, "RGBA"))
    for x, y in ((47, 24), (48, 24), (47, 25), (48, 25), (47, 26), (48, 26), (47, 27), (48, 27)):
        put(im, x, y, C("t3"))


def jet(im, f):
    ph = 2 * math.pi * f / N
    top = 9 + round(2.5 * math.sin(ph))          # jet height above the nozzle (6..12)
    for t in range(top):
        put(im, 47, 22 - t, C("a3" if (t + f) % 3 else "wh"))
        put(im, 48, 22 - t, C("a2"))
    # crown at the top of the jet
    put(im, 46, 22 - top, C("a3"))
    put(im, 49, 22 - top, C("a3"))
    put(im, 47, 21 - top, C("wh"))
    # arcs: higher when the jet is high
    lift = 8 + 2 * math.sin(ph)
    for side in (-1, 1):
        for t in range(0, 22):
            u = t / 21
            x = 48 + side * (2 + u * 12)
            y = 22 - lift * math.sin(math.pi * u * 0.9) + u * 10
            c = "a3" if (t + f) % 6 else "wh"
            put(im, int(x) - (1 if side < 0 else 0), int(y), C(c))


def droplets(im, f):
    # drops fall from the bowl lip into the pool; each loops every 4 frames (period divides 8)
    for dx, ph in ((-15, 0), (15, 2), (-9, 1), (9, 3), (-12, 3), (12, 1)):
        k = (f + ph) % 4
        yy = 37 + k * 3 + (1 if abs(dx) == 12 else 0)
        put(im, 48 + dx, yy, C("a3"))
        if k == 3:
            # tiny splash where it lands
            put(im, 48 + dx - 1, yy + 2, C("wh"))
            put(im, 48 + dx + 1, yy + 2, C("wh"))


SPARK = [(30, 50), (66, 60), (58, 46), (36, 64), (70, 52), (26, 58), (40, 48), (62, 66)]


def sparkles(im, f, night):
    # every sparkle lives 3 frames (dot, plus, dot) with staggered starts: seamless over 8 frames
    for i, (x, y) in enumerate(SPARK):
        k = (f - i * 3) % N
        if k > 2:
            continue
        if k == 1:
            put(im, x, y, C("wh"))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                put(im, x + dx, y + dy, C("wh" if night else "a3"))
            if night:
                for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
                    put(im, x + dx, y + dy, C("a3"))
        else:
            put(im, x, y, C("wh" if night else "a3"))


def halo(rim):
    """faint warm-blue halo around the rim, translucent and only outside the stone"""
    X, Y = grid(W, H)
    d = np.sqrt(((X - 48) / 47) ** 2 + ((Y - 58) / 33) ** 2)
    a = np.zeros((H, W, 4), np.uint8)
    ring1 = (d < 1.0) & ~rim
    ring2 = (d < 1.07) & ~ring1 & ~rim
    a[ring2, :3] = rgb("a3")
    a[ring2, 3] = 26
    a[ring1, :3] = rgb("y2")
    a[ring1, 3] = 44
    return Image.fromarray(a, "RGBA")


def frame(f, night=False):
    im, outer = basin()
    im.alpha_composite(pool(f, night))
    pedestal(im)
    jet(im, f)
    droplets(im, f)
    sparkles(im, f, night)
    if night:
        op = np.array(im)[..., 3] == 255
        h = halo(op)
        out = h.copy()
        out.alpha_composite(im)
        im = out
    return im


def fountain_rows():
    return [frame(f) for f in range(N)], [frame(f, True) for f in range(N)]
