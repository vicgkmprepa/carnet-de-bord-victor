import { mondayOf, addDaysStr, timeToMinutes, JOURS, dayKeyOf } from "./scheduleUtils.js";
import { colleHoraires, colleTerminee } from "./colleUtils.js";

// Une entrée = du temps de travail perso réellement effectué : soit un créneau
// récurrent "travail" marqué réalisé une semaine donnée, soit une session
// ponctuelle, soit une colle terminée (préparation + passage, cf. colleUtils).
// Les cours ne comptent jamais (cf. store.js). "Général" (tâches/temps
// non rattachés à une matière précise) est exclu de toutes les statistiques par
// matière — il n'a pas sa place dans les graphiques ni les comparaisons.

// Les créneaux récurrents réalisés, les sessions ponctuelles réalisées et les
// colles terminées, avec leurs horaires en minutes — matière première avant
// dédoublonnage des chevauchements (ex. une colle 16h30-17h pendant un créneau
// HGG 16h-17h ne doit pas compter 1h30 mais 1h).
function entreesBrutes(data) {
  const items = [];
  const creneauxTravail = data.emploi_du_temps.creneaux.filter((c) => c.type === "travail");
  const creneauxById = new Map(creneauxTravail.map((c) => [c.id, c]));
  for (const s of data.seances) {
    if (s.statut !== "realise") continue;
    const c = creneauxById.get(s.creneauId);
    if (!c) continue;
    const matiere = s.matiereReelle || c.matiere;
    if (matiere === "Général") continue;
    const jourIndex = JOURS.findIndex((j) => j.key === c.jour);
    if (jourIndex === -1) continue;
    items.push({
      date: addDaysStr(s.semaine, jourIndex),
      matiere,
      debut: timeToMinutes(c.debut),
      fin: timeToMinutes(c.fin),
    });
  }
  for (const s of data.sessions_ponctuelles) {
    if (s.statut !== "realise" || s.matiere === "Général" || s.estCours) continue;
    items.push({ date: s.date, matiere: s.matiere, debut: timeToMinutes(s.debut), fin: timeToMinutes(s.fin) });
  }
  for (const k of data.colles || []) {
    if (!k.matiere || k.matiere === "Général" || k.annulee || !colleTerminee(k)) continue;
    const h = colleHoraires(k);
    items.push({ date: k.date, matiere: k.matiere, debut: timeToMinutes(h.debutPrepa), fin: timeToMinutes(h.finColle) });
  }
  return items;
}

// Fusionne les créneaux qui se chevauchent sur une même plage horaire : le
// premier (par heure de début) garde ses minutes, les suivants ne comptent que
// la portion non déjà couverte — deux événements sur le même créneau ne doivent
// pas compter double dans le temps de travail.
function dedupeChevauchements(items) {
  const sorted = [...items].sort((a, b) => a.debut - b.debut || a.fin - b.fin);
  let couvertJusqua = -Infinity;
  const out = [];
  for (const it of sorted) {
    const debutEffectif = Math.max(it.debut, couvertJusqua);
    const minutes = Math.max(0, it.fin - debutEffectif);
    if (it.fin > couvertJusqua) couvertJusqua = it.fin;
    if (minutes > 0) out.push({ date: it.date, matiere: it.matiere, minutes });
  }
  return out;
}

// Les créneaux/sessions/colles réalisés, dédoublonnés par date — la liste
// complète de "temps de travail" avec date exacte.
export function dailyEntries(data) {
  const parDate = new Map();
  for (const it of entreesBrutes(data)) {
    if (!parDate.has(it.date)) parDate.set(it.date, []);
    parDate.get(it.date).push(it);
  }
  const entries = [];
  for (const items of parDate.values()) entries.push(...dedupeChevauchements(items));
  return entries;
}

// Une entrée par (semaine, matière) — dérivé de dailyEntries pour bénéficier du
// même dédoublonnage des chevauchements.
export function workEntries(data) {
  return dailyEntries(data).map((e) => ({ semaine: mondayOf(e.date), matiere: e.matiere, minutes: e.minutes }));
}

// Minutes réalisées par matière sur un ensemble de dates données, dédoublonnées —
// à utiliser à la place d'une somme manuelle "créneaux + sessions + colles" dès
// qu'un écran a besoin d'un total réalisé (jour, semaine...).
export function minutesRealiseesParMatiere(data, dates) {
  const datesSet = new Set(dates);
  const out = {};
  for (const e of dailyEntries(data)) {
    if (!datesSet.has(e.date)) continue;
    out[e.matiere] = (out[e.matiere] || 0) + e.minutes;
  }
  return out;
}

// Une ligne par semaine ayant eu au moins une minute de travail, triées du plus
// ancien au plus récent.
export function weeklySeries(data) {
  const byWeek = new Map();
  for (const e of workEntries(data)) {
    if (!byWeek.has(e.semaine)) byWeek.set(e.semaine, {});
    const bucket = byWeek.get(e.semaine);
    bucket[e.matiere] = (bucket[e.matiere] || 0) + e.minutes;
  }
  return [...byWeek.entries()]
    .map(([semaine, byMatiere]) => ({ semaine, byMatiere, total: Object.values(byMatiere).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => a.semaine.localeCompare(b.semaine));
}

// Une ligne par mois (YYYY-MM) — attribution jour par jour (via dailyEntries),
// pas semaine par semaine : une semaine à cheval sur deux mois doit répartir ses
// minutes sur les deux mois concernés, pas tout compter sur le mois du lundi.
export function monthlySeries(data) {
  const byMonth = new Map();
  for (const e of dailyEntries(data)) {
    const month = e.date.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, {});
    const bucket = byMonth.get(month);
    bucket[e.matiere] = (bucket[e.matiere] || 0) + e.minutes;
  }
  return [...byMonth.entries()]
    .map(([month, byMatiere]) => ({ month, byMatiere, total: Object.values(byMatiere).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// Le détail jour par jour (Lundi..Dimanche) d'une semaine donnée (lundi = monday) —
// contrairement à weeklySeries, on a besoin de la date exacte de chaque créneau
// récurrent (déduite de son jour + de la semaine), pas seulement de la semaine.
export function dailySeriesForWeek(data, monday) {
  const dates = JOURS.map((_, i) => addDaysStr(monday, i));
  const datesSet = new Set(dates);
  const byDate = {};
  const add = (date, matiere, minutes) => {
    if (matiere === "Général") return;
    if (!byDate[date]) byDate[date] = {};
    byDate[date][matiere] = (byDate[date][matiere] || 0) + minutes;
  };
  for (const e of dailyEntries(data)) if (datesSet.has(e.date)) add(e.date, e.matiere, e.minutes);
  return JOURS.map((j, i) => {
    const date = addDaysStr(monday, i);
    const byMatiere = byDate[date] || {};
    return { date, jour: j, byMatiere, total: Object.values(byMatiere).reduce((a, b) => a + b, 0) };
  });
}

// Le détail jour par jour en fenêtre glissante (les nbJours derniers jours se
// terminant à endDate inclus).
export function dailySeriesRolling(data, endDate, nbJours = 7) {
  const dates = [];
  for (let i = nbJours - 1; i >= 0; i--) dates.push(addDaysStr(endDate, -i));
  const datesSet = new Set(dates);

  const byDate = {};
  const add = (date, matiere, minutes) => {
    if (matiere === "Général") return;
    if (!byDate[date]) byDate[date] = {};
    byDate[date][matiere] = (byDate[date][matiere] || 0) + minutes;
  };
  for (const e of dailyEntries(data)) if (datesSet.has(e.date)) add(e.date, e.matiere, e.minutes);

  return dates.map((date) => {
    const j = JOURS.find((jj) => jj.key === dayKeyOf(date));
    const numeroJour = Number(date.slice(8, 10));
    const byMatiere = byDate[date] || {};
    return {
      date,
      jour: { ...j, label: `${j.label} ${numeroJour}` },
      byMatiere,
      total: Object.values(byMatiere).reduce((a, b) => a + b, 0),
    };
  });
}

// Total d'une semaine tronqué à ses `nbJours` premiers jours (lundi = jour 1) —
// sert à comparer une semaine en cours à "la même portion" de la semaine
// précédente plutôt qu'à sa totalité (ex. lundi-mercredi vs lundi-mercredi),
// sans quoi la semaine précédente, complète, paraîtrait toujours en avance.
export function partialWeekTotals(data, monday, nbJours) {
  const byMatiere = {};
  for (const d of dailySeriesForWeek(data, monday).slice(0, nbJours)) {
    for (const [matiere, minutes] of Object.entries(d.byMatiere)) {
      byMatiere[matiere] = (byMatiere[matiere] || 0) + minutes;
    }
  }
  return { semaine: monday, byMatiere, total: Object.values(byMatiere).reduce((a, b) => a + b, 0) };
}

// Toutes les matières apparues dans la série, dans l'ordre SUBJECT_TABS puis
// "Général" — pour un ordre de légende/empilement stable d'un graphique à l'autre.
export function matieresPresentes(series, subjectTabs) {
  const seen = new Set();
  for (const row of series) for (const m of Object.keys(row.byMatiere)) seen.add(m);
  const ordered = subjectTabs.map((t) => t.key).filter((k) => seen.has(k));
  if (seen.has("Général")) ordered.push("Général");
  for (const m of seen) if (!ordered.includes(m)) ordered.push(m);
  return ordered;
}
