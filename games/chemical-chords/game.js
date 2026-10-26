// Chemical Chords: the bench, the shelf, the Codex and lessons, and the links out to Jam Jar, Chordfall and music apps.
(function () {
'use strict';
const D = window.CC_DATA, M = window.CC_MUSIC, FXL = window.CC_FX, TC = window.TUNECODE, P = window.KQProfile || null;
const A = M.Audio;
const GAME_ID = 'chemical-chords', KEY = 'kq.chemical-chords.v1', COINS_NEW = 10, MAX_IN = 4;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Text that reaches the page as plain text is translated by kq-i18n on the way in; sentences built around values or tags go through T/F here.
const T = s => window.KQI18n ? window.KQI18n.t(s) : s;
const F = (tpl, ...a) => T(tpl).replace(/\{(\d+)\}/g, (_, i) => a[i]);
const REAL = D.REACTIONS.filter(r => r.type);

// ---------------------------------------------------------------- saved state
const SV = { disc: {}, none: {}, mode: 'natural', muted: false, welcomed: false, tab: 0 };
try { Object.assign(SV, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(SV)); } catch (e) {} };
const discCount = () => REAL.filter(r => SV.disc[r.id]).length;
const unlocked = tier => discCount() >= D.TIERS[tier].need;

// ---------------------------------------------------------------- bench state
let contents = [];                       // substance ids in the beaker
let hum = null;                          // { title, partials, arr, code, reaction?, substance? }
let heatTimer = 0;
const fx = FXL.create($('lab'));
const sub = id => D.BY_ID[id];
const isA = (id, group) => group.includes(id) || (sub(id) && sub(id).same && group.includes(sub(id).same));

// ---------------------------------------------------------------- toast
let toastT = 0;
function toast(msg, ms){ const t = $('toast'); t.innerHTML = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms || 2600); }

// ---------------------------------------------------------------- the shelf
const bottleSVG = s => {
  const c = s.color, metal = s.kind === 'metal', gas = s.kind === 'gas', solid = s.kind === 'solid';
  if (metal) return `<svg class="glass" viewBox="0 0 34 44" aria-hidden="true"><defs><linearGradient id="m${s.id}" x1="0" x2="1"><stop offset="0" stop-color="${c}" stop-opacity=".6"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect x="6" y="12" width="22" height="26" rx="5" fill="url(#m${s.id})" opacity=".95"/><rect x="6" y="12" width="22" height="26" rx="5" fill="none" stroke="rgba(255,255,255,.35)"/></svg>`;
  if (gas) return `<svg class="glass" viewBox="0 0 34 44" aria-hidden="true"><path d="M13 2h8v8a13 13 0 1 1-8 0z" fill="${c}" fill-opacity=".18" stroke="rgba(220,235,255,.6)" stroke-width="1.4"/><circle cx="12" cy="28" r="3" fill="${c}" opacity=".5"/><circle cx="21" cy="24" r="2" fill="${c}" opacity=".5"/><circle cx="18" cy="33" r="2.4" fill="${c}" opacity=".5"/></svg>`;
  if (solid) return `<svg class="glass" viewBox="0 0 34 44" aria-hidden="true"><path d="M7 14h20v24a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4z" fill="rgba(160,200,255,.08)" stroke="rgba(220,235,255,.6)" stroke-width="1.4"/><rect x="6" y="9" width="22" height="6" rx="2" fill="#5a6688"/><path d="M8 30q9-7 18 0v8a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" fill="${c}"/></svg>`;
  return `<svg class="glass" viewBox="0 0 34 44" aria-hidden="true"><path d="M13 2h8v12l9 22a4 4 0 0 1-4 6H8a4 4 0 0 1-4-6l9-22z" fill="rgba(160,200,255,.08)" stroke="rgba(220,235,255,.6)" stroke-width="1.4"/><path d="M8.6 26h16.8l4.4 10.6a3 3 0 0 1-3 4.4H7.2a3 3 0 0 1-3-4.4z" fill="${c}"/></svg>`;
};
function renderTabs(){
  const el = document.querySelector('.tabs');
  el.innerHTML = D.TIERS.map((t, i) => `<button class="tab" role="tab" aria-selected="${SV.tab === i}" data-tab="${i}">${esc(t.name)}${unlocked(i) ? '' : '<span class="lock" aria-label="locked">🔒</span>'}</button>`).join('');
}
function renderShelf(){
  renderTabs();
  const el = $('bottles'), tier = SV.tab;
  if (!unlocked(tier)) { el.innerHTML = `<div class="locked">${F('Discover {0} reactions to open this shelf. You have {1}.', D.TIERS[tier].need, discCount())}</div>`; return; }
  el.innerHTML = D.SUBSTANCES.filter(s => s.tier === tier).map(s => `<div class="bottle${contents.some(c => c === s.id) ? ' in' : ''}${s.hazard ? ' warn' : ''}" role="listitem" data-add="${s.id}" tabindex="0" aria-label="Add ${esc(s.name)}">
    ${bottleSVG(s)}<span class="nm">${esc(s.name)}</span><span class="fm">${esc(s.formula)}</span>
    <button class="info" data-info="${s.id}" aria-label="About ${esc(s.name)}">i</button></div>`).join('');
}
// the chips sit beside the Natural/Tuned switch, whose width depends on the language
const fitContents = () => { $('contents').style.right = ($('mNatural').parentNode.offsetWidth + 20) + 'px'; };
function renderContents(){
  fitContents();
  $('contents').innerHTML = contents.map(id => { const s = sub(id); return `<span class="chip"><i style="background:${s.color}"></i>${esc(s.name)} <span class="f">${esc(s.formula)}</span></span>`; }).join('');
  document.querySelectorAll('.bottle').forEach(b => b.classList.toggle('in', contents.includes(b.dataset.add)));
}
function renderStats(){
  $('discN').textContent = discCount(); $('discT').textContent = REAL.length;
  $('coinN').textContent = P ? P.getCoins() : 0;
}

// ---------------------------------------------------------------- matching
function findRule(list, x, inBeaker){
  for (const c of inBeaker) for (const r of list) {
    if (!r.mix) continue;
    const [g1, g2] = r.mix;
    if ((isA(x, g1) && isA(c, g2)) || (isA(x, g2) && isA(c, g1))) return { r, c };
  }
  return null;
}

// ---------------------------------------------------------------- adding, heating, emptying
function addSubstance(id){
  A.resume();
  const s = sub(id); if (!s) return;
  if (contents.includes(id)) { toast(`${esc(s.name)} is already in the beaker.`); return; }
  if (contents.length >= MAX_IN) { toast('The beaker is full. Tap Empty to start again.'); return; }
  fx.addSubstance(s);
  A.sfx(s.kind === 'liquid' || s.kind === 'indicator' ? 'pour' : 'clink');
  const hit = findRule(D.REACTIONS, id, contents);
  if (hit) { setTimeout(() => runReaction(hit.r, [hit.c, id]), 550); return; }
  contents.push(id); renderContents();
  const none = findRule(D.NOTHING, id, contents.filter(c => c !== id));
  if (none) { setTimeout(() => nothing(none.r), 500); }
  else toast(`<b>${esc(s.name)}</b> <span class="muted">${esc(s.formula)}</span>`, 1600);
  setHum(humForContents(), false);
  if (!none) A.natural(hum.partials, 2.6);
}

function heat(){
  A.resume();
  if (!contents.length) { toast('Add something to heat first.'); return; }
  fx.heat(true); $('bHeat').classList.add('on'); A.sfx('whoosh');
  clearTimeout(heatTimer); heatTimer = setTimeout(stopHeat, 5200);
  const hit = findRule(D.REACTIONS.filter(r => r.mix && r.mix.some(g => g.includes('heat'))), 'heat', contents);
  if (hit) { setTimeout(() => runReaction(hit.r, [hit.c]), 500); return; }
  const flameSub = contents.map(sub).find(s => s.flame);
  if (flameSub) { const r = D.REACTIONS.find(x => x.flameOf === flameSub.flame); setTimeout(() => runReaction(r, [], flameSub), 500); return; }
  const none = findRule(D.NOTHING, 'heat', contents);
  if (none) setTimeout(() => nothing(none.r), 600);
  else toast('It just gets warm. Nothing here reacts to heat on its own.');
}
function stopHeat(){ fx.heat(false); $('bHeat').classList.remove('on'); }

function empty(){
  contents = []; fx.reset(); A.stop(); stopHeat(); hum = null; renderContents(); setHum(null); toast('Clean beaker.', 1200);
}

function runReaction(r, used, flameSub){
  if (!r.flameOf) {
    contents = contents.filter(c => !used.includes(c));
    for (const id of r.makes || []) { const s = sub(id); if (s && s.kind !== 'gas' || id === 'h2o2mix') if (!contents.includes(id)) contents.push(id); }
    contents = contents.slice(-MAX_IN);
  }
  renderContents();
  if (r.fx) fx.react(r.fx);
  if (r.quiet) { toast(esc(r.what), 4200); setHum(humForContents(), false); A.natural(hum.partials, 3); return; }
  const fresh = !SV.disc[r.id];
  const before = [0, 1, 2].map(unlocked);
  if (fresh) { SV.disc[r.id] = Date.now(); save(); if (P) { P.addCoins(COINS_NEW, GAME_ID); P.submitScore(GAME_ID, discCount()); } }
  const m = M.forReaction(r);
  setHum({ title: r.name, partials: m.partials, arr: m.arr, code: m.code, reaction: r, flameSub }, true);
  if (r.fx && (r.fx.shock || r.fx.flash)) A.sfx('boom'); else if (r.fx && (r.fx.bubbles || r.fx.foam)) A.sfx('fizz');
  setTimeout(() => play(SV.mode), r.fx && r.fx.shock ? 450 : 150);
  renderStats();
  const nowUnlocked = [0, 1, 2].findIndex((u, i) => u && !before[i]);
  setTimeout(() => {
    if (!hum || hum.reaction !== r) return;          // the beaker was emptied in the meantime
    openResult(r, fresh, used.concat(flameSub ? [flameSub.id] : []));
    if (nowUnlocked > 0) setTimeout(() => toast(F('New shelf unlocked: <b>{0}</b>', esc(T(D.TIERS[nowUnlocked].name))), 3500), 400);
  }, Math.min(2600, (r.fx && r.fx.dur || 3) * 350));
  renderShelf();
}
function nothing(n){
  const first = !SV.none[n.id]; SV.none[n.id] = 1; save();
  openSheet(`<span class="tag">Nothing new</span><h2 id="sheetTitle">${esc(n.name)}</h2><p>${esc(n.why)}</p>${first ? '<p class="muted">Saved in your Codex under “Nothing happened”.</p>' : ''}<div class="row"><button class="btn" data-close>OK</button></div>`, true);
}

// ---------------------------------------------------------------- the hum on the bench
function humForContents(){
  if (!contents.length) return null;
  const subs = contents.map(sub), els = [];
  subs.forEach(s => els.push(...s.els));
  const ps = M.humOfElements(els);
  return { title: subs.map(s => s.name).join(' + '), partials: ps, arr: M.arrange(ps, { name: 'MIXTURE' }), substance: subs.length === 1 ? subs[0] : null };
}
function setHum(h){ hum = h; fx.setHum(h ? h.partials : null); renderSpec(); }
function renderSpec(){
  $('specLabel').innerHTML = hum ? F('Hum of {0} · {1} lines · tap to dissect', `<em>${esc(hum.title)}</em>`, hum.partials.length) : esc(T('Add something to the beaker'));
}
function play(mode){
  if (!hum) return;
  if (mode === 'tuned') A.tuned(hum.arr, 2); else A.natural(hum.partials, 7);
}
let playingNm = null, level = 0;
A.on((what, x) => {
  $('bListen').classList.toggle('on', what !== 'stop');
  document.querySelectorAll('[data-play]').forEach(b => b.classList.toggle('on', what !== 'stop' && b.dataset.play === what));
  if (what === 'tuned') tunedViz = x; else if (what === 'stop') tunedViz = null;
});
let tunedViz = null;

// ---------------------------------------------------------------- sheets
let sheetOnClose = null;
function openSheet(html, short, onClose){
  $('sheetBody').innerHTML = html; $('sheet').dataset.view = '';
  $('sheet').classList.toggle('short', !!short);
  $('sheet').classList.remove('hidden'); $('scrim').classList.remove('hidden');
  $('sheet').scrollTop = 0; sheetOnClose = onClose || null;
  const k = $('sheetBody').querySelector('canvas.keys'); if (k) drawKeys(k);
}
function closeSheet(){ $('sheet').classList.add('hidden'); $('scrim').classList.add('hidden'); if (sheetOnClose) { const f = sheetOnClose; sheetOnClose = null; f(); } }

const noteChip = p => `<span class="note" style="border-color:${rgbCss(p.nm)}">${M.noteLabel(p.near)}<span class="muted">${p.cents >= 0 ? '+' : '−'}${Math.abs(p.cents)}¢</span></span>`;
const rgbCss = nm => { const c = FXL.nmToRGB(nm); return `rgb(${c[0]},${c[1]},${c[2]})`; };
function hazardsOf(ids){ const hz = [...new Set(ids.map(sub).filter(s => s && s.hazard).map(s => `<span>${esc(s.name)}</span>: <span>${esc(s.hazard)}</span>`))]; return hz.length ? `<div class="hazard"><b>In a real lab</b><br>${hz.join('<br>')}</div>` : ''; }

function soundBlock(){
  const h = hum, r = h.reaction;
  const src = r && r.emit ? 'Heard from the light this reaction gives off.' : r ? 'Heard from the atoms in what it made' + (h.partials.some(p => p.absorbed) ? ', plus the colour it absorbs.' : '.') : 'Heard from the atoms in it.';
  return `<div class="sound"><div class="src">${T(src)} ${T('Each line’s frequency is divided by 2<sup>40</sup> (40 octaves down).')}</div>
    <div class="notes">${h.partials.map(noteChip).join('')}</div>
    <div class="muted" style="font-size:13px">Tuned: <b>${esc(h.arr.keyName)}</b> · ${h.arr.chordNames.map(esc).join(' – ')}</div>
    <div class="row"><button class="btn primary" data-play="natural">▶ Natural</button><button class="btn primary" data-play="tuned">▶ Tuned</button><button class="btn" data-dissect>Dissect the sound</button></div>
    ${exportRow()}</div>`;
}
function exportRow(){
  return `<div class="row"><button class="btn small" data-send="jamjar">Send to Jam Jar</button><button class="btn small" data-send="chordfall">Send to Chordfall</button>
    <button class="btn small" data-file="mid">Save MIDI</button><button class="btn small" data-file="wav">Save natural WAV</button><button class="btn small" data-copy>Copy tune code</button></div>`;
}

function openResult(r, fresh, usedIds){
  const t = D.TYPES[r.type];
  openSheet(`<span class="tag">${esc(t.name)}</span>${fresh ? `<span class="new">New discovery · +${COINS_NEW} coins</span>` : ''}
    <h2 id="sheetTitle">${esc(r.name)}</h2>
    <div class="eq">${esc(r.eq)}</div>
    <h3>What you see</h3><p>${esc(r.what)}</p>
    <h3>Why</h3><p>${esc(r.why)}</p>
    ${hazardsOf(usedIds || [])}
    ${soundBlock()}`, false);
}

function openInfo(id){
  const s = sub(id), m = M.forSubstance(s);
  setHum({ title: s.name, partials: m.partials, arr: m.arr, code: TC.encode(m.arr.tune), substance: s }, false);
  const els = [...new Set(s.els)].map(e => D.ELEMENTS[e]).filter(Boolean);
  openSheet(`<span class="tag">${esc(['Kitchen', 'School lab', 'Advanced lab'][s.tier] || 'Product')}</span>
    <h2 id="sheetTitle">${esc(s.name)} <span class="muted" style="font-weight:500">${esc(s.formula)}</span></h2>
    <p>${esc(s.about)}</p>
    ${s.hazard ? `<div class="hazard"><b>In a real lab</b><br>${esc(s.hazard)}</div>` : ''}
    <h3>Made of</h3>${els.map(e => `<p><b>${esc(e.name)}</b> <span class="muted">(${e.Z})</span>: <span>${esc(e.about)}</span></p>`).join('')}
    ${soundBlock()}
    <div class="row"><button class="btn" data-add="${s.id}">Add to beaker</button></div>`, false);
}

function openDissect(){
  if (!hum) { toast('Add something first, then tap here to take its sound apart.'); return; }
  const h = hum, a = h.arr, bt = M.beats(h.partials);
  const rows = h.partials.map(p => `<tr${p.absorbed ? ' class="dash"' : ''}><td class="s"><span class="sw" style="background:${rgbCss(p.nm)}"></span>${esc(srcName(p))}</td>
    <td>${p.nm.toFixed(p.nm % 1 ? 2 : 0)} nm${p.nm < 380 ? ' <span class="muted">UV</span>' : p.nm > 750 ? ' <span class="muted">IR</span>' : ''}</td><td class="thz">${p.thz.toFixed(1)} THz</td><td>${p.hz.toFixed(2)} Hz</td>
    <td>${M.noteLabel(p.near)} ${p.cents >= 0 ? '+' : '−'}${Math.abs(p.cents)}¢</td><td>${M.noteLabel(p.tuned)}</td></tr>`).join('');
  const ex = h.partials[0];
  openSheet(`<span class="tag">Dissect</span><h2 id="sheetTitle">${esc(h.title)}</h2>
    <p class="muted">Every line below is a real wavelength of light. Its frequency is the speed of light divided by the wavelength; divide that by 2<sup>40</sup> and it lands in hearing range, still the same note, 40 octaves lower.</p>
    <div class="math">${ex.nm.toFixed(2)} nm → ${ex.thz.toFixed(2)} THz ÷ 2⁴⁰ = ${ex.hz.toFixed(2)} Hz ≈ ${M.noteLabel(ex.near)} ${ex.cents >= 0 ? '+' : '−'}${Math.abs(ex.cents)} ${T('cents')}</div>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>From</th><th>Light</th><th class="thz">Frequency</th><th>Sound</th><th>Natural</th><th>Tuned</th></tr></thead><tbody>${rows}</tbody></table></div>
    <canvas class="keys" aria-label="Piano keys: dots are the natural tones, lit keys are the tuned notes"></canvas>
    <p class="muted" style="font-size:12.5px">Dots show the natural tones exactly, often between two keys. Lit keys are the tuned notes. A cent is a hundredth of a semitone.</p>
    ${bt.length ? `<h3>Beats</h3>${bt.slice(0, 3).map(b => `<p>${b.hz < 1
      ? F('{0} {1} nm and {2} nm are only {3} Hz apart, so together they throb about once every {4} seconds instead of sounding like two notes.', esc(T(srcName(b.a))), b.a.nm, b.b.nm, b.hz.toFixed(2), (1 / b.hz).toFixed(1))
      : F('{0} {1} nm and {2} nm are only {3} Hz apart, so together they throb {4} times a second instead of sounding like two notes.', esc(T(srcName(b.a))), b.a.nm, b.b.nm, b.hz.toFixed(2), b.hz.toFixed(1))}</p>`).join('')}` : ''}
    <h3>How the tuned version is made</h3>
    <p>${T('1. Each tone moves to its nearest piano key (shown in “Natural”).')}<br>${F('2. The key that holds the most of them, weighted by brightness, is <b>{0}</b>.', esc(T(a.keyName)))}<br>
    ${a.moved.length ? F('3. {0} to fit the key.', a.moved.map(x => F('{0} moves to {1}', M.noteLabel(x.p.near), M.noteLabel(x.to))).join(', ')) : T('3. Every tone already fits the key, so nothing moves.')}${a.borrowed && a.borrowed.length ? ' ' + F('With so few lines, the melody borrows {0} from the home chord.', a.borrowed.map(M.noteLabel).join(T(' and '))) : ''}<br>
    ${F('4. The chords are the four from that key that hold the most melody notes: <b>{0}</b>.', a.chordNames.map(esc).join(' – '))}<br>${T('5. The melody climbs from the reddest line to the most violet and back.')}</p>
    <div class="row"><button class="btn primary" data-play="natural">▶ Natural</button><button class="btn primary" data-play="tuned">▶ Tuned</button></div>
    ${exportRow()}`, false);
  $('sheet').dataset.view = 'dissect';
}
const srcName = p => p.absorbed ? p.src : (D.ELEMENTS[p.src] ? D.ELEMENTS[p.src].name : p.src);

function drawKeys(cv){
  if (!hum) return;
  const c = cv.getContext('2d'), DPR = Math.min(2, window.devicePixelRatio || 1), r = cv.getBoundingClientRect();
  const W = r.width, H = r.height; cv.width = W * DPR; cv.height = H * DPR; c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const ms = hum.partials.map(p => p.midi).concat(hum.partials.map(p => p.tuned));
  const lo = Math.floor((Math.min(...ms) - 2) / 12) * 12, hi = Math.max(lo + 24, Math.ceil((Math.max(...ms) + 2) / 12) * 12);
  const whites = []; for (let m = lo; m < hi; m++) if (![1, 3, 6, 8, 10].includes(m % 12)) whites.push(m);
  const kw = W / whites.length, top = 20, kh = H - top - 2;
  const xOf = m => { // continuous x for any (fractional) midi number
    const f = Math.floor(m), fr = m - f, x0 = keyX(f), x1 = keyX(f + 1); return x0 + (x1 - x0) * fr; };
  const keyX = m => { const pc = m % 12, wi = whites.indexOf(m); if (wi >= 0) return (wi + 0.5) * kw; return whites.indexOf(m - 1) * kw + kw; };
  const tuned = new Set(hum.partials.map(p => p.tuned));
  whites.forEach((m, i) => { c.fillStyle = tuned.has(m) ? '#5ef0ff' : '#e8eeff'; c.fillRect(i * kw + 1, top, kw - 2, kh); });
  for (let m = lo; m < hi; m++) if ([1, 3, 6, 8, 10].includes(m % 12)) { const x = keyX(m); c.fillStyle = tuned.has(m) ? '#2fb7c7' : '#1a2036'; c.fillRect(x - kw * 0.3, top, kw * 0.6, kh * 0.6); }
  c.font = '600 9px system-ui'; c.fillStyle = '#5a6688'; whites.forEach((m, i) => { if (m % 12 === 0) c.fillText('C' + (m / 12 - 1), i * kw + 3, top + kh - 4); });
  hum.partials.forEach(p => { const x = xOf(p.midi); c.fillStyle = rgbCss(p.nm); c.beginPath(); c.arc(x, 10, 5, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(255,255,255,.5)'; c.stroke(); c.fillRect(x - 0.5, 14, 1, top - 12); });
}

// ---------------------------------------------------------------- Codex and lessons
let codexTab = 'all';
function openCodex(){
  const n = discCount(), groups = Object.keys(D.TYPES);
  const list = codexTab === 'none' ? null : REAL.filter(r => codexTab === 'all' || r.type === codexTab);
  const entry = r => SV.disc[r.id]
    ? `<button class="entry" data-replay="${r.id}"><b>${esc(r.name)}</b><small>${esc(r.eq)}</small></button>`
    : `<button class="entry unk" data-hint="${r.id}"><b>? ? ?</b><small class="hint">${esc(D.TYPES[r.type].name)} · tap for a hint</small></button>`;
  const body = codexTab === 'none'
    ? (D.NOTHING.filter(x => SV.none[x.id]).map(x => `<div class="entry"><b>${esc(x.name)}</b><small class="hint">${esc(x.why)}</small></div>`).join('') || '<p class="muted">Things that meet and do not react will be listed here, with the reason.</p>')
    : list.map(entry).join('');
  openSheet(`<span class="tag">Codex</span><h2 id="sheetTitle">${n} of ${REAL.length} reactions</h2>
    <div class="prog"><i style="width:${(100 * n / REAL.length).toFixed(1)}%"></i></div>
    <div class="seg" role="tablist"><button role="tab" data-ctab="all" aria-selected="${codexTab === 'all'}">All</button>${groups.map(g => `<button role="tab" data-ctab="${g}" aria-selected="${codexTab === g}">${esc(D.TYPES[g].name)} <span class="muted">${REAL.filter(r => r.type === g && SV.disc[r.id]).length}/${REAL.filter(r => r.type === g).length}</span></button>`).join('')}<button role="tab" data-ctab="none" aria-selected="${codexTab === 'none'}">Nothing happened</button></div>
    ${codexTab !== 'all' && codexTab !== 'none' ? `<p class="typeabout">${esc(D.TYPES[codexTab].about)}</p>` : ''}
    <div class="entries">${body}</div>
    <h3>Your profile</h3><p class="muted" style="font-size:13.5px">Coins you earn here are shared with every Known Quantity game. Move them to another game with a profile code.</p>
    <div class="row"><button class="btn small" data-profile>Move profile</button></div>
    <footer class="fine">Spectral lines: NIST Atomic Spectra Database. © Known Quantity LLC</footer>`, false);
  $('sheet').dataset.view = 'codex';
}

const LESSONS = [
  ['Atoms and light', `<p>Electrons in an atom can only sit at certain energy levels, like rungs on a ladder. Give an atom energy (heat it, or run electricity through it) and an electron jumps up a rung. When it falls back, it gives the energy away as light.</p>
    <p>Each fall is a fixed amount of energy, so it makes light of one exact wavelength. Every element has its own set of rungs, so every element has its own set of colours: its <b>emission spectrum</b>. It is as unique as a fingerprint.</p>
    <div class="fact">This is how we know what the Sun and distant stars are made of. Helium was discovered in sunlight in 1868, 27 years before anyone found it on Earth.</div>
    <div class="row"><button class="btn" data-demo="H">▶ Hear hydrogen</button><button class="btn" data-demo="Na">▶ Hear sodium</button></div>`],
  ['Light into sound', `<p>Light is a wave, and its frequency is how many times it wiggles each second: hundreds of trillions of times. Sound waves we can hear wiggle between 20 and 20,000 times a second.</p>
    <p>Musicians call a doubling of frequency an <b>octave</b>, and two notes an octave apart share a name. So we halve each line’s frequency 40 times. It is still the same note, just 40 octaves lower.</p>
    <div class="math">656.28 nm → 456.7 THz ÷ 2⁴⁰ = 415.3 Hz = G♯4</div>
    <div class="fact">All of visible light, from violet (380 nm) to red (750 nm), fits inside a single octave. Our eyes see one octave of light; our ears hear about ten octaves of sound.</div>`],
  ['Natural or tuned', `<p><b>Natural</b> plays each line at its exact frequency, as pure tones. Nature does not use a piano, so many of them fall between two keys. The gap is measured in <b>cents</b>: 100 cents make a semitone.</p>
    <p><b>Tuned</b> is an arrangement. Each tone moves to the nearest piano key, the game finds the key (like E major) that holds most of them, nudges any that do not fit, and builds chords and a melody out of them. The Dissect screen shows every step.</p>
    <div class="fact">When two lines are very close, like sodium’s two yellow lines, you hear a slow throb called a beat. Piano tuners listen for exactly that.</div>`],
  ['Why things have colour', `<p>A flame test makes light, but most coloured things do the opposite: they <b>absorb</b> some colours and you see what is left. Copper sulfate absorbs orange-red light, so the light that gets through looks blue.</p>
    <p>For coloured products, the hum includes a voice at the colour that is absorbed. It is drawn as a dashed line on the spectrum.</p>
    <div class="fact">Pink is not in the rainbow. It is what white light looks like with the green taken out, which is exactly what phenolphthalein does in base.</div>`],
  ['Reading an equation', `<p>A chemical equation lists what goes in (reactants) on the left and what comes out (products) on the right. Atoms are never made or destroyed, only rearranged, so each side must have the same atoms.</p>
    <div class="math">2Na + 2H₂O → 2NaOH + H₂</div>
    <p>Left: 2 sodium, 4 hydrogen, 2 oxygen. Right: 2 sodium, 2 + 2 = 4 hydrogen, 2 oxygen. Balanced. The big numbers count molecules; the small ones count atoms inside a molecule. A ↓ means a solid falls out of the solution.</p>`],
  ['Staying safe', `<p>This lab is a simulation, and many of these reactions are dangerous for real: alkali metals, thermite, concentrated acids and the lead, silver and barium salts should only ever be handled by trained people with the right equipment. A <b>!</b> on a bottle marks a hazard.</p>
    <p>The kitchen shelf is safe with an adult around: the volcano, the cabbage indicator and yeast with 3% peroxide are classic home experiments. Wear eye protection anyway.</p>
    <div class="fact">Never mix household cleaners. Bleach with ammonia, or bleach with acid cleaners, makes toxic gas.</div>`]
];
let lessonI = 0;
function openLearn(){
  const [title, html] = LESSONS[lessonI];
  openSheet(`<span class="tag">Learn</span><h2 id="sheetTitle">${esc(title)}</h2>
    <div class="seg" role="tablist">${LESSONS.map((l, i) => `<button role="tab" data-lesson="${i}" aria-selected="${i === lessonI}">${i + 1}. ${esc(T(l[0]))}</button>`).join('')}</div>
    <div class="lesson">${html}</div>
    <div class="row">${lessonI > 0 ? '<button class="btn" data-lesson="' + (lessonI - 1) + '">Back</button>' : ''}${lessonI < LESSONS.length - 1 ? '<button class="btn primary" data-lesson="' + (lessonI + 1) + '">Next</button>' : '<button class="btn primary" data-close>Start mixing</button>'}</div>`, false);
  $('sheet').dataset.view = 'learn';
}

function openProfile(){
  if (!P) { toast('Profile is not available here.'); return; }
  openSheet(`<span class="tag">Profile</span><h2 id="sheetTitle">Move your profile</h2>
    <p class="muted">Copy this code here and paste it into another Known Quantity game to carry your coins and best scores over. Importing adds; it never erases.</p>
    <textarea id="pfCode" rows="3" readonly>${esc(P.exportCode())}</textarea><div class="row"><button class="btn small" data-pcopy>Copy code</button></div>
    <h3>Paste a code</h3><textarea id="pfIn" rows="3" placeholder="KQ1:..."></textarea><div class="row"><button class="btn small" data-pimport>Import</button></div><p id="pfMsg" class="muted"></p>`, false);
}

function welcome(){
  openSheet(`<span class="tag">Welcome</span><h2 id="sheetTitle">Every element has a chord</h2>
    <p>Atoms give off light at exact colours, their spectral lines. Move that light down 40 octaves and you can hear it.</p>
    <p>Tap bottles to add them to the beaker, try <b>Heat</b>, and watch what happens. Each reaction you discover plays the music hidden in its light: <b>Natural</b> is the raw tones, <b>Tuned</b> is an arrangement you can send to Jam Jar or Chordfall.</p>
    <p class="muted">Start in the kitchen: try vinegar with baking soda.</p>
    <div class="row"><button class="btn primary" data-close>Open the lab</button><button class="btn" data-learn>How it works</button></div>`, true, () => { SV.welcomed = true; save(); });
}

// ---------------------------------------------------------------- links out: Jam Jar, Chordfall, any music app
const Links = (() => {
  const C = window.Capacitor, native = !!(C && C.isNativePlatform && C.isNativePlatform()), platform = native && C.getPlatform ? C.getPlatform() : 'web';
  const plugin = n => { try { if (!native || (C.isPluginAvailable && !C.isPluginAvailable(n))) return null; return (C.Plugins && C.Plugins[n]) ? C.Plugins[n] : C.registerPlugin(n); } catch (e) { return null; } };
  const Launcher = plugin('AppLauncher');
  return { native, async open(url, pkg){ if (!Launcher) return false; try { const can = await Launcher.canOpenUrl({ url: platform === 'android' ? pkg : url }); if (!can || !can.value) return false; const r = await Launcher.openUrl({ url }); return !(r && r.completed === false); } catch (e) { return false; } } };
})();
async function copyText(text){
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (e) {}
  try { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-200px;left:0;opacity:0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return !!ok; } catch (e) { return false; }
}
const tuneCode = () => hum.code || TC.encode(hum.arr.tune);
const APPS = {
  jamjar: { name: 'Jam Jar', scheme: 'jamjar://tune/', pkg: 'com.gimblegaming.jamjar', web: '../jam-jar/', hash: '#tune=', how: 'In Jam Jar, tap Song, then Open a tune code, and paste it.' },
  chordfall: { name: 'Chordfall', scheme: 'chordfall://tune/', pkg: 'com.gimblegaming.chordfall', web: '../chordfall/', hash: '#tune=', how: 'In Chordfall, tap the + next to My tunes and paste it.' }
};
const siblingCache = {};
async function sibling(path){
  if (path in siblingCache) return siblingCache[path];
  try { const r = await fetch(path + 'index.html', { method: 'HEAD', cache: 'no-store' }); siblingCache[path] = r.ok; } catch (e) { siblingCache[path] = false; }
  return siblingCache[path];
}
async function sendTo(key){
  if (!hum) return;
  const a = APPS[key], code = tuneCode();
  if (await Links.open(a.scheme + code, a.pkg)) { toast(F('Opening {0}…', a.name)); return; }
  if (!Links.native && location.protocol.startsWith('http') && await sibling(a.web)) { A.stop(); location.href = a.web + a.hash + encodeURIComponent(code); return; }
  const ok = await copyText(code);
  toast(`${ok ? T('Tune code copied.') : F('Tune code: {0}.', esc(code))} ${T(a.how)}`, 6000);
}
async function saveFile(kind){
  if (!hum) return;
  const name = TC.titleName(hum.arr.tune.name) || 'Reaction';
  const bytes = kind === 'mid' ? M.midiFile(hum.arr, TC.tempoOf(hum.arr.tune.tempo)[2]) : M.wavOfNatural(hum.partials, 10);
  const type = kind === 'mid' ? 'audio/midi' : 'audio/wav', fname = `${name}${kind === 'wav' ? '-natural' : ''}.${kind}`;
  const blob = new Blob([bytes], { type });
  try {
    const file = new File([blob], fname, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iP(hone|ad|od)|Android/.test(navigator.userAgent)) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = fname; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast(kind === 'mid' ? F('Saved {0}. Open it in GarageBand, BandLab or any music app.', esc(fname)) : F('Saved {0}: the exact natural tones.', esc(fname)), 4500);
}

// ---------------------------------------------------------------- events
document.addEventListener('click', e => {
  const el = e.target.closest('button, [data-add]'); if (!el) return;
  const d = el.dataset;
  if (d.info) { e.stopPropagation(); openInfo(d.info); return; }
  if (d.add) { if (!$('sheet').classList.contains('hidden') && el.closest('#sheet')) closeSheet(); addSubstance(d.add); return; }
  if (d.tab != null) { SV.tab = +d.tab; save(); renderShelf(); return; }
  if (d.close != null) { closeSheet(); return; }
  if (d.play) { A.resume(); if (A.playing === d.play) A.stop(); else play(d.play); return; }
  if (d.dissect != null) { openDissect(); return; }
  if (d.send) { sendTo(d.send); return; }
  if (d.file) { saveFile(d.file); return; }
  if (d.copy != null) { copyText(tuneCode()).then(ok => toast(ok ? 'Tune code copied. Paste it into Jam Jar or Chordfall.' : esc(tuneCode()), 4000)); return; }
  if (d.replay) { const r = D.REACTIONS.find(x => x.id === d.replay), m = M.forReaction(r); setHum({ title: r.name, partials: m.partials, arr: m.arr, code: m.code, reaction: r }); openResult(r, false, []); return; }
  if (d.hint) { const r = D.REACTIONS.find(x => x.id === d.hint); el.querySelector('.hint').textContent = 'Hint: ' + r.hint; return; }
  if (d.ctab) { codexTab = d.ctab; openCodex(); return; }
  if (d.lesson != null) { lessonI = +d.lesson; openLearn(); return; }
  if (d.learn != null) { lessonI = 0; openLearn(); return; }
  if (d.demo) { const ps = M.humOfEmit(D.ELEMENTS[d.demo].lines, d.demo); setHum({ title: D.ELEMENTS[d.demo].name, partials: ps, arr: M.arrange(ps, { name: D.ELEMENTS[d.demo].name }) }); A.natural(ps, 6); return; }
  if (d.profile != null) { openProfile(); return; }
  if (d.pcopy != null) { copyText($('pfCode').value).then(ok => { $('pfMsg').textContent = ok ? 'Copied.' : 'Select the code and copy it.'; }); return; }
  if (d.pimport != null) { const r = P.importCode($('pfIn').value); $('pfMsg').textContent = r && r.ok !== false ? 'Imported. Coins and scores merged.' : 'That code did not work. Check it and try again.'; renderStats(); return; }
});
$('scrim').addEventListener('click', closeSheet);
$('bHeat').addEventListener('click', heat);
$('bEmpty').addEventListener('click', empty);
$('bListen').addEventListener('click', () => { A.resume(); if (A.playing) A.stop(); else if (hum) play(SV.mode); else toast('Add something to the beaker first.'); });
$('bCodex').addEventListener('click', openCodex);
$('bLearn').addEventListener('click', openLearn);
$('specbar').addEventListener('click', openDissect);
$('bMute').addEventListener('click', () => { SV.muted = !SV.muted; A.setMuted(SV.muted); $('bMute').setAttribute('aria-pressed', String(SV.muted)); save(); });
function setMode(m){ SV.mode = m; save(); $('mNatural').setAttribute('aria-checked', String(m === 'natural')); $('mTuned').setAttribute('aria-checked', String(m === 'tuned')); }
$('mNatural').addEventListener('click', () => { setMode('natural'); if (A.playing) play('natural'); });
$('mTuned').addEventListener('click', () => { setMode('tuned'); if (A.playing) play('tuned'); });
document.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('textarea,input')) return;
  if (e.key === 'Escape') closeSheet();
  else if (e.key === 'Enter' && e.target.dataset && e.target.dataset.add) addSubstance(e.target.dataset.add);
});
if (P && P.onChange) P.onChange(renderStats);
// a new language: redraw what was built from translated templates, and reopen the open sheet in the new language
if (window.KQI18n) window.KQI18n.onChange(() => {
  renderShelf(); renderSpec(); fitContents();
  const open = !$('sheet').classList.contains('hidden') && $('sheetTitle') && $('sheet').dataset.view;
  if (open === 'dissect') openDissect(); else if (open === 'learn') openLearn(); else if (open === 'codex') openCodex();
});
window.addEventListener('resize', () => { fx.resize(); fitContents(); });

// ---------------------------------------------------------------- frame loop
let last = performance.now();
function frame(now){
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const target = A.playing ? 1 : 0; level += (target - level) * Math.min(1, dt * 4);
  fx.setHumLevel(level);
  playingNm = null;
  if (tunedViz && hum && A.ctx) { // light up the line whose note is sounding
    const tt = A.ctx.currentTime, n = tunedViz.notes.find(x => tt >= x.at && tt < x.at + x.len);
    if (n) { const p = hum.partials.find(q => q.tuned === n.m); if (p) playingNm = p.nm; }
  }
  fx.update(dt); fx.draw();
  FXL.drawSpectrum($('spec'), hum ? hum.partials : null, level, playingNm);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- start
A.setMuted(SV.muted); $('bMute').setAttribute('aria-pressed', String(SV.muted));
setMode(SV.mode === 'tuned' ? 'tuned' : 'natural');
if (!unlocked(SV.tab)) SV.tab = 0;
renderShelf(); renderContents(); renderStats(); renderSpec();
requestAnimationFrame(frame);
if (!SV.welcomed) setTimeout(welcome, 300);

// test hooks
window.CC = { SV, get contents(){ return contents; }, get hum(){ return hum; }, addSubstance, heat, empty, openDissect, openCodex, openLearn, fx, REAL, sendTo, saveFile };
})();
