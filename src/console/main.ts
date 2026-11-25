import '../shared/fonts-ui';
import '../shared/app.css';
import { createBus, rid } from '../shared/bus';
import { store, onStoreChange, type Run, type RunEvent } from '../shared/store';
import type { Cue, EngineId, ServerConfig } from '../shared/types';
import { DEMO_LINES, SAMPLE_BRAIN, SAMPLE_TALK } from '../shared/sample';
import { buildBrain, type BrainIndex } from '../engine/brain';
import { directRules, photoQuery, type DirectorCtx } from '../engine/director';
import { clean, lookupFx, STOP, tokens } from '../engine/words';
import { deepgramEars, hasWebSpeech, webSpeechEars, type Ears } from '../engine/ears';
import { iconFor, iconSvg } from '../engine/icons';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const bus = createBus('console');
const toast = (t: string, ms = 4200) => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout((e as any)._t); (e as any)._t = setTimeout(() => e.classList.remove('on'), ms); };

/* ---------- state ---------- */
if (!store.brain().length && !store.talk().chapters.length) { store.setBrain(SAMPLE_BRAIN()); store.setTalk(SAMPLE_TALK()); }
let settings = store.settings();
let talk = store.talk();
let brain: BrainIndex = buildBrain();
let cfg: ServerConfig = { llm: false, pexels: false, images: false, deepgram: false, lanUrls: [] };
const ctx: DirectorCtx = { brain, years: new Set(), lastIconAt: 0, muted: store.mutes() };
let heroWords = new Set<string>();
const refreshKnowledge = () => {
  settings = store.settings(); talk = store.talk(); brain = buildBrain(); ctx.brain = brain; ctx.muted = store.mutes();
  heroWords = new Set([...brain.names, ...tokens(talk.title)]);
  beats = talk.chapters.map((c) => ({ title: c.title, kw: [...new Set(tokens(c.text + ' ' + c.title))] }));
  $('#talkTitle').textContent = talk.title;
  renderChapters(); renderToggles();
  bus.send({ type: 'style', style: talk.style });
};
let beats: { title: string; kw: string[] }[] = [];
let chapterIdx = -1, heard: string[] = [];
const queue: Cue[] = [];
const pending = new Map<string, { t0: number; title: string; source: string; kind: 'word' | 'scene' }>();
const speeds: { source: string; ms: number }[] = [];
let run: Run | null = null;
let cleared = false;
let lastPhotoAt = 0;

/* ---------- engine toggles ---------- */
function renderToggles() {
  document.querySelectorAll<HTMLButtonElement>('[data-engine]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.engine === settings.engine)));
  const sb = $('#safeBtn'); sb.setAttribute('aria-pressed', String(settings.safe)); sb.textContent = settings.safe ? 'Safe mode on' : 'Safe mode off';
  sb.style.background = settings.safe ? 'var(--good)' : ''; sb.style.color = settings.safe ? '#121015' : '';
  const rb = $('#reviewBtn'); rb.setAttribute('aria-pressed', String(settings.review)); rb.textContent = settings.review ? 'Review first' : 'Auto-show';
  $('#queueNote').textContent = settings.review ? 'Nothing big shows until you press Show (Enter)' : settings.safe ? 'Safe mode: no AI-made visuals' : 'Showing automatically. Switch to Review first to approve each one.';
  const paid = settings.engine === 'paid';
  $('#earsName').textContent = paid ? (cfg.deepgram ? 'Ears: Deepgram Nova-3' : 'Ears: Chrome speech (no Deepgram key)') : 'Ears: Chrome speech';
}
const saveSettings = () => { store.setSettings(settings); renderToggles(); };
document.querySelectorAll<HTMLButtonElement>('[data-engine]').forEach((b) => b.addEventListener('click', () => {
  if (ears?.running()) { toast('Stop the mic before switching engines.'); return; }
  settings.engine = b.dataset.engine as EngineId; saveSettings();
  if (settings.engine === 'paid') {
    const missing = [!cfg.deepgram && 'speech', !cfg.llm && 'director', !cfg.images && 'images', !cfg.pexels && 'photos'].filter(Boolean);
    if (missing.length) toast(`Paid engine: no server key for ${missing.join(', ')} yet, so those parts stay free. See README › Keys.`, 6500);
  }
}));
$('#safeBtn').addEventListener('click', () => { settings.safe = !settings.safe; saveSettings(); });
$('#reviewBtn').addEventListener('click', () => { settings.review = !settings.review; saveSettings(); renderQueue(); });

/* ---------- stage control ---------- */
function toggleClear() {
  cleared = !cleared;
  bus.send({ type: cleared ? 'clear' : 'restore' });
  const b = $('#clearBtn'); b.textContent = cleared ? 'Bring visuals back (K)' : 'Clear screen (K)';
  b.classList.toggle('r', !cleared); b.classList.toggle('g', cleared);
  status();
}
$('#clearBtn').addEventListener('click', toggleClear);
$('#stageBtn').addEventListener('click', () => {
  const w = window.open('/stage.html', 'voxink-stage', 'popup,width=1280,height=720');
  if (!w) toast('Your browser blocked the pop-up. Open /stage.html in a new window and drag it to the projector.');
  setTimeout(() => bus.send({ type: 'style', style: talk.style }), 900);
});

/* ---------- sending things to the stage ---------- */
function sendWord(text: string, fx: string, t0: number) {
  const id = rid();
  pending.set(id, { t0, title: text, source: 'word', kind: 'word' });
  bus.send({ type: 'word', id, text, fx, t0 });
}
function showCue(c: Cue) {
  pending.set(c.id, { t0: c.t0, title: c.title, source: c.source, kind: 'scene' });
  bus.send({ type: 'scene', cue: c });
  renderNow(c);
}
function dispatch(c: Cue) {
  if (settings.safe && (c.source === 'ai' || c.source === 'llm')) return;
  if (settings.review) { queue.push(c); renderQueue(); status(); return; }
  showCue(c);
}
function renderNow(c: Cue) {
  $('#nowMeta').textContent = `${c.scene.kind} · from ${c.source}`;
  const s = c.scene;
  const body = s.kind === 'icon' ? `${iconSvg(s.icon, 'width="72" height="72" fill="#ffd400"')}<div>${esc(s.label)}</div>`
    : s.kind === 'photo' || s.kind === 'ai' ? `<img src="${esc(s.url)}" alt="" style="max-width:100%;max-height:180px;border:3px solid #000">`
    : `<div style="font-family:Bungee,sans-serif;font-size:28px;color:#f4ecdc">${esc(c.title)}</div>`;
  $('#nowCard').innerHTML = body;
}

bus.on((m) => {
  if (m.type === 'shown') {
    const p = pending.get(m.id); if (!p) return;
    pending.delete(m.id);
    const ms = Math.max(0, m.at - p.t0);
    speeds.push({ source: p.kind === 'word' ? 'word art' : p.source, ms }); if (speeds.length > 200) speeds.shift();
    if (run && p.kind === 'scene') run.events.push({ title: p.title, source: p.source, latency: ms, late: ms > 1500 });
    renderSpeed();
  }
  if (m.type === 'remote') {
    if (m.action === 'clear') toggleClear();
    if (m.action === 'show') showFirst();
    if (m.action === 'skip') skipFirst();
    if (m.action === 'next') goChapter(chapterIdx + 1);
    if (m.action === 'prev') goChapter(chapterIdx - 1);
  }
  if (m.type === 'hello' && m.role === 'stage') { bus.send({ type: 'style', style: talk.style }); if (chapterIdx >= 0) bus.send({ type: 'chapter', n: chapterIdx + 1, title: beats[chapterIdx].title }); }
  if (m.type === 'hello' && m.role === 'remote') status();
});

/* ---------- queue ---------- */
const SRC_COLOR: Record<string, string> = { brain: '#3dffa0', rules: '#f4ecdc', icon: '#8fe9ff', photo: '#ffd400', ai: '#ff9fd0', '3d': '#c7b8ff', llm: '#ffb86b' };
function renderQueue() {
  const ul = $('#queue');
  if (!queue.length) { ul.innerHTML = `<li class="muted">${settings.review ? 'Visuals wait here for your OK.' : 'Empty. Visuals are going straight to the stage.'}</li>`; return; }
  ul.innerHTML = queue.map((c, i) => `<li class="item row"><span class="badge" style="background:${SRC_COLOR[c.source] || '#f4ecdc'}">${esc(c.source)}</span><span style="flex:1 1 200px">${esc(c.title)}</span><button type="button" class="btn y" data-show="${i}">Show</button><button type="button" class="btn ghost" data-skip="${i}">Skip</button></li>`).join('');
}
$('#queue').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.dataset.show) { const [c] = queue.splice(+t.dataset.show, 1); if (c) { c.t0 = Date.now(); showCue(c); } renderQueue(); status(); }
  if (t.dataset.skip) { const [c] = queue.splice(+t.dataset.skip, 1); if (c && run) run.events.push({ title: c.title, source: c.source, latency: 0, skipped: true }); renderQueue(); status(); }
});
const showFirst = () => { const c = queue.shift(); if (c) { c.t0 = Date.now(); showCue(c); } renderQueue(); status(); };
const skipFirst = () => { const c = queue.shift(); if (c && run) run.events.push({ title: c.title, source: c.source, latency: 0, skipped: true }); renderQueue(); status(); };

/* ---------- chapters ---------- */
function renderChapters() {
  const ol = $('#chapters');
  if (!beats.length) { ol.innerHTML = `<li class="muted">No chapters. Add them in <a href="/#talk">Studio</a>, or just talk freely.</li>`; return; }
  ol.innerHTML = beats.map((b, i) => `<li><button type="button" data-ch="${i}" class="btn ${i === chapterIdx ? 'y' : 'ghost'}" style="width:100%;justify-content:flex-start;box-shadow:none"><span style="font-family:Bungee,sans-serif">${String(i + 1).padStart(2, '0')}</span> ${esc(b.title)}${i < chapterIdx ? ' · done' : i === chapterIdx ? ' · now' : ''}</button></li>`).join('');
}
$('#chapters').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-ch]') as HTMLElement; if (b) goChapter(+b.dataset.ch!); });
function goChapter(i: number) {
  if (i < 0 || i >= beats.length || i === chapterIdx) return;
  chapterIdx = i; heard = [];
  bus.send({ type: 'chapter', n: i + 1, title: beats[i].title });
  renderChapters(); status();
}
function matchChapter(text: string) {
  if (!beats.length) return;
  heard = heard.concat(tokens(text)).slice(-30);
  const h = new Set(heard);
  for (let j = chapterIdx + 1; j <= Math.min(chapterIdx + 2, beats.length - 1); j++) {
    const kw = beats[j].kw; if (!kw.length) continue;
    const hits = kw.filter((k) => h.has(k)).length;
    if (hits >= Math.min(3, Math.max(1, Math.ceil(kw.length * 0.2)))) { goChapter(j); return; }
  }
}

/* ---------- speed panel ---------- */
function renderSpeed() {
  const by = new Map<string, number[]>();
  speeds.slice(-80).forEach((s) => by.set(s.source, [...(by.get(s.source) || []), s.ms]));
  const rows = [...by].map(([k, v]) => ({ k, avg: v.reduce((a, b) => a + b, 0) / v.length, n: v.length })).sort((a, b) => a.avg - b.avg);
  const max = Math.max(1500, ...rows.map((r) => r.avg));
  $('#speed').innerHTML = rows.length ? rows.map((r) => `<div style="margin-bottom:10px"><div class="row" style="justify-content:space-between;font-size:14px"><span>${esc(r.k)} <span class="muted">×${r.n}</span></span><b class="${r.avg > 1500 ? 'err' : r.avg > 800 ? 'warn' : 'ok'}">${Math.round(r.avg)} ms</b></div><div style="height:10px;background:var(--line)"><div style="height:10px;width:${(r.avg / max) * 100}%;background:${r.avg > 1500 ? 'var(--bad)' : 'var(--good)'}"></div></div></div>`).join('')
    : '<p class="muted" style="margin:0">Start the mic or the demo to measure.</p>';
}

/* ---------- the pipeline ---------- */
const fired = new Map<string, number>();
let finals: string[] = [], lastPlain = 0, wordCount = 0;
function caption(t: string, isFinal: boolean) {
  if (isFinal) { finals = finals.concat(t.trim().split(/\s+/)).slice(-16); bus.send({ type: 'caption', final: finals.join(' '), interim: '' }); }
  else bus.send({ type: 'caption', final: finals.slice(-8).join(' '), interim: t.trim() });
}
function processWord(raw: string, t0: number) {
  const w = clean(raw); if (!w || /^[\d,.%]+$/.test(w)) return;
  wordCount++;
  const l = w.toLowerCase();
  if (ctx.muted[l]) return;
  const fx = lookupFx(w);
  if (fx) return sendWord(w, fx, t0);
  if (heroWords.has(l)) return sendWord(brain.displayNames.get(l) || w, 'hero', t0);
  if (w.length >= 7 && !STOP.has(l) && t0 - lastPlain > 1600) { lastPlain = t0; sendWord(w, 'plain', t0); }
}
function addTranscript(text: string) {
  const p = document.createElement('p'); p.style.margin = '0 0 8px';
  p.innerHTML = esc(text).replace(/\b([\w']+)\b/g, (m) => heroWords.has(m.toLowerCase()) ? `<mark style="background:#ffd400;color:#121015;padding:0 3px">${m}</mark>` : m);
  const box = $('#transcript'); box.appendChild(p); box.scrollTop = box.scrollHeight;
}

async function smartLayer(sentence: string, t0: number, rulesHit: boolean) {
  const paid = settings.engine === 'paid';
  const useLLM = cfg.llm && !settings.safe && (paid || !rulesHit);
  let photo = '', image = '';
  if (useLLM) {
    try {
      const facts = brain.facts.filter((f) => f.status !== 'conflict').slice(0, 30).map((f) => `${f.display} ${f.label} (source: ${f.source})`);
      const r = await fetch('/api/director', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sentence, topic: talk.title, facts }) });
      const j = await r.json();
      if (!rulesHit) for (const s of j.scenes || []) {
        if (s.kind === 'icon' && !iconFor(s.icon)) s.icon = iconFor(s.label || '') || 'sparkle';
        dispatch({ id: rid(), t0, source: 'llm', scene: s, title: `AI director: ${s.kind}` });
        rulesHit = true;
      }
      photo = j.photo || ''; image = j.image || '';
    } catch { /* director is optional */ }
  }
  if (rulesHit) return;
  if (cfg.pexels && t0 - lastPhotoAt > 8000) {
    const q = photo || photoQuery(sentence);
    if (q) {
      lastPhotoAt = t0;
      try {
        const j = await (await fetch('/api/photo?q=' + encodeURIComponent(q))).json();
        if (j.url) { dispatch({ id: rid(), t0, source: 'photo', scene: { kind: 'photo', url: j.url, caption: q, credit: j.credit }, title: `Photo: ${q}` }); return; }
      } catch { /* fall through */ }
    }
  }
  if (paid && cfg.images && image && !settings.safe) {
    try {
      const j = await (await fetch('/api/image', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: image }) })).json();
      if (j.url) dispatch({ id: rid(), t0, source: 'ai', scene: { kind: 'ai', url: j.url, caption: image }, title: `AI image: ${image.slice(0, 40)}` });
    } catch { /* optional */ }
  }
}

function handle(text: string, isFinal: boolean, key: string) {
  const t0 = Date.now();
  if (!run) startRun();
  caption(text, isFinal);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const done = fired.get(key) || 0;
  const upto = isFinal ? words.length : Math.max(0, words.length - 1);
  for (let i = done; i < upto; i++) processWord(words[i], t0);
  fired.set(key, Math.max(done, upto));
  matchChapter(text);
  if (isFinal) {
    fired.delete(key);
    addTranscript(text);
    const cues = directRules(text, t0, ctx);
    cues.forEach(dispatch);
    const f = cues.find((c) => c.source === 'brain');
    $('#brainHit').innerHTML = f && f.scene.kind === 'fact' ? `Brain matched: <b>${esc(f.scene.value)} ${esc(f.scene.label)}</b> from ${esc(f.scene.source)}` : '';
    smartLayer(text, t0, cues.length > 0);
  }
}

/* ---------- runs (rehearsals and shows) ---------- */
function startRun() {
  run = { id: rid(), engine: settings.engine, startedAt: Date.now(), seconds: 0, words: 0, events: [] };
  wordCount = 0;
  const tag = $('#liveTag'); tag.textContent = 'LIVE'; tag.style.background = 'var(--hot)';
}
function endRun() {
  if (!run) return;
  run.seconds = Math.round((Date.now() - run.startedAt) / 1000); run.words = wordCount;
  if (run.events.length) store.setRuns([...store.runs(), run]);
  run = null;
  const tag = $('#liveTag'); tag.textContent = 'OFF AIR'; tag.style.background = '#6b6478';
}

/* ---------- mic ---------- */
let ears: Ears | null = null;
async function toggleMic() {
  if (ears?.running()) { ears.stop(); ears = null; $('#micBtn').textContent = 'Start mic (Space)'; endRun(); return; }
  const onErr = (m: string) => { toast(m, 7000); $('#micBtn').textContent = 'Start mic (Space)'; ears = null; };
  const terms = [...brain.displayNames.values()].slice(0, 40);
  ears = settings.engine === 'paid' && cfg.deepgram ? deepgramEars(settings.lang, terms, handle, onErr) : webSpeechEars(settings.lang, handle, onErr);
  if (!hasWebSpeech && !(settings.engine === 'paid' && cfg.deepgram)) { onErr('No speech recognition in this browser. Use Chrome or Edge, or add a Deepgram key for the paid engine.'); return; }
  await ears.start();
  if (ears?.running()) { $('#micBtn').textContent = 'Stop mic (Space)'; startRun(); }
}
$('#micBtn').addEventListener('click', toggleMic);

/* ---------- demo + typing ---------- */
let demoRun = 0;
const perform = (line: string, key: string, run_: number | null) => new Promise<boolean>((res) => {
  const ws = line.split(/\s+/); let i = 0;
  const tick = () => {
    if (run_ !== null && run_ !== demoRun) return res(false);
    i++;
    if (i < ws.length) { handle(ws.slice(0, i).join(' '), false, key); setTimeout(tick, 150 + Math.random() * 80); }
    else { handle(line, true, key); res(true); }
  };
  tick();
});
async function runDemo() {
  if (demoRun % 2 === 1) { demoRun++; $('#demoBtn').textContent = 'Run demo (D)'; endRun(); return; }
  demoRun++; const me = demoRun; $('#demoBtn').textContent = 'Stop demo (D)';
  for (let n = 0; n < DEMO_LINES.length; n++) {
    if (!(await perform(DEMO_LINES[n], `demo${me}-${n}`, me))) return;
    await new Promise((r) => setTimeout(r, 2300));
    if (me !== demoRun) return;
  }
  if (me === demoRun) { demoRun++; $('#demoBtn').textContent = 'Run demo (D)'; endRun(); toast('Demo finished. The run is saved in Studio › Engines.'); }
}
$('#demoBtn').addEventListener('click', runDemo);
let typed = 0;
$('#sayForm').addEventListener('submit', (e) => { e.preventDefault(); const v = ($('#say') as HTMLInputElement).value.trim(); if (!v) return; ($('#say') as HTMLInputElement).value = ''; perform(v, `t${typed++}`, null); });

/* ---------- keys ---------- */
addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement)?.tagName || '');
  if (e.key === 'Escape' && typing) { (document.activeElement as HTMLElement).blur(); return; }
  if (typing) return;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); toggleMic(); }
  else if (k === 'k') toggleClear();
  else if (k === 'd') runDemo();
  else if (k === 't') { e.preventDefault(); $('#say').focus(); }
  else if (k === 'enter') showFirst();
  else if (k === 'backspace') skipFirst();
  else if (k === 'arrowright') goChapter(chapterIdx + 1);
  else if (k === 'arrowleft') goChapter(chapterIdx - 1);
});

/* ---------- remote status ---------- */
function status() { bus.send({ type: 'status', live: !!run, chapter: chapterIdx >= 0 ? beats[chapterIdx].title : '', queue: queue.length, cleared }); }
setInterval(status, 4000);

/* ---------- boot ---------- */
fetch('/api/config').then((r) => r.json()).then((c: ServerConfig) => { cfg = c; renderToggles(); $('#remoteUrls').innerHTML = c.lanUrls.length ? c.lanUrls.map((u) => `<div>${esc(u)}</div>`).join('') : 'No network address found.'; })
  .catch(() => { $('#remoteUrls').textContent = 'Needs the VoxInk server running (npm run dev).'; });
onStoreChange(refreshKnowledge);
refreshKnowledge(); renderQueue(); renderSpeed();
(window as any).voxink = { handle, runDemo, toggleClear }; // for tests and power users
addEventListener('beforeunload', endRun);
