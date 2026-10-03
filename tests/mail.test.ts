import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import type { DailyFile } from '../src/shared/types.ts';
import { silentLogger } from '../scripts/lib/log.ts';
import { ROOT } from '../scripts/lib/paths.ts';
import { readActivity, readState } from '../scripts/lib/state.ts';
import { runMail, type MailContext } from '../scripts/mail/run-mail.ts';
import { mailConfigFromEnv, resolveAppUrl, type MailSender } from '../scripts/mail/send.ts';
import { DAILY_SUBJECT, appLink, buildDailyEmail, buildPauseEmail, escapeHtml } from '../scripts/mail/template.ts';
import { MONDAY, SUNDAY, tempData } from './helpers.ts';
import type { EmailContent } from '../scripts/mail/template.ts';

const sample = JSON.parse(await readFile(path.join(ROOT, 'tests/fixtures/sample-daily.json'), 'utf8')) as DailyFile;
const APP = 'https://nakajima-yuji.github.io/principle-loop/';

function recorder() {
  const sent: EmailContent[] = [];
  const sender: MailSender = async (m) => {
    sent.push(m);
  };
  return { sent, sender };
}

async function withDaily(date: string, opts: Parameters<typeof tempData>[0] = {}) {
  const paths = await tempData(opts);
  await writeFile(path.join(paths.dailyDir, `${date}.json`), JSON.stringify({ ...sample, date }));
  return paths;
}

const ctx = (paths: MailContext['paths'], sender: MailSender | null, over: Partial<MailContext> = {}): MailContext => ({
  now: new Date('2026-10-05T07:05:00+09:00'),
  paths,
  log: silentLogger,
  sender,
  appUrl: APP,
  force: false,
  dryRun: false,
  ...over,
});

test('件名・本文・DEEP へのリンク（# ルーティング）', () => {
  const m = buildDailyEmail(sample, APP);
  assert.equal(m.subject, DAILY_SUBJECT);
  assert.equal(m.subject, 'PRINCIPLE LOOP DAILY｜今日の7つの原理');
  assert.match(m.html, /今日、世界で見つけた7つの原理。/);
  assert.equal((m.html.match(/>DEEPで掘る</g) ?? []).length, 7);
  assert.match(m.html, /https:\/\/nakajima-yuji\.github\.io\/principle-loop\/#\/deep\?id=20261003-03/);
  assert.match(m.text, /DEEPで掘る：https:\/\/nakajima-yuji\.github\.io\/principle-loop\/#\/deep\?id=20261003-01/);
  assert.equal(appLink('https://a.example/x', '/deep', { id: '1' }), 'https://a.example/x/#/deep?id=1');
});

test('HTML に入る文字はエスケープする', () => {
  const evil = { ...sample, items: sample.items.map((i, n) => (n === 0 ? { ...i, title: '<script>alert(1)</script>', sourceUrl: 'javascript:alert(1)' } : i)) };
  const m = buildDailyEmail(evil, APP);
  assert.doesNotMatch(m.html, /<script>alert/);
  assert.doesNotMatch(m.html, /href="javascript:/);
  assert.equal(escapeHtml(`<a href="x">'&`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
});

test('作成中止の記事はメールでもはっきり分かる（仮の文章も DEEP ボタンも出さない）', () => {
  const daily = {
    ...sample,
    provider: 'gemini',
    principleOfTheDay: sample.items[0].id,
    items: sample.items.map((it, i) =>
      i === 0 ? { ...it, analysisFailed: true, failReason: 'AI が混み合っていた・つながらなかったため' } : i === 1 ? { ...it, aiProvider: 'mock' } : it,
    ),
  };
  const m = buildDailyEmail(daily, APP);
  assert.equal((m.html.match(/>作成中止</g) ?? []).length, 2, '印のある 1 件 + 古い形式の 1 件');
  assert.equal((m.html.match(/>DEEPで掘る</g) ?? []).length, 5);
  assert.match(m.html, /7 件のうち 2 件は「作成中止」/);
  assert.match(m.html, /AI が混み合っていた/);
  assert.doesNotMatch(m.html, /この原理を深く掘る/, 'POTD が作成中止なら出さない');
  assert.match(m.text, /1\. \[作成中止\]/);
});

test('停止のお知らせの文面', () => {
  const m = buildPauseEmail(APP, 10);
  assert.match(m.text, /PRINCIPLE LOOPを一時停止しました。\n再開したい場合はアプリから再開できます。/);
  assert.match(m.html, /#\/activity/);
});

test('朝のメール：1日1回だけ送る。送ってもユーザーの活動にはならない', async () => {
  const paths = await withDaily('2026-10-05');
  const before = await readActivity(paths);
  const { sent, sender } = recorder();
  const r1 = await runMail(ctx(paths, sender));
  assert.equal(r1.status, 'sent');
  assert.equal(sent.length, 1);
  assert.equal((await readState(paths)).lastMailedDate, '2026-10-05');
  assert.deepEqual(await readActivity(paths), before, 'メール送信で lastActive を更新しない');

  const r2 = await runMail(ctx(paths, sender, { now: new Date('2026-10-05T07:35:00+09:00') }));
  assert.equal(r2.status, 'already');
  assert.equal(sent.length, 1);
});

test('日曜は送らない', async () => {
  const paths = await withDaily('2026-10-04');
  const { sent, sender } = recorder();
  const r = await runMail(ctx(paths, sender, { now: new Date(SUNDAY.getTime() + 6.5 * 3600_000) }));
  assert.equal(r.status, 'skipped-sunday');
  assert.equal(sent.length, 0);
});

test('停止した朝に1回だけお知らせを送り、その後は何も送らない', async () => {
  const paths = await withDaily('2026-10-05', { activity: { paused: true, inactivityDays: 10 }, state: { pauseNoticePending: true } });
  const { sent, sender } = recorder();
  const r1 = await runMail(ctx(paths, sender));
  assert.equal(r1.status, 'pause-notice-sent');
  assert.equal(r1.disableWorkflow, true);
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /一時停止/);
  assert.equal((await readState(paths)).pauseNoticePending, false);

  const r2 = await runMail(ctx(paths, sender, { now: new Date('2026-10-06T07:05:00+09:00') }));
  assert.equal(r2.status, 'skipped-paused');
  assert.equal(sent.length, 1);
});

test('DAILY が無い日・認証情報が無いときは送らない', async () => {
  const paths = await tempData();
  const { sent, sender } = recorder();
  assert.equal((await runMail(ctx(paths, sender))).status, 'no-daily');
  const p2 = await withDaily('2026-10-05');
  assert.equal((await runMail(ctx(p2, null))).status, 'no-credentials');
  assert.equal(sent.length, 0);
  assert.equal(MONDAY.getUTCDay(), 0, '2026-10-05 00:40 JST は UTC では日曜');
});

test('メール設定は Secrets（環境変数）から読む。Yahoo の送信元アドレス', () => {
  assert.deepEqual(mailConfigFromEnv({}).missing, ['MAIL_USERNAME', 'MAIL_PASSWORD', 'MAIL_TO']);
  const c = mailConfigFromEnv({ MAIL_USERNAME: 'taro', MAIL_PASSWORD: 'p', MAIL_TO: 'a@x.jp, b@y.jp' }).config;
  assert.equal(c?.host, 'smtp.mail.yahoo.co.jp');
  assert.equal(c?.port, 465);
  assert.equal(c?.from, '"PRINCIPLE LOOP" <taro@yahoo.co.jp>');
  assert.deepEqual(c?.to, ['a@x.jp', 'b@y.jp']);
  assert.equal(mailConfigFromEnv({ MAIL_USERNAME: 'taro@yahoo.co.jp', MAIL_PASSWORD: 'p', MAIL_TO: 'a@x.jp' }).config?.from, '"PRINCIPLE LOOP" <taro@yahoo.co.jp>');
});

test('アプリの URL', () => {
  assert.equal(resolveAppUrl({ GITHUB_REPOSITORY: 'Nakajima-Yuji/principle-loop' }), 'https://nakajima-yuji.github.io/principle-loop/');
  assert.equal(resolveAppUrl({ GITHUB_REPOSITORY: 'me/me.github.io' }), 'https://me.github.io/');
  assert.equal(resolveAppUrl({ APP_URL: 'https://example.com/pl' }), 'https://example.com/pl/');
});

test('activity.ts：heartbeat は停止を解かず、resume は解く', async () => {
  const run = promisify(execFile);
  const paths = await tempData({ activity: { paused: true, lastActive: '2026-09-01T00:00:00.000Z' }, state: { pauseNoticePending: true } });
  const root = path.dirname(path.dirname(paths.stateFile));
  await run(process.execPath, [path.join(ROOT, 'scripts/activity.ts'), '--action=heartbeat', `--data-root=${root}`]);
  let a = await readActivity(paths);
  assert.equal(a.paused, true);
  assert.notEqual(a.lastActive, '2026-09-01T00:00:00.000Z');
  await run(process.execPath, [path.join(ROOT, 'scripts/activity.ts'), '--action=resume', `--data-root=${root}`]);
  a = await readActivity(paths);
  assert.equal(a.paused, false);
  assert.equal(a.inactivityDays, 0);
  assert.equal((await readState(paths)).pauseNoticePending, false);
  await assert.rejects(run(process.execPath, [path.join(ROOT, 'scripts/activity.ts'), '--action=rm -rf', `--data-root=${root}`]));
});
