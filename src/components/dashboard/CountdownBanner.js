import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { daysUntil, formatDateFr } from "../../lib/dateUtils.js";

export function CountdownBanner() {
  const { data, updateProfil } = useCarnet();
  const [editingPhrase, setEditingPhrase] = useState(false);
  const [phraseDraft, setPhraseDraft] = useState(data.profil.objectif_phrase);
  const [editingDate, setEditingDate] = useState(false);

  const joursEcrits = daysUntil(data.profil.date_ecrits);

  const cbsFuturs = (data.concours_blancs || [])
    .filter((cb) => cb.date && daysUntil(cb.date) !== null && daysUntil(cb.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const prochainCB = cbsFuturs[0];

  const savePhrase = () => {
    updateProfil({ objectif_phrase: phraseDraft.trim() || "Objectif HEC" });
    setEditingPhrase(false);
  };

  return html`
    <div
      class="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between"
    >
      <div>
        ${editingPhrase
          ? html`
              <input
                class="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xl font-bold text-white outline-none focus:border-slate-400"
                value=${phraseDraft}
                autoFocus
                onInput=${(e) => setPhraseDraft(e.target.value)}
                onBlur=${savePhrase}
                onKeyDown=${(e) => e.key === "Enter" && savePhrase()}
              />
            `
          : html`
              <button
                class="text-xl sm:text-2xl font-bold hover:opacity-80 text-left"
                onClick=${() => {
                  setPhraseDraft(data.profil.objectif_phrase);
                  setEditingPhrase(true);
                }}
              >
                ${data.profil.objectif_phrase} <span class="text-slate-500 text-sm align-middle">✎</span>
              </button>
            `}
        <p class="text-slate-400 text-sm mt-1 flex items-center gap-2">
          Écrits le
          ${editingDate
            ? html`
                <input
                  type="date"
                  class="bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-white text-sm outline-none"
                  value=${data.profil.date_ecrits || ""}
                  autoFocus
                  onChange=${(e) => {
                    updateProfil({ date_ecrits: e.target.value });
                    setEditingDate(false);
                  }}
                  onBlur=${() => setEditingDate(false)}
                />
              `
            : html`
                <button class="underline decoration-dotted hover:text-white" onClick=${() => setEditingDate(true)}>
                  ${formatDateFr(data.profil.date_ecrits)}
                </button>
              `}
        </p>
      </div>
      <div class="flex gap-4 sm:gap-6">
        <${StatBlock} value=${joursEcrits !== null ? joursEcrits : "—"} label="jours avant les écrits" />
        ${prochainCB
          ? html`<${StatBlock} value=${daysUntil(prochainCB.date)} label=${`avant ${prochainCB.nom}`} />`
          : html`<${StatBlock} value="—" label="aucun CB programmé" />`}
      </div>
    </div>
  `;
}

function StatBlock({ value, label }) {
  return html`
    <div class="text-center sm:text-right">
      <div class="text-2xl sm:text-3xl font-bold tabular-nums">${value}</div>
      <div class="text-xs text-slate-400 whitespace-nowrap">${label}</div>
    </div>
  `;
}
