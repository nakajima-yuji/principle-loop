import { useEffect, useMemo, useState } from 'react';
import { PageHead } from '../components/common.tsx';
import { Icon } from '../components/Icon.tsx';
import { loadItem, loadLatestDaily, useAsync } from '../data/api.ts';
import { markActive } from '../data/heartbeat.ts';
import { getPersonal, newId, removeBuild, saveBuild, updateDiary, usePersonal } from '../data/store.ts';
import { copyText, toast } from '../data/toast.ts';
import {
  DESIGN_FIELDS,
  VERSION_FIELDS,
  claudeCodePrompt,
  codexPrompt,
  draftFromIdea,
  draftFromPrinciple,
  emptyDesign,
  readiness,
} from '../lib/experiment.ts';
import { connectionToSource, toPrincipleSource, type PrincipleSource } from '../lib/principle.ts';
import { truncate } from '../lib/text.ts';
import { href, navigate } from '../router.ts';
import type { ExperimentDesign, ExperimentField } from '../shared/types.ts';

type SourceTab = 'principle' | 'connect' | 'idea';

export function BuildView({ from, id, design: designId }: { from: string | null; id: string | null; design: string | null }) {
  const personal = usePersonal();
  const latest = useAsync(loadLatestDaily, []);
  const [tab, setTab] = useState<SourceTab>(from === 'connect' ? 'connect' : from === 'idea' ? 'idea' : 'principle');
  const [pickId, setPickId] = useState(id ?? '');
  const [idea, setIdea] = useState('');
  const [design, setDesign] = useState<ExperimentDesign>(() => emptyDesign(new Date().toISOString(), newId('exp')));
  const [dirty, setDirty] = useState(false);

  const principleOptions = useMemo(() => {
    const map = new Map<string, PrincipleSource>();
    personal.diary
      .filter((d) => d.kind !== 'connect')
      .forEach((d) => map.set(d.id, toPrincipleSource(d.item, personal.notes[d.id])));
    (latest.data?.items ?? []).forEach((it) => {
      if (!map.has(it.id)) map.set(it.id, toPrincipleSource(it, personal.notes[it.id]));
    });
    return [...map.values()];
  }, [personal.diary, personal.notes, latest.data]);

  // 保存済みの設計を開く
  useEffect(() => {
    if (!designId) return;
    const saved = getPersonal().builds.find((b) => b.id === designId);
    if (saved) {
      setDesign(saved);
      setDirty(false);
    }
  }, [designId]);

  // DAILY / DEEP / CONNECT から来たときは下書きを自動で作る
  useEffect(() => {
    if (designId || !id) return;
    let alive = true;
    (async () => {
      let src: PrincipleSource | null = null;
      if (from === 'connect') {
        const c = getPersonal().connections.find((x) => x.id === id);
        if (c) src = connectionToSource(c);
      } else {
        try {
          const item = await loadItem(id);
          src = toPrincipleSource(item, getPersonal().notes[id]);
        } catch {
          src = null;
        }
      }
      if (alive && src) applySource(src, from === 'connect' ? 'connect' : 'principle');
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, id, designId]);

  function applySource(src: PrincipleSource, type: 'principle' | 'connect') {
    setDesign((d) => ({
      ...emptyDesign(new Date().toISOString(), newId('exp')),
      ...draftFromPrinciple(src),
      sourceType: type,
      sourceId: src.id,
      sourceLabel: src.title,
      id: d.sourceId === src.id ? d.id : newId('exp'),
    }));
    setDirty(true);
    markActive();
  }

  const makeDraft = () => {
    if (dirty && !confirm('いまの設計を下書きで置き換えますか？')) return;
    if (tab === 'idea') {
      if (!idea.trim()) {
        toast('アイデアを書いてください');
        return;
      }
      setDesign({ ...emptyDesign(new Date().toISOString(), newId('exp')), ...draftFromIdea(idea.trim()), sourceType: 'idea', sourceLabel: truncate(idea, 40) });
      setDirty(true);
      markActive();
      return;
    }
    if (tab === 'connect') {
      const c = personal.connections.find((x) => x.id === pickId);
      if (!c) return toast('CONNECT の結果を選んでください');
      applySource(connectionToSource(c), 'connect');
      return;
    }
    const src = principleOptions.find((p) => p.id === pickId);
    if (!src) return toast('原理を選んでください');
    applySource(src, 'principle');
  };

  const setField = (k: ExperimentField, v: string) => {
    setDesign((d) => ({ ...d, [k]: v }));
    setDirty(true);
  };

  const onSave = () => {
    saveBuild(design);
    setDirty(false);
    markActive();
    toast('実験設計を保存しました');
    if (designId !== design.id) navigate('/build', { design: design.id });
  };

  const markDone = () => {
    const next = { ...design, done: !design.done };
    setDesign(next);
    saveBuild(next);
    if (next.done && next.sourceId && getPersonal().diary.some((d) => d.id === next.sourceId)) {
      updateDiary(next.sourceId, { state: 'EXPERIMENTED' });
    }
    toast(next.done ? '実験済みにしました' : '未実験に戻しました');
  };

  const checks = readiness(design);
  const ready = checks.every((c) => c.ok);

  return (
    <div className="page stack">
      <PageHead
        kicker="BUILD"
        title="EXPERIMENT DESIGN"
        sub="いきなりコードを書かない。原理 → 仮説 → 最小実験 → 比較 → 観測 → 成功・失敗条件 → 必要技術 → 実装プロンプト の順に設計します。"
      />

      <div className="build-layout">
        <div className="stack">
          <section className="panel panel-pad stack" style={{ gap: 12 }}>
            <div className="tabs" role="tablist" aria-label="入力">
              {(
                [
                  ['principle', '原理から'],
                  ['connect', 'CONNECT 結果から'],
                  ['idea', '自分のアイデア'],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
                  {label}
                </button>
              ))}
            </div>
            {tab === 'principle' && (
              <select className="select" value={pickId} onChange={(e) => setPickId(e.target.value)} aria-label="原理を選ぶ">
                <option value="">原理を選ぶ…</option>
                {principleOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            )}
            {tab === 'connect' &&
              (personal.connections.length ? (
                <select className="select" value={pickId} onChange={(e) => setPickId(e.target.value)} aria-label="CONNECT を選ぶ">
                  <option value="">CONNECT の結果を選ぶ…</option>
                  {personal.connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.leftTitle} × {c.rightTitle}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="empty">
                  まだ CONNECT の結果がありません。<a href={href('/connect')}>CONNECT へ</a>
                </div>
              ))}
            {tab === 'idea' && (
              <textarea className="note" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="試したいこと。例：通知を減らすほど、大事な通知が読まれるようになる？" aria-label="自分のアイデア" />
            )}
            <div>
              <button type="button" className="btn soft" onClick={makeDraft}>
                <Icon name="plus" size={15} /> 設計の下書きを作る
              </button>
            </div>
          </section>

          {design.sourceLabel && (
            <p className="small muted">
              元にしたもの：<strong>{design.sourceLabel}</strong>
              {dirty && <span>（未保存の変更があります）</span>}
            </p>
          )}

          <div className="design-grid">
            {DESIGN_FIELDS.map((f, i) => (
              <section key={f.key} className={`panel design-field ${f.full ? 'full' : ''}`}>
                <h3>
                  <span className="n">{String(i + 1).padStart(2, '0')}</span>
                  {f.label}
                </h3>
                <textarea className="note" value={design[f.key]} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.hint} aria-label={f.label} />
              </section>
            ))}
          </div>

          <div className="versions">
            {VERSION_FIELDS.map((f) => (
              <section key={f.key} className="panel design-field">
                <h3>
                  <Icon name="clock" size={16} /> {f.label}
                </h3>
                <textarea className="note" value={design[f.key]} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.hint} aria-label={f.label} />
              </section>
            ))}
          </div>

          <div className="row">
            <button type="button" className="btn primary" onClick={onSave}>
              <Icon name="check" size={16} /> 設計を保存
            </button>
            {personal.builds.some((b) => b.id === design.id) && (
              <button type="button" className={`btn ${design.done ? 'saved' : ''}`} onClick={markDone}>
                <Icon name="flask" size={16} /> {design.done ? '実験済み' : '実験済みにする'}
              </button>
            )}
          </div>

          <section className="panel prompt-out stack" style={{ gap: 14 }} aria-label="実装プロンプト">
            <div>
              <div className="panel-title">
                <Icon name="terminal" size={18} /> 本当に作りたい場合のみ：実装プロンプト
              </div>
              <p className="small muted" style={{ marginTop: 6 }}>
                PRINCIPLE LOOP は Claude Code / Codex を自動で実行しません。コピーして、必要なときだけ自分で貼り付けてください。
              </p>
              <ul className="checklist">
                {checks.map((c) => (
                  <li key={c.label}>
                    <span className={c.ok ? 'ok' : 'ng'}>
                      <Icon name={c.ok ? 'check' : 'x'} size={15} />
                    </span>
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="row">
              <button type="button" className="btn primary" disabled={!ready} onClick={() => void copyText(claudeCodePrompt(design), 'Claude Code 用プロンプトをコピーしました')}>
                <Icon name="copy" size={16} /> Claude Code用プロンプトをコピー
              </button>
              <button type="button" className="btn" disabled={!ready} onClick={() => void copyText(codexPrompt(design), 'Codex 用プロンプトをコピーしました')}>
                <Icon name="copy" size={16} /> Codex用プロンプトをコピー
              </button>
            </div>
            {!ready && <p className="small muted">上のチェックがそろうと、コピーできるようになります。</p>}
            {ready && (
              <details className="fold">
                <summary>プロンプトの中身を確認する</summary>
                <pre className="prompt">{claudeCodePrompt(design)}</pre>
              </details>
            )}
          </section>
        </div>

        <aside className="stack">
          <section className="panel panel-pad">
            <div className="panel-head">
              <span className="panel-title">
                <Icon name="flask" size={18} /> 保存した実験設計
              </span>
              <button
                type="button"
                className="pill-link"
                onClick={() => {
                  setDesign(emptyDesign(new Date().toISOString(), newId('exp')));
                  setDirty(false);
                  navigate('/build');
                }}
              >
                <Icon name="plus" size={12} /> 新規
              </button>
            </div>
            {personal.builds.length === 0 ? (
              <div className="empty">まだありません。</div>
            ) : (
              <ul className="mini-list">
                {personal.builds.map((b) => (
                  <li key={b.id} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <a href={href('/build', { design: b.id })} style={{ display: 'block', minWidth: 0 }}>
                      <span className="t">
                        {b.done && '✓ '}
                        {truncate(b.principle || b.sourceLabel || '無題', 46)}
                      </span>
                      <span className="d">{b.updatedAt.slice(0, 10).replaceAll('-', '.')}</span>
                    </a>
                    <button
                      type="button"
                      className="btn sm ghost danger"
                      aria-label="削除"
                      onClick={() => {
                        if (confirm('この実験設計を削除しますか？')) removeBuild(b.id);
                      }}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel panel-pad small muted" style={{ lineHeight: 1.8 }}>
            <strong style={{ color: 'var(--ink)' }}>小さく試すコツ</strong>
            <br />
            ・変えるのは1つだけ
            <br />
            ・「失敗条件」を先に決める
            <br />
            ・30分版で差が見えなければ、2時間版に進まない
            <br />
            ・捨てる要素は、作らない勇気
          </section>
        </aside>
      </div>
    </div>
  );
}
