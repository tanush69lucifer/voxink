import '../shared/fonts-ui';
import '../shared/app.css';
import { createBus, rid } from '../shared/bus';
import { store, type Talk, type Run } from '../shared/store';
import type { ServerConfig, StyleId } from '../shared/types';
import { SAMPLE_BRAIN, SAMPLE_TALK } from '../shared/sample';
import { buildBrain, sourceSummary } from '../engine/brain';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const bus = createBus('studio');
const toast = (t: string) => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout((e as any)._t); (e as any)._t = setTimeout(() => e.classList.remove('on'), 3500); };
if (!store.brain().length && !store.talk().chapters.length) { store.setBrain(SAMPLE_BRAIN()); store.setTalk(SAMPLE_TALK()); }

/* ---------- tabs ---------- */
const TABS = ['talk', 'brain', 'runs', 'setup'];
function route() {
  const t = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'talk';
  TABS.forEach((x) => { ($('#tab-' + x) as HTMLElement).hidden = x !== t; });
  document.querySelectorAll<HTMLAnchorElement>('[data-tab]').forEach((a) => { if (a.dataset.tab === t) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  ({ talk: renderTalk, brain: renderBrain, runs: renderRuns, setup: renderSetup } as Record<string, () => void>)[t]();
}
addEventListener('hashchange', route);

/* ---------- talk ---------- */
const STYLES: { id: StyleId; name: string; note: string; bg: string; fg: string; font: string; text: string }[] = [
  { id: 'zine', name: 'Comic zine', note: 'Loud, playful, ink and marker', bg: '#121015', fg: '#ffd400', font: 'Bungee', text: 'BOOM' },
  { id: 'cinema', name: 'Cinematic dark', note: 'Big photos, slow fades', bg: '#0b0d12', fg: '#e8c27a', font: 'Playfair Display', text: 'Dawn' },
  { id: 'news', name: 'Newsroom', note: 'Charts first, clean labels', bg: '#f6f5f1', fg: '#0b5cad', font: 'Archivo Black', text: '+25×' },
  { id: 'minimal', name: 'Minimal', note: 'One word at a time, lots of air', bg: '#f4ecdc', fg: '#121015', font: 'Space Grotesk', text: 'clean.' },
];
let talk: Talk = store.talk();
const saveTalk = () => { store.setTalk(talk); };
function renderTalk() {
  talk = store.talk();
  ($('#tTitle') as HTMLInputElement).value = talk.title;
  ($('#tAud') as HTMLInputElement).value = talk.audience;
  $('#styles').innerHTML = STYLES.map((s) => `<button type="button" data-style="${s.id}" aria-pressed="${talk.style === s.id}" style="text-align:left;padding:12px;background:var(--card);color:var(--ink);border:3px solid ${talk.style === s.id ? 'var(--marker)' : 'var(--line)'};box-shadow:${talk.style === s.id ? '5px 5px 0 var(--marker)' : 'none'};cursor:pointer">
    <span style="display:flex;align-items:center;justify-content:center;height:90px;background:${s.bg};color:${s.fg};font-family:'${s.font}',sans-serif;font-size:34px;font-weight:800;border:2px solid #000">${s.text}</span>
    <span style="display:block;font-weight:700;margin-top:10px">${s.name}${talk.style === s.id ? ' · selected' : ''}</span><span class="muted" style="display:block">${s.note}</span></button>`).join('');
  $('#chapters').innerHTML = talk.chapters.map((c, i) => `<div class="item" style="display:grid;gap:8px">
    <div class="row"><span style="font-family:Bungee,sans-serif;color:var(--hot)">${String(i + 1).padStart(2, '0')}</span><label class="sr" for="ct${i}">Chapter title</label><input id="ct${i}" data-ct="${i}" value="${esc(c.title)}" style="flex:1;font-weight:700"><button type="button" class="btn ghost" data-del="${i}" aria-label="Delete chapter ${i + 1}">Delete</button></div>
    <label class="f"><small>What you'll say (its words move the show to this chapter)</small><textarea data-cx="${i}" rows="4">${esc(c.text)}</textarea></label></div>`).join('') || '<p class="muted">No chapters yet: VoxInk will run in freestyle.</p>';
}
$('#tTitle').addEventListener('input', (e) => { talk.title = (e.target as HTMLInputElement).value; saveTalk(); });
$('#tAud').addEventListener('input', (e) => { talk.audience = (e.target as HTMLInputElement).value; saveTalk(); });
$('#styles').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('[data-style]') as HTMLElement; if (!b) return;
  talk.style = b.dataset.style as StyleId; saveTalk(); bus.send({ type: 'style', style: talk.style }); renderTalk();
  toast(`Show style: ${STYLES.find((s) => s.id === talk.style)!.name}. An open stage window switches now.`);
});
$('#chapters').addEventListener('input', (e) => {
  const t = e.target as HTMLElement;
  if (t.dataset.ct) talk.chapters[+t.dataset.ct].title = (t as HTMLInputElement).value;
  if (t.dataset.cx) talk.chapters[+t.dataset.cx].text = (t as HTMLTextAreaElement).value;
  saveTalk();
});
$('#chapters').addEventListener('click', (e) => { const t = e.target as HTMLElement; if (t.dataset.del) { talk.chapters.splice(+t.dataset.del, 1); saveTalk(); renderTalk(); } });
$('#addCh').addEventListener('click', () => { talk.chapters.push({ title: 'New chapter', text: '' }); saveTalk(); renderTalk(); });
$('#loadSample').addEventListener('click', () => { store.setBrain(SAMPLE_BRAIN()); store.setTalk(SAMPLE_TALK()); store.setResolutions({}); renderTalk(); toast('Loaded the AquaSun sample pitch and its Brain.'); });

/* ---------- brain ---------- */
function renderBrain() {
  const sources = sourceSummary(store.brain());
  const b = buildBrain();
  $('#sources').innerHTML = sources.map((s) => `<li class="item"><div class="row" style="justify-content:space-between"><b>${esc(s.name)}</b><span class="row" style="gap:6px">${s.stale ? `<button type="button" class="btn ghost" data-fresh="${s.id}">Mark up to date</button>` : ''}<button type="button" class="btn ghost" data-rm="${s.id}" aria-label="Remove ${esc(s.name)}">Remove</button></span></div>
    <div class="muted ${s.stale ? 'warn' : ''}">${s.words} words · ${s.stale ? 'older than 30 days, check its numbers' : 'added ' + new Date(s.addedAt).toLocaleDateString('en-IN')}</div></li>`).join('') || '<li class="muted">Nothing yet. Add your deck text, notes or an about-me.</li>';
  const conflicts = b.facts.filter((f) => f.status === 'conflict');
  $('#factsNote').textContent = `${b.facts.length} facts · ${conflicts.length ? new Set(conflicts.map((f) => f.key)).size + ' conflict' : 'no conflicts'}`;
  const seen = new Set<string>();
  $('#facts').innerHTML = b.facts.map((f) => {
    const dupe = f.status === 'conflict' && seen.has(f.key); seen.add(f.key);
    const status = f.status === 'conflict'
      ? (dupe ? '<span class="err">Conflict</span>' : `<span class="err">Conflict</span><div class="row" style="gap:6px;margin-top:6px">${(f.options || []).map((o) => `<button type="button" class="btn y" style="min-height:36px;padding:0 10px" data-pick="${esc(f.key)}" data-val="${esc(o)}">Use ${esc(o)}</button>`).join('')}</div>`)
      : f.status === 'check' ? '<span class="warn">Check</span>' : '<span class="ok">Fresh</span>';
    return `<tr><td>${esc(f.label)}</td><td class="num"><b>${esc(f.display)}</b></td><td class="muted">${esc(f.source)}</td><td>${status}</td></tr>`;
  }).join('') || '<tr><td colspan="4" class="muted">No numbers found yet.</td></tr>';
  $('#names').innerHTML = [...b.displayNames.values()].slice(0, 40).map((n) => `<span class="badge">${esc(n)}</span>`).join('') || '<span class="muted">None yet.</span>';
}
$('#sources').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.dataset.rm) { store.setBrain(store.brain().filter((s) => s.id !== t.dataset.rm)); renderBrain(); }
  if (t.dataset.fresh) { store.setBrain(store.brain().map((s) => s.id === t.dataset.fresh ? { ...s, addedAt: Date.now() } : s)); renderBrain(); toast('Marked up to date.'); }
});
$('#facts').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.dataset.pick) { store.setResolutions({ ...store.resolutions(), [t.dataset.pick]: t.dataset.val! }); renderBrain(); toast(`Using ${t.dataset.val} on stage.`); }
});
$('#addSrc').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = ($('#sName') as HTMLInputElement).value.trim(), text = ($('#sText') as HTMLTextAreaElement).value.trim();
  const files = [...(($('#sFile') as HTMLInputElement).files || [])];
  const add: { name: string; text: string }[] = [];
  if (text) add.push({ name: name || 'Notes ' + new Date().toLocaleDateString('en-IN'), text });
  for (const f of files) add.push({ name: f.name, text: (await f.text()).slice(0, 200_000) });
  if (!add.length) { toast('Paste some text or choose a file first.'); return; }
  store.setBrain([...store.brain(), ...add.map((a) => ({ id: rid(), kind: 'doc' as const, name: a.name, text: a.text, addedAt: Date.now() }))]);
  (e.target as HTMLFormElement).reset(); renderBrain(); toast(`Added ${add.length} source${add.length > 1 ? 's' : ''}.`);
});

/* ---------- runs + engines ---------- */
const avg = (r: Run) => { const ev = r.events.filter((x) => !x.skipped); return ev.length ? ev.reduce((a, b) => a + b.latency, 0) / ev.length : 0; };
function renderRuns() {
  const runs = store.runs();
  const last = (eng: string) => [...runs].reverse().find((r) => r.engine === eng);
  const f = last('free'), p = last('paid');
  const card = (r: Run | undefined, name: string, color: string) => `<section class="card" style="flex:1 1 380px;${r ? '' : 'opacity:.7'}"><div class="row" style="justify-content:space-between"><h2 style="margin:0;font-size:20px">${name}</h2><span class="muted">${r ? new Date(r.startedAt).toLocaleString('en-IN') : 'No run yet'}</span></div>
    ${r ? `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:16px">
      <div><div style="font-family:Bungee,sans-serif;font-size:32px;color:${color}">${(avg(r) / 1000).toFixed(2)} s</div><div class="muted">words to screen</div></div>
      <div><div style="font-family:Bungee,sans-serif;font-size:32px;color:${color}">${r.events.filter((e) => !e.skipped).length}</div><div class="muted">visuals shown</div></div>
      <div><div style="font-family:Bungee,sans-serif;font-size:32px;color:${r.events.some((e) => e.late) ? 'var(--bad)' : color}">${r.events.filter((e) => e.late).length}</div><div class="muted">came late (&gt;1.5 s)</div></div></div>` : `<p class="muted">Switch the Console to ${name.toLowerCase()} and run the demo or the mic.</p>`}</section>`;
  $('#compare').innerHTML = card(f, 'Free engine', 'var(--marker)') + card(p, 'Paid engine', 'var(--good)');
  $('#runsTitle').textContent = f && p ? (avg(p) < avg(f) ? `Paid was ${((avg(f) - avg(p)) / 1000).toFixed(2)} s faster per visual` : `Free kept up: ${((avg(p) - avg(f)) / 1000).toFixed(2)} s faster per visual`) : 'Rehearsals and engines';
  $('#runs').innerHTML = [...runs].reverse().map((r) => `<tr><td>${new Date(r.startedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td><td>${r.engine}</td><td class="num">${r.events.length}</td><td class="num">${Math.round(avg(r))} ms</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No runs yet.</td></tr>';
  // fixes
  const b = buildBrain();
  const fixes: string[] = [];
  const keys = new Set(b.facts.filter((x) => x.status === 'conflict').map((x) => x.key));
  keys.forEach((k) => fixes.push(`<li class="item row"><span style="flex:1 1 260px">"${esc(k)}" has different values in two sources, so it's held back</span><a class="btn y" href="#brain">Fix in Brain</a></li>`));
  sourceSummary(store.brain()).filter((s) => s.stale).forEach((s) => fixes.push(`<li class="item row"><span style="flex:1 1 260px">${esc(s.name)} is over 30 days old</span><a class="btn ghost" href="#brain">Review</a></li>`));
  const latest = runs.at(-1);
  latest?.events.filter((e) => e.late).slice(0, 5).forEach((e) => fixes.push(`<li class="item row"><span style="flex:1 1 260px">${esc(e.title)} took ${(e.latency / 1000).toFixed(1)} s (${esc(e.source)}). Put its number in the Brain so it's ready instantly.</span></li>`));
  latest?.events.filter((e) => e.skipped).slice(0, 5).forEach((e) => fixes.push(`<li class="item row"><span style="flex:1 1 260px">You skipped: ${esc(e.title)}</span></li>`));
  fixes.push(`<li class="item"><form id="muteForm" class="row"><label class="f" style="flex:1 1 220px">Mute a word that misfires <small>e.g. "heat" in a sentence about sunlight</small><input id="muteWord" placeholder="word"></label><button class="btn y" type="submit">Mute</button></form></li>`);
  $('#fixes').innerHTML = fixes.join('');
  $('#muteForm').addEventListener('submit', (e) => { e.preventDefault(); const w = ($('#muteWord') as HTMLInputElement).value.trim().toLowerCase(); if (!w) return; store.setMutes({ ...store.mutes(), [w]: true }); toast(`"${w}" won't be acted out.`); renderRuns(); });
}
$('#clearRuns').addEventListener('click', () => { store.setRuns([]); renderRuns(); });

/* ---------- setup ---------- */
async function renderSetup() {
  let c: ServerConfig | null = null;
  try { c = await (await fetch('/api/config')).json(); } catch { /* server not running */ }
  const row = (part: string, free: string, paid: string, on: boolean | undefined) => `<tr><td><b>${part}</b></td><td>${free}</td><td>${paid}</td><td>${c ? (on ? '<span class="ok">Paid part on</span>' : '<span class="muted">Free</span>') : '<span class="err">Server not running</span>'}</td></tr>`;
  $('#cfg').innerHTML = row('Ears (speech)', 'Chrome built-in speech', 'DEEPGRAM_API_KEY · Nova-3 streaming', c?.deepgram)
    + row('Director', 'Built-in rules + Brain', `LLM_API_KEY · ${esc(c?.llmModel || 'any OpenAI-compatible model')}`, c?.llm)
    + row('Photos', 'Icons and 3D only', 'PEXELS_API_KEY · free key from pexels.com', c?.pexels)
    + row('AI images', 'Off', 'FAL_KEY · fast image model', c?.images);
  const s = store.settings(); ($('#lang') as HTMLSelectElement).value = s.lang;
  const m = Object.keys(store.mutes());
  $('#mutes').innerHTML = m.length ? m.map((w) => `<button type="button" class="btn ghost" data-unmute="${esc(w)}" style="min-height:36px">${esc(w)} ×</button>`).join(' ') : 'none';
}
$('#lang').addEventListener('change', (e) => { store.setSettings({ ...store.settings(), lang: (e.target as HTMLSelectElement).value }); toast('Saved. Restart the mic in the Console to apply.'); });
$('#mutes').addEventListener('click', (e) => { const w = (e.target as HTMLElement).dataset.unmute; if (w) { const m = store.mutes(); delete m[w]; store.setMutes(m); renderSetup(); } });

route();
