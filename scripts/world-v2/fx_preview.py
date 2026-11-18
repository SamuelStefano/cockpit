#!/usr/bin/env python3
"""Preview GIFs/PNGs for the F5 effects, composed on the existing 32px tileset (not shipped).

Run: python3 scripts/world-v2/fx_preview.py /path/to/outdir
Writes vila-fx-fountain.gif, vila-fx-weather.gif, vila-fx-confetti.gif, vila-fx-boat.gif,
vila-fx-night.png, vila-fx-night.gif, vila-fx-bug.gif (4x, nearest neighbour).
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from pixkit import T, blank, rgb  # noqa: E402
from fxkit import place, save_gif, lcg, stack_alpha, components, recolour  # noqa: E402
import exterior  # noqa: E402
import demo_city as dc  # noqa: E402
import buildings as bd  # noqa: E402
import fx_fountain as ff  # noqa: E402
import fx_particles as fp  # noqa: E402
import fx_weather as fw  # noqa: E402
import fx_boat as fb  # noqa: E402
import fx_night as fn  # noqa: E402
import fx_bug as fg  # noqa: E402

A = exterior.build()


def tile(name, i=0, j=0, frame=0):
    return dc.tile_of(A, name, i, j, frame)


def item(name, frame=0):
    return dc.item(A, name, frame)


def plaza(w, h, checker=None):
    im = blank(w * T, h * T)
    for y in range(h):
        for x in range(w):
            name = "plaza_pavers"
            if checker and checker[0] <= x < checker[2] and checker[1] <= y < checker[3]:
                name = "plaza_checker"
            im.alpha_composite(tile(name), (x * T, y * T))
    return im


def fountain_patch(fountain_img, night=False):
    im = plaza(5, 5, (1, 1, 4, 4))
    im.alpha_composite(item("fountain_shadow"), (T, 3 * T))
    im.alpha_composite(fountain_img, (T, T))
    return im


# ---------------------------------------------------------------- 1. fountain (day loop x2, night loop x2)
def gif_fountain(out):
    day, night = ff.fountain_rows()
    glow = fn.fountain_underglow()
    frames = []
    for t in range(16):
        frames.append(fountain_patch(day[t % 8]))
    for t in range(16):
        base = fn.night_image(fountain_patch(night[t % 8]))
        base = place(base, glow[(t // 2) % 4], T, T, "add")
        frames.append(base)
    save_gif(frames, os.path.join(out, "vila-fx-fountain.gif"), fps=8)


# ---------------------------------------------------------------- 2. weather
def gif_weather(out):
    W, H = 10, 7
    day, _ = ff.fountain_rows()
    rain = fw.rain_frames()
    rain_far = fw.rain_far_frames()
    splash = fw.splash_frames()
    ripple = fw.ripple_frames()
    puddle = fw.puddle()
    tint = fw.sky_tints()[1]
    rnd = lcg(9)
    spl = [(int(rnd() * (W * T - 32)), int(rnd() * (H * T - 16)), int(rnd() * 8)) for _ in range(14)]
    puddles = [(6 * T + 4, 5 * T + 10), (1 * T + 8, 5 * T + 2), (8 * T, 1 * T + 20)]
    frames = []
    for t in range(24):
        im = plaza(W, H, (2, 1, 5, 4))
        for x in range(W):
            im.alpha_composite(tile("grass_%d" % (x % 3)), (x * T, 6 * T))
        for px, py in puddles:
            im.alpha_composite(puddle, (px, py))
        im.alpha_composite(item("fountain_shadow"), (2 * T, 3 * T))
        im.alpha_composite(day[t % 8], (2 * T, T))
        im.alpha_composite(tile("shadow_pole"), (7 * T, 1 * T))
        im.alpha_composite(item("lamp_day"), (7 * T, 0))
        im.alpha_composite(item("shadow_wide"), (6 * T, 4 * T))
        im.alpha_composite(item("bench_front"), (6 * T, 4 * T))
        for k, (px, py) in enumerate(puddles):
            ph = (t + k * 3) % 8
            if ph < 6:
                im.alpha_composite(ripple[ph], (px, py))
        for (sx, sy, ph) in spl:
            k = (t + ph) % 8
            if k < 4:
                im.alpha_composite(splash[k], (sx, sy))
        im.alpha_composite(Image.new("RGBA", im.size, (0, 0, 0, 0)))
        tint_full = tint.resize(im.size, Image.NEAREST)
        im.alpha_composite(tint_full)
        for y in range(0, H * T, 48):
            for x in range(0, W * T, 48):
                im.alpha_composite(rain_far[t % 4], (x, y))
        for y in range(0, H * T, 64):
            for x in range(0, W * T, 64):
                im.alpha_composite(rain[t % 4], (x, y))
        frames.append(im)
    save_gif(frames, os.path.join(out, "vila-fx-weather.gif"), fps=8)


# ---------------------------------------------------------------- 3. confetti
BOTS = os.path.join(os.path.dirname(os.path.dirname(HERE)), "public", "world", "v2", "bots")


SHIRT_RAMPS = {"luffy": {"g0": "h0", "g1": "r0", "g2": "r1", "g3": "r2"}}   # default_shirt #e04848


def bot(name, row=1, frame=0):
    """one 32x48 frame of a bot sheet (row 1 = idle down), origin (16, 46); the g0..g3 shirt ramp is
    swapped for the bot's signature colour where its -shirt mask is set (nami keeps the green)"""
    box = (frame * 32, row * 48, frame * 32 + 32, row * 48 + 48)
    img = Image.open(os.path.join(BOTS, name + ".png")).convert("RGBA").crop(box)
    if name in SHIRT_RAMPS:
        mask = np.array(Image.open(os.path.join(BOTS, name + "-shirt.png")).convert("L").crop(box)) > 0
        img = recolour(img, SHIRT_RAMPS[name], mask)
    return img


def gif_confetti(out):
    W, H = 8, 7
    burst = fp.burst_frames()
    fall = fp.fall_frames()
    star = fp.star_pop_frames()
    nami = bot("nami")
    fx_, fy = 4 * T, 5 * T            # bot feet
    bx, by = fx_ - 16, fy - 46
    frames = []
    for t in range(40):
        im = plaza(W, H, (2, 1, 6, 6))
        im.alpha_composite(item("shadow_round"), (bx, fy - 26))
        im.alpha_composite(nami, (bx, by))
        if t >= 9:
            im.alpha_composite(fall[(t - 9) % fp.FALL_N], (fx_ - fp.FALL_ANCHOR[0], fy - fp.FALL_ANCHOR[1]))
        if 2 <= t < 12:
            im.alpha_composite(burst[t - 2], (fx_ - fp.BURST_ANCHOR[0], fy - fp.BURST_ANCHOR[1]))
        if 8 <= t < 14:
            im.alpha_composite(star[t - 8], (fx_ - 16, by - 30))
        frames.append(im)
    save_gif(frames, os.path.join(out, "vila-fx-confetti.gif"), fps=8)


# ---------------------------------------------------------------- 4. boat
def harbour(t):
    W, H = 14, 8
    im = blank(W * T, H * T)
    wf = (t // 2) % 4
    for y in range(H):
        for x in range(W):
            if y <= 1:
                im.alpha_composite(tile("sand"), (x * T, y * T))
            elif y == 2:
                im.alpha_composite(tile("auto_sand_water", 3, 0, wf), (x * T, y * T))
            else:
                im.alpha_composite(tile("water", frame=wf), (x * T, y * T))
    for y in range(1, 5):
        for x in (1, 2):
            im.alpha_composite(tile("dock_planks_v"), (x * T, y * T))
    for y in range(2, 5):
        im.alpha_composite(tile("dock_edge_w"), (1 * T, y * T))
        im.alpha_composite(tile("dock_edge_e"), (2 * T, y * T))
    for x in (1, 2):
        im.alpha_composite(tile("dock_edge_s"), (x * T, 5 * T))
    im.alpha_composite(tile("dock_bollard"), (2 * T, 3 * T + 4))
    im.alpha_composite(tile("dock_ladder"), (1 * T, 5 * T))
    im.alpha_composite(item("crate"), (0, 0))
    im.alpha_composite(item("barrel"), (4 * T, 0))
    return im


def gif_boat(out):
    dock = fb.docked_frames()
    dep = fb.depart_frames()
    sail = fb.sail_frames()
    ret = fb.return_frames()
    wl = 4 * T + 12                 # waterline y in the scene
    x0 = 3 * T - 4                  # frame left edge when docked (rope reaches the bollard)
    seq = []
    for t in range(8):
        seq.append(("d", t % 4, x0))
    x = x0
    for t in range(12):
        if t >= 7:
            x += (t - 6) * 2
        seq.append(("p", t, x))
    v = 12
    for t in range(16):
        x += v
        seq.append(("s", t % 6, x))
        if x > 14 * T:
            break
    for t in range(4):
        seq.append(("e", 0, 0))
    xr = 14 * T
    while xr > x0 + 30:
        step = max(2, int((xr - x0 - 29) * 0.16))
        xr -= step
        seq.append(("r", len(seq) % 6, xr))
    for t in range(8):
        seq.append(("d", t % 4, x0))
    frames = []
    for t, (kind, f, bx) in enumerate(seq):
        im = harbour(t)
        if kind == "d":
            img = dock[f]
        elif kind == "p":
            img = dep[f]
        elif kind == "s":
            img = sail[f]
        elif kind == "r":
            img = ret[f]
        else:
            img = None
        if img is not None:
            im.alpha_composite(img, (int(bx), wl - fb.WL)) if bx < im.width else None
        frames.append(im)
    save_gif(frames, os.path.join(out, "vila-fx-boat.gif"), fps=8)


# ---------------------------------------------------------------- 5. night city
GENERIC = [(dc.GA, 4), (dc.GB, 15), (dc.GC, 17)]
LAMPS = [(14, 4), (25, 4), (3, 11), (12, 11), (28, 10)]
WALL_LAMPS = [5, 16]


def blank_items(names):
    for n in names:
        it = A.items[n]
        for g in it.get("frames", [it["ids"]]):
            for row in g:
                for tid in row:
                    if tid >= 0:
                        A.tiles[tid] = blank(T, T)


def emissive_layer():
    """lit glass of every facade: generic bays via the lit bay set, landmarks via their glass pixels"""
    W, H = dc.MW * T, dc.MH * T
    em = blank(W, H)
    boxes = []
    for spec, x in GENERIC:
        day, _, _ = bd.compose(*spec)
        saved = dict(bd.BAYS)
        lit = fn.lit_bays()
        for k in lit:
            bd.BAYS[k] = (lambda im=lit[k]: im.copy())
        night, _, _ = bd.compose(*spec)
        bd.BAYS.clear()
        bd.BAYS.update(saved)
        a, b = np.array(day), np.array(night)
        diff = np.any(a != b, axis=-1)
        b[~diff] = 0
        top = (5 - day.height // T) * T
        em.alpha_composite(Image.fromarray(b, "RGBA"), (x * T, top))
        boxes += glass_boxes(diff, x * T, top)
    for name, x in (("bank", 0), ("town_hall", 6), ("library", 11), ("studio", 19), ("radio", 23),
                    ("security", 26)):
        img = item(name)
        a = np.array(img)
        glass = np.zeros(a.shape[:2], bool)
        for c in ("a0", "a1", "a2", "a3"):
            glass |= np.all(a[..., :3] == rgb(c), axis=-1) & (a[..., 3] == 255)
        keep = np.zeros_like(glass)
        for comp in components(glass):
            ys, xs = comp
            if len(ys) >= 24 and ys.max() - ys.min() >= 8:
                keep[ys, xs] = True
        lit = recolour(img, fn.WARM, keep)
        la = np.array(lit)
        la[~keep] = 0
        top = (5 - img.height // T) * T
        em.alpha_composite(Image.fromarray(la, "RGBA"), (x * T, top))
        boxes += glass_boxes(keep, x * T, top)
    return em, boxes


def glass_boxes(mask, ox, oy):
    out = []
    for ys, xs in components(mask):
        if len(ys) >= 24:
            out.append((ox + xs.min(), oy + ys.min(), ox + xs.max(), oy + ys.max()))
    return out


NAMI_FEET = (12 * T + 30, 13 * T - 4)     # right next to the plaza lamp at (12, 11)
LUFFY_FEET = (7 * T + 16, 17 * T - 6)     # bottom of the plaza, away from every light


def night_frames(n=12):
    blank_items(["lamp_glow", "wall_lamp_glow", "siren_glow"])
    em, boxes = emissive_layer()
    lg = fn.lamp_glows()
    heads = fn.emissive_heads()
    cone = fn.delegacia_cone()
    siren = fn.siren_flash()
    under = fn.fountain_underglow()
    _, fnight = ff.fountain_rows()
    lights, sglow = fn.string_lights()
    p = fn.WIN_PAD
    wins = {}
    for (x0, y0, x1, y1) in boxes:
        w, h = x1 - x0 + 1, y1 - y0 + 1
        wins[(w, h)] = [fn.window_light(w, h, k) for k in (1.0, 0.86)]
    sources = [(x * T + 16, y * T + 12, fn.LAMP_RADII["l"]) for x, y in LAMPS]
    sources += [(x * T, 3 * T + 17, fn.LAMP_RADII["s"]) for x in WALL_LAMPS]
    sources += [((x0 + x1) / 2, (y0 + y1) / 2, 16 + 0.5 * ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5)
                for (x0, y0, x1, y1) in boxes]
    sources.append((6 * T + 48, 11 * T + 54, 40))
    chars = [(bot("nami"), NAMI_FEET), (bot("luffy"), LUFFY_FEET)]
    shadow = item("shadow_round")
    rnd = lcg(3)
    flick = [[rnd() < 0.18 for _ in LAMPS] for _ in range(n)]
    frames = []
    for t in range(n):
        world = dc.scene(A, t, figures=False)
        # the night fountain row replaces the static fountain (6, 11)
        world.alpha_composite(fnight[t % 8], (6 * T, 11 * T))
        for _, (fx_, fy) in chars:   # contact shadows belong to the world layer
            world.alpha_composite(shadow, (fx_ - 16, fy - 26))
        emissive = [(em, 0, 0)]
        emissive += [(heads["lamp_head"], x * T, y * T) for x, y in LAMPS]
        emissive += [(heads["wall_lamp_head"], x * T - 16, 3 * T) for x in WALL_LAMPS]
        emissive += [(lights[(t // 3) % 2], x, 10 * T + 4) for x in range(4 * T, 12 * T, 64)]
        halos = []
        for (x0, y0, x1, y1) in boxes:
            g = wins[(x1 - x0 + 1, y1 - y0 + 1)][1 if (t + x0) % 7 == 0 else 0]
            halos.append((g, x0 - p, y0 - p))
        for i, (x, y) in enumerate(LAMPS):
            halos.append((lg["l"][1 if flick[t][i] else 0], x * T + 16 - 56, y * T + 12 - 56))
        for x in WALL_LAMPS:
            halos.append((lg["s"][0], x * T - 24, 3 * T + 17 - 24))
        halos.append((siren[(t // 2) % 2], 27 * T - 16, 1 * T - 16))
        halos.append((cone, 26 * T + 64 - 32, 5 * T - 51))
        halos.append((under[(t // 2) % 4], 6 * T, 11 * T))
        halos += [(sglow[(t // 3) % 2], x, 10 * T + 4) for x in range(4 * T, 12 * T, 64)]
        characters = [(img, fx_ - 16, fy - 46) for img, (fx_, fy) in chars]
        frames.append(fn.compose_night(world, characters, halos, emissive, sources))
    return frames


def out_night(out):
    frames = night_frames()
    f0 = frames[0]
    f0.resize((f0.width * 2, f0.height * 2), Image.NEAREST).save(os.path.join(out, "vila-fx-night.png"))
    save_gif(frames[:8], os.path.join(out, "vila-fx-night.gif"), fps=6, scale=4)


# ---------------------------------------------------------------- 6. Bug in the fountain
def gif_bug(out):
    day, _ = ff.fountain_rows()
    r = fg.all_rows()
    from pixkit import m_ellipse
    pool = m_ellipse(96, 96, 48, 53, 38, 21)
    seq = []
    # swim left across the front of the pool, blink, swim back right
    for k in range(10):
        seq.append(("swim_left", k % 6, 64 - k * 2.4, 66))
    for k in (0, 1, 2, 1, 0):
        seq.append(("blink", k, 40, 66))
    for k in range(10):
        seq.append(("swim_right", k % 6, 40 + k * 2.6, 66))
    for k in range(8):
        seq.append(("jump", k, 29, 64))
    for k in range(4):
        seq.append(("splash", k, 29 + 11 - 24, 64))
    seq.append(("none", 0, 0, 0))
    seq.append(("none", 0, 0, 0))
    for k in range(4):
        seq.append(("wink", k, 52, 64))
    seq.append(("wink", 3, 52, 64))
    seq.append(("none", 0, 0, 0))
    frames = []
    for t, (kind, f, x, y) in enumerate(seq):
        fountain = day[t % 8].copy()
        if kind in ("swim_left", "swim_right", "blink"):
            img = r[kind][f]
            layer = blank(96, 96)
            layer.alpha_composite(img, (int(x) - 15, int(y) - 12))
            a = np.array(layer)
            a[~pool] = 0
            # under the surface: a translucent water film over the lower half of Bug
            layer = Image.fromarray(a, "RGBA")
            fountain.alpha_composite(layer)
            wet = np.zeros((96, 96))
            wet[(np.array(layer)[..., 3] > 0) & (np.mgrid[0:96, 0:96][0] > int(y) - 1)] = 110
            fountain.alpha_composite(stack_alpha([(wet, "a2")]))
        elif kind == "jump":
            fountain.alpha_composite(r["jump"][f], (int(x), int(y) - 46))
        elif kind == "splash":
            fountain.alpha_composite(r["splash"][f], (int(x), int(y) - 24))
        elif kind == "wink":
            fountain.alpha_composite(r["wink"][f], (int(x) - 15, int(y) - 26))
        frames.append(fountain_patch(fountain))
    save_gif(frames, os.path.join(out, "vila-fx-bug.gif"), fps=8)


def main(out):
    os.makedirs(out, exist_ok=True)
    gif_fountain(out)
    gif_weather(out)
    gif_confetti(out)
    gif_boat(out)
    gif_bug(out)
    out_night(out)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp")
