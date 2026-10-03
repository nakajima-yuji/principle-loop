// 公開するファイル（dist/）に秘密情報や AI・メールのコードが混ざっていないかを確かめる。
// npm run check と CI で実行する。

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './lib/paths.ts';

const DIST = path.join(ROOT, 'dist');

const FORBIDDEN: { re: RegExp; why: string }[] = [
  { re: /generativelanguage\.googleapis\.com/, why: 'AI の API がフロントに含まれています' },
  { re: /smtp\.mail\.yahoo/, why: 'SMTP の設定がフロントに含まれています' },
  { re: /nodemailer/i, why: 'メール送信のコードがフロントに含まれています' },
  { re: /AIza[0-9A-Za-z_-]{35}/, why: 'Google の API キーらしき文字列があります' },
  { re: /github_pat_[0-9A-Za-z_]{40,}/, why: 'GitHub のトークンらしき文字列があります' },
  { re: /\bghp_[0-9A-Za-z]{30,}/, why: 'GitHub のトークンらしき文字列があります' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, why: '秘密鍵らしき文字列があります' },
];

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const name of await readdir(dir)) {
    const p = path.join(dir, name);
    if ((await stat(p)).isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const files = (await walk(DIST)).filter((f) => /\.(js|html|css|json|webmanifest|txt|map)$/.test(f));
const problems: string[] = [];
for (const f of files) {
  const text = await readFile(f, 'utf8');
  for (const { re, why } of FORBIDDEN) {
    if (re.test(text)) problems.push(`${path.relative(ROOT, f)}: ${why}`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`dist/ の ${files.length} ファイルを確認しました。秘密情報や AI・メールのコードは含まれていません。`);
