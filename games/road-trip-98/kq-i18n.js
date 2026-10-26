/* KQI18n: shared translations for Known Quantity games.
 *
 * Games keep their English text in the code. Each game loads this file and a
 * strings file that calls KQI18n.addRows({ "Play": ["Jugar", "开始", "Играть"] })
 * (or KQI18n.add({ es: {...}, zh: {...}, ru: {...} })) with English -> translation pairs. The text is translated where it reaches the
 * player: DOM text and attributes (watched with a MutationObserver), canvas
 * fillText/strokeText/measureText, alert/confirm/prompt and document.title.
 *
 * Keys can hold placeholders: "Level {0}" matches "Level 12" and the
 * translation "Nivel {0}" gets the same value back, itself translated when it
 * is a known string. Keys that hold a tag ("Tap <b>here</b>") are matched against an element's
 * whole innerHTML (for sentences broken up by <b>, <br> and the like).
 *
 * Language: saved choice (localStorage "kq.lang") > browser language > English.
 * <select data-kq-lang> or any element with data-kq-lang gets a language picker.
 */
(function (root) {
  'use strict';
  var LANGS = ['en', 'es', 'zh', 'ru'];
  var NAMES = { en: 'English', es: 'Español', zh: '中文', ru: 'Русский' };
  var SHORT = { en: 'EN', es: 'ES', zh: '中文', ru: 'RU' };
  var KEY = 'kq.lang';
  var dicts = { es: {}, zh: {}, ru: {} };
  var patterns = { es: [], zh: [], ru: [] };
  var htmlDicts = { es: {}, zh: {}, ru: {} };
  var capsDicts = { es: {}, zh: {}, ru: {} };
  var lowerDicts = { es: {}, zh: {}, ru: {} };  // names lowercased mid-sentence ("the coffee round")
  var cache = new Map();
  var listeners = [];

  function norm(l) {
    l = String(l || '').toLowerCase();
    if (l.indexOf('zh') === 0) return 'zh';
    l = l.slice(0, 2);
    return LANGS.indexOf(l) >= 0 ? l : null;
  }
  function detect() {
    var saved = null;
    try { saved = norm(root.localStorage.getItem(KEY)); } catch (e) {}
    if (saved) return saved;
    var nav = root.navigator || {};
    var list = (nav.languages && nav.languages.length ? nav.languages : [nav.language]);
    for (var i = 0; i < list.length; i++) { var n = norm(list[i]); if (n) return n; }
    return 'en';
  }
  var lang = detect();

  var ws = /\s+/g;
  function squash(s) { return s.replace(ws, ' ').trim(); }

  function compile(key, val) {
    var names = [];
    var re = squash(key).replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\d+)\\?\}/g, function (_, n) {
      names.push(+n); return '(.+?)';
    });
    return { lit: squash(key).replace(/\{\d+\}/g, '').length, re: new RegExp('^' + re + '$'), reI: new RegExp('^' + re + '$', 'i'), names: names, val: val };
  }
  // Text shown in capitals ("NEXT STOP, NIAGARA FALLS!") falls back to the normal-case entry, in capitals.
  function isCaps(s) { return /[A-Z]/.test(s) && s === s.toUpperCase(); }

  function add(table) {
    for (var l in table) {
      if (!dicts[l]) continue;
      var src = table[l];
      for (var k in src) {
        // keys with tags also work through t(), for code that builds innerHTML: el.innerHTML = KQI18n.t(html)
        if (/<[a-z]/i.test(k)) htmlDicts[l][squash(k)] = src[k];
        if (/\{\d+\}/.test(k)) patterns[l].push(compile(k, src[k]));
        else {
          dicts[l][squash(k)] = src[k];
          capsDicts[l][squash(k).toUpperCase()] = src[k].toUpperCase();
          lowerDicts[l][squash(k).toLowerCase()] = src[k].toLowerCase();
        }
      }
    }
    // the most specific pattern wins: "{0} → {1} · {2} mi" before "{0} mi" before "{0} · {1}"
    for (var pl in patterns) patterns[pl].sort(function (a, b) { return b.lit - a.lit; });
    cache.clear();
    if (lang !== 'en' && root.document && document.body) retranslate();
  }

  /* rows: { "English": ["Español", "中文", "Русский"], ... } */
  function addRows(rows) {
    var table = { es: {}, zh: {}, ru: {} };
    for (var k in rows) {
      var r = rows[k];
      if (r[0] != null) table.es[k] = r[0];
      if (r[1] != null) table.zh[k] = r[1];
      if (r[2] != null) table.ru[k] = r[2];
    }
    add(table);
  }

  function lookup(s, depth) {
    var d = dicts[lang], v = d[s], caps = isCaps(s);
    if (v !== undefined) return v;
    if (caps && (v = capsDicts[lang][s]) !== undefined) return v;
    if (s === s.toLowerCase() && (v = lowerDicts[lang][s]) !== undefined) return v;
    if (depth > 4) return null;
    var ps = patterns[lang];
    for (var pass = 0; pass < (caps ? 2 : 1); pass++) for (var i = 0; i < ps.length; i++) {
      var m = (pass ? ps[i].reI : ps[i].re).exec(s);
      if (!m) continue;
      var p = ps[i];
      var val = pass ? p.val.toUpperCase() : p.val;
      return val.replace(/\{(\d+)\}/g, function (_, n) {
        var idx = p.names.indexOf(+n);
        if (idx < 0) return '';
        var part = m[idx + 1];
        var tr = /^[\d\s.,:+\-−×%/]*$/.test(part) ? null : lookup(part, depth + 1);
        return tr == null ? part : tr;
      });
    }
    return null;
  }

  /* Translate a string. Unknown text comes back unchanged. */
  function t(s) {
    if (lang === 'en' || s == null) return s;
    s = String(s);
    if (!/[A-Za-z]/.test(s)) return s;
    var c = cache.get(s);
    if (c !== undefined) return c;
    var lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0];
    var core = squash(s);
    var tr = lookup(core, 0);
    var out = tr == null ? s : lead + tr + tail;
    if (cache.size > 5000) cache.clear();
    cache.set(s, out);
    return out;
  }

  /* ---------- DOM ---------- */
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var textOrig = new WeakMap();   // text node -> [english, translated]
  var attrOrig = new WeakMap();   // element -> {attr: [english, translated]}
  var htmlOrig = new WeakMap();   // element -> [english innerHTML, translated]
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, NOSCRIPT: 1 };
  var busy = false;

  function doText(n) {
    var rec = textOrig.get(n), cur = n.data;
    var en = rec && cur === rec[1] ? rec[0] : cur;
    var tr = t(en);
    if (tr === en && !rec) return;
    textOrig.set(n, [en, tr]);
    if (tr !== cur) n.data = tr;
  }
  function doAttrs(el) {
    var rec = attrOrig.get(el);
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute(a)) continue;
      var cur = el.getAttribute(a), r = rec && rec[a];
      var en = r && cur === r[1] ? r[0] : cur;
      var tr = t(en);
      if (!rec) { rec = {}; attrOrig.set(el, rec); }
      rec[a] = [en, tr];
      if (tr !== cur) el.setAttribute(a, tr);
    }
  }
  function doHtml(el) {
    var rec = htmlOrig.get(el), cur = rec ? el.innerHTML : '';
    if (rec && cur === rec[1]) {
      if (lang === 'en') { el.innerHTML = rec[0]; htmlOrig.delete(el); return true; }
      var again = htmlDicts[lang][squash(rec[0])];
      if (again === undefined || again === cur) return true;
      el.innerHTML = again; rec[1] = el.innerHTML; return true;
    }
    if (lang === 'en' || !mixed(el)) return false;
    cur = el.innerHTML;
    if (cur.length > 2000) return false;
    var tr = htmlDicts[lang][squash(cur)];
    if (tr === undefined) return false;
    el.innerHTML = tr;
    htmlOrig.set(el, [cur, el.innerHTML]);
    return true;
  }
  function mixed(el) {
    var txt = false, elem = false;
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1) elem = true;
      else if (c.nodeType === 3 && /\S/.test(c.data)) txt = true;
      if (txt && elem) return true;
    }
    return false;
  }
  function walk(node) {
    if (node.nodeType === 3) { var p = node.parentNode; if (p && !SKIP[p.nodeName] && !(p.closest && p.closest('[data-kq-notr]'))) doText(node); return; }
    if (node.nodeType !== 1 || node.hasAttribute('data-kq-notr')) return;
    if (node.nodeName === 'TEXTAREA') { doAttrs(node); return; }
    if (SKIP[node.nodeName]) return;
    doAttrs(node);
    if (htmlOrig.has(node) || hasHtmlKeys()) { if (doHtml(node)) return; }
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }
  function hasHtmlKeys() { var d = htmlDicts[lang]; if (d) for (var k in d) return true; return false; }

  function retranslate() {
    busy = true;
    try {
      document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-Hans' : lang);
      if (titleOrig == null) titleOrig = document.title;
      document.title = t(titleOrig);
      if (document.body) walk(document.body);
    } finally { busy = false; }
  }
  var titleOrig = null;

  var observer = null;
  function observe() {
    if (observer || !root.MutationObserver) return;
    observer = new MutationObserver(function (list) {
      if (busy) return;
      for (var k = 0; k < list.length; k++) if (list[k].addedNodes.length) { mountPickers(); break; }
      if (lang === 'en') return;
      busy = true;
      try {
        for (var i = 0; i < list.length; i++) {
          var m = list[i];
          if (m.type === 'characterData') walk(m.target);
          else if (m.type === 'attributes') { if (m.target.nodeType === 1) doAttrs(m.target); }
          else {
            var tgt = m.target;
            if (tgt.nodeType === 1 && (htmlOrig.has(tgt) || hasHtmlKeys()) && doHtml(tgt)) continue;
            for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
          }
        }
      } finally { busy = false; }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  /* ---------- canvas, dialogs ---------- */
  function patchCanvas(proto) {
    if (!proto || proto.__kqI18n) return;
    proto.__kqI18n = true;
    ['fillText', 'strokeText', 'measureText'].forEach(function (fn) {
      var orig = proto[fn];
      if (!orig) return;
      proto[fn] = function (s) {
        if (lang !== 'en' && typeof s === 'string') { var a = Array.prototype.slice.call(arguments); a[0] = t(s); return orig.apply(this, a); }
        return orig.apply(this, arguments);
      };
    });
  }
  patchCanvas(root.CanvasRenderingContext2D && root.CanvasRenderingContext2D.prototype);
  patchCanvas(root.OffscreenCanvasRenderingContext2D && root.OffscreenCanvasRenderingContext2D.prototype);
  ['alert', 'confirm', 'prompt'].forEach(function (fn) {
    var orig = root[fn];
    if (typeof orig !== 'function') return;
    root[fn] = function (msg) { var a = Array.prototype.slice.call(arguments); a[0] = t(msg); return orig.apply(root, a); };
  });

  /* ---------- picker ---------- */
  var STYLE = '.kq-lang{font:inherit;font-size:14px;color:inherit;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:6px 28px 6px 12px;-webkit-appearance:none;appearance:none;cursor:pointer;' +
    'background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%);background-position:calc(100% - 15px) 55%,calc(100% - 10px) 55%;background-size:5px 5px;background-repeat:no-repeat}' +
    '.kq-lang option{color:#111;background:#fff}' +
    '.kq-lang-short{padding-left:30px;background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23999%27 stroke-width=%272%27%3E%3Ccircle cx=%2712%27 cy=%2712%27 r=%279%27/%3E%3Cpath d=%27M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18%27/%3E%3C/svg%3E"),linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%);background-position:10px 50%,calc(100% - 15px) 55%,calc(100% - 10px) 55%;background-size:15px 15px,5px 5px,5px 5px}' +
    '.kq-lang-fixed{position:fixed;z-index:2147483000;top:max(10px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right))}' +
    'html[lang=zh-Hans] body{line-break:strict;word-break:normal}html[lang=zh-Hans] h1,html[lang=zh-Hans] h2{word-break:keep-all}';
  function injectStyle() {
    if (document.getElementById('kq-i18n-style')) return;
    var st = document.createElement('style');
    st.id = 'kq-i18n-style'; st.textContent = STYLE;
    (document.head || document.documentElement).appendChild(st);
  }
  function makePicker(el) {
    var sel = el && el.tagName === 'SELECT' ? el : document.createElement('select');
    sel.classList.add('kq-lang');
    sel.setAttribute('data-kq-notr', '');
    sel.setAttribute('aria-label', 'Language · Idioma · 语言 · Язык');
    sel.innerHTML = '';
    var short = el && el.getAttribute('data-kq-lang') === 'short';
    if (short) sel.classList.add('kq-lang-short');
    LANGS.forEach(function (l) {
      var o = document.createElement('option'); o.value = l; o.textContent = short ? SHORT[l] : NAMES[l]; sel.appendChild(o);
    });
    sel.value = lang;
    sel.addEventListener('change', function () { setLang(sel.value); });
    // keep game key/tap handlers from seeing the picker
    ['pointerdown', 'mousedown', 'touchstart', 'click', 'keydown'].forEach(function (ev) {
      sel.addEventListener(ev, function (e) { e.stopPropagation(); });
    });
    if (el && el !== sel) el.appendChild(sel);
    return sel;
  }
  function mountPickers() {
    var els = document.querySelectorAll('[data-kq-lang]');
    for (var i = 0; i < els.length; i++) if (!els[i].__kqPicker) { els[i].__kqPicker = true; makePicker(els[i]); }
  }
  function syncPickers() {
    var els = document.querySelectorAll('select.kq-lang');
    for (var i = 0; i < els.length; i++) els[i].value = lang;
  }

  function setLang(l) {
    l = norm(l) || 'en';
    try { root.localStorage.setItem(KEY, l); } catch (e) {}
    if (l === lang) return;
    lang = l; cache.clear();
    retranslate();
    syncPickers();
    listeners.forEach(function (fn) { try { fn(lang); } catch (e) {} });
  }
  function start() {
    injectStyle();
    mountPickers();
    retranslate();
    observe();
  }
  if (root.document) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  root.KQI18n = {
    LANGS: LANGS, NAMES: NAMES,
    get lang() { return lang; },
    t: t, add: add, addRows: addRows, setLang: setLang,
    picker: makePicker,
    onChange: function (fn) { listeners.push(fn); },
    /* Picker pinned to the top-right corner, for pages without a menu slot. */
    fixedPicker: function () { var s = makePicker(); s.classList.add('kq-lang-fixed'); document.body.appendChild(s); return s; },
    refresh: retranslate
  };
})(typeof window !== 'undefined' ? window : this);
