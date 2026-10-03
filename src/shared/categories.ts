import type { CategoryId } from './types.ts';

export interface CategoryDef {
  id: CategoryId;
  order: number;
  label: string;
  short: string;
  description: string;
}

// DAILY は 1 カテゴリ 1 件、この順番で並べる。
export const CATEGORIES: readonly CategoryDef[] = [
  { id: 'nature', order: 1, label: '生物・自然', short: '生物', description: '生き物・生態系・自然現象' },
  { id: 'tech', order: 2, label: 'GitHub・技術', short: '技術', description: 'ソフトウェア・ロボット・道具' },
  { id: 'science', order: 3, label: '物理・数学・科学', short: '科学', description: '物理法則・数理・実験科学' },
  { id: 'mind', order: 4, label: '心理・人間行動', short: '心理', description: '認知・行動・集団・社会' },
  { id: 'build', order: 5, label: '建築・製造・材料・都市', short: '建築', description: '建物・ものづくり・素材・都市' },
  { id: 'culture', order: 6, label: '文化・歴史・遊び', short: '文化', description: '歴史・伝統・ゲーム・芸術' },
  { id: 'foreign', order: 7, label: '異物', short: '異物', description: '普段は検索しない世界から' },
];

export const CATEGORY_IDS: readonly CategoryId[] = CATEGORIES.map((c) => c.id);

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value);
}

export function categoryOf(id: CategoryId): CategoryDef {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

/** CONNECT で「遠さ」を測るための大まかな座標（近い分野ほど近い値）。 */
export const CATEGORY_POSITION: Record<CategoryId, number> = {
  nature: 0,
  science: 1,
  tech: 2,
  build: 3,
  mind: 4,
  culture: 5,
  foreign: 7,
};
