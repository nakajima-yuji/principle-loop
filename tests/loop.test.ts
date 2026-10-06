import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { ENGINES, ENGINE_PIPELINE_EXAMPLES, engineChatPrompt, getEngine, getOperation, mixQuestions, pipelineChatPrompt, pipelineLabel, toggleEngine, validPipeline } from '../src/engines/index.ts';
import { ENGINE_LENSES, ENGINE_OPERATIONS, TRANSFORM_OPS } from '../src/engines/transform.ts';
import {
  DIARY_FILTERS,
  chronological,
  createMemoEntry,
  entryFromItem,
  experimentEntry,
  lineage,
  matchesDecision,
  matchesFilter,
  migratePersonal,
  needsMigration,
  normalizeEntry,
  parseTags,
  resultEntry,
} from '../src/lib/diary-model.ts';
import { claudeCodePrompt, draftFromPrinciple, emptyDesign } from '../src/lib/experiment.ts';
import { engineToSource, toPrincipleSource } from '../src/lib/principle.ts';
import { deriveLightDeep, getLightDeep, normalizeLightDeep } from '../src/shared/light-deep.ts';
import { CORE_LOCK_QUESTIONS, MEDIA, MINIMAL_EXPERIMENTS, coreLockFilled, emptyCoreLock } from '../src/shared/loop.ts';
import type { DailyFile, DiaryEntry } from '../src/shared/types.ts';
import { isUsable, toDailyItem } from '../scripts/generate/normalize.ts';
import type { Candidate } from '../scripts/filter/filter.ts';
import { ROOT } from '../scripts/lib/paths.ts';

const sample = JSON.parse(await readFile(path.join(ROOT, 'tests/fixtures/sample-daily.json'), 'utf8')) as DailyFile;
const NOW = new Date('2026-10-05T03:00:00Z');

/** 2026-10-05 までの形（v1）で保存されていたデータ */
function v1Data() {
  const it = (i: number) => ({ ...sample.items[i], saved: true });
  return {
    version: 1,
    diary: [
      { id: it(0).id, kind: 'daily', state: 'PRINCIPLE', item: it(0), memo: 'メモ', tags: ['a'], experiments: ['x'], createdAt: '2026-10-03T01:00:00Z', updatedAt: '2026-10-03T02:00:00Z' },
      { id: it(1).id, kind: 'daily', state: 'HYPOTHESIS', item: it(1), memo: '', tags: [], experiments: [], createdAt: '2026-10-04T01:00:00Z', updatedAt: '2026-10-04T01:00:00Z' },
      { id: 'manual-1', kind: 'manual', state: 'OBSERVATION', item: { ...it(2), id: 'manual-1', aiProvider: 'manual' }, memo: '', tags: [], experiments: [], createdAt: '2026-10-02T01:00:00Z', updatedAt: '' },
      { id: 'connect-1', kind: 'connect', state: 'EXPERIMENTED', item: { ...it(3), id: 'connect-1' }, memo: '', tags: ['CONNECT'], experiments: [], createdAt: '2026-10-01T01:00:00Z', updatedAt: '' },
      { id: 'broken' }, // item が無いものは v1 と同じく捨てる
      { id: it(1).id, kind: 'daily', state: 'OBSERVATION', item: it(1) }, // 重複
    ],
    notes: { [it(0).id]: { principleCandidate: '自分の言葉' } },
    connections: [{ id: 'connect-1', leftId: 'a', rightId: 'b' }],
    builds: [{ id: 'exp-1', sourceType: 'principle', sourceLabel: '古い', principle: 'p', done: true }],
  };
}

test('移行：v1 のデータを壊さずに v2 へ（段階は柔らかく、元の値は legacyState に残す）', () => {
  const raw = v1Data();
  assert.equal(needsMigration(raw), true);
  const data = migratePersonal(raw);
  assert.equal(data.version, 2);
  assert.equal(needsMigration(data), false);
  assert.deepEqual(
    data.diary.map((d) => [d.id, d.type, d.state, d.legacyState, d.userDecision]),
    [
      [sample.items[0].id, 'DAILY', 'PRINCIPLE_CANDIDATE', 'PRINCIPLE', 'INTERESTING'],
      [sample.items[1].id, 'DAILY', 'PATTERN', 'HYPOTHESIS', 'INTERESTING'],
      ['manual-1', 'OBSERVATION', 'OBSERVATION', 'OBSERVATION', 'INTERESTING'],
      ['connect-1', 'IDEA', 'TESTING', 'EXPERIMENTED', 'INTERESTING'],
    ],
  );
  const first = data.diary[0];
  assert.equal(first.item.title, sample.items[0].title, 'スナップショットはそのまま');
  assert.equal(first.memo, 'メモ');
  assert.deepEqual(first.experiments, ['x']);
  assert.deepEqual([first.engineIds, first.media, first.tools, first.derivedFrom], [[], [], [], []]);
  assert.equal(data.diary[2].source, sample.items[2].sourceUrl, 'URL から入れた観察は URL が出どころ');
  assert.equal(data.diary[2].updatedAt, '2026-10-02T01:00:00Z', '更新日時が無ければ作成日時');
  assert.deepEqual(data.notes, raw.notes, 'DEEP のメモはそのまま');
  assert.equal(data.connections.length, 1);
  const b = data.builds[0];
  assert.deepEqual([b.question, b.formats, b.media, b.result, b.resultEntryIds, b.done, b.hypothesis], ['', [], [], '', [], true, '']);
});

test('移行：何度通しても同じ。壊れた値でも落ちない', () => {
  const once = migratePersonal(v1Data());
  assert.deepEqual(migratePersonal(JSON.parse(JSON.stringify(once))), once);
  assert.deepEqual(migratePersonal(null), { version: 2, diary: [], notes: {}, connections: [], builds: [] });
  assert.deepEqual(migratePersonal('壊れた').diary, []);
  assert.equal(migratePersonal({ diary: 'x', builds: [null, { id: 'b' }] }).builds.length, 1);
  // v2 で保存された値（OBSERVATION / PRINCIPLE_CANDIDATE）は v1 と名前が同じでも読み替えない
  const v2 = normalizeEntry({ ...once.diary[0], state: 'VALIDATED', userDecision: 'HOLD' });
  assert.equal(v2?.state, 'VALIDATED');
  assert.equal(v2?.userDecision, 'HOLD');
});

test('MEMO・気づき：本文から DIARY の 1 件を作る（#タグ・URL・未選択）', () => {
  const e = createMemoEntry({ body: '  公園で蜘蛛の巣だけ見えた #痕跡 #公園\n本体は見えない  ', type: 'INSIGHT', url: 'https://example.com/a' }, NOW, 'memo-1');
  assert.equal(e.type, 'INSIGHT');
  assert.equal(e.kind, 'memo');
  assert.equal(e.userDecision, 'INBOX', 'AI も自動も判断しない。人間が選ぶまで未選択');
  assert.equal(e.state, 'OBSERVATION');
  assert.deepEqual(e.tags, ['痕跡', '公園']);
  assert.equal(e.body, '公園で蜘蛛の巣だけ見えた #痕跡 #公園\n本体は見えない');
  assert.equal(e.item.title, '公園で蜘蛛の巣だけ見えた #痕跡 #公園');
  assert.equal(e.item.sourceUrl, 'https://example.com/a');
  assert.equal(e.item.date, '2026-10-05');
  assert.equal(e.createdAt, NOW.toISOString());
  assert.equal(getLightDeep(e.item), null, 'メモの本文を AI の3行として扱わない');
  assert.equal(createMemoEntry({ body: 'x', url: 'javascript:alert(1)' }, NOW, 'm').item.sourceUrl, '');
  assert.deepEqual(parseTags('#a b ＃い、#c #a URL#frag'), ['a', 'い', 'c'], 'URL の # はタグにしない');
});

test('DIARY のフィルタ：種類・HUMAN SELECT・時系列', () => {
  const mk = (id: string, type: DiaryEntry['type'], extra: Partial<DiaryEntry> = {}): DiaryEntry => ({
    ...createMemoEntry({ body: id, type }, new Date(`2026-10-0${id.length}T00:00:00Z`), id),
    ...extra,
  });
  const daily = { ...entryFromItem(sample.items[0], '2026-09-30T00:00:00.000Z'), userDecision: 'INTERESTING' as const };
  const all = [daily, mk('m', 'MEMO'), mk('ii', 'INSIGHT'), mk('rrr', 'RESULT'), mk('tttt', 'TOOLCHAIN', { userDecision: 'ARCHIVE' }), mk('pp', 'IDEA', { state: 'VALIDATED' })];
  const by = (f: (typeof DIARY_FILTERS)[number]['id']) => all.filter((e) => matchesFilter(e, f)).map((e) => e.id);
  assert.deepEqual(by('DAILY'), [daily.id]);
  assert.deepEqual(by('MEMO'), ['m', 'ii']);
  assert.deepEqual(by('OBSERVATION'), ['rrr']);
  assert.deepEqual(by('EXPERIMENT'), ['rrr']);
  assert.deepEqual(by('IDEA'), ['pp']);
  assert.deepEqual(by('PRINCIPLE'), ['pp']);
  assert.deepEqual(by('TOOLCHAIN'), ['tttt']);
  assert.deepEqual(all.filter((e) => matchesFilter(e, 'DEEP', { hasDeepNotes: (id) => id === 'm' })).map((e) => e.id), ['m']);
  assert.equal(all.filter((e) => matchesDecision(e, null)).length, 5, 'アーカイブは標準では隠す');
  assert.equal(all.filter((e) => matchesDecision(e, 'ALL')).length, 6);
  assert.deepEqual(all.filter((e) => matchesDecision(e, 'INTERESTING')).map((e) => e.id), [daily.id]);
  assert.deepEqual(chronological(all).map((e) => e.id), ['tttt', 'rrr', 'ii', 'pp', 'm', daily.id]);
});

test('EXPERIMENT：結果を DIARY に新しい観察として戻し、系譜をたどれる', () => {
  const src = entryFromItem(sample.items[2], '2026-10-01T00:00:00Z');
  const design = { ...emptyDesign(NOW.toISOString(), 'exp-1'), sourceId: src.id, question: '痕跡だけで探し始める？', formats: ['紙カード5枚'], media: ['TOY' as const] };
  const exp = experimentEntry(design, NOW);
  assert.deepEqual([exp.id, exp.type, exp.state, exp.userDecision, exp.parentId, exp.experimentId], ['exp-1', 'EXPERIMENT', 'TESTING', 'BUILD', src.id, 'exp-1']);
  assert.match(exp.body, /紙カード5枚/);
  const kept = experimentEntry({ ...design, question: '変えた' }, NOW, { ...exp, memo: '自分のメモ', userDecision: 'HOLD' });
  assert.equal(kept.memo, '自分のメモ', '保存し直しても人が書いたものは残す');
  assert.equal(kept.userDecision, 'HOLD');
  assert.equal(kept.item.title, '変えた');

  const res = resultEntry(design, '3人中2人が探し始めた', NOW, 'result-1');
  assert.deepEqual([res.type, res.state, res.userDecision, res.parentId, res.experimentId, res.sourceId], ['RESULT', 'OBSERVATION', 'INBOX', 'exp-1', 'exp-1', src.id]);
  assert.deepEqual(res.derivedFrom, [src.id, 'exp-1']);
  assert.equal(res.item.observation, '3人中2人が探し始めた');

  const all = [src, exp, res];
  const fromSrc = lineage(src, all);
  assert.deepEqual(fromSrc.children.map((e) => e.id), ['exp-1', 'result-1']);
  const fromRes = lineage(res, all);
  assert.equal(fromRes.parent?.id, 'exp-1');
  assert.deepEqual(fromRes.from.map((e) => e.id), [src.id]);
});

test('LIGHT DEEP：AI は3行で止める。古いデータからも3行を作り、自分の言葉を優先する', () => {
  const it = sample.items[0];
  const derived = deriveLightDeep(it);
  assert.ok(derived);
  assert.equal(derived.structure, it.principleCandidate);
  assert.equal(derived.transfer, it.transferIdeas[0]);
  assert.ok(derived.odd.length > 0 && derived.odd.length <= 120);
  const withAi = { ...it, lightDeep: { odd: '妙', structure: '構造', transfer: '飛ばす' } };
  assert.deepEqual(getLightDeep(withAi), { odd: '妙', structure: '構造', transfer: '飛ばす' });
  assert.deepEqual(getLightDeep(withAi, { structure: '自分の言葉', odd: '  ' }), { odd: '妙', structure: '自分の言葉', transfer: '飛ばす' });
  assert.equal(getLightDeep({ ...it, analysisFailed: true }), null, '作成中止には3行を作らない');
  assert.deepEqual(getLightDeep({ ...it, analysisFailed: true }, { odd: '自分で書いた' })?.odd, '自分で書いた');
  assert.equal(normalizeLightDeep({ odd: 'a', structure: 'b' }), null, '3行そろわなければ使わない');
  assert.equal(normalizeLightDeep({ odd: 'a', structure: 'b', transfer: 'x'.repeat(300) })?.transfer.length, 120);
});

test('生成：3行の JSON を DailyItem にする（原理候補は「構造」の行）。3行そろわなければ使わない', () => {
  const c: Candidate = { key: 'c01', sourceId: 's', sourceName: 'S', category: 'tech', foreign: false, title: '元の見出し', url: 'https://example.org/a', summary: '要約', published: '2026-10-04', lang: 'en', score: 1, interest: 0 };
  const meta = { id: '20261005-01', date: '2026-10-05', category: 'tech' as const, provider: 'gemini' };
  const ok = toDailyItem({ title: 'T', hook: 'H', lightDeep: { odd: 'O', structure: 'S', transfer: 'X' }, tags: ['#t'] }, c, meta);
  assert.equal(isUsable(ok), true);
  assert.equal(ok.principleCandidate, 'S');
  assert.deepEqual(ok.transferIdeas, ['X']);
  assert.equal(ok.story, '');
  assert.equal(ok.sourceUrl, 'https://example.org/a');
  const ng = toDailyItem({ title: 'T', hook: 'H', lightDeep: { odd: 'O' } }, c, meta);
  assert.equal(isUsable(ng), false);
});

test('ENGINES：データとして持ち、選んだときだけ使う（なし・複数も選べる）', () => {
  assert.deepEqual(
    ENGINES.map((e) => e.id),
    ['none', 'okada', 'akasegawa', 'minakata', 'hayashi', 'ochiai', 'matsuoka', 'kondo'],
  );
  for (const e of ENGINES) {
    for (const k of ['id', 'name', 'description', 'shortDescription'] as const) assert.ok(e[k].length > 0, `${e.id}.${k}`);
    for (const k of ['questions', 'process', 'suitableFor'] as const) assert.ok(e[k].length > 0, `${e.id}.${k}`);
  }
  const okada = getEngine('okada');
  assert.equal(okada?.shortDescription, '違和感から構造を抜く');
  assert.deepEqual(okada?.process, ['違和感を探す', '観察方法を変える', '現象を分解する', '固有名詞・固有要素を消す', '関係だけを残す', '別分野で同型構造を探す', '移植する', '再具体化する']);
  assert.deepEqual(okada?.viewpoints, ['観測すると相手にも影響する', '情報を取得しようとすると自分も露出する', '痕跡', '罠', '偽装', '誤誘導']);
  assert.equal(okada?.fixedQuestions?.[0], '固有名詞を全部消すと何が残る？');
  assert.equal(getEngine('ochiai')?.shortDescription, '前提・境界・観測方法を変える');
  assert.equal(getEngine('matsuoka')?.shortDescription, '分ける・つなぐ・ずらす・編集する');
  assert.equal(getEngine('kondo')?.shortDescription, '1テーマを深く掘り、不確実性を減らす');
  assert.equal(getEngine('akasegawa')?.origin, 'person');
  assert.equal(getEngine('minakata')?.origin, 'person');
  assert.equal(getEngine('hayashi')?.origin, 'person');

  let sel = toggleEngine([], 'okada');
  sel = toggleEngine(sel, 'ochiai');
  assert.deepEqual(sel, ['okada', 'ochiai'], 'ENGINE MIX');
  assert.deepEqual(toggleEngine(sel, 'none'), ['none'], '「なし」を選ぶと他は外れる');
  assert.deepEqual(toggleEngine(['none'], 'kondo'), ['kondo']);
  assert.deepEqual(toggleEngine(sel, 'okada'), ['ochiai']);
  assert.deepEqual(toggleEngine(sel, 'unknown'), sel);
  const qs = mixQuestions(['okada', 'okada', 'none']);
  assert.equal(qs.length, okada?.questions.length, '同じ問いは 1 回だけ');
  const prompt = engineChatPrompt(['none', 'okada', 'kondo'], { title: '公園の蜘蛛', text: '巣だけ見える' });
  assert.match(prompt, /結論や完成案は出さない/);
  assert.match(prompt, /OKADA/);
  assert.match(prompt, /KONDO/);
  assert.doesNotMatch(prompt, /NONE/);
  assert.ok(TRANSFORM_OPS.some((o) => o.label === '観測と被観測を相互化する'));
});

test('ENGINE PIPELINE：人物エンジンと一般操作を任意順序で組み合わせる', () => {
  const expected = [
    ['岡田だけ', 'OKADA'],
    ['岡田 → 南方', 'OKADA → MINAKATA'],
    ['赤瀬川 → 岡田', 'AKASEGAWA → OKADA'],
    ['南方 → 林', 'MINAKATA → HAYASHI'],
    ['岡田 → 状態変化', 'OKADA → 状態変化探索'],
    ['岡田 → 知らない前提', 'OKADA → 知らない前提'],
    ['岡田 → 深層掘削', 'OKADA → 深層掘削'],
  ];
  for (const [label, output] of expected) {
    const example = ENGINE_PIPELINE_EXAMPLES.find((x) => x.label === label);
    assert.ok(example);
    assert.equal(pipelineLabel(example.steps), output);
    assert.equal(validPipeline(example.steps).length, example.steps.length);
    assert.match(pipelineChatPrompt(example.steps, { title: '氷', text: '氷が溶けて流れた' }), /観察方法がどう変わったか/);
  }
  assert.equal(getOperation('deep-drill')?.kind, 'technique');
  assert.equal(getOperation('unknown-premise')?.kind, 'lens');
  assert.ok(ENGINE_OPERATIONS.some((x) => x.id === 'state-change'));
  assert.ok(ENGINE_LENSES.some((x) => x.id === 'knowledge-gap'));
});

test('CORE LOCK・メディア・最小実験', () => {
  assert.deepEqual(
    CORE_LOCK_QUESTIONS.map((q) => q.question),
    ['何を消したら成立しなくなる？', '名前を変えても残る核は？', '何を守れば大胆に壊せる？', 'どこまでは変更できる？'],
  );
  assert.equal(coreLockFilled(emptyCoreLock()), false);
  assert.equal(coreLockFilled({ ...emptyCoreLock(), protect: '掴んだまま' }), true);
  assert.equal(MEDIA.length, 12);
  assert.ok(MEDIA.some((m) => m.id === 'PICTURE_BOOK') && MEDIA.some((m) => m.id === 'INSTALLATION'), 'ゲームだけにしない');
  assert.ok(MINIMAL_EXPERIMENTS.includes('子どもに1分触ってもらう'));
});

test('EXPERIMENT のプロンプト：「何を確かめたいか」が先頭に来る。CONNECT にはエンジンも置ける', () => {
  const d = { ...draftFromPrinciple(toPrincipleSource(sample.items[6])), question: '1つだけ確かめたい', formats: ['30秒動画'] };
  const p = claudeCodePrompt(d);
  assert.ok(p.indexOf('## 何を確かめたいか') < p.indexOf('## 検証したい原理'));
  assert.match(p, /30秒動画/);
  const src = toPrincipleSource(sample.items[0], undefined, { structure: '自分の構造' });
  assert.equal(src.principle, '自分の構造');
  const okada = getEngine('okada');
  assert.ok(okada);
  const es = engineToSource(okada);
  assert.equal(es.node, 'engine');
  assert.equal(es.principle, '違和感から構造を抜く');
});
