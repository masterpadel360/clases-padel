/* ---------- Conexión con Firebase, login y arranque ---------- */
const DOMINIO_USUARIOS = "clasespadel.app";
const LINK_APP = location.origin + location.pathname.replace(/index\.html$/, "");
let fdb = null, fauth = null;

const usuarioAEmail = u => { u = String(u || "").trim().toLowerCase(); return u.includes("@") ? u : `${u.replace(/[^a-z0-9._-]/g, "")}@${DOMINIO_USUARIOS}`; };
const slugUsuario = n => String(n || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 24) || "alumno";
const claveNueva = () => String(Math.floor(100000 + Math.random() * 900000));

// Descargas (CSV) en el navegador
const DESCARGAS = { save({ filename, data }) { const blob = new Blob([data], { type: "text/csv;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); return Promise.resolve(); } };

// Crea un usuario (alumno o profe) sin cerrar la sesión de Gabriel: usa una segunda conexión.
async function crearCuenta(usuario, clave) {
  const sec = firebase.apps.find(a => a.name === "alta") || firebase.initializeApp(window.FIREBASE_CONFIG, "alta");
  const sa = sec.auth();
  try { await sa.setPersistence(firebase.auth.Auth.Persistence.NONE); } catch (e) {}
  const cred = await sa.createUserWithEmailAndPassword(usuarioAEmail(usuario), clave);
  const uid = cred.user.uid; await sa.signOut(); return uid;
}
function errorAuth(e) {
  const c = e && e.code || "";
  if (c === "auth/email-already-in-use") return "Ese usuario ya existe. Probá con otro.";
  if (c === "auth/weak-password") return "La contraseña tiene que tener al menos 6 caracteres.";
  if (c === "auth/invalid-email") return "El usuario tiene caracteres raros. Usá letras, números y puntos.";
  if (["auth/wrong-password", "auth/user-not-found", "auth/invalid-credential", "auth/invalid-login-credentials"].includes(c)) return "Usuario o contraseña incorrectos.";
  if (c === "auth/too-many-requests") return "Demasiados intentos. Esperá unos minutos.";
  if (c === "auth/network-request-failed") return "Sin conexión. Revisá internet.";
  return "Algo falló. Probá de nuevo.";
}

/* ---------- Pantallas de entrada ---------- */
let msgLogin = "";
function pantalla(html) {
  ["staffApp", "portal"].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = true; });
  const l = document.getElementById("login"); l.hidden = false; l.innerHTML = html;
}
function mostrarLogin(modo = "entrar") {
  const dueño = modo === "dueño";
  pantalla(`<div class="login-card">
    <div class="login-brand"><span class="wm">Clases de Pádel</span><span class="wm-sub">Jump · Espacio</span></div>
    <h2 class="disp">${dueño ? "Crear tu cuenta" : "Entrar"}</h2>
    ${dueño ? `<p class="small muted" style="margin:0">Solo para Gabriel, la primera vez. Usá tu mail ${esc(window.OWNER_EMAIL)}.</p>` : ""}
    <form id="fLogin" data-modo="${modo}" style="display:grid;gap:12px">
      <div class="field"><label for="lgU">${dueño ? "Mail" : "Usuario"}</label><input id="lgU" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" ${dueño ? `type="email" value="${esc(window.OWNER_EMAIL)}"` : ""} required></div>
      <div class="field"><label for="lgP">Contraseña</label><input id="lgP" type="password" autocomplete="${dueño ? "new-password" : "current-password"}" required minlength="6"></div>
      <p class="small" id="lgErr" style="margin:0;color:var(--warn);min-height:1em">${esc(msgLogin)}</p>
      <button class="btn pri" id="lgBtn">${dueño ? "Crear cuenta" : "Entrar"}</button>
    </form>
    <button class="linkish" id="lgSwitch" style="justify-self:center">${dueño ? "Ya tengo cuenta" : "Soy Gabriel y es la primera vez"}</button>
  </div>`);
  msgLogin = "";
  document.getElementById("lgSwitch").onclick = () => mostrarLogin(dueño ? "entrar" : "dueño");
  document.getElementById("fLogin").onsubmit = async e => {
    e.preventDefault();
    const u = document.getElementById("lgU").value, p = document.getElementById("lgP").value, err = document.getElementById("lgErr"), btn = document.getElementById("lgBtn");
    err.textContent = ""; btn.disabled = true; btn.textContent = "Un segundo…";
    try {
      if (dueño) {
        if (u.trim().toLowerCase() !== window.OWNER_EMAIL) { err.textContent = "Esta opción es solo para la cuenta de Gabriel."; return; }
        const c = await fauth.createUserWithEmailAndPassword(u.trim(), p);
        await c.user.sendEmailVerification();
      } else {
        await fauth.signInWithEmailAndPassword(usuarioAEmail(u), p);
      }
    } catch (x) { err.textContent = errorAuth(x); }
    finally { btn.disabled = false; btn.textContent = dueño ? "Crear cuenta" : "Entrar"; }
  };
}
function mostrarVerificar(u) {
  pantalla(`<div class="login-card">
    <div class="login-brand"><span class="wm">Clases de Pádel</span><span class="wm-sub">Confirmá tu mail</span></div>
    <h2 class="disp">Revisá tu mail</h2>
    <p class="small" style="margin:0">Te mandé un mail a <b>${esc(u.email)}</b>. Abrilo, tocá el link para confirmar y volvé acá. (Si no aparece, mirá en Spam o Promociones.)</p>
    <button class="btn pri" id="vfOk">Ya lo confirmé</button>
    <p class="small" id="vfErr" style="margin:0;color:var(--warn);min-height:1em"></p>
    <div style="display:flex;gap:14px;justify-content:center"><button class="linkish" id="vfRe">Reenviar mail</button><button class="linkish" id="vfOut">Salir</button></div>
  </div>`);
  document.getElementById("vfOk").onclick = async () => { await u.reload(); if (fauth.currentUser.emailVerified) { await fauth.currentUser.getIdToken(true); location.reload(); } else document.getElementById("vfErr").textContent = "Todavía figura sin confirmar. Tocá el link del mail y probá de nuevo."; };
  document.getElementById("vfRe").onclick = async () => { try { await u.sendEmailVerification(); document.getElementById("vfErr").textContent = "Listo, te lo mandé de nuevo."; } catch (e) { document.getElementById("vfErr").textContent = errorAuth(e); } };
  document.getElementById("vfOut").onclick = () => fauth.signOut();
}
function mostrarFaltaConfig() {
  pantalla(`<div class="login-card"><div class="login-brand"><span class="wm">Clases de Pádel</span></div><h2 class="disp">Casi lista</h2><p class="small" style="margin:0">Falta conectar la base de datos. En cuanto Gabriel pase los datos de Firebase, esta página empieza a funcionar.</p></div>`);
}
async function salir() { try { await fauth.signOut(); } catch (e) {} location.reload(); }

/* ---------- Arranque ---------- */
(function arrancar() {
  if (!window.FIREBASE_CONFIG) { mostrarFaltaConfig(); return; }
  firebase.initializeApp(window.FIREBASE_CONFIG);
  fdb = firebase.firestore();
  fdb.settings({ ignoreUndefinedProperties: true, merge: true });
  fdb.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  // En esta app "update" significa "mezclar campos" (crea el documento si no existe).
  firebase.firestore.DocumentReference.prototype.update = function (d) { return this.set(d, { merge: true }); };
  fauth = firebase.auth();
  pantalla(`<div class="login-card" style="text-align:center"><span class="small muted">Cargando…</span></div>`);
  fauth.onAuthStateChanged(async u => {
    if (!u) { mostrarLogin(); return; }
    const email = (u.email || "").toLowerCase();
    if (email === window.OWNER_EMAIL) {
      if (!u.emailVerified) { mostrarVerificar(u); return; }
      return iniciarStaff({ rol: "dueño", nombre: "Gabriel" }, u);
    }
    let p = null;
    try { const d = await fdb.doc("usuarios/" + u.uid).get(); p = d.exists ? d.data() : null; } catch (e) { p = null; }
    if (!p || !["profe", "alumno"].includes(p.rol)) { msgLogin = "Este usuario no tiene acceso. Pedile a Gabriel que te lo active."; await fauth.signOut(); return; }
    if (p.rol === "profe") return iniciarStaff(p, u);
    return iniciarPortal(p, u);
  });
})();

/* ---------- Gabriel y profes ---------- */
let ultTurnos = "", ultInfo = "", tTurnos = null;
function publicarTurnos() {
  clearTimeout(tTurnos);
  tTurnos = setTimeout(() => {
    const t = {};
    turnos("").forEach(x => { t[`${x.club}|${x.dia}|${x.hora}`] = { n: x.al.length, nivel: x.nivel || "" }; });
    const j = JSON.stringify(t); if (j === ultTurnos) return; ultTurnos = j;
    fdb.doc("publico/turnos").set({ t, actualizado: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => { ultTurnos = ""; });
  }, 1200);
}
function publicarInfo() {
  if (!S.esOwner) return;
  const info = { alias: S.cfg.alias || "", telGabriel: S.cfg.telGabriel || "", cupo: CUPO };
  const j = JSON.stringify(info); if (j === ultInfo) return; ultInfo = j;
  fdb.doc("publico/info").set(info).catch(() => { ultInfo = ""; });
}
function nombresEquipo() {
  S.nombres = {}; S.usuarios.forEach(u => { if (u.rol === "profe") S.nombres[u.id] = u.nombre || ""; });
}

async function iniciarStaff(perfil, u) {
  window.MODO_STAFF = true;
  document.getElementById("login").hidden = true; document.getElementById("staffApp").hidden = false;
  const db = fdb; S.db = db; S.downloads = DESCARGAS; S.perfil = perfil; S.uid = u.uid; S.user = null;
  S.esOwner = perfil.rol === "dueño";
  if (!S.esOwner) { S.modo = "profe"; S.tab = "horas"; }
  const vis = () => { if ($("#overlay").hidden) render(); };
  render();
  if (!S.esOwner) {
    db.doc("horas/" + S.uid).onSnapshot(d => { if (hPend > 0) return; S.horas = { ...((d.exists && d.data().dias) || {}) }; S.hVal = { ...((d.exists && d.data().valores) || {}) }; S.hMovs = [...((d.exists && d.data().movs) || [])]; vis(); }, () => {});
    db.doc("finanzas/" + S.uid).onSnapshot(d => { if (fPend > 0) return; S.fin = [...((d.exists && d.data().movs) || [])]; vis(); }, () => {});
  }
  { const d = new Date(now); d.setDate(d.getDate() - 8);
    db.collection("asistencia").where("fecha", ">=", toISO(d)).onSnapshot(snap => { S.asHist = {}; snap.docs.forEach(x => { const v = x.data(); if (v.club === "JUMP") S.asHist[v.fecha] = { ...(v.marcas || {}) }; }); vis(); }, () => {}); }
  { const d = new Date(now); d.setDate(d.getDate() - 45);
    db.collection("avisos").where("fecha", ">=", toISO(d)).onSnapshot(snap => { S.avisos = snap.docs.map(x => ({ id: x.id, ...x.data() })); vis(); }, () => {}); }
  if (S.esOwner) {
    db.collection("usuarios").onSnapshot(snap => { S.usuarios = snap.docs.map(x => ({ id: x.id, ...x.data() })); nombresEquipo(); vis(); }, () => {});
    db.collection("finanzas").onSnapshot(snap => { if (fPend > 0) return; S.finEq = {}; snap.docs.forEach(d => S.finEq[d.id] = [...(d.data().movs || [])]); if (S.equipo[0]) S.fin = [...(S.finEq[S.equipo[0].id] || [])]; vis(); }, () => {});
    db.collection("horas").onSnapshot(snap => { if (hPend > 0) return;
      S.equipo = snap.docs.map(d => ({ id: d.id, dias: { ...(d.data().dias || {}) }, valores: { ...(d.data().valores || {}) }, movs: [...(d.data().movs || [])] }));
      if (S.equipo[0]) { S.fin = [...(S.finEq[S.equipo[0].id] || [])]; S.horas = { ...S.equipo[0].dias }; S.hVal = { ...S.equipo[0].valores }; S.hMovs = [...S.equipo[0].movs]; }
      vis(); }, () => {});
    db.collection("interesados").onSnapshot(snap => { S.leads = snap.docs.map(d => ({ id: d.id, ...d.data() })); S.loaded.l = true; vis(); }, () => {});
  }
  db.collection("alumnos").onSnapshot(snap => { S.alumnos = snap.docs.map(d => ({ id: d.id, ...d.data() })); S.loaded.a = true; S.dbState = "ok"; publicarTurnos(); vis(); }, e => { console.error(e); S.dbState = "sin-db"; render(); });
  db.doc("config/general").onSnapshot(d => { S.cfg = d.exists ? d.data() : {}; publicarInfo(); }, () => {});
}
