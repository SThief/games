// Everything Feelings Friends can say, and the feelings it teaches. The game, the grown-ups page and the voice maker read this file.
export const FEELINGS = {
  happy:     { e: '😊', help: ['🎉', 'dance', "Let's dance!"] },
  sad:       { e: '😢', help: ['🤗', 'hug', "Let's give Pip a hug."] },
  angry:     { e: '😠', help: ['🌬️', 'breathe', "Let's take a big, slow breath."] },
  scared:    { e: '😨', help: ['🤝', 'hold hands', "Let's hold Pip's hand."] },
  surprised: { e: '😲', help: ['👏', 'clap', "Let's clap!"] },
  tired:     { e: '😴', help: ['🛏️', 'nap', 'Time for a little nap.'] },
  hungry:    { e: '😋', help: ['🍎', 'apple', "Let's eat an apple."] }
};
// A story is a small scene; `props` is what appears on screen, `anim` how it moves.
export const STORIES = [
  { id: 'birthday', f: 'happy', say: "It is Pip's birthday! Here is a cake.", props: ['🎂', '🎈', '🎈'], anim: 'appear' },
  { id: 'puppy', f: 'happy', say: 'Pip has a new puppy!', props: ['🐶'], anim: 'runin' },
  { id: 'icecream', f: 'sad', say: "Oh no! Pip's ice cream fell down.", props: ['🍦'], anim: 'fall' },
  { id: 'balloon', f: 'sad', say: "Oh no! Pip's balloon flew away.", props: ['🎈'], anim: 'floataway' },
  { id: 'tower', f: 'angry', say: "Someone knocked down Pip's tower!", props: ['🧱', '🧱', '🧱', '🧱'], anim: 'topple' },
  { id: 'toy', f: 'angry', say: "Someone took Pip's teddy!", props: ['🧸'], anim: 'grab' },
  { id: 'spider', f: 'scared', say: 'A big spider! Eek!', props: ['🕷️'], anim: 'drop' },
  { id: 'thunder', f: 'scared', say: 'Boom! Thunder in the dark!', props: ['⚡', '🌩️'], anim: 'storm' },
  { id: 'present', f: 'surprised', say: 'Pop! A present for Pip!', props: ['🎁'], anim: 'popup' },
  { id: 'rabbit', f: 'surprised', say: 'A rabbit jumps out of the hat!', props: ['🎩', '🐰'], anim: 'hat' },
  { id: 'playday', f: 'tired', say: 'Pip played all day. Yawn!', props: ['⚽', '🌙'], anim: 'night' },
  { id: 'late', f: 'tired', say: 'It is very late at night.', props: ['🌙', '⭐', '⭐'], anim: 'night' },
  { id: 'tummy', f: 'hungry', say: "Pip's tummy is rumbling. Grrr!", props: ['🍽️'], anim: 'rumble' },
  { id: 'lunch', f: 'hungry', say: 'It is lunch time, and the plate is empty.', props: ['🕛', '🍽️'], anim: 'rumble' }
];
export const LEVELS = [
  { icon: '😊😢', name: 'Faces', feels: ['happy', 'sad', 'angry', 'scared'], plan: 'faces', rounds: 8, choices: 3 },
  { icon: '📖', name: 'Stories', feels: ['happy', 'sad', 'angry', 'scared', 'surprised'], plan: 'stories', rounds: 6, choices: 3 },
  { icon: '🌈', name: 'All feelings', feels: Object.keys(FEELINGS), plan: 'mix', rounds: 8, choices: 4 }
];
const FRIEND = 'af_sky';
export const LINES = [
  { key: 'fe:hi', say: "Meet Pip and friends! Let's learn about feelings." },
  { key: 'fe:how', say: 'How does Pip feel?' },
  { key: 'fe:you', say: 'How do you feel today?' },
  { key: 'fe:thanks', say: 'Thank you! Now I feel happy!', voice: FRIEND },
  ...Object.entries(FEELINGS).flatMap(([f, d]) => [
    { key: 'fe:who:' + f, say: `Who is ${f}?` },
    { key: 'fe:iam:' + f, say: `I am ${f}!`, voice: FRIEND },
    { key: 'fe:ifeel:' + f, say: `I feel ${f}.`, voice: FRIEND },
    { key: 'fe:is:' + f, say: `Pip is ${f}.` },
    { key: 'fe:isit:' + f, say: `Is Pip ${f}? Look again!` },
    { key: 'fe:help:' + f, say: d.help[2] }
  ]),
  ...STORIES.map(s => ({ key: 'fe:story:' + s.id, say: s.say })),
  { key: 'cheer:0', say: 'Yes!' }, { key: 'cheer:1', say: 'Great!' }, { key: 'cheer:2', say: 'Wow!' }, { key: 'cheer:3', say: 'Super!' },
  { key: 'done', say: 'Well done!' }
];
