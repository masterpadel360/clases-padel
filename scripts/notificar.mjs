// Corre cada 10 minutos en GitHub Actions.
// 1) Le avisa a Gabriel cuando un alumno cancela, reserva o vuelve a su clase (respaldo del aviso al instante).
// 2) Ordena las clases para recuperar por vencimiento y borra las vencidas.
// 3) Al alumno: recordatorio el día antes y 3 horas antes, avisos de lugar para recuperar y de vencimiento.
// 4) Al profe de Jump: si a la noche le falta cargar asistencia u horas (y a la mañana si sigue faltando lo de ayer).
import admin from "firebase-admin";
import { venceDe, normalizar, igualRec, clasesDelDia, opcionesDelDia, libres, catsDe, catNorm, masUnaHora, sumarDias, diaSemana, hhmm, clubH } from "./logica.mjs";

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
const pendientes = (await db.collection("avisos").where("creado", ">=", desde).get()).docs.filter(d => !d.data().notificado);
// Los marcamos notificados antes de mandar: si el aviso al instante (Cloudflare) ya lo mandó, no sale repetido.
const nuevos = [];
for (const d of pendientes) {
  const ok = await db.runTransaction(async tx => { const s = await tx.get(d.ref); if (!s.exists || s.data().notificado) return false; tx.update(d.ref, { notificado: true }); return true; });
  if (ok) nuevos.push(d);
}
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
  console.log(`Avisos notificados: ${nuevos.length}`);
}

/* ---------- 2) Clases para recuperar: cada una con su vencimiento ---------- */
const fechaDM = f => { const [, m, d] = f.split("-").map(Number); return `${d}/${m}`; };
const diaDM = f => `${DIAS[diaSemana(f)]} ${fechaDM(f)}`;
// a) Faltas y reservas nuevas desde la app: ubicar cada falta en su mes.
{
  const sinContar = (await db.collection("avisos").where("contado", "==", false).get()).docs;
  const porAl = {}; sinContar.forEach(d => { const v = d.data(); (porAl[v.alumnoId] = porAl[v.alumnoId] || []).push(d); });
  for (const [aid, docs] of Object.entries(porAl)) {
    try {
      await db.runTransaction(async tx => {
        const aRef = db.doc("alumnos/" + aid); const aS = await tx.get(aRef); if (!aS.exists) return;
        const pend = [], marcar = [];
        for (const d of docs) { const s = await tx.get(d.ref); if (!s.exists || s.data().contado !== false) continue; marcar.push(d.ref);
          const v = s.data(); if (v.tipo !== "ausencia" || !v.conRecupero) continue;
          const vuelta = await tx.get(db.doc(`avisos/${aid}_${v.fecha}_${v.hhmm}_recupera`)); if (!vuelta.exists) pend.push(v.fecha); }
        const n = normalizar(aS.data(), hoy, pend);
        if (!igualRec(aS.data(), n)) tx.update(aRef, n);
        marcar.forEach(r => tx.update(r, { contado: true }));
      });
    } catch (e) { console.log("No se pudo ordenar", aid, e.message); }
  }
  if (sinContar.length) console.log(`Avisos ubicados por vencimiento: ${sinContar.length}`);
}
// b) Una vez por hora: vencer las que pasaron de fecha y ordenar las que no tenían fecha.
{
  const estRef = db.doc("recordatorios/_estado"); const est = (await estRef.get()).data() || {};
  if (!est.repaso || ahora.getTime() - est.repaso.toMillis() > 55 * 60e3) {
    const conRec = (await db.collection("alumnos").where("recuperar", ">", 0).get()).docs;
    let cambios = 0, vencidas = 0;
    for (const d of conRec) {
      try {
        await db.runTransaction(async tx => { const s = await tx.get(d.ref); const a = s.data(); const n = normalizar(a, hoy);
          if (!igualRec(a, n)) { vencidas += Math.max(0, (a.recuperar || 0) - n.recuperar); cambios++; tx.update(d.ref, n); } });
      } catch (e) { console.log("Repaso", d.id, e.message); }
    }
    await estRef.set({ repaso: admin.firestore.Timestamp.fromDate(ahora) }, { merge: true });
    console.log(`Repaso de recuperaciones: ${cambios} alumnos ordenados, ${vencidas} clases vencidas`);
  }
}

/* ---------- 3) Avisos para los alumnos ---------- */
const alumnosConApp = Object.entries(tokens).filter(([, t]) => t.rol === "alumno" && t.alumnoId && t.tokens && t.tokens.length);
if (alumnosConApp.length) {
  const manana = sumarDias(hoy, 1); const horaAR = ar.getUTCHours();
  const avisos = (await db.collection("avisos").where("fecha", "in", [hoy, manana]).get()).docs.map(d => d.data());
  const turnos = ((await db.doc("publico/turnos").get()).data() || {}).t || {};
  const cupo = ((await db.doc("publico/info").get()).data() || {}).cupo || 4;
  const cupos = {}; (await db.collection("cupos").where("fecha", "in", [hoy, manana]).get()).docs.forEach(d => { cupos[d.id] = d.data(); });
  const yaEnviado = async id => (await db.doc("recordatorios/" + id).get()).exists;
  const marcar = (id, extra = {}) => db.doc("recordatorios/" + id).set({ enviado: admin.firestore.FieldValue.serverTimestamp(), ...extra });
  const lugarTxt = c => CLUB[c] || c;
  const lunes = sumarDias(hoy, -((diaSemana(hoy) + 6) % 7));
  let enviados = 0;
  for (const [uid, t] of alumnosConApp) {
    const aS = await db.doc("alumnos/" + t.alumnoId).get(); if (!aS.exists) continue;
    const a = { id: aS.id, ...aS.data() }; if (a.activo === false) continue;
    const nombre = primerNombre(a.nombre);
    const rec = normalizar(a, hoy); const nRec = rec.recuperar; const vences = Object.keys(rec.recVence);
    const mandar = async (id, msg, extra) => { const ok = await enviar(uid, msg); await marcar(id, { ok, ...extra }); enviados++; };

    // El día antes (unas 26 h antes): "mañana tenés clase; si no podés, avisá ahora y la recuperás".
    for (const f of [hoy, manana]) for (const c of clasesDelDia(a, f, avisos)) {
      const falta = (inicioDe(f, c.hora) - ahora) / 60000;
      if (falta <= 1450 || falta > 1620) continue;
      const id = `${a.id}_${f}_${hhmm(c.hora)}_dia`; if (await yaEnviado(id)) continue;
      await mandar(id, { title: "Mañana tenés pádel 🎾", body: c.tipo === "recupera"
        ? `${nombre}, mañana a las ${c.hora} recuperás en ${lugarTxt(c.club)}. Si no venís, la perdés.`
        : `${nombre}, mañana a las ${c.hora} en ${lugarTxt(c.club)}. Si no podés venir, avisá ahora en la app y la recuperás.`, tag: "dia-antes" });
    }
    // El mismo día, 3 horas antes. Si tiene clases para recuperar y hay lugar en la hora siguiente, se lo ofrece.
    for (const c of clasesDelDia(a, hoy, avisos)) {
      const falta = (inicioDe(hoy, c.hora) - ahora) / 60000;
      if (falta <= 0 || falta > 180) continue;
      const id = `${a.id}_${hoy}_${hhmm(c.hora)}`; if (await yaEnviado(id)) continue;
      let extra = "";
      const sig = masUnaHora(c.hora); const ts = sig && turnos[`${c.club}|${diaSemana(hoy)}|${sig}`]; const cats = catsDe(a);
      if (nRec > 0 && ts && (!cats.size || (ts.nivel && cats.has(catNorm(ts.nivel)))) && libres(turnos, cupos, cupo, c.club, hoy, sig) > 0 && !(a.horarios || []).some(h => h.hora === sig && h.dia === diaSemana(hoy)))
        extra = ` ¿Te quedás? A las ${sig} hay lugar para recuperar una clase: reservalo en la app.`;
      await mandar(id, { title: "Hoy tenés pádel 🎾", body: `${nombre}, te esperamos a las ${c.hora} en ${lugarTxt(c.club)}${c.tipo === "recupera" ? " (recuperación)" : ""}.${extra}`, tag: "recordatorio" });
    }
    if (!nRec || horaAR < 10 || horaAR >= 20) continue;
    // Se le vencen en 3 días o menos (una vez por fecha de vencimiento).
    const proxV = vences.find(k => k <= sumarDias(hoy, 3));
    if (proxV) { const id = `venc_${a.id}_${proxV}`;
      if (!(await yaEnviado(id))) await mandar(id, { title: "Se te vencen clases para recuperar ⏳", body: `${nombre}, tenés ${rec.recVence[proxV]} clase${rec.recVence[proxV] > 1 ? "s" : ""} para recuperar hasta el ${diaDM(proxV)}. Después se pierde${rec.recVence[proxV] > 1 ? "n" : ""}: reservá en la app.`, tag: "recuperar" }); }
    // Días que no entrena: si hoy hay lugar para recuperar, avisarle (máximo 3 por semana).
    if ((a.horarios || []).some(h => h.dia === diaSemana(hoy))) continue;
    const idHoy = `rec_${a.id}_${hoy}`; if (await yaEnviado(idHoy)) continue;
    const ops = opcionesDelDia(a, hoy, turnos, cupos, cupo, avisos, ahora.getTime() + 90 * 60e3);
    if (!ops.length) continue;
    const semana = []; for (let f = lunes; f < hoy; f = sumarDias(f, 1)) semana.push(db.doc(`recordatorios/rec_${a.id}_${f}`));
    const yaSemana = semana.length ? (await db.getAll(...semana)).filter(x => x.exists).length : 0;
    if (yaSemana >= 3) continue;
    const horas = [...new Set(ops.map(o => o.hora))].slice(0, 3); const clubs = [...new Set(ops.map(o => lugarTxt(o.club)))];
    const lista = horas.length > 1 ? horas.slice(0, -1).join(", ") + " y " + horas[horas.length - 1] : horas[0];
    await mandar(idHoy, { title: `Tenés ${nRec} clase${nRec > 1 ? "s" : ""} para recuperar 🎾`, body: `${nombre}, hoy hay lugar a las ${lista} en ${clubs.join(" y ")}. Recuperá antes del ${diaDM(vences[0])}: reservá en la app.`, tag: "recuperar" });
  }
  console.log(`Avisos a alumnos: ${enviados}`);
}

/* ---------- 4) Recordatorio al profe de Jump: lo que le falta cargar ---------- */
{
  const INICIO_PROFE = "2026-10-07";
  const profes = Object.entries(tokens).filter(([, t]) => t.rol === "profe" && t.tokens && t.tokens.length).map(([uid]) => uid);
  const horaAR = ar.getUTCHours(), minAR = ar.getUTCMinutes();
  // A la noche (desde las 21:30) revisa hoy; a la mañana (desde las 10) revisa ayer.
  const revisar = [];
  if (horaAR > 21 || (horaAR === 21 && minAR >= 30)) revisar.push({ f: hoy, id: "noche", cuando: "hoy" });
  if (horaAR >= 10 && horaAR < 20) revisar.push({ f: sumarDias(hoy, -1), id: "manana", cuando: "ayer" });
  if (profes.length && revisar.length) {
    let alumnos = null;
    for (const uid of profes) for (const r of revisar) {
      if (r.f < INICIO_PROFE) continue;
      const ref = db.doc(`recordatorios/profe_${uid}_${r.f}_${r.id}`); if ((await ref.get()).exists) continue;
      if (!alumnos) alumnos = (await db.collection("alumnos").get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.activo !== false);
      const dow = diaSemana(r.f); const turnos = {};
      alumnos.forEach(a => (a.horarios || []).forEach(h => { if (h.dia === dow && clubH(a, h) === "JUMP") (turnos[h.hora] = turnos[h.hora] || []).push(a.id); }));
      const horas = Object.keys(turnos).sort(); if (!horas.length) continue;
      const marcas = ((await db.doc(`asistencia/${r.f}_JUMP`).get()).data() || {}).marcas || {};
      const sinAsist = horas.filter(h => turnos[h].some(id => !marcas[`${id}|${h}`]));
      const sinHoras = !((((await db.doc("horas/" + uid).get()).data() || {}).dias || {})[r.f]);
      if (!sinAsist.length && !sinHoras) { await ref.set({ enviado: admin.firestore.FieldValue.serverTimestamp(), nada: true }); continue; }
      const falta = [sinAsist.length ? `la asistencia de ${sinAsist.length > 1 ? sinAsist.slice(0, -1).join(", ") + " y " + sinAsist[sinAsist.length - 1] : sinAsist[0]}` : "", sinHoras ? "las horas" : ""].filter(Boolean).join(" y ");
      const ok = await enviar(uid, { title: r.id === "noche" ? "Te falta cargar lo de hoy 📋" : "Te quedó sin cargar lo de ayer 📋", body: `Te falta cargar ${falta} de ${r.cuando}. Hacelo en la app así no se pierde.`, tag: "profe-" + r.f });
      await ref.set({ enviado: admin.firestore.FieldValue.serverTimestamp(), ok });
      console.log(`Recordatorio al profe (${r.cuando}): ${falta}`);
    }
  }
}
console.log("Listo");
