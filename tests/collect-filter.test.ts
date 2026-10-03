import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { emptyArchive } from '../src/shared/archive.ts';
import type { ArchiveIndex } from '../src/shared/types.ts';
import { extractArticle, htmlToText } from '../scripts/collect/html.ts';
import { parseFeed } from '../scripts/collect/rss.ts';
import { collectAll, type RawItem } from '../scripts/collect/sources.ts';
import { createFixtureFetcher } from '../scripts/collect/fetch.ts';
import { canonicalUrl, classify, filterCandidates, isAdOrPr, isWeak } from '../scripts/filter/filter.ts';
import { silentLogger } from '../scripts/lib/log.ts';
import { FIXTURES, MONDAY } from './helpers.ts';

const read = (f: string) => readFile(path.join(FIXTURES, f), 'utf8');

test('RSS 2.0：CDATA・エンティティ・画像を読む', async () => {
  const items = parseFeed(await read('phys-org-biology.xml'));
  assert.equal(items.length, 6);
  assert.match(items[0].title, /^Ants build living bridges/);
  assert.equal(items[0].link, 'https://example.org/news/ant-bridges?utm_source=rss&utm_medium=feed');
  assert.equal(items[0].image, 'https://example.org/img/ants.jpg');
  assert.match(items[0].summary, /simple rule/);
  assert.equal(items[0].published, '2026-10-03T14:00:00.000Z');
});

test('Atom：link の href と HTML 入りの summary を読む', async () => {
  const items = parseFeed(await read('quanta.xml'));
  assert.equal(items.length, 3);
  assert.equal(items[0].link, 'https://example.org/quanta/random-shaking');
  assert.doesNotMatch(items[0].summary, /<p>/);
});

test('RSS 1.0（RDF）と日本語', async () => {
  const items = parseFeed(await read('karapaia.xml'));
  assert.equal(items.length, 2);
  assert.match(items[0].title, /砂丘/);
  assert.equal(items[0].published, '2026-10-04T00:00:00.000Z');
});

test('HTML から本文と og:image を取り出す', () => {
  const html = `<html><head><meta property="og:image" content="https://x.example/a.jpg"><script>var x = "<p>no</p>";</script></head>
  <body><nav><p>Menu menu menu menu menu menu menu menu menu menu</p></nav>
  <p>This is the first real paragraph of the article, long enough to count as text.</p>
  <p>Subscribe to our newsletter to get more stories like this one every week.</p>
  <p>Second paragraph with &amp; entity and enough length to be included in the text.</p></body></html>`;
  const a = extractArticle(html, 1000);
  assert.equal(a.image, 'https://x.example/a.jpg');
  assert.match(a.text, /first real paragraph/);
  assert.match(a.text, /with & entity/);
  assert.doesNotMatch(a.text, /Menu|newsletter|no<\/p>/);
  assert.equal(htmlToText('<b>a</b>&nbsp;&#x41;&#66;'), 'a AB');
});

test('URL の正規化：追跡パラメータ・末尾スラッシュ・www・arXiv の版', () => {
  assert.equal(canonicalUrl('https://www.Example.org/a/b/?utm_source=x&id=3#top'), 'example.org/a/b?id=3');
  assert.equal(canonicalUrl('https://example.org/a/b'), 'example.org/a/b');
  assert.equal(canonicalUrl('https://arxiv.org/abs/2410.01234v3'), canonicalUrl('https://arxiv.org/abs/2410.01234v1'));
});

test('広告・PR と弱い記事を見分ける', () => {
  assert.equal(isAdOrPr('Sponsored: best deals', ''), true);
  assert.equal(isAdOrPr('【PR】新しい掃除機', ''), true);
  assert.equal(isAdOrPr('How ants build bridges', 'A study shows...'), false);
  assert.equal(isWeak({ title: 'Short', summary: 'x'.repeat(200), allowShort: false }), true);
  assert.equal(isWeak({ title: 'Show HN: my tool that does things', summary: '', allowShort: true }), true);
  assert.equal(isWeak({ title: 'A long enough title about something interesting', summary: 'too short', allowShort: false }), true);
  assert.equal(isWeak({ title: 'A long enough title about something interesting', summary: '', allowShort: true }), false);
});

test('分類：classify=true の情報源だけキーワードで振り分ける', () => {
  const base = { summary: 'Researchers studied how birds and fish and insects coordinate in groups.', classify: true };
  assert.equal(classify({ ...base, title: 'Animal groups', category: 'tech' }), 'nature');
  assert.equal(classify({ ...base, title: 'Animal groups', category: 'tech', classify: false }), 'tech');
});

test('収集 → 絞り込み：重複・広告・弱い記事・ニュースだけの記事を落とし、分野と情報源の偏りを抑える', async () => {
  const { items, reports } = await collectAll(
    [
      { id: 'phys-org-biology', name: 'Bio', type: 'rss', url: 'x', category: 'nature' },
      { id: 'sciencedaily-mind', name: 'Mind', type: 'rss', url: 'x', category: 'mind' },
      { id: 'hacker-news', name: 'HN', type: 'hn', category: 'tech', classify: true, allowShort: true },
      { id: 'missing-source', name: 'Missing', type: 'rss', url: 'x', category: 'science' },
    ],
    createFixtureFetcher(FIXTURES),
    MONDAY,
    { concurrency: 2, maxTotal: 100, log: silentLogger },
  );
  assert.equal(reports.find((r) => r.id === 'missing-source')?.ok, false, '1 つ失敗しても全体は止まらない');
  const { candidates, stats } = filterCandidates(items, {
    now: MONDAY,
    archive: emptyArchive(),
    interests: { keywords: ['cache'], maxBoost: 2 },
    maxItemAgeDays: 10,
    dedupeLookbackDays: 180,
    maxOutput: 30,
    maxPerSource: 3,
  });
  const titles = candidates.map((c) => c.title).join('\n');
  assert.equal(stats.duplicateUrl, 1);
  assert.equal(stats.adOrPr, 1);
  assert.doesNotMatch(titles, /Sponsored|Show HN|funding round|earnings/);
  assert.ok(candidates.filter((c) => c.sourceId === 'phys-org-biology').length <= 3, '情報源ごとの上限');
  assert.deepEqual(
    candidates.map((c) => c.key),
    candidates.map((_, i) => `c${String(i + 1).padStart(2, '0')}`),
  );
});

test('過去に扱った URL と似たタイトルは選ばない', () => {
  const archive: ArchiveIndex = {
    version: 1,
    updatedAt: '',
    days: [
      {
        date: '2026-10-01',
        principleOfTheDay: 'x',
        items: [
          {
            id: '20261001-01',
            date: '2026-10-01',
            category: 'nature',
            title: '既出',
            hook: '',
            principleCandidate: '',
            minimumStructure: '',
            sourceTitle: 'Octopus arms make decisions without asking the brain',
            sourceUrl: 'https://example.org/other-url',
          },
          {
            id: '20261001-02',
            date: '2026-10-01',
            category: 'nature',
            title: '既出2',
            hook: '',
            principleCandidate: '',
            minimumStructure: '',
            sourceTitle: 'x',
            sourceUrl: 'https://www.example.org/news/fungal-networks/?utm_source=a',
          },
        ],
      },
    ],
  };
  const raw: RawItem[] = [
    { title: 'Octopus arms make decisions without asking the brain', url: 'https://example.org/a' },
    { title: 'How fungal networks decide which tree gets the nutrients', url: 'https://example.org/news/fungal-networks' },
    { title: 'A completely different story about how bees choose a new home', url: 'https://example.org/b' },
  ].map((x) => ({
    ...x,
    sourceId: 's',
    sourceName: 'S',
    category: 'nature' as const,
    classify: false,
    foreign: false,
    evergreen: false,
    allowShort: false,
    weight: 1,
    lang: 'en',
    summary: 'A long enough summary that explains the mechanism of how this works and why it matters for structure.',
    published: '2026-10-04T00:00:00Z',
  }));
  const { candidates, stats } = filterCandidates(raw, {
    now: MONDAY,
    archive,
    interests: { keywords: [], maxBoost: 0 },
    maxItemAgeDays: 10,
    dedupeLookbackDays: 180,
    maxOutput: 30,
    maxPerSource: 5,
  });
  assert.equal(stats.seenBefore, 2);
  assert.deepEqual(
    candidates.map((c) => c.url),
    ['https://example.org/b'],
  );
});
