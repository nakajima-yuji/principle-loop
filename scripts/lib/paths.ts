import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export interface Paths {
  root: string;
  dataDir: string; // GitHub Pages に公開されるデータ
  dailyDir: string;
  archiveFile: string;
  activityFile: string;
  stateFile: string; // 公開しない運用メモ（最終生成日など）
  configDir: string;
}

export function makePaths(root = ROOT, dataRoot = root): Paths {
  const dataDir = path.join(dataRoot, 'public', 'data');
  return {
    root,
    dataDir,
    dailyDir: path.join(dataDir, 'daily'),
    archiveFile: path.join(dataDir, 'archive', 'index.json'),
    activityFile: path.join(dataDir, 'activity.json'),
    stateFile: path.join(dataRoot, 'state', 'run-state.json'),
    configDir: path.join(root, 'config'),
  };
}
