import type { ArchiveDay, ArchiveEntry, ArchiveIndex, DailyFile, DailyItem } from './types.ts';

export function emptyArchive(): ArchiveIndex {
  return { version: 1, updatedAt: '', days: [] };
}

export function toArchiveEntry(item: DailyItem): ArchiveEntry {
  return {
    id: item.id,
    date: item.date,
    category: item.category,
    title: item.title,
    hook: item.hook,
    principleCandidate: item.principleCandidate,
    minimumStructure: item.minimumStructure,
    sourceTitle: item.sourceTitle,
    sourceUrl: item.sourceUrl,
    sourceName: item.sourceName,
    tags: item.tags,
  };
}

/** その日の DAILY を索引に追加（同じ日付があれば置き換え）。新しい日付が先頭。 */
export function upsertArchiveDay(index: ArchiveIndex, daily: DailyFile, updatedAt: string): ArchiveIndex {
  const day: ArchiveDay = {
    date: daily.date,
    principleOfTheDay: daily.principleOfTheDay,
    sample: daily.sample,
    items: daily.items.map(toArchiveEntry),
  };
  // 本物の DAILY が 1 日でもできたら、初期のサンプル日は索引から外す
  const others = index.days.filter((d) => d.date !== daily.date && !(d.sample && !daily.sample));
  const days = [day, ...others].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { version: 1, updatedAt, days };
}

export function latestDate(index: ArchiveIndex): string | null {
  return index.days[0]?.date ?? null;
}
