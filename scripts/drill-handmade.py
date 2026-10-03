"""Draws the drill things the LimeZu pack has no truthful picture for, in its
style: a 1 px outline in the pack's own dark, flat fills and one shade.
Writes scripts/drill-handmade.png, which build-drill-art.mjs reads beside the
pack. Run: python3 scripts/drill-handmade.py"""
from pathlib import Path

from PIL import Image

PALETTE = {
    'O': (58, 58, 80),     # the pack's outline
    'W': (235, 228, 242),  # white
    'w': (191, 186, 209),  # white in shade
    'g': (139, 139, 171),  # grey
    'K': (70, 70, 94),     # dark
    'B': (79, 134, 204),   # blue
    'b': (53, 96, 160),    # blue in shade
    'S': (120, 205, 232),  # screen
    'F': (196, 132, 72),   # food
    'R': (180, 70, 60),    # bowl
    'r': (128, 44, 40),    # bowl in shade
}

# Each picture as rows of the palette letters, '.' for clear.
SPRITES = {
    # a plastic pet carrier with its grille door, and a full food bowl
    'pet': [
        '....OOOOOO..........',
        '....O....O..........',
        '.OOOOOOOOOOOO.......',
        'OBBBBBBBBBBBBO......',
        'OBOOOOOOOOOOBO......',
        'OBOgKgKgKgKOBO......',
        'OBOgKgKgKgKOBO......',
        'OBOgKgKgKgKOBO..OOO.',
        'OBOgKgKgKgKOBO.OFFFO',
        'OBOOOOOOOOOOBO.OWWWO',
        'OBBBBBBBBBBBBO.ORRRO',
        'ObbbbbbbbbbbbO.OrrrO',
        '.OOOOOOOOOOOO...OOO.',
    ],
    # a P2 mask: a white cup, a grey valve and blue straps
    'masks': [
        '..OOOOOOOO..',
        '.OWWWWWWWWO.',
        'OBWWWWWWWWBO',
        'OBWWWWgWWWBO',
        '.OWWWgKgWWO.',
        '.OWWWWgWWwO.',
        '..OwWWWWwO..',
        '...OwwwwO...',
        '....OOOO....',
    ],
    # a mobile phone, its cable and its plug
    'charger': [
        'OOOOOOO.....',
        'OKKKKKO.....',
        'OKSSSKO.....',
        'OKSSSKO.....',
        'OKSWSKO.....',
        'OKSSSKO.OOOO',
        'OKSSSKO.OWWO',
        'OKKKKKO.OWWO',
        'OKKgKKO.OwwO',
        'OOOOOOO.OOOO',
        '...w......w.',
        '...wwwwwwww.',
    ],
    # a memory stick: a silver plug on a blue body
    'memorystick': [
        '.OOOO.',
        '.OWgO.',
        '.OwwO.',
        'OOOOOO',
        'OBBBBO',
        'OBWBBO',
        'OBBBBO',
        'OBBBbO',
        'OBBBbO',
        'ObbbbO',
        'OOOOOO',
    ],
    # a white pillow
    'pillow': [
        '.OOOOOOOOOOOO.',
        'OWWWWWWWWWWWWO',
        'OWWWWWWWWWWWwO',
        'OWWWWWWWWWWWwO',
        'OWWWWWWWWWWWwO',
        'OWWWWWWWWWWwwO',
        'OwwwwwwwwwwwwO',
        '.OOOOOOOOOOOO.',
    ],
}

width = sum(max(len(row) for row in rows) + 1 for rows in SPRITES.values())
height = max(len(rows) for rows in SPRITES.values())
sheet = Image.new('RGBA', (width, height), (0, 0, 0, 0))
left = 0
for name, rows in SPRITES.items():
    for y, row in enumerate(rows):
        for x, letter in enumerate(row):
            if letter != '.':
                sheet.putpixel((left + x, y), (*PALETTE[letter], 255))
    print(f"  {name}: ['handmade', {left}, 0, {max(len(row) for row in rows)}, {len(rows)}],")
    left += max(len(row) for row in rows) + 1
sheet.save(Path(__file__).with_name('drill-handmade.png'))
