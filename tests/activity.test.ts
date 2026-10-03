import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyHeartbeat, applyResume, computeInactivityDays, daysUntilPause, decideRun, normalizeActivity } from '../src/shared/activity.ts';
import { isSundayJst, jstDateString } from '../src/shared/time.ts';

const at = (iso: string) => new Date(iso);

test('cron は UTC。土曜 15:30 UTC は日本時間の日曜 00:30 なので日曜扱い', () => {
  const sat1530utc = at('2026-10-03T15:30:00Z');
  assert.equal(jstDateString(sat1530utc), '2026-10-04');
  assert.equal(isSundayJst(sat1530utc), true);
  // 日曜 15:30 UTC は月曜 00:30 JST
  assert.equal(isSundayJst(at('2026-10-04T15:30:00Z')), false);
});

test('日曜は何もしない（停止判定より先）', () => {
  const d = decideRun({ lastActive: '2026-09-01T00:00:00Z', inactivityDays: 0, paused: false }, at('2026-10-04T00:40:00+09:00'));
  assert.equal(d.kind, 'skip-sunday');
});

test('停止中は何もしない', () => {
  const d = decideRun({ lastActive: '2026-10-04T00:00:00Z', inactivityDays: 0, paused: true }, at('2026-10-05T00:40:00+09:00'));
  assert.equal(d.kind, 'skip-paused');
});

test('9日と少しなら動く、10日（240時間）たったら停止', () => {
  const last = '2026-09-25T12:00:00Z';
  const nine = decideRun({ lastActive: last, inactivityDays: 0, paused: false }, at('2026-10-05T11:59:00Z'));
  assert.equal(nine.kind, 'run');
  if (nine.kind === 'run') assert.equal(nine.activity.inactivityDays, 9);

  const ten = decideRun({ lastActive: last, inactivityDays: 0, paused: false }, at('2026-10-05T12:00:00Z'));
  assert.equal(ten.kind, 'pause');
  if (ten.kind === 'pause') {
    assert.equal(ten.activity.paused, true);
    assert.equal(ten.activity.inactivityDays, 10);
    assert.equal(ten.activity.lastActive, last, '停止しても最後の反応の時刻は変えない');
  }
});

test('初回（記録なし）はセットアップした時点を最初の活動とみなす', () => {
  const now = at('2026-10-05T00:40:00+09:00');
  const d = decideRun({ lastActive: '', inactivityDays: 0, paused: false }, now);
  assert.equal(d.kind, 'run');
  if (d.kind === 'run') assert.equal(d.activity.lastActive, now.toISOString());
});

test('上限を変えられる（0 なら自動停止しない）', () => {
  const act = { lastActive: '2026-09-01T00:00:00Z', inactivityDays: 0, paused: false };
  assert.equal(decideRun(act, at('2026-10-05T00:40:00+09:00'), 0).kind, 'run');
  assert.equal(decideRun(act, at('2026-10-05T00:40:00+09:00'), 60).kind, 'run');
});

test('heartbeat は lastActive を今にし、停止中なら停止のまま。resume は停止を解く', () => {
  const now = at('2026-10-05T03:00:00Z');
  const hb = applyHeartbeat({ lastActive: '2026-09-01T00:00:00Z', inactivityDays: 12, paused: true }, now);
  assert.deepEqual(hb, { lastActive: now.toISOString(), inactivityDays: 0, paused: true });
  assert.deepEqual(applyResume(now), { lastActive: now.toISOString(), inactivityDays: 0, paused: false });
});

test('activity.json は 3 つのフィールドだけに整える', () => {
  const a = normalizeActivity({ lastActive: '2026-10-01T00:00:00Z', inactivityDays: 3.7, paused: 'yes', secret: 'x', history: [1, 2] });
  assert.deepEqual(a, { lastActive: '2026-10-01T00:00:00Z', inactivityDays: 3, paused: false });
  assert.deepEqual(normalizeActivity(null), { lastActive: '', inactivityDays: 0, paused: false });
  assert.deepEqual(normalizeActivity({ lastActive: 'not a date' }).lastActive, '');
});

test('あと何日で停止するか', () => {
  const act = { lastActive: '2026-10-01T00:00:00Z', inactivityDays: 0, paused: false };
  assert.equal(computeInactivityDays(act.lastActive, at('2026-10-04T01:00:00Z')), 3);
  assert.equal(daysUntilPause(act, at('2026-10-04T01:00:00Z')), 7);
  assert.equal(daysUntilPause(act, at('2026-11-04T01:00:00Z')), 0);
});
