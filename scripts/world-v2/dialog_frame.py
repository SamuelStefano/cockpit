"""Builds ui/dialog-frame.png: 24x24 nine-slice frame for the RPG dialog (8 px corners, stretchable centre).
Colours come from Paleta Vila 48 (outline pedra-0, rim pele-5, fill terra-1); light from the top left:
bright rim on top and left, inner shadow at the bottom and right. Deterministic."""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'public', 'world', 'v2', 'ui')
OUTLINE = '#1E1A2B'
RIM = '#F5E6C8'
FILL = '#51221A'
HILIGHT = '#FFFFFF'

im = Image.new('RGBA', (24, 24), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rectangle([1, 0, 22, 23], fill=OUTLINE)
d.rectangle([0, 1, 23, 22], fill=OUTLINE)
d.rectangle([1, 1, 22, 22], fill=RIM)
d.rectangle([3, 3, 20, 20], fill=FILL)
d.line([2, 2, 21, 2], fill=HILIGHT)
d.line([2, 2, 2, 21], fill=HILIGHT)
d.line([3, 21, 21, 21], fill=OUTLINE)
d.line([21, 3, 21, 21], fill=OUTLINE)
os.makedirs(OUT, exist_ok=True)
im.save(os.path.join(OUT, 'dialog-frame.png'))
print('dialog-frame.png 24x24 ok')
