"""Street props, fountain, port pieces, the server tower and smoke. Sprites are opaque on transparent;
every cast shadow / glow is a separate overlay image."""
import math
import random

import numpy as np
from PIL import Image

from pixkit import (T, C, R, rgb, blank, put, hline, vline, rect, grid, m_ellipse, m_rect, m_rrect, m_poly, m_capsule,
                    Part, shape, draw_parts, shadow_ellipse, overlay_from_alpha, glow_alpha, soft_ellipse_alpha,
                    shift, draw_text)
from nature import has


def opaque_mask(im):
    return np.array(im)[..., 3] == 255


# ---------------------------------------------------------------- benches
def bench_front():
    W = 64
    im = blank(W, T)
    parts = [Part("leg", m_rect(W, T, x, 16, x + 2, 29), R["metal"], 1, light=False, band=0) for x in (6, 55)]
    parts += [Part("back1", m_rrect(W, T, 3, 3, 60, 7, 1), R["wood"], 2),
              Part("back2", m_rrect(W, T, 3, 9, 60, 13, 1), R["wood"], 2.1),
              Part("post", m_rect(W, T, 8, 2, 10, 17) | m_rect(W, T, 53, 2, 55, 17), R["metal"], 2.5, band=0),
              Part("seat", m_rrect(W, T, 1, 16, 62, 22, 1), R["wood"], 3, band=1)]
    draw_parts(im, parts)
    for x in range(14, 50, 11):
        put(im, x, 5, C("w1"))
        put(im, x + 4, 11, C("w1"))
        put(im, x + 2, 19, C("w1"))
    return im


def bench_back():
    W = 64
    im = blank(W, T)
    parts = [Part("leg", m_rect(W, T, x, 20, x + 2, 29), R["metal"], 1, light=False, band=0) for x in (6, 55)]
    parts += [Part("seat", m_rrect(W, T, 1, 8, 62, 13, 1), R["wood"], 1.5, band=1),
              Part("post", m_rect(W, T, 8, 6, 10, 27) | m_rect(W, T, 53, 6, 55, 27), R["metal"], 2, band=0),
              Part("back1", m_rrect(W, T, 3, 14, 60, 18, 1), R["wood"], 3),
              Part("back2", m_rrect(W, T, 3, 20, 60, 24, 1), R["wood"], 3.1)]
    draw_parts(im, parts)
    for x in range(14, 50, 11):
        put(im, x + 3, 16, C("w1"))
        put(im, x + 7, 22, C("w1"))
    return im


def bench_side():
    """32x64, seat facing right (mirror for left)"""
    H = 64
    im = blank(T, H)
    parts = [Part("leg", m_rect(T, H, 8, y, 21, y + 2), R["metal"], 1, light=False, band=0) for y in (52,)]
    parts += [Part("legs", m_rect(T, H, 9, 30, 11, 58) | m_rect(T, H, 20, 30, 22, 58), R["metal"], 1, band=0),
              Part("seat", m_rrect(T, H, 10, 6, 24, 56, 1), R["wood"], 2, band=1),
              Part("back", m_rrect(T, H, 6, 2, 10, 54, 1), R["wood"], 3, band=1)]
    draw_parts(im, parts)
    for y in range(12, 52, 9):
        put(im, 17, y, C("w1"))
        put(im, 18, y + 4, C("w1"))
    return im


# ---------------------------------------------------------------- lamp
def lamp(lit):
    W, H = T, 64
    im = blank(W, H)
    parts = [
        Part("base", m_rrect(W, H, 11, 54, 20, 61, 1), R["metal"], 1),
        Part("pole", m_rect(W, H, 14, 18, 17, 56), R["metal"], 2, band=0),
        Part("ring", m_rrect(W, H, 12, 17, 19, 19, 1), R["metal"], 3, band=0),
        Part("cage", m_rrect(W, H, 10, 7, 21, 17, 1), R["metal"], 3.5, band=0),
        Part("cap", m_poly(W, H, [(8, 7), (16, 1), (23, 7)]) | m_rect(W, H, 9, 6, 22, 7), R["metal"], 4),
    ]
    draw_parts(im, parts)
    for y in range(9, 16):
        for x in range(12, 20):
            if x in (15, 16):
                continue
            if lit:
                c = "y1" if (y < 12 or x in (12, 17)) else "y0"
            else:
                c = "a3" if (x - y) % 5 else "wh"
                if y > 13:
                    c = "a2"
            put(im, x, y, C(c))
    for y in range(9, 12):
        put(im, 12, y, C("y2" if lit else "wh"))
    put(im, 15, 0, C("m1"))
    put(im, 16, 0, C("m1"))
    return im


def lamp_glow(frame):
    """96x96 overlay (3x3) placed one tile up and one tile left of the 1x2 lamp"""
    W = H = 96
    k = [1.0, 0.85, 1.0, 1.12][frame]
    a = glow_alpha(W, H, 48, 44, 30, 26, 100 * k)
    a = np.maximum(a, glow_alpha(W, H, 48, 90, 22, 6, 70 * k, steps=3))
    return overlay_from_alpha(a, "y2")


# ---------------------------------------------------------------- fountain (96x96, 4 frames)
def fountain_frames():
    W = H = 96
    frames = []
    for f in range(4):
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
        im = Image.fromarray(a, "RGBA")
        water = m_ellipse(W, H, 48, 53, 38, 21)
        wa = np.zeros((H, W, 4), np.uint8)
        wa[water] = C("a2")
        back = water & ~m_ellipse(W, H, 48, 57, 38, 21)
        wa[back] = C("a1")
        back2 = water & ~m_ellipse(W, H, 48, 55, 38, 21)
        wa[back2] = C("a0")
        X, Y = grid(W, H)
        for k in range(2):
            r = 10 + ((f * 4 + k * 8) % 16)
            ring = water & (np.abs(np.sqrt((X - 48) ** 2 + ((Y - 56) / 0.55) ** 2) - r) < 0.7)
            ring &= ~m_ellipse(W, H, 48, 56, 9, 5) & ~back
            wa[ring] = C("a3" if r < 20 else "a2")
            if r >= 20:
                wa[ring & (Y > 56)] = C("a3")
        im.alpha_composite(Image.fromarray(wa, "RGBA"))
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
        for side in (-1, 1):
            for t in range(0, 22):
                u = t / 21
                x = 48 + side * (2 + u * 12)
                y = 22 - 8 * math.sin(math.pi * u * 0.9) + u * 10
                c = "a3" if (t + f * 2) % 6 else "wh"
                put(im, int(x) - (1 if side < 0 else 0), int(y), C(c))
        for t in range(9):
            put(im, 47, 22 - t, C("a3" if (t + f) % 3 else "wh"))
            put(im, 48, 22 - t, C("a2"))
        for k, (dx, ph) in enumerate(((-15, 0), (15, 2), (-9, 1), (9, 3))):
            yy = 38 + ((f + ph) % 4) * 3
            put(im, 48 + dx, yy, C("a3"))
        sp = [[(30, 50), (66, 60)], [(58, 46), (36, 64)], [(70, 52), (26, 58)], [(40, 48), (62, 66)]][f]
        for (x, y) in sp:
            put(im, x, y, C("wh"))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                put(im, x + dx, y + dy, C("a3"))
        frames.append(im)
    return frames


def fountain_shadow():
    return shadow_ellipse(96, 96, 52, 80, 44, 14, 80)


# ---------------------------------------------------------------- fences (picket)
def fence(kind):
    """kind: h_l, h_m, h_r, v_t, v_m, v_b, gate"""
    im = blank(T, T)
    parts = []
    if kind.startswith("h") or kind == "gate":
        x0 = 2 if kind in ("h_l",) else 0
        x1 = 29 if kind in ("h_r",) else 31
        parts.append(Part("rail", m_rect(T, T, x0, 13, x1, 15) | m_rect(T, T, x0, 22, x1, 24), R["wood"], 1, band=0))
        pick = np.zeros((T, T), bool)
        for x in range(x0 + 2, x1 - 1, 5):
            pick |= m_rect(T, T, x, 8, x + 2, 28) | m_poly(T, T, [(x, 8), (x + 1, 6), (x + 2, 8)])
        if kind == "gate":
            pick = np.zeros((T, T), bool)
            for x in range(5, 27, 5):
                top = 10 - int(3 * math.sin((x - 4) / 24 * math.pi))
                pick |= m_rect(T, T, x, top, x + 2, 28) | m_poly(T, T, [(x, top), (x + 1, top - 2), (x + 2, top)])
            parts.append(Part("diag", m_capsule(T, T, (5, 24), (26, 13), 1.2), R["wood"], 3, band=0))
        parts.append(Part("pickets", pick, ["w0", "w2", "w3", "t4"], 2, band=0))
        posts = []
        if kind in ("h_l", "gate"):
            posts.append(0)
        if kind in ("h_r", "gate"):
            posts.append(28)
        for px in posts:
            parts.append(Part("post", m_rect(T, T, px, 5, px + 3, 29) | m_rect(T, T, px - 0, 4, px + 3, 5),
                              R["wood"], 4, band=0))
    else:
        y0 = 4 if kind == "v_t" else 0
        y1 = 28 if kind == "v_b" else 31
        parts.append(Part("rail", m_rect(T, T, 14, y0, 16, y1), R["wood"], 1, band=0))
        for k, y in enumerate(range(y0 + 7, y1 + 1, 6)):
            pk = m_rect(T, T, 13, y - 9, 17, y) | m_rect(T, T, 14, y - 10, 16, y - 10)
            parts.append(Part("pick%d" % k, pk & m_rect(T, T, 0, 0, T, 31), ["w0", "w2", "w3", "t4"], 2 + k * 0.01,
                              band=0))
        if kind in ("v_t", "v_b"):
            py = 0 if kind == "v_t" else 20
            parts.append(Part("post", m_rect(T, T, 12, py, 18, py + 10), R["wood"], 3, band=0))
    draw_parts(im, parts)
    return im


# ---------------------------------------------------------------- small props
def signpost():
    W, H = T, 64
    im = blank(W, H)
    draw_parts(im, [
        Part("post", m_rect(W, H, 14, 8, 17, 61), R["wood"], 1, band=0),
        Part("arrow1", m_poly(W, H, [(3, 12), (25, 12), (30, 17), (25, 22), (3, 22)]), R["wood"], 2, band=1),
        Part("arrow2", m_poly(W, H, [(29, 26), (7, 26), (2, 31), (7, 36), (29, 36)]), R["wood"], 3, band=1),
        Part("cap", m_rrect(W, H, 13, 5, 18, 8, 1), R["wood"], 4, band=0)])
    for x in range(6, 22, 3):
        put(im, x, 17, C("w0"))
    for x in range(10, 26, 3):
        put(im, x, 31, C("w0"))
    return im


def mailbox():
    W, H = T, T
    im = blank(W, H)
    draw_parts(im, [
        Part("post", m_rect(W, H, 14, 18, 17, 30), R["wood"], 1, band=0),
        Part("box", m_rrect(W, H, 7, 6, 24, 18, 3), R["red"], 2, band=1, light=True),
        Part("flag", m_rect(W, H, 25, 4, 26, 12) | m_rect(W, H, 25, 4, 29, 7), ["r0", "y0", "y1", "y2"], 3, band=0)])
    hline(im, 10, 21, 11, "r0")
    hline(im, 10, 21, 12, "r2")
    return im


def barrel():
    im = blank(T, T)
    body = m_ellipse(T, T, 16, 17, 11, 12) & m_rect(T, T, 0, 6, 31, 29)
    body |= m_rrect(T, T, 6, 7, 25, 29, 3)
    draw_parts(im, [Part("barrel", body, R["wood"], 1, band=2, light=True),
                    Part("top", m_ellipse(T, T, 16, 8, 9, 3.2), ["w0", "w1", "w1", "w2"], 2, band=0, light=False)])
    a = np.array(im)
    for y in (12, 24):
        for x in range(T):
            if a[y, x, 3] and not has(a, "w0")[y, x]:
                a[y, x, :3] = rgb("m1")
                a[y - 1, x, :3] = rgb("m2") if a[y - 1, x, 3] and not has(a, "w0")[y - 1, x] else a[y - 1, x, :3]
    for x in (11, 16, 21):
        for y in range(13, 23):
            if a[y, x, 3] and has(a, "w2")[y, x]:
                a[y, x, :3] = rgb("w1")
    return Image.fromarray(a, "RGBA")


def crate(h=1):
    H = T * h
    im = blank(T, H)
    for k in range(h):
        y0 = H - 31 - k * 26 + (0 if k == 0 else 4)
        y0 = max(1, y0)
        body = m_rrect(T, H, 4, y0 + 6, 27, y0 + 28, 1)
        top = m_poly(T, H, [(4, y0 + 6), (8, y0 + 1), (29, y0 + 1), (27, y0 + 6)]) if k == h - 1 else None
        parts = [Part("crate%d" % k, body, R["wood"], 1 + k, band=1, light=True)]
        if top is not None:
            parts.append(Part("top%d" % k, top, ["w0", "w2", "w3", "t4"], 1.5 + k, band=0))
        draw_parts(im, parts)
        a = np.array(im)
        # planks + diagonal brace
        for y in (y0 + 13, y0 + 20):
            for x in range(6, 26):
                a[y, x, :3] = rgb("w1")
        for t in range(19):
            x, y = 6 + t, y0 + 26 - t
            if 0 <= y < H:
                a[y, x, :3] = rgb("w3")
                a[y, x + 1, :3] = rgb("w1")
        im = Image.fromarray(a, "RGBA")
    return im


# ---------------------------------------------------------------- boats (64x64)
def boat(kind):
    W, H = 64, 64
    im = blank(W, H)
    hull = m_ellipse(W, H, 32, 46, 29, 11) & m_rect(W, H, 0, 38, W, H)
    hull |= m_ellipse(W, H, 32, 41, 29, 8)
    inner = m_ellipse(W, H, 32, 41, 25, 5.5)
    if kind == "row":
        hramp, stripe = ["r0", "r0", "r1", "r2"], "wh"
    else:
        hramp, stripe = ["p0", "p0", "a1", "a2"], "y1"
    parts = [Part("hull", hull, hramp, 1, band=1, light=True),
             Part("inner", inner, ["w0", "w1", "w2", "w3"], 2, band=0, light=False)]
    draw_parts(im, parts)
    a = np.array(im)
    X, Y = grid(W, H)
    st = hull & ~m_ellipse(W, H, 32, 41, 28, 8) & (Y > 44) & (Y < 47)
    a[st & (a[..., 3] > 0) & ~has(a, hramp[0]), :3] = rgb(stripe)
    im = Image.fromarray(a, "RGBA")
    if kind == "row":
        for x0 in (18, 32, 44):
            rect(im, x0, 38, x0 + 3, 44, "w3")
            vline(im, x0 + 3, 38, 44, "w1")
        # oars
        draw_parts(im, [Part("oar1", m_capsule(W, H, (14, 36), (2, 52), 1.2), R["wood"], 3, band=0),
                        Part("oar2", m_capsule(W, H, (50, 36), (62, 52), 1.2), R["wood"], 3, band=0),
                        Part("blade1", m_ellipse(W, H, 3, 52, 2.5, 3.5), R["wood"], 4, band=0),
                        Part("blade2", m_ellipse(W, H, 61, 52, 2.5, 3.5), R["wood"], 4, band=0)])
    else:
        draw_parts(im, [Part("cabin", m_rrect(W, H, 34, 28, 52, 42, 2), R["white"], 3, band=1),
                        Part("roof", m_rrect(W, H, 32, 25, 54, 29, 1), R["red"], 4, band=0),
                        Part("mast", m_rect(W, H, 22, 2, 23, 42), R["wood"], 3, band=0),
                        Part("sail", m_poly(W, H, [(24, 3), (24, 36), (44, 34)]), R["white"], 2.5, band=1),
                        Part("flag", m_poly(W, H, [(21, 2), (21, 7), (14, 4)]), R["yellow"], 4, band=0)])
        for x in (38, 44):
            rect(im, x, 32, x + 3, 36, "a2")
            put(im, x, 32, C("a3"))
        hline(im, 25, 40, 20, "t3")
    return im


def boat_shadow():
    """water-line shadow under the hull (overlay, 64x64)"""
    return shadow_ellipse(64, 64, 34, 52, 30, 7, 75)


# ---------------------------------------------------------------- dock
def dock_piece(kind):
    from terrain import planks
    if kind in ("planks_h", "planks_v"):
        return planks(kind == "planks_v")
    im = blank(T, T)
    if kind == "edge_s":
        # plank ends + posts dipping into the water below the dock (overlay on a water tile)
        draw_parts(im, [Part("beam", m_rect(T, T, 0, 0, 31, 5), R["wood"], 1, band=0),
                        Part("post1", m_rect(T, T, 3, 0, 8, 22), R["dark_wood"], 2, band=0),
                        Part("post2", m_rect(T, T, 21, 0, 26, 22), R["dark_wood"], 2, band=0)])
        hline(im, 0, 31, 0, "w3")
        for x0 in (3, 21):
            hline(im, x0 - 1, x0 + 6, 23, "a3")
            put(im, x0 - 2, 22, C("a2"))
            put(im, x0 + 7, 22, C("a2"))
            hline(im, x0, x0 + 5, 14, "g1")
            hline(im, x0, x0 + 5, 15, "g0")
    elif kind in ("edge_w", "edge_e"):
        x0 = 0 if kind == "edge_w" else 26
        draw_parts(im, [Part("beam", m_rect(T, T, x0, 0, x0 + 5, 31), R["wood"], 1, band=0)])
        for y in (6, 22):
            draw_parts(im, [Part("bolt", m_rect(T, T, x0 + 1, y, x0 + 4, y + 3), R["metal"], 2, band=0)])
        im = im
    elif kind == "bollard":
        draw_parts(im, [Part("base", m_rrect(T, T, 10, 20, 21, 27, 1), R["metal"], 1),
                        Part("post", m_rrect(T, T, 12, 8, 19, 22, 2), R["metal"], 2),
                        Part("cap", m_ellipse(T, T, 15.5, 9, 6, 3), R["metal"], 3, band=0)])
        draw_parts(im, [Part("rope", m_rect(T, T, 11, 15, 20, 17), ["w0", "w2", "w3", "y2"], 4, band=0)])
    elif kind == "ladder":
        draw_parts(im, [Part("rails", m_rect(T, T, 9, 0, 11, 29) | m_rect(T, T, 20, 0, 22, 29), R["metal"], 1,
                             band=0)])
        for y in range(4, 28, 6):
            draw_parts(im, [Part("rung%d" % y, m_rect(T, T, 12, y, 19, y + 1), R["metal"], 2, band=0)])
        hline(im, 8, 23, 30, "a3")
    elif kind == "rope_coil":
        m = m_ellipse(T, T, 16, 20, 11, 7)
        draw_parts(im, [Part("coil", m, ["w0", "w2", "w3", "t4"], 1, band=1)])
        X, Y = grid(T, T)
        for r in (3, 6, 9):
            ring = m & (np.abs(np.sqrt(((X - 16) / 1.0) ** 2 + ((Y - 20) / 0.64) ** 2) - r) < 0.6)
            a = np.array(im)
            a[ring, :3] = rgb("w1")
            im = Image.fromarray(a, "RGBA")
    return im


# ---------------------------------------------------------------- server tower (32x96, 3 states x 2 frames)
STATE = {"green": ("g1", "g2", "g3"), "yellow": ("y0", "y1", "y2"), "red": ("r0", "r1", "r2")}


def server_tower(state, frame):
    W, H = T, 96
    im = blank(W, H)
    body = m_rrect(W, H, 5, 18, 26, 90, 2)
    draw_parts(im, [
        Part("plinth", m_rrect(W, H, 3, 86, 28, 93, 1), R["stone"], 1),
        Part("body", body, ["ol0", "m0", "m1", "m2"], 2, band=1, light=True),
        Part("top", m_rrect(W, H, 7, 14, 24, 19, 1), ["ol0", "m0", "m1", "m2"], 3, band=0),
        Part("mast", m_rect(W, H, 15, 3, 16, 14), R["metal"], 2.5, band=0),
        Part("dome", m_ellipse(W, H, 15.5, 4, 3.2, 3.2), ["ol0", STATE[state][0], STATE[state][1], STATE[state][2]],
             4, band=0)])
    lo, mid, hi = STATE[state]
    # front panels: vents and LED rows
    for k, y in enumerate(range(24, 82, 7)):
        rect(im, 8, y, 23, y + 4, "m0")
        hline(im, 8, 23, y + 5, "m2")
        if k % 3 == 2:
            for x in range(10, 22, 2):
                vline(im, x, y + 1, y + 3, "m1")
            continue
        for j, x in enumerate((10, 13, 16)):
            on = ((j + k + frame) % 3) != 0
            if state == "red":
                on = (frame + j) % 2 == 0
            put(im, x, y + 2, C(mid if on else lo))
            put(im, x + 1, y + 2, C(hi if on else lo))
        hline(im, 19, 22, y + 2, "m1")
        put(im, 22, y + 2, C("a2" if (k + frame) % 2 else "m1"))
    # beacon highlight flips with the frame
    put(im, 14, 3, C(hi if frame == 0 else mid))
    put(im, 15, 2, C("wh" if frame == 0 else hi))
    # side light seam
    vline(im, 6, 22, 86, "m2")
    return im


def tower_shadow():
    """64x32 overlay on the base row: the tall tower's shadow runs down-right"""
    al = np.zeros((T, 64))
    m = m_poly(64, T, [(6, 26), (26, 22), (60, 30), (40, 31), (10, 31)])
    al[m] = 80
    edge = m & ~(shift(m, 1, 0) & shift(m, -1, 0) & shift(m, 0, 1) & shift(m, 0, -1))
    al[edge] = 45
    return overlay_from_alpha(al)


def tower_glow(state):
    col = {"green": "y2", "yellow": "y2", "red": "y2"}[state]
    return overlay_from_alpha(glow_alpha(T, T, 16, 4, 14, 12, 90), col)


# ---------------------------------------------------------------- smoke puffs (6 frames, 32x32)
def smoke(f):
    im = blank(T, T)
    rise = [0, 4, 9, 14, 19, 23][f]
    size = [3, 4.5, 6, 7, 7.5, 7][f]
    blobs = [(16, 26 - rise, size), (16 - size * 0.7, 28 - rise + size * 0.3, size * 0.7),
             (16 + size * 0.75, 27 - rise + size * 0.2, size * 0.6)]
    m = np.zeros((T, T), bool)
    for cx, cy, r in blobs:
        m |= m_ellipse(T, T, cx, cy, r, r * 0.85)
    if f >= 4:
        # break apart: checker-erode the edge
        X, Y = grid(T, T)
        edge = m & ~(shift(m, 1, 0) & shift(m, -1, 0) & shift(m, 0, 1) & shift(m, 0, -1))
        m &= ~(edge & (((X + Y).astype(int)) % 2 == 0))
        if f == 5:
            m &= ~(((X.astype(int) + Y.astype(int) * 2) % 3) == 0)
    draw_parts(im, [Part("smoke", m, ["t1", "t2", "t4", "wh"], 1, band=1, light=True)])
    return im
