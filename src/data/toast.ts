import { useSyncExternalStore } from 'react';
import { createStore } from './storage.ts';

const store = createStore<{ id: number; message: string } | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

export function toast(message: string) {
  seq += 1;
  store.set({ id: seq, message });
  clearTimeout(timer);
  timer = setTimeout(() => store.set(null), 2600);
}

export function useToast() {
  return useSyncExternalStore(store.subscribe, store.get);
}

export async function copyText(text: string, done = 'コピーしました'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    // クリップボードが使えない環境（古いブラウザ・権限なし）向け
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    toast(ok ? done : 'コピーできませんでした。手動で選択してください');
  }
}
