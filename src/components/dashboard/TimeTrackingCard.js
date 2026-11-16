import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import { subjectAccent, subjectLabel } from "../../lib/subjectMapping.js";
import { durationMinutes, formatDuration, mondayOf, addDaysStr } from "../../lib/scheduleUtils.js";
import { minutesRealiseesParMatiere } from "../../lib/workTimeStats.js";

export function TimeTrackingCard() {
  const { data, today } = useCarnet();
  // Seules les sessions de travail perso comptent (les "cours" et l'"autre" libre n'entrent
  // jamais dans le temps de travail par matière). "Général" n'est pas une matière à
  // proprement parler, exclu de ce suivi par matière.
  const creneaux = data.emploi_du_temps.creneaux.filter((c) => c.type === "travail" && c.matiere !== "Général");

  if (creneaux.length === 0 && data.sessions_ponctuelles.length === 0) {
    return html`
      <${Card} title="Temps de travail par matière" subtitle="D'après l'agenda">
        <${EmptyState} text="Ajoute des sessions de travail dans l'onglet Agenda pour suivre ton temps par matière." />
      <//>
    `;
  }

  const monday = mondayOf(today);
  const sessionsSemaine = data.sessions_ponctuelles.filter(
    (s) => mondayOf(s.date) === monday && s.matiere !== "Général"
  );

  const planifie = {};
  for (const c of creneaux) {
    const mins = durationMinutes(c.debut, c.fin);
    planifie[c.matiere] = (planifie[c.matiere] || 0) + mins;
  }
  for (const s of sessionsSemaine) {
    if (s.estCours) continue;
    const mins = durationMinutes(s.debut, s.fin);
    planifie[s.matiere] = (planifie[s.matiere] || 0) + mins;
  }
  // Réalisé (créneaux + sessions + colles), dédoublonné par chevauchement
  // horaire : une colle qui tombe sur un créneau de travail ne compte l'horaire
  // commun qu'une fois (cf. workTimeStats).
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysStr(monday, i));
  const realise = minutesRealiseesParMatiere(data, weekDays);

  const keys = [...new Set([...Object.keys(planifie), ...Object.keys(realise)])];
  const stats = keys
    .map((key) => {
      const p = planifie[key] || 0;
      const r = realise[key] || 0;
      return { key, planifie: p, realise: r, pct: p > 0 ? Math.min(100, (r / p) * 100) : r > 0 ? 100 : 0 };
    })
    .sort((a, b) => b.realise - a.realise);

  return html`
    <${Card} title="Temps de travail par matière" subtitle="Cette semaine, réalisé (colles incluses) vs planifié dans l'Agenda">
      <ul class="space-y-3">
        ${stats.map(
          ({ key, planifie: p, realise: r, pct }) => html`
            <li key=${key}>
              <div class="flex items-center justify-between text-sm mb-1 gap-2">
                <span class="flex items-center gap-1.5 font-medium text-slate-700 truncate">
                  <span class="h-2 w-2 rounded-full shrink-0" style=${{ backgroundColor: subjectAccent(key) }}></span>
                  ${subjectLabel(key)}
                </span>
                <span class="text-slate-500 whitespace-nowrap">
                  <span class="font-semibold text-slate-800">${formatDuration(r)}</span>
                  <span class="text-slate-400"> / ${formatDuration(p)}</span>
                </span>
              </div>
              <div class="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div class="h-full rounded-full" style=${{ width: `${pct}%`, backgroundColor: subjectAccent(key) }}></div>
              </div>
            </li>
          `
        )}
      </ul>
    <//>
  `;
}
