import { SUBJECT_TABS } from "./subjectMapping.js";
import { isPast, daysUntil } from "./dateUtils.js";

// Pas d'article de veille presse depuis 14 j sur une matière qui en a déjà eu —
// plus tolérant que le temps de travail (cadence hebdomadaire, pas quotidienne).
const SEUIL_JOURS_VEILLE_PRESSE = 14;

// Tâches, colles et veille de presse en retard par matière — signaux de suivi
// administratif propres à chaque onglet, indépendants du temps de travail et
// des notes. N'apparaît que si au moins un signal est réellement positif.
export function signauxParMatiere(data) {
  const result = {};
  for (const tab of SUBJECT_TABS) {
    const tachesEnRetard = data.taches_globales.filter(
      (t) => t.matiere === tab.key && t.statut !== "fait" && isPast(t.deadline)
    ).length;

    const collesSansRetour = data.colles.filter((c) => c.matiere === tab.key && isPast(c.date) && !c.retour).length;

    const articlesMatiere = data.veille_presse.filter((a) => a.matiere === tab.key);
    let veillePresseJours = null;
    if (articlesMatiere.length > 0) {
      const dernier = [...articlesMatiere].sort((a, b) => b.date.localeCompare(a.date))[0];
      veillePresseJours = -daysUntil(dernier.date);
    }
    const veillePresseStale = veillePresseJours !== null && veillePresseJours > SEUIL_JOURS_VEILLE_PRESSE;

    if (tachesEnRetard > 0 || collesSansRetour > 0 || veillePresseStale) {
      result[tab.key] = { tachesEnRetard, collesSansRetour, veillePresseJours, veillePresseStale };
    }
  }
  return result;
}

// Banque de sujets de dissertation — pas rattachée à une matière (partagée
// CG/Synthèse dans l'onglet Objectifs & Notes), donc un seul signal global
// plutôt qu'un signal par matière.
const SEUIL_JOURS_DISSERTATION = 21;
export function dissertationBankStale(data) {
  if (data.sujets_dissertation.length === 0) return null;
  const dernier = [...data.sujets_dissertation].sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
  if (!dernier.date) return null;
  const jours = -daysUntil(dernier.date);
  return jours > SEUIL_JOURS_DISSERTATION ? jours : null;
}
