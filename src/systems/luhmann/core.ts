import { parseJsonLoose } from '../../ai/provider.ts';
import type { AIRequest } from '../../ai/provider.ts';
import type { AtomicNote, LuhmannConnection, LuhmannResult } from './types.ts';

export const LUHMANN_SYSTEM_PROMPT = `あなたは LUHMANN SYSTEM です。これはPRINCIPLE LOOPとは別の、明示起動時だけ動く自律思考システムです。
目的は情報収集ではなくCONNECTIONです。入力を原子的な思考単位へ分解し、固有要素を剥がして構造化し、近距離・構造同型・遠距離・反対・因果・連鎖・緊張・類推・反転の接続を作り、接続間からBridge、Pattern、Principle Candidate、Emergenceを発見します。
内部では複数ラウンドを行いますが、ユーザーには圧縮した結果だけを返します。表面的な単語一致、根拠のない因果、何でも成立する抽象化はLOW CONFIDENCEにしてください。DISTANCEが高くSTRUCTURAL FITが高い接続を重視します。
通常のPRINCIPLE LOOP、DAILY、DIARY、MEMOを自動監視・処理・保存してはいけません。与えられたINPUTだけを処理してください。
原理は断定せず、必ず候補として扱います。`;

export function buildLuhmannRequest(input: string): AIRequest {
  return {
    task: 'luhmann',
    system: LUHMANN_SYSTEM_PROMPT,
    prompt: `INPUT:\n${input}\n\n次の一周を自律的に実行してください。\nROUND 1: 1 NOTE = 1 IDEA / 1 RELATION / 1 PHENOMENON で原子化し、固有名詞を除去して抽象化する。\nROUND 2: 現象・関係・機構・原因・機能・認知感情・情報・力資源から有効な構造を抽出する。\nROUND 3: NEAR / STRUCTURAL / FAR / OPPOSITE / CAUSAL / CHAIN / TENSION / ANALOGY / INVERSION を横断して接続する。最低1つはDISTANCE 0.6以上のFARまたはOPPOSITEを含める。\nROUND 4: 複数接続を説明するBRIDGEとPATTERNを作る。\nROUND 5: PRINCIPLE CANDIDATEと、元INPUTに存在しなかったEMERGENT IDEAを作る。\nSELF-CORRECTION: 表面的類似、単語一致、捏造因果、抽象化しすぎ、飛躍を検査する。\n\n説明文やMarkdownは禁止。次のJSON形式だけを返してください:\n{"atomic":[{"id":"A1","text":"","kind":"IDEA|RELATION|PHENOMENON"}],"abstracts":[],"structures":[],"connections":[{"type":"NEAR|STRUCTURAL|FAR|OPPOSITE|CAUSAL|CHAIN|TENSION|ANALOGY|INVERSION","from":[],"to":[],"relation":"","whyConnected":"","distance":0.0,"scores":{"similarity":0,"structuralFit":0,"novelty":0,"explanatoryPower":0,"generativePower":0},"confidence":"HIGH|MEDIUM|LOW"}],"bridges":[],"patterns":[],"principleCandidates":[],"emergentIdeas":[],"strangestUsefulConnection":"","nextPaths":[],"qualityChecks":[]}`,
    json: true,
    maxOutputTokens: 6000,
    temperature: 0.8,
  };
}

const clamp = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);
const strings = (v: unknown, max = 12) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()).slice(0, max) : []);

function normalizeAtomic(v: unknown): AtomicNote[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 30).flatMap((x, i) => {
    if (!x || typeof x !== 'object') return [];
    const r = x as Record<string, unknown>;
    const kind = r.kind === 'RELATION' || r.kind === 'PHENOMENON' ? r.kind : 'IDEA';
    return typeof r.text === 'string' && r.text.trim() ? [{ id: typeof r.id === 'string' ? r.id : `A${i + 1}`, text: r.text.trim().slice(0, 300), kind }] : [];
  });
}

function normalizeConnections(v: unknown): LuhmannConnection[] {
  if (!Array.isArray(v)) return [];
  const types = ['NEAR', 'STRUCTURAL', 'FAR', 'OPPOSITE', 'CAUSAL', 'CHAIN', 'TENSION', 'ANALOGY', 'INVERSION'];
  return v.slice(0, 30).flatMap((x) => {
    if (!x || typeof x !== 'object') return [];
    const r = x as Record<string, unknown>;
    const s = (r.scores && typeof r.scores === 'object' ? r.scores : {}) as Record<string, unknown>;
    if (typeof r.relation !== 'string' || !r.relation.trim()) return [];
    const distance = clamp(r.distance);
    return [{
      type: (types.includes(r.type as string) ? r.type : 'STRUCTURAL') as LuhmannConnection['type'],
      from: strings(r.from, 5), to: strings(r.to, 5), relation: r.relation.trim().slice(0, 500), whyConnected: typeof r.whyConnected === 'string' ? r.whyConnected.trim().slice(0, 500) : '', distance,
      scores: { similarity: clamp(s.similarity), structuralFit: clamp(s.structuralFit), novelty: clamp(s.novelty), explanatoryPower: clamp(s.explanatoryPower), generativePower: clamp(s.generativePower) },
      confidence: r.confidence === 'HIGH' || r.confidence === 'MEDIUM' ? r.confidence : 'LOW',
    }];
  });
}

export function normalizeLuhmannResult(input: string, raw: unknown, generatedAt = new Date().toISOString()): LuhmannResult {
  const r = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return {
    version: 1, system: 'LUHMANN SYSTEM', input, atomic: normalizeAtomic(r.atomic), abstracts: strings(r.abstracts), structures: strings(r.structures), connections: normalizeConnections(r.connections), bridges: strings(r.bridges), patterns: strings(r.patterns), principleCandidates: strings(r.principleCandidates), emergentIdeas: strings(r.emergentIdeas), strangestUsefulConnection: typeof r.strangestUsefulConnection === 'string' ? r.strangestUsefulConnection.trim().slice(0, 600) : '', nextPaths: strings(r.nextPaths), qualityChecks: strings(r.qualityChecks), generatedAt,
  };
}

export function parseLuhmannResult(input: string, text: string, generatedAt?: string): LuhmannResult {
  return normalizeLuhmannResult(input, parseJsonLoose(text), generatedAt);
}
