import { useEffect, useMemo, useRef, useState } from 'react';
import { CategoryChip, ExternalLink, PageHead, StateBadge, StateSelect } from '../components/common.tsx';
import { Icon } from '../components/Icon.tsx';
import { ItemThumb, LightDeepCard, NoteThumb, SourceBadge } from '../components/LightDeep.tsx';
import { Markdown } from '../components/Markdown.tsx';
import { useAsync } from '../data/api.ts';
import { markActive } from '../data/heartbeat.ts';
import { loadRepoNotes, repoNoteUrl } from '../data/repo-notes.ts';
import {
  emptyNotes,
  exportPersonal,
  importPersonal,
  notesProgress,
  removeFromDiary,
  saveNote,
  setEntryDeep,
  updateDiary,
  updateNote,
  usePersonal,
} from '../data/store.ts';
import { toast } from '../data/toast.ts';
import {
  countBySource,
  diarySource,
  entryToTimeline,
  filterTimeline,
  groupByDate,
  isDiarySource,
  isNoteItem,
  repoToTimeline,
  sourceLabel,
  SOURCES,
  type NoteSource,
  type TimelineItem,
} from '../lib/note.ts';
import type { RepoNote } from '../lib/repo-note.ts';
import { paragraphs, splitList } from '../lib/text.ts';
import { href, navigate } from '../router.ts';
import { lightDeepOf } from '../shared/deep.ts';
import { BOUNDARY_PROBES, CORE_QUESTIONS, PRINCIPLE_STATES } from '../shared/questions.ts';
import { formatJaDate, formatJaDateTime, jstDateString } from '../shared/time.ts';
import type { DeepNotes, DiaryEntry, PrincipleState } from '../shared/types.ts';

export function DiaryView({ id, state, tag, src }: { id: string | null; state: string | null; tag: string | null; src: string | null }) {
  const personal = usePersonal();
  const repo = useAsync(loadRepoNotes, []);
  const [filter, setFilter] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const source = isDiarySource(src) ? src : null;

  // 端末に保存した DIARY（DAILY・Memo・気づき）＋ リポジトリに送った Markdown を、同じ時間軸に並べる
  const all = useMemo<TimelineItem[]>(
    () => [...personal.diary.map((d) => entryToTimeline(d, personal.notes[d.id])), ...(repo.data ?? []).map(repoToTimeline)],
    [personal.diary, personal.notes, repo.data],
  );
  const bySource = useMemo(() => countBySource(all), [all]);

  const stateCounts = useMemo(() => {
    const c: Record<string, number> = {};
    personal.diary.forEach((d) => (c[d.state] = (c[d.state] ?? 0) + 1));
    return c;
  }, [personal.diary]);

  const topTags = useMemo(() => {
    const c = new Map<string, number>();
    all.forEach((t) => t.tags.forEach((x) => c.set(x, (c.get(x) ?? 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [all]);

  const groups = useMemo(() => groupByDate(filterTimeline(all, { source, state, tag, query: filter })), [all, source, state, tag, filter]);
  const selected = all.find((t) => t.id === id) ?? null;
  const layoutRef = useRef<HTMLDivElement>(null);

  // 1 列表示（スマホなど）では、選んだものの詳細までスクロールする（画面移動のたびに先頭へ戻るため、その後で動かす）
  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId || window.innerWidth > 1080) return;
    const t = setTimeout(() => layoutRef.current?.querySelector('.detail')?.scrollIntoView({ block: 'start' }), 0);
    return () => clearTimeout(t);
  }, [selectedId]);

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
        title="観測日記"
        sub="AI が世界から拾ったもの（DAILY）と、自分で見つけたもの（MEMO・気づき）を同じ時間軸に残す場所。全部は掘らず、3行DEEP で少しだけ照らして、深く掘るものは自分で選びます（データはこの端末のブラウザに保存）。"
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

      <NoteComposer />

      <div className="tabs" role="tablist" aria-label="情報源で絞り込む">
        <a className={`tab ${!source ? 'active' : ''}`} href={href('/diary', { state, tag })}>
          ALL <span className="count">{all.length}</span>
        </a>
        {SOURCES.map((s) => (
          <a key={s.id} className={`tab ${source === s.id ? 'active' : ''}`} href={href('/diary', { src: s.id, state, tag })} title={s.description}>
            {s.label} <span className="count">{bySource[s.id]}</span>
          </a>
        ))}
      </div>

      {topTags.length > 0 && (
        <div className="row" style={{ gap: 6 }}>
          {topTags.map(([t, n]) => (
            <a key={t} className={`tag ${tag === t ? 'on' : ''}`} href={href('/diary', { src: source, state, tag: tag === t ? undefined : t })}>
              #{t} <span className="muted">{n}</span>
            </a>
          ))}
        </div>
      )}

      {all.length === 0 ? (
        <div className="panel panel-pad">
          <div className="empty">
            まだ記録はありません。
            <br />
            上の欄から Memo・気づきを送るか、DAILY の「保存」で追加できます。
            <div style={{ marginTop: 12 }}>
              <a className="btn primary" href={href('/daily')}>
                DAILY を見る
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div ref={layoutRef} className={`diary-layout ${selected ? 'has-selected' : ''}`}>
          <div className="stack" style={{ gap: 12 }}>
            <div className="diary-search">
              <input className="text" type="search" placeholder="DIARY 内を絞り込む" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="DIARY 内を絞り込む" />
              <select
                className="select"
                value={state ?? ''}
                onChange={(e) => navigate('/diary', { src: source, state: e.target.value || undefined, tag })}
                aria-label="状態で絞り込む"
              >
                <option value="">状態：すべて</option>
                {PRINCIPLE_STATES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}（{s.ja}） {stateCounts[s.id] ?? 0}
                  </option>
                ))}
              </select>
            </div>
            {repo.error && <div className="small muted">リポジトリのメモ（diary/ など）を読み込めませんでした。端末に保存した分だけを表示しています。</div>}
            <div className="timeline">
              {groups.map((g) => (
                <section key={g.date || 'none'} className="day-group" aria-label={g.date ? formatJaDate(g.date) : '日付なし'}>
                  <h3 className="day-head">
                    {g.date ? formatJaDate(g.date) : '日付なし'}
                    <span className="count">{g.items.length}</span>
                  </h3>
                  <div className="entry-list">
                    {g.items.map((t) => (
                      <TimelineRow key={t.id} t={t} selected={selected?.id === t.id} onOpen={() => navigate('/diary', { id: t.id, src: source, state, tag })} />
                    ))}
                  </div>
                </section>
              ))}
              {groups.length === 0 && <div className="empty">条件に合う記録はありません。</div>}
            </div>
          </div>
          {selected?.entry ? (
            isNoteItem(selected.entry.item) ? (
              <NoteDetail key={selected.id} entry={selected.entry} />
            ) : (
              <DiaryDetail key={selected.id} entry={selected.entry} notes={{ ...emptyNotes(), ...(personal.notes[selected.id] ?? {}) }} />
            )
          ) : selected?.repo ? (
            <RepoNoteDetail key={selected.id} note={selected.repo} />
          ) : (
            <div className="panel panel-pad detail">
              <div className="empty">左の一覧から選ぶと、ここに詳細と 3行DEEP が表示されます。</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 送る

function NoteComposer() {
  const [text, setText] = useState('');
  const [source, setSource] = useState<NoteSource>('memo');
  const [tags, setTags] = useState('');

  const send = () => {
    if (!text.trim()) {
      toast('内容を書いてください');
      return;
    }
    const entry = saveNote({ text, source, tags: splitList(tags) });
    markActive();
    setText('');
    setTags('');
    toast(`${sourceLabel(source)} を DIARY に残しました`);
    navigate('/diary', { id: entry.id });
  };

  return (
    <section className="panel panel-pad composer" aria-label="Memo・気づきを送る">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="panel-title">
          <Icon name="pen" size={18} /> PRINCIPLE LOOP へ送る
        </span>
        <SourceToggle value={source} onChange={setSource} />
      </div>
      <textarea
        className="note"
        aria-label="Memo・気づきの内容"
        placeholder={source === 'memo' ? '例：全部を深掘りするとAIが答えを作りすぎる' : '例：DIARYは深掘りする場所ではなく、種を残す場所かもしれない'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send();
        }}
      />
      <div className="composer-foot">
        <input className="text" placeholder="関連テーマ（任意・「、」区切り）" value={tags} onChange={(e) => setTags(e.target.value)} aria-label="関連テーマ" />
        <button type="button" className="btn primary" onClick={send}>
          <Icon name="arrowRight" size={16} /> 送る
        </button>
      </div>
      <p className="small muted">AI の分析はせず、そのまま残します。3行DEEP は、必要になったときに付けられます。</p>
    </section>
  );
}

function SourceToggle({ value, onChange }: { value: NoteSource; onChange: (s: NoteSource) => void }) {
  return (
    <span className="seg" role="radiogroup" aria-label="種類">
      {(['memo', 'insight'] as const).map((s) => (
        <button key={s} type="button" role="radio" aria-checked={value === s} className={`seg-btn ${value === s ? 'on' : ''}`} data-source={s} onClick={() => onChange(s)}>
          {sourceLabel(s)}
        </button>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------- 一覧の 1 行

function TimelineRow({ t, selected, onOpen }: { t: TimelineItem; selected: boolean; onOpen: () => void }) {
  const e = t.entry;
  const note = e ? isNoteItem(e.item) : true;
  const time = e ? (note || e.kind === 'manual' ? formatJaDateTime(e.createdAt).slice(11) : '') : t.repo?.time ?? '';
  return (
    <button type="button" className={`entry ${selected ? 'selected' : ''}`} data-source={t.source} onClick={onOpen}>
      {e ? <ItemThumb item={e.item} /> : <NoteThumb source={t.source === 'memo' ? 'memo' : 'insight'} />}
      <span>
        <span className="row" style={{ gap: 6 }}>
          <SourceBadge source={t.source} />
          {e && !note && <CategoryChip category={e.item.category} />}
          {e && <StateBadge state={e.state} />}
          {t.repo && <span className="tag">リポジトリ</span>}
          {time && time !== '—' && <span className="small muted">{time}</span>}
        </span>
        <span className="t" style={{ display: 'block', marginTop: 6 }}>
          {t.title}
        </span>
        {t.text && <span className="p">{t.text}</span>}
        {e && !note && e.memo.trim() && (
          <span className="p memo-line">
            <Icon name="pen" size={12} /> {e.memo}
          </span>
        )}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- 詳細：DAILY（と、URL から掘った現象・CONNECT）

function DiaryDetail({ entry, notes }: { entry: DiaryEntry; notes: DeepNotes }) {
  const it = entry.item;
  const [tagText, setTagText] = useState(entry.tags.join('、'));
  const coreAnswers = CORE_QUESTIONS.map((q) => ({ q, mine: notes[q.key].trim(), ai: (it[q.key] ?? '').trim() }));
  const boundaryCount = BOUNDARY_PROBES.filter((p) => (notes.boundary[p] ?? '').trim()).length;
  const progress = notesProgress(notes);

  const setState = (s: PrincipleState) => {
    updateDiary(entry.id, { state: s });
    markActive();
  };

  return (
    <section className="panel panel-pad detail stack" aria-label="原理の詳細">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="row">
          <SourceBadge source={diarySource(entry)} />
          <CategoryChip category={it.category} full />
          {entry.kind === 'manual' && <span className="tag">自分で追加</span>}
        </span>
        <span style={{ width: 230 }}>
          <StateSelect value={entry.state} onChange={setState} />
        </span>
      </div>
      <h2 style={{ fontSize: 21, fontWeight: 800 }}>{it.title}</h2>

      <LightDeepCard
        deep={entry.deep ?? lightDeepOf(it)}
        editable
        canClear={Boolean(entry.deep)}
        onSave={(d) => {
          setEntryDeep(entry.id, d);
          markActive();
        }}
        promptText={`${it.title}\n${it.hook}`}
        promptKind="現象"
        footer={
          <a className="pill-link" href={href('/deep', { id: entry.id })}>
            もう少し調べたい → 本格的に掘る <Icon name="arrowRight" size={13} />
          </a>
        }
      />

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
        <dt>本格DEEP</dt>
        <dd>
          <div className="small muted" style={{ marginBottom: 4 }}>
            記入 {Math.round(progress * 100)}%・境界テスト {boundaryCount}/{BOUNDARY_PROBES.length}
          </div>
          <details className="fold" open={progress > 0}>
            <summary>7つの中心質問</summary>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {coreAnswers.map(({ q, mine, ai }) => (
                <li key={q.key}>
                  <span className="muted">{q.question}</span> {mine || <span style={{ color: 'var(--ink-4)' }}>{ai ? `（AI）${ai}` : '未記入'}</span>}
                </li>
              ))}
            </ul>
          </details>
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
      <TagsField entry={entry} value={tagText} onChange={setTagText} />
      <ExperimentsField entry={entry} />
      <EntryActions entry={entry} />
    </section>
  );
}

// ---------------------------------------------------------------- 詳細：Memo / 気づき

function NoteDetail({ entry }: { entry: DiaryEntry }) {
  const source: NoteSource = diarySource(entry) === 'insight' ? 'insight' : 'memo';
  const [tagText, setTagText] = useState(entry.tags.join('、'));

  return (
    <section className="panel panel-pad detail stack" aria-label={`${sourceLabel(source)}の詳細`}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="row">
          <SourceBadge source={source} />
          <span className="small muted">{formatJaDateTime(entry.createdAt)}</span>
        </span>
        <span style={{ width: 230 }}>
          <StateSelect
            value={entry.state}
            onChange={(s) => {
              updateDiary(entry.id, { state: s });
              markActive();
            }}
          />
        </span>
      </div>

      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <label className="field-label" htmlFor="note-text" style={{ margin: 0 }}>
            {sourceLabel(source)}
          </label>
          <SourceToggle value={source} onChange={(s) => updateNote(entry.id, { source: s })} />
        </div>
        <textarea id="note-text" className="note note-body" value={entry.item.hook} onChange={(e) => updateNote(entry.id, { text: e.target.value })} />
      </div>

      <LightDeepCard
        deep={entry.deep ?? null}
        editable
        canClear={Boolean(entry.deep)}
        onSave={(d) => {
          setEntryDeep(entry.id, d);
          markActive();
        }}
        promptText={entry.item.hook}
        promptKind={source === 'memo' ? 'メモ' : '気づき'}
        emptyText="3行DEEP はまだありません。必要になったら「書く」から付けられます（AI チャットに頼む文面もコピーできます）。"
        footer={
          <a className="pill-link" href={href('/deep', { id: entry.id })}>
            もう少し調べたい → 本格的に掘る <Icon name="arrowRight" size={13} />
          </a>
        }
      />

      <div>
        <label className="field-label" htmlFor="memo">
          追記（その後の気づき）
        </label>
        <textarea
          id="memo"
          className="note"
          value={entry.memo}
          onChange={(e) => updateDiary(entry.id, { memo: e.target.value })}
          placeholder="数日後に思ったこと、つながったもの。育ってきたら状態を「仮説」「原理候補」へ"
        />
      </div>
      <TagsField entry={entry} value={tagText} onChange={setTagText} label="関連テーマ・タグ（「、」区切り）" />
      <EntryActions entry={entry} />
    </section>
  );
}

// ---------------------------------------------------------------- 詳細：リポジトリの Markdown

function RepoNoteDetail({ note }: { note: RepoNote }) {
  const url = repoNoteUrl(note);
  return (
    <section className="panel panel-pad detail stack" aria-label="リポジトリのメモ">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="row">
          <SourceBadge source={note.source} />
          <span className="tag">リポジトリ</span>
          <span className="small muted">
            {note.date ? formatJaDate(note.date) : '日付なし'} {note.time}
          </span>
        </span>
        {url && <ExternalLink href={url}>GitHub で開く</ExternalLink>}
      </div>
      <h2 style={{ fontSize: 21, fontWeight: 800 }}>{note.title}</h2>
      <p className="small muted">
        <code>{note.path}</code> — リポジトリに送った Markdown です。アプリからは読むだけです（直すときはファイルを編集します）。
      </p>
      <LightDeepCard
        deep={note.deep}
        promptText={note.body.slice(0, 6000)}
        promptKind="気づき"
        emptyText="3行DEEP はまだありません。ファイルに「・なぜ気になった？ → …」の3行を書くと、ここに表示されます。"
      />
      <details className="fold" open>
        <summary>本文</summary>
        {/* 先頭の見出しは上のタイトルと同じなので省く */}
        <Markdown text={note.body.replace(/^\s*#\s+.*$/m, '')} />
      </details>
    </section>
  );
}

// ---------------------------------------------------------------- 共通の欄

function TagsField({ entry, value, onChange, label = 'タグ（「、」区切り）' }: { entry: DiaryEntry; value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div>
      <label className="field-label" htmlFor="tags">
        {label}
      </label>
      <input
        id="tags"
        className="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => updateDiary(entry.id, { tags: [...new Set(splitList(value).map((t) => t.replace(/^#/, '')))] })}
        placeholder="例：自己組織化、フィードバック"
      />
    </div>
  );
}

function ExperimentsField({ entry }: { entry: DiaryEntry }) {
  return (
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
  );
}

function EntryActions({ entry }: { entry: DiaryEntry }) {
  return (
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
  );
}
