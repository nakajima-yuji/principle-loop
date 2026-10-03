// 公開されている activity.json（夜間処理が読む値）をアプリでも表示する。

import { useEffect, useSyncExternalStore } from 'react';
import type { Activity } from '../shared/types.ts';
import { loadActivity } from './api.ts';
import { reconcileHeartbeat } from './heartbeat.ts';
import { createStore } from './storage.ts';

interface ServerActivityState {
  activity: Activity | null;
  error: string | null;
  loadedAt: number;
}

const store = createStore<ServerActivityState>({ activity: null, error: null, loadedAt: 0 });
let pending: Promise<void> | null = null;

export function refreshServerActivity(): Promise<void> {
  pending ??= loadActivity()
    .then((activity) => {
      store.set({ activity, error: null, loadedAt: Date.now() });
      reconcileHeartbeat(activity.lastActive);
    })
    .catch((e: unknown) => {
      store.set({ activity: null, error: e instanceof Error ? e.message : String(e), loadedAt: Date.now() });
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export function useServerActivity(): ServerActivityState {
  const state = useSyncExternalStore(store.subscribe, store.get);
  useEffect(() => {
    if (Date.now() - store.get().loadedAt > 60_000) void refreshServerActivity();
  }, []);
  return state;
}
