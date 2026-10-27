/* Mi Agenda: recibe los avisos aunque la app esté cerrada */
self.window = self;
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
importScripts("../config.js?v=ag1");
firebase.initializeApp(self.FIREBASE_CONFIG);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(m => {
  if (m.notification) return;
  const d = m.data || {};
  return self.registration.showNotification(d.title || "Mi Agenda", { body: d.body || "", icon: "icono-192.png", badge: "icono-192.png", data: { link: d.link || "./" }, tag: d.tag || undefined });
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || "./";
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => { for (const w of ws) { if ("focus" in w) return w.focus(); } return clients.openWindow(link); }));
});
