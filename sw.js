/* Сервис-воркер: офлайн-режим для установленного приложения.
   Стратегия «сначала сеть»: онлайн всегда приходит свежая версия,
   офлайн отдаётся последняя закешированная. */
'use strict';

var CACHE = 'ux-roadmap-v1';
var PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(PRECACHE); }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; /* видео с YouTube и прочее — мимо кеша */

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        /* waitUntil — иначе браузер может погасить воркер до завершения записи */
        e.waitUntil(caches.open(CACHE).then(function (c) { return c.put(req, copy); }));
      }
      return res;
    }).catch(function () {
      /* ignoreSearch: офлайн-открытие ссылки с ?query должно получить ту же
         свежую копию приложения, что и открытие без параметров */
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
