"""Shared helpers for the F5 effect sheets (public/world/v2/fx/).

An fx sheet is a stack of rows; every row is one animation (frames left to right, same size).
`Sheet.add` records the rectangle, fps, anchor, blend mode and loop flag so fx.json can describe it.
Opaque pixels must be palette colours; translucent pixels must use a palette RGB too (an overlay
colour with alpha), so the audit below is stricter than "any alpha".
"""
import math

import numpy as np
from PIL import Image

from pixkit import PALETTE, rgb, blank

PAL_RGB = np.array([rgb(n) for n in PALETTE], np.int32)


class Sheet:
    def __init__(self, name, pad=0):
        self.name, self.pad = name, pad
        self.rows = []  # (anim name, frames, meta)

    def add(self, anim, frames, fps, anchor, blend="normal", loop=True, note=None, **extra):
        if isinstance(frames, Image.Image):
            frames = [frames]
        w, h = frames[0].size
        for f in frames:
            assert f.size == (w, h), (anim, f.size, (w, h))
        meta = {"frame_w": w, "frame_h": h, "frames": len(frames), "fps": fps, "anchor": list(anchor),
                "blend": blend, "loop": loop}
        if note:
            meta["note"] = note
        meta.update(extra)
        self.rows.append((anim, frames, meta))
        return meta

    def build(self):
        W = max(m["frame_w"] * m["frames"] for _, _, m in self.rows)
        H = sum(m["frame_h"] for _, _, m in self.rows)
        im = blank(W, H)
        y = 0
        out = {}
        for anim, frames, meta in self.rows:
            for i, f in enumerate(frames):
                im.alpha_composite(f, (i * meta["frame_w"], y))
            out[anim] = dict(sheet=self.name, x=0, y=y, **meta)
            y += meta["frame_h"]
        return im, out


def audit_fx(img):
    """returns (opaque off-palette px, translucent px whose RGB is not a palette colour)"""
    a = np.array(img.convert("RGBA")).astype(np.int32)
    vis = a[..., 3] > 0
    px = a[vis][:, :3]
    ok = np.zeros(len(px), bool)
    for c in PAL_RGB:
        ok |= np.all(px == c, axis=1)
    op = a[vis][:, 3] == 255
    return int((~ok & op).sum()), int((~ok & ~op).sum())


def baked_shadow_px(img):
    """translucent dark (ol0) pixels touching opaque ones = a shadow baked into a sprite"""
    a = np.array(img)
    tr = (a[..., 3] > 0) & (a[..., 3] < 255) & np.all(a[..., :3] == rgb("ol0"), axis=-1)
    op = a[..., 3] == 255
    nb = np.zeros_like(op)
    nb[1:] |= op[:-1]
    nb[:-1] |= op[1:]
    nb[:, 1:] |= op[:, :-1]
    nb[:, :-1] |= op[:, 1:]
    return int((tr & nb).sum())


def alpha_img(alpha, colour):
    h, w = alpha.shape
    arr = np.zeros((h, w, 4), np.uint8)
    arr[..., :3] = rgb(colour)
    arr[..., 3] = np.clip(np.round(alpha), 0, 255).astype(np.uint8)
    arr[arr[..., 3] == 0] = 0
    return Image.fromarray(arr, "RGBA")


def stack_alpha(layers):
    """merge [(alpha array, colour)] into one image; later layers win where they are set"""
    h, w = layers[0][0].shape
    arr = np.zeros((h, w, 4), np.uint8)
    for al, col in layers:
        m = al > 0
        arr[m, :3] = rgb(col)
        arr[m, 3] = np.clip(np.round(al[m]), 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def recolour(img, mapping, mask=None):
    """swap palette colours by name (opaque and translucent pixels alike)"""
    a = np.array(img).copy()
    src = a.copy()
    for s, d in mapping.items():
        m = np.all(src[..., :3] == rgb(s), axis=-1) & (src[..., 3] > 0)
        if mask is not None:
            m &= mask
        a[m, :3] = rgb(d)
    return Image.fromarray(a, "RGBA")


def flip(img):
    return img.transpose(Image.FLIP_LEFT_RIGHT)


def lcg(seed):
    """tiny deterministic generator (independent from numpy/random versions)"""
    state = [seed & 0x7FFFFFFF or 1]

    def nxt():
        state[0] = (state[0] * 1103515245 + 12345) & 0x7FFFFFFF
        return state[0] / 0x7FFFFFFF
    return nxt


# ---------------------------------------------------------------- compositing for previews
def add_blend(base, over, x=0, y=0):
    """additive blend (what Phaser's ADD does): dst.rgb += src.rgb * src.a"""
    b = np.array(base).astype(np.float32)
    o = np.array(over).astype(np.float32)
    h, w = o.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(b.shape[1], x + w), min(b.shape[0], y + h)
    if x1 <= x0 or y1 <= y0:
        return base
    oc = o[y0 - y:y1 - y, x0 - x:x1 - x]
    k = oc[..., 3:4] / 255.0
    b[y0:y1, x0:x1, :3] = np.minimum(255, b[y0:y1, x0:x1, :3] + oc[..., :3] * k)
    return Image.fromarray(b.astype(np.uint8), base.mode)


def place(base, img, x, y, blend="normal"):
    if blend == "add":
        return add_blend(base, img, int(x), int(y))
    base.alpha_composite(img, (int(x), int(y)))
    return base


def save_gif(frames, path, fps=8, scale=4):
    big = [f.convert("RGB").resize((f.width * scale, f.height * scale), Image.NEAREST) for f in frames]
    # one shared palette from every frame keeps colours stable between frames
    sample = Image.new("RGB", (frames[0].width, frames[0].height * len(frames)))
    for i, f in enumerate(frames):
        sample.paste(f.convert("RGB"), (0, i * frames[0].height))
    pal = sample.quantize(colors=255, method=Image.MEDIANCUT, dither=Image.Dither.NONE)
    q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in big]
    q[0].save(path, save_all=True, append_images=q[1:], duration=int(round(1000 / fps)), loop=0,
              optimize=False, disposal=1)


def ease(u):
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, u)))
