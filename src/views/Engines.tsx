// ENGINES：思考エンジン（考え方の型）を見る場所。ここでは何も実行しない。
// 使うのは LIGHT DEEP / DIARY で「借りる」と選んだときだけ。

import { useState } from 'react';
import { PageHead } from '../components/common.tsx';
import { Icon } from '../components/Icon.tsx';
import { ENGINES, ENGINE_PIPELINE_EXAMPLES, NONE_ENGINE_ID, pipelineChatPrompt, pipelineLabel, getEngine, type PipelineStep, type ThinkingEngine } from '../engines/index.ts';
import { ENGINE_LENSES, ENGINE_OPERATIONS, TRANSFORM_OPS } from '../engines/transform.ts';
import { href } from '../router.ts';
import { LOOP_FLOW } from '../shared/loop.ts';

export function EnginesView({ id }: { id: string | null }) {
  const selected = id ? getEngine(id) : undefined;
  return (
    <div className="page stack">
      <PageHead
        kicker="ENGINES"
        title="思考エンジンを借りる"
        sub="深さも幅も、自分一人で全部持たなくていい。優れた考え方を「型」として借ります。自動では動きません。LIGHT DEEP や DIARY で選んだときだけ、問いとして使います。"
      />

      <div className="loop-strip" aria-label="循環の中での位置">
        {LOOP_FLOW.map((step, i) => (
          <span key={step} className={`loop-step ${step === 'ENGINE' || step === 'TRANSFORM' ? 'on' : ''}`}>
            {step}
            {i < LOOP_FLOW.length - 1 && <Icon name="arrowRight" size={12} />}
          </span>
        ))}
        <span className="loop-step back">↺ DIARY</span>
      </div>

      <div className="engine-grid">
        {ENGINES.filter((e) => e.id !== NONE_ENGINE_ID).map((e) => (
          <EngineCard key={e.id} engine={e} active={selected?.id === e.id} />
        ))}
      </div>

      {selected && <EngineDetail engine={selected} />}

      <PipelineComposer />

      <section className="panel panel-pad small" aria-label="NAKAJIMA FILTER">
        <strong>NAKAJIMA FILTER（個人の反応）</strong>
        <p className="muted" style={{ lineHeight: 1.8, marginBottom: 0 }}>
          「面白い」「微妙」「育てる」など、あなたの反応を記録する別レイヤーです。岡田・赤瀬川・南方・林などの人物由来エンジンや、操作・レンズの定義は変更しません。
        </p>
      </section>

      <section className="panel panel-pad">
        <div className="panel-head">
          <span className="panel-title">
            <Icon name="shuffle" size={18} /> TRANSFORM <span className="muted">エンジンで抜いた構造の種を、固定せずに変形する</span>
          </span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {TRANSFORM_OPS.map((op) => (
            <span key={op.id} className="tag" title={op.example}>
              {op.label}
              {op.example && <span className="muted">（{op.example}）</span>}
            </span>
          ))}
        </div>
      </section>

      <section className="panel panel-pad small muted" style={{ lineHeight: 1.9 }}>
        <strong style={{ color: 'var(--ink)' }}>借り方のルール</strong>
        <br />・エンジンは選択式。何も借りない（NONE）も選べます。2つ以上を混ぜても構いません（ENGINE MIX）。
        <br />・AI に結論を出させません。エンジンの問いは、自分で考えるための足場です。
        <br />・借りたら分解し、別のエンジンや自分の観察・技術と混ぜ、原型が分からなくなるまで作り直してかまいません。
        <br />・名前は「その人の考え方から借りた型」に付けたこのアプリでの呼び名です。本人の思考の正確な再現ではありません。
      </section>
    </div>
  );
}

function PipelineComposer() {
  const [steps, setSteps] = useState<PipelineStep[]>(ENGINE_PIPELINE_EXAMPLES[0].steps);
  const add = (step: PipelineStep) => setSteps((current) => [...current, step]);
  return (
    <section className="panel panel-pad stack" aria-label="任意順序のエンジンパイプライン">
      <div className="panel-head">
        <span className="panel-title"><Icon name="shuffle" size={18} /> 任意順序で組み合わせる</span>
        <span className="small muted">固定パイプラインではありません</span>
      </div>
      <div className="row" style={{ gap: 6 }}>
        {ENGINE_PIPELINE_EXAMPLES.map((example) => (
          <button key={example.label} type="button" className="tag" onClick={() => setSteps(example.steps)}>{example.label}</button>
        ))}
      </div>
      <div className="pipeline-steps" aria-label="選択中の順序">
        {steps.length === 0 ? <span className="muted">まだ選択されていません</span> : steps.map((step, index) => (
          <button key={`${step.type}-${step.id}-${index}`} type="button" className="tag on" onClick={() => setSteps((current) => current.filter((_, i) => i !== index))} title="クリックでこの段階を外す">
            {index + 1}. {step.type === 'engine' ? getEngine(step.id)?.name : [...ENGINE_OPERATIONS, ...ENGINE_LENSES].find((x) => x.id === step.id)?.label ?? step.id} ×
          </button>
        ))}
      </div>
      <div className="row" style={{ gap: 6 }}>
        {ENGINES.filter((e) => e.id !== NONE_ENGINE_ID).map((e) => <button key={e.id} type="button" className="tag" onClick={() => add({ type: 'engine', id: e.id })}>＋ {e.name}</button>)}
        {ENGINE_OPERATIONS.map((op) => <button key={op.id} type="button" className="tag" onClick={() => add({ type: op.kind === 'technique' ? 'technique' : 'operation', id: op.id })}>＋ {op.label}</button>)}
        {ENGINE_LENSES.map((op) => <button key={op.id} type="button" className="tag" onClick={() => add({ type: 'lens', id: op.id })}>＋ {op.label}</button>)}
      </div>
      <p className="small muted">現在の順序：{pipelineLabel(steps) || 'なし'}。人物エンジンと一般操作は別の種類として記録されます。</p>
      <button type="button" className="btn sm" onClick={() => void navigator.clipboard?.writeText(pipelineChatPrompt(steps, { title: 'ここに観察のタイトル', text: 'ここに観察・メモを入れる' }))}>AIチャット用のパイプライン文をコピー</button>
    </section>
  );
}

function EngineCard({ engine, active }: { engine: ThinkingEngine; active: boolean }) {
  return (
    <a className={`panel engine-card ${active ? 'active' : ''}`} href={href('/engines', { id: active ? undefined : engine.id })} aria-expanded={active}>
      <span className="engine-name">{engine.name}</span>
      <span className="engine-short">「{engine.shortDescription}」</span>
      <span className="small muted">{engine.process.slice(0, 4).join(' → ')} …</span>
      <span className="pill-link" style={{ alignSelf: 'flex-start' }}>
        {active ? '閉じる' : '詳しく'} <Icon name="arrowRight" size={12} />
      </span>
    </a>
  );
}

function EngineDetail({ engine }: { engine: ThinkingEngine }) {
  return (
    <section className="panel panel-pad stack engine-detail" aria-label={`${engine.name} の詳細`}>
      <div>
        <div className="page-kicker">{engine.name} ENGINE</div>
        <h2 style={{ fontSize: 21, fontWeight: 800 }}>{engine.shortDescription}</h2>
      </div>
      {engine.operationIds && (
        <div>
          <span className="field-label">借りられる操作・技法・レンズ（人物エンジンとは別物）</span>
          <div className="row" style={{ gap: 6 }}>
            {engine.operationIds.concat(engine.lensIds ?? []).map((id) => {
              const op = [...ENGINE_OPERATIONS, ...ENGINE_LENSES].find((x) => x.id === id);
              return op ? <span key={id} className="tag">{op.label}</span> : null;
            })}
          </div>
        </div>
      )}
      <div>
        <span className="field-label">概要</span>
        <p style={{ lineHeight: 1.85 }}>{engine.description}</p>
      </div>
      {engine.id === 'okada' && (
        <div className="panel panel-pad small" aria-label="OKADA v3 research">
          <strong>OKADA v3.0（研究版）</strong>
          <p className="muted">即興仮説生成・多問題統合・時代的前提破壊は検証中の選択式操作です。岡田斗司夫本人が明示した技法とは断定しません。</p>
          <a href="https://github.com/nakajima-yuji/principle-loop/blob/main/research/2026-10-08-okada-engine-v3-research.md" target="_blank" rel="noreferrer">300資料研究計画・出典区分を見る ↗</a>
        </div>
      )}
      {engine.evidence && (
        <div>
          <span className="field-label">モデルの根拠（事実・観察・仮説）</span>
          <div className="stack small">
            <div><strong>事実：</strong>{engine.evidence.facts.join('／')}</div>
            <div><strong>観察：</strong>{engine.evidence.observations.join('／')}</div>
            <div><strong>仮説：</strong>{engine.evidence.hypotheses.join('／')}</div>
          </div>
        </div>
      )}
      {engine.fixedQuestions && (
        <div>
          <span className="field-label">固定の問い（毎回この順で）</span>
          <ol className="engine-questions fixed">
            {engine.fixedQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </div>
      )}
      <div>
        <span className="field-label">{engine.fixedQuestions ? 'そのほかの問い' : '質問'}</span>
        <ul className="engine-questions">
          {engine.questions
            .filter((q) => !engine.fixedQuestions?.includes(q))
            .map((q) => (
              <li key={q}>{q}</li>
            ))}
        </ul>
      </div>
      <div>
        <span className="field-label">処理手順</span>
        <ol className="engine-process">
          {engine.process.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      </div>
      {engine.viewpoints && (
        <div>
          <span className="field-label">追加の視点</span>
          <div className="row" style={{ gap: 6 }}>
            {engine.viewpoints.map((v) => (
              <span key={v} className="tag">
                {v}
              </span>
            ))}
          </div>
        </div>
      )}
      <div>
        <span className="field-label">向いている用途</span>
        <div className="row" style={{ gap: 6 }}>
          {engine.suitableFor.map((v) => (
            <span key={v} className="tag">
              {v}
            </span>
          ))}
        </div>
      </div>
      <p className="small muted">使うときは、DAILY のカードを開いて（LIGHT DEEP）「思考エンジンを借りる」から選びます。DIARY の詳細からも選べます。</p>
    </section>
  );
}
