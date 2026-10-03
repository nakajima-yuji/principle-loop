// 10日間無反応で自動停止する仕組みの判定ロジック。
// 夜間処理（GitHub Actions）とアプリ画面の両方で同じ計算を使う。

import type { Activity } from './types.ts';
import { DAY_MS, isSundayJst } from './time.ts';

export const DEFAULT_INACTIVITY_LIMIT_DAYS = 10;

export function emptyActivity(): Activity {
  return { lastActive: '', inactivityDays: 0, paused: false };
}

/** 外部から読んだ JSON を安全な形にそろえる（余計なフィールドは捨てる） */
export function normalizeActivity(raw: unknown): Activity {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const lastActive = typeof r.lastActive === 'string' && !Number.isNaN(Date.parse(r.lastActive)) ? r.lastActive : '';
  const inactivityDays =
    typeof r.inactivityDays === 'number' && Number.isFinite(r.inactivityDays) && r.inactivityDays >= 0
      ? Math.floor(r.inactivityDays)
      : 0;
  return { lastActive, inactivityDays, paused: r.paused === true };
}

/** 最後の反応から何日（24時間単位）経ったか */
export function computeInactivityDays(lastActive: string, now: Date): number {
  const t = Date.parse(lastActive);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

export function daysUntilPause(activity: Activity, now: Date, limitDays = DEFAULT_INACTIVITY_LIMIT_DAYS): number {
  if (!activity.lastActive) return limitDays;
  return Math.max(0, limitDays - computeInactivityDays(activity.lastActive, now));
}

export type RunDecision =
  | { kind: 'skip-sunday' }
  | { kind: 'skip-paused' }
  | { kind: 'pause'; activity: Activity }
  | { kind: 'run'; activity: Activity };

/**
 * 夜間処理の冒頭で必ず呼ぶ。
 * 日曜？ → 終了 / paused？ → 終了 / 10日無反応？ → 停止 / それ以外 → 実行
 * メール送信はここで活動扱いにしない（lastActive を更新するのはユーザー操作だけ）。
 */
export function decideRun(
  activity: Activity,
  now: Date,
  limitDays = DEFAULT_INACTIVITY_LIMIT_DAYS,
): RunDecision {
  if (isSundayJst(now)) return { kind: 'skip-sunday' };
  if (activity.paused) return { kind: 'skip-paused' };

  // 初回（まだ一度も記録がない）は、セットアップした時点を最初の活動とみなす。
  if (!activity.lastActive) {
    return { kind: 'run', activity: { lastActive: now.toISOString(), inactivityDays: 0, paused: false } };
  }

  const inactivityDays = computeInactivityDays(activity.lastActive, now);
  if (limitDays > 0 && inactivityDays >= limitDays) {
    return { kind: 'pause', activity: { lastActive: activity.lastActive, inactivityDays, paused: true } };
  }
  return { kind: 'run', activity: { lastActive: activity.lastActive, inactivityDays, paused: false } };
}

/** アプリで反応があった（記事を開いた・掘った・保存した など）。停止中なら停止のまま。 */
export function applyHeartbeat(activity: Activity, now: Date): Activity {
  return { lastActive: now.toISOString(), inactivityDays: 0, paused: activity.paused };
}

/** 「PRINCIPLE LOOPを再開」ボタン */
export function applyResume(now: Date): Activity {
  return { lastActive: now.toISOString(), inactivityDays: 0, paused: false };
}
