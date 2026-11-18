#!/usr/bin/env python3
"""Renders public/world/v2/world.tmj from the tmj itself (embedded tilesets, layer order, PC objects,
dock sign) so the preview proves the map file. Frame 0 of every animated tile, day light.

Run: python3 scripts/world-v2/render-map.py OUTDIR [--fx DIR_WITH_porto-sign.png] [--no-lights]
Writes OUTDIR/vila-mapa-v2.png (1x), vila-mapa-v2-half.png, vila-mapa-v2-praca.png,
vila-mapa-v2-casas.png, vila-mapa-v2-sul.png and vila-mapa-v2-fachadas.png (2x crops).
"""
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.join(os.path.dirname(os.path.dirname(HERE)), "public", "world", "v2")
ORDER = ["ground", "ground2", "walls", "furniture_low", "@objects", "furniture_high", "lights"]
CROPS = {"praca": (36, 0, 26, 48), "casas": (0, 12, 42, 36), "sul": (0, 44, 96, 20)}
# the four project houses and the Corte Radar tower, side by side
FACADES = [(6, 15, 25, 28), (61, 31, 10, 16)]


def tiles_of(m):
    out = {}
    for ts in m["tilesets"]:
        sheet = Image.open(os.path.join(V2, ts["image"])).convert("RGBA")
        tw, th, cols = ts["tilewidth"], ts["tileheight"], ts["columns"]
        for i in range(ts["tilecount"]):
            out[ts["firstgid"] + i] = sheet.crop(((i % cols) * tw, (i // cols) * th, (i % cols + 1) * tw,
                                                 (i // cols + 1) * th))
    return out


def props(o):
    return {p["name"]: p["value"] for p in o.get("properties", [])}


def render(m, fx_dir=None, lights=True):
    T = m["tilewidth"]
    W, H = m["width"], m["height"]
    tiles = tiles_of(m)
    im = Image.new("RGBA", (W * T, H * T), (20, 24, 20, 255))
    layers = {l["name"]: l for l in m["layers"]}
    pcs = Image.open(os.path.join(V2, "pc.png")).convert("RGBA")
    pcmeta = json.load(open(os.path.join(V2, "pc.json")))
    sign = None
    for d in filter(None, [os.path.join(V2, "fx"), fx_dir]):
        p = os.path.join(d, "porto-sign.png")
        if os.path.exists(p):
            sign = Image.open(p).convert("RGBA")
            break
    for name in ORDER:
        if name == "@objects":
            for o in layers["objects"]["objects"]:
                p = props(o)
                if p.get("kind") == "pc":
                    st = "front_on_a" if p.get("state") == "on" else "front_off"
                    if p.get("view") == "back":
                        st = st.replace("front", "back")
                    f = pcmeta["frames"][st]
                    tx, ty = int(o["x"]) // T, int(o["y"]) // T
                    im.alpha_composite(pcs.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"])),
                                       (tx * T, ty * T - 21))
                elif p.get("kind") == "dock-sign" and sign is not None:
                    im.alpha_composite(sign, (int(o["x"]), int(o["y"])))
            continue
        if name == "lights" and not lights:
            continue
        data = layers[name]["data"]
        for k, g in enumerate(data):
            if g:
                im.alpha_composite(tiles[g & 0x1FFFFFFF], ((k % W) * T, (k // W) * T))
    return im


def main():
    out = sys.argv[1]
    fx = sys.argv[sys.argv.index("--fx") + 1] if "--fx" in sys.argv else None
    m = json.load(open(os.path.join(V2, "world.tmj")))
    im = render(m, fx, "--no-lights" not in sys.argv)
    T = m["tilewidth"]
    im.save(os.path.join(out, "vila-mapa-v2.png"), optimize=True)
    im.resize((im.width // 2, im.height // 2), Image.LANCZOS).save(os.path.join(out, "vila-mapa-v2-half.png"))
    for name, (x, y, w, h) in CROPS.items():
        c = im.crop((x * T, y * T, (x + w) * T, (y + h) * T))
        c.resize((c.width * 2, c.height * 2), Image.NEAREST).save(os.path.join(out, "vila-mapa-v2-%s.png" % name))
    parts = [im.crop((x * T, y * T, (x + w) * T, (y + h) * T)) for x, y, w, h in FACADES]
    sheet = Image.new("RGBA", (sum(p.width for p in parts) + T, max(p.height for p in parts)), (20, 24, 20, 255))
    ox = 0
    for p in parts:
        sheet.alpha_composite(p, (ox, 0))
        ox += p.width + T
    sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(os.path.join(out, "vila-mapa-v2-fachadas.png"))
    print("rendered", im.size)


if __name__ == "__main__":
    main()
