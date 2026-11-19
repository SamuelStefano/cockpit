#!/usr/bin/env python3
"""Game-feel preview GIF on public/world/v2/world.tmj: one avatar walks from the plaza along Rua
Leste-Oeste, Shift-runs Estrada do Bosque and the lake trail, and stops on the lake pier. The motion
maths are a port of src/routes/equipe/world/world-run.ts and the camera follow of world-scene.ts.

Run: python3 scripts/world-v2/run-gif.py --out FILE [--frames N] [--start N] [--smoke] [--bot ID] [--max-bytes N]
"""
import argparse
import importlib.util
import io
import json
import math
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.join(os.path.dirname(os.path.dirname(HERE)), "public", "world", "v2")

_spec = importlib.util.spec_from_file_location("render_map", os.path.join(HERE, "render-map.py"))
render_map = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(render_map)

# world-run.ts
RUN_MULT = 1.6
WALK_FRAME_MS = 130
RUN_FRAME_MS = 80
DUST_INTERVAL_MS = 120
DUST_POOL = 8
LOOKAHEAD_MAX = 48
LOOKAHEAD_EASE_MS = 260
# world-scene.ts: AVATAR_SPEED is 72 px/s on 16 px tiles, i.e. 4.5 tiles/s
AVATAR_TILES_PER_S = 72 / 16
FOLLOW_LERP = 0.12
BLOCKING_LAYERS = ("ground", "walls", "furniture_low")
OVERLAY_LAYERS = ("furniture_high", "lights")

VIEW_W, VIEW_H = 560, 400
SIM_HZ = 60
SIM_PER_FRAME = 5
FRAME_MS = (80, 80, 90)
MAX_BYTES = 3_000_000
# (colours, keep K of every N frames); fewer colours barely shrinks a scrolling GIF, dropping frames does
FIT_STEPS = ((64, 1, 1), (32, 1, 1), (32, 2, 3), (32, 1, 2))
HOLD_START_MS = 400
HOLD_END_MS = 900

# (tile x, tile y, run on the leg that ends here); tile units, .5 = tile centre
PATH = [
    (54.5, 32.0, False),
    (56.0, 30.5, False),
    (93.0, 30.5, False),
    (103.0, 30.5, True),
    (103.0, 12.0, True),
    (112.0, 12.0, True),
    (112.0, 19.4, True),
]


def blocked_tiles(m):
    gids = set()
    for ts in m["tilesets"]:
        for t in ts.get("tiles", []):
            if render_map.props(t).get("block") is True:
                gids.add(ts["firstgid"] + t["id"])
    out = set()
    for l in m["layers"]:
        if l["type"] == "tilelayer" and l["name"] in BLOCKING_LAYERS:
            out.update(i for i, g in enumerate(l["data"]) if (g & 0x1FFFFFFF) in gids)
    return out


def check_path(m, pts):
    T, W, H = m["tilewidth"], m["width"], m["height"]
    blocked = blocked_tiles(m)
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        n = int(math.hypot(bx - ax, by - ay)) + 1
        for i in range(n + 1):
            x, y = ax + (bx - ax) * i / n, ay + (by - ay) * i / n
            for ox in (-5, 0, 5):
                tx, ty = int((x + ox) // T), int(y // T)
                if not (0 <= tx < W and 0 <= ty < H) or ty * W + tx in blocked:
                    raise SystemExit("path crosses blocked tile (%d,%d)" % (tx, ty))


def split_map(m):
    order = render_map.ORDER
    render_map.ORDER = [n for n in order if n not in OVERLAY_LAYERS]
    try:
        base = render_map.render(m)
    finally:
        render_map.ORDER = order
    T, W = m["tilewidth"], m["width"]
    tiles = render_map.tiles_of(m)
    over = Image.new("RGBA", base.size, (0, 0, 0, 0))
    for l in m["layers"]:
        if l["name"] in OVERLAY_LAYERS:
            for k, g in enumerate(l["data"]):
                if g:
                    over.alpha_composite(tiles[g & 0x1FFFFFFF], ((k % W) * T, (k // W) * T))
    return base, over


def dust_tick(acc, dt, active):
    if not active or dt <= 0:
        return 0, (acc if active else 0)
    total = acc + dt
    count = int(total // DUST_INTERVAL_MS)
    return min(count, DUST_POOL), total - count * DUST_INTERVAL_MS


def lookahead(prev, dx, dy, dt, mx=LOOKAHEAD_MAX):
    ln = math.hypot(dx, dy)
    tx = dx / ln * mx if ln > 0 else 0
    ty = dy / ln * mx if ln > 0 else 0
    k = 1 - math.exp(-max(0, dt) / LOOKAHEAD_EASE_MS)
    x = prev[0] + (tx - prev[0]) * k
    y = prev[1] + (ty - prev[1]) * k
    mag = math.hypot(x, y)
    if mag > mx:
        x, y = x / mag * mx, y / mag * mx
    if ln == 0 and math.hypot(x, y) < 0.05:
        return (0.0, 0.0)
    return (x, y)


def js_round(v):
    return math.floor(v + 0.5)


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def simulate(m):
    T = m["tilewidth"]
    map_w, map_h = m["width"] * T, m["height"] * T
    pts = [(x * T, y * T) for x, y, _ in PATH]
    check_path(m, pts)
    base_speed = AVATAR_TILES_PER_S * T
    dt = 1000 / SIM_HZ
    x, y = pts[0]
    leg = 1
    face = "down"
    look = (0.0, 0.0)
    acc = 0.0
    puffs = [None] * DUST_POOL
    nxt = 0
    sx = clamp(x - VIEW_W / 2, 0, map_w - VIEW_W)
    sy = clamp(y - VIEW_H / 2, 0, map_h - VIEW_H)
    now = 0.0
    end_at = None
    step_i = 0
    frames = []
    while True:
        moving = now >= HOLD_START_MS and leg < len(pts)
        running = False
        dx = dy = 0.0
        if moving:
            running = PATH[leg][2]
            tx, ty = pts[leg]
            dist = math.hypot(tx - x, ty - y)
            dx, dy = (tx - x) / dist, (ty - y) / dist
            step = base_speed * (RUN_MULT if running else 1) * dt / 1000
            if step >= dist:
                x, y = tx, ty
                leg += 1
            else:
                x, y = x + dx * step, y + dy * step
            face = ("right" if dx > 0 else "left") if abs(dx) >= abs(dy) else ("down" if dy > 0 else "up")
        elif leg >= len(pts):
            face = "down"
            if end_at is None:
                end_at = now + HOLD_END_MS
        count, acc = dust_tick(acc, dt, running and moving)
        for _ in range(count):
            nxt = (nxt + 1) % DUST_POOL
            puffs[nxt] = (js_round(x - dx * 4), js_round(y - dy * 3), nxt % 2 == 0, now)
        look = lookahead(look, dx, dy, dt)
        fx, fy = x + js_round(look[0]), y + js_round(look[1])
        sx = clamp(sx + (fx - VIEW_W / 2 - sx) * FOLLOW_LERP, 0, map_w - VIEW_W)
        sy = clamp(sy + (fy - VIEW_H / 2 - sy) * FOLLOW_LERP, 0, map_h - VIEW_H)
        if step_i % SIM_PER_FRAME == 0:
            frames.append({
                "x": x, "y": y, "face": face, "moving": moving, "running": running, "now": now,
                "cam": (js_round(sx), js_round(sy)), "puffs": [p for p in puffs if p],
            })
        step_i += 1
        now += dt
        if end_at is not None and now >= end_at:
            return frames


class Sprites:
    def __init__(self, bot):
        meta = json.load(open(os.path.join(V2, "bots.json")))
        if bot not in meta["bots"]:
            raise SystemExit("unknown bot %s (have: %s)" % (bot, ", ".join(sorted(meta["bots"]))))
        self.fw, self.fh = meta["frame"]["w"], meta["frame"]["h"]
        self.anims = meta["animations"]
        self.gait = "run" if "run" in self.anims else "walk"
        self.sheet = Image.open(os.path.join(V2, meta["bots"][bot]["sheet"])).convert("RGBA")
        d = json.load(open(os.path.join(V2, "fx", "dust.json")))["animations"]["dust_run"]
        self.dust = d
        sheet = Image.open(os.path.join(V2, "fx", d["sheet"])).convert("RGBA")
        cells = [sheet.crop((d["x"] + i * d["frame_w"], d["y"], d["x"] + (i + 1) * d["frame_w"], d["y"] + d["frame_h"]))
                 for i in range(d["frames"])]
        self.dust_cells = (cells, [c.transpose(Image.FLIP_LEFT_RIGHT) for c in cells])

    def bot(self, f):
        if f["moving"]:
            a = self.anims[self.gait if f["running"] else "walk"]
            i = int(f["now"] // (RUN_FRAME_MS if f["running"] else WALK_FRAME_MS)) % a["frames"]
        else:
            a = self.anims["idle"]
            i = int(f["now"] * a["fps"] // 1000) % a["frames"]
        row = a["rows"][f["face"]]
        return self.sheet.crop((i * self.fw, row * self.fh, (i + 1) * self.fw, (row + 1) * self.fh))

    def puff(self, p, now):
        i = int((now - p[3]) * self.dust["fps"] // 1000)
        return self.dust_cells[1 if p[2] else 0][i] if 0 <= i < self.dust["frames"] else None


def paste(dst, src, x, y):
    box = (max(0, -x), max(0, -y), min(src.width, dst.width - x), min(src.height, dst.height - y))
    if box[2] > box[0] and box[3] > box[1]:
        dst.alpha_composite(src.crop(box), (x + box[0], y + box[1]))


def stamp(im, now_ms):
    """t=mm:ss of game time, 2x pixel digits on a dark plate, top-left"""
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from pixkit import PALETTE, glyph_pixels
    ink, plate, edge = (tuple(int(PALETTE[k][i:i + 2], 16) for i in (1, 3, 5)) for k in ("t4", "ol0", "t1"))
    secs = int(now_ms // 1000)
    cells = ["T", "=", "%d" % (secs // 600 % 10), "%d" % (secs // 60 % 10), ":", "%d" % (secs % 60 // 10), "%d" % (secs % 10)]
    sc, x0, y0 = 2, 8, 8
    w = len(cells) * 4 * sc + 8
    h = 5 * sc + 8
    px = im.load()
    for y in range(h):
        for x in range(w):
            px[x0 + x, y0 + y] = edge if x in (0, w - 1) or y in (0, h - 1) else plate

    def dot(gx, gy, i):
        for dy in range(sc):
            for dx in range(sc):
                px[x0 + 4 + i * 4 * sc + gx * sc + dx, y0 + 4 + gy * sc + dy] = ink
    for i, ch in enumerate(cells):
        if ch == "=":
            pts = [(gx, gy) for gy in (1, 3) for gx in range(3)]
        elif ch == ":":
            pts = [(1, 1), (1, 3)]
        else:
            pts = glyph_pixels(ch)
        for gx, gy in pts:
            dot(gx, gy, i)


def draw(f, base, over, spr):
    cx, cy = f["cam"]
    box = (cx, cy, cx + VIEW_W, cy + VIEW_H)
    im = base.crop(box)
    items = [(100 + f["y"], spr.bot(f), js_round(f["x"]) - spr.fw // 2, js_round(f["y"]) - spr.fh)]
    ax, ay = spr.dust["anchor"]
    for p in f["puffs"]:
        cell = spr.puff(p, f["now"])
        if cell is not None:
            items.append((99 + p[1], cell, p[0] - (spr.dust["frame_w"] - ax if p[2] else ax), p[1] - ay))
    for _, cell, px, py in sorted(items, key=lambda it: it[0]):
        paste(im, cell, px - cx, py - cy)
    im.alpha_composite(over.crop(box))
    im = im.convert("RGB")
    stamp(im, f["now"])
    return im


def encode(frames, colors, keep=1, of=1):
    ms = [FRAME_MS[i % len(FRAME_MS)] for i in range(len(frames))]
    kept = [i for i in range(len(frames)) if i % of < keep]
    durations = [sum(ms[a:b]) for a, b in zip(kept, kept[1:] + [len(frames)])]
    frames = [frames[i] for i in kept]
    step = max(1, len(frames) // 24)
    sample = np.concatenate([np.asarray(f) for f in frames[::step]], axis=0)
    pal = Image.fromarray(sample).quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
    buf = io.BytesIO()
    q[0].save(buf, format="GIF", save_all=True, append_images=q[1:], loop=0, disposal=1, optimize=False,
              duration=durations)
    return buf.getvalue()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--frames", type=int, default=0)
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--smoke", action="store_true")
    ap.add_argument("--bot", default="deck")
    ap.add_argument("--max-bytes", type=int, default=MAX_BYTES)
    a = ap.parse_args()
    m = json.load(open(os.path.join(V2, "world.tmj")))
    sim = simulate(m)
    total = len(sim)
    sim = sim[a.start:a.start + a.frames] if a.frames else sim[a.start:]
    base, over = split_map(m)
    spr = Sprites(a.bot)
    frames = [draw(f, base, over, spr) for f in sim]
    for colors, keep, of in (FIT_STEPS[:1] if a.smoke else FIT_STEPS):
        data = encode(frames, colors, keep, of)
        if not a.max_bytes or len(data) <= a.max_bytes:
            break
    with open(a.out, "wb") as fh:
        fh.write(data)
    print("%s: %d/%d frames, %.1f s full run, %d colours, %.0f fps, %d bytes%s" % (
        a.out, len(frames), total, total * sum(FRAME_MS) / len(FRAME_MS) / 1000, colors, 12 * keep / of, len(data),
        " (OVER %d)" % a.max_bytes if a.max_bytes and len(data) > a.max_bytes else ""))


if __name__ == "__main__":
    main()
