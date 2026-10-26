// Shared native layer used by every Gimble Gaming app (the file keeps its old name, ads.js).
//   Ads     rewarded + interstitial ads through @capacitor-community/admob. ADS_ENABLED below is false for launch:
//           the apps ship ad-free, every "reward" is simply granted, and no ad SDK runs or collects anything.
//           To monetize later: set it to true, put @capacitor-community/admob back in package.json, set "ads": true
//           in scripts/native.json, add real ad unit ids below, and give the ad-gated buttons their video wording back.
//   Haptic  the phone's haptic engine through @capacitor/haptics (iPhone Taptic Engine, Android vibration with
//           strength control). On the web it falls back to navigator.vibrate (Android browsers; iPhones have none).
//   Back    the Android back button through @capacitor/app: games get first say via window.onBackButton().
(() => {
  const C = window.Capacitor;
  const isNative = !!(C && C.isNativePlatform && C.isNativePlatform());
  const platform = isNative && C.getPlatform ? C.getPlatform() : 'web';
  const plugin = name => { try { return isNative && (!C.isPluginAvailable || C.isPluginAvailable(name)) ? C.registerPlugin(name) : null; } catch (e) { return null; } };

  // ---------------------------------------------------------------- haptics
  // Games call Haptic.play() with what they used to give navigator.vibrate: a duration in ms, an
  // [on, off, on, ...] pattern, or a named kind. Durations map to tap strengths: under 15 ms light,
  // under 30 ms medium, longer heavy. Patterns play one tap at the start of each "on" part.
  const H = plugin('Haptics');
  const WEB = { select: 6, light: 10, medium: 20, heavy: 40, success: [15, 40, 15], warning: [30, 60, 30], error: [60, 50, 90] };
  const NOTE = { success: 'SUCCESS', warning: 'WARNING', error: 'ERROR' };
  const styleFor = ms => ms >= 30 ? 'HEAVY' : ms >= 15 ? 'MEDIUM' : 'LIGHT';
  const impact = style => { try { H.impact({ style }).catch(() => {}); } catch (e) {} };
  function play(p){
    if (p == null || p === 0) return;
    if (!H) { try { if (navigator.vibrate) navigator.vibrate(typeof p === 'string' ? (WEB[p] || 10) : p); } catch (e) {} return; }
    if (typeof p === 'string') {
      if (NOTE[p]) { try { H.notification({ type: NOTE[p] }).catch(() => {}); } catch (e) {} }
      else impact(p === 'heavy' ? 'HEAVY' : p === 'medium' ? 'MEDIUM' : 'LIGHT');
    } else if (typeof p === 'number') impact(styleFor(p));
    else if (Array.isArray(p)) {
      let t = 0;
      for (let i = 0; i < p.length; i += 2) {
        const on = +p[i] || 0, s = styleFor(on);
        if (on > 0) { if (t === 0) impact(s); else setTimeout(() => impact(s), t); }
        t += on + (+p[i + 1] || 0);
      }
    }
  }
  window.Haptic = { play, get native(){ return !!H; } };

  // ---------------------------------------------------------------- audio pause while a full-screen ad shows
  // Each game registers its AudioContext so ad audio never plays on top of the game's music.
  const contexts = new Set(); let paused = [];
  const pauseAudio = () => { paused = [...contexts].filter(c => c.state === 'running'); paused.forEach(c => { try { c.suspend(); } catch (e) {} }); };
  const resumeAudio = () => { if (!document.hidden) paused.forEach(c => { try { c.resume(); } catch (e) {} }); paused = []; };

  // ---------------------------------------------------------------- ads
  const ADS_ENABLED = false;
  // ---- Replace these with your own AdMob unit IDs when you turn ads on (see README). Currently Google's public TEST IDs.
  const IDS = {
    android: { rewarded: 'ca-app-pub-3940256099942544/5224354917', interstitial: 'ca-app-pub-3940256099942544/1033173712' },
    ios:     { rewarded: 'ca-app-pub-3940256099942544/1712485313', interstitial: 'ca-app-pub-3940256099942544/4411468910' }
  };
  const TESTING = true;   // set to false when you switch to your real IDs
  const ids = IDS[platform] || IDS.android;

  let AdMob = null, ready = false, showing = false, privacyRequired = false;
  const prepR = () => AdMob.prepareRewardVideoAd({ adId: ids.rewarded, isTesting: TESTING }).catch(() => {});
  const prepI = () => AdMob.prepareInterstitial({ adId: ids.interstitial, isTesting: TESTING }).catch(() => {});
  (async () => {
    try {
      if (!ADS_ENABLED) return;
      AdMob = plugin('AdMob'); if (!AdMob) return;
      await AdMob.initialize({});
      // EU/UK/US-state privacy consent (Google UMP). Shows a form only where the law requires it.
      let canRequest = true;
      try {
        let info = await AdMob.requestConsentInfo();
        if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') info = await AdMob.showConsentForm();
        if (info) { canRequest = info.canRequestAds !== false; privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED'; }
      } catch (e) {}
      ready = canRequest; if (ready) { prepR(); prepI(); }
      window.dispatchEvent(new Event('ads-ready'));
    } catch (e) { ready = false; }
  })();
  const around = async show => { showing = true; pauseAudio(); try { return await show(); } finally { showing = false; resumeAudio(); } };

  window.Ads = {
    enabled: ADS_ENABLED,
    get native(){ return ready; },
    get showing(){ return showing; },
    // Where privacy law requires it (EU/UK), the menu shows a "Privacy choices" button that calls this.
    get privacyOptionsRequired(){ return privacyRequired; },
    showPrivacyOptions(){ return AdMob ? AdMob.showPrivacyOptionsForm().catch(() => {}) : Promise.resolve(); },
    platform,
    trackAudio(ctx){ if (ctx) contexts.add(ctx); return ctx; },
    // Resolves true when the player earned the reward (always true on the web).
    rewarded(){
      if (!ready) return Promise.resolve(true);
      return around(() => new Promise(res => {
        let got = false, done = false; const hs = [];
        const finish = ok => { if (done) return; done = true; hs.forEach(h => Promise.resolve(h).then(x => x.remove()).catch(() => {})); res(ok); prepR(); };
        hs.push(AdMob.addListener('onRewardedVideoAdReward', () => { got = true; }));
        hs.push(AdMob.addListener('onRewardedVideoAdDismissed', () => finish(got)));
        hs.push(AdMob.addListener('onRewardedVideoAdFailedToShow', () => finish(false)));
        AdMob.showRewardVideoAd().catch(() => finish(false));
      }));
    },
    async interstitial(){
      if (!ready) return;
      await around(() => new Promise(res => {
        let done = false; const hs = [];
        const finish = () => { if (done) return; done = true; hs.forEach(h => Promise.resolve(h).then(x => x.remove()).catch(() => {})); res(); prepI(); };
        hs.push(AdMob.addListener('interstitialAdDismissed', finish));
        hs.push(AdMob.addListener('interstitialAdFailedToShow', finish));
        AdMob.showInterstitial().catch(finish);
        setTimeout(finish, 120000);   // never leave the game muted if an event goes missing
      }));
    },
    // Interstitial every Nth finished game, counted across the whole app session.
    afterGame(every = 3){
      if (!ADS_ENABLED) return Promise.resolve();
      let n = 0; try { n = (+sessionStorage.getItem('arcade_games') || 0) + 1; sessionStorage.setItem('arcade_games', n); } catch (e) {}
      return n > 0 && n % every === 0 ? this.interstitial() : Promise.resolve();
    }
  };

  // ---------------------------------------------------------------- Android back button
  // window.onBackButton() returns true when the page handled it (closed a panel, paused a run), or
  // 'exit' on a main menu. Otherwise: go back a page if there is one, else send the app to the
  // background (Android keeps its state, like pressing Home).
  const App = platform === 'android' ? plugin('App') : null;
  if (App) {
    try {
      App.addListener('backButton', ({ canGoBack }) => {
        if (showing) return;
        let r = false; try { r = window.onBackButton ? window.onBackButton() : false; } catch (e) {}
        if (r === true) return;
        if (r !== 'exit' && canGoBack) history.back();
        else Promise.resolve(App.minimizeApp ? App.minimizeApp() : App.exitApp()).catch(() => {});
      });
    } catch (e) {}
  }
})();
