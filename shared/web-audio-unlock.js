// iPhone fixes, loaded first by every game page on the public games site. Same code as www/iphone-fixes.js in the app builds.
//   1. Sound with the silent switch on: Safari mutes Web Audio whenever the phone is on silent.
//      navigator.audioSession (Safari 16.4+) set to "playback" asks for sound anyway, and on iPhone a
//      silent looping <audio> started inside the first tap moves the page into the "playback" audio
//      category, which is what actually lifts the mute on every iOS version. It pauses while the page
//      is hidden.
//   2. Sound at all: an AudioContext only starts from a tap that counts as a user gesture, and on
//      iPhone that is touchend / click, not touchstart or a touch pointerdown. The games unlock on
//      pointerdown, so they stayed silent. Every AudioContext a game makes is tracked and resumed on
//      those events, with a silent buffer played once inside the gesture for older iPhones.
//   3. No zooming: Safari ignores user-scalable=no, so quick taps on buttons double-tap-zoomed and two
//      fingers pinch-zoomed the game. touch-action:manipulation (page CSS still wins where it sets
//      its own) stops the double tap, and cancelling Safari's gesture events stops the pinch.
(() => {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}

  try {
    const st = document.createElement('style');
    st.textContent = 'html{touch-action:manipulation;-webkit-text-size-adjust:100%;text-size-adjust:100%}';
    const head = document.head || document.documentElement;
    head.insertBefore(st, head.firstChild);
  } catch (e) {}
  ['gesturestart', 'gesturechange'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));

  const Native = window.AudioContext || window.webkitAudioContext;
  if (!Native) return;
  const contexts = [];
  window.__webAudioContexts = contexts;
  function Tracked(opts) {
    const ac = opts === undefined ? new Native() : new Native(opts);
    contexts.push(ac);
    return ac;
  }
  Tracked.prototype = Native.prototype;
  Object.setPrototypeOf(Tracked, Native);
  window.AudioContext = Tracked;
  if (window.webkitAudioContext) window.webkitAudioContext = Tracked;

  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let tag = null, tagPlaying = false;
  function keepPlaybackCategory() {
    if (!isIOS) return;
    try {
      if (!tag) {
        tag = document.createElement('audio');
        tag.setAttribute('x-webkit-airplay', 'deny');
        tag.setAttribute('playsinline', '');
        tag.preload = 'auto'; tag.loop = true; tag.controls = false; tag.disableRemotePlayback = true;
        // A tap fires pointerup and touchend, and only one may count as a gesture, so keep trying until it plays.
        tag.addEventListener('playing', () => { tagPlaying = true; });
        tag.addEventListener('pause', () => { tagPlaying = false; });
        tag.src = 'data:audio/wav;base64,UklGRvQHAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YdAHAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
      }
      if (!tagPlaying) { const p = tag.play(); if (p && p.catch) p.catch(() => {}); }
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && tag) try { tag.pause(); } catch (e) {} });

  const primed = new WeakSet();
  function unlock() {
    if (document.hidden) return;
    keepPlaybackCategory();
    contexts.forEach(ac => {
      try {
        if (ac.state === 'suspended' || ac.state === 'interrupted') { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); }
        if (!primed.has(ac)) {
          primed.add(ac);
          const src = ac.createBufferSource();
          src.buffer = ac.createBuffer(1, 1, 22050);
          src.connect(ac.destination);
          src.start(0);
        }
      } catch (e) {}
    });
  }
  ['touchend', 'pointerup', 'click', 'keydown'].forEach(t => addEventListener(t, unlock, { capture: true, passive: true }));
})();
