"""Facade kit (interchangeable wall / roof / window / door / awning / sign pieces + shadow overlays)
and the six landmark facades (bank, library, studio, radio, security, town hall)."""
import math
import random

import numpy as np
from PIL import Image

from pixkit import (T, C, R, rgb, blank, fill, put, hline, vline, rect, grid, m_ellipse, m_rect, m_rrect, m_poly,
                    m_capsule, Part, shape, draw_parts, overlay_from_alpha, draw_text, text_width, GLYPHS, shift)
from nature import has

# ---------------------------------------------------------------- walls (32x64 bays: upper + lower tile)
WALLS = {
    "cream": {"base": "t3", "hi": "t4", "lo": "t2", "out": "t0"},
    "brick": {"base": "h2", "hi": "h3", "lo": "h1", "out": "h0"},
    "blue": {"base": "a2", "hi": "a3", "lo": "a1", "out": "a0"},
    "pink": {"base": "k1", "hi": "s3", "lo": "k0", "out": "r0"},
}
PLINTH = 54


def wall_texture(colour, w, h, ox=0):
    im = fill(w, h, WALLS[colour]["base"])
    a = np.array(im)
    ys, xs = np.mgrid[0:h, 0:w]
    gx = xs + ox
    if colour == "brick":
        row = ys // 4
        ry = ys % 4
        bx = (gx + (row % 2) * 4) % 8
        bid = (gx + (row % 2) * 4) // 8 + row * 7
        a[..., :3] = rgb("h2")
        alt = (bid * 37 % 11) < 3
        a[alt, :3] = rgb("w2")
        a[(ry == 0) & (bx == 0), :3] = rgb("h3")
        a[(ry == 2), :3] = rgb("h1")
        a[(ry == 2) & alt, :3] = rgb("w1")
        a[(ry == 3) | (bx == 7), :3] = rgb("t2")
    elif colour == "blue":
        by = ys % 8
        a[by == 0, :3] = rgb("a3")
        a[by == 7, :3] = rgb("a1")
        a[(by == 6) & ((gx % 16) == 5), :3] = rgb("a1")
        a[(by == 3) & ((gx + ys) % 29 == 0), :3] = rgb("a1")
    else:
        hi, lo = WALLS[colour]["hi"], WALLS[colour]["lo"]
        rnd = random.Random(11 if colour == "cream" else 12)
        for _ in range(w * h // 180):
            x, y = rnd.randrange(w), rnd.randrange(h)
            for k in range(3):
                if x + k < w:
                    a[y, x + k, :3] = rgb(hi)
            if y + 1 < h and x + 1 < w:
                a[y + 1, x + 1, :3] = rgb(lo)
    return Image.fromarray(a, "RGBA")


def plinth(im, y0, x0=0, x1=None):
    x1 = im.width - 1 if x1 is None else x1
    hline(im, x0, x1, y0, "t4")
    for y in range(y0 + 1, im.height - 1):
        hline(im, x0, x1, y, "t2")
    hline(im, x0, x1, im.height - 1, "t0")
    for x in range(x0, x1 + 1):
        if x % 16 == 0:
            vline(im, x, y0 + 2, im.height - 2, "t1")


def quoins(im, side, out, y1=PLINTH - 1, x_edge=None):
    W = im.width
    for k in range(0, (y1 + 1) // 8 + 1):
        y0 = k * 8
        wd = 6 if k % 2 == 0 else 4
        for y in range(y0, min(y0 + 7, y1 + 1)):
            for i in range(wd):
                x = i if side == "l" else W - 1 - i
                last_row = y == min(y0 + 6, y1)
                c = "t4" if side == "l" else "t3"
                if last_row:
                    c = "t2" if side == "l" else "t1"
                elif (side == "l" and i == wd - 1) or (side == "r" and i == wd - 1):
                    c = "t2" if side == "l" else "t1"
                put(im, x, y, C(c))
        if y0 + 7 <= y1:
            for i in range(wd):
                x = i if side == "l" else W - 1 - i
                put(im, x, y0 + 7, C("t1"))
    xo = 0 if side == "l" else W - 1
    vline(im, xo, 0, im.height - 1, out)


def wall_bay(colour, piece):
    im = wall_texture(colour, T, 64)
    plinth(im, PLINTH)
    if piece in ("l", "s"):
        quoins(im, "l", WALLS[colour]["out"])
    if piece in ("r", "s"):
        quoins(im, "r", WALLS[colour]["out"])
    return im


# ---------------------------------------------------------------- roofs (32x32 pieces, rows 'top' and 'eave')
ROOFS = {
    "terra": {"base": "r1", "lo": "r0", "hi": "r2", "out": "ol1", "fascia": ("t4", "t3")},
    "slate": {"base": "p1", "lo": "p0", "hi": "p2", "out": "ol0", "fascia": ("wh", "t4")},
    "green": {"base": "g1", "lo": "g0", "hi": "g2", "out": "ol0", "fascia": ("t4", "t3")},
    "brown": {"base": "w1", "lo": "w0", "hi": "w2", "out": "ol1", "fascia": ("w3", "w2")},
}


def roof_pat(kind, gx, gy):
    r = ROOFS[kind]
    if kind == "terra":
        row = gy // 5
        px, py = (gx + (row % 2) * 4) % 8, gy % 5
        if py == 4 and px not in (3, 4):
            return r["lo"]
        if py == 3 and px in (0, 7):
            return r["lo"]
        if px == 0 and py < 3:
            return r["lo"]
        if (py == 0 and px in (1, 2)) or (px == 1 and py == 1):
            return r["hi"]
        return r["base"]
    if kind == "slate":
        ry = gy % 6
        px = (gx + ((gy // 6) % 2) * 4) % 8
        if ry == 5 or px == 0:
            return r["lo"]
        if ry == 0 and px < 3:
            return r["hi"]
        return r["base"]
    if kind == "green":
        px = gx % 8
        if px == 0:
            return r["lo"]
        if px == 1:
            return r["hi"]
        if gy % 16 == 15:
            return r["lo"]
        return r["base"]
    # brown shingles
    ry = gy % 5
    px = (gx + ((gy // 5) % 2) * 3) % 6
    if ry == 4 or px == 0:
        return r["lo"]
    if ry == 3 and px in (1, 5):
        return r["lo"]
    if ry == 0 and px in (1, 2, 3):
        return r["hi"]
    return r["base"]


def roof_piece(kind, row, piece, w=T):
    r = ROOFS[kind]
    im = blank(w, T)
    oy = 0 if row == "top" else 32
    for y in range(T):
        for x in range(w):
            put(im, x, y, C(roof_pat(kind, x, y + oy)))
    if row == "top":
        hline(im, 0, w - 1, 0, r["out"])
        hline(im, 0, w - 1, 1, r["hi"])
        hline(im, 0, w - 1, 2, r["hi"])
        hline(im, 0, w - 1, 3, r["lo"])
    else:
        f1, f2 = r["fascia"]
        hline(im, 0, w - 1, 25, r["lo"])
        hline(im, 0, w - 1, 26, r["out"])
        hline(im, 0, w - 1, 27, f1)
        hline(im, 0, w - 1, 28, f2)
        hline(im, 0, w - 1, 29, f2)
        hline(im, 0, w - 1, 30, "t1")
        hline(im, 0, w - 1, 31, "ol1")
    f1, f2 = r["fascia"]
    if piece in ("l", "s"):
        vline(im, 0, 0, T - 1, r["out"])
        vline(im, 1, 0, T - 2, f1)
        vline(im, 2, 0, T - 2, f2)
        vline(im, 3, 0, T - 2, r["lo"])
    if piece in ("r", "s"):
        vline(im, w - 1, 0, T - 1, r["out"])
        vline(im, w - 2, 0, T - 2, "t1")
        vline(im, w - 3, 0, T - 2, f2)
        vline(im, w - 4, 0, T - 2, r["lo"])
    if row == "eave":
        hline(im, 0, w - 1, 31, "ol1")
    return im


# ---------------------------------------------------------------- bay overlays (32x64, transparent)
def ov():
    return blank(T, 64)


def window_arched():
    im = ov()
    W, H = T, 64
    frame = m_rrect(W, H, 6, 18, 25, 45, 0) | m_ellipse(W, H, 16, 18, 10, 9)
    glass = m_rect(W, H, 9, 19, 22, 43) | m_ellipse(W, H, 16, 19, 7, 6.5)
    draw_parts(im, [Part("frame", frame, R["wood"], 1, band=1, light=True),
                    Part("glass", glass, ["a0", "a1", "a1", "a2"], 2, outline=False, band=-1, light=False),
                    Part("sill", m_rrect(W, H, 4, 45, 27, 48, 1), R["stone"], 3, band=0)])
    a = np.array(im)
    for y in range(12, 44):
        for x in range(9, 23):
            if glass[y, x]:
                if x in (15, 16) or y == 31:
                    a[y, x, :3] = rgb("w1") if x == 16 or y == 31 else rgb("w2")
                elif (x - y) in (-12, -11, -18) or (x - 9) - (y - 32) in (8, 9):
                    a[y, x, :3] = rgb("a3")
                elif y < 21:
                    a[y, x, :3] = rgb("a0")
    im = Image.fromarray(a, "RGBA")
    # flower box under the sill
    draw_parts(im, [Part("fbox", m_rrect(W, H, 6, 50, 25, 54, 1), R["wood"], 1)])
    for k, x in enumerate(range(8, 25, 4)):
        c = ["r1", "y1", "k1", "r2", "wh"][k % 5]
        put(im, x, 49, C("q2"))
        put(im, x + 1, 49, C("q1"))
        put(im, x, 48, C(c))
        put(im, x - 1, 49, C(c))
        put(im, x + 1, 48, C(c))
    return im


def window_square():
    im = ov()
    W, H = T, 64
    draw_parts(im, [
        Part("shutL", m_rect(W, H, 1, 19, 6, 44), R["green"], 1, band=0),
        Part("shutR", m_rect(W, H, 25, 19, 30, 44), R["green"], 1, band=0),
        Part("frame", m_rect(W, H, 7, 18, 24, 45), R["white"], 2, band=1, light=True),
        Part("glass", m_rect(W, H, 9, 20, 22, 43), ["a0", "a1", "a1", "a2"], 3, outline=False, band=-1, light=False),
        Part("sill", m_rrect(W, H, 5, 45, 26, 48, 1), R["white"], 4, band=0)])
    a = np.array(im)
    for x in range(9, 23):
        for y in range(20, 44):
            if x == 15 or x == 16 or y == 31:
                a[y, x, :3] = rgb("t4" if x == 15 or y == 31 else "t3")
            elif (x - y) in (-13, -12) or (x - y) in (-22,):
                a[y, x, :3] = rgb("a3")
            elif y < 22:
                a[y, x, :3] = rgb("a0")
    for y in range(21, 44, 3):
        for x in list(range(2, 6)) + list(range(26, 30)):
            a[y, x, :3] = rgb("g0")
    return Image.fromarray(a, "RGBA")


def window_shop():
    im = ov()
    W, H = T, 64
    draw_parts(im, [
        Part("frame", m_rect(W, H, 2, 16, 29, 51), R["dark_wood"], 1, band=0, light=True),
        Part("glass", m_rect(W, H, 4, 18, 27, 44), ["a0", "a1", "a1", "a2"], 2, outline=False, band=-1, light=False),
        Part("bulk", m_rect(W, H, 3, 46, 28, 53), R["wood"], 3, band=1)])
    a = np.array(im)
    for x in range(4, 28):
        for y in range(18, 45):
            if (x - y) in (-12, -11, -10) or (x - y) in (-2,):
                a[y, x, :3] = rgb("a3")
            elif y < 20:
                a[y, x, :3] = rgb("a0")
    im = Image.fromarray(a, "RGBA")
    # goods on display: jars, a cake, a plant
    hline(im, 4, 27, 41, "w1")
    hline(im, 4, 27, 42, "w2")
    for x, c in ((6, "r1"), (10, "y1"), (14, "g2")):
        rect(im, x, 36, x + 2, 40, c)
        put(im, x, 36, C("wh"))
        hline(im, x, x + 2, 35, "m1")
    rect(im, 19, 37, 25, 40, "s3")
    hline(im, 19, 25, 37, "k1")
    put(im, 22, 35, C("r1"))
    put(im, 22, 36, C("wh"))
    hline(im, 4, 27, 30, "w2")
    for x, c in ((7, "a0"), (11, "k0"), (20, "y0"), (24, "g1")):
        rect(im, x, 26, x + 2, 29, c)
    # price tag
    rect(im, 16, 44, 18, 45, "wh")
    hline(im, 5, 26, 49, "w1")
    for x in (10, 21):
        vline(im, x, 47, 52, "w1")
    return im


def window_pair():
    im = ov()
    W, H = T, 64
    parts = []
    for x0 in (4, 18):
        parts.append(Part("f%d" % x0, m_rect(W, H, x0, 20, x0 + 9, 44) | m_ellipse(W, H, x0 + 5, 20, 5, 4),
                          R["navy"], 1, band=0, light=True))
        parts.append(Part("g%d" % x0, m_rect(W, H, x0 + 2, 21, x0 + 7, 42) | m_ellipse(W, H, x0 + 5, 21, 3, 2.5),
                          ["a0", "a1", "a1", "a2"], 2, outline=False, band=-1, light=False))
    parts.append(Part("sill", m_rrect(W, H, 2, 45, 29, 47, 1), R["stone"], 3, band=0))
    draw_parts(im, parts)
    for x0 in (4, 18):
        for y in range(22, 42):
            if (y + x0) % 7 == 0:
                put(im, x0 + 3, y, C("a3"))
                put(im, x0 + 4, y - 1, C("a3"))
        hline(im, x0 + 2, x0 + 7, 32, "p1")
    # small potted plants on the sill
    for x in (8, 22):
        rect(im, x, 41, x + 3, 44, "h2")
        hline(im, x, x + 3, 44, "h1")
        for dx, dy in ((0, -1), (1, -2), (2, -1), (3, -2), (1, -3), (2, -3)):
            put(im, x + dx, 41 + dy, C("q2" if dy < -2 else "q3"))
    return im


def door_arched():
    im = ov()
    W, H = T, 64
    frame = m_rect(W, H, 4, 22, 27, 63) | m_ellipse(W, H, 16, 22, 12, 10)
    door = m_rect(W, H, 7, 24, 24, 62) | m_ellipse(W, H, 16, 24, 9, 8)
    draw_parts(im, [Part("frame", frame, R["stone"], 1, band=1, light=True),
                    Part("door", door, R["wood"], 2, band=1, light=True)])
    for x in (11, 16, 21):
        for y in range(17, 61):
            if door[y, x]:
                put(im, x, y, C("w1"))
    rect(im, 13, 25, 18, 29, "a1")
    put(im, 13, 25, C("a2"))
    put(im, 21, 44, C("y1"))
    put(im, 21, 45, C("y0"))
    hline(im, 2, 29, 63, "t4")
    return im


def door_glass():
    im = ov()
    W, H = T, 64
    draw_parts(im, [
        Part("frame", m_rect(W, H, 5, 20, 26, 63), R["metal"], 1, band=0, light=True),
        Part("glass", m_rect(W, H, 8, 23, 23, 61), ["a0", "a1", "a1", "a2"], 2, outline=False, band=-1, light=False),
        Part("bar", m_rect(W, H, 9, 43, 22, 44), ["m0", "m2", "m2", "t3"], 3, outline=False, band=-1)])
    a = np.array(im)
    for x in range(8, 24):
        for y in range(23, 62):
            if (x - y) in (-20, -19, -27):
                a[y, x, :3] = rgb("a3")
            elif y < 25:
                a[y, x, :3] = rgb("a0")
    im = Image.fromarray(a, "RGBA")
    # OPEN sign
    rect(im, 8, 30, 24, 36, "y1")
    hline(im, 8, 24, 36, "y0")
    draw_text(im, 9, 31, "OPEN", "w0")
    put(im, 12, 28, C("m1"))
    put(im, 19, 28, C("m1"))
    put(im, 13, 29, C("m1"))
    put(im, 18, 29, C("m1"))
    hline(im, 3, 28, 63, "m1")
    return im


def door_panel():
    im = ov()
    W, H = T, 64
    draw_parts(im, [
        Part("frame", m_rect(W, H, 5, 16, 26, 63), R["white"], 1, band=0, light=True),
        Part("transom", m_rect(W, H, 8, 18, 23, 22), ["a0", "a1", "a1", "a2"], 2, outline=False, band=-1),
        Part("door", m_rect(W, H, 8, 24, 23, 62), R["red"], 3, band=1, light=True)])
    for (x0, y0, x1, y1) in ((10, 27, 14, 40), (17, 27, 21, 40), (10, 44, 14, 59), (17, 44, 21, 59)):
        rect(im, x0, y0, x1, y1, "r1")
        hline(im, x0, x1, y0, "r0")
        vline(im, x0, y0, y1, "r0")
        hline(im, x0, x1, y1, "r2")
        vline(im, x1, y0, y1, "r2")
    for x in range(9, 23, 3):
        put(im, x, 20, C("a3"))
    put(im, 21, 42, C("y1"))
    put(im, 22, 42, C("y0"))
    hline(im, 3, 28, 63, "t4")
    return im


BAYS = {"window_arched": window_arched, "window_square": window_square, "window_shop": window_shop,
        "window_pair": window_pair, "door_arched": door_arched, "door_glass": door_glass, "door_panel": door_panel}


# ---------------------------------------------------------------- awnings (32x32, on the upper wall tile)
AWN = {"red": ("r2", "r1", "r0"), "green": ("g2", "g1", "g0"), "blue": ("a2", "a1", "a0"),
       "yellow": ("y1", "y0", "h2")}
AY0, AY1, AV = 3, 11, 15  # rail row, body bottom, valance bottom


def awning(colour, piece):
    im = blank(T, T)
    hi, base, lo = AWN[colour]
    x0 = 2 if piece in ("l", "s") else 0
    x1 = 29 if piece in ("r", "s") else 31
    for x in range(x0, x1 + 1):
        stripe = (x // 4) % 2 == 0
        for y in range(AY0, AV + 1):
            if y > AY1:
                # scalloped valance
                k = x % 4
                depth = [2, 3, 3, 2][k]
                if y - AY1 > depth + 1:
                    continue
                last = y - AY1 == depth + 1
                c = (lo if stripe else "t2") if last else (base if stripe else "t3")
            elif y == AY0:
                c = lo
            elif y <= AY0 + 3:
                c = hi if stripe else "wh"
            else:
                c = base if stripe else "t4"
            put(im, x, y, C(c))
    for x in range(x0, x1 + 1):
        put(im, x, AY0 - 1, C("m0"))
    if piece in ("l", "s"):
        vline(im, x0, AY0, AY1 + 2, lo)
        vline(im, x0 - 1, AY0 + 1, AY1 + 1, "m0")
    if piece in ("r", "s"):
        vline(im, x1, AY0, AY1 + 2, lo)
        vline(im, x1 + 1, AY0 + 1, AY1 + 1, "m0")
    return im


def awning_shadow(piece):
    al = np.zeros((T, T))
    x0 = 4 if piece in ("l", "s") else 0
    x1 = 31
    for k, v in enumerate((90, 70, 45, 25)):
        al[AV + 1 + k, x0:x1 + 1] = v
    if piece in ("r", "s"):
        al[:, 30:] = 0
        al[AV + 1:AV + 5, 30] = 30
    return overlay_from_alpha(al)


def eave_shadow():
    al = np.zeros((T, T))
    for k, v in enumerate((100, 80, 55, 35, 18)):
        al[k, :] = v
    return overlay_from_alpha(al)


def ground_shadow(piece):
    """on the ground row under a facade: 'm' band, 'end' fades out right of the building"""
    al = np.zeros((T, T))
    vals = (100, 85, 65, 45, 28, 14)
    if piece == "m":
        for k, v in enumerate(vals):
            al[k, :] = v
    else:
        for k, v in enumerate(vals):
            al[k, :max(0, 8 - k)] = v
    return overlay_from_alpha(al)


# ---------------------------------------------------------------- signs and roof pieces (32x32 overlays)
def hanging_sign(icon):
    im = blank(T, T)
    draw_parts(im, [Part("bracket", m_rect(T, T, 1, 4, 24, 5) | m_rect(T, T, 1, 2, 2, 9), R["metal"], 1, band=0),
                    Part("board", m_rrect(T, T, 5, 9, 23, 24, 2), R["wood"], 2, band=1, light=True)])
    for x in (8, 20):
        vline(im, x, 6, 8, "m1")
    cx, cy = 14, 16
    if icon == "cup":
        rect(im, 10, 14, 16, 20, "wh")
        vline(im, 16, 14, 20, "t3")
        hline(im, 10, 16, 20, "t3")
        put(im, 17, 16, C("wh"))
        put(im, 18, 17, C("wh"))
        put(im, 17, 18, C("wh"))
        hline(im, 11, 15, 14, "w0")
        put(im, 12, 12, C("t4"))
        put(im, 13, 11, C("t4"))
        put(im, 14, 12, C("t4"))
    elif icon == "bread":
        m = m_ellipse(T, T, 14.5, 17, 7, 4)
        draw_parts(im, [Part("loaf", m, ["w1", "w2", "w3", "t4"], 3, band=0)])
        for x in (11, 14, 17):
            put(im, x, 16, C("w1"))
            put(im, x + 1, 15, C("w1"))
    elif icon == "flower":
        vline(im, 14, 17, 22, "q1")
        put(im, 15, 20, C("q2"))
        put(im, 16, 19, C("q2"))
        for dx, dy in ((0, -2), (-2, 0), (2, 0), (0, 2), (-1, -1), (1, -1), (-1, 1), (1, 1)):
            put(im, cx + dx, cy - 2 + dy, C("k1"))
        put(im, cx, cy - 2, C("y1"))
        put(im, cx + 1, cy - 1, C("k0"))
    elif icon == "gear":
        X, Y = grid(T, T)
        ang = np.arctan2(Y - 16.5, X - 14.5)
        r = np.hypot(X - 14.5, Y - 16.5)
        m = (r < 4.2) | ((r < 5.8) & (np.cos(ang * 6) > 0.3))
        m &= ~(r < 1.6)
        draw_parts(im, [Part("gear", m, ["m0", "m1", "m2", "t3"], 3, band=0)])
    return im


def chimney():
    im = blank(T, T)
    body = m_rect(T, T, 17, 6, 26, 31)
    draw_parts(im, [Part("body", body, ["h0", "h1", "h2", "h3"], 1, band=1, light=True),
                    Part("cap", m_rrect(T, T, 15, 3, 28, 7, 1), R["stone"], 2, band=0)])
    for y in range(11, 31, 4):
        hline(im, 18, 25, y, "h1")
        put(im, 18 + (y // 4 % 2) * 4, y - 1, C("h1"))
    rect(im, 18, 2, 25, 3, "ol1")
    return im


def dormer():
    im = blank(T, T)
    draw_parts(im, [
        Part("wall", m_rect(T, T, 8, 12, 23, 31), R["white"], 1, band=0),
        Part("glass", m_rect(T, T, 11, 15, 20, 28), ["a0", "a1", "a1", "a2"], 2, outline=False, band=-1),
        Part("roof", m_poly(T, T, [(5, 13), (16, 2), (27, 13), (24, 13), (16, 5), (8, 13)]), R["wood"], 3, band=0)])
    vline(im, 15, 15, 28, "t4")
    hline(im, 11, 20, 21, "t4")
    put(im, 12, 17, C("a3"))
    put(im, 13, 16, C("a3"))
    return im


def wall_lamp(lit=True):
    im = blank(T, T)
    draw_parts(im, [Part("arm", m_rect(T, T, 13, 10, 18, 11), R["metal"], 1, band=0),
                    Part("cage", m_rrect(T, T, 12, 12, 19, 21, 1), R["metal"], 2, band=0),
                    Part("cap", m_poly(T, T, [(11, 12), (15, 7), (20, 12)]), R["metal"], 3, band=0)])
    for y in range(14, 20):
        for x in (14, 17):
            put(im, x, y, C(("y1" if y < 17 else "y0") if lit else "a3"))
    return im


# ---------------------------------------------------------------- composition of a generic facade
def compose(cols, wall, roof, bays, roof_rows=2, awnings=None, signs=None, chimney_col=None, dormer_cols=()):
    """returns (facade image, shadow overlay image same size, ground shadow strip (cols+1) x 1)"""
    H = (roof_rows + 2) * T
    W = cols * T
    im = blank(W, H)
    sh = blank(W, H)
    for c in range(cols):
        piece = "s" if cols == 1 else ("l" if c == 0 else ("r" if c == cols - 1 else "m"))
        rows = ["top", "eave"][-roof_rows:] if roof_rows else []
        for k, rw in enumerate(rows):
            im.alpha_composite(roof_piece(roof, rw, piece), (c * T, k * T))
        im.alpha_composite(wall_bay(wall, piece), (c * T, roof_rows * T))
        if bays and bays[c]:
            im.alpha_composite(BAYS[bays[c]](), (c * T, roof_rows * T))
        sh.alpha_composite(eave_shadow(), (c * T, roof_rows * T))
    if chimney_col is not None:
        im.alpha_composite(chimney(), (chimney_col * T, 0))
    for c in dormer_cols:
        im.alpha_composite(dormer(), (c * T, 0))
    if awnings:
        runs = []
        c = 0
        while c < cols:
            if awnings[c]:
                s = c
                while c + 1 < cols and awnings[c + 1] == awnings[s]:
                    c += 1
                runs.append((s, c, awnings[s]))
            c += 1
        for s, e, colour in runs:
            for c in range(s, e + 1):
                piece = "s" if s == e else ("l" if c == s else ("r" if c == e else "m"))
                sh.alpha_composite(awning_shadow(piece), (c * T, roof_rows * T))
                im.alpha_composite(awning(colour, piece), (c * T, roof_rows * T))
    if signs:
        for c, icon in signs:
            im.alpha_composite(hanging_sign(icon), (c * T, roof_rows * T))
    ground = blank((cols + 1) * T, T)
    for c in range(cols):
        ground.alpha_composite(ground_shadow("m"), (c * T, 0))
    ground.alpha_composite(ground_shadow("end"), (cols * T, 0))
    return im, sh, ground


# ---------------------------------------------------------------- landmark helpers
def big_text(im, x, y, s, name, scale=2):
    for i, ch in enumerate(s.upper()):
        g = GLYPHS[ch]
        for gy, row in enumerate(g):
            for gx, v in enumerate(row):
                if v == "1":
                    rect(im, x + (i * 4 + gx) * scale, y + gy * scale, x + (i * 4 + gx) * scale + scale - 1,
                         y + gy * scale + scale - 1, name)


def big_text_width(s, scale=2):
    return (len(s) * 4 - 1) * scale


def column(im, cx, y0, y1, ramp=("t1", "t3", "t4", "wh")):
    W, H = im.size
    draw_parts(im, [Part("cap", m_rrect(W, H, cx - 6, y0, cx + 6, y0 + 4, 1), list(ramp), 2, band=0),
                    Part("shaft", m_rect(W, H, cx - 4, y0 + 4, cx + 4, y1 - 4), list(ramp), 1, band=1, light=True),
                    Part("base", m_rrect(W, H, cx - 6, y1 - 4, cx + 6, y1, 1), list(ramp), 2, band=0)])
    for x in (cx - 1, cx + 2):
        vline(im, x, y0 + 6, y1 - 6, ramp[0] if x > cx else ramp[1])


def tall_window(im, x0, y0, x1, y1, frame=R["white"], bars=False, arch=False):
    W, H = im.size
    fm = m_rect(W, H, x0, y0, x1, y1)
    gm = m_rect(W, H, x0 + 2, y0 + 2, x1 - 2, y1 - 2)
    if arch:
        cx, r = (x0 + x1 + 1) / 2, (x1 - x0 + 1) / 2
        fm |= m_ellipse(W, H, cx, y0, r, r * 0.8)
        gm |= m_ellipse(W, H, cx, y0 + 2, r - 2, r * 0.8 - 2)
    draw_parts(im, [Part("frame", fm, list(frame), 1, band=0, light=True),
                    Part("glass", gm, ["a0", "a1", "a1", "a2"], 2, outline=False, band=-1)])
    a = np.array(im)
    ys, xs = np.nonzero(gm)
    for y, x in zip(ys, xs):
        if (x - y) % 11 in (0, 1) and (x - y) % 22 < 11:
            a[y, x, :3] = rgb("a3")
        if bars and (x - x0) % 4 == 0:
            a[y, x, :3] = rgb("m0")
    mid = (y0 + y1) // 2
    for x in range(x0 + 2, x1 - 1):
        if gm[mid, x] and not bars:
            a[mid, x, :3] = rgb(frame[2])
    return Image.fromarray(a, "RGBA")


def steps(im, x0, x1, y0):
    W, H = im.size
    for k, (c1, c2) in enumerate((("t4", "t2"), ("t3", "t1"), ("t2", "t0"))):
        y = y0 + k * 3
        if y >= H:
            break
        xa, xb = x0 - k * 2, x1 + k * 2
        hline(im, max(0, xa), min(W - 1, xb), y, c1)
        for yy in range(y + 1, min(H, y + 3)):
            hline(im, max(0, xa), min(W - 1, xb), yy, c2 if yy == y + 2 else "t3")


def stone_wall(w, h, base="t3"):
    im = fill(w, h, base)
    for y in range(0, h, 8):
        hline(im, 0, w - 1, y + 7, "t2")
        hline(im, 0, w - 1, y, "t4")
        for x in range((y // 8 % 2) * 12, w, 24):
            vline(im, x, y, y + 7, "t2")
            if x + 1 < w:
                vline(im, x + 1, y + 1, y + 6, "t4")
    return im


# ---------------------------------------------------------------- landmarks
def bank():
    W, H = 128, 128
    im = blank(W, H)
    im.alpha_composite(stone_wall(W, 96), (0, 32))
    plinth(im, 118)
    vline(im, 0, 32, 127, "t0")
    vline(im, 127, 32, 127, "t0")
    # pediment
    ped = m_poly(W, H, [(-1, 31), (64, 2), (128, 31)]) & m_rect(W, H, 0, 0, W - 1, 31)
    tym = m_poly(W, H, [(12, 28), (64, 8), (115, 28)])
    draw_parts(im, [Part("ped", ped, R["stone"], 1, band=1, light=True),
                    Part("tym", tym, ["t1", "t2", "t3", "t3"], 2, band=0, light=False)])
    draw_parts(im, [Part("coin", m_ellipse(W, H, 64, 21, 6, 6), R["yellow"], 3, band=1, light=True)])
    draw_text(im, 63, 19, "$", "w1")
    # frieze + text
    rect(im, 0, 32, 127, 35, "t4")
    hline(im, 0, 127, 32, "t1")
    rect(im, 2, 37, 125, 52, "t4")
    hline(im, 2, 125, 37, "t2")
    hline(im, 2, 125, 52, "t1")
    vline(im, 2, 37, 52, "t2")
    vline(im, 125, 37, 52, "t1")
    s = "BANK"
    big_text(im, 64 - big_text_width(s) // 2, 40, s, "w0")
    for x in range(0, 128, 4):
        rect(im, x, 54, x + 1, 56, "t4")
        rect(im, x + 2, 54, x + 3, 56, "t1")
    hline(im, 0, 127, 57, "t2")
    hline(im, 0, 127, 58, "t1")
    # vault doorway
    draw_parts(im, [Part("door", m_rect(W, H, 48, 68, 79, 118) | m_ellipse(W, H, 64, 68, 16, 8), ["t0", "t0", "ol1",
                                                                                                   "m0"], 1, band=0)])
    draw_parts(im, [Part("ring", m_ellipse(W, H, 64, 95, 15, 15), R["steel"], 2, band=1, light=True),
                    Part("inner", m_ellipse(W, H, 64, 95, 10, 10), ["m0", "m1", "m2", "t3"], 3, band=1, light=True)])
    for k in range(8):
        ang = k * math.pi / 4
        x, y = 64 + 12.5 * math.cos(ang), 95 + 12.5 * math.sin(ang)
        put(im, round(x - 0.5), round(y - 0.5), C("y1"))
    for k in range(3):
        ang = k * math.pi / 3 + 0.3
        for t in range(-7, 8):
            put(im, round(64 + t * math.cos(ang) - 0.5), round(95 + t * math.sin(ang) - 0.5), C("m0"))
    draw_parts(im, [Part("hub", m_ellipse(W, H, 64, 95, 2.6, 2.6), R["yellow"], 4, band=0)])
    # columns
    for cx in (9, 39, 89, 119):
        column(im, cx, 60, 118)
    im = tall_window(im, 18, 72, 30, 106, bars=True, arch=True)
    im = tall_window(im, 98, 72, 110, 106, bars=True, arch=True)
    steps(im, 40, 87, 119)
    return im


BOOKS = ["r1", "a1", "g1", "y0", "k0", "p1", "h2", "r0", "g2", "a0"]


def book_window(im, x0, y0, x1, y1):
    W, H = im.size
    draw_parts(im, [Part("frame", m_rect(W, H, x0, y0, x1, y1), R["white"], 1, band=0, light=True),
                    Part("back", m_rect(W, H, x0 + 2, y0 + 2, x1 - 2, y1 - 2), ["w0", "w0", "w0", "w1"], 2,
                         outline=False, band=-1)])
    rnd = random.Random(x0 * 7 + y0)
    sh_h = (y1 - y0 - 4) // 3
    for s in range(3):
        base = y0 + 2 + (s + 1) * sh_h
        hline(im, x0 + 2, x1 - 2, base, "w2")
        hline(im, x0 + 2, x1 - 2, base - 1 if False else base, "w2")
        x = x0 + 3
        while x < x1 - 3:
            wd = rnd.choice([1, 2, 2])
            hh = rnd.randint(sh_h - 4, sh_h - 2)
            c = rnd.choice(BOOKS)
            lean = rnd.random() < 0.08
            for k in range(wd):
                for y in range(base - hh, base):
                    put(im, x + k, y, C(c))
                put(im, x + k, base - hh, C("t4" if c in ("p1", "a0", "r0") else "wh"))
            x += wd + (1 if rnd.random() < 0.15 else 0)
    # glass glint over the books
    for k in range(0, y1 - y0 - 4, 9):
        put(im, x0 + 3 + k // 3, y0 + 3 + k, C("a3"))
    vline(im, (x0 + x1) // 2, y0 + 2, y1 - 2, "t3")
    return im


def library():
    W, H = 128, 128
    im, _, _ = compose(4, "brick", "slate", [None, None, None, None], roof_rows=2, dormer_cols=(1, 2))
    im = book_window(im, 4, 76, 27, 112)
    im = book_window(im, 100, 76, 123, 112)
    # double arched door
    frame = m_rect(W, H, 40, 82, 87, 127) | m_ellipse(W, H, 64, 84, 24, 14)
    door = m_rect(W, H, 44, 86, 83, 126) | m_ellipse(W, H, 64, 87, 20, 11)
    draw_parts(im, [Part("frame", frame, R["stone"], 1, band=1, light=True),
                    Part("door", door, R["wood"], 2, band=1, light=True)])
    vline(im, 63, 76, 126, "w0")
    vline(im, 64, 76, 126, "w3")
    for x in (52, 75):
        vline(im, x, 82, 124, "w1")
    rect(im, 54, 80, 73, 86, "a1")
    put(im, 55, 80, C("a3"))
    for x in range(56, 73, 4):
        vline(im, x, 79, 86, "w2")
    put(im, 60, 106, C("y1"))
    put(im, 67, 106, C("y1"))
    # sign board
    draw_parts(im, [Part("board", m_rrect(W, H, 34, 65, 93, 76, 1), R["dark_wood"], 3, band=0, light=True)])
    s = "LIBRARY"
    from pixkit import draw_text as dt
    dt(im, 64 - text_width(s) // 2, 68, s, "y1")
    # open book emblem
    hline(im, 4, 27, 71, "t4")
    steps(im, 42, 85, 125)
    return im


def studio():
    W, H = 128, 128
    im = blank(W, H)
    wall = fill(W, 96, "m1")
    a = np.array(wall)
    ys, xs = np.mgrid[0:96, 0:W]
    a[(xs % 16 == 0), :3] = rgb("m0")
    a[(xs % 16 == 1), :3] = rgb("m2")
    wall = Image.fromarray(a, "RGBA")
    im.alpha_composite(wall, (0, 32))
    plinth(im, 118)
    vline(im, 0, 32, 127, "ol0")
    vline(im, 127, 32, 127, "ol0")
    # parapet
    rect(im, 0, 32, 127, 37, "t3")
    hline(im, 0, 127, 32, "t4")
    hline(im, 0, 127, 37, "t1")
    hline(im, 0, 127, 38, "ol0")
    # marquee band with bulbs
    rect(im, 4, 42, 123, 62, "r0")
    hline(im, 4, 123, 42, "r1")
    hline(im, 4, 123, 62, "ol1")
    for x in range(7, 122, 6):
        put(im, x, 44, C("y2"))
        put(im, x, 60, C("y2"))
        put(im, x + 1, 44, C("y1"))
        put(im, x + 1, 60, C("y1"))
    s = "STUDIO"
    big_text(im, 64 - big_text_width(s) // 2 + 1, 48, s, "ol1")
    big_text(im, 64 - big_text_width(s) // 2, 47, s, "y1")
    # clapperboard on the roof
    board = m_rect(W, H, 34, 12, 93, 30)
    draw_parts(im, [Part("legs", m_rect(W, H, 44, 28, 46, 33) | m_rect(W, H, 82, 28, 84, 33), R["metal"], 1, band=0),
                    Part("board", board, ["ol0", "ol0", "m0", "m1"], 2, band=0, light=True)])
    hline(im, 37, 90, 18, "t3")
    hline(im, 37, 90, 24, "t3")
    vline(im, 63, 18, 28, "t3")
    for x0 in (39, 68):
        hline(im, x0, x0 + 8, 21, "t4")
        hline(im, x0, x0 + 14, 27, "m2")
    draw_text(im, 52, 20, "1", "wh")
    draw_text(im, 84, 20, "3", "wh")
    clap = m_poly(W, H, [(34, 11), (93, 3), (94, 9), (35, 17)])
    draw_parts(im, [Part("clap", clap, ["ol0", "ol0", "m0", "m1"], 3, band=0)])
    X, Y = grid(W, H)
    stripes = clap & ~(np.abs(((X - 34) * 0.95 + (Y - 11) * 0.5)) % 12 < 6)
    stripes &= ~(shift(~clap, 1, 0) | shift(~clap, -1, 0) | shift(~clap, 0, 1) | shift(~clap, 0, -1))
    a = np.array(im)
    a[stripes, :3] = rgb("wh")
    hinge = m_rect(W, H, 34, 11, 37, 17)
    a[hinge & clap, :3] = rgb("m2")
    im = Image.fromarray(a, "RGBA")
    # glass double doors
    draw_parts(im, [Part("frame", m_rect(W, H, 42, 74, 85, 127), R["metal"], 1, band=0, light=True)])
    for x0 in (45, 65):
        draw_parts(im, [Part("g%d" % x0, m_rect(W, H, x0, 77, x0 + 17, 125), ["a0", "a1", "a1", "a2"], 2,
                             outline=False, band=-1)])
        for y in range(77, 126):
            put(im, x0 + (y - 77) // 4 % 18, y, C("a3")) if (y - 77) % 4 == 0 else None
        hline(im, x0 + 2, x0 + 15, 100, "m2")
    draw_text(im, 64 - text_width("STAGE") // 2, 66, "STAGE", "t4")
    # posters
    for x0, kind in ((8, "star"), (98, "sun")):
        draw_parts(im, [Part("pf%d" % x0, m_rect(W, H, x0, 72, x0 + 21, 108), R["yellow"], 1, band=0)])
        bg = "p1" if kind == "star" else "k0"
        rect(im, x0 + 2, 74, x0 + 19, 106, bg)
        if kind == "star":
            sm = m_poly(W, H, [(x0 + 11, 78), (x0 + 13, 85), (x0 + 19, 85), (x0 + 14, 89), (x0 + 16, 96),
                               (x0 + 11, 92), (x0 + 6, 96), (x0 + 8, 89), (x0 + 3, 85), (x0 + 9, 85)])
            a = np.array(im)
            a[sm, :3] = rgb("y1")
            im = Image.fromarray(a, "RGBA")
        else:
            draw_parts(im, [Part("sun", m_ellipse(W, H, x0 + 11, 86, 5, 5), R["yellow"], 3, band=0),
                            Part("hill", m_ellipse(W, H, x0 + 11, 108, 13, 10) & m_rect(W, H, x0 + 2, 0, x0 + 19, 106),
                                 R["green"], 4, band=0)])
        hline(im, x0 + 4, x0 + 17, 101, "t4")
        hline(im, x0 + 6, x0 + 15, 103, "t4")
    return im


def radio(frame):
    W, H = 96, 160
    im = blank(W, H)
    body, _, _ = compose(3, "pink", "green", ["window_square", "door_glass", "window_square"], roof_rows=1)
    im.alpha_composite(body, (0, 64))
    # antenna lattice
    legs = m_capsule(W, H, (40, 72), (46.5, 8), 1.0) | m_capsule(W, H, (56, 72), (49.5, 8), 1.0)
    brace = np.zeros((H, W), bool)
    for k in range(9):
        y0 = 70 - k * 7
        t0 = (72 - y0) / 64
        xl0, xr0 = 40 + 6.5 * t0, 56 - 6.5 * t0
        y1 = y0 - 7
        t1 = (72 - y1) / 64
        xl1, xr1 = 40 + 6.5 * t1, 56 - 6.5 * t1
        if y1 < 8:
            break
        brace |= m_capsule(W, H, (xl0, y0), (xr1, y1), 0.6) if k % 2 == 0 else m_capsule(W, H, (xr0, y0), (xl1, y1),
                                                                                          0.6)
        brace |= m_capsule(W, H, (xl0, y0), (xr0, y0), 0.6)
    draw_parts(im, [Part("brace", brace, ["m0", "m0", "m1", "m2"], 1, outline=False, band=-1),
                    Part("legs", legs, ["m0", "m0", "m1", "m2"], 2, band=0, outline=False),
                    Part("mount", m_rrect(W, H, 36, 70, 60, 75, 1), R["metal"], 3, band=0),
                    Part("tip", m_rect(W, H, 47, 2, 48, 9), R["metal"], 3, band=0)])
    on = frame == 0
    draw_parts(im, [Part("beacon", m_ellipse(W, H, 48, 3, 2.6, 2.6), ["r0", "r0", "r1" if on else "r0",
                                                                      "r2" if on else "r1"], 4, band=0)])
    if on:
        put(im, 47, 2, C("wh"))
    # mid-mast light
    put(im, 47, 40, C("r2" if on else "r0"))
    put(im, 48, 40, C("r1" if on else "r0"))
    # dish
    draw_parts(im, [Part("dishpost", m_rect(W, H, 17, 66, 19, 75), R["metal"], 1, band=0),
                    Part("dish", m_ellipse(W, H, 18, 61, 8, 6.5), R["white"], 2, band=0, light=True),
                    Part("bowl", m_ellipse(W, H, 19, 60, 5.5, 4.2), ["t1", "t2", "t2", "t3"], 3, band=0,
                         light=False),
                    Part("feed", m_capsule(W, H, (19, 60), (24, 55), 0.6), R["metal"], 4, outline=False, band=-1)])
    put(im, 24, 54, C("r1"))
    # RADIO board + ON AIR lamp
    draw_parts(im, [Part("board", m_rrect(W, H, 6, 101, 29, 111, 1), R["white"], 5, band=0)])
    draw_text(im, 8, 104, "RADIO", "r0")
    draw_parts(im, [Part("onair", m_rrect(W, H, 33, 98, 62, 107, 1), ["ol1", "r0", "r1" if on else "r0",
                                                                       "r2" if on else "r1"], 5, band=0)])
    draw_text(im, 36, 100, "ON AIR"[:2], "wh" if on else "k1")
    draw_text(im, 47, 100, "AIR", "wh" if on else "k1")
    return im


def security():
    W, H = 128, 96
    im = blank(W, H)
    im.alpha_composite(fill(W, H, "t4"), (0, 0))
    a = np.array(im)
    ys, xs = np.mgrid[0:H, 0:W]
    a[(ys % 8 == 7) & (ys > 20), :3] = rgb("t3")
    im = Image.fromarray(a, "RGBA")
    plinth(im, 86)
    vline(im, 0, 0, H - 1, "t1")
    vline(im, 127, 0, H - 1, "t0")
    rect(im, 0, 0, 127, 5, "t3")
    hline(im, 0, 127, 0, "t2")
    hline(im, 0, 127, 5, "t1")
    rect(im, 0, 7, 127, 21, "p0")
    hline(im, 0, 127, 7, "p1")
    hline(im, 0, 127, 21, "ol0")
    hline(im, 0, 127, 23, "a1")
    s = "SECURITY"
    big_text(im, 64 - big_text_width(s) // 2, 9, s, "wh")
    # shield badge
    sm = m_poly(W, H, [(56, 27), (72, 27), (72, 35), (64, 42), (56, 35)])
    draw_parts(im, [Part("shield", sm, R["navy"], 1, band=0, light=True)])
    star = m_poly(W, H, [(64, 29), (65, 32), (68, 32), (66, 34), (67, 37), (64, 35), (61, 37), (62, 34), (60, 32),
                         (63, 32)])
    a = np.array(im)
    a[star, :3] = rgb("y1")
    im = Image.fromarray(a, "RGBA")
    # double door
    draw_parts(im, [Part("frame", m_rect(W, H, 44, 45, 83, 95), R["navy"], 1, band=0, light=True)])
    for x0 in (47, 65):
        draw_parts(im, [Part("g%d" % x0, m_rect(W, H, x0, 48, x0 + 15, 93), ["a0", "a1", "a1", "a2"], 2,
                             outline=False, band=-1)])
        for y in range(48, 94, 5):
            put(im, x0 + 2 + (y - 48) // 5, y, C("a3"))
        hline(im, x0 + 2, x0 + 13, 70, "p2")
    for x0 in (7, 99):
        im = tall_window(im, x0, 40, x0 + 21, 72, frame=R["navy"], bars=True)
    # blue stripe at the base
    rect(im, 1, 80, 43, 84, "p1")
    rect(im, 84, 80, 126, 84, "p1")
    hline(im, 1, 43, 80, "p2")
    hline(im, 84, 126, 80, "p2")
    return im


def siren(frame):
    W, H = 64, T
    im = blank(W, H)
    redon, blueon = frame == 0, frame == 1
    draw_parts(im, [Part("base", m_rrect(W, H, 14, 22, 49, 28, 1), R["metal"], 1, band=0),
                    Part("red", m_ellipse(W, H, 24, 21, 7, 6) & m_rect(W, H, 0, 0, W, 23),
                         ["r0", "r0", "r1" if redon else "r0", "r2" if redon else "r1"], 2, band=0, light=True),
                    Part("blue", m_ellipse(W, H, 40, 21, 7, 6) & m_rect(W, H, 0, 0, W, 23),
                         ["p0", "p0", "a1" if blueon else "p1", "a3" if blueon else "p2"], 2, band=0, light=True),
                    Part("mid", m_rect(W, H, 31, 18, 33, 23), R["metal"], 3, band=0)])
    if redon:
        put(im, 21, 17, C("wh"))
        put(im, 22, 17, C("wh"))
    else:
        put(im, 37, 17, C("wh"))
        put(im, 38, 17, C("wh"))
    hline(im, 10, 53, 29, "t1")
    hline(im, 10, 53, 30, "t2")
    hline(im, 10, 53, 31, "t0")
    return im


def siren_glow(frame):
    from pixkit import glow_alpha
    cx = 24 if frame == 0 else 40
    col = "y2"
    return overlay_from_alpha(glow_alpha(64, T, cx, 20, 20, 12, 90), col)


def town_hall():
    W, H = 160, 160
    im = blank(W, H)
    # main roof (row 2) and walls (rows 3-4)
    for c in range(5):
        piece = "l" if c == 0 else ("r" if c == 4 else "m")
        im.alpha_composite(roof_piece("terra", "eave", piece), (c * T, 64))
    im.alpha_composite(stone_wall(W, 64), (0, 96))
    plinth(im, 150)
    vline(im, 0, 96, 159, "t0")
    vline(im, 159, 96, 159, "t0")
    # clock tower (cols 2, rows 0-2)
    draw_parts(im, [Part("tower", m_rect(W, H, 62, 24, 97, 98), R["stone"], 1, band=1, light=True),
                    Part("roof", m_poly(W, H, [(58, 26), (80, 2), (101, 26)]), R["green"], 2, band=1, light=True),
                    Part("trim", m_rect(W, H, 59, 24, 100, 27), R["white"], 3, band=0),
                    Part("spire", m_rect(W, H, 79, 0, 80, 4), R["metal"], 3, band=0)])
    a = np.array(im)
    rm = m_poly(W, H, [(58, 26), (80, 2), (101, 26)])
    for y in range(4, 24, 4):
        for x in range(56, 104):
            if rm[y, x] and has(a, "g1")[y, x]:
                a[y, x, :3] = rgb("g0")
    im = Image.fromarray(a, "RGBA")
    for y in range(32, 98, 8):
        hline(im, 63, 96, y, "t2")
    # clock
    draw_parts(im, [Part("rim", m_ellipse(W, H, 80, 48, 13, 13), R["yellow"], 4, band=1, light=True),
                    Part("face", m_ellipse(W, H, 80, 48, 10, 10), R["white"], 5, band=0, light=False)])
    for (dx, dy) in ((0, -8), (8, 0), (0, 8), (-8, 0)):
        put(im, 79 + dx + (1 if dx < 0 else 0), 47 + dy + (1 if dy < 0 else 0), C("ol0"))
        put(im, 80 + dx - (1 if dx > 0 else 0), 48 + dy - (1 if dy > 0 else 0), C("ol0"))
    for t in range(6):  # minute hand to 2 o'clock
        put(im, round(80 + t * 0.85 - 0.5), round(48 - t * 0.5 - 0.5), C("m0"))
    for t in range(5):  # hour hand to 10 o'clock
        put(im, round(80 - t * 0.85 - 0.5), round(48 - t * 0.5 - 0.5), C("m0"))
    put(im, 79, 47, C("r1"))
    # louvres
    draw_parts(im, [Part("louvre", m_rect(W, H, 72, 66, 87, 86) | m_ellipse(W, H, 80, 66, 8, 5), R["dark_wood"], 6,
                         band=0)])
    for y in range(66, 86, 3):
        hline(im, 74, 85, y, "w2")
    # frieze with TOWN HALL
    rect(im, 4, 99, 155, 109, "t4")
    hline(im, 4, 155, 99, "t2")
    hline(im, 4, 155, 109, "t1")
    s = "TOWN HALL"
    draw_text(im, 80 - text_width(s) // 2, 102, s, "w0")
    # door
    frame = m_rect(W, H, 66, 120, 93, 151) | m_ellipse(W, H, 80, 122, 14, 10)
    door = m_rect(W, H, 69, 124, 90, 150) | m_ellipse(W, H, 80, 125, 11, 8)
    draw_parts(im, [Part("frame", frame, R["stone"], 7, band=1, light=True),
                    Part("door", door, R["wood"], 8, band=1, light=True)])
    vline(im, 79, 118, 150, "w0")
    vline(im, 80, 118, 150, "w3")
    rect(im, 74, 117, 85, 121, "a1")
    hline(im, 74, 85, 117, "a2")
    for cx in (58, 102):
        column(im, cx, 112, 150)
    for x0 in (10, 34, 114, 138):
        im = tall_window(im, x0, 120, x0 + 11, 144, arch=True)
    # flags either side of the door
    for x0, c in ((48, "r1"), (110, "a1")):
        vline(im, x0, 112, 140, "m1")
        draw_parts(im, [Part("flag%d" % x0, m_poly(W, H, [(x0 + 1, 113), (x0 + 9, 115), (x0 + 1, 120)]),
                             ["ol1", R["red" if c == "r1" else "blue"][1], c, c], 9, band=0)])
    steps(im, 62, 97, 151)
    return im


LANDMARKS = ["bank", "library", "studio", "radio", "security", "town_hall"]
