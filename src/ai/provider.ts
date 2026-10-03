// AI は交換可能な構造にする。夜間処理（GitHub Actions 上の Node.js）だけが使い、
// ブラウザのコードからは import しない（API キーをフロントに出さないため）。
//
// 新しい AI を足すときは AIProvider を満たすファイルを作り、index.ts の createProvider に 1 行足す。

export interface AIRequest {
  /** 'select'（候補選び）/ 'analyze'（1件の分析）など。mock が使う */
  task: string;
  system: string;
  prompt: string;
  json: boolean;
  maxOutputTokens: number;
  temperature?: number;
  /** mock 用の構造化された材料（本物の AI には送らない） */
  context?: unknown;
}

export interface AIResponse {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generate(req: AIRequest): Promise<AIResponse>;
}

/** 一時的なエラー（429・5xx・通信断）は再試行してよい */
export class AIError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  constructor(message: string, status: number, retryable: boolean, retryAfterMs?: number) {
    super(message);
    this.name = 'AIError';
    this.status = status;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

export class AIBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIBudgetError';
  }
}

export interface AILimits {
  /** この実行で許す最大リクエスト数（再試行も 1 回と数える） */
  maxRequests: number;
  /** リクエストの最小間隔（無料枠の RPM を守る） */
  minIntervalMs: number;
  /** 1 リクエストあたりの再試行回数の上限 */
  maxRetries: number;
  /** プロンプトの最大文字数（これを超えた分は切る） */
  maxPromptChars: number;
  /** 1 回の応答の最大トークン数 */
  maxOutputTokens: number;
}

export interface LimitedProvider extends AIProvider {
  readonly used: () => number;
  readonly remaining: () => number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 無料枠を守るための包み紙。上限回数・間隔・再試行・文字数をここで強制する。
 * onRequest は実際に AI へ送るたびに呼ばれる（日ごとの使用量の記録に使う）。
 */
export function withLimits(
  inner: AIProvider,
  limits: AILimits,
  opts: { onRequest?: () => void; sleepFn?: (ms: number) => Promise<void>; log?: (msg: string) => void } = {},
): LimitedProvider {
  let used = 0;
  let last = 0;
  const wait = opts.sleepFn ?? sleep;

  return {
    name: inner.name,
    model: inner.model,
    used: () => used,
    remaining: () => Math.max(0, limits.maxRequests - used),
    async generate(req: AIRequest): Promise<AIResponse> {
      const prompt = req.prompt.length > limits.maxPromptChars ? `${req.prompt.slice(0, limits.maxPromptChars)}\n…（長いので省略）` : req.prompt;
      const capped: AIRequest = { ...req, prompt, maxOutputTokens: Math.min(req.maxOutputTokens, limits.maxOutputTokens) };
      let attempt = 0;
      for (;;) {
        if (used >= limits.maxRequests) {
          throw new AIBudgetError(`AI リクエストの上限（${limits.maxRequests} 回）に達しました`);
        }
        const gap = Date.now() - last;
        if (last && gap < limits.minIntervalMs) await wait(limits.minIntervalMs - gap);
        used += 1;
        last = Date.now();
        opts.onRequest?.();
        try {
          return await inner.generate(capped);
        } catch (e) {
          const err = e instanceof AIError ? e : new AIError(e instanceof Error ? e.message : String(e), 0, true);
          if (!err.retryable || attempt >= limits.maxRetries) throw err;
          attempt += 1;
          const backoff = Math.min(60_000, err.retryAfterMs ?? 2000 * 2 ** attempt);
          opts.log?.(`AI 再試行 ${attempt}/${limits.maxRetries}（${err.message}）${Math.round(backoff / 1000)}秒待ちます`);
          await wait(backoff);
        }
      }
    },
  };
}

/** AI の返答から JSON を取り出す（```json で囲まれていても、前後に文があっても読む） */
export function parseJsonLoose<T = unknown>(text: string): T {
  const cleaned = text.replace(/^﻿/, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // 続けて抜き出しを試す
  }
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(cleaned);
  if (fence) {
    try {
      return JSON.parse(fence[1]) as T;
    } catch {
      // 続けて試す
    }
  }
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
  throw new SyntaxError('AI の応答から JSON を読み取れませんでした');
}
