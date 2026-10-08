// Corre cada 10 minutos en GitHub Actions.
// 1) Le avisa a Gabriel cuando un alumno cancela, reserva o vuelve a su clase.
// 2) Le recuerda al alumno su clase de hoy, 3 horas antes.
import admin from "firebase-admin";

if (!process.env.FIREBASE_SA) { console.log("Falta el secreto FIREBASE_SA: no se envía nada."); process.exit(0); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
const db = admin.firestore();
const fcm = admin.messaging();
const LINK = "https://masterpadel360.github.io/clases-padel/";
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const CLUB = { JUMP: "Jump", ESPACIO: "Espacio La 10" };
const pad = n => String(n).padStart(2, "0");
const ahora = new Date();
const ar = new Date(ahora.getTime() - 3 * 3600e3); // hora de Córdoba en los campos UTC
const hoy = `${ar.getUTCFullYear()}-${pad(ar.getUTCMonth() + 1)}-${pad(ar.getUTCDate())}`;
const inicioDe = (fecha, hora) => new Date(`${fecha}T${hora}:00-03:00`);
const fechaTxt = f => { const d = new Date(`${f}T12:00:00-03:00`); return f === hoy ? "hoy" : `el ${DIAS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };
const primerNombre = n => String(n || "").trim().split(/\s+/)[0].replace(/^./, c => c.toUpperCase());

const tokens = {};
(await db.collection("tokens").get()).forEach(d => { tokens[d.id] = d.data(); });

async function enviar(uid, { title, body, tag }) {
  const t = tokens[uid]; if (!t || !t.tokens || !t.tokens.length) return 0;
  const res = await fcm.sendEachForMulticast({
    tokens: t.tokens,
    data: { title, body, tag: tag || "", link: LINK },
    webpush: { headers: { Urgency: "high", TTL: "7200" }, fcmOptions: { link: LINK } },
  });
  const malos = [];
  res.responses.forEach((r, i) => { if (!r.success && ["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"].includes(r.error && r.error.code)) malos.push(t.tokens[i]); });
  if (malos.length) await db.doc("tokens/" + uid).update({ tokens: admin.firestore.FieldValue.arrayRemove(...malos) });
  return res.successCount;
}

/* ---------- 1) Avisos para Gabriel ---------- */
const staff = Object.entries(tokens).filter(([, t]) => t.rol === "dueño").map(([uid]) => uid);
const desde = admin.firestore.Timestamp.fromDate(new Date(ahora.getTime() - 6 * 3600e3));
const nuevos = (await db.collection("avisos").where("creado", ">=", desde).get()).docs.filter(d => !d.data().notificado);
if (nuevos.length) {
  const todos = (await db.collection("avisos").where("fecha", ">=", hoy).get()).docs.map(d => d.data());
  const porAlumno = {};
  nuevos.forEach(d => { const v = d.data(); (porAlumno[v.alumnoId] = porAlumno[v.alumnoId] || []).push(v); });
  for (const lista of Object.values(porAlumno)) {
    const n = primerNombre(lista[0].nombre);
    const vuelta = v => v.tipo === "recupera" && todos.some(x => x.tipo === "ausencia" && x.alumnoId === v.alumnoId && x.fecha === v.fecha && x.hora === v.hora);
    let msg;
    if (lista.length === 1) {
      const v = lista[0];
      if (vuelta(v)) msg = { title: `${n} al final sí va`, body: `${fechaTxt(v.fecha)} a las ${v.hora} · ${CLUB[v.club] || v.club}` };
      else if (v.tipo === "ausencia") msg = { title: `${n} no va`, body: `${fechaTxt(v.fecha)} a las ${v.hora} · ${v.conRecupero ? "queda para recuperar" : "avisó tarde, no recupera"}` };
      else msg = { title: `${n} reservó para recuperar`, body: `${fechaTxt(v.fecha)} a las ${v.hora}${v.nivel ? ` (${v.nivel})` : ""} · ${CLUB[v.club] || v.club}` };
    } else {
      const aus = lista.filter(v => v.tipo === "ausencia"), rec = lista.filter(v => v.tipo === "recupera");
      msg = { title: `${n}: ${lista.length} avisos`, body: [aus.length ? `no va ${aus.map(v => `${fechaTxt(v.fecha)} ${v.hora}`).join(", ")}` : "", rec.length ? `recupera ${rec.map(v => `${fechaTxt(v.fecha)} ${v.hora}`).join(", ")}` : ""].filter(Boolean).join(" · ") };
    }
    for (const uid of staff) await enviar(uid, { ...msg, tag: "aviso-" + lista[0].alumnoId });
  }
  const b = db.batch(); nuevos.forEach(d => b.update(d.ref, { notificado: true })); await b.commit();
  console.log(`Avisos notificados: ${nuevos.length}`);
}

/* ---------- 2) Recordatorio 3 horas antes ---------- */
const alumnosConApp = Object.entries(tokens).filter(([, t]) => t.rol === "alumno" && t.alumnoId && t.tokens && t.tokens.length);
if (alumnosConApp.length) {
  const avisosHoy = (await db.collection("avisos").where("fecha", "==", hoy).get()).docs.map(d => d.data());
  const diaHoy = ar.getUTCDay(); let enviados = 0;
  for (const [uid, t] of alumnosConApp) {
    const aS = await db.doc("alumnos/" + t.alumnoId).get(); if (!aS.exists) continue; const a = aS.data(); if (a.activo === false) continue;
    const mios = avisosHoy.filter(v => v.alumnoId === t.alumnoId);
    const clases = (a.horarios || []).filter(h => h.dia === diaHoy).map(h => ({ hora: h.hora, club: a.club }));
    mios.filter(v => v.tipo === "recupera" && !clases.some(c => c.hora === v.hora)).forEach(v => clases.push({ hora: v.hora, club: v.club, recupera: true }));
    for (const c of clases) {
      const falta = (inicioDe(hoy, c.hora) - ahora) / 60000;
      if (falta <= 0 || falta > 180) continue;
      const aus = mios.some(v => v.tipo === "ausencia" && v.hora === c.hora) && !mios.some(v => v.tipo === "recupera" && v.hora === c.hora);
      if (aus) continue;
      const ref = db.doc(`recordatorios/${t.alumnoId}_${hoy}_${c.hora.replace(":", "")}`);
      if ((await ref.get()).exists) continue;
      const ok = await enviar(uid, { title: "Hoy tenés pádel 🎾", body: `${primerNombre(a.nombre)}, te esperamos a las ${c.hora} en ${CLUB[c.club] || c.club}${c.recupera ? " (recuperación)" : ""}. Si no podés venir, avisá en la app.`, tag: "recordatorio" });
      await ref.set({ enviado: admin.firestore.FieldValue.serverTimestamp(), ok });
      enviados++;
    }
  }
  console.log(`Recordatorios: ${enviados}`);
}
console.log("Listo");
