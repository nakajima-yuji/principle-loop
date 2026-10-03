// このデバイスだけの設定。GitHub のトークンもここ（このブラウザの中）にだけ保存する。

import { useSyncExternalStore } from 'react';
import { browserStorage, createStore, readJson } from './storage.ts';

export interface Settings {
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  githubToken: string;
  heartbeat: boolean;
}

export interface LocalActivity {
  lastActiveLocal: string; // このデバイスで最後に使った時刻
  heartbeatDate: string; // 活動通知を送った日（日本時間の日付）
  heartbeatAt: string;
  lastResult: string; // 直近の送信結果（表示用）
}

const SETTINGS_KEY = 'principle-loop.settings.v1';
const LOCAL_KEY = 'principle-loop.local-activity.v1';

/** ビルド時に GitHub Actions から渡される "owner/repo"、無ければ URL から推測 */
export function detectRepo(): { owner: string; repo: string } {
  const fromEnv = (import.meta.env.VITE_GITHUB_REPOSITORY as string | undefined) ?? '';
  const m = /^([^/\s]+)\/([^/\s]+)$/.exec(fromEnv);
  if (m) return { owner: m[1], repo: m[2] };
  if (typeof location !== 'undefined') {
    const host = /^([^.]+)\.github\.io$/.exec(location.hostname);
    const seg = location.pathname.split('/').filter(Boolean)[0];
    if (host) return { owner: host[1], repo: seg ?? `${host[1]}.github.io` };
  }
  return { owner: '', repo: '' };
}

function defaults(): Settings {
  const r = detectRepo();
  return {
    githubOwner: r.owner,
    githubRepo: r.repo,
    githubBranch: (import.meta.env.VITE_DEFAULT_BRANCH as string | undefined) || 'main',
    githubToken: '',
    heartbeat: true,
  };
}

const settingsStore = createStore<Settings>({ ...defaults(), ...readJson<Partial<Settings>>(browserStorage, SETTINGS_KEY, {}) });
const localStore = createStore<LocalActivity>({
  lastActiveLocal: '',
  heartbeatDate: '',
  heartbeatAt: '',
  lastResult: '',
  ...readJson<Partial<LocalActivity>>(browserStorage, LOCAL_KEY, {}),
});

export const getSettings = () => settingsStore.get();
export const getLocalActivity = () => localStore.get();

export function updateSettings(patch: Partial<Settings>) {
  const next = { ...settingsStore.get(), ...patch };
  browserStorage.set(SETTINGS_KEY, JSON.stringify(next));
  settingsStore.set(next);
}

export function updateLocalActivity(patch: Partial<LocalActivity>) {
  const next = { ...localStore.get(), ...patch };
  browserStorage.set(LOCAL_KEY, JSON.stringify(next));
  localStore.set(next);
}

export function useSettings(): Settings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get);
}

export function useLocalActivity(): LocalActivity {
  return useSyncExternalStore(localStore.subscribe, localStore.get);
}

export function repoUrl(s: Settings = getSettings()): string {
  return s.githubOwner && s.githubRepo ? `https://github.com/${s.githubOwner}/${s.githubRepo}` : '';
}

export function hasHeartbeatToken(s: Settings = getSettings()): boolean {
  return Boolean(s.githubToken && s.githubOwner && s.githubRepo);
}
