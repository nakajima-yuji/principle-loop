import { useEffect, useMemo, useState } from 'react';
import { CategoryChip, PageHead } from '../components/common.tsx';
import { Icon } from '../components/Icon.tsx';
import { loadLatestDaily, useAsync } from '../data/api.ts';
import { markActive } from '../data/heartbeat.ts';
import { newId, removeConnection, saveConnection, saveToDiary, updateDiary, usePersonal } from '../data/store.ts';
import { copyText, toast } from '../data/toast.ts';
import { collisionQuestions, connectChatPrompt, distanceLabel, draftConnection, principleDistance, suggestFarPair } from '../lib/connect.ts';
import { ENGINES, NONE_ENGINE_ID } from '../engines/index.ts';
import { engineToSource, mediumToSource, toPrincipleSource, type PrincipleSource } from '../lib/principle.ts';
import { href, navigate } from '../router.ts';
import { MEDIA } from '../shared/loop.ts';
import { jstDateString } from '../shared/time.ts';
import type { ConnectionResult, DailyItem } from '../shared/types.ts';

export function ConnectView({ a, b, id }: { a: string | null; b: string | null; id: string | null }) {
  const personal = usePersonal();
  const latest = useAsync(loadLatestDaily, []);

  // ぶつける候補：DIARY（自分の言葉を優先）＋ 最新の DAILY ＋ 思考エンジン ＋ メディア
  const observed = useMemo(() => {
    const map = new Map<string, PrincipleSource>();
    personal.diary
      .filter((d) => d.kind !== 'connect' && d.userDecision !== 'ARCHIVE')
      .forEach((d) => map.set(d.id, toPrincipleSource(d.item, personal.notes[d.id], d.lightDeep)));
    (latest.data?.items ?? []).forEach((it) => {
      if (!map.has(it.id)) map.set(it.id, toPrincipleSource(it, personal.notes[it.id]));
    });
    return [...map.values()];
  }, [personal.diary, personal.notes, latest.data]);
  const extras = useMemo(
    () => [...ENGINES.filter((e) => e.id !== NONE_ENGINE_ID).map(engineToSource), ...MEDIA.map(mediumToSource)],
    [],
  );
  const sources = useMemo(() => [...observed, ...extras], [observed, extras]);

  const savedConn = id ? personal.connections.find((c) => c.id === id) : undefined;
  const left = sources.find((s) => s.id === (savedConn?.leftId ?? a)) ?? null;
  const right = sources.find((s) => s.id === (savedConn?.rightId ?? b)) ?? null;
  const [seed, setSeed] = useState(0);

  const [result, setResult] = useState({ newStructure: '', newUse: '', minimumExperiment: '' });
  const [connId, setConnId] = useState<string | null>(null);

  useEffect(() => {
    if (savedConn) {
      setResult({ newStructure: savedConn.newStructure, newUse: savedConn.newUse, minimumExperiment: savedConn.minimumExperiment });
      setConnId(savedConn.id);
    } else {
      setResult({ newStructure: '', newUse: '', minimumExperiment: '' });
      setConnId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, a, b]);

  const setSide = (side: 'a' | 'b', value: string) => {
    navigate('/connect', { a: side === 'a' ? value : left?.id, b: side === 'b' ? value : right?.id });
  };

  const suggest = () => {
    const pair = suggestFarPair(observed, seed);
    setSeed((s) => s + 1);
    if (pair) navigate('/connect', { a: pair[0].id, b: pair[1].id });
  };

  const draft = () => {
    if (!left || !right) return;
    const hasText = Object.values(result).some((v) => v.trim());
    if (hasText && !confirm('書いた内容を下書きで置き換えますか？')) return;
    setResult(draftConnection(left, right));
    markActive();
  };

  const save = (alsoDiary = false): ConnectionResult | null => {
    if (!left || !right) return null;
    const now = new Date().toISOString();
    const conn: ConnectionResult = {
      id: connId ?? newId('connect'),
      leftId: left.id,
      rightId: right.id,
      leftTitle: left.title,
      rightTitle: right.title,
      leftPrinciple: left.principle,
      rightPrinciple: right.principle,
      leftKind: left.node,
      rightKind: right.node,
      ...result,
      createdAt: savedConn?.createdAt ?? now,
      updatedAt: now,
    };
    saveConnection(conn);
    setConnId(conn.id);
    markActive();
    if (alsoDiary) {
      const item: DailyItem = {
        id: conn.id,
        date: jstDateString(new Date()),
        category: 'foreign',
        title: `${left.title} × ${right.title}`,
        hook: `「${left.principle}」と「${right.principle}」をぶつけた。`,
        story: '',
        sourceTitle: 'CONNECT',
        sourceUrl: '',
        sourceDate: '',
        sourceName: 'CONNECT',
        observation: '',
        input: '',
        transformation: '',
        why: '',
        speed: '',
        discard: '',
        tradeoff: '',
        minimumStructure: result.newStructure,
        removePurpose: '',
        principleCandidate: result.newStructure.split('\n').find((l) => l.trim().startsWith('→'))?.replace(/^→\s*/, '') ?? '',
        counterexample: '',
        transferIdeas: result.newUse.split('\n').map((s) => s.replace(/^・/, '').trim()).filter(Boolean),
        saved: true,
        hypothesis: result.minimumExperiment,
        tags: ['CONNECT'],
        aiProvider: 'connect',
      };
      saveToDiary(item, { kind: 'connect', type: 'IDEA', state: 'PATTERN', source: 'CONNECT' });
      updateDiary(conn.id, { derivedFrom: [left.id, right.id].filter((x) => personal.diary.some((d) => d.id === x)) });
      toast('CONNECT を保存し、DIARY にアイデアとして追加しました');
    } else {
      toast('CONNECT を保存しました');
    }
    return conn;
  };

  const distance = left && right ? principleDistance(left, right) : null;

  return (
    <div className="page stack">
      <PageHead
        kicker="CONNECT"
        title="遠いものをぶつける"
        sub="似たものではなく、遠いもの同士を優先します。観察・原理候補だけでなく、思考エンジンやメディア（絵本・空間など）ともぶつけられます。AI は使わず、問いと下書きを足場に自分で考えます。"
        right={
          <button type="button" className="btn primary" onClick={suggest} disabled={observed.length < 2}>
            <Icon name="shuffle" size={16} /> 遠い組み合わせを提案
          </button>
        }
      />

      <div className="connect-stage">
        <Slot label="A" source={left} sources={sources} otherId={right?.id} onChange={(v) => setSide('a', v)} />
        <div className="connect-x">
          <div>
            <span>×</span>
            {distance !== null && (
              <div className="distance">
                距離 {distance.toFixed(2)}
                <br />
                {distanceLabel(distance)}
              </div>
            )}
          </div>
        </div>
        <Slot label="B" source={right} sources={sources} otherId={left?.id} onChange={(v) => setSide('b', v)} />
      </div>

      {left && right && (
        <>
          <section className="panel panel-pad">
            <div className="panel-head">
              <span className="panel-title">
                <Icon name="spark" size={18} /> ぶつけるための問い
              </span>
              <span className="row">
                <button type="button" className="btn sm" onClick={() => void copyText(connectChatPrompt(left, right), 'AIチャット用の相談文をコピーしました')}>
                  <Icon name="copy" size={14} /> AIチャットに相談する文をコピー
                </button>
                <button type="button" className="btn sm soft" onClick={draft}>
                  <Icon name="plus" size={14} /> 下書きを作る
                </button>
              </span>
            </div>
            <ol className="collide-questions">
              {collisionQuestions(left, right).map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </section>

          <div className="result-grid">
            <ResultCard title="新しい構造" icon="connect" value={result.newStructure} onChange={(v) => setResult({ ...result, newStructure: v })} placeholder="用途を消した一文で" />
            <ResultCard title="新しい用途" icon="spark" value={result.newUse} onChange={(v) => setResult({ ...result, newUse: v })} placeholder="1行に1つ" />
            <ResultCard
              title="最小実験"
              icon="flask"
              value={result.minimumExperiment}
              onChange={(v) => setResult({ ...result, minimumExperiment: v })}
              placeholder="何と何を比べ、何を観測する？"
            />
          </div>

          <div className="row">
            <button type="button" className="btn primary" onClick={() => save(false)} disabled={!result.newStructure.trim()}>
              <Icon name="check" size={16} /> 保存
            </button>
            <button type="button" className="btn" onClick={() => save(true)} disabled={!result.newStructure.trim()}>
              <Icon name="bookmark" size={16} /> 保存して DIARY にも追加
            </button>
            <button
              type="button"
              className="btn"
              disabled={!result.newStructure.trim()}
              onClick={() => {
                const c = save(false);
                if (c) navigate('/experiment', { from: 'connect', id: c.id });
              }}
            >
              <Icon name="flask" size={16} /> EXPERIMENT で小さく試す
            </button>
          </div>
        </>
      )}

      {personal.connections.length > 0 && (
        <section className="panel panel-pad">
          <div className="panel-head">
            <span className="panel-title">
              <Icon name="connect" size={18} /> 保存した CONNECT
            </span>
          </div>
          <div className="result-list">
            {personal.connections.map((c) => (
              <div key={c.id} className="result-item">
                <a href={href('/connect', { id: c.id })} style={{ color: 'inherit' }}>
                  <strong>
                    {c.leftTitle} × {c.rightTitle}
                  </strong>
                  <div className="small muted" style={{ whiteSpace: 'pre-line' }}>
                    {c.newStructure.split('\n').slice(-2).join(' ')}
                  </div>
                </a>
                <span className="row">
                  <a className="btn sm" href={href('/experiment', { from: 'connect', id: c.id })}>
                    EXPERIMENT
                  </a>
                  <button
                    type="button"
                    className="btn sm ghost danger"
                    aria-label="削除"
                    onClick={() => {
                      if (confirm('この CONNECT を削除しますか？')) removeConnection(c.id);
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Slot({
  label,
  source,
  sources,
  otherId,
  onChange,
}: {
  label: string;
  source: PrincipleSource | null;
  sources: PrincipleSource[];
  otherId?: string;
  onChange: (id: string) => void;
}) {
  return (
    <section className="panel connect-slot" aria-label={label}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="q-label">{label}</span>
        {source && (source.node === 'engine' || source.node === 'medium' ? <span className="chip">{source.node === 'engine' ? 'ENGINE' : 'MEDIUM'}</span> : <CategoryChip category={source.category} />)}
      </div>
      <select className="select" value={source?.id ?? ''} onChange={(e) => onChange(e.target.value)} aria-label={`${label}を選ぶ`}>
        <option value="">ぶつけるものを選ぶ…</option>
        {(
          [
            ['観察・原理候補', (s: PrincipleSource) => !s.node || s.node === 'observation' || s.node === 'principle'],
            ['思考エンジン', (s: PrincipleSource) => s.node === 'engine'],
            ['メディア', (s: PrincipleSource) => s.node === 'medium'],
          ] as const
        ).map(([group, match]) => (
          <optgroup key={group} label={group}>
            {sources.filter(match).map((s) => (
              <option key={s.id} value={s.id} disabled={s.id === otherId}>
                {s.title}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {source ? (
        <>
          <p className="principle">{source.principle || '（原理候補が未記入）'}</p>
          <p className="small muted">
            <strong>{source.node === 'engine' ? '処理手順：' : '最小構造：'}</strong>
            {source.minimumStructure || '—'}
          </p>
          {source.discard && (
            <p className="small muted">
              <strong>捨てているもの：</strong>
              {source.discard}
            </p>
          )}
        </>
      ) : (
        <div className="empty">左右に置くか、「遠い組み合わせを提案」を押してください。</div>
      )}
    </section>
  );
}

function ResultCard({
  title,
  icon,
  value,
  onChange,
  placeholder,
}: {
  title: string;
  icon: 'connect' | 'spark' | 'flask';
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <section className="panel result-card">
      <h3>
        <Icon name={icon} size={17} /> {title}
      </h3>
      <textarea className="note" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={title} />
    </section>
  );
}
