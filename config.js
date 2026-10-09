// Datos del proyecto de Firebase (son públicos: van dentro de la página).
// La seguridad la ponen las reglas de Firestore (firestore.rules), no estos datos.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyC6XHhioDKvqnA7PD5Pu5xGXgtdgkiQglM",
  authDomain: "clases-padel-e68b5.firebaseapp.com",
  projectId: "clases-padel-e68b5",
  storageBucket: "clases-padel-e68b5.firebasestorage.app",
  messagingSenderId: "547629249509",
  appId: "1:547629249509:web:58912a486d9daea674350c"
};

// Cuenta de Gabriel (dueño). Solo esta cuenta, con el mail confirmado, administra todo.
window.OWNER_EMAIL = "gabohuppi22@gmail.com";

// Clave pública para notificaciones (Firebase → Configuración → Cloud Messaging → Certificados push web).
window.VAPID_KEY = "BOBTZZTz7eYd4liJmkF2obikioilgsLLk19fpGPgB-wA1eP80YVJwMKhfiKZ2iC6xiCS6BUZmH2UXYeRbBREYYs";

// Dirección del aviso al instante (Cloudflare Worker). Si está vacía, los avisos salen igual cada 10 minutos.
window.AVISOS_URL = null;
