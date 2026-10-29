/* ---------- Lo nuevo del lado de Gabriel: avisos de alumnos, accesos, importar ---------- */
const hhmmDe = h => String(h || "").replace(":", "");
// Un alumno que avisó "no voy" y después "al final voy" tiene los dos avisos en el mismo turno: cuenta como presente.
function vuelveApp(aid, fecha, hora) { return S.avisos.some(v => v.alumnoId === aid && v.fecha === fecha && v.hora === hora && v.tipo === "ausencia") && S.avisos.some(v => v.alumnoId === aid && v.fecha === fecha && v.hora === hora && v.tipo === "recupera"); }
function avisoApp(aid, fecha, hora, tipo) { return S.avisos.find(v => v.alumnoId === aid && v.fecha === fecha && v.hora === hora && v.tipo === tipo); }
function ajusteTurno(t, fecha) {
  const aus = new Set(), rec = [];
  S.avisos.forEach(v => { if (v.club !== t.club || v.fecha !== fecha || v.hora !== t.hora) return;
    if (vuelveApp(v.alumnoId, fecha, t.hora)) return;
    if (v.tipo === "ausencia") aus.add(v.alumnoId);
    else if (v.tipo === "recupera") { const a = S.alumnos.find(x => x.id === v.alumnoId); if (a) rec.push(a); } });
  return { aus, rec };
}
function tagAviso(aid, fecha, hora) {
  const rp = (S.reemp || {})[`${aid}|${fecha}|${hora}`];
  if (rp) return ` <span class="tag" style="background:var(--jump-soft,rgba(80,140,255,.15));color:var(--jump)">Va ${esc(rp.quien)} en su lugar</span>`;
  const v = avisoApp(aid, fecha, hora, "ausencia"); if (!v) return "";
  if (vuelveApp(aid, fecha, hora)) return ` <span class="tag" style="background:var(--ok-soft);color:var(--ok)">Avisó y al final viene</span>`;
  return ` <span class="tag rec">${v.conRecupero ? "Avisó por la app · recupera" : "Avisó tarde por la app"}</span>`;
}
function reservasAsistHTML(club, fecha, hora) {
  const rs = S.avisos.filter(v => v.tipo === "recupera" && v.club === club && v.fecha === fecha && v.hora === hora && !S.asMarcas[`${v.alumnoId}|${hora}`] && !vuelveApp(v.alumnoId, fecha, hora));
  return rs.map(v => { const a = S.alumnos.find(x => x.id === v.alumnoId); if (!a) return ""; const rp = (S.reemp || {})[`${a.id}|${fecha}|${hora}`];
    return `<div class="row"><span class="main"><span class="name">${rp ? `${esc(rp.quien)} <span class="muted" style="font-weight:500">(por ${esc(a.nombre)})</span>` : esc(a.nombre)}</span><span class="meta"><span class="tag rec">${rp ? `Recupera en lugar de ${esc(a.nombre)}` : "Reservó por la app para recuperar"}</span></span></span><button class="mini go" data-act="asRecApp" data-id="${a.id}" data-hora="${hora}">Vino</button></div>`; }).join("");
}
const fechaCorta = f => { const d = isoDate(f); return `${DIAS_LARGO[d.getDay()].toLowerCase()} ${d.getDate()}/${d.getMonth() + 1}`; };
function textoAviso(v) {
  const n = v.nombre || (S.alumnos.find(a => a.id === v.alumnoId) || {}).nombre || "Un alumno";
  // Avisó que no va a una recuperación que había reservado (no es su horario fijo).
  const al = S.alumnos.find(x => x.id === v.alumnoId);
  const recCanc = al && vuelveApp(v.alumnoId, v.fecha, v.hora) && !esFijoDe(al, v.club, v.fecha, v.hora);
  if (recCanc && v.tipo === "ausencia") return `<b>${esc(n)}</b> canceló la recuperación del <b>${fechaCorta(v.fecha)} a las ${v.hora}</b> · ${v.conRecupero ? '<span style="color:var(--sun)">avisó con 24 h, le vuelve la clase</span>' : '<span class="due">avisó con menos de 24 h, la pierde</span>'}`;
  if (recCanc) return `<b>${esc(n)}</b> había reservado recuperar el <b>${fechaCorta(v.fecha)} a las ${v.hora}</b> (después la canceló)`;
  if (v.tipo === "ausencia") return `<b>${esc(n)}</b> no va el <b>${fechaCorta(v.fecha)} a las ${v.hora}</b> · ${v.conRecupero ? '<span style="color:var(--sun)">queda para recuperar</span>' : '<span class="due">avisó con menos de 24 h, no recupera</span>'}`;
  if (vuelveApp(v.alumnoId, v.fecha, v.hora)) return `<b>${esc(n)}</b> <span style="color:var(--ok)">al final sí va</span> el <b>${fechaCorta(v.fecha)} a las ${v.hora}</b> (había avisado que no)`;
  const rp = (S.reemp || {})[`${v.alumnoId}|${v.fecha}|${v.hora}`];
  return `<b>${esc(n)}</b> reservó recuperar el <b>${fechaCorta(v.fecha)} a las ${v.hora}</b>${v.nivel ? ` (${esc(v.nivel)})` : ""}${rp ? ` · va <b>${esc(rp.quien)}</b> en su lugar` : ""}`;
}
function avisosHoyHTML() {
  if (S.modo === "profe") return "";
  const nv = S.avisos.filter(v => !v.visto && !S.vistos[v.id]).sort((a, b) => ((b.creado && b.creado.seconds) || 0) - ((a.creado && a.creado.seconds) || 0));
  if (!nv.length) return "";
  return `<section class="sec"><div class="sec-head"><h3>Avisos de alumnos</h3><button class="linkish" data-act="avisosTodos">Marcar todos vistos</button></div>
    <div class="list">${nv.slice(0, 12).map(v => `<div class="row"><span class="main"><span class="small" style="line-height:1.5">${textoAviso(v)}</span><span class="meta"><span class="tag ${v.club}">${v.club}</span></span></span><span style="display:grid;gap:6px;justify-items:end"><button class="mini" data-act="avisoVisto" data-av="${v.id}">Visto</button><button class="linkish" style="font-size:12px" data-act="avisoDeshacer" data-av="${v.id}">Deshacer</button></span></div>`).join("")}</div></section>`;
}

/* ---------- Accesos ---------- */
// Un alumno puede manejarse desde la cuenta de otro (por ejemplo Frank, de 9 años, desde la cuenta de su mamá Carla).
function nombreManeja(a) { const p = S.alumnos.find(x => x.id === a.manejaId) || S.alumnos.find(x => x.uid && x.uid === a.manejaUid); return (p && p.nombre) || "otra cuenta"; }
function manejaHTML(a) {
  const hijos = S.alumnos.filter(x => x.manejaUid && a.uid && x.manejaUid === a.uid);
  if (a.manejaUid) return `<div class="field"><span class="flabel">Lo maneja otra cuenta</span><span class="small">Entra desde la cuenta de <b>${esc(nombreManeja(a))}</b> y cambia entre los dos arriba de la app. Le llegan los avisos de ${esc(nombreCorto(a.nombre))} a ese celu.</span><button type="button" class="linkish" data-act="accDesvincular" data-id="${a.id}" style="justify-self:start">Desvincular</button></div>`;
  const ops = S.alumnos.filter(x => x.id !== a.id && x.uid && x.usuario && x.activo !== false && !x.manejaUid).sort((x, y) => x.nombre.localeCompare(y.nombre));
  return `${hijos.length ? `<div class="field"><span class="flabel">También maneja</span><span class="small">${esc(hijos.map(x => x.nombre).join(", "))}</span></div>` : ""}
    ${a.usuario ? "" : `<div class="field"><label class="flabel" for="accManeja">¿Lo maneja otra persona? (hijos, familia)</label><div style="display:flex;gap:8px;flex-wrap:wrap"><select id="accManeja" style="flex:1;min-width:0"><option value="">Elegí quién lo maneja…</option>${ops.map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join("")}</select><button type="button" class="mini go" data-act="accVincular" data-id="${a.id}">Vincular</button></div><span class="small muted">Sirve para chicos: usa la misma app y el mismo usuario que esa persona.</span></div>`}`;
}
async function vincularManeja(a, pid) {
  const p = S.alumnos.find(x => x.id === pid); if (!p || !p.uid) { toast("Esa persona todavía no tiene acceso a la app. Creáselo primero."); return false; }
  const FV = firebase.firestore.FieldValue; const bt = fdb.batch();
  bt.set(fdb.doc("usuarios/" + p.uid), { alumnos: FV.arrayUnion(a.id) }, { merge: true });
  bt.set(fdb.doc("alumnos/" + a.id), { manejaUid: p.uid, manejaId: p.id }, { merge: true });
  try { await bt.commit(); a.manejaUid = p.uid; a.manejaId = p.id; toast(`Listo: ${nombreCorto(p.nombre)} ve también las clases de ${nombreCorto(a.nombre)}`); return true; }
  catch (e) { console.error(e); toast("No se pudo vincular. Probá de nuevo."); return false; }
}
async function desvincularManeja(a) {
  const FV = firebase.firestore.FieldValue; const bt = fdb.batch();
  if (a.manejaUid) bt.set(fdb.doc("usuarios/" + a.manejaUid), { alumnos: FV.arrayRemove(a.id) }, { merge: true });
  bt.set(fdb.doc("alumnos/" + a.id), { manejaUid: FV.delete(), manejaId: FV.delete() }, { merge: true });
  try { await bt.commit(); delete a.manejaUid; delete a.manejaId; toast("Desvinculado"); return true; } catch (e) { console.error(e); toast("No se pudo desvincular."); return false; }
}
function pruebaPagoHTML(a) {
  if (mesKey(now) >= "2026-11" || !(a.usuario || a.manejaUid)) return "";
  return `<div class="field"><span class="flabel">Prueba de pago</span><span class="small muted">${a.pruebaPagos ? "Activada: en su app ya puede pagar la cuota de noviembre para probar." : "Para probar el pago antes de noviembre con este alumno."}</span><button type="button" class="mini" data-act="accPruebaPago" data-id="${a.id}" style="justify-self:start">${a.pruebaPagos ? "Desactivar prueba" : "Dejar probar el pago de noviembre"}</button></div>`;
}
function accesoHTML(a) {
  if (!S.esOwner) return "";
  if (a.manejaUid) return manejaHTML(a) + pruebaPagoHTML(a);
  return manejaHTML(a) + pruebaPagoHTML(a) + `<div class="field"><span class="flabel">Acceso a la app del alumno</span>${a.usuario
    ? `<span class="small">Usuario: <b>${esc(a.usuario)}</b> <span class="muted">(lo puede cambiar desde su app, en Mi cuenta)</span></span><span class="small muted">Si se olvidó la contraseña, generale una nueva y se la mandás por WhatsApp.</span><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button type="button" class="mini go" data-act="accClave" data-uid="${a.uid || ""}" data-id="${a.id}">Contraseña nueva</button><button type="button" class="linkish" style="font-size:12px" data-act="accesoCrear" data-id="${a.id}">Crear un acceso nuevo de cero</button></div>`
    : `<span class="small muted">Con un usuario y contraseña ve sus clases, asistencia y pagos, avisa si no va y reserva para recuperar.</span><button type="button" class="mini go" data-act="accesoCrear" data-id="${a.id}" style="justify-self:start">Crear acceso</button>`}</div>`;
}
function msgAcceso(nombre, usuario, clave, a) {
  const bk = a ? recBuckets(a) : []; const n = bk.reduce((t, b) => t + b.n, 0);
  const rec = n ? `\n\nTenés ${n === 1 ? "1 clase" : n + " clases"} para recuperar: ${bk.map(b => `${bk.length > 1 ? b.n + " " : ""}${bk.length > 1 ? "valen" : n === 1 ? "vale" : "valen"} hasta el ${fechaDM(b.vence)}`).join(" y ")}. Las reservás desde la app, en Recuperar, eligiendo un horario con lugar.` : "";
  return `Hola ${nombreCorto(nombre)}! Ya podés ver tus clases, tu asistencia y tus pagos en la app de las clases. Desde ahí también avisás si no venís y reservás para recuperar.\n\nEntrá acá: ${LINK_APP}\nUsuario: ${usuario}\nContraseña: ${clave}${rec}\n\nDesde noviembre:\n• La cuota se paga del 1 al 14 de cada mes, desde la app (transferís y subís el comprobante).\n• Si no podés venir, avisá por la app con al menos 24 h: esa clase la recuperás dentro de las 2 semanas siguientes.\n\nTip: agregala a la pantalla de inicio del celu y activá las notificaciones (la campanita) para que te lleguen los recordatorios.`;
}
// Crear acceso en un toque (usuario y contraseña automáticos). Si el usuario ya existe, le agrega un número.
async function accesoRapido(a) {
  const base = slugUsuario(a.nombre).slice(0, 21); const clave = claveNueva(); let usuario = base, uid = null;
  for (let i = 0; i < 6 && !uid; i++) {
    try { uid = await crearCuenta(usuario, clave); }
    catch (x) { if (x && x.code === "auth/email-already-in-use") { usuario = `${base}.${i + 2}`; continue; } throw x; }
  }
  if (!uid) throw { code: "auth/email-already-in-use" };
  const otros = a.uid ? ((S.usuarios || []).find(x => x.id === a.uid) || {}).alumnos || [] : [];
  if (a.uid) { try { await fdb.doc("usuarios/" + a.uid).delete(); } catch (x) {} }
  await fdb.doc("usuarios/" + uid).set({ rol: "alumno", alumnoId: a.id, usuario, nombre: a.nombre, alta: hoyISO, ...(otros.length ? { alumnos: otros } : {}) });
  for (const oid of otros) { try { await fdb.doc("alumnos/" + oid).set({ manejaUid: uid }, { merge: true }); } catch (x) {} }
  await fdb.doc("alumnos/" + a.id).set({ uid, usuario }, { merge: true }); a.uid = uid; a.usuario = usuario;
  return { usuario, clave };
}
const ACC_HECHO = {};
function filaAcceso(a) {
  const h = ACC_HECHO[a.id]; const n = recN(a);
  const meta = `${tagsClub(a)}${n ? `<span class="tag rec">Recupera ${n}</span>` : ""}${a.tel ? "" : '<span class="due">Sin teléfono</span>'}`;
  let acc;
  if (h) { const txt = msgAcceso(a.nombre, h.usuario, h.clave, a); const url = waURL(a.tel, txt);
    acc = `${url ? `<a class="mini go" href="${url}" target="_blank" rel="noopener" data-accwa="${a.id}">${h.mandado ? "✓ Mandado" : "WhatsApp →"}</a>` : ""}<button class="mini" data-act="copy" data-text="${esc(txt)}">Copiar</button>`; }
  else if (a.usuario) acc = `<span class="small muted">Ya tiene: ${esc(a.usuario)}</span>`;
  else if (a.manejaUid) acc = `<span class="small muted">Lo maneja ${esc(nombreManeja(a))}</span>`;
  else acc = `<button class="mini go" data-act="accRapido" data-id="${a.id}">Crear acceso</button>`;
  return `<div class="row" data-k="acc-${a.id}" id="acc-${a.id}"><span class="main"><span class="name">${esc(a.nombre)}</span><span class="meta">${meta}${h ? `<span>Usuario <b>${esc(h.usuario)}</b> · clave <b>${esc(h.clave)}</b></span>` : ""}</span></span><span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">${acc}</span></div>`;
}
function openAccesosMasivo() {
  const al = S.alumnos.filter(a => a.activo !== false && enClub(a, S.club)).sort((x, y) => (!!x.usuario - !!y.usuario) || x.nombre.localeCompare(y.nombre));
  const sin = al.filter(a => !a.usuario && !a.manejaUid && !ACC_HECHO[a.id]).length;
  openSheet(`<div style="display:grid;gap:12px">
    <div style="display:grid;gap:4px"><span class="flabel">App de los alumnos</span><h2 class="disp">Mandar accesos</h2>
      <span class="small muted">Tocá <b>Crear acceso</b> y después <b>WhatsApp</b>: le llega el link, su usuario y contraseña${al.some(a => recN(a)) ? ", las clases que tiene para recuperar" : ""} y cómo funciona desde noviembre. ${sin} sin acceso.</span>
      <span class="small muted">Las contraseñas se ven solo mientras esta ventana está abierta. Si se pierde, desde la ficha le generás una nueva.</span></div>
    <div class="list" id="accList">${al.map(filaAcceso).join("")}</div>
    <div class="btns"><span></span><button class="btn sec2" data-act="close">Listo</button></div></div>`);
}
document.addEventListener("click", e => { const l = e.target.closest("a[data-accwa]"); if (l && ACC_HECHO[l.dataset.accwa]) { ACC_HECHO[l.dataset.accwa].mandado = true; setTimeout(() => { l.textContent = "✓ Mandado"; }, 300); } });
function openAcceso(a, tipo = "alumno") {
  const sug = tipo === "alumno" ? slugUsuario(a.nombre) : "";
  openSheet(`<form id="fAcc" data-id="${a ? a.id : ""}" data-tipo="${tipo}" style="display:grid;gap:14px">
    <div style="display:grid;gap:4px"><span class="flabel">${tipo === "alumno" ? "Acceso para el alumno" : "Acceso para un profe"}</span><h2 class="disp">${a ? esc(a.nombre) : "Nuevo profe"}</h2></div>
    ${tipo === "profe" ? `<div class="field"><label for="accNom">Nombre</label><input id="accNom" required value="Esteban"></div>` : ""}
    <div class="field"><label for="accU">Usuario</label><input id="accU" required autocapitalize="none" autocorrect="off" spellcheck="false" value="${esc(tipo === "profe" ? "esteban" : sug)}"><span class="small muted">Letras, números y puntos. Es con lo que entra.</span></div>
    <div class="field"><label for="accP">Contraseña</label><input id="accP" required minlength="6" value="${claveNueva()}"><span class="small muted">Mínimo 6 caracteres. Se la mandás por WhatsApp.</span></div>
    <p class="small" id="accErr" style="margin:0;color:var(--warn)"></p>
    <div class="btns"><span></span><span style="display:flex;gap:8px"><button type="button" class="btn sec2" data-act="close">Cancelar</button><button class="btn pri" id="accBtn">Crear acceso</button></span></div>
  </form>`);
}
async function migrarLegado(uid) {
  // Pasa las horas y gastos que Esteban cargó en la app anterior a su usuario nuevo.
  for (const col of ["horas", "finanzas"]) {
    const snap = await fdb.collection(col).get();
    const viejo = snap.docs.find(d => d.id.startsWith("u_"));
    if (viejo) { await fdb.collection(col).doc(uid).set(viejo.data()); await fdb.collection(col).doc(viejo.id).delete(); }
  }
}
document.addEventListener("submit", async e => {
  if (!window.MODO_STAFF || e.target.id !== "fAcc") return;
  e.preventDefault(); const f = e.target; const tipo = f.dataset.tipo; const a = S.alumnos.find(x => x.id === f.dataset.id);
  const usuario = slugUsuario($("#accU").value).replace(/^\.+|\.+$/g, ""), clave = $("#accP").value.trim(); const err = $("#accErr"), btn = $("#accBtn");
  if (clave.length < 6) { err.textContent = "La contraseña tiene que tener al menos 6 caracteres."; return; }
  btn.disabled = true; btn.textContent = "Creando…"; err.textContent = "";
  try {
    const uid = await crearCuenta(usuario, clave);
    if (tipo === "alumno") {
      const otros = a.uid ? ((S.usuarios || []).find(x => x.id === a.uid) || {}).alumnos || [] : [];
      if (a.uid) { try { await fdb.doc("usuarios/" + a.uid).delete(); } catch (x) {} }
      await fdb.doc("usuarios/" + uid).set({ rol: "alumno", alumnoId: a.id, usuario, nombre: a.nombre, alta: hoyISO, ...(otros.length ? { alumnos: otros } : {}) });
      for (const oid of otros) { try { await fdb.doc("alumnos/" + oid).set({ manejaUid: uid }, { merge: true }); } catch (x) {} }
      await fdb.doc("alumnos/" + a.id).set({ uid, usuario }, { merge: true });
      const txt = msgAcceso(a.nombre, usuario, clave, a); const url = waURL(a.tel, txt);
      openSheet(`<div style="display:grid;gap:4px"><span class="flabel">Acceso creado</span><h2 class="disp">${esc(a.nombre)}</h2></div>
        <div class="msg"><div class="bubble">${esc(txt)}</div><div class="msg-actions">${url ? `<a class="cta wa" href="${url}" target="_blank" rel="noopener">Mandar por WhatsApp <i>→</i></a>` : `<span class="small due">Falta el teléfono</span>`}<button class="mini" data-act="copy" data-text="${esc(txt)}">Copiar</button></div></div>
        <p class="small muted" style="margin:0">Guardá la contraseña: después no se puede volver a ver.</p>
        <div class="btns"><span></span><button class="btn sec2" data-act="close">Listo</button></div>`);
    } else {
      const nombre = ($("#accNom").value || "Profe").trim();
      await fdb.doc("usuarios/" + uid).set({ rol: "profe", usuario, nombre, alta: hoyISO });
      await migrarLegado(uid);
      const txt = `Hola ${nombreCorto(nombre)}! La app de las clases cambió de lugar. Ahora entrás acá: ${LINK_APP}\nUsuario: ${usuario}\nContraseña: ${clave}\nTus horas y gastos ya están pasados.\n\n1) Agregala a la pantalla de inicio del celu (en iPhone: Compartir → Agregar a inicio) y abrila desde ese ícono.\n2) En Mis horas tocá "Activar" las notificaciones: te van a llegar los avisos cuando un alumno de Jump no viene o reserva para recuperar.\n3) Todos los días: cargá tus horas y tomá asistencia (con "Vinieron todos" es un toque).`;
      const url = S.cfg.telProfe ? waURL(S.cfg.telProfe, txt) : "";
      openSheet(`<div style="display:grid;gap:4px"><span class="flabel">Acceso creado</span><h2 class="disp">${esc(nombre)}</h2></div>
        <div class="msg"><div class="bubble">${esc(txt)}</div><div class="msg-actions">${url ? `<a class="cta wa" href="${url}" target="_blank" rel="noopener">Mandar por WhatsApp <i>→</i></a>` : ""}<button class="mini" data-act="copy" data-text="${esc(txt)}">Copiar</button></div></div>
        <div class="btns"><span></span><button class="btn sec2" data-act="close">Listo</button></div>`);
    }
  } catch (x) { console.error(x); err.textContent = x && x.code && x.code.startsWith("auth/") ? errorAuth(x) : "No se pudo crear. Probá de nuevo."; btn.disabled = false; btn.textContent = "Crear acceso"; }
});

/* ---------- Ajustes extra ---------- */
function cfgExtraHTML() {
  const profes = S.usuarios.filter(u => u.rol === "profe");
  const conAcceso = S.alumnos.filter(a => a.usuario || a.manejaUid).length;
  return `<div class="msg" style="gap:10px"><div class="msg-k"><b>App de los alumnos</b></div>
      <span class="small">Link para mandarles: <b>${esc(LINK_APP)}</b></span>
      <span class="small muted">${conAcceso} de ${S.alumnos.filter(a => a.activo !== false).length} alumnos tienen acceso.</span><button type="button" class="mini go" data-act="accMasivo" style="justify-self:start">Mandar accesos a los alumnos</button>
      <div class="field"><label for="cTelG">Tu WhatsApp (para que los alumnos te escriban)</label><div style="display:flex;gap:8px"><input id="cTelG" inputmode="tel" value="${esc(S.cfg.telGabriel || "")}" placeholder="351…" style="flex:1"><button type="button" class="mini go" data-act="telGSave">Guardar</button></div></div>
      <button type="button" class="mini" data-act="copy" data-text="${esc(LINK_APP)}" style="justify-self:start">Copiar link</button></div>
    <div class="msg" style="gap:10px"><div class="msg-k"><b>Profes</b></div>
      ${profes.length ? profes.map(p => `<span class="small" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${esc(p.nombre)} · usuario <b>${esc(p.usuario)}</b> <button type="button" class="mini" style="font-size:12px;padding:4px 10px" data-act="accClave" data-uid="${p.id}">Contraseña nueva</button></span>`).join("") : `<span class="small muted">Esteban todavía no tiene usuario en esta app.</span>`}
      <button type="button" class="mini" data-act="profeCrear" style="justify-self:start">Crear acceso para un profe</button></div>
    <div class="msg" style="gap:10px"><div class="msg-k"><b>Datos</b></div>
      <span class="small muted">Para pasar los datos de la app anterior, elegí el archivo que te mandó Claude.</span>
      <label class="mini" style="justify-self:start;cursor:pointer">Importar archivo<input type="file" id="impFile" accept=".json,application/json" hidden></label>
      <button type="button" class="linkish" data-act="salir" style="justify-self:start">Cerrar sesión</button></div>`;
}
async function importarDatos(file) {
  let data; try { data = JSON.parse(await file.text()); } catch (e) { toast("Ese archivo no es el correcto."); return; }
  const ops = [];
  Object.entries(data).forEach(([col, docs]) => Object.entries(docs || {}).forEach(([id, d]) => ops.push([col, id, d])));
  if (!ops.length) { toast("El archivo está vacío."); return; }
  if (!confirm(`Se van a cargar ${ops.length} registros (alumnos, asistencia, horas…). Si ya existen, se reemplazan. ¿Seguimos?`)) return;
  try {
    for (let i = 0; i < ops.length; i += 400) {
      const b = fdb.batch(); ops.slice(i, i + 400).forEach(([c, id, d]) => b.set(fdb.collection(c).doc(id), d)); await b.commit();
    }
    toast(`Listo: ${ops.length} registros cargados.`); closeSheet();
  } catch (e) { console.error(e); toast("No se pudo importar. Probá de nuevo."); }
}
document.addEventListener("change", e => { if (window.MODO_STAFF && e.target.id === "impFile" && e.target.files[0]) importarDatos(e.target.files[0]); });

window.accionExtra = async (act, b, A) => {
  switch (act) {
    case "salir": salir(); break;
    case "notif": { b.disabled = true; try { await activarNotificaciones({ rol: S.esOwner ? "dueño" : "profe" }); toast("¡Listo! Te va a llegar un aviso cuando un alumno cancele o reserve."); } catch (x) { console.error(x); toast(x && x.code === "denegado" ? "No diste permiso. Activalo desde los ajustes del celu." : `No se pudo activar (${x && x.code}${x && x.detalle ? ": " + x.detalle : ""}).`); } render(); break; }
    case "avisoVisto": { const id = b.dataset.av; S.vistos[id] = true; render(); try { await fdb.doc("avisos/" + id).update({ visto: true }); } catch (e) {} break; }
    case "avisosTodos": { const ids = S.avisos.filter(v => !v.visto).map(v => v.id); ids.forEach(id => S.vistos[id] = true); render();
      try { const bt = fdb.batch(); ids.forEach(id => bt.update(fdb.doc("avisos/" + id), { visto: true })); await bt.commit(); } catch (e) {} break; }
    case "asRecApp": if (A) { S.asMarcas[`${A.id}|${b.dataset.hora}`] = "recuperando"; render(); if (await guardarAsist()) { toast(`${A.nombre} vino a recuperar`); avisarDueno(`${nomProfe()}: ${A.nombre} vino a recuperar`, `${diaTxt(S.asFecha)} ${b.dataset.hora} · ${S.asClub === "ESPACIO" ? "Espacio" : "Jump"}`); } } break;
    case "accesoCrear": if (A) openAcceso(A, "alumno"); break;
    case "accPruebaPago": if (A) { const v = !A.pruebaPagos; b.disabled = true;
      try { await fdb.doc("alumnos/" + A.id).set({ pruebaPagos: v ? true : firebase.firestore.FieldValue.delete() }, { merge: true }); if (v) A.pruebaPagos = true; else delete A.pruebaPagos; toast(v ? `${nombreCorto(A.nombre)} ya puede probar el pago de noviembre` : "Prueba desactivada"); closeSheet(); formAlumno(A); cargarHist(A); }
      catch (e) { console.error(e); toast("No se pudo cambiar."); b.disabled = false; } } break;
    case "accVincular": if (A) { const pid = ($("#accManeja") || {}).value; if (!pid) { toast("Elegí quién lo maneja."); break; } b.disabled = true; if (await vincularManeja(A, pid)) { closeSheet(); formAlumno(A); cargarHist(A); } else b.disabled = false; } break;
    case "accDesvincular": if (A) { b.disabled = true; if (await desvincularManeja(A)) { closeSheet(); formAlumno(A); cargarHist(A); } else b.disabled = false; } break;
    case "accMasivo": openAccesosMasivo(); break;
    case "accRapido": if (A) { b.disabled = true; b.textContent = "Creando…";
      try { ACC_HECHO[A.id] = await accesoRapido(A); } catch (x) { console.error(x); toast(x && x.code && String(x.code).startsWith("auth/") ? errorAuth(x) : "No se pudo crear. Probá de nuevo."); b.disabled = false; b.textContent = "Crear acceso"; break; }
      const row = document.getElementById("acc-" + A.id); if (row) row.outerHTML = filaAcceso(A); } break;
    case "resetPrueba": if (A) await abrirResetPrueba(A); break;
    case "resetOk": if (A) await hacerResetPrueba(A, b); break;
    case "resetN": RP.n = Math.max(0, RP.n + Number(b.dataset.d)); pintarResetPrueba(); break;
    case "avisoDeshacer": await deshacerAviso(b.dataset.av); break;
    case "profeCrear": openAcceso(null, "profe"); break;
    case "accClave": await claveNuevaPara(b.dataset.uid, A); break;
    case "telGSave": { const v = $("#cTelG").value.trim(); if (await safe(() => fdb.doc("config/general").update({ ...S.cfg, telGabriel: v }), "Guardado")) S.cfg = { ...S.cfg, telGabriel: v }; break; }
  }
};

/* ---------- Deshacer un aviso (el alumno al final sí va / no va a recuperar) ---------- */
function avisosFichaHTML(a) {
  const av = S.avisos.filter(v => v.alumnoId === a.id && v.fecha >= hoyISO).sort((x, y) => (x.fecha + x.hora).localeCompare(y.fecha + y.hora));
  if (!av.length) return "";
  return `<div class="field"><span class="flabel">Avisos por la app</span><div style="display:grid;gap:6px">${av.map(v => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13.5px"><span>${v.tipo === "ausencia" ? `No va el <b>${fechaCorta(v.fecha)} ${v.hora}</b>${v.conRecupero ? " · recupera" : " · sin recupero"}` : `Recupera el <b>${fechaCorta(v.fecha)} ${v.hora}</b>`}</span><button type="button" class="mini" style="font-size:12px;padding:4px 10px" data-act="avisoDeshacer" data-av="${v.id}">Deshacer</button></div>`).join("")}</div>
    <span class="small muted">Deshacer: si al final sí viene (o no viene a recuperar). La clase para recuperar se ajusta sola.</span></div>`;
}
async function deshacerAviso(id) {
  const v = S.avisos.find(x => x.id === id); if (!v) return;
  const a = S.alumnos.find(x => x.id === v.alumnoId) || {}; const n = a.nombre || v.nombre || "el alumno";
  const txt = v.tipo === "ausencia"
    ? `${n} vuelve a estar en la clase del ${fechaCorta(v.fecha)} a las ${v.hora}.${v.conRecupero ? (recN(a) > 0 ? " Se le descuenta la clase para recuperar que le había quedado." : " Ojo: ya usó esa clase para recuperar, queda en 0.") : ""}`
    : `Se cancela la recuperación de ${n} del ${fechaCorta(v.fecha)} a las ${v.hora} y le vuelve la clase para recuperar.`;
  if (!confirm(txt + "\n\n¿Deshacer el aviso?")) return;
  try {
    await fdb.runTransaction(async tx => {
      const vRef = fdb.doc("avisos/" + id); const vS = await tx.get(vRef); if (!vS.exists) return; const d = vS.data();
      const cRef = fdb.doc(`cupos/${d.club}_${d.fecha}_${d.hhmm}`); const aRef = fdb.doc("alumnos/" + d.alumnoId);
      const cS = await tx.get(cRef); const aS = await tx.get(aRef);
      const c = cS.exists ? cS.data() : {}; const ad = { ...(aS.data() || {}), id: d.alumnoId };
      // Firestore exige hacer todas las lecturas antes de la primera escritura.
      const otroRef = fdb.doc(`avisos/${d.alumnoId}_${d.fecha}_${d.hhmm}_${d.tipo === "ausencia" ? "recupera" : "ausencia"}`); const oS = await tx.get(otroRef);
      recPendAvisos(ad).forEach(x => { if (x.id !== id) tx.update(fdb.doc("avisos/" + x.id), { contado: true }); });
      if (d.tipo === "ausencia" && oS.exists) { tx.set(cRef, { aus: Math.max(0, (c.aus || 0) - 1), rec: Math.max(0, (c.rec || 0) - 1) }, { merge: true }); tx.delete(otroRef); }
      else if (d.tipo === "ausencia") { tx.set(cRef, { aus: Math.max(0, (c.aus || 0) - 1) }, { merge: true }); if (d.conRecupero) tx.update(aRef, recCambio(ad, -1, hoyISO, venceDe(d.fecha))); }
      else { tx.set(cRef, { rec: Math.max(0, (c.rec || 0) - 1) }, { merge: true }); tx.update(aRef, recCambio(ad, 1, hoyISO)); }
      tx.delete(vRef);
    });
    toast("Aviso deshecho"); if (!$("#overlay").hidden && $("#fA")) closeSheet();
  } catch (e) { console.error(e); toast("No se pudo deshacer. Probá de nuevo."); }
}

/* ---------- Contraseña nueva para un alumno o profe que se la olvidó (mismo usuario) ---------- */
async function claveNuevaPara(uid, a) {
  const u = S.usuarios.find(x => x.id === uid) || {}; const nombre = (a && a.nombre) || u.nombre || "";
  if (!uid) { toast("Este alumno no tiene acceso todavía."); return; }
  const clave = claveNueva();
  if (!confirm(`¿Generar una contraseña nueva para ${nombre}? La anterior deja de funcionar.`)) return;
  try {
    const r = await llamarCuenta("/cuenta/clave", { uid, clave }); const usuario = r.usuario || (a && a.usuario) || u.usuario;
    const txt = `Hola ${nombreCorto(nombre)}! Te generé una contraseña nueva para la app de las clases.\n\nEntrá acá: ${LINK_APP}\nUsuario: ${usuario}\nContraseña: ${clave}\n\nDespués la podés cambiar por una tuya en Mi cuenta.`;
    const tel = a ? a.tel : (u.rol === "profe" ? S.cfg.telProfe : ""); const url = waURL(tel, txt);
    openSheet(`<div style="display:grid;gap:4px"><span class="flabel">Contraseña nueva</span><h2 class="disp">${esc(nombre)}</h2></div>
      <div class="msg"><div class="bubble">${esc(txt)}</div><div class="msg-actions">${url ? `<a class="cta wa" href="${url}" target="_blank" rel="noopener">Mandar por WhatsApp <i>→</i></a>` : `<span class="small due">Falta el teléfono</span>`}<button class="mini" data-act="copy" data-text="${esc(txt)}">Copiar</button></div></div>
      <div class="btns"><span></span><button class="btn sec2" data-act="close">Listo</button></div>`);
  } catch (x) { console.error(x); toast((x && x.msg) || "No se pudo. Probá de nuevo."); }
}


/* ---------- Borrar pruebas: deja a un alumno como si nunca hubiera usado la app (avisos, reservas, pagos de prueba) ---------- */
const RP = { a: null, av: [], ree: [], sol: [], comp: [], n: 0 };
async function abrirResetPrueba(a) {
  openSheet(`<div class="empty">Buscando lo que hizo ${esc(a.nombre)} en la app…</div>`);
  try {
    const q = c => fdb.collection(c).where("alumnoId", "==", a.id).get().then(s => s.docs.map(d => ({ id: d.id, ...d.data() })));
    const [av, ree, sol, comp] = await Promise.all([q("avisos"), q("reemplazos"), q("solicitudes"), q("comprobantes")]);
    RP.a = a; RP.av = av.sort((x, y) => (x.fecha + x.hora).localeCompare(y.fecha + y.hora)); RP.ree = ree; RP.sol = sol; RP.comp = comp;
    // Clases para recuperar: lo de ahora, sacándole lo que sumaron o restaron los avisos de prueba.
    const par = v => av.some(x => x.tipo !== v.tipo && x.fecha === v.fecha && x.hora === v.hora);
    let d = 0; av.forEach(v => { if (par(v)) return; if (v.tipo === "ausencia" && v.conRecupero) d--; if (v.tipo === "recupera") d++; });
    RP.n = Math.max(0, recN(a) + d);
  } catch (e) { console.error(e); openSheet(`<div class="empty">No se pudo cargar. Revisá la conexión y probá de nuevo.</div><button class="btn sec2" data-act="close">Cerrar</button>`); return; }
  pintarResetPrueba();
}
function pintarResetPrueba() {
  const a = RP.a; const items = [];
  RP.av.forEach(v => items.push(v.tipo === "ausencia" ? `Avisó que no va el <b>${fechaCorta(v.fecha)} ${v.hora}</b>` : `Reservó recuperar el <b>${fechaCorta(v.fecha)} ${v.hora}</b>`));
  RP.ree.forEach(r => items.push(`Mandó a ${esc(r.quien || "otra persona")} el ${fechaCorta(r.fecha)} ${r.hora}`));
  RP.sol.forEach(r => items.push(`Pidió sumar un día (${DIAS_LARGO[r.dia] || ""} ${r.hora || ""})`));
  RP.comp.forEach(c => items.push(`Comprobante de pago de ${mesLbl(c.mes)}${c.aplicado ? " (lo marcó pagado: se vuelve a sin pagar)" : ""}`));
  openSheet(`<div style="display:grid;gap:4px"><span class="flabel">Borrar pruebas</span><h2 class="disp">${esc(a.nombre)}</h2><span class="small muted">Queda como si nunca hubiera usado la app. Su usuario y contraseña siguen iguales, y la asistencia que tomaron ustedes no se toca.</span></div>
    ${items.length ? `<div class="field"><span class="flabel">Se borra (${items.length})</span><div style="display:grid;gap:6px;font-size:14px">${items.map(x => `<span>• ${x}</span>`).join("")}</div></div>` : `<div class="empty">No hay nada de la app para borrar.</div>`}
    <div class="field"><span class="flabel">Clases para recuperar al terminar</span><div style="display:flex;align-items:center;gap:14px"><button type="button" class="mini" data-act="resetN" data-id="${a.id}" data-d="-1">−</button><b class="num" style="font-size:22px">${RP.n}</b><button type="button" class="mini" data-act="resetN" data-id="${a.id}" data-d="1">+</button></div><span class="small muted">Ahora tiene ${recN(a)}. Dejá las que de verdad le quedan (las faltas reales que venía arrastrando).</span></div>
    <div class="btns"><span></span><span style="display:flex;gap:8px"><button type="button" class="btn sec2" data-act="close">Cancelar</button><button type="button" class="btn pri" data-act="resetOk" data-id="${a.id}">Borrar y dejar en cero</button></span></div>`);
}
async function hacerResetPrueba(a, b) {
  if (!confirm(`¿Borrar todo lo que se probó con ${a.nombre}? No se puede deshacer.`)) return;
  b.disabled = true; b.textContent = "Borrando…";
  try {
    const FV = firebase.firestore.FieldValue; const ops = [];
    // Lugares: se devuelven los que ocupaban los avisos de prueba (solo clases que todavía no pasaron).
    const cup = {}; RP.av.forEach(v => { if (v.fecha < hoyISO || !v.club || !v.hhmm) return; const k = `${v.club}_${v.fecha}_${v.hhmm}`; cup[k] = cup[k] || { aus: 0, rec: 0 }; cup[k][v.tipo === "ausencia" ? "aus" : "rec"]++; });
    for (const k of Object.keys(cup)) { const r = fdb.doc("cupos/" + k); const d = await r.get(); if (!d.exists) continue; const c = d.data();
      ops.push(bt => bt.set(r, { aus: Math.max(0, (c.aus || 0) - cup[k].aus), rec: Math.max(0, (c.rec || 0) - cup[k].rec) }, { merge: true })); }
    RP.av.forEach(v => ops.push(bt => bt.delete(fdb.doc("avisos/" + v.id))));
    RP.ree.forEach(r => ops.push(bt => bt.delete(fdb.doc("reemplazos/" + r.id))));
    RP.sol.forEach(r => ops.push(bt => bt.delete(fdb.doc("solicitudes/" + r.id))));
    RP.comp.forEach(c => { ops.push(bt => bt.delete(fdb.doc("comprobantes/" + c.id))); ops.push(bt => bt.delete(fdb.doc("fotosPago/" + c.id))); });
    // Clases para recuperar: se guarda el número elegido, respetando los vencimientos que ya tenía.
    const m = {}; recBuckets(a, []).forEach(x => m[x.vence] = x.n); let sum = Object.values(m).reduce((s, n) => s + n, 0);
    if (RP.n > sum) { const k = venceDe(hoyISO); m[k] = (m[k] || 0) + RP.n - sum; }
    else if (RP.n < sum) { let r = sum - RP.n; for (const k of Object.keys(m).sort()) { const q = Math.min(r, m[k]); m[k] -= q; r -= q; if (!m[k]) delete m[k]; if (!r) break; } }
    const recVence = {}; Object.keys(a.recVence || {}).forEach(k => recVence[k] = 0); Object.assign(recVence, m);
    const upd = { recuperar: RP.n, recVence, ultimoAviso: FV.delete() };
    RP.comp.filter(c => c.aplicado && a.pagos && a.pagos[c.mes] && a.pagos[c.mes].comprobante).forEach(c => { upd["pagos." + c.mes] = FV.delete(); });
    ops.push(bt => bt.update(fdb.doc("alumnos/" + a.id), upd));
    for (let i = 0; i < ops.length; i += 400) { const bt = fdb.batch(); ops.slice(i, i + 400).forEach(f => f(bt)); await bt.commit(); }
    closeSheet(); toast(`${a.nombre} quedó en cero`);
  } catch (e) { console.error(e); b.disabled = false; b.textContent = "Borrar y dejar en cero"; toast("No se pudo borrar. Probá de nuevo."); }
}
