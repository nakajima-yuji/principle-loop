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
  player_or_viewer_action?: string;
  core_loop?: string;
  concrete_scene?: string;
  prototype?: string;
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

const system = `あなたは PRINCIPLE LOOP AUTO の企画編集エンジンです。
岡田エンジン（違和感検出、観察器変更、分解、固有要素除去、関係・構造抽出、深層掘削、同型探索、移植）を最初に行い、南方コレクターとして遠い分野へ展開し、林フィルターで候補を絞り、JIMA FILTERの評価傾向を必要最小限だけ反映します。
素材は必ず当日のDAILYに含まれる観察から始め、過去情報や評価は補助に限定します。岡田・南方・林・JIMAは混ぜず、名前を変更しません。
最終結果はBEST（完成度）、FAR（遠い異分野接続）、WILD（ユーザーが普段考えなさそう）の3方向です。
抽象的な「応用できる」「仕組みに使える」で止めてはいけません。必ずゲーム、漫画、短編動画、インタラクティブ作品のいずれかに落とし込み、誰が、どこで、何をして、何が変わるかを書いてください。
各案には、主人公またはプレイヤーの具体的な行動、30秒〜5分で繰り返すコアループ、最初の1シーン、紙や1画面で試せる最小プロトタイプを含めます。会社・行政・組織改善だけの案、単なる「アプリ化」、抽象的な展示案は不採用です。`;

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
      const json = (await res.json()) as { choices?: { message?: { content?: string | { type?: string; text?: string }[] } }[]; error?: { message?: string } };
      if (!res.ok) throw new Error(`OpenAI text ${res.status}: ${json.error?.message ?? res.statusText}`);
      const content = json.choices?.[0]?.message?.content;
      const text = typeof content === 'string' ? content : Array.isArray(content) ? content.map((part) => part.text ?? '').join('') : '';
      return parseJsonLoose<T>(text);
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
  const prompt = `当日のDAILY素材:\n${JSON.stringify(observations)}\n\nJIMA FILTERの過去傾向（補助、空なら無視）:\n${feedback || 'なし'}\n\nまず候補を${Math.min(15, observations.length * 2)}件作り、岡田エンジンで原理と構造を砕き、南方コレクターで遠い分野へ飛ばし、林フィルターで実際に作りたくなる形へ絞ってください。そのうえでBEST/FAR/WILDを各1件返してください。\n\n説明文・Markdown・コードフェンスは禁止です。JSONオブジェクトのみを返し、キーは BEST, FAR, WILD、各値は category, title, one_sentence, source_daily（id配列）, principle, structure, cross_domain_connection, why_interesting, why_selected, possible_medium, player_or_viewer_action, core_loop, concrete_scene, prototype, image_prompt を持たせてください。\n\nplayer_or_viewer_actionは主人公/プレイヤー/視聴者が実際にする動作を1〜2文で、core_loopは「観察→選択→変化」のような反復を具体的に、concrete_sceneは冒頭30秒または漫画1ページ目を、prototypeは紙5枚・1画面・30秒動画など最小の試作方法を書いてください。possible_mediumは GAME / MANGA / SHORT_VIDEO / INTERACTIVE のいずれかを中心に選びます。image_promptはその具体的な場面を描く低コストのコンセプトビジュアル用で、文字・ロゴ・UI画面の文字列は含めません。`;
  const result = await requestJson<{ ideas?: AutoCandidate[]; candidates?: AutoCandidate[]; items?: AutoCandidate[]; BEST?: AutoCandidate; FAR?: AutoCandidate; WILD?: AutoCandidate } | AutoCandidate[]>(opts, {
    model: opts.textModel,
    messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    reasoning_effort: 'low',
    max_completion_tokens: 6000,
  });
  const kinds: AutoIdea['category'][] = ['BEST', 'FAR', 'WILD'];
  const objectResult = Array.isArray(result) ? null : result;
  const raw = Array.isArray(result) ? result : objectResult?.ideas ?? objectResult?.candidates ?? objectResult?.items ?? kinds.map((kind) => objectResult?.[kind]).filter((x): x is AutoCandidate => Boolean(x));
  return kinds.map((category, index) => {
    const candidate = (objectResult?.[category] ?? raw[index] ?? raw.find((x) => x.title)) as AutoCandidate | undefined;
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
      player_or_viewer_action: String(candidate.player_or_viewer_action ?? '主人公が観察し、1つだけ選び、状況の変化を引き起こす').slice(0, 300),
      core_loop: String(candidate.core_loop ?? '観察 → 選択 → 予想外の変化 → 次の観察').slice(0, 300),
      concrete_scene: String(candidate.concrete_scene ?? '最初の場面で、主人公が異変に気づき、最初の選択を迫られる').slice(0, 400),
      prototype: String(candidate.prototype ?? '紙カード5枚または1画面のプロトタイプで1回遊ぶ').slice(0, 300),
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
