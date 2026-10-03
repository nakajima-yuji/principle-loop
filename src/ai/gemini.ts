// Google Gemini API（無料枠あり）。https://ai.google.dev/
// モデル名は AI_MODEL で変えられる。無料枠の対象モデルは時期によって変わるので README を参照。

import { AIError, type AIProvider, type AIRequest, type AIResponse } from './provider.ts';

export const GEMINI_DEFAULT_MODEL = 'gemini-3.1-flash-lite';

interface GeminiOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string; details?: { '@type'?: string; retryDelay?: string }[] };
}

function retryDelayMs(body: GeminiResponse): number | undefined {
  const d = body.error?.details?.find((x) => x.retryDelay)?.retryDelay;
  const m = d ? /^(\d+(?:\.\d+)?)s$/.exec(d) : null;
  return m ? Math.ceil(Number(m[1]) * 1000) : undefined;
}

export function createGeminiProvider(opts: GeminiOptions): AIProvider {
  const model = opts.model || GEMINI_DEFAULT_MODEL;
  const doFetch = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 90_000;
  if (!opts.apiKey) throw new Error('AI_API_KEY が設定されていません');

  return {
    name: 'gemini',
    model,
    async generate(req: AIRequest): Promise<AIResponse> {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      let res: Response;
      try {
        res = await doFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: req.system }] },
            contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
            generationConfig: {
              temperature: req.temperature ?? 0.7,
              maxOutputTokens: req.maxOutputTokens,
              ...(req.json ? { responseMimeType: 'application/json' } : {}),
            },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        throw new AIError(`Gemini に接続できませんでした: ${(e as Error).message}`, 0, true);
      }

      let body: GeminiResponse = {};
      try {
        body = (await res.json()) as GeminiResponse;
      } catch {
        // 本文が JSON でない場合はステータスだけで判断する
      }
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        throw new AIError(`Gemini エラー ${res.status}: ${body.error?.message ?? res.statusText}`, res.status, retryable, retryDelayMs(body));
      }
      if (body.promptFeedback?.blockReason) {
        throw new AIError(`Gemini が応答を拒否しました: ${body.promptFeedback.blockReason}`, 400, false);
      }
      const cand = body.candidates?.[0];
      const text = (cand?.content?.parts ?? [])
        .filter((p) => !p.thought)
        .map((p) => p.text ?? '')
        .join('')
        .trim();
      if (!text) {
        throw new AIError(`Gemini の応答が空でした（${cand?.finishReason ?? '理由不明'}）`, 200, cand?.finishReason !== 'SAFETY');
      }
      return {
        text,
        inputTokens: body.usageMetadata?.promptTokenCount,
        outputTokens: body.usageMetadata?.candidatesTokenCount,
      };
    },
  };
}
