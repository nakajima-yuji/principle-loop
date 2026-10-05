// リポジトリの diary/・research/・memo/ に置いた Markdown（PRINCIPLE LOOP へ送った Memo / 気づき）を読む。
// ビルド時に Vite が取り込むので、夜間処理やワークフローの変更は要らない（main に push すると Pages が作り直される）。
// ファイルごとに別のチャンクになり、DIARY を開いたときだけ読み込む。

import { parseRepoNote, type RepoNote } from '../lib/repo-note.ts';
import { getSettings, repoUrl } from './settings.ts';

const files = import.meta.glob<string>(['/diary/*.md', '/research/*.md', '/memo/*.md'], { query: '?raw', import: 'default' });

let cache: Promise<RepoNote[]> | null = null;

export function loadRepoNotes(): Promise<RepoNote[]> {
  cache ??= Promise.all(Object.entries(files).map(async ([path, load]) => parseRepoNote(path, await load()))).catch((e) => {
    cache = null;
    throw e;
  });
  return cache;
}

/** GitHub 上のファイルの URL（リポジトリが分からなければ ""） */
export function repoNoteUrl(note: RepoNote): string {
  const base = repoUrl();
  return base ? `${base}/blob/${encodeURIComponent(getSettings().githubBranch || 'main')}/${note.path.split('/').map(encodeURIComponent).join('/')}` : '';
}
