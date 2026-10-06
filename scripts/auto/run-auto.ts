import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generateIdeas, generateImage } from './openai.ts';
import { readJsonFile, writeJsonFile } from '../lib/fsutil.ts';
import type { AutoExperimentState, AutoIdeasFile, DailyFile } from '../../src/shared/types.ts';
import type { Config } from '../lib/config.ts';
import type { Paths } from '../lib/paths.ts';
import { jstDateString } from '../../src/shared/time.ts';

const initialState = (date: string): AutoExperimentState => ({
  version: 1,
  startedOn: date,
  experimentDay1: date,
  maxExperimentDays: 7,
  maxDailyImages: 3,
  maxTotalImages: 21,
  monthlyBudgetJpy: 1500,
  totalImages: 0,
  totalTextCalls: 0,
  totalImageCalls: 0,
  stopped: false,
  updatedAt: new Date().toISOString(),
});

function experimentDay(start: string, date: string): number {
  const a = Date.parse(`${start}T00:00:00+09:00`);
  const b = Date.parse(`${date}T00:00:00+09:00`);
  return Math.floor((b - a) / 86_400_000) + 1;
}

function ideaFile(paths: Paths, date: string) {
  return path.join(paths.autoIdeasDir, `${date}.json`);
}

function imageFile(paths: Paths, date: string, category: string) {
  return path.join(paths.autoImagesDir, `${date}-${category.toLowerCase()}.webp`);
}

async function loadDaily(paths: Paths, date: string): Promise<DailyFile | null> {
  return readJsonFile<DailyFile | null>(path.join(paths.dailyDir, `${date}.json`), null);
}

async function feedbackSummary(paths: Paths): Promise<string> {
  const data = await readJsonFile<{ reactions?: { category?: string; reaction?: string; comment?: string }[] }>(paths.jimaFeedbackFile, {});
  return (data.reactions ?? []).slice(-30).map((x) => `${x.reaction ?? ''} ${x.category ?? ''} ${x.comment ?? ''}`.trim()).join('\n');
}

export interface AutoRunResult {
  status: 'generated' | 'skipped' | 'stopped' | 'no-key' | 'no-daily' | 'failed';
  message: string;
  experimentDay?: number;
  textCalls: number;
  imageCalls: number;
}

export async function runAuto({ now, paths, config, dryRun = false, log = console.log }: {
  now: Date;
  paths: Paths;
  config: Config;
  dryRun?: boolean;
  log?: (message: string) => void;
}): Promise<AutoRunResult> {
  const date = jstDateString(now);
  const daily = await loadDaily(paths, date);
  if (!daily?.items?.length) return { status: 'no-daily', message: `${date} の DAILY がないためAUTOを実行しません`, textCalls: 0, imageCalls: 0 };
  const existing = await readJsonFile<AutoIdeasFile | null>(ideaFile(paths, date), null);
  if (existing) return { status: 'skipped', message: `${date} のAUTO結果が既にあるため再生成しません`, experimentDay: existing.experimentDay, textCalls: 0, imageCalls: 0 };

  const state = await readJsonFile<AutoExperimentState | null>(paths.autoExperimentFile, null);
  const current = state ?? initialState(date);
  const day = experimentDay(current.experimentDay1, date);
  if (current.stopped || day > config.pipeline.auto.maxExperimentDays) {
    const stopped = { ...current, stopped: true, stopReason: '7-day experiment completed', updatedAt: new Date().toISOString() };
    if (!dryRun) await writeJsonFile(paths.autoExperimentFile, stopped);
    log('7-day experiment completed');
    return { status: 'stopped', message: '7日間実験が終了しているためOpenAI APIを呼びません', experimentDay: day, textCalls: 0, imageCalls: 0 };
  }
  if (!process.env.OPENAI_API_KEY) return { status: 'no-key', message: 'OPENAI_API_KEY が未設定のためAUTOを実行しません', experimentDay: day, textCalls: 0, imageCalls: 0 };
  if (current.totalImages >= config.pipeline.auto.maxTotalImages) {
    const stopped = { ...current, stopped: true, stopReason: 'maximum image count reached', updatedAt: new Date().toISOString() };
    if (!dryRun) await writeJsonFile(paths.autoExperimentFile, stopped);
    return { status: 'stopped', message: '画像の合計上限に達したため停止しました', experimentDay: day, textCalls: 0, imageCalls: 0 };
  }

  const opts = {
    apiKey: process.env.OPENAI_API_KEY,
    textModel: process.env.AUTO_TEXT_MODEL || config.pipeline.auto.textModel,
    imageModel: process.env.IMAGE_MODEL || config.pipeline.auto.imageModel,
    imageQuality: (process.env.IMAGE_QUALITY || config.pipeline.auto.imageQuality) as 'low' | 'medium' | 'high',
    maxRetries: config.pipeline.auto.maxRetries,
  };
  try {
    const ideas = await generateIdeas(opts, daily, await feedbackSummary(paths));
    const imageLimit = Math.min(config.pipeline.auto.maxDailyImages, config.pipeline.auto.maxTotalImages - current.totalImages, 3);
    let imageCalls = 0;
    const stored = { ...current, totalTextCalls: current.totalTextCalls + 1, totalImages: current.totalImages, totalImageCalls: current.totalImageCalls, updatedAt: new Date().toISOString() };
    if (!dryRun) await writeJsonFile(paths.autoExperimentFile, stored);
    for (const idea of ideas.slice(0, 3)) {
      const target = imageFile(paths, date, idea.category);
      try {
        await readFile(target);
        idea.image_path = `data/auto-images/${date}-${idea.category.toLowerCase()}.webp`;
        continue;
      } catch { /* 未生成なら続ける */ }
      if (imageCalls >= imageLimit) break;
      if (!dryRun) {
        const image = await generateImage(opts, idea.image_prompt);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, image);
      }
      imageCalls += 1;
      idea.image_path = `data/auto-images/${date}-${idea.category.toLowerCase()}.webp`;
      if (!dryRun) {
        await writeJsonFile(paths.autoExperimentFile, { ...stored, totalImages: current.totalImages + imageCalls, totalImageCalls: current.totalImageCalls + imageCalls, updatedAt: new Date().toISOString() });
      }
    }
    const result: AutoIdeasFile = { version: 1, date, experimentDay: day, generatedAt: new Date().toISOString(), ideas, apiCalls: { text: 1, images: imageCalls } };
    if (!dryRun) await writeJsonFile(ideaFile(paths, date), result);
    return { status: 'generated', message: `${date} AUTO: ${ideas.length}案・${imageCalls}画像`, experimentDay: day, textCalls: 1, imageCalls };
  } catch (error) {
    return { status: 'failed', message: `AUTO失敗: ${error instanceof Error ? error.message : String(error)}`, experimentDay: day, textCalls: 1, imageCalls: 0 };
  }
}
