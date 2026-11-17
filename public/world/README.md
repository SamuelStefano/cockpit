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
| house | rectangle | `kind=house`, `project`, `label`, `tint` (color), `door` (`bottom`/`east`/`west`), `icon` (`sheet:frame`, e.g. `town:17`) |
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

The only thing in code is the bot-to-project mapping (`TL_PROJECT` in `world-state.ts`, e.g. `goku: 'deck'`); bots without a fixed project are matched by the task text and fall back to `escritorio`.
