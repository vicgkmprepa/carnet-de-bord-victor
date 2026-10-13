import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { EmptyState } from "../common/EmptyState.js";
import { formatDateFr, isPast } from "../../lib/dateUtils.js";

const STATUTS = ["à faire", "en cours", "fait"];

export function TaskList({ tab }) {
  const { data, addTask, updateTaskTitre, updateTaskStatut, toggleTaskDevoir, deleteTask, today } = useCarnet();
  const [titre, setTitre] = useState("");
  const [deadline, setDeadline] = useState("");
  const [devoir, setDevoir] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitre, setEditTitre] = useState("");

  const tasks = data.taches_globales
    .filter((t) => t.matiere === tab.key)
    // Un devoir fait n'est jamais purgé des données (pour garder sa trace dans
    // le cours qui l'a donné), mais doit disparaître de CETTE liste selon la
    // même règle que les tâches normales : visible barré le jour même, plus le
    // lendemain — sans quoi il resterait affiché ici indéfiniment.
    .filter((t) => !(t.statut === "fait" && t.devoir && t.faitLe !== today))
    .sort((a, b) => {
      // Faites en dernier, quelle que soit l'échéance — elles restent visibles le
      // temps de la journée (barrées) puis sont purgées au changement de jour.
      const aFait = a.statut === "fait";
      const bFait = b.statut === "fait";
      if (aFait !== bFait) return aFait ? 1 : -1;
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    });

  const handleAdd = () => {
    if (!titre.trim()) return;
    addTask({ matiere: tab.key, titre: titre.trim(), deadline: deadline || null, devoir });
    setTitre("");
    setDeadline("");
    setDevoir(false);
  };

  const openEdit = (t) => {
    setEditingId(t.id);
    setEditTitre(t.titre);
  };

  const saveEdit = () => {
    if (!editTitre.trim()) return;
    updateTaskTitre(editingId, editTitre.trim());
    setEditingId(null);
  };

  return html`
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h3 class="text-base font-semibold text-slate-800 mb-4">Tâches à faire</h3>

      <div class="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          class="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          placeholder="Nouvelle tâche…"
          value=${titre}
          onInput=${(e) => setTitre(e.target.value)}
          onKeyDown=${(e) => e.key === "Enter" && handleAdd()}
        />
        <input
          type="date"
          class="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          value=${deadline}
          onChange=${(e) => setDeadline(e.target.value)}
        />
        <button
          class=${`shrink-0 px-2.5 py-1.5 rounded-lg text-sm border ${
            devoir ? "bg-red-50 border-red-300 text-red-600" : "border-slate-300 text-slate-400 hover:bg-slate-50"
          }`}
          onClick=${() => setDevoir((v) => !v)}
          title="Marquer comme devoir"
        >
          📌 Devoir
        </button>
        <button
          class="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style=${{ backgroundColor: tab.accent }}
          onClick=${handleAdd}
          disabled=${!titre.trim()}
        >
          Ajouter
        </button>
      </div>

      ${tasks.length === 0
        ? html`<${EmptyState} text="Aucune tâche pour l'instant." />`
        : html`
            <ul class="divide-y divide-slate-100">
              ${tasks.map(
                (t) => html`
                  <li key=${t.id} class=${`py-2.5 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 ${t.devoir ? "bg-red-50/60 -mx-2 px-2 rounded-lg" : ""}`}>
                    <input
                      type="checkbox"
                      class="h-4 w-4 rounded border-slate-300 shrink-0"
                      checked=${t.statut === "fait"}
                      onChange=${(e) => updateTaskStatut(t.id, e.target.checked ? "fait" : "à faire")}
                    />
                    <button
                      class=${`text-sm shrink-0 ${t.devoir ? "opacity-100" : "opacity-20 hover:opacity-60"}`}
                      onClick=${() => toggleTaskDevoir(t.id)}
                      title=${t.devoir ? "Retirer le statut devoir" : "Marquer comme devoir"}
                    >
                      📌
                    </button>
                    ${editingId === t.id
                      ? html`
                          <input
                            class="flex-1 min-w-0 basis-full sm:basis-auto border border-slate-300 rounded-md px-2 py-0.5 text-sm"
                            value=${editTitre}
                            autoFocus
                            onInput=${(e) => setEditTitre(e.target.value)}
                            onKeyDown=${(e) => e.key === "Enter" && saveEdit()}
                            onBlur=${saveEdit}
                          />
                        `
                      : html`
                          <span
                            class=${`flex-1 min-w-0 basis-full sm:basis-auto text-sm cursor-text ${
                              t.statut === "fait"
                                ? "line-through text-slate-400"
                                : t.devoir
                                ? "font-semibold text-red-700"
                                : "text-slate-700"
                            }`}
                            onClick=${() => openEdit(t)}
                            title="Cliquer pour modifier"
                          >
                            ${t.titre}
                          </span>
                        `}
                    <select
                      class="text-xs border border-slate-200 rounded-md px-1.5 py-1 text-slate-600 bg-white shrink-0"
                      value=${t.statut}
                      onChange=${(e) => updateTaskStatut(t.id, e.target.value)}
                    >
                      ${STATUTS.map((s) => html`<option value=${s}>${s}</option>`)}
                    </select>
                    <span
                      class=${`text-xs whitespace-nowrap shrink-0 ${
                        t.statut !== "fait" && isPast(t.deadline) ? "text-red-600 font-semibold" : "text-slate-400"
                      }`}
                    >
                      ${formatDateFr(t.deadline)}
                    </span>
                    <button
                      class="text-slate-300 hover:text-red-500 text-sm leading-none shrink-0"
                      onClick=${() => confirm(`Supprimer "${t.titre}" ?`) && deleteTask(t.id)}
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  </li>
                `
              )}
            </ul>
          `}
    </div>
  `;
}
