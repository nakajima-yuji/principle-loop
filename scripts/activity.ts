// アプリからの活動通知（heartbeat）と再開（resume）を data/activity.json に反映する。
// activity.yml ワークフローから呼ばれる。入力は決まった 2 種類だけを受け付ける。
//
//   node scripts/activity.ts --action=heartbeat   反応があった（lastActive を今に。停止中なら停止のまま）
//   node scripts/activity.ts --action=resume      再開（inactivity を 0・lastActive を今・paused=false）

import { appendFile } from 'node:fs/promises';
import { applyHeartbeat, applyResume } from '../src/shared/activity.ts';
import { ROOT, makePaths } from './lib/paths.ts';
import { readActivity, readState, writeActivity, writeState } from './lib/state.ts';

const arg = process.argv.find((a) => a.startsWith('--action='))?.split('=')[1] ?? '';
if (arg !== 'heartbeat' && arg !== 'resume') {
  console.error('--action は heartbeat か resume を指定してください');
  process.exit(1);
}

// --data-root はテスト用（既定はリポジトリ直下）
const dataRoot = process.argv.find((a) => a.startsWith('--data-root='))?.split('=')[1];
const paths = makePaths(ROOT, dataRoot || ROOT);
const now = new Date();
const before = await readActivity(paths);
const after = arg === 'resume' ? applyResume(now) : applyHeartbeat(before, now);
await writeActivity(paths, after);

if (arg === 'resume') {
  const state = await readState(paths);
  if (state.pauseNoticePending) await writeState(paths, { ...state, pauseNoticePending: false });
}

console.log(`${arg}: lastActive=${after.lastActive} paused=${after.paused}（前：paused=${before.paused}）`);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `was_paused=${before.paused}\npaused=${after.paused}\n`);
}
