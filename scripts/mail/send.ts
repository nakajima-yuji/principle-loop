// Yahoo!メール（SMTP）で送る。認証情報は GitHub Secrets から環境変数で受け取り、コードには書かない。
// 既定は Yahoo! JAPAN（smtp.mail.yahoo.co.jp:465 / SSL）。MAIL_HOST・MAIL_PORT で変更できる。

import nodemailer from 'nodemailer';
import type { EmailContent } from './template.ts';

export interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string[];
}

export type MailSender = (mail: EmailContent) => Promise<void>;

export function mailConfigFromEnv(env: NodeJS.ProcessEnv): { config: MailConfig | null; missing: string[] } {
  const missing = ['MAIL_USERNAME', 'MAIL_PASSWORD', 'MAIL_TO'].filter((k) => !env[k]?.trim());
  if (missing.length) return { config: null, missing };
  const user = env.MAIL_USERNAME!.trim();
  const host = env.MAIL_HOST?.trim() || 'smtp.mail.yahoo.co.jp';
  const port = Number(env.MAIL_PORT || 465) || 465;
  // Yahoo!メールは送信元を自分のアドレスにする必要がある
  const domain = host.includes('yahoo.co.jp') ? 'yahoo.co.jp' : host.includes('yahoo.com') ? 'yahoo.com' : '';
  const fromAddr = env.MAIL_FROM?.trim() || (user.includes('@') ? user : domain ? `${user}@${domain}` : user);
  return {
    config: {
      host,
      port,
      user,
      pass: env.MAIL_PASSWORD!,
      from: `"PRINCIPLE LOOP" <${fromAddr}>`,
      to: env.MAIL_TO!.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean).slice(0, 5),
    },
    missing: [],
  };
}

export function createSmtpSender(cfg: MailConfig): MailSender {
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    requireTLS: cfg.port !== 465,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  return async (mail) => {
    // 送信は 1 回だけ再試行する（同じメールを何通も送らないため）
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await transport.sendMail({ from: cfg.from, to: cfg.to, subject: mail.subject, html: mail.html, text: mail.text });
        return;
      } catch (e) {
        lastError = e;
        const code = (e as { responseCode?: number }).responseCode ?? 0;
        if (code >= 500 && code < 600) break; // 認証エラーなどは再試行しても同じ
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    const msg = (lastError as Error)?.message ?? String(lastError);
    // パスワードなどがエラー文に混ざらないように、最初の行だけを出す
    throw new Error(`メールを送れませんでした: ${msg.split('\n')[0].replace(cfg.pass, '***')}`);
  };
}

/** GitHub Pages の URL（APP_URL が無ければ GITHUB_REPOSITORY から作る） */
export function resolveAppUrl(env: NodeJS.ProcessEnv): string {
  const explicit = env.APP_URL?.trim();
  if (explicit) return explicit.endsWith('/') ? explicit : `${explicit}/`;
  const repo = env.GITHUB_REPOSITORY ?? '';
  const [owner, name] = repo.split('/');
  if (!owner || !name) return 'http://localhost:5173/';
  if (name.toLowerCase() === `${owner.toLowerCase()}.github.io`) return `https://${owner.toLowerCase()}.github.io/`;
  return `https://${owner.toLowerCase()}.github.io/${name}/`;
}
