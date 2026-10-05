// 3行DEEP（少しだけ照らす）と、本格DEEP（思考エンジンで深く掘る）の共通部分。
// アプリと夜間処理の両方から使う（DOM にも Node にも依存しない）。
//
//   DAILY / Memo / 気づき → 3行DEEP → 人間が選ぶ → 本格DEEP（岡田エンジン / 落合エンジン / …）
//
// 3行DEEP は答えを完成させない。「深掘りする価値がありそうな方向」を少しだけ照らす。

import type { DailyItem, DeepEngineId, LightDeep } from './types.ts';

export type LightDeepKey = 'why' | 'principle' | 'next';

export const LIGHT_DEEP_LINES: readonly { key: LightDeepKey; label: string; hint: string }[] = [
  { key: 'why', label: 'なぜ気になった？', hint: '引っかかった点を 1 行で' },
  { key: 'principle', label: 'どこが原理？', hint: '原理候補を 1 つだけ。断定しない' },
  { key: 'next', label: '次は？', hint: '次に見てみたい方向を 1 つ' },
];

/** 3行DEEP の決まり。夜間処理の AI への指示と、AI チャットに頼むときの文面の両方で使う */
export const LIGHT_DEEP_RULES: readonly string[] = [
  '3行だけ（なぜ気になった？／どこが原理？／次は？ に1行ずつ）',
  '各行は1文・40字前後まで。3行を5〜15秒で読める長さにする',
  '説明しすぎない。結論を確定しない（「〜かもしれない」のように候補として書く）',
  '原理候補は1つだけ。応用案を並べない',
  '研究レポートにしない。「もう少し調べたい」と思える余白を残す',
];

/** 1 行の上限（AI が長く書いても、ここで切る） */
export const LIGHT_DEEP_MAX_CHARS = 80;

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

// ラベルは完全な形だけを認める（「次の探索対象：」のような普通の文を拾わないため）
const LABEL_RE: Record<LightDeepKey, RegExp> = {
  why: /^なぜ気になった[?？]?/,
  principle: /^どこが原理[?？]?/,
  next: /^次は[?？]?/,
};
const ARROW_RE = /^\s*(?:→|->|⇒|:|：)/;
const BULLET_RE = /^(?:[・\-*•]|\d+[.)．])\s*/;

/** 行頭の「・」「-」「1.」やラベル・矢印を外して、1 行の本文だけにする */
function cleanLine(raw: unknown, key?: LightDeepKey): string {
  if (typeof raw !== 'string') return '';
  let s = raw.replace(/\r/g, '').replace(/\s*\n\s*/g, ' ').trim();
  s = s.replace(BULLET_RE, '').replace(/\*\*/g, '');
  if (key) s = s.replace(LABEL_RE[key], '').trim();
  s = s.replace(ARROW_RE, '').trim();
  return clip(s, LIGHT_DEEP_MAX_CHARS);
}

/**
 * AI の返答やユーザーの入力から 3行DEEP を作る。
 * { why, principle, next } / ["…","…","…"] / 「・なぜ気になった？ → …」形式の文字列 のどれでも読む。
 * requireAll のときは 3 行そろわなければ undefined（夜間処理用。足りない行は古いデータ扱いで補う）。
 */
export function normalizeLightDeep(raw: unknown, by: LightDeep['by'], opts: { requireAll?: boolean } = {}): LightDeep | undefined {
  let deep: LightDeep | null = null;
  if (typeof raw === 'string') {
    deep = parseLightDeep(raw);
  } else if (Array.isArray(raw)) {
    deep = { why: cleanLine(raw[0], 'why'), principle: cleanLine(raw[1], 'principle'), next: cleanLine(raw[2], 'next') };
  } else if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    deep = { why: cleanLine(r.why, 'why'), principle: cleanLine(r.principle, 'principle'), next: cleanLine(r.next, 'next') };
  }
  if (!deep) return undefined;
  const filled = [deep.why, deep.principle, deep.next].filter(Boolean).length;
  if (filled === 0 || (opts.requireAll && filled < 3)) return undefined;
  return { why: deep.why, principle: deep.principle, next: deep.next, ...(by ? { by } : {}) };
}

/**
 * 文章の中から 3行DEEP を読み取る（AI チャットの返答の貼り付け・リポジトリの Markdown 用）。
 * 「・なぜ気になった？ → …」のラベル付きの行を探す。ラベルが無く「DEEP」の後に 3 行だけ並んでいる場合も読む。
 */
export function parseLightDeep(text: string): LightDeep | null {
  const lines = (text ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const found: Partial<Record<LightDeepKey, string>> = {};
  for (const line of lines) {
    const body = line.replace(BULLET_RE, '').replace(/\*\*/g, '');
    for (const { key } of LIGHT_DEEP_LINES) {
      if (found[key] === undefined && LABEL_RE[key].test(body) && ARROW_RE.test(body.replace(LABEL_RE[key], ''))) {
        found[key] = cleanLine(body, key);
        break;
      }
    }
  }
  if (Object.keys(found).length > 0) {
    return { why: found.why ?? '', principle: found.principle ?? '', next: found.next ?? '' };
  }
  // ラベルなし：「DEEP」の見出しの直後に箇条書きが 3 行、または箇条書き 3 行だけが貼られた
  const deepAt = lines.findIndex((l) => /^#*\s*DEEP\s*$/i.test(l));
  const rest = deepAt >= 0 ? lines.slice(deepAt + 1, deepAt + 4) : lines;
  if (rest.length === 3 && rest.every((l) => /^[・\-*•]/.test(l))) {
    return { why: cleanLine(rest[0]), principle: cleanLine(rest[1]), next: cleanLine(rest[2]) };
  }
  return null;
}

export function hasLightDeep(d: LightDeep | null | undefined): d is LightDeep {
  return Boolean(d && (d.why.trim() || d.principle.trim() || d.next.trim()));
}

/** 自分で追加したもの（AI の分析が無いもの）。古いデータからの抜き出しはしない */
const NO_ANALYSIS_PROVIDERS = new Set(['manual', 'memo', 'insight', 'connect', 'mock', 'failed']);

/** フックの中から「なぜ？」にあたる 1 文を選ぶ（無ければ最初の 1 文） */
function questionSentence(hook: string): string {
  const sentences = (hook ?? '')
    .split(/(?<=[。！？?!])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.find((s) => /なぜ|どうして/.test(s)) ?? sentences.find((s) => /[？?]$|か。$/.test(s)) ?? sentences[0] ?? '';
}

/**
 * 表示用の 3行DEEP。item.deep があればそれを、無い古いデータは既存の分析から短く抜き出す（by: 'derived'）。
 * 作成中止・AI 未設定（仮のテンプレート）・自分で追加したものは null。
 */
export function lightDeepOf(item: DailyItem): LightDeep | null {
  if (hasLightDeep(item.deep)) return item.deep;
  if (item.analysisFailed || NO_ANALYSIS_PROVIDERS.has(item.aiProvider ?? '')) return null;
  const principle = clip(item.principleCandidate || item.removePurpose || '', 60);
  if (!principle) return null;
  return {
    why: clip(questionSentence(item.hook), 60),
    principle,
    next: clip(item.transferIdeas?.[0] || item.hypothesis || '', 60),
    by: 'derived',
  };
}

/** コピー・メモ用のテキスト形式（ユーザーが書いた形式そのまま） */
export function formatLightDeep(d: LightDeep): string {
  return ['DEEP', ...LIGHT_DEEP_LINES.filter(({ key }) => d[key].trim()).map(({ key, label }) => `・${label} → ${d[key].trim()}`)].join('\n');
}

/**
 * Memo / 気づきに 3行DEEP を付けたいときに、AI チャット（Claude など）へ貼る文面。
 * アプリには AI の鍵を置かないため、自動では送らない（BUILD のプロンプトと同じ考え方）。
 */
export function lightDeepPrompt(text: string, kindLabel = 'メモ'): string {
  return [
    `次の${kindLabel}に、PRINCIPLE LOOP の「3行DEEP」を付けてください。`,
    '目的は深掘りではなく、深掘りする価値がありそうな方向を少しだけ照らすことです。',
    '',
    'ルール：',
    ...LIGHT_DEEP_RULES.map((r) => `- ${r}`),
    '',
    '返すのは次の3行だけ：',
    ...LIGHT_DEEP_LINES.map(({ label }) => `・${label} → `),
    '',
    `${kindLabel}：`,
    '"""',
    (text ?? '').trim(),
    '"""',
  ].join('\n');
}

// ---------------- 本格DEEP（将来用） ----------------

export interface DeepEngine {
  id: DeepEngineId;
  label: string;
  description: string;
  /** エンジンが毎回たずねる問い */
  questions: readonly string[];
  /** 画面から使えるか（今回はまだどれも使えない） */
  ready: boolean;
}

/**
 * 本格DEEP の思考エンジン。3行DEEP を見て人間が選んだものだけを、ここから選んだエンジンで深く掘る。
 * 新しいエンジンは、ここに 1 件足す（結果は DiaryEntry.fullDeep に FullDeepRun としてためる）。
 */
export const DEEP_ENGINES: readonly DeepEngine[] = [
  {
    id: 'okada',
    label: '岡田エンジン',
    description: '現象や具体案から、別の場所へ持っていける「構造の種」を取り出す。具体案ができたら再投入できる（diary/2026-10-04 参照）',
    questions: [
      '固有名詞を全部消すと何が残る？',
      '何と何の関係によって、この現象は成立している？',
      'まったく違う分野に、同じ構造は存在する？',
      'その構造だけを別の対象へ移したら何ができる？',
    ],
    ready: false,
  },
  {
    id: 'ochiai',
    label: '落合エンジン',
    description: '今後定義する',
    questions: [],
    ready: false,
  },
];
