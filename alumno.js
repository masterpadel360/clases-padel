/* ---------- App del alumno ---------- */
const P = { perfil: null, uid: null, a: null, turnos: {}, info: {}, cupos: {}, avisos: [], asis: [], cargado: false, ocupado: false };
const DIA_MS = 86400000;
const inicioDe = (fecha, hora) => new Date(`${fecha}T${hora}:00-03:00`);
const cupoId = (club, fecha, hora) => `${club}_${fecha}_${hhmmDe(hora)}`;
const fechaLarga = f => { const d = isoDate(f); return `${DIAS_LARGO[d.getDay()]} ${d.getDate()}`; };
const fechaRel = f => { const ayer = new Date(now); ayer.setDate(ayer.getDate() - 1); if (f === toISO(ayer)) return "Ayer"; const man = new Date(now); man.setDate(man.getDate() + 1); return f === hoyISO ? "Hoy" : f === toISO(man) ? "Mañana" : fechaLarga(f); };

function iniciarPortal(perfil, u) {
  P.perfil = perfil; P.uid = u.uid;
  document.getElementById("login").hidden = true; document.getElementById("portal").hidden = false;
  const id = perfil.alumnoId; const pr = () => { if ($("#overlay").hidden) renderPortal(); };
  renderPortal();
  fdb.doc("alumnos/" + id).onSnapshot(d => { P.a = d.exists ? { id: d.id, ...d.data() } : null; P.cargado = true; pr(); }, e => { console.error(e); P.cargado = true; P.error = true; pr(); });
  refrescarNotif({ rol: "alumno", alumnoId: id });
  fdb.doc("publico/turnos").onSnapshot(d => { P.turnos = (d.exists && d.data().t) || {}; pr(); }, () => {});
  fdb.doc("publico/info").onSnapshot(d => { P.info = d.exists ? d.data() : {}; pr(); }, () => {});
  fdb.collection("cupos").where("fecha", ">=", hoyISO).onSnapshot(s => { P.cupos = {}; s.docs.forEach(d => P.cupos[d.id] = d.data()); pr(); }, () => {});
  fdb.collection("avisos").where("alumnoId", "==", id).onSnapshot(s => { P.avisos = s.docs.map(d => ({ id: d.id, ...d.data() })); pr(); }, () => {});
  { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    fdb.collection("asistencia").where("fecha", ">=", toISO(d)).onSnapshot(s => { P.asis = s.docs.map(d => d.data()); pr(); }, () => {}); }
}

/* ---- Cálculos ---- */
function rangoMes() {
  // Todo el mes actual; si quedan 7 días o menos, también el mes que viene.
  const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0); const resta = (fin - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / DIA_MS;
  return { desde: new Date(now.getFullYear(), now.getMonth(), 1), hasta: resta <= 7 ? new Date(now.getFullYear(), now.getMonth() + 2, 0) : fin };
}
function misClases(dias = 14, rango = null) {
  const a = P.a; if (!a) return [];
  const out = []; const corte = rango ? 0 : Date.now() - 60 * 60 * 1000;
  const ini = rango ? rango.desde : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const n = rango ? Math.round((rango.hasta - rango.desde) / DIA_MS) + 1 : dias;
  for (let i = 0; i < n; i++) {
    const d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + i); const f = toISO(d);
    (a.horarios || []).filter(h => h.dia === d.getDay()).forEach(h => out.push({ fecha: f, hora: h.hora, club: a.club, nivel: h.nivel || a.categoria || "", tipo: "fija" }));
  }
  P.avisos.filter(v => v.tipo === "recupera" && v.fecha >= toISO(ini) && !esVuelta(v.fecha, v.hora)).forEach(v => out.push({ fecha: v.fecha, hora: v.hora, club: v.club, nivel: v.nivel || "", tipo: "recupera" }));
  return out.filter(c => inicioDe(c.fecha, c.hora).getTime() > corte)
    .map(c => { const vuelve = esVuelta(c.fecha, c.hora); return { ...c, vuelve, aus: vuelve ? null : P.avisos.find(v => v.tipo === "ausencia" && v.fecha === c.fecha && v.hora === c.hora) }; })
    .sort((x, y) => (x.fecha + x.hora).localeCompare(y.fecha + y.hora));
}
// "Al final voy": un aviso de ausencia + una reserva en ese mismo turno. Queda fijo, no se puede volver a cambiar.
function esVuelta(fecha, hora) { return P.avisos.some(v => v.tipo === "ausencia" && v.fecha === fecha && v.hora === hora) && P.avisos.some(v => v.tipo === "recupera" && v.fecha === fecha && v.hora === hora); }
function libresDe(club, fecha, hora) {
  const d = isoDate(fecha); const t = P.turnos[`${club}|${d.getDay()}|${hora}`]; if (!t) return 0;
  const c = P.cupos[cupoId(club, fecha, hora)] || {}; const cupo = P.info.cupo || CUPO;
  return cupo - (t.n || 0) + (c.aus || 0) - (c.rec || 0);
}
function opcionesRec() {
  const a = P.a; if (!a) return [];
  const mios = new Set((a.horarios || []).map(h => `${h.dia}|${h.hora}`)); const cats = catsDe(a);
  const limite = Date.now() + 30 * 60 * 1000; const out = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i); const f = toISO(d);
    Object.entries(P.turnos).forEach(([k, t]) => {
      const [club, dia, hora] = k.split("|");
      if (club !== a.club || Number(dia) !== d.getDay() || mios.has(`${dia}|${hora}`)) return;
      if (cats.size && !(t.nivel && cats.has(catNorm(t.nivel)))) return;
      if (inicioDe(f, hora).getTime() < limite) return;
      if (P.avisos.some(v => v.tipo === "recupera" && v.fecha === f && v.hora === hora)) return;
      const libres = libresDe(club, f, hora); if (libres > 0) out.push({ club, fecha: f, hora, nivel: t.nivel, dia: d.getDay(), libres });
    });
  }
  return out.sort((x, y) => (x.fecha + x.hora).localeCompare(y.fecha + y.hora));
}
function misAsistencias() {
  const a = P.a; if (!a) return []; const out = [];
  P.asis.forEach(v => Object.keys(v.marcas || {}).forEach(k => { const [aid, hora] = k.split("|"); if (aid === a.id) out.push({ fecha: v.fecha, hora, club: v.club, estado: v.marcas[k] }); }));
  return out.sort((x, y) => (y.fecha + y.hora).localeCompare(x.fecha + x.hora));
}
function mesesPago() {
  const a = P.a; if (!a) return [];
  const actual = mesKey(now); const set = new Set([actual]);
  Object.keys(a.pagos || {}).forEach(m => { if (m < actual && !(a.pagos[m] || {}).pagado) set.add(m); });
  return [...set].sort().reverse();
}

/* ---- Vista ---- */
const EST_AL = { vino: ["Viniste", "var(--ok)"], falto: ["Faltaste sin avisar", "var(--warn)"], recupera: ["Avisaste · recuperás", "var(--sun)"], recuperando: ["Recuperaste", "var(--jump)"] };
function renderPortal() {
  const v = $("#pView"); if (!v) return;
  const a = P.a;
  $("#pHola").textContent = a ? `Hola, ${nombreCorto(a.nombre)}` : "";
  if (!P.cargado) { v.innerHTML = `<p class="small" style="color:var(--paper);margin:16px 0">Cargando tus clases…</p>`; return; }
  if (!a) { v.innerHTML = `<div class="notice">No encontramos tu ficha de alumno. Escribile a Gabriel.</div>`; return; }
  const rg = rangoMes(); const cl = misClases(0, rg); const prox = misClases(70).find(c => !c.aus && inicioDe(c.fecha, c.hora).getTime() > Date.now()); const rec = a.recuperar || 0;
  const marcas = {}; P.asis.forEach(x => Object.keys(x.marcas || {}).forEach(k => { const [aid, hora] = k.split("|"); if (aid === a.id) marcas[`${x.fecha}|${hora}`] = x.marcas[k]; }));
  const mesesCl = [...new Set(cl.map(c => c.fecha.slice(0, 7)))];
  const mes = mesKey(now); const pagoMes = (a.pagos || {})[mes] || {}; const montoAct = montoMes(a, mes);
  const ops = rec > 0 ? opcionesRec() : []; const asis = misAsistencias();
  const asisMes = asis.filter(x => x.fecha.startsWith(mes)); const vino = asisMes.filter(x => x.estado === "vino" || x.estado === "recuperando").length;
  const tel = P.info.telGabriel; const wa = tel ? waURL(tel, `Hola Gabi! Soy ${a.nombre}.`) : "";
  v.innerHTML = `
  <section class="hero" aria-label="Tu resumen"><span class="hero-glow" aria-hidden="true"></span>
    <span class="pill-date" style="justify-self:start">${prox ? "Tu próxima clase" : "Sin clases próximas"}</span>
    ${prox ? `<div class="hero-main"><div class="mega num" style="font-size:clamp(64px,22vw,104px)">${prox.hora}</div><div class="spec"><span class="spec-k">${prox.tipo === "recupera" ? "Recuperación" : "Clase"}</span><span style="font-weight:800">${fechaRel(prox.fecha)}</span><span class="small muted" style="text-transform:capitalize">${prox.club === "ESPACIO" ? "Espacio" : "Jump"}${prox.nivel ? " · " + esc(prox.nivel) : ""}</span></div></div>` : ""}
    <div class="hero-stats">
      <div class="stat"><div class="val num">${rec}</div><div class="lbl">Para recuperar</div></div>
      <div class="stat"><div class="val num" style="font-size:24px;color:${pagoMes.pagado ? "var(--ok)" : "var(--sun)"}">${pagoMes.pagado ? "Pagado" : montoAct ? money(montoAct).replace("$ ", "$") : "—"}</div><div class="lbl">${pagoMes.pagado ? mesSolo(mes) : "A pagar " + mesSolo(mes)}</div></div>
      <div class="stat"><div class="val num">${vino}</div><div class="lbl">Clases en ${mesSolo(mes)}</div></div>
    </div>
  </section>
  ${tarjetaNotif("alumno")}

  ${mesesCl.map((mk, mi) => { const cm = cl.filter(c => c.fecha.startsWith(mk)); return `
  <section class="sec"><div class="sec-head"><h3>Tus clases de ${mesSolo(mk)}</h3><span class="small muted">${cm.length} clase${cm.length === 1 ? "" : "s"}</span></div>
    ${cm.length ? `<div class="list">${cm.map(c => { const d = isoDate(c.fecha); const pasada = inicioDe(c.fecha, c.hora).getTime() < Date.now(); const est = marcas[`${c.fecha}|${c.hora}`]; const e = est && EST_AL[est];
      return `<div class="slot" style="grid-template-columns:70px 1fr auto;align-items:center;${pasada ? "opacity:.6" : ""}"><div class="side"><div class="h num" style="font-size:24px">${c.hora}</div></div>
        <div style="display:grid;gap:2px;min-width:0"><span class="name" style="font-weight:700">${fechaRel(c.fecha)}${c.fecha === hoyISO || fechaRel(c.fecha) === "Mañana" ? `<span class="muted" style="font-weight:500"> · ${DIAS_LARGO[d.getDay()]} ${d.getDate()}</span>` : ""}</span>
          <span class="meta small muted">${c.tipo === "recupera" ? '<span class="tag rec">Recuperación</span> ' : ""}${c.club === "ESPACIO" ? "Espacio" : "Jump"}${c.nivel ? " · " + esc(c.nivel) : ""}</span>
          ${c.aus ? `<span class="small" style="color:var(--sun);font-weight:700">No venís${c.aus.conRecupero ? " · te quedó para recuperar" : ""}</span>` : ""}${c.vuelve ? '<span class="small" style="color:var(--ok);font-weight:700">Confirmaste que venís · ya no se puede cambiar</span>' : ""}${pasada && e ? `<span class="small" style="color:${e[1]};font-weight:700">${e[0]}</span>` : ""}</div>
        ${c.aus || c.vuelve || pasada ? "" : `<button class="mini" data-pa="novoy" data-f="${c.fecha}" data-h="${c.hora}" data-t="${c.tipo}">No voy</button>`}</div>`; }).join("")}</div>`
      : `<div class="empty">No tenés clases este mes.</div>`}
    ${mi === mesesCl.length - 1 ? `<p class="small" style="margin:0;color:rgba(247,242,237,.85)">Si avisás con <b>24 horas o más</b> de anticipación, la clase te queda para recuperar.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="mini" data-pa="varias">Avisar varias fechas (viaje, trabajo…)</button><button class="mini" data-pa="calendario">Recordatorios en mi calendario</button></div>` : ""}
  </section>`; }).join("")}
  ${avisadasHTML(wa)}

  <section class="sec"><div class="sec-head"><h3>Recuperar</h3>${rec ? `<span class="small muted">${rec} clase${rec > 1 ? "s" : ""}</span>` : ""}</div>
    ${!rec ? `<div class="empty">No tenés clases para recuperar.</div>`
      : ops.length ? `<div class="list">${ops.slice(0, 12).map(o => `<div class="row"><span class="main"><span class="name">${fechaRel(o.fecha)} · ${o.hora}</span><span class="meta">${o.fecha === hoyISO || fechaRel(o.fecha) === "Mañana" ? `${DIAS_LARGO[o.dia]} ${isoDate(o.fecha).getDate()} · ` : ""}${esc(o.nivel || "")} · <span class="free">${o.libres} lugar${o.libres > 1 ? "es" : ""}</span></span></span><button class="mini go" data-pa="reservar" data-f="${o.fecha}" data-h="${o.hora}">Reservar</button></div>`).join("")}</div>`
      : `<div class="empty">Por ahora no hay lugares libres de tu categoría en las próximas dos semanas. ${wa ? `<a class="wa-link" href="${wa}" target="_blank" rel="noopener">Escribile a Gabriel</a>` : "Consultale a Gabriel."}</div>`}
  </section>

  <section class="sec"><div class="sec-head"><h3>Pagos</h3></div>
    <div class="list">${mesesPago().map(m => { const p = (a.pagos || {})[m] || {}; const n = clasesMes(a, m); const tot = montoMes(a, m); const aj = ajusteDe(a, m) !== null; const ex = extraDias(a, m).length;
      return `<div class="row"><span class="main"><span class="name" style="text-transform:capitalize">${mesLbl(m)}</span><span class="meta">${aj ? (p.nota ? esc(p.nota) : "Monto acordado") : `${n} clases x ${money(a.precioClase)}${ex ? " · incluye clase extra" : ""}`}</span></span>
        <span style="display:grid;justify-items:end;gap:2px"><b class="num">${money(tot)}</b><span class="tag" style="background:${p.pagado ? "var(--ok-soft)" : "var(--warn-soft)"};color:${p.pagado ? "var(--ok)" : "var(--warn)"}">${p.pagado ? "PAGADO" : "PENDIENTE"}</span></span></div>`; }).join("")}</div>
    ${P.info.alias && !pagoMes.pagado ? `<div class="msg" style="gap:8px"><span class="small">Podés transferir al alias <b>${esc(P.info.alias)}</b></span><button class="mini" data-pa="alias" style="justify-self:start">Copiar alias</button></div>` : ""}
  </section>

  <section class="sec"><div class="sec-head"><h3>Tu asistencia</h3><span class="small muted">${vino} en ${mesSolo(mes)}</span></div>
    ${asis.length ? `<div class="list">${asis.slice(0, 20).map(x => { const d = isoDate(x.fecha); const e = EST_AL[x.estado] || [x.estado, "var(--muted)"];
      return `<div class="row"><span class="name">${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} · ${x.hora}</span><span class="small" style="font-weight:800;color:${e[1]}">${e[0]}</span></div>`; }).join("")}</div>`
      : `<div class="empty">Todavía no hay asistencias cargadas.</div>`}
  </section>
  ${wa ? `<a class="cta wa" href="${wa}" target="_blank" rel="noopener" style="margin-top:22px;justify-self:start">Escribirle a Gabriel <i>→</i></a>` : ""}`;
}

/* ---- Acciones ---- */
function confirmar(titulo, texto, boton, accion) {
  openSheet(`<div style="display:grid;gap:6px"><h2 class="disp">${titulo}</h2><p class="small" style="margin:0">${texto}</p></div>
    <p class="small" id="pErr" style="margin:0;color:var(--warn)"></p>
    <div class="btns"><span></span><span style="display:flex;gap:8px"><button class="btn sec2" data-pa="cerrar">Cancelar</button><button class="btn pri" data-pa="ok">${boton}</button></span></div>`);
  P.accion = accion;
}
async function avisarNoVoy(fecha, hora, tipo) {
  const a = P.a; const ini = inicioDe(fecha, hora); const con = tipo === "fija" && ini.getTime() - Date.now() >= DIA_MS;
  const avId = `${a.id}_${fecha}_${hhmmDe(hora)}_ausencia`; const club = tipo === "recupera" ? ((P.avisos.find(v => v.tipo === "recupera" && v.fecha === fecha && v.hora === hora) || {}).club || a.club) : a.club;
  const cid = cupoId(club, fecha, hora); const d = isoDate(fecha);
  await fdb.runTransaction(async tx => {
    const aRef = fdb.doc("alumnos/" + a.id), cRef = fdb.doc("cupos/" + cid), vRef = fdb.doc("avisos/" + avId);
    if (P.avisos.some(v => v.id === avId)) throw { code: "ya" };
    const [aS, cS] = [await tx.get(aRef), await tx.get(cRef)];
    const c = cS.exists ? cS.data() : {};
    tx.set(vRef, { alumnoId: a.id, uid: P.uid, nombre: a.nombre, club, fecha, hora, hhmm: hhmmDe(hora), dia: d.getDay(), nivel: "", tipo: "ausencia", conRecupero: con, inicio: firebase.firestore.Timestamp.fromDate(ini), creado: firebase.firestore.FieldValue.serverTimestamp(), visto: false });
    tx.set(cRef, { club, fecha, hora, dia: d.getDay(), aus: (c.aus || 0) + 1, rec: c.rec || 0, ultimo: avId });
    if (con) tx.update(aRef, { recuperar: ((aS.data() || {}).recuperar || 0) + 1, ultimoAviso: avId });
  });
  return con;
}
async function reservarRec(fecha, hora) {
  const a = P.a; const d = isoDate(fecha); const t = P.turnos[`${a.club}|${d.getDay()}|${hora}`] || {};
  const avId = `${a.id}_${fecha}_${hhmmDe(hora)}_recupera`; const cid = cupoId(a.club, fecha, hora); const cupo = P.info.cupo || CUPO;
  await fdb.runTransaction(async tx => {
    const aRef = fdb.doc("alumnos/" + a.id), cRef = fdb.doc("cupos/" + cid), vRef = fdb.doc("avisos/" + avId), tRef = fdb.doc("publico/turnos");
    if (P.avisos.some(v => v.id === avId)) throw { code: "ya" };
    const [aS, cS, tS] = [await tx.get(aRef), await tx.get(cRef), await tx.get(tRef)];
    const rec = (aS.data() || {}).recuperar || 0; if (rec < 1) throw { code: "sin-clases" };
    const base = ((tS.data() || {}).t || {})[`${a.club}|${d.getDay()}|${hora}`]; const c = cS.exists ? cS.data() : {};
    if (!base || cupo - base.n + (c.aus || 0) - (c.rec || 0) < 1) throw { code: "lleno" };
    tx.set(vRef, { alumnoId: a.id, uid: P.uid, nombre: a.nombre, club: a.club, fecha, hora, hhmm: hhmmDe(hora), dia: d.getDay(), nivel: t.nivel || "", tipo: "recupera", conRecupero: false, inicio: firebase.firestore.Timestamp.fromDate(inicioDe(fecha, hora)), creado: firebase.firestore.FieldValue.serverTimestamp(), visto: false });
    tx.set(cRef, { club: a.club, fecha, hora, dia: d.getDay(), aus: c.aus || 0, rec: (c.rec || 0) + 1, ultimo: avId });
    tx.update(aRef, { recuperar: rec - 1, ultimoAviso: avId });
  });
}
const ERR_AL = { ocupado: "Tu lugar ya lo tomó otra persona. Hablá con Gabriel.", ya: "Ya estaba avisado.", lleno: "Justo se ocupó ese lugar. Elegí otro.", "sin-clases": "No tenés clases para recuperar.", "permission-denied": "No se pudo: quizás ya pasó el horario. Recargá la página.", unavailable: "Sin conexión. Probá de nuevo." };
document.addEventListener("click", async e => {
  if (window.MODO_STAFF) return;
  const b = e.target.closest("[data-pa]"); if (!b) return;
  const pa = b.dataset.pa;
  if (pa === "salir") { salir(); return; }
  if (pa === "cerrar") { closeSheet(); return; }
  if (pa === "alias") { try { await navigator.clipboard.writeText(P.info.alias); toast("Alias copiado"); } catch (x) { toast(P.info.alias); } return; }
  if (pa === "novoy") {
    const { f, h, t } = b.dataset; const horas = (inicioDe(f, h).getTime() - Date.now()) / 3600000; const con = t === "fija" && horas >= 24;
    const cuando = `${fechaRel(f).toLowerCase() === "hoy" ? "hoy" : "el " + fechaLarga(f).toLowerCase()} a las ${h}`;
    confirmar(`¿No venís ${cuando}?`,
      t === "recupera" ? '<b style="color:var(--warn)">Es una clase de recuperación: si no venís, la perdés.</b>'
        : con ? "Como avisás con más de 24 horas, <b>te queda una clase para recuperar</b>."
        : '<b style="color:var(--warn)">Faltan menos de 24 horas: si no venís, esta clase se pierde y no se recupera.</b> Podés avisar igual.',
      con ? "Avisar que no voy" : "Avisar igual", async () => {
        const r = await avisarNoVoy(f, h, t);
        return { titulo: "Listo, avisado", texto: r ? "Te quedó una clase para recuperar. Podés reservarla en <b>Recuperar</b>." : "Quedó registrado que no venís.",
          msg: `Hola Gabi, ¿cómo estás? Soy ${P.a.nombre}. No voy a ir ${cuando}${r ? ". Avisé por la app, me queda para recuperar." : ". Avisé por la app."}` };
      });
    return;
  }
  if (pa === "reservar") {
    const { f, h } = b.dataset; const cuando = `${fechaRel(f).toLowerCase() === "hoy" ? "hoy" : "el " + fechaLarga(f).toLowerCase()} a las ${h}`;
    confirmar(`¿Recuperás ${cuando}?`, "Se te descuenta una clase de las que tenés para recuperar y te guardamos el lugar.", "Reservar", async () => {
      await reservarRec(f, h);
      return { titulo: "¡Reservado!", texto: `Te esperamos ${cuando}.`, msg: `Hola Gabi, ¿cómo estás? Soy ${P.a.nombre}. Reservé por la app para recuperar ${cuando}.` };
    });
    return;
  }
  if (pa === "varias") { abrirVarias(); return; }
  if (pa === "notif") { b.disabled = true; b.textContent = "Activando…"; try { await activarNotificaciones({ rol: "alumno", alumnoId: P.a.id }); toast("¡Listo! Te vamos a avisar antes de cada clase."); } catch (x) { console.error(x); toast(x && x.code === "denegado" ? "No diste permiso. Podés activarlo desde los ajustes del celu." : "No se pudo activar. Probá de nuevo."); } renderPortal(); return; }
  if (pa === "calendario") { abrirCalendario(); return; }
  if (pa === "calOk") { descargarCalendario(); closeSheet(); return; }
  if (pa === "vuelvo") {
    const { f, h } = b.dataset; const cuando = `${fechaRel(f).toLowerCase() === "hoy" ? "hoy" : "el " + fechaLarga(f).toLowerCase()} a las ${h}`;
    confirmar(`¿Al final venís ${cuando}?`, '<b style="color:var(--warn)">Ojo: esto se puede hacer una sola vez.</b> Volvés a tu lugar, se te descuenta la clase para recuperar que te había quedado, y <b>ya no vas a poder avisar que no venís a esta clase</b>: si después faltás, la perdés.', "Sí, voy", async () => {
      try { await reservarRec(f, h); } catch (x) { if (x && x.code === "lleno") throw { code: "ocupado" }; throw x; }
      return { titulo: "¡Listo, te esperamos!", texto: `Volviste a tu clase ${cuando}.`, msg: `Hola Gabi, ¿cómo estás? Soy ${P.a.nombre}. Al final sí voy ${cuando}. Lo cambié en la app.` };
    });
    return;
  }
  if (pa === "variasOk") { await confirmarVarias(b); return; }
  if (pa === "ok") {
    if (P.ocupado || !P.accion) return; P.ocupado = true; b.disabled = true; b.textContent = "Un segundo…";
    try { const r = await P.accion(); const url = r && r.msg && P.info.telGabriel ? waURL(P.info.telGabriel, r.msg) : "";
      if (r && url) openSheet(`<div style="display:grid;gap:6px"><h2 class="disp">${r.titulo}</h2><p class="small" style="margin:0">${r.texto}</p></div>
        <div class="msg"><span class="small"><b>Último paso:</b> mandale el aviso a Gabriel por WhatsApp. Ya está escrito, solo tocás enviar.</span><div class="bubble">${esc(r.msg)}</div>
        <a class="cta wa" href="${url}" target="_blank" rel="noopener" data-pa="cerrar" style="justify-self:start">Mandar por WhatsApp <i>→</i></a></div>
        <div class="btns"><span></span><button class="btn sec2" data-pa="cerrar">Cerrar</button></div>`);
      else { closeSheet(); if (r) toast(r.titulo); } }
    catch (x) { console.error(x); const el = $("#pErr"); if (el) el.textContent = (ERR_AL[x && x.code] || "No se pudo. Probá de nuevo.") + (x && x.code ? ` (${x.code})` : ""); b.disabled = false; b.textContent = "Reintentar"; }
    finally { P.ocupado = false; renderPortal(); }
  }
});
new MutationObserver(() => { if (!window.MODO_STAFF && P.perfil && $("#overlay").hidden) renderPortal(); }).observe($("#overlay"), { attributes: true, attributeFilter: ["hidden"] });

/* ---- Clases avisadas y ausencias programadas ---- */
function avisadasHTML(wa) {
  const av = P.avisos.filter(v => v.tipo === "ausencia" && v.fecha >= hoyISO && !esVuelta(v.fecha, v.hora) && inicioDe(v.fecha, v.hora).getTime() > Date.now()).sort((x, y) => (x.fecha + x.hora).localeCompare(y.fecha + y.hora));
  if (!av.length) return "";
  return `<section class="sec"><div class="sec-head"><h3>Avisaste que no venís</h3><span class="small muted">${av.length}</span></div>
    <div class="list">${av.map(v => { const d = isoDate(v.fecha);
      const a24 = inicioDe(v.fecha, v.hora).getTime() - Date.now() >= DIA_MS; const lugar = libresDe(v.club, v.fecha, v.hora) > 0; const tiene = (P.a.recuperar || 0) >= 1;
      const puede = v.conRecupero && a24 && lugar && tiene;
      const nota = !v.conRecupero ? "" : !a24 ? "Faltan menos de 24 h: ya no se puede cambiar" : !lugar ? "Tu lugar ya lo tomó otra persona: hablá con Gabriel" : !tiene ? "Ya usaste esa clase para recuperar" : "";
      return `<div class="row"><span class="main"><span class="name">${DIAS_LARGO[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} · ${v.hora}</span><span class="meta">${v.conRecupero ? '<span style="color:var(--sun);font-weight:700">Te queda para recuperar</span>' : '<span class="due">Avisaste tarde: no se recupera</span>'}</span>${nota ? `<span class="small muted">${nota}</span>` : ""}</span>${puede ? `<button class="mini" data-pa="vuelvo" data-f="${v.fecha}" data-h="${v.hora}">Al final voy</button>` : ""}</div>`; }).join("")}</div>
    <p class="small" style="margin:0;color:rgba(247,242,237,.85)">Podés volver atrás <b>una sola vez</b>, hasta 24 horas antes y si tu lugar sigue libre. Después ya no se puede cambiar. ¿Otro caso? ${wa ? `<a class="wa-link" style="color:#8EE6A8" href="${waURL(P.info.telGabriel, `Hola Gabi! Soy ${P.a.nombre}. Avisé que no iba pero al final sí puedo ir. ¿Me lo corregís en la app?`)}" target="_blank" rel="noopener">Escribile a Gabriel</a> y lo corrige.` : "Avisale a Gabriel y lo corrige."}</p>
  </section>`;
}
function abrirVarias() {
  const cl = misClases(56).filter(c => c.tipo === "fija" && !c.aus && !c.vuelve && inicioDe(c.fecha, c.hora).getTime() > Date.now());
  const porSemana = {}; cl.forEach(c => { const d = isoDate(c.fecha); const lun = new Date(d); lun.setDate(d.getDate() - ((d.getDay() + 6) % 7)); (porSemana[toISO(lun)] = porSemana[toISO(lun)] || []).push(c); });
  openSheet(`<div style="display:grid;gap:4px"><h2 class="disp">¿Qué clases no venís?</h2><span class="small muted">Marcá todas las que vas a faltar (próximas 8 semanas). Las que avisás con 24 horas o más te quedan para recuperar.</span></div>
    <div style="display:grid;gap:12px;max-height:52vh;overflow:auto">${Object.keys(porSemana).sort().map(k => { const d = isoDate(k);
      return `<div style="display:grid;gap:6px"><span class="flabel">Semana del ${d.getDate()}/${d.getMonth() + 1}</span>${porSemana[k].map(c => { const dd = isoDate(c.fecha); const con = inicioDe(c.fecha, c.hora).getTime() - Date.now() >= DIA_MS;
        return `<label class="row" style="grid-template-columns:auto 1fr;background:rgba(255,255,255,.6);border:1px solid var(--line-2);border-radius:14px;padding:10px 12px;gap:10px"><input type="checkbox" class="chkVar" data-f="${c.fecha}" data-h="${c.hora}" style="width:20px;height:20px"><span class="main"><span class="name">${DIAS_LARGO[dd.getDay()]} ${dd.getDate()}/${dd.getMonth() + 1} · ${c.hora}</span><span class="meta">${con ? "Te queda para recuperar" : '<span class="due">Menos de 24 h: no se recupera</span>'}</span></span></label>`; }).join("")}</div>`; }).join("") || '<div class="empty">No tenés clases para marcar.</div>'}</div>
    <p class="small" id="pErr" style="margin:0;color:var(--warn)"></p>
    <div class="btns"><span></span><span style="display:flex;gap:8px"><button class="btn sec2" data-pa="cerrar">Cancelar</button><button class="btn pri" data-pa="variasOk">Avisar</button></span></div>`);
}
async function confirmarVarias(b) {
  const sel = [...document.querySelectorAll(".chkVar:checked")].map(x => ({ f: x.dataset.f, h: x.dataset.h }));
  if (!sel.length) { $("#pErr").textContent = "Marcá al menos una clase."; return; }
  if (P.ocupado) return; P.ocupado = true; b.disabled = true; b.textContent = "Avisando…";
  const ok = []; let rec = 0, fallo = 0;
  for (const c of sel) { try { if (await avisarNoVoy(c.f, c.h, "fija")) rec++; ok.push(c); } catch (x) { console.error(x); fallo++; } }
  P.ocupado = false;
  const lista = ok.map(c => `${fechaLarga(c.f).toLowerCase()} a las ${c.h}`).join(", ");
  const msg = `Hola Gabi, ¿cómo estás? Soy ${P.a.nombre}. Te aviso que no voy a poder ir: ${lista}. Lo cargué en la app.`;
  const url = P.info.telGabriel && ok.length ? waURL(P.info.telGabriel, msg) : "";
  openSheet(`<div style="display:grid;gap:6px"><h2 class="disp">Listo, avisado</h2><p class="small" style="margin:0">Avisaste ${ok.length} clase${ok.length === 1 ? "" : "s"}${rec ? `: sumaste ${rec} clase${rec === 1 ? "" : "s"} para recuperar` : ""}.${fallo ? ` <span class="due">${fallo} no se pudo${fallo > 1 ? "eron" : ""} avisar, probá de nuevo.</span>` : ""}</p></div>
    ${url ? `<div class="msg"><span class="small"><b>Último paso:</b> mandale el aviso a Gabriel por WhatsApp. Ya está escrito, solo tocás enviar.</span><div class="bubble">${esc(msg)}</div><a class="cta wa" href="${url}" target="_blank" rel="noopener" data-pa="cerrar" style="justify-self:start">Mandar por WhatsApp <i>→</i></a></div>` : ""}
    <div class="btns"><span></span><button class="btn sec2" data-pa="cerrar">Cerrar</button></div>`);
}

/* ---- Recordatorios: archivo de calendario con las clases fijas y aviso 3 horas antes ---- */
function descargarCalendario() {
  const a = P.a; if (!a) return;
  const p2 = n => String(n).padStart(2, "0");
  const lugar = a.club === "ESPACIO" ? "Espacio La 10" : "Jump";
  const DIAS_ICS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const ev = (a.horarios || []).map((h, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); while (d.getDay() !== h.dia) d.setDate(d.getDate() + 1);
    const [hh, mm] = h.hora.split(":").map(Number); const ini = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(hh)}${p2(mm)}00`;
    const fin = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(Math.min(hh + 1, 23))}${p2(hh + 1 > 23 ? 59 : mm)}00`;
    return ["BEGIN:VEVENT", `UID:clase-${a.id}-${i}-${h.dia}-${h.hora.replace(":", "")}@clasespadel`, `DTSTAMP:${stamp}`, `DTSTART;TZID=America/Argentina/Cordoba:${ini}`, `DTEND;TZID=America/Argentina/Cordoba:${fin}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${DIAS_ICS[h.dia]}`, `SUMMARY:Clase de pádel (${lugar})`, `LOCATION:${lugar}`, `DESCRIPTION:Si no podés venir avisá en la app: ${LINK_APP}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Hoy tenés pádel a las " + h.hora, "TRIGGER:-PT3H", "END:VALARM", "END:VEVENT"].join("\r\n");
  });
  const tz = ["BEGIN:VTIMEZONE", "TZID:America/Argentina/Cordoba", "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:-0300", "TZOFFSETTO:-0300", "TZNAME:-03", "END:STANDARD", "END:VTIMEZONE"].join("\r\n");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Clases de Padel//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", tz, ...ev, "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const el = document.createElement("a"); el.href = url; el.download = "clases-padel.ics"; document.body.appendChild(el); el.click(); setTimeout(() => { URL.revokeObjectURL(url); el.remove(); }, 4000);
}
function abrirCalendario() {
  openSheet(`<div style="display:grid;gap:6px"><h2 class="disp">Recordatorios</h2><p class="small" style="margin:0">Agregamos tus clases fijas al calendario del celu, y <b>3 horas antes de cada clase te suena un aviso</b>: "Hoy tenés pádel a las…".</p>
    <p class="small muted" style="margin:0">Al tocar el botón, el celu te pregunta si querés agregarlas: tocá <b>Agregar todo</b>. Si cambiás de horario, volvé a hacerlo.</p></div>
    <div class="btns"><span></span><span style="display:flex;gap:8px"><button class="btn sec2" data-pa="cerrar">Cancelar</button><button class="btn pri" data-pa="calOk">Agregar al calendario</button></span></div>`);
}
