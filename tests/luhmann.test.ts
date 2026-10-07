import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLuhmannRequest, normalizeLuhmannResult, parseLuhmannResult } from '../src/systems/luhmann/core.ts';

const cases = ['蜘蛛の巣', 'NARUTOの影分身', 'サッカーなのに、自分の席を探していて試合を見られない', '暑さによって物の状態が変わり、変化後の性質を攻略に利用する'];

test('LUHMANN MVP：TEST A-D は標準フローの入力として独立処理できる', () => {
  for (const input of cases) {
    const request = buildLuhmannRequest(input);
    assert.equal(request.task, 'luhmann');
    assert.match(request.system, /CONNECTION/);
    assert.match(request.prompt, /ATOMIC|原子化/);
    assert.match(request.prompt, /BRIDGE/);
    assert.match(request.prompt, /EMERGENT/);
    assert.equal(request.json, true);
  }
});

test('LUHMANN結果：接続の距離・品質・信頼度を正規化し、原理を断定しない', () => {
  const result = normalizeLuhmannResult('蜘蛛の巣', {
    atomic: [{ id: 'A1', kind: 'PHENOMENON', text: '張力で網が保たれる' }],
    abstracts: ['分散した接点で変化を検知する'],
    structures: ['NETWORK → CONTACT → SIGNAL → RESPONSE'],
    connections: [
      { type: 'FAR', from: ['A1'], to: ['保険制度'], relation: '局所損失を接続全体で吸収する', whyConnected: '個別の破断を全体の接続で検知・吸収する構造が共通する', distance: 0.9, scores: { similarity: 0.1, structuralFit: 0.9, novelty: 0.9, explanatoryPower: 0.8, generativePower: 0.9 }, confidence: 'HIGH' },
      { type: 'CAUSAL', relation: '', distance: 3, scores: {}, confidence: 'HIGH' },
    ],
    bridges: ['対象そのものではなく環境の変化から存在を推測する'],
    patterns: ['局所変化 → 全体への信号'],
    principleCandidates: ['接続の密度が局所的な損失を全体の判断へ変換する可能性がある'],
    emergentIdeas: ['見えない侵入を網の張力変化だけで遊ぶ一画面ゲーム'],
    strangestUsefulConnection: '蜘蛛の巣 × 保険制度',
  });
  assert.equal(result.system, 'LUHMANN SYSTEM');
  assert.equal(result.atomic.length, 1);
  assert.equal(result.connections.length, 1);
  assert.equal(result.connections[0].distance, 0.9);
  assert.equal(result.connections[0].confidence, 'HIGH');
  assert.ok(result.bridges.length && result.emergentIdeas.length);
});

test('LUHMANN結果：Markdown囲みのJSONも一時結果として読める', () => {
  const result = parseLuhmannResult('影分身', '```json\n{"atomic":[{"id":"A1","text":"分散","kind":"IDEA"}],"connections":[],"principleCandidates":["候補"]}\n```');
  assert.equal(result.atomic[0].text, '分散');
  assert.deepEqual(result.principleCandidates, ['候補']);
});

