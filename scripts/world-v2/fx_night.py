"""Night mode: additive light sprites, lit (warm) window bays, emissive lamp heads and the night LUT.

Night transform (also used to build the LUT): an affine colour map, so recolouring a blended pixel
gives the same result as blending recoloured pixels (shadows and alpha edges stay consistent):

    lum = 0.30 R + 0.59 G + 0.11 B
    c'  = 0.65 c + 0.35 lum                 (about a third desaturated)
    out = c' * (0.30, 0.36, 0.56) + (12, 14, 34)

Lower value, blue shifted, whites land on a soft lavender-blue, darks on a deep navy instead of black.
"""
import math

import numpy as np
from PIL import Image

from pixkit import PALETTE, C, rgb, blank, put, grid, m_poly, Part, draw_parts
from fxkit import stack_alpha, recolour, dither_levels, dither_pick, place
import buildings as bd
import props as pr

EXTRA = {"c0": "#7d62b8", "c1": "#c3b1ec"}   # the bots' lilac pair (gen-bots palette)
MUL = (0.30, 0.36, 0.56)
ADD = (12, 14, 34)
DESAT = 0.35


def night_rgb(c):
    c = np.asarray(c, np.float64)
    lum = c[..., 0] * 0.30 + c[..., 1] * 0.59 + c[..., 2] * 0.11
    d = c * (1 - DESAT) + lum[..., None] * DESAT
    return np.clip(np.round(d * np.array(MUL) + np.array(ADD)), 0, 255).astype(np.uint8)


def night_image(img):
    a = np.array(img.convert("RGBA"))
    a[..., :3] = night_rgb(a[..., :3])
    return Image.fromarray(a, "RGBA")


def lut():
    names = list(PALETTE) + list(EXTRA)
    hexes = [PALETTE.get(n) or EXTRA[n] for n in names]
    im = Image.new("RGBA", (256, 1), (0, 0, 0, 0))
    mapping = {}
    for i, h in enumerate(hexes):
        c = (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))
        n = tuple(int(v) for v in night_rgb(c))
        im.putpixel((i, 0), n + (255,))
        mapping[h] = "#%02x%02x%02x" % n
    return im, names, mapping


# ---------------------------------------------------------------- additive lights
# Warm halos: falloff field -> ordered Bayer dither between a few alpha steps (no hard rings). Colours
# are overlay colours only: `warm` y0 (amber) on the outside, `glow` y2 (pale yellow) dithered in
# towards the core. No white.
HALO_LEVELS = (0, 0.25, 0.5, 0.75, 1.0)   # 4 alpha steps, scaled by the peak


def falloff(d, power=1.4):
    """d = normalised distance (0 centre, 1 edge) -> 0..1, eased so the edge is long and soft"""
    return np.clip(1 - d, 0, 1) ** power


def warm_halo(f, peak, core=(0.55, 0.85)):
    """f: 0..1 light field -> RGBA image (y0 rim, y2 core), dithered alpha and dithered colour edge"""
    a = dither_levels(f, [peak * k for k in HALO_LEVELS])
    hot = dither_pick(f, *core) & (a > 0)
    return stack_alpha([(np.where(hot, 0, a), "y0"), (np.where(hot, a, 0), "y2")])


def radial(w, h, cx, cy, rx, ry):
    X, Y = grid(w, h)
    return np.sqrt(((X + 0.5 - cx) / rx) ** 2 + ((Y + 0.5 - cy) / ry) ** 2)


def dithered_radial(w, h, cx, cy, rx, ry, peak, steps=4):
    """single-colour soft spot (for the coloured lights: siren, bulbs, cone pool)"""
    return dither_levels(falloff(radial(w, h, cx, cy, rx, ry)), [peak * k / steps for k in range(steps + 1)])


LAMP_RADII = {"s": 24, "m": 40, "l": 56}


def lamp_glows():
    """3 radii (24, 40, 56 px), 2 frames each (steady, slightly dimmer) for a lamp flicker"""
    out = {}
    for name, r in LAMP_RADII.items():
        frames = []
        for k in (1.0, 0.88):
            f = falloff(radial(2 * r, 2 * r, r, r, r, r), 1.1) * k
            frames.append(warm_halo(f, 160, core=(0.88, 1.15)))
        out[name] = frames
    return out


WIN_SIZES = {"s": (8, 12), "m": (14, 22), "l": (24, 28)}
WIN_PAD = 6


def window_light(w, h, k=1.0):
    """warm light over a w x h pane plus a WIN_PAD px dithered halo; frame = (w + 2 pad) x (h + 2 pad)"""
    W, H = w + 2 * WIN_PAD, h + 2 * WIN_PAD
    X, Y = grid(W, H)
    dx = np.maximum(0, np.maximum(WIN_PAD - (X + 0.5), (X + 0.5) - (W - WIN_PAD)))
    dy = np.maximum(0, np.maximum(WIN_PAD - (Y + 0.5), (Y + 0.5) - (H - WIN_PAD)))
    d = np.sqrt(dx ** 2 + dy ** 2) / WIN_PAD
    f = falloff(d, 1.2) * 0.8
    inside = (dx == 0) & (dy == 0)
    f[inside] = 0.8 + 0.2 * (Y[inside] < WIN_PAD + 2)   # glass sheen along the top of the pane
    return warm_halo(f * k, 128, core=(0.85, 1.05))


def window_lights():
    """2 frames: on and a slight flicker"""
    return {name: [window_light(w, h, k) for k in (1.0, 0.86)] for name, (w, h) in WIN_SIZES.items()}


def delegacia_cone(W=64, H=80):
    """cool light shaft falling from the Delegacia (security) door lamp onto the street"""
    X, Y = grid(W, H)
    m = m_poly(W, H, [(26, 0), (38, 0), (60, 66), (4, 66)])
    a = np.zeros((H, W))
    for k, y0 in enumerate((0, 16, 32, 48)):
        a[m & (Y >= y0)] = [64, 50, 38, 28][k]
    # pool on the ground at the bottom of the cone
    pool = dithered_radial(W, H, 32, 68, 30, 9, 60, steps=3)
    a = np.maximum(a, pool)
    # a soft inner beam
    inner = m_poly(W, H, [(29, 0), (35, 0), (44, 66), (20, 66)])
    a[inner] += 14
    return stack_alpha([(a, "a3")])


def siren_flash():
    """96x64 additive flash, placed so its centre sits on the siren (the 64x32 siren tile + (-16, -16))"""
    out = []
    for col, cx in (("r1", 40), ("a2", 56)):
        a = dithered_radial(96, 64, cx, 36, 34, 22, 110)
        beam = dithered_radial(96, 64, cx, 36, 48, 7, 70, steps=3)
        out.append(stack_alpha([(np.maximum(a, beam), col)]))
    return out


def fountain_underglow():
    out = []
    d = radial(96, 96, 48, 54, 47, 30)
    for k in (1.0, 0.92, 1.0, 1.08):
        out.append(warm_halo(falloff(d, 1.1) * 0.9 * k, 120, core=(0.75, 1.0)))
    return out


BULBS = ["y1", "r2", "g3", "a3", "k1"]


def string_lights():
    """64x16 segment: catenary wire with 8 bulbs; two frames, alternate bulbs dim (twinkle)"""
    W, H = 64, 16
    frames, glows = [], []
    for f in range(2):
        im = blank(W, H)
        pts = []
        for x in range(W):
            y = 3 + 6 * math.sin(math.pi * x / (W - 1))
            pts.append((x, int(round(y))))
            put(im, x, int(round(y)), C("ol1"))
        glow = np.zeros((H, W))
        gcol = np.zeros((H, W), int)
        for b in range(8):
            x = 4 + b * 8
            y = pts[x][1] + 1
            col = BULBS[b % 5]
            on = (b + f) % 2 == 0
            put(im, x, y, C("m1"))           # socket
            put(im, x, y + 1, C(col if on else "m2"))
            put(im, x + 1, y + 1, C(col if on else "m1"))
            put(im, x, y + 2, C(col if on else "m1"))
            put(im, x + 1, y + 2, C(col if on else "m0"))
            if on:
                put(im, x, y + 1, C("wh"))
                ga = dithered_radial(W, H, x + 1, y + 2, 5, 5, 90, steps=3)
                gcol[ga > glow] = b % 5
                glow = np.maximum(glow, ga)
        frames.append(im)
        glows.append(stack_alpha([(np.where(gcol == k, glow, 0), c) for k, c in enumerate(BULBS)]))
    return frames, glows


# ---------------------------------------------------------------- lit windows (normal blend, in palette)
WARM = {"a0": "y0", "a1": "y1", "a2": "y1", "a3": "y2"}
LIT_BAYS = ["window_arched", "window_square", "window_shop", "window_pair", "door_glass", "door_panel",
            "door_arched"]


def lit_bays():
    return {name: recolour(bd.BAYS[name](), WARM) for name in LIT_BAYS}


def emissive_heads():
    """the lit pixels of lamp_night (32x64) and wall_lamp_night (32x32): draw them after the LUT pass"""
    out = {}
    for name, im in (("lamp_head", pr.lamp(True)), ("wall_lamp_head", bd.wall_lamp(True))):
        a = np.array(im)
        keep = np.zeros(a.shape[:2], bool)
        for c in ("y0", "y1", "y2"):
            keep |= np.all(a[..., :3] == rgb(c), axis=-1)
        a[~keep] = 0
        out[name] = Image.fromarray(a, "RGBA")
    return out


# ---------------------------------------------------------------- characters at night (lit-sprite rule)
# Characters never go through the night LUT (it turns them into navy silhouettes). They get a mild
# multiply tint instead, and the tint fades back to their original colours inside a light radius.
CHAR_SHADE = (0.82, 0.85, 0.96)   # ~15-18% darker, a faint blue cast
CHAR_LIT_INNER = 0.6              # full colour inside 60% of a light's radius, fading out to its edge


def char_light(px, py, sources):
    """0..1 light factor for a character whose body centre is (px, py); sources = [(x, y, radius)]"""
    best = 0.0
    for x, y, r in sources:
        d = math.hypot(px - x, py - y) / r
        best = max(best, min(1.0, max(0.0, (1 - d) / (1 - CHAR_LIT_INNER))))
    return best


def char_tint(light):
    """multiply tint for a character sprite (what Phaser setTint would get), light = char_light()"""
    return tuple(s + (1 - s) * light for s in CHAR_SHADE)


def shade_character(img, light):
    a = np.array(img.convert("RGBA")).astype(np.float64)
    a[..., :3] *= np.array(char_tint(light))
    return Image.fromarray(np.clip(np.round(a), 0, 255).astype(np.uint8), "RGBA")


def compose_night(world, characters=(), lights=(), emissive=(), sources=()):
    """the 3-step night draw order on separate layers:
    1. world (ground, props, buildings - no characters) recoloured by the night transform / LUT,
       then the emissive sprites (lit windows, lamp heads) unrecoloured;
    2. characters = [(img, x, y)] (top-left), each with its own mild shade, lit back to full colour
       near a light source (sources = [(x, y, radius)]);
    3. lights = [(img, x, y)] additive halos on top of everything.
    """
    im = night_image(world)
    for img, x, y in emissive:
        im.alpha_composite(img, (int(x), int(y)))
    for img, x, y in characters:
        lf = char_light(x + img.width / 2, y + img.height / 2, sources)
        im.alpha_composite(shade_character(img, lf), (int(x), int(y)))
    for img, x, y in lights:
        im = place(im, img, x, y, "add")
    return im
