// localStorage の安全なラッパー。プライベートモードなどで使えない場合はメモリに置く。
// 将来ほかの保存先（同期サービスなど）に替えるときは、この KeyValueStorage を差し替える。

export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

const memory = new Map<string, string>();

export const browserStorage: KeyValueStorage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      memory.set(key, value);
      return false;
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      memory.delete(key);
    }
  },
};

export function readJson<T>(storage: KeyValueStorage, key: string, fallback: T): T {
  const raw = storage.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 同じ値を返し続け、変わったときだけ通知する小さなストア（useSyncExternalStore 用） */
export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: T) {
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
