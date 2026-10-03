// GitHub Pages で壊れないよう、# を使ったルーティング（例：/#/deep?id=20261005-03）。
// サーバー側の設定が要らず、メールのリンクからも直接開ける。

import { useSyncExternalStore } from 'react';

export interface Route {
  path: string;
  params: URLSearchParams;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const q = raw.indexOf('?');
  const path = (q >= 0 ? raw.slice(0, q) : raw) || '/';
  return { path: path.startsWith('/') ? path : `/${path}`, params: new URLSearchParams(q >= 0 ? raw.slice(q + 1) : '') };
}

let cache: { hash: string; route: Route } = { hash: '\u0000', route: parse('') };

function snapshot(): Route {
  const hash = typeof location === 'undefined' ? '' : location.hash;
  if (cache.hash !== hash) cache = { hash, route: parse(hash) };
  return cache.route;
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, snapshot);
}

export function href(path: string, params?: Record<string, string | undefined | null>): string {
  const q = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, v);
  });
  const qs = q.toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export function navigate(path: string, params?: Record<string, string | undefined | null>) {
  const next = href(path, params);
  if (location.hash === next) return;
  location.hash = next;
}
