/*
 * Wickwood: a small top-down adventure. Wick, a candle sprite, clears rooms
 * of Gloom creatures, opens the glowing gate, and goes deeper until the
 * area's boss. Weapons fire by themselves; the player moves, dashes and
 * bursts. Coins buy new weapons and skills between runs.
 *
 * World units: every room is ROOM_W x ROOM_H, scaled to fit the screen.
 * Coins and best scores go to the shared Known Quantity profile (KQProfile).
 */
(function () {
  'use strict';

  var GAME_ID = 'wickwood';
  var ROOM_W = 360, ROOM_H = 600;
  var WALL_X = 18, WALL_TOP = 78, WALL_BOT = 20;
  var GATE_Y = 52, GATE_W = 64;
  var TAU = Math.PI * 2;

  var P = window.KQProfile;
  var A = window.WWAudio;
  var D = window.WWData;
  var G = window.WWDraw;

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, DPR = 1, S = 1, OX = 0, OY = 0;

  var $ = function (id) { return document.getElementById(id); };

  // ---- settings (per device convenience only) -----------------------------

  var settings = { muted: false, seenHelp: false };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('ww.settings') || '{}')); } catch (e) { /* ignore */ }
  function saveSettings() { try { localStorage.setItem('ww.settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } }
  A.setMuted(settings.muted);

  P.load();

  // ---- layout ---------------------------------------------------------------

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    S = Math.min(W / ROOM_W, H / ROOM_H);
    OX = (W - ROOM_W * S) / 2;
    OY = (H - ROOM_H * S) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- state ------------------------------------------------------------------

  var state = 'menu';
  var run = null;
  var player = null;
  var time = 0;
  var shake = 0;
  var fade = 0, fadeDir = 0, fadeThen = null;
  var floorCache = {};

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function dist2(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function maxHp() { return 100 + 25 * D.skill('wax'); }
  function moveSpeed() { return 150 * (1 + 0.08 * D.skill('feet')); }
  function dashCooldown() { return 3.2 - 0.35 * (D.skill('dash') - 1); }
  function burstCooldown() { return 8.5 - 0.6 * D.skill('burst'); }

  // ---- floor art (cached per area) ----------------------------------------------

  function floorFor(areaIdx) {
    if (floorCache[areaIdx]) return floorCache[areaIdx];
    var area = D.AREAS[areaIdx];
    var c = document.createElement('canvas');
    var k = 2;
    c.width = ROOM_W * k; c.height = ROOM_H * k;
    var g = c.getContext('2d');
    g.scale(k, k);
    g.fillStyle = area.floor[0];
    g.fillRect(0, 0, ROOM_W, ROOM_H);
    // soft patches
    var seed = 7 + areaIdx * 31;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 70; i++) {
      g.fillStyle = area.floor[1 + (i % 2)];
      g.globalAlpha = 0.5;
      g.beginPath();
      g.ellipse(rnd() * ROOM_W, rnd() * ROOM_H, 10 + rnd() * 30, 6 + rnd() * 16, rnd() * 3, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
    // little sprigs
    for (var j = 0; j < 90; j++) {
      var x = rnd() * ROOM_W, y = rnd() * ROOM_H;
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - 5); g.moveTo(x, y); g.lineTo(x + 2, y - 6); g.stroke();
    }
    for (var m = 0; m < 14; m++) {
      g.fillStyle = 'rgba(255,240,200,0.12)';
      g.beginPath(); g.arc(rnd() * ROOM_W, rnd() * ROOM_H, 1.5 + rnd() * 2, 0, TAU); g.fill();
    }
    // walls: dark hedge of the area color
    g.fillStyle = area.wall;
    g.fillRect(0, 0, WALL_X, ROOM_H);
    g.fillRect(ROOM_W - WALL_X, 0, WALL_X, ROOM_H);
    g.fillRect(0, 0, ROOM_W, WALL_TOP - 10);
    g.fillRect(0, ROOM_H - WALL_BOT, ROOM_W, WALL_BOT);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (var b = 0; b < 40; b++) {
      g.beginPath(); g.arc(WALL_X + (rnd() - 0.5) * 8, rnd() * ROOM_H, 6 + rnd() * 8, 0, TAU); g.fill();
      g.beginPath(); g.arc(ROOM_W - WALL_X + (rnd() - 0.5) * 8, rnd() * ROOM_H, 6 + rnd() * 8, 0, TAU); g.fill();
      g.beginPath(); g.arc(rnd() * ROOM_W, WALL_TOP - 10 + (rnd() - 0.5) * 8, 6 + rnd() * 8, 0, TAU); g.fill();
    }
    g.fillStyle = area.tint; g.globalAlpha = 0.5;
    for (var lf = 0; lf < 60; lf++) {
      var side = lf % 3;
      var lx = side === 0 ? rnd() * WALL_X + 2 : side === 1 ? ROOM_W - rnd() * WALL_X - 2 : rnd() * ROOM_W;
      var ly = side === 2 ? rnd() * (WALL_TOP - 14) : rnd() * ROOM_H;
      g.beginPath(); g.ellipse(lx, ly, 5, 3, rnd() * 3, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    floorCache[areaIdx] = c;
    return c;
  }

  // ---- runs and rooms -------------------------------------------------------------

  function startRun(areaIdx) {
    var area = D.AREAS[areaIdx];
    run = {
      areaIdx: areaIdx, area: area, room: 0,
      hp: maxHp(), maxHp: maxHp(),
      coins: 0, pending: 0, kills: 0, roomsCleared: 0, bossBeaten: false, score: 0,
      weapon: D.weaponStats(D.save.equipped),
      fireCd: 0.3, dashCd: 0, burstCd: 0,
      foes: [], shots: [], spores: [], pickups: [], rocks: [], parts: [], zaps: [],
      waves: 0, waveDelay: 0, gateOpen: false, boss: null, endT: 0, coinStreak: 0, streakT: 0
    };
    player = { x: ROOM_W / 2, y: ROOM_H - 70, r: 13, face: 1, moving: false, inv: 0, dashT: 0, dx: 0, dy: -1, hurt: 0 };
    nextRoom(true);
    state = 'play';
    showOnly(null);
    $('hud').classList.remove('hidden');
    $('skills').classList.remove('hidden');
    $('btn-burst').classList.toggle('locked', D.skill('burst') < 1);
    updateHud();
  }

  function nextRoom(first) {
    run.room++;
    run.shots.length = 0; run.spores.length = 0; run.pickups.length = 0; run.parts.length = 0; run.zaps.length = 0;
    run.foes.length = 0;
    run.gateOpen = false;
    run.boss = null;
    run.isBoss = run.room > run.area.rooms;
    player.x = ROOM_W / 2; player.y = ROOM_H - 60; player.dashT = 0; player.inv = 0.6;
    if (!first) run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * 0.15));
    makeRocks();
    if (run.isBoss) {
      run.waves = 0;
      run.waveDelay = 1.6;
      toast(D.BOSSES[run.area.boss].name + '!');
      $('hud-room').textContent = run.area.short + ' boss';
    } else {
      run.waves = run.room >= 3 ? 2 : 1;
      if (run.areaIdx === 2 && run.room >= 4) run.waves = 3;
      run.waveDelay = 0.9;
      $('hud-room').textContent = run.area.short + ' ' + run.room + '/' + run.area.rooms;
      if (first) toast(run.area.name + (settings.seenHelp ? '' : '\nDrag anywhere to move'));
      else toast('Room ' + run.room);
      if (first && !settings.seenHelp) { settings.seenHelp = true; saveSettings(); }
    }
  }

  function makeRocks() {
    run.rocks.length = 0;
    var n = run.isBoss ? 2 : 3 + Math.floor(Math.random() * 3);
    var tries = 0;
    while (run.rocks.length < n && tries++ < 200) {
      var r = rand(16, 25);
      var x = rand(WALL_X + r + 20, ROOM_W - WALL_X - r - 20);
      var y = run.isBoss ? rand(ROOM_H * 0.45, ROOM_H * 0.7) : rand(WALL_TOP + 70, ROOM_H - 140);
      if (run.isBoss) x = run.rocks.length ? ROOM_W - 70 : 70;
      if (Math.abs(x - ROOM_W / 2) < 40 && (y < WALL_TOP + 110 || y > ROOM_H - 170)) continue;
      var ok = run.rocks.every(function (o) { return Math.hypot(o.x - x, o.y - y) > o.r + r + 46; });
      if (ok) run.rocks.push({ x: x, y: y, r: r, seed: Math.floor(Math.random() * 6) });
    }
  }

  function spawnWave() {
    var area = run.area;
    var count = Math.min(10, 3 + run.room + run.areaIdx + (run.waves > 1 ? 0 : 1));
    for (var i = 0; i < count; i++) spawnFoe(pick(area.foes), null, null, i * 0.12);
  }

  function spawnFoe(kind, x, y, delay) {
    var def = D.FOES[kind];
    var scale = run.area.hp * (1 + 0.08 * (run.room - 1));
    if (x == null) {
      for (var t = 0; t < 40; t++) {
        x = rand(WALL_X + 30, ROOM_W - WALL_X - 30);
        y = rand(WALL_TOP + 30, ROOM_H * 0.68);
        if (dist2({ x: x, y: y }, player) < 160 * 160) continue;
        if (run.rocks.some(function (o) { return Math.hypot(o.x - x, o.y - y) < o.r + def.r + 8; })) continue;
        break;
      }
    }
    var f = {
      kind: kind, def: def, x: x, y: y, r: def.r, hp: Math.round(def.hp * scale), maxHp: 0,
      vx: 0, vy: 0, t: Math.random() * 10, flash: 0, spawnT: 0.7 + (delay || 0),
      shootT: def.shoot ? rand(1, def.shoot) : 0, windup: 0, chargeT: 0, chargeCd: rand(1, 2.5), ang: Math.PI / 2,
      look: { x: 0, y: 0 }, kb: { x: 0, y: 0 }
    };
    f.maxHp = f.hp;
    run.foes.push(f);
    return f;
  }

  function spawnBoss() {
    var def = D.BOSSES[run.area.boss];
    run.boss = {
      kind: run.area.boss, def: def, x: ROOM_W / 2, y: WALL_TOP + 90, r: def.r,
      hp: def.hp, maxHp: def.hp, flash: 0, t: 0, move: 0, moveCd: 2, tell: 0,
      spiralT: 0, spiralA: 0, chargeT: 0, vx: 0, vy: 0, stompN: 0, stompT: 0, spawnT: 0.9, look: { x: 0, y: 0 }
    };
    A.roar();
    shake = 0.5;
  }

  // ---- input ------------------------------------------------------------------

  var keys = {};
  var stick = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false };

  canvas.addEventListener('pointerdown', function (e) {
    A.unlock();
    if (state !== 'play') return;
    if (stick.id !== null) return;
    stick.id = e.pointerId; stick.active = true;
    stick.ox = stick.x = e.clientX; stick.oy = stick.y = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerId !== stick.id) return;
    stick.x = e.clientX; stick.y = e.clientY;
    // Let the base follow the finger if it drags far, so direction changes stay quick.
    var dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy), max = 60;
    if (d > max) { stick.ox = stick.x - dx / d * max; stick.oy = stick.y - dy / d * max; }
  });
  function endStick(e) { if (e.pointerId === stick.id) { stick.id = null; stick.active = false; } }
  canvas.addEventListener('pointerup', endStick);
  canvas.addEventListener('pointercancel', endStick);
  // iOS only unlocks audio from touchend / click.
  document.addEventListener('touchend', function () { A.unlock(); }, { passive: true });
  document.addEventListener('click', function () { A.unlock(); });

  window.addEventListener('keydown', function (e) {
    A.unlock();
    keys[e.key.toLowerCase()] = true;
    if (state === 'play') {
      if (e.key === ' ') { doDash(); e.preventDefault(); }
      if (e.key === 'e' || e.key === 'E') doBurst();
    }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (state === 'play') pause(); else if (state === 'paused') resume(); }
  });
  window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });

  function bindPress(el, fn) {
    el.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); A.unlock(); fn(); });
  }
  bindPress($('btn-dash'), doDash);
  bindPress($('btn-burst'), doBurst);

  function inputVector() {
    var x = 0, y = 0;
    if (keys.a || keys.arrowleft) x -= 1;
    if (keys.d || keys.arrowright) x += 1;
    if (keys.w || keys.arrowup) y -= 1;
    if (keys.s || keys.arrowdown) y += 1;
    if (stick.active) {
      var dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy);
      if (d > 6) { var k = Math.min(1, d / 45); x = dx / d * k; y = dy / d * k; }
    }
    var m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x: x, y: y };
  }

  // ---- skills -------------------------------------------------------------------

  function doDash() {
    if (state !== 'play' || run.dashCd > 0 || run.endT) return;
    var v = inputVector();
    var m = Math.hypot(v.x, v.y);
    if (m > 0.1) { player.dx = v.x / m; player.dy = v.y / m; }
    player.dashT = 0.18;
    run.dashCd = dashCooldown();
    A.dash();
  }

  function doBurst() {
    if (state !== 'play' || D.skill('burst') < 1 || run.burstCd > 0 || run.endT) return;
    var lv = D.skill('burst');
    var radius = 90 + 10 * lv, dmg = 30 + 15 * lv;
    run.burstCd = burstCooldown();
    run.parts.push({ type: 'ring', x: player.x, y: player.y, r: 10, maxR: radius, life: 0.35, max: 0.35, color: '#ffd27a' });
    allTargets().forEach(function (f) {
      var d = Math.sqrt(dist2(f, player));
      if (d < radius + f.r) {
        var nx = (f.x - player.x) / (d || 1), ny = (f.y - player.y) / (d || 1);
        hitFoe(f, dmg, nx * 260, ny * 260);
      }
    });
    run.spores = run.spores.filter(function (s) { return dist2(s, player) > radius * radius; });
    A.burst();
    shake = 0.25;
  }

  // ---- combat -------------------------------------------------------------------

  function allTargets() {
    var list = run.foes.filter(function (f) { return f.spawnT <= 0 && f.hp > 0; });
    if (run.boss && run.boss.spawnT <= 0 && run.boss.hp > 0) list.push(run.boss);
    return list;
  }

  function nearestTarget(x, y, range, skip) {
    var best = null, bd = range * range;
    allTargets().forEach(function (f) {
      if (skip && skip.indexOf(f) >= 0) return;
      var d = (f.x - x) * (f.x - x) + (f.y - y) * (f.y - y) - f.r * f.r;
      if (d < bd) { bd = d; best = f; }
    });
    return best;
  }

  function fire() {
    var w = run.weapon;
    var tgt = nearestTarget(player.x, player.y, w.id === 'ring' ? w.range + 80 : w.range);
    if (!tgt) return false;
    var dx = tgt.x - player.x, dy = tgt.y - player.y, d = Math.hypot(dx, dy) || 1;
    var nx = dx / d, ny = dy / d;
    player.face = nx < 0 ? -1 : 1;
    var sx = player.x + nx * 10, sy = player.y - 14 + ny * 10;
    if (w.id === 'staff') {
      var hit = [tgt], from = { x: sx, y: sy }, cur = tgt;
      run.zaps.push({ x1: from.x, y1: from.y, x2: cur.x, y2: cur.y, life: 0.14 });
      hitFoe(cur, w.dmg, nx * 60, ny * 60);
      for (var i = 1; i < w.chain; i++) {
        var nxt = nearestTarget(cur.x, cur.y, 150, hit);
        if (!nxt) break;
        run.zaps.push({ x1: cur.x, y1: cur.y, x2: nxt.x, y2: nxt.y, life: 0.14 });
        hitFoe(nxt, Math.round(w.dmg * 0.8), 0, 0);
        hit.push(nxt); cur = nxt;
      }
    } else if (w.id === 'ring') {
      run.shots.push({ kind: 'ring', x: sx, y: sy, vx: nx * w.speed, vy: ny * w.speed, r: 11, dmg: w.dmg, out: true, travel: 0, range: w.range, hits: [], rot: 0, life: 4 });
    } else {
      var spd = w.speed;
      run.shots.push({ kind: w.id, x: sx, y: sy, vx: nx * spd, vy: ny * spd, r: w.id === 'bow' ? 5 : 6, dmg: w.dmg, pierce: w.pierce, hits: [], life: w.range / spd + 0.25 });
    }
    A.shoot(w.id);
    return true;
  }

  function hitFoe(f, dmg, kx, ky) {
    if (f.hp <= 0) return;
    f.hp -= dmg;
    f.flash = 0.08;
    if (f !== run.boss && f.kb) { f.kb.x += kx; f.kb.y += ky; }
    run.parts.push({ type: 'text', x: f.x + rand(-6, 6), y: f.y - f.r - 4, vx: 0, vy: -40, life: 0.6, max: 0.6, text: String(Math.round(dmg)), color: '#fff' });
    A.hit();
    if (f.hp <= 0) killFoe(f);
  }

  function killFoe(f) {
    var isBoss = f === run.boss;
    run.kills++;
    run.score += isBoss ? 500 : 10;
    for (var i = 0; i < (isBoss ? 40 : 12); i++) {
      var a = Math.random() * TAU, s = rand(40, isBoss ? 260 : 150);
      run.parts.push({ type: 'dot', x: f.x, y: f.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), max: 0.7, size: rand(2, 4), color: i % 2 ? f.def.eye : f.def.body });
    }
    var luck = 1 + 0.2 * D.skill('lucky');
    var n = isBoss ? Math.round(f.def.coins * luck) : Math.floor(f.def.coins * luck + Math.random());
    for (var c = 0; c < n; c++) dropPickup('coin', f.x, f.y);
    if (!isBoss && Math.random() < 0.06 && run.hp < run.maxHp) dropPickup('heart', f.x, f.y);
    A.pop();
    if (isBoss) {
      run.bossBeaten = true;
      run.endT = 2.4;
      run.spores.length = 0;
      run.foes.forEach(function (o) { if (o.hp > 0) { o.hp = 0; } });
      run.foes.length = 0;
      shake = 0.8;
      toast('Area cleared!');
      A.win();
    }
  }

  function dropPickup(kind, x, y) {
    var a = Math.random() * TAU, s = rand(40, 120);
    run.pickups.push({ kind: kind, x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: Math.random() * 3, magnet: false, life: 14 });
  }

  function hurtPlayer(dmg) {
    if (player.inv > 0 || player.dashT > 0 || run.endT) return;
    dmg = Math.round(dmg);
    run.hp -= dmg;
    player.inv = 0.9;
    player.hurt = 0.25;
    shake = 0.3;
    A.hurt();
    run.parts.push({ type: 'text', x: player.x, y: player.y - 30, vx: 0, vy: -40, life: 0.7, max: 0.7, text: '-' + dmg, color: '#ff8a7a' });
    if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) { /* ignore */ } }
    if (run.hp <= 0) { run.hp = 0; endRun(false); }
  }

  function shootSpore(x, y, ang, spd, color, r) {
    run.spores.push({ x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r: r || 6, color: color || '#e58cff', life: 6 });
  }

  // ---- update -----------------------------------------------------------------------

  function collideRocks(o) {
    for (var i = 0; i < run.rocks.length; i++) {
      var k = run.rocks[i];
      var dx = o.x - k.x, dy = o.y - k.y, d = Math.hypot(dx, dy), min = k.r + o.r * 0.8;
      if (d < min && d > 0.001) { o.x = k.x + dx / d * min; o.y = k.y + dy / d * min; }
    }
  }

  function clampRoom(o, bounce) {
    var minX = WALL_X + o.r, maxX = ROOM_W - WALL_X - o.r, minY = WALL_TOP + o.r * 0.5, maxY = ROOM_H - WALL_BOT - o.r;
    var hit = false;
    if (o.x < minX) { o.x = minX; if (bounce) o.vx = Math.abs(o.vx); hit = true; }
    if (o.x > maxX) { o.x = maxX; if (bounce) o.vx = -Math.abs(o.vx); hit = true; }
    if (o.y < minY) { o.y = minY; if (bounce) o.vy = Math.abs(o.vy); hit = true; }
    if (o.y > maxY) { o.y = maxY; if (bounce) o.vy = -Math.abs(o.vy); hit = true; }
    return hit;
  }

  function inRock(x, y, pad) {
    for (var i = 0; i < run.rocks.length; i++) {
      var k = run.rocks[i];
      if ((x - k.x) * (x - k.x) + (y - k.y) * (y - k.y) < (k.r + pad) * (k.r + pad)) return true;
    }
    return false;
  }

  function update(dt) {
    run.fireCd -= dt; run.dashCd -= dt; run.burstCd -= dt;
    player.inv -= dt; player.hurt -= dt;
    run.streakT -= dt; if (run.streakT <= 0) run.coinStreak = 0;

    // player movement
    var v = inputVector();
    if (player.dashT > 0) {
      player.dashT -= dt;
      player.x += player.dx * 560 * dt; player.y += player.dy * 560 * dt;
      if (Math.random() < 0.8) run.parts.push({ type: 'ghost', x: player.x, y: player.y, life: 0.2, max: 0.2, face: player.face });
    } else {
      var spd = moveSpeed();
      player.x += v.x * spd * dt; player.y += v.y * spd * dt;
    }
    player.moving = Math.hypot(v.x, v.y) > 0.1;
    if (player.moving) {
      var m = Math.hypot(v.x, v.y);
      player.dx = v.x / m; player.dy = v.y / m;
      if (Math.abs(v.x) > 0.15) player.face = v.x < 0 ? -1 : 1;
    }
    collideRocks(player);
    // let the player step into the open gate
    if (run.gateOpen && Math.abs(player.x - ROOM_W / 2) < GATE_W / 2 - 6) {
      player.x = clamp(player.x, WALL_X + player.r, ROOM_W - WALL_X - player.r);
      player.y = clamp(player.y, GATE_Y, ROOM_H - WALL_BOT - player.r);
      if (player.y < WALL_TOP - 4 && !fadeDir) {
        A.door();
        bank();
        run.roomsCleared++;
        run.score += 50;
        fadeTo(function () { nextRoom(false); });
      }
    } else {
      clampRoom(player, false);
    }

    // weapon
    if (run.fireCd <= 0 && !run.endT) {
      if (fire()) run.fireCd = 1 / run.weapon.rate; else run.fireCd = 0.05;
    }

    // waves / boss
    var aliveFoes = run.foes.length;
    if (!run.isBoss && !run.gateOpen) {
      if (aliveFoes === 0) {
        if (run.waves > 0) {
          run.waveDelay -= dt;
          if (run.waveDelay <= 0) { spawnWave(); run.waves--; run.waveDelay = 0.9; }
        } else {
          openGate();
        }
      }
    } else if (run.isBoss && !run.boss && !run.bossBeaten) {
      run.waveDelay -= dt;
      if (run.waveDelay <= 0) spawnBoss();
    }

    updateFoes(dt);
    if (run.boss) updateBoss(dt);
    updateShots(dt);
    updateSpores(dt);
    updatePickups(dt);
    updateParts(dt);

    if (run.endT) {
      run.endT -= dt;
      // pull every coin in for the celebration
      run.pickups.forEach(function (p) { p.magnet = true; });
      if (run.endT <= 0) { run.endT = 0; endRun(true); }
    }
  }

  function openGate() {
    run.gateOpen = true;
    run.pickups.forEach(function (p) { if (p.kind === 'coin') p.magnet = true; });
    A.door();
    toast('The gate is open!');
  }

  function updateFoes(dt) {
    var px = player.x, py = player.y;
    for (var i = run.foes.length - 1; i >= 0; i--) {
      var f = run.foes[i];
      if (f.hp <= 0) { run.foes.splice(i, 1); continue; }
      f.t += dt; f.flash -= dt;
      if (f.spawnT > 0) { f.spawnT -= dt; continue; }
      var dx = px - f.x, dy = py - f.y, d = Math.hypot(dx, dy) || 1;
      f.look.x = dx / d; f.look.y = dy / d;
      var def = f.def, mv = 0, ax = 0, ay = 0;
      switch (f.kind) {
        case 'mite':
          ax = dx / d + Math.sin(f.t * 2) * 0.3; ay = dy / d + Math.cos(f.t * 2.3) * 0.3; mv = def.spd;
          break;
        case 'moth':
          var side = Math.sin(f.t * 4) * 0.9;
          ax = dx / d - dy / d * side; ay = dy / d + dx / d * side; mv = def.spd;
          break;
        case 'shade':
          // keeps a little distance and fires slow orbs
          var want = d > 150 ? 1 : d < 110 ? -1 : 0;
          ax = dx / d * want + (-dy / d) * 0.5; ay = dy / d * want + (dx / d) * 0.5; mv = def.spd;
          break;
        case 'beetle':
          if (f.chargeT > 0) {
            f.chargeT -= dt;
            f.x += Math.cos(f.ang) * 330 * dt; f.y += Math.sin(f.ang) * 330 * dt;
            if (clampRoom(f, false) || inRock(f.x, f.y, f.r * 0.6)) { f.chargeT = 0; shake = Math.max(shake, 0.12); }
          } else if (f.windup > 0) {
            f.windup -= dt;
            f.ang = Math.atan2(dy, dx);
            if (f.windup <= 0) f.chargeT = 0.65;
          } else {
            f.chargeCd -= dt;
            f.ang = Math.atan2(dy, dx);
            ax = dx / d; ay = dy / d; mv = def.spd;
            if (f.chargeCd <= 0 && d < 280) { f.windup = 0.6; f.chargeCd = rand(2.2, 3.2); }
          }
          break;
      }
      if (def.shoot) {
        f.shootT -= dt;
        f.charge = clamp(1 - f.shootT / 0.6, 0, 1);
        if (f.shootT <= 0) {
          f.shootT = def.shoot * rand(0.85, 1.15);
          if (f.kind === 'puff') {
            var n = run.areaIdx >= 1 ? 6 : 4, off = Math.random() * TAU;
            for (var s = 0; s < n; s++) shootSpore(f.x, f.y - 4, off + s / n * TAU, 110, '#e58cff');
          } else {
            var a0 = Math.atan2(dy, dx);
            [-0.25, 0, 0.25].forEach(function (o) { shootSpore(f.x, f.y, a0 + o, 120, '#c08bff', 7); });
          }
        }
      }
      if (mv) {
        var am = Math.hypot(ax, ay) || 1;
        f.x += ax / am * mv * dt; f.y += ay / am * mv * dt;
      }
      // knockback
      f.x += f.kb.x * dt; f.y += f.kb.y * dt;
      f.kb.x *= Math.pow(0.002, dt); f.kb.y *= Math.pow(0.002, dt);
      collideRocks(f);
      clampRoom(f, false);
      // keep foes from stacking on one spot
      for (var j = 0; j < i; j++) {
        var o = run.foes[j];
        var ox = f.x - o.x, oy = f.y - o.y, od = Math.hypot(ox, oy), min = f.r + o.r - 4;
        if (od < min && od > 0.01) {
          var push = (min - od) / 2;
          f.x += ox / od * push; f.y += oy / od * push; o.x -= ox / od * push; o.y -= oy / od * push;
        }
      }
      if (d < f.r + player.r * 0.8) hurtPlayer(def.dmg * run.area.dmg);
    }
  }

  function updateBoss(dt) {
    var b = run.boss, def = b.def;
    b.t += dt; b.flash -= dt;
    if (b.hp <= 0) return;
    if (b.spawnT > 0) { b.spawnT -= dt; return; }
    var dx = player.x - b.x, dy = player.y - b.y, d = Math.hypot(dx, dy) || 1;
    var angry = b.hp < b.maxHp * 0.5;

    if (b.chargeT > 0) {
      b.chargeT -= dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (clampRoom(b, true)) shake = Math.max(shake, 0.15);
    } else {
      // drift toward a spot above the player
      var tx = player.x, ty = Math.min(player.y - 170, ROOM_H * 0.45);
      if (b.kind === 'duskwing') { tx = ROOM_W / 2 + Math.sin(b.t * 0.9) * 110; ty = WALL_TOP + 110 + Math.sin(b.t * 1.7) * 40; }
      var tdx = tx - b.x, tdy = ty - b.y, td = Math.hypot(tdx, tdy);
      if (td > 4) { b.x += tdx / td * def.spd * dt; b.y += tdy / td * def.spd * dt; }
      clampRoom(b, false);
    }

    if (b.spiralT > 0) {
      b.spiralT -= dt;
      b.spiralCd = (b.spiralCd || 0) - dt;
      if (b.spiralCd <= 0) {
        b.spiralCd = angry ? 0.07 : 0.1;
        b.spiralA += 0.38;
        shootSpore(b.x, b.y, b.spiralA, 130, '#b8f2ff');
        shootSpore(b.x, b.y, b.spiralA + Math.PI, 130, '#b8f2ff');
      }
    }
    if (b.stompN > 0) {
      b.stompT -= dt;
      if (b.stompT <= 0) {
        b.stompN--; b.stompT = 0.35;
        var off = b.stompN * 0.2;
        for (var s = 0; s < 12; s++) shootSpore(b.x, b.y + b.r * 0.5, off + s / 12 * TAU, 105, '#ffd06b', 7);
        shake = Math.max(shake, 0.2);
      }
    }

    if (b.tell > 0) {
      b.tell -= dt;
      if (b.tell <= 0) doBossMove(b, def.moves[b.move % def.moves.length], dx / d, dy / d, angry);
      return;
    }
    b.moveCd -= dt;
    if (b.moveCd <= 0 && b.chargeT <= 0 && b.spiralT <= 0 && b.stompN <= 0) {
      b.tell = 0.6;
      b.move++;
    }
    if (d < b.r + player.r * 0.8) hurtPlayer(def.dmg * (run.areaIdx ? 1.2 : 1));
  }

  function doBossMove(b, move, nx, ny, angry) {
    var cd = angry ? 1.0 : 1.6;
    if (move === 'ring') {
      var n = angry ? 18 : 14, off = Math.random() * TAU;
      for (var i = 0; i < n; i++) shootSpore(b.x, b.y, off + i / n * TAU, 125, b.def.eye, 7);
      if (b.kind === 'gloomheart') setTimeout(function () {
        if (run && run.boss === b && b.hp > 0 && state === 'play') for (var j = 0; j < n; j++) shootSpore(b.x, b.y, off + (j + 0.5) / n * TAU, 105, b.def.eye, 7);
      }, 350);
      A.pop();
    } else if (move === 'summon') {
      var count = Math.max(0, Math.min(angry ? 4 : 3, 7 - run.foes.length));
      for (var k = 0; k < count; k++) {
        var a = k / Math.max(1, count) * TAU;
        spawnFoe(b.def.summon, clamp(b.x + Math.cos(a) * 70, 50, ROOM_W - 50), clamp(b.y + Math.sin(a) * 60 + 30, WALL_TOP + 30, ROOM_H - 60), 0);
      }
    } else if (move === 'charge') {
      var spd = angry ? 380 : 320;
      b.vx = nx * spd; b.vy = ny * spd; b.chargeT = 0.9;
      A.dash();
    } else if (move === 'spiral') {
      b.spiralT = angry ? 2.4 : 1.8; b.spiralA = Math.random() * TAU;
    } else if (move === 'stomp') {
      b.stompN = angry ? 4 : 3; b.stompT = 0;
    }
    b.moveCd = cd;
  }

  function updateShots(dt) {
    for (var i = run.shots.length - 1; i >= 0; i--) {
      var s = run.shots[i];
      s.life -= dt;
      if (s.kind === 'ring') {
        s.rot += dt * 14;
        if (s.out) {
          s.x += s.vx * dt; s.y += s.vy * dt;
          s.travel += Math.hypot(s.vx, s.vy) * dt;
          if (s.travel >= s.range || s.x < WALL_X || s.x > ROOM_W - WALL_X || s.y < WALL_TOP - 20 || s.y > ROOM_H - WALL_BOT) { s.out = false; s.hits = []; }
        } else {
          var dx = player.x - s.x, dy = player.y - 10 - s.y, d = Math.hypot(dx, dy) || 1;
          var sp = run.weapon.speed * 1.2;
          s.x += dx / d * sp * dt; s.y += dy / d * sp * dt;
          if (d < 16) { run.shots.splice(i, 1); continue; }
        }
        if (s.life <= 0) { run.shots.splice(i, 1); continue; }
      } else {
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.life <= 0 || s.x < WALL_X || s.x > ROOM_W - WALL_X || s.y < WALL_TOP - 30 || s.y > ROOM_H - WALL_BOT) {
          sparks(s.x, s.y, run.weapon.color, 4);
          run.shots.splice(i, 1); continue;
        }
      }
      var targets = allTargets(), dead = false;
      for (var j = 0; j < targets.length; j++) {
        var f = targets[j];
        if (s.hits.indexOf(f) >= 0) continue;
        var rr = f.r + s.r;
        if ((f.x - s.x) * (f.x - s.x) + (f.y - s.y) * (f.y - s.y) < rr * rr) {
          s.hits.push(f);
          var sl = Math.hypot(s.vx, s.vy) || 1;
          hitFoe(f, s.dmg, s.vx / sl * 90, s.vy / sl * 90);
          sparks(s.x, s.y, run.weapon.color, 3);
          if (s.kind !== 'ring') {
            if (s.pierce > 0) s.pierce--; else { dead = true; break; }
          }
        }
      }
      if (dead) run.shots.splice(i, 1);
    }
    for (var z = run.zaps.length - 1; z >= 0; z--) { run.zaps[z].life -= dt; if (run.zaps[z].life <= 0) run.zaps.splice(z, 1); }
  }

  function updateSpores(dt) {
    for (var i = run.spores.length - 1; i >= 0; i--) {
      var s = run.spores[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0 || s.x < WALL_X - 4 || s.x > ROOM_W - WALL_X + 4 || s.y < WALL_TOP - 30 || s.y > ROOM_H - WALL_BOT + 4 || inRock(s.x, s.y, 0)) {
        run.spores.splice(i, 1); continue;
      }
      var rr = s.r + player.r * 0.65;
      if (dist2(s, { x: player.x, y: player.y - 6 }) < rr * rr && player.inv <= 0 && player.dashT <= 0) {
        hurtPlayer(9 * run.area.dmg);
        run.spores.splice(i, 1);
      }
    }
  }

  function updatePickups(dt) {
    for (var i = run.pickups.length - 1; i >= 0; i--) {
      var p = run.pickups[i];
      p.t += dt;
      var dx = player.x - p.x, dy = player.y - p.y, d = Math.hypot(dx, dy) || 1;
      if (d < 70) p.magnet = true;
      if (p.magnet) {
        var sp = 420;
        p.vx += dx / d * sp * dt * 6; p.vy += dy / d * sp * dt * 6;
        var vm = Math.hypot(p.vx, p.vy);
        if (vm > sp) { p.vx *= sp / vm; p.vy *= sp / vm; }
      } else {
        p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt);
        p.life -= dt;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (!p.magnet) {
        p.r = 5;
        clampRoom(p, true);
      }
      if (d < player.r + 8) {
        if (p.kind === 'coin') {
          run.coins++; run.pending++;
          A.coin(run.coinStreak++); run.streakT = 0.6;
        } else {
          var heal = Math.round(run.maxHp * 0.2);
          run.hp = Math.min(run.maxHp, run.hp + heal);
          A.heal();
          run.parts.push({ type: 'text', x: player.x, y: player.y - 30, vx: 0, vy: -40, life: 0.8, max: 0.8, text: '+' + heal, color: '#8cff9a' });
        }
        run.pickups.splice(i, 1);
        continue;
      }
      if (p.life <= 0) run.pickups.splice(i, 1);
    }
  }

  function sparks(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, s = rand(30, 110);
      run.parts.push({ type: 'dot', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25, max: 0.25, size: 2, color: color });
    }
  }

  function updateParts(dt) {
    for (var i = run.parts.length - 1; i >= 0; i--) {
      var p = run.parts[i];
      p.life -= dt;
      if (p.life <= 0) { run.parts.splice(i, 1); continue; }
      if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; }
      if (p.type === 'dot') { p.vx *= Math.pow(0.05, dt); p.vy *= Math.pow(0.05, dt); }
      if (p.type === 'ring') p.r = p.maxR * (1 - p.life / p.max);
    }
  }

  // ---- render ----------------------------------------------------------------------

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#0b1218';
    ctx.fillRect(0, 0, W, H);

    var sx = 0, sy = 0;
    if (shake > 0) { sx = rand(-1, 1) * shake * 10; sy = rand(-1, 1) * shake * 10; }
    ctx.setTransform(DPR * S, 0, 0, DPR * S, DPR * (OX + sx), DPR * (OY + sy));

    if (!run) { renderMenuScene(); return; }

    var area = run.area;
    ctx.drawImage(floorFor(run.areaIdx), 0, 0, ROOM_W, ROOM_H);
    G.gate(ctx, ROOM_W / 2, GATE_Y, GATE_W, run.gateOpen, time, area);

    // things sorted by depth
    var list = [];
    run.rocks.forEach(function (k) { list.push({ y: k.y, fn: function () { G.rock(ctx, k.x, k.y, k.r, k.seed, area); } }); });
    run.pickups.forEach(function (p) { list.push({ y: p.y - 20, fn: function () { drawPickup(p); } }); });
    run.foes.forEach(function (f) { list.push({ y: f.y, fn: function () { drawFoe(f, false); } }); });
    if (run.boss && run.boss.hp > 0) list.push({ y: run.boss.y, fn: function () { drawBoss(false); } });
    list.push({ y: player.y, fn: drawPlayer });
    run.parts.forEach(function (p) { if (p.type === 'ghost') list.push({ y: p.y - 1, fn: function () { ctx.globalAlpha = p.life / p.max * 0.4; G.wick(ctx, p.x, p.y - 6, player.r, time, { face: p.face }); ctx.globalAlpha = 1; } }); });
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (o) { o.fn(); });

    // the lantern light: everything far from Wick is dim
    var lr = 230;
    var g = ctx.createRadialGradient(player.x, player.y - 10, 40, player.x, player.y - 10, lr);
    g.addColorStop(0, 'rgba(255,190,90,0.06)');
    g.addColorStop(0.5, 'rgba(6,10,20,0.2)');
    g.addColorStop(1, 'rgba(6,10,20,0.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ROOM_W, ROOM_H);
    if (run.gateOpen) {
      var gg = ctx.createRadialGradient(ROOM_W / 2, GATE_Y + 10, 5, ROOM_W / 2, GATE_Y + 10, 90);
      gg.addColorStop(0, 'rgba(255,220,140,0.45)'); gg.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = gg; ctx.fillRect(ROOM_W / 2 - 90, GATE_Y - 80, 180, 180);
    }

    // things that should always read clearly in the dark
    run.foes.forEach(function (f) { drawFoe(f, true); });
    if (run.boss && run.boss.hp > 0) drawBoss(true);
    run.pickups.forEach(function (p) { if (p.kind === 'coin') { ctx.globalAlpha = 0.5; G.coin(ctx, p.x, p.y - 4 + Math.sin(p.t * 5) * 2, 4.5, p.t); ctx.globalAlpha = 1; } });

    // Gloom spores: dark spiky balls with a glowing rim, so they never look
    // like the gold coins lying around.
    run.spores.forEach(function (s) {
      var spin = time * 4 + s.x * 0.05;
      ctx.shadowColor = s.color; ctx.shadowBlur = 10;
      ctx.fillStyle = '#24162f';
      ctx.beginPath();
      for (var k = 0; k < 16; k++) {
        var rr = k % 2 ? s.r * 1.0 : s.r * 1.35, a = spin + k * TAU / 16;
        ctx.lineTo(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = s.color; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.4, 0, TAU); ctx.fill();
    });
    run.shots.forEach(drawShot);
    run.zaps.forEach(function (z) {
      ctx.strokeStyle = 'rgba(200,240,255,' + (z.life / 0.14) + ')'; ctx.lineWidth = 2.5;
      ctx.shadowColor = '#8fd6ff'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(z.x1, z.y1);
      var steps = 5;
      for (var i = 1; i < steps; i++) {
        var k = i / steps;
        ctx.lineTo(z.x1 + (z.x2 - z.x1) * k + rand(-7, 7), z.y1 + (z.y2 - z.y1) * k + rand(-7, 7));
      }
      ctx.lineTo(z.x2, z.y2); ctx.stroke();
      ctx.shadowBlur = 0;
    });
    run.parts.forEach(function (p) {
      var a = Math.max(0, p.life / p.max);
      if (p.type === 'dot') {
        ctx.globalAlpha = a; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
      } else if (p.type === 'text') {
        ctx.globalAlpha = a; ctx.fillStyle = p.color;
        ctx.font = '900 14px "Trebuchet MS", system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
        ctx.strokeText(p.text, p.x, p.y); ctx.fillText(p.text, p.x, p.y);
      } else if (p.type === 'ring') {
        ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = 8 * a + 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    if (run.boss && run.boss.hp > 0) drawBossBar();

    // fade between rooms
    if (fade > 0) { ctx.fillStyle = 'rgba(8,10,16,' + fade + ')'; ctx.fillRect(-OX / S - 20, -OY / S - 20, W / S + 40, H / S + 40); }

    // joystick
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (stick.active && state === 'play') {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(stick.ox, stick.oy, 50, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      var kx = stick.x - stick.ox, ky = stick.y - stick.oy, kd = Math.hypot(kx, ky), km = Math.min(kd, 45);
      if (kd > 0) { kx = kx / kd * km; ky = ky / kd * km; }
      ctx.beginPath(); ctx.arc(stick.ox + kx, stick.oy + ky, 22, 0, TAU); ctx.fill();
    }
  }

  function drawPlayer() {
    var blink = player.inv > 0 && player.dashT <= 0 && Math.floor(time * 20) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.5;
    G.wick(ctx, player.x, player.y - 6, player.r, time, { face: player.face, moving: player.moving, hurt: player.hurt > 0 });
    ctx.globalAlpha = 1;
  }

  function drawFoe(f, eyesOnly) {
    if (f.spawnT > 0) {
      if (eyesOnly) return;
      // gathering wisps where something is about to appear
      var k = 1 - Math.min(1, f.spawnT / 0.7);
      ctx.strokeStyle = 'rgba(190,150,255,' + (0.3 + k * 0.5) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (2 - k), time * 4, time * 4 + 4); ctx.stroke();
      ctx.globalAlpha = k * 0.6;
      G.foe(ctx, f.kind, f.x, f.y, f.r * k, time, f, false);
      ctx.globalAlpha = 1;
      return;
    }
    G.foe(ctx, f.kind, f.x, f.y, f.r, f.t, f, eyesOnly);
    if (!eyesOnly && f.hp < f.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(f.x - f.r, f.y + f.r + 4, f.r * 2, 3);
      ctx.fillStyle = '#ff6a6a'; ctx.fillRect(f.x - f.r, f.y + f.r + 4, f.r * 2 * f.hp / f.maxHp, 3);
    }
  }

  function drawBoss(eyesOnly) {
    var b = run.boss;
    if (b.spawnT > 0) {
      if (eyesOnly) return;
      ctx.globalAlpha = 1 - b.spawnT / 0.9;
    }
    G.boss(ctx, b.kind, b.x, b.y, b.r, b.t, b, eyesOnly);
    ctx.globalAlpha = 1;
    if (!eyesOnly && b.tell > 0) {
      ctx.strokeStyle = 'rgba(255,90,90,' + (0.4 + 0.4 * Math.sin(time * 30)) + ')'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 10, 0, TAU); ctx.stroke();
    }
  }

  function drawBossBar() {
    var b = run.boss, w = ROOM_W - 80, x = 40, y = WALL_TOP + 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(x - 4, y - 18, w + 8, 34, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '800 12px "Trebuchet MS", system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(b.def.name, ROOM_W / 2, y - 4);
    ctx.fillStyle = '#3a2030'; ctx.fillRect(x, y + 2, w, 8);
    ctx.fillStyle = b.def.eye; ctx.fillRect(x, y + 2, w * Math.max(0, b.hp) / b.maxHp, 8);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  }

  function drawPickup(p) {
    var bob = Math.sin(p.t * 5) * 2;
    if (p.life < 3 && !p.magnet && Math.floor(p.t * 8) % 2) return;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, 4, 1.5, 0, 0, TAU); ctx.fill();
    if (p.kind === 'coin') G.coin(ctx, p.x, p.y - 4 + bob, 4.5, p.t);
    else G.heart(ctx, p.x, p.y - 6 + bob, 9);
  }

  function drawShot(s) {
    var c = run.weapon.color;
    if (s.kind === 'ring') { G.ringShape(ctx, s.x, s.y, s.r, s.rot, c); return; }
    var a = Math.atan2(s.vy, s.vx);
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(a);
    if (s.kind === 'bow') {
      ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(4, 0); ctx.stroke();
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(1, -4); ctx.lineTo(1, 4); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,140,60,0.35)';
      ctx.beginPath(); ctx.ellipse(-6, 0, 10, 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(0, 0, s.r * 0.8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff3c9'; ctx.beginPath(); ctx.arc(1, -1, s.r * 0.35, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  // The camp scene behind the menus: Wick by a little fire in the first area.
  function renderMenuScene() {
    ctx.drawImage(floorFor(Math.min(D.save.cleared, D.AREAS.length - 1)), 0, 0, ROOM_W, ROOM_H);
    var cx = ROOM_W / 2, cy = ROOM_H * 0.86;
    ctx.fillStyle = '#5a3d26';
    ctx.save(); ctx.translate(cx, cy + 8); ctx.rotate(0.4); ctx.fillRect(-18, -3, 36, 6); ctx.rotate(-0.8); ctx.fillRect(-18, -3, 36, 6); ctx.restore();
    G.flame(ctx, cx, cy + 4, 12, time);
    var g = ctx.createRadialGradient(cx, cy, 20, cx, cy, 300);
    g.addColorStop(0, 'rgba(255,170,80,0.15)'); g.addColorStop(0.4, 'rgba(6,10,20,0.45)'); g.addColorStop(1, 'rgba(6,10,20,0.8)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, ROOM_W, ROOM_H);
    for (var i = 0; i < 18; i++) {
      var x = (i * 71 + Math.sin(time * 0.3 + i) * 30) % ROOM_W, y = ROOM_H - ((time * (8 + i % 5 * 3) + i * 97) % ROOM_H);
      ctx.fillStyle = 'rgba(255,220,140,' + (0.25 + 0.25 * Math.sin(time * 2 + i)) + ')';
      ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3) * 0.5, 0, TAU); ctx.fill();
    }
  }

  // ---- flow -------------------------------------------------------------------------

  function fadeTo(fn) { fadeDir = 1; fadeThen = fn; }

  function bank() {
    if (run && run.pending > 0) { P.addCoins(run.pending, GAME_ID); run.pending = 0; }
  }

  function endRun(won) {
    if (state !== 'play') return;
    bank();
    if (won) {
      run.roomsCleared++;
      D.save.cleared = Math.max(D.save.cleared, run.areaIdx + 1);
      D.persist();
    } else {
      A.lose();
    }
    var res = P.submitScore(GAME_ID, run.score);
    state = 'result';
    stick.id = null; stick.active = false;
    $('skills').classList.add('hidden');
    var title = won ? run.area.name + ' is lit!' : 'The Gloom got you';
    var sub;
    if (won) sub = run.areaIdx + 1 < D.AREAS.length ? D.AREAS[run.areaIdx + 1].name + ' is open now.' : 'You lit up the whole of Wickwood. The Gloom is gone, for now.';
    else sub = 'Made it to ' + (run.isBoss ? 'the boss' : 'room ' + run.room) + '. Your coins are safe, so grab an upgrade and try again.';
    setTimeout(function () {
      $('result-title').textContent = title;
      $('result-sub').textContent = sub;
      $('result-score').textContent = run.score;
      $('result-coins').textContent = run.coins;
      $('result-best').classList.toggle('hidden', !res.isNew || run.score <= 0);
      $('btn-again').textContent = won ? (run.areaIdx + 1 < D.AREAS.length ? 'Next area' : 'Play again') : 'Try again';
      showOnly('result');
    }, won ? 200 : 700);
  }

  function quitToCamp() {
    if (run && state !== 'result') {
      bank();
      if (run.score > 0) P.submitScore(GAME_ID, run.score);
    }
    run = null;
    state = 'menu';
    $('hud').classList.add('hidden');
    $('skills').classList.add('hidden');
    refreshMenu();
    showOnly('menu');
  }

  function pause() {
    if (state !== 'play') return;
    state = 'paused';
    stick.id = null; stick.active = false;
    showOnly('paused');
  }
  function resume() {
    if (state !== 'paused') return;
    state = 'play';
    showOnly(null);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { pause(); bank(); }
  });

  // ---- HUD and panels ---------------------------------------------------------------

  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = '';
    msg.split('\n').forEach(function (line, i) {
      var d = document.createElement('div');
      d.textContent = line;
      if (i) d.style.fontSize = '18px';
      el.appendChild(d);
    });
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1600);
  }

  var lastHud = '';
  function updateHud() {
    if (!run) return;
    var hp = Math.max(0, Math.ceil(run.hp));
    var coins = P.getCoins() + run.pending;
    var key = hp + '|' + run.maxHp + '|' + coins;
    if (key !== lastHud) {
      lastHud = key;
      $('hp-fill').style.width = (100 * hp / run.maxHp) + '%';
      $('hp-text').textContent = hp + ' / ' + run.maxHp;
      $('hud-coin-n').textContent = coins;
    }
    $('btn-dash').style.setProperty('--cd', Math.max(0, run.dashCd / dashCooldown()).toFixed(3));
    if (D.skill('burst')) $('btn-burst').style.setProperty('--cd', Math.max(0, run.burstCd / burstCooldown()).toFixed(3));
  }

  var PANELS = ['menu', 'upgrades', 'help', 'profile', 'paused', 'result'];
  function showOnly(id) {
    PANELS.forEach(function (p) { $(p).classList.toggle('hidden', p !== id); });
  }

  function refreshMenu() {
    P.load();
    $('menu-coins').textContent = P.getCoins();
    $('menu-best').textContent = P.getBest(GAME_ID);
    var box = $('areas');
    box.textContent = '';
    D.AREAS.forEach(function (a, i) {
      var b = document.createElement('button');
      b.className = 'area';
      b.style.background = 'linear-gradient(135deg, ' + a.tint + ', ' + a.wall + ')';
      var locked = i > D.save.cleared;
      b.disabled = locked;
      b.innerHTML = '<span class="num"></span><span><div class="nm"></div><div class="ds"></div></span><span class="chk"></span>';
      b.querySelector('.num').textContent = i + 1;
      b.querySelector('.nm').textContent = a.name;
      b.querySelector('.ds').textContent = locked ? 'Beat ' + D.AREAS[i - 1].name + ' to open' : a.blurb;
      b.querySelector('.chk').textContent = locked ? '🔒' : i < D.save.cleared ? '★' : '▶';
      b.addEventListener('click', function () { A.unlock(); startRun(i); });
      box.appendChild(b);
    });
  }

  // ---- forge & skills shop -----------------------------------------------------------

  var shopTab = 'weapons';

  function refreshShop() {
    P.load();
    $('up-coins').textContent = P.getCoins();
    document.querySelectorAll('.tab').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.tab === shopTab)); });
    var list = $('up-list');
    list.textContent = '';
    var items = shopTab === 'weapons' ? D.WEAPONS : D.SKILLS;
    items.forEach(function (it) {
      var isW = shopTab === 'weapons';
      var lv = isW ? (D.save.weapons[it.id] || 0) : D.skill(it.id);
      var row = document.createElement('div');
      row.className = 'item' + (isW && D.save.equipped === it.id ? ' equipped' : '');
      var cv = document.createElement('canvas');
      cv.width = 104; cv.height = 104;
      var c2 = cv.getContext('2d'); c2.scale(2, 2);
      if (isW) G.weaponIcon(c2, it.id, 52, it.color); else G.skillIcon(c2, it.id, 52, it.color);
      row.appendChild(cv);
      var info = document.createElement('div');
      info.className = 'info';
      var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = it.name; info.appendChild(nm);
      var lvl = document.createElement('div'); lvl.className = 'lv';
      lvl.textContent = lv ? 'Level ' + lv + ' / ' + D.MAX_LEVEL : 'Not owned';
      info.appendChild(lvl);
      var ds = document.createElement('div'); ds.className = 'ds';
      ds.textContent = KQI18n.t(it.desc) + ' ' + KQI18n.t(isW ? weaponLine(it.id, lv) : it.stat(Math.max(1, lv)));
      info.appendChild(ds);
      row.appendChild(info);
      var acts = document.createElement('div'); acts.className = 'acts';
      if (!lv) {
        acts.appendChild(shopButton('Buy', it.price, function () {
          if (isW) { D.save.weapons[it.id] = 1; D.save.equipped = it.id; } else D.save.skills[it.id] = 1;
        }));
      } else if (lv < D.MAX_LEVEL) {
        var cost = D.upgradeCost(it.price, lv);
        acts.appendChild(shopButton('Upgrade', cost, function () {
          if (isW) D.save.weapons[it.id] = lv + 1; else D.save.skills[it.id] = lv + 1;
        }));
      } else {
        var mx = document.createElement('button'); mx.className = 'small-btn'; mx.disabled = true; mx.textContent = 'Max'; acts.appendChild(mx);
      }
      if (isW && lv && D.save.equipped !== it.id) {
        var eq = document.createElement('button'); eq.className = 'small-btn'; eq.textContent = 'Equip';
        eq.addEventListener('click', function () { D.save.equipped = it.id; D.persist(); A.buy(); refreshShop(); });
        acts.appendChild(eq);
      } else if (isW && lv) {
        var on = document.createElement('div'); on.className = 'lv'; on.style.textAlign = 'center'; on.textContent = 'Equipped'; acts.appendChild(on);
      }
      row.appendChild(acts);
      list.appendChild(row);
    });
  }

  function weaponLine(id, lv) {
    var s = D.weaponStats(id, Math.max(1, lv));
    var line = 'Damage ' + Math.round(s.dmg) + ', ' + s.rate.toFixed(1) + ' shots/s';
    if (id === 'bow') line += ', pierces ' + s.pierce;
    if (id === 'staff') line += ', hits ' + s.chain;
    return line + '.';
  }

  function shopButton(verb, cost, apply) {
    var b = document.createElement('button');
    b.className = 'small-btn buy';
    b.appendChild(document.createTextNode(verb + ' '));
    var ic = document.createElement('span'); ic.className = 'coin-icon'; b.appendChild(ic);
    b.appendChild(document.createTextNode(' ' + cost));
    b.addEventListener('click', function () {
      A.unlock();
      if (P.spendCoins(cost, GAME_ID)) {
        apply();
        D.persist();
        A.buy();
        refreshShop();
      } else {
        A.nope();
        b.textContent = 'Need ' + (cost - P.getCoins()) + ' more';
        setTimeout(refreshShop, 1200);
      }
    });
    return b;
  }

  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () { shopTab = t.dataset.tab; refreshShop(); });
  });

  // ---- buttons ---------------------------------------------------------------------

  $('btn-upgrades').addEventListener('click', function () { refreshShop(); showOnly('upgrades'); });
  $('btn-help').addEventListener('click', function () { showOnly('help'); });
  $('btn-profile').addEventListener('click', function () {
    $('profile-code').value = P.exportCode();
    $('profile-import').value = '';
    $('profile-msg').textContent = '';
    showOnly('profile');
  });
  $('btn-copy').addEventListener('click', function () {
    var ta = $('profile-code');
    ta.select();
    var done = function () { $('profile-msg').textContent = 'Copied!'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, function () { document.execCommand('copy'); done(); });
    else { document.execCommand('copy'); done(); }
  });
  $('btn-import').addEventListener('click', function () {
    try {
      P.importCode($('profile-import').value);
      $('profile-code').value = P.exportCode();
      $('profile-msg').textContent = 'Imported! Coins now: ' + P.getCoins();
    } catch (e) {
      $('profile-msg').textContent = "That code didn't work. Check it was copied in full.";
    }
  });
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { refreshMenu(); showOnly('menu'); });
  });
  $('btn-pause').addEventListener('click', pause);
  $('btn-resume').addEventListener('click', resume);
  $('btn-quit').addEventListener('click', quitToCamp);
  $('btn-camp').addEventListener('click', quitToCamp);
  $('btn-again').addEventListener('click', function () {
    var won = run && run.bossBeaten;
    var next = run ? run.areaIdx + (won && run.areaIdx + 1 < D.AREAS.length ? 1 : 0) : 0;
    startRun(next);
  });
  function syncMute() { $('btn-mute').classList.toggle('off', settings.muted); }
  $('btn-mute').addEventListener('click', function () {
    settings.muted = !settings.muted; A.setMuted(settings.muted); saveSettings(); syncMute();
  });
  syncMute();
  P.onChange(function () {
    if (state === 'menu') { $('menu-coins').textContent = P.getCoins(); }
  });

  // ---- main loop -----------------------------------------------------------------------

  var portrait = $('hero-portrait').getContext('2d');
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    time += dt;
    shake = Math.max(0, shake - dt * 1.5);

    if (fadeDir) {
      fade += fadeDir * dt * 4;
      if (fade >= 1) { fade = 1; fadeDir = -1; if (fadeThen) { var fn = fadeThen; fadeThen = null; fn(); } }
      if (fade <= 0) { fade = 0; fadeDir = 0; }
    }
    if (state === 'play' && run && fadeDir !== 1) update(dt);
    if (state === 'play' || state === 'paused') updateHud();
    render();

    if (state === 'menu') {
      portrait.setTransform(1, 0, 0, 1, 0, 0);
      portrait.clearRect(0, 0, 160, 160);
      var gl = portrait.createRadialGradient(80, 70, 5, 80, 70, 75);
      gl.addColorStop(0, 'rgba(255,190,90,0.45)'); gl.addColorStop(1, 'rgba(255,190,90,0)');
      portrait.fillStyle = gl; portrait.fillRect(0, 0, 160, 160);
      G.wick(portrait, 80, 98, 38, time, { face: 1 });
    }
    requestAnimationFrame(frame);
  }

  refreshMenu();
  showOnly('menu');
  requestAnimationFrame(frame);

  // Small hook for automated smoke tests.
  window.__wickwood = {
    state: function () { return state; },
    run: function () { return run; },
    start: startRun,
    player: function () { return player; }
  };
})();
