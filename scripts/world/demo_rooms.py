#!/usr/bin/env python3
"""Composes three 14x10-tile mock rooms from tiles-interior + pc.png and writes them at 2x:
<outdir>/vila-room-house.png, vila-room-meeting.png, vila-room-shop.png

Run: python3 scripts/world/demo_rooms.py /path/to/outdir
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from pixkit import T, C, blank, audit  # noqa: E402
import interior  # noqa: E402
import furniture as fu  # noqa: E402

RW, RH = 14, 10
VOID = (42, 29, 46, 255)


class Room:
    def __init__(self, A, pcs, pcmeta, wall, floor):
        self.A, self.pcs, self.pcmeta = A, pcs, pcmeta
        self.im = Image.new("RGBA", (RW * T, RH * T), VOID)
        self.shadows = blank(RW * T, RH * T)
        self.walldecor = []
        self.objs = []
        self.top = []
        for y in range(3, RH - 1):
            for x in range(1, RW - 1):
                f = floor(x, y) if callable(floor) else floor
                self.im.alpha_composite(A.item_image(f), (x * T, y * T))
        for x in range(1, RW - 1):
            p = "l" if x == 1 else ("r" if x == RW - 2 else "m")
            self.im.alpha_composite(A.item_image("wall_%s_%s" % (wall, p)), (x * T, T))
            self.shadows.alpha_composite(A.item_image("shadow_wall_corner" if x == 1 else "shadow_wall_base"),
                                         (x * T, 3 * T))
        for y in range(4, RH - 1):
            self.shadows.alpha_composite(A.item_image("shadow_wall_left"), (T, y * T))
        self.caps = blank(RW * T, RH * T)
        for x in range(1, RW - 1):
            self.caps.alpha_composite(A.item_image("cap_top"), (x * T, 0))
            self.caps.alpha_composite(A.item_image("cap_bottom"), (x * T, (RH - 1) * T))
        for y in range(1, RH - 1):
            self.caps.alpha_composite(A.item_image("cap_left"), (0, y * T))
            self.caps.alpha_composite(A.item_image("cap_right"), ((RW - 1) * T, y * T))
        for k, (x, y) in (("nw", (0, 0)), ("ne", (RW - 1, 0)), ("sw", (0, RH - 1)), ("se", (RW - 1, RH - 1))):
            self.caps.alpha_composite(A.item_image("cap_" + k), (x * T, y * T))

    def floor_item(self, name, x, y):
        self.im.alpha_composite(self.A.item_image(name), (x * T, y * T))

    def wall(self, name, x, y, px=0, py=0):
        self.walldecor.append((self.A.item_image(name), x * T + px, y * T + py))

    def put(self, name, x, y, px=0, py=0, shadow=True, sort=None):
        img = self.A.item_image(name)
        X, Y = x * T + px, y * T + py
        self.objs.append((sort if sort is not None else Y + img.height, X, Y, img))
        if shadow and name + "_shadow" in self.A.items:
            self.shadows.alpha_composite(self.A.item_image(name + "_shadow"), (X, Y))

    def pc(self, frame, x_px, desk_top_y, glow=None):
        f = self.pcmeta["frames"][frame]
        img = self.pcs.crop((f["x"], f["y"], f["x"] + T, f["y"] + T))
        Y = desk_top_y + 4 - 30
        self.objs.append((desk_top_y + 18, x_px, Y, img))
        if glow:
            g = self.pcmeta["frames"][glow]
            self.top.append((self.pcs.crop((g["x"], g["y"], g["x"] + T, g["y"] + T)), x_px, Y - 2))

    def light(self, name, x, y, px=0, py=0):
        self.top.append((self.A.item_image(name), x * T + px, y * T + py))

    def render(self):
        im = self.im
        im.alpha_composite(self.shadows)
        for img, x, y in self.walldecor:
            im.alpha_composite(img, (x, y))
        for _, x, y, img in sorted(self.objs, key=lambda o: (o[0], o[1])):
            im.alpha_composite(img, (x, y))
        im.alpha_composite(self.caps)
        for img, x, y in self.top:
            im.alpha_composite(img, (x, y))
        return im


def house(A, pcs, meta):
    r = Room(A, pcs, meta, "cream", lambda x, y: "floor_wood_h")
    for x in (4, 7):
        r.wall("window_r", x, 1)
        r.light("window_light", x, 3)
    r.wall("clock", 6, 1, py=2)
    r.wall("art_landscape", 9, 1, py=2)
    r.wall("wall_cabinet", 11, 2, py=-8)
    r.wall("hood", 10, 2, py=-6)
    r.put("bookshelf_0", 1, 2)
    r.put("bookshelf_1", 2, 2)
    r.put("counter_sink", 11, 3)
    r.put("counter_stove", 10, 3)
    r.put("counter", 9, 3)
    r.put("fridge", 12, 2)
    # double desk, bots sit south facing up -> screens face the viewer
    r.floor_item("carpet_blue", 2, 5)
    for x in range(2, 6):
        for y in (5, 6, 7):
            r.floor_item("carpet_blue", x, y)
    r.put("desk_double", 2, 6, py=-12)
    r.pc("front_on_a", 2 * T + 16, 6 * T - 12 + 5, glow="glow_on")
    r.pc("front_alert", 4 * T + 16, 6 * T - 12 + 5, glow="glow_alert")
    r.put("chair_up", 2, 7, px=16, py=-10)
    r.put("chair_up", 4, 7, px=16, py=-10)
    # L desk, bot sits north facing down -> back of the monitor
    r.put("desk_l", 8, 5, py=-4)
    r.put("chair_down", 8, 4, px=16, py=-8)
    r.pc("back_on_a", 8 * T + 16, 5 * T - 4 + 5)
    r.objs.append((5 * T + 14, 9 * T + 14, 5 * T - 4 - 12, A.item_image("lamp_desk")))
    r.light("glow_desk_lamp", 9, 4, px=0, py=-16)
    r.put("sofa", 1, 7, py=4)
    r.put("plant_monstera", 12, 6)
    r.put("lamp_floor", 11, 6, py=4)
    r.light("glow_floor_lamp", 10, 5, py=4)
    r.put("plant_succulent", 7, 7, py=8)
    return r.render()


def meeting(A, pcs, meta):
    r = Room(A, pcs, meta, "sky", lambda x, y: "carpet_green" if 3 <= x <= 10 else "floor_wood_light")
    r.wall("whiteboard", 2, 1, py=6)
    r.wall("clock", 5, 1, py=2)
    for x in (6, 8):
        r.wall("window_g", x, 1)
        r.light("window_light", x, 3)
    r.wall("corkboard", 10, 1, py=6)
    r.wall("plant_hanging", 12, 1, py=4)
    r.put("meeting_round_8", 4, 3, py=4)
    r.put("plant_ficus", 1, 2, py=8)
    r.put("plant_monstera", 12, 7)
    r.put("lamp_floor", 2, 7)
    r.light("glow_floor_lamp", 1, 6)
    r.put("server_rack", 12, 2, py=6)
    return r.render()


def shop(A, pcs, meta):
    r = Room(A, pcs, meta, "mint", lambda x, y: "floor_checker_warm")
    r.wall("window_k", 5, 1)
    r.light("window_light", 5, 3)
    r.wall("door_frame", 7, 1)
    r.wall("window_k", 9, 1)
    r.light("window_light", 9, 3)
    r.wall("clock", 6, 1, py=-2)
    r.put("shop_shelf_a", 1, 2, py=4)
    r.put("shop_shelf_b", 3, 2, py=4)
    r.put("shop_shelf_a", 11, 2, py=4)
    r.put("shop_shelf_b", 1, 6, py=0)
    r.floor_item("rug_rect", 6, 6)
    r.put("shop_counter", 9, 5, py=0)
    r.put("plant_monstera", 12, 7)
    r.put("plant_succulent", 5, 4, py=0)
    r.put("chair_left", 12, 5, py=4)
    r.put("easel", 4, 6, py=4)
    return r.render()


def main(outdir):
    A = interior.build()
    pcs, meta = interior.build_pc()
    for name, fn in (("house", house), ("meeting", meeting), ("shop", shop)):
        im = fn(A, pcs, meta)
        im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(outdir, "vila-room-%s.png" % name))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp")
