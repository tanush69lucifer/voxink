import type { BrainSource } from '../shared/store';
import { store } from '../shared/store';
import { tokens, STOP } from './words';

/**
 * The Brain: everything VoxInk knows about the speaker and their work.
 * Fully local: text goes in, facts and names come out, and a BM25 index answers "which fact is this sentence about?"
 * in well under a millisecond — no model download, no network.
 */
export interface Fact {
  key: string; // normalised label, used to detect conflicts
  value: number;
  display: string; // "5,000" or "₹2.4 Cr"
  label: string; // "families served"
  sentence: string;
  source: string;
  sourceId: string;
  terms: string[];
  status: 'fresh' | 'check' | 'conflict';
  options?: string[]; // values that disagree across sources
}

export interface BrainIndex {
  facts: Fact[];
  names: Set<string>; // proper nouns worth a sticker on stage (lower-case)
  displayNames: Map<string, string>;
  sentences: { text: string; source: string; terms: string[] }[];
  idf: Map<string, number>;
}

const MULT: Record<string, number> = { k: 1e3, thousand: 1e3, lakh: 1e5, lakhs: 1e5, crore: 1e7, crores: 1e7, cr: 1e7, million: 1e6, millions: 1e6, m: 1e6, billion: 1e9, bn: 1e9 };
const NUM = /([₹$])?\s?(\d[\d,]*(?:\.\d+)?)\s*(%|percent\b|k\b|thousand\b|lakhs?\b|crores?\b|cr\b|millions?\b|billion\b|bn\b)?/gi;
const DAY = 864e5;

export function fmtNum(v: number): string {
  if (v >= 1e5 && v < 1e7 && v % 1e5 === 0) return (v / 1e5).toLocaleString('en-IN', { maximumFractionDigits: 1 }) + ' lakh';
  if (v >= 1e7) return (v / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' Cr';
  if (v >= 1e6 && v % 1e5 === 0) return (v / 1e6).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + 'M';
  return Math.round(v).toLocaleString('en-IN');
}

function labelBefore(s: string, idx: number): { label: string; copula: boolean } {
  const words = s.slice(0, idx).trim().split(/\s+/);
  const copula = /^(is|are|was|were|of|at|:|=|reached|hit|crossed)$/i.test((words.at(-1) || '').replace(/[^\w:=]/g, ''));
  const label = words.slice(-5).map((x) => x.replace(/[^\w']/g, '')).filter((x) => x && !STOP.has(x.toLowerCase()) && !/^\d/.test(x)).slice(-3).join(' ').toLowerCase();
  return { label, copula };
}

function labelAfter(s: string, idx: number, n = 3): string {
  return s.slice(idx).split(/\s+/).map((x) => x.replace(/[^\w']/g, '')).filter((x) => x && !STOP.has(x.toLowerCase()) && !/^\d/.test(x)).slice(0, n).join(' ').toLowerCase();
}

export function splitSentences(text: string): string[] {
  return text.replace(/\r/g, '').split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 3);
}

export function buildBrain(sources: BrainSource[] = store.brain()): BrainIndex {
  const facts: Fact[] = [];
  const names = new Set<string>();
  const displayNames = new Map<string, string>();
  const sentences: BrainIndex['sentences'] = [];
  const nameCount = new Map<string, number>();

  for (const src of sources) {
    const stale = Date.now() - src.addedAt > 30 * DAY;
    for (const s of splitSentences(src.text)) {
      const terms = tokens(s);
      sentences.push({ text: s, source: src.name, terms });
      // proper nouns: capitalised words not at the start of the sentence, or CamelCase brand names anywhere
      s.split(/\s+/).forEach((w, i) => {
        const c = w.replace(/[^\w]/g, '');
        if (c.length < 3 || STOP.has(c.toLowerCase())) return;
        if ((i > 0 && /^[A-Z]/.test(c)) || /^[A-Z][a-z]+[A-Z]/.test(c)) {
          nameCount.set(c.toLowerCase(), (nameCount.get(c.toLowerCase()) || 0) + 1);
          displayNames.set(c.toLowerCase(), c);
        }
      });
      // numeric facts
      for (const m of s.matchAll(NUM)) {
        const raw = parseFloat(m[2].replace(/,/g, ''));
        if (!isFinite(raw)) continue;
        const unit = (m[3] || '').toLowerCase();
        if (!unit && /^(19|20)\d\d$/.test(m[2])) continue; // a year, not a quantity
        const aft = labelAfter(s, (m.index || 0) + m[0].length);
        const bef = labelBefore(s, m.index || 0);
        const useBefore = (bef.copula && bef.label) || !aft;
        const label = useBefore ? bef.label : aft;
        if (!label) continue;
        const key = useBefore ? label.split(' ').slice(-2).join(' ') : label.split(' ').slice(0, 2).join(' ');
        const pct = unit === '%' || unit === 'percent';
        const value = pct ? raw : raw * (MULT[unit] || 1);
        const cur = m[1] || (/rupee|₹|inr/i.test(s) ? '₹' : /dollar|usd/i.test(s) ? '$' : '');
        const display = pct ? `${raw}%` : `${cur}${fmtNum(value)}`;
        facts.push({
          key, value, display, label, sentence: s, source: src.name, sourceId: src.id,
          terms: [...new Set([...tokens(label), ...terms])], status: stale ? 'check' : 'fresh',
        });
      }
    }
  }
  for (const [n, c] of nameCount) if (c >= 1) names.add(n);

  // conflicts: same key, different values, from different sources
  const byKey = new Map<string, Fact[]>();
  facts.forEach((f) => byKey.set(f.key, [...(byKey.get(f.key) || []), f]));
  const chosen = store.resolutions();
  for (const [k, list] of byKey) {
    const vals = [...new Set(list.map((f) => f.display))];
    const srcs = new Set(list.map((f) => f.sourceId));
    if (vals.length > 1 && srcs.size > 1) {
      if (chosen[k]) list.forEach((f) => { if (f.display !== chosen[k]) f.status = 'conflict'; else f.status = 'fresh'; });
      else list.forEach((f) => { f.status = 'conflict'; f.options = vals; });
    }
  }

  // idf for BM25
  const df = new Map<string, number>();
  sentences.forEach((x) => new Set(x.terms).forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
  const N = Math.max(1, sentences.length);
  const idf = new Map<string, number>();
  df.forEach((d, t) => idf.set(t, Math.log(1 + (N - d + 0.5) / (d + 0.5))));
  return { facts, names, displayNames, sentences, idf };
}

/** Which usable fact is this spoken sentence about? Needs real overlap, never guesses. */
export function matchFact(b: BrainIndex, spoken: string): Fact | null {
  const q = new Set(tokens(spoken));
  if (!q.size) return null;
  let best: Fact | null = null;
  let bestScore = 0;
  for (const f of b.facts) {
    if (f.status === 'conflict') continue; // never put a disputed number on a big screen
    const lt = tokens(f.label);
    const labelHits = lt.filter((t) => q.has(t) || q.has(t.replace(/s$/, ''))).length;
    // the sentence must name the fact, not just brush past one of its words
    if (!labelHits || (lt.length > 1 && labelHits < 2)) continue;
    let score = labelHits * 2;
    for (const t of f.terms) if (q.has(t)) score += b.idf.get(t) || 0.5;
    if (score > bestScore) { bestScore = score; best = f; }
  }
  return bestScore >= 3 ? best : null;
}

export function sourceSummary(sources: BrainSource[]) {
  return sources.map((s) => ({ ...s, words: s.text.split(/\s+/).filter(Boolean).length, stale: Date.now() - s.addedAt > 30 * DAY }));
}
