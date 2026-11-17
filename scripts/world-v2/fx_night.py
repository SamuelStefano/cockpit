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
from fxkit import stack_alpha, recolour
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
def stepped_radial(w, h, cx, cy, rx, ry, peak, steps=5):
    X, Y = grid(w, h)
    d = np.sqrt(((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2)
    a = np.zeros((h, w))
    for k in range(steps):
        a[d <= 1.0 - k / steps] = peak * (k + 1) / steps
    return a


def lamp_glows():
    """3 radii (24, 40, 56 px), 2 frames each (steady, slightly dimmer) for a lamp flicker"""
    out = {}
    for name, r in (("s", 24), ("m", 40), ("l", 56)):
        frames = []
        for k in (1.0, 0.86):
            outer = stepped_radial(2 * r, 2 * r, r, r, r, r, 88 * k)
            core = stepped_radial(2 * r, 2 * r, r, r, r * 0.4, r * 0.4, 64 * k, steps=2)
            frames.append(stack_alpha([(outer, "y1"), (core, "y2")]))
        out[name] = frames
    return out


WIN_SIZES = {"s": (8, 12), "m": (14, 22), "l": (24, 28)}


def window_lights():
    """warm light square + 2 soft steps of halo; 2 frames: on and a slight flicker"""
    out = {}
    for name, (w, h) in WIN_SIZES.items():
        W, H = w + 8, h + 8
        frames = []
        for k in (1.0, 0.84):
            core = np.zeros((H, W))
            halo = np.zeros((H, W))
            halo[0:H, 0:W] = 0
            halo[2:H - 2, 2:W - 2] = 26 * k
            halo[3:H - 3, 3:W - 3] = 52 * k
            core[4:H - 4, 4:W - 4] = 120 * k
            # top-left corner of the pane a touch brighter, like the tileset's glass sheen
            core[4:6, 4:W - 4] = 150 * k
            frames.append(stack_alpha([(halo, "y2"), (core, "y1")]))
        out[name] = frames
    return out


def delegacia_cone(W=64, H=80):
    """cool light shaft falling from the Delegacia (security) door lamp onto the street"""
    X, Y = grid(W, H)
    m = m_poly(W, H, [(26, 0), (38, 0), (60, 66), (4, 66)])
    a = np.zeros((H, W))
    for k, y0 in enumerate((0, 16, 32, 48)):
        a[m & (Y >= y0)] = [64, 50, 38, 28][k]
    # pool on the ground at the bottom of the cone
    pool = stepped_radial(W, H, 32, 68, 30, 9, 60, steps=3)
    a = np.maximum(a, pool)
    # a soft inner beam
    inner = m_poly(W, H, [(29, 0), (35, 0), (44, 66), (20, 66)])
    a[inner] += 14
    return stack_alpha([(a, "a3")])


def siren_flash():
    """96x64 additive flash, placed so its centre sits on the siren (the 64x32 siren tile + (-16, -16))"""
    out = []
    for col, cx in (("r1", 40), ("a2", 56)):
        a = stepped_radial(96, 64, cx, 36, 34, 22, 110)
        beam = stepped_radial(96, 64, cx, 36, 48, 7, 70, steps=3)
        out.append(stack_alpha([(np.maximum(a, beam), col)]))
    return out


def fountain_underglow():
    out = []
    for k in (1.0, 0.9, 1.0, 1.1):
        a = stepped_radial(96, 96, 48, 54, 40, 23, 70 * k)
        a = np.maximum(a, stepped_radial(96, 96, 48, 54, 47, 30, 30 * k, steps=2))
        out.append(stack_alpha([(a, "a3")]))
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
                ga = stepped_radial(W, H, x + 1, y + 2, 5, 5, 90, steps=3)
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
