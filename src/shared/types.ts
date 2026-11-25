export type StyleId = 'zine' | 'cinema' | 'news' | 'minimal';
export type EngineId = 'free' | 'paid';
export type Source = 'brain' | 'rules' | 'icon' | 'photo' | 'ai' | '3d' | 'llm';

export interface Pin { name: string; lat: number; lon: number }

export type Scene =
  | { kind: 'counter'; to: number; from?: number; label?: string; prefix?: string }
  | { kind: 'ring'; pct: number; label?: string }
  | { kind: 'timeline'; years: number[]; now: number }
  | { kind: 'split'; old: string; new: string }
  | { kind: 'question'; text: string }
  | { kind: 'globe'; pins: Pin[]; label?: string }
  | { kind: 'photo'; url: string; caption: string; credit?: string }
  | { kind: 'ai'; url: string; caption: string }
  | { kind: 'icon'; icon: string; label: string }
  | { kind: 'fact'; value: string; label: string; source: string };

export interface Cue {
  id: string;
  t0: number; // ms timestamp when the words that caused it were heard
  source: Source;
  scene: Scene;
  title: string;
}

export type RemoteAction = 'show' | 'skip' | 'clear' | 'next' | 'prev';

export type BusMsg =
  | { type: 'word'; id: string; text: string; fx: string; t0: number }
  | { type: 'scene'; cue: Cue }
  | { type: 'chapter'; n: number; title: string }
  | { type: 'caption'; final: string; interim: string }
  | { type: 'clear' }
  | { type: 'restore' }
  | { type: 'style'; style: StyleId }
  | { type: 'shown'; id: string; at: number }
  | { type: 'remote'; action: RemoteAction }
  | { type: 'status'; live: boolean; chapter: string; queue: number; cleared: boolean }
  | { type: 'hello'; role: string };

export interface ServerConfig {
  llm: boolean;
  llmModel?: string;
  pexels: boolean;
  images: boolean;
  deepgram: boolean;
  lanUrls: string[];
}
