import { html } from "../../lib/htm.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import { subjectAccent, subjectLabel, SUBJECT_TABS } from "../../lib/subjectMapping.js";
import { formatDuration } from "../../lib/scheduleUtils.js";
import { formatDateShortFr } from "../../lib/dateUtils.js";
import { matieresPresentes } from "../../lib/workTimeStats.js";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer } from "../../lib/recharts.js";

export const NB_SEMAINES = 10;

export function WeeksEvolutionCard({ weeks, onPrev, onNext, canPrev, canNext, onReset, canReset, onSelectWeek }) {
  const recent = weeks;
  const matieres = matieresPresentes(recent, SUBJECT_TABS);

  const chartData = recent.map((w) => {
    const row = {
      semaine: formatDateShortFr(w.semaine),
      date: w.semaine,
      ...Object.fromEntries(matieres.map((m) => [m, Math.round(w.byMatiere[m] || 0)])),
    };
    row.total = matieres.reduce((acc, m) => acc + row[m], 0);
    return row;
  });

  const actions = html`
    <div class="flex items-center gap-2">
      ${canReset &&
      html`
        <button class="text-xs text-slate-400 hover:text-slate-700 underline decoration-dotted" onClick=${onReset} title="Revenir aux semaines les plus récentes">
          Réinitialiser
        </button>
      `}
      <button
        class="h-7 w-7 rounded-full border border-slate-300 text-slate-500 hover:bg-slate-100 flex items-center justify-center text-xs shrink-0 disabled:opacity-40 disabled:hover:bg-white"
        onClick=${onPrev}
        disabled=${!canPrev}
        title="Semaines précédentes"
      >
        ←
      </button>
      <button
        class="h-7 w-7 rounded-full border border-slate-300 text-slate-500 hover:bg-slate-100 flex items-center justify-center text-xs shrink-0 disabled:opacity-40 disabled:hover:bg-white"
        onClick=${onNext}
        disabled=${!canNext}
        title="Semaines suivantes"
      >
        →
      </button>
    </div>
  `;

  return html`
    <${Card} title="Évolution sur plusieurs semaines" subtitle="Semaines avec du travail enregistré" actions=${actions}>
      ${recent.length === 0
        ? html`<${EmptyState} text="Pas encore assez de données pour voir une évolution." />`
        : html`
            <div style=${{ width: "100%", height: 300 }}>
              <${ResponsiveContainer} width="100%" height="100%">
                <${BarChart} data=${chartData} margin=${{ top: 20, right: 10, left: -10, bottom: 0 }}>
                  <${CartesianGrid} strokeDasharray="3 3" stroke="#E2E8F0" />
                  <${XAxis} dataKey="semaine" tick=${{ fontSize: 11 }} stroke="#94A3B8" />
                  <${YAxis} tick=${{ fontSize: 11 }} stroke="#94A3B8" />
                  <${Tooltip} formatter=${(v) => formatDuration(v)} />
                  ${matieres.map(
                    (m, i) => html`
                      <${Bar}
                        key=${m}
                        dataKey=${m}
                        stackId="semaine"
                        fill=${subjectAccent(m)}
                        isAnimationActive=${false}
                        cursor="pointer"
                        onClick=${(row) => onSelectWeek(row.date)}
                      >
                        ${i === matieres.length - 1 &&
                        html`<${LabelList}
                          dataKey="total"
                          position="top"
                          formatter=${(v) => formatDuration(v)}
                          style=${{ fontSize: 10, fill: "#475569", fontWeight: 600 }}
                        />`}
                      <//>
                    `
                  )}
                <//>
              <//>
            </div>
            <ul class="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs">
              ${matieres.map(
                (m) => html`
                  <li key=${m} class="flex items-center gap-1.5">
                    <span class="h-2 w-2 rounded-full shrink-0" style=${{ backgroundColor: subjectAccent(m) }}></span>
                    <span class="text-slate-500">${subjectLabel(m)}</span>
                  </li>
                `
              )}
            </ul>
          `}
    <//>
  `;
}
