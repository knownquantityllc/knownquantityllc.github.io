// Level layouts. The world is 1800 x 900 units; the ground top is at y = 840.
// Every item is placed by its bottom edge so stacks rest exactly on each other.
(function () {
  'use strict';

  const GROUND = 840;

  function builder() {
    const items = [];
    const b = {
      items,
      block(m, x, bottom, w, h, angle) {
        items.push({ k: 'block', m, x, y: bottom - h / 2, w, h, a: angle || 0 });
        return bottom - h;
      },
      plat(x, bottom, opts) {
        const king = !!(opts && opts.king);
        const r = king ? 34 : 24;
        items.push({ k: 'plat', x, y: bottom - r, r, king });
        return bottom - r * 2;
      },
      terrain(x, bottom, w, h) {
        items.push({ k: 'terrain', x, y: bottom - h / 2, w, h });
        return bottom - h;
      },
      // Two posts and a roof plank, optionally with a platypus inside.
      hut(m, x, bottom, w, h, inside) {
        w = w || 120; h = h || 100;
        b.block(m, x - w / 2 + 10, bottom, 20, h);
        b.block(m, x + w / 2 - 10, bottom, 20, h);
        if (inside !== false && h >= 60) b.plat(x, bottom, inside === 'king' ? { king: true } : null);
        return b.block(m, x, bottom - h, w + 30, 20);
      },
      // Floors of huts. mats can be a single material or one per floor.
      tower(mats, x, bottom, floors, w, h, platEvery) {
        let top = bottom;
        for (let i = 0; i < floors; i++) {
          const m = Array.isArray(mats) ? mats[i % mats.length] : mats;
          top = b.hut(m, x, top, w, h, platEvery === false ? false : (i % (platEvery || 1) === 0));
        }
        return top;
      },
      pyramid(m, x, bottom, rows, size) {
        let y = bottom;
        for (let r = 0; r < rows; r++) {
          const n = rows - r;
          for (let i = 0; i < n; i++) b.block(m, x + (i - (n - 1) / 2) * size, y, size, size);
          y -= size;
        }
        return y;
      },
    };
    return b;
  }

  const LEVELS = [];
  function level(name, sloths, build) {
    const b = builder();
    build(b);
    LEVELS.push({ name, sloths, items: b.items });
  }

  level('Opening Act', ['drums', 'drums', 'drums'], (b) => {
    b.hut('wood', 1350, GROUND, 130, 100);
  });

  level('Two-Step', ['drums', 'drums', 'trumpet'], (b) => {
    b.hut('wood', 1200, GROUND, 120, 100);
    b.hut('wood', 1520, GROUND, 120, 100);
  });

  level('Stack It Up', ['drums', 'trumpet', 'trumpet'], (b) => {
    const top = b.tower('wood', 1400, GROUND, 2, 140, 100);
    b.plat(1400, top);
  });

  level('Cold Open', ['guitar', 'guitar', 'drums'], (b) => {
    b.hut('ice', 1200, GROUND, 120, 90);
    b.hut('ice', 1420, GROUND, 120, 90);
    const t = b.hut('ice', 1640, GROUND, 120, 90);
    b.plat(1640, t);
  });

  level('High Note', ['trumpet', 'guitar', 'drums'], (b) => {
    b.block('ice', 1060, GROUND, 24, 140);
    b.plat(1110, GROUND);
    const hill = b.terrain(1450, GROUND, 420, 160);
    b.hut('wood', 1380, hill, 130, 100);
    const t = b.hut('wood', 1560, hill, 110, 90);
    b.plat(1560, t);
  });

  level('Rock Solid', ['tuba', 'drums', 'trumpet'], (b) => {
    b.hut('stone', 1250, GROUND, 140, 100);
    const t = b.tower('wood', 1560, GROUND, 3, 130, 90, 2);
    b.plat(1560, t);
  });

  level('Pyramid Scheme', ['guitar', 'tuba', 'drums'], (b) => {
    const top = b.pyramid('wood', 1420, GROUND, 5, 50);
    b.plat(1420, top);
    b.plat(1250, GROUND);
    b.plat(1590, GROUND);
    b.block('ice', 1660, GROUND, 24, 120);
  });

  level('Mixed Media', ['drums', 'guitar', 'trumpet', 'tuba'], (b) => {
    b.tower('ice', 1180, GROUND, 2, 120, 90);
    b.hut('stone', 1420, GROUND, 140, 100);
    const t = b.tower('wood', 1650, GROUND, 2, 120, 100);
    b.plat(1650, t);
  });

  level('The Fortress', ['tuba', 'tuba', 'trumpet', 'drums'], (b) => {
    b.block('stone', 1130, GROUND, 30, 220);
    b.block('stone', 1180, GROUND, 30, 160);
    const t = b.tower(['wood', 'wood', 'ice'], 1420, GROUND, 3, 140, 100);
    b.plat(1420, t);
    b.hut('wood', 1640, GROUND, 120, 100);
  });

  level('Floating Stage', ['trumpet', 'trumpet', 'guitar', 'drums'], (b) => {
    const p1 = b.terrain(1230, GROUND, 160, 220);
    const t1 = b.hut('wood', 1230, p1, 130, 90);
    b.plat(1230, t1);
    const p2 = b.terrain(1540, GROUND, 160, 320);
    b.hut('ice', 1540, p2, 130, 90);
    b.plat(1385, GROUND);
  });

  level('Glass House', ['drums', 'guitar', 'tuba', 'trumpet'], (b) => {
    b.block('stone', 1260, GROUND, 30, 200);
    b.block('stone', 1560, GROUND, 30, 200);
    b.block('stone', 1410, GROUND - 200, 340, 24);
    b.plat(1410, GROUND, { king: true });
    b.block('ice', 1330, GROUND, 20, 120);
    b.block('ice', 1490, GROUND, 20, 120);
    const t = b.hut('ice', 1410, GROUND - 224, 140, 90);
    b.plat(1410, t);
  });

  level('Headliner', ['tuba', 'drums', 'guitar', 'trumpet', 'drums'], (b) => {
    b.hut('wood', 1150, GROUND, 120, 90);
    const t = b.tower(['stone', 'wood', 'ice', 'wood'], 1420, GROUND, 4, 150, 95, 2);
    b.plat(1420, t, { king: true });
    const t2 = b.tower('ice', 1680, GROUND, 2, 110, 90, false);
    b.plat(1680, t2);
  });

  window.SB_LEVELS = LEVELS;
  window.SB_GROUND = GROUND;
})();
