/*
 * Sky and Sea Dash: a three-lane endless runner that flips between flying
 * through the sky and swimming through the sea.
 *
 * World units: lanes are LANE_W apart, the player sits at z = 0 and the
 * world scrolls toward them. y = 0 is cruising height, rising and diving
 * move the player up or down for a moment.
 *
 * Coins and best scores go to the shared Known Quantity profile (KQProfile).
 */
(function () {
  'use strict';

  var GAME_ID = 'sky-and-sea-dash';
  var LANE_W = 2.2;
  var CAM_Y = 4.4;
  var CAM_DIST = 7;
  var FAR = 120;
  var GROUND_Y = -3.2;
  var ZONE_LEN = 500;
  var RISE_H = 1.9, DIVE_H = -1.7, MOVE_T = 0.85;
  var REVIVE_COSTS = [50, 100];
  var BEFRIEND_COST = 100;

  var P = window.KQProfile;
  var C = window.SSDCreatures;
  var A = window.SSDAudio;

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, DPR = 1, F = 1, HORIZON = 0;

  var $ = function (id) { return document.getElementById(id); };

  // ---- settings (per device convenience only) -----------------------------

  var settings = { muted: false, picked: null, seenHelp: false };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('ssd.settings') || '{}')); } catch (e) { /* ignore */ }
  function saveSettings() { try { localStorage.setItem('ssd.settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } }
  A.setMuted(settings.muted);

  // ---- helpers ------------------------------------------------------------

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(h1, h2, t) {
    var a = hexToRgb(h1), b = hexToRgb(h2);
    return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ')';
  }
  function zoneAt(d) { return Math.floor(d / ZONE_LEN) % 2 === 0 ? 'sky' : 'sea'; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    HORIZON = H * 0.36;
    var pxPerUnit = Math.min(W * 0.3 / LANE_W, H * 0.3 / CAM_Y);
    F = pxPerUnit * CAM_DIST;
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- state --------------------------------------------------------------

  var state = 'menu'; // menu | play | paused | dying | over
  var run = null;
  var creature = null;
  var roster = [];
  var wild = C.randomWild(3);
  var clock = 0;
  var cam = { x: 0, y: 0 };
  var scenery = { clouds: [], bubbles: [] };
  var particles = [];
  var attractDist = 0;

  for (var i = 0; i < 14; i++) scenery.clouds.push({ x: rand(-1, 1), y: rand(0, 1), s: rand(0.5, 1.4), v: rand(0.2, 0.6) });
  for (var j = 0; j < 30; j++) scenery.bubbles.push({ x: rand(0, 1), y: rand(0, 1), r: rand(1, 4), v: rand(0.03, 0.09) });

  function newRun() {
    return {
      dist: 0, score: 0, speed: 16, coins: 0, pending: 0, mult: 1,
      lane: 0, x: 0, y: 0, act: null,
      objs: [], nextRow: 40, nextRing: ZONE_LEN,
      zone: 'sky', zoneMix: 0,
      magnet: 0, double: 0, shield: false, invuln: 0,
      streak: 0, streakT: 0,
      revives: 0, finalized: false, dieT: 0, tilt: 0, time: 0
    };
  }

  // ---- profile glue -------------------------------------------------------

  function flushCoins() {
    if (run && run.pending > 0) { P.addCoins(run.pending, GAME_ID); run.pending = 0; }
  }

  function finalizeRun() {
    if (!run || run.finalized) return;
    flushCoins();
    P.submitScore(GAME_ID, Math.floor(run.score));
    run.finalized = true;
  }

  // ---- spawning -----------------------------------------------------------

  function difficulty(d) { return 1 - Math.exp(-d / 3500); }

  function spawnRow(z) {
    var r = run, dif = difficulty(z);
    var nearRing = Math.abs(z - Math.round(z / ZONE_LEN) * ZONE_LEN) < 20;
    var zone = zoneAt(z);
    var lanes = [null, null, null];

    if (!nearRing && z > 60) {
      var roll = Math.random();
      var warmup = z < 260; // the first few rows teach one lane at a time
      if (!warmup && roll < 0.12 + dif * 0.08) {
        var k = Math.random() < 0.5 ? 'low' : 'high';
        lanes = [k, k, k];
      } else {
        var count = !warmup && Math.random() < 0.35 + dif * 0.45 ? 2 : 1;
        var order = [0, 1, 2].sort(function () { return Math.random() - 0.5; });
        for (var n = 0; n < count; n++) {
          var w = Math.random();
          lanes[order[n]] = w < 0.25 + dif * 0.2 ? 'wall' : w < 0.62 + dif * 0.1 ? 'low' : 'high';
        }
      }
      lanes.forEach(function (kind, li) {
        if (kind) r.objs.push({ t: 'obs', kind: kind, lane: li - 1, z: z, zone: zone, seed: Math.random() });
      });
    }

    // coins
    if (Math.random() < 0.6) {
      var cl = Math.floor(Math.random() * 3);
      var ck = lanes[cl];
      if (ck !== 'wall') {
        var len = 6 + Math.floor(Math.random() * 4);
        for (var c = 0; c < len; c++) {
          var cz = z - (len - 1) + c * 2;
          var p = (cz - z) / 7; // -1..1 across the obstacle
          var cy = 0;
          if (ck === 'low') cy = RISE_H * 0.85 * Math.max(0, Math.cos(p * Math.PI / 2));
          if (ck === 'high') cy = DIVE_H * 0.85 * Math.max(0, Math.cos(p * Math.PI / 2));
          r.objs.push({ t: 'coin', lane: cl - 1, z: cz, y: cy });
        }
      }
    }

    // power-ups
    if (!nearRing && Math.random() < 0.05) {
      var free = [0, 1, 2].filter(function (li) { return !lanes[li]; });
      if (free.length) {
        var pl = free[Math.floor(Math.random() * free.length)];
        var types = ['magnet', 'shield', 'double'];
        r.objs.push({ t: 'power', type: types[Math.floor(Math.random() * 3)], lane: pl - 1, z: z + 4, y: 0 });
      }
    }
  }

  function spawnAhead() {
    var r = run;
    while (r.nextRow < r.dist + FAR) {
      spawnRow(r.nextRow);
      r.nextRow += lerp(24, 13, difficulty(r.nextRow)) + rand(-2, 3);
    }
    while (r.nextRing < r.dist + FAR) {
      r.objs.push({ t: 'ring', z: r.nextRing, to: zoneAt(r.nextRing + 1) });
      r.nextRing += ZONE_LEN;
    }
  }

  // ---- input --------------------------------------------------------------

  function act(dir) {
    if (state !== 'play') return;
    var r = run;
    if (dir === 'left' || dir === 'right') {
      var nl = clamp(r.lane + (dir === 'left' ? -1 : 1), -1, 1);
      if (nl !== r.lane) { r.lane = nl; A.whoosh(); }
    } else if (dir === 'up') {
      if (!r.act || r.act.kind === 'dive') r.act = { kind: 'rise', t: 0 };
    } else if (dir === 'down') {
      if (!r.act || r.act.kind === 'rise') r.act = { kind: 'dive', t: 0 };
    }
  }

  var touch = null;
  canvas.addEventListener('pointerdown', function (e) {
    A.unlock();
    touch = { x: e.clientX, y: e.clientY, used: false };
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!touch || touch.used) return;
    var dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
    touch.used = true;
    if (Math.abs(dx) > Math.abs(dy)) act(dx < 0 ? 'left' : 'right');
    else act(dy < 0 ? 'up' : 'down');
  });
  window.addEventListener('pointerup', function () { touch = null; });
  window.addEventListener('pointercancel', function () { touch = null; });

  var KEYS = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'up', w: 'up', W: 'up', ' ': 'up', ArrowDown: 'down', s: 'down', S: 'down' };
  window.addEventListener('keydown', function (e) {
    A.unlock();
    if (KEYS[e.key]) { e.preventDefault(); act(KEYS[e.key]); }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (state === 'play') pause(); else if (state === 'paused') resume(); }
    if (e.key === 'Enter' && state === 'menu') startGame();
  });

  // ---- update -------------------------------------------------------------

  function actionY(r, dt) {
    if (!r.act) return 0;
    r.act.t += dt;
    var p = r.act.t / MOVE_T;
    if (p >= 1) { r.act = null; return 0; }
    var h = r.act.kind === 'rise' ? RISE_H : DIVE_H;
    return h * Math.min(1, Math.sin(Math.PI * p) * 1.35);
  }

  function burst(x, y, color, n, spread) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = rand(40, spread || 220);
      particles.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rand(0.4, 0.9), max: 0.9, r: rand(2, 5), color: color });
    }
  }

  function toast(text) {
    var el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.classList.remove('show'); }, 1100);
  }

  function hit(o) {
    var r = run;
    if (r.invuln > 0) return;
    var pp = project(r.x, r.y, 0);
    if (r.shield) {
      r.shield = false; r.invuln = 1;
      o.dead = true;
      A.shieldPop();
      if (pp) burst(pp.x, pp.y, '#bfefff', 24);
      if (navigator.vibrate) navigator.vibrate(30);
      return;
    }
    A.crash();
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    if (pp) burst(pp.x, pp.y, r.zone === 'sea' ? '#a6e6ff' : '#ffffff', 30);
    state = 'dying';
    r.dieT = 0;
    flushCoins();
    updateHud();
  }

  function collect(o) {
    var r = run;
    o.dead = true;
    var v = r.double > 0 ? 2 : 1;
    r.coins += v; r.pending += v;
    r.streak = r.streakT > 0 ? r.streak + 1 : 0;
    r.streakT = 0.5;
    A.coin(r.streak);
  }

  function update(dt) {
    clock += dt;
    if (state === 'menu' || state === 'over' || state === 'paused') {
      if (state === 'menu') attractDist += dt * 10;
      updateParticles(dt);
      return;
    }
    var r = run;
    if (state === 'dying') {
      r.dieT += dt;
      r.speed *= Math.pow(0.05, dt);
      r.dist += r.speed * dt;
      updateParticles(dt);
      if (r.dieT > 0.9) showOver();
      return;
    }

    r.time += dt;
    r.speed = 16 + 22 * difficulty(r.dist);
    var step = r.speed * dt;
    r.dist += step;
    r.score += step * r.mult;

    var tx = r.lane * LANE_W;
    var prevX = r.x;
    r.x += (tx - r.x) * Math.min(1, dt * 14);
    r.tilt = clamp((r.x - prevX) / Math.max(dt, 1e-3) * 0.04, -0.5, 0.5);
    r.y = actionY(r, dt);

    r.magnet = Math.max(0, r.magnet - dt);
    r.double = Math.max(0, r.double - dt);
    r.invuln = Math.max(0, r.invuln - dt);
    r.streakT = Math.max(0, r.streakT - dt);

    var targetMix = r.zone === 'sea' ? 1 : 0;
    r.zoneMix += (targetMix - r.zoneMix) * Math.min(1, dt * 3);

    spawnAhead();

    for (var i = 0; i < r.objs.length; i++) {
      var o = r.objs[i];
      if (o.dead) continue;
      var zr = o.z - r.dist;
      if (o.t === 'ring') {
        if (zr < 0 && !o.passed) {
          o.passed = true;
          r.zone = o.to;
          r.mult += 1;
          A.splash(); A.zone(o.to === 'sea');
          var pp = project(r.x, r.y, 0);
          if (pp) burst(pp.x, pp.y, o.to === 'sea' ? '#d7f6ff' : '#ffffff', 40, 320);
          toast(o.to === 'sea' ? 'Into the sea!  x' + r.mult : 'Up to the sky!  x' + r.mult);
          if (navigator.vibrate) navigator.vibrate(20);
        }
        continue;
      }
      var ox = o.lane * LANE_W;
      if (o.t === 'coin' || o.t === 'power') {
        if (o.t === 'coin' && r.magnet > 0 && zr < 16 && zr > -1) o.pull = true;
        if (o.pull) {
          o.lane = lerp(o.lane, r.x / LANE_W, Math.min(1, dt * 10));
          o.y = lerp(o.y, r.y, Math.min(1, dt * 10));
          o.z = lerp(o.z, r.dist, Math.min(1, dt * 8));
          zr = o.z - r.dist; ox = o.lane * LANE_W;
        }
        if (Math.abs(zr) < 0.9 && Math.abs(ox - r.x) < LANE_W * 0.55 && Math.abs(o.y - r.y) < 1.1) {
          if (o.t === 'coin') collect(o);
          else {
            o.dead = true;
            A.power();
            if (o.type === 'magnet') { r.magnet = 8; toast('Magnet!'); }
            if (o.type === 'double') { r.double = 10; toast('Double coins!'); }
            if (o.type === 'shield') { r.shield = true; toast('Bubble shield!'); }
          }
        }
        continue;
      }
      // obstacle
      if (zr < 0.5 && zr > -0.5 && Math.abs(ox - r.x) < LANE_W * 0.55) {
        var blocked = o.kind === 'wall' || (o.kind === 'low' && r.y < 0.9) || (o.kind === 'high' && r.y > -0.8);
        if (blocked) { hit(o); if (state !== 'play') break; }
      }
    }
    r.objs = r.objs.filter(function (o) { return !o.dead && o.z - r.dist > -CAM_DIST; });

    // trail
    if (Math.random() < dt * 30) {
      var tp = project(r.x, r.y, 0);
      if (tp) {
        if (r.zone === 'sea') particles.push({ x: tp.x + rand(-6, 6), y: tp.y + tp.s * 0.5, vx: rand(-10, 10), vy: rand(-90, -40), life: 0.8, max: 0.8, r: rand(2, 4), color: 'bubble' });
        else particles.push({ x: tp.x + rand(-8, 8), y: tp.y + tp.s * 0.4, vx: rand(-15, 15), vy: rand(40, 90), life: 0.5, max: 0.5, r: rand(1.5, 3), color: 'rgba(255,255,255,0.8)' });
      }
    }
    updateParticles(dt);
    updateHud();
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.color !== 'bubble') p.vy += 300 * dt;
    }
  }

  // ---- rendering ----------------------------------------------------------

  function project(x, y, zr) {
    var dz = zr + CAM_DIST;
    if (dz < 0.3) return null;
    var s = F / dz;
    return { x: W / 2 + (x - cam.x) * s, y: HORIZON + (CAM_Y + cam.y - y) * s, s: s };
  }

  function drawBackground(m, dist, t) {
    // sky
    if (m < 0.999) {
      ctx.globalAlpha = 1;
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#45b6f5'); g.addColorStop(0.45, '#a8e1ff'); g.addColorStop(1, '#eaf8ff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // sun
      // sun sits low near the horizon, clear of the score and buttons
      var sunX = W * 0.72, sunY = HORIZON * 0.62, sunR = Math.min(W, H) * 0.055;
      var sg = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, sunR * 3);
      sg.addColorStop(0, 'rgba(255,244,190,0.75)'); sg.addColorStop(1, 'rgba(255,244,190,0)');
      ctx.fillStyle = sg; ctx.fillRect(sunX - sunR * 3, sunY - sunR * 3, sunR * 6, sunR * 6);
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();
      // drifting far clouds
      scenery.clouds.forEach(function (c) {
        var x = ((c.x * W * 0.7 + W * 0.5 - (t * c.v * 12) % (W * 1.6)) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * 0.3;
        var y = HORIZON * (0.15 + c.y * 0.8);
        puff(x, y, 30 * c.s, 'rgba(255,255,255,0.85)');
      });
    }
    // sea
    if (m > 0.001) {
      ctx.globalAlpha = m;
      var gs = ctx.createLinearGradient(0, 0, 0, H);
      gs.addColorStop(0, '#2b9bd6'); gs.addColorStop(0.4, '#106fa8'); gs.addColorStop(1, '#063558');
      ctx.fillStyle = gs; ctx.fillRect(0, 0, W, H);
      // surface shimmer
      ctx.strokeStyle = 'rgba(220,250,255,0.5)'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (var x = 0; x <= W; x += 12) {
        var yy = 18 + Math.sin(x * 0.03 + t * 2) * 5;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
      // light rays
      ctx.fillStyle = 'rgba(200,240,255,0.08)';
      for (var k = 0; k < 5; k++) {
        var rx = (k / 5) * W + Math.sin(t * 0.3 + k) * 30;
        ctx.beginPath();
        ctx.moveTo(rx, 0); ctx.lineTo(rx + 40, 0); ctx.lineTo(rx + 140, H); ctx.lineTo(rx + 60, H);
        ctx.fill();
      }
      scenery.bubbles.forEach(function (b) {
        var y = (((b.y - t * b.v) % 1) + 1) % 1;
        ctx.strokeStyle = 'rgba(220,250,255,0.4)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(b.x * W, y * H, b.r, 0, Math.PI * 2); ctx.stroke();
      });
    }
    ctx.globalAlpha = 1;
    drawGround(m, dist);
  }

  function puff(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.9, y + r * 0.2, r * 0.75, 0, Math.PI * 2);
    ctx.arc(x - r * 0.9, y + r * 0.25, r * 0.7, 0, Math.PI * 2);
    ctx.arc(x + r * 0.2, y - r * 0.5, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cheap repeatable noise so ground details stay put as they scroll past.
  function hash(n) { var x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }

  function drawGround(m, dist) {
    var far = project(0, GROUND_Y, FAR);
    var top = far.y;
    var gg = ctx.createLinearGradient(0, top, 0, H);
    gg.addColorStop(0, mix('#cfe9fb', '#2a6c86', m));
    gg.addColorStop(0.35, mix('#e3f3ff', '#7d8f74', m));
    gg.addColorStop(1, mix('#f4fbff', '#e2cf96', m));
    ctx.fillStyle = gg;
    ctx.fillRect(0, top, W, H - top);

    var step = 5, first = Math.floor(dist / step) + 1;
    if (m < 0.999) {
      // a sea of clouds far below, rolling toward you
      ctx.globalAlpha = 1 - m;
      for (var k = Math.floor(FAR / step); k >= -1; k--) {
        var zi = first + k, zr = zi * step - dist;
        for (var j = 0; j < 7; j++) {
          var hx = (j - 3) * 3.4 + (hash(zi * 7 + j) - 0.5) * 2.6;
          var p = project(hx, GROUND_Y - 0.4, zr);
          if (!p) continue;
          var fade = clamp((FAR - zr) / 40, 0, 1);
          var rr = p.s * (0.9 + hash(zi * 13 + j) * 0.9);
          puff(p.x, p.y + rr * 0.35, rr, 'rgba(176,206,232,' + (0.55 * fade) + ')');
          puff(p.x, p.y, rr, 'rgba(255,255,255,' + (0.9 * fade) + ')');
        }
      }
      ctx.globalAlpha = 1;
    }
    if (m > 0.001) {
      // sea floor: ripples of light, pebbles, shells and weed tufts
      ctx.globalAlpha = m;
      for (var k2 = Math.floor(FAR / step); k2 >= -1; k2--) {
        var zi2 = first + k2, zr2 = zi2 * step - dist;
        var fade2 = clamp((FAR - zr2) / 40, 0, 1);
        var a = project(-12, GROUND_Y, zr2), b = project(12, GROUND_Y, zr2 + step * 0.35);
        if (a && b) {
          ctx.fillStyle = 'rgba(255,250,215,' + (0.12 * fade2) + ')';
          ctx.beginPath();
          var wav = Math.sin(zi2 * 1.7 + clock * 0.8) * 0.8;
          ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(W / 2, a.y - (a.y - b.y) * (1.6 + wav), W - a.x + (W / 2 - a.x) * 0, a.y);
          ctx.lineTo(W - a.x, b.y); ctx.quadraticCurveTo(W / 2, b.y - (a.y - b.y) * 1.2, a.x, b.y);
          ctx.fill();
        }
        for (var j2 = 0; j2 < 5; j2++) {
          var hr = hash(zi2 * 11 + j2);
          var px = (j2 - 2) * 3 + (hash(zi2 * 5 + j2) - 0.5) * 2.5;
          var q = project(px, GROUND_Y, zr2);
          if (!q || hr > 0.7) continue;
          ctx.globalAlpha = m * fade2;
          if (hr < 0.3) {
            ctx.fillStyle = '#9c8a64';
            ctx.beginPath(); ctx.ellipse(q.x, q.y, q.s * 0.22, q.s * 0.09, 0, 0, Math.PI * 2); ctx.fill();
          } else if (hr < 0.5) {
            ctx.strokeStyle = '#3f9a63'; ctx.lineWidth = Math.max(1, q.s * 0.07); ctx.lineCap = 'round';
            ctx.beginPath();
            for (var bl = -1; bl <= 1; bl++) {
              ctx.moveTo(q.x + bl * q.s * 0.1, q.y);
              ctx.quadraticCurveTo(q.x + bl * q.s * 0.25 + Math.sin(clock * 2 + zi2) * q.s * 0.1, q.y - q.s * 0.35, q.x + bl * q.s * 0.15, q.y - q.s * 0.6);
            }
            ctx.stroke();
          } else {
            ctx.fillStyle = '#f2b7a1';
            ctx.beginPath(); ctx.arc(q.x, q.y, q.s * 0.12, Math.PI, 0); ctx.fill();
          }
        }
        ctx.globalAlpha = m;
      }
      ctx.globalAlpha = 1;
    }
    // haze at the horizon so the floor melts into the distance
    var hz = ctx.createLinearGradient(0, top - 2, 0, top + H * 0.12);
    hz.addColorStop(0, mix('#eaf6ff', '#1d7fb8', m));
    hz.addColorStop(1, m > 0.5 ? 'rgba(29,127,184,0)' : 'rgba(234,246,255,0)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, top - 2, W, H * 0.12 + 2);
    // lane guides, fading out toward the horizon
    var lg = ctx.createLinearGradient(0, top, 0, H);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(1, m > 0.5 ? 'rgba(255,245,210,0.45)' : 'rgba(120,170,215,0.45)');
    ctx.strokeStyle = lg;
    ctx.lineWidth = 2;
    [-1.5, -0.5, 0.5, 1.5].forEach(function (lx) {
      var p1 = project(lx * LANE_W, GROUND_Y, -CAM_DIST + 0.6), p2 = project(lx * LANE_W, GROUND_Y, FAR);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    });
  }

  function fogAlpha(zr) { return clamp((FAR - zr) / 30, 0, 1); }

  function drawCoin(o, zr) {
    var p = project(o.lane * LANE_W, o.y, zr);
    if (!p) return;
    var r = p.s * 0.38, w = Math.abs(Math.cos(clock * 5 + o.z * 0.3)) * r + r * 0.15;
    ctx.globalAlpha = fogAlpha(zr);
    ctx.fillStyle = '#d99400';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, w, r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffc531';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, w * 0.78, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(p.x - w * 0.25, p.y - r * 0.3, w * 0.18, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawPower(o, zr) {
    var p = project(o.lane * LANE_W, o.y + Math.sin(clock * 4) * 0.15, zr);
    if (!p) return;
    var r = p.s * 0.5;
    var col = o.type === 'magnet' ? '#e2465a' : o.type === 'shield' ? '#29a0d8' : '#8c4fe0';
    ctx.globalAlpha = fogAlpha(zr);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '900 ' + Math.round(r) + 'px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.type === 'magnet' ? 'U' : o.type === 'shield' ? 'O' : 'x2', p.x, p.y + 1);
    ctx.globalAlpha = 1;
  }

  function drawRing(o, zr) {
    var p = project(0, 0.2, zr);
    if (!p) return;
    var toSea = o.to === 'sea';
    ctx.globalAlpha = fogAlpha(zr);
    ctx.lineWidth = Math.max(2, p.s * 0.35);
    ctx.strokeStyle = toSea ? 'rgba(120,220,255,0.9)' : 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, LANE_W * 2.1 * p.s, 3.2 * p.s, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = Math.max(1, p.s * 0.12);
    ctx.strokeStyle = toSea ? 'rgba(20,110,170,0.8)' : 'rgba(255,200,80,0.9)';
    ctx.setLineDash([p.s * 0.6, p.s * 0.4]);
    ctx.lineDashOffset = -clock * p.s * 2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, LANE_W * 2.1 * p.s, 3.2 * p.s, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.font = '900 ' + Math.round(p.s * 0.9) + 'px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(toSea ? 'DIVE!' : 'LEAP!', p.x, p.y - 3.6 * p.s);
    ctx.globalAlpha = 1;
  }

  // Obstacles: "low" sits under cruising height (rise over it), "high" sits
  // above it (dive under it), "wall" fills the lane (change lanes).
  function drawObstacle(o, zr) {
    var x = o.lane * LANE_W;
    var base = project(x, 0, zr);
    if (!base) return;
    var s = base.s;
    ctx.globalAlpha = fogAlpha(zr);
    if (o.zone === 'sky') {
      if (o.kind === 'low') {
        // flock of birds below cruising height
        for (var b = 0; b < 4; b++) {
          var by = -1.0 + (b % 2) * 0.7 + Math.sin(clock * 3 + b) * 0.1;
          var bx = x + (b - 1.5) * 0.55;
          var bp = project(bx, by, zr + (b % 2) * 0.3);
          if (!bp) continue;
          var flap = Math.sin(clock * 12 + b * 2) * 0.35;
          ctx.strokeStyle = '#2b3a55'; ctx.lineWidth = Math.max(1.5, s * 0.12); ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(bp.x - s * 0.5, bp.y - s * (0.15 + flap));
          ctx.quadraticCurveTo(bp.x - s * 0.2, bp.y - s * 0.28, bp.x, bp.y);
          ctx.quadraticCurveTo(bp.x + s * 0.2, bp.y - s * 0.28, bp.x + s * 0.5, bp.y - s * (0.15 + flap));
          ctx.stroke();
        }
        // dark under-cloud so the "low" band reads clearly
        var lc = project(x, -1.6, zr);
        puff(lc.x, lc.y, s * 0.55, 'rgba(110,130,160,0.75)');
      } else if (o.kind === 'high') {
        var sc = project(x, 1.6, zr);
        puff(sc.x - s * 0.3, sc.y, s * 0.62, '#6f7f99');
        puff(sc.x + s * 0.3, sc.y - s * 0.15, s * 0.58, '#7d8da8');
        if (Math.sin(clock * 9 + o.seed * 20) > 0.6) {
          ctx.strokeStyle = '#ffe36b'; ctx.lineWidth = Math.max(2, s * 0.1);
          ctx.beginPath();
          ctx.moveTo(sc.x, sc.y + s * 0.4); ctx.lineTo(sc.x - s * 0.2, sc.y + s * 0.85);
          ctx.lineTo(sc.x + s * 0.05, sc.y + s * 0.85); ctx.lineTo(sc.x - s * 0.15, sc.y + s * 1.3);
          ctx.stroke();
        }
      } else {
        // hot-air balloon fills the lane
        var hb = project(x, 1.6, zr);
        var hue = Math.floor(o.seed * 360);
        ctx.fillStyle = 'hsl(' + hue + ',75%,58%)';
        ctx.beginPath(); ctx.ellipse(hb.x, hb.y, s * 0.95, s * 1.25, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'hsl(' + ((hue + 180) % 360) + ',75%,62%)';
        ctx.beginPath(); ctx.ellipse(hb.x, hb.y, s * 0.35, s * 1.25, 0, 0, Math.PI * 2); ctx.fill();
        var bk = project(x, -0.9, zr);
        ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.beginPath();
        ctx.moveTo(hb.x - s * 0.6, hb.y + s * 0.95); ctx.lineTo(bk.x - s * 0.3, bk.y);
        ctx.moveTo(hb.x + s * 0.6, hb.y + s * 0.95); ctx.lineTo(bk.x + s * 0.3, bk.y);
        ctx.stroke();
        ctx.fillStyle = '#9a6b3c';
        ctx.fillRect(bk.x - s * 0.35, bk.y, s * 0.7, s * 0.55);
      }
    } else {
      if (o.kind === 'low') {
        // a coral reef mound rising from the floor
        var fl = project(x, GROUND_Y, zr), tp = project(x, 0.3, zr);
        var rg = ctx.createLinearGradient(0, tp.y, 0, fl.y);
        rg.addColorStop(0, '#8a7aa8'); rg.addColorStop(1, '#4b4466');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.moveTo(fl.x - s * 1.0, fl.y);
        ctx.bezierCurveTo(fl.x - s * 1.05, tp.y + s * 0.9, fl.x - s * 0.55, tp.y + s * 0.25, fl.x - s * 0.1, tp.y + s * 0.35);
        ctx.bezierCurveTo(fl.x + s * 0.35, tp.y + s * 0.05, fl.x + s * 1.0, tp.y + s * 0.6, fl.x + s * 1.0, fl.y);
        ctx.closePath(); ctx.fill();
        // light top edge and pores
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.ellipse(fl.x - s * 0.25, tp.y + s * 0.55, s * 0.45, s * 0.14, -0.15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(30,20,50,0.35)';
        for (var pr = 0; pr < 5; pr++) {
          ctx.beginPath(); ctx.arc(fl.x + (hash(o.seed * 50 + pr) - 0.5) * s * 1.3, lerp(tp.y + s * 0.7, fl.y - s * 0.2, hash(o.seed * 90 + pr)), s * 0.06, 0, Math.PI * 2); ctx.fill();
        }
        // branching coral and a sea anemone on top
        ctx.lineCap = 'round';
        for (var cbr = -1; cbr <= 1; cbr++) {
          ctx.strokeStyle = cbr === 0 ? '#ff8a5c' : '#ff6f91';
          ctx.lineWidth = Math.max(2, s * 0.13);
          var bx0 = fl.x + cbr * s * 0.42, by0 = tp.y + s * (0.45 + Math.abs(cbr) * 0.12);
          var sway = Math.sin(clock * 2 + cbr) * s * 0.05;
          ctx.beginPath();
          ctx.moveTo(bx0, by0);
          ctx.quadraticCurveTo(bx0 + cbr * s * 0.1, by0 - s * 0.4, bx0 + sway, by0 - s * 0.7);
          ctx.moveTo(bx0 + cbr * s * 0.04, by0 - s * 0.35);
          ctx.quadraticCurveTo(bx0 + s * 0.22, by0 - s * 0.45, bx0 + s * 0.25 + sway, by0 - s * 0.6);
          ctx.stroke();
        }
        ctx.fillStyle = '#ffd166';
        for (var an = -2; an <= 2; an++) {
          ctx.beginPath(); ctx.arc(fl.x + an * s * 0.08 + s * 0.1, tp.y + s * 0.2 - Math.abs(an) * -s * 0.03, s * 0.05, 0, Math.PI * 2); ctx.fill();
        }
      } else if (o.kind === 'high') {
        // jellyfish hanging above cruising height
        for (var jf = 0; jf < 3; jf++) {
          var jp = project(x + (jf - 1) * 0.68, 1.7 + (jf % 2) * 0.45 + Math.sin(clock * 2 + jf) * 0.15, zr);
          if (!jp) continue;
          ctx.fillStyle = 'rgba(255,170,230,0.9)';
          ctx.beginPath(); ctx.arc(jp.x, jp.y, s * 0.48, Math.PI, 0); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(255,190,240,0.8)'; ctx.lineWidth = Math.max(1, s * 0.07);
          for (var tn = -2; tn <= 2; tn++) {
            ctx.beginPath();
            ctx.moveTo(jp.x + tn * s * 0.16, jp.y);
            ctx.quadraticCurveTo(jp.x + tn * s * 0.16 + Math.sin(clock * 4 + tn) * s * 0.15, jp.y + s * 0.8, jp.x + tn * s * 0.14, jp.y + s * 1.55);
            ctx.stroke();
          }
        }
      } else {
        // kelp tower fills the lane
        var kb = project(x, GROUND_Y, zr), kt = project(x, 4.2, zr);
        for (var st = -1; st <= 1; st++) {
          ctx.strokeStyle = st === 0 ? '#2f8f4e' : '#3caa5c';
          ctx.lineWidth = Math.max(3, s * 0.28);
          ctx.beginPath();
          ctx.moveTo(kb.x + st * s * 0.45, kb.y);
          var segs = 6;
          for (var sg = 1; sg <= segs; sg++) {
            var yy = lerp(kb.y, kt.y, sg / segs);
            ctx.lineTo(kb.x + st * s * 0.45 + Math.sin(clock * 2 + sg + st) * s * 0.18, yy);
          }
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(x, y, t, swim, tilt, dying) {
    var p = project(x, y, 0);
    if (!p) return;
    var g = project(x, GROUND_Y, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(g.x, g.y, p.s * 0.6, p.s * 0.15, 0, 0, Math.PI * 2); ctx.fill();
    var size = p.s * 0.95;
    if (run && run.invuln > 0 && Math.floor(clock * 16) % 2 === 0) ctx.globalAlpha = 0.45;
    var spin = dying ? run.dieT * 9 : tilt;
    C.draw(ctx, creature, p.x, p.y, size, { view: 'back', swim: swim, t: t, tilt: spin });
    ctx.globalAlpha = 1;
    if (run && run.shield) {
      ctx.strokeStyle = 'rgba(160,230,255,0.9)'; ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(160,230,255,0.18)';
      ctx.beginPath(); ctx.arc(p.x, p.y, size * 0.85, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (run && run.magnet > 0) {
      ctx.strokeStyle = 'rgba(226,70,90,' + (0.3 + 0.2 * Math.sin(clock * 10)) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, size * (1 + 0.1 * Math.sin(clock * 10)), 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawParticles() {
    particles.forEach(function (p) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      if (p.color === 'bubble') {
        ctx.strokeStyle = 'rgba(230,250,255,0.9)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    if (!run || state === 'menu') {
      var m = (Math.sin(clock * 0.25) + 1) / 2 > 0.5 ? 1 : 0;
      menuMix += (m - menuMix) * 0.02;
      cam.x = 0; cam.y = 0;
      drawBackground(menuMix, attractDist, clock);
      if (creature) drawPlayer(Math.sin(clock * 0.7) * LANE_W * 0.6, Math.sin(clock * 1.3) * 0.6, clock, menuMix > 0.5, Math.cos(clock * 0.7) * 0.15, false);
      drawParticles();
      return;
    }
    var r = run;
    cam.x += (r.x * 0.35 - cam.x) * 0.15;
    cam.y += (r.y * 0.3 - cam.y) * 0.15;
    drawBackground(r.zoneMix, r.dist, clock);

    var list = r.objs.slice().sort(function (a, b) { return b.z - a.z; });
    var drewPlayer = false;
    for (var i = 0; i < list.length; i++) {
      var o = list[i], zr = o.z - r.dist;
      if (zr > FAR) continue;
      if (!drewPlayer && zr < 0) { drawPlayer(r.x, r.y, r.time, r.zone === 'sea', r.tilt, state === 'dying'); drewPlayer = true; }
      if (o.t === 'coin') drawCoin(o, zr);
      else if (o.t === 'power') drawPower(o, zr);
      else if (o.t === 'ring') drawRing(o, zr);
      else drawObstacle(o, zr);
    }
    if (!drewPlayer) drawPlayer(r.x, r.y, r.time, r.zone === 'sea', r.tilt, state === 'dying');
    drawParticles();
  }
  var menuMix = 0;

  // ---- HUD and screens ----------------------------------------------------

  var hudCache = {};
  function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }

  function updateHud() {
    if (!run) return;
    setText('hud-score', String(Math.floor(run.score)));
    setText('hud-mult', 'x' + run.mult + (run.zone === 'sea' ? '  sea' : '  sky'));
    setText('hud-coin-n', String(run.coins));
    var pw = '';
    if (run.magnet > 0) pw += '<span class="pw magnet">magnet ' + Math.ceil(run.magnet) + '</span>';
    if (run.double > 0) pw += '<span class="pw double">x2 ' + Math.ceil(run.double) + '</span>';
    if (run.shield) pw += '<span class="pw shield">bubble</span>';
    if (hudCache.pw !== pw) { hudCache.pw = pw; $('hud-powers').innerHTML = pw; }
  }

  var panels = ['menu', 'help', 'profile', 'paused', 'over'];
  function show(id) {
    panels.forEach(function (p) { $(p).classList.toggle('hidden', p !== id); });
    $('hud').classList.toggle('hidden', !(state === 'play' || state === 'dying' || state === 'paused'));
  }

  function buildRoster() {
    roster = P.getCreatures().map(C.fromProfile).concat(wild);
    if (!roster.some(function (c) { return c.id === settings.picked; })) settings.picked = roster[0].id;
    var el = $('roster');
    el.innerHTML = '';
    roster.forEach(function (c) {
      var card = document.createElement('button');
      card.className = 'card';
      card.setAttribute('role', 'option');
      card.setAttribute('aria-selected', String(c.id === settings.picked));
      var cv = document.createElement('canvas');
      cv.width = 184; cv.height = 164;
      var cc = cv.getContext('2d');
      C.draw(cc, c, 92, 92, 92, { view: 'front', t: 0 });
      card.appendChild(cv);
      var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = c.name;
      var tag = document.createElement('div'); tag.className = 'tag'; tag.textContent = c.source === 'wild' ? 'wild' : 'yours';
      card.appendChild(nm); card.appendChild(tag);
      card.addEventListener('click', function () { settings.picked = c.id; saveSettings(); buildRoster(); });
      el.appendChild(card);
    });
    creature = roster.filter(function (c) { return c.id === settings.picked; })[0];
    var info = $('pick-info');
    info.innerHTML = '';
    if (creature.source === 'wild') {
      var txt = document.createElement('div');
      txt.textContent = creature.name + ' is wild. Befriend it to keep it in your profile.';
      var btn = document.createElement('button');
      btn.className = 'small-btn';
      btn.textContent = 'Befriend for ' + BEFRIEND_COST + ' coins';
      btn.disabled = P.getCoins() < BEFRIEND_COST;
      btn.addEventListener('click', befriend);
      info.appendChild(txt); info.appendChild(btn);
    } else {
      info.textContent = creature.name + ' is ready to dash.';
    }
  }

  function befriend() {
    var c = creature;
    if (!c || c.source !== 'wild') return;
    if (!P.spendCoins(BEFRIEND_COST, GAME_ID)) { toast('Not enough coins'); return; }
    var saved = JSON.parse(JSON.stringify(c));
    saved.id = 'ssd-' + c.seed.toString(36);
    saved.source = GAME_ID;
    P.addCreature(saved);
    wild = wild.filter(function (w) { return w.id !== c.id; });
    settings.picked = saved.id; saveSettings();
    A.power();
    refreshMenu();
  }

  function refreshMenu() {
    $('menu-coins').textContent = P.getCoins();
    $('menu-best').textContent = P.getBest(GAME_ID);
    buildRoster();
  }

  function openMenu() {
    finalizeRun();
    state = 'menu';
    run = null;
    refreshMenu();
    show('menu');
  }

  function startGame() {
    A.unlock();
    finalizeRun();
    run = newRun();
    hudCache = {};
    particles = [];
    state = 'play';
    show(null);
    updateHud();
    if (!settings.seenHelp) { settings.seenHelp = true; saveSettings(); toast(matchMedia('(pointer: coarse)').matches ? 'Swipe to dodge!' : 'Arrow keys to dodge!'); }
  }

  function pause() {
    if (state !== 'play') return;
    flushCoins();
    state = 'paused';
    show('paused');
  }
  function resume() {
    if (state !== 'paused') return;
    state = 'play';
    show(null);
    last = performance.now();
  }

  function showOver() {
    state = 'over';
    flushCoins();
    var score = Math.floor(run.score);
    var best = Math.max(P.getBest(GAME_ID), score);
    $('over-title').textContent = run.zone === 'sea' ? 'Glub!' : 'Splat!';
    $('over-score').textContent = score;
    $('over-best').textContent = best;
    $('over-coins').textContent = run.coins;
    $('over-total').textContent = P.getCoins();
    $('over-new').classList.toggle('hidden', !(score > P.getBest(GAME_ID) && score > 0));
    var cost = REVIVE_COSTS[run.revives];
    var rb = $('btn-revive');
    rb.classList.toggle('hidden', cost === undefined);
    if (cost !== undefined) {
      rb.textContent = 'Keep going (' + cost + ' coins)';
      rb.disabled = P.getCoins() < cost;
    }
    show('over');
  }

  function revive() {
    var cost = REVIVE_COSTS[run.revives];
    if (cost === undefined || !P.spendCoins(cost, GAME_ID)) return;
    run.revives++;
    run.objs = run.objs.filter(function (o) { return o.t !== 'obs' || o.z - run.dist > 35; });
    run.invuln = 2;
    run.act = null; run.y = 0;
    state = 'play';
    show(null);
    A.power();
    last = performance.now();
  }

  // ---- buttons ------------------------------------------------------------

  $('btn-play').addEventListener('click', startGame);
  $('btn-again').addEventListener('click', function () { wild = C.randomWild(3); startGame(); });
  $('btn-menu').addEventListener('click', function () { wild = C.randomWild(3); openMenu(); });
  $('btn-revive').addEventListener('click', revive);
  $('btn-pause').addEventListener('click', pause);
  $('btn-resume').addEventListener('click', resume);
  $('btn-quit').addEventListener('click', openMenu);
  $('btn-help').addEventListener('click', function () { show('help'); });
  $('btn-profile').addEventListener('click', function () {
    $('profile-code').value = P.exportCode();
    $('profile-msg').textContent = '';
    show('profile');
  });
  $('btn-copy').addEventListener('click', function () {
    var ta = $('profile-code');
    ta.select();
    var done = function () { $('profile-msg').textContent = 'Copied.'; };
    if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(done, function () { document.execCommand('copy'); done(); });
    else { document.execCommand('copy'); done(); }
  });
  $('btn-import').addEventListener('click', function () {
    try {
      P.importCode($('profile-import').value);
      $('profile-msg').textContent = 'Imported. You now have ' + P.getCoins() + ' coins.';
      $('profile-code').value = P.exportCode();
      $('profile-import').value = '';
    } catch (e) {
      $('profile-msg').textContent = "That code didn't work. Check you copied all of it.";
    }
  });
  document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', openMenu); });
  $('btn-mute').addEventListener('click', function () {
    settings.muted = !settings.muted; saveSettings();
    A.setMuted(settings.muted);
    $('btn-mute').classList.toggle('off', settings.muted);
  });
  $('btn-mute').classList.toggle('off', settings.muted);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (state === 'play') pause();
      if (state === 'over') finalizeRun();
      flushCoins();
    }
  });
  window.addEventListener('pagehide', function () { flushCoins(); });

  // Another game (or another tab) changed the profile.
  window.addEventListener('storage', function (e) {
    if (e.key === P.STORAGE_KEY) { P.load(); if (state === 'menu') refreshMenu(); }
  });

  // ---- loop ---------------------------------------------------------------

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  P.load();
  openMenu();
  requestAnimationFrame(frame);

  // Exposed for automated tests only.
  window.__ssd = {
    get state() { return state; },
    get run() { return run; },
    act: act,
    start: startGame
  };
})();
