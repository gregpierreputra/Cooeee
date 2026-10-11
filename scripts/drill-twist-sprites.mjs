// The drill twists' own things, drawn by hand in the LimeZu manner, like
// scripts/drill-handmade.py. '.' is clear. scripts/drill-twist-art.mjs adds
// them to the drill's sprite sheet.
export const PALETTE = {
  O: [58, 58, 80], // the pack's outline
  W: [235, 228, 242], // white
  w: [191, 186, 209], // white in shade
  g: [139, 139, 171], // grey
  K: [70, 70, 94], // dark
  B: [79, 134, 204], // blue
  b: [53, 96, 160], // blue in shade
  S: [120, 205, 232], // screen, glass
  F: [196, 132, 72], // food
  R: [180, 70, 60], // red
  r: [128, 44, 40], // red in shade
  L: [150, 94, 56], // leather
  l: [108, 64, 42], // leather in shade
  A: [222, 184, 128], // tan
  a: [180, 138, 88], // tan in shade
  T: [214, 162, 102], // timber
  t: [160, 110, 66], // timber in shade
  N: [244, 200, 76], // gold
  n: [190, 134, 44], // gold in shade
  E: [104, 172, 80], // green
  e: [60, 120, 64], // green in shade
  P: [236, 122, 152], // pink petals
  Y: [250, 222, 96], // yellow petals
};

export const SPRITES = {
  // a pair of brown leather work boots, the near one in front of the far one
  boots: [
    '....OOOOO...',
    '....OKKKO...',
    '....OLwLOOOO',
    '....OLLOKKKO',
    '....OLwOLwLO',
    '.OOOOLLOLLlO',
    'OLLLLLwOLwLO',
    'OWLLLLLOLLlO',
    'OKKKOLLLLwlO',
    'OOOOOWLLLLlO',
    '....OKKKKKKO',
    '....OOOOOOOO',
  ],
  // a pair of tan leather work gloves
  gloves: [
    '.O.O....O.O.',
    'OAOAO..OAOAO',
    'OAOAO..OAOAO',
    'OAAAO..OAAAO',
    'OAAAOOOOAAAO',
    'OAAAAOOAAAAO',
    'OAAAaOOaAAAO',
    'OaaaO..OaaaO',
    'OaaaO..OaaaO',
    'OOOOO..OOOOO',
  ],
  // safety goggles: two clear lenses in a grey frame on a dark strap
  goggles: [
    '..OOOOOOOO..',
    '.OggggggggO.',
    'OOgWSSgWSgOO',
    'KOgSSSgSSgOK',
    'OOgSSOOSSgOO',
    '.OggO..OggO.',
    '..OO....OO..',
  ],
  // a golf bag standing up, three club heads poking out of its top
  golfbag: [
    '...OO.....',
    '..OWWO.OO.',
    '..OwwOOWgO',
    '.OOOOOOggO',
    '.OKOKOKOO.',
    '.OKOKOKOO.',
    'OOOOOOOOOO',
    'OWWWWWWWwO',
    'OOOOOOOOOO',
    'OBBBBBBbOL',
    'OBWBBBBbOL',
    'OBWBBBBbOL',
    'OBBBBBBbOL',
    'OWWWWWWwOL',
    'OBBBBBBbOL',
    'OBBBBBBbOL',
    'OBBBBBBbOL',
    'OBBBBBBbLO',
    'OBBBBBBbOO',
    'OWWWWWWwO.',
    'OBBBBBBbO.',
    'ObbbbbbbO.',
    '.OOOOOOO..',
    '..O...O...',
  ],
  // a microwave oven: its top, a dark window and a panel of buttons
  microwave: [
    '..OOOOOOOOOOOOOOOO',
    '.OwwwwwwwwwwwwwwwO',
    'OOOOOOOOOOOOOOOOOO',
    'OWWWWWWWWWWWWWWWWO',
    'OWOOOOOOOOOOWKKKWO',
    'OWOKSKKKKKKOWWWWWO',
    'OWOSKKKKKKKOWgWgWO',
    'OWOKKKKKKKKOWWWWWO',
    'OWOKKKKKKKKOWgWgWO',
    'OWOOOOOOOOOOWWWWWO',
    'OwwwwwwwwwwwwwwwwO',
    'OOOOOOOOOOOOOOOOOO',
  ],
  // a hi-fi: two speakers either side of the tuner and its deck
  stereo: [
    'OOOOOO......OOOOOO',
    'OKKKKO......OKKKKO',
    'OKKgKOOOOOOOOKgKKO',
    'OKKKKOKKKKKKOKKKKO',
    'OKggKOKSSSSKOKggKO',
    'OgwwgOKKKKKKOgwwgO',
    'OgwwgOOOOOOOOgwwgO',
    'OKggKOKgKKgKOKggKO',
    'OKKKKOKKKKKKOKKKKO',
    'OKggKOKOOOOKOKggKO',
    'OgKKgOKKKKKKOgKKgO',
    'OgKKgOKKKKKKOgKKgO',
    'OKggKOKgWgWKOKggKO',
    'OOOOOOOOOOOOOOOOOO',
  ],
  // a blue china vase holding a few flowers
  vase: [
    '.OO..OO.',
    'OPPOOYYO',
    'OPPOOYYO',
    '.OEOOEO.',
    '..OEEO..',
    '.OOEEOO.',
    'OEOEEOEO',
    '.OOOOOO.',
    '.OBBBbO.',
    'OBWBBBbO',
    'OBWBBBbO',
    'OBBBBBbO',
    '.ObbbbO.',
    '..OOOO..',
  ],
  // a gold cup on a dark base
  trophy: [
    '.OOOOOOOO.',
    '.ONnnnnNO.',
    'OOONNNNnOO',
    'ONOWNNNnON',
    'ONOWNNNnON',
    '.OOONNnOO.',
    '...ONNnO..',
    '....ONO...',
    '....ONO...',
    '...ONNnO..',
    '.OOOOOOOO.',
    '.OKKKKKKO.',
    '.OKKNNKKO.',
    '.OOOOOOOO.',
  ],
  // a doorway boarded shut: two planks nailed across it in an X, and a
  // strip of red and white tape over them
  barrier: [
    'OOOOOOOOOOOOOOOO',
    'OTTTTTTTTTTTTTTO',
    'OOgTOOOOOOOOTgOO',
    'OtOTTOKKKKOTTOtO',
    'OtOOTTOKKOTTOOtO',
    'OtOKOTTOOTTOKOtO',
    'OOOOOOOOOOOOOOOO',
    'OWWRRWWRRWWRRWWO',
    'OwwrrwwrrwwrrwwO',
    'OOOOOOOOOOOOOOOO',
    'OtOKOTTOOTTOKOtO',
    'OtOOTTOKKOTTOOtO',
    'OtOTTOKKKKOTTOtO',
    'OOTTOKKKKKKOTTOO',
    'OTgOKKKKKKKKOgTO',
    'OOOOOOOOOOOOOOOO',
  ],
};
