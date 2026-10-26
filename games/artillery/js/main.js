// Screens, controls, profile rewards and the online glue.
(function () {
  'use strict';

  const Game = window.ArtilleryGame;
  const SKINS = window.ArtillerySkins.SKINS;
  const Sfx = window.ArtillerySfx;
  const Art = window.ArtilleryArt;
  const Link = window.ArtilleryNet.Link;
  const Profile = window.KQProfile;
  const GAME_ID = 'artillery';

  const $ = function (id) { return document.getElementById(id); };
  const prefs = loadPrefs();
  let game = null;
  let link = null;
  let lastSetup = null;
  let remoteQueue = [];
  let raf = 0;

  function loadPrefs() {
    let p = {};
    try { p = JSON.parse(localStorage.getItem('kq.artillery.prefs') || '{}') || {}; } catch (e) { /* ignore */ }
    return { skin: SKINS[p.skin] ? p.skin : 'concert', difficulty: p.difficulty || 'medium', rounds: p.rounds || 10 };
  }
  function savePrefs() {
    try { localStorage.setItem('kq.artillery.prefs', JSON.stringify(prefs)); } catch (e) { /* ignore */ }
  }

  function show(id) {
    ['menu', 'online', 'play'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
    if (id !== 'play') { cancelAnimationFrame(raf); raf = 0; }
    if (id === 'menu') refreshProfile();
  }

  // ---------- menu ----------
  function refreshProfile() {
    try {
      $('coinCount').textContent = Profile.getCoins ? Profile.getCoins() : (Profile.get().coins || 0);
      $('bestScore').textContent = Profile.getBest ? Profile.getBest(GAME_ID) : ((Profile.get().scores || {})[GAME_ID] || 0);
    } catch (e) { /* profile unavailable */ }
  }

  function buildSkinCards() {
    const list = $('skinList');
    list.innerHTML = '';
    Object.keys(SKINS).forEach(function (id) {
      const s = SKINS[id];
      const b = document.createElement('button');
      b.className = 'skin' + (prefs.skin === id ? ' on' : '');
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', prefs.skin === id);
      const cv = document.createElement('canvas');
      cv.width = 300; cv.height = 150;
      drawPreview(cv, s);
      b.appendChild(cv);
      const m = document.createElement('div');
      m.className = 'meta';
      m.innerHTML = '<b></b><small></small>';
      m.querySelector('b').textContent = s.name;
      m.querySelector('small').textContent = s.tagline;
      b.appendChild(m);
      b.addEventListener('click', function () {
        prefs.skin = id; savePrefs(); Sfx.click(); buildSkinCards();
      });
      list.appendChild(b);
    });
  }

  function drawPreview(cv, s) {
    const ctx = cv.getContext('2d');
    const k = cv.width / Game.W;
    ctx.save();
    ctx.scale(k, cv.height / Game.H);
    s.drawSky(ctx, Game.W, Game.H);
    const h = new Float32Array(Game.W);
    for (let x = 0; x < Game.W; x++) h[x] = Game.H * 0.66 + Math.sin(x / 160) * 50 + Math.sin(x / 61) * 18;
    ctx.fillStyle = s.ground[0];
    ctx.beginPath(); ctx.moveTo(0, Game.H);
    for (let x = 0; x < Game.W; x++) ctx.lineTo(x, h[x]);
    ctx.lineTo(Game.W, Game.H); ctx.fill();
    ctx.strokeStyle = s.edge; ctx.lineWidth = s.edgeWidth * 2;
    ctx.beginPath(); for (let x = 0; x < Game.W; x++) ctx.lineTo(x, h[x]); ctx.stroke();
    ctx.save(); ctx.translate(200, h[200]); ctx.scale(2.6, 2.6);
    Art.drawCharacter(ctx, s.players[0].kind, 0, 0, 0.7, 0.5, true, s.players[0].color);
    ctx.restore();
    ctx.save(); ctx.translate(1000, h[1000]); ctx.scale(2.6, 2.6);
    Art.drawCharacter(ctx, s.players[1].kind, 0, 0, Math.PI - 0.7, 2, true, s.players[1].color);
    ctx.restore();
    s.drawProjectile(ctx, 'heavy', 600, 200, 0.3, s.players[0].color);
    ctx.restore();
  }

  function segs(id, key, cast) {
    const el = $(id);
    el.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', String(prefs[key]) === b.dataset.v);
      b.addEventListener('click', function () {
        prefs[key] = cast ? cast(b.dataset.v) : b.dataset.v;
        savePrefs(); Sfx.click();
        el.querySelectorAll('button').forEach(function (o) { o.classList.toggle('on', o === b); });
      });
    });
  }

  function updateMute() { $('muteBtn').innerHTML = Art.speakerSvg(Sfx.isMuted()); }

  function setWinnerPics(tanks) {
    const box = $('ovEmoji');
    box.innerHTML = '';
    tanks.forEach(function (t) {
      const img = document.createElement('img');
      img.alt = t.name;
      img.src = Art.portrait(t.kind, t.color, 72, t.i === 0);
      box.appendChild(img);
    });
  }

  // ---------- starting games ----------
  function newSeed() { return (Math.random() * 0xffffffff) >>> 0; }

  function start(setup) {
    lastSetup = setup;
    remoteQueue = [];
    game = new Game(setup);
    game.onChange = updateHud;
    game.onTurn = announceTurn;
    game.onGameOver = gameOver;
    if (setup.mode === 'online') {
      let lastAim = 0, aimTimer = 0;
      game.onAction = function (a) {
        if (a.k === 'aim') {
          // throttle aim updates; always deliver the final position
          const now = performance.now();
          clearTimeout(aimTimer);
          if (now - lastAim > 90) { lastAim = now; link.send(a); } else aimTimer = setTimeout(function () { link.send(a); }, 100);
        } else link.send(a);
      };
      game.onShotDone = function (snap) { link.send(snap); };
    }
    $('overlay').classList.add('hidden');
    $('weaponSheet').classList.add('hidden');
    show('play');
    buildWeaponGrid();
    resize();
    updateHud();
    announceTurn();
    let last = performance.now();
    const frame = function (now) {
      raf = requestAnimationFrame(frame);
      const dt = (now - last) / 1000;
      last = now;
      if (remoteQueue.length && game.phase === 'aim') {
        const q = remoteQueue; remoteQueue = [];
        q.forEach(handleRemoteAction);
      }
      game.update(dt);
      draw();
      updateDials();
    };
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function localSetup(mode) {
    return {
      seed: newSeed(), skin: prefs.skin, mode: mode, difficulty: prefs.difficulty,
      rounds: prefs.rounds, starter: 0,
      names: mode === 'cpu' ? ['You', 'Computer'] : null
    };
  }

  // ---------- canvas ----------
  const cv = $('cv');
  const ctx = cv.getContext('2d');
  // The canvas fills the whole stage. The field is fitted inside it, sitting
  // on the controls, and the scenery is stretched out to the edges.
  let scale = 1, ox = 0, oy = 0, dpr = 1, view = null;
  function resize() {
    const st = $('stage');
    const sw = st.clientWidth, sh = st.clientHeight;
    scale = Math.min(sw / Game.W, sh / Game.H);
    ox = (sw - Game.W * scale) / 2;
    oy = sh - Game.H * scale;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = sw + 'px';
    cv.style.height = sh + 'px';
    cv.width = Math.floor(sw * dpr);
    cv.height = Math.floor(sh * dpr);
    view = { x0: -ox / scale, x1: Game.W + ox / scale, y0: -oy / scale };
    checkRotate();
  }
  window.addEventListener('resize', function () { if (game) resize(); });

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = game.skin.ground[1];
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr);
    game.render(ctx, view);
  }

  function toWorld(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left - ox) / scale, y: (e.clientY - r.top - oy) / scale };
  }

  // A side-on artillery field is too small to read on a phone held upright.
  let rotateDismissed = false;
  function checkRotate() {
    const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 700;
    $('rotateHint').classList.toggle('hidden', !portrait || rotateDismissed);
  }
  $('rotateGo').addEventListener('click', function () { rotateDismissed = true; checkRotate(); });

  let aiming = false;
  function aimAt(e) {
    const t = game.cur();
    const c = game.center(t);
    const p = toWorld(e);
    const dx = p.x - c.x, dy = c.y - p.y;
    let a = Math.atan2(dy, dx) * 180 / Math.PI;
    if (a < 0) a = dx >= 0 ? 0 : 180;
    const pw = Math.max(5, Math.min(100, Math.hypot(dx, dy) / 3.2));
    game.act({ k: 'aim', a: Math.round(a), p: Math.round(pw) });
  }
  cv.addEventListener('pointerdown', function (e) {
    Sfx.unlock();
    if (!game || game.phase !== 'aim' || !game.isHumanTurn()) return;
    aiming = true;
    cv.setPointerCapture(e.pointerId);
    aimAt(e);
  });
  cv.addEventListener('pointermove', function (e) { if (aiming && game.phase === 'aim') aimAt(e); });
  cv.addEventListener('pointerup', function () { aiming = false; });
  cv.addEventListener('pointercancel', function () { aiming = false; });

  // ---------- HUD + controls ----------
  function updateHud() {
    if (!game) return;
    game.tanks.forEach(function (t) {
      const el = $('hud' + t.i);
      const em = el.querySelector('.em');
      const src = Art.portrait(t.kind, t.color, 32, t.i === 0);
      if (em.getAttribute('src') !== src) em.setAttribute('src', src);
      el.querySelector('.nm').textContent = t.name;
      el.querySelector('.sc').textContent = t.score;
      const bar = el.querySelector('.bar i');
      bar.style.width = t.hp + '%';
      bar.style.background = t.hp > 50 ? 'var(--ok)' : t.hp > 25 ? 'var(--accent)' : 'var(--danger)';
      el.classList.toggle('turn', t.i === game.current && game.phase !== 'over');
    });
    const shot = Math.min(game.rounds, Math.floor(game.turn / 2) + 1);
    $('roundTxt').textContent = 'Shot ' + shot + ' of ' + game.rounds;
    const w = game.wind;
    $('windTxt').textContent = w === 0 ? 'Wind calm' : (w < 0 ? 'Wind ◀ ' + Math.abs(w) : 'Wind ' + w + ' ▶');
    const t = game.cur();
    const mine = game.phase === 'aim' && game.isHumanTurn();
    $('controls').classList.toggle('locked', !mine);
    const wname = game.skin.weapons[t.weapon][0];
    const wb = $('weaponBtn');
    wb.querySelector('img').src = weaponIcon(t.weapon, t.color);
    wb.querySelector('.wn').textContent = wname;
    wb.querySelector('.wa').textContent = t.ammo[t.weapon] === Infinity ? '∞' : '×' + t.ammo[t.weapon];
    $('movesVal').textContent = t.moves;
    $('moveL').disabled = $('moveR').disabled = t.moves <= 0;
  }

  let shownA = null, shownP = null;
  function updateDials() {
    const t = game.cur();
    const a = Math.round(t.angle), p = Math.round(t.power);
    if (a !== shownA) { $('angleVal').textContent = a + '°'; shownA = a; }
    if (p !== shownP) { $('powerVal').textContent = p; shownP = p; }
  }

  const iconCache = {};
  function weaponIcon(id, color) {
    const key = game.skin.id + id + color;
    if (iconCache[key]) return iconCache[key];
    const c = document.createElement('canvas');
    c.width = c.height = 76;
    const x = c.getContext('2d');
    x.scale(2, 2);
    game.skin.drawProjectile(x, id, 19, 21, 0, color);
    iconCache[key] = c.toDataURL();
    return iconCache[key];
  }

  const BLURB = {
    single: 'Basic shot, never runs out', heavy: 'Bigger blast', triple: 'Three at once',
    cluster: 'Splits at the top', bounce: 'Bounces three times', roller: 'Rolls downhill',
    homing: 'Steers toward them', shower: 'Rains down', dirt: 'Builds a hill', dig: 'Digs a pit', mega: 'Huge blast'
  };

  function buildWeaponGrid() {
    const grid = $('weaponGrid');
    grid.innerHTML = '';
    const t = game.cur();
    Game.WEAPON_ORDER.forEach(function (id) {
      const b = document.createElement('button');
      b.className = 'wopt' + (t.weapon === id ? ' on' : '');
      b.disabled = !(t.ammo[id] > 0);
      const img = document.createElement('img');
      img.src = weaponIcon(id, t.color);
      img.alt = '';
      b.appendChild(img);
      const d = document.createElement('div');
      d.innerHTML = '<b></b><small></small>';
      d.querySelector('b').textContent = game.skin.weapons[id][0] + (t.ammo[id] === Infinity ? '' : ' ×' + t.ammo[id]);
      d.querySelector('small').textContent = BLURB[id];
      b.appendChild(d);
      b.addEventListener('click', function () {
        if (game.act({ k: 'weapon', w: id })) Sfx.click();
        $('weaponSheet').classList.add('hidden');
      });
      grid.appendChild(b);
    });
  }

  $('weaponBtn').addEventListener('click', function () {
    if (!game || game.phase !== 'aim' || !game.isHumanTurn()) return;
    buildWeaponGrid();
    $('weaponSheet').classList.remove('hidden');
  });
  $('closeSheet').addEventListener('click', function () { $('weaponSheet').classList.add('hidden'); });
  $('weaponSheet').addEventListener('click', function (e) { if (e.target.id === 'weaponSheet') e.target.classList.add('hidden'); });

  // press-and-hold nudges for angle/power
  document.querySelectorAll('[data-adj]').forEach(function (b) {
    let timer = 0, n = 0;
    const nudge = function () {
      if (!game) return;
      const t = game.cur();
      const step = (n > 8 ? 3 : 1) * Number(b.dataset.d);
      if (b.dataset.adj === 'angle') game.act({ k: 'aim', a: Math.round(t.angle) + step });
      else game.act({ k: 'aim', p: Math.round(t.power) + step });
      n++;
    };
    const stop = function () { clearTimeout(timer); timer = 0; };
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      Sfx.unlock();
      n = 0; nudge();
      const rep = function () { nudge(); timer = setTimeout(rep, 60); };
      timer = setTimeout(rep, 350);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, stop); });
  });

  $('moveL').addEventListener('click', function () { if (game) game.act({ k: 'move', dir: -1 }); });
  $('moveR').addEventListener('click', function () { if (game) game.act({ k: 'move', dir: 1 }); });
  $('fireBtn').addEventListener('click', fire);

  function fire() {
    if (!game || game.phase !== 'aim' || !game.isHumanTurn()) return;
    Sfx.unlock();
    game.act(game.fireAction());
  }

  document.addEventListener('keydown', function (e) {
    if (!game || $('play').classList.contains('hidden')) return;
    if (game.phase !== 'aim' || !game.isHumanTurn()) return;
    const t = game.cur();
    const big = e.shiftKey ? 5 : 1;
    if (e.key === 'ArrowLeft') game.act({ k: 'aim', a: Math.round(t.angle) + big });
    else if (e.key === 'ArrowRight') game.act({ k: 'aim', a: Math.round(t.angle) - big });
    else if (e.key === 'ArrowUp') game.act({ k: 'aim', p: Math.round(t.power) + big });
    else if (e.key === 'ArrowDown') game.act({ k: 'aim', p: Math.round(t.power) - big });
    else if (e.key === ' ' || e.key === 'Enter') fire();
    else if (e.key === 'a') game.act({ k: 'move', dir: -1 });
    else if (e.key === 'd') game.act({ k: 'move', dir: 1 });
    else if (e.key === 'w') {
      const order = Game.WEAPON_ORDER.filter(function (w) { return t.ammo[w] > 0; });
      game.act({ k: 'weapon', w: order[(order.indexOf(t.weapon) + 1) % order.length] });
    } else return;
    e.preventDefault();
  });

  let toastTimer = 0;
  function toast(msg, ms) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    if (ms !== 0) toastTimer = setTimeout(function () { el.classList.add('hidden'); }, ms || 1600);
  }

  function announceTurn() {
    const t = game.cur();
    if (game.mode === 'cpu') toast(t.i === 0 ? 'Your turn' : 'Computer is aiming…', 1300);
    else if (game.mode === 'local') toast(t.name + "'s turn", 1500);
    else toast(t.i === game.localIndex ? 'Your turn' : 'Friend is aiming…', 1300);
  }

  // ---------- game over + rewards ----------
  function gameOver(res) {
    const local = game.mode === 'cpu' ? 0 : game.mode === 'online' ? game.localIndex : -1;
    const w = res.winner;
    let title, text = '', reward = '';
    const pics = w === -1 ? game.tanks : [game.tanks[w]];
    if (w === -1) title = 'Draw!';
    else if (local === -1) title = game.tanks[w].name + ' wins!';
    else if (w === local) title = 'You win!';
    else title = game.mode === 'cpu' ? 'The computer wins' : 'Your friend wins';
    text = game.tanks[0].name + ' ' + game.tanks[0].score + ' dmg · ' + game.tanks[1].name + ' ' + game.tanks[1].score + ' dmg';

    if (local >= 0) {
      const me = game.tanks[local];
      const won = w === local;
      const pts = me.score * 10 + me.hp * 5 + (won ? 500 : 0);
      const mult = game.mode === 'cpu' ? ({ easy: 0.5, medium: 1, hard: 1.5 }[game.difficulty] || 1) : 1;
      const coins = Math.round(((won ? 20 : w === -1 ? 10 : 5) + Math.floor(me.score / 10)) * mult);
      let best = { isNew: false };
      try {
        best = Profile.submitScore(GAME_ID, pts) || best;
        Profile.addCoins(coins, GAME_ID);
      } catch (e) { /* profile unavailable */ }
      reward = 'Score ' + pts + (best.isNew ? ' · new best!' : '') + ' · +' + coins + ' coins';
    } else {
      reward = 'Coins are earned against the computer or online.';
    }
    if (local === -1 || w === local) Sfx.win(game.skin.id); else Sfx.lose();

    setTimeout(function () {
      setWinnerPics(pics);
      $('ovTitle').textContent = title;
      $('ovText').textContent = text;
      $('ovReward').textContent = reward;
      $('rematchBtn').disabled = game.mode === 'online' && game.localIndex !== 0;
      $('rematchBtn').textContent = game.mode === 'online' && game.localIndex !== 0 ? 'Waiting for host…' : 'Play again';
      $('overlay').classList.remove('hidden');
    }, 1200);
  }

  $('rematchBtn').addEventListener('click', function () {
    if (!lastSetup) return;
    const s = Object.assign({}, lastSetup, { seed: newSeed(), starter: 1 - (lastSetup.starter || 0) });
    if (s.mode === 'online') {
      if (!link) return;
      link.send({ k: 'start', seed: s.seed, skin: s.skin, rounds: s.rounds, starter: s.starter });
    }
    start(s);
  });
  $('menuBtn').addEventListener('click', leaveGame);
  $('quitBtn').addEventListener('click', function () {
    if (game && game.phase !== 'over' && !confirm('Leave this match?')) return;
    leaveGame();
  });

  function leaveGame() {
    if (link) { link.send({ k: 'bye' }); link.close(); link = null; }
    game = null;
    show('menu');
  }

  // ---------- online ----------
  function netStatus(msg, err) {
    const el = $('netStatus');
    el.textContent = msg || '';
    el.classList.toggle('err', !!err);
  }

  function resetOnline() {
    if (link) link.close();
    link = null;
    ['inviteBox', 'replyBox'].forEach(function (id) { $(id).classList.add('hidden'); });
    $('inviteCode').value = $('replyCode').value = $('replyIn').value = '';
    $('makeInvite').disabled = false;
    $('makeReply').disabled = false;
    netStatus('');
  }

  function setTab(v) {
    $('onlineTabs').querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === v); });
    $('hostPane').classList.toggle('hidden', v !== 'host');
    $('joinPane').classList.toggle('hidden', v !== 'join');
  }
  $('onlineTabs').querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () { resetOnline(); setTab(b.dataset.v); });
  });

  function wireLink(isHost) {
    link.onMessage = function (m) {
      if (m.k === 'start') {
        start({ seed: m.seed, skin: m.skin, mode: 'online', localIndex: 1, rounds: m.rounds, starter: m.starter || 0, names: ['Host', 'You'] });
        return;
      }
      if (m.k === 'bye') { connectionLost('Your friend left the match.'); return; }
      if (!game) return;
      if (m.k === 'sync') { game.receiveSync(m); return; }
      handleRemoteAction(m);
    };
    link.onClose = function () { connectionLost('Connection lost.'); };
    link.onOpen = function () {
      netStatus('Connected!');
      if (isHost) {
        const s = { seed: newSeed(), skin: prefs.skin, mode: 'online', localIndex: 0, rounds: prefs.rounds, starter: 0, names: ['You', 'Friend'] };
        link.send({ k: 'start', seed: s.seed, skin: s.skin, rounds: s.rounds, starter: 0 });
        start(s);
      } else {
        netStatus('Connected! Waiting for the host to start…');
      }
    };
  }

  function handleRemoteAction(m) {
    if (!game || game.mode !== 'online' || game.current === game.localIndex) return;
    if (game.phase !== 'aim') { remoteQueue.push(m); return; }
    game.apply(m);
  }

  function connectionLost(msg) {
    if (link) { link.close(); link = null; }
    if (game && !$('play').classList.contains('hidden')) {
      if (game.phase === 'over') {
        $('rematchBtn').disabled = true;
        $('rematchBtn').textContent = 'Friend left';
        return;
      }
      game.phase = 'over';
      setWinnerPics([]);
      $('ovTitle').textContent = 'Match ended';
      $('ovText').textContent = msg;
      $('ovReward').textContent = '';
      $('rematchBtn').disabled = true;
      $('overlay').classList.remove('hidden');
    } else {
      netStatus(msg, true);
    }
  }

  function inviteText(code) {
    const url = location.href.split('#')[0] + '#join=' + code;
    return { code: code, url: url, text: KQI18n.t('Play Volley Valley with me! Open this link, then send me back the reply code:\n' + url) };
  }

  async function copy(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      const old = btn.textContent; btn.textContent = 'Copied!';
      setTimeout(function () { btn.textContent = old; }, 1200);
    } catch (e) {
      netStatus('Copy failed, select the code and copy it by hand.', true);
    }
  }
  function share(text, fallbackBtn) {
    if (navigator.share) navigator.share({ text: text }).catch(function () { /* cancelled */ });
    else copy(text, fallbackBtn);
  }

  $('makeInvite').addEventListener('click', async function () {
    if (!Link.supported()) { netStatus('This browser cannot do online play.', true); return; }
    resetOnline();
    $('makeInvite').disabled = true;
    netStatus('Making invite…');
    try {
      link = new Link();
      wireLink(true);
      const code = await link.host();
      const inv = inviteText(code);
      $('inviteCode').value = inv.url;
      $('inviteBox').classList.remove('hidden');
      netStatus('Send the invite, then paste their reply below.');
    } catch (e) {
      netStatus('Could not make an invite: ' + e.message, true);
      $('makeInvite').disabled = false;
    }
  });
  $('copyInvite').addEventListener('click', function () { copy($('inviteCode').value, this); });
  $('shareInvite').addEventListener('click', function () {
    share(KQI18n.t('Play Volley Valley with me! Open this link, then send me back the reply code:\n' + $('inviteCode').value), this);
  });
  $('connectBtn').addEventListener('click', async function () {
    if (!link) { netStatus('Make an invite first.', true); return; }
    try {
      netStatus('Connecting…');
      await link.accept($('replyIn').value);
      setTimeout(function () {
        if (link && !(link.ch && link.ch.readyState === 'open')) netStatus('Still connecting… if this takes long, both of you try Wi-Fi.', false);
      }, 8000);
    } catch (e) {
      netStatus(e.message || 'That reply code did not work.', true);
    }
  });

  $('makeReply').addEventListener('click', async function () {
    if (!Link.supported()) { netStatus('This browser cannot do online play.', true); return; }
    const inv = $('joinIn').value;
    if (!inv.trim()) { netStatus('Paste the invite first.', true); return; }
    if (link) link.close();
    $('makeReply').disabled = true;
    netStatus('Making reply…');
    try {
      link = new Link();
      wireLink(false);
      const code = await link.join(inv);
      $('replyCode').value = code;
      $('replyBox').classList.remove('hidden');
      netStatus('Send this reply back. Waiting for your friend…');
    } catch (e) {
      netStatus(e.message || 'That invite did not work.', true);
      $('makeReply').disabled = false;
    }
  });
  $('copyReply').addEventListener('click', function () { copy($('replyCode').value, this); });
  $('shareReply').addEventListener('click', function () { share($('replyCode').value, this); });

  document.querySelectorAll('[data-back]').forEach(function (b) {
    b.addEventListener('click', function () { resetOnline(); show('menu'); });
  });

  // ---------- boot ----------
  $('playCpu').addEventListener('click', function () { Sfx.unlock(); start(localSetup('cpu')); });
  $('playLocal').addEventListener('click', function () { Sfx.unlock(); start(localSetup('local')); });
  $('playOnline').addEventListener('click', function () { Sfx.unlock(); resetOnline(); setTab('host'); show('online'); });
  $('muteBtn').addEventListener('click', function () { Sfx.setMuted(!Sfx.isMuted()); updateMute(); Sfx.click(); });
  if (Profile.onChange) Profile.onChange(refreshProfile);

  buildSkinCards();
  segs('diffSeg', 'difficulty');
  segs('roundSeg', 'rounds', Number);
  updateMute();
  show('menu');

  // opened from an invite link
  const m = location.hash.match(/join=([A-Za-z0-9_-]+)/);
  if (m) {
    show('online');
    setTab('join');
    $('joinIn').value = m[1];
    history.replaceState(null, '', location.href.split('#')[0]);
    netStatus('Invite found. Tap "Make reply".');
  }

  // test hook for automated checks
  window.__artillery = { get game() { return game; }, start: start };
})();
