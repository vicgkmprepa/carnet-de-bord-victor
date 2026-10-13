import { timeToMinutes, minutesToTime } from "./scheduleUtils.js";

// Durées de colle par matière : l'heure enregistrée (colle.heure) est toujours
// l'heure de PASSAGE, pas de début de créneau.
// - Langues (Anglais/Espagnol) : 20 min de préparation + 20 min de passage.
// - HGG/CG : 30 min de préparation + 30 min de passage.
// - Maths : pas de préparation, 30 min de passage seulement.
export function colleDurees(matiere) {
  if (matiere === "Anglais" || matiere === "Espagnol") return { prepa: 20, passage: 20 };
  if (matiere === "HGG" || matiere === "CG") return { prepa: 30, passage: 30 };
  if (matiere === "Maths") return { prepa: 0, passage: 30 };
  return { prepa: 0, passage: 60 };
}

// Calcule les horaires complets d'une colle (début prépa, début colle, fin
// colle) à partir de l'heure de passage enregistrée.
export function colleHoraires(colle) {
  const passageStart = timeToMinutes(colle.heure);
  const { prepa, passage } = colleDurees(colle.matiere);
  const debutPrepa = passageStart - prepa;
  const finColle = passageStart + passage;
  return {
    prepa,
    debutPrepa: minutesToTime(debutPrepa),
    debutColle: colle.heure,
    finColle: minutesToTime(finColle),
  };
}

// Une colle compte comme du travail réalisé dans sa matière (préparation +
// passage) dès qu'elle est terminée — mais n'entre JAMAIS dans le temps
// planifié : 6h de CG prévues + une colle de CG = 7h réalisées sur 6h.
export function colleMinutes(colle) {
  const { prepa, passage } = colleDurees(colle.matiere);
  return prepa + passage;
}

// Date/heure comparées en local (jamais toISOString, cf. bug fuseau horaire).
export function colleTerminee(colle, now = new Date()) {
  if (!colle.date || !colle.heure) return false;
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const today = `${y}-${m}-${d}`;
  if (colle.date !== today) return colle.date < today;
  return timeToMinutes(colleHoraires(colle).finColle) <= now.getHours() * 60 + now.getMinutes();
}

// Les colles terminées, au format { date, matiere, minutes } des stats de temps.
export function collesRealisees(data) {
  return (data.colles || [])
    .filter((k) => k.matiere && k.matiere !== "Général" && colleTerminee(k))
    .map((k) => ({ date: k.date, matiere: k.matiere, minutes: colleMinutes(k) }));
}
