#!/usr/bin/env python3
"""Composes a 30x18-tile demo from tiles-exterior (via the same builders) and writes
<outdir>/vila-city-preview.png (2x) and <outdir>/vila-city-anim.gif (6 fps).

Run: python3 scripts/world-v2/demo_city.py /path/to/outdir
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from pixkit import T, C, blank, m_ellipse, m_rrect, Part, draw_parts, shadow_ellipse, audit  # noqa: E402
import exterior  # noqa: E402
import buildings as bd  # noqa: E402

MW, MH = 30, 18


def tile_of(A, name, i=0, j=0, frame=0):
    it = A.items[name]
    g = it["frames"][frame % len(it["frames"])] if "frames" in it else it["ids"]
    tid = g[j][i]
    return A.tiles[tid] if tid >= 0 else None


def item(A, name, frame=0):
    it = A.items[name]
    n = len(it.get("frames", [0]))
    return A.item_image(name, frame % n)


def silhouette(colour="ol1"):
    """character-height stand-in (32x48, feet on row 46)"""
    W, H = 32, 48
    im = blank(W, H)
    m = m_ellipse(W, H, 16, 14, 9, 9) | m_rrect(W, H, 9, 22, 22, 40, 4) | m_rrect(W, H, 10, 38, 14, 46, 1) | \
        m_rrect(W, H, 17, 38, 21, 46, 1)
    a = np.array(im)
    a[m] = C(colour)
    return Image.fromarray(a, "RGBA")


def corner_terrain():
    """terrain code per corner (31 x 19): G grass, P plaza, D dirt path, S sand, W water"""
    c = [["G"] * (MW + 1) for _ in range(MH + 1)]
    for y in range(10, MH + 1):
        for x in range(MW + 1):
            if 3 <= x <= 13:
                c[y][x] = "P"
            if 15 <= x <= 16:
                c[y][x] = "D"
            if x >= 21:
                c[y][x] = "S"
            if (x >= 23 and y >= 13) or (x >= 22 and y >= 16):
                c[y][x] = "W"
    return c


AUTO = {frozenset("GP"): ("auto_grass_plaza", "G"), frozenset("GD"): ("auto_grass_path", "G"),
        frozenset("GS"): ("auto_grass_sand", "G"), frozenset("SW"): ("auto_sand_water", "S")}
BASE = {"G": "grass_0", "P": "plaza_pavers", "D": "dirt", "S": "sand", "W": "water"}


def ground(A, frame):
    im = blank(MW * T, MH * T)
    c = corner_terrain()
    for y in range(MH):
        for x in range(MW):
            if y <= 4:
                name = ["grass_0", "grass_1"][(x * 7 + y * 3) % 2]
                t = tile_of(A, name)
            elif y in (5, 9):
                name = "sidewalk_curb_s" if y == 5 else "sidewalk_curb_n"
                if x in (8, 9):
                    name = "sidewalk"
                t = tile_of(A, name)
            elif 6 <= y <= 8:
                if x in (8, 9):
                    t = tile_of(A, "crosswalk_h")
                else:
                    t = tile_of(A, "road_lane_h" if y == 7 else "road")
            else:
                cs = (c[y][x], c[y][x + 1], c[y + 1][x + 1], c[y + 1][x])
                kinds = set(cs)
                if len(kinds) == 1:
                    k = cs[0]
                    name = BASE[k]
                    if k == "G":
                        name = ["grass_0", "grass_1", "grass_2", "grass_0", "grass_3"][(x * 5 + y * 3) % 5]
                    if k == "P" and 5 <= x <= 9 and 11 <= y <= 15:
                        name = "plaza_checker"
                    t = tile_of(A, name, frame=frame if k == "W" else 0)
                else:
                    set_name, a = AUTO[frozenset(kinds)]
                    bits = [0 if v == a else 1 for v in cs]
                    k = bits[0] * 8 + bits[1] * 4 + bits[2] * 2 + bits[3]
                    t = tile_of(A, set_name, k % 4, k // 4, frame)
            im.alpha_composite(t, (x * T, y * T))
    return im


# generic facades: (cols, wall, roof, bays, roof_rows, awnings, signs, chimney col, dormer cols)
GA = (2, "pink", "green", ["window_pair", "door_arched"], 2, ["blue", None], None, None, (0,))
GB = (2, "blue", "brown", ["window_shop", "door_glass"], 2, ["green", None], [(1, "cup")], 1, ())
GC = (2, "cream", "terra", ["door_panel", "window_arched"], 2, [None, "red"], [(0, "flower")], None, (1,))


def scene(A, t, figures=True):
    """t = gif frame (6 fps); figures=False leaves out the stand-in characters (night preview draws real bots)"""
    wf = (t * 4 // 6) % 4
    im = ground(A, wf)
    over = blank(MW * T, MH * T)  # ground shadows
    objs = []  # (sort_y, x_px, y_px, image)
    above = []
    glows = []

    def add(img, tx, ty, sort=None, px=0, py=0):
        x, y = tx * T + px, ty * T + py
        objs.append(((sort if sort is not None else y + img.height), x, y, img))

    # --- buildings along the top street (wall bottom row = 4)
    row_bottom = 5
    blds = [("bank", 0), (GA, 4), ("town_hall", 6), ("library", 11), (GB, 15), (GC, 17), ("studio", 19),
            ("radio", 23), ("security", 26)]
    for b, x in blds:
        if isinstance(b, tuple):
            fac, sh, gr = bd.compose(*b)
            fac = fac.copy()
            fac.alpha_composite(sh)
            add(fac, x, row_bottom - fac.height // T, sort=row_bottom * T)
            over.alpha_composite(gr, (x * T, row_bottom * T))
        else:
            img = item(A, b, (t // 3) % 2)
            add(img, x, row_bottom - img.height // T, sort=row_bottom * T)
            w = img.width // T
            for c in range(w):
                over.alpha_composite(tile_of(A, "shadow_ground_m"), ((x + c) * T, row_bottom * T))
            over.alpha_composite(tile_of(A, "shadow_ground_end"), ((x + w) * T, row_bottom * T))
    # siren on the security roof
    add(item(A, "siren", (t // 2) % 2), 27, 1, sort=5 * T - 1)
    glows.append((item(A, "siren_glow", (t // 2) % 2), 27 * T, 1 * T))
    # wall lamps beside doors
    for x in (5, 16):
        add(tile_of(A, "wall_lamp_night"), x, 3, sort=5 * T, px=-16)
        glows.append((tile_of(A, "wall_lamp_glow"), x * T - 16, 3 * T))
    # --- street furniture on the sidewalks
    add(item(A, "mailbox"), 13, 5)
    add(item(A, "flower_pot"), 7, 5)
    add(item(A, "flower_pot"), 10, 5)
    add(item(A, "bench_front"), 20, 5)
    over.alpha_composite(item(A, "shadow_wide"), (20 * T, 5 * T))
    for x in (14, 25):
        add(item(A, "lamp_night"), x, 4)
        over.alpha_composite(tile_of(A, "shadow_pole"), (x * T, 5 * T))
        glows.append((item(A, "lamp_glow", (t + x) % 4), (x - 1) * T, 3 * T))
    # --- plaza
    over.alpha_composite(item(A, "fountain_shadow"), (6 * T, 13 * T))
    add(item(A, "fountain", t % 4), 6, 11)
    for x in (4, 10):
        add(item(A, "flower_box"), x, 10)
        over.alpha_composite(item(A, "shadow_wide"), (x * T, 10 * T))
    for x in (3, 12):
        add(item(A, "lamp_night"), x, 11)
        over.alpha_composite(tile_of(A, "shadow_pole"), (x * T, 12 * T))
        glows.append((item(A, "lamp_glow", (t + x) % 4), (x - 1) * T, 10 * T))
    for x in (4, 9):
        add(item(A, "bench_front"), x, 15)
        over.alpha_composite(item(A, "shadow_wide"), (x * T, 15 * T))
    if figures:
        add(silhouette("p1"), 11, 13, px=0, py=-16 + 2)
    add(item(A, "bush_berry"), 1, 11)
    over.alpha_composite(tile_of(A, "shadow_round"), (1 * T, 11 * T))
    add(item(A, "bush_flower"), 17, 11)
    over.alpha_composite(tile_of(A, "shadow_round"), (17 * T, 11 * T))
    add(item(A, "flower_patch"), 0, 16, sort=0)
    add(item(A, "signpost"), 16, 10)
    over.alpha_composite(tile_of(A, "shadow_pole"), (16 * T, 11 * T))
    # --- trees (trunk in the y-sorted layer, canopy above everything)
    for sp, x, y in (("pine", 0, 13), ("round", 16, 13), ("autumn", 19, 15)):
        over.alpha_composite(item(A, "tree_%s_shadow" % sp), (x * T, (y + 2) * T))
        add(item(A, "tree_%s_trunk" % sp), x, y + 1)
        above.append((item(A, "tree_%s_canopy" % sp), x * T, y * T))
    add(item(A, "leaf_litter"), 19, 17, sort=0)
    # stand-in silhouette walking behind the round tree (north of the trunk)
    if figures:
        add(silhouette(), 16, 13, px=-6, py=36)
    # --- server towers + smoke
    for st, x in (("red", 18), ("green", 19)):
        over.alpha_composite(item(A, "tower_shadow"), (x * T, 12 * T))
        add(item(A, "server_tower_" + st, (t // 3) % 2), x, 10)
    above.append((item(A, "smoke", t % 6), 18 * T, 9 * T + 6))
    above.append((item(A, "smoke", (t + 3) % 6), 18 * T + 4, 9 * T - 8))
    # --- port
    add(item(A, "barrel"), 22, 10)
    over.alpha_composite(tile_of(A, "shadow_round"), (22 * T, 10 * T))
    add(item(A, "crate"), 23, 10)
    add(item(A, "crate_stack"), 21, 10)
    over.alpha_composite(tile_of(A, "shadow_round"), (23 * T, 10 * T))
    for y in range(12, 16):
        add(tile_of(A, "dock_planks_v"), 25, y, sort=y * T)
        add(tile_of(A, "dock_planks_v"), 26, y, sort=y * T)
    add(tile_of(A, "dock_edge_s"), 25, 16, sort=16 * T)
    add(tile_of(A, "dock_edge_s"), 26, 16, sort=16 * T)
    add(tile_of(A, "dock_edge_w"), 25, 13, sort=13 * T + 1)
    add(tile_of(A, "dock_edge_w"), 25, 14, sort=14 * T + 1)
    add(tile_of(A, "dock_edge_w"), 25, 15, sort=15 * T + 1)
    add(tile_of(A, "dock_edge_e"), 26, 13, sort=13 * T + 1)
    add(tile_of(A, "dock_edge_e"), 26, 14, sort=14 * T + 1)
    add(tile_of(A, "dock_edge_e"), 26, 15, sort=15 * T + 1)
    add(tile_of(A, "dock_bollard"), 26, 14, px=0)
    add(tile_of(A, "dock_rope_coil"), 25, 13)
    add(tile_of(A, "dock_ladder"), 25, 16, sort=16 * T + 2)
    for k, (bt, x, y) in enumerate((("row", 27, 14), ("fish", 22, 15))):
        sh = item(A, "boat_shadow")
        objs.append((y * T + 1, x * T, y * T, sh))
        add(item(A, "boat_" + bt, (t // 3 + k) % 2), x, y)
    if figures:
        add(silhouette("p1"), 25, 12, py=2)
    add(item(A, "lamp_night"), 28, 10)
    glows.append((item(A, "lamp_glow", (t + 2) % 4), 27 * T, 9 * T))

    im.alpha_composite(over)
    for _, x, y, img in sorted(objs, key=lambda o: (o[0], o[1])):
        im.alpha_composite(img, (x, y))
    for img, x, y in above:
        im.alpha_composite(img, (x, y))
    for img, x, y in glows:
        im.alpha_composite(img, (x, y))
    return im


def main(outdir):
    A = exterior.build()
    frames = [scene(A, t) for t in range(12)]
    first = frames[0]
    first.resize((first.width * 2, first.height * 2), Image.NEAREST).save(
        os.path.join(outdir, "vila-city-preview.png"))
    rgbf = [f.convert("RGB") for f in frames]
    pal = rgbf[0].quantize(colors=255, method=Image.MEDIANCUT, dither=Image.Dither.NONE)
    q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in rgbf]
    q[0].save(os.path.join(outdir, "vila-city-anim.gif"), save_all=True, append_images=q[1:], duration=167, loop=0)
    print("opaque off-palette px in frame 0 before glow:", audit(first)[0])


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp")
