// 「作成中止」（AI の分析を作れなかった記事）の判定。アプリ・メール・夜間処理で共通に使う。

import type { DailyFile, DailyItem } from './types.ts';

export const FAILED_LABEL = '作成中止';
const LEGACY_REASON = '理由は記録されていません';

const EMPTY_ANALYSIS = {
  story: '',
  input: '',
  inputTypes: [],
  transformation: '',
  why: '',
  speed: '',
  speedTypes: [],
  discard: '',
  discardTypes: [],
  tradeoff: '',
  minimumStructure: '',
  removePurpose: '',
  principleCandidate: '',
  counterexample: '',
  transferIdeas: [],
  hypothesis: '',
  boundary: [],
  invert: '',
  tags: [],
  transferability: 0,
  lightDeep: undefined,
} satisfies Partial<DailyItem>;

export function isAnalysisFailed(item: Pick<DailyItem, 'analysisFailed'>): boolean {
  return item.analysisFailed === true;
}

/**
 * 古いデータ（作成中止の印が無かったころ）にも印を付ける。
 * AI を使った日なのに、1 件だけ仮のテンプレート（mock）になっているものは作成中止として扱う。
 */
export function withFailureFlags(daily: DailyFile): DailyFile {
  if (daily.provider === 'mock' || daily.provider === 'sample') return daily;
  let changed = false;
  const items = daily.items.map((it) => {
    if (it.analysisFailed || it.aiProvider !== 'mock') return it;
    changed = true;
    // 仮のテンプレート文（「（未分析）…」など）は見せない。事実（情報源の要約）だけ残す
    return {
      ...it,
      ...EMPTY_ANALYSIS,
      analysisFailed: true,
      failReason: it.failReason || LEGACY_REASON,
    };
  });
  return changed ? { ...daily, items } : daily;
}

export function failedItems(daily: DailyFile): DailyItem[] {
  return withFailureFlags(daily).items.filter(isAnalysisFailed);
}
