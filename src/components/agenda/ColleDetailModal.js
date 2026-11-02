import { html } from "../../lib/htm.js";
import { formatDateFr } from "../../lib/dateUtils.js";
import { subjectAccent, subjectLabel } from "../../lib/subjectMapping.js";
import { colleHoraires } from "../../lib/colleUtils.js";

// Popup de lecture d'une colle, ouverte au clic depuis l'agenda — les cases de
// la grille sont trop petites pour bien distinguer heure de prépa / heure de
// passage / salle / colleur d'un coup d'œil, d'où ce résumé plus posé.
export function ColleDetailModal({ colle, onClose, onEdit, onToggleAnnulee }) {
  const { prepa, debutPrepa, debutColle, finColle } = colleHoraires(colle);
  const color = colle.annulee ? "#94A3B8" : subjectAccent(colle.matiere);

  return html`
    <div class="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4" onClick=${onClose}>
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick=${(e) => e.stopPropagation()}>
        <div class="px-6 py-5" style=${{ backgroundColor: color }}>
          <p class="text-xs font-medium text-white/80 uppercase tracking-wide">Colle${colle.annulee ? " — annulée" : ""}</p>
          <h3 class=${`text-lg font-semibold text-white ${colle.annulee ? "line-through opacity-80" : ""}`}>${subjectLabel(colle.matiere)}</h3>
          <p class="text-sm text-white/90">${formatDateFr(colle.date)}</p>
        </div>
        ${colle.annulee &&
        html`<p class="px-6 pt-3 text-xs text-slate-500">🚫 Colle annulée — ne compte pas dans le temps de travail réalisé.</p>`}

        <div class="px-6 py-5 space-y-4">
          <div class="flex items-center gap-3">
            <div class="flex flex-col items-center shrink-0">
              <span class=${`h-2.5 w-2.5 rounded-full ${prepa > 0 ? "bg-slate-300" : "bg-slate-200"}`}></span>
              <span class="w-px flex-1 bg-slate-200 my-0.5" style=${{ minHeight: "1.25rem" }}></span>
              <span class="h-2.5 w-2.5 rounded-full" style=${{ backgroundColor: color }}></span>
            </div>
            <div class="flex-1 space-y-3.5">
              <div>
                <p class="text-xs text-slate-400">${prepa > 0 ? "Préparation" : "Pas de préparation"}</p>
                <p class="text-sm font-medium text-slate-700">
                  ${prepa > 0 ? html`${debutPrepa} – ${debutColle}<span class="text-slate-400 font-normal"> (${prepa} min)</span>` : "—"}
                </p>
              </div>
              <div>
                <p class="text-xs text-slate-400">Passage</p>
                <p class="text-sm font-semibold text-slate-800">${debutColle} – ${finColle}</p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 pt-1">
            <div class="rounded-xl bg-slate-50 px-3 py-2.5">
              <p class="text-xs text-slate-400">Salle</p>
              <p class="text-sm font-medium text-slate-800">${colle.salle || "—"}</p>
            </div>
            <div class="rounded-xl bg-slate-50 px-3 py-2.5">
              <p class="text-xs text-slate-400">Colleur</p>
              <p class="text-sm font-medium text-slate-800">${colle.colleur || "—"}</p>
            </div>
          </div>

          ${colle.note !== null &&
          colle.note !== undefined &&
          html`
            <div class="rounded-xl bg-emerald-50 px-3 py-2.5">
              <p class="text-xs text-emerald-600">Note</p>
              <p class="text-sm font-semibold text-emerald-700">${colle.note}/20</p>
            </div>
          `}
          ${colle.retour &&
          html`
            <div>
              <p class="text-xs text-slate-400 mb-0.5">Retour du colleur</p>
              <p class="text-sm text-slate-600">${colle.retour}</p>
            </div>
          `}
          ${colle.axes_amelioration &&
          html`
            <div>
              <p class="text-xs text-slate-400 mb-0.5">Axes d'amélioration</p>
              <p class="text-sm text-slate-600">${colle.axes_amelioration}</p>
            </div>
          `}
        </div>

        <div class="px-6 pb-5 flex justify-between gap-2">
          <button
            class=${`px-3 py-1.5 rounded-lg text-sm font-medium ${
              colle.annulee ? "text-emerald-600 hover:bg-emerald-50" : "text-red-600 hover:bg-red-50"
            }`}
            onClick=${onToggleAnnulee}
          >
            ${colle.annulee ? "↩ Rétablir" : "🚫 Annuler cette colle"}
          </button>
          <div class="flex gap-2">
            <button class="px-4 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100" onClick=${onClose}>Fermer</button>
            <button class="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800" onClick=${onEdit}>Modifier</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
