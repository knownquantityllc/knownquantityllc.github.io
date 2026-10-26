// Sloth Band vs. Platypus: core game (physics, input, rules, rendering).
(function () {
  'use strict';

  const { Engine, Bodies, Body, Composite, Events, Sleeping, Vector } = Matter;
  const Art = window.SBArt;
  const SFX = window.SBAudio;

  const W = 1800, H = 900;
  const GROUND = window.SB_GROUND;
  const STEP = 1000 / 120; // physics substep (ms); two per 60 fps frame keeps fast sloths from tunneling
  const BASE = 1000 / 60;
  const GRAVITY_PER_BASE_STEP = 0.001 * BASE * BASE; // px per base step^2 at gravity.y = 1
  const SLING = { x: 250, ground: GROUND, forkY: 690, left: { x: 228, y: 650 }, right: { x: 276, y: 650 } };
  const ANCHOR = { x: 252, y: 655 };
  const MAX_PULL = 130;
  const POWER = 0.17;
  const GRACE_STEPS = 150; // no damage while a fresh level settles
  const PROJ_AIR = 0.0015;

  const MATERIALS = {
    wood:  { density: 0.002,  friction: 0.7,  restitution: 0.1,  hp: 60,  points: 500, passThrough: 0.72 },
    stone: { density: 0.0045, friction: 0.85, restitution: 0.05, hp: 150, points: 800, passThrough: 0.45 },
    ice:   { density: 0.0012, friction: 0.25, restitution: 0.1,  hp: 22,  points: 300, passThrough: 0.88 },
  };
  const PLAT_POINTS = 5000, KING_POINTS = 10000, SPARE_SLOTH_BONUS = 10000;

  const game = {
    W, H, state: 'idle', levelIndex: -1, score: 0, paused: false,
    listeners: {},
    on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); },
    emit(ev, data) { (this.listeners[ev] || []).forEach((fn) => fn(data)); },
  };

  let canvas, ctx, bg, view = { scale: 1, ox: 0, oy: 0, dpr: 1 };
  // Camera: a close follow-cam like the classic slingshot games, so the band
  // and the forts are big enough to read on a phone. cam.x is the world x at
  // the left edge of the screen; cam.s is pixels per world unit.
  const VIS_H = 640;      // world units shown top to bottom when zoomed in
  const VIS_W_MIN = 1000; // never show less than this much width
  const CAM_BOTTOM = GROUND + 50;
  const cam = { x: 0, s: 1, tx: 0, ts: 1, base: 1, fit: 1, intro: 0, pan: null, panFrom: null };
  let fortX = W;
  let engine = null;
  let stepCount = 0;
  let queue = [];          // instrument keys still waiting
  let loaded = null;       // instrument key sitting in the pouch
  let projectiles = [];    // bodies currently in flight
  let aimPos = null;       // pouch position while dragging
  let dragging = false;
  let abilityUsed = false;
  let flightTimer = 0, settleTimer = 0;
  let particles = [];
  let pendingDestroy = new Set();
  let pendingPassThrough = [];
  let shake = 0;
  let thresholds = [0, 0, 0];
  let levelInfo = null;
  let lastTime = 0, acc = 0;
  let blinkT = 0;
  let trail = [];

  // ---------- setup ----------

  function init(cvs) {
    canvas = cvs;
    ctx = canvas.getContext('2d');
    bg = Art.buildBackground(W, H, GROUND);
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    requestAnimationFrame(frame);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth || window.innerWidth;
    const ch = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    cam.base = Math.min(canvas.height / VIS_H, canvas.width / VIS_W_MIN);
    cam.fit = Math.min(canvas.width / W, canvas.height / (CAM_BOTTOM + 40));
    if (cam.fit > cam.base) cam.fit = cam.base;
    cam.s = cam.ts = cam.base;
    view.dpr = dpr;
    updateCamera(1000);
  }

  function visW(s) { return canvas.width / (s || cam.s); }
  function clampCamX(x, s) {
    const vw = visW(s);
    if (vw >= W) return (W - vw) / 2;
    return Math.max(0, Math.min(W - vw, x));
  }

  // Pick where the camera wants to be, then ease toward it.
  function updateCamera(f) {
    let tx = 0, ts = cam.base;
    const vw = visW(cam.base);
    const main = projectiles.find((p) => engine && Composite.get(engine.world, p.id, 'body'));
    if (cam.intro > 0) {
      tx = fortX + 160 - vw;
    } else if ((game.state === 'flying' || game.state === 'settling') && main) {
      const p = main.position;
      tx = p.x - vw * 0.38;
      // zoom out when the shot climbs above the top of the screen
      const need = CAM_BOTTOM - (p.y - 120);
      if (need > VIS_H) ts = Math.max(cam.fit, canvas.height / need);
      tx = p.x - visW(ts) * 0.38;
    } else if (game.state === 'settling' || game.state === 'won' || game.state === 'lost') {
      tx = cam.tx;
    } else if (cam.pan !== null) {
      tx = cam.pan;
    }
    cam.ts = ts;
    cam.tx = clampCamX(tx, ts);
    const k = Math.min(1, 0.09 * f);
    cam.s += (cam.ts - cam.s) * k;
    cam.x += (clampCamX(cam.tx, cam.s) - cam.x) * k;
    view.scale = cam.s;
    view.ox = -cam.x * cam.s;
    view.oy = canvas.height - CAM_BOTTOM * cam.s;
  }

  function toWorld(e) {
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * view.dpr;
    const py = (e.clientY - r.top) * view.dpr;
    return { x: (px - view.ox) / view.scale, y: (py - view.oy) / view.scale };
  }

  function startLevel(i) {
    const lv = window.SB_LEVELS[i];
    if (!lv) return;
    game.levelIndex = i;
    levelInfo = lv;
    engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
    engine.gravity.y = 1;
    Events.on(engine, 'collisionStart', onCollisions);
    stepCount = 0;
    particles = []; trail = [];
    pendingDestroy = new Set();
    pendingPassThrough = [];
    projectiles = [];
    game.score = 0;
    shake = 0;
    abilityUsed = false;

    const ground = Bodies.rectangle(W / 2, GROUND + 100, W + 2000, 200, { isStatic: true, friction: 0.9, label: 'ground' });
    ground.plugin = { kind: 'ground' };
    Composite.add(engine.world, ground);

    let blockPts = 0, platPts = 0, seed = 1;
    for (const it of lv.items) {
      let b;
      if (it.k === 'block') {
        const m = MATERIALS[it.m];
        b = Bodies.rectangle(it.x, it.y, it.w, it.h, { density: m.density, friction: m.friction, frictionStatic: 1, restitution: m.restitution, angle: it.a, label: 'block', slop: 0.02 });
        b.plugin = { kind: 'block', material: it.m, hp: m.hp, maxHp: m.hp, w: it.w, h: it.h, seed: (seed++ * 7919) % 97 + 3 };
        blockPts += m.points;
      } else if (it.k === 'plat') {
        const hp = it.king ? 90 : 28;
        b = Bodies.circle(it.x, it.y, it.r, { density: 0.0015, friction: 0.8, restitution: 0.15, label: 'plat', slop: 0.02 });
        b.plugin = { kind: 'plat', hp, maxHp: hp, r: it.r, king: it.king };
        platPts += it.king ? KING_POINTS : PLAT_POINTS;
      } else if (it.k === 'terrain') {
        b = Bodies.rectangle(it.x, it.y, it.w, it.h, { isStatic: true, friction: 0.9, label: 'terrain' });
        b.plugin = { kind: 'terrain', w: it.w, h: it.h };
      }
      if (b) Composite.add(engine.world, b);
    }
    thresholds = [1, Math.round((platPts + blockPts * 0.3 + 10000) / 1000) * 1000, Math.round((platPts + blockPts * 0.55 + 20000) / 1000) * 1000];

    fortX = 0;
    for (const it of lv.items) if (it.k !== 'terrain' || it.h < 400) fortX = Math.max(fortX, it.x + (it.w || it.r || 0) / 2);
    // Open on the fort, then glide back to the slingshot.
    cam.intro = 75;
    cam.pan = null;
    cam.x = clampCamX(fortX + 160 - visW(cam.base), cam.base);
    cam.s = cam.base;

    queue = lv.sloths.slice();
    loaded = null;
    game.paused = false;
    loadNext();
    emitHud();
    game.emit('levelStart', { index: i, level: lv });
  }

  function loadNext() {
    loaded = queue.length ? queue.shift() : null;
    projectiles = [];
    abilityUsed = false;
    aimPos = null;
    dragging = false;
    game.state = loaded ? 'aim' : 'out';
    emitHud();
  }

  // ---------- input ----------

  function onDown(e) {
    if (game.paused) return;
    SFX.unlock();
    const p = toWorld(e);
    if (game.state === 'aim' && loaded) {
      cam.intro = 0;
      if (Vector.magnitude(Vector.sub(p, ANCHOR)) < 110 && cam.x < SLING.x) {
        dragging = true;
        cam.pan = null;
        aimPos = clampPull(p);
        game.emit('aimStart');
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      } else {
        // drag the scenery to look around
        cam.panFrom = { px: e.clientX * view.dpr, x: cam.x };
        cam.pan = cam.x;
      }
    } else if (game.state === 'flying') {
      triggerAbility();
    }
  }

  function onMove(e) {
    if (cam.panFrom) {
      cam.pan = cam.panFrom.x - (e.clientX * view.dpr - cam.panFrom.px) / cam.s;
      cam.x = clampCamX(cam.pan, cam.s);
      return;
    }
    if (!dragging) return;
    const p = clampPull(toWorld(e));
    if (aimPos && Math.abs(Vector.magnitude(Vector.sub(p, ANCHOR)) - Vector.magnitude(Vector.sub(aimPos, ANCHOR))) > 18) {
      SFX.stretch(Vector.magnitude(Vector.sub(p, ANCHOR)) / MAX_PULL);
    }
    aimPos = p;
  }

  function onUp() {
    if (cam.panFrom) {
      cam.panFrom = null;
      // a short tap on the scenery snaps back to the slingshot
      if (Math.abs(cam.pan - cam.x) < 1 && cam.x < 40) cam.pan = null;
      return;
    }
    if (!dragging) return;
    dragging = false;
    const pull = Vector.sub(ANCHOR, aimPos);
    if (Vector.magnitude(pull) < 22) { aimPos = null; return; }
    launch(Vector.mult(pull, POWER));
  }

  function clampPull(p) {
    let d = Vector.sub(p, ANCHOR);
    const m = Vector.magnitude(d);
    if (m > MAX_PULL) d = Vector.mult(d, MAX_PULL / m);
    const q = Vector.add(ANCHOR, d);
    q.y = Math.min(q.y, GROUND - 26);
    return q;
  }

  function makeSloth(inst, pos, r) {
    const def = Art.SLOTHS[inst];
    const b = Bodies.circle(pos.x, pos.y, r || def.r, { density: def.density, friction: 0.8, restitution: 0.22, frictionAir: PROJ_AIR, label: 'sloth' });
    b.plugin = { kind: 'sloth', inst, r: r || def.r, born: stepCount };
    return b;
  }

  function launch(vel) {
    if (game.state !== 'aim' || !loaded) return false;
    const start = aimPos || ANCHOR;
    const b = makeSloth(loaded, start);
    Composite.add(engine.world, b);
    Body.setVelocity(b, vel);
    Body.setAngularVelocity(b, 0.05);
    projectiles = [b];
    trail = [];
    aimPos = null;
    cam.pan = null;
    flightTimer = 0;
    settleTimer = 0;
    game.state = 'flying';
    SFX.launch(loaded);
    emitHud();
    return true;
  }

  function triggerAbility() {
    if (abilityUsed || !projectiles.length) return;
    const main = projectiles[0];
    if (!Composite.get(engine.world, main.id, 'body')) return;
    if (main.plugin.landed) return;
    abilityUsed = true;
    const inst = main.plugin.inst;
    const v = Body.getVelocity(main);
    SFX.ability(inst);
    noteBurst(main.position, Art.SLOTHS[inst].color, 6);
    if (inst === 'drums') {
      const R = 230;
      particles.push({ type: 'ring', x: main.position.x, y: main.position.y, r: 10, maxR: R, life: 1, color: '#d64545' });
      for (const b of Composite.allBodies(engine.world)) {
        if (b.isStatic || b === main) continue;
        const d = Vector.sub(b.position, main.position);
        const dist = Vector.magnitude(d);
        if (dist > R || dist < 1) continue;
        const f = 1 - dist / R;
        Sleeping.set(b, false);
        const push = Vector.mult(Vector.normalise(d), 16 * f);
        Body.setVelocity(b, Vector.add(Body.getVelocity(b), push));
        Body.setAngularVelocity(b, b.angularVelocity + (Math.random() - 0.5) * 0.3 * f);
        if (b.plugin.kind === 'block' || b.plugin.kind === 'plat') damage(b, 45 * f, main);
      }
      Body.setVelocity(main, { x: v.x * 0.3, y: -6 });
      shake = 14;
    } else if (inst === 'trumpet') {
      const sp = Math.max(Vector.magnitude(v) * 1.9, 24);
      Body.setVelocity(main, Vector.mult(Vector.normalise(v), sp));
      main.plugin.boost = 40;
    } else if (inst === 'guitar') {
      for (const ang of [-0.2, 0.2]) {
        const c = makeSloth('guitar', Vector.add(main.position, { x: 0, y: ang * 60 }), 17);
        c.plugin.clone = true;
        Composite.add(engine.world, c);
        Body.setVelocity(c, Vector.rotate(v, ang));
        projectiles.push(c);
      }
    } else if (inst === 'tuba') {
      Body.setVelocity(main, { x: v.x * 0.15, y: 26 });
      main.plugin.slam = true;
    }
    game.emit('ability', inst);
  }

  // ---------- physics rules ----------

  function velOf(b) { return b.isStatic ? { x: 0, y: 0 } : Body.getVelocity(b); }
  function massFactor(b) { return b.isStatic ? 3 : Math.max(0.4, Math.min(4, b.mass / 3)); }

  function onCollisions(ev) {
    for (const pair of ev.pairs) {
      const A = pair.bodyA.parent, B = pair.bodyB.parent;
      const n = pair.collision.normal;
      const rel = Vector.sub(velOf(A), velOf(B));
      const impact = Math.abs(Vector.dot(rel, n));
      const sloth = A.plugin.kind === 'sloth' ? A : (B.plugin.kind === 'sloth' ? B : null);
      if (sloth) {
        if (!sloth.plugin.landed && stepCount - sloth.plugin.born > 2) {
          sloth.plugin.landed = true;
          // Once it hits something, a sloth should tumble to a stop, not roll away forever.
          sloth.frictionAir = 0.015;
        }
        if (impact > 2) SFX.impact(sloth.plugin.inst, impact / 22);
        if (impact > 6) noteBurst(sloth.position, Art.SLOTHS[sloth.plugin.inst].color, 1);
      }
      if (stepCount < GRACE_STEPS) continue;
      for (const [me, other] of [[A, B], [B, A]]) {
        const k = me.plugin.kind;
        if (k !== 'block' && k !== 'plat') continue;
        let dmg = Math.max(0, impact - 1.6) * 9 * massFactor(other);
        if (other.plugin.slam) dmg *= 1.6;
        if (dmg <= 0) continue;
        const killed = damage(me, dmg, other);
        if (killed && other.plugin.kind === 'sloth' && k === 'block') {
          pendingPassThrough.push({ body: other, vel: velOf(other), factor: MATERIALS[me.plugin.material].passThrough });
        }
      }
    }
  }

  // Returns true if this hit destroys the body.
  function damage(b, amount, source) {
    if (pendingDestroy.has(b) || amount <= 0) return false;
    b.plugin.hp -= amount;
    if (b.plugin.kind === 'block' && amount > 4) addScore(Math.round(amount) * 2, null);
    if (b.plugin.hp <= 0) { pendingDestroy.add(b); return true; }
    return false;
  }

  function destroy(b) {
    Composite.remove(engine.world, b);
    const p = b.position;
    if (b.plugin.kind === 'block') {
      const m = MATERIALS[b.plugin.material];
      addScore(m.points, p);
      SFX.blockBreak(b.plugin.material);
      const col = b.plugin.material === 'wood' ? '#c68a4c' : b.plugin.material === 'stone' ? '#9aa3ab' : '#bfe6fb';
      for (let i = 0; i < 10; i++) {
        particles.push({ type: 'chip', x: p.x + (Math.random() - 0.5) * b.plugin.w * 0.6, y: p.y + (Math.random() - 0.5) * b.plugin.h * 0.6, vx: (Math.random() - 0.5) * 8, vy: -Math.random() * 7, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: 1, size: 4 + Math.random() * 6, color: col });
      }
    } else if (b.plugin.kind === 'plat') {
      addScore(b.plugin.king ? KING_POINTS : PLAT_POINTS, p, true);
      SFX.platypusPop();
      shake = Math.max(shake, 6);
      particles.push({ type: 'ring', x: p.x, y: p.y, r: 5, maxR: 70, life: 1, color: '#ffffff' });
      for (let i = 0; i < 14; i++) {
        particles.push({ type: 'puff', x: p.x, y: p.y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, life: 1, size: 8 + Math.random() * 10, color: '#e9e2d4' });
      }
      noteBurst(p, '#f5c518', 3);
    }
  }

  function noteBurst(p, color, n) {
    for (let i = 0; i < n; i++) {
      particles.push({ type: 'note', x: p.x + (Math.random() - 0.5) * 30, y: p.y - 10, vx: (Math.random() - 0.5) * 2.5, vy: -2 - Math.random() * 2, life: 1, size: 22 + Math.random() * 12, color, glyph: Math.random() < 0.5 ? '♪' : '♫' });
    }
  }

  function addScore(n, pos, big) {
    game.score += n;
    if (pos) particles.push({ type: 'text', x: pos.x, y: pos.y - 20, vy: -1.2, life: 1, text: String(n), size: big ? 38 : 26, color: big ? '#ffe14d' : '#ffffff' });
    emitHud();
  }

  function countPlats() {
    return Composite.allBodies(engine.world).filter((b) => b.plugin.kind === 'plat').length;
  }

  function physicsStep() {
    Engine.update(engine, STEP);
    stepCount++;
    for (const pt of pendingPassThrough) {
      if (Composite.get(engine.world, pt.body.id, 'body')) Body.setVelocity(pt.body, Vector.mult(pt.vel, pt.factor));
    }
    pendingPassThrough = [];
    if (pendingDestroy.size) {
      pendingDestroy.forEach(destroy);
      pendingDestroy.clear();
    }
    // Anything that falls out of the world is gone (platypuses count as popped).
    for (const b of Composite.allBodies(engine.world)) {
      if (b.isStatic) continue;
      if (b.position.y > H + 300 || b.position.x < -600 || b.position.x > W + 600) {
        if (b.plugin.kind === 'plat') destroy(b);
        else Composite.remove(engine.world, b);
      }
    }
  }

  function anyMoving() {
    for (const b of Composite.allBodies(engine.world)) {
      if (b.isStatic || b.isSleeping) continue;
      if (b.speed > 0.35 || Math.abs(b.angularVelocity) > 0.02) return true;
    }
    return false;
  }

  function updateRules(dtFrames) {
    if (game.state === 'flying') {
      flightTimer += dtFrames;
      const live = projectiles.filter((p) => Composite.get(engine.world, p.id, 'body'));
      for (const p of live) {
        if (p.plugin.landed) Body.setAngularVelocity(p, p.angularVelocity * Math.pow(0.93, dtFrames));
        if (p.speed < (p.plugin.landed ? 0.8 : 0.3)) p.plugin.still = (p.plugin.still || 0) + dtFrames; else p.plugin.still = 0;
        if (p.plugin.boost) p.plugin.boost--;
      }
      if (live.length && !live[0].plugin.landed && stepCount % 3 === 0) trail.push({ x: live[0].position.x, y: live[0].position.y });
      const done = live.every((p) => p.plugin.still > 30 || p.position.x > W + 60 || p.position.x < -60 || p.position.y > H) || flightTimer > 420;
      if (done || countPlats() === 0 && flightTimer > 40) {
        game.state = 'settling';
        settleTimer = 0;
      }
    } else if (game.state === 'settling') {
      settleTimer += dtFrames;
      if ((settleTimer > 25 && !anyMoving()) || settleTimer > 200) {
        // Retire landed sloths so they don't clutter the next shot.
        for (const p of projectiles) {
          if (Composite.get(engine.world, p.id, 'body')) {
            Composite.remove(engine.world, p);
            particles.push({ type: 'puff', x: p.position.x, y: p.position.y, vx: 0, vy: -1, life: 1, size: 20, color: '#f4efe4' });
          }
        }
        projectiles = [];
        if (countPlats() === 0) finish(true);
        else if (!queue.length) finish(false);
        else loadNext();
      }
    }
  }

  function finish(won) {
    const spare = queue.length;
    let bonus = 0;
    if (won) {
      bonus = spare * SPARE_SLOTH_BONUS;
      game.score += bonus;
    }
    const stars = won ? thresholds.filter((t) => game.score >= t).length : 0;
    game.state = won ? 'won' : 'lost';
    if (won) SFX.win(); else SFX.lose();
    emitHud();
    game.emit('levelEnd', { won, score: game.score, stars, bonus, spare, index: game.levelIndex, thresholds: thresholds.slice() });
  }

  // ---------- loop + render ----------

  function frame(now) {
    const dt = Math.min(100, now - (lastTime || now));
    lastTime = now;
    if (engine && !game.paused && game.state !== 'idle') {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 8) { physicsStep(); acc -= STEP; n++; }
      if (n === 8) acc = 0;
      updateRules(dt / BASE);
    }
    updateParticles(game.paused ? 0 : dt / BASE);
    if (canvas) {
      if (!game.paused && cam.intro > 0 && game.state === 'aim') cam.intro -= dt / BASE;
      updateCamera(dt / BASE);
    }
    render(now);
    requestAnimationFrame(frame);
  }

  function updateParticles(f) {
    for (const p of particles) {
      if (p.type === 'chip') { p.x += p.vx * f; p.y += p.vy * f; p.vy += 0.35 * f; p.rot += p.vr * f; p.life -= 0.02 * f; }
      else if (p.type === 'note') { p.x += p.vx * f; p.y += p.vy * f; p.life -= 0.015 * f; }
      else if (p.type === 'text') { p.y += p.vy * f; p.life -= 0.012 * f; }
      else if (p.type === 'ring') { p.r += (p.maxR - p.r) * 0.18 * f; p.life -= 0.04 * f; }
      else if (p.type === 'puff') { p.x += p.vx * f; p.y += p.vy * f; p.vx *= 0.94; p.vy *= 0.94; p.life -= 0.03 * f; }
    }
    particles = particles.filter((p) => p.life > 0);
    if (shake > 0) shake = Math.max(0, shake - f);
  }

  function render(now) {
    const t = now / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#7cc7f2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox + sx * view.scale, view.oy + sy * view.scale);
    // Stretch the background's edges past the world when the view is wider
    // or taller than it (zoomed out, or very wide screens).
    const left = -view.ox / view.scale, right = left + canvas.width / view.scale, top = -view.oy / view.scale;
    if (top < 0) ctx.drawImage(bg, 0, 0, W, 2, Math.min(0, left) - 4, top - 4, Math.max(W, right) - Math.min(0, left) + 8, -top + 5);
    if (left < 0) ctx.drawImage(bg, 2, 0, 2, H, left - 4, 0, -left + 6, H);
    if (right > W) ctx.drawImage(bg, W - 4, 0, 2, H, W - 2, 0, right - W + 6, H);
    ctx.drawImage(bg, 0, 0);
    if (!engine) return;

    Art.drawSlingBack(ctx, SLING);

    // Waiting sloths line up behind the slingshot.
    blinkT += 0.016;
    const waiting = queue;
    for (let i = 0; i < waiting.length; i++) {
      const inst = waiting[i];
      const r = Art.SLOTHS[inst].r * 0.8;
      const x = SLING.x - 62 - i * 44;
      const hop = game.state === 'aim' && i === 0 ? Math.abs(Math.sin(t * 3)) * 6 : 0;
      Art.drawSloth(ctx, x, GROUND - r - hop, r, 0, inst, { blink: Math.sin(t * 0.7 + i * 2) > 0.97 });
    }

    // Trail of the current shot.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < trail.length; i++) {
      ctx.beginPath(); ctx.arc(trail[i].x, trail[i].y, i % 2 ? 3 : 5, 0, Math.PI * 2); ctx.fill();
    }

    const bodies = Composite.allBodies(engine.world);
    for (const b of bodies) if (b.plugin.kind === 'terrain') Art.drawTerrain(ctx, b);
    for (const b of bodies) if (b.plugin.kind === 'block') Art.drawBlock(ctx, b, b.plugin.hp / b.plugin.maxHp);
    for (const b of bodies) if (b.plugin.kind === 'plat') Art.drawPlatypus(ctx, b.position.x, b.position.y, b.plugin.r, b.angle, b.plugin.hp / b.plugin.maxHp, b.plugin.king, t);
    for (const b of bodies) {
      if (b.plugin.kind !== 'sloth') continue;
      if (b.plugin.boost) {
        ctx.strokeStyle = 'rgba(242,182,50,0.7)'; ctx.lineWidth = 4;
        const v = Vector.normalise(Body.getVelocity(b));
        for (let k = -1; k <= 1; k++) {
          const o = Vector.mult(Vector.perp(v), k * 12);
          ctx.beginPath(); ctx.moveTo(b.position.x + o.x - v.x * 30, b.position.y + o.y - v.y * 30); ctx.lineTo(b.position.x + o.x - v.x * 70, b.position.y + o.y - v.y * 70); ctx.stroke();
        }
      }
      Art.drawSloth(ctx, b.position.x, b.position.y, b.plugin.r, b.angle, b.plugin.inst, { yell: !b.plugin.landed });
    }

    // Loaded sloth + band.
    if (game.state === 'aim' && loaded) {
      const p = aimPos || ANCHOR;
      if (aimPos) drawTrajectory(Vector.mult(Vector.sub(ANCHOR, aimPos), POWER), aimPos);
      Art.drawBand(ctx, SLING.right, p);
      Art.drawSloth(ctx, p.x, p.y, Art.SLOTHS[loaded].r, 0, loaded, { yell: !!aimPos });
      Art.drawBand(ctx, SLING.left, p);
    } else {
      Art.drawBand(ctx, SLING.right, ANCHOR);
      Art.drawBand(ctx, SLING.left, ANCHOR);
    }
    Art.drawSlingFront(ctx, SLING);

    // Hint ring around the pouch on the first shot of the first level.
    if (game.state === 'aim' && !aimPos && game.levelIndex === 0 && queue.length === levelInfo.sloths.length - 1) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.4 + 0.3 * Math.sin(t * 4)) + ')';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 10]);
      ctx.beginPath(); ctx.arc(ANCHOR.x, ANCHOR.y, 48, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
      if (p.type === 'chip') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore();
      } else if (p.type === 'note') {
        ctx.fillStyle = p.color; ctx.font = 'bold ' + p.size + 'px sans-serif'; ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3; ctx.strokeText(p.glyph, p.x, p.y); ctx.fillText(p.glyph, p.x, p.y);
      } else if (p.type === 'text') {
        ctx.font = '900 ' + p.size + 'px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(40,20,0,0.8)'; ctx.lineWidth = 5; ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
      } else if (p.type === 'ring') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 8 * p.life; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      } else if (p.type === 'puff') {
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.4 - p.life * 0.4), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Dotted preview of the first part of the arc (same integration as the engine).
  function drawTrajectory(v0, p0) {
    let x = p0.x, y = p0.y, vx = v0.x, vy = v0.y;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(40,25,10,0.45)'; ctx.lineWidth = 2;
    for (let i = 1; i <= 36; i++) {
      vx *= (1 - PROJ_AIR); vy = vy * (1 - PROJ_AIR) + GRAVITY_PER_BASE_STEP;
      x += vx; y += vy;
      if (y > GROUND) break;
      if (i % 3 === 0) { ctx.beginPath(); ctx.arc(x, y, 5.5 - i / 12, 0, Math.PI * 2); ctx.stroke(); ctx.fill(); }
    }
  }

  function emitHud() {
    game.emit('hud', {
      score: game.score, state: game.state, loaded, queue: queue.slice(),
      level: game.levelIndex, name: levelInfo && levelInfo.name, plats: engine ? countPlats() : 0,
      tip: loaded ? Art.SLOTHS[loaded] : null,
    });
  }

  // ---------- public API ----------

  game.init = init;
  game.startLevel = startLevel;
  game.restart = () => startLevel(game.levelIndex);
  game.setPaused = (p) => { game.paused = !!p; lastTime = 0; };
  game.stop = () => { game.state = 'idle'; engine = null; };
  // Hooks used by the automated smoke test.
  game.debug = {
    launch: (vx, vy) => launch({ x: vx, y: vy }),
    ability: () => triggerAbility(),
    plats: () => (engine ? countPlats() : -1),
    bodies: () => (engine ? Composite.allBodies(engine.world).map((b) => ({ kind: b.plugin.kind, x: b.position.x, y: b.position.y, hp: b.plugin.hp, sleeping: b.isSleeping })) : []),
    thresholds: () => thresholds.slice(),
    toScreen: (x, y) => ({ x: (x * view.scale + view.ox) / view.dpr, y: (y * view.scale + view.oy) / view.dpr }),
    camera: () => ({ x: cam.x, s: cam.s, intro: cam.intro }),
    ANCHOR, POWER, MAX_PULL, GRAVITY_PER_BASE_STEP,
  };

  window.SBGame = game;
})();
