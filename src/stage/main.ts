import '../shared/fonts-stage';
import './stage.css';
import { createBus } from '../shared/bus';
import type { Cue, Scene, StyleId } from '../shared/types';
import { FX } from '../engine/words';
import { fmtNum } from '../engine/brain';
import { iconSvg } from '../engine/icons';
import { createGlobe, type Globe } from '../engine/globe';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const stage = $('#stage'), sceneEl = $('#scene'), cap = $('#cap'), idle = $('#idle');
const bus = createBus('stage');
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

let style: StyleId = 'zine';
const setStyle = (s: StyleId) => { style = s; document.body.dataset.style = s; globe?.dispose(); globe = null; };
const wake = () => idle.classList.add('hide');

/* ---------- live words ---------- */
const NOSPLIT = new Set(['fast', 'scary', 'love', 'boom', 'loud', 'quiet', 'idea', 'tech', 'secret', 'long', 'spin', 'hero', 'plain', 'tiny', 'big']);
const RING: [number, number][] = [[18, 22], [50, 15], [80, 22], [14, 50], [86, 50], [20, 74], [50, 78], [80, 74]];
const CENTER: [number, number][] = [[36, 42], [64, 44], [50, 56], [40, 62], [62, 36]];
const live: { el: HTMLElement; slot: [number, number] }[] = [];
let sceneActive = false;
const burst = (() => { const p: string[] = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 32 : 50; p.push(`${50 + Math.cos(a) * r}% ${50 + Math.sin(a) * r}%`); } return `polygon(${p.join(',')})`; })();

const kill = (el: HTMLElement) => { el.classList.add('out'); setTimeout(() => el.remove(), 720); };
function slot(): [number, number] {
  if (style === 'minimal') return [50, 16];
  const pool = sceneActive ? RING : RING.concat(CENTER);
  const used = new Set(live.map((o) => o.slot));
  const free = pool.filter((p) => !used.has(p));
  if (free.length) return pick(free);
  const old = live.shift()!; kill(old.el); return old.slot;
}
function setMood(c: string) {
  stage.style.setProperty('--mood', c);
  $('#mood').style.setProperty('--mx', rnd(30, 70) + '%'); $('#mood').style.setProperty('--my', rnd(30, 70) + '%');
}
function particles(x: number, y: number, chars: string[], color: string, n: number) {
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span'); p.className = 'pt'; p.textContent = pick(chars);
    const a = rnd(0, Math.PI * 2), d = rnd(80, 260);
    p.style.cssText = `left:${x}%;top:${y}%;color:${color};font-size:${rnd(16, 38)}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--rr:${rnd(-200, 200)}deg;animation-delay:${rnd(0, 0.25)}s`;
    stage.appendChild(p); setTimeout(() => p.remove(), 1700);
  }
}

function spawnWord(text: string, fx: string) {
  wake();
  const max = style === 'minimal' ? 1 : style === 'cinema' ? 4 : 7;
  while (live.length >= max) kill(live.shift()!.el);
  const s = slot();
  const el = document.createElement('div'); el.className = 'w fx-' + fx;
  const len = Math.max(3, text.length);
  const vw = Math.min(fx === 'big' || fx === 'loud' ? 8.5 : 7, 48 / len) * (style === 'minimal' ? 0.8 : 1);
  el.style.fontSize = `max(30px,${vw.toFixed(2)}vw)`;
  el.style.left = s[0] + (style === 'minimal' ? 0 : rnd(-3, 3)) + '%'; el.style.top = s[1] + (style === 'minimal' ? 0 : rnd(-3, 3)) + '%';
  el.style.setProperty('--r', (style === 'zine' ? (fx === 'hero' ? rnd(-7, 7) : rnd(-5, 5)) : 0) + 'deg');
  const inn = document.createElement('span'); inn.className = 'in';
  const shown = fx === 'tech' && text.length <= 3 ? text.toUpperCase() : text;
  if (NOSPLIT.has(fx)) inn.textContent = shown;
  else [...shown].forEach((ch, i) => {
    const l = document.createElement('span'); l.className = 'l'; l.textContent = ch;
    l.style.setProperty('--i', String(i)); l.style.setProperty('--rr', rnd(-60, 60) + 'deg');
    const far = fx === 'together' ? 1 : 0.35;
    l.style.setProperty('--dx', rnd(-1, 1) * (fx === 'together' ? 600 : 90) * far + 'px');
    l.style.setProperty('--dy', rnd(-1, 1) * (fx === 'together' ? 400 : 80) * far + 'px');
    inn.appendChild(l);
  });
  inn.style.setProperty('--n', String(shown.length));
  if (fx === 'boom') inn.style.setProperty('--burst', burst);
  el.appendChild(inn); stage.appendChild(el);
  // keep inside the screen
  const r = el.getBoundingClientRect(), m = 16; let dx = 0, dy = 0;
  if (r.left < m) dx = m - r.left; else if (r.right > innerWidth - m) dx = innerWidth - m - r.right;
  if (r.top < 64) dy = 64 - r.top; else if (r.bottom > innerHeight - 70) dy = innerHeight - 70 - r.bottom;
  if (dx) el.style.left = `calc(${el.style.left} + ${dx}px)`; if (dy) el.style.top = `calc(${el.style.top} + ${dy}px)`;
  const o = { el, slot: s }; live.push(o);
  setTimeout(() => { const i = live.indexOf(o); if (i > -1) { live.splice(i, 1); kill(el); } }, fx === 'slow' || fx === 'sad' ? 7500 : 5800);
  if (FX[fx]) setMood(FX[fx].mood);
  if (style === 'zine') {
    if (fx === 'boom') particles(s[0], s[1], ['*', '+', '!', '★'], '#ffd400', 18);
    if (fx === 'money') particles(s[0], s[1], ['₹', '₹', '$'], '#ffd24a', 12);
    if (fx === 'fire') particles(s[0], s[1], ['•', '·'], '#ff8a00', 14);
    if (fx === 'love') particles(s[0], s[1], ['♥'], '#ff5fa2', 10);
  }
}

/* ---------- scenes ---------- */
let globe: Globe | null = null;
let sceneTimer = 0;
function clearScene() { for (const o of [...sceneEl.children]) { o.classList.add('out'); setTimeout(() => o.remove(), 520); } sceneActive = false; }
function mountScene(html: string, tilt?: number): HTMLElement {
  wake();
  for (const o of [...sceneEl.children]) { o.classList.add('out'); setTimeout(() => o.remove(), 520); }
  const d = document.createElement('div'); d.className = 'sc';
  d.style.setProperty('--tilt', (style === 'zine' ? (tilt ?? rnd(-2.5, 2.5)) : 0) + 'deg');
  d.innerHTML = html; sceneEl.appendChild(d); sceneActive = true;
  for (const o of live.slice()) if (CENTER.includes(o.slot)) { live.splice(live.indexOf(o), 1); kill(o.el); }
  clearTimeout(sceneTimer); sceneTimer = window.setTimeout(clearScene, 9500);
  return d;
}
function countUp(el: Element, from: number, to: number, ms: number, suffix = '', prefix = '') {
  const t0 = performance.now();
  const step = (t: number) => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 4); el.textContent = prefix + fmtNum(from + (to - from) * e) + suffix; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
const loadImg = (url: string) => new Promise<void>((res) => { const i = new Image(); i.onload = () => res(); i.onerror = () => res(); i.src = url; setTimeout(res, 4000); });
const globeColors = () => style === 'news' ? { ocean: '#dfe7ef', land: '#0b5cad', grid: 'rgba(0,0,0,.08)', pin: '#d62828' }
  : style === 'minimal' ? { ocean: '#efe4cf', land: '#121015', grid: 'rgba(0,0,0,.06)', pin: '#d6361b' }
  : style === 'cinema' ? { ocean: '#0e1a2b', land: '#e8c27a', grid: 'rgba(255,255,255,.05)', pin: '#e07a5f' }
  : { ocean: '#0b3a63', land: '#3dffa0', grid: 'rgba(255,255,255,.12)', pin: '#ff4d2e' };

async function showScene(sc: Scene): Promise<void> {
  switch (sc.kind) {
    case 'counter': {
      const grow = sc.from && sc.from > 0 ? sc.to / sc.from : 0;
      const d = mountScene(`<div class="panel">${sc.from != null ? `<div class="from">from ${esc((sc.prefix || '') + fmtNum(sc.from))}</div>` : ''}<div class="big n">0</div>${sc.label ? `<div class="kick">${esc(sc.label)}</div>` : ''}${grow >= 1.5 ? `<div class="chip">${esc(grow >= 10 ? Math.round(grow) : grow.toFixed(1))}× growth</div>` : ''}</div>`);
      countUp(d.querySelector('.n')!, sc.from || 0, sc.to, 1600, '', sc.prefix || '');
      setMood(sc.to >= (sc.from || 0) ? '#0f7a4a' : '#7a1f2b');
      if (grow >= 1.5 && style === 'zine') particles(50, 48, ['↑', '+', '★'], '#3dffa0', 16);
      break;
    }
    case 'fact': {
      mountScene(`<div class="panel"><div class="big">${esc(sc.value)}</div><div class="kick">${esc(sc.label)}</div><div class="src">from ${esc(sc.source)}</div></div>`);
      setMood('#0f7a4a'); break;
    }
    case 'ring': {
      const C = 2 * Math.PI * 44;
      const d = mountScene(`<div class="panel" style="border-radius:50%;padding:28px"><div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-opacity=".15" stroke-width="9"/><circle class="arc" cx="50" cy="50" r="44" fill="none" stroke="var(--hot)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" style="transition:stroke-dashoffset 1.6s cubic-bezier(.2,.8,.2,1)"/></svg><div><div class="big n">0%</div>${sc.label ? `<div class="kick">${esc(sc.label)}</div>` : ''}</div></div></div>`, 0);
      requestAnimationFrame(() => requestAnimationFrame(() => { (d.querySelector('.arc') as SVGElement).style.strokeDashoffset = String(C * (1 - Math.min(sc.pct, 100) / 100)); }));
      countUp(d.querySelector('.n')!, 0, sc.pct, 1600, '%');
      setMood('#8a2410'); break;
    }
    case 'timeline': {
      const lo = Math.min(...sc.years) - 1, hi = Math.max(...sc.years) + 1;
      const pins = sc.years.map((y) => `<div class="pin ${y === sc.now ? 'now' : ''}" style="left:${8 + ((y - lo) / (hi - lo)) * 84}%"><b>${y}</b><i></i></div>`).join('');
      mountScene(`<div class="panel"><div class="kick">timeline</div><div class="tl"><div class="bar"></div>${pins}</div></div>`, 0);
      setMood('#4a3f7a'); break;
    }
    case 'split':
      mountScene(`<div class="split"><div class="old"><small>the old way</small><b>${esc(sc.old)}</b></div><div class="vs">VS</div><div class="new"><small>the new way</small><b>${esc(sc.new)}</b></div></div>`, 0);
      setMood('#8a2410'); break;
    case 'question':
      mountScene(`<div style="display:grid;place-items:center;gap:8px"><div class="qmark">?</div><div class="qtext">${esc(sc.text)}</div></div>`, 0);
      setMood('#4a3f7a'); break;
    case 'globe': {
      if (!globe) globe = createGlobe(560, globeColors());
      globe.setPins(sc.pins);
      const d = mountScene(`<div class="globe-wrap"><div class="g"></div>${sc.label ? `<div class="kick">${esc(sc.label)}</div>` : ''}</div>`, 0);
      d.querySelector('.g')!.appendChild(globe.el);
      setMood('#0b4f8a'); break;
    }
    case 'photo': case 'ai': {
      await loadImg(sc.url);
      mountScene(`<figure class="photo" style="margin:0"><img src="${esc(sc.url)}" alt="${esc(sc.caption)}"><figcaption><span>${esc(sc.caption)}</span>${sc.kind === 'photo' && sc.credit ? `<small>${esc(sc.credit)}</small>` : sc.kind === 'ai' ? '<small>AI illustration</small>' : ''}</figcaption></figure>`);
      break;
    }
    case 'icon':
      mountScene(`<div class="iconsc">${iconSvg(sc.icon, 'fill="currentColor"')}<div class="kick">${esc(sc.label)}</div></div>`);
      break;
  }
}

/* ---------- chapter, caption, clear ---------- */
function chapter(n: number, title: string) {
  wake();
  const w = $('#wipe');
  w.querySelector('.num')!.textContent = String(n).padStart(2, '0');
  w.querySelector('.name')!.textContent = title;
  w.classList.remove('go'); void w.offsetWidth; w.classList.add('go');
  const ch = $('#chapter'); ch.innerHTML = `<span>${String(n).padStart(2, '0')}</span>${esc(title)}`;
  setTimeout(() => { ch.style.display = 'flex'; }, 1500);
}

bus.on((m) => {
  switch (m.type) {
    case 'word': spawnWord(m.text, m.fx); bus.send({ type: 'shown', id: m.id, at: Date.now() }); break;
    case 'scene': {
      const cue: Cue = m.cue;
      showScene(cue.scene).then(() => bus.send({ type: 'shown', id: cue.id, at: Date.now() }));
      break;
    }
    case 'chapter': chapter(m.n, m.title); break;
    case 'caption': cap.innerHTML = `${esc(m.final)} ${m.interim ? `<i>${esc(m.interim)}</i>` : ''}`; if (m.final || m.interim) wake(); break;
    case 'clear': stage.classList.add('cleared'); break;
    case 'restore': stage.classList.remove('cleared'); break;
    case 'style': setStyle(m.style); break;
  }
});
bus.send({ type: 'hello', role: 'stage' });

addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); }
  if (e.key === 'c' || e.key === 'C') cap.classList.toggle('off');
});
addEventListener('dblclick', () => document.documentElement.requestFullscreen().catch(() => {}));
try { const s = JSON.parse(localStorage.getItem('voxink.talk') || '{}').style; if (s) setStyle(s); } catch { /* default */ }
