import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";

export function ColleForm({ initial, onSubmit, onCancel, onDelete }) {
  const [date, setDate] = useState(initial?.date || "");
  const [heure, setHeure] = useState(initial?.heure || "");
  const [salle, setSalle] = useState(initial?.salle || "");
  const [colleur, setColleur] = useState(initial?.colleur || "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [retour, setRetour] = useState(initial?.retour || "");
  const [axes, setAxes] = useState(initial?.axes_amelioration || "");

  const canSubmit = Boolean(date && heure);

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      date,
      heure,
      salle: salle.trim(),
      colleur: colleur.trim(),
      note: note === "" ? null : Number(note),
      retour: retour.trim(),
      axes_amelioration: axes.trim(),
    });
  };

  return html`
    <div
      class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-4"
      onKeyDown=${(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && handleSubmit()}
    >
      <h3 class="text-base font-semibold text-slate-800 mb-4">${initial ? "Modifier la colle" : "Ajouter une colle"}</h3>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <label class="text-sm text-slate-600">
          Date
          <input type="date" class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" value=${date} onChange=${(e) => setDate(e.target.value)} />
        </label>
        <label class="text-sm text-slate-600">
          Heure
          <input type="time" class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" value=${heure} onChange=${(e) => setHeure(e.target.value)} />
        </label>
        <label class="text-sm text-slate-600">
          Salle
          <input class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" placeholder="D314" value=${salle} onInput=${(e) => setSalle(e.target.value)} />
        </label>
        <label class="text-sm text-slate-600">
          Colleur
          <input class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" placeholder="Nom" value=${colleur} onInput=${(e) => setColleur(e.target.value)} />
        </label>
      </div>

      <label class="text-sm text-slate-600 block mb-3">
        Note (optionnel, sur 20)
        <input type="number" step="0.5" min="0" max="20" class="mt-1 w-24 border border-slate-300 rounded-lg px-3 py-1.5 text-sm" value=${note} onInput=${(e) => setNote(e.target.value)} />
      </label>

      <label class="text-sm text-slate-600 block mb-3">
        Retour du colleur
        <textarea class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" rows="2" placeholder="Ce qui a été dit à l'oral…" value=${retour} onInput=${(e) => setRetour(e.target.value)}></textarea>
      </label>

      <label class="text-sm text-slate-600 block mb-3">
        Axes d'amélioration
        <textarea class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" rows="2" placeholder="Ce qu'il faut travailler avant la prochaine…" value=${axes} onInput=${(e) => setAxes(e.target.value)}></textarea>
      </label>

      ${!canSubmit && html`<p class="text-xs text-red-500 mb-2">Date et heure requises.</p>`}
      <div class="flex items-center justify-between gap-2">
        <div>${onDelete && html`<button class="text-xs text-red-500 hover:text-red-700" onClick=${onDelete}>Supprimer</button>`}</div>
        <div class="flex gap-2">
          <button class="px-4 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100" onClick=${onCancel}>Annuler</button>
          <button
            class=${`px-4 py-1.5 rounded-lg text-sm font-medium text-white ${canSubmit ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-300 cursor-not-allowed"}`}
            onClick=${handleSubmit}
            disabled=${!canSubmit}
          >
            ${initial ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  `;
}
