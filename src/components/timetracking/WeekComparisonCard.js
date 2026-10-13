import { html } from "../../lib/htm.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import { subjectLabel, SUBJECT_TABS } from "../../lib/subjectMapping.js";
import { formatDuration } from "../../lib/scheduleUtils.js";
import { matieresPresentes } from "../../lib/workTimeStats.js";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ResponsiveContainer,
} from "../../lib/recharts.js";

// Gris neutre pour la semaine précédente (référence, en retrait), indigo vif pour
// la semaine sélectionnée (mise en avant) — contraste fort pour ne pas confondre
// les deux séries au premier coup d'œil.
const SEMAINE_PRECEDENTE = "#CBD5E1";
const SEMAINE_ACTUELLE = "#4F46E5";

export function WeekComparisonCard({ currentWeek, previousWeek, isCurrentWeek }) {
  const matieres = matieresPresentes([currentWeek, previousWeek], SUBJECT_TABS);
  const labelActuelle = isCurrentWeek ? "Cette semaine" : "Semaine sélectionnée";

  const chartData = matieres.map((m) => ({
    matiere: subjectLabel(m),
    "Semaine précédente": Math.round(previousWeek.byMatiere[m] || 0),
    [labelActuelle]: Math.round(currentWeek.byMatiere[m] || 0),
  }));

  return html`
    <${Card} title=${`${labelActuelle} vs semaine précédente`} subtitle="Minutes de travail perso, par matière">
      ${matieres.length === 0
        ? html`<${EmptyState} text="Pas encore de données sur ces deux semaines." />`
        : html`
            <div style=${{ width: "100%", height: 280 }}>
              <${ResponsiveContainer} width="100%" height="100%">
                <${BarChart} data=${chartData} margin=${{ top: 20, right: 10, left: -10, bottom: 0 }}>
                  <${CartesianGrid} strokeDasharray="3 3" stroke="#E2E8F0" />
                  <${XAxis} dataKey="matiere" tick=${{ fontSize: 11 }} stroke="#94A3B8" />
                  <${YAxis} tick=${{ fontSize: 11 }} stroke="#94A3B8" />
                  <${Tooltip} formatter=${(v) => formatDuration(v)} />
                  <${Legend} wrapperStyle=${{ fontSize: 12 }} />
                  <${Bar} dataKey="Semaine précédente" fill=${SEMAINE_PRECEDENTE} radius=${[4, 4, 0, 0]} isAnimationActive=${false}>
                    <${LabelList}
                      dataKey="Semaine précédente"
                      position="top"
                      formatter=${(v) => (v > 0 ? formatDuration(v) : "")}
                      style=${{ fontSize: 10, fill: "#94A3B8" }}
                    />
                  <//>
                  <${Bar} dataKey=${labelActuelle} fill=${SEMAINE_ACTUELLE} radius=${[4, 4, 0, 0]} isAnimationActive=${false}>
                    <${LabelList}
                      dataKey=${labelActuelle}
                      position="top"
                      formatter=${(v) => (v > 0 ? formatDuration(v) : "")}
                      style=${{ fontSize: 10, fill: "#4F46E5", fontWeight: 600 }}
                    />
                  <//>
                <//>
              <//>
            </div>
          `}
    <//>
  `;
}
