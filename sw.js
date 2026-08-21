const CACHE_NAME = "forja21-v9";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/data.js",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/apple-touch-icon-120.png",
  "./icons/apple-touch-icon-152.png",
  "./icons/apple-touch-icon-167.png",
  "./icons/apple-touch-icon-180.png",
  "./icons/favicon-32.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // No tocar peticiones a otros orígenes (Firebase Auth, Firestore, Google) —
  // tienen su propia lógica de red/streaming que el SW no debe interferir.
  if (new URL(req.url).origin !== location.origin) return;

  // Network-first for navigation requests (keep app fresh), fall back to cache offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Cache-first for static assets.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && new URL(req.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// Aviso de respaldo en segundo plano (solo donde el navegador soporta Periodic
// Background Sync — hoy en día básicamente Chrome/Android con la PWA instalada
// y "engagement" suficiente). No puede calcular el entreno exacto del día
// porque el service worker no tiene acceso a localStorage, así que se limita
// a recordar que se abra la app; el aviso preciso ("hoy toca báscula/gimnasio")
// se manda desde la propia app en cuanto la abres (ver js/app.js).
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "forja21-daily-check") {
    event.waitUntil(
      self.registration.showNotification("Forja21", {
        body: "Abre la app para ver qué toca hoy: entreno, comida y si hay que pesarse.",
        icon: "icons/icon-192.png",
        badge: "icons/icon-192.png",
        tag: "forja21-daily-fallback"
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(self.registration.scope));
      if (existing) return existing.focus();
      return self.clients.openWindow("./index.html");
    })
  );
});
