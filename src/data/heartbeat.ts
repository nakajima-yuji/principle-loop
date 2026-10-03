// 10日自動停止のための「活動通知（heartbeat）」。
//
// GitHub Pages は書き込みができないので、ユーザーが自分で作った
// 「このリポジトリの Actions だけを実行できるトークン」を使い、
// activity.yml ワークフローを起動して data/activity.json を更新してもらう。
// - トークンはこのブラウザの中にだけ保存し、どこにも送らない（GitHub API 以外）。
// - 送るのは「反応があった」という事実だけ。何を読んだか等の行動履歴は送らない。
// - 1日1回まで。メールを送っただけでは活動にならない（ここを通るのはアプリ操作だけ）。

import { jstDateString } from '../shared/time.ts';
import { getLocalActivity, getSettings, hasHeartbeatToken, updateLocalActivity } from './settings.ts';

export const ACTIVITY_WORKFLOW = 'activity.yml';
export const DAILY_WORKFLOW = 'principle-loop-daily.yml';

export interface DispatchResult {
  ok: boolean;
  status: number;
  message: string;
}

export async function dispatchActivity(action: 'heartbeat' | 'resume', runNow = false): Promise<DispatchResult> {
  const s = getSettings();
  if (!hasHeartbeatToken(s)) {
    return { ok: false, status: 0, message: 'GitHub 連携（トークン）が未設定です' };
  }
  const url = `https://api.github.com/repos/${encodeURIComponent(s.githubOwner)}/${encodeURIComponent(
    s.githubRepo,
  )}/actions/workflows/${ACTIVITY_WORKFLOW}/dispatches`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${s.githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: s.githubBranch || 'main', inputs: { action, run_now: runNow ? 'true' : 'false' } }),
    });
    if (res.status === 204 || res.ok) return { ok: true, status: res.status, message: '送信しました' };
    const hint =
      res.status === 401
        ? 'トークンが無効か期限切れです'
        : res.status === 403
          ? 'トークンに Actions の書き込み権限がありません'
          : res.status === 404
            ? 'リポジトリかワークフローが見つかりません（名前・権限を確認）'
            : res.status === 422
              ? 'ブランチ名か入力が正しくありません'
              : `エラー（${res.status}）`;
    return { ok: false, status: res.status, message: hint };
  } catch {
    return { ok: false, status: 0, message: 'ネットワークに接続できませんでした' };
  }
}

/** 設定画面の「接続テスト」：ワークフローが見えるかだけ確認する（何も実行しない） */
export async function testConnection(): Promise<DispatchResult> {
  const s = getSettings();
  if (!hasHeartbeatToken(s)) return { ok: false, status: 0, message: 'トークンが未入力です' };
  try {
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(s.githubOwner)}/${encodeURIComponent(s.githubRepo)}/actions/workflows/${ACTIVITY_WORKFLOW}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${s.githubToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );
    if (res.ok) return { ok: true, status: res.status, message: '接続できました（activity.yml が見つかりました）' };
    if (res.status === 404) return { ok: false, status: 404, message: 'activity.yml が見つかりません。main に取り込み済みか確認してください' };
    if (res.status === 401) return { ok: false, status: 401, message: 'トークンが無効か期限切れです' };
    return { ok: false, status: res.status, message: `確認できませんでした（${res.status}）` };
  } catch {
    return { ok: false, status: 0, message: 'ネットワークに接続できませんでした' };
  }
}

let inFlight = false;

/**
 * ユーザーの有効な反応（記事を開く・掘る・保存・CONNECT・BUILD・継続利用）があったときに呼ぶ。
 * このデバイスの最終利用時刻を更新し、その日まだなら活動通知を 1 回だけ送る。
 */
export function markActive(force = false): void {
  const now = new Date();
  const today = jstDateString(now);
  updateLocalActivity({ lastActiveLocal: now.toISOString() });

  const s = getSettings();
  const local = getLocalActivity();
  if (!s.heartbeat || !hasHeartbeatToken(s) || inFlight) return;
  if (!force && local.heartbeatDate === today) return;

  inFlight = true;
  void dispatchActivity('heartbeat').then((r) => {
    inFlight = false;
    updateLocalActivity(
      r.ok
        ? { heartbeatDate: today, heartbeatAt: new Date().toISOString(), lastResult: '活動を記録しました' }
        : { lastResult: r.message },
    );
  });
}

/**
 * 送ったはずの活動通知がサーバー側に反映されていない場合（ワークフローの取りこぼし等）、
 * 次の操作で送り直せるようにする。反映には数分かかるので 30 分以上たってから判断する。
 */
export function reconcileHeartbeat(serverLastActive: string): void {
  const local = getLocalActivity();
  if (!local.heartbeatDate || !local.heartbeatAt) return;
  const sentAgo = Date.now() - Date.parse(local.heartbeatAt);
  const serverDate = serverLastActive ? jstDateString(new Date(serverLastActive)) : '';
  if (sentAgo > 30 * 60 * 1000 && serverDate < local.heartbeatDate) {
    updateLocalActivity({ heartbeatDate: '' });
  }
}
