import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { candidateFromItem, toDailyItem } from '../scripts/generate/normalize.ts';
import { analyzePrompt } from '../scripts/generate/prompts.ts';
import { ROOT } from '../scripts/lib/paths.ts';
import {
  countBySource,
  createNoteEntry,
  diarySource,
  entryToTimeline,
  filterTimeline,
  groupByDate,
  repoToTimeline,
  withNoteSource,
  withNoteText,
} from '../src/lib/note.ts';
import { parseRepoNote } from '../src/lib/repo-note.ts';
import { formatLightDeep, LIGHT_DEEP_MAX_CHARS, lightDeepOf, lightDeepPrompt, normalizeLightDeep, parseLightDeep } from '../src/shared/deep.ts';
import { withFailureFlags } from '../src/shared/item-status.ts';
import type { DailyFile, DiaryEntry } from '../src/shared/types.ts';

const sample = JSON.parse(await readFile(path.join(ROOT, 'tests/fixtures/sample-daily.json'), 'utf8')) as DailyFile;

const USER_EXAMPLE = `DEEP
・なぜ気になった？ → 見えない対象を痕跡から推測する構造がある。
・どこが原理？ → 対象そのものより、残された情報が探索欲を生む。
・次は？ → ゲーム・絵本・建築など別分野にも同型があるかもしれない。`;

// ---------------- 3行DEEP ----------------

test('3行DEEP：ユーザーが決めた形式（・なぜ気になった？ → …）を読み取れる', () => {
  const d = parseLightDeep(USER_EXAMPLE);
  assert.deepEqual(d, {
    why: '見えない対象を痕跡から推測する構造がある。',
    principle: '対象そのものより、残された情報が探索欲を生む。',
    next: 'ゲーム・絵本・建築など別分野にも同型があるかもしれない。',
  });
  assert.equal(formatLightDeep({ ...d!, by: 'user' }), USER_EXAMPLE, '書き出すと同じ形に戻る');
});

test('3行DEEP：普通の文（「次の探索対象：」など）を 3行DEEP と取り違えない', () => {
  assert.equal(parseLightDeep('次の探索対象：\n> 気配・足跡・餌\n原理：最初から決めない'), null);
  assert.equal(parseLightDeep('今日の観察。\n長い文章が続く。'), null);
  // ラベルなしでも「DEEP」の直後の箇条書き 3 行は読む
  assert.deepEqual(parseLightDeep('## DEEP\n- A かもしれない\n- B\n- C'), { why: 'A かもしれない', principle: 'B', next: 'C' });
});

test('3行DEEP：AI の返答を整える（ラベル・矢印・箇条書きを外す、長すぎる行は切る、3行そろわなければ付けない）', () => {
  const d = normalizeLightDeep({ why: '・なぜ気になった？ → 痕跡が先に見える', principle: 'どこが原理？：情報が探索を生む', next: 'あ'.repeat(200) }, 'ai', { requireAll: true });
  assert.equal(d?.why, '痕跡が先に見える');
  assert.equal(d?.principle, '情報が探索を生む');
  assert.equal(d?.next.length, LIGHT_DEEP_MAX_CHARS);
  assert.equal(d?.by, 'ai');
  assert.equal(normalizeLightDeep({ why: 'a', principle: '', next: 'c' }, 'ai', { requireAll: true }), undefined);
  assert.equal(normalizeLightDeep(undefined, 'ai'), undefined);
  assert.deepEqual(normalizeLightDeep(['a', 'b', 'c'], 'user'), { why: 'a', principle: 'b', next: 'c', by: 'user' });
});

test('3行DEEP：古い DAILY（deep が無い）は既存の分析から短く抜き出す。作成中止・自分で追加したものには付けない', () => {
  const it = sample.items[0];
  assert.equal(it.deep, undefined);
  const d = lightDeepOf(it);
  assert.equal(d?.by, 'derived');
  assert.ok(d && d.principle.length > 0 && d.principle.length <= 60);
  assert.ok(d && d.why.length <= 60 && d.next.length <= 60);

  const withDeep = { ...it, deep: { why: 'w', principle: 'p', next: 'n', by: 'ai' as const } };
  assert.equal(lightDeepOf(withDeep)?.principle, 'p', 'AI の 3行DEEP があればそれを使う');

  const legacy = withFailureFlags({ ...sample, provider: 'gemini', items: sample.items.map((x, i) => (i === 0 ? { ...x, aiProvider: 'mock' } : x)) });
  assert.equal(lightDeepOf(legacy.items[0]), null, '作成中止');
  assert.equal(lightDeepOf({ ...it, aiProvider: 'manual' }), null, 'URL から掘った現象');
  assert.equal(lightDeepOf({ ...it, aiProvider: 'mock' }), null, 'AI 未設定の仮テンプレート');
});

test('3行DEEP：AI チャットに頼む文面（ルールと本文入り。自動では送らない）', () => {
  const p = lightDeepPrompt('全部を深掘りするとAIが答えを作りすぎる', 'メモ');
  assert.match(p, /3行だけ/);
  assert.match(p, /原理候補は1つだけ/);
  assert.match(p, /・なぜ気になった？ → \n・どこが原理？ → \n・次は？ → /);
  assert.match(p, /全部を深掘りするとAIが答えを作りすぎる/);
});

test('夜間処理：AI に 3行DEEP を頼み、そろっていれば item.deep に入れる（無ければ付けない＝今までと同じ形）', () => {
  const c = candidateFromItem(sample.items[0]);
  const meta = { id: '20261005-01', date: '2026-10-05', category: sample.items[0].category, provider: 'gemini' };
  assert.match(analyzePrompt(c, c.category, '', ''), /"deep": \{"why"/);
  assert.match(analyzePrompt(c, c.category, '', ''), /結論を確定しない/);

  const base = { title: 't', hook: 'h', principleCandidate: 'p', minimumStructure: 'm' };
  const withDeep = toDailyItem({ ...base, deep: { why: 'なぜ', principle: '原理', next: '次' } }, c, meta);
  assert.deepEqual(withDeep.deep, { why: 'なぜ', principle: '原理', next: '次', by: 'ai' });
  const without = toDailyItem(base, c, meta);
  assert.equal('deep' in without, false, '古い形の返答でも壊れない');
  assert.equal('deep' in toDailyItem({ ...base, deep: { why: 'a', principle: 'b', next: 'c' } }, c, { ...meta, provider: 'mock' }), false, '仮テンプレートには付けない');
});

// ---------------- Memo / 気づき ----------------

test('Memo / 気づき：そのまま DIARY の 1 件として保存できる形になる（AI の分析はしない）', () => {
  const now = new Date('2026-10-05T12:34:00Z'); // 日本時間 21:34
  const e = createNoteEntry({ text: '  DIARYは深掘りする場所ではなく、種を残す場所かもしれない\n数日後に見返す  ', source: 'insight', tags: ['#DIARY', 'DIARY', ' 種 '] }, now, 'insight-1');
  assert.equal(e.kind, 'manual');
  assert.equal(e.source, 'insight');
  assert.equal(e.state, 'OBSERVATION');
  assert.equal(e.item.date, '2026-10-05');
  assert.equal(e.item.title, 'DIARYは深掘りする場所ではなく、種を残す場所かもしれない');
  assert.equal(e.item.hook, 'DIARYは深掘りする場所ではなく、種を残す場所かもしれない\n数日後に見返す');
  assert.equal(e.item.principleCandidate, '');
  assert.equal(e.item.aiProvider, 'insight');
  assert.equal(e.deep, undefined, '保存した瞬間には 3行DEEP を作らない');
  assert.deepEqual(e.tags, ['DIARY', '種']);
  assert.equal(e.createdAt, now.toISOString(), '時刻を持つ');

  const edited = withNoteSource(withNoteText(e.item, '全部を深掘りするとAIが答えを作りすぎる'), 'memo');
  assert.equal(edited.title, '全部を深掘りするとAIが答えを作りすぎる');
  assert.equal(edited.aiProvider, 'memo');
  assert.equal(diarySource({ ...e, source: 'memo', item: edited }), 'memo');
});

test('情報源（SOURCE）：古いデータ（source なし）も kind から判定する', () => {
  const daily: DiaryEntry = { id: sample.items[1].id, kind: 'daily', state: 'HYPOTHESIS', item: sample.items[1], memo: '', tags: [], experiments: [], createdAt: '2026-10-04T01:00:00Z', updatedAt: '' };
  assert.equal(diarySource(daily), 'daily');
  assert.equal(diarySource({ ...daily, kind: 'connect' }), 'daily');
  assert.equal(diarySource({ ...daily, kind: 'manual', item: { ...daily.item, aiProvider: 'manual' } }), 'memo', 'URL から掘った現象は、自分が送ったメモ');
  assert.equal(diarySource({ ...daily, source: 'insight' }), 'insight', '保存されている source を優先');
});

test('DIARY の時系列：DAILY と Memo / 気づき（端末・リポジトリ）が同じ日付にまとまり、ALL / DAILY / MEMO / 気づき で絞れる', () => {
  // 古い形式の DAILY 保存（source なし）。拾った日（item.date）にまとめる
  const daily: DiaryEntry = { id: sample.items[1].id, kind: 'daily', state: 'HYPOTHESIS', item: { ...sample.items[1], date: '2026-10-05' }, memo: 'ゲームに使えそう', tags: ['群衆'], experiments: [], createdAt: '2026-10-06T01:00:00Z', updatedAt: '' };
  const memo = createNoteEntry({ text: '全部を深掘りするとAIが答えを作りすぎる', source: 'memo' }, new Date('2026-10-05T03:00:00Z'), 'memo-1');
  const insight = createNoteEntry({ text: 'DIARYは種を残す場所かもしれない', source: 'insight', tags: ['群衆'] }, new Date('2026-10-05T09:00:00Z'), 'insight-1');
  const older = createNoteEntry({ text: '前の日のメモ', source: 'memo' }, new Date('2026-10-04T09:00:00Z'), 'memo-0');
  const repo = parseRepoNote('memo/2026-10-05-trace.md', '---\ntype: memo\ntime: 21:30\ntags: 痕跡、探索\n---\n# 痕跡のメモ\n\n本体より先に痕跡が見えると、探したくなる。\n');

  const items = [daily, memo, insight, older].map((e) => entryToTimeline(e)).concat(repoToTimeline(repo));
  const groups = groupByDate(items);
  assert.deepEqual(
    groups.map((g) => g.date),
    ['2026-10-05', '2026-10-04'],
  );
  assert.deepEqual(
    groups[0].items.map((t) => t.source),
    ['daily', 'memo', 'insight', 'memo'],
    '同じ日の中は新しい順（DAILY は保存した時刻、リポジトリは time）',
  );
  assert.deepEqual(countBySource(items), { daily: 1, memo: 3, insight: 1 });
  assert.deepEqual(
    filterTimeline(items, { source: 'memo' }).map((t) => t.id),
    ['memo-1', 'memo-0', repo.id],
  );
  assert.deepEqual(filterTimeline(items, { state: 'HYPOTHESIS' }).map((t) => t.id), [daily.id], '状態で絞るとリポジトリの Markdown は出ない');
  assert.deepEqual(filterTimeline(items, { tag: '群衆' }).map((t) => t.id).sort(), [daily.id, 'insight-1'].sort());
  assert.deepEqual(filterTimeline(items, { query: 'ゲームに使えそう' }).map((t) => t.id), [daily.id], '自分のメモも検索できる');
  assert.equal(items[0].text, sample.items[1].principleCandidate, 'DAILY の 2 行目は原理候補');
});

// ---------------- リポジトリの Markdown ----------------

test('リポジトリの Markdown：front matter（type / date / time / tags）と 3行DEEP を読む', () => {
  const n = parseRepoNote('/memo/idea.md', `---\ntype: 気づき\ndate: 2026/10/5\ntime: 7:05\ntags: #痕跡, 探索\n---\n# 2026-10-05 — 痕跡\n\n本文の最初。\n\n${USER_EXAMPLE}\n`);
  assert.equal(n.source, 'insight');
  assert.equal(n.date, '2026-10-05');
  assert.equal(n.time, '07:05');
  assert.equal(n.title, '痕跡', '見出しの先頭の日付は外す');
  assert.equal(n.excerpt, '本文の最初。');
  assert.deepEqual(n.tags, ['痕跡', '探索']);
  assert.equal(n.deep?.principle, '対象そのものより、残された情報が探索欲を生む。');
  assert.equal(n.path, 'memo/idea.md');
  assert.equal(n.id, 'repo-memo-idea');
  // front matter が無ければフォルダで種類を決める
  assert.equal(parseRepoNote('memo/x.md', 'メモだけ').source, 'memo');
  assert.equal(parseRepoNote('diary/x.md', '観察だけ').source, 'insight');
  assert.equal(parseRepoNote('diary/x.md', '観察だけ').date, '');
});

test('リポジトリの Markdown：今ある diary/ と research/ の記録が DIARY に並ぶ形で読める', async () => {
  const files = ['diary/2026-10-04-okada-engine-park-observation.md', 'research/2026-10-04-park-observation-discovery-principle.md'];
  for (const f of files) {
    const n = parseRepoNote(f, await readFile(path.join(ROOT, f), 'utf8'));
    assert.equal(n.source, 'insight', f);
    assert.equal(n.date, '2026-10-04', f);
    assert.ok(n.title && !/^\d{4}-/.test(n.title), `${f}: ${n.title}`);
    assert.ok(n.excerpt.length > 10, f);
    assert.equal(n.deep, null, `${f}：3行DEEP が書かれていないので付けない`);
  }
});
