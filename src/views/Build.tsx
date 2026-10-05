import { useEffect, useMemo, useState } from 'react';
import { PageHead } from '../components/common.tsx';
import { Icon } from '../components/Icon.tsx';
import { MediaPicker } from '../components/loop.tsx';
import { loadItem, loadLatestDaily, useAsync } from '../data/api.ts';
import { markActive } from '../data/heartbeat.ts';
import { getPersonal, newId, removeBuild, returnResult, saveBuild, updateDiary, usePersonal } from '../data/store.ts';
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
import { MINIMAL_EXPERIMENTS } from '../shared/loop.ts';
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
      .filter((d) => d.kind !== 'connect' && d.type !== 'EXPERIMENT' && d.userDecision !== 'ARCHIVE')
      .forEach((d) => map.set(d.id, toPrincipleSource(d.item, personal.notes[d.id], d.lightDeep)));
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
          const entry = getPersonal().diary.find((d) => d.id === id);
          src = toPrincipleSource(item, getPersonal().notes[id], entry?.lightDeep);
          if (alive && entry?.media.length) setDesign((d) => ({ ...d, media: entry.media }));
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
      question: d.question,
      formats: d.formats,
      media: d.media,
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
      setDesign((d) => ({
        ...emptyDesign(new Date().toISOString(), newId('exp')),
        ...draftFromIdea(idea.trim()),
        question: d.question,
        formats: d.formats,
        media: d.media,
        sourceType: 'idea',
        sourceLabel: truncate(idea, 40),
      }));
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

  const setField = (k: ExperimentField | 'question' | 'result', v: string) => {
    setDesign((d) => ({ ...d, [k]: v }));
    setDirty(true);
  };
  const patch = (p: Partial<ExperimentDesign>) => {
    setDesign((d) => ({ ...d, ...p }));
    setDirty(true);
  };
  const toggleFormat = (f: string) => patch({ formats: design.formats.includes(f) ? design.formats.filter((x) => x !== f) : [...design.formats, f] });

  const onSave = () => {
    saveBuild(design);
    setDirty(false);
    markActive();
    toast('実験を保存しました（DIARY にも EXPERIMENT として並びます）');
    if (designId !== design.id) navigate('/experiment', { design: design.id });
  };

  const markDone = () => {
    const next = { ...design, done: !design.done };
    setDesign(next);
    saveBuild(next);
    if (next.done && next.sourceId && getPersonal().diary.some((d) => d.id === next.sourceId)) {
      updateDiary(next.sourceId, { state: 'TESTING' });
    }
    toast(next.done ? '試し終わりにしました。起きたことを DIARY に戻しましょう' : '試し中に戻しました');
  };

  /** 起きたことを DIARY へ「新しい観察」として戻す（OBSERVE → DIARY） */
  const onReturnResult = () => {
    const text = design.result.trim();
    if (!text) {
      toast('起きたことを書いてください（うまくいかなかったことも観察です）');
      return;
    }
    const base = { ...design, result: '' };
    saveBuild(base);
    const entry = returnResult(base, text);
    const saved = getPersonal().builds.find((b) => b.id === base.id);
    if (saved) setDesign(saved);
    setDirty(false);
    markActive();
    toast('DIARY に新しい観察として戻しました');
    if (designId !== base.id) navigate('/experiment', { design: base.id });
    return entry;
  };

  const returned = personal.diary.filter((d) => design.resultEntryIds.includes(d.id));

  const checks = readiness(design);
  const ready = checks.every((c) => c.ok);

  return (
    <div className="page stack">
      <PageHead
        kicker="EXPERIMENT"
        title="小さく試す"
        sub="完成品より最小実験。まず「何を確かめたいか」を決めて、一番小さい形で試し、起きたことを DIARY に新しい観察として戻します。"
      />

      <div className="build-layout">
        <div className="stack">
          <section className="panel panel-pad stack question-panel" style={{ gap: 10 }}>
            <label className="field-label" htmlFor="exp-q" style={{ marginBottom: 0, fontSize: 15, color: 'var(--ink)' }}>
              <Icon name="flask" size={17} /> 何を確かめたいか
            </label>
            <textarea
              id="exp-q"
              className="note big"
              value={design.question}
              onChange={(e) => setField('question', e.target.value)}
              placeholder="例：本体を見せずに痕跡だけを見せたら、人は探し始める？"
            />
            <span className="field-label" style={{ marginBottom: 0 }}>
              最小実験の形（いくつでも）
            </span>
            <div className="row" style={{ gap: 6 }}>
              {MINIMAL_EXPERIMENTS.map((f) => {
                const on = design.formats.includes(f);
                return (
                  <button key={f} type="button" className={`tag ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggleFormat(f)}>
                    {on && <Icon name="check" size={12} />}
                    {f}
                  </button>
                );
              })}
            </div>
            <span className="field-label" style={{ marginBottom: 0 }}>
              出す先（ゲームだけじゃない）
            </span>
            <MediaPicker selected={design.media} onChange={(media) => patch({ media })} />
          </section>

          <section className="panel panel-pad stack" style={{ gap: 12 }}>
            <span className="field-label" style={{ marginBottom: 0 }}>
              元にするもの（任意）
            </span>
            <div className="tabs" role="tablist" aria-label="入力">
              {(
                [
                  ['principle', 'DIARY・DAILY から'],
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
              <select className="select" value={pickId} onChange={(e) => setPickId(e.target.value)} aria-label="元にするものを選ぶ">
                <option value="">観察・原理候補を選ぶ…</option>
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
                <Icon name="plus" size={15} /> 下書きを作る（AI は使いません）
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
            <section className="panel design-field">
              <h3>
                <Icon name="clock" size={16} /> まず一番小さい版
              </h3>
              <textarea className="note" value={design.v30m} onChange={(e) => setField('v30m', e.target.value)} placeholder="30分でできる形。紙・1ファイル・1シーンなど" aria-label="まず一番小さい版" />
            </section>
            <section className="panel design-field">
              <h3>
                <Icon name="search" size={16} /> 何を見る？
              </h3>
              <textarea className="note" value={design.observe} onChange={(e) => setField('observe', e.target.value)} placeholder="相手の反応・かかった時間・迷った回数など" aria-label="何を見る？" />
            </section>
          </div>

          <details className="panel panel-pad fold-panel">
            <summary>
              <Icon name="flask" size={17} /> 詳しく設計する <span className="muted">仮説・比較・成功／失敗条件・段階（必要なときだけ）</span>
            </summary>
            <div className="design-grid" style={{ marginTop: 12 }}>
              {DESIGN_FIELDS.filter((f) => f.key !== 'observe').map((f, i) => (
                <section key={f.key} className={`panel design-field ${f.full ? 'full' : ''}`}>
                  <h3>
                    <span className="n">{String(i + 1).padStart(2, '0')}</span>
                    {f.label}
                  </h3>
                  <textarea className="note" value={design[f.key]} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.hint} aria-label={f.label} />
                </section>
              ))}
            </div>
            <div className="versions" style={{ marginTop: 12 }}>
              {VERSION_FIELDS.filter((f) => f.key !== 'v30m').map((f) => (
                <section key={f.key} className="panel design-field">
                  <h3>
                    <Icon name="clock" size={16} /> {f.label}
                  </h3>
                  <textarea className="note" value={design[f.key]} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.hint} aria-label={f.label} />
                </section>
              ))}
            </div>
          </details>

          <div className="row">
            <button type="button" className="btn primary" onClick={onSave}>
              <Icon name="check" size={16} /> 保存
            </button>
            {personal.builds.some((b) => b.id === design.id) && (
              <button type="button" className={`btn ${design.done ? 'saved' : ''}`} onClick={markDone}>
                <Icon name="flask" size={16} /> {design.done ? '試し終わり' : '試し終わりにする'}
              </button>
            )}
          </div>

          <section className="panel panel-pad stack result-panel" style={{ gap: 10 }} aria-label="結果を DIARY へ戻す">
            <div className="panel-title">
              <Icon name="book" size={18} /> やってみて起きたこと <span className="muted">→ DIARY に新しい観察として戻す</span>
            </div>
            <textarea
              className="note"
              value={design.result}
              onChange={(e) => setField('result', e.target.value)}
              placeholder="例：子どもは痕跡を3つ見つけたところで、本体より痕跡の方を面白がった。予想と違った。"
              aria-label="やってみて起きたこと"
            />
            <div className="row">
              <button type="button" className="btn primary" onClick={onReturnResult}>
                <Icon name="arrowRight" size={16} /> 結果を DIARY へ戻す
              </button>
              <span className="small muted">うまくいかなかったことも観察です。次の LIGHT DEEP の材料になります。</span>
            </div>
            {returned.length > 0 && (
              <ul className="lineage">
                {returned.map((r) => (
                  <li key={r.id}>
                    <span className="small muted">{r.createdAt.slice(0, 10).replaceAll('-', '.')}</span> <a href={href('/diary', { id: r.id })}>{truncate(r.body, 60)}</a>
                  </li>
                ))}
              </ul>
            )}
          </section>

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
                <Icon name="flask" size={18} /> 保存した実験
              </span>
              <button
                type="button"
                className="pill-link"
                onClick={() => {
                  setDesign(emptyDesign(new Date().toISOString(), newId('exp')));
                  setDirty(false);
                  navigate('/experiment');
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
                    <a href={href('/experiment', { design: b.id })} style={{ display: 'block', minWidth: 0 }}>
                      <span className="t">
                        {b.done && '✓ '}
                        {truncate(b.question || b.principle || b.sourceLabel || '無題', 46)}
                      </span>
                      <span className="d">{b.updatedAt.slice(0, 10).replaceAll('-', '.')}</span>
                    </a>
                    <button
                      type="button"
                      className="btn sm ghost danger"
                      aria-label="削除"
                      onClick={() => {
                        if (confirm('この実験を削除しますか？（DIARY に戻した結果は残ります）')) removeBuild(b.id);
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
            ・作るのは速く、決めるのは遅く
            <br />
            ・確かめたいことは1つだけ
            <br />
            ・紙5枚・30秒・1画面で足りるなら、それで試す
            <br />
            ・子どもに1分触ってもらうのも立派な実験
            <br />
            ・結果は必ず DIARY に戻す（失敗も観察）
          </section>
        </aside>
      </div>
    </div>
  );
}
