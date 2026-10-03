// PRINCIPLE LOOP の夜間処理の入口。GitHub Actions から呼ばれる（手元でも動く）。
//
//   node scripts/run.ts --mode=generate   収集〜AI生成〜保存（00:30）
//   node scripts/run.ts --mode=mail       朝のメール配信（07:00〜08:00）
//   node scripts/run.ts --mode=all        生成してからメール（再開直後のテスト用）
//   node scripts/run.ts --mode=mail-test  最新の DAILY をテスト送信
//   node scripts/run.ts --mode=collect    収集と絞り込みだけ（AI もメールも使わない）
//   node scripts/run.ts --mode=status     いまの状態を表示するだけ
//
// オプション：--force（日曜・停止中・生成済みでも実行：テスト用） --dry-run（何も書き込まない・送らない）
//             --date=YYYY-MM-DD（その日の 00:40 として動かす） --fixtures（ネットにつながず tests/fixtures を使う）
//             --out=DIR（データの書き込み先を変える）
//
// Claude Code / Codex はここでは一切使わない。AI は AI_PROVIDER（既定は gemini、キーが無ければ mock）だけ。

import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { createProvider } from '../src/ai/index.ts';
import { computeInactivityDays, daysUntilPause, decideRun } from '../src/shared/activity.ts';
import { jstDateString } from '../src/shared/time.ts';
import { createFixtureFetcher, createHttpFetcher } from './collect/fetch.ts';
import { collectAll } from './collect/sources.ts';
import { filterCandidates } from './filter/filter.ts';
import { runGenerate } from './generate/pipeline.ts';
import { loadConfig } from './lib/config.ts';
import { readJsonFile } from './lib/fsutil.ts';
import { createLogger } from './lib/log.ts';
import { ROOT, makePaths } from './lib/paths.ts';
import { readActivity, readState } from './lib/state.ts';
import { runMail, runMailTest } from './mail/run-mail.ts';
import { createSmtpSender, mailConfigFromEnv, resolveAppUrl } from './mail/send.ts';
import { emptyArchive } from '../src/shared/archive.ts';
import type { ArchiveIndex } from '../src/shared/types.ts';

const MODES = ['generate', 'mail', 'all', 'mail-test', 'collect', 'status'] as const;
type Mode = (typeof MODES)[number];

function parseArgs(argv: string[]) {
  const get = (name: string) => argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  const val = (name: string) => get(name)?.split('=').slice(1).join('=') ?? '';
  const mode = (val('mode') || 'status') as Mode;
  if (!MODES.includes(mode)) throw new Error(`--mode は ${MODES.join(' / ')} のどれかにしてください（指定：${mode}）`);
  const date = val('date');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('--date は YYYY-MM-DD の形で指定してください');
  const fixtures = get('fixtures') ? val('fixtures') || path.join(ROOT, 'tests', 'fixtures', 'feeds') : '';
  return {
    mode,
    force: Boolean(get('force')),
    dryRun: Boolean(get('dry-run')),
    now: date ? new Date(`${date}T00:40:00+09:00`) : new Date(),
    fixtures,
    out: val('out'),
  };
}

async function setOutput(name: string, value: string) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const log = createLogger();
  const paths = makePaths(ROOT, args.out ? path.resolve(args.out) : ROOT);
  const config = await loadConfig(paths.configDir);
  const today = jstDateString(args.now);
  log.info(`PRINCIPLE LOOP ${args.mode}｜${today}（日本時間）${args.force ? '｜force' : ''}${args.dryRun ? '｜dry-run' : ''}${args.fixtures ? '｜fixtures' : ''}`);

  const fetcher = args.fixtures ? createFixtureFetcher(args.fixtures) : createHttpFetcher(config.pipeline.fetch);
  const providerFactory = () =>
    createProvider({ provider: process.env.AI_PROVIDER, apiKey: process.env.AI_API_KEY, model: process.env.AI_MODEL, baseUrl: process.env.AI_BASE_URL });

  const mailCtx = () => {
    const { config: mc, missing } = mailConfigFromEnv(process.env);
    if (!mc) log.info(`メール設定なし（未設定：${missing.join(', ')}）`);
    return { now: args.now, paths, log, sender: mc ? createSmtpSender(mc) : null, appUrl: resolveAppUrl(process.env), force: args.force, dryRun: args.dryRun };
  };

  let failed = false;

  if (args.mode === 'status') {
    const activity = await readActivity(paths);
    const state = await readState(paths);
    const d = decideRun(activity, args.now, config.pipeline.inactivityLimitDays);
    log.info(
      JSON.stringify(
        {
          today,
          decision: d.kind,
          activity,
          inactivityDaysNow: activity.lastActive ? computeInactivityDays(activity.lastActive, args.now) : null,
          daysUntilPause: daysUntilPause(activity, args.now, config.pipeline.inactivityLimitDays),
          state,
          sources: config.sources.length,
          aiProvider: process.env.AI_PROVIDER || (process.env.AI_API_KEY ? 'gemini' : 'mock'),
          aiModel: process.env.AI_MODEL || '(既定)',
          mailConfigured: mailConfigFromEnv(process.env).config !== null,
          appUrl: resolveAppUrl(process.env),
          limits: config.pipeline.ai,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (args.mode === 'collect') {
    const archive = await readJsonFile<ArchiveIndex>(paths.archiveFile, emptyArchive());
    const { items, reports } = await collectAll(config.sources, fetcher, args.now, {
      concurrency: config.pipeline.fetch.concurrency,
      maxTotal: config.pipeline.collectMaxTotal,
      log,
    });
    reports.forEach((r) => log.info(`${r.ok ? '✓' : '✗'} ${r.id}: ${r.count}${r.message ? `（${r.message}）` : ''}`));
    const { candidates, stats } = filterCandidates(items, {
      now: args.now,
      archive,
      interests: config.interests,
      maxItemAgeDays: config.pipeline.maxItemAgeDays,
      dedupeLookbackDays: config.pipeline.dedupeLookbackDays,
      maxOutput: config.pipeline.candidatesForAi,
      maxPerSource: config.pipeline.maxPerSourceInCandidates,
    });
    log.info(JSON.stringify(stats));
    candidates.forEach((c) => log.info(`${c.key} [${c.category}] ${c.score.toFixed(2)} ${c.title.slice(0, 90)}（${c.sourceName}）`));
    return;
  }

  if (args.mode === 'generate' || args.mode === 'all') {
    const r = await runGenerate({ now: args.now, paths, config, fetcher, createProvider: providerFactory, log, force: args.force, dryRun: args.dryRun });
    (r.status === 'failed' ? log.error : log.info)(`生成：${r.status} — ${r.message}`);
    await setOutput('generate_status', r.status);
    if (r.status === 'failed') failed = true;
    if (args.dryRun && r.daily) log.info(JSON.stringify(r.daily, null, 2).slice(0, 4000));
  }

  if (args.mode === 'mail' || args.mode === 'all') {
    const r = await runMail(mailCtx());
    log.info(`メール：${r.status} — ${r.message}`);
    await setOutput('mail_status', r.status);
    await setOutput('disable_workflow', String(r.disableWorkflow));
    if (r.status === 'no-daily' && args.mode === 'mail') log.warn(r.message);
  }

  if (args.mode === 'mail-test') {
    const r = await runMailTest(mailCtx());
    (r.status === 'sent' ? log.info : log.error)(`テストメール：${r.status} — ${r.message}`);
    if (r.status !== 'sent') failed = true;
  }

  if (failed) process.exitCode = 1;
}

main().catch((e: unknown) => {
  console.error(process.env.GITHUB_ACTIONS ? `::error::${(e as Error).message}` : (e as Error).stack ?? String(e));
  process.exitCode = 1;
});
