import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { Card } from "../common/Card.js";
import { EmptyState } from "../common/EmptyState.js";
import { weightedAverageForSchool, latestCBWithNotes } from "../../lib/weightedAverage.js";
import { ECOLE_COLORS } from "../../lib/subjectMapping.js";
import {
  ComposedChart,
  Bar,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "../../lib/recharts.js";

// Petit trait horizontal noir (façon "cible") positionné exactement au-dessus de
// chaque barre, à la hauteur de la barre d'admissibilité de l'école correspondante.
// Un halo blanc assure la lisibilité au premier plan quel que soit la couleur de la
// barre en dessous. Une coche verte apparaît quand la moyenne dépasse la barre.
function BarreTick({ cx, cy, payload }) {
  if (cx === undefined || cy === undefined) return null;
  const halfWidth = 20;
  const atteint =
    payload && payload.moyenne !== null && payload.moyenne !== undefined && payload.moyenne >= payload.barre;
  return html`
    <g>
      <line x1=${cx - halfWidth} x2=${cx + halfWidth} y1=${cy} y2=${cy} stroke="#fff" strokeWidth=${5} strokeLinecap="round" />
      <line x1=${cx - halfWidth} x2=${cx + halfWidth} y1=${cy} y2=${cy} stroke="#0F172A" strokeWidth=${2.5} strokeLinecap="round" />
      <line x1=${cx - halfWidth} x2=${cx - halfWidth} y1=${cy - 5} y2=${cy + 5} stroke="#0F172A" strokeWidth=${2} />
      <line x1=${cx + halfWidth} x2=${cx + halfWidth} y1=${cy - 5} y2=${cy + 5} stroke="#0F172A" strokeWidth=${2} />
      ${atteint &&
      html`
        <g transform=${`translate(${cx - 8}, ${cy - 24})`}>
          <circle cx="8" cy="8" r="9" fill="#16A34A" stroke="#fff" strokeWidth="1.5" />
          <path d="M4 8.3 L6.8 11 L12 4.8" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      `}
    </g>
  `;
}

export function SchoolAverageChart() {
  const { data } = useCarnet();
  const cbs = [...data.concours_blancs].sort((a, b) => a.date.localeCompare(b.date));
  const dernierCB = latestCBWithNotes(cbs);

  if (!dernierCB) {
    return html`
      <${Card} title="Moyennes pondérées par école" subtitle="Dernier concours blanc">
        <${EmptyState} text="Renseigne des notes obtenues sur un concours blanc pour voir les moyennes pondérées." />
      <//>
    `;
  }

  const chartData = data.ecoles.map((ecole) => ({
    nom: ecole.nom,
    moyenne: weightedAverageForSchool(dernierCB, ecole),
    barre: ecole.barre_admissibilite_2026,
  }));

  return html`
    <${Card} title="Moyennes pondérées par école" subtitle=${`Basé sur ${dernierCB.nom} (${dernierCB.date})`}>
      <div style=${{ width: "100%", height: 320 }}>
        <${ResponsiveContainer} width="100%" height="100%">
          <${ComposedChart} data=${chartData} margin=${{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <${CartesianGrid} strokeDasharray="3 3" stroke="#E2E8F0" />
            <${XAxis} dataKey="nom" tick=${{ fontSize: 12 }} stroke="#94A3B8" />
            <${YAxis} domain=${[0, 20]} tick=${{ fontSize: 12 }} stroke="#94A3B8" />
            <${Tooltip} formatter=${(v) => (v === null || v === undefined ? "—" : Number(v).toFixed(2))} />
            <${Bar} dataKey="moyenne" radius=${[6, 6, 0, 0]} barSize=${40} isAnimationActive=${false}>
              ${chartData.map((d) => html`<${Cell} key=${d.nom} fill=${ECOLE_COLORS[d.nom] || "#0F172A"} />`)}
            <//>
            <${Scatter} dataKey="barre" shape=${BarreTick} isAnimationActive=${false} />
          <//>
        <//>
      </div>
      <ul class="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-slate-500">
        ${data.ecoles.map(
          (ecole) => html`
            <li key=${ecole.nom} class="flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full shrink-0" style=${{ backgroundColor: ECOLE_COLORS[ecole.nom] || "#0F172A" }}></span>
              <span>${ecole.nom} — barre ${ecole.barre_admissibilite_2026}</span>
            </li>
          `
        )}
      </ul>
    <//>
  `;
}
