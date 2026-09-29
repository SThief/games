'use strict';
(() => {
const stage = document.getElementById('stage');
const scene = document.getElementById('scene');
const $ = id => document.getElementById(id);

const SAVE_KEY = 'little-garden-v3';
const K_PLANT = 0.0333, K_ANIMAL = 0.062;          // cqw per sprite pixel
const BED_W = 20, COLS = [28, 50, 72], ROWS = [21, 44];
const SLOTS = [[0.5, 0.22], [0.3, 0.35], [0.7, 0.35], [0.5, 0.48]];   // back, left, right, front, as fractions of the bed
const GROW_MS = 600;                                // pouring time per growth step
const HINT_MS = 8000, FIRST_HINT_MS = 900;          // the first carrots are shown step by step
const GIANT_W = 16;                                 // a giant plant's width, cqw

let DATA, SIZES, MANIFEST = {}, BED_H;
let S, playing = false, epoch = 0;
let V = null, W = null, selected = null, cloudReady = true;
let visitorTimer = 0, wishTimer = 0;
const beds = [];

// Every async step captures the epoch it started in. Home, night and morning bump it,
// so a step still running from an old screen stops instead of writing into the new one.
const live = ep => ep === epoch && playing;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pick = a => a[Math.floor(Math.random() * a.length)];

// Must match fill() in tools/make_voice.py: the voice manifest is keyed by the exact text.
function fill(t, w, a) {
  const one = w.one || '', many = w.many || '';
  if (a) t = t.replace(/\{animal\}/g, a.one);
  return t.replace(/\{One\}/g, one.charAt(0).toUpperCase() + one.slice(1)).replace(/\{Many\}/g, many.charAt(0).toUpperCase() + many.slice(1))
    .replace(/\{one\}/g, one).replace(/\{many\}/g, many);
}
const L = k => DATA.lines[k];
const plantById = id => DATA.plants.find(p => p.id === id);
const visitors = () => DATA.animals.filter(a => a.visitor);
const level = () => Math.min(2, S.day - 1);                      // day 1 Look, day 2 Read, then Listen
const goal = () => DATA.goal[Math.min(S.day, DATA.goal.length) - 1];

// ---------- save ----------
function fresh() { return { v: 3, day: 1, basket: 0, today: {}, words: {}, tut: false, music: true, mystery: true, giants: [], beds: [null, null, null, null, null, null] }; }
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    const ok = s && s.v === 3 && Number.isFinite(s.day) && s.day >= 1 && Number.isFinite(s.basket) && Array.isArray(s.beds) && s.beds.length === 6
      && s.today && typeof s.today === 'object' && s.words && typeof s.words === 'object' && Array.isArray(s.giants);
    if (ok) {
      s.beds = s.beds.map(b => (b && plantById(b.plant) && b.stage >= 0 && b.stage <= 5 && Array.isArray(b.mask) && b.mask.length === 4 && b.mask.some(Boolean) ? b : null));
      for (const id of Object.keys(s.today)) if (!plantById(id) || !Number.isFinite(s.today[id])) delete s.today[id];
      return s;
    }
  } catch (e) { /* a broken save starts a new garden */ }
  return fresh();
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* private mode: play without saving */ } }
function stat(id) { return S.words[id] || (S.words[id] = { planted: 0, picked: 0 }); }

// ---------- audio ----------
const AC = new (window.AudioContext || window.webkitAudioContext)();
const out = AC.createGain(); out.gain.value = 0.9; out.connect(AC.destination);
const musicBus = AC.createGain(); musicBus.gain.value = 1; musicBus.connect(out);
const clips = new Map();
function decode(buf) {
  return new Promise(res => {
    try { const p = AC.decodeAudioData(buf, res, () => res(null)); if (p && p.then) p.then(res, () => res(null)); } catch (e) { res(null); }
  });
}
function loadClip(key) {
  if (!clips.has(key)) {
    const f = MANIFEST[key];
    clips.set(key, f ? fetch('voice/' + f).then(r => (r.ok ? r.arrayBuffer() : null)).then(b => b && decode(b)).catch(() => null) : Promise.resolve(null));
  }
  return clips.get(key);
}
async function preloadVoice() {
  const all = Object.keys(MANIFEST), next = () => all.length && loadClip(all.shift()).then(next);
  await Promise.all([next(), next(), next(), next(), next()]);
}
let voice = null, sayToken = 0;
const warned = new Set();
function stopVoice() {
  if (voice) { const v = voice; voice = null; try { v.src.onended = null; v.src.stop(); } catch (e) { /* already stopped */ } v.done(); }
  if (window.speechSynthesis) speechSynthesis.cancel();
}
// voiceId is an animal's own voice for its sound; the narrator's lines are keyed by text alone.
const said = [];
async function say(text, voiceId) {
  const token = ++sayToken;
  stopVoice();
  const buf = await Promise.race([loadClip(voiceId ? `${voiceId}|${text}` : text), sleep(1500).then(() => null)]);
  if (token !== sayToken) return;
  if (!buf) return fallbackSay(text);
  await new Promise(done => {
    const src = AC.createBufferSource();
    src.buffer = buf; src.connect(out);
    // Capped: if the audio clock stalls (tab hidden, iOS interruption) the game must not freeze on onended.
    const cap = setTimeout(finish, buf.duration * 1000 + 500);
    function finish() { clearTimeout(cap); if (voice && voice.src === src) voice = null; done(); }
    src.onended = finish;
    voice = { src, done: finish };
    src.start();
    said.push(text); if (said.length > 8) said.shift();
  });
}
function fallbackSay(text) {
  if (!warned.has(text)) { warned.add(text); console.warn('[little-garden] no voice clip, using device voice for:', text); }
  if (!window.speechSynthesis) return sleep(600);
  return new Promise(res => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 0.9;
    const cap = setTimeout(res, 800 + text.length * 90);
    u.onend = () => { clearTimeout(cap); res(); };
    speechSynthesis.speak(u);
  });
}
function tone(f, dur, type = 'sine', vol = 0.2, to, dest = out) {
  const at = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(dest); o.start(at); o.stop(at + dur + 0.02);
}
let noiseBuf = null;
function noiseSource() {
  if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s;
}
function noise(dur, freq, vol) {
  const t = AC.currentTime, s = noiseSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + dur + 0.05);
}
const sfx = {
  pop: () => tone(520, 0.1, 'sine', 0.25, 900),
  boop: () => tone(330, 0.18, 'sine', 0.2, 210),
  tick: n => tone(420 + n * 110, 0.12, 'triangle', 0.18, 520 + n * 130),
  sparkle: () => [1319, 1568, 2093, 1760].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'sine', 0.08), i * 70)),
  munch: () => [0, 150, 300].forEach(d => setTimeout(() => noise(0.09, 500, 0.2), d)),
  fanfare: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, i === 3 ? 0.5 : 0.18, 'triangle', 0.16), i * 130)),
  tiptoe: () => tone(900, 0.04, 'sine', 0.05, 700),
  whoosh: () => noise(0.35, 700, 0.14),
  birds: () => [0, 180, 300, 900, 1050].forEach((d, i) => setTimeout(() => tone(2600 + i * 180, 0.07, 'sine', 0.06, 3400 + i * 120), d)),
  yawn: () => tone(420, 0.8, 'sine', 0.12, 260),
  cricket: () => [0, 90, 180].forEach(d => setTimeout(() => tone(4200, 0.05, 'sine', 0.025, 3900), d)),
  lullaby: () => [784, 659, 587, 523].forEach((f, i) => setTimeout(() => tone(f, 0.5, 'triangle', 0.1), i * 320)),
};
let waterGain = null;
function setPour(on, loud) {
  if (!waterGain) {
    const s = noiseSource(), f = AC.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
    waterGain = AC.createGain(); waterGain.gain.value = 0;
    s.connect(f).connect(waterGain).connect(out); s.start();
  }
  waterGain.gain.setTargetAtTime(on ? (loud ? 0.16 : 0.09) : 0, AC.currentTime, 0.05);
}
// A soft music-box loop: C G Am F, one plucked note per beat.
const NOTE = n => 261.63 * Math.pow(2, n / 12);
const PROG = [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]];
let musicTimer = 0, beat = 0;
function musicTick() {
  if (!playing) return;
  const ch = PROG[Math.floor(beat / 8) % 4], i = beat % 8;
  tone(NOTE(ch[[0, 1, 2, 1, 2, 1, 0, 1][i]] + 12), 0.4, 'triangle', 0.035, null, musicBus);
  if (i === 0 || i === 4) tone(NOTE(ch[0] - 12), 0.6, 'sine', 0.05, null, musicBus);
  beat++;
}
function setMusic(on) {
  S.music = on; save();
  $('music').classList.toggle('muted', !on);
  if (on && !musicTimer) musicTimer = setInterval(musicTick, 300);
  if (!on && musicTimer) { clearInterval(musicTimer); musicTimer = 0; }
}

// ---------- helpers for placing things ----------
function el(tag, cls, parent = stage) { const e = document.createElement(tag); if (cls) e.className = cls; parent.appendChild(e); return e; }
function sprite(name, cls, parent) { const i = el('img', cls, parent); i.src = `art/${name}.webp`; i.alt = ''; i.draggable = false; return i; }
const w = (name, k) => SIZES[name][0] * k;
const h = (name, k) => SIZES[name][1] * k;
// A rectangle in cqw, relative to the stage: the unit every position in this game uses.
function box(e) {
  const r = e.getBoundingClientRect(), s = stage.getBoundingClientRect(), u = s.width / 100;
  return { x: (r.left - s.left) / u, y: (r.top - s.top) / u, w: r.width / u, h: r.height / u };
}
function toCqw(clientX, clientY) { const s = stage.getBoundingClientRect(), u = s.width / 100; return [(clientX - s.left) / u, (clientY - s.top) / u]; }
function toClient(x, y) { const s = stage.getBoundingClientRect(), u = s.width / 100; return [s.left + x * u, s.top + y * u]; }
function anim(e, frames, opts) {
  const a = e.animate(frames, opts);
  return Promise.race([a.finished.catch(() => {}), sleep((opts.duration || 300) * (opts.iterations || 1) + (opts.delay || 0) + 120)]).then(() => a);
}
function flash(e, cls) { if (!e) return; e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); setTimeout(() => e.classList.remove(cls), 800); }
function farmerCheer() { flash($('farmer'), 'cheer'); }
function sparkles(target, n = 8) {
  const b = box(target);
  for (let k = 0; k < n; k++) {
    const s = el('div', 'spark');
    s.innerHTML = '<svg viewBox="0 0 24 24" width="100%" height="100%"><use href="#i-star"/></svg>';
    Object.assign(s.style, { left: b.x + b.w * (0.1 + Math.random() * 0.8) + 'cqw', top: b.y + b.h * Math.random() * 0.5 - 3 + 'cqw' });
    anim(s, [{ transform: 'scale(0)', opacity: 1 }, { transform: 'translateY(-5cqw) scale(1) rotate(90deg)', opacity: 0 }], { duration: 900, delay: k * 60, fill: 'both' }).then(() => s.remove());
  }
}

// ---------- the scene ----------
const BASKET = '<svg viewBox="0 0 140 100" aria-hidden="true"><path d="M30 40q40-44 80 0" fill="none" stroke="#8a5a2b" stroke-width="8" stroke-linecap="round"/><ellipse cx="70" cy="42" rx="58" ry="7" fill="#6b4119"/></svg>'
  + '<div class="items"></div>'
  + '<svg viewBox="0 0 140 100" aria-hidden="true"><path d="M12 40h116l-12 52a8 8 0 0 1-8 6H32a8 8 0 0 1-8-6z" fill="#c98a45" stroke="#7a4a1f" stroke-width="4" stroke-linejoin="round"/><path d="M22 56h96M26 72h88M46 42v54M70 42v56M94 42v54" stroke="#9c6630" stroke-width="3"/></svg>'
  + '<span class="count">0</span>';
function buildScene() {
  const deco = [
    ['tree_orange', 5, 22, 16], ['tree_red', 17, 20, 13], ['pine', 64, 18, 8], ['tree_yellow', 84, 20, 12], ['pine_small', 95, 20, 7],
    ['bush_green', 26, 23, 8], ['bush_berry', 45, 22, 7], ['flowers_purple', 60, 22, 7], ['bush_orange', 76, 22.5, 8], ['flowers_white', 97, 27, 7],
    ['rock_big', 96, 70, 7], ['flowers_white', 23, 73, 6], ['bush_green', 90, 96, 9], ['rocks_small', 76, 97, 5],
  ];
  for (const [name, x, y, wd] of deco) {
    const i = sprite(name, 'deco', scene);
    // backdrop pieces stay behind every bed; only the front corners sit above them
    Object.assign(i.style, { left: x + '%', top: y + '%', width: wd + 'cqw', zIndex: y < 50 ? 10 : 40 });
  }
  const f = sprite('farmer', '', scene);
  f.id = 'farmer';
  Object.assign(f.style, { left: '10%', top: '56%', width: '10.5cqw', zIndex: 45 });
  f.addEventListener('pointerdown', e => { e.preventDefault(); if (!playing) return; poke(); farmerCheer(); if (W) sayWish(); else say(L('hi')); });
  const sh = el('div', 'shadow', scene);
  Object.assign(sh.style, { left: '4.6%', top: '54.8%', width: '11cqw', height: '2.4cqw', zIndex: 44 });
  const bk = el('div', '', scene);
  bk.id = 'basket'; bk.innerHTML = BASKET;

  BED_H = BED_W * SIZES.bed_dry[1] / SIZES.bed_dry[0];
  for (let i = 0; i < 6; i++) {
    const row = i < 3 ? 0 : 1, col = i % 3;
    const b = el('div', 'bed', scene);
    Object.assign(b.style, { left: COLS[col] + '%', top: ROWS[row] + '%', width: BED_W + 'cqw', height: BED_H + 'cqw', zIndex: 20 + row * 10 });
    const soil = sprite('bed_dry', 'soil', b);
    const plants = el('div', 'plants', b);
    b.addEventListener('pointerdown', e => { e.preventDefault(); onBedTap(i, e.target.dataset.slot); });
    beds.push({ b, soil, plants, wet: 0, soilName: 'bed_dry' });
  }
  setInterval(() => beds.forEach((_, i) => soil(i)), 800);

  const bf = DATA.animals.find(a => a.flies);
  if (bf) {
    const b = sprite(bf.id, '', scene);
    b.id = 'butterfly';
    Object.assign(b.style, { width: w(bf.id, K_ANIMAL) + 'cqw', left: '60%', top: '12%' });
    b.addEventListener('pointerdown', e => { e.preventDefault(); if (!playing) return; poke(); say(fill(L('word'), bf)); flyButterfly(); });
    const loop = () => { flyButterfly(); setTimeout(loop, 3400); };
    setTimeout(loop, 1500);
  }
}
function flyButterfly() { const b = $('butterfly'); if (b) Object.assign(b.style, { left: 26 + Math.random() * 64 + '%', top: 6 + Math.random() * 42 + '%' }); }
function soil(i) {
  const E = beds[i], want = E.wet > Date.now() ? 'bed_wet' : 'bed_dry';
  if (E.soilName !== want) { E.soil.src = `art/${want}.webp`; E.soilName = want; }
}
function renderBed(i, how) {
  const bed = S.beds[i], E = beds[i];
  soil(i);
  E.plants.textContent = '';
  E.b.classList.toggle('magic', !!(bed && bed.giant && bed.stage < 5));
  if (!bed) return;
  const put = (name, cls, gx, gy, width, s) => {
    const p = sprite(name, cls, E.plants), ph = width * SIZES[name][1] / SIZES[name][0];
    Object.assign(p.style, { width: width + 'cqw', left: gx * BED_W - width / 2 + 'cqw', top: gy * BED_H + 0.6 - ph + 'cqw', animationDelay: how === 'grow' ? s * 50 + 'ms' : -s * 0.7 + 's' });
    p.dataset.slot = s;
    return p;
  };
  if (bed.giant) {
    // one mystery plant in the middle: a sprout that swells each step, then the giant itself
    const cls = how === 'reveal' ? ' reveal' : how === 'grow' ? ' grow' : '';
    if (bed.stage === 0) put('seed_mound', 'mound magic' + cls, 0.5, 0.36, w('seed_mound', K_PLANT) * 1.5, 0);
    else if (bed.stage < 5) put(`${bed.plant}_1`, 'plant magic' + cls, 0.5, 0.36, w(`${bed.plant}_1`, K_PLANT) * (1 + bed.stage * 0.45), 0);
    else put(`${bed.plant}_5`, 'plant giant' + (cls || ' sway'), 0.5, 0.42, GIANT_W, 0);
    return;
  }
  SLOTS.forEach(([gx, gy], s) => {
    if (!bed.mask[s]) return;
    const seed = bed.stage === 0, name = seed ? 'seed_mound' : `${bed.plant}_${bed.stage}`;
    put(name, (seed ? 'mound' : 'plant') + (how === 'grow' ? ' grow' : bed.stage === 5 ? ' sway' : ''), gx, gy, w(name, K_PLANT), s);
  });
}
function renderAll() { for (let i = 0; i < 6; i++) renderBed(i); drawBasket(); }
function bedAt(x, y) {
  let best = -1, bestD = Infinity;
  beds.forEach((E, i) => {
    const r = E.b.getBoundingClientRect(), top = r.top - r.height * 0.5;
    if (x < r.left || x > r.right || y < top || y > r.bottom) return;
    const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height * 0.35));
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

// ---------- seeds ----------
function buildSeedbox() {
  const sb = $('seedbox');
  DATA.plants.forEach((p, k) => {
    const pk = el('div', 'packet', sb);
    pk.style.left = 1.6 + k * 14 + '%';
    sprite(`${p.id}_5`, '', pk);
    el('b', '', pk).textContent = p.one;
    pk.dataset.id = p.id;
    pk.addEventListener('pointerdown', e => packetDown(e, pk, p, false));
  });
  const m = el('div', 'packet mystery');
  m.id = 'mystery';
  el('span', '', m).textContent = '?';
  m.addEventListener('pointerdown', e => packetDown(e, m, null, true));
  m.hidden = !S.mystery;
}
function packetDown(e, pk, p, giant) {
  if (!playing) return;
  e.preventDefault(); poke();
  const id = e.pointerId, x0 = e.clientX, y0 = e.clientY;
  let ghost = null, over = -1;
  const move = ev => {
    if (ev.pointerId !== id) return;
    if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) {
      clearSelection();
      ghost = pk.cloneNode(true); ghost.removeAttribute('id'); ghost.classList.add('ghost'); stage.appendChild(ghost);
    }
    if (!ghost) return;
    const [x, y] = toCqw(ev.clientX, ev.clientY);
    Object.assign(ghost.style, { left: x - 3.8 + 'cqw', top: y - 6 + 'cqw' });
    const i = bedAt(ev.clientX, ev.clientY);
    if (i !== over) {
      if (over >= 0) beds[over].b.classList.remove('drop-ok');
      over = i;
      if (i >= 0 && !S.beds[i]) beds[i].b.classList.add('drop-ok');
    }
  };
  const up = ev => {
    if (ev.pointerId !== id) return;
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    if (over >= 0) beds[over].b.classList.remove('drop-ok');
    if (!ghost) return selectPacket(pk, p, giant);     // a tap picks the packet up; the next tap on a bed plants it
    ghost.remove();
    const i = ev.type === 'pointercancel' ? -1 : bedAt(ev.clientX, ev.clientY);
    if (i >= 0 && !S.beds[i]) plantBed(i, p, giant);
    else if (i >= 0) { sfx.boop(); flash(beds[i].b, 'shake'); }
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}
function selectPacket(pk, p, giant) {
  const again = selected && selected.pk === pk;
  clearSelection();
  if (again || !playing) return;
  selected = { pk, p, giant };
  pk.classList.add('picked');
  beds.forEach((E, i) => { if (!S.beds[i]) E.b.classList.add('drop-ok'); });
  sfx.pop();
  say(giant ? L('mystery') : fill(L('words'), p));
}
function clearSelection() {
  selected = null;
  document.querySelectorAll('.packet.picked').forEach(e => e.classList.remove('picked'));
  beds.forEach(E => E.b.classList.remove('drop-ok'));
}
function plantBed(i, p, giant) {
  if (S.beds[i] || !playing) return;
  clearSelection();
  if (giant) {
    if (!S.mystery) return;
    // the surprise favours a giant the child has not grown yet
    const fresh = DATA.plants.filter(x => !S.giants.includes(x.id));
    S.beds[i] = { plant: pick(fresh.length ? fresh : DATA.plants).id, stage: 0, mask: [1, 0, 0, 0], giant: true };
    S.mystery = false;
    $('mystery').hidden = true;
    sfx.sparkle();
    say(L('mystery'));
  } else {
    S.beds[i] = { plant: p.id, stage: 0, mask: [1, 1, 1, 1] };
    stat(p.id).planted++;
    SLOTS.forEach((_, s) => setTimeout(sfx.pop, s * 90));
    say(fill(L('words'), p));
  }
  save();
  renderBed(i, 'grow');
  poke();
}

// ---------- water: hold the can over a bed, or tap the cloud to rain on every bed ----------
const can = $('can');
let drag = null, pourRaf = 0, lastT = 0, dropT = 0;
const pourAcc = [0, 0, 0, 0, 0, 0], spoke = new Set();
// Where the water leaves the spout while the can is tipped, in cqw from the can's top-left corner.
const TIP = [0.4, 6.2];
function setupCan() {
  can.classList.add('home');
  can.addEventListener('pointerdown', e => {
    if (!playing) return;
    e.preventDefault();
    try { can.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety; the moves still arrive */ }
    poke();
    const b = box(can), [x, y] = toCqw(e.clientX, e.clientY);
    drag = { id: e.pointerId, dx: x - b.x, dy: y - b.y, left: b.x, top: b.y, x0: e.clientX, y0: e.clientY, moved: false };
    can.classList.remove('home'); can.classList.add('held');
    lastT = performance.now();
    pourRaf = requestAnimationFrame(pourStep);
  });
  can.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) drag.moved = true;
    const [x, y] = toCqw(e.clientX, e.clientY);
    drag.left = x - drag.dx; drag.top = y - drag.dy;
    Object.assign(can.style, { left: drag.left + 'cqw', top: drag.top + 'cqw' });
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved;
    stopDrag();
    if (!moved && playing) { flash(can, 'shake'); const st = nextStep(); if (st && st.kind === 'water') showHint(); }
  };
  can.addEventListener('pointerup', end);
  can.addEventListener('pointercancel', end);
}
function stopDrag() {
  drag = null;
  cancelAnimationFrame(pourRaf);
  setPour(false); spoke.clear();
  can.classList.remove('held', 'pour');
  can.classList.add('home');
  can.style.left = ''; can.style.top = '';
}
function pourStep(t) {
  if (!drag) return;
  const dt = Math.min(100, t - lastT); lastT = t;
  const tipX = drag.left + TIP[0], tipY = drag.top + TIP[1];
  const i = bedAt(...toClient(tipX, tipY + 4));
  if (i >= 0 && playing) {
    can.classList.add('pour'); setPour(true);
    beds[i].wet = Date.now() + 2500; soil(i);
    if (t - dropT > 70) { dropT = t; spawnDrop(tipX, tipY, 6); }
    const bed = S.beds[i];
    if (bed && bed.stage < 5) {
      if (!spoke.has(i)) { spoke.add(i); if (!bed.giant) say(fill(L('grow'), plantById(bed.plant))); }
      pourAcc[i] += dt;
      if (pourAcc[i] >= GROW_MS) { pourAcc[i] = 0; growBed(i); }
    }
  } else { can.classList.remove('pour'); setPour(false); }
  pourRaf = requestAnimationFrame(pourStep);
}
function spawnDrop(x, y, fall) {
  const d = el('div', 'drop');
  Object.assign(d.style, { left: x + (Math.random() - 0.5) * 1.6 + 'cqw', top: y + 'cqw' });
  anim(d, [{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${fall}cqw)`, opacity: 0 }], { duration: 120 * fall ** 0.6 + 200, easing: 'ease-in' }).then(() => d.remove());
}
function growBed(i) {
  const bed = S.beds[i];
  if (!bed || bed.stage >= 5 || !playing) return;
  bed.stage++; save();
  poke();
  if (bed.giant && bed.stage === 5) {
    const p = plantById(bed.plant);
    if (!S.giants.includes(p.id)) S.giants.push(p.id);
    save();
    renderBed(i, 'reveal');
    sparkles(beds[i].b, 14); sfx.fanfare(); farmerCheer();
    say(fill(L('giant'), p));
    return;
  }
  renderBed(i, 'grow'); sfx.tick(bed.stage);
  if (bed.stage === 5) { sparkles(beds[i].b); sfx.sparkle(); farmerCheer(); say(L('ripe')); scheduleWish(1600); }
}
function onCloud() {
  if (!playing) return;
  poke();
  const cl = $('cloud');
  if (!cloudReady) { flash(cl, 'shake'); sfx.boop(); return; }
  const ep = epoch;
  cloudReady = false;
  cl.classList.remove('ready'); cl.classList.add('raining');
  say(L('rain'));
  setPour(true, true);
  const rain = setInterval(() => { for (let k = 0; k < 3; k++) spawnDrop(24 + Math.random() * 72, 10 + Math.random() * 6, 36 + Math.random() * 14); }, 45);
  const grown = S.beds.map((b, i) => (b && b.stage < 5 ? i : -1)).filter(i => i >= 0);
  grown.forEach((i, k) => setTimeout(() => { if (!live(ep)) return; beds[i].wet = Date.now() + 3000; growBed(i); }, 900 + k * 220));
  setTimeout(() => {
    clearInterval(rain);
    setPour(false);
    cl.classList.remove('raining'); cl.classList.add('tired');
    setTimeout(() => { cl.classList.remove('tired'); cl.classList.add('ready'); cloudReady = true; }, 20000);
  }, 2600);
}

// ---------- picking into the farmer's basket ----------
function pickPlant(i, slot) {
  const bed = S.beds[i];
  if (!bed || bed.stage < 5 || S.basket >= goal()) return;   // the basket is full: night is coming
  const s = slot != null && bed.mask[slot] ? +slot : [3, 2, 1, 0].find(k => bed.mask[k]);
  if (s == null) return;
  const E = beds[i], p = plantById(bed.plant), plantEl = E.plants.querySelector(`[data-slot="${s}"]`) || E.b;
  const wasGiant = bed.giant;
  bed.mask[s] = 0;
  if (!bed.mask.some(Boolean)) S.beds[i] = null;       // every plant picked: the bed is free again
  S.basket++; S.today[p.id] = (S.today[p.id] || 0) + 1; stat(p.id).picked++;
  save();
  sfx.pop();
  const from = box(plantEl), to = box($('basket'));
  const fly = sprite(`${p.id}_5`, '');
  Object.assign(fly.style, { left: from.x + 'cqw', top: from.y + 'cqw', width: from.w + 'cqw', zIndex: 95 });
  if (plantEl !== E.b) plantEl.remove();
  if (!S.beds[i]) renderBed(i);
  anim(fly, [{ transform: 'none' }, { transform: `translate(${to.x + to.w / 2 - from.x - from.w / 2}cqw, ${to.y - from.y - from.h * 0.4}cqw) scale(${wasGiant ? 0.3 : 0.45})` }],
    { duration: 560, easing: 'cubic-bezier(.4,-0.35,.6,1)', fill: 'forwards' })
    .then(() => { fly.remove(); drawBasket(); flash($('basket'), 'bump'); });
  if (wasGiant) sparkles($('basket'), 10);
  const done = W && W.plant === p && ++W.got >= W.n;
  if (W) markWish();
  say(L('count')[Math.min(S.basket, L('count').length) - 1]);
  if (done) finishWish();
  else if (S.basket >= goal()) { const ep = epoch; setTimeout(() => { if (live(ep)) nightfall(); }, 1400); }
  poke();
}
function drawBasket() {
  const items = $('basket').querySelector('.items');
  items.textContent = '';
  const ids = Object.entries(S.today).flatMap(([id, n]) => Array(n).fill(id)).slice(-6);
  ids.forEach(id => sprite(`${id}_5`, '', items));
  $('basket').querySelector('.count').textContent = `${S.basket}/${goal()}`;
}

// ---------- the farmer's wish: the English challenge of the day ----------
function scheduleWish(ms) {
  clearTimeout(wishTimer);
  const ep = epoch;
  wishTimer = setTimeout(() => { if (live(ep)) makeWish(); }, ms);
}
function ripeCounts() {
  const n = {};
  S.beds.forEach(b => { if (b && b.stage === 5 && !b.giant) n[b.plant] = (n[b.plant] || 0) + b.mask.filter(Boolean).length; });
  return n;
}
function makeWish() {
  if (W || !playing || S.basket >= goal()) return;
  const counts = ripeCounts(), kinds = Object.keys(counts);
  if (!kinds.length) return;
  const id = !S.tut && counts.carrot ? 'carrot' : pick(kinds);
  const n = !S.tut ? Math.min(2, counts[id]) : 1 + Math.floor(Math.random() * Math.min(3, counts[id]));
  W = { plant: plantById(id), n, got: 0 };
  const o = W.el = el('div', 'wish');
  o.addEventListener('pointerdown', e => { e.preventDefault(); poke(); sayWish(); });
  const text = fill(L('wish')[n - 1], W.plant);
  if (level() === 0) {
    const pics = el('div', 'pics', o);
    for (let k = 0; k < n; k++) sprite(`${id}_5`, '', pics);
    el('div', 'txt', o).textContent = text;
  } else if (level() === 1) el('div', 'txt', o).textContent = text;
  else el('div', 'spk', o).innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-spk"/></svg>· · ·';
  farmerCheer();
  sayWish();
  armHint();
}
// Read days teach reading: the wish is not spoken, only shown.
function sayWish() {
  if (!W) return;
  if (level() === 1) { flash(W.el, 'nudge'); sfx.pop(); return; }
  say(fill(L('wish')[W.n - 1], W.plant));
}
function markWish() { W.el.querySelectorAll('.pics img').forEach((img, k) => img.classList.toggle('got', k < W.got)); }
async function finishWish() {
  const ep = epoch, wish = W;
  W = null;
  S.tut = true; save();
  await sleep(700); if (!live(ep)) return;
  if (level() === 2) { wish.el.textContent = ''; el('div', 'txt', wish.el).textContent = fill(L('wish')[wish.n - 1], wish.plant); }
  farmerCheer(); sparkles(wish.el, 10); sfx.fanfare();
  await say(L('thanks'));
  wish.el.remove();
  if (!live(ep)) return;
  if (S.basket >= goal()) { await sleep(600); if (live(ep)) nightfall(); return; }
  scheduleVisitor(ep);
  scheduleWish(9000);
}
function removeWish() { if (W) { W.el.remove(); W = null; } }

// ---------- visitors who sneak in for a snack ----------
function scheduleVisitor(ep, ms) {
  clearTimeout(visitorTimer);
  visitorTimer = setTimeout(() => { if (!live(ep)) return; spawnVisitor(); scheduleVisitor(ep); }, ms ?? 16000 + Math.random() * 12000);
}
function spawnVisitor() {
  if (V || !playing || !S.tut) return;
  const targets = S.beds.map((b, i) => (b && !b.giant && b.stage >= 1 ? i : -1)).filter(i => i >= 0);
  if (!targets.length) return;
  const i = pick(targets), p = plantById(S.beds[i].plant), a = pick(visitors());
  const ep = epoch, fromLeft = COLS[i % 3] < 50 ? Math.random() < 0.7 : Math.random() < 0.3;
  const aw = w(a.id, K_ANIMAL) * 0.9, ah = h(a.id, K_ANIMAL) * 0.9;
  const row = i < 3 ? 0 : 1, gx = COLS[i % 3] + BED_W / 2, feet = (ROWS[row] / 100 * 75 + BED_H * 0.78);   // cqw from the top
  const v = V = { animal: a, bed: i, plant: p, arrived: false, gone: false, fromLeft };
  v.el = el('div', 'visitor' + (fromLeft ? '' : ' flip'));
  sprite(a.id, '', v.el);
  const start = fromLeft ? -aw - 2 : 102, stop = gx - aw / 2 + (fromLeft ? -4 : 4);
  Object.assign(v.el.style, { width: aw + 'cqw', left: start + 'cqw', top: feet - ah + 'cqw', zIndex: 25 + row * 10 });
  v.el.addEventListener('pointerdown', e => { e.preventDefault(); shoo(v); });
  void v.el.offsetWidth;
  v.el.style.transition = 'left 6s linear';
  v.el.style.left = stop + 'cqw';
  v.steps = setInterval(sfx.tiptoe, 260);
  say(a.sound, a.voice).then(() => { if (live(ep) && V === v && !v.gone) say(fill(L('trouble'), p, a)); });
  v.arrive = setTimeout(() => nibble(v, ep), 6000);
  armHint(S.tut ? 2500 : undefined);
}
async function nibble(v, ep) {
  if (!live(ep) || V !== v || v.gone) return;
  v.arrived = true;
  clearInterval(v.steps);
  v.el.classList.add('munch'); sfx.munch();
  await sleep(1600);
  if (!live(ep) || V !== v || v.gone) return;
  const bed = S.beds[v.bed];
  if (bed && !bed.giant && bed.plant === v.plant.id) {
    const s = [3, 2, 1, 0].find(k => bed.mask[k]);
    if (s != null) { bed.mask[s] = 0; if (!bed.mask.some(Boolean)) S.beds[v.bed] = null; save(); renderBed(v.bed); }
  }
  v.el.classList.remove('munch');
  await say(L('ate'));
  if (!live(ep) || V !== v) return;
  walkAway(v, 3);
}
async function shoo(v) {
  if (!playing || v.gone || V !== v) return;
  const ep = epoch;
  v.gone = true;
  clearTimeout(v.arrive); clearInterval(v.steps);
  poke();
  sfx.whoosh(); sparkles(v.el, 6);
  walkAway(v, 1, true);
  await say(fill(L('shoo'), {}, v.animal));
  if (live(ep)) say(v.animal.sound, v.animal.voice);
}
function walkAway(v, secs, back) {
  v.gone = true;
  const left = parseFloat(getComputedStyle(v.el).left) / (stage.getBoundingClientRect().width / 100);
  v.el.style.transition = 'none';
  v.el.style.left = left + 'cqw';
  const toLeft = back ? v.fromLeft : !v.fromLeft;
  v.el.classList.toggle('flip', !toLeft ? false : true);
  v.el.classList.add('run');
  void v.el.offsetWidth;
  v.el.style.transition = `left ${secs}s ease-in`;
  v.el.style.left = (toLeft ? -20 : 110) + 'cqw';
  setTimeout(() => v.el.remove(), secs * 1000 + 100);
  if (V === v) V = null;
}
function removeVisitor() {
  clearTimeout(visitorTimer);
  if (!V) return;
  clearTimeout(V.arrive); clearInterval(V.steps); V.el.remove();
  V = null;
}

// ---------- taps on the garden ----------
function onBedTap(i, slot) {
  if (!playing) return;
  poke();
  const bed = S.beds[i], E = beds[i];
  if (selected) {
    if (!bed) return plantBed(i, selected.p, selected.giant);
    sfx.boop(); return flash(E.b, 'shake');
  }
  if (!bed) { flash(E.b, 'shake'); const st = nextStep(); if (st && st.kind === 'plant') showHint(); return; }
  const p = plantById(bed.plant);
  if (bed.stage === 5) return pickPlant(i, slot);
  // not ready yet: the plants wiggle and say their name (a mystery plant keeps its secret)
  E.plants.querySelectorAll('.plant, .mound').forEach(e => flash(e, 'shake'));
  say(bed.giant ? L('mystery') : fill(L('words'), p));
}

// ---------- the helping hand ----------
let hintTimer = 0, hintEls = [];
function poke() { clearHint(); armHint(); }
function armHint(ms) {
  clearTimeout(hintTimer);
  if (playing) hintTimer = setTimeout(showHint, ms ?? (S.tut ? HINT_MS : FIRST_HINT_MS));
}
function clearHint() { clearTimeout(hintTimer); hintEls.forEach(e => e.remove()); hintEls = []; }
const bedOf = f => S.beds.findIndex(f);
// What the hand suggests next: chase a visitor, then help the wish, then whatever the garden needs.
function nextStep() {
  if (V && !V.gone && !V.arrived) return { kind: 'shoo' };
  const want = W ? W.plant.id : !S.tut ? 'carrot' : null;
  if (want) {
    let i = bedOf(b => b && b.plant === want && !b.giant && b.stage === 5);
    if (i >= 0) return { kind: 'pick', bed: i };
    i = bedOf(b => b && b.plant === want && !b.giant);
    if (i >= 0) return { kind: 'water', bed: i };
    i = bedOf(b => !b);
    if (i >= 0) return { kind: 'plant', bed: i, plant: plantById(want) };
  }
  let i = bedOf(b => b && b.stage === 5);
  if (i >= 0) return { kind: 'pick', bed: i };
  i = bedOf(b => b && b.stage < 5);
  if (i >= 0) return cloudReady ? { kind: 'rain', bed: i } : { kind: 'water', bed: i };
  i = bedOf(b => !b);
  if (i >= 0) return S.mystery ? { kind: 'mystery', bed: i } : { kind: 'plant', bed: i, plant: pick(DATA.plants) };
  return null;
}
function showHint(quiet) {
  clearHint();
  if (!playing) return;
  const st = nextStep();
  if (!st) return;
  const bedEl = st.bed != null ? beds[st.bed].b : null, bed = st.bed != null ? S.beds[st.bed] : null;
  if (st.kind === 'shoo') { if (!quiet) say(fill(L('trouble'), V.plant, V.animal)); handTap(V.el); }
  else if (st.kind === 'plant') { if (!quiet) say(fill(L('plant'), st.plant)); handDrag($('seedbox').querySelector(`[data-id="${st.plant.id}"]`), bedEl, false); }
  else if (st.kind === 'mystery') { if (!quiet) say(L('mystery')); handDrag($('mystery'), bedEl, false); }
  else if (st.kind === 'water') { if (!quiet && !bed.giant) say(fill(L('water'), plantById(bed.plant))); handDrag(can, bedEl, true); }
  else if (st.kind === 'rain') handTap($('cloud'));
  else { if (!quiet) say(fill(L(bed.giant ? 'giant' : 'pickHint'), plantById(bed.plant))); handTap(bedEl.querySelector('.plant') || bedEl); }
  armHint(S.tut ? HINT_MS * 1.4 : 5200);
}
function makeHand() {
  const hd = el('div', 'hand');
  hd.innerHTML = '<svg viewBox="0 0 64 72"><use href="#i-hand"/></svg>';
  hintEls.push(hd);
  return hd;
}
const TIPX = 7 * 24 / 64, TIPY = 7.9 * 4 / 72;      // the fingertip inside the hand picture, in cqw
// The hand carries a see-through copy of the packet or can, so the child sees what to move and where.
function handDrag(fromEl, toEl, pour) {
  if (!fromEl || fromEl.hidden) return;
  const a = box(fromEl), b = box(toEl);
  const ax = a.x + a.w * 0.55, ay = a.y + a.h * 0.55, bx = b.x + b.w / 2, by = b.y + b.h * (pour ? 0.05 : 0.4);
  const dx = bx - ax, dy = by - ay;
  const carry = fromEl.cloneNode(true);
  carry.removeAttribute('id'); carry.classList.remove('picked', 'home', 'held');
  Object.assign(carry.style, { position: 'absolute', left: a.x + 'cqw', top: a.y + 'cqw', width: a.w + 'cqw', zIndex: 96, pointerEvents: 'none', opacity: 0, margin: 0, animation: 'none' });
  stage.appendChild(carry); hintEls.push(carry);
  const hd = makeHand();
  Object.assign(hd.style, { left: ax - TIPX + 'cqw', top: ay - TIPY + 'cqw' });
  const at = (x, y, s = 0.92) => `translate(${x}cqw, ${y}cqw) scale(${s})`;
  const wig = pour ? [{ transform: at(dx - 1.6, dy + 0.8), opacity: 1, offset: 0.72 }, { transform: at(dx + 1.6, dy), opacity: 1, offset: 0.84 }] : [];
  const frames = [
    { transform: at(0, 0, 1.1), opacity: 0, offset: 0 }, { transform: at(0, 0, 1.1), opacity: 1, offset: 0.1 }, { transform: at(0, 0), opacity: 1, offset: 0.2 },
    { transform: at(dx, dy), opacity: 1, offset: 0.6 }, ...wig, { transform: at(dx, dy, 1.05), opacity: 1, offset: 0.92 }, { transform: at(dx, dy, 1.05), opacity: 0, offset: 1 },
  ];
  hd.animate(frames, { duration: 2600, iterations: 3 });
  carry.animate(frames.map(f => ({ ...f, transform: f.transform.replace(/scale\([^)]*\)/, pour && f.offset >= 0.6 && f.offset < 0.92 ? 'rotate(-24deg)' : 'scale(1)'), opacity: f.opacity * 0.55 })),
    { duration: 2600, iterations: 3 });
}
function handTap(t) {
  if (!t) return;
  const b = box(t), x = b.x + b.w / 2, y = b.y + b.h * 0.55;
  const ring = el('div', 'ring');
  Object.assign(ring.style, { left: x + 'cqw', top: y + 'cqw' });
  hintEls.push(ring);
  const hd = makeHand();
  Object.assign(hd.style, { left: x - TIPX + 'cqw', top: y - TIPY + 'cqw' });
  hd.animate([{ opacity: 0, transform: 'translateY(3cqw)' }, { opacity: 1, transform: 'none', offset: 0.3 }, { opacity: 1, transform: 'translateY(.8cqw) scale(.9)', offset: 0.5 },
    { opacity: 1, transform: 'none', offset: 0.7 }, { opacity: 0, transform: 'none' }], { duration: 1400, iterations: 4 });
}

// ---------- morning, night and the sleeping sun ----------
let zzzEls = [], sunHintTimer = 0, afterSleep = false;
function sleepyScreen() {
  const sun = $('sun');
  sun.classList.add('asleep'); sun.classList.remove('up');
  $('night').classList.add('on', 'dawn');
  $('title').classList.remove('gone');
  zzzEls.forEach(z => z.remove());
  zzzEls = [0, 0.8, 1.6].map(d => { const z = el('div', 'zzz'); z.textContent = 'z'; Object.assign(z.style, { left: '60%', top: '16%', animationDelay: d + 's' }); return z; });
  clearTimeout(sunHintTimer);
  sunHintTimer = setTimeout(() => { if (!playing && sun.classList.contains('asleep')) { clearHint(); handTap(sun); } }, 1800);
  nightSounds();
}
// While the garden sleeps: crickets, and every few seconds the voice asks for the sun to be woken.
// Browsers that forbid sound before a touch stay quiet until the first touch anywhere (see setupUI).
let nightTimer = 0, nightBeat = 0;
function nightSounds() {
  clearInterval(nightTimer);
  nightBeat = 0;
  nightTimer = setInterval(() => {
    const sun = $('sun');
    if (playing || !sun.classList.contains('asleep') || !$('sleep-panel').hidden) return;
    if (AC.state !== 'running') { AC.resume().catch(() => {}); return; }
    if (nightBeat % 2 === 0) sfx.cricket();
    if (nightBeat % 12 === 2) say(L('wake'));
    nightBeat++;
  }, 800);
}
async function wakeUp() {
  const sun = $('sun');
  if (!sun.classList.contains('asleep')) return;
  if (AC.state !== 'running') AC.resume();
  clearTimeout(sunHintTimer); clearHint();
  zzzEls.forEach(z => z.remove()); zzzEls = [];
  sun.classList.remove('asleep');
  sfx.yawn();
  $('title').classList.add('gone');
  await sleep(500);
  sun.classList.add('up');
  $('night').classList.remove('on', 'dawn');
  sfx.birds();
  const ep = ++epoch;
  playing = true;
  setMusic(S.music);
  stage.className = 'lv' + level();
  $('day-chip').textContent = `Day ${S.day}`;
  $('mystery').hidden = !S.mystery;
  renderAll();
  farmerCheer();
  await say(L('morning'));
  if (!live(ep)) return;
  if (afterSleep) {
    afterSleep = false;
    S.beds.forEach((b, i) => { if (b && b.stage < 5) setTimeout(() => { if (live(ep)) growBed(i); }, i * 180); });
    await say(L('grew'));
    if (!live(ep)) return;
  }
  if (S.basket >= goal()) return nightfall();
  armHint();
  scheduleWish(S.tut ? 4000 : 800);
  scheduleVisitor(ep, S.tut ? 12000 : undefined);
}
async function nightfall() {
  const ep = ++epoch;
  playing = false;
  clearHint(); stopDrag(); clearSelection(); removeVisitor(); removeWish(); clearTimeout(wishTimer);
  $('night').classList.add('on');
  $('sun').classList.remove('up'); $('sun').style.opacity = '0';
  for (let k = 0; k < 9; k++) {
    const f = el('div', 'firefly');
    Object.assign(f.style, { left: 10 + Math.random() * 80 + '%', top: 30 + Math.random() * 45 + '%', animationDelay: `${-Math.random() * 6}s, ${-Math.random() * 1.6}s` });
  }
  farmerCheer(); sfx.lullaby();
  await say(L('night'));
  if (ep !== epoch) return;
  const t = $('today');
  t.textContent = '';
  Object.entries(S.today).forEach(([id, n]) => {
    const p = plantById(id), b = el('button', '', t);
    sprite(`${id}_5`, '', b);
    el('b', '', b).textContent = n === 1 ? p.one : p.many;
    el('i', '', b).textContent = n;
    b.addEventListener('pointerdown', e => { e.preventDefault(); if (AC.state !== 'running') AC.resume(); say(fill(L(n === 1 ? 'word' : 'words'), p)); });
  });
  $('sleep-panel').hidden = false;
}
function goToSleep() {
  $('sleep-panel').hidden = true;
  document.querySelectorAll('.firefly').forEach(f => f.remove());
  S.day++; S.basket = 0; S.today = {}; S.mystery = true; save();
  afterSleep = true;
  $('sun').style.opacity = '';
  sleepyScreen();
}
function goHome() {
  if (!$('sleep-panel').hidden) return;     // at night the only way on is to sleep
  epoch++;
  playing = false;
  stopVoice(); clearHint(); stopDrag(); clearSelection(); removeVisitor(); clearTimeout(wishTimer);
  sleepyScreen();
}
function setupUI() {
  $('sun').addEventListener('click', wakeUp);
  // the first touch anywhere unlocks sound; on the sleeping screen it also says what to do
  stage.addEventListener('pointerdown', e => {
    const locked = AC.state !== 'running';
    if (locked) AC.resume().catch(() => {});
    if (locked && !playing && $('sun').classList.contains('asleep') && !$('sun').contains(e.target)) setTimeout(() => say(L('wake')), 150);
  }, true);
  $('cloud').addEventListener('pointerdown', e => { e.preventDefault(); onCloud(); });
  $('sleep').addEventListener('click', goToSleep);
  $('home').addEventListener('click', goHome);
  $('music').addEventListener('click', () => setMusic(!S.music));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopVoice(); stopDrag(); } });
}

// ---------- boot ----------
async function boot() {
  const [data, sizes, manifest] = await Promise.all([
    fetch('garden.json').then(r => r.json()),
    fetch('art/sizes.json').then(r => r.json()),
    fetch('voice/manifest.json').then(r => r.json()).catch(() => ({})),
  ]);
  DATA = data; SIZES = sizes; MANIFEST = manifest;
  for (const p of DATA.plants) for (let s = 1; s <= 5; s++) if (!SIZES[`${p.id}_${s}`]) throw new Error(`art/${p.id}_${s}.webp is missing: run python3 tools/cut_art.py`);
  if (!visitors().length) throw new Error('garden.json needs at least one animal with "visitor": true');
  S = load();
  buildScene(); buildSeedbox(); setupCan(); setupUI(); renderAll();
  $('music').classList.toggle('muted', !S.music);
  $('day-chip').textContent = `Day ${S.day}`;
  sleepyScreen();
  preloadVoice();
}

// Test hooks: do what the helping hand would show, the way a child would.
window.garden = {
  get state() { return S; },
  get visitor() { return V && { animal: V.animal.id, plant: V.plant.id, bed: V.bed, arrived: V.arrived, gone: V.gone }; },
  get wish() { return W && { plant: W.plant.id, n: W.n, got: W.got }; },
  get playing() { return playing; },
  get sound() { return { context: AC.state, said: said.slice() }; },
  next: () => nextStep(),
  step() {
    const st = nextStep();
    if (!st) return null;
    if (st.kind === 'shoo') shoo(V);
    else if (st.kind === 'plant') plantBed(st.bed, st.plant, false);
    else if (st.kind === 'mystery') plantBed(st.bed, null, true);
    else if (st.kind === 'water') growBed(st.bed);
    else if (st.kind === 'rain') onCloud();
    else onBedTap(st.bed);
    return st.kind;
  },
  visit: () => spawnVisitor(),
};

boot().catch(err => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<p style="position:fixed;inset:auto 0 0;margin:0;padding:12px;background:#c9492f;color:#fff;font:600 16px system-ui">Little Garden could not start: ${String(err.message || err)}</p>`);
});
})();
