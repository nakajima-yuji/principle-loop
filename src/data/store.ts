// 個人データ（DIARY・DEEP のメモ・CONNECT・BUILD）。初期版はブラウザ内（localStorage）に保存する。
// データ層はここに閉じ込めてあるので、将来の同期はこのファイルの保存先を替えれば済む。

import { useSyncExternalStore } from 'react';
import { createNoteEntry, diarySource, withNoteSource, withNoteText, type NoteSource } from '../lib/note.ts';
import type {
  ConnectionResult,
  DailyItem,
  DeepNotes,
  DiaryEntry,
  DiaryKind,
  ExperimentDesign,
  LightDeep,
  PrincipleState,
} from '../shared/types.ts';
import { browserStorage, createStore, readJson, type KeyValueStorage } from './storage.ts';

export interface PersonalData {
  version: 1;
  diary: DiaryEntry[];
  notes: Record<string, DeepNotes>;
  connections: ConnectionResult[];
  builds: ExperimentDesign[];
}

const KEY = 'principle-loop.personal.v1';

function emptyData(): PersonalData {
  return { version: 1, diary: [], notes: {}, connections: [], builds: [] };
}

function sanitize(raw: unknown): PersonalData {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<PersonalData>;
  return {
    version: 1,
    diary: Array.isArray(r.diary) ? r.diary.filter((d) => d && typeof d.id === 'string' && d.item) : [],
    notes: r.notes && typeof r.notes === 'object' ? r.notes : {},
    connections: Array.isArray(r.connections) ? r.connections : [],
    builds: Array.isArray(r.builds) ? r.builds : [],
  };
}

const storage: KeyValueStorage = browserStorage;
const store = createStore<PersonalData>(sanitize(readJson(storage, KEY, emptyData())));

function commit(next: PersonalData) {
  storage.set(KEY, JSON.stringify(next));
  store.set(next);
}

// 他のタブで変更されたら取り込む
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) store.set(sanitize(readJson(storage, KEY, emptyData())));
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

export function saveToDiary(item: DailyItem, kind: DiaryKind = 'daily', state: PrincipleState = 'OBSERVATION'): DiaryEntry {
  const data = store.get();
  const existing = data.diary.find((d) => d.id === item.id);
  if (existing) return existing;
  const now = nowIso();
  const entry: DiaryEntry = {
    id: item.id,
    kind,
    source: diarySource({ kind, item }),
    state,
    item: { ...item, saved: true },
    memo: '',
    tags: [...(item.tags ?? [])],
    experiments: [],
    createdAt: now,
    updatedAt: now,
  };
  commit({ ...data, diary: [entry, ...data.diary] });
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

export function toggleSaved(item: DailyItem): boolean {
  if (isSaved(item.id)) {
    removeFromDiary(item.id);
    return false;
  }
  saveToDiary(item);
  return true;
}

// ---------------- Memo / 気づき（DIARY の 1 件として保存する） ----------------

/** PRINCIPLE LOOP へ送った Memo / 気づきを、そのまま DIARY に保存する（AI の分析はしない） */
export function saveNote(input: { text: string; source: NoteSource; tags?: string[] }): DiaryEntry {
  const entry = createNoteEntry(input, new Date(), newId(input.source));
  const data = store.get();
  commit({ ...data, diary: [entry, ...data.diary] });
  return entry;
}

/** Memo / 気づきの本文・種類を直す */
export function updateNote(id: string, patch: { text?: string; source?: NoteSource }) {
  const entry = store.get().diary.find((d) => d.id === id);
  if (!entry) return;
  let item = entry.item;
  if (patch.text !== undefined) item = withNoteText(item, patch.text);
  if (patch.source) item = withNoteSource(item, patch.source);
  updateDiary(id, { item, ...(patch.source ? { source: patch.source } : {}) });
}

/** 3行DEEP を付ける・直す（undefined で消す） */
export function setEntryDeep(id: string, deep: LightDeep | undefined) {
  updateDiary(id, { deep: deep ? { ...deep, by: 'user', updatedAt: nowIso() } : undefined });
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

// ---------------- BUILD ----------------

export function saveBuild(d: ExperimentDesign) {
  const data = store.get();
  const exists = data.builds.some((x) => x.id === d.id);
  const next = { ...d, updatedAt: nowIso() };
  commit({ ...data, builds: exists ? data.builds.map((x) => (x.id === d.id ? next : x)) : [next, ...data.builds] });
}

export function removeBuild(id: string) {
  const data = store.get();
  commit({ ...data, builds: data.builds.filter((b) => b.id !== id) });
}

// ---------------- Backup ----------------

export function exportPersonal(): string {
  return JSON.stringify({ app: 'principle-loop', exportedAt: nowIso(), ...store.get() }, null, 2);
}

/** バックアップを読み込む。同じ id は読み込んだ側で上書きする（マージ）。 */
export function importPersonal(text: string): { diary: number; connections: number; builds: number } {
  const incoming = sanitize(JSON.parse(text));
  const data = store.get();
  const mergeById = <T extends { id: string }>(a: T[], b: T[]) => {
    const map = new Map(a.map((x) => [x.id, x]));
    b.forEach((x) => map.set(x.id, x));
    return [...map.values()];
  };
  const next: PersonalData = {
    version: 1,
    diary: mergeById(data.diary, incoming.diary).sort((x, y) => (x.updatedAt < y.updatedAt ? 1 : -1)),
    notes: { ...data.notes, ...incoming.notes },
    connections: mergeById(data.connections, incoming.connections),
    builds: mergeById(data.builds, incoming.builds),
  };
  commit(next);
  return { diary: incoming.diary.length, connections: incoming.connections.length, builds: incoming.builds.length };
}

export function clearPersonal() {
  commit(emptyData());
}
