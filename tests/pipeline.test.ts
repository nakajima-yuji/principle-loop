import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { createMockProvider } from '../src/ai/mock.ts';
import type { DailyFile } from '../src/shared/types.ts';
import { runGenerate } from '../scripts/generate/pipeline.ts';
import { readActivity, readState } from '../scripts/lib/state.ts';
import { ROOT } from '../scripts/lib/paths.ts';
import { MONDAY, SUNDAY, context, fakeAI, tempData } from './helpers.ts';

const readDaily = async (dir: string, date: string) => JSON.parse(await readFile(path.join(dir, `${date}.json`), 'utf8')) as DailyFile;

test('月曜：収集 → 絞り込み → AI で7件 → 保存（AI は選定1回＋分析7回）', async () => {
  const paths = await tempData();
  const ai = fakeAI();
  const r = await runGenerate(await context(paths, { createProvider: () => ai.provider }));
  assert.equal(r.status, 'generated', r.message);
  assert.equal(ai.calls.length, 8);
  assert.equal(ai.calls[0].task, 'select');
  assert.match(ai.calls[1].system, /単純なニュース要約をしない/);
  assert.match(ai.calls[1].system, /考え切らない/);
  assert.match(ai.calls[1].prompt, /"lightDeep"/);
  assert.doesNotMatch(ai.calls[1].prompt, /"story"|"boundary"/, '毎朝7件の長い分析は作らない');

  const daily = await readDaily(paths.dailyDir, '2026-10-05');
  assert.equal(daily.items.length, 7);
  assert.deepEqual(
    daily.items.map((i) => i.id),
    ['01', '02', '03', '04', '05', '06', '07'].map((n) => `20261005-${n}`),
  );
  assert.deepEqual(
    daily.items.map((i) => i.category),
    ['nature', 'tech', 'science', 'mind', 'build', 'culture', 'foreign'],
  );
  assert.ok(daily.items.some((i) => i.id === daily.principleOfTheDay));
  const it = daily.items[0];
  assert.notEqual(it.sourceUrl, 'https://evil.example/作り話', '出典 URL は AI ではなく収集データから入れる');
  assert.match(it.sourceUrl, /^https:\/\/example\.org\//);
  assert.deepEqual(it.lightDeep, { odd: '止まらずに流れているのが妙', structure: '少ない判断で全体が動く', transfer: '群衆の避難誘導' });
  assert.equal(it.principleCandidate, '少ない判断で全体が動く', '索引・検索用に「構造」の行を原理候補として持つ');
  assert.deepEqual(it.transferIdeas, ['群衆の避難誘導']);
  assert.equal(it.story, '');
  assert.deepEqual(it.tags, ['タグ', 'テスト']);
  assert.equal(it.saved, false);

  const archive = JSON.parse(await readFile(paths.archiveFile, 'utf8'));
  assert.equal(archive.days[0].date, '2026-10-05');
  const state = await readState(paths);
  assert.equal(state.lastGeneratedDate, '2026-10-05');
  assert.deepEqual(state.aiUsage, { date: '2026-10-05', requests: 8 });
});

test('古い形（長い分析）で返ってきても受け取り、3行を補う', async () => {
  const paths = await tempData();
  const ai = fakeAI({ legacy: true });
  const r = await runGenerate(await context(paths, { createProvider: () => ai.provider }));
  assert.equal(r.status, 'generated', r.message);
  const it = (await readDaily(paths.dailyDir, '2026-10-05')).items[0];
  assert.deepEqual(it.inputTypes, ['情報', '時間'], '選択肢にないものは捨てる');
  assert.deepEqual(it.boundary, [{ probe: '10倍なら？', answer: '遅くなる' }]);
  assert.equal(it.lightDeep?.structure, '少ない判断で全体が動く');
  assert.equal(it.lightDeep?.transfer, '転用1');
  assert.match(it.lightDeep?.odd ?? '', /なぜだろう/);
});

test('日曜：収集もAIも保存もしない', async () => {
  const paths = await tempData();
  const ai = fakeAI();
  const r = await runGenerate(await context(paths, { now: SUNDAY, createProvider: () => ai.provider }));
  assert.equal(r.status, 'skipped-sunday');
  assert.equal(ai.calls.length, 0);
  assert.deepEqual(await readdir(paths.dailyDir), []);
});

test('停止中：何もしない', async () => {
  const paths = await tempData({ activity: { paused: true } });
  const ai = fakeAI();
  const r = await runGenerate(await context(paths, { createProvider: () => ai.provider }));
  assert.equal(r.status, 'skipped-paused');
  assert.equal(ai.calls.length, 0);
});

test('10日無反応：停止して、朝のお知らせを予約するだけ（収集・AI なし）', async () => {
  const paths = await tempData({ activity: { lastActive: '2026-09-24T12:00:00.000Z' } });
  const ai = fakeAI();
  let fetched = 0;
  const ctx = await context(paths, { createProvider: () => ai.provider });
  const r = await runGenerate({ ...ctx, fetcher: async (u, h) => (fetched++, ctx.fetcher(u, h)) });
  assert.equal(r.status, 'paused');
  assert.equal(ai.calls.length, 0);
  assert.equal(fetched, 0);
  const act = await readActivity(paths);
  assert.equal(act.paused, true);
  assert.ok(act.inactivityDays >= 10);
  assert.equal((await readState(paths)).pauseNoticePending, true);
});

test('同じ日に2回目は生成しない（03:10 の再試行は何もしない）', async () => {
  const paths = await tempData({ state: { lastGeneratedDate: '2026-10-05' } });
  const ai = fakeAI();
  const r = await runGenerate(await context(paths, { createProvider: () => ai.provider }));
  assert.equal(r.status, 'already');
  assert.equal(ai.calls.length, 0);
});

test('AI の1日の上限に近ければ生成しない', async () => {
  const paths = await tempData({ state: { aiUsage: { date: '2026-10-05', requests: 15 } } });
  const ai = fakeAI();
  const r = await runGenerate(await context(paths, { createProvider: () => ai.provider }));
  assert.equal(r.status, 'failed');
  assert.match(r.message, /上限/);
  assert.equal(ai.calls.length, 0);
});

test('1回の実行の上限を超えて AI を呼ばない（再試行も数える）', async () => {
  const paths = await tempData();
  const ai = fakeAI({ failTimes: 100 }); // ずっと 429
  const ctx = await context(paths, { createProvider: () => ai.provider });
  const r = await runGenerate(ctx);
  assert.ok(ai.calls.length <= ctx.config.pipeline.ai.maxRequestsPerRun, `呼び出し ${ai.calls.length} 回`);
  assert.equal(r.status, 'generated');
  const daily = await readDaily(paths.dailyDir, '2026-10-05');
  assert.ok(daily.items.every((i) => i.analysisFailed), '全部失敗したら全部「作成中止」');
  assert.equal((await readState(paths)).aiUsage.requests, ai.calls.length);
});

test('分析に失敗した記事は「作成中止」：仮の文章で埋めず、理由と情報源の要約だけを持つ', async () => {
  const paths = await tempData();
  const ai = fakeAI({ failAnalyze: true });
  const r = await runGenerate(await context(paths, { createProvider: () => ai.provider }));
  assert.equal(r.status, 'generated');
  assert.match(r.message, /作成中止 7 件/);
  const daily = await readDaily(paths.dailyDir, '2026-10-05');
  assert.equal(daily.items.length, 7);
  for (const it of daily.items) {
    assert.equal(it.analysisFailed, true);
    assert.equal(it.aiProvider, 'failed');
    assert.match(it.failReason ?? '', /途中で切れていた/);
    assert.equal(it.principleCandidate, '');
    assert.equal(it.story, '');
    assert.equal(it.minimumStructure, '');
    assert.doesNotMatch(it.hook, /未分析|AI未設定/);
    assert.match(it.sourceUrl, /^https:\/\/example\.org\//);
  }
});

test('分析が1回失敗しても、予算の範囲でもう1回頼んで直す', async () => {
  const paths = await tempData();
  const ai = fakeAI({ failAnalyzeTimes: 1 });
  const r = await runGenerate(await context(paths, { createProvider: () => ai.provider }));
  assert.equal(r.status, 'generated');
  assert.equal(ai.calls.length, 1 + 7 + 1);
  const daily = await readDaily(paths.dailyDir, '2026-10-05');
  assert.equal(daily.items.filter((i) => i.analysisFailed).length, 0);
});

test('03:10 の再試行：作成中止の記事だけを作り直す（古い形式の仮テンプレートも対象）', async () => {
  const sample = JSON.parse(await readFile(path.join(ROOT, 'tests/fixtures/sample-daily.json'), 'utf8')) as DailyFile;
  const paths = await tempData({ state: { lastGeneratedDate: '2026-10-05', aiUsage: { date: '2026-10-05', requests: 9 } } });
  const items = sample.items.map((it, i) =>
    i === 0
      ? { ...it, analysisFailed: true, aiProvider: 'failed', failReason: 'AI が混み合っていた・つながらなかったため', principleCandidate: '' }
      : i === 3
        ? { ...it, aiProvider: 'mock' } // 古いデータ：印は無いが仮のテンプレート
        : it,
  );
  const stored: DailyFile = { ...sample, date: '2026-10-05', sample: false, provider: 'gemini', principleOfTheDay: items[0].id, items };
  await writeFile(path.join(paths.dailyDir, '2026-10-05.json'), JSON.stringify(stored));

  const ai = fakeAI();
  const r = await runGenerate(await context(paths, { createProvider: () => ai.provider }));
  assert.equal(r.status, 'repaired', r.message);
  assert.equal(ai.calls.length, 2, '直すのは 2 件だけ');
  const daily = await readDaily(paths.dailyDir, '2026-10-05');
  assert.equal(daily.items.filter((i) => i.analysisFailed).length, 0);
  assert.equal(daily.items[0].sourceUrl, sample.items[0].sourceUrl, '出典はそのまま');
  assert.equal(daily.items[1].title, sample.items[1].title, '成功していた記事は触らない');
  assert.equal((await readState(paths)).aiUsage.requests, 11);
  const archive = JSON.parse(await readFile(paths.archiveFile, 'utf8'));
  assert.equal(archive.days[0].items[0].principleCandidate, '少ない判断で全体が動く');

  const again = await runGenerate(await context(paths, { createProvider: () => fakeAI().provider }));
  assert.equal(again.status, 'already', '直すものが無ければ何もしない');
});

test('03:10 の再試行：AI の 1 日の上限に達していたら作り直さない', async () => {
  const sample = JSON.parse(await readFile(path.join(ROOT, 'tests/fixtures/sample-daily.json'), 'utf8')) as DailyFile;
  const paths = await tempData({ state: { lastGeneratedDate: '2026-10-05', aiUsage: { date: '2026-10-05', requests: 20 } } });
  const items = sample.items.map((it, i) => (i === 0 ? { ...it, analysisFailed: true, aiProvider: 'failed' } : it));
  await writeFile(path.join(paths.dailyDir, '2026-10-05.json'), JSON.stringify({ ...sample, date: '2026-10-05', provider: 'gemini', items }));
  const ai = fakeAI();
  const r = await runGenerate(await context(paths, { createProvider: () => ai.provider }));
  assert.equal(r.status, 'already');
  assert.match(r.message, /上限/);
  assert.equal(ai.calls.length, 0);
});

test('AI 未設定（mock）でも通しで動き、無料枠を数えない', async () => {
  const paths = await tempData();
  const r = await runGenerate(await context(paths, { createProvider: createMockProvider }));
  assert.equal(r.status, 'generated');
  assert.equal(r.aiRequests, 0);
  assert.equal((await readDaily(paths.dailyDir, '2026-10-05')).provider, 'mock');
});

test('dry-run は何も書き込まない', async () => {
  const paths = await tempData();
  const before = await readFile(paths.activityFile, 'utf8');
  const r = await runGenerate(await context(paths, { dryRun: true }));
  assert.equal(r.status, 'generated');
  assert.deepEqual(await readdir(paths.dailyDir), []);
  assert.equal(await readFile(paths.activityFile, 'utf8'), before);
});

test('生成しても lastActive は変わらない（ユーザーの反応ではないため）', async () => {
  const paths = await tempData();
  const before = await readActivity(paths);
  await runGenerate(await context(paths));
  const after = await readActivity(paths);
  assert.equal(after.lastActive, before.lastActive);
  assert.equal(MONDAY.toISOString() > after.lastActive, true);
});
