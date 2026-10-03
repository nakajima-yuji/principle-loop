import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGeminiProvider } from '../src/ai/gemini.ts';
import { createProvider } from '../src/ai/index.ts';
import { AIBudgetError, AIError, extractFirstJson, parseJsonLoose, withLimits, type AIProvider } from '../src/ai/provider.ts';

const limits = { maxRequests: 3, minIntervalMs: 0, maxRetries: 2, maxPromptChars: 50, maxOutputTokens: 100 };
const noWait = async () => undefined;
const req = { task: 't', system: 's', prompt: 'p', json: true, maxOutputTokens: 9999 };

test('上限回数を超えたら呼ばない', async () => {
  let calls = 0;
  const p = withLimits({ name: 'x', model: 'm', generate: async () => (calls++, { text: '{}' }) }, limits, { sleepFn: noWait });
  await p.generate(req);
  await p.generate(req);
  await p.generate(req);
  await assert.rejects(p.generate(req), AIBudgetError);
  assert.equal(calls, 3);
  assert.equal(p.remaining(), 0);
});

test('一時的なエラーは上限回数まで再試行。再試行も 1 回と数える', async () => {
  let calls = 0;
  const flaky: AIProvider = {
    name: 'x',
    model: 'm',
    generate: async () => {
      calls++;
      if (calls < 3) throw new AIError('429', 429, true);
      return { text: 'ok' };
    },
  };
  const p = withLimits(flaky, { ...limits, maxRequests: 10 }, { sleepFn: noWait });
  assert.equal((await p.generate(req)).text, 'ok');
  assert.equal(p.used(), 3);
});

test('再試行できないエラーはすぐ止める', async () => {
  let calls = 0;
  const bad: AIProvider = { name: 'x', model: 'm', generate: async () => (calls++, Promise.reject(new AIError('400', 400, false))) };
  await assert.rejects(withLimits(bad, limits, { sleepFn: noWait }).generate(req));
  assert.equal(calls, 1);
});

test('プロンプトの長さと出力トークン数を切り詰める', async () => {
  let seen = { prompt: '', max: 0 };
  const spy: AIProvider = { name: 'x', model: 'm', generate: async (r) => ((seen = { prompt: r.prompt, max: r.maxOutputTokens }), { text: '' }) };
  await withLimits(spy, limits, { sleepFn: noWait }).generate({ ...req, prompt: 'あ'.repeat(500) });
  assert.ok(seen.prompt.length < 80);
  assert.equal(seen.max, 100);
});

test('AI の応答から JSON を取り出す', () => {
  assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJsonLoose('はい。\n```json\n{"a":2}\n```\n以上'), { a: 2 });
  assert.deepEqual(parseJsonLoose('結果: {"a":3} です'), { a: 3 });
  assert.throws(() => parseJsonLoose('なし'));
});

test('JSON の後ろに 2 つ目の JSON や文が付いていても、最初の JSON を読む（実際に Gemini で起きた）', () => {
  assert.deepEqual(parseJsonLoose('{"a":1}\n{"a":2}'), { a: 1 });
  assert.deepEqual(parseJsonLoose('{"a":{"b":[1,2]}}\n```'), { a: { b: [1, 2] } });
  assert.deepEqual(parseJsonLoose('{"s":"括弧 } や { と \\" を含む"}\n以上です。{"x":1}'), { s: '括弧 } や { と " を含む' });
  assert.deepEqual(parseJsonLoose('```json\n{"a":5}\n{"a":6}\n```'), { a: 5 });
  assert.equal(extractFirstJson('前置き [1,[2,3]] 後ろ'), '[1,[2,3]]');
  assert.equal(extractFirstJson('{"a":'), null);
});

test('Gemini：キーは URL ではなくヘッダーで送る。JSON モード。429 は再試行可能', async () => {
  let captured: { url: string; init: RequestInit } | null = null;
  const okFetch = (async (url: string, init: RequestInit) => {
    captured = { url, init };
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"x":1}' }] } }], usageMetadata: { promptTokenCount: 5 } }), { status: 200 });
  }) as unknown as typeof fetch;
  const g = createGeminiProvider({ apiKey: 'SECRET-KEY', model: 'gemini-test', fetchImpl: okFetch });
  const r = await g.generate({ ...req, prompt: 'hello' });
  assert.equal(r.text, '{"x":1}');
  assert.ok(captured);
  const c = captured as { url: string; init: RequestInit };
  assert.doesNotMatch(c.url, /SECRET-KEY/);
  assert.equal((c.init.headers as Record<string, string>)['x-goog-api-key'], 'SECRET-KEY');
  const body = JSON.parse(String(c.init.body));
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(body.contents[0].parts[0].text, 'hello');

  const rateFetch = (async () =>
    new Response(JSON.stringify({ error: { message: 'quota', details: [{ retryDelay: '7s' }] } }), { status: 429 })) as unknown as typeof fetch;
  const g2 = createGeminiProvider({ apiKey: 'k', fetchImpl: rateFetch });
  await assert.rejects(g2.generate(req), (e: unknown) => e instanceof AIError && e.retryable && e.retryAfterMs === 7000);
});

test('AI は交換できる：キーが無ければ mock、指定があればそれ', () => {
  assert.equal(createProvider({}).name, 'mock');
  assert.equal(createProvider({ apiKey: 'k' }).name, 'gemini');
  assert.equal(createProvider({ provider: 'openai-compatible', apiKey: 'k', baseUrl: 'https://api.example/v1', model: 'm' }).name, 'openai-compatible');
  assert.throws(() => createProvider({ provider: 'unknown' }));
});
