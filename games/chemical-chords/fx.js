// Chemical Chords visuals: the lab bench, the beaker and everything that happens in it, drawn on one canvas.
(function (root) {
'use strict';

// visible wavelength (nm) to an sRGB colour, after Dan Bruton's approximation. Ultraviolet shows as dim violet and
// infrared as dim red, because we cannot see either.
function nmToRGB(nm){
  let r = 0, g = 0, b = 0;
  const w = Math.max(380, Math.min(780, nm));
  if (w < 440) { r = -(w - 440) / 60; b = 1; } else if (w < 490) { g = (w - 440) / 50; b = 1; } else if (w < 510) { g = 1; b = -(w - 510) / 20; }
  else if (w < 580) { r = (w - 510) / 70; g = 1; } else if (w < 645) { r = 1; g = -(w - 645) / 65; } else r = 1;
  let f = w < 420 ? 0.3 + 0.7 * (w - 380) / 40 : w > 700 ? 0.3 + 0.7 * (780 - w) / 80 : 1;
  if (nm < 380 || nm > 780) f *= 0.55;
  const c = x => Math.round(255 * Math.pow(x * f, 0.8));
  return [c(r), c(g), c(b)];
}
const hex = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rnd = (a, b) => a + Math.random() * (b - a);

function create(canvas){
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1, B = null;                 // B: beaker geometry
  let t = 0, shake = 0, flashA = 0, flashC = [255, 255, 255], darkA = 0, darkTarget = 0;
  const parts = [];
  const st = {
    level: 0, levelTarget: 0, col: [120, 180, 255], colTarget: [120, 180, 255], haze: 0, hazeCol: [220, 230, 255],
    solids: [], precip: 0, precipCol: [255, 255, 255], heap: 0, heapCol: [255, 255, 255],
    burner: 0, burnerCol: null, glow: 0, glowCol: [80, 120, 255], heat: 0,
    snake: 0, snakeCol: [20, 18, 16], crystals: 0, crystalCol: [230, 236, 244], molten: 0,
    skitter: null, emitters: [], hum: null, humLevel: 0, pour: null, coat: 0, coatCol: null, dissolve: 0
  };

  function resize(){
    const r = canvas.getBoundingClientRect();
    DPR = Math.min(2, root.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    const bw = Math.min(W * 0.44, H * 0.4, 260), bh = bw * 1.12;
    const cx = W / 2, bottom = H * 0.74;
    B = { cx, bw, bh, left: cx - bw / 2, right: cx + bw / 2, top: bottom - bh, bottom, lip: bw * 0.07 };
  }

  // ---------------------------------------------------------------- particles
  function add(p){ if (parts.length > 900) parts.splice(0, parts.length - 900); parts.push(p); return p; }
  const surfaceY = () => B.bottom - 6 - (B.bh - 18) * st.level;
  function inBeakerX(){ return rnd(B.left + 12, B.right - 12); }

  function emitBubbles(n){ for (let i = 0; i < n; i++) if (st.level > 0.05) add({ k: 'bub', x: inBeakerX(), y: rnd(surfaceY() + 8, B.bottom - 8 - st.precip * 30), r: rnd(1.5, 4.5), vy: rnd(-70, -150), life: 3 }); }
  function emitFoam(col, n){ for (let i = 0; i < n; i++) add({ k: 'foam', x: B.cx + rnd(-B.bw * 0.35, B.bw * 0.35), y: surfaceY(), r: rnd(6, 16), vx: rnd(-20, 20), vy: rnd(-140, -40), col, life: rnd(4, 7), age: 0 }); }
  function emitPrecip(col, n){ for (let i = 0; i < n; i++) add({ k: 'flake', x: inBeakerX(), y: rnd(surfaceY() + 4, B.bottom - 20), r: rnd(1, 3), vy: rnd(10, 40), col, life: 6, age: 0 }); }
  function emitGas(col, n, a){ for (let i = 0; i < n; i++) add({ k: 'gas', x: B.cx + rnd(-B.bw * 0.3, B.bw * 0.3), y: B.top + rnd(0, 20), r: rnd(10, 22), vx: rnd(-15, 15), vy: rnd(-50, -20), col, a: a || 0.35, life: rnd(3, 5), age: 0 }); }
  function emitSparks(col, n, x, y, spd){ for (let i = 0; i < n; i++) { const an = rnd(-Math.PI * 0.95, -Math.PI * 0.05), v = rnd(120, spd || 420); add({ k: 'spark', x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, col, life: rnd(0.5, 1.4), age: 0 }); } }
  function emitFlame(col, n, x, y, w, h){ for (let i = 0; i < n; i++) add({ k: 'flame', x: x + rnd(-w, w), y, vx: rnd(-10, 10), vy: rnd(-h * 1.6, -h * 0.8), r: rnd(6, 14) * (w / 20), col, life: rnd(0.4, 0.8), age: 0 }); }
  function emitGlitter(col, n){ for (let i = 0; i < n; i++) add({ k: 'glit', x: inBeakerX(), y: rnd(surfaceY(), surfaceY() + 30), vy: rnd(8, 22), vx: rnd(-6, 6), col, life: 7, age: 0, ph: rnd(0, 6) }); }

  // ---------------------------------------------------------------- what the beaker is asked to do
  function reset(){
    parts.length = 0; st.emitters = []; st.solids = []; st.level = 0; st.levelTarget = 0; st.haze = 0; st.precip = 0; st.heap = 0;
    st.glow = 0; st.snake = 0; st.crystals = 0; st.molten = 0; st.skitter = null; st.coat = 0; st.coatCol = null; st.heat = 0; darkTarget = 0; st.burner = 0;
  }
  function addSubstance(s){
    const c = hex(s.color);
    st.pour = { col: c, kind: s.kind, age: 0, life: 0.7 };
    if (s.kind === 'liquid' || s.kind === 'indicator') {
      const before = st.levelTarget;
      st.levelTarget = Math.min(0.78, st.levelTarget + (before < 0.05 ? 0.38 : 0.16));
      const w = before < 0.05 ? 1 : (s.kind === 'indicator' ? 0.55 : 0.35);
      st.colTarget = before < 0.05 ? c : mix(st.colTarget, c, w);
      if (before < 0.05) st.col = c.slice();
    } else if (s.kind === 'gas') { st.haze = Math.min(0.5, st.haze + 0.3); st.hazeCol = c; }
    else if (s.kind === 'metal') st.solids.push({ look: s.look || 'lump', col: c, id: s.id, size: 1, x: rnd(-0.18, 0.18) });
    else { // powders and crystals
      for (let i = 0; i < 40; i++) add({ k: 'grain', x: B.cx + rnd(-14, 14), y: B.top - rnd(0, 40), vy: rnd(60, 140), col: c, life: 3, age: 0 });
      if (st.levelTarget < 0.05 || s.look === 'powder') { st.heap = Math.min(1, st.heap + 0.5); st.heapCol = c; }
    }
  }
  // fx from data.js: liquid foam bubbles precip gas smoke flame flash sparks glow coat crystals heat snake boil skitter
  // shock dark molten glitter dissolve burner dur
  function react(fx){
    const dur = fx.dur || 5, e = { fx, age: 0, dur };
    st.emitters.push(e);
    if (fx.liquid) { st.colTarget = hex(fx.liquid); if (st.levelTarget < 0.05) { st.levelTarget = 0.3; st.col = st.colTarget.slice(); } }
    if (fx.precip) st.precipCol = hex(fx.precip);
    if (fx.flash) { flashA = 1; flashC = hex(fx.flash); }
    if (fx.shock) shake = 14;
    if (fx.dark || fx.glow) { st.glowCol = hex(fx.glow || '#ffffff'); if (fx.dark) darkTarget = 0.82; }
    if (fx.coat) st.coatCol = hex(fx.coat);
    if (fx.crystals) st.crystalCol = hex(fx.crystals);
    if (fx.snake) st.snakeCol = hex(fx.snake);
    if (fx.skitter) st.skitter = { x: B.cx, dir: 1, col: hex(fx.skitter), age: 0, life: dur * 0.9 };
    if (fx.burner) st.burnerCol = hex(fx.burner);
    if (fx.molten) st.moltenCol = hex(fx.molten);
  }
  function heat(on){ st.burner = on ? 1 : 0; if (!on) st.burnerCol = null; }
  function setHum(ps){ st.hum = ps; }
  function setHumLevel(x){ st.humLevel = x; }

  // ---------------------------------------------------------------- update
  function update(dt){
    t += dt;
    st.level += (st.levelTarget - st.level) * Math.min(1, dt * 3);
    for (let i = 0; i < 3; i++) st.col[i] += (st.colTarget[i] - st.col[i]) * Math.min(1, dt * 1.2);
    flashA = Math.max(0, flashA - dt * 1.6); shake = Math.max(0, shake - dt * 30);
    darkA += (darkTarget - darkA) * Math.min(1, dt * 1.5);
    st.heat = Math.max(0, st.heat - dt * 0.25);
    if (st.pour) { st.pour.age += dt; if (st.pour.age > st.pour.life) st.pour = null; }

    for (const e of st.emitters) {
      e.age += dt; const f = e.fx, k = Math.max(0, 1 - e.age / e.dur), on = e.age < e.dur;
      if (!on) continue;
      if (f.bubbles) emitBubbles(Math.ceil(f.bubbles * 3 * k * dt * 30));
      if (f.foam && e.age < e.dur * 0.75) emitFoam(hex(f.foam), Math.ceil(dt * 40 * k));
      if (f.precip && e.age < e.dur * 0.6) { emitPrecip(hex(f.precip), Math.ceil(dt * 90)); st.precip = Math.min(1, st.precip + dt * 0.25); }
      if (f.gas && Math.random() < dt * 14 * k) emitGas(hex(f.gas), 1, f.gas === '#ffffff' ? 0.22 : 0.45);
      if (f.smoke && Math.random() < dt * 18 * k) emitGas(hex(f.smoke), 1, 0.32);
      if (f.flame && e.age < e.dur * 0.7) emitFlame(hex(f.flame), Math.ceil(dt * 70), st.skitter ? st.skitter.x : B.cx, surfaceY() - 2, st.skitter ? 10 : B.bw * 0.3, 80);
      if (f.sparks && e.age < e.dur * 0.7) emitSparks(hex(f.sparks), Math.ceil(dt * 60), B.cx + rnd(-B.bw * 0.2, B.bw * 0.2), surfaceY(), 520);
      if (f.glow) st.glow = Math.min(1, st.glow + dt * 0.8);
      if (f.heat) st.heat = Math.min(1, st.heat + dt);
      if (f.coat) st.coat = Math.min(1, st.coat + dt / (e.dur * 0.8));
      if (f.crystals) st.crystals = Math.min(1, st.crystals + dt / (e.dur * 0.9));
      if (f.snake) st.snake = Math.min(1, st.snake + dt / (e.dur * 0.85));
      if (f.molten) st.molten = Math.min(1, st.molten + dt / e.dur);
      if (f.glitter && e.age > e.dur * 0.3 && Math.random() < dt * 30) emitGlitter(hex(f.glitter), 1);
      if (f.boil) { emitBubbles(Math.ceil(dt * 50)); if (Math.random() < dt * 8) emitGas([255, 255, 255], 1, 0.2); }
      if (f.dissolve) for (const s of st.solids) if (s.look !== 'nail' && s.id !== 'copper' || f.dissolve > 1) s.size = Math.max(0, s.size - dt / e.dur);
      if (f.burner) st.burner = 1;
    }
    st.emitters = st.emitters.filter(e => e.age < e.dur + 0.2 || (e.fx.glow && e.fx.dark));
    if (!st.emitters.some(e => e.fx.glow)) st.glow = Math.max(0, st.glow - dt * 0.6);
    if (!st.emitters.some(e => e.fx.dark)) darkTarget = 0;
    if (st.burner && !st.burnerCol && Math.random() < dt * 4) {}

    if (st.skitter) {
      const s = st.skitter; s.age += dt;
      s.x += s.dir * dt * B.bw * 0.9 * (1 + Math.sin(t * 7) * 0.4);
      if (s.x > B.right - 20) { s.x = B.right - 20; s.dir = -1; } if (s.x < B.left + 20) { s.x = B.left + 20; s.dir = 1; }
      if (Math.random() < dt * 40) add({ k: 'bub', x: s.x + rnd(-6, 6), y: surfaceY() + 3, r: rnd(1, 3), vy: -40, life: 0.3 });
      if (s.age > s.life) st.skitter = null;
    }

    const sy = surfaceY();
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.age = (p.age || 0) + dt;
      switch (p.k) {
        case 'bub': p.y += p.vy * dt; p.x += Math.sin(t * 6 + p.r * 9) * 12 * dt; if (p.y < sy) { parts.splice(i, 1); continue; } break;
        case 'grain': p.y += p.vy * dt; if (p.y > (st.level > 0.05 ? sy : B.bottom - 10)) { parts.splice(i, 1); continue; } break;
        case 'foam': p.vy += 40 * dt; p.vy = Math.min(p.vy, 30); p.x += p.vx * dt; p.y += p.vy * dt * 0.6; p.r += dt * 4;
          if (p.y > B.top - 4 && p.y < sy && (p.x < B.left + 6 || p.x > B.right - 6)) p.vx *= -1;
          if (p.y < B.top - 10) { p.vy = Math.max(p.vy, -30); p.vx += (p.x < B.cx ? -1 : 1) * 30 * dt; }
          if (p.y > B.bottom + 40 && p.x > B.left && p.x < B.right) p.y = B.bottom + 40;
          break;
        case 'flake': p.y += p.vy * dt; p.x += Math.sin(t * 2 + p.r * 10) * 8 * dt; if (p.y > B.bottom - 8 - st.precip * 24) { parts.splice(i, 1); continue; } break;
        case 'gas': p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 22; break;
        case 'spark': p.vy += 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt; break;
        case 'flame': p.x += p.vx * dt; p.y += p.vy * dt; p.r *= (1 - dt * 1.2); break;
        case 'glit': p.y += p.vy * dt; p.x += p.vx * dt; if (p.y > B.bottom - 10 - st.precip * 24) { p.vy = 0; p.vx = 0; } break;
      }
      if (p.age > p.life) parts.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- draw
  function beakerPath(c, inset){
    const i = inset || 0, r = 18;
    c.beginPath();
    c.moveTo(B.left + i - B.lip * (i ? 0 : 1), B.top + i * 0.2);
    c.lineTo(B.left + i, B.top + 10);
    c.lineTo(B.left + i, B.bottom - r - i);
    c.quadraticCurveTo(B.left + i, B.bottom - i, B.left + r + i, B.bottom - i);
    c.lineTo(B.right - r - i, B.bottom - i);
    c.quadraticCurveTo(B.right - i, B.bottom - i, B.right - i, B.bottom - r - i);
    c.lineTo(B.right - i, B.top + 10);
    c.lineTo(B.right - i + B.lip * (i ? 0 : 1) * 0.3, B.top + i * 0.2);
  }
  function interior(c){
    const i = 5, r = 14;
    c.beginPath();
    c.moveTo(B.left + i, B.top);
    c.lineTo(B.left + i, B.bottom - r - i); c.quadraticCurveTo(B.left + i, B.bottom - i, B.left + r + i, B.bottom - i);
    c.lineTo(B.right - r - i, B.bottom - i); c.quadraticCurveTo(B.right - i, B.bottom - i, B.right - i, B.bottom - r - i);
    c.lineTo(B.right - i, B.top); c.closePath();
  }

  function drawBackground(c){
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1020'); g.addColorStop(0.6, '#0f1830'); g.addColorStop(1, '#070a14');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // faint graph-paper grid, like a lab notebook
    c.strokeStyle = 'rgba(120,160,255,0.05)'; c.lineWidth = 1;
    const s = 28; c.beginPath();
    for (let x = (W / 2) % s; x < W; x += s) { c.moveTo(x, 0); c.lineTo(x, H); }
    for (let y = 0; y < H; y += s) { c.moveTo(0, y); c.lineTo(W, y); }
    c.stroke();
    // bench
    const by = B.bottom + B.bh * 0.42;
    const bg = c.createLinearGradient(0, by, 0, H);
    bg.addColorStop(0, '#1b2440'); bg.addColorStop(1, '#0a0e1a');
    c.fillStyle = bg; c.fillRect(0, by, W, H - by);
    c.fillStyle = 'rgba(160,190,255,0.12)'; c.fillRect(0, by, W, 1.5);
  }

  function drawHum(c){
    const ps = st.hum; if (!ps || !ps.length) return;
    const lvl = st.humLevel; if (lvl <= 0.01) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    const cx = B.cx, cy = B.bottom - B.bh * 0.45, base = B.bw * 0.72;
    ps.forEach((p, i) => {
      const col = nmToRGB(p.nm), lobes = 3 + (((Math.round(p.midi) % 12) + 12) % 12), amp = 3 + 9 * p.gain * lvl;
      const r0 = base + i * 11 + 10 * Math.sin(t * 0.6 + i);
      c.strokeStyle = rgba(col, (0.18 + 0.5 * p.gain) * lvl); c.lineWidth = 1.6;
      c.beginPath();
      for (let a = 0; a <= 64; a++) {
        const an = a / 64 * Math.PI * 2, rr = r0 + amp * Math.sin(an * lobes + t * (1.5 + (p.hz % 3)));
        const x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr * 0.62;
        a ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
    });
    c.restore();
  }

  function drawBurner(c){
    const cx = B.cx, top = B.bottom + 10, h = B.bh * 0.36;
    // tripod
    c.strokeStyle = '#3a4566'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(B.left - 6, B.bottom + 2); c.lineTo(B.right + 6, B.bottom + 2);
    c.moveTo(B.left + 4, B.bottom + 2); c.lineTo(B.left - 14, top + h + 6); c.moveTo(B.right - 4, B.bottom + 2); c.lineTo(B.right + 14, top + h + 6); c.stroke();
    // burner body
    const bw = 18;
    const g = c.createLinearGradient(cx - bw, 0, cx + bw, 0); g.addColorStop(0, '#59647f'); g.addColorStop(0.5, '#a9b3c9'); g.addColorStop(1, '#4a536b');
    c.fillStyle = g; c.fillRect(cx - bw / 2, top + h * 0.35, bw, h * 0.6);
    c.fillStyle = '#39415a'; c.beginPath(); c.ellipse(cx, top + h * 0.97, bw * 1.5, 6, 0, 0, Math.PI * 2); c.fill();
    if (!st.burner) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    const fy = top + h * 0.35, fh = h * 0.95 + Math.sin(t * 30) * 2;
    const col = st.burnerCol;
    const cone = (w, hh, colr, a) => { const gr = c.createRadialGradient(cx, fy - hh * 0.3, 1, cx, fy - hh * 0.3, hh); gr.addColorStop(0, rgba(colr, a)); gr.addColorStop(1, rgba(colr, 0));
      c.fillStyle = gr; c.beginPath(); c.moveTo(cx - w, fy); c.quadraticCurveTo(cx - w * 0.8, fy - hh * 0.6, cx, fy - hh); c.quadraticCurveTo(cx + w * 0.8, fy - hh * 0.6, cx + w, fy); c.closePath(); c.fill(); };
    if (col) { cone(16, fh * 1.25, col, 0.95); cone(10, fh * 0.8, mix(col, [255, 255, 255], 0.4), 0.7); if (Math.random() < 0.5) emitFlame(col, 1, cx, fy - 4, 6, 60); }
    else { cone(10, fh, [70, 120, 255], 0.75); cone(6, fh * 0.55, [150, 200, 255], 0.8); }
    c.restore();
    if (col) { // nichrome loop holding the sample
      c.strokeStyle = '#c9cfdc'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(cx + 70, fy - fh * 1.6); c.lineTo(cx + 6, fy - fh * 0.6); c.stroke();
      c.beginPath(); c.arc(cx + 3, fy - fh * 0.55, 3.5, 0, Math.PI * 2); c.stroke();
    }
  }

  function drawSolids(c){
    const floor = B.bottom - 8 - st.precip * 22;
    let wireX = B.cx;
    st.solids.forEach((s, i) => {
      if (s.size <= 0.02) return;
      const x = B.cx + s.x * B.bw + (i - (st.solids.length - 1) / 2) * 20, sz = s.size;
      const col = st.coatCol ? mix(s.col, st.coatCol, st.coat) : s.col;
      if (s.look === 'wire') wireX = x;
      c.save(); c.fillStyle = rgba(col, 1); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1;
      if (s.look === 'nail') { c.translate(x, floor - B.bh * 0.25); c.rotate(-0.5); const L = B.bh * 0.62; c.fillRect(-2.5, -L / 2, 5, L); c.fillRect(-7, -L / 2 - 3, 14, 4); c.beginPath(); c.moveTo(-2.5, L / 2); c.lineTo(0, L / 2 + 8); c.lineTo(2.5, L / 2); c.fill(); }
      else if (s.look === 'wire') { c.strokeStyle = rgba(col, 1); c.lineWidth = 2.5; c.beginPath(); for (let k = 0; k < 40; k++) { const yy = floor - 6 - k * B.bh * 0.012, xx = x + Math.sin(k * 0.9) * 12; k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke(); c.beginPath(); c.moveTo(x, floor - 6 - 39 * B.bh * 0.012); c.lineTo(x + 4, B.top - 18); c.stroke(); }
      else if (s.look === 'ribbon') { c.translate(x, floor - 12); c.rotate(-0.25); c.fillRect(-B.bw * 0.22 * sz, -2, B.bw * 0.44 * sz, 4); }
      else if (s.look === 'granules') { for (let k = 0; k < 7; k++) { c.beginPath(); c.arc(x + (k - 3) * 7 * sz, floor - 4 - (k % 2) * 4, 4 * sz, 0, Math.PI * 2); c.fill(); c.stroke(); } }
      else if (s.look === 'powder') { c.beginPath(); c.ellipse(x, floor, B.bw * 0.2 * sz, 7 * sz, 0, Math.PI, 0); c.fill(); }
      else { const y = st.level > 0.05 && ['na', 'k', 'li'].includes(s.id) ? surfaceY() : floor - 8; c.beginPath(); c.ellipse(x, y, 11 * sz, 8 * sz, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
      c.restore();
    });
    if (st.crystals > 0) { // silver branches growing off the copper
      c.save(); c.strokeStyle = rgba(st.crystalCol, 0.9); c.lineWidth = 1.2; c.globalCompositeOperation = 'lighter';
      const n = Math.floor(40 * st.crystals);
      for (let k = 0; k < n; k++) {
        const y = floor - 8 - (k / 40) * B.bh * 0.46, x = wireX + Math.sin(k * 0.9) * 12, L = 6 + 22 * st.crystals * (0.5 + 0.5 * Math.sin(k * 3.1));
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + L, y - L * 0.5); c.moveTo(x + L * 0.5, y - L * 0.25); c.lineTo(x + L * 0.7, y - L * 0.8);
        c.moveTo(x, y); c.lineTo(x - L, y - L * 0.4); c.moveTo(x - L * 0.5, y - L * 0.2); c.lineTo(x - L * 0.8, y + L * 0.3); c.stroke();
      }
      c.restore();
    }
  }

  function drawLiquid(c){
    const sy = surfaceY();
    c.save(); interior(c); c.clip();
    if (st.haze > 0) { const hg = c.createLinearGradient(0, B.top, 0, B.bottom); hg.addColorStop(0, rgba(st.hazeCol, 0)); hg.addColorStop(1, rgba(st.hazeCol, st.haze * 0.5)); c.fillStyle = hg; c.fillRect(B.left, B.top, B.bw, B.bh); }
    if (st.level > 0.01) {
      const g = c.createLinearGradient(0, sy, 0, B.bottom);
      g.addColorStop(0, rgba(mix(st.col, [255, 255, 255], 0.2), 0.78)); g.addColorStop(1, rgba(mix(st.col, [0, 0, 0], 0.35), 0.92));
      c.fillStyle = g;
      c.beginPath(); c.moveTo(B.left, B.bottom);
      for (let x = B.left; x <= B.right; x += 6) c.lineTo(x, sy + Math.sin(x * 0.05 + t * 2.2) * 2 + Math.sin(x * 0.11 - t * 3) * 1.2 * (1 + st.heat * 2));
      c.lineTo(B.right, B.bottom); c.closePath(); c.fill();
      // caustic shimmer
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = rgba(mix(st.col, [255, 255, 255], 0.6), 0.12); c.lineWidth = 2;
      for (let k = 0; k < 4; k++) { c.beginPath(); for (let x = B.left; x <= B.right; x += 8) { const y = sy + 14 + k * 18 + Math.sin(x * 0.04 + t * 1.3 + k) * 5; x === B.left ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); }
      c.globalCompositeOperation = 'source-over';
    }
    if (st.glow > 0) {
      c.globalCompositeOperation = 'lighter';
      const gg = c.createRadialGradient(B.cx, B.bottom - B.bh * 0.25, 4, B.cx, B.bottom - B.bh * 0.25, B.bw * 0.8);
      gg.addColorStop(0, rgba(st.glowCol, 0.85 * st.glow)); gg.addColorStop(1, rgba(st.glowCol, 0));
      c.fillStyle = gg; c.fillRect(B.left, B.top, B.bw, B.bh);
      c.globalCompositeOperation = 'source-over';
    }
    if (st.precip > 0) { // settled layer
      const ph = st.precip * 22; const pg = c.createLinearGradient(0, B.bottom - ph - 8, 0, B.bottom);
      pg.addColorStop(0, rgba(st.precipCol, 0.0)); pg.addColorStop(0.35, rgba(st.precipCol, 0.85)); pg.addColorStop(1, rgba(mix(st.precipCol, [0, 0, 0], 0.2), 1));
      c.fillStyle = pg; c.fillRect(B.left, B.bottom - ph - 8, B.bw, ph + 8);
    }
    if (st.heap > 0 && st.level < 0.05) { c.fillStyle = rgba(st.heapCol, 0.95); c.beginPath(); c.ellipse(B.cx, B.bottom - 6, B.bw * 0.3 * st.heap, 12 * st.heap, 0, Math.PI, 0); c.fill(); }
    if (st.molten > 0) {
      c.globalCompositeOperation = 'lighter';
      const mc = st.moltenCol || [255, 180, 70], mg = c.createRadialGradient(B.cx, B.bottom - 10, 2, B.cx, B.bottom - 10, B.bw * 0.5);
      mg.addColorStop(0, rgba([255, 250, 220], st.molten)); mg.addColorStop(0.4, rgba(mc, 0.9 * st.molten)); mg.addColorStop(1, rgba(mc, 0));
      c.fillStyle = mg; c.fillRect(B.left, B.top, B.bw, B.bh);
      c.globalCompositeOperation = 'source-over';
    }
    drawSolids(c);
    for (const p of parts) {
      if (p.k === 'bub') { c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1; c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.stroke(); }
      else if (p.k === 'flake') { c.fillStyle = rgba(p.col, 0.85); c.fillRect(p.x, p.y, p.r * 1.6, p.r); }
      else if (p.k === 'glit') { const tw = 0.5 + 0.5 * Math.sin(t * 9 + p.ph); c.fillStyle = rgba(mix(p.col, [255, 255, 255], tw * 0.6), 0.6 + 0.4 * tw); c.save(); c.translate(p.x, p.y); c.rotate(p.ph + t); c.fillRect(-2.5, -1, 5, 2); c.restore(); }
    }
    c.restore();
  }

  function drawGlass(c){
    // glass body: faint fill, bright rim, a vertical highlight and graduation marks
    c.save();
    beakerPath(c); c.strokeStyle = 'rgba(200,225,255,0.65)'; c.lineWidth = 3; c.lineJoin = 'round'; c.stroke();
    c.fillStyle = 'rgba(160,200,255,0.05)'; interior(c); c.fill();
    const hl = c.createLinearGradient(B.left, 0, B.left + B.bw * 0.25, 0); hl.addColorStop(0, 'rgba(255,255,255,0.22)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hl; c.fillRect(B.left + 6, B.top + 14, B.bw * 0.18, B.bh - 40);
    c.strokeStyle = 'rgba(200,225,255,0.35)'; c.lineWidth = 1.2; c.font = '9px system-ui, sans-serif'; c.fillStyle = 'rgba(200,225,255,0.45)';
    for (let k = 1; k <= 4; k++) { const y = B.bottom - 6 - (B.bh - 18) * k * 0.2; c.beginPath(); c.moveTo(B.right - 22, y); c.lineTo(B.right - 8, y); c.stroke(); c.fillText(k * 50 + '', B.right - 44, y + 3); }
    c.restore();
  }

  function drawAbove(c){
    // snake of carbon rising out of the beaker
    if (st.snake > 0) {
      const h = st.snake * B.bh * 1.25, w = B.bw * 0.34, y0 = B.bottom - 10;
      c.save();
      const g = c.createLinearGradient(B.cx - w, 0, B.cx + w, 0); g.addColorStop(0, '#050404'); g.addColorStop(0.5, rgba(mix(st.snakeCol, [80, 70, 60], 0.4), 1)); g.addColorStop(1, '#050404');
      c.fillStyle = g; c.beginPath(); c.moveTo(B.cx - w, y0);
      for (let k = 0; k <= 20; k++) { const y = y0 - h * k / 20; c.lineTo(B.cx - w + Math.sin(k * 1.7 + 1) * 5 + (k / 20) * 6, y); }
      for (let k = 20; k >= 0; k--) { const y = y0 - h * k / 20; c.lineTo(B.cx + w + Math.sin(k * 2.3) * 5 - (k / 20) * 6, y); }
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.05)'; for (let k = 0; k < 30; k++) { c.beginPath(); c.arc(B.cx + Math.sin(k * 7.3) * w * 0.7, y0 - (k / 30) * h, 2 + (k % 3), 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
    for (const p of parts) {
      if (p.k === 'foam') { const a = Math.min(1, (p.life - p.age) / 1.5); const g = c.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, 1, p.x, p.y, p.r); g.addColorStop(0, rgba(mix(p.col, [255, 255, 255], 0.6), a)); g.addColorStop(1, rgba(p.col, a * 0.85)); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill(); }
      else if (p.k === 'gas') { const a = p.a * Math.max(0, 1 - p.age / p.life); const g = c.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r); g.addColorStop(0, rgba(p.col, a)); g.addColorStop(1, rgba(p.col, 0)); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill(); }
      else if (p.k === 'grain') { c.fillStyle = rgba(p.col, 0.95); c.fillRect(p.x, p.y, 2, 2); }
    }
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      if (p.k === 'spark') { const a = Math.max(0, 1 - p.age / p.life); c.strokeStyle = rgba(p.col, a); c.lineWidth = 1.6; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); c.stroke(); }
      else if (p.k === 'flame') { const a = Math.max(0, 1 - p.age / p.life); const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.6); g.addColorStop(0, rgba(mix(p.col, [255, 255, 255], 0.5), 0.55 * a)); g.addColorStop(1, rgba(p.col, 0)); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r * 1.6, 0, Math.PI * 2); c.fill(); }
    }
    if (st.skitter) { const s = st.skitter, y = surfaceY() - 3; const g = c.createRadialGradient(s.x, y, 0, s.x, y, 26); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.3, rgba(s.col, 0.6)); g.addColorStop(1, rgba(s.col, 0)); c.fillStyle = g; c.beginPath(); c.arc(s.x, y, 26, 0, Math.PI * 2); c.fill(); }
    if (st.heat > 0.05) { c.strokeStyle = `rgba(255,190,120,${0.12 * st.heat})`; c.lineWidth = 2; for (let k = 0; k < 5; k++) { c.beginPath(); for (let y = 0; y < 60; y += 4) { const x = B.left + B.bw * (0.2 + k * 0.15) + Math.sin(y * 0.2 + t * 6 + k) * 4; y ? c.lineTo(x, B.top - y) : c.moveTo(x, B.top - y); } c.stroke(); } }
    c.restore();
  }

  function drawPour(c){
    const p = st.pour; if (!p) return;
    const a = Math.min(1, (p.life - p.age) / 0.3), x = B.cx - B.bw * 0.08;
    if (p.kind === 'liquid' || p.kind === 'indicator') { c.strokeStyle = rgba(p.col, 0.8 * a); c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, B.top - 70); c.quadraticCurveTo(x + 4, B.top - 20, x + 2, surfaceY()); c.stroke(); }
  }

  function draw(){
    c0();
    const c = ctx;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (shake > 0) c.translate(rnd(-shake, shake), rnd(-shake, shake));
    drawBackground(c);
    // ambient glow of the room from whatever is shining
    const amb = st.glow > 0 ? st.glowCol : st.burnerCol || null;
    if (amb) { const ag = c.createRadialGradient(B.cx, B.bottom - B.bh * 0.3, 10, B.cx, B.bottom - B.bh * 0.3, Math.max(W, H) * 0.7); ag.addColorStop(0, rgba(amb, 0.22 * Math.max(st.glow, st.burnerCol ? 0.8 : 0))); ag.addColorStop(1, rgba(amb, 0)); c.fillStyle = ag; c.fillRect(0, 0, W, H); }
    if (darkA > 0.01) { c.fillStyle = `rgba(2,3,8,${darkA})`; c.fillRect(0, 0, W, H); }
    drawHum(c);
    drawBurner(c);
    drawPour(c);
    drawLiquid(c);
    drawGlass(c);
    drawAbove(c);
    if (flashA > 0) { c.fillStyle = rgba(flashC, flashA * 0.85); c.fillRect(-20, -20, W + 40, H + 40); }
  }
  function c0(){ ctx.setTransform(1, 0, 0, 1, 0, 0); }

  resize();
  return { resize, update, draw, reset, addSubstance, react, heat, setHum, setHumLevel, get beaker(){ return B; }, get state(){ return st; }, get particles(){ return parts.length; } };
}

// the spectrum strip: 180 to 950 nm, the visible part in colour, every line of the current hum as a glowing bar
function drawSpectrum(canvas, ps, level, playingNm){
  const c = canvas.getContext('2d'), DPR = Math.min(2, root.devicePixelRatio || 1), r = canvas.getBoundingClientRect();
  const W = Math.max(1, r.width), H = Math.max(1, r.height);
  if (canvas.width !== Math.round(W * DPR)) { canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); }
  c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
  const lo = 180, hi = 950, X = nm => (nm - lo) / (hi - lo) * W, bandY = H - 16;
  c.fillStyle = '#0a0d18'; c.fillRect(0, 0, W, H);
  for (let nm = 380; nm < 780; nm += 2) { const col = nmToRGB(nm); c.fillStyle = rgba(col, 0.22); c.fillRect(X(nm), 0, X(nm + 2) - X(nm) + 0.5, bandY); }
  c.fillStyle = 'rgba(160,140,255,0.06)'; c.fillRect(0, 0, X(380), bandY);
  c.fillStyle = 'rgba(255,90,70,0.05)'; c.fillRect(X(780), 0, W - X(780), bandY);
  c.font = '600 9px system-ui, sans-serif'; c.fillStyle = 'rgba(200,210,240,0.55)'; c.textBaseline = 'middle';
  c.fillText(W < 420 ? 'UV' : 'ULTRAVIOLET', 6, H - 8); c.textAlign = 'right'; c.fillText(W < 420 ? 'IR' : 'INFRARED', W - 6, H - 8); c.textAlign = 'center';
  [400, 500, 600, 700].forEach(nm => { c.fillStyle = 'rgba(200,210,240,0.4)'; c.fillText(nm + ' nm', X(nm), H - 8); c.fillRect(X(nm), bandY, 1, 3); });
  c.textAlign = 'left';
  if (!ps) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const p of ps) {
    const x = X(p.nm), col = nmToRGB(p.nm), h = (bandY - 4) * (0.35 + 0.65 * Math.min(1, p.w)), a = 0.55 + 0.45 * level;
    const hot = playingNm != null && Math.abs(playingNm - p.nm) < 0.01;
    if (p.absorbed) { c.setLineDash([3, 3]); c.strokeStyle = rgba(col, 0.9); c.lineWidth = 2; c.beginPath(); c.moveTo(x, bandY); c.lineTo(x, bandY - h); c.stroke(); c.setLineDash([]); continue; }
    const g = c.createLinearGradient(0, bandY, 0, bandY - h); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0.05));
    c.fillStyle = g; c.fillRect(x - (p.band ? 4 : 1.5) - (hot ? 1 : 0), bandY - h, (p.band ? 8 : 3) + (hot ? 2 : 0), h);
  }
  c.restore();
}

const API = { create, drawSpectrum, nmToRGB, hex };
root.CC_FX = API;
})(typeof window !== 'undefined' ? window : globalThis);
