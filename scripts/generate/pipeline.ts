// 夜間の DAILY 生成（00:30〜）。
// 日曜？ → 終了 / paused？ → 終了 / 10日無反応？ → 停止処理 / それ以外 → 収集 → 重複除去 → 分類 → 候補抽出 → 原理分析 → 7件選定 → ストーリー化 → 保存

import path from 'node:path';
import { createMockProvider } from '../../src/ai/mock.ts';
import { AIBudgetError, AIError, parseJsonLoose, withLimits, type AIProvider, type LimitedProvider } from '../../src/ai/provider.ts';
import { decideRun } from '../../src/shared/activity.ts';
import { emptyArchive, upsertArchiveDay } from '../../src/shared/archive.ts';
import { categoryOf } from '../../src/shared/categories.ts';
import { isAnalysisFailed, withFailureFlags } from '../../src/shared/item-status.ts';
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
import { candidateFromItem, isUsable, toDailyItem, toFailedItem } from './normalize.ts';
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

export type GenerateStatus = 'skipped-sunday' | 'skipped-paused' | 'paused' | 'already' | 'repaired' | 'generated' | 'failed';

export interface GenerateResult {
  status: GenerateStatus;
  message: string;
  daily?: DailyFile;
  aiRequests: number;
  reports?: SourceReport[];
}

/** 失敗の理由を、画面とメールに出せる短い日本語にする */
export function describeFailure(e: unknown): string {
  if (e instanceof AIBudgetError) return 'AI の1日の上限に達したため';
  if (e instanceof AIError) {
    if (e.status === 429) return 'AI の利用回数の制限にかかったため';
    if (e.status >= 500 || e.status === 0) return 'AI が混み合っていた・つながらなかったため';
    return 'AI がエラーを返したため';
  }
  if (e instanceof SyntaxError) return 'AI の返答が途中で切れていた・形が崩れていたため';
  if (e instanceof Error && e.message === '必要な項目が足りません') return 'AI の返答に必要な項目が足りなかったため';
  return 'AI の分析でエラーが起きたため';
}

interface AnalyzeInput {
  provider: LimitedProvider;
  providerName: string;
  candidate: Candidate;
  category: DailyItem['category'];
  articleText: string;
  seed: string;
  meta: { id: string; date: string; category: DailyItem['category']; image?: string };
  maxOutputTokens: number;
  /** もう 1 回頼んでも、残りの記事の分の予算が残るか */
  canRetry: () => boolean;
  log: Logger;
}

/** 1 件を分析する。失敗したら予算の範囲で 1 回だけ頼み直し、それでもだめなら「作成中止」にする */
async function analyzeOne(a: AnalyzeInput): Promise<DailyItem> {
  const request = {
    task: 'analyze',
    system: SYSTEM_PROMPT,
    prompt: analyzePrompt(a.candidate, a.category, a.articleText, a.seed),
    json: true,
    maxOutputTokens: a.maxOutputTokens,
    temperature: 0.7,
    context: { title: a.candidate.title, summary: a.articleText || a.candidate.summary, categoryLabel: categoryOf(a.category).label },
  };
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await a.provider.generate(request);
      const item = toDailyItem(parseJsonLoose(res.text), a.candidate, { ...a.meta, provider: a.providerName });
      if (!isUsable(item)) throw new Error('必要な項目が足りません');
      return item;
    } catch (e) {
      lastError = e;
      if (e instanceof AIBudgetError || attempt > 0 || !a.canRetry()) break;
      a.log.info(`${a.meta.id} の分析をもう1回頼みます（${describeFailure(e)}）`);
    }
  }
  const reason = describeFailure(lastError);
  a.log.warn(`${a.meta.id} は作成中止にします（${reason}）`);
  return toFailedItem(a.candidate, a.meta, reason);
}

/** PRINCIPLE OF THE DAY：他分野へ飛ばしやすい原理候補（作成中止・仮のテンプレートは除く） */
function choosePotd(items: readonly DailyItem[]): string {
  const pool = items.filter((i) => !isAnalysisFailed(i) && i.aiProvider !== 'mock');
  const list = pool.length ? pool : items;
  return list.reduce((best, it) => ((it.transferability ?? 0) > (best.transferability ?? 0) ? it : best)).id;
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
    // 生成済み。作成中止の記事があれば、それだけを作り直す（03:10 の再試行で動く）
    return repairToday(ctx, state);
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
      const itemsLeft = chosen.length - i - 1;
      if (isMock) {
        const res = await fallback.generate({
          task: 'analyze',
          system: SYSTEM_PROMPT,
          prompt: '',
          json: true,
          maxOutputTokens: 0,
          context: { title: ch.candidate.title, summary: enriched[i].text || ch.candidate.summary, categoryLabel: categoryOf(ch.category).label },
        });
        const meta = { id: makeItemId(today, i + 1), date: today, category: ch.category, image: ch.candidate.image ?? enriched[i].image, provider: 'mock' };
        items.push(toDailyItem(parseJsonLoose(res.text), ch.candidate, meta));
        continue;
      }
      items.push(
        await analyzeOne({
          provider,
          providerName: inner.name,
          candidate: ch.candidate,
          category: ch.category,
          articleText: enriched[i].text,
          seed: ch.seed,
          meta: { id: makeItemId(today, i + 1), date: today, category: ch.category, image: ch.candidate.image ?? enriched[i].image },
          maxOutputTokens: config.pipeline.ai.maxOutputTokens,
          canRetry: () => provider.remaining() > itemsLeft + 1,
          log,
        }),
      );
    }

    const failed = items.filter(isAnalysisFailed).length;
    const provider_ = isMock ? 'mock' : inner.name;
    const daily: DailyFile = { version: 1, date: today, generatedAt: now.toISOString(), provider: provider_, principleOfTheDay: choosePotd(items), items };

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
    return { status: 'generated', message: `${today} の DAILY を生成しました（${items.length}件${failed ? `・うち作成中止 ${failed} 件` : ''} / AI ${aiRequests} 回 / ${provider_}）`, daily, aiRequests, reports };
  } catch (e) {
    // 途中で止まっても、使った AI の回数は必ず記録する（1 日の上限を守るため）
    if (!ctx.dryRun && aiRequests > 0) {
      const s = await readState(paths);
      await writeState(paths, { ...s, aiUsage: { date: today, requests: usedToday + aiRequests } });
    }
    throw e;
  }
}

/** 作成中止になった記事だけを作り直す（AI の予算の範囲で）。直せたら DAILY と索引を書き換える */
async function repairToday(ctx: RunContext, state: RunState): Promise<GenerateResult> {
  const { now, paths, config, log } = ctx;
  const today = jstDateString(now);
  const file = path.join(paths.dailyDir, `${today}.json`);
  const stored = await readJsonFile<DailyFile | null>(file, null);
  if (!stored) return { status: 'already', message: `${today} の DAILY は生成済みです`, aiRequests: 0 };
  const daily = withFailureFlags(stored);
  const targets = daily.items.filter(isAnalysisFailed);
  if (targets.length === 0) return { status: 'already', message: `${today} の DAILY は生成済みです`, aiRequests: 0 };

  const inner = ctx.createProvider();
  if (inner.name === 'mock') {
    return { status: 'already', message: `${today} は生成済みです（作成中止 ${targets.length} 件。AI が未設定のため作り直しません）`, aiRequests: 0 };
  }
  const usedToday = state.aiUsage.date === today ? state.aiUsage.requests : 0;
  const budget = Math.max(0, Math.min(config.pipeline.ai.maxRequestsPerRun, config.pipeline.ai.maxRequestsPerDay - usedToday));
  if (budget < 1) {
    return { status: 'already', message: `${today} は生成済みです（作成中止 ${targets.length} 件。今日の AI の上限のため作り直しません）`, aiRequests: 0 };
  }

  let aiRequests = 0;
  const provider = withLimits(
    inner,
    { ...config.pipeline.ai, maxRequests: budget },
    { onRequest: () => (aiRequests += 1), sleepFn: ctx.sleepFn, log: (m) => log.info(m) },
  );
  log.info(`作成中止の ${targets.length} 件を作り直します（AI の残り ${budget} 回）`);
  try {
    const repaired = new Map<string, DailyItem>();
    for (let i = 0; i < targets.length; i++) {
      const it = targets[i];
      if (provider.remaining() < 1) break;
      const candidate = candidateFromItem(it);
      const page = /^https?:\/\//.test(candidate.url) ? await ctx.fetcher(candidate.url, { kind: 'article', sourceId: 'repair' }) : null;
      const article = page?.ok && /html/i.test(page.contentType || 'text/html') ? extractArticle(page.text, config.pipeline.ai.articleChars) : null;
      const text = article && article.text.length > candidate.summary.length ? article.text : '';
      const itemsLeft = targets.length - i - 1;
      const next = await analyzeOne({
        provider,
        providerName: inner.name,
        candidate,
        category: it.category,
        articleText: text,
        seed: '',
        meta: { id: it.id, date: it.date, category: it.category, image: it.image ?? article?.image },
        maxOutputTokens: config.pipeline.ai.maxOutputTokens,
        canRetry: () => provider.remaining() > itemsLeft + 1,
        log,
      });
      if (!isAnalysisFailed(next)) repaired.set(it.id, next);
    }

    if (repaired.size > 0 && !ctx.dryRun) {
      const items = daily.items.map((it) => repaired.get(it.id) ?? it);
      const potdFailed = isAnalysisFailed(items.find((i) => i.id === daily.principleOfTheDay) ?? items[0]);
      const next: DailyFile = { ...daily, items, principleOfTheDay: potdFailed ? choosePotd(items) : daily.principleOfTheDay };
      await writeJsonFile(file, next);
      const archive = await readJsonFile<ArchiveIndex>(paths.archiveFile, emptyArchive());
      await writeJsonFile(paths.archiveFile, upsertArchiveDay(archive, next, now.toISOString()));
    }
    return {
      status: repaired.size > 0 ? 'repaired' : 'already',
      message: `作成中止 ${targets.length} 件のうち ${repaired.size} 件を作り直しました（AI ${aiRequests} 回）`,
      aiRequests,
    };
  } finally {
    if (!ctx.dryRun && aiRequests > 0) {
      const s = await readState(paths);
      await writeState(paths, { ...s, aiUsage: { date: today, requests: usedToday + aiRequests } });
    }
  }
}
