/* ---------- App del alumno ---------- */
const P = { tab: "inicio", perfil: null, uid: null, a: null, turnos: {}, info: {}, cupos: {}, avisos: [], asis: [], comps: {}, cargado: false, ocupado: false };
const DIA_MS = 86400000;
const inicioDe = (fecha, hora) => new Date(`${fecha}T${hora}:00-03:00`);
const cupoId = (club, fecha, hora) => `${club}_${fecha}_${hhmmDe(hora)}`;
const fechaLarga = f => { const d = isoDate(f); return `${DIAS_LARGO[d.getDay()]} ${d.getDate()}`; };
const fechaRel = f => { const ayer = new Date(now); ayer.setDate(ayer.getDate() - 1); if (f === toISO(ayer)) return "Ayer"; const man = new Date(now); man.setDate(man.getDate() + 1); return f === hoyISO ? "Hoy" : f === toISO(man) ? "Mañana" : fechaLarga(f); };

// Cada vez que el alumno abre la app y no tiene las notificaciones activas, le pedimos que las active.
function pedirNotifAlEntrar() {
  const st = estadoNotif(); if (!["pedir", "instalar", "bloqueadas"].includes(st)) return;
  try { if (sessionStorage.getItem("notifPedida") === "1") return; sessionStorage.setItem("notifPedida", "1"); } catch (e) {}
  if (!$("#overlay").hidden) return;
  const cab = `<div id="notifSheet" style="display:grid;gap:8px;text-align:center;justify-items:center"><div style="font-size:44px;line-height:1">🔔</div><h2 class="disp" style="margin:0">Activá las notificaciones</h2>
    <p class="small" style="margin:0">Así te avisamos <b>el día de tu clase</b> para que no te olvides, y te enterás si hay cambios.</p></div>`;
  let cuerpo;
  if (st === "instalar") cuerpo = `<p class="small" style="margin:0"><b>En iPhone hay que instalar la app primero</b> (es gratis y tarda 10 segundos):</p>
    <ol class="small" style="margin:0;padding-left:18px;line-height:1.7;text-align:left"><li>Tocá <b>Compartir</b> <span aria-hidden="true">⎙</span> abajo en Safari</li><li>Elegí <b>Agregar a inicio</b></li><li>Abrí la app desde el ícono nuevo y tocá <b>Activar</b></li></ol>
    <button class="btn pri" data-pa="cerrar" style="width:100%">Entendido</button>`;
  else if (st === "bloqueadas") cuerpo = `<p class="small" style="margin:0">Están bloqueadas en tu celu. Entrá a <b>Ajustes</b> del celu → esta app → <b>Notificaciones</b> y activalas.</p>
    <button class="btn pri" data-pa="cerrar" style="width:100%">Entendido</button>`;
  else cuerpo = `<button class="btn pri" data-pa="notif" style="width:100%;font-size:16px;padding:14px">Activar notificaciones</button>
    <p class="small muted" style="margin:0;text-align:center">Cuando el celu pregunte, tocá <b>Permitir</b>.</p>
    <button class="linkish" data-pa="cerrar" style="justify-self:center;font-size:12px;opacity:.7">Ahora no</button>`;
  openSheet(`${cab}<div style="display:grid;gap:12px">${cuerpo}</div>`);
}

// Le pide al servidor que le avise a Gabriel ya mismo (si no responde, sale igual en el próximo envío automático).
function avisarAlInstante() { if (!window.AVISOS_URL) return; try { fetch(window.AVISOS_URL, { method: "POST", keepalive: true }).catch(() => {}); } catch (e) {} }

function iniciarPortal(perfil, u) {
  P.perfil = perfil; P.uid = u.uid;
  document.getElementById("login").hidden = true; document.getElementById("portal").hidden = false;
  const id = perfil.alumnoId;
  // Abre al instante con lo último que se vio en este celu; después se actualiza solo con lo nuevo.
  const CK = "portal_" + id; let tGuardar = 0;
  try { const c = JSON.parse(localStorage.getItem(CK) || "null"); if (c && c.a) { Object.assign(P, { a: c.a, info: c.info || {}, turnos: c.turnos || {}, avisos: c.avisos || [], comps: c.comps || {}, asis: c.asis || [], cargado: true }); } } catch (e) {}
  const guardar = () => { clearTimeout(tGuardar); tGuardar = setTimeout(() => { try { localStorage.setItem(CK, JSON.stringify({ a: P.a, info: P.info, turnos: P.turnos, avisos: P.avisos, comps: P.comps, asis: P.asis })); } catch (e) {} }, 800); };
  const pr = () => { guardar(); if ($("#overlay").hidden) renderPortal(); };
  renderPortal();
  // Si la primera vez tarda mucho (mala señal), ofrecemos reintentar en vez de quedar trabado.
  setTimeout(() => { if (!P.cargado) { const v = $("#pView"); if (v) v.innerHTML = `<div class="notice" style="display:grid;gap:10px">Está tardando en cargar. Revisá la conexión.<button class="btn pri" onclick="location.reload()" style="justify-self:start">Reintentar</button></div>`; } }, 8000);
  fdb.doc("alumnos/" + id).onSnapshot(d => { P.a = d.exists ? { id: d.id, ...d.data() } : null; P.cargado = true; pr(); }, e => { console.error(e); P.cargado = true; P.error = true; pr(); });
  refrescarNotif({ rol: "alumno", alumnoId: id });
  setTimeout(pedirNotifAlEntrar, 700);
  fdb.doc("publico/turnos").onSnapshot(d => { P.turnos = (d.exists && d.data().t) || {}; pr(); }, () => {});
  fdb.doc("publico/info").onSnapshot(d => { P.info = d.exists ? d.data() : {}; pr(); }, () => {});
  fdb.collection("cupos").where("fecha", ">=", hoyISO).onSnapshot(s => { P.cupos = {}; s.docs.forEach(d => P.cupos[d.id] = d.data()); pr(); }, () => {});
  fdb.collection("comprobantes").where("alumnoId", "==", id).onSnapshot(s => { P.comps = {}; s.docs.forEach(d => { const c = d.data(); P.comps[c.mes] = c; }); pr(); }, () => {});
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
    (a.horarios || []).filter(h => h.dia === d.getDay()).forEach(h => out.push({ fecha: f, hora: h.hora, club: clubH(a, h), nivel: h.nivel || a.categoria || "", tipo: "fija" }));
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
// Clases para recuperar del alumno, con hasta cuándo valen (incluye las que acaba de avisar).
function recAl() { return P.a ? recBuckets(P.a) : []; }
function opcionesRec() {
  const a = P.a; if (!a) return [];
  const bk = recAl(); if (!bk.length) return []; const hasta = bk[bk.length - 1].vence;
  const mios = new Set((a.horarios || []).map(h => `${clubH(a, h)}|${h.dia}|${h.hora}`)); const cats = catsDe(a); const cl = clubsDe(a);
  const limite = Date.now() + 30 * 60 * 1000; const out = [];
  for (let i = 0; i < 40; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i); const f = toISO(d); if (f > hasta) break;
    Object.entries(P.turnos).forEach(([k, t]) => {
      const [club, dia, hora] = k.split("|");
      if (!cl.has(club) || Number(dia) !== d.getDay() || mios.has(`${club}|${dia}|${hora}`)) return;
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

// Se paga del 1 al 13 de cada mes. Desde el 14 queda vencido.
const DIA_PAGO = 13;
const pagoVence = m => `${DIA_PAGO}/${Number(m.slice(5, 7))}`;
function mesVencido(m) { const act = mesKey(now); return m < act || (m === act && now.getDate() > DIA_PAGO); }
// Estado del pago de un mes: "pagado" (Gabriel lo marcó o el alumno mandó el comprobante), "rechazado", "vencido" o "pendiente".
function estPago(a, m) {
  const p = (a.pagos || {})[m] || {}; const c = P.comps[m];
  if (p.pagado) return "pagado";
  if (c && c.estado === "enviado" && !c.aplicado) return "pagado";
  if (c && c.estado === "rechazado") return mesVencido(m) ? "vencido" : "rechazado";
  return mesVencido(m) ? "vencido" : "pendiente";
}

/* ---- Vista: tres pestañas (Inicio · Ausencias · Pagos) ---- */
const EST_AL = { vino: ["Viniste", "var(--ok)"], falto: ["Faltaste sin avisar", "var(--warn)"], recupera: ["Avisaste · recuperás", "var(--sun)"], recuperando: ["Recuperaste", "var(--jump)"], lluvia: ["Se suspendió por lluvia · te queda para recuperar", "var(--jump)"] };
const P_TABS = [
  ["inicio", "Inicio", '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M5 9c4 2 10 2 14 0M5 15c4-2 10-2 14 0"/></svg>'],
  ["ausencias", "Ausencias", '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M10 13l4 4M14 13l-4 4"/></svg>'],
  ["pagos", "Pagos", '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12.5h2M3 9.5h18"/></svg>']];
function renderPTabs() {
  const nav = $("#pTabs"); if (!nav) return; nav.hidden = !P.a;
  nav.innerHTML = P_TABS.map(([k, l, i]) => `<button class="tab" role="tab" data-pa="ptab" data-t="${k}" aria-selected="${P.tab === k}">${i}${l}</button>`).join("");
}
function renderPortal() {
  const v = $("#pView"); if (!v) return;
  const a = P.a;
  $("#pHola").textContent = a ? `Hola, ${nombreCorto(a.nombre)}` : "";
  renderPTabs();
  if (!P.cargado) { v.innerHTML = `<p class="small" style="color:var(--paper);margin:16px 0">Cargando tus clases…</p>`; return; }
  if (!a) { v.innerHTML = `<div class="notice">No encontramos tu ficha de alumno. Escribile a Gabriel.</div>`; return; }
  const tel = P.info.telGabriel; const wa = tel ? waURL(tel, `Hola Gabi! Soy ${a.nombre}.`) : "";
  v.innerHTML = P.tab === "ausencias" ? vAusencias(a, wa) : P.tab === "pagos" ? vPagos(a, wa) : vInicio(a, wa);
}
const clubTxt = c => c === "ESPACIO" ? "Espacio" : "Jump";

function claseHTML(c, marcas) { const d = isoDate(c.fecha); const pasada = inicioDe(c.fecha, c.hora).getTime() < Date.now(); const est = marcas[`${c.fecha}|${c.hora}`]; const e = est && EST_AL[est];
  return `<div class="slot" style="grid-template-columns:70px 1fr auto;align-items:center;${pasada ? "opacity:.6" : ""}"><div class="side"><div class="h num" style="font-size:24px">${c.hora}</div></div>
        <div style="display:grid;gap:2px;min-width:0"><span class="name" style="font-weight:700">${fechaRel(c.fecha)}${c.fecha === hoyISO || fechaRel(c.fecha) === "Mañana" ? `<span class="muted" style="font-weight:500"> · ${DIAS_LARGO[d.getDay()]} ${d.getDate()}</span>` : ""}</span>
          <span class="meta small muted">${c.tipo === "recupera" ? '<span class="tag rec">Recuperación</span> ' : ""}${clubTxt(c.club)}${c.nivel ? " · " + esc(c.nivel) : ""}</span>
          ${c.aus ? `<span class="small" style="color:var(--sun);font-weight:700">No venís${c.aus.conRecupero ? " · te quedó para recuperar" : ""}</span>` : ""}${c.vuelve ? '<span class="small" style="color:var(--ok);font-weight:700">Confirmaste que venís · ya no se puede cambiar</span>' : ""}${pasada && e ? `<span class="small" style="color:${e[1]};font-weight:700">${e[0]}</span>` : ""}</div>
        ${c.aus || c.vuelve || pasada ? "" : `<button class="mini" data-pa="novoy" data-f="${c.fecha}" data-h="${c.hora}" data-t="${c.tipo}">No voy</button>`}</div>`; }
function marcasAl(a) { const m = {}; P.asis.forEach(x => Object.keys(x.marcas || {}).forEach(k => { const [aid, hora] = k.split("|"); if (aid === a.id) m[`${x.fecha}|${hora}`] = x.marcas[k]; })); return m; }

function vInicio(a, wa) {
  const rg = rangoMes(); const cl = misClases(0, rg); const prox = misClases(70).find(c => !c.aus && inicioDe(c.fecha, c.hora).getTime() > Date.now());
  const bk = recAl(); const rec = bk.reduce((s, x) => s + x.n, 0);
  const marcas = {}; P.asis.forEach(x => Object.keys(x.marcas || {}).forEach(k => { const [aid, hora] = k.split("|"); if (aid === a.id) marcas[`${x.fecha}|${hora}`] = x.marcas[k]; }));
  const mesesCl = [...new Set(cl.map(c => c.fecha.slice(0, 7)))];
  const mes = mesKey(now); const estMes = estPago(a, mes); const pagoMes = { pagado: estMes === "pagado" }; const montoAct = montoMes(a, mes);
  const ops = rec > 0 ? opcionesRec() : [];
  const vino = misAsistencias().filter(x => x.fecha.startsWith(mes) && (x.estado === "vino" || x.estado === "recuperando")).length;
  return `
  <section class="hero" aria-label="Tu resumen"><span class="hero-glow" aria-hidden="true"></span>
    <span class="pill-date" style="justify-self:start">${prox ? "Tu próxima clase" : "Sin clases próximas"}</span>
    ${prox ? `<div class="hero-main"><div class="mega num" style="font-size:clamp(64px,22vw,104px)">${prox.hora}</div><div class="spec"><span class="spec-k">${prox.tipo === "recupera" ? "Recuperación" : "Clase"}</span><span style="font-weight:800">${fechaRel(prox.fecha)}</span><span class="small muted" style="text-transform:capitalize">${clubTxt(prox.club)}${prox.nivel ? " · " + esc(prox.nivel) : ""}</span></div></div>` : ""}
    <div class="hero-stats">
      <button class="stat" data-pa="irRec" style="background:none;border:0;padding:0;text-align:left;color:inherit"><div class="val num" style="${rec ? "color:var(--sun)" : ""}">${rec}</div><div class="lbl">Para recuperar${rec ? " ›" : ""}</div></button>
      <div class="stat"><div class="val num" style="font-size:24px;color:${pagoMes.pagado ? "var(--ok)" : estMes === "vencido" ? "var(--warn)" : "var(--sun)"}">${pagoMes.pagado ? "Pagado" : montoAct ? money(montoAct).replace("$ ", "$") : "—"}</div><div class="lbl">${pagoMes.pagado ? mesSolo(mes) : estMes === "vencido" ? "Vencido · " + mesSolo(mes) : "Pagá hasta el " + pagoVence(mes)}</div></div>
      <div class="stat"><div class="val num">${vino}</div><div class="lbl">Clases en ${mesSolo(mes)}</div></div>
    </div>
  </section>
  ${tarjetaNotif("alumno")}

  <section class="sec" id="secRec"><div class="sec-head"><h3>Recuperar</h3>${rec ? `<span class="small muted">${rec} clase${rec > 1 ? "s" : ""}</span>` : ""}</div>
    ${rec ? `<div class="list rec-box">
      <div class="rec-top"><div class="big-num num">${rec}</div><div style="display:grid;gap:2px"><b>${rec === 1 ? "clase para recuperar" : "clases para recuperar"}</b>
        ${bk.map(x => `<span class="small">${bk.length > 1 ? `${x.n} ` : ""}${bk.length > 1 ? "hasta el" : "Tenés tiempo hasta el"} <b style="color:var(--warn)">${DIAS_LARGO[isoDate(x.vence).getDay()].toLowerCase()} ${fechaDM(x.vence)}</b></span>`).join("")}</div></div>
      <p class="small" style="margin:0;line-height:1.5"><b>Tenés 2 semanas para recuperar.</b> Cada clase que faltás la podés recuperar en las 2 semanas siguientes (hasta el viernes). Si no la recuperás a tiempo, <b>se pierde</b>.</p>
    </div>
    ${ops.length ? `<div class="list">${ops.slice(0, 12).map(o => `<div class="row"><span class="main"><span class="name">${fechaRel(o.fecha)} · ${o.hora}</span><span class="meta">${o.fecha === hoyISO || fechaRel(o.fecha) === "Mañana" ? `${DIAS_LARGO[o.dia]} ${isoDate(o.fecha).getDate()} · ` : ""}${clubsDe(a).size > 1 ? clubTxt(o.club) + " · " : ""}${esc(o.nivel || "")} · <span class="free">${o.libres} lugar${o.libres > 1 ? "es" : ""}</span></span></span><button class="mini go" data-pa="reservar" data-f="${o.fecha}" data-h="${o.hora}" data-c="${o.club}">Reservar</button></div>`).join("")}</div>`
      : `<div class="empty">Por ahora no hay lugares libres de tu categoría antes de que venzan. Te avisamos cuando se libere uno. ${wa ? `<a class="wa-link" href="${wa}" target="_blank" rel="noopener">Escribile a Gabriel</a>` : ""}</div>`}`
    : `<div class="empty">No tenés clases para recuperar.</div>`}
  </section>

  ${mesesCl.map((mk, mi) => { const cm = cl.filter(c => c.fecha.startsWith(mk)); return `
  <section class="sec"><div class="sec-head"><h3>Tus clases de ${mesSolo(mk)}</h3><span class="small muted">${cm.length} clase${cm.length === 1 ? "" : "s"}</span></div>
    ${cm.length ? `<div class="list">${cm.map(c => claseHTML(c, marcas)).join("")}</div>`
      : `<div class="empty">No tenés clases este mes.</div>`}
    ${mi === mesesCl.length - 1 ? `<p class="small" style="margin:0;color:rgba(247,242,237,.85)">Si avisás con <b>24 horas o más</b> de anticipación, la clase te queda para recuperar.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="mini" data-pa="ptab" data-t="ausencias">¿No podés venir? Avisá con tiempo</button><button class="mini" data-pa="calendario">Recordatorios en mi calendario</button></div>` : ""}
  </section>`; }).join("")}
  ${wa ? `<a class="cta wa" href="${wa}" target="_blank" rel="noopener" style="margin-top:22px;justify-self:start">Escribirle a Gabriel <i>→</i></a>` : ""}`;
}

function vAusencias(a, wa) {
  const asis = misAsistencias(); const mes = mesKey(now);
  const vino = asis.filter(x => x.fecha.startsWith(mes) && (x.estado === "vino" || x.estado === "recuperando")).length;
  const prox = misClases(21).filter(c => inicioDe(c.fecha, c.hora).getTime() > Date.now()); const marcas = marcasAl(a);
  return `
  <section class="sec" style="margin-top:4px"><div class="sec-head"><h3>¿No podés venir a una clase?</h3></div>
    ${prox.length ? `<div class="list">${prox.map(c => claseHTML(c, marcas)).join("")}</div>` : `<div class="empty">No tenés clases en las próximas 3 semanas.</div>`}
    <p class="small" style="margin:0;color:rgba(247,242,237,.85)">Tocá <b>No voy</b> en la clase. Si avisás con <b>24 horas o más</b>, te queda para recuperar en las 2 semanas siguientes.</p>
  </section>
  <section class="sec"><div class="sec-head"><h3>Ausencias programadas</h3></div>
    <div class="list" style="padding:16px;display:grid;gap:12px">
      <div style="display:flex;gap:12px;align-items:center"><span style="font-size:34px;line-height:1" aria-hidden="true">🗓️</span><div style="display:grid;gap:2px"><b>¿Sabés que no vas a poder venir por algo?</b><span class="small muted">Un turno médico, trabajo, un acto, un viaje… Avisá con tiempo: elegí desde y hasta qué día y avisamos todas tus clases de esas fechas.</span></div></div>
      <button class="btn pri" data-pa="viaje" style="width:100%">Programar ausencia</button>
      <button class="linkish" data-pa="varias" style="justify-self:center">O elegí clase por clase</button>
    </div>
  </section>
  ${avisadasHTML(wa) || `<section class="sec"><div class="sec-head"><h3>Avisaste que no venís</h3></div><div class="empty">No tenés ausencias avisadas.</div></section>`}
  <section class="sec"><div class="sec-head"><h3>Tu asistencia</h3><span class="small muted">${vino} en ${mesSolo(mes)}</span></div>
    ${asis.length ? `<div class="list">${asis.slice(0, 20).map(x => { const d = isoDate(x.fecha); const e = EST_AL[x.estado] || [x.estado, "var(--muted)"];
      return `<div class="row"><span class="name">${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} · ${x.hora}</span><span class="small" style="font-weight:800;color:${e[1]}">${e[0]}</span></div>`; }).join("")}</div>`
      : `<div class="empty">Todavía no hay asistencias cargadas.</div>`}
  </section>`;
}

function vPagos(a, wa) {
  const mes = mesKey(now);
  return `
  <section class="sec" style="margin-top:4px"><div class="sec-head"><h3>Pagos</h3></div>
    <div class="list">${mesesPago().map(m => { const n = clasesMes(a, m); const tot = montoMes(a, m); const aj = ajusteDe(a, m) !== null; const ex = extraDias(a, m).length;
      const p = (a.pagos || {})[m] || {}; const est = estPago(a, m); const ok = est === "pagado"; const c = P.comps[m];
      return `<div class="row" style="flex-wrap:wrap"><span class="main"><span class="name" style="text-transform:capitalize">${mesLbl(m)}</span><span class="meta">${aj ? (p.nota ? esc(p.nota) : "Monto acordado") : `${n} clases x ${money(a.precioClase)}${ex ? " · incluye clase extra" : ""}`}${ok && c && c.estado === "enviado" ? " · comprobante enviado" : ""}</span></span>
        <span style="display:grid;justify-items:end;gap:6px"><b class="num">${money(tot)}</b>${ok ? `<span class="tag" style="background:var(--ok-soft);color:var(--ok)">PAGADO ✓</span>` : `<button class="btn pri" data-pa="pagar" data-m="${m}" style="padding:8px 18px">Pagar</button>`}</span>
        ${c && c.estado === "rechazado" && !ok ? `<span class="small" style="flex-basis:100%;color:var(--warn);font-weight:700">Gabriel no pudo confirmar el comprobante. Volvé a mandarlo.</span>` : ""}
        ${est === "vencido" ? `<span class="small" style="flex-basis:100%;color:var(--warn);font-weight:700"><span class="tag" style="background:var(--warn-soft);color:var(--warn)">VENCIDO</span> Venció el ${pagoVence(m)}. Pagalo cuanto antes.</span>` : !ok ? `<span class="small muted" style="flex-basis:100%">Tenés hasta el <b>${pagoVence(m)}</b> para pagar.</span>` : ""}</div>`; }).join("")}</div>
  </section>
  ${wa ? `<a class="small" href="${waURL(P.info.telGabriel, `Hola Gabi! Soy ${a.nombre}. Tengo una consulta sobre el pago de ${mesSolo(mes)}.`)}" target="_blank" rel="noopener" style="margin-top:18px;display:inline-block;color:inherit;opacity:.8">¿Dudas con el pago? Escribile a Gabriel →</a>` : ""}`;
}

// Achica la foto del comprobante para guardarla (máx. 1280 px, JPEG, menos de ~700 KB).
async function achicarFoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
    let lado = 1280, q = 0.72, out = "";
    for (let k = 0; k < 6; k++) {
      const r = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement("canvas"); cv.width = Math.round(img.naturalWidth * r); cv.height = Math.round(img.naturalHeight * r);
      const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
      out = cv.toDataURL("image/jpeg", q); if (out.length < 700000) return out;
      lado = Math.round(lado * 0.8); q = Math.max(0.5, q - 0.06);
    }
    return out.length < 700000 ? out : null;
  } finally { URL.revokeObjectURL(url); }
}

function abrirPagar(m) {
  const a = P.a; const tot = montoMes(a, m); P.compFoto = null;
  openSheet(`<div style="display:grid;gap:4px"><h2 class="disp" style="text-transform:capitalize">Pagar ${mesLbl(m)}</h2><div class="mega num" style="font-size:40px">${money(tot)}</div></div>
    <div style="display:grid;gap:14px">
      ${P.info.alias ? `<div class="msg" style="gap:8px"><span class="small"><b>1.</b> Transferí al alias <b>${esc(P.info.alias)}</b></span><button class="mini" data-pa="alias" style="justify-self:start">Copiar alias</button></div>` : ""}
      <div class="msg" style="gap:8px"><span class="small"><b>${P.info.alias ? "2." : "1."}</b> Subí la foto o captura del comprobante</span>
        <label class="mini" style="justify-self:start;cursor:pointer">Elegir foto<input type="file" id="compFile" accept="image/*" hidden></label>
        <img id="compPrev" alt="Comprobante" hidden style="max-width:100%;max-height:220px;border-radius:10px;justify-self:start">
        <span id="compEst" class="small muted"></span></div>
      <button class="btn pri" data-pa="pagarOk" data-m="${m}" id="compOk" disabled style="width:100%;font-size:16px;padding:14px">Pagar</button>
      <button class="linkish" data-pa="cerrar" style="justify-self:center;font-size:12px;opacity:.7">Cancelar</button>
    </div>`);
}
document.addEventListener("change", async e => {
  if (window.MODO_STAFF || e.target.id !== "compFile") return;
  const f = e.target.files && e.target.files[0]; if (!f) return;
  const est = $("#compEst"), ok = $("#compOk"), pv = $("#compPrev");
  est.textContent = "Preparando la foto…"; ok.disabled = true;
  let foto = null; try { foto = await achicarFoto(f); } catch (x) { console.error(x); }
  if (!foto) { est.textContent = "No se pudo leer esa imagen. Probá con una captura de pantalla."; return; }
  P.compFoto = foto; pv.src = foto; pv.hidden = false; est.textContent = ""; ok.disabled = false;
});
async function mandarComprobante(m, b) {
  const a = P.a; if (!P.compFoto) { toast("Primero elegí la foto del comprobante"); return; }
  b.disabled = true; b.textContent = "Enviando…";
  const id = `${a.id}_${m}`;
  try {
    const bt = fdb.batch();
    bt.set(fdb.doc("fotosPago/" + id), { alumnoId: a.id, mes: m, foto: P.compFoto });
    bt.set(fdb.doc("comprobantes/" + id), { alumnoId: a.id, uid: P.uid, nombre: a.nombre, mes: m, monto: montoMes(a, m), estado: "enviado", aplicado: false, notificado: false, creado: firebase.firestore.FieldValue.serverTimestamp() });
    await bt.commit();
    P.compFoto = null; avisarAlInstante();
    openSheet(`<div style="display:grid;gap:8px;text-align:center;justify-items:center"><div style="font-size:44px;line-height:1">✅</div><h2 class="disp" style="margin:0">¡Pagado!</h2>
      <p class="small" style="margin:0">Le llegó tu comprobante de <b>${mesSolo(m)}</b> a Gabriel. Ya figura como <b style="color:var(--ok)">pagado</b>.</p>
      <button class="btn pri" data-pa="cerrar" style="width:100%">Listo</button></div>`);
  } catch (x) { console.error(x); b.disabled = false; b.textContent = "Pagar"; toast(x && x.code === "permission-denied" ? "Ese mes ya tiene un comprobante enviado." : "No se pudo enviar. Probá de nuevo."); }
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
  const d = isoDate(fecha); const hFija = (a.horarios || []).find(x => x.dia === d.getDay() && x.hora === hora);
  const avId = `${a.id}_${fecha}_${hhmmDe(hora)}_ausencia`; const club = tipo === "recupera" ? ((P.avisos.find(v => v.tipo === "recupera" && v.fecha === fecha && v.hora === hora) || {}).club || clubH(a, hFija)) : clubH(a, hFija);
  const cid = cupoId(club, fecha, hora);
  await fdb.runTransaction(async tx => {
    const aRef = fdb.doc("alumnos/" + a.id), cRef = fdb.doc("cupos/" + cid), vRef = fdb.doc("avisos/" + avId);
    if (P.avisos.some(v => v.id === avId)) throw { code: "ya" };
    const [aS, cS] = [await tx.get(aRef), await tx.get(cRef)];
    const c = cS.exists ? cS.data() : {};
    tx.set(vRef, { alumnoId: a.id, uid: P.uid, nombre: a.nombre, club, fecha, hora, hhmm: hhmmDe(hora), dia: d.getDay(), nivel: "", tipo: "ausencia", conRecupero: con, inicio: firebase.firestore.Timestamp.fromDate(ini), creado: firebase.firestore.FieldValue.serverTimestamp(), visto: false, contado: false });
    tx.set(cRef, { club, fecha, hora, dia: d.getDay(), aus: (c.aus || 0) + 1, rec: c.rec || 0, ultimo: avId });
    if (con) tx.update(aRef, { recuperar: ((aS.data() || {}).recuperar || 0) + 1, ultimoAviso: avId });
  });
  return con;
}
async function reservarRec(fecha, hora, clubElegido) {
  const a = P.a; const d = isoDate(fecha); const club = clubElegido || a.club; const t = P.turnos[`${club}|${d.getDay()}|${hora}`] || {};
  const avId = `${a.id}_${fecha}_${hhmmDe(hora)}_recupera`; const cid = cupoId(club, fecha, hora); const cupo = P.info.cupo || CUPO;
  await fdb.runTransaction(async tx => {
    const aRef = fdb.doc("alumnos/" + a.id), cRef = fdb.doc("cupos/" + cid), vRef = fdb.doc("avisos/" + avId), tRef = fdb.doc("publico/turnos");
    if (P.avisos.some(v => v.id === avId)) throw { code: "ya" };
    const [aS, cS, tS] = [await tx.get(aRef), await tx.get(cRef), await tx.get(tRef)];
    const rec = (aS.data() || {}).recuperar || 0; if (rec < 1) throw { code: "sin-clases" };
    const base = ((tS.data() || {}).t || {})[`${club}|${d.getDay()}|${hora}`]; const c = cS.exists ? cS.data() : {};
    if (!base || cupo - base.n + (c.aus || 0) - (c.rec || 0) < 1) throw { code: "lleno" };
    tx.set(vRef, { alumnoId: a.id, uid: P.uid, nombre: a.nombre, club, fecha, hora, hhmm: hhmmDe(hora), dia: d.getDay(), nivel: t.nivel || "", tipo: "recupera", conRecupero: false, inicio: firebase.firestore.Timestamp.fromDate(inicioDe(fecha, hora)), creado: firebase.firestore.FieldValue.serverTimestamp(), visto: false, contado: false });
    tx.set(cRef, { club, fecha, hora, dia: d.getDay(), aus: c.aus || 0, rec: (c.rec || 0) + 1, ultimo: avId });
    tx.update(aRef, { recuperar: rec - 1, ultimoAviso: avId });
  });
}
const ERR_AL = { ocupado: "Tu lugar ya lo tomó otra persona. Hablá con Gabriel.", ya: "Ya estaba avisado.", lleno: "Justo se ocupó ese lugar. Elegí otro.", "sin-clases": "No tenés clases para recuperar.", "permission-denied": "No se pudo: quizás ya pasó el horario. Recargá la página.", unavailable: "Sin conexión. Probá de nuevo." };
document.addEventListener("click", async e => {
  if (window.MODO_STAFF) return;
  const b = e.target.closest("[data-pa]"); if (!b) return;
  const pa = b.dataset.pa;
  if (pa === "salir") { salir(); return; }
  if (pa === "cuenta") { abrirCuenta(); return; }
  if (pa === "cuUsuario" || pa === "cuClave") { await guardarCuenta(pa, b); return; }
  if (pa === "cerrar") { closeSheet(); return; }
  if (pa === "pagar") { abrirPagar(b.dataset.m); return; }
  if (pa === "pagarOk") { await mandarComprobante(b.dataset.m, b); return; }
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
        return { titulo: "Listo, avisado", texto: r ? `Te quedó una clase para recuperar <b>hasta el ${fechaDM(venceDe(f))}</b>. Reservala en <b>Inicio</b>, donde dice <b>Recuperar</b>.` : "Quedó registrado que no venís.",
          msg: `Hola Gabi, ¿cómo estás? Soy ${P.a.nombre}. No voy a ir ${cuando}${r ? ". Avisé por la app, me queda para recuperar." : ". Avisé por la app."}` };
      });
    return;
  }
  if (pa === "reservar") {
    const { f, h, c } = b.dataset; const cuando = `${fechaRel(f).toLowerCase() === "hoy" ? "hoy" : "el " + fechaLarga(f).toLowerCase()} a las ${h}`;
    confirmar(`¿Recuperás ${cuando}?`, "Se te descuenta una clase de las que tenés para recuperar y te guardamos el lugar.", "Reservar", async () => {
      await reservarRec(f, h, c);
      return { titulo: "¡Reservado!", texto: `Te esperamos ${cuando}.`, msg: `Hola Gabi, ¿cómo estás? Soy ${P.a.nombre}. Reservé por la app para recuperar ${cuando}.` };
    });
    return;
  }
  if (pa === "varias") { abrirVarias(); return; }
  if (pa === "irRec") { const el = document.getElementById("secRec"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (pa === "ptab") { P.tab = b.dataset.t; renderPortal(); scrollTo(0, 0); return; }
  if (pa === "viaje") { abrirViaje(); return; }
  if (pa === "viajeOk") { const sel = clasesViaje().map(c => ({ f: c.fecha, h: c.hora })); if (!sel.length) return; await avisarLista(b, sel); return; }
  if (pa === "notif") { b.disabled = true; b.textContent = "Activando…"; try { await activarNotificaciones({ rol: "alumno", alumnoId: P.perfil.alumnoId }); closeSheet(); toast("¡Listo! Te vamos a avisar antes de cada clase."); } catch (x) { console.error(x); toast(x && x.code === "denegado" ? "No diste permiso. Podés activarlo desde los ajustes del celu." : `No se pudo activar (${x && x.code}${x && x.detalle ? ": " + x.detalle : ""}). Mandale captura a Gabriel.`); } if (!$("#overlay").hidden && $("#notifSheet")) closeSheet(); renderPortal(); return; }
  if (pa === "calendario") { abrirCalendario(); return; }
  if (pa === "calOk") { descargarCalendario(); closeSheet(); return; }
  if (pa === "vuelvo") {
    const { f, h, c } = b.dataset; const cuando = `${fechaRel(f).toLowerCase() === "hoy" ? "hoy" : "el " + fechaLarga(f).toLowerCase()} a las ${h}`;
    confirmar(`¿Al final venís ${cuando}?`, '<b style="color:var(--warn)">Ojo: esto se puede hacer una sola vez.</b> Volvés a tu lugar, se te descuenta la clase para recuperar que te había quedado, y <b>ya no vas a poder avisar que no venís a esta clase</b>: si después faltás, la perdés.', "Sí, voy", async () => {
      try { await reservarRec(f, h, c); } catch (x) { if (x && x.code === "lleno") throw { code: "ocupado" }; throw x; }
      return { titulo: "¡Listo, te esperamos!", texto: `Volviste a tu clase ${cuando}.`, msg: `Hola Gabi, ¿cómo estás? Soy ${P.a.nombre}. Al final sí voy ${cuando}. Lo cambié en la app.` };
    });
    return;
  }
  if (pa === "variasOk") { await confirmarVarias(b); return; }
  if (pa === "ok") {
    if (P.ocupado || !P.accion) return; P.ocupado = true; b.disabled = true; b.textContent = "Un segundo…";
    try { const r = await P.accion(); avisarAlInstante(); const url = r && r.msg && P.info.telGabriel ? waURL(P.info.telGabriel, r.msg) : "";
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
      return `<div class="row"><span class="main"><span class="name">${DIAS_LARGO[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} · ${v.hora}</span><span class="meta">${v.conRecupero ? '<span style="color:var(--sun);font-weight:700">Te queda para recuperar</span>' : '<span class="due">Avisaste tarde: no se recupera</span>'}</span>${nota ? `<span class="small muted">${nota}</span>` : ""}</span>${puede ? `<button class="mini" data-pa="vuelvo" data-f="${v.fecha}" data-h="${v.hora}" data-c="${v.club}">Al final voy</button>` : ""}</div>`; }).join("")}</div>
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
  await avisarLista(b, sel);
}
async function avisarLista(b, sel) {
  if (P.ocupado) return; P.ocupado = true; b.disabled = true; b.textContent = "Avisando…";
  const ok = []; let rec = 0, fallo = 0;
  for (const c of sel) { try { if (await avisarNoVoy(c.f, c.h, "fija")) rec++; ok.push(c); } catch (x) { console.error(x); fallo++; } }
  P.ocupado = false; if (ok.length) avisarAlInstante();
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
  const DIAS_ICS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const ev = (a.horarios || []).map((h, i) => {
    const lugar = clubH(a, h) === "ESPACIO" ? "Espacio La 10" : "Jump";
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

/* ---- Ausencia programada: avisa todas las clases entre dos fechas ---- */
function abrirViaje() {
  const man = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const d1 = toISO(man), d2 = toISO(new Date(man.getFullYear(), man.getMonth(), man.getDate() + 6));
  openSheet(`<div style="display:grid;gap:4px"><h2 class="disp">Programar ausencia</h2><span class="small muted">Elegí desde y hasta qué día no venís. Si es un solo día, poné la misma fecha en las dos. Avisamos todas tus clases de esas fechas.</span></div>
    <div class="two"><div class="field"><label for="vjD">Desde</label><input id="vjD" type="date" min="${hoyISO}" value="${d1}"></div><div class="field"><label for="vjH">Hasta</label><input id="vjH" type="date" min="${hoyISO}" value="${d2}"></div></div>
    <div id="vjPrev" style="display:grid;gap:8px"></div>
    <p class="small" id="pErr" style="margin:0;color:var(--warn)"></p>
    <div class="btns"><span></span><span style="display:flex;gap:8px"><button class="btn sec2" data-pa="cerrar">Cancelar</button><button class="btn pri" data-pa="viajeOk" id="vjBtn">Avisar</button></span></div>`);
  viajePrev();
}
function clasesViaje() {
  const d = ($("#vjD") || {}).value, h = ($("#vjH") || {}).value; if (!d || !h || h < d) return [];
  return misClases(130).filter(c => c.tipo === "fija" && !c.aus && !c.vuelve && c.fecha >= d && c.fecha <= h && inicioDe(c.fecha, c.hora).getTime() > Date.now());
}
function viajePrev() {
  const el = $("#vjPrev"), btn = $("#vjBtn"); if (!el || !btn) return;
  const d = $("#vjD").value, h = $("#vjH").value;
  if (d && h && h < d) { el.innerHTML = '<span class="small due">La fecha "hasta" tiene que ser igual o posterior a "desde".</span>'; btn.disabled = true; btn.textContent = "Avisar"; return; }
  const cl = clasesViaje(); const con = cl.filter(c => inicioDe(c.fecha, c.hora).getTime() - Date.now() >= DIA_MS).length; const sin = cl.length - con;
  btn.disabled = !cl.length; btn.textContent = cl.length ? `Avisar ${cl.length} clase${cl.length === 1 ? "" : "s"}` : "Avisar";
  el.innerHTML = cl.length ? `<div class="list" style="max-height:38vh;overflow:auto">${cl.map(c => { const dd = isoDate(c.fecha); return `<div class="row"><span class="name">${DIAS_LARGO[dd.getDay()]} ${dd.getDate()}/${dd.getMonth() + 1} · ${c.hora}</span><span class="small muted">${clubTxt(c.club)}</span></div>`; }).join("")}</div>
    <p class="small" style="margin:0">${con ? `<b>${con}</b> te ${con === 1 ? "queda" : "quedan"} para recuperar, en las 2 semanas siguientes a cada clase.` : ""}${sin ? ` <span class="due">${sin} con menos de 24 h: no se recupera${sin > 1 ? "n" : ""}.</span>` : ""}</p>`
    : '<div class="empty">No tenés clases en esas fechas.</div>';
}
["input", "change"].forEach(ev => document.addEventListener(ev, e => { if (!window.MODO_STAFF && e.target && (e.target.id === "vjD" || e.target.id === "vjH")) viajePrev(); }));

/* ---- Mi cuenta: el alumno elige su usuario y su contraseña ---- */
function abrirCuenta() {
  const usuario = (P.perfil && P.perfil.usuario) || ((fauth.currentUser && fauth.currentUser.email) || "").split("@")[0];
  openSheet(`<div style="display:grid;gap:4px"><span class="flabel">Mi cuenta</span><h2 class="disp">${esc(P.a ? P.a.nombre : "")}</h2></div>
    <div class="field"><label for="cuU">Tu usuario</label><div style="display:flex;gap:8px"><input id="cuU" value="${esc(usuario)}" autocapitalize="none" autocorrect="off" spellcheck="false" style="flex:1"><button type="button" class="mini go" data-pa="cuUsuario">Guardar</button></div>
      <span class="small muted">Es con lo que entrás. Letras, números y puntos, sin espacios ni tildes.</span></div>
    <div class="field"><span class="flabel">Cambiar contraseña</span>
      <input id="cuA" type="password" placeholder="Contraseña actual" autocomplete="current-password">
      <input id="cuN" type="password" placeholder="Contraseña nueva (mínimo 6)" autocomplete="new-password">
      <input id="cuR" type="password" placeholder="Repetí la nueva" autocomplete="new-password">
      <button type="button" class="mini go" data-pa="cuClave" style="justify-self:start">Cambiar contraseña</button></div>
    <p class="small" id="cuMsg" style="margin:0"></p>
    <p class="small muted" style="margin:0">¿Te olvidaste la contraseña? Pedile a Gabriel una nueva.</p>
    <div class="btns"><button type="button" class="linkish" data-pa="salir">Cerrar sesión</button><button class="btn sec2" data-pa="cerrar">Cerrar</button></div>`);
}
async function guardarCuenta(pa, b) {
  const msg = $("#cuMsg"); const ok = t => { msg.style.color = "var(--ok)"; msg.textContent = t; }, mal = t => { msg.style.color = "var(--warn)"; msg.textContent = t; };
  b.disabled = true; const txt0 = b.textContent; b.textContent = "Un segundo…";
  try {
    if (pa === "cuUsuario") {
      const u = $("#cuU").value.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9._]{2,23}$/.test(u)) { mal("El usuario tiene que tener de 3 a 24 letras o números (podés usar puntos), sin espacios ni tildes."); return; }
      const r = await llamarCuenta("/cuenta/usuario", { usuario: u });
      P.perfil = { ...(P.perfil || {}), usuario: r.usuario }; try { await fauth.currentUser.reload(); } catch (e) {}
      ok(`Listo. Desde ahora entrás con el usuario "${r.usuario}".`);
    } else {
      const a = $("#cuA").value, n = $("#cuN").value, r = $("#cuR").value;
      if (!a) { mal("Poné tu contraseña actual."); return; }
      if (n.length < 6) { mal("La nueva tiene que tener al menos 6 caracteres."); return; }
      if (n !== r) { mal("Las dos contraseñas nuevas no coinciden."); return; }
      const u = fauth.currentUser;
      try { await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, a)); }
      catch (e) { mal(["auth/wrong-password", "auth/invalid-credential", "auth/invalid-login-credentials"].includes(e && e.code) ? "La contraseña actual no es correcta." : errorAuth(e)); return; }
      await u.updatePassword(n); $("#cuA").value = $("#cuN").value = $("#cuR").value = "";
      ok("Listo, contraseña cambiada. La próxima vez entrás con la nueva.");
    }
  } catch (x) { console.error(x); mal((x && x.msg) || (x && x.code ? errorAuth(x) : "No se pudo. Probá de nuevo.")); }
  finally { b.disabled = false; b.textContent = txt0; }
}
