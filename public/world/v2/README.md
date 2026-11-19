# Village v2 (32 px)

Generated files; edit the generators in `scripts/world-v2/`, never the outputs.

| File | Generator |
|---|---|
| `tiles-exterior.*`, `tiles-interior.*`, `pc.*` | `exterior.py`, `interior.py` |
| `tiles-extra.*` (house name boards, Corte Radar tower) | `extra.py` |
| `world.tmj` (128x80 city map: the 96x64 town plus the Bosque e Lago district east and south of it, tilesets embedded) | `gen-map.py` (reads `scripts/team-homes.json`) |

Preview from the map itself: `python3 scripts/world-v2/render-map.py OUTDIR`.

## world.tmj contract

- Tile layers: `ground`, `ground2`, `walls`, `furniture_low`, `furniture_high` (drawn above characters), `lights`.
- Collision: a tile with `block=true` in `ground`, `walls` or `furniture_low`. `ground2`, `furniture_high` and `lights` never block (roof overhangs, the upper half of doorways, the tower above the Corte Radar room).
- `objects`: houses (`kind=house`, `id`, `project`, `label`, `door`, `doorX`/`doorY`, `department`, `tint`, `icon`), desks (`project`, `seat`, `face`, `bot`), PCs (`kind=pc`, `house`, `seat`, `bot`, `state`, `view`), the meeting room `sala` and its chairs (`room=sala`, seat 0 = head), `loja`/`quadro` with two spots each, towers, pier, boats, `dock-sign`, trees, benches, lamps, fountain, `bug-spot`, plaza spawns, roads.
- `zones`: Lara's zones as rectangles with `kind`.

## Signs and the open-PR counter

Every house has a `kind=sign` object (pixel rect of its name text, `house`, `label`). Landmark facades carry their name in the art (`builtin=true`, rect = upper facade). The project houses also get a `kind=pr-slot` object: the empty 14x9 px pill on the board where the engine draws the open-PR count with its pixel font.

| house | pr-slot (x, y, w, h in px) |
|---|---|
| qa | 427, 812, 14, 9 |
| deck | 843, 812, 14, 9 |
| dfl | 427, 1068, 14, 9 |
| itera | 843, 1068, 14, 9 |
| corte-radar | 2155, 1420, 14, 9 |

The Corte Radar beacon blinks through the tile animation of `radar_tower` (2 frames, 2 fps).
