#!/usr/bin/env python3
"""Builds v2/tiles-interior.png + .tsx + .json and v2/pc.png + pc.json (32px interiors). Deterministic.

Run from anywhere: python3 scripts/world/interior.py [labelled-sheet.png]
"""
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
OUT = os.path.dirname(HERE)

from pixkit import T, Atlas, PALETTE, blank, audit, mixed_alpha_tiles, labelled_sheet  # noqa: E402
import furniture as fu  # noqa: E402

BLOCK = {"block": True}
ABOVE = {"layer": "above"}
SHADOW = {"overlay": "shadow"}
GLOW = {"overlay": "glow", "layer": "above"}
LIGHT = {"overlay": "light", "layer": "above"}
WALLDECOR = {"layer": "wall"}


def bottom_block(h):
    return lambda i, j: {"block": True} if j == h - 1 else {"layer": "above"}


def add_with_shadow(A, name, img, props=None, tile_props=None, frames=None, fps=None, sparse=False):
    A.add(name, frames or img, props, tile_props=tile_props, fps=fps, sparse=sparse)
    A.add(name + "_shadow", fu.drop_shadow(img), SHADOW, info={"layer_of": name, "offset": [0, 0]})


PC_STATES = ["off", "on_a", "on_b", "alert"]


def build_pc():
    """pc.png: 4 columns (off, on_a, on_b, alert) x rows (front, back, front alert frame 2, back alert frame 2, glows)"""
    frames = {}
    rows = [("front", 0), ("back", 0)]
    sheet = blank(4 * T, 5 * T)
    for r, (view, fr) in enumerate(rows):
        for c, st in enumerate(PC_STATES):
            sheet.alpha_composite(fu.pc(view, st, fr), (c * T, r * T))
            frames["%s_%s" % (view, st)] = {"x": c * T, "y": r * T, "w": T, "h": T}
    for c, view in enumerate(("front", "back")):
        sheet.alpha_composite(fu.pc(view, "alert", 1), (c * T, 2 * T))
        frames["%s_alert_2" % view] = {"x": c * T, "y": 2 * T, "w": T, "h": T}
    for c, (name, st, fr) in enumerate((("glow_on", "on_a", 0), ("glow_alert", "alert", 0),
                                        ("glow_alert_2", "alert", 1))):
        sheet.alpha_composite(fu.pc_glow(st, fr), (c * T, 3 * T))
        frames[name] = {"x": c * T, "y": 3 * T, "w": T, "h": T, "overlay": True}
    meta = {
        "frame": {"w": T, "h": T},
        "note": "Monitor + keyboard, drawn on a desk top: put the frame so its bottom row sits 4 px below the "
                "desk's top edge. front = screen faces the viewer (bot seated south of the desk, facing up); "
                "back = bot seated north of the desk facing down. Glows are translucent overlays drawn above.",
        "frames": frames,
        "animations": {
            "front_on": {"frames": ["front_on_a", "front_on_b"], "fps": 3},
            "back_on": {"frames": ["back_on_a", "back_on_b"], "fps": 3},
            "front_alert": {"frames": ["front_alert", "front_alert_2"], "fps": 4,
                            "glow": ["glow_alert", "glow_alert_2"]},
            "back_alert": {"frames": ["back_alert", "back_alert_2"], "fps": 4},
            "front_off": {"frames": ["front_off"], "fps": 1},
            "back_off": {"frames": ["back_off"], "fps": 1},
        },
    }
    return sheet.crop((0, 0, 4 * T, 4 * T)), meta


def build():
    A = Atlas("tiles-interior", 16)

    A.section("floors")
    A.add("floor_wood_h", fu.wood_floor(False))
    A.add("floor_wood_v", fu.wood_floor(True))
    A.add("floor_wood_light", fu.wood_floor(False, light=True))
    A.add("floor_checker_bw", fu.checker_floor("wh", "m1"))
    A.add("floor_checker_warm", fu.checker_floor("t4", "t2"))
    for c in fu.CARPETS:
        A.add("carpet_" + c, fu.carpet(c))

    A.section("walls")
    for colour in fu.WALLC:
        for p in ("l", "m", "r", "s"):
            A.add("wall_%s_%s" % (colour, p), fu.wall_face(colour, p), BLOCK)
    for k in ("top", "bottom", "left", "right", "nw", "ne", "sw", "se"):
        A.add("cap_" + k, fu.cap(k), BLOCK)
    for k in ("base", "left", "corner"):
        A.add("shadow_wall_" + k, fu.wall_shadow(k), SHADOW)
    for cur in ("r", "g", "k"):
        A.add("window_" + cur, fu.window(cur), WALLDECOR)
    A.add("window_light", fu.window_light(), LIGHT, info={"offset": [0, 2], "note": "on the floor below a window"})
    A.add("door_frame", fu.door_frame(), tile_props=lambda i, j: {"door": True, "block": False} if j == 1 else
          {"layer": "wall"})

    A.section("desks and chairs")
    for k in ("single", "double", "l"):
        img = fu.desk(k)
        add_with_shadow(A, "desk_" + k, img, BLOCK)
    for d in ("down", "up", "left", "right"):
        img = fu.chair(d)
        add_with_shadow(A, "chair_" + d, img, {"seat": True, "face": d})

    A.section("storage and kitchen")
    for v in range(3):
        add_with_shadow(A, "bookshelf_%d" % v, fu.bookshelf(v), tile_props=bottom_block(2))
    add_with_shadow(A, "counter", fu.counter(), BLOCK)
    add_with_shadow(A, "counter_sink", fu.counter("sink"), BLOCK)
    add_with_shadow(A, "counter_stove", fu.counter("stove"), BLOCK)
    add_with_shadow(A, "fridge", fu.fridge(), tile_props=bottom_block(2))
    A.add("wall_cabinet", fu.wall_cabinet(), WALLDECOR)
    A.add("hood", fu.hood(), WALLDECOR)

    A.section("living")
    add_with_shadow(A, "sofa", fu.sofa(), BLOCK)
    add_with_shadow(A, "bed", fu.bed(), BLOCK)
    A.add("rug_round", fu.rug("round"), {"layer": "floor"})
    A.add("rug_rect", fu.rug("rect"), {"layer": "floor"})
    for k in ("monstera", "ficus"):
        add_with_shadow(A, "plant_" + k, fu.plant(k), tile_props=bottom_block(2))
    add_with_shadow(A, "plant_succulent", fu.plant("succulent"), BLOCK)
    A.add("plant_hanging", fu.plant("hanging"), WALLDECOR)
    add_with_shadow(A, "lamp_floor", fu.floor_lamp(), tile_props=bottom_block(2))
    A.add("lamp_desk", fu.desk_lamp(), {"layer": "top"})
    A.add("glow_floor_lamp", fu.lamp_glow("floor"), GLOW, info={"offset": [-1, -1]})
    A.add("glow_desk_lamp", fu.lamp_glow("desk"), GLOW, info={"offset": [-1, -1]})

    A.section("wall decor")
    A.add("art_landscape", fu.frame_art("landscape"), WALLDECOR)
    A.add("art_abstract", fu.frame_art("abstract"), WALLDECOR)
    A.add("clock", fu.clock(), WALLDECOR)
    A.add("whiteboard", fu.whiteboard(), WALLDECOR)
    A.add("corkboard", fu.corkboard(), WALLDECOR)

    A.section("meeting")
    add_with_shadow(A, "table_round", fu.round_table(), BLOCK)
    ms = fu.meeting_set()

    def meeting_props(i, j):
        return {"block": True} if 1 <= i <= 3 and 1 <= j <= 3 else {}
    add_with_shadow(A, "meeting_round_8", ms, tile_props=meeting_props)

    A.section("shop and special")
    add_with_shadow(A, "shop_counter", fu.shop_counter(), BLOCK)
    add_with_shadow(A, "shop_shelf_a", fu.shop_shelf(0), BLOCK)
    add_with_shadow(A, "shop_shelf_b", fu.shop_shelf(1), BLOCK)
    A.add("vault_door", fu.vault_door(), {"layer": "wall", "block": True})
    rack = [fu.server_rack(0), fu.server_rack(1)]
    A.add("server_rack", rack, tile_props=bottom_block(2), fps=3, sparse=True)
    A.add("server_rack_shadow", fu.drop_shadow(rack[0]), SHADOW)
    add_with_shadow(A, "easel", fu.easel(), tile_props=bottom_block(2))
    A.add("stage", fu.stage(), tile_props=lambda i, j: {"block": True} if j == 1 else {})
    A.add("stage_shadow", fu.drop_shadow(fu.stage()), SHADOW)
    A.add("screen", fu.screen(), WALLDECOR)
    return A


def main(sheet_path=None):
    A = build()
    sheet = A.sheet()
    png = os.path.join(OUT, "tiles-interior.png")
    sheet.save(png, optimize=True)
    A.write_tsx(os.path.join(OUT, "tiles-interior.tsx"), "tiles-interior.png")
    A.write_json(os.path.join(OUT, "tiles-interior.json"), {"palette": PALETTE})
    pcs, meta = build_pc()
    pcs.save(os.path.join(OUT, "pc.png"), optimize=True)
    json.dump(meta, open(os.path.join(OUT, "pc.json"), "w"), indent=1)
    print("tiles:", len(A.tiles), "items:", len(A.items), "sheet:", sheet.size, "bytes:", os.path.getsize(png))
    print("audit sheet (off-palette opaque, off-overlay translucent):", audit(sheet), " pc:", audit(pcs))
    print("tiles mixing opaque + translucent:", mixed_alpha_tiles(A))
    if sheet_path:
        labelled_sheet(A, sheet_path, 2, 1800, "tiles-interior.png - every item at 2x (frames side by side)")
    return A


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
