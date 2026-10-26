/*
 * Wickwood drawings. Everything is drawn with canvas paths, no image files.
 * Each draw function takes the context and a center point; `t` is time in
 * seconds for idle wobble.
 */
(function (root) {
  'use strict';

  var TAU = Math.PI * 2;

  // Full circle / ellipse as its own subpath, so several in one path stay separate.
  function circ(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
  function ell(ctx, x, y, rx, ry, rot) {
    rot = rot || 0;
    ctx.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx);
    ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  }

  function blob(ctx, x, y, r, wob, t, n) {
    n = n || 9;
    ctx.beginPath();
    for (var i = 0; i <= n; i++) {
      var a = (i / n) * TAU;
      var rr = r * (1 + wob * Math.sin(a * 3 + t * 4));
      var px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function eyes(ctx, x, y, gap, size, color, look) {
    look = look || { x: 0, y: 0 };
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = size * 3;
    ctx.beginPath();
    circ(ctx, x - gap + look.x, y + look.y, size);
    circ(ctx, x + gap + look.x, y + look.y, size);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function flame(ctx, x, y, s, t, colors) {
    var flick = Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06;
    colors = colors || ['#ff7a1f', '#ffc53d', '#fff6c9'];
    [1, 0.66, 0.36].forEach(function (k, i) {
      var h = s * 1.7 * k * (1 + flick), w = s * 0.75 * k;
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.moveTo(x + flick * s * 0.6, y - h);
      ctx.bezierCurveTo(x + w, y - h * 0.45, x + w, y, x, y + w * 0.35);
      ctx.bezierCurveTo(x - w, y, x - w, y - h * 0.45, x + flick * s * 0.6, y - h);
      ctx.fill();
    });
  }

  // Wick, the candle sprite. face: -1 left, 1 right. hurt: 0..1 flash.
  function wick(ctx, x, y, r, t, opt) {
    opt = opt || {};
    var face = opt.face || 1, moving = opt.moving;
    var bob = moving ? Math.abs(Math.sin(t * 12)) * r * 0.12 : Math.sin(t * 3) * r * 0.04;
    var w = r * 1.35, h = r * 1.6;
    var top = y - h * 0.5 - bob;
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ell(ctx, x, y + h * 0.5, w * 0.6, r * 0.25); ctx.fill();
    // feet
    ctx.fillStyle = '#7a4a2a';
    var step = moving ? Math.sin(t * 12) * r * 0.18 : 0;
    ctx.beginPath();
    ell(ctx, x - w * 0.25 + step, y + h * 0.45, r * 0.22, r * 0.14);
    ell(ctx, x + w * 0.25 - step, y + h * 0.45, r * 0.22, r * 0.14);
    ctx.fill();
    // wax body
    var body = opt.hurt ? '#ffd0c0' : '#f7ecd2';
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, top + r * 0.25);
    ctx.quadraticCurveTo(x - w / 2, top, x - w / 2 + r * 0.25, top);
    ctx.lineTo(x + w / 2 - r * 0.25, top);
    ctx.quadraticCurveTo(x + w / 2, top, x + w / 2, top + r * 0.25);
    ctx.lineTo(x + w / 2, y + h * 0.38 - bob);
    ctx.quadraticCurveTo(x, y + h * 0.52 - bob, x - w / 2, y + h * 0.38 - bob);
    ctx.closePath(); ctx.fill();
    // shading + drips
    ctx.fillStyle = 'rgba(180,140,90,0.25)';
    ctx.fillRect(x + w * 0.18, top + r * 0.2, w * 0.3, h * 0.75);
    ctx.fillStyle = '#fff8e8';
    ctx.beginPath();
    ell(ctx, x - w * 0.25, top + r * 0.32, r * 0.12, r * 0.3);
    ell(ctx, x + w * 0.1, top + r * 0.22, r * 0.1, r * 0.2);
    ctx.fill();
    // scarf
    ctx.fillStyle = '#c8402e';
    ctx.fillRect(x - w / 2, top + h * 0.52, w, r * 0.24);
    ctx.beginPath();
    ctx.moveTo(x - face * w * 0.35, top + h * 0.6);
    ctx.lineTo(x - face * (w * 0.75 + Math.sin(t * 8) * r * 0.1), top + h * 0.78);
    ctx.lineTo(x - face * w * 0.3, top + h * 0.8);
    ctx.fill();
    // face
    ctx.fillStyle = '#2a1d12';
    var ex = x + face * r * 0.12, ey = top + h * 0.33;
    var blink = (t % 3.7) < 0.12;
    if (blink) {
      ctx.fillRect(ex - r * 0.32, ey, r * 0.18, r * 0.05);
      ctx.fillRect(ex + r * 0.14, ey, r * 0.18, r * 0.05);
    } else {
      ctx.beginPath();
      circ(ctx, ex - r * 0.23, ey, r * 0.1);
      circ(ctx, ex + r * 0.23, ey, r * 0.1);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,120,110,0.5)';
    ctx.beginPath();
    circ(ctx, ex - r * 0.4, ey + r * 0.18, r * 0.09);
    circ(ctx, ex + r * 0.4, ey + r * 0.18, r * 0.09);
    ctx.fill();
    // wick + flame
    ctx.strokeStyle = '#3b2a1c'; ctx.lineWidth = r * 0.08;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top - r * 0.2); ctx.stroke();
    flame(ctx, x, top - r * 0.18, r * 0.5, t);
    ctx.restore();
  }

  // ---- Gloom creatures ------------------------------------------------------

  function foe(ctx, kind, x, y, r, t, f, eyesOnly) {
    var look = f && f.look || { x: 0, y: 0 };
    ctx.save();
    if (!eyesOnly) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ell(ctx, x, y + r * 0.85, r * 0.85, r * 0.25); ctx.fill();
    }
    var flash = f && f.flash > 0;
    var body = flash ? '#ffffff' : f.def.body;
    switch (kind) {
      case 'mite':
        if (!eyesOnly) {
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.arc(x, y - r * 0.1, r, Math.PI, 0);
          for (var i = 0; i <= 4; i++) {
            var px = x + r - (i / 4) * 2 * r;
            ctx.lineTo(px, y + r * 0.7 + Math.sin(t * 8 + i * 1.7) * r * 0.18);
          }
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.beginPath(); circ(ctx, x - r * 0.35, y - r * 0.45, r * 0.3); ctx.fill();
        }
        eyes(ctx, x, y - r * 0.2, r * 0.33, r * 0.15, f.def.eye, { x: look.x * r * 0.15, y: look.y * r * 0.1 });
        break;
      case 'puff':
        if (!eyesOnly) {
          var swell = f && f.charge ? 1 + f.charge * 0.18 : 1;
          ctx.fillStyle = '#d8c7a8';
          ctx.fillRect(x - r * 0.35, y, r * 0.7, r * 0.8);
          ctx.fillStyle = body;
          blob(ctx, x, y - r * 0.15, r * swell, 0.05, t, 12); ctx.fill();
          ctx.fillStyle = 'rgba(255,220,250,0.55)';
          ctx.beginPath();
          circ(ctx, x - r * 0.5, y - r * 0.55, r * 0.17);
          circ(ctx, x + r * 0.45, y - r * 0.5, r * 0.13);
          circ(ctx, x + r * 0.05, y - r * 0.85, r * 0.12);
          ctx.fill();
        }
        eyes(ctx, x, y - r * 0.05, r * 0.3, r * 0.13, f.def.eye);
        break;
      case 'moth':
        var flap = Math.sin(t * 22) * 0.6;
        if (!eyesOnly) {
          ctx.fillStyle = flash ? '#fff' : '#8f93c8';
          for (var s = -1; s <= 1; s += 2) {
            ctx.beginPath();
            ctx.ellipse(x + s * r * 0.9, y - r * 0.2, r * 0.95, r * (0.6 + 0.4 * Math.abs(flap)), s * 0.5, 0, TAU);
            ctx.fill();
          }
          ctx.fillStyle = body;
          ctx.beginPath(); ell(ctx, x, y, r * 0.45, r * 0.85); ctx.fill();
          ctx.strokeStyle = body; ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x - r * 0.15, y - r * 0.7); ctx.quadraticCurveTo(x - r * 0.5, y - r * 1.4, x - r * 0.7, y - r * 1.2);
          ctx.moveTo(x + r * 0.15, y - r * 0.7); ctx.quadraticCurveTo(x + r * 0.5, y - r * 1.4, x + r * 0.7, y - r * 1.2);
          ctx.stroke();
        }
        eyes(ctx, x, y - r * 0.35, r * 0.18, r * 0.12, f.def.eye);
        break;
      case 'beetle':
        var ang = f && f.ang || 0;
        if (!eyesOnly) {
          ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2);
          ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 2.5;
          for (var l = -1; l <= 1; l++) {
            var k = Math.sin(t * 14 + l) * r * 0.15;
            ctx.beginPath();
            ctx.moveTo(-r * 0.6, l * r * 0.4); ctx.lineTo(-r * 1.15, l * r * 0.5 + k);
            ctx.moveTo(r * 0.6, l * r * 0.4); ctx.lineTo(r * 1.15, l * r * 0.5 - k);
            ctx.stroke();
          }
          ctx.fillStyle = f && f.windup > 0 && Math.floor(t * 16) % 2 ? '#a3402a' : body;
          if (flash) ctx.fillStyle = '#fff';
          ctx.beginPath(); ell(ctx, 0, 0, r * 0.85, r * 1.05); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(0, -r * 0.6); ctx.lineTo(0, r * 1); ctx.stroke();
          ctx.fillStyle = '#7a5b3c';
          for (var sp = 0; sp < 3; sp++) {
            ctx.beginPath();
            ctx.moveTo(-r * 0.15, -r * 0.2 + sp * r * 0.38); ctx.lineTo(0, -r * 0.45 + sp * r * 0.38); ctx.lineTo(r * 0.15, -r * 0.2 + sp * r * 0.38);
            ctx.fill();
          }
          ctx.fillStyle = '#2a2018';
          ctx.beginPath(); circ(ctx, 0, -r * 0.95, r * 0.42); ctx.fill();
        }
        ctx.restore(); ctx.save();
        var ex = Math.cos(ang) * r * 0.95, ey = Math.sin(ang) * r * 0.95;
        eyes(ctx, x + ex, y + ey, r * 0.18, r * 0.11, f.def.eye);
        break;
      case 'shade':
        if (!eyesOnly) {
          ctx.fillStyle = body;
          ctx.globalAlpha = 0.92;
          ctx.beginPath();
          ctx.moveTo(x, y - r * 1.2);
          ctx.quadraticCurveTo(x + r * 1.1, y - r * 0.6, x + r * 0.9, y + r * 0.8);
          for (var j = 0; j <= 4; j++) ctx.lineTo(x + r * 0.9 - (j / 4) * r * 1.8, y + r * 0.8 + (j % 2 ? -r * 0.3 : Math.sin(t * 6 + j) * r * 0.15));
          ctx.quadraticCurveTo(x - r * 1.1, y - r * 0.6, x, y - r * 1.2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#120c1a';
          ctx.beginPath(); ell(ctx, x, y - r * 0.3, r * 0.55, r * 0.45); ctx.fill();
        }
        eyes(ctx, x, y - r * 0.3, r * 0.22, r * 0.11, f.def.eye);
        break;
    }
    ctx.restore();
  }

  function boss(ctx, kind, x, y, r, t, b, eyesOnly) {
    ctx.save();
    var flash = b && b.flash > 0;
    var body = flash ? '#fff' : b.def.body;
    if (!eyesOnly) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ell(ctx, x, y + r * 0.85, r, r * 0.3); ctx.fill();
    }
    if (kind === 'rootmaw') {
      if (!eyesOnly) {
        ctx.strokeStyle = flash ? '#fff' : '#3d2d20'; ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
        for (var i = 0; i < 6; i++) {
          var a = Math.PI * (0.1 + i * 0.16), wig = Math.sin(t * 3 + i) * 0.12;
          ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.6, y + r * 0.4);
          ctx.quadraticCurveTo(x + Math.cos(a + wig) * r * 1.2, y + r * 0.6, x + Math.cos(a + wig) * r * 1.4, y + r * 0.95);
          ctx.stroke();
        }
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.85, y + r * 0.6); ctx.lineTo(x - r * 0.75, y - r * 0.8);
        ctx.quadraticCurveTo(x, y - r * 1.05, x + r * 0.75, y - r * 0.8);
        ctx.lineTo(x + r * 0.85, y + r * 0.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8a6b4a';
        ctx.beginPath(); ell(ctx, x, y - r * 0.82, r * 0.72, r * 0.2); ctx.fill();
        ctx.strokeStyle = '#6a5038'; ctx.lineWidth = 2;
        ctx.beginPath(); ell(ctx, x, y - r * 0.82, r * 0.4, r * 0.1); ctx.stroke();
        ctx.fillStyle = '#4caf5a';
        ctx.beginPath(); circ(ctx, x - r * 0.4, y - r * 0.95, r * 0.15); circ(ctx, x - r * 0.2, y - r * 1.02, r * 0.12); ctx.fill();
        var open = b.tell > 0 ? 0.35 : 0.12 + Math.sin(t * 2) * 0.04;
        ctx.fillStyle = '#1a0f08';
        ctx.beginPath(); ell(ctx, x, y + r * 0.15, r * 0.45, r * open); ctx.fill();
        ctx.fillStyle = '#e8d9b0';
        for (var k = -2; k <= 2; k++) {
          ctx.beginPath(); ctx.moveTo(x + k * r * 0.15 - r * 0.05, y + r * 0.15 - r * open * 0.8);
          ctx.lineTo(x + k * r * 0.15 + r * 0.05, y + r * 0.15 - r * open * 0.8); ctx.lineTo(x + k * r * 0.15, y + r * 0.15 - r * open * 0.2); ctx.fill();
        }
      }
      eyes(ctx, x, y - r * 0.35, r * 0.3, r * 0.1, b.def.eye);
    } else if (kind === 'duskwing') {
      var flap = Math.sin(t * 9);
      if (!eyesOnly) {
        for (var s = -1; s <= 1; s += 2) {
          ctx.fillStyle = flash ? '#fff' : '#7f82c4';
          ctx.beginPath(); ctx.ellipse(x + s * r * 0.95, y - r * 0.35, r * 1.0, r * (0.55 + 0.25 * Math.abs(flap)), s * 0.45, 0, TAU); ctx.fill();
          ctx.fillStyle = flash ? '#fff' : '#9c8fd8';
          ctx.beginPath(); ctx.ellipse(x + s * r * 0.75, y + r * 0.35, r * 0.6, r * 0.4, -s * 0.5, 0, TAU); ctx.fill();
          ctx.fillStyle = '#d7f4ff';
          ctx.beginPath(); circ(ctx, x + s * r * 1.15, y - r * 0.45, r * 0.18); ctx.fill();
        }
        ctx.fillStyle = body;
        ctx.beginPath(); ell(ctx, x, y, r * 0.38, r * 0.9); ctx.fill();
        ctx.fillStyle = '#ffd34a';
        ctx.beginPath();
        ctx.moveTo(x - r * 0.3, y - r * 0.75); ctx.lineTo(x - r * 0.25, y - r * 1.1); ctx.lineTo(x - r * 0.1, y - r * 0.88);
        ctx.lineTo(x, y - r * 1.18); ctx.lineTo(x + r * 0.1, y - r * 0.88); ctx.lineTo(x + r * 0.25, y - r * 1.1); ctx.lineTo(x + r * 0.3, y - r * 0.75);
        ctx.closePath(); ctx.fill();
      }
      eyes(ctx, x, y - r * 0.5, r * 0.15, r * 0.09, b.def.eye);
    } else {
      var pulse = 1 + Math.sin(t * 5) * 0.05 + (b.tell > 0 ? 0.08 : 0);
      if (!eyesOnly) {
        ctx.strokeStyle = flash ? '#fff' : '#4a2f63'; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round';
        for (var n = 0; n < 8; n++) {
          var aa = n / 8 * TAU + t * 0.4;
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + Math.cos(aa + 0.4) * r * 1.2, y + Math.sin(aa + 0.4) * r * 1.2,
            x + Math.cos(aa + Math.sin(t * 2 + n) * 0.3) * r * 1.6, y + Math.sin(aa + Math.sin(t * 2 + n) * 0.3) * r * 1.6);
          ctx.stroke();
        }
        ctx.fillStyle = body;
        blob(ctx, x, y, r * pulse, 0.06, t, 16); ctx.fill();
        var g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.7);
        g.addColorStop(0, 'rgba(255,93,143,0.7)'); g.addColorStop(1, 'rgba(255,93,143,0)');
        ctx.fillStyle = g; ctx.beginPath(); circ(ctx, x, y, r * 0.7); ctx.fill();
      }
      eyes(ctx, x, y - r * 0.1, r * 0.28, r * 0.13, b.def.eye);
      eyes(ctx, x, y - r * 0.45, r * 0.12, r * 0.07, b.def.eye);
    }
    ctx.restore();
  }

  // ---- scenery ----------------------------------------------------------------

  function rock(ctx, x, y, r, seed, area) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ell(ctx, x + r * 0.1, y + r * 0.45, r * 1.05, r * 0.55); ctx.fill();
    if (area.deco === 'mushroom') {
      // big toadstool
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(x - r * 0.3, y - r * 0.2, r * 0.6, r * 0.75);
      ctx.fillStyle = seed % 2 ? '#c94a3a' : '#c27a32';
      ctx.beginPath(); ctx.ellipse(x, y - r * 0.2, r, r * 0.65, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,245,220,0.85)';
      ctx.beginPath();
      circ(ctx, x - r * 0.45, y - r * 0.45, r * 0.13);
      circ(ctx, x + r * 0.2, y - r * 0.62, r * 0.16);
      circ(ctx, x + r * 0.55, y - r * 0.3, r * 0.1);
      ctx.fill();
    } else if (area.deco === 'reed') {
      // mossy stone in a puddle
      ctx.fillStyle = 'rgba(120,180,210,0.25)';
      ctx.beginPath(); ell(ctx, x, y + r * 0.3, r * 1.3, r * 0.6); ctx.fill();
      ctx.fillStyle = '#5d6b70';
      blob(ctx, x, y - r * 0.05, r * 0.9, 0.06, seed, 8); ctx.fill();
      ctx.fillStyle = '#4f8a5a';
      ctx.beginPath(); ctx.ellipse(x - r * 0.1, y - r * 0.55, r * 0.6, r * 0.25, -0.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#7aa35a'; ctx.lineWidth = 2;
      for (var i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(x + r * 0.8 + i * 3, y + r * 0.2);
        ctx.quadraticCurveTo(x + r * 0.9 + i * 4, y - r * 0.6, x + r * 0.7 + i * 6, y - r * (0.9 + i * 0.15)); ctx.stroke();
      }
    } else {
      // crystal cluster
      var cols = ['#9b6ad1', '#c79bff', '#6e44a0'];
      for (var c = -1; c <= 1; c++) {
        var h = r * (c === 0 ? 1.5 : 1), w = r * 0.38;
        ctx.fillStyle = cols[(c + 1 + seed) % 3];
        ctx.beginPath();
        ctx.moveTo(x + c * r * 0.45 - w, y + r * 0.35);
        ctx.lineTo(x + c * r * 0.45 - w * 0.7, y - h * 0.55);
        ctx.lineTo(x + c * r * 0.45 + c * r * 0.1, y - h);
        ctx.lineTo(x + c * r * 0.45 + w * 0.7, y - h * 0.55);
        ctx.lineTo(x + c * r * 0.45 + w, y + r * 0.35);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x - r * 0.1, y - r * 1.2, r * 0.08, r * 0.9);
    }
  }

  function gate(ctx, x, y, w, open, t, area) {
    ctx.save();
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(x - w / 2 - 10, y - 8, 12, 44);
    ctx.fillRect(x + w / 2 - 2, y - 8, 12, 44);
    ctx.beginPath(); ctx.arc(x, y, w / 2 + 6, Math.PI, 0); ctx.lineTo(x + w / 2 - 2, y); ctx.arc(x, y, w / 2 - 2, 0, Math.PI, true); ctx.fill();
    if (open) {
      var g = ctx.createRadialGradient(x, y + 10, 4, x, y + 10, w);
      g.addColorStop(0, 'rgba(255,240,180,0.95)'); g.addColorStop(0.5, 'rgba(255,190,90,0.6)'); g.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, w / 2 - 2, Math.PI, 0); ctx.lineTo(x + w / 2 - 2, y + 36); ctx.lineTo(x - w / 2 + 2, y + 36); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,190,' + (0.5 + 0.3 * Math.sin(t * 4)) + ')';
      for (var i = 0; i < 6; i++) {
        var px = x + Math.sin(t * 1.3 + i * 2.1) * w * 0.35, py = y + 30 - ((t * 25 + i * 13) % 50);
        ctx.beginPath(); circ(ctx, px, py, 2); ctx.fill();
      }
    } else {
      ctx.strokeStyle = area.tint; ctx.lineWidth = 4;
      for (var b = -2; b <= 2; b++) {
        ctx.beginPath(); ctx.moveTo(x + b * w * 0.17, y - w * 0.4 * Math.cos(b * 0.35)); ctx.lineTo(x + b * w * 0.17, y + 36); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---- icons for the shop -----------------------------------------------------

  function weaponIcon(ctx, id, s, color) {
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (id === 'sling') {
      ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = s * 0.09;
      ctx.beginPath(); ctx.moveTo(0, s * 0.38); ctx.lineTo(0, 0); ctx.lineTo(-s * 0.2, -s * 0.3); ctx.moveTo(0, 0); ctx.lineTo(s * 0.2, -s * 0.3); ctx.stroke();
      ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = s * 0.03;
      ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.3); ctx.quadraticCurveTo(0, -s * 0.05, s * 0.2, -s * 0.3); ctx.stroke();
      flame(ctx, 0, -s * 0.18, s * 0.12, 0.3);
    } else if (id === 'bow') {
      ctx.strokeStyle = '#4f8a3a'; ctx.lineWidth = s * 0.08;
      ctx.beginPath(); ctx.arc(-s * 0.15, 0, s * 0.36, -1.1, 1.1); ctx.stroke();
      ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = s * 0.025;
      ctx.beginPath(); ctx.moveTo(s * 0.0, -s * 0.32); ctx.lineTo(s * 0.0, s * 0.32); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = s * 0.05;
      ctx.beginPath(); ctx.moveTo(-s * 0.3, 0); ctx.lineTo(s * 0.36, 0); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(s * 0.42, 0); ctx.lineTo(s * 0.3, -s * 0.07); ctx.lineTo(s * 0.3, s * 0.07); ctx.fill();
    } else if (id === 'ring') {
      ringShape(ctx, 0, 0, s * 0.32, 0.4, color);
    } else {
      ctx.strokeStyle = '#6a4a8a'; ctx.lineWidth = s * 0.08;
      ctx.beginPath(); ctx.moveTo(-s * 0.25, s * 0.38); ctx.lineTo(s * 0.12, -s * 0.15); ctx.stroke();
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8;
      ctx.beginPath(); circ(ctx, s * 0.18, -s * 0.22, s * 0.13); ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.025;
      ctx.beginPath(); ctx.moveTo(s * 0.2, -s * 0.42); ctx.lineTo(s * 0.3, -s * 0.3); ctx.lineTo(s * 0.24, -s * 0.28); ctx.lineTo(s * 0.36, -s * 0.15); ctx.stroke();
    }
    ctx.restore();
  }

  function ringShape(ctx, x, y, r, rot, color) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.strokeStyle = color; ctx.lineWidth = r * 0.3;
    ctx.beginPath(); circ(ctx, 0, 0, r * 0.75); ctx.stroke();
    ctx.fillStyle = '#6a4a2a';
    for (var i = 0; i < 6; i++) {
      var a = i / 6 * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
      ctx.lineTo(Math.cos(a + 0.25) * r * 1.2, Math.sin(a + 0.25) * r * 1.2);
      ctx.lineTo(Math.cos(a + 0.4) * r * 0.85, Math.sin(a + 0.4) * r * 0.85);
      ctx.fill();
    }
    ctx.restore();
  }

  function skillIcon(ctx, id, s, color) {
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineWidth = s * 0.08;
    if (id === 'dash') {
      for (var i = 0; i < 3; i++) { ctx.globalAlpha = 0.4 + i * 0.3; ctx.beginPath(); ctx.moveTo(-s * 0.35 + i * s * 0.1, -s * 0.15 + i * s * 0.15); ctx.lineTo(s * 0.05 + i * s * 0.1, -s * 0.15 + i * s * 0.15); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.beginPath(); circ(ctx, s * 0.25, 0, s * 0.14); ctx.fill();
    } else if (id === 'burst') {
      for (var j = 0; j < 8; j++) { var a = j / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.18, Math.sin(a) * s * 0.18); ctx.lineTo(Math.cos(a) * s * 0.38, Math.sin(a) * s * 0.38); ctx.stroke(); }
      ctx.beginPath(); circ(ctx, 0, 0, s * 0.12); ctx.fill();
    } else if (id === 'wax') {
      ctx.fillStyle = '#f7ecd2'; ctx.fillRect(-s * 0.15, -s * 0.15, s * 0.3, s * 0.45);
      ctx.fillStyle = '#e04a4a';
      ctx.beginPath(); ctx.moveTo(0, -s * 0.18); ctx.bezierCurveTo(-s * 0.3, -s * 0.4, -s * 0.15, -s * 0.55, 0, -s * 0.38); ctx.bezierCurveTo(s * 0.15, -s * 0.55, s * 0.3, -s * 0.4, 0, -s * 0.18); ctx.fill();
    } else if (id === 'feet') {
      ctx.fillStyle = '#7a4a2a';
      ctx.beginPath(); ell(ctx, -s * 0.1, s * 0.15, s * 0.18, s * 0.11); ctx.fill();
      ctx.strokeStyle = color;
      for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-s * 0.42, -s * 0.2 + k * s * 0.12); ctx.lineTo(-s * 0.3, -s * 0.2 + k * s * 0.12); ctx.stroke(); }
      ctx.fillStyle = '#7a4a2a'; ctx.beginPath(); ell(ctx, s * 0.2, -s * 0.08, s * 0.18, s * 0.11); ctx.fill();
    } else {
      coin(ctx, -s * 0.1, s * 0.06, s * 0.2);
      coin(ctx, s * 0.15, -s * 0.12, s * 0.15);
    }
    ctx.restore();
  }

  function coin(ctx, x, y, r, t) {
    var sq = t === undefined ? 1 : Math.abs(Math.cos(t * 4));
    ctx.fillStyle = '#d99400';
    ctx.beginPath(); ell(ctx, x, y, r * Math.max(0.25, sq), r); ctx.fill();
    ctx.fillStyle = '#ffd34a';
    ctx.beginPath(); ell(ctx, x, y, r * 0.75 * Math.max(0.25, sq), r * 0.75); ctx.fill();
  }

  function heart(ctx, x, y, s) {
    ctx.fillStyle = '#ff5b6e';
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.4);
    ctx.bezierCurveTo(x - s, y - s * 0.2, x - s * 0.45, y - s * 0.9, x, y - s * 0.35);
    ctx.bezierCurveTo(x + s * 0.45, y - s * 0.9, x + s, y - s * 0.2, x, y + s * 0.4);
    ctx.fill();
  }

  root.WWDraw = {
    wick: wick, foe: foe, boss: boss, rock: rock, gate: gate, flame: flame,
    weaponIcon: weaponIcon, skillIcon: skillIcon, ringShape: ringShape, coin: coin, heart: heart
  };
})(typeof self !== 'undefined' ? self : this);
