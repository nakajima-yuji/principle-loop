// TRANSFORM（展開）：エンジンで抜いた「構造の種」を、固定せずに変形する操作の一覧。
// 2026-10-04 の公園観察メモ（diary/）の「展開工程」から。自動では実行しない。選んで使う足場。

export interface TransformOp {
  id: string;
  label: string;
  example?: string;
  kind?: 'operation' | 'technique' | 'lens';
}

export const TRANSFORM_OPS: readonly TransformOp[] = [
  { id: 'noun', label: '名詞を変える', example: '蜘蛛 → 透明人間', kind: 'operation' },
  { id: 'trace', label: '痕跡の性質を変える', example: '足跡 → 匂い・音・温度' },
  { id: 'verb', label: '動詞を変える', example: '探す → 隠す・追う・待つ' },
  { id: 'order', label: '順番を変える', example: '本体より先に痕跡を見せる' },
  { id: 'invert', label: '因果を反転する' },
  { id: 'roles', label: '役割を増やす' },
  { id: 'pair', label: '二者関係にする', example: '一人の探索 → 探す側と隠れる側' },
  { id: 'combine', label: '複数の構造を組み合わせる' },
  { id: 'mutual', label: '観測と被観測を相互化する', example: '見ると自分も見られる', kind: 'lens' },
  { id: 'risk', label: '情報量とリスクを連動させる' },
  { id: 'decoy', label: '真の痕跡に偽装・罠を混ぜる' },
  { id: 'parts', label: '既存システムを部品として組み合わせる', example: 'FPS・罠・偽装' },
  { id: 'motif', label: '構造を残したままモチーフを交換する' },
];

/** 人物由来エンジンから選んで使う一般操作。人物エンジンそのものではない。 */
export const ENGINE_OPERATIONS: readonly TransformOp[] = [
  { id: 'deep-drill', label: '深層掘削', example: '現象→関係→機構→原因→機能→認知・感情→情報→力・資源', kind: 'technique' },
  { id: 'state-change', label: '状態変化探索', example: '対象×条件→状態変化→新しい性質→再利用', kind: 'operation' },
  { id: 'unknown-premise', label: '知らない前提', example: '用途・固有名詞・文化常識を知らない人には何に見えるか', kind: 'lens' },
  { id: 'observation-shift', label: '観察器変更', example: '子ども・動物・センサー・100年後・AIの視点', kind: 'lens' },
  { id: 'latent-function', label: '潜在機能を見る', example: '変化した後に何ができるようになったか', kind: 'operation' },
  { id: 'extreme', label: '極端化', example: '条件・時間・規模を極端に振る', kind: 'operation' },
  { id: 'counterexample', label: '例外収集', example: '通常ではなく、うまくいかない例から構造を拾う', kind: 'operation' },
  // OKADA v3.0: independent research hypotheses, not confirmed author terminology.
  { id: 'improvised-hypothesis', label: '即興仮説生成（研究中）', example: '暫定説明を出す→説明しながら更新→前提と反例を確認', kind: 'technique' },
  { id: 'multi-problem-unification', label: '多問題統合（研究中）', example: '複数の問題を一つの因果構造で説明できるか検証', kind: 'technique' },
  { id: 'historical-premise-disruption', label: '時代的前提破壊（研究中）', example: '現代の常識を外し、異なる時代の制約で再構成', kind: 'technique' },
  // v3.1: PRINCIPLE LOOP experimental extensions. Not established as Toshio Okada's own methods.
  { id: 'hypothesis-branching', label: '仮説の連続生成（実験）', example: '同じ現象に対して相互に異なる仮説を3つ出し、観察可能な差を探す', kind: 'technique' },
  { id: 'self-falsification', label: '自己反証（実験）', example: '最有力仮説が破綻する条件・反例・代替説明を明示する', kind: 'technique' },
  { id: 'contradiction-drill', label: '矛盾の深掘り（実験）', example: '相反する欲求・制約を同時に生む原因を特定する', kind: 'technique' },
  { id: 'practice-theory-revision', label: '行動による理論更新（実験）', example: '仮説→最小実験→観察→説明の更新を設計する', kind: 'technique' },
];

export const ENGINE_LENSES: readonly TransformOp[] = [
  { id: 'observer-subject', label: '観測↔被観測', example: '見るほど自分の位置も相手に伝わる', kind: 'lens' },
  { id: 'knowledge-gap', label: '知識の非対称', example: '合理的な別解・誤解・読み替え', kind: 'lens' },
  { id: 'time-shift', label: '時間をずらす', example: '直後・100年後・変化の途中を見る', kind: 'lens' },
];
