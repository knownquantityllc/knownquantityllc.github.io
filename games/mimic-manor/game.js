/*
 * Mimic Manor: hide-and-seek in a side-view, five-floor house.
 *
 * You are Mimi, a shape-shifting blob. Each night the house rearranges itself
 * and one or more seekers come looking: Granny Gertie (lantern sight, checks
 * furniture, follows noises), Biscuit the hound (follows your scent trail,
 * fast on floors, slow on stairs) and the Hoover 3000 (sweeps whole floors).
 * Survive until sunrise; cookies are points, coins and goo.
 *
 * Controls are one finger: tap a floor to walk there, tap furniture to hide
 * in it, tap Mimi (or the Mimic button) to disguise as a prop.
 *
 * Coins and best scores go to the shared Known Quantity profile (KQProfile)
 * under the game id "mimic-manor".
 */
(function () {
  'use strict';

  var GAME_ID = 'mimic-manor';
  var P = window.KQProfile, A = window.MMAudio, ART = window.MMArt;

  // World units. The whole house is always on screen, scaled to fit.
  var WW = 400, WH = 770, FLOORS = 5, FH = 116, TOP = 120, XL = 24, XR = 376;
  var CHUTE_X = XR - 15, CHUTE_COST = 60;
  var MIMI_SPEED = 100, MIMI_STAIR = 0.85;
  var SCENT_LIFE = 8, SCENT_STEP = 0.15;
  var REVIVE_COSTS = [50, 100];
  var MAX_COOKIES = 5;

  var THEMES = [
    { name: 'Cellar', wall: '#4a4252', stripe: '#433b4b', floor: '#2e2830', spots: ['barrel', 'washer', 'crates'] },
    { name: 'Kitchen', wall: '#f1d9a8', stripe: '#ead099', floor: '#8a5a3b', spots: ['fridge', 'pantry', 'table'] },
    { name: 'Parlor', wall: '#a9d4c2', stripe: '#9dcab7', floor: '#7a4a32', spots: ['piano', 'clock', 'sofa'] },
    { name: 'Bedrooms', wall: '#d6c3ea', stripe: '#cbb6e2', floor: '#6f4a3a', spots: ['wardrobe', 'bed', 'bathtub', 'chest'] },
    { name: 'Attic', wall: '#9c7f63', stripe: '#937659', floor: '#5c4330', spots: ['trunk', 'boxes', 'wardrobe'] }
  ];

  var SEEKER_INFO = {
    granny: { name: 'Granny Gertie', text: 'Sees with her lantern and checks furniture. Watch her thought bubble. Fooled by disguises; comes running at creaks.' },
    dog: { name: 'Biscuit the hound', text: 'Follows your scent and outruns you on floors, but is hopeless on stairs. His nose sees through disguises.' },
    hoover: { name: 'Hoover 3000', text: 'Sweeps whole floors, slurping up anything in the open, disguises and cookies too. The red arrows show where it goes next.' }
  };

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, DPR = 1, S = 1, OX = 0, OY = 0;
  var $ = function (id) { return document.getElementById(id); };

  // ---- settings (per device convenience only) -------------------------------

  var settings = { muted: false, seenHelp: false, seenTut: false, bestNight: 0 };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('mm.settings') || '{}')); } catch (e) { /* ignore */ }
  function saveSettings() { try { localStorage.setItem('mm.settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } }
  A.setMuted(settings.muted);

  // ---- helpers ----------------------------------------------------------------

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function floorY(f) { return TOP + (FLOORS - f) * FH; }
  var GROUND_Y = floorY(1);
  function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(h1, h2, t) {
    var a = hexToRgb(h1), b = hexToRgb(h2);
    return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ')';
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    // Leave room for the HUD bars at top and bottom when the screen allows it.
    S = Math.min(W / WW, (H - 40) / WH);
    OX = (W - WW * S) / 2;
    OY = Math.max(0, (H - WH * S) / 2 + 6);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- house generation -------------------------------------------------------

  var house = null;

  function genHouse(night) {
    var h = { stairs: [], spots: [], portraits: [], creaks: [], windows: [] };
    var blocked = [[], [], [], [], []];
    function free(f, a, b) { return blocked[f].every(function (iv) { return b < iv[0] || a > iv[1]; }); }
    function block(f, a, b) { blocked[f].push([a, b]); }
    block(4, CHUTE_X - 16, XR); block(0, CHUTE_X - 16, XR);
    block(1, XL, XL + 26); // front door

    for (var f = 0; f < 4; f++) {
      var n = f === 1 ? 2 : f === 2 && Math.random() < 0.6 ? 2 : 1;
      var placed = 0;
      for (var k = 0; k < n; k++) {
        for (var tries = 0; tries < 60; tries++) {
          var dir = Math.random() < 0.5 ? 1 : -1;
          var xb = rand(XL + 34, XR - 50), xt = xb + dir * 64;
          if (xt < XL + 30 || xt > XR - 40) continue;
          var a = Math.min(xb, xt) - 10, b = Math.max(xb, xt) + 10;
          if (!free(f, a, b) || !free(f + 1, xt - 18, xt + 18)) continue;
          block(f, a, b); block(f + 1, xt - 18, xt + 18);
          h.stairs.push({ id: h.stairs.length, f: f, xb: xb, xt: xt, len: Math.hypot(xt - xb, FH) });
          placed++;
          break;
        }
      }
      if (!placed) {
        // Never leave a floor unreachable: fall back to a fixed spot.
        var fx = f % 2 ? XL + 60 : XR - 110;
        h.stairs.push({ id: h.stairs.length, f: f, xb: fx, xt: fx + 64, len: Math.hypot(64, FH) });
        block(f, fx - 10, fx + 74); block(f + 1, fx + 46, fx + 82);
      }
    }

    for (f = 0; f < FLOORS; f++) {
      var types = shuffle(THEMES[f].spots.slice());
      var want = f === 0 || f === 4 ? 2 : 3;
      for (var i = 0; i < types.length && want > 0; i++) {
        var sz = ART.SPOTS[types[i]];
        for (tries = 0; tries < 40; tries++) {
          var x = rand(XL + 6 + sz.w / 2, XR - 6 - sz.w / 2);
          if (!free(f, x - sz.w / 2 - 8, x + sz.w / 2 + 8)) continue;
          block(f, x - sz.w / 2 - 8, x + sz.w / 2 + 8);
          h.spots.push({ id: h.spots.length, type: types[i], f: f, x: x, w: sz.w, h: sz.h, heat: 0, open: 0, searching: null });
          want--;
          break;
        }
      }
    }

    // Creaky boards go on open floor; tattletale portraits hang on the wall.
    var nCreak = 2 + Math.min(night, 5);
    for (i = 0, tries = 0; i < nCreak && tries < 200; tries++) {
      f = randInt(0, 4);
      x = rand(XL + 20, XR - 30);
      if (!free(f, x - 10, x + 10)) continue;
      block(f, x - 10, x + 10);
      h.creaks.push({ f: f, x: x, cool: 0, shake: 0 });
      i++;
    }
    if (night >= 2) {
      var pf = shuffle([1, 2, 3]).slice(0, Math.min(3, night - 1));
      pf.forEach(function (f) {
        h.portraits.push({ f: f, x: rand(XL + 40, XR - 50), cool: 0, gasp: 0 });
      });
    }
    for (f = 1; f < FLOORS; f++) {
      var wx = [XL + 70, 200, XR - 70];
      wx.forEach(function (x) {
        var hit = h.stairs.some(function (s) { return (s.f === f || s.f + 1 === f) && Math.abs((s.f === f ? (s.xb + s.xt) / 2 : s.xt) - x) < 40; });
        var hitP = h.portraits.some(function (p) { return p.f === f && Math.abs(p.x - x) < 40; });
        if (!hit && !hitP && Math.random() < 0.7) h.windows.push({ f: f, x: x });
      });
    }
    return h;
  }

  // ---- movement and paths -----------------------------------------------------

  // Dijkstra over stair ends (and the laundry chute for Mimi). Small graph.
  function findPath(from, to, opt) {
    opt = opt || {};
    var sm = opt.stairMul || 1;
    var nodes = [{ f: from.f, x: from.x }, { f: to.f, x: to.x }], edges = [];
    house.stairs.forEach(function (s) {
      var i = nodes.length;
      nodes.push({ f: s.f, x: s.xb }, { f: s.f + 1, x: s.xt });
      edges.push({ a: i, b: i + 1, c: s.len / sm, step: { kind: 'stair', s: s, up: true } });
      edges.push({ a: i + 1, b: i, c: s.len / sm, step: { kind: 'stair', s: s, up: false } });
    });
    if (opt.chute) {
      var j = nodes.length;
      nodes.push({ f: 4, x: CHUTE_X }, { f: 0, x: CHUTE_X });
      edges.push({ a: j, b: j + 1, c: CHUTE_COST, step: { kind: 'chute' } });
    }
    var n = nodes.length, adj = [];
    for (var i = 0; i < n; i++) adj.push([]);
    edges.forEach(function (e) { adj[e.a].push(e); });
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
      if (i !== j && nodes[i].f === nodes[j].f) adj[i].push({ a: i, b: j, c: Math.abs(nodes[i].x - nodes[j].x), step: { kind: 'walk', x: nodes[j].x } });
    }
    var dist = [], prev = [], done = [];
    for (i = 0; i < n; i++) { dist.push(Infinity); prev.push(null); done.push(false); }
    dist[0] = 0;
    for (;;) {
      var u = -1;
      for (i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || !isFinite(dist[u]) || u === 1) break;
      done[u] = true;
      adj[u].forEach(function (e) {
        if (dist[u] + e.c < dist[e.b]) { dist[e.b] = dist[u] + e.c; prev[e.b] = e; }
      });
    }
    if (!isFinite(dist[1])) return [];
    var steps = [];
    for (var v = 1; v !== 0 && prev[v]; v = prev[v].a) steps.unshift(prev[v].step);
    return steps;
  }

  function currentStep(a) {
    if (a.stair) return { kind: 'stair', s: a.stair.s, up: a.stair.up };
    if (a.chute) return { kind: 'chute' };
    return null;
  }
  function setPath(a, target, opt) {
    var cur = currentStep(a);
    if (cur) { a.path = [cur]; a.pending = { target: target, opt: opt }; return; }
    a.pending = null;
    a.path = findPath({ f: a.f, x: a.x }, target, opt);
  }
  function stopAgent(a) {
    var cur = currentStep(a);
    a.path = cur ? [cur] : [];
    a.pending = null;
  }
  function afterTransit(a) {
    if (a.pending) { var p = a.pending; a.pending = null; a.path = findPath({ f: a.f, x: a.x }, p.target, p.opt); }
  }
  function moving(a) { return a.path.length > 0; }

  function moveAgent(a, dt, speed, stairMul) {
    var guard = 6;
    while (dt > 0 && a.path.length && guard--) {
      var st = a.path[0];
      if (st.kind === 'walk') {
        var d = st.x - a.x, m = speed * dt;
        if (Math.abs(d) > 0.01) a.facing = d > 0 ? 1 : -1;
        if (Math.abs(d) <= m) { a.x = st.x; dt -= Math.abs(d) / speed; a.path.shift(); }
        else { a.x += d > 0 ? m : -m; dt = 0; }
      } else if (st.kind === 'stair') {
        var s = st.s;
        if (!a.stair) a.stair = { s: s, t: st.up ? 0 : 1, up: st.up };
        a.stair.up = st.up;
        a.facing = ((s.xt - s.xb) > 0) === st.up ? 1 : -1;
        var v = speed * stairMul / s.len;
        var rem = st.up ? 1 - a.stair.t : a.stair.t;
        if (rem <= v * dt) {
          dt -= rem / v;
          a.f = st.up ? s.f + 1 : s.f; a.x = st.up ? s.xt : s.xb;
          a.stair = null; a.path.shift(); afterTransit(a);
        } else { a.stair.t += (st.up ? 1 : -1) * v * dt; dt = 0; }
      } else if (st.kind === 'chute') {
        if (!a.chute) { a.chute = { t: 0 }; if (a.onChute) a.onChute('start'); }
        a.chute.t += dt / 0.7; dt = 0;
        if (a.chute.t >= 1) {
          a.chute = null; a.f = 0; a.x = CHUTE_X; a.path.shift();
          if (a.onChute) a.onChute('end');
          afterTransit(a);
        }
      }
    }
  }

  function pos(a) {
    if (a.stair) {
      var s = a.stair.s, t = a.stair.t;
      return { x: lerp(s.xb, s.xt, t), y: lerp(floorY(s.f), floorY(s.f + 1), t) };
    }
    if (a.chute) return { x: CHUTE_X, y: lerp(floorY(4) - 30, floorY(0), a.chute.t * a.chute.t) };
    return { x: a.x, y: floorY(a.f) };
  }
  function floorOf(a) {
    if (a.stair) return a.stair.t < 0.5 ? a.stair.s.f : a.stair.s.f + 1;
    if (a.chute) return -1;
    return a.f;
  }
  function dist2(a, b) { var p = pos(a), q = pos(b); return Math.hypot(p.x - q.x, p.y - q.y); }

  // ---- run state ----------------------------------------------------------------

  var state = 'menu'; // menu | intro | play | paused | caught | dawn | over
  var run = null, mimi = null, seekers = [];
  var clock = 0;

  function rosterFor(n) {
    var r = [['granny'], ['dog'], ['hoover'], ['granny', 'dog'], ['granny', 'hoover'], ['dog', 'hoover']];
    return n <= r.length ? r[n - 1] : ['granny', 'dog', 'hoover'];
  }
  function hasBlackouts(n) { return n >= 2 && (n % 2 === 0 || n >= 5); }

  function newRun() {
    run = { night: 0, score: 0, coins: 0, coinsPaid: 0, revives: 0, streak: 0, streakT: 0 };
  }

  function makeSeeker(type, f, x) {
    return { type: type, f: f, x: x, facing: 1, path: [], stair: null, chute: null, pending: null,
      state: 'idle', t: 0, bubble: null, target: null, lastSpot: null, replan: 0, lost: 0,
      knows: false, sawHide: null, trail: -1, cc: 0, barkT: 0, afterLook: null, hurry: false, nextF: -1 };
  }

  function setupNight(n) {
    run.night = n;
    house = genHouse(n);
    run.time = 0;
    run.len = Math.min(35 + n * 5, 70);
    run.diff = n === 1 ? 0.88 : Math.min(1.45, 1 + 0.05 * (n - 1)); // night 1 is the gentle one
    run.roster = rosterFor(n);
    run.blackouts = hasBlackouts(n);
    run.dark = false; run.darkT = 0; run.nextDark = rand(9, 14);
    run.cookies = []; run.cookieT = 0.5;
    run.scent = []; run.scentId = 0; run.scentT = 0;
    run.rings = []; run.floats = [];
    run.grace = 1.6; run.ccT = 0; run.heartT = 0; run.stepT = 0;
    run.tut = !settings.seenTut && n === 1 ? 1 : 0;
    seekers = run.roster.map(function (type) {
      if (type === 'granny') return makeSeeker('granny', 1, XL + 18);
      if (type === 'dog') return makeSeeker('dog', 0, XL + 30);
      return makeSeeker('hoover', 4, XL + 30);
    });
    var mf = pick([2, 3]);
    mimi = { f: mf, x: rand(XL + 60, XR - 60), facing: 1, path: [], stair: null, chute: null, pending: null,
      mode: 'free', spot: null, goalSpot: null, goo: 100, prop: 'vase', wob: 0, eyesT: 0 };
    mimi.onChute = onMimiChute;
    for (var i = 0; i < 3; i++) spawnCookie();
  }

  // ---- cookies, scent, noise ------------------------------------------------------

  function spawnCookie() {
    for (var tries = 0; tries < 30; tries++) {
      var f = randInt(0, 4), x = rand(XL + 16, XR - 24);
      if (mimi && f === floorOf(mimi) && Math.abs(x - mimi.x) < 50) continue;
      var under = house.spots.some(function (s) { return s.f === f && Math.abs(s.x - x) < s.w / 2 + 6; });
      if (under) continue;
      run.cookies.push({ f: f, x: x, gold: Math.random() < 0.1 });
      return;
    }
  }

  function dropScent(spot) {
    if (run.roster.indexOf('dog') < 0) return;
    run.scent.push({ id: run.scentId++, f: mimi.f, x: spot ? spot.x : mimi.x, t: clock, spot: spot || null });
  }

  function makeNoise(f, x, label, color) {
    run.rings.push({ x: x, y: floorY(f) - 24, t: 0 });
    if (label) addFloat(x, floorY(f) - 52, label, color || '#ffe08a');
    seekers.forEach(function (s) { hear(s, { f: f, x: x }); });
  }

  function addFloat(x, y, text, color) { run.floats.push({ x: x, y: y, text: text, color: color || '#fff', t: 0 }); }

  function addScore(n, x, y, label) {
    run.score += n;
    if (label) addFloat(x, y, label, '#9ff5e4');
  }

  function closeCall() {
    if (run.ccT > 0) return;
    run.ccT = 3;
    var p = pos(mimi);
    addScore(25, p.x, p.y - 40, 'Close call! +25');
    A.closeCall();
  }

  // ---- Mimi --------------------------------------------------------------------

  function onMimiChute(phase) {
    if (phase === 'start') {
      A.chute();
      makeNoise(4, CHUTE_X, 'WHOOSH!', '#ffd0a0');
      run.scent.length = 0; // the chute is full of clean laundry
    } else {
      A.thud();
      makeNoise(0, CHUTE_X, 'FLUMP!', '#ffd0a0');
    }
  }

  function leaveSpot(quiet) {
    if (mimi.mode !== 'hidden') return;
    mimi.mode = 'free';
    mimi.spot = null;
    if (!quiet) A.unhide();
  }

  function hideIn(spot) {
    // Anyone looking right at you knows exactly where you went.
    seekers.forEach(function (g) {
      if (g.type === 'granny' && grannySees(g, true)) {
        g.sawHide = spot;
        if (g.state !== 'chase' && g.state !== 'alert') spotted(g);
      }
    });
    mimi.mode = 'hidden';
    mimi.spot = spot;
    mimi.x = spot.x;
    spot.heat += 1.5;
    dropScent(spot);
    A.hide();
    if (run.tut === 2) run.tut = 3;
  }

  function toggleDisguise() {
    if (state !== 'play') return;
    if (mimi.mode === 'disguised') { mimi.mode = 'free'; A.undisguise(); return; }
    if (mimi.stair || mimi.chute) return;
    if (mimi.goo < 20) { toast('Not enough goo'); return; }
    leaveSpot(true);
    stopAgent(mimi);
    mimi.goalSpot = null;
    seekers.forEach(function (g) {
      if (g.type === 'granny' && grannySees(g, true)) {
        g.knows = true;
        if (g.state !== 'chase' && g.state !== 'alert') spotted(g);
      }
    });
    mimi.mode = 'disguised';
    mimi.prop = pick(ART.PROPS);
    A.disguise();
    if (run.tut === 3) run.tut = 4;
  }

  function spotAt(wx, wy) {
    var best = null;
    house.spots.forEach(function (s) {
      var y = floorY(s.f);
      if (wx > s.x - s.w / 2 - 8 && wx < s.x + s.w / 2 + 8 && wy > y - s.h - 12 && wy < y + 6) best = s;
    });
    return best;
  }

  function floorAtY(wy) {
    for (var f = 0; f < FLOORS; f++) if (wy <= floorY(f) + 10 && wy > floorY(f) - FH + 10) return f;
    if (wy > floorY(0)) return 0;
    return -1;
  }

  function onTap(wx, wy) {
    if (state !== 'play') return;
    var mp = pos(mimi);
    if (!mimi.chute && Math.hypot(wx - mp.x, wy - (mp.y - 12)) < 22) { toggleDisguise(); return; }
    var spot = spotAt(wx, wy);
    var f = spot ? spot.f : floorAtY(wy);
    if (f < 0) return;
    var target = spot ? { f: f, x: spot.x } : { f: f, x: clamp(wx, XL + 10, XR - 10) };
    // Tapping the attic hatch rides the chute; tapping the cellar end just walks there.
    if (!spot && f === 4 && wx > CHUTE_X - 18 && floorOf(mimi) === 4) target = { f: 0, x: CHUTE_X };
    if (mimi.mode === 'hidden' && spot === mimi.spot) return;
    leaveSpot();
    if (mimi.mode === 'disguised') { mimi.mode = 'free'; A.undisguise(); }
    mimi.goalSpot = spot || null;
    setPath(mimi, target, { chute: true, stairMul: MIMI_STAIR });
    if (run.tut === 1) run.tut = 2;
  }

  function updateMimi(dt) {
    var wasMoving = moving(mimi);
    if (mimi.mode !== 'hidden' && mimi.mode !== 'disguised') moveAgent(mimi, dt, MIMI_SPEED, MIMI_STAIR);
    if (wasMoving && !moving(mimi) && mimi.goalSpot) {
      var s = mimi.goalSpot; mimi.goalSpot = null;
      if (mimi.f === s.f && Math.abs(mimi.x - s.x) < 2) hideIn(s);
    }
    var onFloor = !mimi.stair && !mimi.chute;
    if (moving(mimi)) {
      run.stepT -= dt;
      if (run.stepT <= 0) { run.stepT = 0.26; A.step(); }
      if (onFloor) {
        run.scentT -= dt;
        if (run.scentT <= 0) { run.scentT = SCENT_STEP; dropScent(null); }
      }
    }
    // goo
    // Goo is Mimi's staying-still stamina: hiding slowly burns it, disguising
    // burns it fast, and it comes back out in the open and from cookies.
    if (mimi.mode === 'disguised' || mimi.mode === 'hidden') {
      mimi.goo -= (mimi.mode === 'disguised' ? 13 : 3.5) * dt;
      if (mimi.goo <= 0) {
        mimi.goo = 0;
        var wasIn = mimi.spot;
        if (mimi.mode === 'hidden') leaveSpot(true); else mimi.mode = 'free';
        A.poof();
        var p = pos(mimi);
        addFloat(p.x, p.y - 34, 'Pop!', '#9ff5e4');
        if (wasIn) makeNoise(mimi.f, mimi.x, null);
      }
    } else {
      mimi.goo = Math.min(100, mimi.goo + 4 * dt);
    }
    if (mimi.mode === 'hidden') mimi.spot.heat += 0.25 * dt;

    if (onFloor && mimi.mode === 'free') {
      // creaky boards
      house.creaks.forEach(function (c) {
        if (c.f === mimi.f && Math.abs(c.x - mimi.x) < 9 && c.cool <= 0 && moving(mimi)) {
          c.cool = 2.2; c.shake = 0.4; A.creak(); makeNoise(c.f, c.x, 'CREAK!');
        }
      });
      // tattletale portraits (only when they can see you)
      if (!run.dark) house.portraits.forEach(function (pt) {
        if (pt.f === mimi.f && Math.abs(pt.x - mimi.x) < 16 && pt.cool <= 0) {
          pt.cool = 6; pt.gasp = 1.4; A.gasp(); makeNoise(pt.f, pt.x, 'GASP!', '#ffb3c1');
        }
      });
      // cookies
      for (var i = run.cookies.length - 1; i >= 0; i--) {
        var c = run.cookies[i];
        if (c.f === mimi.f && Math.abs(c.x - mimi.x) < 12) {
          run.cookies.splice(i, 1);
          run.streak = run.streakT > 0 ? run.streak + 1 : 0; run.streakT = 3;
          if (c.gold) { addScore(50, c.x, floorY(c.f) - 30, '+50'); run.coins += 5; mimi.goo = Math.min(100, mimi.goo + 40); A.gold(); }
          else { addScore(10, c.x, floorY(c.f) - 30, '+10'); run.coins += 1; mimi.goo = Math.min(100, mimi.goo + 15); A.cookie(run.streak); }
        }
      }
    }
  }

  // ---- seekers -----------------------------------------------------------------

  function spotted(g) {
    g.state = 'alert'; g.t = g.type === 'dog' ? 0.35 : 0.5;
    stopAgent(g);
    g.bubble = { kind: g.type === 'dog' ? 'woof' : '!', t: 1 };
    if (g.target && g.target.searching === g) g.target.searching = null;
    g.target = null;
    A.spotted();
    if (g.type === 'dog') { A.bark(); makeNoise(g.f, g.x, null); }
  }

  function hear(g, n) {
    if (run.grace > 0) return;
    if (g.type === 'hoover') return;
    if (g.state === 'chase' || g.state === 'alert' || g.state === 'scratch') return;
    var gf = floorOf(g); if (gf < 0) return;
    if (!(n.f === gf || (Math.abs(n.f - gf) === 1 && Math.abs(n.x - g.x) < 170))) return;
    if (g.target && g.target.searching === g) g.target.searching = null;
    g.target = null;
    g.bubble = { kind: '?', t: 1.2 };
    g.noise = { f: n.f, x: clamp(n.x, XL + 10, XR - 10) };
    if (g.type === 'granny') { g.state = 'investigate'; A.huh(); }
    else { g.state = 'sniff'; }
    setPath(g, g.noise, {});
  }

  function grannySees(g, raw) {
    if (mimi.chute || mimi.mode === 'hidden') return false;
    if (!raw && mimi.mode !== 'free') return false;
    var gp = pos(g), mp = pos(mimi);
    if (Math.abs(gp.y - mp.y) > 40) return false;
    var dx = mp.x - gp.x;
    if (dx * g.facing < -8) return false;
    return Math.abs(dx) < (run.dark ? 62 : 150);
  }

  function nearestSpot(f, x, maxD) {
    var best = null, bd = maxD;
    house.spots.forEach(function (s) {
      if (s.f === f && Math.abs(s.x - x) < bd && !s.searching) { bd = Math.abs(s.x - x); best = s; }
    });
    return best;
  }

  function goSearch(g, spot, hurry) {
    g.target = spot; g.hurry = !!hurry; g.state = 'patrol';
    g.bubble = { kind: 'spot', type: spot.type };
    setPath(g, { f: spot.f, x: spot.x }, {});
  }

  function chooseGrannyTarget(g) {
    var gf = floorOf(g); if (gf < 0) gf = g.f;
    if (Math.random() < 0.22) {
      g.target = null; g.state = 'patrol'; g.hurry = false;
      g.bubble = { kind: 'hum' };
      setPath(g, { f: randInt(0, 4), x: rand(XL + 20, XR - 20) }, {});
      return;
    }
    var cands = house.spots.filter(function (s) { return s !== g.lastSpot && !s.searching; });
    if (!cands.length) cands = house.spots.slice();
    var ws = cands.map(function (s) {
      return 1 + s.heat * 2.2 + (s.f === gf ? 1.6 : 0) + (Math.abs(s.f - gf) === 1 ? 0.6 : 0);
    });
    var sum = ws.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * sum;
    for (var i = 0; i < cands.length; i++) { r -= ws[i]; if (r <= 0) break; }
    goSearch(g, cands[Math.min(i, cands.length - 1)], false);
  }

  function updateGranny(g, dt) {
    var d = run.diff;
    var sees = grannySees(g);
    if (sees && g.state !== 'alert' && g.state !== 'chase') spotted(g);
    var mp = pos(mimi);
    switch (g.state) {
      case 'idle':
        chooseGrannyTarget(g);
        break;
      case 'patrol':
        moveAgent(g, dt, (g.hurry ? 82 : 52) * d, 0.8);
        if (!moving(g)) {
          if (g.target) {
            g.state = 'search'; g.t = 1.1; g.target.searching = g; g.hurry = false;
            g.bubble = null; A.open();
          } else { g.state = 'look'; g.t = 1.2; g.afterLook = null; }
        }
        // Walking past a disguised Mimi up close is a close call.
        if (mimi.mode === 'disguised' && !g.knows && dist2(g, mimi) < 30) closeCall();
        break;
      case 'search':
        g.t -= dt;
        var s = g.target;
        s.open = Math.min(1, (1.1 - g.t) / 0.3);
        if (g.t < 0.75 && mimi.mode === 'hidden' && mimi.spot === s) { caught(g, 'Gertie opened the ' + ART.SPOTS[s.type].name + '.'); return; }
        if (g.t <= 0) {
          s.searching = null; s.heat = Math.max(0, s.heat - 2); g.lastSpot = s; g.target = null;
          if (mimi.mode === 'hidden' && mimi.spot.f === s.f && Math.abs(mimi.spot.x - s.x) < 100) closeCall();
          g.bubble = { kind: 'hmm', t: 0.8 };
          g.state = 'idle';
        }
        break;
      case 'look':
        var before = g.t;
        g.t -= dt;
        if (before > 0.6 && g.t <= 0.6) g.facing = -g.facing;
        if (g.t <= 0) {
          if (g.afterLook) { goSearch(g, g.afterLook, false); g.afterLook = null; }
          else g.state = 'idle';
        }
        break;
      case 'investigate':
        moveAgent(g, dt, 68 * d, 0.85);
        if (!moving(g)) { g.state = 'look'; g.t = 1.3; g.afterLook = nearestSpot(g.f, g.x, 120); }
        break;
      case 'alert':
        g.t -= dt;
        if (!g.stair) g.facing = mp.x > g.x ? 1 : -1;
        if (g.t <= 0) { g.state = 'chase'; g.lost = 0; g.replan = 0; }
        break;
      case 'chase':
        var tracking = sees || (g.knows && mimi.mode === 'disguised');
        if (tracking) { g.lost = 0; } else g.lost += dt;
        g.replan -= dt;
        if (tracking && g.replan <= 0 && floorOf(mimi) >= 0) {
          g.replan = 0.3;
          setPath(g, { f: floorOf(mimi), x: mimi.stair ? (floorOf(mimi) === mimi.stair.s.f ? mimi.stair.s.xb : mimi.stair.s.xt) : mimi.x }, {});
        }
        moveAgent(g, dt, 84 * d, 0.85);
        if (!tracking && !moving(g)) {
          g.knows = false;
          if (g.sawHide) { var sh = g.sawHide; g.sawHide = null; goSearch(g, sh, true); }
          else { g.state = 'look'; g.t = 1.4; g.bubble = { kind: '?', t: 1.2 }; g.afterLook = nearestSpot(g.f, g.x, 120); }
        }
        break;
    }
    if (g.state === 'chase' || g.state === 'alert') {
      var close = dist2(g, mimi) < 15;
      if (close && (mimi.mode === 'free' || (mimi.mode === 'disguised' && g.knows)) && !mimi.chute) caught(g, 'Gertie grabbed you.');
    }
  }

  function scentById(id) {
    for (var i = 0; i < run.scent.length; i++) if (run.scent[i].id === id) return run.scent[i];
    return null;
  }
  function nextScent(id) {
    for (var i = 0; i < run.scent.length; i++) if (run.scent[i].id > id) return run.scent[i];
    return null;
  }

  function dogSmells(b) {
    if (mimi.chute || mimi.mode === 'hidden') return false;
    var bp = pos(b), mp = pos(mimi);
    return Math.abs(bp.y - mp.y) < 40 && Math.abs(bp.x - mp.x) < 105;
  }

  function updateDog(b, dt) {
    var d = run.diff;
    var smell = dogSmells(b);
    if (smell && b.state !== 'chase' && b.state !== 'alert') spotted(b);
    var mp = pos(mimi);
    b.barkT -= dt;
    switch (b.state) {
      case 'idle':
        b.state = 'sniff';
        break;
      case 'sniff':
        if (!moving(b)) {
          // A faint whiff of the freshest scent pulls him toward it.
          var bf = floorOf(b), fresh = run.scent[run.scent.length - 1], tf;
          if (fresh && Math.random() < 0.6) tf = fresh.f;
          else tf = Math.random() < 0.6 ? bf : clamp(bf + pick([-1, 1]), 0, 4);
          setPath(b, { f: tf, x: fresh && tf === fresh.f ? clamp(fresh.x + rand(-60, 60), XL + 20, XR - 20) : rand(XL + 20, XR - 20) }, {});
          if (Math.random() < 0.4) A.sniff();
        }
        moveAgent(b, dt, 70 * d, 0.45);
        if (!b.stair) {
          var near = null, nd = 70;
          run.scent.forEach(function (sc) { if (sc.f === b.f && Math.abs(sc.x - b.x) < nd) { nd = Math.abs(sc.x - b.x); near = sc; } });
          if (near) { b.state = 'trail'; b.trail = near.id; b.bubble = { kind: 'sniff', t: 0.8 }; setPath(b, { f: near.f, x: near.x }, {}); A.sniff(); }
        }
        break;
      case 'trail':
        var cur = scentById(b.trail);
        if (!cur) { b.state = 'sniff'; b.bubble = { kind: '?', t: 1 }; stopAgent(b); break; }
        if (!moving(b)) {
          var nx = nextScent(b.trail);
          if (nx) { b.trail = nx.id; setPath(b, { f: nx.f, x: nx.x }, {}); }
          else if (cur.spot && mimi.mode === 'hidden' && mimi.spot === cur.spot) {
            b.state = 'scratch'; b.t = 1.4; b.target = cur.spot; A.bark(); b.bubble = { kind: 'woof', t: 1.4 };
          } else b.state = 'sniff';
        }
        moveAgent(b, dt, 96 * d, 0.45);
        break;
      case 'scratch':
        b.t -= dt;
        if (b.barkT <= 0) { b.barkT = 0.45; A.bark(); makeNoise(b.f, b.x, null); }
        if (mimi.mode !== 'hidden' || mimi.spot !== b.target) { b.state = 'sniff'; break; }
        if (b.t <= 0) { caught(b, 'Biscuit sniffed you out of the ' + ART.SPOTS[b.target.type].name + '.'); return; }
        break;
      case 'alert':
        b.t -= dt;
        if (!b.stair) b.facing = mp.x > b.x ? 1 : -1;
        if (b.t <= 0) { b.state = 'chase'; b.lost = 0; b.replan = 0; }
        break;
      case 'chase':
        if (smell) b.lost = 0; else b.lost += dt;
        b.replan -= dt;
        if (smell && b.replan <= 0 && floorOf(mimi) >= 0) {
          b.replan = 0.25;
          setPath(b, { f: floorOf(mimi), x: mimi.stair ? (floorOf(mimi) === mimi.stair.s.f ? mimi.stair.s.xb : mimi.stair.s.xt) : mimi.x }, {});
        }
        if (b.barkT <= 0) { b.barkT = 0.6; A.bark(); makeNoise(floorOf(b) < 0 ? b.f : floorOf(b), pos(b).x, null); }
        moveAgent(b, dt, 106 * d, 0.45);
        if (b.lost > 1.2 || (!smell && !moving(b))) { b.state = 'sniff'; b.bubble = { kind: '?', t: 1 }; }
        break;
    }
    if (!mimi.chute && mimi.mode !== 'hidden' && dist2(b, mimi) < 14) caught(b, 'Biscuit caught up with you.');
  }

  function updateHoover(h, dt) {
    var d = run.diff;
    switch (h.state) {
      case 'idle':
      case 'pick':
        var mf = floorOf(mimi), f;
        if (mf >= 0 && mf !== h.f && Math.random() < 0.5) f = mf;
        else { do { f = randInt(0, 4); } while (f === h.f); }
        h.nextF = f; h.state = 'travel';
        var end = Math.random() < 0.5 ? XL + 16 : XR - 16;
        setPath(h, { f: f, x: end }, {});
        A.beep();
        break;
      case 'travel':
        moveAgent(h, dt, 72 * d, 0.7);
        if (!moving(h)) {
          h.state = 'sweep';
          setPath(h, { f: h.f, x: h.x < 200 ? XR - 16 : XL + 16 }, {});
        }
        break;
      case 'sweep':
        moveAgent(h, dt, 58 * d, 0.7);
        if (!moving(h)) { h.state = 'rest'; h.t = 1.2; h.nextF = -1; }
        break;
      case 'rest':
        h.t -= dt;
        if (h.t <= 0) h.state = 'pick';
        break;
    }
    if (!h.stair) {
      for (var i = run.cookies.length - 1; i >= 0; i--) {
        var c = run.cookies[i];
        if (c.f === h.f && Math.abs(c.x - h.x) < 14) { run.cookies.splice(i, 1); A.slurp(); addFloat(c.x, floorY(c.f) - 28, 'slurp', '#ffb0b0'); }
      }
      if (!mimi.stair && !mimi.chute && mimi.f === h.f && Math.abs(mimi.x - h.x) < 15) {
        if (mimi.mode === 'hidden') { if (h.cc <= 0) { h.cc = 3; closeCall(); } }
        else { caught(h, mimi.mode === 'disguised' ? 'The Hoover 3000 slurped up a very surprised vase.' : 'The Hoover 3000 slurped you up.'); }
      }
    }
    h.cc -= dt;
  }

  function caught(g, why) {
    if (state !== 'play') return;
    state = 'caught';
    run.caughtBy = g; run.caughtWhy = why; run.caughtT = 1.4;
    g.bubble = { kind: 'text', text: g.type === 'dog' ? 'WOOF!' : g.type === 'hoover' ? 'BLEEP!' : 'Gotcha!', t: 2 };
    if (mimi.mode === 'disguised') mimi.mode = 'free';
    A.caught(); A.setHum(0);
  }

  // ---- loop --------------------------------------------------------------------

  function update(dt) {
    clock += dt;
    if (state === 'caught') {
      run.caughtT -= dt;
      updateEffects(dt);
      if (run.caughtT <= 0) gameOver();
      return;
    }
    if (state === 'dawn') {
      run.dawnT -= dt;
      updateEffects(dt);
      if (run.dawnT <= 0) nextNight();
      return;
    }
    if (state !== 'play') return;

    run.time += dt;
    run.grace -= dt;
    run.ccT -= dt;
    run.streakT -= dt;

    if (run.blackouts) {
      if (run.dark) {
        run.darkT -= dt;
        if (run.darkT <= 0) { run.dark = false; run.nextDark = rand(10, 16); A.lightsOn(); }
      } else {
        run.nextDark -= dt;
        if (run.nextDark <= 0) { run.dark = true; run.darkT = 4.5; A.lightsOut(); toast('Lights out!'); }
      }
    }

    updateMimi(dt);
    if (state !== 'play') return;

    // scent fades
    while (run.scent.length && clock - run.scent[0].t > SCENT_LIFE) run.scent.shift();

    if (run.grace <= 0) {
      for (var i = 0; i < seekers.length && state === 'play'; i++) {
        var g = seekers[i];
        if (g.type === 'granny') updateGranny(g, dt);
        else if (g.type === 'dog') updateDog(g, dt);
        else updateHoover(g, dt);
      }
    }
    if (state !== 'play') return;

    run.cookieT -= dt;
    if (run.cookieT <= 0) { run.cookieT = 1.8; if (run.cookies.length < MAX_COOKIES) spawnCookie(); }

    house.creaks.forEach(function (c) { c.cool -= dt; c.shake = Math.max(0, c.shake - dt); });
    house.portraits.forEach(function (p) { p.cool -= dt; p.gasp = Math.max(0, p.gasp - dt); });
    house.spots.forEach(function (s) { if (!s.searching) s.open = Math.max(0, s.open - dt * 3); });

    // Heartbeat speeds up as a seeker gets close on your floor.
    var threat = 0, mf = floorOf(mimi);
    seekers.forEach(function (g) {
      var gf = floorOf(g);
      if (g.state === 'chase' || g.state === 'scratch') threat = Math.max(threat, 1);
      else if (gf === mf && mf >= 0) threat = Math.max(threat, 1 - Math.min(1, Math.abs(pos(g).x - pos(mimi).x) / 200));
    });
    run.heartT -= dt;
    if (threat > 0.15 && run.heartT <= 0) { run.heartT = lerp(1.0, 0.42, threat); A.heartbeat(threat); }

    var hv = seekers.filter(function (g) { return g.type === 'hoover'; })[0];
    if (hv) {
      var hf = floorOf(hv), lvl = hf === mf ? 1 - Math.min(1, Math.abs(pos(hv).x - pos(mimi).x) / 400) * 0.5 : Math.abs(hf - mf) === 1 ? 0.3 : 0.12;
      A.setHum(lvl);
    }

    updateEffects(dt);

    if (run.time >= run.len) dawn();
  }

  function updateEffects(dt) {
    run.rings.forEach(function (r) { r.t += dt; });
    run.rings = run.rings.filter(function (r) { return r.t < 0.8; });
    run.floats.forEach(function (f) { f.t += dt; });
    run.floats = run.floats.filter(function (f) { return f.t < 1.3; });
    seekers.forEach(function (g) {
      if (g.bubble && g.bubble.t !== undefined) { g.bubble.t -= dt; if (g.bubble.t <= 0) g.bubble = null; }
    });
  }

  // ---- drawing ----------------------------------------------------------------

  var stars = [];
  for (var si = 0; si < 70; si++) stars.push({ x: Math.random(), y: Math.random() * 0.6, r: Math.random() * 1.3 + 0.3, p: Math.random() * 6 });

  function drawSky(progress) {
    var top = mix('#141033', '#3b5ba8', progress * progress);
    var bot = mix('#2c2160', '#ff9f6b', progress * progress);
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    stars.forEach(function (s) {
      ctx.globalAlpha = (1 - progress) * (0.5 + 0.5 * Math.sin(clock * 2 + s.p));
      ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 7); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function worldTransform() { ctx.setTransform(DPR * S, 0, 0, DPR * S, DPR * OX, DPR * OY); }

  function drawHouse() {
    var c = ctx, B = ART.box;
    var prog = run ? clamp(run.time / run.len, 0, 1) : 0;
    // moon / sun
    var mx = lerp(60, 340, prog), my = 70 - Math.sin(prog * Math.PI) * 30;
    ART.circle(c, mx, my + (state === 'dawn' ? 0 : 0), 14, prog > 0.85 ? '#ffd76a' : '#f3f0d8');
    // ground
    c.fillStyle = '#2a1f2b'; c.fillRect(-2000, GROUND_Y, 4400, 2000);
    c.fillStyle = '#3a2a35'; c.fillRect(-2000, GROUND_Y + 30, 4400, 2000);
    c.fillStyle = '#2f5a3a'; c.fillRect(-2000, GROUND_Y - 4, 4400, 6);
    // hills behind
    c.fillStyle = '#1e2a3a';
    c.beginPath(); c.moveTo(-2000, GROUND_Y - 2);
    for (var hx = -400; hx <= 800; hx += 80) c.lineTo(hx, GROUND_Y - 22 - Math.sin(hx * 0.02) * 14);
    c.lineTo(2400, GROUND_Y - 2); c.closePath(); c.fill();
    // shell
    B(c, XL - 8, TOP - 4, XR - XL + 16, floorY(0) - TOP + 16, '#3a2633', 3);
    // roof + chimney
    B(c, 290, TOP - 82, 24, 50, '#5a3b3b', 1); B(c, 286, TOP - 86, 32, 8, '#6d4848', 1);
    c.fillStyle = '#4b2f4f';
    c.beginPath(); c.moveTo(XL - 20, TOP + 2); c.lineTo(200, TOP - 78); c.lineTo(XR + 20, TOP + 2); c.closePath(); c.fill();
    c.strokeStyle = '#3a2340'; c.lineWidth = 1;
    for (var rr = 1; rr < 6; rr++) {
      var ry = TOP + 2 - rr * 13, half = (XR - XL + 40) / 2 * (1 - rr * 13 / 80);
      c.beginPath(); c.moveTo(200 - half, ry); c.lineTo(200 + half, ry); c.stroke();
    }
    ART.circle(c, 200, TOP - 34, 9, '#2a1f2b'); ART.circle(c, 200, TOP - 34, 7, run && run.dark ? '#2b2b3a' : '#ffe58a');
    // floors
    for (var f = 0; f < FLOORS; f++) {
      var th = THEMES[f], y0 = floorY(f) - FH + 8, y1 = floorY(f);
      c.fillStyle = th.wall; c.fillRect(XL, y0, XR - XL, y1 - y0);
      c.fillStyle = th.stripe;
      for (var sx = XL + 8; sx < XR; sx += 18) c.fillRect(sx, y0, 6, y1 - y0);
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(XL, y0, XR - XL, 6);
      c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(XL, y1 - 14, XR - XL, 14);
      // slab under this floor
      c.fillStyle = th.floor; c.fillRect(XL - 4, y1, XR - XL + 8, 8);
      c.fillStyle = 'rgba(0,0,0,0.2)';
      for (var px = XL + (f * 13) % 30; px < XR; px += 30) c.fillRect(px, y1 + 1, 1, 6);
      // room name: dark ink on the pale rooms, light on the cellar
      c.fillStyle = f === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(45,25,60,0.38)';
      c.font = 'bold 9px "Trebuchet MS", sans-serif'; c.textAlign = 'left';
      c.fillText(th.name.toUpperCase(), XL + 4, y0 + 14);
    }
    // roof slab
    c.fillStyle = '#5c4330'; c.fillRect(XL - 4, TOP, XR - XL + 8, 8);
    // front door
    B(c, XL - 6, floorY(1) - 46, 22, 46, '#6d3a2a', 2); ART.circle(c, XL + 11, floorY(1) - 22, 1.6, '#f3d27a');
    // windows
    house.windows.forEach(function (w) {
      var y = floorY(w.f) - 78;
      B(c, w.x - 15, y - 2, 30, 38, '#5a3b2b', 3);
      var wg = c.createLinearGradient(0, y, 0, y + 34);
      wg.addColorStop(0, '#24305e'); wg.addColorStop(1, '#3e4f8f');
      B(c, w.x - 12, y + 1, 24, 32, wg, 2);
      c.fillStyle = '#5a3b2b'; c.fillRect(w.x - 1, y + 1, 2, 32); c.fillRect(w.x - 12, y + 16, 24, 2);
      ART.circle(c, w.x + 6, y + 8, 2, 'rgba(255,255,230,0.7)');
    });
  }

  function drawStairs() {
    var c = ctx;
    house.stairs.forEach(function (s) {
      var yb = floorY(s.f), yt = floorY(s.f + 1), dir = s.xt > s.xb ? 1 : -1;
      var steps = 8, dx = (s.xt - s.xb) / steps, dy = (yt - yb) / steps;
      c.fillStyle = '#7a5236';
      c.beginPath(); c.moveTo(s.xb - dir * 6, yb);
      for (var i = 0; i < steps; i++) {
        c.lineTo(s.xb - dir * 6 + dx * i, yb + dy * (i + 1));
        c.lineTo(s.xb - dir * 6 + dx * (i + 1), yb + dy * (i + 1));
      }
      c.lineTo(s.xt + dir * 4, yt + 8); c.lineTo(s.xt + dir * 4, yb); c.closePath();
      c.globalAlpha = 0.35; c.fill(); c.globalAlpha = 1;
      // treads
      for (i = 0; i < steps; i++) ART.box(c, Math.min(s.xb + dx * i, s.xb + dx * (i + 1)) - 4, yb + dy * (i + 1) - 1, Math.abs(dx) + 8, 4, '#9a6a44', 1);
      // rail
      ART.line(c, s.xb, yb - 22, s.xt, yt - 22, '#5a3b2b', 2);
      for (i = 0; i <= steps; i += 2) ART.line(c, s.xb + dx * i, yb + dy * i - 22, s.xb + dx * i, yb + dy * i, '#5a3b2b', 1);
    });
  }

  function drawChute() {
    var c = ctx, y0 = floorY(4) - 44, y1 = floorY(0) - 6;
    ART.box(c, CHUTE_X - 7, y0, 14, y1 - y0, '#8c9aa6', 3);
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(CHUTE_X - 5, y0, 3, y1 - y0);
    for (var y = y0 + 20; y < y1; y += 40) ART.box(c, CHUTE_X - 8, y, 16, 3, '#6f7c88', 1);
    // attic hatch
    ART.box(c, CHUTE_X - 10, y0 - 2, 20, 24, '#5f6c78', 3);
    ART.box(c, CHUTE_X - 7, y0 + 2, 14, 14, '#1e1a26', 2);
    c.fillStyle = '#fff'; c.font = 'bold 7px "Trebuchet MS", sans-serif'; c.textAlign = 'center';
    c.fillText('CHUTE', CHUTE_X - 1, y0 - 5);
    c.fillText('↓', CHUTE_X, y0 + 13);
    // cellar basket
    ART.box(c, CHUTE_X - 13, y1 - 12, 22, 18, '#c99a62', 3);
    ART.circle(c, CHUTE_X - 6, y1 - 12, 5, '#e8eef6'); ART.circle(c, CHUTE_X + 2, y1 - 13, 5, '#f6c1cf'); ART.circle(c, CHUTE_X - 1, y1 - 16, 4, '#bfe0f6');
  }

  function drawWorld() {
    var c = ctx;
    drawHouse();
    drawStairs();
    drawChute();
    // creaky boards
    house.creaks.forEach(function (cr) {
      var y = floorY(cr.f), sh = cr.shake > 0 ? Math.sin(clock * 60) * 1 : 0;
      ART.box(c, cr.x - 10, y + sh, 20, 5, '#3a2618', 1);
      ART.line(c, cr.x - 6, y + 1 + sh, cr.x - 1, y + 4 + sh, '#c9a27a', 0.8);
      ART.line(c, cr.x + 2, y + 1 + sh, cr.x + 7, y + 3 + sh, '#c9a27a', 0.8);
    });
    // portraits
    house.portraits.forEach(function (p) {
      var look = 0;
      if (mimi && floorOf(mimi) === p.f) look = clamp((pos(mimi).x - p.x) / 60, -1, 1);
      ART.drawPortrait(c, p.x, floorY(p.f) - 72, { gasp: p.gasp, look: look });
    });
    // hoover's next floor warning
    seekers.forEach(function (g) {
      if (g.type !== 'hoover' || g.nextF < 0 || Math.floor(clock * 4) % 2) return;
      var y = floorY(g.nextF) - 50;
      c.fillStyle = 'rgba(255,70,70,0.85)';
      [XL + 6, XR - 6].forEach(function (x, i) {
        var d = i ? -1 : 1;
        c.beginPath(); c.moveTo(x, y - 8); c.lineTo(x + d * 10, y); c.lineTo(x, y + 8); c.closePath(); c.fill();
      });
    });
    // hiding spots
    house.spots.forEach(function (s) {
      var y = floorY(s.f);
      var occupied = mimi && mimi.mode === 'hidden' && mimi.spot === s;
      var wob = occupied && moving(mimi) ? 0 : 0;
      if (occupied) {
        c.save(); c.shadowColor = '#57dcc4'; c.shadowBlur = 10;
      }
      ART.drawSpot(c, s.type, s.x + wob, y, s.open, clock);
      if (occupied) c.restore();
      // goo smudges show how often you've hidden here
      var n = Math.min(4, Math.floor(s.heat));
      for (var i = 0; i < n; i++) ART.circle(c, s.x - s.w / 2 + 6 + i * 7, y - s.h * 0.35 + (i % 2) * 5, 2.4, 'rgba(87,220,196,0.75)');
      if (occupied && s.open < 0.2) {
        var peek = Math.sin(clock * 1.3) > 0.2;
        if (peek) ART.drawEyes(c, s.x, y - s.h * 0.55, 0, clock, false);
      }
    });
    // cookies
    run.cookies.forEach(function (k) { ART.drawCookie(c, k.x, floorY(k.f), k.gold, clock); });
    // scent trail
    if (run.roster.indexOf('dog') >= 0) {
      run.scent.forEach(function (sc) {
        var a = 1 - (clock - sc.t) / SCENT_LIFE;
        c.fillStyle = 'rgba(150,230,120,' + (0.35 * a).toFixed(3) + ')';
        c.beginPath(); c.arc(sc.x, floorY(sc.f) - 6 - Math.sin(clock * 3 + sc.id) * 3, 3 + (1 - a) * 3, 0, 7); c.fill();
      });
    }
    // Gertie's lantern cone
    seekers.forEach(function (g) {
      if (g.type !== 'granny' || run.dark) return;
      var p = pos(g), ey = p.y - 26, len = 150;
      var grd = c.createLinearGradient(p.x, 0, p.x + g.facing * len, 0);
      var alert = g.state === 'chase' || g.state === 'alert';
      grd.addColorStop(0, alert ? 'rgba(255,120,90,0.32)' : 'rgba(255,230,140,0.3)');
      grd.addColorStop(1, 'rgba(255,230,140,0)');
      c.fillStyle = grd;
      c.beginPath(); c.moveTo(p.x + g.facing * 10, ey); c.lineTo(p.x + g.facing * len, ey - 34); c.lineTo(p.x + g.facing * len, p.y + 2); c.lineTo(p.x + g.facing * 10, p.y); c.closePath(); c.fill();
    });
    // seekers
    seekers.forEach(function (g) {
      var p = pos(g), mv = moving(g) && run.grace <= 0 && state === 'play';
      if (g.type === 'granny') ART.drawGranny(c, p.x, p.y, { facing: g.facing, t: clock, moving: mv, alert: g.state === 'chase', lanternOff: false });
      else if (g.type === 'dog') ART.drawDog(c, p.x, p.y, { facing: g.facing, t: clock, moving: mv, sniff: g.state === 'sniff' || g.state === 'trail', excited: g.state === 'chase' || g.state === 'scratch' });
      else ART.drawHoover(c, p.x, p.y, { facing: g.facing, t: clock });
    });
    drawMimiNow();
    if (run.dark) drawDarkness();
    if (run.dark && mimi.mode !== 'hidden' && !mimi.chute) {
      var mp = pos(mimi);
      if (mimi.mode === 'free') ART.drawEyes(c, mp.x + mimi.facing * 2, mp.y - 11, mimi.facing, clock, false, true);
    }
    // noise rings
    run.rings.forEach(function (r) {
      c.strokeStyle = 'rgba(255,240,180,' + (1 - r.t / 0.8).toFixed(3) + ')'; c.lineWidth = 2;
      c.beginPath(); c.arc(r.x, r.y, 8 + r.t * 70, 0, 7); c.stroke();
    });
    seekers.forEach(drawBubble);
    // floating text
    c.textAlign = 'center'; c.font = 'bold 12px "Trebuchet MS", sans-serif';
    run.floats.forEach(function (f) {
      c.globalAlpha = 1 - f.t / 1.3;
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillText(f.text, f.x + 1, f.y - f.t * 22 + 1);
      c.fillStyle = f.color; c.fillText(f.text, f.x, f.y - f.t * 22);
    });
    c.globalAlpha = 1;
  }

  function drawMimiNow() {
    var c = ctx, p = pos(mimi);
    if (mimi.mode === 'hidden') return;
    if (mimi.chute) {
      ART.drawEyes(c, p.x, p.y - 4, 0, clock, true);
      return;
    }
    if (mimi.mode === 'disguised') {
      ART.drawProp(c, mimi.prop, p.x, p.y, Math.sin(clock * 2) * (mimi.goo < 25 ? 3 : 0.3));
      if (Math.sin(clock * 2.1) > 0.93) ART.drawEyes(c, p.x, p.y - 14, 0, clock, false);
      return;
    }
    var scared = seekers.some(function (g) { return g.state === 'chase' || g.state === 'alert'; }) || state === 'caught';
    var jump = state === 'caught' ? Math.abs(Math.sin(clock * 10)) * 6 : 0;
    ART.drawMimi(c, p.x, p.y - jump, { t: clock, moving: moving(mimi), facing: mimi.facing, scared: scared });
  }

  var darkCanvas = document.createElement('canvas');
  function drawDarkness() {
    var dw = canvas.width, dh = canvas.height;
    if (darkCanvas.width !== dw || darkCanvas.height !== dh) { darkCanvas.width = dw; darkCanvas.height = dh; }
    var d = darkCanvas.getContext('2d');
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.clearRect(0, 0, dw, dh);
    d.setTransform(DPR * S, 0, 0, DPR * S, DPR * OX, DPR * OY);
    d.fillStyle = 'rgba(6,4,20,0.86)';
    d.fillRect(XL - 4, TOP + 8, XR - XL + 8, floorY(0) - TOP);
    d.globalCompositeOperation = 'destination-out';
    function hole(x, y, r) {
      var g = d.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g; d.beginPath(); d.arc(x, y, r, 0, 7); d.fill();
    }
    seekers.forEach(function (g) {
      var p = pos(g);
      if (g.type === 'granny') hole(p.x + g.facing * 22, p.y - 20, 66);
      else if (g.type === 'hoover') hole(p.x + g.facing * 8, p.y - 8, 26);
      else hole(p.x, p.y - 10, 18);
    });
    run.cookies.forEach(function (k) { hole(k.x, floorY(k.f) - 8, k.gold ? 16 : 10); });
    house.windows.forEach(function (w) { hole(w.x, floorY(w.f) - 60, 26); });
    d.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(darkCanvas, 0, 0); ctx.restore();
  }

  function drawBubble(g) {
    var b = g.bubble;
    if (!b) return;
    if (b.kind === 'hum' && !moving(g)) return;
    var c = ctx, p = pos(g);
    var hy = g.type === 'granny' ? 58 : g.type === 'dog' ? 36 : 30;
    var x = clamp(p.x, XL + 20, XR - 20), y = p.y - hy - 16;
    var w = b.kind === 'text' || b.kind === 'woof' ? 46 : b.kind === 'spot' ? 34 : 24, h = b.kind === 'spot' ? 30 : 20;
    c.fillStyle = 'rgba(255,255,255,0.95)';
    ART.rr(c, x - w / 2, y - h / 2, w, h, 9); c.fill();
    if (b.kind === 'spot' || b.kind === 'hum') {
      ART.circle(c, p.x + (x > p.x ? 3 : -3), y + h / 2 + 4, 3, 'rgba(255,255,255,0.95)');
      ART.circle(c, p.x, y + h / 2 + 9, 2, 'rgba(255,255,255,0.95)');
    } else {
      c.beginPath(); c.moveTo(x - 4, y + h / 2 - 1); c.lineTo(p.x, y + h / 2 + 8); c.lineTo(x + 4, y + h / 2 - 1); c.fill();
    }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (b.kind === 'spot') {
      var sz = ART.SPOTS[b.type], k = Math.min(26 / sz.w, 24 / sz.h);
      c.save(); c.translate(x, y + 12); c.scale(k, k);
      ART.drawSpot(c, b.type, 0, 0, 0, clock);
      c.restore();
    } else if (b.kind === 'hum') {
      c.fillStyle = '#7d5bb5'; c.font = 'bold 13px sans-serif'; c.fillText('♪', x, y + 1);
    } else if (b.kind === '!') {
      c.fillStyle = '#e2465a'; c.font = 'bold 16px "Trebuchet MS", sans-serif'; c.fillText('!', x, y + 1);
    } else if (b.kind === '?' || b.kind === 'hmm') {
      c.fillStyle = '#5d4a8a'; c.font = 'bold 14px "Trebuchet MS", sans-serif'; c.fillText(b.kind === '?' ? '?' : '…', x, y + 1);
    } else if (b.kind === 'sniff') {
      c.fillStyle = '#5aa86e'; c.font = 'bold 9px "Trebuchet MS", sans-serif'; c.fillText('sniff', x, y + 1);
    } else {
      c.fillStyle = '#e2465a'; c.font = 'bold 11px "Trebuchet MS", sans-serif'; c.fillText(b.kind === 'woof' ? 'WOOF!' : b.text, x, y + 1);
    }
    c.textBaseline = 'alphabetic';
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var prog = run && house ? clamp(run.time / run.len, 0, 1) : 0;
    if (state === 'dawn') prog = 1;
    drawSky(prog);
    worldTransform();
    if (house && run && mimi) drawWorld();
    else if (house) drawHouse();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // ---- HUD ---------------------------------------------------------------------

  var hudCache = {};
  function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
  function updateHud() {
    if (!run || !mimi) return;
    setText('hud-score', String(run.score));
    setText('hud-night', 'Night ' + run.night);
    setText('hud-coin-n', String(P.getCoins() + run.coins - run.coinsPaid));
    $('dawn-fill').style.width = (clamp(run.time / run.len, 0, 1) * 100).toFixed(1) + '%';
    $('goo-fill').style.width = mimi.goo.toFixed(0) + '%';
    var btn = $('btn-mimic');
    btn.classList.toggle('on', mimi.mode === 'disguised');
    btn.disabled = mimi.mode !== 'disguised' && mimi.goo < 20;
    setText('btn-mimic', mimi.mode === 'disguised' ? 'Unmimic' : 'Mimic');
    updateTutorial();
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1400);
  }

  var hintEl = null;
  function updateTutorial() {
    if (!hintEl) {
      hintEl = document.createElement('div');
      hintEl.id = 'hint';
      hintEl.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top) + 64px);' +
        'background:rgba(20,14,40,0.82);color:#fff;font-weight:800;font-size:15px;padding:8px 14px;border-radius:14px;' +
        'pointer-events:none;text-align:center;max-width:calc(100vw - 32px);box-shadow:0 0 0 2px rgba(87,220,196,0.6)';
      document.body.appendChild(hintEl);
    }
    var msg = '';
    if (state === 'play' && run.tut) {
      msg = ['', 'Tap a floor to sneak there', 'Tap furniture to hide inside', 'Tap Mimi to disguise. Hiding and disguises burn goo; cookies refill it', 'Watch the thought bubbles. Survive until sunrise!'][run.tut] || '';
      if (run.tut === 4) {
        run.tutT = (run.tutT || 0) + 1 / 60;
        if (run.tutT > 4) { run.tut = 0; settings.seenTut = true; saveSettings(); msg = ''; }
      }
    }
    hintEl.style.display = msg ? 'block' : 'none';
    if (msg && hintEl.textContent !== msg) hintEl.textContent = msg;
  }

  // ---- flow --------------------------------------------------------------------

  var panels = ['menu', 'help', 'nightcard', 'profile', 'paused', 'over'];
  function show(id) {
    panels.forEach(function (p) { $(p).classList.toggle('hidden', p !== id); });
    var inGame = state === 'play' || state === 'caught' || state === 'dawn' || state === 'paused' || state === 'intro';
    $('hud').classList.toggle('hidden', !inGame);
    $('bottom-hud').classList.toggle('hidden', !inGame || state === 'intro');
  }

  function refreshMenu() {
    P.load();
    $('menu-coins').textContent = P.getCoins();
    $('menu-best').textContent = P.getBest(GAME_ID);
    $('menu-nights').textContent = settings.bestNight || 0;
  }

  function startGame() {
    A.unlock();
    newRun();
    showNight(1);
  }

  function showNight(n) {
    setupNight(n);
    state = 'intro';
    $('nc-title').textContent = 'Night ' + n;
    $('nc-sub').textContent = n === 1 ? 'Somebody is looking for you. Stay hidden until sunrise.' : 'The manor has rearranged itself. Night lasts ' + run.len + ' seconds.';
    var box = $('nc-seekers');
    box.innerHTML = '';
    run.roster.forEach(function (type) {
      var row = document.createElement('div'); row.className = 'seeker';
      var cv = document.createElement('canvas'); cv.width = 128; cv.height = 112;
      var cc = cv.getContext('2d'); cc.scale(2, 2);
      cc.fillStyle = '#3a315f'; cc.fillRect(0, 44, 64, 12);
      if (type === 'granny') { cc.translate(26, 46); cc.scale(0.95, 0.95); ART.drawGranny(cc, 0, 0, { facing: 1, t: 0 }); }
      else if (type === 'dog') { cc.translate(30, 46); cc.scale(1.3, 1.3); ART.drawDog(cc, 0, 0, { facing: 1, t: 0 }); }
      else { cc.translate(32, 46); cc.scale(1.4, 1.4); ART.drawHoover(cc, 0, 0, { facing: 1, t: 0.1 }); }
      var tx = document.createElement('div');
      var b = document.createElement('b'); b.textContent = SEEKER_INFO[type].name;
      var s = document.createElement('span'); s.textContent = SEEKER_INFO[type].text;
      tx.appendChild(b); tx.appendChild(s);
      row.appendChild(cv); row.appendChild(tx); box.appendChild(row);
    });
    var q = $('nc-quirk');
    q.classList.toggle('hidden', !run.blackouts && n < 2);
    var bits = [];
    if (run.blackouts) bits.push('The lights will flicker out. In the dark Gertie only sees as far as her lantern.');
    if (n === 2) bits.push('New: tattletale portraits gasp when you pass them.');
    q.textContent = bits.join(' ');
    q.classList.toggle('hidden', !bits.length);
    show('nightcard');
  }

  function beginNight() {
    A.unlock();
    state = 'play';
    show(null);
    A.night();
    if (run.dark) run.dark = false;
  }

  function dawn() {
    state = 'dawn';
    run.dawnT = 2.6;
    A.setHum(0);
    A.dawn();
    var bonus = 100 * run.night;
    var p = pos(mimi);
    addScore(bonus);
    run.coins += 2 + run.night;
    seekers.forEach(function (g) { g.bubble = { kind: 'text', text: 'Yawn…', t: 3 }; });
    if (mimi.mode === 'disguised') mimi.mode = 'free';
    void p;
    payCoins();
    toast('You made it to sunrise!');
    if (run.night > (settings.bestNight || 0)) { settings.bestNight = run.night; saveSettings(); }
  }

  function nextNight() { showNight(run.night + 1); }

  function payCoins() {
    var owed = run.coins - run.coinsPaid;
    if (owed > 0) { P.addCoins(owed, GAME_ID); run.coinsPaid = run.coins; }
  }

  function gameOver() {
    state = 'over';
    payCoins();
    var res = P.submitScore(GAME_ID, run.score);
    var g = run.caughtBy;
    $('over-title').textContent = g.type === 'granny' ? 'Caught by Gertie!' : g.type === 'dog' ? 'Biscuit found you!' : 'Slurped!';
    $('over-sub').textContent = run.caughtWhy || '';
    $('over-score').textContent = run.score;
    $('over-best').textContent = res.best;
    $('over-nights').textContent = run.night - 1;
    $('over-new').classList.toggle('hidden', !res.isNew);
    $('over-coins').textContent = run.coins;
    $('over-total').textContent = P.getCoins();
    var cost = REVIVE_COSTS[run.revives];
    var rb = $('btn-revive');
    rb.classList.toggle('hidden', cost === undefined);
    if (cost !== undefined) {
      rb.textContent = 'Wriggle free (' + cost + ' coins)';
      rb.disabled = P.getCoins() < cost;
    }
    show('over');
  }

  function revive() {
    var cost = REVIVE_COSTS[run.revives];
    if (cost === undefined || !P.spendCoins(cost, GAME_ID)) return;
    run.revives++;
    // Pop Mimi into the hiding spot farthest from every seeker.
    var best = null, bd = -1;
    house.spots.forEach(function (s) {
      var dmin = Infinity;
      seekers.forEach(function (g) { dmin = Math.min(dmin, Math.abs(floorOf(g) - s.f) * 200 + Math.abs(pos(g).x - s.x)); });
      if (dmin > bd) { bd = dmin; best = s; }
    });
    mimi.path = []; mimi.pending = null; mimi.stair = null; mimi.chute = null;
    mimi.f = best.f; mimi.x = best.x; mimi.mode = 'free'; mimi.goo = 100;
    house.spots.forEach(function (s) { s.heat = 0; s.searching = null; });
    hideIn(best);
    best.heat = 0;
    run.scent.length = 0;
    seekers.forEach(function (g) {
      g.state = 'idle'; g.target = null; g.sawHide = null; g.knows = false; g.bubble = { kind: '?', t: 1.5 };
      stopAgent(g);
    });
    run.grace = 2;
    state = 'play';
    show(null);
  }

  function pause() {
    if (state !== 'play') return;
    state = 'paused';
    A.setHum(0);
    show('paused');
  }
  function resume() {
    if (state !== 'paused') return;
    A.unlock();
    state = 'play';
    show(null);
  }
  function quitToMenu() {
    if (run && (state === 'paused' || state === 'over')) {
      payCoins();
      if (state === 'paused' && run.score > 0) P.submitScore(GAME_ID, run.score);
    }
    state = 'menu';
    A.setHum(0);
    refreshMenu();
    show('menu');
  }

  // ---- input -------------------------------------------------------------------

  function toWorld(cx, cy) { return { x: (cx - OX) / S, y: (cy - OY) / S }; }

  canvas.addEventListener('pointerdown', function (e) {
    A.unlock();
    e.preventDefault();
    var w = toWorld(e.clientX, e.clientY);
    onTap(w.x, w.y);
  });
  // iOS Safari: also unlock on touchend, which counts as a user gesture for audio.
  document.addEventListener('touchend', function () { A.unlock(); }, { passive: true });
  document.addEventListener('click', function () { A.unlock(); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  window.addEventListener('keydown', function (e) {
    A.unlock();
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (state === 'play') pause(); else if (state === 'paused') resume(); }
    if ((e.key === ' ' || e.key === 'm' || e.key === 'M') && state === 'play') { e.preventDefault(); toggleDisguise(); }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });

  $('btn-play').addEventListener('click', function () {
    if (!settings.seenHelp) { settings.seenHelp = true; saveSettings(); show('help'); $('help').dataset.next = 'play'; return; }
    startGame();
  });
  $('btn-help').addEventListener('click', function () { $('help').dataset.next = ''; show('help'); });
  $('btn-profile').addEventListener('click', function () {
    $('profile-code').value = P.exportCode();
    $('profile-msg').textContent = '';
    show('profile');
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
      P.importCode($('profile-import').value.trim());
      $('profile-msg').textContent = 'Profile merged.';
      $('profile-code').value = P.exportCode();
      refreshMenu();
    } catch (err) { $('profile-msg').textContent = 'That code did not work.'; }
  });
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () {
      if ($('help').dataset.next === 'play' && !$('help').classList.contains('hidden')) { $('help').dataset.next = ''; startGame(); return; }
      refreshMenu(); show('menu');
    });
  });
  $('btn-go').addEventListener('click', beginNight);
  $('btn-mimic').addEventListener('click', function () { A.unlock(); toggleDisguise(); });
  $('btn-mute').addEventListener('click', function () {
    settings.muted = !settings.muted; saveSettings();
    A.setMuted(settings.muted);
    $('btn-mute').classList.toggle('off', settings.muted);
  });
  $('btn-mute').classList.toggle('off', settings.muted);
  $('btn-pause').addEventListener('click', pause);
  $('btn-resume').addEventListener('click', resume);
  $('btn-quit').addEventListener('click', quitToMenu);
  $('btn-again').addEventListener('click', startGame);
  $('btn-menu').addEventListener('click', quitToMenu);
  $('btn-revive').addEventListener('click', revive);

  // ---- menu art ------------------------------------------------------------------

  function drawMenuArt() {
    var cv = $('menu-art'), c = cv.getContext('2d');
    var k = cv.width / 300;
    c.setTransform(k, 0, 0, k, 0, 0);
    c.clearRect(0, 0, 300, 120);
    ART.box(c, 0, 0, 300, 120, '#2e2752', 14);
    c.fillStyle = '#3a315f'; for (var x = 8; x < 300; x += 18) c.fillRect(x, 0, 6, 100);
    c.fillStyle = '#6f4a3a'; c.fillRect(0, 100, 300, 20);
    var g = c.createLinearGradient(80, 0, 220, 0);
    g.addColorStop(0, 'rgba(255,230,140,0.35)'); g.addColorStop(1, 'rgba(255,230,140,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(80, 74); c.lineTo(240, 40); c.lineTo(240, 102); c.lineTo(80, 100); c.fill();
    c.save(); c.translate(66, 100); c.scale(1.5, 1.5); ART.drawGranny(c, 0, 0, { facing: 1, t: 0 }); c.restore();
    c.save(); c.translate(250, 100); c.scale(1.3, 1.3); ART.drawSpot(c, 'wardrobe', 0, 0, 0, 0); c.restore();
    c.save(); c.translate(190, 100); c.scale(1.6, 1.6); ART.drawProp(c, 'vase', 0, 0, 0); ART.drawEyes(c, 0, -14, -1, 1, true); c.restore();
    c.save(); c.translate(150, 100); c.scale(1.4, 1.4); ART.drawProp(c, 'plant', 0, 0, 0); c.restore();
    c.save(); c.translate(124, 30); ART.box(c, -14, -11, 28, 20, '#fff', 8); c.fillStyle = '#5d4a8a'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.fillText('?', 0, 4); c.restore();
  }

  // ---- boot ----------------------------------------------------------------------

  P.load();
  refreshMenu();
  drawMenuArt();
  house = genHouse(1);
  show('menu');

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    updateHud();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Hooks for the smoke test.
  window.MM = {
    get state() { return state; },
    get run() { return run; },
    get mimi() { return mimi; },
    get house() { return house; },
    get seekers() { return seekers; },
    start: function (n) { newRun(); showNight(n || 1); beginNight(); },
    tap: onTap,
    toScreen: function (x, y) { return { x: OX + x * S, y: OY + y * S }; },
    floorY: floorY,
    findPath: function (a, b) { return findPath(a, b, { chute: true }); },
    skipToDawn: function () { if (run) run.time = run.len; },
    step: function (secs) { var n = Math.round(secs / 0.02); for (var i = 0; i < n; i++) update(0.02); }
  };
})();
