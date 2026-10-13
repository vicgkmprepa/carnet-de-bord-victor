import { mondayOf, addDaysStr, durationMinutes, JOURS, dayKeyOf } from "./scheduleUtils.js";
import { collesRealisees } from "./colleUtils.js";

// Une entrée = du temps de travail perso réellement effectué : soit un créneau
// récurrent "travail" marqué réalisé une semaine donnée, soit une session
// ponctuelle, soit une colle terminée (préparation + passage, cf. colleUtils).
// Les cours ne comptent jamais (cf. store.js). "Général" (tâches/temps
// non rattachés à une matière précise) est exclu de toutes les statistiques par
// matière — il n'a pas sa place dans les graphiques ni les comparaisons.
export function workEntries(data) {
  const entries = [];
  const creneauxTravail = data.emploi_du_temps.creneaux.filter((c) => c.type === "travail");
  const creneauxById = new Map(creneauxTravail.map((c) => [c.id, c]));
  for (const s of data.seances) {
    if (s.statut !== "realise") continue;
    const c = creneauxById.get(s.creneauId);
    if (!c) continue;
    const matiere = s.matiereReelle || c.matiere;
    if (matiere === "Général") continue;
    entries.push({ semaine: s.semaine, matiere, minutes: durationMinutes(c.debut, c.fin) });
  }
  for (const s of data.sessions_ponctuelles) {
    if (s.statut !== "realise" || s.matiere === "Général" || s.estCours) continue;
    entries.push({ semaine: mondayOf(s.date), matiere: s.matiere, minutes: durationMinutes(s.debut, s.fin) });
  }
  for (const k of collesRealisees(data)) entries.push({ semaine: mondayOf(k.date), matiere: k.matiere, minutes: k.minutes });
  return entries;
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

// Comme workEntries, mais avec la date exacte de chaque entrée (au lieu du seul
// lundi de la semaine) — nécessaire pour attribuer correctement une semaine à
// cheval sur deux mois calendaires (ex. semaine du 31 août : le 31 août compte
// pour août, le 1er-6 septembre pour septembre).
export function dailyEntries(data) {
  const entries = [];
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
    entries.push({ date: addDaysStr(s.semaine, jourIndex), matiere, minutes: durationMinutes(c.debut, c.fin) });
  }
  for (const s of data.sessions_ponctuelles) {
    if (s.statut !== "realise" || s.matiere === "Général" || s.estCours) continue;
    entries.push({ date: s.date, matiere: s.matiere, minutes: durationMinutes(s.debut, s.fin) });
  }
  entries.push(...collesRealisees(data));
  return entries;
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
  const creneauxTravail = data.emploi_du_temps.creneaux.filter((c) => c.type === "travail");
  const seancesByCreneauId = new Map(
    data.seances.filter((s) => s.semaine === monday).map((s) => [s.creneauId, s])
  );
  const byDate = {};
  const add = (date, matiere, minutes) => {
    if (matiere === "Général") return;
    if (!byDate[date]) byDate[date] = {};
    byDate[date][matiere] = (byDate[date][matiere] || 0) + minutes;
  };
  for (const c of creneauxTravail) {
    const seance = seancesByCreneauId.get(c.id);
    if (seance?.statut !== "realise") continue;
    const jourIndex = JOURS.findIndex((j) => j.key === c.jour);
    if (jourIndex === -1) continue;
    add(addDaysStr(monday, jourIndex), seance.matiereReelle || c.matiere, durationMinutes(c.debut, c.fin));
  }
  for (const s of data.sessions_ponctuelles) {
    if (s.statut !== "realise" || mondayOf(s.date) !== monday || s.estCours) continue;
    add(s.date, s.matiere, durationMinutes(s.debut, s.fin));
  }
  for (const k of collesRealisees(data)) if (mondayOf(k.date) === monday) add(k.date, k.matiere, k.minutes);
  return JOURS.map((j, i) => {
    const date = addDaysStr(monday, i);
    const byMatiere = byDate[date] || {};
    return { date, jour: j, byMatiere, total: Object.values(byMatiere).reduce((a, b) => a + b, 0) };
  });
}

// Le détail jour par jour en fenêtre glissante (les nbJours derniers jours se
// terminant à endDate inclus) — contrairement à dailySeriesForWeek, ignore les
// limites de semaine calendaire ; peut donc chevaucher deux semaines ISO
// différentes, d'où le regroupement des créneaux récurrents par jour de semaine
// puis la recherche de la séance exacte via sa propre semaine (lundi).
export function dailySeriesRolling(data, endDate, nbJours = 7) {
  const dates = [];
  for (let i = nbJours - 1; i >= 0; i--) dates.push(addDaysStr(endDate, -i));
  const datesSet = new Set(dates);

  const creneauxTravail = data.emploi_du_temps.creneaux.filter((c) => c.type === "travail");
  const creneauxByJour = new Map();
  for (const c of creneauxTravail) {
    if (!creneauxByJour.has(c.jour)) creneauxByJour.set(c.jour, []);
    creneauxByJour.get(c.jour).push(c);
  }

  const byDate = {};
  const add = (date, matiere, minutes) => {
    if (matiere === "Général") return;
    if (!byDate[date]) byDate[date] = {};
    byDate[date][matiere] = (byDate[date][matiere] || 0) + minutes;
  };

  for (const date of dates) {
    const semaine = mondayOf(date);
    for (const c of creneauxByJour.get(dayKeyOf(date)) || []) {
      const seance = data.seances.find((s) => s.creneauId === c.id && s.semaine === semaine);
      if (seance?.statut !== "realise") continue;
      add(date, seance.matiereReelle || c.matiere, durationMinutes(c.debut, c.fin));
    }
  }
  for (const s of data.sessions_ponctuelles) {
    if (s.statut !== "realise" || !datesSet.has(s.date) || s.estCours) continue;
    add(s.date, s.matiere, durationMinutes(s.debut, s.fin));
  }
  for (const k of collesRealisees(data)) if (datesSet.has(k.date)) add(k.date, k.matiere, k.minutes);

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
