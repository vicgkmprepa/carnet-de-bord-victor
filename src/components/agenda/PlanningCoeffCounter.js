import { html } from "../../lib/htm.js";
import { durationMinutes, formatDuration } from "../../lib/scheduleUtils.js";
import { SUBJECT_TABS, COEFFS_MATIERES, subjectAccent } from "../../lib/subjectMapping.js";

// Widget temporaire, le temps de programmer le prochain planning : à côté du
// temps programmé réel par matière sur la semaine affichée, compare la part
// (en %) que ça représente à la part "idéale" selon le coefficient de la
// matière (Points Saint-Jean) — pour repérer d'un coup d'œil une matière
// sous- ou sur-dotée avant de valider le planning. Ne compte que le travail
// perso (sessions ponctuelles hors cours) : ni les colles, ni les temps de
// cours, qui ne sont pas du travail "programmable". À retirer une fois la
// programmation terminée.
export function PlanningCoeffCounter({ data, weekDays, onClose }) {
  const minutesParMatiere = Object.fromEntries(SUBJECT_TABS.map((t) => [t.key, 0]));

  for (const s of data.sessions_ponctuelles) {
    if (s.estCours) continue;
    if (!weekDays.includes(s.date)) continue;
    if (minutesParMatiere[s.matiere] == null) continue;
    minutesParMatiere[s.matiere] += durationMinutes(s.debut, s.fin);
  }

  const totalMinutes = Object.values(minutesParMatiere).reduce((a, b) => a + b, 0);
  const totalCoeff = Object.values(COEFFS_MATIERES).reduce((a, b) => a + b, 0);

  return html`
    <div class="bg-white rounded-2xl border-2 border-dashed border-indigo-200 shadow-sm p-4 mb-4">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h3 class="text-sm font-semibold text-slate-800">⏱️ Temps programmé par matière <span class="font-normal text-slate-400">(planning — temporaire)</span></h3>
          <p class="text-xs text-slate-400">Semaine affichée · total : ${formatDuration(totalMinutes)}</p>
        </div>
        <button class="text-slate-300 hover:text-red-500 text-sm leading-none" onClick=${onClose} title="Masquer ce widget">✕</button>
      </div>

      <div class="space-y-2.5">
        ${SUBJECT_TABS.map((t) => {
          const minutes = minutesParMatiere[t.key];
          const partReelle = totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0;
          const coeff = COEFFS_MATIERES[t.key] || 0;
          const partCible = totalCoeff > 0 ? (coeff / totalCoeff) * 100 : 0;
          const ecart = partReelle - partCible;
          return html`
            <div key=${t.key}>
              <div class="flex items-center justify-between text-xs mb-0.5">
                <span class="font-medium" style=${{ color: subjectAccent(t.key) }}>${t.label}</span>
                <span class="text-slate-500">
                  ${formatDuration(minutes)}
                  <span class="text-slate-400"> · ${partReelle.toFixed(0)}% (cible ${partCible.toFixed(0)}%)</span>
                  ${Math.abs(ecart) >= 5 &&
                  html`<span class=${ecart > 0 ? "text-emerald-500" : "text-amber-500"}> ${ecart > 0 ? "▲" : "▼"}</span>`}
                </span>
              </div>
              <div class="relative h-2 rounded-full bg-slate-100 overflow-hidden">
                <div class="absolute inset-y-0 left-0 rounded-full" style=${{ width: `${Math.min(partReelle, 100)}%`, backgroundColor: subjectAccent(t.key) }}></div>
                <div class="absolute inset-y-0 w-0.5 bg-slate-500" style=${{ left: `${Math.min(partCible, 100)}%` }}></div>
              </div>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}
