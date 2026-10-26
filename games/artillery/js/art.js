// Hand-drawn characters and small props for the three worlds. Everything is
// canvas paths (no emoji or font glyphs) so it looks the same on every phone.
// Characters are drawn around their aim point c = (x, y - 14), roughly 46
// units wide, matching the hit radius in engine.js.
(function () {
  'use strict';

  const TAU = Math.PI * 2;

  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  function ellipse(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }
  function outline(ctx, w) { ctx.lineWidth = w || 2; ctx.strokeStyle = 'rgba(20,10,30,0.55)'; ctx.stroke(); }

  // Two friendly eyes looking along the aim direction. Blinks now and then.
  function eyes(ctx, x, y, gap, r, look, time, seed, hurt) {
    const blink = ((time + seed) % 4.2) > 4.05;
    const lx = Math.cos(look) * r * 0.35, ly = -Math.sin(look) * r * 0.35;
    [-1, 1].forEach(function (s) {
      const ex = x + s * gap / 2;
      if (hurt) {
        ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - r * 0.7, y - r * 0.7); ctx.lineTo(ex + r * 0.7, y + r * 0.7);
        ctx.moveTo(ex + r * 0.7, y - r * 0.7); ctx.lineTo(ex - r * 0.7, y + r * 0.7);
        ctx.stroke();
        return;
      }
      if (blink) {
        ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ex - r, y); ctx.quadraticCurveTo(ex, y + r * 0.6, ex + r, y); ctx.stroke();
        return;
      }
      ctx.fillStyle = '#fff'; circle(ctx, ex, y, r); ctx.fill();
      ctx.fillStyle = '#1a1020'; circle(ctx, ex + lx, y + ly, r * 0.55); ctx.fill();
      ctx.fillStyle = '#fff'; circle(ctx, ex + lx + r * 0.2, y + ly - r * 0.25, r * 0.18); ctx.fill();
    });
  }

  function dizzy(ctx, x, y, time) {
    for (let i = 0; i < 3; i++) {
      const a = time * 3 + i * TAU / 3;
      star(ctx, x + Math.cos(a) * 16, y + Math.sin(a) * 5, 4, '#ffe66d');
    }
  }

  function star(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }

  function wheels(ctx, x, y, n, span, r, color) {
    for (let i = 0; i < n; i++) {
      const wx = x - span / 2 + (n === 1 ? span / 2 : i * span / (n - 1));
      ctx.fillStyle = '#211a2b'; circle(ctx, wx, y, r); ctx.fill();
      ctx.fillStyle = color; circle(ctx, wx, y, r * 0.45); ctx.fill();
    }
  }

  // ---------- characters ----------
  // Each takes (ctx, x, y, ang, time, alive, color). ang is the aim in radians
  // (0 = right, PI/2 = straight up). Body faces the side it aims at.

  function trumpet(ctx, x, y, ang, time, alive, color) {
    const face = Math.cos(ang) >= 0 ? 1 : -1;
    // little stage cart
    ctx.fillStyle = '#5a2e7a';
    rrect(ctx, x - 22, y - 16, 44, 14, 5); ctx.fill(); outline(ctx);
    ctx.fillStyle = color;
    ctx.fillRect(x - 22, y - 12, 44, 3);
    wheels(ctx, x, y - 2, 3, 30, 4.5, color);
    // the trumpet, pivoting on the cart: bell points along the aim
    ctx.save();
    ctx.translate(x, y - 18);
    ctx.rotate(-ang);
    const brass = ctx.createLinearGradient(0, -8, 0, 8);
    brass.addColorStop(0, '#fff3b0'); brass.addColorStop(0.45, color); brass.addColorStop(1, '#b8860b');
    // tubing loop
    ctx.strokeStyle = brass; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(18, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-6, 9, 4, 9); ctx.lineTo(12, 9); ctx.quadraticCurveTo(16, 9, 16, 3); ctx.stroke();
    // valves
    ctx.fillStyle = '#d4a017';
    [-1, 3, 7].forEach(function (vx) { ctx.fillRect(vx, -7, 3, 7); });
    ctx.fillStyle = '#fff3b0';
    [-1, 3, 7].forEach(function (vx) { ctx.fillRect(vx - 0.5, -9, 4, 2); });
    // bell
    ctx.fillStyle = brass;
    ctx.beginPath();
    ctx.moveTo(16, -2.5); ctx.quadraticCurveTo(26, -3, 31, -10); ctx.lineTo(31, 10); ctx.quadraticCurveTo(26, 3, 16, 2.5);
    ctx.closePath(); ctx.fill(); outline(ctx, 1.5);
    ctx.fillStyle = '#7a5600'; ellipse(ctx, 31, 0, 2.5, 10); ctx.fill();
    // mouthpiece
    ctx.fillStyle = '#c0c0c0'; ctx.fillRect(-14, -1.5, 5, 3);
    ctx.restore();
    // face on the cart
    eyes(ctx, x + face * 3, y - 9, 10, 3, ang, time, 0.3, !alive);
  }

  function drum(ctx, x, y, ang, time, alive, color) {
    const face = Math.cos(ang) >= 0 ? 1 : -1;
    // drumstick launcher behind the drum
    ctx.save();
    ctx.translate(x, y - 22);
    ctx.rotate(-ang);
    ctx.strokeStyle = '#e8c38a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(28, 0); ctx.stroke();
    ctx.fillStyle = '#f5deb3'; circle(ctx, 29, 0, 3.6); ctx.fill(); outline(ctx, 1);
    ctx.restore();
    // shell
    const top = y - 30, h = 24;
    ctx.fillStyle = '#d62839';
    ctx.beginPath();
    ctx.moveTo(x - 20, top); ctx.lineTo(x - 20, top + h);
    ctx.ellipse(x, top + h, 20, 5, 0, Math.PI, 0, true);
    ctx.lineTo(x + 20, top);
    ctx.closePath(); ctx.fill();
    // zig-zag lacing
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const lx = x - 20 + i * 5;
      ctx.lineTo(lx, i % 2 ? top + h - 3 : top + 4);
    }
    ctx.stroke();
    // rims
    ctx.fillStyle = color;
    ctx.fillRect(x - 21, top + 1, 42, 3);
    ctx.fillRect(x - 21, top + h - 2, 42, 3);
    // drum head
    ctx.fillStyle = '#f7f1e3'; ellipse(ctx, x, top, 20, 5); ctx.fill(); outline(ctx, 1.5);
    // face lives on a little label
    ctx.fillStyle = '#ffffffdd'; rrect(ctx, x - 9 + face * 2, top + 7, 18, 10, 4); ctx.fill();
    eyes(ctx, x + face * 2, top + 12, 9, 2.8, ang, time, 1.7, !alive);
    // feet
    ctx.fillStyle = '#211a2b';
    ctx.fillRect(x - 16, y - 4, 4, 4); ctx.fillRect(x + 12, y - 4, 4, 4);
  }

  function bear(ctx, x, y, ang, time, alive, color) {
    const face = Math.cos(ang) >= 0 ? 1 : -1;
    const fur = '#8d5a3b', light = '#c99a6e';
    // body
    ctx.fillStyle = fur; ellipse(ctx, x, y - 12, 17, 13); ctx.fill(); outline(ctx);
    ctx.fillStyle = light; ellipse(ctx, x + face * 2, y - 9, 9, 8); ctx.fill();
    // feet
    ctx.fillStyle = fur;
    ellipse(ctx, x - 9, y - 2, 6, 3.5); ctx.fill(); ellipse(ctx, x + 9, y - 2, 6, 3.5); ctx.fill();
    // throwing arm
    ctx.save();
    ctx.translate(x + face * 4, y - 18);
    ctx.rotate(-ang);
    ctx.strokeStyle = fur; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(22, 0); ctx.stroke();
    ctx.fillStyle = light; circle(ctx, 24, 0, 4.5); ctx.fill();
    ctx.restore();
    // head
    const hx = x + face * 3, hy = y - 30;
    ctx.fillStyle = fur;
    circle(ctx, hx - 9, hy - 8, 5); ctx.fill(); circle(ctx, hx + 9, hy - 8, 5); ctx.fill();
    ctx.fillStyle = light;
    circle(ctx, hx - 9, hy - 8, 2.5); ctx.fill(); circle(ctx, hx + 9, hy - 8, 2.5); ctx.fill();
    ctx.fillStyle = fur; circle(ctx, hx, hy, 12); ctx.fill(); outline(ctx);
    ctx.fillStyle = light; ellipse(ctx, hx + face * 3, hy + 4, 6, 4.5); ctx.fill();
    ctx.fillStyle = '#2b1a12'; ellipse(ctx, hx + face * 4, hy + 2, 2.4, 1.8); ctx.fill();
    eyes(ctx, hx - face * 1, hy - 3, 9, 2.6, ang, time, 2.1, !alive);
    // team scarf
    ctx.fillStyle = color; rrect(ctx, x - 10, y - 21, 20, 4, 2); ctx.fill();
  }

  function fox(ctx, x, y, ang, time, alive, color) {
    const face = Math.cos(ang) >= 0 ? 1 : -1;
    const fur = '#e8702a', white = '#fff4e6';
    // tail curling behind
    const sway = Math.sin(time * 2.4) * 0.12;
    ctx.save();
    ctx.translate(x - face * 10, y - 8);
    ctx.rotate(-face * (0.6 + sway));
    ctx.fillStyle = fur;
    ellipse(ctx, -face * 2, -12, 7, 14, 0); ctx.fill(); outline(ctx, 1.5);
    ctx.fillStyle = white; ellipse(ctx, -face * 2, -23, 4.5, 5); ctx.fill();
    ctx.restore();
    // body
    ctx.fillStyle = fur; ellipse(ctx, x, y - 11, 13, 11); ctx.fill(); outline(ctx);
    ctx.fillStyle = white; ellipse(ctx, x + face * 3, y - 8, 6, 7); ctx.fill();
    ctx.fillStyle = '#3d2614';
    ellipse(ctx, x - 6, y - 2, 4, 2.5); ctx.fill(); ellipse(ctx, x + 6, y - 2, 4, 2.5); ctx.fill();
    // arm
    ctx.save();
    ctx.translate(x + face * 3, y - 16);
    ctx.rotate(-ang);
    ctx.strokeStyle = fur; ctx.lineWidth = 5.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(21, 0); ctx.stroke();
    ctx.fillStyle = '#3d2614'; circle(ctx, 22, 0, 3.4); ctx.fill();
    ctx.restore();
    // head: pointed ears and snout
    const hx = x + face * 3, hy = y - 28;
    ctx.fillStyle = fur;
    [-1, 1].forEach(function (s) {
      ctx.beginPath();
      ctx.moveTo(hx + s * 4, hy - 6); ctx.lineTo(hx + s * 11, hy - 18); ctx.lineTo(hx + s * 12, hy - 3);
      ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle = '#3d2614';
    [-1, 1].forEach(function (s) {
      ctx.beginPath();
      ctx.moveTo(hx + s * 7, hy - 7); ctx.lineTo(hx + s * 10.5, hy - 14); ctx.lineTo(hx + s * 10.8, hy - 5);
      ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle = fur; circle(ctx, hx, hy, 10.5); ctx.fill(); outline(ctx);
    ctx.fillStyle = white;
    ctx.beginPath();
    ctx.moveTo(hx - 8, hy + 1); ctx.quadraticCurveTo(hx + face * 14, hy + 2, hx + face * 15, hy + 5);
    ctx.quadraticCurveTo(hx + face * 4, hy + 11, hx - 6, hy + 7);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1a1020'; circle(ctx, hx + face * 15, hy + 4.5, 2); ctx.fill();
    eyes(ctx, hx - face * 0.5, hy - 2, 8.5, 2.5, ang, time, 3.3, !alive);
    ctx.fillStyle = color; rrect(ctx, x - 8, y - 19, 16, 3.5, 2); ctx.fill();
  }

  function zorp(ctx, x, y, ang, time, alive, color) {
    const bob = alive ? Math.sin(time * 3) * 1.5 : 0;
    const by = y - 12 + bob;
    // tractor glow
    ctx.fillStyle = color + '33';
    ctx.beginPath(); ctx.moveTo(x - 8, by + 4); ctx.lineTo(x + 8, by + 4); ctx.lineTo(x + 14, y); ctx.lineTo(x - 14, y); ctx.closePath(); ctx.fill();
    // ray gun
    ctx.save();
    ctx.translate(x, by - 8);
    ctx.rotate(-ang);
    ctx.fillStyle = '#9aa5b1'; rrect(ctx, 4, -3, 22, 6, 3); ctx.fill(); outline(ctx, 1.2);
    ctx.fillStyle = color; rrect(ctx, 22, -4, 6, 8, 2); ctx.fill();
    ctx.restore();
    // alien inside the dome
    ctx.fillStyle = '#7dd87d'; ellipse(ctx, x, by - 12, 8, 9); ctx.fill();
    ctx.strokeStyle = '#5cb85c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - 3, by - 20); ctx.lineTo(x - 6, by - 26); ctx.moveTo(x + 3, by - 20); ctx.lineTo(x + 6, by - 26); ctx.stroke();
    ctx.fillStyle = color; circle(ctx, x - 6, by - 26, 1.8); ctx.fill(); circle(ctx, x + 6, by - 26, 1.8); ctx.fill();
    if (alive) {
      ctx.fillStyle = '#10131a';
      ellipse(ctx, x - 3.2, by - 13, 2.6, 3.6, 0.35); ctx.fill();
      ellipse(ctx, x + 3.2, by - 13, 2.6, 3.6, -0.35); ctx.fill();
    } else eyes(ctx, x, by - 13, 6.5, 2.2, ang, time, 0, true);
    // glass dome
    ctx.fillStyle = 'rgba(200,240,255,0.28)';
    ctx.beginPath(); ctx.ellipse(x, by - 4, 13, 15, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ellipse(ctx, x - 6, by - 12, 2, 4, 0.4); ctx.fill();
    // saucer
    const metal = ctx.createLinearGradient(0, by - 6, 0, by + 6);
    metal.addColorStop(0, '#e8edf2'); metal.addColorStop(1, '#6b7785');
    ctx.fillStyle = metal; ellipse(ctx, x, by, 23, 6.5); ctx.fill(); outline(ctx, 1.5);
    for (let i = 0; i < 5; i++) {
      const on = Math.floor(time * 4 + i) % 5 === 0;
      ctx.fillStyle = on ? '#fff' : color;
      circle(ctx, x - 16 + i * 8, by + 1.5, 1.8); ctx.fill();
    }
  }

  function glorb(ctx, x, y, ang, time, alive, color) {
    const squish = alive ? 1 + Math.sin(time * 4) * 0.04 : 1;
    // tentacle feet
    ctx.strokeStyle = '#b5179e'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 9, y - 8);
      ctx.quadraticCurveTo(x + i * 12 + Math.sin(time * 5 + i) * 2, y - 2, x + i * 14, y - 1);
      ctx.stroke();
    }
    // spore cannon
    ctx.save();
    ctx.translate(x, y - 18);
    ctx.rotate(-ang);
    ctx.fillStyle = '#4a1a6b'; rrect(ctx, 6, -4, 20, 8, 4); ctx.fill(); outline(ctx, 1.2);
    ctx.fillStyle = '#80ffdb'; ellipse(ctx, 26, 0, 2.5, 4); ctx.fill();
    ctx.restore();
    // blob body
    ctx.save();
    ctx.translate(x, y - 16);
    ctx.scale(1 / squish, squish);
    const g = ctx.createRadialGradient(-5, -8, 2, 0, 0, 18);
    g.addColorStop(0, '#ff8fd0'); g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-16, 8);
    ctx.bezierCurveTo(-20, -6, -12, -18, 0, -18);
    ctx.bezierCurveTo(12, -18, 20, -6, 16, 8);
    ctx.quadraticCurveTo(0, 12, -16, 8);
    ctx.closePath(); ctx.fill(); outline(ctx);
    ctx.restore();
    // antenna
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 33); ctx.quadraticCurveTo(x + 4, y - 40, x + 2, y - 44); ctx.stroke();
    ctx.fillStyle = '#80ffdb'; circle(ctx, x + 2, y - 45, 2.6); ctx.fill();
    // one big eye
    if (alive) {
      const lx = Math.cos(ang) * 2.2, ly = -Math.sin(ang) * 2.2;
      const blink = ((time + 0.9) % 3.7) > 3.55;
      if (blink) {
        ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 7, y - 20); ctx.quadraticCurveTo(x, y - 16, x + 7, y - 20); ctx.stroke();
      } else {
        ctx.fillStyle = '#fff'; circle(ctx, x, y - 20, 7.5); ctx.fill();
        ctx.fillStyle = '#3a0ca3'; circle(ctx, x + lx, y - 20 + ly, 4); ctx.fill();
        ctx.fillStyle = '#10131a'; circle(ctx, x + lx, y - 20 + ly, 2); ctx.fill();
        ctx.fillStyle = '#fff'; circle(ctx, x + lx + 1.4, y - 21.5 + ly, 1); ctx.fill();
      }
    } else eyes(ctx, x, y - 20, 0.1, 4, ang, time, 0, true);
    ctx.strokeStyle = '#4a0d3a'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y - 11, 4, 0.2, Math.PI - 0.2); ctx.stroke();
  }

  const CHARACTERS = { trumpet: trumpet, drum: drum, bear: bear, fox: fox, zorp: zorp, glorb: glorb };

  function drawCharacter(ctx, kind, x, y, ang, time, alive, color) {
    ctx.save();
    if (!alive) ctx.globalAlpha = 0.7;
    (CHARACTERS[kind] || trumpet)(ctx, x, y, ang, time, alive, color);
    ctx.restore();
    if (!alive) dizzy(ctx, x, y - 44, time);
  }

  // Portrait for the HUD and the result card. Returns a data URL.
  const portraitCache = {};
  function portrait(kind, color, size, aimRight) {
    const key = kind + color + size + (aimRight ? 'r' : 'l');
    if (portraitCache[key]) return portraitCache[key];
    const c = document.createElement('canvas');
    c.width = c.height = size * 2;
    const x = c.getContext('2d');
    x.scale(size * 2 / 64, size * 2 / 64);
    drawCharacter(x, kind, 32, 56, aimRight ? 0.6 : Math.PI - 0.6, 1, true, color);
    portraitCache[key] = c.toDataURL();
    return portraitCache[key];
  }

  // ---------- music notation, drawn ----------
  function noteHead(ctx, x, y, r, hollow) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(-0.35);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3, r * 0.9, 0, 0, TAU);
    if (hollow) {
      ctx.lineWidth = r * 0.5; ctx.stroke();
    } else ctx.fill();
    ctx.restore();
  }

  // kind: quarter, eighth, beamed, whole, triad, sharp, flat, natural
  function drawNote(ctx, kind, x, y, s) {
    const r = s * 0.28;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, s * 0.1);
    ctx.strokeStyle = ctx.fillStyle;
    const stem = function (hx) {
      ctx.beginPath(); ctx.moveTo(hx + r * 1.15, s * 0.3); ctx.lineTo(hx + r * 1.15, -s * 0.55); ctx.stroke();
    };
    if (kind === 'whole') {
      noteHead(ctx, 0, 0, s * 0.42, true);
    } else if (kind === 'quarter' || kind === 'eighth') {
      noteHead(ctx, 0, s * 0.3, r);
      stem(0);
      if (kind === 'eighth') {
        ctx.beginPath();
        ctx.moveTo(r * 1.15, -s * 0.55);
        ctx.quadraticCurveTo(r * 1.15 + s * 0.35, -s * 0.3, r * 1.15 + s * 0.2, s * 0.02);
        ctx.stroke();
      }
    } else if (kind === 'beamed') {
      const a = -s * 0.32, b = s * 0.22;
      noteHead(ctx, a, s * 0.32, r); noteHead(ctx, b, s * 0.2, r);
      ctx.beginPath();
      ctx.moveTo(a + r * 1.15, s * 0.32); ctx.lineTo(a + r * 1.15, -s * 0.48);
      ctx.moveTo(b + r * 1.15, s * 0.2); ctx.lineTo(b + r * 1.15, -s * 0.6);
      ctx.stroke();
      ctx.lineWidth = s * 0.16;
      ctx.beginPath(); ctx.moveTo(a + r * 1.15, -s * 0.48); ctx.lineTo(b + r * 1.15, -s * 0.6); ctx.stroke();
    } else if (kind === 'triad') {
      noteHead(ctx, 0, s * 0.42, r * 0.85); noteHead(ctx, 0, s * 0.1, r * 0.85); noteHead(ctx, 0, -s * 0.22, r * 0.85);
      ctx.beginPath(); ctx.moveTo(r, s * 0.45); ctx.lineTo(r, -s * 0.7); ctx.stroke();
    } else if (kind === 'sharp') {
      ctx.lineWidth = s * 0.09;
      ctx.beginPath();
      ctx.moveTo(-s * 0.14, -s * 0.5); ctx.lineTo(-s * 0.14, s * 0.55);
      ctx.moveTo(s * 0.14, -s * 0.55); ctx.lineTo(s * 0.14, s * 0.5);
      ctx.stroke();
      ctx.lineWidth = s * 0.16;
      ctx.beginPath();
      ctx.moveTo(-s * 0.32, -s * 0.1); ctx.lineTo(s * 0.32, -s * 0.24);
      ctx.moveTo(-s * 0.32, s * 0.24); ctx.lineTo(s * 0.32, s * 0.1);
      ctx.stroke();
    } else if (kind === 'flat') {
      ctx.lineWidth = s * 0.1;
      ctx.beginPath(); ctx.moveTo(-s * 0.15, -s * 0.6); ctx.lineTo(-s * 0.15, s * 0.4); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, s * 0.4);
      ctx.bezierCurveTo(s * 0.45, s * 0.05, s * 0.3, -s * 0.25, -s * 0.15, s * 0.0);
      ctx.lineWidth = s * 0.13; ctx.stroke();
    } else if (kind === 'natural') {
      ctx.lineWidth = s * 0.09;
      ctx.beginPath();
      ctx.moveTo(-s * 0.16, -s * 0.6); ctx.lineTo(-s * 0.16, s * 0.25);
      ctx.moveTo(s * 0.16, -s * 0.25); ctx.lineTo(s * 0.16, s * 0.6);
      ctx.stroke();
      ctx.lineWidth = s * 0.15;
      ctx.beginPath();
      ctx.moveTo(-s * 0.16, -s * 0.12); ctx.lineTo(s * 0.16, -s * 0.24);
      ctx.moveTo(-s * 0.16, s * 0.24); ctx.lineTo(s * 0.16, s * 0.12);
      ctx.stroke();
    }
    ctx.restore();
  }

  function miniDrum(ctx, x, y, s) {
    ctx.fillStyle = '#d62839';
    ctx.fillRect(x - s * 0.5, y - s * 0.25, s, s * 0.5);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) ctx.lineTo(x - s * 0.5 + i * s * 0.25, y + (i % 2 ? s * 0.2 : -s * 0.2));
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(x - s * 0.52, y - s * 0.3, s * 1.04, s * 0.1);
    ctx.fillRect(x - s * 0.52, y + s * 0.2, s * 1.04, s * 0.1);
    ctx.fillStyle = '#f7f1e3'; ellipse(ctx, x, y - s * 0.3, s * 0.5, s * 0.14); ctx.fill();
  }

  // ---------- nature props, drawn ----------
  function drawNature(ctx, kind, x, y, s, spin) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin || 0);
    switch (kind) {
      case 'acorn': {
        ctx.fillStyle = '#c98b4a'; ellipse(ctx, 0, s * 0.12, s * 0.34, s * 0.42); ctx.fill(); outline(ctx, 1.2);
        ctx.fillStyle = '#6f4a2a';
        ctx.beginPath(); ctx.ellipse(0, -s * 0.18, s * 0.42, s * 0.22, 0, Math.PI, 0); ctx.lineTo(s * 0.42, -s * 0.12); ctx.lineTo(-s * 0.42, -s * 0.12); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#4a2f1a'; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.moveTo(0, -s * 0.38); ctx.lineTo(s * 0.06, -s * 0.52); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ellipse(ctx, -s * 0.12, s * 0.08, s * 0.07, s * 0.16); ctx.fill();
        break;
      }
      case 'coconut': {
        ctx.fillStyle = '#6b4226'; circle(ctx, 0, 0, s * 0.48); ctx.fill(); outline(ctx, 1.4);
        ctx.strokeStyle = '#8b5a3c'; ctx.lineWidth = 1;
        for (let i = 0; i < 9; i++) { const a = i * 0.7; ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.2, Math.sin(a) * s * 0.2); ctx.lineTo(Math.cos(a + 0.3) * s * 0.45, Math.sin(a + 0.3) * s * 0.45); ctx.stroke(); }
        ctx.fillStyle = '#2b1a12';
        [[-0.12, -0.12], [0.12, -0.12], [0, 0.08]].forEach(function (d) { circle(ctx, d[0] * s, d[1] * s, s * 0.06); ctx.fill(); });
        break;
      }
      case 'berries': {
        ctx.strokeStyle = '#3a7d44'; ctx.lineWidth = s * 0.06;
        ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(0, -s * 0.15); ctx.stroke();
        [[-0.17, 0.05], [0.17, 0.05], [0, -0.12], [0, 0.24]].forEach(function (d) {
          ctx.fillStyle = '#c1121f'; circle(ctx, d[0] * s, d[1] * s, s * 0.2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.5)'; circle(ctx, d[0] * s - s * 0.06, d[1] * s - s * 0.06, s * 0.05); ctx.fill();
        });
        ctx.fillStyle = '#3a7d44'; ellipse(ctx, s * 0.12, -s * 0.42, s * 0.15, s * 0.07, -0.5); ctx.fill();
        break;
      }
      case 'sunflower': {
        ctx.fillStyle = '#ffbe0b';
        for (let i = 0; i < 10; i++) { const a = i * TAU / 10; ellipse(ctx, Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3, s * 0.18, s * 0.08, a); ctx.fill(); }
        ctx.fillStyle = '#5c3a1e'; circle(ctx, 0, 0, s * 0.24); ctx.fill();
        ctx.fillStyle = '#3d2614';
        for (let i = 0; i < 7; i++) { const a = i * 2.4; circle(ctx, Math.cos(a) * s * 0.12, Math.sin(a) * s * 0.12, s * 0.035); ctx.fill(); }
        break;
      }
      case 'stone': {
        ctx.fillStyle = '#8d99ae'; ellipse(ctx, 0, 0, s * 0.48, s * 0.24); ctx.fill(); outline(ctx, 1.2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ellipse(ctx, -s * 0.12, -s * 0.08, s * 0.2, s * 0.06); ctx.fill();
        break;
      }
      case 'log': {
        ctx.fillStyle = '#8b5a2b'; rrect(ctx, -s * 0.5, -s * 0.2, s, s * 0.4, s * 0.08); ctx.fill(); outline(ctx, 1.2);
        ctx.strokeStyle = '#5e3a1a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-s * 0.35, -s * 0.08); ctx.lineTo(s * 0.2, -s * 0.08); ctx.moveTo(-s * 0.2, s * 0.08); ctx.lineTo(s * 0.3, s * 0.08); ctx.stroke();
        ctx.fillStyle = '#d4a373'; ellipse(ctx, s * 0.5, 0, s * 0.1, s * 0.2); ctx.fill();
        ctx.strokeStyle = '#8b5a2b'; ellipse(ctx, s * 0.5, 0, s * 0.05, s * 0.1); ctx.stroke();
        break;
      }
      case 'mud': {
        ctx.fillStyle = '#5c4033';
        ctx.beginPath();
        for (let i = 0; i < 9; i++) { const a = i * TAU / 9, rr = s * (0.38 + (i % 3) * 0.05); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill(); outline(ctx, 1.2);
        ctx.fillStyle = '#7a5a48'; circle(ctx, -s * 0.12, -s * 0.12, s * 0.1); ctx.fill();
        break;
      }
      case 'clod': {
        ctx.fillStyle = '#6b4f3a'; circle(ctx, 0, 0, s * 0.36); ctx.fill(); outline(ctx, 1.2);
        ctx.strokeStyle = '#e9dcc9'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.13 - s * 0.05, -s * 0.2); ctx.lineTo(i * s * 0.13 + s * 0.05, s * 0.2); ctx.stroke(); }
        break;
      }
      case 'bee': {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ellipse(ctx, -s * 0.1, -s * 0.3, s * 0.16, s * 0.24, -0.4); ctx.fill();
        ellipse(ctx, s * 0.12, -s * 0.3, s * 0.16, s * 0.24, 0.4); ctx.fill();
        ctx.fillStyle = '#ffd60a'; ellipse(ctx, 0, 0, s * 0.4, s * 0.27); ctx.fill(); outline(ctx, 1);
        ctx.fillStyle = '#1a1020';
        ctx.fillRect(-s * 0.1, -s * 0.26, s * 0.1, s * 0.52); ctx.fillRect(s * 0.12, -s * 0.24, s * 0.09, s * 0.48);
        circle(ctx, s * 0.32, -s * 0.05, s * 0.05); ctx.fill();
        break;
      }
      case 'feather': {
        ctx.fillStyle = '#e9ecef';
        ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.1); ctx.quadraticCurveTo(0, -s * 0.4, s * 0.5, -s * 0.1); ctx.quadraticCurveTo(0, s * 0.25, -s * 0.5, s * 0.1); ctx.fill(); outline(ctx, 1);
        ctx.strokeStyle = '#7f5539'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(-s * 0.55, s * 0.14); ctx.quadraticCurveTo(0, -s * 0.08, s * 0.5, -s * 0.1); ctx.stroke();
        ctx.fillStyle = '#9c6644'; ellipse(ctx, s * 0.32, -s * 0.08, s * 0.12, s * 0.08, -0.2); ctx.fill();
        break;
      }
      case 'boulder': {
        ctx.fillStyle = '#6c757d';
        ctx.beginPath();
        [[-0.5, 0.1], [-0.35, -0.35], [0.05, -0.5], [0.45, -0.25], [0.5, 0.2], [0.15, 0.45], [-0.3, 0.4]].forEach(function (p) { ctx.lineTo(p[0] * s, p[1] * s); });
        ctx.closePath(); ctx.fill(); outline(ctx, 2);
        ctx.fillStyle = '#adb5bd';
        ctx.beginPath(); ctx.moveTo(-0.35 * s, -0.35 * s); ctx.lineTo(0.05 * s, -0.5 * s); ctx.lineTo(0.1 * s, -0.1 * s); ctx.lineTo(-0.2 * s, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#495057';
        ctx.beginPath(); ctx.moveTo(0.5 * s, 0.2 * s); ctx.lineTo(0.15 * s, 0.45 * s); ctx.lineTo(0.1 * s, 0.1 * s); ctx.closePath(); ctx.fill();
        break;
      }
      case 'leaf': {
        ctx.fillStyle = ctx.fillStyle;
        ctx.beginPath(); ctx.moveTo(-s * 0.5, 0); ctx.quadraticCurveTo(0, -s * 0.45, s * 0.5, 0); ctx.quadraticCurveTo(0, s * 0.45, -s * 0.5, 0); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  function grassTuft(ctx, x, y, s, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) { ctx.moveTo(x + i * 2, y); ctx.quadraticCurveTo(x + i * 3, y - s * 0.6, x + i * 4.2, y - s * (0.8 + (i % 2 ? 0 : 0.3))); }
    ctx.stroke();
  }

  function flower(ctx, x, y, s, petal) {
    ctx.strokeStyle = '#3a7d44'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s); ctx.stroke();
    ctx.fillStyle = petal;
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5; circle(ctx, x + Math.cos(a) * s * 0.28, y - s + Math.sin(a) * s * 0.28, s * 0.2); ctx.fill(); }
    ctx.fillStyle = '#ffd60a'; circle(ctx, x, y - s, s * 0.17); ctx.fill();
  }

  // Simple speaker icon for the mute button (SVG markup).
  function speakerSvg(muted) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>' +
      (muted ? '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
        : '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>') +
      '</svg>';
  }

  window.ArtilleryArt = {
    drawCharacter: drawCharacter, portrait: portrait, drawNote: drawNote, miniDrum: miniDrum,
    drawNature: drawNature, grassTuft: grassTuft, flower: flower, star: star, speakerSvg: speakerSvg
  };
})();
