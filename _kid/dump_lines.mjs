// Collects every line each kid game can say into lines.json (the single source is each game's lines.js).
// Run:  node _kid/dump_lines.mjs
import { writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const games = ['hero-run', 'toy-room', 'alphabet-alley', 'monster-maker', 'rhyme-frog', 'weather-wardrobe', 'feelings-friends'];
const all = new Map();
for (const g of games) {
  const f = path.join(root, g, 'lines.js');
  if (!existsSync(f)) continue;
  const { LINES } = await import(pathToFileURL(f).href);
  for (const l of LINES) {
    const prev = all.get(l.key);
    if (prev && JSON.stringify(prev) !== JSON.stringify(l)) throw new Error(`two games disagree about the line "${l.key}"`);
    all.set(l.key, l);
  }
  console.log(g, LINES.length, 'lines');
}
writeFileSync(path.join(root, '_kid', 'lines.json'), JSON.stringify([...all.values()], null, 1));
console.log('total', all.size, 'lines ->', '_kid/lines.json');
