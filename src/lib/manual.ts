// X の投稿や気になった記事を「URL入力 → DEEPへ送る」ための手動アイテム。
// X API には依存しない。中身（何が起きているか）はユーザーが自分の言葉で書く。

import type { CategoryId, DailyItem } from '../shared/types.ts';
import { jstDateString } from '../shared/time.ts';

export interface ManualInput {
  url: string;
  title: string;
  phenomenon: string;
  category: CategoryId;
}

export function hostLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host === 'x.com' || host === 'twitter.com') return 'X';
    return host;
  } catch {
    return '';
  }
}

export function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function createManualItem(input: ManualInput, now: Date, id: string): DailyItem {
  const date = jstDateString(now);
  const phenomenon = input.phenomenon.trim();
  return {
    id,
    date,
    category: input.category,
    title: input.title.trim() || phenomenon.slice(0, 40) || '自分で見つけた現象',
    hook: phenomenon,
    story: '',
    sourceTitle: input.title.trim() || input.url,
    sourceUrl: input.url.trim(),
    sourceDate: date,
    sourceName: hostLabel(input.url) || '自分のメモ',
    observation: phenomenon,
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
    saved: true,
    aiProvider: 'manual',
  };
}
