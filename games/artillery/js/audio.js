// Small Web Audio synth. Pitches are equal-tempered; chords use just ratios
// with enveloped harmonic tones, same approach as the Note Rush Sound Lab.
(function () {
  'use strict';

  let ctx = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem('kq.artillery.muted') === '1'; } catch (e) { /* storage blocked */ }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // Harmonic tone: partials 1..n with 1/k amplitude, quick attack, exp decay.
  function tone(freq, dur, opts) {
    if (muted || !ensure()) return;
    opts = opts || {};
    const t0 = ctx.currentTime + (opts.delay || 0);
    const peak = opts.gain == null ? 0.25 : opts.gain;
    const partials = opts.partials || 5;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack || 0.008));
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    out.connect(master);
    for (let k = 1; k <= partials; k++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = opts.type || 'sine';
      o.frequency.setValueAtTime(freq * k, t0);
      if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo * k, t0 + dur);
      if (opts.vibrato) {
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = opts.vibrato;
        lg.gain.value = freq * k * 0.03;
        lfo.connect(lg).connect(o.frequency);
        lfo.start(t0); lfo.stop(t0 + dur + 0.05);
      }
      g.gain.value = 1 / (k * (opts.bright ? 1 : k));
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }
  }

  let noiseBuf = null;
  function noise(dur, freq, opts) {
    if (muted || !ensure()) return;
    opts = opts || {};
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = ctx.currentTime + (opts.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.filter || 'lowpass';
    f.frequency.setValueAtTime(freq, t0);
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain || 0.4, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // C major pentatonic, used so every shot sounds musical in the concert skin.
  const PENTA = [0, 2, 4, 7, 9];
  function pentaNote(i, base) {
    const oct = Math.floor(i / PENTA.length);
    return midi(base + oct * 12 + PENTA[((i % PENTA.length) + PENTA.length) % PENTA.length]);
  }
  // just-intonation major triad + octave
  const JUST = [1, 5 / 4, 3 / 2, 2];

  const Sfx = {
    unlock: ensure,
    isMuted: function () { return muted; },
    setMuted: function (m) {
      muted = !!m;
      try { localStorage.setItem('kq.artillery.muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
    },
    click: function () { tone(midi(84), 0.06, { gain: 0.08, partials: 2 }); },
    fire: function (skin, power) {
      if (skin === 'concert') {
        const f = pentaNote(Math.round(power / 12), 64);
        tone(f, 0.45, { gain: 0.22, type: 'sine', partials: 6, bright: true });
      } else if (skin === 'wild') {
        noise(0.25, 900, { filter: 'bandpass', sweepTo: 2500, gain: 0.35 });
        tone(midi(45), 0.15, { gain: 0.2, partials: 2 });
      } else {
        tone(midi(88), 0.35, { gain: 0.15, slideTo: midi(64), vibrato: 18, partials: 2 });
      }
    },
    boom: function (skin, size) {
      const big = Math.min(1, size / 70);
      if (skin === 'concert') {
        const root = pentaNote(Math.floor(Math.random() * 5), 48 - Math.round(big * 12));
        JUST.forEach(function (r, i) {
          tone(root * r, 0.9 + big, { gain: 0.14, partials: 6, delay: i * 0.03 });
        });
        noise(0.2 + big * 0.3, 1800, { gain: 0.15 });
      } else if (skin === 'wild') {
        noise(0.35 + big * 0.5, 500 + big * 300, { gain: 0.6, sweepTo: 80 });
        tone(midi(36), 0.4 + big * 0.4, { gain: 0.35, slideTo: midi(24), partials: 2 });
      } else {
        noise(0.4 + big * 0.4, 2000, { filter: 'bandpass', sweepTo: 200, gain: 0.45 });
        tone(midi(60), 0.5 + big * 0.4, { gain: 0.15, slideTo: midi(36), vibrato: 30, partials: 3 });
      }
    },
    bounce: function (skin) {
      if (skin === 'concert') tone(pentaNote(7, 60), 0.18, { gain: 0.15, partials: 4 });
      else if (skin === 'wild') noise(0.08, 3000, { filter: 'highpass', gain: 0.25 });
      else tone(midi(76), 0.15, { gain: 0.12, slideTo: midi(88), partials: 2 });
    },
    dirt: function () { noise(0.4, 300, { gain: 0.4, sweepTo: 60 }); },
    hit: function () { tone(midi(43), 0.25, { gain: 0.25, partials: 3, slideTo: midi(38) }); },
    move: function () { noise(0.12, 400, { gain: 0.15 }); },
    win: function (skin) {
      const base = skin === 'alien' ? 62 : 60;
      [0, 1, 2, 3, 5].forEach(function (n, i) {
        tone(pentaNote(n + 5, base - 12), 0.5, { gain: 0.18, partials: 5, delay: i * 0.12 });
      });
      JUST.forEach(function (r) { tone(midi(base) * r, 1.4, { gain: 0.1, partials: 5, delay: 0.65 }); });
    },
    lose: function () {
      [4, 3, 2, 0].forEach(function (n, i) {
        tone(pentaNote(n, 55), 0.5, { gain: 0.15, partials: 4, delay: i * 0.18 });
      });
    }
  };

  window.ArtillerySfx = Sfx;
})();
