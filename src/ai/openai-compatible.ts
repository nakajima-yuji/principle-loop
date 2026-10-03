// OpenAI 互換の Chat Completions API（Groq・OpenRouter・ローカルの Ollama など）。
// Gemini の無料枠が終わったときの乗り換え先として使える。
// AI_PROVIDER=openai-compatible / AI_BASE_URL / AI_MODEL / AI_API_KEY を設定する。

import { AIError, type AIProvider, type AIRequest, type AIResponse } from './provider.ts';

interface Options {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface ChatResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

export function createOpenAICompatibleProvider(opts: Options): AIProvider {
  if (!opts.baseUrl) throw new Error('AI_BASE_URL が設定されていません');
  if (!opts.model) throw new Error('AI_MODEL が設定されていません');
  const doFetch = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl.replace(/\/+$/, '');

  return {
    name: 'openai-compatible',
    model: opts.model,
    async generate(req: AIRequest): Promise<AIResponse> {
      let res: Response;
      try {
        res = await doFetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: opts.model,
            messages: [
              { role: 'system', content: req.system },
              { role: 'user', content: req.prompt },
            ],
            temperature: req.temperature ?? 0.7,
            max_tokens: req.maxOutputTokens,
            ...(req.json ? { response_format: { type: 'json_object' } } : {}),
          }),
          signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
        });
      } catch (e) {
        throw new AIError(`AI に接続できませんでした: ${(e as Error).message}`, 0, true);
      }
      let body: ChatResponse = {};
      try {
        body = (await res.json()) as ChatResponse;
      } catch {
        // ステータスで判断
      }
      if (!res.ok) {
        const retryAfter = Number(res.headers.get('retry-after'));
        throw new AIError(
          `AI エラー ${res.status}: ${body.error?.message ?? res.statusText}`,
          res.status,
          res.status === 429 || res.status >= 500,
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
        );
      }
      const text = body.choices?.[0]?.message?.content?.trim() ?? '';
      if (!text) throw new AIError('AI の応答が空でした', 200, true);
      return { text, inputTokens: body.usage?.prompt_tokens, outputTokens: body.usage?.completion_tokens };
    },
  };
}
