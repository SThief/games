// Everything Toy Room can say, and the words it teaches. The game and the voice maker both read this file.
export const TOYS = [
  { id: 'cat', icon: '🐱' }, { id: 'ball', icon: '⚽' }, { id: 'teddy', icon: '🧸' }, { id: 'duck', icon: '🦆' },
  { id: 'cup', icon: '☕' }, { id: 'book', icon: '📕' }, { id: 'hat', icon: '🎩' }, { id: 'apple', icon: '🍎' }
];
export const RELS = { on: 'on', in: 'in', under: 'under', next: 'next to' };
// Which words each piece of furniture can go with (a box holds things in it; you cannot sit a cup "on" its open top).
export const PAIRS = { bed: ['on', 'under', 'next'], table: ['on', 'under', 'next'], chair: ['on', 'next'], box: ['in', 'next'] };
export const LEVELS = [['on', 'in'], ['under', 'next'], ['on', 'in', 'under', 'next']];
export const taskText = (t, r, f) => `Put the ${t} ${RELS[r]} the ${f}.`;
export const isText = (t, r, f) => r === 'floor' ? `The ${t} is on the floor.` : `The ${t} is ${RELS[r]} the ${f}.`;
export const thatText = t => `That is the ${t}.`;
export const key = {
  task: (t, r, f) => `task:${t}:${r}:${f}`,
  is: (t, r, f) => r === 'floor' ? `is:${t}:floor` : `is:${t}:${r}:${f}`,
  that: t => `that:${t}`, toy: t => `toy:${t}`, furn: f => `furn:${f}`
};
export const LINES = [];
for (const t of TOYS) {
  LINES.push({ key: key.toy(t.id), say: t.id[0].toUpperCase() + t.id.slice(1) + '.' });
  LINES.push({ key: key.that(t.id), say: thatText(t.id) });
  LINES.push({ key: key.is(t.id, 'floor'), say: isText(t.id, 'floor') });
  for (const [f, rels] of Object.entries(PAIRS)) for (const r of rels) {
    LINES.push({ key: key.task(t.id, r, f), say: taskText(t.id, r, f) });
    LINES.push({ key: key.is(t.id, r, f), say: isText(t.id, r, f) });
  }
}
for (const f of Object.keys(PAIRS)) LINES.push({ key: key.furn(f), say: f[0].toUpperCase() + f.slice(1) + '.' });
LINES.push({ key: 'yes', say: 'Yes!' }, { key: 'done', say: 'Well done!' });
