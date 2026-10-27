// Mi Agenda (personal de Gabriel): avisos de la agenda, tareas con hora,
// resumen del día a la mañana y recordatorio para cargar los gastos.
// Lo llama notificar.mjs cada 10 minutos.

const VENTANA = 70 * 60e3; // si el proceso corre tarde, el aviso sale igual (hasta 70 min después)
const pad = n => String(n).padStart(2, "0");
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const inicio = (f, h) => new Date(`${f}T${h}:00-03:00`).getTime();
const dow = f => new Date(`${f}T12:00:00-03:00`).getUTCDay();
const sumar = (f, n) => { const d = new Date(`${f}T12:00:00-03:00`); d.setUTCDate(d.getUTCDate() + n); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const plata = n => "$ " + Math.round(n || 0).toLocaleString("es-AR");

export function ocurre(ev, f) {
  if (!ev.fecha || f < ev.fecha) return false;
  if (ev.hasta && f > ev.hasta) return false;
  if ((ev.saltear || []).includes(f)) return false;
  const r = ev.repetir || "";
  if (!r) return f === ev.fecha;
  if (r === "diario") return true;
  if (r === "lav") return dow(f) >= 1 && dow(f) <= 5;
  if (r === "semanal") return dow(f) === dow(ev.fecha);
  return false;
}

function cuandoTxt(f, hoy, hora) {
  const dia = f === hoy ? "Hoy" : f === sumar(hoy, 1) ? "Mañana" : `El ${DIAS[dow(f)]} ${Number(f.slice(8))}/${Number(f.slice(5, 7))}`;
  return `${dia} a las ${hora}`;
}

// Devuelve los avisos que corresponde mandar ahora: [{ key, title, body, tag }]
export function avisosAgenda(items, cfg, nowMs, hoy) {
  const out = [];
  const enVentana = t => t <= nowMs && t > nowMs - VENTANA;
  for (const it of items) {
    if (!(it.avisoMin >= 0) || !it.hora) continue;
    if (it.tipo === "gasto") continue;
    if (it.tipo !== "evento" && it.hecho) continue;
    const fechas = it.tipo === "evento" ? [sumar(hoy, -1), hoy, sumar(hoy, 1), sumar(hoy, 2)].filter(f => ocurre(it, f)) : it.fecha ? [it.fecha] : [];
    for (const f of fechas) {
      const empieza = inicio(f, it.hora);
      if (!enVentana(empieza - it.avisoMin * 60e3)) continue;
      if (nowMs > empieza + 30 * 60e3) continue; // ya pasó hace rato: no tiene sentido avisar
      const ya = nowMs >= empieza - 5 * 60e3;
      const title = it.tipo === "evento" ? `🗓️ ${it.texto}` : `✅ ${it.texto}`;
      const body = ya ? `Ahora, ${it.hora}${it.lugar ? " · " + it.lugar : ""}` : `${cuandoTxt(f, hoy, it.hora)}${it.lugar ? " · " + it.lugar : ""}`;
      out.push({ key: `${it.id}_${f}_${it.avisoMin}`, title, body, tag: `ag-${it.id}` });
    }
  }
  // Resumen del día
  if (cfg.resumen !== false && enVentana(inicio(hoy, cfg.resumenHora || "08:00"))) {
    const tareas = items.filter(x => x.tipo === "hoy" && !x.hecho && x.fecha && x.fecha <= hoy);
    const pend = items.filter(x => x.tipo === "pendiente" && !x.hecho && x.fecha && x.fecha <= hoy);
    const evs = items.filter(x => x.tipo === "evento" && ocurre(x, hoy)).sort((a, b) => (a.hora || "99").localeCompare(b.hora || "99"));
    const partes = [];
    if (evs.length) partes.push(evs.slice(0, 3).map(e => `${e.hora ? e.hora + " " : ""}${e.texto}`).join(" · ") + (evs.length > 3 ? ` y ${evs.length - 3} más` : ""));
    if (tareas.length) partes.push(`${tareas.length} ${tareas.length === 1 ? "cosa" : "cosas"} para hacer`);
    if (pend.length) partes.push(`${pend.length} ${pend.length === 1 ? "pendiente vence" : "pendientes vencen"} hoy`);
    out.push({ key: `resumen_${hoy}`, title: "☀️ Tu día", body: partes.length ? partes.join(". ") + "." : "No tenés nada cargado. Anotá lo que tenés que hacer hoy.", tag: "ag-resumen" });
  }
  // Recordatorio de gastos
  if (cfg.gastos !== false && enVentana(inicio(hoy, cfg.gastosHora || "21:00"))) {
    const g = items.filter(x => x.tipo === "gasto" && x.fecha === hoy);
    const total = g.reduce((s, x) => s + (x.monto || 0), 0);
    out.push({ key: `gastos_${hoy}`, title: "💸 ¿Cargaste lo que gastaste hoy?", body: g.length ? `Llevás ${plata(total)} hoy. Sumá lo que falte.` : "Hoy no cargaste ningún gasto. Anotalos ahora que te acordás.", tag: "ag-gastos" });
  }
  return out;
}

export async function correrAgenda({ db, admin, enviar, uids, ahora, hoy, link }) {
  let n = 0;
  for (const uid of uids) {
    const cfgS = await db.doc("agenda/" + uid).get();
    const items = (await db.collection(`agenda/${uid}/items`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
    if (!cfgS.exists && !items.length) continue;
    for (const a of avisosAgenda(items, cfgS.exists ? cfgS.data() : {}, ahora.getTime(), hoy)) {
      const ref = db.doc(`recordatorios/ag_${uid}_${a.key}`);
      const nuevo = await db.runTransaction(async tx => { const s = await tx.get(ref); if (s.exists) return false; tx.set(ref, { enviado: admin.firestore.FieldValue.serverTimestamp() }); return true; });
      if (!nuevo) continue;
      await enviar(uid, { title: a.title, body: a.body, tag: a.tag, link }); n++;
    }
  }
  if (n) console.log(`Mi Agenda: ${n} avisos`);
}
