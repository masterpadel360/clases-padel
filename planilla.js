/* ---------- Planilla de horarios: toda la semana de un club en un cuadro (días en columnas, horarios en filas) ----------
   Sirve para ver de un vistazo quién está solo y a quién se puede juntar. En cada celda: la categoría del turno y los alumnos,
   cada uno con su propia categoría. Tocar un nombre abre su ficha (y al cerrarla, la planilla sigue ahí y se actualiza). */
(function () {
  const PL = { open: false, club: "JUMP", cat: "", last: "" };
  const css = `
#planilla{position:fixed;inset:0;z-index:19;background:#F4F0E8;color:#1D1916;display:flex;flex-direction:column;font-family:var(--f-body,system-ui,sans-serif)}
#planilla[hidden]{display:none}
#planilla>*{flex:none}
#planilla>.plh-wrap{flex:1 1 auto;min-height:0}
#planilla .plh-hd{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 12px) 14px 10px;background:#1F3D30;color:#F4F0E8}
#planilla .plh-hd h2{margin:0;font-size:19px;font-weight:700;flex:1}
#planilla .plh-x{border:0;background:rgba(255,255,255,.14);color:inherit;width:38px;height:38px;border-radius:50%;font-size:20px;line-height:1}
#planilla .plh-bar{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding:8px 14px 2px;align-items:center}
#planilla .plh-bar button{flex:none}
#planilla .plh-bar button{border:1px solid rgba(31,61,48,.25);background:#fff;color:#1F3D30;border-radius:999px;padding:7px 12px;font-size:13px;font-weight:600;line-height:1.2;min-height:34px;white-space:nowrap}
#planilla .plh-bar button[aria-pressed="true"]{background:#1F3D30;color:#F4F0E8;border-color:#1F3D30}
#planilla .plh-res{padding:2px 14px 8px;font-size:12.5px;color:#6E645C}
#planilla .plh-res b{color:#B5532F}
#planilla .plh-fil{margin-top:-4px;color:#1F3D30}
#planilla .plh-fil b{color:#1F3D30}
#planilla .plh-bar button small{opacity:.65;font-weight:500;margin-left:2px}
#planilla td.vac .plh-ct{color:#A79C8F}
#planilla .plh-wrap{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:0 0 calc(env(safe-area-inset-bottom,0px) + 16px)}
#planilla table{border-collapse:separate;border-spacing:0;min-width:100%;font-size:12.5px}
#planilla th,#planilla td{border-right:1px solid #DDD5C8;border-bottom:1px solid #DDD5C8;vertical-align:top;text-align:left}
#planilla thead th{position:sticky;top:0;z-index:2;background:#E9E2D5;padding:8px;font-weight:700;min-width:112px}
#planilla th.plh-h{position:sticky;left:0;z-index:1;background:#E9E2D5;padding:8px 6px;font-weight:700;font-variant-numeric:tabular-nums;min-width:44px;font-size:12px}
#planilla thead th.plh-h{z-index:3}
#planilla td{background:#fff;padding:5px;min-width:112px}
#planilla td.vac{background:#F8F5EF;color:#A79C8F}
#planilla td.solo{background:#FFF1E2}
#planilla td.full{background:#EEF5EF}
#planilla td.dim{opacity:.28}
#planilla .plh-ct{display:flex;justify-content:space-between;gap:6px;margin-bottom:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#1F3D30}
#planilla .plh-ct span:last-child{color:#6E645C}
#planilla td.solo .plh-ct span:last-child{color:#B5532F}
#planilla .plh-al{display:block;width:100%;border:0;background:transparent;text-align:left;padding:3px 0;font-size:12.5px;font-weight:500;line-height:1.3;color:#1D1916}
#planilla .plh-al small{color:#6E645C;font-size:11px}
#planilla .plh-al small.sin{color:#B44E22}
#planilla .plh-al.hl{background:#FFE9A8;border-radius:6px}
#planilla .plh-ley{display:flex;gap:12px;flex-wrap:wrap;padding:0 14px 8px;font-size:11.5px;color:#6E645C}
#planilla .plh-ley i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:4px;vertical-align:-1px;border:1px solid #DDD5C8}
@media (max-height:500px){#planilla .plh-ley{display:none}#planilla .plh-hd{padding-top:calc(env(safe-area-inset-top,0px) + 6px);padding-bottom:6px}#planilla .plh-hd h2{font-size:16px}#planilla .plh-x{width:32px;height:32px}#planilla .plh-res{padding-bottom:4px}}`;

  const capW = s => { const n = catNorm(s); const hit = CATS_AL.find(c => catNorm(c) === n); return hit || String(s || "").trim().replace(/^./, c => c.toUpperCase()); };

  function celdas() {
    const ts = turnosGrilla(PL.club).filter(t => t.club === PL.club);
    const dias = [1, 2, 3, 4, 5, 6, 0].filter(d => d >= 1 && d <= 5 || ts.some(t => t.dia === d && t.al.length));
    const horas = [...new Set(ts.map(t => t.hora))].sort();
    const map = {}; ts.forEach(t => map[t.dia + "|" + t.hora] = t);
    return { dias, horas, map, ts };
  }

  function pintar() {
    const box = document.getElementById("planilla"); if (!box || !PL.open) return;
    const { dias, horas, map, ts } = celdas();
    const cats = [...new Set(S.alumnos.filter(a => a.activo !== false).map(a => catNorm(a.categoria)).filter(Boolean))];
    const orden = CATS_AL.map(c => catNorm(c)); cats.sort((a, b) => (orden.indexOf(a) + 1 || 99) - (orden.indexOf(b) + 1 || 99));
    const conGente = ts.filter(t => t.al.length);
    const solos = conGente.filter(t => t.al.length === 1).length;
    // Filtro por categoría: queda encendido solo el turno donde hay al menos un alumno de esa categoría.
    const matchCat = t => !PL.cat || t.al.some(a => catNorm(a.categoria) === PL.cat);
    const alDe = c => new Set(conGente.flatMap(t => t.al.filter(a => catNorm(a.categoria) === c).map(a => a.id)));
    const filtro = PL.cat ? (() => { const tc = conGente.filter(matchCat); return `<p class="plh-res plh-fil">${alDe(PL.cat).size} de ${esc(capW(PL.cat))} repartidos en <b>${tc.length} turno${tc.length === 1 ? "" : "s"}</b>${tc.filter(t => t.al.length === 1).length ? ` · ${tc.filter(t => t.al.length === 1).length} solos en su turno` : ""}</p>`; })() : "";
    const scroll = box.querySelector(".plh-wrap"); const sx = scroll ? scroll.scrollLeft : 0, sy = scroll ? scroll.scrollTop : 0;
    const html = `
      <div class="plh-hd"><h2>Planilla de horarios</h2><button type="button" class="plh-x" data-pl="cerrar" aria-label="Cerrar">×</button></div>
      <div class="plh-bar">${["JUMP", "ESPACIO"].map(c => `<button type="button" data-pl="club" data-v="${c}" aria-pressed="${PL.club === c}">${CLUB_LBL[c]}</button>`).join("")}</div>
      <div class="plh-bar"><button type="button" data-pl="cat" data-v="" aria-pressed="${!PL.cat}">Todas</button>${cats.map(c => { const k = alDe(c).size; return `<button type="button" data-pl="cat" data-v="${esc(c)}" aria-pressed="${PL.cat === c}"${k ? "" : ' disabled style="opacity:.4"'}>${esc(capW(c))} <small>${k}</small></button>`; }).join("")}</div>
      <p class="plh-res">${conGente.length} turnos con gente · <b>${solos} con un solo alumno</b> · ${conGente.reduce((s, t) => s + t.al.length, 0)} lugares ocupados</p>${filtro}
      <div class="plh-ley"><span><i style="background:#FFF1E2"></i>Solo 1 alumno</span><span><i style="background:#EEF5EF"></i>Completo (${CUPO})</span><span><i style="background:#F8F5EF"></i>Vacío</span><span>Tocá un nombre para abrir su ficha</span></div>
      <div class="plh-wrap"><table>
        <thead><tr><th class="plh-h"></th>${dias.map(d => `<th>${DIAS_LARGO[d]}</th>`).join("")}</tr></thead>
        <tbody>${horas.map(h => `<tr><th class="plh-h">${h}</th>${dias.map(d => {
          const t = map[d + "|" + h];
          if (!t) return `<td class="vac${PL.cat ? " dim" : ""}"></td>`;
          if (!t.al.length) return `<td class="vac${PL.cat ? " dim" : ""}"><div class="plh-ct"><span>${t.nivel ? esc(nivelTxt(t.nivel)) : "Vacío"}</span><span>0/${CUPO}</span></div></td>`;
          const n = t.al.length, cls = [n === 1 ? "solo" : n >= CUPO ? "full" : "", matchCat(t) ? "" : "dim"].join(" ").trim();
          const al = t.al.slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
          return `<td class="${cls}"><div class="plh-ct"><span>${t.nivel ? esc(nivelTxt(t.nivel)) : "Sin categoría"}</span><span>${n}/${CUPO}</span></div>${al.map(a => {
            const c = catNorm(a.categoria);
            return `<button type="button" class="plh-al${PL.cat && c === PL.cat ? " hl" : ""}" data-act="editA" data-id="${a.id}">${esc(a.nombre)} <small class="${c ? "" : "sin"}">· ${c ? esc(capW(a.categoria)) : "sin categoría"}</small></button>`; }).join("")}</td>`;
        }).join("")}</tr>`).join("")}</tbody>
      </table></div>`;
    // Si no cambió nada, no se toca la pantalla: la app redibuja seguido (cada vez que llegan datos) y reemplazar los botones mientras los tocás hace que el toque se pierda.
    if (html === PL.last) return; PL.last = html; box.innerHTML = html;
    const w = box.querySelector(".plh-wrap"); if (w) { w.scrollLeft = sx; w.scrollTop = sy; }
  }

  window.abrirPlanilla = function (club) {
    if (!document.getElementById("plCss")) { const st = document.createElement("style"); st.id = "plCss"; st.textContent = css; document.head.appendChild(st); }
    let box = document.getElementById("planilla");
    if (!box) { box = document.createElement("div"); box.id = "planilla"; box.setAttribute("role", "dialog"); document.body.appendChild(box); }
    PL.open = true; PL.club = club || S.semClub || (S.club === "ESPACIO" ? "ESPACIO" : "JUMP"); box.hidden = false;
    document.documentElement.style.overflow = "hidden"; pintar();
  };
  function cerrar() { PL.open = false; PL.last = ""; const box = document.getElementById("planilla"); if (box) { box.hidden = true; box.innerHTML = ""; } document.documentElement.style.overflow = ""; }

  document.addEventListener("click", e => {
    const ab = e.target.closest("[data-pl-abrir]");
    if (ab) { if (!document.getElementById("overlay").hidden) closeSheet(); abrirPlanilla(ab.dataset.plAbrir || ""); return; }
    const b = e.target.closest("[data-pl]"); if (!b || !PL.open) return;
    const k = b.dataset.pl;
    if (k === "cerrar") cerrar();
    else if (k === "club") { PL.club = b.dataset.v; pintar(); }
    else if (k === "cat") { PL.cat = b.dataset.v; pintar(); }
  });

  // Cuando cambian los datos (o cerrás la ficha de un alumno), la planilla se redibuja sola.
  if (typeof render === "function") { const r0 = render; render = function () { const out = r0.apply(this, arguments); if (PL.open) pintar(); return out; }; }
})();
