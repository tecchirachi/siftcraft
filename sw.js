// Service Worker【学習用】: 一度読み込んだファイルをキャッシュし、
// オフラインでもアプリが開けるようにする最小構成。
// 戦略: ネットワーク優先で取得し、成功したらキャッシュを更新。
// 失敗（オフライン）したらキャッシュから返す。
const CACHE = 'shiftcraft-v1'
self.addEventListener('install', (event) => {
  self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
})
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((cache) => cache.put(event.request, copy))
        return res
      })
      .catch(() => caches.match(event.request)),
  )
})
