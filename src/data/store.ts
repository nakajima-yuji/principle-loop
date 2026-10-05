// 個人データ（DIARY・DEEP のメモ・CONNECT・EXPERIMENT）。初期版はブラウザ内（localStorage）に保存する。
// データ層はここに閉じ込めてあるので、将来の同期はこのファイルの保存先を替えれば済む。
// 形の定義と移行（v1 → v2）は lib/diary-model.ts（画面に依存しない純粋な関数）にある。

import { useSyncExternalStore } from 'react';
import {
  createMemoEntry,
  emptyPersonal,
  entryFromItem,
  experimentEntry,
  migratePersonal,
  needsMigration,
  normalizeDesign,
  resultEntry,
  type EntryOptions,
  type MemoInput,
  type PersonalData,
} from '../lib/diary-model.ts';
import type { ConnectionResult, DailyItem, DeepNotes, DiaryEntry, ExperimentDesign, UserDecision } from '../shared/types.ts';
import { browserStorage, createStore, readJson, type KeyValueStorage } from './storage.ts';

export type { PersonalData } from '../lib/diary-model.ts';

// キーは v1 のまま（変えると既存のデータが見えなくなる）。中身の version で形を見分ける。
const KEY = 'principle-loop.personal.v1';
/** v1 → v2 に移す前の元データ。万一のときに戻せるよう、最初の 1 回だけ取っておく */
export const BACKUP_KEY = 'principle-loop.personal.v1.backup';

const storage: KeyValueStorage = browserStorage;

function load(): PersonalData {
  const raw = readJson<unknown>(storage, KEY, null);
  const data = migratePersonal(raw);
  if (raw !== null && needsMigration(raw)) {
    if (storage.get(BACKUP_KEY) === null) storage.set(BACKUP_KEY, storage.get(KEY) ?? '');
    storage.set(KEY, JSON.stringify(data));
  }
  return data;
}

const store = createStore<PersonalData>(load());

function commit(next: PersonalData) {
  storage.set(KEY, JSON.stringify(next));
  store.set(next);
}

// 他のタブで変更されたら取り込む
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) store.set(migratePersonal(readJson<unknown>(storage, KEY, null)));
  });
}

/** 個人データ全体（変更があったときだけ新しいオブジェクトになる） */
export function usePersonal(): PersonalData {
  return useSyncExternalStore(store.subscribe, store.get);
}

export const getPersonal = () => store.get();

const nowIso = () => new Date().toISOString();

export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${Date.now().toString(36)}${rand}`;
}

// ---------------- DIARY ----------------

export function isSaved(id: string): boolean {
  return store.get().diary.some((d) => d.id === id);
}

export function getEntry(id: string): DiaryEntry | undefined {
  return store.get().diary.find((d) => d.id === id);
}

function prepend(entry: DiaryEntry) {
  const data = store.get();
  commit({ ...data, diary: [entry, ...data.diary.filter((d) => d.id !== entry.id)] });
}

/** DIARY に入れる（すでにあればそのまま返す） */
export function saveToDiary(item: DailyItem, opts: EntryOptions = {}): DiaryEntry {
  const existing = getEntry(item.id);
  if (existing) return existing;
  const entry = entryFromItem(item, nowIso(), opts);
  prepend(entry);
  return entry;
}

export function updateDiary(id: string, patch: Partial<Omit<DiaryEntry, 'id' | 'createdAt'>>) {
  const data = store.get();
  commit({
    ...data,
    diary: data.diary.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: nowIso() } : d)),
  });
}

export function removeFromDiary(id: string) {
  const data = store.get();
  commit({ ...data, diary: data.diary.filter((d) => d.id !== id) });
}

/**
 * HUMAN SELECT。まだ DIARY に無ければ、選んだ判断つきで入れる。
 * toggle のときは、同じ判断をもう一度押すと未選択（INBOX）に戻す。
 */
export function decide(item: DailyItem, decision: UserDecision, toggle = true): UserDecision {
  const existing = getEntry(item.id);
  if (!existing) {
    saveToDiary(item, { userDecision: decision, kind: item.aiProvider === 'manual' ? 'manual' : 'daily' });
    return decision;
  }
  const next = toggle && existing.userDecision === decision ? 'INBOX' : decision;
  if (next !== existing.userDecision) updateDiary(item.id, { userDecision: next });
  return next;
}

/** まだ DIARY に無ければ（未選択のまま）入れて、その 1 件を返す。CORE LOCK などを書き始めたときに使う */
export function ensureEntry(item: DailyItem): DiaryEntry {
  return getEntry(item.id) ?? saveToDiary(item, { kind: item.aiProvider === 'manual' ? 'manual' : 'daily' });
}

/** Memo・気づき・観察などを DIARY に追加する */
export function addMemo(input: MemoInput): DiaryEntry {
  const prefix = input.type === 'RESULT' ? 'result' : input.type === 'OBSERVATION' ? 'obs' : 'memo';
  const entry = createMemoEntry(input, new Date(), newId(prefix));
  prepend(entry);
  return entry;
}

// ---------------- DEEP notes ----------------

export function emptyNotes(): DeepNotes {
  return {
    input: '',
    transformation: '',
    speed: '',
    discard: '',
    tradeoff: '',
    minimumStructure: '',
    removePurpose: '',
    observation: '',
    hypothesis: '',
    counterexample: '',
    boundary: {},
    invert: '',
    transfer: '',
    principleCandidate: '',
    chips: {},
    updatedAt: '',
  };
}

export function getNotes(id: string): DeepNotes {
  return { ...emptyNotes(), ...(store.get().notes[id] ?? {}) };
}

export function setNotes(id: string, patch: Partial<DeepNotes>) {
  const data = store.get();
  const current = { ...emptyNotes(), ...(data.notes[id] ?? {}) };
  commit({ ...data, notes: { ...data.notes, [id]: { ...current, ...patch, updatedAt: nowIso() } } });
}

/** DEEP の記入がどれだけ進んだか（0〜1） */
export function notesProgress(n: DeepNotes | undefined): number {
  if (!n) return 0;
  const keys = [
    'input',
    'transformation',
    'speed',
    'discard',
    'tradeoff',
    'minimumStructure',
    'removePurpose',
    'observation',
    'hypothesis',
    'counterexample',
    'invert',
    'transfer',
    'principleCandidate',
  ] as const;
  const filled = keys.filter((k) => (n[k] ?? '').trim()).length + (Object.values(n.boundary ?? {}).some((v) => v.trim()) ? 1 : 0);
  return filled / (keys.length + 1);
}

// ---------------- CONNECT ----------------

export function saveConnection(c: ConnectionResult) {
  const data = store.get();
  const exists = data.connections.some((x) => x.id === c.id);
  commit({
    ...data,
    connections: exists ? data.connections.map((x) => (x.id === c.id ? c : x)) : [c, ...data.connections],
  });
}

export function removeConnection(id: string) {
  const data = store.get();
  commit({ ...data, connections: data.connections.filter((c) => c.id !== id) });
}

// ---------------- EXPERIMENT（旧 BUILD） ----------------

/** 実験設計を保存し、DIARY にも EXPERIMENT として並べる */
export function saveBuild(d: ExperimentDesign) {
  const data = store.get();
  const next = normalizeDesign({ ...d, updatedAt: nowIso() }) ?? d;
  const exists = data.builds.some((x) => x.id === d.id);
  const builds = exists ? data.builds.map((x) => (x.id === d.id ? next : x)) : [next, ...data.builds];
  const prev = data.diary.find((e) => e.id === next.id);
  const entry = experimentEntry(next, new Date(), prev);
  const diary = prev ? data.diary.map((e) => (e.id === entry.id ? entry : e)) : [entry, ...data.diary];
  commit({ ...data, builds, diary });
}

export function removeBuild(id: string) {
  const data = store.get();
  commit({ ...data, builds: data.builds.filter((b) => b.id !== id) });
}

/** 実験結果を DIARY へ新しい観察として戻す。戻した id を設計にも記録する */
export function returnResult(design: ExperimentDesign, text: string): DiaryEntry {
  const entry = resultEntry(design, text, new Date(), newId('result'));
  const data = store.get();
  const builds = data.builds.map((b) => (b.id === design.id ? { ...b, resultEntryIds: [...b.resultEntryIds, entry.id], updatedAt: nowIso() } : b));
  commit({ ...data, builds, diary: [entry, ...data.diary] });
  return entry;
}

// ---------------- Backup ----------------

export function exportPersonal(): string {
  return JSON.stringify({ app: 'principle-loop', exportedAt: nowIso(), ...store.get() }, null, 2);
}

/** バックアップを読み込む（v1 / v2 どちらでも）。同じ id は読み込んだ側で上書きする（マージ）。 */
export function importPersonal(text: string): { diary: number; connections: number; builds: number } {
  const incoming = migratePersonal(JSON.parse(text));
  const data = store.get();
  const mergeById = <T extends { id: string }>(a: T[], b: T[]) => {
    const map = new Map(a.map((x) => [x.id, x]));
    b.forEach((x) => map.set(x.id, x));
    return [...map.values()];
  };
  const next: PersonalData = {
    version: 2,
    diary: mergeById(data.diary, incoming.diary).sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1)),
    notes: { ...data.notes, ...incoming.notes },
    connections: mergeById(data.connections, incoming.connections),
    builds: mergeById(data.builds, incoming.builds),
  };
  commit(next);
  return { diary: incoming.diary.length, connections: incoming.connections.length, builds: incoming.builds.length };
}

export function clearPersonal() {
  commit(emptyPersonal());
}
