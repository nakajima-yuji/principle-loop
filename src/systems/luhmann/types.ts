/** LUHMANN SYSTEM の一時結果。DAILY/DIARYの標準データとは別系統で保持する。 */
export type LuhmannConnectionType = 'NEAR' | 'STRUCTURAL' | 'FAR' | 'OPPOSITE' | 'CAUSAL' | 'CHAIN' | 'TENSION' | 'ANALOGY' | 'INVERSION';

export interface AtomicNote {
  id: string;
  text: string;
  kind: 'IDEA' | 'RELATION' | 'PHENOMENON';
}

export interface LuhmannConnection {
  type: LuhmannConnectionType;
  from: string[];
  to: string[];
  relation: string;
  whyConnected: string;
  distance: number;
  scores: { similarity: number; structuralFit: number; novelty: number; explanatoryPower: number; generativePower: number };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface LuhmannResult {
  version: 1;
  system: 'LUHMANN SYSTEM';
  input: string;
  atomic: AtomicNote[];
  abstracts: string[];
  structures: string[];
  connections: LuhmannConnection[];
  bridges: string[];
  patterns: string[];
  principleCandidates: string[];
  emergentIdeas: string[];
  strangestUsefulConnection: string;
  nextPaths: string[];
  qualityChecks: string[];
  generatedAt: string;
}

