import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { JOURS, roundedNowTime, addMinutesToTime } from "../../lib/scheduleUtils.js";
import { SUBJECT_TABS, MATHS_THEMES } from "../../lib/subjectMapping.js";

const MATIERE_OPTIONS = [...SUBJECT_TABS.map((t) => t.key), "Général"];

export function CreneauForm({ initial, defaultJour, onSubmit, onCancel }) {
  const [jour, setJour] = useState(initial?.jour || defaultJour || "lundi");
  const [debut, setDebut] = useState(initial?.debut || roundedNowTime());
  const [fin, setFin] = useState(initial?.fin || addMinutesToTime(roundedNowTime(), 120));
  const [matiere, setMatiere] = useState(initial?.matiere || SUBJECT_TABS[0].key);
  const [type, setType] = useState(initial?.type || "travail");
  const [titre, setTitre] = useState(initial?.titre || "");
  const [theme, setTheme] = useState(initial?.theme || "");

  const canSubmit = Boolean(debut && fin && fin > debut);

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ jour, debut, fin, matiere, type, titre: titre.trim(), theme: matiere === "Maths" ? theme : "" });
  };

  return html`
    <div
      class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5"
      onKeyDown=${(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && handleSubmit()}
    >
      <h3 class="text-base font-semibold text-slate-800 mb-4">
        ${initial ? "Modifier le créneau" : "Ajouter un créneau récurrent"}
      </h3>
      <label class="text-sm text-slate-600 block mb-3">
        Titre (optionnel — sinon le nom de la matière est utilisé)
        <input
          class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          placeholder="Ex : Maths approfondies (PRTSL)"
          value=${titre}
          onInput=${(e) => setTitre(e.target.value)}
        />
      </label>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label class="text-sm text-slate-600">
          Jour
          <select
            class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            value=${jour}
            onChange=${(e) => setJour(e.target.value)}
          >
            ${JOURS.map((j) => html`<option value=${j.key}>${j.full}</option>`)}
          </select>
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
        <label class="text-sm text-slate-600">
          Matière
          <select
            class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            value=${matiere}
            onChange=${(e) => setMatiere(e.target.value)}
          >
            ${MATIERE_OPTIONS.map((m) => html`<option value=${m}>${m}</option>`)}
          </select>
        </label>
        ${matiere === "Maths" &&
        html`
          <label class="text-sm text-slate-600">
            Thème (optionnel)
            <select
              class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              value=${theme}
              onChange=${(e) => setTheme(e.target.value)}
            >
              <option value="">—</option>
              ${MATHS_THEMES.map((t) => html`<option value=${t}>${t}</option>`)}
            </select>
          </label>
        `}
      </div>

      <div class="flex gap-2 mt-3">
        <button
          class=${`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
            type === "travail" ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
          onClick=${() => setType("travail")}
        >
          Session de travail perso
        </button>
        <button
          class=${`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
            type === "cours" ? "bg-slate-500 text-white border-slate-500" : "border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
          onClick=${() => setType("cours")}
        >
          Cours fixe (gris, hors temps de travail)
        </button>
      </div>

      ${!canSubmit && html`<p class="text-xs text-red-500 mt-2">L'heure de fin doit être après l'heure de début.</p>`}
      <div class="flex justify-end gap-2 mt-5">
        <button class="px-4 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100" onClick=${onCancel}>
          Annuler
        </button>
        <button
          class=${`px-4 py-1.5 rounded-lg text-sm font-medium text-white ${
            canSubmit ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-300 cursor-not-allowed"
          }`}
          onClick=${handleSubmit}
          disabled=${!canSubmit}
        >
          ${initial ? "Enregistrer" : "Ajouter"}
        </button>
      </div>
    </div>
  `;
}
