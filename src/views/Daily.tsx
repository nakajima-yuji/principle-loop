import { useMemo, useState } from 'react';
import { CategoryChip, ErrorBox, Loading, Notice } from '../components/common.tsx';
import { Icon } from '../components/Icon.tsx';
import { ItemCard } from '../components/ItemCard.tsx';
import { EntryKindChip, EntryThumb, LightDeepLines, QuickMemo } from '../components/loop.tsx';
import { Thumb } from '../components/Thumb.tsx';
import { loadArchive, loadDaily, useAsync } from '../data/api.ts';
import { useServerActivity } from '../data/server-activity.ts';
import { usePersonal } from '../data/store.ts';
import { chronological } from '../lib/diary-model.ts';
import { href } from '../router.ts';
import { daysUntilPause } from '../shared/activity.ts';
import { FAILED_LABEL, isAnalysisFailed } from '../shared/item-status.ts';
import { getLightDeep } from '../shared/light-deep.ts';
import { SELECTION_CRITERIA } from '../shared/questions.ts';
import { formatDotDate, formatJaDate, isSundayJst, jstDateString } from '../shared/time.ts';
import type { ArchiveIndex, DailyFile, UserDecision } from '../shared/types.ts';

async function loadPage(date: string | null): Promise<{ index: ArchiveIndex; daily: DailyFile }> {
  const index = await loadArchive();
  const target = date ?? index.days[0]?.date;
  if (!target) throw new Error('まだ DAILY がありません。夜間処理が動くと、ここに今日の7つの原理が並びます。');
  return { index, daily: await loadDaily(target) };
}

export function DailyView({ date }: { date: string | null }) {
  const page = useAsync(() => loadPage(date), [date]);
  const personal = usePersonal();
  const decisions = useMemo(() => new Map<string, UserDecision>(personal.diary.map((d) => [d.id, d.userDecision])), [personal.diary]);
  const interesting = useMemo(() => chronological(personal.diary.filter((d) => d.userDecision === 'INTERESTING')).slice(0, 5), [personal.diary]);
  const server = useServerActivity();
  const [showCriteria, setShowCriteria] = useState(false);

  if (page.loading && !page.data) return <Loading />;
  if (page.error || !page.data) return <ErrorBox message={page.error ?? '読み込めませんでした'} />;

  const { index, daily } = page.data;
  const now = new Date();
  const today = jstDateString(now);
  const latest = index.days[0]?.date;
  const isLatest = daily.date === latest;
  const titleText = daily.date === today ? '今日の7つの観察' : isLatest ? '最新の7つの観察' : `${formatJaDate(daily.date).replace(/（.）$/, '')}の観察`;
  const potdCandidate = daily.items.find((i) => i.id === daily.principleOfTheDay) ?? daily.items[0];
  const potd = potdCandidate && !isAnalysisFailed(potdCandidate) ? potdCandidate : undefined;
  const failedCount = daily.items.filter(isAnalysisFailed).length;
  const paused = server.activity?.paused === true;
  const dayIdx = index.days.findIndex((d) => d.date === daily.date);
  const prevDay = dayIdx >= 0 ? index.days[dayIdx + 1]?.date : undefined;
  const nextDay = dayIdx > 0 ? index.days[dayIdx - 1]?.date : undefined;

  return (
    <div className="page stack">
      {paused && (
        <Notice
          kind="paused"
          icon="pause"
          action={
            <a className="btn sm primary" href={href('/activity')}>
              <Icon name="play" size={14} /> 再開する
            </a>
          }
        >
          <strong>PRINCIPLE LOOP PAUSED</strong> — 10日間反応がなかったため、夜間の収集・AI生成・朝のメールを止めています。
        </Notice>
      )}
      {daily.sample && (
        <Notice icon="info">
          これは<strong>サンプル</strong>です（実在する研究・事例をもとに作成）。自動収集を設定すると、月〜土の朝にここが新しい7つの原理に入れ替わります。
          <a href={href('/settings')}> 設定方法</a>
        </Notice>
      )}
      {daily.provider === 'mock' && (
        <Notice kind="warn" icon="info">
          AI の設定がまだのため、分析は<strong>仮のテンプレート</strong>です。AI_API_KEY を設定すると本来の分析に変わります（README 参照）。
        </Notice>
      )}
      {failedCount > 0 && (
        <Notice kind="warn" icon="info">
          この日の {daily.items.length} 件のうち <strong>{failedCount} 件は「{FAILED_LABEL}」</strong>です（AI の分析を作れませんでした）。
          深夜の処理で失敗した場合は、03:10 にもう一度作り直しを試します。作成中止の記事も、元の記事を読んだり自分で掘ったりできます。
        </Notice>
      )}
      {isSundayJst(now) && isLatest && !paused && (
        <Notice icon="clock">日曜日はお休みです（収集・AI・メールすべて停止）。月曜の朝に再開します。</Notice>
      )}

      <div className="daily-layout">
        <section className="panel daily-main" aria-labelledby="daily-title">
          <div className="daily-head">
            <div>
              <div className="daily-title">
                <h1 id="daily-title">{titleText}</h1>
                <span className="daily-date">{formatJaDate(daily.date)}</span>
              </div>
              <p className="page-sub">世界で見つけた妙なもの。AI は3行で止めています。面白いかどうかは、あなたが選んでください。</p>
            </div>
            <div className="criteria-wrap">
              <button type="button" className="btn sm ghost" onClick={() => setShowCriteria((v) => !v)} aria-expanded={showCriteria}>
                <Icon name="info" size={16} /> 今日の選定基準
              </button>
              {showCriteria && (
                <div className="popover" role="dialog" aria-label="選定基準">
                  <strong>ニュース価値ではなく、原理としての価値で選んでいます。</strong>
                  <ul>
                    {SELECTION_CRITERIA.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <p className="small muted" style={{ marginTop: 8 }}>
                    6つの分野から1件ずつ＋「異物」（普段は検索しない世界）から1件。興味に近いものと未知の領域をおよそ 3：1 で混ぜています。
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="cards">
            {daily.items.map((item, i) => (
              <ItemCard
                key={item.id}
                item={item}
                index={i + 1}
                compact={i >= 4}
                highlight={item.id === potd?.id}
                decision={decisions.get(item.id)}
              />
            ))}
          </div>

          <div className="archive-strip" aria-label="過去の観察">
            <span className="small muted">過去の観察</span>
            {prevDay && (
              <a className="btn sm" href={href('/daily', { date: prevDay })}>
                <Icon name="arrowLeft" size={14} /> 前の日
              </a>
            )}
            {index.days.slice(0, 8).map((d) => (
              <a
                key={d.date}
                className={`tag ${d.date === daily.date ? 'on' : ''}`}
                href={href('/daily', { date: d.date === latest ? undefined : d.date })}
              >
                {formatDotDate(d.date).slice(5)}
              </a>
            ))}
            {nextDay && (
              <a className="btn sm" href={href('/daily', { date: nextDay === latest ? undefined : nextDay })}>
                次の日 <Icon name="arrowRight" size={14} />
              </a>
            )}
            <span className="small muted" style={{ marginLeft: 'auto' }}>
              全 {index.days.length} 日 / 検索で過去の分も探せます
            </span>
          </div>
        </section>

        <aside className="aside">
          <QuickMemo />

          <section className="panel panel-pad" aria-label="最近の INTERESTING">
            <div className="panel-head">
              <span className="panel-title">
                <Icon name="star" size={17} /> INTERESTING <span className="muted">面白い</span>
              </span>
              <a className="pill-link" href={href('/diary', { decision: 'INTERESTING' })}>
                すべて
              </a>
            </div>
            {interesting.length === 0 ? (
              <div className="empty">カードの「☆ 面白い」を押すと、ここに並びます。</div>
            ) : (
              <ul className="mini-list">
                {interesting.map((d) => (
                  <li key={d.id}>
                    <a href={href('/diary', { id: d.id, decision: 'INTERESTING' })}>
                      <EntryThumb entry={d} />
                      <span>
                        <span className="t">{d.item.title}</span>
                        <span className="d">
                          <EntryKindChip entry={d} /> {formatDotDate(d.createdAt.slice(0, 10))}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {potd && (
            <section className="panel potd" aria-label="PRINCIPLE OF THE DAY">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="potd-label">
                  <Icon name="crown" size={18} /> PRINCIPLE <span style={{ color: 'var(--blue)' }}>OF THE DAY</span>
                </span>
                <CategoryChip category={potd.category} />
              </div>
              <div className="potd-body">
                <Thumb category={potd.category} seed={potd.id} image={potd.image} />
                <div>
                  <a className="potd-principle" href={href('/deep', { id: potd.id })}>
                    {potd.title}
                  </a>
                  <LightDeepLines value={getLightDeep(potd)} compact />
                </div>
              </div>
              <p className="small muted" style={{ marginTop: 10 }}>
                ニュースとして一番大きいものではなく、他の分野へ飛ばしやすそうなものを1つ選んでいます（AI の見立て。決めるのはあなた）。
              </p>
            </section>
          )}

          <ScheduleLine paused={paused} remaining={server.activity ? daysUntilPause(server.activity, new Date()) : null} />
        </aside>
      </div>
    </div>
  );
}

function ScheduleLine({ paused, remaining }: { paused: boolean; remaining: number | null }) {
  const sunday = isSundayJst(new Date());
  return (
    <section className="panel panel-pad schedule-line" aria-label="自動収集・配信">
      <span className={`status-pill ${paused ? 'paused' : sunday ? 'rest' : ''}`}>{paused ? '一時停止中' : sunday ? '日曜は休み' : '稼働中'}</span>
      <span className="small muted">
        月〜土 0:30 収集 → 7:00 メール。10日反応がなければ自動で一時停止
        {remaining !== null && !paused ? `（あと ${remaining} 日）` : ''}
      </span>
      <a className="pill-link" href={href('/activity')}>
        <Icon name="gear" size={13} /> 状況
      </a>
    </section>
  );
}
