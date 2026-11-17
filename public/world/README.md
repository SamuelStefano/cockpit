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

A 5x6 building on the plaza (project `quadro`, door at the bottom, two standing spots in front of the board). The cork board is 3x2 blocking tiles of `props.png` (ids 12-14 top row, 16-18 bottom row) on the back wall; its three hooks sit at x = 10, 23 and 36 px of the 48 px board, on the bottom rim, where the "feito" plaque hangs.

- `props.png` is 4x5 tiles. Frame 15: the "feito" plaque (16x16, transparent, hanging string at the top; draw it at a hook, origin top centre).
- `taskbox.png`: 5 frames of 12x12 (0 left, 1 down, 2 up, 3 right, 4 on the ground). Draw it above the bot's head or in front of its body, per facing.
