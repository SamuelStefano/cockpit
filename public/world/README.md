# Team world map

`world.tmj` is the whole 2D team world (48x25 tiles, 16px, orthogonal). The Deck reads it at runtime: Phaser loads it with `load.tilemapTiledJSON`, and `src/routes/equipe/world/world-map.ts` parses the same file for walking, seats and pathfinding. Nothing about houses, desks or seats is hardcoded in TypeScript.

## Opening it

Open `world.tmj` in [Tiled](https://www.mapeditor.org/). Phaser cannot read external `.tsx` tilesets, so the four tilesets (`town`, `dungeon`, `indoor`, `urban`) are **embedded** in the `.tmj`. The `.tsx` files next to it are the same tilesets as standalone Tiled sources (use them to start a new map); tile properties live in both, so edit them in `world.tmj` and mirror the change in the `.tsx`. Save with File > Save (JSON `.tmj`), never "Export as" with external tilesets.

## Tile layers (bottom to top)

| Layer | Contents |
|---|---|
| `ground` | grass, street, road, plaza, house floors and door tiles |
| `walls` | house walls (no tile on the door cells), wall frames, clock, wall monitors |
| `furniture` | desks, chairs, shelves, plants, lamps, plaza fountain, benches |
| `decor` | rugs and desk-top monitors; depth comes from the tile property `layer` |

## Tile properties (set on the tileset)

| Property | Effect |
|---|---|
| `block` (bool) | blocks walking; in `furniture` it also casts a drop shadow |
| `layer` (`floor` / `wall` / `top`) | in `decor`: rug under furniture, wall decor, or desk top (drawn 4px up) |
| `glow` (bool) | warm flickering lamp light |
| `screen` (bool) | animated lit monitor |
| `floor` (bool) | tintable floor tile (plaza, street, house tint, doors) |
| `tint` (color) | fixed tint for every use of the tile (the road) |

## Object layer `objects`

| Object | Shape | Properties |
|---|---|---|
| house | rectangle | `kind=house`, `project`, `label`, `tint` (color), `door` (`bottom`/`east`/`west`), `icon` (`sheet:frame`, e.g. `town:17`), optional `department` (a department id such as `engineering`; bots of that department with no project work here) |
| desk | point on the seat tile | `project`, `seat` (order bots are seated, from 0), `face` (`up`/`down`/`left`/`right`) |
| meeting room | rectangle | `kind=meeting`, `id=sala`, `label`, `tint`, `door`, `icon` |
| chair | point | `room=sala`, `seat` (order), `face` |
| plaza spawn | point | `kind=plaza-spawn`, `role=avatar` or `role=center` (center also has `rx`, `ry`, the NPC ellipse) |
| sign | point | `kind=sign`, `label` |
| street, road, plaza | rectangle | `kind=street` / `road` / `plaza`; street and plaza take `tint` (plaza also `tint2`) |
| tree | point | `kind=tree`, `variant` (`tall`/`autumn`/`bush`) |
| flower bed | rectangle | `kind=flowerbed` |

Doors are 2 tiles: `bottom` = columns 4-5 of the bottom row, `east`/`west` = rows 3-4 of that side.

## Create a house

1. In `ground`, paint the floor (town frame row 9, column 1) over the house area, plus the door cells and the tile outside the door.
2. In `walls`, draw the outline with the wall tiles and leave the 2 door cells empty.
3. Add a rectangle on `objects` covering the whole house; set `kind=house`, `project`, `label`, `tint`, `door`, `icon`. Name it after the project.
4. Fill the inside on `furniture` / `decor` (`block` tiles are solid).
5. For each seat, add a point on the chair tile with `project`, `seat` (0, 1, ...), `face`.
6. Save. The house, its label pill, its seats and its walkable area show up in the Deck with no TypeScript change.

## Bot to house mapping

Nothing about bots is in code. A bot is placed by, in order: its `project` field (set in the bot config, must equal a house `project` id), a keyword in its current task (`itera`, `dfl`, `radar`), its department matching a house `department` prop, then `escritorio`. Set Luffy to `itera`, Zoro to `dfl` and Goku to `deck` in the bot config (`project`, a slug `[a-z0-9-]{1,32}`), not in TypeScript.

Badges and house counts shown today are demo-only (`?demo`); the real data source is a separate PR.

## Chibi characters and effects (original art)

`chibi.png` and `chibi-shirt.png` share one grid: frame 16x22 px, origin bottom centre (feet on the last row but one), 24 columns by 8 rows. Frame index = `variant * 24 + dir * 6 + anim`.

- `variant` 0-7: skin, hair colour and hair style (pick by a hash of the bot id).
- `dir`: 0 left, 1 down, 2 up, 3 right.
- `anim`: 0 idle, 1 idle stretch (breathing: alternate 0 and 1 about every 600 ms), 2 walk contact A (squash), 3 walk up (stretch), 4 walk contact B (squash), 5 walk up. Walk cycle 2-3-4-5 at about 130 ms per frame.
- `chibi-shirt.png` has only the shirt, in white and grey shading: draw it over `chibi.png` with the bot's mascot colour as a tint (the signature colour). Without the overlay the base sheet shows a green shirt.

`fx.png`: 16x16 frames. 0-3 dust puff (spawn at the feet while walking), 4-7 sparkle (play when a PR merges), 8 soft shadow (14x5), 9 small shadow (for jumps).

`props.png` (4x4 tiles, original, tileset `props`, firstgid 1237) holds the round meeting table as a 3x3 block (tiles 0-2, 4-6, 8-10, all blocking). The Sala de Reunião seats eight around it (six participants, the moderator and one spare): seat 0 is the head of the table (east end, opposite the door) and belongs to the moderator; seats 1-3 north, 4-6 south, 7 west.

## Quadro de tarefas (village)

A 5x6 building on the plaza (object `kind=board`, `id=quadro`, never a bot project: `kind=house` takes bots by `project`, `board` and `meeting` are destinations only; its standing spots are points with `room=quadro`, door at the bottom, two standing spots in front of the board). The cork board is 3x2 blocking tiles of `props.png` (ids 12-14 top row, 16-18 bottom row) on the back wall; its three hooks sit at x = 10, 23 and 36 px of the 48 px board, on the bottom rim, where the "feito" plaque hangs.

- `props.png` is 4x5 tiles. Frame 15: the "feito" plaque (16x16, transparent, hanging string at the top; draw it at a hook, origin top centre).
- `taskbox.png`: 5 frames of 12x12 (0 left, 1 down, 2 up, 3 right, 4 on the ground). Draw it above the bot's head or in front of its body, per facing.

## v2: 32px tilesets (original art)

Everything in `v2/` is original pixel art generated by the scripts in `scripts/world-v2/` (Python 3 + Pillow + numpy, deterministic, nothing copied from any game). Rebuild with `python3 scripts/world-v2/exterior.py` and `python3 scripts/world-v2/interior.py`. `world.tmj` does not use these sheets yet.

| File | What |
|---|---|
| `tiles-exterior.png` / `.tsx` / `.json` | 32px village: terrain, 16-piece autotiles, trees, props, port, server tower, facade kit and six landmark facades |
| `tiles-interior.png` / `.tsx` / `.json` | 32px rooms: floors, walls and wall caps, furniture, kitchen, decor, meeting set, shop, vault, rack, stage |
| `pc.png` / `pc.json` | 32x32 monitor + keyboard frames (`front_*`, `back_*`, states `off`, `on_a`, `on_b`, `alert`) and screen glows |

Both sheets are 16 columns wide. The `.json` maps every item name to its tile ids (`ids`, row-major, `-1` = empty tile), animation `frames` and `fps`, and for layered items `layer_of` + `offset` (in tiles, relative to the parent's top-left).

### Tile properties (in the `.tsx`)

| Property | Meaning |
|---|---|
| `block` (bool) | blocks walking |
| `layer` | `above`: draw after characters (canopies, roofs, awnings, the top half of tall props). Interior only: `wall` (decor on a wall face), `floor` (rug), `top` (on a desk) |
| `overlay` | translucent overlay tile: `shadow` goes above the ground and below props and characters; `glow` and `light` go last |
| `door` (bool) | entrance tile; wins over the `block` of the wall under it |
| `seat` (bool), `face` | chairs: a bot sits here facing `face` |
| `frames`, `fps`, `frame` | animated tile (also a Tiled `<animation>` on frame 0) |
| `state` | server tower: `green`, `yellow`, `red` |

The tile `type` is the item name. The four 16-piece corner sets are Tiled wang sets (`grass-path`, `grass-plaza`, `grass-sand`, `sand-water`); in the json, tile `k` of a set has corners `tl*8 + tr*4 + br*2 + bl` (1 = second terrain).

### Building a facade from the kit

A generic building is N columns wide: one or two roof rows (`roof_<kind>_top_*`, `roof_<kind>_eave_*`), then a 1x2 wall bay per column (`wall_<colour>_<l|m|r|s>`). On top of a bay go a window or door overlay (1x2), an awning on the upper wall tile (`awning_<colour>_<l|m|r|s>`), hanging signs, a chimney or dormer on the roof. Shadows are separate: `shadow_eave` on every upper wall tile, `shadow_awning_*` under each awning, `shadow_ground_m` on the ground row below the building and `shadow_ground_end` one column to the right. Four wall colours, four roofs, seven bays and four awning colours give the variations; `scripts/world-v2/demo_city.py` builds three different houses this way.

Lettering baked into the tiles is in Brazilian Portuguese: landmark signs `BANCO`, `PREFEITURA`, `BIBLIOTECA`, `ESTÚDIO` (with `PALCO` over the doors), `RÁDIO` + the `NO AR` lamp, `SEGURANÇA`, and `ABERTO` on `door_glass`. The 3x5 sign font in `scripts/world-v2/pixkit.py` has `Á`, `É`, `Ú` and `Ç` (accent pixels above the letter, cedilla below); the hanging signs use icons, not words.

Trees: canopy (2x3) at (x, y), trunk (2x2) at (x, y+1), shadow (2x1) at (x, y+2). Light comes from the top left, so every shadow falls down and to the right.

### Palette

The same 48 colours as the approved F1 example. Every opaque pixel is a palette colour; translucent pixels only exist in overlay tiles and use one colour each (`#2a1d2e` shadow, `#fff4b0` glow, `#ffffff` light, `#a8e4f5` screen, `#e04848` alert, `#f0a830` warm light for the night halos). The generators check both rules.

## 32px bots (v2, original art)

`v2/` holds the 32px village bots: 22 sheets (the 21 team bots plus `deck`, the player avatar), one per character, all generated by `scripts/world-v2/gen-bots.py` (it imports `scripts/world-v2/gen.py`, the approved F1 generator, for the palette and the part renderer). Run `python3 scripts/world-v2/gen-bots.py <outdir> <previewdir>` with Python 3, Pillow and numpy; the output is deterministic.

- Roster: iris, otto, luffy, zoro, raquel, anderson, lara, lorena, goku, nami, arthur, mari, usopp, robin, bulma, ada, vegeta, malu (spiral notebook), naruto (clapperboard + headband), sasuke (open laptop), hinata (big editing headphones), and deck (player avatar).
- `v2/bots/<id>.png`: 256x1536 sheet, frames 32x48, 8 columns by 32 rows. Origin is bottom centre `(16, 46)`: feet on row 46, row 47 empty. Each frame carries its own soft drop shadow (alpha).
- Rows: one per (animation, direction), each animation has 4 rows in the order `left, down, up, right`. idle 0-3 (4 frames), walk 4-7 (6), sit 8-11 (2), type 12-15 (4), talk 16-19 (2), celebrate 20-23 (6), carry 24-27 (6), sleep 28-31 (2). Unused columns are empty.
- `v2/bots.json`: `animations.<name>` gives `row` (the `left` row), `rows` per direction, `frames` and `fps`; `bots.<id>` gives the name, role, accessory, skin, hair, `default_shirt` (the signature colour) and the two file paths.
- `right` is the `left` drawing mirrored, but rendered separately so a held item (brush, magnifier, megaphone, calculator, clipboard, notebook, clapperboard, laptop) stays in the character's right hand and arm bands stay on the left arm. Headgear and chest pins are symmetric enough to mirror.
- `sit` and `sleep` are seated (hips low, knees forward); `type` uses the same seat. Held items stay out of `type`, `carry` and `sleep`; in `sit` they rest on the lap (Sasuke's laptop closed on the lap, open on his knees while typing). `sleep` is slumped with closed eyes; draw `v2/fx-zzz.png` above the head while it plays (3 frames of 16x16, about 3 fps, offset about (+8, -40) from the origin).
- `celebrate` keeps the body height constant: the jump is in the legs. In side views the near arm goes straight up with an open hand and the held item stays in the other hand.

### Tinting

The shirt (torso and sleeves) uses only the `g0..g3` ramp `#156a4e #23a067 #3fd17f #a8f0b8`. Either swap those 4 colours for a ramp built from the bot's `default_shirt`, or multiply/hue-shift the pixels where `v2/bots/<id>-shirt.png` (same layout, white = shirt) is set. Iris's blazer leaves only the shirt front on the mask.

### Add a bot

1. Add a row to `BOTS` in `gen-bots.py` (id, name, role, accessory label, skin `light|tan|brown|deep|pale`, hair colour from `HAIR`, style `short|bob|long|long_fringe|spiky|spiky_soft|tall|ponytail|bun|curly|curly_short|curly_long|swept`, pants, shoes, eye colour, default shirt hex).
2. Add its accessory switches to `ACC` (for example `{"glasses"}`, `{"cap", "deckpin"}`, `{"magnifier"}`; held items are listed in `HELD`).
3. Run the generator, check its contact sheet in the preview folder, and copy `bots/<id>.png`, `bots/<id>-shirt.png` and `bots.json` here.

Palette: the 48 colours of the F1 example plus 2 lilac tones (`c0 #7d62b8`, `c1 #c3b1ec`) for Hinata's headphones and eyes, 50 in total. Every opaque pixel is a palette colour (the script checks it).

## F5 fx (v2, original art)

Effect sheets in `v2/fx/`, all generated by `python3 scripts/world-v2/fx.py` (Python 3 + Pillow + numpy, deterministic; modules `fx_fountain`, `fx_particles`, `fx_weather`, `fx_boat`, `fx_night`, `fx_bug`, shared helpers in `fxkit.py`). `python3 scripts/world-v2/fx_preview.py <outdir>` writes preview GIFs composed on the 32px tileset (not shipped).

### Layout

Each sheet is a stack of rows; one row = one animation, frames left to right. `v2/fx/fx.json` lists every animation under `animations.<name>`:

| Field | Meaning |
|---|---|
| `sheet`, `x`, `y` | file and top-left of frame 0; frame `i` is at `x + i * frame_w` |
| `frame_w`, `frame_h`, `frames` | frame size and count |
| `fps` | playback speed; `0` = static (the frames are variants, e.g. the 3 sky-tint strengths) |
| `anchor` | pixel of the frame placed on the world point (feet, chimney mouth, lamp head, waterline) |
| `blend` | `normal` (alpha) or `add` (additive: Phaser `BlendModes.ADD`, `dst += src.rgb * src.a`) |
| `loop` | `true` loops seamlessly; `false` = one-shot, hide after the last frame |
| `layer` | `ground` under props, `above` after characters, `screen` screen-space overlay, `emissive` / `light` night passes (below) |

| Sheet | Animations |
|---|---|
| `fountain.png` | `fountain_day`, `fountain_night` (96x96 = the 3x3 `fountain`, 8 frames each; same top-left as the tile item, keep `fountain_shadow`) |
| `smoke.png` | `smoke_chimney` (32x64), `smoke_tower` (32x64, darker and thicker, for a loaded server tower), `smoke_boat` (32x32, black-grey); 6-frame loops |
| `rain.png` | `rain` (near layer, 64x64 seamless, 4 frames, (-16,+48) px per frame; tile it over the view), `rain_far` (far layer, its own 48x48 tile, slower (-12,+36) px per frame, drawn under the near one), `rain_splash` (4, one-shot), `rain_ripple` (6, one-shot), `rain_puddle` (static), `sky_tint` (one colour, 3 strengths) |
| `confetti.png` | `confetti_burst` (192x192, 10 frames at 12 fps, one-shot, 120 pieces), `confetti_fall` (192x96, 12 frames at 8 fps, loop around the bot), `star_pop` (level up, 32x32, one-shot). Pieces are 2x2 (chip) or 3x2 (paper) px and flip face-on / edge-on for the spin; both rows are anchored on the bot's feet and stay within about 3 tiles (96 px) of it |
| `boat-deploy.png` | `boat_depart` (12, one-shot: rope off, mast light, engine puffs, wake), `boat_sail` (6), `boat_return` (6, dented, deck smoke, drooping flag, faces left), `boat_docked` (4), `boat_wake` (64x16 strip). Boat frames are 96x56 with the hull on the right third and the waterline at y = 46 |
| `night.png` | `lamp_glow_s/m/l` (radius 24/40/56), `window_light_s/m/l` (pane + 6 px halo), `delegacia_cone`, `siren_flash` (red, blue), `fountain_underglow`, `string_lights` + `string_lights_glow`, `lamp_head`, `wall_lamp_head`, `lit_windows` |
| `bug-fish.png` | Bug, the fountain easter egg (32x20): `bug_swim_left`, `bug_swim_right`, `bug_blink`, `bug_jump` (48x56, surface y = 46), `bug_splash`, `bug_wink`, and `bug_tiny_left/right` (16x10, shallow shore) |

### Playing them

- Loops: advance `frame = floor(t * fps) % frames`. The fountain, smoke, rain, falling confetti, sailing boat, string lights and Bug's swim are built so the last frame flows into the first.
- Confetti: `confetti_burst` on the merging bot (anchor = feet; it pops at the top of the head), then `confetti_fall` on the same anchor for as long as the celebration lasts (8 px per frame, 12 x 8 = 96 px = frame height, so it loops seamlessly), optionally `star_pop` above the head.
- One-shots: `rain_splash` / `rain_ripple` at random spots while it rains; `boat_depart` then `boat_sail` while the sprite is tweened right (start moving at frame 7); `boat_return` while it comes back left, then `boat_docked`; Bug: `bug_jump` then `bug_splash` at the landing point (x = 11 in the jump frame), `bug_blink` as 0-1-2-1-0.
- Rain: draw `sky_tint` (stretched) over the world, then `rain` tiled in screen space, then splashes; `rain_puddle` goes on the ground layer.
- Smoke: `smoke_tower` replaces the tileset `smoke` when a tower is `yellow` or `red`; `smoke_boat` is the stand-alone version of the return smoke.

### Night mode

Order of the passes (also in `v2/fx/night.json`):

1. World: ground, shadows, props, buildings and `fountain_night` (everything except characters), recoloured with the night LUT; then the `emissive` sprites without recolouring: `lit_windows` over each window/door bay (frame order in `night.json` `lit_windows`), `lamp_head` over every `lamp_night`, `wall_lamp_head` over every `wall_lamp_night`, `string_lights`.
2. Characters: never through the LUT (it turns them into navy silhouettes). Each bot gets a mild multiply tint instead, `night.json` `characters.shade` = (0.82, 0.85, 0.96), about 15-18% darker with a faint blue cast, so face, skin, hair and shirt stay readable. Near a light the tint fades back to white (original colours): `light = max over sources of clamp((1 - dist / radius) / (1 - 0.6), 0, 1)` with `dist` from the body centre (origin - 24 px) to the light centre, full colour inside 60% of the radius; `tint = shade + (1 - shade) * light`. In Phaser: keep bots in the same depth-sorted layer as the props, put the LUT pipeline / colour matrix on the world objects only, and `setTint` the bot (and its shirt sprite) every frame or when it moves. Sources: lamp heads (radius of their `lamp_glow`), wall lamps (24), lit panes (half the pane diagonal + 16), the fountain (40).
3. Lights: the `light` sprites with `blend=add`, on top of world and characters: lamp glows (alternate the 2 frames at random per lamp for the flicker), `window_light_*` centred on lit panes, `delegacia_cone` under the Delegacia door lamp, `siren_flash` with the siren, `fountain_underglow`, `string_lights_glow`.

The lamp, window and fountain halos are warm: `#f0a830` (y0, overlay colour `warm`) on the rim and `#fff4b0` (y2, `glow`) dithered in towards the core, no white. Their edge is an ordered 4x4 Bayer dither between 4 alpha steps (`fx_night.warm_halo`), so there are no hard concentric rings; the siren, bulb and cone pool spots use the same dither in their own colour. `fx.py` fails if a halo pixel is not an overlay colour. `fx_night.compose_night(world, characters, lights, emissive, sources)` is the reference implementation of the three steps (the preview uses it).

The LUT is `v2/fx/night-lut.png`, 256x1: pixel `x` is the night colour of palette entry `x` in the order of `night.json` `lut.index` (the 48 tile colours, then the bots' two lilacs; pixels 50-255 are unused). `lut.map` gives the same thing as `#day -> #night` hex pairs.

Why this tint: night lowers value and shifts every colour toward blue, but it must not crush the art to black, so the transform is `lum = 0.30R + 0.59G + 0.11B`, `c' = 0.65c + 0.35lum` (about a third desaturated, so warm walls do not turn muddy purple), `out = c' * (0.30, 0.36, 0.56) + (12, 14, 34)`. Blue keeps the most energy and the `+ (12, 14, 34)` lift makes the darkest outline a deep navy instead of black, so silhouettes stay readable and the warm lights (yellow windows, lamps) have the strongest contrast against it. The transform is affine, so the engine can also run it as a colour matrix / shader on the whole frame (coefficients in `night.json` `transform`): recolouring a blended pixel gives the same result as blending recoloured pixels, so shadows and soft alpha edges stay consistent with the LUT.

### Palette

Opaque pixels are the 48 palette colours; translucent pixels (glows, rain, water marks, halos, the surface shadow under Bug's jump) also use palette RGB values with alpha. `fx.py` prints the audit for every sheet: off-palette opaque pixels, translucent pixels with a non-palette RGB, and translucent `ol0` (shadow) pixels touching an opaque one (a baked shadow).

`fx/porto-sign.png` (96x64, 3x2 tiles) is the wooden PORTO sign for the dock (two posts, two planks, lettering, anchor and waves) with its soft shadow in `fx/porto-sign-shadow.png`; built by `scripts/world-v2/porto_sign.py`. It marks where deploys become boats.
