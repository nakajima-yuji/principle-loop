// ブラウザ内の全文検索（DAILY の過去分 / DIARY / 原理 / タグ）。
// 件数は多くても数千件なので、単純な部分一致＋点数づけで十分速い。

import type { ArchiveIndex, DiaryEntry } from '../shared/types.ts';
import { isNoteItem } from './note.ts';
import { normalizeText } from './text.ts';

export interface SearchHit {
  kind: 'daily' | 'diary';
  id: string;
  date: string;
  category: string;
  title: string;
  snippet: string;
  principle: string;
  tags: string[];
  score: number;
  saved?: boolean;
}

function terms(query: string): string[] {
  return normalizeText(query)
    .split(/[\s　]+/)
    .map((t) => t.replace(/^#/, ''))
    .filter(Boolean);
}

function scoreFields(fields: { text: string; weight: number }[], qs: string[]): number {
  let total = 0;
  for (const q of qs) {
    let best = 0;
    for (const f of fields) {
      if (normalizeText(f.text).includes(q)) best = Math.max(best, f.weight);
    }
    if (best === 0) return 0; // すべての語を含むものだけ（AND 検索）
    total += best;
  }
  return total;
}

function snippetAround(text: string, qs: string[], width = 70): string {
  const t = text ?? '';
  const n = normalizeText(t);
  for (const q of qs) {
    const i = n.indexOf(q);
    if (i >= 0) {
      const start = Math.max(0, i - Math.floor(width / 3));
      return `${start > 0 ? '…' : ''}${t.slice(start, start + width)}${start + width < t.length ? '…' : ''}`;
    }
  }
  return t.slice(0, width) + (t.length > width ? '…' : '');
}

export function searchAll(query: string, archive: ArchiveIndex | null, diary: readonly DiaryEntry[]): SearchHit[] {
  const qs = terms(query);
  if (qs.length === 0) return [];
  const hits: SearchHit[] = [];
  const savedIds = new Set(diary.map((d) => d.id));

  for (const e of diary) {
    const it = e.item;
    const score = scoreFields(
      [
        { text: it.title, weight: 5 },
        { text: e.tags.join(' '), weight: 5 },
        { text: it.principleCandidate, weight: 4 },
        { text: e.memo, weight: 3 },
        { text: `${it.hook} ${it.minimumStructure} ${it.removePurpose}`, weight: 2 },
        { text: `${it.story} ${it.observation} ${it.sourceTitle} ${(it.tags ?? []).join(' ')}`, weight: 1 },
      ],
      qs,
    );
    if (score > 0) {
      hits.push({
        kind: 'diary',
        id: e.id,
        date: it.date,
        category: isNoteItem(it) ? '' : it.category, // Memo / 気づきは分野を持たない
        title: it.title,
        snippet: snippetAround(`${e.memo} ${it.hook}`, qs),
        principle: it.principleCandidate,
        tags: e.tags,
        score: score + 1,
      });
    }
  }

  for (const day of archive?.days ?? []) {
    for (const it of day.items) {
      if (savedIds.has(it.id)) continue; // DIARY 側で出す
      const score = scoreFields(
        [
          { text: it.title, weight: 5 },
          { text: (it.tags ?? []).join(' '), weight: 5 },
          { text: it.principleCandidate, weight: 4 },
          { text: `${it.hook} ${it.minimumStructure}`, weight: 2 },
          { text: `${it.sourceTitle} ${it.sourceName ?? ''}`, weight: 1 },
        ],
        qs,
      );
      if (score > 0) {
        hits.push({
          kind: 'daily',
          id: it.id,
          date: it.date,
          category: it.category,
          title: it.title,
          snippet: snippetAround(it.hook, qs),
          principle: it.principleCandidate,
          tags: it.tags ?? [],
          score,
        });
      }
    }
  }

  return hits.sort((a, b) => b.score - a.score || (a.date < b.date ? 1 : -1)).slice(0, 100);
}

/** 表示用：検索語をハイライトする位置 */
export function highlightRanges(text: string, query: string): [number, number][] {
  const qs = terms(query);
  const n = normalizeText(text);
  // normalizeText は長さを変えうるので、元の文字列と長さが同じときだけハイライトする
  if (n.length !== text.length) return [];
  const ranges: [number, number][] = [];
  for (const q of qs) {
    let i = n.indexOf(q);
    while (i >= 0) {
      ranges.push([i, i + q.length]);
      i = n.indexOf(q, i + q.length);
    }
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}
