import type { EngineId, StyleId } from './types';

export interface BrainSource { id: string; name: string; text: string; addedAt: number; kind: 'about' | 'doc' | 'notes' }
export interface Chapter { title: string; text: string }
export interface Talk { title: string; audience: string; style: StyleId; chapters: Chapter[] }
export interface RunEvent { title: string; source: string; latency: number; skipped?: boolean; late?: boolean }
export interface Run { id: string; engine: EngineId; startedAt: number; seconds: number; words: number; events: RunEvent[] }
export interface Settings { engine: EngineId; safe: boolean; review: boolean; lang: string }
export interface Resolution { [factKey: string]: string } // chosen value when sources conflict
export interface Mutes { [word: string]: boolean } // words the speaker turned off (e.g. "heat")

function read<T>(k: string, d: T): T {
  try { const v = localStorage.getItem('voxink.' + k); return v ? (JSON.parse(v) as T) : d; } catch { return d; }
}
function write(k: string, v: unknown) {
  try { localStorage.setItem('voxink.' + k, JSON.stringify(v)); } catch { /* storage full or blocked */ }
}

export const store = {
  brain: () => read<BrainSource[]>('brain', []),
  setBrain: (v: BrainSource[]) => write('brain', v),
  talk: () => read<Talk>('talk', { title: 'Untitled talk', audience: '', style: 'zine', chapters: [] }),
  setTalk: (v: Talk) => write('talk', v),
  runs: () => read<Run[]>('runs', []),
  setRuns: (v: Run[]) => write('runs', v.slice(-30)),
  settings: () => read<Settings>('settings', { engine: 'free', safe: false, review: false, lang: 'en-IN' }),
  setSettings: (v: Settings) => write('settings', v),
  resolutions: () => read<Resolution>('resolutions', {}),
  setResolutions: (v: Resolution) => write('resolutions', v),
  mutes: () => read<Mutes>('mutes', {}),
  setMutes: (v: Mutes) => write('mutes', v),
};

/** Same-browser change notifications between Studio and Console tabs. */
export function onStoreChange(cb: () => void) {
  window.addEventListener('storage', (e) => { if (e.key?.startsWith('voxink.')) cb(); });
}
