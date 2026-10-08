/**
 * NAKAJIMA FILTER は人物由来エンジンではなく、ユーザーの反応を蓄積する別レイヤー。
 * エンジンの問いや手順を書き換えず、候補の比較・優先順位付けにだけ使う。
 */
export type NakajimaReaction = 'interesting' | 'not_interesting' | 'grow';

export interface NakajimaFeedback {
  id: string;
  reaction: NakajimaReaction;
  comment?: string;
  createdAt: string;
  source?: string;
}

export interface NakajimaFilterProfile {
  version: 1;
  name: 'NAKAJIMA FILTER';
  feedback: NakajimaFeedback[];
}

export const emptyNakajimaFilter = (): NakajimaFilterProfile => ({ version: 1, name: 'NAKAJIMA FILTER', feedback: [] });

export function addNakajimaFeedback(profile: NakajimaFilterProfile, feedback: NakajimaFeedback): NakajimaFilterProfile {
  return { ...profile, feedback: [feedback, ...profile.feedback.filter((x) => x.id !== feedback.id)] };
}

export function reactionSummary(profile: NakajimaFilterProfile): string[] {
  return ['interesting', 'not_interesting', 'grow'].map((reaction) => `${reaction}: ${profile.feedback.filter((x) => x.reaction === reaction).length}`);
}

/**
 * JIMA FILTER v2。
 * 旧 NAKAJIMA FILTER のJSON・API名は壊さず、正式な判断モデルを別型で追加する。
 * 人物エンジンを変更せず、採用判断の根拠と不確実性だけを記録する。
 */
export type JimaDecision = 'ADOPT' | 'HOLD' | 'REJECT';
export type JimaEvidenceKind = 'EXPLICIT' | 'INFERRED';
export type JimaHorizon = 'SHORT' | 'LONG' | 'UNKNOWN';

export interface JimaJudgment {
  id: string;
  decision: JimaDecision;
  evidenceKind: JimaEvidenceKind;
  horizon: JimaHorizon;
  source: string;
  comment?: string;
  createdAt: string;
}

export interface JimaFilterProfile {
  version: 2;
  name: 'JIMA FILTER';
  judgments: JimaJudgment[];
  unknownProtected: number;
}

export const emptyJimaFilter = (): JimaFilterProfile => ({ version: 2, name: 'JIMA FILTER', judgments: [], unknownProtected: 0 });

/** 旧 reactions を捨てずに JIMA v2 の明示判断へ読み替える。 */
export function normalizeJimaProfile(raw: unknown): JimaFilterProfile {
  if (raw && typeof raw === 'object' && (raw as { version?: unknown }).version === 2) {
    const r = raw as Partial<JimaFilterProfile>;
    return {
      version: 2,
      name: 'JIMA FILTER',
      judgments: Array.isArray(r.judgments) ? r.judgments.filter((x): x is JimaJudgment => Boolean(x && typeof x === 'object' && typeof (x as JimaJudgment).id === 'string')) : [],
      unknownProtected: typeof r.unknownProtected === 'number' ? Math.max(0, r.unknownProtected) : 0,
    };
  }
  const old = raw && typeof raw === 'object' ? (raw as { reactions?: NakajimaFeedback[] }).reactions : [];
  const judgments = (Array.isArray(old) ? old : []).flatMap((x) => {
    const decision: JimaDecision | undefined = x.reaction === 'interesting' ? 'ADOPT' : x.reaction === 'grow' ? 'HOLD' : x.reaction === 'not_interesting' ? 'REJECT' : undefined;
    return decision ? [{ id: x.id, decision, evidenceKind: 'EXPLICIT' as const, horizon: 'UNKNOWN' as const, source: x.source ?? 'legacy-reaction', comment: x.comment, createdAt: x.createdAt }] : [];
  });
  return { version: 2, name: 'JIMA FILTER', judgments, unknownProtected: 0 };
}

export function addJimaJudgment(profile: JimaFilterProfile, judgment: JimaJudgment): JimaFilterProfile {
  return { ...profile, judgments: [judgment, ...profile.judgments.filter((x) => x.id !== judgment.id)] };
}

/** 推定だけで候補を没にせず、未知の候補を保護するための集計。 */
export function jimaSummary(profile: JimaFilterProfile): { explicit: number; inferred: number; adopted: number; held: number; rejected: number; unknownProtected: number } {
  return {
    explicit: profile.judgments.filter((x) => x.evidenceKind === 'EXPLICIT').length,
    inferred: profile.judgments.filter((x) => x.evidenceKind === 'INFERRED').length,
    adopted: profile.judgments.filter((x) => x.decision === 'ADOPT').length,
    held: profile.judgments.filter((x) => x.decision === 'HOLD').length,
    rejected: profile.judgments.filter((x) => x.decision === 'REJECT').length,
    unknownProtected: profile.unknownProtected,
  };
}
