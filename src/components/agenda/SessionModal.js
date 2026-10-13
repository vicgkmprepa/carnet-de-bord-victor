import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { itemLabel } from "../../lib/subjectMapping.js";
import { formatDateFr } from "../../lib/dateUtils.js";

// Popup pour une session de travail ponctuelle — même principe que SeanceModal
// pour un créneau récurrent (jamais de bascule directe au clic), avec en plus le
// contenu prévu/fait de la séance (déjà unique par nature, une session ponctuelle
// n'existant qu'une fois).
export function SessionModal({
  session,
  onClose,
  onToggleRealisee,
  onUpdateContenu,
  onAddDevoir,
  devoirsExistants,
  onToggleDevoirFait,
  onEdit,
}) {
  const done = session.statut === "realise";
  const titre = itemLabel(session.matiere, session.theme, session.titre);
  const [contenu, setContenu] = useState(session.contenu || "");
  const [devoirInput, setDevoirInput] = useState("");
  const [devoirsAjoutes, setDevoirsAjoutes] = useState([]);

  const ajouterDevoir = () => {
    const t = devoirInput.trim();
    if (!t) return;
    onAddDevoir(t);
    setDevoirsAjoutes((v) => [...v, t]);
    setDevoirInput("");
  };

  return html`
    <div class="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4" onClick=${onClose}>
      <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick=${(e) => e.stopPropagation()}>
        <h3 class="text-base font-semibold text-slate-800">${titre}</h3>
        <p class="text-xs text-slate-500 mb-4">${formatDateFr(session.date)} · ${session.debut}–${session.fin}</p>

        <label class="text-sm text-slate-600 block mb-1">
          Contenu de la séance (optionnel)
          <textarea
            class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
            rows="3"
            placeholder="Ex : fichage du manuel, chapitre 3, exercices de colle…"
            value=${contenu}
            onInput=${(e) => setContenu(e.target.value)}
          ></textarea>
        </label>
        <button
          class="w-full px-4 py-1.5 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 mb-4"
          onClick=${() => {
            onUpdateContenu(contenu);
            onClose();
          }}
        >
          Enregistrer le contenu
        </button>

        ${session.estCours &&
        html`
          ${devoirsExistants?.length > 0 &&
          html`
            <p class="text-xs text-slate-500 mb-1">📖 Devoirs donnés pour ce cours :</p>
            <ul class="mb-2 space-y-0.5">
              ${devoirsExistants.map(
                (d) => html`
                  <li key=${d.id} class="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      class="h-3.5 w-3.5 rounded border-slate-300 shrink-0"
                      checked=${d.statut === "fait"}
                      onChange=${(e) => onToggleDevoirFait(d.id, e.target.checked)}
                    />
                    <span class=${d.statut === "fait" ? "line-through text-slate-400" : "text-slate-600"}>${d.titre}</span>
                  </li>
                `
              )}
            </ul>
          `}
          <label class=${`text-sm text-slate-600 block mb-1 ${devoirsAjoutes.length === 0 ? "mb-4" : ""}`}>
            📌 Devoirs donnés
            <div class="flex gap-2 mt-1">
              <input
                class="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                placeholder="Ex : exercices 4 et 5 p.32…"
                value=${devoirInput}
                onInput=${(e) => setDevoirInput(e.target.value)}
                onKeyDown=${(e) => e.key === "Enter" && ajouterDevoir()}
              />
              <button
                class="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 shrink-0"
                onClick=${ajouterDevoir}
                disabled=${!devoirInput.trim()}
              >
                Ajouter
              </button>
            </div>
          </label>
          ${devoirsAjoutes.length > 0 &&
          html`
            <ul class="mb-4 mt-1 space-y-0.5">
              ${devoirsAjoutes.map(
                (d) => html`<li class="text-xs text-red-600 flex items-center gap-1">✓ « ${d} » ajouté aux tâches (devoir)</li>`
              )}
            </ul>
          `}
        `}

        ${!session.estCours &&
        html`
          <p class="text-sm text-slate-600 mb-4">
            ${done ? "Cette session est marquée réalisée." : "Cette session a-t-elle été réalisée ?"}
          </p>
          <button
            class=${`w-full px-4 py-1.5 rounded-lg text-sm font-medium text-white mb-2 ${
              done ? "bg-slate-500 hover:bg-slate-600" : "bg-slate-900 hover:bg-slate-800"
            }`}
            onClick=${() => {
              onToggleRealisee(contenu);
              onClose();
            }}
          >
            ${done ? "Marquer non réalisée" : "Oui, marquer réalisée"}
          </button>
        `}

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <button class="text-xs text-slate-500 hover:text-slate-700" onClick=${onEdit}>Modifier / supprimer</button>
            <button class="text-xs text-slate-500 hover:text-slate-700" onClick=${onClose}>Fermer</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
