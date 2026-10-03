// 公開データ（GitHub Pages に置かれた JSON）を読む。
// public/data/daily/YYYY-MM-DD.json, public/data/archive/index.json, public/data/activity.json

import { useEffect, useState } from 'react';
import { normalizeActivity } from '../shared/activity.ts';
import { withFailureFlags } from '../shared/item-status.ts';
import type { Activity, ArchiveIndex, DailyFile, DailyItem } from '../shared/types.ts';
import { dateFromItemId } from '../shared/time.ts';
import { getPersonal } from './store.ts';

const BASE = './data';

async function getJson<T>(path: string, fresh = false): Promise<T> {
  const url = fresh ? `${BASE}/${path}?t=${Date.now()}` : `${BASE}/${path}`;
  const res = await fetch(url, { cache: fresh ? 'no-store' : 'no-cache' });
  if (!res.ok) throw new Error(`${path} を読み込めませんでした（${res.status}）`);
  return (await res.json()) as T;
}

let archivePromise: Promise<ArchiveIndex> | null = null;
const dailyCache = new Map<string, Promise<DailyFile>>();

export function loadArchive(): Promise<ArchiveIndex> {
  archivePromise ??= getJson<ArchiveIndex>('archive/index.json').catch((e) => {
    archivePromise = null;
    throw e;
  });
  return archivePromise;
}

export function loadDaily(date: string): Promise<DailyFile> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Promise.reject(new Error('日付の形式が正しくありません'));
  let p = dailyCache.get(date);
  if (!p) {
    p = getJson<DailyFile>(`daily/${date}.json`).then(withFailureFlags).catch((e) => {
      dailyCache.delete(date);
      throw e;
    });
    dailyCache.set(date, p);
  }
  return p;
}

export async function loadLatestDaily(): Promise<DailyFile> {
  const index = await loadArchive();
  const latest = index.days[0]?.date;
  if (!latest) throw new Error('まだ DAILY がありません');
  return loadDaily(latest);
}

export async function loadActivity(): Promise<Activity> {
  return normalizeActivity(await getJson<unknown>('activity.json', true));
}

/** id から 1 件を探す。DAILY → DIARY の順（DIARY には手動で追加した現象も入っている） */
export async function loadItem(id: string): Promise<DailyItem> {
  const saved = getPersonal().diary.find((d) => d.id === id);
  const date = dateFromItemId(id);
  if (date) {
    try {
      const daily = await loadDaily(date);
      const found = daily.items.find((i) => i.id === id);
      if (found) return found;
    } catch {
      // 公開データから消えていても、保存済みならそちらを使う
    }
  }
  if (saved) return saved.item;
  throw new Error('この原理が見つかりませんでした');
}

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ data: s.data, error: null, loading: true }));
    fn().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (e: unknown) => alive && setState({ data: null, error: e instanceof Error ? e.message : String(e), loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
