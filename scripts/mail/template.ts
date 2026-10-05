// HTML メール。メールソフトで崩れにくいよう、表組み＋インライン CSS で書く。

import { categoryOf } from '../../src/shared/categories.ts';
import { FAILED_LABEL, isAnalysisFailed, withFailureFlags } from '../../src/shared/item-status.ts';
import { LIGHT_DEEP_LINES, getLightDeep } from '../../src/shared/light-deep.ts';
import { formatJaDate } from '../../src/shared/time.ts';
import type { DailyFile, DailyItem } from '../../src/shared/types.ts';

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export const DAILY_SUBJECT = 'PRINCIPLE LOOP DAILY｜今日の7つの原理';

export function escapeHtml(s: string): string {
  return (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

function safeUrl(u: string): string {
  return /^https?:\/\//.test(u) ? u : '#';
}

/** GitHub Pages の # ルーティングでも壊れないリンク（例：https://.../principle-loop/#/deep?id=20261005-03） */
export function appLink(appUrl: string, route: string, params: Record<string, string> = {}): string {
  const base = appUrl.endsWith('/') ? appUrl : `${appUrl}/`;
  const q = new URLSearchParams(params).toString();
  return `${base}#${route}${q ? `?${q}` : ''}`;
}

const C = {
  bg: '#f2f5f9',
  card: '#ffffff',
  line: '#e2e8f0',
  ink: '#0e1d3a',
  ink2: '#33425e',
  ink3: '#66758f',
  blue: '#2f66e8',
  blueSoft: '#e7efff',
};

const CAT_COLOR: Record<string, [string, string]> = {
  nature: ['#1f8a54', '#e6f5ec'],
  tech: ['#2c5fd6', '#e8efff'],
  science: ['#0f8b7d', '#e1f4f1'],
  mind: ['#6a51cf', '#efebfd'],
  build: ['#1b7fae', '#e3f2fa'],
  culture: ['#c2414b', '#fdecee'],
  foreign: ['#3b4293', '#eaecf8'],
};

const FONT = `-apple-system,'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Yu Gothic',Meiryo,sans-serif`;

function failedBlock(it: DailyItem, n: number, appUrl: string): string {
  const read = appLink(appUrl, '/read', { id: it.id });
  return `
<tr><td style="padding:0 0 14px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffafa;border:1px dashed #e3b9be;border-radius:14px;">
    <tr><td style="padding:16px 20px;font-family:${FONT};">
      <div style="font-size:12px;color:${C.ink3};">
        <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:11px;background:#b4bccb;color:#fff;font-weight:700;">${n}</span>
        <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:6px;background:#fdecee;color:#c2414b;font-weight:800;">${FAILED_LABEL}</span>
        <span style="margin-left:6px;">${escapeHtml(categoryOf(it.category).short)}</span>
      </div>
      <p style="margin:10px 0 6px 0;font-size:14px;line-height:1.7;color:#c2414b;font-weight:700;">AI の分析を作れませんでした（${escapeHtml(it.failReason || '理由不明')}）。</p>
      <p style="margin:0 0 8px 0;font-size:13px;line-height:1.7;color:${C.ink3};">元の記事：<a href="${escapeHtml(safeUrl(it.sourceUrl))}" style="color:${C.ink3};">${escapeHtml(it.sourceTitle || it.title)}</a>（${escapeHtml(it.sourceName || '')}）</p>
      <a href="${escapeHtml(read)}" style="font-size:12px;color:${C.blue};">アプリで要約を見る・自分で掘る</a>
    </td></tr>
  </table>
</td></tr>`;
}

/** LIGHT DEEP の3行（AI はここで止まる。面白いかどうかはアプリで選ぶ） */
function lightDeepRows(it: DailyItem): string {
  const ld = getLightDeep(it);
  if (!ld) return '';
  return LIGHT_DEEP_LINES.filter((l) => ld[l.key])
    .map(
      (l) =>
        `<tr><td valign="top" style="width:52px;padding:2px 0;font-size:11px;font-weight:800;color:${C.blue};font-family:${FONT};">${escapeHtml(l.short)}</td><td style="padding:2px 0;font-size:13px;line-height:1.6;color:${C.ink2};font-family:${FONT};">${escapeHtml(ld[l.key])}</td></tr>`,
    )
    .join('');
}

function itemBlock(it: DailyItem, n: number, appUrl: string): string {
  if (isAnalysisFailed(it)) return failedBlock(it, n, appUrl);
  const [fg, bg] = CAT_COLOR[it.category] ?? [C.ink2, C.bg];
  const deep = appLink(appUrl, '/deep', { id: it.id });
  const read = appLink(appUrl, '/read', { id: it.id });
  return `
<tr><td style="padding:0 0 14px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.line};border-radius:14px;">
    <tr><td style="padding:18px 20px 16px 20px;font-family:${FONT};">
      <div style="font-size:12px;color:${C.ink3};">
        <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:11px;background:#5d6b83;color:#fff;font-weight:700;">${n}</span>
        <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:6px;background:${bg};color:${fg};font-weight:700;">${escapeHtml(categoryOf(it.category).short)}</span>
      </div>
      <a href="${escapeHtml(read)}" style="display:block;margin:10px 0 8px 0;font-size:17px;line-height:1.5;font-weight:800;color:${C.ink};text-decoration:none;">${escapeHtml(it.title)}</a>
      <p style="margin:0 0 12px 0;font-size:14px;line-height:1.8;color:${C.ink2};">${escapeHtml(it.hook)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px 0;background:#f3f8ff;border:1px dashed #b7cdf7;border-radius:10px;"><tr><td style="padding:8px 12px;">
        <div style="font-size:11px;font-weight:800;color:${C.blue};letter-spacing:.04em;font-family:${FONT};margin-bottom:2px;">LIGHT DEEP（AI は3行で止めています）</div>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${lightDeepRows(it)}</table>
      </td></tr></table>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        <td style="font-size:12px;color:${C.ink3};font-family:${FONT};">出典：<a href="${escapeHtml(safeUrl(it.sourceUrl))}" style="color:${C.ink3};">${escapeHtml(it.sourceName || it.sourceTitle)}</a></td>
        <td align="right"><a href="${escapeHtml(deep)}" style="display:inline-block;padding:8px 14px;border-radius:9px;background:${C.blue};color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;font-family:${FONT};">DEEPで掘る</a></td>
      </tr></table>
    </td></tr>
  </table>
</td></tr>`;
}

function layout(inner: string, preheader: string): string {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PRINCIPLE LOOP</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">
${inner}
</table></td></tr></table></body></html>`;
}

export function buildDailyEmail(input: DailyFile, appUrl: string): EmailContent {
  const daily = withFailureFlags(input);
  const potdItem = daily.items.find((i) => i.id === daily.principleOfTheDay) ?? daily.items[0];
  const potd = potdItem && !isAnalysisFailed(potdItem) ? potdItem : undefined;
  const failedCount = daily.items.filter(isAnalysisFailed).length;
  const header = `
<tr><td style="padding:0 0 18px 0;font-family:${FONT};">
  <div style="font-size:13px;font-weight:800;letter-spacing:.12em;color:${C.blue};">PRINCIPLE LOOP DAILY</div>
  <div style="font-size:24px;font-weight:800;color:${C.ink};margin-top:4px;">今日、世界で見つけた7つの原理。</div>
  <div style="font-size:13px;color:${C.ink3};margin-top:4px;">${escapeHtml(formatJaDate(daily.date))}</div>
</td></tr>`;
  const potdBlock = potd
    ? `
<tr><td style="padding:0 0 18px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ink};border-radius:14px;"><tr><td style="padding:18px 20px;font-family:${FONT};">
    <div style="font-size:12px;font-weight:800;letter-spacing:.1em;color:#9fc0ff;">PRINCIPLE OF THE DAY</div>
    <div style="font-size:17px;line-height:1.6;font-weight:800;color:#ffffff;margin:8px 0;">${escapeHtml(getLightDeep(potd)?.structure || potd.principleCandidate)}</div>
    <div style="font-size:12px;color:#c7d2e4;">飛ばす先：${escapeHtml(getLightDeep(potd)?.transfer || potd.minimumStructure)}</div>
    <a href="${escapeHtml(appLink(appUrl, '/deep', { id: potd.id }))}" style="display:inline-block;margin-top:12px;padding:8px 14px;border-radius:9px;background:#ffffff;color:${C.ink};font-size:13px;font-weight:700;text-decoration:none;">この原理を深く掘る</a>
  </td></tr></table>
</td></tr>`
    : '';
  const notice =
    (daily.provider === 'mock'
      ? `<tr><td style="padding:0 0 14px 0;font-family:${FONT};font-size:12px;color:#8c5d00;">※ AI の設定がまだのため、分析は仮のテンプレートです。</td></tr>`
      : '') +
    (failedCount > 0
      ? `<tr><td style="padding:0 0 14px 0;font-family:${FONT};font-size:12px;color:#c2414b;">※ ${daily.items.length} 件のうち ${failedCount} 件は「${FAILED_LABEL}」です（AI の分析を作れませんでした）。</td></tr>`
      : '');
  const footer = `
<tr><td style="padding:8px 4px 0 4px;font-family:${FONT};font-size:12px;line-height:1.8;color:${C.ink3};">
  <a href="${escapeHtml(appLink(appUrl, '/daily'))}" style="color:${C.blue};">アプリで開く</a> ・
  <a href="${escapeHtml(appLink(appUrl, '/activity'))}" style="color:${C.blue};">稼働状況</a><br>
  事実（情報源）と AI の解釈（仮説）は分けて書いています。AI は3行で止めています。面白いかどうか・掘るかどうかは、アプリで選んでください。<br>
  メールを受け取っただけでは「反応」に数えません。10日間アプリでの反応がないと、自動で一時停止します。日曜日はお休みです。
</td></tr>`;
  const html = layout(header + potdBlock + notice + daily.items.map((it, i) => itemBlock(it, i + 1, appUrl)).join('') + footer, '今日、世界で見つけた7つの原理。');

  const text = [
    '今日、世界で見つけた7つの原理。',
    formatJaDate(daily.date),
    '',
    ...(potd ? [`■ PRINCIPLE OF THE DAY`, getLightDeep(potd)?.structure || potd.principleCandidate, appLink(appUrl, '/deep', { id: potd.id }), ''] : []),
    ...(failedCount > 0 ? [`※ ${daily.items.length} 件のうち ${failedCount} 件は「${FAILED_LABEL}」です（AI の分析を作れませんでした）。`, ''] : []),
    ...daily.items.flatMap((it, i) =>
      isAnalysisFailed(it)
        ? [
            `${i + 1}. [${FAILED_LABEL}] ${categoryOf(it.category).short}`,
            `AI の分析を作れませんでした（${it.failReason || '理由不明'}）。`,
            `元の記事：${it.sourceTitle || it.title} ${it.sourceUrl}`,
            '',
          ]
        : [
      `${i + 1}. [${categoryOf(it.category).short}] ${it.title}`,
      it.hook,
      ...LIGHT_DEEP_LINES.map((l) => `${l.short}：${getLightDeep(it)?.[l.key] ?? ''}`),
      `出典：${it.sourceName || it.sourceTitle} ${it.sourceUrl}`,
      `DEEPで掘る：${appLink(appUrl, '/deep', { id: it.id })}`,
      '',
          ],
    ),
    `アプリ：${appLink(appUrl, '/daily')}`,
    'メールを受け取っただけでは「反応」に数えません。10日間アプリでの反応がないと自動で一時停止します。',
  ].join('\n');

  return { subject: DAILY_SUBJECT, html, text };
}

export function buildPauseEmail(appUrl: string, inactivityDays: number): EmailContent {
  const link = appLink(appUrl, '/activity');
  const html = layout(
    `
<tr><td style="padding:0 0 18px 0;font-family:${FONT};">
  <div style="font-size:13px;font-weight:800;letter-spacing:.12em;color:#c2414b;">PRINCIPLE LOOP PAUSED</div>
  <div style="font-size:22px;font-weight:800;color:${C.ink};margin-top:6px;">PRINCIPLE LOOPを一時停止しました。</div>
</td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:14px;padding:20px;font-family:${FONT};font-size:14px;line-height:1.9;color:${C.ink2};">
  ${inactivityDays}日間アプリでの反応がなかったため、夜間の収集・AI生成・DAILY生成・朝のメールを止めました。<br>
  再開したい場合はアプリから再開できます。<br>
  このお知らせは今回の1回だけで、再開するまでメールは届きません。
  <div style="margin-top:16px;"><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:${C.blue};color:#fff;font-weight:700;text-decoration:none;">アプリを開いて再開する</a></div>
</td></tr>`,
    'PRINCIPLE LOOPを一時停止しました。',
  );
  const text = [
    'PRINCIPLE LOOPを一時停止しました。',
    '再開したい場合はアプリから再開できます。',
    '',
    `${inactivityDays}日間アプリでの反応がなかったため、夜間の収集・AI生成・DAILY生成・朝のメールを止めました。`,
    'このお知らせは今回の1回だけです。',
    link,
  ].join('\n');
  return { subject: 'PRINCIPLE LOOP｜一時停止しました', html, text };
}
