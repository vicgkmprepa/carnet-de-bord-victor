import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { EmptyState } from "../common/EmptyState.js";
import { ColleForm } from "./ColleForm.js";
import { formatDateFr, isPast } from "../../lib/dateUtils.js";
import { colleHoraires } from "../../lib/colleUtils.js";

export function CollesTracker({ tab }) {
  const { data, addColle, updateColle, deleteColle } = useCarnet();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const colles = data.colles.filter((c) => c.matiere === tab.key).sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure));

  const openAdd = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setShowForm(true);
  };

  const handleSubmit = (colle) => {
    if (editing) updateColle(editing.id, colle);
    else addColle({ ...colle, matiere: tab.key });
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = (c) => {
    if (confirm(`Supprimer la colle du ${formatDateFr(c.date)} ?`)) deleteColle(c.id);
  };

  return html`
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-slate-800">Colles</h3>
        <button
          class="h-7 w-7 rounded-full border border-slate-300 text-slate-500 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center text-base leading-none"
          onClick=${openAdd}
          title="Ajouter une colle"
        >
          +
        </button>
      </div>

      ${showForm &&
      html`
        <${ColleForm}
          initial=${editing}
          onSubmit=${handleSubmit}
          onCancel=${() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      `}

      ${colles.length === 0
        ? html`<${EmptyState} text="Aucune colle programmée." />`
        : html`
            <ul class="space-y-3 max-h-96 overflow-y-auto overflow-x-hidden pr-1">
              ${colles.map((c) => {
                const passee = isPast(c.date);
                const { prepa, debutPrepa, debutColle, finColle } = colleHoraires(c);
                return html`
                  <li key=${c.id} class=${`border rounded-xl p-3 ${c.annulee ? "border-slate-200 bg-slate-50" : "border-slate-100"}`}>
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <p class=${`text-sm font-semibold ${c.annulee ? "text-slate-400 line-through" : "text-slate-800"}`}>
                          ${formatDateFr(c.date)} · ${debutColle}–${finColle}
                          ${c.note !== null && c.note !== undefined && html`<span class="ml-2 text-emerald-600">${c.note}/20</span>`}
                        </p>
                        <p class="text-xs text-slate-500">
                          ${prepa > 0 ? `Prépa dès ${debutPrepa} · ` : "Sans prépa · "}Passage ${debutColle}–${finColle}
                        </p>
                        <p class="text-xs text-slate-500">
                          ${[c.colleur, c.salle].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <div class="flex items-center gap-2 text-xs shrink-0">
                        <button
                          class=${c.annulee ? "text-emerald-600 hover:text-emerald-700" : "text-red-500 hover:text-red-600"}
                          onClick=${() => updateColle(c.id, { annulee: !c.annulee })}
                        >
                          ${c.annulee ? "↩ Rétablir" : "🚫 Annuler"}
                        </button>
                        <button class="text-slate-400 hover:text-slate-700" onClick=${() => openEdit(c)}>Modifier</button>
                        <button class="text-slate-300 hover:text-red-500" onClick=${() => handleDelete(c)}>✕</button>
                      </div>
                    </div>
                    ${c.annulee && html`<p class="text-xs text-slate-400 mt-2">🚫 Annulée — ne compte pas dans le temps de travail.</p>`}
                    ${c.retour && html`<p class="text-sm text-slate-600 mt-2"><span class="text-slate-400">Retour :</span> ${c.retour}</p>`}
                    ${c.axes_amelioration &&
                    html`<p class="text-sm text-slate-600 mt-1"><span class="text-slate-400">À travailler :</span> ${c.axes_amelioration}</p>`}
                    ${!c.annulee && !passee && !c.retour && html`<p class="text-xs text-slate-400 mt-2 italic">À venir</p>`}
                  </li>
                `;
              })}
            </ul>
          `}
    </div>
  `;
}
