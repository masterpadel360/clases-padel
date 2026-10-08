/* Recibe las notificaciones aunque la app esté cerrada */
self.window = self;
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
importScripts("config.js?v=sw1");
firebase.initializeApp(self.FIREBASE_CONFIG);
const messaging = firebase.messaging();

// Mensajes que llegan solo con datos: los mostramos nosotros.
messaging.onBackgroundMessage(m => {
  if (m.notification) return; // los que traen "notification" los muestra Firebase solo
  const d = m.data || {};
  return self.registration.showNotification(d.title || "Clases de Pádel", { body: d.body || "", icon: "icono-192.png", badge: "icono-192.png", data: { link: d.link || "./" }, tag: d.tag || undefined });
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const link = (e.notification.data && (e.notification.data.link || (e.notification.data.FCM_MSG && e.notification.data.FCM_MSG.fcmOptions && e.notification.data.FCM_MSG.fcmOptions.link))) || "./";
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => { for (const w of ws) { if ("focus" in w) return w.focus(); } return clients.openWindow(link); }));
});
