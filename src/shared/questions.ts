// PRINCIPLE LOOP の核：DEEP の 7 つの中心質問と、その後の追加分析。

export type CoreKey =
  | 'input'
  | 'transformation'
  | 'speed'
  | 'discard'
  | 'tradeoff'
  | 'minimumStructure'
  | 'removePurpose';

export interface CoreQuestion {
  key: CoreKey;
  no: number;
  label: string;
  question: string;
  hint: string;
  options?: readonly string[]; // 選んで分解するための候補
  examples?: readonly string[];
}

export const CORE_QUESTIONS: readonly CoreQuestion[] = [
  {
    key: 'input',
    no: 1,
    label: 'INPUT',
    question: '何を入力している？',
    hint: 'どんな資源・情報・条件が入ってくる？',
    options: ['情報', '時間', '材料', '人', 'エネルギー', '位置', '制約', '行動', 'ルール'],
  },
  {
    key: 'transformation',
    no: 2,
    label: 'TRANSFORMATION',
    question: '何を変換している？',
    hint: '入力を何へ変えている？「A → B」の形で書く',
    examples: ['位置情報 → 危険度', '局所行動 → 全体秩序', '熱 → 形状変化', '文章 → 意味表現'],
  },
  {
    key: 'speed',
    no: 3,
    label: 'SPEED',
    question: 'なぜ速い？',
    hint: '他の方法より速い・軽い・手間が少ないのはなぜ？',
    options: ['計算量削減', '探索範囲削減', '判断回数削減', '圧縮', '近似', '並列処理', '事前計算', '全体把握を捨てている'],
  },
  {
    key: 'discard',
    no: 4,
    label: 'DISCARD',
    question: '何を捨てている？',
    hint: '実現のために、あえて何を捨てている？',
    options: ['精度', '自由度', '全体把握', '汎用性', 'リアルタイム性', '完璧さ', '情報量'],
  },
  {
    key: 'tradeoff',
    no: 5,
    label: 'TRADE-OFF',
    question: '何とのトレードオフ？',
    hint: '得ているものと引き換えに失うものは？',
    examples: ['速度 ↔ 精度', '自由度 ↔ 安定性', 'リアルさ ↔ 軽量さ', '汎用性 ↔ 特化性能', '複雑性 ↔ 理解しやすさ'],
  },
  {
    key: 'minimumStructure',
    no: 6,
    label: 'MINIMUM STRUCTURE',
    question: '最小構造は何？',
    hint: '名前・商品・業界・用途を消して、何と何の組み合わせまで縮められる？',
    examples: ['魚群 → 複数個体 + 近傍情報 + 単純な共通ルール'],
  },
  {
    key: 'removePurpose',
    no: 7,
    label: 'REMOVE PURPOSE',
    question: '元用途を消しても成立する？',
    hint: 'もとの文脈を離れて「〜する構造」と言い直すと？',
    examples: ['検索システム → 大量候補をすべて確認せず、必要なものへ近づく構造'],
  },
];

export type ExtraKey =
  | 'observation'
  | 'hypothesis'
  | 'counterexample'
  | 'boundary'
  | 'invert'
  | 'transfer'
  | 'principleCandidate';

export interface ExtraStep {
  key: ExtraKey;
  label: string;
  title: string;
  hint: string;
}

export const EXTRA_STEPS: readonly ExtraStep[] = [
  { key: 'observation', label: 'OBSERVATION', title: '観察', hint: '情報源に書かれている事実だけを書く。解釈は入れない。' },
  { key: 'hypothesis', label: 'HYPOTHESIS', title: '仮説', hint: 'なぜそうなるのか。検証できる形で。まだ正解扱いしない。' },
  { key: 'counterexample', label: 'COUNTEREXAMPLE', title: '反例', hint: 'この説明が間違っている可能性は？ 成立しない例は？' },
  { key: 'boundary', label: 'BOUNDARY', title: '境界', hint: '条件を極端に振ると、どこで壊れる？' },
  { key: 'invert', label: 'INVERT', title: '逆転', hint: '原理を逆にすると、どんな構造になる？ それも使える？' },
  { key: 'transfer', label: 'TRANSFER', title: '転用', hint: '別の分野で、同じ構造が使える場所は？' },
  { key: 'principleCandidate', label: 'PRINCIPLE CANDIDATE', title: '原理候補', hint: '用途を消した一文で。まだ「候補」として書く。' },
];

export const BOUNDARY_PROBES: readonly string[] = [
  '10倍なら？',
  '1/100なら？',
  'ノイズが入ったら？',
  '人間を消したら？',
  '人間が介入したら？',
  'リアルタイムなら？',
  '巨大化したら？',
];

export const PRINCIPLE_STATES = [
  { id: 'OBSERVATION', label: 'OBSERVATION', ja: '観察' },
  { id: 'HYPOTHESIS', label: 'HYPOTHESIS', ja: '仮説' },
  { id: 'PRINCIPLE_CANDIDATE', label: 'PRINCIPLE CANDIDATE', ja: '原理候補' },
  { id: 'PRINCIPLE', label: 'PRINCIPLE', ja: '原理' },
  { id: 'EXPERIMENTED', label: 'EXPERIMENTED', ja: '実験済み' },
] as const;

/** ストーリーの 4 段階。story の段落にこの順で対応させる。 */
export const STORY_STAGES: readonly string[] = ['何だこれ？', 'なぜ？', 'そういう構造なのか', 'これ、他にも使えるのでは？'];

/** 今日の選定基準（ニュース価値ではなく原理としての価値で選ぶ） */
export const SELECTION_CRITERIA: readonly string[] = [
  '構造がある',
  '転用できる',
  'トレードオフがある',
  '何かを捨てている',
  '最小化できる',
  '実験できる',
  '意外性がある',
  '過去と重複しない',
];
