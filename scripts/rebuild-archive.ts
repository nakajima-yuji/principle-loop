// public/data/daily/*.json から検索用の索引（public/data/archive/index.json）を作り直す。
// 使い方: node scripts/rebuild-archive.ts

import path from 'node:path';
import { emptyArchive, upsertArchiveDay } from '../src/shared/archive.ts';
import type { DailyFile } from '../src/shared/types.ts';
import { listFiles, readJsonFile, writeJsonFile } from './lib/fsutil.ts';
import { makePaths } from './lib/paths.ts';

const paths = makePaths();
let index = emptyArchive();
for (const f of await listFiles(paths.dailyDir, '.json')) {
  const daily = await readJsonFile<DailyFile | null>(path.join(paths.dailyDir, f), null);
  if (daily?.items?.length) index = upsertArchiveDay(index, daily, new Date().toISOString());
}
await writeJsonFile(paths.archiveFile, index);
console.log(`archive: ${index.days.length} 日分を書き出しました → ${path.relative(paths.root, paths.archiveFile)}`);
