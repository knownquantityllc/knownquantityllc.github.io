// Screens, progress saving, and the shared Known Quantity profile hookup.
(function () {
  'use strict';

  const GAME_ID = 'sloth-band';
  const PROGRESS_KEY = 'sb.progress.v1';
  const game = window.SBGame;
  const SFX = window.SBAudio;
  const Profile = window.KQProfile;
  const LEVELS = window.SB_LEVELS;
  const $ = (id) => document.getElementById(id);

  function loadProgress() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null'); } catch (e) { p = null; }
    if (!p || !Array.isArray(p.stars)) p = { stars: [], best: [] };
    return p;
  }
  function saveProgress(p) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
  }
  let progress = loadProgress();

  function isUnlocked(i) { return i === 0 || (progress.stars[i - 1] || 0) > 0; }
  function totalBest() { return progress.best.reduce((s, n) => s + (n || 0), 0); }

  function show(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
    $('hud').classList.toggle('hidden', id !== null);
  }

  function refreshCoins() {
    const c = Profile.getCoins();
    $('hud-coins').textContent = c;
    $('title-coins').textContent = c;
  }

  function refreshMute() {
    const label = SFX.isMuted() ? 'Sound: off' : 'Sound: on';
    $('btn-mute').textContent = label;
    $('btn-pause-mute').textContent = label;
  }

  function buildBandRow() {
    const row = $('band-row');
    row.innerHTML = '';
    for (const key of ['drums', 'trumpet', 'guitar', 'tuba']) {
      const def = window.SBArt.SLOTHS[key];
      const wrap = document.createElement('div');
      wrap.className = 'member';
      const c = document.createElement('canvas');
      c.width = 152; c.height = 152;
      const cx = c.getContext('2d');
      cx.scale(2, 2);
      window.SBArt.drawSloth(cx, 38, 42, 24, 0, key, {});
      wrap.appendChild(c);
      const label = document.createElement('div');
      label.textContent = def.name;
      label.style.color = def.color;
      wrap.appendChild(label);
      row.appendChild(wrap);
    }
  }

  function buildLevelGrid() {
    const grid = $('level-grid');
    grid.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const b = document.createElement('button');
      b.className = 'lvl' + (isUnlocked(i) ? '' : ' locked');
      b.disabled = !isUnlocked(i);
      b.setAttribute('aria-label', 'Level ' + (i + 1) + ': ' + lv.name);
      const n = document.createElement('div');
      if (isUnlocked(i)) n.textContent = String(i + 1);
      else { const lk = document.createElement('span'); lk.className = 'lock'; n.appendChild(lk); }
      const s = document.createElement('div');
      s.className = 's';
      const st = progress.stars[i] || 0;
      s.textContent = '★'.repeat(st) + '☆'.repeat(3 - st);
      b.appendChild(n); b.appendChild(s);
      b.addEventListener('click', () => { SFX.click(); play(i); });
      grid.appendChild(b);
    });
  }

  let tipTimer = null;
  // A small card at the bottom with the sloth's face; hides by itself.
  function showTip(inst, title, text) {
    const def = window.SBArt.SLOTHS[inst] || window.SBArt.SLOTHS.drums;
    const tip = $('hud-tip');
    const c = $('tip-face'), cx = c.getContext('2d');
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, c.width, c.height);
    cx.scale(2, 2); window.SBArt.drawSloth(cx, 22, 24, 15, 0, inst, {});
    tip.style.setProperty('--tip-color', def.color);
    const t = $('tip-text'); t.textContent = '';
    const b = document.createElement('b'); b.textContent = title + ' ';
    t.appendChild(b); t.appendChild(document.createTextNode(text));
    tip.classList.remove('hidden');
    tip.style.animation = 'none'; void tip.offsetWidth; tip.style.animation = '';
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => tip.classList.add('hidden'), 5500);
  }
  function play(i) {
    $('hud-tip').classList.add('hidden');
    show(null);
    game.startLevel(i);
    refreshCoins();
  }

  game.on('aimStart', () => { clearTimeout(tipTimer); $('hud-tip').classList.add('hidden'); });

  game.on('hud', (h) => {
    $('hud-score').textContent = h.score.toLocaleString();
    $('hud-level').textContent = h.level >= 0 ? (h.level + 1) + '. ' + (h.name || '') : '';
  });

  // Show a short tip the first time each band member is loaded.
  const seenTips = new Set();
  try { JSON.parse(localStorage.getItem('sb.tips') || '[]').forEach((t) => seenTips.add(t)); } catch (e) { /* ignore */ }
  game.on('hud', (h) => {
    if (h.state !== 'aim' || !h.loaded || seenTips.has(h.loaded)) return;
    seenTips.add(h.loaded);
    try { localStorage.setItem('sb.tips', JSON.stringify([...seenTips])); } catch (e) { /* ignore */ }
    const def = window.SBArt.SLOTHS[h.loaded];
    showTip(h.loaded, def.name + ' on ' + def.role.toLowerCase(), def.tip);
  });
  game.on('levelStart', (e) => {
    if (e.index === 0 && !seenTips.has('_aim')) {
      seenTips.add('_aim');
      showTip(e.level.sloths[0], 'Pull back and let go.', 'Drag the sloth away from the slingshot, aim with the dotted arc, and pop every platypus.');
    }
  });

  game.on('levelEnd', (r) => {
    const i = r.index;
    const prevStars = progress.stars[i] || 0;
    const prevBest = progress.best[i] || 0;
    let coins = 0;
    if (r.won) {
      progress.stars[i] = Math.max(prevStars, r.stars);
      progress.best[i] = Math.max(prevBest, r.score);
      coins = Math.floor(r.score / 5000) + 5 * Math.max(0, r.stars - prevStars);
    } else {
      coins = Math.floor(r.score / 10000);
    }
    saveProgress(progress);
    if (coins > 0) Profile.addCoins(coins, GAME_ID);
    Profile.submitScore(GAME_ID, totalBest());
    refreshCoins();

    setTimeout(() => {
      $('result-title').textContent = r.won ? 'Encore!' : 'The platypuses heckled you';
      $('result-score').textContent = r.score.toLocaleString();
      const parts = [];
      if (r.won && r.spare) parts.push(r.spare + ' sloth' + (r.spare > 1 ? 's' : '') + ' left: +' + r.bonus.toLocaleString());
      if (r.won && r.score > prevBest && prevBest > 0) parts.push('New best!');
      if (!r.won) parts.push('Try a different angle, or save the special move for the right moment.');
      $('result-detail').textContent = parts.join('  •  ');
      $('result-coins').textContent = coins > 0 ? '+' + coins + ' coins' : '';
      const stars = $('result-stars').children;
      for (let k = 0; k < 3; k++) {
        stars[k].classList.remove('on');
        if (k < r.stars) setTimeout(() => { stars[k].classList.add('on'); SFX.star(k); }, 350 + k * 300);
      }
      $('btn-result-next').disabled = !(r.won && i + 1 < LEVELS.length);
      $('btn-result-next').classList.toggle('hidden', i + 1 >= LEVELS.length);
      show('screen-result');
    }, r.won ? 700 : 400);
  });

  // ---- buttons ----
  const on = (id, fn) => $(id).addEventListener('click', () => { SFX.unlock(); SFX.click(); fn(); });
  on('btn-play', () => {
    const next = LEVELS.findIndex((_, i) => !(progress.stars[i] > 0));
    if (next === 0 && !progress.stars.length) play(0);
    else { buildLevelGrid(); show('screen-levels'); }
  });
  on('btn-levels-back', () => show('screen-title'));
  on('btn-pause', () => { game.setPaused(true); show('screen-pause'); });
  on('btn-resume', () => { game.setPaused(false); show(null); });
  on('btn-restart', () => game.restart());
  on('btn-pause-restart', () => { show(null); game.restart(); });
  on('btn-pause-levels', () => { game.stop(); buildLevelGrid(); show('screen-levels'); });
  on('btn-result-levels', () => { game.stop(); buildLevelGrid(); show('screen-levels'); });
  on('btn-result-retry', () => { show(null); game.restart(); });
  on('btn-result-next', () => play(game.levelIndex + 1));
  const toggleMute = () => { SFX.setMuted(!SFX.isMuted()); refreshMute(); };
  on('btn-mute', toggleMute);
  on('btn-pause-mute', toggleMute);
  on('btn-rotate-dismiss', () => { rotateDismissed = true; checkOrientation(); });

  let rotateDismissed = false;
  function checkOrientation() {
    const portrait = window.innerHeight > window.innerWidth * 1.1;
    $('rotate-hint').classList.toggle('hidden', !portrait || rotateDismissed);
  }
  window.addEventListener('resize', checkOrientation);

  // Pause automatically when the app goes to the background.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (game.state === 'aim' || game.state === 'flying' || game.state === 'settling')) {
      game.setPaused(true);
      show('screen-pause');
    }
  });

  Profile.load();
  if (Profile.onChange) Profile.onChange(refreshCoins);
  game.init($('game'));
  buildBandRow();
  refreshCoins();
  refreshMute();
  checkOrientation();
  show('screen-title');

  window.SB = { game, progress: () => progress, play };
})();
