// PRINCIPLE LOOP の共通データ型。
// フロントエンド（ブラウザ）と夜間処理（GitHub Actions 上の Node.js）の両方から使う。

export type CategoryId = 'nature' | 'tech' | 'science' | 'mind' | 'build' | 'culture' | 'foreign';

export interface BoundaryProbe {
  probe: string;
  answer: string;
}

/**
 * 3行DEEP：深掘りする価値がありそうな方向を「少しだけ照らす」軽いコメント。
 * 答えを完成させない。各行 1 文・5〜15 秒で読める長さ。本格的な深掘り（FullDeepRun）とは別物。
 */
export interface LightDeep {
  why: string; // なぜ気になった？
  principle: string; // どこが原理？（原理候補は 1 つだけ）
  next: string; // 次は？
  /** ai = 夜間処理の AI / user = 自分で書いた・AI チャットから貼った / derived = 古いデータの分析から抜き出した（保存しない） */
  by?: 'ai' | 'user' | 'derived';
  updatedAt?: string;
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
  /** 3行DEEP（2026-10 以降の DAILY に付く。古いデータには無い） */
  deep?: LightDeep;
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

/** どうやって DIARY に入ったか（作り方）。daily = DAILY から保存 / manual = 自分で追加 / connect = CONNECT から */
export type DiaryKind = 'daily' | 'manual' | 'connect';

/**
 * DIARY の情報源（SOURCE / TYPE）＝ 誰が見つけたか。
 * daily = AI・自動収集（DAILY）/ memo = 自分が PRINCIPLE LOOP へ送ったメモ / insight = 自分の気づき・観察・違和感
 */
export type DiarySource = 'daily' | 'memo' | 'insight';

/** 本格DEEP で使う思考エンジン。今後増える前提で文字列も受け付ける */
export type DeepEngineId = 'okada' | 'ochiai' | (string & {});

/**
 * 本格DEEP の 1 回分（将来用）。3行DEEP を見て人間が選んだものだけを、思考エンジンで深く掘った結果をためる。
 * 今回は型だけ用意している（まだ画面からは作らない）。
 */
export interface FullDeepRun {
  id: string;
  engine: DeepEngineId;
  /** エンジンの問いと答え（問いはエンジン側の定義をそのまま写す） */
  steps: { question: string; answer: string }[];
  /** 構造抽出 → 原理候補 → 異分野移植 → 最小実験 の結果（あるものだけ） */
  structure?: string;
  principleCandidate?: string;
  transfers?: string[];
  experiment?: string;
  by: 'ai' | 'user';
  createdAt: string;
  updatedAt: string;
}

export interface DiaryEntry {
  id: string; // DAILY の id、または manual-xxx / connect-xxx / memo-xxx / insight-xxx
  kind: DiaryKind;
  state: PrincipleState;
  item: DailyItem; // 保存時点のスナップショット（元データが消えても残る）。Memo / 気づきは本文を hook に持つ
  memo: string;
  tags: string[];
  experiments: string[]; // 実験案（自由記述）
  createdAt: string;
  updatedAt: string;
  /** 情報源。古いデータには無いので diarySource() で kind から判定する */
  source?: DiarySource;
  /** 3行DEEP（自分で書いた・直したもの）。DAILY の AI 版は item.deep にある */
  deep?: LightDeep;
  /** 本格DEEP の結果（将来用） */
  fullDeep?: FullDeepRun[];
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
