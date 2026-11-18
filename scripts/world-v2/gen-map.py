#!/usr/bin/env python3
"""Builds public/world/v2/world.tmj: the 96x64 city map (32 px tiles) of the village, from Lara's
zones (mapa-cidade-zonas.json) and the v2 tilesets. Deterministic.

Run: python3 scripts/world-v2/gen-map.py

Buildings are drawn cut away: the facade band (roof + front wall, or a landmark facade) sits on the
door side, the rest of the footprint is the visible interior. Collision = tiles with `block` in the
layers ground, walls and furniture_low; ground2, furniture_high and lights never block, so the upper
half of a doorway and roof overhangs go there.
"""
import json
import os
import sys
import unicodedata
import xml.etree.ElementTree as ET
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
V2 = os.path.join(ROOT, "public", "world", "v2")
OUT = os.path.join(V2, "world.tmj")
HOMES = os.path.join(ROOT, "scripts", "team-homes.json")

W, H, T = 96, 64, 32
LAYERS = ["ground", "ground2", "walls", "furniture_low", "furniture_high", "lights"]
BLOCKING = ("ground", "walls", "furniture_low")


# ---------------------------------------------------------------- tilesets

def load_tileset(name, firstgid):
    root = ET.parse(os.path.join(V2, name + ".tsx")).getroot()
    img = root.find("image")
    tiles, props = [], {}
    for t in root.findall("tile"):
        tid = int(t.get("id"))
        entry = {"id": tid, "type": t.get("type")}
        pr = {}
        ps = t.find("properties")
        if ps is not None:
            plist = []
            for p in ps.findall("property"):
                typ = p.get("type", "string")
                raw = p.get("value")
                val = raw == "true" if typ == "bool" else int(raw) if typ == "int" else float(raw) if typ == "float" else raw
                plist.append({"name": p.get("name"), "type": typ, "value": val})
                pr[p.get("name")] = val
            entry["properties"] = plist
        an = t.find("animation")
        if an is not None:
            entry["animation"] = [{"tileid": int(f.get("tileid")), "duration": int(f.get("duration"))}
                                  for f in an.findall("frame")]
        props[tid] = pr
        tiles.append(entry)
    ts = {
        "firstgid": firstgid, "name": root.get("name"), "tilewidth": int(root.get("tilewidth")),
        "tileheight": int(root.get("tileheight")), "tilecount": int(root.get("tilecount")),
        "columns": int(root.get("columns")), "image": img.get("source"), "imagewidth": int(img.get("width")),
        "imageheight": int(img.get("height")), "margin": 0, "spacing": 0, "tiles": tiles,
    }
    items = json.load(open(os.path.join(V2, name + ".json")))["items"]
    return ts, items, props


TS_EXT, ITEMS_EXT, PROPS_EXT = load_tileset("tiles-exterior", 1)
TS_INT, ITEMS_INT, PROPS_INT = load_tileset("tiles-interior", 1 + TS_EXT["tilecount"])
SETS = {"ext": (TS_EXT, ITEMS_EXT, PROPS_EXT), "int": (TS_INT, ITEMS_INT, PROPS_INT)}


def h32(*a):
    v = 2166136261
    for x in a:
        v = ((v ^ (x & 0xffffffff)) * 16777619) & 0xffffffff
    return v


# ---------------------------------------------------------------- world model

class World:
    def __init__(self):
        self.L = {n: [[0] * W for _ in range(H)] for n in LAYERS}
        self.objects = []
        self.zones = []
        self.corner = [["G"] * (W + 1) for _ in range(H + 1)]
        self.buildings = []
        self.reserved = set()

    def gid(self, ts, name, i=0, j=0):
        tset, items, _ = SETS[ts]
        tid = items[name]["ids"][j][i]
        return tset["firstgid"] + tid if tid >= 0 else 0

    def route(self, ts, tid, layer):
        p = SETS[ts][2].get(tid, {})
        if p.get("overlay") == "shadow":
            return "ground2"
        if p.get("overlay") in ("glow", "light"):
            return "lights"
        if p.get("layer") == "above":
            return "furniture_high"
        return layer

    def put(self, ts, name, x, y, layer="furniture_low", route=True, soft=False, cell_layer=None):
        """Stamp an item with its top-left tile at (x, y). soft: only into empty cells.
        cell_layer(i, j, layer) may move single tiles to another layer."""
        tset, items, _ = SETS[ts]
        it = items[name]
        for j, row in enumerate(it["ids"]):
            for i, tid in enumerate(row):
                if tid < 0:
                    continue
                X, Y = x + i, y + j
                if not (0 <= X < W and 0 <= Y < H):
                    continue
                lay = self.route(ts, tid, layer) if route else layer
                if cell_layer:
                    lay = cell_layer(i, j, lay)
                if soft and self.L[lay][Y][X]:
                    continue
                self.L[lay][Y][X] = tset["firstgid"] + tid

    def shadow_of(self, ts, name, x, y):
        if name + "_shadow" in SETS[ts][1]:
            self.put(ts, name + "_shadow", x, y, "ground2", soft=True)

    def clear(self, x, y, layers):
        for n in layers:
            self.L[n][y][x] = 0

    def obj(self, name, x, y, w=0, h=0, point=False, **props):
        o = {"id": len(self.objects) + 1, "name": name, "type": "", "x": x, "y": y, "width": w, "height": h,
             "rotation": 0, "visible": True}
        if point:
            o["point"] = True
        o["properties"] = [prop(k, v) for k, v in props.items()]
        self.objects.append(o)
        return o

    def rect_obj(self, name, x, y, w, h, **props):
        return self.obj(name, x * T, y * T, w * T, h * T, **props)

    def point_obj(self, name, x, y, **props):
        return self.obj(name, x * T + T // 2, y * T + T // 2, point=True, **props)

    def zone(self, name, kind, x, y, w, h):
        self.zones.append((name, kind, x, y, w, h))

    def paint(self, x0, y0, x1, y1, k, inset=False):
        """terrain k on the corners of tiles x0..x1, y0..y1 (inclusive); inset keeps the soft edge inside"""
        d = 1 if inset else 0
        for y in range(max(0, y0 + d), min(H, y1 + 1) + 1):
            for x in range(max(0, x0 + d), min(W, x1 + 1) + 1):
                self.corner[y][x] = k

    def blocked(self, x, y):
        if not (0 <= x < W and 0 <= y < H):
            return True
        for n in BLOCKING:
            g = self.L[n][y][x]
            if g and props_of(g).get("block") is True:
                return True
        return False


def props_of(g):
    if g >= TS_INT["firstgid"]:
        return PROPS_INT.get(g - TS_INT["firstgid"], {})
    return PROPS_EXT.get(g - 1, {})


def prop(k, v):
    if isinstance(v, bool):
        return {"name": k, "type": "bool", "value": v}
    if isinstance(v, int):
        return {"name": k, "type": "int", "value": v}
    if isinstance(v, float):
        return {"name": k, "type": "float", "value": v}
    if isinstance(v, str) and len(v) == 9 and v.startswith("#"):
        return {"name": k, "type": "color", "value": v}
    return {"name": k, "type": "string", "value": v}


# ---------------------------------------------------------------- terrain

AUTO = {frozenset("GP"): ("auto_grass_plaza", "G"), frozenset("GD"): ("auto_grass_path", "G"),
        frozenset("GS"): ("auto_grass_sand", "G"), frozenset("SW"): ("auto_sand_water", "S")}


def resolve(cs):
    cs = list(cs)
    k = set(cs)
    if "D" in k and "P" in k:
        cs = ["P" if c == "D" else c for c in cs]
    if "D" in set(cs) and ("S" in set(cs) or "W" in set(cs)):
        cs = ["S" if c == "D" else c for c in cs]
    if "W" in set(cs) and "G" in set(cs):
        cs = ["S" if c == "G" else c for c in cs]
    if "P" in set(cs) and "S" in set(cs):
        cs = ["S" if c == "P" else c for c in cs]
    return tuple(cs)


def terrain(w):
    for y in range(H):
        for x in range(W):
            cs = resolve((w.corner[y][x], w.corner[y][x + 1], w.corner[y + 1][x + 1], w.corner[y + 1][x]))
            kinds = set(cs)
            if len(kinds) == 1:
                k = cs[0]
                r = h32(x, y, 7)
                if k == "G":
                    name = ["grass_0", "grass_0", "grass_1", "grass_2", "grass_0", "grass_3", "grass_1"][r % 7]
                elif k == "P":
                    name = "plaza_pavers_cracked" if r % 13 == 0 else "plaza_pavers"
                else:
                    name = {"D": "dirt", "S": "sand", "W": "water"}[k]
                w.L["ground"][y][x] = w.gid("ext", name)
            else:
                set_name, a = AUTO[frozenset(kinds)]
                bits = [0 if v == a else 1 for v in cs]
                k = bits[0] * 8 + bits[1] * 4 + bits[2] * 2 + bits[3]
                w.L["ground"][y][x] = w.gid("ext", set_name, k % 4, k // 4)


def set_ground(w, x, y, ts, name):
    w.L["ground"][y][x] = w.gid(ts, name)


# ---------------------------------------------------------------- nature and props

def tree(w, x, y, variant="round"):
    w.put("ext", "tree_%s_shadow" % variant, x, y + 2, "ground2", soft=True)
    w.put("ext", "tree_%s_trunk" % variant, x, y + 1, "furniture_low")
    w.put("ext", "tree_%s_canopy" % variant, x, y, "furniture_high")
    w.point_obj("tree-%d-%d" % (x, y), x, y + 2, kind="tree", variant=variant)


def lamp(w, x, y):
    w.put("ext", "lamp_day", x, y, "furniture_low")
    w.put("ext", "shadow_pole", x, y + 1, "ground2", soft=True)
    w.put("ext", "lamp_glow", x - 1, y - 1, "lights", soft=True)
    w.point_obj("lamp-%d-%d" % (x, y), x, y + 1, kind="lamp")


def bench(w, x, y, facing="down", seats=False):
    name = {"down": "bench_front", "up": "bench_back"}[facing]
    w.put("ext", name, x, y, "furniture_low")
    w.put("ext", "shadow_wide", x, y, "ground2", soft=True)
    w.point_obj("bench-%d-%d" % (x, y), x, y, kind="bench", face=facing, seats=2)


def bush(w, x, y, kind="plain"):
    w.put("ext", "bush_" + kind, x, y, "furniture_low")
    w.put("ext", "shadow_round", x, y, "ground2", soft=True)


def hedge_h(w, x0, x1, y):
    for x in range(x0, x1 + 1):
        p = "single" if x0 == x1 else "h_l" if x == x0 else "h_r" if x == x1 else "h_m"
        w.put("ext", "hedge_" + p, x, y, "furniture_low")
        w.put("ext", "hedge_shadow_" + p, x, y, "ground2", soft=True)


def fence_h(w, x0, x1, y):
    for x in range(x0, x1 + 1):
        p = "h_l" if x == x0 else "h_r" if x == x1 else "h_m"
        w.put("ext", "fence_" + p, x, y, "furniture_low")


def decal(w, x, y, name):
    if not w.L["ground2"][y][x]:
        w.put("ext", name, x, y, "ground2")


# ---------------------------------------------------------------- buildings

FACADE = {"window_arched", "window_square", "window_shop", "window_pair"}


def building(w, b):
    """b: id, x, y, w, h, door (bottom|top|west), band (south|north|None), wall, roof, roof_rows, bays,
    landmark, lm_x, iwall (interior wall colour), floor"""
    x, y, bw, bh = b["x"], b["y"], b["w"], b["h"]
    band = b.get("band")
    F = (b.get("roof_rows", 1) + 2) if band else 0
    floor = b.get("floor", "floor_wood_h")
    for j in range(bh):
        for i in range(bw):
            w.reserved.add((x + i, y + j))
    if band == "south":
        top_wall = True
        fy0, fy1 = y + 3, y + bh - F - 1
        band_y = y + bh - F
        bottom_cap = False
    elif band == "north":
        top_wall = False
        fy0, fy1 = y + F, y + bh - 2
        band_y = y
        bottom_cap = True
    else:
        top_wall = True
        fy0, fy1 = y + 3, y + bh - 2
        band_y = None
        bottom_cap = True
    iw = b.get("iwall", "cream")
    if top_wall:
        for i in range(bw):
            if 0 < i < bw - 1:
                w.put("int", "cap_top", x + i, y, "walls")
                p = "l" if i == 1 else "r" if i == bw - 2 else "m"
                w.put("int", "wall_%s_%s" % (iw, p), x + i, y + 1, "walls")
        w.put("int", "cap_nw", x, y, "walls")
        w.put("int", "cap_ne", x + bw - 1, y, "walls")
        for i in range(1, bw - 1):
            w.put("int", "shadow_wall_corner" if i == 1 else "shadow_wall_base", x + i, y + 3, "ground2")
    side0 = y + 1 if top_wall else y + F
    side1 = (y + bh - F - 1) if band == "south" else y + bh - 2
    for yy in range(side0, side1 + 1):
        w.put("int", "cap_left", x, yy, "walls")
        w.put("int", "cap_right", x + bw - 1, yy, "walls")
        if yy > (y + 3 if top_wall else y + F):
            w.put("int", "shadow_wall_left", x + 1, yy, "ground2", soft=True)
    if not top_wall:
        for i in range(1, bw - 1):
            w.put("int", "shadow_wall_base", x + i, y + F, "ground2", soft=True)
    if bottom_cap:
        for i in range(1, bw - 1):
            w.put("int", "cap_bottom", x + i, y + bh - 1, "walls")
        w.put("int", "cap_sw", x, y + bh - 1, "walls")
        w.put("int", "cap_se", x + bw - 1, y + bh - 1, "walls")
    door = b["door"]
    if door == "west":
        dy = b["door_y"]
        w.clear(x, dy, ["walls"])
        dx = x
    elif door == "east":
        dy = b["door_y"]
        w.clear(x + bw - 1, dy, ["walls"])
        dx = x + bw - 1
    else:
        dx = b["door_x"]
        dy = y if door == "top" else y + bh - 1
    if band:
        facade(w, b, band_y, F, dx if door in ("top", "bottom") else None)
    if band == "south":
        for i in range(bw):
            w.put("ext", "shadow_ground_m", x + i, y + bh, "ground2", soft=True)
        w.put("ext", "shadow_ground_end", x + bw, y + bh, "ground2", soft=True)
    b["floor_rows"] = (fy0, fy1)
    cells = set()
    r0 = y if band == "north" else y + 1
    r1 = y + bh - 1 if band == "south" else y + bh - 2
    for yy in range(r0, r1 + 1):
        for xx in range(x + 1, x + bw - 1):
            cells.add((xx, yy))
    if band:
        for yy in range(band_y, band_y + F):
            for xx in range(x, x + bw):
                cells.add((xx, yy))
    if door == "west":
        cells.add((x, b["door_y"]))
    b["floor_cells"] = cells
    b["door_tile"] = (dx, dy)
    b["front"] = {"bottom": (dx, y + bh), "top": (dx, y - 1), "west": (x - 1, dy), "east": (x + bw, dy)}[door]
    b["inside"] = {"bottom": (dx, band_y - 1 if band else dy - 1), "top": (dx, y + F), "west": (x + 1, dy),
                   "east": (x + bw - 2, dy)}[door]
    w.buildings.append(b)
    return b


def facade(w, b, by, F, door_x):
    x, bw = b["x"], b["w"]
    roof_rows = F - 2
    bays = b.get("bays") or ["window_square"]
    wall, roof = b["wall"], b["roof"]
    wy = by + roof_rows
    for i in range(bw):
        p = "l" if i == 0 else "r" if i == bw - 1 else "m"
        for r in range(roof_rows):
            row = "eave" if r == roof_rows - 1 else "top"
            w.put("ext", "roof_%s_%s_%s" % (roof, row, p), x + i, by + r, "furniture_high")
        X = x + i
        if X == door_x:
            w.put("ext", "wall_%s_%s" % (wall, p), X, wy, "ground2", route=False)
            w.put("ext", b.get("door_item", "door_panel"), X, wy, "furniture_low")
            continue
        w.put("ext", "wall_%s_%s" % (wall, p), X, wy, "walls")
        if 0 < i < bw - 1:
            bay = bays[(i - 1) % len(bays)]
            if bay:
                w.put("ext", bay, X, wy, "furniture_low")
    for c, item in (b.get("awnings") or {}).items():
        w.put("ext", item, x + c, wy, "furniture_high")
    for c, item in (b.get("signs") or {}).items():
        w.put("ext", item, x + c, wy, "furniture_high")
    if door_x is not None and b.get("door_lamp", True) and not b.get("landmark"):
        for side in (-1, 1):
            X = door_x + side
            if x < X < x + bw - 1 and not w.L["furniture_high"][wy][X]:
                w.clear(X, wy, ["furniture_low"])
                w.put("ext", "wall_lamp_day", X, wy, "furniture_low")
                w.put("ext", "wall_lamp_glow", X, wy, "lights")
                break
    lm = b.get("landmark")
    if lm:
        it = ITEMS_EXT[lm]
        lw, lh = it["w"], it["h"]
        lx = b["lm_x"]
        ly = wy + 2 - lh
        for j in range(lh):
            for i in range(lw):
                tid = it["ids"][j][i]
                X, Y = lx + i, ly + j
                if tid < 0:
                    continue
                gid = 1 + tid
                if Y >= by:
                    w.clear(X, Y, ["walls", "furniture_low", "furniture_high", "ground2"])
                if j < lh - 2:
                    w.L["furniture_high"][Y][X] = gid
                elif X == door_x:
                    w.L["ground2"][Y][X] = gid
                else:
                    w.L["walls"][Y][X] = gid


def desk(w, b, x, y, seat, bot=None, face="up"):
    """desk_single at (x, y), chair below, monitor on the left desk tile"""
    w.put("int", "desk_single", x, y)
    w.shadow_of("int", "desk_single", x, y)
    if face == "up":
        w.put("int", "chair_up", x, y + 1)
        w.shadow_of("int", "chair_up", x, y + 1)
        sx, sy = x, y + 1
    else:
        w.put("int", "chair_down", x, y - 1)
        w.shadow_of("int", "chair_down", x, y - 1)
        sx, sy = x, y - 1
    pid = b["id"]
    props = {"project": pid, "seat": seat, "face": face}
    if bot:
        props["bot"] = bot
    w.point_obj("%s-desk-%d" % (pid, seat), sx, sy, **props)
    pc = {"kind": "pc", "house": pid, "seat": seat, "state": "on" if bot else "off",
          "view": "front" if face == "up" else "back"}
    if bot:
        pc["bot"] = bot
    w.point_obj("%s-pc-%d" % (pid, seat), x, y, **pc)
    b.setdefault("desks", []).append((sx, sy))


def wall_decor(w, b, i, name, ts="int"):
    w.put(ts, name, b["x"] + i, b["y"] + 1, "furniture_low")
    if name.startswith("window_") and ts == "int":
        w.put("int", "window_light", b["x"] + i, b["y"] + 3, "lights", soft=True)


def item(w, name, x, y, ts="int"):
    w.put(ts, name, x, y, "furniture_low")
    w.shadow_of(ts, name, x, y)


def rug(w, name, x, y):
    w.put("int", name, x, y, "ground2")


def house_obj(w, b, homes):
    props = {"kind": b.get("kind", "house"), "id": b["id"], "label": b["label"], "door": b["door"],
             "tint": b["tint"]}
    if props["kind"] == "house":
        props["project"] = b["id"]
    if b.get("department"):
        props["department"] = b["department"]
    if b.get("icon"):
        props["icon"] = b["icon"]
    dx, dy = b["door_tile"]
    props["doorX"], props["doorY"] = dx, dy
    w.rect_obj(b["id"], b["x"], b["y"], b["w"], b["h"], **props)
    w.zone(b["label"], "building", b["x"], b["y"], b["w"], b["h"])


# ---------------------------------------------------------------- zones

def zone_roads(w):
    roads = [
        ("Avenida Central", "road", 46, 21, 4, 1),
        ("Avenida Central (sul)", "road", 46, 38, 4, 18),
        ("Rua da Montanha", "road", 31, 10, 34, 2),
        ("Rua Leste-Oeste", "street", 2, 29, 91, 3),
        ("Rua dos Projetos", "road", 2, 47, 80, 3),
        ("Travessa Engenharia", "road", 31, 12, 2, 17),
        ("Travessa Growth", "road", 63, 12, 2, 17),
        ("Beco dos Projetos", "road", 17, 32, 2, 15),
        ("Beco do Jardim", "road", 73, 32, 2, 15),
    ]
    for name, kind, x, y, rw, rh in roads:
        w.paint(x, y, x + rw - 1, y + rh - 1, "D", inset=True)
        w.rect_obj(name, x, y, rw, rh, kind=kind)
        w.zone(name, "road", x, y, rw, rh)


def zone_plaza(w):
    px, py, pw, ph = 40, 22, 17, 16
    w.paint(px, py, px + pw - 1, py + ph - 1, "P")
    w.rect_obj("plaza", px, py, pw, ph, kind="plaza", tint="#ffe3cba6", tint2="#ffd8bd94")
    w.zone("Praça Central", "plaza", px, py, pw, ph)


def plaza_detail(w):
    for y in range(27, 34):
        for x in range(45, 52):
            if abs(x - 48) + abs(y - 30) <= 4:
                set_ground(w, x, y, "ext", "plaza_checker")
    w.put("ext", "fountain", 47, 29, "furniture_low")
    w.put("ext", "fountain_shadow", 47, 31, "ground2")
    w.rect_obj("fountain", 47, 29, 3, 3, kind="fountain")
    w.point_obj("bug-spot", 48, 30, kind="bug-spot")
    w.point_obj("plaza-spawn-avatar", 48, 34, kind="plaza-spawn", role="avatar")
    w.point_obj("plaza-spawn-center", 48, 30, kind="plaza-spawn", role="center", rx=6, ry=4)
    # board (quadro): cork board on a short fence, two standing spots in front
    w.put("int", "corkboard", 42, 27, "furniture_high")
    w.put("ext", "fence_h_l", 42, 28, "furniture_low")
    w.put("ext", "fence_h_r", 43, 28, "furniture_low")
    w.put("ext", "shadow_wide", 42, 28, "ground2")
    w.rect_obj("quadro", 42, 27, 2, 2, kind="board", id="quadro", label="Quadro", door="bottom",
               tint="#fff0d9a8", icon="int:corkboard")
    for s, xx in enumerate((42, 43)):
        w.point_obj("quadro-spot-%d" % s, xx, 29, room="quadro", seat=s, face="up")
    # shop (loja): market stall with an awning
    for i, p in enumerate("lmr"):
        w.put("ext", "awning_red_" + p, 52 + i, 26, "furniture_high")
    w.put("int", "shop_counter", 52, 27, "furniture_low")
    w.put("int", "shop_counter_shadow", 52, 27, "ground2")
    item(w, "barrel", 55, 28, "ext")
    item(w, "crate_stack", 55, 26, "ext")
    w.rect_obj("loja", 52, 26, 3, 3, kind="shop", id="loja", label="Loja", door="bottom", tint="#ffc85050",
               icon="ext:sign_cup")
    for s, xx in enumerate((52, 54)):
        w.point_obj("loja-spot-%d" % s, xx, 29, room="loja", seat=s, face="up")
    for x, y in ((41, 23), (55, 23), (41, 35), (55, 35)):
        lamp(w, x, y)
    for x in (43, 51):
        bench(w, x, 24, "down")
    for x in (42, 45, 50, 53):
        bench(w, x, 33 if x in (42, 53) else 35, "up")
    for x in (44, 51):
        w.put("ext", "flower_box", x, 33, "furniture_low")
        w.put("ext", "shadow_wide", x, 33, "ground2", soft=True)
    for x, y in ((40, 22), (56, 22), (40, 37), (56, 37)):
        w.put("ext", "flower_pot", x, y, "furniture_low")


def zone_mountain(w):
    w.zone("Montanha dos Servidores", "area", 28, 0, 40, 10)
    for y in range(0, 8):
        for x in range(28, 68):
            set_ground(w, x, y, "ext", "rock_ground")
    for x in range(28, 68):
        if 44 <= x <= 51:
            continue
        set_ground(w, x, 7, "ext", "cliff_top")
        set_ground(w, x, 8, "ext", "cliff_face_alt" if h32(x, 3) % 3 == 0 else "cliff_face")
        set_ground(w, x, 9, "ext", "cliff_base")
    for k, x in enumerate((33, 37, 41, 55, 59)):
        w.put("ext", "tower_shadow", x, 5, "ground2")
        w.put("ext", "server_tower_green", x, 3, "furniture_low")
        w.rect_obj("box%d" % (k + 1), x, 3, 2, 3, kind="tower", id="box%d" % (k + 1), label="box%d" % (k + 1))
        w.zone("torre box%d" % (k + 1), "tower", x, 3, 2, 3)
    for k in range(0, 27, 2):
        tree(w, k, (k * 5) % 3 - 1 if k else -1, "pine")
    for k in range(68, 96, 2):
        tree(w, k, (k * 7) % 3 - 1, "pine")
    for x, y in ((26, 2), (66, 2), (26, 5), (66, 5), (28, -1), (64, -1), (30, 2), (62, -1), (31, -1),
                 (44, -2), (50, -2), (35, 0), (58, 0), (39, 1), (53, 4), (63, 5)):
        tree(w, x, y, "pine")


def zone_cabine(w, homes):
    b = building(w, {"id": "servidores", "label": "Cabine dos Servidores", "x": 44, "y": 1, "w": 8, "h": 9,
                     "door": "bottom", "door_x": 48, "band": "south", "wall": "brick", "roof": "slate",
                     "roof_rows": 1, "bays": ["window_square", None, "window_square"], "iwall": "sky",
                     "floor": "floor_checker_bw", "department": "operations", "tint": "#ff6c8ebf",
                     "icon": "ext:sign_gear", "signs": {1: "sign_gear"}})
    for i in (2, 3, 5):
        item(w, "server_rack", 44 + i, 2)
    wall_decor(w, b, 4, "clock")
    wall_decor(w, b, 6, "window_k")
    seat_desks(w, b, homes, [(45, 4), (49, 5)])
    house_obj(w, b, homes)


def zone_prefeitura(w, homes):
    b = building(w, {"id": "prefeitura", "label": "Prefeitura", "x": 42, "y": 12, "w": 13, "h": 9,
                     "door": "bottom", "door_x": 48, "band": "south", "wall": "cream", "roof": "terra",
                     "roof_rows": 1, "bays": ["window_arched", "window_pair"], "landmark": "town_hall", "lm_x": 46,
                     "iwall": "cream", "floor": "floor_checker_warm", "department": "direction",
                     "tint": "#ffd96c4a", "icon": "ext:town_hall"})
    for i in (2, 9):
        wall_decor(w, b, i, "window_r")
    wall_decor(w, b, 6, "clock")
    wall_decor(w, b, 4, "art_landscape")
    wall_decor(w, b, 7, "art_abstract")
    item(w, "bookshelf_0", 43, 14)
    item(w, "bookshelf_2", 53, 14)
    item(w, "plant_ficus", 47, 14)
    item(w, "plant_ficus", 49, 14)
    seat_desks(w, b, homes, [(44, 15), (51, 15)])
    house_obj(w, b, homes)


def zone_sala(w):
    b = building(w, {"id": "sala", "kind": "meeting", "label": "Sala de Reunião", "x": 50, "y": 38, "w": 10,
                     "h": 9, "door": "west", "door_y": 43, "band": None, "iwall": "sky",
                     "floor": lambda i, j: "carpet_green" if 2 <= i <= 6 and 3 <= j <= 7 else "floor_wood_light",
                     "tint": "#ffb88a6a", "icon": "int:meeting_round_8"})
    wall_decor(w, b, 1, "whiteboard")
    wall_decor(w, b, 4, "clock")
    wall_decor(w, b, 6, "window_g")
    wall_decor(w, b, 7, "corkboard")
    w.put("int", "meeting_round_8", 52, 41, "furniture_low")
    w.put("int", "meeting_round_8_shadow", 52, 41, "ground2")
    seats = [(2, 0, "down"), (1, 0, "down"), (3, 0, "down"), (0, 2, "right"), (4, 2, "left"), (1, 4, "up"),
             (2, 4, "up"), (3, 4, "up")]
    for s, (i, j, face) in enumerate(seats):
        w.point_obj("sala-chair-%d" % s, 52 + i, 41 + j, room="sala", seat=s, face=face,
                    **({"role": "moderator"} if s == 0 else {}))
    item(w, "plant_monstera", 58, 44)
    item(w, "plant_ficus", 51, 39)
    item(w, "lamp_floor", 58, 39)
    w.put("int", "glow_floor_lamp", 57, 38, "lights", soft=True)
    house_obj(w, b, {})


def seat_desks(w, b, homes, spots, face="up"):
    bots = sorted([k for k, v in homes.items() if v["house"] == b["id"]], key=lambda k: homes[k]["seat"])
    by_seat = {homes[k]["seat"]: k for k in bots}
    for s, (x, y) in enumerate(spots):
        desk(w, b, x, y, s, by_seat.get(s), face)


# ---------------------------------------------------------------- decoration

def scatter(w):
    for y in range(H):
        for x in range(W):
            g = w.L["ground"][y][x]
            if g and props_of(g) == {} and g - 1 in (0, 1, 2, 3) and not w.L["ground2"][y][x]:
                r = h32(x, y, 99) % 61
                if r == 0:
                    w.put("ext", "flower_patch", x, y, "ground2")
                elif r == 1:
                    w.put("ext", "leaf_litter", x, y, "ground2")


def border_trees(w, full):
    spots = []
    for y in range(12, 46, 4):
        spots.append((0, y, "pine" if y % 8 else "round"))
    for y in range(12, 44, 4):
        spots.append((94, y, "round" if y % 8 else "autumn"))
    for x in range(0, 50, 4):
        spots.append((x, 61, "round" if x % 8 else "pine"))
    for x, y, v in spots:
        if not full and (y >= 44 or x >= 92):
            continue
        tree(w, x, y, v)


def neighbourhood_trees(w, full):
    base = [(36, 14, "round"), (38, 18, "autumn"), (57, 14, "round"), (59, 18, "autumn"), (34, 23, "round"),
            (60, 23, "round"), (36, 26, "pine"), (59, 26, "pine")]
    extra = [(3, 18, "round"), (3, 23, "autumn"), (17, 21, "round"), (13, 13, "pine"), (23, 12, "autumn"),
             (8, 13, "round"), (40, 42, "round"), (43, 40, "autumn"), (2, 38, "pine"), (2, 33, "round"),
             (90, 22, "round"), (79, 21, "pine"), (66, 12, "round"), (79, 13, "autumn"), (88, 13, "round"),
             (39, 51, "round"), (21, 52, "autumn"), (2, 52, "round"), (2, 56, "pine"), (43, 52, "pine"),
             (74, 51, "autumn"), (90, 31, "pine"), (60, 44, "round"), (71, 44, "autumn")]
    for x, y, v in base + (extra if full else []):
        tree(w, x, y, v)
    for x, y in ((38, 23), (58, 24), (44, 18), (52, 20)):
        bush(w, x, y, "berry" if (x + y) % 2 else "plain")


def stub(w, b):
    """short path from the free tile in front of a door to the road"""
    fx, fy = b["front"]
    dx, dy = {"bottom": (0, 1), "top": (0, -1), "west": (-1, 0), "east": (1, 0)}[b["door"]]
    for k in range(3):
        x, y = fx + dx * k, fy + dy * k
        if w.corner[y][x] == "D" or w.corner[y + 1][x + 1] == "D" or w.corner[y][x + 1] == "D" or \
                w.corner[y + 1][x] == "D":
            if k:
                break
        w.paint(x, y, x, y, "D")


# ---------------------------------------------------------------- checks

def walk_check(w, extra_targets=()):
    sx, sy = 48, 34
    seen = {(sx, sy)}
    q = deque([(sx, sy)])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in seen and not w.blocked(*n):
                seen.add(n)
                q.append(n)
    errs = []
    for b in w.buildings:
        for s in b.get("desks", []):
            if s not in seen:
                errs.append("%s seat %s unreachable" % (b["id"], s))
        fx, fy = b["front"]
        if w.blocked(fx, fy):
            errs.append("%s front %s blocked" % (b["id"], b["front"]))
        if b["door_tile"] not in seen:
            errs.append("%s door %s unreachable" % (b["id"], b["door_tile"]))
    for name, (x, y) in extra_targets:
        if (x, y) not in seen:
            errs.append("%s %s unreachable" % (name, (x, y)))
    return errs


# ---------------------------------------------------------------- output

def write(w, path):
    layers = []
    lid = 1
    for n in LAYERS:
        layers.append({"id": lid, "name": n, "type": "tilelayer", "x": 0, "y": 0, "width": W, "height": H,
                       "opacity": 1, "visible": True, "data": "@@%s@@" % n})
        lid += 1
    layers.append({"id": lid, "name": "objects", "type": "objectgroup", "draworder": "topdown", "x": 0, "y": 0,
                   "opacity": 1, "visible": True, "objects": w.objects})
    lid += 1
    zones = []
    for k, (name, kind, x, y, zw, zh) in enumerate(w.zones):
        zones.append({"id": len(w.objects) + k + 1, "name": name, "type": "", "x": x * T, "y": y * T,
                      "width": zw * T, "height": zh * T, "rotation": 0, "visible": True,
                      "properties": [prop("kind", kind)]})
    layers.append({"id": lid, "name": "zones", "type": "objectgroup", "draworder": "topdown", "x": 0, "y": 0,
                   "opacity": 1, "visible": True, "objects": zones})
    m = {"compressionlevel": -1, "type": "map", "version": "1.10", "tiledversion": "1.11.2", "orientation":
         "orthogonal", "renderorder": "right-down", "width": W, "height": H, "tilewidth": T, "tileheight": T,
         "infinite": False, "nextlayerid": lid + 1, "nextobjectid": len(w.objects) + len(zones) + 1,
         "properties": [prop("generator", "scripts/world-v2/gen-map.py")],
         "tilesets": [TS_EXT, TS_INT], "layers": layers}
    s = json.dumps(m, indent=1, ensure_ascii=False)
    for n in LAYERS:
        rows = [",".join(str(v) for v in w.L[n][y]) for y in range(H)]
        s = s.replace('"@@%s@@"' % n, "[\n" + ",\n".join(rows) + "\n]")
    with open(path, "w") as f:
        f.write(s + "\n")


def load_homes(path):
    """team-homes.json is {"homes": {"<slug>": {"house": "<house id>", "seat": <n>}}}; slug = bot id (Íris -> iris)"""
    return {slug: {"house": e["house"], "seat": e["seat"]} for slug, e in json.load(open(path))["homes"].items()}


def build(full):
    homes = load_homes(HOMES)
    w = World()
    zone_roads(w)
    zone_plaza(w)
    zone_cabine(w, homes)
    zone_prefeitura(w, homes)
    zone_sala(w)
    for b in w.buildings:
        stub(w, b)
    terrain(w)
    zone_mountain(w)
    for b in w.buildings:
        fl = b.get("floor", "floor_wood_h")
        for (x, y) in b["floor_cells"]:
            i, j = x - b["x"], y - b["y"]
            w.L["ground"][y][x] = w.gid("int", fl(i, j) if callable(fl) else fl)
    plaza_detail(w)
    neighbourhood_trees(w, full)
    border_trees(w, full)
    scatter(w)
    errs = walk_check(w)
    return w, errs


def main():
    w, errs = build(False)
    for e in errs:
        print("WALK:", e)
    write(w, OUT)
    print("wrote", OUT, os.path.getsize(OUT), "bytes;", len(w.objects), "objects;", len(w.buildings), "buildings")
    if errs:
        sys.exit(1)


if __name__ == "__main__":
    main()
