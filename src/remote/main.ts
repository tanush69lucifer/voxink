import '../shared/fonts-ui';
import '../shared/app.css';
import { createBus } from '../shared/bus';
import type { RemoteAction } from '../shared/types';

const bus = createBus('remote');
const $ = (s: string) => document.querySelector(s) as HTMLElement;
document.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) => b.addEventListener('click', () => {
  bus.send({ type: 'remote', action: b.dataset.a as RemoteAction });
  navigator.vibrate?.(30);
}));
bus.on((m) => {
  if (m.type !== 'status') return;
  $('#chap').textContent = m.chapter || '—';
  $('#q').textContent = `Queue: ${m.queue}${m.live ? ' · live' : ''}`;
  $('#clr').textContent = m.cleared ? 'Bring visuals back' : 'Clear screen';
});
setInterval(() => { const on = bus.online(); const c = $('#conn'); c.textContent = on ? 'Connected' : 'Offline'; c.style.background = on ? 'var(--good)' : '#6b6478'; c.style.color = on ? '#121015' : '#fff'; }, 1000);
setTimeout(() => bus.send({ type: 'hello', role: 'remote' }), 800);
