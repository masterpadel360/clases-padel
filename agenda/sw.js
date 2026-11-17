/* Mi Agenda: funciona sin internet (guarda la app en el celu) y recibe los avisos aunque esté cerrada. */
self.window = self;
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
importScripts("../config.js?v=ag2");
firebase.initializeApp(self.FIREBASE_CONFIG);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(m => {
  if (m.notification) return;
  const d = m.data || {};
  return self.registration.showNotification(d.title || "Mi Agenda", { body: d.body || "", icon: "icono-192.png", badge: "icono-192.png", data: { link: d.link || "./?ir=hoy" }, tag: d.tag || undefined });
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || "./?ir=hoy";
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    for (const w of ws) { if ("focus" in w) { w.postMessage({ ir: "hoy" }); return w.focus(); } }
    return clients.openWindow(link);
  }));
});

// Cambiar VERSION en cada cambio publicado.
const VERSION = "mi-agenda-v3";
const FUENTES = "mi-agenda-fuentes";
const ARCHIVOS = ["./", "index.html", "css/app.css", "js/nube.js", "js/main.js", "js/logic.js", "js/store.js", "js/agregar.js", "js/calendario.js", "js/avisos.js", "js/finanzas.js", "js/tareas.js", "manifest.json", "icono.svg", "icono-180.png", "icono-192.png", "icono-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("mi-agenda") && k !== VERSION && k !== FUENTES).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Primero la red (para recibir cambios); sin conexión, lo guardado.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FUENTES).then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok || res.type === "opaque") c.put(e.request, res.clone()); return res; }))));
    return;
  }
  if (u.origin !== location.origin || !u.pathname.includes("/agenda/")) return;
  e.respondWith(fetch(e.request).then(r => { const copia = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
});
