import { SUBJECT_TABS } from "./subjectMapping.js";

// Indicateur BCE par matière — moyenne des notes de référence 2026 taguées à
// cette matière (une matière peut avoir plusieurs notes, une par école). Une
// matière absente du résultat n'a aucune note taguée. Résultat fixe et déjà
// joué, jamais un seuil ou une cible en soi — sert uniquement de point de
// départ à notesCibles.js pour calculer les vraies notes cibles.
export function bceParMatiere(data) {
  const result = {};
  for (const tab of SUBJECT_TABS) {
    const notes = data.notes_bce_reference.filter((n) => n.matiere === tab.key);
    if (notes.length === 0) continue;
    const moyenne = notes.reduce((acc, n) => acc + n.note, 0) / notes.length;
    result[tab.key] = { moyenne, notes };
  }
  return result;
}
