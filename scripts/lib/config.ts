import path from 'node:path';
import { isCategoryId } from '../../src/shared/categories.ts';
import type { CategoryId } from '../../src/shared/types.ts';
import { readJsonFile } from './fsutil.ts';

export type SourceType = 'rss' | 'hn' | 'github' | 'wikipedia';

export interface SourceDef {
  id: string;
  name: string;
  type: SourceType;
  url?: string;
  category: CategoryId;
  classify?: boolean;
  foreign?: boolean;
  evergreen?: boolean;
  allowShort?: boolean;
  weight?: number;
  max?: number;
  minPoints?: number;
  lang?: string;
  enabled?: boolean;
}

export interface Interests {
  keywords: string[];
  maxBoost: number;
  exploreRatio: number;
}

export interface PipelineConfig {
  inactivityLimitDays: number;
  collectMaxTotal: number;
  candidatesForAi: number;
  maxItemAgeDays: number;
  dedupeLookbackDays: number;
  maxPerSourceInCandidates: number;
  ai: {
    maxRequestsPerRun: number;
    maxRequestsPerDay: number;
    maxRetries: number;
    minIntervalMs: number;
    maxPromptChars: number;
    maxOutputTokens: number;
    articleChars: number;
  };
  fetch: { timeoutMs: number; maxBytes: number; concurrency: number };
}

export interface Config {
  sources: SourceDef[];
  interests: Interests;
  pipeline: PipelineConfig;
}

export const DEFAULT_PIPELINE: PipelineConfig = {
  inactivityLimitDays: 10,
  collectMaxTotal: 160,
  candidatesForAi: 30,
  maxItemAgeDays: 10,
  dedupeLookbackDays: 180,
  maxPerSourceInCandidates: 4,
  ai: {
    maxRequestsPerRun: 12,
    maxRequestsPerDay: 20,
    maxRetries: 2,
    minIntervalMs: 6500,
    maxPromptChars: 14000,
    maxOutputTokens: 8192,
    articleChars: 3500,
  },
  fetch: { timeoutMs: 15000, maxBytes: 3_000_000, concurrency: 4 },
};

/** 環境変数（GitHub の Variables）で数値の上限を上書きする。変な値は無視する。 */
function envInt(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function applyEnvOverrides(p: PipelineConfig, env: NodeJS.ProcessEnv): PipelineConfig {
  return {
    ...p,
    inactivityLimitDays: envInt(env, 'INACTIVITY_LIMIT_DAYS', p.inactivityLimitDays, 1, 60),
    candidatesForAi: envInt(env, 'CANDIDATES_FOR_AI', p.candidatesForAi, 7, 60),
    ai: {
      ...p.ai,
      // 1 回の実行で使う上限は、7 件の分析 + 選定 + 予備 を下回らないようにしつつ、30 を超えさせない
      maxRequestsPerRun: envInt(env, 'AI_MAX_REQUESTS_PER_RUN', p.ai.maxRequestsPerRun, 1, 30),
      maxRequestsPerDay: envInt(env, 'AI_MAX_REQUESTS_PER_DAY', p.ai.maxRequestsPerDay, 1, 60),
      maxRetries: envInt(env, 'AI_MAX_RETRIES', p.ai.maxRetries, 0, 4),
      minIntervalMs: envInt(env, 'AI_MIN_INTERVAL_MS', p.ai.minIntervalMs, 0, 120_000),
      maxPromptChars: envInt(env, 'AI_MAX_PROMPT_CHARS', p.ai.maxPromptChars, 2000, 60_000),
      maxOutputTokens: envInt(env, 'AI_MAX_OUTPUT_TOKENS', p.ai.maxOutputTokens, 512, 32_000),
    },
  };
}

function sanitizeSources(raw: unknown): SourceDef[] {
  const list = (raw as { sources?: unknown[] })?.sources;
  if (!Array.isArray(list)) return [];
  return list
    .filter((s): s is SourceDef => {
      const x = s as Partial<SourceDef>;
      return (
        typeof x?.id === 'string' &&
        typeof x.name === 'string' &&
        ['rss', 'hn', 'github', 'wikipedia'].includes(x.type as string) &&
        isCategoryId(x.category) &&
        (x.type !== 'rss' || typeof x.url === 'string')
      );
    })
    .filter((s) => s.enabled !== false);
}

export async function loadConfig(configDir: string, env: NodeJS.ProcessEnv = process.env): Promise<Config> {
  const sources = sanitizeSources(await readJsonFile(path.join(configDir, 'sources.json'), { sources: [] }));
  const interestsRaw = await readJsonFile<Partial<Interests>>(path.join(configDir, 'interests.json'), {});
  const pipelineRaw = await readJsonFile<Partial<PipelineConfig>>(path.join(configDir, 'pipeline.json'), {});
  const pipeline: PipelineConfig = {
    ...DEFAULT_PIPELINE,
    ...pipelineRaw,
    ai: { ...DEFAULT_PIPELINE.ai, ...(pipelineRaw.ai ?? {}) },
    fetch: { ...DEFAULT_PIPELINE.fetch, ...(pipelineRaw.fetch ?? {}) },
  };
  return {
    sources,
    interests: {
      keywords: Array.isArray(interestsRaw.keywords) ? interestsRaw.keywords.filter((k) => typeof k === 'string' && k.trim()) : [],
      maxBoost: typeof interestsRaw.maxBoost === 'number' ? Math.max(0, Math.min(5, interestsRaw.maxBoost)) : 2,
      exploreRatio: typeof interestsRaw.exploreRatio === 'number' ? Math.max(0, Math.min(0.5, interestsRaw.exploreRatio)) : 0.25,
    },
    pipeline: applyEnvOverrides(pipeline, env),
  };
}
