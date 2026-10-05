// 創造の循環で使う小さな部品：HUMAN SELECT・すばやいメモ・LIGHT DEEP の3行・思考エンジン・CORE LOCK・メディア

import { useState, type KeyboardEvent } from 'react';
import { ENGINES, NONE_ENGINE_ID, engineChatPrompt, mixQuestions, toggleEngine } from '../engines/index.ts';
import { markActive } from '../data/heartbeat.ts';
import { addMemo, decide } from '../data/store.ts';
import { copyText, toast } from '../data/toast.ts';
import { href, navigate } from '../router.ts';
import { LIGHT_DEEP_LINES } from '../shared/light-deep.ts';
import { CORE_LOCK_QUESTIONS, DECISIONS, MEDIA, QUICK_TYPES, decisionLabel, emptyCoreLock, entryTypeLabel } from '../shared/loop.ts';
import type { CoreLock, DailyItem, DiaryEntry, EntryType, LightDeep, MediumId, UserDecision } from '../shared/types.ts';
import { CategoryChip } from './common.tsx';
import { Icon } from './Icon.tsx';
import { Thumb } from './Thumb.tsx';

export function TypeChip({ type }: { type: EntryType }) {
  const t = entryTypeLabel(type);
  return (
    <span className="type-chip" data-type={type} title={t.ja}>
      {t.label}
    </span>
  );
}

export function DecisionBadge({ decision }: { decision: UserDecision }) {
  if (decision === 'INBOX') return null;
  const d = decisionLabel(decision);
  return (
    <span className="decision-badge" data-decision={decision} title={d.label}>
      {d.mark} {d.ja}
    </span>
  );
}

/** DAILY は分野の印、それ以外は種類の印を出す */
export function EntryKindChip({ entry }: { entry: DiaryEntry }) {
  return entry.type === 'DAILY' ? <CategoryChip category={entry.item.category} /> : <TypeChip type={entry.type} />;
}

/** 一覧の左の小さな絵。DAILY と URL から入れた観察は図形サムネイル、メモなどは種類の印 */
export function EntryThumb({ entry }: { entry: DiaryEntry }) {
  if (entry.type === 'DAILY' || entry.kind === 'manual' || entry.item.image) {
    return <Thumb category={entry.item.category} seed={entry.item.id} image={entry.item.image} />;
  }
  return (
    <span className="type-mark" data-type={entry.type} aria-hidden="true">
      {entryTypeLabel(entry.type).label.slice(0, 2)}
    </span>
  );
}

// ---------------------------------------------------------------- HUMAN SELECT

/**
 * ☆面白い ↓深掘り →試す △保留 ×アーカイブ。
 * 面白い・保留・アーカイブはもう一度押すと未選択に戻る。深掘りは FULL DEEP へ、試すは EXPERIMENT へ進む。
 */
export function DecisionBar({ item, current, compact = false }: { item: DailyItem; current: UserDecision | undefined; compact?: boolean }) {
  const onPick = (d: UserDecision) => {
    const go = d === 'DEEP' || d === 'BUILD';
    const next = decide(item, d, !go);
    markActive();
    if (d === 'DEEP') return navigate('/deep', { id: item.id, mode: 'full' });
    if (d === 'BUILD') return navigate('/experiment', { from: 'item', id: item.id });
    toast(next === 'INBOX' ? '未選択に戻しました' : `${decisionLabel(next).mark} ${decisionLabel(next).ja}（DIARY に入れました）`);
  };
  return (
    <div className={`decision-bar ${compact ? 'compact' : ''}`} role="group" aria-label="HUMAN SELECT：どうする？">
      {DECISIONS.map((d) => {
        const on = current === d.id;
        return (
          <button
            key={d.id}
            type="button"
            className={`decision ${on ? 'on' : ''}`}
            data-decision={d.id}
            aria-pressed={on}
            title={d.id === 'DEEP' ? 'FULL DEEP（7つの質問）へ進む' : d.id === 'BUILD' ? 'EXPERIMENT で小さく試す' : d.label}
            onClick={() => onPick(d.id)}
          >
            <span className="m" aria-hidden="true">
              {d.mark}
            </span>
            <span className="l">{d.ja}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- LIGHT DEEP

export function LightDeepLines({ value, compact = false }: { value: LightDeep | null; compact?: boolean }) {
  if (!value) return null;
  return (
    <dl className={`light-deep ${compact ? 'compact' : ''}`}>
      {LIGHT_DEEP_LINES.filter((l) => value[l.key]).map((l) => (
        <div key={l.key} className="ld-row">
          <dt title={l.label}>{compact ? l.short : l.label}</dt>
          <dd>{value[l.key]}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------- MEMO

/** Memo・気づき・観察をすばやく DIARY へ。#タグ で分類、Ctrl+Enter で保存 */
export function QuickMemo({ title = 'MEMO・気づき', compact = false, onSaved }: { title?: string; compact?: boolean; onSaved?: (e: DiaryEntry) => void }) {
  const [text, setText] = useState('');
  const [type, setType] = useState<EntryType>('MEMO');

  const save = () => {
    const body = text.trim();
    if (!body) {
      toast('ひとことでいいので書いてください');
      return;
    }
    const url = body.match(/https?:\/\/[^\s　]+/)?.[0];
    const e = addMemo({ body, type, url });
    setText('');
    markActive();
    toast(`DIARY に入れました（${entryTypeLabel(type).ja}）`);
    onSaved?.(e);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save();
    }
  };

  return (
    <section className={`panel panel-pad quick-memo ${compact ? 'compact' : ''}`} aria-label={title}>
      <div className="panel-head">
        <span className="panel-title">
          <Icon name="pen" size={17} /> {title}
        </span>
        <a className="pill-link" href={href('/diary')}>
          DIARY
        </a>
      </div>
      <textarea
        className="note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        placeholder="見たこと・引っかかったこと・思いつき。#タグ も書けます"
        aria-label="メモの本文"
      />
      <div className="row quick-types" role="radiogroup" aria-label="種類">
        {QUICK_TYPES.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={type === t} className={`tag ${type === t ? 'on' : ''}`} onClick={() => setType(t)}>
            {entryTypeLabel(t).ja}
          </button>
        ))}
        <button type="button" className="btn sm primary" style={{ marginLeft: 'auto' }} onClick={save}>
          <Icon name="plus" size={14} /> DIARY に入れる
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- ENGINE

/** 思考エンジンを借りる（選んだときだけ）。複数選べる。「なし」も選べる */
export function EnginePicker({ selected, onChange, target }: { selected: string[]; onChange: (ids: string[]) => void; target?: { title: string; text: string } }) {
  const questions = mixQuestions(selected);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 6 }}>
        {ENGINES.map((e) => {
          const on = selected.includes(e.id);
          return (
            <button key={e.id} type="button" className={`tag engine-tag ${on ? 'on' : ''}`} aria-pressed={on} title={e.shortDescription} onClick={() => onChange(toggleEngine(selected, e.id))}>
              {on && <Icon name="check" size={12} />}
              {e.name}
              <span className="muted">{e.shortDescription}</span>
            </button>
          );
        })}
      </div>
      {selected.includes(NONE_ENGINE_ID) && <p className="small muted">エンジンは借りません。自分の感覚のまま進みます。</p>}
      {questions.length > 0 && (
        <>
          <ol className="engine-questions">
            {questions.map(({ engine, question }) => (
              <li key={`${engine.id}-${question}`}>
                <span className="engine-name">{engine.name}</span>
                {question}
              </li>
            ))}
          </ol>
          <div className="row">
            <span className="small muted">答えはメモへ。AI に結論は出させません。</span>
            {target && (
              <button type="button" className="btn sm" onClick={() => void copyText(engineChatPrompt(selected, target), 'AIチャット用の相談文をコピーしました（自動では送りません）')}>
                <Icon name="copy" size={13} /> AIチャット用にコピー
              </button>
            )}
            <a className="pill-link" href={href('/engines')}>
              ENGINES とは
            </a>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- CORE LOCK

export function CoreLockEditor({ value, onChange }: { value: CoreLock | undefined; onChange: (next: CoreLock) => void }) {
  const v = { ...emptyCoreLock(), ...(value ?? {}) };
  return (
    <div className="core-lock">
      {CORE_LOCK_QUESTIONS.map((q) => (
        <label key={q.key} className="core-lock-field">
          <span className="q">{q.question}</span>
          <span className="small muted">{q.hint}</span>
          <textarea className="note" value={v[q.key]} onChange={(e) => onChange({ ...v, [q.key]: e.target.value, updatedAt: new Date().toISOString() })} aria-label={q.question} />
        </label>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- MEDIA

export function MediaPicker({ selected, onChange }: { selected: MediumId[]; onChange: (next: MediumId[]) => void }) {
  return (
    <div className="row" style={{ gap: 6 }} role="group" aria-label="出力先のメディア">
      {MEDIA.map((m) => {
        const on = selected.includes(m.id);
        return (
          <button key={m.id} type="button" className={`tag ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onChange(on ? selected.filter((x) => x !== m.id) : [...selected, m.id])}>
            {on && <Icon name="check" size={12} />}
            {m.ja}
          </button>
        );
      })}
    </div>
  );
}
