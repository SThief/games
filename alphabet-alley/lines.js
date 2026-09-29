// Everything Alphabet Alley can say, and the letters it teaches. The game and the voice maker both read this file.
// Letters come in groups of six, in the order many phonics courses use, so early words can be built early.
export const GROUPS = [
  ['s', 'a', 't', 'i', 'p', 'n'],
  ['c', 'e', 'h', 'r', 'm', 'd'],
  ['g', 'o', 'u', 'l', 'f', 'b'],
  ['k', 'j', 'v', 'w', 'y', 'z']
];
export const KEY = {
  s: ['sun', '☀️'], a: ['apple', '🍎'], t: ['tiger', '🐯'], i: ['insect', '🐜'], p: ['pig', '🐷'], n: ['nose', '👃'],
  c: ['cat', '🐱'], e: ['egg', '🥚'], h: ['hat', '🎩'], r: ['rabbit', '🐰'], m: ['moon', '🌙'], d: ['dog', '🐶'],
  g: ['goat', '🐐'], o: ['octopus', '🐙'], u: ['umbrella', '☂️'], l: ['lion', '🦁'], f: ['fish', '🐟'], b: ['ball', '⚽'],
  k: ['key', '🔑'], j: ['jet', '✈️'], v: ['van', '🚐'], w: ['watch', '⌚'], y: ['yo-yo', '🪀'], z: ['zebra', '🦓']
};
// g = the first group in which every letter of the word is known
export const WORDS = [
  { w: 'pin', e: '📌', g: 1 }, { w: 'pan', e: '🍳', g: 1 }, { w: 'tin', e: '🥫', g: 1 }, { w: 'nap', e: '😴', g: 1 }, { w: 'tap', e: '🚰', g: 1 },
  { w: 'cat', e: '🐱', g: 2 }, { w: 'hat', e: '🎩', g: 2 }, { w: 'hen', e: '🐔', g: 2 }, { w: 'rat', e: '🐀', g: 2 }, { w: 'map', e: '🗺️', g: 2 }, { w: 'pen', e: '🖊️', g: 2 }, { w: 'ham', e: '🍖', g: 2 },
  { w: 'dog', e: '🐶', g: 3 }, { w: 'pig', e: '🐷', g: 3 }, { w: 'bus', e: '🚌', g: 3 }, { w: 'sun', e: '☀️', g: 3 }, { w: 'log', e: '🪵', g: 3 }, { w: 'bug', e: '🐛', g: 3 }, { w: 'bed', e: '🛏️', g: 3 }, { w: 'cup', e: '🥤', g: 3 },
  { w: 'van', e: '🚐', g: 4 }, { w: 'web', e: '🕸️', g: 4 }, { w: 'jet', e: '✈️', g: 4 }, { w: 'kid', e: '🧒', g: 4 }
];
// The pure sound of each letter, as phonemes for the voice maker ("buh", not "bee"). Said twice: "buh, buh".
export const IPA = {
  s: ['sss'], a: ['æ', 'æ'], t: ['tə', 'tə'], i: ['ɪ', 'ɪ'], p: ['pə', 'pə'], n: ['nnn'],
  c: ['kə', 'kə'], e: ['ɛ', 'ɛ'], h: ['hə', 'hə'], r: ['ɹɹ', 'ɹɹ'], m: ['mmm'], d: ['də', 'də'],
  g: ['ɡə', 'ɡə'], o: ['ɑ', 'ɑ'], u: ['ʌ', 'ʌ'], l: ['lll'], f: ['fff'], b: ['bə', 'bə'],
  k: ['kə', 'kə'], j: ['ʤə', 'ʤə'], v: ['vvv'], w: ['wə', 'wə'], y: ['jə', 'jə'], z: ['zzz']
};
export const letterPool = g => GROUPS.slice(0, g + 1).flat();
export const LINES = [
  { key: 'al:find', say: 'Find the letter that says' },
  { key: 'al:asin', say: 'as in' },
  { key: 'al:oops', say: 'Oops. That letter says' },
  { key: 'al:yes', say: 'Yes!' },
  { key: 'al:sound', say: 'Sound it out.' },
  { key: 'al:what', say: 'What is the word?' },
  { key: 'done', say: 'Well done!' },
  ...Object.entries(IPA).map(([l, ipa]) => ({ key: 'snd:' + l, ipa, speed: 0.85 })),
  ...Object.entries(KEY).map(([l, [w]]) => ({ key: 'kw:' + l, say: w.replace('-', ' ') + '.' })),
  ...WORDS.map(({ w }) => ({ key: 'w:' + w, say: w + '.' }))
];
