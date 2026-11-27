"""Ground textures (all tileable on a 32px period) and the 16-piece corner autotiles."""
import random

import numpy as np
from PIL import Image

from pixkit import T, C, rgb, fill, put, blank, tile_noise, shift, wshift


def arr(img):
    return np.array(img)


def paint(a, mask, name):
    a[mask, :3] = rgb(name)
    a[mask, 3] = 255


def img(a):
    return Image.fromarray(a, "RGBA")


def hash01(x, y, salt=0):
    """deterministic per-pixel random in [0,1) on the 32px period"""
    v = (np.uint32(x % 32) * np.uint32(73856093)) ^ (np.uint32(y % 32) * np.uint32(19349663)) ^ np.uint32(
        (salt * 83492791) & 0xffffffff)
    v = (v ^ (v >> np.uint32(13))) * np.uint32(1274126177)
    v = v ^ (v >> np.uint32(16))
    return (v % np.uint32(1000)).astype(float) / 1000.0


def H(salt=0):
    ys, xs = np.mgrid[0:T, 0:T]
    return hash01(xs.astype(np.uint32), ys.astype(np.uint32), salt)


CHECK = (np.add.outer(np.arange(T), np.arange(T)) % 2 == 0)


# ---------------------------------------------------------------- grass
def scatter(seed, n, minsep=6):
    """evenly scattered points on the 32px torus (simple dart throwing)"""
    rnd = random.Random(seed)
    pts = []
    tries = 0
    while len(pts) < n and tries < 4000:
        tries += 1
        x, y = rnd.randrange(32), rnd.randrange(32)
        ok = True
        for (px, py) in pts:
            dx = min(abs(x - px), 32 - abs(x - px))
            dy = min(abs(y - py), 32 - abs(y - py))
            if dx * dx + dy * dy < minsep * minsep:
                ok = False
                break
        if ok:
            pts.append((x, y))
    return pts


def grass(variant):
    im = fill(T, T, "q3")
    rnd = random.Random(50 + variant)
    pts = scatter(60 + variant, 14, 7)
    for k, (x, y) in enumerate(pts):
        kind = (k + variant) % 3
        if kind == 0:  # tuft
            for dx, dy, c in ((0, 0, "q1"), (-1, -1, "q2"), (1, -1, "q2"), (-1, -2, "q4"), (1, -2, "q4"),
                              (0, -1, "q2")):
                put(im, (x + dx) % 32, (y + dy) % 32, C(c))
        elif kind == 1:  # short blade pair
            put(im, x, y, C("q2"))
            put(im, (x + 2) % 32, y, C("q2"))
            put(im, x, (y - 1) % 32, C("q4"))
        else:  # dark fleck
            put(im, x, y, C("q2"))
            put(im, (x + 1) % 32, y, C("q2"))
    for (x, y) in scatter(90 + variant, 6, 9):
        put(im, x, y, C("q4"))
    flowers = {0: [], 1: [],
               2: [((8, 9), "wh"), ((22, 21), "y1"), ((25, 7), "wh")],
               3: [((6, 22), "k1"), ((14, 12), "wh"), ((24, 26), "r2"), ((26, 10), "y1"), ((10, 4), "k1"),
                   ((18, 28), "wh")]}[variant]
    for (x, y), c in flowers:
        put(im, x, y + 2, C("q1"))
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            put(im, x + dx, y + dy, C(c))
        put(im, x, y, C("y0" if c != "y1" else "w2"))
        put(im, x + 1, y + 1, C("q1"))
    if variant == 1:  # clover clumps
        for x, y in ((6, 6), (20, 24)):
            for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1), (2, 1), (1, 2)):
                put(im, x + dx, y + dy, C("q4"))
            put(im, x + 1, y + 3, C("q1"))
            put(im, x + 2, y + 2, C("q2"))
    return im


# ---------------------------------------------------------------- dirt path
def dirt():
    im = fill(T, T, "w2")
    for (x, y) in scatter(70, 10, 7):
        put(im, x, y, C("w1"))
        put(im, (x + 1) % 32, y, C("w1"))
    rnd = random.Random(9)
    for _ in range(6):
        x, y = rnd.randrange(32), rnd.randrange(32)
        put(im, x, y, C("t2"))
        put(im, (x + 1) % 32, y, C("t3"))
        put(im, x, (y + 1) % 32, C("w1"))
        put(im, (x + 1) % 32, (y + 1) % 32, C("w1"))
    for _ in range(5):
        put(im, rnd.randrange(32), rnd.randrange(32), C("w3"))
    return im


# ---------------------------------------------------------------- cobbles (street / road)
def cobbles(base, light, shade, grout, seed, top=None):
    """rounded setts, 8x8 grid, rows offset by 4; tileable"""
    rnd = random.Random(seed)
    im = fill(T, T, grout)
    for row in range(4):
        off = 4 * (row % 2)
        for col in range(4):
            x0 = col * 8 + off
            y0 = row * 8
            c = rnd.choice([base, base, base, shade if shade != grout else base])
            hl = top or light
            for y in range(y0, y0 + 7):
                for x in range(x0, x0 + 7):
                    lx, ly = x - x0, y - y0
                    if (lx in (0, 6)) and (ly in (0, 6)):
                        continue
                    col_ = c
                    if ly == 0 or lx == 0:
                        col_ = light if c == base else base
                    if ly == 6 or lx == 6:
                        col_ = shade
                    if lx == 1 and ly == 1:
                        col_ = hl
                    put(im, x % 32, y % 32, C(col_))
    return im


def street():
    return cobbles("t2", "t3", "t1", "t0", 4, top="t4")


def road():
    return cobbles("m1", "m2", "m0", "ol1", 6)


def road_lane(horizontal=True):
    im = road()
    for k in range(8, 24):
        for w, c in ((0, "y1"), (1, "y1"), (2, "y0")):
            if horizontal:
                put(im, k, 14 + w, C(c))
            else:
                put(im, 14 + w, k, C(c if w < 2 else "y0"))
    if horizontal:
        put(im, 8, 14, C("y2"))
    else:
        put(im, 14, 8, C("y2"))
    return im


def crosswalk(horizontal=True):
    """stripes across the road; horizontal=True -> for a road running left-right"""
    im = road()
    for s in range(4):
        for k in range(2, 30):
            for w in range(5):
                p = s * 8 + 1 + w
                c = "t4" if w < 4 else "t2"
                if w == 0:
                    c = "wh"
                if horizontal:
                    put(im, p, k, C(c))
                else:
                    put(im, k, p, C(c))
    return im


# ---------------------------------------------------------------- sidewalk + curbs
def sidewalk():
    im = fill(T, T, "t3")
    for qy in range(2):
        for qx in range(2):
            x0, y0 = qx * 16, qy * 16
            for k in range(16):
                put(im, x0 + k, y0, C("t2"))
                put(im, x0, y0 + k, C("t2"))
                put(im, x0 + k, y0 + 1, C("t4"))
                put(im, x0 + 1, y0 + k, C("t4"))
    put(im, 7, 9, C("t2"))
    put(im, 8, 10, C("t2"))
    put(im, 24, 21, C("t2"))
    return im


def sidewalk_curb(sides):
    """sides: set of 'n','s','e','w' bordering a road; curb stone 4px on those sides"""
    im = sidewalk()
    a = arr(im)
    ys, xs = np.mgrid[0:T, 0:T]
    for s in sorted(sides):
        if s == "s":
            paint(a, ys == 27, "t4")
            paint(a, (ys >= 28) & (ys <= 30), "t2")
            paint(a, ys == 31, "t0")
        if s == "n":
            paint(a, ys == 0, "t0")
            paint(a, ys == 1, "t4")
            paint(a, (ys >= 2) & (ys <= 3), "t2")
        if s == "e":
            paint(a, xs == 28, "t4")
            paint(a, (xs >= 29) & (xs <= 30), "t2")
            paint(a, xs == 31, "t0")
        if s == "w":
            paint(a, xs == 0, "t0")
            paint(a, xs == 1, "t4")
            paint(a, (xs >= 2) & (xs <= 3), "t2")
    # joints on the curb every 16px
    for s in sorted(sides):
        for k in (15, 31):
            if s in "ns":
                y0 = 27 if s == "s" else 0
                for y in range(y0, y0 + 4):
                    paint(a, (ys == y) & (xs == k), "t1")
            else:
                x0 = 28 if s == "e" else 0
                for x in range(x0, x0 + 4):
                    paint(a, (xs == x) & (ys == k), "t1")
    return img(a)


# ---------------------------------------------------------------- plaza floors
def checker():
    im = fill(T, T, "t3")
    for qy in range(2):
        for qx in range(2):
            light = (qx + qy) % 2 == 0
            base = "t4" if light else "t2"
            x0, y0 = qx * 16, qy * 16
            for y in range(16):
                for x in range(16):
                    c = base
                    if x == 0 or y == 0:
                        c = "t1"
                    elif x == 1 or y == 1:
                        c = "wh" if light else "t3"
                    elif x == 15 or y == 15:
                        c = "t3" if light else "t1"
                    put(im, x0 + x, y0 + y, C(c))
    return im


def pavers(seed=3, cracks=False):
    rnd = random.Random(seed)
    im = fill(T, T, "t1")
    rows = [(0, 11, [0, 13, 22]), (11, 10, [6, 19, 28]), (21, 11, [3, 15, 25])]
    for y0, hgt, cuts in rows:
        cuts = sorted(cuts)
        for k in range(len(cuts)):
            a_, b_ = cuts[k], cuts[(k + 1) % len(cuts)] + (32 if k == len(cuts) - 1 else 0)
            shade = rnd.choice(["t3", "t3", "t2"])
            for y in range(y0 + 1, y0 + hgt):
                for x in range(a_ + 1, b_):
                    c = shade
                    if y == y0 + 1 or x == a_ + 1:
                        c = "t4" if shade == "t3" else "t3"
                    if y == y0 + hgt - 1 or x == b_ - 1:
                        c = "t2" if shade == "t3" else "t1"
                    put(im, x % 32, y, C(c))
            for _ in range(2):
                sx = rnd.randint(a_ + 3, max(a_ + 3, b_ - 3)) % 32
                sy = rnd.randint(y0 + 3, y0 + hgt - 3)
                put(im, sx, sy, C("t2"))
    if cracks:
        for (x, y) in ((8, 4), (9, 5), (9, 6), (10, 7), (24, 25), (25, 25), (26, 26)):
            put(im, x, y, C("t1"))
    return im


def basketweave():
    """terracotta bricks, 8x8 blocks alternating 2 horizontal / 2 vertical bricks"""
    im = fill(T, T, "w1")
    for by in range(4):
        for bx in range(4):
            horiz = (bx + by) % 2 == 0
            for k in range(2):
                if horiz:
                    x0, y0, x1, y1 = bx * 8, by * 8 + k * 4, bx * 8 + 7, by * 8 + k * 4 + 3
                else:
                    x0, y0, x1, y1 = bx * 8 + k * 4, by * 8, bx * 8 + k * 4 + 3, by * 8 + 7
                for y in range(y0, y1 + 1):
                    for x in range(x0, x1 + 1):
                        c = "h2"
                        if y == y1 or x == x1:
                            c = "w1"
                        elif y == y0 or x == x0:
                            c = "h3"
                        elif y == y1 - 1 or x == x1 - 1:
                            c = "h1" if (x + y) % 3 == 0 else "h2"
                        put(im, x, y, C(c))
    return im


# ---------------------------------------------------------------- water (animated)
WAVES = [(3, 4, 0), (19, 6, 1), (11, 12, 2), (26, 15, 3), (5, 19, 1), (16, 23, 0), (28, 27, 2), (9, 29, 3)]


def water(f):
    im = fill(T, T, "a1")
    for (x, y) in ((7, 9), (23, 1), (14, 25), (29, 20)):
        for i in range(3):
            put(im, (x + i) % 32, y, C("a0"))
    for (x, y, ph) in WAVES:
        k = (f + ph) % 4
        dx = [0, 1, 2, 1][k]
        ln = [4, 5, 4, 3][k]
        for i in range(ln):
            put(im, (x + dx + i) % 32, y, C("a2"))
        put(im, (x + dx + 1) % 32, (y - 1) % 32, C("a2") if k in (1, 2) else C("a1"))
        if k == 1:
            put(im, (x + dx + 2) % 32, (y - 1) % 32, C("a3"))
    return im


# ---------------------------------------------------------------- sand, dock, rock
def sand():
    im = fill(T, T, "t3")
    for (x, y) in scatter(33, 8, 8):
        put(im, x, y, C("t4"))
        put(im, (x + 1) % 32, y, C("t4"))
    rnd = random.Random(3)
    for _ in range(7):
        put(im, rnd.randrange(32), rnd.randrange(32), C("t2"))
    put(im, 22, 9, C("k1"))
    put(im, 23, 9, C("wh"))
    put(im, 22, 10, C("t2"))
    return im


def planks(vertical=False):
    im = fill(T, T, "w2")
    rnd = random.Random(12)
    for p in range(4):
        y0 = p * 8
        joint = rnd.choice([5, 11, 19, 26])
        for x in range(T):
            put(im, x, y0, C("w0"))
            put(im, x, y0 + 1, C("w3"))
            put(im, x, y0 + 7, C("w1"))
        for y in range(y0 + 1, y0 + 7):
            put(im, joint, y, C("w0"))
            put(im, (joint + 1) % 32, y, C("w3") if y < y0 + 6 else C("w1"))
        put(im, (joint + 3) % 32, y0 + 3, C("m1"))
        put(im, (joint - 2) % 32, y0 + 3, C("m1"))
        for _ in range(2):
            gx = rnd.randrange(32)
            gy = y0 + rnd.choice([3, 4, 5])
            put(im, gx, gy, C("w1"))
            put(im, (gx + 1) % 32, gy, C("w1"))
    if vertical:
        im = im.transpose(Image.ROTATE_90)
    return im


def rock_ground():
    a = arr(fill(T, T, "t1"))
    n = tile_noise(41)
    paint(a, n > 0.66, "t0")
    paint(a, (n > 0.6) & (n <= 0.66) & CHECK, "t0")
    paint(a, (n < 0.3) & CHECK, "t2")
    im = img(a)
    rnd = random.Random(8)
    for _ in range(5):
        x, y = rnd.randrange(32), rnd.randrange(32)
        put(im, x, y, C("t3"))
        put(im, (x + 1) % 32, y, C("t2"))
        put(im, x, (y + 1) % 32, C("t0"))
        put(im, (x + 1) % 32, (y + 1) % 32, C("ol1"))
    return im


def cliff(kind):
    """kind: top (grass lip), face, base (meets ground), face_alt"""
    im = fill(T, T, "t1")
    rnd = random.Random({"top": 1, "face": 2, "base": 3, "face_alt": 4}[kind])
    # stacked rock slabs with lit top-left edges
    y = -4 if kind != "face_alt" else -1
    while y < 32:
        h = rnd.choice([7, 8, 9])
        x = -rnd.randrange(0, 10)
        while x < 32:
            w = rnd.choice([9, 11, 13])
            c = rnd.choice(["t1", "t1", "t2"])
            for yy in range(y, y + h):
                for xx in range(x, x + w):
                    if not (0 <= yy < 32):
                        continue
                    lx, ly = xx - x, yy - y
                    col = c
                    if ly == 0 or lx == 0:
                        col = "t3" if c == "t2" else "t2"
                    if ly == h - 1 or lx == w - 1:
                        col = "ol1"
                    elif ly == h - 2 or lx == w - 2:
                        col = "t0"
                    put(im, xx % 32, yy, C(col))
            x += w
        y += h
    a = arr(im)
    ys, xs = np.mgrid[0:T, 0:T]
    if kind == "top":
        lip = np.zeros((T, T), bool)
        for x in range(T):
            d = 8 + (1 if (x * 7) % 5 == 0 else 0) + (1 if x % 11 == 3 else 0)
            lip[:d, x] = True
        g = arr(grass(0))
        a[lip] = g[lip]
        edge = lip & ~shift(lip, 0, 1)
        paint(a, edge, "q1")
        paint(a, shift(edge, 0, -1) & ~lip, "ol1")
        paint(a, lip & shift(lip, 0, 1) & ~shift(lip, 0, 2) & CHECK, "q2")
    if kind == "base":
        # rubble at the foot of the cliff
        for x0 in (2, 13, 23):
            for dx in range(6):
                for dy in range(3):
                    if (dx in (0, 5) and dy == 0):
                        continue
                    put_a = (26 + dy, x0 + dx)
                    a[put_a[0], put_a[1], :3] = rgb("t2" if dy == 0 else ("t1" if dx < 4 else "t0"))
            a[29, x0:x0 + 6, :3] = rgb("ol1")
    return img(a)


# ---------------------------------------------------------------- 16-piece corner autotiles
CORNERS = [(0, 0), (32, 0), (32, 32), (0, 32)]  # tl, tr, br, bl
EXT = 3


def wang_field(corners, seed, R=28.0, amp=0.24):
    n = T + 2 * EXT
    ys, xs = np.mgrid[0:n, 0:n]
    X, Y = xs - EXT + 0.5, ys - EXT + 0.5
    f = np.zeros((n, n))
    for (cx, cy), v in zip(CORNERS, corners):
        if v:
            d = np.hypot(X - cx, Y - cy)
            f += np.clip(1 - d / R, 0, None)
    nz = tile_noise(seed, octaves=((4, 1.0), (8, 0.6)))
    noise = nz[(ys - EXT) % 32, (xs - EXT) % 32]
    return f > 0.5 + (noise - 0.5) * amp, (xs - EXT) % 32, (ys - EXT) % 32


def ext_tex(tex):
    a = np.array(tex)
    n = T + 2 * EXT
    ys, xs = np.mgrid[0:n, 0:n]
    return a[(ys - EXT) % 32, (xs - EXT) % 32].copy()


def near(m, k=1):
    """pixels outside m within k steps (4-neighbourhood dilation)"""
    d = m.copy()
    for _ in range(k):
        d = d | shift(d, 1, 0) | shift(d, -1, 0) | shift(d, 0, 1) | shift(d, 0, -1)
    return d & ~m


def wang_tile(corners, A, B, style, seed, frame=0):
    Mb, px, py = wang_field(corners, seed, amp=0.08 if style == "plaza" else 0.24)
    a = np.where(Mb[..., None], ext_tex(B), ext_tex(A))
    Ma = ~Mb
    hsh = hash01(px.astype(np.uint32), py.astype(np.uint32), seed)
    A_above = shift(Ma, 0, -1, fill=False)
    A_left = shift(Ma, -1, 0, fill=False)
    B_below = shift(Mb, 0, 1, fill=False)
    B_right = shift(Mb, 1, 0, fill=False)
    B_above = shift(Mb, 0, -1, fill=False)
    B_left = shift(Mb, -1, 0, fill=False)
    edgeA = near(Mb, 1) & Ma
    edgeB = near(Ma, 1) & Mb
    if style in ("path", "sand"):
        sh = {"path": "w1", "sand": "t2"}[style]
        paint(a, edgeA, "q2")
        paint(a, edgeA & (B_below | B_right), "q1")
        paint(a, Mb & (A_above | A_left), sh)
        paint(a, Mb & shift(Ma, 0, -2) & ~(A_above | A_left) & (hsh > 0.5), sh)
        # grass blades leaning into the path
        blade = edgeB & ~(A_above | A_left) & (hsh > 0.72)
        paint(a, blade, "q2")
        paint(a, edgeA & B_above & (hsh < 0.25), "q4")
    elif style == "plaza":
        curb = edgeB
        paint(a, curb, "t1")
        paint(a, Mb & near(Ma, 2) & ~curb & (shift(Ma, 0, -2) | shift(Ma, -2, 0)), "t2")
        paint(a, Mb & near(Ma, 2) & ~curb & (shift(Ma, 0, 2) | shift(Ma, 2, 0)), "t4")
        paint(a, edgeA, "q1")
        paint(a, near(Mb, 2) & Ma & ~edgeA & (hsh > 0.6), "q2")
    elif style == "shore":
        # A = sand, B = water (animated foam)
        wet = near(Mb, 2) & Ma
        paint(a, wet, "t2")
        paint(a, wet & ~near(Mb, 1) & (hsh > 0.5), "t3")
        paint(a, near(Mb, 1) & Ma, "t1")
        foam1 = edgeB
        foam2 = near(Ma, 2) & Mb & ~foam1
        foam3 = near(Ma, 3) & Mb & ~foam1 & ~foam2
        ph = ((px + py) // 2 + frame) % 4
        paint(a, foam1 & (ph != 3), "wh")
        paint(a, foam1 & (ph == 3), "a3")
        paint(a, foam2, "a3" if frame % 2 == 0 else "a2")
        paint(a, foam2 & (ph == 0), "wh")
        paint(a, foam3 & (ph == 1), "a3")
        paint(a, foam3 & (ph != 1), "a2")
    return Image.fromarray(a[EXT:EXT + T, EXT:EXT + T].copy(), "RGBA")


def wang_set(A, B, style, seed, frame=0):
    """16 tiles in a 4x4 image; tile k has corners tl=bit3 tr=bit2 br=bit1 bl=bit0 (1 = second terrain)"""
    sheet = blank(4 * T, 4 * T)
    meta = []
    for k in range(16):
        c = ((k >> 3) & 1, (k >> 2) & 1, (k >> 1) & 1, k & 1)
        t = wang_tile(c, A, B, style, seed, frame)
        sheet.alpha_composite(t, ((k % 4) * T, (k // 4) * T))
        meta.append(c)
    return sheet, meta
