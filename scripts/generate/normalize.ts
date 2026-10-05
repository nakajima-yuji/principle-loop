// AI の出力は信用しすぎない。型・長さ・選択肢をここでそろえる。
// 出典（URL・タイトル・日付）は AI に書かせず、収集したデータから入れる（作り話の URL を防ぐ）。

import { normalizeLightDeep } from '../../src/shared/deep.ts';
import { BOUNDARY_PROBES, CORE_QUESTIONS } from '../../src/shared/questions.ts';
import type { BoundaryProbe, CategoryId, DailyItem } from '../../src/shared/types.ts';
import type { Candidate } from '../filter/filter.ts';

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\r/g, '').trim().slice(0, max) : '');

const strList = (v: unknown, maxItems: number, maxLen: number): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems) : [];

const pickOptions = (v: unknown, options: readonly string[], max: number): string[] => strList(v, 10, 30).filter((x) => options.includes(x)).slice(0, max);

const opts = (key: 'input' | 'speed' | 'discard') => CORE_QUESTIONS.find((q) => q.key === key)?.options ?? [];

function normalizeStory(v: unknown): string {
  const s = str(v, 2400);
  return s
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, '').trim())
    .filter(Boolean)
    .slice(0, 6)
    .join('\n\n');
}

function normalizeBoundary(v: unknown): BoundaryProbe[] {
  if (!Array.isArray(v)) return [];
  const map = new Map<string, string>();
  for (const b of v) {
    const probe = str((b as BoundaryProbe)?.probe, 40);
    const answer = str((b as BoundaryProbe)?.answer, 240);
    const match = BOUNDARY_PROBES.find((p) => p === probe || p.replace('？', '') === probe.replace(/[?？]/, ''));
    if (match && answer && answer !== '1〜2文') map.set(match, answer);
  }
  return BOUNDARY_PROBES.filter((p) => map.has(p)).map((p) => ({ probe: p, answer: map.get(p) ?? '' }));
}

export function toDailyItem(
  raw: unknown,
  c: Candidate,
  meta: { id: string; date: string; category: CategoryId; provider: string; image?: string },
): DailyItem {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const t = typeof r.transferability === 'number' && Number.isFinite(r.transferability) ? r.transferability : 0.5;
  // 3行DEEP。3行そろっていなければ付けない（アプリ側で既存の分析から短く抜き出して補う）。仮のテンプレートには付けない
  const deep = meta.provider === 'mock' ? undefined : normalizeLightDeep(r.deep, 'ai', { requireAll: true });
  return {
    id: meta.id,
    date: meta.date,
    category: meta.category,
    title: str(r.title, 80) || c.title.slice(0, 80),
    hook: str(r.hook, 320) || c.summary.slice(0, 200),
    story: normalizeStory(r.story),
    sourceTitle: c.title,
    sourceUrl: c.url,
    sourceDate: c.published ? c.published.slice(0, 10) : '',
    sourceName: c.sourceName,
    image: meta.image ?? c.image,
    observation: str(r.observation, 500) || c.summary.slice(0, 300),
    input: str(r.input, 300),
    inputTypes: pickOptions(r.inputTypes, opts('input'), 4),
    transformation: str(r.transformation, 200),
    why: str(r.why, 300),
    speed: str(r.speed, 300),
    speedTypes: pickOptions(r.speedTypes, opts('speed'), 3),
    discard: str(r.discard, 300),
    discardTypes: pickOptions(r.discardTypes, opts('discard'), 3),
    tradeoff: str(r.tradeoff, 160),
    minimumStructure: str(r.minimumStructure, 200),
    removePurpose: str(r.removePurpose, 240),
    principleCandidate: str(r.principleCandidate, 200),
    counterexample: str(r.counterexample, 400),
    transferIdeas: strList(r.transferIdeas, 4, 120),
    hypothesis: str(r.hypothesis, 240),
    boundary: normalizeBoundary(r.boundary),
    invert: str(r.invert, 300),
    tags: strList(r.tags, 5, 20).map((x) => x.replace(/^#/, '')),
    transferability: Math.max(0, Math.min(1, Math.round(t * 100) / 100)),
    aiProvider: meta.provider,
    saved: false,
    ...(deep ? { deep } : {}),
  };
}

/** 生成された 1 件が最低限そろっているか（そろっていなければ作り直し or 代替） */
export function isUsable(item: DailyItem): boolean {
  return Boolean(item.title && item.hook && item.principleCandidate && item.minimumStructure);
}

/**
 * 作成中止の 1 件。それらしい仮の文章では埋めず、情報源のタイトルと要約（事実）だけを残す。
 * 読む・掘る・保存はできるので、ユーザーが自分で分解することはできる。
 */
export function toFailedItem(c: Candidate, meta: { id: string; date: string; category: CategoryId; image?: string }, reason: string): DailyItem {
  const summary = c.summary.replace(/\s+/g, ' ').trim();
  return {
    id: meta.id,
    date: meta.date,
    category: meta.category,
    title: c.title.slice(0, 120),
    hook: summary.slice(0, 220),
    story: '',
    sourceTitle: c.title,
    sourceUrl: c.url,
    sourceDate: c.published ? c.published.slice(0, 10) : '',
    sourceName: c.sourceName,
    image: meta.image ?? c.image,
    observation: summary.slice(0, 500),
    input: '',
    transformation: '',
    why: '',
    speed: '',
    discard: '',
    tradeoff: '',
    minimumStructure: '',
    removePurpose: '',
    principleCandidate: '',
    counterexample: '',
    transferIdeas: [],
    tags: [],
    transferability: 0,
    aiProvider: 'failed',
    analysisFailed: true,
    failReason: reason,
    saved: false,
  };
}

/** 作り直し用：保存済みの 1 件から、AI に渡す材料（候補）を組み立て直す */
export function candidateFromItem(it: DailyItem): Candidate {
  return {
    key: it.id,
    sourceId: 'repair',
    sourceName: it.sourceName ?? '',
    category: it.category,
    foreign: it.category === 'foreign',
    title: it.sourceTitle || it.title,
    url: it.sourceUrl,
    summary: it.observation || it.hook,
    published: it.sourceDate,
    image: it.image,
    lang: '',
    score: 0,
    interest: 0,
  };
}
