// 創造の循環（INPUT → DIARY → LIGHT DEEP → HUMAN SELECT → ENGINE → TRANSFORM → EXPERIMENT → TEST → OBSERVE → DIARY）
// で使うことばの一覧。画面・データ移行・テストで共通に使う。

import type { CoreLock, EntryType, LegacyPrincipleState, MediumId, UserDecision } from './types.ts';

export const LOOP_FLOW: readonly string[] = [
  'INPUT',
  'DIARY',
  'LIGHT DEEP',
  'HUMAN SELECT',
  'ENGINE',
  'TRANSFORM',
  'EXPERIMENT',
  'TEST',
  'OBSERVE',
];

export const ENTRY_TYPES: readonly { id: EntryType; label: string; ja: string }[] = [
  { id: 'DAILY', label: 'DAILY', ja: '今日の観察' },
  { id: 'MEMO', label: 'MEMO', ja: 'メモ' },
  { id: 'INSIGHT', label: 'INSIGHT', ja: '気づき' },
  { id: 'OBSERVATION', label: 'OBSERVATION', ja: '観察' },
  { id: 'IDEA', label: 'IDEA', ja: 'アイデア' },
  { id: 'HYPOTHESIS', label: 'HYPOTHESIS', ja: '仮説' },
  { id: 'LIGHT_DEEP', label: 'LIGHT DEEP', ja: '軽く掘った' },
  { id: 'PRINCIPLE_CANDIDATE', label: 'PRINCIPLE CANDIDATE', ja: '原理候補' },
  { id: 'EXPERIMENT', label: 'EXPERIMENT', ja: '実験' },
  { id: 'RESULT', label: 'RESULT', ja: '実験結果' },
  { id: 'TOOLCHAIN', label: 'TOOLCHAIN', ja: '道具の組み合わせ' },
  { id: 'CAPABILITY', label: 'CAPABILITY', ja: 'できるようになったこと' },
];

export const ENTRY_TYPE_IDS = ENTRY_TYPES.map((t) => t.id);

export function entryTypeLabel(id: EntryType): { label: string; ja: string } {
  return ENTRY_TYPES.find((t) => t.id === id) ?? { label: id, ja: id };
}

/** すばやく書くときに選べる種類（何も選ばなければ MEMO） */
export const QUICK_TYPES: readonly EntryType[] = ['MEMO', 'INSIGHT', 'OBSERVATION', 'IDEA', 'TOOLCHAIN', 'CAPABILITY'];

/** HUMAN SELECT。並び順はボタンの順 */
export const DECISIONS: readonly { id: UserDecision; mark: string; label: string; ja: string }[] = [
  { id: 'INTERESTING', mark: '☆', label: 'INTERESTING', ja: '面白い' },
  { id: 'DEEP', mark: '↓', label: 'DEEP', ja: '深掘り' },
  { id: 'BUILD', mark: '→', label: 'BUILD', ja: '試す' },
  { id: 'HOLD', mark: '△', label: 'HOLD', ja: '保留' },
  { id: 'ARCHIVE', mark: '×', label: 'ARCHIVE', ja: 'アーカイブ' },
];

export const DECISION_IDS: readonly UserDecision[] = ['INBOX', ...DECISIONS.map((d) => d.id)];

export function decisionLabel(id: UserDecision): { mark: string; label: string; ja: string } {
  if (id === 'INBOX') return { mark: '・', label: 'INBOX', ja: '未選択' };
  return DECISIONS.find((d) => d.id === id) ?? { mark: '・', label: id, ja: id };
}

/** 出力先のメディア。ゲームはその一つにすぎない */
export const MEDIA: readonly { id: MediumId; label: string; ja: string }[] = [
  { id: 'GAME', label: 'GAME', ja: 'ゲーム' },
  { id: 'PICTURE_BOOK', label: 'PICTURE BOOK', ja: '絵本' },
  { id: 'STORY', label: 'STORY', ja: '物語' },
  { id: 'FILM', label: 'FILM', ja: '映画' },
  { id: 'DRAMA', label: 'DRAMA', ja: 'ドラマ' },
  { id: 'VIDEO', label: 'VIDEO', ja: '動画' },
  { id: 'TOY', label: 'TOY', ja: 'おもちゃ' },
  { id: 'SPACE', label: 'SPACE', ja: '空間' },
  { id: 'INSTALLATION', label: 'INSTALLATION', ja: 'インスタレーション' },
  { id: 'WEB', label: 'WEB', ja: 'Web' },
  { id: 'PHYSICAL_PRODUCT', label: 'PHYSICAL PRODUCT', ja: 'モノ' },
  { id: 'EXPERIMENT', label: 'EXPERIMENT', ja: '実験そのもの' },
];

export const MEDIUM_IDS = MEDIA.map((m) => m.id);

/** 完成品より最小実験。まずこのくらいの大きさで試す */
export const MINIMAL_EXPERIMENTS: readonly string[] = [
  '紙カード5枚',
  '30秒動画',
  '1画面ゲーム',
  'Three.js 1シーン',
  'Blender 1オブジェクト',
  '1ページ絵本',
  '紙芝居',
  '1ルールだけのゲーム',
  '子どもに1分触ってもらう',
];

/** CORE LOCK：大胆に壊すために、守るものを先に決める */
export const CORE_LOCK_QUESTIONS: readonly { key: Exclude<keyof CoreLock, 'updatedAt'>; question: string; hint: string }[] = [
  { key: 'remove', question: '何を消したら成立しなくなる？', hint: '1つずつ消してみて、壊れたところが核の近く' },
  { key: 'core', question: '名前を変えても残る核は？', hint: '固有名詞・見た目・ジャンルを替えても残るもの' },
  { key: 'protect', question: '何を守れば大胆に壊せる？', hint: 'ここだけ守れば、残りは全部変えてよい' },
  { key: 'changeable', question: 'どこまでは変更できる？', hint: '変えてよい範囲・変えてはいけない境界' },
];

export function emptyCoreLock(): CoreLock {
  return { remove: '', core: '', protect: '', changeable: '', updatedAt: '' };
}

/** CORE LOCK に何か書いてあるか */
export function coreLockFilled(c: CoreLock | undefined): boolean {
  return Boolean(c && CORE_LOCK_QUESTIONS.some((q) => c[q.key].trim()));
}

/** TOOLCHAIN / CAPABILITY の例（原理ではなく「手段の組み合わせ」として残す） */
export const TOOLCHAIN_EXAMPLES: readonly string[] = ['Tripo3D × Blender × Three.js × Codex', '紙芝居 × AI画像 × 音声 × 動画生成'];

/** v1 の段階の呼び名（移行したデータに「前の版での段階」として表示する） */
export const LEGACY_STATE_LABELS: Readonly<Record<LegacyPrincipleState, string>> = {
  OBSERVATION: '観察',
  HYPOTHESIS: '仮説',
  PRINCIPLE_CANDIDATE: '原理候補',
  PRINCIPLE: '原理',
  EXPERIMENTED: '実験済み',
};
