import { createGeminiProvider } from './gemini.ts';
import { createMockProvider } from './mock.ts';
import { createOpenAICompatibleProvider } from './openai-compatible.ts';
import type { AIProvider } from './provider.ts';

export interface ProviderConfig {
  provider?: string; // 'gemini' | 'openai-compatible' | 'mock'（未指定ならキーの有無で決める）
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function createProvider(cfg: ProviderConfig): AIProvider {
  const name = (cfg.provider || (cfg.apiKey ? 'gemini' : 'mock')).trim().toLowerCase();
  switch (name) {
    case 'gemini':
      return createGeminiProvider({ apiKey: cfg.apiKey ?? '', model: cfg.model, fetchImpl: cfg.fetchImpl });
    case 'openai-compatible':
    case 'openai':
      return createOpenAICompatibleProvider({ apiKey: cfg.apiKey ?? '', baseUrl: cfg.baseUrl ?? '', model: cfg.model ?? '', fetchImpl: cfg.fetchImpl });
    case 'mock':
      return createMockProvider();
    default:
      throw new Error(`AI_PROVIDER「${name}」には対応していません（gemini / openai-compatible / mock）`);
  }
}
