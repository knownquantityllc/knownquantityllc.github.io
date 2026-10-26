// Chemical Chords music: light to sound, the "natural" hum, the tuned arrangement, and the audio engine.
//
// Light to sound: a spectral line's frequency is c / wavelength (about 400 to 790 trillion hertz for visible light).
// Halving a frequency drops it one octave and keeps the note's name, so we halve it 40 times (divide by 2^40). That
// lands visible light between about 350 and 720 Hz, the octave around the A above middle C. Every line is moved by
// exactly the same amount, so the intervals between an element's lines stay exactly as they are in its light.
(function (root) {
'use strict';
const D = root.CC_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
const TC = root.TUNECODE || (typeof require !== 'undefined' ? require('./tunecode.js') : null);

const C_LIGHT = 299792458;
const OCTAVES = 40, SHIFT = Math.pow(2, OCTAVES);
const N_AIR = 1.000277;                      // NIST lists lines above 200 nm as measured in air; light is slightly slower there
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

const lightHz = nm => C_LIGHT / ((nm > 200 ? nm * N_AIR : nm) * 1e-9);
const soundHz = nm => lightHz(nm) / SHIFT;
const midiOf = hz => 69 + 12 * Math.log2(hz / 440);
const hzOf = m => 440 * Math.pow(2, (m - 69) / 12);
const noteLabel = m => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const mod12 = x => ((x % 12) + 12) % 12;

// one partial per spectral line: what it is, where it comes from, and how it sounds
function partial(nm, w, src, band){
  const hz = soundHz(nm), m = midiOf(hz), near = Math.round(m);
  return { nm, w, src, band: !!band, thz: lightHz(nm) / 1e12, hz, midi: m, near, cents: Math.round((m - near) * 100) };
}

// the hum of a substance: the brightest lines of each of its atoms. Hydrogen, carbon, nitrogen and oxygen are in almost
// everything, so when a compound has a more distinctive atom (a metal, a halogen) those common ones are turned down.
const COMMON = ['H', 'C', 'N', 'O'];
function humOfElements(els, max){
  const uniq = [...new Set(els)];
  const special = uniq.some(e => !COMMON.includes(e));
  let out = [];
  for (const e of uniq) {
    const el = D.ELEMENTS[e]; if (!el) continue;
    const scale = special && COMMON.includes(e) ? 0.45 : 1;
    const per = special && COMMON.includes(e) ? 2 : 3;
    el.lines.slice().sort((a, b) => b[1] - a[1]).slice(0, per).forEach(l => out.push(partial(l[0], l[1] * scale, e)));
  }
  out.sort((a, b) => b.w - a.w);
  return finish(out.slice(0, max || 8));
}
// a coloured substance also gets a voice for the colour it absorbs (shown dashed in the spectrum)
function withColour(ps, subs){
  const seen = new Set();
  for (const s of subs) if (s && s.absorbs && !seen.has(s.absorbs)) { seen.add(s.absorbs); ps.push(partial(s.absorbs, 0.6, 'absorbed by ' + s.name.toLowerCase(), false)); ps[ps.length - 1].absorbed = true; }
  return finish(ps);
}
function humOfSubstance(s){ return withColour(humOfElements(s.els, s.absorbs ? 7 : 8), [s]); }
function humOfEmit(emit, srcName){ return finish(emit.map(l => partial(l[0], l[1], l[2] || srcName, !!l[2]))); }
function humOfReaction(r){
  if (r.emit) return humOfEmit(r.emit, r.flameOf || r.name);
  const els = [], subs = (r.makes || []).map(id => D.BY_ID[id]).filter(Boolean);
  for (const s of subs) els.push(...s.els);
  const coloured = subs.filter(s => s.absorbs).length;
  return withColour(humOfElements(els, 8 - coloured), subs);
}
// lowest pitch (reddest light) first, and loudness shared so a hum of eight lines is not louder than a hum of two
function finish(ps){
  ps.sort((a, b) => a.hz - b.hz);
  const sum = ps.reduce((t, p) => t + p.w, 0) || 1;
  ps.forEach(p => { p.gain = p.w / sum; });
  return ps;
}
// pairs of lines close enough to beat (heard as a slow throb rather than two notes)
function beats(ps){
  const out = [];
  for (let i = 0; i < ps.length; i++) for (let k = i + 1; k < ps.length; k++) {
    const d = Math.abs(ps[i].hz - ps[k].hz);
    if (d > 0.01 && d < 8) out.push({ a: ps[i], b: ps[k], hz: d });
  }
  return out;
}

// ---------------------------------------------------------------- the tuned version
// 1. snap every line to the nearest piano key; 2. pick the key and mode that hold the most of those notes (weighted by
// brightness); 3. nudge the notes that do not fit to the nearest note that does; 4. pick four chords from that key that
// contain the notes; 5. play the notes as a melody, reddest to most violet and back.
const MODES = [   // [Jam Jar scale id, name, steps, major-sounding]
  ['major', 'major', [0, 2, 4, 5, 7, 9, 11], 1], ['minor', 'minor', [0, 2, 3, 5, 7, 8, 10], 0],
  ['dorian', 'Dorian', [0, 2, 3, 5, 7, 9, 10], 0], ['mixo', 'Mixolydian', [0, 2, 4, 5, 7, 9, 10], 1],
  ['lydian', 'Lydian', [0, 2, 4, 6, 7, 9, 11], 1], ['phrygian', 'Phrygian', [0, 1, 3, 5, 7, 8, 10], 0],
  ['harmmin', 'harmonic minor', [0, 2, 3, 5, 7, 8, 11], 0]
];
const FAMILIAR = { major: 0.06, minor: 0.05 };
const PROGS = [[0, 5, 3, 4], [0, 3, 4, 3], [0, 4, 5, 3], [0, 3, 0, 4], [0, 5, 1, 4], [0, 2, 3, 4], [0, 6, 5, 4], [0, 3, 6, 4],
  [0, 3, 5, 0], [0, 6, 3, 0], [0, 1, 0, 6], [0, 5, 3, 6], [0, 2, 5, 0]];
const QUAL_OF = { '0,4,7': 'M', '0,3,7': 'm', '0,3,6': 'd', '0,4,8': 'a' };

function chooseKey(ps){
  const w = Array(12).fill(0);
  ps.forEach(p => { w[mod12(p.near)] += p.w; });
  const total = w.reduce((a, b) => a + b, 0) || 1;
  const strongest = ps.slice().sort((a, b) => b.w - a.w)[0];
  let best = null;
  for (let key = 0; key < 12; key++) for (const md of MODES) {
    const set = md[2].map(s => mod12(key + s));
    let s = 0;
    for (let pc = 0; pc < 12; pc++) s += set.includes(pc) ? w[pc] : -0.6 * w[pc];
    s /= total;
    if (strongest && mod12(strongest.near) === key) s += 0.12;          // the brightest line feels like home
    if (strongest && mod12(strongest.near) === mod12(key + 7)) s += 0.05;
    s += FAMILIAR[md[0]] || 0;
    if (!best || s > best.score + 1e-9) best = { key, mode: md, score: s };
  }
  return best;
}
// nearest note in the key (ties go down, towards the redder side)
function fit(m, key, steps){
  for (let d = 0; d <= 6; d++) for (const x of [m - d, m + d]) if (steps.includes(mod12(x - key))) return x;
  return m;
}
function triad(key, steps, deg){
  const a = steps[deg], b = steps[(deg + 2) % 7] + ((deg + 2) >= 7 ? 12 : 0), c = steps[(deg + 4) % 7] + ((deg + 4) >= 7 ? 12 : 0);
  const shape = [0, b - a, c - a].join(',');
  return { root: a, qual: QUAL_OF[shape] || (b - a === 3 ? 'm' : 'M'), pcs: [a, b, c].map(x => mod12(key + x)) };
}

// a tune in Jam Jar / Chordfall's format (see tunecode.js), plus everything needed to explain and play it
function arrange(ps, opt){
  opt = opt || {};
  const pick = chooseKey(ps), key = pick.key, md = pick.mode, steps = md[2];
  const base = key + 48;                                                 // pad 0 = the key's root in octave 3
  const notes = [], moved = [];
  for (const p of ps) {
    const m = fit(p.near, key, steps);
    if (m !== p.near) moved.push({ p, to: m });
    p.tuned = m;
    if (!notes.some(n => n.m === m)) notes.push({ m, w: p.w });
  }
  // with fewer than three different notes the melody borrows the rest of the home chord
  const borrowed = [];
  if (new Set(notes.map(n => mod12(n.m))).size < 3) {
    const low = notes[0].m;
    for (const pc of triad(key, steps, 0).pcs) if (!notes.some(n => mod12(n.m) === pc)) { const m = low + mod12(pc - low); notes.push({ m, w: 0.15, borrowed: true }); borrowed.push(m); }
  }
  notes.sort((a, b) => a.m - b.m);
  const pad = m => { const rel = m - base, oct = Math.floor(rel / 12), i = steps.indexOf(mod12(rel)); return oct * 7 + i; };
  // chords: try each progression, keep the one whose chords hold the most melody notes
  const seq = melodyOrder(notes, opt.seed || 0);
  let bestProg = PROGS[0], bestScore = -1;
  for (const pr of PROGS) {
    let s = 0;
    pr.forEach((deg, bar) => { const t = triad(key, steps, deg); if (t.qual === 'd' || t.qual === 'a') s -= 3; seq.bars[bar].forEach(m => { if (typeof m === 'number' && t.pcs.includes(mod12(m))) s++; }); });
    if (s > bestScore) { bestScore = s; bestProg = pr; }
  }
  const chords = bestProg.map(deg => { const t = triad(key, steps, deg); return [mod12(t.root), t.qual]; });
  const mel = [];
  seq.bars.forEach(bar => bar.forEach(x => mel.push(x == null ? null : x === 'h' ? 'h' : Math.max(0, Math.min(47, pad(x))))));
  const tune = TC.tidy({ key, scale: md[0], tempo: opt.tempo || 'medium', bars: 4, base, inst: opt.inst || null, chords, mel, name: opt.name || 'REACTION' });
  return { tune, key, mode: md, notes, moved, borrowed, base, chordNames: chords.map(c => TC.chordName(tune, c)), keyName: TC.noteName(key, key, md[3]) + ' ' + md[1] };
}

// four bars of eighth notes. Bar 1 climbs the notes, bar 2 falls back, bar 3 dances on the brightest, bar 4 comes home
// and holds. A fixed set of rhythms, picked by the reaction, keeps every arrangement different but always on the beat.
const RHYTHMS = [
  ['x', 'h', 'x', 'x', 'h', 'x', 'x', 'h'], ['x', 'x', 'x', 'h', 'x', 'x', 'x', 'h'], ['x', 'h', 'h', 'x', 'x', 'h', 'x', 'x'],
  ['x', 'x', 'h', 'x', 'x', 'h', 'x', 'h'], ['x', 'h', 'x', 'h', 'x', 'x', 'x', 'h']
];
function melodyOrder(notes, seed){
  const up = notes.map(n => n.m), down = up.slice().reverse();
  const bright = notes.slice().sort((a, b) => b.w - a.w).map(n => n.m);
  const r = RHYTHMS[seed % RHYTHMS.length], r2 = RHYTHMS[(seed + 2) % RHYTHMS.length];
  const fill = (rh, src) => { let i = 0; return rh.map(s => s === 'x' ? src[(i++) % src.length] : 'h'); };
  const b3src = [bright[0], bright[1 % bright.length], bright[0], bright[2 % bright.length]];
  const last = [up[0], up[Math.min(1, up.length - 1)], bright[0], 'h', 'h', 'h', 'h', null];
  return { bars: [fill(r, up), fill(r2, down), fill(r, b3src), last] };
}

const INST_FOR = { flame: 'bells', precip: 'marimba', gas: 'kalimba', swap: 'harp', complex: 'epiano', acidbase: 'flute',
  indicator: 'flute', catalysis: 'musicbox', burn: 'synth', light: 'choir' };
const GM = { bells: 14, marimba: 12, kalimba: 108, harp: 46, epiano: 4, flute: 73, musicbox: 10, synth: 81, choir: 52 };
const seedOf = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

function forReaction(r){
  const ps = humOfReaction(r);
  const arr = arrange(ps, { tempo: r.tempo || 'medium', inst: INST_FOR[r.type] || 'bells', name: r.code || r.name, seed: seedOf(r.id) });
  return { partials: ps, arr, code: TC.encode(arr.tune) };
}
function forSubstance(s){
  const ps = humOfSubstance(s);
  return { partials: ps, arr: arrange(ps, { tempo: 'medium', name: s.name, seed: seedOf(s.id) }) };
}

// ---------------------------------------------------------------- MIDI file of the tuned version (for any music app)
function midiFile(arr, bpm){
  const t = arr.tune, TPQ = 480, E = TPQ / 2, semis = TC.semitones(t), lens = TC.lengths(t);
  const vlq = n => { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; };
  const track = (events) => {
    events.sort((a, b) => a.t - b.t || a.o - b.o);
    let last = 0; const bytes = [];
    for (const e of events) { bytes.push(...vlq(e.t - last), ...e.d); last = e.t; }
    bytes.push(0, 0xff, 0x2f, 0);
    return [0x4d, 0x54, 0x72, 0x6b, ...u32(bytes.length), ...bytes];
  };
  const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const name = s => { const b = [...new TextEncoder().encode(s)]; return [0xff, 0x03, ...vlq(b.length), ...b]; };
  const us = Math.round(60e6 / bpm);
  const meta = track([{ t: 0, o: 0, d: [0xff, 0x51, 0x03, (us >> 16) & 255, (us >> 8) & 255, us & 255] }, { t: 0, o: 1, d: [0xff, 0x58, 4, 4, 2, 24, 8] }, { t: 0, o: 2, d: name(TC.titleName(t.name)) }]);
  const mel = [{ t: 0, o: 0, d: name('Melody') }, { t: 0, o: 1, d: [0xc0, GM[t.inst] || 0] }];
  semis.forEach((s, i) => { if (s == null) return; const n = t.base + s; mel.push({ t: i * E, o: 3, d: [0x90, n, 96] }, { t: (i + lens[i]) * E, o: 2, d: [0x80, n, 0] }); });
  const ch = [{ t: 0, o: 0, d: name('Chords') }, { t: 0, o: 1, d: [0xc1, 89] }], bass = [{ t: 0, o: 0, d: name('Bass') }, { t: 0, o: 1, d: [0xc2, 33] }];
  t.chords.forEach((c, bar) => {
    const q = TC.QUALS.find(x => x[0] === c[1]), root = t.key + c[0];
    q[1].forEach(iv => { const n = 48 + mod12(root) + iv + (mod12(root) > 6 ? -12 : 0) + 12; ch.push({ t: bar * 8 * E, o: 3, d: [0x91, n, 64] }, { t: (bar + 1) * 8 * E, o: 2, d: [0x81, n, 0] }); });
    const b = 36 + mod12(root); bass.push({ t: bar * 8 * E, o: 3, d: [0x92, b, 90] }, { t: (bar + 1) * 8 * E - 10, o: 2, d: [0x82, b, 0] });
  });
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 4, (TPQ >> 8) & 255, TPQ & 255];
  return new Uint8Array([...head, ...meta, ...track(mel), ...track(ch), ...track(bass)]);
}

// ---------------------------------------------------------------- audio
const Audio = (() => {
  let ac = null, out = null, verb = null, dry = null, analyser = null, muted = false;
  let drone = null, loop = null;
  const listeners = [];
  function ctx(){
    if (ac) return ac;
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    ac = new AC();
    out = ac.createGain(); out.gain.value = muted ? 0 : 0.9;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    analyser = ac.createAnalyser(); analyser.fftSize = 2048;
    out.connect(comp); comp.connect(analyser); analyser.connect(ac.destination);
    dry = ac.createGain(); dry.connect(out);
    verb = ac.createConvolver(); verb.buffer = impulse(2.8); const wet = ac.createGain(); wet.gain.value = 0.32; verb.connect(wet); wet.connect(out);
    return ac;
  }
  function impulse(sec){
    const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    return b;
  }
  function resume(){ const a = ctx(); if (a && a.state !== 'running') a.resume().catch(() => {}); return a; }
  const emit = (what, x) => listeners.forEach(fn => { try { fn(what, x); } catch (e) {} });

  // natural: one pure sine per spectral line at its exact frequency. Each line breathes a little on its own slow cycle.
  function natural(ps, sec){
    const a = resume(); if (!a) return;
    stopAll(0.25);
    const t = a.currentTime + 0.03, dur = sec || 7, bus = a.createGain();
    bus.gain.setValueAtTime(0, t); bus.gain.linearRampToValueAtTime(0.55, t + 0.9);
    bus.gain.setValueAtTime(0.55, t + dur - 1.6); bus.gain.linearRampToValueAtTime(0, t + dur);
    bus.connect(dry); bus.connect(verb);
    const nodes = [];
    ps.forEach((p, i) => {
      const o = a.createOscillator(), g = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
      o.type = 'sine'; o.frequency.value = p.hz;
      g.gain.value = 0.18 + 0.82 * p.gain;
      lfo.frequency.value = 0.13 + 0.07 * i; lg.gain.value = 0.12 * g.gain.value;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(bus); o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
      nodes.push(o, lfo);
    });
    drone = { bus, nodes, end: t + dur };
    emit('natural', { ps, t, dur });
    setTimeout(() => { if (drone && drone.end <= a.currentTime + 0.05) { drone = null; emit('stop'); } }, dur * 1000 + 80);
  }

  // tuned: the arrangement, with a bell melody, a soft pad, a bass and a light shaker, looped twice
  function tuned(arr, loops){
    const a = resume(); if (!a) return;
    stopAll(0.2);
    const t = arr.tune, bpm = TC.tempoOf(t.tempo)[2], E = 60 / bpm / 2, semis = TC.semitones(t), lens = TC.lengths(t);
    const t0 = a.currentTime + 0.08, reps = loops || 2, barLen = 8 * E;
    const bus = a.createGain(); bus.gain.value = 0.8; bus.connect(dry); bus.connect(verb);
    const nodes = [], notes = [];
    for (let r = 0; r < reps; r++) {
      const off = t0 + r * 32 * E;
      semis.forEach((s, i) => { if (s == null) return; const m = t.base + s; bell(a, bus, hzOf(m), off + i * E, lens[i] * E, nodes); notes.push({ m, at: off + i * E, len: lens[i] * E }); });
      t.chords.forEach((c, bar) => {
        const q = TC.QUALS.find(x => x[0] === c[1]), root = mod12(t.key + c[0]), st = off + bar * barLen;
        q[1].forEach(iv => pad(a, bus, hzOf(57 + mod12(root - 9) + iv), st, barLen, nodes));
        bassNote(a, bus, hzOf(36 + root), st, barLen * 0.95, nodes);
      });
      if (t.tempo !== 'slow') for (let i = 0; i < 32; i++) shaker(a, bus, off + i * E, i % 2 ? 0.04 : 0.07, nodes);
    }
    const end = t0 + reps * 32 * E + 1.2;
    loop = { bus, nodes, end };
    emit('tuned', { arr, t0, E, notes, end });
    setTimeout(() => { if (loop && loop.end <= a.currentTime + 0.05) { loop = null; emit('stop'); } }, (end - a.currentTime) * 1000 + 80);
  }
  function bell(a, bus, f, at, len, nodes){
    const o = a.createOscillator(), m = a.createOscillator(), mg = a.createGain(), g = a.createGain();
    o.frequency.value = f; m.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 1.4, at); mg.gain.exponentialRampToValueAtTime(f * 0.05, at + 0.6);
    m.connect(mg); mg.connect(o.frequency);
    const d = Math.max(0.6, len + 0.5);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.16, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, at + d);
    o.connect(g); g.connect(bus); o.start(at); m.start(at); o.stop(at + d + 0.05); m.stop(at + d + 0.05); nodes.push(o, m);
  }
  function pad(a, bus, f, at, len, nodes){
    const g = a.createGain(), lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.4;
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.03, at + 0.35); g.gain.setValueAtTime(0.03, at + len - 0.2); g.gain.linearRampToValueAtTime(0.0001, at + len + 0.25);
    [-6, 6].forEach(dt => { const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; o.connect(lp); o.start(at); o.stop(at + len + 0.3); nodes.push(o); });
    lp.connect(g); g.connect(bus);
  }
  function bassNote(a, bus, f, at, len, nodes){
    const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.22, at + 0.02); g.gain.exponentialRampToValueAtTime(0.06, at + len * 0.6); g.gain.linearRampToValueAtTime(0.0001, at + len);
    o.connect(g); g.connect(dry); o.start(at); o.stop(at + len + 0.05); nodes.push(o);
  }
  let noiseBuf = null;
  function shaker(a, bus, at, vol, nodes){
    if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate * 0.1, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = a.createBufferSource(), hp = a.createBiquadFilter(), g = a.createGain(); s.buffer = noiseBuf; hp.type = 'highpass'; hp.frequency.value = 6000;
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    s.connect(hp); hp.connect(g); g.connect(dry); s.start(at); s.stop(at + 0.08); nodes.push(s);
  }
  // little sounds for the bench
  function sfx(kind){
    const a = resume(); if (!a) return; const t = a.currentTime + 0.01;
    if (kind === 'pour') { const s = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain(); const b = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i / 300)); s.buffer = b; bp.type = 'bandpass'; bp.frequency.setValueAtTime(900, t); bp.frequency.linearRampToValueAtTime(500, t + 0.45); bp.Q.value = 2; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.05); g.gain.linearRampToValueAtTime(0.0001, t + 0.5); s.connect(bp); bp.connect(g); g.connect(dry); s.start(t); }
    else if (kind === 'clink') { [2600, 3900].forEach((f, i) => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.06 / (i + 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g); g.connect(dry); o.start(t); o.stop(t + 0.4); }); }
    else if (kind === 'boom') { const o = a.createOscillator(), g = a.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.6); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8); o.connect(g); g.connect(dry); o.start(t); o.stop(t + 0.85); noise(a, t, 0.7, 0.35, 1800); }
    else if (kind === 'fizz') noise(a, t, 1.6, 0.05, 5000);
    else if (kind === 'whoosh') noise(a, t, 1.0, 0.12, 900);
  }
  function noise(a, t, len, vol, f){
    const s = a.createBufferSource(), b = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.3 ? 1 : 0.4);
    const fl = a.createBiquadFilter(), g = a.createGain(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 0.7; s.buffer = b;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len); s.connect(fl); fl.connect(g); g.connect(dry); s.start(t);
  }
  function stopAll(fade){
    const a = ac; if (!a) return; const t = a.currentTime, f = fade || 0.15;
    [drone, loop].forEach(x => { if (!x) return; try { x.bus.gain.cancelScheduledValues(t); x.bus.gain.setValueAtTime(x.bus.gain.value, t); x.bus.gain.linearRampToValueAtTime(0, t + f); } catch (e) {} x.nodes.forEach(n => { try { n.stop(t + f + 0.02); } catch (e) {} }); });
    const had = drone || loop; drone = null; loop = null; if (had) emit('stop');
  }
  return {
    resume, natural, tuned, sfx, stop: () => stopAll(0.25), get playing(){ return drone ? 'natural' : loop ? 'tuned' : null; },
    get analyser(){ return analyser; }, get ctx(){ return ac; },
    on(fn){ listeners.push(fn); },
    setMuted(m){ muted = !!m; if (out) out.gain.value = muted ? 0 : 0.9; }, get muted(){ return muted; }
  };
})();

// ---------------------------------------------------------------- WAV file of the natural hum (exact frequencies)
function wavOfNatural(ps, sec){
  const rate = 44100, n = Math.floor(rate * (sec || 8)), data = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate, env = Math.min(1, t / 0.9, (n / rate - t) / 1.6);
    let v = 0; ps.forEach((p, k) => { v += (0.18 + 0.82 * p.gain) * (1 + 0.12 * Math.sin(2 * Math.PI * (0.13 + 0.07 * k) * t)) * Math.sin(2 * Math.PI * p.hz * t); });
    data[i] = Math.max(-32767, Math.min(32767, Math.round(v * env * 0.3 * 32767)));
  }
  const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf), str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 2, true);
  new Int16Array(buf, 44).set(data);
  return new Uint8Array(buf);
}

const API = { OCTAVES, SHIFT, lightHz, soundHz, midiOf, hzOf, noteLabel, partial, humOfElements, humOfSubstance, humOfEmit, humOfReaction, beats,
  chooseKey, arrange, forReaction, forSubstance, midiFile, wavOfNatural, Audio, MODES, INST_FOR };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.CC_MUSIC = API;
})(typeof window !== 'undefined' ? window : globalThis);
