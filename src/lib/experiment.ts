// EXPERIMENT（旧 BUILD）。完成品より最小実験。
// 「何を確かめたいか」を最初に決め、紙カード・30秒動画・1画面ゲームのような小さな形で試し、
// 起きたことを DIARY に新しい観察として戻す。
// 詳しい設計（仮説 → 比較 → 成功・失敗条件 → 段階）は必要なときだけ。
// Claude Code / Codex は自動実行せず、プロンプトをコピーするだけ。

import type { ExperimentDesign, ExperimentField } from '../shared/types.ts';
import type { PrincipleSource } from './principle.ts';
import { truncate } from './text.ts';

export interface DesignFieldDef {
  key: ExperimentField;
  label: string;
  hint: string;
  full?: boolean;
}

export const DESIGN_FIELDS: readonly DesignFieldDef[] = [
  { key: 'principle', label: '検証したい原理', hint: '用途を消した一文で', full: true },
  { key: 'hypothesis', label: '仮説', hint: '〜すると〜になるはず（反証できる形で）', full: true },
  { key: 'minimumStructure', label: '最小構造', hint: 'これだけあれば原理が動く、という要素' },
  { key: 'discard', label: '捨てる要素', hint: 'この実験ではあえて作らないもの' },
  { key: 'comparison', label: '比較対象', hint: '原理を使わない版は何か' },
  { key: 'conditions', label: '実験条件', hint: '変えるのは1つだけ。他はそろえる' },
  { key: 'success', label: '成功条件', hint: '何がどうなれば「効いた」と言えるか' },
  { key: 'failure', label: '失敗条件', hint: '何が起きたら仮説を捨てるか' },
  { key: 'observe', label: '観測するデータ', hint: '数値で残せるもの' },
  { key: 'tech', label: '必要技術', hint: 'できるだけ小さく' },
];

export const VERSION_FIELDS: readonly DesignFieldDef[] = [
  { key: 'v30m', label: '30分版', hint: '紙・表計算・1ファイルでできる最小の形' },
  { key: 'v2h', label: '2時間版', hint: '条件を切り替えて数値を取る' },
  { key: 'v1d', label: '1日版', hint: '境界（BOUNDARY）を探す' },
];

export function emptyDesign(now: string, id: string): ExperimentDesign {
  return {
    id,
    sourceType: 'idea',
    sourceLabel: '',
    question: '',
    formats: [],
    media: [],
    result: '',
    resultEntryIds: [],
    principle: '',
    hypothesis: '',
    minimumStructure: '',
    discard: '',
    comparison: '',
    conditions: '',
    success: '',
    failure: '',
    observe: '',
    tech: '',
    v30m: '',
    v2h: '',
    v1d: '',
    done: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** 原理（または CONNECT 結果）から設計の下書きを作る */
export function draftFromPrinciple(src: PrincipleSource): Pick<ExperimentDesign, ExperimentField> {
  const principle = src.principle || src.title;
  const discard = src.discard || '（この実験で作らないもの）';
  return {
    principle,
    hypothesis:
      src.hypothesis ||
      `「${truncate(principle, 50)}」が正しければ、原理を使った版は使わない版より、少ない手間で同じ結果に近づくはず`,
    minimumStructure: src.minimumStructure || '（要素 + 関係 + ルール の形で書く）',
    discard: `見た目・保存・ログイン・細かい設定など、原理と関係ない部分。\n原理の側で捨てているもの：${discard}`,
    comparison: src.discard
      ? `捨てているもの（${truncate(src.discard, 40)}）を捨てない、普通のやり方の版`
      : '原理を使わない、普通のやり方の版',
    conditions: '入力・時間・評価のしかたをそろえ、「原理あり／なし」の1点だけを変える。各条件を同じ回数（例：10回）試す。',
    success: '原理あり版が、決めた指標で原理なし版を上回る。かつ、捨てたものによる損失が許容できる範囲に収まる。',
    failure: src.counterexample
      ? `差が出ない、または損失が大きすぎる。特に反例「${truncate(src.counterexample, 60)}」が再現したら仮説を見直す。`
      : '差が出ない、または捨てたものによる損失が大きすぎる。',
    observe: '完了までの時間／判断や操作の回数／誤差や失敗の回数。CSV かコンソールに数値で残す。',
    tech: 'HTML + JavaScript の1ファイル（ブラウザだけで動く）。必要なら表計算。外部サービスは使わない。',
    v30m: '紙か表計算、または1ファイルのHTMLで最小構造だけを動かす。比較は手で数えてよい。',
    v2h: '原理あり／なしを切り替えられる小さなシミュレーションにして、各条件を10回ずつ実行し数値を記録する。',
    v1d: 'パラメータ（数・強さ・ノイズ）を振って、原理が壊れる境界を探す。結果を簡単なグラフにする。',
  };
}

export function draftFromIdea(idea: string): Pick<ExperimentDesign, ExperimentField> {
  const base = draftFromPrinciple({
    id: 'idea',
    kind: 'item',
    title: idea,
    category: 'connect',
    principle: idea,
    minimumStructure: '',
    input: '',
    transformation: '',
    speed: '',
    discard: '',
    tradeoff: '',
    counterexample: '',
    hypothesis: '',
    invert: '',
    transferIdeas: [],
    tags: [],
  });
  return { ...base, principle: idea };
}

export interface ReadinessItem {
  label: string;
  ok: boolean;
}

/** 「本当に作りたい場合のみ」実装プロンプトへ進むためのチェック */
export function readiness(d: Pick<ExperimentDesign, ExperimentField>): ReadinessItem[] {
  const has = (s: string) => s.trim().length >= 6;
  return [
    { label: '検証したい原理がある', ok: has(d.principle) },
    { label: '反証できる仮説がある', ok: has(d.hypothesis) },
    { label: '比較対象がある', ok: has(d.comparison) },
    { label: '成功条件と失敗条件がある', ok: has(d.success) && has(d.failure) },
    { label: '30分版がある', ok: has(d.v30m) },
  ];
}

type PromptInput = Pick<ExperimentDesign, ExperimentField> & Partial<Pick<ExperimentDesign, 'question' | 'formats'>>;

function designBlock(d: PromptInput): string {
  return [
    ...(d.question?.trim() ? [`## 何を確かめたいか\n${d.question.trim()}`] : []),
    ...(d.formats?.length ? [`## 最小実験の形\n${d.formats.join('・')}`] : []),
    `## 検証したい原理\n${d.principle}`,
    `## 仮説\n${d.hypothesis}`,
    `## 最小構造\n${d.minimumStructure}`,
    `## 捨てる要素（作らないもの）\n${d.discard}`,
    `## 比較対象\n${d.comparison}`,
    `## 実験条件\n${d.conditions}`,
    `## 成功条件\n${d.success}`,
    `## 失敗条件\n${d.failure}`,
    `## 観測するデータ\n${d.observe}`,
    `## 必要技術\n${d.tech}`,
    `## 段階\n- 30分版：${d.v30m}\n- 2時間版：${d.v2h}\n- 1日版：${d.v1d}`,
  ].join('\n\n');
}

export function claudeCodePrompt(d: PromptInput): string {
  return [
    '# 実験の実装依頼（PRINCIPLE LOOP / EXPERIMENT DESIGN より）',
    '',
    'これは「原理が本当に効くか」を確かめるための小さな実験です。プロダクトではありません。',
    'まず「30分版」だけを実装してください。2時間版・1日版は、30分版の結果を見てから私が判断します。',
    '',
    designBlock(d),
    '',
    '## 実装のルール',
    '- 最小構造だけを作る。「捨てる要素」に書いたものは作らない。',
    '- 原理あり／なしを1か所の切り替え（定数やボタン）で比較できるようにする。',
    '- 「観測するデータ」を数値で出力する（画面表示 + CSV かコンソール）。',
    '- 成功条件・失敗条件のどちらに当たったかが、結果から読み取れるようにする。',
    '- 依存は増やさない。可能なら HTML + JavaScript の1ファイル。',
    '- 作業の前に、実装方針を3〜5行で説明してから始める。',
    '',
    '## 完了したら',
    '- 実行方法',
    '- 観測できた数値（または観測方法）',
    '- 仮説について言えること／まだ言えないこと',
    'を短く報告してください。',
  ].join('\n');
}

export function codexPrompt(d: PromptInput): string {
  return [
    'Task: Build the "30-minute version" of a small experiment that tests one principle. Not a product.',
    '回答とコメントは日本語で。',
    '',
    designBlock(d),
    '',
    '## Constraints',
    '- Implement only the minimum structure. Do NOT build anything listed under 捨てる要素.',
    '- One toggle switches between 原理あり and 原理なし (the comparison).',
    '- Output the observed data as numbers (on screen + CSV or console).',
    '- No new dependencies. Prefer a single HTML + JavaScript file.',
    '',
    '## Acceptance criteria',
    '- Both conditions run with the same inputs.',
    '- The output makes it possible to judge 成功条件 vs 失敗条件.',
    '- README section (or top-of-file comment) explains how to run it in under 5 lines.',
  ].join('\n');
}
