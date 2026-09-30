// Everything Rhyme Frog can say, and the rhyming families it teaches. The game, the grown-ups page and the voice maker read this file.
// Each family is a sound ending; every word in it rhymes with the others and has a clear picture.
export const FAMILIES = {
  at:   [['cat', '🐱'], ['hat', '🎩'], ['bat', '🦇'], ['rat', '🐀']],
  og:   [['dog', '🐶'], ['frog', '🐸'], ['log', '🪵']],
  en:   [['hen', '🐔'], ['pen', '🖊️'], ['ten', '🔟']],
  ox:   [['box', '📦'], ['fox', '🦊'], ['socks', '🧦']],
  an:   [['pan', '🍳'], ['van', '🚐'], ['man', '👨']],
  oat:  [['boat', '⛵'], ['goat', '🐐'], ['coat', '🧥']],
  ee:   [['bee', '🐝'], ['tree', '🌳'], ['key', '🔑'], ['three', '3️⃣']],
  ain:  [['train', '🚆'], ['rain', '🌧️'], ['chain', '⛓️'], ['plane', '✈️']],
  oon:  [['moon', '🌙'], ['spoon', '🥄'], ['balloon', '🎈']],
  ar:   [['car', '🚗'], ['star', '⭐'], ['guitar', '🎸']],
  ake:  [['cake', '🎂'], ['snake', '🐍']],
  ed:   [['bed', '🛏️'], ['sled', '🛷'], ['bread', '🍞']],
  ear:  [['bear', '🐻'], ['pear', '🍐'], ['chair', '🪑']],
  ing:  [['king', '🤴'], ['ring', '💍']],
  ell:  [['bell', '🔔'], ['shell', '🐚']],
  ouse: [['mouse', '🐭'], ['house', '🏠']],
  ail:  [['snail', '🐌'], ['whale', '🐋']],
  ose:  [['nose', '👃'], ['rose', '🌹']],
  ie:   [['pie', '🥧'], ['tie', '👔'], ['eye', '👁️'], ['fly', '🪰']],
  ock:  [['clock', '🕐'], ['rock', '🪨'], ['lock', '🔒']],
  ish:  [['fish', '🐟'], ['dish', '🍽️']],
  ite:  [['kite', '🪁'], ['light', '💡']],
  oo:   [['shoe', '👟'], ['two', '2️⃣'], ['kangaroo', '🦘']],
  oor:  [['door', '🚪'], ['four', '4️⃣']]
};
// families that sound too close to be fair distractors for each other
export const NEAR = [['ock', 'ox'], ['ite', 'ie'], ['oat', 'ose']];
export const LEVELS = [
  { show: ['🐱', '🎩'], label: 'cat · hat', fams: ['at', 'og', 'en', 'ox', 'an'], pads: 3 },
  { show: ['⛵', '🐐'], label: 'boat · goat', fams: ['oat', 'ee', 'ain', 'oon', 'ar', 'ake'], pads: 3 },
  { show: ['🐻', '🍐'], label: 'bear · pear', fams: ['ed', 'ear', 'ing', 'ell', 'ouse', 'ail', 'ose', 'ie', 'ock', 'ish', 'ite', 'oo', 'oor'], pads: 3 },
  { show: ['🐸', '⭐'], label: 'all', fams: null, pads: 4, tricky: true }
];
export const WORDS = Object.entries(FAMILIES).flatMap(([f, ws]) => ws.map(([w, e]) => ({ w, e, f })));
export const LINES = [
  { key: 'rf:hi', say: 'Help the frog hop! Find the word that rhymes.' },
  { key: 'rf:yes', say: 'They rhyme!' },
  { key: 'rf:no', say: 'No rhyme.' },
  ...WORDS.flatMap(({ w }) => [
    { key: 'rw:' + w, say: w + '.' },
    { key: 'rq:' + w, say: `What rhymes with ${w}?` }
  ]),
  { key: 'cheer:0', say: 'Yes!' }, { key: 'cheer:1', say: 'Great!' }, { key: 'cheer:2', say: 'Wow!' }, { key: 'cheer:3', say: 'Super!' },
  { key: 'done', say: 'Well done!' }
];
