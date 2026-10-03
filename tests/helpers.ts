import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AIProvider, AIRequest } from '../src/ai/provider.ts';
import { emptyArchive } from '../src/shared/archive.ts';
import type { Activity } from '../src/shared/types.ts';
import { createFixtureFetcher } from '../scripts/collect/fetch.ts';
import { loadConfig } from '../scripts/lib/config.ts';
import { silentLogger } from '../scripts/lib/log.ts';
import { ROOT, makePaths, type Paths } from '../scripts/lib/paths.ts';
import { emptyState, type RunState } from '../scripts/lib/state.ts';
import type { RunContext } from '../scripts/generate/pipeline.ts';

export const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'feeds');

/** 2026-10-05 は月曜日。00:40 JST に夜間処理が動いた想定 */
export const MONDAY = new Date('2026-10-05T00:40:00+09:00');
export const SUNDAY = new Date('2026-10-04T00:40:00+09:00');

export async function tempData(opts: { activity?: Partial<Activity>; state?: Partial<RunState> } = {}): Promise<Paths> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'principle-loop-test-'));
  const paths = makePaths(ROOT, dir);
  await mkdir(paths.dailyDir, { recursive: true });
  await mkdir(path.dirname(paths.archiveFile), { recursive: true });
  await mkdir(path.dirname(paths.stateFile), { recursive: true });
  await writeFile(paths.archiveFile, JSON.stringify(emptyArchive()));
  await writeFile(paths.activityFile, JSON.stringify({ lastActive: '2026-10-04T12:00:00.000Z', inactivityDays: 0, paused: false, ...opts.activity }));
  await writeFile(paths.stateFile, JSON.stringify({ ...emptyState(), ...opts.state }));
  return paths;
}

/** 本物の AI のように JSON を返す偽物。呼ばれた回数と内容を記録する。 */
export function fakeAI(opts: { failAnalyze?: boolean; failAnalyzeTimes?: number; failTimes?: number } = {}) {
  const calls: AIRequest[] = [];
  let failures = 0;
  let analyzeFailures = 0;
  const provider: AIProvider = {
    name: 'gemini',
    model: 'fake',
    async generate(req) {
      calls.push(req);
      if (opts.failTimes && failures < opts.failTimes) {
        failures++;
        const { AIError } = await import('../src/ai/provider.ts');
        throw new AIError('rate limited', 429, true, 1);
      }
      if (req.task === 'select') {
        const keys = [...req.prompt.matchAll(/\[(c\d\d)\] 分野の目安:(\w+)/g)].map((m) => ({ key: m[1], category: m[2] }));
        return {
          text: '```json\n' + JSON.stringify({ picks: keys.map((k, i) => ({ key: k.key, category: k.category, scores: { structure: 5 - (i % 3), transfer: 4 }, seed: 'たね', reason: '理由' })) }) + '\n```',
        };
      }
      // 実際に起きた形：JSON が途中で切れている
      if (opts.failAnalyze || (opts.failAnalyzeTimes && analyzeFailures < opts.failAnalyzeTimes)) {
        analyzeFailures++;
        return { text: '{"title": "途中で切れ' };
      }
      return {
        text: JSON.stringify({
          title: 'テストの見出し',
          hook: '何かが起きている。なぜだろう。',
          story: '何だこれ。\n\nなぜ。\n\nそういう構造。\n\n他にも使える。',
          observation: '事実だけ',
          input: '情報と時間',
          inputTypes: ['情報', '時間', '存在しない選択肢'],
          transformation: 'A → B',
          why: '仮説',
          speed: '判断回数を減らす',
          speedTypes: ['判断回数削減'],
          discard: '精度',
          discardTypes: ['精度'],
          tradeoff: '速度 ↔ 精度',
          minimumStructure: '要素 + ルール',
          removePurpose: '〜する構造',
          principleCandidate: '少ない判断で全体が動く',
          counterexample: '反例',
          hypothesis: '〜を変えると〜',
          boundary: [{ probe: '10倍なら？', answer: '遅くなる' }, { probe: '知らない問い', answer: 'x' }],
          invert: '逆',
          transferIdeas: ['転用1', '転用2'],
          tags: ['#タグ', 'テスト'],
          transferability: 0.8,
          sourceUrl: 'https://evil.example/作り話',
        }),
      };
    },
  };
  return { provider, calls };
}

export async function context(paths: Paths, overrides: Partial<RunContext> = {}): Promise<RunContext> {
  const config = await loadConfig(path.join(ROOT, 'config'), {});
  return {
    now: MONDAY,
    paths,
    config,
    fetcher: createFixtureFetcher(FIXTURES),
    createProvider: () => fakeAI().provider,
    log: silentLogger,
    force: false,
    dryRun: false,
    sleepFn: async () => undefined,
    ...overrides,
  };
}
