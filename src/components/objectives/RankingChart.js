import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
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

export function RankingChart() {
  const { data } = useCarnet();
  const cbs = [...data.concours_blancs]
    .filter((cb) => cb.classement_section !== null || cb.classement_promo !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const chartData = cbs.map((cb) => ({
    date: formatDateShortFr(cb.date),
    "Rang section": cb.classement_section,
    "Rang promo": cb.classement_promo,
  }));

  return html`
    <${Card} title="Évolution du classement" subtitle="Rang section et promo (plus bas = meilleur)">
      ${chartData.length === 0
        ? html`<${EmptyState} text="Renseigne les classements d'un CB pour voir la courbe." />`
        : html`
            <div style=${{ width: "100%", height: 300 }}>
              <${ResponsiveContainer} width="100%" height="100%">
                <${LineChart} data=${chartData} margin=${{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <${CartesianGrid} strokeDasharray="3 3" stroke="#E2E8F0" />
                  <${XAxis} dataKey="date" tick=${{ fontSize: 12 }} stroke="#94A3B8" />
                  <${YAxis} reversed tick=${{ fontSize: 12 }} stroke="#94A3B8" allowDecimals=${false} />
                  <${Tooltip} />
                  <${Legend} wrapperStyle=${{ fontSize: 12 }} />
                  <${Line}
                    type="monotone"
                    dataKey="Rang section"
                    stroke="#2563EB"
                    strokeWidth=${2}
                    dot=${{ r: 3 }}
                    connectNulls
                    isAnimationActive=${false}
                  />
                  <${Line}
                    type="monotone"
                    dataKey="Rang promo"
                    stroke="#DC2626"
                    strokeWidth=${2}
                    dot=${{ r: 3 }}
                    connectNulls
                    isAnimationActive=${false}
                  />
                <//>
              <//>
            </div>
          `}
    <//>
  `;
}
