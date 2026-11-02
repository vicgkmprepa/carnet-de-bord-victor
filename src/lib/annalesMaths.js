// Un même exercice peut être retravaillé plusieurs fois (une ligne par
// tentative dans le journal, volontairement non dédupliquée pour voir
// l'évolution) — mais le statut "à revoir" ne doit refléter que la dernière
// tentative : reprendre l'exercice doit effacer automatiquement le repère,
// même si une ancienne ligne garde encore aRevoir=true.
export function dernieresTentativesParExercice(exercices) {
  const map = new Map();
  for (const ex of exercices) {
    const key = ex.nom.trim().toLowerCase();
    const cur = map.get(key);
    if (!cur || ex.date > cur.date) map.set(key, ex);
  }
  return [...map.values()];
}

export function exercicesARevoir(exercices) {
  return dernieresTentativesParExercice(exercices).filter((ex) => ex.aRevoir);
}

// Dernière date à laquelle l'annale a été travaillée, tous exercices et
// tentatives blanches confondus — affichée dans la liste des annales (cf.
// AnnalesMathsTracker.js) pour repérer d'un coup d'œil ce qui dort depuis
// longtemps.
export function derniereDateAnnale(annale) {
  const dates = [
    ...annale.exercices.map((ex) => ex.date),
    ...(annale.tentativesBlanches || []).map((t) => t.date),
  ].filter(Boolean);
  return dates.length ? dates.reduce((max, d) => (d > max ? d : max)) : null;
}
