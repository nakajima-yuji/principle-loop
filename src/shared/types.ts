// PRINCIPLE LOOP の共通データ型。
// フロントエンド（ブラウザ）と夜間処理（GitHub Actions 上の Node.js）の両方から使う。

export type CategoryId = 'nature' | 'tech' | 'science' | 'mind' | 'build' | 'culture' | 'foreign';

export interface BoundaryProbe {
  probe: string;
  answer: string;
}

/** DAILY の 1 件。仕様の最低限フィールド + 任意の拡張フィールド。 */
export interface DailyItem {
  id: string; // 例: "20261005-03"（日付 + 番号。メールの DEEP リンクにも使う）
  date: string; // "2026-10-05"（日本時間）
  category: CategoryId;
  title: string;
  hook: string; // 「なぜ？」と思わせる現象の導入
  story: string; // 何だこれ？ → なぜ？ → そういう構造なのか → 他にも使えるのでは？（段落は空行区切り）
  sourceTitle: string;
  sourceUrl: string;
  sourceDate: string;
  observation: string; // 事実のみ（情報源に書かれていること）
  input: string;
  transformation: string;
  why: string; // なぜ成立するのか（AI の解釈・仮説）
  speed: string;
  discard: string;
  tradeoff: string;
  minimumStructure: string;
  removePurpose: string;
  principleCandidate: string;
  counterexample: string;
  transferIdeas: string[];
  saved: boolean; // 公開データでは常に false。保存状態はブラウザ側で持つ。

  // ---- 拡張（任意） ----
  sourceName?: string; // 例: "Science"
  image?: string; // サムネイル画像 URL（無ければ図形サムネイルを描く）
  inputTypes?: string[];
  speedTypes?: string[];
  discardTypes?: string[];
  hypothesis?: string; // 検証できる形の仮説
  boundary?: BoundaryProbe[];
  invert?: string;
  tags?: string[];
  transferability?: number; // 0〜1。他分野へ飛ばしやすさ（PRINCIPLE OF THE DAY の選定に使う）
  aiProvider?: string; // "gemini" / "mock" / "sample" など
  sample?: boolean;
}

export interface DailyFile {
  version: 1;
  date: string;
  generatedAt: string;
  provider: string;
  sample?: boolean;
  principleOfTheDay: string; // item id
  items: DailyItem[];
}

/** 検索・重複判定用の軽量な索引（public/data/archive/index.json） */
export interface ArchiveEntry {
  id: string;
  date: string;
  category: CategoryId;
  title: string;
  hook: string;
  principleCandidate: string;
  minimumStructure: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceName?: string;
  tags?: string[];
}

export interface ArchiveDay {
  date: string;
  principleOfTheDay: string;
  sample?: boolean;
  items: ArchiveEntry[];
}

export interface ArchiveIndex {
  version: 1;
  updatedAt: string;
  days: ArchiveDay[]; // 新しい日付が先頭
}

/** 10日自動停止のための活動データ。これ以外の行動履歴は集めない。 */
export interface Activity {
  lastActive: string; // ISO 8601
  inactivityDays: number;
  paused: boolean;
}

// ---------------- 個人データ（ブラウザ内に保存） ----------------

export type PrincipleState = 'OBSERVATION' | 'HYPOTHESIS' | 'PRINCIPLE_CANDIDATE' | 'PRINCIPLE' | 'EXPERIMENTED';

export interface DeepNotes {
  input: string;
  transformation: string;
  speed: string;
  discard: string;
  tradeoff: string;
  minimumStructure: string;
  removePurpose: string;
  observation: string;
  hypothesis: string;
  counterexample: string;
  boundary: Record<string, string>;
  invert: string;
  transfer: string;
  principleCandidate: string;
  chips: Record<string, string[]>;
  updatedAt: string;
}

export type DiaryKind = 'daily' | 'manual' | 'connect';

export interface DiaryEntry {
  id: string; // DAILY の id、または manual-xxx / connect-xxx
  kind: DiaryKind;
  state: PrincipleState;
  item: DailyItem; // 保存時点のスナップショット（元データが消えても残る）
  memo: string;
  tags: string[];
  experiments: string[]; // 実験案（自由記述）
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionResult {
  id: string;
  leftId: string;
  rightId: string;
  leftTitle: string;
  rightTitle: string;
  leftPrinciple: string;
  rightPrinciple: string;
  newStructure: string;
  newUse: string;
  minimumExperiment: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentDesign {
  id: string;
  sourceType: 'principle' | 'connect' | 'idea';
  sourceId?: string;
  sourceLabel: string;
  principle: string;
  hypothesis: string;
  minimumStructure: string;
  discard: string;
  comparison: string;
  conditions: string;
  success: string;
  failure: string;
  observe: string;
  tech: string;
  v30m: string;
  v2h: string;
  v1d: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ExperimentField = Exclude<
  keyof ExperimentDesign,
  'id' | 'sourceType' | 'sourceId' | 'sourceLabel' | 'done' | 'createdAt' | 'updatedAt'
>;
