// Everything Monster Maker can say, and the words it teaches. The game, the grown-ups page and the voice maker read this file.
// Body parts: `a` is how the part is said after "Give it", `that` answers a wrong tap, `one`/`many` are for counting.
export const PARTS = {
  eyes:  { word: 'eyes',  a: 'eyes',    that: 'Those are eyes.',  one: 'eye',   many: 'eyes',  def: 2, count: true },
  ears:  { word: 'ears',  a: 'ears',    that: 'Those are ears.',  one: 'ear',   many: 'ears',  def: 2, count: true },
  arms:  { word: 'arms',  a: 'arms',    that: 'Those are arms.',  one: 'arm',   many: 'arms',  def: 2, count: true },
  legs:  { word: 'legs',  a: 'legs',    that: 'Those are legs.',  one: 'leg',   many: 'legs',  def: 2, count: true },
  horns: { word: 'horns', a: 'horns',   that: 'Those are horns.', one: 'horn',  many: 'horns', def: 2, count: true },
  teeth: { word: 'teeth', a: 'teeth',   that: 'Those are teeth.', one: 'tooth', many: 'teeth', def: 2, count: true },
  spots: { word: 'spots', a: 'spots',   that: 'Those are spots.', one: 'spot',  many: 'spots', def: 4, count: true },
  nose:  { word: 'nose',  a: 'a nose',  that: 'That is a nose.',  def: 1 },
  mouth: { word: 'mouth', a: 'a mouth', that: 'That is a mouth.', def: 1 },
  tail:  { word: 'tail',  a: 'a tail',  that: 'That is a tail.',  def: 1 },
  wings: { word: 'wings', a: 'wings',   that: 'Those are wings.', def: 2 },
  hair:  { word: 'hair',  a: 'hair',    that: 'That is hair.',    def: 1 }
};
export const COUNTABLE = Object.keys(PARTS).filter(p => PARTS[p].count);
export const NUMS = ['one', 'two', 'three', 'four', 'five'];
export const COLORS = {
  red: '#ff5d6c', blue: '#4d9bff', yellow: '#ffd23f', green: '#5fd068',
  orange: '#ff9a3c', purple: '#a77bff', pink: '#ff8ad4', brown: '#b8804f'
};
const cap = s => s[0].toUpperCase() + s.slice(1);
export const countText = (p, n) => `Give it ${NUMS[n - 1]} ${n === 1 ? PARTS[p].one : PARTS[p].many}.`;
export const needText = (p, n) => `We need ${NUMS[n - 1]} ${n === 1 ? PARTS[p].one : PARTS[p].many}.`;
export const LEVELS = [
  { icon: '👀', name: 'Parts' },
  { icon: '🔢', name: 'Count' },
  { icon: '🎨', name: 'Colors' },
  { icon: '⭐', name: 'Mix' }
];
export const LINES = [
  { key: 'mm:hi', say: "Let's make a monster!" },
  { key: 'mm:count', say: "Let's count!" },
  { key: 'mm:tick', say: 'Tap the green button when you are done.' },
  { key: 'mm:love', say: 'Hooray! Thank you! I love it!', voice: 'am_puck' },
  { key: 'mm:giggle', say: 'Hee hee! That tickles!', voice: 'am_puck' },
  ...Object.entries(PARTS).flatMap(([p, d]) => [
    { key: 'mm:give:' + p, say: `Give it ${d.a}.` },
    { key: 'mm:that:' + p, say: d.that },
    { key: 'mm:name:' + p, say: cap(d.a) + '!' }
  ]),
  ...Object.keys(PARTS).filter(p => PARTS[p].count).flatMap(p => [1, 2, 3, 4, 5].flatMap(n => [
    { key: `mm:n:${p}:${n}`, say: countText(p, n) },
    { key: `mm:need:${p}:${n}`, say: needText(p, n) }
  ])),
  ...NUMS.map((w, i) => ({ key: 'mm:num:' + (i + 1), say: cap(w) + '!' })),
  ...Object.keys(COLORS).flatMap(c => [
    { key: 'mm:color:' + c, say: `Make it ${c}.` },
    { key: 'mm:is:' + c, say: `That is ${c}.` },
    { key: 'mm:cname:' + c, say: cap(c) + '!' }
  ]),
  { key: 'cheer:0', say: 'Yes!' }, { key: 'cheer:1', say: 'Great!' }, { key: 'cheer:2', say: 'Wow!' }, { key: 'cheer:3', say: 'Super!' },
  { key: 'oops', say: 'Oops!' },
  { key: 'done', say: 'Well done!' }
];
