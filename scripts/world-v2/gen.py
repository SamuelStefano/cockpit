#!/usr/bin/env python3
"""Original pixel-art generator: 32px cozy plaza tileset + chibi bot "Nami, pixel artist".

Deterministic. Run: python3 gen.py  -> writes everything into ./out/
Everything here is drawn procedurally from the palette below; nothing is copied.
"""
import json
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
OLD = "/home/samuel/cockpit/public/world"

# ---------------------------------------------------------------- palette
PALETTE = {
    # dark outline tones
    "ol0": "#2a1d2e", "ol1": "#4a3045",
    # skin
    "s0": "#a0565a", "s1": "#ee9a80", "s2": "#ffc9a0", "s3": "#ffe6cc",
    # hair (chestnut)
    "h0": "#4a1f2a", "h1": "#7d3324", "h2": "#b8562e", "h3": "#e88a4a",
    # signature shirt (green #3fd17f family) - the tint ramp
    "g0": "#156a4e", "g1": "#23a067", "g2": "#3fd17f", "g3": "#a8f0b8",
    # pants
    "p0": "#262e5a", "p1": "#3d4a85", "p2": "#5a6cb0",
    # wood
    "w0": "#52321f", "w1": "#7f4f2c", "w2": "#b0743f", "w3": "#d9a066",
    # stone / plaza
    "t0": "#76604f", "t1": "#a3836a", "t2": "#c9a982", "t3": "#e3cba6", "t4": "#f6e7cf",
    # grass + foliage
    "q0": "#1f4a35", "q1": "#2f6e35", "q2": "#4c9a3c", "q3": "#72c048", "q4": "#a6dd5a", "q5": "#e0f58a",
    # water
    "a0": "#2b4a8a", "a1": "#3a78c8", "a2": "#5fb4e8", "a3": "#a8e4f5",
    # warm light / yellow accent
    "y0": "#f0a830", "y1": "#ffd166", "y2": "#fff4b0",
    # accent red
    "r0": "#a02b3a", "r1": "#e04848", "r2": "#ff8a7a",
    # white
    "wh": "#ffffff",
    # metal
    "m0": "#2e3048", "m1": "#474b6b", "m2": "#6b7192",
    # pink accent (flowers, blush)
    "k0": "#c46aa8", "k1": "#f6a5d0",
}
assert len(PALETTE) <= 48, len(PALETTE)
assert len(set(PALETTE.values())) == len(PALETTE)


def rgb(name):
    h = PALETTE[name]
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))


def C(name, a=255):
    return rgb(name) + (a,)


RAMPS = {
    "skin": ["s0", "s1", "s2", "s3"],
    "hair": ["h0", "h1", "h2", "h3"],
    "shirt": ["g0", "g1", "g2", "g3"],
    "pants": ["p0", "p1", "p2", "p2"],
    "shoe": ["w0", "w0", "w1", "w2"],
    "wood": ["w0", "w1", "w2", "w3"],
    "beret": ["r0", "r0", "r1", "r2"],
    "crate": ["w0", "w1", "w2", "w3"],
}
SHADOW = rgb("ol0")


# ---------------------------------------------------------------- raster helpers
def grid(w, h):
    ys, xs = np.mgrid[0:h, 0:w]
    return xs + 0.5, ys + 0.5


def m_ellipse(w, h, cx, cy, rx, ry):
    X, Y = grid(w, h)
    return ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 <= 1.0


def m_ellipse_rot(w, h, cx, cy, rx, ry, ang):
    X, Y = grid(w, h)
    c, sn = math.cos(ang), math.sin(ang)
    u = (X - cx) * c + (Y - cy) * sn
    v = -(X - cx) * sn + (Y - cy) * c
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1.0


def m_rect(w, h, x0, y0, x1, y1):
    """inclusive pixel rect"""
    m = np.zeros((h, w), bool)
    x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
    m[max(0, y0):max(0, y1 + 1), max(0, x0):max(0, x1 + 1)] = True
    return m


def m_rrect(w, h, x0, y0, x1, y1, r):
    """inclusive pixel rect with rounded corners (pixel-cut corners)"""
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
    if L2 == 0:
        t = np.zeros_like(X)
    else:
        t = np.clip(((X - ax) * dx + (Y - ay) * dy) / L2, 0, 1)
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
    out[ys0:ys1, xs0:xs1] = m[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx]
    return out


def put(img, x, y, col):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((int(x), int(y)), col)


def alpha_over(dst, src):
    dst.alpha_composite(src)
    return dst


# ---------------------------------------------------------------- part renderer
class Part:
    def __init__(self, name, mask, ramp, z, outline=True, band=1, light=True, cast=0,
                 casts=False, inner=True, out_idx=0, colors=None, shirt=False, light_band=1):
        self.name, self.mask, self.ramp, self.z = name, mask, ramp, z
        self.outline, self.band, self.light = outline, band, light
        self.cast, self.casts, self.inner, self.out_idx = cast, casts, inner, out_idx
        self.colors, self.shirt, self.light_band = colors, shirt, light_band


def render_parts(parts, w, h):
    """Compose parts into an RGBA image with selective outlines + 4-step directional shading.
    Returns (image, label array, ordered parts)."""
    order = sorted([p for p in parts if p.mask.any()], key=lambda p: p.z)
    lab = np.full((h, w), -1, int)
    for i, p in enumerate(order):
        lab[p.mask] = i
    img = np.zeros((h, w, 4), np.uint8)
    empty = lab == -1
    dirs = ((1, 0), (-1, 0), (0, 1), (0, -1))
    for i, p in enumerate(order):
        vis = lab == i
        if not vis.any():
            continue
        if p.colors is not None:
            img[vis] = p.colors[vis]
            continue
        M = p.mask
        ys, xs = np.nonzero(M)
        cx, cy = xs.mean() + 0.5, ys.mean() + 0.5
        X, Y = grid(w, h)
        diag = (X - cx) + (Y - cy)
        idx = np.full((h, w), 2, int)
        # shadow band: bottom / right
        dark = np.zeros((h, w), bool)
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
        # cast shadows from parts in front, directly above
        if p.cast:
            cs = np.zeros((h, w), bool)
            for k in range(1, p.cast + 1):
                nb = shift(lab, 0, -k, fill=-1)
                for j in range(i + 1, len(order)):
                    if order[j].casts:
                        cs |= nb == j
            idx[cs] = np.maximum(1, idx[cs] - 1)
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
        sel = vis
        img[sel, :3] = cols[idx[sel]]
        img[sel, 3] = 255
    return img, lab, order


# ---------------------------------------------------------------- the bot
FW, FH = 32, 48
GROUND = 46            # feet sit on this row
DIRS = ["left", "down", "up", "right"]


def pose(**kw):
    base = dict(dy=0, sq=0, head_dy=0, look=0, eyes="open", mouth="smile",
                arm_l=("side", 0), arm_r=("side", 0), legs=("stand", 0), prop="brush",
                seat=0, zz=0, crate=False)
    base.update(kw)
    return base


def anim_poses():
    """Pose parameters per animation frame (shared by all directions)."""
    A = {}
    A["idle"] = [pose(), pose(), pose(head_dy=1, sq=1), pose(head_dy=1, sq=1, eyes="blink")]
    walk = []
    # (body dy, squash, left-leg phase sign, lift)
    seq = [(0, 0, 1), (1, 1, 1), (-1, -1, 0), (0, 0, -1), (1, 1, -1), (-1, -1, 2)]
    for k, (dy, sq, ph) in enumerate(seq):
        walk.append(pose(dy=dy, sq=sq, legs=("walk", k), arm_l=("swing", -1 if k < 3 else 1),
                         arm_r=("swing", 1 if k < 3 else -1)))
    A["walk"] = walk
    A["sit"] = [pose(seat=1), pose(seat=1, head_dy=1)]
    A["type"] = [pose(seat=1, look=1, head_dy=1, prop=None, arm_l=("type", 0), arm_r=("type", 1)),
                 pose(seat=1, look=1, head_dy=1, prop=None, arm_l=("type", 1), arm_r=("type", 0)),
                 pose(seat=1, look=1, head_dy=1, prop=None, arm_l=("type", 0), arm_r=("type", 0), eyes="blink"),
                 pose(seat=1, look=1, head_dy=1, prop=None, arm_l=("type", 1), arm_r=("type", 1))]
    A["talk"] = [pose(mouth="open", arm_r=("gesture", 0)), pose(mouth="smile", arm_r=("gesture", 1))]
    A["celebrate"] = [
        pose(dy=2, sq=2, legs=("crouch", 0), arm_l=("out", 0), arm_r=("out", 0), eyes="happy", mouth="open"),
        pose(dy=-4, sq=-1, legs=("jump", 0), arm_l=("up", 0), arm_r=("up", 0), eyes="happy", mouth="big"),
        pose(dy=-10, sq=0, legs=("tuck", 0), arm_l=("up", 1), arm_r=("up", 1), eyes="happy", mouth="big"),
        pose(dy=-9, sq=0, legs=("tuck", 0), arm_l=("up", 1), arm_r=("up", 1), eyes="happy", mouth="big"),
        pose(dy=-4, sq=-1, legs=("jump", 0), arm_l=("up", 0), arm_r=("up", 0), eyes="happy", mouth="open"),
        pose(dy=1, sq=1, legs=("crouch", 0), arm_l=("out", 0), arm_r=("out", 0), eyes="happy", mouth="open"),
    ]
    carry = []
    for k, (dy, sq, ph) in enumerate(seq):
        carry.append(pose(dy=dy, sq=sq, legs=("walk", k), arm_l=("carry", 0), arm_r=("carry", 0),
                          prop=None, crate=True))
    A["carry"] = carry
    A["sleep"] = [pose(seat=1, look=2, head_dy=2, eyes="closed", mouth="sleep", prop=None,
                       arm_l=("slump", 0), arm_r=("slump", 0)),
                  pose(seat=1, look=2, head_dy=3, sq=1, eyes="closed", mouth="sleep", prop=None,
                       arm_l=("slump", 0), arm_r=("slump", 0), zz=1)]
    return A


ANIMS = ["idle", "walk", "sit", "type", "talk", "celebrate", "carry", "sleep"]
FPS = {"idle": 4, "walk": 10, "sit": 2, "type": 8, "talk": 6, "celebrate": 10, "carry": 10, "sleep": 2}


def walk_feet(k):
    """foot offsets for walk frame k: returns (front/back of left foot, right foot), lift per foot.
    stride: +1 = forward, -1 = back, 0 = under body. lift: pixels up."""
    table = [((1, 0), (-1, 0)), ((1, 0), (-1, 0)), ((0, 0), (0, 2)),
             ((-1, 0), (1, 0)), ((-1, 0), (1, 0)), ((0, 2), (0, 0))]
    return table[k]


def build_bot(d, P):
    """Builds the part list for direction d ('left','down','up') and pose P.
    Returns (parts, overlay_fn, info)."""
    W, H = FW, FH
    parts = []
    sq = P["sq"]
    seat = P["seat"]
    dy = P["dy"] + seat * 2
    # vertical landmarks (before offsets)
    hip = 41 + dy                      # bottom of torso
    torso_top = 32 + dy + max(0, sq) - min(0, sq) * 0 + (1 if sq >= 2 else 0)
    if sq < 0:
        torso_top -= 1
    head_cy = 23.5 + dy + P["head_dy"] + (1 if sq > 0 else 0) + (1 if sq >= 2 else 0) - (1 if sq < 0 else 0)
    widen = 1 if sq > 0 else (-1 if sq < 0 else 0)
    side = d == "left"

    # ---- legs + shoes
    legs, lk = P["legs"]
    if seat:
        if d == "down":
            parts.append(Part("thigh", m_rrect(W, H, 11, hip - 1, 20, hip + 1, 1), RAMPS["pants"], 2))
            for sx in (11, 17):
                parts.append(Part("shoe", m_rrect(W, H, sx, hip + 1, sx + 3, hip + 3, 1), RAMPS["shoe"], 2.5,
                                  light=False))
        elif d == "left":
            parts.append(Part("thigh", m_capsule(W, H, (19, hip + 0.5), (11, hip + 0.5), 2.0), RAMPS["pants"], 2))
            parts.append(Part("shin", m_capsule(W, H, (11, hip + 1), (11.5, hip + 2), 1.6), RAMPS["pants"], 1.9))
            parts.append(Part("shoe", m_rrect(W, H, 7, hip + 1, 12, hip + 3, 1), RAMPS["shoe"], 2.5, light=False))
        else:
            for sx in (11, 17):
                parts.append(Part("shoe", m_rrect(W, H, sx, hip + 1, sx + 3, hip + 3, 1), RAMPS["shoe"], 0.5,
                                  light=False))
    else:
        if legs == "walk":
            fl, fr = walk_feet(lk)
        elif legs == "tuck":
            fl, fr = (0, 3), (0, 3)
        elif legs == "jump":
            fl, fr = (0, 1), (0, 1)
        else:
            fl, fr = (0, 0), (0, 0)
        crouch = legs == "crouch"
        foot_base = GROUND + P["dy"] if legs in ("tuck", "jump") else GROUND
        if d in ("down", "up"):
            for (stride, lift), lx in ((fl, 12), (fr, 17)):
                # down view: forward foot is lower (toward camera); up view: inverse
                s = stride if d == "down" else -stride
                fb = foot_base - lift + (0 if s >= 0 else -1)
                top = hip - 1
                parts.append(Part("leg", m_rect(W, H, lx, top, lx + 2, fb - 2), RAMPS["pants"], 1, light=False))
                sx0 = lx - 1 if lx < 16 else lx
                if crouch:
                    sx0 += -1 if lx < 16 else 1
                parts.append(Part("shoe", m_rrect(W, H, sx0, fb - 2, sx0 + 3, fb, 1), RAMPS["shoe"],
                                  1.5 + (0.1 if s > 0 else 0), light=False))
        else:  # side view, facing left
            for (stride, lift), far in ((fr, True), (fl, False)):
                fx = 16 - stride * 3
                fb = foot_base - lift
                z = 0.6 if far else 1.6
                hipx = 16.5
                parts.append(Part("leg", m_capsule(W, H, (hipx, hip), (fx + 0.5, fb - 2), 1.5),
                                  RAMPS["pants"], z, light=False))
                parts.append(Part("shoe", m_rrect(W, H, fx - 2, fb - 2, fx + 1, fb, 1), RAMPS["shoe"], z + 0.1,
                                  light=False))

    # ---- torso (shirt)
    if d in ("down", "up"):
        tx0, tx1 = 10 - widen, 21 + widen
        torso = m_rrect(W, H, tx0, torso_top, tx1, hip, 2)
        # pants band at bottom of torso
        pants = m_rrect(W, H, tx0 + 1, hip - 2, tx1 - 1, hip + 1, 1)
    else:
        tx0, tx1 = 12 - widen, 20 + widen
        torso = m_rrect(W, H, tx0, torso_top, tx1, hip, 2)
        pants = m_rrect(W, H, tx0 + 1, hip - 2, tx1 - 1, hip + 1, 1)
    parts.append(Part("pants", pants, RAMPS["pants"], 2.8, light=False))
    parts.append(Part("torso", torso & ~m_rect(W, H, 0, hip, W, H), RAMPS["shirt"], 3, band=1, shirt=True,
                      cast=2))

    # ---- arms
    sh_y = torso_top + 1.5
    hand_pts = {}

    def arm(name, shoulder, hand, z, sleeve=True):
        parts.append(Part(name + "_arm", m_capsule(W, H, shoulder, hand, 1.45), RAMPS["skin"], z, light=False,
                          band=0))
        sx = shoulder[0] + (hand[0] - shoulder[0]) * 0.45
        sy = shoulder[1] + (hand[1] - shoulder[1]) * 0.45
        if sleeve:
            parts.append(Part(name + "_sleeve", m_capsule(W, H, shoulder, (sx, sy), 1.75), RAMPS["shirt"], z + 0.01,
                              shirt=True, light=False))
        parts.append(Part(name + "_hand", m_ellipse(W, H, hand[0], hand[1], 1.7, 1.6), RAMPS["skin"], z + 0.02,
                          light=False, band=0, out_idx=1))
        hand_pts[name] = hand

    def arm_target(kind, k, sidex, front_sign):
        """sidex: shoulder x; front_sign: -1 for left side of screen."""
        hx = sidex + front_sign * 1.0
        if kind == "side":
            return (hx, sh_y + 6)
        if kind == "swing":
            return (hx - front_sign * 0.0, sh_y + 6 + (k * 1))
        if kind == "out":
            return (sidex + front_sign * 3.5, sh_y + 4.5)
        if kind == "up":
            return (sidex + front_sign * (5.5 + k * 0.5), sh_y - 9 - k)
        if kind == "type":
            return (sidex - front_sign * 3.5, sh_y + 5 - k)
        if kind == "carry":
            return (sidex - front_sign * 1.0, sh_y + 3)
        if kind == "gesture":
            return (sidex + front_sign * 3.0, sh_y + 2 - k)
        if kind == "slump":
            return (sidex - front_sign * 0.5, sh_y + 7)
        return (hx, sh_y + 6)

    if d in ("down", "up"):
        lsx, rsx = tx0 + 0.5, tx1 + 0.5
        # in "down" the character's right hand is on screen-left
        kl, kr = P["arm_r"], P["arm_l"]
        if d == "up":
            kl, kr = P["arm_l"], P["arm_r"]
        for nm, (kind, k), sx, sgn in (("L", kl, lsx, -1), ("R", kr, rsx, 1)):
            if kind == "swing" and d == "up":
                k = -k
            hp = arm_target(kind, k, sx, sgn)
            zz = 4 if d == "down" else 4
            if kind in ("type", "carry") and d == "up":
                zz = 2.9
            arm(nm, (sx, sh_y), hp, zz)
        info_brush_hand = "L" if d == "down" else "R"
    else:
        shx = 16.5
        near = P["arm_r"]
        far = P["arm_l"]
        for nm, (kind, k), z in (("F", far, 2.5), ("N", near, 6.5 if near[0] == "up" else 4)):
            if kind == "swing":
                hp = (shx - k * 3.0 * (1 if nm == "N" else -1), sh_y + 5.5)
            elif kind == "side":
                hp = (shx - 0.5, sh_y + 6)
            elif kind == "up":
                hp = (shx + 6.5 + k * 0.5, sh_y - 15 - k)
            elif kind == "out":
                hp = (shx - 4, sh_y + 4)
            elif kind == "type":
                hp = (shx - 6.5, sh_y + 4 - k)
            elif kind == "carry":
                hp = (shx - 6, sh_y + 3)
            elif kind == "gesture":
                hp = (shx - 5, sh_y + 1 - k)
            elif kind == "slump":
                hp = (shx - 2, sh_y + 7)
            else:
                hp = (shx, sh_y + 6)
            if nm == "F":
                hp = (hp[0] + 1, hp[1]) if kind != "up" else (hp[0] - 3, hp[1] - 2)
            arm(nm, (shx, sh_y), hp, z)
        info_brush_hand = "N"

    # ---- head
    hcx = 16.0 if d != "left" else 15.5
    head = m_ellipse(W, H, hcx, head_cy, 10.6, 9.2)
    parts.append(Part("head", head, RAMPS["skin"], 5, band=1, light=False, cast=1, casts=True))
    # ---- hair
    hair = build_hair(d, hcx, head_cy, P["look"])
    parts.append(Part("hair", hair, RAMPS["hair"], 6, band=1, casts=True, light=True))
    # ---- beret
    by = head_cy - 8.2
    if d == "left":
        bx, ang = 18.0, 0.22
    elif d == "down":
        bx, ang = 18.5, 0.20
    else:
        bx, ang = 13.5, -0.20
    beret = m_ellipse_rot(W, H, bx, by, 8.2, 3.9, ang)
    beret &= ~m_ellipse(W, H, hcx, head_cy - 1.5, 9.6, 6.2) | m_ellipse(W, H, bx, by - 1.2, 8.2, 3.0)
    nub = m_rect(W, H, int(bx), int(by - 4.8), int(bx) + 1, int(by - 3.5))
    parts.append(Part("beret", beret | nub, RAMPS["beret"], 7, band=0, casts=True))

    # ---- crate
    if P["crate"]:
        if d == "down":
            cr = m_rrect(W, H, 10, int(sh_y) + 0, 21, int(sh_y) + 8, 1)
            cz = 4.5
        elif d == "left":
            cr = m_rrect(W, H, 4, int(sh_y) - 1, 13, int(sh_y) + 7, 1)
            cz = 3.5
        else:
            top = int(head_cy - 16)
            cr = m_rrect(W, H, 9, top, 22, top + 9, 1)
            cz = 4.9
        parts.append(Part("crate", cr, RAMPS["crate"], cz, band=1, light=True))
        # hands in front of the crate
        if d != "up":
            for p in parts:
                if p.name.endswith("_hand") and not p.name.startswith("F"):
                    p.z = cz + 0.5

    info = dict(d=d, head_cy=head_cy, hcx=hcx, hand_pts=hand_pts, brush_hand=info_brush_hand, P=P,
                sh_y=sh_y, crate=P["crate"])
    return parts, info


def build_hair(d, hcx, cy, look):
    W, H = FW, FH
    cap = m_ellipse(W, H, hcx, cy - 0.6, 11.4, 9.6)
    X, Y = grid(W, H)
    xs = np.arange(W)
    if d == "down":
        # bangs line per column (pixel row where hair stops), hand tuned for a soft bob
        rel = xs - 16
        line = np.full(W, -99.0)
        for x in range(W):
            r = x + 0.5 - hcx
            a = abs(r)
            if a > 8.6:
                line[x] = cy + 6.5          # side locks
            elif a > 7.0:
                line[x] = cy + 2.5
            else:
                # wavy fringe: three scallops
                line[x] = cy - 3.0 + (1.0 if (int(math.floor(r + 0.5)) % 5) in (0,) else 0) + 0.0
        line += look
        hair = cap & (Y < line[None, :].repeat(H, 0) + 0.0)
        # side locks follow head width
        return hair
    if d == "up":
        back = cap & (Y < cy + 6.5)
        return back
    # left: hair covers back of head; face on the left side
    line = np.zeros(W)
    for x in range(W):
        r = x + 0.5 - hcx
        if r < -6.5:
            line[x] = cy - 3.0
        elif r < -2.5:
            line[x] = cy - 2.0
        elif r < 1.5:
            line[x] = cy - 1.0
        elif r < 3.5:
            line[x] = cy + 1.0
        else:
            line[x] = cy + 6.5
    line += look
    hair = cap & (Y < line[None, :].repeat(H, 0))
    hair |= cap & (X > hcx + 3.5) & (Y < cy + 6.5)
    return hair


EYE_DOWN = ["sKKs", "KWWK", "KWKK", "KBBK", "sKKs"]
EYE_SIDE = ["sKK", "KWW", "KWK", "KBK", "sKK"]
EYE_SHUT = {"blink": [(0, 3), (1, 3), (2, 3), (3, 3)],
            "closed": [(0, 2), (1, 3), (2, 3), (3, 2)],
            "happy": [(0, 3), (1, 2), (2, 2), (3, 3)]}


def draw_face(img, d, info):
    """Overlay eyes, mouth, blush (pixel-precise)."""
    if d == "up":
        return
    P = info["P"]
    cy = info["head_cy"]
    ey = int(math.floor(cy)) + P["look"]
    eyes = P["eyes"]
    K = C("ol0")
    cols = {"K": K, "W": C("wh"), "B": C("a1"), "s": C("s1")}
    BL = C("k1")
    S = C("s0")

    def eye(x, y, pat, w):
        if eyes == "open":
            for yy, row in enumerate(pat):
                for xx, ch in enumerate(row):
                    put(img, x + xx, y + yy, cols[ch])
        else:
            for xx, yy in EYE_SHUT[eyes]:
                if xx < w:
                    put(img, x + xx, y + yy, K)

    mouth = P["mouth"]
    if d == "down":
        eye(9, ey, EYE_DOWN, 4)
        eye(19, ey, EYE_DOWN, 4)
        for bx in (7, 8, 23, 24):
            put(img, bx, ey + 5, BL)
        mx, my = 15, ey + 6
    else:
        eye(7, ey, EYE_SIDE, 3)
        for bx in (8, 9):
            put(img, bx, ey + 5, BL)
        mx, my = 7, ey + 6
    if mouth == "smile" and d == "left":
        put(img, mx, my, S)
    elif mouth == "smile":
        put(img, mx, my, S)
        put(img, mx + 1, my, S)
        if d == "down":
            put(img, mx - 1, my - 1, S)
            put(img, mx + 2, my - 1, S)
    elif mouth in ("open", "big") and d == "left":
        put(img, mx, my, K)
        put(img, mx + 1, my, K)
        put(img, mx, my + 1, C("r1"))
        if mouth == "big":
            put(img, mx + 1, my + 1, K)
            put(img, mx, my + 2, K)
    elif mouth == "open":
        put(img, mx, my, K)
        put(img, mx + 1, my, K)
        put(img, mx, my + 1, C("r1"))
        put(img, mx + 1, my + 1, C("r0"))
    elif mouth == "big":
        for xx in range(4):
            put(img, mx - 1 + xx, my, K)
        put(img, mx, my + 1, C("r1"))
        put(img, mx + 1, my + 1, C("r1"))
        put(img, mx - 1, my + 1, K) if d == "down" else None
        put(img, mx + 2, my + 1, K) if d == "down" else None
        put(img, mx, my + 2, K)
        put(img, mx + 1, my + 2, K)
    elif mouth == "sleep":
        put(img, mx, my, S)


def hair_shine(img, info, lab, order):
    """Glossy arc on the hair (upper-left), plus strands on the back view."""
    names = [p.name for p in order]
    if "hair" not in names:
        return
    hi = names.index("hair")
    a = np.array(img)
    vis = lab == hi
    base = np.all(a[..., :3] == rgb("h2"), axis=-1) & vis
    X, Y = grid(FW, FH)
    cx, cy = info["hcx"] + 1.5, info["head_cy"] + 1.0
    dist = np.hypot(X - cx, Y - cy)
    ang = np.degrees(np.arctan2(Y - cy, X - cx))
    arc = (dist > 7.3) & (dist < 8.5) & (ang > -150) & (ang < -95)
    arc2 = (dist > 7.3) & (dist < 8.5) & (ang > -85) & (ang < -70)
    sel = base & (arc | arc2)
    a[sel, :3] = rgb("h3")
    if info["d"] == "up":
        # strands
        for x0, y0, ln in ((12, 3, 3), (17, 2, 4), (21, 4, 2)):
            for k in range(ln):
                x, y = x0, int(info["head_cy"]) + y0 - 1 + k
                if vis[y, x] and np.all(a[y, x, :3] == rgb("h2")):
                    a[y, x, :3] = rgb("h1")
    img.paste(Image.fromarray(a, "RGBA"))


def draw_brush(img, info):
    hp = info["hand_pts"].get(info["brush_hand"])
    if hp is None:
        return
    d = info["d"]
    hx, hy = int(math.floor(hp[0])), int(math.floor(hp[1]))
    # handle goes up and outward from the fist, bristles on top
    if d == "down":
        pts = [(hx - 1, hy - 1, "w1"), (hx - 2, hy - 2, "w2"), (hx - 2, hy - 3, "w2"), (hx - 3, hy - 4, "m2"),
               (hx - 3, hy - 5, "a1"), (hx - 4, hy - 6, "a2")]
    elif d == "left" and info["P"]["arm_r"][0] == "up":
        pts = [(hx + 1, hy - 1, "w1"), (hx + 2, hy - 2, "w2"), (hx + 2, hy - 3, "w2"), (hx + 3, hy - 4, "m2"),
               (hx + 3, hy - 5, "a1"), (hx + 4, hy - 6, "a2")]
    elif d == "left":
        pts = [(hx - 2, hy, "w1"), (hx - 3, hy, "w2"), (hx - 4, hy - 1, "w2"), (hx - 5, hy - 1, "m2"),
               (hx - 6, hy - 1, "a1"), (hx - 7, hy - 2, "a2")]
    else:
        pts = [(hx + 1, hy - 1, "w1"), (hx + 2, hy - 2, "w2"), (hx + 2, hy - 3, "w2"), (hx + 3, hy - 4, "m2"),
               (hx + 3, hy - 5, "a1"), (hx + 4, hy - 6, "a2")]
    for x, y, c in pts:
        put(img, x, y, C(c))
    # dark edge on the outer side of the handle
    sgn = 1 if pts[1][0] < pts[0][0] or d == "down" else -1
    for x, y, c in pts[:3]:
        if 0 <= x + sgn < FW and img.getpixel((x + sgn, y))[3] == 0:
            put(img, x + sgn, y, C("w0"))


def draw_crate_detail(img, info, lab, order):
    """planks on the crate"""
    names = [p.name for p in order]
    if "crate" not in names:
        return
    ci = names.index("crate")
    vis = lab == ci
    ys, xs = np.nonzero(vis)
    if len(xs) == 0:
        return
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    mid = (y0 + y1) // 2
    for x in range(x0 + 1, x1):
        if vis[mid, x]:
            put(img, x, mid, C("w1"))
    for y in range(y0 + 1, y1):
        for x in (x0 + 2, x1 - 2):
            if vis[y, x] and y != mid:
                put(img, x, y, C("w1"))


def draw_zz(img, info):
    if not info["P"]["zz"]:
        return
    z = ["XXX", "..X", ".X.", "XXX"]
    ox, oy = 24, int(info["head_cy"]) - 13
    for j, row in enumerate(z):
        for i, ch in enumerate(row):
            if ch == "X":
                put(img, ox + i, oy + j, C("a3"))
    put(img, ox - 2, oy + 5, C("a3"))


def shadow_layer(info):
    P = info["P"]
    lay = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    air = -min(0, P["dy"])
    rx = 8.5 - air * 0.35 + (1 if P["seat"] else 0)
    m = m_ellipse(FW, FH, 16, GROUND - 0.4, rx, 1.85)
    inner = m_ellipse(FW, FH, 16, GROUND - 0.4, rx - 2, 1.2)
    a = np.zeros((FH, FW), np.uint8)
    a[m] = 70 - air * 3
    a[inner] = 95 - air * 4
    arr = np.zeros((FH, FW, 4), np.uint8)
    arr[..., :3] = SHADOW
    arr[..., 3] = a
    return Image.fromarray(arr, "RGBA")


def render_bot(d, P, with_shadow=True, mirror=False):
    """returns (rgba frame, shirt mask L) for left/down/up"""
    parts, info = build_bot(d, P)
    arr, lab, order = render_parts(parts, FW, FH)
    img = Image.fromarray(arr, "RGBA")
    shirt = np.zeros((FH, FW), bool)
    for i, p in enumerate(order):
        if p.shirt:
            shirt |= lab == i
    hair_shine(img, info, lab, order)
    draw_face(img, d, info)
    draw_crate_detail(img, info, lab, order)
    if P["prop"] == "brush":
        draw_brush(img, info)
    if mirror:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
        shirt = shirt[:, ::-1]
    draw_zz(img, info)
    a = np.array(img)
    shirt &= a[..., 3] > 0
    # keep only pixels still in shirt colours
    sh_cols = np.array([rgb(c) for c in RAMPS["shirt"]])
    is_sh = np.zeros_like(shirt)
    for c in sh_cols:
        is_sh |= np.all(a[..., :3] == c, axis=-1)
    shirt &= is_sh
    if with_shadow:
        base = shadow_layer(info)
        base.alpha_composite(img)
        img = base
    return img, Image.fromarray((shirt * 255).astype(np.uint8), "L")


def bot_sheet():
    A = anim_poses()
    rows = []
    meta = {}
    r = 0
    for an in ANIMS:
        frames = A[an]
        meta[an] = {"rows": {}, "frames": len(frames), "fps": FPS[an]}
        for d in DIRS:
            row_imgs = []
            for P in frames:
                if d == "right":
                    im, mk = render_bot("left", P, mirror=True)
                else:
                    im, mk = render_bot(d, P)
                row_imgs.append((im, mk))
            rows.append((an, d, row_imgs))
            meta[an]["rows"][d] = r
            r += 1
    maxf = max(len(x[2]) for x in rows)
    sheet = Image.new("RGBA", (maxf * FW, len(rows) * FH), (0, 0, 0, 0))
    mask = Image.new("L", sheet.size, 0)
    for ri, (an, d, fr) in enumerate(rows):
        for fi, (im, mk) in enumerate(fr):
            sheet.alpha_composite(im, (fi * FW, ri * FH))
            mask.paste(mk, (fi * FW, ri * FH))
    return sheet, mask, meta, rows




# ================================================================ tiles
T = 32
TR = {  # ramps for tiles: [outline, shadow, base, light, (highlight)]
    "leaf": ["q0", "q1", "q2", "q3", "q4"],
    "hedge": ["q0", "q1", "q2", "q3", "q4"],
    "trunk": ["w0", "w1", "w2", "w3"],
    "stone": ["t0", "t1", "t2", "t3", "t4"],
    "metal": ["m0", "m0", "m1", "m2"],
    "wood": ["w0", "w1", "w2", "w3"],
    "red": ["r0", "r0", "r1", "r2"],
    "water": ["a0", "a1", "a2", "a3"],
    "soil": ["w0", "w0", "w1", "w1"],
}


def shape_img(w, h, parts):
    arr, lab, order = render_parts(parts, w, h)
    return Image.fromarray(arr, "RGBA")


def soft_ellipse(w, h, cx, cy, rx, ry, color, alpha, feather=0.35):
    """soft alpha blob (for shadows / light): alpha falls off in 3 quantised steps"""
    X, Y = grid(w, h)
    d = np.sqrt(((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2)
    a = np.zeros((h, w))
    a[d <= 1.0] = alpha * 0.45
    a[d <= 1.0 - feather * 0.5] = alpha * 0.75
    a[d <= 1.0 - feather] = alpha
    arr = np.zeros((h, w, 4), np.uint8)
    arr[..., :3] = color
    arr[..., 3] = a.astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def radial_glow(w, h, cx, cy, rx, ry, color, alpha, steps=5):
    X, Y = grid(w, h)
    d = np.sqrt(((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2)
    a = np.zeros((h, w))
    for k in range(steps):
        r = 1.0 - k / steps
        a[d <= r] = alpha * (k + 1) / steps
    arr = np.zeros((h, w, 4), np.uint8)
    arr[..., :3] = color
    arr[..., 3] = a.astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def fill(w, h, name):
    return Image.new("RGBA", (w, h), C(name))


# ---------------------------------------------------------------- floors
def tile_checker():
    im = fill(T, T, "t3")
    for qy in range(2):
        for qx in range(2):
            light = (qx + qy) % 2 == 0
            base = "t4" if light else "t3"
            x0, y0 = qx * 16, qy * 16
            for y in range(16):
                for x in range(16):
                    c = base
                    if x == 0 or y == 0:
                        c = "t2"                      # grout
                    elif x == 1 or y == 1:
                        c = "wh" if False else ("t4" if light else "t4")
                    elif x == 15 or y == 15:
                        c = "t3" if light else "t2"   # bevel shadow
                    put(im, x0 + x, y0 + y, C(c))
            # tiny wear marks
            if not light:
                put(im, x0 + 10, y0 + 6, C("t2"))
                put(im, x0 + 11, y0 + 6, C("t2"))
            else:
                put(im, x0 + 5, y0 + 11, C("t3"))
    return im


def tile_pavers(seed=3, cracks=True):
    rnd = random.Random(seed)
    im = fill(T, T, "t1")
    rows = [(0, 11, [0, 13, 22]), (11, 10, [6, 19, 28]), (21, 11, [3, 15, 25])]
    for y0, hgt, cuts in rows:
        cuts = sorted(cuts)
        segs = []
        for k in range(len(cuts)):
            a, b = cuts[k], cuts[(k + 1) % len(cuts)] + (32 if k == len(cuts) - 1 else 0)
            segs.append((a, b))
        for a, b in segs:
            shade = rnd.choice(["t3", "t3", "t2"])
            for y in range(y0 + 1, y0 + hgt):
                for x in range(a + 1, b):
                    xx = x % 32
                    c = shade
                    if y == y0 + 1 or x == a + 1:
                        c = "t4" if shade == "t3" else "t3"
                    if y == y0 + hgt - 1 or x == b - 1:
                        c = "t2" if shade == "t3" else "t1"
                    put(im, xx, y, C(c))
            # speckles
            for _ in range(2):
                sx = (rnd.randint(a + 3, max(a + 3, b - 3))) % 32
                sy = rnd.randint(y0 + 3, y0 + hgt - 3)
                put(im, sx, sy, C("t2"))
    if cracks:
        for (x, y) in ((8, 4), (9, 5), (9, 6), (10, 7), (24, 25), (25, 25), (26, 26)):
            put(im, x, y, C("t1"))
        put(im, 11, 7, C("t2"))
    return im


def tile_grass(variant):
    rnd = random.Random(10 + variant)
    im = fill(T, T, "q3")
    # broad soft patches (darker / lighter) keep big areas from looking flat
    for _ in range(2):
        cx, cy = rnd.randrange(6, 26), rnd.randrange(6, 26)
        c = "q2"
        for y in range(cy - 2, cy + 3):
            for x in range(cx - 4, cx + 5):
                if ((x - cx) / 4.5) ** 2 + ((y - cy) / 2.5) ** 2 <= 1 and rnd.random() < 0.55:
                    put(im, x % 32, y % 32, C(c))
    # soft mottling (2x2 clumps in q2 / q4)
    for _ in range(14):
        x, y = rnd.randrange(32), rnd.randrange(32)
        c = rnd.choice(["q2", "q4", "q2"])
        put(im, x, y, C(c))
        if c == "q2":
            put(im, (x + 1) % 32, y, C(c))
    # tufts: small V of darker green with light tips
    for _ in range(6 if variant == 0 else 4):
        x, y = rnd.randrange(2, 30), rnd.randrange(3, 30)
        put(im, x, y, C("q2"))
        put(im, x - 1, y - 1, C("q2"))
        put(im, x + 1, y - 1, C("q2"))
        put(im, x - 1, y - 2, C("q4"))
        put(im, x + 1, y - 2, C("q4"))
    flowers = {0: [], 1: [((8, 9), "wh"), ((22, 21), "y1"), ((25, 7), "wh")],
               2: [((6, 22), "k1"), ((14, 12), "wh"), ((24, 26), "r2"), ((26, 10), "y1"), ((10, 4), "k1")]}[variant]
    for (x, y), c in flowers:
        put(im, x, y + 2, C("q1"))           # stem shadow
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            put(im, x + dx, y + dy, C(c))
        put(im, x, y, C("y0" if c != "y1" else "y2"))
    return im


# ---------------------------------------------------------------- fountain
def fountain_frames():
    W = H = 96
    frames = []
    for f in range(4):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        im.alpha_composite(soft_ellipse(W, H, 48, 80, 46, 14, SHADOW, 70))
        # basin wall (front face) + rim
        outer = m_ellipse(W, H, 48, 54, 45, 28)
        wall = m_ellipse(W, H, 48, 62, 45, 28) | (outer & m_rect(W, H, 0, 54, W, H))
        wall &= ~outer | m_rect(W, H, 0, 54, W, H)
        parts = [Part("wall", wall | outer, TR["stone"], 1, band=2, light=False),
                 Part("rim", outer, TR["stone"], 2, band=1, light=True, light_band=1)]
        im.alpha_composite(shape_img(W, H, parts))
        a = np.array(im)
        # wall stones: vertical joints on the front face
        for x in range(8, 92, 9):
            for y in range(58, 88):
                if wall[y, x] and not outer[y, x] and not wall[min(H - 1, y + 1), x] is False:
                    if np.all(a[y, x, :3] != rgb("t0")):
                        a[y, x, :3] = rgb("t1")
        im = Image.fromarray(a, "RGBA")
        # rim top highlight band is lighter, water inside
        water = m_ellipse(W, H, 48, 53, 38, 21)
        wa = np.zeros((H, W, 4), np.uint8)
        wa[water] = C("a2")
        # deep water under the back rim
        back = water & ~m_ellipse(W, H, 48, 57, 38, 21)
        wa[back] = C("a1")
        back2 = water & ~m_ellipse(W, H, 48, 55, 38, 21)
        wa[back2] = C("a0")
        im.alpha_composite(Image.fromarray(wa, "RGBA"))
        # animated ripple rings around the pedestal
        X, Y = grid(W, H)
        for k in range(2):
            r = 10 + ((f * 4 + k * 8) % 16)
            ring = water & (np.abs(np.sqrt(((X - 48) / 1.0) ** 2 + ((Y - 56) / 0.55) ** 2) - r) < 0.7)
            ring &= ~m_ellipse(W, H, 48, 56, 9, 5)
            ra = np.zeros((H, W, 4), np.uint8)
            ra[ring] = C("a3", 200 if r < 20 else 120)
            im.alpha_composite(Image.fromarray(ra, "RGBA"))
        # pedestal + upper bowl
        ped = m_rrect(W, H, 43, 30, 52, 60, 1)
        foot = m_ellipse(W, H, 48, 59, 8, 3.5)
        bowl = m_ellipse(W, H, 48, 31, 14, 6) | m_ellipse(W, H, 48, 34, 11, 5)
        im.alpha_composite(shape_img(W, H, [
            Part("foot", foot, TR["stone"], 1, band=1),
            Part("ped", ped, TR["stone"], 2, band=1, light=True),
            Part("bowl", bowl, TR["stone"], 3, band=1, light=True)]))
        bw = m_ellipse(W, H, 48, 30, 11, 3.6)
        ba = np.zeros((H, W, 4), np.uint8)
        ba[bw] = C("a2")
        ba[bw & ~m_ellipse(W, H, 48, 31.5, 11, 3.6)] = C("a1")
        im.alpha_composite(Image.fromarray(ba, "RGBA"))
        # spout + water jet arcs
        for x, y in ((47, 24), (48, 24), (47, 25), (48, 25), (47, 26), (48, 26), (47, 27), (48, 27)):
            put(im, x, y, C("t3"))
        jet = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for side in (-1, 1):
            for t in range(0, 22):
                u = t / 21
                x = 48 + side * (2 + u * 12)
                y = 22 - 8 * math.sin(math.pi * u * 0.9) + u * 10
                c = "a3" if (t + f * 2) % 6 else "wh"
                put(jet, int(x) - (1 if side < 0 else 0), int(y), C(c, 230))
        for t in range(9):
            put(jet, 47, 22 - t, C("a3" if t % 3 else "wh", 230))
            put(jet, 48, 22 - t, C("a3", 200))
        # falling drops in the lower basin (animated)
        for k, (dx, ph) in enumerate(((-15, 0), (15, 2), (-9, 1), (9, 3))):
            yy = 38 + ((f + ph) % 4) * 3
            put(jet, 48 + dx, yy, C("a3", 230))
        im.alpha_composite(jet)
        # sparkles (frame dependent)
        sp = [[(30, 50), (66, 60)], [(58, 46), (36, 64)], [(70, 52), (26, 58)], [(40, 48), (62, 66)]][f]
        for (x, y) in sp:
            put(im, x, y, C("wh"))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                put(im, x + dx, y + dy, C("a3"))
        frames.append(im)
    return frames


# ---------------------------------------------------------------- props
def bench():
    W, H = 64, 32
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    im.alpha_composite(soft_ellipse(W, H, 32, 29, 30, 4, SHADOW, 70))
    parts = []
    for x in (6, 55):
        parts.append(Part("leg", m_rect(W, H, x, 16, x + 2, 29), TR["metal"], 1, light=False, band=0))
    parts.append(Part("back1", m_rrect(W, H, 3, 3, 60, 7, 1), TR["wood"], 2))
    parts.append(Part("back2", m_rrect(W, H, 3, 9, 60, 13, 1), TR["wood"], 2.1))
    parts.append(Part("post", m_rect(W, H, 8, 2, 10, 17) | m_rect(W, H, 53, 2, 55, 17), TR["metal"], 2.5, band=0))
    parts.append(Part("seat", m_rrect(W, H, 1, 16, 62, 22, 1), TR["wood"], 3, band=1))
    im.alpha_composite(shape_img(W, H, parts))
    # plank grain
    for x in range(14, 50, 11):
        put(im, x, 5, C("w1"))
        put(im, x + 4, 11, C("w1"))
        put(im, x + 2, 19, C("w1"))
    return im


def lamp():
    W, H = 32, 64
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    im.alpha_composite(soft_ellipse(W, H, 17, 60, 8, 3, SHADOW, 80))
    parts = [
        Part("base", m_rrect(W, H, 11, 54, 20, 61, 1), TR["metal"], 1),
        Part("pole", m_rect(W, H, 14, 18, 17, 56), TR["metal"], 2, band=0),
        Part("ring", m_rrect(W, H, 12, 17, 19, 19, 1), TR["metal"], 3, band=0),
        Part("cage", m_rrect(W, H, 10, 7, 21, 17, 1), TR["metal"], 3.5, band=0),
        Part("cap", m_poly(W, H, [(8, 7), (16, 1), (23, 7)]) | m_rect(W, H, 9, 6, 22, 7), TR["metal"], 4),
    ]
    im.alpha_composite(shape_img(W, H, parts))
    # glass panes (lit)
    for y in range(9, 16):
        for x in range(12, 20):
            if x in (15, 16):
                continue
            put(im, x, y, C("y1" if (y < 12 or x in (12, 17)) else "y0"))
    for y in range(9, 12):
        put(im, 12, y, C("y2"))
        put(im, 17, y, C("y2"))
    put(im, 15, 0, C("m1"))
    put(im, 16, 0, C("m1"))
    return im


def lamp_glow():
    W, H = 32, 64
    return radial_glow(W, H, 16, 12, 15, 13, rgb("y2"), 110)


def tree_layers():
    """returns (trunk_img, canopy_img) each 64x96; canopy drawn over characters for occlusion"""
    W, H = 64, 96
    trunk = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    trunk.alpha_composite(soft_ellipse(W, H, 33, 89, 22, 6, SHADOW, 85))
    tp = [Part("trunk", m_rrect(W, H, 27, 52, 37, 90, 2) | m_poly(W, H, [(22, 91), (27, 82), (37, 82), (42, 91)]),
               TR["trunk"], 1, band=1, light=True)]
    trunk.alpha_composite(shape_img(W, H, tp))
    for y in range(60, 88, 5):
        put(trunk, 31 + (y // 5) % 3, y, C("w1"))
        put(trunk, 31 + (y // 5) % 3, y + 1, C("w1"))
    canopy = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    blobs = [(32, 34, 26, 22), (16, 44, 13, 12), (48, 44, 13, 12), (32, 52, 20, 12),
             (22, 22, 12, 11), (42, 20, 13, 11), (32, 14, 12, 9)]
    m = np.zeros((H, W), bool)
    for cx, cy, rx, ry in blobs:
        m |= m_ellipse(W, H, cx, cy, rx, ry)
    canopy.alpha_composite(shape_img(W, H, [Part("canopy", m, TR["leaf"], 1, band=3, light=True, light_band=2)]))
    a = np.array(canopy)
    # inner clump lines: arcs of shadow to separate leaf clusters (layered look)
    X, Y = grid(W, H)
    for cx, cy, rx, ry, col in ((22, 22, 12, 11, "q1"), (42, 20, 13, 11, "q1"), (16, 44, 13, 12, "q1"),
                                (48, 44, 13, 12, "q1"), (32, 34, 26, 22, None)):
        if col is None:
            continue
        d = np.sqrt(((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2)
        arc = (np.abs(d - 1.0) < 0.07) & (Y > cy) & m
        inside = a[..., 3] > 0
        sel = arc & inside & ~np.all(a[..., :3] == rgb("q0"), axis=-1)
        a[sel, :3] = rgb(col)
    # highlight clusters on top-left of each clump
    for cx, cy, rx, ry in blobs:
        hl = m_ellipse(W, H, cx - rx * 0.35, cy - ry * 0.45, rx * 0.38, ry * 0.28) & m
        ok = hl & np.all(a[..., :3] == rgb("q2"), axis=-1)
        a[ok, :3] = rgb("q3")
        hl2 = m_ellipse(W, H, cx - rx * 0.4, cy - ry * 0.5, rx * 0.16, ry * 0.12) & m
        ok2 = hl2 & np.all(a[..., :3] == rgb("q3"), axis=-1)
        a[ok2, :3] = rgb("q4")
    # a couple of red fruits for charm
    for x, y in ((20, 40), (44, 30), (36, 50)):
        a[y, x, :3] = rgb("r1")
        a[y - 1, x, :3] = rgb("r2")
        a[y + 1, x, :3] = rgb("r0")
    canopy = Image.fromarray(a, "RGBA")
    return trunk, canopy


def flower_bed():
    W, H = 64, 32
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    im.alpha_composite(soft_ellipse(W, H, 32, 29, 31, 4, SHADOW, 70))
    leafm = np.zeros((H, W), bool)
    for k, x in enumerate(range(7, 60, 7)):
        leafm |= m_ellipse(W, H, x, 14 - (k % 2), 5.2, 5.0)
    leafm &= m_rect(W, H, 3, 0, 60, 19)
    im.alpha_composite(shape_img(W, H, [
        Part("leaves", leafm, TR["leaf"], 1, band=1, light=True),
        Part("box", m_rrect(W, H, 1, 17, 62, 29, 2), TR["stone"], 2, band=1, light=True)]))
    # box rim highlight + front joints
    for x in range(4, 60, 12):
        for y in range(21, 28):
            put(im, x, y, C("t1"))
    cols = ["r1", "y1", "k1", "wh", "r2", "k0", "y1", "r1"]
    dark = {"r1": "r0", "y1": "y0", "k1": "k0", "wh": "t3", "r2": "r1", "k0": "r0"}
    rnd = random.Random(7)
    spots = [(7, 11), (14, 15), (20, 9), (27, 13), (34, 10), (41, 15), (47, 9), (54, 12), (11, 6), (31, 6), (51, 6),
             (58, 15), (24, 17), (44, 17)]
    for k, (x, y) in enumerate(spots):
        c = cols[k % len(cols)]
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            put(im, x + dx, y + dy, C(c))
        put(im, x + 1, y + 1, C(dark[c]))
        put(im, x, y + 1, C(dark[c]))
        put(im, x, y, C("y2" if c != "y1" else "y0"))
        put(im, x - 1, y - 1, C("wh") if c in ("r2", "k1") else C(c))
    return im


def hedge(kind):
    """kind: 'l','m','r' - low hedge segment, tileable horizontally"""
    W, H = 32, 32
    ext = 12
    big = W + 2 * ext
    m = np.zeros((H, big), bool)
    x0 = ext + (3 if kind == "l" else -ext)
    x1 = ext + W - 1 - (3 if kind == "r" else -ext)
    m |= m_rrect(big, H, x0, 8, x1, 29, 5)
    for cx in range(x0 + 5, x1 - 3, 8):
        m |= m_ellipse(big, H, cx + 0.5, 10, 5.5, 4.5) & m_rect(big, H, x0, 0, x1, H)
    sh = soft_ellipse(big, H, (x0 + x1) / 2 + 0.5, 29, (x1 - x0) / 2 + 2, 3.5, SHADOW, 70)
    im = Image.new("RGBA", (big, H), (0, 0, 0, 0))
    im.alpha_composite(sh)
    im.alpha_composite(shape_img(big, H, [Part("hedge", m, TR["hedge"], 1, band=3, light=True, light_band=2)]))
    a = np.array(im)
    # front face darker (top face vs side face split)
    # front face: rows of small leaf scallops (u-shapes) in shadow green
    for row, (yy, off) in enumerate(((18, 0), (23, 3))):
        for x in range(big):
            p = (x + off) % 6
            dyp = {0: 0, 1: 1, 2: 1, 3: 1, 4: 0, 5: -9}[p]
            if dyp < 0:
                continue
            y = yy + dyp
            if m[y, x] and np.all(a[y, x, :3] == rgb("q2")):
                a[y, x, :3] = rgb("q1")
            if p == 2 and m[y - 2, x] and np.all(a[y - 2, x, :3] == rgb("q2")):
                a[y - 2, x, :3] = rgb("q3")
    for x in range(big):
        if m[16, x] and np.all(a[16, x, :3] == rgb("q2")) and x % 3:
            a[16, x, :3] = rgb("q1")
    for k, x in enumerate(range(ext + 4, ext + 30, 7)):
        y = 12 + (k % 2) * 2
        if m[y, x] and np.all(a[y, x, :3] == rgb("q2")):
            a[y, x, :3] = rgb("q3")
            a[y, x + 1, :3] = rgb("q4")
    im = Image.fromarray(a, "RGBA")
    return im.crop((ext, 0, ext + W, H))


def facade(mirror=False):
    W, H = 96, 96
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # wall
    wall = m_rect(W, H, 0, 18, W - 1, H - 1)
    im.alpha_composite(shape_img(W, H, [Part("wall", wall, ["t2", "t3", "t4", "t4"], 0, outline=False, band=0,
                                              light=False)]))
    rnd = random.Random(5)
    a = np.array(im)
    # plaster texture: sparse brick hints
    for _ in range(9):
        x, y = rnd.randrange(4, 88), rnd.randrange(26, 86)
        for k in range(5):
            a[y, x + k, :3] = rgb("t3")
        a[y + 1, x - 1, :3] = rgb("t3")
    # base plinth
    for y in range(88, 96):
        for x in range(W):
            a[y, x, :3] = rgb("t2" if y > 88 else "t1")
            if y > 89 and x % 16 == 0:
                a[y, x, :3] = rgb("t1")
    im = Image.fromarray(a, "RGBA")
    # roof: terracotta tiles with eave
    roof = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ra = np.zeros((H, W, 4), np.uint8)
    for y in range(0, 20):
        for x in range(W):
            row = y // 5
            off = (row % 2) * 4
            c = "r1"
            px, py = (x + off) % 8, y % 5
            if py == 4 and px not in (3, 4):
                c = "r0"
            elif py == 3 and px in (0, 7):
                c = "r0"
            elif px == 0 and py < 3:
                c = "r0"
            elif py == 0 and px in (1, 2):
                c = "r2"
            elif px == 1 and py == 1:
                c = "r2"
            ra[y, x] = C(c)
    for x in range(W):
        ra[20, x] = C("r0")
        ra[21, x] = C("ol1")
    roof = Image.fromarray(ra, "RGBA")
    im.alpha_composite(roof)
    # soft roof shadow on the wall
    sh = np.zeros((H, W, 4), np.uint8)
    sh[..., :3] = SHADOW
    for k, al in enumerate((90, 60, 35, 18)):
        sh[22 + k, :, 3] = al
    im.alpha_composite(Image.fromarray(sh, "RGBA"))
    # door
    dx0, dx1 = 10, 33
    door_frame = m_rrect(W, H, dx0 - 2, 44, dx1 + 2, 89, 0) | m_ellipse(W, H, (dx0 + dx1 + 1) / 2, 46, 14, 9)
    door = m_rect(W, H, dx0, 48, dx1, 89) | m_ellipse(W, H, (dx0 + dx1 + 1) / 2, 48, 12, 7)
    im.alpha_composite(shape_img(W, H, [Part("frame", door_frame, TR["stone"], 1, band=1, light=True),
                                         Part("door", door, TR["wood"], 2, band=1, light=True)]))
    for x in (dx0 + 8, dx0 + 15):
        for y in range(46, 88):
            put(im, x, y, C("w1"))
    put(im, dx1 - 3, 70, C("y1"))
    put(im, dx1 - 3, 71, C("y0"))
    # door step
    im.alpha_composite(shape_img(W, H, [Part("step", m_rrect(W, H, dx0 - 4, 89, dx1 + 4, 95, 1), TR["stone"], 1)]))
    # window with awning
    wx0, wx1, wy0, wy1 = 52, 85, 50, 72
    im.alpha_composite(shape_img(W, H, [
        Part("wframe", m_rrect(W, H, wx0 - 2, wy0 - 2, wx1 + 2, wy1 + 2, 1), ["w0", "w1", "w3", "t4"], 1, band=0),
        Part("glass", m_rect(W, H, wx0, wy0, wx1, wy1), ["a0", "a1", "a1", "a2"], 2, outline=False, band=0,
             light=False),
        Part("sill", m_rrect(W, H, wx0 - 4, wy1 + 2, wx1 + 4, wy1 + 5, 1), TR["stone"], 3)]))
    a = np.array(im)
    for x in range(wx0, wx1 + 1):
        for y in range(wy0, wy1 + 1):
            c = None
            if x == (wx0 + wx1) // 2 or y == (wy0 + wy1) // 2:
                c = "t4"
            elif (x - wx0) - (y - wy0) in (3, 4, 5) or (x - wx0) - (y - wy0) in (12,):
                c = "a3"
            elif y < wy0 + 3:
                c = "a0"
            if c:
                a[y, x, :3] = rgb(c)
    im = Image.fromarray(a, "RGBA")
    # flower box under window
    fb = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fb.alpha_composite(shape_img(W, H, [Part("fbox", m_rrect(W, H, wx0, wy1 + 6, wx1, wy1 + 11, 1), TR["wood"], 1)]))
    for k, x in enumerate(range(wx0 + 3, wx1 - 1, 5)):
        c = ["r1", "y1", "k1"][k % 3]
        put(fb, x, wy1 + 4, C(c))
        put(fb, x + 1, wy1 + 5, C(c))
        put(fb, x - 1, wy1 + 5, C(c))
        put(fb, x, wy1 + 5, C("y2"))
        put(fb, x + 2, wy1 + 5, C("q2"))
    im.alpha_composite(fb)
    # striped awning
    aw = np.zeros((H, W, 4), np.uint8)
    ay0, ay1 = 36, 46
    for y in range(ay0, ay1 + 1):
        t = (y - ay0) / (ay1 - ay0)
        xa, xb = wx0 - 4 - int(t * 3), wx1 + 4 + int(t * 3)
        for x in range(xa, xb + 1):
            stripe = ((x - xa) // 4) % 2 == 0
            c = "r1" if stripe else "wh"
            if y == ay0:
                c = "r0"
            elif y >= ay1 - 1:
                c = "r0" if stripe else "t3"
            aw[y, x] = C(c)
    # scalloped edge
    for x in range(wx0 - 7, wx1 + 8):
        if ((x - (wx0 - 7)) // 4) % 2 == 0:
            aw[ay1 + 1, x] = C("r0")
    im.alpha_composite(Image.fromarray(aw, "RGBA"))
    sh2 = np.zeros((H, W, 4), np.uint8)
    sh2[..., :3] = SHADOW
    sh2[ay1 + 2:ay1 + 5, wx0 - 4:wx1 + 5, 3] = 45
    im.alpha_composite(Image.fromarray(sh2, "RGBA"))
    # wall sign: little paintbrush shop plaque
    im.alpha_composite(shape_img(W, H, [Part("plaque", m_rrect(W, H, 40, 26, 48, 34, 1), TR["wood"], 1)]))
    put(im, 44, 29, C("a2"))
    put(im, 43, 30, C("r1"))
    put(im, 45, 30, C("y1"))
    if mirror:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    return im


# ================================================================ tileset + scene
def build_tiles():
    trunk, canopy = tree_layers()
    tiles = {
        "floor_checker": ((0, 0), tile_checker()),
        "floor_stone": ((1, 0), tile_pavers(3, cracks=False)),
        "floor_stone_cracked": ((2, 0), tile_pavers(3, cracks=True)),
        "grass_0": ((3, 0), tile_grass(0)),
        "grass_1": ((4, 0), tile_grass(1)),
        "grass_2": ((5, 0), tile_grass(2)),
        "hedge_l": ((6, 0), hedge("l")),
        "hedge_m": ((7, 0), hedge("m")),
        "hedge_r": ((8, 0), hedge("r")),
        "flower_bed": ((9, 0), flower_bed()),
        "bench": ((9, 4), bench()),
        "lamp": ((7, 4), lamp()),
        "lamp_glow": ((8, 4), lamp_glow()),
        "tree_trunk": ((0, 4), trunk),
        "tree_canopy": ((2, 4), canopy),
        "facade": ((4, 4), facade()),
    }
    for f, im in enumerate(fountain_frames()):
        tiles["fountain_f%d" % f] = ((f * 3, 1), im)
    sheet = Image.new("RGBA", (12 * T, 7 * T), (0, 0, 0, 0))
    meta = {}
    for name, ((tx, ty), im) in tiles.items():
        sheet.alpha_composite(im, (tx * T, ty * T))
        meta[name] = {"x": tx * T, "y": ty * T, "w": im.width, "h": im.height,
                      "tiles": [im.width // T, im.height // T]}
    meta["fountain"] = {"frames": ["fountain_f%d" % f for f in range(4)], "fps": 6}
    meta["tree"] = {"layers": ["tree_trunk", "tree_canopy"], "note": "draw canopy after characters for occlusion"}
    return sheet, meta, {k: v[1] for k, v in tiles.items()}


def bot_frame(sheet, meta, anim, d, i):
    r = meta[anim]["rows"][d]
    return sheet.crop((i * FW, r * FH, (i + 1) * FW, (r + 1) * FH))


def build_scene(tiles, bsheet, bmeta, fountain_frame=0, scale_light=1.0):
    SW, SH = 20, 12
    W, H = SW * T, SH * T
    ground = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    rnd = random.Random(42)
    for ty in range(SH):
        for tx in range(SW):
            grass = tx in (0, 19) or ty == 11 or (ty == 10 and tx in (1, 18))
            if grass:
                g = rnd.choice(["grass_0", "grass_0", "grass_1", "grass_2"])
                ground.alpha_composite(tiles[g], (tx * T, ty * T))
            elif 5 <= tx <= 14 and 4 <= ty <= 9:
                ground.alpha_composite(tiles["floor_checker"], (tx * T, ty * T))
            else:
                p = "floor_stone_cracked" if rnd.random() < 0.25 else "floor_stone"
                ground.alpha_composite(tiles[p], (tx * T, ty * T))
    # soft grass edge: darker lip where grass meets stone
    a = np.array(ground)
    lip = np.zeros((H, W, 4), np.uint8)
    lip[..., :3] = rgb("q1")
    for ty in range(SH):
        for tx in range(SW):
            grass = tx in (0, 19) or ty == 11 or (ty == 10 and tx in (1, 18))
            if not grass:
                continue
            x0, y0 = tx * T, ty * T
            # grass overhang onto plaza: little blades
            for side, (nx, ny) in (("r", (tx + 1, ty)), ("l", (tx - 1, ty)), ("t", (tx, ty - 1))):
                if not (0 <= nx < SW and 0 <= ny < SH):
                    continue
                ng = nx in (0, 19) or ny == 11 or (ny == 10 and nx in (1, 18))
                if ng:
                    continue
                for k in range(T):
                    j = (k * 7 + tx * 3 + ty) % 5
                    if side == "r":
                        xx, yy = x0 + T, y0 + k
                        lip[yy, xx:xx + 2, 3] = 70
                        if j == 0:
                            a[yy, xx] = C("q3")
                    elif side == "l":
                        xx, yy = x0 - 1, y0 + k
                        lip[yy, xx - 1:xx + 1, 3] = 70
                        if j == 0:
                            a[yy, xx] = C("q3")
                    else:
                        xx, yy = x0 + k, y0 - 1
                        if j in (0, 2):
                            a[yy, xx] = C("q3")
                            a[yy - 1, xx] = C("q4") if j == 0 else a[yy - 1, xx]
                        lip[y0:y0 + 2, xx, 3] = 60
    ground = Image.fromarray(a, "RGBA")
    ground.alpha_composite(Image.fromarray(lip, "RGBA"))

    # building row (3 tiles tall) - facades, alternating mirror
    fac = tiles["facade"]
    fac_m = fac.transpose(Image.FLIP_LEFT_RIGHT)
    for k, tx in enumerate(range(1, 19, 3)):
        ground.alpha_composite(fac if k % 2 == 0 else fac_m, (tx * T, 0))
    # corner wall pieces at the edges (grass side)
    for tx in (0, 19):
        ground.alpha_composite(fac.crop((40, 0, 72, 96)), (tx * T, 0))
    # drop shadow of the building on the plaza
    bs = np.zeros((H, W, 4), np.uint8)
    bs[..., :3] = SHADOW
    for k, al in enumerate((70, 45, 25, 12)):
        bs[96 + k, :, 3] = al
    ground.alpha_composite(Image.fromarray(bs, "RGBA"))

    # light pools from lamps on the ground
    lamps = [(4, 6), (15, 6)]
    for lx, ly in lamps:
        cx, cy = lx * T + 16, (ly + 1) * T + 26
        ground.alpha_composite(radial_glow(W, H, cx, cy, 44, 24, rgb("y2"), int(70 * scale_light)))

    # ------- sortable objects: (base_y, image, x, y)
    objs = []

    def add(img, x, y, base=None):
        objs.append((base if base is not None else y + img.height, img, x, y))

    ff = tiles["fountain_f%d" % fountain_frame]
    add(ff, 8 * T + 16, 4 * T + 8)
    add(tiles["bench"], 5 * T + 8, 9 * T + 4)
    add(tiles["bench"], 12 * T + 24, 9 * T + 4)
    for lx, ly in lamps:
        add(tiles["lamp"], lx * T, ly * T)
    add(tiles["flower_bed"], 6 * T, 3 * T + 8)
    add(tiles["flower_bed"], 12 * T, 3 * T + 8)
    for tx in (2, 3):
        add(tiles["hedge_l" if tx == 2 else "hedge_r"], tx * T, 3 * T + 4)
    for tx in (16, 17):
        add(tiles["hedge_l" if tx == 16 else "hedge_r"], tx * T, 3 * T + 4)
    trees = [(0 * T + 8, 5 * T + 4), (17 * T + 8, 7 * T + 4)]
    for x, y in trees:
        add(tiles["tree_trunk"], x, y)
    # bot 1: standing just BEHIND the right tree: its feet are above the trunk base, so trunk + canopy cover it
    b1 = bot_frame(bsheet, bmeta, "idle", "down", 0)
    add(b1, trees[1][0] + 31, trees[1][1] + 38)
    # bot 2: foreground, walking towards camera
    b2 = bot_frame(bsheet, bmeta, "walk", "down", 1)
    add(b2, 10 * T + 4, 9 * T + 10)
    # bot 3: sitting on the left bench (drawn over the bench)
    b3 = bot_frame(bsheet, bmeta, "type", "down", 0)
    add(b3, 5 * T + 24, 9 * T + 4 + 22 - 44, base=9 * T + 4 + 33)
    objs.sort(key=lambda o: o[0])
    for _, img, x, y in objs:
        ground.alpha_composite(img, (x, y))
    # canopies always over characters (occlusion layer)
    for x, y in trees:
        ground.alpha_composite(tiles["tree_canopy"], (x, y))
    # lamp glows on top
    for lx, ly in lamps:
        ground.alpha_composite(tiles["lamp_glow"], (lx * T, ly * T))
    # warm daytime grade: very light warm wash
    wash = Image.new("RGBA", (W, H), rgb("y2") + (14,))
    ground.alpha_composite(wash)
    return ground.convert("RGB")


# ================================================================ previews
def font(size=10):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def palette_png():
    names = list(PALETTE)
    cols = 8
    sw = 24
    rows = (len(names) + cols - 1) // cols
    im = Image.new("RGB", (cols * sw, rows * sw), (255, 255, 255))
    d = ImageDraw.Draw(im)
    for i, n in enumerate(names):
        x, y = (i % cols) * sw, (i // cols) * sw
        d.rectangle((x, y, x + sw - 1, y + sw - 1), fill=rgb(n))
    return im


def contact_sheet(rows):
    S = 4
    lab_w = 110
    maxf = max(len(r[2]) for r in rows)
    W = lab_w + maxf * (FW * S + 4)
    H = len(rows) * (FH * S + 4)
    im = Image.new("RGB", (W, H), (236, 228, 210))
    d = ImageDraw.Draw(im)
    f = font(14)
    for ri, (an, dname, fr) in enumerate(rows):
        y = ri * (FH * S + 4)
        if ri % 2:
            d.rectangle((0, y, W, y + FH * S + 3), fill=(228, 218, 198))
        d.text((6, y + FH * S // 2 - 8), "%s / %s" % (an, dname), fill=rgb("ol0"), font=f)
        for fi, (fimg, _) in enumerate(fr):
            big = fimg.resize((FW * S, FH * S), Image.NEAREST)
            im.paste(big, (lab_w + fi * (FW * S + 4), y + 2), big)
    return im


def anim_gif(A_rows, path):
    """2x2 grid (left, down / up, right), 8x, each animation cycled in all 4 directions"""
    S = 8
    cell = (FW * S, FH * S)
    frames, durs = [], []
    f = font(16)
    by = {}
    for an, dname, fr in A_rows:
        by.setdefault(an, {})[dname] = fr
    for an in ANIMS:
        n = len(by[an]["down"])
        loops = max(1, round(16 / n))
        if an in ("sit", "sleep", "talk"):
            loops = 4
        for _ in range(loops):
            for i in range(n):
                im = Image.new("RGB", (cell[0] * 2, cell[1] * 2 + 28), (236, 228, 210))
                d = ImageDraw.Draw(im)
                for k, dname in enumerate(["left", "down", "up", "right"]):
                    fimg = by[an][dname][i][0]
                    big = fimg.resize(cell, Image.NEAREST)
                    x, y = (k % 2) * cell[0], 28 + (k // 2) * cell[1]
                    im.paste(big, (x, y), big)
                d.text((8, 5), "Nami - %s  (%d/%d)" % (an, i + 1, n), fill=rgb("ol0"), font=f)
                frames.append(im)
                durs.append(125 if an not in ("sit", "sleep") else 400)
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=durs, loop=0, optimize=False)


def old_patch():
    """Honest render of the CURRENT 16px plaza from world.tmj (no runtime tint/fx), 20x12 tiles."""
    m = json.load(open(os.path.join(OLD, "world.tmj")))
    sheets = {}
    for ts in m["tilesets"]:
        sheets[ts["name"]] = (ts, Image.open(os.path.join(OLD, ts["image"])).convert("RGBA"))

    def tile(gid):
        gid &= 0x1FFFFFFF
        best = None
        for ts, img in sheets.values():
            if ts["firstgid"] <= gid and (best is None or ts["firstgid"] > best[0]["firstgid"]):
                best = (ts, img)
        ts, img = best
        i = gid - ts["firstgid"]
        sp = ts.get("spacing", 0)
        x = (i % ts["columns"]) * (16 + sp)
        y = (i // ts["columns"]) * (16 + sp)
        return img.crop((x, y, x + 16, y + 16))

    c0, r0, cw, rh = 10, 13, 20, 12
    out = Image.new("RGBA", (cw * 16, rh * 16), (0, 0, 0, 255))
    plaza = None
    for L in m["layers"]:
        if L["type"] == "objectgroup":
            for o in L["objects"]:
                p = {q["name"]: q["value"] for q in o.get("properties", [])}
                if p.get("kind") == "plaza":
                    plaza = (o, p)
    for L in m["layers"]:
        if L["type"] != "tilelayer":
            continue
        for ry in range(rh):
            for rx in range(cw):
                gid = L["data"][(r0 + ry) * m["width"] + (c0 + rx)]
                if gid:
                    t = tile(gid)
                    if L["name"] == "ground" and plaza and (gid & 0x1FFFFFFF) == 110:
                        tint = plaza[1]["tint"][3:]
                        tr = tuple(int(tint[i:i + 2], 16) for i in (0, 2, 4))
                        arr = np.array(t).astype(float)
                        arr[..., :3] *= np.array(tr) / 255.0
                        t = Image.fromarray(arr.astype(np.uint8), "RGBA")
                    out.alpha_composite(t, (rx * 16, ry * 16))
    # trees (objects) - town frames: tall 4/16, autumn 3/15, bush 5
    town = sheets["town"][1]

    def tf(i):
        return town.crop(((i % 12) * 16, (i // 12) * 16, (i % 12) * 16 + 16, (i // 12) * 16 + 16))

    for L in m["layers"]:
        if L["type"] != "objectgroup":
            continue
        for o in L["objects"]:
            p = {q["name"]: q["value"] for q in o.get("properties", [])}
            if p.get("kind") != "tree":
                continue
            x, y = o["x"] - c0 * 16 - 8, o["y"] - r0 * 16 - 16
            v = p.get("variant")
            if v == "bush":
                out.alpha_composite(tf(5), (int(x), int(y)))
            else:
                top, bot = (4, 16) if v == "tall" else (3, 15)
                out.alpha_composite(tf(bot), (int(x), int(y)))
                out.alpha_composite(tf(top), (int(x), int(y) - 16))
    # current chibi at the avatar spawn + one NPC
    ch = Image.open(os.path.join(OLD, "chibi.png")).convert("RGBA")

    def chibi(variant, dirn, anim):
        idx = variant * 24 + dirn * 6 + anim
        return ch.crop(((idx % 24) * 16, (idx // 24) * 22, (idx % 24) * 16 + 16, (idx // 24) * 22 + 22))

    out.alpha_composite(chibi(0, 1, 0), (328 - c0 * 16 - 8, 360 - r0 * 16 - 22))
    out.alpha_composite(chibi(5, 0, 1), (300 - c0 * 16 - 8, 320 - r0 * 16 - 22))
    return out.convert("RGB")


def compare_png(scene):
    old = old_patch().resize((640, 384), Image.NEAREST)
    pad, top = 16, 40
    im = Image.new("RGB", (640 * 2 + pad * 3, 384 + top + pad), (40, 30, 46))
    im.paste(old, (pad, top))
    im.paste(scene, (pad * 2 + 640, top))
    d = ImageDraw.Draw(im)
    f = font(22)
    d.text((pad, 8), "ATUAL 16 px", fill=(255, 244, 176), font=f)
    d.text((pad * 2 + 640, 8), "NOVO 32 px", fill=(168, 240, 184), font=f)
    return im


def check_palette(img, allow_alpha=True):
    """every fully opaque pixel must be a palette colour"""
    a = np.array(img.convert("RGBA"))
    op = a[..., 3] == 255
    pal = np.array([rgb(n) for n in PALETTE])
    px = a[op][:, :3]
    ok = np.zeros(len(px), bool)
    for c in pal:
        ok |= np.all(px == c, axis=1)
    return int((~ok).sum())


def main():
    os.makedirs(OUT, exist_ok=True)
    palette_png().save(os.path.join(OUT, "palette.png"))
    sheet, mask, bmeta, rows = bot_sheet()
    sheet.save(os.path.join(OUT, "bot-sheet.png"))
    mask.save(os.path.join(OUT, "bot-shirt-mask.png"))
    meta_out = {"frame": {"w": FW, "h": FH, "origin": [16, GROUND], "note": "origin = bottom-centre, feet on row 46"},
                "directions": DIRS, "shirt_ramp": [PALETTE[c] for c in RAMPS["shirt"]],
                "animations": {an: {"row": v["rows"]["left"], "rows": v["rows"], "frames": v["frames"],
                                    "fps": v["fps"]} for an, v in bmeta.items()}}
    json.dump(meta_out, open(os.path.join(OUT, "bot-sheet.json"), "w"), indent=2)
    tsheet, tmeta, tiles = build_tiles()
    tsheet.save(os.path.join(OUT, "plaza-tiles.png"))
    json.dump(tmeta, open(os.path.join(OUT, "plaza-tiles.json"), "w"), indent=2)
    scene = build_scene(tiles, sheet, bmeta)
    scene.save(os.path.join(OUT, "plaza-example.png"))
    scene.resize((scene.width * 2, scene.height * 2), Image.NEAREST).save(os.path.join(OUT, "plaza-example-x2.png"))
    contact_sheet(rows).save(os.path.join(OUT, "bot-contact-sheet.png"))
    anim_gif(rows, os.path.join(OUT, "bot-anim-preview.gif"))
    compare_png(scene).save(os.path.join(OUT, "compare.png"))
    # palette audit (opaque pixels only; shadows/glows are alpha)
    bad_bot = 0
    for an, dname, fr in rows:
        for fimg, _ in fr:
            bad_bot += check_palette(fimg)
    bad_tiles = check_palette(tsheet)
    print("palette colours:", len(PALETTE))
    print("off-palette opaque pixels: bot=%d tiles=%d" % (bad_bot, bad_tiles))
    print("frames per direction:", sum(v["frames"] for v in bmeta.values()))


if __name__ == "__main__":
    main()
