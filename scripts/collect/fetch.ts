// 外部への取得はすべてここを通す（タイムアウト・サイズ上限・User-Agent をそろえる）。
// テストでは Fetcher を差し替えて、ネットにつながずに動かす。

import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface FetchHint {
  sourceId?: string;
  kind?: 'feed' | 'article';
  headers?: Record<string, string>;
}

export interface FetchResult {
  ok: boolean;
  status: number;
  text: string;
  contentType: string;
}

export type Fetcher = (url: string, hint?: FetchHint) => Promise<FetchResult>;

export function userAgent(): string {
  const repo = process.env.GITHUB_REPOSITORY;
  return `PrincipleLoopBot/0.1 (+https://github.com/${repo || 'principle-loop'})`;
}

export function createHttpFetcher(opts: { timeoutMs: number; maxBytes: number }): Fetcher {
  return async (url, hint) => {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': userAgent(),
          Accept:
            hint?.kind === 'article'
              ? 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5'
              : 'application/rss+xml, application/atom+xml, application/xml;q=0.9, application/json;q=0.9, text/xml;q=0.8, */*;q=0.5',
          ...(hint?.headers ?? {}),
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(opts.timeoutMs),
      });
      const contentType = res.headers.get('content-type') ?? '';
      const declared = Number(res.headers.get('content-length') ?? 0);
      if (declared > opts.maxBytes) return { ok: false, status: 413, text: '', contentType };
      const buf = await res.arrayBuffer();
      if (buf.byteLength > opts.maxBytes) return { ok: false, status: 413, text: '', contentType };
      const text = new TextDecoder('utf-8').decode(buf);
      return { ok: res.ok, status: res.status, text, contentType };
    } catch (e) {
      return { ok: false, status: 0, text: (e as Error).message, contentType: '' };
    }
  };
}

/** tests/fixtures/feeds/<sourceId>.(xml|json) を返す。記事ページは常に 404。 */
export function createFixtureFetcher(dir: string): Fetcher {
  return async (_url, hint) => {
    if (hint?.kind === 'article' || !hint?.sourceId) return { ok: false, status: 404, text: '', contentType: '' };
    for (const ext of ['xml', 'json']) {
      try {
        const text = await readFile(path.join(dir, `${hint.sourceId}.${ext}`), 'utf8');
        return { ok: true, status: 200, text, contentType: ext === 'json' ? 'application/json' : 'application/xml' };
      } catch {
        // 次の拡張子
      }
    }
    return { ok: false, status: 404, text: '', contentType: '' };
  };
}

/** 同時に動かす数を絞って並列実行する */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
