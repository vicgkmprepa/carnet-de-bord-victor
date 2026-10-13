import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import { CB_MATIERES, CHART_COLORS } from "../../lib/subjectMapping.js";
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

export function GradesEvolutionChart() {
  const { data } = useCarnet();
  const cbs = [...data.concours_blancs].sort((a, b) => a.date.localeCompare(b.date));

  const chartData = cbs.map((cb) => {
    const row = { date: formatDateShortFr(cb.date), nom: cb.nom };
    for (const m of cb.matieres) {
      row[m.nom] = m.note_obtenue === null || m.note_obtenue === undefined ? null : Number(m.note_obtenue);
    }
    return row;
  });

  const hasAnyGrade = chartData.some((row) => CB_MATIERES.some((m) => row[m] !== null && row[m] !== undefined));

  return html`
    <${Card} title="Évolution des notes" subtitle="Toutes matières, par concours blanc">
      ${!hasAnyGrade
        ? html`<${EmptyState} text="Ajoute un concours blanc avec des notes pour voir la courbe." />`
        : html`
            <div style=${{ width: "100%", height: 320 }}>
              <${ResponsiveContainer} width="100%" height="100%">
                <${LineChart} data=${chartData} margin=${{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <${CartesianGrid} strokeDasharray="3 3" stroke="#E2E8F0" />
                  <${XAxis} dataKey="date" tick=${{ fontSize: 12 }} stroke="#94A3B8" />
                  <${YAxis} domain=${[0, 20]} tick=${{ fontSize: 12 }} stroke="#94A3B8" />
                  <${Tooltip} />
                  <${Legend} wrapperStyle=${{ fontSize: 12 }} />
                  ${CB_MATIERES.map(
                    (m) => html`
                      <${Line}
                        key=${m}
                        type="monotone"
                        dataKey=${m}
                        stroke=${CHART_COLORS[m]}
                        strokeWidth=${2}
                        dot=${{ r: 3 }}
                        connectNulls
                        isAnimationActive=${false}
                      />
                    `
                  )}
                <//>
              <//>
            </div>
          `}
    <//>
  `;
}
