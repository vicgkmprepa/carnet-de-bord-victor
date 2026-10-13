import { SUBJECT_TABS, CB_TO_COEF } from "./subjectMapping.js";
import { bceParMatiere } from "./bceReference.js";

// École de référence pour le calcul des notes cibles — partagée par
// BceReferenceCard, AlertsCard et NeglectedSubjectCard pour rester cohérents.
export const ECOLE_CIBLE_DEFAUT = "ESSEC";

// Écart (en points) au-delà duquel on considère qu'il reste un vrai travail de
// progression vers la cible — en dessous, l'objectif est jugé quasi atteint.
const SEUIL_ECART_OBJECTIF = 0.5;
// Écart à partir duquel l'axe de progression est jugé critique (force la sévérité
// dans les widgets d'alerte, indépendamment du reste).
export const SEUIL_ECART_CRITIQUE = 2;

function canonicalName(nom) {
  return nom.replace(/\s*\(bis\)\s*$/, "");
}

function coefMatiereEcole(ecole, tab) {
  let total = 0;
  for (const cbMat of tab.cbMatieres) {
    const coefName = CB_TO_COEF[cbMat];
    const coef = ecole.coefficients ? ecole.coefficients[coefName] : undefined;
    if (typeof coef === "number") total += coef;
  }
  return total;
}

// Notes cibles par matière pour une école donnée : la BCE 2026 est un résultat
// fixe et déjà joué, jamais une cible — sert uniquement de point de départ. On
// calcule l'écart uniforme (en points) qu'il faudrait ajouter à chaque matière
// pour que la moyenne pondérée par les coefficients réels de l'école atteigne sa
// barre d'admissibilité 2026 réelle (data.ecoles[].barre_admissibilite_2026).
// Décalage uniforme plutôt que cible plate identique partout : ça demande le même
// effort de progression (en points) à chaque matière, pas le même niveau final —
// une matière déjà forte à la BCE reste proportionnellement plus haute.
export function notesCiblesParEcole(data, ecoleNom) {
  const ecole = data.ecoles.find((e) => e.nom === ecoleNom);
  if (!ecole) return null;
  const bce = bceParMatiere(data);

  let num = 0;
  let den = 0;
  for (const tab of SUBJECT_TABS) {
    const info = bce[tab.key];
    if (!info) continue;
    const coef = coefMatiereEcole(ecole, tab);
    if (coef <= 0) continue;
    num += info.moyenne * coef;
    den += coef;
  }
  if (den === 0) return null;
  const moyenneBcePonderee = num / den;
  const ecartUniforme = ecole.barre_admissibilite_2026 - moyenneBcePonderee;

  const cibles = {};
  for (const tab of SUBJECT_TABS) {
    const info = bce[tab.key];
    if (!info) continue;
    cibles[tab.key] = Math.round((info.moyenne + ecartUniforme) * 10) / 10;
  }
  return { ecole: ecoleNom, barre: ecole.barre_admissibilite_2026, moyenneBcePonderee, ecartUniforme, cibles };
}

// Notes cibles effectives par matière : la valeur personnalisée saisie par
// Victor si elle existe (son propre jugement sur ce qui est atteignable matière
// par matière — une matière maîtrisable comme les Maths tolère une cible bien
// plus ambitieuse que le décalage uniforme, une matière aléatoire comme la
// Synthèse mérite au contraire une cible plus prudente), sinon la valeur
// calculée par décalage uniforme depuis la BCE. Recalcule aussi la moyenne
// pondérée réelle obtenue avec ces cibles effectives, pour vérifier si la
// stratégie choisie franchit toujours la barre d'admissibilité réelle.
export function ciblesEffectives(data, ecoleNom = ECOLE_CIBLE_DEFAUT) {
  const calc = notesCiblesParEcole(data, ecoleNom);
  if (!calc) return null;
  const ecole = data.ecoles.find((e) => e.nom === ecoleNom);
  const personnalisees = data.notes_cibles_personnalisees || {};

  const valeurs = {};
  let num = 0;
  let den = 0;
  for (const tab of SUBJECT_TABS) {
    const calcValeur = calc.cibles[tab.key];
    if (calcValeur === undefined) continue;
    const perso = personnalisees[tab.key];
    const valeur = typeof perso === "number" ? perso : calcValeur;
    valeurs[tab.key] = { valeur, source: typeof perso === "number" ? "personnalisee" : "calculee" };
    const coef = coefMatiereEcole(ecole, tab);
    num += valeur * coef;
    den += coef;
  }
  const moyennePonderee = den > 0 ? num / den : null;
  return { ecole: ecoleNom, barre: calc.barre, moyennePonderee, valeurs };
}

// Note "actuelle" par matière : la dernière note obtenue à un concours blanc réel
// si elle existe, sinon la moyenne BCE 2026 par défaut (aucune autre donnée
// disponible tant qu'aucun CB n'a été passé — l'écart à la cible est alors
// identique pour toutes les matières, ce qui est normal et pas un bug).
function derniereNoteObtenue(data, tab) {
  const cbsDesc = [...data.concours_blancs].sort((a, b) => b.date.localeCompare(a.date));
  for (const cb of cbsDesc) {
    const valeurs = cb.matieres
      .filter((m) => tab.cbMatieres.includes(canonicalName(m.nom)))
      .filter((m) => m.note_obtenue !== null && m.note_obtenue !== undefined)
      .map((m) => Number(m.note_obtenue));
    if (valeurs.length) return valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
  }
  return null;
}

// Diagnostic complet par matière pour une école cible (ESSEC par défaut) : cible,
// niveau actuel (CB récent ou BCE à défaut), écart, et classification qui en
// découle — utilisé par les widgets d'alerte à la place d'un seuil BCE fixe.
export function diagnosticParMatiere(data, ecoleNom = ECOLE_CIBLE_DEFAUT) {
  const effectives = ciblesEffectives(data, ecoleNom);
  if (!effectives) return { ecole: ecoleNom, barre: null, matieres: {} };

  const bce = bceParMatiere(data);
  const matieres = {};
  for (const tab of SUBJECT_TABS) {
    const info = effectives.valeurs[tab.key];
    if (!info) continue;
    const cible = info.valeur;
    const noteCB = derniereNoteObtenue(data, tab);
    const actuelle = noteCB !== null ? noteCB : (bce[tab.key]?.moyenne ?? null);
    if (actuelle === null) continue;
    const ecart = cible - actuelle;
    matieres[tab.key] = {
      cible,
      sourceCible: info.source,
      actuelle,
      sourceActuelle: noteCB !== null ? "cb" : "bce",
      ecart,
      axeProgres: ecart > SEUIL_ECART_OBJECTIF,
      objectifAtteint: ecart <= 0,
      critique: ecart >= SEUIL_ECART_CRITIQUE,
    };
  }
  return { ecole: effectives.ecole, barre: effectives.barre, moyennePonderee: effectives.moyennePonderee, matieres };
}
