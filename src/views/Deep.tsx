import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CategoryChip, ErrorBox, ExternalLink, FactBox, FailedNotice, Loading, PageHead, SectionLabel, StateSelect } from '../components/common.tsx';
import { Icon } from '../components/Icon.tsx';
import { Thumb } from '../components/Thumb.tsx';
import { loadItem, loadLatestDaily, useAsync } from '../data/api.ts';
import { markActive } from '../data/heartbeat.ts';
import { emptyNotes, newId, notesProgress, saveToDiary, setNotes, updateDiary, usePersonal } from '../data/store.ts';
import { copyText, toast } from '../data/toast.ts';
import { createManualItem, isHttpUrl } from '../lib/manual.ts';
import { href, navigate } from '../router.ts';
import { CATEGORIES } from '../shared/categories.ts';
import { BOUNDARY_PROBES, CORE_QUESTIONS, EXTRA_STEPS, type CoreQuestion, type ExtraStep } from '../shared/questions.ts';
import { formatDotDate } from '../shared/time.ts';
import { getLightDeep } from '../shared/light-deep.ts';
import type { CategoryId, DailyItem, DeepNotes } from '../shared/types.ts';
import { LightDeepWorkspace } from './LightDeep.tsx';

/** /deep?id=… は LIGHT DEEP（3行＋人間が選ぶ）。/deep?id=…&mode=full は FULL DEEP（7つの質問） */
export function DeepView({ id, mode }: { id: string | null; mode?: string | null }) {
  if (!id) return <DeepPicker />;
  return <DeepLoader id={id} full={mode === 'full'} />;
}

function DeepLoader({ id, full }: { id: string; full: boolean }) {
  const item = useAsync(() => loadItem(id), [id]);
  // 「掘る」は有効な反応として扱う
  useEffect(() => {
    markActive();
  }, [id]);
  if (item.loading && !item.data) return <Loading />;
  if (item.error || !item.data) return <ErrorBox message={item.error ?? '読み込めませんでした'} />;
  return full ? <DeepWorkspace item={item.data} /> : <LightDeepWorkspace item={item.data} />;
}

// ---------------------------------------------------------------- picker

function DeepPicker() {
  const latest = useAsync(loadLatestDaily, []);
  const personal = usePersonal();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [phenomenon, setPhenomenon] = useState('');
  const [category, setCategory] = useState<CategoryId>('foreign');

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!isHttpUrl(url)) {
      toast('URL は https:// から始まる形で入力してください');
      return;
    }
    if (phenomenon.trim().length < 10) {
      toast('何が起きているか（現象）を、もう少し書いてください');
      return;
    }
    const item = createManualItem({ url, title, phenomenon, category }, new Date(), newId('manual'));
    saveToDiary(item, { kind: 'manual', type: 'OBSERVATION' });
    markActive();
    navigate('/deep', { id: item.id });
  };

  return (
    <div className="page stack">
      <PageHead
        kicker="DEEP"
        title="軽く掘って、選ぶ"
        sub="まず LIGHT DEEP（3行）で止めて、面白いかどうかを自分で選びます。「深掘り」を選んだものだけ FULL DEEP（7つの質問）で構造まで分解します。"
      />

      <section className="panel panel-pad">
        <div className="panel-head">
          <span className="panel-title">
            <Icon name="sun" size={18} /> 今日の観察から
          </span>
        </div>
        {latest.data ? (
          <div className="picker-grid">
            {latest.data.items.map((it) => (
              <a key={it.id} className="pick" href={href('/deep', { id: it.id })}>
                <Thumb category={it.category} seed={it.id} image={it.image} />
                <span>
                  <CategoryChip category={it.category} />
                  <span className="t" style={{ marginTop: 4 }}>
                    {it.title}
                  </span>
                </span>
              </a>
            ))}
          </div>
        ) : latest.error ? (
          <ErrorBox message={latest.error} />
        ) : (
          <Loading />
        )}
      </section>

      {personal.diary.length > 0 && (
        <section className="panel panel-pad">
          <div className="panel-head">
            <span className="panel-title">
              <Icon name="book" size={18} /> DIARY から掘る
            </span>
          </div>
          <div className="picker-grid">
            {[...personal.diary]
              .filter((d) => d.userDecision !== 'ARCHIVE')
              .sort((a, b) => Number(b.userDecision === 'DEEP') - Number(a.userDecision === 'DEEP'))
              .slice(0, 12)
              .map((d) => (
              <a key={d.id} className="pick" href={href('/deep', { id: d.id, mode: d.userDecision === 'DEEP' ? 'full' : undefined })}>
                <Thumb category={d.item.category} seed={d.item.id} image={d.item.image} />
                <span>
                  <span className="small muted">
                    {d.userDecision === 'DEEP' ? '↓深掘り中・' : ''}
                    {Math.round(notesProgress(personal.notes[d.id]) * 100)}% 記入
                  </span>
                  <span className="t">{d.item.title}</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="panel panel-pad">
        <div className="panel-head">
          <span className="panel-title">
            <Icon name="link" size={18} /> URL から掘る <span className="muted">X の投稿・記事・動画など</span>
          </span>
        </div>
        <p className="small muted" style={{ marginBottom: 12 }}>
          X などの中身は自動で取りに行きません（X API に依存しないため）。何が起きているかを、自分の言葉で書いてください。DIARY に「観察」として保存され、そのまま LIGHT DEEP に進みます。
        </p>
        <form className="stack" style={{ gap: 12 }} onSubmit={onCreate}>
          <div>
            <label className="field-label" htmlFor="m-url">
              URL
            </label>
            <input id="m-url" className="text" type="url" inputMode="url" placeholder="https://x.com/..." value={url} onChange={(e) => setUrl(e.target.value)} required />
          </div>
          <div className="two-col" style={{ gap: 12 }}>
            <div>
              <label className="field-label" htmlFor="m-title">
                タイトル（任意）
              </label>
              <input id="m-title" className="text" placeholder="例：信号のない交差点の流れ" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="m-cat">
                分野
              </label>
              <select id="m-cat" className="select" value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="m-ph">
              何が起きている？（現象・事実）
            </label>
            <textarea
              id="m-ph"
              className="note"
              placeholder="例：信号のない交差点で、車も人も互いに少しずつ譲り合い、止まらずに流れている。"
              value={phenomenon}
              onChange={(e) => setPhenomenon(e.target.value)}
              required
            />
          </div>
          <div>
            <button type="submit" className="btn primary">
              <Icon name="search" size={16} /> DEEP へ送る
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- workspace

function DeepWorkspace({ item }: { item: DailyItem }) {
  const personal = usePersonal();
  const notes: DeepNotes = useMemo(() => ({ ...emptyNotes(), ...(personal.notes[item.id] ?? {}) }), [personal.notes, item.id]);
  const entry = personal.diary.find((d) => d.id === item.id);
  const progress = notesProgress(notes);
  const set = (patch: Partial<DeepNotes>) => setNotes(item.id, patch);

  const onSave = () => {
    const hasCandidate = notes.principleCandidate.trim().length > 0;
    saveToDiary(item, { kind: item.aiProvider === 'manual' ? 'manual' : 'daily', state: hasCandidate ? 'PRINCIPLE_CANDIDATE' : 'PATTERN', userDecision: 'DEEP' });
    markActive();
    toast('DIARY に保存しました');
  };

  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 12 }}>
        <a className="btn sm ghost" href={href('/deep', { id: item.id })}>
          <Icon name="arrowLeft" size={15} /> LIGHT DEEP に戻る
        </a>
        <a className="btn sm ghost" href={href('/deep')}>
          掘る対象を選ぶ
        </a>
      </div>
      <div className="deep-layout">
        <div>
          <section className="panel deep-hero">
            <Thumb category={item.category} seed={item.id} image={item.image} />
            <div>
              <div className="row">
                <span className="page-kicker" style={{ margin: 0 }}>
                  FULL DEEP
                </span>
                <CategoryChip category={item.category} full />
              </div>
              <h1>{item.title}</h1>
              <p className="muted" style={{ fontSize: 14, lineHeight: 1.8 }}>
                {item.hook}
              </p>
              <p className="small" style={{ marginTop: 8 }}>
                <ExternalLink href={item.sourceUrl}>{item.sourceName || item.sourceTitle || '情報源'}</ExternalLink>
                {item.sourceDate && (
                  <span className="muted" style={{ marginLeft: 10 }}>
                    {formatDotDate(item.sourceDate)}
                  </span>
                )}
                {item.story && (
                  <a style={{ marginLeft: 12 }} href={href('/read', { id: item.id })}>
                    ストーリーを読む
                  </a>
                )}
              </p>
            </div>
          </section>

          {item.analysisFailed && (
            <div style={{ marginTop: 14 }}>
              <FailedNotice reason={item.failReason}>AI の下書きはありません。7つの質問を自分で埋めてみてください。</FailedNotice>
            </div>
          )}

          <SectionLabel kicker="CORE" title="7つの中心質問" />
          <p className="small muted" style={{ margin: '-4px 0 12px' }}>
            ここは「深掘り」を選んだものだけを掘る場所です。毎朝の AI は3行で止めているので、多くの質問は自分の言葉で埋めます（古い日の記事には AI の下書き＝青い点線の枠があります。正解として扱わないでください）。書いた内容はこの端末に自動で保存されます。
          </p>
          <div className="stack">
            {CORE_QUESTIONS.map((q) => (
              <CoreQuestionCard key={q.key} q={q} item={item} notes={notes} onChange={set} />
            ))}
          </div>

          <SectionLabel kicker="FURTHER" title="追加分析" />
          <div className="stack">
            {EXTRA_STEPS.map((s) => (
              <ExtraStepCard key={s.key} step={s} item={item} notes={notes} onChange={set} />
            ))}
          </div>
        </div>

        <aside className="deep-side">
          <section className="panel panel-pad stack" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>記入の進み具合</strong>
              <span className="small muted">{Math.round(progress * 100)}%</span>
            </div>
            <div className="progress">
              <span style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            {entry ? (
              <>
                <span className="field-label" style={{ marginBottom: 0 }}>
                  段階（AI は上げません）
                </span>
                <StateSelect value={entry.state} onChange={(state) => updateDiary(entry.id, { state })} />
                <a className="btn" href={href('/diary', { id: entry.id })}>
                  <Icon name="book" size={16} /> DIARY で見る
                </a>
              </>
            ) : (
              <button type="button" className="btn primary" onClick={onSave}>
                <Icon name="bookmark" size={16} /> DIARY に保存
              </button>
            )}
          </section>

          <section className="panel panel-pad">
            <div className="q-label">PRINCIPLE CANDIDATE</div>
            <p style={{ fontWeight: 800, lineHeight: 1.7, marginTop: 6 }}>
              {notes.principleCandidate.trim() || item.principleCandidate || 'まだありません'}
            </p>
            <p className="small muted" style={{ marginTop: 6 }}>
              {notes.principleCandidate.trim() ? 'あなたの言葉' : 'AI の下書き'}
            </p>
          </section>

          <section className="panel panel-pad stack" style={{ gap: 10 }}>
            <a className="btn" href={href('/connect', { a: item.id })}>
              <Icon name="connect" size={16} /> CONNECT でぶつける
            </a>
            <a className="btn" href={href('/experiment', { from: 'item', id: item.id })}>
              <Icon name="flask" size={16} /> EXPERIMENT で小さく試す
            </a>
            <button type="button" className="btn ghost" onClick={() => void copyText(deepChatPrompt(item), 'AIチャット用の相談文をコピーしました（自動では送りません）')}>
              <Icon name="copy" size={16} /> AIチャット用にコピー
            </button>
            <p className="small muted">外部の AI チャットに自分で貼るための文です。PRINCIPLE LOOP は AI を自動で呼びません。</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** 外部の AI チャットに自分で貼る相談文（自動では送らない）。答えではなく材料を求める */
function deepChatPrompt(item: DailyItem): string {
  const ld = getLightDeep(item);
  return [
    '次の現象を、7つの質問で構造まで分解するのを手伝ってほしい。',
    '結論や正解は出さず、質問ごとに候補を2つずつ、短く出してください。事実と推測は分けてください。',
    '',
    `【現象】${item.title}`,
    item.observation || item.hook,
    ...(ld ? ['', `【いまの3行】妙：${ld.odd} ／ 構造：${ld.structure} ／ 飛ばす：${ld.transfer}`] : []),
    '',
    ...CORE_QUESTIONS.map((q) => `${q.no}. ${q.question}（${q.hint}）`),
    '',
    '最後に、この説明が成り立たない反例を1つ挙げてください。',
  ].join('\n');
}

function ChipPicker({ options, selected, ai, onToggle }: { options: readonly string[]; selected: string[]; ai: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button key={o} type="button" className={`tag ${on ? 'on' : ''}`} onClick={() => onToggle(o)} aria-pressed={on} title={ai.includes(o) ? 'AI もこれを挙げています' : undefined}>
            {on && <Icon name="check" size={12} />}
            {o}
            {ai.includes(o) && !on && <span style={{ color: 'var(--blue)' }}>・</span>}
          </button>
        );
      })}
    </div>
  );
}

function AiDraft({ text, onUse }: { text: string; onUse?: () => void }) {
  if (!text.trim()) return null;
  return (
    <div className="ai-draft">
      <span className="label">AI の下書き（仮説）</span>
      {text}
      {onUse && (
        <div style={{ marginTop: 6 }}>
          <button type="button" className="btn sm ghost" onClick={onUse}>
            <Icon name="copy" size={13} /> 下書きを自分の答えに写して直す
          </button>
        </div>
      )}
    </div>
  );
}

function CoreQuestionCard({ q, item, notes, onChange }: { q: CoreQuestion; item: DailyItem; notes: DeepNotes; onChange: (p: Partial<DeepNotes>) => void }) {
  const aiText = item[q.key] ?? '';
  const aiTypes = (q.key === 'input' ? item.inputTypes : q.key === 'speed' ? item.speedTypes : q.key === 'discard' ? item.discardTypes : undefined) ?? [];
  const selected = notes.chips[q.key] ?? [];
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    onChange({ chips: { ...notes.chips, [q.key]: next } });
  };
  return (
    <section className="panel q-card" aria-labelledby={`q-${q.key}`}>
      <div className="q-head">
        <span className="num-badge blue">{q.no}</span>
        <div>
          <div className="q-label">{q.label}</div>
          <h3 className="q-question" id={`q-${q.key}`}>
            {q.question}
          </h3>
        </div>
      </div>
      <p className="q-hint">
        {q.hint}
        {q.examples && <span className="muted">　例：{q.examples.join(' ／ ')}</span>}
      </p>
      {q.options && <ChipPicker options={q.options} selected={selected} ai={aiTypes} onToggle={toggle} />}
      <AiDraft text={aiText} onUse={notes[q.key].trim() ? undefined : () => onChange({ [q.key]: aiText })} />
      <textarea
        className="note"
        aria-label={`${q.question}（あなたの答え）`}
        placeholder="あなたの答え"
        value={notes[q.key]}
        onChange={(e) => onChange({ [q.key]: e.target.value })}
      />
    </section>
  );
}

function ExtraStepCard({ step, item, notes, onChange }: { step: ExtraStep; item: DailyItem; notes: DeepNotes; onChange: (p: Partial<DeepNotes>) => void }) {
  return (
    <section className="panel q-card" aria-labelledby={`x-${step.key}`}>
      <div className="q-head">
        <div>
          <div className="q-label">{step.label}</div>
          <h3 className="q-question" id={`x-${step.key}`}>
            {step.title}
          </h3>
        </div>
      </div>
      <p className="q-hint">{step.hint}</p>
      {renderExtraBody(step, item, notes, onChange)}
    </section>
  );
}

function renderExtraBody(step: ExtraStep, item: DailyItem, notes: DeepNotes, onChange: (p: Partial<DeepNotes>) => void) {
  const textarea = (key: 'observation' | 'hypothesis' | 'counterexample' | 'invert' | 'transfer' | 'principleCandidate', placeholder: string) => (
    <textarea className="note" aria-label={step.title} placeholder={placeholder} value={notes[key]} onChange={(e) => onChange({ [key]: e.target.value })} />
  );
  switch (step.key) {
    case 'observation':
      return (
        <>
          {item.observation && <FactBox>{item.observation}</FactBox>}
          {textarea('observation', '自分が確認した事実（解釈は入れない）')}
        </>
      );
    case 'hypothesis':
      return (
        <>
          <AiDraft text={[item.why, item.hypothesis].filter(Boolean).join('\n検証できる形：')} />
          {textarea('hypothesis', '〜だから〜になる。〜を変えれば〜が変わるはず')}
        </>
      );
    case 'counterexample':
      return (
        <>
          <AiDraft text={item.counterexample} />
          {textarea('counterexample', 'この説明が間違っている可能性・成立しない例')}
        </>
      );
    case 'boundary': {
      const aiMap = new Map((item.boundary ?? []).map((b) => [b.probe, b.answer]));
      return (
        <div className="probe-grid">
          {BOUNDARY_PROBES.map((p) => (
            <div className="probe" key={p}>
              <span className="p">{p}</span>
              {aiMap.get(p) && <span className="small muted">AI：{aiMap.get(p)}</span>}
              <textarea
                className="note"
                aria-label={p}
                placeholder="どうなる？"
                value={notes.boundary[p] ?? ''}
                onChange={(e) => onChange({ boundary: { ...notes.boundary, [p]: e.target.value } })}
              />
            </div>
          ))}
        </div>
      );
    }
    case 'invert':
      return (
        <>
          <AiDraft text={item.invert ?? ''} />
          {textarea('invert', '逆にすると？ 例：情報を減らして速くする → 情報を増やして意図的に遅くする')}
        </>
      );
    case 'transfer':
      return (
        <>
          {item.transferIdeas.length > 0 && (
            <div className="ai-draft">
              <span className="label">AI の下書き（転用のたね）</span>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {item.transferIdeas.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {textarea('transfer', '1行に1つ。遠い分野ほどよい')}
        </>
      );
    case 'principleCandidate':
      return (
        <>
          <AiDraft text={item.principleCandidate} onUse={notes.principleCandidate.trim() ? undefined : () => onChange({ principleCandidate: item.principleCandidate })} />
          {textarea('principleCandidate', '用途を消した一文で。まだ「候補」として')}
        </>
      );
  }
}
