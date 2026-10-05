// TRANSFORM（展開）：エンジンで抜いた「構造の種」を、固定せずに変形する操作の一覧。
// 2026-10-04 の公園観察メモ（diary/）の「展開工程」から。自動では実行しない。選んで使う足場。

export interface TransformOp {
  id: string;
  label: string;
  example?: string;
}

export const TRANSFORM_OPS: readonly TransformOp[] = [
  { id: 'noun', label: '名詞を変える', example: '蜘蛛 → 透明人間' },
  { id: 'trace', label: '痕跡の性質を変える', example: '足跡 → 匂い・音・温度' },
  { id: 'verb', label: '動詞を変える', example: '探す → 隠す・追う・待つ' },
  { id: 'order', label: '順番を変える', example: '本体より先に痕跡を見せる' },
  { id: 'invert', label: '因果を反転する' },
  { id: 'roles', label: '役割を増やす' },
  { id: 'pair', label: '二者関係にする', example: '一人の探索 → 探す側と隠れる側' },
  { id: 'combine', label: '複数の構造を組み合わせる' },
  { id: 'mutual', label: '観測と被観測を相互化する', example: '見ると自分も見られる' },
  { id: 'risk', label: '情報量とリスクを連動させる' },
  { id: 'decoy', label: '真の痕跡に偽装・罠を混ぜる' },
  { id: 'parts', label: '既存システムを部品として組み合わせる', example: 'FPS・罠・偽装' },
  { id: 'motif', label: '構造を残したままモチーフを交換する' },
];
