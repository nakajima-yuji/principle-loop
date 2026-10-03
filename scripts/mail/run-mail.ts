// 朝のメール配信（07:00〜08:00）。日曜・停止中は送らない。
// 停止した直後の朝だけ、1 回だけ「一時停止しました」のお知らせを送る。

import path from 'node:path';
import { isSundayJst, jstDateString } from '../../src/shared/time.ts';
import type { ArchiveIndex, DailyFile } from '../../src/shared/types.ts';
import { emptyArchive } from '../../src/shared/archive.ts';
import { readJsonFile } from '../lib/fsutil.ts';
import type { Logger } from '../lib/log.ts';
import type { Paths } from '../lib/paths.ts';
import { readActivity, readState, writeState } from '../lib/state.ts';
import type { MailSender } from './send.ts';
import { buildDailyEmail, buildPauseEmail } from './template.ts';

export interface MailContext {
  now: Date;
  paths: Paths;
  log: Logger;
  sender: MailSender | null; // 認証情報が無ければ null
  appUrl: string;
  force: boolean;
  dryRun: boolean;
}

export type MailStatus =
  | 'skipped-sunday'
  | 'skipped-paused'
  | 'pause-notice-sent'
  | 'no-daily'
  | 'already'
  | 'no-credentials'
  | 'sent';

export interface MailResult {
  status: MailStatus;
  message: string;
  /** 停止のお知らせを送り終えたら、深夜のワークフロー自体も止めてよい */
  disableWorkflow: boolean;
}

export async function runMail(ctx: MailContext): Promise<MailResult> {
  const today = jstDateString(ctx.now);
  const activity = await readActivity(ctx.paths);
  const state = await readState(ctx.paths);

  if (isSundayJst(ctx.now) && !ctx.force) return { status: 'skipped-sunday', message: '日曜日はメールを送りません', disableWorkflow: false };

  if (activity.paused && !ctx.force) {
    if (!state.pauseNoticePending) {
      return { status: 'skipped-paused', message: '一時停止中のため送りません', disableWorkflow: false };
    }
    if (ctx.sender && !ctx.dryRun) {
      await ctx.sender(buildPauseEmail(ctx.appUrl, activity.inactivityDays));
    }
    if (!ctx.dryRun) await writeState(ctx.paths, { ...state, pauseNoticePending: false });
    return {
      status: 'pause-notice-sent',
      message: ctx.sender ? '一時停止のお知らせを 1 回だけ送りました' : 'メールの設定がないため、お知らせは送らずに停止しました',
      disableWorkflow: true,
    };
  }

  const daily = await readJsonFile<DailyFile | null>(path.join(ctx.paths.dailyDir, `${today}.json`), null);
  if (!daily?.items?.length) return { status: 'no-daily', message: `${today} の DAILY がまだありません（生成に失敗した可能性）`, disableWorkflow: false };
  if (state.lastMailedDate === today && !ctx.force) return { status: 'already', message: '今日のメールは送信済みです', disableWorkflow: false };
  if (!ctx.sender) return { status: 'no-credentials', message: 'メールの Secrets（MAIL_USERNAME / MAIL_PASSWORD / MAIL_TO）が未設定のため送りません', disableWorkflow: false };

  if (!ctx.dryRun) {
    await ctx.sender(buildDailyEmail(daily, ctx.appUrl));
    await writeState(ctx.paths, { ...(await readState(ctx.paths)), lastMailedDate: today });
  }
  return { status: 'sent', message: `${today} の DAILY をメールで送りました`, disableWorkflow: false };
}

/** 動作確認用：最新の DAILY を [テスト] 付きで送る。日曜・停止中でも送る（手動操作なので）。 */
export async function runMailTest(ctx: MailContext): Promise<MailResult> {
  const index = await readJsonFile<ArchiveIndex>(ctx.paths.archiveFile, emptyArchive());
  const latest = index.days[0]?.date;
  const daily = latest ? await readJsonFile<DailyFile | null>(path.join(ctx.paths.dailyDir, `${latest}.json`), null) : null;
  if (!daily) return { status: 'no-daily', message: '送れる DAILY がありません', disableWorkflow: false };
  if (!ctx.sender) return { status: 'no-credentials', message: 'メールの Secrets が未設定です', disableWorkflow: false };
  const mail = buildDailyEmail(daily, ctx.appUrl);
  if (!ctx.dryRun) await ctx.sender({ ...mail, subject: `[テスト] ${mail.subject}` });
  ctx.log.info(`テストメールの宛先数：${process.env.MAIL_TO?.split(/[,;\s]+/).filter(Boolean).length ?? 0}`);
  return { status: 'sent', message: 'テストメールを送りました（受信トレイと迷惑メールフォルダを確認してください）', disableWorkflow: false };
}
