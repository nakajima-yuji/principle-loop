// 夜間の DAILY 生成（00:30〜）。
// 日曜？ → 終了 / paused？ → 終了 / 10日無反応？ → 停止処理 / それ以外 → 収集 → 重複除去 → 分類 → 候補抽出 → 原理分析 → 7件選定 → ストーリー化 → 保存

import path from 'node:path';
import { createMockProvider } from '../../src/ai/mock.ts';
import { AIBudgetError, parseJsonLoose, withLimits, type AIProvider } from '../../src/ai/provider.ts';
import { decideRun } from '../../src/shared/activity.ts';
import { emptyArchive, upsertArchiveDay } from '../../src/shared/archive.ts';
import { categoryOf } from '../../src/shared/categories.ts';
import { jstDateString, makeItemId } from '../../src/shared/time.ts';
import type { ArchiveIndex, DailyFile, DailyItem } from '../../src/shared/types.ts';
import { mapLimit, type Fetcher } from '../collect/fetch.ts';
import { extractArticle } from '../collect/html.ts';
import { collectAll, type SourceReport } from '../collect/sources.ts';
import { filterCandidates, type Candidate } from '../filter/filter.ts';
import type { Config } from '../lib/config.ts';
import { readJsonFile, writeJsonFile } from '../lib/fsutil.ts';
import type { Logger } from '../lib/log.ts';
import type { Paths } from '../lib/paths.ts';
import { readActivity, readState, writeActivity, writeState, type RunState } from '../lib/state.ts';
import { chooseSeven, parsePicks, type Chosen } from './choose.ts';
import { isUsable, toDailyItem } from './normalize.ts';
import { SYSTEM_PROMPT, analyzePrompt, selectPrompt } from './prompts.ts';

export interface RunContext {
  now: Date;
  paths: Paths;
  config: Config;
  fetcher: Fetcher;
  createProvider: () => AIProvider;
  log: Logger;
  force: boolean;
  dryRun: boolean;
  sleepFn?: (ms: number) => Promise<void>;
}

export type GenerateStatus = 'skipped-sunday' | 'skipped-paused' | 'paused' | 'already' | 'generated' | 'failed';

export interface GenerateResult {
  status: GenerateStatus;
  message: string;
  daily?: DailyFile;
  aiRequests: number;
  reports?: SourceReport[];
}

export async function runGenerate(ctx: RunContext): Promise<GenerateResult> {
  const { now, paths, config, log } = ctx;
  const today = jstDateString(now);
  const activity = await readActivity(paths);
  const state = await readState(paths);

  // ---- 冒頭の判定（日曜・停止中・10日無反応） ----
  const decision = decideRun(activity, now, config.pipeline.inactivityLimitDays);
  if (!ctx.force) {
    if (decision.kind === 'skip-sunday') return { status: 'skipped-sunday', message: '日曜日は完全休止です（収集・AI・メールなし）', aiRequests: 0 };
    if (decision.kind === 'skip-paused') return { status: 'skipped-paused', message: 'PRINCIPLE LOOP は一時停止中です。アプリから再開できます', aiRequests: 0 };
    if (decision.kind === 'pause') {
      if (!ctx.dryRun) {
        await writeActivity(paths, decision.activity);
        await writeState(paths, { ...state, pauseNoticePending: true });
      }
      return {
        status: 'paused',
        message: `${decision.activity.inactivityDays}日間アプリでの反応がないため、自動運転を一時停止しました（朝に1回だけお知らせを送ります）`,
        aiRequests: 0,
      };
    }
  }
  if (decision.kind === 'run' && !ctx.dryRun) await writeActivity(paths, decision.activity);

  if (state.lastGeneratedDate === today && !ctx.force) {
    return { status: 'already', message: `${today} の DAILY は生成済みです`, aiRequests: 0 };
  }

  const archive = await readJsonFile<ArchiveIndex>(paths.archiveFile, emptyArchive());

  // ---- 収集 ----
  const { items: raw, reports } = await ctx.log.group('情報収集', () =>
    collectAll(config.sources, ctx.fetcher, now, { concurrency: config.pipeline.fetch.concurrency, maxTotal: config.pipeline.collectMaxTotal, log }),
  );
  const okSources = reports.filter((r) => r.ok).length;
  log.info(`収集：${raw.length} 件（情報源 ${okSources}/${reports.length} が成功）`);

  // ---- コードによる絞り込み ----
  const { candidates, stats } = filterCandidates(raw, {
    now,
    archive,
    interests: config.interests,
    maxItemAgeDays: config.pipeline.maxItemAgeDays,
    dedupeLookbackDays: config.pipeline.dedupeLookbackDays,
    maxOutput: config.pipeline.candidatesForAi,
    maxPerSource: config.pipeline.maxPerSourceInCandidates,
  });
  log.info(
    `絞り込み：${stats.input} → ${stats.output} 件（URL重複 ${stats.duplicateUrl} / 過去と重複 ${stats.seenBefore} / 広告・PR ${stats.adOrPr} / 弱い記事 ${stats.weak} / 古い ${stats.tooOld} / 類似タイトル ${stats.similarTitle}）`,
  );
  if (candidates.length < 4) {
    return { status: 'failed', message: `候補が ${candidates.length} 件しかありません（情報源の取得に失敗した可能性）。今日は生成しません`, aiRequests: 0, reports };
  }

  // ---- AI の準備（無料枠の上限） ----
  const inner = ctx.createProvider();
  const isMock = inner.name === 'mock';
  const usedToday = state.aiUsage.date === today ? state.aiUsage.requests : 0;
  const budget = isMock ? 100 : Math.max(0, Math.min(config.pipeline.ai.maxRequestsPerRun, config.pipeline.ai.maxRequestsPerDay - usedToday));
  if (!isMock && budget < 7) {
    return {
      status: 'failed',
      message: `今日の AI リクエスト上限（${config.pipeline.ai.maxRequestsPerDay} 回）に近いため生成しません（使用済み ${usedToday} 回）`,
      aiRequests: 0,
      reports,
    };
  }
  let aiRequests = 0;
  const provider = withLimits(
    inner,
    { ...config.pipeline.ai, maxRequests: budget },
    { onRequest: () => (aiRequests += isMock ? 0 : 1), sleepFn: isMock ? async () => undefined : ctx.sleepFn, log: (m) => log.info(m) },
  );
  const fallback = createMockProvider();
  try {

    // ---- 選定（AI 1 回。予算が足りなければコードの点数で） ----
    const recent = archive.days
      .filter((d) => !d.sample)
      .slice(0, 14)
      .flatMap((d) => d.items.map((i) => i.principleCandidate))
      .filter(Boolean)
      .slice(0, 40);
    let chosen: Chosen[];
    const selectContext = { candidates: candidates.map((c) => ({ key: c.key, category: c.category, title: c.title, score: c.score })) };
    const selectWith = async (p: AIProvider) =>
      parsePicks(
        parseJsonLoose(
          (await p.generate({ task: 'select', system: SYSTEM_PROMPT, prompt: selectPrompt(candidates, recent), json: true, maxOutputTokens: 4096, temperature: 0.3, context: selectContext })).text,
        ),
        candidates,
      );
    try {
      const picks = budget >= 8 || isMock ? await selectWith(provider) : await selectWith(fallback);
      chosen = chooseSeven(picks, candidates, today, config.interests.exploreRatio);
    } catch (e) {
      log.warn(`AI による選定に失敗したため、コードの点数で選びます（${(e as Error).message}）`);
      chosen = chooseSeven(await selectWith(fallback), candidates, today, config.interests.exploreRatio);
    }
    log.info(`選定：${chosen.map((c) => `${c.category}:${c.candidate.key}${c.explore ? '(探索)' : ''}`).join(' ')}`);

    // ---- 記事本文とサムネイル（AI の材料） ----
    const enriched = await mapLimit(chosen, 3, async (ch) => {
      if (ch.candidate.sourceId.startsWith('wikipedia')) return { text: '', image: undefined };
      const res = await ctx.fetcher(ch.candidate.url, { kind: 'article', sourceId: ch.candidate.sourceId });
      if (!res.ok || !/html/i.test(res.contentType || 'text/html')) return { text: '', image: undefined };
      const a = extractArticle(res.text, config.pipeline.ai.articleChars);
      return { text: a.text.length > ch.candidate.summary.length ? a.text : '', image: a.image };
    });

    // ---- 原理分析・ストーリー化（1 件ずつ） ----
    const items: DailyItem[] = [];
    for (let i = 0; i < chosen.length; i++) {
      const ch = chosen[i];
      const id = makeItemId(today, i + 1);
      const meta = { id, date: today, category: ch.category, image: ch.candidate.image ?? enriched[i].image };
      const req = (c: Candidate) => ({
        task: 'analyze',
        system: SYSTEM_PROMPT,
        prompt: analyzePrompt(c, ch.category, enriched[i].text, ch.seed),
        json: true,
        maxOutputTokens: config.pipeline.ai.maxOutputTokens,
        temperature: 0.7,
        context: { title: c.title, summary: enriched[i].text || c.summary, categoryLabel: categoryOf(ch.category).label },
      });
      let item: DailyItem | null = null;
      try {
        const res = await provider.generate(req(ch.candidate));
        item = toDailyItem(parseJsonLoose(res.text), ch.candidate, { ...meta, provider: inner.name });
        if (!isUsable(item)) throw new Error('必要な項目が足りません');
      } catch (e) {
        const reason = e instanceof AIBudgetError ? 'AI の上限に達した' : (e as Error).message.slice(0, 100);
        log.warn(`${id} の分析に失敗したため、仮のテンプレートにします（${reason}）`);
        const res = await fallback.generate(req(ch.candidate));
        item = toDailyItem(parseJsonLoose(res.text), ch.candidate, { ...meta, provider: 'mock' });
      }
      items.push(item);
    }

    // ---- PRINCIPLE OF THE DAY：他分野へ飛ばしやすい原理候補 ----
    const pool = items.filter((i) => i.aiProvider !== 'mock');
    const potd = (pool.length ? pool : items).reduce((best, it) => ((it.transferability ?? 0) > (best.transferability ?? 0) ? it : best));
    const provider_ = items.every((i) => i.aiProvider === 'mock') ? 'mock' : inner.name;
    const daily: DailyFile = { version: 1, date: today, generatedAt: now.toISOString(), provider: provider_, principleOfTheDay: potd.id, items };

    if (!ctx.dryRun) {
      await writeJsonFile(path.join(paths.dailyDir, `${today}.json`), daily);
      await writeJsonFile(paths.archiveFile, upsertArchiveDay(archive, daily, now.toISOString()));
      const next: RunState = {
        ...(await readState(paths)),
        lastGeneratedDate: today,
        aiUsage: { date: today, requests: usedToday + aiRequests },
      };
      await writeState(paths, next);
    }
    return { status: 'generated', message: `${today} の DAILY を生成しました（${items.length}件 / AI ${aiRequests} 回 / ${provider_}）`, daily, aiRequests, reports };
  } catch (e) {
    // 途中で止まっても、使った AI の回数は必ず記録する（1 日の上限を守るため）
    if (!ctx.dryRun && aiRequests > 0) {
      const s = await readState(paths);
      await writeState(paths, { ...s, aiUsage: { date: today, requests: usedToday + aiRequests } });
    }
    throw e;
  }
}
