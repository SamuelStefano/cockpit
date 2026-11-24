"""'Bug', the easter-egg fish of the plaza fountain. Original character: a round, chunky cartoon fish
with a beetle look (green dotted shell on its back, two antennae with ball tips, six tiny leg-fins
under the belly) in orange/yellow and green, with big eyes.

The fish is modelled in local coordinates (facing left, origin at the body centre) and rasterised
through a rotation, so the jump arc tilts the actual pixels instead of rotating a finished sprite.
"""
import math

import numpy as np
from PIL import Image

from pixkit import C, rgb, blank, put, grid, m_poly, Part, render_parts
from fxkit import stack_alpha, flip, clear_baked

BODY = ["h1", "h2", "h3", "y1"]
BELLY = ["h2", "y0", "y1", "y2"]
SHELL = ["g0", "g1", "g2", "g3"]
FIN = ["h1", "y0", "y1", "y2"]
EYE = ["h0", "t4", "wh", "wh"]


class Pose:
    def __init__(self, cx, cy, angle=0.0, scale=1.0, tail=0.0, ant=0.0, legs=0, blink=0, wink=False,
                 mouth="smile"):
        self.cx, self.cy, self.angle, self.s = cx, cy, angle, scale
        self.tail, self.ant, self.legs, self.blink, self.wink, self.mouth = tail, ant, legs, blink, wink, mouth

    def to_world(self, u, v):
        u, v = u * self.s, v * self.s
        ca, sa = math.cos(self.angle), math.sin(self.angle)
        return self.cx + u * ca - v * sa, self.cy + u * sa + v * ca

    def local(self, W, H):
        X, Y = grid(W, H)
        dx, dy = X - self.cx, Y - self.cy
        ca, sa = math.cos(self.angle), math.sin(self.angle)
        u = (dx * ca + dy * sa) / self.s
        v = (-dx * sa + dy * ca) / self.s
        return u, v


def ell(u, v, cx, cy, rx, ry):
    return ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1.0


def poly(p, W, H, pts):
    return m_poly(W, H, [p.to_world(a, b) for a, b in pts])


def fish(W, H, p):
    """returns an RGBA image of Bug in pose p (facing left)"""
    u, v = p.local(W, H)
    body = ell(u, v, 0, 0, 10, 7.5)
    belly = body & ell(u, v, -0.5, 4.2, 8.6, 4.4)
    shell = body & ell(u, v, 3.0, -3.4, 6.8, 4.6) & (v < 0.6) & (u > -2.5)
    # tail: a fan whose tip swings up/down with p.tail
    t = p.tail
    tail = poly(p, W, H, [(7.5, -1), (15, -6 + t * 2.5), (13.2, 0 + t * 1.5), (15, 6 + t * 2.5), (7.5, 1.5)])
    # top fin (small crest behind the shell) and the six leg-fins (three near, three far)
    crest = poly(p, W, H, [(3, -6.5), (7, -8.6), (8.6, -4.5)])
    eye_near = ell(u, v, -5.2, -2.4, 3.3, 3.7)
    eye_far = ell(u, v, -9.0, -3.6, 1.5, 2.2) & ~eye_near & body
    parts = [Part("tail", tail, FIN, 1, band=1, light=True),
             Part("crest", crest, FIN, 1.2, band=0, light=True),
             Part("body", body, BODY, 2, band=1, light=True),
             Part("belly", belly, BELLY, 2.2, band=0, light=False, outline=False),
             Part("shell", shell, SHELL, 3, band=1, light=True),
             Part("eye_far", eye_far, ["h1", "t3", "t4", "t4"], 4, band=-1, light=False, outline=False),
             Part("eye", eye_near, EYE, 5, band=-1, light=False)]
    arr = render_parts(parts, W, H)
    im = Image.fromarray(arr, "RGBA")

    def dot(a, b, col):
        x, y = p.to_world(a, b)
        put(im, int(math.floor(x)), int(math.floor(y)), C(col))

    # dotted shell pattern (beetle spots) + the seam between the two wing cases
    for a, b in ((1.2, -5.6), (5.0, -4.4), (2.2, -2.6), (6.4, -1.6), (-1.6, -3.4), (4.2, -0.6)):
        if shell[int(min(H - 1, max(0, round(p.to_world(a, b)[1] - 0.5)))),
                 int(min(W - 1, max(0, round(p.to_world(a, b)[0] - 0.5))))]:
            dot(a, b, "y1")
    for k in range(5):
        dot(-3.2 + k * 0.3, -6.6 + k * 1.3, "g0")
    # eyes: pupils look forward, blink / wink closes the lids
    # six tiny leg-fins under the belly: three near (light) and three far (dark), paddling
    for k, lx in enumerate((-4.0, 0.0, 4.0)):
        sw = 1 if (k + p.legs) % 2 else 0
        dot(lx + sw * 0.6, 7.9, "h1")
        dot(lx + sw, 8.9, "h0")
        dot(lx + 1.6 - sw * 0.6, 7.9, "h0")
    for (ex, ey, r, near) in ((-5.2, -2.4, 3.3, True), (-9.0, -3.6, 1.5, False)):
        closed = p.blink == 2 or (p.wink and near)
        half = p.blink == 1
        if closed:
            # lid: body colour fill + a dark lash line (a happy "^" for the wink)
            m = ell(u, v, ex, ey, r * 0.95, r * 0.95 * (3.6 / 3.4)) & (eye_near if near else eye_far)
            a = np.array(im)
            a[m, :3] = rgb("h3")
            im = Image.fromarray(a, "RGBA")
            if p.wink and near:
                for d in (-2, -1, 0, 1, 2):
                    dot(ex + d, ey - 0.4 + abs(d) * 0.55, "ol0")
            else:
                for d in (-2, -1, 0, 1, 2):
                    dot(ex + d * (r / 3.4), ey + 0.6, "ol0")
            continue
        if half:
            m = ell(u, v, ex, ey, r, r * 1.06) & (v < ey - 0.2) & (eye_near if near else eye_far)
            a = np.array(im)
            a[m, :3] = rgb("h3")
            im = Image.fromarray(a, "RGBA")
            for d in (-2, -1, 0, 1):
                dot(ex + d * (r / 3.4) + 0.5, ey - 0.1, "h1")
        if near:
            px = ex - 0.6
            for a, b in ((0, 0), (-1, 0), (0, 1), (-1, 1), (0, 2), (-1, 2)):
                dot(px + a, ey - 0.2 + b, "ol0")
            if not half:
                dot(px, ey - 0.2, "wh")
        else:
            dot(ex - 0.3, ey + 0.5, "ol0")
    # mouth and blush
    if p.mouth == "smile":
        for a, b in ((-9.4, 2.4), (-8.6, 3.2), (-7.6, 3.4)):
            dot(a, b, "h0")
    elif p.mouth == "o":
        dot(-9.2, 2.6, "h0")
        dot(-9.2, 3.6, "h0")
        dot(-8.2, 3.1, "h0")
    dot(-5.0, 2.2, "k1")
    dot(-4.0, 2.2, "k1")
    # antennae: two bent stalks with ball tips (drawn last, they stick out of the outline)
    for k, (bx, by, lx, ly) in enumerate(((-5.5, -6.6, -9.5, -12.0), (-2.6, -7.0, -4.8, -12.6))):
        sway = p.ant * (1.0 if k == 0 else 0.6)
        pts = []
        for i in range(8):
            s_ = i / 7
            a = bx + (lx - bx) * s_ + sway * s_ * s_
            b = by + (ly - by) * s_ + 1.4 * math.sin(math.pi * s_)
            pts.append((a, b))
        for a, b in pts[:-1]:
            dot(a, b, "h0")
        tx, ty = pts[-1]
        dot(tx, ty, "y1")
        dot(tx + 1, ty, "y0")
        dot(tx, ty - 1, "y2")
        dot(tx + 1, ty - 1, "y1")
    return im


# ---------------------------------------------------------------- rows (32x20, facing left)
FW, FH = 32, 20
CX, CY = 15.0, 12.0


def swim_left():
    out = []
    for f in range(6):
        ph = 2 * math.pi * f / 6
        bob = 0.6 * math.sin(ph)
        out.append(fish(FW, FH, Pose(CX, CY + bob, tail=math.sin(ph) * 1.0, ant=math.sin(ph + 1) * 1.2,
                                     legs=f % 2)))
    return out


def blink():
    return [fish(FW, FH, Pose(CX, CY, blink=b)) for b in (0, 1, 2)]


# ---------------------------------------------------------------- jump (48x56, surface at y = 46)
JW, JH, SURF = 48, 56, 46


def surface_bits(al, x, kind, k):
    """translucent water marks at the surface: ring (kind=ring) around x"""
    X, Y = grid(JW, JH)
    r = 3 + k * 2.5
    d = np.sqrt(((X - x) / r) ** 2 + ((Y - (SURF + 1)) / (r * 0.38)) ** 2)
    ring = np.abs(d - 1) < 0.3
    al["a3"][ring] = np.maximum(al["a3"][ring], max(40, 160 - k * 35))


def jump_frames():
    # path: leaves the water at x=37 heading up-left, lands at x=11
    xs0, xs1, top = 37.0, 11.0, 15.0
    out = []
    shadows = []
    for f in range(8):
        u = (f + 0.5) / 8
        x = xs0 + (xs1 - xs0) * u
        y = SURF + 4 - (SURF + 4 - top) * 4 * u * (1 - u)
        vx = xs1 - xs0
        vy = -(SURF + 4 - top) * 4 * (1 - 2 * u)
        # facing left: rotate so the nose follows the velocity
        ang = math.atan2(vy, vx) - math.pi
        ang = (ang + math.pi) % (2 * math.pi) - math.pi
        ang = max(-1.1, min(1.1, ang))
        im = blank(JW, JH)
        al = {"a3": np.zeros((JH, JW)), "wh": np.zeros((JH, JW)), "ol0": np.zeros((JH, JW))}
        # shadow on the water surface, smaller and fainter the higher Bug is
        h = SURF - y
        if h > 9:
            X, Y = grid(JW, JH)
            rx = max(3.0, 9 - h * 0.18)
            sh = (((X - x) / rx) ** 2 + ((Y - (SURF + 2)) / 1.8) ** 2) <= 1
            al["ol0"][sh] = max(30, 80 - h * 1.5)
        # rings where it left and where it lands
        if f <= 3:
            surface_bits(al, xs0 + 1, "ring", f)
        if f >= 6:
            surface_bits(al, xs1 - 1, "ring", f - 6)
        fx = fish(JW, JH, Pose(x, y, angle=ang, tail=math.sin(f * 1.6) * 1.2, ant=-1.2 * math.cos(u * math.pi),
                               legs=f % 2, mouth="o" if 2 <= f <= 5 else "smile"))
        a = np.array(fx)
        a[SURF + 1:] = 0          # anything below the surface is hidden by the water
        fx = Image.fromarray(a, "RGBA")
        im.alpha_composite(stack_alpha([(al["ol0"], "ol0"), (al["a3"], "a3"), (al["wh"], "wh")]))
        im.alpha_composite(fx)
        # droplets trailing behind (opaque water pixels), and the sheet of water as it leaves
        for k in range(4):
            back = 0.6 + k * 0.5
            dxp = x - vx * 0.035 * back * 3
            dyp = y - vy * 0.035 * back * 3 + k * 1.5 + (2 if f > 4 else 0)
            if f in (0, 1) or f >= 6 or k < 2:
                if 0 <= dyp < SURF:
                    put(im, int(dxp + (k % 2) * 3 - 1), int(dyp), C("a3" if k % 2 else "wh"))
        if f == 0:
            for dx_, dy_ in ((-3, -2), (3, -3), (-1, -5), (4, 0), (-4, 0)):
                put(im, int(xs0 + 1 + dx_), SURF + dy_, C("a3" if dy_ < -2 else "wh"))
        if f == 7:
            for dx_, dy_ in ((-4, -3), (3, -4), (0, -6), (5, -1), (-5, -1), (1, -2)):
                put(im, int(xs1 - 1 + dx_), SURF + dy_, C("wh" if dy_ < -3 else "a3"))
        out.append(clear_baked(im))
    return out


def splash_back():
    """48x32, surface at y = 24: crown, droplets falling, rings"""
    W, H, S = 48, 32, 24
    out = []
    X, Y = grid(W, H)
    for f in range(4):
        im = blank(W, H)
        r = 4 + f * 4
        d = np.sqrt(((X - 24) / r) ** 2 + ((Y - (S + 1)) / (r * 0.38)) ** 2)
        ring = np.abs(d - 1) < 0.28
        ring2 = np.abs(d * r / max(1, r - 5) - 1) < 0.3 if f >= 2 else np.zeros_like(ring)
        im.alpha_composite(stack_alpha([(np.where(ring, 170 - f * 35, 0), "a3"),
                                        (np.where(ring2, 110, 0), "wh")]))
        crown = [[(-2, -2), (2, -2), (0, -4), (-3, -1), (3, -1)],
                 [(-4, -5), (4, -5), (-1, -8), (1, -9), (-5, -2), (5, -2), (0, -3)],
                 [(-6, -4), (6, -4), (-2, -6), (2, -7), (0, -10), (-7, -1), (7, -1)],
                 [(-7, -1), (7, -1), (0, -4), (-3, 0), (3, 0)]][f]
        for i, (dx, dy) in enumerate(crown):
            put(im, 24 + dx, S + dy, C("wh" if (i + f) % 3 == 0 else "a3"))
            if f == 1 and dy < -3:
                put(im, 24 + dx, S + dy + 1, C("a2"))
        out.append(im)
    return out


def wink_pop():
    """32x32, surface at y = 26: Bug pops up, winks, a sparkle and a tiny heart, ducks back"""
    W, H, S = 32, 32, 26
    poses = [(S + 4, 0, False), (S - 4, 0, False), (S - 5, 0, True), (S - 3, 0, False)]
    out = []
    X, Y = grid(W, H)
    for f, (cy, bl, wk) in enumerate(poses):
        im = blank(W, H)
        r = 6 + f * 2
        d = np.sqrt(((X - 15) / r) ** 2 + ((Y - (S + 1)) / (r * 0.35)) ** 2)
        ring = np.abs(d - 1) < 0.3
        im.alpha_composite(stack_alpha([(np.where(ring, 150 - f * 25, 0), "a3")]))
        fx = fish(W, H, Pose(15, cy, angle=-0.35 if f else -0.5, wink=wk, ant=1.0 if wk else 0.0,
                             mouth="smile"))
        a = np.array(fx)
        a[S + 1:] = 0
        im.alpha_composite(Image.fromarray(a, "RGBA"))
        if f >= 2:
            # sparkle by the winking eye + heart
            sx, sy = (5, 6) if f == 2 else (4, 4)
            put(im, sx, sy, C("wh"))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                put(im, sx + dx, sy + dy, C("y2"))
            if f == 2:
                for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
                    put(im, sx + dx, sy + dy, C("y1"))
            hx, hy = (24, 5) if f == 2 else (25, 2)
            for dx, dy in ((0, 0), (2, 0), (-1, 1), (0, 1), (1, 1), (2, 1), (3, 1), (0, 2), (1, 2), (2, 2),
                           (1, 3)):
                put(im, hx + dx, hy + dy, C("k1" if (dx, dy) != (0, 1) else "wh"))
            put(im, hx - 1, hy + 1, C("k0"))
            put(im, hx + 3, hy + 1, C("k0"))
        if f in (0, 1):
            for dx, dy in ((-6, -1), (6, -2), (-3, -4), (4, -5)):
                put(im, 15 + dx, S + dy - (2 if f == 1 else 0), C("a3" if dy < -3 else "wh"))
        out.append(im)
    return out


# ---------------------------------------------------------------- tiny (16x10) for the shallow shore
def tiny_frame(f):
    W, H = 16, 10
    im = blank(W, H)
    bob = [0, 0, 1, 1][f]
    wag = [0, 1, 0, -1][f]
    cy = 5 + bob
    X, Y = grid(W, H)
    body = (((X - 7) / 4.6) ** 2 + ((Y - cy) / 3.3) ** 2) <= 1
    shell = body & ((((X - 8) / 4.0) ** 2 + ((Y - (cy - 1.4)) / 2.4) ** 2) <= 1) & (X > 5)
    tail = m_poly(W, H, [(10.5, cy - 0.5), (15, cy - 3 + wag), (15, cy + 3 + wag), (10.5, cy + 1)])
    arr = render_parts([Part("tail", tail, FIN, 1, band=0), Part("body", body, BODY, 2, band=0),
                        Part("shell", shell, SHELL, 3, band=0)], W, H)
    im = Image.fromarray(arr, "RGBA")
    put(im, 9, cy - 2, C("y1"))
    put(im, 7, cy - 2, C("y1") if f % 2 else C("g2"))
    # eye
    put(im, 4, cy - 1, C("wh"))
    put(im, 3, cy - 1, C("ol0"))
    # antennae
    put(im, 4, cy - 3, C("ol1"))
    put(im, 3, cy - 4, C("y1"))
    put(im, 6, cy - 3, C("ol1"))
    put(im, 6 - (f % 2), cy - 4, C("y1"))
    # legs
    for x in (5, 7, 9):
        put(im, x + ((x + f) % 2), cy + 3, C("h2"))
    return im


def tiny_rows():
    left = [tiny_frame(f) for f in range(4)]
    return left, [flip(f) for f in left]


def all_rows():
    sl = swim_left()
    return {
        "swim_left": sl,
        "swim_right": [flip(f) for f in sl],
        "blink": blink(),
        "jump": jump_frames(),
        "splash": splash_back(),
        "wink": wink_pop(),
    }
