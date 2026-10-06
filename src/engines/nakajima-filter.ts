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
