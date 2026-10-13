import { CB_TO_COEF } from "./subjectMapping.js";

// Une matière "bis" (ex : "HGG (bis)") est une matière supplémentaire ajoutée à un
// CB précis quand l'épreuve a été passée deux fois ce jour-là — on la rattache à sa
// matière canonique en retirant le suffixe.
function canonicalName(nom) {
  return nom.replace(/\s*\(bis\)\s*$/, "");
}

export function cbHasNotes(cb) {
  return (cb.matieres || []).some((m) => m.note_obtenue !== null && m.note_obtenue !== undefined && m.note_obtenue !== "");
}

export function cbsWithNotes(cbsSortedAsc) {
  return cbsSortedAsc.filter(cbHasNotes);
}

// Le dernier CB par date parmi ceux qui ont au moins une note obtenue renseignée —
// ignore les CB à venir (date future, notes pas encore remplies) pour que les
// widgets du Dashboard reflètent toujours le dernier résultat réel, pas un CB vide.
export function latestCBWithNotes(cbsSortedAsc) {
  const avecNotes = cbsWithNotes(cbsSortedAsc);
  return avecNotes.length ? avecNotes[avecNotes.length - 1] : null;
}

// Moyenne pondérée d'un CB pour une école donnée : somme(note * coef) / somme(coef),
// en ne comptant que les matières notées (note_obtenue non nulle). Utilise le
// coefficient "Spé HGG" via CB_TO_COEF, jamais "Spé ESH". Quand une matière apparaît
// plusieurs fois dans le CB (ex : deux épreuves de HGG le même CB), sa note est la
// moyenne des notes obtenues à chaque occurrence.
export function weightedAverageForSchool(cb, ecole) {
  const notesParMatiere = new Map();
  for (const m of cb.matieres || []) {
    if (m.note_obtenue === null || m.note_obtenue === undefined || m.note_obtenue === "") continue;
    const nom = canonicalName(m.nom);
    if (!notesParMatiere.has(nom)) notesParMatiere.set(nom, []);
    notesParMatiere.get(nom).push(Number(m.note_obtenue));
  }

  let num = 0;
  let den = 0;
  for (const [nom, notes] of notesParMatiere) {
    const coefName = CB_TO_COEF[nom];
    if (!coefName) continue;
    const coef = ecole.coefficients ? ecole.coefficients[coefName] : undefined;
    if (coef === undefined || coef === null) continue;
    const moyenne = notes.reduce((a, b) => a + b, 0) / notes.length;
    num += moyenne * coef;
    den += coef;
  }
  return den > 0 ? num / den : null;
}
