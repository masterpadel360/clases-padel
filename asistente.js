/* ---------- Asistente con IA (botón flotante en la app del alumno y en el panel de profes) ----------
 * En el panel (Gabriel y Esteban) está siempre. Para los alumnos se prende con window.ASISTENTE en config.js.
 * El alumno toca el botón, escribe su duda y responde la IA a través del servidor de Cloudflare (ruta /ia).
 * La clave de la IA vive solo en el servidor. Acá se arma un resumen con los datos del propio alumno
 * (clases, faltas, recuperaciones, cuota) para que la respuesta sea sobre su caso. Nunca se manda la categoría.
 */
(function () {
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const SUG_STAFF = ["¿Quién faltó esta semana sin avisar?", "¿Qué clases se suspendieron por lluvia este mes?", "¿Quiénes tienen clases para recuperar?", "Armame un mensaje para avisar que se suspende por lluvia"];
  const SUGERENCIAS = ["¿Cuántas clases tengo para recuperar?", "¿Hasta cuándo pago este mes?", "¿Cómo aviso que no voy?", "¿Qué pasa si llueve?"];
  const club = c => c === "ESPACIO" ? "Espacio La 10" : "Jump";
  const fechaTx = f => { const d = new Date(`${f}T12:00:00-03:00`); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };
  const escH = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const formato = s => escH(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  const intentar = (f, d = "") => { try { return f(); } catch (e) { return d; } };

  let abierto = false, enviando = false, msgs = [], idAl = null, activoAlumnos = false;
  const vis = id => { const el = document.getElementById(id); return el && !el.hidden; };
  // En qué pantalla estamos: app del alumno o panel de profes.
  function modo() {
    if (vis("staffApp") && typeof S !== "undefined" && S.loaded && S.loaded.a) return "staff";
    if (activoAlumnos && vis("portal") && typeof P !== "undefined" && P.a) return "alumno";
    return null;
  }
  const KEY = () => "asistente_" + idAl;
  const guardar = () => { try { sessionStorage.setItem(KEY(), JSON.stringify(msgs.slice(-20))); } catch (e) {} };
  const cargar = () => { try { msgs = JSON.parse(sessionStorage.getItem(KEY()) || "[]"); } catch (e) { msgs = []; } };

  // Resumen de la situación del alumno, en texto simple para la IA.
  function contexto() {
    const a = P.a; if (!a) return "";
    const L = [];
    const ah = new Date(Date.now() - 3 * 3600e3);
    L.push(`AHORA ES: ${DIAS[ah.getUTCDay()]} ${ah.getUTCDate()}/${ah.getUTCMonth() + 1} a las ${String(ah.getUTCHours()).padStart(2, "0")}:${String(ah.getUTCMinutes()).padStart(2, "0")} (hora de Argentina). Las horas que faltan para cada clase ya están calculadas abajo: usalas tal cual, no las calcules vos.`);
    L.push(`Nombre: ${a.nombre || ""}`);
    L.push(`Club(es): ${intentar(() => [...clubsDe(a)].map(club).join(" y "), "")}`);
    const hs = (a.horarios || []).map(h => `${DIAS[h.dia]} ${h.hora} en ${club(intentar(() => clubH(a, h), a.club))}`);
    if (hs.length) L.push(`Horarios fijos: ${hs.join("; ")}`);
    if (a.inicio) L.push(`Empezó el ${fechaTx(a.inicio)}`);

    const prox = intentar(() => misClases(21), []).slice(0, 10).map(c => {
      let e = c.tipo === "recupera" ? "recuperación reservada" : "clase fija";
      if (c.susp) e += " · SUSPENDIDA"; else if (c.aus) e += c.aus.conRecupero ? " · avisó que no va (le queda para recuperar)" : " · avisó tarde que no va (no recupera)";
      if (c.vuelve) e += " · confirmó que va";
      // La cuenta de horas la hace la app (la IA se equivoca restando fechas).
      if (!c.susp && !c.aus && !c.vuelve) {
        const hs = Math.floor((inicioDe(c.fecha, c.hora).getTime() - Date.now()) / 3600e3);
        e += hs >= 24 ? ` · faltan ${hs} h: si avisa ahora que no va, LA PUEDE RECUPERAR` : ` · faltan menos de 24 h (${Math.max(hs, 0)} h): si avisa ahora que no va, LA PIERDE`;
      }
      return `${fechaTx(c.fecha)} ${c.hora} en ${club(c.club)} (${e})`;
    });
    L.push(prox.length ? `Próximas clases:\n- ${prox.join("\n- ")}` : "Próximas clases: ninguna en las próximas 3 semanas");

    const bk = intentar(() => recAl(), []); const n = bk.reduce((s, x) => s + x.n, 0);
    L.push(n ? `Clases para recuperar: ${n} (${bk.map(x => `${x.n} hasta el ${fechaTx(x.vence)}`).join(", ")})` : "Clases para recuperar: ninguna");
    if (n) {
      const ops = intentar(() => opcionesRec(), []).slice(0, 8).map(o => `${fechaTx(o.fecha)} ${o.hora} en ${club(o.club)} (${o.libres} ${o.libres === 1 ? "lugar" : "lugares"})`);
      L.push(ops.length ? `Horarios libres para recuperar (se reservan en Inicio → Recuperá):\n- ${ops.join("\n- ")}` : "Horarios libres para recuperar: ninguno por ahora");
    }

    const faltas = intentar(() => misAsistencias(), []).filter(x => x.estado !== "vino").slice(0, 6)
      .map(x => `${fechaTx(x.fecha)} ${x.hora}: ${{ falto: "faltó sin avisar", recupera: "avisó, recupera", recuperando: "fue a recuperar", lluvia: "suspendida por lluvia" }[x.estado] || x.estado}`);
    if (faltas.length) L.push(`Últimas novedades de asistencia:\n- ${faltas.join("\n- ")}`);

    const mes = mesKey(now); const mesTx = MESES[Number(mes.slice(5, 7)) - 1];
    const est = intentar(() => estPago(a, mes), "");
    const monto = intentar(() => montoMes(a, mes), 0); const ncl = intentar(() => clasesMes(a, mes), 0);
    L.push(`Cuota de ${mesTx}: ${{ pagado: "PAGADA", vencido: "VENCIDA", rechazado: "comprobante rechazado, tiene que volver a mandarlo", pendiente: "pendiente" }[est] || est}${monto ? `, ${money(monto)}` : ""}${ncl ? ` (${ncl} clases)` : ""}${intentar(() => conPlazo(mes), false) ? `, se paga hasta el ${pagoVence(mes)}` : ", este mes lo arregla directo con Gabriel (desde noviembre 2026 se paga por la app)"}`);
    const deuda = intentar(() => mesesPago().filter(m => m !== mes && estPago(a, m) !== "pagado"), []);
    if (deuda.length) L.push(`Meses anteriores sin pagar: ${deuda.map(m => MESES[Number(m.slice(5, 7)) - 1] + " " + m.slice(0, 4)).join(", ")}`);
    if (P.info && P.info.alias) L.push(`Alias para transferir: ${P.info.alias}`);
    return L.join("\n");
  }

  // Resumen para Gabriel o Esteban: alumnos, asistencia de las últimas 5 semanas, avisos y lluvias.
  async function contextoStaff() {
    const profe = S.modo === "profe"; const ok = c => !profe || c === "JUMP";
    const L = []; const ah = new Date(Date.now() - 3 * 3600e3);
    L.push(`AHORA ES: ${DIAS[ah.getUTCDay()]} ${ah.getUTCDate()}/${ah.getUTCMonth() + 1}/${ah.getUTCFullYear()} a las ${String(ah.getUTCHours()).padStart(2, "0")}:${String(ah.getUTCMinutes()).padStart(2, "0")} (hora de Argentina).`);
    L.push(profe ? "TE ESCRIBE: Esteban, profe de Jump. Solo ve los datos de Jump. No le hables de pagos ni de cuotas de los alumnos, ni de Espacio La 10." : "TE ESCRIBE: Gabriel, el dueño. Ve todo: los dos clubes, pagos y cuotas.");
    const nom = id => ((S.alumnos || []).find(a => a.id === id) || {}).nombre || "alumno";
    const mes = mesKey(now); const mesTx = MESES[Number(mes.slice(5, 7)) - 1];
    const als = (S.alumnos || []).filter(a => a.activo !== false && intentar(() => [...clubsDe(a)].some(ok), true));
    L.push(`\nALUMNOS ACTIVOS (${als.length}):`);
    als.sort((x, y) => String(x.nombre).localeCompare(String(y.nombre))).forEach(a => {
      const p = [a.nombre || "?"];
      p.push((a.horarios || []).filter(h => ok(intentar(() => clubH(a, h), a.club))).map(h => `${DIAS[h.dia].slice(0, 3)} ${h.hora} ${club(intentar(() => clubH(a, h), a.club))}`).join(", ") || "sin horario fijo");
      if (a.categoria) p.push(`categoría ${a.categoria}`);
      const rec = intentar(() => recVenceTxt(a), ""); if (rec) p.push(`para recuperar: ${rec}`);
      if (intentar(() => esNuevo(a), false)) p.push(`NUEVO, arrancó el ${fechaTx(arranqueDe(a))}`);
      if (!profe && mes >= "2026-11") {
        const pg = (a.pagos || {})[mes] || {}; const monto = intentar(() => montoMes(a, mes), 0);
        p.push(`cuota ${mesTx}: ${pg.pagado ? "PAGADA" : now.getDate() > 14 ? "VENCIDA" : "pendiente"}${monto ? " " + money(monto) : ""}`);
      }
      L.push("- " + p.join(" | "));
    });
    // Asistencia marcada (últimas 5 semanas).
    const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 35); let as = [];
    try { const q = await S.db.collection("asistencia").where("fecha", ">=", toISO(d0)).get(); as = q.docs.map(d => d.data()).filter(v => ok(v.club)); } catch (e) {}
    const EST = { falto: "faltó sin avisar", recupera: "avisó que no iba (recupera)", recuperando: "vino a recuperar", lluvia: "suspendida por lluvia" };
    L.push("\nASISTENCIA TOMADA (últimas 5 semanas, de la más nueva a la más vieja). Lo que no figura es porque no se marcó:");
    as.sort((x, y) => String(y.fecha).localeCompare(String(x.fecha))).forEach(v => {
      const mk = v.marcas || {}; const g = {}; let vinieron = 0;
      Object.keys(mk).forEach(k => { const [id, h] = k.split("|"); if (mk[k] === "vino") { vinieron++; return; } (g[mk[k]] = g[mk[k]] || []).push(`${nom(id)} ${h}`); });
      const partes = Object.keys(g).map(e => `${EST[e] || e}: ${g[e].join(", ")}`);
      L.push(`- ${fechaTx(v.fecha)} ${club(v.club)}: vinieron ${vinieron}${partes.length ? "; " + partes.join("; ") : ""}`);
    });
    if (!as.length) L.push("- (no hay asistencia marcada en estas semanas)");
    // Avisos de los alumnos desde la app (faltas avisadas y recuperaciones reservadas).
    const av = (S.avisos || []).filter(v => ok(v.club)).sort((x, y) => (y.fecha + y.hora).localeCompare(x.fecha + x.hora)).slice(0, 200);
    L.push("\nAVISOS DESDE LA APP (faltas avisadas y recuperaciones reservadas, últimas semanas y próximas):");
    av.forEach(v => L.push(`- ${fechaTx(v.fecha)} ${v.hora} ${club(v.club)}: ${v.nombre || nom(v.alumnoId)} ${v.tipo === "ausencia" ? (v.conRecupero ? "avisó que no va (le queda para recuperar)" : "avisó tarde que no va (no recupera)") : "reservó para recuperar"}`));
    if (!av.length) L.push("- (no hay avisos)");
    return L.join("\n");
  }

  function waGabriel() { const t = P.info && P.info.telGabriel; return t ? intentar(() => waURL(t, `Hola Gabi! Soy ${(P.a && P.a.nombre) || ""}.`), "") : ""; }

  /* ---- Pantalla ---- */
  function montar() {
    if (document.getElementById("iaBtn")) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    const b = document.createElement("button"); b.id = "iaBtn"; b.type = "button"; b.setAttribute("aria-label", "Preguntale al asistente");
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"/><path class="ch" d="M12 6.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/></svg>`;
    b.onclick = abrir; document.body.appendChild(b);
    const p = document.createElement("div"); p.id = "iaPanel"; p.hidden = true; p.setAttribute("role", "dialog"); p.setAttribute("aria-modal", "true"); p.setAttribute("aria-label", "Asistente");
    p.innerHTML = `<div class="ia-fondo" data-ia="cerrar"></div>
      <div class="ia-caja">
        <div class="ia-top"><span class="ia-ico"><svg viewBox="0 0 24 24"><path d="M12 4l1.8 4.2L18 10l-4.2 1.8L12 16l-1.8-4.2L6 10l4.2-1.8z"/></svg></span>
          <span class="ia-tit"><b>Asistente</b><small>Respuestas al instante sobre tus clases</small></span>
          <button type="button" class="ia-x" data-ia="cerrar" aria-label="Cerrar">×</button></div>
        <div class="ia-lista" id="iaLista" aria-live="polite"></div>
        <a class="ia-gabi" id="iaGabi" target="_blank" rel="noopener" hidden>¿Preferís hablar con Gabriel? <b>Escribile por WhatsApp ›</b></a>
        <form class="ia-form" id="iaForm"><textarea id="iaTxt" rows="1" maxlength="600" placeholder="Escribí tu pregunta…" enterkeyhint="send"></textarea>
          <button type="submit" class="ia-env" aria-label="Enviar"><svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg></button></form>
      </div>`;
    document.body.appendChild(p);
    p.addEventListener("click", e => { const t = e.target.closest("[data-ia]"); if (!t) return; if (t.dataset.ia === "cerrar") cerrar(); if (t.dataset.ia === "sug") preguntar(t.textContent); });
    const tx = p.querySelector("#iaTxt");
    tx.addEventListener("input", () => { tx.style.height = "auto"; tx.style.height = Math.min(tx.scrollHeight, 110) + "px"; });
    tx.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); p.querySelector("#iaForm").requestSubmit(); } });
    p.querySelector("#iaForm").addEventListener("submit", e => { e.preventDefault(); const v = tx.value.trim(); if (!v) return; tx.value = ""; tx.style.height = "auto"; preguntar(v); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && abierto) cerrar(); });
    // El botón se ve en la app del alumno (si está prendido) y en el panel de profes. En el panel, se corre arriba del botón "Alumno +".
    setInterval(() => { const m = modo(); b.hidden = !m || abierto; b.classList.toggle("alto", m === "staff" && vis("fab")); }, 600);
  }

  function abrir() {
    const m = modo(); if (!m) return;
    const id = m === "staff" ? "staff_" + (S.uid || "") : P.a.id;
    if (idAl !== id) { idAl = id; cargar(); }
    document.querySelector("#iaPanel .ia-tit small").textContent = m === "staff" ? "Preguntá por alumnos, faltas, lluvias o lo que sea" : "Respuestas al instante sobre tus clases";
    abierto = true; document.getElementById("iaPanel").hidden = false; document.getElementById("iaBtn").hidden = true;
    document.documentElement.classList.add("ia-abierto");
    const g = document.getElementById("iaGabi"), wa = m === "alumno" ? waGabriel() : ""; g.hidden = !wa; if (wa) g.href = wa;
    pintar(); setTimeout(() => { if (matchMedia("(hover:hover)").matches) document.getElementById("iaTxt").focus(); }, 80);
  }
  function cerrar() { abierto = false; document.getElementById("iaPanel").hidden = true; document.documentElement.classList.remove("ia-abierto"); }

  function pintar() {
    const l = document.getElementById("iaLista"); if (!l) return;
    const st = modo() === "staff";
    const nom = st ? (S.modo === "profe" ? "Esteban" : "Gabi") : intentar(() => nombreCorto(P.a.nombre), "");
    let h = st ? `<div class="ia-m bot">¡Hola ${escH(nom)}! 👋 Tengo a mano los alumnos, la asistencia de las últimas semanas, las faltas, las lluvias y las recuperaciones. Preguntame lo que necesites.</div>`
      : `<div class="ia-m bot">¡Hola${nom ? " " + escH(nom) : ""}! 👋 Soy el asistente de Clases de Pádel. Preguntame lo que necesites sobre tus clases, recuperaciones o pagos.</div>`;
    if (!msgs.length) h += `<div class="ia-sugs">${(st ? SUG_STAFF : SUGERENCIAS).map(s => `<button type="button" class="ia-sug" data-ia="sug">${escH(s)}</button>`).join("")}</div>`;
    h += msgs.map(m => `<div class="ia-m ${m.role === "user" ? "yo" : m.error ? "bot err" : "bot"}">${formato(m.content)}</div>`).join("");
    if (enviando) h += `<div class="ia-m bot ia-esc"><i></i><i></i><i></i></div>`;
    l.innerHTML = h; l.scrollTop = l.scrollHeight;
  }

  async function preguntar(texto) {
    if (enviando || !texto) return;
    msgs.push({ role: "user", content: texto }); enviando = true; pintar();
    let resp;
    try {
      if (!window.AVISOS_URL) throw { msg: "El asistente no está configurado." };
      const idToken = await fauth.currentUser.getIdToken();
      const historial = msgs.filter(m => !m.error).slice(-12).map(m => ({ role: m.role, content: m.content }));
      const r = await fetch(window.AVISOS_URL + "/ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, mensajes: historial, contexto: modo() === "staff" ? await contextoStaff() : contexto() }) });
      const j = await r.json().catch(() => { throw { msg: "Falta actualizar el servidor de Cloudflare." }; });
      if (j.error) throw { msg: j.error };
      resp = { role: "assistant", content: j.respuesta };
    } catch (e) {
      resp = { role: "assistant", error: true, content: (e && e.msg) || "Sin conexión. Probá de nuevo." };
    }
    msgs.push(resp); enviando = false; guardar(); pintar();
  }

  const CSS = `
#iaBtn{position:fixed;right:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:11;width:56px;height:56px;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;
  background:var(--s-olive,#1c2619);color:var(--s-lima,#cfe04a);box-shadow:0 14px 28px -10px rgba(20,30,18,.6),inset 0 1px 0 rgba(255,255,255,.1);transition:transform .15s}
#iaBtn:active{transform:scale(.94)}
#iaBtn.alto{bottom:calc(160px + env(safe-area-inset-bottom,0px))}
#iaBtn[hidden]{display:none}
#iaBtn svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linejoin:round}
#iaBtn svg .ch{fill:currentColor;stroke:none}
#iaPanel{position:fixed;inset:0;z-index:60;display:flex;align-items:flex-end;justify-content:center}
#iaPanel[hidden]{display:none}
.ia-fondo{position:absolute;inset:0;background:rgba(18,24,16,.45);animation:iaF .2s ease}
.ia-caja{position:relative;width:min(480px,100%);height:min(640px,88dvh);display:flex;flex-direction:column;background:var(--s-card,#e6e9df);color:var(--s-ink,#1d2419);
  border-radius:22px 22px 0 0;box-shadow:0 -18px 40px -16px rgba(0,0,0,.4);padding-bottom:env(safe-area-inset-bottom,0px);animation:iaS .25s cubic-bezier(.2,.8,.2,1);font-family:var(--s-body,system-ui,sans-serif)}
@media (min-width:560px){#iaPanel{align-items:center}.ia-caja{border-radius:22px}}
@keyframes iaF{from{opacity:0}}@keyframes iaS{from{transform:translateY(40px);opacity:0}}
.ia-top{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:16px 16px 12px;border-bottom:1px solid var(--s-line,rgba(29,36,25,.12))}
.ia-ico{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--s-olive,#1c2619)}
.ia-ico svg{width:20px;height:20px;fill:var(--s-lima,#cfe04a)}
.ia-tit{display:grid;min-width:0}
.ia-tit b{font-family:var(--s-sport,sans-serif);font-stretch:85%;font-weight:800;font-size:1.05rem;letter-spacing:.06em;text-transform:uppercase}
.ia-tit small{font-size:.76rem;color:var(--s-dim,#5c6655)}
.ia-x{width:36px;height:36px;border-radius:50%;border:1px solid var(--s-line,rgba(29,36,25,.12));background:transparent;font-size:1.4rem;line-height:1;color:inherit;cursor:pointer}
.ia-lista{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}
.ia-m{max-width:85%;padding:10px 14px;border-radius:16px;font-size:.92rem;line-height:1.45;word-wrap:break-word}
.ia-m.bot{align-self:flex-start;background:#f4f5ef;border-bottom-left-radius:5px}
.ia-m.yo{align-self:flex-end;background:var(--s-olive,#1c2619);color:var(--s-cream,#efe9da);border-bottom-right-radius:5px}
.ia-m.err{background:transparent;border:1px dashed var(--s-falta,#d0402f);color:var(--s-rojo,#7b2620)}
.ia-sugs{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px}
.ia-sug{border:1px solid var(--s-brass,#a9875a);background:transparent;color:inherit;border-radius:999px;padding:8px 12px;font:inherit;font-size:.8rem;cursor:pointer;text-align:left}
.ia-sug:active{background:var(--s-lima,#cfe04a);border-color:var(--s-lima,#cfe04a)}
.ia-esc{display:flex;gap:5px;padding:14px}
.ia-esc i{width:7px;height:7px;border-radius:50%;background:var(--s-dim,#5c6655);animation:iaP 1s infinite ease-in-out}
.ia-esc i:nth-child(2){animation-delay:.15s}.ia-esc i:nth-child(3){animation-delay:.3s}
@keyframes iaP{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
.ia-gabi{display:block;margin:0 16px 8px;font-size:.78rem;color:var(--s-dim,#5c6655);text-decoration:none;text-align:center}
.ia-gabi b{color:var(--s-ink,#1d2419)}
.ia-form{display:flex;gap:8px;align-items:flex-end;padding:10px 12px 12px;border-top:1px solid var(--s-line,rgba(29,36,25,.12))}
.ia-form textarea{flex:1;resize:none;border:1px solid var(--s-line,rgba(29,36,25,.18));border-radius:20px;padding:11px 14px;font:inherit;font-size:16px;line-height:1.3;background:#fafbf7;color:inherit;max-height:110px;outline:none}
.ia-form textarea:focus{border-color:var(--s-brass,#a9875a)}
.ia-env{width:44px;height:44px;flex:0 0 auto;border-radius:50%;border:0;background:var(--s-lima,#cfe04a);color:var(--s-olive,#1c2619);display:grid;place-items:center;cursor:pointer}
.ia-env svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
html.ia-abierto body{overflow:hidden}`;

  activoAlumnos = window.ASISTENTE === true;
  try { const q = new URLSearchParams(location.search).get("ia"); if (q === "1") localStorage.setItem("iaPrueba", "1"); if (q === "0") localStorage.removeItem("iaPrueba"); if (localStorage.getItem("iaPrueba") === "1") activoAlumnos = true; } catch (e) {}
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar); else montar();
})();
