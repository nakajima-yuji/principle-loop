import { useMemo, useState } from 'react';
import { Notice, PageHead } from '../components/common.tsx';
import { Icon } from '../components/Icon.tsx';
import { loadArchive, useAsync } from '../data/api.ts';
import { ACTIVITY_WORKFLOW, DAILY_WORKFLOW, dispatchActivity, markActive } from '../data/heartbeat.ts';
import { refreshServerActivity, useServerActivity } from '../data/server-activity.ts';
import { hasHeartbeatToken, repoUrl, updateLocalActivity, useLocalActivity, useSettings } from '../data/settings.ts';
import { usePersonal } from '../data/store.ts';
import { toast } from '../data/toast.ts';
import { href } from '../router.ts';
import { DEFAULT_INACTIVITY_LIMIT_DAYS, computeInactivityDays, daysUntilPause } from '../shared/activity.ts';
import { PRINCIPLE_STATES } from '../shared/questions.ts';
import { formatJaDateTime, isSundayJst, jstDateString } from '../shared/time.ts';

export function ActivityView() {
  const server = useServerActivity();
  const local = useLocalActivity();
  const settings = useSettings();
  const personal = usePersonal();
  const archive = useAsync(loadArchive, []);
  const [runNow, setRunNow] = useState(false);
  const [busy, setBusy] = useState(false);

  const now = new Date();
  const act = server.activity;
  const limit = DEFAULT_INACTIVITY_LIMIT_DAYS;
  const inactive = act?.lastActive ? computeInactivityDays(act.lastActive, now) : 0;
  const remaining = act ? daysUntilPause(act, now, limit) : limit;
  const tokenReady = hasHeartbeatToken(settings);
  const repo = repoUrl(settings);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    personal.diary.forEach((d) => (c[d.state] = (c[d.state] ?? 0) + 1));
    return c;
  }, [personal.diary]);

  const onContinue = () => {
    markActive(true);
    toast(tokenReady ? '継続利用を記録しました（反映まで数分かかります）' : 'この端末での利用を記録しました（GitHub 連携は未設定）');
  };

  const onResume = async () => {
    setBusy(true);
    const r = await dispatchActivity('resume', runNow);
    setBusy(false);
    if (r.ok) {
      updateLocalActivity({ heartbeatDate: jstDateString(new Date()), heartbeatAt: new Date().toISOString(), lastResult: '再開を依頼しました' });
      toast('再開を依頼しました。1〜2分後に反映されます');
      setTimeout(() => void refreshServerActivity(), 90_000);
    } else {
      toast(r.message);
    }
  };

  const status = act?.paused ? 'paused' : isSundayJst(now) ? 'rest' : 'running';

  return (
    <div className="page stack">
      <PageHead
        kicker="ACTIVITY"
        title="統計・アクティビティ"
        sub="10日間アプリで反応がなければ、夜間の収集・AI生成・メールを自動で止めます。無料枠を守るための仕組みで、急かすためのものではありません。"
      />

      {act?.paused && (
        <Notice kind="paused" icon="pause">
          <strong>PRINCIPLE LOOP PAUSED</strong> — 深夜収集・AI生成・DAILY生成・朝メールを停止しています。再開したい場合は下のボタンから再開できます。
        </Notice>
      )}
      {server.error && <Notice kind="warn">稼働状況（activity.json）を読み込めませんでした：{server.error}</Notice>}

      <div className="two-col">
        <section className="panel panel-pad stack" aria-label="稼働状況">
          <div className="panel-head" style={{ marginBottom: 0 }}>
            <span className="panel-title">
              <Icon name="bolt" size={18} /> 稼働状況
            </span>
            <span className={`status-pill ${status === 'paused' ? 'paused' : status === 'rest' ? 'rest' : ''}`}>
              {status === 'paused' ? '一時停止中' : status === 'rest' ? '日曜は休み' : '稼働中'}
            </span>
          </div>

          {!act?.paused && (
            <div>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="small muted">自動停止まで</span>
                <strong>あと {remaining} 日</strong>
              </div>
              <div className={`meter ${remaining <= 3 ? 'low' : ''}`}>
                <span style={{ width: `${Math.max(4, (remaining / limit) * 100)}%` }} />
              </div>
            </div>
          )}

          <dl className="kv">
            <dt>最後の反応</dt>
            <dd>{act?.lastActive ? `${formatJaDateTime(act.lastActive)}（${inactive}日前）` : 'まだ記録がありません（最初の夜間処理で記録されます）'}</dd>
            <dt>この端末の利用</dt>
            <dd>{local.lastActiveLocal ? formatJaDateTime(local.lastActiveLocal) : '—'}</dd>
            <dt>活動通知</dt>
            <dd>
              {tokenReady ? (settings.heartbeat ? 'オン（1日1回まで送ります）' : 'オフ') : '未設定'}
              {local.lastResult && <span className="small muted">　直近：{local.lastResult}</span>}
            </dd>
          </dl>

          {act?.paused ? (
            <div className="stack" style={{ gap: 10 }}>
              <label className="row small">
                <input type="checkbox" checked={runNow} onChange={(e) => setRunNow(e.target.checked)} />
                再開後すぐに今日の生成とメール配信を試す（日曜は実行しません）
              </label>
              <button type="button" className="btn primary lg" onClick={() => void onResume()} disabled={!tokenReady || busy}>
                <Icon name="play" size={18} /> PRINCIPLE LOOPを再開
              </button>
            </div>
          ) : (
            <button type="button" className="btn primary" onClick={onContinue}>
              <Icon name="heart" size={16} /> 継続して使う
            </button>
          )}

          {!tokenReady && (
            <Notice kind="warn">
              アプリから GitHub に活動を伝えるには、<a href={href('/settings')}>設定</a>で GitHub 連携をしてください。
              {repo && (
                <>
                  連携しない場合も、GitHub の{' '}
                  <a href={`${repo}/actions/workflows/${ACTIVITY_WORKFLOW}`} target="_blank" rel="noopener noreferrer">
                    Actions → PRINCIPLE LOOP Activity
                  </a>{' '}
                  で「Run workflow」を押せば、継続（heartbeat）や再開（resume）ができます。
                </>
              )}
            </Notice>
          )}
        </section>

        <section className="panel panel-pad stack" aria-label="スケジュール">
          <div className="panel-title">
            <Icon name="clock" size={18} /> スケジュール（日本時間）
          </div>
          <div className="week">
            {['月', '火', '水', '木', '金', '土'].map((d) => (
              <div key={d} className="d">
                {d}
              </div>
            ))}
            <div className="d off">日</div>
          </div>
          <dl className="kv">
            <dt>00:30〜</dt>
            <dd>情報収集 → 重複除去 → 分類 → 候補抽出 → 原理分析 → 7件選定 → ストーリー化 → 保存</dd>
            <dt>07:00〜08:00</dt>
            <dd>Yahoo!メールで「今日の7つの原理」を配信</dd>
            <dt>日曜日</dt>
            <dd>完全休止（収集・AI・メールすべてなし）</dd>
            <dt>10日無反応</dt>
            <dd>自動で一時停止。停止の時だけ1回お知らせメール。その後は何も送りません。</dd>
          </dl>
          <p className="small muted">
            「反応」に数えるのは、記事を開く・掘る・保存・CONNECT・BUILD・継続して使う、の操作だけです。メールが届いただけでは数えません。記録するのは <span className="code">lastActive</span>・
            <span className="code">inactivityDays</span>・<span className="code">paused</span> の3つだけです。
          </p>
          {repo && (
            <p className="small">
              <a href={`${repo}/actions/workflows/${DAILY_WORKFLOW}`} target="_blank" rel="noopener noreferrer">
                GitHub Actions の実行履歴を見る <Icon name="external" size={12} />
              </a>
            </p>
          )}
        </section>
      </div>

      <section className="panel panel-pad stack" aria-label="統計">
        <div className="panel-title">
          <Icon name="chart" size={18} /> 統計
        </div>
        <div className="stat-row">
          <div className="stat">
            <div className="v">{archive.data?.days.length ?? '—'}</div>
            <div className="l">DAILY の日数</div>
          </div>
          <div className="stat">
            <div className="v">{personal.diary.length}</div>
            <div className="l">DIARY に保存</div>
          </div>
          <div className="stat">
            <div className="v">{personal.connections.length}</div>
            <div className="l">CONNECT</div>
          </div>
          <div className="stat">
            <div className="v">{personal.builds.length}</div>
            <div className="l">実験設計</div>
          </div>
          <div className="stat">
            <div className="v">{personal.builds.filter((b) => b.done).length}</div>
            <div className="l">実験済み</div>
          </div>
        </div>
        <div className="stat-row">
          {PRINCIPLE_STATES.map((s) => (
            <a key={s.id} className="stat" href={href('/diary', { state: s.id })} style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="v">{counts[s.id] ?? 0}</div>
              <div className="l">
                {s.label}（{s.ja}）
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
