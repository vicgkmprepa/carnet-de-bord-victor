import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { Card } from "../common/Card.js";
import { Badge } from "../common/Badge.js";
import { EmptyState } from "../common/EmptyState.js";
import { subjectAccent, subjectLabel } from "../../lib/subjectMapping.js";
import { formatDateFr, isPast } from "../../lib/dateUtils.js";

const STATUTS = ["à faire", "en cours", "fait"];
const GENERAL = "Général";

export function TasksSummary() {
  const { data, addTask, updateTaskTitre, updateTaskStatut, toggleTaskDevoir, deleteTask } = useCarnet();
  const [showAdd, setShowAdd] = useState(false);
  const [titre, setTitre] = useState("");
  const [deadline, setDeadline] = useState("");
  const [devoir, setDevoir] = useState(false);

  // Une tâche faite disparaît directement de cette vue globale (contrairement à
  // l'onglet de la matière, où elle reste visible barrée jusqu'à la fin de la
  // journée) — ce widget ne doit montrer que ce qui reste à faire.
  const tasks = data.taches_globales
    .filter((t) => t.statut !== "fait")
    .sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    });

  const enRetard = tasks.filter((t) => t.statut !== "fait" && isPast(t.deadline)).length;

  const handleAdd = () => {
    if (!titre.trim()) return;
    addTask({ matiere: GENERAL, titre: titre.trim(), deadline: deadline || null, devoir });
    setTitre("");
    setDeadline("");
    setDevoir(false);
    setShowAdd(false);
  };

  return html`
    <${Card}
      title="Tâches — tous onglets"
      subtitle=${enRetard > 0 ? `${enRetard} tâche${enRetard > 1 ? "s" : ""} en retard` : "Aucune tâche en retard"}
      actions=${html`
        <button
          class="h-7 w-7 rounded-full border border-slate-300 text-slate-500 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center text-base leading-none"
          onClick=${() => setShowAdd((v) => !v)}
          title="Ajouter une tâche générale"
        >
          +
        </button>
      `}
    >
      ${showAdd &&
      html`
        <div class="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            class="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            placeholder="Tâche générale (non rattachée à une matière)…"
            value=${titre}
            autoFocus
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
            class="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-slate-500 hover:bg-slate-600 disabled:opacity-50"
            onClick=${handleAdd}
            disabled=${!titre.trim()}
          >
            Ajouter
          </button>
        </div>
      `}

      ${tasks.length === 0
        ? html`<${EmptyState} text="Aucune tâche pour l'instant." />`
        : html`
            <ul class="divide-y divide-slate-100 max-h-96 overflow-y-auto overflow-x-hidden">
              ${tasks.map(
                (t) => html`
                  <${TaskRow}
                    key=${t.id}
                    task=${t}
                    onStatusChange=${(s) => updateTaskStatut(t.id, s)}
                    onRename=${(titre) => updateTaskTitre(t.id, titre)}
                    onToggleDevoir=${() => toggleTaskDevoir(t.id)}
                    onDelete=${() => confirm(`Supprimer "${t.titre}" ?`) && deleteTask(t.id)}
                  />
                `
              )}
            </ul>
          `}
    <//>
  `;
}

function TaskRow({ task, onStatusChange, onRename, onToggleDevoir, onDelete }) {
  const late = task.statut !== "fait" && isPast(task.deadline);
  const [editing, setEditing] = useState(false);
  const [editTitre, setEditTitre] = useState(task.titre);

  const saveEdit = () => {
    if (editTitre.trim()) onRename(editTitre.trim());
    setEditing(false);
  };

  return html`
    <li class=${`py-2.5 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 ${
      task.devoir ? "bg-red-50 -mx-2 px-2 rounded-lg shadow-[inset_4px_0_0_0_#ef4444]" : ""
    }`}>
      <input
        type="checkbox"
        class="h-4 w-4 rounded border-slate-300 shrink-0"
        checked=${task.statut === "fait"}
        onChange=${(e) => onStatusChange(e.target.checked ? "fait" : "à faire")}
      />
      <button
        class=${`text-sm shrink-0 ${task.devoir ? "opacity-100" : "opacity-20 hover:opacity-60"}`}
        onClick=${onToggleDevoir}
        title=${task.devoir ? "Retirer le statut devoir" : "Marquer comme devoir"}
      >
        📌
      </button>
      <${Badge} label=${subjectLabel(task.matiere)} color=${subjectAccent(task.matiere)} />
      ${task.devoir && html`<span class="shrink-0 px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">DEVOIR</span>`}
      ${editing
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
              class=${`flex-1 min-w-0 basis-full sm:basis-auto text-sm cursor-text truncate ${
                task.statut === "fait"
                  ? "line-through text-slate-400"
                  : task.devoir
                  ? "font-bold text-red-700"
                  : "text-slate-700"
              }`}
              onClick=${() => {
                setEditTitre(task.titre);
                setEditing(true);
              }}
              title="Cliquer pour modifier"
            >
              ${task.titre}
            </span>
          `}
      <select
        class="text-xs border border-slate-200 rounded-md px-1.5 py-1 text-slate-600 bg-white shrink-0"
        value=${task.statut}
        onChange=${(e) => onStatusChange(e.target.value)}
      >
        ${STATUTS.map((s) => html`<option value=${s}>${s}</option>`)}
      </select>
      <span class=${`text-xs whitespace-nowrap shrink-0 ${late ? "text-red-600 font-semibold" : "text-slate-400"}`}>
        ${formatDateFr(task.deadline)}
      </span>
      <button class="text-slate-300 hover:text-red-500 text-sm leading-none shrink-0" onClick=${onDelete} title="Supprimer">
        ✕
      </button>
    </li>
  `;
}
