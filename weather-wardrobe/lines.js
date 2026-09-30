// Everything Weather Wardrobe can say, and the clothes and weather it teaches. The game, the grown-ups page and the voice maker read this file.
// slot: where it goes on the bear (two things cannot share a slot). many: it is a pair or a plural ("Those are the boots").
export const ITEMS = {
  hat:        { word: 'hat',        e: '👒', slot: 'head' },
  cap:        { word: 'cap',        e: '🧢', slot: 'head' },
  sunglasses: { word: 'sunglasses', e: '🕶️', slot: 'eyes', many: true },
  scarf:      { word: 'scarf',      e: '🧣', slot: 'neck' },
  tshirt:     { word: 'T-shirt',    e: '👕', slot: 'top' },
  coat:       { word: 'coat',       e: '🧥', slot: 'coat' },
  gloves:     { word: 'gloves',     e: '🧤', slot: 'hands', many: true },
  shorts:     { word: 'shorts',     e: '🩳', slot: 'legs', many: true },
  jeans:      { word: 'jeans',      e: '👖', slot: 'legs', many: true },
  socks:      { word: 'socks',      e: '🧦', slot: 'socks', many: true },
  shoes:      { word: 'shoes',      e: '👟', slot: 'feet', many: true },
  boots:      { word: 'boots',      e: '👢', slot: 'feet', many: true },
  umbrella:   { word: 'umbrella',   e: '☂️', slot: 'hold' }
};
export const WEATHER = {
  sunny: { icon: '☀️', good: ['sunglasses', 'hat', 'cap', 'tshirt', 'shorts'], bad: ['coat', 'scarf', 'gloves', 'boots'] },
  rainy: { icon: '🌧️', good: ['umbrella', 'boots', 'coat'], bad: ['sunglasses', 'shorts', 'hat'] },
  snowy: { icon: '❄️', good: ['coat', 'scarf', 'gloves', 'boots'], bad: ['sunglasses', 'shorts', 'tshirt', 'hat'] }
};
export const LEVELS = [
  { icon: '👕', name: 'Clothes', rounds: 8 },
  { icon: '🌦️', name: 'Weather', rounds: 6 },
  { icon: '🔄', name: 'On & off', rounds: 8 }
];
const cap = s => s[0].toUpperCase() + s.slice(1);
export const onText = k => k === 'umbrella' ? 'Take the umbrella.' : `Put on the ${ITEMS[k].word}.`;
export const offText = k => k === 'umbrella' ? 'Put the umbrella away.' : `Take off the ${ITEMS[k].word}.`;
export const LINES = [
  { key: 'wd:hi', say: 'Help Bobo the bear get dressed!' },
  { key: 'wd:ready', say: "Ready! Let's go outside!" },
  { key: 'wd:now', say: 'Now it is sunny and hot!' },
  { key: 'wd:hot', say: 'Phew! Too hot!', voice: 'am_puck' },
  { key: 'wd:cold', say: 'Brr! So cold!', voice: 'am_puck' },
  { key: 'wd:wet', say: 'Oh no! I am all wet!', voice: 'am_puck' },
  { key: 'wd:yay', say: 'Yay! Thank you!', voice: 'am_puck' },
  ...Object.entries(ITEMS).flatMap(([k, it]) => [
    { key: 'wd:on:' + k, say: onText(k) },
    { key: 'wd:off:' + k, say: offText(k) },
    { key: 'wd:that:' + k, say: it.many ? `Those are the ${it.word}.` : `That is the ${it.word}.` },
    { key: 'wd:name:' + k, say: cap(it.word) + '!' }
  ]),
  { key: 'wd:w:sunny', say: 'It is sunny and hot!' },
  { key: 'wd:w:rainy', say: 'It is rainy and wet!' },
  { key: 'wd:w:snowy', say: 'It is snowy and cold!' },
  { key: 'wd:need:sunny', say: 'What do you need for the sun?' },
  { key: 'wd:need:rainy', say: 'What do you need for the rain?' },
  { key: 'wd:need:snowy', say: 'What do you need for the snow?' },
  { key: 'wd:not:sunny', say: 'Not on a hot, sunny day!' },
  { key: 'wd:not:rainy', say: 'Not in the rain!' },
  { key: 'wd:not:snowy', say: 'Not in the snow!' },
  { key: 'cheer:0', say: 'Yes!' }, { key: 'cheer:1', say: 'Great!' }, { key: 'cheer:2', say: 'Wow!' }, { key: 'cheer:3', say: 'Super!' },
  { key: 'done', say: 'Well done!' }
];
