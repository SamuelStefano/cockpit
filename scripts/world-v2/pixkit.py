"""Shared pixel-art kit for the v2 32px world tilesets.

Palette, mask helpers, the layered part renderer (selective outline + top-left light),
soft alpha overlays, a 2D tile atlas packer and the Tiled .tsx writer.
Everything is drawn procedurally; nothing is copied from any game.
"""
import json
import math
import random
from xml.sax.saxutils import escape

import numpy as np
from PIL import Image, ImageDraw, ImageFont

T = 32

# ---------------------------------------------------------------- palette (48, same as the approved F1 example)
PALETTE = {
    "ol0": "#2a1d2e", "ol1": "#4a3045",
    "s0": "#a0565a", "s1": "#ee9a80", "s2": "#ffc9a0", "s3": "#ffe6cc",
    "h0": "#4a1f2a", "h1": "#7d3324", "h2": "#b8562e", "h3": "#e88a4a",
    "g0": "#156a4e", "g1": "#23a067", "g2": "#3fd17f", "g3": "#a8f0b8",
    "p0": "#262e5a", "p1": "#3d4a85", "p2": "#5a6cb0",
    "w0": "#52321f", "w1": "#7f4f2c", "w2": "#b0743f", "w3": "#d9a066",
    "t0": "#76604f", "t1": "#a3836a", "t2": "#c9a982", "t3": "#e3cba6", "t4": "#f6e7cf",
    "q0": "#1f4a35", "q1": "#2f6e35", "q2": "#4c9a3c", "q3": "#72c048", "q4": "#a6dd5a", "q5": "#e0f58a",
    "a0": "#2b4a8a", "a1": "#3a78c8", "a2": "#5fb4e8", "a3": "#a8e4f5",
    "y0": "#f0a830", "y1": "#ffd166", "y2": "#fff4b0",
    "r0": "#a02b3a", "r1": "#e04848", "r2": "#ff8a7a",
    "wh": "#ffffff",
    "m0": "#2e3048", "m1": "#474b6b", "m2": "#6b7192",
    "k0": "#c46aa8", "k1": "#f6a5d0",
}
assert len(PALETTE) <= 48 and len(set(PALETTE.values())) == len(PALETTE)

# overlay colours: every translucent pixel must use one of these RGB values
OVERLAY_COLOURS = {"shadow": "ol0", "glow": "y2", "light": "wh", "screen": "a3", "alert": "r1", "warm": "y0"}


def rgb(name):
    h = PALETTE[name]
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))


def C(name, a=255):
    return rgb(name) + (a,)


SHADOW = rgb("ol0")

# ramps: [outline, shadow, base, light, (highlight)]
R = {
    "leaf": ["q0", "q1", "q2", "q3", "q4"],
    "autumn": ["h0", "h1", "h2", "h3", "y1"],
    "pine": ["q0", "q0", "q1", "q2", "q3"],
    "trunk": ["w0", "w1", "w2", "w3"],
    "stone": ["t0", "t1", "t2", "t3", "t4"],
    "rock": ["m0", "m1", "m2", "t2", "t3"],
    "metal": ["m0", "m0", "m1", "m2"],
    "steel": ["m0", "m1", "m2", "t3"],
    "wood": ["w0", "w1", "w2", "w3"],
    "dark_wood": ["ol0", "w0", "w1", "w2"],
    "red": ["r0", "r0", "r1", "r2"],
    "blue": ["p0", "a0", "a1", "a2"],
    "navy": ["ol0", "p0", "p1", "p2"],
    "green": ["g0", "g0", "g1", "g2"],
    "mint": ["g0", "g1", "g2", "g3"],
    "yellow": ["w1", "y0", "y1", "y2"],
    "pink": ["r0", "k0", "k1", "s3"],
    "cream": ["t1", "t2", "t3", "t4"],
    "water": ["a0", "a1", "a2", "a3"],
    "white": ["t1", "t3", "t4", "wh"],
    "black": ["ol0", "ol0", "m0", "m1"],
    "skin": ["s0", "s1", "s2", "s3"],
    "orange": ["h1", "h2", "h3", "y1"],
}


# ---------------------------------------------------------------- masks
def grid(w, h):
    ys, xs = np.mgrid[0:h, 0:w]
    return xs + 0.5, ys + 0.5


def m_ellipse(w, h, cx, cy, rx, ry):
    X, Y = grid(w, h)
    return ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 <= 1.0


def m_rect(w, h, x0, y0, x1, y1):
    """inclusive pixel rect"""
    m = np.zeros((h, w), bool)
    x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
    m[max(0, y0):max(0, y1 + 1), max(0, x0):max(0, x1 + 1)] = True
    return m


def m_rrect(w, h, x0, y0, x1, y1, r):
    m = m_rect(w, h, x0, y0, x1, y1)
    x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
    if r >= 1:
        for (cx, cy, sx, sy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
            for k in range(r):
                for j in range(r - k):
                    yy, xx = cy + sy * k, cx + sx * j
                    if 0 <= yy < h and 0 <= xx < w:
                        m[yy, xx] = False
    return m


def m_capsule(w, h, p0, p1, r):
    X, Y = grid(w, h)
    (ax, ay), (bx, by) = p0, p1
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = np.zeros_like(X) if L2 == 0 else np.clip(((X - ax) * dx + (Y - ay) * dy) / L2, 0, 1)
    px, py = ax + t * dx, ay + t * dy
    return (X - px) ** 2 + (Y - py) ** 2 <= r * r


def m_poly(w, h, pts):
    im = Image.new("L", (w, h), 0)
    ImageDraw.Draw(im).polygon(pts, fill=255)
    return np.array(im) > 0


def shift(m, dx, dy, fill=False):
    """returns M[y+dy, x+dx] (value of the neighbour at offset)"""
    h, w = m.shape
    out = np.full_like(m, fill)
    ys0, ys1 = max(0, -dy), min(h, h - dy)
    xs0, xs1 = max(0, -dx), min(w, w - dx)
    if ys1 > ys0 and xs1 > xs0:
        out[ys0:ys1, xs0:xs1] = m[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx]
    return out


def wshift(m, dx, dy):
    """wrapping neighbour (tileable textures)"""
    return np.roll(np.roll(m, -dy, axis=0), -dx, axis=1)


def put(img, x, y, col):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((int(x), int(y)), col if len(col) == 4 else col + (255,))


def hline(img, x0, x1, y, name):
    for x in range(x0, x1 + 1):
        put(img, x, y, C(name))


def vline(img, x, y0, y1, name):
    for y in range(y0, y1 + 1):
        put(img, x, y, C(name))


def rect(img, x0, y0, x1, y1, name):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(img, x, y, C(name))


def blank(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def fill(w, h, name):
    return Image.new("RGBA", (w, h), C(name))


# ---------------------------------------------------------------- part renderer
class Part:
    def __init__(self, name, mask, ramp, z, outline=True, band=1, light=True, inner=True, out_idx=0,
                 light_band=1, outline_name=None):
        self.name, self.mask, self.ramp, self.z = name, mask, ramp, z
        self.outline, self.band, self.light = outline, band, light
        self.inner, self.out_idx, self.light_band = inner, out_idx, light_band
        self.outline_name = outline_name


def render_parts(parts, w, h):
    """Selective outline (darkest shade of the part's own ramp) + top-left light + bottom-right shade band."""
    order = sorted([p for p in parts if p.mask.any()], key=lambda p: p.z)
    lab = np.full((h, w), -1, int)
    for i, p in enumerate(order):
        lab[p.mask] = i
    img = np.zeros((h, w, 4), np.uint8)
    empty = lab == -1
    dirs = ((1, 0), (-1, 0), (0, 1), (0, -1))
    X, Y = grid(w, h)
    for i, p in enumerate(order):
        vis = lab == i
        if not vis.any():
            continue
        M = p.mask
        ys, xs = np.nonzero(M)
        cx, cy = xs.mean() + 0.5, ys.mean() + 0.5
        diag = (X - cx) + (Y - cy)
        idx = np.full((h, w), 2, int)
        dark = np.zeros((h, w), bool)
        if p.band >= 0:
            for b in range(1, p.band + 2):
                dark |= ~shift(M, b, 0) | ~shift(M, 0, b)
            dark &= diag > -1.5
            idx[dark] = 1
        if p.light:
            lit = np.zeros((h, w), bool)
            for b in range(2, p.light_band + 2):
                lit |= ~shift(M, -b, 0) | ~shift(M, 0, -b)
            lit &= (diag < -1.0) & ~dark
            idx[lit] = 3
        if p.outline:
            outer = np.zeros((h, w), bool)
            for dx, dy in dirs:
                outer |= shift(empty, dx, dy, fill=True)
            idx[outer & vis] = p.out_idx
            if p.inner:
                inn = np.zeros((h, w), bool)
                for dx, dy in dirs:
                    nb = shift(lab, dx, dy, fill=-1)
                    inn |= (nb >= 0) & (nb < i)
                idx[inn & vis & ~outer] = p.out_idx
        cols = np.array([rgb(c) for c in p.ramp], np.uint8)
        idx = np.clip(idx, 0, len(cols) - 1)
        img[vis, :3] = cols[idx[vis]]
        img[vis, 3] = 255
    return img


def shape(w, h, parts):
    return Image.fromarray(render_parts(parts, w, h), "RGBA")


def draw_parts(img, parts):
    img.alpha_composite(shape(img.width, img.height, parts))
    return img


# ---------------------------------------------------------------- overlays (translucent, separate layers)
def overlay_from_alpha(alpha, colour="ol0"):
    h, w = alpha.shape
    arr = np.zeros((h, w, 4), np.uint8)
    arr[..., :3] = rgb(colour)
    arr[..., 3] = np.clip(alpha, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def q_alpha(a, levels=(0, 40, 70, 100)):
    """quantise to a few alpha steps (pixel-art soft shadow)"""
    out = np.zeros_like(a)
    for lv in levels[1:]:
        out[a >= lv * 0.85] = lv
    return out


def soft_ellipse_alpha(w, h, cx, cy, rx, ry, alpha):
    X, Y = grid(w, h)
    d = np.sqrt(((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2)
    a = np.zeros((h, w))
    a[d <= 1.0] = alpha * 0.4
    a[d <= 0.82] = alpha * 0.7
    a[d <= 0.62] = alpha
    return a


def shadow_ellipse(w, h, cx, cy, rx, ry, alpha=90):
    return overlay_from_alpha(soft_ellipse_alpha(w, h, cx, cy, rx, ry, alpha))


def glow_alpha(w, h, cx, cy, rx, ry, alpha, steps=5):
    X, Y = grid(w, h)
    d = np.sqrt(((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2)
    a = np.zeros((h, w))
    for k in range(steps):
        r = 1.0 - k / steps
        a[d <= r] = alpha * (k + 1) / steps
    return a


def glow(w, h, cx, cy, rx, ry, alpha, colour="y2", steps=5):
    return overlay_from_alpha(glow_alpha(w, h, cx, cy, rx, ry, alpha, steps), colour)


def shadow_from_mask(mask, dx, dy, alpha=80, soften=True):
    """cast shadow: the sprite silhouette pushed down-right (light from top-left), soft edge"""
    m = shift(mask, -dx, -dy)
    a = m.astype(float) * alpha
    if soften:
        edge = m & ~(shift(m, 1, 0) & shift(m, -1, 0) & shift(m, 0, 1) & shift(m, 0, -1))
        a[edge] = alpha * 0.55
    return overlay_from_alpha(a)


# ---------------------------------------------------------------- tiny pixel font (3x5) for signs
GLYPHS = {
    "A": ["010", "101", "111", "101", "101"], "B": ["110", "101", "110", "101", "110"],
    "C": ["011", "100", "100", "100", "011"], "D": ["110", "101", "101", "101", "110"],
    "E": ["111", "100", "110", "100", "111"], "F": ["111", "100", "110", "100", "100"],
    "G": ["011", "100", "101", "101", "011"], "H": ["101", "101", "111", "101", "101"],
    "I": ["111", "010", "010", "010", "111"], "K": ["101", "101", "110", "101", "101"],
    "L": ["100", "100", "100", "100", "111"], "M": ["101", "111", "111", "101", "101"],
    "N": ["110", "101", "101", "101", "101"], "O": ["010", "101", "101", "101", "010"],
    "P": ["110", "101", "110", "100", "100"], "Q": ["010", "101", "101", "110", "011"], "R": ["110", "101", "110", "101", "101"],
    "S": ["011", "100", "010", "001", "110"], "T": ["111", "010", "010", "010", "010"],
    "U": ["101", "101", "101", "101", "111"], "V": ["101", "101", "101", "101", "010"],
    "W": ["101", "101", "111", "111", "101"], "Y": ["101", "101", "010", "010", "010"],
    "X": ["101", "101", "010", "101", "101"], " ": ["000", "000", "000", "000", "000"],
    "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
    "2": ["110", "001", "010", "100", "111"], "3": ["110", "001", "010", "001", "110"],
    "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "110", "001", "110"],
    "6": ["011", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"],
    "8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "110"],
    "$": ["011", "110", "010", "011", "110"], "!": ["010", "010", "010", "000", "010"],
}


# Portuguese accents: base glyph + extra pixels (row -1 stays empty so the acute never touches the letter)
ACUTE = [(1, -2), (2, -3)]
MARKED = {"Á": ("A", ACUTE), "É": ("E", ACUTE), "Ú": ("U", ACUTE), "Ç": ("C", [(1, 5), (0, 6)])}


def glyph_pixels(ch):
    base, marks = MARKED.get(ch, (ch, []))
    px = [(gx, gy) for gy, row in enumerate(GLYPHS[base]) for gx, v in enumerate(row) if v == "1"]
    return px + marks


def text_width(s):
    return len(s) * 4 - 1


def draw_text(img, x, y, s, name):
    for i, ch in enumerate(s.upper()):
        for gx, gy in glyph_pixels(ch):
            put(img, x + i * 4 + gx, y + gy, C(name))


# ---------------------------------------------------------------- tileable noise
def tile_noise(seed, n=32, octaves=((4, 1.0), (8, 0.5))):
    """periodic value noise (period n) in [0, 1]"""
    rnd = np.random.RandomState(seed)
    out = np.zeros((n, n))
    tot = 0
    for cells, amp in octaves:
        g = rnd.rand(cells, cells)
        ys, xs = np.mgrid[0:n, 0:n] / n * cells
        x0, y0 = np.floor(xs).astype(int), np.floor(ys).astype(int)
        fx, fy = xs - x0, ys - y0
        fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        x1, y1 = (x0 + 1) % cells, (y0 + 1) % cells
        v = (g[y0, x0] * (1 - fx) * (1 - fy) + g[y0, x1] * fx * (1 - fy) + g[y1, x0] * (1 - fx) * fy
             + g[y1, x1] * fx * fy)
        out += v * amp
        tot += amp
    return out / tot


# ---------------------------------------------------------------- atlas
class Atlas:
    """Packs items (images whose sides are multiples of 32) into a fixed-width tile grid.
    Every item keeps its rectangle, so Tiled users can select it as a stamp."""

    def __init__(self, name, cols):
        self.name, self.cols = name, cols
        self.occ = []  # rows of bool
        self.tiles = {}  # id -> image
        self.props = {}  # id -> dict
        self.cls = {}  # id -> class name
        self.anims = {}  # id -> [(tileid, ms)]
        self.items = {}
        self.cursor_row = 0
        self.wangsets = []
        self.sections = []

    def section(self, title):
        # start the next item on a fresh row
        self.cursor_row = len(self.occ)
        self.sections.append((title, self.cursor_row))

    def _fits(self, x, y, w, h):
        for yy in range(y, y + h):
            while yy >= len(self.occ):
                self.occ.append([False] * self.cols)
            for xx in range(x, x + w):
                if self.occ[yy][xx]:
                    return False
        return True

    def _place(self, w, h):
        assert w <= self.cols, w
        y = self.cursor_row
        while True:
            for x in range(0, self.cols - w + 1):
                if self._fits(x, y, w, h):
                    for yy in range(y, y + h):
                        for xx in range(x, x + w):
                            self.occ[yy][xx] = True
                    return x, y
            y += 1

    def _ids(self, x, y, w, h):
        return [[(y + j) * self.cols + (x + i) for i in range(w)] for j in range(h)]

    def add(self, name, frames, props=None, tile_props=None, fps=None, info=None, sparse=False):
        """frames: an image or a list of images (animation). props: for every tile.
        tile_props(tx, ty) -> dict of extra per-tile properties."""
        if isinstance(frames, Image.Image):
            frames = [frames]
        w, h = frames[0].width // T, frames[0].height // T
        assert frames[0].width % T == 0 and frames[0].height % T == 0, (name, frames[0].size)
        n = len(frames)
        grids = []
        if n > 1 and sparse:
            # frame 0 as a rectangle; extra frames only for the tiles that change
            x, y = self._place(w, h)
            g0 = self._ids(x, y, w, h)
            grids = [g0] + [[row[:] for row in g0] for _ in range(n - 1)]
            for j in range(h):
                for i in range(w):
                    crops = [f.crop((i * T, j * T, (i + 1) * T, (j + 1) * T)) for f in frames]
                    if all(np.array_equal(np.array(crops[0]), np.array(c)) for c in crops[1:]):
                        continue
                    fx, fy = self._place(n - 1, 1)
                    for k in range(1, n):
                        grids[k][j][i] = fy * self.cols + fx + k - 1
        else:
            # all frames side by side when they fit, else stacked
            x, y = self._place(w * n, h) if w * n <= self.cols else (None, None)
        if grids:
            pass
        elif x is not None:
            for f in range(n):
                grids.append(self._ids(x + f * w, y, w, h))
        else:
            for f in range(n):
                fx, fy = self._place(w, h)
                grids.append(self._ids(fx, fy, w, h))
        # fully transparent tiles are not stored (id -1)
        for j in range(h):
            for i in range(w):
                if all(np.array(f.crop((i * T, j * T, (i + 1) * T, (j + 1) * T)))[..., 3].max() == 0 for f in frames):
                    for g in grids:
                        g[j][i] = -1
        for f, im in enumerate(frames):
            for j in range(h):
                for i in range(w):
                    tid = grids[f][j][i]
                    if tid < 0 or (f > 0 and tid == grids[0][j][i]):
                        continue
                    self.tiles[tid] = im.crop((i * T, j * T, (i + 1) * T, (j + 1) * T))
                    self.cls[tid] = name
                    pr = dict(props or {})
                    if tile_props:
                        pr.update(tile_props(i, j) or {})
                    animated = n > 1 and any(grids[k][j][i] != grids[0][j][i] for k in range(1, n))
                    if animated:
                        pr["frames"] = n
                        pr["fps"] = fps or 6
                        pr["frame"] = f
                    self.props[tid] = pr
        if n > 1:
            ms = int(round(1000 / (fps or 6)))
            for j in range(h):
                for i in range(w):
                    if grids[0][j][i] >= 0 and any(grids[k][j][i] != grids[0][j][i] for k in range(1, n)):
                        self.anims[grids[0][j][i]] = [(grids[f][j][i], ms) for f in range(n)]
        item = {"w": w, "h": h, "ids": grids[0]}
        if n > 1:
            item["frames"] = grids
            item["fps"] = fps or 6
        if props:
            item["props"] = props
        if info:
            item.update(info)
        self.items[name] = item
        return grids

    def rows(self):
        return len(self.occ)

    def sheet(self):
        im = blank(self.cols * T, self.rows() * T)
        for tid, t in self.tiles.items():
            im.alpha_composite(t, ((tid % self.cols) * T, (tid // self.cols) * T))
        return im

    def tile(self, tid):
        return self.tiles[tid]

    def item_image(self, name, frame=0):
        it = self.items[name]
        g = it["frames"][frame] if "frames" in it else it["ids"]
        im = blank(it["w"] * T, it["h"] * T)
        for j, row in enumerate(g):
            for i, tid in enumerate(row):
                if tid >= 0:
                    im.alpha_composite(self.tiles[tid], (i * T, j * T))
        return im

    def add_wangset(self, name, colours, tiles):
        """colours: [(name, hex)], tiles: [(tileid, (tl, tr, br, bl))] with colour index 1..n"""
        self.wangsets.append((name, colours, tiles))

    def write_tsx(self, path, image_name):
        rows = self.rows()
        count = self.cols * rows
        L = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<tileset version="1.10" tiledversion="1.11.2" name="%s" tilewidth="32" tileheight="32" '
             'tilecount="%d" columns="%d">' % (self.name, count, self.cols),
             ' <image source="%s" width="%d" height="%d"/>' % (image_name, self.cols * T, rows * T)]
        for tid in sorted(self.tiles):
            pr = self.props.get(tid, {})
            L.append(' <tile id="%d" type="%s">' % (tid, escape(self.cls[tid])))
            if pr:
                L.append('  <properties>')
                for k in sorted(pr):
                    v = pr[k]
                    if isinstance(v, bool):
                        L.append('   <property name="%s" type="bool" value="%s"/>' % (k, "true" if v else "false"))
                    elif isinstance(v, int):
                        L.append('   <property name="%s" type="int" value="%d"/>' % (k, v))
                    else:
                        L.append('   <property name="%s" value="%s"/>' % (k, escape(str(v))))
                L.append('  </properties>')
            if tid in self.anims:
                L.append('  <animation>')
                for fid, ms in self.anims[tid]:
                    L.append('   <frame tileid="%d" duration="%d"/>' % (fid, ms))
                L.append('  </animation>')
            L.append(' </tile>')
        if self.wangsets:
            L.append(' <wangsets>')
            for name, colours, tiles in self.wangsets:
                L.append('  <wangset name="%s" type="corner" tile="%d">' % (name, tiles[-1][0]))
                for cname, hexc in colours:
                    L.append('   <wangcolor name="%s" color="%s" tile="-1" probability="1"/>' % (cname, hexc))
                for tid, (tl, tr, br, bl) in tiles:
                    L.append('   <wangtile tileid="%d" wangid="0,%d,0,%d,0,%d,0,%d"/>' % (tid, tr, br, bl, tl))
                L.append('  </wangset>')
            L.append(' </wangsets>')
        L.append('</tileset>')
        open(path, "w").write("\n".join(L) + "\n")

    def write_json(self, path, extra=None):
        out = {"tilewidth": T, "tileheight": T, "columns": self.cols, "rows": self.rows(),
               "items": self.items}
        if extra:
            out.update(extra)
        json.dump(out, open(path, "w"), indent=1, sort_keys=False)


# ---------------------------------------------------------------- audits
def audit(img, label=""):
    """opaque pixels must be palette colours; translucent pixels must be an overlay colour"""
    a = np.array(img.convert("RGBA"))
    pal = np.array([rgb(n) for n in PALETTE])
    op = a[..., 3] == 255
    px = a[op][:, :3]
    ok = np.zeros(len(px), bool)
    for c in pal:
        ok |= np.all(px == c, axis=1)
    tr = (a[..., 3] > 0) & (a[..., 3] < 255)
    tp = a[tr][:, :3]
    ok2 = np.zeros(len(tp), bool)
    for n in OVERLAY_COLOURS.values():
        ok2 |= np.all(tp == rgb(n), axis=1)
    return int((~ok).sum()), int((~ok2).sum())


def mixed_alpha_tiles(atlas, overlay_kinds=("shadow", "glow", "light")):
    """tiles that mix opaque pixels with translucent ones (a baked shadow) - should be none"""
    bad = []
    for tid, t in atlas.tiles.items():
        a = np.array(t)[..., 3]
        if (a == 255).any() and ((a > 0) & (a < 255)).any():
            bad.append((tid, atlas.cls[tid]))
    return bad


def font(size=10):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def labelled_sheet(atlas, path, scale=2, width=1800, title=""):
    """every item (all frames) at `scale`, labelled, on a checker so alpha is visible"""
    f = font(12)
    pad = 10
    x, y, rowh = pad, 40, 0
    placed = []
    for name, it in atlas.items.items():
        n = len(it.get("frames", [None]))
        w = it["w"] * T * scale * n + (n - 1) * 4
        h = it["h"] * T * scale + 16
        lw = int(f.getlength(name)) + 4
        cw = max(w, lw)
        if x + cw > width - pad:
            x, y = pad, y + rowh + pad
            rowh = 0
        placed.append((name, x, y, n))
        x += cw + pad
        rowh = max(rowh, h)
    H = y + rowh + pad
    im = Image.new("RGB", (width, H), (40, 34, 44))
    d = ImageDraw.Draw(im)
    d.text((pad, 10), title, fill=(255, 244, 176), font=font(18))
    for name, x, y, n in placed:
        it = atlas.items[name]
        for fi in range(n):
            src = atlas.item_image(name, fi)
            big = src.resize((src.width * scale, src.height * scale), Image.NEAREST)
            bx = x + fi * (big.width + 4)
            # checker behind
            bg = Image.new("RGB", big.size, (92, 84, 96))
            bd = ImageDraw.Draw(bg)
            for cy in range(0, big.height, 16):
                for cx in range(0, big.width, 16):
                    if (cx // 16 + cy // 16) % 2:
                        bd.rectangle((cx, cy, cx + 15, cy + 15), fill=(108, 100, 112))
            bg.paste(big, (0, 0), big)
            im.paste(bg, (bx, y))
        d.text((x, y + it["h"] * T * scale + 2), name, fill=(240, 230, 210), font=f)
    im.save(path)
    return im
