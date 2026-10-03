import { useEffect } from 'react';
import { AiBox, CategoryChip, ErrorBox, ExternalLink, FactBox, FailedNotice, Loading } from '../components/common.tsx';
import { Icon } from '../components/Icon.tsx';
import { onToggleSave } from '../components/ItemCard.tsx';
import { Thumb } from '../components/Thumb.tsx';
import { loadItem, useAsync } from '../data/api.ts';
import { markActive } from '../data/heartbeat.ts';
import { usePersonal } from '../data/store.ts';
import { paragraphs } from '../lib/text.ts';
import { href } from '../router.ts';
import { STORY_STAGES } from '../shared/questions.ts';
import { formatDotDate, formatJaDate } from '../shared/time.ts';

export function ReadView({ id }: { id: string | null }) {
  const item = useAsync(() => (id ? loadItem(id) : Promise.reject(new Error('記事が指定されていません'))), [id]);
  const personal = usePersonal();

  // 「DAILYの記事を開く」は有効な反応として扱う
  useEffect(() => {
    if (id) markActive();
  }, [id]);

  if (item.loading && !item.data) return <Loading />;
  if (item.error || !item.data) return <ErrorBox message={item.error ?? '読み込めませんでした'} />;

  const it = item.data;
  const saved = personal.diary.some((d) => d.id === it.id);
  const paras = paragraphs(it.story);
  const staged = paras.length === STORY_STAGES.length;

  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 12 }}>
        <a className="btn sm ghost" href={href('/daily', { date: undefined })}>
          <Icon name="arrowLeft" size={15} /> DAILY に戻る
        </a>
      </div>
      <div className="read-layout">
        <article className="panel article">
          <div className="row">
            <CategoryChip category={it.category} full />
            <span className="small muted">{formatJaDate(it.date)}</span>
            {it.sample && <span className="tag">サンプル</span>}
          </div>
          <h1>{it.title}</h1>
          {it.analysisFailed && (
            <div style={{ margin: '-6px 0 16px' }}>
              <FailedNotice reason={it.failReason}>元の記事を読むか、DEEP で自分の言葉で分解できます。</FailedNotice>
            </div>
          )}
          <Thumb className="wide" category={it.category} seed={it.id} image={it.image} />
          <p className="lead" style={{ marginTop: 20 }}>
            {it.hook}
          </p>

          {paras.length > 0 ? (
            paras.map((p, i) => (
              <section className="story-stage" key={i}>
                {staged && <span className="stage">{STORY_STAGES[i]}</span>}
                <p>{p}</p>
              </section>
            ))
          ) : (
            <p className="muted">ストーリーはまだありません。DEEP で自分の言葉で分解してみましょう。</p>
          )}

          <div className="split-box">
            <FactBox
              source={
                <>
                  出典：<ExternalLink href={it.sourceUrl}>{it.sourceTitle || it.sourceUrl}</ExternalLink>
                  {it.sourceName ? `（${it.sourceName}${it.sourceDate ? `・${formatDotDate(it.sourceDate)}` : ''}）` : ''}
                </>
              }
            >
              {it.observation || '（事実の記述はまだありません）'}
            </FactBox>
            {(it.why || it.principleCandidate) && (
              <AiBox>
                {it.why && <p style={{ marginBottom: 8 }}>{it.why}</p>}
                {it.principleCandidate && (
                  <p>
                    <strong>原理候補：</strong>
                    {it.principleCandidate}
                  </p>
                )}
              </AiBox>
            )}
          </div>
        </article>

        <aside className="stack">
          <section className="panel panel-pad stack" style={{ gap: 12 }}>
            <a className="btn primary lg" href={href('/deep', { id: it.id })}>
              <Icon name="search" size={18} /> DEEP で掘る
            </a>
            <button type="button" className={`btn lg ${saved ? 'saved' : ''}`} onClick={() => onToggleSave(it)}>
              <Icon name={saved ? 'bookmarkFill' : 'bookmark'} size={18} /> {saved ? 'DIARY に保存済み' : 'DIARY に保存'}
            </button>
            {/^https?:\/\//.test(it.sourceUrl) && (
              <a className="btn" href={it.sourceUrl} target="_blank" rel="noopener noreferrer">
                <Icon name="external" size={16} /> 元の情報源を開く
              </a>
            )}
          </section>
          {it.minimumStructure && (
            <section className="panel panel-pad">
              <div className="q-label">MINIMUM STRUCTURE</div>
              <p style={{ fontWeight: 700, marginTop: 6, lineHeight: 1.7 }}>{it.minimumStructure}</p>
            </section>
          )}
          {it.transferIdeas.length > 0 && (
            <section className="panel panel-pad">
              <div className="q-label">これ、他にも使えるのでは？</div>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.8, fontSize: 14 }}>
                {it.transferIdeas.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          )}
          {(it.tags ?? []).length > 0 && (
            <div className="row">
              {(it.tags ?? []).map((t) => (
                <a key={t} className="tag" href={href('/search', { q: t })}>
                  #{t}
                </a>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
