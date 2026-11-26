/* global caches */
const CACHE = 'cardlens-shell-v4';

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (isDocument(request, url)) {
    event.respondWith(networkFirstDocument(request, url));
    return;
  }
  event.respondWith(networkFirstAsset(request));
});

function isAppShell(url) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  return path === '/' || path.endsWith('/index.html');
}

function isDocument(request, url) {
  return request.mode === 'navigate' || request.destination === 'document' || isAppShell(url);
}

async function precacheShell() {
  const cache = await caches.open(CACHE);
  await Promise.all(['./', './index.html'].map(async (path) => {
    const response = await fetch(new Request(path, { cache: 'reload' }));
    if (response.ok) {
      await cache.put(path, response);
    }
  }));
}

/** HTML is always revalidated. A cached shell is used only when the network fails. */
async function networkFirstDocument(request, url) {
  try {
    const response = await fetch(request.url, {
      cache: 'reload',
      credentials: 'same-origin',
      redirect: 'follow',
    });
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
      if (isAppShell(url)) {
        await cache.put('./index.html', response.clone());
      }
    }
    return response;
  } catch {
    const cached = await caches.match(request, { cacheName: CACHE });
    if (cached) {
      return cached;
    }
    if (request.mode === 'navigate' || isAppShell(url)) {
      const home = await caches.match('./index.html', { cacheName: CACHE });
      if (home) {
        return home;
      }
    }
    return offline();
  }
}

async function networkFirstAsset(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      const cache = await caches.open(CACHE);
      await cache.put(request, copy);
    }
    return response;
  } catch {
    const cached = await caches.match(request, { cacheName: CACHE });
    if (cached) {
      return cached;
    }
    return offline();
  }
}

function offline() {
  return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
}
