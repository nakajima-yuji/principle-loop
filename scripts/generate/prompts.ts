// 内部 AI への指示。PRINCIPLE LOOP の文章の方針はここで決まる。

import { CATEGORIES, categoryOf } from '../../src/shared/categories.ts';
import { LIGHT_DEEP_RULES } from '../../src/shared/deep.ts';
import { BOUNDARY_PROBES, CORE_QUESTIONS } from '../../src/shared/questions.ts';
import type { CategoryId } from '../../src/shared/types.ts';
import type { Candidate } from '../filter/filter.ts';

export const SYSTEM_PROMPT = `あなたは「PRINCIPLE LOOP」の編集者です。世界の出来事から「別の分野へ転用できる原理」を見つけ、読者が構造を理解できる文章を書きます。

守ること：
- 単純なニュース要約をしない。
- まず具体的な現象を描写する。読者が「なぜ？」と思う導入を作る。
- その後、入力・変換・速度（なぜ速い／軽い／少ない手間で済むか）・捨てたもの・トレードオフ・最小構造・元用途削除 まで分析する。
- 事実と仮説を分ける。「事実」には与えられた情報源の文章に書かれていることだけを書く。書かれていない数字・固有名詞・結果を作らない。
- 原理を早く断定しない。「〜という見方ができる」「〜かもしれない」のように候補として書く。
- 最初の仮説を正解扱いしない。必ず反例（成立しない例・説明が間違っている可能性）を考える。
- クリックベイト（煽り・誇張・「衝撃」「ヤバい」「〜すぎる」など）は禁止。静かで知的な文体。
- 読みやすい自然な日本語。専門用語には短い説明を添える。
- 出力は指定された JSON だけ。前後に文章を書かない。`;

const CATEGORY_LINES = CATEGORIES.map((c) => `${c.id}=${c.label}${c.id === 'foreign' ? '（読者が普段は検索しない世界）' : ''}`).join(' / ');

export function selectPrompt(candidates: readonly Candidate[], recentPrinciples: readonly string[]): string {
  const list = candidates
    .map((c) => `[${c.key}] 分野の目安:${c.category} / 出典:${c.sourceName}\n${c.title}\n${c.summary.slice(0, 280)}`)
    .join('\n\n');
  return `次の候補の中から、「ニュースとしての大きさ」ではなく「原理としての価値」で選んでください。

評価の観点（各 0〜5）：
structure=構造がある / transfer=他分野へ転用できる / tradeoff=トレードオフがある / discard=何かを捨てている / minimal=最小構造まで縮められる / experiment=小さく実験できる / surprise=意外性がある

分野：${CATEGORY_LINES}
- 各分野から最大 2 件、合計最大 14 件を選ぶ。
- 分野の目安が合っていなければ、正しい分野に直してよい。
- foreign には、読者が普段は検索しない世界（専門外の産業・古い技術・辺境の文化・奇妙な生き物など）から選ぶ。
- 宣伝・製品発表・人事・株価・事件だけの話は選ばない。
${recentPrinciples.length ? `- 最近扱った原理と同じテーマは避ける：\n${recentPrinciples.map((p) => `  ・${p}`).join('\n')}` : ''}

出力 JSON：
{"picks":[{"key":"c01","category":"nature","scores":{"structure":0,"transfer":0,"tradeoff":0,"discard":0,"minimal":0,"experiment":0,"surprise":0},"seed":"原理のたね（30字以内）","reason":"選んだ理由（40字以内）"}]}

候補：
${list}`;
}

const INPUT_OPTIONS = CORE_QUESTIONS.find((q) => q.key === 'input')?.options ?? [];
const SPEED_OPTIONS = CORE_QUESTIONS.find((q) => q.key === 'speed')?.options ?? [];
const DISCARD_OPTIONS = CORE_QUESTIONS.find((q) => q.key === 'discard')?.options ?? [];

export function analyzePrompt(c: Candidate, category: CategoryId, articleText: string, seed: string): string {
  const cat = categoryOf(category);
  return `次の情報源をもとに、PRINCIPLE LOOP の 1 件を作ってください。

分野：${cat.label}${category === 'foreign' ? '（読者が普段は検索しない世界）' : ''}
情報源：${c.sourceName}
元のタイトル：${c.title}
URL：${c.url}
日付：${c.published ? c.published.slice(0, 10) : '不明'}
${seed ? `原理のたね（選定時のメモ）：${seed}\n` : ''}
情報源の文章（抜粋。事実として使ってよいのはここに書かれていることだけ）：
"""
${(articleText || c.summary).trim()}
"""

文章の流れ：「何だこれ？」→「なぜ？」→「そういう構造なのか」→「これ、他にも使えるのでは？」

出力 JSON（すべて日本語。文字数は目安）：
{
  "title": "現象が伝わる見出し。煽らない（40字以内）",
  "hook": "具体的な現象の描写から始め、読者が「なぜ？」と思う導入（2〜4文・150字以内）",
  "story": "4段落を空行（\\n\\n）で区切る。1段落目=何だこれ？（現象）／2段落目=なぜ？（問い）／3段落目=そういう構造なのか（仕組みの見方。仮説として書く）／4段落目=これ、他にも使えるのでは？（転用の可能性と限界）。合計650字以内",
  "observation": "情報源に書かれている事実だけ（解釈を入れない・200字以内）",
  "input": "何を入力しているか（情報・時間・材料・人・エネルギー・位置・制約・行動・ルール などに分解）",
  "inputTypes": ${JSON.stringify(INPUT_OPTIONS)} から当てはまるものを 1〜4 個,
  "transformation": "何を何へ変えているか。「A → B」の形",
  "why": "なぜ成立するのか（仮説として・120字以内）",
  "speed": "なぜ速い／軽い／少ない手間で済むのか（計算量削減・探索範囲削減・判断回数削減・圧縮・近似・並列処理・事前計算・全体把握を捨てている など広く捉える）",
  "speedTypes": ${JSON.stringify(SPEED_OPTIONS)} から 1〜3 個,
  "discard": "あえて何を捨てているか（特に重視）",
  "discardTypes": ${JSON.stringify(DISCARD_OPTIONS)} から 1〜3 個,
  "tradeoff": "「X ↔ Y」の形",
  "minimumStructure": "名前・商品・業界・用途を消して、要素の組み合わせ（A + B + C）まで縮めた形",
  "removePurpose": "元の用途を消しても成立する言い方（「〜する構造」で終わる）",
  "principleCandidate": "原理候補を一文で。断定しすぎない",
  "counterexample": "この説明が間違っている可能性・成立しない例",
  "hypothesis": "検証できる形の仮説（〜を変えると〜が変わるはず）",
  "boundary": ${JSON.stringify(BOUNDARY_PROBES.map((p) => ({ probe: p, answer: '1〜2文' })))},
  "invert": "原理を逆転した構造と、その使い道",
  "transferIdeas": ["遠い分野への転用案を 3 つ（それぞれ 50字以内）"],
  "deep": {"why": "なぜ気になった？（1行）", "principle": "どこが原理？（1行）", "next": "次は？（1行）"},
  "tags": ["短いタグを 3〜5 個"],
  "transferability": 0.0〜1.0 の数値（他分野へ飛ばしやすいほど高い）
}

"deep" は「3行DEEP」です。深掘りではなく、深掘りする価値がありそうな方向を少しだけ照らすための軽いコメントです。
${LIGHT_DEEP_RULES.map((r) => `- ${r}`).join('\n')}
例：{"why": "見えない対象を痕跡から推測する構造がある。", "principle": "対象そのものより、残された情報が探索欲を生む。", "next": "ゲーム・絵本・建築など別分野にも同型があるかもしれない。"}`;
}
