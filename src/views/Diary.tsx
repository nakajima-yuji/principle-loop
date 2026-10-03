import { useMemo, useRef, useState } from 'react';
import { CategoryChip, ExternalLink, PageHead, StateBadge, StateSelect } from '../components/common.tsx';
import { Icon } from '../components/Icon.tsx';
import { Thumb } from '../components/Thumb.tsx';
import { markActive } from '../data/heartbeat.ts';
import { emptyNotes, exportPersonal, importPersonal, notesProgress, removeFromDiary, updateDiary, usePersonal } from '../data/store.ts';
import { toast } from '../data/toast.ts';
import { normalizeText, paragraphs, splitList } from '../lib/text.ts';
import { href, navigate } from '../router.ts';
import { BOUNDARY_PROBES, CORE_QUESTIONS, PRINCIPLE_STATES } from '../shared/questions.ts';
import { formatDotDate, jstDateString } from '../shared/time.ts';
import type { DeepNotes, DiaryEntry, PrincipleState } from '../shared/types.ts';

export function DiaryView({ id, state, tag }: { id: string | null; state: string | null; tag: string | null }) {
  const personal = usePersonal();
  const [filter, setFilter] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    personal.diary.forEach((d) => (c[d.state] = (c[d.state] ?? 0) + 1));
    return c;
  }, [personal.diary]);

  const topTags = useMemo(() => {
    const c = new Map<string, number>();
    personal.diary.forEach((d) => d.tags.forEach((t) => c.set(t, (c.get(t) ?? 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [personal.diary]);

  const list = useMemo(() => {
    const f = normalizeText(filter);
    return personal.diary.filter((d) => {
      if (state && d.state !== state) return false;
      if (tag && !d.tags.includes(tag)) return false;
      if (!f) return true;
      return normalizeText(`${d.item.title} ${d.item.principleCandidate} ${d.memo} ${d.tags.join(' ')}`).includes(f);
    });
  }, [personal.diary, state, tag, filter]);

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
      toast(`読み込みました（DIARY ${r.diary}件・CONNECT ${r.connections}件・BUILD ${r.builds}件）`);
    } catch {
      toast('読み込めませんでした。PRINCIPLE LOOP のバックアップファイルか確認してください');
    }
  };

  return (
    <div className="page stack">
      <PageHead
        kicker="DIARY"
        title="保存した原理"
        sub="気になった現象を、観察 → 仮説 → 原理候補 → 原理 → 実験済み と育てていく場所です。データはこの端末のブラウザに保存されます。"
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

      <div className="tabs" role="tablist" aria-label="状態で絞り込む">
        <a className={`tab ${!state ? 'active' : ''}`} href={href('/diary', { tag })}>
          すべて <span className="count">{personal.diary.length}</span>
        </a>
        {PRINCIPLE_STATES.map((s) => (
          <a key={s.id} className={`tab ${state === s.id ? 'active' : ''}`} href={href('/diary', { state: s.id, tag })} title={s.ja}>
            {s.label} <span className="count">{counts[s.id] ?? 0}</span>
          </a>
        ))}
      </div>

      {topTags.length > 0 && (
        <div className="row" style={{ gap: 6 }}>
          {topTags.map(([t, n]) => (
            <a key={t} className={`tag ${tag === t ? 'on' : ''}`} href={href('/diary', { state, tag: tag === t ? undefined : t })}>
              #{t} <span className="muted">{n}</span>
            </a>
          ))}
        </div>
      )}

      {personal.diary.length === 0 ? (
        <div className="panel panel-pad">
          <div className="empty">
            まだ保存した原理はありません。
            <br />
            DAILY の「保存」、または DEEP の「URL から掘る」で追加できます。
            <div style={{ marginTop: 12 }}>
              <a className="btn primary" href={href('/daily')}>
                DAILY を見る
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="diary-layout">
          <div className="stack" style={{ gap: 12 }}>
            <input className="text" type="search" placeholder="DIARY 内を絞り込む" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="DIARY 内を絞り込む" />
            <div className="entry-list">
              {list.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`entry ${selected?.id === d.id ? 'selected' : ''}`}
                  onClick={() => navigate('/diary', { id: d.id, state, tag })}
                >
                  <Thumb category={d.item.category} seed={d.item.id} image={d.item.image} />
                  <span>
                    <span className="row" style={{ gap: 6 }}>
                      <CategoryChip category={d.item.category} />
                      <StateBadge state={d.state} />
                      <span className="small muted">{formatDotDate(d.updatedAt.slice(0, 10))}</span>
                    </span>
                    <span className="t" style={{ display: 'block', marginTop: 6 }}>
                      {d.item.title}
                    </span>
                    <span className="p">{personal.notes[d.id]?.principleCandidate?.trim() || d.item.principleCandidate || d.item.hook}</span>
                  </span>
                </button>
              ))}
              {list.length === 0 && <div className="empty">条件に合う原理はありません。</div>}
            </div>
          </div>
          {selected ? (
            <DiaryDetail entry={selected} notes={{ ...emptyNotes(), ...(personal.notes[selected.id] ?? {}) }} />
          ) : (
            <div className="panel panel-pad detail">
              <div className="empty">左の一覧から原理を選ぶと、ここに詳細が表示されます。</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DiaryDetail({ entry, notes }: { entry: DiaryEntry; notes: DeepNotes }) {
  const it = entry.item;
  const [tagText, setTagText] = useState(entry.tags.join('、'));
  const [lastId, setLastId] = useState(entry.id);
  if (lastId !== entry.id) {
    setLastId(entry.id);
    setTagText(entry.tags.join('、'));
  }
  const coreAnswers = CORE_QUESTIONS.map((q) => ({ q, mine: notes[q.key].trim(), ai: (it[q.key] ?? '').trim() }));
  const boundaryCount = BOUNDARY_PROBES.filter((p) => (notes.boundary[p] ?? '').trim()).length;

  const setState = (s: PrincipleState) => {
    updateDiary(entry.id, { state: s });
    markActive();
  };

  return (
    <section className="panel panel-pad detail stack" aria-label="原理の詳細">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="row">
          <CategoryChip category={it.category} full />
          {entry.kind === 'manual' && <span className="tag">自分で追加</span>}
        </span>
        <span style={{ width: 230 }}>
          <StateSelect value={entry.state} onChange={setState} />
        </span>
      </div>
      <h2 style={{ fontSize: 21, fontWeight: 800 }}>{it.title}</h2>

      <dl className="kv">
        <dt>元現象</dt>
        <dd>{it.hook || it.observation}</dd>
        <dt>情報源</dt>
        <dd>
          <ExternalLink href={it.sourceUrl}>{it.sourceTitle || it.sourceUrl}</ExternalLink>
          {it.sourceName && <span className="muted">（{it.sourceName}）</span>}
        </dd>
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
        <dt>原理候補</dt>
        <dd>
          <strong>{notes.principleCandidate.trim() || it.principleCandidate || '（まだありません）'}</strong>
          <span className="small muted">　{notes.principleCandidate.trim() ? 'あなたの言葉' : 'AI の下書き'}</span>
        </dd>
        <dt>DEEP 結果</dt>
        <dd>
          <div className="small muted" style={{ marginBottom: 4 }}>
            記入 {Math.round(notesProgress(notes) * 100)}%・境界テスト {boundaryCount}/{BOUNDARY_PROBES.length}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {coreAnswers.map(({ q, mine, ai }) => (
              <li key={q.key}>
                <span className="muted">{q.question}</span> {mine || <span style={{ color: 'var(--ink-4)' }}>{ai ? `（AI）${ai}` : '未記入'}</span>}
              </li>
            ))}
          </ul>
          <a className="pill-link" style={{ marginTop: 8 }} href={href('/deep', { id: entry.id })}>
            DEEP で続きを書く <Icon name="arrowRight" size={13} />
          </a>
        </dd>
      </dl>

      <div>
        <label className="field-label" htmlFor="memo">
          自分のメモ
        </label>
        <textarea id="memo" className="note" value={entry.memo} onChange={(e) => updateDiary(entry.id, { memo: e.target.value })} placeholder="気づいたこと、引っかかったこと" />
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
          onBlur={() => updateDiary(entry.id, { tags: [...new Set(splitList(tagText).map((t) => t.replace(/^#/, '')))] })}
          placeholder="例：自己組織化、フィードバック"
        />
      </div>
      <div>
        <label className="field-label" htmlFor="exp">
          実験案（1行に1つ）
        </label>
        <textarea
          id="exp"
          className="note"
          value={entry.experiments.join('\n')}
          onChange={(e) => updateDiary(entry.id, { experiments: e.target.value.split('\n') })}
          placeholder="例：通るほど道が太くなるマップを、30分で作って比べる"
        />
      </div>

      <div className="row">
        <a className="btn" href={href('/deep', { id: entry.id })}>
          <Icon name="search" size={16} /> DEEP
        </a>
        <a className="btn" href={href('/connect', { a: entry.id })}>
          <Icon name="connect" size={16} /> CONNECT
        </a>
        <a className="btn" href={href('/build', { from: 'item', id: entry.id })}>
          <Icon name="flask" size={16} /> BUILD
        </a>
        <button
          type="button"
          className="btn ghost danger"
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            if (confirm('DIARY から削除しますか？（DEEP のメモは残ります）')) {
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
