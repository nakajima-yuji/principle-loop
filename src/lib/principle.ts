// DAILY の分析（AI の下書き）と、ユーザー自身の DEEP の答えを重ねて「原理」として扱う。
// ユーザーが書いた答えがあれば、そちらを優先する。

import type { CategoryId, ConnectionResult, DailyItem, DeepNotes } from '../shared/types.ts';

export interface PrincipleSource {
  id: string;
  kind: 'item' | 'connection';
  title: string;
  category: CategoryId | 'connect';
  principle: string;
  minimumStructure: string;
  input: string;
  transformation: string;
  speed: string;
  discard: string;
  tradeoff: string;
  counterexample: string;
  hypothesis: string;
  invert: string;
  transferIdeas: string[];
  tags: string[];
}

const pick = (mine: string | undefined, ai: string | undefined) => ((mine ?? '').trim() ? (mine ?? '').trim() : (ai ?? '').trim());

export function toPrincipleSource(item: DailyItem, notes?: Partial<DeepNotes>): PrincipleSource {
  const transferMine = (notes?.transfer ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  return {
    id: item.id,
    kind: 'item',
    title: item.title,
    category: item.category,
    principle: pick(notes?.principleCandidate, item.principleCandidate),
    minimumStructure: pick(notes?.minimumStructure, item.minimumStructure),
    input: pick(notes?.input, item.input),
    transformation: pick(notes?.transformation, item.transformation),
    speed: pick(notes?.speed, item.speed),
    discard: pick(notes?.discard, item.discard),
    tradeoff: pick(notes?.tradeoff, item.tradeoff),
    counterexample: pick(notes?.counterexample, item.counterexample),
    hypothesis: pick(notes?.hypothesis, item.hypothesis ?? item.why),
    invert: pick(notes?.invert, item.invert),
    transferIdeas: transferMine.length ? transferMine : item.transferIdeas ?? [],
    tags: item.tags ?? [],
  };
}

export function connectionToSource(c: ConnectionResult): PrincipleSource {
  return {
    id: c.id,
    kind: 'connection',
    title: `${c.leftTitle} × ${c.rightTitle}`,
    category: 'connect',
    principle: c.newStructure,
    minimumStructure: c.newStructure,
    input: '',
    transformation: '',
    speed: '',
    discard: '',
    tradeoff: '',
    counterexample: '',
    hypothesis: c.minimumExperiment,
    invert: '',
    transferIdeas: c.newUse ? c.newUse.split('\n').filter(Boolean) : [],
    tags: [],
  };
}
