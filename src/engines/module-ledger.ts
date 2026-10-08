/**
 * 思考モジュール更新台帳。
 *
 * ここに書かれた「仮説」は人物本人の公式見解ではなく、PRINCIPLE LOOPで
 * 検証するモデルである。既存定義を上書きせず、更新候補と実験結果を残す。
 */

export type ModuleDecision = 'adopted' | 'hold' | 'experimental';

export interface ModuleLedgerEntry {
  moduleId: string;
  moduleName: string;
  oldVersion: string;
  newVersionCandidate: string;
  updatedAt: string;
  addedOperations: string[];
  rationale: string[];
  unverifiedHypotheses: string[];
  changeCandidates: string[];
  comparisonExperiment: {
    status: 'not-run' | 'planned' | 'completed';
    subject?: string;
    result?: string[];
  };
  decision: ModuleDecision;
  rollback: string;
}

const baseline = (moduleId: string, moduleName: string, operations: string[], rationale: string[], hypotheses: string[]): ModuleLedgerEntry => ({
  moduleId,
  moduleName,
  oldVersion: 'unversioned',
  newVersionCandidate: '0.1',
  updatedAt: '2026-10-09',
  addedOperations: operations,
  rationale,
  unverifiedHypotheses: hypotheses,
  changeCandidates: ['同じ題材で更新前後を比較し、単なる言い換えでないか確認する', '人物本人の資料が得られたら事実・観察・仮説を再分類する'],
  comparisonExperiment: { status: 'planned', subject: '同じDAILY観察を旧定義・新候補で処理する' },
  decision: 'experimental',
  rollback: `module-ledger.ts の ${moduleId} エントリを削除し、src/engines/index.ts の追加定義を戻す`,
});

export const MODULE_LEDGER: readonly ModuleLedgerEntry[] = [
  baseline('okada', 'OKADA', ['即興仮説生成', '多問題統合', '時代的前提破壊'], ['既存の構造抽出を保ったまま研究中の操作を選択式で追加'], ['暫定仮説を説明しながら更新すると構造抽出が速くなる可能性']),
  baseline('minakata', 'MINAKATA', ['大量化', '遠距離化', '異分野化', '萃点探索'], ['評価前の探索空間を広げる役割を維持'], ['遠い接続を増やしても、林フィルターで伝達可能性を回復できる可能性']),
  baseline('hayashi', 'HAYASHI', ['未知保護', '伝達力と未知の2軸評価', '予測誤差'], ['伝達力だけで未知の原石を捨てないため'], ['低評価の候補に将来の光点が含まれる可能性']),
  baseline('akimoto', 'AKIMOTO REACTOR', ['相互作用', 'フィードバック', '遅延・閾値', '創発観察'], ['複数主体の独立モジュールを追加'], ['小さな系の反復で意図しない秩序を再現できる可能性']),
  baseline('akasegawa', 'AKASEGAWA', ['用途保留', '痕跡・余白・ズレの記録'], ['価値判断前の違和感を保護'], ['用途不明のまま残すほど、後の転用可能性が増える可能性']),
  baseline('ochiai', 'OCHIAI', ['前提変更', '境界変更', '観測器変更'], ['既存の観測方法変更を維持'], ['観測器そのものを作品・道具にすると別の自然が立ち上がる可能性']),
  baseline('kondo', 'KONDO', ['不確実性圧縮', '失敗先行', '代理世界', '実用品化'], ['観察・事実・仮説を分離し、制御可能な判断へ圧縮'], ['調査量と実用性の最適な停止点を決められる可能性']),
  baseline('sakurai', 'SAKURAI GAMES', ['操作→反応→意味→次の選択', '最小試遊', '予測誤差'], ['ゲーム・インタラクション向けの独立モデルを追加'], ['説明ではなく行動の連鎖を試すと面白さの成立条件を発見できる可能性']),
  baseline('luhmann', 'LUHMANN SYSTEM', ['原子化', '接続', '再発見', '創発候補'], ['通常エンジンと別系統の明示起動を維持'], ['遠距離かつ構造適合度の高い接続から新しい原理候補が出る可能性']),
  baseline('jima', 'JIMA FILTER', ['明示判断', '推定判断', '短期・長期の分離', '未知保護'], ['人物エンジンを改変せず、ユーザーの採用判断だけを学習'], ['少数の反応から長期嗜好を断定しない方が探索範囲を保てる']),
];

export function getModuleLedgerEntry(moduleId: string): ModuleLedgerEntry | undefined {
  return MODULE_LEDGER.find((entry) => entry.moduleId === moduleId);
}
