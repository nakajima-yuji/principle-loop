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
  aiProvider?: string; // "gemini" / "mock" / "failed" / "sample" など
  sample?: boolean;
  /** AI の分析を作れなかった（作成中止）。仮の文章では埋めず、情報源の要約だけを持つ */
  analysisFailed?: boolean;
  failReason?: string; // 例：「AI が混み合っていたため」
  /** LIGHT DEEP：AI はここで止まる（3行だけ）。古いデータには無いので getLightDeep() で補う */
  lightDeep?: LightDeep;
}

/** LIGHT DEEP の3行。結論ではなく「人間が選ぶための材料」 */
export interface LightDeep {
  odd: string; // 何が妙・面白い？
  structure: string; // 構造・原理候補（まだ候補）
  transfer: string; // どこへ飛ばせそう？
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

export type AutoIdeaKind = 'BEST' | 'FAR' | 'WILD';
export type JimaReaction = 'interesting' | 'not_interesting' | 'grow';

export interface AutoIdea {
  date: string;
  category: AutoIdeaKind;
  title: string;
  one_sentence: string;
  source_daily: string[];
  principle: string;
  structure: string;
  cross_domain_connection: string;
  why_interesting: string;
  why_selected: string;
  possible_medium: string;
  player_or_viewer_action?: string;
  core_loop?: string;
  concrete_scene?: string;
  prototype?: string;
  image_prompt: string;
  image_path?: string;
  feedback?: { reaction: JimaReaction; comment?: string; updatedAt: string };
}

export interface AutoIdeasFile {
  version: 1;
  date: string;
  experimentDay: number;
  generatedAt: string;
  ideas: AutoIdea[];
  apiCalls: { text: number; images: number };
  estimatedUsd?: number;
}

export interface AutoExperimentState {
  version: 1;
  startedOn: string;
  experimentDay1: string;
  maxExperimentDays: 7;
  maxDailyImages: 3;
  maxTotalImages: 21;
  monthlyBudgetJpy: 1500;
  totalImages: number;
  totalTextCalls: number;
  totalImageCalls: number;
  stopped: boolean;
  stopReason?: string;
  updatedAt: string;
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

/**
 * 原理の育ち方（段階）。AI は段階を上げない。人間が実験を通して動かす。
 * OBSERVATION → PATTERN → STRUCTURE → PRINCIPLE_CANDIDATE → TESTING → VALIDATED
 */
export type PrincipleState = 'OBSERVATION' | 'PATTERN' | 'STRUCTURE' | 'PRINCIPLE_CANDIDATE' | 'TESTING' | 'VALIDATED';

/** v1（〜2026-10-05）の段階。移行時に legacyState として残す */
export type LegacyPrincipleState = 'OBSERVATION' | 'HYPOTHESIS' | 'PRINCIPLE_CANDIDATE' | 'PRINCIPLE' | 'EXPERIMENTED';

/** DIARY に入るものの種類。DIARY は全部が時系列に並ぶ中心のログ */
export type EntryType =
  | 'DAILY'
  | 'MEMO'
  | 'INSIGHT' // 気づき
  | 'OBSERVATION'
  | 'IDEA'
  | 'HYPOTHESIS'
  | 'LIGHT_DEEP'
  | 'PRINCIPLE_CANDIDATE'
  | 'EXPERIMENT'
  | 'RESULT'
  | 'TOOLCHAIN'
  | 'CAPABILITY';

/** HUMAN SELECT：人間の判断。AI の点数（transferability など）とは混ぜない */
export type UserDecision = 'INBOX' | 'INTERESTING' | 'DEEP' | 'BUILD' | 'HOLD' | 'ARCHIVE';

/** 出力先のメディア（ゲームだけに最適化しない） */
export type MediumId =
  | 'GAME'
  | 'PICTURE_BOOK'
  | 'STORY'
  | 'FILM'
  | 'DRAMA'
  | 'VIDEO'
  | 'TOY'
  | 'SPACE'
  | 'INSTALLATION'
  | 'WEB'
  | 'PHYSICAL_PRODUCT'
  | 'EXPERIMENT';

/** CORE LOCK：何を守れば大胆に壊せるか（逆側の道具） */
export interface CoreLock {
  remove: string; // 何を消したら成立しなくなる？
  core: string; // 名前を変えても残る核は？
  protect: string; // 何を守れば大胆に壊せる？
  changeable: string; // どこまでは変更できる？
  updatedAt: string;
}

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

/** v1 からある大まかな出どころ。新しいデータでは type を使う */
export type DiaryKind = 'daily' | 'manual' | 'connect' | 'memo' | 'experiment';

export interface DiaryEntry {
  id: string; // DAILY の id、または manual-xxx / connect-xxx / memo-xxx / exp-xxx / result-xxx
  kind: DiaryKind;
  type: EntryType;
  state: PrincipleState;
  legacyState?: LegacyPrincipleState; // v1 から移行したときの元の段階
  userDecision: UserDecision;
  item: DailyItem; // 保存時点のスナップショット（元データが消えても残る）。メモでは本文から作る
  body: string; // メモ・気づき・実験結果などの本文（DAILY では空）
  source: string; // 出どころ（'DAILY' / 'memo' / URL / 'EXPERIMENT' など）
  memo: string;
  tags: string[];
  experiments: string[]; // 実験案（自由記述）
  lightDeep?: LightDeep; // 自分の言葉で書き直した3行（あれば AI の3行より優先）
  engineIds: string[]; // 借りる思考エンジン（自動では使わない。選んだものだけ）
  coreLock?: CoreLock;
  media: MediumId[];
  tools: string[]; // TOOLCHAIN / CAPABILITY の部品（例：Tripo3D、Blender）
  // 系譜（どこから来て、どこへ戻ったか）
  parentId?: string;
  sourceId?: string;
  derivedFrom: string[];
  experimentId?: string;
  createdAt: string;
  updatedAt: string;
}

/** CONNECT でぶつけられるものの種類（土台。全部を実装しているわけではない） */
export type NodeKind = 'observation' | 'principle' | 'engine' | 'tool' | 'medium' | 'experiment';

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
  leftKind?: NodeKind;
  rightKind?: NodeKind;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentDesign {
  id: string;
  sourceType: 'principle' | 'connect' | 'idea';
  sourceId?: string;
  sourceLabel: string;
  question: string; // 何を確かめたいか（一番上に置く）
  formats: string[]; // 最小実験の形（紙カード5枚、30秒動画 など）
  media: MediumId[];
  result: string; // やってみて起きたこと（DIARY に OBSERVATION として戻す）
  resultEntryIds: string[]; // 戻した DIARY の id
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
  'id' | 'sourceType' | 'sourceId' | 'sourceLabel' | 'done' | 'createdAt' | 'updatedAt' | 'question' | 'formats' | 'media' | 'result' | 'resultEntryIds'
>;
