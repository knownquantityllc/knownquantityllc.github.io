// The real profile is shared/kq-profile/kq-profile.js (loaded first by
// index.html). If it is missing, e.g. the folder was copied on its own, keep
// coins and scores in memory only so nothing writes a different shape into
// the shared "kq.profile.v1" storage key.
(function () {
  'use strict';
  if (window.KQProfile) return;
  console.warn('KQProfile not found; coins and scores will not be saved.');

  const p = { coins: 0, scores: {} };
  window.KQProfile = {
    get: function () { return { coins: p.coins, scores: Object.assign({}, p.scores) }; },
    getCoins: function () { return p.coins; },
    getBest: function (id) { return p.scores[id] || 0; },
    addCoins: function (n) { p.coins = Math.max(0, p.coins + Math.round(n)); return p.coins; },
    spendCoins: function (n) { if (p.coins < n) return false; p.coins -= n; return true; },
    submitScore: function (id, score) {
      const prev = p.scores[id] || 0;
      if (score > prev) p.scores[id] = score;
      return { best: Math.max(prev, score), isNew: score > prev };
    },
    onChange: function () { return function () {}; }
  };
})();
