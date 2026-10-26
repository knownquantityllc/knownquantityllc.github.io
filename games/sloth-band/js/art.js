// Vector art for Sloth Band vs. Platypus. Everything is drawn with canvas
// paths so the game ships with no image assets.
(function () {
  'use strict';

  const TAU = Math.PI * 2;

  const SLOTHS = {
    drums:   { name: 'Dusty',   role: 'Drums',   color: '#d64545', fur: '#a27a52', r: 24, density: 0.004, tip: 'Tap mid-air: BOOM! A drum blast knocks everything nearby flying.' },
    trumpet: { name: 'Toot',    role: 'Trumpet', color: '#f2b632', fur: '#b08559', r: 22, density: 0.0035, tip: 'Tap mid-air: a fanfare blasts Toot forward at top speed.' },
    guitar:  { name: 'Strum',   role: 'Guitar',  color: '#3b82d6', fur: '#9c7450', r: 23, density: 0.004, tip: 'Tap mid-air: strum a chord and split into three sloths.' },
    tuba:    { name: 'Big Lou', role: 'Tuba',    color: '#8a4fd1', fur: '#8f6a47', r: 30, density: 0.009, tip: 'Heavy hitter. Tap mid-air to slam straight down.' },
  };

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawInstrument(ctx, inst, r, t) {
    const s = r / 24;
    ctx.save();
    ctx.scale(s, s);
    ctx.lineJoin = 'round';
    switch (inst) {
      case 'drums': {
        // Drumsticks crossed behind the head.
        ctx.strokeStyle = '#f4e2c0';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-26, -30); ctx.lineTo(6, -8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(26, -30); ctx.lineTo(-6, -8); ctx.stroke();
        ctx.fillStyle = '#f4e2c0';
        ctx.beginPath(); ctx.arc(-26, -30, 3.5, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(26, -30, 3.5, 0, TAU); ctx.fill();
        break;
      }
      case 'trumpet': {
        ctx.fillStyle = '#f2b632';
        ctx.strokeStyle = '#a3740f';
        ctx.lineWidth = 2;
        rr(ctx, 10, 4, 22, 6, 3); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(30, 7); ctx.lineTo(42, -3); ctx.lineTo(42, 17); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffe08a';
        ctx.fillRect(16, 0, 3, 5); ctx.fillRect(22, 0, 3, 5);
        break;
      }
      case 'guitar': {
        ctx.save();
        ctx.rotate(-0.6);
        ctx.fillStyle = '#5a3a1e';
        ctx.fillRect(-3, -46, 6, 30);
        ctx.fillStyle = '#3b82d6';
        ctx.strokeStyle = '#1d4f8f';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, -14, 11, 9, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1d4f8f';
        rr(ctx, -5, -52, 10, 9, 2); ctx.fill();
        ctx.restore();
        break;
      }
      case 'tuba': {
        ctx.strokeStyle = '#c99a1e';
        ctx.fillStyle = '#e9c046';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(-20, -18, 13, Math.PI * 0.6, Math.PI * 2.1); ctx.lineWidth = 6; ctx.strokeStyle = '#e9c046'; ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = '#c99a1e';
        ctx.beginPath(); ctx.ellipse(-12, -36, 14, 6, -0.2, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#7a5a0a';
        ctx.beginPath(); ctx.ellipse(-12, -36, 9, 3, -0.2, 0, TAU); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  // A sloth: round furry body, cream face mask, dark eye stripes, sleepy smile.
  function drawSloth(ctx, x, y, r, angle, inst, opts) {
    const o = opts || {};
    const def = SLOTHS[inst] || SLOTHS.drums;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    if (inst !== 'trumpet') drawInstrument(ctx, inst, r, o.t || 0);

    // Arms (little hooked claws) peek out the sides.
    ctx.fillStyle = darken(def.fur, 0.15);
    ctx.beginPath(); ctx.ellipse(-r * 0.92, r * 0.25, r * 0.28, r * 0.4, 0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.92, r * 0.25, r * 0.28, r * 0.4, -0.4, 0, TAU); ctx.fill();

    // Body with a soft shaggy edge and a little shading.
    const fur = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
    fur.addColorStop(0, lighten(def.fur, 0.18));
    fur.addColorStop(1, def.fur);
    ctx.fillStyle = fur;
    ctx.beginPath();
    const tufts = 16;
    for (let i = 0; i <= tufts; i++) {
      const a = (i / tufts) * TAU;
      const px = Math.cos(a) * r * 0.95, py = Math.sin(a) * r * 0.95;
      if (i === 0) { ctx.moveTo(px, py); continue; }
      const am = ((i - 0.5) / tufts) * TAU;
      ctx.quadraticCurveTo(Math.cos(am) * r * 1.08, Math.sin(am) * r * 1.08, px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = darken(def.fur, 0.3);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Band color headband.
    ctx.strokeStyle = def.color;
    ctx.lineWidth = r * 0.18;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.82, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();

    // Face mask.
    ctx.fillStyle = '#ecd9b4';
    ctx.beginPath(); ctx.ellipse(0, r * 0.12, r * 0.68, r * 0.55, 0, 0, TAU); ctx.fill();

    // Eye stripes.
    ctx.fillStyle = '#4a321e';
    ctx.beginPath(); ctx.ellipse(-r * 0.32, r * 0.05, r * 0.26, r * 0.13, 0.35, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.32, r * 0.05, r * 0.26, r * 0.13, -0.35, 0, TAU); ctx.fill();

    // Eyes.
    if (o.blink) {
      ctx.strokeStyle = '#120a04'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.04); ctx.lineTo(-r * 0.22, r * 0.04); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.22, r * 0.04); ctx.lineTo(r * 0.4, r * 0.04); ctx.stroke();
    } else {
      ctx.fillStyle = '#120a04';
      ctx.beginPath(); ctx.arc(-r * 0.3, r * 0.04, r * 0.09, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.3, r * 0.04, r * 0.09, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-r * 0.27, r * 0.01, r * 0.03, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.33, r * 0.01, r * 0.03, 0, TAU); ctx.fill();
    }

    // Nose and smile.
    ctx.fillStyle = '#2b1a0e';
    ctx.beginPath(); ctx.ellipse(0, r * 0.25, r * 0.1, r * 0.07, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2b1a0e';
    ctx.lineWidth = Math.max(1.2, r * 0.06);
    ctx.beginPath();
    if (o.yell) { ctx.ellipse(0, r * 0.45, r * 0.12, r * 0.1, 0, 0, TAU); ctx.fillStyle = '#5a1a1a'; ctx.fill(); }
    else ctx.arc(0, r * 0.32, r * 0.16, 0.2, Math.PI - 0.2);
    ctx.stroke();

    if (inst === 'trumpet') drawInstrument(ctx, inst, r, o.t || 0);
    ctx.restore();
  }

  // A platypus: brown round body, wide duck bill, beaver tail.
  function drawPlatypus(ctx, x, y, r, angle, hpFrac, king, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    // Tail.
    ctx.fillStyle = '#5b3d22';
    ctx.beginPath(); ctx.ellipse(r * 0.95, r * 0.35, r * 0.55, r * 0.32, 0.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(r * 0.7, r * (0.3 + i * 0.12)); ctx.lineTo(r * 1.3, r * (0.45 + i * 0.12)); ctx.stroke();
    }
    // Body.
    ctx.fillStyle = '#7a5434';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#4a311c';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#a07650';
    ctx.beginPath(); ctx.ellipse(0, r * 0.35, r * 0.6, r * 0.45, 0, 0, TAU); ctx.fill();
    // Eyes.
    const hurt = hpFrac < 0.6;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.25, r * 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.18, -r * 0.25, r * 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111';
    if (hurt) {
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
      for (const ex of [-r * 0.32, r * 0.18]) {
        ctx.beginPath(); ctx.moveTo(ex - r * 0.1, -r * 0.35); ctx.lineTo(ex + r * 0.1, -r * 0.15); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex + r * 0.1, -r * 0.35); ctx.lineTo(ex - r * 0.1, -r * 0.15); ctx.stroke();
      }
    } else {
      ctx.beginPath(); ctx.arc(-r * 0.36, -r * 0.24, r * 0.09, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.14, -r * 0.24, r * 0.09, 0, TAU); ctx.fill();
      // Grumpy brows.
      ctx.strokeStyle = '#2b1a0e'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(-r * 0.52, -r * 0.5); ctx.lineTo(-r * 0.18, -r * 0.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.34, -r * 0.5); ctx.lineTo(r * 0.02, -r * 0.4); ctx.stroke();
    }
    // Bill.
    ctx.fillStyle = '#3f4a57';
    ctx.strokeStyle = '#222a33';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(-r * 0.62, r * 0.12, r * 0.62, r * 0.26, -0.12, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#222a33';
    ctx.beginPath(); ctx.arc(-r * 0.95, r * 0.04, r * 0.05, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-r * 0.8, r * 0.02, r * 0.05, 0, TAU); ctx.fill();
    if (hurt) {
      // Bandage.
      ctx.fillStyle = '#f3ead8';
      ctx.save(); ctx.rotate(0.5); ctx.fillRect(r * 0.05, -r * 0.85, r * 0.6, r * 0.18); ctx.restore();
    }
    if (king) {
      ctx.fillStyle = '#f5c518';
      ctx.strokeStyle = '#a37f00';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const cy = -r * 0.82;
      ctx.moveTo(-r * 0.45, cy);
      ctx.lineTo(-r * 0.5, cy - r * 0.45);
      ctx.lineTo(-r * 0.25, cy - r * 0.22);
      ctx.lineTo(0, cy - r * 0.55);
      ctx.lineTo(r * 0.25, cy - r * 0.22);
      ctx.lineTo(r * 0.5, cy - r * 0.45);
      ctx.lineTo(r * 0.45, cy);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d64545';
      ctx.beginPath(); ctx.arc(0, cy - r * 0.12, r * 0.07, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  const MATERIAL_STYLE = {
    wood:  { fill: '#c68a4c', edge: '#7c5124', grain: 'rgba(90,55,20,0.35)' },
    stone: { fill: '#9aa3ab', edge: '#5d656c', grain: 'rgba(60,66,72,0.35)' },
    ice:   { fill: 'rgba(170,220,250,0.72)', edge: '#5fa8d3', grain: 'rgba(255,255,255,0.7)' },
  };

  function drawBlock(ctx, body, hpFrac) {
    const m = body.plugin.material;
    const st = MATERIAL_STYLE[m] || MATERIAL_STYLE.wood;
    const w = body.plugin.w, h = body.plugin.h;
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);
    ctx.fillStyle = st.fill;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = st.grain;
    ctx.lineWidth = 1;
    const seed = body.plugin.seed;
    if (m === 'wood') {
      const along = w >= h;
      const n = Math.max(1, Math.floor((along ? h : w) / 8));
      for (let i = 1; i <= n; i++) {
        ctx.beginPath();
        if (along) { const yy = -h / 2 + (i * h) / (n + 1); ctx.moveTo(-w / 2 + 3, yy); ctx.lineTo(w / 2 - 3, yy + ((seed * i) % 3) - 1); }
        else { const xx = -w / 2 + (i * w) / (n + 1); ctx.moveTo(xx, -h / 2 + 3); ctx.lineTo(xx + ((seed * i) % 3) - 1, h / 2 - 3); }
        ctx.stroke();
      }
    } else if (m === 'stone') {
      ctx.fillStyle = st.grain;
      for (let i = 0; i < Math.max(2, (w * h) / 900); i++) {
        const px = ((seed * (i + 3) * 37) % 100) / 100 * (w - 8) - w / 2 + 4;
        const py = ((seed * (i + 7) * 53) % 100) / 100 * (h - 8) - h / 2 + 4;
        ctx.beginPath(); ctx.arc(px, py, 2, 0, TAU); ctx.fill();
      }
    } else if (m === 'ice') {
      ctx.strokeStyle = st.grain; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-w / 2 + 4, -h / 2 + 10); ctx.lineTo(-w / 2 + 10, -h / 2 + 4); ctx.stroke();
    }
    if (hpFrac < 0.66) {
      ctx.strokeStyle = 'rgba(30,20,10,0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-w * 0.1, -h / 2);
      ctx.lineTo(w * 0.08, -h * 0.1);
      ctx.lineTo(-w * 0.05, h * 0.15);
      if (hpFrac < 0.33) { ctx.lineTo(w * 0.12, h / 2); ctx.moveTo(w * 0.08, -h * 0.1); ctx.lineTo(w / 2, -h * 0.05); }
      ctx.stroke();
    }
    ctx.strokeStyle = st.edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function drawTerrain(ctx, body) {
    const w = body.plugin.w, h = body.plugin.h;
    const x = body.position.x - w / 2, y = body.position.y - h / 2;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#8a5a32');
    g.addColorStop(1, '#5e3b1e');
    ctx.fillStyle = g;
    rr(ctx, x, y, w, h + 6, 10);
    ctx.fill();
    ctx.fillStyle = '#4caf50';
    rr(ctx, x - 4, y - 4, w + 8, 16, 8);
    ctx.fill();
    ctx.fillStyle = '#3d8c40';
    for (let i = 0; i < w; i += 14) {
      ctx.beginPath(); ctx.moveTo(x + i, y + 10); ctx.lineTo(x + i + 5, y - 8); ctx.lineTo(x + i + 10, y + 10); ctx.fill();
    }
  }

  function buildBackground(W, H, ground) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#7cc7f2');
    sky.addColorStop(0.65, '#cdeefc');
    sky.addColorStop(1, '#e8f7e4');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // Sun.
    ctx.fillStyle = 'rgba(255,236,150,0.9)';
    ctx.beginPath(); ctx.arc(W * 0.8, 140, 60, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,236,150,0.25)';
    ctx.beginPath(); ctx.arc(W * 0.8, 140, 95, 0, TAU); ctx.fill();
    // Clouds.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [cx, cy, s] of [[300, 150, 1], [900, 100, 1.3], [1450, 230, 0.9]]) {
      for (const [dx, dy, rr2] of [[0, 0, 30], [30, -12, 36], [64, 0, 28], [32, 10, 30]]) {
        ctx.beginPath(); ctx.arc(cx + dx * s, cy + dy * s, rr2 * s, 0, TAU); ctx.fill();
      }
    }
    // Far hills, two layers of haze so the playfield reads in front of them.
    ctx.fillStyle = '#b9e0c4';
    ctx.beginPath(); ctx.moveTo(0, ground);
    for (let x = 0; x <= W; x += 30) ctx.lineTo(x, ground - 260 - Math.sin(x / 260 + 1) * 70 - Math.sin(x / 97) * 18);
    ctx.lineTo(W, ground); ctx.fill();
    ctx.fillStyle = '#a3d6a6';
    ctx.beginPath(); ctx.moveTo(0, ground);
    for (let x = 0; x <= W; x += 30) ctx.lineTo(x, ground - 150 - Math.sin(x / 210) * 50 - Math.sin(x / 80) * 12);
    ctx.lineTo(W, ground); ctx.fill();
    // Jungle trees, kept pale and soft so sloths and forts pop.
    let seed = 17;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const tops = [];
    for (let i = 0; i < 10; i++) {
      const tx = 60 + i * 190 + rnd() * 60;
      const th = 250 + rnd() * 120;
      const lean = (rnd() - 0.5) * 30;
      ctx.strokeStyle = '#8f7a5e';
      ctx.lineCap = 'round';
      ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(tx, ground); ctx.quadraticCurveTo(tx + lean * 0.3, ground - th * 0.5, tx + lean, ground - th); ctx.stroke();
      const cx = tx + lean, cy = ground - th;
      const leaf = i % 2 ? '#7fbf7a' : '#89c783';
      const shade = i % 2 ? '#6cad69' : '#76b672';
      const blobs = [[0, 0, 62], [-52, 22, 46], [54, 18, 50], [-18, -38, 44], [26, -30, 40]];
      ctx.fillStyle = shade;
      for (const [dx, dy, r] of blobs) { ctx.beginPath(); ctx.arc(cx + dx, cy + dy + 8, r, 0, TAU); ctx.fill(); }
      ctx.fillStyle = leaf;
      for (const [dx, dy, r] of blobs) { ctx.beginPath(); ctx.arc(cx + dx - 3, cy + dy - 2, r * 0.9, 0, TAU); ctx.fill(); }
      // Hanging vines.
      ctx.strokeStyle = '#5f9e5b'; ctx.lineWidth = 3;
      for (let v = 0; v < 2; v++) {
        const vx = cx - 40 + rnd() * 80, len = 60 + rnd() * 90;
        ctx.beginPath(); ctx.moveTo(vx, cy + 30); ctx.quadraticCurveTo(vx + 10, cy + 30 + len * 0.6, vx - 4, cy + 30 + len); ctx.stroke();
      }
      tops.push({ x: cx, y: cy + 40 });
    }
    // Festival lights strung between the trees: it's the band's stage, after all.
    const bulbs = ['#ff5d5d', '#ffd166', '#5ec8ff', '#b388ff', '#7be07b'];
    for (let i = 0; i < tops.length - 1; i++) {
      const a = tops[i], b2 = tops[i + 1];
      const sag = 70;
      ctx.strokeStyle = 'rgba(60,50,40,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b2.x) / 2, Math.max(a.y, b2.y) + sag, b2.x, b2.y); ctx.stroke();
      for (let k = 1; k < 8; k++) {
        const t = k / 8;
        const qx = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * (a.x + b2.x) / 2 + t * t * b2.x;
        const qy = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * (Math.max(a.y, b2.y) + sag) + t * t * b2.y;
        const col = bulbs[(i * 7 + k) % bulbs.length];
        ctx.fillStyle = col + '55'; ctx.beginPath(); ctx.arc(qx, qy + 6, 10, 0, TAU); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(qx, qy + 6, 4, 5.5, 0, 0, TAU); ctx.fill();
      }
    }
    // Low bushes along the ground line.
    for (let x = -20; x < W + 40; x += 70 + rnd() * 60) {
      const r = 26 + rnd() * 22;
      ctx.fillStyle = '#5daa52';
      ctx.beginPath(); ctx.arc(x, ground + 4, r, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(x + r * 0.8, ground + 4, r * 0.7, Math.PI, 0); ctx.fill();
    }
    // Ground.
    const gg = ctx.createLinearGradient(0, ground, 0, H);
    gg.addColorStop(0, '#6fbf4a');
    gg.addColorStop(0.15, '#5aa63c');
    gg.addColorStop(0.16, '#8a5a32');
    gg.addColorStop(1, '#5e3b1e');
    ctx.fillStyle = gg;
    ctx.fillRect(0, ground, W, H - ground);
    ctx.fillStyle = '#4e9a35';
    for (let x = 0; x < W; x += 12) {
      ctx.beginPath(); ctx.moveTo(x, ground + 4); ctx.lineTo(x + 4, ground - 8 - (x % 5)); ctx.lineTo(x + 8, ground + 4); ctx.fill();
    }
    return c;
  }

  // The slingshot is a forked branch with a vine band.
  function drawSlingBack(ctx, s) {
    ctx.strokeStyle = '#5a3a1c';
    ctx.lineCap = 'round';
    ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(s.x, s.ground); ctx.lineTo(s.x, s.forkY); ctx.stroke();
    ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(s.x, s.forkY + 6); ctx.quadraticCurveTo(s.x + 18, s.forkY - 20, s.right.x, s.right.y); ctx.stroke();
  }
  function drawSlingFront(ctx, s) {
    ctx.strokeStyle = '#6b4523';
    ctx.lineCap = 'round';
    ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(s.x, s.forkY + 6); ctx.quadraticCurveTo(s.x - 18, s.forkY - 20, s.left.x, s.left.y); ctx.stroke();
    ctx.fillStyle = '#3e8a3a';
    ctx.beginPath(); ctx.ellipse(s.left.x - 4, s.left.y - 6, 10, 5, -0.6, 0, TAU); ctx.fill();
  }
  function drawBand(ctx, from, to) {
    ctx.strokeStyle = '#2f6b2b';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  }

  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.min(255, Math.round(c + (255 - c) * amt));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('');
  }
  function darken(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, ((n >> 16) & 255) * (1 - amt));
    const g = Math.max(0, ((n >> 8) & 255) * (1 - amt));
    const b = Math.max(0, (n & 255) * (1 - amt));
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  window.SBArt = { SLOTHS, drawSloth, drawPlatypus, drawBlock, drawTerrain, buildBackground, drawSlingBack, drawSlingFront, drawBand, rr };
})();
