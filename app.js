const DIAS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const DIAS_LARGO = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const DIAS_PL = ["domingos","lunes","martes","miércoles","jueves","viernes","sábados"];
const ETAPAS = [
  {k:"nuevo", l:"Nuevos", next:"contactado", nextL:"Ya le escribí"},
  {k:"contactado", l:"Contactados", next:"prueba", nextL:"Agendó prueba"},
  {k:"prueba", l:"Clase de prueba", next:null},
];
const ORIGENES = ["Instagram","WhatsApp","Recomendado","En el club","Otro"];
const CUPO = 4;
const TPL_DEF = {
  cobro: "Hola {nombre}, ¿cómo estás? Te paso lo de {mes}: {precio} x {clases} clases = {total}{extra}.{alias}",
  lluvia: "Hola {nombre}, ¿cómo estás? Hoy se suspende la clase de las {hora} por lluvia. La recuperamos, en estos días te paso opciones.",
  recupera: "Hola {nombre}, ¿cómo estás? Te quedó {pendientes} para recuperar (hasta el {vence}). Tengo lugar {opciones}. ¿Cuál te sirve?"
};
const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2A9.8 9.8 0 0 0 3.6 17l-1.3 4.8 4.9-1.3A9.8 9.8 0 1 0 12 2.2zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.3.1-.1 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.9 2c0 1.2.9 2.3 1 2.5.1.1 1.7 2.6 4.1 3.7 1.5.7 2.1.7 2.9.6.5-.1 1.4-.6 1.6-1.2.2-.6.2-1.1.1-1.2l-.4-.2z"/></svg>';

const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n||0);
const pad = n => String(n).padStart(2,"0");
const now = new Date();
const hoyISO = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
const mesKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
const mesLbl = k => { const [y,m]=k.split("-"); return new Date(+y,+m-1,1).toLocaleDateString("es-AR",{month:"long",year:"numeric"}); };
const mesSolo = k => mesLbl(k).split(" ")[0];
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const telDigits = tel => { let d=String(tel||"").replace(/\D/g,""); if(!d) return ""; if(d.startsWith("54")) return d; if(d.startsWith("0")) d=d.slice(1); if(d.length===10) return "549"+d; if(d.length===11 && d.startsWith("9")) return "54"+d; return d; };
const waURL = (tel,text) => { const d=telDigits(tel); return d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : ""; };
const nombreCorto = n => String(n||"").trim().split(/\s+/)[0].replace(/^./,c=>c.toUpperCase());

const S = { tab:"hoy", club:"", mes:mesKey(now), q:"", dia:now.getDay(), fecha:hoyISO, alumnos:[], leads:[], cfg:{}, loaded:{a:false,l:false}, db:null, dbState:"cargando", downloads:null, asFecha:hoyISO, asClub:"ESPACIO", modo:"owner", esOwner:true, uid:null, user:null, horas:{}, hVal:{}, hMovs:[], fin:[], finEq:{}, asHist:{}, finMes:mesKey(now), horasFecha:hoyISO, metas:null, metasEq:{}, equipo:[], nombres:{}, asMarcas:{}, asKey:null, asUnsub:null, sent:{}, avisos:[], usuarios:[], perfil:null, vistos:{} };

$("#todayLbl").textContent = now.toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"});

function byClub(list){ return S.club ? list.filter(x=>enClub(x,S.club)) : list; }
function activos(){ return byClub(S.alumnos.filter(a=>a.activo!==false)); }
function pago(a,m=S.mes){ return a.pagos && a.pagos[m] && a.pagos[m].pagado; }
function ocurrencias(dia,m){ const [y,mm]=m.split("-").map(Number); let n=0; const last=new Date(y,mm,0).getDate(); for(let d=1;d<=last;d++) if(new Date(y,mm-1,d).getDay()===dia) n++; return n; }
function diasDe(a){ return [...new Set((a.horarios||[]).map(h=>h.dia))]; }
function clasesMes(a,m=S.mes){ return diasDe(a).reduce((s,d)=>s+ocurrencias(d,m),0); }
function cuotaMes(a,m=S.mes){ return a.precioClase>0 ? clasesMes(a,m)*a.precioClase : (a.cuota||0); }
function extraDias(a,m=S.mes){ return diasDe(a).filter(d=>ocurrencias(d,m)===5); }
function ajusteDe(a,m=S.mes){ const p=a.pagos&&a.pagos[m]; return p&&typeof p.ajuste==="number"?p.ajuste:null; }
function montoMes(a,m=S.mes){ const aj=ajusteDe(a,m); return aj!==null?aj:cuotaMes(a,m); }
function cobradoDe(a,m=S.mes){ const p=a.pagos[m]; const aj=ajusteDe(a,m); return aj!==null?aj:(p.monto||cuotaMes(a,m)); }
function horarioTxt(a){ const dos=clubsDe(a).size>1; return (a.horarios||[]).map(h=>`${DIAS[h.dia]} ${h.hora}${dos?` (${CLUB_LBL[clubH(a,h)]})`:""}`).join(" · ") || "Sin horario"; }

/* ---------- Clubes: cada horario tiene su club (hay alumnos que van a los dos) ---------- */
const CLUB_LBL={JUMP:"Jump",ESPACIO:"Espacio"};
function clubH(a,h){ return (h&&h.club)||a.club||"JUMP"; }
function clubsDe(a){ const s=new Set((a.horarios||[]).map(h=>clubH(a,h))); if(!s.size&&a.club) s.add(a.club); return s; }
function enClub(a,club){ return !club||clubsDe(a).has(club); }
function tagsClub(a){ return [...clubsDe(a)].map(c=>`<span class="tag ${c}">${c}</span>`).join(""); }
// Parte de la cuota que corresponde a un club (para los que van a los dos, según sus horarios).
function montoClub(a,club,m=S.mes){ const hs=a.horarios||[]; if(!hs.length) return a.club===club?montoMes(a,m):0; return montoMes(a,m)*hs.filter(h=>clubH(a,h)===club).length/hs.length; }

/* ---------- Clases para recuperar, con vencimiento ----------
   Se recuperan dentro del mes. Si faltó la última semana del mes, tiene hasta el 7 del mes siguiente.
   recN(a) = cuántas tiene. a.recVence = {"2026-10-31": 2, ...} = hasta cuándo vale cada una. */
// Las clases son de lunes a viernes: si el vencimiento cae sábado o domingo, vence el viernes anterior.
function habil(f){ const d=isoDate(f); while(d.getDay()===0||d.getDay()===6) d.setDate(d.getDate()-1); return toISO(d); }
function venceDe(f){ const d=isoDate(f); const fin=new Date(d.getFullYear(),d.getMonth()+1,0); return habil(fin.getDate()-d.getDate()<7 ? toISO(new Date(d.getFullYear(),d.getMonth()+1,7)) : toISO(fin)); }
const fechaDM = f => { const d=isoDate(f); return `${d.getDate()}/${d.getMonth()+1}`; };
// Faltas avisadas por la app que todavía no se ubicaron en su mes (las ubica el proceso automático o la próxima edición).
function recPendAvisos(a){ const L=(!window.MODO_STAFF&&typeof P!=="undefined"?P.avisos:S.avisos)||[];
  return L.filter(v=>v.alumnoId===a.id&&v.tipo==="ausencia"&&v.conRecupero&&v.contado===false&&!L.some(x=>x.alumnoId===a.id&&x.tipo==="recupera"&&x.fecha===v.fecha&&x.hora===v.hora)); }
// Devuelve las vigentes: [{vence, n}] ordenadas. a.recuperar manda en la cantidad; si tiene menos, se descuentan las que vencen antes.
function recBuckets(a,pend=recPendAvisos(a).map(v=>v.fecha)){
  const tot=Math.max(0,a.recuperar||0); const m={};
  Object.entries(a.recVence||{}).forEach(([k,n])=>{ n=Number(n)||0; if(n>0){ k=habil(k); m[k]=(m[k]||0)+n; } });
  pend.forEach(f=>{ const k=venceDe(f); m[k]=(m[k]||0)+1; });
  const sum=Object.values(m).reduce((s,n)=>s+n,0);
  if(tot>sum){ const k=venceDe(hoyISO); m[k]=(m[k]||0)+tot-sum; }
  else if(tot<sum){ let r=sum-tot; for(const k of Object.keys(m).sort()){ const q=Math.min(r,m[k]); m[k]-=q; r-=q; if(!m[k]) delete m[k]; if(!r) break; } }
  return Object.keys(m).filter(k=>k>=hoyISO).sort().map(k=>({vence:k,n:m[k]}));
}
function recN(a){ return recBuckets(a).reduce((s,x)=>s+x.n,0); }
function recVenceTxt(a){ return recBuckets(a).map(x=>`${x.n} hasta el ${fechaDM(x.vence)}`).join(" · "); }
// Suma (delta>0, por una falta del día "fecha") o descuenta (delta<0, primero las que vencen antes) y devuelve lo que hay que guardar.
function recCambio(a,delta,fecha=hoyISO,quitarDe=null){
  const m={}; recBuckets(a).forEach(x=>m[x.vence]=x.n);
  if(delta>0){ const k=venceDe(fecha); m[k]=(m[k]||0)+delta; }
  else if(delta<0){ let r=-delta; const ks=Object.keys(m).sort(); if(quitarDe&&m[quitarDe]) ks.unshift(quitarDe);
    for(const k of ks){ if(!r) break; const q=Math.min(r,m[k]||0); if(!q) continue; m[k]-=q; r-=q; if(!m[k]) delete m[k]; } }
  // Las fechas que ya no corresponden se guardan en 0 (la app guarda mezclando campos, no reemplazando).
  const out={}; Object.keys(a.recVence||{}).forEach(k=>{ out[k]=0; }); Object.assign(out,m);
  return {recuperar:Object.values(m).reduce((s,n)=>s+n,0), recVence:out};
}

/* ---------- Turnos y lugares libres ---------- */
function turnos(club){
  const map={};
  S.alumnos.filter(a=>a.activo!==false).forEach(a=>(a.horarios||[]).forEach(h=>{
    const c=clubH(a,h); if(club&&c!==club) return;
    const k=`${c}|${h.dia}|${h.hora}`; const t=map[k]||(map[k]={club:c,dia:h.dia,hora:h.hora,nivel:"",al:[]});
    t.al.push(a); if(h.nivel) t.nivel=h.nivel;
  }));
  return Object.values(map);
}
function slotsDe(dia){ return turnos(S.club).filter(t=>t.dia===dia).sort((x,y)=>x.hora.localeCompare(y.hora)||x.club.localeCompare(y.club)); }
const catNorm = c => String(c||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/^iniciales$/,"inicial");
function catsDe(a){ const set=new Set(); String(a.categoria||"").split(",").map(catNorm).filter(Boolean).forEach(c=>set.add(c)); (a.horarios||[]).forEach(h=>h.nivel&&set.add(catNorm(h.nivel))); return set; }
function ordenSemana(t){ const hoyD=now.getDay()||7; return (((t.dia||7)-hoyD+7)%7)*10000+Number(String(t.hora).replace(":","")); }
function opcionesRecupera(a,max=3){
  const mios=new Set((a.horarios||[]).map(h=>`${clubH(a,h)}|${h.dia}|${h.hora}`)); const cats=catsDe(a); const cl=clubsDe(a);
  return turnos("").filter(t=>cl.has(t.club) && t.al.length<CUPO && !mios.has(`${t.club}|${t.dia}|${t.hora}`) && (cats.size ? (t.nivel && cats.has(catNorm(t.nivel))) : true))
    .sort((x,y)=>ordenSemana(x)-ordenSemana(y)).slice(0,max);
}

/* ---------- Mensajes ---------- */
function tpl(k){ return (S.cfg.tpl&&S.cfg.tpl[k])||TPL_DEF[k]; }
function fill(t,v){ return t.replace(/\{(\w+)\}/g,(m,k)=>v[k]!==undefined?v[k]:m).replace(/\s+([.,])/g,"$1").replace(/ {2,}/g," ").trim(); }
function msgCobro(a){
  const ex=extraDias(a); const n=clasesMes(a);
  const extra = ex.length ? ` (incluye ${ex.length===1?"una clase extra":ex.length+" clases extra"})` : "";
  const alias = S.cfg.alias ? ` Podés transferir al alias ${S.cfg.alias}.` : "";
  const aj=ajusteDe(a);
  if(aj!==null){ const na=a.precioClase?aj/a.precioClase:0;
    if(na>0&&Number.isInteger(na)) return fill(tpl("cobro"),{nombre:nombreCorto(a.nombre),mes:mesSolo(S.mes),clases:na,precio:money(a.precioClase),total:money(aj),extra:"",alias});
    return `Hola ${nombreCorto(a.nombre)}, ¿cómo estás? Te paso lo de ${mesSolo(S.mes)}: el total es ${money(aj)}.${alias}`.trim(); }
  return fill(tpl("cobro"),{nombre:nombreCorto(a.nombre),mes:mesSolo(S.mes),clases:n,precio:money(a.precioClase),total:money(cuotaMes(a)),extra,alias});
}
function msgLluvia(a,hora){
  const h = hora || ((a.horarios||[]).find(x=>x.dia===now.getDay())||{}).hora || "";
  return fill(tpl("lluvia"),{nombre:nombreCorto(a.nombre),hora:h||"hoy"}).replace("de las hoy","de hoy");
}
function msgRecupera(a){
  const p=recN(a)||1; const ops=opcionesRecupera(a); const bk=recBuckets(a); const vence=fechaDM(bk.length?bk[0].vence:venceDe(hoyISO));
  const txt = ops.length ? ops.map(t=>`el ${DIAS_LARGO[t.dia].toLowerCase()} a las ${t.hora}`).join(", ").replace(/, ([^,]*)$/," o $1") : "esta semana, decime qué día te queda bien";
  return fill(tpl("recupera"),{nombre:nombreCorto(a.nombre),pendientes:p===1?"una clase":p+" clases",opciones:txt,vence});
}
function msgCard(k,titulo,a,texto,extraBtn=""){
  const url=waURL(a.tel,texto); const key=`${a.id}|${k}`;
  return `<div class="msg"><div class="msg-k"><b>${titulo}</b>${S.sent[key]?'<span class="sent">Abierto ✓</span>':""}</div>
    <div class="bubble">${esc(texto)}</div>
    <div class="msg-actions">
      ${url?`<a class="cta wa" href="${url}" target="_blank" rel="noopener" data-sent="${key}">Mandar por WhatsApp <i>→</i></a>`:`<span class="small due">Falta el teléfono</span>`}
      <button class="mini" data-act="copy" data-text="${esc(texto)}">Copiar</button>${extraBtn}
    </div></div>`;
}
function openMensajes(a){
  openSheet(`<div style="display:grid;gap:4px"><span class="flabel">Mensajes para</span><h2 class="disp">${esc(a.nombre)}</h2>
    <span class="small muted">${a.tel?esc(a.tel):"Sin teléfono cargado"} · ${[...clubsDe(a)].map(c=>CLUB_LBL[c]).join(" y ")}</span></div>
    ${msgCard("cobro","Cobro de "+mesSolo(S.mes),a,msgCobro(a))}
    ${msgCard("lluvia","Suspensión por lluvia",a,msgLluvia(a),`<button class="mini" data-act="recMas" data-id="${a.id}">Sumar clase a recuperar</button>`)}
    ${msgCard("recupera","Recuperar clase",a,msgRecupera(a))}
    <p class="small muted" style="margin:0">WhatsApp se abre con el mensaje escrito. Solo tocás enviar.</p>
    <div class="btns"><span></span><button class="btn sec2" data-act="close">Listo</button></div>`);
}
function openLluvia(club,dia,hora,fecha=hoyISO){
  const t=turnos(club).find(x=>x.dia===dia&&x.hora===hora); if(!t) return;
  openSheet(`<div style="display:grid;gap:4px"><span class="flabel">Suspender por lluvia · ${club}</span><h2 class="disp">${DIAS_LARGO[dia]} ${hora}</h2>
    <span class="small muted">Tocá cada alumno para mandarle el aviso.</span></div>
    <div class="list">${t.al.map(a=>{const url=waURL(a.tel,msgLluvia(a,hora)); const key=`${a.id}|lluvia`;
      return `<div class="row"><div class="main"><span class="name">${esc(a.nombre)}</span><span class="meta">${S.sent[key]?'<span class="sent">Aviso abierto ✓</span>':(a.tel?"":'<span class="due">Sin teléfono</span>')}${recN(a)?`<span class="tag rec">Recupera ${recN(a)}</span>`:""}</span></div>
      ${url?`<a class="cta wa" style="padding:6px 6px 6px 14px;font-size:13px" href="${url}" target="_blank" rel="noopener" data-sent="${key}">Avisar <i>→</i></a>`:""}</div>`}).join("")}</div>
    <button class="btn pri" data-act="recTurno" data-club="${club}" data-dia="${dia}" data-hora="${hora}" data-f="${fecha}">Anotar a todos para recuperar</button>
    <div class="btns"><span></span><button class="btn sec2" data-act="close">Cerrar</button></div>`);
}
function openCfg(){
  const t=k=>esc(tpl(k));
  openSheet(`<form id="fC" style="display:grid;gap:14px"><h2 class="disp">Ajustes</h2>
    <div class="field"><label for="cAlias">Alias para transferencias</label><input id="cAlias" value="${esc(S.cfg.alias)}" placeholder="ej: gabriel.padel.mp"><span class="small muted">Si lo cargás, se agrega solo al mensaje de cobro.</span></div>
    <div class="field"><label for="cObj">Objetivo de horas por mes (profes)</label><input id="cObj" type="number" inputmode="numeric" min="0" value="${S.cfg.objetivoHoras||""}" placeholder="Si lo dejás vacío, el objetivo es superar el mes pasado"></div>
    <button type="button" class="mini" data-act="modoProfe" style="justify-self:start">Ver la app como la ve Esteban</button>
    ${cfgExtraHTML()}
    <div class="field"><label for="cCobro">Cobro del mes</label><textarea id="cCobro" rows="4">${t("cobro")}</textarea></div>
    <div class="field"><label for="cLluvia">Suspensión por lluvia</label><textarea id="cLluvia" rows="3">${t("lluvia")}</textarea></div>
    <div class="field"><label for="cRec">Recuperar clase</label><textarea id="cRec" rows="3">${t("recupera")}</textarea></div>
    <p class="legend" style="margin:0">Palabras que se completan solas: <code>{nombre}</code> <code>{mes}</code> <code>{clases}</code> <code>{precio}</code> <code>{total}</code> <code>{extra}</code> (aclara la clase extra) <code>{alias}</code> <code>{hora}</code> <code>{pendientes}</code> <code>{vence}</code> (hasta cuándo puede recuperar) <code>{opciones}</code> (turnos con lugar libre).</p>
    <div class="btns"><button type="button" class="btn del" data-act="cfgReset">Volver a los originales</button><span style="display:flex;gap:8px"><button type="button" class="btn sec2" data-act="close">Cancelar</button><button class="btn pri">Guardar</button></span></div>
  </form>`);
}

/* ---------- Views ---------- */
const PADDLE_SVG = `<svg class="paddle" viewBox="0 0 200 260" aria-hidden="true"><g transform="translate(70 12) rotate(28 60 120)">
<path d="M60 0C104 0 120 34 120 72C120 112 96 140 72 152L66 176H54L48 152C24 140 0 112 0 72C0 34 16 0 60 0Z" fill="#0C1712" stroke="#F1DD88" stroke-width="5"/>
<path d="M60 9C97 9 111 38 111 72C111 106 90 131 60 141C30 131 9 106 9 72C9 38 23 9 60 9Z" fill="#15281E"/>
<g fill="#09110D" stroke="rgba(241,221,136,.35)" stroke-width="1"><circle cx="35" cy="32" r="4.2"/><circle cx="52" cy="32" r="4.2"/><circle cx="69" cy="32" r="4.2"/><circle cx="86" cy="32" r="4.2"/><circle cx="35" cy="49" r="4.2"/><circle cx="52" cy="49" r="4.2"/><circle cx="69" cy="49" r="4.2"/><circle cx="86" cy="49" r="4.2"/><circle cx="18" cy="66" r="4.2"/><circle cx="35" cy="66" r="4.2"/><circle cx="52" cy="66" r="4.2"/><circle cx="69" cy="66" r="4.2"/><circle cx="86" cy="66" r="4.2"/><circle cx="103" cy="66" r="4.2"/><circle cx="18" cy="83" r="4.2"/><circle cx="35" cy="83" r="4.2"/><circle cx="52" cy="83" r="4.2"/><circle cx="69" cy="83" r="4.2"/><circle cx="86" cy="83" r="4.2"/><circle cx="103" cy="83" r="4.2"/><circle cx="35" cy="100" r="4.2"/><circle cx="52" cy="100" r="4.2"/><circle cx="69" cy="100" r="4.2"/><circle cx="86" cy="100" r="4.2"/><circle cx="35" cy="117" r="4.2"/><circle cx="52" cy="117" r="4.2"/><circle cx="69" cy="117" r="4.2"/><circle cx="86" cy="117" r="4.2"/></g>
<rect x="51" y="174" width="18" height="70" rx="6" fill="#F1DD88"/>
<g stroke="#1B1806" stroke-width="2" opacity=".55"><line x1="51" y1="186" x2="69" y2="196"/><line x1="51" y1="200" x2="69" y2="210"/><line x1="51" y1="214" x2="69" y2="224"/><line x1="51" y1="228" x2="69" y2="238"/></g>
<rect x="49" y="240" width="22" height="8" rx="3" fill="#0C1712"/></g>
<g transform="translate(40 190)"><circle r="26" fill="#D6EE3B"/><path d="M-22 -13C-8 -5 -8 9 -20 17M22 -14C9 -6 8 8 21 16" fill="none" stroke="#F7FBE6" stroke-width="3.5" stroke-linecap="round"/><circle r="26" fill="none" stroke="rgba(0,0,0,.12)" stroke-width="2"/></g></svg>`;
const COURT_SVG = `<span class="hero-glow" aria-hidden="true"></span>`;
function vHoy(){
  const al=activos(); const pag=al.filter(a=>pago(a)); const deben=al.filter(a=>!pago(a));
  const cobrado=pag.reduce((s,a)=>s+cobradoDe(a),0);
  const pend=deben.reduce((s,a)=>s+montoMes(a),0);
  const pct=al.length?Math.round(pag.length/al.length*100):0;
  const dow=now.getDay(); const clases=S.mes===mesKey(now)?slotsDe(dow):[];
  const recs=al.filter(a=>recN(a)>0);
  return `
  <section class="hero" aria-label="Resumen del mes">${COURT_SVG}
    <div class="month"><button data-act="mes" data-d="-1" aria-label="Mes anterior">‹</button><span class="pill-date">${mesLbl(S.mes)}</span><button data-act="mes" data-d="1" aria-label="Mes siguiente">›</button></div>
    <div class="hero-main"><div class="mega num">${String(al.length).padStart(2,"0")}</div><div class="spec"><span class="spec-k">Alumnos activos</span><span>${S.club?S.club:`Jump ${S.alumnos.filter(a=>a.activo!==false&&enClub(a,"JUMP")).length} · Espacio ${S.alumnos.filter(a=>a.activo!==false&&enClub(a,"ESPACIO")).length}`}</span><span class="spec-k" style="margin-top:8px">Total del mes</span><span class="num">${money(cobrado+pend)}</span></div></div>
    <div class="hero-stats">
      <div class="stat"><div class="val num">${al.length}</div><div class="lbl">Alumnos</div></div>
      <div class="stat"><div class="val num">${pag.length}<small>/${al.length}</small></div><div class="lbl">Pagaron</div></div>
      <button class="stat" data-act="tab" data-t="recuperar" style="background:none;border:0;padding:0;text-align:left;color:inherit"><div class="val num">${recs.reduce((s,a)=>s+recN(a),0)}</div><div class="lbl">A recuperar ›</div></button>
    </div>
    <div class="bar" aria-label="${pct}% cobrado"><i style="width:${pct}%"></i></div>
    <div class="hero-foot num"><span>Cobrado <b>${money(cobrado)}</b></span><span>Falta <b style="color:var(--sun)">${money(pend)}</b></span></div>
  </section>
  ${S.esOwner&&S.modo!=="profe"?tarjetaNotif("dueño"):""}
  ${avisosHoyHTML()}

  ${clases.length?`<section class="sec"><div class="sec-head"><h3>Clases de hoy · ${DIAS_LARGO[dow]}</h3><button class="linkish" data-act="tab" data-t="agenda">Ver semana</button></div><div class="list">${clases.map(t=>slotHTML(t,hoyISO)).join("")}</div></section>`:""}

  ${recs.length?`<section class="sec"><div class="sec-head"><h3>Tienen clases para recuperar</h3><button class="linkish" data-act="tab" data-t="recuperar">Ver todo</button></div><div class="list">${recs.slice(0,5).map(recRow).join("")}</div></section>`:""}


  ${avisoOwner()}
  ${panelEquipo()}
  <section class="sec">
    <div class="sec-head"><h3>Deben ${mesSolo(S.mes)}</h3><span class="small muted">${deben.length}</span></div>
    ${deben.length?`<div class="list">${deben.map(alRow).join("")}</div>`:al.length?`<div class="empty"><b>Todos al día.</b> Nadie debe este mes.</div>`:emptyAlumnos()}
  </section>`;
}
function emptyAlumnos(){ return `<div class="empty">Todavía no hay alumnos. Tocá <b>Alumno +</b>: nombre, club, horario y precio por clase.</div>`; }

function alRow(a){
  const p=pago(a); const c=montoMes(a); const aj=ajusteDe(a)!==null; const ex=extraDias(a).length;
  return `<div class="row"><button class="main" data-act="editA" data-id="${a.id}">
    <span class="name">${esc(a.nombre)}</span>
    <span class="meta">${tagsClub(a)}${recN(a)>0?`<span class="tag rec">Recupera ${recN(a)}</span>`:""}<span>${esc(horarioTxt(a))}</span>${ex&&!aj&&c?"<span>Con clase extra</span>":""}${aj?'<span style="color:var(--sun)">Monto ajustado</span>':""}${a.activo===false?"<span>· Pausado</span>":""}</span>
  </button>
  <div class="row-act">${a.activo===false?"":`<button class="msg-btn" data-act="msg" data-id="${a.id}" aria-label="Mensajes para ${esc(a.nombre)}">${WA_ICON}</button><button class="amt num ${aj?"aj":""}" data-act="ajuste" data-id="${a.id}" aria-label="Cambiar monto de ${esc(a.nombre)}">${c?money(c):"Sin precio"}</button><button class="pay ${p?"ok":"no"}" data-act="pago" data-id="${a.id}">${p?"Pagó":"Debe"}</button>`}</div></div>`;
}

function vAlumnos(){
  let list=byClub(S.alumnos);
  if(S.q){ const q=S.q.toLowerCase(); list=list.filter(a=>(a.nombre||"").toLowerCase().includes(q)||(a.tel||"").includes(q)); }
  list.sort((a,b)=>(a.activo===false)-(b.activo===false)||(a.nombre||"").localeCompare(b.nombre||""));
  const act=list.filter(a=>a.activo!==false).length;
  return `
  <section class="sec" style="margin-top:4px">
    <input class="search" id="q" type="search" placeholder="Buscar por nombre o teléfono" value="${esc(S.q)}" autocomplete="off">
    <div class="sec-head"><h3>${act} activos${list.length>act?` · ${list.length-act} pausados`:""}</h3>
      <span style="display:flex;gap:12px;align-items:center"><button class="linkish" data-act="mes" data-d="-1" aria-label="Mes anterior">‹</button><span class="small" style="text-transform:capitalize">${mesLbl(S.mes)}</span><button class="linkish" data-act="mes" data-d="1" aria-label="Mes siguiente">›</button></span></div>
    ${list.length?`<div class="list">${list.map(alRow).join("")}</div>`:(S.alumnos.length?`<div class="empty">Nadie coincide con “${esc(S.q)}”.</div>`:emptyAlumnos())}
    ${S.alumnos.length&&S.downloads?`<button class="linkish" data-act="csv" style="justify-self:start">Descargar lista (CSV)</button>`:""}
  </section>`;
}

function esNuevo(a){ if(a.codigo||!a.alta) return false; const d=new Date(now); d.setDate(d.getDate()-21); return a.alta>=toISO(d); }
function slotHTML(t,fecha){
  const aj=fecha?ajusteTurno(t,fecha):{aus:new Set(),rec:[]}; const libres=CUPO-t.al.length+aj.aus.size-aj.rec.length;
  return `<div class="slot"><div class="side"><div class="h num">${t.hora||"—"}</div>${S.club?"":`<span class="tag ${t.club}" style="justify-self:start">${t.club}</span>`}<span class="small muted">${esc(t.nivel)}</span><span class="small ${libres>0?"free":"muted"}">${libres>0?libres+" libre"+(libres>1?"s":""):"Completo"}</span></div>
    <div style="display:grid;gap:4px;min-width:0"><div class="who">${t.al.map(a=>`<button class="pill ${t.club} ${esNuevo(a)?"nuevo":""} ${aj.aus.has(a.id)?"aus":""}" data-act="editA" data-id="${a.id}">${esc(a.nombre)}${esNuevo(a)?' <b class="nuevo-b">Nuevo</b>':""}${aj.aus.has(a.id)?' <b class="aus-b">No viene</b>':""}</button>`).join("")}${aj.rec.map(a=>`<button class="pill rec" data-act="editA" data-id="${a.id}">${esc(a.nombre)} <b class="rec-b">Recupera</b></button>`).join("")}</div>
    <button class="linkish suspend" data-act="lluvia" data-club="${t.club}" data-dia="${t.dia}" data-hora="${t.hora}" data-f="${fecha||hoyISO}">Suspender por lluvia</button></div></div>`;
}
const AGENDA_DESDE="2026-10-07";
function fechasAgenda(){
  const out=[]; const [y,m,d]=AGENDA_DESDE.split("-").map(Number); const f=new Date(y,m-1,d);
  const hasta=new Date(now.getFullYear(),now.getMonth(),now.getDate()+42);
  while(f<=hasta){ out.push(new Date(f)); f.setDate(f.getDate()+1); }
  return out;
}
function vAgenda(){
  const fechas=fechasAgenda();
  const sel=fechas.find(f=>toISO(f)===S.fecha)||now; S.dia=sel.getDay();
  const iso0=toISO(sel); const slots=slotsDe(S.dia); const al=slots.reduce((s,x)=>{const j=ajusteTurno(x,iso0); return s+x.al.length-j.aus.size+j.rec.length;},0); const lib=slots.reduce((s,x)=>{const j=ajusteTurno(x,iso0); return s+Math.max(0,CUPO-x.al.length+j.aus.size-j.rec.length);},0);
  const man=new Date(now); man.setDate(man.getDate()+1);
  const iso=toISO(sel); const extra=iso===hoyISO?"Hoy · ":iso===toISO(man)?"Mañana · ":"";
  const mesTxt=sel.toLocaleDateString("es-AR",{month:"long"});
  return `
  <section class="sec" style="margin-top:4px">
    <div class="days" id="daysStrip">${fechas.map((f,i)=>{const k=toISO(f);const n=slotsDe(f.getDay()).length;const mes=(i===0||f.getDate()===1)?`<span class="mes">${f.toLocaleDateString("es-AR",{month:"short"}).replace(".","")}</span>`:"";return `<button class="day ${k===hoyISO?"hoy":""}" data-act="fecha" data-f="${k}" aria-pressed="${k===iso}" aria-label="${DIAS_LARGO[f.getDay()]} ${f.getDate()}">${mes}<small>${DIAS[f.getDay()]}</small><b class="num">${f.getDate()}</b><span class="cnt num">${n?n+" t":"–"}</span></button>`}).join("")}</div>
    <div class="sec-head" style="margin-top:6px"><h2 class="disp">${DIAS_LARGO[S.dia]} ${sel.getDate()}</h2><span class="small muted num">${extra}<span style="text-transform:capitalize">${mesTxt}</span> · ${S.modo==="profe"?`${slots.length} hora${slots.length===1?"":"s"} de clase · ${al} alumnos`:`${slots.length} turnos · ${al} alumnos · ${lib} libres`}</span></div>
    ${slots.length?`<div class="list">${slots.map(t=>slotHTML(t,iso)).join("")}</div>`:`<div class="empty">Sin clases ${DIAS_LARGO[S.dia].toLowerCase()}${S.club?" en "+S.club:""}.</div>`}
  </section>`;
}
function centrarDia(){ const st=document.getElementById("daysStrip"); if(!st) return; const b=st.querySelector('[aria-pressed="true"]'); if(b) st.scrollLeft=Math.max(0,b.offsetLeft-st.offsetLeft-16-b.offsetWidth*2); }
setInterval(()=>{ const d=new Date(); if(toISO(d)!==hoyISO) location.reload(); },60000);

function recRow(a){
  const ops=opcionesRecupera(a); const url=waURL(a.tel,msgRecupera(a)); const key=`${a.id}|recupera`;
  return `<div class="row" style="grid-template-columns:1fr"><div class="main" style="gap:6px">
    <button style="background:none;border:0;text-align:left;padding:0;display:grid;gap:3px" data-act="editA" data-id="${a.id}"><span class="name">${esc(a.nombre)}</span>
      <span class="meta">${tagsClub(a)}${a.categoria?`<span>${esc(a.categoria)}</span>`:""}<span class="tag rec">Recupera ${recN(a)}</span>${S.sent[key]?'<span class="sent">Mensaje abierto ✓</span>':""}</span><span class="small" style="color:var(--sun);font-weight:700">Vence: ${recVenceTxt(a)}</span></button>
    <span class="small">${ops.length?`<span class="muted">Lugares:</span> ${ops.map(t=>`<b class="free">${DIAS[t.dia]} ${t.hora}</b>`).join(" · ")}`:`<span class="due">Sin lugar libre en su categoría</span>`}</span>
    <div class="row-act" style="flex-wrap:wrap">
      ${url?`<a class="cta wa" style="padding:6px 6px 6px 14px;font-size:13px" href="${url}" target="_blank" rel="noopener" data-sent="${key}">Mandar mensaje <i>→</i></a>`:`<span class="small due">Falta el teléfono</span>`}
      <button class="mini" data-act="recMenos" data-id="${a.id}">Ya recuperó</button>
    </div></div></div>`;
}
function vRecuperar(){
  const recs=activos().filter(a=>recN(a)>0).sort((x,y)=>(recN(y)-recN(x))||x.nombre.localeCompare(y.nombre));
  const tot=recs.reduce((s,a)=>s+recN(a),0);
  const libres=turnos(S.club).filter(t=>t.al.length<CUPO);
  const grupos={}; libres.forEach(t=>{ const k=`${t.club} · ${t.nivel||"sin categoría"}`; (grupos[k]=grupos[k]||[]).push(t); });
  return `
  <section class="sec" style="margin-top:4px">
    <div class="sec-head"><h2 class="disp">Recuperar</h2><button class="cta" data-act="recAdd" style="padding:6px 6px 6px 14px;font-size:13px">Anotar <i>+</i></button></div>
    <p class="small muted" style="margin:0">${recs.length?`${recs.length} alumno${recs.length>1?"s":""} · ${tot} clase${tot>1?"s":""} pendiente${tot>1?"s":""}. El mensaje ya le ofrece los lugares libres de su categoría.`:"Acá aparece quién tiene que recuperar."} Se recuperan dentro del mes; si faltó la última semana, tiene la primera semana del mes siguiente. Si no, se pierden solas.</p>
    ${recs.length?`<div class="list">${recs.map(recRow).join("")}</div>`:`<div class="empty">Nadie tiene clases pendientes. Se suman cuando suspendés un turno por lluvia en <b>Agenda</b>, o tocando <b>Anotar +</b> cuando alguien falta.</div>`}
  </section>
  <section class="sec">
    <div class="sec-head"><h3>Lugares libres por categoría</h3><span class="small muted num">${libres.reduce((s,t)=>s+CUPO-t.al.length,0)} lugares</span></div>
    ${Object.keys(grupos).length?`<div class="list">${Object.keys(grupos).sort().map(k=>`<div class="row" style="grid-template-columns:1fr"><div class="main" style="gap:6px"><span class="name" style="text-transform:capitalize">${esc(k)}</span><div class="who" style="display:flex;flex-wrap:wrap;gap:6px">${grupos[k].sort((x,y)=>ordenSemana(x)-ordenSemana(y)).map(t=>`<span class="pill">${DIAS[t.dia]} ${t.hora} · <b class="free">${CUPO-t.al.length}</b></span>`).join("")}</div></div></div>`).join("")}</div>`:`<div class="empty">Todos los turnos están completos.</div>`}
  </section>`;
}
function openRecAdd(q=""){
  const list=activos().filter(a=>!q||a.nombre.toLowerCase().includes(q.toLowerCase())).sort((x,y)=>x.nombre.localeCompare(y.nombre)).slice(0,40);
  openSheet(`<div style="display:grid;gap:4px"><h2 class="disp">Anotar para recuperar</h2><span class="small muted">Tocá quién faltó. Le suma una clase a recuperar.</span></div>
    <input class="search" id="recQ" type="search" placeholder="Buscar alumno" value="${esc(q)}" autocomplete="off">
    <div class="list" id="recList">${list.map(a=>`<button class="row" style="background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;width:100%" data-act="recMas" data-id="${a.id}"><span class="main"><span class="name">${esc(a.nombre)}</span><span class="meta">${tagsClub(a)}<span>${esc(horarioTxt(a))}</span>${recN(a)?`<span class="tag rec">Recupera ${recN(a)}</span>`:""}</span></span><span class="mini">+1</span></button>`).join("")||'<div class="empty">Nadie coincide.</div>'}</div>
    <div class="btns"><span></span><button class="btn sec2" data-act="close">Listo</button></div>`);
  const i=$("#recQ"); i.focus(); i.setSelectionRange(i.value.length,i.value.length);
}
function leadRow(l){
  const et=ETAPAS.find(e=>e.k===l.estado); const wa=telDigits(l.tel)?`https://wa.me/${telDigits(l.tel)}`:""; const vence=l.proximo&&l.proximo<=hoyISO;
  return `<div class="row" style="grid-template-columns:1fr"><div class="main" style="gap:4px">
    <button style="background:none;border:0;text-align:left;padding:0" data-act="editL" data-id="${l.id}"><span class="name">${esc(l.nombre)}</span></button>
    <span class="meta">${l.club?`<span class="tag ${l.club}">${l.club}</span>`:""}<span>${esc(l.origen||"")}</span>${l.proximo?`<span class="${vence?"due":""}">${vence?"Escribir hoy":"Escribir el "+l.proximo.split("-").reverse().slice(0,2).join("/")}</span>`:""}${wa?`<a class="wa-link" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>`:""}</span>
    ${l.nota?`<span class="small muted">${esc(l.nota)}</span>`:""}
    <div class="row-act" style="flex-wrap:wrap;margin-top:4px">
      ${et&&et.next?`<button class="mini go" data-act="avanzar" data-id="${l.id}">${et.nextL}</button>`:""}
      ${l.estado==="prueba"?`<button class="mini" style="background:var(--sun);color:var(--sun-ink);border-color:var(--sun)" data-act="convertir" data-id="${l.id}">Se sumó como alumno</button>`:""}
      <button class="mini" data-act="perdido" data-id="${l.id}">No sigue</button>
    </div></div></div>`;
}
/* ---------- Ajuste de cobro ---------- */
function ajPreview(){ const f=$("#fAj"); if(!f) return; const a=S.alumnos.find(x=>x.id===f.dataset.id); const v=Number($("#ajMonto").value)||0; const d=v-cuotaMes(a);
  $("#ajDif").innerHTML = d===0?"Igual al calculado":`${d>0?"+":"−"}${money(Math.abs(d))} ${a.precioClase&&Number.isInteger(Math.abs(d)/a.precioClase)?`(${Math.abs(d)/a.precioClase} clase${Math.abs(d)/a.precioClase>1?"s":""} ${d>0?"de más":"de menos"})`:""} contra el calculado`; }
function openAjuste(a){
  const n=clasesMes(a), base=cuotaMes(a), cur=montoMes(a), p=a.pagos&&a.pagos[S.mes]||{}; const ex=extraDias(a).length;
  openSheet(`<form id="fAj" data-id="${a.id}" style="display:grid;gap:14px">
    <div style="display:grid;gap:4px"><span class="flabel">Cobro de ${mesLbl(S.mes)}</span><h2 class="disp">${esc(a.nombre)}</h2></div>
    <dl class="kv" style="margin:0"><dt>Calculado</dt><dd class="num">${n} clases x ${money(a.precioClase)} = ${money(base)}</dd>${ex?`<dt></dt><dd class="small muted" style="font-weight:500">incluye ${ex===1?"una clase extra":ex+" clases extra"}</dd>`:""}</dl>
    <div class="field"><label for="ajMonto">Lo que te paga este mes</label><input id="ajMonto" type="number" inputmode="numeric" min="0" step="250" value="${cur}"><span class="small muted" id="ajDif"></span></div>
    ${a.precioClase?`<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="mini" data-act="ajStep" data-d="-${a.precioClase}">− 1 clase</button><button type="button" class="mini" data-act="ajStep" data-d="${a.precioClase}">+ 1 clase</button><button type="button" class="mini" data-act="ajReset">Usar el calculado</button></div>`:""}
    <div class="field"><label for="ajNota">Motivo (opcional)</label><input id="ajNota" value="${esc(p.nota||"")}" placeholder="Ej: avisó que no viene el 15"></div>
    <p class="small muted" style="margin:0">Este monto es el que cuenta en el total del mes y el que va en el mensaje de cobro. Solo cambia ${mesSolo(S.mes)}.</p>
    <div class="btns"><span></span><span style="display:flex;gap:8px"><button type="button" class="btn sec2" data-act="close">Cancelar</button><button class="btn pri">Guardar</button></span></div>
  </form>`);
  ajPreview(); $("#ajMonto").addEventListener("input",ajPreview);
}
/* ---------- Panel Esteban / ganancia ---------- */
let aumPct=10;
function panelEquipo(){
  const tot=activos().reduce((s,a)=>s+montoMes(a),0); const totJ=S.alumnos.filter(a=>a.activo!==false).reduce((s,a)=>s+montoClub(a,"JUMP"),0);
  const vh=S.cfg.valorHora||0; const eq=S.equipo.length?S.equipo:[{id:"_",dias:{}}];
  const h=eq.reduce((s,x)=>s+horasMes(x.dias,S.mes),0), hp=eq.reduce((s,x)=>s+horasMes(x.dias,mesAnt(S.mes)),0);
  const pagoE=S.equipo.length?ganadoEn(S.mes):0, neta=tot-pagoE, pct=tot?pagoE/tot*100:0, pctJ=totJ?pagoE/totJ*100:0;
  const nuevoV=Math.round(vh*(1+aumPct/100)), nuevoP=h*nuevoV;
  const nombre=eq.map(x=>S.nombres[x.id]).filter(Boolean).join(", ")||"Esteban";
  return `<section class="sec"><div class="sec-head"><h3>${esc(nombre)} y tu ganancia · ${mesSolo(S.mes)}</h3></div>
    <div class="list" style="padding:16px;display:grid;gap:16px">
      <div class="hero-stats" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat"><div class="big-num num">${fmtH(h)}</div><div class="lbl" style="color:var(--muted)">Horas · antes ${fmtH(hp)}</div></div>
        <div class="stat"><div class="big-num num">${money(pagoE).replace("$ ","$")}</div><div class="lbl" style="color:var(--muted)">Le pagás</div></div>
        <div class="stat"><div class="big-num num" style="color:var(--sun)">${money(neta).replace("$ ","$")}</div><div class="lbl" style="color:var(--muted)">Te queda</div></div>
      </div>
      <dl class="kv" style="margin:0">
        <dt>Total del mes (todos los alumnos)</dt><dd class="num">${money(tot)}</dd>
        <dt>Lo de ${esc(nombre)} sobre el total</dt><dd class="num">${fmtH(Math.round(pct*10)/10)}%</dd>
        <dt>Sobre lo que factura Jump (${money(totJ)})</dt><dd class="num">${fmtH(Math.round(pctJ*10)/10)}%</dd>
      </dl>
      ${S.equipo[0]?`${cuentaHTML(true)}<button class="linkish" data-act="modoProfe" style="justify-self:start">Ver y revisar las horas que cargó día por día</button>`:""}
      <div class="field"><label for="vHora">Le pagás por hora</label><div style="display:flex;gap:8px"><input id="vHora" type="number" inputmode="numeric" min="0" step="500" value="${vh||""}" placeholder="Ej: 12000"><button class="mini go" data-act="valorSave">Guardar</button></div>${S.cfg.ultimoAumento?`<span class="small muted">Último aumento: ${S.cfg.ultimoAumento.split("-").reverse().join("/")}</span>`:""}</div>
      ${vh?`<div class="msg" style="gap:8px"><div class="msg-k"><b>Calcular aumento</b></div>
        <div style="display:flex;align-items:center;gap:8px"><input id="aumPct" type="number" inputmode="numeric" value="${aumPct}" style="width:80px;padding:9px 12px;border-radius:12px;border:1px solid var(--line);background:var(--surface)"><span>% de aumento</span></div>
        <dl class="kv" style="margin:0" id="aumOut">${aumKV(vh,nuevoV,h,nuevoP,tot)}</dl>
        <button class="mini" data-act="aumSave" style="justify-self:start">Aplicar este aumento</button></div>`:`<p class="small muted" style="margin:0">Cargá cuánto le pagás por hora y te calculo cuánto le toca, cuánto te queda y el aumento.</p>`}
      ${S.equipo[0]?(()=>{ const mv=(S.finEq[S.equipo[0].id]||[]).filter(x=>x.fecha.startsWith(S.mes)); const g=mv.filter(x=>x.tipo==="gasto").reduce((t,x)=>t+x.monto,0); return `<p class="small muted" style="margin:0">Gastos que anotó en ${mesSolo(S.mes)}: <b style="color:var(--ink)">${money(g)}</b> (${mv.length} movimientos) · <button class="linkish" data-act="verGastos">Ver todo</button></p>`; })():""}
      ${S.equipo.length?"":`<p class="small muted" style="margin:0">Cuando ${esc(nombre)} cargue sus horas desde su cuenta, se suman acá solas.</p>`}
    </div></section>`;
}
function aumKV(vh,nv,h,np,tot){ return `<dt>Nuevo valor por hora</dt><dd class="num">${money(nv)} <span class="muted" style="font-weight:500">(antes ${money(vh)})</span></dd><dt>Con ${fmtH(h)} h le pagarías</dt><dd class="num">${money(np)}</dd><dt>Te quedaría</dt><dd class="num" style="color:var(--sun)">${money(tot-np)}</dd>`; }
document.addEventListener("input",e=>{ if(e.target.id==="aumPct"){ aumPct=Number(e.target.value)||0; const vh=S.cfg.valorHora||0; const eq=S.equipo.length?S.equipo:[{dias:{}}]; const h=eq.reduce((s,x)=>s+horasMes(x.dias,S.mes),0); const tot=activos().reduce((s,a)=>s+montoMes(a),0); const nv=Math.round(vh*(1+aumPct/100)); $("#aumOut").innerHTML=aumKV(vh,nv,h,h*nv,tot); } });
/* ---------- Horas del profe ---------- */
const mesAnt = m => { const [y,mm]=m.split("-").map(Number); return mesKey(new Date(y,mm-2,1)); };
const horasMes = (dias,m) => Object.keys(dias||{}).filter(k=>k.startsWith(m)).reduce((s,k)=>s+(Number(dias[k])||0),0);
const fmtH = n => String(Math.round(n*10)/10).replace(".",",");
let hPend=0, hQueue=Promise.resolve();
function targetId(){ return S.esOwner ? (S.equipo[0]&&S.equipo[0].id) : S.uid; }
function guardarHorasDoc(){ const id=targetId(); if(!id){ toast(S.esOwner?"Esteban todavía no cargó nada desde su cuenta.":"No se pudo identificar tu usuario."); return; }
  const data={dias:{...S.horas},valores:{...S.hVal},movs:[...S.hMovs]}; hPend++;
  if(S.esOwner&&S.equipo[0]){ S.equipo[0].dias={...S.horas}; S.equipo[0].valores={...S.hVal}; S.equipo[0].movs=[...S.hMovs]; }
  const p=hQueue.then(()=>safe(()=>S.db.doc("horas/"+id).set(data))).finally(()=>{hPend--;}); hQueue=p.catch(()=>{}); return p; }
function setHoras(f,n){ if(n){ S.horas[f]=n; if(!S.hVal[f]) S.hVal[f]=S.cfg.valorHora||0; } else { delete S.horas[f]; delete S.hVal[f]; } render(); return guardarHorasDoc(); }
const valorDia = f => S.hVal[f] || S.cfg.valorHora || 0;
function ganadoEn(pref){ return Object.keys(S.horas).filter(k=>k.startsWith(pref)).reduce((t,k)=>t+(Number(S.horas[k])||0)*valorDia(k),0); }
function saldoProfe(){ const gan=ganadoEn(""); const pag=S.hMovs.reduce((t,x)=>t+(Number(x.monto)||0),0); return {gan,pag,saldo:gan-pag}; }
function cuentaHTML(enPanel){
  const m=mesKey(now); const {gan,pag,saldo}=saldoProfe(); const gMes=ganadoEn(m); const pMes=S.hMovs.filter(x=>x.fecha.startsWith(m)).reduce((t,x)=>t+(Number(x.monto)||0),0);
  const movs=[...S.hMovs].sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,12);
  return `<div class="msg" style="gap:12px;background:var(--surface)">
    <div class="msg-k"><b>${enPanel?"Cuenta de Esteban":"Tu cuenta"}</b><button class="cta" data-act="pagoNuevo" style="padding:5px 5px 5px 12px;font-size:13px">Registrar pago <i>+</i></button></div>
    <div><div class="big-num num" style="color:${saldo<0?"var(--warn)":"var(--sun)"}">${money(Math.abs(saldo)).replace("$ ","$")}</div><div class="small muted">${saldo>0?(enPanel?"Le debés":"Te deben"):saldo<0?(enPanel?"Le adelantaste de más":"Tenés adelantado (saldo negativo)"):"Al día"}</div></div>
    <dl class="kv" style="margin:0"><dt>Ganado en ${mesSolo(m)}</dt><dd class="num">${money(gMes)}</dd><dt>Pagado en ${mesSolo(m)}</dt><dd class="num">${money(pMes)}</dd><dt>Total ganado</dt><dd class="num">${money(gan)}</dd><dt>Total pagado</dt><dd class="num">${money(pag)}</dd></dl>
    ${movs.length?`<div style="display:grid;gap:6px">${movs.map(x=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13.5px"><span>${x.fecha.split("-").reverse().slice(0,2).join("/")} · <b class="num">${money(x.monto)}</b> <span class="muted">${esc(x.nota||"")} · marcó ${esc(x.por)}</span></span><button class="mini" style="font-size:11.5px;padding:3px 9px" data-act="movDel" data-id="${x.id}">×</button></div>`).join("")}</div>`:`<span class="small muted">Todavía no hay pagos registrados.</span>`}
  </div>`;
}
function openPagoProfe(){
  const {saldo}=saldoProfe();
  openSheet(`<form id="fPP" style="display:grid;gap:14px"><div style="display:grid;gap:4px"><h2 class="disp">Registrar pago</h2><span class="small muted">Saldo actual: ${money(saldo)}. Si pagás de más, queda como adelanto.</span></div>
    <div class="two"><div class="field"><label for="ppMonto">Monto</label><input id="ppMonto" type="number" inputmode="numeric" min="0" step="1000" required></div>
    <div class="field"><label for="ppFecha">Fecha</label><input id="ppFecha" type="date" value="${hoyISO}"></div></div>
    <button type="button" class="mini" data-act="pagoTodo" style="justify-self:start">Pagar todo (${money(Math.max(0,saldo))})</button>
    <div class="field"><label for="ppNota">Nota (opcional)</label><input id="ppNota" placeholder="Ej: adelanto, transferencia"></div>
    <div class="btns"><span></span><span style="display:flex;gap:8px"><button type="button" class="btn sec2" data-act="close">Cancelar</button><button class="btn pri">Guardar pago</button></span></div></form>`);
  setTimeout(()=>$("#ppMonto").focus(),50);
}

function turnosDadosJump(f){ const dow=isoDate(f).getDay(); return turnos("JUMP").filter(t=>t.dia===dow).length; }
function vHoras(){
  const m=mesKey(now); const h=horasMes(S.horas,m); const vh=S.cfg.valorHora||0; const fact=ganadoEn(m);
  const cobMes=S.hMovs.filter(x=>x.fecha.startsWith(m)).reduce((t,x)=>t+(Number(x.monto)||0),0); const {saldo}=saldoProfe();
  const f=isoDate(S.horasFecha); const hd=S.horas[S.horasFecha]||0; const sug=turnosDadosJump(S.horasFecha);
  const diasMes=Object.keys(S.horas).filter(k=>k.startsWith(m)).sort().reverse();
  return `
  ${pendientesHoy()}
  <section class="hero" aria-label="Tus horas del mes">${COURT_SVG}
    <span class="pill-date" style="justify-self:start">${mesLbl(m)} · Jump</span>
    <div class="hero-main"><div class="mega num">${fmtH(h).padStart(2,"0")}</div><div class="spec"><span class="spec-k">Horas de clase</span><span>${mesSolo(m)}</span><span class="spec-k" style="margin-top:8px">Facturado</span><span class="num" style="font-weight:800">${money(fact)}</span></div></div>
    <div class="small num" style="color:var(--muted);margin-top:-6px">${vh?`${fmtH(h)} horas x ${money(vh)} = <b>${money(fact)}</b>`:"Cargá tu valor por hora abajo para ver la plata"}</div>
    <div class="hero-stats">
      <div class="stat"><div class="val num" style="font-size:24px">${money(fact).replace("$ ","$")}</div><div class="lbl">Facturado</div></div>
      <div class="stat"><div class="val num" style="font-size:24px">${money(cobMes).replace("$ ","$")}</div><div class="lbl">Cobrado</div></div>
      <div class="stat"><div class="val num" style="font-size:24px;color:${saldo<0?"var(--warn)":"var(--sun)"}">${money(Math.abs(saldo)).replace("$ ","$")}</div><div class="lbl">${saldo<0?"Adelantado":"Te deben"}</div></div>
    </div>
  </section>
  <section class="sec">
    <div class="sec-head"><button class="icon-btn" data-act="hDia" data-d="-1" aria-label="Día anterior">‹</button>
      <div style="text-align:center"><h2 class="disp" style="font-size:22px">${DIAS_LARGO[f.getDay()]} ${f.getDate()}</h2><span class="small muted">${S.horasFecha===hoyISO?"hoy":f.toLocaleDateString("es-AR",{month:"long"})}</span></div>
      <button class="icon-btn" data-act="hDia" data-d="1" aria-label="Día siguiente" ${S.horasFecha>=hoyISO?"disabled style='opacity:.3'":""}>›</button></div>
    <div class="list"><div class="row" style="grid-template-columns:1fr auto;padding:16px">
      <span class="main"><span class="name">Horas de clase</span><span class="meta">${sug?`Jump tiene ${sug} turno${sug>1?"s":""} este día · <button class="linkish" data-act="hAuto" data-n="${sug}">Cargar ${sug}</button>`:"Sin turnos fijos este día"}</span></span>
      <div class="stepper"><button data-act="hStep" data-d="-0.5" aria-label="Restar media hora">−</button><b class="num">${fmtH(hd)}</b><button data-act="hStep" data-d="0.5" aria-label="Sumar media hora">+</button></div>
    </div></div>
  </section>
  <section class="sec"><div class="sec-head"><h3>Cobros de tus horas</h3></div>
    ${cuentaHTML(false)}
    <div class="field"><label for="vh2">Valor por hora</label><div style="display:flex;gap:8px"><input id="vh2" type="number" inputmode="numeric" min="0" step="500" value="${S.cfg.valorHora||""}" placeholder="Ej: 12000" style="flex:1"><button class="mini go" data-act="vhSave">Guardar</button></div><span class="small muted">Se multiplica por las horas que cargás. Cuando te pagan, tocá Marcar pagado.</span></div>
  </section>
  <section class="sec"><div class="sec-head"><h3>Días cargados en ${mesSolo(m)}</h3><span class="small muted num">${diasMes.length} días</span></div>
    ${diasMes.length?`<div class="list">${diasMes.map(k=>{const d=isoDate(k); return `<button class="row" style="background:none;border-left:0;border-right:0;border-bottom:0;width:100%;text-align:left" data-act="hSet" data-f="${k}"><span class="name">${DIAS_LARGO[d.getDay()]} ${d.getDate()}</span><span class="num" style="font-weight:700">${fmtH(S.horas[k])} h</span></button>`}).join("")}</div>`:`<div class="empty">Todavía no cargaste horas este mes. Usá los botones de arriba: cada toque suma media hora.</div>`}
  </section>`;
}
/* ---------- Plata de Esteban (privada) ---------- */
const CATS=["Alquiler","Comida","Transporte","Servicios","Salidas","Deporte","Ropa","Salud","Ahorro","Otros"];
const CATS_ING=["Clases","Otros ingresos"];
let fPend=0, fQueue=Promise.resolve(), fTipo="gasto", fCat="Comida";
function finDoc(){ return S.db.doc("finanzas/"+targetId()); }
function saveFin(){ render(); if(!targetId()){ toast(S.esOwner?"Esteban todavía no usó la app.":"No se pudo identificar tu usuario."); return; }
  if(S.esOwner&&S.equipo[0]) S.finEq[S.equipo[0].id]=[...S.fin];
  const data={movs:[...S.fin]}; fPend++;
  const p=fQueue.then(()=>safe(()=>finDoc().set(data))).finally(()=>{fPend--;}); fQueue=p.catch(()=>{}); return p; }
const INICIO_PROFE="2026-10-07";
const fmtCorto = f => { const d=isoDate(f); return `${DIAS[d.getDay()].toLowerCase()} ${d.getDate()}/${d.getMonth()+1}`; };
function marcasDe(f){ return (S.asKey===`${f}_JUMP`) ? S.asMarcas : ((S.asHist[f])||{}); }
function faltantes(){
  const hhmm=`${pad(now.getHours())}:${pad(now.getMinutes())}`; const out=[];
  for(let k=7;k>=0;k--){ const d=new Date(now); d.setDate(d.getDate()-k); const f=toISO(d); if(f<INICIO_PROFE) continue;
    const ts=turnos("JUMP").filter(t=>t.dia===d.getDay()).sort((a,b)=>a.hora.localeCompare(b.hora)); if(!ts.length) continue;
    const mk=marcasDe(f); const esHoy=f===hoyISO;
    const sinAsist=ts.filter(t=>!esHoy||t.hora<=hhmm).map(t=>({hora:t.hora,n:t.al.filter(a=>!mk[`${a.id}|${t.hora}`]).length})).filter(x=>x.n);
    const ultimo=ts[ts.length-1].hora; const termino=!esHoy||hhmm>=ultimo;
    const sinHoras=!S.horas[f]&&termino;
    out.push({fecha:f,esHoy,ts,sinAsist,sinHoras,termino,proximos:esHoy?ts.filter(t=>t.hora>hhmm):[]});
  }
  return out;
}
function textoFaltan(x){ const p=[]; if(x.sinAsist.length) p.push(`asistencia de ${x.sinAsist.map(t=>t.hora).join(", ")}`); if(x.sinHoras) p.push("las horas"); return p.join(" y "); }
function pendientesHoy(){
  const fl=faltantes(); const hoy=fl.find(x=>x.esHoy); const atras=fl.filter(x=>!x.esHoy&&(x.sinAsist.length||x.sinHoras));
  const hhmm=`${pad(now.getHours())}:${pad(now.getMinutes())}`; const noche=hhmm>="21:30";
  const p=[];
  if(hoy){
    hoy.ts.forEach(t=>t.al.filter(esNuevo).forEach(a=>p.push(`<b style="color:var(--sun)">Nuevo</b>: ${esc(a.nombre)} viene a las <b>${t.hora}</b>${a.categoria?` (${esc(a.categoria)})`:""}`)));
    hoy.sinAsist.forEach(t=>p.push(`<b>${t.hora}</b> · ${t.n} alumno${t.n>1?"s":""} sin marcar · <button class="linkish" data-act="irAsist" data-f="${hoyISO}">Marcar</button>`));
    hoy.proximos.forEach(t=>p.push(`<span class="muted"><b>${t.hora}</b> · todavía no empezó, marcala cuando termine</span>`));
    if(hoy.sinHoras) p.push(`No cargaste las horas de hoy · <button class="linkish" data-act="hAuto" data-f="${hoyISO}" data-n="${hoy.ts.length}">Cargar ${hoy.ts.length}</button>`);
  }
  atras.forEach(x=>p.push(`<span style="color:var(--warn)">${x.fecha===toISO(new Date(now.getFullYear(),now.getMonth(),now.getDate()-1))?"Ayer":"El "+fmtCorto(x.fecha)}</span>: te falta ${textoFaltan(x)} · ${x.sinAsist.length?`<button class="linkish" data-act="irAsist" data-f="${x.fecha}">Asistencia</button>`:""} ${x.sinHoras?`<button class="linkish" data-act="irHoras" data-f="${x.fecha}">Horas</button>`:""}`));
  if(!S.fin.some(x=>x.fecha===hoyISO)) p.push(`¿Gastaste algo hoy? <button class="linkish" data-act="finNuevo" data-t="gasto">Anotalo</button>`);
  if(!p.length) return "";
  const urgente=atras.length||(noche&&hoy&&(hoy.sinAsist.length||hoy.sinHoras));
  return `<div class="msg" style="margin-bottom:14px;background:var(--surface);border-color:${urgente?"var(--warn)":"rgba(241,221,136,.35)"}"><div class="msg-k"><b>${urgente?(noche?"Se terminó el día: te falta cargar":"Te quedó sin cargar"):"Pendiente hoy"}</b></div>${p.map(x=>`<div class="small" style="line-height:1.55">• ${x}</div>`).join("")}</div>`;
}
function avisoOwner(){
  if(!S.equipo[0]&&!Object.keys(S.asHist).length) { /* sin datos todavía */ }
  const fl=faltantes().filter(x=>x.sinAsist.length||x.sinHoras); if(!fl.length) return "";
  const nombre=(S.equipo[0]&&S.nombres[S.equipo[0].id])||"Esteban"; const corto=nombreCorto(nombre);
  const txt=`Che ${corto}, ¿todo bien? Te falta cargar en la app: ${fl.map(x=>`${x.esHoy?"hoy":fmtCorto(x.fecha)} (${textoFaltan(x)})`).join("; ")}. ¡Gracias!`;
  const url=S.cfg.telProfe?waURL(S.cfg.telProfe,txt):"";
  return `<section class="sec"><div class="sec-head"><h3>${esc(corto)} no cargó</h3><span class="small muted num">${fl.length} día${fl.length>1?"s":""}</span></div>
    <div class="list">${fl.map(x=>`<div class="row" style="grid-template-columns:1fr"><span class="main"><span class="name" style="text-transform:capitalize">${x.esHoy?"Hoy":fmtCorto(x.fecha)}</span><span class="meta" style="color:var(--warn)">Falta ${textoFaltan(x)}</span></span></div>`).join("")}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${url?`<a class="cta wa" href="${url}" target="_blank" rel="noopener" style="padding:6px 6px 6px 14px;font-size:13px">Recordarle por WhatsApp <i>→</i></a>`:`<span class="small muted">Cargá su teléfono para mandarle el recordatorio:</span>`}
      <input id="telProfe" inputmode="tel" value="${esc(S.cfg.telProfe||"")}" placeholder="Teléfono de ${esc(corto)}" style="flex:1;min-width:140px;padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface)"><button class="mini" data-act="telProfeSave">Guardar</button></div>
  </section>`;
}
function vPlata(){
  const m=S.finMes; const movs=S.fin.filter(x=>x.fecha.startsWith(m));
  const clases=ganadoEn(m); const otrosIng=movs.filter(x=>x.tipo==="ingreso").reduce((t,x)=>t+x.monto,0);
  const gastos=movs.filter(x=>x.tipo==="gasto"); const totG=gastos.reduce((t,x)=>t+x.monto,0); const ing=clases+otrosIng; const queda=ing-totG;
  const porCat={}; gastos.forEach(x=>porCat[x.cat]=(porCat[x.cat]||0)+x.monto); const cats=Object.keys(porCat).sort((a,b)=>porCat[b]-porCat[a]); const max=Math.max(1,...Object.values(porCat));
  const lista=[...movs].sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.id.localeCompare(a.id));
  return `
  <section class="hero" aria-label="Tu plata del mes">${COURT_SVG}
    <div class="month"><button data-act="finMes" data-d="-1" aria-label="Mes anterior">‹</button><span class="pill-date">${mesLbl(m)}</span><button data-act="finMes" data-d="1" aria-label="Mes siguiente">›</button></div>
    <div class="mega num" style="font-size:clamp(48px,14vw,76px)">${queda<0?"−":""}${money(Math.abs(queda)).replace("$ ","$")}</div>
    <div class="small" style="color:var(--muted);margin-top:-8px">${queda<0?"Gastaste más de lo que entró":"Te queda este mes"}</div>
    <div class="hero-stats" style="grid-template-columns:1fr 1fr">
      <div class="stat"><div class="val num" style="font-size:24px">${money(ing).replace("$ ","$")}</div><div class="lbl">Entró${clases?` · clases ${money(clases).replace("$ ","$")}`:""}</div></div>
      <div class="stat"><div class="val num" style="font-size:24px">${money(totG).replace("$ ","$")}</div><div class="lbl">Gastos</div></div>
    </div>
    ${ing?`<div class="bar" aria-label="Gastaste el ${Math.round(totG/ing*100)}% de lo que entró"><i style="width:${Math.min(100,Math.round(totG/ing*100))}%;background:${totG>ing?"var(--warn)":"var(--sun)"}"></i></div>`:""}
  </section>
  <div style="display:flex;gap:8px;margin-top:14px"><button class="cta" data-act="finNuevo" data-t="gasto" style="flex:1;justify-content:space-between">Anotar gasto <i>+</i></button><button class="mini" data-act="finNuevo" data-t="ingreso" style="padding:10px 14px">+ Otro ingreso</button></div>
  ${cats.length?`<section class="sec"><div class="sec-head"><h3>En qué se va</h3></div><div class="list" style="padding:14px;display:grid;gap:10px">${cats.map(c=>`<div style="display:grid;gap:4px"><div style="display:flex;justify-content:space-between;font-size:14px"><span>${esc(c)}</span><b class="num">${money(porCat[c])}</b></div><div class="bar" style="background:var(--surface-2)"><i style="width:${Math.round(porCat[c]/max*100)}%"></i></div></div>`).join("")}</div></section>`:""}
  <section class="sec"><div class="sec-head"><h3>Movimientos de ${mesSolo(m)}</h3><span class="small muted num">${lista.length}</span></div>
    ${lista.length?`<div class="list">${lista.map(x=>`<div class="row"><span class="main"><span class="name">${esc(x.nota||x.cat)}</span><span class="meta">${x.fecha.split("-").reverse().slice(0,2).join("/")} · ${esc(x.cat)}</span></span><span style="display:flex;align-items:center;gap:8px"><b class="num" style="color:${x.tipo==="ingreso"?"var(--ok)":"var(--ink)"}">${x.tipo==="ingreso"?"+":"−"}${money(x.monto).replace("$ ","$")}</b><button class="mini" style="font-size:11.5px;padding:3px 9px" data-act="finDel" data-id="${x.id}" aria-label="Borrar">×</button></span></div>`).join("")}</div>`:`<div class="empty">Anotá cada gasto apenas lo hacés: el monto y en qué. Al final del mes ves en qué se te va la plata. Lo que ganás con las clases ya entra solo.</div>`}
  </section>
  <p class="small muted" style="margin:14px 0 0">Gabriel también puede ver esta sección.</p>`;
}
function openFin(tipo){
  fTipo=tipo; const cats=tipo==="gasto"?CATS:CATS_ING; fCat=cats[0];
  openSheet(`<form id="fFin" style="display:grid;gap:14px"><h2 class="disp">${tipo==="gasto"?"Nuevo gasto":"Otro ingreso"}</h2>
    <div class="two"><div class="field"><label for="finMonto">Monto</label><input id="finMonto" type="number" inputmode="numeric" min="0" step="100" required></div>
    <div class="field"><label for="finFecha">Fecha</label><input id="finFecha" type="date" value="${hoyISO}"></div></div>
    <div class="field"><span class="flabel">Categoría</span><div style="display:flex;gap:6px;flex-wrap:wrap" id="finCats">${cats.map((c,i)=>`<button type="button" class="chip" data-act="finCat" data-c="${c}" aria-pressed="${i===0}" style="text-transform:none;letter-spacing:0;font-size:13px">${c}</button>`).join("")}</div></div>
    <div class="field"><label for="finNota">Detalle (opcional)</label><input id="finNota" placeholder="${tipo==="gasto"?"Ej: súper, nafta, cuota gimnasio":"Ej: torneo, venta de paleta"}"></div>
    <div class="btns"><span></span><span style="display:flex;gap:8px"><button type="button" class="btn sec2" data-act="close">Cancelar</button><button class="btn pri">Guardar</button></span></div></form>`);
  setTimeout(()=>$("#finMonto").focus(),50);
}
/* ---------- Asistencia ---------- */
const isoDate = iso => { const [y,m,d]=iso.split("-").map(Number); return new Date(y,m-1,d); };
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const ESTADOS = {vino:"Vino", falto:"Faltó", recupera:"Recupera"};
function subAsist(){
  if(!S.db) return; const key=`${S.asFecha}_${S.asClub}`; if(S.asKey===key) return;
  if(S.asUnsub) S.asUnsub(); S.asKey=key; S.asMarcas={};
  S.asUnsub=S.db.collection("asistencia").doc(key).onSnapshot(d=>{ if(asPend>0) return; S.asMarcas={...((d.exists&&d.data().marcas)||{})}; S.asQuien={...((d.exists&&d.data().quien)||{})}; if(S.tab==="asist"&&$("#overlay").hidden) render(); },()=>{});
}
let asPend=0, asQueue=Promise.resolve();
function guardarAsist(){ const yo=S.esOwner&&S.modo!=="profe"?"Gabriel":(S.esOwner?"Gabriel":"Esteban"); S.asQuien=S.asQuien||{}; Object.keys(S.asMarcas).forEach(k=>{ if(!S.asQuien[k]) S.asQuien[k]=yo; }); Object.keys(S.asQuien).forEach(k=>{ if(!S.asMarcas[k]) delete S.asQuien[k]; }); const m={...S.asMarcas}, q={...S.asQuien}; const f=S.asFecha, c=S.asClub; asPend++;
  const p=asQueue.then(()=>safe(()=>S.db.collection("asistencia").doc(`${f}_${c}`).set({fecha:f,club:c,marcas:m,quien:q}))).finally(()=>{ asPend--; if(asPend===0&&(S.asFecha!==f||S.asClub!==c)){ S.asKey=null; if(S.tab==="asist"&&$("#overlay").hidden) render(); } });
  asQueue=p.catch(()=>{}); return p; }
async function marcar(a,hora,estado){
  S.asQuien=S.asQuien||{}; delete S.asQuien[`${a.id}|${hora}`];
  const k=`${a.id}|${hora}`; const prev=S.asMarcas[k]; const nuevo= prev===estado?null:estado;
  let delta=(nuevo==="recupera"?1:0)-(prev==="recupera"?1:0);
  const avA=avisoApp(a.id,S.asFecha,hora,"ausencia"); if(avA&&avA.conRecupero&&!vuelveApp(a.id,S.asFecha,hora)) delta=0;
  if(nuevo) S.asMarcas[k]=nuevo; else delete S.asMarcas[k];
  render();
  if(await guardarAsist() && delta) await setRec(a,delta,S.asFecha);
  if(delta>0) toast(`${a.nombre}: +1 clase a recuperar`);
}
function vAsist(){
  const f=isoDate(S.asFecha); const dow=f.getDay(); const esHoy=S.asFecha===hoyISO;
  const slots=turnos(S.asClub).filter(t=>t.dia===dow).sort((x,y)=>x.hora.localeCompare(y.hora));
  const vals=Object.values(S.asMarcas); const cnt=e=>vals.filter(v=>v===e).length;
  const extras=Object.keys(S.asMarcas).filter(k=>S.asMarcas[k]==="recuperando").map(k=>{const [id,hora]=k.split("|"); return {a:S.alumnos.find(x=>x.id===id),hora};}).filter(x=>x.a);
  return `
  <section class="sec" style="margin-top:4px">
    <div class="clubs" ${S.modo==="profe"?"hidden":""}>${["ESPACIO","JUMP"].map(c=>`<button class="chip" data-act="asClub" data-c="${c}" aria-pressed="${S.asClub===c}">${c==="ESPACIO"?"Espacio":"Jump"}</button>`).join("")}</div>
    <div class="sec-head"><button class="icon-btn" data-act="asDia" data-d="-1" aria-label="Día anterior">‹</button>
      <div style="text-align:center"><h2 class="disp" style="font-size:22px">${DIAS_LARGO[dow]} ${f.getDate()}</h2><span class="small muted">${f.toLocaleDateString("es-AR",{month:"long"})}${esHoy?" · hoy":""}</span></div>
      <button class="icon-btn" data-act="asDia" data-d="1" aria-label="Día siguiente">›</button></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">${esHoy?"":`<button class="mini" data-act="asHoy">Volver a hoy</button>`}<button class="mini" data-act="asDia" data-d="7">+1 semana</button></div>
    ${slots.length?`<p class="small muted num" style="margin:0;text-align:center"><b class="free">${cnt("vino")}</b> vinieron · <b class="due">${cnt("falto")}</b> faltaron · <b style="color:var(--sun)">${cnt("recupera")}</b> a recuperar · ${cnt("recuperando")} recuperando</p>`:""}
  </section>
  ${slots.length?slots.map(t=>{
    const ex=extras.filter(x=>x.hora===t.hora);
    return `<section class="sec"><div class="sec-head"><h3 class="num">${t.hora} · ${esc(t.nivel||"")}</h3><button class="linkish" data-act="asRecAdd" data-hora="${t.hora}">+ Viene a recuperar</button></div>
    <div class="list">${t.al.map(a=>{const e=S.asMarcas[`${a.id}|${t.hora}`];
      return `<div class="row" style="grid-template-columns:1fr"><span class="name">${esc(a.nombre)}${recN(a)?` <span class="tag rec">Debe ${recN(a)}</span>`:""}${tagAviso(a.id,S.asFecha,t.hora)}</span>
      <div class="seg">${Object.keys(ESTADOS).map(k=>`<button class="seg-b ${k}" data-act="marca" data-id="${a.id}" data-hora="${t.hora}" data-e="${k}" aria-pressed="${e===k}">${ESTADOS[k]}</button>`).join("")}</div></div>`;}).join("")}
      ${ex.map(x=>`<div class="row"><span class="main"><span class="name">${esc(x.a.nombre)}</span><span class="meta"><span class="tag rec">Vino a recuperar</span>${avisoApp(x.a.id,S.asFecha,x.hora,"recupera")?"<span>Reservó por la app</span>":""}</span></span><button class="mini" data-act="asRecQuitar" data-id="${x.a.id}" data-hora="${x.hora}">Quitar</button></div>`).join("")}
      ${reservasAsistHTML(t.club,S.asFecha,t.hora)}
    </div></section>`}).join(""):`<div class="empty" style="margin-top:16px">No hay turnos en ${S.asClub==="ESPACIO"?"Espacio":"Jump"} los ${DIAS_PL[dow]}.</div>`}
  ${S.modo!=="profe"&&S.downloads?`<button class="mini" data-act="asCSV" style="margin-top:16px">Descargar asistencia de ${mesSolo(S.asFecha.slice(0,7))} (CSV)</button>`:""}
  <p class="small muted" style="margin:18px 0 0"><b style="color:var(--ink)">Faltó</b>: no avisó, pierde la clase. <b style="color:var(--ink)">Recupera</b>: avisó a tiempo, le queda una clase pendiente. Si alguien te avisa que no viene un día que todavía no pasó, andá a ese día con las flechas y marcalo <b style="color:var(--ink)">Recupera</b>.</p>`;
}
function openAsRecAdd(hora){
  const dow=isoDate(S.asFecha).getDay(); const t=turnos(S.asClub).find(x=>x.dia===dow&&x.hora===hora);
  const cat=t&&t.nivel?catNorm(t.nivel):"";
  const list=S.alumnos.filter(a=>a.activo!==false&&recN(a)>0&&enClub(a,S.asClub)).sort((x,y)=>(catsDe(y).has(cat)-catsDe(x).has(cat))||x.nombre.localeCompare(y.nombre));
  openSheet(`<div style="display:grid;gap:4px"><h2 class="disp">Viene a recuperar</h2><span class="small muted">${DIAS_LARGO[dow]} ${hora} · ${esc(t?.nivel||"")}. Al marcarlo se le descuenta una clase pendiente.</span></div>
    ${list.length?`<div class="list">${list.map(a=>`<button class="row" style="background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;width:100%" data-act="asRecSel" data-id="${a.id}" data-hora="${hora}"><span class="main"><span class="name">${esc(a.nombre)}</span><span class="meta">${a.categoria?`<span>${esc(a.categoria)}</span>`:""}<span class="tag rec">Debe ${recN(a)}</span>${catsDe(a).has(cat)?'<span class="free">Su categoría</span>':""}</span></span><span class="mini">Elegir</span></button>`).join("")}</div>`:`<div class="empty">Nadie de ${S.asClub==="ESPACIO"?"Espacio":"Jump"} tiene clases pendientes.</div>`}
    <div class="btns"><span></span><button class="btn sec2" data-act="close">Cerrar</button></div>`);
}
function vCaptar(){
  const L=S.leads.filter(l=>!S.club||!l.club||l.club===S.club);
  const ganados=L.filter(l=>l.estado==="alumno"&&(l.ganado||"").startsWith(S.mes));
  const act=L.filter(l=>["nuevo","contactado","prueba"].includes(l.estado));
  const libres=turnos(S.club).reduce((s,t)=>s+Math.max(0,CUPO-t.al.length),0);
  return `
  <section class="sec" style="margin-top:4px">
    <div class="sec-head"><h2 class="disp">Interesados</h2><button class="cta" data-act="newL" style="padding:6px 6px 6px 14px;font-size:13px">Nuevo <i>+</i></button></div>
    <p class="small muted" style="margin:0">${act.length} en seguimiento · <b style="color:var(--ink)">${ganados.length}</b> se sumaron en ${mesSolo(S.mes)} · <b style="color:var(--ok)">${libres}</b> lugares libres en tus turnos</p>
  </section>
  ${!L.length?`<div class="empty" style="margin-top:14px">Anotá acá a cada persona que pregunta por clases. Ponele una fecha para volver a escribirle y aparece en <b>Hoy</b> cuando toque.</div>`:""}
  ${ETAPAS.map(et=>{const g=L.filter(l=>l.estado===et.k).sort((a,b)=>(a.proximo||"9")<(b.proximo||"9")?-1:1);return g.length?`<section class="sec"><div class="sec-head"><h3>${et.l}</h3><span class="small muted num">${g.length}</span></div><div class="list">${g.map(leadRow).join("")}</div></section>`:""}).join("")}`;
}

const TAB_ICON={
  hoy:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M5 9c4 2 10 2 14 0M5 15c4-2 10-2 14 0"/></svg>',
  alumnos:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c2.4 0 4 1.5 4.5 4"/></svg>',
  agenda:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  recuperar:'<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/><path d="M12 8v4l3 2"/></svg>',
  asist:'<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM8.5 12.5l2 2 4-4"/></svg>',
  horas:'<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>'};
TAB_ICON.plata='<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12.5h2M3 9.5h18"/></svg>';
const TAB_LBL={plata:"Mis gastos",hoy:"Hoy",alumnos:"Alumnos",agenda:"Agenda",recuperar:"Recuperar",asist:"Asistencia",horas:"Mis horas"};
const tabsDe=()=> S.modo==="profe" ? ["horas","agenda","asist","recuperar","plata"] : ["hoy","alumnos","agenda","recuperar","asist"];
function renderTabs(){ const t=tabsDe(); const nav=$("#tabs"); nav.style.gridTemplateColumns=`repeat(${t.length},1fr)`;
  nav.innerHTML=t.map(k=>`<button class="tab" role="tab" data-tab="${k}" aria-selected="${S.tab===k}">${TAB_ICON[k]}${TAB_LBL[k]}</button>`).join(""); }
function render(){
  if(!tabsDe().includes(S.tab)) S.tab=tabsDe()[0];
  if(S.modo==="profe"){ S.club="JUMP"; S.asClub="JUMP"; }
  renderTabs(); $("#cfgBtn").hidden=!S.esOwner;
  document.querySelectorAll(".tab").forEach(b=>b.setAttribute("aria-selected",b.dataset.tab===S.tab));
  document.querySelectorAll("#clubs .chip").forEach(b=>b.setAttribute("aria-pressed",b.dataset.club===S.club));
  $("#fab").hidden=S.modo==="profe"||(S.tab!=="alumnos"&&S.tab!=="hoy");
  $("#clubs").hidden=S.tab==="asist"||S.modo==="profe";
  let html="";
  if(S.dbState==="sin-db") html+=`<div class="notice">No se pudo conectar con la base de datos. Revisá tu conexión y volvé a abrir la app.</div>`;
  else if(S.dbState==="cargando") html+=`<p class="small muted" style="margin:16px 0 0">Cargando tus alumnos…</p>`;
  if(S.tab==="asist"||(S.modo==="profe"&&S.asFecha===hoyISO)) subAsist();
  if(S.modo==="profe") html+=`<div class="notice" style="background:var(--surface-2);color:var(--muted);margin:0 0 12px">${S.esOwner?'Estás viendo los datos reales de Esteban. Lo que cambies acá se guarda en su cuenta. <button class="linkish" data-act="modoOwner">Volver a la tuya</button>':"Jump · vista de profe · <button class=\"linkish\" data-act=\"salir\">Cerrar sesión</button>"}</div>`;
  html+=({hoy:vHoy,alumnos:vAlumnos,agenda:vAgenda,recuperar:vRecuperar,asist:vAsist,horas:vHoras,plata:vPlata})[S.tab]();
  const focused=document.activeElement&&document.activeElement.id==="q";
  $("#view").innerHTML=html;
  if(focused){ const q=$("#q"); q.focus(); q.setSelectionRange(q.value.length,q.value.length); }
}

/* ---------- Sheets ---------- */
let sheetRefresh=null;
function openSheet(html,refresh=null){ $("#sheet").innerHTML=html; $("#overlay").hidden=false; sheetRefresh=refresh; }
function closeSheet(){ $("#overlay").hidden=true; $("#sheet").innerHTML=""; sheetRefresh=null; }
$("#overlay").addEventListener("click",e=>{ if(e.target.id==="overlay") closeSheet(); });

function hRow(h={dia:1,hora:"18:00"},club){
  const c=h.club||club||($("#aClub")&&$("#aClub").value)||S.club||"JUMP";
  return `<div class="hrow" data-nivel="${esc(h.nivel||"")}"><select class="hd" aria-label="Día">${[1,2,3,4,5,6,0].map(d=>`<option value="${d}" ${h.dia===d?"selected":""}>${DIAS_LARGO[d]}</option>`).join("")}</select><input type="time" aria-label="Hora" value="${h.hora}" step="900"><select class="hc" aria-label="Club">${["JUMP","ESPACIO"].map(x=>`<option value="${x}" ${c===x?"selected":""}>${CLUB_LBL[x]}</option>`).join("")}</select><button type="button" class="x" data-act="hdel" aria-label="Quitar horario">×</button></div>`;
}
const EST_TXT={vino:"Vino",falto:"Faltó sin avisar",recupera:"Avisó · recupera",recuperando:"Vino a recuperar"};
const EST_COL={vino:"var(--ok)",falto:"var(--warn)",recupera:"var(--sun)",recuperando:"var(--jump)"};
async function historialDe(id){
  const snap=await S.db.collection("asistencia").get(); const out=[];
  snap.docs.forEach(d=>{ const v=d.data(); Object.keys(v.marcas||{}).forEach(k=>{ const [aid,hora]=k.split("|"); if(aid===id) out.push({fecha:v.fecha,club:v.club,hora,estado:v.marcas[k],quien:(v.quien||{})[k]||""}); }); });
  return out.sort((x,y)=>(y.fecha+y.hora).localeCompare(x.fecha+x.hora));
}
async function cargarHist(a){
  const el=$("#histA"); if(!el||!S.db) return;
  try{ const h=await historialDe(a.id); if(!$("#histA")) return;
    if(!h.length){ $("#histA").innerHTML="Todavía no hay asistencias marcadas."; return; }
    const cnt=e=>h.filter(x=>x.estado===e).length;
    $("#histA").innerHTML=`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;color:var(--ink)"><span><b class="num">${cnt("vino")+cnt("recuperando")}</b> vino</span><span style="color:var(--warn)"><b class="num">${cnt("falto")}</b> faltó</span><span style="color:var(--sun)"><b class="num">${cnt("recupera")}</b> avisó</span></div>
      <div style="display:grid;gap:4px;max-height:220px;overflow:auto">${h.map(x=>{const d=isoDate(x.fecha); return `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid var(--line-2)"><span style="color:var(--ink)"><span style="text-transform:capitalize">${DIAS[d.getDay()]}</span> ${d.getDate()}/${d.getMonth()+1} · ${x.hora}</span><span style="color:${EST_COL[x.estado]||"var(--muted)"};font-weight:700;text-align:right">${EST_TXT[x.estado]||x.estado}${x.quien?` <span class="muted" style="font-weight:500">· ${esc(x.quien)}</span>`:""}</span></div>`;}).join("")}</div>`;
  }catch(e){ $("#histA").innerHTML="No se pudo cargar el historial."; }
}
async function exportAsist(){
  const m=S.asFecha.slice(0,7); const snap=await S.db.collection("asistencia").get(); const rows=[["Fecha","Club","Hora","Alumno","Estado","Marcó"]];
  snap.docs.map(d=>d.data()).filter(v=>v.fecha.startsWith(m)).sort((x,y)=>x.fecha.localeCompare(y.fecha)).forEach(v=>Object.keys(v.marcas||{}).sort().forEach(k=>{ const [id,hora]=k.split("|"); const a=S.alumnos.find(x=>x.id===id); rows.push([v.fecha,v.club,hora,a?a.nombre:id,EST_TXT[v.marcas[k]]||v.marcas[k],(v.quien||{})[k]||""]); }));
  const csv="\uFEFF"+rows.map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(";")).join("\n");
  try{ await S.downloads.save({filename:`asistencia-${m}.csv`,data:csv}); }catch(e){}
}
function formAlumno(a={},leadId=""){
  openSheet(`<form id="fA" data-id="${a.id||""}" data-lead="${leadId}" style="display:grid;gap:14px">
    <div class="btns"><h2 class="disp">${a.id?esc(a.nombre):"Nuevo alumno"}</h2>${a.id&&a.activo!==false?`<button type="button" class="msg-btn" data-act="msg" data-id="${a.id}" aria-label="Mensajes">${WA_ICON}</button>`:""}</div>
    <div class="field"><label for="aNom">Nombre</label><input id="aNom" required value="${esc(a.nombre)}"></div>
    <div class="two">
      <div class="field"><label for="aClub">Club principal</label><select id="aClub">${["JUMP","ESPACIO"].map(c=>`<option ${(a.club||S.club||"JUMP")===c?"selected":""}>${c}</option>`).join("")}</select></div>
      <div class="field"><label for="aTel">Teléfono</label><input id="aTel" inputmode="tel" value="${esc(a.tel)}"></div>
    </div>
    <div class="two">
      <div class="field"><label for="aCat">Categoría</label><input id="aCat" list="cats" value="${esc(a.categoria)}" placeholder="octava, séptima…"><datalist id="cats"><option>inicial</option><option>niños</option><option>octava</option><option>séptima</option><option>sexta</option></datalist></div>
      <div class="field"><label for="aPrecio">Precio por clase</label><input id="aPrecio" type="number" inputmode="numeric" min="0" step="250" value="${a.precioClase||""}"></div>
    </div>
    <span class="small muted" id="aCalc" style="margin-top:-6px"></span>
    <div class="field"><label>Horarios</label><div id="hList" style="display:grid;gap:8px">${(a.horarios&&a.horarios.length?a.horarios:[{dia:1,hora:"18:00"}]).map(h=>hRow(h,a.club)).join("")}</div><button type="button" class="linkish" data-act="hadd" style="justify-self:start">+ Otro día</button><span class="small muted">Si va a los dos clubes, elegí el club de cada día. Recupera solo en los clubes donde entrena.</span></div>
    <div class="field"><span class="flabel">Clases para recuperar${recN(a)?` <span style="text-transform:none;letter-spacing:0;color:var(--sun)">· ${recVenceTxt(a)}</span>`:""}</span><div class="stepper"><button type="button" data-act="stepRec" data-d="-1" aria-label="Restar">−</button><b class="num" id="aRec">${recN(a)||0}</b><button type="button" data-act="stepRec" data-d="1" aria-label="Sumar">+</button></div></div>
    <div class="field"><label for="aNota">Notas</label><textarea id="aNota" rows="2" placeholder="Aumentos, lesiones, objetivos…">${esc(a.notas)}</textarea></div>
    ${a.id?accesoHTML(a):""}
    ${a.id?avisosFichaHTML(a):""}
    ${a.id?`<div class="field"><span class="flabel">Historial de asistencia</span><div id="histA" class="small muted">Cargando…</div></div>`:""}
    ${a.id?`<label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="aAct" ${a.activo===false?"":"checked"}> Activo (sacalo si dejó o está en pausa)</label>`:""}
    <div class="btns">${a.id?`<button type="button" class="btn del" data-act="delA">Borrar</button>`:"<span></span>"}<span style="display:flex;gap:8px"><button type="button" class="btn sec2" data-act="close">Cancelar</button><button class="btn pri">Guardar</button></span></div>
  </form>`);
  const calc=()=>{ const f=$("#fA"); if(!f) return; const tmp={precioClase:Number($("#aPrecio").value)||0,horarios:[...f.querySelectorAll(".hrow .hd")].map(s=>({dia:Number(s.value)}))};
    const ex=extraDias(tmp).length; $("#aCalc").textContent=tmp.precioClase?`${mesLbl(S.mes)}: ${clasesMes(tmp)} clases = ${money(cuotaMes(tmp))}${ex?" (incluye clase extra)":""}`:""; };
  calc(); $("#fA").addEventListener("input",calc); $("#fA").addEventListener("change",calc); $("#fA").addEventListener("click",()=>setTimeout(calc,0));
}
function formLead(l={}){
  openSheet(`<form id="fL" data-id="${l.id||""}" style="display:grid;gap:14px">
    <h2 class="disp">${l.id?"Editar interesado":"Nuevo interesado"}</h2>
    <div class="field"><label for="lNom">Nombre</label><input id="lNom" required value="${esc(l.nombre)}"></div>
    <div class="two">
      <div class="field"><label for="lTel">Teléfono</label><input id="lTel" inputmode="tel" value="${esc(l.tel)}"></div>
      <div class="field"><label for="lOrig">Cómo llegó</label><select id="lOrig">${ORIGENES.map(o=>`<option ${(l.origen||"Instagram")===o?"selected":""}>${o}</option>`).join("")}</select></div>
    </div>
    <div class="two">
      <div class="field"><label for="lClub">Club</label><select id="lClub"><option value="">Sin definir</option>${["JUMP","ESPACIO"].map(c=>`<option ${l.club===c?"selected":""}>${c}</option>`).join("")}</select></div>
      <div class="field"><label for="lProx">Volver a escribir</label><input id="lProx" type="date" value="${l.proximo||hoyISO}"></div>
    </div>
    <div class="field"><label for="lNota">Nota</label><textarea id="lNota" rows="2" placeholder="Qué busca, horarios que puede…">${esc(l.nota)}</textarea></div>
    <div class="btns">${l.id?`<button type="button" class="btn del" data-act="delL">Borrar</button>`:"<span></span>"}<span style="display:flex;gap:8px"><button type="button" class="btn sec2" data-act="close">Cancelar</button><button class="btn pri">Guardar</button></span></div>
  </form>`);
}

/* ---------- Writes ---------- */
let toastT;
function toast(msg,undo){
  const t=$("#toast"); clearTimeout(toastT);
  t.innerHTML=`<span>${esc(msg)}</span>${undo?'<button id="undo">Deshacer</button>':""}`; t.hidden=false;
  if(undo) $("#undo").onclick=()=>{ t.hidden=true; undo(); };
  toastT=setTimeout(()=>t.hidden=true,4000);
}
async function safe(p,okMsg){
  if(!S.db){ toast("No hay conexión con la base."); return false; }
  try{ await p(); if(okMsg) toast(okMsg); return true; }
  catch(e){ console.error(e); toast(e&&e.code==="permission-denied"?"No tenés permiso para cambiar esto.":"No se pudo guardar. Probá de nuevo."); return false; }
}
const colA=()=>S.db.collection("alumnos");
const colL=()=>S.db.collection("interesados");
async function setPago(a,val){
  const cur=(a.pagos&&a.pagos[S.mes])||{};
  return safe(()=>colA().doc(a.id).update({pagos:{[S.mes]:{pagado:val,monto:val?montoMes(a):(cur.monto||0),fecha:val?hoyISO:null}}}));
}
// Suma o descuenta clases para recuperar (con su vencimiento). "fecha" = el día que faltó.
async function setRec(a,delta,fecha=hoyISO,quitarDe=null){ const pend=recPendAvisos(a); const p=recCambio(a,delta,fecha,quitarDe);
  const ok=await safe(async()=>{ const bt=S.db.batch(); bt.update(colA().doc(a.id),p); pend.forEach(v=>bt.update(S.db.doc("avisos/"+v.id),{contado:true})); await bt.commit(); });
  if(ok){ Object.assign(a,p); pend.forEach(v=>v.contado=true); } return ok; }
const recPrev=a=>({recuperar:a.recuperar||0,recVence:{...(a.recVence||{})}});
const recVolver=(a,p)=>safe(()=>colA().doc(a.id).update(p)).then(ok=>{ if(ok) Object.assign(a,p); return ok; });

/* ---------- Events ---------- */
document.addEventListener("click",async e=>{
  if(!window.MODO_STAFF) return;
  const sentA=e.target.closest("a[data-sent]");
  if(sentA){ S.sent[sentA.dataset.sent]=true; setTimeout(()=>{ const m=sentA.closest(".msg,.row"); if(m&&!m.querySelector(".sent")){ const s=document.createElement("span"); s.className="sent"; s.textContent="Abierto ✓"; (m.querySelector(".msg-k")||m.querySelector(".meta")).appendChild(s);} },50); return; }
  const b=e.target.closest("[data-act],.tab,#clubs .chip,#fab,#cfgBtn"); if(!b) return;
  if(b.classList.contains("tab")){ S.tab=b.dataset.tab; if(S.tab==="agenda") S.fecha=hoyISO; render(); scrollTo(0,0); if(S.tab==="agenda") centrarDia(); return; }
  if(b.matches("#clubs .chip")){ S.club=b.dataset.club; render(); return; }
  if(b.id==="fab"){ formAlumno(); return; }
  if(b.id==="cfgBtn"){ openCfg(); return; }
  const act=b.dataset.act,id=b.dataset.id;
  const A=id&&S.alumnos.find(x=>x.id===id), L=id&&S.leads.find(x=>x.id===id);
  switch(act){
    case "tab": S.tab=b.dataset.t; render(); scrollTo(0,0); if(S.tab==="agenda") centrarDia(); break;
    case "mes": { const [y,m]=S.mes.split("-").map(Number); S.mes=mesKey(new Date(y,m-1+Number(b.dataset.d),1)); render(); break; }
    case "dia": S.dia=Number(b.dataset.d); render(); break;
    case "fecha": { const st=document.getElementById("daysStrip"); const sl=st?st.scrollLeft:0; S.fecha=b.dataset.f; render(); const n=document.getElementById("daysStrip"); if(n) n.scrollLeft=sl; break; }
    case "pago": if(A){ const was=!!pago(A); if(await setPago(A,!was)) toast(was?`${A.nombre}: vuelve a deber`:`${A.nombre}: pagó ${money(montoMes(A))}`,()=>setPago(A,was)); } break;
    case "msg": if(A) openMensajes(A); break;
    case "copy": { const t=b.dataset.text; try{ await navigator.clipboard.writeText(t); toast("Mensaje copiado"); }catch(err){ const r=document.createRange(); const bub=b.closest(".msg")?.querySelector(".bubble"); if(bub){ r.selectNodeContents(bub); getSelection().removeAllRanges(); getSelection().addRange(r); toast("Texto seleccionado, copialo"); } } break; }
    case "recMas": if(A){ if(await setRec(A,1)){ toast(`${A.nombre}: +1 clase a recuperar (hasta el ${fechaDM(venceDe(hoyISO))})`); if($("#recQ")) openRecAdd($("#recQ").value); } } break;
    case "recAdd": openRecAdd(); break;
    case "pagoNuevo": openPagoProfe(); break;
    case "asCSV": exportAsist(); break;
    case "irAsist": S.asFecha=b.dataset.f; S.tab="asist"; render(); scrollTo(0,0); break;
    case "irHoras": S.horasFecha=b.dataset.f; S.tab="horas"; render(); setTimeout(()=>{ const el=document.querySelector('[data-act="hStep"]'); el&&el.scrollIntoView({block:"center"}); },50); break;
    case "telProfeSave": { const v=$("#telProfe").value.trim(); if(await safe(()=>S.db.doc("config/general").set({...S.cfg,telProfe:v}),"Teléfono guardado")){ S.cfg={...S.cfg,telProfe:v}; render(); } break; }
    case "verGastos": S.modo="profe"; S.tab="plata"; S.finMes=S.mes; S.asKey=null; render(); scrollTo(0,0); break;
    case "finNuevo": openFin(b.dataset.t); break;
    case "finCat": { fCat=b.dataset.c; document.querySelectorAll("#finCats .chip").forEach(x=>x.setAttribute("aria-pressed",x.dataset.c===fCat)); break; }
    case "finDel": { if(!b.classList.contains("armed")){ b.classList.add("armed"); b.textContent="¿Borrar?"; return; } S.fin=S.fin.filter(x=>x.id!==b.dataset.id); await saveFin(); break; }
    case "finMes": { const [y,mm]=S.finMes.split("-").map(Number); S.finMes=mesKey(new Date(y,mm-1+Number(b.dataset.d),1)); render(); break; }
    case "movDel": { if(!b.classList.contains("armed")){ b.classList.add("armed"); b.textContent="¿Borrar?"; return; } S.hMovs=S.hMovs.filter(x=>x.id!==b.dataset.id); render(); await guardarHorasDoc(); break; }
    case "pagoTodo": { $("#ppMonto").value=Math.max(0,saldoProfe().saldo); break; }
    case "vhSave": { const v=Number($("#vh2").value)||0; if(await safe(()=>S.db.doc("config/general").set({...S.cfg,valorHora:v}),`Valor por hora: ${money(v)}`)) render(); break; }
    case "ajuste": if(A) openAjuste(A); break;
    case "ajStep": { const i=$("#ajMonto"); i.value=Math.max(0,(Number(i.value)||0)+Number(b.dataset.d)); ajPreview(); break; }
    case "ajReset": { const a=S.alumnos.find(x=>x.id===$("#fAj").dataset.id); $("#ajMonto").value=cuotaMes(a); $("#ajNota").value=""; ajPreview(); break; }
    case "valorSave": { const v=Number($("#vHora").value)||0; if(await safe(()=>S.db.doc("config/general").set({...S.cfg,valorHora:v}),"Valor por hora guardado")) render(); break; }
    case "aumSave": { const v=Math.round((S.cfg.valorHora||0)*(1+(Number($("#aumPct").value)||0)/100)); if(v&&await safe(()=>S.db.doc("config/general").set({...S.cfg,valorHora:v,ultimoAumento:hoyISO}),`Nuevo valor: ${money(v)} por hora`)) render(); break; }
    case "modoProfe": closeSheet(); { const e=S.equipo[0];  if(!e) toast("Esteban todavía no cargó horas: vas a ver la pantalla vacía."); } S.modo="profe"; S.tab="horas"; S.asKey=null; render(); scrollTo(0,0); break;
    case "modoOwner": S.modo="owner"; S.tab="hoy"; S.club=""; S.asClub="ESPACIO"; S.asKey=null; render(); break;
    case "hDia": { const d=isoDate(S.horasFecha); d.setDate(d.getDate()+Number(b.dataset.d)); if(toISO(d)<=hoyISO){ S.horasFecha=toISO(d); render(); } break; }
    case "hStep": await setHoras(S.horasFecha, Math.max(0,(S.horas[S.horasFecha]||0)+Number(b.dataset.d))); break;
    case "hSet": { S.horasFecha=b.dataset.f; render(); scrollTo(0,0); break; }
    case "hAuto": await setHoras(b.dataset.f||S.horasFecha, Number(b.dataset.n)); break;
    case "asClub": S.asClub=b.dataset.c; render(); break;
    case "asDia": { const d=isoDate(S.asFecha); d.setDate(d.getDate()+Number(b.dataset.d)); S.asFecha=toISO(d); render(); break; }
    case "asHoy": S.asFecha=hoyISO; render(); break;
    case "marca": if(A) await marcar(A,b.dataset.hora,b.dataset.e); break;
    case "asRecAdd": openAsRecAdd(b.dataset.hora); break;
    case "asRecSel": if(A){ S.asMarcas[`${A.id}|${b.dataset.hora}`]="recuperando"; closeSheet(); if(await guardarAsist()){ await setRec(A,-1); toast(`${A.nombre} recupera hoy`); } } break;
    case "asRecQuitar": if(A){ delete S.asMarcas[`${A.id}|${b.dataset.hora}`]; render(); if(await guardarAsist()&&!avisoApp(A.id,S.asFecha,b.dataset.hora,"recupera")) await setRec(A,1,S.asFecha); } break;
    case "recMenos": if(A){ const prev=recPrev(A); if(await setRec(A,-1)) toast(`${A.nombre}: recuperó una clase`,()=>recVolver(A,prev)); } break;
    case "recTurno": { const t=turnos(b.dataset.club).find(x=>x.dia===Number(b.dataset.dia)&&x.hora===b.dataset.hora); if(!t) break;
      for(const a of t.al){ await setRec(a,1,b.dataset.f||hoyISO); } toast(`${t.al.length} alumnos anotados para recuperar`); closeSheet(); break; }
    case "lluvia": openLluvia(b.dataset.club,Number(b.dataset.dia),b.dataset.hora,b.dataset.f||hoyISO); break;
    case "stepRec": { const el=$("#aRec"); el.textContent=Math.max(0,Number(el.textContent)+Number(b.dataset.d)); break; }
    case "editA": if(A&&S.modo!=="profe"){ formAlumno(A); cargarHist(A); } break;
    case "close": closeSheet(); break;
    case "hadd": { const r=[...document.querySelectorAll("#hList .hrow .hc")].pop(); $("#hList").insertAdjacentHTML("beforeend",hRow(undefined,r?r.value:undefined)); break; }
    case "hdel": b.parentElement.remove(); break;
    case "cfgReset": { $("#cCobro").value=TPL_DEF.cobro; $("#cLluvia").value=TPL_DEF.lluvia; $("#cRec").value=TPL_DEF.recupera; toast("Volvieron los textos originales. Tocá Guardar."); break; }
    case "delA": case "delL": {
      if(!b.classList.contains("armed")){ b.classList.add("armed"); b.textContent="Tocá de nuevo para borrar"; return; }
      const f=b.closest("form"); const col=act==="delA"?colA():colL();
      if(await safe(()=>col.doc(f.dataset.id).delete(),"Borrado")) closeSheet(); break; }
    case "newL": formLead(); break;
    case "editL": if(L) formLead(L); break;
    case "avanzar": if(L){ const et=ETAPAS.find(x=>x.k===L.estado); const prev=L.estado; const d=new Date(); d.setDate(d.getDate()+2);
      const prox=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      if(await safe(()=>colL().doc(L.id).update({estado:et.next,proximo:prox}))) toast(`${L.nombre} → ${ETAPAS.find(x=>x.k===et.next).l}`,()=>safe(()=>colL().doc(L.id).update({estado:prev,proximo:L.proximo||null}))); } break;
    case "perdido": if(L){ const prev=L.estado; if(await safe(()=>colL().doc(L.id).update({estado:"perdido"}))) toast(`${L.nombre} archivado`,()=>safe(()=>colL().doc(L.id).update({estado:prev}))); } break;
    case "convertir": if(L) formAlumno({nombre:L.nombre,tel:L.tel,club:L.club,notas:L.nota},L.id); break;
    case "csv": exportCSV(); break;
    default: if(window.accionExtra) await window.accionExtra(act,b,A); break;
  }
});
document.addEventListener("input",e=>{ if(!window.MODO_STAFF) return; if(e.target.id==="q"){ S.q=e.target.value; render(); } if(e.target.id==="recQ"){ openRecAdd(e.target.value); } });
document.addEventListener("submit",async e=>{
  if(!window.MODO_STAFF) return;
  e.preventDefault(); const f=e.target;
  if(f.id==="fA"){
    const horarios=[...f.querySelectorAll(".hrow")].map(r=>{const h={dia:Number(r.querySelector(".hd").value),hora:r.querySelector("input").value,club:r.querySelector(".hc").value}; if(r.dataset.nivel) h.nivel=r.dataset.nivel; return h;}).filter(h=>h.hora);
    const data={nombre:$("#aNom").value.trim(),club:$("#aClub").value,tel:$("#aTel").value.trim(),categoria:$("#aCat").value.trim(),precioClase:Number($("#aPrecio").value)||0,horarios,notas:$("#aNota").value.trim()};
    const prevA=S.alumnos.find(x=>x.id===f.dataset.id)||{}; const pendA=prevA.id?recPendAvisos(prevA):[];
    { const nuevoRec=Number($("#aRec").textContent)||0; Object.assign(data,recCambio(prevA,nuevoRec-recN(prevA))); }
    if(!data.nombre) return;
    const id=f.dataset.id,lead=f.dataset.lead;
    if(id){ data.activo=$("#aAct").checked; if(await safe(async()=>{ const bt=S.db.batch(); bt.update(colA().doc(id),data); pendA.forEach(v=>bt.update(S.db.doc("avisos/"+v.id),{contado:true})); await bt.commit(); },"Guardado")) closeSheet(); }
    else { data.activo=true; data.tipo="Grupal"; data.pagos={}; data.alta=hoyISO;
      if(await safe(()=>colA().add(data),`${data.nombre} agregado`)){ if(lead) await safe(()=>colL().doc(lead).update({estado:"alumno",ganado:hoyISO})); closeSheet(); } }
  }
  if(f.id==="fL"){
    const data={nombre:$("#lNom").value.trim(),tel:$("#lTel").value.trim(),origen:$("#lOrig").value,club:$("#lClub").value,proximo:$("#lProx").value||null,nota:$("#lNota").value.trim()};
    if(!data.nombre) return; const id=f.dataset.id;
    if(id){ if(await safe(()=>colL().doc(id).update(data),"Guardado")) closeSheet(); }
    else { data.estado="nuevo"; data.alta=hoyISO; if(await safe(()=>colL().add(data),`${data.nombre} anotado`)) closeSheet(); }
  }
  if(f.id==="fFin"){
    const monto=Number($("#finMonto").value)||0; if(!monto) return;
    S.fin=[...S.fin,{id:"f"+Date.now().toString(36),tipo:fTipo,monto,cat:fCat,fecha:$("#finFecha").value||hoyISO,nota:$("#finNota").value.trim()}];
    closeSheet(); await saveFin(); toast(fTipo==="gasto"?`Gasto de ${money(monto)} anotado`:`Ingreso de ${money(monto)} anotado`);
  }
  if(f.id==="fPP"){
    const monto=Number($("#ppMonto").value)||0; if(!monto) return;
    S.hMovs=[...S.hMovs,{id:"p"+Date.now().toString(36),fecha:$("#ppFecha").value||hoyISO,monto,nota:$("#ppNota").value.trim(),por:S.esOwner?"Gabriel":"Esteban"}];
    closeSheet(); await guardarHorasDoc(); toast(`Pago de ${money(monto)} registrado`);
  }
  if(f.id==="fAj"){
    const a=S.alumnos.find(x=>x.id===f.dataset.id); if(!a) return;
    const v=Number($("#ajMonto").value)||0; const nota=$("#ajNota").value.trim(); const base=cuotaMes(a);
    const patch={ajuste: v===base&&!nota?null:v, nota}; if(pago(a)) patch.monto=v;
    if(await safe(()=>colA().doc(a.id).update({pagos:{[S.mes]:patch}}),v===base?"Vuelve al monto calculado":`${a.nombre}: paga ${money(v)} en ${mesSolo(S.mes)}`)) closeSheet();
  }
  if(f.id==="fC"){
    const data={alias:$("#cAlias").value.trim(),objetivoHoras:Number($("#cObj").value)||0,tpl:{cobro:$("#cCobro").value.trim()||TPL_DEF.cobro,lluvia:$("#cLluvia").value.trim()||TPL_DEF.lluvia,recupera:$("#cRec").value.trim()||TPL_DEF.recupera}};
    if(await safe(()=>S.db.doc("config/general").set({...S.cfg,...data}),"Guardado")) closeSheet();
  }
});

async function exportCSV(){
  const rows=[["Nombre","Club","Teléfono","Categoría","Precio por clase",`Total ${S.mes}`,"Horarios","A recuperar","Activo",`Pagó ${S.mes}`,"Notas"]];
  S.alumnos.forEach(a=>rows.push([a.nombre,[...clubsDe(a)].join(" + "),a.tel,a.categoria,a.precioClase,montoMes(a),horarioTxt(a),recN(a)||0,a.activo===false?"No":"Sí",pago(a)?"Sí":"No",a.notas]));
  const csv="﻿"+rows.map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(";")).join("\n");
  try{ await S.downloads.save({filename:`alumnos-${S.mes}.csv`,data:csv}); }catch(e){}
}

/* ---------- Boot: ver firebase.js ---------- */
new MutationObserver(()=>{ if(window.MODO_STAFF&&$("#overlay").hidden) render(); }).observe($("#overlay"),{attributes:true,attributeFilter:["hidden"]});
