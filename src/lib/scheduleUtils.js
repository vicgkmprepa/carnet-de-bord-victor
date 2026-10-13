export const JOURS = [
  { key: "lundi", label: "Lun", full: "Lundi" },
  { key: "mardi", label: "Mar", full: "Mardi" },
  { key: "mercredi", label: "Mer", full: "Mercredi" },
  { key: "jeudi", label: "Jeu", full: "Jeudi" },
  { key: "vendredi", label: "Ven", full: "Vendredi" },
  { key: "samedi", label: "Sam", full: "Samedi" },
  { key: "dimanche", label: "Dim", full: "Dimanche" },
];

function parseDate(dateStr) {
  return new Date(dateStr + "T00:00:00");
}

// Sérialise en YYYY-MM-DD à partir des composants LOCAUX (jamais toISOString, qui
// convertit en UTC et fait reculer la date d'un jour dans un fuseau horaire en
// avance sur UTC, ex. Europe/Paris — bug qui décalait toute la grille de l'Agenda).
function toStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Lundi (YYYY-MM-DD) de la semaine contenant dateStr (ou aujourd'hui si omis).
export function mondayOf(dateStr) {
  const d = dateStr ? parseDate(dateStr) : new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0 = dimanche, 1 = lundi, ...
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return toStr(d);
}

export function addDaysStr(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toStr(d);
}

// Clé JOURS (lundi..dimanche) correspondant à dateStr.
export function dayKeyOf(dateStr) {
  const d = parseDate(dateStr);
  const dow = d.getDay(); // 0 = dimanche, 1 = lundi, ...
  return JOURS[dow === 0 ? 6 : dow - 1].key;
}

// Premier jour (YYYY-MM-DD) du mois contenant dateStr.
export function firstOfMonth(dateStr) {
  const d = parseDate(dateStr);
  return toStr(new Date(d.getFullYear(), d.getMonth(), 1));
}

// Premier jour du mois n mois plus tard (ou plus tôt si n négatif).
export function addMonths(dateStr, n) {
  const d = parseDate(dateStr);
  return toStr(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

export function formatMonthRangeFr(firstOfMonthStr) {
  const d = parseDate(firstOfMonthStr);
  const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatWeekRangeFr(mondayStr) {
  const start = parseDate(mondayStr);
  const end = parseDate(addDaysStr(mondayStr, 6));
  const fmt = (d, withYear) =>
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: withYear ? "numeric" : undefined });
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${fmt(start, !sameYear)} – ${fmt(end, true)}`;
}

export function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Heure actuelle arrondie à la dizaine de minutes la plus proche — sert de valeur
// par défaut dans les formulaires d'ajout de l'Agenda (créneau, session, événement)
// pour éviter de retaper l'heure à chaque fois.
export function roundedNowTime(step = 10) {
  const d = new Date();
  const mins = Math.round((d.getHours() * 60 + d.getMinutes()) / step) * step;
  return minutesToTime(((mins % 1440) + 1440) % 1440);
}

export function addMinutesToTime(hhmm, delta) {
  const mins = timeToMinutes(hhmm) + delta;
  return minutesToTime(((mins % 1440) + 1440) % 1440);
}

export function durationMinutes(debut, fin) {
  const a = timeToMinutes(debut);
  const b = timeToMinutes(fin);
  if (a === null || b === null) return 0;
  return Math.max(0, b - a);
}

export function formatDuration(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}
