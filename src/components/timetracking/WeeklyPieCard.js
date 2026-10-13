import { html } from "../../lib/htm.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import { subjectAccent, subjectLabel } from "../../lib/subjectMapping.js";
import { formatDuration } from "../../lib/scheduleUtils.js";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "../../lib/recharts.js";

export function WeeklyPieCard({ week, isCurrentWeek }) {
  const entries = Object.entries(week.byMatiere).sort((a, b) => b[1] - a[1]);

  return html`
    <${Card} title="Répartition par matière" subtitle=${isCurrentWeek ? "Cette semaine" : "Semaine sélectionnée"}>
      ${entries.length === 0
        ? html`<${EmptyState} text="Aucune session de travail réalisée cette semaine-là." />`
        : html`
            <div style=${{ width: "100%", height: 260 }}>
              <${ResponsiveContainer} width="100%" height="100%">
                <${PieChart}>
                  <${Pie}
                    data=${entries.map(([matiere, minutes]) => ({ name: subjectLabel(matiere), matiere, minutes }))}
                    dataKey="minutes"
                    nameKey="name"
                    innerRadius=${55}
                    outerRadius=${90}
                    paddingAngle=${2}
                    isAnimationActive=${false}
                  >
                    ${entries.map(
                      ([matiere]) => html`<${Cell} key=${matiere} fill=${subjectAccent(matiere)} stroke="#fff" strokeWidth=${2} />`
                    )}
                  <//>
                  <${Tooltip} formatter=${(v) => formatDuration(v)} />
                <//>
              <//>
            </div>
            <ul class="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 text-xs">
              ${entries.map(
                ([matiere, minutes]) => html`
                  <li key=${matiere} class="flex items-center gap-1.5">
                    <span class="h-2 w-2 rounded-full shrink-0" style=${{ backgroundColor: subjectAccent(matiere) }}></span>
                    <span class="text-slate-500">${subjectLabel(matiere)}</span>
                    <span class="font-semibold text-slate-800">${formatDuration(minutes)}</span>
                  </li>
                `
              )}
            </ul>
          `}
    <//>
  `;
}
