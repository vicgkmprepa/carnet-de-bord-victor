import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { SUBJECT_TABS, MATHS_THEMES } from "../../lib/subjectMapping.js";
import { roundedNowTime, addMinutesToTime } from "../../lib/scheduleUtils.js";

const MATIERE_OPTIONS = [...SUBJECT_TABS.map((t) => t.key), "Général"];

export function SessionPonctuelleForm({ initial, defaultDate, defaultDebut, onSubmit, onDelete, onDuplicate, onCancel }) {
  const [date, setDate] = useState(initial?.date || defaultDate);
  const [debut, setDebut] = useState(initial?.debut || defaultDebut || roundedNowTime());
  const [fin, setFin] = useState(initial?.fin || addMinutesToTime(defaultDebut || roundedNowTime(), 60));
  const [matiere, setMatiere] = useState(initial?.matiere || SUBJECT_TABS[0].key);
  const [titre, setTitre] = useState(initial?.titre || "");
  const [theme, setTheme] = useState(initial?.theme || "");
  const [repeter, setRepeter] = useState(false);
  const [nbSemaines, setNbSemaines] = useState(4);

  const canSubmit = Boolean(date && debut && fin && fin > debut);

  const handleSubmit = () => {
    if (!canSubmit) return;
    const semaines = repeter ? Math.max(2, Math.min(20, Number(nbSemaines) || 2)) : 1;
    onSubmit(
      { date, debut, fin, matiere, titre: titre.trim(), theme: matiere === "Maths" ? theme : "" },
      semaines
    );
  };

  return html`
    <div
      class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5"
      onKeyDown=${(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && handleSubmit()}
    >
      <h3 class="text-base font-semibold text-slate-800 mb-1">
        ${initial ? "Modifier la session" : "Ajouter une session de travail ponctuelle"}
      </h3>
      <p class="text-xs text-slate-500 mb-4">
        Une date précise, ne fait pas partie de l'emploi du temps type — compte dans le temps de travail par matière.
      </p>

      <label class="text-sm text-slate-600 block mb-3">
        Titre (optionnel)
        <input
          class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          placeholder="Ex : Thème guerre froide"
          value=${titre}
          autoFocus
          onInput=${(e) => setTitre(e.target.value)}
        />
      </label>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

      ${!initial &&
      html`
        <label class="flex items-center gap-2 text-sm text-slate-600 mt-4">
          <input type="checkbox" checked=${repeter} onChange=${(e) => setRepeter(e.target.checked)} />
          Répéter chaque semaine, même jour et même horaire
        </label>
        ${repeter &&
        html`
          <label class="text-sm text-slate-600 block mt-2 max-w-[10rem]">
            Nombre de semaines
            <input
              type="number"
              min="2"
              max="20"
              class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              value=${nbSemaines}
              onInput=${(e) => setNbSemaines(e.target.value)}
              onBlur=${(e) => setNbSemaines(Math.max(2, Math.min(20, Number(e.target.value) || 2)))}
            />
          </label>
          <p class="text-xs text-slate-400 mt-1">
            Crée ${Math.max(2, Math.min(20, Number(nbSemaines) || 2))} sessions indépendantes (une par semaine) —
            chacune reste modifiable ou supprimable séparément ensuite, sans créer de créneau permanent dans
            l'emploi du temps.
          </p>
        `}
      `}

      ${!canSubmit && html`<p class="text-xs text-red-500 mt-2">L'heure de fin doit être après l'heure de début.</p>`}

      <div class="flex items-center justify-between gap-2 mt-5">
        <div class="flex items-center gap-3">
          ${initial &&
          html`<button class="text-xs text-red-500 hover:text-red-700" onClick=${onDelete}>Supprimer cette session</button>`}
          ${initial &&
          html`<button class="text-xs text-slate-500 hover:text-slate-800" onClick=${() => onDuplicate({ date, debut, fin, matiere, titre: titre.trim(), theme: matiere === "Maths" ? theme : "" })}>Dupliquer</button>`}
        </div>
        <div class="flex gap-2">
          <button class="px-4 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100" onClick=${onCancel}>Annuler</button>
          <button
            class=${`px-4 py-1.5 rounded-lg text-sm font-medium text-white ${
              canSubmit ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-300 cursor-not-allowed"
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
