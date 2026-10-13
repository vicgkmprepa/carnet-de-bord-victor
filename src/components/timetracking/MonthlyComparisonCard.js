import { html } from "../../lib/htm.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import { subjectAccent, subjectLabel, SUBJECT_TABS } from "../../lib/subjectMapping.js";
import { formatDuration } from "../../lib/scheduleUtils.js";
import { formatMonthFr } from "../../lib/dateUtils.js";
import { matieresPresentes } from "../../lib/workTimeStats.js";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer } from "../../lib/recharts.js";

const NB_MOIS = 6;

export function MonthlyComparisonCard({ months }) {
  const recent = months.slice(-NB_MOIS);
  const matieres = matieresPresentes(recent, SUBJECT_TABS);

  const chartData = recent.map((m) => {
    const row = { mois: formatMonthFr(m.month), ...Object.fromEntries(matieres.map((mat) => [mat, Math.round(m.byMatiere[mat] || 0)])) };
    row.total = matieres.reduce((acc, mat) => acc + row[mat], 0);
    return row;
  });

  return html`
    <${Card} title="Comparaison mensuelle" subtitle=${`${Math.min(NB_MOIS, recent.length) > 1 ? `Les ${Math.min(NB_MOIS, recent.length)} derniers mois` : "Le dernier mois"} avec du travail enregistré`}>
      ${recent.length === 0
        ? html`<${EmptyState} text="Pas encore assez de données pour comparer les mois." />`
        : html`
            <div style=${{ width: "100%", height: 300 }}>
              <${ResponsiveContainer} width="100%" height="100%">
                <${BarChart} data=${chartData} margin=${{ top: 20, right: 10, left: -10, bottom: 0 }}>
                  <${CartesianGrid} strokeDasharray="3 3" stroke="#E2E8F0" />
                  <${XAxis} dataKey="mois" tick=${{ fontSize: 11 }} stroke="#94A3B8" />
                  <${YAxis} tick=${{ fontSize: 11 }} stroke="#94A3B8" />
                  <${Tooltip} formatter=${(v) => formatDuration(v)} />
                  ${matieres.map(
                    (m, i) => html`
                      <${Bar} key=${m} dataKey=${m} stackId="mois" fill=${subjectAccent(m)} isAnimationActive=${false}>
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
