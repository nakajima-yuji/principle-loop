import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { collisionQuestions, draftConnection, principleDistance, suggestFarPair } from '../src/lib/connect.ts';
import { claudeCodePrompt, codexPrompt, draftFromPrinciple, readiness } from '../src/lib/experiment.ts';
import { createManualItem, hostLabel, isHttpUrl } from '../src/lib/manual.ts';
import { toPrincipleSource } from '../src/lib/principle.ts';
import { searchAll } from '../src/lib/search.ts';
import { emptyArchive, upsertArchiveDay } from '../src/shared/archive.ts';
import { CATEGORY_IDS } from '../src/shared/categories.ts';
import { CORE_QUESTIONS } from '../src/shared/questions.ts';
import { withFailureFlags } from '../src/shared/item-status.ts';
import { dateFromItemId, formatJaDate, makeItemId } from '../src/shared/time.ts';
import type { DailyFile, DiaryEntry } from '../src/shared/types.ts';
import { ROOT } from '../scripts/lib/paths.ts';

const sample = JSON.parse(await readFile(path.join(ROOT, 'tests/fixtures/sample-daily.json'), 'utf8')) as DailyFile;

test('サンプルの DAILY（tests/fixtures）：7件・7分野・必須フィールド・事実と解釈が分かれている', () => {
  assert.equal(sample.items.length, 7);
  assert.deepEqual(
    sample.items.map((i) => i.category),
    [...CATEGORY_IDS],
  );
  const required = ['id', 'date', 'category', 'title', 'hook', 'story', 'sourceTitle', 'sourceUrl', 'sourceDate', 'observation', 'input', 'transformation', 'why', 'speed', 'discard', 'tradeoff', 'minimumStructure', 'removePurpose', 'principleCandidate', 'counterexample', 'transferIdeas', 'saved'] as const;
  for (const it of sample.items) {
    for (const k of required) assert.ok(k in it, `${it.id} に ${k} がない`);
    assert.match(it.sourceUrl, /^https:\/\//);
    assert.equal(it.story.split('\n\n').length, 4, 'ストーリーは4段落');
    assert.equal(it.boundary?.length, 7);
  }
  assert.ok(sample.items.some((i) => i.id === sample.principleOfTheDay));
});

test('DEEP の7つの中心質問', () => {
  assert.deepEqual(
    CORE_QUESTIONS.map((q) => q.question),
    ['何を入力している？', '何を変換している？', 'なぜ速い？', '何を捨てている？', '何とのトレードオフ？', '最小構造は何？', '元用途を消しても成立する？'],
  );
});

test('id と日付', () => {
  assert.equal(makeItemId('2026-10-05', 3), '20261005-03');
  assert.equal(dateFromItemId('20261005-03'), '2026-10-05');
  assert.equal(dateFromItemId('manual-abc'), null);
  assert.equal(formatJaDate('2026-10-05'), '2026年10月5日（月）');
});

test('CONNECT：遠い組み合わせを優先して提案する', () => {
  const sources = sample.items.map((i) => toPrincipleSource(i));
  const near = principleDistance(sources[0], sources[0]);
  const far = principleDistance(sources[0], sources[3]);
  assert.ok(far > near);
  const pair = suggestFarPair(sources, 0);
  assert.ok(pair && pair[0].category !== pair[1].category);
  const draft = draftConnection(sources[0], sources[3]);
  assert.match(draft.newStructure, /A：/);
  assert.match(draft.minimumExperiment, /A×B/);
  assert.ok(collisionQuestions(sources[0], sources[3]).length >= 4);
});

test('自分の DEEP の答えがあれば AI の下書きより優先する', () => {
  const s = toPrincipleSource(sample.items[0], { principleCandidate: '自分の言葉', transfer: 'A\nB' });
  assert.equal(s.principle, '自分の言葉');
  assert.deepEqual(s.transferIdeas, ['A', 'B']);
  assert.equal(s.minimumStructure, sample.items[0].minimumStructure);
});

test('BUILD：設計がそろうまでプロンプトは出さない。出すときは自動実行しない前提の文面', () => {
  const empty = { principle: '', hypothesis: '', minimumStructure: '', discard: '', comparison: '', conditions: '', success: '', failure: '', observe: '', tech: '', v30m: '', v2h: '', v1d: '' };
  assert.equal(readiness(empty).every((c) => c.ok), false);
  const d = draftFromPrinciple(toPrincipleSource(sample.items[6]));
  assert.equal(readiness(d).every((c) => c.ok), true);
  const cc = claudeCodePrompt(d);
  assert.match(cc, /まず「30分版」だけを実装/);
  assert.match(cc, /## 失敗条件/);
  assert.match(codexPrompt(d), /Acceptance criteria/);
});

test('URL から掘る（X 投稿など）', () => {
  assert.equal(hostLabel('https://x.com/someone/status/1'), 'X');
  assert.equal(hostLabel('https://www.example.com/a'), 'example.com');
  assert.equal(isHttpUrl('javascript:alert(1)'), false);
  const it = createManualItem({ url: 'https://x.com/a/status/1', title: '', phenomenon: '信号のない交差点で、みんなが少しずつ譲り合って流れている。', category: 'mind' }, new Date('2026-10-05T03:00:00Z'), 'manual-1');
  assert.equal(it.id, 'manual-1');
  assert.equal(it.observation, it.hook);
  assert.equal(it.sourceName, 'X');
});

test('検索：DAILY の過去分・DIARY・タグを横断し、AND で絞る', () => {
  const archive = upsertArchiveDay(emptyArchive(), sample, '2026-10-03T00:00:00Z');
  const hits = searchAll('フィードバック', archive, []);
  assert.ok(hits.some((h) => h.id === '20261003-01'));
  assert.equal(searchAll('粘菌 レンズ', archive, []).length, 0);
  const diary: DiaryEntry[] = [
    { id: sample.items[1].id, kind: 'daily', state: 'HYPOTHESIS', item: sample.items[1], memo: 'ゲームの群衆AIに使えそう', tags: ['群衆'], experiments: [], createdAt: '', updatedAt: '' },
  ];
  const h2 = searchAll('群衆AI', archive, diary);
  assert.equal(h2[0].kind, 'diary');
  assert.equal(searchAll('#群衆', archive, diary)[0].id, sample.items[1].id);
});

test('archive：本物の DAILY ができたらサンプルの日を外す', () => {
  let idx = upsertArchiveDay(emptyArchive(), sample, 'x');
  assert.equal(idx.days.length, 1);
  idx = upsertArchiveDay(idx, { ...sample, sample: false, date: '2026-10-05' }, 'y');
  assert.deepEqual(
    idx.days.map((d) => d.date),
    ['2026-10-05'],
  );
});

test('作成中止：古い形式の仮テンプレートにも印を付け、仮の文章は消して事実だけ残す', () => {
  const legacy = { ...sample, sample: false, provider: 'gemini', items: sample.items.map((it, i) => (i === 1 ? { ...it, aiProvider: 'mock', minimumStructure: '（未分析）要素 + 関係 + ルール' } : it)) };
  const flagged = withFailureFlags(legacy);
  const it = flagged.items[1];
  assert.equal(it.analysisFailed, true);
  assert.equal(it.failReason, '理由は記録されていません');
  assert.equal(it.minimumStructure, '');
  assert.equal(it.story, '');
  assert.equal(it.observation, sample.items[1].observation, '事実（情報源の要約）は残す');
  assert.equal(flagged.items[0].analysisFailed, undefined, '成功した記事はそのまま');
  const allMock = { ...legacy, provider: 'mock' };
  assert.equal(withFailureFlags(allMock), allMock, 'AI 未設定の日（全部 mock）は作成中止にしない');
});
