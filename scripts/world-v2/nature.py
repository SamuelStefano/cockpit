"""Trees (trunk + separate canopy layer), bushes, hedges, flower beds and their shadow overlays."""
import random

import numpy as np
from PIL import Image

from pixkit import (T, C, R, rgb, blank, put, grid, m_ellipse, m_rect, m_rrect, m_poly, Part, shape, draw_parts,
                    shadow_ellipse, overlay_from_alpha, soft_ellipse_alpha, shift)


def recolour(im, mask, name):
    a = np.array(im)
    a[mask, :3] = rgb(name)
    return Image.fromarray(a, "RGBA")


def has(a, name):
    return np.all(a[..., :3] == rgb(name), axis=-1) & (a[..., 3] == 255)


# ---------------------------------------------------------------- trees (64x96: 2x3 tiles)
TW, TH = 64, 96


def trunk_img(x0=27, x1=36, top=50, base=91, flare=True):
    im = blank(TW, TH)
    m = m_rrect(TW, TH, x0, top, x1, base, 2)
    if flare:
        m |= m_poly(TW, TH, [(x0 - 5, base + 1), (x0, base - 8), (x1 + 1, base - 8), (x1 + 6, base + 1)])
    draw_parts(im, [Part("trunk", m, R["trunk"], 1, band=1, light=True)])
    a = np.array(im)
    for y in range(top + 8, base - 2, 5):
        x = x0 + 3 + (y // 5) % 3
        if has(a, "w2")[y, x]:
            a[y, x, :3] = rgb("w1")
            a[y + 1, x, :3] = rgb("w1")
    # roots
    for x, y in ((x0 - 3, base - 1), (x1 + 3, base - 1)):
        if a[y, x, 3]:
            a[y, x, :3] = rgb("w1")
    return Image.fromarray(a, "RGBA")


def clump_canopy(blobs, ramp, fruit=None, seed=0):
    canopy = blank(TW, TH)
    m = np.zeros((TH, TW), bool)
    for cx, cy, rx, ry in blobs:
        m |= m_ellipse(TW, TH, cx, cy, rx, ry)
    draw_parts(canopy, [Part("canopy", m, ramp, 1, band=3, light=True, light_band=2)])
    a = np.array(canopy)
    X, Y = grid(TW, TH)
    base, shade, light, hi = ramp[2], ramp[1], ramp[3], ramp[4]
    # clump separation arcs (shadow under each upper clump)
    for cx, cy, rx, ry in blobs[1:]:
        d = np.sqrt(((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2)
        arc = (np.abs(d - 1.0) < 0.08) & (Y > cy) & m & ~has(a, ramp[0])
        a[arc, :3] = rgb(shade)
    # lit clusters on the top-left of each clump
    for cx, cy, rx, ry in blobs:
        hl = m_ellipse(TW, TH, cx - rx * 0.35, cy - ry * 0.45, rx * 0.4, ry * 0.3) & m
        ok = hl & has(a, base)
        a[ok, :3] = rgb(light)
        hl2 = m_ellipse(TW, TH, cx - rx * 0.42, cy - ry * 0.52, rx * 0.17, ry * 0.13) & m
        ok2 = hl2 & has(a, light)
        a[ok2, :3] = rgb(hi)
    # leaf-edge notches on the silhouette (break the perfect ellipse)
    rnd = random.Random(seed)
    edge = m & ~(shift(m, 0, -1) & shift(m, -1, 0) & shift(m, 1, 0))
    ys, xs = np.nonzero(edge)
    for k in range(0, len(xs), 7):
        y, x = ys[k], xs[k]
        if rnd.random() < 0.6 and y > 2:
            a[y - 1, x] = (C(ramp[0]))
    if fruit:
        for x, y in fruit[1]:
            a[y, x, :3] = rgb(fruit[0][1])
            a[y - 1, x, :3] = rgb(fruit[0][2])
            a[y + 1, x, :3] = rgb(fruit[0][0])
    return Image.fromarray(a, "RGBA")


def tree_round():
    blobs = [(32, 34, 26, 22), (16, 44, 13, 12), (48, 44, 13, 12), (32, 54, 20, 12),
             (22, 22, 12, 11), (42, 20, 13, 11), (32, 14, 12, 9)]
    canopy = clump_canopy(blobs, R["leaf"], fruit=(("r0", "r1", "r2"), [(20, 40), (44, 30), (36, 50), (13, 49)]),
                          seed=1)
    return trunk_img(), canopy


def tree_autumn():
    blobs = [(32, 36, 27, 21), (14, 46, 12, 11), (50, 46, 12, 11), (31, 55, 19, 10),
             (20, 24, 13, 11), (44, 22, 13, 12), (30, 13, 13, 9), (52, 32, 9, 9)]
    canopy = clump_canopy(blobs, R["autumn"], seed=2)
    a = np.array(canopy)
    # a few lighter yellow leaves sprinkled on top
    for x, y in ((18, 20), (27, 9), (40, 16), (12, 40), (34, 30), (46, 40), (24, 48)):
        if a[y, x, 3] and not has(a, "h0")[y, x]:
            a[y, x, :3] = rgb("y1")
            a[y, x + 1, :3] = rgb("y0")
    return trunk_img(28, 36, 52, 91), Image.fromarray(a, "RGBA")


def tree_pine():
    canopy = blank(TW, TH)
    m = np.zeros((TH, TW), bool)
    tiers = [(2, 24, 9), (14, 37, 15), (27, 50, 21), (40, 66, 27)]  # top, bottom, half-width at bottom
    for top, bot, hw in tiers:
        pts = [(32, top)]
        n = 6
        for k in range(n + 1):
            x = 32 + hw - k * (2 * hw / n)
            y = bot - (2 if k % 2 else 0)
            pts.append((x, y))
        m |= m_poly(TW, TH, [(32, top), (32 + hw, bot)] + pts[2:] + [(32 - hw, bot)])
    draw_parts(canopy, [Part("pine", m, R["pine"], 1, band=2, light=True, light_band=2)])
    a = np.array(canopy)
    # tier shadow: the tier above shades the top of the tier below
    for top, bot, hw in tiers[:-1]:
        for x in range(TW):
            for dy in (1, 2):
                y = bot + dy
                if y < TH and m[y, x] and not has(a, "q0")[y, x] and abs(x - 32) < hw:
                    a[y, x, :3] = rgb("q0" if dy == 1 else "q1")
    # lit needles on the left of each tier
    for top, bot, hw in tiers:
        for k in range(3):
            y = top + 6 + k * 4
            if y >= bot:
                break
            x = 32 - int((y - top) / (bot - top) * hw) + 4
            for dx in range(3):
                if m[y, x + dx] and has(a, "q1")[y, x + dx]:
                    a[y, x + dx, :3] = rgb("q2")
            if m[y - 1, x + 1] and has(a, "q1")[y - 1, x + 1]:
                a[y - 1, x + 1, :3] = rgb("q3")
    # tiny cones
    for x, y in ((24, 44), (40, 58), (30, 30)):
        if a[y, x, 3]:
            a[y, x, :3] = rgb("w1")
            a[y + 1, x, :3] = rgb("w0")
    return trunk_img(29, 35, 60, 91, flare=True), Image.fromarray(a, "RGBA")


def tree_shadow(kind):
    """64x32 overlay for the bottom row: canopy shadow falls down-right (light from top-left)"""
    rx = {"round": 25, "autumn": 26, "pine": 20}[kind]
    return shadow_ellipse(TW, T, 36, 22, rx, 8, 85)


# ---------------------------------------------------------------- bushes
def bush(kind):
    im = blank(T, T)
    m = m_ellipse(T, T, 16, 19, 13, 10) | m_ellipse(T, T, 10, 16, 8, 8) | m_ellipse(T, T, 21, 14, 8, 8)
    m &= m_rect(T, T, 0, 0, 31, 29)
    ramp = R["leaf"] if kind != "autumn" else R["autumn"]
    draw_parts(im, [Part("bush", m, ramp, 1, band=2, light=True, light_band=1)])
    a = np.array(im)
    for cx, cy, rx, ry in ((10, 16, 8, 8), (21, 14, 8, 8)):
        X, Y = grid(T, T)
        d = np.sqrt(((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2)
        arc = (np.abs(d - 1.0) < 0.12) & (Y > cy) & m & ~has(a, ramp[0])
        a[arc, :3] = rgb(ramp[1])
    im = Image.fromarray(a, "RGBA")
    if kind == "berry":
        for x, y in ((9, 15), (15, 20), (21, 13), (24, 21), (12, 23), (18, 10)):
            put(im, x, y, C("r1"))
            put(im, x + 1, y, C("r0"))
            put(im, x, y - 1, C("r2"))
    if kind == "flower":
        for x, y in ((8, 14), (14, 19), (20, 12), (24, 19), (11, 22), (17, 9), (27, 15)):
            for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                put(im, x + dx, y + dy, C("k1"))
            put(im, x, y, C("y1"))
            put(im, x + 1, y + 1, C("k0"))
    return im


def small_shadow(w=T, h=T, cx=17, cy=27, rx=12, ry=4, alpha=85):
    return shadow_ellipse(w, h, cx, cy, rx, ry, alpha)


# ---------------------------------------------------------------- hedges
def hedge_piece(kind):
    """kind: h_l, h_m, h_r, single, v_t, v_m, v_b - low clipped hedge, 3/4 view"""
    ext = 12
    big = T + 2 * ext
    m = np.zeros((big, big), bool)
    if kind.startswith("h") or kind == "single":
        x0 = ext + (3 if kind in ("h_l", "single") else -ext)
        x1 = ext + T - 1 - (3 if kind in ("h_r", "single") else -ext)
        m |= m_rrect(big, big, x0, ext + 8, x1, ext + 29, 5)
        for cx in range(x0 + 5, x1 - 3, 8):
            m |= m_ellipse(big, big, cx + 0.5, ext + 10, 5.5, 4.5) & m_rect(big, big, x0, 0, x1, big)
        front_rows = (ext + 18, ext + 23)
    else:
        y0 = ext + (8 if kind == "v_t" else -ext)
        y1 = ext + T - 1 - (2 if kind == "v_b" else -ext)
        m |= m_rrect(big, big, ext + 5, y0, ext + 26, y1, 5)
        for cy in range(y0 + 4, y1 - 2, 7):
            m |= m_ellipse(big, big, ext + 6, cy, 3.5, 4.5) & m_rect(big, big, 0, y0, big, y1)
        front_rows = (ext + 26,) if kind == "v_b" else ()
    im = blank(big, big)
    draw_parts(im, [Part("hedge", m, R["leaf"], 1, band=3, light=True, light_band=2)])
    a = np.array(im)
    for yy in front_rows:
        for x in range(big):
            p = x % 6
            dyp = {0: 0, 1: 1, 2: 1, 3: 1, 4: 0, 5: -9}[p]
            if dyp < 0:
                continue
            y = yy + dyp
            if m[y, x] and has(a, "q2")[y, x]:
                a[y, x, :3] = rgb("q1")
            if p == 2 and m[y - 2, x] and has(a, "q2")[y - 2, x]:
                a[y - 2, x, :3] = rgb("q3")
    if kind.startswith("h") or kind == "single":
        for x in range(big):
            if m[ext + 16, x] and has(a, "q2")[ext + 16, x] and x % 3:
                a[ext + 16, x, :3] = rgb("q1")
    else:
        for y in range(big):
            for x in (ext + 20, ext + 22):
                if m[y, x] and has(a, "q2")[y, x] and (y + x) % 4 == 0:
                    a[y, x, :3] = rgb("q1")
    for k, x in enumerate(range(ext + 4, ext + 30, 7)):
        y = ext + 12 + (k % 2) * 2
        if m[y, x] and has(a, "q2")[y, x]:
            a[y, x, :3] = rgb("q3")
            a[y, x + 1, :3] = rgb("q4")
    return Image.fromarray(a, "RGBA").crop((ext, ext, ext + T, ext + T))


def hedge_shadow(kind):
    if kind.startswith("h") or kind == "single":
        x0 = 3 if kind in ("h_l", "single") else -8
        x1 = 34 if kind in ("h_m", "h_l") else 31
        al = np.zeros((T, T))
        for y, v in ((29, 85), (30, 60), (31, 30)):
            al[y, max(0, x0 + 2):min(T, x1 + 2)] = v
        return overlay_from_alpha(al)
    al = np.zeros((T, T))
    for x, v in ((27, 85), (28, 60), (29, 30)):
        y0 = 10 if kind == "v_t" else 0
        y1 = 30 if kind == "v_b" else 32
        al[y0:y1, x] = v
    return overlay_from_alpha(al)


# ---------------------------------------------------------------- flower beds
FLOWERS = ["r1", "y1", "k1", "wh", "r2", "k0", "y1", "r1"]
FDARK = {"r1": "r0", "y1": "y0", "k1": "k0", "wh": "t3", "r2": "r1", "k0": "r0"}


def flower(im, x, y, c):
    for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
        put(im, x + dx, y + dy, C(c))
    put(im, x + 1, y + 1, C(FDARK[c]))
    put(im, x, y + 1, C(FDARK[c]))
    put(im, x, y, C("y2" if c != "y1" else "y0"))
    put(im, x - 1, y - 1, C("wh") if c in ("r2", "k1") else C(c))


def flower_box():
    W = 64
    im = blank(W, T)
    leafm = np.zeros((T, W), bool)
    for k, x in enumerate(range(7, 60, 7)):
        leafm |= m_ellipse(W, T, x, 14 - (k % 2), 5.2, 5.0)
    leafm &= m_rect(W, T, 3, 0, 60, 19)
    draw_parts(im, [Part("leaves", leafm, R["leaf"], 1, band=1, light=True),
                    Part("box", m_rrect(W, T, 1, 17, 62, 29, 2), R["stone"], 2, band=1, light=True)])
    for x in range(4, 60, 12):
        for y in range(21, 28):
            put(im, x, y, C("t1"))
    spots = [(7, 11), (14, 15), (20, 9), (27, 13), (34, 10), (41, 15), (47, 9), (54, 12), (11, 6), (31, 6), (51, 6),
             (58, 15), (24, 16), (44, 16)]
    for k, (x, y) in enumerate(spots):
        flower(im, x, y, FLOWERS[k % len(FLOWERS)])
    return im


def flower_pot():
    im = blank(T, T)
    leafm = m_ellipse(T, T, 16, 13, 11, 8) | m_ellipse(T, T, 10, 10, 6, 5) | m_ellipse(T, T, 22, 10, 6, 5)
    pot = m_poly(T, T, [(7, 17), (25, 17), (23, 29), (9, 29)]) | m_rrect(T, T, 6, 16, 26, 19, 1)
    draw_parts(im, [Part("leaves", leafm, R["leaf"], 1, band=1, light=True),
                    Part("pot", pot, ["h1", "h1", "h2", "h3"], 2, band=1, light=True)])
    for k, (x, y) in enumerate(((10, 8), (16, 6), (22, 9), (13, 13), (19, 12), (25, 13), (7, 13))):
        flower(im, x, y, ["k1", "y1", "r1", "wh", "k1", "r2", "y1"][k])
    return im


def flower_patch():
    """loose flowers on transparent background (decal over grass)"""
    im = blank(T, T)
    rnd = random.Random(5)
    for k, (x, y) in enumerate(((6, 8), (15, 5), (24, 9), (10, 17), (20, 16), (27, 22), (5, 25), (15, 26))):
        put(im, x, y + 2, C("q1"))
        put(im, x + 1, y + 3, C("q1"))
        put(im, x - 1, y + 2, C("q2"))
        flower(im, x, y, ["r1", "y1", "k1", "wh", "r2", "k1", "y1", "wh"][k])
    return im


def leaf_litter():
    im = blank(T, T)
    for k, (x, y) in enumerate(((5, 6), (14, 3), (25, 8), (9, 15), (20, 13), (28, 19), (4, 24), (16, 22), (23, 27),
                                (11, 29))):
        c = ["h2", "h3", "y0", "h1", "h3"][k % 5]
        put(im, x, y, C(c))
        put(im, x + 1, y, C(c))
        put(im, x + 1, y + 1, C("h1" if c != "h1" else "h0"))
    return im
