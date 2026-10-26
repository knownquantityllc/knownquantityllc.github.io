// Sloth Band audio: small Web Audio synth in the same spirit as the Note Rush
// Sound Lab engine: equal-temperament pitches, just-ratio chords, and
// enveloped harmonic (additive) timbres. No audio files needed.
(function () {
  'use strict';

  const A4 = 440;
  const NOTE_INDEX = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };

  // "C4" -> Hz, 12-tone equal temperament around A4 = 440.
  function noteHz(name) {
    const m = /^([A-G]#?)(-?\d)$/.exec(name);
    if (!m) return A4;
    const semis = NOTE_INDEX[m[1]] + (parseInt(m[2], 10) - 4) * 12;
    return A4 * Math.pow(2, semis / 12);
  }

  // Just-intonation ratios for chords built on an ET root.
  const JUST = { root: 1, maj3: 5 / 4, min3: 6 / 5, fifth: 3 / 2, oct: 2, maj6: 5 / 3, min7: 9 / 5 };

  // Harmonic recipes: [harmonic number, relative amplitude].
  const TIMBRES = {
    guitar:  { partials: [[1, 1], [2, 0.5], [3, 0.33], [4, 0.2], [5, 0.12], [6, 0.06]], a: 0.004, d: 0.25, s: 0.15, r: 0.6 },
    trumpet: { partials: [[1, 0.7], [2, 1], [3, 0.8], [4, 0.6], [5, 0.4], [6, 0.25], [7, 0.12]], a: 0.03, d: 0.08, s: 0.75, r: 0.12 },
    tuba:    { partials: [[1, 1], [2, 0.7], [3, 0.35], [4, 0.15]], a: 0.04, d: 0.1, s: 0.7, r: 0.2 },
    keys:    { partials: [[1, 1], [2, 0.35], [3, 0.12], [4, 0.08]], a: 0.005, d: 0.4, s: 0.2, r: 0.4 },
    bell:    { partials: [[1, 1], [2.76, 0.4], [5.4, 0.2], [8.9, 0.08]], a: 0.002, d: 0.6, s: 0.0, r: 0.6 },
  };

  let ctx = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem('sb.muted') === '1'; } catch (e) { /* storage unavailable */ }

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ctx.destination);
    return ctx;
  }

  function tone(freq, timbreName, dur, vol, when) {
    const c = ensure();
    if (!c || muted) return;
    const t = TIMBRES[timbreName] || TIMBRES.keys;
    const t0 = c.currentTime + (when || 0);
    const peak = (vol == null ? 0.3 : vol);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + t.a);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * Math.max(t.s, 0.001)), t0 + t.a + t.d);
    const end = t0 + Math.max(dur, t.a + t.d);
    env.gain.setValueAtTime(Math.max(0.0001, peak * Math.max(t.s, 0.001)), end);
    env.gain.exponentialRampToValueAtTime(0.0001, end + t.r);
    env.connect(master);
    const total = t.partials.reduce((s, p) => s + p[1], 0);
    for (const [h, amp] of t.partials) {
      const f = freq * h;
      if (f > 12000) continue;
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.value = amp / total;
      o.connect(g);
      g.connect(env);
      o.start(t0);
      o.stop(end + t.r + 0.05);
    }
  }

  function noise(dur, vol, filterHz, when, q) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime + (when || 0);
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = filterHz || 1200;
    f.Q.value = q || 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  function kick(when, vol) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime + (when || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(150, t0);
    o.frequency.exponentialRampToValueAtTime(45, t0 + 0.18);
    g.gain.setValueAtTime(vol || 0.7, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + 0.4);
  }

  function chord(rootName, quality, timbre, dur, vol, when, arp) {
    const root = noteHz(rootName);
    const ratios = quality === 'min' ? [JUST.root, JUST.min3, JUST.fifth] : quality === 'dom7'
      ? [JUST.root, JUST.maj3, JUST.fifth, JUST.min7] : [JUST.root, JUST.maj3, JUST.fifth, JUST.oct];
    ratios.forEach((r, i) => tone(root * r, timbre, dur, (vol || 0.25) / Math.sqrt(ratios.length), (when || 0) + i * (arp || 0)));
  }

  // Pentatonic so random impact notes always sound pleasant together.
  const PENTA = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5'];
  const INSTRUMENT_VOICE = { drums: 'keys', trumpet: 'trumpet', guitar: 'guitar', tuba: 'tuba' };

  const SFX = {
    unlock() { ensure(); },
    isMuted() { return muted; },
    setMuted(m) {
      muted = !!m;
      try { localStorage.setItem('sb.muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    stretch(amount) { tone(noteHz('C3') * (1 + amount * 0.5), 'keys', 0.03, 0.05); },
    launch(inst) {
      switch (inst) {
        case 'drums': kick(0, 0.5); noise(0.08, 0.2, 5000, 0.05); break;
        case 'trumpet': tone(noteHz('G4'), 'trumpet', 0.12, 0.25); tone(noteHz('C5'), 'trumpet', 0.2, 0.25, 0.1); break;
        case 'guitar': chord('E3', 'maj', 'guitar', 0.3, 0.3, 0, 0.02); break;
        case 'tuba': tone(noteHz('F2'), 'tuba', 0.3, 0.4); break;
        default: tone(noteHz('C4'), 'keys', 0.2, 0.3);
      }
    },
    ability(inst) {
      switch (inst) {
        case 'drums':
          kick(0, 0.9); noise(0.4, 0.5, 300, 0, 0.6); noise(0.25, 0.3, 6000, 0.02, 0.5);
          break;
        case 'trumpet':
          ['C5', 'E5', 'G5'].forEach((n, i) => tone(noteHz(n), 'trumpet', 0.1, 0.25, i * 0.07));
          tone(noteHz('C6'), 'trumpet', 0.35, 0.28, 0.21);
          break;
        case 'guitar':
          chord('G3', 'maj', 'guitar', 0.6, 0.45, 0, 0.03);
          break;
        case 'tuba':
          tone(noteHz('C2'), 'tuba', 0.5, 0.55); tone(noteHz('C3'), 'tuba', 0.5, 0.2);
          break;
      }
    },
    impact(inst, strength) {
      const s = Math.max(0, Math.min(1, strength));
      if (s < 0.05) return;
      const n = PENTA[Math.floor(Math.random() * PENTA.length)];
      let f = noteHz(n);
      if (inst === 'tuba') f /= 4;
      else if (inst === 'drums') { kick(0, 0.2 + s * 0.4); return; }
      tone(f, INSTRUMENT_VOICE[inst] || 'keys', 0.08, 0.06 + s * 0.2);
    },
    blockBreak(material) {
      if (material === 'ice') { tone(noteHz('E6'), 'bell', 0.1, 0.12); noise(0.25, 0.25, 7000, 0, 1.5); }
      else if (material === 'stone') noise(0.3, 0.45, 400, 0, 0.7);
      else noise(0.2, 0.35, 1400, 0, 1);
    },
    platypusPop() {
      // A honky little "quack": a fast downward glide through a nasal timbre.
      const c = ensure();
      if (!c || muted) return;
      const t0 = c.currentTime;
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(720, t0);
      o.frequency.exponentialRampToValueAtTime(260, t0 + 0.22);
      const f = c.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 4;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.35, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + 0.3);
      tone(noteHz('A5'), 'bell', 0.1, 0.12, 0.05);
    },
    win() {
      chord('C4', 'maj', 'trumpet', 0.25, 0.35, 0, 0.0);
      chord('F4', 'maj', 'trumpet', 0.25, 0.35, 0.3, 0.0);
      chord('G4', 'dom7', 'trumpet', 0.25, 0.35, 0.6, 0.0);
      chord('C5', 'maj', 'guitar', 0.9, 0.45, 0.9, 0.04);
      kick(0.9, 0.6);
    },
    lose() {
      ['G3', 'F#3', 'F3', 'E3'].forEach((n, i) => tone(noteHz(n), 'tuba', 0.3, 0.35, i * 0.32));
    },
    star(i) { tone(noteHz(['C6', 'E6', 'G6'][i] || 'C6'), 'bell', 0.2, 0.25); },
    click() { tone(noteHz('C5'), 'keys', 0.04, 0.12); },
  };

  window.SBAudio = SFX;
  window.SBAudio.noteHz = noteHz;
})();
