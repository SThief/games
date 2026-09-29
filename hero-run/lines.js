// Everything Hero Run can say. The game and the voice maker both read this file, so they cannot drift apart.
export const VERBS = [
  { id: 'jump',  word: 'Jump',  icon: '⬆️' },
  { id: 'duck',  word: 'Duck',  icon: '⬇️' },
  { id: 'left',  word: 'Left',  icon: '⬅️' },
  { id: 'right', word: 'Right', icon: '➡️' },
  { id: 'stop',  word: 'Stop',  icon: '✋' },
  { id: 'spin',  word: 'Spin',  icon: '🌀' }
];
export const LEVELS = [['jump', 'duck'], ['jump', 'duck', 'left', 'right'], ['jump', 'duck', 'left', 'right', 'stop', 'spin']];
export const CHEERS = ['Yes!', 'Great!', 'Wow!', 'Super!'];
export const LINES = [
  ...VERBS.map(v => ({ key: 'cmd:' + v.id, say: v.word + '!', speed: 0.95 })),
  ...CHEERS.map((c, i) => ({ key: 'cheer:' + i, say: c })),
  { key: 'oops', say: 'Oops!' },
  { key: 'go', say: 'Ready? Go!' },
  { key: 'done', say: 'Well done!' }
];
