// 文字列まわりの小さな道具（ブラウザ・Node 両用、DOM 非依存）

export function truncate(text: string, max: number): string {
  const t = (text ?? '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function paragraphs(text: string): string[] {
  return (text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, '').trim())
    .filter(Boolean);
}

export function uniq<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

/** 検索・類似度用の正規化（全角英数→半角、小文字、空白をつめる） */
export function normalizeText(text: string): string {
  return (text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** 文字 n-gram（日本語でも使えるように単語分割せず文字単位で） */
export function charNgrams(text: string, n = 2): Set<string> {
  const s = normalizeText(text).replace(/[\s\p{P}\p{S}]+/gu, '');
  const grams = new Set<string>();
  if (s.length < n) {
    if (s) grams.add(s);
    return grams;
  }
  for (let i = 0; i <= s.length - n; i++) grams.add(s.slice(i, i + n));
  return grams;
}

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export function textSimilarity(a: string, b: string, n = 2): number {
  return jaccard(charNgrams(a, n), charNgrams(b, n));
}

/** 「A、B、C」や改行区切りを配列に */
export function splitList(text: string): string[] {
  return (text ?? '')
    .split(/[、,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
