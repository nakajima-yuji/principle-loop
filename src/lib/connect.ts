// CONNECT：原理同士をぶつける。「似たもの」ではなく「遠いもの」を優先する。
// ブラウザに AI の鍵は置かないので、ここではルールで「衝突の下書き」と「問い」を作り、
// 最終的な言葉はユーザーが書く。

import { CATEGORY_POSITION } from '../shared/categories.ts';
import type { CategoryId } from '../shared/types.ts';
import type { PrincipleSource } from './principle.ts';
import { textSimilarity, truncate } from './text.ts';

/** 0（近い）〜1（遠い） */
export function principleDistance(a: PrincipleSource, b: PrincipleSource): number {
  const pos = (c: CategoryId | 'connect') => (c === 'connect' ? 6 : CATEGORY_POSITION[c]);
  const catGap = a.category === b.category ? 0 : Math.min(1, Math.abs(pos(a.category) - pos(b.category)) / 5);
  const textA = `${a.principle} ${a.minimumStructure} ${a.tags.join(' ')}`;
  const textB = `${b.principle} ${b.minimumStructure} ${b.tags.join(' ')}`;
  const sim = textSimilarity(textA, textB, 2);
  const tagOverlap = a.tags.some((t) => b.tags.includes(t)) ? 1 : 0;
  const d = 0.45 * catGap + 0.45 * (1 - Math.min(1, sim * 3)) + 0.1 * (1 - tagOverlap);
  return Math.round(d * 100) / 100;
}

export function distanceLabel(d: number): string {
  if (d >= 0.8) return 'とても遠い';
  if (d >= 0.6) return '遠い';
  if (d >= 0.4) return 'やや近い';
  return '近い';
}

/**
 * 遠い組み合わせを提案する。毎回同じにならないよう、上位の中から seed で選ぶ。
 */
export function suggestFarPair(
  sources: readonly PrincipleSource[],
  seed = 0,
): [PrincipleSource, PrincipleSource] | null {
  if (sources.length < 2) return null;
  const pairs: { a: PrincipleSource; b: PrincipleSource; d: number }[] = [];
  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      pairs.push({ a: sources[i], b: sources[j], d: principleDistance(sources[i], sources[j]) });
    }
  }
  pairs.sort((x, y) => y.d - x.d);
  const top = pairs.slice(0, Math.max(1, Math.min(5, Math.ceil(pairs.length / 3))));
  const chosen = top[Math.abs(seed) % top.length];
  return [chosen.a, chosen.b];
}

/** ぶつけるための問い（AI ではなく思考の足場） */
export function collisionQuestions(a: PrincipleSource, b: PrincipleSource): string[] {
  const q: string[] = [];
  q.push(`Aの最小構造「${truncate(a.minimumStructure, 40)}」を、Bの世界に置くと何が起きる？`);
  if (b.discard) q.push(`Bが捨てているもの（${truncate(b.discard, 30)}）を、Aも捨てたらどうなる？`);
  if (a.tradeoff) q.push(`Aのトレードオフ（${truncate(a.tradeoff, 30)}）を、Bの構造で回避できる？`);
  if (b.transformation) q.push(`Aの入力を、Bの変換（${truncate(b.transformation, 30)}）に通したら？`);
  q.push('2つが同時に成り立たない場面はどこ？（反例）');
  return q;
}

export interface ConnectionDraft {
  newStructure: string;
  newUse: string;
  minimumExperiment: string;
}

/** 下書き：中身はユーザーが書き換える前提の「たたき台」 */
export function draftConnection(a: PrincipleSource, b: PrincipleSource): ConnectionDraft {
  const newStructure = [
    `A：${a.minimumStructure || a.principle}`,
    `B：${b.minimumStructure || b.principle}`,
    '',
    `→ 「${truncate(a.principle, 60)}」を、`,
    `　「${truncate(b.principle, 60)}」のやり方で動かす構造。`,
  ].join('\n');

  const ideasA = a.transferIdeas.slice(0, 2);
  const ideasB = b.transferIdeas.slice(0, 2);
  const newUse = [
    ...ideasA.map((x) => `・${x}（Bの考え方を足すと？）`),
    ...ideasB.map((x) => `・${x}（Aの考え方を足すと？）`),
    '・（ここに新しい用途を書く）',
  ].join('\n');

  const minimumExperiment = [
    '3つの条件を同じ指標で比べる：',
    '① Aだけ　② Bだけ　③ A×B',
    '指標：（例：完了までの時間 / 失敗の回数 / 必要な情報量）',
    '30分版：紙・表計算・簡単なシミュレーションで試せる最小の形',
  ].join('\n');

  return { newStructure, newUse, minimumExperiment };
}

/** 外部の AI チャットに自分で貼り付けて相談するためのプロンプト（自動実行はしない） */
export function connectChatPrompt(a: PrincipleSource, b: PrincipleSource): string {
  return [
    '次の2つの「原理候補」をぶつけて、新しい構造を考えたい。',
    '似ている点ではなく、遠い2つを組み合わせたときに生まれるものを探してほしい。',
    '',
    `【原理A】${a.principle}`,
    `最小構造：${a.minimumStructure}`,
    `捨てているもの：${a.discard}`,
    '',
    `【原理B】${b.principle}`,
    `最小構造：${b.minimumStructure}`,
    `捨てているもの：${b.discard}`,
    '',
    '出力：',
    '1. 新しい構造（用途を消した一文）',
    '2. 新しい用途を3つ',
    '3. 30分でできる最小実験（比較条件・観測するもの・成功/失敗条件）',
    '4. この組み合わせが成立しない反例',
    '事実と推測を分け、断定しすぎないこと。',
  ].join('\n');
}
