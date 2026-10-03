// 情報源ごとの取得。公開 RSS / arXiv / Hacker News / GitHub / Wikipedia。
// X API には依存しない（X の投稿はアプリの「URL から掘る」で扱う）。

import { jstDateString } from '../../src/shared/time.ts';
import type { CategoryId } from '../../src/shared/types.ts';
import type { SourceDef } from '../lib/config.ts';
import type { Logger } from '../lib/log.ts';
import { mapLimit, type Fetcher } from './fetch.ts';
import { oneLine } from './html.ts';
import { parseFeed } from './rss.ts';

export interface RawItem {
  sourceId: string;
  sourceName: string;
  category: CategoryId;
  classify: boolean;
  foreign: boolean;
  evergreen: boolean;
  allowShort: boolean;
  weight: number;
  lang: string;
  title: string;
  url: string;
  summary: string;
  published: string;
  image?: string;
  points?: number;
}

export interface SourceReport {
  id: string;
  ok: boolean;
  count: number;
  message?: string;
}

function base(s: SourceDef): Omit<RawItem, 'title' | 'url' | 'summary' | 'published'> {
  return {
    sourceId: s.id,
    sourceName: s.name,
    category: s.category,
    classify: Boolean(s.classify),
    foreign: Boolean(s.foreign),
    evergreen: Boolean(s.evergreen),
    allowShort: Boolean(s.allowShort),
    weight: typeof s.weight === 'number' ? s.weight : 1,
    lang: s.lang ?? 'en',
  };
}

async function collectRss(s: SourceDef, fetcher: Fetcher): Promise<RawItem[]> {
  const res = await fetcher(s.url ?? '', { sourceId: s.id, kind: 'feed' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseFeed(res.text)
    .slice(0, s.max ?? 15)
    .map((it) => ({ ...base(s), title: it.title, url: it.link, summary: it.summary, published: it.published, image: it.image }));
}

interface HnHit {
  title?: string;
  url?: string;
  points?: number;
  created_at?: string;
  objectID?: string;
  story_text?: string;
}

async function collectHn(s: SourceDef, fetcher: Fetcher, now: Date): Promise<RawItem[]> {
  const since = Math.floor(now.getTime() / 1000) - 36 * 3600;
  const minPoints = s.minPoints ?? 100;
  const url = `https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=60&numericFilters=created_at_i>${since},points>${minPoints}`;
  const res = await fetcher(url, { sourceId: s.id, kind: 'feed' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const hits = ((JSON.parse(res.text) as { hits?: HnHit[] }).hits ?? []).filter((h) => h.title && h.url);
  return hits
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, s.max ?? 30)
    .map((h) => ({
      ...base(s),
      title: oneLine(h.title ?? ''),
      url: h.url ?? '',
      summary: oneLine(h.story_text ?? ''),
      published: h.created_at ?? '',
      points: h.points,
    }));
}

interface GhRepo {
  full_name?: string;
  description?: string | null;
  html_url?: string;
  stargazers_count?: number;
  language?: string | null;
  topics?: string[];
  created_at?: string;
  fork?: boolean;
}

async function collectGithub(s: SourceDef, fetcher: Fetcher, now: Date): Promise<RawItem[]> {
  const since = jstDateString(new Date(now.getTime() - 7 * 24 * 3600 * 1000));
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(`created:>${since} stars:>40`)}&sort=stars&order=desc&per_page=30`;
  const token = process.env.GITHUB_TOKEN;
  const res = await fetcher(url, {
    sourceId: s.id,
    kind: 'feed',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const repos = ((JSON.parse(res.text) as { items?: GhRepo[] }).items ?? []).filter((r) => r.full_name && r.html_url && !r.fork && r.description);
  return repos.slice(0, s.max ?? 15).map((r) => ({
    ...base(s),
    title: `${r.full_name}: ${oneLine(r.description ?? '')}`.slice(0, 200),
    url: r.html_url ?? '',
    summary: [oneLine(r.description ?? ''), r.topics?.length ? `topics: ${r.topics.join(', ')}` : '', r.language ? `language: ${r.language}` : '', `stars: ${r.stargazers_count ?? 0}`]
      .filter(Boolean)
      .join(' / '),
    published: r.created_at ?? '',
    image: `https://opengraph.githubassets.com/1/${r.full_name}`,
  }));
}

interface WikiPage {
  titles?: { normalized?: string };
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
  thumbnail?: { source?: string };
}

async function collectWikipedia(s: SourceDef, fetcher: Fetcher, now: Date): Promise<RawItem[]> {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const res = await fetcher(`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${y}/${m}/${d}`, { sourceId: s.id, kind: 'feed' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = JSON.parse(res.text) as { tfa?: WikiPage; onthisday?: { text?: string; year?: number; pages?: WikiPage[] }[] };
  const out: RawItem[] = [];
  const push = (p: WikiPage | undefined, title?: string) => {
    const url = p?.content_urls?.desktop?.page;
    if (!p || !url || !p.extract) return;
    out.push({ ...base(s), title: oneLine(title ?? p.titles?.normalized ?? ''), url, summary: oneLine(p.extract), published: '', image: p.thumbnail?.source });
  };
  push(body.tfa);
  for (const e of body.onthisday ?? []) {
    push(e.pages?.[0], e.year && e.text ? `${e.year}: ${oneLine(e.text)}` : undefined);
  }
  return out.slice(0, s.max ?? 8);
}

export async function collectAll(
  sources: readonly SourceDef[],
  fetcher: Fetcher,
  now: Date,
  opts: { concurrency: number; maxTotal: number; log: Logger },
): Promise<{ items: RawItem[]; reports: SourceReport[] }> {
  const reports: SourceReport[] = [];
  const results = await mapLimit(sources, opts.concurrency, async (s) => {
    try {
      const items =
        s.type === 'rss'
          ? await collectRss(s, fetcher)
          : s.type === 'hn'
            ? await collectHn(s, fetcher, now)
            : s.type === 'github'
              ? await collectGithub(s, fetcher, now)
              : await collectWikipedia(s, fetcher, now);
      reports.push({ id: s.id, ok: true, count: items.length });
      return items;
    } catch (e) {
      reports.push({ id: s.id, ok: false, count: 0, message: (e as Error).message.slice(0, 120) });
      opts.log.warn(`情報源 ${s.id} を取得できませんでした（${(e as Error).message.slice(0, 80)}）。他の情報源で続けます。`);
      return [];
    }
  });
  // 特定の情報源に偏らないよう、各情報源から順番に1件ずつ取り出して上限までそろえる
  const items: RawItem[] = [];
  const longest = Math.max(0, ...results.map((r) => r.length));
  for (let i = 0; i < longest && items.length < opts.maxTotal; i++) {
    for (const list of results) {
      if (list[i] && items.length < opts.maxTotal) items.push(list[i]);
    }
  }
  return { items, reports };
}
