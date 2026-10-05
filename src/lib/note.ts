// Memo / 気づき と、DIARY の時系列（DAILY と自分のメモを同じ日付で並べる）。
// 画面に依存しないロジックだけを置く（Node のテストからも使う）。
//
// Memo / 気づきは、既存の DIARY と同じ DiaryEntry として保存する（kind: 'manual' + source）。
// そのため、状態（観察 → 仮説 → 原理候補 …）・DEEP・CONNECT・BUILD・検索・バックアップがそのまま使える。

import { jstDateString } from '../shared/time.ts';
import type { DailyItem, DeepNotes, DiaryEntry, DiarySource, PrincipleState } from '../shared/types.ts';
import type { RepoNote } from './repo-note.ts';
import { normalizeText, truncate } from './text.ts';

export type NoteSource = Exclude<DiarySource, 'daily'>;

export const SOURCES: readonly { id: DiarySource; label: string; description: string }[] = [
  { id: 'daily', label: 'DAILY', description: 'AI・自動収集で見つけた世界の現象' },
  { id: 'memo', label: 'MEMO', description: '自分が PRINCIPLE LOOP へ送ったメモ' },
  { id: 'insight', label: '気づき', description: '自分の観察・発見・違和感・仮説' },
];

export function sourceLabel(source: DiarySource): string {
  return SOURCES.find((s) => s.id === source)?.label ?? source;
}

export function isDiarySource(v: unknown): v is DiarySource {
  return v === 'daily' || v === 'memo' || v === 'insight';
}

/**
 * DIARY の 1 件の情報源。古いデータ（source が無い）は作り方から判定する：
 * DAILY から保存 / CONNECT → daily、自分で追加（URL から掘る）→ memo（自分が PRINCIPLE LOOP へ送ったもの）
 */
export function diarySource(entry: Pick<DiaryEntry, 'kind' | 'source' | 'item'>): DiarySource {
  if (isDiarySource(entry.source)) return entry.source;
  const p = entry.item?.aiProvider;
  if (p === 'memo' || p === 'insight') return p;
  return entry.kind === 'manual' ? 'memo' : 'daily';
}

/** Memo / 気づきの 1 行目を見出しにする */
export function noteTitle(text: string): string {
  const first = (text ?? '').trim().split('\n')[0] ?? '';
  return truncate(first, 48) || 'メモ';
}

/**
 * Memo / 気づきを、DIARY に入れられる形（DailyItem のスナップショット）にする。
 * 本文は hook と observation に入れる。分析の欄は空のまま（必要になったら 3行DEEP や DEEP で足す）。
 */
export function createNoteItem(input: { text: string; source: NoteSource }, now: Date, id: string): DailyItem {
  const date = jstDateString(now);
  const text = input.text.trim();
  return {
    id,
    date,
    category: 'foreign', // 分野は持たない（CONNECT の保存と同じ扱い）。画面では SOURCE を表示する
    title: noteTitle(text),
    hook: text,
    story: '',
    sourceTitle: sourceLabel(input.source),
    sourceUrl: '',
    sourceDate: date,
    sourceName: sourceLabel(input.source),
    observation: text,
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
    aiProvider: input.source,
  };
}

/** 本文を書き直したときの item（見出しも 1 行目に合わせる） */
export function withNoteText(item: DailyItem, text: string): DailyItem {
  return { ...item, title: noteTitle(text), hook: text, observation: text };
}

/** MEMO ↔ 気づき を切り替えたときの item */
export function withNoteSource(item: DailyItem, source: NoteSource): DailyItem {
  return { ...item, aiProvider: source, sourceName: sourceLabel(source), sourceTitle: sourceLabel(source) };
}

export function isNoteItem(item: Pick<DailyItem, 'aiProvider'>): boolean {
  return item.aiProvider === 'memo' || item.aiProvider === 'insight';
}

/** 新しい Memo / 気づきの DIARY エントリ（最初は「観察」。育てば原理候補へ） */
export function createNoteEntry(input: { text: string; source: NoteSource; tags?: string[] }, now: Date, id: string): DiaryEntry {
  const iso = now.toISOString();
  const state: PrincipleState = 'OBSERVATION';
  return {
    id,
    kind: 'manual',
    source: input.source,
    state,
    item: createNoteItem(input, now, id),
    memo: '',
    tags: [...new Set((input.tags ?? []).map((t) => t.trim().replace(/^#/, '')).filter(Boolean))],
    experiments: [],
    createdAt: iso,
    updatedAt: iso,
  };
}

// ---------------- 時系列 ----------------

/** DIARY の 1 行。端末に保存したもの（entry）と、リポジトリの Markdown（repo）のどちらか */
export interface TimelineItem {
  id: string;
  source: DiarySource;
  /** 日付（"2026-10-05"。分からなければ ""） */
  date: string;
  /** 同じ日の中で並べるための時刻（ISO。分からなければ ""） */
  at: string;
  title: string;
  /** 一覧の 2 行目 */
  text: string;
  tags: string[];
  state?: PrincipleState;
  entry?: DiaryEntry;
  repo?: RepoNote;
}

const isDate = (s: string | undefined): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** その日「見つけた」日付：DAILY は AI が拾った日、Memo / 気づきは送った日 */
export function entryDate(entry: Pick<DiaryEntry, 'item' | 'createdAt'>): string {
  if (isDate(entry.item?.date)) return entry.item.date;
  const d = new Date(entry.createdAt);
  return Number.isNaN(d.getTime()) ? '' : jstDateString(d);
}

export function entryToTimeline(entry: DiaryEntry, notes?: Partial<DeepNotes>): TimelineItem {
  const source = diarySource(entry);
  const it = entry.item;
  const note = isNoteItem(it);
  const body = (it.hook ?? '').trim();
  const rest = note ? body.split('\n').slice(1).join(' ').trim() : '';
  return {
    id: entry.id,
    source,
    date: entryDate(entry),
    at: entry.createdAt,
    title: it.title,
    text: note ? rest : notes?.principleCandidate?.trim() || it.principleCandidate || it.hook,
    tags: entry.tags,
    state: entry.state,
    entry,
  };
}

export function repoToTimeline(n: RepoNote): TimelineItem {
  let at = '';
  if (n.date) {
    const d = new Date(`${n.date}T${n.time || '00:00'}:00+09:00`);
    if (!Number.isNaN(d.getTime())) at = d.toISOString();
  }
  return { id: n.id, source: n.source, date: n.date, at, title: n.title, text: n.excerpt, tags: n.tags, repo: n };
}

export interface TimelineFilter {
  source?: DiarySource | null;
  state?: string | null;
  tag?: string | null;
  query?: string;
}

export function filterTimeline(items: readonly TimelineItem[], f: TimelineFilter): TimelineItem[] {
  const q = normalizeText(f.query ?? '');
  return items.filter((t) => {
    if (f.source && t.source !== f.source) return false;
    if (f.state && t.state !== f.state) return false; // リポジトリの Markdown には状態が無い
    if (f.tag && !t.tags.includes(f.tag)) return false;
    if (!q) return true;
    const hay = `${t.title} ${t.text} ${t.tags.join(' ')} ${t.entry?.memo ?? ''} ${t.entry ? t.entry.item.hook : t.repo?.body ?? ''}`;
    return normalizeText(hay).includes(q);
  });
}

/** 日付ごとにまとめる。新しい日が上、同じ日の中も新しいものが上。日付の分からないものは最後 */
export function groupByDate(items: readonly TimelineItem[]): { date: string; items: TimelineItem[] }[] {
  const map = new Map<string, TimelineItem[]>();
  for (const t of items) map.set(t.date, [...(map.get(t.date) ?? []), t]);
  return [...map.entries()]
    .sort(([a], [b]) => (a === b ? 0 : !a ? 1 : !b ? -1 : a < b ? 1 : -1))
    .map(([date, list]) => ({ date, items: [...list].sort((x, y) => (x.at === y.at ? 0 : x.at < y.at ? 1 : -1)) }));
}

export function countBySource(items: readonly TimelineItem[]): Record<DiarySource, number> {
  const c: Record<DiarySource, number> = { daily: 0, memo: 0, insight: 0 };
  items.forEach((t) => (c[t.source] += 1));
  return c;
}
