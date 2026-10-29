// Avisos al instante para Gabriel, y cambios de cuenta (usuario del alumno, contraseña nueva).
// La app del alumno llama a este Worker apenas avisa "no voy", reserva o vuelve a su clase.
// El Worker busca en Firestore los avisos todavía no notificados y le manda la notificación a Gabriel.
// Necesita el secreto FIREBASE_SA (el mismo .json de la cuenta de servicio que está en GitHub).
// Si algo falla, el proceso de GitHub (cada 10 min) los manda igual: nunca se pierde un aviso.

const ORIGENES = ["https://masterpadel360.github.io"];
const API_KEY = "AIzaSyC6XHhioDKvqnA7PD5Pu5xGXgtdgkiQglM"; // clave pública de la app (la misma que va en la página)
const DUENO = "gabohuppi22@gmail.com";
const DOMINIO = "clasespadel.app";
const LINK = "https://masterpadel360.github.io/clases-padel/";
const CLUB = { JUMP: "Jump", ESPACIO: "Espacio La 10" };
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export default {
  // Cada 10 minutos (Cloudflare sí respeta el horario): manda las lluvias pendientes y le pide a GitHub
  // que corra los recordatorios (GitHub solo, a veces los atrasa horas).
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try { if (env.FIREBASE_SA) await lluvias(env); } catch (e) { console.log("lluvias", e && e.stack || e); }
      if (env.GITHUB_TOKEN) {
        const r = await fetch("https://api.github.com/repos/masterpadel360/clases-padel/actions/workflows/notificaciones.yml/dispatches", {
          method: "POST", headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "avisos-clases", "Content-Type": "application/json" },
          body: JSON.stringify({ ref: "main" }) });
        if (!r.ok) console.log("GitHub", r.status, await r.text());
      }
    })());
  },
  async fetch(req, env, ctx) {
    const origin = req.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ORIGENES.includes(origin) ? origin : ORIGENES[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method === "GET") return new Response("Avisos al instante: funcionando", { headers: cors });
    if (req.method !== "POST") return new Response("", { status: 405, headers: cors });
    if (!env.FIREBASE_SA) return new Response("Falta el secreto FIREBASE_SA", { status: 500, headers: cors });
    const ruta = new URL(req.url).pathname;
    if (ruta === "/ia") {
      let r; try { r = await asistente(await req.json(), env); } catch (e) { console.log("ia", e && e.stack || e); r = { error: "El asistente no pudo responder. Probá de nuevo en un rato." }; }
      return new Response(JSON.stringify(r), { status: r.error ? 400 : 200, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (ruta === "/cuenta/usuario" || ruta === "/cuenta/clave") {
      let r; try { r = await cuenta(ruta, await req.json(), env); } catch (e) { console.log("cuenta", e && e.stack || e); r = { error: "No se pudo. Probá de nuevo." }; }
      return new Response(JSON.stringify(r), { status: r.error ? 400 : 200, headers: { ...cors, "Content-Type": "application/json" } });
    }
    ctx.waitUntil(procesar(env).catch(e => console.log("Error:", e && e.stack || e)));
    ctx.waitUntil(lluvias(env).catch(e => console.log("Lluvias:", e && e.stack || e)));
    ctx.waitUntil(pagos(env).catch(e => console.log("Pagos:", e && e.stack || e)));
    ctx.waitUntil(deProfes(env).catch(e => console.log("Profes:", e && e.stack || e)));
    ctx.waitUntil(ingresos(env).catch(e => console.log("Ingresos:", e && e.stack || e)));
    return new Response("ok", { headers: cors });
  },
};

async function procesar(env) {
  const sa = JSON.parse(env.FIREBASE_SA);
  const token = await accessToken(sa);
  const fs = firestore(sa.project_id, token);

  const desde = new Date(Date.now() - 6 * 3600e3).toISOString();
  const nuevos = (await fs.query("avisos", { fieldFilter: { field: { fieldPath: "creado" }, op: "GREATER_THAN_OR_EQUAL", value: { timestampValue: desde } } }))
    .filter(d => !d.data.notificado);
  if (!nuevos.length) return;

  // Reservamos cada aviso (lo marcamos notificado) antes de mandar, así no sale repetido.
  const tomados = [];
  for (const d of nuevos) if (await fs.marcar(d.name, d.updateTime)) tomados.push(d.data);
  if (!tomados.length) return;

  const ar = new Date(Date.now() - 3 * 3600e3);
  const hoy = ar.toISOString().slice(0, 10);
  const fechaTxt = f => { const d = new Date(`${f}T12:00:00-03:00`); return f === hoy ? "hoy" : `el ${DIAS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };
  const primerNombre = n => String(n || "").trim().split(/\s+/)[0].replace(/^./, c => c.toUpperCase());

  const todos = (await fs.query("avisos", { fieldFilter: { field: { fieldPath: "fecha" }, op: "GREATER_THAN_OR_EQUAL", value: { stringValue: hoy } } })).map(d => d.data);
  const toks = await fs.list("tokens");
  const staff = toks.filter(t => t.data.rol === "dueño" && Array.isArray(t.data.tokens));
  const profes = toks.filter(t => t.data.rol === "profe" && Array.isArray(t.data.tokens));
  if (!staff.length && !profes.length) return;

  const porAlumno = {};
  tomados.forEach(v => { (porAlumno[v.alumnoId] = porAlumno[v.alumnoId] || []).push(v); });
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
    const quienes = lista.some(v => v.club === "JUMP") ? [...staff, ...profes] : staff;
    for (const s of quienes) for (const t of s.data.tokens) await enviar(sa.project_id, token, t, { ...msg, tag: "aviso-" + lista[0].alumnoId });
  }
}

// Primer ingreso de un alumno a la app: le avisa a Gabriel.
async function ingresos(env) {
  const sa = JSON.parse(env.FIREBASE_SA);
  const token = await accessToken(sa);
  const fs = firestore(sa.project_id, token);
  const pend = await fs.query("ingresos", { fieldFilter: { field: { fieldPath: "notificado" }, op: "EQUAL", value: { booleanValue: false } } });
  if (!pend.length) return;
  const staff = (await fs.list("tokens")).filter(t => t.data.rol === "dueño" && Array.isArray(t.data.tokens));
  for (const d of pend) {
    if (!(await fs.marcar(d.name, d.updateTime))) continue;
    const n = String(d.data.nombre || "Un alumno").trim();
    for (const s of staff) for (const t of s.data.tokens) await enviar(sa.project_id, token, t, { title: `📱 ${n} entró a la app`, body: "Primera vez que inicia sesión. En Alumnos ves quiénes faltan.", tag: "ingreso-" + d.data.alumnoId });
  }
}

// Lo que hace Esteban (horas, faltas, recuperaciones): le llega a Gabriel al instante.
async function deProfes(env) {
  const sa = JSON.parse(env.FIREBASE_SA);
  const token = await accessToken(sa);
  const fs = firestore(sa.project_id, token);
  const pend = await fs.query("staffAvisos", { fieldFilter: { field: { fieldPath: "notificado" }, op: "EQUAL", value: { booleanValue: false } } });
  if (!pend.length) return;
  const staff = (await fs.list("tokens")).filter(t => t.data.rol === "dueño" && Array.isArray(t.data.tokens));
  for (const d of pend) {
    if (!(await fs.marcar(d.name, d.updateTime))) continue;
    for (const s of staff) for (const t of s.data.tokens) await enviar(sa.project_id, token, t, { title: d.data.titulo || "Aviso de Esteban", body: d.data.cuerpo || "", tag: "profe-" + d.name.split("/").pop() });
  }
}

// Pagos: apenas un alumno sube el comprobante, le llega a Gabriel (el mes lo marca pagado el proceso de cada 10 min y la app).
async function pagos(env) {
  const sa = JSON.parse(env.FIREBASE_SA);
  const token = await accessToken(sa);
  const fs = firestore(sa.project_id, token);
  const pend = (await fs.query("comprobantes", { fieldFilter: { field: { fieldPath: "notificado" }, op: "EQUAL", value: { booleanValue: false } } })).filter(d => !d.data.avisado && d.data.estado === "enviado");
  if (!pend.length) return;
  const staff = (await fs.list("tokens")).filter(t => t.data.rol === "dueño" && Array.isArray(t.data.tokens));
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  for (const d of pend) {
    if (!(await fs.marcar(d.name, d.updateTime, "avisado"))) continue;
    const c = d.data; const n = String(c.nombre || "").trim().split(/\s+/)[0].replace(/^./, x => x.toUpperCase());
    const mes = MESES[Number(String(c.mes).slice(5, 7)) - 1] || c.mes;
    const plata = "$" + Math.round(Number(c.monto) || 0).toLocaleString("es-AR");
    for (const s of staff) for (const t of s.data.tokens) await enviar(sa.project_id, token, t, { title: `${n} pagó ${mes} 💸`, body: `${plata} · subió el comprobante. Tocá 🧾 en su ficha para verlo.`, tag: "pago-" + c.alumnoId });
  }
}

// Lluvia: Gabriel suspende turnos desde el panel y a cada alumno le llega el aviso al instante.
async function lluvias(env) {
  const sa = JSON.parse(env.FIREBASE_SA);
  const token = await accessToken(sa);
  const fs = firestore(sa.project_id, token);
  const pend = await fs.query("lluvias", { fieldFilter: { field: { fieldPath: "notificado" }, op: "EQUAL", value: { booleanValue: false } } });
  if (!pend.length) return;
  const porAlumno = {};
  (await fs.list("tokens")).forEach(t => { if (t.data.rol === "alumno" && t.data.alumnoId && Array.isArray(t.data.tokens)) (porAlumno[t.data.alumnoId] = porAlumno[t.data.alumnoId] || []).push(...t.data.tokens); });
  const hoy = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  for (const d of pend) {
    if (!(await fs.marcar(d.name, d.updateTime))) continue;
    const l = d.data; const dd = new Date(`${l.fecha}T12:00:00-03:00`);
    const cuando = l.fecha === hoy ? "de hoy" : `del ${DIAS[dd.getUTCDay()]} ${dd.getUTCDate()}/${dd.getUTCMonth() + 1}`;
    for (const aid of l.alumnos || []) for (const t of porAlumno[aid] || [])
      await enviar(sa.project_id, token, t, { title: `🌧 Se suspendió tu clase ${cuando} ${l.hora}`, body: "Por lluvia. Te queda una clase para recuperar: reservala desde la app cuando quieras.", tag: "lluvia" });
  }
}

async function enviar(pid, token, destino, { title, body, tag }) {
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${pid}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { token: destino, data: { title, body, tag: tag || "", link: LINK }, webpush: { headers: { Urgency: "high", TTL: "7200" }, fcm_options: { link: LINK } } } }),
  });
  if (!r.ok) console.log("FCM", r.status, await r.text());
}

/* ---------- Firestore por REST ---------- */
function firestore(pid, token) {
  const base = `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents`;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  return {
    async query(col, where) {
      const r = await fetch(`${base}:runQuery`, { method: "POST", headers: h, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: col }], where } }) });
      const j = await r.json(); if (!r.ok) throw new Error("query " + JSON.stringify(j));
      return j.filter(x => x.document).map(x => ({ name: x.document.name, updateTime: x.document.updateTime, data: campos(x.document.fields) }));
    },
    async list(col) {
      const r = await fetch(`${base}/${col}?pageSize=300`, { headers: h });
      const j = await r.json(); if (!r.ok) throw new Error("list " + JSON.stringify(j));
      return (j.documents || []).map(d => ({ name: d.name, data: campos(d.fields) }));
    },
    async get(path) {
      const r = await fetch(`${base}/${path}`, { headers: h }); if (r.status === 404) return null;
      const j = await r.json(); if (!r.ok) throw new Error("get " + JSON.stringify(j)); return campos(j.fields);
    },
    async patch(path, datos) {
      const qs = Object.keys(datos).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
      const fields = {}; for (const [k, v] of Object.entries(datos)) fields[k] = { stringValue: String(v) };
      const r = await fetch(`${base}/${path}?${qs}`, { method: "PATCH", headers: h, body: JSON.stringify({ fields }) });
      if (!r.ok) throw new Error("patch " + await r.text());
    },
    async marcar(name, updateTime, campo = "notificado") {
      const r = await fetch(`https://firestore.googleapis.com/v1/${name}?updateMask.fieldPaths=${campo}&currentDocument.updateTime=${encodeURIComponent(updateTime)}`, {
        method: "PATCH", headers: h, body: JSON.stringify({ fields: { [campo]: { booleanValue: true } } }),
      });
      return r.ok;
    },
  };
}
function valor(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(valor);
  if ("mapValue" in v) return campos(v.mapValue.fields);
  return null;
}
function campos(f) { const o = {}; for (const k in (f || {})) o[k] = valor(f[k]); return o; }

/* ---------- Token de Google con la cuenta de servicio ---------- */
async function accessToken(sa) {
  const ahora = Math.floor(Date.now() / 1000);
  const b64 = s => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const head = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64(JSON.stringify({
    iss: sa.client_email, aud: "https://oauth2.googleapis.com/token", iat: ahora, exp: ahora + 3600,
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/identitytoolkit",
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claim}`));
  const jwt = `${head}.${claim}.${b64(String.fromCharCode(...new Uint8Array(firma)))}`;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const j = await r.json(); if (!j.access_token) throw new Error("token " + JSON.stringify(j));
  return j.access_token;
}

/* ---------- Cuentas: el alumno cambia su usuario; Gabriel le pone una contraseña nueva ---------- */
async function quienEs(idToken) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
  const j = await r.json(); return r.ok && j.users && j.users[0] ? j.users[0] : null;
}
async function adminActualizar(pid, token, datos) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${pid}/accounts:update`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(datos) });
  const j = await r.json(); if (!r.ok) { const m = (j.error && j.error.message) || ""; return m.includes("EMAIL_EXISTS") ? "existe" : m || "error"; } return "ok";
}
async function cuenta(ruta, body, env) {
  const yo = body && body.idToken ? await quienEs(body.idToken) : null;
  if (!yo) return { error: "Tu sesión venció. Salí y volvé a entrar." };
  const sa = JSON.parse(env.FIREBASE_SA); const token = await accessToken(sa); const fs = firestore(sa.project_id, token);
  if (ruta === "/cuenta/usuario") {
    const usuario = String(body.usuario || "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._]{2,23}$/.test(usuario)) return { error: "El usuario tiene que tener de 3 a 24 letras o números (podés usar puntos), sin espacios ni tildes." };
    const perfil = await fs.get(`usuarios/${yo.localId}`); if (!perfil || !["alumno", "profe"].includes(perfil.rol)) return { error: "Tu usuario no tiene acceso." };
    if (perfil.usuario === usuario) return { ok: true, usuario };
    const r = await adminActualizar(sa.project_id, token, { localId: yo.localId, email: `${usuario}@${DOMINIO}` });
    if (r === "existe") return { error: "Ese usuario ya lo usa otra persona. Probá con otro." };
    if (r !== "ok") return { error: "No se pudo cambiar. Probá de nuevo." };
    await fs.patch(`usuarios/${yo.localId}`, { usuario });
    if (perfil.alumnoId) await fs.patch(`alumnos/${perfil.alumnoId}`, { usuario });
    return { ok: true, usuario };
  }
  // Contraseña nueva: solo Gabriel, para un alumno o profe.
  if ((yo.email || "").toLowerCase() !== DUENO || !yo.emailVerified) return { error: "Solo Gabriel puede hacer esto." };
  const uid = String(body.uid || ""), clave = String(body.clave || "");
  if (clave.length < 6) return { error: "La contraseña tiene que tener al menos 6 caracteres." };
  const perfil = uid && await fs.get(`usuarios/${uid}`); if (!perfil || !["alumno", "profe"].includes(perfil.rol)) return { error: "No encontré ese acceso." };
  const r = await adminActualizar(sa.project_id, token, { localId: uid, password: clave });
  if (r !== "ok") return { error: "No se pudo cambiar la contraseña. Probá de nuevo." };
  return { ok: true, usuario: perfil.usuario };
}

/* ---------- Asistente con IA para los alumnos (botón flotante de la app) ----------
 * Necesita el secreto ANTHROPIC_API_KEY en el Worker (la clave de console.anthropic.com).
 * Solo responde a alumnos logueados, con un límite de mensajes por día para cuidar el gasto.
 * La IA no toca nada de la app: solo explica y responde con los datos del propio alumno.
 * Lo que sabe el asistente (las reglas) se lee del archivo asistente-reglas.txt de GitHub,
 * así se puede cambiar sin volver a pegar este código. Si GitHub no responde, usa el texto REGLAS de acá abajo.
 */
const REGLAS_URL = "https://raw.githubusercontent.com/masterpadel360/clases-padel/main/asistente-reglas.txt";
async function reglasActuales() {
  try {
    const r = await fetch(REGLAS_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (r.ok) { const t = (await r.text()).trim(); if (t.length > 200) return t; }
  } catch (e) { console.log("reglas", e && e.message); }
  return REGLAS;
}
const IA_MODELO = "claude-haiku-5-5";
const IA_LIMITE_DIA = 30; // mensajes por alumno por día

const REGLAS = `Sos el asistente de "Clases de Pádel", la app de los alumnos de Gabriel (profe de pádel en Córdoba, Argentina).
Ayudás a los alumnos con dudas sobre sus clases, faltas, recuperaciones, pagos y cómo usar la app.

CÓMO HABLÁS
- Español de Argentina, con voseo, cálido y cercano pero breve: 1 a 4 oraciones. Nada de listas largas.
- Usá **negrita** solo para lo más importante (una fecha, un monto, un botón).
- Respondés solo sobre las clases de pádel y la app. Si te preguntan otra cosa, decí amablemente que solo podés ayudar con las clases.

LO QUE NO HACÉS
- No inventás nada. Si un dato no está en la información del alumno o en estas reglas, decí que no lo sabés y que le escriba a Gabriel con el botón "Hablar con Gabriel".
- No hacés cambios: no podés reservar, cancelar ni pagar. Explicás cómo hacerlo en la app.
- No prometés excepciones, descuentos ni favores. Esas cosas las decide Gabriel.
- Nunca hablás del nivel o categoría del alumno ni de otros alumnos. Si preguntan, decí que los horarios que le muestra la app son "los que se ajustan a tu nivel".
- Si el alumno está enojado, tiene un problema con un pago o algo que no podés resolver, sugerí hablar con Gabriel.

REGLAS DE LAS CLASES
- Las clases son de lunes a viernes, en dos clubes: Jump y Espacio La 10.
- Si no podés ir a una clase, avisás desde la app con 24 horas o más de anticipación y te queda para recuperar. Tenés 2 semanas para recuperarla; si no, se pierde.
- Si avisás con menos de 24 horas, o no avisás, la clase se pierde.
- Para saber si un alumno llega a avisar a tiempo, usá SIEMPRE las horas que faltan que vienen calculadas en su información ("faltan X h"). Nunca restes fechas ni horas vos.
- Una recuperación reservada funciona igual que una clase fija: si avisás con 24 h o más que no vas, la podés volver a recuperar; con menos de 24 h se pierde.
- La recuperación la usa el mismo alumno: no se puede mandar a otra persona en tu lugar.
- Recuperás solo en el club donde entrenás (si entrenás en los dos, en cualquiera de los dos), en los horarios que te muestra la app, que son los que se ajustan a tu nivel.
- Las clases no se descuentan de la cuota: se recuperan.
- Las clases que se venían debiendo de antes de noviembre 2026 se pueden recuperar durante todo noviembre.
- Si entrenás 2 horas el mismo día, cuentan como 2 clases.

LLUVIA
- Si se suspende una clase por lluvia, te llega un aviso y te queda para recuperar.
- El mes se paga completo porque se te guarda el lugar. Solo en casos extremos (si la lluvia impide dar clase dos semanas seguidas) se descuentan clases.

PAGOS
- Desde noviembre 2026 se paga por la app, del 1 al 14 de cada mes. Después del 14 la cuota queda vencida.
- Cómo pagar: transferís al alias, en la app tocás "Pagar ahora", subís la foto o captura del comprobante y tocás Pagar. El mes queda pagado en verde.
- La cuota es el precio por clase por la cantidad de clases del mes. Si alguien empieza a mitad de mes, paga solo las clases que le quedan.

CÓMO SE USA LA APP
- Inicio: tu próxima clase. Para avisar que no vas, deslizás "Deslizá si no podés ir" o tocás "No voy" en el detalle de la clase.
- En Inicio, la sección "Recuperá" muestra los horarios libres para vos: tocás uno y queda reservado.
- Pestaña Ausencias: tus faltas y avisos. Pestaña Pagos: tus cuotas y comprobantes.
- Mi cuenta (el círculo con tu inicial, arriba): cambiar usuario y activar notificaciones.
- Las notificaciones te avisan el día de tu clase y si hay cambios. En iPhone primero hay que agregar la app a la pantalla de inicio (Compartir → Agregar a inicio).
- Si una cuenta maneja a más de un alumno de la familia, se elige cuál ver en la barra de arriba.`;

async function asistente(body, env) {
  if (!env.ANTHROPIC_API_KEY) return { error: "El asistente todavía no está activado. Escribile a Gabriel." };
  const yo = body && body.idToken ? await quienEs(body.idToken) : null;
  if (!yo) return { error: "Tu sesión venció. Salí y volvé a entrar." };
  const sa = JSON.parse(env.FIREBASE_SA); const token = await accessToken(sa); const fs = firestore(sa.project_id, token);
  const perfil = await fs.get(`usuarios/${yo.localId}`);
  if (!perfil || perfil.rol !== "alumno") return { error: "El asistente es para alumnos." };

  // Los mensajes de la charla (los últimos 12) y lo que la app sabe del alumno.
  const msgs = (Array.isArray(body.mensajes) ? body.mensajes : []).slice(-12)
    .map(m => ({ role: m && m.role === "assistant" ? "assistant" : "user", content: String((m && m.content) || "").slice(0, 1000).trim() }))
    .filter(m => m.content);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return { error: "Escribí tu pregunta." };
  const datos = String(body.contexto || "").slice(0, 6000);

  // Límite por día (hora de Argentina).
  const hoy = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const uso = await fs.get(`iaUso/${yo.localId}`);
  const n = uso && uso.fecha === hoy ? Number(uso.n) || 0 : 0;
  if (n >= IA_LIMITE_DIA) return { error: "Llegaste al límite de preguntas de hoy. Mañana podés seguir, o escribile a Gabriel." };
  await fetch(`https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/iaUso/${yo.localId}`, {
    method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { fecha: { stringValue: hoy }, n: { integerValue: String(n + 1) }, alumnoId: { stringValue: String(perfil.alumnoId || "") } } }),
  });

  const ar = new Date(Date.now() - 3 * 3600e3);
  const ahora = `${DIAS[ar.getUTCDay()]} ${ar.getUTCDate()}/${ar.getUTCMonth() + 1}/${ar.getUTCFullYear()}, ${String(ar.getUTCHours()).padStart(2, "0")}:${String(ar.getUTCMinutes()).padStart(2, "0")}`;
  const system = `${await reglasActuales()}\n\nFECHA Y HORA ACTUAL: ${ahora} (hora de Argentina).\n\nINFORMACIÓN DEL ALUMNO QUE TE ESCRIBE (sacada de la app; usala para responder):\n${datos || "(no llegó información)"}`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: IA_MODELO, max_tokens: 600, system, messages: msgs }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.log("Anthropic", r.status, JSON.stringify(j)); return { error: "El asistente no pudo responder. Probá de nuevo en un rato." }; }
  const texto = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").trim();
  return { ok: true, respuesta: texto || "Perdón, no te entendí. ¿Me lo decís de otra forma?", quedan: IA_LIMITE_DIA - n - 1 };
}
