import { SUBJECT_TABS, CB_TO_COEF } from "./subjectMapping.js";
import { mondayOf, addDaysStr } from "./scheduleUtils.js";
import { weeklySeries } from "./workTimeStats.js";

export const SEUIL_ECART_COEF = 8; // points de pourcentage d'écart avant d'afficher un warning
export const NB_ECOLES_TOP = 3;
// École de référence pour la comparaison temps/coefficient — objectif prioritaire de
// Victor, cf. [[user_victor]]. Nom piloté par les données (data.ecoles), pas de
// coefficients en dur : si l'école n'est pas trouvée, on retombe sur les 3 premières.
export const ECOLE_REFERENCE = "HEC Paris";
// Certaines matières tolèrent normalement un temps investi bien au-delà de leur
// simple poids en coefficient (ex. Maths, très cumulative) — seuil de sur-investissement
// absolu qui remplace l'écart générique pour ces matières.
export const SEUIL_MAX_ABSOLU = { Maths: 45 };

function coefMatiere(ecoles, tab) {
  let total = 0;
  for (const ecole of ecoles) {
    for (const cbMat of tab.cbMatieres) {
      const coefName = CB_TO_COEF[cbMat];
      const coef = ecole.coefficients ? ecole.coefficients[coefName] : undefined;
      if (typeof coef === "number") total += coef;
    }
  }
  return total;
}

// Compare, pour chaque matière, le % du temps de travail perso réalisé sur les 2
// dernières semaines glissantes au % que représente son coefficient chez les
// NB_ECOLES_TOP premières écoles — factorisé depuis CoefficientBalanceCard pour être
// réutilisé par les widgets d'alertes (Dashboard + Temps de travail).
export function coefficientBalanceRows(data, today) {
  const ecoleReference = data.ecoles.find((e) => e.nom === ECOLE_REFERENCE);
  const topEcoles = ecoleReference ? [ecoleReference] : data.ecoles.slice(0, NB_ECOLES_TOP);
  const monday = mondayOf(today);
  const semainesGlissantes = new Set([monday, addDaysStr(monday, -7)]);

  const tempsParMatiere = {};
  for (const w of weeklySeries(data)) {
    if (!semainesGlissantes.has(w.semaine)) continue;
    for (const [matiere, minutes] of Object.entries(w.byMatiere)) {
      tempsParMatiere[matiere] = (tempsParMatiere[matiere] || 0) + minutes;
    }
  }
  const totalTemps = SUBJECT_TABS.reduce((acc, t) => acc + (tempsParMatiere[t.key] || 0), 0);

  const coefsParMatiere = {};
  for (const tab of SUBJECT_TABS) coefsParMatiere[tab.key] = coefMatiere(topEcoles, tab);
  const totalCoef = SUBJECT_TABS.reduce((acc, t) => acc + coefsParMatiere[t.key], 0);

  if (totalTemps === 0 || totalCoef === 0) return { rows: [], topEcoles };

  const rows = SUBJECT_TABS.map((tab) => {
    const pctTemps = ((tempsParMatiere[tab.key] || 0) / totalTemps) * 100;
    const pctCoef = (coefsParMatiere[tab.key] / totalCoef) * 100;
    const ecart = pctTemps - pctCoef;
    const seuilHaut = SEUIL_MAX_ABSOLU[tab.key];
    const surInvesti = ecart > 0 && (seuilHaut === undefined ? ecart >= SEUIL_ECART_COEF : pctTemps > seuilHaut);
    const sousInvesti = ecart < 0 && Math.abs(ecart) >= SEUIL_ECART_COEF;
    return { tab, pctTemps, pctCoef, ecart, surInvesti, sousInvesti };
  });

  return { rows, topEcoles };
}
