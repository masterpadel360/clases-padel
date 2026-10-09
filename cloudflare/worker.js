// Avisos al instante para Gabriel.
// La app del alumno llama a este Worker apenas avisa "no voy", reserva o vuelve a su clase.
// El Worker busca en Firestore los avisos todavía no notificados y le manda la notificación a Gabriel.
// Necesita el secreto FIREBASE_SA (el mismo .json de la cuenta de servicio que está en GitHub).
// Si algo falla, el proceso de GitHub (cada 10 min) los manda igual: nunca se pierde un aviso.

const ORIGENES = ["https://masterpadel360.github.io"];
const LINK = "https://masterpadel360.github.io/clases-padel/";
const CLUB = { JUMP: "Jump", ESPACIO: "Espacio La 10" };
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export default {
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
    ctx.waitUntil(procesar(env).catch(e => console.log("Error:", e && e.stack || e)));
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
  const staff = (await fs.list("tokens")).filter(t => t.data.rol === "dueño" && Array.isArray(t.data.tokens));
  if (!staff.length) return;

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
    for (const s of staff) for (const t of s.data.tokens) await enviar(sa.project_id, token, t, { ...msg, tag: "aviso-" + lista[0].alumnoId });
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
    async marcar(name, updateTime) {
      const r = await fetch(`https://firestore.googleapis.com/v1/${name}?updateMask.fieldPaths=notificado&currentDocument.updateTime=${encodeURIComponent(updateTime)}`, {
        method: "PATCH", headers: h, body: JSON.stringify({ fields: { notificado: { booleanValue: true } } }),
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
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging",
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
