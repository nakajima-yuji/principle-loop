// AI の選定結果（最大14件）から、最終 7 件（1 分野 1 件）を決める。
// 7 件のうち「異物」と、日替わりの 1 分野を「探索枠」にして、興味から少し離れたものを選ぶ
// （おおよそ 興味 70〜80% : 未知 20〜30%）。

import { CATEGORY_IDS, isCategoryId } from '../../src/shared/categories.ts';
import type { CategoryId } from '../../src/shared/types.ts';
import type { Candidate } from '../filter/filter.ts';

export interface Pick {
  key: string;
  category: CategoryId;
  aiScore: number;
  seed: string;
}

export interface Chosen {
  candidate: Candidate;
  category: CategoryId;
  seed: string;
  explore: boolean;
}

export function parsePicks(raw: unknown, candidates: readonly Candidate[]): Pick[] {
  const list = (raw as { picks?: unknown[] })?.picks;
  if (!Array.isArray(list)) return [];
  const keys = new Set(candidates.map((c) => c.key));
  const out: Pick[] = [];
  for (const p of list) {
    const r = p as Record<string, unknown>;
    const key = typeof r.key === 'string' ? r.key.trim() : '';
    if (!keys.has(key) || out.some((x) => x.key === key)) continue;
    const scores = (r.scores && typeof r.scores === 'object' ? r.scores : {}) as Record<string, unknown>;
    const aiScore = Object.values(scores).reduce<number>((a, v) => a + (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(5, v)) : 0), 0);
    const fallbackCat = candidates.find((c) => c.key === key)?.category ?? 'foreign';
    out.push({ key, category: isCategoryId(r.category) ? r.category : fallbackCat, aiScore, seed: typeof r.seed === 'string' ? r.seed.slice(0, 60) : '' });
  }
  return out;
}

/** 日替わりで探索枠にする分野（異物以外の 6 分野を順番に回す） */
export function exploreCategory(dateString: string): CategoryId {
  const [y, m, d] = dateString.split('-').map(Number);
  const dayIndex = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  const normal = CATEGORY_IDS.filter((c) => c !== 'foreign');
  return normal[dayIndex % normal.length];
}

export function chooseSeven(picks: readonly Pick[], candidates: readonly Candidate[], dateString: string, exploreRatio = 0.25): Chosen[] {
  const byKey = new Map(candidates.map((c) => [c.key, c]));
  const used = new Set<string>();
  const result: Chosen[] = [];
  const exploreCat = exploreRatio > 0 ? exploreCategory(dateString) : null;

  for (const cat of CATEGORY_IDS) {
    const options = picks
      .filter((p) => p.category === cat && !used.has(p.key))
      .map((p) => ({ p, c: byKey.get(p.key) }))
      .filter((x): x is { p: Pick; c: Candidate } => Boolean(x.c));
    const explore = cat === 'foreign' || cat === exploreCat;
    let chosen: { p?: Pick; c: Candidate } | undefined;
    if (options.length) {
      // 通常：AI の点数 + 興味。探索枠：AI の点数がほぼ同じなら、興味から遠い方
      const ranked = [...options].sort((a, b) =>
        explore ? b.p.aiScore - b.c.interest * 2 - (a.p.aiScore - a.c.interest * 2) : b.p.aiScore + b.c.score - (a.p.aiScore + a.c.score),
      );
      chosen = ranked[0];
    } else {
      // AI が選ばなかった分野は、コードの点数で補う
      const fallback = candidates.filter((c) => c.category === cat && !used.has(c.key)).sort((a, b) => b.score - a.score)[0];
      if (fallback) chosen = { c: fallback };
    }
    if (chosen) {
      used.add(chosen.c.key);
      result.push({ candidate: chosen.c, category: cat, seed: chosen.p?.seed ?? '', explore });
    }
  }

  // それでも 7 件に満たなければ、残りの良い候補で埋める（本来の分野のまま）
  if (result.length < CATEGORY_IDS.length) {
    const rest = [
      ...picks.map((p) => byKey.get(p.key)).filter((c): c is Candidate => Boolean(c)),
      ...[...candidates].sort((a, b) => b.score - a.score),
    ];
    for (const c of rest) {
      if (result.length >= CATEGORY_IDS.length) break;
      if (used.has(c.key)) continue;
      used.add(c.key);
      result.push({ candidate: c, category: c.category, seed: '', explore: false });
    }
  }
  return result;
}
