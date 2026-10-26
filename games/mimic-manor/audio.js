/*
 * Web Audio sound set for Mimic Manor.
 * Same tuning approach as the other Known Quantity games: equal-temperament
 * pitches for melody notes, just-intonation ratios for chords, short
 * attack/decay envelopes on a few harmonics so nothing clicks.
 *
 * iPhone Safari only lets audio start inside a user gesture, so unlock()
 * (called on the first touch) creates the context, resumes it and plays one
 * silent buffer.
 */
(function (root) {
  'use strict';

  var ctx = null, master = null, muted = false, unlocked = false;
  var hum = null;

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

  function et(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  function live() { return ctx && !muted && ctx.state === 'running'; }

  function tone(freq, when, dur, opts) {
    opts = opts || {};
    if (!live()) return;
    var t0 = ctx.currentTime + (when || 0);
    var harmonics = opts.harmonics || [1, 0.35, 0.12];
    var out = ctx.createGain();
    var peak = opts.gain || 0.25;
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack || 0.008));
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    out.connect(master);
    harmonics.forEach(function (amp, i) {
      if (!amp) return;
      var o = ctx.createOscillator();
      var g = ctx.createGain();
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
    if (!live()) return;
    var t0 = ctx.currentTime + (when || 0);
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = opts.filter || 'lowpass';
    f.Q.value = opts.q || 1;
    f.frequency.setValueAtTime(opts.from || 1200, t0);
    f.frequency.exponentialRampToValueAtTime(opts.to || 200, t0 + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain || 0.4, t0 + (opts.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
  }

  // Major pentatonic from C5, climbs with the cookie streak.
  var PENTA = [0, 2, 4, 7, 9];
  function streakNote(step) {
    var oct = Math.floor(step / PENTA.length) % 2;
    return 72 + PENTA[step % PENTA.length] + 12 * oct;
  }

  function stopHum() {
    if (!hum) return;
    try { hum.osc.stop(); hum.lfo.stop(); } catch (e) { /* already stopped */ }
    hum = null;
  }

  root.MMAudio = {
    unlock: function () {
      var c = ensure();
      if (!c) return;
      if (c.state === 'suspended') c.resume();
      if (!unlocked) {
        unlocked = true;
        var b = c.createBuffer(1, 1, 22050);
        var s = c.createBufferSource();
        s.buffer = b; s.connect(c.destination); s.start(0);
      }
    },
    setMuted: function (m) {
      muted = !!m;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted: function () { return muted; },
    step: function () { tone(et(40 + Math.floor(Math.random() * 3)), 0, 0.06, { gain: 0.05, harmonics: [1, 0.3] }); },
    creak: function () {
      tone(et(50), 0, 0.5, { gain: 0.14, type: 'sawtooth', slide: 0.78, harmonics: [1, 0.2], attack: 0.06 });
      noise(0, 0.45, { filter: 'bandpass', from: 700, to: 300, q: 6, gain: 0.3, attack: 0.05 });
    },
    gasp: function () {
      tone(et(76), 0, 0.35, { gain: 0.14, slide: 1.5, harmonics: [1, 0.4, 0.2], type: 'triangle', attack: 0.02 });
      noise(0, 0.25, { filter: 'highpass', from: 3000, to: 2000, gain: 0.12 });
    },
    cookie: function (streak) { tone(et(streakNote(streak || 0)), 0, 0.18, { gain: 0.16, harmonics: [1, 0.25, 0.08, 0.04] }); },
    gold: function () {
      var r = et(72);
      [1, 5 / 4, 3 / 2, 2, 5 / 2].forEach(function (k, i) { tone(r * k, i * 0.05, 0.4, { gain: 0.12 }); });
    },
    hide: function () {
      tone(et(45), 0, 0.12, { gain: 0.25, harmonics: [1, 0.5, 0.2], type: 'triangle' });
      noise(0, 0.08, { from: 1500, to: 400, gain: 0.2 });
    },
    unhide: function () { tone(et(52), 0, 0.1, { gain: 0.15, harmonics: [1, 0.4], type: 'triangle' }); },
    disguise: function () { tone(et(60), 0, 0.28, { gain: 0.16, slide: 2, harmonics: [1, 0.3], type: 'triangle' }); },
    undisguise: function () { tone(et(72), 0, 0.22, { gain: 0.14, slide: 0.5, harmonics: [1, 0.3], type: 'triangle' }); },
    poof: function () { noise(0, 0.3, { filter: 'bandpass', from: 2500, to: 500, gain: 0.3 }); tone(et(67), 0, 0.2, { gain: 0.1, slide: 0.6 }); },
    chute: function () {
      noise(0, 0.8, { filter: 'bandpass', from: 400, to: 2500, q: 2, gain: 0.35, attack: 0.1 });
      tone(et(67), 0, 0.7, { gain: 0.08, slide: 0.35, harmonics: [1, 0.2] });
    },
    thud: function () { tone(et(36), 0, 0.3, { gain: 0.3, slide: 0.7, harmonics: [1, 0.5], type: 'triangle' }); noise(0, 0.2, { from: 800, to: 100, gain: 0.3 }); },
    spotted: function () {
      tone(et(79), 0, 0.12, { gain: 0.16, type: 'square', harmonics: [1] });
      tone(et(80), 0.1, 0.25, { gain: 0.16, type: 'square', harmonics: [1] });
    },
    huh: function () { tone(et(62), 0, 0.25, { gain: 0.1, slide: 1.25, type: 'triangle', harmonics: [1, 0.3] }); },
    bark: function () {
      noise(0, 0.12, { filter: 'bandpass', from: 900, to: 500, q: 3, gain: 0.35 });
      tone(et(55), 0, 0.12, { gain: 0.18, slide: 0.7, type: 'sawtooth', harmonics: [1, 0.3] });
    },
    sniff: function () { noise(0, 0.08, { filter: 'highpass', from: 4000, to: 3000, gain: 0.08 }); noise(0.12, 0.08, { filter: 'highpass', from: 4000, to: 3000, gain: 0.08 }); },
    open: function () { tone(et(57), 0, 0.3, { gain: 0.1, type: 'sawtooth', slide: 1.12, harmonics: [1, 0.2], attack: 0.05 }); },
    beep: function () { tone(et(88), 0, 0.08, { gain: 0.08, type: 'square', harmonics: [1] }); tone(et(84), 0.12, 0.08, { gain: 0.08, type: 'square', harmonics: [1] }); },
    slurp: function () { noise(0, 0.25, { filter: 'bandpass', from: 300, to: 3000, q: 4, gain: 0.25 }); },
    heartbeat: function (strength) {
      var g = 0.12 + 0.18 * (strength || 0);
      tone(et(31), 0, 0.14, { gain: g, harmonics: [1, 0.3], type: 'sine' });
      tone(et(31), 0.18, 0.12, { gain: g * 0.7, harmonics: [1, 0.3], type: 'sine' });
    },
    closeCall: function () { [84, 88, 91].forEach(function (n, i) { tone(et(n), i * 0.05, 0.2, { gain: 0.08 }); }); },
    caught: function () {
      [67, 63, 60, 55].forEach(function (n, i) { tone(et(n), i * 0.13, 0.3, { gain: 0.18, type: 'triangle', harmonics: [1, 0.3] }); });
    },
    lightsOut: function () { tone(et(43), 0, 0.5, { gain: 0.15, slide: 0.5, harmonics: [1, 0.4] }); },
    lightsOn: function () { tone(et(55), 0, 0.3, { gain: 0.1, slide: 1.5, harmonics: [1, 0.4] }); },
    // Night starts with a little music-box phrase (minor, spooky but cute).
    night: function () {
      var seq = [69, 72, 76, 74, 72, 71, 72];
      seq.forEach(function (n, i) { tone(et(n), i * 0.16, 0.5, { gain: 0.1, harmonics: [1, 0, 0.2, 0, 0.1] }); });
    },
    // Dawn: just major triad 4:5:6 arpeggio, then the octave.
    dawn: function () {
      var r = et(60);
      [1, 5 / 4, 3 / 2, 2, 5 / 2, 3].forEach(function (k, i) { tone(r * k, i * 0.09, 0.8, { gain: 0.12, attack: 0.02 }); });
    },
    // Hoover hum: one long-running buzz whose loudness follows how close it is.
    setHum: function (level) {
      if (!live() || level <= 0.001) {
        if (hum) hum.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
        if (!live()) stopHum();
        return;
      }
      if (!hum) {
        var o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        var lfo = ctx.createOscillator(), lg = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = et(38);
        f.type = 'lowpass'; f.frequency.value = 500;
        lfo.frequency.value = 7; lg.gain.value = 6;
        lfo.connect(lg); lg.connect(o.frequency);
        g.gain.value = 0.0001;
        o.connect(f); f.connect(g); g.connect(master);
        o.start(); lfo.start();
        hum = { osc: o, lfo: lfo, g: g };
      }
      hum.g.gain.setTargetAtTime(0.09 * level, ctx.currentTime, 0.1);
    },
    stopHum: stopHum
  };
})(typeof self !== 'undefined' ? self : this);
