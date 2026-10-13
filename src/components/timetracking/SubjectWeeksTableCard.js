import { html } from "../../lib/htm.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import { subjectAccent, subjectLabel, SUBJECT_TABS } from "../../lib/subjectMapping.js";
import { formatDuration } from "../../lib/scheduleUtils.js";
import { formatDateShortFr } from "../../lib/dateUtils.js";
import { matieresPresentes } from "../../lib/workTimeStats.js";

// En dessous de ce seuil (en minutes), une variation d'une semaine à l'autre est
// considérée comme stable — évite une flèche verte/rouge pour un écart de 1-2
// minutes qui n'a rien de significatif.
const SEUIL_STABLE_MIN = 10;

function Evolution({ delta, dark }) {
  if (delta === null) return html`<span class=${`text-xs ${dark ? "text-slate-500" : "text-slate-300"}`}>—</span>`;
  if (Math.abs(delta) < SEUIL_STABLE_MIN) {
    return html`<span class=${`text-xs inline-flex items-center gap-0.5 ${dark ? "text-slate-400" : "text-slate-400"}`}>▬ stable</span>`;
  }
  const up = delta > 0;
  const classes = dark
    ? up
      ? "text-emerald-300 bg-emerald-500/20"
      : "text-red-300 bg-red-500/20"
    : up
      ? "text-emerald-700 bg-emerald-50"
      : "text-red-600 bg-red-50";
  return html`
    <span class=${`text-xs font-semibold inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${classes}`}>
      ${up ? "▲" : "▼"} ${up ? "+" : "−"}${formatDuration(Math.abs(delta))}
    </span>
  `;
}

// Tableau matière × semaine : une ligne par matière, une colonne par semaine,
// avec sous chaque durée la variation (flèche + delta) par rapport à la semaine
// juste avant dans le tableau — pour repérer d'un coup d'œil les matières en
// hausse ou en baisse, pas seulement le total global (déjà couvert par
// WeeksEvolutionCard, en graphique empilé). Chaque ligne est teintée dans la
// couleur de sa matière (comme les pastilles utilisées partout ailleurs dans
// l'app) et séparée de la suivante par un épais trait blanc — plus facile à
// suivre d'un bout à l'autre qu'un simple zébrage gris/blanc.
// Couleur indigo (même convention que SEMAINE_ACTUELLE dans WeekComparisonCard)
// pour repérer la semaine en cours dans la grille, par un fin encadré vertical
// qui traverse toute la colonne — sans écraser la teinte par matière des lignes.
const COULEUR_SEMAINE_ACTUELLE = "#4F46E5";

export function SubjectWeeksTableCard({ weeks, currentWeekMonday }) {
  const matieres = matieresPresentes(weeks, SUBJECT_TABS);

  return html`
    <${Card} title="Temps de travail par matière, semaine par semaine" subtitle="Évolution d'une semaine à l'autre">
      ${weeks.length === 0
        ? html`<${EmptyState} text="Pas encore assez de données pour voir un tableau." />`
        : html`
            <div class="overflow-x-auto -mx-5 px-5">
              <table class="w-full text-sm border-separate" style=${{ borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th class="text-left text-xs font-semibold text-slate-500 pb-2.5 pr-3 sticky left-0 bg-white z-10 border-b-2 border-slate-200">
                      Matière
                    </th>
                    ${weeks.map((w) => {
                      const estActuelle = w.semaine === currentWeekMonday;
                      return html`
                        <th
                          key=${w.semaine}
                          class=${`text-center text-xs pb-1 px-3 whitespace-nowrap border-b-2 ${
                            estActuelle ? "border-indigo-500" : "border-slate-200 border-l border-l-slate-100"
                          } ${estActuelle ? "font-bold text-indigo-600" : "font-semibold text-slate-500"}`}
                          style=${estActuelle ? { backgroundColor: `${COULEUR_SEMAINE_ACTUELLE}0F`, borderLeft: `2px solid ${COULEUR_SEMAINE_ACTUELLE}`, borderRight: `2px solid ${COULEUR_SEMAINE_ACTUELLE}` } : {}}
                        >
                          ${formatDateShortFr(w.semaine)}
                          ${estActuelle && html`<span class="block text-[9px] font-bold normal-case tracking-normal">cette semaine</span>`}
                        </th>
                      `;
                    })}
                  </tr>
                </thead>
                <tbody>
                  ${matieres.map((m) => {
                    const valeurs = weeks.map((w) => Math.round(w.byMatiere[m] || 0));
                    const accent = subjectAccent(m);
                    // Teinte très légère de la couleur de la matière sur toute la ligne
                    // (même principe que les pastilles) + épais liseré blanc sous la
                    // ligne pour bien la détacher de la suivante.
                    const rowBg = `${accent}17`;
                    return html`
                      <tr key=${m}>
                        <td
                          class="py-3.5 pr-3 sticky left-0 z-10 border-b-[6px] border-white"
                          style=${{ backgroundColor: rowBg, borderLeft: `5px solid ${accent}` }}
                        >
                          <span class="flex items-center gap-2 whitespace-nowrap pl-2.5">
                            <span class="text-slate-900 font-bold">${subjectLabel(m)}</span>
                          </span>
                        </td>
                        ${valeurs.map((v, i) => {
                          const delta = i === 0 ? null : v - valeurs[i - 1];
                          const estActuelle = weeks[i].semaine === currentWeekMonday;
                          return html`
                            <td
                              key=${weeks[i].semaine}
                              class=${`text-center py-3.5 px-3 border-b-[6px] border-white ${estActuelle ? "" : "border-l border-l-white/60"}`}
                              style=${{
                                backgroundColor: rowBg,
                                ...(estActuelle
                                  ? { boxShadow: `inset 2px 0 0 ${COULEUR_SEMAINE_ACTUELLE}, inset -2px 0 0 ${COULEUR_SEMAINE_ACTUELLE}` }
                                  : {}),
                              }}
                            >
                              <p class=${`font-semibold mb-1 ${v > 0 ? "text-slate-800" : "text-slate-400"}`}>${v > 0 ? formatDuration(v) : "—"}</p>
                              <${Evolution} delta=${delta} />
                            </td>
                          `;
                        })}
                      </tr>
                    `;
                  })}
                  <tr>
                    <td class="py-3.5 pr-3 sticky left-0 z-10" style=${{ backgroundColor: "#1E293B" }}>
                      <span class="pl-2.5 text-white font-bold text-xs uppercase tracking-wide">Total</span>
                    </td>
                    ${weeks.map((w, i) => {
                      const v = Math.round(w.total);
                      const delta = i === 0 ? null : v - Math.round(weeks[i - 1].total);
                      const estActuelle = w.semaine === currentWeekMonday;
                      return html`
                        <td
                          key=${w.semaine}
                          class=${`text-center py-3.5 px-3 ${estActuelle ? "" : "border-l border-l-white/10"}`}
                          style=${{
                            backgroundColor: "#1E293B",
                            ...(estActuelle
                              ? { boxShadow: `inset 2px 0 0 ${COULEUR_SEMAINE_ACTUELLE}, inset -2px 0 0 ${COULEUR_SEMAINE_ACTUELLE}, inset 0 -2px 0 ${COULEUR_SEMAINE_ACTUELLE}` }
                              : {}),
                          }}
                        >
                          <p class="font-bold text-white mb-1">${v > 0 ? formatDuration(v) : "—"}</p>
                          <${Evolution} delta=${delta} dark=${true} />
                        </td>
                      `;
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          `}
    <//>
  `;
}
