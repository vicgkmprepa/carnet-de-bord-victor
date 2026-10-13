import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { formatDateFr } from "../../lib/dateUtils.js";
import { EmptyState } from "../common/EmptyState.js";
import { CBForm } from "./CBForm.js";
import { weightedAverageForSchool } from "../../lib/weightedAverage.js";
import { ECOLE_COLORS } from "../../lib/subjectMapping.js";

function percentile(rank, effectif) {
  if (!rank || !effectif) return null;
  return (rank / effectif) * 100;
}

function deltaClass(delta) {
  if (delta === null) return "text-slate-300";
  return delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-slate-400";
}

function formatDelta(delta, decimals = 2) {
  if (delta === null) return null;
  const rounded = Number(delta.toFixed(decimals));
  if (rounded === 0) return "±0";
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(decimals)}`;
}

export function CBList() {
  const { data, updateCB, deleteCB } = useCarnet();
  const [editingId, setEditingId] = useState(null);
  const cbsAsc = [...data.concours_blancs].sort((a, b) => a.date.localeCompare(b.date));
  const cbs = [...cbsAsc].reverse();

  if (cbs.length === 0) {
    return html`<${EmptyState} text="Aucun concours blanc pour l'instant." />`;
  }

  return html`
    <div class="space-y-4">
      ${cbs.map((cb) => {
        const idx = cbsAsc.findIndex((x) => x.id === cb.id);
        const previousCb = idx > 0 ? cbsAsc[idx - 1] : null;
        return editingId === cb.id
          ? html`
              <${CBForm}
                key=${cb.id}
                initialCB=${cb}
                onSubmit=${(patch) => {
                  updateCB(cb.id, patch);
                  setEditingId(null);
                }}
                onCancel=${() => setEditingId(null)}
              />
            `
          : html`
              <${CBCard}
                key=${cb.id}
                cb=${cb}
                previousCb=${previousCb}
                ecoles=${data.ecoles}
                onEdit=${() => setEditingId(cb.id)}
                onDelete=${() => {
                  if (confirm(`Supprimer ${cb.nom} ?`)) deleteCB(cb.id);
                }}
              />
            `;
      })}
    </div>
  `;
}

const COEFFS_SAINT_JEAN = { "Maths I": 5, "Maths II": 3, HGG: 8, Anglais: 4.5, Espagnol: 2.5, CG: 4.5, "Synthèse": 2.5 };

// Total sur 600 (coeffs cumulés = 30 × 20) ; null tant qu'une des 7 notes manque
// pour ne pas afficher un total partiel trompeur.
function pointsSaintJean(cb) {
  let total = 0;
  for (const [nom, coeff] of Object.entries(COEFFS_SAINT_JEAN)) {
    const note = cb.matieres.find((m) => m.nom === nom)?.note_obtenue;
    if (note === null || note === undefined) return null;
    total += note * coeff;
  }
  return total;
}

function CBCard({ cb, previousCb, ecoles, onEdit, onDelete }) {
  const pctSection = percentile(cb.classement_section, cb.effectif_section);
  const pctPromo = percentile(cb.classement_promo, cb.effectif_promo);

  const moyenneParEcole = ecoles.map((ecole) => {
    const moyenne = weightedAverageForSchool(cb, ecole);
    let delta = null;
    if (previousCb) {
      const moyennePrec = weightedAverageForSchool(previousCb, ecole);
      if (moyenne !== null && moyennePrec !== null) delta = moyenne - moyennePrec;
    }
    return { ecole, moyenne, delta };
  });

  return html`
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div class="flex items-start justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h3 class="font-semibold text-slate-800">${cb.nom}</h3>
          <p class="text-sm text-slate-500">${formatDateFr(cb.date)}</p>
        </div>
        <div class="flex items-center gap-3 text-sm">
          <button class="text-slate-500 hover:text-slate-800" onClick=${onEdit}>Modifier</button>
          <button class="text-slate-300 hover:text-red-500" onClick=${onDelete}>Supprimer</button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm min-w-[560px]">
          <thead>
            <tr class="text-left text-slate-500">
              <th class="py-1.5 font-medium">Matière</th>
              <th class="py-1.5 font-medium">Objectif</th>
              <th class="py-1.5 font-medium">Obtenue</th>
              <th class="py-1.5 font-medium">Écart</th>
              <th class="py-1.5 font-medium">Évolution</th>
            </tr>
          </thead>
          <tbody>
            ${cb.matieres.map((m) => {
              const hasEcart =
                m.note_objectif !== null &&
                m.note_objectif !== undefined &&
                m.note_obtenue !== null &&
                m.note_obtenue !== undefined;
              const ecart = hasEcart ? Number(m.note_obtenue) - Number(m.note_objectif) : null;

              let evolution = null;
              if (previousCb && m.note_obtenue !== null && m.note_obtenue !== undefined) {
                const mPrec = previousCb.matieres.find((x) => x.nom === m.nom);
                if (mPrec && mPrec.note_obtenue !== null && mPrec.note_obtenue !== undefined) {
                  evolution = Number(m.note_obtenue) - Number(mPrec.note_obtenue);
                }
              }

              return html`
                <tr key=${m.nom} class="border-t border-slate-100">
                  <td class="py-1.5 font-medium text-slate-700">${m.nom}</td>
                  <td class="py-1.5 text-slate-600">${m.note_objectif ?? "—"}</td>
                  <td class="py-1.5 text-slate-600">${m.note_obtenue ?? "—"}</td>
                  <td
                    class=${`py-1.5 font-semibold ${
                      ecart === null ? "text-slate-300" : ecart >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    ${ecart === null ? "—" : `${ecart >= 0 ? "+" : ""}${ecart.toFixed(2)}`}
                  </td>
                  <td class=${`py-1.5 font-medium ${deltaClass(evolution)}`}>
                    ${evolution === null
                      ? "—"
                      : html`${formatDelta(evolution)} <span class="text-slate-400 font-normal">vs ${previousCb.nom}</span>`}
                  </td>
                </tr>
                ${m.causes_erreur &&
                m.causes_erreur.length > 0 &&
                html`
                  <tr key=${m.nom + "-causes"}>
                    <td colspan="5" class="pb-1.5">
                      <div class="flex flex-wrap gap-1">
                        ${m.causes_erreur.map(
                          (c) => html`<span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">${c}</span>`
                        )}
                      </div>
                    </td>
                  </tr>
                `}
              `;
            })}
          </tbody>
        </table>
      </div>

      <p class="text-xs font-medium text-slate-500 mt-4 mb-2">Moyenne par école (/20)</p>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
        ${moyenneParEcole.map(({ ecole, moyenne, delta }) => {
          const admissible = moyenne !== null && moyenne >= ecole.barre_admissibilite_2026;
          const moyenneColor = moyenne === null ? "text-slate-800" : admissible ? "text-emerald-600" : "text-red-600";
          return html`
            <div key=${ecole.nom} class="bg-slate-50 rounded-lg px-3 py-2">
              <p class="text-slate-500 flex items-center gap-1.5 truncate">
                <span
                  class="h-2 w-2 rounded-full shrink-0"
                  style=${{ backgroundColor: ECOLE_COLORS[ecole.nom] || "#0F172A" }}
                ></span>
                ${ecole.nom}
              </p>
              <p class=${`font-semibold ${moyenneColor}`}>
                ${moyenne === null ? "—" : `${moyenne.toFixed(2)}/20`}
                ${moyenne !== null && html`<span class="font-normal text-slate-400"> / ${ecole.barre_admissibilite_2026}</span>`}
                ${admissible && html`<span class="ml-0.5">✓</span>`}
              </p>
              ${delta !== null &&
              html`<p class=${`text-xs font-medium ${deltaClass(delta)}`}>${formatDelta(delta)} vs ${previousCb.nom}</p>`}
            </div>
          `;
        })}
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-sm">
        <div class="bg-slate-50 rounded-lg px-3 py-2">
          <p class="text-slate-500">Classement section</p>
          <p class="font-semibold text-slate-800">
            ${cb.classement_section ?? "—"} / ${cb.effectif_section ?? "—"}
            ${pctSection !== null && html`<span class="text-slate-400 font-normal"> (${pctSection.toFixed(1)}%)</span>`}
          </p>
        </div>
        <div class="bg-slate-50 rounded-lg px-3 py-2">
          <p class="text-slate-500">Classement promo</p>
          <p class="font-semibold text-slate-800">
            ${cb.classement_promo ?? "—"} / ${cb.effectif_promo ?? "—"}
            ${pctPromo !== null && html`<span class="text-slate-400 font-normal"> (${pctPromo.toFixed(1)}%)</span>`}
          </p>
        </div>
        <div class="bg-slate-50 rounded-lg px-3 py-2">
          <p class="text-slate-500">Points Saint-Jean</p>
          <p class="font-semibold text-slate-800">
            ${pointsSaintJean(cb)?.toFixed(1) ?? "—"} <span class="text-slate-400 font-normal">/ 600</span>
          </p>
        </div>
      </div>
    </div>
  `;
}
