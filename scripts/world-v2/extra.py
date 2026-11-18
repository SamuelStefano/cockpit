#!/usr/bin/env python3
"""Builds v2/tiles-extra.png + .tsx + .json: house name boards (with project icon and the empty open-PR
counter slot) baked over each house's roof eave, and the Corte Radar tower landmark. Deterministic.

Run from anywhere: python3 scripts/world-v2/extra.py [labelled-sheet.png]
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'public', 'world', 'v2')

from pixkit import (T, C, R, Atlas, PALETTE, blank, put, hline, vline, rect, m_ellipse, m_rect, m_rrect, m_capsule,  # noqa: E402
                    m_poly, Part, draw_parts, glyph_pixels, audit, mixed_alpha_tiles, labelled_sheet)

# house id -> (label, icon or None, roof kind under the board, board width in tiles, PR slot)
SIGNS = {
    "itera": ("CASA ITERA", "leaf", "brown", 5, True),
    "dfl": ("CASA DFL", "chip", "green", 4, True),
    "deck": ("CASA DECK", "robot", "slate", 5, True),
    "qa": ("OFICINA QA", "magnifier", "terra", 5, True),
    "servidores": ("SERVIDORES", None, "slate", 4, False),
}
PILL = (14, 9)


def ext_item(name):
    meta = json.load(open(os.path.join(OUT, "tiles-exterior.json")))
    sheet = Image.open(os.path.join(OUT, "tiles-exterior.png")).convert("RGBA")
    it = meta["items"][name]
    cols = meta["columns"]
    im = blank(it["w"] * T, it["h"] * T)
    for j, row in enumerate(it["ids"]):
        for i, tid in enumerate(row):
            if tid >= 0:
                im.alpha_composite(sheet.crop(((tid % cols) * T, (tid // cols) * T, (tid % cols + 1) * T,
                                               (tid // cols + 1) * T)), (i * T, j * T))
    return im


def big_text(img, x, y, s, name, scale=2, advance=None):
    adv = advance or 4 * scale
    for i, ch in enumerate(s):
        for gx, gy in glyph_pixels(ch):
            for dy in range(scale):
                for dx in range(scale):
                    put(img, x + i * adv + gx * scale + dx, y + gy * scale + dy, C(name))


def big_text_width(s, scale=2, advance=None):
    adv = advance or 4 * scale
    return (len(s) - 1) * adv + 3 * scale


# ---------------------------------------------------------------- 16x16 project icons (original)

def icon_leaf():
    W = 16
    im = blank(W, W)
    left = m_poly(W, W, [(7.5, 13), (1.5, 9), (1.5, 4.5), (4, 3.5), (7.5, 8)])
    right = m_poly(W, W, [(8.5, 11), (14.5, 6), (14, 1.5), (10, 1.5), (8, 5), (8, 10)])
    stem = m_rect(W, W, 7, 7, 8, 15)
    draw_parts(im, [Part("stem", stem, ["q0", "q0", "q1", "q2"], 1, band=0),
                    Part("left", left, ["g0", "g0", "g1", "g2"], 2),
                    Part("right", right, ["g0", "g1", "g2", "g3"], 3)])
    put(im, 11, 4, C("g3"))
    put(im, 10, 6, C("g1"))
    return im


def icon_chip():
    W = 16
    im = blank(W, W)
    for k in (4, 7, 10):
        vline(im, k + 1, 0, 15, "m2")
        hline(im, 0, 15, k + 1, "m2")
    draw_parts(im, [Part("chip", m_rrect(W, W, 2, 2, 13, 13, 1), ["p0", "p0", "p1", "p2"], 1, band=0)])
    for (x, y) in ((6, 5), (5, 6), (4, 7), (5, 8), (6, 9)):
        put(im, x, y, C("y1"))
    for (x, y) in ((9, 5), (10, 6), (11, 7), (10, 8), (9, 9)):
        put(im, x, y, C("y1"))
    put(im, 8, 10, C("a2"))
    put(im, 7, 4, C("a2"))
    return im


def icon_robot():
    W = 16
    im = blank(W, W)
    draw_parts(im, [Part("ant", m_rect(W, W, 7, 1, 8, 4), R["metal"], 1, band=0, outline=False),
                    Part("tip", m_ellipse(W, W, 7.5, 1.5, 1.6, 1.6), ["h1", "h1", "y0", "y1"], 2, band=0),
                    Part("ears", m_rrect(W, W, 1, 7, 14, 10, 1), ["w0", "w0", "w1", "w2"], 3, band=0),
                    Part("head", m_rrect(W, W, 2, 4, 13, 14, 2), ["h1", "h2", "h3", "y1"], 4)])
    rect(im, 4, 7, 11, 10, "ol0")
    for x in (5, 9):
        rect(im, x, 8, x + 1, 9, "y2")
        put(im, x, 8, C("wh"))
    hline(im, 6, 9, 12, "h1")
    return im


def icon_magnifier():
    W = 16
    im = blank(W, W)
    draw_parts(im, [Part("handle", m_capsule(W, W, (10.5, 10.5), (14, 14), 1.4), R["wood"], 1, band=0),
                    Part("ring", m_ellipse(W, W, 6.5, 6.5, 5.6, 5.6), R["metal"], 2, band=0),
                    Part("glass", m_ellipse(W, W, 6.5, 6.5, 3.9, 3.9), ["a1", "a2", "a2", "a3"], 3, band=0,
                         outline=False)])
    for (x, y) in ((4, 6), (5, 7), (6, 8), (7, 7), (8, 6), (9, 5)):
        put(im, x, y, C("g0"))
        put(im, x, y - 1, C("g1"))
    return im


ICONS = {"leaf": icon_leaf, "chip": icon_chip, "robot": icon_robot, "magnifier": icon_magnifier}


# ---------------------------------------------------------------- name boards

def pill(im, x, y):
    w, h = PILL
    rect(im, x + 1, y, x + w - 2, y + h - 1, "y1")
    rect(im, x, y + 1, x + w - 1, y + h - 2, "y1")
    rect(im, x + 1, y + 1, x + w - 2, y + h - 2, "ol0")
    hline(im, x + 2, x + w - 3, y + 1, "m0")


def board(label, icon, width_px, slot, advance=None, base=None):
    """returns (image width_px x 32, info) - the board on a transparent tile row (or on `base`)"""
    W = width_px
    im = base.copy() if base is not None else blank(W, T)
    x0, x1, y0, y1 = 2, W - 3, 4, 27
    draw_parts(im, [Part("board", m_rrect(W, T, x0, y0, x1, y1, 2), ["ol0", "w0", "w1", "w2"], 1, band=0)])
    rect(im, x0 + 3, y0 + 3, x1 - 3, y1 - 3, "w0")
    hline(im, x0 + 3, x1 - 3, y0 + 3, "ol0")
    info = {}
    left = x0 + 5
    right = x1 - 5
    if icon:
        ic = ICONS[icon]()
        im.alpha_composite(ic, (left, 8))
        info["icon"] = [left, 8, 16, 16]
        left += 16 + 4
    if slot:
        px = right - PILL[0] + 1
        pill(im, px, 12)
        info["pr_slot"] = [px, 12, PILL[0], PILL[1]]
        right = px - 4
    tw = big_text_width(label, 2, advance)
    assert tw <= right - left + 1, (label, tw, right - left + 1)
    tx = left + (right - left + 1 - tw) // 2
    big_text(im, tx, 11, label, "t4", 2, advance)
    hline(im, tx, tx + tw - 1, 21, "ol0")
    info["text"] = [tx, 11, tw, 10]
    return im, info


def eave_strip(roof, n):
    im = blank(n * T, T)
    for i in range(n):
        im.alpha_composite(ext_item("roof_%s_eave_m" % roof), (i * T, 0))
    return im


# ---------------------------------------------------------------- Corte Radar tower (4 x 9 tiles)

def clapper(im, x, y):
    """16x13 clapperboard: striped arm over a dark slate"""
    rect(im, x, y + 4, x + 15, y + 12, "ol0")
    rect(im, x + 1, y + 5, x + 14, y + 11, "m0")
    hline(im, x + 2, x + 13, y + 8, "m2")
    hline(im, x + 2, x + 8, y + 10, "m1")
    for k in range(4):
        rect(im, x + k * 4, y, x + k * 4 + 1, y + 3, "wh")
        rect(im, x + k * 4 + 2, y, x + k * 4 + 3, y + 3, "ol0")
    hline(im, x, x + 15, y + 3, "ol0")


def radar_tower(frame):
    W, H = 128, 288
    im = blank(W, H)
    on = frame == 0
    base_y = 222
    top_y = 92
    legs = np.zeros((H, W), bool)
    brace = np.zeros((H, W), bool)
    lx0, rx0, lx1, rx1 = 22, 105, 46, 81
    for a, b in (((lx0, base_y), (lx1, top_y)), ((rx0, base_y), (rx1, top_y)),
                 ((lx0 + 14, base_y), (lx1 + 6, top_y)), ((rx0 - 14, base_y), (rx1 - 6, top_y))):
        legs |= m_capsule(W, H, a, b, 1.3)

    def xl(y):
        return lx0 + (lx1 - lx0) * (base_y - y) / (base_y - top_y)

    def xr(y):
        return rx0 + (rx1 - rx0) * (base_y - y) / (base_y - top_y)
    ys = [base_y - k * 16 for k in range(9)]
    for k in range(len(ys) - 1):
        y0, y1 = ys[k], ys[k + 1]
        brace |= m_capsule(W, H, (xl(y0), y0), (xr(y0), y0), 0.7)
        brace |= m_capsule(W, H, (xl(y0), y0), (xr(y1), y1), 0.6)
        brace |= m_capsule(W, H, (xr(y0), y0), (xl(y1), y1), 0.6)
    draw_parts(im, [Part("brace", brace, ["m0", "m0", "m1", "m2"], 1, outline=False, band=-1),
                    Part("legs", legs, ["ol0", "m0", "m1", "m2"], 2, band=0)])
    # observation cabin
    draw_parts(im, [Part("deck", m_rrect(W, H, 30, 84, 97, 92, 1), R["steel"], 3, band=0),
                    Part("cabin", m_rrect(W, H, 36, 56, 91, 85, 2), ["ol0", "p0", "p1", "p2"], 4),
                    Part("roof", m_poly(W, H, [(30, 58), (64, 40), (97, 58)]), ["ol0", "r0", "r1", "r2"], 5)])
    for x in (41, 55, 69, 81):
        rect(im, x, 64, x + 7, 76, "a1")
        rect(im, x + 1, 65, x + 6, 75, "a2")
        vline(im, x + 1, 65, 70, "a3")
    for x in range(32, 97, 4):
        vline(im, x, 86, 90, "m0")
    # mast + beacon
    draw_parts(im, [Part("mast", m_rect(W, H, 62, 10, 65, 44), R["metal"], 6, band=0),
                    Part("spar", m_rect(W, H, 56, 24, 71, 25), R["metal"], 6, band=0),
                    Part("beacon", m_ellipse(W, H, 63.5, 7.5, 4.2, 4.2),
                         ["r0", "r0", "r1" if on else "r0", "r2" if on else "r1"], 7, band=0)])
    if on:
        put(im, 62, 5, C("wh"))
        put(im, 63, 5, C("y2"))
    put(im, 56, 23, C("r2" if on else "r0"))
    put(im, 71, 23, C("r1" if not on else "r2"))
    # radar dish on the deck
    draw_parts(im, [Part("dishpost", m_rect(W, H, 99, 70, 101, 86), R["metal"], 3, band=0),
                    Part("dish", m_ellipse(W, H, 104, 64, 10, 8), R["white"], 4, band=0),
                    Part("bowl", m_ellipse(W, H, 105, 63, 7, 5.5), ["t1", "t2", "t2", "t3"], 5, band=0, light=False),
                    Part("feed", m_capsule(W, H, (105, 63), (112, 56), 0.7), R["metal"], 6, outline=False, band=-1)])
    put(im, 112, 55, C("r1"))
    clapper(im, 34, 37)
    # base cabin with the name board, door and windows (bottom two rows)
    draw_parts(im, [Part("base", m_rect(W, H, 2, 226, 125, 287), ["ol0", "p0", "p1", "p2"], 8, band=0)])
    for y in range(232, 288, 6):
        hline(im, 4, 123, y, "p0")
    rect(im, 2, 284, 125, 287, "t1")
    hline(im, 2, 125, 284, "t0")
    return im


def tower_board():
    """name board drawn on the base row of the tower (128 x 32)"""
    return board("CORTE RADAR", "clap", 128, True, advance=7)


def icon_clap():
    im = blank(16, 16)
    clapper(im, 0, 2)
    return im


ICONS["clap"] = icon_clap


def tower(frame):
    im = radar_tower(frame)
    b, info = tower_board()
    im.alpha_composite(b, (0, 224))
    # door (column 1) and windows
    rect(im, 38, 258, 57, 285, "ol0")
    rect(im, 40, 260, 55, 285, "a1")
    rect(im, 41, 261, 46, 284, "a2")
    rect(im, 49, 261, 54, 284, "a2")
    vline(im, 47, 260, 285, "ol0")
    vline(im, 48, 260, 285, "ol0")
    vline(im, 42, 262, 270, "a3")
    for x in (72, 96):
        rect(im, x, 262, x + 17, 277, "ol0")
        rect(im, x + 1, 263, x + 16, 276, "a2")
        vline(im, x + 9, 263, 276, "p1")
        hline(im, x + 1, x + 16, 269, "p1")
        vline(im, x + 2, 264, 268, "a3")
    return im, {k: [v[0], v[1] + 224, v[2], v[3]] for k, v in info.items()}


# ---------------------------------------------------------------- atlas

def build():
    A = Atlas("tiles-extra", 16)
    A.section("house name boards")
    meta = {}
    for hid, (label, icon, roof, n, slot) in SIGNS.items():
        im, info = board(label, icon, n * T, slot, base=eave_strip(roof, n))
        A.add("sign_" + hid, im, {"layer": "above"}, info={"house": hid, "label": label, "roof": roof, **info})
        meta[hid] = info
    A.section("corte radar tower")
    frames = [tower(f)[0] for f in range(2)]
    _, tinfo = tower(0)

    def tower_props(i, j):
        if j >= 7:
            if j == 8 and i == 1:
                return {"door": True}
            return {"block": True}
        return {"layer": "above"}
    A.add("radar_tower", frames, tile_props=tower_props, fps=2, sparse=True,
          info={"house": "corte-radar", "label": "CORTE RADAR", "door_col": 1, **tinfo})
    return A


def main(sheet_path=None):
    A = build()
    sheet = A.sheet()
    png = os.path.join(OUT, "tiles-extra.png")
    sheet.save(png, optimize=True)
    A.write_tsx(os.path.join(OUT, "tiles-extra.tsx"), "tiles-extra.png")
    A.write_json(os.path.join(OUT, "tiles-extra.json"), {"palette": PALETTE})
    print("tiles:", len(A.tiles), "items:", len(A.items), "sheet:", sheet.size, "bytes:", os.path.getsize(png))
    print("audit sheet (off-palette opaque, off-overlay translucent):", audit(sheet))
    print("tiles mixing opaque + translucent:", mixed_alpha_tiles(A))
    if sheet_path:
        labelled_sheet(A, sheet_path, 2, 1800, "tiles-extra.png - every item at 2x (frames side by side)")
    return A


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
