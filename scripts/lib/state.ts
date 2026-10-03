// 公開しない運用メモ（state/run-state.json）。行動履歴ではなく、二重実行を防ぐための記録だけ。

import { normalizeActivity } from '../../src/shared/activity.ts';
import type { Activity } from '../../src/shared/types.ts';
import { readJsonFile, writeJsonFile } from './fsutil.ts';
import type { Paths } from './paths.ts';

export interface RunState {
  lastGeneratedDate: string;
  lastMailedDate: string;
  pauseNoticePending: boolean;
  aiUsage: { date: string; requests: number };
}

export function emptyState(): RunState {
  return { lastGeneratedDate: '', lastMailedDate: '', pauseNoticePending: false, aiUsage: { date: '', requests: 0 } };
}

export async function readState(paths: Paths): Promise<RunState> {
  const raw = await readJsonFile<Partial<RunState>>(paths.stateFile, {});
  const e = emptyState();
  return {
    lastGeneratedDate: typeof raw.lastGeneratedDate === 'string' ? raw.lastGeneratedDate : e.lastGeneratedDate,
    lastMailedDate: typeof raw.lastMailedDate === 'string' ? raw.lastMailedDate : e.lastMailedDate,
    pauseNoticePending: raw.pauseNoticePending === true,
    aiUsage:
      raw.aiUsage && typeof raw.aiUsage.date === 'string' && typeof raw.aiUsage.requests === 'number'
        ? { date: raw.aiUsage.date, requests: raw.aiUsage.requests }
        : e.aiUsage,
  };
}

export async function writeState(paths: Paths, s: RunState): Promise<void> {
  await writeJsonFile(paths.stateFile, s);
}

export async function readActivity(paths: Paths): Promise<Activity> {
  return normalizeActivity(await readJsonFile<unknown>(paths.activityFile, {}));
}

export async function writeActivity(paths: Paths, a: Activity): Promise<void> {
  // 余計なフィールドを書かない（lastActive / inactivityDays / paused の 3 つだけ）
  await writeJsonFile(paths.activityFile, { lastActive: a.lastActive, inactivityDays: a.inactivityDays, paused: a.paused });
}
