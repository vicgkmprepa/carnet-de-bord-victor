import { html } from "../../lib/htm.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import { subjectAccent, subjectLabel, SUBJECT_TABS } from "../../lib/subjectMapping.js";
import { formatDuration } from "../../lib/scheduleUtils.js";
import { matieresPresentes } from "../../lib/workTimeStats.js";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer } from "../../lib/recharts.js";

export function DailyBreakdownCard({ days, onPrev, onNext, canNext, onReset, canReset, onSelectDay }) {
  const matieres = matieresPresentes(days, SUBJECT_TABS);
  const hasData = days.some((d) => d.total > 0);

  const chartData = days.map((d) => {
    const row = { jour: d.jour.label, date: d.date, ...Object.fromEntries(matieres.map((m) => [m, Math.round(d.byMatiere[m] || 0)])) };
    row.total = matieres.reduce((acc, m) => acc + row[m], 0);
    return row;
  });

  const actions = html`
    <div class="flex items-center gap-2">
      ${canReset &&
      html`
        <button class="text-xs text-slate-400 hover:text-slate-700 underline decoration-dotted" onClick=${onReset} title="Revenir à aujourd'hui">
          Réinitialiser
        </button>
      `}
      <button
        class="h-7 w-7 rounded-full border border-slate-300 text-slate-500 hover:bg-slate-100 flex items-center justify-center text-xs shrink-0"
        onClick=${onPrev}
        title="7 jours précédents"
      >
        ←
      </button>
      <button
        class="h-7 w-7 rounded-full border border-slate-300 text-slate-500 hover:bg-slate-100 flex items-center justify-center text-xs shrink-0 disabled:opacity-40 disabled:hover:bg-white"
        onClick=${onNext}
        disabled=${!canNext}
        title="7 jours suivants"
      >
        →
      </button>
    </div>
  `;

  return html`
    <${Card}
      title="Détail par jour"
      subtitle="7 jours glissants, heures travaillées par jour"
      actions=${actions}
    >
      ${!hasData
        ? html`<${EmptyState} text="Aucune session de travail réalisée sur cette période." />`
        : html`
            <div style=${{ width: "100%", height: 260 }}>
              <${ResponsiveContainer} width="100%" height="100%">
                <${BarChart} data=${chartData} margin=${{ top: 20, right: 10, left: -10, bottom: 0 }}>
                  <${CartesianGrid} strokeDasharray="3 3" stroke="#E2E8F0" />
                  <${XAxis} dataKey="jour" tick=${{ fontSize: 11 }} stroke="#94A3B8" />
                  <${YAxis} tick=${{ fontSize: 11 }} stroke="#94A3B8" />
                  <${Tooltip} formatter=${(v) => formatDuration(v)} />
                  ${matieres.map(
                    (m, i) => html`
                      <${Bar}
                        key=${m}
                        dataKey=${m}
                        stackId="jour"
                        fill=${subjectAccent(m)}
                        isAnimationActive=${false}
                        cursor="pointer"
                        onClick=${(row) => onSelectDay(row.date)}
                      >
                        ${i === matieres.length - 1 &&
                        html`<${LabelList}
                          dataKey="total"
                          position="top"
                          formatter=${(v) => (v > 0 ? formatDuration(v) : "")}
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
