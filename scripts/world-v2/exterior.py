#!/usr/bin/env python3
"""Builds v2/tiles-exterior.png + .tsx + .json (32px exterior tileset). Deterministic.

Run from anywhere: python3 scripts/world-v2/exterior.py
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'public', 'world', 'v2')

from pixkit import T, Atlas, PALETTE, blank, audit, mixed_alpha_tiles, labelled_sheet  # noqa: E402
import terrain as tr  # noqa: E402
import nature as nt  # noqa: E402
import props as pr  # noqa: E402
import buildings as bd  # noqa: E402

BLOCK = {"block": True}
ABOVE = {"layer": "above"}
SHADOW = {"overlay": "shadow"}
GLOW = {"overlay": "glow", "layer": "above"}


def bottom_block(h, top_above=True):
    def f(i, j):
        if j == h - 1:
            return {"block": True}
        return {"layer": "above"} if top_above else {}
    return f


def water_share(img):
    a = np.array(img)
    water = np.zeros(a.shape[:2], bool)
    for n in ("a0", "a1", "a2", "a3", "wh"):
        from pixkit import rgb
        water |= np.all(a[..., :3] == rgb(n), axis=-1)
    return water.mean()


def build():
    A = Atlas("tiles-exterior", 16)

    # ------------------------------------------------ terrain
    A.section("terrain")
    for v in range(4):
        A.add("grass_%d" % v, tr.grass(v))
    A.add("dirt", tr.dirt())
    A.add("street_cobble", tr.street())
    A.add("road", tr.road())
    A.add("road_lane_h", tr.road_lane(True))
    A.add("road_lane_v", tr.road_lane(False))
    A.add("crosswalk_h", tr.crosswalk(True))
    A.add("crosswalk_v", tr.crosswalk(False))
    A.add("sidewalk", tr.sidewalk())
    for s in ("n", "s", "e", "w", "ne", "nw", "se", "sw"):
        A.add("sidewalk_curb_" + s, tr.sidewalk_curb(set(s)))
    A.add("plaza_checker", tr.checker())
    A.add("plaza_pavers", tr.pavers(3))
    A.add("plaza_pavers_cracked", tr.pavers(3, cracks=True))
    A.add("plaza_terracotta", tr.basketweave())
    A.add("sand", tr.sand())
    A.add("dock_planks_h", tr.planks(False))
    A.add("dock_planks_v", tr.planks(True))
    A.add("rock_ground", tr.rock_ground())
    A.add("cliff_top", tr.cliff("top"))
    for k in ("face", "face_alt", "base"):
        A.add("cliff_" + k, tr.cliff(k), BLOCK)
    A.add("water", [tr.water(f) for f in range(4)], BLOCK, fps=4)

    # ------------------------------------------------ autotiles (16-piece corner sets)
    A.section("autotiles")
    sets = [("auto_grass_path", tr.grass(0), tr.dirt(), "path", 1, ("grass", "#72c048"), ("path", "#b0743f")),
            ("auto_grass_plaza", tr.grass(0), tr.pavers(3), "plaza", 2, ("grass", "#72c048"), ("plaza", "#e3cba6")),
            ("auto_grass_sand", tr.grass(0), tr.sand(), "sand", 4, ("grass", "#72c048"), ("sand", "#f6e7cf"))]
    for name, a, b, style, seed, ca, cb in sets:
        img, corners = tr.wang_set(a, b, style, seed)
        grids = A.add(name, img, info={"corner_order": "tl,tr,br,bl", "tile_index": "tl*8+tr*4+br*2+bl",
                                       "terrains": [ca[0], cb[0]]})
        A.add_wangset(name.replace("auto_", "").replace("_", "-"), [ca, cb],
                      [(grids[0][k // 4][k % 4], tuple(c + 1 for c in corners[k])) for k in range(16)])
    frames = []
    for f in range(4):
        img, corners = tr.wang_set(tr.sand(), tr.water(f), "shore", 3, f)
        frames.append(img)

    def shore_props(i, j):
        return {"block": True} if water_share(frames[0].crop((i * T, j * T, i * T + T, j * T + T))) > 0.5 else {}
    grids = A.add("auto_sand_water", frames, tile_props=shore_props, fps=4,
                  info={"corner_order": "tl,tr,br,bl", "tile_index": "tl*8+tr*4+br*2+bl",
                        "terrains": ["sand", "water"]})
    A.add_wangset("sand-water", [("sand", "#e3cba6"), ("water", "#3a78c8")],
                  [(grids[0][k // 4][k % 4], tuple(c + 1 for c in corners[k])) for k in range(16)])

    # ------------------------------------------------ nature
    A.section("nature")
    for sp, fn in (("round", nt.tree_round), ("pine", nt.tree_pine), ("autumn", nt.tree_autumn)):
        trunk, canopy = fn()
        A.add("tree_%s_canopy" % sp, canopy, {"layer": "above"},
              info={"layer_of": "tree_%s" % sp, "offset": [0, 0], "note": "draw after characters"})
        A.add("tree_%s_trunk" % sp, trunk.crop((0, T, 64, 96)),
              tile_props=lambda i, j: {"block": True} if j == 1 else {},
              info={"layer_of": "tree_%s" % sp, "offset": [0, 1]})
        A.add("tree_%s_shadow" % sp, nt.tree_shadow(sp), SHADOW, info={"layer_of": "tree_%s" % sp,
                                                                        "offset": [0, 2]})
    for k in ("plain", "berry", "flower"):
        A.add("bush_" + k, nt.bush(k), BLOCK)
    for k in ("h_l", "h_m", "h_r", "single", "v_t", "v_m", "v_b"):
        A.add("hedge_" + k, nt.hedge_piece(k), BLOCK)
    for k in ("h_l", "h_m", "h_r", "single", "v_t", "v_m", "v_b"):
        A.add("hedge_shadow_" + k, nt.hedge_shadow(k), SHADOW)
    A.add("flower_box", nt.flower_box(), BLOCK)
    A.add("flower_pot", nt.flower_pot(), BLOCK)
    A.add("flower_patch", nt.flower_patch())
    A.add("leaf_litter", nt.leaf_litter())
    A.add("shadow_round", nt.small_shadow(), SHADOW)
    A.add("shadow_wide", nt.small_shadow(64, T, 34, 27, 29, 4), SHADOW)
    A.add("shadow_pole", nt.small_shadow(T, T, 18, 28, 7, 3), SHADOW)

    # ------------------------------------------------ props
    A.section("props")
    A.add("bench_front", pr.bench_front(), BLOCK)
    A.add("bench_back", pr.bench_back(), BLOCK)
    side = pr.bench_side()
    A.add("bench_side_r", side, BLOCK)
    A.add("bench_side_l", side.transpose(Image.FLIP_LEFT_RIGHT), BLOCK)
    A.add("lamp_day", pr.lamp(False), tile_props=bottom_block(2))
    A.add("lamp_night", pr.lamp(True), tile_props=bottom_block(2))
    A.add("lamp_glow", [pr.lamp_glow(f) for f in range(4)], GLOW, fps=5,
          info={"offset": [-1, -1], "note": "3x3 overlay, one tile up and left of the 1x2 lamp"})
    A.add("fountain", pr.fountain_frames(), tile_props=lambda i, j: {"layer": "above"} if j == 0 else {"block": True},
          fps=6)
    A.add("fountain_shadow", pr.fountain_shadow().crop((0, 64, 96, 96)), SHADOW, info={"offset": [0, 2]})
    for k in ("h_l", "h_m", "h_r", "gate", "v_t", "v_m", "v_b"):
        A.add("fence_" + k, pr.fence(k), BLOCK)
    A.add("signpost", pr.signpost(), tile_props=bottom_block(2))
    A.add("mailbox", pr.mailbox(), BLOCK)
    A.add("barrel", pr.barrel(), BLOCK)
    A.add("crate", pr.crate(1), BLOCK)
    A.add("crate_stack", pr.crate(2), tile_props=bottom_block(2))

    # ------------------------------------------------ port
    A.section("port")
    for k in ("row", "fish"):
        im = pr.boat(k)
        bob = blank(64, 64)
        bob.alpha_composite(im, (0, 1))
        A.add("boat_" + k, [im, bob], BLOCK, fps=2)
    A.add("boat_shadow", pr.boat_shadow(), SHADOW)
    for k in ("edge_s", "edge_w", "edge_e", "bollard", "ladder", "rope_coil"):
        props = {} if k in ("edge_w", "edge_e", "ladder") else BLOCK
        A.add("dock_" + k, pr.dock_piece(k), props)

    # ------------------------------------------------ server tower + smoke
    A.section("tower")
    for st in ("green", "yellow", "red"):
        A.add("server_tower_" + st, [pr.server_tower(st, f) for f in range(2)], {"state": st},
              tile_props=bottom_block(3), fps=2, sparse=True)
    A.add("tower_shadow", pr.tower_shadow(), SHADOW, info={"offset": [0, 2]})
    A.add("smoke", [pr.smoke(f) for f in range(6)], {"layer": "above"}, fps=6)

    # ------------------------------------------------ facade kit
    A.section("facade kit")
    for colour in bd.WALLS:
        for p in ("l", "m", "r", "s"):
            A.add("wall_%s_%s" % (colour, p), bd.wall_bay(colour, p), BLOCK)
    for kind in bd.ROOFS:
        for row in ("top", "eave"):
            for p in ("l", "m", "r", "s"):
                A.add("roof_%s_%s_%s" % (kind, row, p), bd.roof_piece(kind, row, p), {"layer": "above", "block": True})
    for name, fn in bd.BAYS.items():
        is_door = name.startswith("door")
        A.add(name, fn(), tile_props=(lambda i, j: {"door": True, "block": False} if j == 1 else {}) if is_door
              else None, info={"kind": "overlay", "on": "wall bay (1x2)"})
    for colour in bd.AWN:
        for p in ("l", "m", "r", "s"):
            A.add("awning_%s_%s" % (colour, p), bd.awning(colour, p), ABOVE)
    for p in ("l", "m", "r", "s"):
        A.add("shadow_awning_" + p, bd.awning_shadow(p), SHADOW)
    A.add("shadow_eave", bd.eave_shadow(), SHADOW)
    A.add("shadow_ground_m", bd.ground_shadow("m"), SHADOW)
    A.add("shadow_ground_end", bd.ground_shadow("end"), SHADOW)
    for icon in ("cup", "bread", "flower", "gear"):
        A.add("sign_" + icon, bd.hanging_sign(icon))
    A.add("chimney", bd.chimney(), ABOVE)
    A.add("dormer", bd.dormer(), ABOVE)
    A.add("wall_lamp_day", bd.wall_lamp(False))
    A.add("wall_lamp_night", bd.wall_lamp(True))
    from pixkit import glow as glow_img
    A.add("wall_lamp_glow", glow_img(T, T, 16, 16, 15, 15, 100), GLOW)

    # ------------------------------------------------ landmarks
    A.section("landmarks")

    def landmark_props(h, doors):
        def f(i, j):
            if j >= h - 2:
                if j == h - 1 and i in doors:
                    return {"door": True}
                return {"block": True}
            return {"layer": "above", "block": True}
        return f
    A.add("bank", bd.bank(), tile_props=landmark_props(4, (1, 2)))
    A.add("library", bd.library(), tile_props=landmark_props(4, (1, 2)))
    A.add("studio", bd.studio(), tile_props=landmark_props(4, (1, 2)))
    A.add("radio", [bd.radio(0), bd.radio(1)], tile_props=landmark_props(5, (1,)), fps=2, sparse=True)
    A.add("security", bd.security(), tile_props=landmark_props(3, (1, 2)))
    A.add("siren", [bd.siren(0), bd.siren(1)], {"layer": "above"}, fps=4,
          info={"note": "sits on the security roof line, one row above the facade"})
    A.add("siren_glow", [bd.siren_glow(0), bd.siren_glow(1)], GLOW, fps=4)
    A.add("town_hall", bd.town_hall(), tile_props=landmark_props(5, (2,)))
    return A


def main():
    A = build()
    sheet = A.sheet()
    png = os.path.join(OUT, "tiles-exterior.png")
    sheet.save(png, optimize=True)
    A.write_tsx(os.path.join(OUT, "tiles-exterior.tsx"), "tiles-exterior.png")
    A.write_json(os.path.join(OUT, "tiles-exterior.json"), {"palette": PALETTE})
    bad_op, bad_tr = audit(sheet)
    mixed = mixed_alpha_tiles(A)
    print("tiles:", len(A.tiles), "items:", len(A.items), "sheet:", sheet.size, "bytes:", os.path.getsize(png))
    print("off-palette opaque px:", bad_op, " off-overlay translucent px:", bad_tr)
    print("tiles mixing opaque + translucent (baked shadows):", mixed[:10], len(mixed))
    return A


if __name__ == "__main__":
    A = main()
    if len(sys.argv) > 1:
        labelled_sheet(A, sys.argv[1], 2, 1800, "tiles-exterior.png - every item at 2x (frames side by side)")
