// Les 7 matières notées aux concours blancs, dans l'ordre d'affichage.
export const CB_MATIERES = ["Maths I", "Maths II", "HGG", "Anglais", "Espagnol", "CG", "Synthèse"];

// Table de correspondance matière notée -> intitulé de coefficient d'école (section 5 du cahier des charges).
// HGG utilise le coefficient "Spé HGG" (spécialité de Victor), jamais "Spé ESH".
export const CB_TO_COEF = {
  "Maths I": "Maths appliquées",
  "Maths II": "Maths appliquées 2",
  "HGG": "Spé HGG",
  "Anglais": "LVA",
  "Espagnol": "LVB",
  "CG": "CG",
  "Synthèse": "Synthèse",
};

// Les 6 onglets matières. CG et Synthèse sont "blancs" dans le cahier des charges ;
// on leur donne ici un accent distinct uniquement pour la lisibilité des badges et
// des graphiques (la donnée `couleur` dans data.json reste #F8FAFC). CG utilise un
// fuchsia proche du violet de Synthèse (même famille "matières blanches") sans lui
// être identique.
export const SUBJECT_TABS = [
  { key: "Maths", label: "Maths", accent: "#DC2626", cbMatieres: ["Maths I", "Maths II"] },
  { key: "HGG", label: "HGG", accent: "#16A34A", cbMatieres: ["HGG"] },
  { key: "Anglais", label: "Anglais", accent: "#2563EB", cbMatieres: ["Anglais"] },
  { key: "Espagnol", label: "Espagnol", accent: "#CA8A04", cbMatieres: ["Espagnol"] },
  { key: "CG", label: "CG", accent: "#C026D3", cbMatieres: ["CG"] },
  { key: "Synthèse", label: "Synthèse", accent: "#7C3AED", cbMatieres: ["Synthèse"] },
];

// Coefficients Points Saint-Jean (cf. CBList.js), regroupés par onglet matière
// (Maths I + Maths II -> "Maths") — sert de référence à la part de temps de
// travail "idéale" par matière (cf. PlanningCoeffCounter.js dans l'agenda).
// Somme des coefficients = 30.
export const COEFFS_MATIERES = {
  Maths: 8,
  HGG: 8,
  Anglais: 4.5,
  Espagnol: 2.5,
  CG: 4.5,
  "Synthèse": 2.5,
};

// Causes d'écart possibles sur une note de CB — permet de transformer un écart brut
// en diagnostic exploitable plutôt qu'un simple chiffre.
export const CAUSES_ERREUR = ["Méthode", "Gestion du temps", "Connaissances", "Rédaction"];

// Sous-thèmes disponibles uniquement pour la matière "Maths" (créneaux et sessions
// ponctuelles) — Maths I = Algèbre + Analyse, Maths II = Probabilités. Optionnel :
// sert à affiner le suivi du temps de travail à l'intérieur de Maths.
export const MATHS_THEMES = ["Algèbre", "Analyse", "Probabilités", "Python", "Annale"];
export const MATHS_THEME_COLORS = {
  "Algèbre": "#DC2626",
  "Analyse": "#F97316",
  "Probabilités": "#0D9488",
  "Python": "#2563EB",
  "Annale": "#7C3AED",
};

export const CHART_COLORS = {
  "Maths I": "#DC2626",
  "Maths II": "#F97316",
  "HGG": "#16A34A",
  "Anglais": "#2563EB",
  "Espagnol": "#CA8A04",
  "CG": "#C026D3",
  "Synthèse": "#7C3AED",
};

export const ECOLE_COLORS = {
  "HEC Paris": "#4F46E5",
  "ESSEC": "#0EA5E9",
  "ESCP": "#E11D48",
  "EDHEC": "#059669",
  "emlyon": "#D97706",
};

export function subjectAccent(key) {
  const tab = SUBJECT_TABS.find((t) => t.key === key);
  return tab ? tab.accent : "#64748B";
}

export function subjectLabel(key) {
  const tab = SUBJECT_TABS.find((t) => t.key === key);
  return tab ? tab.label : key;
}

// Libellé d'un créneau/session : titre libre s'il existe (prioritaire — un titre
// saisi à la main doit toujours s'afficher), sinon "Maths - Algèbre" si un thème
// Maths est choisi, sinon le nom de la matière.
export function itemLabel(matiere, theme, titre) {
  if (titre) return titre;
  if (matiere === "Maths" && theme) return `Maths - ${theme}`;
  return subjectLabel(matiere);
}
