"""Deploy boat (side view, about 64x40) in a 96x56 frame: the hull sits at the right, the left third
is room for the wake trail and the rope to the dock. Waterline at y = 46; anchor (62, 46).

Rows: depart (12, one-shot), sail (6, loop), return (6, loop: dented hull, deck smoke, drooping flag,
drawn facing LEFT because it sails back to the dock), docked (4, loop), plus the separate wake strip.
The engine moves the sprite; the frames only animate the boat in place.
"""
import math

import numpy as np
from PIL import Image

from pixkit import C, R, rgb, blank, put, hline, vline, rect, grid, m_rect, m_rrect, m_poly, m_ellipse, \
    Part, draw_parts, shape
from fxkit import stack_alpha, flip, lcg

W, H = 96, 56
WL = 46            # waterline
ANCHOR = (62, 46)


def hull_parts(dy, dent):
    hull = m_poly(W, H, [(32, 31 + dy), (84, 31 + dy), (92, 28 + dy), (90, 35 + dy), (82, 47 + dy),
                         (36, 47 + dy), (31, 41 + dy)])
    parts = [Part("hull", hull, R["white"], 1, band=1, light=True)]
    cabin = m_rrect(W, H, 50, 19 + dy, 72, 31 + dy, 1)
    roof = m_rrect(W, H, 47, 16 + dy, 75, 19 + dy, 1)
    parts += [Part("cabin", cabin, R["cream"], 2, band=1, light=True),
              Part("roof", roof, R["navy"], 3, band=0, light=True),
              Part("motor", m_rrect(W, H, 25, 31 + dy, 32, 42 + dy, 1), R["steel"], 0.5, band=1, light=True),
              Part("motor_cap", m_rrect(W, H, 24, 29 + dy, 33, 33 + dy, 1), R["red"], 0.6, band=0, light=True),
              Part("mast", m_rect(W, H, 61, 3 + dy, 62, 16 + dy), R["wood"], 2.5, band=0)]
    return parts, hull


def draw_boat(dy=0, light=False, light_col="y1", flag=0, dent=False, coil=False):
    im = blank(W, H)
    parts, hull = hull_parts(dy, dent)
    draw_parts(im, parts)
    a = np.array(im)
    X, Y = grid(W, H)
    # orange deck stripe and a dark boot-top band at the waterline
    st = hull & (Y > 34 + dy) & (Y < 37 + dy)
    a[st & (a[..., 3] > 0) & ~np.all(a[..., :3] == rgb("t1"), -1), :3] = rgb("h3")
    a[st & (Y > 35 + dy) & (X > 80), :3] = rgb("h2")
    boot = hull & (Y >= 44 + dy)
    a[boot & ~np.all(a[..., :3] == rgb("t1"), -1), :3] = rgb("r0")
    # gunwale (wood rail) along the deck line
    rail = hull & (Y < 33 + dy)
    a[rail & ~np.all(a[..., :3] == rgb("t1"), -1), :3] = rgb("w2")
    im = Image.fromarray(a, "RGBA")
    hline(im, 33, 83, 31 + dy, "w3")
    # portholes on the cabin, name plate dots on the hull
    for x in (54, 61, 67):
        rect(im, x, 22 + dy, x + 2, 25 + dy, "a1")
        put(im, x, 22 + dy, C("a3"))
        put(im, x + 2, 25 + dy, C("a0"))
    for x in (40, 43, 46):
        put(im, x, 39 + dy, C("t1"))
    # motor detail: vent lines + the shaft going into the water
    for y in (34, 37, 40):
        hline(im, 26, 30, y + dy, "m1")
    vline(im, 28, 43 + dy, 47, "m0")
    vline(im, 29, 43 + dy, 47, "m1")
    if dent:
        # crumpled bow: a notch knocked into the hull, crack lines and a patch
        a = np.array(im)
        notch = m_poly(W, H, [(84, 37 + dy), (90, 34 + dy), (88, 41 + dy)])
        a[notch] = 0
        im = Image.fromarray(a, "RGBA")
        for (x, y) in ((83, 37), (82, 38), (83, 39), (81, 40), (84, 41), (83, 42), (82, 36)):
            put(im, x, y + dy, C("t1"))
        for (x, y) in ((76, 38), (77, 39), (78, 38), (79, 40)):
            put(im, x, y + dy, C("m1"))
        rect(im, 42, 37 + dy, 46, 40 + dy, "w2")   # wooden patch
        hline(im, 42, 46, 37 + dy, "w3")
        put(im, 42, 40 + dy, C("w0"))
        put(im, 46, 40 + dy, C("w0"))
        put(im, 70, 18 + dy, C("ol1"))   # scorch on the roof
        put(im, 71, 18 + dy, C("ol1"))
        put(im, 70, 17 + dy, C("m0"))
    # mast lamp: off = grey glass, on = lit
    rect(im, 60, 1 + dy, 63, 3 + dy, "m1")
    put(im, 61, 2 + dy, C(light_col if light else "m2"))
    put(im, 62, 2 + dy, C(light_col if light else "m2"))
    if light:
        put(im, 61, 1 + dy, C("y2" if light_col == "y1" else "r2"))
    # flag on the mast, streaming back (left): flag 0/1 = two waving poses, 2 = drooping
    fy = 5 + dy
    if flag in (0, 1):
        wave = [[0, 0, 1, 1, 1, 0, 0, -1, -1], [0, 1, 1, 0, 0, -1, -1, 0, 0]][flag]
        for i, wv in enumerate(wave):
            x = 60 - i
            for k in range(4):
                put(im, x, fy + k + wv, C("g2" if k < 2 else "g1"))
            put(im, x, fy + wv, C("g3"))
        put(im, 60 - len(wave), fy + 1 + wave[-1], C("g1"))
    else:
        # limp flag hanging along the mast
        for k in range(8):
            put(im, 60, fy + k, C("g1" if k > 1 else "g2"))
            put(im, 59, fy + k + 1, C("g0" if k > 3 else "g1"))
            if k < 4:
                put(im, 58, fy + k + 3, C("g0"))
    if coil:
        # the cast-off rope coiled at the stern
        draw_parts(im, [Part("coil", m_ellipse(W, H, 39, 30 + dy, 4, 2), ["w0", "w2", "w3", "t4"], 1, band=0)])
        put(im, 39, 30 + dy, C("w1"))
    # cut everything under the waterline (hull sits in the water)
    a = np.array(im)
    a[WL + 1:, 30:] = 0
    return Image.fromarray(a, "RGBA")


def rope(im, state, dy=0):
    """state 0 taut to the dock (left edge), 1 slack, 2 falling end; returns image"""
    sx, sy = 34, 32 + dy
    if state == 0:
        for x in range(0, sx):
            u = x / sx
            y = sy + 3 * math.sin(math.pi * u) * 0.6 + (1 - u) * 4
            put(im, x, int(round(y)), C("w2"))
            put(im, x, int(round(y)) + 1, C("w0"))
    elif state == 1:
        for x in range(0, sx):
            u = x / sx
            y = sy + 9 * math.sin(math.pi * u) + (1 - u) * 4
            put(im, x, int(round(y)), C("w2"))
            put(im, x, int(round(y)) + 1, C("w0"))
    else:
        # thrown: the end flies up and back over the stern
        for t in range(12):
            u = t / 11
            x = sx - 2 - 10 * math.sin(math.pi * u * 0.8)
            y = sy - 9 * u + 2
            put(im, int(round(x)), int(round(y)), C("w2"))
            put(im, int(round(x)) + 1, int(round(y)), C("w0"))
    return im


# ---------------------------------------------------------------- water bits (translucent)
def foam_layer(phase, length, bow=True, churn=0, lap=True, flipx=False, m=6):
    """wake trail behind the stern (towards x=0), bow wave, prop churn and the waterline lap"""
    al = {"a3": np.zeros((H, W)), "wh": np.zeros((H, W))}
    rnd = lcg(5)
    if lap:
        for x in range(31, 84):
            # moduli divide the loop length so every row loops seamlessly
            if (x + phase) % m != 0:
                al["a3"][WL + 1, x] = 110
            if (x + phase * 2) % (2 * m) == 0:
                al["wh"][WL + 1, x] = 160
    if churn:
        for k in range(6 + churn * 3):
            x = 22 + int(rnd() * 10) - ((phase * 3 + k) % 4)
            y = WL + int(rnd() * 3) - (1 if k % 3 == 0 else 0)
            al["wh" if k % 2 else "a3"][y, max(0, x)] = 170
    if length > 0:
        x0 = 30
        for x in range(max(0, x0 - length), x0):
            d = x0 - x                        # distance behind the stern
            spread = min(4, d // 6)
            for yy in (WL + 1 - spread // 2, WL + 2 + spread, WL + 3 + spread):
                if 0 <= yy < H and (x + phase * 3 + yy) % 6 not in (0, 1):
                    a = max(70, 220 - d * 4)
                    al["wh" if (x + phase * 3) % 6 == 2 else "a3"][yy, x] = a
            if (x * 7 + phase * 6) % 12 == 0:
                al["wh"][WL + 1 + (d % 3), x] = max(50, 190 - d * 4)
    if bow:
        b = [(85, 45), (87, 44), (89, 45), (91, 46), (86, 47), (90, 47), (93, 47)]
        for i, (x, y) in enumerate(b):
            if (i + phase) % 3:
                al["wh" if i % 2 else "a3"][y, x] = 170
    img = stack_alpha([(al["a3"], "a3"), (al["wh"], "wh")])
    return flip(img) if flipx else img


def engine_puff(im, x, y, r, colour_ramp=("m1", "m2", "t2", "t4"), erode=0):
    m = m_ellipse(W, H, x, y, r, r * 0.85) | m_ellipse(W, H, x - r * 0.6, y + r * 0.2, r * 0.6, r * 0.5)
    p = shape(W, H, [Part("puff", m, list(colour_ramp), 1, band=1, light=True)])
    if erode:
        a = np.array(p)
        X, Y = grid(W, H)
        a[((X.astype(int) + Y.astype(int)) % 2 == 0) & ~m_ellipse(W, H, x, y, r * 0.5, r * 0.5)] = 0
        if erode > 1:
            a[((X.astype(int) * 2 + Y.astype(int)) % 3 == 0)] = 0
        p = Image.fromarray(a, "RGBA")
    im.alpha_composite(p)


def compose(boat, foam, extras=()):
    im = blank(W, H)
    im.alpha_composite(foam)
    im.alpha_composite(boat)
    for e in extras:
        im.alpha_composite(e)
    return im


# ---------------------------------------------------------------- rows
def depart_frames():
    out = []
    bob = [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0]
    for f in range(12):
        dy = bob[f]
        light = f >= 3
        boat = draw_boat(dy, light=light and f % 2 == 1 or f >= 6, flag=(f // 2) % 2 if f >= 7 else 2 - (f >= 4),
                         coil=f >= 3)
        if f < 3:
            boat = rope(boat, f, dy)
        churn = 1 if 4 <= f < 7 else (2 if f >= 7 else 0)
        length = 0 if f < 7 else min(30, (f - 6) * 7)
        foam = foam_layer(f, length, bow=f >= 8, churn=churn)
        im = compose(boat, foam)
        # engine puffs: start at f4 above the motor cap and drift back (left) as the boat speeds up
        for k, start in enumerate((4, 6, 8)):
            if f >= start:
                age = f - start
                if age > 4:
                    continue
                engine_puff(im, 28 - age * (2 + k), 26 - age * 3, 2.5 + age * 1.1, erode=0 if age < 3 else age - 2)
        out.append(im)
    return out


def sail_frames():
    out = []
    bob = [0, 0, 1, 1, 1, 0]
    for f in range(6):
        boat = draw_boat(bob[f], light=True, flag=f % 2, coil=True)
        foam = foam_layer(f * 2, 30, bow=True, churn=1)
        out.append(compose(boat, foam))
    return out


def return_frames():
    """dented, smoking, flag drooping; drawn facing left (mirror of the right-facing drawing)"""
    out = []
    bob = [0, 1, 1, 1, 0, 0]
    for f in range(6):
        dy = bob[f]
        boat = draw_boat(dy, light=f % 3 != 2, light_col="r1", flag=2, dent=True, coil=True)
        foam = foam_layer(f, 14, bow=True, churn=0)
        im = compose(boat, foam)
        # deck smoke: 3 staggered black-grey puffs from the cabin roof, drifting back (left before the flip)
        for k in range(3):
            u = ((f + k * 2) % 6) / 6
            x = 54 - u * 16
            y = 18 + dy - u * 15
            r = 3 + u * 4.5
            engine_puff(im, x, y, r, ("ol0", "m0", "m1", "m2"), erode=0 if u < 0.6 else (1 if u < 0.8 else 2))
        out.append(flip(im))
    return out


def docked_frames():
    out = []
    bob = [0, 1, 1, 0]
    for f in range(4):
        boat = draw_boat(bob[f], light=False, flag=2)
        boat = rope(boat, 0, bob[f])
        foam = foam_layer(f, 0, bow=False, churn=0, m=4)
        out.append(compose(boat, foam))
    return out


def wake_strip(n=6, WW=64, HH=16):
    """standalone wake overlay (alpha), stern at the right edge, trail to the left; seamless over 6 frames"""
    out = []
    for f in range(n):
        al = {"a3": np.zeros((HH, WW)), "wh": np.zeros((HH, WW))}
        for x in range(WW):
            d = WW - 1 - x
            spread = min(6, d // 8)
            for yy in (7 - spread // 2, 8 + spread):
                ph = (x + f * 2) % 6     # 2 px per frame, period 6 -> 6 frames x 2 = 12 = 2 periods
                if ph in (0, 1):
                    continue
                a = max(36, 180 - d * 2.3)
                al["wh" if ph == 2 else "a3"][yy, x] = a
            if (x + f * 2) % 12 == 5:
                al["wh"][8 + (d % 3) - 1, x] = max(50, 200 - d * 2.5)
            if d < 10 and (x + f) % 2 == 0:
                al["wh"][7 + (x % 3), x] = 150
        out.append(stack_alpha([(al["a3"], "a3"), (al["wh"], "wh")]))
    return out
