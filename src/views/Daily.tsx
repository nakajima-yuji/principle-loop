import { useMemo, useState } from 'react';
import { CategoryChip, ErrorBox, Loading, Notice } from '../components/common.tsx';
import { Icon } from '../components/Icon.tsx';
import { ItemCard } from '../components/ItemCard.tsx';
import { Thumb } from '../components/Thumb.tsx';
import { loadArchive, loadDaily, useAsync } from '../data/api.ts';
import { useServerActivity } from '../data/server-activity.ts';
import { usePersonal } from '../data/store.ts';
import { href } from '../router.ts';
import { daysUntilPause } from '../shared/activity.ts';
import { CORE_QUESTIONS, SELECTION_CRITERIA } from '../shared/questions.ts';
import { formatDotDate, formatJaDate, isSundayJst, jstDateString } from '../shared/time.ts';
import type { ArchiveIndex, DailyFile } from '../shared/types.ts';

async function loadPage(date: string | null): Promise<{ index: ArchiveIndex; daily: DailyFile }> {
  const index = await loadArchive();
  const target = date ?? index.days[0]?.date;
  if (!target) throw new Error('まだ DAILY がありません。夜間処理が動くと、ここに今日の7つの原理が並びます。');
  return { index, daily: await loadDaily(target) };
}

export function DailyView({ date }: { date: string | null }) {
  const page = useAsync(() => loadPage(date), [date]);
  const personal = usePersonal();
  const savedIds = useMemo(() => new Set(personal.diary.map((d) => d.id)), [personal.diary]);
  const server = useServerActivity();
  const [showCriteria, setShowCriteria] = useState(false);

  if (page.loading && !page.data) return <Loading />;
  if (page.error || !page.data) return <ErrorBox message={page.error ?? '読み込めませんでした'} />;

  const { index, daily } = page.data;
  const now = new Date();
  const today = jstDateString(now);
  const latest = index.days[0]?.date;
  const isLatest = daily.date === latest;
  const titleText = daily.date === today ? '今日の7つの原理' : isLatest ? '最新の7つの原理' : `${formatJaDate(daily.date).replace(/（.）$/, '')}の原理`;
  const potd = daily.items.find((i) => i.id === daily.principleOfTheDay) ?? daily.items[0];
  const paused = server.activity?.paused === true;
  const recentDiary = personal.diary.slice(0, 3);
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
              <p className="page-sub">世界で起きた出来事から、応用可能な「原理」を厳選しました。</p>
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
                saved={savedIds.has(item.id)}
              />
            ))}
          </div>

          <div className="archive-strip" aria-label="過去の原理">
            <span className="small muted">過去の原理</span>
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
              全 {index.days.length} 日 / 検索で過去の原理も探せます
            </span>
          </div>
        </section>

        <aside className="aside">
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
                  <p className="potd-principle">{potd.principleCandidate}</p>
                  <p className="potd-from">{potd.minimumStructure}</p>
                </div>
              </div>
              <p className="small muted" style={{ marginTop: 10 }}>
                ニュースとして一番大きいものではなく、他の分野へ飛ばしやすい原理候補を選んでいます。
              </p>
            </section>
          )}

          <section className="panel panel-pad worksheet" aria-label="DEEP 分析ワークシート">
            <div className="panel-head">
              <span className="panel-title">
                <Icon name="link" size={18} /> DEEP 分析ワークシート
              </span>
              {potd && (
                <a className="pill-link" href={href('/deep', { id: potd.id })}>
                  深く掘る <Icon name="arrowRight" size={13} />
                </a>
              )}
            </div>
            <ol>
              {CORE_QUESTIONS.map((q) => (
                <li key={q.key}>
                  <span className="mini-num">{q.no}</span>
                  <span>
                    <span className="q">{q.question}</span>
                    <br />
                    <span className="h">{q.hint}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <ScheduleCard paused={paused} remaining={server.activity ? daysUntilPause(server.activity, new Date()) : null} />

          <div className="aside-split">
            <section className="panel panel-pad" aria-label="最近保存した原理">
              <div className="panel-head">
                <span className="panel-title">
                  <Icon name="bookmark" size={17} /> DIARY <span className="muted">最近の保存</span>
                </span>
                <a className="pill-link" href={href('/diary')}>
                  すべて見る
                </a>
              </div>
              {recentDiary.length === 0 ? (
                <div className="empty">気になった原理を「保存」すると、ここに並びます。</div>
              ) : (
                <ul className="mini-list">
                  {recentDiary.map((d) => (
                    <li key={d.id}>
                      <a href={href('/diary', { id: d.id })}>
                        <Thumb category={d.item.category} seed={d.item.id} image={d.item.image} />
                        <span>
                          <span className="t">{d.item.title}</span>
                          <span className="d">{formatDotDate(d.createdAt.slice(0, 10))}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel panel-pad" aria-label="BUILD 実験してみる">
              <div className="panel-head">
                <span className="panel-title">
                  <Icon name="cube" size={17} /> BUILD <span className="muted">実験してみる</span>
                </span>
              </div>
              <a className="build-link" href={href('/build', { from: 'item', id: potd?.id })}>
                <span className="ic" style={{ background: '#0e1d3a' }}>
                  <Icon name="terminal" size={18} />
                </span>
                <span>
                  <span className="t">Codex 用プロンプト</span>
                  <br />
                  <span className="d">実験を設計してから書き出す</span>
                </span>
              </a>
              <a className="build-link" href={href('/build', { from: 'item', id: potd?.id })}>
                <span className="ic" style={{ background: '#d97757' }}>
                  <Icon name="spark" size={18} />
                </span>
                <span>
                  <span className="t">Claude Code 用プロンプト</span>
                  <br />
                  <span className="d">自動実行はしません</span>
                </span>
              </a>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ScheduleCard({ paused, remaining }: { paused: boolean; remaining: number | null }) {
  const sunday = isSundayJst(new Date());
  return (
    <section className="panel panel-pad" aria-label="自動収集・配信">
      <div className="panel-head">
        <span className="panel-title">
          <Icon name="bolt" size={18} /> 自動収集・配信
        </span>
        <span className="row" style={{ gap: 8 }}>
          <span className={`status-pill ${paused ? 'paused' : sunday ? 'rest' : ''}`}>
            {paused ? '一時停止中' : sunday ? '日曜は休み' : '稼働中'}
          </span>
          <a className="pill-link" href={href('/activity')}>
            <Icon name="gear" size={13} /> 設定
          </a>
        </span>
      </div>
      <div className={`flow ${paused ? 'paused' : ''}`}>
        <div className="flow-step">
          <Icon name="clock" size={30} stroke={1.5} />
          <div>
            <div className="flow-time">0:30</div>
            <div className="flow-name">収集開始</div>
            <div className="flow-desc">国内・海外のニュース、論文・ブログを自動収集</div>
          </div>
        </div>
        <div className="flow-arrow">
          <Icon name="arrowRight" size={22} />
        </div>
        <div className="flow-step">
          <Icon name="mail" size={30} stroke={1.5} />
          <div>
            <div className="flow-time">7:00 - 8:00</div>
            <div className="flow-name">Yahooメール配信</div>
            <div className="flow-desc">厳選した7つの原理をメールでお届け</div>
          </div>
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        月〜土のみ（日曜は完全休止）。10日間アプリでの反応がなければ自動で一時停止します
        {remaining !== null && !paused ? `（あと ${remaining} 日）` : ''}。
      </p>
    </section>
  );
}
