import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import { MATHS_THEMES, MATHS_THEME_COLORS } from "../../lib/subjectMapping.js";
import { JOURS, durationMinutes, formatDuration, addDaysStr } from "../../lib/scheduleUtils.js";

const NON_CLASSE_COLOR = "#94A3B8";

// Répartition du temps de travail perso réalisé sur les 14 derniers jours
// glissants (jour par jour, pas calé sur les semaines civiles) entre Algèbre,
// Analyse et Probabilités, pour vérifier d'un coup d'œil qu'aucun des trois n'est
// délaissé dans le rythme actuel. "Non classé" regroupe les créneaux/sessions
// Maths sans thème renseigné.
export function MathsThemeBreakdown() {
  const { data, today } = useCarnet();
  const depuis = addDaysStr(today, -13);
  const dansLaFenetre = (dateStr) => dateStr >= depuis && dateStr <= today;

  const minutesByTheme = {};
  const add = (theme, mins) => {
    const key = theme || "Non classé";
    minutesByTheme[key] = (minutesByTheme[key] || 0) + mins;
  };

  const creneauxMaths = data.emploi_du_temps.creneaux.filter((c) => c.type === "travail" && c.matiere === "Maths");
  const creneauxById = new Map(creneauxMaths.map((c) => [c.id, c]));
  for (const s of data.seances) {
    if (s.statut !== "realise") continue;
    const c = creneauxById.get(s.creneauId);
    if (!c) continue;
    const offsetJour = JOURS.findIndex((j) => j.key === c.jour);
    if (offsetJour === -1) continue;
    const dateSeance = addDaysStr(s.semaine, offsetJour);
    if (!dansLaFenetre(dateSeance)) continue;
    if ((s.matiereReelle || c.matiere) !== "Maths") continue;
    add(c.theme, durationMinutes(c.debut, c.fin));
  }
  for (const s of data.sessions_ponctuelles) {
    if (s.matiere !== "Maths" || s.statut !== "realise" || !dansLaFenetre(s.date) || s.estCours) continue;
    add(s.theme, durationMinutes(s.debut, s.fin));
  }

  const total = Object.values(minutesByTheme).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return html`
      <${Card} title="Répartition Algèbre / Analyse / Probas" subtitle="Temps de travail perso réalisé, 14 derniers jours">
        <${EmptyState}
          text="Coche des créneaux ou sessions Maths comme réalisés (avec un thème renseigné) ces 14 derniers jours pour voir la répartition ici."
        />
      <//>
    `;
  }

  const themesAffiches = [...MATHS_THEMES, ...(minutesByTheme["Non classé"] ? ["Non classé"] : [])];

  return html`
    <${Card} title="Répartition Algèbre / Analyse / Probas" subtitle="Temps de travail perso réalisé, 14 derniers jours">
      <ul class="space-y-3">
        ${themesAffiches.map((theme) => {
          const mins = minutesByTheme[theme] || 0;
          const pct = total > 0 ? (mins / total) * 100 : 0;
          const color = theme === "Non classé" ? NON_CLASSE_COLOR : MATHS_THEME_COLORS[theme];
          return html`
            <li key=${theme}>
              <div class="flex items-center justify-between text-sm mb-1 gap-2">
                <span class="flex items-center gap-1.5 font-medium text-slate-700 truncate">
                  <span class="h-2 w-2 rounded-full shrink-0" style=${{ backgroundColor: color }}></span>
                  ${theme}
                </span>
                <span class="text-slate-500 whitespace-nowrap">
                  <span class="font-semibold text-slate-800">${formatDuration(mins)}</span>
                  <span class="text-slate-400"> · ${pct.toFixed(0)}%</span>
                </span>
              </div>
              <div class="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div class="h-full rounded-full" style=${{ width: `${pct}%`, backgroundColor: color }}></div>
              </div>
            </li>
          `;
        })}
      </ul>
      ${minutesByTheme["Non classé"] &&
      html`
        <p class="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
          "Non classé" = créneaux ou sessions Maths sans thème choisi — ajoute un thème dans le formulaire pour les répartir.
        </p>
      `}
    <//>
  `;
}
