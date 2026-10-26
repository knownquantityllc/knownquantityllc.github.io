/*
 * Wickwood content: weapons, skills, areas, Gloom creatures and bosses, plus
 * the per-device save of what the player has bought.
 * Coins themselves live in the shared KQProfile, not here.
 */
(function (root) {
  'use strict';

  var MAX_LEVEL = 5;

  // Stats at level 1, plus what each extra level adds.
  var WEAPONS = [
    {
      id: 'sling', name: 'Ember Sling', price: 0, color: '#ff8a3d',
      desc: 'Flings a hot ember at the closest Gloom.',
      base: { dmg: 10, rate: 2.4, speed: 450, range: 340, pierce: 0 },
      per: { dmg: 3, rate: 0.25 }
    },
    {
      id: 'bow', name: 'Thorn Bow', price: 150, color: '#7fc45a',
      desc: 'Seed arrows fly fast and go through 2 Gloom.',
      base: { dmg: 12, rate: 1.7, speed: 620, range: 400, pierce: 2 },
      per: { dmg: 4, rate: 0.15, pierce: 0.25 }
    },
    {
      id: 'ring', name: 'Bramble Ring', price: 320, color: '#d4a24a',
      desc: 'A spinning ring flies out and comes back, hitting on the way out and the way back.',
      base: { dmg: 14, rate: 1.1, speed: 380, range: 260, pierce: 99 },
      per: { dmg: 5, rate: 0.12 }
    },
    {
      id: 'staff', name: 'Spark Staff', price: 520, color: '#8fd6ff',
      desc: 'A spark jumps between up to 3 Gloom at once.',
      base: { dmg: 11, rate: 1.6, speed: 0, range: 300, chain: 3 },
      per: { dmg: 4, rate: 0.12, chain: 0.25 }
    }
  ];

  // price = cost to learn (level 1). Upgrade cost grows with level.
  var SKILLS = [
    { id: 'dash', name: 'Dash', price: 0, color: '#4aa8e8', active: true,
      desc: 'Zip forward. Nothing can hurt you mid-dash.',
      stat: function (lv) { return 'Cooldown ' + (3.2 - 0.35 * (lv - 1)).toFixed(1) + 's'; } },
    { id: 'burst', name: 'Glow Burst', price: 120, color: '#f39a2e', active: true,
      desc: 'Blast every Gloom around you and knock them back.',
      stat: function (lv) { return lv ? (30 + 15 * lv) + ' damage, ' + (8.5 - 0.6 * lv).toFixed(1) + 's cooldown' : 'Not learned'; } },
    { id: 'wax', name: 'Thick Wax', price: 60, color: '#f3e3c3',
      desc: 'More health.',
      stat: function (lv) { return 'Health ' + (100 + 25 * lv); } },
    { id: 'feet', name: 'Quick Feet', price: 60, color: '#9be08a',
      desc: 'Walk faster.',
      stat: function (lv) { return 'Speed +' + (8 * lv) + '%'; } },
    { id: 'lucky', name: 'Lucky Glint', price: 90, color: '#ffd84a',
      desc: 'Gloom drop more coins.',
      stat: function (lv) { return '+' + (20 * lv) + '% coins'; } }
  ];

  function upgradeCost(price, level) {
    // Cost to go from `level` to `level + 1`.
    var base = Math.max(price, 50);
    return Math.round(base * (0.5 + 0.45 * level) / 10) * 10;
  }

  var AREAS = [
    {
      id: 'mossdeep', name: 'Mossdeep Hollow', short: 'Mossdeep',
      blurb: 'Soft moss, sleepy mushrooms, and the first Gloom.',
      floor: ['#2f5a3a', '#35663f', '#2a5034'], wall: '#1b3324', deco: 'mushroom', tint: '#3f8a5c',
      foes: ['mite', 'puff'], rooms: 4, boss: 'rootmaw', hp: 1, dmg: 1
    },
    {
      id: 'fogfen', name: 'Fogfen Marsh', short: 'Fogfen',
      blurb: 'Misty pools where moths and beetles hide.',
      floor: ['#2e4a5a', '#345566', '#294352'], wall: '#172a35', deco: 'reed', tint: '#3d7fa0',
      foes: ['mite', 'moth', 'beetle', 'puff'], rooms: 4, boss: 'duskwing', hp: 1.7, dmg: 1.3
    },
    {
      id: 'heart', name: 'The Gloomheart', short: 'Gloomheart',
      blurb: 'The dark root where the Gloom began.',
      floor: ['#3e2c4a', '#463354', '#352640'], wall: '#1e1426', deco: 'crystal', tint: '#7a4fa8',
      foes: ['mite', 'moth', 'beetle', 'puff', 'shade'], rooms: 5, boss: 'gloomheart', hp: 2.6, dmg: 1.6
    }
  ];

  // r: radius, hp, spd: px/s, dmg: touch damage, coins: average drop
  var FOES = {
    mite:   { name: 'Mistmite',  r: 13, hp: 22, spd: 62,  dmg: 10, coins: 1.2, body: '#5b5e86', eye: '#ffe36b' },
    puff:   { name: 'Spore Puff', r: 17, hp: 34, spd: 0,  dmg: 10, coins: 1.6, body: '#8a5b8f', eye: '#ffb3f0', shoot: 2.6 },
    moth:   { name: 'Dusk Moth', r: 12, hp: 18, spd: 115, dmg: 8,  coins: 1.2, body: '#6b6f9e', eye: '#b8f2ff' },
    beetle: { name: 'Thornback', r: 16, hp: 50, spd: 45,  dmg: 15, coins: 2,   body: '#4b3b2c', eye: '#ff6a4a' },
    shade:  { name: 'Shade',     r: 15, hp: 40, spd: 70,  dmg: 12, coins: 2,   body: '#2b2238', eye: '#c08bff', shoot: 3.2 }
  };

  // Bosses cycle through their attack patterns.
  var BOSSES = {
    rootmaw:    { name: 'Old Rootmaw', r: 42, hp: 520, spd: 35, dmg: 18, body: '#5a4330', eye: '#ffd06b',
                  moves: ['ring', 'summon', 'ring', 'stomp'], summon: 'mite', coins: 40 },
    duskwing:   { name: 'Queen Duskwing', r: 38, hp: 760, spd: 70, dmg: 18, body: '#56588f', eye: '#b8f2ff',
                  moves: ['spiral', 'charge', 'summon', 'charge'], summon: 'moth', coins: 60 },
    gloomheart: { name: 'The Gloomheart', r: 48, hp: 1150, spd: 30, dmg: 22, body: '#2b1d3a', eye: '#ff5d8f',
                  moves: ['ring', 'spiral', 'summon', 'charge', 'ring'], summon: 'shade', coins: 100 }
  };

  // ---- save ------------------------------------------------------------------

  var KEY = 'kq.wickwood.v1';
  var save = { weapons: { sling: 1 }, equipped: 'sling', skills: { dash: 1 }, cleared: 0 };
  try {
    var raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      save.weapons = Object.assign(save.weapons, raw.weapons || {});
      save.skills = Object.assign(save.skills, raw.skills || {});
      if (raw.equipped && save.weapons[raw.equipped]) save.equipped = raw.equipped;
      save.cleared = Math.max(0, Math.min(AREAS.length, raw.cleared | 0));
    }
  } catch (e) { /* ignore, start fresh */ }

  function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

  function weaponStats(id, level) {
    var w = WEAPONS.filter(function (x) { return x.id === id; })[0] || WEAPONS[0];
    var lv = level || save.weapons[w.id] || 1, s = {};
    Object.keys(w.base).forEach(function (k) {
      s[k] = w.base[k] + (w.per[k] || 0) * (lv - 1);
    });
    s.pierce = Math.floor(s.pierce || 0);
    s.chain = Math.floor(s.chain || 0);
    s.id = w.id; s.lv = lv; s.color = w.color;
    return s;
  }

  root.WWData = {
    MAX_LEVEL: MAX_LEVEL, WEAPONS: WEAPONS, SKILLS: SKILLS, AREAS: AREAS, FOES: FOES, BOSSES: BOSSES,
    save: save, persist: persist, upgradeCost: upgradeCost, weaponStats: weaponStats,
    skill: function (id) { return save.skills[id] || 0; }
  };
})(typeof self !== 'undefined' ? self : this);
