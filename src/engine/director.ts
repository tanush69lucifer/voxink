import type { Cue, Scene, Source } from '../shared/types';
import { rid } from '../shared/bus';
import { type BrainIndex, fmtNum, matchFact } from './brain';
import { findPlaces, WORLDISH } from './geo';
import { iconFor } from './icons';
import { STOP, tokens } from './words';

/**
 * The rules director: turns one finished sentence into scene cues, in under a millisecond, offline.
 * The LLM director (server) can add or replace cues when it's switched on; these rules are always the floor.
 */
const MULT: Record<string, number> = { k: 1e3, thousand: 1e3, lakh: 1e5, lakhs: 1e5, crore: 1e7, crores: 1e7, million: 1e6, millions: 1e6, billion: 1e9 };
const NUMRE = '(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k|thousand|lakhs?|crores?|millions?|billion)?\\b';
const val = (n: string, m?: string) => parseFloat(n.replace(/,/g, '')) * (m ? MULT[m.toLowerCase()] || 1 : 1);
const trim = (s: string, n = 7) => s.trim().replace(/^(the|a|an)\s+/i, '').split(/\s+/).slice(0, n).join(' ').replace(/[.,;:!?]+$/, '');
const after = (s: string, i: number, n: number) => s.slice(i).split(/\s+/).map((x) => x.replace(/[^\w']/g, '')).filter((x) => x && !STOP.has(x.toLowerCase())).slice(0, n).join(' ');

export interface DirectorCtx { brain: BrainIndex; years: Set<number>; lastIconAt: number; muted: Record<string, boolean> }

const cue = (t0: number, source: Source, scene: Scene, title: string): Cue => ({ id: rid(), t0, source, scene, title });

export function directRules(sentence: string, t0: number, ctx: DirectorCtx): Cue[] {
  const s = sentence.trim();
  const low = s.toLowerCase();
  const out: Cue[] = [];
  const money = /[₹$]|rupee|dollar/.test(low);
  const prefix = money ? (low.includes('$') || low.includes('dollar') ? '$' : '₹') : '';

  const ft = low.match(new RegExp('from\\s+(?:[\\u20B9$]\\s*)?' + NUMRE + '.{0,30}?\\bto\\s+(?:[\\u20B9$]\\s*)?' + NUMRE + '\\s*([a-z]+(?:\\s+[a-z]+)?)?'));
  if (ft) {
    const a = val(ft[1], ft[2]), b = val(ft[3], ft[4]);
    const label = (ft[5] || '').split(' ').filter((x) => !STOP.has(x)).join(' ');
    out.push(cue(t0, 'rules', { kind: 'counter', from: a, to: b, label, prefix }, `Counter ${fmtNum(a)} → ${fmtNum(b)} ${label}`.trim()));
  }
  const pc = low.match(/(\d+(?:\.\d+)?)\s*(?:%|percent|per cent)/);
  if (pc) {
    const label = after(low, (pc.index || 0) + pc[0].length, 3);
    out.push(cue(t0, 'rules', { kind: 'ring', pct: parseFloat(pc[1]), label }, `Ring ${pc[1]}% ${label}`.trim()));
  }
  const cmp = s.match(/\b(unlike|instead of|compared to|rather than)\s+([^,.;]+)[,;]\s*([^.?!]+)/i);
  const vs = s.match(/(.{3,60}?)\s+(?:versus|vs\.?)\s+([^.?!]{3,60})/i);
  if (cmp) out.push(cue(t0, 'rules', { kind: 'split', old: trim(cmp[2]), new: trim(cmp[3]) }, `Split: ${trim(cmp[2], 3)} vs ${trim(cmp[3], 3)}`));
  else if (vs) out.push(cue(t0, 'rules', { kind: 'split', old: trim(vs[1].split(/[,;]/).pop() || ''), new: trim(vs[2]) }, 'Split comparison'));

  for (const m of low.matchAll(/\b(19[5-9]\d|20\d\d)\b(?!\s*(k|thousand|lakh|crore|million|billion|users|people|families|customers|%))/g)) {
    const y = +m[1];
    ctx.years.add(y);
    out.push(cue(t0, 'rules', { kind: 'timeline', years: [...ctx.years].sort(), now: y }, `Timeline ${y}`));
  }
  if (!ft && !pc) {
    const re = new RegExp('(?:[\\u20B9$]\\s*)?' + NUMRE, 'g');
    for (const m of low.matchAll(re)) {
      if (!m[2] && /^(19[5-9]\d|20\d\d)$/.test(m[1])) continue;
      const v = val(m[1], m[2]);
      if (v < 2) continue;
      const label = after(low, (m.index || 0) + m[0].length, 2);
      out.push(cue(t0, 'rules', { kind: 'counter', to: v, label, prefix }, `Counter ${fmtNum(v)} ${label}`.trim()));
      break;
    }
  }
  // Brain: the speaker mentions something it knows a number for, without saying the number
  if (!out.length) {
    const f = matchFact(ctx.brain, s);
    if (f) out.push(cue(t0, 'brain', { kind: 'fact', value: f.display, label: f.label, source: f.source }, `Fact: ${f.display} ${f.label}`));
  }
  // Real places -> a real globe
  const pins = findPlaces(s);
  if (pins.length || WORLDISH.test(s)) {
    out.push(cue(t0, '3d', { kind: 'globe', pins, label: pins.map((p) => p.name).join(' · ') }, pins.length ? `Globe: ${pins.map((p) => p.name).join(', ')}` : 'Globe'));
  }
  if (!out.length && (/\?\s*$/.test(s) || /^\s*(imagine|what if|ever wondered|why|how many|how much)\b/i.test(s))) {
    out.push(cue(t0, 'rules', { kind: 'question', text: s }, 'Question card'));
  }
  // Nothing else? A big icon for the most meaningful concrete noun — at most every 5 s so the stage breathes
  if (!out.length && t0 - ctx.lastIconAt > 5000) {
    const cands = tokens(s).filter((w) => !ctx.muted[w]);
    const ranked = cands.map((w) => ({ w, i: iconFor(w), score: (ctx.brain.names.has(w) ? 3 : 0) + w.length / 4 })).filter((x) => x.i).sort((a, b) => b.score - a.score);
    if (ranked.length) {
      ctx.lastIconAt = t0;
      out.push(cue(t0, 'icon', { kind: 'icon', icon: ranked[0].i!, label: ranked[0].w }, `Icon: ${ranked[0].w}`));
    }
  }
  return out;
}

/** A short photo search for a sentence: the two most specific nouns. */
export function photoQuery(sentence: string): string {
  return tokens(sentence).filter((w) => !/^(year|years|last|next|first|today|every|most|much)$/.test(w)).sort((a, b) => b.length - a.length).slice(0, 2).join(' ');
}
