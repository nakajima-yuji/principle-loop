// LIGHT DEEP：AI の3行で止め、人間が選ぶ画面（/deep?id=...）。
// 深掘り（FULL DEEP・7つの質問）は「↓深掘り」を選んだときだけ（/deep?id=...&mode=full）。

import { useState } from 'react';
import { CategoryChip, ExternalLink, FailedNotice, StateSelect } from '../components/common.tsx';
import { Icon } from '../components/Icon.tsx';
import { CoreLockEditor, DecisionBadge, DecisionBar, EnginePicker, LightDeepLines, MediaPicker, TypeChip } from '../components/loop.tsx';
import { Thumb } from '../components/Thumb.tsx';
import { ensureEntry, updateDiary, usePersonal } from '../data/store.ts';
import { href } from '../router.ts';
import { LIGHT_DEEP_LINES, getLightDeep } from '../shared/light-deep.ts';
import { coreLockFilled } from '../shared/loop.ts';
import { formatDotDate } from '../shared/time.ts';
import type { DailyItem, DiaryEntry, LightDeep } from '../shared/types.ts';

export function LightDeepWorkspace({ item }: { item: DailyItem }) {
  const personal = usePersonal();
  const entry = personal.diary.find((d) => d.id === item.id);
  const isDaily = !entry || entry.type === 'DAILY' || entry.kind === 'manual';
  const ai = getLightDeep(item);
  const mine = entry?.lightDeep;
  const shown = getLightDeep(item, mine);
  const hasAi = Boolean(ai);
  const [editing, setEditing] = useState(!hasAi);

  // 書き始めたら DIARY に入れる（判断は未選択のまま）
  const patch = (p: Partial<DiaryEntry>) => updateDiary(ensureEntry(item).id, p);
  const setLine = (k: keyof LightDeep, v: string) => patch({ lightDeep: { odd: '', structure: '', transfer: '', ...(mine ?? {}), [k]: v } });

  const body = entry && entry.type !== 'DAILY' && entry.body ? entry.body : item.hook;

  return (
    <div className="page light-page">
      <div className="row" style={{ marginBottom: 12 }}>
        <a className="btn sm ghost" href={isDaily ? href('/daily') : href('/diary', { id: item.id })}>
          <Icon name="arrowLeft" size={15} /> {isDaily ? 'DAILY に戻る' : 'DIARY に戻る'}
        </a>
      </div>

      <section className="panel deep-hero">
        <Thumb category={item.category} seed={item.id} image={item.image} />
        <div>
          <div className="row">
            <span className="page-kicker" style={{ margin: 0 }}>
              LIGHT DEEP
            </span>
            {entry && entry.type !== 'DAILY' ? <TypeChip type={entry.type} /> : <CategoryChip category={item.category} full />}
            {entry && <DecisionBadge decision={entry.userDecision} />}
          </div>
          <h1>{item.title}</h1>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-line' }}>
            {body}
          </p>
          <p className="small" style={{ marginTop: 8 }}>
            {/^https?:\/\//.test(item.sourceUrl) && <ExternalLink href={item.sourceUrl}>{item.sourceName || item.sourceTitle || '情報源'}</ExternalLink>}
            {item.sourceDate && (
              <span className="muted" style={{ marginLeft: 10 }}>
                {formatDotDate(item.sourceDate)}
              </span>
            )}
            {(item.story || item.observation) && item.aiProvider !== 'memo' && (
              <a style={{ marginLeft: 12 }} href={href('/read', { id: item.id })}>
                事実と全文を読む
              </a>
            )}
          </p>
        </div>
      </section>

      {item.analysisFailed && (
        <div style={{ marginTop: 14 }}>
          <FailedNotice reason={item.failReason}>AI の3行はありません。気になったら、自分で3行書いてみてください。</FailedNotice>
        </div>
      )}

      <div className="light-layout">
        <div className="stack">
          <section className="panel panel-pad stack" style={{ gap: 12 }} aria-label="LIGHT DEEP の3行">
            <div className="panel-head" style={{ marginBottom: 0 }}>
              <span className="panel-title">
                <Icon name="spark" size={18} /> 3行だけ
              </span>
              <button type="button" className="pill-link" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
                <Icon name="pen" size={12} /> {editing ? '閉じる' : '自分の言葉で書く'}
              </button>
            </div>
            {shown ? <LightDeepLines value={shown} /> : <div className="empty">まだ3行がありません。</div>}
            <p className="small muted">
              {hasAi ? 'AI はここで止まっています（結論は出しません）。' : ''}
              {mine && Object.values(mine).some((v) => v.trim()) ? '自分の言葉で書いた行を優先して表示しています。' : ''}
            </p>
            {editing && (
              <div className="stack" style={{ gap: 8 }}>
                {LIGHT_DEEP_LINES.map((l) => (
                  <label key={l.key} className="ld-edit">
                    <span className="field-label">{l.label}</span>
                    <input
                      className="text"
                      value={mine?.[l.key] ?? ''}
                      placeholder={ai?.[l.key] || '1行で'}
                      onChange={(e) => setLine(l.key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="panel panel-pad stack" style={{ gap: 10 }} aria-label="HUMAN SELECT">
            <div className="panel-title">
              <Icon name="star" size={18} /> どうする？ <span className="muted">決めるのはあなた</span>
            </div>
            <DecisionBar item={item} current={entry?.userDecision} />
            <p className="small muted">↓深掘り は FULL DEEP（7つの質問）へ、→試す は EXPERIMENT（小さく試す）へ進みます。</p>
          </section>

          <details className="panel panel-pad fold-panel" open={Boolean(entry?.engineIds.length)}>
            <summary>
              <Icon name="layers" size={17} /> 思考エンジンを借りる <span className="muted">任意・選んだときだけ</span>
            </summary>
            <EnginePicker selected={entry?.engineIds ?? []} onChange={(engineIds) => patch({ engineIds })} target={{ title: item.title, text: [body, shown ? LIGHT_DEEP_LINES.map((l) => `${l.short}：${shown[l.key]}`).join('\n') : ''].filter(Boolean).join('\n') }} />
          </details>

          <details className="panel panel-pad fold-panel" open={coreLockFilled(entry?.coreLock)}>
            <summary>
              <Icon name="lock" size={17} /> CORE LOCK <span className="muted">守るものを決めて、大胆に壊す</span>
            </summary>
            <CoreLockEditor value={entry?.coreLock} onChange={(coreLock) => patch({ coreLock })} />
          </details>

          <details className="panel panel-pad fold-panel" open={Boolean(entry?.media.length)}>
            <summary>
              <Icon name="cube" size={17} /> どこへ出せそう？ <span className="muted">ゲームだけじゃない</span>
            </summary>
            <MediaPicker selected={entry?.media ?? []} onChange={(media) => patch({ media })} />
          </details>
        </div>

        <aside className="stack">
          <section className="panel panel-pad stack" style={{ gap: 10 }}>
            <label className="field-label" htmlFor="ld-memo" style={{ marginBottom: 0 }}>
              ひとことメモ
            </label>
            <textarea id="ld-memo" className="note" value={entry?.memo ?? ''} onChange={(e) => patch({ memo: e.target.value })} placeholder="引っかかったこと・思い出したこと" />
            {entry && (
              <>
                <span className="field-label" style={{ marginBottom: 0 }}>
                  段階（AI は上げません）
                </span>
                <StateSelect value={entry.state} onChange={(state) => patch({ state })} />
              </>
            )}
          </section>
          <section className="panel panel-pad stack" style={{ gap: 10 }}>
            <a className="btn" href={href('/deep', { id: item.id, mode: 'full' })}>
              <Icon name="search" size={16} /> FULL DEEP（7つの質問）
            </a>
            <a className="btn" href={href('/connect', { a: item.id })}>
              <Icon name="connect" size={16} /> CONNECT でぶつける
            </a>
            <a className="btn" href={href('/experiment', { from: 'item', id: item.id })}>
              <Icon name="flask" size={16} /> EXPERIMENT で小さく試す
            </a>
            {entry && (
              <a className="btn ghost" href={href('/diary', { id: entry.id })}>
                <Icon name="book" size={16} /> DIARY で見る
              </a>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
