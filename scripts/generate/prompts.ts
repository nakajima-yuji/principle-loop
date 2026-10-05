// 内部 AI への指示。PRINCIPLE LOOP の文章の方針はここで決まる。

import { CATEGORIES, categoryOf } from '../../src/shared/categories.ts';
import type { CategoryId } from '../../src/shared/types.ts';
import type { Candidate } from '../filter/filter.ts';

export const SYSTEM_PROMPT = `あなたは「PRINCIPLE LOOP」の観察係です。世界の出来事から「妙なところ」を見つけ、人間が「面白い／掘る／試す／保留／捨てる」を選ぶための短い材料を書きます。

守ること：
- 考え切らない。結論・完成案・正解は出さない。3行で止める（LIGHT DEEP）。
- 単純なニュース要約をしない。どこが「妙」なのかを具体的に書く。
- 構造は「候補」として書く。「〜かもしれない」「〜という見方ができる」。原理を断定しない。
- 事実と推測を分ける。「事実」には与えられた情報源の文章に書かれていることだけを書く。書かれていない数字・固有名詞・結果を作らない。
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

/**
 * LIGHT DEEP：1 件につき 3 行だけ。長い分析（7つの質問・ストーリー）は作らない。
 * 深く掘るかどうかは人間が選び、FULL DEEP で自分の言葉で書く。
 */
export function analyzePrompt(c: Candidate, category: CategoryId, articleText: string, seed: string): string {
  const cat = categoryOf(category);
  return `次の情報源をもとに、PRINCIPLE LOOP の 1 件（LIGHT DEEP）を作ってください。

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

出力 JSON（すべて日本語。文字数は目安。これ以上は書かない）：
{
  "title": "現象が伝わる見出し。煽らない（40字以内）",
  "hook": "具体的な現象の描写。読者が「なぜ？」と思う導入（2〜3文・120字以内）",
  "observation": "情報源に書かれている事実だけ（解釈を入れない・160字以内）",
  "lightDeep": {
    "odd": "何が妙・面白い？（1文・60字以内）",
    "structure": "構造・原理候補。名前や用途を消した形で、断定しない（1文・60字以内）",
    "transfer": "どこへ飛ばせそう？ 遠い分野を1つ（1文・60字以内）"
  },
  "tags": ["短いタグを 2〜4 個"],
  "transferability": 0.0〜1.0 の数値（他分野へ飛ばしやすいほど高い）
}`;
}
