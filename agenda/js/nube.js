/* Mi Agenda — puente con Firebase (la misma cuenta de Clases de Pádel).
   La app (diseño y hábitos de Rutina) trabaja con un solo objeto de datos. Acá ese objeto se arma con lo guardado
   en Firebase y cada cambio se guarda de vuelta, cosa por cosa:
   - agenda/{uid}/items/{id}  tipo "evento"    ↔ bloques de la agenda (lo de siempre de Mi Agenda)
                              tipo "pendiente" / "hoy" ↔ tareas
                              tipo "gasto" / "ingreso" ↔ gastos e ingresos
                              _rutina        → ajustes, hábitos y clases
                              _log_AAAA-MM   → hábitos marcados de ese mes
                              _avisos        → plan de avisos de hábitos (lo manda scripts/agenda.mjs)
   Así los avisos de siempre (agenda, tareas, resumen del día, gastos) siguen andando igual. */
(function () {
  "use strict";
  const AG = (window.AG = {});
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const masMin = (h, m) => { const [a, b] = String(h || "00:00").split(":").map(Number); const t = Math.min(23 * 60 + 59, a * 60 + b + m); return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`; };
  const COLOR_EV = "#2B7FD9";

  // ---------- Si Firestore se traba en el iPhone, recargar ----------
  const trabado = (e) => /INTERNAL ASSERTION FAILED|Unexpected state/i.test(String((e && (e.message || (e.reason && e.reason.message) || e.reason)) || e || ""));
  function recargar() {
    let u = 0; try { u = Number(sessionStorage.getItem("agRecarga")) || 0; } catch (x) {}
    if (Date.now() - u < 20000) return;
    try { sessionStorage.setItem("agRecarga", String(Date.now())); } catch (x) {}
    setTimeout(() => location.reload(), 600);
  }
  window.addEventListener("unhandledrejection", (e) => { if (trabado(e.reason)) recargar(); });
  window.addEventListener("error", (e) => { if (trabado(e.error || e.message)) recargar(); });
  (function () { let oculto = 0; document.addEventListener("visibilitychange", () => {
    if (document.hidden) { oculto = Date.now(); return; }
    if (oculto && Date.now() - oculto > 20 * 60 * 1000 && !document.body.classList.contains("open")) location.reload();
  }); })();

  // ---------- Categorías de gastos de la Mi Agenda anterior ----------
  const CAT_VIEJA = { "comida": "comida", "transporte": "transporte", "casa": "casa", "salud": "salud", "otros": "otros", "pádel / trabajo": "trabajo", "padel / trabajo": "trabajo", "salidas": "ocio" };
  const CAT_EXTRA = { "súper": { id: "super", name: "Súper", emoji: "🛒" }, "super": { id: "super", name: "Súper", emoji: "🛒" }, "servicios": { id: "servicios", name: "Servicios", emoji: "💡" }, "ropa": { id: "ropa", name: "Ropa", emoji: "👕" } };
  const FIJAS = ["comida", "transporte", "canchas", "casa", "salud", "ocio", "trabajo", "otros"];

  // ---------- Firebase → datos de la app ----------
  let raw = {};         // id → documento tal cual está en Firebase (para no perder campos que la app no usa)
  let ultimo = {};      // id → JSON de lo último guardado/leído (para guardar solo lo que cambió)
  let conocidos = new Set(); // ids que la app ya tiene (solo esos se pueden borrar)

  function aTarea(id, x) {
    return {
      id, title: x.texto || "", date: x.fecha || null, time: x.hora || null, prio: x.prio || "normal", list: x.lista || null,
      done: !!x.hecho, doneAt: x.doneAt || (x.hechoEn ? isoDia(x.hechoEn) : null),
      created: x.created || (x.creado ? new Date(x.creado).toISOString() : ""),
    };
  }
  function aGasto(id, x, extras) {
    let cat = String(x.cat || "otros");
    const k = cat.toLowerCase();
    if (CAT_VIEJA[k]) cat = CAT_VIEJA[k];
    else if (CAT_EXTRA[k]) { extras.add(k); cat = CAT_EXTRA[k].id; }
    const g = { id, kind: x.tipo === "ingreso" ? "ingreso" : "gasto", amount: Number(x.monto) || 0, cat, note: x.texto || "", date: x.fecha || hoy(),
      created: x.created || (x.creado ? new Date(x.creado).toISOString() : (x.fecha || hoy()) + "T12:00") };
    if (x.medio) g.medio = x.medio;
    return g;
  }
  function diasEv(x) {
    if (Array.isArray(x.dias)) return x.dias;
    const r = x.repetir || "";
    if (r === "diario") return [0, 1, 2, 3, 4, 5, 6];
    if (r === "lav") return [1, 2, 3, 4, 5];
    if (r === "semanal" && x.fecha) return [new Date(x.fecha + "T12:00").getDay()];
    return [];
  }
  function aBloque(id, x) {
    const d = diasEv(x);
    const start = x.hora || "08:00";
    const b = { id, title: x.texto || "", start, end: x.hasta_h && x.hasta_h > start ? x.hasta_h : masMin(start, x.hora ? 60 : 30), color: x.color || COLOR_EV,
      weekly: d.length > 0, date: d.length ? null : (x.fecha || hoy()), except: Array.isArray(x.saltear) ? x.saltear : [] };
    if (d.length) { b.wd = d[0]; b.days = d; b.since = x.fecha || hoy(); if (x.hasta) b.until = x.hasta; }
    return b;
  }
  function isoDia(ms) { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

  function armarEstado() {
    const e = { tasks: [], expenses: [], blocks: [], log: {} };
    let meta = null; const extras = new Set();
    for (const [id, x] of Object.entries(raw)) {
      if (id === "_rutina") meta = x;
      else if (id.startsWith("_log_")) Object.assign(e.log, x.dias || {});
      else if (id === "_avisos") continue;
      else if (x.tipo === "evento") e.blocks.push(aBloque(id, x));
      else if (x.tipo === "pendiente" || x.tipo === "hoy") e.tasks.push(aTarea(id, x));
      else if (x.tipo === "gasto" || x.tipo === "ingreso") e.expenses.push(aGasto(id, x, extras));
    }
    const s = { v: (meta && meta.v) || 3, settings: (meta && meta.settings) || {}, habits: (meta && meta.habits) || [], classes: (meta && meta.classes) || [], classOff: (meta && meta.classOff) || {}, ...e };
    // Categorías de la Mi Agenda anterior que Rutina no tiene: se suman como propias.
    const propias = Array.isArray(s.settings.expenseCats) ? s.settings.expenseCats : [];
    for (const k of extras) { const c = CAT_EXTRA[k]; if (!propias.some((p) => p.id === c.id)) propias.push({ ...c }); }
    s.settings.expenseCats = propias;
    return s;
  }

  // ---------- Datos de la app → Firebase ----------
  function deTarea(t) {
    const x = { ...(raw[t.id] || {}) };
    if (x.tipo !== "hoy") x.tipo = "pendiente";
    Object.assign(x, { texto: t.title || "", fecha: t.date || "", hora: t.time || "", hecho: !!t.done, prio: t.prio || "normal", lista: t.list || null, doneAt: t.doneAt || null, created: t.created || "" });
    x.hechoEn = t.done ? (x.hechoEn || Date.now()) : null;
    if (x.avisoMin == null) x.avisoMin = t.time ? 0 : -1;
    if (!x.creado) x.creado = Date.now();
    return x;
  }
  function deGasto(g) {
    const x = { ...(raw[g.id] || {}) };
    Object.assign(x, { tipo: g.kind === "ingreso" ? "ingreso" : "gasto", monto: Number(g.amount) || 0, texto: g.note || "", cat: g.cat || "otros", fecha: g.date || hoy(), created: g.created || "" });
    if (g.medio) x.medio = g.medio;
    if (!x.creado) x.creado = Date.now();
    return x;
  }
  function deBloque(b) {
    const x = { ...(raw[b.id] || {}) };
    delete x.repetir;
    const dias = b.weekly ? (Array.isArray(b.days) && b.days.length ? b.days : [b.wd]) : [];
    Object.assign(x, { tipo: "evento", texto: b.title || "", fecha: b.weekly ? (b.since || hoy()) : (b.date || hoy()), hora: b.start || "", hasta_h: b.end || "", dias, saltear: b.except || [], color: b.color || COLOR_EV });
    if (b.weekly && b.until) x.hasta = b.until; else if (!b.weekly) delete x.hasta;
    if (x.avisoMin == null) x.avisoMin = 30;
    if (!x.creado) x.creado = Date.now();
    return x;
  }
  function docsDe(s) {
    const out = {};
    for (const t of s.tasks || []) out[t.id] = deTarea(t);
    for (const g of s.expenses || []) out[g.id] = deGasto(g);
    for (const b of s.blocks || []) out[b.id] = deBloque(b);
    out._rutina = { tipo: "rutina", v: s.v, settings: s.settings, habits: s.habits, classes: s.classes, classOff: s.classOff };
    const meses = {};
    for (const [k, v] of Object.entries(s.log || {})) { if (!v || !Object.keys(v).length) continue; (meses[k.slice(0, 7)] = meses[k.slice(0, 7)] || {})[k] = v; }
    for (const [m, dias] of Object.entries(meses)) out["_log_" + m] = { tipo: "rutina-log", mes: m, dias };
    // Meses que quedaron vacíos (se desmarcó todo): se guardan vacíos para que no vuelvan.
    for (const id of Object.keys(raw)) if (id.startsWith("_log_") && !out[id]) out[id] = { tipo: "rutina-log", mes: id.slice(5), dias: {} };
    return out;
  }
  const limpio = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === undefined ? null : v)));
  // JSON con las claves ordenadas (Firebase puede devolver los campos en otro orden).
  const estable = (o) => JSON.stringify(o, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, x) => { a[x] = v[x]; return a; }, {}) : v));

  let db = null, uid = null, cola = Promise.resolve();
  AG.guardar = function (s) {
    if (!db || !uid) return;
    const docs = docsDe(s);
    const col = db.collection(`agenda/${uid}/items`);
    const lote = [];
    for (const [id, d] of Object.entries(docs)) {
      const c = limpio(d); const j = estable(c);
      if (ultimo[id] === j) continue;
      ultimo[id] = j; raw[id] = c; conocidos.add(id);
      lote.push(["set", id, c]);
    }
    for (const id of [...conocidos]) {
      if (docs[id] || id.startsWith("_")) continue;
      conocidos.delete(id); delete ultimo[id]; delete raw[id];
      lote.push(["del", id]);
    }
    if (!lote.length) return;
    cola = cola.then(async () => {
      for (let i = 0; i < lote.length; i += 400) {
        const b = db.batch();
        for (const [op, id, c] of lote.slice(i, i + 400)) op === "set" ? b.set(col.doc(id), c) : b.delete(col.doc(id));
        try { await b.commit(); } catch (e) { console.error(e); if (trabado(e)) recargar(); else aviso("No se pudo guardar. Revisá la conexión."); }
      }
    });
  };
  AG.guardarPlan = async function (datos) {
    if (!db || !uid) return;
    await db.doc(`agenda/${uid}/items/_avisos`).set(limpio({ tipo: "rutina-avisos", plan: datos.plan || [], hechos: datos.hechos || {}, actualizado: Date.now() }));
  };

  // ---------- Avisos (Firebase Cloud Messaging, lista propia de Mi Agenda) ----------
  async function registrarToken() {
    const reg = await navigator.serviceWorker.register("sw.js");
    const sw = reg.installing || reg.waiting || reg.active;
    if (sw && sw.state !== "activated") await new Promise((ok) => { const t = setTimeout(ok, 8000); sw.addEventListener("statechange", () => { if (sw.state === "activated") { clearTimeout(t); ok(); } }); });
    const token = await firebase.messaging().getToken({ vapidKey: window.VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) throw new Error("sin token");
    await db.doc("tokens/" + uid + "__agenda").set({ rol: "agenda", tokens: firebase.firestore.FieldValue.arrayUnion(token), actualizado: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    try { await db.doc("tokens/" + uid).set({ tokens: firebase.firestore.FieldValue.arrayRemove(token) }, { merge: true }); } catch (e) {}
    try { localStorage.setItem("agNotif", "1"); } catch (e) {}
    return token;
  }
  AG.activarAvisos = registrarToken;
  AG.apagarAvisos = async function () {
    try {
      const reg = await navigator.serviceWorker.getRegistration("sw.js");
      const token = reg && await firebase.messaging().getToken({ vapidKey: window.VAPID_KEY, serviceWorkerRegistration: reg });
      if (token) await db.doc("tokens/" + uid + "__agenda").set({ tokens: firebase.firestore.FieldValue.arrayRemove(token) }, { merge: true });
    } catch (e) {}
    try { localStorage.removeItem("agNotif"); } catch (e) {}
  };
  async function refrescarToken() {
    let ok = false; try { ok = localStorage.getItem("agNotif") === "1" && Notification.permission === "granted"; } catch (e) {}
    if (!ok) return;
    try { await registrarToken(); firebase.messaging().onMessage((m) => { const d = m.data || {}; aviso(`${d.title || ""}${d.body ? ": " + d.body : ""}`); }); } catch (e) {}
  }

  function aviso(t) {
    let el = $("#agToast");
    if (!el) { el = document.createElement("div"); el.id = "agToast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = t; el.classList.add("show"); clearTimeout(aviso.t); aviso.t = setTimeout(() => el.classList.remove("show"), 3200);
  }

  // ---------- Entrar ----------
  function pantallaLogin(msg) {
    $("#app").innerHTML = `<div class="ag-login"><form id="fLogin">
      <div class="brand">Mi Agenda</div><h1>Hola, Gabriel</h1>
      <p class="muted">Entrá con la misma cuenta de Clases de Pádel.</p>
      <div class="field"><label for="lgU">Mail</label><input class="input" id="lgU" type="email" autocomplete="username" value="${esc(window.OWNER_EMAIL || "")}" required></div>
      <div class="field"><label for="lgP">Contraseña</label><input class="input" id="lgP" type="password" autocomplete="current-password" required></div>
      <p class="ag-err">${esc(msg || "")}</p>
      <button class="btn primary block" id="lgBtn">Entrar</button></form></div>`;
    $("#fLogin").onsubmit = async (e) => {
      e.preventDefault(); const b = $("#lgBtn"); b.disabled = true; b.textContent = "Entrando…";
      try { await firebase.auth().signInWithEmailAndPassword($("#lgU").value.trim(), $("#lgP").value); }
      catch (er) { $(".ag-err").textContent = er.code === "auth/too-many-requests" ? "Demasiados intentos. Esperá unos minutos." : er.code === "auth/network-request-failed" ? "Sin conexión." : "Mail o contraseña incorrectos."; b.disabled = false; b.textContent = "Entrar"; }
    };
  }
  const cargando = () => { $("#app").innerHTML = '<div class="ag-login"><p class="muted" style="text-align:center">Cargando tu agenda…</p></div>'; };

  let arranco = false, unsub = null;
  function iniciar() {
    firebase.initializeApp(window.FIREBASE_CONFIG);
    db = firebase.firestore();
    try { db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch (e) {}
    cargando();
    firebase.auth().onAuthStateChanged((u) => {
      if (unsub) { unsub(); unsub = null; }
      if (!u) { uid = null; if (arranco) location.reload(); else pantallaLogin(); return; }
      if (window.OWNER_EMAIL && u.email !== window.OWNER_EMAIL) { firebase.auth().signOut(); pantallaLogin("Esta agenda es solo para la cuenta de Gabriel."); return; }
      uid = u.uid; cargando();
      unsub = db.collection(`agenda/${uid}/items`).onSnapshot({ includeMetadataChanges: false }, (snap) => {
        let cambio = false;
        for (const ch of snap.docChanges()) {
          const id = ch.doc.id;
          if (ch.type === "removed") { if (raw[id]) { delete raw[id]; delete ultimo[id]; cambio = true; } continue; }
          const d = limpio(ch.doc.data()); const j = estable(d);
          if (ultimo[id] === j) continue;
          raw[id] = d; ultimo[id] = j; cambio = true;
        }
        if (!arranco) {
          // La primera vez espera a tener los datos del servidor si el celu no tenía nada guardado.
          if (snap.metadata.fromCache && !snap.size) return;
          arranco = true;
          const e = armarEstado(); AG.estado = e;
          conocidos = new Set(Object.keys(raw).filter((id) => !id.startsWith("_")));
          import("./main.js").catch((er) => { console.error(er); $("#app").innerHTML = '<div class="ag-login"><p class="muted">No se pudo abrir la app. Cerrala y abrila de nuevo.</p></div>'; });
          refrescarToken();
          return;
        }
        if (cambio && AG.alCambiar) {
          const e = armarEstado();
          for (const id of Object.keys(raw)) if (!id.startsWith("_")) conocidos.add(id);
          for (const id of [...conocidos]) if (!raw[id]) conocidos.delete(id);
          AG.alCambiar(e);
        }
      }, (er) => { console.error(er); if (trabado(er)) recargar(); else aviso("No se pudo leer la agenda."); });
      // Si no hay internet y el celu no tenía nada guardado, a los 8 segundos arranca igual (vacía).
      setTimeout(() => { if (!arranco && uid) { arranco = true; AG.estado = armarEstado(); import("./main.js"); } }, 8000);
    });
  }
  if (!window.FIREBASE_CONFIG) { document.getElementById("app").innerHTML = '<p style="padding:24px">Falta la configuración.</p>'; return; }
  iniciar();
})();
