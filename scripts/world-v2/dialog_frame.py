"""Builds ui/dialog-frame.png: 24x24 nine-slice frame for the RPG dialog (8 px corners, 8x8 opaque dark centre). Deterministic."""
import os
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'public', 'world', 'v2', 'ui')
COL = {'.': (0, 0, 0, 0), 'O': (42, 29, 46, 255), 'L': (246, 231, 207, 255), 'M': (163, 131, 106, 255), 'F': (20, 17, 15, 255), 'G': (255, 209, 102, 255)}
CORNER = [
    "..OOOOOO",
    ".OLLLLLL",
    "OLMMMMMM",
    "OLMGFFFF",
    "OLMFFFFF",
    "OLMFFFFF",
    "OLMFFFFF",
    "OLMFFFFF",
]
img = Image.new('RGBA', (24, 24), (0, 0, 0, 0))
p = img.load()
for y in range(8):
    for x in range(8):
        c = COL[CORNER[y][x]]
        p[x, y] = c
        p[23 - x, y] = c
        p[x, 23 - y] = c
        p[23 - x, 23 - y] = c
for y in range(8):
    for x in range(8, 16):
        top = COL[CORNER[y][7]]
        p[x, y] = top
        p[x, 23 - y] = top
        side = COL[CORNER[7][y]]
        p[y, x] = side
        p[23 - y, x] = side
for y in range(8, 16):
    for x in range(8, 16):
        p[x, y] = COL['F']
os.makedirs(OUT, exist_ok=True)
img.save(os.path.join(OUT, 'dialog-frame.png'))
print('dialog-frame.png 24x24 ok')
