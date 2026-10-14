/* ---------- Diseño nuevo de la app del alumno (versión de prueba) ----------
 * Se activa entrando con ?nuevo=1 (queda guardado en ese celu) y se apaga con ?nuevo=0.
 * No cambia ninguna lógica: usa las mismas funciones, datos y botones (data-pa) de alumno.js,
 * solo dibuja distinto el Inicio y le pone el estilo nuevo a todas las pantallas del alumno.
 */
(function () {
  try {
    const q = new URLSearchParams(location.search).get("nuevo");
    if (q === "1") localStorage.setItem("disenoAlumno", "v2");
    if (q === "0") localStorage.removeItem("disenoAlumno");
    if (localStorage.getItem("disenoAlumno") !== "v2") return;
  } catch (e) { return; }
  document.documentElement.classList.add("v2");
  const fl = document.createElement("link"); fl.rel = "stylesheet";
  fl.href = "https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,400..900;1,62..125,400..900&family=Hanken+Grotesk:wght@400;500;600;700&family=Pinyon+Script&display=swap";
  document.head.appendChild(fl);

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
    if (m === "falto" || m === "recupera" || m === "lluvia" || c.aus) return "falta";
    if (`${c.fecha}|${c.hora}` === proxKey) return "prox";
    if (inicioDe(c.fecha, c.hora).getTime() < Date.now()) return "pasada";
    return "luego";
  }

  function cabecera(a, estMes) {
    const mes = mesKey(now);
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
        <div class="v2-slide" data-f="${prox.fecha}" data-h="${prox.hora}" data-t="${prox.tipo}"><div class="v2-relleno"></div><div class="v2-slide-tx">Deslizá si no podés ir</div>
          <div class="v2-perilla" role="button" tabindex="0" aria-label="Avisar que no voy">${flecha}</div></div>
      </div></section>
      <p class="v2-nota">Si no podés venir, avisá con 24 h de anticipación y la clase queda para recuperar.</p>`;
  }

  function tusClases(a, cl, marcas, proxKey) {
    if (!cl.length) return "";
    const mk = cl[0].fecha.slice(0, 7);
    const est = cl.map(c => estadoClase(c, marcas, proxKey));
    const fui = est.filter(e => e === "fui").length, fal = est.filter(e => e === "falta").length, q = est.filter(e => e === "prox" || e === "luego").length;
    if (selClase === null || selClase >= cl.length) { const i = est.indexOf("prox"); selClase = i >= 0 ? i : 0; }
    const TG = { fui: "Fuiste", falta: "Falta", prox: "Próxima", luego: "", pasada: "" };
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
    let tx = e === "fui" ? '<b class="fui">Fuiste</b> a esta clase.' : e === "falta" ? (c.aus && c.aus.conRecupero ? '<b class="falta">Faltaste.</b> Te quedó para recuperar.' : '<b class="falta">Faltaste.</b>') : e === "prox" ? "<b>Tu próxima clase.</b> Te esperamos." : e === "pasada" ? "Todavía no se cargó la asistencia." : `Clase en ${lugarTxt(c.club)}.`;
    if (rp) tx += ` Va <b>${esc(rp.quien)}</b> en tu lugar.`;
    if (c.vuelve) tx += " Confirmaste que venís.";
    const futura = inicioDe(c.fecha, c.hora).getTime() > Date.now();
    const acc = !futura || c.aus || c.vuelve ? "" : rp ? `<button class="v2-mini" data-pa="reempNo" data-f="${c.fecha}" data-h="${c.hora}">Cancelar reemplazo</button>`
      : `<button class="v2-mini rojo" data-pa="novoy" data-f="${c.fecha}" data-h="${c.hora}" data-t="${c.tipo}">No voy</button>${c.tipo === "recupera" ? `<button class="v2-mini" data-pa="reemp" data-f="${c.fecha}" data-h="${c.hora}" data-c="${c.club}">Va otro</button>` : ""}`;
    return `<span class="dl">${tit}</span><span>${tx}</span>${acc ? `<span class="v2-acc">${acc}</span>` : ""}`;
  }

  function cuota(a) {
    const mes = mesKey(now); const est = estPago(a, mes); const monto = montoMes(a, mes); const n = clasesMes(a, mes);
    const deuda = mesesPago().filter(m => m !== mes && estPago(a, m) !== "pagado");
    const vence = new Date(now.getFullYear(), now.getMonth(), DIA_PAGO); const dias = Math.ceil((vence - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / DIA_MS);
    const plazo = conPlazo(mes); const frac = plazo ? Math.max(0, Math.min(1, dias / DIA_PAGO)) : 1;
    const C = 226.2;
    const anillo = est === "pagado" ? `<svg class="v2-tilde" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><small>al día</small>`
      : est === "vencido" ? `<b>!</b><small>vencido</small>` : plazo ? `<b>${Math.max(dias, 0)}</b><small>${dias === 1 ? "día" : "días"}</small>` : `<b>${n}</b><small>clases</small>`;
    const sub = est === "pagado" ? "Gracias, ya está registrado." : est === "vencido" ? `Venció el ${pagoVence(mes)}. Pagalo cuanto antes.` : est === "rechazado" ? "Gabriel no pudo confirmar el comprobante. Volvé a mandarlo." : `${n} clases${plazo ? ` · pagás hasta el ${pagoVence(mes)}` : ""}`;
    return `<section class="v2-pago ${est === "pagado" ? "listo" : ""}">
      <svg class="v2-cancha" viewBox="0 0 200 120" aria-hidden="true"><g><rect x="4" y="4" width="192" height="112"/><line x1="100" y1="0" x2="100" y2="120" stroke-width="4"/><line x1="36" y1="4" x2="36" y2="116"/><line x1="164" y1="4" x2="164" y2="116"/><line x1="36" y1="60" x2="164" y2="60"/></g></svg>
      <span class="v2-vel" aria-hidden="true"></span>
      <div class="v2-pago-g"><div><span class="k">Cuota de ${MESN[Number(mes.slice(5, 7)) - 1]}</span><div class="v2-monto">${est === "pagado" ? "Pagado" : money(monto).replace("$ ", "$")}</div><p>${sub}</p></div>
        <div class="v2-anillo"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="36"/><circle class="arco" cx="42" cy="42" r="36" stroke-dasharray="${C}" stroke-dashoffset="${est === "pagado" ? 0 : (C * (1 - frac)).toFixed(1)}"/></svg><span>${anillo}</span></div></div>
      ${est === "pagado" ? "" : `<button class="v2-pagar" data-pa="pagar" data-m="${mes}">Pagar ahora</button>`}
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
    const prox = misClases(70).find(c => !c.aus && inicioDe(c.fecha, c.hora).getTime() > Date.now());
    const marcas = marcasAl(a); const proxKey = prox ? `${prox.fecha}|${prox.hora}` : "";
    const rec = recAl().reduce((s, x) => s + x.n, 0); const bk = recAl();
    const estMes = estPago(a, mesKey(now));
    return `<div class="v2">${cabecera(a, estMes)}
      ${rec ? `<button class="v2-recordar" data-pa="irRec"><span class="ico"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg></span><span class="tx"><b>${rec} ${rec === 1 ? "clase" : "clases"} para recuperar</b><small>Recuperala antes del ${fechaDM(bk[0].vence)} o se pierde</small></span><span class="v2-cta">Recuperar</span></button>` : ""}
      ${hero(prox)}
      ${tarjetaNotif("alumno")}
      ${tusClases(a, cl, marcas, proxKey)}
      ${cuota(a)}
      ${recuperar(a, wa)}
      <div class="v2-extra"><button class="v2-mini" data-pa="ptab" data-t="ausencias">Programar una ausencia</button><button class="v2-mini" data-pa="calendario">Recordatorios en mi calendario</button>${wa ? `<a class="v2-mini wa" href="${wa}" target="_blank" rel="noopener">Escribirle a Gabriel</a>` : ""}</div>
    </div>`;
  };
  // Ausencias y Pagos: misma información de siempre, con la cabecera nueva arriba.
  const vAusOrig = window.vAusencias, vPagOrig = window.vPagos;
  window.vAusencias = (a, wa) => `<div class="v2">${cabecera(a, estPago(a, mesKey(now)))}<div class="v2-otra">${vAusOrig(a, wa)}</div></div>`;
  window.vPagos = (a, wa) => `<div class="v2">${cabecera(a, estPago(a, mesKey(now)))}<div class="v2-otra">${vPagOrig(a, wa)}</div></div>`;

  // Acciones propias del diseño nuevo.
  document.addEventListener("click", e => {
    if (window.MODO_STAFF) return;
    const b = e.target.closest("[data-pa='v2ver'],[data-pa='v2dia']"); if (!b) return;
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
