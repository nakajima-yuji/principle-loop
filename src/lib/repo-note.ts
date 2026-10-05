// リポジトリに置いた Markdown の Memo / 気づき（diary/・research/・memo/ の *.md）を読む。
// AI チャットなどから「PRINCIPLE LOOP へ送った」メモは、ここに Markdown として残っている。
// アプリはビルド時にこれを取り込み、DIARY の時系列に並べる（読むだけ。書き換えはしない）。
//
// 先頭に任意で次の「front matter」を書けば、種類・日時・テーマを指定できる（無くても動く）：
//   ---
//   type: memo
//   date: 2026-10-05
//   time: 21:30
//   tags: 痕跡、探索
//   ---
// type は memo / insight（気づき）。無ければフォルダで決める（memo/ → memo、それ以外 → insight）。
// date が無ければファイル名の先頭の日付、または本文の「Date: 2026-10-05」を使う。
// 本文に「・なぜ気になった？ → …」の 3 行があれば、3行DEEP として表示する。

import { parseLightDeep } from '../shared/deep.ts';
import type { LightDeep } from '../shared/types.ts';
import type { NoteSource } from './note.ts';
import { splitList, truncate } from './text.ts';

export interface RepoNote {
  id: string; // "repo-diary-2026-10-04-okada-engine-park-observation"
  path: string; // "diary/2026-10-04-okada-engine-park-observation.md"
  source: NoteSource;
  date: string; // "2026-10-04"（分からなければ ""）
  time: string; // "21:30"（分からなければ ""）
  title: string;
  excerpt: string;
  body: string; // front matter を除いた本文（Markdown）
  tags: string[];
  deep: LightDeep | null;
}

/** フォルダ名 → 種類（front matter の type が無いとき） */
export const REPO_NOTE_DIRS: Record<string, NoteSource> = { memo: 'memo', diary: 'insight', research: 'insight' };

function frontMatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(raw);
  if (!m) return { meta: {}, body: raw.replace(/^﻿/, '') };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^\s*([A-Za-z_]+)\s*:\s*(.*?)\s*$/.exec(line);
    if (kv) meta[kv[1].toLowerCase()] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { meta, body: raw.slice(m[0].length) };
}

function toSource(value: string | undefined, dir: string): NoteSource {
  const v = (value ?? '').trim();
  if (/^(memo|メモ)$/i.test(v)) return 'memo';
  if (/^(insight|気づき|観察|observation)$/i.test(v)) return 'insight';
  return REPO_NOTE_DIRS[dir] ?? 'insight';
}

function toDate(value: string | undefined): string {
  const m = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(value ?? '');
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';
}

function toTime(value: string | undefined): string {
  const m = /(\d{1,2}):(\d{2})/.exec(value ?? '');
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

/** 一覧に出す最初の段落（見出し・区切り線・「Date: …」のような書誌行は飛ばす） */
function firstParagraph(body: string): string {
  const out: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      if (out.length) break;
      continue;
    }
    if (/^#{1,6}\s/.test(line) || /^(-{3,}|\*{3,}|```)/.test(line) || /^[A-Za-z]+:\s/.test(line)) {
      if (out.length) break;
      continue;
    }
    out.push(line.replace(/^>\s?/, '').replace(/^(?:[-*・]|\d+\.)\s+/, '').replace(/\*\*|__|`/g, ''));
  }
  return out.join(' ');
}

export function parseRepoNote(path: string, raw: string): RepoNote {
  const clean = path.replace(/^\/+/, '');
  const parts = clean.split('/');
  const dir = parts.length > 1 ? parts[0] : '';
  const file = (parts[parts.length - 1] ?? clean).replace(/\.md$/i, '');
  const { meta, body } = frontMatter(raw ?? '');
  const heading = /^#\s+(.+?)\s*#*\s*$/m.exec(body)?.[1] ?? '';
  const date = toDate(meta.date) || toDate(/^(\d{4}-\d{2}-\d{2})/.exec(file)?.[1]) || toDate(/^\s*Date:\s*(.+)$/im.exec(body)?.[1]);
  // 見出しの先頭の日付（「2026-10-04 — 公園観察…」）は日付欄と重なるので外す
  const title = (meta.title || heading.replace(/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s*[—–\-:：|]?\s*/, '') || file).replace(/\*\*/g, '');
  return {
    id: `repo-${clean.replace(/\.md$/i, '').replace(/[^\w-]+/g, '-')}`,
    path: clean,
    source: toSource(meta.type ?? meta.source, dir),
    date,
    time: toTime(meta.time),
    title: truncate(title, 80),
    excerpt: truncate(firstParagraph(body), 140),
    body,
    tags: splitList(meta.tags ?? meta.theme ?? '').map((t) => t.replace(/^#/, '')),
    deep: parseLightDeep(body),
  };
}
