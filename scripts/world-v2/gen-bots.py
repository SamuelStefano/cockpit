#!/usr/bin/env python3
"""Original pixel-art generator: the 22 village bots (21 team bots + the player avatar) at 32x48 (block 1).

Deterministic. Run: python3 gen_bots.py [outdir] [previewdir]
  outdir      -> bots/<id>.png, bots/<id>-shirt.png, bots.json, fx-zzz.png (default ./out/v2)
  previewdir  -> vila-bots-*.png/gif previews (default ./out/v2-preview)

Reuses the palette, the shape helpers and the part renderer of gen.py (the approved F1 example).
Everything is drawn procedurally; nothing is copied from any game.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen as G  # noqa: E402
from gen import (C, FH, FW, GROUND, PALETTE, Part, grid, m_capsule, m_ellipse, m_ellipse_rot,  # noqa: E402
                 m_poly, m_rect, m_rrect, put, render_parts, rgb)

# ---------------------------------------------------------------- palette extension (lilac: Hinata's headphones/eyes)
PALETTE.update({"c0": "#7d62b8", "c1": "#c3b1ec"})
assert len(set(PALETTE.values())) == len(PALETTE)

DIRS = ["left", "down", "up", "right"]
# "run" is appended last so the rows of the older animations never move
ANIMS = ["idle", "walk", "sit", "type", "talk", "celebrate", "carry", "sleep", "run"]
FPS = {"idle": 4, "walk": 10, "sit": 2, "type": 8, "talk": 6, "celebrate": 10, "carry": 10, "sleep": 2, "run": 12}
COLS = 8

SHIRT = ["g0", "g1", "g2", "g3"]
SKIN = {
    "light": ["s0", "s1", "s2", "s3"],
    "tan": ["s0", "w2", "w3", "s2"],
    "brown": ["w0", "w1", "w2", "w3"],
    "deep": ["ol0", "w0", "w1", "w2"],
    "pale": ["s0", "s2", "s3", "wh"],
}
BLUSH = {"light": "k1", "tan": "r2", "brown": "r2", "deep": "r0", "pale": "k1"}
HAIR = {
    "chestnut": ["h0", "h1", "h2", "h3"],
    "black": ["ol0", "m0", "m1", "m2"],
    "darkbrown": ["ol0", "w0", "w1", "w2"],
    "blonde": ["w1", "y0", "y1", "y2"],
    "red": ["ol1", "r0", "r1", "r2"],
    "green": ["q0", "q1", "q2", "q3"],
    "blue": ["a0", "a0", "a1", "a2"],
    "pink": ["r0", "k0", "k1", "t4"],
    "silver": ["m1", "m2", "t3", "t4"],
    "espresso": ["ol0", "ol1", "h0", "h1"],
    "indigo": ["ol0", "p0", "p1", "p2"],
}
PANTS = {
    "navy": ["p0", "p1", "p2", "p2"],
    "grey": ["m0", "m0", "m1", "m2"],
    "brown": ["w0", "w0", "w1", "w2"],
    "khaki": ["t0", "t0", "t1", "t2"],
    "denim": ["a0", "a0", "a1", "a2"],
    "plum": ["ol0", "ol1", "k0", "k0"],
    "dark_navy": ["ol0", "p0", "p1", "p1"],
}
SHOES = {
    "brown": ["w0", "w0", "w1", "w2"],
    "dark": ["ol0", "ol0", "m0", "m1"],
    "red": ["r0", "r0", "r1", "r2"],
    "white": ["m1", "m1", "t4", "wh"],
}
RAMP = {
    "red": ["r0", "r0", "r1", "r2"],
    "dark": ["ol0", "m0", "m1", "m2"],
    "white": ["m1", "t3", "wh", "wh"],
    "denim": ["a0", "a0", "a1", "a2"],
    "orange": ["w1", "w2", "y0", "y1"],
    "gold": ["w1", "y0", "y1", "y2"],
    "pink": ["r0", "k0", "k1", "k1"],
    "lilac": ["p0", "c0", "c1", "wh"],
    "navy": ["ol0", "p0", "p1", "p2"],
    "crate": ["w0", "w1", "w2", "w3"],
}

# ---------------------------------------------------------------- roster
# id: (name, role, accessory, skin, hair colour, hair style, pants, shoes, eye, default shirt, extra)
BOTS = [
    ("iris", "Íris", "CEO", "blazer", "brown", "black", "long", "grey", "dark", "w1", "#7c5cff", {}),
    ("otto", "Otto", "CTO", "glasses", "light", "darkbrown", "short", "navy", "brown", "w1", "#3a78c8", {}),
    ("luffy", "Luffy", "Tech Lead", "headband", "tan", "black", "spiky_soft", "denim", "red", "m1", "#e04848", {}),
    ("zoro", "Zoro", "Tech Lead", "arm bandana", "light", "green", "short", "grey", "dark", "m1", "#2f6e35", {}),
    ("raquel", "Raquel", "Reviewer", "magnifier", "light", "red", "curly", "navy", "brown", "q1", "#c46aa8", {}),
    ("anderson", "Anderson", "QA", "hard hat + overalls", "deep", "darkbrown", "short", "denim", "brown", "w0",
     "#f0a830", {}),
    ("lara", "Lara", "Designer", "beret", "light", "blonde", "bob", "plum", "dark", "a1", "#f6a5d0", {}),
    ("lorena", "Lorena", "Security", "badge + flashlight", "brown", "black", "bun", "dark_navy", "dark", "w0",
     "#262e5a", {}),
    ("goku", "Goku", "Tech Lead Deck", "spiky hair", "light", "black", "spiky", "navy", "brown", "m1", "#f0a830",
     {}),
    ("nami", "Nami", "Pixel art", "red beret + paintbrush", "light", "chestnut", "bob", "navy", "brown", "a1",
     "#3fd17f", {}),
    ("arthur", "Arthur", "Growth head", "megaphone", "light", "blonde", "short", "khaki", "brown", "a1", "#ff8a7a",
     {}),
    ("mari", "Mari", "Content", "headphones", "tan", "pink", "long", "grey", "dark", "w0", "#f6a5d0", {}),
    ("usopp", "Usopp", "Animation / 3D", "goggles on forehead", "deep", "black", "curly", "brown", "white", "w0",
     "#d9a066", {}),
    ("robin", "Robin", "CFO", "calculator + glasses", "tan", "black", "bob", "dark_navy", "dark", "a0", "#474b6b",
     {}),
    ("bulma", "Bulma", "Revenue", "coin pin + ponytail", "light", "blue", "ponytail", "grey", "red", "a1",
     "#ffd166", {}),
    ("ada", "Ada", "Operations", "clipboard", "deep", "silver", "curly_short", "khaki", "brown", "w0", "#5fb4e8",
     {}),
    ("vegeta", "Vegeta", "Backend", "armband", "light", "black", "tall", "navy", "white", "a0", "#2b4a8a", {}),
    ("deck", "Deck", "Player avatar", "orange cap + Deck pin", "tan", "darkbrown", "short", "denim", "dark", "w0",
     "#f0a830", {}),
    ("malu", "Malu", "Lesson author", "spiral notebook + pen", "brown", "espresso", "curly_long", "khaki", "brown",
     "w0", "#2ec4b6", {}),
    ("naruto", "Naruto", "Animation / video", "clapperboard + headband", "light", "blonde", "spiky", "navy", "dark",
     "a1", "#ff7a1a", {}),
    ("sasuke", "Sasuke", "Laptop", "open laptop", "pale", "black", "swept", "dark_navy", "dark", "m0", "#8a94a6",
     {"eyes": "calm"}),
    ("hinata", "Hinata", "Video editing", "editing headphones", "pale", "indigo", "long_fringe", "grey", "brown",
     "c1", "#b9a2e6", {}),
]


def bot_spec(row):
    bid, name, role, acc, skin, hairc, style, pants, shoes, eye, shirt, extra = row
    return dict(id=bid, name=name, role=role, accessory=acc, skin=skin, hair=hairc, style=style, pants=pants,
                shoes=shoes, eye=eye, shirt=shirt, **extra)


ACC = {  # accessory switches per bot id
    "iris": {"blazer", "star"}, "otto": {"glasses"}, "luffy": {"headband"}, "zoro": {"bandana"},
    "raquel": {"magnifier"}, "anderson": {"hardhat", "overalls"}, "lara": {"beret_dark"},
    "lorena": {"badge", "flashlight"}, "goku": set(), "nami": {"beret_red", "brush"}, "arthur": {"megaphone"},
    "mari": {"headphones"}, "usopp": {"goggles"}, "robin": {"calculator", "glasses_thin"},
    "bulma": {"coin"}, "ada": {"clipboard"}, "vegeta": {"armband"}, "deck": {"cap", "deckpin"},
    "malu": {"notebook"}, "naruto": {"clapper", "forehead"}, "sasuke": {"laptop"}, "hinata": {"edit_phones"},
}
HELD = {"brush", "magnifier", "megaphone", "calculator", "clipboard", "notebook", "clapper", "laptop"}
HELD_ORDER = ("brush", "magnifier", "megaphone", "calculator", "clipboard", "notebook", "clapper", "laptop")


# ---------------------------------------------------------------- poses
def pose(**kw):
    base = dict(dy=0, sq=0, head_dy=0, head_dx=0, look=0, eyes="open", mouth="smile",
                arm_l=("side", 0), arm_r=("side", 0), legs=("stand", 0), prop=True,
                seat=0, crate=False, side_arms=None, prop_side=None, open_hand=False, lean=0)
    base.update(kw)
    return base


def anim_poses():
    A = {}
    A["idle"] = [pose(), pose(), pose(head_dy=1, sq=1), pose(head_dy=1, sq=1, eyes="blink")]
    seq = [(0, 0), (1, 1), (-1, -1), (0, 0), (1, 1), (-1, -1)]
    A["walk"] = [pose(dy=dy, sq=sq, legs=("walk", k), arm_l=("swing", -1 if k < 3 else 1),
                      arm_r=("swing", 1 if k < 3 else -1)) for k, (dy, sq) in enumerate(seq)]
    A["sit"] = [pose(seat=1, arm_l=("lap", 0), arm_r=("lap", 0)),
                pose(seat=1, sq=1, head_dy=1, arm_l=("lap", 0), arm_r=("lap", 0))]
    t = dict(seat=1, look=1, head_dy=1, prop=False)
    A["type"] = [pose(arm_l=("type", 0), arm_r=("type", 1), **t), pose(arm_l=("type", 1), arm_r=("type", 0), **t),
                 pose(arm_l=("type", 0), arm_r=("type", 0), eyes="blink", **t),
                 pose(arm_l=("type", 1), arm_r=("type", 1), **t)]
    A["talk"] = [pose(mouth="open", arm_r=("gesture", 0)), pose(mouth="smile", arm_r=("gesture", 1))]
    # celebrate: body height constant (sq=0); squash lives in the legs (crouch / jump / tuck)
    cel = [(2, "crouch", ("out", 0), ("low", 0), "open"),
           (-3, "jump", ("up", 0), ("out", 0), "big"),
           (-5, "tuck", ("up", 1), ("out", 0), "big"),
           (-4, "tuck", ("up", 1), ("out", 0), "big"),
           (-2, "jump", ("up", 0), ("out", 0), "open"),
           (1, "crouch", ("out", 0), ("low", 0), "open")]
    A["celebrate"] = []
    for dy, legs, near, far, mouth in cel:
        up = near[0] == "up"
        A["celebrate"].append(pose(dy=dy, legs=(legs, 0), eyes="happy", mouth=mouth,
                                   arm_l=("up", near[1]) if up else ("out", 0),
                                   arm_r=("up", near[1]) if up else ("out", 0),
                                   side_arms=(near, far), prop_side="far", open_hand=up))
    A["carry"] = [pose(dy=dy, sq=sq, legs=("walk", k), arm_l=("carry", 0), arm_r=("carry", 0), prop=False,
                       crate=True) for k, (dy, sq) in enumerate(seq)]
    s = dict(seat=1, look=1, eyes="closed", mouth="sleep", prop=False, arm_l=("lap", 1), arm_r=("lap", 1))
    A["sleep"] = [pose(head_dy=1, head_dx=1, **s), pose(head_dy=1, head_dx=1, sq=1, **s)]
    # run: contact (low, widest stride) -> pass (legs gathered) -> flight (airborne), then the other leg leads.
    # The body leans forward the whole cycle and the bent arms pump opposite to the legs.
    run = [(1, -1), (0, 0), (-2, 1), (1, 1), (0, 0), (-2, -1)]
    A["run"] = [pose(dy=dy, legs=("run", k), lean=2, arm_l=("pump", a), arm_r=("pump", -a),
                     mouth="open" if dy < 0 else "smile") for k, (dy, a) in enumerate(run)]
    return A


def run_feet(k):
    """(near, far) feet as (stride, lift); stride > 0 = ahead of the body, lift = px above the ground"""
    half = [((1.7, 0), (-1.7, 2)), ((-0.3, 0), (1.0, 2)), ((-1.7, 1), (1.5, 2))]
    a, b = half[k % 3]
    return (a, b) if k < 3 else (b, a)


def walk_feet(k):
    return [((1, 0), (-1, 0)), ((1, 0), (-1, 0)), ((0, 0), (0, 2)),
            ((-1, 0), (1, 0)), ((-1, 0), (1, 0)), ((0, 2), (0, 0))][k]


# ---------------------------------------------------------------- hair
def spikes(cx, cy, rx, ry, angles, length, half=13):
    m = np.zeros((FH, FW), bool)
    for a in angles:
        r0 = math.radians(a - half)
        r1 = math.radians(a + half)
        ra = math.radians(a)
        p0 = (cx + rx * 0.92 * math.cos(r0), cy + ry * 0.92 * math.sin(r0))
        p1 = (cx + rx * 0.92 * math.cos(r1), cy + ry * 0.92 * math.sin(r1))
        tip = (cx + (rx + length) * math.cos(ra), cy + (ry + length) * math.sin(ra))
        m |= m_poly(FW, FH, [p0, tip, p1])
    return m


def curls(cx, cy, rx, ry, a0, a1, step, r):
    m = np.zeros((FH, FW), bool)
    a = a0
    while a <= a1 + 1e-6:
        ra = math.radians(a)
        m |= m_ellipse(FW, FH, cx + rx * math.cos(ra), cy + ry * math.sin(ra), r, r)
        a += step
    return m


def build_hair(style, d, hcx, cy, look):
    """returns (front mask z=6, back mask drawn behind the head)"""
    W, H = FW, FH
    X, Y = grid(W, H)
    cap = m_ellipse(W, H, hcx, cy - 0.6, 11.4, 9.6)
    back = np.zeros((H, W), bool)
    base = style.split("_")[0]
    curly = base == "curly"
    if curly:
        cap = cap | curls(hcx, cy - 0.6, 10.6, 8.8, -180, 0, 22.5, 2.4)

    def cols(fn):
        line = np.array([fn(x + 0.5 - hcx) for x in range(W)]) + look
        return Y < line[None, :]

    if d == "down":
        def f(r):
            a = abs(r)
            i = int(math.floor(r + 0.5))
            if style == "long_fringe":   # hime cut: straight fringe + long front locks
                return cy + 6.5 if a > 8.6 else (cy + 4.5 if a > 7 else cy - 1.5)
            if base == "swept":   # fringe swept down toward screen-left
                if a > 8.6:
                    return cy + 2
                if a > 7:
                    return cy + 1 if r < 0 else cy - 1
                return cy - 4.5 + (7 - r) / 14.0 * 3.8
            if base in ("bob", "long"):
                return cy + 6.5 if a > 8.6 else (cy + 2.5 if a > 7 else cy - 3 + (1 if i % 5 == 0 else 0))
            if base == "short":
                return cy + 1.5 if a > 8.6 else (cy - 0.5 if a > 7 else cy - 3.5 + (1 if -5 <= r < -1 else 0))
            if base == "spiky":
                return cy + 2 if a > 8.6 else (cy if a > 7 else cy - 3.5 + {0: 2, 1: 1, 2: 0, 3: 1}[i % 4])
            if base == "tall":
                return cy + 1 if a > 8.6 else (cy - 1 if a > 7 else cy - 4.5 + max(0.0, 3 - a))
            if base == "ponytail":
                return cy + 3 if a > 8.6 else (cy + 0.5 if a > 7 else cy - 3.5 + (1 if r > 2 else 0))
            if base == "bun":
                return cy + 2.5 if a > 8.6 else (cy if a > 7 else cy - 3 - (1 if a < 1.5 else 0))
            if curly:
                long_ = style != "curly_short"
                return (cy + (5 if long_ else 2) if a > 8.6 else
                        (cy + 1 if a > 7 else cy - 3.5 + (1.5 if i % 3 == 1 else 0.5)))
            return cy - 3
        hair = cap & cols(f)
        if curly:
            hair |= curls(hcx, cy - 3.2 + look, 7.5, 0.1, -180, 0, 180 / 4, 1.6) & (Y > cy - 6)
            hair |= curls(hcx, cy + 1, 9.6, 3.5, 0, 180, 180, 2.2) if style != "curly_short" else False
            if style == "curly_long":
                for sx in (-1, 1):
                    for k, yy in enumerate((2, 5, 8, 11)):
                        hair |= m_ellipse(W, H, hcx + sx * (9.6 + (k % 2) * 0.7), cy + yy, 2.3, 2.0)
        if base == "swept":
            hair |= spikes(hcx, cy - 0.6, 11.4, 9.6, [-158, -136], 2.6, 12)
        if base == "long":
            hair |= m_rrect(W, H, hcx - 12, cy, hcx - 8.5, cy + 12, 1) | m_rrect(W, H, hcx + 7.5, cy, hcx + 11, cy + 12, 1)
        if base == "spiky":
            soft = style == "spiky_soft"
            hair |= spikes(hcx, cy - 0.6, 11.4, 9.6, [-150, -122, -95, -68, -40] if not soft else
                           [-150, -115, -80, -45], 3.2 if soft else 4.3, 12 if soft else 13)
        if base == "tall":
            hair |= m_poly(W, H, [(hcx - 10.8, cy - 1), (hcx - 10, cy - 10), (hcx - 7, cy - 9), (hcx - 5, cy - 15),
                                  (hcx - 2, cy - 11), (hcx + 1, cy - 16), (hcx + 3.5, cy - 11), (hcx + 6.5, cy - 15),
                                  (hcx + 8, cy - 9), (hcx + 10.5, cy - 10), (hcx + 11.2, cy - 1)])
        if base == "bun":
            hair |= m_ellipse(W, H, hcx, cy - 10.5, 4.2, 3.6)
        if base == "ponytail":
            back |= m_ellipse(W, H, hcx + 7.5, cy - 8.5, 3.6, 3.0)
            back |= m_capsule(W, H, (hcx + 10, cy - 3), (hcx + 11.5, cy + 6), 2.0)
        return hair, back
    if d == "up":
        L = {"short": 3.5, "bob": 6.5, "long": 6.5, "spiky": 3, "tall": 2, "ponytail": 2.5, "bun": 3,
             "curly": 5, "swept": 3.5}[base]
        if style == "curly_short":
            L = 3
        hair = cap & (Y < cy + L)
        if curly:
            hair |= curls(hcx, cy + L - 2, 9.0, 1.5, 0, 180, 30, 2.0) & (Y < cy + L + 1.5)
            if style == "curly_long":
                hair |= m_rrect(W, H, hcx - 9.5, cy, hcx + 8.5, cy + 10, 3)
                hair |= curls(hcx, cy + 10, 8.6, 1.2, 0, 180, 30, 2.1)
        if base == "swept":   # spiky tufts at the back of the head
            hair |= spikes(hcx, cy - 0.6, 11.4, 9.6, [-150, -115, -65, -30], 2.4, 13)
            hair |= spikes(hcx, cy + 1.5, 9.5, 2, [65, 90, 115], 2.4, 14)
        if base == "long":
            hair |= m_rrect(W, H, hcx - 10, cy, hcx + 9, cy + 12, 3)
        if base == "spiky":
            soft = style == "spiky_soft"
            hair |= spikes(hcx, cy - 0.6, 11.4, 9.6, [-150, -122, -95, -68, -40] if not soft else
                           [-150, -115, -80, -45], 3.2 if soft else 4.3, 12 if soft else 13)
            hair |= spikes(hcx, cy + 1.5, 9.5, 2, [60, 90, 120], 2.0, 14)
        if base == "tall":
            hair |= m_poly(W, H, [(hcx - 10.8, cy - 1), (hcx - 10, cy - 10), (hcx - 7, cy - 9), (hcx - 5, cy - 15),
                                  (hcx - 2, cy - 11), (hcx + 1, cy - 16), (hcx + 3.5, cy - 11), (hcx + 6.5, cy - 15),
                                  (hcx + 8, cy - 9), (hcx + 10.5, cy - 10), (hcx + 11.2, cy - 1)])
        if base == "bun":
            hair |= m_ellipse(W, H, hcx, cy - 9.5, 4.2, 3.6)
        if base == "ponytail":
            hair |= m_capsule(W, H, (hcx, cy - 5), (hcx + 0.5, cy + 9), 2.3)
        return hair, back

    # side view, facing left
    tail = {"short": 3.5, "bob": 6.5, "long": 6.5, "spiky": 3, "tall": 2, "ponytail": 2.5, "bun": 3,
            "curly": 5, "swept": 3}[base]
    if style == "curly_short":
        tail = 3

    def f(r):
        if style == "long_fringe" and r < 3.5:
            return cy - 1.5 if r < 1.5 else cy + 1.0
        if base == "swept" and r < -2.5:
            return cy - 1.0 if r < -6.5 else cy - 2.5
        if r < -6.5:
            return cy - 3.0
        if r < -2.5:
            return cy - 2.0
        if r < 1.5:
            return cy - 1.0 if base not in ("short", "tall", "spiky") else cy - 1.5
        if r < 3.5:
            return cy + 1.0
        return cy + tail
    hair = cap & cols(f)
    hair |= cap & (X > hcx + 3.5) & (Y < cy + tail)
    if curly:
        hair |= curls(hcx + 2, cy + tail - 2, 8.5, 1, -10, 90, 50, 2.1) & (X > hcx + 2) & (Y < cy + tail + 1.5)
        hair |= curls(hcx - 6, cy - 3.6 + look, 2.5, 0.1, -180, 0, 90, 1.5) & (Y > cy - 6)
        if style == "curly_long":
            hair |= m_rrect(W, H, hcx + 3, cy, hcx + 10, cy + 10, 3)
            hair |= curls(hcx + 6.5, cy + 10, 3.2, 1.0, 0, 180, 60, 2.1)
    if base == "swept":   # tufts sticking out at the back
        hair |= spikes(hcx, cy - 0.6, 11.4, 9.6, [-150, -60, -30, 0], 2.8, 13)
    if base == "long":
        hair |= m_rrect(W, H, hcx + 4, cy, hcx + 10.5, cy + 12, 2)
    if base == "spiky":
        soft = style == "spiky_soft"
        hair |= spikes(hcx, cy - 0.6, 11.4, 9.6, [-132, -104, -76, -48, -20] if not soft else
                       [-130, -95, -60, -25], 3.2 if soft else 4.3, 12 if soft else 13)
    if base == "tall":
        hair |= m_poly(W, H, [(hcx - 9, cy - 4), (hcx - 8, cy - 11), (hcx - 5, cy - 10), (hcx - 3, cy - 16),
                              (hcx, cy - 12), (hcx + 3, cy - 16), (hcx + 5, cy - 11), (hcx + 9, cy - 13),
                              (hcx + 9, cy - 7), (hcx + 11.5, cy - 4), (hcx + 11, cy + 1)])
    if base == "bun":
        hair |= m_ellipse(W, H, hcx + 7, cy - 8, 3.9, 3.6)
    if base == "ponytail":
        hair |= m_capsule(W, H, (hcx + 9, cy - 5), (hcx + 12.5, cy + 4), 2.2)
    return hair, back


# ---------------------------------------------------------------- body
def build_bot(spec, d, P, swap=False):
    """d in left/down/up. swap only matters for 'left' (used for the mirrored 'right' row):
    swap=False -> near arm is the character's LEFT arm (physically correct facing left);
    swap=True  -> near arm is the RIGHT arm (it becomes the right view after the mirror)."""
    W, H = FW, FH
    acc = ACC[spec["id"]]
    parts = []
    sq, seat = P["sq"], P["seat"]
    skin = SKIN[spec["skin"]]
    pants_r = RAMP["denim"] if "overalls" in acc else PANTS[spec["pants"]]
    shoe_r = SHOES[spec["shoes"]]
    if seat:
        hip = 42
        torso_top = 37 + (1 if sq > 0 else 0)
        head_cy = 29.5 + P["head_dy"] + (1 if sq > 0 else 0)
    else:
        dy = P["dy"]
        hip = 41 + dy
        torso_top = 32 + dy + (1 if sq > 0 else 0) - (1 if sq < 0 else 0)
        head_cy = 23.5 + dy + P["head_dy"] + (1 if sq > 0 else 0) - (1 if sq < 0 else 0)
    widen = 1 if sq > 0 else (-1 if sq < 0 else 0)
    side = d == "left"
    legs, lk = P["legs"]
    lean = P["lean"]
    if lean and not side:   # front/back views: the lean reads as the head dropping over the chest
        head_cy += 1
    lean_t = 1 if (lean and side) else 0   # side view: chest 1 px forward, head `lean` px forward

    # ---- legs + shoes
    if seat:
        if d == "down":
            for x0 in (9, 17):
                parts.append(Part("knee", m_rrect(W, H, x0, hip - 2, x0 + 5, hip + 1, 2), pants_r, 3.5, light=True))
                parts.append(Part("shin", m_rect(W, H, x0 + 1, hip + 1, x0 + 4, hip + 2), pants_r, 3.4, light=False))
                parts.append(Part("shoe", m_rrect(W, H, x0 + (0 if x0 < 16 else 1), hip + 2, x0 + 4 + (0 if x0 < 16 else 1),
                                                  hip + 4, 1), shoe_r, 3.45, light=False))
        elif d == "left":
            parts.append(Part("thigh", m_capsule(W, H, (18, hip - 0.5), (10.5, hip - 2), 2.1), pants_r, 3.5, light=True))
            parts.append(Part("shin", m_capsule(W, H, (10, hip - 1.5), (9.5, hip + 2.5), 1.7), pants_r, 3.4,
                              light=False))
            parts.append(Part("shoe", m_rrect(W, H, 6, hip + 2, 11, hip + 4, 1), shoe_r, 3.45, light=False))
            parts.append(Part("seat", m_rrect(W, H, 15, hip - 2, 21, hip + 1, 2), pants_r, 2.8, light=False))
        else:
            for sx in (9, 19):
                parts.append(Part("shoe", m_rrect(W, H, sx, hip + 2, sx + 3, hip + 4, 1), shoe_r, 0.5, light=False))
            parts.append(Part("seat", m_rrect(W, H, 10, hip - 2, 21, hip + 1, 2), pants_r, 2.8, light=False))
    else:
        if legs == "walk":
            fl, fr = walk_feet(lk)
        elif legs == "run":
            fl, fr = run_feet(lk)
            if swap:   # mirrored row: the near leg is the other leg, keeps arms and legs opposed
                fl, fr = fr, fl
        elif legs == "tuck":
            fl, fr = (0, 3), (0, 3)
        elif legs == "jump":
            fl, fr = (0, 1), (0, 1)
        else:
            fl, fr = (0, 0), (0, 0)
        crouch = legs == "crouch"
        air = legs in ("tuck", "jump")
        foot_base = GROUND + P["dy"] if air else GROUND
        if d in ("down", "up"):
            for (stride, lift), lx in ((fl, 12), (fr, 17)):
                s = stride if d == "down" else -stride
                fb = foot_base - lift + (0 if s >= 0 else -1)
                lx2 = lx + ((-1 if lx < 16 else 1) if crouch else 0)
                parts.append(Part("leg", m_rect(W, H, lx2, hip - 1, lx2 + 2, fb - 2), pants_r, 1, light=False))
                sx0 = lx2 - 1 if lx < 16 else lx2
                parts.append(Part("shoe", m_rrect(W, H, sx0, fb - 2, sx0 + 3, fb, 1), shoe_r,
                                  1.5 + (0.1 if s > 0 else 0), light=False))
        else:
            for (stride, lift), far in ((fr, True), (fl, False)):
                fx = int(round(16 - stride * 3)) + (-1 if crouch and not far else (1 if crouch else 0))
                fb = foot_base - lift
                z = 0.6 if far else 1.6
                hipx = 16.5
                if crouch:  # knee bent forward: two segments
                    knee = (hipx - 3.0, (hip + fb) / 2.0 - 0.5)
                    leg = m_capsule(W, H, (hipx, hip), knee, 1.5) | m_capsule(W, H, knee, (fx + 0.5, fb - 2), 1.5)
                elif legs == "tuck":
                    knee = (hipx - 3.0, hip + 1.5)
                    leg = m_capsule(W, H, (hipx, hip), knee, 1.5) | m_capsule(W, H, knee, (fx + 1.5, fb - 2), 1.5)
                else:
                    leg = m_capsule(W, H, (hipx, hip), (fx + 0.5, fb - 2), 1.5)
                parts.append(Part("leg", leg, pants_r, z, light=False))
                parts.append(Part("shoe", m_rrect(W, H, fx - 2, fb - 2, fx + 1, fb, 1), shoe_r, z + 0.1, light=False))

    # ---- torso
    if d in ("down", "up"):
        tx0, tx1 = 10 - widen, 21 + widen
    else:
        tx0, tx1 = 12 - widen - lean_t, 20 + widen - lean_t
    torso = m_rrect(W, H, tx0, torso_top, tx1, hip, 2) & ~m_rect(W, H, 0, hip, W, H)
    pants = m_rrect(W, H, tx0 + 1, hip - 2, tx1 - 1, hip + 1, 1)
    parts.append(Part("pants", pants, pants_r, 2.8, light=False))
    hcx = (16.0 if d != "left" else 15.5)
    hdx = P["head_dx"]
    hcx += hdx if d == "down" else (-hdx if d == "left" else -hdx)
    if side:
        hcx -= lean
    cxi = int(round(hcx - 0.01))  # integer anchor for overlays

    if "blazer" in acc:
        parts.append(Part("torso", torso, SHIRT, 3, band=1, shirt=True, cast=2))
        if d == "down":
            v = m_poly(W, H, [(13.5, torso_top - 1), (18.5, torso_top - 1), (16.5, hip - 1), (15.5, hip - 1)])
            jacket = torso & ~v
            lapel = (m_poly(W, H, [(12.5, torso_top), (14.5, torso_top), (16, hip - 3), (14.5, hip - 3)]) |
                     m_poly(W, H, [(17.5, torso_top), (19.5, torso_top), (17.5, hip - 3), (16, hip - 3)])) & torso & ~v
        elif d == "up":
            jacket, lapel = torso, None
        else:
            front = m_rect(W, H, tx0, torso_top, tx0 + 2, hip - 3)
            jacket = torso & ~front
            lapel = m_rect(W, H, tx0 + 3, torso_top, tx0 + 3, hip - 4) & torso
        parts.append(Part("blazer", jacket, RAMP["dark"], 3.05, band=1, cast=2))
        if lapel is not None and lapel.any():
            parts.append(Part("lapel", lapel, ["m0", "m2", "m2", "m2"], 3.06, outline=False, band=0, light=False))
    else:
        parts.append(Part("torso", torso, SHIRT, 3, band=1, shirt=True, cast=2))
    if "overalls" in acc:
        if d == "down":
            bib = m_rrect(W, H, 12, torso_top + 4, 19, hip, 1)
            straps = m_rect(W, H, 12, torso_top, 12, torso_top + 4) | m_rect(W, H, 19, torso_top, 19, torso_top + 4)
        elif d == "up":
            bib = m_rect(W, H, tx0 + 1, hip - 3, tx1 - 1, hip)
            straps = np.zeros((H, W), bool)
            for k in range(0, int(hip - 3 - torso_top)):
                for x in (12 + k * 7 // 8, 19 - k * 7 // 8):
                    straps |= m_rect(W, H, x, torso_top + k, x, torso_top + k)
        else:
            bib = m_rrect(W, H, tx0, torso_top + 4, tx0 + 5, hip, 1) | m_rect(W, H, tx0 + 1, hip - 3, tx1 - 1, hip)
            straps = m_rect(W, H, tx0 + 3, torso_top, tx0 + 3, torso_top + 4)
        parts.append(Part("bib", (bib | straps) & (torso | pants), RAMP["denim"], 3.1, band=0, light=True))

    # ---- arms
    sh_y = torso_top + 1.5
    hand_pts = {}

    def arm(name, shoulder, hand, z, sleeve=True, band=False, open_hand=False, sleeve_t=0.45, elbow=None):
        am = m_capsule(W, H, shoulder, hand, 1.45)
        if elbow is not None:   # bent arm: the sleeve covers the upper arm down to the elbow
            am = m_capsule(W, H, shoulder, elbow, 1.45) | m_capsule(W, H, elbow, hand, 1.45)
        parts.append(Part(name + "_arm", am, skin, z, light=False, band=0))
        sx = shoulder[0] + (hand[0] - shoulder[0]) * sleeve_t
        sy = shoulder[1] + (hand[1] - shoulder[1]) * sleeve_t
        if elbow is not None:
            sx, sy = elbow
        if sleeve:
            if "blazer" in acc:
                parts.append(Part(name + "_sleeve", m_capsule(W, H, shoulder, (sx, sy), 1.75), RAMP["dark"], z + 0.01,
                                  light=False))
            else:
                parts.append(Part(name + "_sleeve", m_capsule(W, H, shoulder, (sx, sy), 1.75), SHIRT, z + 0.01,
                                  shirt=True, light=False))
        if band:
            bx = shoulder[0] + (hand[0] - shoulder[0]) * 0.55
            by = shoulder[1] + (hand[1] - shoulder[1]) * 0.55
            bm = m_capsule(W, H, (sx, sy), (bx, by), 1.9)
            parts.append(Part(name + "_band", bm, band, z + 0.015, light=False, band=0))
        hm = m_ellipse(W, H, hand[0], hand[1], 1.7, 1.6)
        if open_hand:
            hx, hy = int(math.floor(hand[0])), int(math.floor(hand[1]))
            hm = m_ellipse(W, H, hand[0], hand[1], 1.9, 1.7)
            for fx in (hx - 1, hx + 1):
                hm |= m_rect(W, H, fx, hy - 3, fx, hy - 1)
            hm |= m_rect(W, H, hx - 2, hy - 1, hx + 2, hy + 1)
        parts.append(Part(name + "_hand", hm, skin, z + 0.02, light=False, band=0, out_idx=1))
        hand_pts[name] = hand

    def arm_target(kind, k, sidex, sgn):
        hx = sidex + sgn * 1.0
        if kind == "side":
            return (hx, sh_y + 6)
        if kind == "swing":
            return (hx, sh_y + 6 + k)
        if kind == "pump":   # k=1 fist raised in front of the chest, k=-1 elbow out and hand back
            return {1: (sidex - sgn * 0.5, sh_y + 2), 0: (sidex + sgn * 1.5, sh_y + 4),
                    -1: (sidex + sgn * 2.5, sh_y + 5.5)}[k]
        if kind == "out":
            return (sidex + sgn * 3.5, sh_y + 4.5)
        if kind == "low":
            return (sidex + sgn * 2.5, sh_y + 5.5)
        if kind == "up":
            return (sidex + sgn * (5.0 + k * 0.5), sh_y - 9 - k)
        if kind == "type":
            return (sidex - sgn * 3.5, sh_y + 5 - k)
        if kind == "carry":
            return (sidex - sgn * 1.0, sh_y + 3)
        if kind == "gesture":
            return (sidex + sgn * 3.0, sh_y + 2 - k)
        if kind == "lap":
            return (sidex - sgn * (3.0 + k * 0.5), hip - 1.5)
        return (hx, sh_y + 6)

    armband = RAMP["dark"] if "bandana" in acc else (RAMP["gold"] if "armband" in acc else None)
    held = bool(acc & HELD) and P["prop"]
    prop_hand = None
    if d in ("down", "up"):
        lsx, rsx = tx0 + 0.5, tx1 + 0.5
        # down: screen-left = character's right arm; up: screen-left = character's left arm
        kl, kr = (P["arm_r"], P["arm_l"]) if d == "down" else (P["arm_l"], P["arm_r"])
        for nm, (kind, k), sx, sgn in (("L", kl, lsx, -1), ("R", kr, rsx, 1)):
            if kind in ("swing", "pump") and d == "up":
                k = -k
            hp = arm_target(kind, k, sx, sgn)
            zz = 4
            if kind in ("type", "carry", "lap") and d == "up":
                zz = 2.9
            is_left_arm = (nm == "R") if d == "down" else (nm == "L")
            arm(nm, (sx, sh_y), hp, zz, band=armband if (armband and is_left_arm) else False,
                open_hand=P["open_hand"] and kind == "up")
        prop_hand = "L" if d == "down" else "R"
    else:
        shx = 16.5 - lean_t
        if P["side_arms"]:
            near, far = P["side_arms"]
            prop_hand = "F" if P["prop_side"] == "far" else "N"
        else:
            near, far = (P["arm_r"], P["arm_l"]) if swap else (P["arm_l"], P["arm_r"])
            prop_hand = "N" if swap else "F"
        for nm, (kind, k) in (("F", far), ("N", near)):
            z = 2.5 if nm == "F" else 4
            elbow = None
            if kind == "swing":
                hp = (shx - k * 3.0 * (1 if nm == "N" else -1), sh_y + 5.5)
            elif kind == "pump":   # k=1 fist driven forward and up, k=-1 elbow back, 0 = passing the hip
                elbow, hp = {1: ((shx - 2.5, sh_y + 4), (shx - 6, sh_y + 1.5)),
                             0: ((shx + 0.5, sh_y + 4), (shx - 2, sh_y + 5)),
                             -1: ((shx + 3, sh_y + 3), (shx + 5.5, sh_y + 5.5))}[k]
            elif kind == "side":
                hp = (shx - 0.5, sh_y + 6)
            elif kind == "up":  # straight up along the side of the body
                hp = (shx + 4.5, sh_y - 19 - k)
                z = 7.5   # near arm straight up along the side of the head
            elif kind == "out":
                hp = (shx - 6.5, sh_y + 3.5)
            elif kind == "low":
                hp = (shx - 3, sh_y + 5)
            elif kind == "type":
                hp = (shx - 6.5, sh_y + 4 - k)
            elif kind == "carry":
                hp = (shx - 6, sh_y + 3)
            elif kind == "gesture":
                hp = (shx - 5, sh_y + 1 - k)
            elif kind == "lap":
                hp = (shx - 3.5 - k, hip - 2)
            else:
                hp = (shx, sh_y + 6)
            if nm == "F":
                if held and prop_hand == "F" and kind in ("side", "swing", "out", "low", "pump"):
                    hp = (shx - 5, sh_y + 4.5)   # far hand holds the prop in front of the body
                    elbow = None
                elif kind not in ("up",):
                    hp = (hp[0] + 1, hp[1])
            is_left_arm = (nm == "N") != swap if not P["side_arms"] else (nm == "N") != swap
            arm(nm, (shx + (1.5 if kind == "up" else 0), sh_y), hp, z,
                band=armband if (armband and is_left_arm) else False,
                open_hand=P["open_hand"] and kind == "up", sleeve_t=0.12 if kind == "up" else 0.45,
                elbow=elbow)

    # ---- head + hair
    head = m_ellipse(W, H, hcx, head_cy, 10.6, 9.2)
    parts.append(Part("head", head, skin, 5, band=1, light=False, cast=1, casts=True))
    hair, hback = build_hair(spec["style"], d, hcx, head_cy, P["look"])
    hr = HAIR[spec["hair"]]
    hat = acc & {"hardhat", "cap"}
    if hat:
        hair &= ~m_rect(W, H, 0, 0, W, int(head_cy - 3))  # hair under the hat
        if d != "down":
            hair |= m_ellipse(W, H, hcx + (3 if d == "left" else 0), head_cy, 10.6, 9.0) & (
                grid(W, H)[1] < head_cy + (3.5 if d == "up" else 3)) & (
                (grid(W, H)[0] > hcx + 1) if d == "left" else True)
    parts.append(Part("hair", hair, hr, 6, band=1, casts=True, light=True))
    if hback.any():
        parts.append(Part("hair_back", hback, hr, 4.9, band=1, light=True))

    # ---- headgear
    X, Y = grid(W, H)
    if acc & {"beret_red", "beret_dark"}:
        by = head_cy - 8.2
        bx, ang = {"left": (18.0, 0.22), "down": (18.5, 0.20), "up": (13.5, -0.20)}[d]
        bx += hcx - (15.5 if d == "left" else 16.0)
        beret = m_ellipse_rot(W, H, bx, by, 8.2, 3.9, ang)
        beret &= ~m_ellipse(W, H, hcx, head_cy - 1.5, 9.6, 6.2) | m_ellipse(W, H, bx, by - 1.2, 8.2, 3.0)
        nub = m_rect(W, H, int(bx), int(by - 4.8), int(bx) + 1, int(by - 3.5))
        parts.append(Part("beret", beret | nub, RAMP["red"] if "beret_red" in acc else RAMP["dark"], 7, band=0,
                          casts=True))
    if "hardhat" in acc:
        dome = m_ellipse(W, H, hcx, head_cy - 4.0, 10.8, 8.2) & (Y < head_cy - 3)
        if d == "left":
            brim = m_rrect(W, H, hcx - 13.5, head_cy - 4, hcx + 11, head_cy - 3, 0)
        else:
            brim = m_rrect(W, H, hcx - 12.5, head_cy - 4, hcx + 11.5, head_cy - 3, 0)
        parts.append(Part("hardhat", dome | brim, RAMP["white"], 7, band=1, casts=True, light=True))
    if "cap" in acc:
        dome = m_ellipse(W, H, hcx, head_cy - 3.5, 11.0, 8.0) & (Y < head_cy - 2.5)
        if d == "down":
            brim = m_ellipse(W, H, hcx, head_cy - 2.6, 9.5, 2.0) & (Y > head_cy - 3.6)
        elif d == "left":
            brim = m_rrect(W, H, hcx - 13.5, head_cy - 4, hcx - 6, head_cy - 2.5, 1)
        else:
            brim = np.zeros((H, W), bool)
        parts.append(Part("cap", dome, RAMP["orange"], 7, band=1, casts=True, light=True))
        if brim.any():
            parts.append(Part("brim", brim, ["w0", "w1", "w2", "y0"], 7.1, band=0, light=False, casts=True))
    if "headband" in acc:
        ring = m_ellipse(W, H, hcx, head_cy - 0.6, 11.9, 10.1)
        band = ring & (Y >= head_cy - 6) & (Y < head_cy - 4)
        band &= (hair | head)
        if d == "left":
            band |= m_capsule(W, H, (hcx + 10, head_cy - 5), (hcx + 13, head_cy - 1), 1.0)
        if d == "up":
            band |= m_capsule(W, H, (hcx, head_cy - 5), (hcx - 2, head_cy - 1), 1.0) | \
                m_capsule(W, H, (hcx + 1, head_cy - 5), (hcx + 3, head_cy - 1.5), 1.0)
        parts.append(Part("headband", band, RAMP["red"], 7, band=0, light=True))
    if "goggles" in acc:
        ring = m_ellipse(W, H, hcx, head_cy - 0.6, 11.9, 10.1)
        strap = ring & (Y >= head_cy - 7) & (Y < head_cy - 5)
        parts.append(Part("strap", strap, RAMP["dark"], 7, band=0, light=False))
        if d == "down":
            for gx in (hcx - 4.5, hcx + 4.5):
                parts.append(Part("lens", m_ellipse(W, H, gx, head_cy - 6.5, 3.2, 2.9), ["m0", "m1", "m2", "m2"],
                                  7.2, band=0, light=True))
        elif d == "left":
            parts.append(Part("lens", m_ellipse(W, H, hcx - 7, head_cy - 6.5, 2.9, 2.9), ["m0", "m1", "m2", "m2"],
                              7.2, band=0, light=True))
    if acc & {"headphones", "edit_phones"}:
        big = "edit_phones" in acc   # Hinata: big over-ear editing headphones, white band + lilac cups
        g = 0.8 if big else 0.0
        outer = m_ellipse(W, H, hcx, head_cy - 0.6, 12.8 + g, 11.0 + g)
        inner = m_ellipse(W, H, hcx, head_cy - 0.6, 11.0, 9.3)
        if d in ("down", "up"):
            bandm = outer & ~inner & (Y < head_cy - 1)
            cups = m_rrect(W, H, hcx - 13.5 - g, head_cy - 2 - g, hcx - 10, head_cy + 3 + g, 1) | \
                m_rrect(W, H, hcx + 9.5, head_cy - 2 - g, hcx + 13 + g, head_cy + 3 + g, 1)
        else:
            bandm = (outer & (X > hcx + 0.5) & (X < hcx + 3.5) & (Y < head_cy - 1)) & ~inner | \
                (outer & ~inner & (X > hcx - 1) & (X < hcx + 5) & (Y < head_cy - 7))
            cups = m_rrect(W, H, hcx - 0.5 - g, head_cy - 2.5 - g, hcx + 4.5 + g, head_cy + 3 + g, 2)
        parts.append(Part("hp_band", bandm, RAMP["white"] if big else RAMP["dark"], 7, band=0, light=True))
        parts.append(Part("hp_cups", cups, RAMP["lilac"] if big else RAMP["pink"], 7.1, band=0, light=True))
        if big and d != "up":   # white rim on the cup facing the viewer
            if d == "down":
                rim = m_rect(W, H, int(hcx - 13), int(head_cy - 2), int(hcx - 13), int(head_cy + 3)) | \
                    m_rect(W, H, int(hcx + 12.5), int(head_cy - 2), int(hcx + 12.5), int(head_cy + 3))
            else:
                rim = m_ellipse(W, H, hcx + 2, head_cy + 0.3, 1.6, 2.2)
            parts.append(Part("hp_rim", rim & cups, ["m1", "t3", "wh", "wh"], 7.2, outline=False, band=0,
                              light=False))
    if "forehead" in acc:   # Naruto: small navy headband with a metal plate on the forehead
        ring = m_ellipse(W, H, hcx, head_cy - 0.6, 11.9, 10.1)
        band = ring & (Y >= head_cy - 6) & (Y < head_cy - 4) & (hair | head)
        if d == "left":
            band |= m_capsule(W, H, (hcx + 10, head_cy - 5), (hcx + 13.5, head_cy - 1.5), 0.9)
            plate = m_rrect(W, H, hcx - 10.5, head_cy - 7, hcx - 6.5, head_cy - 3, 0)
        elif d == "down":
            plate = m_rrect(W, H, hcx - 3.5, head_cy - 7, hcx + 3.5, head_cy - 3, 0)
        else:
            band |= m_capsule(W, H, (hcx, head_cy - 5), (hcx - 2, head_cy - 1), 0.9) | \
                m_capsule(W, H, (hcx + 1, head_cy - 5), (hcx + 3, head_cy - 1.5), 0.9)
            plate = np.zeros((H, W), bool)
        parts.append(Part("headband", band, RAMP["navy"], 7, band=0, light=True))
        if plate.any():
            parts.append(Part("plate", plate, ["m0", "m1", "m2", "t3"], 7.1, band=0, light=True))

    # ---- crate
    if P["crate"]:
        if d == "down":
            cr, cz = m_rrect(W, H, 10, int(sh_y), 21, int(sh_y) + 8, 1), 4.5
        elif d == "left":
            cr, cz = m_rrect(W, H, 4, int(sh_y) - 1, 13, int(sh_y) + 7, 1), 3.5
        else:
            top = int(head_cy - 16)
            cr, cz = m_rrect(W, H, 9, top, 22, top + 9, 1), 7.9
        parts.append(Part("crate", cr, RAMP["crate"], cz, band=1, light=True))
        if d != "up":
            for p in parts:
                if p.name.endswith("_hand") and not p.name.startswith("F"):
                    p.z = cz + 0.5

    info = dict(d=d, head_cy=head_cy, hcx=hcx, cxi=cxi, hand_pts=hand_pts, prop_hand=prop_hand, P=P, sh_y=sh_y,
                hip=hip, torso_top=torso_top, tx0=tx0, tx1=tx1, swap=swap, held=held, spec=spec, acc=acc)
    return parts, info


# ---------------------------------------------------------------- overlays
EYE_DOWN = ["sKKs", "KWWK", "KWKK", "KBBK", "sKKs"]
EYE_SIDE = ["sKK", "KWW", "KWK", "KBK", "sKK"]
EYE_DOWN_CALM = ["....", "KKKK", "KWBK", "KBBK", "sKKs"]   # flat heavy lid: calm look
EYE_SIDE_CALM = ["...", "KKK", "KWK", "KBK", "sKK"]
EYE_SHUT = {"blink": [(0, 3), (1, 3), (2, 3), (3, 3)],
            "closed": [(0, 2), (1, 3), (2, 3), (3, 2)],
            "happy": [(0, 3), (1, 2), (2, 2), (3, 3)]}


def draw_face(img, info):
    d = info["d"]
    if d == "up":
        return
    spec, P, acc = info["spec"], info["P"], info["acc"]
    skin = SKIN[spec["skin"]]
    cy = info["head_cy"]
    ey = int(math.floor(cy)) + P["look"]
    cx = int(math.floor(info["hcx"] + 0.01))
    K = C("ol0")
    cols = {"K": K, "W": C("wh"), "B": C(spec["eye"]), "s": C(skin[1])}
    BL = C(BLUSH[spec["skin"]])
    S = C(skin[0] if spec["skin"] != "deep" else "ol0")
    eyes = P["eyes"]

    skin_px = {rgb(c) for c in skin}

    def on_face(x, y):
        return 0 <= x < FW and 0 <= y < FH and img.getpixel((x, y))[3] == 255 and \
            img.getpixel((x, y))[:3] in skin_px

    def put_f(x, y, col):
        if on_face(x, y):
            put(img, x, y, col)

    def eye(x, y, pat, w):
        if eyes == "open":
            for yy, row in enumerate(pat):
                for xx, ch in enumerate(row):
                    if ch != ".":
                        put(img, x + xx, y + yy, cols[ch])
        else:
            for xx, yy in EYE_SHUT[eyes]:
                if xx < w:
                    put(img, x + xx, y + yy, K)

    mouth = P["mouth"]
    calm = spec.get("eyes") == "calm"
    if d == "down":
        ex = (cx - 7, cx + 3)
        for x in ex:
            eye(x, ey, EYE_DOWN_CALM if calm else EYE_DOWN, 4)
        for bx in (cx - 9, cx - 8, cx + 7, cx + 8):
            put_f(bx, ey + 5, BL)
        mx, my = cx - 1, ey + 6
    else:
        ex = (cx - 8,)
        eye(cx - 8, ey, EYE_SIDE_CALM if calm else EYE_SIDE, 3)
        for bx in (cx - 7, cx - 6):
            put_f(bx, ey + 5, BL)
        mx, my = cx - 8, ey + 6
    if mouth == "smile":
        put_f(mx, my, S)
        if d == "down":
            put_f(mx + 1, my, S)
            put_f(mx - 1, my - 1, S)
            put_f(mx + 2, my - 1, S)
    elif mouth in ("open", "big") and d == "left":
        put_f(mx, my, K)
        put_f(mx + 1, my, K)
        put_f(mx, my + 1, C("r1"))
        if mouth == "big":
            put_f(mx + 1, my + 1, K)
            put_f(mx, my + 2, K)
    elif mouth == "open":
        put_f(mx, my, K)
        put_f(mx + 1, my, K)
        put_f(mx, my + 1, C("r1"))
        put_f(mx + 1, my + 1, C("r0"))
    elif mouth == "big":
        for xx in range(4):
            put_f(mx - 1 + xx, my, K)
        put_f(mx, my + 1, C("r1"))
        put_f(mx + 1, my + 1, C("r1"))
        put_f(mx - 1, my + 1, K)
        put_f(mx + 2, my + 1, K)
        put_f(mx, my + 2, K)
        put_f(mx + 1, my + 2, K)
    elif mouth == "sleep":
        put_f(mx + (1 if d == "left" else 1), my - (1 if d == "left" else 0), S)
    # glasses
    gl = "glasses" in acc and "m1" or ("glasses_thin" in acc and "r0") or None
    if gl:
        G_ = C(gl)
        if d == "down":
            for x in ex:
                for xx in range(x - 1, x + 5):
                    if xx not in (x - 1, x + 4):
                        put(img, xx, ey - 1, G_)
                        put(img, xx, ey + 5, G_)
                for yy in range(ey, ey + 5):
                    put(img, x - 1, yy, G_)
                    put(img, x + 4, yy, G_)
            for xx in range(ex[0] + 5, ex[1] - 1):
                put(img, xx, ey + 1, G_)
            if False:  # lens glint (off: too busy at 32 px)
                put(img, ex[0], ey, C("wh"))
                put(img, ex[1], ey, C("wh"))
        else:
            x = ex[0]
            for xx in range(x, x + 3):
                put(img, xx, ey - 1, G_)
                put(img, xx, ey + 5, G_)
            for yy in range(ey, ey + 5):
                put(img, x - 1, yy, G_)
                put(img, x + 3, yy, G_)
            for xx in range(x + 4, x + 9):
                if img.getpixel((xx, ey + 1))[:3] in (rgb(skin[2]), rgb(skin[1]), rgb(skin[0])):
                    put(img, xx, ey + 1, G_)


def hair_shine(img, info, lab, order):
    names = [p.name for p in order]
    if "hair" not in names:
        return
    hr = HAIR[info["spec"]["hair"]]
    vis = lab == names.index("hair")
    a = np.array(img)
    base = np.all(a[..., :3] == rgb(hr[2]), axis=-1) & vis
    X, Y = grid(FW, FH)
    cx, cy = info["hcx"] + 1.5, info["head_cy"] + 1.0
    dist = np.hypot(X - cx, Y - cy)
    ang = np.degrees(np.arctan2(Y - cy, X - cx))
    arc = (dist > 7.3) & (dist < 8.5) & (((ang > -150) & (ang < -95)) | ((ang > -85) & (ang < -70)))
    a[base & arc, :3] = rgb(hr[3])
    if info["d"] == "up":
        long_ = info["spec"]["style"] in ("long", "long_fringe")
        for x0, y0, ln in (((12, 2, 8), (16, 1, 10), (20, 3, 7)) if long_ else ((12, 3, 3), (17, 2, 4), (21, 4, 2))):
            for k in range(ln):
                x, y = x0, int(info["head_cy"]) + y0 - 1 + k
                if 0 <= y < FH and vis[y, x] and np.all(a[y, x, :3] == rgb(hr[2])):
                    a[y, x, :3] = rgb(hr[1])
    img.paste(Image.fromarray(a, "RGBA"))


def stamp(img, x0, y0, rows, cmap, flip=False):
    w = max(len(r) for r in rows)
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == "." or ch == " ":
                continue
            xx = x0 + (w - 1 - i if flip else i)
            put(img, xx, y0 + j, C(cmap[ch]))


# held props: drawn for a hand at screen-LEFT, extending up/out to the left; anchor = (ax, ay) in the grid
PROPS = {
    "magnifier": ([".KKK..",
                   "KWaaK.",
                   "KaaaK.",
                   "KaaaK.",
                   ".KKKh.",
                   ".....h"], (5, 6), {"K": "m0", "W": "wh", "a": "a3", "h": "w1"}),
    "megaphone": (["KK.....",
                   "KWK....",
                   "KWyKKK.",
                   "KWyyyyK",
                   "KWyKKK.",
                   "KWK..h.",
                   "KK...h."], (5, 7), {"K": "w0", "W": "wh", "y": "y1", "h": "m1"}),
    "calculator": (["KKKKK",
                    "KgggK",
                    "KmmmK",
                    "KwmwK",
                    "KmwmK",
                    "KKKKK"], (2, 6), {"K": "m0", "g": "q5", "m": "m1", "w": "wh"}),
    "clipboard": ([".KmK.",
                   "BWWWB",
                   "BWllB",
                   "BWWWB",
                   "BWllB",
                   "BWWWB",
                   "BBBBB"], (2, 6), {"K": "m0", "m": "m2", "B": "w1", "W": "wh", "l": "t2"}),
    # spiral notebook with a pen clipped in the spiral (Malu)
    "notebook": ([".....p",
                  "s.s.sp",
                  "KsKsKt",
                  "KWWWK.",
                  "KcccK.",
                  "KlccK.",
                  "KcccK.",
                  "KKKKK."], (2, 7), {"K": "m0", "s": "m2", "W": "wh", "c": "r1", "l": "r2", "p": "y1", "t": "y0"}),
    # clapperboard, striped stick slightly open (Naruto)
    "clapper": (["...KWKW",
                 "KWKWK..",
                 "KWKWKWK",
                 "KmmmmmK",
                 "KmwwwmK",
                 "KmmmmmK",
                 "KKKKKKK"], (3, 6), {"K": "ol0", "W": "wh", "m": "m1", "w": "m2"}),
    # small open laptop held up by the base, lit screen toward the viewer (Sasuke)
    "laptop": (["KKKKKKK",
                "KAaaaaK",
                "KaAaaaK",
                "KaaaaaK",
                "KKKKKKK",
                "mMMMMMm",
                ".mmmmm."], (3, 6), {"K": "ol0", "a": "a1", "A": "a3", "m": "m0", "M": "m2"}),
}
# seen from behind (up view): the lid back instead of the lit screen
PROPS_BACK = {"laptop": {"a": "m1", "A": "m2"}}


def draw_closed_laptop(img, info):
    """sit: the laptop rests closed on the lap"""
    d, hip = info["d"], int(info["hip"])
    if d == "down":
        x0, x1, y0 = 9, 22, hip - 2
    elif d == "left":
        x0, x1, y0 = 7, 16, hip - 3
    else:
        return
    for x in range(x0, x1 + 1):
        put(img, x, y0, C("ol0"))
        put(img, x, y0 + 1, C("m2" if x0 < x < x1 else "ol0"))
        put(img, x, y0 + 2, C("ol0"))
    put(img, (x0 + x1) // 2, y0 + 1, C("wh"))
    sk = SKIN[info["spec"]["skin"]]
    for hp in info["hand_pts"].values():   # hands rest on top of it
        hx, hy = int(math.floor(hp[0])), int(math.floor(hp[1]))
        if x0 <= hx <= x1 and y0 - 2 <= hy <= y0 + 2:
            put(img, hx, y0, C(sk[2]))
            put(img, hx + 1, y0, C(sk[1]))


def draw_lap_laptop(img, info):
    """type: open laptop on the knees, hands on the keyboard behind the lid"""
    d, hip = info["d"], int(info["hip"])
    if d == "down":   # we see the back of the lid
        top = int(math.floor(info["head_cy"] + 9.2)) + 1
        x0, x1, y1 = 10, 21, hip + 2
        for y in range(top, y1 + 1):
            for x in range(x0, x1 + 1):
                edge = x in (x0, x1) or y in (top, y1)
                put(img, x, y, C("ol0" if edge else ("m2" if y == top + 1 else "m1")))
        put(img, (x0 + x1) // 2, (top + y1) // 2 + 1, C("wh"))
        for x in (x0 + 1, x1 - 1):   # screen glow spilling past the lid edges
            put(img, x, top - 1, C("a3"))
    elif d == "left":   # side: base on the thighs, lid up at the front with the lit screen facing the bot
        hp = info["hand_pts"]["N"]
        hx, hy = int(math.floor(hp[0])), int(math.floor(hp[1]))
        by = hy + 2
        for x in range(hx - 4, hx + 4):
            put(img, x, by, C("ol0"))
            put(img, x, by - 1, C("m2") if x > hx - 4 else C("ol0"))
        for k in range(1, 7):
            x, y = hx - 4 - k // 3, by - 1 - k
            put(img, x, y, C("ol0"))
            if k < 6:
                put(img, x + 1, y, C("a3" if k == 3 else "a1"))
        put(img, hx, hy, C(SKIN[info["spec"]["skin"]][2]))


def draw_brush(img, info, hp):
    d = info["d"]
    hx, hy = int(math.floor(hp[0])), int(math.floor(hp[1]))
    up_side = d == "left" and info["prop_hand"] == "N" and info["P"]["side_arms"] is None and False
    if d == "down":
        pts = [(hx - 1, hy - 1, "w1"), (hx - 2, hy - 2, "w2"), (hx - 2, hy - 3, "w2"), (hx - 3, hy - 4, "m2"),
               (hx - 3, hy - 5, "a1"), (hx - 4, hy - 6, "a2")]
    elif d == "left" or up_side:
        pts = [(hx - 2, hy, "w1"), (hx - 3, hy, "w2"), (hx - 4, hy - 1, "w2"), (hx - 5, hy - 1, "m2"),
               (hx - 6, hy - 1, "a1"), (hx - 7, hy - 2, "a2")]
    else:
        pts = [(hx + 1, hy - 1, "w1"), (hx + 2, hy - 2, "w2"), (hx + 2, hy - 3, "w2"), (hx + 3, hy - 4, "m2"),
               (hx + 3, hy - 5, "a1"), (hx + 4, hy - 6, "a2")]
    for x, y, c in pts:
        put(img, x, y, C(c))
    sgn = -1 if d != "up" else 1
    if d == "left":
        sgn = 0
    for x, y, c in pts[:3]:
        if sgn and 0 <= x + sgn < FW and 0 <= y < FH and img.getpixel((x + sgn, y))[3] == 0:
            put(img, x + sgn, y, C("w0"))
    if d == "left":
        for x, y, c in pts[:4]:
            if 0 <= y + 1 < FH and img.getpixel((x, y + 1))[3] == 0:
                put(img, x, y + 1, C("w0"))


def draw_props(img, info):
    acc, d, P = info["acc"], info["d"], info["P"]
    if info["held"]:
        hp = info["hand_pts"].get(info["prop_hand"])
        if hp is not None:
            name = [n for n in HELD_ORDER if n in acc][0]
            if name == "laptop" and P["arm_l"][0] == "lap":
                draw_closed_laptop(img, info)
            elif name == "brush":
                draw_brush(img, info, hp)
            else:
                rows, (ax, ay), cmap = PROPS[name]
                hx, hy = int(math.floor(hp[0])), int(math.floor(hp[1]))
                w = max(len(r) for r in rows)
                x0 = hx - (w - 1 - ax) if d == "up" else hx - ax
                x0 = min(max(x0, 1), FW - 1 - w)   # never clip at the frame edge
                if d == "up" and name in PROPS_BACK:
                    cmap = dict(cmap, **PROPS_BACK[name])
                stamp(img, x0, max(1, hy - ay), rows, cmap, flip=d == "up")
                # re-draw the fist over the handle so it reads as held
                sk = SKIN[info["spec"]["skin"]]
                for dx, dy in ((0, 0), (-1, 0), (0, -1) if name in ("calculator", "clipboard") else (0, 0)):
                    pass
                put(img, hx, hy, C(sk[2]))
    if "laptop" in acc and P["arm_l"][0] == "type":
        draw_lap_laptop(img, info)
    cx = info["cxi"]
    tt, hip = int(info["torso_top"]), int(info["hip"])
    head_bottom = int(math.floor(info["head_cy"] + 9.2))
    chest = max(tt + 2, head_bottom + 1)
    if d == "down":
        if "badge" in acc:
            stamp(img, cx + 2, chest, ["aba", "bcb", "aba", ".a."], {"a": "y0", "b": "y1", "c": "y2"})
        if "coin" in acc:
            stamp(img, cx + 2, chest, [".a.", "aca", ".a."], {"a": "y0", "c": "y1"})
            put(img, cx + 3, chest + 1, C("y2"))
        if "star" in acc:
            stamp(img, cx + 3, chest, [".a.", "aca", ".a."], {"a": "y1", "c": "y2"})
        if "flashlight" in acc:
            stamp(img, cx - 6, hip - 2, ["Kmmy", "KKKy"], {"K": "m0", "m": "m2", "y": "y1"})
    elif d == "left":
        fx = int(info["tx0"]) + 1
        if "badge" in acc:
            stamp(img, fx, chest, ["ab", "bc", ".a"], {"a": "y0", "b": "y1", "c": "y2"})
        if "coin" in acc:
            stamp(img, fx, chest, ["ab", "ba"], {"a": "y0", "b": "y1"})
        if "star" in acc:
            stamp(img, fx + 2, chest, [".a.", "aca", ".a."], {"a": "y1", "c": "y2"})
        if "flashlight" in acc and info["swap"]:
            stamp(img, 15, hip - 2, ["ymmK", "yKKK"], {"K": "m0", "m": "m2", "y": "y1"})
    elif d == "up":
        if "flashlight" in acc:
            stamp(img, cx + 3, hip - 2, ["ymmK", "yKKK"], {"K": "m0", "m": "m2", "y": "y1"})
    # deck pin on the cap
    if "deckpin" in acc:
        cy = info["head_cy"]
        if d == "down":
            stamp(img, cx - 2, int(cy - 9), ["KKKKK", "KWWWK", "KaWaK", "KWWWK", "KKKKK"],
                  {"K": "ol0", "W": "wh", "a": "a1"})
        elif d == "left":
            stamp(img, cx - 4, int(cy - 9), ["KKKK", "KWWK", "KaWK", "KKKK"], {"K": "ol0", "W": "wh", "a": "a1"})
    if "goggles" in acc:
        cy = info["head_cy"]
        if d == "down":
            for gx in (info["hcx"] - 4.5, info["hcx"] + 4.5):
                x, y = int(math.floor(gx)), int(math.floor(cy - 6.5))
                put(img, x - 1, y - 1, C("a3"))
                put(img, x, y, C("a2"))
                put(img, x - 1, y, C("a2"))
                put(img, x, y - 1, C("a2"))
        elif d == "left":
            x, y = int(math.floor(info["hcx"] - 7)), int(math.floor(cy - 6.5))
            put(img, x - 1, y - 1, C("a3"))
            put(img, x, y, C("a2"))
            put(img, x - 1, y, C("a2"))
            put(img, x, y - 1, C("a2"))
    if "hardhat" in acc:
        cy = info["head_cy"]
        if d in ("down", "up"):
            for y in range(int(cy - 11), int(cy - 4)):
                if img.getpixel((cx, y))[:3] == rgb("wh"):
                    put(img, cx, y, C("t3"))


def draw_crate_detail(img, lab, order):
    names = [p.name for p in order]
    if "crate" not in names:
        return
    vis = lab == names.index("crate")
    ys, xs = np.nonzero(vis)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    mid = (y0 + y1) // 2
    for x in range(x0 + 1, x1):
        if vis[mid, x]:
            put(img, x, mid, C("w1"))
    for y in range(y0 + 1, y1):
        for x in (x0 + 2, x1 - 2):
            if vis[y, x] and y != mid:
                put(img, x, y, C("w1"))


def shadow_layer(P):
    air = -min(0, P["dy"])
    rx = (7.0 if P["seat"] else 8.5) - air * 0.35
    m = m_ellipse(FW, FH, 16, GROUND - 0.4, rx, 1.85)
    inner = m_ellipse(FW, FH, 16, GROUND - 0.4, rx - 2, 1.2)
    a = np.zeros((FH, FW), np.uint8)
    a[m] = 70 - air * 3
    a[inner] = 95 - air * 4
    arr = np.zeros((FH, FW, 4), np.uint8)
    arr[..., :3] = rgb("ol0")
    arr[..., 3] = a
    return Image.fromarray(arr, "RGBA")


def clean_strays(img, shirt):
    """remove isolated opaque pixels (no 4-neighbour) - stray-pixel guard"""
    a = np.array(img)
    op = a[..., 3] > 0
    n = np.zeros_like(op, dtype=int)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n += G.shift(op, dx, dy, fill=False)
    stray = op & (n == 0)
    a[stray] = 0
    return Image.fromarray(a, "RGBA"), shirt & ~stray, int(stray.sum())


STRAYS = [0]


def render_bot(spec, d, P, mirror=False):
    parts, info = build_bot(spec, "left" if mirror else d, P, swap=mirror)
    arr, lab, order = render_parts(parts, FW, FH)
    img = Image.fromarray(arr, "RGBA")
    shirt = np.zeros((FH, FW), bool)
    for i, p in enumerate(order):
        if p.shirt:
            shirt |= lab == i
    hair_shine(img, info, lab, order)
    draw_face(img, info)
    draw_crate_detail(img, lab, order)
    draw_props(img, info)
    img, shirt, ns = clean_strays(img, shirt)
    STRAYS[0] += ns
    if mirror:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
        shirt = shirt[:, ::-1]
    a = np.array(img)
    shirt &= a[..., 3] > 0
    is_sh = np.zeros_like(shirt)
    for c in SHIRT:
        is_sh |= np.all(a[..., :3] == rgb(c), axis=-1)
    shirt &= is_sh
    base = shadow_layer(P)
    base.alpha_composite(img)
    return base, Image.fromarray((shirt * 255).astype(np.uint8), "L")


def bot_sheet(spec):
    A = anim_poses()
    rows, meta, r = [], {}, 0
    for an in ANIMS:
        frames = A[an]
        meta[an] = {"row": r, "rows": {}, "frames": len(frames), "fps": FPS[an]}
        for d in DIRS:
            fr = [render_bot(spec, "left", P, mirror=True) if d == "right" else render_bot(spec, d, P)
                  for P in frames]
            rows.append((an, d, fr))
            meta[an]["rows"][d] = r
            r += 1
    sheet = Image.new("RGBA", (COLS * FW, len(rows) * FH), (0, 0, 0, 0))
    mask = Image.new("L", sheet.size, 0)
    for ri, (an, d, fr) in enumerate(rows):
        for fi, (im, mk) in enumerate(fr):
            sheet.alpha_composite(im, (fi * FW, ri * FH))
            mask.paste(mk, (fi * FW, ri * FH))
    return sheet, mask, meta, rows


# ---------------------------------------------------------------- fx: zzz
def fx_zzz():
    """3 frames 16x16: small 'z' glyphs drifting up and to the right (white, blue drop shadow)."""
    small = ["XXX", "..X", ".X.", "XXX"]
    mid = ["XXXX", "..X.", ".X..", "XXXX"]
    big = ["XXXXX", "...X.", "..X..", ".X...", "XXXXX"]
    # (glyph, x, y) per frame: each z rises 2 px per frame; a new one is born at the bottom
    plan = [
        [(small, 1, 11), (mid, 5, 6), (big, 10, 0)],
        [(small, 2, 9), (mid, 6, 4)],
        [(small, 3, 7), (mid, 8, 1)],
    ]
    out = Image.new("RGBA", (48, 16), (0, 0, 0, 0))
    for f, items in enumerate(plan):
        fr = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        for glyph, x, y in items:
            for j, row in enumerate(glyph):
                for i, ch in enumerate(row):
                    if ch == "X" and j == len(glyph) - 1:
                        px, py = x + i, y + j + 1
                        if px < 16 and py < 16 and fr.getpixel((px, py))[3] == 0:
                            put(fr, px, py, C("a1"))
            for j, row in enumerate(glyph):
                for i, ch in enumerate(row):
                    if ch == "X" and 0 < j < len(glyph) - 1 and x + i + 1 < 16:
                        put(fr, x + i + 1, y + j, C("a1"))
            for j, row in enumerate(glyph):
                for i, ch in enumerate(row):
                    if ch == "X":
                        put(fr, x + i, y + j, C("wh"))
        out.alpha_composite(fr, (f * 16, 0))
    return out


# ---------------------------------------------------------------- previews
def tint_ramp(hexcol):
    r, g, b = int(hexcol[1:3], 16), int(hexcol[3:5], 16), int(hexcol[5:7], 16)
    base = np.array([r, g, b], float)
    light = base + (255 - base) * 0.5
    mid = base * 0.72
    dark = base * 0.42 + np.array([20, 10, 30])
    return [tuple(int(min(255, v)) for v in c) for c in (dark, mid, base, light)]


def tinted(img, hexcol):
    a = np.array(img)
    tr = tint_ramp(hexcol)
    for c, t in zip(SHIRT_VILA, tr):
        sel = np.all(a[..., :3] == c, axis=-1) & (a[..., 3] == 255)
        a[sel, :3] = t
    return Image.fromarray(a, "RGBA")


def frame_of(sheet, meta, an, d, i):
    r = meta[an]["rows"][d]
    return sheet.crop((i * FW, r * FH, (i + 1) * FW, (r + 1) * FH))


def label_font(n):
    return G.font(n)


def lineup(sheets, path):
    S = 4
    n = len(sheets)
    cols = 11
    cw, ch = FW * S + 12, FH * S + 30
    im = Image.new("RGB", (cols * cw + 12, ((n + cols - 1) // cols) * ch + 12), (236, 228, 210))
    d = ImageDraw.Draw(im)
    f = label_font(16)
    for k, (spec, sheet, meta) in enumerate(sheets):
        fr = tinted(frame_of(sheet, meta, "idle", "down", 0), spec["shirt"]).resize((FW * S, FH * S), Image.NEAREST)
        x, y = 12 + (k % cols) * cw, 6 + (k // cols) * ch
        im.paste(fr, (x, y), fr)
        d.text((x + 4, y + FH * S + 4), spec["id"], fill=rgb("ol0"), font=f)
    im.save(path)


def gif_fixed(sheets, path, ids):
    S = 8
    sel = [s for s in sheets if s[0]["id"] in ids]
    cw, ch = FW * S, FH * S
    f = label_font(18)
    frames, durs = [], []
    for an, loops in (("sleep", 4), ("sit", 4), ("celebrate", 3)):
        n = sel[0][2][an]["frames"]
        for _ in range(loops):
            for i in range(n):
                im = Image.new("RGB", (4 * cw, len(sel) * ch + 34), (236, 228, 210))
                d = ImageDraw.Draw(im)
                d.text((8, 7), "%s  (%d/%d)   left / down / up / right" % (an, i + 1, n), fill=rgb("ol0"), font=f)
                for r, (spec, sheet, meta) in enumerate(sel):
                    for k, dn in enumerate(DIRS):
                        fr = tinted(frame_of(sheet, meta, an, dn, i), spec["shirt"]).resize((cw, ch), Image.NEAREST)
                        im.paste(fr, (k * cw, 34 + r * ch), fr)
                    if an == "sleep":
                        z = fx_zzz().crop((((i * 2) % 3) * 16, 0, ((i * 2) % 3) * 16 + 16, 16)).resize((16 * S // 2 * 2 // 2, 16 * S // 2 * 2 // 2), Image.NEAREST)
                        for k in range(4):
                            im.paste(z, (k * cw + cw - z.width - 8, 34 + r * ch + 10), z)
                frames.append(im)
                durs.append(125)
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=durs, loop=0)


def gif_all(sheets, path, ids):
    """every animation x 4 directions for the given bots, 8x, 8 fps"""
    S = 8
    sel = [s for s in sheets if s[0]["id"] in ids]
    cw, ch = FW * S, FH * S
    f = label_font(18)
    frames = []
    for an in ANIMS:
        n = sel[0][2][an]["frames"]
        for i in [k % n for k in range(max(8, n * 2))]:
            im = Image.new("RGB", (4 * cw + 110, len(sel) * ch + 34), (236, 228, 210))
            d = ImageDraw.Draw(im)
            d.text((8, 7), "%s  (%d/%d)   left / down / up / right" % (an, i + 1, n), fill=rgb("ol0"), font=f)
            for r, (spec, sheet, meta) in enumerate(sel):
                d.text((4 * cw + 8, 34 + r * ch + ch // 2), spec["id"], fill=rgb("ol0"), font=f)
                for k, dn in enumerate(DIRS):
                    fr = tinted(frame_of(sheet, meta, an, dn, i), spec["shirt"]).resize((cw, ch), Image.NEAREST)
                    im.paste(fr, (k * cw, 34 + r * ch), fr)
                if an == "sleep":
                    z = fx_zzz().crop((((i * 2) % 3) * 16, 0, ((i * 2) % 3) * 16 + 16, 16)).resize((64, 64), Image.NEAREST)
                    for k in range(4):
                        im.paste(z, (k * cw + cw - z.width - 8, 34 + r * ch + 10), z)
            frames.append(im)
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=125, loop=0)


def gif_walk(sheets, path):
    S = 4
    cw, ch = FW * S, FH * S
    f = label_font(14)
    frames = []
    for loop in range(3):
        for i in range(6):
            cols = (len(sheets) + 1) // 2
            im = Image.new("RGB", (cols * cw, 2 * (ch + 18)), (236, 228, 210))
            d = ImageDraw.Draw(im)
            for k, (spec, sheet, meta) in enumerate(sheets):
                fr = tinted(frame_of(sheet, meta, "walk", "down", i), spec["shirt"]).resize((cw, ch), Image.NEAREST)
                x, y = (k % cols) * cw, (k // cols) * (ch + 18)
                im.paste(fr, (x, y), fr)
                d.text((x + 6, y + ch), spec["id"], fill=rgb("ol0"), font=f)
            frames.append(im)
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=100, loop=0)


def contact(spec, rows, path):
    S = 3
    lab_w = 120
    W = lab_w + COLS * (FW * S + 3)
    H = len(rows) * (FH * S + 3)
    im = Image.new("RGB", (W, H), (236, 228, 210))
    d = ImageDraw.Draw(im)
    f = label_font(13)
    for ri, (an, dn, fr) in enumerate(rows):
        y = ri * (FH * S + 3)
        if ri % 2:
            d.rectangle((0, y, W, y + FH * S + 2), fill=(226, 216, 196))
        d.text((6, y + FH * S // 2 - 7), "%s / %s" % (an, dn), fill=rgb("ol0"), font=f)
        for fi, (fimg, _) in enumerate(fr):
            big = to_vila48(fimg, spec["id"]).resize((FW * S, FH * S), Image.NEAREST)
            im.paste(big, (lab_w + fi * (FW * S + 3), y + 1), big)
    im.save(path)


# Paleta Vila 48 'agua' ramp neighbours: the Deck avatar shirt is baked blue so it reads on grass, dirt and stone
DECK_SHIRT = {"g0": "#2d6e7a", "g1": "#538aa3", "g2": "#71a2cc", "g3": "#92baf4"}


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def bake_deck_shirt(sheet, mask):
    a = np.array(sheet.convert("RGBA"))
    on = np.array(mask.convert("L")) > 0
    for src, dst in DECK_SHIRT.items():
        hit = on & np.all(a[..., :3] == rgb(src), axis=-1)
        a[hit, :3] = hexrgb(dst)
    return Image.fromarray(a, "RGBA")


# Paleta Vila 48 (lina/vila/ui-kit/paleta-48.json): 8 ramps x 6 tones, dark -> light
VILA48 = {
    "verde": ["#1f280f", "#35511a", "#477a2d", "#62a353", "#75cc71", "#92f49c"],
    "folha": ["#28230f", "#514d1a", "#747a2d", "#91a353", "#aacc71", "#c2f492"],
    "terra": ["#280f0f", "#51221a", "#7a432d", "#a37653", "#cca671", "#f4da92"],
    "telha": ["#280f17", "#511a24", "#7a2d30", "#a35c53", "#f97316", "#f4ba92"],
    "pele": ["#4c2226", "#6f3b38", "#915f53", "#b48871", "#d7b494", "#f5e6c8"],
    "agua": ["#0f2825", "#1a5051", "#2d6e7a", "#538aa3", "#71a2cc", "#92baf4"],
    "lilas": ["#0f1028", "#1f1a51", "#3f2d7a", "#7253a3", "#a271cc", "#d592f4"],
    "pedra": ["#1e1a2b", "#424a50", "#656d78", "#898fa0", "#afb3c7", "#d8d7ef"],
}

# Every drawing colour the bots use -> one Paleta Vila 48 tone ("ramp-index"). Targets are the CIEDE2000
# nearest tone, moved to a free neighbour where the nearest would merge two tones of the same ramp or
# break its dark -> light order. The shirt base g0..g3 owns verde-2..5 alone (the foliage greens go to
# folha), so a recolour by colour equality still hits only the shirt. Known merges, never inside one part:
# p0/m0 (near-black cool), s3/t4/y2 (cream), w3/t2/y0/h3 (caramel), s2/r2 (peach), s0/t0, s1/t1, w2/h2,
# k0/c0, k1/c1. The palette has one saturated warm (telha-4): it is the red base r1, since the nearest
# tone (telha-3) made a red beret melt into chestnut hair, and amber y0 gives it up to stay a hair tone.
VILA48_REMAP = {
    "ol0": "pedra-0", "ol1": "telha-1",
    "s0": "pele-2", "s1": "pele-3", "s2": "telha-5", "s3": "pele-5",
    "h0": "pele-0", "h1": "pele-1", "h2": "terra-3", "h3": "terra-4",
    "g0": "verde-2", "g1": "verde-3", "g2": "verde-4", "g3": "verde-5",
    "p0": "lilas-1", "p1": "lilas-2", "p2": "lilas-3",
    "w0": "terra-1", "w1": "terra-2", "w2": "terra-3", "w3": "terra-4",
    "t0": "pele-2", "t1": "pele-3", "t2": "terra-4", "t3": "pele-4", "t4": "pele-5",
    "q0": "verde-1", "q1": "folha-2", "q2": "folha-3", "q3": "folha-4", "q4": "folha-5", "q5": "folha-5",
    "a0": "agua-1", "a1": "agua-3", "a2": "agua-4", "a3": "agua-5",
    "y0": "terra-4", "y1": "terra-5", "y2": "pele-5",
    "r0": "telha-2", "r1": "telha-4", "r2": "telha-5",
    "wh": "pedra-5",
    "m0": "lilas-1", "m1": "pedra-1", "m2": "pedra-2",
    "k0": "lilas-4", "k1": "lilas-5",
    "c0": "lilas-4", "c1": "lilas-5",
}
assert set(VILA48_REMAP) == set(PALETTE)
# amber y0 on the Deck sheet is only the cap: it stays the orange that identifies the avatar
VILA48_BOT_REMAP = {"deck": {"y0": "telha-4"}}


def vila(tone):
    ramp, i = tone.split("-")
    return VILA48[ramp][int(i)]


VILA48_RGB = {hexrgb(h) for ramp in VILA48.values() for h in ramp}
VILA_OUTLINE = hexrgb(vila(VILA48_REMAP["ol0"]))
VILA_LUT = {rgb(n): hexrgb(vila(t)) for n, t in VILA48_REMAP.items()}
assert not set(VILA_LUT) & VILA48_RGB and {hexrgb(h) for h in DECK_SHIRT.values()} <= VILA48_RGB
SHIRT_VILA = [VILA_LUT[rgb(c)] for c in SHIRT]


def to_vila48(img, bot=None):
    """recolour a finished frame or sheet: PALETTE -> Paleta Vila 48; colours already in Vila 48 are kept"""
    a = np.array(img.convert("RGBA"))
    src = a.copy()
    seen = a[..., 3] > 0
    lut = {**VILA_LUT, **{rgb(n): hexrgb(vila(t)) for n, t in VILA48_BOT_REMAP.get(bot, {}).items()}}
    for old, new in lut.items():
        a[seen & np.all(src[..., :3] == old, axis=-1), :3] = new
    a[seen & (a[..., 3] < 255), :3] = VILA_OUTLINE
    return Image.fromarray(a, "RGBA")


def check_palette(img):
    """pixels outside the contract: opaque = Paleta Vila 48 only, translucent = the Vila outline only"""
    a = np.array(img.convert("RGBA"))
    px, n = np.unique(a[a[..., 3] > 0], axis=0, return_counts=True)
    bad = 0
    for (r, g, b, al), k in zip(px.tolist(), n.tolist()):
        if ((r, g, b) != VILA_OUTLINE) if al < 255 else ((r, g, b) not in VILA48_RGB):
            bad += k
    return bad


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "out", "v2")
    prev = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "out", "v2-preview")
    only = sys.argv[3].split(",") if len(sys.argv) > 3 else None
    os.makedirs(os.path.join(out, "bots"), exist_ok=True)
    os.makedirs(prev, exist_ok=True)
    sheets, bad = [], 0
    bots_meta = {}
    anim_meta = None
    for row in BOTS:
        spec = bot_spec(row)
        if only and spec["id"] not in only:
            continue
        sheet, mask, meta, rows = bot_sheet(spec)
        if spec["id"] == "deck":
            sheet = bake_deck_shirt(sheet, mask)
        sheet = to_vila48(sheet, spec["id"])
        sheet.save(os.path.join(out, "bots", spec["id"] + ".png"), optimize=True)
        mask.save(os.path.join(out, "bots", spec["id"] + "-shirt.png"), optimize=True)
        contact(spec, rows, os.path.join(prev, "contact-%s.png" % spec["id"]))
        bad += check_palette(sheet)
        sheets.append((spec, sheet, meta))
        anim_meta = meta
        bots_meta[spec["id"]] = {"name": spec["name"], "role": spec["role"], "accessory": spec["accessory"],
                                 "skin": spec["skin"], "hair": "%s %s" % (spec["hair"], spec["style"].replace("_", " ")),
                                 "default_shirt": spec["shirt"], "sheet": "bots/%s.png" % spec["id"],
                                 "shirt_mask": "bots/%s-shirt.png" % spec["id"]}
    fx_zzz().save(os.path.join(out, "fx-zzz.png"))
    if not only:
        meta = {
            "frame": {"w": FW, "h": FH, "origin": [16, GROUND],
                      "note": "origin = bottom-centre; feet on row 46, row 47 empty"},
            "sheet": {"w": COLS * FW, "h": len(ANIMS) * len(DIRS) * FH, "columns": COLS},
            "directions": DIRS,
            "shirt_ramp": ["#%02x%02x%02x" % c for c in SHIRT_VILA],
            "animations": {an: {"row": v["row"], "rows": v["rows"], "frames": v["frames"], "fps": v["fps"]}
                           for an, v in anim_meta.items()},
            "fx": {"zzz": {"image": "fx-zzz.png", "frame": {"w": 16, "h": 16}, "frames": 3, "fps": 3,
                           "note": "draw above the head of a sleeping bot (sleep animation), offset ~(+8, -40) "
                                   "from the bot origin"}},
            "bots": bots_meta,
        }
        json.dump(meta, open(os.path.join(out, "bots.json"), "w"), indent=2, ensure_ascii=False)
        lineup(sheets, os.path.join(prev, "vila-bots-lineup.png"))
        gif_fixed(sheets, os.path.join(prev, "vila-bots-sleep-sit-celebrate.gif"), ["nami", "anderson", "iris", "vegeta"])
        gif_walk(sheets, os.path.join(prev, "vila-bots-walk-all.gif"))
        gif_all(sheets, os.path.join(prev, "vila-bots-new4.gif"), ["malu", "naruto", "sasuke", "hinata"])
    print("bots:", len(sheets), "palette colours:", len(VILA48_RGB), "off-palette px:", bad,
          "strays removed:", STRAYS[0])


if __name__ == "__main__":
    main()
