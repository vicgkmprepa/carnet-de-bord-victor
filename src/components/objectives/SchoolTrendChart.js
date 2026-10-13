import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import { weightedAverageForSchool } from "../../lib/weightedAverage.js";
import { ECOLE_COLORS } from "../../lib/subjectMapping.js";
import { formatDateShortFr } from "../../lib/dateUtils.js";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "../../lib/recharts.js";

export function SchoolTrendChart() {
  const { data } = useCarnet();
  const cbs = [...data.concours_blancs].sort((a, b) => a.date.localeCompare(b.date));

  const chartData = cbs.map((cb) => {
    const row = { date: formatDateShortFr(cb.date) };
    for (const ecole of data.ecoles) {
      row[ecole.nom] = weightedAverageForSchool(cb, ecole);
    }
    return row;
  });

  const dernieresValeurs = data.ecoles.map((ecole) => ({
    ecole,
    valeur: chartData.length ? chartData[chartData.length - 1][ecole.nom] : null,
  }));

  return html`
    <${Card} title="Tendance moyennes pondérées" subtitle="Par école, sur tous les CB">
      ${chartData.length === 0
        ? html`<${EmptyState} text="Ajoute des CB pour voir la tendance par école." />`
        : html`
            <div style=${{ width: "100%", height: 300 }}>
              <${ResponsiveContainer} width="100%" height="100%">
                <${LineChart} data=${chartData} margin=${{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <${CartesianGrid} strokeDasharray="3 3" stroke="#E2E8F0" />
                  <${XAxis} dataKey="date" tick=${{ fontSize: 12 }} stroke="#94A3B8" />
                  <${YAxis} domain=${[0, 20]} tick=${{ fontSize: 12 }} stroke="#94A3B8" />
                  <${Tooltip} formatter=${(v) => (v === null || v === undefined ? "—" : Number(v).toFixed(2))} />
                  ${data.ecoles.map(
                    (ecole) => html`
                      <${Line}
                        key=${ecole.nom}
                        type="monotone"
                        dataKey=${ecole.nom}
                        stroke=${ECOLE_COLORS[ecole.nom] || "#0F172A"}
                        strokeWidth=${2.5}
                        dot=${{ r: 3 }}
                        activeDot=${{ r: 5 }}
                        connectNulls
                        isAnimationActive=${false}
                      />
                    `
                  )}
                <//>
              <//>
            </div>
            <ul class="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs">
              ${dernieresValeurs.map(
                ({ ecole, valeur }) => html`
                  <li key=${ecole.nom} class="flex items-center gap-1.5">
                    <span
                      class="h-2 w-2 rounded-full shrink-0"
                      style=${{ backgroundColor: ECOLE_COLORS[ecole.nom] || "#0F172A" }}
                    ></span>
                    <span class="text-slate-500">${ecole.nom}</span>
                    <span class="font-semibold text-slate-800"
                      >${valeur === null || valeur === undefined ? "—" : Number(valeur).toFixed(2)}</span
                    >
                  </li>
                `
              )}
            </ul>
          `}
    <//>
  `;
}
