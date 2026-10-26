/*
 * Creatures for Sky and Sea Dash.
 *
 * Every creature is built from a seed, so the same seed always gives the same
 * creature. Creatures saved in the shared KQProfile roster (for example by the
 * breeding game) are read with fromProfile(): if they carry our own traits we
 * use them as is, otherwise we grow traits from their seed or id and keep
 * their name and colours.
 */
(function (root) {
  'use strict';

  function hashString(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(r, list) { return list[Math.floor(r() * list.length)]; }

  function hsl(h, s, l) { return 'hsl(' + Math.round(h) + ',' + Math.round(s) + '%,' + Math.round(l) + '%)'; }

  var SYL_A = ['Pip', 'Bo', 'Zu', 'Mi', 'Ka', 'Lu', 'Fen', 'Wob', 'Tik', 'Nim', 'Sol', 'Ru', 'Gli', 'Pom', 'Ves', 'Dri'];
  var SYL_B = ['ble', 'po', 'zi', 'mo', 'ra', 'ffin', 'dle', 'ko', 'lo', 'sh', 'nny', 'bit', 'wix', 'roo', 'fy', 'ndle'];

  function generate(seed) {
    seed = seed >>> 0;
    var r = rng(seed);
    var hue = r() * 360;
    var accentHue = (hue + 120 + r() * 120) % 360;
    return {
      id: 'wild-' + seed.toString(36),
      seed: seed,
      name: pick(r, SYL_A) + pick(r, SYL_B),
      colors: {
        body: hsl(hue, 55 + r() * 30, 55 + r() * 12),
        belly: hsl(hue, 40 + r() * 20, 82 + r() * 8),
        accent: hsl(accentHue, 70 + r() * 20, 55 + r() * 10),
        eye: hsl(r() * 360, 30, 18)
      },
      traits: {
        shape: pick(r, ['round', 'round', 'long', 'tall']),
        ears: pick(r, ['pointy', 'round', 'horns', 'antenna', 'none']),
        wings: pick(r, ['feather', 'bat', 'bug']),
        tail: pick(r, ['fluffy', 'fin', 'curl']),
        pattern: pick(r, ['none', 'spots', 'stripes']),
        size: 0.92 + r() * 0.16
      },
      source: 'wild'
    };
  }

  function randomWild(count) {
    var out = [];
    for (var i = 0; i < count; i++) out.push(generate((Math.random() * 4294967296) >>> 0));
    return out;
  }

  /** Turn any roster entry from KQProfile into a drawable creature. */
  function fromProfile(c) {
    if (c && c.traits && c.colors && c.colors.body) return c;
    var seed = typeof c.seed === 'number' ? c.seed : hashString(String(c.id));
    var g = generate(seed);
    g.id = c.id;
    if (c.name) g.name = String(c.name).slice(0, 14);
    var cols = Array.isArray(c.colors) ? c.colors : (c.color ? [c.color] : []);
    if (cols[0]) g.colors.body = cols[0];
    if (cols[1]) g.colors.accent = cols[1];
    g.source = c.source || 'hatchery';
    return g;
  }

  // ---- drawing -------------------------------------------------------------

  function ellipse(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2);
  }

  function bodyDims(tr) {
    if (tr.shape === 'long') return { rx: 0.62, ry: 0.42 };
    if (tr.shape === 'tall') return { rx: 0.44, ry: 0.56 };
    return { rx: 0.52, ry: 0.5 };
  }

  function drawWing(ctx, c, side, flap, swim) {
    var tr = c.traits;
    ctx.save();
    ctx.scale(side, 1);
    ctx.translate(0.38, -0.08);
    ctx.rotate(swim ? 0.5 + flap * 0.25 : -0.25 - flap * 0.7);
    ctx.globalAlpha *= swim ? 0.85 : 1;
    ctx.fillStyle = swim ? c.colors.accent : c.colors.body;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    if (swim) {
      // rounded fin
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(0.55, -0.15, 0.62, 0.22);
      ctx.quadraticCurveTo(0.3, 0.3, 0, 0.14);
    } else if (tr.wings === 'bat') {
      ctx.moveTo(0, 0);
      ctx.lineTo(0.75, -0.35);
      ctx.quadraticCurveTo(0.62, -0.05, 0.7, 0.1);
      ctx.quadraticCurveTo(0.5, 0.0, 0.45, 0.18);
      ctx.quadraticCurveTo(0.28, 0.05, 0.2, 0.2);
      ctx.closePath();
    } else if (tr.wings === 'bug') {
      ctx.fillStyle = 'rgba(220,245,255,0.75)';
      ctx.ellipse(0.38, -0.12, 0.42, 0.2, -0.3, 0, Math.PI * 2);
    } else {
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(0.4, -0.45, 0.82, -0.28);
      ctx.quadraticCurveTo(0.68, -0.12, 0.76, -0.04);
      ctx.quadraticCurveTo(0.58, 0.0, 0.62, 0.1);
      ctx.quadraticCurveTo(0.3, 0.15, 0, 0.12);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawEars(ctx, c, d) {
    var tr = c.traits, top = -d.ry * 0.85;
    ctx.fillStyle = c.colors.body;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.03;
    [-1, 1].forEach(function (s) {
      ctx.beginPath();
      if (tr.ears === 'pointy') {
        ctx.moveTo(s * 0.12, top + 0.05);
        ctx.lineTo(s * 0.3, top - 0.32);
        ctx.lineTo(s * 0.36, top + 0.1);
      } else if (tr.ears === 'round') {
        ctx.arc(s * 0.27, top + 0.02, 0.14, 0, Math.PI * 2);
      } else if (tr.ears === 'horns') {
        ctx.fillStyle = c.colors.accent;
        ctx.moveTo(s * 0.12, top + 0.06);
        ctx.quadraticCurveTo(s * 0.32, top - 0.1, s * 0.3, top - 0.34);
        ctx.quadraticCurveTo(s * 0.4, top - 0.05, s * 0.28, top + 0.12);
      } else if (tr.ears === 'antenna') {
        ctx.strokeStyle = c.colors.eye;
        ctx.lineWidth = 0.035;
        ctx.moveTo(s * 0.1, top + 0.05);
        ctx.quadraticCurveTo(s * 0.18, top - 0.25, s * 0.3, top - 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = c.colors.accent;
        ctx.arc(s * 0.3, top - 0.3, 0.07, 0, Math.PI * 2);
      } else return;
      ctx.closePath();
      ctx.fill();
      if (tr.ears !== 'antenna') ctx.stroke();
    });
  }

  function drawTail(ctx, c, d, wag, swim) {
    var tr = c.traits;
    ctx.save();
    ctx.translate(0, d.ry * 0.7);
    ctx.rotate(wag * 0.3);
    ctx.fillStyle = swim ? c.colors.accent : (tr.tail === 'fluffy' ? c.colors.belly : c.colors.accent);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    if (swim || tr.tail === 'fin') {
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-0.1, 0.25, -0.32, 0.42);
      ctx.quadraticCurveTo(0, 0.32, 0.32, 0.42);
      ctx.quadraticCurveTo(0.1, 0.25, 0, 0);
    } else if (tr.tail === 'curl') {
      ctx.lineWidth = 0.09;
      ctx.strokeStyle = c.colors.accent;
      ctx.arc(0.12, 0.22, 0.14, -Math.PI * 0.9, Math.PI * 0.9);
      ctx.stroke();
      ctx.restore();
      return;
    } else {
      ellipse(ctx, 0, 0.18, 0.16, 0.2);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawPattern(ctx, c, d, back) {
    var tr = c.traits;
    if (tr.pattern === 'none') return;
    ctx.save();
    ellipse(ctx, 0, 0, d.rx, d.ry);
    ctx.clip();
    ctx.fillStyle = c.colors.accent;
    ctx.globalAlpha *= 0.55;
    var r = rng(c.seed || 1);
    if (tr.pattern === 'spots') {
      for (var i = 0; i < 6; i++) {
        ellipse(ctx, (r() - 0.5) * d.rx * 1.6, (r() - 0.5) * d.ry * (back ? 1.6 : 0.9) - (back ? 0 : d.ry * 0.4), 0.06 + r() * 0.05, 0.06 + r() * 0.04);
        ctx.fill();
      }
    } else {
      for (var j = -2; j <= 2; j++) {
        ctx.fillRect(-d.rx, j * 0.18 - 0.035 - (back ? 0 : 0.2), d.rx * 2, 0.07);
      }
    }
    ctx.restore();
  }

  /**
   * Draw a creature centred at (x, y), `size` pixels across its body.
   * opts: {view: 'front'|'back', swim: bool, t: seconds, tilt: radians}
   */
  function draw(ctx, c, x, y, size, opts) {
    opts = opts || {};
    var t = opts.t || 0, swim = !!opts.swim, back = opts.view === 'back';
    var d = bodyDims(c.traits);
    var flap = swim ? Math.sin(t * 5) : Math.sin(t * 14);
    ctx.save();
    ctx.translate(x, y);
    var s = size * (c.traits.size || 1);
    ctx.scale(s, s);
    ctx.rotate(opts.tilt || 0);

    drawTail(ctx, c, d, Math.sin(t * (swim ? 6 : 8)), swim);
    drawWing(ctx, c, -1, flap, swim);
    drawWing(ctx, c, 1, flap, swim);
    drawEars(ctx, c, d);

    // body
    var grad = ctx.createRadialGradient(-d.rx * 0.3, -d.ry * 0.4, 0.05, 0, 0, d.rx * 1.2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.18, c.colors.body);
    grad.addColorStop(1, c.colors.body);
    ctx.fillStyle = grad;
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.035;
    ellipse(ctx, 0, 0, d.rx, d.ry);
    ctx.fill();
    ctx.stroke();

    if (!back) {
      ctx.fillStyle = c.colors.belly;
      ellipse(ctx, 0, d.ry * 0.35, d.rx * 0.62, d.ry * 0.5);
      ctx.fill();
    }
    drawPattern(ctx, c, d, back);

    if (!back) {
      // eyes, cheeks, mouth
      var blink = (Math.floor(t * 10) % 37) === 0 ? 0.15 : 1;
      [-1, 1].forEach(function (sd) {
        ctx.fillStyle = '#fff';
        ellipse(ctx, sd * 0.19, -d.ry * 0.25, 0.13, 0.15 * blink);
        ctx.fill();
        ctx.fillStyle = c.colors.eye;
        ellipse(ctx, sd * 0.19 + 0.02, -d.ry * 0.22, 0.08, 0.1 * blink);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ellipse(ctx, sd * 0.19 + 0.05, -d.ry * 0.28, 0.03, 0.03 * blink);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,120,140,0.45)';
        ellipse(ctx, sd * 0.33, -d.ry * 0.02, 0.07, 0.045);
        ctx.fill();
      });
      ctx.strokeStyle = c.colors.eye;
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      ctx.arc(0, -d.ry * 0.05, 0.07, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  root.SSDCreatures = {
    generate: generate,
    randomWild: randomWild,
    fromProfile: fromProfile,
    draw: draw,
    hashString: hashString,
    rng: rng
  };
})(typeof self !== 'undefined' ? self : this);
