#!/usr/bin/env python3
"""Run dust: a 6-frame one-shot puff (16x16) kicked up at the feet of a running character.

Writes public/world/v2/fx/dust.png + dust.json. Three lobes burst low and wide, rise, drift apart
and break into specks. Opaque palette pixels only (cream ramp t4/t3/t2, light from the top-left);
the fade is a checker erosion like the smoke sheets, not alpha. Deterministic.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pixkit import C, grid, m_ellipse, shift, rgb  # noqa: E402
from fxkit import Sheet, audit_fx, audit_overlay  # noqa: E402

OUT = os.path.join(HERE, "..", "..", "public", "world", "v2", "fx")
W = H = 16
N = 6
FPS = 14
ANCHOR = (8, 14)

# per frame: lobes (cx, cy, rx, ry) and the erosion level
FRAMES = [
    dict(lobes=[(6.0, 13.0, 1.5, 1.2), (9.0, 13.0, 1.5, 1.2)], specks=[(11, 11), (4, 11)], erode=0),
    dict(lobes=[(5.0, 12.0, 2.0, 2.0), (8.0, 11.0, 2.4, 2.4), (11.0, 12.2, 1.9, 1.9)],
         specks=[(13, 9), (2, 10)], erode=0),
    dict(lobes=[(4.0, 10.5, 2.4, 2.4), (8.0, 9.0, 2.9, 2.9), (11.8, 10.6, 2.3, 2.3)],
         specks=[(14, 7), (1, 8), (8, 13)], erode=0),
    dict(lobes=[(3.4, 9.0, 2.3, 2.3), (8.0, 7.0, 2.8, 2.8), (12.6, 9.0, 2.2, 2.2)],
         specks=[(15, 6), (6, 12)], erode=1),
    dict(lobes=[(3.0, 7.6, 1.9, 1.9), (8.0, 5.2, 2.4, 2.4), (13.0, 7.6, 1.8, 1.8)], specks=[], erode=2),
    dict(lobes=[(2.6, 6.4, 1.2, 1.2), (8.0, 3.6, 1.6, 1.6), (13.4, 6.2, 1.1, 1.1)], specks=[], erode=3),
]


def erode(m, level):
    if level <= 0:
        return m
    X, Y = grid(W, H)
    xi, yi = X.astype(int), Y.astype(int)
    if level == 1:
        inner = shift(m, 1, 0) & shift(m, -1, 0) & shift(m, 0, 1) & shift(m, 0, -1)
        return m & ~(inner & ((xi + yi) % 2 == 0))
    if level == 2:
        return m & ((xi + yi) % 2 == 0)
    return m & ((xi + yi) % 2 == 0) & ((yi % 2) == 0)


def dust_frame(f):
    spec = FRAMES[f]
    m = np.zeros((H, W), bool)
    for cx, cy, rx, ry in spec["lobes"]:
        m |= m_ellipse(W, H, cx, cy, rx, ry)
    up, left = shift(m, 0, 1), shift(m, 1, 0)
    down, right = shift(m, 0, -1), shift(m, -1, 0)
    lit = m & ~(up & left)
    dark = m & ~(down & right) & ~lit
    keep = erode(m, spec["erode"])
    a = np.zeros((H, W, 4), np.uint8)
    a[m] = C("t3")
    a[lit] = C("t4")
    a[dark] = C("t2")
    if spec["erode"] >= 2:
        a[m & ~lit] = C("t3")
    a[~keep] = 0
    for x, y in spec["specks"]:
        a[y, x] = C("t4")
    return Image.fromarray(a, "RGBA")


def dust_frames():
    return [dust_frame(f) for f in range(N)]


def preview(frames, path, scale=8):
    grounds = ("q2", "w2", "t1")
    im = Image.new("RGBA", (W * N, H * len(grounds)))
    for r, g in enumerate(grounds):
        for i, f in enumerate(frames):
            cell = Image.new("RGBA", (W, H), rgb(g) + (255,))
            cell.alpha_composite(f)
            im.paste(cell, (i * W, r * H))
    im.resize((im.width * scale, im.height * scale), Image.NEAREST).save(path)


def main():
    frames = dust_frames()
    S = Sheet("dust.png")
    S.add("dust_run", frames, FPS, ANCHOR, loop=False, layer="ground",
          note="one-shot puff at the feet of a running character; anchor = ground point behind the heel")
    img, anims = S.build()
    op, tr = audit_fx(img)
    assert op == 0 and tr == 0 and audit_overlay(img) == 0, (op, tr)
    os.makedirs(OUT, exist_ok=True)
    img.save(os.path.join(OUT, "dust.png"), optimize=True)
    with open(os.path.join(OUT, "dust.json"), "w") as fh:
        json.dump({"version": 1, "animations": anims}, fh, indent=1)
        fh.write("\n")
    preview(frames, "/tmp/vila-dust-strip.png")
    print("dust.png", img.size, "frames", N, "off-palette", op, tr)


if __name__ == "__main__":
    main()
