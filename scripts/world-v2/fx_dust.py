#!/usr/bin/env python3
"""Run dust: a 6-frame one-shot puff (16x16) kicked up at the feet of a running character.

Writes public/world/v2/fx/dust.png + dust.json. Three lobes burst low and wide, rise, drift apart
and break into specks. Opaque Paleta Vila 48 pixels only (pele-5 / terra-4 / pele-3, light from the top-left);
the fade is a checker erosion like the smoke sheets, not alpha. Deterministic.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pixkit import grid, m_ellipse, shift  # noqa: E402
from fxkit import Sheet  # noqa: E402

OUT = os.path.join(HERE, "..", "..", "public", "world", "v2", "fx")
W = H = 16
N = 6
FPS = 14
ANCHOR = (8, 14)

# Paleta Vila 48 (lina/vila/ui-kit/paleta-48.json), ramps dark -> light
VILA48 = {
    "verde": ("#1F280F", "#35511A", "#477A2D", "#62A353", "#75CC71", "#92F49C"),
    "folha": ("#28230F", "#514D1A", "#747A2D", "#91A353", "#AACC71", "#C2F492"),
    "terra": ("#280F0F", "#51221A", "#7A432D", "#A37653", "#CCA671", "#F4DA92"),
    "telha": ("#280F17", "#511A24", "#7A2D30", "#A35C53", "#F97316", "#F4BA92"),
    "pele": ("#4C2226", "#6F3B38", "#915F53", "#B48871", "#D7B494", "#F5E6C8"),
    "agua": ("#0F2825", "#1A5051", "#2D6E7A", "#538AA3", "#71A2CC", "#92BAF4"),
    "lilas": ("#0F1028", "#1F1A51", "#3F2D7A", "#7253A3", "#A271CC", "#D592F4"),
    "pedra": ("#1E1A2B", "#424A50", "#656D78", "#898FA0", "#AFB3C7", "#D8D7EF"),
}


def vila(ramp, i):
    h = VILA48[ramp][i]
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)


# pele-5 rim reads on grass and dirt; terra-4 body and pele-3 underside keep the puff visible on sand
LIT, BASE, DARK = vila("pele", 5), vila("terra", 4), vila("pele", 3)
# real ground tiles the puff must read on (tiles-exterior.json item names)
PREVIEW_GROUNDS = ("grass_0", "dirt", "sand")

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
    a[m] = BASE
    a[lit] = LIT
    a[dark] = DARK
    if spec["erode"] >= 2:
        a[m & ~lit] = BASE
    a[~keep] = 0
    for x, y in spec["specks"]:
        a[y, x] = LIT
    return Image.fromarray(a, "RGBA")


def dust_frames():
    return [dust_frame(f) for f in range(N)]


def audit_vila48(img):
    """returns (opaque px outside Paleta Vila 48, translucent px); both must be 0"""
    a = np.array(img.convert("RGBA")).astype(np.int32)
    pal = {int(h[1:3], 16) << 16 | int(h[3:5], 16) << 8 | int(h[5:7], 16) for r in VILA48.values() for h in r}
    key = a[..., 0] << 16 | a[..., 1] << 8 | a[..., 2]
    opaque = a[..., 3] == 255
    off = opaque & ~np.isin(key, list(pal))
    return int(off.sum()), int(((a[..., 3] > 0) & ~opaque).sum())


def ground_tile(name):
    v2 = os.path.join(OUT, "..")
    meta = json.load(open(os.path.join(v2, "tiles-exterior.json")))
    tid, tw, th, cols = meta["items"][name]["ids"][0][0], meta["tilewidth"], meta["tileheight"], meta["columns"]
    sheet = Image.open(os.path.join(v2, "tiles-exterior.png")).convert("RGBA")
    x, y = (tid % cols) * tw, (tid // cols) * th
    return sheet.crop((x, y, x + tw, y + th))


def preview(frames, path, scale=8):
    """one row per ground the dust may spawn on, puff standing on the real tile"""
    im = Image.new("RGBA", (W * N, H * len(PREVIEW_GROUNDS)))
    for r, g in enumerate(PREVIEW_GROUNDS):
        tile = ground_tile(g)
        for i, f in enumerate(frames):
            cell = tile.crop((0, tile.height - H, W, tile.height))
            cell.alpha_composite(f)
            im.paste(cell, (i * W, r * H))
    im.resize((im.width * scale, im.height * scale), Image.NEAREST).save(path)


def main():
    frames = dust_frames()
    S = Sheet("dust.png")
    S.add("dust_run", frames, FPS, ANCHOR, loop=False, layer="ground",
          note="one-shot puff at the feet of a running character; anchor = ground point behind the heel")
    img, anims = S.build()
    op, tr = audit_vila48(img)
    assert op == 0 and tr == 0, (op, tr)
    os.makedirs(OUT, exist_ok=True)
    img.save(os.path.join(OUT, "dust.png"), optimize=True)
    with open(os.path.join(OUT, "dust.json"), "w") as fh:
        json.dump({"version": 1, "animations": anims}, fh, indent=1)
        fh.write("\n")
    preview(frames, "/tmp/vila-dust-strip2.png")
    print("dust.png", img.size, "frames", N, "off-palette", op, tr)


if __name__ == "__main__":
    main()
