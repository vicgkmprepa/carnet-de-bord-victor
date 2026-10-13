import { useState } from "../../lib/react.js";
import { html } from "../../lib/htm.js";
import { useCarnet } from "../../state/store.js";
import { EmptyState } from "../common/EmptyState.js";

export function ObjectiveList({ tab }) {
  const { data, addObjectif, toggleObjectif, deleteObjectif } = useCarnet();
  const [texte, setTexte] = useState("");
  const objectifs = data.matieres_onglets[tab.key].objectifs;

  const handleAdd = () => {
    if (!texte.trim()) return;
    addObjectif(tab.key, texte.trim());
    setTexte("");
  };

  return html`
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h3 class="text-base font-semibold text-slate-800 mb-4">Objectifs</h3>

      <div class="flex gap-2 mb-4">
        <input
          class="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          placeholder="Ex : Maîtriser les intégrales par parties d'ici le CB2"
          value=${texte}
          onInput=${(e) => setTexte(e.target.value)}
          onKeyDown=${(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          class="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style=${{ backgroundColor: tab.accent }}
          onClick=${handleAdd}
          disabled=${!texte.trim()}
        >
          Ajouter
        </button>
      </div>

      ${objectifs.length === 0
        ? html`<${EmptyState} text="Aucun objectif défini." />`
        : html`
            <ul class="space-y-2">
              ${objectifs.map(
                (o) => html`
                  <li key=${o.id} class="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      class="h-4 w-4 rounded border-slate-300 mt-0.5"
                      checked=${o.atteint}
                      onChange=${() => toggleObjectif(tab.key, o.id)}
                    />
                    <span class=${`flex-1 text-sm ${o.atteint ? "line-through text-slate-400" : "text-slate-700"}`}>
                      ${o.texte}
                    </span>
                    <button
                      class="text-slate-300 hover:text-red-500 text-sm leading-none"
                      onClick=${() => deleteObjectif(tab.key, o.id)}
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
