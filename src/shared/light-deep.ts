// LIGHT DEEP：AI はここで止まる。3行だけ書いて、結論は出さない。
// 面白いかどうか・掘るかどうかは人間が選ぶ（HUMAN SELECT）。
// 夜間処理（生成・メール）とアプリの両方から使う。

import type { DailyItem, LightDeep } from './types.ts';

export type LightDeepKey = keyof LightDeep;

export const LIGHT_DEEP_LINES: readonly { key: LightDeepKey; label: string; short: string }[] = [
  { key: 'odd', label: '何が妙・面白い？', short: '妙' },
  { key: 'structure', label: '構造・原理候補', short: '構造' },
  { key: 'transfer', label: 'どこへ飛ばせそう？', short: '飛ばす' },
];

const LIMIT = 120;

function clip(s: string, max = LIMIT): string {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function sentences(text: string): string[] {
  return (text ?? '')
    .split(/(?<=[。．！？!?])/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** AI の返答（JSON の一部）を3行にそろえる。足りなければ null */
export function normalizeLightDeep(raw: unknown): LightDeep | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' ? clip(v.replace(/\r/g, '')) : '');
  const ld = { odd: s(r.odd), structure: s(r.structure), transfer: s(r.transfer) };
  return ld.odd && ld.structure && ld.transfer ? ld : null;
}

/** 自分で書いたもの（メモ・URL から入れた観察・CONNECT）。本文は AI の3行ではない */
const HUMAN_WRITTEN = new Set(['memo', 'manual', 'connect']);

/** 古いデータ（長い分析だけがある日）から3行を作る。新しい AI は呼ばない */
export function deriveLightDeep(item: DailyItem): LightDeep | null {
  if (item.analysisFailed || HUMAN_WRITTEN.has(item.aiProvider ?? '')) return null;
  const hookSentences = sentences(item.hook);
  const question = hookSentences.find((x) => /なぜ|[？?]$/.test(x));
  const odd = clip(question ?? hookSentences[0] ?? '');
  const structure = clip(item.principleCandidate || item.removePurpose || item.minimumStructure || '');
  const transfer = clip(item.transferIdeas?.[0] ?? '');
  if (!odd && !structure && !transfer) return null;
  return { odd, structure, transfer };
}

/**
 * 表示する3行。自分の言葉（mine）があれば行ごとにそちらを優先する。
 * 作成中止の記事は AI の3行が無いので、自分の言葉だけを返す。
 */
export function getLightDeep(item: DailyItem, mine?: Partial<LightDeep>): LightDeep | null {
  const ai = item.lightDeep ?? deriveLightDeep(item);
  const pick = (k: LightDeepKey) => (mine?.[k] ?? '').trim() || (ai?.[k] ?? '');
  const out = { odd: pick('odd'), structure: pick('structure'), transfer: pick('transfer') };
  return out.odd || out.structure || out.transfer ? out : null;
}
