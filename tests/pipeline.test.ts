import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { createMockProvider } from '../src/ai/mock.ts';
import type { DailyFile } from '../src/shared/types.ts';
import { runGenerate } from '../scripts/generate/pipeline.ts';
import { readActivity, readState } from '../scripts/lib/state.ts';
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
  assert.deepEqual(it.inputTypes, ['情報', '時間'], '選択肢にないものは捨てる');
  assert.deepEqual(it.tags, ['タグ', 'テスト']);
  assert.deepEqual(it.boundary, [{ probe: '10倍なら？', answer: '遅くなる' }]);
  assert.equal(it.saved, false);

  const archive = JSON.parse(await readFile(paths.archiveFile, 'utf8'));
  assert.equal(archive.days[0].date, '2026-10-05');
  const state = await readState(paths);
  assert.equal(state.lastGeneratedDate, '2026-10-05');
  assert.deepEqual(state.aiUsage, { date: '2026-10-05', requests: 8 });
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
  assert.equal((await readDaily(paths.dailyDir, '2026-10-05')).provider, 'mock', '全部失敗したら仮のテンプレート');
  assert.equal((await readState(paths)).aiUsage.requests, ai.calls.length);
});

test('分析が壊れていても、その1件だけ仮のテンプレートにして7件そろえる', async () => {
  const paths = await tempData();
  const ai = fakeAI({ failAnalyze: true });
  const r = await runGenerate(await context(paths, { createProvider: () => ai.provider }));
  assert.equal(r.status, 'generated');
  const daily = await readDaily(paths.dailyDir, '2026-10-05');
  assert.equal(daily.items.length, 7);
  assert.ok(daily.items.every((i) => i.aiProvider === 'mock'));
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
