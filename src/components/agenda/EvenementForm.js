import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { roundedNowTime, addMinutesToTime } from "../../lib/scheduleUtils.js";

export function EvenementForm({ initial, defaultDate, onSubmit, onDelete, onDuplicate, onCancel }) {
  const [date, setDate] = useState(initial?.date || defaultDate);
  const [debut, setDebut] = useState(initial?.debut || roundedNowTime());
  const [fin, setFin] = useState(initial?.fin || addMinutesToTime(roundedNowTime(), 60));
  const [titre, setTitre] = useState(initial?.titre || "");

  const canSubmit = Boolean(date && debut && fin && fin > debut && titre.trim());

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ date, debut, fin, titre: titre.trim() });
  };

  return html`
    <div
      class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5"
      onKeyDown=${(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && handleSubmit()}
    >
      <h3 class="text-base font-semibold text-slate-800 mb-1">${initial ? "Modifier l'événement" : "Ajouter un événement ponctuel"}</h3>
      <p class="text-xs text-slate-500 mb-4">Une date précise, ne se répète jamais — n'entre pas dans le temps de travail.</p>

      <label class="text-sm text-slate-600 block mb-3">
        Titre
        <input
          class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          placeholder="Ex : Déjeuner avec …"
          value=${titre}
          autoFocus
          onInput=${(e) => setTitre(e.target.value)}
        />
      </label>

      <div class="grid grid-cols-3 gap-3">
        <label class="text-sm text-slate-600">
          Date
          <input
            type="date"
            class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            value=${date}
            onChange=${(e) => setDate(e.target.value)}
          />
        </label>
        <label class="text-sm text-slate-600">
          Début
          <input
            type="time"
            class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            value=${debut}
            onChange=${(e) => setDebut(e.target.value)}
          />
        </label>
        <label class="text-sm text-slate-600">
          Fin
          <input
            type="time"
            class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            value=${fin}
            onChange=${(e) => setFin(e.target.value)}
          />
        </label>
      </div>

      ${!canSubmit && html`<p class="text-xs text-red-500 mt-2">Titre requis, et l'heure de fin doit être après le début.</p>`}

      <div class="flex items-center justify-between gap-2 mt-5">
        <div class="flex items-center gap-3">
          ${initial &&
          html`<button class="text-xs text-red-500 hover:text-red-700" onClick=${onDelete}>Supprimer cet événement</button>`}
          ${initial &&
          html`<button class="text-xs text-slate-500 hover:text-slate-800" onClick=${() => onDuplicate({ date, debut, fin, titre: titre.trim() })}>Dupliquer</button>`}
        </div>
        <div class="flex gap-2">
          <button class="px-4 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100" onClick=${onCancel}>Annuler</button>
          <button
            class=${`px-4 py-1.5 rounded-lg text-sm font-medium text-white ${
              canSubmit ? "bg-violet-600 hover:bg-violet-700" : "bg-slate-300 cursor-not-allowed"
            }`}
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
