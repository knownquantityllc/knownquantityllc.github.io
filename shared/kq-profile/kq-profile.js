/*
 * KQProfile: one player profile shared by every Known Quantity game.
 *
 * Holds coins, best scores, play counts, a nickname and a creature roster.
 * Plain script, no dependencies. In a browser it sets window.KQProfile;
 * under Node/CommonJS it is module.exports.
 *
 * Merge-safe by design: coins are stored as grow-only counters keyed by
 * "deviceId|gameId" (earned and spent kept separately), best scores keep the
 * max, creatures keep the newest copy by id. Two profiles from two different
 * apps can therefore be merged in any order without losing or duplicating
 * coins. That is what lets separately installed apps (Tap Arcade, Note Rush,
 * Pocket Sloth, ...) share one profile through exportCode/importCode today,
 * and through a sync adapter later.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KQProfile = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 1;
  var STORAGE_KEY = 'kq.profile.v1';
  var CODE_PREFIX = 'KQ1:';

  // ---- storage adapters --------------------------------------------------

  function memoryStorage() {
    var data = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); }
    };
  }

  function defaultStorage() {
    try {
      var ls = typeof localStorage !== 'undefined' ? localStorage : null;
      if (ls) {
        ls.setItem('kq.probe', '1');
        ls.removeItem('kq.probe');
        return ls;
      }
    } catch (e) { /* private mode or blocked storage */ }
    return memoryStorage();
  }

  var storage = defaultStorage();
  var profile = null;
  var listeners = [];

  // ---- helpers -----------------------------------------------------------

  function now() { return Date.now(); }

  function randomId() {
    var s = '';
    for (var i = 0; i < 12; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 36));
    return s;
  }

  function cleanGameId(gameId) {
    var g = String(gameId || 'unknown').toLowerCase().replace(/[^a-z0-9._-]/g, '-');
    return g.slice(0, 40) || 'unknown';
  }

  function wholeNumber(n) {
    n = Math.floor(Number(n));
    return isFinite(n) && n > 0 ? n : 0;
  }

  function sumCounter(counter) {
    var t = 0;
    for (var k in counter) if (Object.prototype.hasOwnProperty.call(counter, k)) t += counter[k];
    return t;
  }

  function sumForGame(counter, gameId) {
    var t = 0, suffix = '|' + gameId;
    for (var k in counter) {
      if (Object.prototype.hasOwnProperty.call(counter, k) && k.slice(-suffix.length) === suffix) t += counter[k];
    }
    return t;
  }

  function blank() {
    return {
      v: VERSION,
      deviceId: randomId(),
      name: '',
      createdAt: now(),
      updatedAt: now(),
      earned: {},   // "deviceId|gameId" -> coins earned (grow-only)
      spent: {},    // "deviceId|gameId" -> coins spent (grow-only)
      plays: {},    // "deviceId|gameId" -> runs finished (grow-only)
      best: {},     // gameId -> best score
      creatures: {} // creature id -> creature object (newest updatedAt wins)
    };
  }

  // Bring stored or imported data into the current shape, dropping junk.
  function normalize(raw) {
    var p = blank();
    if (!raw || typeof raw !== 'object') return p;
    if (typeof raw.deviceId === 'string' && raw.deviceId) p.deviceId = raw.deviceId;
    if (typeof raw.name === 'string') p.name = raw.name.slice(0, 20);
    if (raw.createdAt) p.createdAt = Number(raw.createdAt) || p.createdAt;
    if (raw.updatedAt) p.updatedAt = Number(raw.updatedAt) || p.updatedAt;
    ['earned', 'spent', 'plays'].forEach(function (field) {
      var src = raw[field] || {};
      for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) p[field][k] = wholeNumber(src[k]);
    });
    var best = raw.best || {};
    for (var g in best) if (Object.prototype.hasOwnProperty.call(best, g)) p.best[g] = Math.max(0, Number(best[g]) || 0);
    var cr = raw.creatures || {};
    for (var id in cr) {
      if (Object.prototype.hasOwnProperty.call(cr, id) && cr[id] && typeof cr[id] === 'object') p.creatures[id] = cr[id];
    }
    return p;
  }

  function read() {
    try {
      var s = storage.getItem(STORAGE_KEY);
      return s ? normalize(JSON.parse(s)) : null;
    } catch (e) { return null; }
  }

  function ensure() {
    if (!profile) {
      profile = read();
      if (!profile) { profile = blank(); write(); }
    }
    return profile;
  }

  function write() {
    profile.updatedAt = now();
    try { storage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch (e) { /* quota or blocked */ }
    var snap = snapshot();
    listeners.slice().forEach(function (fn) { try { fn(snap); } catch (e) { /* listener error */ } });
  }

  function coinsOf(p) { return Math.max(0, sumCounter(p.earned) - sumCounter(p.spent)); }

  function snapshot() {
    var p = ensure();
    var creatures = [];
    for (var id in p.creatures) if (Object.prototype.hasOwnProperty.call(p.creatures, id)) creatures.push(p.creatures[id]);
    var plays = {};
    for (var k in p.plays) {
      if (!Object.prototype.hasOwnProperty.call(p.plays, k)) continue;
      var g = k.split('|')[1];
      plays[g] = (plays[g] || 0) + p.plays[k];
    }
    return {
      deviceId: p.deviceId,
      name: p.name,
      coins: coinsOf(p),
      scores: JSON.parse(JSON.stringify(p.best)),
      plays: plays,
      creatures: JSON.parse(JSON.stringify(creatures)),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    };
  }

  function mergeInto(a, b) {
    ['earned', 'spent', 'plays'].forEach(function (field) {
      for (var k in b[field]) {
        if (Object.prototype.hasOwnProperty.call(b[field], k)) a[field][k] = Math.max(a[field][k] || 0, b[field][k]);
      }
    });
    for (var g in b.best) if (Object.prototype.hasOwnProperty.call(b.best, g)) a.best[g] = Math.max(a.best[g] || 0, b.best[g]);
    for (var id in b.creatures) {
      if (!Object.prototype.hasOwnProperty.call(b.creatures, id)) continue;
      var mine = a.creatures[id], theirs = b.creatures[id];
      if (!mine || (theirs.updatedAt || 0) > (mine.updatedAt || 0)) a.creatures[id] = theirs;
    }
    if (!a.name && b.name) a.name = b.name;
    a.createdAt = Math.min(a.createdAt, b.createdAt);
    return a;
  }

  // Base64 that survives non-ASCII names in both browsers and Node.
  function toB64(str) {
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
    return Buffer.from(str, 'utf8').toString('base64');
  }
  function fromB64(b64) {
    if (typeof atob === 'function') return decodeURIComponent(escape(atob(b64)));
    return Buffer.from(b64, 'base64').toString('utf8');
  }

  // ---- public API --------------------------------------------------------

  var api = {
    VERSION: VERSION,
    STORAGE_KEY: STORAGE_KEY,

    /** Load (or create) the profile and return a read-only snapshot. */
    load: function () { profile = null; return snapshot(); },

    /** Read-only snapshot: {deviceId, name, coins, scores, plays, creatures, ...}. */
    get: function () { return snapshot(); },

    getCoins: function () { return coinsOf(ensure()); },

    /** Award coins earned in a game. Returns the new total. */
    addCoins: function (n, gameId) {
      var p = ensure(), amount = wholeNumber(n);
      if (amount) {
        var key = p.deviceId + '|' + cleanGameId(gameId);
        p.earned[key] = (p.earned[key] || 0) + amount;
        write();
      }
      return coinsOf(p);
    },

    /** Spend coins. Returns false (and spends nothing) if the player can't afford it. */
    spendCoins: function (n, gameId) {
      var p = ensure(), amount = wholeNumber(n);
      if (!amount) return true;
      if (coinsOf(p) < amount) return false;
      var key = p.deviceId + '|' + cleanGameId(gameId);
      p.spent[key] = (p.spent[key] || 0) + amount;
      write();
      return true;
    },

    /** Coins earned in one game, across every device merged into this profile. */
    getCoinsEarnedIn: function (gameId) { return sumForGame(ensure().earned, cleanGameId(gameId)); },

    /** Record a finished run. Returns {best, isNew}. */
    submitScore: function (gameId, score) {
      var p = ensure(), g = cleanGameId(gameId), s = Math.max(0, Number(score) || 0);
      var prev = p.best[g] || 0, isNew = s > prev;
      if (isNew) p.best[g] = s;
      var key = p.deviceId + '|' + g;
      p.plays[key] = (p.plays[key] || 0) + 1;
      write();
      return { best: Math.max(prev, s), isNew: isNew };
    },

    getBest: function (gameId) { return ensure().best[cleanGameId(gameId)] || 0; },

    /** Player-chosen nickname (never a real name requirement). Max 20 chars. */
    getName: function () { return ensure().name; },
    setName: function (name) { ensure().name = String(name || '').slice(0, 20); write(); },

    /**
     * Creature roster shared between games. The breeding game adds creatures,
     * runners and other games can read them. A creature is any object with a
     * string id; KQProfile stamps updatedAt and keeps the newest copy on merge.
     */
    getCreatures: function () { return snapshot().creatures; },
    addCreature: function (creature) {
      if (!creature || typeof creature.id !== 'string' || !creature.id) throw new Error('creature needs a string id');
      var c = JSON.parse(JSON.stringify(creature));
      c.updatedAt = now();
      ensure().creatures[c.id] = c;
      write();
      return c;
    },
    removeCreature: function (id) {
      var p = ensure();
      if (p.creatures[id]) { delete p.creatures[id]; write(); }
    },

    /** Subscribe to changes. Returns an unsubscribe function. */
    onChange: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
    },

    /** Merge another profile (raw object or snapshot of the stored shape) into this one. */
    merge: function (other) {
      var p = ensure();
      mergeInto(p, normalize(other));
      write();
      return snapshot();
    },

    /** The raw stored profile, for sync adapters. */
    exportRaw: function () { return JSON.parse(JSON.stringify(ensure())); },

    /**
     * A text code the player can copy from one app and paste into another
     * to carry coins and scores over. Importing merges; it never overwrites.
     */
    exportCode: function () { return CODE_PREFIX + toB64(JSON.stringify(ensure())); },
    importCode: function (code) {
      code = String(code || '').trim();
      if (code.indexOf(CODE_PREFIX) !== 0) throw new Error('not a Known Quantity profile code');
      var raw = JSON.parse(fromB64(code.slice(CODE_PREFIX.length)));
      return api.merge(raw);
    },

    /**
     * Swap the storage backend (anything with getItem/setItem), e.g. a
     * Capacitor Preferences wrapper backed by an iOS App Group. Existing
     * data in the new backend is merged with what is already loaded.
     */
    setStorage: function (adapter) {
      var current = profile;
      storage = adapter || defaultStorage();
      profile = null;
      ensure();
      if (current) { mergeInto(profile, current); write(); }
      return snapshot();
    },

    /** Wipe the profile on this device (used by tests and a settings "reset"). */
    reset: function () { profile = blank(); write(); return snapshot(); },

    _memoryStorage: memoryStorage
  };

  return api;
});
