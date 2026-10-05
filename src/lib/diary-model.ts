// DIARY を中心にした個人データのモデル（画面にも保存先にも依存しない純粋な関数だけ）。
// - v1（2026-10-05 まで）のデータを壊さずに v2 へ移す
// - Memo・気づき・観察・実験結果を、すべて DIARY の 1 件として作る
// - HUMAN SELECT（userDecision）と AI の点数は混ぜない

import { ENTRY_TYPE_IDS, MEDIUM_IDS, entryTypeLabel } from '../shared/loop.ts';
import { PRINCIPLE_STATES } from '../shared/questions.ts';
import { jstDateString } from '../shared/time.ts';
import type {
  ConnectionResult,
  CoreLock,
  DailyItem,
  DeepNotes,
  DiaryEntry,
  DiaryKind,
  EntryType,
  ExperimentDesign,
  LegacyPrincipleState,
  LightDeep,
  MediumId,
  PrincipleState,
  UserDecision,
} from '../shared/types.ts';

export const PERSONAL_VERSION = 2;

export interface PersonalData {
  version: 2;
  diary: DiaryEntry[];
  notes: Record<string, DeepNotes>;
  connections: ConnectionResult[];
  builds: ExperimentDesign[];
}

export function emptyPersonal(): PersonalData {
  return { version: 2, diary: [], notes: {}, connections: [], builds: [] };
}

// ---------------------------------------------------------------- 移行（v1 → v2）

const STAGES = PRINCIPLE_STATES.map((s) => s.id) as readonly PrincipleState[];
const LEGACY_STATES: readonly LegacyPrincipleState[] = ['OBSERVATION', 'HYPOTHESIS', 'PRINCIPLE_CANDIDATE', 'PRINCIPLE', 'EXPERIMENTED'];
const KINDS: readonly DiaryKind[] = ['daily', 'manual', 'connect', 'memo', 'experiment'];
const DECISIONS: readonly UserDecision[] = ['INBOX', 'INTERESTING', 'DEEP', 'BUILD', 'HOLD', 'ARCHIVE'];

/**
 * v1 の段階 → v2 の段階。「原理」は確定させない方針なので、
 * PRINCIPLE は PRINCIPLE_CANDIDATE に、EXPERIMENTED は TESTING（実験中）に寄せる。元の値は legacyState に残す。
 */
export const LEGACY_STATE_MAP: Readonly<Record<LegacyPrincipleState, PrincipleState>> = {
  OBSERVATION: 'OBSERVATION',
  HYPOTHESIS: 'PATTERN',
  PRINCIPLE_CANDIDATE: 'PRINCIPLE_CANDIDATE',
  PRINCIPLE: 'PRINCIPLE_CANDIDATE',
  EXPERIMENTED: 'TESTING',
};

const TYPE_FROM_KIND: Readonly<Record<DiaryKind, EntryType>> = {
  daily: 'DAILY',
  manual: 'OBSERVATION',
  connect: 'IDEA',
  memo: 'MEMO',
  experiment: 'EXPERIMENT',
};

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const optStr = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | undefined => (list as readonly unknown[]).includes(v) ? (v as T) : undefined;

/** 保存されている値が v2 になっていなければ true（移行の前にバックアップを取るために使う） */
export function needsMigration(raw: unknown): boolean {
  return isObj(raw) && raw.version !== PERSONAL_VERSION;
}

function normalizeItem(raw: Record<string, unknown>): DailyItem {
  // 古い保存物でも画面が落ちないよう、配列と文字列だけはそろえる
  return {
    ...(raw as unknown as DailyItem),
    title: str(raw.title) || '（無題）',
    hook: str(raw.hook),
    transferIdeas: strList(raw.transferIdeas),
    tags: strList(raw.tags),
  };
}

function normalizeLight(v: unknown): Partial<LightDeep> | undefined {
  if (!isObj(v)) return undefined;
  const out: Partial<LightDeep> = {};
  for (const k of ['odd', 'structure', 'transfer'] as const) if (typeof v[k] === 'string') out[k] = v[k];
  return Object.keys(out).length ? (out as LightDeep) : undefined;
}

function normalizeCoreLock(v: unknown): CoreLock | undefined {
  if (!isObj(v)) return undefined;
  return { remove: str(v.remove), core: str(v.core), protect: str(v.protect), changeable: str(v.changeable), updatedAt: str(v.updatedAt) };
}

/** 1 件を v2 の形にそろえる。id か item が無いものは捨てる（v1 と同じ基準） */
export function normalizeEntry(raw: unknown): DiaryEntry | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || !raw.id || !isObj(raw.item)) return null;
  const legacy = oneOf(raw.type, ENTRY_TYPE_IDS) === undefined; // type が無い＝v1 の保存物
  const kind = oneOf(raw.kind, KINDS) ?? 'daily';
  const type = oneOf(raw.type, ENTRY_TYPE_IDS) ?? TYPE_FROM_KIND[kind];

  let state: PrincipleState = 'OBSERVATION';
  let legacyState = oneOf(raw.legacyState, LEGACY_STATES);
  if (legacy) {
    const old = oneOf(raw.state, LEGACY_STATES);
    if (old) {
      state = LEGACY_STATE_MAP[old];
      legacyState = old;
    } else {
      state = oneOf(raw.state, STAGES) ?? 'OBSERVATION';
    }
  } else {
    state = oneOf(raw.state, STAGES) ?? 'OBSERVATION';
  }

  const item = normalizeItem(raw.item);
  const source = str(raw.source) || (kind === 'daily' ? 'DAILY' : kind === 'connect' ? 'CONNECT' : kind === 'manual' ? item.sourceUrl || 'manual' : kind);
  return {
    id: raw.id,
    kind,
    type,
    state,
    ...(legacyState ? { legacyState } : {}),
    // v1 で保存したものは「気になった＝面白い」とみなす。新しく入ったものは未選択（INBOX）
    userDecision: oneOf(raw.userDecision, DECISIONS) ?? (legacy ? 'INTERESTING' : 'INBOX'),
    item,
    body: str(raw.body),
    source,
    memo: str(raw.memo),
    tags: [...new Set(strList(raw.tags))],
    experiments: strList(raw.experiments),
    ...(normalizeLight(raw.lightDeep) ? { lightDeep: normalizeLight(raw.lightDeep) as LightDeep } : {}),
    engineIds: [...new Set(strList(raw.engineIds))],
    ...(normalizeCoreLock(raw.coreLock) ? { coreLock: normalizeCoreLock(raw.coreLock) } : {}),
    media: strList(raw.media).filter((m): m is MediumId => (MEDIUM_IDS as readonly string[]).includes(m)),
    tools: strList(raw.tools),
    parentId: optStr(raw.parentId),
    sourceId: optStr(raw.sourceId),
    derivedFrom: strList(raw.derivedFrom),
    experimentId: optStr(raw.experimentId),
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt) || str(raw.createdAt),
  };
}

const DESIGN_TEXT_KEYS = [
  'sourceLabel',
  'question',
  'result',
  'principle',
  'hypothesis',
  'minimumStructure',
  'discard',
  'comparison',
  'conditions',
  'success',
  'failure',
  'observe',
  'tech',
  'v30m',
  'v2h',
  'v1d',
  'createdAt',
  'updatedAt',
] as const;

export function normalizeDesign(raw: unknown): ExperimentDesign | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || !raw.id) return null;
  const out = { ...(raw as unknown as ExperimentDesign) };
  for (const k of DESIGN_TEXT_KEYS) out[k] = str(raw[k]);
  out.sourceType = oneOf(raw.sourceType, ['principle', 'connect', 'idea'] as const) ?? 'idea';
  out.sourceId = optStr(raw.sourceId);
  out.formats = strList(raw.formats);
  out.media = strList(raw.media).filter((m): m is MediumId => (MEDIUM_IDS as readonly string[]).includes(m));
  out.resultEntryIds = strList(raw.resultEntryIds);
  out.done = raw.done === true;
  return out;
}

/** 保存されていたもの（v1 / v2 / 壊れた値）を v2 にそろえる。何度通しても同じ結果になる */
export function migratePersonal(raw: unknown): PersonalData {
  const r = isObj(raw) ? raw : {};
  const seen = new Set<string>();
  const diary: DiaryEntry[] = [];
  for (const x of Array.isArray(r.diary) ? r.diary : []) {
    const e = normalizeEntry(x);
    if (e && !seen.has(e.id)) {
      seen.add(e.id);
      diary.push(e);
    }
  }
  return {
    version: 2,
    diary,
    notes: isObj(r.notes) ? (r.notes as Record<string, DeepNotes>) : {},
    connections: Array.isArray(r.connections) ? (r.connections.filter((c) => isObj(c) && typeof c.id === 'string') as ConnectionResult[]) : [],
    builds: Array.isArray(r.builds) ? r.builds.map(normalizeDesign).filter((b): b is ExperimentDesign => b !== null) : [],
  };
}

// ---------------------------------------------------------------- 作る

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** 「#タグ」を本文から拾う（本文はそのまま残す） */
export function parseTags(text: string): string[] {
  return [...new Set([...text.matchAll(/(?:^|[\s　、,，。])[#＃]([^\s　#＃、,，。]+)/g)].map((m) => m[1]))];
}

export interface EntryOptions {
  kind?: DiaryKind;
  type?: EntryType;
  state?: PrincipleState;
  userDecision?: UserDecision;
  source?: string;
}

/** DAILY などの 1 件から DIARY の 1 件を作る */
export function entryFromItem(item: DailyItem, nowIso: string, opts: EntryOptions = {}): DiaryEntry {
  const kind = opts.kind ?? 'daily';
  return {
    id: item.id,
    kind,
    type: opts.type ?? TYPE_FROM_KIND[kind],
    state: opts.state ?? 'OBSERVATION',
    userDecision: opts.userDecision ?? 'INBOX',
    item: { ...item, saved: true },
    body: '',
    source: opts.source ?? (kind === 'daily' ? 'DAILY' : kind === 'manual' ? item.sourceUrl || 'manual' : kind.toUpperCase()),
    memo: '',
    tags: [...(item.tags ?? [])],
    experiments: [],
    engineIds: [],
    media: [],
    tools: [],
    derivedFrom: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export interface MemoInput {
  body: string;
  type?: EntryType;
  title?: string;
  tags?: string[];
  source?: string;
  url?: string;
  state?: PrincipleState;
  userDecision?: UserDecision;
  tools?: string[];
  parentId?: string;
  sourceId?: string;
  derivedFrom?: string[];
  experimentId?: string;
  media?: MediumId[];
  kind?: DiaryKind;
}

/** Memo・気づき・観察・アイデア・実験結果などを DIARY の 1 件にする。本文から表示用の item も作る */
export function createMemoEntry(input: MemoInput, now: Date, id: string): DiaryEntry {
  const body = input.body.replace(/\r/g, '').trim();
  const type = input.type ?? 'MEMO';
  const iso = now.toISOString();
  const firstLine = body.split('\n').find((l) => l.trim()) ?? '';
  const tags = [...new Set([...(input.tags ?? []), ...parseTags(body)])];
  const url = input.url && /^https?:\/\//.test(input.url) ? input.url : '';
  const item: DailyItem = {
    id,
    date: jstDateString(now),
    category: 'foreign',
    title: clip(input.title || firstLine || entryTypeLabel(type).ja, 60),
    hook: body,
    story: '',
    sourceTitle: url || entryTypeLabel(type).ja,
    sourceUrl: url,
    sourceDate: '',
    observation: type === 'OBSERVATION' || type === 'RESULT' ? body : '',
    input: '',
    transformation: '',
    why: '',
    speed: '',
    discard: '',
    tradeoff: '',
    minimumStructure: '',
    removePurpose: '',
    principleCandidate: type === 'PRINCIPLE_CANDIDATE' ? clip(body, 200) : '',
    counterexample: '',
    transferIdeas: [],
    saved: true,
    tags,
    aiProvider: 'memo',
  };
  return {
    id,
    kind: input.kind ?? 'memo',
    type,
    state: input.state ?? 'OBSERVATION',
    userDecision: input.userDecision ?? 'INBOX',
    item,
    body,
    source: input.source ?? (url || 'memo'),
    memo: '',
    tags,
    experiments: [],
    engineIds: [],
    media: input.media ?? [],
    tools: input.tools ?? [],
    parentId: input.parentId,
    sourceId: input.sourceId,
    derivedFrom: input.derivedFrom ?? [],
    experimentId: input.experimentId,
    createdAt: iso,
    updatedAt: iso,
  };
}

/** 実験設計を DIARY の EXPERIMENT として表す（id は設計と同じ。保存のたびに中身を差し替える） */
export function experimentEntry(design: ExperimentDesign, now: Date, existing?: DiaryEntry): DiaryEntry {
  const body = [
    design.question && `確かめたいこと：${design.question}`,
    design.formats.length > 0 && `形：${design.formats.join('・')}`,
    design.v30m && `最小版：${design.v30m}`,
  ]
    .filter(Boolean)
    .join('\n');
  const fresh = createMemoEntry(
    {
      body: body || design.principle || design.sourceLabel || '実験',
      title: design.question || design.principle || design.sourceLabel || '実験',
      type: 'EXPERIMENT',
      kind: 'experiment',
      source: 'EXPERIMENT',
      state: 'TESTING',
      userDecision: 'BUILD',
      parentId: design.sourceId,
      sourceId: design.sourceId,
      derivedFrom: design.sourceId ? [design.sourceId] : [],
      experimentId: design.id,
      media: design.media,
    },
    now,
    design.id,
  );
  if (!existing) return fresh;
  // 人が書いたもの（メモ・タグ・判断・段階）は残し、設計から作る部分だけ差し替える
  return {
    ...existing,
    item: fresh.item,
    body: fresh.body,
    media: design.media,
    parentId: fresh.parentId,
    sourceId: fresh.sourceId,
    derivedFrom: [...new Set([...existing.derivedFrom, ...fresh.derivedFrom])],
    experimentId: design.id,
    updatedAt: now.toISOString(),
  };
}

/** 実験結果を DIARY へ「新しい観察」として戻す（RESULT・段階は OBSERVATION） */
export function resultEntry(design: ExperimentDesign, text: string, now: Date, id: string): DiaryEntry {
  return createMemoEntry(
    {
      body: text,
      title: `結果：${design.question || design.principle || design.sourceLabel || '実験'}`,
      type: 'RESULT',
      kind: 'memo',
      source: 'EXPERIMENT',
      state: 'OBSERVATION',
      userDecision: 'INBOX',
      parentId: design.id,
      sourceId: design.sourceId,
      derivedFrom: [design.sourceId, design.id].filter((x): x is string => Boolean(x)),
      experimentId: design.id,
      media: design.media,
    },
    now,
    id,
  );
}

// ---------------------------------------------------------------- 見る

export type DiaryFilterId = 'ALL' | 'DAILY' | 'MEMO' | 'OBSERVATION' | 'IDEA' | 'DEEP' | 'EXPERIMENT' | 'PRINCIPLE' | 'TOOLCHAIN';

export const DIARY_FILTERS: readonly { id: DiaryFilterId; label: string; ja: string }[] = [
  { id: 'ALL', label: 'ALL', ja: 'すべて' },
  { id: 'DAILY', label: 'DAILY', ja: '今日の観察' },
  { id: 'MEMO', label: 'MEMO', ja: 'メモ・気づき' },
  { id: 'OBSERVATION', label: 'OBSERVATION', ja: '観察・実験結果' },
  { id: 'IDEA', label: 'IDEA', ja: 'アイデア・仮説' },
  { id: 'DEEP', label: 'DEEP', ja: '掘っている' },
  { id: 'EXPERIMENT', label: 'EXPERIMENT', ja: '実験' },
  { id: 'PRINCIPLE', label: 'PRINCIPLE', ja: '原理候補〜' },
  { id: 'TOOLCHAIN', label: 'TOOLCHAIN', ja: '道具・できること' },
];

export function isDiaryFilter(v: unknown): v is DiaryFilterId {
  return DIARY_FILTERS.some((f) => f.id === v);
}

export interface FilterContext {
  /** FULL DEEP に何か書いてあるか */
  hasDeepNotes?: (id: string) => boolean;
}

export function matchesFilter(e: DiaryEntry, f: DiaryFilterId, ctx: FilterContext = {}): boolean {
  switch (f) {
    case 'ALL':
      return true;
    case 'DAILY':
      return e.type === 'DAILY';
    case 'MEMO':
      return e.type === 'MEMO' || e.type === 'INSIGHT';
    case 'OBSERVATION':
      return e.type === 'OBSERVATION' || e.type === 'RESULT';
    case 'IDEA':
      return e.type === 'IDEA' || e.type === 'HYPOTHESIS';
    case 'DEEP':
      return e.type === 'LIGHT_DEEP' || e.userDecision === 'DEEP' || Boolean(ctx.hasDeepNotes?.(e.id));
    case 'EXPERIMENT':
      return e.type === 'EXPERIMENT' || e.type === 'RESULT' || e.userDecision === 'BUILD';
    case 'PRINCIPLE':
      return e.type === 'PRINCIPLE_CANDIDATE' || e.state === 'PRINCIPLE_CANDIDATE' || e.state === 'TESTING' || e.state === 'VALIDATED';
    case 'TOOLCHAIN':
      return e.type === 'TOOLCHAIN' || e.type === 'CAPABILITY';
  }
}

/** decision：未指定ならアーカイブ以外、'ALL' ならアーカイブも含めて全部 */
export function matchesDecision(e: DiaryEntry, decision: UserDecision | 'ALL' | null | undefined): boolean {
  if (decision === 'ALL') return true;
  if (!decision) return e.userDecision !== 'ARCHIVE';
  return e.userDecision === decision;
}

/** 新しいものが上。作った日時で並べる（更新しても順番は動かない） */
export function chronological(entries: readonly DiaryEntry[]): DiaryEntry[] {
  return [...entries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** 系譜：親・派生元・この 1 件から生まれたもの */
export function lineage(e: DiaryEntry, all: readonly DiaryEntry[]) {
  const byId = new Map(all.map((x) => [x.id, x]));
  const parent = e.parentId ? byId.get(e.parentId) : undefined;
  const from = e.derivedFrom.filter((id) => id !== e.parentId).map((id) => byId.get(id)).filter((x): x is DiaryEntry => Boolean(x));
  const children = all.filter((x) => x.id !== e.id && (x.parentId === e.id || x.derivedFrom.includes(e.id)));
  return { parent, from, children };
}
