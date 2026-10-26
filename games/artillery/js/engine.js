// Game rules, physics, CPU opponent and rendering. No DOM here apart from the
// canvas context handed to render(), so the same Game runs for every mode.
(function () {
  'use strict';

  const W = 1200;
  const H = 640;
  const GRAVITY = 320;
  const MAX_SPEED = 640;
  const WIND_ACC = 3; // wind is -10..10, so up to 30 px/s^2 sideways
  const TANK_R = 20;
  const CHAR_SCALE = 1.25; // drawn a bit larger than the hit circle so they read on phones
  const STEP = 1 / 120;

  // Shared weapon rules. Names and looks come from the skin.
  const WEAPONS = {
    single: { type: 'shot', r: 32, dmg: 22, ammo: Infinity },
    heavy: { type: 'shot', r: 52, dmg: 34, ammo: 3 },
    triple: { type: 'triple', r: 26, dmg: 15, ammo: 3 },
    cluster: { type: 'cluster', r: 22, dmg: 10, ammo: 2, children: 5 },
    bounce: { type: 'bounce', r: 30, dmg: 22, ammo: 2 },
    roller: { type: 'roller', r: 36, dmg: 30, ammo: 2 },
    homing: { type: 'homing', r: 32, dmg: 26, ammo: 1 },
    shower: { type: 'shower', r: 20, dmg: 9, ammo: 1, children: 7 },
    dirt: { type: 'dirt', r: 60, dmg: 0, ammo: 2 },
    dig: { type: 'dig', r: 26, dmg: 8, ammo: 1 },
    mega: { type: 'shot', r: 85, dmg: 50, ammo: 1 }
  };
  const WEAPON_ORDER = ['single', 'heavy', 'triple', 'cluster', 'bounce', 'roller', 'homing', 'shower', 'dirt', 'dig', 'mega'];

  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // Wind depends only on seed + turn, so both players of an online match agree.
  function windFor(seed, turn) {
    const r = mulberry32((seed ^ Math.imul(turn + 1, 0x9e3779b1)) >>> 0);
    r();
    const v = (r() * 2 - 1);
    return Math.round(v * Math.abs(v) * 20) / 2; // -10..10 in 0.5 steps, calm more often
  }

  function makeTerrain(seed) {
    const r = mulberry32(seed ^ 0xa5a5a5);
    const h = new Float32Array(W);
    const base = H * (0.6 + r() * 0.08);
    const waves = [];
    for (let i = 0; i < 4; i++) {
      waves.push({
        a: (30 + r() * 70) / (1 + i * 0.7),
        f: (0.5 + i * 1.1 + r() * 0.9) * 2 * Math.PI / W,
        p: r() * Math.PI * 2
      });
    }
    for (let x = 0; x < W; x++) {
      let y = base;
      for (let i = 0; i < waves.length; i++) y += waves[i].a * Math.sin(waves[i].f * x + waves[i].p);
      h[x] = clamp(y, H * 0.3, H * 0.92);
    }
    const x0 = Math.round(W * (0.08 + r() * 0.12));
    const x1 = Math.round(W * (0.8 + r() * 0.12));
    flatten(h, x0);
    flatten(h, x1);
    return { heights: h, spawn: [x0, x1] };
  }

  function flatten(h, cx) {
    let sum = 0, n = 0;
    for (let x = cx - 16; x <= cx + 16; x++) { sum += h[clamp(x, 0, W - 1)]; n++; }
    const avg = sum / n;
    for (let x = cx - 32; x <= cx + 32; x++) {
      if (x < 0 || x >= W) continue;
      const d = Math.abs(x - cx);
      const k = d <= 16 ? 1 : 1 - (d - 16) / 16;
      h[x] = h[x] * (1 - k) + avg * k;
    }
  }

  function encodeHeights(h) {
    const a = new Int16Array(h.length);
    for (let i = 0; i < h.length; i++) a[i] = Math.round(h[i] * 4);
    const bytes = new Uint8Array(a.buffer);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function decodeHeights(str, into) {
    const s = atob(str);
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    const a = new Int16Array(bytes.buffer);
    for (let i = 0; i < into.length && i < a.length; i++) into[i] = a[i] / 4;
  }

  function Game(opts) {
    this.opts = opts;
    this.seed = opts.seed >>> 0;
    this.skin = window.ArtillerySkins.SKINS[opts.skin] || window.ArtillerySkins.SKINS.concert;
    this.mode = opts.mode; // 'cpu' | 'local' | 'online'
    this.localIndex = opts.localIndex || 0;
    this.difficulty = opts.difficulty || 'medium';
    const terr = makeTerrain(this.seed);
    this.heights = terr.heights;
    const self = this;
    const names = opts.names || [];
    this.tanks = [0, 1].map(function (i) {
      const p = self.skin.players[i];
      const ammo = {};
      WEAPON_ORDER.forEach(function (w) { ammo[w] = WEAPONS[w].ammo; });
      const t = {
        i: i, x: terr.spawn[i], y: 0, vy: 0, falling: false, fallFrom: 0,
        hp: 100, angle: i === 0 ? 50 : 130, power: 60, moves: 4, moveTarget: null,
        ammo: ammo, weapon: 'single', score: 0, shots: 0,
        name: names[i] || p.name, kind: p.kind, color: p.color
      };
      t.y = self.restY(t.x);
      return t;
    });
    this.rounds = opts.rounds || 10;
    this.maxTurns = this.rounds * 2;
    this.turn = 0;
    this.current = opts.starter || 0;
    this.wind = windFor(this.seed, 0);
    this.phase = 'aim';
    this.projectiles = [];
    this.particles = [];
    this.effects = [];
    this.texts = [];
    this.shake = 0;
    this.time = 0;
    this.acc = 0;
    this.settleTimer = 0;
    this.terrainDirty = true;
    this.pendingSync = null;
    this.lastShooter = -1;
    this.aiState = null;
    this.result = null;
    // hooks set by the UI
    this.onAction = null; // local action to broadcast (online)
    this.onTurn = null;
    this.onGameOver = null;
    this.onShotDone = null; // shooter-side sync hook
    this.onChange = null;
  }

  Game.W = W;
  Game.H = H;
  Game.WEAPONS = WEAPONS;
  Game.WEAPON_ORDER = WEAPON_ORDER;
  Game.encodeHeights = encodeHeights;
  Game.decodeHeights = decodeHeights;
  Game.windFor = windFor;

  Game.prototype.ground = function (x) {
    return this.heights[clamp(Math.round(x), 0, W - 1)];
  };
  Game.prototype.restY = function (x) {
    let m = H;
    for (let dx = -10; dx <= 10; dx += 2) m = Math.min(m, this.ground(x + dx));
    return m;
  };
  Game.prototype.center = function (t) { return { x: t.x, y: t.y - 20 }; };
  Game.prototype.cur = function () { return this.tanks[this.current]; };
  Game.prototype.isHumanTurn = function () {
    if (this.mode === 'local') return true;
    if (this.mode === 'cpu') return this.current === 0;
    return this.current === this.localIndex;
  };
  Game.prototype.changed = function () { if (this.onChange) this.onChange(); };

  // ---- actions -----------------------------------------------------------
  // UI calls act(); remote peers call apply() with the same object.
  Game.prototype.act = function (a) {
    if (this.phase !== 'aim' || !this.isHumanTurn()) return false;
    if (!this.apply(a)) return false;
    if (this.onAction) this.onAction(a);
    return true;
  };

  Game.prototype.apply = function (a) {
    const t = this.cur();
    if (this.phase !== 'aim') return false;
    switch (a.k) {
      case 'aim':
        if (a.a != null) t.angle = clamp(a.a, 0, 180);
        if (a.p != null) t.power = clamp(a.p, 5, 100);
        break;
      case 'weapon':
        if (!WEAPONS[a.w] || !(t.ammo[a.w] > 0)) return false;
        t.weapon = a.w;
        break;
      case 'move':
        if (t.moves <= 0 || t.moveTarget != null) return false;
        t.moveTarget = clamp(t.x + a.dir * 45, 20, W - 20);
        t.moves--;
        window.ArtillerySfx.move();
        break;
      case 'fire':
        if (a.x != null) { t.x = a.x; t.y = this.restY(t.x); t.moveTarget = null; }
        t.angle = clamp(a.a, 0, 180);
        t.power = clamp(a.p, 5, 100);
        if (!WEAPONS[a.w] || !(t.ammo[a.w] > 0)) a.w = 'single';
        t.weapon = a.w;
        this.fire(t);
        break;
      default:
        return false;
    }
    this.changed();
    return true;
  };

  Game.prototype.fireAction = function () {
    const t = this.cur();
    const x = t.moveTarget != null ? t.moveTarget : t.x;
    return { k: 'fire', a: Math.round(t.angle * 10) / 10, p: Math.round(t.power * 10) / 10, w: t.weapon, x: Math.round(x * 100) / 100 };
  };

  Game.prototype.fire = function (t) {
    const w = WEAPONS[t.weapon];
    if (t.ammo[t.weapon] !== Infinity) t.ammo[t.weapon]--;
    t.shots++;
    const angles = w.type === 'triple' ? [t.angle - 5, t.angle, t.angle + 5] : [t.angle];
    const c = this.center(t);
    const self = this;
    angles.forEach(function (deg) {
      const rad = deg * Math.PI / 180;
      const speed = t.power / 100 * MAX_SPEED;
      self.projectiles.push({
        x: c.x + Math.cos(rad) * 26, y: c.y - Math.sin(rad) * 26,
        vx: Math.cos(rad) * speed, vy: -Math.sin(rad) * speed,
        id: t.weapon, w: w, r: w.r, dmg: w.dmg, owner: t.i,
        t: 0, bounces: 0, rolling: false, child: false, dead: false
      });
    });
    this.lastShooter = t.i;
    this.phase = 'flight';
    this.settleTimer = 0;
    window.ArtillerySfx.fire(this.skin.id, t.power);
    // after this shot the weapon may be gone
    if (!(t.ammo[t.weapon] > 0)) t.weapon = 'single';
  };

  // ---- simulation --------------------------------------------------------
  Game.prototype.update = function (dt) {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.acc += dt;
    while (this.acc >= STEP) {
      this.step(STEP);
      this.acc -= STEP;
    }
    this.updateFx(dt);
    if (this.phase === 'aim' && this.mode === 'cpu' && this.current === 1) this.aiTick(dt);
  };

  Game.prototype.step = function (dt) {
    const self = this;
    // tank movement + falling
    this.tanks.forEach(function (t) {
      if (t.moveTarget != null) {
        const d = t.moveTarget - t.x;
        const s = 90 * dt;
        if (Math.abs(d) <= s) { t.x = t.moveTarget; t.moveTarget = null; self.changed(); } else t.x += Math.sign(d) * s;
        t.y = self.restY(t.x);
        return;
      }
      const rest = self.restY(t.x);
      if (t.y >= rest - 0.5 && !t.falling) { t.y = rest; t.vy = 0; return; }
      if (!t.falling) { t.falling = true; t.fallFrom = t.y; t.vy = 0; }
      t.vy += GRAVITY * dt;
      t.y += t.vy * dt;
      if (t.y >= rest - 0.5) {
        const dist = rest - t.fallFrom;
        t.y = rest; t.vy = 0; t.falling = false;
        if (dist > 40 && t.hp > 0) {
          const dmg = Math.round((dist - 40) / 8);
          if (dmg > 0) self.damage(t, dmg, -1);
        }
      }
    });

    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (!p.dead) this.stepProjectile(p, dt);
    }
    this.projectiles = this.projectiles.filter(function (p) { return !p.dead; });

    if (this.phase === 'flight' && this.projectiles.length === 0) {
      const busy = this.tanks.some(function (t) { return t.falling; });
      this.settleTimer += dt;
      if ((!busy && this.settleTimer > 0.6) || this.settleTimer > 8) this.endShot();
    }
  };

  Game.prototype.stepProjectile = function (p, dt) {
    if (p.rolling) return this.rollStep(p, dt);
    const prevVy = p.vy;
    p.vx += this.wind * WIND_ACC * dt;
    p.vy += GRAVITY * dt;
    if (p.w.type === 'homing' && p.vy > 0) {
      const foe = this.tanks[1 - p.owner];
      p.vx += clamp((foe.x - p.x) * 3, -300, 300) * dt;
      p.vx = clamp(p.vx, -420, 420);
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.t += dt;

    if (!p.child && (p.w.type === 'cluster' || p.w.type === 'shower') && prevVy < 0 && p.vy >= 0) {
      this.split(p);
      return;
    }
    if (p.t > 20) { p.dead = true; return; }
    if (Math.random() < 0.25) this.trail(p);
    if (p.x < -80 || p.x > W + 80 || p.y > H + 40) { p.dead = true; return; }

    for (let k = 0; k < 2; k++) {
      const t = this.tanks[k];
      if (t.hp <= 0) continue;
      if (t.i === p.owner && p.t < 0.3) continue;
      const c = this.center(t);
      const dx = p.x - c.x, dy = p.y - c.y;
      if (dx * dx + dy * dy < TANK_R * TANK_R) { this.impact(p, t); return; }
    }
    if (p.x >= 0 && p.x < W && p.y >= this.ground(p.x)) this.impact(p, null);
  };

  Game.prototype.split = function (p) {
    p.dead = true;
    const n = p.w.children;
    for (let k = 0; k < n; k++) {
      const off = k - (n - 1) / 2;
      const q = {
        x: p.x, y: p.y, id: p.id, w: p.w, r: p.r, dmg: p.dmg, owner: p.owner,
        t: 1, bounces: 0, rolling: false, child: true, dead: false
      };
      if (p.w.type === 'cluster') { q.vx = p.vx + off * 50; q.vy = -60 + Math.abs(off) * 20; } else { q.vx = p.vx * 0.3 + off * 26; q.vy = 30; }
      this.projectiles.push(q);
    }
    this.burst(p.x, p.y, 8, 0.6);
    window.ArtillerySfx.bounce(this.skin.id);
  };

  Game.prototype.impact = function (p, hitTank) {
    const type = p.w.type;
    if (type === 'bounce' && !hitTank && p.bounces < 3) {
      this.explode(p.x, p.y, p.r * 0.55, p.dmg * 0.4, p.owner);
      const xi = clamp(Math.round(p.x), 3, W - 4);
      const s = (this.heights[xi + 3] - this.heights[xi - 3]) / 6;
      const len = Math.sqrt(1 + s * s);
      const nx = s / len, ny = -1 / len;
      const dot = p.vx * nx + p.vy * ny;
      p.vx = (p.vx - 2 * dot * nx) * 0.7;
      p.vy = (p.vy - 2 * dot * ny) * 0.7;
      p.y = this.ground(p.x) - 2;
      p.bounces++;
      window.ArtillerySfx.bounce(this.skin.id);
      return;
    }
    if (type === 'roller' && !hitTank) {
      p.rolling = true;
      p.dir = Math.sign(p.vx) || 1;
      p.speed = Math.max(90, Math.abs(p.vx) * 0.6);
      p.rollT = 0;
      p.y = this.ground(p.x) - 8;
      return;
    }
    p.dead = true;
    if (type === 'dirt') {
      this.addDirt(p.x, p.y, p.r);
      this.burst(p.x, p.y, 16, 1, '#7a5230');
      window.ArtillerySfx.dirt();
      return;
    }
    this.explode(p.x, p.y, p.r, p.dmg, p.owner);
    if (type === 'dig') {
      for (let k = 1; k <= 5; k++) this.carve(p.x, p.y + k * 24, p.r);
    }
  };

  Game.prototype.rollStep = function (p, dt) {
    const xi = clamp(Math.round(p.x), 0, W - 1);
    const ahead = clamp(xi + p.dir * 3, 0, W - 1);
    const slope = (this.heights[ahead] - this.heights[xi]) / 3; // >0 is downhill
    p.rollT += dt;
    if (slope < -1.6) { p.dead = true; this.explode(p.x, p.y, p.r, p.dmg, p.owner); return; }
    p.speed = Math.min(420, p.speed + slope * 500 * dt - 35 * dt);
    p.x += p.dir * p.speed * dt;
    p.t += dt;
    if (p.x < 0 || p.x >= W) { p.dead = true; return; }
    p.y = this.ground(p.x) - 8;
    for (let k = 0; k < 2; k++) {
      const t = this.tanks[k];
      if (t.hp <= 0 || (t.i === p.owner && p.rollT < 0.4)) continue;
      if (Math.abs(t.x - p.x) < 16) { p.dead = true; this.explode(p.x, p.y, p.r, p.dmg, p.owner); return; }
    }
    if (p.speed <= 8 || p.rollT > 7) { p.dead = true; this.explode(p.x, p.y, p.r, p.dmg, p.owner); }
  };

  Game.prototype.damage = function (t, amount, by) {
    amount = Math.min(t.hp, Math.max(1, Math.round(amount)));
    t.hp -= amount;
    if (by >= 0 && by !== t.i) this.tanks[by].score += amount;
    const c = this.center(t);
    this.texts.push({ x: c.x, y: c.y - 30, text: '-' + amount, color: by === t.i ? '#ffb3b3' : '#ffffff', life: 1.4 });
    window.ArtillerySfx.hit();
    this.changed();
  };

  Game.prototype.explode = function (x, y, r, dmg, owner) {
    const self = this;
    if (dmg > 0) {
      this.tanks.forEach(function (t) {
        if (t.hp <= 0) return;
        const c = self.center(t);
        const d = Math.hypot(x - c.x, y - c.y);
        if (d < r + TANK_R) {
          const f = clamp(1 - Math.max(0, d - TANK_R) / r, 0, 1);
          self.damage(t, dmg * (0.25 + 0.75 * f), owner);
        }
      });
    }
    this.carve(x, y, r);
    this.effects.push({ x: x, y: y, r: r, t: 0 });
    this.burst(x, y, Math.round(8 + r / 3), r / 40);
    this.shake = Math.max(this.shake, r / 6);
    window.ArtillerySfx.boom(this.skin.id, r);
  };

  // Heightmap carving: the dirt above a hole falls in, which gives the
  // Pocket Tanks "landslide" look without simulating every grain.
  Game.prototype.carve = function (cx, cy, r) {
    const h = this.heights;
    for (let x = Math.max(0, Math.ceil(cx - r)); x <= Math.min(W - 1, Math.floor(cx + r)); x++) {
      const dy = Math.sqrt(r * r - (x - cx) * (x - cx));
      const top = cy - dy, bot = cy + dy;
      const g = h[x];
      if (bot <= g) continue;
      h[x] = Math.min(H, g >= top ? bot : g + (bot - top));
    }
    this.terrainDirty = true;
  };

  Game.prototype.addDirt = function (cx, cy, r) {
    const h = this.heights;
    for (let x = Math.max(0, Math.ceil(cx - r)); x <= Math.min(W - 1, Math.floor(cx + r)); x++) {
      const dy = Math.sqrt(r * r - (x - cx) * (x - cx));
      const g = h[x];
      const above = Math.min(g, cy + dy) - (cy - dy);
      if (above > 0) h[x] = Math.max(40, g - above);
    }
    this.terrainDirty = true;
  };

  Game.prototype.endShot = function () {
    this.phase = 'resolved';
    const shooter = this.lastShooter;
    if (this.mode === 'online') {
      if (shooter === this.localIndex) {
        if (this.onShotDone) this.onShotDone(this.snapshot());
      } else if (!this.pendingSync) {
        this.phase = 'waitSync';
        return;
      }
      if (this.pendingSync) { this.restore(this.pendingSync); this.pendingSync = null; }
    }
    this.nextTurn();
  };

  Game.prototype.snapshot = function () {
    return {
      k: 'sync', turn: this.turn,
      tanks: this.tanks.map(function (t) {
        return { x: t.x, hp: t.hp, score: t.score, moves: t.moves, ammo: WEAPON_ORDER.map(function (w) { return t.ammo[w] === Infinity ? -1 : t.ammo[w]; }) };
      }),
      h: encodeHeights(this.heights)
    };
  };

  Game.prototype.restore = function (s) {
    const self = this;
    decodeHeights(s.h, this.heights);
    s.tanks.forEach(function (st, i) {
      const t = self.tanks[i];
      t.x = st.x; t.hp = st.hp; t.score = st.score; t.moves = st.moves;
      WEAPON_ORDER.forEach(function (w, j) { t.ammo[w] = st.ammo[j] === -1 ? Infinity : st.ammo[j]; });
      if (!(t.ammo[t.weapon] > 0)) t.weapon = 'single';
      t.y = self.restY(t.x); t.vy = 0; t.falling = false;
    });
    this.terrainDirty = true;
  };

  Game.prototype.receiveSync = function (s) {
    if (this.phase === 'waitSync') {
      this.restore(s);
      this.nextTurn();
    } else {
      this.pendingSync = s;
    }
  };

  Game.prototype.nextTurn = function () {
    const dead = this.tanks.filter(function (t) { return t.hp <= 0; });
    if (dead.length || this.turn + 1 >= this.maxTurns) return this.finish();
    this.turn++;
    this.current = 1 - this.current;
    this.wind = windFor(this.seed, this.turn);
    this.phase = 'aim';
    this.aiState = null;
    if (this.onTurn) this.onTurn();
    this.changed();
  };

  Game.prototype.finish = function () {
    const a = this.tanks[0], b = this.tanks[1];
    let winner = -1;
    if (a.hp <= 0 && b.hp > 0) winner = 1;
    else if (b.hp <= 0 && a.hp > 0) winner = 0;
    else if (a.hp > 0 && b.hp > 0) {
      if (a.hp !== b.hp) winner = a.hp > b.hp ? 0 : 1;
      else if (a.score !== b.score) winner = a.score > b.score ? 0 : 1;
    }
    this.phase = 'over';
    this.result = { winner: winner };
    if (this.onGameOver) this.onGameOver(this.result);
    this.changed();
  };

  // ---- CPU opponent ------------------------------------------------------
  // Searches angle/power with a side-effect-free copy of the flight physics,
  // then blurs the answer by difficulty.
  Game.prototype.simulate = function (shooter, angle, power) {
    const c = this.center(shooter);
    const rad = angle * Math.PI / 180;
    const speed = power / 100 * MAX_SPEED;
    let x = c.x + Math.cos(rad) * 26, y = c.y - Math.sin(rad) * 26;
    let vx = Math.cos(rad) * speed, vy = -Math.sin(rad) * speed;
    const foe = this.tanks[1 - shooter.i];
    const fc = this.center(foe);
    const dt = 1 / 60;
    for (let s = 0; s < 900; s++) {
      vx += this.wind * WIND_ACC * dt;
      vy += GRAVITY * dt;
      x += vx * dt;
      y += vy * dt;
      if (x < -80 || x > W + 80 || y > H + 40) return null;
      const dx = x - fc.x, dy = y - fc.y;
      if (dx * dx + dy * dy < TANK_R * TANK_R) return { x: x, y: y, direct: true };
      if (s > 18) {
        const ex = x - c.x, ey = y - c.y;
        if (ex * ex + ey * ey < TANK_R * TANK_R) return { x: x, y: y, self: true };
      }
      if (x >= 0 && x < W && y >= this.ground(x)) return { x: x, y: y };
    }
    return null;
  };

  Game.prototype.aiPlan = function () {
    const me = this.tanks[1], foe = this.tanks[0];
    const self = this;
    function score(a, p) {
      const r = self.simulate(me, a, p);
      if (!r) return 1e9;
      if (r.self) return 1e8;
      let e = r.direct ? 0 : Math.hypot(r.x - foe.x, (r.y - foe.y) * 0.5);
      if (Math.abs(r.x - me.x) < 55) e += 600;
      return e;
    }
    let best = { e: 1e12, a: 135, p: 60 };
    for (let a = 12; a <= 168; a += 3) {
      for (let p = 22; p <= 100; p += 3) {
        const e = score(a, p);
        if (e < best.e) best = { e: e, a: a, p: p };
      }
    }
    const coarse = best;
    for (let a = coarse.a - 3; a <= coarse.a + 3; a += 0.5) {
      for (let p = coarse.p - 3; p <= coarse.p + 3; p += 0.5) {
        if (p < 5 || p > 100) continue;
        const e = score(a, p);
        if (e < best.e) best = { e: e, a: a, p: p };
      }
    }
    const noise = { easy: [10, 14], medium: [5, 7], hard: [2.2, 3] }[this.difficulty] || [5, 7];
    // the CPU gets a little sharper each turn, like it is finding the range
    const focus = Math.max(0.45, 1 - me.shots * 0.08);
    const g = function () { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; };
    const a = clamp(best.a + g() * noise[0] * focus, 2, 178);
    const p = clamp(best.p + g() * noise[1] * focus, 10, 100);

    // weapon choice
    const have = WEAPON_ORDER.filter(function (w) { return me.ammo[w] > 0 && w !== 'dirt' && w !== 'dig' && w !== 'roller' && w !== 'bounce'; });
    let w = 'single';
    const roll = Math.random();
    if (this.difficulty === 'hard') {
      const pref = ['mega', 'homing', 'heavy', 'triple', 'cluster', 'shower'];
      for (let i = 0; i < pref.length; i++) if (have.indexOf(pref[i]) >= 0 && Math.random() < 0.7) { w = pref[i]; break; }
    } else if (this.difficulty === 'medium') {
      if (roll < 0.55 && have.length > 1) w = have[1 + Math.floor(Math.random() * (have.length - 1))];
    } else if (roll < 0.25 && have.length > 1) {
      w = have[1 + Math.floor(Math.random() * (have.length - 1))];
    }
    return { a: Math.round(a * 10) / 10, p: Math.round(p * 10) / 10, w: w };
  };

  Game.prototype.aiTick = function (dt) {
    const t = this.cur();
    if (!this.aiState) this.aiState = { wait: 0.7, plan: null };
    const s = this.aiState;
    s.wait -= dt;
    if (s.wait > 0) return;
    if (!s.plan) {
      s.plan = this.aiPlan();
      s.from = { a: t.angle, p: t.power };
      s.k = 0;
      t.weapon = s.plan.w;
      this.changed();
    }
    s.k = Math.min(1, s.k + dt / 0.8);
    const e = s.k * s.k * (3 - 2 * s.k);
    t.angle = s.from.a + (s.plan.a - s.from.a) * e;
    t.power = s.from.p + (s.plan.p - s.from.p) * e;
    if (s.k >= 1) {
      s.k = 2;
      this.apply({ k: 'fire', a: s.plan.a, p: s.plan.p, w: s.plan.w });
    }
  };

  // ---- effects -----------------------------------------------------------
  Game.prototype.trail = function (p) {
    const cols = this.skin.boom;
    this.particles.push({
      x: p.x, y: p.y, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20,
      size: 3 + Math.random() * 3, life: 0.5, max: 0.5, color: cols[Math.floor(Math.random() * cols.length)], g: 0
    });
  };

  Game.prototype.burst = function (x, y, n, scale, color) {
    const cols = this.skin.boom;
    const glyphs = this.skin.particleGlyphs;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (60 + Math.random() * 180) * (0.6 + scale * 0.5);
      this.particles.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80,
        size: 5 + Math.random() * 7 * Math.min(2, scale + 0.5),
        life: 0.8 + Math.random() * 0.6, max: 1.4,
        color: color || cols[Math.floor(Math.random() * cols.length)],
        glyph: glyphs[Math.floor(Math.random() * glyphs.length)], g: 260
      });
    }
  };

  Game.prototype.updateFx = function (dt) {
    this.particles.forEach(function (p) {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    });
    this.particles = this.particles.filter(function (p) { return p.life > 0; });
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
    this.effects.forEach(function (e) { e.t += dt; });
    this.effects = this.effects.filter(function (e) { return e.t < 0.45; });
    this.texts.forEach(function (t) { t.y -= 30 * dt; t.life -= dt; });
    this.texts = this.texts.filter(function (t) { return t.life > 0; });
    this.shake = Math.max(0, this.shake - dt * 30);
  };

  // ---- rendering ---------------------------------------------------------
  // view (optional) = visible world rect {x0, x1, y0}, wider/taller than the
  // field on most screens; the sky and the edge of the hills are stretched
  // to fill it so there are no black bars.
  Game.prototype.render = function (ctx, view) {
    // Sky and ground are pre-drawn wide enough to cover the whole view.
    const l = view ? Math.ceil(Math.max(0, -view.x0)) + 24 : 0;
    const r = view ? Math.ceil(Math.max(0, view.x1 - W)) + 24 : 0;
    const top = view ? Math.ceil(Math.max(0, -view.y0)) + 24 : 0;
    const key = l + ',' + r + ',' + top;
    if (this.bgKey !== key) {
      this.bgKey = key;
      this.ext = { l: l, r: r, t: top };
      this.skyCanvas = document.createElement('canvas');
      this.skyCanvas.width = W + l + r; this.skyCanvas.height = H + top;
      this.skin.drawSky(this.skyCanvas.getContext('2d'), W + l + r, H + top);
      this.groundCanvas = document.createElement('canvas');
      this.groundCanvas.width = W + l + r; this.groundCanvas.height = H + top;
      this.terrainDirty = true;
    }
    if (this.terrainDirty) { this.drawGround(); this.terrainDirty = false; }

    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    ctx.drawImage(this.skyCanvas, -this.ext.l, -this.ext.t);
    ctx.drawImage(this.groundCanvas, -this.ext.l, -this.ext.t);

    const self = this;
    this.tanks.forEach(function (t) { self.drawTank(ctx, t); });

    if (this.phase === 'aim' && this.isHumanTurn()) this.drawAimGuide(ctx, this.cur());

    this.projectiles.forEach(function (p) {
      self.skin.drawProjectile(ctx, p.id, p.x, p.y, self.time, self.tanks[p.owner].color);
    });

    this.effects.forEach(function (e) {
      const k = e.t / 0.45;
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * (0.6 + k * 0.6));
      g.addColorStop(0, 'rgba(255,255,255,' + (1 - k) + ')');
      g.addColorStop(0.4, self.skin.boom[0] + Math.round((1 - k) * 200).toString(16).padStart(2, '0'));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * (0.6 + k * 0.6), 0, Math.PI * 2);
      ctx.fill();
    });

    this.particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 0.4));
      self.skin.particle(ctx, p);
    });
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.font = 'bold 22px system-ui, sans-serif';
    this.texts.forEach(function (t) {
      ctx.globalAlpha = Math.min(1, t.life);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  };

  Game.prototype.drawGround = function () {
    const ctx = this.groundCanvas.getContext('2d');
    const e = this.ext, w = W + e.l + e.r, hh = H + e.t;
    // heights in canvas space, held flat past the edges of the field
    const h = new Float32Array(w);
    for (let x = 0; x < w; x++) h[x] = this.heights[Math.min(W - 1, Math.max(0, x - e.l))] + e.t;
    ctx.clearRect(0, 0, w, hh);
    let minY = hh;
    for (let x = 0; x < w; x++) minY = Math.min(minY, h[x]);
    const g = ctx.createLinearGradient(0, minY, 0, hh);
    g.addColorStop(0, this.skin.ground[0]);
    g.addColorStop(1, this.skin.ground[1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, hh);
    for (let x = 0; x < w; x++) ctx.lineTo(x, h[x]);
    ctx.lineTo(w, hh);
    ctx.closePath();
    ctx.fill();
    this.skin.drawGroundDetail(ctx, h, w, hh);
    ctx.strokeStyle = this.skin.edge;
    ctx.lineWidth = this.skin.edgeWidth;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let x = 0; x < w; x++) { if (x === 0) ctx.moveTo(x, h[x]); else ctx.lineTo(x, h[x]); }
    ctx.stroke();
  };

  Game.prototype.drawTank = function (ctx, t) {
    const c = this.center(t);
    const rad = t.angle * Math.PI / 180;
    // soft contact shadow so characters sit on the hill
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(t.x, t.y, 26, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(CHAR_SCALE, CHAR_SCALE);
    window.ArtilleryArt.drawCharacter(ctx, t.kind, 0, 0, rad, this.time + t.i * 1.3, t.hp > 0, t.color);
    ctx.restore();

    // marker over the tank whose turn it is
    if (t.i === this.current && (this.phase === 'aim' || this.phase === 'waitSync')) {
      const bob = Math.sin(this.time * 5) * 4;
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.moveTo(c.x - 9, c.y - 64 + bob);
      ctx.lineTo(c.x + 9, c.y - 64 + bob);
      ctx.lineTo(c.x, c.y - 53 + bob);
      ctx.closePath();
      ctx.fill();
    }
  };

  Game.prototype.drawAimGuide = function (ctx, t) {
    const c = this.center(t);
    const rad = t.angle * Math.PI / 180;
    const len = 40 + t.power * 1.1;
    ctx.save();
    ctx.setLineDash([4, 8]);
    ctx.lineDashOffset = -this.time * 30;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(c.x + Math.cos(rad) * 32, c.y - Math.sin(rad) * 32);
    ctx.lineTo(c.x + Math.cos(rad) * len, c.y - Math.sin(rad) * len);
    ctx.stroke();
    ctx.restore();
  };

  window.ArtilleryGame = Game;
})();
