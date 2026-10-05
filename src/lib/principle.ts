// DAILY の分析（AI の下書き）と、ユーザー自身の DEEP の答えを重ねて「原理」として扱う。
// ユーザーが書いた答えがあれば、そちらを優先する。
// CONNECT では観察・原理だけでなく、思考エンジン・道具・メディア・実験もぶつけられる（node）。

import { getLightDeep } from '../shared/light-deep.ts';
import type { CategoryId, ConnectionResult, DailyItem, DeepNotes, LightDeep, NodeKind } from '../shared/types.ts';

export interface PrincipleSource {
  id: string;
  kind: 'item' | 'connection';
  node?: NodeKind;
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

export function toPrincipleSource(item: DailyItem, notes?: Partial<DeepNotes>, light?: Partial<LightDeep>): PrincipleSource {
  const transferMine = (notes?.transfer ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  const ld = getLightDeep(item, light);
  const memo = item.aiProvider === 'memo' ? item.hook : '';
  const principle = pick(notes?.principleCandidate, pick(light?.structure, item.principleCandidate || ld?.structure || memo));
  return {
    id: item.id,
    kind: 'item',
    node: principle && principle !== memo ? 'principle' : 'observation',
    title: item.title,
    category: item.category,
    principle,
    minimumStructure: pick(notes?.minimumStructure, item.minimumStructure),
    input: pick(notes?.input, item.input),
    transformation: pick(notes?.transformation, item.transformation),
    speed: pick(notes?.speed, item.speed),
    discard: pick(notes?.discard, item.discard),
    tradeoff: pick(notes?.tradeoff, item.tradeoff),
    counterexample: pick(notes?.counterexample, item.counterexample),
    hypothesis: pick(notes?.hypothesis, item.hypothesis ?? item.why),
    invert: pick(notes?.invert, item.invert),
    transferIdeas: transferMine.length ? transferMine : item.transferIdeas?.length ? item.transferIdeas : ld?.transfer ? [ld.transfer] : [],
    tags: item.tags ?? [],
  };
}

export function connectionToSource(c: ConnectionResult): PrincipleSource {
  return {
    id: c.id,
    kind: 'connection',
    node: 'principle',
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

const blank = {
  minimumStructure: '',
  input: '',
  transformation: '',
  speed: '',
  discard: '',
  tradeoff: '',
  counterexample: '',
  hypothesis: '',
  invert: '',
};

/** 思考エンジン・メディアも CONNECT でぶつけられるようにする（土台） */
export function engineToSource(e: { id: string; name: string; shortDescription: string; process: readonly string[] }): PrincipleSource {
  return {
    ...blank,
    id: `engine:${e.id}`,
    kind: 'item',
    node: 'engine',
    title: `ENGINE ${e.name}`,
    category: 'connect',
    principle: e.shortDescription,
    minimumStructure: e.process.join(' → '),
    transferIdeas: [],
    tags: ['ENGINE'],
  };
}

export function mediumToSource(m: { id: string; ja: string }): PrincipleSource {
  return {
    ...blank,
    id: `medium:${m.id}`,
    kind: 'item',
    node: 'medium',
    title: `MEDIUM ${m.ja}`,
    category: 'connect',
    principle: `${m.ja}として出す`,
    transferIdeas: [],
    tags: ['MEDIUM'],
  };
}
