import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { EmptyState } from "../common/EmptyState.js";
import { formatDateTimeFr } from "../../lib/dateUtils.js";

export function CommentJournal({ tab }) {
  const { data, addComment, deleteComment } = useCarnet();
  const [texte, setTexte] = useState("");
  const commentaires = data.matieres_onglets[tab.key].commentaires;

  const handleAdd = () => {
    if (!texte.trim()) return;
    addComment(tab.key, texte.trim());
    setTexte("");
  };

  return html`
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h3 class="text-base font-semibold text-slate-800 mb-4">Journal de bord</h3>

      <div class="flex flex-col gap-2 mb-4">
        <textarea
          class="border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
          rows="2"
          placeholder="Point de méthode, retour de colleur…"
          value=${texte}
          onInput=${(e) => setTexte(e.target.value)}
        ></textarea>
        <button
          class="self-end px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style=${{ backgroundColor: tab.accent }}
          onClick=${handleAdd}
          disabled=${!texte.trim()}
        >
          Ajouter au journal
        </button>
      </div>

      ${commentaires.length === 0
        ? html`<${EmptyState} text="Aucune entrée pour l'instant." />`
        : html`
            <ul class="space-y-3 max-h-80 overflow-y-auto overflow-x-hidden">
              ${commentaires.map(
                (c) => html`
                  <li key=${c.id} class="border-l-2 pl-3" style=${{ borderColor: tab.accent }}>
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-xs text-slate-400">${formatDateTimeFr(c.date)}</span>
                      <button
                        class="text-slate-300 hover:text-red-500 text-xs leading-none"
                        onClick=${() => deleteComment(tab.key, c.id)}
                        title="Supprimer"
                      >
                        ✕
                      </button>
                    </div>
                    <p class="text-sm text-slate-700 whitespace-pre-wrap">${c.texte}</p>
                  </li>
                `
              )}
            </ul>
          `}
    </div>
  `;
}
