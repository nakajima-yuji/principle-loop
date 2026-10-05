// 3行DEEP（少しだけ照らす）と、DIARY の情報源（SOURCE / TYPE）の表示部品。

import { useState, type ClipboardEvent, type ReactNode } from 'react';
import { copyText } from '../data/toast.ts';
import { isNoteItem, sourceLabel, SOURCES, type NoteSource } from '../lib/note.ts';
import { hasLightDeep, LIGHT_DEEP_LINES, lightDeepPrompt, parseLightDeep, type LightDeepKey } from '../shared/deep.ts';
import type { DailyItem, DiarySource, LightDeep } from '../shared/types.ts';
import { Icon } from './Icon.tsx';
import { Thumb } from './Thumb.tsx';

export function SourceBadge({ source }: { source: DiarySource }) {
  return (
    <span className="source-badge" data-source={source} title={SOURCES.find((s) => s.id === source)?.description}>
      {sourceLabel(source)}
    </span>
  );
}

/** Memo / 気づきのサムネイル（写真の代わりにアイコン） */
export function NoteThumb({ source }: { source: NoteSource }) {
  return (
    <div className="thumb note-thumb" data-source={source} aria-hidden="true">
      <Icon name={source === 'memo' ? 'pen' : 'spark'} size={22} />
    </div>
  );
}

/** DAILY は分野の図形・写真、Memo / 気づきはアイコン */
export function ItemThumb({ item }: { item: DailyItem }) {
  if (isNoteItem(item)) return <NoteThumb source={item.aiProvider === 'insight' ? 'insight' : 'memo'} />;
  return <Thumb category={item.category} seed={item.id} image={item.image} />;
}

const ORIGIN: Record<NonNullable<LightDeep['by']>, string> = {
  ai: 'AI の3行（仮説）',
  user: '自分の3行',
  derived: '既存の分析から抜き出し',
};

export function LightDeepLines({ deep, compact = false }: { deep: LightDeep; compact?: boolean }) {
  return (
    <ul className={`light-deep ${compact ? 'compact' : ''}`}>
      {LIGHT_DEEP_LINES.filter(({ key }) => deep[key].trim()).map(({ key, label }) => (
        <li key={key}>
          <span className="ld-q">{label}</span>
          <span className="ld-arrow" aria-hidden="true">
            →
          </span>
          <span className="ld-a">{deep[key]}</span>
        </li>
      ))}
    </ul>
  );
}

type Draft = Record<LightDeepKey, string>;
const toDraft = (d: LightDeep | null): Draft => ({ why: d?.why ?? '', principle: d?.principle ?? '', next: d?.next ?? '' });

/**
 * 3行DEEP のカード。答えを完成させず、「もう少し調べたい」と思えるかを判断するためのもの。
 * editable なら自分で書ける（AI チャットの返答を 1 つの欄に貼ると 3 行に分けて入る）。
 */
export function LightDeepCard({
  deep,
  editable = false,
  onSave,
  canClear = false,
  promptText,
  promptKind = 'メモ',
  footer,
  emptyText = '3行DEEP はまだありません。',
}: {
  deep: LightDeep | null;
  editable?: boolean;
  onSave?: (d: LightDeep | undefined) => void;
  /** 自分の 3 行を消せる（消すと AI の 3 行に戻る） */
  canClear?: boolean;
  /** AI チャットに頼む文面に入れる本文（無ければコピーのボタンを出さない） */
  promptText?: string;
  promptKind?: string;
  footer?: ReactNode;
  emptyText?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(deep));
  const shown = hasLightDeep(deep) ? deep : null;

  const start = () => {
    setDraft(toDraft(shown));
    setEditing(true);
  };
  const save = () => {
    const d = { why: draft.why.trim(), principle: draft.principle.trim(), next: draft.next.trim() };
    onSave?.(d.why || d.principle || d.next ? d : undefined);
    setEditing(false);
  };
  // 「・なぜ気になった？ → …」の 3 行をまとめて貼ったら、3 つの欄に分ける
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const parsed = parseLightDeep(e.clipboardData.getData('text'));
    if (parsed && [parsed.why, parsed.principle, parsed.next].filter(Boolean).length >= 2) {
      e.preventDefault();
      setDraft(toDraft(parsed));
    }
  };
  const copyPrompt = promptText?.trim()
    ? () => void copyText(lightDeepPrompt(promptText, promptKind), 'AI チャットに頼む文面をコピーしました（返ってきた3行は、欄に貼れば分けて入ります）')
    : undefined;

  return (
    <section className="panel panel-pad light-deep-card" aria-label="3行DEEP">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="row" style={{ gap: 8 }}>
          <span className="q-label">DEEP</span>
          <span className="small muted">3行で少しだけ照らす</span>
          {shown?.by && !editing && <span className="ld-origin" data-by={shown.by}>{ORIGIN[shown.by]}</span>}
        </span>
        {editable && !editing && (
          <button type="button" className="btn sm ghost" onClick={start}>
            <Icon name="pen" size={14} /> {shown ? '直す' : '書く'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="stack" style={{ gap: 8, marginTop: 10 }}>
          {LIGHT_DEEP_LINES.map(({ key, label, hint }) => (
            <label key={key} className="ld-field">
              <span className="ld-q">{label}</span>
              <input className="text" value={draft[key]} placeholder={hint} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} onPaste={onPaste} />
            </label>
          ))}
          <div className="row">
            <button type="button" className="btn sm primary" onClick={save}>
              <Icon name="check" size={14} /> 保存
            </button>
            <button type="button" className="btn sm ghost" onClick={() => setEditing(false)}>
              やめる
            </button>
            {copyPrompt && (
              <button type="button" className="btn sm" onClick={copyPrompt}>
                <Icon name="copy" size={14} /> AI に頼む文面をコピー
              </button>
            )}
            {canClear && (
              <button
                type="button"
                className="btn sm ghost danger"
                style={{ marginLeft: 'auto' }}
                onClick={() => {
                  onSave?.(undefined);
                  setEditing(false);
                }}
              >
                自分の3行を消す
              </button>
            )}
          </div>
          <p className="small muted">各行は短く。結論を決めず、原理候補は1つだけ。AI チャットの返答（3行）は、どれか1つの欄に貼れば分けて入ります。</p>
        </div>
      ) : shown ? (
        <LightDeepLines deep={shown} />
      ) : (
        <div className="ld-empty">
          <span className="small muted">{emptyText}</span>
          {!editable && copyPrompt && (
            <button type="button" className="btn sm" onClick={copyPrompt}>
              <Icon name="copy" size={14} /> AI に頼む文面をコピー
            </button>
          )}
        </div>
      )}

      {footer && !editing && <div className="ld-footer">{footer}</div>}
    </section>
  );
}
