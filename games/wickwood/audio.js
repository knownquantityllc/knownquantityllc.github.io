/*
 * Small Web Audio sound set for Wickwood.
 * Same tuning approach as the other Known Quantity games: equal-temperament
 * pitches for melody notes, just-intonation ratios (4:5:6) for chords, and
 * short attack/decay envelopes on a few harmonics so nothing clicks.
 */
(function (root) {
  'use strict';

  var ctx = null, master = null, muted = false, unlocked = false;

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
    if (!c || muted || c.state !== 'running') return;
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

  var noiseBuf = null;
  function noise(when, dur, opts) {
    opts = opts || {};
    var c = ensure();
    if (!c || muted || c.state !== 'running') return;
    var t0 = c.currentTime + (when || 0);
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var src = c.createBufferSource();
    src.buffer = noiseBuf;
    var f = c.createBiquadFilter();
    f.type = opts.filter || 'lowpass';
    f.frequency.setValueAtTime(opts.from || 1200, t0);
    f.frequency.exponentialRampToValueAtTime(opts.to || 200, t0 + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(opts.gain || 0.4, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0, Math.random() * 0.5, dur + 0.05);
  }

  // Major pentatonic from C6, climbs with the pickup streak.
  var PENTA = [0, 2, 4, 7, 9];
  var lastShot = 0;

  root.WWAudio = {
    // iOS Safari only starts audio from inside a touch/click handler, and it
    // wants a sound to actually play there once.
    unlock: function () {
      var c = ensure();
      if (!c) return;
      if (c.state !== 'running') c.resume();
      if (!unlocked) {
        unlocked = true;
        var b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
        s.buffer = b; s.connect(c.destination); s.start(0);
      }
    },
    setMuted: function (m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 0.5; },
    isMuted: function () { return muted; },
    shoot: function (kind) {
      var c = ensure();
      if (!c) return;
      if (c.currentTime - lastShot < 0.07) return;
      lastShot = c.currentTime;
      if (kind === 'staff') { noise(0, 0.12, { filter: 'highpass', from: 5000, to: 2000, gain: 0.12 }); tone(et(88), 0, 0.08, { gain: 0.05, type: 'square', harmonics: [1] }); }
      else if (kind === 'ring') tone(et(76), 0, 0.12, { gain: 0.06, slide: 1.5, harmonics: [1, 0.3] });
      else if (kind === 'bow') noise(0, 0.08, { filter: 'bandpass', from: 2400, to: 900, gain: 0.18 });
      else tone(et(69), 0, 0.09, { gain: 0.07, slide: 1.6, type: 'triangle', harmonics: [1, 0.2] });
    },
    hit: function () { noise(0, 0.07, { from: 2500, to: 600, gain: 0.14 }); },
    pop: function () {
      tone(et(62), 0, 0.18, { gain: 0.12, slide: 0.5, harmonics: [1, 0.4] });
      noise(0, 0.15, { from: 1500, to: 200, gain: 0.18 });
    },
    coin: function (streak) {
      var s = streak || 0;
      var midi = 84 + PENTA[s % 5] + 12 * (Math.floor(s / 5) % 2);
      tone(et(midi), 0, 0.15, { gain: 0.12, harmonics: [1, 0.25, 0.08] });
    },
    heal: function () { [1, 5 / 4, 3 / 2].forEach(function (r, i) { tone(et(72) * r, i * 0.05, 0.3, { gain: 0.1 }); }); },
    hurt: function () {
      noise(0, 0.25, { from: 900, to: 100, gain: 0.4 });
      tone(et(50), 0, 0.25, { gain: 0.18, slide: 0.7, type: 'triangle', harmonics: [1, 0.4] });
    },
    dash: function () { noise(0, 0.2, { filter: 'bandpass', from: 500, to: 2600, gain: 0.25 }); },
    burst: function () {
      noise(0, 0.5, { from: 4000, to: 150, gain: 0.45 });
      [1, 5 / 4, 3 / 2, 2].forEach(function (r) { tone(et(60) * r, 0, 0.6, { gain: 0.08 }); });
    },
    door: function () {
      // just major triad 4:5:6 on G4, arpeggiated upward
      var b = et(67);
      [1, 5 / 4, 3 / 2, 2].forEach(function (r, i) { tone(b * r, i * 0.08, 0.4, { gain: 0.12 }); });
    },
    roar: function () {
      noise(0, 0.9, { from: 600, to: 60, gain: 0.5 });
      tone(et(36), 0, 0.9, { gain: 0.25, slide: 0.8, type: 'sawtooth', harmonics: [1, 0.3] });
    },
    win: function () {
      var b = et(60);
      [[1, 0], [5 / 4, 0.12], [3 / 2, 0.24], [2, 0.36], [5 / 2, 0.5], [3, 0.5]].forEach(function (n) {
        tone(b * n[0], n[1], 0.8, { gain: 0.12, attack: 0.02 });
      });
    },
    lose: function () {
      [64, 62, 60, 55].forEach(function (m, i) { tone(et(m), i * 0.18, 0.4, { gain: 0.12, type: 'triangle', harmonics: [1, 0.2] }); });
    },
    buy: function () { [1, 3 / 2, 2].forEach(function (r, i) { tone(et(76) * r, i * 0.06, 0.25, { gain: 0.12 }); }); },
    nope: function () { tone(et(52), 0, 0.2, { gain: 0.12, type: 'square', harmonics: [1] }); }
  };
})(typeof self !== 'undefined' ? self : this);
