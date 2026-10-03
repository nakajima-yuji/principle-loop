// PRINCIPLE LOOP の最低限のオフライン対応。
// - ページ本体とデータ（JSON）は「ネット優先、つながらなければ前回のもの」
// - 画像・CSS・JS は「キャッシュ優先」（ファイル名にハッシュが付くので古くならない）
// 外部サイト（GitHub API など）へのリクエストには一切関与しない。

const CACHE = 'principle-loop-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icons/icon.svg'])).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isData = url.pathname.includes('/data/');
  const isPage = req.mode === 'navigate';

  if (isData || isPage) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !url.pathname.endsWith('/activity.json')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.includes('/assets/') || url.pathname.includes('/icons/'))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
