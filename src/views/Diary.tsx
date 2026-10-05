// DIARY：DAILY・メモ・気づき・観察・アイデア・実験・実験結果・道具の組み合わせが、時系列で並ぶ中心のログ。
// ここから選んで（HUMAN SELECT）、掘って、試して、結果をまた観察として戻す。

import { useMemo, useRef, useState } from 'react';
import { ExternalLink, PageHead, StateBadge, StateSelect } from '../components/common.tsx';
import { Icon } from '../components/Icon.tsx';
import {
  CoreLockEditor,
  DecisionBadge,
  DecisionBar,
  EnginePicker,
  EntryKindChip,
  EntryThumb,
  LightDeepLines,
  MediaPicker,
  QuickMemo,
  TypeChip,
} from '../components/loop.tsx';
import { markActive } from '../data/heartbeat.ts';
import { emptyNotes, exportPersonal, importPersonal, notesProgress, removeFromDiary, updateDiary, usePersonal } from '../data/store.ts';
import { toast } from '../data/toast.ts';
import { DIARY_FILTERS, chronological, isDiaryFilter, lineage, matchesDecision, matchesFilter, type DiaryFilterId } from '../lib/diary-model.ts';
import { normalizeText, paragraphs, splitList, truncate } from '../lib/text.ts';
import { href, navigate } from '../router.ts';
import { getLightDeep } from '../shared/light-deep.ts';
import { DECISIONS, DECISION_IDS, LEGACY_STATE_LABELS, coreLockFilled, decisionLabel } from '../shared/loop.ts';
import { BOUNDARY_PROBES, CORE_QUESTIONS } from '../shared/questions.ts';
import { formatDotDate, formatJaDate, jstDateString } from '../shared/time.ts';
import type { DeepNotes, DiaryEntry, PrincipleState, UserDecision } from '../shared/types.ts';

type DecisionFilter = UserDecision | 'ALL' | null;

function parseDecision(v: string | null): DecisionFilter {
  if (v === 'ALL') return 'ALL';
  return (DECISION_IDS as readonly string[]).includes(v ?? '') ? (v as UserDecision) : null;
}

/** 一覧の 2 行目：自分の言葉 → AI の3行（構造） → 本文 */
function summaryOf(d: DiaryEntry, notes: DeepNotes | undefined): string {
  const mine = notes?.principleCandidate?.trim() || d.lightDeep?.structure?.trim();
  if (mine) return mine;
  if (d.type !== 'DAILY' && d.body) return d.body;
  return getLightDeep(d.item)?.structure || d.item.principleCandidate || d.item.hook;
}

export function DiaryView({ id, type, decision, tag }: { id: string | null; type: string | null; decision: string | null; tag: string | null }) {
  const personal = usePersonal();
  const [filter, setFilter] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const typeFilter: DiaryFilterId = isDiaryFilter(type) ? type : 'ALL';
  const decisionFilter = parseDecision(decision);
  const hasDeepNotes = (x: string) => notesProgress(personal.notes[x]) > 0;
  const link = (p: { id?: string | null; type?: string | null; decision?: string | null; tag?: string | null }) =>
    href('/diary', { type: typeFilter === 'ALL' ? undefined : typeFilter, decision, tag, ...p });

  const all = useMemo(() => chronological(personal.diary), [personal.diary]);

  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of DIARY_FILTERS) c[f.id] = all.filter((d) => matchesDecision(d, decisionFilter) && matchesFilter(d, f.id, { hasDeepNotes })).length;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, decisionFilter, personal.notes]);

  const decisionCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of all) c[d.userDecision] = (c[d.userDecision] ?? 0) + 1;
    return c;
  }, [all]);

  const topTags = useMemo(() => {
    const c = new Map<string, number>();
    all.forEach((d) => d.tags.forEach((t) => c.set(t, (c.get(t) ?? 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [all]);

  const list = useMemo(() => {
    const f = normalizeText(filter);
    return all.filter((d) => {
      if (!matchesDecision(d, decisionFilter)) return false;
      if (!matchesFilter(d, typeFilter, { hasDeepNotes })) return false;
      if (tag && !d.tags.includes(tag)) return false;
      if (!f) return true;
      return normalizeText(`${d.item.title} ${d.body} ${d.item.principleCandidate} ${d.memo} ${d.tags.join(' ')}`).includes(f);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, decisionFilter, typeFilter, tag, filter, personal.notes]);

  // 日ごとにまとめる（時系列のログ）
  const groups = useMemo(() => {
    const out: { date: string; entries: DiaryEntry[] }[] = [];
    for (const d of list) {
      const date = d.createdAt ? jstDateString(new Date(d.createdAt)) : '日付なし';
      const last = out[out.length - 1];
      if (last && last.date === date) last.entries.push(d);
      else out.push({ date, entries: [d] });
    }
    return out;
  }, [list]);

  const selected = personal.diary.find((d) => d.id === id) ?? null;

  const onExport = () => {
    const blob = new Blob([exportPersonal()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `principle-loop-backup-${jstDateString(new Date())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const r = importPersonal(await file.text());
      toast(`読み込みました（DIARY ${r.diary}件・CONNECT ${r.connections}件・EXPERIMENT ${r.builds}件）`);
    } catch {
      toast('読み込めませんでした。PRINCIPLE LOOP のバックアップファイルか確認してください');
    }
  };

  const archived = decisionCounts.ARCHIVE ?? 0;

  return (
    <div className="page stack">
      <PageHead
        kicker="DIARY"
        title="観察のログ"
        sub="DAILY・メモ・気づき・観察・実験の結果が、時系列で並ぶ中心の記録です。ここから選んで、掘って、試して、また戻します。データはこの端末のブラウザに保存されます。"
        right={
          <div className="row">
            <button type="button" className="btn sm" onClick={onExport}>
              <Icon name="download" size={15} /> バックアップ
            </button>
            <button type="button" className="btn sm" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={15} /> 読み込み
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onImport(e.target.files?.[0])} />
          </div>
        }
      />

      <QuickMemo compact onSaved={(e) => navigate('/diary', { id: e.id })} />

      <div className="filter-chips" role="tablist" aria-label="種類で絞り込む">
        {DIARY_FILTERS.map((f) => (
          <a key={f.id} className={`tab ${typeFilter === f.id ? 'active' : ''}`} href={link({ type: f.id === 'ALL' ? undefined : f.id, id: undefined })} title={f.ja}>
            {f.label} <span className="count">{typeCounts[f.id] ?? 0}</span>
          </a>
        ))}
      </div>

      <div className="filter-chips decisions" aria-label="HUMAN SELECT で絞り込む">
        <a className={`tag ${decisionFilter === null ? 'on' : ''}`} href={link({ decision: undefined, id: undefined })}>
          アーカイブ以外
        </a>
        <a className={`tag ${decisionFilter === 'INBOX' ? 'on' : ''}`} href={link({ decision: 'INBOX', id: undefined })}>
          ・未選択 <span className="muted">{decisionCounts.INBOX ?? 0}</span>
        </a>
        {DECISIONS.map((d) => (
          <a key={d.id} className={`tag ${decisionFilter === d.id ? 'on' : ''}`} href={link({ decision: d.id, id: undefined })}>
            {d.mark} {d.ja} <span className="muted">{decisionCounts[d.id] ?? 0}</span>
          </a>
        ))}
        {archived > 0 && (
          <a className={`tag ${decisionFilter === 'ALL' ? 'on' : ''}`} href={link({ decision: 'ALL', id: undefined })}>
            全部
          </a>
        )}
      </div>

      {topTags.length > 0 && (
        <div className="filter-chips tags">
          {topTags.map(([t, n]) => (
            <a key={t} className={`tag ${tag === t ? 'on' : ''}`} href={link({ tag: tag === t ? undefined : t, id: undefined })}>
              #{t} <span className="muted">{n}</span>
            </a>
          ))}
        </div>
      )}

      {personal.diary.length === 0 ? (
        <div className="panel panel-pad">
          <div className="empty">
            まだ何もありません。
            <br />
            上の MEMO に書くか、DAILY のカードで「☆ 面白い」などを選ぶと、ここに並びます。
            <div style={{ marginTop: 12 }}>
              <a className="btn primary" href={href('/daily')}>
                DAILY を見る
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className={`diary-layout ${selected ? 'has-selection' : ''}`}>
          <div className="stack" style={{ gap: 12 }}>
            <input className="text" type="search" placeholder="DIARY 内を絞り込む" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="DIARY 内を絞り込む" />
            <div className="entry-list">
              {groups.map((g) => (
                <div key={g.date} className="entry-group">
                  <div className="entry-date">{/^\d{4}-/.test(g.date) ? formatJaDate(g.date) : g.date}</div>
                  {g.entries.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`entry ${selected?.id === d.id ? 'selected' : ''} ${d.userDecision === 'ARCHIVE' ? 'archived' : ''}`}
                      onClick={() => navigate('/diary', { id: d.id, type: typeFilter === 'ALL' ? undefined : typeFilter, decision, tag })}
                    >
                      <EntryThumb entry={d} />
                      <span>
                        <span className="row" style={{ gap: 6 }}>
                          <EntryKindChip entry={d} />
                          <DecisionBadge decision={d.userDecision} />
                          {d.state !== 'OBSERVATION' && <StateBadge state={d.state} />}
                        </span>
                        <span className="t" style={{ display: 'block', marginTop: 6 }}>
                          {d.item.title}
                        </span>
                        <span className="p">{truncate(summaryOf(d, personal.notes[d.id]), 90)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ))}
              {list.length === 0 && <div className="empty">条件に合うものはありません。</div>}
            </div>
          </div>
          {selected ? (
            <DiaryDetail entry={selected} all={personal.diary} notes={{ ...emptyNotes(), ...(personal.notes[selected.id] ?? {}) }} back={link({ id: undefined })} />
          ) : (
            <div className="panel panel-pad detail placeholder">
              <div className="empty">左の一覧から選ぶと、ここに詳細が表示されます。</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LinkedEntry({ e, label }: { e: DiaryEntry; label: string }) {
  return (
    <li>
      <span className="muted small">{label}</span> <a href={href('/diary', { id: e.id })}>{e.item.title}</a> <TypeChip type={e.type} />
    </li>
  );
}

function DiaryDetail({ entry, all, notes, back }: { entry: DiaryEntry; all: DiaryEntry[]; notes: DeepNotes; back: string }) {
  const it = entry.item;
  const [tagText, setTagText] = useState(entry.tags.join('、'));
  const [toolText, setToolText] = useState(entry.tools.join(' × '));
  const [lastId, setLastId] = useState(entry.id);
  if (lastId !== entry.id) {
    setLastId(entry.id);
    setTagText(entry.tags.join('、'));
    setToolText(entry.tools.join(' × '));
  }
  const progress = notesProgress(notes);
  const coreAnswers = CORE_QUESTIONS.map((q) => ({ q, mine: notes[q.key].trim(), ai: (it[q.key] ?? '').trim() }));
  const boundaryCount = BOUNDARY_PROBES.filter((p) => (notes.boundary[p] ?? '').trim()).length;
  const light = getLightDeep(it, entry.lightDeep);
  const rel = lineage(entry, all);
  const isDaily = entry.type === 'DAILY' || entry.kind === 'manual';
  // 段階の呼び名が変わったもの（仮説・原理・実験済み）だけ、前の版での段階を添える
  const legacy = entry.legacyState && entry.legacyState !== entry.state ? LEGACY_STATE_LABELS[entry.legacyState] : undefined;

  const patch = (p: Partial<DiaryEntry>) => updateDiary(entry.id, p);
  const setState = (s: PrincipleState) => {
    patch({ state: s });
    markActive();
  };
  const setBody = (body: string) =>
    patch({ body, item: { ...it, hook: body, observation: entry.type === 'OBSERVATION' || entry.type === 'RESULT' ? body : it.observation } });

  return (
    <section className="panel panel-pad detail stack" aria-label="DIARY の詳細">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="row">
          <a className="btn sm ghost mobile-only-inline" href={back} aria-label="一覧に戻る">
            <Icon name="arrowLeft" size={14} />
          </a>
          <EntryKindChip entry={entry} />
          {entry.type === 'DAILY' && <TypeChip type="DAILY" />}
          {entry.kind === 'manual' && <span className="tag">自分で追加</span>}
          <span className="small muted">{entry.createdAt && formatDotDate(entry.createdAt.slice(0, 10))}</span>
        </span>
        <span style={{ width: 230, maxWidth: '100%' }}>
          <StateSelect value={entry.state} onChange={setState} />
        </span>
      </div>
      {legacy && (
        <p className="small muted">
          前の版での段階：{entry.legacyState}（{legacy}）。「原理」を確定させない方針になったため、いまの段階の呼び名に置き直しています。
        </p>
      )}
      <h2 style={{ fontSize: 21, fontWeight: 800 }}>{it.title}</h2>

      <DecisionBar item={it} current={entry.userDecision} />
      <p className="small muted">
        いま：{decisionLabel(entry.userDecision).mark} {decisionLabel(entry.userDecision).ja}　/ 面白い・保留・アーカイブはもう一度押すと未選択に戻ります。
      </p>

      {isDaily ? (
        <dl className="kv">
          <dt>元現象</dt>
          <dd>{it.hook || it.observation}</dd>
          {/^https?:\/\//.test(it.sourceUrl) && (
            <>
              <dt>情報源</dt>
              <dd>
                <ExternalLink href={it.sourceUrl}>{it.sourceTitle || it.sourceUrl}</ExternalLink>
                {it.sourceName && <span className="muted">（{it.sourceName}）</span>}
              </dd>
            </>
          )}
          {it.story && (
            <>
              <dt>ストーリー</dt>
              <dd>
                <details className="fold">
                  <summary>開く</summary>
                  {paragraphs(it.story).map((p, i) => (
                    <p key={i} style={{ marginBottom: 8 }}>
                      {p}
                    </p>
                  ))}
                </details>
              </dd>
            </>
          )}
        </dl>
      ) : (
        <div>
          <label className="field-label" htmlFor="body">
            本文
          </label>
          <textarea id="body" className="note" value={entry.body} onChange={(e) => setBody(e.target.value)} />
          {/^https?:\/\//.test(it.sourceUrl) && (
            <p className="small" style={{ marginTop: 4 }}>
              <ExternalLink href={it.sourceUrl}>{it.sourceUrl}</ExternalLink>
            </p>
          )}
        </div>
      )}

      <div className="detail-light">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="q-label">LIGHT DEEP</span>
          <a className="pill-link" href={href('/deep', { id: entry.id })}>
            {light ? '開く' : '3行を書く'} <Icon name="arrowRight" size={13} />
          </a>
        </div>
        {light ? <LightDeepLines value={light} /> : <p className="small muted">まだ3行はありません。</p>}
      </div>

      {(progress > 0 || entry.userDecision === 'DEEP') && (
        <details className="fold" open={entry.userDecision === 'DEEP'}>
          <summary>
            FULL DEEP（記入 {Math.round(progress * 100)}%・境界テスト {boundaryCount}/{BOUNDARY_PROBES.length}）
          </summary>
          <p style={{ margin: '6px 0' }}>
            <strong>{notes.principleCandidate.trim() || it.principleCandidate || '（原理候補はまだありません）'}</strong>
            <span className="small muted">　{notes.principleCandidate.trim() ? 'あなたの言葉' : 'AI の下書き'}</span>
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {coreAnswers.map(({ q, mine, ai }) => (
              <li key={q.key}>
                <span className="muted">{q.question}</span> {mine || <span style={{ color: 'var(--ink-4)' }}>{ai ? `（AI）${ai}` : '未記入'}</span>}
              </li>
            ))}
          </ul>
          <a className="pill-link" style={{ marginTop: 8 }} href={href('/deep', { id: entry.id, mode: 'full' })}>
            FULL DEEP で続きを書く <Icon name="arrowRight" size={13} />
          </a>
        </details>
      )}

      {(rel.parent || rel.from.length > 0 || rel.children.length > 0) && (
        <div>
          <span className="field-label">つながり（どこから来て、どこへ戻ったか）</span>
          <ul className="lineage">
            {rel.parent && <LinkedEntry e={rel.parent} label="元：" />}
            {rel.from.map((e) => (
              <LinkedEntry key={e.id} e={e} label="派生元：" />
            ))}
            {rel.children.map((e) => (
              <LinkedEntry key={e.id} e={e} label="ここから：" />
            ))}
          </ul>
        </div>
      )}

      {(entry.type === 'TOOLCHAIN' || entry.type === 'CAPABILITY' || entry.tools.length > 0) && (
        <div>
          <label className="field-label" htmlFor="tools">
            道具の組み合わせ（「×」区切り）
          </label>
          <input
            id="tools"
            className="text"
            value={toolText}
            onChange={(e) => setToolText(e.target.value)}
            onBlur={() => patch({ tools: toolText.split(/[×x✕,、]/).map((t) => t.trim()).filter(Boolean) })}
            placeholder="例：Tripo3D × Blender × Three.js × Codex"
          />
          <p className="small muted" style={{ marginTop: 4 }}>原理ではなく「できることを増やす組み合わせ」として残します。</p>
        </div>
      )}

      <details className="fold" open={entry.engineIds.length > 0}>
        <summary>思考エンジンを借りる（任意）</summary>
        <div style={{ marginTop: 8 }}>
          <EnginePicker selected={entry.engineIds} onChange={(engineIds) => patch({ engineIds })} target={{ title: it.title, text: entry.body || it.hook }} />
        </div>
      </details>

      <details className="fold" open={coreLockFilled(entry.coreLock)}>
        <summary>CORE LOCK（守るものを決めて、大胆に壊す）</summary>
        <div style={{ marginTop: 8 }}>
          <CoreLockEditor value={entry.coreLock} onChange={(coreLock) => patch({ coreLock })} />
        </div>
      </details>

      <details className="fold" open={entry.media.length > 0}>
        <summary>どこへ出せそう？（メディア）</summary>
        <div style={{ marginTop: 8 }}>
          <MediaPicker selected={entry.media} onChange={(media) => patch({ media })} />
        </div>
      </details>

      <div>
        <label className="field-label" htmlFor="memo">
          自分のメモ
        </label>
        <textarea id="memo" className="note" value={entry.memo} onChange={(e) => patch({ memo: e.target.value })} placeholder="気づいたこと、引っかかったこと" />
      </div>
      <div>
        <label className="field-label" htmlFor="tags">
          タグ（「、」区切り）
        </label>
        <input
          id="tags"
          className="text"
          value={tagText}
          onChange={(e) => setTagText(e.target.value)}
          onBlur={() => patch({ tags: [...new Set(splitList(tagText).map((t) => t.replace(/^#/, '')))] })}
          placeholder="例：痕跡、探索"
        />
      </div>
      <div>
        <label className="field-label" htmlFor="exp">
          試してみたいこと（1行に1つ）
        </label>
        <textarea
          id="exp"
          className="note"
          value={entry.experiments.join('\n')}
          onChange={(e) => patch({ experiments: e.target.value.split('\n') })}
          placeholder="例：紙カード5枚で、痕跡だけを見せて相手に探してもらう"
        />
      </div>

      <div className="row">
        <a className="btn" href={href('/deep', { id: entry.id })}>
          <Icon name="spark" size={16} /> LIGHT DEEP
        </a>
        <a className="btn" href={href('/deep', { id: entry.id, mode: 'full' })}>
          <Icon name="search" size={16} /> FULL DEEP
        </a>
        <a className="btn" href={href('/connect', { a: entry.id })}>
          <Icon name="connect" size={16} /> CONNECT
        </a>
        <a className="btn" href={entry.type === 'EXPERIMENT' ? href('/experiment', { design: entry.id }) : href('/experiment', { from: 'item', id: entry.id })}>
          <Icon name="flask" size={16} /> EXPERIMENT
        </a>
        <button
          type="button"
          className="btn ghost danger"
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            if (confirm('DIARY から削除しますか？（DEEP のメモは残ります。残しておくだけなら「× アーカイブ」がおすすめです）')) {
              removeFromDiary(entry.id);
              navigate('/diary');
              toast('削除しました');
            }
          }}
        >
          <Icon name="trash" size={16} /> 削除
        </button>
      </div>
    </section>
  );
}
