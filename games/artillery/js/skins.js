// Three looks for the same game. Each skin renames the weapons, picks the
// players, and draws its own sky, ground, projectiles and explosion bits.
(function () {
  'use strict';

  // Weapon ids are shared by every skin (see WEAPONS in engine.js).
  // Each skin maps id -> [display name, look]. The look depends on the skin:
  // concert = note shape, wild = nature prop, alien = mushroom colour.
  const Art = window.ArtilleryArt;

  function drawMushroom(ctx, x, y, size, cap, spin) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin || 0);
    const s = size;
    // stem
    ctx.fillStyle = '#f4ead5';
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, 0);
    ctx.quadraticCurveTo(-s * 0.28, s * 0.55, -s * 0.18, s * 0.6);
    ctx.lineTo(s * 0.18, s * 0.6);
    ctx.quadraticCurveTo(s * 0.28, s * 0.55, s * 0.22, 0);
    ctx.closePath();
    ctx.fill();
    // cap
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, s * 0.05);
    ctx.quadraticCurveTo(-s * 0.62, -s * 0.62, 0, -s * 0.62);
    ctx.quadraticCurveTo(s * 0.62, -s * 0.62, s * 0.6, s * 0.05);
    ctx.closePath();
    ctx.fill();
    // spots
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    [[-0.28, -0.25, 0.1], [0.12, -0.4, 0.09], [0.3, -0.12, 0.08], [-0.05, -0.1, 0.07]].forEach(function (d) {
      ctx.beginPath();
      ctx.arc(d[0] * s, d[1] * s, d[2] * s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function rand(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function skyGradient(ctx, w, h, stops) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    stops.forEach(function (c, i) { g.addColorStop(i / (stops.length - 1), c); });
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  const SKINS = {
    concert: {
      id: 'concert',
      name: 'Concert Clash',
      tagline: 'Instruments fire musical notes',
      players: [
        { name: 'Trumpet', kind: 'trumpet', color: '#ffd166' },
        { name: 'Drum', kind: 'drum', color: '#4cc9f0' }
      ],
      ground: ['#5b3a29', '#2b1a12'],
      edge: '#f2c14e',
      edgeWidth: 4,
      boom: ['#ffd166', '#ef476f', '#ffffff', '#4cc9f0'],
      weapons: {
        single: ['Quarter Note', 'quarter'],
        heavy: ['Whole Note', 'whole'],
        triple: ['Triad', 'triad'],
        cluster: ['Arpeggio', 'beamed'],
        bounce: ['Bouncy Beat', 'eighth'],
        roller: ['Rolling Drumroll', 'drum'],
        dirt: ['Bass Mound', 'flat'],
        dig: ['Drill Solo', 'natural'],
        shower: ['Crescendo Rain', 'eighth'],
        homing: ['Perfect Pitch', 'sharp'],
        mega: ['Grand Finale', 'beamed']
      },
      drawSky: function (ctx, w, h) {
        skyGradient(ctx, w, h, ['#140b2e', '#3b1f63', '#a4507a', '#f08a5d']);
        const r = rand(7);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        for (let i = 0; i < 70; i++) {
          ctx.globalAlpha = 0.3 + r() * 0.7;
          ctx.fillRect(r() * w, r() * h * 0.5, 1.5, 1.5);
        }
        ctx.globalAlpha = 1;
        // a faint music staff across the sky
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          for (let x = 0; x <= w; x += 20) {
            const y = 110 + i * 16 + Math.sin(x / 180) * 24;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        Art.drawNote(ctx, 'beamed', 80, 175, 90);
        // spotlights
        [[0.2, '#ffd16633'], [0.8, '#4cc9f033']].forEach(function (s) {
          const g = ctx.createRadialGradient(w * s[0], 0, 10, w * s[0], 0, h * 0.9);
          g.addColorStop(0, s[1]);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        });
      },
      drawGroundDetail: function (ctx, heights, w, h) {
        // piano-key stripes along the surface
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x < w; x++) ctx.lineTo(x, heights[x]);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.clip();
        for (let x = 0; x < w; x += 24) {
          ctx.fillStyle = (x / 24) % 7 === 2 || (x / 24) % 7 === 5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.06)';
          ctx.fillRect(x, 0, 12, h);
        }
        ctx.restore();
      },
      drawProjectile: function (ctx, id, x, y, t, color) {
        const look = this.weapons[id][1];
        const size = id === 'mega' ? 40 : id === 'heavy' ? 30 : 24;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(id === 'roller' ? t * 9 : Math.sin(t * 10) * 0.3);
        ctx.shadowColor = color;
        ctx.shadowBlur = id === 'mega' ? 18 : 10;
        if (look === 'drum') Art.miniDrum(ctx, 0, 0, size * 0.9);
        else {
          ctx.fillStyle = id === 'mega' ? '#fff3b0' : color;
          Art.drawNote(ctx, look, 0, 0, size);
        }
        ctx.restore();
      },
      particle: function (ctx, p) {
        ctx.fillStyle = p.color;
        if (!p.glyph) { ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2); ctx.fill(); return; }
        if (p.glyph === 'spark') { Art.star(ctx, p.x, p.y, p.size * 0.6, p.color); return; }
        Art.drawNote(ctx, p.glyph || 'eighth', p.x, p.y, p.size * 2);
      },
      particleGlyphs: ['eighth', 'quarter', 'beamed', 'spark']
    },

    wild: {
      id: 'wild',
      name: 'Wild Throwdown',
      tagline: 'Animals throw nature things',
      players: [
        { name: 'Bear', kind: 'bear', color: '#ff9f1c' },
        { name: 'Fox', kind: 'fox', color: '#e63946' }
      ],
      ground: ['#7a5230', '#3d2614'],
      edge: '#55a630',
      edgeWidth: 8,
      boom: ['#ffbe0b', '#fb5607', '#8ac926', '#ffffff'],
      weapons: {
        single: ['Acorn', 'acorn'],
        heavy: ['Coconut', 'coconut'],
        triple: ['Berry Bunch', 'berries'],
        cluster: ['Seed Burst', 'sunflower'],
        bounce: ['Skipping Stone', 'stone'],
        roller: ['Rolling Log', 'log'],
        dirt: ['Mud Ball', 'mud'],
        dig: ['Burrow', 'clod'],
        shower: ['Bee Swarm', 'bee'],
        homing: ['Hawk Feather', 'feather'],
        mega: ['Boulder', 'boulder']
      },
      drawSky: function (ctx, w, h) {
        skyGradient(ctx, w, h, ['#4ea8de', '#90e0ef', '#e0fbfc']);
        // sun
        const g = ctx.createRadialGradient(w * 0.82, 90, 10, w * 0.82, 90, 120);
        g.addColorStop(0, '#fff8c4');
        g.addColorStop(0.35, '#ffe066aa');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // clouds
        const r = rand(3);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < 6; i++) {
          const cx = r() * w, cy = 40 + r() * 150, s = 20 + r() * 25;
          for (let j = 0; j < 4; j++) {
            ctx.beginPath();
            ctx.arc(cx + j * s * 0.8, cy + (j % 2) * -s * 0.4, s, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // distant hills
        ctx.fillStyle = '#74c69d88';
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 10) ctx.lineTo(x, h * 0.55 + Math.sin(x / 140) * 30 + Math.sin(x / 57) * 12);
        ctx.lineTo(w, h);
        ctx.fill();
      },
      drawGroundDetail: function (ctx, heights, w) {
        // soil pebbles below the grass line
        const r = rand(11);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        for (let i = 0; i < 90; i++) {
          const x = r() * w, d = 20 + r() * 160;
          ctx.beginPath(); ctx.ellipse(x, heights[Math.floor(x)] + d, 3 + r() * 5, 2 + r() * 3, 0, 0, Math.PI * 2); ctx.fill();
        }
        for (let i = 0; i < 70; i++) {
          const x = Math.floor(r() * w), y = heights[x] + 1, k = r();
          if (k < 0.62) Art.grassTuft(ctx, x, y, 10 + r() * 8, r() < 0.5 ? '#3a7d44' : '#6ab04c');
          else if (k < 0.9) Art.flower(ctx, x, y, 9 + r() * 6, ['#ffffff', '#ffafcc', '#cdb4db', '#ffd60a'][i % 4]);
          else drawMushroom(ctx, x, y - 5, 9 + r() * 4, '#d62828', 0);
        }
      },
      drawProjectile: function (ctx, id, x, y, t) {
        const size = id === 'mega' ? 42 : id === 'heavy' ? 30 : 22;
        const look = this.weapons[id][1];
        const spin = look === 'bee' || look === 'feather' ? Math.sin(t * 12) * 0.25 : t * 8;
        Art.drawNature(ctx, look, x, y, size, spin);
      },
      particle: function (ctx, p) {
        ctx.fillStyle = p.glyph === 'leaf2' ? '#e9a03b' : p.glyph === 'leaf' ? '#6ab04c' : p.color;
        if (p.glyph) Art.drawNature(ctx, 'leaf', p.x, p.y, p.size * 1.6, p.life * 6);
        else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      },
      particleGlyphs: ['leaf', 'leaf2', null, null, null]
    },

    alien: {
      id: 'alien',
      name: 'Spore Wars',
      tagline: 'Aliens shoot mushrooms',
      players: [
        { name: 'Zorp', kind: 'zorp', color: '#80ffdb' },
        { name: 'Glorb', kind: 'glorb', color: '#f72585' }
      ],
      ground: ['#3c1a5b', '#120626'],
      edge: '#b5179e',
      edgeWidth: 5,
      boom: ['#80ffdb', '#f72585', '#7209b7', '#ffffff'],
      weapons: {
        single: ['Button Cap', '#e63946'],
        heavy: ['Puffball', '#f1faee'],
        triple: ['Triple Caps', '#ffb703'],
        cluster: ['Spore Cloud', '#80ffdb'],
        bounce: ['Bounce Shroom', '#4cc9f0'],
        roller: ['Toadstool Wheel', '#fb8500'],
        dirt: ['Moss Bomb', '#52b788'],
        dig: ['Mycelium Drill', '#cdb4db'],
        shower: ['Spore Rain', '#f72585'],
        homing: ['Seeker Spore', '#ff006e'],
        mega: ['Mothership Morel', '#9d4edd']
      },
      drawSky: function (ctx, w, h) {
        skyGradient(ctx, w, h, ['#03001c', '#1b0a3c', '#3a0ca3', '#7209b7']);
        const r = rand(5);
        for (let i = 0; i < 120; i++) {
          ctx.globalAlpha = 0.2 + r() * 0.8;
          ctx.fillStyle = r() < 0.2 ? '#80ffdb' : '#ffffff';
          ctx.fillRect(r() * w, r() * h * 0.7, 2, 2);
        }
        ctx.globalAlpha = 1;
        // two moons
        [[0.15, 80, 40, '#f8edeb'], [0.7, 130, 22, '#80ffdb']].forEach(function (m) {
          ctx.fillStyle = m[3];
          ctx.beginPath();
          ctx.arc(w * m[0], m[1], m[2], 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          ctx.beginPath();
          ctx.arc(w * m[0] - m[2] * 0.3, m[1] - m[2] * 0.2, m[2] * 0.25, 0, Math.PI * 2);
          ctx.fill();
        });
        // ringed planet
        ctx.save();
        ctx.translate(w * 0.45, 70);
        ctx.fillStyle = '#ffb703';
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffb70399';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, 0, 34, 8, -0.3, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      },
      drawGroundDetail: function (ctx, heights, w) {
        const r = rand(9);
        const caps = ['#f72585', '#80ffdb', '#ffb703', '#9d4edd'];
        for (let i = 0; i < 22; i++) {
          const x = Math.floor(r() * w);
          drawMushroom(ctx, x, heights[x] - 6, 10 + r() * 10, caps[i % caps.length], 0);
        }
      },
      drawProjectile: function (ctx, id, x, y, t) {
        const size = id === 'mega' ? 34 : id === 'heavy' ? 26 : 18;
        ctx.save();
        ctx.shadowColor = this.weapons[id][1];
        ctx.shadowBlur = 14;
        drawMushroom(ctx, x, y, size, this.weapons[id][1], t * 7);
        ctx.restore();
      },
      particle: function (ctx, p) {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      },
      particleGlyphs: [null]
    }
  };

  window.ArtillerySkins = { SKINS: SKINS, drawMushroom: drawMushroom };
})();
