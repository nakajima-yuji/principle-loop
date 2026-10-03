// AI を使わない代わりの実装。
// - AI_API_KEY が無いとき（セットアップ直後）でも、収集〜サイト更新〜メールまでを通しで試せる
// - テストで外部に一切つながずに動かせる
// 本物の分析ではないので、画面には「AI未設定のため仮のテンプレート」と表示される。

import type { AIProvider, AIRequest, AIResponse } from './provider.ts';

export interface MockSelectContext {
  candidates: { key: string; category: string; title: string; score: number }[];
}

export interface MockAnalyzeContext {
  title: string;
  summary: string;
  categoryLabel: string;
}

function firstSentences(text: string, max = 2): string {
  const parts = text.split(/(?<=[。．.!?！？])\s*/).filter(Boolean);
  return parts.slice(0, max).join(' ').slice(0, 220);
}

export function createMockProvider(): AIProvider {
  return {
    name: 'mock',
    model: 'template',
    async generate(req: AIRequest): Promise<AIResponse> {
      if (req.task === 'select') {
        const ctx = req.context as MockSelectContext;
        const byCat = new Map<string, MockSelectContext['candidates']>();
        [...ctx.candidates]
          .sort((a, b) => b.score - a.score)
          .forEach((c) => byCat.set(c.category, [...(byCat.get(c.category) ?? []), c]));
        const picks = [...byCat.values()].flatMap((list) =>
          list.slice(0, 2).map((c, i) => ({
            key: c.key,
            category: c.category,
            scores: { structure: 3 - i, transfer: 3, tradeoff: 2, discard: 2, minimal: 2, experiment: 2, surprise: 2 },
            seed: '',
            reason: 'AI 未設定のため、コードの点数で選びました',
          })),
        );
        return { text: JSON.stringify({ picks }) };
      }

      if (req.task === 'analyze') {
        const ctx = req.context as MockAnalyzeContext;
        const intro = firstSentences(ctx.summary) || ctx.title;
        const note = '（AI未設定のため仮の文章です。DEEP で自分の言葉に置き換えてください）';
        return {
          text: JSON.stringify({
            title: ctx.title.slice(0, 60),
            hook: intro,
            story: [
              `${intro}`,
              'この現象は、なぜこうなるのだろうか。何が入力され、何に変わっているのか。',
              `仕組みの見方はまだ仮説です。${note}`,
              '同じ構造は、別の分野でも使えるかもしれない。DEEP の7つの質問で分解してみよう。',
            ].join('\n\n'),
            observation: ctx.summary.slice(0, 300),
            input: `（未分析）何が入っている？ 情報・時間・材料・人・エネルギーなど`,
            inputTypes: [],
            transformation: '（未分析）何 → 何 に変えている？',
            why: note,
            speed: '（未分析）なぜ速い・軽い・手間が少ない？',
            speedTypes: [],
            discard: '（未分析）何を捨てている？',
            discardTypes: [],
            tradeoff: '（未分析）何 ↔ 何？',
            minimumStructure: '（未分析）要素 + 関係 + ルール',
            removePurpose: '（未分析）元の用途を消すと「〜する構造」？',
            principleCandidate: `${ctx.categoryLabel}の現象から：まだ原理候補はありません`,
            counterexample: '（未分析）成立しない例は？',
            hypothesis: '',
            boundary: [],
            invert: '',
            transferIdeas: [],
            tags: [],
            transferability: 0.3,
          }),
        };
      }

      return { text: '{}' };
    },
  };
}
