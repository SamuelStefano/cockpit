#!/usr/bin/env python3
"""Builds the F5 effect sheets into public/world/v2/fx/: fountain, smoke, rain, confetti, boat-deploy,
night, bug-fish (.png) plus fx.json (every animation) and night.json + night-lut.png. Deterministic.

Run from anywhere: python3 scripts/world-v2/fx.py
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "public", "world", "v2", "fx")

from fxkit import Sheet, audit_fx, audit_overlay, baked_shadow_px  # noqa: E402
import fx_fountain as ff  # noqa: E402
import fx_particles as fp  # noqa: E402
import fx_weather as fw  # noqa: E402
import fx_boat as fb  # noqa: E402
import fx_night as fn  # noqa: E402
import fx_bug as fg  # noqa: E402


def fountain():
    S = Sheet("fountain.png")
    day, night = ff.fountain_rows()
    note = "replaces the 3x3 `fountain` tile item; top-left on the same tile; shadow stays `fountain_shadow`"
    S.add("fountain_day", day, 8, (48, 88), note=note, tiles=[3, 3])
    S.add("fountain_night", night, 8, (48, 88), tiles=[3, 3],
          note="night row: lit pool + brighter sparkles + faint halo; pair with night `fountain_underglow` (add)")
    return S


def smoke():
    S = Sheet("smoke.png")
    rows = fp.smoke_rows()
    S.add("smoke_chimney", rows["chimney"], 6, (14, 60), layer="above",
          note="anchor = chimney mouth; 4 puffs per loop")
    S.add("smoke_tower", rows["tower"], 6, (16, 60), layer="above",
          note="server tower under high load (state yellow/red); anchor = top of the mast")
    S.add("smoke_boat", rows["boat"], 6, (15, 29), layer="above", note="failed deploy boat deck smoke")
    return S


def rain():
    S = Sheet("rain.png")
    S.add("rain", fw.rain_frames(), 10, (0, 0), layer="screen",
          note="64x64 seamless overlay, tile it over the view in screen space; 2 depth layers")
    S.add("rain_splash", fw.splash_frames(), 10, (16, 12), loop=False,
          note="ground splash, spawn at random walkable spots")
    S.add("rain_ripple", fw.ripple_frames(), 8, (16, 8), loop=False, note="puddle / water ripple")
    S.add("rain_puddle", [fw.puddle()], 1, (16, 8), layer="ground", note="static puddle, under the ripples")
    S.add("sky_tint", fw.sky_tints(), 0, (0, 0), layer="screen",
          note="dim-sky tint: single colour p0, frames = 3 strengths (drizzle, rain, storm); stretch over the view")
    return S


def confetti():
    S = Sheet("confetti.png")
    S.add("confetti_burst", fp.burst_frames(), 12, fp.BURST_ANCHOR, loop=False, layer="above",
          note="merge burst, one-shot, %d pieces of 2x2 / 3x2 px; anchor = the bot's feet, pops at (%d, %d) "
               "just above the head; spread stays within ~3 tiles" % ((fp.BURST_PIECES,) + fp.BURST_POP))
    S.add("confetti_fall", fp.fall_frames(), 8, fp.FALL_ANCHOR, layer="above",
          note="falling loop around the bot (anchor = feet): %d frames x %d px = %d px seamless; pieces "
               "fall %d px/frame inside a 96x48 px radius ellipse; play after confetti_burst"
               % (fp.FALL_N, fp.FALL_STEP, fp.FALL_H, fp.FALL_STEP))
    S.add("star_pop", fp.star_pop_frames(), 10, (16, 17), loop=False, layer="above", note="level up")
    return S


def boat():
    S = Sheet("boat-deploy.png")
    a = fb.ANCHOR
    S.add("boat_depart", fb.depart_frames(), 8, a, loop=False,
          note="docked -> casts off the rope (0-2) -> mast light on (3) -> engine puffs (4-6) -> wake (7-11); "
               "faces right, tween the sprite to the right from frame 7")
    S.add("boat_sail", fb.sail_frames(), 8, a, note="sailing right with wake; flipX to sail left")
    S.add("boat_return", fb.return_frames(), 6, (96 - a[0], a[1]),
          note="failed deploy: dented bow, deck smoke, drooping flag, red mast light; faces LEFT (back to the dock)")
    S.add("boat_docked", fb.docked_frames(), 4, a, note="idle at the dock, rope to the left edge (bollard)")
    S.add("boat_wake", fb.wake_strip(), 8, (63, 8),
          note="standalone wake overlay, stern at the right edge; rotate / flip with the boat")
    return S


def night():
    S = Sheet("night.png")
    g = fn.lamp_glows()
    for k, r in (("s", 24), ("m", 40), ("l", 56)):
        S.add("lamp_glow_" + k, g[k], 3, (r, r), blend="add", layer="light",
              note="radius %d px, warm (y0 rim, y2 core), Bayer-dithered edge; centre on the lamp head; "
                   "alternate frames at random for flicker" % r)
    w = fn.window_lights()
    p = fn.WIN_PAD
    for k, (ww, hh) in fn.WIN_SIZES.items():
        S.add("window_light_" + k, w[k], 2, ((ww + 2 * p) // 2, (hh + 2 * p) // 2), blend="add", layer="light",
              note="pane %dx%d px + %d px dithered halo; centre on the window glass" % (ww, hh, p))
    S.add("delegacia_cone", [fn.delegacia_cone()], 0, (32, 0), blend="add", layer="light",
          note="security (Delegacia) door lamp: top centre at the lamp, falls onto the sidewalk")
    S.add("siren_flash", fn.siren_flash(), 4, (48, 32), blend="add", layer="light",
          note="frame 0 red, 1 blue; top-left = siren tile top-left + (-16, -16)")
    S.add("fountain_underglow", fn.fountain_underglow(), 4, (48, 54), blend="add", layer="light",
          note="warm, dithered; same top-left as the fountain")
    lights, glows = fn.string_lights()
    S.add("string_lights", lights, 2, (0, 3), layer="emissive", note="64 px segment, wire ends at y=3 on both edges")
    S.add("string_lights_glow", glows, 2, (0, 3), blend="add", layer="light", note="draw on top of string_lights")
    heads = fn.emissive_heads()
    S.add("lamp_head", [heads["lamp_head"]], 0, (16, 63), layer="emissive",
          note="lit pixels of `lamp_night`, same placement; draw after the LUT so the lamp stays bright")
    S.add("wall_lamp_head", [heads["wall_lamp_head"]], 0, (16, 31), layer="emissive",
          note="lit pixels of `wall_lamp_night`")
    bays = fn.lit_bays()
    S.add("lit_windows", [bays[n] for n in fn.LIT_BAYS], 0, (0, 0), layer="emissive",
          note="night versions of the 1x2 bay overlays, frame order = " + ", ".join(fn.LIT_BAYS))
    return S


def bug():
    S = Sheet("bug-fish.png")
    r = fg.all_rows()
    S.add("bug_swim_left", r["swim_left"], 8, (15, 12), note="Bug swimming left (32x20)")
    S.add("bug_swim_right", r["swim_right"], 8, (16, 12), note="mirror of swim_left")
    S.add("bug_blink", r["blink"], 8, (15, 12), loop=False, note="open, half, closed; play 0-1-2-1-0")
    S.add("bug_jump", r["jump"], 10, (24, 46), loop=False,
          note="leaves the water at x=37, lands at x=11 (surface y=46); follow with bug_splash at x=11")
    S.add("bug_splash", r["splash"], 10, (24, 24), loop=False, note="splash-back, surface at y=24")
    S.add("bug_wink", r["wink"], 6, (15, 26), loop=False, note="pops up and winks, surface at y=26")
    tl, tr = fg.tiny_rows()
    S.add("bug_tiny_left", tl, 6, (7, 5), note="16x10 shallow-shore Bug")
    S.add("bug_tiny_right", tr, 6, (8, 5))
    return S


def main():
    os.makedirs(OUT, exist_ok=True)
    anims = {}
    report = []
    for build in (fountain, smoke, rain, confetti, boat, night, bug):
        S = build()
        img, rows = S.build()
        path = os.path.join(OUT, S.name)
        img.save(path, optimize=True)
        anims.update(rows)
        op, tr = audit_fx(img)
        baked = sum(baked_shadow_px(f) for _, frames, _ in S.rows for f in frames)
        halo = sum(audit_overlay(f) for a, frames, _ in S.rows for f in frames
                   if a.startswith(("lamp_glow", "window_light", "fountain_underglow")))
        assert halo == 0, ("halo pixels outside OVERLAY_COLOURS", S.name, halo)
        report.append((S.name, img.size, os.path.getsize(path), op, tr, baked))
    lut, names, mapping = fn.lut()
    lut.save(os.path.join(OUT, "night-lut.png"), optimize=True)
    meta = {
        "version": 1,
        "about": "F5 effect sheets (original pixel art, CC0). Each animation is one row: frames left to right "
                 "starting at (x, y), each frame_w x frame_h. anchor = pixel in the frame placed on the world "
                 "point. blend: normal or add (additive, Phaser BlendModes.ADD). fps 0 = static (frames are "
                 "variants). loop false = one-shot. layer: ground (under props), above (after characters), "
                 "light / emissive (night, after the LUT pass), screen (screen-space overlay).",
        "animations": anims,
    }
    with open(os.path.join(OUT, "fx.json"), "w") as fh:
        json.dump(meta, fh, indent=1)
    nmeta = {
        "version": 1,
        "lut": {"file": "night-lut.png", "width": 256, "height": 1, "index": names,
                "note": "pixel x = index of the colour in `index` (the 48 tile colours, then the 2 bot lilacs); "
                        "pixels 50-255 are unused (transparent)",
                "map": mapping},
        "transform": {"formula": "lum = .30R+.59G+.11B; c' = c*(1-desat) + lum*desat; out = c'*mul + add",
                      "desat": fn.DESAT, "mul": list(fn.MUL), "add": list(fn.ADD),
                      "note": "affine, so it can run as a shader / colour matrix on the whole frame and gives "
                              "the same result as the LUT on blended pixels"},
        "order": ["1. world (ground, shadows, props, buildings; NOT characters) recoloured by the LUT / "
                  "transform, then layer=emissive sprites (lit_windows over each bay, lamp_head, wall_lamp_head, "
                  "string_lights) unrecoloured",
                  "2. characters, never recoloured by the LUT: multiply tint `characters.shade` (mild night "
                  "shade, faint blue), lerped to white (= original colours) by the light factor of the nearest "
                  "light source; they stay in the same depth-sorted layer as the props",
                  "3. layer=light sprites with blend=add on top of everything (lamp glows, window lights, cone, "
                  "siren, underglow, string_lights_glow)"],
        "characters": {"shade": list(fn.CHAR_SHADE), "lit_inner": fn.CHAR_LIT_INNER,
                       "formula": "light = max over sources of clamp((1 - dist/radius) / (1 - lit_inner), 0, 1); "
                                  "dist from the body centre (origin - 24 px) to the light centre; "
                                  "tint = shade + (1 - shade) * light (per channel, multiply)",
                       "sources": "lamp heads (radius of their lamp_glow), wall lamps (24), lit panes "
                                  "(half the pane diagonal + 16), fountain underglow (40)"},
        "lit_windows": {n: i for i, n in enumerate(fn.LIT_BAYS)},
        "animations": {k: v for k, v in anims.items() if v["sheet"] == "night.png"},
    }
    with open(os.path.join(OUT, "night.json"), "w") as fh:
        json.dump(nmeta, fh, indent=1)
    total = 0
    for n, size, b, op, tr, baked in report:
        total += b
        print("%-16s %-11s %7d B  off-palette opaque %d, translucent non-palette %d, baked shadow px %d"
              % (n, "%dx%d" % size, b, op, tr, baked))
    for f in ("night-lut.png", "fx.json", "night.json"):
        total += os.path.getsize(os.path.join(OUT, f))
    print("total bytes:", total)
    return anims


if __name__ == "__main__":
    main()
