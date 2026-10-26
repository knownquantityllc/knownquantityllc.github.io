// Tune codes: a song made in Jam Jar travels to Chordfall (and back) as a short, typeable code, like
//   CF1-1A6K2-...-MOONSONG-4F2KQ
// The groups after CF1 carry the key, scale, tempo, length, the four chords and the melody (one step per eighth note);
// the word is the tune's name (A to Z); the last group is a checksum, so a mistyped code is refused instead of played
// wrong. This file is copied, unchanged, into both apps: jam-jar/src/tunecode.js and games/src/tunecode.js.
(function (root) {
'use strict';
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';          // Crockford base32: no I, L, O or U to misread
const VERSION = 1, PREFIX = 'CF' + VERSION, MAX_NAME = 12;
// Jam Jar's 17 scales, in the same order as its theory.js: id, name, steps above the root, major-sounding
const SCALES = [
  ['majpent', 'Major pentatonic', [0, 2, 4, 7, 9], 1], ['minpent', 'Minor pentatonic', [0, 3, 5, 7, 10], 0],
  ['blues', 'Blues', [0, 3, 5, 6, 7, 10], 0], ['majblues', 'Major blues', [0, 2, 3, 4, 7, 9], 1],
  ['major', 'Major', [0, 2, 4, 5, 7, 9, 11], 1], ['minor', 'Natural minor', [0, 2, 3, 5, 7, 8, 10], 0],
  ['harmmin', 'Harmonic minor', [0, 2, 3, 5, 7, 8, 11], 0], ['dorian', 'Dorian', [0, 2, 3, 5, 7, 9, 10], 0],
  ['mixo', 'Mixolydian', [0, 2, 4, 5, 7, 9, 10], 1], ['lydian', 'Lydian', [0, 2, 4, 6, 7, 9, 11], 1],
  ['phrygian', 'Phrygian', [0, 1, 3, 5, 7, 8, 10], 0], ['wholetone', 'Whole tone', [0, 2, 4, 6, 8, 10], 1],
  ['hirajoshi', 'Hirajoshi', [0, 2, 3, 7, 8], 0], ['egypt', 'Egyptian', [0, 2, 5, 7, 10], 0],
  ['hungarian', 'Hungarian minor', [0, 2, 3, 6, 7, 8, 11], 0], ['doubleharm', 'Double harmonic', [0, 1, 4, 5, 7, 8, 11], 1],
  ['chrom', 'Chromatic', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 0]
];
// the chords a tune can use: id, notes above the chord's root, how its name ends
const QUALS = [['M', [0, 4, 7], ''], ['m', [0, 3, 7], 'm'], ['d', [0, 3, 6], 'dim'], ['a', [0, 4, 8], '+'], ['s2', [0, 2, 7], 'sus2'],
  ['s4', [0, 5, 7], 'sus4'], ['7', [0, 4, 7, 10], '7'], ['m7', [0, 3, 7, 10], 'm7'], ['M7', [0, 4, 7, 11], 'maj7'], ['x', [0, 2, 6], 'sus2♭5']];
// Jam Jar's 25 instruments, in its order (synth.js), so a tune can open on the instrument it was played on
const INSTS = ['harmonica', 'flute', 'panpipes', 'ocarina', 'clarinet', 'sax', 'trumpet', 'trombone', 'horn', 'violin', 'cello', 'guitar', 'harp',
  'bass', 'strings', 'piano', 'epiano', 'organ', 'synth', 'marimba', 'kalimba', 'steeldrum', 'bells', 'musicbox', 'choir'];
const TEMPOS = [['slow', 'Slow', 80], ['medium', 'Medium', 96], ['fast', 'Fast', 112]];
const MSG = {
  empty: 'Paste a tune code first. Tune codes start with CF1-.',
  format: 'That isn’t a tune code. Tune codes start with CF1-.',
  version: 'That tune comes from a newer version. Update the app to play it.',
  name: 'The word near the end of the code is the tune’s name, letters only. Check it and try again.',
  typo: 'That code has a typo. Check it against the original and try again.'
};

const mod12 = x => ((x % 12) + 12) % 12;
const isOn = s => typeof s === 'number';
const scaleIndex = id => SCALES.findIndex(s => s[0] === id);
const scaleOf = id => SCALES[Math.max(0, scaleIndex(id))];
const cleanName = s => String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, MAX_NAME) || 'MYTUNE';
const titleName = s => { const n = cleanName(s); return n[0] + n.slice(1).toLowerCase(); };
const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'], FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const FLAT_MAJOR = [5, 10, 3, 8, 1], FLAT_MINOR = [2, 7, 0, 5, 10, 3];  // the same spelling rule as Jam Jar's pads
const noteName = (pc, key, major) => ((major ? FLAT_MAJOR : FLAT_MINOR).includes(mod12(key)) ? FLAT : SHARP)[mod12(pc)];
const keyName = t => { const sc = scaleOf(t.scale); return `${noteName(t.key, t.key, sc[3])} ${sc[1].toLowerCase()}`; };
const chordName = (t, c) => { const sc = scaleOf(t.scale), q = QUALS.find(x => x[0] === c[1]) || QUALS[0]; return noteName(t.key + c[0], t.key, sc[3]) + q[2]; };
const tempoOf = id => TEMPOS.find(x => x[0] === id) || TEMPOS[1];

// ---------------------------------------------------------------- bits and base32
function Writer(){ const a = []; return { a, put(v, n){ for (let i = n - 1; i >= 0; i--) a.push(Math.floor(v / 2 ** i) % 2); } }; }
function toB32(bits){ let s = ''; for (let i = 0; i < bits.length; i += 5) { let v = 0; for (let k = 0; k < 5; k++) v = v * 2 + (bits[i + k] || 0); s += ALPHA[v]; } return s; }
function fromB32(s){ const out = []; for (const ch of s) { const v = ALPHA.indexOf(ch); if (v < 0) return null; for (let k = 4; k >= 0; k--) out.push((v >> k) & 1); } return out; }
const b32norm = s => s.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
// FNV-1a over the data and the name, folded to 20 bits: four characters that catch a slip of the finger
function checksum(data, name){
  let h = 0x811c9dc5; for (const ch of PREFIX + '|' + data + '|' + name) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  const v = (h ^ (h >>> 20)) & 0xfffff; let s = ''; for (let k = 3; k >= 0; k--) s += ALPHA[(v >> (k * 5)) & 31]; return s;
}

// ---------------------------------------------------------------- a tune, checked and tidied
// { key 0-11, scale id, tempo 'slow'|'medium'|'fast', bars 4|8, base (MIDI note of the lowest pad row's root),
//   inst (a Jam Jar instrument id or null), chords [[steps above the key, quality id] x4],
//   mel [one entry per eighth note: a pad index where a note starts, 'h' while it keeps sounding, null for silence], name }
function tidy(t){
  if (!t || typeof t !== 'object') throw new Error('no tune');
  const key = mod12(Math.round(t.key)), sc = scaleIndex(t.scale), bars = t.bars === 8 ? 8 : 4;
  if (sc < 0) throw new Error('unknown scale ' + t.scale);
  if (!TEMPOS.some(x => x[0] === t.tempo)) throw new Error('unknown tempo ' + t.tempo);
  const oct = (t.base - key) / 12 - 1;
  if (!Number.isInteger(oct) || oct < 0 || oct > 7) throw new Error('base out of range ' + t.base);
  if (!Array.isArray(t.chords) || t.chords.length !== 4 || t.chords.some(c => !Array.isArray(c) || !(c[0] >= 0 && c[0] <= 11) || !QUALS.some(q => q[0] === c[1])))
    throw new Error('four chords needed');
  const mel = Array.from({ length: bars * 8 }, (_, i) => (t.mel || [])[i]);
  let sounding = false;
  for (let i = 0; i < mel.length; i++) {
    const s = mel[i];
    if (isOn(s)) { if (!Number.isInteger(s) || s < 0 || s > 47) throw new Error('note out of range'); sounding = true; }
    else if (s === 'h' && sounding) sounding = true;
    else { mel[i] = null; sounding = false; }
  }
  return { key, scale: t.scale, tempo: t.tempo, bars, base: t.base, inst: INSTS.includes(t.inst) ? t.inst : null,
    chords: t.chords.map(c => [c[0], c[1]]), mel, name: cleanName(t.name) };
}

function encode(t0){
  const t = tidy(t0), w = Writer();
  w.put(VERSION, 3); w.put(t.key, 4); w.put(scaleIndex(t.scale), 5); w.put(TEMPOS.findIndex(x => x[0] === t.tempo), 2); w.put(t.bars === 8 ? 1 : 0, 1);
  w.put((t.base - t.key) / 12 - 1, 3); w.put(t.inst ? INSTS.indexOf(t.inst) : 31, 5);
  for (const [d, q] of t.chords) { w.put(d, 4); w.put(QUALS.findIndex(x => x[0] === q), 4); }
  const top = Math.max(0, ...t.mel.filter(isOn)), bits = Math.max(1, Math.ceil(Math.log2(top + 1))); w.put(bits - 1, 3);
  let sounding = false;
  for (const s of t.mel) {
    if (isOn(s)) { w.put(1, 1); w.put(s, bits); sounding = true; }
    else { w.put(0, 1); if (sounding) { w.put(s === 'h' ? 1 : 0, 1); sounding = s === 'h'; } }
  }
  const data = toB32(w.a), groups = data.match(/.{1,5}/g);
  return [PREFIX, ...groups, t.name, checksum(data, t.name)].join('-');
}

function fail(why){ return { ok: false, error: why, message: MSG[why] }; }
function decode(input){
  let s = String(input == null ? '' : input).trim();
  if (!s) return fail('empty');
  try { s = decodeURIComponent(s); } catch (e) {}
  const up = s.toUpperCase().replace(/[‐-―−_.,·:;\s\/]+/g, '-');        // spaces, dashes and slashes all split groups
  const at = up.search(/CF[0-9IL]/); if (at < 0) return fail('format');
  let segs = up.slice(at).split('-').filter(Boolean);
  if (segs[0].length > 3) segs = [segs[0].slice(0, 3), segs[0].slice(3), ...segs.slice(1)];   // CF1 glued to the first group
  const head = b32norm(segs[0]);
  if (head !== PREFIX) return /^CF[2-9]$/.test(head) ? fail('version') : fail('format');
  if (segs.length < 4) return fail('typo');
  const name = segs[segs.length - 2], chk = b32norm(segs[segs.length - 1]), data = b32norm(segs.slice(1, -2).join(''));
  if (!/^[A-Z]{1,12}$/.test(name)) return fail(/^[0-9A-Z]{4}$/.test(segs[segs.length - 2]) ? 'typo' : 'name');
  const bits = fromB32(data);
  if (!bits || chk.length !== 4 || checksum(data, name) !== chk) return fail('typo');
  try {
    let p = 0; const get = n => { if (p + n > bits.length) throw new Error('short'); let v = 0; for (let i = 0; i < n; i++) v = v * 2 + bits[p++]; return v; };
    if (get(3) !== VERSION) return fail('version');
    const key = get(4), sc = get(5), tp = get(2), bars = get(1) ? 8 : 4, oct = get(3), ii = get(5);
    if (key > 11 || sc >= SCALES.length || tp >= TEMPOS.length) return fail('typo');
    const chords = [];
    for (let i = 0; i < 4; i++) { const d = get(4), q = get(4); if (d > 11 || q >= QUALS.length) return fail('typo'); chords.push([d, QUALS[q][0]]); }
    const nb = get(3) + 1, mel = []; let sounding = false;
    for (let i = 0; i < bars * 8; i++) {
      if (get(1)) { mel.push(get(nb)); sounding = true; }
      else if (sounding) { const h = get(1); mel.push(h ? 'h' : null); sounding = !!h; }
      else mel.push(null);
    }
    if (bits.length - p >= 5 || bits.slice(p).some(b => b)) return fail('typo');       // nothing left over but padding
    const tune = tidy({ key, scale: SCALES[sc][0], tempo: TEMPOS[tp][0], bars, base: key + 12 * (oct + 1), inst: ii < INSTS.length ? INSTS[ii] : null, chords, mel, name });
    return { ok: true, tune, code: encode(tune) };
  } catch (e) { return fail('typo'); }
}

// ---------------------------------------------------------------- what a tune sounds like
// semitones above the base for every step where a note starts (null elsewhere), and how many steps each one lasts
function semitones(t){ const iv = scaleOf(t.scale)[2], n = iv.length; return t.mel.map(s => isOn(s) ? 12 * Math.floor(s / n) + iv[s % n] : null); }
function lengths(t){ return t.mel.map((s, i) => { if (!isOn(s)) return 0; let k = i + 1; while (k < t.mel.length && t.mel[k] === 'h') k++; return k - i; }); }
const noteCount = t => t.mel.filter(isOn).length;
// the part of a code that is the music itself (two codes that differ only in the name are the same tune)
const musicOf = code => { const d = decode(code); return d.ok ? d.code.split('-').slice(1, -2).join('') : null; };

// ---------------------------------------------------------------- recording: what was played, on the beat
// events: [{ t (seconds), kind 'on' | 'glide' | 'off', idx (pad index), ptr (finger) }]
// Notes snap to the nearest eighth note. One note per step: if two land on the same step (a chord, or a quick slide),
// the one played last wins. A note keeps sounding until its finger lets go (or slides on) or the next note starts.
function quantize(events, opt){
  const { t0, eighth, steps } = opt, latency = opt.latency || 0, notes = [], open = new Map();
  const close = (ptr, x) => { const n = open.get(ptr); if (n) { n.end = x; open.delete(ptr); } };
  for (const e of events.slice().sort((a, b) => a.t - b.t)) {
    const x = (e.t - latency - t0) / eighth;
    close(e.ptr, x);
    if (e.kind === 'off' || !Number.isInteger(e.idx) || e.idx < 0) continue;
    const n = { x, idx: e.idx, end: Infinity }; notes.push(n); open.set(e.ptr, n);
  }
  const owner = Array(steps).fill(null);
  for (const n of notes) {
    let s = Math.round(n.x); if (s < 0 && n.x > -0.75) s = 0;                 // a touch early for the very first beat still counts
    if (s < 0 || s >= steps) continue;
    if (!owner[s] || n.x >= owner[s].x) owner[s] = n;
  }
  const mel = owner.map(n => n ? n.idx : null);
  for (let s = 0; s < steps; s++) {
    const n = owner[s]; if (!n) continue;
    const end = Math.min(steps, Math.max(s + 1, Math.round(n.end)));
    for (let k = s + 1; k < end && !owner[k]; k++) mel[k] = 'h';
  }
  return mel;
}

const API = { VERSION, PREFIX, ALPHA, SCALES, QUALS, INSTS, TEMPOS, MAX_NAME, MSG, encode, decode, tidy, quantize, semitones, lengths, noteCount,
  musicOf, keyName, chordName, noteName, cleanName, titleName, tempoOf, scaleIndex, checksum };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.TUNECODE = API;
})(typeof window !== 'undefined' ? window : globalThis);
