// AI に渡す前に、コードでできることはコードでやる（無料枠の節約）。
// 重複除去・同一URL・類似タイトル・同一分野の偏り・広告・PR・弱い記事・情報量の少ないもの を落とし、
// 「ニュース価値」ではなく「原理としての価値」が高そうなものに点数をつけて 30 件程度に絞る。

import { CATEGORY_IDS } from '../../src/shared/categories.ts';
import type { ArchiveIndex, CategoryId } from '../../src/shared/types.ts';
import { textSimilarity } from '../../src/lib/text.ts';
import type { RawItem } from '../collect/sources.ts';

export interface Candidate {
  key: string; // c01, c02 …（AI とのやり取りで使う短い ID）
  sourceId: string;
  sourceName: string;
  category: CategoryId;
  foreign: boolean;
  title: string;
  url: string;
  summary: string;
  published: string;
  image?: string;
  lang: string;
  score: number; // 原理としての価値（コードによる推定）
  interest: number; // 興味キーワードとの一致（0〜）
}

export interface FilterStats {
  input: number;
  noTitleOrUrl: number;
  duplicateUrl: number;
  seenBefore: number;
  adOrPr: number;
  weak: number;
  tooOld: number;
  similarTitle: number;
  output: number;
}

// ---------------- URL ----------------

const TRACKING = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|ref_src$|cmpid$|ocid$|src$|rss$|feed$)/i;

export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = '';
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    [...u.searchParams.keys()].forEach((k) => {
      if (TRACKING.test(k)) u.searchParams.delete(k);
    });
    let s = `${u.hostname}${u.pathname.replace(/\/+$/, '')}`;
    const q = u.searchParams.toString();
    if (q) s += `?${q}`;
    // arXiv は版違い（v1, v2）を同じものとして扱う
    s = s.replace(/^(arxiv\.org\/abs\/[\d.]+)v\d+$/, '$1');
    return s;
  } catch {
    return raw.trim().toLowerCase();
  }
}

// ---------------- 広告・PR・弱い記事 ----------------

const AD_PATTERNS: RegExp[] = [
  /\bsponsored\b/i,
  /\badvertorial\b/i,
  /\bpartner content\b/i,
  /\bpaid (post|content)\b/i,
  /\bpress release\b/i,
  /\bpromo(tion)? code\b/i,
  /\bcoupon\b/i,
  /\b\d+% off\b/i,
  /\b(black friday|cyber monday|prime day)\b/i,
  /\bbest .{0,30} deals?\b/i,
  /\bdeals? (on|of the)\b/i,
  /\bgiveaway\b/i,
  /\bwebinar\b/i,
  /\b(buy now|limited time)\b/i,
  /【PR】|\[PR\]|＜PR＞|<PR>|PR:|（PR）|\(PR\)/,
  /提供記事|タイアップ|広告企画|プロモーション|クーポン|セール情報|お買い得|割引中|キャンペーン実施/,
];

/** ニュース価値はあっても、原理の材料になりにくいもの */
const NEWSY: RegExp[] = [
  /\b(ceo|cfo|stock|shares|earnings|quarterly|revenue|ipo|valuation|lawsuit|sues|sued|layoffs?|acquires?|acquisition|merger|funding round|raises \$|election|senator|poll shows)\b/i,
  /株価|決算|買収|提訴|選挙|人事|資金調達|上場/,
  /\b(top \d+|\d+ best|best of 20\d\d|ranked)\b/i,
  /\b(review|unboxing|hands-on)\b:?/i,
  /\b(rumou?r|leak(ed)?|spotted)\b/i,
];

/** 構造・仕組み・意外性がありそうなもの */
const PRINCIPLE_HINTS: RegExp[] = [
  /\b(how|why)\b/i,
  /\b(mechanism|principle|structure|pattern|rule|emergen\w*|self-\w+|swarm|collective|feedback|network|trade-?off|constraint|minimal|simple|efficien\w*|optimi[sz]\w*|adapt\w*|evolv\w*|decentrali[sz]\w*|scal(e|ing)|without|instead of|despite|surprising|counterintuitive|paradox|turns out|secret of|reveals?|explains?)\b/i,
  /\b(algorithm|model|simulation|geometry|physics of|material|design|architecture)\b/i,
  /仕組み|なぜ|構造|原理|法則|自己組織|群れ|効率|最適|逆説|意外|謎|秘密|解明|発見/,
];

export function isAdOrPr(title: string, summary: string): boolean {
  const t = `${title} ${summary.slice(0, 300)}`;
  return AD_PATTERNS.some((re) => re.test(t));
}

function isJapanese(s: string): boolean {
  return /[぀-ヿ一-鿿]/.test(s);
}

export function isWeak(item: Pick<RawItem, 'title' | 'summary' | 'allowShort'>): boolean {
  const ja = isJapanese(item.title);
  const minTitle = ja ? 8 : 20;
  if (item.title.length < minTitle) return true;
  if (/^(ask|show|tell) hn\b/i.test(item.title)) return true;
  if (/^(re:|fw:)|^\s*(video|podcast|watch|listen)\s*[:：|]/i.test(item.title)) return true;
  if (item.allowShort) return false;
  const minSummary = ja ? 40 : 80;
  return item.summary.length < minSummary;
}

// ---------------- 分類 ----------------

const KEYWORDS: Record<Exclude<CategoryId, 'foreign'>, RegExp> = {
  nature:
    /\b(animals?|birds?|fish|insects?|ants?|bees?|plants?|trees?|forests?|fung(us|i)|bacteri\w*|microb\w*|cells?|genes?|genom\w*|dna|evolution\w*|species|ecosystem\w*|ocean|coral|whales?|octopus|virus\w*|protein\w*|biolog\w*|predator|prey)\b|生物|動物|植物|昆虫|細胞|進化|生態|微生物|菌|魚|鳥/i,
  tech: /\b(software|code|coding|github|open[- ]source|api|algorithm\w*|llm|neural|robot\w*|compiler|database|rust|python|javascript|linux|browser|chip|gpu|encryption|programming|developer|ai)\b|ソフトウェア|アルゴリズム|ロボット|プログラム|半導体|人工知能/i,
  science:
    /\b(physic\w*|quantum|math\w*|theorem|equation|particles?|galax\w*|stars?|planet\w*|chemi\w*|molecul\w*|crystal\w*|fluid\w*|thermodynamic\w*|entropy|geometr\w*|topolog\w*|astronom\w*|laser|magnet\w*)\b|物理|数学|量子|化学|宇宙|結晶|天文/i,
  mind: /\b(psycholog\w*|behaviou?r\w*|cognit\w*|decisions?|memory|emotion\w*|social|habits?|bias(es)?|attention|sleep|neuro\w*|brain|economics|happiness|motivation|loneliness)\b|心理|行動|認知|記憶|習慣|意思決定|脳/i,
  build:
    /\b(architect\w*|buildings?|bridges?|concrete|materials?|manufactur\w*|factor(y|ies)|3d[- ]print\w*|urban|cit(y|ies)|housing|construction|engineering|steel|timber|wood|furniture|textile)\b|建築|材料|製造|都市|工場|素材|住宅|橋/i,
  culture:
    /\b(histor\w*|ancient|museum|art|artists?|music\w*|games?|gaming|play|culture|cultural|tradition\w*|language|archaeolog\w*|medieval|festival|craft|sports?|literature|myth\w*)\b|歴史|文化|遊び|ゲーム|伝統|美術|考古|音楽|祭/i,
};

export function classify(item: Pick<RawItem, 'title' | 'summary' | 'category' | 'classify'>): CategoryId {
  if (!item.classify) return item.category;
  const text = `${item.title} ${item.summary.slice(0, 400)}`;
  let best: CategoryId = item.category;
  let bestHits = 0;
  for (const cat of Object.keys(KEYWORDS) as (keyof typeof KEYWORDS)[]) {
    const hits = (text.match(new RegExp(KEYWORDS[cat].source, 'gi')) ?? []).length;
    if (hits > bestHits) {
      best = cat;
      bestHits = hits;
    }
  }
  // 弱い一致（1語だけ）なら元の分野のまま
  return bestHits >= 2 || (bestHits === 1 && item.category === 'tech') ? best : item.category;
}

// ---------------- 点数 ----------------

export function interestScore(text: string, keywords: readonly string[]): number {
  const t = text.toLowerCase();
  return keywords.filter((k) => t.includes(k.toLowerCase())).length;
}

export function principleScore(item: Pick<RawItem, 'title' | 'summary' | 'weight' | 'points' | 'published' | 'evergreen'>, now: Date): number {
  const text = `${item.title} ${item.summary}`;
  let s = 1;
  s += PRINCIPLE_HINTS.reduce((acc, re) => acc + (re.test(text) ? 1 : 0), 0);
  s += Math.min(1.5, item.summary.length / 400);
  s -= NEWSY.reduce((acc, re) => acc + (re.test(text) ? 1.5 : 0), 0);
  if (item.points) s += Math.min(1, Math.log10(item.points) - 2);
  if (item.published && !item.evergreen) {
    const ageDays = (now.getTime() - Date.parse(item.published)) / 86_400_000;
    if (Number.isFinite(ageDays)) s -= Math.max(0, ageDays - 2) * 0.1;
  }
  return Math.round(s * (item.weight || 1) * 100) / 100;
}

// ---------------- 全体 ----------------

export interface FilterOptions {
  now: Date;
  archive: ArchiveIndex;
  interests: { keywords: readonly string[]; maxBoost: number };
  maxItemAgeDays: number;
  dedupeLookbackDays: number;
  maxOutput: number;
  maxPerSource: number;
}

export function filterCandidates(raw: readonly RawItem[], o: FilterOptions): { candidates: Candidate[]; stats: FilterStats } {
  const stats: FilterStats = { input: raw.length, noTitleOrUrl: 0, duplicateUrl: 0, seenBefore: 0, adOrPr: 0, weak: 0, tooOld: 0, similarTitle: 0, output: 0 };

  // 過去に扱ったもの（URL と元タイトル）
  const cutoff = new Date(o.now.getTime() - o.dedupeLookbackDays * 86_400_000).toISOString().slice(0, 10);
  const pastUrls = new Set<string>();
  const pastTitles: string[] = [];
  for (const day of o.archive.days) {
    if (day.date < cutoff || day.sample) continue;
    for (const it of day.items) {
      pastUrls.add(canonicalUrl(it.sourceUrl));
      pastTitles.push(it.sourceTitle);
    }
  }

  const seenUrls = new Set<string>();
  type Scored = RawItem & { canonical: string; score: number; interest: number; finalCategory: CategoryId };
  const kept: Scored[] = [];

  for (const it of raw) {
    if (!it.title?.trim() || !/^https?:\/\//.test(it.url ?? '')) {
      stats.noTitleOrUrl++;
      continue;
    }
    const canonical = canonicalUrl(it.url);
    if (seenUrls.has(canonical)) {
      stats.duplicateUrl++;
      continue;
    }
    seenUrls.add(canonical);
    if (pastUrls.has(canonical) || pastTitles.some((t) => textSimilarity(t, it.title, 3) > 0.6)) {
      stats.seenBefore++;
      continue;
    }
    if (isAdOrPr(it.title, it.summary)) {
      stats.adOrPr++;
      continue;
    }
    if (isWeak(it)) {
      stats.weak++;
      continue;
    }
    if (it.published && !it.evergreen) {
      const age = (o.now.getTime() - Date.parse(it.published)) / 86_400_000;
      if (Number.isFinite(age) && age > o.maxItemAgeDays) {
        stats.tooOld++;
        continue;
      }
    }
    const base = principleScore(it, o.now);
    if (base < 0.5) {
      // 人事・株価・決算・宣伝など、ニュース価値はあっても原理の材料になりにくいもの
      stats.weak++;
      continue;
    }
    const interest = interestScore(`${it.title} ${it.summary}`, o.interests.keywords);
    const score = base + Math.min(o.interests.maxBoost, interest * 0.6);
    kept.push({ ...it, canonical, score, interest, finalCategory: it.foreign ? 'foreign' : classify(it) });
  }

  // 似たタイトルは点数の高い方だけ残す
  kept.sort((a, b) => b.score - a.score);
  const unique: Scored[] = [];
  for (const it of kept) {
    if (unique.some((u) => textSimilarity(u.title, it.title, 3) > 0.55)) {
      stats.similarTitle++;
      continue;
    }
    unique.push(it);
  }

  // 分野ごとに均等に、情報源ごとの上限つきで選ぶ（同一分野・同一メディアの偏りを防ぐ）
  const perCategory = Math.max(2, Math.ceil(o.maxOutput / CATEGORY_IDS.length));
  const bySource = new Map<string, number>();
  const byCategory = new Map<CategoryId, number>();
  const chosen: Scored[] = [];
  const take = (it: Scored) => {
    chosen.push(it);
    bySource.set(it.sourceId, (bySource.get(it.sourceId) ?? 0) + 1);
    byCategory.set(it.finalCategory, (byCategory.get(it.finalCategory) ?? 0) + 1);
  };
  for (const it of unique) {
    if (chosen.length >= o.maxOutput) break;
    if ((bySource.get(it.sourceId) ?? 0) >= o.maxPerSource) continue;
    if ((byCategory.get(it.finalCategory) ?? 0) >= perCategory) continue;
    take(it);
  }
  // 足りない分は、分野の上限を外して埋める（情報源の上限は守る）
  for (const it of unique) {
    if (chosen.length >= o.maxOutput) break;
    if (chosen.includes(it) || (bySource.get(it.sourceId) ?? 0) >= o.maxPerSource) continue;
    take(it);
  }

  const candidates: Candidate[] = chosen.map((it, i) => ({
    key: `c${String(i + 1).padStart(2, '0')}`,
    sourceId: it.sourceId,
    sourceName: it.sourceName,
    category: it.finalCategory,
    foreign: it.foreign,
    title: it.title,
    url: it.url,
    summary: it.summary.slice(0, 1200),
    published: it.published,
    image: it.image,
    lang: it.lang,
    score: Math.round(it.score * 100) / 100,
    interest: it.interest,
  }));
  stats.output = candidates.length;
  return { candidates, stats };
}
