"""Interior art: floors, walls, furniture, PCs, decor, light/shadow overlays. 32px grid, light from top-left.
Sprites are opaque on transparent; every shadow, glow and light shaft is a separate overlay image."""
import math
import random

import numpy as np
from PIL import Image

from pixkit import (T, C, R, rgb, blank, fill, put, hline, vline, rect, grid, m_ellipse, m_rect, m_rrect, m_poly,
                    m_capsule, Part, draw_parts, overlay_from_alpha, glow_alpha, shift, draw_text)


def has(a, name):
    return np.all(a[..., :3] == rgb(name), axis=-1) & (a[..., 3] == 255)


def opaque(im):
    return np.array(im)[..., 3] == 255


def drop_shadow(im, dx=3, dy=3, alpha=80, floor_only_rows=None):
    """separate overlay: the sprite silhouette pushed down-right (light from top-left), soft rim"""
    m = opaque(im)
    if floor_only_rows is not None:
        keep = np.zeros_like(m)
        keep[floor_only_rows[0]:floor_only_rows[1]] = True
        m = m & keep
    s = shift(m, -dx, -dy)
    a = s.astype(float) * alpha
    edge = s & ~(shift(s, 1, 0) & shift(s, -1, 0) & shift(s, 0, 1) & shift(s, 0, -1))
    a[edge] = alpha * 0.55
    return overlay_from_alpha(a)


# ---------------------------------------------------------------- floors (tileable)
def wood_floor(vertical=False, light=False):
    base, hi, lo, seam = ("w3", "t3", "w3", "w2") if light else ("w2", "w3", "w2", "w1")
    im = fill(T, T, base)
    rnd = random.Random(21 if light else 22)
    for p in range(4):
        y0 = p * 8
        joint = [6, 22, 13, 28][p]
        hline(im, 0, 31, y0, seam)
        hline(im, 0, 31, y0 + 1, hi)
        hline(im, 0, 31, y0 + 7, lo)
        vline(im, joint, y0 + 1, y0 + 6, seam)
        vline(im, (joint + 1) % 32, y0 + 1, y0 + 6, hi)
        for _ in range(2):
            gx = rnd.randrange(32)
            gy = y0 + rnd.choice([3, 4, 5])
            put(im, gx, gy, C(lo))
            put(im, (gx + 1) % 32, gy, C(lo))
            put(im, (gx + 2) % 32, gy, C(lo))
    if vertical:
        im = im.transpose(Image.ROTATE_90)
    return im


def checker_floor(a="wh", b="t2", grout=None):
    im = fill(T, T, a)
    for qy in range(4):
        for qx in range(4):
            c = a if (qx + qy) % 2 == 0 else b
            rect(im, qx * 8, qy * 8, qx * 8 + 7, qy * 8 + 7, c)
            if c == a:
                put(im, qx * 8 + 1, qy * 8 + 1, C("wh" if a != "wh" else "t4"))
    if grout:
        for k in range(0, 32, 8):
            hline(im, 0, 31, k, grout)
            vline(im, k, 0, 31, grout)
    return im


CARPETS = {"red": ("r1", "r2", "r0"), "blue": ("a1", "a2", "a0"), "green": ("g1", "g2", "g0"),
           "navy": ("p1", "p2", "p0"), "pink": ("k1", "s3", "k0"), "mustard": ("y0", "y1", "h2")}


def carpet(colour):
    base, hi, lo = CARPETS[colour]
    im = fill(T, T, base)
    for y in range(0, 32, 4):
        for x in range((y // 4 % 2) * 2, 32, 4):
            put(im, x, y, C(hi))
            put(im, (x + 2) % 32, (y + 2) % 32, C(lo))
    return im


# ---------------------------------------------------------------- walls
WALLC = {"cream": ("t3", "t4", "t2", "t1"), "mint": ("g3", "wh", "g2", "g1"), "sky": ("a3", "wh", "a2", "a1")}
WAIN = 34  # wainscot top (cream only)
BASE = 56


def wall_face(colour, piece):
    """32x64: upper tile (crown + wallpaper) and lower tile (wallpaper/wainscot + baseboard)"""
    base, hi, lo, dark = WALLC[colour]
    im = fill(T, 64, base)
    a = np.array(im)
    ys, xs = np.mgrid[0:64, 0:T]
    if colour == "mint":
        a[(xs % 8 == 3), :3] = rgb("g2")
        a[(xs % 8 == 4) & (ys % 6 == 0), :3] = rgb("wh")
    elif colour == "sky":
        dots = ((xs + (ys // 8 % 2) * 4) % 8 == 2) & (ys % 8 == 4)
        a[dots, :3] = rgb("wh")
        a[dots & False, :3] = rgb("a2")
    im = Image.fromarray(a, "RGBA")
    # crown moulding
    hline(im, 0, 31, 0, dark)
    hline(im, 0, 31, 1, "wh")
    hline(im, 0, 31, 2, "t4")
    hline(im, 0, 31, 3, "t2")
    hline(im, 0, 31, 4, lo)
    if colour == "cream":
        rect(im, 0, WAIN, 31, BASE - 1, "w2")
        hline(im, 0, 31, WAIN, "w3")
        hline(im, 0, 31, WAIN + 1, "t4")
        hline(im, 0, 31, WAIN + 2, "w1")
        for x in (7, 15, 23, 31):
            vline(im, x, WAIN + 4, BASE - 2, "w1")
            vline(im, (x + 1) % 32, WAIN + 4, BASE - 2, "w3")
    # baseboard
    hline(im, 0, 31, BASE, "wh")
    rect(im, 0, BASE + 1, 31, 61, "t4")
    hline(im, 0, 31, 62, "t2")
    hline(im, 0, 31, 63, "ol1")
    if piece in ("l", "s"):
        vline(im, 0, 0, 63, dark)
        vline(im, 1, 5, 62, lo)
    if piece in ("r", "s"):
        vline(im, 31, 0, 63, dark)
        vline(im, 30, 5, 62, lo)
    return im


CAP = ("ol1", "t0", "t1")  # outline, top, lit edge
CAPW = 12


def cap(kind):
    """wall thickness seen from above. kind: top (band at the bottom of the tile, above a north face),
    bottom, left, right, nw, ne, sw, se, top_l_end..."""
    im = blank(T, T)
    m = np.zeros((T, T), bool)
    if "top" == kind:
        m |= m_rect(T, T, 0, T - CAPW, T - 1, T - 1)
    if "bottom" == kind:
        m |= m_rect(T, T, 0, 0, T - 1, CAPW - 1)
    if kind == "left":
        m |= m_rect(T, T, T - CAPW, 0, T - 1, T - 1)
    if kind == "right":
        m |= m_rect(T, T, 0, 0, CAPW - 1, T - 1)
    if kind == "nw":
        m |= m_rect(T, T, T - CAPW, T - CAPW, T - 1, T - 1)
    if kind == "ne":
        m |= m_rect(T, T, 0, T - CAPW, CAPW - 1, T - 1)
    if kind == "sw":
        m |= m_rect(T, T, T - CAPW, 0, T - 1, CAPW - 1)
    if kind == "se":
        m |= m_rect(T, T, 0, 0, CAPW - 1, CAPW - 1)
    a = np.zeros((T, T, 4), np.uint8)
    a[m] = C(CAP[1])
    # lit top/left rim, outline on the room side
    lit = m & ~shift(m, 0, -1, fill=True)
    lit |= m & ~shift(m, -1, 0, fill=True)
    a[lit] = C(CAP[2])
    outl = m & (~shift(m, 0, 1, fill=True) | ~shift(m, 1, 0, fill=True))
    a[outl] = C(CAP[0])
    # brick hint on the cap
    ys, xs = np.mgrid[0:T, 0:T]
    hint = m & ~lit & ~outl & (((xs * 5 + ys * 11) % 23) == 0)
    a[hint] = C("t1")
    return Image.fromarray(a, "RGBA")


def wall_shadow(kind):
    """overlay on the floor next to a wall: base (under the north wall), left (right of the west wall), corner"""
    al = np.zeros((T, T))
    vals = (90, 70, 50, 32, 16)
    if kind in ("base", "corner"):
        for k, v in enumerate(vals):
            al[k, :] = np.maximum(al[k, :], v)
    if kind in ("left", "corner"):
        for k, v in enumerate(vals):
            al[:, k] = np.maximum(al[:, k], v)
    return overlay_from_alpha(al)


def window(curtain="r"):
    im = blank(T, 64)
    W, H = T, 64
    draw_parts(im, [Part("frame", m_rect(W, H, 5, 9, 26, 40), R["white"], 1, band=0, light=True),
                    Part("glass", m_rect(W, H, 7, 11, 24, 38), ["a1", "a2", "a2", "a3"], 2, outline=False, band=-1),
                    Part("sill", m_rrect(W, H, 3, 40, 28, 43, 1), R["white"], 3, band=0)])
    a = np.array(im)
    for y in range(11, 39):
        for x in range(7, 25):
            if x in (15, 16) or y == 24:
                a[y, x, :3] = rgb("t4")
            elif (x - y) in (-8, -7, -16):
                a[y, x, :3] = rgb("wh")
            elif y > 31 and x < 15:
                a[y, x, :3] = rgb("q4") if (x + y) % 3 else rgb("q3")
    im = Image.fromarray(a, "RGBA")
    cr = {"r": R["red"], "g": R["green"], "k": R["pink"], "y": R["yellow"]}[curtain]
    draw_parts(im, [Part("rod", m_rect(W, H, 2, 6, 29, 7), R["dark_wood"], 4, band=0),
                    Part("cl", m_poly(W, H, [(2, 8), (9, 8), (7, 30), (4, 38), (2, 38)]), cr, 5, band=1),
                    Part("cr", m_poly(W, H, [(22, 8), (29, 8), (29, 38), (27, 38), (24, 30)]), cr, 5, band=1)])
    return im


def window_light():
    """64x96 overlay on the floor below a window (window at column 0): light falls down-right"""
    W, H = 64, 96
    m = m_poly(W, H, [(6, 0), (26, 0), (52, 70), (30, 70)])
    inner = m_poly(W, H, [(9, 2), (23, 2), (47, 64), (33, 64)])
    al = np.zeros((H, W))
    al[m] = 34
    al[inner] = 56
    X, Y = grid(W, H)
    mull = m & (np.abs((X - 16) - (Y * 26 / 70)) < 1.0)
    al[mull] = 20
    mul2 = m & (np.abs(Y - 30) < 1.0)
    al[mul2] = 20
    return overlay_from_alpha(al, "y2")


def door_frame():
    """32x64 overlay on a north wall face: open doorway with frame; lower tile is walkable"""
    im = blank(T, 64)
    W, H = T, 64
    draw_parts(im, [Part("frame", m_rect(W, H, 3, 12, 28, 63), R["wood"], 1, band=0, light=True),
                    Part("open", m_rect(W, H, 6, 15, 25, 63), ["ol0", "ol0", "ol1", "m0"], 2, outline=False,
                         band=-1)])
    for y in range(15, 64):
        for x in range(6, 26):
            if y > 50 and (x + y) % 2 == 0:
                put(im, x, y, C("m0"))
    hline(im, 6, 25, 15, "ol0")
    rect(im, 7, 58, 24, 63, "r0")
    hline(im, 7, 24, 58, "r1")
    return im


# ---------------------------------------------------------------- desks
TOP = ["w0", "w2", "w3", "t4"]
FACE = ["w0", "w0", "w1", "w2"]


def desk(kind):
    if kind == "single":
        W, H = 64, T
        im = blank(W, H)
        draw_parts(im, [Part("legs", m_rect(W, H, 3, 20, 6, 30) | m_rect(W, H, 57, 20, 60, 30), FACE, 1, band=0),
                        Part("face", m_rect(W, H, 1, 17, 62, 22) | m_rect(W, H, 40, 17, 61, 30), FACE, 2, band=0),
                        Part("top", m_rrect(W, H, 0, 5, 63, 17, 1), TOP, 3, band=0, light=True)])
        hline(im, 42, 59, 23, "w2")
        put(im, 50, 26, C("y1"))
        put(im, 51, 26, C("y0"))
        return im
    if kind == "double":
        W, H = 128, T
        im = blank(W, H)
        draw_parts(im, [Part("legs", m_rect(W, H, 3, 20, 6, 30) | m_rect(W, H, 121, 20, 124, 30) |
                             m_rect(W, H, 62, 20, 65, 30), FACE, 1, band=0),
                        Part("face", m_rect(W, H, 1, 17, 126, 22) | m_rect(W, H, 40, 17, 59, 30) |
                             m_rect(W, H, 104, 17, 125, 30), FACE, 2, band=0),
                        Part("top", m_rrect(W, H, 0, 5, 127, 17, 1), TOP, 3, band=0, light=True)])
        vline(im, 63, 6, 16, "w2")
        for x0 in (40, 104):
            hline(im, x0 + 2, x0 + 17, 23, "w2")
            put(im, x0 + 9, 26, C("y1"))
        return im
    # L desk: 3x2
    W, H = 96, 64
    im = blank(W, H)
    top = m_rrect(W, H, 0, 5, 95, 17, 1) | m_rrect(W, H, 68, 5, 95, 49, 1)
    face = m_rect(W, H, 1, 17, 68, 22) | m_rect(W, H, 68, 49, 94, 54) | m_rect(W, H, 70, 49, 92, 62)
    draw_parts(im, [Part("legs", m_rect(W, H, 3, 20, 6, 30), FACE, 1, band=0),
                    Part("face", face, FACE, 2, band=0),
                    Part("top", top, TOP, 3, band=0, light=True)])
    hline(im, 72, 90, 56, "w2")
    put(im, 81, 59, C("y1"))
    return im


# ---------------------------------------------------------------- chairs (32x32, 4 directions)
FAB = R["navy"]


def chair(direction, fabric=None):
    fab = fabric or FAB
    W, H = T, T
    im = blank(W, H)
    base = m_rect(W, H, 15, 21, 16, 26) | m_rect(W, H, 9, 26, 22, 27)
    wheels = m_rect(W, H, 8, 28, 9, 29) | m_rect(W, H, 22, 28, 23, 29) | m_rect(W, H, 15, 28, 16, 29)
    parts = [Part("base", base, R["metal"], 1, band=0), Part("wheels", wheels, ["ol0", "ol0", "m0", "m1"], 1.1,
                                                                    band=0)]
    if direction == "down":
        parts += [Part("back", m_rrect(W, H, 9, 2, 22, 15, 3), fab, 2, band=1, light=True),
                  Part("seat", m_rrect(W, H, 7, 13, 24, 21, 2), fab, 3, band=1, light=True)]
    elif direction == "up":
        parts += [Part("seat", m_rrect(W, H, 7, 9, 24, 17, 2), fab, 2, band=1, light=True),
                  Part("back", m_rrect(W, H, 9, 6, 22, 22, 3), fab, 3, band=1, light=True)]
    else:
        parts += [Part("seat", m_rrect(W, H, 7, 13, 22, 20, 2), fab, 2, band=1, light=True),
                  Part("post", m_rect(W, H, 21, 10, 22, 16), R["metal"], 2.5, band=0),
                  Part("back", m_rrect(W, H, 20, 1, 25, 16, 2), fab, 3, band=1, light=True)]
    draw_parts(im, parts)
    if direction == "up":
        hline(im, 12, 19, 10, fab[3])
    if direction == "left":
        pass
    if direction == "right":
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    return im


# ---------------------------------------------------------------- PCs (32x32 frames)
SCREEN = (8, 4, 23, 16)


def pc(view, state, frame=0):
    """view: front (screen faces the viewer) / back. state: off, on_a, on_b, alert"""
    W, H = T, T
    im = blank(W, H)
    body = m_rrect(W, H, 6, 2, 25, 19, 1)
    parts = [Part("stand", m_rect(W, H, 14, 19, 17, 23), R["metal"], 1, band=0),
             Part("foot", m_rrect(W, H, 10, 22, 21, 24, 1), R["metal"], 1.5, band=0),
             Part("body", body, ["ol0", "m0", "m1", "m2"], 2, band=0, light=True)]
    if view == "front":
        parts.append(Part("kb", m_rrect(W, H, 6, 25, 25, 29, 1), ["m0", "m1", "m2", "t3"], 3, band=0))
    draw_parts(im, parts)
    x0, y0, x1, y1 = SCREEN
    if view == "front":
        if state == "off":
            rect(im, x0, y0, x1, y1, "m0")
            for k in range(4):
                put(im, x0 + 2 + k, y0 + 1 + k, C("m1"))
        elif state in ("on_a", "on_b"):
            rect(im, x0, y0, x1, y1, "p0")
            rnd = random.Random(3)
            lines = [(0, 7, "g2"), (2, 9, "a2"), (2, 5, "y1"), (0, 10, "g2"), (4, 6, "k1"), (2, 8, "a2")]
            sh = 0 if state == "on_a" else 1
            for k in range(5):
                ind, ln, c = lines[(k + sh) % len(lines)]
                hline(im, x0 + 1 + ind, x0 + 1 + ind + ln - 1, y0 + 1 + k * 2, c)
            # cursor blinks
            if state == "on_a":
                rect(im, x0 + 9, y0 + 9, x0 + 10, y0 + 10, "wh")
            hline(im, x0, x1, y0, "p1")
        else:
            rect(im, x0, y0, x1, y1, "r0")
            hline(im, x0, x1, y0, "r1")
            tri = m_poly(W, H, [(15.5, y0 + 1), (20.5, y1 - 1), (10.5, y1 - 1)])
            a = np.array(im)
            a[tri] = C("y1" if frame == 0 else "r2")
            a[m_rect(W, H, 15, y0 + 4, 16, y0 + 7)] = C("r0")
            a[m_rect(W, H, 15, y0 + 9, 16, y0 + 9)] = C("r0")
            im = Image.fromarray(a, "RGBA")
        # keys
        for x in range(8, 24, 2):
            put(im, x, 26, C("t3"))
            put(im, x + 1, 27, C("m0"))
        hline(im, 11, 20, 28, "t3")
    else:
        # monitor back: vents, logo, power LED
        for y in (6, 8, 10):
            hline(im, 10, 21, y, "m0")
        rect(im, 14, 13, 17, 15, "m2")
        led = {"off": "m0", "on_a": "g2", "on_b": "g3", "alert": "r1" if frame == 0 else "r0"}[state]
        put(im, 22, 17, C(led))
        if state in ("on_a", "on_b"):
            # screen light leaking round the edges
            for x in range(7, 25, 3):
                put(im, x, 2, C("a3"))
        if state == "alert":
            for x in range(7, 25, 3):
                put(im, x, 2, C("r2" if frame == 0 else "r1"))
    return im


def pc_glow(state, frame=0):
    """screen spill (overlay) for a front-facing PC: drawn above, over the desk and the seated bot"""
    col = "a3" if state in ("on_a", "on_b") else "r1"
    if state == "off":
        return blank(T, T)
    k = 1.0 if state != "alert" or frame == 0 else 0.6
    return overlay_from_alpha(glow_alpha(T, T, 16, 12, 15, 13, 70 * k, steps=4), col)


# ---------------------------------------------------------------- storage
BOOKS = ["r1", "a1", "g1", "y0", "k0", "p1", "h2", "r0", "g2", "a0", "w3"]


def books_row(im, x0, x1, base, hmin, hmax, rnd):
    x = x0
    while x <= x1:
        wd = rnd.choice([1, 2, 2, 3])
        if x + wd - 1 > x1:
            break
        hh = rnd.randint(hmin, hmax)
        c = rnd.choice(BOOKS)
        for k in range(wd):
            vline(im, x + k, base - hh, base - 1, c)
        put(im, x, base - hh, C("t4" if c in ("p1", "a0", "r0", "k0") else "wh"))
        if wd == 3:
            put(im, x + 1, base - hh + 2, C("y1"))
        x += wd + (1 if rnd.random() < 0.12 else 0)


def bookshelf(variant):
    W, H = T, 64
    im = blank(W, H)
    draw_parts(im, [Part("frame", m_rect(W, H, 1, 2, 30, 62), R["wood"], 1, band=1, light=True),
                    Part("back", m_rect(W, H, 4, 6, 27, 59), ["w0", "w0", "w0", "w1"], 2, outline=False, band=-1)])
    rnd = random.Random(40 + variant)
    shelves = [18, 32, 46, 59]
    for k, b in enumerate(shelves):
        hline(im, 4, 27, b, "w2")
        hline(im, 4, 27, b + 1 if b + 1 < 60 else b, "w1")
        if variant == 2 and k == 1:
            # plant + box
            rect(im, 6, b - 6, 11, b - 1, "t4")
            hline(im, 6, 11, b - 6, "wh")
            for dx, dy in ((0, -9), (1, -10), (2, -8), (3, -10), (4, -9), (5, -11), (2, -11)):
                put(im, 6 + dx, b + dy, C("q3" if dy < -9 else "q2"))
            rect(im, 16, b - 8, 26, b - 1, "y1")
            hline(im, 16, 26, b - 8, "y2")
            vline(im, 26, b - 8, b - 1, "y0")
            continue
        if variant == 2 and k == 3:
            draw_parts(im, [Part("trophy", m_rect(im.width, im.height, 13, b - 10, 18, b - 6) |
                                 m_rect(im.width, im.height, 15, b - 6, 16, b - 3) |
                                 m_rect(im.width, im.height, 13, b - 3, 18, b - 1), R["yellow"], 3, band=0)])
            books_row(im, 20, 27, b, 6, 9, rnd)
            continue
        if variant == 1 and k == 2:
            # leaning books + bookend
            books_row(im, 4, 15, b, 7, 11, rnd)
            for t in range(9):
                put(im, 18 + t // 2, b - 1 - t, C("r1"))
                put(im, 19 + t // 2, b - 1 - t, C("r0"))
            continue
        books_row(im, 4, 27, b, 7, 11 if k else 10, rnd)
    hline(im, 1, 30, 2, "w3")
    return im


# ---------------------------------------------------------------- kitchenette
def counter(kind="plain"):
    W, H = T, T
    im = blank(W, H)
    draw_parts(im, [Part("cab", m_rect(W, H, 0, 12, 31, 30), R["wood"], 1, band=0, light=True),
                    Part("top", m_rect(W, H, 0, 3, 31, 12), R["white"], 2, band=0, light=True)])
    vline(im, 15, 15, 29, "w1")
    vline(im, 16, 15, 29, "w3")
    put(im, 13, 21, C("m2"))
    put(im, 18, 21, C("m2"))
    hline(im, 0, 31, 30, "ol1")
    if kind == "sink":
        draw_parts(im, [Part("basin", m_rrect(W, H, 7, 5, 24, 11, 1), ["m0", "m1", "m2", "a3"], 3, band=0,
                             light=False),
                        Part("tap", m_rect(W, H, 15, 0, 16, 5) | m_rect(W, H, 15, 0, 19, 1), R["steel"], 4,
                             band=0)])
        put(im, 18, 6, C("a3"))
        put(im, 18, 7, C("a3"))
    if kind == "stove":
        draw_parts(im, [Part("top2", m_rect(W, H, 0, 3, 31, 12), ["ol0", "m0", "m1", "m2"], 2.5, band=0),
                        Part("door", m_rect(W, H, 3, 15, 28, 28), ["ol0", "m0", "m0", "m1"], 3, band=0)])
        for cx in (9, 22):
            X, Y = grid(W, H)
            ring = np.abs(np.hypot(X - cx, (Y - 7.5) * 1.6) - 3.5) < 0.8
            a = np.array(im)
            a[ring & (a[..., 3] > 0)] = C("ol0")
            im = Image.fromarray(a, "RGBA")
        hline(im, 6, 25, 17, "m2")
        rect(im, 7, 20, 24, 26, "h1")
        hline(im, 7, 24, 20, "y0")
        for x in (6, 12, 19, 25):
            put(im, x, 13, C("r1"))
    return im


def fridge():
    W, H = T, 64
    im = blank(W, H)
    draw_parts(im, [Part("body", m_rrect(W, H, 3, 4, 28, 61, 2), R["white"], 1, band=1, light=True)])
    hline(im, 4, 27, 24, "t2")
    hline(im, 4, 27, 25, "wh")
    for y0, y1 in ((9, 20), (30, 44)):
        vline(im, 24, y0, y1, "m1")
        vline(im, 25, y0, y1, "m2")
    rect(im, 8, 12, 12, 16, "y1")
    rect(im, 14, 33, 18, 38, "k1")
    put(im, 10, 11, C("r1"))
    put(im, 16, 32, C("a1"))
    hline(im, 4, 27, 61, "t1")
    return im


def wall_cabinet():
    W, H = T, T
    im = blank(W, H)
    draw_parts(im, [Part("cab", m_rect(W, H, 1, 4, 30, 24), R["wood"], 1, band=1, light=True)])
    vline(im, 15, 5, 23, "w1")
    vline(im, 16, 5, 23, "w3")
    put(im, 13, 19, C("m2"))
    put(im, 18, 19, C("m2"))
    return im


def hood():
    W, H = T, T
    im = blank(W, H)
    draw_parts(im, [Part("duct", m_rect(W, H, 11, 0, 20, 12), R["steel"], 1, band=0),
                    Part("hood", m_poly(W, H, [(9, 12), (22, 12), (29, 22), (2, 22)]), R["steel"], 2, band=0,
                         light=True)])
    hline(im, 4, 27, 21, "m0")
    return im


# ---------------------------------------------------------------- living
def sofa():
    W, H = 64, 64
    im = blank(W, H)
    fab = R["mint"]
    draw_parts(im, [Part("back", m_rrect(W, H, 4, 12, 59, 34, 4), fab, 1, band=1, light=True),
                    Part("seat", m_rrect(W, H, 8, 30, 55, 48, 2), fab, 2, band=1, light=True),
                    Part("armL", m_rrect(W, H, 1, 22, 11, 52, 3), fab, 3, band=1, light=True),
                    Part("armR", m_rrect(W, H, 52, 22, 62, 52, 3), fab, 3, band=1, light=True),
                    Part("feet", m_rect(W, H, 6, 52, 8, 56) | m_rect(W, H, 55, 52, 57, 56), R["dark_wood"], 0.5,
                         band=0)])
    vline(im, 31, 31, 47, "g1")
    vline(im, 32, 31, 47, "g3")
    # cushion
    draw_parts(im, [Part("cushion", m_rrect(W, H, 13, 22, 25, 33, 3), R["yellow"], 4, band=1, light=True)])
    return im


def bed():
    W, H = T, 64
    im = blank(W, H)
    draw_parts(im, [Part("frame", m_rrect(W, H, 2, 6, 29, 62, 1), R["wood"], 1, band=0, light=True),
                    Part("head", m_rrect(W, H, 1, 1, 30, 12, 2), R["wood"], 2, band=1, light=True),
                    Part("mattress", m_rect(W, H, 4, 12, 27, 58), R["white"], 3, band=0),
                    Part("pillow", m_rrect(W, H, 7, 14, 24, 22, 2), R["white"], 4, band=1, light=True),
                    Part("blanket", m_rect(W, H, 4, 27, 27, 58), R["blue"], 5, band=1, light=True)])
    hline(im, 4, 27, 27, "wh")
    hline(im, 4, 27, 28, "a3")
    for y in range(34, 58, 6):
        hline(im, 5, 26, y, "a2")
    return im


def rug(kind):
    if kind == "round":
        W, H = 96, 96
        im = blank(W, H)
        X, Y = grid(W, H)
        r = np.hypot(X - 48, Y - 48)
        a = np.zeros((H, W, 4), np.uint8)
        rings = [(46, "r0"), (45, "r1"), (40, "t4"), (37, "r1"), (31, "y1"), (29, "r1"), (22, "t4"), (19, "k0"),
                 (12, "y1"), (9, "r1")]
        for rad, c in rings:
            a[r <= rad] = C(c)
        dots = (np.abs(r - 34) < 1.2) & (((np.arctan2(Y - 48, X - 48) * 12 / math.pi) % 2) < 0.6)
        a[dots] = C("t4")
        return Image.fromarray(a, "RGBA")
    W, H = 96, 64
    im = blank(W, H)
    rect(im, 4, 2, 91, 61, "p1")
    for x0, y0, x1, y1, c in ((4, 2, 91, 61, "a2"), (6, 4, 89, 59, "p1"), (9, 7, 86, 56, "a1"), (11, 9, 84, 54, "p1")):
        hline(im, x0, x1, y0, c)
        hline(im, x0, x1, y1, c)
        vline(im, x0, y0, y1, c)
        vline(im, x1, y0, y1, c)
    for cx in (30, 48, 66):
        dm = m_poly(W, H, [(cx, 18), (cx + 8, 32), (cx, 46), (cx - 8, 32)])
        a = np.array(im)
        a[dm] = C("t4")
        a[m_poly(W, H, [(cx, 24), (cx + 4, 32), (cx, 40), (cx - 4, 32)])] = C("r1")
        im = Image.fromarray(a, "RGBA")
    for y in range(4, 60, 3):
        put(im, 2, y, C("t4"))
        put(im, 3, y, C("t3"))
        put(im, 92, y, C("t3"))
        put(im, 93, y, C("t4"))
    hline(im, 4, 91, 61, "p0")
    return im


def plant(kind):
    if kind == "monstera":
        W, H = T, 64
        im = blank(W, H)
        leaves = []
        for k, (cx, cy, rx, ry) in enumerate(((10, 26, 9, 7), (22, 22, 9, 7), (15, 14, 8, 7), (8, 38, 7, 5),
                                              (24, 36, 7, 5), (17, 30, 8, 6))):
            leaves.append(Part("l%d" % k, m_ellipse(W, H, cx, cy, rx, ry), R["leaf"], 1 + k * 0.1, band=1,
                               light=True))
        draw_parts(im, leaves + [Part("pot", m_poly(W, H, [(8, 46), (24, 46), (22, 62), (10, 62)]) |
                                      m_rrect(W, H, 7, 44, 25, 48, 1), R["orange"], 3, band=1, light=True)])
        a = np.array(im)
        for cx, cy in ((10, 26), (22, 22), (15, 14), (17, 30)):
            for t in range(-4, 5):
                y = cy + t // 3
                if a[y, cx + t, 3] and t % 3 == 0:
                    a[y, cx + t, :3] = rgb("q1")
                    a[y + 1, cx + t, :3] = rgb("q1")
        return Image.fromarray(a, "RGBA")
    if kind == "succulent":
        W, H = T, T
        im = blank(W, H)
        draw_parts(im, [Part("pot", m_rrect(W, H, 9, 18, 22, 29, 2), R["white"], 1, band=1, light=True)])
        for k, (dx, dy) in enumerate(((0, -3), (-4, -1), (4, -1), (-2, 1), (2, 1), (0, -6), (-6, -4), (6, -4))):
            draw_parts(im, [Part("p%d" % k, m_ellipse(W, H, 16 + dx, 17 + dy, 3, 2.4), ["q0", "q2", "q3", "q4"],
                                 2 + k * 0.1, band=0, light=True)])
        put(im, 16, 10, C("k1"))
        return im
    if kind == "ficus":
        W, H = T, 64
        im = blank(W, H)
        parts = [Part("trunk", m_capsule(W, H, (16, 50), (15, 24), 1.3), R["trunk"], 1, band=0),
                 Part("pot", m_rrect(W, H, 8, 46, 23, 61, 2), R["white"], 4, band=1, light=True)]
        for k, (cx, cy, r) in enumerate(((16, 12, 9), (8, 20, 6), (24, 20, 6), (16, 26, 7), (11, 6, 5), (22, 7, 5))):
            parts.append(Part("c%d" % k, m_ellipse(W, H, cx, cy, r, r * 0.9), R["leaf"], 2 + k * 0.1, band=1,
                              light=True))
        draw_parts(im, parts)
        hline(im, 9, 22, 50, "t3")
        return im
    # hanging (wall) plant
    W, H = T, T
    im = blank(W, H)
    vline(im, 15, 0, 6, "w3")
    vline(im, 10, 2, 8, "w3")
    vline(im, 21, 2, 8, "w3")
    draw_parts(im, [Part("pot", m_rrect(W, H, 9, 8, 22, 16, 2), R["orange"], 1, band=1, light=True)])
    for k, x in enumerate((8, 12, 17, 22, 24)):
        L = [12, 16, 10, 14, 8][k]
        for y in range(14, 14 + L):
            c = "q2" if (y + k) % 3 else "q3"
            put(im, x + (1 if (y // 4) % 2 else 0), y, C(c))
    return im


def floor_lamp():
    W, H = T, 64
    im = blank(W, H)
    draw_parts(im, [Part("base", m_ellipse(W, H, 16, 59, 7, 2.6), R["metal"], 1, band=0),
                    Part("pole", m_rect(W, H, 15, 16, 16, 58), R["metal"], 2, band=0),
                    Part("shade", m_poly(W, H, [(10, 4), (21, 4), (25, 17), (6, 17)]), R["yellow"], 3, band=1,
                         light=True)])
    hline(im, 8, 23, 17, "y2")
    return im


def desk_lamp():
    W, H = T, T
    im = blank(W, H)
    draw_parts(im, [Part("base", m_rrect(W, H, 6, 23, 15, 26, 1), R["metal"], 1, band=0),
                    Part("arm", m_capsule(W, H, (10, 24), (14, 12), 0.8) | m_capsule(W, H, (14, 12), (20, 10), 0.8),
                         R["metal"], 2, band=0),
                    Part("shade", m_poly(W, H, [(17, 6), (23, 6), (26, 14), (16, 14)]), R["red"], 3, band=0,
                         light=True)])
    hline(im, 18, 24, 14, "y2")
    return im


def lamp_glow(kind):
    if kind == "floor":
        a = glow_alpha(96, 96, 48, 44, 34, 30, 90)
        a = np.maximum(a, glow_alpha(96, 96, 48, 90, 22, 6, 55, steps=3))
        return overlay_from_alpha(a, "y2")
    return overlay_from_alpha(glow_alpha(64, 64, 40, 30, 22, 16, 80), "y2")


# ---------------------------------------------------------------- wall decor (overlays on the wall face)
def frame_art(kind):
    W, H = T, T
    im = blank(W, H)
    if kind == "landscape":
        draw_parts(im, [Part("frame", m_rect(W, H, 3, 6, 28, 25), R["yellow"], 1, band=0, light=True)])
        rect(im, 5, 8, 26, 23, "a2")
        draw_parts(im, [Part("hill", m_ellipse(W, H, 12, 26, 12, 8) & m_rect(W, H, 5, 8, 26, 23), R["leaf"], 2,
                             band=0, outline=False),
                        Part("hill2", m_ellipse(W, H, 24, 27, 9, 7) & m_rect(W, H, 5, 8, 26, 23), R["green"], 2.1,
                             band=0, outline=False)])
        rect(im, 20, 10, 22, 12, "y1")
        put(im, 20, 10, C("y2"))
        hline(im, 7, 10, 11, "wh")
    else:
        draw_parts(im, [Part("frame", m_rect(W, H, 7, 3, 24, 27), R["dark_wood"], 1, band=0, light=True)])
        rect(im, 9, 5, 22, 25, "t4")
        draw_parts(im, [Part("c1", m_ellipse(W, H, 13, 11, 4, 4), R["red"], 2, band=0, outline=False),
                        Part("sq", m_rect(W, H, 14, 14, 20, 21), R["blue"], 2.1, band=0, outline=False),
                        Part("tri", m_poly(W, H, [(10, 24), (15, 17), (19, 24)]), R["yellow"], 2.2, band=0,
                             outline=False)])
    return im


def clock():
    W, H = T, T
    im = blank(W, H)
    draw_parts(im, [Part("rim", m_ellipse(W, H, 16, 15, 10, 10), R["dark_wood"], 1, band=1, light=True),
                    Part("face", m_ellipse(W, H, 16, 15, 8, 8), R["white"], 2, band=0)])
    for (x, y) in ((15, 8), (16, 8), (23, 14), (23, 15), (15, 22), (16, 22), (8, 14), (8, 15)):
        put(im, x, y, C("ol1"))
    for t in range(6):
        put(im, 15, 15 - t, C("m0"))
    for t in range(4):
        put(im, 16 + t, 15, C("r1"))
    put(im, 15, 15, C("y0"))
    return im


def whiteboard():
    W, H = 64, T
    im = blank(W, H)
    draw_parts(im, [Part("frame", m_rect(W, H, 1, 3, 62, 25), R["steel"], 1, band=0, light=True),
                    Part("board", m_rect(W, H, 3, 5, 60, 23), ["t3", "t4", "wh", "wh"], 2, outline=False, band=0)])
    hline(im, 6, 22, 8, "a1")
    hline(im, 6, 18, 11, "ol1")
    hline(im, 6, 20, 14, "ol1")
    hline(im, 6, 15, 17, "ol1")
    for k, hgt in enumerate((5, 9, 7, 12)):
        rect(im, 34 + k * 6, 20 - hgt, 37 + k * 6, 20, ["a1", "g1", "y0", "r1"][k])
    hline(im, 32, 58, 21, "ol1")
    for t in range(10):
        put(im, 25 + t // 3, 10 + t, C("r1"))
    draw_parts(im, [Part("tray", m_rect(W, H, 10, 25, 53, 27), R["steel"], 3, band=0)])
    rect(im, 14, 24, 19, 24, "r1")
    rect(im, 22, 24, 27, 24, "a1")
    return im


def corkboard():
    W, H = 64, T
    im = blank(W, H)
    draw_parts(im, [Part("frame", m_rect(W, H, 1, 3, 62, 27), R["wood"], 1, band=0, light=True)])
    a = np.array(im)
    ys, xs = np.mgrid[0:H, 0:W]
    inner = m_rect(W, H, 3, 5, 60, 25)
    a[inner] = C("w3")
    a[inner & ((xs * 3 + ys * 5) % 7 == 0)] = C("w2")
    im = Image.fromarray(a, "RGBA")
    for k, (x, y, c) in enumerate(((6, 8, "y1"), (17, 7, "k1"), (29, 9, "a3"), (41, 7, "g3"), (51, 9, "y1"),
                                   (11, 16, "a3"), (24, 17, "y1"), (36, 16, "k1"), (48, 17, "g3"))):
        rect(im, x, y, x + 8, y + 7, c)
        dark = {"y1": "y0", "k1": "k0", "a3": "a2", "g3": "g2"}[c]
        hline(im, x, x + 8, y + 7, dark)
        vline(im, x + 8, y, y + 7, dark)
        hline(im, x + 2, x + 5, y + 3, "m1")
        hline(im, x + 2, x + 6, y + 5, "m1")
        put(im, x + 4, y, C("r1"))
        put(im, x + 4, y - 1, C("r2"))
    return im


# ---------------------------------------------------------------- meeting, shop, special
def round_table():
    W, H = 96, 96
    im = blank(W, H)
    draw_parts(im, [Part("ped", m_rect(W, H, 42, 60, 53, 82), FACE, 1, band=0),
                    Part("foot", m_ellipse(W, H, 48, 82, 14, 5), FACE, 1.5, band=0),
                    Part("rim", m_ellipse(W, H, 48, 46, 40, 38), FACE, 2, band=0),
                    Part("top", m_ellipse(W, H, 48, 41, 40, 38), TOP, 3, band=1, light=True)])
    X, Y = grid(W, H)
    a = np.array(im)
    ring = (np.abs(np.hypot(X - 48, Y - 41) - 30) < 0.6)
    a[ring & has(a, "w3")] = C("w2")
    im = Image.fromarray(a, "RGBA")
    # papers and a cup
    rect(im, 26, 30, 35, 37, "wh")
    hline(im, 27, 33, 32, "t2")
    hline(im, 27, 32, 34, "t2")
    rect(im, 58, 44, 66, 51, "wh")
    hline(im, 59, 64, 46, "t2")
    rect(im, 45, 22, 48, 25, "r1")
    put(im, 45, 22, C("wh"))
    draw_parts(im, [Part("vase", m_rrect(W, H, 44, 34, 51, 43, 2), R["blue"], 4, band=0)])
    for dx, dy, c in ((-3, -3, "k1"), (0, -5, "y1"), (3, -3, "r2"), (-1, -2, "q3"), (2, -1, "q3")):
        put(im, 47 + dx, 33 + dy, C(c))
        put(im, 48 + dx, 33 + dy, C(c))
    return im


def meeting_set():
    """5x5 stamp: round table + 8 chairs (N, NE, E, SE, S, SW, W, NW)"""
    W = H = 160
    im = blank(W, H)
    table = round_table()
    seats = [("down", 64, 2), ("down", 104, 14), ("down", 24, 14), ("right", 2, 56), ("left", 126, 56),
             ("up", 24, 100), ("up", 104, 100), ("up", 64, 114)]
    back = [s for s in seats if s[2] < 40]
    front = [s for s in seats if s[2] >= 40]
    for d, x, y in back:
        im.alpha_composite(chair(d), (x, y))
    for d, x, y in [s for s in front if s[0] in ("left", "right")]:
        im.alpha_composite(chair(d), (x, y))
    im.alpha_composite(table, (32, 28))
    for d, x, y in [s for s in front if s[0] == "up"]:
        im.alpha_composite(chair(d), (x, y))
    return im


def shop_counter():
    W, H = 96, 64
    im = blank(W, H)
    draw_parts(im, [Part("body", m_rect(W, H, 1, 34, 94, 61), FACE, 1, band=0, light=True),
                    Part("glass", m_rect(W, H, 40, 38, 90, 56), ["a0", "a1", "a1", "a2"], 2, outline=False,
                         band=-1),
                    Part("top", m_rrect(W, H, 0, 26, 95, 35, 1), TOP, 3, band=0, light=True)])
    # goods in the glass case
    for k, x in enumerate(range(43, 88, 6)):
        c = ["r1", "y1", "k1", "g2", "a3", "y0", "r2", "wh"][k % 8]
        rect(im, x, 50, x + 3, 54, c)
        put(im, x, 50, C("wh"))
    hline(im, 40, 90, 46, "a3")
    for x in range(6, 36, 7):
        vline(im, x, 38, 59, "w1")
    # cash register
    draw_parts(im, [Part("reg", m_poly(W, H, [(8, 16), (32, 16), (34, 30), (6, 30)]), ["ol0", "m0", "m1", "m2"], 4,
                         band=0, light=True),
                    Part("disp", m_rect(W, H, 16, 8, 28, 15), ["ol0", "m0", "m1", "m2"], 5, band=0)])
    rect(im, 18, 10, 26, 13, "g2")
    draw_text(im, 18, 9, "$", "g0")
    for y in (20, 24):
        for x in range(10, 30, 3):
            put(im, x, y, C("t4"))
            put(im, x + 1, y, C("t3"))
    rect(im, 8, 27, 32, 28, "m2")
    # bell + bag
    draw_parts(im, [Part("bell", m_ellipse(W, H, 50, 22, 4, 3.5) & m_rect(W, H, 0, 0, W, 24), R["yellow"], 6,
                         band=0)])
    hline(im, 45, 55, 24, "y0")
    draw_parts(im, [Part("bag", m_rect(W, H, 70, 12, 84, 27), R["cream"], 6, band=0, light=True)])
    for x in (73, 81):
        vline(im, x, 8, 12, "w1")
    hline(im, 73, 81, 8, "w1")
    return im


def shop_shelf(variant):
    W, H = 64, 64
    im = blank(W, H)
    draw_parts(im, [Part("frame", m_rect(W, H, 1, 2, 62, 61), R["steel"], 1, band=1, light=True),
                    Part("back", m_rect(W, H, 4, 5, 59, 58), ["m1", "m1", "m1", "m2"], 2, outline=False, band=-1)])
    rnd = random.Random(80 + variant)
    for k, b in enumerate((19, 34, 49, 59)):
        hline(im, 3, 60, b, "t3")
        hline(im, 3, 60, b + 1 if b < 59 else b, "m0")
        x = 5
        while x < 57:
            kind = rnd.choice(["can", "box", "bottle"] if variant == 0 else ["fruit", "box", "jar"])
            c = rnd.choice(["r1", "a1", "g1", "y0", "k0", "h2", "p1"])
            if kind == "can":
                rect(im, x, b - 6, x + 3, b - 1, c)
                hline(im, x, x + 3, b - 4, "wh")
                hline(im, x, x + 3, b - 6, "t4")
                x += 5
            elif kind == "box":
                w = rnd.choice([5, 6, 7])
                if x + w > 58:
                    break
                rect(im, x, b - 9, x + w - 1, b - 1, c)
                hline(im, x, x + w - 1, b - 9, "wh" if c in ("y0", "k0") else "t4")
                vline(im, x + w - 1, b - 8, b - 1, "ol1")
                put(im, x + 2, b - 5, C("wh"))
                x += w + 1
            elif kind == "bottle":
                rect(im, x, b - 8, x + 2, b - 1, c if c in ("g1", "a1", "r1") else "g1")
                vline(im, x + 1, b - 11, b - 9, "g0")
                put(im, x, b - 7, C("a3"))
                x += 4
            elif kind == "fruit":
                for dx in range(0, 8, 3):
                    cc = rnd.choice(["r1", "y1", "q3", "h3"])
                    rect(im, x + dx, b - 4, x + dx + 2, b - 1, cc)
                    put(im, x + dx, b - 4, C("wh"))
                x += 10
            else:
                rect(im, x, b - 7, x + 4, b - 1, "a3")
                hline(im, x, x + 4, b - 8, "w1")
                rect(im, x + 1, b - 4, x + 3, b - 2, c)
                x += 6
        # price tags
        for tx in range(8, 58, 14):
            rect(im, tx, b + 1 if b < 59 else b, tx + 3, b + 2 if b < 59 else b, "y1")
    return im


def vault_door():
    W, H = 64, 64
    im = blank(W, H)
    draw_parts(im, [Part("frame", m_rrect(W, H, 2, 2, 61, 61, 3), R["steel"], 1, band=1, light=True),
                    Part("ring", m_ellipse(W, H, 32, 32, 25, 25), ["m0", "m1", "m2", "t3"], 2, band=1, light=True),
                    Part("door", m_ellipse(W, H, 32, 32, 19, 19), ["m0", "m0", "m1", "m2"], 3, band=1, light=True)])
    for k in range(12):
        ang = k * math.pi / 6
        put(im, round(32 + 22 * math.cos(ang) - 0.5), round(32 + 22 * math.sin(ang) - 0.5), C("y1"))
    for k in range(3):
        ang = k * math.pi / 3 + 0.4
        for t in range(-11, 12):
            put(im, round(32 + t * math.cos(ang) - 0.5), round(32 + t * math.sin(ang) - 0.5), C("t3"))
    draw_parts(im, [Part("hub", m_ellipse(W, H, 32, 32, 4, 4), R["yellow"], 4, band=0)])
    rect(im, 52, 28, 56, 36, "m2")
    hline(im, 52, 56, 28, "t3")
    return im


def server_rack(frame):
    W, H = T, 64
    im = blank(W, H)
    draw_parts(im, [Part("body", m_rrect(W, H, 3, 2, 28, 62, 1), ["ol0", "m0", "m1", "m2"], 1, band=1,
                         light=True)])
    for k, y in enumerate(range(6, 58, 5)):
        rect(im, 6, y, 25, y + 3, "m0")
        hline(im, 6, 25, y, "m1")
        for j, x in enumerate((8, 11)):
            on = (k + j + frame) % 3 != 0
            put(im, x, y + 2, C(("g2" if (k % 4) else "y1") if on else "m1"))
        hline(im, 15, 23, y + 2, "ol0")
    hline(im, 4, 27, 62, "ol1")
    return im


def easel():
    W, H = T, 64
    im = blank(W, H)
    draw_parts(im, [Part("legs", m_capsule(W, H, (16, 4), (5, 62), 1.1) | m_capsule(W, H, (16, 4), (27, 62), 1.1) |
                         m_capsule(W, H, (16, 10), (17, 60), 1.0), R["wood"], 1, band=0),
                    Part("ledge", m_rect(W, H, 5, 40, 27, 42), R["wood"], 3, band=0),
                    Part("canvas", m_rect(W, H, 5, 9, 26, 39), R["white"], 2, band=0)])
    rect(im, 7, 11, 24, 37, "a3")
    draw_parts(im, [Part("hill", m_ellipse(W, H, 12, 40, 12, 10) & m_rect(W, H, 7, 11, 24, 37), R["leaf"], 4, band=0,
                         outline=False),
                    Part("sun", m_ellipse(W, H, 20, 17, 3, 3), R["yellow"], 4, band=0, outline=False)])
    hline(im, 9, 13, 16, "wh")
    hline(im, 10, 12, 15, "wh")
    # brush strokes not yet finished
    for x in range(14, 24):
        put(im, x, 32 + (x % 3), C("k1"))
    return im


def stage():
    W, H = 128, 64
    im = blank(W, H)
    draw_parts(im, [Part("front", m_rect(W, H, 0, 40, 127, 60), ["ol0", "r0", "r0", "r1"], 1, band=0),
                    Part("top", m_rect(W, H, 0, 4, 127, 41), TOP, 2, band=0, light=True)])
    for y in range(9, 41, 6):
        hline(im, 0, 127, y, "w2")
    for x in range(0, 128, 8):
        vline(im, x, 42, 59, "h0")
        vline(im, x + 1, 42, 59, "r1")
    # front lights
    for x in range(12, 120, 24):
        draw_parts(im, [Part("lt%d" % x, m_rrect(W, H, x, 36, x + 5, 41, 1), R["metal"], 3, band=0)])
        put(im, x + 2, 37, C("y2"))
    # steps
    draw_parts(im, [Part("step", m_rect(W, H, 52, 54, 75, 63), TOP, 3, band=0)])
    hline(im, 52, 75, 58, "w1")
    return im


def screen():
    W, H = 128, 64
    im = blank(W, H)
    draw_parts(im, [Part("roller", m_rrect(W, H, 2, 2, 125, 6, 1), R["metal"], 1, band=0),
                    Part("cloth", m_rect(W, H, 6, 6, 121, 52), ["t2", "t4", "wh", "wh"], 2, band=0)])
    rect(im, 14, 12, 113, 46, "p0")
    hline(im, 18, 70, 16, "y1")
    for k, hgt in enumerate((10, 16, 12, 22, 18)):
        rect(im, 22 + k * 14, 42 - hgt, 31 + k * 14, 42, ["a2", "g2", "k1", "y1", "r2"][k])
    hline(im, 18, 108, 43, "t4")
    draw_parts(im, [Part("pull", m_rect(W, H, 62, 52, 65, 58), R["metal"], 3, band=0)])
    return im
