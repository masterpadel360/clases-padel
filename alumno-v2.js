/* ---------- Diseño nuevo de la app del alumno (versión de prueba) ----------
 * Es el diseño normal para todos. Con ?nuevo=0 se vuelve al viejo en ese celu (y con ?nuevo=1 al nuevo otra vez).
 * No cambia ninguna lógica: usa las mismas funciones, datos y botones (data-pa) de alumno.js,
 * solo dibuja distinto el Inicio y le pone el estilo nuevo a todas las pantallas del alumno.
 */
(function () {
  try {
    const q = new URLSearchParams(location.search).get("nuevo");
    if (q === "1") localStorage.removeItem("disenoViejo");
    if (q === "0") localStorage.setItem("disenoViejo", "1");
    if (localStorage.getItem("disenoViejo") === "1") return; // el diseño nuevo es el normal; ?nuevo=0 vuelve al viejo
  } catch (e) { return; }
  document.documentElement.classList.add("v2");
  // Marca qué pantalla está a la vista (login, alumno o panel) para el estilo, sin selectores pesados.
  function pantallaVisible() {
    const h = document.documentElement, vis = id => { const el = document.getElementById(id); return el && !el.hidden; };
    h.classList.toggle("v2-staff", vis("staffApp")); h.classList.toggle("v2-portal", vis("portal")); h.classList.toggle("v2-login", vis("login"));
  }
  document.addEventListener("DOMContentLoaded", () => {
    pantallaVisible();
    const mo = new MutationObserver(pantallaVisible);
    ["staffApp", "portal", "login"].forEach(id => { const el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ["hidden"] }); });
  });

  const MESN = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DC = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const lugarTxt = c => c === "ESPACIO" ? "Espacio La 10" : "Jump";
  const pelota = (cls = "") => `<span class="v2-pelota ${cls}" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="M8 30 C 35 40, 35 60, 8 72"/><path d="M92 26 C 64 38, 64 62, 92 76"/></svg><span>Clases<br>de Pádel</span></span>`;
  const flecha = '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  let selClase = null, detalleAbierto = false;

  // Estado de cada clase del mes para "Tus clases".
  function estadoClase(c, marcas, proxKey) {
    const m = marcas[`${c.fecha}|${c.hora}`];
    if (m === "vino" || m === "recuperando") return "fui";
    if (m === "lluvia" || c.susp) return "susp";
    if (m === "falto" || m === "recupera" || c.aus) return "falta";
    if (`${c.fecha}|${c.hora}` === proxKey) return "prox";
    if (inicioDe(c.fecha, c.hora).getTime() < Date.now()) return "pasada";
    return "luego";
  }

  function cabecera(a, estMes) {
    const mes = mesKey(now);
    const debe = mesesPago().some(m => m !== mes && conPlazo(m) && estPago(a, m) !== "pagado"); if (debe && estMes !== "vencido") estMes = "vencido";
    const pill = estMes === "pagado" ? '<span class="v2-estado ok"><i></i>Al día</span>' : estMes === "vencido" ? '<span class="v2-estado mal"><i></i>Cuota vencida</span>' : '<span class="v2-estado"><i></i>Cuota pendiente</span>';
    const club = [...clubsDe(a)].map(lugarTxt).join(" · ");
    return `<div class="v2-marca"><span class="v2-logo">${pelota()}<span class="v2-nom">Clases de Pádel</span></span><span class="v2-mes">${MESN[Number(mes.slice(5, 7)) - 1].slice(0, 3)} · ${mes.slice(0, 4)}</span></div>
    <div class="v2-pase"><button class="v2-av" data-pa="cuenta" aria-label="Mi cuenta">${esc((a.nombre || "?").trim().charAt(0).toUpperCase())}</button>
      <span class="v2-quien"><b>${esc(a.nombre || "")}</b><small>${esc(club)}</small></span>${pill}</div>`;
  }

  function hero(prox) {
    if (!prox) return `<section class="v2-ahora vacia"><div class="v2-foto"></div><div class="v2-in"><span class="k">Próxima clase</span><h1 class="v2-cuando">Sin clases<br><span>próximas</span></h1></div></section>`;
    const d = isoDate(prox.fecha);
    return `<section class="v2-ahora" aria-label="Tu próxima clase"><div class="v2-foto"></div><span class="v2-franjas" aria-hidden="true"></span>
      <div class="v2-in">
        <div class="v2-top"><span class="k">${prox.tipo === "recupera" ? "Próxima clase · recuperación" : "Próxima clase"}</span><span class="v2-vivo"><i></i>Lugar confirmado</span></div>
        <h1 class="v2-cuando">${DC[d.getDay()]} ${d.getDate()}<br><span>${prox.hora}</span></h1>
        <div class="v2-donde">${lugarTxt(prox.club)}</div>
        ${prox.vuelve || (P.reemp || {})[prox.fecha + "|" + prox.hora] ? `<div class="v2-donde" style="opacity:.8">${prox.vuelve ? "Confirmaste que venís" : "Va otra persona en tu lugar"}</div>` : `<div class="v2-slide" data-f="${prox.fecha}" data-h="${prox.hora}" data-t="${prox.tipo}"><div class="v2-relleno"></div><div class="v2-slide-tx">Deslizá si no podés ir</div>
          <div class="v2-perilla" role="button" tabindex="0" aria-label="Avisar que no voy">${flecha}</div></div>`}
      </div></section>
      <p class="v2-nota">Si no podés venir, avisá con 24 h de anticipación y la clase queda para recuperar.</p>`;
  }

  function tusClases(a, cl, marcas, proxKey) {
    if (!cl.length) return "";
    const mk = cl[0].fecha.slice(0, 7);
    const est = cl.map(c => estadoClase(c, marcas, proxKey));
    const fui = est.filter(e => e === "fui").length, fal = est.filter(e => e === "falta").length, q = est.filter(e => e === "prox" || e === "luego").length;
    if (selClase === null || selClase >= cl.length) { const i = est.indexOf("prox"); selClase = i >= 0 ? i : 0; }
    const TG = { fui: "Fuiste", falta: "Falta", susp: "Suspendida", prox: "Próxima", luego: "", pasada: "" };
    return `<section class="v2-sec"><div class="v2-head"><h2>Tus clases</h2><span class="k">${MESN[Number(mk.slice(5, 7)) - 1]}</span></div>
      <div class="v2-caja v2-clases">
        <div class="v2-prog-top"><span class="v2-prog-n">${fui}</span><span class="k">de ${cl.length} clases</span></div>
        <div class="v2-prog" style="--n:${cl.length}"><div class="v2-prog-fill" style="width:${cl.length ? fui / cl.length * 100 : 0}%"></div></div>
        <div class="v2-prog-pie"><span>${fal ? `<i></i>${fal} ${fal === 1 ? "falta" : "faltas"} este mes` : "¡Vas al día!"}</span><button type="button" class="v2-ver" data-pa="v2ver" aria-expanded="${detalleAbierto}">${detalleAbierto ? "Ocultar" : "Ver detalle"} <span>›</span></button></div>
        <div class="v2-despl ${detalleAbierto ? "abierto" : ""}"><div class="v2-despl-in">
          <div class="v2-cuenta"><b class="fui">${fui}</b><span class="k">fuiste</span><i></i><b class="falta">${fal}</b><span class="k">${fal === 1 ? "falta" : "faltas"}</span><i></i><b>${q}</b><span class="k">quedan</span></div>
          <div class="v2-grilla">${cl.map((c, i) => { const d = isoDate(c.fecha); return `<button type="button" class="v2-dia ${est[i]}${i === selClase ? " sel" : ""}" data-pa="v2dia" data-i="${i}"><span class="dn">${DC[d.getDay()]}</span><span class="dd">${d.getDate()}</span><span class="tg">${TG[est[i]] || "&nbsp;"}</span></button>`; }).join("")}</div>
          <div class="v2-detalle">${detalleClase(cl[selClase], est[selClase])}</div>
        </div></div>
      </div></section>`;
  }
  function detalleClase(c, e) {
    if (!c) return "";
    const d = isoDate(c.fecha); const rp = P.reemp[`${c.fecha}|${c.hora}`];
    const tit = `${DC[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} · ${c.hora}${c.tipo === "recupera" ? " · recuperación" : ""}`;
    let tx = e === "fui" ? '<b class="fui">Fuiste</b> a esta clase.' : e === "falta" ? (c.aus && c.aus.conRecupero ? '<b class="falta">Faltaste.</b> Te quedó para recuperar.' : '<b class="falta">Faltaste.</b>') : e === "prox" ? "<b>Tu próxima clase.</b> Te esperamos." : e === "susp" ? "<b>Clase suspendida.</b> Te queda para recuperar en otro horario." : e === "pasada" ? "Todavía no se cargó la asistencia." : `Clase en ${lugarTxt(c.club)}.`;
    if (rp) tx += ` Va <b>${esc(rp.quien)}</b> en tu lugar.`;
    if (c.vuelve) tx += " Confirmaste que venís.";
    const futura = inicioDe(c.fecha, c.hora).getTime() > Date.now();
    const acc = !futura || c.aus || c.vuelve || c.susp ? "" : rp ? `<button class="v2-mini" data-pa="reempNo" data-f="${c.fecha}" data-h="${c.hora}">Cancelar reemplazo</button>`
      : `<button class="v2-mini rojo" data-pa="novoy" data-f="${c.fecha}" data-h="${c.hora}" data-t="${c.tipo}">No voy</button>`;
    return `<span class="dl">${tit}</span><span>${tx}</span>${acc ? `<span class="v2-acc">${acc}</span>` : ""}`;
  }

  function cuota(a) {
    const mes = a.pruebaPagos && mesKey(now) < PAGO_DESDE ? PAGO_DESDE : mesKey(now); const est = estPago(a, mes); // pruebaPagos: Gabriel deja probar el pago de noviembre antes const monto = montoMes(a, mes); const n = clasesMes(a, mes);
    const pm = (a.pagos || {})[mes] || {}; const det = ajusteDe(a, mes) !== null ? esc(pm.nota || "Monto acordado") : `${n} clases`;
    const deuda = mesesPago().filter(m => m !== mes && conPlazo(m) && estPago(a, m) !== "pagado");
    const vence = new Date(now.getFullYear(), now.getMonth(), DIA_PAGO); const dias = Math.ceil((vence - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / DIA_MS);
    const plazo = conPlazo(mes); const frac = plazo ? Math.max(0, Math.min(1, dias / DIA_PAGO)) : 1;
    const C = 226.2;
    const anillo = est === "pagado" ? `<svg class="v2-tilde" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><small>al día</small>`
      : est === "vencido" ? `<b>!</b><small>vencido</small>` : plazo ? `<b>${Math.max(dias, 0)}</b><small>${dias === 1 ? "día" : "días"}</small>` : `<b>${n}</b><small>clases</small>`;
    const sub = est === "pagado" ? "Gracias, ya está registrado." : !plazo ? `${det} · este mes lo arreglás directo con Gabriel. Desde noviembre pagás por la app.` : est === "vencido" ? `Venció el ${pagoVence(mes)}. Pagalo cuanto antes.` : est === "rechazado" ? "Gabriel no pudo confirmar el comprobante. Volvé a mandarlo." : `${det}${plazo ? ` · pagás hasta el ${pagoVence(mes)}` : ""}`;
    return `<section class="v2-pago ${est === "pagado" ? "listo" : ""}">
      <svg class="v2-cancha" viewBox="0 0 200 120" aria-hidden="true"><g><rect x="4" y="4" width="192" height="112"/><line x1="100" y1="0" x2="100" y2="120" stroke-width="4"/><line x1="36" y1="4" x2="36" y2="116"/><line x1="164" y1="4" x2="164" y2="116"/><line x1="36" y1="60" x2="164" y2="60"/></g></svg>
      <span class="v2-vel" aria-hidden="true"></span>
      <div class="v2-pago-g"><div><span class="k">Cuota de ${MESN[Number(mes.slice(5, 7)) - 1]}</span><div class="v2-monto">${est === "pagado" ? "Pagado" : money(monto).replace(/\$\s+/, "$")}</div><p>${sub}</p></div>
        <div class="v2-anillo"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="36"/><circle class="arco" cx="42" cy="42" r="36" stroke-dasharray="${C}" stroke-dashoffset="${est === "pagado" ? 0 : (C * (1 - frac)).toFixed(1)}"/></svg><span>${anillo}</span></div></div>
      ${est === "pagado" || !plazo || !monto ? "" : `<button class="v2-pagar" data-pa="pagar" data-m="${mes}">Pagar ahora</button>`}
      ${deuda.length ? `<button class="v2-deuda" data-pa="ptab" data-t="pagos">Tenés ${deuda.length === 1 ? "un mes anterior" : deuda.length + " meses anteriores"} sin pagar ›</button>` : ""}
    </section>`;
  }

  function recuperar(a, wa) {
    const bk = recAl(); const rec = bk.reduce((s, x) => s + x.n, 0); const ops = rec > 0 ? opcionesRec() : [];
    const hasta = bk.length ? fechaDM(bk[0].vence) : "";
    return `<section class="v2-sec" id="secRec"><div class="v2-head"><h2>Recuperá</h2><span class="k">${rec ? `${rec} ${rec === 1 ? "clase" : "clases"} · hasta el ${hasta}` : ""}</span></div>
      ${!rec ? `<div class="v2-vacio">No tenés clases para recuperar.</div>`
      : ops.length ? `<p class="v2-sub">Horarios para vos:</p><div class="v2-fila">${ops.slice(0, 14).map(o => { const d = isoDate(o.fecha); return `<button class="v2-turno" data-pa="reservar" data-f="${o.fecha}" data-h="${o.hora}" data-c="${o.club}"><span class="d">${DC[d.getDay()]} ${d.getDate()}</span><span class="h">${o.hora}</span><span class="l"><b>${o.libres}</b> ${o.libres === 1 ? "lugar libre" : "lugares libres"}${clubsDe(a).size > 1 ? " · " + clubTxt(o.club) : ""}</span></button>`; }).join("")}</div>`
      : `<div class="v2-vacio">Por ahora no hay horarios libres que se ajusten a tu nivel antes de que venzan. Te avisamos cuando se libere uno.${wa ? ` <a href="${wa}" target="_blank" rel="noopener">Escribile a Gabriel</a>` : ""}</div>`}
      ${rec ? `<p class="v2-sub">Estos son los horarios que se ajustan a tu nivel. Si no la recuperás en 2 semanas, se pierde.</p>` : ""}
    </section>`;
  }

  window.vInicio = function (a, wa) {
    const rg = rangoMes(); const cl = misClases(0, rg).filter(c => c.fecha.startsWith(mesKey(now)));
    const mk0 = marcasAl(a); const prox = misClases(70).find(c => !c.aus && mk0[`${c.fecha}|${c.hora}`] !== "lluvia" && !c.susp && inicioDe(c.fecha, c.hora).getTime() > Date.now());
    const marcas = marcasAl(a); const proxKey = prox ? `${prox.fecha}|${prox.hora}` : "";
    const rec = recAl().reduce((s, x) => s + x.n, 0); const bk = recAl();
    const estMes = estPago(a, mesKey(now));
    return `<div class="v2">${cabecera(a, estMes)}
      ${avisosArriba(a, "inicio")}
      ${hero(prox)}
      ${sumarDia()}
      ${tarjetaNotif("alumno")}
      ${tusClases(a, cl, marcas, proxKey)}
      ${cuota(a)}
      ${recuperar(a, wa)}
      <div class="v2-extra"><button class="v2-mini" data-pa="ptab" data-t="ausencias">Programar una ausencia</button><button class="v2-mini" data-pa="calendario">Recordatorios en mi calendario</button>${wa ? `<a class="v2-mini wa" href="${wa}" target="_blank" rel="noopener">Escribirle a Gabriel</a>` : ""}</div>
    </div>`;
  };
  // Tarjeta grande para pedir sumar un día más (y el estado del pedido).
  function sumarDia() {
    const sol = (P.solic || []).slice().sort((x, y) => ((y.creado && y.creado.seconds) || 0) - ((x.creado && x.creado.seconds) || 0));
    const pen = sol.filter(s => s.estado === "pendiente"); const res = sol.filter(s => s.estado !== "pendiente");
    const dTxt = s => `${DIAS_LARGO[s.dia].toLowerCase()} ${s.hora} · ${s.club === "ESPACIO" ? "Espacio" : "Jump"}`;
    const avisos = res.map(s => s.estado === "aprobado"
      ? `<div class="v2-sumar-res ok"><b>¡Listo! Sumaste los ${dTxt(s)}</b><span>${s.desde ? `Arrancás el ${fechaDM(s.desde)}.` : ""} Ya está en tus clases.</span><button data-pa="sumarVisto" data-id="${s.id}">Entendido</button></div>`
      : `<div class="v2-sumar-res"><b>Gabriel no pudo sumarte los ${dTxt(s)}</b><span>${s.motivo ? esc(s.motivo) : "Escribile y vemos otro horario."}</span><button data-pa="sumarVisto" data-id="${s.id}">Entendido</button></div>`).join("");
    return `${avisos}<section class="v2-sumar"><button class="v2-sumar-b" data-pa="sumar"><span class="v2-sumar-i">+1</span><span class="v2-sumar-t"><b>Sumá un día más</b><small>Entrená más veces por semana. Elegí el horario y Gabriel te lo confirma.</small></span><span class="v2-sumar-go">›</span></button>
      ${pen.map(s => `<div class="v2-sumar-pen"><span>⏳ Pediste sumar los <b>${dTxt(s)}</b>. Esperando a Gabriel.</span><button data-pa="sumarCancelar" data-id="${s.id}">Cancelar</button></div>`).join("")}</section>`;
  }
  // Avisos importantes arriba de todo, en todas las pantallas.
  function avisosArriba(a, tab) {
    const out = [];
    const bk = recAl(); const rec = bk.reduce((s, x) => s + x.n, 0);
    const ico = '<span class="ico"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg></span>';
    const icoP = '<span class="ico"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/></svg></span>';
    const mes = a.pruebaPagos && mesKey(now) < PAGO_DESDE ? PAGO_DESDE : mesKey(now); const est = estPago(a, mes); // pruebaPagos: Gabriel deja probar el pago de noviembre antes
    const deuda = mesesPago().filter(m => m !== mes && conPlazo(m) && estPago(a, m) !== "pagado");
    const dias = Math.ceil((new Date(now.getFullYear(), now.getMonth(), DIA_PAGO) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / DIA_MS);
    if (deuda.length || est === "vencido") {
      const m = deuda.length ? deuda[deuda.length - 1] : mes;
      out.push(`<button class="v2-recordar" data-pa="${tab === "pagos" ? "pagar" : "ptab"}" ${tab === "pagos" ? `data-m="${m}"` : 'data-t="pagos"'}>${icoP}<span class="tx"><b>${deuda.length > 1 ? `${deuda.length} cuotas vencidas` : "Cuota vencida"}</b><small>Pagala cuanto antes para seguir al día</small></span><span class="v2-cta">Pagar</span></button>`);
    } else if (est === "rechazado") {
      out.push(`<button class="v2-recordar" data-pa="pagar" data-m="${mes}">${icoP}<span class="tx"><b>Revisá tu pago</b><small>Gabriel no pudo confirmar el comprobante. Volvé a mandarlo.</small></span><span class="v2-cta">Mandar</span></button>`);
    } else if (est === "pendiente" && conPlazo(mes) && dias >= 0 && dias <= 3) {
      out.push(`<button class="v2-recordar suave" data-pa="pagar" data-m="${mes}">${icoP}<span class="tx"><b>${dias === 0 ? "Hoy vence tu cuota" : `Te ${dias === 1 ? "queda 1 día" : `quedan ${dias} días`} para pagar`}</b><small>La cuota de ${MESN[now.getMonth()]} vence el ${pagoVence(mes)}</small></span><span class="v2-cta">Pagar</span></button>`);
    }
    { const mk = marcasAl(a); const ks = new Set(Object.keys(mk).filter(k => mk[k] === "lluvia" && k.slice(0, 10) >= hoyISO));
      misClases(21).filter(c => c.susp).forEach(c => ks.add(`${c.fecha}|${c.hora}`));
      [...ks].sort().forEach(k => { const [f, h] = k.split("|"); const d = isoDate(f); const mot = Object.entries(P.susp || {}).find(([x]) => x.endsWith(`|${f}|${h}`)); const ll = !mot || mot[1] === "lluvia";
        out.push(`<div class="v2-recordar suave"><span class="ico" style="font-size:20px">${ll ? "🌧" : "📢"}</span><span class="tx"><b>${ll ? "Se suspendió tu clase" : "No hay clase"} ${f === hoyISO ? "de hoy" : `el ${DC[d.getDay()].toLowerCase()} ${d.getDate()}`} ${h}</b><small>${ll ? "Por lluvia. " : ""}Te queda para recuperar en otro horario.</small></span></div>`); }); }
    { const px = aumentoProx(a); if (px && (tab === "inicio" || tab === "pagos")) out.push(`<div class="v2-recordar suave v2-aum">${icoP}<span class="tx"><b>Desde ${MESN[Number(px.desde.slice(5, 7)) - 1]} la clase pasa a ${money(px.precio).replace(/\$\s+/, "$")}</b><small>Hasta entonces seguís pagando ${money(px.antes).replace(/\$\s+/, "$")} por clase.</small></span></div>`); }
    if (rec) out.push(`<button class="v2-recordar" data-pa="${tab === "inicio" ? "irRec" : "v2irRec"}">${ico}<span class="tx"><b>${rec} ${rec === 1 ? "clase" : "clases"} para recuperar</b><small>Recuperala antes del ${fechaDM(bk[0].vence)} o se pierde</small></span><span class="v2-cta">Recuperar</span></button>`);
    return out.length ? `<div class="v2-avisos">${out.join("")}</div>` : "";
  }


  /* ---- Agenda del panel: una tarjeta por turno, alumnos en lista y lugares a la vista ---- */
  window.slotHTML = function (t, fecha) {
    if (fecha) t = { ...t, al: t.al.filter(a => !a.inicio || a.inicio <= fecha) };
    const aj = fecha ? ajusteTurno(t, fecha) : { aus: new Set(), rec: [] };
    const van = t.al.length - aj.aus.size + aj.rec.length; const libres = CUPO - van;
    const f = fecha || hoyISO; const ini = new Date(`${f}T${t.hora}:00-03:00`).getTime(), ya = Date.now();
    const ahora = ya >= ini && ya < ini + 60 * 60 * 1000, paso = ya >= ini + 60 * 60 * 1000;
    const cupoHTML = n => Array.from({ length: CUPO }, (_, i) => `<i class="${i < n ? "si" : ""}"></i>`).join("");
    const ini2 = n => esc(String(n || "?").trim().split(/\s+/).map(x => x[0]).slice(0, 2).join("").toUpperCase());
    const fila = (a, extra, cls) => `<button class="tu-al ${cls}" data-act="editA" data-id="${a.id}"><span class="av">${ini2(a.nombre)}</span><span class="nm">${esc(a.nombre)}</span>${extra}</button>`;
    escucharExtras();
    const ext = (S.extras || []).filter(x => x.club === t.club && x.fecha === f && x.hora === t.hora);
    const vanTot = van + ext.length; const libresTot = CUPO - vanTot;
    const quitar = (k, id) => `<span class="tu-x" role="button" tabindex="0" data-xa="${k}" data-id="${id}" aria-label="Quitar">✕</span>`;
    const lista = t.al.map(a => fila(a, aj.aus.has(a.id) ? '<span class="bd no">No viene</span>' : esNuevo(a) ? '<span class="bd nv">Nuevo</span>' : "", aj.aus.has(a.id) ? "aus" : ""))
      .concat(aj.rec.map(a => { const v = S.avisos.find(x => x.tipo === "recupera" && x.alumnoId === a.id && x.fecha === f && x.hora === t.hora); return fila(a, '<span class="bd rc">Recupera</span>' + (v && !paso ? quitar("quitarRec", v.id) : ""), "rec"); }))
      .concat(ext.map(x => `<div class="tu-al ext"><span class="av">${ini2(x.nombre)}</span><span class="nm">${esc(x.nombre)}${x.tel ? ` <small>${esc(x.tel)}</small>` : ""}</span><span class="bd pr">${x.tipo === "invitado" ? "Invitado" : "Prueba"}</span>${paso ? "" : quitar("quitarExtra", x.id)}</div>`)).join("");
    return `<div class="tu ${ahora ? "ahora" : ""} ${paso ? "paso" : ""}" data-k="${t.club}|${t.hora}">
      <div class="tu-h"><span class="hr">${t.hora || "—"}</span>${ahora ? '<span class="vivo">Ahora</span>' : ""}</div>
      <div class="tu-c">
        <div class="tu-top">${S.club ? "" : `<span class="tag ${t.club}">${t.club === "ESPACIO" ? "Espacio" : "Jump"}</span>`}
          ${t.al.length ? `<button class="tu-cat" data-act="turnoCat" data-club="${t.club}" data-dia="${t.dia}" data-hora="${t.hora}">${t.nivel ? esc(t.nivel) : "+ Categoría"} ✎</button>` : (aj.rec.length ? "" : `<span class="tu-cat">Turno libre</span>`)}
          <span class="tu-cupo ${libresTot > 0 ? "" : "lleno"}"><span class="pts">${cupoHTML(vanTot)}</span>${libresTot > 0 ? `${libresTot} libre${libresTot > 1 ? "s" : ""}` : "Completo"}</span></div>
        <div class="tu-lista">${lista || '<span class="tu-vacio">Sin alumnos</span>'}</div>
        <div class="tu-pie">${paso ? "" : `<button class="tu-sumar" data-xa="sumar" data-club="${t.club}" data-dia="${t.dia}" data-hora="${t.hora}" data-f="${f}">+ Sumar a alguien</button>`}<button class="tu-lluvia" data-act="lluvia" data-club="${t.club}" data-dia="${t.dia}" data-hora="${t.hora}" data-f="${f}">Suspender por lluvia</button></div>
      </div></div>`;
  };


  /* ---- Sumar a alguien a un turno (prueba, invitado o un alumno que recupera, aunque sea de otro club) ---- */
  let extrasSub = false;
  window.escucharExtras = () => escucharExtras();
  function escucharExtras() {
    if (extrasSub || !window.MODO_STAFF || typeof fdb === "undefined" || !fdb) return; extrasSub = true;
    const d = new Date(now); d.setDate(d.getDate() - 8);
    fdb.collection("extras").where("fecha", ">=", toISO(d)).onSnapshot(s => { S.extras = s.docs.map(x => ({ id: x.id, ...x.data() })); if ($("#overlay").hidden) render(); }, e => console.error(e));
  }
  const FV = () => firebase.firestore.FieldValue;
  const cupoRef = (c, f, h) => fdb.doc("cupos/" + `${c}_${f}_${hhmmDe(h)}`);
  let SU = null;
  function abrirSumar(b) {
    SU = { club: b.dataset.club, dia: Number(b.dataset.dia), hora: b.dataset.hora, f: b.dataset.f, modo: SU && SU.modo || "prueba", al: null, q: "" };
    pintarSumar();
  }
  function pintarSumar() {
    const d = isoDate(SU.f);
    const club = SU.club === "ESPACIO" ? "Espacio" : "Jump";
    let cuerpo;
    if (SU.modo === "prueba") cuerpo = `
      <div class="seg" style="grid-template-columns:1fr 1fr;margin:0"><button class="seg-b" data-xa="suTipo" data-t="prueba" aria-pressed="${SU.tipo !== "invitado"}">Clase de prueba</button><button class="seg-b" data-xa="suTipo" data-t="invitado" aria-pressed="${SU.tipo === "invitado"}">Invitado</button></div>
      <div class="field"><label for="suNom">Nombre</label><input id="suNom" maxlength="40" autocomplete="off" placeholder="Nombre y apellido"></div>
      <div class="field"><label for="suTel">WhatsApp (opcional)</label><input id="suTel" inputmode="tel" maxlength="20" placeholder="351…"></div>
      <p class="small muted" style="margin:0">Ocupa un lugar en este turno: a los alumnos ya no les aparece libre.</p>`;
    else {
      const q = SU.q.toLowerCase(); const lista = S.alumnos.filter(a => a.activo !== false && (!q || (a.nombre || "").toLowerCase().includes(q))).sort((x, y) => (x.nombre || "").localeCompare(y.nombre || "")).slice(0, 8);
      const a = SU.al && S.alumnos.find(x => x.id === SU.al); const n = a ? recN(a) : 0; const otro = a && !clubsDe(a).has(SU.club);
      cuerpo = a ? `<div class="msg" style="gap:6px"><b>${esc(a.nombre)}</b><span class="small">${n ? `Tiene <b>${n}</b> ${n === 1 ? "clase" : "clases"} para recuperar.` : "No tiene clases para recuperar."}${otro ? " Es de otro club: lo sumás como excepción." : ""}</span>
          <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="suDesc" ${n ? "checked" : "disabled"} style="width:18px;height:18px"> Descontarle una clase para recuperar</label>
          <button class="linkish" data-xa="suOtro" style="justify-self:start">Elegir otro alumno</button></div>`
        : `<input class="search" id="suQ" type="search" placeholder="Buscar alumno" value="${esc(SU.q)}" autocomplete="off">
          <div class="list">${lista.map(x => `<button class="row" style="width:100%;background:none;border:0;text-align:left" data-xa="suAl" data-id="${x.id}"><span class="main"><span class="name">${esc(x.nombre)}</span><span class="meta">${tagsClub(x)}${recN(x) ? `<span class="tag rec">Recupera ${recN(x)}</span>` : ""}</span></span></button>`).join("") || '<div class="row"><span class="small muted">Nadie con ese nombre.</span></div>'}</div>`;
    }
    openSheet(`<div style="display:grid;gap:4px"><span class="flabel">Sumar al turno</span><h2 class="disp">${DIAS_LARGO[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} · ${SU.hora}</h2><span class="small muted">${club}</span></div>
      <div class="seg" style="grid-template-columns:1fr 1fr;margin:0"><button class="seg-b" data-xa="suModo" data-m="prueba" aria-pressed="${SU.modo === "prueba"}">Prueba o invitado</button><button class="seg-b" data-xa="suModo" data-m="alumno" aria-pressed="${SU.modo === "alumno"}">Un alumno</button></div>
      ${cuerpo}
      <p class="small" id="suErr" style="margin:0;color:var(--warn)"></p>
      <div class="btns"><span></span><span style="display:flex;gap:8px"><button class="btn sec2" data-xa="cerrarSu">Cancelar</button><button class="btn pri" data-xa="suOk">Sumar</button></span></div>`);
  }
  async function guardarSumar(b) {
    const err = $("#suErr"); const { club, dia, hora, f } = SU; const hh = hhmmDe(hora);
    b.disabled = true; b.textContent = "Guardando…";
    try {
      const bt = fdb.batch();
      if (SU.modo === "prueba") {
        const nombre = ($("#suNom").value || "").trim().replace(/\s+/g, " "); if (nombre.length < 2) { err.textContent = "Escribí el nombre."; return; }
        const id = `${club}_${f}_${hh}_${Date.now().toString(36)}`;
        bt.set(fdb.doc("extras/" + id), { club, fecha: f, hora, hhmm: hh, dia, tipo: SU.tipo === "invitado" ? "invitado" : "prueba", nombre: nombre.slice(0, 40), tel: ($("#suTel").value || "").trim().slice(0, 20), creado: FV().serverTimestamp() });
        bt.set(cupoRef(club, f, hora), { club, fecha: f, hora, dia, aus: FV().increment(0), rec: FV().increment(1) }, { merge: true });
        await bt.commit(); closeSheet(); toast(`${nombre} sumado al turno de las ${hora}`);
      } else {
        const a = SU.al && S.alumnos.find(x => x.id === SU.al); if (!a) { err.textContent = "Elegí un alumno."; return; }
        const avId = `${a.id}_${f}_${hh}_recupera`; if (S.avisos.some(v => v.id === avId)) { err.textContent = "Ya está anotado en ese turno."; return; }
        const desc = !!($("#suDesc") && $("#suDesc").checked);
        const t = (turnos(club).find(x => x.dia === dia && x.hora === hora) || {});
        bt.set(fdb.doc("avisos/" + avId), { alumnoId: a.id, uid: S.uid, nombre: a.nombre, club, fecha: f, hora, hhmm: hh, dia, nivel: t.nivel || "", tipo: "recupera", conRecupero: false, por: "staff", descontado: desc,
          inicio: firebase.firestore.Timestamp.fromDate(new Date(`${f}T${hora}:00-03:00`)), creado: FV().serverTimestamp(), visto: true, notificado: true, contado: false });
        bt.set(cupoRef(club, f, hora), { club, fecha: f, hora, dia, aus: FV().increment(0), rec: FV().increment(1), ultimo: avId }, { merge: true });
        if (desc) bt.update(fdb.doc("alumnos/" + a.id), recCambio(a, -1));
        await bt.commit(); closeSheet(); toast(`${a.nombre} recupera a las ${hora}`);
      }
    } catch (x) { console.error(x); if (err) err.textContent = "No se pudo guardar. Probá de nuevo."; }
    finally { b.disabled = false; b.textContent = "Sumar"; }
  }
  async function quitarExtra(id) {
    const x = (S.extras || []).find(e => e.id === id); if (!x) return;
    const bt = fdb.batch(); bt.delete(fdb.doc("extras/" + id)); bt.set(cupoRef(x.club, x.fecha, x.hora), { rec: FV().increment(-1) }, { merge: true });
    await bt.commit(); toast(`Quitaste a ${x.nombre}`);
  }
  async function quitarRec(id) {
    const v = S.avisos.find(e => e.id === id); if (!v) return; const a = S.alumnos.find(x => x.id === v.alumnoId);
    const bt = fdb.batch(); bt.delete(fdb.doc("avisos/" + id)); bt.set(cupoRef(v.club, v.fecha, v.hora), { rec: FV().increment(-1) }, { merge: true });
    if (a && v.descontado !== false) bt.update(fdb.doc("alumnos/" + a.id), recCambio(a, 1, v.fecha));
    await bt.commit(); toast(`${a ? a.nombre : "El alumno"} ya no recupera en ese turno${a && v.descontado !== false ? " · le devolvimos la clase" : ""}`);
  }
  const confirmados = {};
  document.addEventListener("click", async e => {
    if (!window.MODO_STAFF) return;
    const b = e.target.closest("[data-xa]"); if (!b) return; e.stopPropagation();
    const k = b.dataset.xa;
    if (k === "sumar") { SU = null; abrirSumar(b); return; }
    if (k === "cerrarSu") { closeSheet(); return; }
    if (k === "suModo") { SU.modo = b.dataset.m; SU.al = null; pintarSumar(); return; }
    if (k === "suTipo") { SU.tipo = b.dataset.t; const n = $("#suNom").value, t = $("#suTel").value; pintarSumar(); $("#suNom").value = n; $("#suTel").value = t; return; }
    if (k === "suAl") { SU.al = b.dataset.id; pintarSumar(); return; }
    if (k === "suOtro") { SU.al = null; pintarSumar(); return; }
    if (k === "suOk") { await guardarSumar(b); return; }
    if (k === "quitarExtra" || k === "quitarRec") {
      // Primer toque arma, segundo toque quita (sin ventanas de confirmación).
      if (!confirmados[b.dataset.id]) { confirmados[b.dataset.id] = 1; b.classList.add("armado"); b.textContent = "Quitar"; setTimeout(() => { delete confirmados[b.dataset.id]; if (b.isConnected) { b.classList.remove("armado"); b.textContent = "✕"; } }, 3000); return; }
      delete confirmados[b.dataset.id];
      try { await (k === "quitarExtra" ? quitarExtra(b.dataset.id) : quitarRec(b.dataset.id)); } catch (x) { console.error(x); toast("No se pudo quitar. Probá de nuevo."); }
    }
  }, true);
  document.addEventListener("input", e => { if (window.MODO_STAFF && e.target.id === "suQ" && SU) { SU.q = e.target.value; clearTimeout(SU.t); SU.t = setTimeout(() => { pintarSumar(); const q = $("#suQ"); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, 200); } });

  /* ---- Ausencias ---- */
  const ESTV = { vino: ["Fuiste", "fui"], recuperando: ["Recuperaste", "fui"], falto: ["Faltaste sin avisar", "falta"], recupera: ["Avisaste · recuperás", "aviso"], lluvia: ["Clase suspendida · recuperás", "lluvia"] };
  function fichaClase(c) {
    const d = isoDate(c.fecha); const rp = P.reemp[`${c.fecha}|${c.hora}`];
    const estado = c.aus ? (c.aus.conRecupero ? '<span class="st aviso">No venís · te quedó para recuperar</span>' : '<span class="st falta">No venís</span>')
      : c.susp ? '<span class="st aviso">Suspendida · te queda para recuperar</span>' : c.vuelve ? '<span class="st fui">Confirmaste que venís</span>' : rp ? `<span class="st aviso">Va ${esc(rp.quien)} en tu lugar</span>` : "";
    const acc = c.aus || c.vuelve || c.susp ? "" : rp ? `<button class="v2-mini" data-pa="reempNo" data-f="${c.fecha}" data-h="${c.hora}">Cancelar</button>`
      : `<button class="v2-mini rojo" data-pa="novoy" data-f="${c.fecha}" data-h="${c.hora}" data-t="${c.tipo}">No voy</button>`;
    return `<div class="v2-ficha${c.aus ? " off" : ""}"><div class="v2-fecha"><span>${DC[d.getDay()]}</span><b>${d.getDate()}</b></div>
      <div class="v2-ficha-tx"><b>${c.hora}${c.tipo === "recupera" ? ' <i class="v2-tag">Recuperación</i>' : ""}</b><span>${lugarTxt(c.club)} · ${fechaRel(c.fecha)}</span>${estado}</div>
      <div class="v2-ficha-acc">${acc}</div></div>`;
  }
  window.vAusencias = function (a, wa) {
    const prox = misClases(21).filter(c => inicioDe(c.fecha, c.hora).getTime() > Date.now());
    const av = P.avisos.filter(v => v.tipo === "ausencia" && v.fecha >= hoyISO && !esVuelta(v.fecha, v.hora) && inicioDe(v.fecha, v.hora).getTime() > Date.now()).sort((x, y) => (x.fecha + x.hora).localeCompare(y.fecha + y.hora));
    const asis = misAsistencias(); const mes = mesKey(now); const asMes = asis.filter(x => x.fecha.startsWith(mes));
    const fui = asMes.filter(x => x.estado === "vino" || x.estado === "recuperando").length, fal = asMes.filter(x => x.estado === "falto").length;
    return `<div class="v2">${cabecera(a, estPago(a, mes))}${avisosArriba(a, "ausencias")}
      <section class="v2-sec"><div class="v2-head"><h2>No puedo ir</h2><span class="k">Próximas 3 semanas</span></div>
        ${prox.length ? `<div class="v2-fichas">${prox.map(fichaClase).join("")}</div>` : `<div class="v2-vacio">No tenés clases en las próximas 3 semanas.</div>`}
        <p class="v2-sub">Tocá <b>No voy</b> en la clase. Si avisás con <b>24 h o más</b>, te queda para recuperar en las 2 semanas siguientes.</p>
      </section>
      <section class="v2-programar">
        <svg class="v2-cancha" viewBox="0 0 200 120" aria-hidden="true"><g><rect x="4" y="4" width="192" height="112"/><line x1="100" y1="0" x2="100" y2="120" stroke-width="4"/><line x1="36" y1="4" x2="36" y2="116"/><line x1="164" y1="4" x2="164" y2="116"/><line x1="36" y1="60" x2="164" y2="60"/></g></svg>
        <span class="v2-vel" aria-hidden="true"></span>
        <span class="k">Ausencia programada</span>
        <h3>¿Te vas de viaje o tenés un compromiso?</h3>
        <p>Elegí un día, o desde y hasta qué día, y avisamos todas tus clases de esas fechas.</p>
        <button class="v2-pagar lima" data-pa="viaje">Programar ausencia</button>
        <button class="v2-deuda" data-pa="varias">O elegí clase por clase ›</button>
      </section>
      ${av.length ? `<section class="v2-sec"><div class="v2-head"><h2>Avisaste</h2><span class="k">${av.length} ${av.length === 1 ? "clase" : "clases"}</span></div>
        <div class="v2-fichas">${av.map(v => { const d = isoDate(v.fecha);
          const a24 = inicioDe(v.fecha, v.hora).getTime() - Date.now() >= DIA_MS; const lugar = libresDe(v.club, v.fecha, v.hora) > 0; const tiene = (a.recuperar || 0) >= 1;
          const puede = v.conRecupero && a24 && lugar && tiene && !recCancelada(v);
          const nota = !v.conRecupero || recCancelada(v) ? "" : !a24 ? "Faltan menos de 24 h: ya no se puede cambiar" : !lugar ? "Tu lugar ya lo tomó otra persona" : !tiene ? "Ya usaste esa clase para recuperar" : "";
          return `<div class="v2-ficha off"><div class="v2-fecha"><span>${DC[d.getDay()]}</span><b>${d.getDate()}</b></div>
            <div class="v2-ficha-tx"><b>${v.hora}</b>${v.conRecupero ? (recCancelada(v) ? '<span class="st aviso">Cancelaste la recuperación · te queda para otro horario</span>' : '<span class="st aviso">Te queda para recuperar</span>') : (recCancelada(v) ? '<span class="st falta">Cancelaste la recuperación</span>' : '<span class="st falta">Avisaste tarde: no se recupera</span>')}${nota ? `<span>${nota}</span>` : ""}</div>
            <div class="v2-ficha-acc">${puede ? `<button class="v2-mini" data-pa="vuelvo" data-f="${v.fecha}" data-h="${v.hora}" data-c="${v.club}">Al final voy</button>` : ""}</div></div>`; }).join("")}</div>
        <p class="v2-sub">Podés volver atrás <b>una sola vez</b>, hasta 24 h antes y si tu lugar sigue libre.${wa ? ` ¿Otro caso? <a href="${waURL(P.info.telGabriel, `Hola Gabi! Soy ${a.nombre}. Avisé que no iba pero al final sí puedo ir. ¿Me lo corregís en la app?`)}" target="_blank" rel="noopener">Escribile a Gabriel</a>.` : ""}</p>
      </section>` : ""}
      <section class="v2-sec"><div class="v2-head"><h2>Tu asistencia</h2><span class="k">${MESN[now.getMonth()]}</span></div>
        <div class="v2-caja">
          <div class="v2-cuenta"><b class="fui">${fui}</b><span class="k">${fui === 1 ? "clase" : "clases"}</span><i></i><b class="falta">${fal}</b><span class="k">${fal === 1 ? "falta" : "faltas"}</span></div>
          ${asis.length ? `<div class="v2-asis">${asis.slice(0, 20).map(x => { const d = isoDate(x.fecha); const e = ESTV[x.estado] || [x.estado, ""];
            return `<div class="v2-asis-f"><span class="pt ${e[1]}"></span><span class="f">${DC[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} · ${x.hora}</span><span class="e ${e[1]}">${e[0]}</span></div>`; }).join("")}</div>`
            : `<p class="v2-sub" style="margin-top:10px">Todavía no hay asistencias cargadas.</p>`}
        </div>
      </section>
    </div>`;
  };

  /* ---- Pagos ---- */
  window.vPagos = function (a, wa) {
    const mes = mesKey(now); const meses = mesesPago();
    const otros = meses.filter(m => m !== mes && conPlazo(m));
    return `<div class="v2">${cabecera(a, estPago(a, mes))}${avisosArriba(a, "pagos")}
      <section class="v2-sec"><div class="v2-head"><h2>Tu cuota</h2><span class="k">${MESN[now.getMonth()]}</span></div>${cuota(a)}
        ${P.info.alias ? `<div class="v2-alias"><span><span class="k">Alias para transferir</span><b>${esc(P.info.alias)}</b></span><button class="v2-mini" data-pa="alias">Copiar</button></div>` : ""}
      </section>
      ${otros.length ? `<section class="v2-sec"><div class="v2-head"><h2>Meses anteriores</h2><span class="k">${otros.length} sin pagar</span></div>
        <div class="v2-fichas">${otros.map(m => { const est = estPago(a, m); const n = clasesMes(a, m); const aj = ajusteDe(a, m) !== null; const p = (a.pagos || {})[m] || {}; const c = P.comps[m];
          return `<div class="v2-ficha ${est === "vencido" ? "venc" : ""}"><div class="v2-fecha"><span>${MESN[Number(m.slice(5, 7)) - 1].slice(0, 3)}</span><b>${m.slice(2, 4)}</b></div>
            <div class="v2-ficha-tx"><b>${money(montoMes(a, m)).replace(/\$\s+/, "$")}</b><span>${aj ? (p.nota ? esc(p.nota) : "Monto acordado") : (precioEn(a, m) ? `${n} clases × ${money(precioEn(a, m)).replace(/\$\s+/, "$")}` : `${n} clases`)}</span>
              ${est === "vencido" ? `<span class="st falta">Vencida el ${pagoVence(m)}</span>` : c && c.estado === "rechazado" ? '<span class="st falta">No se pudo confirmar el comprobante</span>' : ""}</div>
            <div class="v2-ficha-acc"><button class="v2-mini rojo" data-pa="pagar" data-m="${m}">Pagar</button></div></div>`; }).join("")}</div></section>` : ""}
      <section class="v2-sec"><div class="v2-head"><h2>Cómo pagar</h2></div>
        <div class="v2-pasos"><div><b>1</b><span>Transferí el total al alias${P.info.alias ? ` <b>${esc(P.info.alias)}</b>` : ""}.</span></div><div><b>2</b><span>Tocá <b>Pagar ahora</b> y subí la captura del comprobante.</span></div><div><b>3</b><span>Listo: el mes queda <b class="fuitx">pagado</b> y a Gabriel le llega el aviso.</span></div></div>
        <p class="v2-sub">Se paga del 1 al 13 de cada mes.${wa ? ` ¿Dudas? <a href="${waURL(P.info.telGabriel, `Hola Gabi! Soy ${a.nombre}. Tengo una consulta sobre el pago de ${mesSolo(mes)}.`)}" target="_blank" rel="noopener">Escribile a Gabriel</a>.` : ""}</p>
      </section>
    </div>`;
  };

  // Acciones propias del diseño nuevo.
  document.addEventListener("click", e => {
    if (window.MODO_STAFF) return;
    const b = e.target.closest("[data-pa='v2ver'],[data-pa='v2dia'],[data-pa='v2irRec']"); if (!b) return;
    if (b.dataset.pa === "v2irRec") { P.tab = "inicio"; renderPortal(); setTimeout(() => { const el = document.getElementById("secRec"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); return; }
    if (b.dataset.pa === "v2ver") { detalleAbierto = !detalleAbierto; const box = b.closest(".v2-clases"); box.querySelector(".v2-despl").classList.toggle("abierto", detalleAbierto); b.setAttribute("aria-expanded", detalleAbierto); b.firstChild.textContent = detalleAbierto ? "Ocultar " : "Ver detalle "; return; }
    selClase = Number(b.dataset.i); renderPortal();
  }, true);

  // Deslizar para avisar que no vas: al soltar al final abre la misma confirmación de siempre.
  let drag = null;
  document.addEventListener("pointerdown", e => {
    const per = e.target.closest(".v2-perilla"); if (!per) return;
    const sl = per.closest(".v2-slide"); drag = { per, sl, x0: e.clientX, max: sl.clientWidth - per.offsetWidth - 8, pos: 0 };
    per.setPointerCapture(e.pointerId); per.style.transition = "none"; sl.querySelector(".v2-relleno").style.transition = "none";
  });
  document.addEventListener("pointermove", e => {
    if (!drag) return; drag.pos = Math.max(0, Math.min(drag.max, e.clientX - drag.x0));
    drag.per.style.transform = `translateX(${drag.pos}px)`; drag.sl.querySelector(".v2-relleno").style.width = (drag.pos ? drag.pos + drag.per.offsetWidth + 4 : 0) + "px";
    drag.sl.querySelector(".v2-slide-tx").style.opacity = 1 - drag.pos / drag.max;
  });
  function soltar() {
    if (!drag) return; const { per, sl, pos, max } = drag; drag = null;
    const volver = () => { per.style.transition = "transform .25s"; sl.querySelector(".v2-relleno").style.transition = "width .25s"; per.style.transform = ""; sl.querySelector(".v2-relleno").style.width = "0"; sl.querySelector(".v2-slide-tx").style.opacity = 1; };
    if (pos > max * 0.85) { abrirNoVoy(sl); setTimeout(volver, 400); } else volver();
  }
  document.addEventListener("pointerup", soltar); document.addEventListener("pointercancel", soltar);
  document.addEventListener("keydown", e => { const per = e.target.closest && e.target.closest(".v2-perilla"); if (per && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrirNoVoy(per.closest(".v2-slide")); } });
  function abrirNoVoy(sl) {
    const t = document.createElement("button"); t.hidden = true; t.dataset.pa = "novoy"; t.dataset.f = sl.dataset.f; t.dataset.h = sl.dataset.h; t.dataset.t = sl.dataset.t;
    document.body.appendChild(t); t.click(); t.remove();
  }
})();
