/*
 * Small Web Audio sound set for Sky and Sea Dash.
 * Same tuning approach as the Note Rush Sound Lab: equal-temperament pitches
 * for melody notes, just-intonation ratios (4:5:6) for chords, and short
 * attack/decay envelopes on a few harmonics so nothing clicks.
 */
(function (root) {
  'use strict';

  var ctx = null, master = null, muted = false;

  function ensure() {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    return ctx;
  }

  // MIDI note number -> Hz, equal temperament, A4 = 440.
  function et(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  function tone(freq, when, dur, opts) {
    opts = opts || {};
    var c = ensure();
    if (!c || muted) return;
    var t0 = c.currentTime + (when || 0);
    var harmonics = opts.harmonics || [1, 0.35, 0.12];
    var out = c.createGain();
    var peak = opts.gain || 0.25;
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack || 0.008));
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    out.connect(master);
    harmonics.forEach(function (amp, i) {
      if (!amp) return;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = opts.type || 'sine';
      o.frequency.setValueAtTime(freq * (i + 1), t0);
      if (opts.slide) o.frequency.exponentialRampToValueAtTime(freq * (i + 1) * opts.slide, t0 + dur);
      g.gain.value = amp;
      o.connect(g); g.connect(out);
      o.start(t0); o.stop(t0 + dur + 0.02);
    });
  }

  function noise(when, dur, opts) {
    opts = opts || {};
    var c = ensure();
    if (!c || muted) return;
    var t0 = c.currentTime + (when || 0);
    var len = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource();
    src.buffer = buf;
    var f = c.createBiquadFilter();
    f.type = opts.filter || 'lowpass';
    f.frequency.setValueAtTime(opts.from || 1200, t0);
    f.frequency.exponentialRampToValueAtTime(opts.to || 200, t0 + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(opts.gain || 0.4, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  // Major pentatonic from C5, climbs as the coin streak grows.
  var PENTA = [0, 2, 4, 7, 9];
  function coinNote(step) {
    var oct = Math.floor(step / PENTA.length) % 2;
    return 72 + PENTA[step % PENTA.length] + 12 * oct;
  }

  root.SSDAudio = {
    unlock: function () { var c = ensure(); if (c && c.state === 'suspended') c.resume(); },
    setMuted: function (m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 0.5; },
    isMuted: function () { return muted; },
    coin: function (streak) { tone(et(coinNote(streak || 0)), 0, 0.18, { gain: 0.18, harmonics: [1, 0.25, 0.08, 0.04] }); },
    whoosh: function () { noise(0, 0.25, { filter: 'bandpass', from: 600, to: 2400, gain: 0.25 }); },
    splash: function () {
      noise(0, 0.5, { from: 3000, to: 300, gain: 0.45 });
      tone(et(60), 0.02, 0.4, { gain: 0.12, slide: 0.5, harmonics: [1, 0.2] });
    },
    power: function () {
      // just major triad 4:5:6 on G4, arpeggiated
      var root = et(67);
      [1, 5 / 4, 3 / 2, 2].forEach(function (r, i) { tone(root * r, i * 0.06, 0.3, { gain: 0.16 }); });
    },
    shieldPop: function () { tone(et(84), 0, 0.2, { gain: 0.2, slide: 0.5 }); noise(0, 0.15, { filter: 'highpass', from: 3000, to: 1500, gain: 0.2 }); },
    crash: function () {
      noise(0, 0.45, { from: 900, to: 80, gain: 0.6 });
      tone(et(43), 0, 0.5, { gain: 0.25, slide: 0.6, harmonics: [1, 0.5, 0.25], type: 'triangle' });
    },
    zone: function (toSea) {
      // rising (to sky) or falling (to sea) just-ratio chord
      var base = et(toSea ? 57 : 64);
      [1, 5 / 4, 3 / 2].forEach(function (r) { tone(base * r, 0.05, 0.6, { gain: 0.1, attack: 0.04 }); });
    }
  };
})(typeof self !== 'undefined' ? self : this);
