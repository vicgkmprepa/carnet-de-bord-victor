import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { EmptyState } from "../common/EmptyState.js";
import { CHART_COLORS } from "../../lib/subjectMapping.js";
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

export function GradeTrendChart({ tab }) {
  const { data } = useCarnet();
  const cbs = [...data.concours_blancs].sort((a, b) => a.date.localeCompare(b.date));

  const chartData = cbs.map((cb) => {
    const row = { date: formatDateShortFr(cb.date), nom: cb.nom };
    for (const nomMatiere of tab.cbMatieres) {
      const m = cb.matieres.find((x) => x.nom === nomMatiere);
      row[nomMatiere] = m && m.note_obtenue !== null && m.note_obtenue !== undefined ? Number(m.note_obtenue) : null;
    }
    return row;
  });

  const hasAny = chartData.some((row) => tab.cbMatieres.some((m) => row[m] !== null && row[m] !== undefined));

  return html`
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h3 class="text-base font-semibold text-slate-800 mb-4">Évolution des notes</h3>
      ${!hasAny
        ? html`<${EmptyState} text="Pas encore de note dans cette matière." />`
        : html`
            <div style=${{ width: "100%", height: 260 }}>
              <${ResponsiveContainer} width="100%" height="100%">
                <${LineChart} data=${chartData} margin=${{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <${CartesianGrid} strokeDasharray="3 3" stroke="#E2E8F0" />
                  <${XAxis} dataKey="date" tick=${{ fontSize: 12 }} stroke="#94A3B8" />
                  <${YAxis} domain=${[0, 20]} tick=${{ fontSize: 12 }} stroke="#94A3B8" />
                  <${Tooltip} />
                  ${tab.cbMatieres.length > 1 && html`<${Legend} wrapperStyle=${{ fontSize: 12 }} />`}
                  ${tab.cbMatieres.map(
                    (m) => html`
                      <${Line}
                        key=${m}
                        type="monotone"
                        dataKey=${m}
                        name=${m}
                        stroke=${CHART_COLORS[m] || tab.accent}
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
          `}
    </div>
  `;
}
