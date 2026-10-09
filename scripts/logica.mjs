// Reglas de las clases para recuperar y de los turnos. Las usa notificar.mjs (y se pueden probar sin Firebase).
// Las fechas son textos "AAAA-MM-DD" en hora de Córdoba.

const pad = n => String(n).padStart(2, "0");
export const fechaISO = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
export const partes = f => f.split("-").map(Number);
export const sumarDias = (f, n) => { const [y, m, d] = partes(f); return fechaISO(y, m, d + n); };
export const diaSemana = f => { const [y, m, d] = partes(f); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

// Se recupera dentro del mes. Si faltó en la última semana del mes, hasta el 7 del mes siguiente.
// Las clases son de lunes a viernes: si cae sábado o domingo, vence el viernes anterior.
export function habil(f) { while ([0, 6].includes(diaSemana(f))) f = sumarDias(f, -1); return f; }
export function venceDe(f) {
  const [y, m, d] = partes(f); const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return habil(ultimo - d < 7 ? fechaISO(y, m + 1, 7) : fechaISO(y, m, ultimo));
}

// Ordena las clases para recuperar según cuándo vencen.
// a.recuperar = cuántas tiene (lo que manda). a.recVence = {"AAAA-MM-DD": cantidad}.
// pend = fechas de faltas avisadas por la app que todavía no están en recVence (ya sumadas en "recuperar").
// Devuelve { recVence, recuperar } solo con las vigentes (las vencidas se pierden).
export function normalizar(a, hoy, pend = []) {
  const tot = Math.max(0, Number(a.recuperar) || 0); const m = {};
  Object.entries(a.recVence || {}).forEach(([k, n]) => { n = Number(n) || 0; if (n > 0) { k = habil(k); m[k] = (m[k] || 0) + n; } });
  pend.forEach(f => { const k = venceDe(f); m[k] = (m[k] || 0) + 1; });
  const sum = Object.values(m).reduce((s, n) => s + n, 0);
  if (tot > sum) { const k = venceDe(hoy); m[k] = (m[k] || 0) + tot - sum; }
  else if (tot < sum) { let r = sum - tot; for (const k of Object.keys(m).sort()) { const q = Math.min(r, m[k]); m[k] -= q; r -= q; if (!m[k]) delete m[k]; if (!r) break; } }
  const out = {}; Object.keys(m).filter(k => k >= hoy).sort().forEach(k => { out[k] = m[k]; });
  return { recVence: out, recuperar: Object.values(out).reduce((s, n) => s + n, 0) };
}
export const igualRec = (a, b) => (Number(a.recuperar) || 0) === b.recuperar && JSON.stringify(Object.fromEntries(Object.entries(a.recVence || {}).filter(([, n]) => n > 0).sort())) === JSON.stringify(b.recVence);

export const catNorm = c => String(c || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^iniciales$/, "inicial");
export function catsDe(a) { const s = new Set(); String(a.categoria || "").split(",").map(catNorm).filter(Boolean).forEach(c => s.add(c)); (a.horarios || []).forEach(h => h.nivel && s.add(catNorm(h.nivel))); return s; }
export const clubH = (a, h) => (h && h.club) || a.club || "JUMP";
export const clubsDe = a => { const s = new Set((a.horarios || []).map(h => clubH(a, h))); if (!s.size && a.club) s.add(a.club); return s; };
export const hhmm = h => String(h || "").replace(":", "");
export const masUnaHora = h => { const [hh, mm] = h.split(":").map(Number); return hh >= 23 ? null : `${pad(hh + 1)}:${pad(mm)}`; };

// Clases de un alumno en una fecha (fijas + recuperaciones reservadas), sin las que avisó que no va.
export function clasesDelDia(a, f, avisos) {
  const dow = diaSemana(f); const mios = avisos.filter(v => v.alumnoId === a.id && v.fecha === f);
  const tiene = (tipo, hora) => mios.some(v => v.tipo === tipo && v.hora === hora);
  const out = (a.horarios || []).filter(h => h.dia === dow).map(h => ({ hora: h.hora, club: clubH(a, h), tipo: "fija" }));
  mios.filter(v => v.tipo === "recupera" && !out.some(c => c.hora === v.hora)).forEach(v => out.push({ hora: v.hora, club: v.club, tipo: "recupera" }));
  // Avisó que no va (y no volvió atrás) → no cuenta.
  return out.filter(c => !(tiene("ausencia", c.hora) && !(c.tipo === "fija" && tiene("recupera", c.hora))));
}

// Lugares libres en un turno de una fecha. turnos = publico/turnos.t ; cupos = {id: {aus, rec}}.
export function libres(turnos, cupos, cupo, club, f, hora) {
  const t = turnos[`${club}|${diaSemana(f)}|${hora}`]; if (!t) return 0;
  const c = cupos[`${club}_${f}_${hhmm(hora)}`] || {};
  return cupo - (t.n || 0) + (c.aus || 0) - (c.rec || 0);
}

// Turnos de ese día donde el alumno puede recuperar: sus clubes, su categoría, con lugar, que no sean los suyos.
export function opcionesDelDia(a, f, turnos, cupos, cupo, avisos, desdeMs) {
  const dow = diaSemana(f); const cats = catsDe(a); const cl = clubsDe(a);
  const mios = new Set((a.horarios || []).map(h => `${clubH(a, h)}|${h.dia}|${h.hora}`));
  const out = [];
  Object.entries(turnos).forEach(([k, t]) => {
    const [club, dia, hora] = k.split("|");
    if (!cl.has(club) || Number(dia) !== dow || mios.has(k)) return;
    if (cats.size && !(t.nivel && cats.has(catNorm(t.nivel)))) return;
    if (new Date(`${f}T${hora}:00-03:00`).getTime() < desdeMs) return;
    if (avisos.some(v => v.alumnoId === a.id && v.tipo === "recupera" && v.fecha === f && v.hora === hora)) return;
    const n = libres(turnos, cupos, cupo, club, f, hora); if (n > 0) out.push({ club, hora, libres: n });
  });
  return out.sort((x, y) => x.hora.localeCompare(y.hora));
}
