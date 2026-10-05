import { useRef, useState } from 'react';
import { Notice, PageHead } from '../components/common.tsx';
import { Icon } from '../components/Icon.tsx';
import { ACTIVITY_WORKFLOW, testConnection } from '../data/heartbeat.ts';
import { repoUrl, updateSettings, useSettings } from '../data/settings.ts';
import { clearPersonal, exportPersonal, importPersonal } from '../data/store.ts';
import { toast } from '../data/toast.ts';
import { jstDateString } from '../shared/time.ts';

export function SettingsView() {
  const s = useSettings();
  const [owner, setOwner] = useState(s.githubOwner);
  const [repo, setRepo] = useState(s.githubRepo);
  const [branch, setBranch] = useState(s.githubBranch);
  const [token, setToken] = useState(s.githubToken);
  const [testing, setTesting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const url = repoUrl(s);

  const save = () => {
    updateSettings({ githubOwner: owner.trim(), githubRepo: repo.trim(), githubBranch: branch.trim() || 'main', githubToken: token.trim() });
    toast('保存しました（この端末のブラウザだけに保存されます）');
  };

  const test = async () => {
    save();
    setTesting(true);
    const r = await testConnection();
    setTesting(false);
    toast(r.message);
  };

  const onExport = () => {
    const blob = new Blob([exportPersonal()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `principle-loop-backup-${jstDateString(new Date())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="page stack">
      <PageHead kicker="SETTINGS" title="設定" sub="この画面の設定は、この端末のブラウザの中にだけ保存されます。" />

      <div className="two-col">
        <section className="panel panel-pad stack" aria-label="GitHub 連携">
          <div className="panel-title">
            <Icon name="link" size={18} /> GitHub 連携（10日自動停止のための活動通知）
          </div>
          <p className="small muted">
            アプリを使ったことを GitHub Actions に伝えるための設定です。送るのは「反応があった」という事実だけで、何を読んだかは送りません。
          </p>
          <div className="two-col" style={{ gap: 12 }}>
            <div>
              <label className="field-label" htmlFor="gh-owner">
                オーナー（ユーザー名）
              </label>
              <input id="gh-owner" className="text" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="nakajima-yuji" />
            </div>
            <div>
              <label className="field-label" htmlFor="gh-repo">
                リポジトリ名
              </label>
              <input id="gh-repo" className="text" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="principle-loop" />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="gh-branch">
              ブランチ
            </label>
            <input id="gh-branch" className="text" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
          </div>
          <div>
            <label className="field-label" htmlFor="gh-token">
              トークン（Fine-grained personal access token）
            </label>
            <input
              id="gh-token"
              className="text"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_..."
            />
          </div>
          <label className="row small">
            <input type="checkbox" checked={s.heartbeat} onChange={(e) => updateSettings({ heartbeat: e.target.checked })} />
            アプリを使ったら活動通知を送る（1日1回まで）
          </label>
          <div className="row">
            <button type="button" className="btn primary" onClick={save}>
              <Icon name="check" size={16} /> 保存
            </button>
            <button type="button" className="btn" onClick={() => void test()} disabled={testing}>
              接続テスト
            </button>
            {token && (
              <button
                type="button"
                className="btn ghost danger"
                onClick={() => {
                  setToken('');
                  updateSettings({ githubToken: '' });
                  toast('トークンを削除しました');
                }}
              >
                トークンを削除
              </button>
            )}
          </div>

          <details className="fold">
            <summary>トークンの作り方（3分）</summary>
            <ol className="small" style={{ lineHeight: 1.9, paddingLeft: 20 }}>
              <li>
                GitHub の{' '}
                <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">
                  Fine-grained token の作成画面
                </a>{' '}
                を開く
              </li>
              <li>Token name に「principle-loop activity」など。Expiration は長め（期限が来たら作り直し）</li>
              <li>
                Repository access → <strong>Only select repositories</strong> → このリポジトリ<strong>だけ</strong>を選ぶ
              </li>
              <li>
                Permissions → Repository permissions → <strong>Actions：Read and write</strong> だけを付ける（Contents などは付けない）
              </li>
              <li>Generate token → 表示された github_pat_… をここに貼って保存 → 接続テスト</li>
            </ol>
            <Notice kind="warn">
              このトークンでできるのは「このリポジトリの Actions を動かすこと」だけです。コードや秘密情報（Secrets）は読み書きできません。共有のパソコンでは設定しないでください。
            </Notice>
          </details>
          {url && (
            <p className="small muted">
              トークンなしでも、GitHub の{' '}
              <a href={`${url}/actions/workflows/${ACTIVITY_WORKFLOW}`} target="_blank" rel="noopener noreferrer">
                Actions → PRINCIPLE LOOP Activity
              </a>{' '}
              から手動で継続・再開できます。
            </p>
          )}
        </section>

        <div className="stack">
          <section className="panel panel-pad stack" aria-label="データ">
            <div className="panel-title">
              <Icon name="book" size={18} /> 個人データ（DIARY・DEEP・CONNECT・EXPERIMENT）
            </div>
            <p className="small muted">
              個人データはこの端末のブラウザ（localStorage）に保存されています。ブラウザのデータを消すと失われるので、ときどきバックアップしてください。別の端末へはバックアップを読み込むと移せます。
            </p>
            <div className="row">
              <button type="button" className="btn" onClick={onExport}>
                <Icon name="download" size={16} /> バックアップを書き出す
              </button>
              <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={16} /> バックアップを読み込む
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const r = importPersonal(await f.text());
                    toast(`読み込みました（DIARY ${r.diary}件）`);
                  } catch {
                    toast('読み込めませんでした');
                  }
                }}
              />
            </div>
            <div>
              <button
                type="button"
                className="btn ghost danger"
                onClick={() => {
                  if (confirm('この端末の DIARY・DEEP のメモ・CONNECT・EXPERIMENT をすべて削除します。よろしいですか？')) {
                    clearPersonal();
                    toast('削除しました');
                  }
                }}
              >
                <Icon name="trash" size={16} /> この端末の個人データをすべて削除
              </button>
            </div>
          </section>

          <section className="panel panel-pad stack" aria-label="自動運転の設定">
            <div className="panel-title">
              <Icon name="gear" size={18} /> 自動運転（GitHub 側の設定）
            </div>
            <p className="small muted">
              情報源・興味のキーワード・AI・メールの設定は、リポジトリの <span className="code">config/</span> と GitHub の Secrets で行います。秘密の値（AI の鍵・メールのパスワード）はアプリには一切置きません。
            </p>
            {url && (
              <div className="row">
                <a className="btn sm" href={`${url}/blob/main/config/interests.json`} target="_blank" rel="noopener noreferrer">
                  興味のキーワード
                </a>
                <a className="btn sm" href={`${url}/blob/main/config/sources.json`} target="_blank" rel="noopener noreferrer">
                  情報源
                </a>
                <a className="btn sm" href={`${url}#readme`} target="_blank" rel="noopener noreferrer">
                  README（設定方法）
                </a>
              </div>
            )}
          </section>

          <section className="panel panel-pad small muted" style={{ lineHeight: 1.8 }}>
            PRINCIPLE LOOP v0.1 — たくさんコードを書く装置ではなく、「何を作る価値があるのか」を見つけるための思考装置。
          </section>
        </div>
      </div>
    </div>
  );
}
