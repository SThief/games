// Shared by the kid games: real voice clips, a spaced memory of what the child misses, small sounds.
// One copy on purpose: every game imports this file, so a fix here fixes all of them.

const BASE = new URL('./voice/', import.meta.url);
let manifest = {}, ac = null, token = 0, quiet = false, muted = false;
const buffers = new Map();
export const missing = new Set();   // keys the game asked to say that have no recorded clip
export const said = [];             // every key asked for, in order (tests read this)

export function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ } }
  if (ac && ac.state === 'suspended') ac.resume();
  return ac;
}
export async function loadVoice() {
  try { manifest = await (await fetch(new URL('manifest.json', BASE), { cache: 'no-store' })).json(); } catch (e) { manifest = {}; }
}
export const setQuiet = v => { quiet = v; };
export const setMuted = v => { muted = v; if (v) stopSpeech(); };
export const isMuted = () => muted;

async function clip(key) {
  if (buffers.has(key)) return buffers.get(key);
  const a = audio(); if (!a || !manifest[key]) return null;
  const data = await (await fetch(new URL(manifest[key], BASE))).arrayBuffer();
  const buf = await new Promise((ok, no) => a.decodeAudioData(data, ok, no));
  buffers.set(key, buf); return buf;
}
export function preload(keys) { if (quiet) return; for (const k of keys) clip(k).catch(() => {}); }
export function stopSpeech() { token++; if (playing) { try { playing.stop(); } catch (e) { /* already stopped */ } playing = null; } }
let playing = null;

// Say one clip. Resolves when it ends (never hangs: capped at the clip length + 0.5 s).
// A newer say(), sayChain() or stopSpeech() cancels this one.
export function say(key, opts) { return play(key, ++token, opts); }
// Say several clips in a row; cancelled the same way.
export async function sayChain(keys, gapMs = 120) {
  const my = ++token;
  for (const k of keys) {
    if (token !== my) return;
    await play(k, my);
    if (token !== my) return;
    if (gapMs) await sleep(gapMs);
  }
}
async function play(key, my, { gain = 1 } = {}) {
  said.push(key);
  if (!manifest[key]) missing.add(key);
  if (quiet || muted) return;
  if (playing) { try { playing.stop(); } catch (e) { /* ok */ } playing = null; }
  const a = audio(); let buf = null;
  try { buf = await clip(key); } catch (e) { /* fall through to the device voice */ }
  if (my !== token) return;
  if (!buf) return deviceSay(key);
  const src = a.createBufferSource(), g = a.createGain(); g.gain.value = gain;
  src.buffer = buf; src.connect(g); g.connect(a.destination); playing = src; src.start();
  await new Promise(r => { src.onended = r; setTimeout(r, buf.duration * 1000 + 500); });
  if (playing === src) playing = null;
}
function deviceSay(text) {
  if (!window.speechSynthesis) return sleep(600);
  return new Promise(r => { const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = .85; u.onend = r; speechSynthesis.speak(u); setTimeout(r, 4000); });
}
export const sleep = ms => new Promise(r => setTimeout(r, quiet ? 0 : ms));

// ---------- small sounds (oscillators, no files) ----------
export function tone(f, d, type = 'sine', v = .07, slide = 0, delay = 0) {
  if (quiet || muted) return; const a = audio(); if (!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + .02);
}
let NB = null;
export function noise(d, v = .08, freq = 1200) {
  if (quiet || muted) return; const a = audio(); if (!a) return;
  if (!NB) { NB = a.createBuffer(1, a.sampleRate, a.sampleRate); const ch = NB.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = NB; f.type = 'lowpass'; f.frequency.value = freq; g.gain.setValueAtTime(v, a.currentTime); g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + d);
  s.connect(f); f.connect(g); g.connect(a.destination); s.start(); s.stop(a.currentTime + d + .02);
}
export const sfx = {
  pop: () => { tone(500, .08, 'sine', .08, 500); },
  boing: () => { tone(180, .35, 'sine', .1, 260); },
  thud: () => { tone(90, .16, 'sine', .12, -40); noise(.08, .05, 300); },
  cheer: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .18, 'triangle', .07, 0, i * .07)),
  big: () => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .3, 'triangle', .07, 0, i * .09)),
  bonk: () => { tone(150, .3, 'square', .06, -100); tone(300, .15, 'triangle', .05, -120, .05); },
  star: n => tone(660 * Math.pow(1.19, n), .3, 'triangle', .07, 200),
  whoosh: () => noise(.25, .06, 2200),
  tick: () => tone(700, .04, 'square', .03)
};

// ---------- what the child knows ----------
// Leitner boxes: right first time moves an item up a box; wrong sends it back to box 1.
// Items in low boxes are picked more often, so misses come back and known things fade away.
const KEY = 'kid-mastery-v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
const write = m => { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) { /* private mode */ } };
const WEIGHT = [0, 6, 3.5, 2, 1, .5];
export const mastery = {
  get(game, item) { return read()[game + ':' + item] || { box: 0, right: 0, wrong: 0 }; },
  record(game, item, firstTryRight) {
    const m = read(), k = game + ':' + item, e = m[k] || { box: 1, right: 0, wrong: 0 };
    if (firstTryRight) { e.right++; e.box = Math.min(5, e.box + 1); } else { e.wrong++; e.box = 1; }
    e.t = Date.now(); m[k] = e; write(m); return e;
  },
  // met once with help (the intro round): counts as seen, not as right or wrong
  seen(game, item) { const m = read(), k = game + ':' + item; if (!m[k]) { m[k] = { box: 1, right: 0, wrong: 0, intro: 1, t: Date.now() }; write(m); } },
  isNew(game, item) { return !read()[game + ':' + item]; },
  // pick one item, favouring the ones the child misses; never the same as `avoid` unless it is the only one
  pick(game, items, avoid) {
    const m = read(), pool = items.filter(i => i !== avoid); const from = pool.length ? pool : items;
    const w = from.map(i => { const e = m[game + ':' + i]; return e ? WEIGHT[e.box] : 4; });
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < from.length; i++) { if ((r -= w[i]) <= 0) return from[i]; }
    return from[from.length - 1];
  },
  all: read,
  clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ok */ } }
};

// ---------- progress (which room / group is open, stars) ----------
const PK = 'kid-progress-v1';
const pread = () => { try { return JSON.parse(localStorage.getItem(PK) || '{}'); } catch (e) { return {}; } };
export const progress = {
  get(game) { return pread()[game] || { unlocked: 1, stars: {} }; },
  finish(game, level, stars, unlockNext) {
    const p = pread(), g = p[game] || { unlocked: 1, stars: {} };
    g.stars[level] = Math.max(g.stars[level] || 0, stars);
    if (unlockNext && level + 1 > g.unlocked) g.unlocked = level + 1;
    p[game] = g; try { localStorage.setItem(PK, JSON.stringify(p)); } catch (e) { /* ok */ }
    return g;
  }
};

// ---------- confetti (DOM, works over any canvas) ----------
export function confetti(n = 60) {
  if (quiet) return;
  const cols = ['#ff5d73', '#ffc857', '#4dd2ff', '#7dff6b', '#c58cff'];
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i'), s = 8 + Math.random() * 10;
    d.style.cssText = `position:fixed;z-index:50;pointer-events:none;left:${Math.random() * 100}vw;top:-20px;width:${s}px;height:${s * .6}px;background:${cols[i % 5]};border-radius:2px`;
    document.body.appendChild(d);
    const a = d.animate([{ transform: 'translateY(0) rotate(0)', opacity: 1 }, { transform: `translate(${(Math.random() - .5) * 200}px,${innerHeight + 40}px) rotate(${Math.random() * 900}deg)`, opacity: .9 }], { duration: 1800 + Math.random() * 1400, easing: 'cubic-bezier(.3,.6,.5,1)', delay: Math.random() * 500 });
    a.onfinish = () => d.remove();
  }
}
