// RSS 2.0 / RSS 1.0（RDF）/ Atom を読む小さなパーサー。
// フィードの形は情報源ごとにばらつくので、「取れるものを取る」寛容な作りにしている。

import { attr, decodeEntities, htmlToText, oneLine, stripCdata } from './html.ts';

export interface FeedItem {
  title: string;
  link: string;
  summary: string;
  published: string; // ISO（読めなければ ''）
  image?: string;
}

function inner(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
  const m = re.exec(block);
  return m ? m[1] : undefined;
}

function textOf(block: string, ...tags: string[]): string {
  for (const t of tags) {
    const v = inner(block, t);
    if (v !== undefined && v.trim()) return v;
  }
  return '';
}

function toIso(s: string): string {
  const t = Date.parse(oneLine(stripCdata(s)));
  return Number.isNaN(t) ? '' : new Date(t).toISOString();
}

function findImage(block: string, html: string): string | undefined {
  const candidates: (string | undefined)[] = [];
  for (const m of block.matchAll(/<media:(?:thumbnail|content)\b[^>]*>/gi)) {
    const type = attr(m[0], 'type') ?? '';
    const medium = attr(m[0], 'medium') ?? '';
    if (!type || type.startsWith('image') || medium === 'image' || /thumbnail/i.test(m[0])) candidates.push(attr(m[0], 'url'));
  }
  for (const m of block.matchAll(/<enclosure\b[^>]*>/gi)) {
    if ((attr(m[0], 'type') ?? '').startsWith('image')) candidates.push(attr(m[0], 'url'));
  }
  const img = /<img\b[^>]*>/i.exec(decodeEntities(stripCdata(html)));
  if (img) candidates.push(attr(img[0], 'src'));
  return candidates.find((u) => u && /^https?:\/\//.test(u));
}

function atomLink(block: string): string {
  let fallback = '';
  for (const m of block.matchAll(/<link\b[^>]*>/gi)) {
    const href = attr(m[0], 'href');
    if (!href) continue;
    const rel = attr(m[0], 'rel') ?? 'alternate';
    if (rel === 'alternate') return href;
    fallback ||= href;
  }
  return fallback;
}

export function parseFeed(xml: string): FeedItem[] {
  const isAtom = /<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  const blocks = isAtom
    ? [...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)].map((m) => m[0])
    : [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map((m) => m[0]);

  const items: FeedItem[] = [];
  for (const b of blocks) {
    const title = oneLine(htmlToText(textOf(b, 'title')));
    const rawLink = isAtom ? atomLink(b) : oneLine(decodeEntities(stripCdata(textOf(b, 'link')))) || attr(/<item\b[^>]*>/i.exec(b)?.[0] ?? '', 'rdf:about') || '';
    const guid = oneLine(decodeEntities(stripCdata(textOf(b, 'guid'))));
    const link = /^https?:\/\//.test(rawLink) ? rawLink : /^https?:\/\//.test(guid) ? guid : '';
    const html = textOf(b, 'description', 'summary', 'content:encoded', 'content');
    const summary = oneLine(htmlToText(html));
    const published = toIso(textOf(b, 'pubDate', 'published', 'updated', 'dc:date'));
    if (!title || !link) continue;
    items.push({ title, link, summary, published, image: findImage(b, html + textOf(b, 'content:encoded')) });
  }
  return items;
}
