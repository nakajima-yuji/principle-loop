import { parseJsonLoose } from '../../src/ai/provider.ts';
import type { AutoIdea, DailyFile } from '../../src/shared/types.ts';

interface AutoCandidate {
  title: string;
  one_sentence: string;
  principle: string;
  structure: string;
  cross_domain_connection: string;
  why_interesting: string;
  possible_medium: string;
  image_prompt: string;
  source_daily?: string[];
  distance?: number;
  wildness?: number;
}

interface OpenAIOptions {
  apiKey: string;
  textModel: string;
  imageModel: string;
  imageQuality: 'low' | 'medium' | 'high';
  maxRetries: number;
  fetchImpl?: typeof fetch;
}

const system = `あなたは PRINCIPLE LOOP AUTO の編集エンジンです。
岡田エンジン（違和感検出、観察器変更、分解、固有要素除去、関係・構造抽出、深層掘削、同型探索、移植）を最初に行い、南方コレクターとして遠い分野へ展開し、林フィルターで候補を絞り、JIMA FILTERの評価傾向を必要最小限だけ反映します。
素材は必ず当日のDAILYに含まれる観察から始め、過去情報や評価は補助に限定します。岡田・南方・林・JIMAは混ぜず、名前を変更しません。
最終結果はBEST（完成度）、FAR（遠い異分野接続）、WILD（ユーザーが普段考えなさそう）の3方向です。短く具体的に書き、事実と発想を混同しないでください。`;

async function requestJson<T>(opts: OpenAIOptions, body: unknown): Promise<T> {
  const doFetch = opts.fetchImpl ?? fetch;
  let last: unknown;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt += 1) {
    try {
      const res = await doFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
      if (!res.ok) throw new Error(`OpenAI text ${res.status}: ${json.error?.message ?? res.statusText}`);
      return parseJsonLoose<T>(json.choices?.[0]?.message?.content ?? '');
    } catch (error) {
      last = error;
      if (attempt >= opts.maxRetries) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

export async function generateIdeas(opts: OpenAIOptions, daily: DailyFile, feedback: string): Promise<AutoIdea[]> {
  const observations = daily.items.map((item) => ({
    id: item.id,
    category: item.category,
    title: item.title,
    observation: item.observation,
    principle: item.principleCandidate,
    structure: item.lightDeep?.structure ?? item.minimumStructure,
    transfer: item.lightDeep?.transfer ?? item.transferIdeas.join('、'),
  }));
  const prompt = `当日のDAILY素材:\n${JSON.stringify(observations)}\n\nJIMA FILTERの過去傾向（補助、空なら無視）:\n${feedback || 'なし'}\n\nまず候補を${Math.min(15, observations.length * 2)}件作り、林フィルターで検討したうえで、BEST/FAR/WILDを各1件返してください。JSON配列のみで、各要素は category, title, one_sentence, source_daily（id配列）, principle, structure, cross_domain_connection, why_interesting, why_selected, possible_medium, image_prompt を持たせてください。image_promptは文字やロゴを含めないコンセプトビジュアル用です。`;
  const result = await requestJson<{ ideas?: AutoCandidate[] } | AutoCandidate[]>(opts, {
    model: opts.textModel,
    messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 3000,
  });
  const raw = Array.isArray(result) ? result : result.ideas ?? [];
  const kinds: AutoIdea['category'][] = ['BEST', 'FAR', 'WILD'];
  return kinds.map((category, index) => {
    const candidate = raw[index] ?? raw.find((x) => x.title);
    if (!candidate) throw new Error(`${category} の候補がありません`);
    return {
      date: daily.date,
      category,
      title: String(candidate.title).slice(0, 160),
      one_sentence: String(candidate.one_sentence).slice(0, 400),
      source_daily: Array.isArray(candidate.source_daily) ? candidate.source_daily.map(String).slice(0, 5) : observations.slice(0, 1).map((x) => x.id),
      principle: String(candidate.principle).slice(0, 300),
      structure: String(candidate.structure).slice(0, 300),
      cross_domain_connection: String(candidate.cross_domain_connection).slice(0, 300),
      why_interesting: String(candidate.why_interesting).slice(0, 300),
      why_selected: category === 'BEST' ? '林フィルターで完成度と入口の強さを優先' : category === 'FAR' ? '南方コレクターで最も遠い接続を優先' : 'JIMA FILTERで未知性を優先',
      possible_medium: String(candidate.possible_medium).slice(0, 120),
      image_prompt: String(candidate.image_prompt).slice(0, 800),
    };
  });
}

export async function generateImage(opts: OpenAIOptions, prompt: string): Promise<Buffer> {
  const doFetch = opts.fetchImpl ?? fetch;
  let last: unknown;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt += 1) {
    try {
      const res = await doFetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify({ model: opts.imageModel, prompt, n: 1, size: '1024x1024', quality: opts.imageQuality, output_format: 'webp' }),
        signal: AbortSignal.timeout(180_000),
      });
      const json = (await res.json()) as { data?: { b64_json?: string }[]; error?: { message?: string } };
      if (!res.ok || !json.data?.[0]?.b64_json) throw new Error(`OpenAI image ${res.status}: ${json.error?.message ?? res.statusText}`);
      return Buffer.from(json.data[0].b64_json, 'base64');
    } catch (error) {
      last = error;
      if (attempt >= opts.maxRetries) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}
