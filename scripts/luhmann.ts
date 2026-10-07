// LUHMANN SYSTEM の明示起動CLI。
// 通常の run.ts / DAILY / DIARY / AUTO からは呼ばれない。
// 例: npm run luhmann -- --input="蜘蛛の巣"

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createProvider } from '../src/ai/index.ts';
import { withLimits } from '../src/ai/provider.ts';
import { buildLuhmannRequest, parseLuhmannResult } from '../src/systems/luhmann/core.ts';

function arg(name: string): string {
  const value = process.argv.slice(2).find((x) => x === `--${name}` || x.startsWith(`--${name}=`));
  return value?.includes('=') ? value.slice(value.indexOf('=') + 1) : '';
}

const input = arg('input') || process.env.LUHMANN_INPUT || '';
if (!input.trim()) throw new Error('LUHMANN SYSTEMは明示入力が必要です。--input="テーマ・観察・作品" を指定してください');

const provider = createProvider({
  provider: process.env.LUHMANN_PROVIDER || process.env.AI_PROVIDER,
  apiKey: process.env.LUHMANN_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_API_KEY,
  model: process.env.LUHMANN_MODEL || process.env.AI_MODEL,
  baseUrl: process.env.LUHMANN_BASE_URL || process.env.AI_BASE_URL,
});
const limited = withLimits(provider, { maxRequests: 1, minIntervalMs: 0, maxRetries: 1, maxPromptChars: 30_000, maxOutputTokens: 6_000 });
const response = await limited.generate(buildLuhmannRequest(input.trim()));
const result = parseLuhmannResult(input.trim(), response.text);
const output = `${JSON.stringify(result, null, 2)}\n`;
const out = arg('out');
if (out) {
  const target = path.resolve(out);
  await writeFile(target, output, 'utf8');
  console.error(`LUHMANN SYSTEM temporary result を明示保存しました: ${target}`);
}
process.stdout.write(output);

