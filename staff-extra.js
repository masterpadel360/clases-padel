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
function accesoHTML(a) {
  if (!S.esOwner) return "";
  return `<div class="field"><span class="flabel">Acceso a la app del alumno</span>${a.usuario
    ? `<span class="small">Usuario: <b>${esc(a.usuario)}</b> <span class="muted">(lo puede cambiar desde su app, en Mi cuenta)</span></span><span class="small muted">Si se olvidó la contraseña, generale una nueva y se la mandás por WhatsApp.</span><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button type="button" class="mini go" data-act="accClave" data-uid="${a.uid || ""}" data-id="${a.id}">Contraseña nueva</button><button type="button" class="linkish" style="font-size:12px" data-act="accesoCrear" data-id="${a.id}">Crear un acceso nuevo de cero</button></div>`
    : `<span class="small muted">Con un usuario y contraseña ve sus clases, asistencia y pagos, avisa si no va y reserva para recuperar.</span><button type="button" class="mini go" data-act="accesoCrear" data-id="${a.id}" style="justify-self:start">Crear acceso</button>`}</div>`;
}
function msgAcceso(nombre, usuario, clave) {
  return `Hola ${nombreCorto(nombre)}! Ya podés ver tus clases, tu asistencia y tus pagos en la app de las clases. Desde ahí también avisás si no venís y reservás para recuperar.\n\nEntrá acá: ${LINK_APP}\nUsuario: ${usuario}\nContraseña: ${clave}\n\nTip: agregala a la pantalla de inicio del celu para tenerla a mano.`;
}
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
      if (a.uid) { try { await fdb.doc("usuarios/" + a.uid).delete(); } catch (x) {} }
      await fdb.doc("usuarios/" + uid).set({ rol: "alumno", alumnoId: a.id, usuario, nombre: a.nombre, alta: hoyISO });
      await fdb.doc("alumnos/" + a.id).set({ uid, usuario }, { merge: true });
      const txt = msgAcceso(a.nombre, usuario, clave); const url = waURL(a.tel, txt);
      openSheet(`<div style="display:grid;gap:4px"><span class="flabel">Acceso creado</span><h2 class="disp">${esc(a.nombre)}</h2></div>
        <div class="msg"><div class="bubble">${esc(txt)}</div><div class="msg-actions">${url ? `<a class="cta wa" href="${url}" target="_blank" rel="noopener">Mandar por WhatsApp <i>→</i></a>` : `<span class="small due">Falta el teléfono</span>`}<button class="mini" data-act="copy" data-text="${esc(txt)}">Copiar</button></div></div>
        <p class="small muted" style="margin:0">Guardá la contraseña: después no se puede volver a ver.</p>
        <div class="btns"><span></span><button class="btn sec2" data-act="close">Listo</button></div>`);
    } else {
      const nombre = ($("#accNom").value || "Profe").trim();
      await fdb.doc("usuarios/" + uid).set({ rol: "profe", usuario, nombre, alta: hoyISO });
      await migrarLegado(uid);
      const txt = `Hola ${nombreCorto(nombre)}! La app de las clases cambió de lugar. Ahora entrás acá: ${LINK_APP}\nUsuario: ${usuario}\nContraseña: ${clave}\nTus horas y gastos ya están pasados.`;
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
  const conAcceso = S.alumnos.filter(a => a.usuario).length;
  return `<div class="msg" style="gap:10px"><div class="msg-k"><b>App de los alumnos</b></div>
      <span class="small">Link para mandarles: <b>${esc(LINK_APP)}</b></span>
      <span class="small muted">${conAcceso} de ${S.alumnos.filter(a => a.activo !== false).length} alumnos tienen acceso. Se crea desde la ficha de cada alumno.</span>
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
    case "asRecApp": if (A) { S.asMarcas[`${A.id}|${b.dataset.hora}`] = "recuperando"; render(); if (await guardarAsist()) toast(`${A.nombre} vino a recuperar`); } break;
    case "accesoCrear": if (A) openAcceso(A, "alumno"); break;
    case "avisoDeshacer": await deshacerAviso(b.dataset.av); break;
    case "profeCrear": openAcceso(null, "profe"); break;
    case "accClave": await claveNuevaPara(b.dataset.uid, A); break;
    case "telGSave": { const v = $("#cTelG").value.trim(); if (await safe(() => fdb.doc("config/general").set({ ...S.cfg, telGabriel: v }), "Guardado")) S.cfg = { ...S.cfg, telGabriel: v }; break; }
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
      recPendAvisos(ad).forEach(x => { if (x.id !== id) tx.update(fdb.doc("avisos/" + x.id), { contado: true }); });
      const otroRef = fdb.doc(`avisos/${d.alumnoId}_${d.fecha}_${d.hhmm}_${d.tipo === "ausencia" ? "recupera" : "ausencia"}`); const oS = await tx.get(otroRef);
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
