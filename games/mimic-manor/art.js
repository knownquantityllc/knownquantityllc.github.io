/*
 * Drawing for Mimic Manor: furniture (hiding spots), disguise props, Mimi and
 * the three seekers. Everything is drawn with canvas paths, bottom-centre
 * anchored at (x, y) in world units, so it scales with the house.
 */
(function (root) {
  'use strict';

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function box(c, x, y, w, h, fill, r) { c.fillStyle = fill; rr(c, x, y, w, h, r || 2); c.fill(); }
  function circle(c, x, y, r, fill) { c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  function line(c, x1, y1, x2, y2, stroke, w) {
    c.strokeStyle = stroke; c.lineWidth = w || 1;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  }

  // A door that swings open: dark gap behind, door panel squeezed sideways.
  function door(c, x, y, w, h, fill, open, knobLeft) {
    if (open > 0) box(c, x, y, w, h, '#160f1c', 1);
    var dw = w * (1 - 0.85 * open);
    var dx = knobLeft ? x + w - dw : x;
    box(c, dx, y, dw, h, fill, 1);
    if (open < 0.6) circle(c, knobLeft ? dx + 3 : dx + dw - 3, y + h / 2, 1.4, '#f3d27a');
  }

  // ---- hiding spots ---------------------------------------------------------

  var SPOTS = {
    wardrobe: { w: 40, h: 70, name: 'wardrobe' },
    bed: { w: 62, h: 30, name: 'bed' },
    piano: { w: 56, h: 44, name: 'piano' },
    clock: { w: 24, h: 74, name: 'grandfather clock' },
    fridge: { w: 34, h: 64, name: 'fridge' },
    pantry: { w: 38, h: 62, name: 'pantry' },
    table: { w: 52, h: 32, name: 'table' },
    barrel: { w: 30, h: 40, name: 'barrel' },
    washer: { w: 34, h: 38, name: 'washing machine' },
    crates: { w: 46, h: 40, name: 'crates' },
    trunk: { w: 46, h: 30, name: 'trunk' },
    chest: { w: 38, h: 28, name: 'toy chest' },
    bathtub: { w: 60, h: 32, name: 'bathtub' },
    sofa: { w: 60, h: 32, name: 'sofa' },
    boxes: { w: 44, h: 46, name: 'box pile' }
  };

  // open: 0 closed .. 1 fully searched open
  function drawSpot(c, type, x, y, open, t) {
    var s = SPOTS[type], w = s.w, h = s.h, L = x - w / 2, T = y - h;
    open = open || 0;
    switch (type) {
      case 'wardrobe':
        box(c, L - 2, T - 4, w + 4, 6, '#5a321b', 2);
        box(c, L, T, w, h, '#7b4b2a', 2);
        door(c, L + 3, T + 5, w / 2 - 4, h - 10, '#94603a', open, false);
        door(c, x + 1, T + 5, w / 2 - 4, h - 10, '#94603a', open * 0.6, true);
        box(c, L + 2, y - 4, 4, 4, '#4a2814', 1); box(c, L + w - 6, y - 4, 4, 4, '#4a2814', 1);
        break;
      case 'bed':
        box(c, L, T, 8, h, '#6d4228', 2);
        box(c, L + 6, T + 10, w - 8, 10, '#f4f1ea', 3);
        box(c, L + 8, T + 6, 14, 8, '#ffffff', 4);
        box(c, L + 20, T + 9, w - 22, 12, '#e86f7d', 3);
        box(c, L + 6, T + 20 - open * 4, w - 6, 10, '#d8576a', 2);
        if (open > 0) box(c, L + 8, T + 22, w - 12, 8 - open * 2, '#160f1c', 1);
        box(c, L + w - 6, T + 8, 6, h - 8, '#6d4228', 2);
        break;
      case 'piano':
        box(c, L, T, w, h - 8, '#2b2230', 3);
        box(c, L + 4, T + 14, w - 8, 6, '#f6f1e4', 1);
        for (var k = 0; k < 8; k++) box(c, L + 6 + k * 6, T + 14, 3, 3.5, '#2b2230', 0.5);
        box(c, L - 1, T - 2 - open * 10, w + 2, 5, '#3c3042', 2);
        if (open > 0) box(c, L + 3, T + 2, w - 6, 10 * open, '#160f1c', 1);
        box(c, L + 3, y - 8, 4, 8, '#2b2230', 1); box(c, L + w - 7, y - 8, 4, 8, '#2b2230', 1);
        box(c, x - 8, T + 26, 16, 3, '#c9a24a', 1);
        break;
      case 'clock':
        box(c, L, T + 16, w, h - 16, '#6a3b22', 3);
        circle(c, x, T + 12, 12, '#6a3b22');
        circle(c, x, T + 12, 9, '#f5ead0');
        var a = (t || 0) * 1.2;
        line(c, x, T + 12, x + Math.cos(a) * 6, T + 12 + Math.sin(a) * 6, '#2b2230', 1.4);
        line(c, x, T + 12, x + Math.cos(a / 12) * 4, T + 12 + Math.sin(a / 12) * 4, '#2b2230', 1.8);
        door(c, L + 4, T + 26, w - 8, h - 34, '#8a5233', open, false);
        if (open < 0.5) {
          var sw = Math.sin((t || 0) * 3) * 4;
          line(c, x, T + 28, x + sw, T + 50, '#c9a24a', 1.2);
          circle(c, x + sw, T + 52, 3, '#e3bf55');
        }
        break;
      case 'fridge':
        box(c, L, T, w, h, '#dfe9ef', 5);
        door(c, L + 2, T + 2, w - 4, 18, '#eef5f8', 0, false);
        door(c, L + 2, T + 22, w - 4, h - 26, '#eef5f8', open, false);
        box(c, L + w - 7, T + 8, 2, 8, '#9fb1bd', 1); box(c, L + w - 7, T + 28, 2, 14, '#9fb1bd', 1);
        box(c, L + 6, T + 30, 7, 6, '#ff8f6b', 1);
        break;
      case 'pantry':
        box(c, L, T, w, h, '#b9874f', 2);
        door(c, L + 3, T + 3, w - 6, h - 6, '#cfa06a', open, false);
        if (open < 0.5) { box(c, L + 9, T + 12, w - 18, 10, '#bf8c55', 1); box(c, L + 9, T + 34, w - 18, 10, '#bf8c55', 1); }
        break;
      case 'table':
        box(c, L - 3, T, w + 6, 6, '#8a5a3b', 2);
        box(c, L - 1, T + 4 - open * 3, w + 2, 18 - open * 8, '#f2f2f2', 2);
        for (var i = 0; i < 6; i++) box(c, L + 2 + i * (w - 4) / 6, T + 4 - open * 3, (w - 4) / 12, 18 - open * 8, '#e25e5e', 0);
        box(c, L + 2, T + 6, 4, h - 6, '#6d4228', 1); box(c, L + w - 6, T + 6, 4, h - 6, '#6d4228', 1);
        box(c, x - 5, T - 9, 10, 9, '#f7f7f7', 2); box(c, x - 3, T - 13, 2, 5, '#ffd36b', 1);
        break;
      case 'barrel':
        box(c, L, T, w, h, '#7a4c2c', 8);
        box(c, L, T + 6, w, 3, '#3d3640', 0); box(c, L, y - 9, w, 3, '#3d3640', 0);
        line(c, x - 6, T + 2, x - 6, y - 2, '#6a3e22', 1); line(c, x + 6, T + 2, x + 6, y - 2, '#6a3e22', 1);
        box(c, L + 1, T - 2 - open * 10, w - 2, 4, '#8f5b36', 2);
        if (open > 0) box(c, L + 3, T, w - 6, 3, '#160f1c', 1);
        break;
      case 'washer':
        box(c, L, T, w, h, '#e9eef2', 4);
        box(c, L, T, w, 7, '#cfd8de', 3);
        circle(c, L + 6, T + 3.5, 1.5, '#5aa86e');
        circle(c, x, T + 22, 11, '#9fb1bd');
        circle(c, x, T + 22, 8.5, open > 0 ? '#160f1c' : '#5f87a8');
        if (!open) { c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.arc(x - 2, T + 19, 3, 0, 7); c.fill(); }
        break;
      case 'crates':
        box(c, L, y - 22, 24, 22, '#a8743e', 1);
        box(c, L + 22, y - 26, 24, 26, '#b9844b', 1);
        box(c, L + 8 - open * 6, T - open * 6, 24, 18, '#9a6834', 1);
        [[L, y - 22, 24, 22], [L + 22, y - 26, 24, 26], [L + 8 - open * 6, T - open * 6, 24, 18]].forEach(function (b) {
          line(c, b[0] + 2, b[1] + 2, b[0] + b[2] - 2, b[1] + b[3] - 2, '#7b5128', 1.2);
        });
        break;
      case 'trunk':
        box(c, L, T + 10, w, h - 10, '#5b6e8c', 3);
        c.save(); c.translate(L, T + 12); c.rotate(-open * 0.9);
        box(c, 0, -12, w, 12, '#6b80a0', 5); box(c, w / 2 - 3, -4, 6, 6, '#e8c45a', 1);
        c.restore();
        box(c, L + 6, T + 10, 4, h - 10, '#c9a24a', 0); box(c, L + w - 10, T + 10, 4, h - 10, '#c9a24a', 0);
        break;
      case 'chest':
        box(c, L, T + 8, w, h - 8, '#e7a33a', 3);
        c.save(); c.translate(L, T + 10); c.rotate(-open * 0.9);
        box(c, 0, -10, w, 10, '#f0b952', 4); c.restore();
        circle(c, x - 8, T + 18, 3, '#e2465a'); circle(c, x + 1, T + 18, 3, '#3f9ad8'); circle(c, x + 10, T + 18, 3, '#5aa86e');
        break;
      case 'bathtub':
        box(c, L, T + 8, w, h - 12, '#f4f7fa', 8);
        box(c, L + 4, T + 8, w - 8, 4, open > 0 ? '#160f1c' : '#9fd6f2', 2);
        for (var b = 0; b < 4 && open < 0.5; b++) circle(c, L + 12 + b * 11, T + 7 - (b % 2) * 2, 5, '#ffffff');
        box(c, L + 6, y - 5, 5, 5, '#c9a24a', 1); box(c, L + w - 11, y - 5, 5, 5, '#c9a24a', 1);
        box(c, L + w - 6, T - 6, 3, 14, '#c9c9c9', 1); box(c, L + w - 12, T - 6, 8, 3, '#c9c9c9', 1);
        break;
      case 'sofa':
        box(c, L, T + 4, w, h - 8, '#c0526d', 7);
        box(c, L + 4, T + 14 - open * 6, w - 8, 9, '#d9708a', 4);
        if (open > 0) box(c, L + 6, T + 22, w - 12, 4, '#160f1c', 1);
        box(c, L - 2, T + 10, 9, h - 14, '#a8435c', 4); box(c, L + w - 7, T + 10, 9, h - 14, '#a8435c', 4);
        box(c, L + 4, y - 4, 4, 4, '#4a2814', 1); box(c, L + w - 8, y - 4, 4, 4, '#4a2814', 1);
        break;
      case 'boxes':
        box(c, L, y - 22, 26, 22, '#c99a62', 1);
        box(c, L + 22, y - 20, 22, 20, '#b88a55', 1);
        box(c, L + 6 + open * 8, T - open * 8, 26, 24, '#d6a96f', 1);
        line(c, L + 13, y - 22, L + 13, y, '#a87c47', 1);
        line(c, L + 19 + open * 8, T - open * 8, L + 19 + open * 8, T + 24 - open * 8, '#a87c47', 1);
        break;
    }
  }

  // ---- disguise props --------------------------------------------------------

  var PROPS = ['vase', 'lamp', 'plant'];
  function drawProp(c, kind, x, y, wob) {
    c.save(); c.translate(x, y); c.rotate((wob || 0) * 0.05); c.translate(-x, -y);
    if (kind === 'vase') {
      c.fillStyle = '#4d7fd0';
      c.beginPath();
      c.moveTo(x - 4, y - 24); c.lineTo(x + 4, y - 24);
      c.quadraticCurveTo(x + 2, y - 18, x + 9, y - 10); c.quadraticCurveTo(x + 10, y - 1, x + 5, y);
      c.lineTo(x - 5, y); c.quadraticCurveTo(x - 10, y - 1, x - 9, y - 10); c.quadraticCurveTo(x - 2, y - 18, x - 4, y - 24);
      c.fill();
      box(c, x - 7, y - 12, 14, 3, '#f4f1ea', 1);
      circle(c, x - 4, y - 4, 1.4, '#f4f1ea'); circle(c, x + 4, y - 4, 1.4, '#f4f1ea');
    } else if (kind === 'lamp') {
      box(c, x - 6, y - 3, 12, 3, '#6a3b22', 1);
      box(c, x - 1, y - 22, 2, 20, '#c9a24a', 0);
      c.fillStyle = '#f3c76a';
      c.beginPath(); c.moveTo(x - 6, y - 32); c.lineTo(x + 6, y - 32); c.lineTo(x + 10, y - 20); c.lineTo(x - 10, y - 20); c.closePath(); c.fill();
    } else {
      c.fillStyle = '#3f9a55';
      for (var i = -2; i <= 2; i++) {
        c.beginPath(); c.ellipse(x + i * 4, y - 18 - (2 - Math.abs(i)) * 3, 3.5, 9, i * 0.4, 0, 7); c.fill();
      }
      box(c, x - 7, y - 11, 14, 11, '#c76b3c', 2);
      box(c, x - 8, y - 12, 16, 3, '#a85a30', 1);
    }
    c.restore();
  }

  // ---- Mimi -------------------------------------------------------------------

  var MIMI = '#57dcc4', MIMI_DARK = '#2fae98';
  function drawMimi(c, x, y, o) {
    o = o || {};
    var t = o.t || 0, moving = o.moving;
    var sq = moving ? Math.sin(t * 16) * 0.12 : Math.sin(t * 3) * 0.05;
    var w = 22 * (1 + sq), h = 20 * (1 - sq);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.beginPath(); c.ellipse(x, y, w * 0.55, 3, 0, 0, 7); c.fill();
    c.fillStyle = o.color || MIMI;
    c.beginPath();
    c.moveTo(x - w / 2, y);
    c.bezierCurveTo(x - w / 2 - 2, y - h * 0.9, x - w * 0.25, y - h * 1.1, x, y - h);
    c.bezierCurveTo(x + w * 0.25, y - h * 1.1, x + w / 2 + 2, y - h * 0.9, x + w / 2, y);
    c.closePath(); c.fill();
    c.fillStyle = MIMI_DARK;
    for (var i = 0; i < 3; i++) circle(c, x - w / 2 + 4 + i * (w - 8) / 2, y - 1, 2.2, MIMI_DARK);
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.beginPath(); c.ellipse(x - w * 0.22, y - h * 0.72, 3, 2, -0.5, 0, 7); c.fill();
    drawEyes(c, x + (o.facing || 0) * 2, y - h * 0.55, o.facing || 0, t, o.scared);
  }
  function drawEyes(c, x, y, facing, t, scared, glow) {
    var blink = (Math.floor(t * 10) % 37) === 0 ? 0.2 : 1;
    var r = scared ? 4.4 : 3.8;
    if (glow) { c.fillStyle = 'rgba(160,255,230,0.35)'; c.beginPath(); c.arc(x, y, 12, 0, 7); c.fill(); }
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(x - 4.5, y, r, r * blink, 0, 0, 7); c.fill();
    c.beginPath(); c.ellipse(x + 4.5, y, r, r * blink, 0, 0, 7); c.fill();
    if (blink > 0.5) {
      circle(c, x - 4.5 + facing * 1.4, y + 0.5, scared ? 1.4 : 2, '#1b1530');
      circle(c, x + 4.5 + facing * 1.4, y + 0.5, scared ? 1.4 : 2, '#1b1530');
    }
  }

  // ---- seekers --------------------------------------------------------------

  function drawGranny(c, x, y, o) {
    o = o || {};
    var f = o.facing || 1, t = o.t || 0;
    var bob = o.moving ? Math.abs(Math.sin(t * 8)) * 1.5 : 0;
    c.save(); c.translate(x, y - bob); c.scale(f, 1);
    // legs + shoes
    box(c, -6, -8, 4, 8, '#e9d2c0', 1); box(c, 2, -8, 4, 8, '#e9d2c0', 1);
    box(c, -8, -2, 7, 3, '#3b2a2a', 1); box(c, 1, -2, 7, 3, '#3b2a2a', 1);
    // dress
    c.fillStyle = '#7d5bb5';
    c.beginPath(); c.moveTo(-8, -28); c.lineTo(8, -28); c.lineTo(12, -7); c.lineTo(-12, -7); c.closePath(); c.fill();
    box(c, -9, -16, 18, 3, '#6a4aa0', 1);
    // shawl
    c.fillStyle = '#e8b04a';
    c.beginPath(); c.moveTo(-9, -30); c.lineTo(9, -30); c.lineTo(0, -19); c.closePath(); c.fill();
    // head
    circle(c, 0, -36, 7, '#f1d3bc');
    circle(c, -2, -43, 6, '#e8e6ee'); circle(c, -6, -40, 4.5, '#e8e6ee');
    circle(c, -5, -46, 3.5, '#d8d4e2');
    // glasses + eye
    c.strokeStyle = '#3b2a2a'; c.lineWidth = 1;
    c.beginPath(); c.arc(3.5, -36, 2.4, 0, 7); c.stroke();
    circle(c, 4, -36, o.alert ? 1.4 : 0.9, '#3b2a2a');
    circle(c, 6, -32.5, 1, '#e48a8a');
    // arm + lantern
    var sw = o.moving ? Math.sin(t * 8) * 1.5 : 0;
    line(c, 2, -26, 11, -20 + sw, '#7d5bb5', 3);
    line(c, 11, -20 + sw, 11, -16 + sw, '#3b2a2a', 1);
    box(c, 8, -16 + sw, 6, 8, '#3b2a2a', 1);
    box(c, 9, -15 + sw, 4, 6, o.lanternOff ? '#555' : '#ffe58a', 1);
    c.restore();
  }

  function drawDog(c, x, y, o) {
    o = o || {};
    var f = o.facing || 1, t = o.t || 0, mv = o.moving;
    c.save(); c.translate(x, y); c.scale(f, 1);
    var leg = mv ? Math.sin(t * 18) * 3 : 0;
    box(c, -11 + leg, -8, 3, 8, '#8a5a32', 1); box(c, -6 - leg, -8, 3, 8, '#7a4c2a', 1);
    box(c, 6 + leg, -8, 3, 8, '#8a5a32', 1); box(c, 10 - leg, -8, 3, 8, '#7a4c2a', 1);
    box(c, -14, -17, 28, 11, '#b07a45', 5);
    box(c, -6, -17, 9, 6, '#f2e2c9', 3);
    // tail wag
    var wag = Math.sin(t * (o.excited ? 22 : 8)) * 0.6;
    c.save(); c.translate(-13, -15); c.rotate(-0.8 + wag);
    box(c, -2, -10, 3, 10, '#b07a45', 1.5); c.restore();
    // head: nose down when sniffing
    var hd = o.sniff ? 6 + Math.sin(t * 14) * 1 : 0;
    c.save(); c.translate(12, -18 + hd);
    box(c, -4, -8, 12, 10, '#b07a45', 4);
    box(c, 4, -4, 7, 6, '#c9925c', 3);
    circle(c, 11, -2, 2, '#2b1d1a');
    circle(c, 3, -5, 1.4, '#2b1d1a');
    var ear = mv ? Math.sin(t * 18) * 0.2 : 0;
    c.save(); c.translate(-2, -7); c.rotate(0.3 + ear);
    box(c, -3, 0, 6, 13, '#7a4c2a', 3); c.restore();
    c.restore();
    // collar
    box(c, 6, -16 + hd * 0.4, 4, 6, '#e2465a', 1);
    c.restore();
  }

  function drawHoover(c, x, y, o) {
    o = o || {};
    var t = o.t || 0, f = o.facing || 1;
    c.save(); c.translate(x, y); c.scale(f, 1);
    // brushes
    for (var i = 0; i < 2; i++) {
      c.save(); c.translate(i ? 13 : -13, -3); c.rotate(t * 20 * (i ? 1 : -1));
      for (var k = 0; k < 3; k++) { c.rotate(Math.PI * 2 / 3); line(c, 0, 0, 5, 0, '#4d4d5a', 1.2); }
      c.restore();
    }
    box(c, -16, -12, 32, 10, '#3d4b5e', 5);
    c.fillStyle = '#56677e';
    c.beginPath(); c.ellipse(0, -12, 14, 7, 0, Math.PI, 0); c.fill();
    var blink = Math.floor(t * 4) % 2;
    circle(c, 7, -10, 2.4, blink ? '#ff4d4d' : '#b42c2c');
    box(c, -10, -7, 12, 2, '#9fb1bd', 1);
    // little antenna
    line(c, -4, -18, -6, -24, '#9fb1bd', 1); circle(c, -6, -24, 1.5, '#ff4d4d');
    c.restore();
  }

  function drawPortrait(c, x, y, o) {
    o = o || {};
    box(c, x - 13, y - 17, 26, 34, '#c9a24a', 2);
    box(c, x - 10, y - 14, 20, 28, '#3e5a66', 1);
    circle(c, x, y - 2, 7, '#e9cdb4');
    box(c, x - 9, y + 6, 18, 8, '#5b2e46', 3);
    c.fillStyle = '#4a3326'; c.beginPath(); c.arc(x, y - 5, 7, Math.PI, 0); c.fill();
    var lx = (o.look || 0) * 1.5;
    if (o.gasp > 0) {
      circle(c, x - 2.5, y - 2, 1.8, '#fff'); circle(c, x + 2.5, y - 2, 1.8, '#fff');
      circle(c, x - 2.5 + lx, y - 2, 0.9, '#000'); circle(c, x + 2.5 + lx, y - 2, 0.9, '#000');
      circle(c, x, y + 2.5, 1.6, '#3b1a1a');
    } else {
      circle(c, x - 2.5 + lx, y - 2, 0.9, '#000'); circle(c, x + 2.5 + lx, y - 2, 0.9, '#000');
      line(c, x - 2, y + 2.5, x + 2, y + 2.5, '#7a3a3a', 0.8);
    }
  }

  function drawCookie(c, x, y, gold, t) {
    var by = Math.sin((t || 0) * 4 + x) * 1.5;
    c.fillStyle = gold ? 'rgba(255,215,90,0.35)' : 'rgba(255,220,160,0.18)';
    c.beginPath(); c.arc(x, y - 8 + by, gold ? 11 : 8, 0, 7); c.fill();
    circle(c, x, y - 8 + by, 5, gold ? '#ffd23f' : '#d79a54');
    circle(c, x - 1.5, y - 9.5 + by, 0.9, gold ? '#fff5c0' : '#5a3218');
    circle(c, x + 2, y - 7 + by, 0.9, gold ? '#fff5c0' : '#5a3218');
    circle(c, x - 0.5, y - 5.5 + by, 0.8, gold ? '#fff5c0' : '#5a3218');
  }

  root.MMArt = {
    SPOTS: SPOTS, PROPS: PROPS,
    rr: rr, box: box, circle: circle, line: line,
    drawSpot: drawSpot, drawProp: drawProp, drawMimi: drawMimi, drawEyes: drawEyes,
    drawGranny: drawGranny, drawDog: drawDog, drawHoover: drawHoover,
    drawPortrait: drawPortrait, drawCookie: drawCookie
  };
})(typeof self !== 'undefined' ? self : this);
