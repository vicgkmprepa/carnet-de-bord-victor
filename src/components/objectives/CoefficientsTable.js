import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { CB_MATIERES, CB_TO_COEF } from "../../lib/subjectMapping.js";

const NB_ECOLES = 3;

// Tableau brut des coefficients des 3 premières écoles (ordre piloté par les
// données, jamais de nom en dur) — vue d'ensemble rapide, complémentaire au
// détail matière par matière déjà disponible ailleurs (Temps de travail).
export function CoefficientsTable() {
  const { data } = useCarnet();
  const ecoles = data.ecoles.slice(0, NB_ECOLES);

  if (ecoles.length === 0) return null;

  return html`
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h3 class="font-semibold text-slate-800">Coefficients — ${ecoles.length === 1 ? "1ère école" : `${ecoles.length} premières écoles`}</h3>
      <div class="overflow-x-auto mt-3">
        <table class="w-full text-sm min-w-[420px]">
          <thead>
            <tr class="text-left text-slate-500">
              <th class="py-1.5 px-2 font-medium">Matière</th>
              ${ecoles.map((e) => html`<th key=${e.nom} class="py-1.5 px-2 font-medium text-right">${e.nom}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${CB_MATIERES.map(
              (mat, i) => html`
                <tr key=${mat} class=${`border-t border-slate-100 ${i % 2 === 1 ? "bg-slate-50" : ""}`}>
                  <td class="py-1.5 px-2 text-slate-700">${mat}</td>
                  ${ecoles.map((e) => {
                    const coef = e.coefficients ? e.coefficients[CB_TO_COEF[mat]] : undefined;
                    return html`<td key=${e.nom} class="py-1.5 px-2 text-right tabular-nums text-slate-600 font-medium">${typeof coef === "number" ? coef : "—"}</td>`;
                  })}
                </tr>
              `
            )}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
