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
const FMT_ARS = new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}); const _money = new Map();
const money = n => { n=n||0; let r=_money.get(n); if(r===undefined){ r=FMT_ARS.format(n); if(_money.size>2000) _money.clear(); _money.set(n,r); } return r; };
const pad = n => String(n).padStart(2,"0");
const now = new Date();
const hoyISO = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
const mesKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
// Si la app quedó abierta y cambió el día (iPhone la retoma sin recargar), recargamos para que fechas, cuotas y vencimientos estén al día.
{ const diaHoy=()=>{ const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
  const chequear=()=>{ if(document.visibilityState!=="visible"||diaHoy()===hoyISO) return; const ov=document.getElementById("overlay"); if(ov&&!ov.hidden) return; location.reload(); };
  document.addEventListener("visibilitychange",chequear); setInterval(chequear,60*1000); }
const _mesLbl = {}; const mesLbl = k => _mesLbl[k] || (_mesLbl[k] = (([y,m])=>new Date(+y,+m-1,1).toLocaleDateString("es-AR",{month:"long",year:"numeric"}))(k.split("-")));
const mesSolo = k => mesLbl(k).split(" ")[0];
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const telDigits = tel => { let d=String(tel||"").replace(/\D/g,""); if(!d) return ""; if(d.startsWith("54")) return d; if(d.startsWith("0")) d=d.slice(1); if(d.length===10) return "549"+d; if(d.length===11 && d.startsWith("9")) return "54"+d; return d; };
const waURL = (tel,text) => { const d=telDigits(tel); return d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : ""; };
const nombreCorto = n => String(n||"").trim().split(/\s+/)[0].replace(/^./,c=>c.toUpperCase());

const S = { tab:"hoy", club:"", mes:mesKey(now), q:"", dia:now.getDay(), fecha:hoyISO, alumnos:[], leads:[], cfg:{}, loaded:{a:false,l:false}, db:null, dbState:"cargando", downloads:null, asFecha:hoyISO, asClub:"ESPACIO", modo:"owner", esOwner:true, uid:null, user:null, horas:{}, hVal:{}, hMovs:[], fin:[], finEq:{}, asHist:{}, finMes:mesKey(now), horasFecha:hoyISO, metas:null, metasEq:{}, equipo:[], nombres:{}, asMarcas:{}, asKey:null, asUnsub:null, sent:{}, avisos:[], usuarios:[], perfil:null, vistos:{}, comps:{}, reemp:{} };

$("#todayLbl").textContent = now.toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"});

function byClub(list){ return S.club ? list.filter(x=>enClub(x,S.club)) : list; }
function activos(){ return byClub(S.alumnos.filter(a=>a.activo!==false)); }
function pago(a,m=S.mes){ return a.pagos && a.pagos[m] && a.pagos[m].pagado; }
const _ocu = {}; function ocurrencias(dia,m){ const k=dia+"|"+m; if(_ocu[k]!==undefined) return _ocu[k]; return (_ocu[k]=ocurrencias0(dia,m)); }
function ocurrencias0(dia,m){ const [y,mm]=m.split("-").map(Number); let n=0; const last=new Date(y,mm,0).getDate(); for(let d=1;d<=last;d++) if(new Date(y,mm-1,d).getDay()===dia) n++; return n; }
function diasDe(a){ return [...new Set((a.horarios||[]).map(h=>h.dia))]; }
function clasesDesde(a,f){ const d0=isoDate(f); const last=new Date(d0.getFullYear(),d0.getMonth()+1,0).getDate(); const ds=(a.horarios||[]).map(h=>Number(h.dia)); let n=0; for(let d=d0.getDate();d<=last;d++){ const wd=new Date(d0.getFullYear(),d0.getMonth(),d).getDay(); n+=ds.filter(x=>x===wd).length; } return n; }
const mesSig=m=>mesKey(new Date(Number(m.slice(0,4)),Number(m.slice(5,7)),1));
// Primer mes de un alumno nuevo: cuántas clases le quedan desde que empieza y qué paga cada mes.
function planPrimerMes(a,ini,promo,modo,dur=1){ const m=ini.slice(0,7), sig=mesSig(m); const quedan=clasesDesde(a,ini); const p=promo||a.precioClase||0; const dd=isoDate(ini); const fd=`${dd.getDate()}/${dd.getMonth()+1}`; const cl=n=>`${n} clase${n===1?"":"s"}`;
  const n=promo?Math.max(1,dur||1):1; const pagos={}, lin=[]; let k=m;
  if(modo==="sig"){ pagos[m]={pagado:true,monto:0,ajuste:0,nota:`Empieza el ${fd}: estas clases se pagan con ${mesSolo(sig)}`}; lin.push(`${mesSolo(m)}: no paga (empieza el ${fd})`); k=sig; }
  for(let i=0;i<n;i++,k=mesSig(k)){ const c=clasesMes(a,k)+(i===0&&modo==="sig"?quedan:0)-(i===0&&modo!=="sig"?clasesMes(a,k)-quedan:0); const tot=c*p; const tag=promo?(n>1?`Promo ${i+1}/${n} · `:"Promo · "):"";
    pagos[k]={ajuste:tot,nota:i===0?(modo==="sig"?`${tag}incluye ${cl(quedan)} de ${mesSolo(m)}`:`${tag}empieza el ${fd} (${cl(quedan)})`):`${tag}${cl(c)} x ${money(p)}`};
    lin.push(`${mesSolo(k)}: ${i===0&&modo==="sig"?`${quedan} + ${clasesMes(a,k)} clases`:cl(c)} x ${money(p)} = ${money(tot)}${promo?" (promo)":""}`); }
  if(a.precioClase) lin.push(`Desde ${mesSolo(k)}: ${money(a.precioClase)} por clase${promo?" (precio normal)":""}`);
  return {m,sig,quedan,p,pagos,txt:lin.join(" · ")}; }
// Cada horario puede tener "desde" (un día que se sumó después): ese día cuenta solo desde esa fecha.
function clasesMes(a,m=S.mes){ /* cada horario cuenta como una clase aparte, aunque sean dos horas el mismo día */
  return (a.horarios||[]).reduce((s,h)=>{ const dia=Number(h.dia), ds=h.desde||""; if(!ds||ds.slice(0,7)<m) return s+ocurrencias(dia,m); if(ds.slice(0,7)>m) return s; const d0=isoDate(ds); const last=new Date(d0.getFullYear(),d0.getMonth()+1,0).getDate(); let n=0; for(let d=d0.getDate();d<=last;d++) if(new Date(d0.getFullYear(),d0.getMonth(),d).getDay()===dia) n++; return s+n; },0); }
// ¿Este alumno va a este turno en esta fecha? (ya arrancó y, si el día lo sumó después, ya empezó ese día)
function vaEn(a,t,f){ if(a.inicio&&a.inicio>f) return false; const h=(a.horarios||[]).find(x=>x.dia===t.dia&&x.hora===t.hora&&clubH(a,x)===t.club); return !(h&&h.desde&&h.desde>f); }
// Aumentos: cada alumno guarda [{desde:"YYYY-MM", precio, antes, monto, aplicado}]. Los futuros quedan programados y se aplican solos al llegar el mes.
function aumentosDe(a){ return (a.aumentos||[]).filter(x=>x&&x.desde).slice().sort((x,y)=>x.desde.localeCompare(y.desde)); }
// Datos del primer mes que se cargaron al darlo de alta (para poder cambiar la fecha de arranque después).
function planGuardado(a){ if(!a||!a.inicio||!a.promo||a.inicioManual) return null; /* solo alumnos dados de alta con la app; la fecha cargada a mano nunca genera cuotas */ const act=mesKey(now); const m0=a.inicio.slice(0,7);
  const pr=a.promo||{}; const p0=(a.pagos||{})[m0]||{};
  const modo=pr.modo||(p0.pagado&&!p0.monto&&String(p0.nota||"").startsWith("Empieza el")?"sig":"este");
  const meses=Object.keys(planPrimerMes(a,a.inicio,pr.precioClase||0,modo,pr.meses||1).pagos); if(meses.every(m=>m<act&&(a.pagos||{})[m]&&(a.pagos[m].pagado&&a.pagos[m].monto))) return null;
  return {ini:a.inicio,promo:pr.precioClase||0,dur:pr.meses||1,modo}; }
const pagoReal = p => !!(p&&p.pagado&&(p.monto>0||p.comprobante));
function precioEn(a,m=S.mes){ const L=aumentosDe(a), act=mesKey(now);
  if(m>=act){ const f=L.filter(x=>!x.aplicado&&x.desde<=m).pop(); return f?f.precio:(a.precioClase||0); }
  const pas=L.filter(x=>x.desde<=m).pop(); if(pas&&pas.precio) return pas.precio; const sig=L.find(x=>x.desde>m&&x.aplicado); return sig&&sig.antes?sig.antes:(a.precioClase||0); }
function ultimoAumento(a){ return aumentosDe(a).filter(x=>x.desde<=mesKey(now)).pop()||null; }
function aumentoProx(a){ return aumentosDe(a).find(x=>!x.aplicado&&x.desde>mesKey(now))||null; }
function cuotaMes(a,m=S.mes){ const p=precioEn(a,m); return p>0 ? clasesMes(a,m)*p : (a.cuota||0); }
function extraDias(a,m=S.mes){ return (a.horarios||[]).map(h=>Number(h.dia)).filter(d=>ocurrencias(d,m)===5); }
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
   Cada clase se recupera en las 2 semanas siguientes a la falta: vence el viernes de la segunda semana después.
   recN(a) = cuántas tiene. a.recVence = {"2026-10-31": 2, ...} = hasta cuándo vale cada una. */
// Las clases son de lunes a viernes: si el vencimiento cae sábado o domingo, vence el viernes anterior.
function habil(f){ const d=isoDate(f); while(d.getDay()===0||d.getDay()===6) d.setDate(d.getDate()-1); return toISO(d); }
// Arranque con la app: lo que se debe de antes de noviembre (cargado a mano o faltas de octubre) vale hasta el 30/11.
// Desde noviembre, cada falta se recupera en 2 semanas.
const REC_INI={corte:"2026-11-01",vence:"2026-11-30",desde:"2026-10-16",hasta:"2026-11-20"};
const recIni=k=>(k>=REC_INI.desde&&k<REC_INI.hasta)?REC_INI.vence:k;
function venceDe(f){ if(f<REC_INI.corte) return REC_INI.vence; const d=isoDate(f); d.setDate(d.getDate()-((d.getDay()+6)%7)+18); return toISO(d); }
const fechaDM = f => { const d=isoDate(f); return `${d.getDate()}/${d.getMonth()+1}`; };
// Faltas avisadas por la app que todavía no se ubicaron en su mes (las ubica el proceso automático o la próxima edición).
const avisosDe=()=>(!window.MODO_STAFF&&typeof P!=="undefined"?P.avisos:S.avisos)||[];
const esFijoDe=(a,club,f,hora)=>(a.horarios||[]).some(h=>Number(h.dia)===isoDate(f).getDay()&&h.hora===hora&&clubH(a,h)===club);
// La reserva de recuperación del mismo turno (si la hay).
const recDelTurno=(a,v)=>avisosDe().find(x=>x.alumnoId===a.id&&x.tipo==="recupera"&&x.fecha===v.fecha&&x.hora===v.hora);
// Faltas que suman para recuperar y todavía no están ubicadas. Incluye recuperaciones canceladas con 24 h (no "al final voy" en su horario fijo).
function recPendAvisos(a){ return avisosDe().filter(v=>v.alumnoId===a.id&&v.tipo==="ausencia"&&v.conRecupero&&v.contado===false&&!(recDelTurno(a,v)&&esFijoDe(a,v.club,v.fecha,v.hora))); }
// Hasta cuándo vale: una falta, 2 semanas; una recuperación cancelada a tiempo conserva el vencimiento que tenía.
function venceAviso(a,v){ const r=recDelTurno(a,v); return r?(r.vence||venceDe(hoyISO)):venceDe(v.fecha); }
// Devuelve las vigentes: [{vence, n}] ordenadas. a.recuperar manda en la cantidad; si tiene menos, se descuentan las que vencen antes.
function recBuckets(a,pend=recPendAvisos(a).map(v=>venceAviso(a,v))){
  const tot=Math.max(0,a.recuperar||0); const m={};
  Object.entries(a.recVence||{}).forEach(([k,n])=>{ n=Number(n)||0; if(n>0){ k=recIni(habil(k)); m[k]=(m[k]||0)+n; } });
  pend.forEach(k=>{ m[k]=(m[k]||0)+1; });
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
// Grilla fija de Jump: de lunes a viernes, de 16:30 a 22:30, último turno 21:30 (Espacio queda solo con los turnos que tienen alumnos). Aunque no haya ningún alumno fijo,
// el turno aparece (vacío, con los 4 lugares libres) para ofrecerlo y para que los alumnos recuperen ahí.
const GRILLA={clubes:["JUMP"],dias:[1,2,3,4,5],horas:["16:30","17:30","18:30","19:30","20:30","21:30"]};
function turnosGrilla(club){
  const ts=turnos(club); const ya=new Set(ts.map(t=>`${t.club}|${t.dia}|${t.hora}`));
  GRILLA.clubes.filter(c=>!club||c===club).forEach(c=>GRILLA.dias.forEach(d=>GRILLA.horas.forEach(h=>{
    if(!ya.has(`${c}|${d}|${h}`)) ts.push({club:c,dia:d,hora:h,nivel:"",al:[],vacio:true}); })));
  return ts;
}
function slotsDe(dia){ return turnosGrilla(S.club).filter(t=>t.dia===dia).sort((x,y)=>x.hora.localeCompare(y.hora)||x.club.localeCompare(y.club)); }
const catNorm = c => String(c||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/^iniciales$/,"inicial");
/* Categorías para elegir tocando (sin escribir, así no hay errores de tipeo). Se guardan en minúscula. */
const CATS_AL=["Inicial","Octava","Séptima","Sexta","Quinta","Cuarta"];
function catPicker(id,cur){
  const n=catNorm(cur); const opts=CATS_AL.map(c=>[c.toLowerCase(),c]); let val=String(cur||"").trim();
  const hit=opts.find(([v])=>catNorm(v)===n); if(hit) val=hit[0]; else if(n) opts.push([val,val]);
  return `<input type="hidden" id="${id}" value="${esc(val)}"><div class="cat-pick" data-for="${id}" style="display:flex;gap:6px;flex-wrap:wrap">${opts.map(([v,l])=>`<button type="button" class="chip" data-act="catPick" data-v="${esc(v)}" aria-pressed="${!!n&&catNorm(v)===n}" style="text-transform:none;letter-spacing:0;font-size:14px;padding:9px 14px">${esc(l)}</button>`).join("")}</div>`;
}
function elegirCat(b){ const box=b.closest(".cat-pick"); const inp=box&&document.getElementById(box.dataset.for); if(!inp) return;
  const on=b.getAttribute("aria-pressed")!=="true"; box.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed","false"));
  b.setAttribute("aria-pressed",String(on)); inp.value=on?b.dataset.v:""; }
/* Esteban (vista de profe): cambia la categoría de un alumno de Jump tocando su nombre en la agenda. */
function openCatAlumno(a){
  openSheet(`<div style="display:grid;gap:4px"><span class="flabel">Categoría</span><h2 class="disp">${esc(a.nombre)}</h2><span class="small muted">Tocá la categoría en la que está ahora. El alumno no la ve.</span></div>
    <div class="field">${catPicker("cAl",a.categoria)}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="mini" data-act="close">Cancelar</button><button class="mini go" data-act="catAlOk" data-id="${a.id}">Guardar</button></div>`);
}
async function guardarCatAlumno(a){
  if(S.modo==="profe"&&!clubsDe(a).has("JUMP")){ toast("Solo podés cambiar alumnos de Jump"); return; }
  const val=($("#cAl").value||"").trim();
  const ok=await safe(()=>colA().doc(a.id).update({categoria:val}));
  if(ok){ closeSheet(); toast(val?`${a.nombre}: ${capCat(val)}`:`${a.nombre}: sin categoría`); }
}
function catsDe(a){ const set=new Set(); String(a.categoria||"").split(",").map(catNorm).filter(Boolean).forEach(c=>set.add(c)); (a.horarios||[]).forEach(h=>h.nivel&&set.add(catNorm(h.nivel))); return set; }
function ordenSemana(t){ const hoyD=now.getDay()||7; return (((t.dia||7)-hoyD+7)%7)*10000+Number(String(t.hora).replace(":","")); }
function opcionesRecupera(a,max=3){
  const mios=new Set((a.horarios||[]).map(h=>`${clubH(a,h)}|${h.dia}|${h.hora}`)); const cats=catsDe(a); const cl=clubsDe(a);
  return turnosGrilla("").filter(t=>cl.has(t.club) && t.al.length<CUPO && !mios.has(`${t.club}|${t.dia}|${t.hora}`) && (cats.size&&t.al.length ? (t.nivel && cats.has(catNorm(t.nivel))) : true))
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
  if(aj!==null){ const na=precioEn(a)?aj/precioEn(a):0;
    if(na>0&&Number.isInteger(na)) return fill(tpl("cobro"),{nombre:nombreCorto(a.nombre),mes:mesSolo(S.mes),clases:na,precio:money(precioEn(a)),total:money(aj),extra:"",alias});
    return `Hola ${nombreCorto(a.nombre)}, ¿cómo estás? Te paso lo de ${mesSolo(S.mes)}: el total es ${money(aj)}.${alias}`.trim(); }
  return fill(tpl("cobro"),{nombre:nombreCorto(a.nombre),mes:mesSolo(S.mes),clases:n,precio:money(precioEn(a)),total:money(cuotaMes(a)),extra,alias});
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
    <button class="btn pri" data-act="recTurno" data-club="${club}" data-dia="${dia}" data-hora="${hora}" data-f="${fecha}">Marcar suspendida por lluvia (todos recuperan)</button>
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
/* ---------- Hoy: la clase de ahora, el resto del día y lo que hay que resolver ---------- */
const sumMin=(h,m)=>{ const [a,b]=h.split(":").map(Number); const x=a*60+b+m; return `${pad(Math.floor(x/60))}:${pad(x%60)}`; };
const clubN=c=>c==="ESPACIO"?"Espacio":"Jump";
function estHoy(t){ const f=hoyISO, h=t.hora; const al=t.al.filter(a=>vaEn(a,t,f));
  const aus=al.filter(a=>avisoApp(a.id,f,h,"ausencia")&&!vuelveApp(a.id,f,h));
  const recs=S.avisos.filter(v=>v.tipo==="recupera"&&v.club===t.club&&v.fecha===f&&v.hora===h&&!vuelveApp(v.alumnoId,f,h)).map(v=>S.alumnos.find(x=>x.id===v.alumnoId)).filter(Boolean);
  const mk=(S.asMes||{})[`${t.club}|${f}`]||{}; const marcas=Object.keys(mk).filter(k=>k.endsWith("|"+h)); const lluvia=marcas.length&&marcas.every(k=>mk[k]==="lluvia");
  const vienen=al.length-aus.length+recs.length; return {al,aus,recs,vienen,libres:Math.max(0,CUPO-vienen),tomada:marcas.length>0,lluvia}; }
function vHoy(){
  const owner=S.esOwner&&S.modo!=="profe"; if(owner) escucharAsMes(mesKey(now));
  const p="";
  return `${p}<div id="secAvisos">${avisosHoyHTML()}</div>${vAgenda()}${owner?libresHoyHTML():""}${S.alumnos.length?"":emptyAlumnos()}`;
}
/* ---------- Pendientes de Gabriel (arriba de Hoy): lo que hay que hacer, y se va solo cuando está hecho ---------- */
function pendDuenoHTML(){ const it=[]; const mAct=mesKey(now); escucharAsMes(mAct); const hhmm=`${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const item=(color,txt,btn)=>it.push(`<div class="pd-i"><i style="background:${color}"></i><span>${txt}</span>${btn||""}</div>`);
  const clubN=c=>c==="ESPACIO"?"Espacio":"Jump";
  // 0) Pedidos para sumar un día
  (S.solic||[]).filter(x=>x.estado==="pendiente").forEach(x=>{ const a=S.alumnos.find(y=>y.id===x.alumnoId); if(!a) return;
    item("#13834f",`<b>${esc(nombreCorto(a.nombre))}</b> quiere sumar los <b>${DIAS_LARGO[x.dia].toLowerCase()} ${x.hora}</b> · ${clubN(x.club)}`,`<button class="mini go" data-act="solVer" data-id="${x.id}">Ver</button>`); });
  // 1b) Alumnos nuevos: primera clase hoy, y después preguntarle qué le pareció
  activos().filter(esNuevo).forEach(a=>{ const pc=primeraClase(a); if(!pc) return; const hs=(a.horarios||[]).filter(h=>Number(h.dia)===isoDate(pc).getDay()).map(h=>`${h.hora} · ${clubN(clubH(a,h))}`).join(", ");
    if(pc===hoyISO) item("#13834f",`<b>${esc(a.nombre)}</b> tiene hoy su <b>primera clase</b> (${hs})`,"");
    else if(pc<hoyISO&&!a.charlaOk&&pc>=toISO(new Date(now.getFullYear(),now.getMonth(),now.getDate()-10))){ const url=waURL(a.tel,`Hola ${nombreCorto(a.nombre)}! ¿Qué te pareció la clase? 🎾`);
      item("#13834f",`Preguntale a <b>${esc(a.nombre)}</b> qué le pareció la primera clase (${fmtCorto(pc)})`,`<span style="display:flex;gap:6px">${url?`<a class="mini" href="${url}" target="_blank" rel="noopener">WhatsApp</a>`:""}<button class="mini" data-act="charlaOk" data-id="${a.id}">Listo</button></span>`); } });
  // 2) Avisos de alumnos sin ver
  const nAv=S.avisos.filter(v=>!v.visto&&!S.vistos[v.id]).length;
  if(nAv) item("var(--k-amb)",`<b>${nAv} aviso${nAv===1?"":"s"}</b> de alumnos sin ver`,`<a class="mini" href="#secAvisos">Ver</a>`);
  // 3) Esteban: días sin horas o sin asistencia
  const fl=faltantes().filter(x=>!x.esHoy&&(x.sinAsist.length||x.sinHoras)); const nP=(S.equipo[0]&&S.nombres[S.equipo[0].id]||"Esteban").split(" ")[0];
  if(fl.length) item("var(--k-no)",`<b>${esc(nP)}</b> no cargó ${fl.length===1?`el ${fmtCorto(fl[0].fecha)}`:`${fl.length} días`} (${textoFaltan(fl[0])})`,`<button class="mini" data-act="tab" data-t="admin">Ver</button>`);
  // 4) Cobros
  const d=now.getDate(); if(S.mes===mAct&&d>=10){ const deb=activos().filter(a=>montoMes(a)>0&&!pago(a)&&!(a.inicio&&a.inicio.slice(0,7)>mAct));
    if(deb.length) item(d>14&&mAct>="2026-11"?"var(--k-no)":"var(--k-amb)",`<b>${deb.length} ${deb.length===1?"alumno debe":"alumnos deben"}</b> ${mAct<"2026-11"?` ${mesSolo(mAct)}`:d>14?" la cuota (vencida)":" la cuota · vence el 14"}`,`<button class="mini" data-act="verDeben">Cobrar</button>`); }
  // 5) Recuperaciones que vencen en los próximos 4 días
  const lim=toISO(new Date(now.getFullYear(),now.getMonth(),now.getDate()+4)); const pv=activos().filter(a=>recBuckets(a).some(b=>b.vence<=lim));
  if(pv.length) item("var(--k-amb)",`<b>${pv.length} alumno${pv.length===1?"":"s"}</b> con clases a recuperar que vencen esta semana`,`<button class="mini" data-act="tab" data-t="recuperar">Ofrecer</button>`);
  // 6) Fin de mes: canchas y Esteban del mes anterior sin pagar (primeros 15 días)
  if(d<=15){ const mA=mesAnt(mAct); CANCHAS.forEach(([c])=>{ const C=canchaDe(c); const pg=C.pagos[mA]; const tot=canchaTotal(c,mA); if(tot>0&&!(pg&&pg.pagado)) item("var(--k-amb)",`<b>Pagar cancha ${esc(C.lugar)}</b> de ${mesSolo(mA)} · ${money(tot)}`,`<button class="mini" data-act="tab" data-t="admin">Ver</button>`); });
    if(S.equipo[0]){ const {saldo}=saldoProfe(); if(saldo>0) item("var(--k-amb)",`<b>Pagarle a ${esc(nP)}</b> · le debés ${money(saldo)}`,`<button class="mini" data-act="tab" data-t="admin">Ver</button>`); } }
  if(!it.length) return "";
  return `<section class="w-card w-pend"><div class="w-card-h"><b>Para resolver</b><span>${it.length}</span></div>${it.join("")}</section>`; }

/* ---------- Plata: lo que te queda, cómo vienen los cobros (los pagos entran solos por la app) y lo que pagás ---------- */
function plataMes(m){ const al=S.alumnos.filter(a=>a.activo!==false&&!(a.inicio&&a.inicio.slice(0,7)>m));
  const cobran=al.filter(a=>montoMes(a,m)>0); const pag=cobran.filter(a=>pago(a,m)); const deben=cobran.filter(a=>!pago(a,m));
  const ing=cobran.reduce((t,a)=>t+montoMes(a,m),0), cob=pag.reduce((t,a)=>t+cobradoDe(a,m),0);
  const eq=S.equipo[0]; const gE=eq?ganadoEn(m):0; const pagE=eq?S.hMovs.filter(x=>(x.fecha||"").startsWith(m)).reduce((t,x)=>t+(Number(x.monto)||0),0):0;
  const cs=CANCHAS.map(([c])=>{ const C=canchaDe(c); const pg=C.pagos[m]; return {c,tot:canchaTotal(c,m),pg:!!(pg&&pg.pagado)}; });
  const tOtros=(S.gastosG||[]).filter(x=>(x.fecha||"").startsWith(m)).reduce((t,x)=>t+(Number(x.monto)||0),0);
  const gastos=gE+cs.reduce((t,x)=>t+x.tot,0)+tOtros, pagado=pagE+cs.filter(x=>x.pg).reduce((t,x)=>t+x.tot,0)+tOtros;
  return {cobran,pag,deben,ing,cob,gastos,pagado,queda:cob-pagado,quedaFin:ing-gastos}; }
/* ---------- INICIO estilo billetera: saldo, accesos rápidos, hoy y actividad ---------- */
const WI={
  asist:'<path d="M9 4h6v3H9z"/><rect x="5" y="5" width="14" height="16" rx="2"/><path d="m9 13 2 2 4-4"/>',
  clases:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  alumnos:'<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14c2.4 0 4 1.5 4.5 4"/>',
  cobrar:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  rec:'<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
  libres:'<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
  lluvia:'<path d="M7 15a4 4 0 1 1 .9-7.9A5 5 0 0 1 17.5 9 3.5 3.5 0 0 1 17 16H7z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>',
  admin:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-4 3.6-6 7-6s6.2 2 7 6"/>',
  bell:'<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  ojo:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
  mas:'<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>', cancha:'<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M4 12h16M12 3v18"/>',
  in:'<path d="M12 5v14M6 13l6 6 6-6"/>', out:'<path d="M12 19V5M6 11l6-6 6 6"/>'};
const wico=(k,cl="")=>`<svg class="${cl}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${WI[k]}</svg>`;
let OJO=true; try{ OJO=localStorage.getItem("ojoPlata")!=="0"; }catch(e){}
/* ---------- Agenda fija de la semana: quién va cada día y hora (para contestar a los que preguntan) ---------- */
function vSemana(){
  const cl=S.semClub||""; const todos=turnosGrilla("").filter(t=>!cl||t.club===cl);
  const dias=[1,2,3,4,5,6,0].filter(d=>turnosGrilla("").some(t=>t.dia===d));
  if(S.semDia===undefined||!dias.includes(S.semDia)) S.semDia=dias.includes(now.getDay())?now.getDay():(dias[0]??1);
  const d=S.semDia; const ts=todos.filter(t=>t.dia===d).sort((a,b)=>a.hora.localeCompare(b.hora)||a.club.localeCompare(b.club));
  const n=x=>todos.filter(t=>t.dia===x).length;
  const lib=ts.reduce((t,x)=>t+Math.max(0,CUPO-x.al.length),0), al=ts.reduce((t,x)=>t+x.al.length,0);
  return `
  <div class="w-seg sem-dias">${dias.map(x=>`<button data-act="semDia" data-d="${x}" aria-pressed="${x===d}"><b>${DIAS[x]}</b><small>${n(x)} turno${n(x)===1?"":"s"}</small></button>`).join("")}</div>
  <div class="w-seg">${[["","Todos"],["JUMP","Jump"],["ESPACIO","Espacio"]].map(([v,l])=>`<button data-act="semClub" data-v="${v}" aria-pressed="${cl===v}">${l}</button>`).join("")}</div>
  <p class="sem-res">${/s$/.test(DIAS_LARGO[d])?DIAS_LARGO[d]:DIAS_LARGO[d]+"s"} · ${ts.length} turno${ts.length===1?"":"s"} · ${al} alumnos · <b>${lib} lugar${lib===1?"":"es"} libre${lib===1?"":"s"}</b></p>
  ${ts.length?ts.map(t=>{ const lb=Math.max(0,CUPO-t.al.length);
    return `<section class="w-card sem-t"><div class="sem-h"><b class="num">${t.hora}</b><span class="tag ${t.club}">${clubN(t.club)}</span>${t.al.length?`<button class="sem-cat" data-act="turnoCat" data-club="${t.club}" data-dia="${t.dia}" data-hora="${t.hora}">${t.nivel?esc(t.nivel):"+ Categoría"}</button>`:`<span class="sem-cat">Vacío</span>`}<span class="sem-cupo ${lb?"":"full"}">${t.al.length}/${CUPO}</span></div>
      <div class="sem-al">${t.al.slice().sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(a=>`<button data-act="editA" data-id="${a.id}">${esc(a.nombre)}${(()=>{ const hh=(a.horarios||[]).find(x=>x.dia===t.dia&&x.hora===t.hora&&clubH(a,x)===t.club); const ds=[a.inicio,hh&&hh.desde].filter(Boolean).sort().pop(); return ds&&ds>hoyISO?` <small>empieza ${fechaDM(ds)}</small>`:""; })()}</button>`).join("")}${lb?`<span class="lib">${lb} lugar${lb===1?"":"es"} libre${lb===1?"":"s"}</span>`:'<span class="full">Completo</span>'}</div></section>`; }).join(""):`<p class="w-empty">No hay turnos los ${DIAS_LARGO[d].toLowerCase()}${cl?` en ${clubN(cl)}`:""}.</p>`}
  <section class="sec" style="display:flex;justify-content:center"><button class="linkish" data-act="tab" data-t="hoy">Ver por fecha (con avisos y lluvia) ›</button></section>`;
}
/* ---------- Pedido de un alumno para sumar un día: Gabriel lo aprueba y elige desde cuándo ---------- */
document.addEventListener("change",e=>{ if(e.target&&e.target.id==="solDesde"&&S.solId){ S.solDesde=e.target.value; openSolicitud(S.solId); } });
function proxFecha(dia){ const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1); while(d.getDay()!==dia) d.setDate(d.getDate()+1); return toISO(d); }
function openSolicitud(id){ const x=(S.solic||[]).find(y=>y.id===id); if(!x) return; const a=S.alumnos.find(y=>y.id===x.alumnoId); if(!a) return;
  const t=turnos(x.club).find(y=>y.dia===x.dia&&y.hora===x.hora); const ocup=t?t.al.length:0; const desde=S.solDesde||proxFecha(x.dia);
  const pc=precioEn(a,mesKey(now))||a.precioClase||0; const m=mesKey(now); const n=desde.slice(0,7)===m?(()=>{ const d0=isoDate(desde); const last=new Date(d0.getFullYear(),d0.getMonth()+1,0).getDate(); let k=0; for(let d=d0.getDate();d<=last;d++) if(new Date(d0.getFullYear(),d0.getMonth(),d).getDay()===x.dia) k++; return k; })():0;
  const pagoMes=pago(a,m);
  openSheet(`<div style="display:grid;gap:4px"><span class="flabel">Pedido de un alumno</span><h2 class="disp">${esc(a.nombre)}</h2></div>
    <div class="msg" style="gap:6px"><span>Quiere sumar los <b>${DIAS_LARGO[x.dia].toLowerCase()} ${x.hora}</b> en ${clubN(x.club)}${x.nivel?` (${esc(x.nivel)})`:""}.</span><span class="small muted">Hoy va: ${esc(horarioTxt(a))} · Ese turno tiene ${ocup}/${CUPO}.</span></div>
    <div class="field"><label for="solDesde">Empieza el</label><input id="solDesde" type="date" value="${desde}"></div>
    <p class="small" style="margin:0">${n?`En ${mesSolo(m)} suma <b>${n} clase${n===1?"":"s"}</b> (${money(n*pc)}).${pagoMes?" Ya pagó este mes: esas clases cobralas aparte.":" Se suma solo a la cuota del mes."} `:""}Desde ${mesSolo(n?mesSig(m):desde.slice(0,7))} paga ${clasesMes({...a,horarios:[...(a.horarios||[]),{dia:x.dia,hora:x.hora,club:x.club}]},mesSig(m))} clases por mes.</p>
    <div class="btns"><button class="btn sec2" data-act="solNo" data-id="${id}">No puedo</button><span style="display:flex;gap:8px"><button class="btn sec2" data-act="close">Después</button><button class="btn pri" data-act="solOk" data-id="${id}">Aprobar</button></span></div>`); }
async function aprobarSolicitud(id){ const x=(S.solic||[]).find(y=>y.id===id); if(!x) return; const a=S.alumnos.find(y=>y.id===x.alumnoId); if(!a) return;
  const desde=($("#solDesde")||{}).value||proxFecha(x.dia); const h={dia:x.dia,hora:x.hora,club:x.club,desde}; if(x.nivel) h.nivel=x.nivel;
  const horarios=[...(a.horarios||[]),h]; closeSheet();
  if(await safe(async()=>{ const bt=S.db.batch(); bt.update(colA().doc(a.id),{horarios}); bt.update(S.db.doc("solicitudes/"+id),{estado:"aprobado",desde,avisadoAl:false}); await bt.commit(); },`${nombreCorto(a.nombre)} suma los ${DIAS_LARGO[x.dia].toLowerCase()} desde el ${fechaDM(desde)}`)){ a.horarios=horarios; S.solDesde=null; render(); } }
function vInicioG(){
  const m=mesKey(now); escucharAsMes(m); const P=plataMes(m), A=plataMes(mesAnt(m)); const hhmm=`${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const nomC=(S.perfil&&S.perfil.nombre)||"Gabriel"; const nom=nomC.split(" ")[0]; const ini=nomC.split(" ").map(x=>x.charAt(0)).join("").slice(0,2).toUpperCase()||"G";
  const nAv=S.avisos.filter(v=>!v.visto&&!S.vistos[v.id]).length;
  const nAl=activos().length, nAlA=A.cobran.length; const dif=nAl-nAlA;
  const pct=P.cobran.length?Math.round(P.pag.length/P.cobran.length*100):0;
  const hc=S.hoyClub||"";
  const ts=turnosGrilla("").filter(t=>t.dia===now.getDay()&&(!hc||t.club===hc)).map(t=>({...t,e:estHoy(t)})).filter(t=>t.e.al.length||t.e.recs.length).sort((a,b)=>a.hora.localeCompare(b.hora)||a.club.localeCompare(b.club));
  const nT=c=>turnos(c).filter(t=>t.dia===now.getDay()).length;
  const filas=ts.map(t=>{ const e=t.e; const fin=sumMin(t.hora,60)<=hhmm;
    const st=e.lluvia?'<span class="w-st">⛔ Suspendida</span>':e.tomada?'<span class="w-st ok">✓ Tomada</span>':fin?'<span class="w-st no">Tomar asistencia</span>':`<span class="w-st">${e.vienen} vienen</span>`;
    const nombres=[...e.al.map(a=>({a,aus:e.aus.includes(a)})),...e.recs.map(a=>({a,rec:1}))];
    return `<button class="w-cl" data-act="irAsist" data-f="${hoyISO}" data-c="${t.club}"><span class="w-cl-h"><b class="num">${t.hora}</b><span class="tag ${t.club}">${clubN(t.club)}</span>${t.nivel?`<span class="w-cl-n">${esc(t.nivel)}</span>`:""}${st}</span>
      <span class="w-cl-al">${nombres.map(x=>`<span class="${x.aus?"aus":x.rec?"rec":""}">${esc(nombreCorto(x.a.nombre))}${x.aus?" · no viene":x.rec?" · recupera":""}</span>`).join("")}${e.libres?`<span class="lib">${e.libres} libre${e.libres===1?"":"s"}</span>`:""}</span></button>`; }).join("");
  return `
  <header class="w-head"><span class="w-av">${esc(ini)}</span><span class="w-hola"><b>¡Hola, ${esc(nom)}!</b><small>${DIAS_LARGO[now.getDay()]} ${now.getDate()} de ${mesSolo(m).toLowerCase()}</small></span>
    <button class="w-bell" data-act="avisosVer" aria-label="Avisos de alumnos">${wico("bell")}${nAv?`<i class="w-dot"></i>`:""}</button>
    <button class="w-bell" data-act="masAcc" aria-label="Más opciones">${wico("gear")}</button></header>
  <section class="w-res">
    <div class="w-res-top">
      <button class="w-k" data-act="verPagaron"><small>Cobré</small><b class="num">${P.pag.length}<span>/${P.cobran.length}</span></b><em class="num">${money(P.cob)}</em></button>
      <button class="w-k no" data-act="verDeben"><small>Falta cobrar</small><b class="num">${P.deben.length}</b><em class="num">${money(P.ing-P.cob)}</em></button>
      <button class="w-k" data-act="tab" data-t="alumnos"><small>Alumnos</small><b class="num">${nAl}</b><em class="${dif>0?"up":dif<0?"down":""}">${dif>0?`▲ ${dif} vs ${mesSolo(mesAnt(m)).slice(0,3)}`:dif<0?`▼ ${-dif} vs ${mesSolo(mesAnt(m)).slice(0,3)}`:`igual que ${mesSolo(mesAnt(m)).slice(0,3)}`}</em></button>
    </div>
    <div class="w-bar"><i style="width:${pct}%"></i></div>
    <div class="w-res-ant"><span>${mesSolo(m).replace(/^./,c=>c.toUpperCase())}: <b>${pct}%</b> cobrado</span><span>${mesSolo(mesAnt(m)).replace(/^./,c=>c.toUpperCase())}: ${nAlA} alumnos · cobraste <b class="num">${money(A.cob)}</b></span></div>
  </section>
  <section class="w-card"><div class="w-card-h"><b>Clases de hoy</b><button data-act="tab" data-t="semana">Agenda ›</button></div>
    <div class="w-seg">${[["","Todas",nT("")],["JUMP","Jump",nT("JUMP")],["ESPACIO","Espacio",nT("ESPACIO")]].map(([v,l,n])=>`<button data-act="hoyClub" data-v="${v}" aria-pressed="${hc===v}">${l}${n?` · ${n}`:""}</button>`).join("")}</div>
    ${filas||`<p class="w-empty">Hoy no hay clases${hc?` en ${clubN(hc)}`:""}.</p>`}
  </section>
  ${[["JUMP","Jump"],["ESPACIO","Espacio La 10"]].map(([c,l])=>{ const g2=libresPorCat(c); const n=g2.reduce((t,g)=>t+g.n,0);
    return `<section class="w-card"><div class="w-card-h"><b>Lugares libres · ${l}${n?` <span class="w-lib-n">${n}</span>`:""}</b>${n?`<button data-act="libresClub" data-c="${c}">Mandar ›</button>`:""}</div>
    ${g2.length?g2.map(g=>`<div class="w-lib"><b>${esc(capCat(g.nombre))}</b><div>${g.ts.map(t=>`<span>${DIAS[t.dia]} ${t.hora} · <i>${CUPO-t.al.length} lugar${CUPO-t.al.length===1?"":"es"}</i></span>`).join("")}</div></div>`).join(""):`<p class="w-empty">${l}: todos los turnos completos.</p>`}</section>`; }).join("")}
  ${pendDuenoHTML()}
  ${tarjetaNotif("dueño")}`;
}
function vDinero(){
  const m=S.mes; escucharAsMes(m); const al=S.alumnos.filter(a=>a.activo!==false&&!(a.inicio&&a.inicio.slice(0,7)>m));
  const cobran=al.filter(a=>montoMes(a,m)>0); const pag=cobran.filter(a=>pago(a)); const deben=cobran.filter(a=>!pago(a));
  const ing=cobran.reduce((t,a)=>t+montoMes(a,m),0), cob=pag.reduce((t,a)=>t+cobradoDe(a,m),0);
  const eq=S.equipo[0]; const nP=(eq&&S.nombres[eq.id]||"Esteban").split(" ")[0]; const hE=eq?horasMes(eq.dias,m):0; const gE=eq?ganadoEn(m):0;
  const pagE=eq?S.hMovs.filter(x=>(x.fecha||"").startsWith(m)).reduce((t,x)=>t+(Number(x.monto)||0),0):0;
  const cs=CANCHAS.map(([c])=>{ const C=canchaDe(c); const pg=C.pagos[m]; return {c,C,tot:canchaTotal(c,m),pg:!!(pg&&pg.pagado),sinPrecio:!C.luz&&!C.sin}; });
  const otros=(S.gastosG||[]).filter(x=>(x.fecha||"").startsWith(m)).sort((a,b)=>b.fecha.localeCompare(a.fecha)); const tOtros=otros.reduce((t,x)=>t+(Number(x.monto)||0),0);
  const gastos=gE+cs.reduce((t,x)=>t+x.tot,0)+tOtros; const pagado=pagE+cs.filter(x=>x.pg).reduce((t,x)=>t+x.tot,0)+tOtros;
  const mny=v=>(v<0?"− ":"")+money(Math.abs(v)); const pct=cobran.length?Math.round(pag.length/cobran.length*100):0;
  const fila=(izq,der,act)=>`<${act?`button class="pl-row" ${act}`:'div class="pl-row"'}><span>${izq}</span><b class="num">${der}</b></${act?"button":"div"}>`;
  return `
  <div class="pl-mes"><button class="icon-btn" data-act="mes" data-d="-1" aria-label="Mes anterior">‹</button><span>${(t=>t.charAt(0).toUpperCase()+t.slice(1))(mesLbl(m))}</span><button class="icon-btn" data-act="mes" data-d="1" aria-label="Mes siguiente">›</button></div>
  <section class="pl-big"><span class="pl-k">Te queda</span><b class="num">${mny(cob-pagado)}</b><span class="pl-s">Lo que entró menos lo que ya pagaste. Si cobrás todo y pagás todo: <b class="num">${mny(ing-gastos)}</b></span></section>

  <section class="sec"><div class="sec-head"><h3>Entra</h3><span class="small num"><b>${money(cob)}</b> de ${money(ing)}</span></div>
    <div class="list pl-cob"><div class="pl-cob-h"><span><b class="num">${pag.length}</b> de ${cobran.length} pagaron</span><span class="small muted num">${pct}%</span></div>
      <div class="pl-bar"><i style="width:${pct}%"></i></div>
      <div class="pl-btns"><button class="pl-b no" data-act="verDeben" ${deben.length?"":"disabled"}>${deben.length?`Deben ${deben.length} · ${money(ing-cob)}`:"Nadie debe ✓"}</button><button class="pl-b" data-act="verPagaron">Pagaron ${pag.length}</button></div></div></section>

  <section class="sec"><div class="sec-head"><h3>Sale</h3><span class="small num"><b>${money(pagado)}</b> pagado de ${money(gastos)}</span></div><div class="list">
    ${fila(`${esc(nP)} <small class="muted">${fmtH(hE)} h · le pagaste ${money(pagE)}</small>`,`${money(gE)} ›`,'data-act="tab" data-t="admin"')}
    ${cs.map(x=>fila(`Cancha ${esc(x.C.lugar)} ${x.sinPrecio?'<small class="no">sin precio</small>':x.pg?'<small class="ok">✓ pagada</small>':'<small class="muted">sin pagar</small>'}`,`${money(x.tot)} ›`,`data-act="verCancha" data-club="${x.c}"`)).join("")}
    ${otros.map(x=>`<div class="pl-row"><span>${esc(x.nota||"Gasto")} <small class="muted">${fmtCorto(x.fecha)}</small></span><span style="display:flex;gap:10px;align-items:center"><b class="num">${money(x.monto)}</b><button class="mini" style="padding:3px 9px" data-act="gastoDel" data-id="${x.id}" aria-label="Borrar gasto">×</button></span></div>`).join("")}
    <button class="pl-row add" data-act="gastoNuevo"><span>+ Anotar otro gasto</span><b></b></button>
  </div></section>
  <section class="sec" style="display:flex;justify-content:center"><button class="linkish" data-act="aumento">Aumentos de cuota ›</button></section>`;
}
function openGasto(){ openSheet(`<div style="display:grid;gap:14px"><div style="display:grid;gap:4px"><span class="flabel">Plata</span><h2 class="disp">Otro gasto</h2></div>
  <div class="two"><div class="field"><label for="gMonto">Monto</label><input id="gMonto" type="number" inputmode="numeric" min="0" step="500"></div><div class="field"><label for="gFecha">Fecha</label><input id="gFecha" type="date" value="${hoyISO}"></div></div>
  <div class="field"><label for="gNota">En qué</label><input id="gNota" placeholder="Ej: pelotas, paletas, publicidad"></div>
  <div class="btns"><span></span><span style="display:flex;gap:8px"><button class="btn sec2" data-act="close">Cancelar</button><button class="btn pri" data-act="gastoOk">Guardar</button></span></div></div>`); setTimeout(()=>{ const e=$("#gMonto"); e&&e.focus(); },50); }
async function guardarGastos(movs,msg){ S.gastosG=movs; render(); return safe(()=>S.db.doc("gestion/gastos").set({movs}),msg); }
/* ---------- Administración: lo que carga Esteban y las canchas (precios y horas) ---------- */
function vAdmin(){ S.gMes=S.mes; escucharAsMes(S.mes);
  return `<div class="pl-mes"><button class="icon-btn" data-act="mes" data-d="-1" aria-label="Mes anterior">‹</button><span>${(t=>t.charAt(0).toUpperCase()+t.slice(1))(mesLbl(S.mes))}</span><button class="icon-btn" data-act="mes" data-d="1" aria-label="Mes siguiente">›</button></div>
  ${vEsteban()}${avisoOwner()}
  <section class="sec"><div class="sec-head"><h3>Canchas</h3></div><p class="small muted" style="margin:0">Las horas se suman solas cuando se toma asistencia (con luz desde la hora que pongas). Si un día fue distinto, lo corregís con − y +.</p></section>
  ${CANCHAS.map(([c])=>canchaHTML(c,S.mes)).join("")}`; }
function openCancha(club){ const r=()=>{ openSheet(`<div style="display:grid;gap:4px"><span class="flabel">${mesLbl(S.mes)}</span><h2 class="disp">Cancha ${esc(canchaDe(club).lugar)}</h2></div>${canchaHTML(club,S.mes)}<div class="btns"><span></span><button class="btn sec2" data-act="close">Listo</button></div>`,r); }; gcAb.add("d-"+club); r(); }
function emptyAlumnos(){ return `<div class="empty">Todavía no hay alumnos. Tocá <b>Alumno +</b>: nombre, club, horario y precio por clase.</div>`; }

function alRow(a){
  const p=pago(a); const c=montoMes(a); const aj=ajusteDe(a)!==null; const ex=extraDias(a).length;
  return `<div class="row ${a.activo===false?"is-pausa":p?"is-ok":c>0?"is-debe":""}" data-k="${a.id}"><button class="main" data-act="editA" data-id="${a.id}">
    <span class="name">${esc(a.nombre)}</span>
    <span class="meta">${esNuevo(a)?`<span class="tag" style="background:#13834f;color:#fff">Nuevo · arrancó ${fechaDM(arranqueDe(a))}</span>`:""}${tagsClub(a)}${recN(a)>0?`<span class="tag rec">Recupera ${recN(a)}</span>`:""}<span>${esc(horarioTxt(a))}</span>${ex&&!aj&&c?"<span>Con clase extra</span>":""}${aj?'<span style="color:var(--sun)">Monto ajustado</span>':""}${a.activo===false?"<span>· Pausado</span>":""}${S.fPago==="app"?`<span class="tag no">${(S.usuarios||[]).some(u=>u.alumnoId===a.id)?"No entró":"Sin usuario"}</span>`:""}${S.fPago==="notif"?'<span class="tag no">🔕 Sin notificaciones</span>':""}</span>
  </button>
  <div class="row-act">${a.activo===false?"":`<button class="msg-btn" data-act="msg" data-id="${a.id}" aria-label="Mensajes para ${esc(a.nombre)}">${WA_ICON}</button><button class="amt num ${aj?"aj":""}" data-act="ajuste" data-id="${a.id}" aria-label="Cambiar monto de ${esc(a.nombre)}">${c?money(c):"Sin precio"}</button>${compDe(a)?`<button class="msg-btn" data-act="verComp" data-id="${a.id}" aria-label="Ver comprobante de ${esc(a.nombre)}" title="Comprobante" style="font-size:15px">🧾</button>`:""}<button class="pay ${p?"ok":"no"}" data-act="pago" data-id="${a.id}">${p?"Pagó":S.mes>="2026-11"&&(S.mes<mesKey(now)||(S.mes===mesKey(now)&&now.getDate()>13))?"Vencido":"Debe"}</button>`}</div></div>`;
}

function vAlumnos(){
  let list=byClub(S.alumnos);
  if(S.q){ const q=S.q.toLowerCase(); list=list.filter(a=>(a.nombre||"").toLowerCase().includes(q)||(a.tel||"").includes(q)); }
  list.sort((a,b)=>(a.activo===false)-(b.activo===false)||(a.nombre||"").localeCompare(b.nombre||""));
  const act=list.filter(a=>a.activo!==false).length;
  const cobra=a=>a.activo!==false&&montoMes(a)>0&&!(a.inicio&&a.inicio.slice(0,7)>S.mes);
  const deben=list.filter(a=>cobra(a)&&!pago(a)), pagaron=list.filter(a=>a.activo!==false&&pago(a));
  const fp=S.fPago||""; if(fp==="debe") list=deben; else if(fp==="pago") list=pagaron;
  const ING=S.ingresos||{}, conUsr=new Set((S.usuarios||[]).filter(u=>u.rol==="alumno"&&u.alumnoId).map(u=>u.alumnoId));
  const actv=list.filter(a=>a.activo!==false), sinEntrar=S.esOwner&&S.modo!=="profe"?S.alumnos.filter(a=>a.activo!==false&&enClub(a,S.club)&&!ING[a.id]):[], sinNotif=S.alumnos.filter(a=>a.activo!==false&&enClub(a,S.club)&&ING[a.id]&&!ING[a.id].notif);
  if(fp==="app") list=sinEntrar.filter(a=>!S.q||(a.nombre||"").toLowerCase().includes(S.q.toLowerCase())); else if(fp==="notif") list=sinNotif;
  const nAlu=S.alumnos.filter(a=>a.activo!==false&&enClub(a,S.club)).length, nEnt=nAlu-sinEntrar.length;
  const sinAcc=S.alumnos.filter(a=>a.activo!==false&&enClub(a,S.club)&&!a.usuario).length;
  const appRes=S.esOwner&&S.modo!=="profe"?`<div class="app-res">📱 App: <b class="num">${nEnt}</b> de ${nAlu} entraron${sinAcc?` · <button class="linkish" data-act="accMasivo">Mandar accesos (${sinAcc} sin usuario)</button>`:""}${sinEntrar.length?` · <button class="linkish" data-act="fPago" data-v="${fp==="app"?"":"app"}">${fp==="app"?"Ver todos":`Ver quién falta (${sinEntrar.length})`}</button>`:" 🎉"}${sinNotif.length?` · <button class="linkish" data-act="fPago" data-v="${fp==="notif"?"":"notif"}">${fp==="notif"?"Ver todos":`${sinNotif.length} sin notificaciones`}</button>`:""}</div>`:"";
  const venc=S.mes>="2026-11"&&(S.mes<mesKey(now)||(S.mes===mesKey(now)&&now.getDate()>14));
  const resumen=fp==="debe"?(deben.length?`<div class="fp-res debe"><b>${deben.length}</b> ${deben.length===1?"alumno debe":"alumnos deben"} · faltan cobrar <b class="num">${money(deben.reduce((t,a)=>t+montoMes(a),0))}</b>${venc?" · <b>vencido</b>":""}<span class="small">Tocá el ícono de WhatsApp de cada uno para mandarle el recordatorio.</span></div>`:`<div class="fp-res ok">🎉 Todos pagaron ${mesSolo(S.mes)}.</div>`)
    :fp==="pago"?`<div class="fp-res ok"><b>${pagaron.length}</b> ${pagaron.length===1?"pagó":"pagaron"} · cobrado <b class="num">${money(pagaron.reduce((t,a)=>t+cobradoDe(a),0))}</b></div>`:"";
  return `
  <section class="sec" style="margin-top:4px">
    <input class="search" id="q" type="search" placeholder="Buscar por nombre o teléfono" value="${esc(S.q)}" autocomplete="off">
    <div class="sec-head"><h3>${act} activos${list.length>act?` · ${list.length-act} pausados`:""}</h3>
      <span style="display:flex;gap:12px;align-items:center"><button class="linkish" data-act="mes" data-d="-1" aria-label="Mes anterior">‹</button><span class="small" style="text-transform:capitalize">${mesLbl(S.mes)}</span><button class="linkish" data-act="mes" data-d="1" aria-label="Mes siguiente">›</button></span></div>
    <div class="seg fp" role="group" aria-label="Filtrar por pago"><button type="button" class="seg-b" data-act="fPago" data-v="" aria-pressed="${!fp}">Todos</button><button type="button" class="seg-b fp-debe" data-act="fPago" data-v="debe" aria-pressed="${fp==="debe"}">No pagaron · ${deben.length}</button><button type="button" class="seg-b fp-pago" data-act="fPago" data-v="pago" aria-pressed="${fp==="pago"}">Pagaron · ${pagaron.length}</button></div>
    ${appRes}
    ${fp==="app"?`<div class="fp-res debe">Estos alumnos todavía no entraron a la app. Mandales el link y su usuario desde el botón de WhatsApp.${sinEntrar.some(a=>!conUsr.has(a.id))?" Los que dicen <b>Sin usuario</b> todavía no tienen acceso: crealo desde su ficha.":""}</div>`:fp==="notif"?`<div class="fp-res debe">Entraron a la app pero no activaron las notificaciones: no les van a llegar los recordatorios. Pediles que toquen la campanita en la app.</div>`:""}
    ${resumen}
    ${S.esOwner&&S.modo!=="profe"&&!fp?`<button type="button" class="mini aum-btn" data-act="aumento">📈 Cargar aumento de cuota</button>`:""}
    ${list.length?`<div class="list">${list.map(alRow).join("")}</div>`:fp?"":(S.alumnos.length?`<div class="empty">Nadie coincide con “${esc(S.q)}”.</div>`:emptyAlumnos())}
    ${S.alumnos.length&&S.downloads?`<button class="linkish" data-act="csv" style="justify-self:start">Descargar lista (CSV)</button>`:""}
  </section>`;
}

// Alumno nuevo: si arranca del 1 al 14, hasta fin de ese mes; si arranca del 15 en adelante, hasta fin del mes siguiente.
const arranqueDe=a=>a.antiguo?"":(a.inicio||(a.codigo?"":a.alta)||"");
// Cuándo empezó, en texto: "29/10/2026 (hace 3 meses)", "Hace años" o "Sin dato".
function desdeTxt(a,corto){ if(a.antiguo) return "Hace años"; const i=arranqueDe(a); if(!i) return "Sin dato"; const [y,m,d]=i.split("-").map(Number);
  const n=(now.getFullYear()-y)*12+now.getMonth()+1-m; const hace=n<=0?"este mes":n===1?"hace 1 mes":n<24?`hace ${n} meses`:`hace ${Math.floor(n/12)} años`;
  return corto?`${pad(d)}/${pad(m)}/${String(y).slice(2)}`:`${pad(d)}/${pad(m)}/${y} (${hace})`; }
// Historial de aumentos en texto: "mar 2026: $8.000 → $9.000".
function aumHistTxt(a){ return aumentosDe(a).map(x=>`${mesCorto(x.desde)}${x.antes?`: ${money(x.antes)} → ${money(x.precio)}`:x.precio?`: ${money(x.precio)}`:""}${!x.aplicado&&x.desde>mesKey(now)?" (programado)":""}`); }
function nuevoHasta(a){ const i=arranqueDe(a); if(!i) return ""; const [y,m,d]=i.split("-").map(Number); return toISO(new Date(y,d<=14?m:m+1,0)); }
function esNuevo(a){ const h=nuevoHasta(a); return !!h&&hoyISO<=h; }
// Primer día que le toca clase (desde que arranca), para preguntarle qué le pareció.
function primeraClase(a){ const i=arranqueDe(a); if(!i) return ""; const d=isoDate(i);
  for(let k=0;k<35;k++){ const f=toISO(d); if((a.horarios||[]).some(h=>Number(h.dia)===d.getDay()&&!(h.desde&&h.desde>f))) return f; d.setDate(d.getDate()+1); } return ""; }
function slotHTML(t,fecha){
  const aj=fecha?ajusteTurno(t,fecha):{aus:new Set(),rec:[]}; const libres=CUPO-t.al.length+aj.aus.size-aj.rec.length;
  return `<div class="slot"><div class="side"><div class="h num">${t.hora||"—"}</div>${S.club?"":`<span class="tag ${t.club}" style="justify-self:start">${t.club}</span>`}${t.al.length?`<button class="linkish" data-act="turnoCat" data-club="${t.club}" data-dia="${t.dia}" data-hora="${t.hora}" style="justify-self:start;font-size:12px;text-align:left">${t.nivel?esc(t.nivel):"+ Categoría"} ✎</button>`:(aj.rec.length?"":`<span class="small muted">Vacío</span>`)}<span class="small ${libres>0?"free":"muted"}">${libres>0?libres+" libre"+(libres>1?"s":""):"Completo"}</span></div>
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
    <div class="days" id="daysStrip">${fechas.map((f,i)=>{const k=toISO(f);const n=turnos(S.club).filter(t=>t.dia===f.getDay()).length;const mes=(i===0||f.getDate()===1)?`<span class="mes">${f.toLocaleDateString("es-AR",{month:"short"}).replace(".","")}</span>`:"";return `<button class="day ${k===hoyISO?"hoy":""}" data-act="fecha" data-f="${k}" aria-pressed="${k===iso}" aria-label="${DIAS_LARGO[f.getDay()]} ${f.getDate()}">${mes}<small>${DIAS[f.getDay()]}</small><b class="num">${f.getDate()}</b><span class="cnt num">${n?n+" t":"–"}</span></button>`}).join("")}</div>
    <div class="sec-head" style="margin-top:6px"><h2 class="disp">${DIAS_LARGO[S.dia]} ${sel.getDate()}</h2><span class="small muted num">${extra}<span style="text-transform:capitalize">${mesTxt}</span> · ${S.modo==="profe"?(()=>{ const nh=slots.filter(x=>{const j=ajusteTurno(x,iso0); return x.al.length-j.aus.size+j.rec.length>0;}).length; return `${nh} hora${nh===1?"":"s"} de clase · ${al} alumnos · ${lib} libres`; })():`${slots.length} turnos · ${al} alumnos · ${lib} libres`}</span></div>
    ${slots.length&&iso>=hoyISO?`<span style="display:flex;gap:8px;flex-wrap:wrap"><button class="mini lluvia-btn" data-act="suspender" data-f="${iso}">⛔ Suspender clases</button><button class="mini lluvia-btn" data-act="lluvia" data-f="${iso}">🌧 Por lluvia</button></span>`:""}
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
  const libres=turnosGrilla(S.club).filter(t=>t.al.length<CUPO);
  const grupos={}; libres.forEach(t=>{ const k=`${t.club} · ${t.nivel||"sin categoría"}`; (grupos[k]=grupos[k]||[]).push(t); });
  return `
  <section class="sec" style="margin-top:4px">
    <div class="sec-head"><h2 class="disp">Recuperar</h2><button class="cta" data-act="recAdd" style="padding:6px 6px 6px 14px;font-size:13px">Anotar <i>+</i></button></div>
    <p class="small muted" style="margin:0">${recs.length?`${recs.length} alumno${recs.length>1?"s":""} · ${tot} clase${tot>1?"s":""} pendiente${tot>1?"s":""}. El mensaje ya le ofrece los lugares libres de su categoría.`:"Acá aparece quién tiene que recuperar."} Cada clase se recupera en las 2 semanas siguientes a la falta (hasta el viernes). Si no, se pierde sola.</p>
    ${recs.length?`<div class="list">${recs.map(recRow).join("")}</div>`:`<div class="empty">Nadie tiene clases pendientes. Se suman cuando suspendés un turno por lluvia en <b>Agenda</b>, o tocando <b>Anotar +</b> cuando alguien falta.</div>`}
  </section>
  <section class="sec">
    <div class="sec-head"><h3>Lugares libres por categoría</h3><span class="small muted num">${libres.reduce((s,t)=>s+CUPO-t.al.length,0)} lugares</span></div>
    ${Object.keys(grupos).length?`<div class="list">${Object.keys(grupos).sort().map(k=>`<div class="row" style="grid-template-columns:1fr"><div class="main" style="gap:6px"><span class="name" style="text-transform:capitalize">${esc(k)}</span><div class="who" style="display:flex;flex-wrap:wrap;gap:6px">${grupos[k].sort((x,y)=>ordenSemana(x)-ordenSemana(y)).map(t=>`<span class="pill">${DIAS[t.dia]} ${t.hora} · <b class="free">${CUPO-t.al.length}</b></span>`).join("")}</div></div></div>`).join("")}</div>`:`<div class="empty">Todos los turnos están completos.</div>`}
  </section>`;
}
/* ---------- Lugares libres para ofrecer a gente nueva ---------- */
const capCat=c=>c?c.charAt(0).toUpperCase()+c.slice(1):"Sin categoría";
function libresPorCat(club){ const g={};
  turnosGrilla(club).filter(t=>t.al.length<CUPO).forEach(t=>{ const k=t.nivel?catNorm(t.nivel):""; (g[k]=g[k]||{nombre:t.nivel?String(t.nivel).trim():"",ts:[]}).ts.push(t); });
  Object.values(g).forEach(x=>x.ts.sort((a,b)=>(a.dia||7)-(b.dia||7)||a.hora.localeCompare(b.hora)||a.club.localeCompare(b.club)));
  return Object.keys(g).sort((a,b)=>(!a)-(!b)||a.localeCompare(b)).map(k=>({k,...g[k],n:g[k].ts.reduce((s,t)=>s+CUPO-t.al.length,0)})); }
function libresHoyHTML(){ const gs=libresPorCat(S.club); const n=gs.reduce((s,g)=>s+g.n,0); if(!n) return "";
  return `<button class="row lib-card" data-act="libres" style="width:100%;text-align:left;margin-top:14px"><span class="main"><span class="name">Lugares libres para ofrecer</span><span class="meta">${gs.slice(0,4).map(g=>`<span class="tag">${esc(capCat(g.nombre))} · ${g.n}</span>`).join("")}${gs.length>4?`<span>+${gs.length-4} más</span>`:""}</span></span><span class="lib-n"><b class="num free">${n}</b><small>ver ›</small></span></button>`; }
const LIB={club:""};
function msgLibres(g){ const cl=c=>c==="ESPACIO"?"Espacio La 10":"Jump";
  return `Hola! Te paso los horarios con lugar para ${g.nombre?`nivel ${g.nombre}`:"clases"}:\n${g.ts.map(t=>`• ${DIAS_LARGO[t.dia]} ${t.hora} en ${cl(t.club)}${CUPO-t.al.length===1?" (queda 1 lugar)":""}`).join("\n")}\n\nSon grupos de hasta ${CUPO}. ¿Cuál te queda mejor?`; }
function openLibres(){ const gs=libresPorCat(LIB.club); const n=gs.reduce((s,g)=>s+g.n,0);
  openSheet(`<div style="display:grid;gap:12px">
    <div style="display:grid;gap:4px"><span class="flabel">Para gente que quiere empezar</span><h2 class="disp">Lugares libres</h2><span class="small muted">${(()=>{ const nt=gs.reduce((s,g)=>s+g.ts.length,0); return `${n} lugar${n===1?"":"es"} en ${nt} turno${nt===1?"":"s"}.`; })()} Tocá <b>Copiar</b> o <b>WhatsApp</b> en una categoría y se lo mandás tal cual.</span></div>
    <div class="seg" style="grid-template-columns:repeat(3,1fr);margin:0">${[["","Todos"],["JUMP","Jump"],["ESPACIO","Espacio"]].map(([v,l])=>`<button type="button" class="seg-b" data-act="libClub" data-v="${v}" aria-pressed="${LIB.club===v}">${l}</button>`).join("")}</div>
    ${gs.length?gs.map(g=>{ const txt=msgLibres(g); return `<div class="list lib-cat"><div class="lib-h"><b>${esc(capCat(g.nombre))}</b><span class="small muted num">${g.n} lugar${g.n===1?"":"es"}</span></div>
      <div class="lib-ts">${g.ts.map(t=>`<span class="pill"><b>${DIAS[t.dia]} ${t.hora}</b>${LIB.club?"":` <span class="tag ${t.club}">${t.club==="ESPACIO"?"ESP":"JUMP"}</span>`} <b class="free">${CUPO-t.al.length}</b></span>`).join("")}</div>
      <div class="lib-acc"><button class="mini" data-act="copy" data-text="${esc(txt)}">Copiar</button><a class="mini go" href="https://wa.me/?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener">WhatsApp →</a></div></div>`; }).join(""):`<div class="empty">Todos los turnos están completos.</div>`}
    <div class="btns"><span></span><button class="btn sec2" data-act="close">Listo</button></div></div>`); }
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
  $("#ajDif").innerHTML = d===0?"Igual al calculado":`${d>0?"+":"−"}${money(Math.abs(d))} ${precioEn(a)&&Number.isInteger(Math.abs(d)/precioEn(a))?`(${Math.abs(d)/precioEn(a)} clase${Math.abs(d)/precioEn(a)>1?"s":""} ${d>0?"de más":"de menos"})`:""} contra el calculado`; }
function openAjuste(a){
  const n=clasesMes(a), base=cuotaMes(a), cur=montoMes(a), p=a.pagos&&a.pagos[S.mes]||{}; const ex=extraDias(a).length;
  openSheet(`<form id="fAj" data-id="${a.id}" style="display:grid;gap:14px">
    <div style="display:grid;gap:4px"><span class="flabel">Cobro de ${mesLbl(S.mes)}</span><h2 class="disp">${esc(a.nombre)}</h2></div>
    <dl class="kv" style="margin:0"><dt>Calculado</dt><dd class="num">${n} clases x ${money(precioEn(a))} = ${money(base)}</dd>${ex?`<dt></dt><dd class="small muted" style="font-weight:500">incluye ${ex===1?"una clase extra":ex+" clases extra"}</dd>`:""}</dl>
    <div class="field"><label for="ajMonto">Lo que te paga este mes</label><input id="ajMonto" type="number" inputmode="numeric" min="0" step="250" value="${cur}"><span class="small muted" id="ajDif"></span></div>
    ${precioEn(a)?`<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="mini" data-act="ajStep" data-d="-${precioEn(a)}">− 1 clase</button><button type="button" class="mini" data-act="ajStep" data-d="${precioEn(a)}">+ 1 clase</button><button type="button" class="mini" data-act="ajReset">Usar el calculado</button></div>`:""}
    <div class="field"><label for="ajNota">Motivo (opcional)</label><input id="ajNota" value="${esc(p.nota||"")}" placeholder="Ej: avisó que no viene el 15"></div>
    <p class="small muted" style="margin:0">Este monto es el que cuenta en el total del mes y el que va en el mensaje de cobro. Solo cambia ${mesSolo(S.mes)}.</p>
    <div class="btns"><span></span><span style="display:flex;gap:8px"><button type="button" class="btn sec2" data-act="close">Cancelar</button><button class="btn pri">Guardar</button></span></div>
  </form>`);
  ajPreview(); $("#ajMonto").addEventListener("input",ajPreview);
}
/* ---------- Gestión: cancha de Gonza + profe ---------- */
// Cada cancha (Jump y Espacio) con sus precios. Las horas se cuentan solas: cada turno con asistencia tomada = 1 hora usada
// (con luz si empieza desde "luzDesde"). Si se suspendió por lluvia no cuenta. Se puede corregir a mano un día.
const gcAb=new Set(); document.addEventListener("toggle",e=>{ const k=e.target&&e.target.dataset&&e.target.dataset.open; if(k){ e.target.open?gcAb.add(k):gcAb.delete(k); } },true);
const CANCHAS=[["JUMP","Jump","Gonza"],["ESPACIO","Espacio La 10",""]];
function canchaDe(club){ const g=S.cancha||{}; const c=(g.clubes||{})[club]||(club==="JUMP"&&g.precioLuz!==undefined?{precioLuz:g.precioLuz,precioSinLuz:g.precioSinLuz,luzDesde:g.luzDesde,nombre:g.nombre,ajustes:g.dias,pagos:g.pagos}:{});
  const def=CANCHAS.find(x=>x[0]===club); return {club,lugar:def[1],nombre:c.nombre!==undefined?c.nombre:def[2],luz:Number(c.precioLuz)||0,sin:Number(c.precioSinLuz)||0,desde:c.luzDesde||"18:30",aj:c.ajustes||{},pagos:c.pagos||{}}; }
function usoAuto(club,f,desde){ const mk=((S.asMes||{})[`${club}|${f}`])||null; if(!mk) return {luz:0,sin:0,horas:[]};
  const hs=new Set(); Object.keys(mk).forEach(k=>{ if(mk[k]&&mk[k]!=="lluvia") hs.add(k.split("|")[1]); });
  const horas=[...hs].sort(); return {luz:horas.filter(h=>h>=desde).length,sin:horas.filter(h=>h<desde).length,horas}; }
function usoDia(C,f){ const a=C.aj[f]; if(a) return {luz:Number(a.luz)||0,sin:Number(a.sin)||0,manual:true}; const u=usoAuto(C.club,f,C.desde); return {...u,manual:false}; }
let asMesUnsub=null, asMesKey="";
function escucharAsMes(m){ if(asMesKey===m||!S.db) return; asMesKey=m; if(asMesUnsub) asMesUnsub(); const [y,mm]=m.split("-").map(Number);
  asMesUnsub=S.db.collection("asistencia").where("fecha",">=",`${mesAnt(m)}-01`).where("fecha","<=",`${m}-${pad(new Date(y,mm,0).getDate())}`).onSnapshot(snap=>{ S.asMes={}; snap.docs.forEach(d=>{ const v=d.data(); S.asMes[`${v.club}|${v.fecha}`]=v.marcas||{}; }); if((S.tab==="gestion"||S.tab==="hoy"||S.tab==="dinero")&&$("#overlay").hidden) render(); },e=>console.error(e)); }
function canchaTotal(club,m){ const C=canchaDe(club); const pg=C.pagos[m]; if(pg&&pg.pagado&&pg.monto!==undefined) return Number(pg.monto)||0;
  const [y,mm]=m.split("-").map(Number); let hl=0,hs=0; for(let d=1;d<=new Date(y,mm,0).getDate();d++){ const f=`${m}-${pad(d)}`; if(f>hoyISO) break; const u=usoDia(C,f); hl+=u.luz; hs+=u.sin; } return hl*C.luz+hs*C.sin; }
function canchaHTML(club,m){ const C=canchaDe(club); const [y,mm]=m.split("-").map(Number); const ult=new Date(y,mm,0).getDate(); let hl=0,hs=0; const filas=[];
  for(let d=1;d<=ult;d++){ const f=`${m}-${pad(d)}`; if(f>hoyISO) break; const u=usoDia(C,f); const dow=isoDate(f).getDay(); const hayTurnos=turnos(club).some(t=>t.dia===dow);
    if(!u.manual&&!u.luz&&!u.sin&&!hayTurnos) continue; hl+=u.luz; hs+=u.sin;
    const step=(k,v)=>`<span class="gc-st"><button type="button" data-act="gcStep" data-club="${club}" data-f="${f}" data-k="${k}" data-d="-1" aria-label="Restar">−</button><b class="num">${v}</b><button type="button" data-act="gcStep" data-club="${club}" data-f="${f}" data-k="${k}" data-d="1" aria-label="Sumar">+</button></span>`;
    const nota=u.manual?`Corregido a mano · <button class="linkish" data-act="gcAuto" data-club="${club}" data-f="${f}">Volver a automático</button>`:(u.luz+u.sin?`Automático por asistencia (${u.horas.join(", ")})`:(f===hoyISO?"Se suma cuando tomen asistencia":(Object.values((S.asMes||{})[`${club}|${f}`]||{}).includes("lluvia")?"🌧 Suspendido por lluvia: no se contó":'<span class="due">Sin asistencia: no se contó</span>')));
    filas.push(`<div class="row gc-row ${u.luz+u.sin?"is-ok":""}" data-k="gc-${club}-${f}"><span class="main"><span class="name" style="text-transform:capitalize">${diaTxt(f)}</span><span class="meta">${nota}</span></span><span class="gc-cols"><span class="gc-c"><small>💡 Luz</small>${step("luz",u.luz)}</span><span class="gc-c"><small>☀️ Sin</small>${step("sin",u.sin)}</span></span></div>`); }
  const tot=hl*C.luz+hs*C.sin; const pg=C.pagos[m]; const quien=C.nombre?` a ${esc(C.nombre)}`:"";
  return `<section class="sec gc-sec"><div class="gc-tot ${pg&&pg.pagado?"ok":""}"><div><small>Pago cancha ${esc(C.lugar)}${quien}</small><b class="num">${money(tot)}</b><span class="small">${fmtH(hl)} h con luz × ${money(C.luz)} · ${fmtH(hs)} h sin luz × ${money(C.sin)}</span></div>
      ${pg&&pg.pagado?`<button class="btn sec2" data-act="gcPago" data-club="${club}">✓ Pagado ${pg.fecha?pg.fecha.split("-").reverse().slice(0,2).join("/"):""}</button>`:`<button class="btn pri" data-act="gcPago" data-club="${club}" ${tot?"":"disabled"}>Marcar pagado</button>`}</div>
    ${C.luz||C.sin?"":`<div class="fp-res debe">Cargá cuánto cobra la hora con luz y sin luz en ${esc(C.lugar)} (abajo, en Precios).</div>`}
    <details class="gc-dias" data-open="d-${club}" ${gcAb.has("d-"+club)?"open":""}><summary>Ver horas día por día (${filas.length})</summary><div class="list">${filas.join("")||'<div class="empty">Todavía no hay días con turnos este mes.</div>'}</div></details>
    <details class="gc-cfg" data-open="c-${club}" ${gcAb.has("c-"+club)?"open":""}><summary>Precios y horario de luz · ${esc(C.lugar)}</summary>
      <div class="two"><div class="field"><label for="gcL-${club}">Hora con luz</label><input id="gcL-${club}" type="number" inputmode="numeric" min="0" step="500" value="${C.luz||""}" placeholder="Ej: 15000"></div><div class="field"><label for="gcS-${club}">Hora sin luz</label><input id="gcS-${club}" type="number" inputmode="numeric" min="0" step="500" value="${C.sin||""}" placeholder="Ej: 12000"></div></div>
      <div class="two"><div class="field"><label for="gcD-${club}">Con luz desde</label><input id="gcD-${club}" type="time" value="${C.desde}" step="900"></div><div class="field"><label for="gcN-${club}">A quién le pagás</label><input id="gcN-${club}" value="${esc(C.nombre)}" placeholder="Nombre (opcional)"></div></div>
      <button class="mini go" data-act="gcCfg" data-club="${club}">Guardar</button></details></section>`; }
function vGestion(){
  const m=S.gMes||(S.gMes=mesKey(now)); escucharAsMes(m);
  return `<section class="sec" style="margin-top:4px"><div class="sec-head"><h3>Canchas</h3><span style="display:flex;gap:12px;align-items:center"><button class="linkish" data-act="gMes" data-d="-1" aria-label="Mes anterior">‹</button><span class="small" style="text-transform:capitalize">${mesLbl(m)}</span><button class="linkish" data-act="gMes" data-d="1" aria-label="Mes siguiente">›</button></span></div>
    <p class="small muted" style="margin:0 0 8px">Las horas se cargan solas: cada turno con asistencia tomada cuenta como una hora de cancha (si se suspendió por lluvia, no).</p></section>
  ${CANCHAS.map(([c])=>canchaHTML(c,m)).join("")}
  ${vEsteban()}`;
}
async function guardarCancha(club,patch,msg){ const g={...(S.cancha||{})}; const prev=canchaDe(club);
  const cur={precioLuz:prev.luz,precioSinLuz:prev.sin,luzDesde:prev.desde,nombre:prev.nombre,ajustes:{...prev.aj},pagos:{...prev.pagos},...((g.clubes||{})[club]||{})};
  if(patch.ajustes) cur.ajustes={...(cur.ajustes||{}),...patch.ajustes}; if(patch.pagos) cur.pagos={...(cur.pagos||{}),...patch.pagos};
  Object.keys(patch).forEach(k=>{ if(k!=="ajustes"&&k!=="pagos") cur[k]=patch[k]; });
  Object.keys(cur.ajustes||{}).forEach(k=>{ if(cur.ajustes[k]===null) delete cur.ajustes[k]; });
  g.clubes={...(g.clubes||{}),[club]:cur}; S.cancha=g; render(); if(sheetRefresh) sheetRefresh();
  return safe(()=>S.db.doc("gestion/cancha").set(g),msg); }

/* ---------- Pestaña Esteban: horas por día y si tomó asistencia ---------- */
function vEsteban(){
  const eq=S.equipo[0]; const nombre=eq&&S.nombres[eq.id]||"Esteban"; const corto=nombre.split(" ")[0];
  const dias=(eq&&eq.dias)||{}; const filas=[]; const usr=(S.usuarios||[]).find(u=>u.rol==="profe"&&(!eq||u.id===eq.id)); const desde=(usr&&usr.alta)||"";
  for(let i=0;i<21;i++){ const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i); const f=toISO(d); const dow=d.getDay(); if(desde&&f<desde&&!dias[f]) continue;
    const ts=turnos("JUMP").filter(t=>t.dia===dow).map(t=>({...t,al:t.al.filter(a=>vaEn(a,t,f))})).filter(t=>t.al.length);
    const h=dias[f]||0; if(!ts.length&&!h) continue;
    const mk=(S.asHist||{})[f]||{}; const esper=ts.reduce((s,t)=>s+t.al.length,0); const marc=ts.reduce((s,t)=>s+t.al.filter(a=>mk[`${a.id}|${t.hora}`]).length,0);
    const enHist=i<=20; const asis=!ts.length?"":!enHist?"":marc>=esper?'<span class="tag" style="background:var(--k-ok-s);color:var(--k-ok)">✓ Asistencia</span>':marc?`<span class="tag rec">Asistencia ${marc}/${esper}</span>`:(f===hoyISO?'<span class="tag">Asistencia pendiente</span>':'<span class="tag no">✗ Sin asistencia</span>');
    const hTxt=h?`<b class="num">${fmtH(h)} h</b>`:(ts.length&&f!==hoyISO?'<b class="due">Sin horas</b>':'<span class="muted">—</span>');
    filas.push(`<div class="row es-dia ${ts.length&&f!==hoyISO&&(!h||marc<esper)?"is-debe":h?"is-ok":""}"><span class="main"><span class="name" style="text-transform:capitalize">${diaTxt(f)}</span><span class="meta">${ts.length?`${ts.length} turno${ts.length===1?"":"s"} en Jump`:"Sin turnos fijos"}${asis}</span></span><span class="es-h">${hTxt}</span></div>`); }
  const faltan=filas.filter(x=>x.includes("is-debe")).length;
  return `<section class="sec" style="margin-top:4px"><div class="sec-head"><h3>Profe · ${esc(corto)}</h3>${faltan?`<span class="small due">${faltan} día${faltan===1?"":"s"} con algo pendiente</span>`:'<span class="small" style="color:var(--k-ok)">Todo al día ✓</span>'}</div>
    ${eq?`<div class="list">${filas.join("")||'<div class="empty">Todavía no hay días con clases ni horas cargadas.</div>'}</div>`:`<div class="empty">Cuando ${esc(corto)} entre con su usuario y cargue horas, las vas a ver acá día por día. Creale el acceso en Ajustes → Profes.</div>`}
    <p class="small muted" style="margin:8px 0 0">Rojo: un día con clases en Jump sin horas cargadas o sin asistencia completa.</p></section>
  ${panelEquipo()}`;
}

/* ---------- Tu ganancia (solo Gabriel, en Hoy) ---------- */
function gananciaHTML(){ const m=S.mes; escucharAsMes(m); const c=S.club; const al=S.alumnos.filter(a=>a.activo!==false);
  const ing=al.reduce((t,a)=>t+(c?montoClub(a,c,m):montoMes(a,m)),0);
  const cob=al.filter(a=>pago(a)).reduce((t,a)=>t+(c?montoClub(a,c,m)*(montoMes(a,m)?cobradoDe(a,m)/montoMes(a,m):1):cobradoDe(a,m)),0);
  const prof=(!c||c==="JUMP")&&S.equipo.length?ganadoEn(m):0; const nP=(S.equipo[0]&&S.nombres[S.equipo[0].id]||"Esteban").split(" ")[0];
  const cj=(!c||c==="JUMP")?canchaTotal("JUMP",m):0, ce=(!c||c==="ESPACIO")?canchaTotal("ESPACIO",m):0; const gastos=prof+cj+ce;
  const mny=v=>(v<0?"−":"")+money(Math.abs(v)).replace("$ ","$"); const fila=(k,v,neg)=>`<dt>${k}</dt><dd class="num">${neg&&v?"− ":""}${money(v)}</dd>`;
  return `<section class="sec"><div class="sec-head"><h3>Tu ganancia · ${mesSolo(m)}${c?` · ${c==="JUMP"?"Jump":"Espacio"}`:""}</h3></div>
    <div class="list gan" style="padding:16px;display:grid;gap:12px">
      <div class="gan-top">
        <div class="stat"><div class="big-num num" style="color:${ing-gastos<0?"var(--k-no)":"var(--k-ok)"}">${mny(ing-gastos)}</div><div class="lbl" style="color:var(--muted)">Te queda si cobrás todo</div></div>
        <div class="stat"><div class="big-num num" style="${cob-gastos<0?"color:var(--k-no)":""}">${mny(cob-gastos)}</div><div class="lbl" style="color:var(--muted)">Con lo cobrado hasta hoy</div></div>
      </div>
      <dl class="kv" style="margin:0">${fila("Cuotas del mes",ing)}${fila("Ya cobrado",cob)}${(!c||c==="JUMP")&&S.equipo.length?fila(`Pago a ${esc(nP)}`,prof,1):""}${!c||c==="JUMP"?fila("Cancha Jump",cj,1):""}${!c||c==="ESPACIO"?fila("Cancha Espacio La 10",ce,1):""}</dl>
      <p class="small muted" style="margin:0">${c==="ESPACIO"?"Las horas":`Las horas de ${esc(nP)} y las`} de cancha se suman solas a medida que avanza el mes.</p>
    </div></section>`; }

/* ---------- Panel Esteban (en Gestión) ---------- */
let aumPct=10;
function panelEquipo(){
  const tot=activos().reduce((s,a)=>s+montoMes(a),0); const totJ=S.alumnos.filter(a=>a.activo!==false).reduce((s,a)=>s+montoClub(a,"JUMP"),0);
  const vh=S.cfg.valorHora||0; const eq=S.equipo.length?S.equipo:[{id:"_",dias:{}}];
  const h=eq.reduce((s,x)=>s+horasMes(x.dias,S.mes),0), hp=eq.reduce((s,x)=>s+horasMes(x.dias,mesAnt(S.mes)),0);
  const pagoE=S.equipo.length?ganadoEn(S.mes):0, neta=tot-pagoE, pct=tot?pagoE/tot*100:0, pctJ=totJ?pagoE/totJ*100:0;
  const nuevoV=Math.round(vh*(1+aumPct/100)), nuevoP=h*nuevoV;
  const nombre=eq.map(x=>S.nombres[x.id]).filter(Boolean).join(", ")||"Esteban";
  return `<section class="sec"><div class="sec-head"><h3>Pago a ${esc(nombre.split(" ")[0])} · ${mesSolo(S.mes)}</h3></div>
    <div class="list" style="padding:16px;display:grid;gap:16px">
      <div class="hero-stats" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat"><div class="big-num num">${fmtH(h)}</div><div class="lbl" style="color:var(--muted)">Horas · antes ${fmtH(hp)}</div></div>
        <div class="stat"><div class="big-num num">${money(pagoE).replace("$ ","$")}</div><div class="lbl" style="color:var(--muted)">Le pagás</div></div>
        <div class="stat"><div class="big-num num">${money(vh).replace("$ ","$")}</div><div class="lbl" style="color:var(--muted)">Por hora</div></div>
      </div>
      ${S.equipo[0]?(()=>{ const ds=Object.keys(S.equipo[0].dias||{}).filter(k=>S.equipo[0].dias[k]).sort().reverse().slice(0,7);
        return ds.length?`<div><span class="flabel">Últimos días cargados</span><div class="hs-dias">${ds.map(k=>`<span><small>${diaTxt(k)}</small><b class="num">${fmtH(S.equipo[0].dias[k])} h</b></span>`).join("")}</div></div>`:""; })():""}
      ${S.equipo[0]?`${cuentaHTML(true)}<button class="linkish" data-act="modoProfe" style="justify-self:start">Ver y revisar las horas que cargó día por día</button>`:""}
      <div class="field"><label for="vHora">Le pagás por hora</label><div style="display:flex;gap:8px"><input id="vHora" type="number" inputmode="numeric" min="0" step="500" value="${vh||""}" placeholder="Ej: 12000"><button class="mini go" data-act="valorSave">Guardar</button></div>${S.cfg.ultimoAumento?`<span class="small muted">Último aumento: ${S.cfg.ultimoAumento.split("-").reverse().join("/")}</span>`:""}</div>
      ${vh?`<div class="msg" style="gap:8px"><div class="msg-k"><b>Calcular aumento</b></div>
        <div style="display:flex;align-items:center;gap:8px"><input id="aumPct" type="number" inputmode="numeric" value="${aumPct}" style="width:80px;padding:9px 12px;border-radius:12px;border:1px solid var(--line);background:var(--surface)"><span>% de aumento</span></div>
        <dl class="kv" style="margin:0" id="aumOut">${aumKV(vh,nuevoV,h,nuevoP,tot)}</dl>
        <button class="mini" data-act="aumSave" style="justify-self:start">Aplicar este aumento</button></div>`:`<p class="small muted" style="margin:0">Cargá cuánto le pagás por hora y te calculo cuánto le toca y el aumento.</p>`}
      ${S.equipo[0]?(()=>{ const mv=(S.finEq[S.equipo[0].id]||[]).filter(x=>x.fecha.startsWith(S.mes)); const g=mv.filter(x=>x.tipo==="gasto").reduce((t,x)=>t+x.monto,0); return `<p class="small muted" style="margin:0">Gastos que anotó en ${mesSolo(S.mes)}: <b style="color:var(--ink)">${money(g)}</b> (${mv.length} movimientos) · <button class="linkish" data-act="verGastos">Ver todo</button></p>`; })():""}
      ${S.equipo.length?"":`<p class="small muted" style="margin:0">Cuando ${esc(nombre)} cargue sus horas desde su cuenta, se suman acá solas.</p>`}
    </div></section>`;
}
function aumKV(vh,nv,h,np,tot){ return `<dt>Nuevo valor por hora</dt><dd class="num">${money(nv)} <span class="muted" style="font-weight:500">(antes ${money(vh)})</span></dd><dt>Con ${fmtH(h)} h le pagarías</dt><dd class="num">${money(np)}</dd><dt>Diferencia por mes</dt><dd class="num">+ ${money(np-h*vh)}</dd>`; }
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
// Avisos para Gabriel de lo que hace Esteban (horas cargadas, faltas, recuperaciones). Llegan al instante.
const nomProfe=()=>((S.perfil&&S.perfil.nombre)||"Esteban").split(" ")[0];
const diaTxt=f=>{ const d=isoDate(f); return f===hoyISO?"hoy":`${DIAS_LARGO[d.getDay()].toLowerCase()} ${d.getDate()}/${d.getMonth()+1}`; };
function avisarDueno(titulo,cuerpo){ if(S.esOwner||!S.db) return;
  S.db.collection("staffAvisos").add({titulo,cuerpo,de:S.uid||"",notificado:false,creado:firebase.firestore.FieldValue.serverTimestamp()})
    .then(()=>{ try{ if(window.AVISOS_URL) fetch(window.AVISOS_URL,{method:"POST",keepalive:true}).catch(()=>{}); }catch(e){} }).catch(e=>console.error(e)); }
const tHorasAviso={};
function setHoras(f,n){ if(!S.esOwner){ clearTimeout(tHorasAviso[f]); tHorasAviso[f]=setTimeout(()=>{ const h=S.horas[f]||0; avisarDueno(h?`${nomProfe()} cargó ${fmtH(h)} h`:`${nomProfe()} borró sus horas`,`${f===hoyISO?"Hoy":"El "+diaTxt(f)}. Lo ves en Admin.`); },8000); } if(n){ S.horas[f]=n; if(!S.hVal[f]) S.hVal[f]=S.cfg.valorHora||0; } else { delete S.horas[f]; delete S.hVal[f]; } render(); return guardarHorasDoc(); }
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
  ${!S.esOwner&&typeof tarjetaNotif==="function"?tarjetaNotif("profe"):""}
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
    ${S.esOwner?`<div class="field"><label for="vh2">Valor por hora</label><div style="display:flex;gap:8px"><input id="vh2" type="number" inputmode="numeric" min="0" step="500" value="${S.cfg.valorHora||""}" placeholder="Ej: 12000" style="flex:1"><button class="mini go" data-act="vhSave">Guardar</button></div><span class="small muted">Se multiplica por las horas que cargás. Cuando te pagan, tocá Marcar pagado.</span></div>`:`<div class="field"><span class="flabel">Valor por hora</span><b class="num">${money(S.cfg.valorHora||0)}</b><span class="small muted">Lo define Gabriel. Se multiplica por las horas que cargás.</span></div>`}
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
    const sinAsist=ts.filter(t=>!esHoy||t.hora<=hhmm).map(t=>({hora:t.hora,n:t.al.filter(a=>vaEn(a,t,f)&&!(avisoApp(a.id,f,t.hora,"ausencia")&&!vuelveApp(a.id,f,t.hora))&&!mk[`${a.id}|${t.hora}`]).length})).filter(x=>x.n);
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
    hoy.ts.forEach(t=>t.al.filter(a=>primeraClase(a)===hoyISO).forEach(a=>p.push(`<b style="color:var(--sun)">Primera clase</b>: ${esc(a.nombre)} viene a las <b>${t.hora}</b>${a.categoria?` (${esc(a.categoria)})`:""}`)));
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
  if(S.asUnsub) S.asUnsub(); S.asKey=key; S.asMarcas={}; S.asBase={};
  S.asUnsub=S.db.collection("asistencia").doc(key).onSnapshot(d=>{ if(asPend>0) return; S.asMarcas={...((d.exists&&d.data().marcas)||{})}; S.asBase={...S.asMarcas}; S.asQuien={...((d.exists&&d.data().quien)||{})}; if(S.tab==="asist"&&$("#overlay").hidden) render(); },()=>{});
}
let asPend=0, asQueue=Promise.resolve();
// Guarda solo las marcas que cambiaron (campo por campo), así Gabriel y Esteban no se pisan si marcan el mismo día.
function guardarAsist(){ const yo=S.esOwner&&S.modo!=="profe"?"Gabriel":(S.esOwner?"Gabriel":"Esteban"); const FV=firebase.firestore.FieldValue; S.asQuien=S.asQuien||{};
  const base=S.asBase||{}, cur=S.asMarcas, dm={}, dq={};
  Object.keys(cur).forEach(k=>{ if(cur[k]!==base[k]){ if(!S.asQuien[k]) S.asQuien[k]=yo; dm[k]=cur[k]; dq[k]=S.asQuien[k]; } });
  Object.keys(base).forEach(k=>{ if(!(k in cur)){ dm[k]=FV.delete(); dq[k]=FV.delete(); delete S.asQuien[k]; } });
  const prevBase=base; S.asBase={...cur}; const f=S.asFecha, c=S.asClub;
  if(!Object.keys(dm).length) return Promise.resolve(true);
  asPend++;
  const p=asQueue.then(()=>safe(()=>S.db.collection("asistencia").doc(`${f}_${c}`).set({fecha:f,club:c,marcas:dm,quien:dq},{merge:true}))).then(ok=>{ if(!ok&&S.asFecha===f&&S.asClub===c){ S.asBase=prevBase; S.asKey=null; } return ok; }).finally(()=>{ asPend--; if(asPend===0&&(S.asFecha!==f||S.asClub!==c)){ S.asKey=null; if(S.tab==="asist"&&$("#overlay").hidden) render(); } });
  asQueue=p.catch(()=>{}); return p; }
async function marcar(a,hora,estado){
  S.asQuien=S.asQuien||{}; delete S.asQuien[`${a.id}|${hora}`];
  const k=`${a.id}|${hora}`; const prev=S.asMarcas[k]; const nuevo= prev===estado?null:estado;
  if(nuevo==="falto") avisarDueno(`${nomProfe()}: ${a.nombre} faltó`,`${diaTxt(S.asFecha)} ${hora} · ${S.asClub==="ESPACIO"?"Espacio":"Jump"} · no avisó, pierde la clase`);
  const da=e=>e==="recupera"||e==="lluvia"?1:0; let delta=da(nuevo)-da(prev);
  const avA=avisoApp(a.id,S.asFecha,hora,"ausencia"); if(avA&&avA.conRecupero&&!vuelveApp(a.id,S.asFecha,hora)) delta=0;
  if(nuevo) S.asMarcas[k]=nuevo; else delete S.asMarcas[k];
  render();
  if(await guardarAsist() && delta) await setRec(a,delta,S.asFecha);
  if(delta>0) toast(`${a.nombre}: +1 clase a recuperar`);
}
/* ---------- Asistencia: tres partes. Por día (tomar asistencia), Lluvia (registro de suspendidas) y Faltas (quién no fue). ---------- */
const RG={mes:null,club:"",q:"",key:"",cargando:false,as:[],av:[],err:false};
function asistTabs(){ const v=S.asVista||"dia";
  return `<div class="seg" role="group" aria-label="Asistencia" style="margin:4px 0 10px">${[["dia","Por día"],["lluvia","🌧 Lluvia"],["faltas","Faltas"]].map(([k,l])=>`<button type="button" class="seg-b" data-act="asVista" data-v="${k}" aria-pressed="${v===k}">${l}</button>`).join("")}</div>`; }
function vAsist(){ const v=S.asVista||"dia"; if(v==="dia") return asistTabs()+vAsistDia(); return asistTabs()+vRegistro(v); }
function rgRango(){ const [y,m]=RG.mes.split("-").map(Number); return [`${RG.mes}-01`,`${RG.mes}-${pad(new Date(y,m,0).getDate())}`]; }
async function rgCargar(forzar){ if(!S.db) return; if(!RG.mes) RG.mes=mesKey(now); const key=RG.mes; if(!forzar&&RG.key===key) return; RG.key=key; RG.cargando=true; RG.err=false; const [d1,d2]=rgRango();
  try{ const [a,v]=await Promise.all([S.db.collection("asistencia").where("fecha",">=",d1).where("fecha","<=",d2).get(), S.db.collection("avisos").where("fecha",">=",d1).where("fecha","<=",d2).get()]);
    if(RG.key!==key) return; RG.as=a.docs.map(x=>x.data()); RG.av=v.docs.map(x=>({id:x.id,...x.data()})); }
  catch(e){ console.error(e); RG.err=true; RG.key=""; }
  RG.cargando=false; if(S.tab==="asist"&&$("#overlay").hidden) render(); }
const rgClubOk=c=>S.modo==="profe"?c==="JUMP":(!RG.club||RG.club===c);
const rgNom=id=>(S.alumnos.find(a=>a.id===id)||{}).nombre||"Alumno";
const rgClubN=c=>c==="ESPACIO"?"Espacio":"Jump";
const rgFecha=f=>{ const d=isoDate(f); return `${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`; };
const rgBusca=()=>true;
const rgDataN=ids=>esc(ids.map(id=>catNorm(rgNom(id))).join("|"));
function rgFiltrar(){ const q=catNorm(RG.q); document.querySelectorAll("[data-rgn]").forEach(r=>{ r.style.display=q&&!r.dataset.rgn.includes(q)?"none":""; }); }
// Semana (lunes) de una fecha, para ver si a alguien le llovió dos semanas seguidas.
const rgSemana=f=>{ const d=isoDate(f); d.setDate(d.getDate()-((d.getDay()+6)%7)); return toISO(d); };
function rgLluvias(){ const out=[]; RG.as.forEach(doc=>{ if(!rgClubOk(doc.club)) return; const mk=doc.marcas||{}, q=doc.quien||{}; const porHora={};
    Object.keys(mk).forEach(k=>{ if(mk[k]!=="lluvia") return; const [id,h]=k.split("|"); (porHora[h]=porHora[h]||{fecha:doc.fecha,club:doc.club,hora:h,al:[],por:new Set()}).al.push(id); if(q[k]) porHora[h].por.add(q[k]); });
    Object.values(porHora).forEach(t=>out.push(t)); });
  return out.sort((x,y)=>(y.fecha+y.hora).localeCompare(x.fecha+x.hora)); }
function rgFaltas(){ const out={}; const add=(id,fecha,hora,club,tipo,por)=>{ const k=`${id}|${fecha}|${hora}`; if(!out[k]||tipo==="falto") out[k]={id,fecha,hora,club,tipo,por}; };
  const llovio=(id,f,h,c)=>{ const d=RG.as.find(x=>x.fecha===f&&x.club===c); return !!d&&(d.marcas||{})[`${id}|${h}`]==="lluvia"; };
  RG.av.forEach(v=>{ if(v.tipo!=="ausencia"||!rgClubOk(v.club)||v.fecha>hoyISO||llovio(v.alumnoId,v.fecha,v.hora,v.club)) return; const vuelve=RG.av.some(x=>x.tipo==="recupera"&&x.alumnoId===v.alumnoId&&x.fecha===v.fecha&&x.hora===v.hora); if(vuelve) return;
    add(v.alumnoId,v.fecha,v.hora,v.club,v.conRecupero?"aviso":"tarde","la app"); });
  RG.as.forEach(doc=>{ if(!rgClubOk(doc.club)) return; const mk=doc.marcas||{}, q=doc.quien||{};
    Object.keys(mk).forEach(k=>{ const e=mk[k]; if(e!=="falto"&&e!=="recupera") return; const [id,h]=k.split("|");
      if(e==="recupera"&&out[`${id}|${doc.fecha}|${h}`]) return; add(id,doc.fecha,h,doc.club,e==="falto"?"falto":"aviso",q[k]||""); }); });
  return Object.values(out).sort((x,y)=>(y.fecha+y.hora).localeCompare(x.fecha+x.hora)); }
function rgHeader(txt){ const [y,m]=RG.mes.split("-").map(Number);
  return `<section class="sec" style="margin-top:0">
    <div class="sec-head"><button class="icon-btn" data-act="rgMes" data-d="-1" aria-label="Mes anterior">‹</button><h2 class="disp" style="font-size:22px;text-transform:capitalize">${mesLbl(RG.mes)}</h2><button class="icon-btn" data-act="rgMes" data-d="1" aria-label="Mes siguiente" ${RG.mes>=mesKey(now)?"disabled":""}>›</button></div>
    ${S.modo==="profe"?"":`<div class="seg" style="margin:0">${[["","Los dos"],["JUMP","Jump"],["ESPACIO","Espacio"]].map(([v,l])=>`<button type="button" class="seg-b" data-act="rgClub" data-v="${v}" aria-pressed="${RG.club===v}">${l}</button>`).join("")}</div>`}
    <input class="search" id="rgQ" type="search" placeholder="Buscar un alumno" value="${esc(RG.q)}" autocomplete="off">
    <p class="small muted" style="margin:0">${txt}</p></section>`; }
function vRegistro(v){
  if(!RG.mes) RG.mes=mesKey(now); rgCargar(); if(RG.q) setTimeout(rgFiltrar,0);
  if(RG.cargando&&!RG.as.length) return rgHeader("")+`<div class="empty">Cargando…</div>`;
  if(RG.err) return rgHeader("")+`<div class="empty">No se pudo cargar. <button class="linkish" data-act="rgRe">Reintentar</button></div>`;
  if(v==="lluvia"){
    const ts=rgLluvias(); const lista=ts.map(t=>({...t,al:t.al.filter(id=>rgBusca(rgNom(id)))})).filter(t=>t.al.length);
    const nAl=ts.reduce((s,t)=>s+t.al.length,0); const dias=new Set(ts.map(t=>t.fecha)).size;
    // A quién le llovió dos semanas seguidas (según la regla: ahí se descuenta).
    const sem={}; ts.forEach(t=>t.al.forEach(id=>{ (sem[id]=sem[id]||new Set()).add(rgSemana(t.fecha)); }));
    const seguidas=Object.keys(sem).filter(id=>{ const ws=[...sem[id]].sort(); return ws.some((w,i)=>i&&Math.round((isoDate(w)-isoDate(ws[i-1]))/864e5)===7); }).filter(id=>rgBusca(rgNom(id)));
    const resumen=ts.length?`<b>${dias}</b> día${dias===1?"":"s"} con lluvia · <b>${ts.length}</b> clase${ts.length===1?"":"s"} suspendida${ts.length===1?"":"s"} · ${nAl} alumno${nAl===1?"":"s"} a recuperar.`:"Este mes no se suspendió ninguna clase por lluvia.";
    return rgHeader(resumen+" Se cargan solas cuando tocás <b>🌧 Lluvia</b> en un turno o suspendés desde la Agenda.")+
      (seguidas.length?`<section class="sec"><div class="notice" style="margin:0"><b>Les llovió dos semanas seguidas:</b> ${seguidas.map(id=>esc(rgNom(id))).join(", ")}. Según tu regla, a estos se les descuenta.</div></section>`:"")+
      (lista.length?`<section class="sec"><div class="list">${lista.map(t=>`<div class="row" data-rgn="${rgDataN(t.al)}"><div style="display:grid;gap:4px;min-width:0;grid-column:1/-1"><span class="main"><span class="name">🌧 ${rgFecha(t.fecha)} · ${t.hora}</span><span class="meta"><span class="tag ${t.club}">${rgClubN(t.club)}</span><span class="tag lluvia">Suspendida · recuperan</span>${t.por.size?`<span class="small muted">Marcó ${esc([...t.por].join(" y "))}</span>`:""}</span></span><span class="small">${t.al.map(id=>esc(rgNom(id))).join(" · ")}</span></div></div>`).join("")}</div></section>`:"");
  }
  const fs=rgFaltas().filter(x=>rgBusca(rgNom(x.id))); const cnt=t=>fs.filter(x=>x.tipo===t).length;
  const TXT={falto:["No avisó · perdió la clase","due"],tarde:["Avisó tarde · perdió la clase","due"],aviso:["Avisó · recupera","rec"]};
  const resumen=fs.length?`<b class="due">${cnt("falto")+cnt("tarde")}</b> perdieron la clase (no avisaron o avisaron con menos de 24 h) · <b>${cnt("aviso")}</b> avisaron y recuperan.`:"Este mes no faltó nadie.";
  return rgHeader(resumen+" Las faltas por lluvia están en <b>🌧 Lluvia</b>.")+
    (fs.length?`<section class="sec"><div class="list">${fs.map(x=>{ const [t,c]=TXT[x.tipo]; return `<div class="row" data-rgn="${rgDataN([x.id])}"><span class="main"><span class="name">${esc(rgNom(x.id))}</span><span class="meta"><span class="small">${rgFecha(x.fecha)} · ${x.hora}</span><span class="tag ${x.club}">${rgClubN(x.club)}</span><span class="tag ${c==="due"?"no":"rec"}">${t}</span>${x.por?`<span class="small muted">${x.por==="la app"?"Avisó por la app":"Marcó "+esc(x.por)}</span>`:""}</span></span></div>`; }).join("")}</div></section>`:"");
}
function vAsistDia(){
  if(window.escucharExtras) window.escucharExtras();
  const f=isoDate(S.asFecha); const dow=f.getDay(); const esHoy=S.asFecha===hoyISO;
  // Turnos con alguien (fijos, recuperaciones o pruebas). Los vacíos de la grilla quedan abajo, para sumar a alguien que viene a recuperar.
  const tg=turnosGrilla(S.asClub).filter(t=>t.dia===dow).sort((x,y)=>x.hora.localeCompare(y.hora));
  const conGente=t=>t.al.some(a=>vaEn(a,t,S.asFecha))||asistEstado(t).vienen>0||Object.keys(S.asMarcas).some(k=>k.endsWith("|"+t.hora));
  const slots=tg.filter(conGente), vacios=tg.filter(t=>!conGente(t));
  const vals=Object.values(S.asMarcas); const cnt=e=>vals.filter(v=>v===e).length;
  const extras=Object.keys(S.asMarcas).filter(k=>S.asMarcas[k]==="recuperando").map(k=>{const [id,hora]=k.split("|"); return {a:S.alumnos.find(x=>x.id===id),hora};}).filter(x=>x.a);
  return `
  <section class="sec" style="margin-top:4px">
    <div class="clubs" ${S.modo==="profe"?"hidden":""}>${["ESPACIO","JUMP"].map(c=>`<button class="chip" data-act="asClub" data-c="${c}" aria-pressed="${S.asClub===c}">${c==="ESPACIO"?"Espacio":"Jump"}</button>`).join("")}</div>
    <div class="sec-head"><button class="icon-btn" data-act="asDia" data-d="-1" aria-label="Día anterior">‹</button>
      <div style="text-align:center"><h2 class="disp" style="font-size:22px">${DIAS_LARGO[dow]} ${f.getDate()}</h2><span class="small muted">${f.toLocaleDateString("es-AR",{month:"long"})}${esHoy?" · hoy":""}</span></div>
      <button class="icon-btn" data-act="asDia" data-d="1" aria-label="Día siguiente">›</button></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">${esHoy?"":`<button class="mini" data-act="asHoy">Volver a hoy</button>`}<button class="mini" data-act="asDia" data-d="7">+1 semana</button></div>
    ${slots.length?asistPendHTML(slots):""}
    ${slots.length?`<p class="small muted num" style="margin:0;text-align:center"><b class="free">${cnt("vino")}</b> vinieron · <b class="due">${cnt("falto")}</b> faltaron · ${cnt("recuperando")} recuperaron${cnt("lluvia")?` · ${cnt("lluvia")} por lluvia`:""}</p>`:""}
  </section>
  ${slots.length?slots.map(t=>asistTurnoHTML(t,extras)).join(""):`<div class="empty" style="margin-top:16px">No hay nadie anotado en ${S.asClub==="ESPACIO"?"Espacio":"Jump"} este día.</div>`}
  ${vacios.length?`<section class="sec"><div class="sec-head"><h3>Turnos vacíos</h3></div><p class="small muted" style="margin:0">Sin alumnos fijos ni recuperaciones. Si viene alguien a recuperar, tocá el horario.</p><div style="display:flex;gap:8px;flex-wrap:wrap">${vacios.map(t=>`<button class="mini" data-act="asRecAdd" data-hora="${t.hora}">${t.hora} · 4 libres</button>`).join("")}</div></section>`:""}
  ${S.modo!=="profe"&&S.downloads?`<button class="mini" data-act="asCSV" style="margin-top:16px">Descargar asistencia de ${mesSolo(S.asFecha.slice(0,7))} (CSV)</button>`:""}
  <p class="small muted" style="margin:18px 0 90px">Tocá el <b style="color:var(--ink)">nombre</b> si vino (se pone verde) o la <b style="color:var(--ink)">✗</b> si faltó (se pone rojo). <b style="color:var(--ink)">Vinieron todos</b> marca presentes a los que quedan. Cuando el turno queda todo marcado se cierra solo. <b style="color:var(--ink)">Faltó</b> sin avisar: pierde la clase (si querés dársela igual, sumásela desde su ficha). Los que avisaron por la app aparecen abajo y no hace falta marcarlos.</p>`;
}
// Un turno en Asistencia: primero los que hay que marcar, después los que vienen a recuperar, los de prueba y al final los que avisaron que no vienen.
function asistEstado(t){ const f=S.asFecha, h=t.hora; t={...t,al:t.al.filter(a=>vaEn(a,t,f))};
  const avisaron=t.al.filter(a=>avisoApp(a.id,f,h,"ausencia")&&!vuelveApp(a.id,f,h));
  const marcar=t.al.filter(a=>!avisaron.includes(a));
  const recs=S.avisos.filter(v=>v.tipo==="recupera"&&v.club===t.club&&v.fecha===f&&v.hora===h&&!vuelveApp(v.alumnoId,f,h)).map(v=>S.alumnos.find(x=>x.id===v.alumnoId)).filter(Boolean);
  const manual=Object.keys(S.asMarcas).filter(k=>S.asMarcas[k]==="recuperando"&&k.endsWith("|"+h)).map(k=>S.alumnos.find(x=>x.id===k.split("|")[0])).filter(a=>a&&!recs.includes(a));
  const prueba=(S.extras||[]).filter(x=>x.club===t.club&&x.fecha===f&&x.hora===h);
  const vienen=marcar.length+recs.length+manual.length+prueba.length;
  const pend=marcar.filter(a=>!S.asMarcas[`${a.id}|${h}`]).length+recs.filter(a=>!S.asMarcas[`${a.id}|${h}`]).length;
  return {avisaron,marcar,recs,manual,prueba,vienen,libres:Math.max(0,CUPO-vienen),pend}; }
function asistPendHTML(slots){ if(S.asFecha>hoyISO) return `<div class="as-pend fut">Día que todavía no llegó: ya ves quién avisó y quién viene a recuperar.</div>`;
  const ya=slots.filter(t=>S.asFecha<hoyISO||t.hora<=`${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`);
  const n=ya.reduce((s,t)=>s+asistEstado(t).pend,0);
  return n?`<div class="as-pend">Te falta${n===1?"":"n"} marcar <b>${n}</b> ${n===1?"alumno":"alumnos"}</div>`:(ya.length?`<div class="as-pend ok">✓ Asistencia al día</div>`:""); }
function asistTurnoHTML(t){ const f=S.asFecha, h=t.hora; const E=asistEstado(t); t={...t,al:t.al.filter(a=>vaEn(a,t,f))}; const mk=a=>S.asMarcas[`${a.id}|${h}`];
  const okKey=`${f}|${t.club}|${h}`; const abierto=(S.asOpen||new Set()).has(okKey);
  // Cada alumno: una fila. Tocás el nombre = Vino. ✗ = Faltó. La fila se pinta según lo que marcaste.
  const fila=(a,nombre,e,eOk,eNo,actOk,actNo,extra)=>{ const st=e===eOk?"ok":e===eNo?"no":e==="lluvia"?"ll":"";
    const lbl=st==="ok"?(eOk==="recuperando"?"✓ Vino a recuperar":"✓ Vino"):st==="no"?"✗ Faltó · pierde la clase":st==="ll"?"🌧 Suspendida":"Sin marcar";
    return `<div class="as2-row st-${st||"0"}" data-k="${a.id}"><button type="button" class="as2-main" ${st==="ll"?"disabled":`data-act="${actOk}" data-id="${a.id}" data-hora="${h}" data-e="${eOk==="recuperando"?"recuperando":"vino"}"`}><span class="as2-dot">${st==="ok"?"✓":st==="no"?"✗":st==="ll"?"🌧":""}</span><span class="as2-txt"><b>${nombre}</b><small>${lbl}${extra||""}</small></span></button>${st==="ll"?"":`<button type="button" class="as2-x" data-act="${actNo}" data-id="${a.id}" data-hora="${h}" data-e="falto" aria-pressed="${st==="no"}" aria-label="Faltó">✗</button>`}</div>`; };
  const nv=a=>primeraClase(a)===f?' <span class="as2-nv">1ª clase</span>':esNuevo(a)?' <span class="as2-nv">Nuevo</span>':"";
  const filaFija=a=>{ const e=mk(a); const av=tagAviso(a.id,f,h).replace(/<[^>]+>/g,"").trim(); return fila(a,esc(a.nombre)+nv(a),e,"vino","falto","marca","marca",e==="recupera"?" · recupera":av?` · ${esc(av)}`:""); };
  const filaRec=(a,app)=>{ const e=mk(a); const rp=(S.reemp||{})[`${a.id}|${f}|${h}`]; const nom=rp?`${esc(rp.quien)} <span style="font-weight:500">(por ${esc(a.nombre)})</span>`:esc(a.nombre);
    if(!app) return `<div class="as2-row st-ok as2-r"><button type="button" class="as2-main" data-act="asRecQuitar" data-id="${a.id}" data-hora="${h}"><span class="as2-dot">✓</span><span class="as2-txt"><b>${nom}</b><small>↺ Vino a recuperar · lo sumaste vos (tocá para sacarlo)</small></span></button></div>`;
    return fila(a,nom,e,"recuperando","falto",e==="recuperando"?"asRecQuitar":"asRecApp","asRecNo"," · ↺ viene a recuperar").replace('class="as2-row','class="as2-row as2-r'); };
  const filaPrueba=x=>`<div class="as2-row st-p"><span class="as2-main"><span class="as2-dot">★</span><span class="as2-txt"><b>${esc(x.nombre||"Sin nombre")}</b><small>${x.tipo==="invitado"?"Invitado":"Clase de prueba"}</small></span></span></div>`;
  const filaAviso=a=>{ const v=avisoApp(a.id,f,h,"ausencia"); const ab=(S.asAbrir||new Set()).has(`${a.id}|${h}`);
    if(ab) return fila(a,esc(a.nombre),mk(a),"vino","falto","marca","marca"," · había avisado");
    return `<div class="as2-row st-av"><span class="as2-main"><span class="as2-dot">–</span><span class="as2-txt"><b>${esc(a.nombre)}</b><small>Avisó que no viene · ${v.conRecupero?"recupera":"avisó tarde, la pierde"}</small></span></span><button type="button" class="as2-mini" data-act="asAbrir" data-id="${a.id}" data-hora="${h}">Vino igual</button></div>`; };
  const todasLluvia=t.al.length&&t.al.every(a=>mk(a)==="lluvia");
  const marcados=[...E.marcar,...E.recs]; const vinieron=marcados.filter(a=>["vino","recuperando"].includes(mk(a))).length+E.manual.length;
  const faltaron=marcados.filter(a=>mk(a)==="falto").length; const total=marcados.length+E.manual.length;
  const pasado=f<hoyISO||(f===hoyISO&&h<=`${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`);
  const lista=!!(total||E.prueba.length||E.avisaron.length);
  const tomada=pasado&&lista&&!E.pend&&total>0&&!todasLluvia;
  const cerrado=(tomada||todasLluvia)&&!abierto;
  const estado=todasLluvia?`<span class="as2-st ll">🌧 Suspendida</span>`:tomada?`<span class="as2-st ok">✓ Tomada</span>`:E.pend&&pasado?`<span class="as2-st no">Falta${E.pend===1?"":"n"} marcar ${E.pend}</span>`:total?`<span class="as2-st">${total-E.pend}/${total} marcados</span>`:"";
  const head=`<div class="as2-head"><div class="as2-h"><b class="num">${h}</b>${t.nivel?`<span class="as2-cat">${esc(capCat(t.nivel))}</span>`:""}</div>${estado}</div>`;
  if(cerrado){ const res=todasLluvia?`${t.al.length} alumno${t.al.length===1?"":"s"} recuperan`:[`<b class="free">${vinieron}</b> vinieron`,faltaron?`<b class="due">${faltaron}</b> faltó${faltaron===1?"":"aron"}`:"",E.avisaron.length?`${E.avisaron.length} avisó que no`:""].filter(Boolean).join(" · ");
    const nombres=todasLluvia?t.al.map(a=>esc(a.nombre.split(" ")[0])).join(", "):marcados.filter(a=>mk(a)==="falto").map(a=>`<span class="due">✗ ${esc(a.nombre)}</span>`).join(" · ");
    return `<section class="as2 cerrado ${todasLluvia?"ll":"ok"}">${head}<p class="as2-res num">${res}</p>${nombres?`<p class="as2-res">${nombres}</p>`:""}<button type="button" class="as2-link" data-act="asOpen" data-k="${okKey}">Ver / corregir</button></section>`; }
  const nrec=E.recs.length+E.manual.length;
  const res=[`${E.vienen} vienen`, E.avisaron.length?`${E.avisaron.length} avisó que no`:"", nrec?`${nrec} recupera${nrec===1?"":"n"}`:"", E.libres?`<span class="free">${E.libres} libre${E.libres===1?"":"s"}</span>`:"completo"].filter(Boolean).join(" · ");
  return `<section class="as2">${head}<p class="as2-res num">${res}</p>
    ${E.pend&&!todasLluvia?`<button type="button" class="as2-todos" data-act="asTodos" data-hora="${h}" data-club="${t.club}">✓ Vinieron todos (${E.pend})</button>`:""}
    <div class="as2-list">${E.marcar.map(filaFija).join("")}${E.recs.map(a=>filaRec(a,true)).join("")}${E.manual.map(a=>filaRec(a,false)).join("")}${E.prueba.map(filaPrueba).join("")}${E.avisaron.map(filaAviso).join("")}${!t.al.length&&!nrec&&!E.prueba.length?'<div class="empty">Sin alumnos en este turno.</div>':""}</div>
    <div class="as2-acts"><button type="button" class="as2-mini" data-act="asLluvia" data-hora="${h}">${todasLluvia?"Quitar lluvia":"🌧 Lluvia"}</button><button type="button" class="as2-mini" data-act="asRecAdd" data-hora="${h}">+ Viene a recuperar</button>${abierto?`<button type="button" class="as2-mini" data-act="asOpen" data-k="${okKey}">Cerrar</button>`:""}</div></section>`; }

/* ---------- Suspender clases: por lluvia, o porque ese día no hay clases (uno o varios días) ----------
   Cada alumno de los turnos elegidos suma una clase para recuperar (2 semanas desde esa clase), le llega una notificación,
   esos turnos dejan de aparecer para recuperar y se arma el mensaje para el grupo de WhatsApp. */
const LL={desde:null,hasta:null,club:"",motivo:"lluvia",sel:new Set(),ya:new Set()};
const suspRef=()=>S.db.doc("publico/suspendidas");
const suspKey=(club,f,h)=>`${club}|${f}|${h}`;
function llFechas(){ const out=[]; if(!LL.desde) return out; const h=LL.hasta&&LL.hasta>=LL.desde?LL.hasta:LL.desde; let d=isoDate(LL.desde);
  for(let i=0;i<21&&toISO(d)<=h;i++,d.setDate(d.getDate()+1)) out.push(toISO(d)); return out; }
async function openLluvia(fecha,motivo){ LL.desde=fecha||hoyISO; LL.hasta=LL.desde; if(motivo) LL.motivo=motivo; LL.club=S.modo==="profe"?"JUMP":(S.club||""); await llCargarYa(); llSelTodo(); pintarLluvia(); }
async function llCargarYa(){ LL.ya=new Set();
  try{ const d=await suspRef().get(); Object.keys((d.exists&&d.data().t)||{}).forEach(k=>{ const [c,f,h]=k.split("|"); LL.ya.add(`${f}|${c}|${h}`); }); }catch(e){}
  for(const f of llFechas()) for(const c of ["JUMP","ESPACIO"]){ try{ const d=await S.db.collection("asistencia").doc(`${f}_${c}`).get(); const mk=(d.exists&&d.data().marcas)||{}; Object.keys(mk).forEach(k=>{ if(mk[k]==="lluvia") LL.ya.add(`${f}|${c}|${k.split("|")[1]}`); }); }catch(e){} } }
function llSelTodo(){ const ya=new Date(); const ahora=`${pad(ya.getHours())}:${pad(ya.getMinutes())}`;
  LL.sel=new Set(lluviaTurnos().filter(t=>!LL.ya.has(t.k)&&(t.fecha>hoyISO||t.hora>ahora)).map(t=>t.k)); }
function lluviaTurnos(){ const out=[]; llFechas().forEach(f=>{ const dow=isoDate(f).getDay();
    turnos(LL.club).filter(t=>t.dia===dow).forEach(t=>out.push({...t,fecha:f,k:`${f}|${t.club}|${t.hora}`,al:t.al.filter(a=>vaEn(a,t,f))})); });
  return out.sort((x,y)=>x.fecha.localeCompare(y.fecha)||x.hora.localeCompare(y.hora)||x.club.localeCompare(y.club)); }
function pintarLluvia(){ const ts=lluviaTurnos(); const elegidos=ts.filter(t=>LL.sel.has(t.k)); const n=elegidos.reduce((s,t)=>s+t.al.length,0); const nt=elegidos.length; const ll=LL.motivo==="lluvia";
  const porDia={}; ts.forEach(t=>(porDia[t.fecha]=porDia[t.fecha]||[]).push(t));
  openSheet(`<div style="display:grid;gap:4px"><span class="flabel">${ll?"🌧 Lluvia":"⛔ No hay clases"}</span><h2 class="disp">Suspender clases</h2></div>
    <div class="seg" style="grid-template-columns:1fr 1fr;margin:0"><button type="button" class="seg-b" data-act="llMot" data-v="lluvia" aria-pressed="${ll}">🌧 Por lluvia</button><button type="button" class="seg-b" data-act="llMot" data-v="sin" aria-pressed="${!ll}">⛔ No hay clases</button></div>
    <div class="two"><div class="field"><label for="llF">Desde</label><input id="llF" type="date" value="${LL.desde}" min="${hoyISO}"></div><div class="field"><label for="llH">Hasta</label><input id="llH" type="date" value="${LL.hasta||LL.desde}" min="${LL.desde}"></div></div>
    <div class="field"><label>Club</label><div class="seg" style="grid-template-columns:repeat(${S.modo==="profe"?1:3},1fr);margin:0">${(S.modo==="profe"?[["JUMP","Jump"]]:[["","Los dos"],["JUMP","Jump"],["ESPACIO","Espacio"]]).map(([v,l])=>`<button type="button" class="seg-b" data-act="llClub" data-v="${v}" aria-pressed="${LL.club===v}">${l}</button>`).join("")}</div></div>
    <div class="aum-list">${ts.length?Object.keys(porDia).map(f=>{ const d=isoDate(f); return `<span class="flabel" style="margin:6px 0 2px">${DIAS_LARGO[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}</span>${porDia[f].map(t=>{ const ya=LL.ya.has(t.k), on=LL.sel.has(t.k);
      return `<label class="aum-row ${on||ya?"on":""}"><input type="checkbox" data-act="llT" data-k="${t.k}" ${on||ya?"checked":""} ${ya?"disabled":""}><span class="aum-n"><b>${t.hora} · ${t.club==="ESPACIO"?"Espacio":"Jump"}</b><small>${ya?"Ya está suspendida":`${t.al.length} alumno${t.al.length===1?"":"s"}${t.nivel?" · "+esc(t.nivel):""}`}</small></span><span class="tag ${t.club}">${t.club==="ESPACIO"?"Espacio":"Jump"}</span></label>`; }).join("")}`; }).join(""):`<div class="empty">No hay turnos en esas fechas.</div>`}</div>
    <p class="small aum-exp">A cada alumno de los turnos elegidos se le suma <b>una clase para recuperar</b> (2 semanas), le llega una <b>notificación</b> al celular y esos turnos <b>no aparecen para recuperar</b>. Al final te armo el mensaje para el grupo.</p>
    <div class="btns"><button class="btn sec2" data-act="close">Cancelar</button><button class="btn pri" data-act="llOk" ${nt?"":"disabled"}>Suspender ${nt} turno${nt===1?"":"s"} · ${n} alumnos</button></div>`); }
const fechaTxtLL=f=>{ const d=isoDate(f); return f===hoyISO?"hoy":`el ${DIAS_LARGO[d.getDay()].toLowerCase()} ${d.getDate()}`; };
const listaY=l=>l.length>1?l.slice(0,-1).join(", ")+" y "+l[l.length-1]:(l[0]||"");
// Días para recuperar que sugiere el mensaje: los próximos días de clase de esta semana que no se suspendieron; si no hay, la semana que viene.
function llOpciones(fechas){ const out=[]; const d=isoDate(hoyISO); d.setDate(d.getDate()+1);
  while(d.getDay()!==6&&d.getDay()!==0&&out.length<2){ const f=toISO(d); if(!fechas.includes(f)) out.push(f===toISO(new Date(now.getFullYear(),now.getMonth(),now.getDate()+1))?`mañana ${DIAS_LARGO[d.getDay()].toLowerCase()}`:`el ${DIAS_LARGO[d.getDay()].toLowerCase()} ${d.getDate()}`); d.setDate(d.getDate()+1); }
  return out.length?`${out.join(", ")} o la semana que viene`:"la semana que viene"; }
async function confirmarLluvia(b){ const ts=lluviaTurnos().filter(t=>LL.sel.has(t.k)&&!LL.ya.has(t.k)); if(!ts.length) return;
  b.disabled=true; b.textContent="Suspendiendo…"; let tot=0; const lineas=[], items=[]; const ll=LL.motivo==="lluvia"; const FV=firebase.firestore.FieldValue;
  // Primero se marcan como suspendidos, así nadie los reserva para recuperar mientras tanto. Y se limpian los viejos.
  { const t={}; ts.forEach(x=>t[suspKey(x.club,x.fecha,x.hora)]=LL.motivo);
    try{ const d=await suspRef().get(); const lim=toISO(new Date(now.getFullYear(),now.getMonth(),now.getDate()-7)); Object.keys((d.exists&&d.data().t)||{}).forEach(k=>{ if(k.split("|")[1]<lim) t[k]=FV.delete(); }); }catch(e){}
    if(!(await safe(()=>suspRef().set({t},{merge:true})))){ b.disabled=false; b.textContent="Reintentar"; return; } }
  const fallaron=[];
  for(const t of ts){ const ids=await lluviaTurno(t.club,t.fecha,t.hora,true); if(!ids){ fallaron.push(t); continue; } tot+=ids.length; lineas.push(`${t.fecha}|${t.hora} (${t.club==="ESPACIO"?"Espacio La 10":"Jump"})`); if(ids.length) items.push({club:t.club,fecha:t.fecha,hora:t.hora,alumnos:ids});
    if(ll) await safe(()=>S.db.doc(`lluvias/${t.fecha}_${t.club}_${hhmmDe(t.hora)}`).set({club:t.club,fecha:t.fecha,hora:t.hora,alumnos:ids,notificado:false,creado:firebase.firestore.FieldValue.serverTimestamp()})); }
  if(fallaron.length){ const t={}; fallaron.forEach(x=>t[suspKey(x.club,x.fecha,x.hora)]=FV.delete()); await safe(()=>suspRef().set({t},{merge:true})); fallaron.forEach(x=>LL.ya.delete&&LL.ya.delete(x.k)); }
  if(!ll&&items.length) await safe(()=>S.db.collection("suspensiones").doc(`${Date.now().toString(36)}`).set({items,notificado:false,creado:firebase.firestore.FieldValue.serverTimestamp()}));
  const fechas=[...new Set(ts.map(t=>t.fecha))].sort(); const dias=listaY(fechas.map(fechaTxtLL)); const club=LL.club?` en ${LL.club==="ESPACIO"?"Espacio La 10":"Jump"}`:"";
  const det=fechas.length>1?lineas.map(x=>{ const [f,r]=x.split("|"); return `${fechaTxtLL(f)} ${r}`; }):lineas.map(x=>x.split("|")[1]);
  const msg=ll?`🌧 Por la lluvia se suspenden las clases de ${dias}: ${det.join(", ")}. A cada uno le queda la clase para recuperar en las próximas 2 semanas, la reservan desde la app.`
    :`📢 Aviso: ${dias} no hay clases${club}. A cada uno le queda la clase para recuperar: la pueden recuperar ${llOpciones(fechas)}, donde haya lugar. La reservan desde la app (tienen 2 semanas): ${typeof LINK_APP!=="undefined"?LINK_APP:""}`;
  try{ if(window.AVISOS_URL) fetch(window.AVISOS_URL,{method:"POST",keepalive:true}).catch(()=>{}); }catch(e){}
  render(); openSheet(`<div style="display:grid;gap:8px;text-align:center;justify-items:center"><div style="font-size:44px;line-height:1">${ll?"🌧":"⛔"}</div><h2 class="disp" style="margin:0">Clases suspendidas</h2>
    <p class="small" style="margin:0">${ts.length-fallaron.length} turno${ts.length-fallaron.length===1?"":"s"} · ${tot} alumnos con clase para recuperar. La notificación les llega en unos minutos.</p>
    ${fallaron.length?`<p class="small" style="margin:0;color:var(--warn);font-weight:700">No se pudieron suspender: ${esc(fallaron.map(x=>`${fechaTxtLL(x.fecha)} ${x.hora}`).join(", "))}. Revisá la conexión y volvé a suspenderlos.</p>`:""}
    <div class="msg" style="text-align:left;width:100%"><span class="small muted">Mensaje para el grupo de WhatsApp:</span><div class="bubble">${esc(msg)}</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="mini" data-act="copy" data-text="${esc(msg)}">Copiar mensaje</button><a class="mini go" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Mandar al grupo por WhatsApp →</a></div></div>
    <button class="btn pri" data-act="close" style="width:100%">Listo</button></div>`); }

// Suspender un turno por lluvia (o deshacerlo): queda marcado en la asistencia y cada alumno suma (o resta) una clase para recuperar.
async function lluviaTurno(club,fecha,hora,auto=false){
  let t=turnosGrilla(club).find(x=>x.dia===isoDate(fecha).getDay()&&x.hora===hora); if(!t) return; t={...t,al:t.al.filter(a=>vaEn(a,t,fecha))};
  const ref=S.db.collection("asistencia").doc(`${fecha}_${club}`); let mk={};
  if(S.asKey===`${fecha}_${club}`) mk={...S.asMarcas}; else { try{ const d=await ref.get(); mk={...((d.exists&&d.data().marcas)||{})}; }catch(e){ toast("Sin conexión: no se pudo leer la asistencia. Probá de nuevo."); return; } }
  const mk0={...mk};
  const quitar=!auto&&t.al.length&&t.al.every(a=>mk[`${a.id}|${hora}`]==="lluvia");
  if(!auto&&!confirm(quitar?`¿Quitar la suspensión por lluvia de las ${hora}? A cada uno se le descuenta la clase para recuperar.`:`¿Se suspendió por lluvia la clase de las ${hora}? Queda anotado en la asistencia y a cada alumno (${t.al.length}) le suma una clase para recuperar.`)) return;
  const cambios=[];
  t.al.forEach(a=>{ const k=`${a.id}|${hora}`; const prev=mk[k];
    const avA=avisoApp(a.id,fecha,hora,"ausencia"); const yaTiene=prev==="recupera"||(avA&&avA.conRecupero&&!vuelveApp(a.id,fecha,hora));
    if(quitar){ delete mk[k]; if(!yaTiene) cambios.push([a,-1]); }
    else if(prev!=="lluvia"){ mk[k]="lluvia"; if(!yaTiene) cambios.push([a,1]); } });
  // Los que venían a recuperar en ese turno: también se les devuelve la clase.
  const recs=S.avisos.filter(v=>v.tipo==="recupera"&&v.club===club&&v.fecha===fecha&&v.hora===hora&&!vuelveApp(v.alumnoId,fecha,hora)).map(v=>S.alumnos.find(x=>x.id===v.alumnoId)).filter(Boolean);
  recs.forEach(a=>{ const k=`${a.id}|${hora}`; if(quitar){ if(mk[k]==="lluvia"){ delete mk[k]; cambios.push([a,-1]); } } else if(mk[k]!=="lluvia"){ mk[k]="lluvia"; cambios.push([a,1]); } });
  if(S.asKey===`${fecha}_${club}`){ S.asMarcas=mk; if(!(await guardarAsist())) return; }
  else { const FV=firebase.firestore.FieldValue, dm={}; Object.keys(mk).forEach(k=>{ if(mk[k]!==mk0[k]) dm[k]=mk[k]; }); Object.keys(mk0).forEach(k=>{ if(!(k in mk)) dm[k]=FV.delete(); });
    const yo=S.esOwner?"Gabriel":"Esteban", dq={}; Object.keys(dm).forEach(k=>dq[k]=mk[k]==="lluvia"?yo:FV.delete());
    if(Object.keys(dm).length&&!(await safe(()=>ref.set({fecha,club,marcas:dm,quien:dq},{merge:true})))) return; }
  for(const [a,d] of cambios) await setRec(a,d,fecha);
  if(!auto){ const FV=firebase.firestore.FieldValue; await safe(()=>suspRef().set({t:{[suspKey(club,fecha,hora)]:quitar?FV.delete():"lluvia"}},{merge:true})); }
  if(quitar) { try{ const lr=S.db.doc(`lluvias/${fecha}_${club}_${hhmmDe(hora)}`); const ld=await lr.get(); if(ld.exists&&!ld.data().notificado) await lr.delete(); }catch(e){} }
  if(auto) return [...t.al.filter(a=>{ const v=avisoApp(a.id,fecha,hora,"ausencia"); return !(v&&v.conRecupero&&!vuelveApp(a.id,fecha,hora)); }),...recs].map(a=>a.id);
  render(); toast(quitar?`Se quitó la lluvia de las ${hora}`:`${hora} suspendida por lluvia · ${cambios.length} con clase para recuperar`);
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
  const libres=turnosGrilla(S.club).reduce((s,t)=>s+Math.max(0,CUPO-t.al.length),0);
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
TAB_ICON.gestion='<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 15v-3M12 15V9M16 15v-5"/></svg>';
TAB_ICON.semana=TAB_ICON.agenda; TAB_ICON.inicio='<svg viewBox="0 0 24 24"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/></svg>'; TAB_ICON.dinero=TAB_ICON.plata; TAB_ICON.admin=TAB_ICON.gestion; TAB_ICON.equipo='<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3 2.8-5 5.5-5s4.9 2 5.5 5"/><path d="M15 6h6M15 10h6M17 14h4"/></svg>';
TAB_ICON.esteban='<svg viewBox="0 0 24 24"><circle cx="12" cy="7.5" r="3.5"/><path d="M5 20c.8-4 3.6-6 7-6s6.2 2 7 6"/><path d="M17 3.5l2 2"/></svg>';
const TAB_LBL={plata:"Mis gastos",hoy:"Hoy",alumnos:"Alumnos",agenda:"Agenda",recuperar:"Recuperar",gestion:"Gestión",dinero:"Plata",equipo:"Equipo",admin:"Admin",inicio:"Inicio",semana:"Agenda",asist:"Asistencia",horas:"Mis horas",esteban:"Esteban"};
const tabsDe=()=> S.modo==="profe" ? ["horas","agenda","asist","recuperar","plata"] : ["inicio","alumnos","asist","semana","dinero"];
function renderTabs(){ const t=tabsDe(); const nav=$("#tabs"); nav.style.gridTemplateColumns=`repeat(${t.length},1fr)`;
  const sel=k=>S.tab===k||(k==="alumnos"&&S.tab==="recuperar"&&S.modo!=="profe");
  nav.innerHTML=t.map(k=>`<button class="tab" role="tab" data-tab="${k}" aria-selected="${sel(k)}">${TAB_ICON[k]}${TAB_LBL[k]}</button>`).join(""); }
function render(){
  if(S.modo!=="profe"){ if(S.tab==="gestion"||S.tab==="esteban"||S.tab==="equipo") S.tab="admin"; if(S.tab==="agenda") S.tab="hoy"; }
  if(S.modo!=="profe"&&S.esOwner&&!render._ini){ render._ini=1; S.tab="inicio"; }
  if(!tabsDe().includes(S.tab)&&!(S.modo!=="profe"&&["asist","recuperar","hoy","admin"].includes(S.tab))) S.tab=tabsDe()[0];

  if(S.modo==="profe"){ S.club="JUMP"; S.asClub="JUMP"; }
  renderTabs(); $("#cfgBtn").hidden=!S.esOwner; objBar();
  document.querySelectorAll(".tab").forEach(b=>b.setAttribute("aria-selected",b.dataset.tab===S.tab||(b.dataset.tab==="alumnos"&&S.tab==="recuperar"&&S.modo!=="profe")));
  document.querySelectorAll("#clubs .chip").forEach(b=>b.setAttribute("aria-pressed",b.dataset.club===S.club));
  $("#fab").hidden=S.modo==="profe"||S.tab!=="alumnos";
  const subAl=S.modo!=="profe"&&(S.tab==="alumnos"||S.tab==="recuperar");
  { const fa=$("#fabAs"); if(fa) fa.hidden=true; }
  $("#clubs").hidden=S.modo==="profe"||!["alumnos","agenda","recuperar","hoy"].includes(S.tab);
  { const w=S.esOwner&&S.modo!=="profe"; $("#staffApp").classList.toggle("w",w); $("#staffApp").classList.toggle("w-home",w&&S.tab==="inicio");
    const wm=document.querySelector("#staffApp .wm"); if(wm) wm.textContent=w?({inicio:"Inicio",hoy:"Clases",asist:"Asistencia",alumnos:"Alumnos",recuperar:"Recuperar",dinero:"Mi plata",admin:"Administración",semana:"Agenda"})[S.tab]||"Clases de Pádel":"Clases de Pádel"; }
  let html="";
  if(S.dbState==="sin-db") html+=`<div class="notice">No se pudo conectar con la base de datos. Revisá tu conexión y volvé a abrir la app.</div>`;
  else if(S.dbState==="cargando") html+=`<p class="small muted" style="margin:16px 0 0">Cargando tus alumnos…</p>`;
  if(S.tab==="asist"||(S.modo==="profe"&&S.asFecha===hoyISO)) subAsist();
  if(S.modo==="profe") html+=`<div class="notice" style="background:var(--surface-2);color:var(--muted);margin:0 0 12px">${S.esOwner?'Estás viendo los datos reales de Esteban. Lo que cambies acá se guarda en su cuenta. <button class="linkish" data-act="modoOwner">Volver a la tuya</button>':"Jump · vista de profe · <button class=\"linkish\" data-act=\"salir\">Cerrar sesión</button>"}</div>`;
  html+=({hoy:vHoy,alumnos:vAlumnos,agenda:vAgenda,recuperar:vRecuperar,asist:vAsist,horas:vHoras,plata:vPlata,esteban:vEsteban,gestion:vGestion,dinero:vDinero,admin:vAdmin,inicio:vInicioG,semana:vSemana})[S.tab]();
  if(subAl) html=`<div class="seg al-sub" role="group" aria-label="Sección"><button type="button" class="seg-b" data-act="tab" data-t="alumnos" aria-pressed="${S.tab==="alumnos"}">Lista</button><button type="button" class="seg-b" data-act="tab" data-t="recuperar" aria-pressed="${S.tab==="recuperar"}">Recuperar${(()=>{ const n=activos().reduce((t,a)=>t+recN(a),0); return n?` · ${n}`:""; })()}</button><button type="button" class="seg-b" data-act="libres">Lugares libres</button></div>`+html;
  const focused=document.activeElement&&document.activeElement.id==="q";
  // Mientras escribís en el buscador, se actualiza solo la lista: el campo no se toca (en el celu redibujarlo traba el teclado).
  if(focused&&S.tab==="alumnos"){ const tmp=document.createElement("div"); tmp.innerHTML=html; const nq=tmp.querySelector("#q"), lq=$("#q");
    if(nq&&lq){ const ls=lq.parentElement; [...ls.childNodes].forEach(c=>{ if(c!==lq) c.remove(); }); nq.remove(); const ns=tmp.querySelector("section"); if(ns){ ls.append(...ns.childNodes); } return; } }
  const yAntes=scrollY; const tmpV=document.createElement("main"); tmpV.innerHTML=html; morph($("#view"),tmpV); if(Math.abs(scrollY-yAntes)>1) scrollTo(0,yAntes);
  if(focused){ const q=$("#q"); q.focus(); q.setSelectionRange(q.value.length,q.value.length); }
  if((S.tab==="hoy"||S.tab==="agenda")&&!render._c&&document.getElementById("daysStrip")){ render._c=1; setTimeout(centrarDia,0); }
}

/* ---------- Encabezado que acompaña el dedo: se va yendo al bajar, vuelve al subir y al soltar se acomoda suave ---------- */
{ let yAnt=scrollY, off=0, H=0, tick=false, tFin=null, dir=0;
  const top=()=>document.querySelector("#staffApp .top");
  const pintar=(h,anim)=>{ h.style.transition=anim?"transform .45s cubic-bezier(.22,1,.36,1)":"none";
    h.style.transform=off?`translate3d(0,${-off}px,0)`:""; h.classList.toggle("oculto",off>=H-1); };
  addEventListener("scroll",()=>{ if(tick) return; tick=true; requestAnimationFrame(()=>{ tick=false;
    const h=top(); if(!h||$("#staffApp").hidden||!$("#overlay").hidden) { yAnt=scrollY; return; }
    H=h.offsetHeight+8; const y=Math.max(0,scrollY), d=y-yAnt; yAnt=y; if(Math.abs(d)>1) dir=Math.sign(d);
    off=Math.min(H,Math.max(0,off+d)); if(y<off) off=y; pintar(h,false);
    clearTimeout(tFin); tFin=setTimeout(()=>{ const h2=top(); if(!h2) return; off=(dir>0&&scrollY>H&&off>0)?H:0; pintar(h2,true); },140); }); },{passive:true}); }

/* ---------- Aumentos de cuota ---------- */
const mesCorto = m => `${["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][Number(m.slice(5,7))-1]} ${m.slice(2,4)}`;
const AUM={ desde:null, monto:2500, sel:null, filtro:"" };
function aumPlan(a,desde,monto){ const act=mesKey(now); const prev=aumentosDe(a).find(x=>x.desde===desde);
  if(desde<act){ const precio=prev?prev.precio:(precioEn(a,desde)||a.precioClase||0); return {desde,monto,precio,antes:Math.max(0,precio-monto),aplicado:true,tipo:"registro"}; }
  const base=prev?prev.antes:(desde===act?(a.precioClase||0):precioEn(a,desde)); return {desde,monto,antes:base,precio:base+monto,aplicado:desde===act,tipo:desde===act?"ahora":"futuro"}; }
function openAumento(){ const act=mesKey(now); if(!AUM.desde) AUM.desde=mesSig(act);
  const al=S.alumnos.filter(a=>a.activo!==false&&a.precioClase>0).sort((x,y)=>(x.nombre||"").localeCompare(y.nombre||""));
  if(!AUM.sel) AUM.sel=new Set(al.map(a=>a.id));
  const ult=a=>{ const u=ultimoAumento(a); return u?mesCorto(u.desde):"—"; };
  const meses=[...new Set(al.map(a=>(ultimoAumento(a)||{}).desde||"").filter(Boolean))].sort();
  const tipo=AUM.desde<act?"registro":AUM.desde===act?"ahora":"futuro";
  const exp=tipo==="registro"?`Queda anotado que en <b>${mesLbl(AUM.desde)}</b> les aumentaste <b>${money(AUM.monto)}</b> la clase. <b>No cambia</b> lo que cobrás hoy.`
    :tipo==="ahora"?`El precio sube <b>${money(AUM.monto)}</b> la clase <b>desde este mes</b>. Las cuotas de ${mesSolo(act)} que todavía no pagaron se recalculan.`
    :`El precio sube <b>${money(AUM.monto)}</b> la clase <b>desde ${mesLbl(AUM.desde)}</b>. Hasta entonces pagan lo mismo. A los alumnos les aparece el aviso en la app desde hoy y les llega una notificación.`;
  const n=al.filter(a=>AUM.sel.has(a.id)).length;
  openSheet(`<div style="display:grid;gap:4px"><span class="flabel">Cuotas</span><h2 class="disp">Aumento</h2></div>
    <div class="two"><div class="field"><label for="aumDesde">Desde el mes</label><input id="aumDesde" type="month" value="${AUM.desde}"></div>
      <div class="field"><label for="aumMonto">Sube por clase</label><input id="aumMonto" type="number" inputmode="numeric" min="0" step="500" value="${AUM.monto||""}" placeholder="Ej: 2500"></div></div>
    <div class="seg" style="grid-template-columns:repeat(4,1fr);margin:0">${[1000,2000,2500,5000].map(v=>`<button type="button" class="seg-b" data-act="aumM" data-v="${v}" aria-pressed="${AUM.monto===v}">+${v/1000}k</button>`).join("")}</div>
    <p class="small aum-exp">${exp}</p>
    <div class="aum-sel"><span class="small"><b>${n}</b> de ${al.length} alumnos</span><span class="aum-q"><button type="button" class="linkish" data-act="aumQ" data-v="todos">Todos</button><button type="button" class="linkish" data-act="aumQ" data-v="nadie">Ninguno</button><button type="button" class="linkish" data-act="aumQ" data-v="JUMP">Jump</button><button type="button" class="linkish" data-act="aumQ" data-v="ESPACIO">Espacio</button></span></div>
    ${meses.length?`<div class="aum-sel" style="margin-top:-4px"><span class="small muted">Último aumento:</span><span class="aum-q">${meses.map(m=>`<button type="button" class="linkish" data-act="aumQ" data-v="u:${m}">${mesCorto(m)}</button>`).join("")}<button type="button" class="linkish" data-act="aumQ" data-v="u:">Sin dato</button></span></div>`:""}
    <div class="aum-list">${al.map(a=>{ const pl=aumPlan(a,AUM.desde,AUM.monto||0); const on=AUM.sel.has(a.id); const px=aumentoProx(a);
      return `<label class="aum-row ${on?"on":""}"><input type="checkbox" data-act="aumT" data-id="${a.id}" ${on?"checked":""}><span class="aum-n"><b>${esc(a.nombre)}</b><small>Empezó: ${desdeTxt(a,true)} · Últ. aumento: ${ult(a)}${px&&px.desde!==AUM.desde?` · programado ${mesCorto(px.desde)}`:""}</small></span><span class="aum-p num">${tipo==="registro"?money(pl.precio):`${money(pl.antes)} → <b>${money(pl.precio)}</b>`}</span></label>`; }).join("")}</div>
    <div class="btns" style="margin-top:12px"><button class="btn sec2" data-act="close">Cancelar</button><button class="btn pri" data-act="aumOk" ${n&&AUM.monto>0&&AUM.desde?"":"disabled"}>${tipo==="registro"?"Registrar":"Aplicar"} a ${n}</button></div>`,()=>openAumento()); }
/* Cuándo empezó cada alumno: se carga una vez y queda fija (los aumentos no la cambian). Los que están hace mucho: "Hace años". */
function openInicios(){ const al=S.alumnos.filter(a=>a.activo!==false).sort((x,y)=>{ const sx=!x.antiguo&&!arranqueDe(x), sy=!y.antiguo&&!arranqueDe(y); return (sy-sx)||(x.nombre||"").localeCompare(y.nombre||""); });
  const sin=al.filter(a=>!a.antiguo&&!arranqueDe(a)).length;
  openSheet(`<div style="display:grid;gap:4px"><span class="flabel">Alumnos</span><h2 class="disp">Cuándo empezó cada uno</h2>
    <span class="small muted">${sin?`<b style="color:var(--warn)">${sin} sin fecha.</b> `:"Todos tienen fecha. "}Elegí la fecha o tocá <b>Hace años</b> si no sabés. Se guarda sola y queda fija aunque les aumentes.</span></div>
    <div class="aum-list">${al.map(a=>{ const ini=a.antiguo?"":arranqueDe(a); const h=aumHistTxt(a);
      return `<div class="aum-row on" style="display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center"><span class="aum-n"><b>${esc(a.nombre)}</b><small>${esc(desdeTxt(a))}${h.length?` · Aumentos: ${esc(h.join(" · "))}`:" · Sin aumentos"}</small></span>
        <span style="display:flex;gap:6px;align-items:center"><input type="date" class="iniL" data-id="${a.id}" value="${ini}" style="width:140px;min-height:40px"><button type="button" class="seg-b" data-act="iniAntL" data-id="${a.id}" aria-pressed="${!!a.antiguo}" style="padding:8px 10px">Hace años</button></span></div>`; }).join("")}</div>
    <div class="btns" style="margin-top:12px"><span></span><button class="btn pri" data-act="close">Listo</button></div>`); }
document.addEventListener("change",async e=>{ const t=e.target; if(!t||!t.classList||!t.classList.contains("iniL")||!window.MODO_STAFF) return;
  const A=S.alumnos.find(x=>x.id===t.dataset.id); if(!A||!t.value) return;
  if(await safe(()=>colA().doc(A.id).update({inicio:t.value,antiguo:false,...(A.promo?{}:{inicioManual:true})}),`${A.nombre}: empezó el ${t.value.split("-").reverse().join("/")}`)){ A.inicio=t.value; A.antiguo=false; openInicios(); } });
async function guardarAumento(b){ const act=mesKey(now); const al=S.alumnos.filter(a=>AUM.sel.has(a.id)&&a.activo!==false&&a.precioClase>0); if(!al.length||!(AUM.monto>0)) return;
  b.disabled=true; b.textContent="Guardando…";
  const ok=await safe(async()=>{ for(let i=0;i<al.length;i+=400){ const bt=S.db.batch();
    al.slice(i,i+400).forEach(a=>{ const pl=aumPlan(a,AUM.desde,AUM.monto); const {tipo,...e}=pl; const L=aumentosDe(a).filter(x=>x.desde!==AUM.desde); L.push(e); L.sort((x,y)=>x.desde.localeCompare(y.desde));
      const p={aumentos:L}; if(tipo==="ahora") p.precioClase=pl.precio; bt.update(colA().doc(a.id),p); });
    await bt.commit(); } },`Aumento ${AUM.desde<act?"registrado":"aplicado"} a ${al.length} alumno${al.length===1?"":"s"}`);
  if(ok){ AUM.sel=null; closeSheet(); } else { b.disabled=false; b.textContent="Aplicar"; } }
document.addEventListener("change",async e=>{ const t=e.target; if(!t||!$("#llF")) return;
  if(t.id==="llF"&&t.value){ LL.desde=t.value; if(!LL.hasta||LL.hasta<LL.desde) LL.hasta=LL.desde; await llCargarYa(); llSelTodo(); pintarLluvia(); return; }
  if(t.id==="llH"&&t.value){ LL.hasta=t.value<LL.desde?LL.desde:t.value; await llCargarYa(); llSelTodo(); pintarLluvia(); return; }
  if(t.dataset&&t.dataset.act==="llT"){ if(t.checked) LL.sel.add(t.dataset.k); else LL.sel.delete(t.dataset.k); pintarLluvia(); } });
document.addEventListener("change",e=>{ const t=e.target; if(!t||!$("#aumDesde")) return;
  if(t.id==="aumDesde"&&t.value){ AUM.desde=t.value; const y=($(".aum-list")||{}).scrollTop||0; openAumento(); const l=$(".aum-list"); if(l) l.scrollTop=y; }
  else if(t.id==="aumMonto"){ AUM.monto=Math.max(0,Math.round(Number(t.value)||0)); const y=($(".aum-list")||{}).scrollTop||0; openAumento(); const l=$(".aum-list"); if(l) l.scrollTop=y; }
  else if(t.dataset&&t.dataset.act==="aumT"){ const id=t.dataset.id; if(t.checked) AUM.sel.add(id); else AUM.sel.delete(id); t.closest(".aum-row").classList.toggle("on",t.checked);
    const n=S.alumnos.filter(a=>AUM.sel.has(a.id)&&a.activo!==false&&a.precioClase>0).length; const tot=S.alumnos.filter(a=>a.activo!==false&&a.precioClase>0).length;
    const c=$(".aum-sel .small"); if(c) c.innerHTML=`<b>${n}</b> de ${tot} alumnos`; const b=$('[data-act="aumOk"]'); if(b){ b.textContent=b.textContent.replace(/\d+$/,n); b.disabled=!(n&&AUM.monto>0); } } });
// Cuando llega el mes de un aumento programado, el precio pasa a ser el nuevo.
let aumHecho=false;
// Arreglo del error de pagos (oct 2026): marcar un pago borraba los otros meses. Si a un alumno nuevo le falta algún mes
// de su plan de arranque (promo o primer mes), se vuelve a cargar. Solo completa lo que falta; no toca nada que exista.
let planesHecho=false;
async function repararPlanes(){ if(planesHecho||!S.esOwner||S.modo==="profe"||!S.loaded.a) return; planesHecho=true;
  const arreglos=[];
  S.alumnos.forEach(a=>{ const pm=planGuardado(a); if(!pm||!(a.horarios||[]).length||!(a.precioClase||pm.promo)) return;
    const plan=planPrimerMes(a,pm.ini,pm.promo,pm.modo,pm.dur).pagos; const falta={};
    Object.keys(plan).forEach(m=>{ if(!(a.pagos||{})[m]) falta[m]=plan[m]; });
    if(Object.keys(falta).length) arreglos.push([a,falta]); });
  if(!arreglos.length) return;
  try{ for(let i=0;i<arreglos.length;i+=400){ const bt=S.db.batch(); arreglos.slice(i,i+400).forEach(([a,falta])=>bt.set(colA().doc(a.id),{pagos:falta},{merge:true})); await bt.commit(); }
    console.log(`Planes de arranque recuperados: ${arreglos.length}`); }catch(e){ console.error(e); planesHecho=false; } }
async function aplicarAumentosVencidos(){ if(aumHecho||!S.esOwner||S.modo==="profe") return; const act=mesKey(now);
  const L=S.alumnos.filter(a=>aumentosDe(a).some(x=>!x.aplicado&&x.desde<=act)); if(!L.length){ aumHecho=true; return; } aumHecho=true;
  try{ const bt=S.db.batch(); L.forEach(a=>{ const aus=aumentosDe(a).map(x=>(!x.aplicado&&x.desde<=act)?{...x,aplicado:true}:x); const ult=aus.filter(x=>x.desde<=act).pop(); bt.update(colA().doc(a.id),{aumentos:aus,precioClase:ult.precio}); }); await bt.commit(); }catch(e){ console.error(e); aumHecho=false; } }

/* ---------- Objetivo de alumnos ---------- */
const objMin=()=>{ try{ return localStorage.getItem("objMin")==="1"; }catch(e){ return false; } };
function setObjMin(v){ try{ localStorage.setItem("objMin",v?"1":"0"); }catch(e){} objBar(); }
function objBar(){ const b=$("#objBar"); if(!b) return; const meta=Number(S.cfg.objetivoAlumnos)||0; const n=S.alumnos.filter(a=>a.activo!==false).length;
  b.hidden=S.modo==="profe"||!S.esOwner||S.dbState!=="ok"||S.tab!=="alumnos";
  const min=objMin(); b.classList.toggle("min",min);
  if(min){ b.innerHTML=`<span class="obj-mini">🎯 <b class="num">${n}</b>${meta?`/<span class="num">${meta}</span>`:""}${meta&&n<meta?` · faltan <b class="num">${meta-n}</b>`:""}</span><span class="obj-mbar"><i style="width:${meta?Math.min(100,Math.round(n/meta*100)):0}%"></i></span>`; b.setAttribute("aria-label","Mostrar objetivo de alumnos"); return; }
  if(!meta){ b.innerHTML=`<span class="obj-k">Objetivo</span><span class="obj-t">Poné cuántos alumnos querés tener</span><span class="obj-go">Elegir</span><span class="obj-grip" aria-hidden="true"></span>`; return; }
  const falta=Math.max(0,meta-n), pct=Math.min(100,Math.round(n/meta*100));
  b.innerHTML=`<span class="obj-wm num" aria-hidden="true">${meta}</span><span class="obj-k">Objetivo ${meta}</span><span class="obj-t"><b class="num">${n}</b> alumnos · ${falta?`faltan <b class="num">${falta}</b>`:`¡llegaste! 🎯${n>meta?` +${n-meta}`:""}`}</span><span class="obj-pct num">${pct}%</span><span class="obj-bar"><i style="width:${pct}%"></i></span><span class="obj-grip" aria-hidden="true"></span>`;
  b.setAttribute("aria-label",`Objetivo ${meta} alumnos. Tenés ${n}${falta?`, faltan ${falta}`:", llegaste"}. Tocá para cambiarlo, deslizá para arriba para esconderlo.`); }
// Deslizar para arriba: se achica. Para abajo (o tocar la rayita): vuelve.
{ let y0=null, swiped=false; const bar=()=>$("#objBar");
  document.addEventListener("touchstart",e=>{ const b=bar(); if(b&&b.contains(e.target)){ y0=e.touches[0].clientY; swiped=false; } else y0=null; },{passive:true});
  document.addEventListener("touchmove",e=>{ if(y0===null) return; const dy=e.touches[0].clientY-y0; if(dy<-25&&!objMin()){ swiped=true; y0=null; setObjMin(true); } else if(dy>25&&objMin()){ swiped=true; y0=null; setObjMin(false); } },{passive:true});
  document.addEventListener("click",e=>{ const b=bar(); if(swiped&&b&&b.contains(e.target)){ e.stopPropagation(); e.preventDefault(); swiped=false; } },true); }
function openObjetivo(){ const meta=Number(S.cfg.objetivoAlumnos)||0; const n=S.alumnos.filter(a=>a.activo!==false).length;
  openSheet(`<div style="display:grid;gap:4px;margin-bottom:12px"><span class="flabel">Tu meta</span><h2 class="disp">Objetivo de alumnos</h2></div><p class="small muted" style="margin:0 0 12px">Hoy tenés <b>${n}</b> alumnos activos (Jump + Espacio). ¿A cuántos querés llegar?</p>
    <div class="seg" style="grid-template-columns:repeat(4,1fr);margin:0 0 12px">${[50,100,150,200].map(v=>`<button type="button" class="seg-b" data-act="objPick" data-v="${v}" aria-pressed="${v===meta}">${v}</button>`).join("")}</div>
    <div class="field"><label for="objIn">Otro número</label><input id="objIn" type="number" inputmode="numeric" min="0" step="1" value="${meta||""}" placeholder="Ej: 120"></div>
    <p class="small muted" style="margin:12px 0 0">Tip: deslizá la franja para arriba y se achica; para abajo, vuelve.</p>
    <div class="btns" style="margin-top:14px">${meta?`<button class="btn sec2" data-act="objBorrar">Sacarlo</button>`:"<span></span>"}<button class="btn pri" data-act="objSave">Guardar</button></div>`); }
async function guardarObjetivo(v){ if(await safe(()=>S.db.doc("config/general").update({...S.cfg,objetivoAlumnos:v}),v?`Objetivo: ${v} alumnos`:"Objetivo sacado")){ S.cfg={...S.cfg,objetivoAlumnos:v}; closeSheet(); render(); } }

/* ---------- Actualizar solo lo que cambió (en vez de redibujar toda la pantalla) ---------- */
function morph(a,b){
  if(a.nodeType===1&&a!==$("#view")){ for(const at of [...a.attributes]) if(!b.hasAttribute(at.name)) a.removeAttribute(at.name);
    for(const at of b.attributes) if(a.getAttribute(at.name)!==at.value) a.setAttribute(at.name,at.value); }
  const bc=[...b.childNodes];
  for(let i=0;i<bc.length;i++){ const nb=bc[i]; let na=a.childNodes[i];
    if(!na){ a.appendChild(nb); continue; }
    const kb=nb.nodeType===1?nb.getAttribute("data-k"):null;
    if(kb!==null&&(na.nodeType!==1||na.getAttribute("data-k")!==kb)){ let m=null; for(let j=i+1;j<a.childNodes.length;j++){ const x=a.childNodes[j]; if(x.nodeType===1&&x.getAttribute("data-k")===kb){ m=x; break; } }
      if(m){ a.insertBefore(m,na); na=m; } else { a.insertBefore(nb,na); continue; } }
    if(na.nodeType!==nb.nodeType||(na.nodeType===1&&na.tagName!==nb.tagName)){ a.replaceChild(nb,na); continue; }
    if(na.nodeType!==1){ if(na.nodeValue!==nb.nodeValue) na.nodeValue=nb.nodeValue; continue; }
    if(na.isEqualNode(nb)) continue;
    morph(na,nb);
    if(na!==document.activeElement){ if(na.tagName==="INPUT"){ if(na.type==="checkbox"||na.type==="radio") na.checked=nb.hasAttribute("checked"); else if(na.value!==(nb.getAttribute("value")||"")) na.value=nb.getAttribute("value")||""; }
      else if(na.tagName==="SELECT"){ const o=na.querySelector("option[selected]"); if(o) na.value=o.value; } else if(na.tagName==="TEXTAREA") na.value=nb.textContent; }
  }
  while(a.childNodes.length>bc.length) a.removeChild(a.lastChild);
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
const EST_TXT={vino:"Vino",falto:"Faltó sin avisar",recupera:"Avisó · recupera",recuperando:"Vino a recuperar",lluvia:"Clase suspendida · recupera"};
const EST_COL={vino:"var(--ok)",falto:"var(--warn)",recupera:"var(--sun)",recuperando:"var(--jump)",lluvia:"#2f5f9e"};
// Solo los últimos 4 meses (antes bajaba la asistencia de todos los días y se trababa).
function hastaTiempo(p,ms){ return Promise.race([p,new Promise((_,no)=>setTimeout(()=>no(new Error("tiempo")),ms))]); }
function historialDeSnap(snap,id){ const out=[];
  snap.docs.forEach(d=>{ const v=d.data(); Object.keys(v.marcas||{}).forEach(k=>{ const [aid,hora]=k.split("|"); if(aid===id) out.push({fecha:v.fecha,club:v.club,hora,estado:v.marcas[k],quien:(v.quien||{})[k]||""}); }); });
  return out.sort((x,y)=>(y.fecha+y.hora).localeCompare(x.fecha+x.hora));
}
function qHist(){ const d=new Date(); d.setDate(d.getDate()-120); const desde=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; return S.db.collection("asistencia").where("fecha",">=",desde); }
async function historialDe(id){ return historialDeSnap(await hastaTiempo(qHist().get(),12000),id); }
async function cargarHist(a){
  const el=$("#histA"); if(!el||!S.db) return;
  // Primero lo que ya está guardado en el celu (aparece al instante), después lo actualizado.
  const mismo=()=>$("#histA")&&$("#fA")&&$("#fA").dataset.id===a.id;
  try{ const c=await qHist().get({source:"cache"}); if(c.size&&mismo()&&$("#histA").dataset.ok!=="1") pintarHist(historialDeSnap(c,a.id)); }catch(e){}
  try{ const h=await historialDe(a.id); if(!mismo()) return; $("#histA").dataset.ok="1"; pintarHist(h); }
  catch(e){ if(!mismo()) return; const el2=$("#histA"); if(el2.dataset.ok==="1") return; if(el2.dataset.cache==="1"){ el2.insertAdjacentHTML("beforeend",`<p class="small muted" style="margin:6px 0 0">Puede faltar lo último: sin conexión.</p>`); return; }
    el2.innerHTML=`No se pudo cargar el historial. <button type="button" class="linkish" id="histRe">Reintentar</button>`; const b=$("#histRe"); if(b) b.onclick=()=>{ el2.innerHTML="Cargando…"; cargarHist(a); }; }
}
function pintarHist(h){
  if(!$("#histA")) return;
  { $("#histA").dataset.cache="1";
    if(!h.length){ $("#histA").innerHTML="Sin asistencias marcadas en los últimos 4 meses."; return; }
    const cnt=e=>h.filter(x=>x.estado===e).length;
    $("#histA").innerHTML=`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;color:var(--ink)"><span><b class="num">${cnt("vino")+cnt("recuperando")}</b> vino</span><span style="color:var(--warn)"><b class="num">${cnt("falto")}</b> faltó</span><span style="color:var(--sun)"><b class="num">${cnt("recupera")}</b> avisó</span></div>
      <div style="display:grid;gap:4px;max-height:220px;overflow:auto">${h.map(x=>{const d=isoDate(x.fecha); return `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid var(--line-2)"><span style="color:var(--ink)"><span style="text-transform:capitalize">${DIAS[d.getDay()]}</span> ${d.getDate()}/${d.getMonth()+1} · ${x.hora}</span><span style="color:${EST_COL[x.estado]||"var(--muted)"};font-weight:700;text-align:right">${EST_TXT[x.estado]||x.estado}${x.quien?` <span class="muted" style="font-weight:500">· ${esc(x.quien)}</span>`:""}</span></div>`;}).join("")}</div>`;
  }
}
async function exportAsist(){
  const m=S.asFecha.slice(0,7); const snap=await S.db.collection("asistencia").get(); const rows=[["Fecha","Club","Hora","Alumno","Estado","Marcó"]];
  snap.docs.map(d=>d.data()).filter(v=>v.fecha.startsWith(m)).sort((x,y)=>x.fecha.localeCompare(y.fecha)).forEach(v=>Object.keys(v.marcas||{}).sort().forEach(k=>{ const [id,hora]=k.split("|"); const a=S.alumnos.find(x=>x.id===id); rows.push([v.fecha,v.club,hora,a?a.nombre:id,EST_TXT[v.marcas[k]]||v.marcas[k],(v.quien||{})[k]||""]); }));
  const csv="\uFEFF"+rows.map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(";")).join("\n");
  try{ await S.downloads.save({filename:`asistencia-${m}.csv`,data:csv}); }catch(e){}
}
function iniCampo(a){ const ini=a.antiguo?"":arranqueDe(a);
  return `<div class="field"><label for="aIni2">Empezó el</label><div style="display:flex;gap:8px;align-items:center"><input id="aIni2" type="date" value="${ini}" data-orig="${ini}" data-ant="${a.antiguo?1:0}" style="flex:1">
    <button type="button" class="seg-b" data-act="iniAnt" aria-pressed="${!!a.antiguo}" style="flex:0 0 auto;padding:10px 12px">Hace años</button></div>
    <span class="small muted" id="aIniTx">${a.antiguo?"Alumno de hace años (sin fecha exacta). ":ini?desdeTxt(a).replace(/^.*\(/,"Empezó ").replace(")",". "):"Cargá cuándo empezó. "}Queda fija aunque le aumentes.</span></div>`; }
function formAlumno(a={},leadId=""){
  openSheet(`<form id="fA" data-id="${a.id||""}" data-lead="${leadId}" style="display:grid;gap:14px">
    <div class="btns"><h2 class="disp">${a.id?esc(a.nombre):"Nuevo alumno"}</h2>${a.id&&a.activo!==false?`<button type="button" class="msg-btn" data-act="msg" data-id="${a.id}" aria-label="Mensajes">${WA_ICON}</button>`:""}</div>
    <div class="field"><label for="aNom">Nombre</label><input id="aNom" required value="${esc(a.nombre)}"></div>
    <div class="two">
      <div class="field"><label for="aClub">Club principal</label><select id="aClub">${["JUMP","ESPACIO"].map(c=>`<option ${(a.club||S.club||"JUMP")===c?"selected":""}>${c}</option>`).join("")}</select></div>
      <div class="field"><label for="aTel">Teléfono</label><input id="aTel" inputmode="tel" value="${esc(a.tel)}"></div>
    </div>
    <div class="field"><span class="flabel">Categoría</span>${catPicker("aCat",a.categoria)}</div>
    <div class="two">
      <div class="field"><label for="aPrecio">Precio por clase</label><input id="aPrecio" type="number" inputmode="numeric" min="0" step="250" value="${a.precioClase||""}">${(()=>{ const u=ultimoAumento(a), px=aumentoProx(a); return u||px?`<span class="small muted">${u?`Último aumento: ${mesCorto(u.desde)}${u.monto?` (+${money(u.monto)})`:""}`:""}${u&&px?" · ":""}${px?`<b>Desde ${mesCorto(px.desde)}: ${money(px.precio)}</b>`:""}</span>`:""; })()}</div>
    </div>
    <span class="small muted" id="aCalc" style="margin-top:-6px"></span>
    ${(()=>{ const pm=planGuardado(a); if(a.id&&!pm&&(pagoReal((a.pagos||{})[mesKey(now)])||a.antiguo||!esNuevo(a))){ /* alumno que ya venía: la fecha no toca las cuotas */
        // Ya pagó el mes: la fecha de arranque igual se ve y se puede corregir (sirve para los aumentos y para marcarlo como nuevo).
        return iniCampo(a); }
      return `<div class="field promo"><span class="flabel">${a.id?"Fecha de arranque":"Primer mes"}</span>
      <div class="two"><div class="field"><label for="aIni">Empieza el</label><input id="aIni" type="date" value="${pm?pm.ini:(a.id?arranqueDe(a):hoyISO)}" data-orig="${pm?pm.ini:(a.id?arranqueDe(a):hoyISO)}"></div>
      <div class="field"><label for="aPromo">Precio promo por clase (opcional)</label><input id="aPromo" type="number" inputmode="numeric" min="0" step="250" placeholder="Sin promo" value="${pm&&pm.promo?pm.promo:""}"></div></div>
      <div class="field" id="aDurBox" hidden style="margin:0"><label>¿Cuántas cuotas dura la promo?</label><div class="seg" style="grid-template-columns:repeat(3,1fr);margin:0">${[1,2,3].map(n=>`<button type="button" class="seg-b" data-act="pmDur" data-n="${n}" aria-pressed="${n===((pm&&pm.dur)||1)}">${n===1?"1 mes":n+" meses"}</button>`).join("")}</div></div>
      <div class="seg" style="grid-template-columns:1fr 1fr;margin:0"><button type="button" class="seg-b" data-act="pmModo" data-m="este" aria-pressed="${!pm||pm.modo!=="sig"}">Las paga este mes</button><button type="button" class="seg-b" data-act="pmModo" data-m="sig" aria-pressed="${!!pm&&pm.modo==="sig"}">Las suma al mes siguiente</button></div>
      <span class="small" id="aPromoCalc" style="line-height:1.5"></span>${a.id?'<span class="small muted">Si cambiás la fecha, la cuota del primer mes se recalcula sola (los meses que ya pagó no se tocan).</span>':""}</div>`; })()}
    ${a.id&&aumentosDe(a).length?`<div class="field"><span class="flabel">Aumentos</span><span class="small">${aumHistTxt(a).map(esc).join("<br>")}</span></div>`:""}
    <div class="field"><label>Horarios</label><div id="hList" style="display:grid;gap:8px">${(a.horarios&&a.horarios.length?a.horarios:[{dia:1,hora:"18:00"}]).map(h=>hRow(h,a.club)).join("")}</div><button type="button" class="linkish" data-act="hadd" style="justify-self:start">+ Otro día</button><span class="small muted">Si va a los dos clubes, elegí el club de cada día. Recupera solo en los clubes donde entrena.</span></div>
    <div class="field"><span class="flabel">Clases para recuperar${recN(a)?` <span style="text-transform:none;letter-spacing:0;color:var(--sun)">· ${recVenceTxt(a)}</span>`:""}</span><div class="stepper"><button type="button" data-act="stepRec" data-d="-1" aria-label="Restar">−</button><b class="num" id="aRec" data-orig="${recN(a)||0}">${recN(a)||0}</b><button type="button" data-act="stepRec" data-d="1" aria-label="Sumar">+</button></div></div>
    <div class="field"><label for="aNota">Notas</label><textarea id="aNota" rows="2" placeholder="Aumentos, lesiones, objetivos…">${esc(a.notas)}</textarea></div>
    ${a.id?accesoHTML(a):""}
    ${a.id?avisosFichaHTML(a):""}
    ${a.id&&S.esOwner&&S.modo!=="profe"?`<button type="button" class="linkish" data-act="resetPrueba" data-id="${a.id}" style="justify-self:start;font-size:13px">🧹 Borrar pruebas de la app (dejar en cero)</button>`:""}
    ${a.id?`<div class="field"><span class="flabel">Historial de asistencia</span><div id="histA" class="small muted">Cargando…</div></div>`:""}
    ${a.id?`<label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="aAct" ${a.activo===false?"":"checked"}> Activo (sacalo si dejó o está en pausa)</label>`:""}
    <div class="btns">${a.id?`<button type="button" class="btn del" data-act="delA">Borrar</button>`:"<span></span>"}<span style="display:flex;gap:8px"><button type="button" class="btn sec2" data-act="close">Cancelar</button><button class="btn pri">Guardar</button></span></div>
  </form>`);
  const calc=()=>{ const f=$("#fA"); if(!f) return; const tmp={precioClase:Number($("#aPrecio").value)||0,horarios:[...f.querySelectorAll(".hrow .hd")].map(s=>({dia:Number(s.value)}))};
    const ex=extraDias(tmp).length; $("#aCalc").textContent=tmp.precioClase?`${mesLbl(S.mes)}: ${clasesMes(tmp)} clases = ${money(cuotaMes(tmp))}${ex?" (incluye clase extra)":""}`:"";
    const pr=$("#aPromo"); if(pr){ const ini=$("#aIni").value||hoyISO; const modo=(f.querySelector('[data-act="pmModo"][aria-pressed="true"]')||{}).dataset.m||"este";
      const dur=Number((f.querySelector('[data-act="pmDur"][aria-pressed="true"]')||{dataset:{n:1}}).dataset.n)||1; $("#aDurBox").hidden=!Number(pr.value);
      $("#aPromoCalc").textContent=(tmp.precioClase||Number(pr.value))&&tmp.horarios.length?planPrimerMes(tmp,ini,Number(pr.value)||0,modo,dur).txt:"Cargá el precio por clase y los horarios y te calculo el primer mes."; } };
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
  catch(e){ console.error(e); toast(e&&e.code==="permission-denied"?"No tenés permiso para cambiar esto.":`No se pudo guardar. Probá de nuevo. (${(e&&(e.code||e.name))||"error"}${e&&e.message?": "+String(e.message).slice(0,90):""})`); return false; }
}
const colA=()=>S.db.collection("alumnos");
const colL=()=>S.db.collection("interesados");
async function setPago(a,val,rechazar=false){
  const cur=(a.pagos&&a.pagos[S.mes])||{}; const c=compDe(a);
  return safe(async()=>{ const bt=S.db.batch();
    // set con merge: cambia solo este mes y conserva los demás meses y el monto acordado (un update común borraba todos los otros pagos).
    bt.set(colA().doc(a.id),{pagos:{[S.mes]:{pagado:val,monto:val?montoMes(a):(cur.monto||0),fecha:val?hoyISO:null}}},{merge:true});
    // Si lo pasa a "Debe" y había un comprobante del alumno, queda rechazado (el alumno ve que lo tiene que volver a mandar).
    if(!val&&rechazar&&c&&c.estado==="enviado") bt.update(S.db.doc("comprobantes/"+c.id),{estado:"rechazado",aplicado:true,notificado:true});
    await bt.commit(); });
}
/* ---------- Comprobantes que sube el alumno al pagar ----------
   comprobantes/{alumnoId_mes} = datos · fotosPago/{alumnoId_mes} = la foto. Al llegar uno, el mes queda pagado solo. */
function compDe(a,m=S.mes){ return (S.comps||{})[`${a.id}_${m}`]||null; }
const compAplicando=new Set();
function aplicarComprobantes(){
  if(!S.esOwner||!S.db||!S.loaded.a) return;
  Object.values(S.comps||{}).filter(c=>c.estado==="enviado"&&!c.aplicado&&!compAplicando.has(c.id)).forEach(async c=>{
    const a=S.alumnos.find(x=>x.id===c.alumnoId); if(!a) return; compAplicando.add(c.id);
    try{ const bt=S.db.batch(); const f=c.creado&&c.creado.toDate?toISO(c.creado.toDate()):hoyISO;
      bt.set(colA().doc(a.id),{pagos:{[c.mes]:{pagado:true,monto:c.monto||montoMes(a,c.mes),fecha:f,comprobante:true}}},{merge:true});
      bt.update(S.db.doc("comprobantes/"+c.id),{aplicado:true}); await bt.commit(); }
    catch(e){ console.error(e); compAplicando.delete(c.id); } });
}
/* ---------- Categoría de un turno (club + día + hora): se guarda en el horario de cada alumno del turno ---------- */
function alumnosDelTurno(club,dia,hora){ return S.alumnos.filter(a=>a.activo!==false&&(a.horarios||[]).some(h=>h.dia===dia&&h.hora===hora&&clubH(a,h)===club)); }
function openTurnoCat(club,dia,hora){
  const al=alumnosDelTurno(club,dia,hora); const act=(al.flatMap(a=>(a.horarios||[]).filter(h=>h.dia===dia&&h.hora===hora&&clubH(a,h)===club).map(h=>h.nivel||""))).find(Boolean)||"";
  openSheet(`<div style="display:grid;gap:4px"><h2 class="disp">Categoría del turno</h2><span class="small muted">${DIAS_LARGO[dia]} ${hora} · ${club} · ${al.length} alumno${al.length===1?"":"s"}. Solo pueden venir a recuperar acá los de esta categoría.</span></div>
    <div class="field">${catPicker("tCat",act)}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="mini" data-act="close">Cancelar</button><button class="mini go" data-act="turnoCatOk" data-club="${club}" data-dia="${dia}" data-hora="${hora}">Guardar</button></div>`);
}
async function guardarTurnoCat(b){
  const club=b.dataset.club,dia=Number(b.dataset.dia),hora=b.dataset.hora; const val=($("#tCat").value||"").trim();
  const al=alumnosDelTurno(club,dia,hora); if(!al.length){ closeSheet(); return; }
  const ok=await safe(async()=>{ const bt=S.db.batch();
    al.forEach(a=>bt.update(colA().doc(a.id),{horarios:(a.horarios||[]).map(h=>h.dia===dia&&h.hora===hora&&clubH(a,h)===club?{...h,nivel:val}:h)})); await bt.commit(); });
  if(ok){ closeSheet(); toast(val?`Turno de las ${hora}: ${val}`:`Turno de las ${hora} sin categoría`); }
}
async function verComprobante(a){
  const c=compDe(a); if(!c) return;
  openSheet(`<div style="display:grid;gap:4px"><h2 class="disp">${esc(a.nombre)}</h2><span class="small muted" style="text-transform:capitalize">Comprobante de ${mesLbl(c.mes)} · ${money(c.monto||montoMes(a,c.mes))}${c.estado==="rechazado"?" · <b style='color:var(--warn)'>rechazado</b>":""}</span></div>
    <div id="compImg" class="small muted">Cargando foto…</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${c.estado==="enviado"?`<button class="mini" data-act="compRech" data-id="${a.id}" style="color:var(--warn)">Rechazar pago</button>`:""}<button class="mini go" data-act="close">Cerrar</button></div>`);
  try{ const d=await S.db.doc("fotosPago/"+c.id).get(); const el=$("#compImg"); if(!el) return;
    el.innerHTML=d.exists?`<img src="${d.data().foto}" alt="Comprobante" style="width:100%;max-height:60vh;object-fit:contain;border-radius:10px">`:"No se encontró la foto."; }
  catch(e){ const el=$("#compImg"); if(el) el.textContent="No se pudo cargar la foto."; }
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
  const b=e.target.closest("[data-act],.tab,#clubs .chip,#fab,#fabAs,#cfgBtn"); if(!b) return;
  if(b.classList.contains("tab")){ S.tab=b.dataset.tab; if(S.tab==="agenda"||S.tab==="hoy") S.fecha=hoyISO;
    if(S.tab==="asist"&&S.modo!=="profe"){ S.asFecha=hoyISO; const dw=now.getDay(); const hay=c=>turnos(c).some(t=>t.dia===dw); if(!hay(S.asClub)) S.asClub=hay("ESPACIO")?"ESPACIO":hay("JUMP")?"JUMP":S.asClub; }
    render(); scrollTo(0,0); if(S.tab==="agenda"||S.tab==="hoy") centrarDia(); return; }
  if(b.matches("#clubs .chip")){ S.club=b.dataset.club; render(); return; }
  if(b.id==="fab"){ formAlumno(); return; }
  if(b.id==="fabAs"){ S.prevTab=S.tab; S.asFecha=hoyISO; { const dw=now.getDay(); const hay=c=>turnos(c).some(t=>t.dia===dw); if(!hay(S.asClub)) S.asClub=hay("ESPACIO")?"ESPACIO":hay("JUMP")?"JUMP":S.asClub; } S.tab="asist"; render(); scrollTo(0,0); return; }
  if(b.id==="cfgBtn"){ openCfg(); return; }
  const act=b.dataset.act,id=b.dataset.id;
  const A=id&&S.alumnos.find(x=>x.id===id), L=id&&S.leads.find(x=>x.id===id);
  switch(act){
    case "tab": if(!$("#overlay").hidden) closeSheet(); S.tab=b.dataset.t; if(S.tab==="hoy") S.fecha=hoyISO; render(); scrollTo(0,0); if(S.tab==="agenda"||S.tab==="hoy") centrarDia(); break;
    case "gMes": { const [y,mm]=(S.gMes||mesKey(now)).split("-").map(Number); S.gMes=mesKey(new Date(y,mm-1+Number(b.dataset.d),1)); render(); break; }
    case "gcStep": { const club=b.dataset.club, f=b.dataset.f, k=b.dataset.k; const C=canchaDe(club); const u=usoDia(C,f); const nv={luz:u.luz,sin:u.sin}; nv[k]=Math.max(0,nv[k]+Number(b.dataset.d)); await guardarCancha(club,{ajustes:{[f]:nv}}); break; }
    case "gcAuto": await guardarCancha(b.dataset.club,{ajustes:{[b.dataset.f]:null}},"Volvió a automático"); break;
    case "gcPago": { const club=b.dataset.club; const m=S.gMes||mesKey(now); const C=canchaDe(club); const pg=C.pagos[m]; if(pg&&pg.pagado){ await guardarCancha(club,{pagos:{[m]:{pagado:false}}},"Marcado como no pagado"); } else { const [y,mm]=m.split("-").map(Number); let hl=0,hs=0; for(let d=1;d<=new Date(y,mm,0).getDate();d++){ const f=`${m}-${pad(d)}`; if(f>hoyISO) break; const u=usoDia(C,f); hl+=u.luz; hs+=u.sin; } await guardarCancha(club,{pagos:{[m]:{pagado:true,monto:hl*C.luz+hs*C.sin,fecha:hoyISO}}},`Pago de cancha ${C.lugar} registrado`); } break; }
    case "gcCfg": { const c=b.dataset.club; await guardarCancha(c,{precioLuz:Number($("#gcL-"+c).value)||0,precioSinLuz:Number($("#gcS-"+c).value)||0,luzDesde:$("#gcD-"+c).value||"18:30",nombre:($("#gcN-"+c).value||"").trim()},"Guardado"); break; }
    case "asCerrar": S.tab=S.prevTab&&S.prevTab!=="asist"?S.prevTab:"hoy"; render(); scrollTo(0,0); break;
    case "mes": { const [y,m]=S.mes.split("-").map(Number); S.mes=mesKey(new Date(y,m-1+Number(b.dataset.d),1)); render(); break; }
    case "dia": S.dia=Number(b.dataset.d); render(); break;
    case "fecha": { const st=document.getElementById("daysStrip"); const sl=st?st.scrollLeft:0; S.fecha=b.dataset.f; render(); const n=document.getElementById("daysStrip"); if(n) n.scrollLeft=sl; break; }
    case "fPago": S.fPago=b.dataset.v; render(); break;
    case "verPagaron": S.fPago="pago"; S.tab="alumnos"; render(); scrollTo(0,0); break;
    case "verCancha": openCancha(b.dataset.club); break;
    case "gastoNuevo": openGasto(); break;
    case "ojo": OJO=!OJO; try{ localStorage.setItem("ojoPlata",OJO?"1":"0"); }catch(e){} render(); break;
    case "cfgOpen": openCfg(); break;
    case "libresClub": LIB.club=b.dataset.c; openLibres(); break;
    case "semDia": S.semDia=Number(b.dataset.d); render(); break;
    case "semClub": S.semClub=b.dataset.v; render(); break;
    case "solVer": S.solDesde=null; S.solId=b.dataset.id; openSolicitud(b.dataset.id); break;
    case "solOk": await aprobarSolicitud(b.dataset.id); break;
    case "solNo": { const m=prompt("¿Querés dejarle un mensaje? (opcional)","Ese horario no lo puedo sumar ahora, escribime y vemos otro."); if(m===null) break; closeSheet(); await safe(()=>S.db.doc("solicitudes/"+b.dataset.id).update({estado:"rechazado",motivo:m||"",avisadoAl:false}),"Le avisamos"); break; }
    case "hoyClub": S.hoyClub=b.dataset.v; render(); break;
    case "masAcc": openSheet(`<div style="display:grid;gap:4px"><h2 class="disp">Más acciones</h2></div><div class="w-sheet-grid">${[["admin","Esteban y canchas",'data-act="tab" data-t="admin"'],["cobrar","Mi plata",'data-act="tab" data-t="dinero"'],["alumnos","Mandar accesos",'data-act="accMasivo"'],["cobrar","Aumento de cuota",'data-act="aumento"'],["cobrar","Anotar gasto",'data-act="gastoNuevo"'],["gear","Ajustes y mensajes",'data-act="cfgOpen"']].map(([k,l,a])=>`<button class="w-tile" ${a}><span class="w-ic">${wico(k)}</span><span>${l}</span></button>`).join("")}</div><div class="btns"><span></span><button class="btn sec2" data-act="close">Cerrar</button></div>`); break;
    case "avisosVer": { const h=avisosHoyHTML(); openSheet(`<div style="display:grid;gap:4px"><span class="flabel">Alumnos</span><h2 class="disp">Avisos</h2></div>${h||'<div class="empty">No hay avisos nuevos.</div>'}<div class="btns"><span></span><button class="btn sec2" data-act="close">Listo</button></div>`); break; }
    case "gastoOk": { const monto=Number($("#gMonto").value)||0; if(!monto){ toast("Poné el monto"); break; } const mv={id:Date.now().toString(36),monto,fecha:$("#gFecha").value||hoyISO,nota:($("#gNota").value||"").trim()}; closeSheet(); await guardarGastos([...(S.gastosG||[]),mv],"Gasto anotado"); break; }
    case "gastoDel": if(confirm("¿Borrar este gasto?")) await guardarGastos((S.gastosG||[]).filter(x=>x.id!==b.dataset.id),"Gasto borrado"); break;
    case "verDeben": S.fPago="debe"; S.tab="alumnos"; render(); scrollTo(0,0); break;
    case "aumento": AUM.sel=null; openAumento(); break;
    case "iniAnt": { const i=$("#aIni2"); if(!i) break; const on=i.dataset.ant!=="1"; i.dataset.ant=on?"1":"0"; b.setAttribute("aria-pressed",on); if(on) i.value=""; $("#aIniTx").textContent=on?"Alumno de hace años (sin fecha exacta). Queda fija aunque le aumentes.":"Elegí la fecha en que empezó. Queda fija aunque le aumentes."; break; }
    case "inicios": openInicios(); break;
    case "iniAntL": if(A){ const on=!A.antiguo; if(await safe(()=>colA().doc(A.id).update(on?{antiguo:true}:{antiguo:false}),on?`${A.nombre}: hace años`:"Listo")){ A.antiguo=on; openInicios(); } } break;
    case "aumM": AUM.monto=Number(b.dataset.v); openAumento(); break;
    case "aumQ": { const v=b.dataset.v; const al=S.alumnos.filter(a=>a.activo!==false&&a.precioClase>0);
      AUM.sel=new Set(v==="todos"?al.map(a=>a.id):v==="nadie"?[]:v.startsWith("u:")?al.filter(a=>((ultimoAumento(a)||{}).desde||"")===v.slice(2)).map(a=>a.id):al.filter(a=>enClub(a,v)).map(a=>a.id)); openAumento(); break; }
    case "aumOk": await guardarAumento(b); break;
    case "pago": if(A){ const was=!!pago(A); if(await setPago(A,!was)) toast(was?`${A.nombre}: vuelve a deber`:`${A.nombre}: pagó ${money(montoMes(A))}`,()=>setPago(A,was)); } break;
    case "msg": if(A) openMensajes(A); break;
    case "copy": { const t=b.dataset.text; try{ await navigator.clipboard.writeText(t); toast("Mensaje copiado"); }catch(err){ const r=document.createRange(); const bub=b.closest(".msg")?.querySelector(".bubble"); if(bub){ r.selectNodeContents(bub); getSelection().removeAllRanges(); getSelection().addRange(r); toast("Texto seleccionado, copialo"); } } break; }
    case "recMas": if(A){ if(await setRec(A,1)){ toast(`${A.nombre}: +1 clase a recuperar (hasta el ${fechaDM(venceDe(hoyISO))})`); if($("#recQ")) openRecAdd($("#recQ").value); } } break;
    case "recAdd": openRecAdd(); break;
    case "libres": LIB.club=S.club||""; openLibres(); break;
    case "libClub": LIB.club=b.dataset.v; openLibres(); break;
    case "pagoNuevo": openPagoProfe(); break;
    case "verComp": if(A) verComprobante(A); break;
    case "catPick": elegirCat(b); break;
    case "catAlOk": if(A) await guardarCatAlumno(A); break;
    case "turnoCat": if(S.modo==="profe"&&b.dataset.club!=="JUMP") break; openTurnoCat(b.dataset.club,Number(b.dataset.dia),b.dataset.hora); break;
    case "turnoCatOk": guardarTurnoCat(b); break;
    case "compRech": if(A){ const c=compDe(A); if(c&&await setPago(A,false,true)){ closeSheet(); toast(`${A.nombre}: pago rechazado, le aparece para volver a mandarlo`); } } break;
    case "asCSV": exportAsist(); break;
    case "irAsist": S.asFecha=b.dataset.f; if(b.dataset.c) S.asClub=b.dataset.c; if(S.modo!=="profe") S.prevTab=S.tab; S.tab="asist"; render(); scrollTo(0,0); break;
    case "irHoras": S.horasFecha=b.dataset.f; S.tab="horas"; render(); setTimeout(()=>{ const el=document.querySelector('[data-act="hStep"]'); el&&el.scrollIntoView({block:"center"}); },50); break;
    case "telProfeSave": { const v=$("#telProfe").value.trim(); if(await safe(()=>S.db.doc("config/general").update({...S.cfg,telProfe:v}),"Teléfono guardado")){ S.cfg={...S.cfg,telProfe:v}; render(); } break; }
    case "verGastos": S.modo="profe"; S.tab="plata"; S.finMes=S.mes; S.asKey=null; render(); scrollTo(0,0); break;
    case "finNuevo": openFin(b.dataset.t); break;
    case "finCat": { fCat=b.dataset.c; document.querySelectorAll("#finCats .chip").forEach(x=>x.setAttribute("aria-pressed",x.dataset.c===fCat)); break; }
    case "finDel": { if(!b.classList.contains("armed")){ b.classList.add("armed"); b.textContent="¿Borrar?"; return; } S.fin=S.fin.filter(x=>x.id!==b.dataset.id); await saveFin(); break; }
    case "finMes": { const [y,mm]=S.finMes.split("-").map(Number); S.finMes=mesKey(new Date(y,mm-1+Number(b.dataset.d),1)); render(); break; }
    case "movDel": { if(!b.classList.contains("armed")){ b.classList.add("armed"); b.textContent="¿Borrar?"; return; } S.hMovs=S.hMovs.filter(x=>x.id!==b.dataset.id); render(); await guardarHorasDoc(); break; }
    case "pagoTodo": { $("#ppMonto").value=Math.max(0,saldoProfe().saldo); break; }
    case "vhSave": { const v=Number($("#vh2").value)||0; if(await safe(()=>S.db.doc("config/general").update({...S.cfg,valorHora:v}),`Valor por hora: ${money(v)}`)) render(); break; }
    case "objetivo": if(objMin()) setObjMin(false); else openObjetivo(); break;
    case "objPick": { $("#objIn").value=b.dataset.v; b.parentElement.querySelectorAll(".seg-b").forEach(x=>x.setAttribute("aria-pressed",x===b?"true":"false")); break; }
    case "objSave": { const v=Math.max(0,Math.round(Number($("#objIn").value)||0)); await guardarObjetivo(v); break; }
    case "objBorrar": await guardarObjetivo(0); break;
    case "pmDur":
    case "pmModo": { b.parentElement.querySelectorAll(".seg-b").forEach(x=>x.setAttribute("aria-pressed",x===b?"true":"false")); const f=$("#fA"); if(f) f.dispatchEvent(new Event("input")); break; }
    case "ajuste": if(A) openAjuste(A); break;
    case "ajStep": { const i=$("#ajMonto"); i.value=Math.max(0,(Number(i.value)||0)+Number(b.dataset.d)); ajPreview(); break; }
    case "ajReset": { const a=S.alumnos.find(x=>x.id===$("#fAj").dataset.id); $("#ajMonto").value=cuotaMes(a); $("#ajNota").value=""; ajPreview(); break; }
    case "valorSave": { const v=Number($("#vHora").value)||0; if(await safe(()=>S.db.doc("config/general").update({...S.cfg,valorHora:v}),"Valor por hora guardado")) render(); break; }
    case "aumSave": { const v=Math.round((S.cfg.valorHora||0)*(1+(Number($("#aumPct").value)||0)/100)); if(v&&await safe(()=>S.db.doc("config/general").update({...S.cfg,valorHora:v,ultimoAumento:hoyISO}),`Nuevo valor: ${money(v)} por hora`)) render(); break; }
    case "modoProfe": closeSheet(); { const e=S.equipo[0];  if(!e) toast("Esteban todavía no cargó horas: vas a ver la pantalla vacía."); } S.modo="profe"; S.tab="horas"; S.asKey=null; render(); scrollTo(0,0); break;
    case "modoOwner": S.modo="owner"; S.tab="hoy"; S.club=""; S.asClub="ESPACIO"; S.asKey=null; render(); break;
    case "hDia": { const d=isoDate(S.horasFecha); d.setDate(d.getDate()+Number(b.dataset.d)); if(toISO(d)<=hoyISO){ S.horasFecha=toISO(d); render(); } break; }
    case "hStep": await setHoras(S.horasFecha, Math.max(0,(S.horas[S.horasFecha]||0)+Number(b.dataset.d))); break;
    case "hSet": { S.horasFecha=b.dataset.f; render(); scrollTo(0,0); break; }
    case "hAuto": await setHoras(b.dataset.f||S.horasFecha, Number(b.dataset.n)); break;
    case "asClub": S.asClub=b.dataset.c; render(); break;
    case "charlaOk": if(A&&await safe(()=>colA().doc(A.id).update({charlaOk:true}))){ A.charlaOk=true; render(); } break;
    case "asVista": S.asVista=b.dataset.v; if(S.asVista!=="dia") rgCargar(true); render(); scrollTo(0,0); break;
    case "rgMes": { const [y,m]=RG.mes.split("-").map(Number); const d=new Date(y,m-1+Number(b.dataset.d),1); const k=mesKey(d); if(k>mesKey(now)) break; RG.mes=k; RG.as=[]; RG.av=[]; rgCargar(true); render(); break; }
    case "rgClub": RG.club=b.dataset.v; render(); break;
    case "rgRe": rgCargar(true); render(); break;
    case "asDia": { const d=isoDate(S.asFecha); d.setDate(d.getDate()+Number(b.dataset.d)); S.asFecha=toISO(d); render(); break; }
    case "asHoy": S.asFecha=hoyISO; render(); break;
    case "marca": if(A) await marcar(A,b.dataset.hora,b.dataset.e); break;
    case "asRecAdd": openAsRecAdd(b.dataset.hora); break;
    case "asTodos": { const h=b.dataset.hora; const t=turnos(S.asClub).find(x=>x.dia===isoDate(S.asFecha).getDay()&&x.hora===h); if(!t) break; const E=asistEstado(t); let n=0;
      E.marcar.forEach(a=>{ const k=`${a.id}|${h}`; if(!S.asMarcas[k]){ S.asMarcas[k]="vino"; n++; } });
      E.recs.forEach(a=>{ const k=`${a.id}|${h}`; if(!S.asMarcas[k]){ S.asMarcas[k]="recuperando"; n++; } });
      render(); if(n&&await guardarAsist()) toast(`${n} presente${n===1?"":"s"} a las ${h}. Si alguno faltó, tocá ✗.`); break; }
    case "asOpen": { S.asOpen=S.asOpen||new Set(); const k=b.dataset.k; if(S.asOpen.has(k)) S.asOpen.delete(k); else S.asOpen.add(k); render(); break; }
    case "asAbrir": { S.asAbrir=S.asAbrir||new Set(); S.asAbrir.add(`${b.dataset.id}|${b.dataset.hora}`); render(); break; }
    case "asRecNo": if(A){ const k=`${A.id}|${b.dataset.hora}`; if(S.asMarcas[k]==="falto") delete S.asMarcas[k]; else S.asMarcas[k]="falto"; render(); if(await guardarAsist()&&S.asMarcas[k]){ toast(`${A.nombre} no vino a recuperar: pierde esa clase`); avisarDueno(`${nomProfe()}: ${A.nombre} no vino a recuperar`,`${diaTxt(S.asFecha)} ${b.dataset.hora} · ${S.asClub==="ESPACIO"?"Espacio":"Jump"}`); } } break;
    case "asLluvia": await lluviaTurno(S.asClub,S.asFecha,b.dataset.hora); break;
    case "lluvia": await openLluvia(b.dataset.f||hoyISO,"lluvia"); break;
    case "suspender": await openLluvia(b.dataset.f||hoyISO,"sin"); break;
    case "llClub": LL.club=b.dataset.v; llSelTodo(); pintarLluvia(); break;
    case "llMot": LL.motivo=b.dataset.v; pintarLluvia(); break;
    case "llOk": await confirmarLluvia(b); break;
    case "asRecSel": if(A){ S.asMarcas[`${A.id}|${b.dataset.hora}`]="recuperando"; closeSheet(); if(await guardarAsist()){ await setRec(A,-1); toast(`${A.nombre} recupera hoy`); avisarDueno(`${nomProfe()} sumó a ${A.nombre} a recuperar`,`${diaTxt(S.asFecha)} ${b.dataset.hora} · ${S.asClub==="ESPACIO"?"Espacio":"Jump"} · se le descontó la clase`); } } break;
    case "asRecQuitar": if(A){ delete S.asMarcas[`${A.id}|${b.dataset.hora}`]; render(); if(await guardarAsist()&&!avisoApp(A.id,S.asFecha,b.dataset.hora,"recupera")) await setRec(A,1,S.asFecha); } break;
    case "recMenos": if(A){ const prev=recPrev(A); if(await setRec(A,-1)) toast(`${A.nombre}: recuperó una clase`,()=>recVolver(A,prev)); } break;
    case "recTurno": closeSheet(); await lluviaTurno(b.dataset.club,b.dataset.f||hoyISO,b.dataset.hora); break;
    case "lluvia": openLluvia(b.dataset.club,Number(b.dataset.dia),b.dataset.hora,b.dataset.f||hoyISO); break;
    case "stepRec": { const el=$("#aRec"); el.textContent=Math.max(0,Number(el.textContent)+Number(b.dataset.d)); break; }
    case "editA": if(A&&S.modo!=="profe"){ formAlumno(A); cargarHist(A); } else if(A&&clubsDe(A).has("JUMP")) openCatAlumno(A); break;
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
let tBusca=0; document.addEventListener("input",e=>{ if(!window.MODO_STAFF) return; if(e.target.id==="q"){ S.q=e.target.value; clearTimeout(tBusca); tBusca=setTimeout(render,180); } if(e.target.id==="recQ"){ openRecAdd(e.target.value); } if(e.target.id==="rgQ"){ RG.q=e.target.value; rgFiltrar(); } });
document.addEventListener("submit",async e=>{
  if(!window.MODO_STAFF) return;
  e.preventDefault(); const f=e.target;
  if(f.id==="fA"){
    const horarios=[...f.querySelectorAll(".hrow")].map(r=>{const h={dia:Number(r.querySelector(".hd").value),hora:r.querySelector("input").value,club:r.querySelector(".hc").value}; if(r.dataset.nivel) h.nivel=r.dataset.nivel; { const pa=S.alumnos.find(x=>x.id===f.dataset.id); const ph=pa&&(pa.horarios||[]).find(x=>x.dia===h.dia&&x.hora===h.hora&&clubH(pa,x)===h.club); if(ph&&ph.desde&&ph.desde>hoyISO.slice(0,8)+"01") h.desde=ph.desde; } return h;}).filter(h=>h.hora);
    const data={nombre:$("#aNom").value.trim(),club:$("#aClub").value,tel:$("#aTel").value.trim(),categoria:$("#aCat").value.trim(),precioClase:Number($("#aPrecio").value)||0,horarios,notas:$("#aNota").value.trim()};
    const prevA=S.alumnos.find(x=>x.id===f.dataset.id)||{}; const pendA=prevA.id?recPendAvisos(prevA):[];
    { const el=$("#aRec"); const dRec=(Number(el.textContent)||0)-(Number(el.dataset.orig)||0); if(dRec) Object.assign(data,recCambio(prevA,dRec)); }
    if(!data.nombre) return;
    const id=f.dataset.id,lead=f.dataset.lead;
    if(id&&$("#aIni")){ const pm=planGuardado(prevA); const ini=$("#aIni").value||prevA.inicio; const pv=Number(($("#aPromo")||{}).value)||0; const modo=(f.querySelector('[data-act="pmModo"][aria-pressed="true"]')||{}).dataset.m||"este"; const dur=Number((f.querySelector('[data-act="pmDur"][aria-pressed="true"]')||{dataset:{n:1}}).dataset.n)||1;
      if(pm&&(ini!==pm.ini||pv!==pm.promo||modo!==pm.modo||(pv&&dur!==pm.dur)||data.precioClase!==prevA.precioClase||JSON.stringify(data.horarios)!==JSON.stringify(prevA.horarios))&&data.horarios.length&&(data.precioClase||pv)){
        const viejo=planPrimerMes(prevA,pm.ini,pm.promo,pm.modo,pm.dur).pagos, nuevo=planPrimerMes(data,ini,pv,modo,dur).pagos, pagos={...(prevA.pagos||{})};
        Object.keys(viejo).forEach(m=>{ if(!pagoReal(pagos[m])) delete pagos[m]; });
        Object.keys(nuevo).forEach(m=>{ if(!pagoReal(pagos[m])) pagos[m]=nuevo[m]; });
        data.pagos=pagos; data.inicio=ini; data.promo=pv?{precioClase:pv,meses:dur,modo,hasta:Object.keys(nuevo).sort().pop()}:{modo}; }
      else if(!pm&&ini&&ini!==$("#aIni").dataset.orig&&data.horarios.length&&(data.precioClase||pv)){
        const nuevo=planPrimerMes(data,ini,pv,modo,dur).pagos, pagos={...(prevA.pagos||{})};
        Object.keys(nuevo).forEach(m=>{ if(!pagoReal(pagos[m])) pagos[m]=nuevo[m]; });
        data.pagos=pagos; data.inicio=ini; data.promo=pv?{precioClase:pv,meses:dur,modo,hasta:Object.keys(nuevo).sort().pop()}:{modo}; } }
    { const i2=$("#aIni2"); if(id&&i2){ const ant=i2.dataset.ant==="1"; if(ant&&!prevA.antiguo) data.antiguo=true; else if(!ant&&i2.value&&(i2.value!==i2.dataset.orig||prevA.antiguo)){ data.inicio=i2.value; data.antiguo=false; if(!prevA.promo) data.inicioManual=true; } } }
    if(id){ data.activo=$("#aAct").checked; if(await safe(async()=>{ const bt=S.db.batch(); bt.update(colA().doc(id),data); pendA.forEach(v=>bt.update(S.db.doc("avisos/"+v.id),{contado:true})); await bt.commit(); },"Guardado")) closeSheet(); }
    else { data.activo=true; data.tipo="Grupal"; data.pagos={}; data.alta=hoyISO;
      { const ini=($("#aIni")||{}).value||hoyISO; const pv=Number(($("#aPromo")||{}).value)||0; const modo=(f.querySelector('[data-act="pmModo"][aria-pressed="true"]')||{}).dataset.m||"este";
        data.inicio=ini; if(data.horarios.length&&(data.precioClase||pv)){ const dur=Number((f.querySelector('[data-act="pmDur"][aria-pressed="true"]')||{dataset:{n:1}}).dataset.n)||1; const pl=planPrimerMes(data,ini,pv,modo,dur); data.pagos=pl.pagos; data.promo=pv?{precioClase:pv,meses:dur,modo,hasta:Object.keys(pl.pagos).sort().pop()}:{modo}; } }
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
    if(await safe(()=>S.db.doc("config/general").update({...S.cfg,...data}),"Guardado")) closeSheet();
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
